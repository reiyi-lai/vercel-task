import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { TABLES } from "./tables";

// Row types mirror the tables in supabase/migrations. CRM rows are Salesforce objects keyed by 18-character IDs.
// A Snapshot is every table, loaded at once (the sample data is a few hundred rows; derivation happens in lib/derive.ts).

export type User = { id: string; first_name: string; last_name: string; email: string | null; title: string | null };
export type Account = {
  id: string; name: string; website: string | null; industry: string | null; employees: number | null; type: string | null; owner_id: string | null;
  target_account: boolean | null; icp_tier: string | null; vertical: string | null; horizontals: string[];
};
export type Contact = {
  id: string; first_name: string; last_name: string; email: string | null; title: string | null; account_id: string | null; owner_id: string | null;
  linkedin_url: string | null; employment_status: string | null; mailing_city: string | null; mailing_state: string | null;
  has_opted_out_of_email: boolean;
};
export type Opportunity = {
  id: string; name: string; account_id: string | null; owner_id: string | null; stage: string | null; amount: number | null;
  is_closed: boolean; is_won: boolean;
};
export type OpportunityContactRole = { id: string; opportunity_id: string; contact_id: string; role: string | null };
export type Activity = {
  id: string; kind: "task" | "event"; subtype: "Email" | "Call" | "Meeting"; occurred_at: string; direction: string | null;
  owner_id: string | null; contact_id: string | null; account_id: string | null; source: string | null;
};
export type Campaign = { id: string; name: string; type: string | null; start_date: string | null; end_date: string | null; status: string | null };
export type CampaignMember = { campaign_id: string; contact_id: string; status: string | null; invite_status: string | null };
// A Vercel team on the account. key_contact_*: its billing owner, the person who pays for the plan.
export type VercelTeam = {
  id: string; name: string; account_id: string; plan: string | null; active_users_30d: number | null; monthly_spend: number | null;
  key_contact_email: string | null; key_contact_name: string | null; key_contact_title: string | null; key_contact_id: string | null;
};
// One step of an event's outreach sequence: when (days after the sequence starts), how, who sends it, and its template
// copy with placeholders (lib/sequence.ts fills them).
export type SequenceStep = { day: number; channel: "Email" | "LinkedIn" | "Phone"; sender: "AE" | "BDR"; subject: string; body: string };

// An event's brief: who to find, how to rank them, how many to invite, and its outreach sequence (lib/brief.ts has the
// labels and sizing).
export type EventBrief = {
  campaign_id: string; format: string | null; location: string | null;
  verticals: string[]; themes: string[]; personas: string[];
  geography: "city" | "conference" | "nationwide"; cities: string[];
  min_seniority: "c_suite" | "svp" | "vp" | "director"; // a hard gate
  tiers: string[]; tier_mode: "prefer" | "only";
  objective: "balanced" | "pipeline" | "net_new";
  outreach_lead: "ae" | "bdr" | "mixed"; // ae: the AE sends every step, no BDR (F1)
  target_guests: number; acceptance_rate: number; approval_rate: number; sequence: SequenceStep[];
};
// A Seatbook event: its Salesforce campaign's display details plus its brief.
export type EventRow = EventBrief & { slug: string; short_name: string; program: string | null; seats: number | null; host_user_ids: string[] };
// Why an account matters now (lib/signals.ts fetches them). theme is one of the brief's campaign themes.
export type AccountSignal = {
  account_id: string; category: "hiring" | "leadership" | "initiative"; theme: string | null; title: string; detail: string | null;
  signal_date: string; url: string | null; source: string; person_linkedin_url: string | null;
};
// An executive selected for an event, with their outreach: the BDR assigned (null on AE-led events), when the sequence
// started, the steps sent, and how they responded.
export type Candidate = {
  campaign_id: string; contact_id: string; bdr_id: string | null; started_at: string | null;
  // drafts: edited copy saved per step before sending. sent: each step marked sent, with the copy that actually went out
  // and, from Slack, who marked it.
  drafts: Record<string, { subject: string; body: string }>;
  sent: { step: number; at: string; subject?: string; body?: string; by?: string }[]; outcome: "Replied" | "Accepted" | "Declined" | "Paused" | null; outcome_at: string | null;
};
export type SlackAlert = { id: number; campaign_id: string; contact_id: string | null; recipient: string; kind: string; text: string; posted: boolean; created_at: string };
// Find Executives results: people at an account matching an event's target personas, not yet contacts.
export type FoundExecutive = {
  campaign_id: string; account_id: string; name: string; title: string | null; location: string | null; linkedin_url: string; persona: string; found_at: string;
};
export type Snapshot = {
  users: User[]; accounts: Account[]; contacts: Contact[]; opportunities: Opportunity[]; opportunity_contact_roles: OpportunityContactRole[];
  activities: Activity[]; campaigns: Campaign[]; campaign_members: CampaignMember[]; vercel_teams: VercelTeam[]; events: EventRow[];
  account_signals: AccountSignal[]; found_executives: FoundExecutive[]; candidates: Candidate[]; slack_alerts: SlackAlert[];
};

export { TABLES } from "./tables";

// Cached for a minute, then refreshed in the background, so new Slack answers show within a minute.
// Server Actions that write expire the "snapshot" tag, so their changes show at once.
// Reads Supabase when it's configured; otherwise the sample CSVs through the same mapping that seeds the database.
export async function loadSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheLife("minutes");
  cacheTag("snapshot");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return (await import("./csv")).loadSampleSnapshot();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const entries = Object.entries(TABLES);
  const results = await Promise.all(entries.map(([, table]) => supabase.from(table).select("*")));
  return Object.fromEntries(
    results.map(({ data, error }, i) => {
      if (error) throw new Error(`Loading ${entries[i][1]}: ${error.message}`);
      return [entries[i][0], data];
    })
  ) as Snapshot;
}
