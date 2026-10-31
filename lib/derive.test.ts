import { expect, it } from "vitest";
import { loadSampleSnapshot } from "./csv";
import { accountInteractions, derivePlan, eventOverview, vercelUsage } from "./derive";
import { ROUTES } from "./rules";

const s = loadSampleSnapshot();
const LVGP = "701Sb0000000001AAA"; // Las Vegas GP campaign
const FSI_RT = "701Sb0000000008AAA"; // FSI platform roundtable campaign
// Sample Salesforce IDs embed the original record numbers: contact 90001 is 003Sb0000090001AAA.
const contact = (n: number) => `003Sb00000${n}AAA`;
const account = (n: number) => `001Sb00000${n}AAA`;
const ladder = (n: number, campaign = LVGP) => derivePlan(s, contact(n), campaign).ladder.map((r) => `${r.label}: ${r.connector.name} (${r.route})`);
const roles = (n: number) => Object.fromEntries(derivePlan(s, contact(n), LVGP).connectors.map((c) => [c.name, `${c.role}${c.strength ? ` · ${c.strength}` : ""}`]));

it("Owen: customer intro via Ethan, Jordan as backup, Marcus's direct invite as the fallback", () => {
  expect(ladder(90001)).toEqual([
    "Recommended: Ethan Cole (Via existing customer)",
    "Backup: Jordan Kim (Vercel leadership)",
    "Fallback: direct: Marcus Lee (AE / deal team)",
  ]);
  expect(roles(90001)).toMatchObject({
    "Daniel Brooks": "Seating · Moderate", // attendee-only paths are for seating
    "Priya Natarajan": "Weak · Weak", // LinkedIn noise, denied in Slack
  });
});

it("Rajat: customer peers at Schwab and MSCI", () => {
  expect(ladder(90022)).toEqual([
    "Recommended: Dennis Howard (Via existing customer)",
    "Backup: June Yang (Via existing customer)",
    "Fallback: direct: Marcus Lee (AE / deal team)",
  ]);
});

it("Jason: three Walmart alumni at customers, each moderate (same company, different orgs)", () => {
  expect(ladder(90023)).toEqual([
    "Recommended: Srini Venkatesan (Via existing customer)",
    "Backup: Fiona Tan (Via existing customer)",
    "Backup: Suresh Kumar (Via existing customer)",
    "Fallback: direct: Dana Ruiz (AE / deal team)",
  ]);
});

it("Prem: Aparna's same-team overlap at Capital One is a strong leadership intro", () => {
  expect(ladder(90024)).toEqual(["Recommended: Aparna Sinha (Vercel leadership)", "Fallback: direct: Marcus Lee (AE / deal team)"]);
});

it("Julian: Priya knows him well but is at her intro cap, so Marcus leads", () => {
  expect(ladder(90006)).toEqual(["Recommended: Marcus Lee (AE / deal team)"]);
  expect(derivePlan(s, contact(90006), LVGP).connectors.find((c) => c.name === "Priya Natarajan")).toMatchObject({ role: "Paused", pausedUntil: "2026-11-01" });
});

it("Arjun: same-team overlap at a customer is a strong intro", () => {
  expect(ladder(90004, FSI_RT)[0]).toBe("Recommended: Leah Morgan (Via existing customer)");
});

it("Level zero: a target at a customer is invited by their AE first", () => {
  const [top] = derivePlan(s, contact(90009), LVGP).ladder; // Ethan Cole works at Cascade Home, a customer
  expect(top.route).toBe(ROUTES.levelZero);
  expect(top.connector.name).toBe("Dana Ruiz");
});

it("Event overview: open seats and candidates come from the roster and the Clay table", () => {
  const o = eventOverview(s, "lvgp")!;
  expect(o.seats.filter((x) => x.status === "Open").map((x) => x.n)).toEqual([4, 10]);
  expect(o.pipeline[0].cards.map((c) => c.name)).toEqual(["Owen Fischer", "Julian Wright", "Rajat Taneja", "Jason Morris", "Prem Natarajan"]);
});

it("Past account interactions: Marcus's thread with Sam", () => {
  const rows = accountInteractions(s, s.contacts.find((c) => c.id === contact(90001))!);
  expect(rows.map((r) => [r.name, r.status, r.lines.map((l) => l.text)])).toEqual([
    ["Sam Ortiz", "Current", ["Salesforce (latest 06/16/2026): 1 email reply, 1 outbound email"]],
  ]);
});

it("Vercel usage: teams by highest spend, key contacts matched to Salesforce by email", () => {
  const af = vercelUsage(s, account(70001));
  expect(af.teams.map((t) => t.key_contact_name)).toEqual(["Sam Ortiz", "Jo Huang", "Lena Park"]);
  expect(af.teams[0].key_contact_id).toBe(contact(90019));
  expect([af.activeUsers, af.monthlySpend]).toEqual([9, 660]);
  expect(vercelUsage(s, account(70006)).teams).toEqual([]);
});
