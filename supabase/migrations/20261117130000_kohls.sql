-- Kohl's and two of its technology leaders (from Sumble), matching data/salesforce/Account.csv and Contact.csv.
insert into salesforce_accounts (id, name, website, industry, employees, type, owner_id, target_account, icp_tier, vertical, horizontals) values
  ('001Sb0000070042AAA', 'Kohl''s', 'kohls.com', 'Retail', 96000, 'Prospect', '005Sb0000050002AAA', true, 'Tier 1', 'Retail', '{"Apps & Agents","Software Factories"}')
on conflict (id) do nothing;

insert into salesforce_contacts (id, first_name, last_name, email, title, account_id, owner_id, linkedin_url, employment_status, mailing_city, mailing_state, has_opted_out_of_email) values
  ('003Sb0000090091AAA', 'Steve', 'Dee', null, 'Chief Technology Officer', '001Sb0000070042AAA', '005Sb0000050002AAA', 'https://www.linkedin.com/in/stevenedee', 'Current', 'Milwaukee', 'WI', false),
  ('003Sb0000090092AAA', 'Sujal', 'Patel', null, 'Senior Vice President of Technology', '001Sb0000070042AAA', '005Sb0000050002AAA', 'https://www.linkedin.com/in/sujalpatel', 'Current', 'Chicago', 'IL', false)
on conflict (id) do nothing;
