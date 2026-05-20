-- Allow authenticated users to create a new household (client-side onboarding)
create policy "households_insert_authed"
  on households for insert
  with check (auth.uid() is not null);

-- Allow household members to update their household name
create policy "households_update_own"
  on households for update
  using (id = get_user_household_id())
  with check (id = get_user_household_id());
