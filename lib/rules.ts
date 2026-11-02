// Routing rules agreed for Seatbook (see README). A typed config file for the prototype; Edge Config in production.

// The sample data is dated around this day, so "months ago" stays stable.
export const AS_OF = new Date("2026-10-29T00:00:00Z");

// The business time zone for outreach: when a step is "due today", and when the 9am and 4pm Slack reminders run.
export const TIMEZONE = "America/Los_Angeles";

export const ROUTES = {
  levelZero: "AE · existing customer", // the target works at a customer: their AE invites directly, always first
  customer: "Via existing customer",
  attendee: "Current attendee",
  leadership: "Vercel leadership",
  ae: "AE / deal team",
} as const;
export type Route = (typeof ROUTES)[keyof typeof ROUTES];

// Which route a connector with several routes shows first (Ethan: customer before attendee).
export const ROUTE_PRECEDENCE: Route[] = [ROUTES.levelZero, ROUTES.customer, ROUTES.attendee, ROUTES.leadership, ROUTES.ae];
// Between connectors of equal strength, the one costing least goodwill wins.
export const TIE_ORDER: Route[] = [ROUTES.levelZero, ROUTES.ae, ROUTES.attendee, ROUTES.customer, ROUTES.leadership];

export const LEADERSHIP_TITLES = ["Field CTO", "VP Sales", "SVP of Product"];

// Two-way Salesforce activity (Tasks and Events): within 12 months is strong, 12–24 moderate, older weak.
export const ACTIVITY_MONTHS = { strong: 12, moderate: 24 };

export type Strength = "Strong" | "Moderate" | "Weak";
export const STRENGTH_RANK: Record<Strength, number> = { Strong: 3, Moderate: 2, Weak: 1 };

// Slack answers are authoritative. Customer AEs answer "Yes, they're close", "Yes, but not sure how close" (keeps the
// inferred strength) or "Not now" (holds the path). "Not sure" in the event channel leaves it unconfirmed.
export const ANSWER_STRENGTH: Record<string, Strength> = {
  "Know well": "Strong",
  Somewhat: "Moderate",
  Barely: "Weak",
  "Yes, they're close": "Strong",
};
export const ANSWER_HOLD = "Not now";
