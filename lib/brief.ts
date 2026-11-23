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

// A new F1 event's defaults, over the Las Vegas GP's brief: the Miami Grand Prix as a ready example, with its own
// outreach copy. The event name is left for the marketer to enter.
export const F1_DEFAULTS = {
  name: "", shortName: "Miami GP", startDate: "2026-11-24", endDate: "2026-11-26", seats: 10,
  brief: {
    format: "Formula 1 Executive Hospitality", location: "Miami, FL", target_guests: 10, acceptance_rate: 50,
    personas: ["CTO", "CIO", "SVP Engineering", "VP Engineering", "Executive Vice President", "Chief AI Officer", "Senior Vice President Engineering"],
    geography: "nationwide", cities: [], min_seniority: "vp", tiers: ["Tier 1"], outreach_lead: "exec",
    exec_name: "Guillermo Rauch", select_by: "2026-11-18",
    sequence: [
      {
        day: 0, channel: "Email", sender: "Exec", subject: "{first_name}, a seat for you at the Miami Grand Prix",
        body: "Hi {first_name},\n\nVercel is hosting a small group of technology leaders at the Miami Grand Prix on {date}. We have ten seats, and I'd like one of them to be yours.\n\nShall I hold a seat for you?\n\n{sender_name}",
      },
      {
        day: 9, channel: "Email", sender: "Exec", subject: "Re: {first_name}, a seat for you at the Miami Grand Prix",
        body: "Hi {first_name},\n\nFollowing up on the Grand Prix. A few of the guests are working through how to get AI apps and agents from pilot to production safely, and I think the conversation would be worth your evening even before the race starts.\n\nIf the dates work, I'll hold a seat for {account}.\n\n{sender_name}",
      },
      {
        day: 14, channel: "Email", sender: "Exec", subject: "Last seats for the Miami Grand Prix",
        body: "Hi {first_name},\n\nWe're confirming the last seats in Vercel's Miami Grand Prix suite this week. If you'd like to join us on {date}, reply here and I'll take care of the details.\n\n{sender_name}",
      },
    ],
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
// (picked on the Invites page) when the account has no AE.
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


