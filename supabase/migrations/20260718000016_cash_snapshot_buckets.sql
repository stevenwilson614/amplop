-- Cash snapshots: USD buckets (business, personal, savings, optional other)

alter table cash_snapshots
  add column if not exists business_amount integer not null default 0;

alter table cash_snapshots
  add column if not exists personal_amount integer not null default 0;

alter table cash_snapshots
  add column if not exists savings_amount integer not null default 0;

alter table cash_snapshots
  add column if not exists other_amount integer not null default 0;

alter table cash_snapshots
  add column if not exists other_label text;

-- Legacy rows: treat prior total as personal cash
update cash_snapshots
set personal_amount = amount
where business_amount = 0
  and personal_amount = 0
  and savings_amount = 0
  and other_amount = 0;

alter table cash_snapshots alter column currency set default 'USD';
