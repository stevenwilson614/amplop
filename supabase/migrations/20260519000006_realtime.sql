-- ============================================================
-- AMPLOP — Migration 6: Enable Supabase Realtime
-- ============================================================
-- Adds the three household tables to the supabase_realtime
-- publication so clients receive postgres_changes events.
--
-- REPLICA IDENTITY FULL is required for UPDATE and DELETE events
-- to include household_id in the payload so the client-side
-- filter (household_id=eq.X) works correctly for those events.
-- ============================================================

alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table envelopes;
alter publication supabase_realtime add table trips;

alter table transactions replica identity full;
alter table envelopes    replica identity full;
alter table trips        replica identity full;
