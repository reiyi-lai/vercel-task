import type { WarmContact } from "./data";
import { AS_OF, ROUTES, TIE_ORDER, type Route } from "./rules";
import type { SumbleEmployer, SumbleRole } from "./sumble";

// A warm contact who worked at the same company as a candidate at the same time, from both Sumble work histories.
// Board seats are roles on a profile too, so a shared board counts. A candidate who works at a customer now, alongside
// one of its leaders, is level zero: their own AE invites them, and the colleague is context, not an intro.
export type Overlap = { warm_contact: string; route: string; company: string; start: string; end: string | null; months: number };

// Companies Sumble keeps as separate organizations.
const ALIASES: Record<string, string> = { facebook: "meta", "meta platforms": "meta" };
const name = (e: SumbleEmployer) => {
  const n = e.name.toLowerCase().replace(/[,.]/g, "").replace(/\b(inc|llc|ltd|corp|corporation)$/, "").trim();
  return ALIASES[n] ?? n;
};

// Sumble ids when both roles have one, else the company's LinkedIn page, else its name. Aliases match across ids.
function sameEmployer(a: SumbleEmployer, b: SumbleEmployer) {
  if (name(a) === name(b) && Object.values(ALIASES).includes(name(a))) return true;
  if (a.organization_id && b.organization_id) return a.organization_id === b.organization_id;
  if (a.linkedin_url && b.linkedin_url) return a.linkedin_url === b.linkedin_url;
  return name(a) === name(b);
}

const NOW = AS_OF.toISOString().slice(0, 7);
const month = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));

// More than a month together, per the strength rules. One overlap per warm contact and company, the longest;
// ranked by route (least goodwill first), then length.
export function findOverlaps(candidate: SumbleRole[], warmContacts: WarmContact[]): Overlap[] {
  const found = new Map<string, Overlap>();
  for (const w of warmContacts) {
    for (const a of candidate) {
      for (const b of w.experience ?? []) {
        if (!a.start_date || !b.start_date || !sameEmployer(a.employer, b.employer)) continue;
        const start = a.start_date > b.start_date ? a.start_date : b.start_date;
        const end = [a.end_date ?? NOW, b.end_date ?? NOW].sort()[0];
        const months = month(end) - month(start);
        const key = `${w.name}|${name(b.employer)}`;
        if (months > 1 && months > (found.get(key)?.months ?? 0)) {
          const current = !a.end_date && !b.end_date;
          const route = current && w.warm_type === "customer_leader" ? ROUTES.levelZero : w.route;
          found.set(key, { warm_contact: w.name, route, company: b.employer.name, start, end: current ? null : end, months });
        }
      }
    }
  }
  const rank = (o: Overlap) => TIE_ORDER.indexOf(o.route as Route);
  return [...found.values()].sort((x, y) => rank(x) - rank(y) || y.months - x.months);
}
