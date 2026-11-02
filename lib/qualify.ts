import { CITIES, SENIORITY, relevantTheme } from "./brief";
import type { Account, AccountSignal, Contact, EventBrief, Snapshot } from "./data";
import type { DotColor } from "@/components/ui";
import { AS_OF } from "./rules";

// Qualification, not scoring: an account either fits the event's brief or it doesn't (with the reason), and each
// executive gets labels a BDR can read at a glance. The BDR chooses who to invite.

export type Label = { text: string; color: DotColor };
export type Qualified = { contact: Contact; status: "Qualified" | "Review" | "Excluded"; persona?: string; labels: Label[] };

// Why an account falls outside the brief, or null when it fits. An account with no industry tag counts as cross-industry.
export function accountGate(a: Account, b: EventBrief): string | null {
  if (a.vertical && !b.verticals.includes("Cross-industry") && !b.verticals.includes(a.vertical)) return `${a.vertical} isn't a target vertical`;
  if (b.segment !== "both" && a.segment?.toLowerCase() !== b.segment) return `${a.segment} segment`;
  if (b.tier_mode === "only" && !b.tiers.includes(a.icp_tier ?? "")) return `${a.icp_tier} isn't a selected tier`;
  if ((a.employees ?? 0) < 5000) return "Under 5,000 employees";
  return null;
}

// An Enterprise deal makes a customer; self-serve Pro teams alone don't. Customers aren't event prospects.
export const isEnterpriseCustomer = (s: Snapshot, a: Account) =>
  a.type === "Customer" || s.opportunities.some((o) => o.account_id === a.id && o.is_won);

// Commercial context, from Salesforce, Vercel's own usage data, and public evidence of building on Next.js.
export function commercialState(s: Snapshot, a: Account) {
  const open = s.opportunities.find((o) => o.account_id === a.id && !o.is_closed);
  const teams = s.vercel_teams.filter((t) => t.account_id === a.id);
  if (isEnterpriseCustomer(s, a)) return { label: "Enterprise customer", color: "green" as const };
  if (open) return { label: `Open opportunity · ${open.stage}`, color: "blue" as const };
  if (teams.length) return { label: `Self-serve · ${teams.length} Pro ${teams.length === 1 ? "team" : "teams"}`, color: "amber" as const };
  if (a.nextjs_job_posts) return { label: `Builds on Next.js · ${a.nextjs_job_posts} job ${a.nextjs_job_posts === 1 ? "post" : "posts"}`, color: "amber" as const };
  return { label: "No Vercel footprint", color: "gray" as const };
}

const LEVELS: EventBrief["min_seniority"][] = ["director", "vp", "svp", "c_suite"];

export function seniority(title: string): EventBrief["min_seniority"] | null {
  const t = title.toLowerCase();
  if (/\bchief\b|\bc[a-z]{1,2}o\b|\bpresident\b/.test(t)) return "c_suite";
  if (/\b(evp|svp)\b|executive vice president|senior vice president/.test(t)) return "svp";
  if (/\bvp\b|vice president|\bhead of\b/.test(t)) return "vp";
  if (/\bdirector\b/.test(t)) return "director";
  return null;
}

const ACRONYMS: Record<string, string> = {
  cto: "chief technology officer", cio: "chief information officer", ciso: "chief information security officer",
  cdo: "chief digital officer", cmo: "chief marketing officer", ceo: "chief executive officer",
};
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");

// The first persona whose every word is in the title. Acronyms expand both ways, and SVP/EVP count as VP.
export function matchPersona(title: string, personas: string[]) {
  const t = new Set(words(title));
  for (const w of [...t]) {
    if (ACRONYMS[w]) words(ACRONYMS[w]).forEach((x) => t.add(x));
    if (w === "svp" || w === "evp") t.add("vp");
  }
  return personas.find((p) => words(ACRONYMS[p.toLowerCase()] ?? p).every((w) => t.has(w)));
}

const miles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 7918 * Math.asin(Math.sqrt(h)); // Earth's diameter in miles
};

const SIXTY_DAYS = 60 * 86_400_000;

