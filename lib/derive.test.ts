import { expect, it } from "vitest";
import { loadSampleSnapshot } from "./csv";
import { eventOverview, formatDates, vercelUsage } from "./derive";

const s = loadSampleSnapshot();
const LVGP = "701Sb0000000001AAA"; // Las Vegas GP campaign
const contact = (n: number) => `003Sb00000${n}AAA`;
const account = (n: number) => `001Sb00000${n}AAA`;

it("Event overview: candidates counted by stage", () => {
  const row = { campaign_id: LVGP, approved_at: null, bdr_id: null, exec_name: null, started_at: null, drafts: {}, sent: [], outcome: null, outcome_at: null };
  const snap = { ...s, candidates: [{ ...row, contact_id: contact(90001) }, { ...row, contact_id: contact(90006), approved_at: "2026-11-01T08:00:00Z", started_at: "2026-11-01T09:00:00Z", outcome: "Replied" as const }] };
  const o = eventOverview(snap, "lvgp")!;
  expect(o.stages.map((st) => [st.label, st.count])).toEqual([
    ["Pending Marketing Approval", 1], ["Pending Send (AE/BDR)", 0], ["Sent", 0], ["Replied", 1], ["Accepted", 0], ["Declined", 0],
  ]);
});

it("Vercel usage: teams by highest spend, key contacts matched to Salesforce by email", () => {
  const af = vercelUsage(s, account(70001));
  expect(af.teams.map((t) => t.key_contact_name)).toEqual(["Sam Ortiz", "Jo Huang", "Lena Park"]);
  expect(af.teams[0].key_contact_id).toBe(contact(90019));
  expect([af.activeUsers, af.monthlySpend]).toEqual([9, 660]);
  expect(vercelUsage(s, account(70006)).teams).toEqual([]);
});

it("Event dates show as one day or a range", () => {
  expect(formatDates("2026-11-19", null)).toBe("Nov 19, 2026");
  expect(formatDates("2026-11-19", "2026-11-21")).toBe("Nov 19–21, 2026");
  expect(formatDates("2026-11-30", "2026-12-02")).toBe("Nov 30 – Dec 2, 2026");
});
