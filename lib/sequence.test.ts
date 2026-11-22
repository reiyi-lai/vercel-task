import { expect, it } from "vitest";
import type { Candidate, SequenceStep } from "./data";
import { loadSampleSnapshot } from "./csv";
import { eventProgress, progress, pushDeadline, render, schedule } from "./sequence";

const steps: SequenceStep[] = [0, 4, 9].map((day) => ({ day, channel: "Email", sender: "AE", subject: "", body: "" }));
const candidate = (o: Partial<Candidate>): Candidate => ({
  campaign_id: "c", contact_id: "k", approved_at: null, bdr_id: null, exec_name: null, started_at: null, drafts: {}, sent: [], outcome: null, outcome_at: null, ...o,
});
const now = new Date("2026-11-10T12:00:00Z");

it("Templates fill known placeholders and leave unknown ones visible", () => {
  expect(render("Hi {first_name}, see you at {event}. {typo}", { first_name: "Ada", event: "the Grand Prix" })).toBe("Hi Ada, see you at the Grand Prix. {typo}");
  expect(render("Hi Ada,\n\n\n\nJoin us.", {})).toBe("Hi Ada,\n\nJoin us.");
});

it("Steps are due on their day after the start, overdue after that, and stop on an outcome", () => {
  const started = candidate({ started_at: "2026-11-02T09:00:00Z", sent: [{ step: 0, at: "2026-11-02T10:00:00Z" }] });
  expect(schedule(steps, started, now).map((x) => x.status)).toEqual(["Sent", "Overdue", "Upcoming"]);
  expect(progress(steps, started, now).text).toBe("Step 2 of 3 · overdue since Nov 6");
  expect(schedule(steps, { ...started, outcome: "Replied" }, now).map((x) => x.status)).toEqual(["Sent", "Stopped", "Stopped"]);
  expect(progress(steps, undefined, now).text).toBe("Not started");
});

it("An approved candidate is due to be pushed the day after approval, overdue after that", () => {
  // now is Nov 10 in the business time zone.
  expect(pushDeadline(candidate({ approved_at: "2026-11-09T18:00:00Z" }), now)).toMatchObject({ text: "Push by today", overdue: false });
  expect(pushDeadline(candidate({ approved_at: "2026-11-10T18:00:00Z" }), now)).toMatchObject({ text: "Push by Nov 11", overdue: false });
  expect(pushDeadline(candidate({ approved_at: "2026-11-06T18:00:00Z" }), now)).toMatchObject({ text: "Push overdue since Nov 7", overdue: true });
  expect(pushDeadline(candidate({}), now)).toBeNull(); // not approved yet
  expect(pushDeadline(candidate({ approved_at: "2026-11-06T18:00:00Z", started_at: "2026-11-07T09:00:00Z" }), now)).toBeNull(); // pushed
});

it("Event progress counts invites sent, responses and acceptances against the brief", () => {
  const s = loadSampleSnapshot();
  const b = s.events.find((x) => x.campaign_id === "701Sb0000000001AAA")!;
  const at = "2026-11-02T10:00:00Z";
  s.candidates = [
    candidate({ campaign_id: b.campaign_id, contact_id: "a", started_at: at, sent: [{ step: 0, at }], outcome: "Accepted" }),
    candidate({ campaign_id: b.campaign_id, contact_id: "b", started_at: at, sent: [{ step: 0, at }] }),
  ];
  expect(eventProgress(s, b, now)).toMatchObject({ shortlisted: 2, invited: 2, accepted: 1, confirmedInSalesforce: 0, awaiting: 1, overdue: 1 });
});
