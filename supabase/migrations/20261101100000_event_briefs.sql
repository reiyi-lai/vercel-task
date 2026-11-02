-- Event briefs: each event's targeting, prioritization and planning settings, edited on its Brief tab.
-- Server Actions write them with the service-role key; the app reads them with the anon key.
create table event_briefs (
  campaign_id text primary key references campaigns,
  format text,
  location text,
  purpose text,
  verticals text[] not null default '{}',
  themes text[] not null default '{}',
  personas text[] not null default '{}',
  geography text not null,           -- city | regional | nationwide
  city text,
  radius_miles int,
  min_seniority text not null,       -- c_suite | svp | vp | director
  seniority_mode text not null,      -- preference | gate
  segment text not null,             -- both | majors | commercial
  tiers text[] not null default '{}',
  tier_mode text not null,           -- prefer | only
  objective text not null,           -- balanced | pipeline | net_new
  account_weight int not null,       -- percent; executive relevance gets the rest
  search_scope text not null,        -- crm_clay | crm
  target_guests int not null,
  acceptance_rate int not null,      -- percent of invitations expected to be accepted
  approval_rate int not null         -- percent of shortlisted executives expected to be approved for outreach
);

alter table event_briefs enable row level security;
grant select on event_briefs to anon, authenticated;
create policy "Read for everyone" on event_briefs for select using (true);
