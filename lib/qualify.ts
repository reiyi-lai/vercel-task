import { SENIORITY, THEMES, VERTICALS } from "./brief";
import type { Account, Contact, EventBrief, Snapshot } from "./data";
import type { DotColor } from "@/components/ui";
import { AS_OF } from "./rules";

// Qualification, not scoring: an account either fits the event's brief or it doesn't (with the reason), and each
// executive gets labels a BDR can read at a glance. The BDR chooses who to invite.

export type Label = { text: string; color: DotColor; detail?: string }; // detail: shown after the text, in gray
export type Qualified = { contact: Contact; status: "Qualified" | "Excluded"; ranked: boolean; labels: Label[]; engagement: Label[] };

// Why an account falls outside the brief, or null when it fits. An account with no industry tag counts as cross-industry;
// one with no horizontal tag fits only when the brief targets all horizontals.
export function accountGate(a: Account, b: EventBrief): string | null {
  if (a.vertical && !VERTICALS.every((v) => b.verticals.includes(v)) && !b.verticals.includes(a.vertical)) return `${a.vertical} isn't a target vertical`;
  if (!THEMES.every((t) => b.themes.includes(t)) && !b.themes.some((t) => a.horizontals.includes(t))) return `Not tagged ${b.themes.join(" or ")}`;
  if (!b.tiers.includes(a.icp_tier ?? "")) return `${a.icp_tier} isn't a selected tier`;
  if ((a.employees ?? 0) < 5000) return "Under 5,000 employees";
  return null;
}

// An Enterprise deal makes a customer; self-serve Pro teams alone don't. Customers aren't event prospects.
export const isEnterpriseCustomer = (s: Snapshot, a: Account) =>
  a.type === "Customer" || s.opportunities.some((o) => o.account_id === a.id && o.is_won);

// Events aim to generate net-new opportunities, so accounts with an open opportunity are left out.
const openOpportunityGate = (s: Snapshot, a: Account) =>
  s.opportunities.some((o) => o.account_id === a.id && !o.is_closed) ? "Has an open opportunity" : null;

// Commercial context, from Salesforce and Vercel's own usage data.
export function commercialState(s: Snapshot, a: Account) {
  const open = s.opportunities.find((o) => o.account_id === a.id && !o.is_closed);
  const teams = s.vercel_teams.filter((t) => t.account_id === a.id);
  if (isEnterpriseCustomer(s, a)) return { label: "Enterprise customer", color: "green" as const };
  if (open) return { label: `Open opportunity · ${open.stage}`, color: "blue" as const };
  if (teams.length) return { label: `Self-serve · ${teams.length} Pro ${teams.length === 1 ? "team" : "teams"}`, color: "amber" as const };
  return { label: "No Vercel footprint", color: "gray" as const };
}

const LEVELS: EventBrief["min_seniority"][] = ["director", "vp", "svp", "c_suite"];
// C-level: Chief, a C-level acronym, or President on its own (not Vice President).
const C_LEVEL = /\bchief\b|\bc[a-z]{1,2}o\b|(?<!vice[\s-])\bpresident\b/;

export function seniority(title: string): EventBrief["min_seniority"] | null {
  const t = title.toLowerCase();
  if (C_LEVEL.test(t)) return "c_suite";
  if (/\b(evp|svp)\b|executive vice president|senior vice president/.test(t)) return "svp";
  if (/\bvp\b|vice president|\bhead of\b/.test(t)) return "vp";
  if (/\bdirector\b/.test(t)) return "director";
  return null;
}

// The seniority gate: whether a title's level is at or above the brief's minimum.
export function meetsMinimum(title: string, min: EventBrief["min_seniority"]) {
  const level = seniority(title);
  return !!level && LEVELS.indexOf(level) >= LEVELS.indexOf(min);
}

const ACRONYMS: Record<string, string> = {
  cto: "chief technology officer", cio: "chief information officer", ciso: "chief information security officer",
  cdo: "chief digital officer", cmo: "chief marketing officer", ceo: "chief executive officer",
};
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");

