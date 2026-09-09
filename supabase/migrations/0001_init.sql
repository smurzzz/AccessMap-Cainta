-- =============================================================
-- AccessMap — Initial schema (0001)
-- places, accessibility_features, users
-- RLS enabled on all three tables.
-- =============================================================

-- -------------------------------------------------------------
-- users (mirrored from Clerk)
-- Created first so places.created_by can reference it.
-- -------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  role text not null default 'user'
    check (role in ('user', 'admin'))
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null
    check (category in ('hospital', 'health_center', 'government', 'school', 'mall', 'church', 'park')),
  description text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  photo_url text,
  operating_hours text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_category_idx on public.places (category);

create table public.accessibility_features (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  feature_type text not null
    check (feature_type in ('ramp', 'restroom', 'elevator', 'parking', 'entrance', 'other')),
  status text not null default 'unavailable'
    check (status in ('available', 'not_available', 'unavailable')),
  notes text
);

create index accessibility_features_place_id_idx on public.accessibility_features (place_id);
create index accessibility_features_feature_type_idx on public.accessibility_features (feature_type);

-- -------------------------------------------------------------
-- Grants (PostgREST roles)
-- -------------------------------------------------------------
grant select on public.places, public.accessibility_features to anon, authenticated;
grant insert, update, delete on public.places, public.accessibility_features to authenticated;

grant select, insert, update, delete on public.users to authenticated;

-- -------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------

-- places: public read, admin-only write
alter table public.places enable row level security;

create policy "Public read access"
  on public.places for select
  using (true);

create policy "Admins can write"
  on public.places for all
  using (
    exists (
      select 1 from public.users
      where users.clerk_user_id = auth.jwt() ->> 'sub'
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.clerk_user_id = auth.jwt() ->> 'sub'
        and users.role = 'admin'
    )
  );

-- accessibility_features: public read, admin-only write
alter table public.accessibility_features enable row level security;

create policy "Public read access"
  on public.accessibility_features for select
  using (true);

create policy "Admins can write"
  on public.accessibility_features for all
  using (
    exists (
      select 1 from public.users
      where users.clerk_user_id = auth.jwt() ->> 'sub'
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.clerk_user_id = auth.jwt() ->> 'sub'
        and users.role = 'admin'
    )
  );

-- users: read own row, admin-only write
alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.jwt() ->> 'sub' = clerk_user_id);

create policy "Admins can write"
  on public.users for all
  using (
    exists (
      select 1 from public.users
      where users.clerk_user_id = auth.jwt() ->> 'sub'
        and users.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.clerk_user_id = auth.jwt() ->> 'sub'
        and users.role = 'admin'
    )
  );