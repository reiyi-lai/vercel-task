import { loadSnapshot, TABLES, type Candidate, type Contact, type EventBrief, type SequenceStep, type Snapshot } from "./data";
import { sentByBdr } from "./brief";
import { eventOverview, eventsByDate } from "./derive";
import { eventAccounts } from "./qualify";
import { gmailDraft, pushDeadline, render, schedule, shortDate } from "./sequence";
import { notify, quote, type Block } from "./slack";
import { expireFromRoute, ok, write } from "./write";

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

// Who handles a step in Seatbook (drafts it, gets its Slack card, marks it sent): the AE is the account's owner (its
// contacts share it), or a BDR on AE steps when it has none; the BDR is the one assigned to this candidate for the event. Exec steps are the AE's too, signed
// off and sent by the exec (execName). Undefined until they're assigned on the Invites page.
export function sender(s: Snapshot, campaignId: string, step: SequenceStep, c: Contact) {
  const bdr = () => s.candidates.find((x) => x.campaign_id === campaignId && x.contact_id === c.id)?.bdr_id;
  const id = step.sender === "BDR" ? bdr() : step.sender === "AE" ? c.owner_id ?? bdr() : c.owner_id;
  return s.users.find((u) => u.id === id);
}

// A candidate's row under Candidates to Send Invites on the AE/BDR page, for links straight to it.
export const sendAnchor = (campaignId: string, contactId: string) => `send-${campaignId}-${contactId}`;

// The exec who signs off and sends a candidate's Exec steps: their own, typed on the Invites page, or else the event's,
// set on the brief.
export const execName = (s: Snapshot, campaignId: string, c: Contact) =>
  s.candidates.find((x) => x.campaign_id === campaignId && x.contact_id === c.id)?.exec_name ||
  s.events.find((e) => e.campaign_id === campaignId)?.exec_name ||
  null;

// The values a step's template fills for one candidate.
export function messageVars(s: Snapshot, campaignId: string, c: Contact, step: SequenceStep) {
  const by = sender(s, campaignId, step, c);
  const event = eventOverview(s, s.events.find((e) => e.campaign_id === campaignId)!.slug)!.event;
  return {
    first_name: c.first_name,
    account: s.accounts.find((a) => a.id === c.account_id)!.name,
    event: event.name,
    date: event.date,
    sender_name: (step.sender === "Exec" ? execName(s, campaignId, c) : by && fullName(by)) ?? "{sender_name}",
    ae_first_name: s.users.find((u) => u.id === c.owner_id)?.first_name ?? "{ae_first_name}",
  };
}

// A step's message for one candidate: the edit saved for it, or else the event's template filled in.
export function draftCopy(s: Snapshot, campaignId: string, c: Contact, index: number) {
  const edited = s.candidates.find((x) => x.campaign_id === campaignId && x.contact_id === c.id)?.drafts?.[index];
  if (edited) return edited;
  const step = s.events.find((b) => b.campaign_id === campaignId)!.sequence[index];
  const vars = messageVars(s, campaignId, c, step);
  return { subject: render(step.subject, vars), body: render(step.body, vars) };
}

// A candidate's sequence for the invitation plan: each step's copy (what went out once sent; before that, the saved edit
// or the template filled in), sender, due date and status.
export function stepViews(s: Snapshot, event: EventBrief, target: Contact, outreach: Candidate | undefined) {
  const day = (d: Date | null) => d && shortDate(d);
  return schedule(event.sequence, outreach).map(({ step, index, due, sent, status }) => {
    const by = sender(s, event.campaign_id, step, target);
    const done = outreach?.sent.find((x) => x.step === index);
    const copy = done?.body ? { subject: done.subject ?? "", body: done.body } : draftCopy(s, event.campaign_id, target, index);
    return {
      index, day: step.day, channel: step.channel, ...copy,
      sender: step.sender === "Exec"
        ? `${execName(s, event.campaign_id, target) ?? "Exec unassigned"} (draft by ${by ? by.first_name : "AE"})`
        : by ? `${by.first_name} ${by.last_name}` : `${step.sender} unassigned`,
      edited: !done && !!outreach?.drafts?.[index],
      status, due: day(due), sent: day(sent) && `${day(sent)}${done?.by ? ` by ${done.by} in Slack` : ""}`,
    };
  });
}

