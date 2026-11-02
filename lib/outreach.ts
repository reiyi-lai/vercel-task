import { loadSnapshot, type Contact, type SequenceStep, type Snapshot } from "./data";
import { eventOverview } from "./derive";
import { gmailDraft, render, schedule, type StepStatus } from "./sequence";
import { notify, quote, type Block } from "./slack";
import { expireFromRoute, ok, write } from "./write";

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

// Who sends a step: the AE is the account's owner (its contacts share it); the BDR is the one assigned to this candidate
// for the event. Undefined until they're assigned on the Candidates page.
export function sender(s: Snapshot, campaignId: string, step: SequenceStep, c: Contact) {
  const id = step.sender === "AE" ? c.owner_id : s.invitation_selections.find((x) => x.campaign_id === campaignId && x.contact_id === c.id)?.bdr_id;
  return s.users.find((u) => u.id === id);
}

// The values a step's template fills for one candidate.
export function messageVars(s: Snapshot, campaignId: string, c: Contact, step: SequenceStep) {
  const event = eventOverview(s, s.events.find((e) => e.campaign_id === campaignId)!.slug)!.event;
  const o = s.outreach.find((x) => x.campaign_id === campaignId && x.contact_id === c.id);
  return {
    first_name: c.first_name,
    account: s.accounts.find((a) => a.id === c.account_id)!.name,
    event: event.name,
    date: event.date,
    personal_line: o?.personal_line ?? "", // the line is optional: render drops it, and its blank line, when empty
    sender_first_name: sender(s, campaignId, step, c)?.first_name ?? "{sender_first_name}",
    ae_first_name: s.users.find((u) => u.id === c.owner_id)?.first_name ?? "{ae_first_name}",
  };
}

// A step's message for one candidate: the edit saved for it, or else the event's template filled in.
export function draftCopy(s: Snapshot, campaignId: string, c: Contact, index: number) {
  const edited = s.outreach.find((x) => x.campaign_id === campaignId && x.contact_id === c.id)?.drafts?.[index];
  if (edited) return edited;
  const step = s.event_briefs.find((b) => b.campaign_id === campaignId)!.sequence[index];
  const vars = messageVars(s, campaignId, c, step);
  return { subject: render(step.subject, vars), body: render(step.body, vars) };
}

// Records a step as sent, with the copy that actually went out: the drafted copy unless the sender edited it.
// by: who marked it, when it came from Slack.
export async function recordSent(campaignId: string, contactId: string, index: number, copy?: { subject: string; body: string }, by?: string, expire?: () => void) {
  const s = await loadSnapshot();
  const o = s.outreach.find((x) => x.campaign_id === campaignId && x.contact_id === contactId);
  if (!o?.started_at) return "Start the sequence first.";
  const c = s.contacts.find((x) => x.id === contactId)!;
  const entry = { step: index, at: new Date().toISOString(), ...(copy ?? draftCopy(s, campaignId, c, index)), ...(by && { by }) };
  return write(
    async (db) => ok(await db.from("outreach").update({ sent: [...o.sent.filter((x) => x.step !== index), entry] }).eq("campaign_id", campaignId).eq("contact_id", contactId)),
    expire
  );
}

const siteUrl = () =>
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100");

// The Slack card for a step that's due: who it's for, the drafted copy, and buttons to mark it sent as drafted, open a
// Gmail draft of it (email steps, when the link fits Slack's 3,000-character limit), or edit it in Seatbook, which opens
// that step on the invitation page. Mark Sent carries "campaignId|contactId|step".
export function stepCard(s: Snapshot, campaignId: string, c: Contact, index: number, overdue = false) {
  const step = s.event_briefs.find((b) => b.campaign_id === campaignId)!.sequence[index];
  const by = sender(s, campaignId, step, c)!; // cards are only sent for started sequences, whose senders are assigned
  const account = s.accounts.find((a) => a.id === c.account_id)!.name;
  const event = s.campaigns.find((x) => x.id === campaignId)!.name;
  const slug = s.events.find((e) => e.campaign_id === campaignId)!.slug;
  const value = `${campaignId}|${c.id}|${index}`;
  const copy = draftCopy(s, campaignId, c, index);
  const gmail = step.channel === "Email" ? gmailDraft(c.email, copy.subject, copy.body) : null;
  const text = `Step ${index + 1} (${step.channel}) to ${fullName(c)}, ${c.title} at ${account}, is ${overdue ? "overdue" : "due today"} · ${event}`;
  const blocks: Block[] = [
    { type: "section", text: { type: "mrkdwn", text: `*For ${fullName(by)}:* ${text}` } },
    { type: "section", text: { type: "mrkdwn", text: quote(copy) } },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Mark Sent" }, action_id: "mark_sent", value },
        ...(gmail && gmail.length <= 3000 ? [{ type: "button", text: { type: "plain_text", text: "Open in Gmail" }, action_id: "gmail", url: gmail }] : []),
        { type: "button", text: { type: "plain_text", text: "Edit in Seatbook" }, action_id: "edit", url: `${siteUrl()}/events/${slug}/candidates/${c.id}#step-${index + 1}` },
      ],
    },
  ];
  return { recipient: fullName(by), text, blocks };
}

// What the card becomes once the step is marked sent: the copy that went out, and by whom.
export function sentCard(s: Snapshot, campaignId: string, c: Contact, index: number, copy: { subject: string; body: string }, by: string): Block[] {
  const account = s.accounts.find((a) => a.id === c.account_id)!.name;
  return [
    { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Step ${index + 1} to ${fullName(c)} (${account}) sent* by ${by}` } },
    { type: "section", text: { type: "mrkdwn", text: quote(copy) } },
  ];
}

// A Slack card for each unsent step in the event with one of these statuses, to its sender: due or overdue on demand
// and at 9am, due today at 4pm.
export async function sendReminders(campaignId: string, statuses: StepStatus[] = ["Due", "Overdue"]) {
  const s = await loadSnapshot();
  const brief = s.event_briefs.find((b) => b.campaign_id === campaignId);
  if (!brief) return { error: "No such event." };
  const due = s.outreach
    .filter((o) => o.campaign_id === campaignId)
    .flatMap((o) => schedule(brief.sequence, o).filter((x) => x.status && statuses.includes(x.status)).map((x) => ({ o, x })));
  const error = await write(async (db) => {
    for (const { o, x } of due) {
      const card = stepCard(s, campaignId, s.contacts.find((c) => c.id === o.contact_id)!, x.index, x.status === "Overdue");
      await notify(db, { campaign_id: campaignId, contact_id: o.contact_id, recipient: card.recipient, kind: "Due", text: card.text }, card.blocks);
    }
  }, expireFromRoute);
  return { error, sent: due.length };
}
