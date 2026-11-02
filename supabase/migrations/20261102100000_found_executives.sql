-- People Find Executives turned up at an account for an event: matching its target personas, not yet contacts.
-- Kept so the list survives a reload; a new search replaces the account's list for that event.
create table found_executives (
  campaign_id text not null references campaigns,
  account_id text not null references accounts,
  name text not null,
  title text,
  location text,
  linkedin_url text not null,
  persona text not null,             -- the target persona the title matched
  found_at timestamptz not null default now(),
  primary key (campaign_id, linkedin_url)
);

alter table found_executives enable row level security;
grant select on found_executives to anon, authenticated;
create policy "Read for everyone" on found_executives for select using (true);
