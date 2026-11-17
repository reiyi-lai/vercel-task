-- Sign-offs use the sender's full name: {sender_first_name} becomes {sender_name}.
update events set sequence = replace(sequence::text, '{sender_first_name}', '{sender_name}')::jsonb;
