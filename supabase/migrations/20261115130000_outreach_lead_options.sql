-- Three outreach leads, each setting who sends every step: exec (AE-led with exec sign-off), bdr (BDR-led only) and
-- ae_bdr (the account's AE, or a BDR when it has none). Vertical ABM (NRF) is AE/BDR-led; horizontal ABM (the dinner)
-- is BDR-led.
update events set outreach_lead = case slug when 'ai-builder-dinner' then 'bdr' else 'ae_bdr' end where outreach_lead <> 'exec';
update events set sequence = (
  select coalesce(jsonb_agg(step || jsonb_build_object('sender', case outreach_lead when 'exec' then 'Exec' when 'bdr' then 'BDR' else 'AE' end) order by i), '[]')
  from jsonb_array_elements(sequence) with ordinality as t(step, i)
);
