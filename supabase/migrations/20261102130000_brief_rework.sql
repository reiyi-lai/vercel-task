-- Brief rework: City-Based takes several cities instead of one city and a radius, "attending a conference" replaces
-- Regional, minimum seniority is always a hard gate, and purpose, scoring weights and search scope are retired.
alter table event_briefs add column cities text[] not null default '{}';
update event_briefs set cities = array[city] where city is not null and geography <> 'nationwide';
update event_briefs set geography = 'city' where geography = 'regional';
alter table event_briefs
  drop column city,
  drop column radius_miles,
  drop column purpose,
  drop column seniority_mode,
  drop column account_weight,
  drop column search_scope;
