-- Store Goodbudget leftover separately from monthly budget.
-- balance = carryover_idr + monthly_budget - this_month_spent (rolled forward each month)

alter table envelopes
  add column if not exists carryover_idr bigint not null default 0;

alter table envelopes
  add column if not exists carryover_month text;
