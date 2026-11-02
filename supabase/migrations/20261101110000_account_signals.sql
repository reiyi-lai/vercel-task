-- Account signals: why an account matters right now. Fetched per account and shared across events:
-- hiring from Sumble job posts, leadership changes from Sumble people, initiatives from web research (Claude).
create table account_signals (
  id serial primary key,
  account_id text not null references accounts,
  category text not null,            -- hiring | leadership | initiative
  theme text,                        -- Apps & Agents | Software Factories | Agentic Commerce
  title text not null,
  detail text,
  signal_date date not null,
  url text,
  source text not null,              -- Sumble job posts | Sumble people | Web research | Sample data
  person_linkedin_url text,          -- leadership signals: the leader, to match a CRM contact
  fetched_at timestamptz not null default now()
);

-- Executives chosen to invite, per event, on the account plan.
create table invitation_selections (
  campaign_id text references campaigns,
  contact_id text references contacts,
  selected_at timestamptz not null default now(),
  primary key (campaign_id, contact_id)
);

do $$
declare t text;
begin
  foreach t in array array['account_signals', 'invitation_selections'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select on %I to anon, authenticated', t);
    execute format('create policy "Read for everyone" on %I for select using (true)', t);
  end loop;
end $$;
