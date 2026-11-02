import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import type { Snapshot } from "./data";
import type { SumblePerson } from "./sumble";

// Maps the sample exports (Salesforce, TeamLink, Clay, Vercel, Seatbook CSVs) onto the database tables.
// Used by scripts/seed.ts to build supabase/seed.sql, and by tests to run derive.ts without a database.

const str = (s: string) => (s === "" ? null : s);
const num = (s: string) => (s === "" ? null : Number(s));
const list = (s: string) => (s === "" ? [] : s.split(";"));
const bool = (s: string) => s === "true";
const ts = (s: string) => (s === "" ? null : new Date(`${s.replace(" ", "T")}${s.length > 10 ? "Z" : "T00:00Z"}`).toISOString());

export function loadSampleSnapshot(root = join(process.cwd(), "data")): Snapshot {
  const read = (file: string): Record<string, string>[] => parse(readFileSync(join(root, file)), { columns: true });
  const contacts = read("salesforce/Contact.csv").map((r) => ({
    id: r.Id, first_name: r.FirstName, last_name: r.LastName, email: str(r.Email), title: str(r.Title), account_id: str(r.AccountId),
    owner_id: str(r.OwnerId), linkedin_url: str(r.LinkedIn_URL__c), intro_program: str(r.Intro_Program__c), employment_status: str(r.Employment_Status__c),
    mailing_city: str(r.MailingCity), mailing_state: str(r.MailingState), mailing_latitude: num(r.MailingLatitude), mailing_longitude: num(r.MailingLongitude),
    has_opted_out_of_email: bool(r.HasOptedOutOfEmail),
  }));

  // Work histories fetched by scripts/sumble-warm-contacts.ts, keyed by the LinkedIn URL Sumble was asked about.
  const sumble = JSON.parse(readFileSync(join(root, "sumble/warm_contacts_experience.json"), "utf8")) as SumblePerson[];
  const sequences = JSON.parse(readFileSync(join(root, "connector_info/event_sequences.json"), "utf8")) as Record<string, Snapshot["event_briefs"][number]["sequence"]>;
  const experience = new Map(sumble.map((p) => [p.input!.linkedin_url, p.attributes?.experience ?? null]));

  return {
    users: read("salesforce/User.csv").map((r) => ({
      id: r.Id, first_name: r.FirstName, last_name: r.LastName, email: str(r.Email), title: str(r.Title), department: str(r.Department),
    })),
    accounts: read("salesforce/Account.csv").map((r) => ({
      id: r.Id, name: r.Name, website: str(r.Website), industry: str(r.Industry), employees: num(r.NumberOfEmployees), type: str(r.Type),
      owner_id: str(r.OwnerId), target_account: bool(r.Target_Account__c), icp_tier: str(r.ICP_Tier__c), segment: str(r.Segment__c) as Snapshot["accounts"][number]["segment"], vertical: str(r.Vertical__c),
      horizontals: list(r.Horizontal_Themes__c), est_first_year_value: num(r.Est_First_Year_Value__c),
      nextjs_job_posts: num(r.NextJS_Job_Posts__c),
    })),
    contacts,
    opportunities: read("salesforce/Opportunity.csv").map((r) => ({
      id: r.Id, name: r.Name, account_id: str(r.AccountId), owner_id: str(r.OwnerId), stage: str(r.StageName), amount: num(r.Amount),
      close_date: str(r.CloseDate), is_closed: bool(r.IsClosed), is_won: bool(r.IsWon), last_activity: str(r.LastActivityDate),
    })),
    opportunity_contact_roles: read("salesforce/OpportunityContactRole.csv").map((r) => ({
      id: r.Id, opportunity_id: r.OpportunityId, contact_id: r.ContactId, role: str(r.Role), is_primary: bool(r.IsPrimary),
    })),
    // Tasks (emails logged by Outreach) and Events (meetings logged by Gong) share one table.
    activities: [
      ...read("salesforce/Task.csv").map((r) => ({
        id: r.Id, kind: "task" as const, subtype: r.TaskSubtype as "Email" | "Call", occurred_at: ts(r.CompletedDateTime)!,
        direction: str(r.Direction__c), owner_id: r.OwnerId, contact_id: r.WhoId, account_id: r.WhatId, source: r.Source__c,
      })),
      ...read("salesforce/Event.csv").map((r) => ({
        id: r.Id, kind: "event" as const, subtype: "Meeting" as const, occurred_at: ts(r.StartDateTime)!,
        direction: null, owner_id: r.OwnerId, contact_id: r.WhoId, account_id: r.WhatId, source: r.Source__c,
      })),
    ],
    campaigns: read("salesforce/Campaign.csv").map((r) => ({ id: r.Id, name: r.Name, type: str(r.Type), start_date: str(r.StartDate), status: str(r.Status) })),
    campaign_members: read("salesforce/CampaignMember.csv").map((r) => ({
      campaign_id: r.CampaignId, contact_id: r.ContactId, status: str(r.Status), invite_status: str(r.Invite_Status__c), seat: num(r.Seat__c),
    })),
    teamlink_connections: read("teamlink/teamlink_connections.csv").map((r) => ({
      captured_at: str(r["Captured At"]), contact_id: r["Matched Salesforce Contact ID"], user_id: r["Teammate User ID"],
      seat_type: str(r["Teammate Seat Type"]), degree: str(r["Connection Degree"]), capture_method: str(r["Capture Method"]),
    })),
    clay_enrichments: read("clay/clay_table_warm_paths.csv").map((r) => ({
      contact_id: r.salesforce_contact_id, campaign_id: r.event_id, requested_at: str(r.requested_at),
      work_history: JSON.parse(r["work_history (Enrich person)"]), warm_intro_paths: JSON.parse(r["warm_intro_paths (The Swarm)"]),
    })),
    vercel_teams: read("vercel/vercel_teams.csv").map((r) => ({
      id: r["Team ID"], name: r["Team Name"], account_id: r["Account ID"], plan: str(r.Plan), active_users_30d: num(r["Active Users 30d"]),
      monthly_spend: num(r["Monthly Spend USD"]), key_contact_email: str(r["Key Contact Email"]), key_contact_name: str(r["Key Contact Name"]),
      key_contact_title: str(r["Key Contact Title"]), key_contact_id: contacts.find((c) => c.email === r["Key Contact Email"])?.id ?? null,
    })),
    events: read("connector_info/events.csv").map((r) => ({
      campaign_id: r["Campaign ID"], slug: r.Slug, short_name: r["Short Name"], program: str(r.Program), seats: num(r.Seats),
      host_user_ids: list(r["Host User IDs"]), slack_channel: str(r["Slack Channel"]),
    })),
    event_briefs: read("connector_info/event_briefs.csv").map((r) => {
      type Brief = Snapshot["event_briefs"][number];
      return {
        campaign_id: r["Campaign ID"], format: str(r.Format), location: str(r.Location), purpose: str(r.Purpose),
        verticals: list(r.Verticals), themes: list(r.Themes), personas: list(r.Personas),
        geography: r.Geography as Brief["geography"], city: str(r.City), radius_miles: num(r["Radius Miles"]),
        min_seniority: r["Min Seniority"] as Brief["min_seniority"], seniority_mode: r["Seniority Mode"] as Brief["seniority_mode"],
        segment: r.Segment as Brief["segment"], tiers: list(r.Tiers), tier_mode: r["Tier Mode"] as Brief["tier_mode"],
        objective: r.Objective as Brief["objective"], account_weight: Number(r["Account Weight"]), search_scope: r["Search Scope"] as Brief["search_scope"],
        target_guests: Number(r["Target Guests"]), acceptance_rate: Number(r["Acceptance Rate"]), approval_rate: Number(r["Approval Rate"]),
        sequence: sequences[r["Campaign ID"]] ?? [],
      };
    }),
    connector_confirmations: read("connector_info/connector_confirmations.csv").map((r) => ({
      asked_at: ts(r["Asked At"]), method: r.Method as Snapshot["connector_confirmations"][number]["method"], asked_to: str(r["Asked To"]),
      target_contact_id: r["Target Contact ID"], connector_ref: r["Connector Ref"], answer: str(r.Answer),
      answered_by: str(r["Answered By"]), answered_at: ts(r["Answered At"]),
    })),
    connector_load: read("connector_info/connector_load.csv").map((r) => ({
      connector_name: r.Connector, connector_type: str(r["Connector type"]), monthly_cap: Number(r["Monthly intro cap"]),
      used: Number(r["Asks used this month"]), resets: str(r.Resets),
    })),
    warm_contacts: read("connector_info/warm_contacts.csv").map((r) => ({
      name: r.Name, title: str(r.Title), company: str(r.Company), sumble_org_id: num(r["Sumble Org ID"]), linkedin_url: str(r["LinkedIn URL"]),
      warm_type: r["Warm Type"] as Snapshot["warm_contacts"][number]["warm_type"], route: r.Route, source: str(r.Source),
      experience: experience.get(r["LinkedIn URL"]) ?? null,
    })),
    candidates: [], // imported in the app, not seeded
    // Signals for the fictional accounts; real accounts fetch live ones on their account plan.
    account_signals: read("connector_info/sample_signals.csv").map((r) => ({
      account_id: r["Account ID"], category: r.Category as Snapshot["account_signals"][number]["category"], theme: str(r.Theme), title: r.Title,
      detail: str(r.Detail), signal_date: r.Date, url: null, source: "Sample data", person_linkedin_url: str(r["Person LinkedIn URL"]),
    })),
    invitation_selections: [], // chosen in the app
    found_executives: [], // found in the app
    outreach: [], // run in the app
    slack_alerts: [],
  };
}
