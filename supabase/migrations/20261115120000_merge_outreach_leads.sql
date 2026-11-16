-- AE-led, BDR-led and Mixed merge into one option ('mixed'): each step says whether the AE or a BDR sends it, and a
-- BDR is only needed when a step is from one. Exec sign-off stays its own option.
update events set outreach_lead = 'mixed' where outreach_lead in ('ae', 'bdr');
