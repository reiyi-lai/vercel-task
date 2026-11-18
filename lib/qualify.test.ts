import { expect, it } from "vitest";
import { loadSampleSnapshot } from "./csv";
import { accountGate, holdsRank, inTechDepartment, matchPersona, qualifyContact, seniority } from "./qualify";

const s = loadSampleSnapshot();
const brief = (slug: string) => s.events.find((b) => b.campaign_id === s.events.find((e) => e.slug === slug)!.campaign_id)!;
const contact = (first: string) => s.contacts.find((c) => c.first_name === first)!;
const account = (name: string) => s.accounts.find((a) => a.name === name)!;
const check = (first: string, slug: string) => qualifyContact(s, contact(first), brief(slug));

it("Titles map to seniority and personas, acronyms included", () => {
  expect(seniority("EVP & Chief Digital Officer")).toBe("c_suite");
  expect(seniority("SVP Digital Commerce")).toBe("svp");
  expect(seniority("Head of AI Platform")).toBe("vp");
  expect(seniority("Senior Software Engineer")).toBeNull();
  expect(matchPersona("Chief Technology and Information Officer", ["CTO"])).toBe("CTO");
  expect(matchPersona("SVP Digital Commerce", ["VP Digital Commerce"])).toBe("VP Digital Commerce");
  expect(matchPersona("SVP Engineering", ["VP Platform Engineering"])).toBeUndefined();
  expect(matchPersona("Chief Information Security Officer", ["CIO"])).toBeUndefined();
  expect(matchPersona("Chief Information Security Officer", ["CISO"])).toBe("CISO");
  expect(inTechDepartment("CIO")).toBe(true);
  expect(inTechDepartment("SVP Digital Commerce")).toBe(true);
  expect(inTechDepartment("VP Engineering")).toBe(true);
  expect(inTechDepartment("Chief Financial Officer")).toBe(false);
  expect(inTechDepartment("VP Marketing")).toBe(false);
});

it("Accounts outside the brief's verticals or tiers are excluded, with the reason", () => {
  expect(accountGate(account("Orbis Health"), brief("nrf-breakfast"))).toBe("Healthcare isn't a target vertical");
  expect(accountGate(account("Orbis Health"), brief("ai-builder-dinner"))).toBeNull(); // cross-industry
  expect(accountGate(account("Orchard & Pine Markets"), brief("nrf-breakfast"))).toBeNull();
});

it("The same executive qualifies differently per event", () => {
  // Elena: VP Digital Commerce in New York. On rank for both events' minimums.
  expect(check("Elena", "nrf-breakfast").labels[0]).toEqual({ text: "Matches Director and above", color: "green" });
  expect(check("Elena", "lvgp").labels[0]).toEqual({ text: "Matches VP and above", color: "green" });
  // Rank words count only at or above the minimum: a Director title doesn't meet a VP+ event.
  expect(holdsRank("Senior Vice President of Technology", "svp")).toBe(true);
  expect(holdsRank("Vice President, Engineering", "svp")).toBe(false);
  expect(holdsRank("Director of Engineering", "director")).toBe(true);
  expect(holdsRank("CTO", "c_suite")).toBe(true);
  // President on its own is C-level; Vice President isn't.
  expect(holdsRank("President, Technology", "c_suite")).toBe(true);
  expect(holdsRank("Vice President - AI Research & Innovation", "svp")).toBe(false);
  expect(seniority("Vice President - AI Research & Innovation")).toBe("vp");
  expect(seniority("Senior Vice President, Engineering")).toBe("svp");
  // Hye-jin: Director of Platform Engineering, excluded by the AI dinner's VP+ minimum.
  expect(check("Hye-jin", "ai-builder-dinner")).toMatchObject({ status: "Excluded", labels: [{ text: "Below VP and above" }] });
  // Adaeze: VP Platform Engineering in San Francisco.
  expect(check("Adaeze", "ai-builder-dinner").status).toBe("Qualified");
});

it("Opted-out and former contacts are excluded; missing email or location needs review", () => {
  expect(check("Isabel", "lvgp").labels[0].text).toBe("Opted out of email");
  expect(check("Ben", "lvgp").labels[0].text).toBe("Left the company");
  expect(check("Lucas", "ai-builder-dinner")).toMatchObject({ status: "Review" });
  expect(check("Rajat", "ai-builder-dinner").labels.map((l) => l.text)).toContain("Location unknown");
});
