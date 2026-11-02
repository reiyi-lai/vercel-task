-- Candidates imported on an event's Candidates page. Server Actions write them with the service-role key;
-- the app reads them with the anon key like every other table.
create table candidates (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references campaigns,
  first_name text,
  last_name text,
  title text,
  company text,
  linkedin_url text,
  email text,
  sumble_person_id int,
  experience jsonb,                  -- Sumble work history, newest role first; [] when Sumble found no one
  warm_overlaps jsonb,               -- the invitation plan: warm contacts with overlapping work history; [] when none
  created_at timestamptz not null default now()
);

alter table candidates enable row level security;
grant select on candidates to anon, authenticated;
create policy "Read for everyone" on candidates for select using (true);
