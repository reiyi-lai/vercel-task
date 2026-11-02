-- Who runs each event's outreach. outreach_lead: ae (the AE sends every step; no BDR, as for F1), bdr (a BDR leads,
-- the AE adds a touch) or mixed. Each selected executive can be assigned a BDR for that event; the AE is the account's
-- owner in Salesforce.
alter table event_briefs add column outreach_lead text not null default 'ae';  -- ae | bdr | mixed
alter table invitation_selections add column bdr_id text references users;

-- Sample data: the three events' leads, and F1's last step moved from the BDR to the AE.
update event_briefs set outreach_lead = 'bdr' where campaign_id = '701Sb0000000009AAA';
update event_briefs set outreach_lead = 'mixed' where campaign_id = '701Sb0000000010AAA';
update event_briefs
  set sequence = jsonb_set(jsonb_set(sequence, '{3,sender}', '"AE"'), '{3,body}',
    to_jsonb('Hi {first_name},' || chr(10) || chr(10) || 'We''re confirming the last seats in Vercel''s Las Vegas Grand Prix suite this week. If you''d like to join us on {date}, reply here and I''ll take care of the details.' || chr(10) || chr(10) || '{sender_first_name}'))
  where campaign_id = '701Sb0000000001AAA' and jsonb_array_length(sequence) > 3;

-- Sample data: three target accounts without an AE yet, to assign on the Candidates page.
update accounts set owner_id = null where id in ('001Sb0000070039AAA', '001Sb0000070040AAA', '001Sb0000070041AAA');
update contacts set owner_id = null where account_id in ('001Sb0000070039AAA', '001Sb0000070040AAA', '001Sb0000070041AAA');
