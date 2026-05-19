-- ============================================================
-- AMPLOP — Migration 5: Trip draw accounting
-- ============================================================
-- Adds drawn_idr_snapshot to envelopes and rewrites
-- get_envelope_spent() to handle trip draw/rollback logic.
--
-- Active trip envelope:  full drawn_idr_snapshot counts as
--                        "spent" against the parent envelope.
-- Ended trip envelope:   only actual allocation spend counts
--                        against the parent (unspent returned).
-- ============================================================

alter table envelopes
  add column if not exists drawn_idr_snapshot integer not null default 0;

-- Rewrite function to include trip draw accounting
create or replace function get_envelope_spent()
returns table (envelope_id uuid, spent_idr bigint)
language sql
stable
security definer
set search_path = public
as $$
  with own_spent as (
    -- Direct allocation spend per envelope (unchanged from migration 3)
    select
      e.id                                                                    as eid,
      coalesce(
        sum(ta.amount::numeric / nullif(t.amount, 0) * t.amount_idr_snapshot)::bigint,
        0
      )                                                                       as idr
    from envelopes e
    left join transaction_allocations ta on ta.envelope_id = e.id
    left join transactions t on t.id = ta.transaction_id
    where e.household_id = get_user_household_id()
    group by e.id
  ),
  child_impact as (
    -- For each parent envelope, sum what its child trip envelopes "cost" it.
    -- Active trip  → full drawn_idr_snapshot (budget is in-flight, not returned yet).
    -- Ended trip   → actual allocation spend only (unspent has been returned).
    select
      ce.parent_envelope_id                       as parent_id,
      case tr.status
        when 'active' then ce.drawn_idr_snapshot
        else os.idr
      end                                         as idr
    from envelopes  ce
    join trips       tr on tr.id  = ce.trip_id
    join own_spent   os on os.eid = ce.id
    where ce.parent_envelope_id is not null
      and ce.household_id = get_user_household_id()
  )
  select
    os.eid                                                as envelope_id,
    (os.idr + coalesce(ci_agg.total, 0))::bigint         as spent_idr
  from own_spent os
  left join (
    select parent_id, sum(idr)::bigint as total
    from   child_impact
    group  by parent_id
  ) ci_agg on ci_agg.parent_id = os.eid
$$;
