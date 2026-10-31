import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";

// Row types mirror the tables in supabase/migrations. CRM rows are Salesforce objects keyed by 18-character IDs.
// A Snapshot is every table, loaded at once (the sample data is a few hundred rows; derivation happens in lib/derive.ts).

export type User = { id: string; first_name: string; last_name: string; email: string | null; title: string | null; department: string | null };
export type Account = {
  id: string; name: string; website: string | null; industry: string | null; employees: number | null; type: string | null; owner_id: string | null;
  target_account: boolean | null; icp_tier: string | null; vertical: string | null; horizontals: string[]; est_first_year_value: number | null;
};
export type Contact = {
  id: string; first_name: string; last_name: string; email: string | null; title: string | null; account_id: string | null; owner_id: string | null;
  linkedin_url: string | null; intro_program: string | null; employment_status: string | null;
};
export type Opportunity = {
  id: string; name: string; account_id: string | null; owner_id: string | null; stage: string | null; amount: number | null;
  close_date: string | null; is_closed: boolean; is_won: boolean; last_activity: string | null;
};
export type OpportunityContactRole = { id: string; opportunity_id: string; contact_id: string; role: string | null; is_primary: boolean };
export type Activity = {
  id: string; kind: "task" | "event"; subtype: "Email" | "Call" | "Meeting"; occurred_at: string; direction: string | null;
  owner_id: string | null; contact_id: string | null; account_id: string | null; source: string | null;
};
export type Campaign = { id: string; name: string; type: string | null; start_date: string | null; status: string | null };
export type CampaignMember = { campaign_id: string; contact_id: string; status: string | null; invite_status: string | null; seat: number | null };
export type TeamlinkConnection = { captured_at: string | null; contact_id: string; user_id: string; seat_type: string | null; degree: string | null; capture_method: string | null };
// The Swarm's warm-intro response, trimmed to what Seatbook reads. closeness and detail are added in Clay.
export type SwarmSource = {
  origin: "work_overlap" | "shared_org" | "linkedin_connection";
  shared_company?: string; overlap_start_date?: string; overlap_end_date?: string | null; detail?: string;
  closeness?: "same_team" | "reporting_line" | "same_company";
};
export type SwarmConnection = { connector_name: string; connector_linkedin_url: string; connector_current_company_name: string; sources: SwarmSource[] };
export type ClayEnrichment = {
  contact_id: string; campaign_id: string; requested_at: string | null;
  work_history: { company: string; title: string; start: string; end: string | null }[];
  warm_intro_paths: { profile: { full_name: string; linkedin_url: string }; connections: SwarmConnection[] };
};
export type VercelTeam = {
  id: string; name: string; account_id: string; plan: string | null; active_users_30d: number | null; monthly_spend: number | null;
  key_contact_email: string | null; key_contact_name: string | null; key_contact_title: string | null; key_contact_id: string | null;
};
export type EventRow = { campaign_id: string; slug: string; short_name: string; program: string | null; seats: number; host_user_ids: string[]; slack_channel: string | null };
export type Confirmation = {
  asked_at: string | null; method: "slack_dm" | "slack_dm_customer_ae" | "slack_channel"; asked_to: string | null; target_contact_id: string;
  connector_ref: string; answer: string | null; answered_by: string | null; answered_at: string | null;
};
export type ConnectorLoad = { connector_name: string; connector_type: string | null; monthly_cap: number; used: number; resets: string | null };

export type Snapshot = {
  users: User[]; accounts: Account[]; contacts: Contact[]; opportunities: Opportunity[]; opportunity_contact_roles: OpportunityContactRole[];
  activities: Activity[]; campaigns: Campaign[]; campaign_members: CampaignMember[]; teamlink_connections: TeamlinkConnection[];
  clay_enrichments: ClayEnrichment[]; vercel_teams: VercelTeam[]; events: EventRow[]; connector_confirmations: Confirmation[]; connector_load: ConnectorLoad[];
};

// In foreign-key order, so the seed can insert them as listed.
export const tables = [
  "users", "accounts", "contacts", "opportunities", "opportunity_contact_roles", "activities", "campaigns", "campaign_members",
  "teamlink_connections", "clay_enrichments", "vercel_teams", "events", "connector_confirmations", "connector_load",
] as const satisfies readonly (keyof Snapshot)[];

// Cached for a minute, then refreshed in the background, so new Slack answers show within a minute.
// Reads Supabase when it's configured; otherwise the sample CSVs through the same mapping that seeds the database.
export async function loadSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheLife("minutes");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return (await import("./csv")).loadSampleSnapshot();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const results = await Promise.all(tables.map((t) => supabase.from(t).select("*")));
  return Object.fromEntries(
    results.map(({ data, error }, i) => {
      if (error) throw new Error(`Loading ${tables[i]}: ${error.message}`);
      return [tables[i], data];
    })
  ) as Snapshot;
}
