# AccessMap — Library & Service Reference

Quick reference for every major library/service used, why it's used, and where to find docs. Keep this updated as versions/decisions change.

## Core Framework

### Expo
- **What:** Toolchain/platform on top of React Native. Simplifies build, testing (Expo Go app), and access to native APIs (camera, location, etc.) without needing native Xcode/Android Studio setup for most of development.
- **Docs:** https://docs.expo.dev
- **Notes:** Use the **managed workflow**. Only eject to bare workflow if a required native module isn't supported — unlikely for this project's feature set.

### React Native
- **What:** Cross-platform mobile UI framework; Expo builds on top of it.
- **Docs:** https://reactnative.dev/docs/getting-started
- **Notes:** Use functional components + hooks throughout (see `code-standards.md`).

### React Navigation
- **What:** Routing/navigation library for React Native.
- **Docs:** https://reactnavigation.org/docs/getting-started
- **Notes:** Bottom Tab Navigator for the General User flow (Home, Filter, Map, Profile). Stack Navigator for Place Details, Navigation/Directions screen, and the separate Admin flow.

## Styling

### NativeWind
- **What:** Brings Tailwind CSS utility classes to React Native components via `className`.
- **Docs:** https://www.nativewind.dev
- **Notes:** Configure `tailwind.config.js` with the color palette, font family (Atkinson Hyperlegible Next), spacing, and border-radius tokens from `DESIGN.md` so `className="bg-primary text-on-primary rounded-lg"` etc. maps to the approved design system.

## Backend / Database

### Supabase
- **What:** Backend-as-a-service: hosted Postgres, auto-generated REST API (PostgREST), authentication helpers, storage buckets, and row-level security.
- **Docs:** https://supabase.com/docs
- **JS Client:** https://supabase.com/docs/reference/javascript/introduction
- **Notes for this project:**
  - Tables: `places`, `accessibility_features`, `users` (see `architecture.md` §3).
  - Enable **Row Level Security (RLS)** on all tables from day one — do not leave tables open.
  - Example RLS pattern:
    ```sql
    -- Everyone can read places
    create policy "Public read access"
      on places for select
      using (true);

    -- Only admins can insert/update/delete
    create policy "Admins can write"
      on places for all
      using (
        exists (
          select 1 from users
          where users.clerk_user_id = auth.jwt() ->> 'sub'
          and users.role = 'admin'
        )
      );
    ```
    (Exact JWT claim path depends on the Clerk-Supabase integration method chosen — see Clerk section below.)
  - **Storage:** create a `place-photos` bucket for entrance/place images uploaded by admins.

## Authentication

### Clerk
- **What:** Hosted authentication with prebuilt UI components and session management. Configured for Google OAuth only (no email/password).
- **Docs:** https://clerk.com/docs
- **Expo/React Native quickstart:** https://clerk.com/docs/quickstarts/expo
- **Clerk + Supabase integration:** https://clerk.com/docs/integrations/databases/supabase
  - Clerk can issue a JWT that Supabase accepts (via a Supabase "third-party auth" JWT template), letting Supabase RLS policies read the Clerk user ID directly — avoids needing to sync a separate password/session system.
- **Notes for this project:**
  - Disable all sign-in methods except Google in the Clerk dashboard.
  - Admin role is **not** self-assignable — set manually in the `users` table (`role = 'admin'`) for the specific demo/admin account(s).

## Maps & Directions

> **Decision:** This project uses **OpenStreetMap + OpenRouteService** instead of Google Maps Platform — both are free with no credit card or billing account required, which fits the project's budget constraints. See the Decisions Log in `progress-tracker.md`.

### OpenStreetMap (map display)
- **What:** Free, open map tile data — no API key, no account, no billing needed for the tile display itself.
- **Docs:** https://wiki.openstreetmap.org/wiki/API
- **Usage note:** OSM's public tile server (`tile.openstreetmap.org`) is community-run and has a [usage policy](https://operations.osmfoundation.org/policies/tiles/) — fine for development and a thesis-scale demo, but not intended for high-traffic production use. If the app ever needs to scale beyond a demo, switch to a paid tile provider (e.g. MapTiler, Stadia Maps, or Mapbox) that mirrors OSM data.
- **React Native usage:** via `react-native-maps`'s `MapView` with a `UrlTile` child component pointed at the OSM tile URL template:
  ```
  https://tile.openstreetmap.org/{z}/{x}/{y}.png
  ```
- **`react-native-maps` docs:** https://github.com/react-native-maps/react-native-maps

### OpenRouteService (directions/routing)
- **What:** Free routing/directions API built on OSM data.
- **Docs hub:** https://openrouteservice.org/dev/#/api-docs
- **Sign up (free, no credit card):** https://openrouteservice.org/dev/#/signup
- **Directions API v2 docs:** https://openrouteservice.org/dev/#/api-docs/v2/directions
- **Free tier quota:** 2,000 requests/day for Directions V2 (40/minute) — more than enough for development and a thesis demo. Quota is visible on the API key dashboard.
- **Notes for this project:**
  - Only need **one-time route fetch** per "Get Directions" tap — no polling, no live recalculation, per the project's static-directions scope decision.
  - The response returns `features[].properties.segments[].steps[]`, each with `distance`, `duration`, and an `instruction` string (already plain text, no HTML stripping needed — unlike Google's Directions API).
  - Map each step's `type` field to a simple directional icon (turn left/right/straight/arrive) for the UI.
  - API key stored as `EXPO_PUBLIC_ORS_API_KEY` in `.env` — never commit the real key to git.
  - Google Cloud's deprecating `api.openrouteservice.org` in favor of `api.heigit.org` — check the current base URL on the ORS dashboard before hardcoding it, and update this doc if it changes.

## Dev Tools

### Figma
- **What:** Source of UI designs (in this project, screens were generated/refined via Stitch, but Figma may be used for further iteration).
- **Docs:** https://help.figma.com

### Postman
- **What:** For testing Supabase's REST endpoints and (if built) any custom Node.js endpoints directly, outside the app.
- **Docs:** https://learning.postman.com/docs/getting-started/introduction/

### GitHub
- **What:** Version control / source hosting.
- **Docs:** https://docs.github.com

---

## Version Pinning (fill in once installed)

| Package | Version | Notes |
|---|---|---|
| expo | TBD | |
| react-native | TBD | |
| nativewind | TBD | |
| @supabase/supabase-js | TBD | |
| @clerk/clerk-expo | TBD | |
| react-native-maps | TBD | |
| @react-navigation/native | TBD | |

## Environment Variables Reference

| Variable | Used for | Where to get it |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase dashboard → Project Settings → API |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth | Clerk dashboard → API Keys |
| `EXPO_PUBLIC_ORS_API_KEY` | OpenRouteService directions | https://openrouteservice.org/dev/#/signup → Dashboard → Request a token |

No Google Cloud / Google Maps API key is needed anywhere in this project.

> Update this table right after `Phase 1` setup (see `phase-plan.md`) and whenever a dependency is upgraded.
