import { expect, it } from "vitest";
import { loadSampleSnapshot } from "./csv";
import { accountGate, matchPersona, qualifyContact, seniority } from "./qualify";

const s = loadSampleSnapshot();
const brief = (slug: string) => s.event_briefs.find((b) => b.campaign_id === s.events.find((e) => e.slug === slug)!.campaign_id)!;
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
});

it("Accounts outside the brief's verticals or tiers are excluded, with the reason", () => {
  expect(accountGate(account("Orbis Health"), brief("nrf-breakfast"))).toBe("Healthcare isn't a target vertical");
  expect(accountGate(account("Orbis Health"), brief("ai-builder-dinner"))).toBeNull(); // cross-industry
  expect(accountGate(account("Orchard & Pine Markets"), brief("nrf-breakfast"))).toBeNull();
});

it("The same executive qualifies differently per event", () => {
  // Elena: VP Digital Commerce in New York. Ideal for the NRF breakfast; outside the F1 personas.
  expect(check("Elena", "nrf-breakfast")).toMatchObject({ status: "Qualified" });
  expect(check("Elena", "lvgp").labels[0]).toEqual({ text: "Outside target personas", color: "gray" });
  // Hye-jin: Director of Platform Engineering, excluded by the AI dinner's VP+ hard gate.
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
