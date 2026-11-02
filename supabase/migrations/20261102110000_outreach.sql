-- Outreach sequencing. Each event's brief holds its sequence: the steps and their template copy. Each selected executive
-- gets an outreach row tracking their personalized line, which steps went out, and how they responded. Slack alerts
-- go to the AE or BDR when something needs them, and are kept for the in-app feed.
alter table event_briefs add column sequence jsonb not null default '[]';  -- [{ day, channel, sender, subject, body }]

create table outreach (
  campaign_id text not null references campaigns,
  contact_id text not null references contacts,
  personal_line text,
  line_signal text,                  -- the signal the personalized line draws on
  started_at timestamptz,            -- null until the sequence starts
  sent jsonb not null default '[]',  -- [{ step, at }]: steps marked sent
  outcome text,                      -- Replied | Accepted | Declined | Paused
  outcome_at timestamptz,
  primary key (campaign_id, contact_id)
);

create table slack_alerts (
  id serial primary key,
  campaign_id text not null references campaigns,
  contact_id text references contacts,
  recipient text not null,           -- who it's for: the AE or BDR
  kind text not null,                -- Started | Reply | Accepted | Declined | Due
  text text not null,
  posted boolean not null default false,  -- also posted to Slack through SLACK_WEBHOOK_URL
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['outreach', 'slack_alerts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select on %I to anon, authenticated', t);
    execute format('create policy "Read for everyone" on %I for select using (true)', t);
  end loop;
end $$;
