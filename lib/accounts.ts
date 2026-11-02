import { randomBytes } from "node:crypto";
import { loadSnapshot, type AccountSignal, type EventBrief } from "./data";
import { geocode } from "./geocode";
import { matchPersona } from "./qualify";
import { hiringSignals, initiativeSignals, leadershipSignals, sumbleOrgId } from "./signals";
import { profileKey, sumble, type SumblePerson } from "./sumble";
import { expireFromRoute, ok, write } from "./write";

// The account plan's slow work (Sumble, web research), run from Route Handlers so the browser can run several at once:
// Next.js sends Server Actions one at a time per tab. Each returns an error message, or undefined on success.

// Fetches one group of the account's live signals, Sumble (hiring and leadership) or web research (AI initiatives),
// and replaces each of its sources' previous signals. A source that fails keeps its old signals and is named in the
// message; the others still save.
export async function refreshSignals(accountId: string, group: "sumble" | "research") {
  const a = (await loadSnapshot()).accounts.find((x) => x.id === accountId);
  if (!a) return "No such account.";
  const failed: string[] = [];
  const err = await write(async (db) => {
    const orgId = group === "sumble" ? await sumbleOrgId(a) : null;
    const sources: Record<string, Promise<AccountSignal[]>> =
      group === "research"
        ? { "Web research": initiativeSignals(a) }
        : {
            "Sumble job posts": orgId ? hiringSignals(a.id, orgId) : Promise.resolve([]),
            "Sumble people": orgId ? leadershipSignals(a.id, orgId) : Promise.resolve([]),
          };
    const results = await Promise.allSettled(Object.values(sources));
    for (const [i, source] of Object.keys(sources).entries()) {
      const r = results[i];
      if (r.status === "rejected") {
        failed.push(`${source}: ${(r.reason as Error).message}`);
        continue;
      }
      ok(await db.from("account_signals").delete().eq("account_id", a.id).eq("source", source));
      if (r.value.length) ok(await db.from("account_signals").insert(r.value));
    }
  }, expireFromRoute);
  return err ?? (failed.length ? failed.join(" ") : undefined);
}

// Adds a person as a Contact on the account, owned by its AE: current name, title and location from Sumble by
// LinkedIn URL (about 4 credits), the city geocoded for the brief's location checks. No email yet.
// In production this creates the Contact through the Salesforce API.
export async function addContact(accountId: string, linkedinUrl: string) {
  const s = await loadSnapshot();
  const a = s.accounts.find((x) => x.id === accountId);
  if (!a) return "No such account.";
  if (s.contacts.some((c) => c.linkedin_url && profileKey(c.linkedin_url) === profileKey(linkedinUrl))) return "Already in the CRM.";
  return write(async (db) => {
    const { people } = await sumble("people", { people: [{ linkedin_url: linkedinUrl }], select: { attributes: ["name", "job_title", "location"] } });
    const p = (people as SumblePerson[])[0];
    if (!p.person_id || !p.attributes?.name) throw new Error("Sumble couldn't find this profile.");
    const place = await geocode(p.attributes.location);
    const [first, ...rest] = p.attributes.name.split(" ");
    ok(
      await db.from("contacts").insert({
        id: `003Sb${randomBytes(5).toString("hex")}AAA`, // Salesforce-style 18-character id
        first_name: first, last_name: rest.join(" "), email: null, title: p.attributes.job_title ?? null,
        account_id: a.id, owner_id: a.owner_id, linkedin_url: linkedinUrl, intro_program: null, employment_status: "Current",
        mailing_city: place?.city ?? null, mailing_state: place?.state ?? null, mailing_latitude: place?.latitude ?? null,
        mailing_longitude: place?.longitude ?? null, has_opted_out_of_email: false,
      })
    );
  }, expireFromRoute);
}

