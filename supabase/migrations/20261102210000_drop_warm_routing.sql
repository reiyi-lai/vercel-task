-- Warm-intro routing is gone: its Clay, TeamLink, connector and warm-contact data, and the old candidate import.
drop table if exists candidates, warm_contacts, connector_confirmations, connector_load, clay_enrichments, teamlink_connections;
