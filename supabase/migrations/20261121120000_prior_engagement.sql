-- Five contacts at accounts that fit the briefs get prior engagement, one of each kind, so the Contacts page shows both
-- warm and cold executives. The rest stay cold.
insert into salesforce_campaign_members (campaign_id, contact_id, status, invite_status) values
  ('701Sb0000000009AAA', '003Sb0000090023AAA', 'Attended', 'Confirmed'),  -- Jason Morris, Nordstrom: attended NRF breakfast
  ('701Sb0000000005AAA', '003Sb0000090052AAA', 'Invited', 'Declined');    -- Kelly Garcia, Ulta Beauty: invited to a roundtable

insert into salesforce_activities (id, kind, subtype, occurred_at, direction, owner_id, contact_id, account_id, source) values
  -- Awah Teh, Capital One: replied to an email
  ('00TSb0000001031AAA', 'task', 'Email', '2026-08-04T09:30:00.000Z', 'Outbound', '005Sb0000050001AAA', '003Sb0000090061AAA', '001Sb0000070021AAA', 'Outreach'),
  ('00TSb0000001032AAA', 'task', 'Email', '2026-08-05T16:10:00.000Z', 'Inbound', '005Sb0000050001AAA', '003Sb0000090061AAA', '001Sb0000070021AAA', 'Outreach'),
  -- Yunyan Wang, Chewy: a meeting
  ('00USb0000001025AAA', 'event', 'Meeting', '2026-07-14T15:00:00.000Z', null, '005Sb0000050002AAA', '003Sb0000090056AAA', '001Sb0000070031AAA', 'Gong');

-- Subash Narasimhan, Chewy: billing owner of a Pro team
update vercel_teams set key_contact_email = null, key_contact_name = 'Subash Narasimhan', key_contact_title = 'Vice President of Software Engineering', key_contact_id = '003Sb0000090057AAA'
where id = 'team_chewy_web';
