import { expect, it } from "vitest";
import type { Outreach, SequenceStep } from "./data";
import { progress, render, schedule } from "./sequence";

const steps: SequenceStep[] = [0, 4, 9].map((day) => ({ day, channel: "Email", sender: "AE", subject: "", body: "" }));
const outreach = (o: Partial<Outreach>): Outreach => ({
  campaign_id: "c", contact_id: "k", personal_line: null, line_signal: null, started_at: null, sent: [], outcome: null, outcome_at: null, ...o,
});
const now = new Date("2026-11-10T12:00:00Z");

it("Templates fill known placeholders and leave unknown ones visible", () => {
  expect(render("Hi {first_name}, see you at {event}. {typo}", { first_name: "Ada", event: "the Grand Prix" })).toBe("Hi Ada, see you at the Grand Prix. {typo}");
});

it("Steps are due on their day after the start, overdue after that, and stop on an outcome", () => {
  const started = outreach({ started_at: "2026-11-02T09:00:00Z", sent: [{ step: 0, at: "2026-11-02T10:00:00Z" }] });
  expect(schedule(steps, started, now).map((x) => x.status)).toEqual(["Sent", "Overdue", "Upcoming"]);
  expect(progress(steps, started, now).text).toBe("Step 2 of 3 · overdue since Nov 6");
  expect(schedule(steps, { ...started, outcome: "Replied" }, now).map((x) => x.status)).toEqual(["Sent", "Stopped", "Stopped"]);
  expect(progress(steps, undefined, now).text).toBe("Not started");
});
