import type { Candidate, EventBrief, SequenceStep, Snapshot } from "./data";
import { TIMEZONE } from "./rules";

// Fills a step's template. Unknown placeholders stay visible, so a typo in a template shows up in the preview. An empty
// value on its own line leaves no gap: runs of blank lines collapse to one.
export const render = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m).replace(/\n{3,}/g, "\n\n");

export const PLACEHOLDERS = ["first_name", "account", "event", "date", "sender_name", "ae_first_name"];

// A new Gmail draft with a step's copy filled in, in whichever Google account the sender is signed into.
// Spaces as %20, not "+", which Gmail can show literally.
export const gmailDraft = (to: string | null, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1${to ? `&to=${encodeURIComponent(to)}` : ""}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const DAY = 86_400_000;
// The calendar day a moment falls on in the business time zone, as a day count, so "today" means the team's today.
const dayOf = (d: Date) => Date.parse(d.toLocaleDateString("en-CA", { timeZone: TIMEZONE })) / DAY;
// Calendar days from today until a date ("2026-11-19"), counted in the business time zone; negative once it's past.
export const daysUntil = (date: string, now = new Date()) => Date.parse(date) / DAY - dayOf(now);
// Outreach (outreach.ai) sends the steps: automatic ones itself, manual ones from the rep's task list, and reports back
// what's sent. In production, links go to the prospect's task by its Outreach ID; there's no Outreach connection yet.
export const OUTREACH_URL = "https://web.outreach.io";

export const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TIMEZONE });
export type StepStatus = "Sent" | "Due" | "Overdue" | "Upcoming" | "Stopped";

// Each step's due date and status for one candidate. A step is due on its day after the sequence starts and overdue the
// day after, by calendar day in the business time zone. Steps stop once the candidate replies, accepts, declines or is
// paused.
export function schedule(steps: SequenceStep[], o: Candidate | undefined, now = new Date()) {
  const today = dayOf(now);
  return steps.map((step, i) => {
    const sent = o?.sent.find((x) => x.step === i);
    const due = o?.started_at ? new Date(Date.parse(o.started_at) + step.day * DAY) : null;
    const status: StepStatus | null =
      sent ? "Sent"
      : !due ? null
      : o?.outcome ? "Stopped"
      : dayOf(due) < today ? "Overdue"
      : dayOf(due) === today ? "Due"
      : "Upcoming";
    return { step, index: i, due, sent: sent ? new Date(sent.at) : null, status };
  });
}

// Where a candidate is, stage by stage: waiting for marketing's approval, approved and waiting for their AE or BDR to
// push them to Outreach, in the sequence (paused included), then how they responded. The Invites page's tabs.
export const STAGES = [
  { key: "approval", label: "Pending Approval", color: "hollow" },
  { key: "push", label: "Pending Push to Outreach", color: "gray" },
  { key: "sequence", label: "In Sequence", color: "blue" },
  { key: "replied", label: "Replied", color: "amber" },
  { key: "accepted", label: "Accepted", color: "green" },
  { key: "declined", label: "Declined", color: "red" },
] as const;
export type Stage = (typeof STAGES)[number]["key"];
export function stageOf(o: Candidate): Stage {
  if (!o.approved_at) return "approval";
  if (!o.started_at) return "push";
  return o.outcome === "Replied" ? "replied" : o.outcome === "Accepted" ? "accepted" : o.outcome === "Declined" ? "declined" : "sequence";
}

// An approved candidate's deadline to be pushed to Outreach: the day after marketing approves them, by calendar day in the
// business time zone; overdue from the day after that. null once pushed, or before approval. The follow-up steps still
// count from the push, so a late push doesn't squeeze them together.
export function pushDeadline(o: Candidate, now = new Date()) {
  if (!o.approved_at || o.started_at) return null;
  const due = new Date(Date.parse(o.approved_at) + DAY);
  const left = dayOf(due) - dayOf(now);
  return {
    due, overdue: left < 0,
    text: left < 0 ? `Push overdue since ${shortDate(due)}` : left === 0 ? "Push by today" : `Push by ${shortDate(due)}`,
    color: left < 0 ? ("red" as const) : left === 0 ? ("amber" as const) : ("gray" as const),
  };
}

// One line for the Invites page: where this candidate's outreach stands.
export function progress(steps: SequenceStep[], o: Candidate | undefined, now = new Date()) {
  if (!o?.started_at) return { text: "Not started", color: "gray" as const };
  if (o.outcome) return { text: o.outcome, color: o.outcome === "Accepted" ? ("green" as const) : o.outcome === "Declined" ? ("red" as const) : ("blue" as const) };
  const next = schedule(steps, o, now).find((x) => x.status !== "Sent");
  if (!next) return { text: `All ${steps.length} steps sent`, color: "blue" as const };
  const when = shortDate(next.due!);
  return {
    text: `Step ${next.index + 1} of ${steps.length} · ${next.status === "Overdue" ? `overdue since ${when}` : next.status === "Due" ? "due today" : `due ${when}`}`,
    color: next.status === "Overdue" ? ("red" as const) : next.status === "Due" ? ("amber" as const) : ("gray" as const),
  };
}

// Where an event stands against its brief. Invites sent: candidates whose first step went out. Accepted: confirmed in
// Salesforce, or marked Accepted in Seatbook. Awaiting: invited, no response yet.
export function eventProgress(s: Snapshot, b: EventBrief, now = new Date()) {
  const outreach = s.candidates.filter((o) => o.campaign_id === b.campaign_id);
  const invited = outreach.filter((o) => o.sent.some((x) => x.step === 0));
  const confirmed = s.campaign_members.filter((m) => m.campaign_id === b.campaign_id && m.invite_status === "Confirmed").map((m) => m.contact_id);
  const outcome = (kind: Candidate["outcome"]) => outreach.filter((o) => o.outcome === kind);
  return {
    shortlisted: s.candidates.filter((x) => x.campaign_id === b.campaign_id).length,
    invited: invited.length,
    accepted: new Set([...confirmed, ...outcome("Accepted").map((o) => o.contact_id)]).size,
    confirmedInSalesforce: confirmed.length,
    awaiting: invited.filter((o) => !o.outcome).length,
    replied: outcome("Replied").length,
    declined: outcome("Declined").length,
    overdue: outreach.flatMap((o) => schedule(b.sequence, o, now)).filter((x) => x.status === "Overdue").length,
    pushOverdue: outreach.filter((o) => pushDeadline(o, now)?.overdue).length,
  };
}
