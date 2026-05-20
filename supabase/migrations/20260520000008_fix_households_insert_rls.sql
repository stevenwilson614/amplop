-- Ensure authenticated clients can create a household during onboarding.
-- This is safe because users can only read/update households tied to their membership.
drop policy if exists "households_insert_authed" on households;

create policy "households_insert_authed"
  on households for insert
  to authenticated
  with check (true);
