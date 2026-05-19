-- ============================================================
-- AMPLOP — Migration 3: envelope spent aggregation function
-- ============================================================
-- Returns the IDR-equivalent amount spent per envelope for the
-- calling user's household. IDR is used as the internal unit
-- because every transaction stores amount_idr_snapshot (locked
-- at entry time). The UI converts to display_currency at render
-- time using the current FX rate.
--
-- Allocation proportion logic:
--   allocation_idr = ta.amount / t.amount * t.amount_idr_snapshot
-- This works regardless of the transaction's original currency.
-- ============================================================

create or replace function get_envelope_spent()
returns table (envelope_id uuid, spent_idr bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id as envelope_id,
    coalesce(
      sum(
        ta.amount::numeric
        / nullif(t.amount, 0)
        * t.amount_idr_snapshot
      )::bigint,
      0
    ) as spent_idr
  from envelopes e
  left join transaction_allocations ta on ta.envelope_id = e.id
  left join transactions t on t.id = ta.transaction_id
  where e.household_id = get_user_household_id()
  group by e.id
$$;
