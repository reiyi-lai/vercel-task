-- Hiring signals (Sumble job posts) are no longer fetched or shown.
delete from sumble_account_signals where category = 'hiring';
