-- Run in Supabase Dashboard → SQL Editor
-- Links Olivia to the household that has your envelopes (most envelope rows).

-- 1) Inspect current state
select
  u.display_name,
  u.email,
  u.household_id,
  h.name as household_name,
  (select count(*) from envelopes e where e.household_id = u.household_id) as envelope_count
from users u
join households h on h.id = u.household_id
order by u.email;

-- 2) Move Olivia into the primary household (the one with the most envelopes)
with primary_household as (
  select household_id
  from envelopes
  group by household_id
  order by count(*) desc
  limit 1
)
update users u
set household_id = (select household_id from primary_household)
where lower(u.email) = lower('olivia.melia.park@gmail.com');

-- 3) Confirm
select
  u.display_name,
  u.email,
  h.name as household_name,
  (select count(*) from envelopes e where e.household_id = u.household_id) as envelope_count
from users u
join households h on h.id = u.household_id
order by u.email;