// A title's words, with acronyms expanded and SVP/EVP counting as VP.
function titleWords(title: string) {
  const t = new Set(words(title));
  for (const w of [...t]) {
    if (ACRONYMS[w]) words(ACRONYMS[w]).forEach((x) => t.add(x));
    if (w === "svp" || w === "evp") t.add("vp");
  }
  return t;
}

// The first persona whose every word is in the title. Acronyms expand both ways. A security title only matches a
// security persona, so a CISO isn't taken for a CIO.
export function matchPersona(title: string, personas: string[]) {
  const t = titleWords(title);
  return personas.find((p) => {
    const need = words(ACRONYMS[p.toLowerCase()] ?? p);
    return need.every((w) => t.has(w)) && (!t.has("security") || need.includes("security"));
  });
}

// Whether the title sits in technology, engineering, digital or commerce (a CIO's information counts; so does AI).
const DEPARTMENTS = ["technology", "tech", "engineering", "digital", "commerce", "ecommerce", "information", "ai"];
export const inTechDepartment = (title: string) => DEPARTMENTS.some((d) => titleWords(title).has(d));

// Whether the title states a rank at or above the brief's minimum seniority: C-level always; Senior/Executive Vice President from SVP down; Vice President from VP down; Director at Director.
export function holdsRank(title: string, min: EventBrief["min_seniority"]) {
  const t = title.toLowerCase();
  const svp = /\b(svp|evp)\b|(senior|executive) vice president/.test(t);
  const vp = svp || /\bvp\b|vice president/.test(t);
  return C_LEVEL.test(t) || { c_suite: false, svp, vp, director: vp || /\bdirector\b/.test(t) }[min];
}

const DAY = 86_400_000;

// How warm a contact already is, apart from this event, one label per kind: events they attended or were invited to in
// the last year (Salesforce campaigns), email replies and meetings (outbound emails alone don't count), and paying for
// Vercel (the billing owner of a team on the account). None of these means no prior engagement.
export function engagement(s: Snapshot, c: Contact, campaignId: string) {
  const events = s.campaign_members
    .filter((m) => m.contact_id === c.id && m.campaign_id !== campaignId)
    .map((m) => ({ m, campaign: s.campaigns.find((x) => x.id === m.campaign_id)! }))
    .map((x) => ({ ...x, ago: AS_OF.getTime() - Date.parse(x.campaign.start_date!) }))
    .filter((x) => x.ago >= 0 && x.ago <= 365 * DAY);
  const acts = s.activities.filter((a) => a.contact_id === c.id);
  const month = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  // A count of activities and when the latest was, e.g. "2 replies · latest Aug 2026".
  const recency = (list: typeof acts, one: string, many: string) =>
    `${list.length === 1 ? `1 ${one}` : `${list.length} ${many}`} · ${list.length === 1 ? "" : "latest "}${month(list.map((a) => a.occurred_at).sort().at(-1)!)}`;
  // Which events, flagging one in the last 60 days.
  const named = (list: typeof events) => list.length && `${list.map((x) => x.campaign.name).join(", ")}${list.some((x) => x.ago <= 60 * DAY) ? " · last 60 days" : ""}`;
  const replies = acts.filter((a) => a.subtype === "Email" && a.direction === "Inbound");
  const meetings = acts.filter((a) => a.subtype === "Meeting");
  const teams = s.vercel_teams.filter((x) => x.key_contact_id === c.id);
  const kinds: [string, string | 0][] = [
    ["Prior event attendance", named(events.filter((x) => x.m.status === "Attended"))],
    ["Prior event invite", named(events.filter((x) => x.m.status !== "Attended"))],
    ["Prior email reply", replies.length && recency(replies, "reply", "replies")],
    ["Prior meeting", meetings.length && recency(meetings, "meeting", "meetings")],
    ["On Vercel plan", teams.length && teams.map((x) => [x.plan, x.name].filter(Boolean).join(" · ")).join(", ")],
  ];
  const labels: Label[] = kinds.flatMap(([text, detail]) => (detail ? [{ text, detail, color: "amber" as const }] : []));
  return { labels: labels.length ? labels : [{ text: "No prior engagement", color: "green" as const }] };
}

