-- Schema cleanup: one row per candidate, one row per event, unused columns dropped, and tables named for their source.

-- 1. invitation_selections + outreach -> candidates: one row per executive selected for an event, with their sequence.
create table candidates (
  campaign_id text not null references campaigns,
  contact_id text not null references contacts,
  bdr_id text references users,         -- the BDR sending BDR steps; null on AE-led events
  selected_at timestamptz not null default now(),
  started_at timestamptz,               -- null until the sequence starts
  drafts jsonb not null default '{}',   -- { step: { subject, body } }: edits saved before sending
  sent jsonb not null default '[]',     -- [{ step, at, subject?, body?, by? }]
  outcome text,                         -- Replied | Accepted | Declined | Paused
  outcome_at timestamptz,
  primary key (campaign_id, contact_id)
);
insert into candidates (campaign_id, contact_id, bdr_id, selected_at, started_at, drafts, sent, outcome, outcome_at)
select s.campaign_id, s.contact_id, s.bdr_id, s.selected_at, o.started_at, coalesce(o.drafts, '{}'), coalesce(o.sent, '[]'), o.outcome, o.outcome_at
from invitation_selections s left join outreach o using (campaign_id, contact_id);
alter table candidates enable row level security;
grant select on candidates to anon, authenticated;
create policy "Read for everyone" on candidates for select using (true);
drop table outreach, invitation_selections;

-- 2. event_briefs -> events: an event's setup and its brief share one row.
alter table events
  add column format text,
  add column location text,
  add column verticals text[] not null default '{}',
  add column themes text[] not null default '{}',
  add column personas text[] not null default '{}',
  add column geography text not null default 'city',            -- city | conference | nationwide
  add column cities text[] not null default '{}',
  add column min_seniority text not null default 'vp',          -- c_suite | svp | vp | director
  add column tiers text[] not null default '{}',
  add column tier_mode text not null default 'prefer',          -- prefer | only
  add column objective text not null default 'balanced',        -- balanced | pipeline | net_new
  add column outreach_lead text not null default 'ae',          -- ae | bdr | mixed
  add column target_guests int not null default 0,
  add column acceptance_rate int not null default 0,            -- percent of invitations expected to be accepted
  add column approval_rate int not null default 0,              -- percent of shortlisted executives expected to be approved
  add column sequence jsonb not null default '[]';              -- [{ day, channel, sender, subject, body }]
update events e set
  format = b.format, location = b.location, verticals = b.verticals, themes = b.themes, personas = b.personas,
  geography = b.geography, cities = b.cities, min_seniority = b.min_seniority, tiers = b.tiers, tier_mode = b.tier_mode,
  objective = b.objective, outreach_lead = b.outreach_lead, target_guests = b.target_guests,
  acceptance_rate = b.acceptance_rate, approval_rate = b.approval_rate, sequence = b.sequence
from event_briefs b where b.campaign_id = e.campaign_id;
drop table event_briefs;

-- The Personalized Line is gone: drop its placeholder (and the blank line before it) from the templates.
update events set sequence = replace(sequence::text, '\n\n{personal_line}', '')::jsonb;

-- 3. Columns nothing reads.
alter table accounts drop column nextjs_job_posts, drop column est_first_year_value;
alter table contacts drop column intro_program, drop column mailing_latitude, drop column mailing_longitude;
alter table opportunities drop column close_date, drop column last_activity;
alter table opportunity_contact_roles drop column is_primary;
alter table campaign_members drop column seat;
alter table users drop column department;
alter table events drop column slack_channel;

-- 4. Name tables for their source: Salesforce mirrors and Sumble/research results.
alter table users rename to salesforce_users;
alter table accounts rename to salesforce_accounts;
alter table contacts rename to salesforce_contacts;
alter table opportunities rename to salesforce_opportunities;
alter table opportunity_contact_roles rename to salesforce_opportunity_contact_roles;
alter table activities rename to salesforce_activities;
alter table campaigns rename to salesforce_campaigns;
alter table campaign_members rename to salesforce_campaign_members;
alter table account_signals rename to sumble_account_signals;
alter table found_executives rename to sumble_found_execs;
