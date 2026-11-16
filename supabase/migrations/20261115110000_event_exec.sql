-- The Vercel exec signing off an event's Exec steps, set on the brief. A candidate's own exec_name overrides it.
alter table events add column exec_name text;
