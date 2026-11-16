-- F1 outreach goes out from a Vercel exec's own email, drafted by the AE. The exec isn't a Salesforce user, so each
-- candidate carries their name as typed on the Candidates page.
alter table candidates add column exec_name text;

-- Outreach leads by format: F1 is AE-led with exec sign-off (every step from the exec), vertical ABM is AE and BDR,
-- horizontal ABM is BDR-led.
update events set outreach_lead = 'exec',
  sequence = (select jsonb_agg(step || '{"sender": "Exec"}' order by i) from jsonb_array_elements(sequence) with ordinality as t(step, i))
where slug = 'lvgp';
update events set outreach_lead = 'mixed' where slug = 'nrf-breakfast';
update events set outreach_lead = 'bdr' where slug = 'ai-builder-dinner';
