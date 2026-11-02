-- Edited step copy saved before sending: { "<step>": { subject, body } }. Used in place of the template until sent.
alter table outreach add column drafts jsonb not null default '{}';