export function qualifyContact(s: Snapshot, c: Contact, b: EventBrief): Qualified {
  const excluded: string[] = [];
  const labels: Label[] = [];
  const level = seniority(c.title ?? "");
  const below = !level || LEVELS.indexOf(level) < LEVELS.indexOf(b.min_seniority);

  if (c.employment_status === "Former") excluded.push("Left the company");
  if (c.has_opted_out_of_email) excluded.push("Opted out of email");
  const member = s.campaign_members.find((m) => m.campaign_id === b.campaign_id && m.contact_id === c.id);
  if (member) excluded.push(`Already on this event · ${member.invite_status}`);
  if (below && b.seniority_mode === "gate") excluded.push(`Below ${SENIORITY[b.min_seniority]}`);

  const persona = matchPersona(c.title ?? "", b.personas);
  labels.push(persona ? { text: `Matches ${persona}`, color: "green" } : { text: "Outside target personas", color: "gray" });
  if (below && b.seniority_mode === "preference") labels.push({ text: `Below ${SENIORITY[b.min_seniority]}`, color: "amber" });

  if (b.geography !== "nationwide") {
    const city = CITIES[b.city!];
    const limit = b.geography === "city" ? 25 : b.radius_miles!;
    if (c.mailing_latitude === null || c.mailing_longitude === null) labels.push({ text: "Location unknown", color: "amber" });
    else {
      const d = Math.round(miles(city, { lat: c.mailing_latitude, lon: c.mailing_longitude }));
      labels.push(d <= limit ? { text: `${c.mailing_city} · ${d} mi`, color: "green" } : { text: `${c.mailing_city} · over ${limit} mi`, color: "amber" });
    }
  }

  for (const r of s.opportunity_contact_roles.filter((r) => r.contact_id === c.id)) {
    const opp = s.opportunities.find((o) => o.id === r.opportunity_id && !o.is_closed);
    if (opp) labels.push({ text: `${r.role} on ${opp.name.split(" — ").pop()}`, color: "blue" });
  }
  for (const m of s.campaign_members.filter((m) => m.contact_id === c.id && m.campaign_id !== b.campaign_id)) {
    const campaign = s.campaigns.find((x) => x.id === m.campaign_id)!;
    const gap = AS_OF.getTime() - Date.parse(campaign.start_date!);
    if (gap >= 0 && gap <= SIXTY_DAYS) labels.push({ text: `Invited to ${campaign.name} in the last 60 days`, color: "amber" });
  }
  if (!c.email) labels.push({ text: "No email · needs enrichment", color: "amber" });

  if (excluded.length) return { contact: c, status: "Excluded", persona, labels: excluded.map((text) => ({ text, color: "red" })) };
  return { contact: c, status: persona && !labels.some((l) => l.color === "amber") ? "Qualified" : "Review", persona, labels };
}

const ORDER: Qualified["status"][] = ["Qualified", "Review", "Excluded"];
// Signals shown per category, in this order: leadership changes, then AI initiatives, then hiring last.
const SHOWN: Record<AccountSignal["category"], number> = { leadership: 4, initiative: 3, hiring: 2 };

// One account in one event: whether it fits the brief, its commercial context, its signals (by category, and within
// each the event's themes first, then newest), its executives (target personas first, then by status) and who has been selected to invite.
export function accountPlan(s: Snapshot, a: Account, b: EventBrief) {
  const signals = s.account_signals
    .filter((x) => x.account_id === a.id)
    .filter((x, i, all) => all.findIndex((y) => y.account_id === a.id && y.source === x.source && y.title === x.title) === i) // no repeats
    .sort((x, y) => Number(relevantTheme(y.theme, b)) - Number(relevantTheme(x.theme, b)) || y.signal_date.localeCompare(x.signal_date));
  const selected = new Set(s.invitation_selections.filter((x) => x.campaign_id === b.campaign_id).map((x) => x.contact_id));
  return {
    account: a,
    excluded: accountGate(a, b),
    state: commercialState(s, a),
    signals: (Object.keys(SHOWN) as AccountSignal["category"][]).flatMap((c) => signals.filter((x) => x.category === c).slice(0, SHOWN[c])),
    executives: s.contacts
      .filter((c) => c.account_id === a.id)
      .map((c) => ({ ...qualifyContact(s, c, b), selected: selected.has(c.id) }))
      .sort((x, y) => Number(!x.persona) - Number(!y.persona) || ORDER.indexOf(x.status) - ORDER.indexOf(y.status)),
  };
}
