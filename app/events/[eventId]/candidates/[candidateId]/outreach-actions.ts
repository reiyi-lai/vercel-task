"use server";

import { loadSnapshot, type Outreach } from "@/lib/data";
import { recordSent, stepCard } from "@/lib/outreach";
import { notify } from "@/lib/slack";
import { ok, write } from "@/lib/write";

// Quick outreach updates for one candidate. Each saves the outreach row, and alerts the AE or BDR on Slack when it
// needs them: the first step is due, a reply to handle, an acceptance or a decline.

async function context(campaignId: string, contactId: string) {
  const s = await loadSnapshot();
  const c = s.contacts.find((x) => x.id === contactId)!;
  const brief = s.event_briefs.find((b) => b.campaign_id === campaignId)!;
  const o = s.outreach.find((x) => x.campaign_id === campaignId && x.contact_id === contactId);
  const ae = s.users.find((u) => u.id === c.owner_id)!;
  const who = `${c.first_name} ${c.last_name} (${s.accounts.find((a) => a.id === c.account_id)!.name})`;
  return { s, c, brief, o, ae: `${ae.first_name} ${ae.last_name}`, who, event: s.campaigns.find((x) => x.id === campaignId)!.name };
}

export async function startSequence(campaignId: string, contactId: string) {
  const { s, c, brief, who, event } = await context(campaignId, contactId);
  const first = brief.sequence[0];
  if (!first) return "This event has no sequence yet: add steps on the Brief.";
  return write(async (db) => {
    ok(await db.from("outreach").upsert({ campaign_id: campaignId, contact_id: contactId, started_at: new Date().toISOString(), sent: [], outcome: null, outcome_at: null }));
    // Step 1 is due now: its card, with the drafted copy and Mark Sent / Edit buttons, goes to its sender.
    const card = stepCard(s, campaignId, c, 0);
    await notify(db, { campaign_id: campaignId, contact_id: contactId, recipient: card.recipient, kind: "Started", text: `${event} outreach to ${who} has started. ${card.text}` }, card.blocks);
  });
}

export async function markSent(campaignId: string, contactId: string, step: number) {
  return recordSent(campaignId, contactId, step);
}

const NEXT: Record<string, string> = {
  Replied: "replied. Answer within a day, and stop the remaining steps.",
  Accepted: "accepted. Confirm the seat and logistics, and update the Salesforce campaign member.",
  Declined: "declined. Consider inviting a backup from the same account.",
};

// null clears the outcome (resumes a paused sequence).
export async function setOutcome(campaignId: string, contactId: string, outcome: Outreach["outcome"]) {
  const { ae, who, event } = await context(campaignId, contactId);
  return write(async (db) => {
    ok(await db.from("outreach").update({ outcome, outcome_at: outcome && new Date().toISOString() }).eq("campaign_id", campaignId).eq("contact_id", contactId));
    if (outcome && NEXT[outcome]) await notify(db, { campaign_id: campaignId, contact_id: contactId, recipient: ae, kind: outcome, text: `${who} ${NEXT[outcome]} (${event})` });
  });
}

export async function savePersonalLine(campaignId: string, contactId: string, line: string) {
  return write(async (db) => ok(await db.from("outreach").upsert({ campaign_id: campaignId, contact_id: contactId, personal_line: line.trim() || null })));
}
