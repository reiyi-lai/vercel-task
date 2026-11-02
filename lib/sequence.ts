import type { Outreach, SequenceStep } from "./data";
import { TIMEZONE } from "./rules";

// Fills a step's template. Unknown placeholders stay visible, so a typo in a template shows up in the preview.
export const render = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

export const PLACEHOLDERS = ["first_name", "account", "event", "date", "personal_line", "sender_first_name", "ae_first_name"];

// A new Gmail draft with a step's copy filled in, in whichever Google account the sender is signed into.
// Spaces as %20, not "+", which Gmail can show literally.
export const gmailDraft = (to: string | null, subject: string, body: string) =>
  `https://mail.google.com/mail/?view=cm&fs=1${to ? `&to=${encodeURIComponent(to)}` : ""}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const DAY = 86_400_000;
// The calendar day a moment falls on in the business time zone, as a day count, so "today" means the team's today.
const dayOf = (d: Date) => Date.parse(d.toLocaleDateString("en-CA", { timeZone: TIMEZONE })) / DAY;
export const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TIMEZONE });
export type StepStatus = "Sent" | "Due" | "Overdue" | "Upcoming" | "Stopped";

// Each step's due date and status for one candidate. A step is due on its day after the sequence starts and overdue the
// day after, by calendar day in the business time zone. Steps stop once the candidate replies, accepts, declines or is
// paused.
export function schedule(steps: SequenceStep[], o: Outreach | undefined, now = new Date()) {
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

// One line for the Candidates page: where this candidate's outreach stands.
export function progress(steps: SequenceStep[], o: Outreach | undefined, now = new Date()) {
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
