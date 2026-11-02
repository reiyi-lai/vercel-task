import type { EventBrief } from "./data";

// Choices and labels for the Event Brief. Values are what event_briefs stores.

// The verticals a brief can target, as Salesforce holds them (Vertical__c), plus Cross-industry for any vertical.
export const VERTICALS = ["Retail", "Financial Services", "Cross-industry"];
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

export const GEOGRAPHY: Record<EventBrief["geography"], { label: string; detail: string }> = {
  city: { label: "City-Based", detail: "Executives located in one of the selected cities." },
  conference: { label: "Attending Selected Conference", detail: "Coming soon: Limit to list of conference attendees, through Salesforce campaign." },
  nationwide: { label: "Nationwide / Open to Travel", detail: "No location limit. Evaluate travel individually." },
};

export const SENIORITY: Record<EventBrief["min_seniority"], string> = {
  c_suite: "C-suite only",
  svp: "SVP and above",
  vp: "VP and above",
  director: "Director and above",
};

export const OBJECTIVES: Record<EventBrief["objective"], { label: string; detail: string }> = {
  balanced: { label: "Balanced: new SQOs + pipeline acceleration", detail: "Accounts shows both." },
  pipeline: { label: "Advance existing opportunities", detail: "Accounts shows only accounts with an open opportunity." },
  net_new: { label: "Generate net-new opportunities", detail: "Accounts shows only accounts without an open opportunity." },
};

// Who runs outreach. AE-led events have no BDR; BDR-led and mixed ones assign a BDR per candidate on the Candidates page.
export const OUTREACH_LEADS: Record<EventBrief["outreach_lead"], { label: string; detail: string }> = {
  ae: { label: "AE-led", detail: "The account’s AE sends every step. No BDR." },
  bdr: { label: "BDR-led", detail: "A BDR runs the sequence; the AE steps in where a step says so." },
  mixed: { label: "Mixed", detail: "The AE and a BDR each send their own steps." },
};

// Works back from the guest target: invitations needed at the expected acceptance rate, then executives to
// shortlist at the expected approval rate. Guests already confirmed in Salesforce come off the target.
export function outreachVolume(b: Pick<EventBrief, "target_guests" | "acceptance_rate" | "approval_rate">, confirmed: number) {
  const invites = Math.ceil((Math.max(0, b.target_guests - confirmed) * 100) / b.acceptance_rate);
  return { invites, shortlist: Math.ceil((invites * 100) / b.approval_rate), expected: confirmed + Math.round((invites * b.acceptance_rate) / 100) };
}

// Whether a signal's theme bears on this event. Hiring and leadership signals carry campaign themes, which match
// the brief's themes directly; web-research initiatives carry their own themes, which map to its themes or verticals.
export function relevantTheme(theme: string | null, b: Pick<EventBrief, "themes" | "verticals">) {
  if (theme === "Internal Software") return b.themes.includes("Apps & Agents") || b.themes.includes("Software Factories");
  if (theme === "Retail/Agentic Commerce") return b.verticals.includes("Retail");
  if (theme === "Financial Services") return b.verticals.includes("Financial Services");
  return !!theme && b.themes.includes(theme);
}

