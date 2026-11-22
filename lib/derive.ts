import { daysUntil, STAGES, stageOf } from "./sequence";
import type { Snapshot } from "./data";
import { AS_OF } from "./rules";

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

// An event's details for its header.
export function eventDetails(s: Snapshot, slug: string) {
  const ev = s.events.find((e) => e.slug === slug);
  if (!ev) return null;
  const campaign = s.campaigns.find((c) => c.id === ev.campaign_id)!;
  return {
    ...ev,
    name: campaign.name,
    date: formatDates(campaign.start_date!, campaign.end_date),
    daysOut: Math.round((Date.parse(campaign.start_date!) - AS_OF.getTime()) / 86_400_000)
  };
}

// Event overview: the event's details and how many candidates are at each stage.
export function eventOverview(s: Snapshot, slug: string) {
  const ev = eventDetails(s, slug);
  if (!ev) return null;
  const candidates = s.candidates.filter((x) => x.campaign_id === ev.campaign_id);
  return { event: ev, stages: STAGES.map((st) => ({ ...st, count: candidates.filter((x) => stageOf(x) === st.key).length })) };
}