// Sumble job levels at or above each brief minimum; Head counts as VP-level, as in qualify.ts.
const LEVELS: Record<EventBrief["min_seniority"], string[]> = {
  c_suite: ["CXO"],
  svp: ["CXO", "SVP"],
  vp: ["CXO", "SVP", "VP", "Head"],
  director: ["CXO", "SVP", "VP", "Head", "Executive Director", "Senior Director", "Director"],
};
const FUNCTIONS = ["Engineering & R&D", "Information Technology", "Product & Design", "Executive"];

// People at the account who match the event's target personas and aren't contacts yet, saved as the account's
// found executives for the event (replacing the last search). One search for senior people in technology, product and
// executive functions, names and titles only (about 2 credits each); titles are matched against the personas here,
// then only the matches get their LinkedIn URL and location (about 3 credits each).
export async function findExecutives(accountId: string, campaignId: string) {
  const s = await loadSnapshot();
  const a = s.accounts.find((x) => x.id === accountId);
  const brief = s.event_briefs.find((b) => b.campaign_id === campaignId);
  if (!a || !brief) return "No such account or event.";
  return write(async (db) => {
    const orgId = await sumbleOrgId(a);
    if (!orgId) throw new Error(`Sumble doesn't know ${a.name}.`);
    const query = `(${LEVELS[brief.min_seniority].map((l) => `job_level EQ '${l}'`).join(" OR ")}) AND (${FUNCTIONS.map((f) => `job_function EQ '${f}'`).join(" OR ")})`;
    const search = await sumble("people", {
      filter: { organization_ids: [orgId], query: { query } },
      select: { attributes: ["name", "job_title"] },
      order_by_column: "job_level", order_by_direction: "DESC", limit: 40,
    });
    const known = new Set(s.contacts.filter((c) => c.account_id === a.id).map((c) => `${c.first_name} ${c.last_name}`.toLowerCase()));
    const matches = (search.people as SumblePerson[])
      .filter((p) => !known.has(p.attributes?.name?.toLowerCase() ?? "") && matchPersona(p.attributes?.job_title ?? "", brief.personas))
      .slice(0, 10);
    const details = matches.length
      ? await sumble("people", { people: matches.map((p) => ({ person_id: p.person_id })), select: { attributes: ["name", "job_title", "linkedin_url", "location"] } })
      : { people: [] };
    const inCrm = new Set(s.contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
    const rows = (details.people as SumblePerson[]).flatMap((p) => {
      const x = p.attributes;
      if (!x?.linkedin_url || !x.name || inCrm.has(profileKey(x.linkedin_url))) return [];
      return [{
        campaign_id: campaignId, account_id: a.id, name: x.name, title: x.job_title ?? null, location: x.location ?? null,
        linkedin_url: x.linkedin_url, persona: matchPersona(x.job_title ?? "", brief.personas)!,
      }];
    });
    ok(await db.from("found_executives").delete().eq("campaign_id", campaignId).eq("account_id", a.id));
    if (rows.length) ok(await db.from("found_executives").upsert(rows));
  }, expireFromRoute);
}

// Reveals a contact's work email through Sumble by their LinkedIn URL (about 11 credits; nothing when none is found)
// and saves it on the contact.
export async function findEmail(contactId: string) {
  const c = (await loadSnapshot()).contacts.find((x) => x.id === contactId);
  if (!c?.linkedin_url || c.linkedin_url.includes("linkedin.example")) return "This contact has no LinkedIn profile to look up.";
  if (c.email) return "This contact already has an email.";
  return write(async (db) => {
    const { people } = await sumble("people", { people: [{ linkedin_url: c.linkedin_url }], select: { attributes: ["email"] } });
    const email = (people as SumblePerson[])[0]?.attributes?.email;
    if (!email) throw new Error(`Sumble has no email for ${c.first_name} ${c.last_name}.`);
    ok(await db.from("contacts").update({ email }).eq("id", c.id));
  }, expireFromRoute);
}
