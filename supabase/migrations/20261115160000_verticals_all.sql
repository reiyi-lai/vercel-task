-- Cross-industry is now "All": every vertical selected.
update events set verticals = '{"Retail","Financial Services"}' where 'Cross-industry' = any(verticals);
