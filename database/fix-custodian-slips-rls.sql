-- Fix: custodian_slips / custodian_slip_items were created with allow-all RLS policies
-- Scope them to authenticated users, matching the older tables

-- Drop ALL existing policies on the two tables
do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('custodian_slips', 'custodian_slip_items')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- Recreate policies scoped to signed-in users only
alter table public.custodian_slips enable row level security;
alter table public.custodian_slip_items enable row level security;

create policy "Authenticated full access"
  on public.custodian_slips
  for all to authenticated
  using (true) with check (true);

create policy "Authenticated full access"
  on public.custodian_slip_items
  for all to authenticated
  using (true) with check (true);

-- Strip anon's table privileges entirely
revoke all on table public.custodian_slips from anon;
revoke all on table public.custodian_slip_items from anon;

-- Lock the ICS number generator to signed-in users
revoke execute on function public.generate_ics_number(text) from public, anon;
grant execute on function public.generate_ics_number(text) to authenticated, service_role;
