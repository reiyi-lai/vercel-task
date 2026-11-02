-- Majors vs Commercial is Vercel's enterprise vs self-serve split, not a useful event filter, so it's retired.
alter table accounts drop column segment;
alter table event_briefs drop column segment;
