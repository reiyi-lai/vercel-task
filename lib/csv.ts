import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import type { Snapshot } from "./data";

// Maps the sample exports (Salesforce, Vercel and Seatbook CSVs) onto the database tables.
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
    owner_id: str(r.OwnerId), linkedin_url: str(r.LinkedIn_URL__c), employment_status: str(r.Employment_Status__c),
    mailing_city: str(r.MailingCity), mailing_state: str(r.MailingState), has_opted_out_of_email: bool(r.HasOptedOutOfEmail),
  }));

  const sequences = JSON.parse(readFileSync(join(root, "seatbook/event_sequences.json"), "utf8")) as Record<string, Snapshot["events"][number]["sequence"]>;

  return {
    users: read("salesforce/User.csv").map((r) => ({
      id: r.Id, first_name: r.FirstName, last_name: r.LastName, email: str(r.Email), title: str(r.Title),
    })),
    accounts: read("salesforce/Account.csv").map((r) => ({
      id: r.Id, name: r.Name, website: str(r.Website), industry: str(r.Industry), employees: num(r.NumberOfEmployees), type: str(r.Type),
      owner_id: str(r.OwnerId), target_account: bool(r.Target_Account__c), icp_tier: str(r.ICP_Tier__c), vertical: str(r.Vertical__c),
      horizontals: list(r.Horizontal_Themes__c),
    })),
    contacts,
    opportunities: read("salesforce/Opportunity.csv").map((r) => ({
      id: r.Id, name: r.Name, account_id: str(r.AccountId), owner_id: str(r.OwnerId), stage: str(r.StageName), amount: num(r.Amount),
      is_closed: bool(r.IsClosed), is_won: bool(r.IsWon),
    })),
    opportunity_contact_roles: read("salesforce/OpportunityContactRole.csv").map((r) => ({
      id: r.Id, opportunity_id: r.OpportunityId, contact_id: r.ContactId, role: str(r.Role),
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
    campaigns: read("salesforce/Campaign.csv").map((r) => ({ id: r.Id, name: r.Name, type: str(r.Type), start_date: str(r.StartDate), end_date: str(r.EndDate), status: str(r.Status) })),
    campaign_members: read("salesforce/CampaignMember.csv").map((r) => ({
      campaign_id: r.CampaignId, contact_id: r.ContactId, status: str(r.Status), invite_status: str(r.Invite_Status__c),
    })),
    vercel_teams: read("vercel/vercel_teams.csv").map((r) => ({
      id: r["Team ID"], name: r["Team Name"], account_id: r["Account ID"], plan: str(r.Plan), active_users_30d: num(r["Active Users 30d"]),
      monthly_spend: num(r["Monthly Spend USD"]), key_contact_email: str(r["Key Contact Email"]), key_contact_name: str(r["Key Contact Name"]),
      key_contact_title: str(r["Key Contact Title"]), key_contact_id: contacts.find((c) => c.email === r["Key Contact Email"])?.id ?? null,
    })),
    // Each event's display details and its brief.
    events: read("seatbook/events.csv").map((r) => {
      type Brief = Snapshot["events"][number];
      return {
        campaign_id: r["Campaign ID"], slug: r.Slug, short_name: r["Short Name"], program: str(r.Program), seats: num(r.Seats),
        host_user_ids: list(r["Host User IDs"]), format: str(r.Format), location: str(r.Location),
        verticals: list(r.Verticals), themes: list(r.Themes), personas: list(r.Personas),
        geography: r.Geography as Brief["geography"], cities: list(r.Cities), min_seniority: r["Min Seniority"] as Brief["min_seniority"],
        tiers: list(r.Tiers), tier_mode: r["Tier Mode"] as Brief["tier_mode"],
        objective: r.Objective as Brief["objective"], outreach_lead: r["Outreach Lead"] as Brief["outreach_lead"],
        target_guests: Number(r["Target Guests"]), acceptance_rate: Number(r["Acceptance Rate"]), approval_rate: Number(r["Approval Rate"]),
        sequence: sequences[r["Campaign ID"]] ?? [],
      };
    }),
    // Signals for the fictional accounts; real accounts fetch live ones on their account plan.
    account_signals: read("seatbook/sample_signals.csv").map((r) => ({
      account_id: r["Account ID"], category: r.Category as Snapshot["account_signals"][number]["category"], theme: str(r.Theme), title: r.Title,
      detail: str(r.Detail), signal_date: r.Date, url: null, source: "Sample data", person_linkedin_url: str(r["Person LinkedIn URL"]),
    })),
    found_executives: [], // found in the app
    candidates: [], // chosen and run in the app
    slack_alerts: [],
  };
}
