-- Seatbook schema. CRM tables mirror Salesforce objects (18-character Salesforce IDs as text keys);
-- TeamLink, Clay, Vercel product data and Seatbook's own tables reference them.
-- Routes, strength and ranking are derived in the app (lib/derive.ts), not stored.

-- Salesforce
create table users (
  id text primary key,
  first_name text not null,
  last_name text not null,
  email text,
  title text,
  department text
);

create table accounts (
  id text primary key,
  name text not null,
  website text,
  industry text,
  employees int,
  type text,                         -- Customer | Prospect
  owner_id text references users,
  target_account boolean,
  icp_tier text,
  segment text,                      -- Majors | Commercial
  vertical text,
  horizontals text[] not null default '{}',
  est_first_year_value int,
  nextjs_job_posts int               -- NextJS_Job_Posts__c: job posts naming Next.js in the last year, synced from Sumble
);

create table contacts (
  id text primary key,
  first_name text not null,
  last_name text not null,
  email text,
  title text,
  account_id text references accounts,
  owner_id text references users,
  linkedin_url text,
  intro_program text,                -- Intro_Program__c
  employment_status text,            -- Employment_Status__c: Current | Former
  mailing_city text,
  mailing_state text,
  mailing_latitude double precision, -- geocoded by Salesforce from the mailing address
  mailing_longitude double precision,
  has_opted_out_of_email boolean not null default false
);

create table opportunities (
  id text primary key,
  name text not null,
  account_id text references accounts,
  owner_id text references users,
  stage text,
  amount int,
  close_date date,
  is_closed boolean,
  is_won boolean,
  last_activity date
);

create table opportunity_contact_roles (
  id text primary key,
  opportunity_id text references opportunities,
  contact_id text references contacts,
  role text,                         -- e.g. Champion, Decision Maker
  is_primary boolean
);

-- Tasks (emails, calls) and Events (meetings) in one table, tagged by the tool that logged them.
create table activities (
  id text primary key,
  kind text not null,                -- task | event
  subtype text not null,             -- Email | Call | Meeting
  occurred_at timestamptz not null,
  direction text,                    -- Inbound | Outbound (emails)
  owner_id text references users,
  contact_id text references contacts,
  account_id text references accounts,
  source text                        -- Outreach | Gong | Calendar
);

create table campaigns (
  id text primary key,
  name text not null,
  type text,
  start_date date,
  status text
);

create table campaign_members (
  campaign_id text references campaigns,
  contact_id text references contacts,
  status text,                       -- Invited | Registered | Attended | Declined
  invite_status text,                -- Invite_Status__c, e.g. "Pending — intro requested"
  seat int,
  primary key (campaign_id, contact_id)
);

-- TeamLink (manual capture from Sales Navigator)
create table teamlink_connections (
  captured_at date,
  contact_id text references contacts,
  user_id text references users,
  seat_type text,
  degree text,
  capture_method text,
  primary key (contact_id, user_id)
);

-- Clay (posted back to Seatbook by the table's HTTP API column)
create table clay_enrichments (
  contact_id text references contacts,
  campaign_id text references campaigns,
  requested_at timestamptz,
  work_history jsonb not null default '[]',
  warm_intro_paths jsonb not null,
  primary key (contact_id, campaign_id)
);

-- Vercel product/billing export (warehouse): one row per team, with its key contact
create table vercel_teams (
  id text primary key,
  name text not null,
  account_id text references accounts,
  plan text,
  active_users_30d int,
  monthly_spend int,
  key_contact_email text,
  key_contact_name text,
  key_contact_title text,
  key_contact_id text references contacts  -- matched by email; null when not in Salesforce
);

-- Seatbook-owned
create table events (
  campaign_id text primary key references campaigns,
  slug text unique not null,
  short_name text not null,
  program text,
  seats int,                         -- null when the capacity isn't set
  host_user_ids text[] not null default '{}',
  slack_channel text
);

create table connector_confirmations (
  id serial primary key,
  asked_at timestamptz,
  method text not null,              -- slack_dm | slack_dm_customer_ae | slack_channel
  asked_to text,
  target_contact_id text references contacts,
  connector_ref text not null,       -- user:<id> | contact:<id>
  answer text,                       -- null until answered
  answered_by text,
  answered_at timestamptz
);

create table connector_load (
  connector_name text primary key,
  connector_type text,
  monthly_cap int not null,
  used int not null,
  resets date
);

-- The app reads with the public anon key: select only.
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'accounts', 'contacts', 'opportunities', 'opportunity_contact_roles', 'activities', 'campaigns', 'campaign_members',
    'teamlink_connections', 'clay_enrichments', 'vercel_teams', 'events', 'connector_confirmations', 'connector_load'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select on %I to anon, authenticated', t);
    execute format('create policy "Read for everyone" on %I for select using (true)', t);
  end loop;
end $$;
