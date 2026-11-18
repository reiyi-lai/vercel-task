-- Director-level engineering leaders at Nordstrom and Kohl's (from Sumble), matching data/salesforce/Contact.csv.
insert into salesforce_contacts (id, first_name, last_name, email, title, account_id, owner_id, linkedin_url, employment_status, mailing_city, mailing_state, has_opted_out_of_email) values
  ('003Sb0000090093AAA', 'Jason', 'Dickerson', null, 'Director of Engineering (Customer Experience - Web, Ecommerce, Post Purchase)', '001Sb0000070020AAA', '005Sb0000050002AAA', 'https://www.linkedin.com/in/jason-dickerson-b2233', 'Current', 'Seattle', 'WA', false),
  ('003Sb0000090094AAA', 'Benjamin', 'Sherry', null, 'Director of Engineering, Platform Services', '001Sb0000070020AAA', '005Sb0000050002AAA', 'https://www.linkedin.com/in/benjaminsherry', 'Current', 'Seattle', 'WA', false),
  ('003Sb0000090095AAA', 'Adam', 'Cobb', null, 'Director, Engineering Leader - AI', '001Sb0000070042AAA', '005Sb0000050002AAA', 'https://www.linkedin.com/in/adam-g-cobb', 'Current', 'Portland', 'OR', false),
  ('003Sb0000090096AAA', 'Paul', 'Nagorney', null, 'Director, Engineering Leader | Digital', '001Sb0000070042AAA', '005Sb0000050002AAA', 'https://www.linkedin.com/in/paul-nagorney-02638219', 'Current', 'Chicago', 'IL', false)
on conflict (id) do nothing;
