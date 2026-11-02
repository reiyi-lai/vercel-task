import type { EventBrief } from "./data";

// Choices and labels for the Event Brief. Values are what event_briefs stores.

// Account verticals as Salesforce holds them (Vertical__c), plus Cross-industry for any vertical.
export const VERTICALS = ["Retail", "Financial Services", "Healthcare", "Transportation & Logistics", "Cross-industry"];
export const THEMES = ["Apps & Agents", "Software Factories", "Agentic Commerce"];
// Event cities with coordinates, to measure how far each contact's mailing address is.
export const CITIES: Record<string, { lat: number; lon: number }> = {
  "Las Vegas, NV": { lat: 36.1699, lon: -115.1398 },
  "New York, NY": { lat: 40.7128, lon: -74.006 },
  "San Francisco, CA": { lat: 37.7749, lon: -122.4194 },
  "Miami, FL": { lat: 25.7617, lon: -80.1918 },
  "Austin, TX": { lat: 30.2672, lon: -97.7431 },
  "Chicago, IL": { lat: 41.8781, lon: -87.6298 },
  "Seattle, WA": { lat: 47.6062, lon: -122.3321 },
};
export const RADII = [25, 50, 100, 250];
export const TIERS = ["Tier 1", "Tier 2", "Tier 3"];

export const GEOGRAPHY: Record<EventBrief["geography"], { label: string; detail: string }> = {
  city: { label: "City-Based", detail: "Prioritize executives based in the selected city or immediate metro area." },
  regional: { label: "Regional", detail: "Include executives within a selected distance of the city." },
  nationwide: { label: "Nationwide / Open to Travel", detail: "No hard location gate. Evaluate travel suitability individually." },
};

export const SENIORITY: Record<EventBrief["min_seniority"], string> = {
  c_suite: "C-suite only",
  svp: "SVP and above",
  vp: "VP and above",
  director: "Director and above",
};

export const OBJECTIVES: Record<EventBrief["objective"], { label: string; detail: string }> = {
  balanced: { label: "Balanced: new SQOs + pipeline acceleration", detail: "Balance high-value new relationships with opportunities already in progress." },
  pipeline: { label: "Advance existing opportunities", detail: "Prioritize accounts with active opportunities and executives who could help advance those deals." },
  net_new: { label: "Generate net-new opportunities", detail: "Prioritize strategic target accounts with no current opportunity, while keeping relevant existing relationships." },
};

export const SEARCH_SCOPE: Record<EventBrief["search_scope"], string> = {
  crm_clay: "Existing CRM contacts + discover missing executives via Clay",
  crm: "Existing CRM contacts only",
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
  if (theme === "Retail/Agentic Commerce") return b.themes.includes("Agentic Commerce") || b.verticals.includes("Retail");
  if (theme === "Financial Services") return b.verticals.includes("Financial Services");
  return !!theme && b.themes.includes(theme);
}

// The one-line industry angle on an account plan: why this vertical cares about building with AI now.
export const INDUSTRY_ANGLE: Record<string, string> = {
  Retail: "Retailers are moving AI into search, checkout and service, where storefront speed and safe releases decide conversion.",
  "Financial Services": "Banks and insurers want internal agents and AI-built apps, but only with the access controls and audit trails regulators expect.",
  Healthcare: "Health systems are piloting clinical and admin agents, where patient-data controls decide what reaches production.",
  "Transportation & Logistics": "Logistics operators are building internal tools and agents for dispatch and visibility, often on legacy systems that slow every release.",
};
