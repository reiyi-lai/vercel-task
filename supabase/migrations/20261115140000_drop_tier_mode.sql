-- Target tiers are always a hard filter: only accounts in the brief's selected tiers fit.
alter table events drop column tier_mode;
