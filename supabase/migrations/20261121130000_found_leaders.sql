-- Find More Executives also saves new technical leaders outside the target personas; their persona is null.
alter table sumble_found_execs alter column persona drop not null;
