-- Marketing approves each selected candidate before the AE or BDR pushes them to Outreach. Sequences already started
-- count as approved.
alter table candidates add column approved_at timestamptz;
update candidates set approved_at = started_at where started_at is not null;
