-- Account signals are gone: AI initiatives are dropped, and new leaders show on Find More Executives results, which now
-- carry when each person's current role began.
drop table sumble_account_signals;
alter table sumble_found_execs add column started text; -- "2026-03"
