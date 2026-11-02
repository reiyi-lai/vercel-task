import { expect, it } from "vitest";
import { loadSampleSnapshot } from "./csv";
import { findOverlaps } from "./overlap";

const warm = loadSampleSnapshot().warm_contacts;
const at = (name: string, start: string, end?: string, organization_id?: number) => ({ title: "", start_date: start, end_date: end, employer: { name, organization_id } });

it("Overlaps need the same company at the same time, for more than a month", () => {
  // Eric Glyman was at Capital One 2016-10 to 2019-02.
  expect(findOverlaps([at("Capital One", "2015-01", "2017-06")], warm)).toContainEqual(
    expect.objectContaining({ warm_contact: "Eric Glyman", route: "Via existing customer", start: "2016-10", end: "2017-06" })
  );
  expect(findOverlaps([at("Capital One", "2019-02", "2020-01")], warm).some((o) => o.warm_contact === "Eric Glyman")).toBe(false);
});

it("A candidate at a customer now, alongside its leaders, is invited by their own AE: level zero, not an intro", () => {
  // Jayme Fishman and Danny Fields lead at Avalara, a customer.
  const overlaps = findOverlaps([at("Avalara", "2025-01", undefined, 1540)], warm);
  expect(overlaps.filter((o) => o.company === "Avalara").map((o) => o.route)).toEqual(["AE · existing customer", "AE · existing customer"]);
  // Having left the customer, the same overlap is a colleague intro again.
  expect(findOverlaps([at("Avalara", "2021-01", "2023-01", 1540)], warm)[0].route).toBe("Via existing customer");
});

it("Facebook and Meta are the same company, though Sumble keeps two organizations", () => {
  // Jordan Walke was at Facebook 2010-09 to 2020-01.
  const overlaps = findOverlaps([at("Meta", "2018-01", "2019-01", 89)], warm);
  expect(overlaps.find((o) => o.warm_contact === "Jordan Walke")).toMatchObject({ company: "Facebook", start: "2018-01", end: "2019-01" });
});

it("Current colleagues overlap with no end date, and customer leaders rank before Vercel leadership", () => {
  const overlaps = findOverlaps([at("Ramp", "2020-01", "2024-01", 6943), at("Vercel", "2025-01", undefined, 23462)], warm);
  expect(overlaps[0].route).toBe("Via existing customer");
  expect(overlaps.find((o) => o.warm_contact === "Guillermo Rauch")).toMatchObject({ start: "2025-01", end: null });
});
