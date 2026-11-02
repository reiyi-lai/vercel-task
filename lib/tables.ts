import type { Snapshot } from "./data";

// Kept apart from data.ts so scripts/seed.ts can load it outside Next.js.
// Each Snapshot key's table, named for its source, in foreign-key order so the seed can insert them as listed.
export const TABLES = {
  users: "salesforce_users", accounts: "salesforce_accounts", contacts: "salesforce_contacts", opportunities: "salesforce_opportunities",
  opportunity_contact_roles: "salesforce_opportunity_contact_roles", activities: "salesforce_activities", campaigns: "salesforce_campaigns",
  campaign_members: "salesforce_campaign_members", vercel_teams: "vercel_teams", events: "events",
  account_signals: "sumble_account_signals", found_executives: "sumble_found_execs", candidates: "candidates", slack_alerts: "slack_alerts",
} as const satisfies Record<keyof Snapshot, string>;
