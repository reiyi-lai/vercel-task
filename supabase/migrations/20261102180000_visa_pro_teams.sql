-- Sample Pro teams at Visa, matching data/vercel/vercel_teams.csv.
insert into vercel_teams (id, name, account_id, plan, active_users_30d, monthly_spend, key_contact_title) values
  ('team_visa_devx', 'visa-developer-experience', '001Sb0000070019AAA', 'Pro', 6, 480, 'Director, Developer Experience'),
  ('team_visa_acceptance', 'visa-acceptance-demos', '001Sb0000070019AAA', 'Pro', 3, 240, 'Senior Solutions Engineer')
on conflict (id) do nothing;
