# AccessMap — Build Plan

This describes *how* the system gets built — setup order and dependencies between pieces. For *when* (calendar/weeks), see `phase-plan.md`.

## Guiding Principles
1. **Data layer first.** Nothing in the UI is useful without real (even if seeded/sample) data behind it.
2. **User flow before Admin flow.** The general user experience is the core deliverable; admin tooling exists to feed it data.
3. **Static before dynamic.** Get static screens matching the approved Stitch designs working with hardcoded data before wiring up Supabase/Clerk/Maps.
4. **One integration at a time.** Don't wire up Clerk, Supabase, and OpenStreetMap/OpenRouteService simultaneously — integrate and verify each independently.

## Build Order

### Step 1 — Project Setup
- Initialize Expo project (TypeScript template).
- Install and configure NativeWind, set up `tailwind.config.js` with the design tokens from `DESIGN.md` (colors, font family, spacing, radii).
- Set up React Navigation (bottom tabs + stack navigators).
- Set up folder structure (see `code-standards.md`).
- Push initial commit to GitHub.

### Step 2 — Static Screens (no backend yet)
Build each approved screen as a static component with mock/hardcoded data, matching the Stitch designs pixel-as-close-as-reasonable:
1. Login screen (UI only — Google button not yet functional)
2. Home / Place Directory
3. Browse by Category
4. Accessibility Filter (bottom sheet)
5. Place Details
6. Map / Location View (static map, no live pin logic yet)
7. Turn-by-Turn Directions (static mock steps)
8. Profile screen
9. Admin Dashboard (Facility Directory list)
10. Add/Edit Place form

At the end of this step, the app should be fully click-through-able with fake data, on-device via Expo Go.

### Step 3 — Supabase Setup
- Create Supabase project.
- Create tables per `architecture.md` §3 (`places`, `accessibility_features`, `users`).
- Seed sample data (San Isidro hospitals, health centers, gov't offices, plus secondary categories) for development/demo per the "sample data" note in the proposal's scope.
- Set up RLS policies (read-only for users, write for admins).
- Install `@supabase/supabase-js` in the app, connect, replace mock data in Home/Category/Filter/Place Details screens with real Supabase queries.

### Step 4 — Clerk Auth Integration
- Create Clerk project, enable Google OAuth only (disable email/password).
- Install Clerk Expo SDK, wrap app in `ClerkProvider`.
- Wire up Login screen's "Continue with Google" button.
- Add auth guard: unauthenticated users see Login only; authenticated users go to Home.
- Add `role` handling: fetch role from Supabase `users` table (linked via `clerk_user_id`) after login; manually set at least one admin row for testing/demo.
- Build the separate Admin entry point (not in the bottom tab bar).

### Step 5 — OpenStreetMap + OpenRouteService Integration
- Set up `react-native-maps` with a `UrlTile` layer pointed at OpenStreetMap's tile server (no API key needed).
- Sign up for a free OpenRouteService account and API key (no credit card required).
- Wire up Map/Location View screen with real place coordinates.
- Wire up "Get Directions" → call OpenRouteService Directions API → render static step-by-step list on the Navigation screen.
- Request and handle device location permission (with a clear rationale prompt, since this is needed only to compute the route, not for continuous tracking).

### Step 6 — Admin CRUD
- Wire Add/Edit Place form to Supabase inserts/updates (including photo upload to Supabase Storage).
- Wire delete action on Admin Dashboard list.
- Confirm RLS correctly blocks non-admin users from write actions (test with a non-admin account).

### Step 7 — Polish & Accessibility Pass
- Verify touch targets ≥48px, contrast ratios, font scaling behavior (per DESIGN.md accessibility notes).
- Confirm no leftover out-of-scope UI copy ("LGU Audited," scoring, community reports, emergency call, etc.) — cross-check against `project-overview.md`'s Out of Scope list.
- Empty states, loading states, error states for all data-driven screens.

### Step 8 — Testing & QA
- Manual test pass per user role (General User, Admin).
- Test on both iOS and Android via Expo (simulator + at least one physical device if possible).
- Fix bugs found.

### Step 9 — Deployment / Demo Prep
- Build with EAS Build (Expo Application Services) for a shareable APK/TestFlight build, or run via Expo Go for the presentation if a native build isn't required.
- Prepare demo script and seed data that tells a clean story (e.g. search → filter → view hospital → get directions → admin adds a place).

## Dependencies Between Steps
- Step 3 (Supabase) can start in parallel with late Step 2 (static screens), but screens should be static first so backend wiring doesn't block visual review.
- Step 4 (Clerk) depends on Step 3's `users` table existing (to store/read role).
- Step 5 (OpenStreetMap/OpenRouteService) depends on Step 3 (place lat/lng must exist in the DB).
- Step 6 (Admin CRUD) depends on Steps 3 and 4 (needs DB + role-based auth).
