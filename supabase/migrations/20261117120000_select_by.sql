-- The date AEs and BDRs select their candidates for an event by.
alter table events add column select_by date;
update events set select_by = case slug
  when 'lvgp' then date '2026-11-05'
  when 'nrf-breakfast' then date '2025-12-15'
  when 'ai-builder-dinner' then date '2026-09-29'
end;
