-- =============================================================
-- AccessMap — Fix RLS infinite recursion (0002)
--
-- The Phase 1 "Admins can write" policies reference public.users
-- from inside policies on public.users itself, so Postgres hits
-- "infinite recursion detected in policy for relation users"
-- (SQLSTATE 42P17) — which breaks EVERY read, even public ones.
--
-- Fix: move the admin check into a SECURITY DEFINER helper that
-- bypasses RLS on its internal read, and reference it from the
-- policies on all three tables.
-- =============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where users.clerk_user_id = auth.jwt() ->> 'sub'
      and users.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- places
drop policy if exists "Admins can write" on public.places;
create policy "Admins can write"
  on public.places for all
  using (public.is_admin())
  with check (public.is_admin());

-- accessibility_features
drop policy if exists "Admins can write" on public.accessibility_features;
create policy "Admins can write"
  on public.accessibility_features for all
  using (public.is_admin())
  with check (public.is_admin());

-- users: read own row stays as-is; writes now via is_admin()
drop policy if exists "Admins can write" on public.users;
create policy "Admins can write"
  on public.users for all
  using (public.is_admin())
  with check (public.is_admin());