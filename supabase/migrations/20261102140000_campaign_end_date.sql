-- Salesforce Campaign EndDate: multi-day events (a race weekend) have an end date; one-day events leave it null.
alter table campaigns add column end_date date;
