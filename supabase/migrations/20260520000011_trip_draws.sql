-- Daily trip draws from parent envelopes (e.g. Groceries → "Vacation" per day)

create table if not exists trip_draws (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips(id) on delete cascade,
  envelope_id   uuid not null references envelopes(id) on delete cascade,
  daily_amount  integer not null,
  label         text not null default 'Vacation',
  created_at    timestamptz not null default now(),
  unique (trip_id, envelope_id)
);

create index if not exists trip_draws_trip_id_idx on trip_draws(trip_id);
create index if not exists trip_draws_envelope_id_idx on trip_draws(envelope_id);

alter table trip_draws enable row level security;

create policy "trip_draws_household_all"
  on trip_draws for all
  using (
    exists (
      select 1 from trips t
      where t.id = trip_id
        and t.household_id = get_user_household_id()
    )
  )
  with check (
    exists (
      select 1 from trips t
      where t.id = trip_id
        and t.household_id = get_user_household_id()
    )
  );
