-- Events always aim for net-new opportunities (accounts with an open opportunity are left out), so the brief no longer
-- asks for a commercial objective.
alter table events drop column objective;
