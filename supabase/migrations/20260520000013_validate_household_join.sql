-- Let new users verify an invite code exists before joining
create or replace function public.validate_household_join(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from public.households where id = p_household_id);
$$;

grant execute on function public.validate_household_join(uuid) to authenticated;
