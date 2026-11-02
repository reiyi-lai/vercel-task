// Fetches every warm contact's work history from Sumble into data/sumble/warm_contacts_experience.json,
// which the seed loads into warm_contacts.experience. Run: npm run sumble:warm (about 3 credits per person).
import { writeFileSync } from "node:fs";
import { loadSampleSnapshot } from "../lib/csv.ts";
import { fetchExperience } from "../lib/sumble.ts";

const urls = loadSampleSnapshot().warm_contacts.flatMap((w) => (w.linkedin_url ? [w.linkedin_url] : []));
const people = await fetchExperience(urls);
writeFileSync("data/sumble/warm_contacts_experience.json", `${JSON.stringify(people, null, 2)}\n`);
const missed = people.filter((p) => !p.person_id).map((p) => p.input!.linkedin_url);
console.log(`Wrote ${people.length - missed.length} of ${urls.length} work histories${missed.length ? `; not found: ${missed.join(", ")}` : ""}`);
