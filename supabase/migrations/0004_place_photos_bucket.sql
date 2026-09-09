-- =============================================================
-- AccessMap — place-photos storage bucket (0004)
--
-- Public bucket so place photos are readable by everyone; writes
-- are limited to admins via the same is_admin() RLS helper.
-- Authentication context: Clerk session token forwarded with the
-- role=authenticated claim (native Supabase + Clerk integration,
-- see Phase 6 note) so auth.jwt()->>'sub' == clerk_user_id.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('place-photos', 'place-photos', true)
on conflict (id) do nothing;

-- make sure the storage role grants exist for the API roles
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

create policy "place-photos public read"
  on storage.objects for select
  using (bucket_id = 'place-photos');

create policy "place-photos admin insert"
  on storage.objects for insert
  with check (bucket_id = 'place-photos' and public.is_admin());

create policy "place-photos admin update"
  on storage.objects for update
  using (bucket_id = 'place-photos' and public.is_admin())
  with check (bucket_id = 'place-photos' and public.is_admin());

create policy "place-photos admin delete"
  on storage.objects for delete
  using (bucket_id = 'place-photos' and public.is_admin());