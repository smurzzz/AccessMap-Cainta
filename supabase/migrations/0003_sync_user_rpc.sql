-- =============================================================
-- AccessMap — Role sync RPC (0003)
--
-- The app signs in with Clerk (not Supabase Auth), so PostgREST
-- requests carry the anon key: there is no Supabase JWT `sub`, and
-- the `users` table is only granted to the `authenticated` role.
-- The app therefore cannot read or insert its own row directly.
--
-- Fix: a SECURITY DEFINER RPC that bypasses RLS, inserts a row with
-- role='user' if none exists for the clerk user, and returns the
-- resolved role. Role can never be set to 'admin' through this path.
-- =============================================================

create or replace function public.sync_user(p_clerk_user_id text)
returns table (role text)
language sql
security definer
set search_path = public
as $$
  insert into public.users (clerk_user_id, role)
  values (p_clerk_user_id, 'user')
  on conflict (clerk_user_id) do nothing;

  select u.role
  from public.users as u
  where u.clerk_user_id = p_clerk_user_id;
$$;

grant execute on function public.sync_user(text) to anon, authenticated;