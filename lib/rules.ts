// Shared constants: the sample data's reference date and the business time zone.

// The sample data is dated around this day, so "months ago" stays stable.
export const AS_OF = new Date("2026-10-29T00:00:00Z");

// The business time zone for outreach: when a step is "due today", and when the 9am and 4pm Slack reminders run.
export const TIMEZONE = "America/Los_Angeles";
