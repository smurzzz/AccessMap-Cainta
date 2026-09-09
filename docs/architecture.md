# AccessMap — Architecture

## 1. High-Level Architecture

```
┌─────────────────────────────┐
│   React Native App (Expo)   │
│   NativeWind (styling)      │
│                              │
│  ┌────────────┐  ┌────────┐ │
│  │ User Flow  │  │ Admin  │ │
│  │ Screens    │  │ Flow   │ │
│  └────────────┘  └────────┘ │
└──────────────┬───────────────┘
               │
     ┌─────────┼─────────────────┐
     │         │                 │
     ▼         ▼                 ▼
┌─────────┐ ┌────────┐ ┌────────────────────┐
│  Clerk  │ │Supabase│ │ OpenStreetMap tiles │
│  (Auth) │ │(DB+API)│ │ + OpenRouteService  │
└─────────┘ └────────┘ │ (map + directions)  │
                        └────────────────────┘
```

The app is a single Expo/React Native codebase. It talks directly to three external services — no custom backend server is required for the core CRUD flows, since Supabase provides the database and REST API out of the box.

> **Note on maps/directions:** This project uses **OpenStreetMap (OSM) tiles** for map display and **OpenRouteService (ORS)** for directions — both free, with no credit card or billing account required — instead of the paid Google Maps Platform. See §2.5 below and `library-docs.md` for setup details.

## 2. Components

### 2.1 Mobile App (React Native + Expo)
- Single codebase, runs on iOS and Android via Expo.
- Screens split into two flows: **General User** and **Admin** (see `phase-plan.md` for screen list).
- Styling via NativeWind (Tailwind classes) using the design tokens from the approved Stitch design (colors, typography — Atkinson Hyperlegible Next, spacing).
- Navigation: React Navigation (bottom tabs for User flow: Home, Filter, Map, Profile; stack navigation for Admin flow and Place Details/Navigation screens).

### 2.2 Authentication — Clerk
- Google OAuth only. No email/password forms anywhere in the app.
- Clerk manages session tokens; the app reads `userId` / `role` from the Clerk session.
- **Admin role** is not self-service — an admin flag is set manually in the `users` table (or via Clerk's public metadata) by the developer/thesis owner. There is no public "become an admin" flow.
- Admin entry point is a separate, non-tab-bar route (e.g. accessed via a hidden/dev menu item or a distinct login path), consistent with the earlier decision: same app, but admin flow is not exposed in the general user's bottom navigation.

### 2.3 Database & API — Supabase (PostgreSQL)
Supabase provides:
- Managed Postgres database
- Auto-generated REST endpoints (PostgREST) for CRUD
- Row Level Security (RLS) policies to separate what general users vs. admins can read/write
- Storage bucket for entrance/place photos

See `library-docs.md` for schema details and RLS policy notes.

### 2.4 Supplementary Backend — Node.js (optional/minimal)
Only used if a task cannot be done cleanly through Supabase's REST API or RLS alone — for example:
- Complex multi-table search/filter logic beyond what PostgREST query params support
- Any server-side call to Google Directions API that should not expose the API key to the client

If the thesis timeline allows, this can be skipped entirely in favor of calling Supabase and OpenRouteService directly from the client — since ORS's free tier has no billing account attached, there's less security concern about exposing the key client-side compared to a billed Google API key, but it should still not be committed to source control. This decision should be made explicitly at the start of Phase 2 (see `phase-plan.md`).

### 2.5 Maps & Directions — OpenStreetMap + OpenRouteService (free, no billing account)
- **Map display:** `react-native-maps`'s `MapView` with a `UrlTile` overlay pointed at OpenStreetMap's public tile server — no API key, no billing account, no sign-up required. Used for the Map/Location View screen to show a place pinned by its stored latitude/longitude.
- **Directions:** [OpenRouteService](https://openrouteservice.org) Directions API (v2) — free tier includes 2,000 requests/day, no credit card required, just a free account + API key. Called once per "Get Directions" tap; response is parsed into a numbered list of steps (distance + instruction text) for the static Turn-by-Turn Directions screen.
- No live GPS tracking, no continuous rerouting, no voice guidance — the app fetches one route once and displays it as a static list, per the project's scope decision (Option B — see `project-overview.md`).
- API key stored as `EXPO_PUBLIC_ORS_API_KEY` in `.env` (see `library-docs.md`).

## 3. Data Model (high-level)

```
places
├── id (uuid, PK)
├── name
├── category            (hospital | health_center | government | school | mall | church | park)
├── description
├── address
├── latitude / longitude
├── photo_url
├── operating_hours
├── created_by (admin user id)
├── created_at / updated_at

accessibility_features
├── id (uuid, PK)
├── place_id (FK -> places.id)
├── feature_type   (ramp | restroom | elevator | parking | entrance | other)
├── status         (available | not_available)
├── notes

users  (mirrored/synced from Clerk, or referenced by Clerk user id)
├── id
├── clerk_user_id
├── role            (user | admin)
```

Full column-level schema, indexes, and RLS policies belong in `library-docs.md` (Supabase section) and should be kept in sync with actual migrations.

## 4. Request Flow Examples

**Browsing places (General User)**
1. App loads → queries Supabase `places` table (filtered/sorted by category) via Supabase JS client.
2. Results rendered as place cards.

**Filtering by accessibility**
1. User toggles feature filters → app builds a Supabase query joining `places` + `accessibility_features` where `status = 'available'` for the selected feature types.
2. Results re-rendered.

**Get Directions**
1. User taps "Get Directions" on Place Details.
2. App requests the user's current location (device permission).
3. App calls OpenRouteService's Directions API with origin = current location, destination = place lat/lng.
4. Response parsed into a numbered step list + total distance/time, rendered on the Navigation screen.

**Admin adds a place**
1. Admin (authenticated, role=admin) fills out the Add/Edit Place form.
2. App uploads photo to Supabase Storage (if provided).
3. App inserts/updates row in `places` and related rows in `accessibility_features` via Supabase client, gated by RLS policy that only allows `role = admin` to write.

## 5. Security Notes
- RLS enabled on all tables: general users get read-only access to `places`/`accessibility_features`; only rows where `role = admin` (checked via Clerk-Supabase integration/JWT claim) can write.
- OpenRouteService API key is a client-side free-tier key (no billing attached) — still avoid committing it to source control; treat it like any other credential even though it's low-risk if exposed.
- No secrets committed to the repo — use `.env` + Expo's environment variable handling (`app.config.js` + `EXPO_PUBLIC_` prefix only for values safe to expose client-side).

## 6. Non-Goals (reiterated from scope)
No emergency calling, no live navigation, no user-generated content, no automatic scoring — do not introduce backend support for these even if convenient, per `project-overview.md`.
