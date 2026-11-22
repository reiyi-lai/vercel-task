"use server";

import { loadSnapshot, TABLES, type Candidate } from "@/lib/data";
import { execName, sender, stepCard } from "@/lib/outreach";
import { notify } from "@/lib/slack";
import { ok, write } from "@/lib/write";

// Quick outreach updates for one candidate. Each saves the outreach row, and alerts the AE or BDR on Slack when it
// needs them: the first step is due, a reply to handle, an acceptance or a decline.

async function context(campaignId: string, contactId: string) {
  const s = await loadSnapshot();
  const c = s.contacts.find((x) => x.id === contactId)!;
  const brief = s.events.find((b) => b.campaign_id === campaignId)!;
  const o = s.candidates.find((x) => x.campaign_id === campaignId && x.contact_id === contactId);
  const ae = s.users.find((u) => u.id === c.owner_id);
  const who = `${c.first_name} ${c.last_name} (${s.accounts.find((a) => a.id === c.account_id)!.name})`;
  return { s, c, brief, o, ae: ae ? `${ae.first_name} ${ae.last_name}` : "Unassigned AE", who, event: s.campaigns.find((x) => x.id === campaignId)!.name };
}

// Marketing approves selected candidates for their seats. Each one's first-step sender (the AE or BDR) hears on Slack
// that they can push them to Outreach.
export async function approveCandidates(campaignId: string, contactIds: string[]) {
  const s = await loadSnapshot();
  const brief = s.events.find((b) => b.campaign_id === campaignId)!;
  const event = s.campaigns.find((x) => x.id === campaignId)!.name;
  const pending = s.candidates.filter((x) => x.campaign_id === campaignId && contactIds.includes(x.contact_id) && !x.approved_at);
  return write(async (db) => {
    ok(await db.from(TABLES.candidates).update({ approved_at: new Date().toISOString() }).eq("campaign_id", campaignId).in("contact_id", pending.map((x) => x.contact_id)));
    for (const x of pending) {
      const c = s.contacts.find((k) => k.id === x.contact_id)!;
      const by = brief.sequence[0] && sender(s, campaignId, brief.sequence[0], c);
      const who = `${c.first_name} ${c.last_name} (${s.accounts.find((a) => a.id === c.account_id)!.name})`;
      await notify(db, { campaign_id: campaignId, contact_id: c.id, recipient: by ? `${by.first_name} ${by.last_name}` : "Unassigned AE", kind: "Approved", text: `Marketing approved ${who} for ${event}. Check the copy and push them to Outreach.` });
    }
  });
}

export async function startSequence(campaignId: string, contactId: string) {
  const { s, c, brief, o, who, event } = await context(campaignId, contactId);
  if (!o?.approved_at) return "Waiting for marketing to approve this candidate.";
  const first = brief.sequence[0];
  if (!first) return "This event has no sequence yet: add steps on the Brief.";
  const missing = brief.sequence.find((step) => !sender(s, campaignId, step, c));
  if (missing) return `Assign ${missing.sender === "Exec" ? "an AE" : "a BDR"} first.`;
  if (brief.sequence.some((step) => step.sender === "Exec") && !execName(s, campaignId, c)) return "Add the exec signing off first.";
  return write(async (db) => {
    ok(await db.from(TABLES.candidates).update({ started_at: new Date().toISOString(), sent: [], outcome: null, outcome_at: null }).eq("campaign_id", campaignId).eq("contact_id", contactId));
    // Step 1 is due now: its card, with the drafted copy and Mark Sent / Edit buttons, goes to its sender.
    const card = stepCard(s, campaignId, c, 0);
    await notify(db, { campaign_id: campaignId, contact_id: contactId, recipient: card.recipient, kind: "Pushed to Outreach", text: `${event} outreach to ${who} was pushed to Outreach. ${card.text}` }, card.blocks);
  });
}


const NEXT: Record<string, string> = {
  Replied: "replied. Answer within a day, and stop the remaining steps.",
  Accepted: "accepted. Confirm the seat and logistics, and update the Salesforce campaign member.",
  Declined: "declined. Consider inviting a backup from the same account.",
};

// null clears the outcome (resumes a paused sequence).
export async function setOutcome(campaignId: string, contactId: string, outcome: Candidate["outcome"]) {
  const { ae, who, event } = await context(campaignId, contactId);
  return write(async (db) => {
    ok(await db.from(TABLES.candidates).update({ outcome, outcome_at: outcome && new Date().toISOString() }).eq("campaign_id", campaignId).eq("contact_id", contactId));
    if (outcome && NEXT[outcome]) await notify(db, { campaign_id: campaignId, contact_id: contactId, recipient: ae, kind: outcome, text: `${who} ${NEXT[outcome]} (${event})` });
  });
}

// Saves an edit to a step's copy without marking it sent; it replaces the template until the step is sent.
export async function saveDraft(campaignId: string, contactId: string, step: number, copy: { subject: string; body: string }) {
  const { o } = await context(campaignId, contactId);
  return write(async (db) =>
    ok(await db.from(TABLES.candidates).update({ drafts: { ...o?.drafts, [step]: copy } }).eq("campaign_id", campaignId).eq("contact_id", contactId))
  );
}
