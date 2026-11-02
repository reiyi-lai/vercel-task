import { daysUntil, progress } from "./sequence";
import type { Activity, Contact, Snapshot } from "./data";
import { AS_OF } from "./rules";

type Evidence = { text: string; source: string };

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;
// An event's dates: "Nov 19, 2026", or a range, "Nov 19–21, 2026" or "Nov 30 – Dec 2, 2026".
export function formatDates(start: string, end: string | null) {
  if (!end || end === start) return formatDate(start);
  const [a, b] = [new Date(start), new Date(end)];
  const md = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${formatDate(start)} – ${formatDate(end)}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${md(a)} – ${md(b)}, ${b.getUTCFullYear()}`;
  return `${md(a)}–${b.getUTCDate()}, ${b.getUTCFullYear()}`;
}
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Summarises Salesforce activity (Tasks and Events): meetings, replies and outbound emails, with the latest date.
function activity(list: Activity[]) {
  const meetings = list.filter((e) => e.subtype !== "Email").length;
  const replies = list.filter((e) => e.direction === "Inbound").length;
  const outbound = list.length - meetings - replies;
  const last = list.map((e) => e.occurred_at).sort().at(-1)!;
  const parts = [meetings && plural(meetings, "meeting"), replies && plural(replies, "email reply", "email replies"), outbound && plural(outbound, "outbound email")];
  const source = `Salesforce (${[...new Set(list.map((e) => e.source))].join(", ")})`;
  return { text: `Salesforce (latest ${new Date(last).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" })}): ${parts.filter(Boolean).join(", ")}`, source };
}

// The opportunity roles a contact has played (e.g. Champion), with each opportunity.
const opportunityRoles = (s: Snapshot, contactId: string) =>
  s.opportunity_contact_roles.filter((r) => r.contact_id === contactId).map((r) => ({ role: r.role, opp: s.opportunities.find((o) => o.id === r.opportunity_id)! }));

export function lookups(s: Snapshot) {
  const user = new Map(s.users.map((u) => [u.id, u]));
  const contact = new Map(s.contacts.map((c) => [c.id, c]));
  const account = new Map(s.accounts.map((a) => [a.id, a]));
  return { user, contact, account };
}

// Past Account Interactions: others at the target's account whom Vercel has emailed, met or had on an opportunity.
// Context for the AE's invite.
export function accountInteractions(s: Snapshot, target: Contact) {
  return s.contacts.filter((k) => k.account_id === target.account_id && k.id !== target.id).flatMap((k) => {
    const acts = s.activities.filter((e) => e.contact_id === k.id);
    const roles = opportunityRoles(s, k.id);
    if (!acts.length && !roles.length) return [];
    const lines: Evidence[] = roles.map((r) => ({ text: `${r.role} on “${r.opp.name}” · ${r.opp.stage}`, source: "Salesforce opportunities" }));
    if (acts.length) {
      const { text, source } = activity(acts);
      lines.unshift({ text, source });
    }
    return [{ contact: k, name: fullName(k), status: k.employment_status === "Former" ? ("Former" as const) : ("Current" as const), lines }];
  });
}

// An account's Vercel teams with their key contacts, highest spend first.
export function vercelUsage(s: Snapshot, accountId: string) {
  const teams = s.vercel_teams.filter((t) => t.account_id === accountId).sort((a, b) => (b.monthly_spend ?? 0) - (a.monthly_spend ?? 0));
  const sum = (key: "active_users_30d" | "monthly_spend") => teams.reduce((n, t) => n + (t[key] ?? 0), 0);
  return { teams, activeUsers: sum("active_users_30d"), monthlySpend: sum("monthly_spend") };
}

// Every event with its start date and days until it: upcoming first, soonest at the top; past events after, most
// recent first. The order of All Events and the sidebar.
export function eventsByDate(s: Snapshot, now = new Date()) {
  return s.events
    .map((e) => {
      const start = s.campaigns.find((c) => c.id === e.campaign_id)!.start_date!;
      return { e, start, days: daysUntil(start, now) };
    })
    .sort((a, b) => Number(a.days < 0) - Number(b.days < 0) || (a.days < 0 ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
}

// An event's details for its header. Kept apart from the pipeline, which depends on today's date, so pages without it
// can prerender.
export function eventDetails(s: Snapshot, slug: string) {
  const user = new Map(s.users.map((u) => [u.id, u]));
  const ev = s.events.find((e) => e.slug === slug);
  if (!ev) return null;
  const campaign = s.campaigns.find((c) => c.id === ev.campaign_id)!;
  return {
    ...ev,
    name: campaign.name,
    date: formatDates(campaign.start_date!, campaign.end_date),
    daysOut: Math.round((Date.parse(campaign.start_date!) - AS_OF.getTime()) / 86_400_000),
    hosts: ev.host_user_ids.map((id) => `${fullName(user.get(id)!)} (${user.get(id)!.title})`).join(", "),
  };
}

// Event overview: the event's details and the invitation pipeline, built from the executives selected on its account
// plans and where their outreach stands.
export function eventOverview(s: Snapshot, slug: string) {
  const { user, contact, account } = lookups(s);
  const ev = eventDetails(s, slug);
  if (!ev) return null;
  const brief = s.events.find((b) => b.campaign_id === ev.campaign_id);
  const sequence = brief?.sequence ?? [];
  const cards = s.candidates
    .filter((x) => x.campaign_id === ev.campaign_id)
    .map(({ contact_id: id, bdr_id }) => {
      const k = contact.get(id)!;
      const a = account.get(k.account_id!)!;
      const o = s.candidates.find((x) => x.campaign_id === ev.campaign_id && x.contact_id === id);
      return {
        id, name: fullName(k), title: k.title ?? "", company: a.name, vertical: a.vertical ?? "Other", horizontals: a.horizontals,
        // Who runs the outreach: the assigned BDR on a BDR-led event, otherwise the account's AE. null until assigned.
        owner: brief?.outreach_lead === "bdr" ? (bdr_id ? fullName(user.get(bdr_id)!) : null) : k.owner_id ? fullName(user.get(k.owner_id)!) : null, outcome: o?.outcome ?? null, started: !!o?.started_at,
        detail: progress(sequence, o).text, href: `/events/${ev.slug}/candidates/${id}`,
      };
    });
  const responded = (outcome: string) => cards.filter((c) => c.outcome === outcome);

  return {
    event: ev,
    pipeline: [
      { title: "Selected", dot: "gray" as const, cards: cards.filter((c) => !c.started) },
      { title: "In Sequence", dot: "blue" as const, cards: cards.filter((c) => c.started && (!c.outcome || c.outcome === "Paused")) },
      { title: "Replied", dot: "amber" as const, cards: responded("Replied") },
      { title: "Accepted", dot: "green" as const, cards: responded("Accepted") },
      { title: "Declined", dot: "red" as const, cards: responded("Declined") },
    ],
  };
}
