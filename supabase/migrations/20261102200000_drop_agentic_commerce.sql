-- Agentic Commerce is no longer a horizontal (retail AI commerce is covered by the Retail vertical).
update accounts set horizontals = array_remove(horizontals, 'Agentic Commerce');
update event_briefs set themes = array_remove(themes, 'Agentic Commerce');
