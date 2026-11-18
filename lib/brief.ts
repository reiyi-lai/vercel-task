import type { EventBrief, SequenceStep } from "./data";

// Choices and labels for the Event Brief. Values are what the events table stores.

// The verticals a brief can target, as Salesforce holds them (Vertical__c). Selecting them all targets any vertical.
export const VERTICALS = ["Retail", "Financial Services"];
export const THEMES = ["Apps & Agents", "Software Factories"];
// Event cities, as "City, ST" to match a contact's mailing city and state.
export const CITIES = [
  "Atlanta, GA",
  "Austin, TX",
  "Boston, MA",
  "Charlotte, NC",
  "Chicago, IL",
  "Dallas, TX",
  "Denver, CO",
  "Detroit, MI",
  "Houston, TX",
  "Las Vegas, NV",
  "Los Angeles, CA",
  "Miami, FL",
  "Minneapolis, MN",
  "Nashville, TN",
  "New York, NY",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "San Diego, CA",
  "San Francisco, CA",
  "Seattle, WA",
  "Washington, DC",
];
export const TIERS = ["Tier 1", "Tier 2", "Tier 3"];

// A new F1 event's defaults, over the Las Vegas GP's brief: the Miami Grand Prix as a ready example.
export const F1_DEFAULTS = {
  name: "Miami Grand Prix", shortName: "Miami GP", startDate: "2026-11-24", endDate: "2026-11-26", seats: 10,
  brief: {
    format: "Formula 1 Executive Hospitality", location: "Miami, FL", target_guests: 10, acceptance_rate: 50,
    personas: ["CTO", "CIO", "SVP Engineering", "VP Engineering", "Executive Vice President", "Chief AI Officer", "Senior Vice President Engineering"],
    geography: "nationwide", cities: [], min_seniority: "vp", tiers: ["Tier 1"], outreach_lead: "exec",
    exec_name: "Guillermo Rach (CEO)", select_by: "2026-11-18",
  } satisfies Partial<EventBrief>,
};

// The formats a new event starts from. Each pre-fills the brief from the existing event of that kind (from: its slug).
export const FORMATS = {
  f1: { label: "F1 Hospitality", detail: "Race-weekend suite. AE-led with exec sign-off, nationwide.", from: "lvgp" },
  vertical: { label: "Vertical ABM", detail: "One industry in one city. AE/BDR-led.", from: "nrf-breakfast" },
  horizontal: { label: "Horizontal ABM", detail: "Cross-industry, on a theme. BDR-led.", from: "ai-builder-dinner" },
} as const;

export const GEOGRAPHY: Record<EventBrief["geography"], { label: string; detail: string }> = {
  city: { label: "City-Based", detail: "Located in selected cities." },
  conference: { label: "Attending Conference Only", detail: "Coming soon: Limit to conference attendee list, through Salesforce campaign." },
  nationwide: { label: "Nationwide / Open to Travel", detail: "No location restriction." },
};

export const SENIORITY: Record<EventBrief["min_seniority"], string> = {
  c_suite: "C-suite only",
  svp: "SVP and above",
  vp: "VP and above",
  director: "Director and above",
};


// Who sends every step of an event's outreach, and the sender its steps carry. AE/BDR-led: the account's AE, or a BDR
// (picked on the Candidates page) when the account has no AE.
export const OUTREACH_LEADS: Record<EventBrief["outreach_lead"], { label: string; detail: string }> = {
  exec: { label: "AE-led with Exec Sign-off", detail: "AE drafts each step with exec sign-off." },
  bdr: { label: "BDR-led only", detail: "BDR drafts & sends each step." },
  ae_bdr: { label: "AE / BDR-led", detail: "AE if warm; BDR if cold." },
};

export const LEAD_SENDER: Record<EventBrief["outreach_lead"], SequenceStep["sender"]> = { exec: "Exec", bdr: "BDR", ae_bdr: "AE" };
export const SENDER_LABEL: Record<SequenceStep["sender"], string> = { Exec: "From Vercel Exec (draft by AE)", BDR: "From BDR", AE: "From AE, or BDR if no AE" };

// Whether a candidate's outreach is sent by a BDR: always on BDR-led events, and on AE/BDR-led ones when the account
// has no AE.
export const sentByBdr = (lead: EventBrief["outreach_lead"], aeId: string | null) => lead === "bdr" || (lead === "ae_bdr" && !aeId);

// Works back from the guest target: invitations needed at the expected acceptance rate. Guests already confirmed in
// Salesforce come off the target.
export function outreachVolume(b: Pick<EventBrief, "target_guests" | "acceptance_rate">, confirmed: number) {
  const invites = Math.ceil((Math.max(0, b.target_guests - confirmed) * 100) / b.acceptance_rate);
  return { invites, expected: confirmed + Math.round((invites * b.acceptance_rate) / 100) };
}

// Whether a signal's theme bears on this event. Leadership signals carry campaign themes, which match
// the brief's themes directly; web-research initiatives carry their own themes, which map to its themes or verticals.
export function relevantTheme(theme: string | null, b: Pick<EventBrief, "themes" | "verticals">) {
  if (theme === "Internal Software") return b.themes.includes("Apps & Agents") || b.themes.includes("Software Factories");
  if (theme === "Retail/Agentic Commerce") return b.verticals.includes("Retail");
  if (theme === "Financial Services") return b.verticals.includes("Financial Services");
  return !!theme && b.themes.includes(theme);
}

