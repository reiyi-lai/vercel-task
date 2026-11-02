-- Warm contacts: customer leaders, Vercel executives, board members and investors whose work history
-- (from Sumble's People API) is matched against each candidate's to find overlaps.
create table warm_contacts (
  id serial primary key,
  name text not null,
  title text,
  company text,
  sumble_org_id int,
  linkedin_url text unique,          -- the key for Sumble's People API; null until found
  warm_type text not null,           -- customer_leader | vercel_executive | board_member | investor | angel
  route text not null,               -- the invitation route an overlap with them opens
  source text,
  experience jsonb                   -- Sumble People API work history, newest role first
);

alter table warm_contacts enable row level security;
grant select on warm_contacts to anon, authenticated;
create policy "Read for everyone" on warm_contacts for select using (true);