export function qualifyContact(s: Snapshot, c: Contact, b: EventBrief): Qualified {
  const excluded: string[] = [];
  const labels: Label[] = [];
  const below = !meetsMinimum(c.title ?? "", b.min_seniority);

  if (c.employment_status === "Former") excluded.push("Left the company");
  if (c.has_opted_out_of_email) excluded.push("Opted out of email");
  const member = s.campaign_members.find((m) => m.campaign_id === b.campaign_id && m.contact_id === c.id);
  if (member) excluded.push(`Already on this event · ${member.invite_status}`);
  if (below) excluded.push(`Below ${SENIORITY[b.min_seniority]}`); // minimum seniority is a hard gate

  // Target personas steer Find Executives; here the title only has to state the minimum seniority.
  const ranked = holdsRank(c.title ?? "", b.min_seniority);
  labels.push(ranked ? { text: `Matches ${SENIORITY[b.min_seniority]}`, color: "green" } : { text: "Seniority not in title", color: "gray" });

  // City-based: the contact's mailing city is one of the selected cities. (Conference attendance isn't checked yet.)
  if (b.geography === "city" && b.cities.length) {
    if (!c.mailing_city) labels.push({ text: "Location unknown", color: "amber" });
    else if (b.cities.includes(`${c.mailing_city}, ${c.mailing_state}`)) labels.push({ text: c.mailing_city, color: "green" });
    else labels.push({ text: `${c.mailing_city} · not a selected city`, color: "amber" });
  }

  for (const r of s.opportunity_contact_roles.filter((r) => r.contact_id === c.id)) {
    const opp = s.opportunities.find((o) => o.id === r.opportunity_id && !o.is_closed);
    if (opp) labels.push({ text: `${r.role} on ${opp.name.split(" — ").pop()}`, color: "blue" });
  }
  // Anyone not excluded qualifies; the labels carry anything worth a look (no stated rank, location, an open deal).
  const warm = engagement(s, c, b.campaign_id).labels;
  if (excluded.length) return { contact: c, status: "Excluded", ranked, labels: excluded.map((text) => ({ text, color: "red" })), engagement: warm };
  return { contact: c, status: "Qualified", ranked, labels, engagement: warm };
}

const ORDER: Qualified["status"][] = ["Qualified", "Excluded"];

// One account in one event: whether it fits the brief, its commercial context, its executives (seniority stated in the
// title first, then by status) and who has been selected to invite.
export function accountPlan(s: Snapshot, a: Account, b: EventBrief) {
  const selected = new Set(s.candidates.filter((x) => x.campaign_id === b.campaign_id).map((x) => x.contact_id));
  return {
    account: a,
    excluded: accountGate(a, b) ?? openOpportunityGate(s, a),
    state: commercialState(s, a),
    executives: s.contacts
      .filter((c) => c.account_id === a.id)
      .map((c) => ({ ...qualifyContact(s, c, b), selected: selected.has(c.id) }))
      .sort((x, y) => Number(!x.ranked) - Number(!y.ranked) || ORDER.indexOf(x.status) - ORDER.indexOf(y.status)),
  };
}

// The event's account list: target accounts (Target_Account__c) minus Enterprise customers, who aren't invited through
// this flow. Those that fit the brief come first, most qualified executives first; the rest carry why they don't fit.
export function eventAccounts(s: Snapshot, b: EventBrief) {
  const plans = s.accounts.filter((a) => a.target_account && !isEnterpriseCustomer(s, a)).map((a) => accountPlan(s, a, b));
  const count = (p: (typeof plans)[number], status: string) => p.executives.filter((e) => e.status === status).length;
  return {
    fits: plans.filter((p) => !p.excluded).sort((x, y) => count(y, "Qualified") - count(x, "Qualified")),
    excluded: plans.filter((p) => p.excluded),
  };
}