// Records a step as sent, with the copy that actually went out: the drafted copy unless the sender edited it.
// by: who marked it, when it came from Slack.
export async function recordSent(campaignId: string, contactId: string, index: number, copy?: { subject: string; body: string }, by?: string, expire?: () => void) {
  const s = await loadSnapshot();
  const o = s.candidates.find((x) => x.campaign_id === campaignId && x.contact_id === contactId);
  if (!o?.started_at) return "Start the sequence first.";
  const c = s.contacts.find((x) => x.id === contactId)!;
  const entry = { step: index, at: new Date().toISOString(), ...(copy ?? draftCopy(s, campaignId, c, index)), ...(by && { by }) };
  return write(
    async (db) => ok(await db.from(TABLES.candidates).update({ sent: [...o.sent.filter((x) => x.step !== index), entry] }).eq("campaign_id", campaignId).eq("contact_id", contactId)),
    expire
  );
}

const siteUrl = () =>
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100");

// The Slack card for a step that's due: who it's for, the drafted copy, and buttons to mark it sent as drafted, open a
// Gmail draft of it (email steps, when the link fits Slack's 3,000-character limit), or edit it in Seatbook, which opens
// that step on the candidate's invitation plan. Mark Sent carries "campaignId|contactId|step".
export function stepCard(s: Snapshot, campaignId: string, c: Contact, index: number, overdue = false) {
  const step = s.events.find((b) => b.campaign_id === campaignId)!.sequence[index];
  const by = sender(s, campaignId, step, c)!; // cards are only sent for started sequences, whose senders are assigned
  const account = s.accounts.find((a) => a.id === c.account_id)!.name;
  const event = s.campaigns.find((x) => x.id === campaignId)!.name;
  const slug = s.events.find((e) => e.campaign_id === campaignId)!.slug;
  const value = `${campaignId}|${c.id}|${index}`;
  const copy = draftCopy(s, campaignId, c, index);
  const gmail = step.channel === "Email" ? gmailDraft(c.email, copy.subject, copy.body) : null;
  const exec = step.sender === "Exec" && ` Get ${execName(s, campaignId, c)}’s sign-off; it goes from their email.`;
  const text = `Step ${index + 1} (${step.channel}) to ${fullName(c)}, ${c.title} at ${account}, is ${overdue ? "overdue" : "due today"} · ${event}.${exec || ""}`;
  const blocks: Block[] = [
    { type: "section", text: { type: "mrkdwn", text: `*For ${fullName(by)}:* ${text}` } },
    { type: "section", text: { type: "mrkdwn", text: quote(copy) } },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Mark Sent" }, action_id: "mark_sent", value },
        ...(gmail && gmail.length <= 3000 ? [{ type: "button", text: { type: "plain_text", text: "Open in Gmail" }, action_id: "gmail", url: gmail }] : []),
        { type: "button", text: { type: "plain_text", text: "Edit in Seatbook" }, action_id: "edit", url: `${siteUrl()}/events/${slug}/invites/${c.id}#step-${index + 1}` },
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

// A Slack card to its sender for each unsent step in the event that's due or overdue, and for each approved candidate
// not pushed to Outreach by their deadline (Vercel Cron, daily at 9am).
export async function sendReminders(campaignId: string) {
  const s = await loadSnapshot();
  const brief = s.events.find((b) => b.campaign_id === campaignId);
  if (!brief) return { error: "No such event." };
  const due = s.candidates
    .filter((o) => o.campaign_id === campaignId)
    .flatMap((o) => schedule(brief.sequence, o).filter((x) => x.status === "Due" || x.status === "Overdue").map((x) => ({ o, x })));
  const unpushed = s.candidates.filter((o) => o.campaign_id === campaignId && pushDeadline(o)?.overdue);
  const event = s.campaigns.find((x) => x.id === campaignId)!.name;
  const error = await write(async (db) => {
    for (const { o, x } of due) {
      const card = stepCard(s, campaignId, s.contacts.find((c) => c.id === o.contact_id)!, x.index, x.status === "Overdue");
      await notify(db, { campaign_id: campaignId, contact_id: o.contact_id, recipient: card.recipient, kind: "Due", text: card.text }, card.blocks);
    }
    for (const o of unpushed) {
      const c = s.contacts.find((k) => k.id === o.contact_id)!;
      const by = brief.sequence[0] && sender(s, campaignId, brief.sequence[0], c);
      const account = s.accounts.find((a) => a.id === c.account_id)!.name;
      const text = `Push ${fullName(c)} (${account}) to Outreach · ${event}. Approved ${shortDate(new Date(o.approved_at!))}, ${pushDeadline(o)!.text.toLowerCase()}.`;
      await notify(db, { campaign_id: campaignId, contact_id: c.id, recipient: by ? fullName(by) : "Unassigned BDR", kind: "Push Overdue", text }, [
        { type: "section", text: { type: "mrkdwn", text: `*For ${by ? fullName(by) : "Unassigned BDR"}:* ${text}` } },
        { type: "actions", elements: [{ type: "button", style: "primary", text: { type: "plain_text", text: "Open in Seatbook" }, action_id: "edit", url: `${siteUrl()}/events/${brief.slug}/invites/${c.id}` }] },
      ]);
    }
  }, expireFromRoute);
  return { error, sent: due.length + unpushed.length };
}

// One AE's or BDR's queue across every event: the steps they send that are due or overdue (overdue first), replies on
// their candidates to answer, and the accounts in upcoming events they've yet to select anyone at. "Their" candidates:
// the AE owns the contact, or the BDR is assigned for the event. "Their" accounts: the AE owns the account, unless a BDR
// sends its outreach (then every BDR sees it).
export function myQueue(s: Snapshot, userId: string, now = new Date()) {
  const rows = s.events.flatMap((e) =>
    s.candidates.filter((x) => x.campaign_id === e.campaign_id).map((x) => {
      const c = s.contacts.find((k) => k.id === x.contact_id)!;
      return { e, x, c, account: s.accounts.find((a) => a.id === c.account_id)!.name, mine: c.owner_id === userId || x.bdr_id === userId };
    })
  );
  const due = rows
    .filter(({ x }) => x.started_at && !x.outcome)
    // One row per candidate: their earliest step that's due, and how many more are due behind it.
    .flatMap((r) => {
      const [st, ...rest] = schedule(r.e.sequence, r.x, now).filter((st) => (st.status === "Due" || st.status === "Overdue") && sender(s, r.e.campaign_id, st.step, r.c)?.id === userId);
      return st ? [{ ...r, step: st, more: rest.length }] : [];
    })
    .sort((a, b) => Number(b.step.status === "Overdue") - Number(a.step.status === "Overdue") || a.step.due!.getTime() - b.step.due!.getTime());
  const isBdr = s.users.find((u) => u.id === userId)?.title === "BDR";
  const byDate = eventsByDate(s, now);
  const upcoming = byDate.filter((x) => x.days >= 0).map((x) => x.e);
  // Selected for an upcoming event with the sequence not started, where this user sends the first step: approved by
  // marketing first, soonest push deadline (overdue) first, then those still waiting for approval.
  const toStart = rows
    .filter(({ e, x, c }) => !x.started_at && !x.outcome && upcoming.includes(e) && e.sequence.length && sender(s, e.campaign_id, e.sequence[0], c)?.id === userId)
    .map((r) => ({ ...r, deadline: pushDeadline(r.x, now) }))
    .sort((a, b) => Number(!a.deadline) - Number(!b.deadline) || (a.deadline?.due.getTime() ?? 0) - (b.deadline?.due.getTime() ?? 0));
  const myAccounts = (e: (typeof s.events)[number]) =>
    eventAccounts(s, e).fits.filter((p) => (sentByBdr(e.outreach_lead, p.account.owner_id) ? isBdr : p.account.owner_id === userId));
  const toSelect = upcoming
    .map((e) => ({ e, accounts: myAccounts(e).filter((p) => !p.executives.some((x) => x.selected)) }))
    .filter((x) => x.accounts.length);
  return { due, replies: rows.filter((r) => r.mine && r.x.outcome === "Replied"), toSelect, toStart };
}
