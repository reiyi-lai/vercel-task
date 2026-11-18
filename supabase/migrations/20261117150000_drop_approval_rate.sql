-- Briefs no longer plan a shortlist approval rate.
alter table events drop column approval_rate;
