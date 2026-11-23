import { randomBytes } from "node:crypto";
import { loadSnapshot, TABLES, type EventBrief } from "./data";
import { geocode } from "./geocode";
import { meetsMinimum, targetPersona } from "./qualify";
import { profileKey, sumble, sumbleOrgId, type SumblePerson } from "./sumble";
import { NEW_IN_ROLE_SINCE } from "./rules";
import { expireFromRoute, ok, write } from "./write";

// The Accounts page's slow Sumble work, run from Route Handlers so the browser can run several at once:
// Next.js sends Server Actions one at a time per tab. Each returns an error message, or undefined on success.

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
    const id = `003Sb${randomBytes(5).toString("hex")}AAA`; // Salesforce-style 18-character id
    ok(
      await db.from(TABLES.contacts).insert({
        id,
        first_name: first, last_name: rest.join(" "), email: null, title: p.attributes.job_title ?? null,
        account_id: a.id, owner_id: a.owner_id, linkedin_url: linkedinUrl, employment_status: "Current",
        mailing_city: place?.city ?? null, mailing_state: place?.state ?? null, has_opted_out_of_email: false,
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

// How many people Find More Executives aims for: every new leader who passes, topped up with persona matches to this.
const FIND_TARGET = 5;

// Find More Executives: people at the account who aren't contacts yet, saved as the account's found executives for the
// event (replacing the last search).
// 1. New leaders: the 7 most recent starts among technical leaders, VP and above (about 5 credits each). Kept, whether or
//    not they match a persona, when they started since NEW_IN_ROLE_SINCE and pass the brief's seniority gate. Their work
//    history (about 2 credits each) drops profile edits: the same title at the same company before isn't a change.
// 2. Persona matches, only while there are fewer than FIND_TARGET: the 30 most senior people in technology, product and
//    executive functions at or above the minimum, names and titles only (about 2 credits each), whose titles name a
//    technology, engineering, digital or commerce role and match a persona. Only the ones needed to reach FIND_TARGET get
//    their LinkedIn URL, location and start date (about 3 credits each).
// So at most 7 rows, or 5 when persona matches fill in. persona is the target persona a title matches, or null.
export async function findExecutives(accountId: string, campaignId: string) {
  const s = await loadSnapshot();
  const a = s.accounts.find((x) => x.id === accountId);
  const brief = s.events.find((b) => b.campaign_id === campaignId);
  if (!a || !brief) return "No such account or event.";
  return write(async (db) => {
    const orgId = await sumbleOrgId(a.website);
    if (!orgId) throw new Error(`Sumble doesn't know ${a.name}.`);
    const known = new Set(s.contacts.filter((c) => c.account_id === a.id).map((c) => `${c.first_name} ${c.last_name}`.toLowerCase()));
    const inCrm = new Set(s.contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
    const isNew = (p: SumblePerson) => !known.has(p.attributes?.name?.toLowerCase() ?? "") && !(p.attributes?.linkedin_url && inCrm.has(profileKey(p.attributes.linkedin_url)));
    const persona = (title: string) => targetPersona(title, brief.personas);
    const full = ["name", "job_title", "linkedin_url", "location", "current_employer"];

    // 1. New leaders.
    const query = "(job_level EQ 'CXO' OR job_level EQ 'SVP' OR job_level EQ 'VP') AND (job_function EQ 'Engineering & R&D' OR job_function EQ 'Information Technology')";
    const starts = await sumble("people", {
      filter: { organization_ids: [orgId], query: { query } },
      select: { attributes: full },
      order_by_column: "start_date", order_by_direction: "DESC", limit: 7,
    });
    const recent = (starts.people as SumblePerson[]).filter(
      (p) => (p.attributes?.current_employer?.start_date ?? "") >= NEW_IN_ROLE_SINCE && p.attributes?.linkedin_url && isNew(p) && meetsMinimum(p.attributes.job_title ?? "", brief.min_seniority)
    );
    const history = recent.length ? await sumble("people", { people: recent.map((p) => ({ linkedin_url: p.attributes!.linkedin_url })), select: { attributes: ["experience"] } }) : { people: [] };
    const leaders = recent.filter((p, i) => {
      const [, prev] = (history.people[i] as SumblePerson).attributes?.experience ?? [];
      return !(prev?.employer.organization_id === orgId && prev.title === p.attributes!.job_title);
    });

    // 2. Persona matches, only as many as it takes to reach FIND_TARGET.
    let matches: SumblePerson[] = [];
    if (leaders.length < FIND_TARGET) {
      const levels = `(${LEVELS[brief.min_seniority].map((l) => `job_level EQ '${l}'`).join(" OR ")}) AND (${FUNCTIONS.map((f) => `job_function EQ '${f}'`).join(" OR ")})`;
      const search = await sumble("people", {
        filter: { organization_ids: [orgId], query: { query: levels } },
        select: { attributes: ["name", "job_title"] },
        order_by_column: "job_level", order_by_direction: "DESC", limit: 30,
      });
      const taken = new Set(leaders.map((p) => p.attributes!.name?.toLowerCase()));
      const needed = (search.people as SumblePerson[])
        .filter((p) => isNew(p) && !taken.has(p.attributes?.name?.toLowerCase()) && persona(p.attributes?.job_title ?? ""))
        .slice(0, FIND_TARGET - leaders.length);
      if (needed.length) matches = (await sumble("people", { people: needed.map((p) => ({ person_id: p.person_id })), select: { attributes: full } })).people;
    }

    // New leaders first, then persona matches; one row per LinkedIn profile.
    const rows = [...leaders, ...matches]
      .flatMap((p) => {
        const x = p.attributes;
        if (!x?.linkedin_url || !x.name || inCrm.has(profileKey(x.linkedin_url))) return [];
        return [{
          campaign_id: campaignId, account_id: a.id, name: x.name, title: x.job_title ?? null, location: x.location ?? null,
          linkedin_url: x.linkedin_url, persona: persona(x.job_title ?? ""), started: x.current_employer?.start_date?.slice(0, 7) ?? null,
        }];
      })
      .filter((r, i, all) => all.findIndex((y) => profileKey(y.linkedin_url) === profileKey(r.linkedin_url)) === i);
    ok(await db.from(TABLES.found_executives).delete().eq("campaign_id", campaignId).eq("account_id", a.id));
    if (rows.length) ok(await db.from(TABLES.found_executives).upsert(rows));
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
    ok(await db.from(TABLES.contacts).update({ email }).eq("id", c.id));
  }, expireFromRoute);
}
