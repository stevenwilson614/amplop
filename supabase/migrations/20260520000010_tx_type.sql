-- Add transaction type for expense, income, and envelope transfer.
alter table transactions
  add column if not exists tx_type text not null default 'expense';

alter table transactions
  drop constraint if exists transactions_tx_type_check;

alter table transactions
  add constraint transactions_tx_type_check
  check (tx_type in ('expense', 'income', 'transfer'));
