# AccessMap — Progress Tracker

Living checklist. Update as you go — check items off, add dates, note blockers. Mirrors `phase-plan.md`.

**Last updated:** 2026-09-09

## Legend
- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked

---

## Phase 0 — Planning & Requirements
- [ ] Proposal document finalized (platform, tech stack, scope consistency)
- [ ] Feature list locked, cross-checked vs. Out of Scope
- [ ] All 10 screen designs approved, scope-clean (no LGU-audited/scoring/reports/emergency)
- [ ] Repo created, doc set (`/docs`) added

## Phase 1 — System Design
- [ ] `architecture.md` finalized
- [ ] Supabase schema + RLS design finalized (on paper)
- [ ] Expo project skeleton created
- [ ] Navigation structure working (empty screens, correct routes)
- [ ] GitHub branch strategy set up

## Phase 2A — Static UI + Supabase
- [x] Login screen (static)
- [x] Home / Place Directory (static)
- [x] Browse by Category (static)
- [x] Accessibility Filter sheet (static)
- [x] Place Details (static)
- [x] Map / Location View (static)
- [x] Turn-by-Turn Directions (static/mock)
- [x] Profile screen (static)
- [x] Admin Dashboard (static)
- [x] Add/Edit Place form (static)
- [x] Supabase project created
- [x] Tables created (`places`, `accessibility_features`, `users`)
- [x] Sample/seed data loaded
- [x] Home connected to real Supabase data
- [x] Category browse connected
- [x] Filter connected
- [x] Place Details connected

## Phase 2B — Auth + Maps + Admin CRUD
- [x] Clerk Expo SDK integrated (`@clerk/clerk-expo` v2.20.0, Core 2)
- [x] Login screen wired to real Google Sign-In (`useSSO` oauth_google)
- [x] Auth guard (unauthenticated → Login only; authenticated → Home)
- [x] Role fetched from `users` table after login (via `sync_user` RPC, `RoleProvider` context)
- [ ] Clerk project set up, Google-only enabled (dashboard step — user must confirm/enable)
- [x] Admin entry point built (separate from bottom tabs, route-guarded to `role='admin'`)
- [ ] OpenRouteService account + API key created
- [x] Map/Location View wired to real coordinates (OpenStreetMap tiles)
- [x] Directions API integrated (OpenRouteService), static step list rendering
- [x] Location permission flow implemented
- [x] Admin Add/Edit form wired to Supabase (insert/update `places` + `accessibility_features`)
- [x] Photo upload to Supabase Storage working (`place-photos` bucket, migration 0004)
- [x] Admin Delete wired (+ confirmation prompt)
- [ ] RLS verified: non-admin cannot write (tested — requires Clerk native Supabase integration enabled + admin clerk_user_id updated)

## Phase 3 — Testing & QA
- [ ] Functional test: General User flow, iOS
- [ ] Functional test: General User flow, Android
- [ ] Functional test: Admin flow, iOS
- [ ] Functional test: Admin flow, Android
- [ ] Accessibility self-audit (contrast, touch targets, labels, font scaling)
- [ ] Scope-compliance check passed (no scoring/reports/emergency/live-nav/LGU claims anywhere)
- [ ] Known bugs list emptied or triaged

## Phase 4 — Deployment
- [ ] Supabase environment finalized for demo
- [ ] EAS Build produced (or Expo Go demo path confirmed)
- [ ] Final seed data set for demo
- [ ] README + doc set finalized

## Phase 5 — Presentation
- [ ] Demo script rehearsed
- [ ] Slides/recap prepared
- [ ] Backup screen recording made

---

## Open Issues / Blockers Log

| Date | Issue | Status |
|---|---|---|
| | | |

## Decisions Log
_(Record any scope or tech decisions made mid-project so future-you remembers why.)_

| Date | Decision | Reason |
|---|---|---|
| | Switched platform from Web to Mobile App | Client/professor request |
| | Chose static step-by-step directions over live Waze-style navigation | Timeline + scope fit |
| | Switched auth to Google-only via Clerk | Simplicity, security, client request ("direct sa Google") |
| | Switched DB/backend from MySQL/plain Node.js to Supabase (Postgres) | Convenience, auto REST API, built-in auth-friendly RLS |
| | Switched maps/directions from Google Maps API to OpenStreetMap + OpenRouteService | Google Maps requires a linked billing/credit card even on the free tier; OSM + ORS need no billing account at all |
| 2026-09-09 | Filters match places only when **all** selected feature types are available | "Has all selected provisions" is the only sensible reading of the Filter screen copy ("places that have the selected provisions verified"); OR semantics would list a place missing most requested features |
| 2026-09-09 | Category chips/filters stay on the Filter screen; Home shows category-filtered via the same `usePlaces` hook | Keeps one data source per screen per code-standards.md; no duplicate query logic |
| 2026-09-09 | Role sync done via `SECURITY DEFINER` RPC `public.sync_user(clerk_user_id)` instead of granting `users` table to the anon role | App signs in with Clerk, so PostgREST has no Supabase JWT `sub` and the anon role has no grant on `users`; RPC inserts role='user' if missing and returns role, without allowing self-set admin |
| 2026-09-09 | Auth integration kept on `@clerk/clerk-expo` v2 (Core 2) rather than migrating to `@clerk/expo` (Core 3) | Package the user explicitly requested in Phase 0; migration to Core 3 can be a later cleanup |
| 2026-09-09 | Admin writes authenticate via Clerk's **native Supabase integration** (`createClient(url, key, { accessToken })` → `session.getToken()`) | So RLS `auth.jwt()->>'sub'` resolves to the Clerk user id and `is_admin()` enforces admin-only writes from the client app; JWT template approach deprecated by Clerk |
| 2026-09-09 | Place photos go to a public `place-photos` storage bucket; URL stored on `places.photo_url` | Place photos are public data; write access still admin-only via `is_admin()` storage policies |
| 2026-09-09 | Map tiles: `react-native-maps` MapView + `UrlTile` over **CARTO voyager raster tiles** (`basemaps.cartocdn.com`, OSM data, free/no key); directions: ORS v2 `foot-walking` via `EXPO_PUBLIC_ORS_API_KEY` | Phase 7 spec wanted `tile.openstreetmap.org`, but that server 403s the default Android UrlTile user-agent (react-native-maps#3747 → black map); CARTO allows it. Standalone Android builds still need a Google Maps API key for the react-native-maps SDK itself |
| 2026-09-09 | Map rendering switched to a **WebView + Leaflet** map (`src/components/osm-map.tsx`) using CARTO tiles; pin taps bridge back via `postMessage` | The native Google-Maps-backed `react-native-maps` surface rendered fully black on the user's Android device even with `mapType="none"`; the system WebView + Leaflet renders the same OSM street tiles on any device with an internet connection, and keeps markers/polylines |
| 2026-09-09 | Phase 3 / 3.5 design-conformance pass: updated `tailwind.config.js` + `design-tokens.ts` to match `DESIGN.md` exactly (primary navy `#0f172a`, deep slate `#1e293b`, emerald `#059669`/`#10b981`, binary status palettes `#ecfdf5`/`#065f46` and `#f1f5f9`/`#334155`/`#64748b`, drag-handle `#94a3b8`); reworked buttons (navy primary, white+navy-border secondary, emerald accessibility/route), binary status indicators (per-state bg/border/text + distinct mark), inputs (52px, 2px `#1e293b` border), cards/selectors to 8px radius, data-tag pills to 4px, 64px white bottom tab bar. Kept existing `StyleSheet.create` structure per user choice. | Align rendered UI with the approved Stitch design system; emerald reserved strictly for positive/accessibility states, navy for primary action/structural elements |
| 2026-09-10 | Updated the design system to the new Stitch Material palette: `DESIGN.md` YAML now carries the Material-3 blue/green tokens (`primary #0028d2`, on-surface `#0b1c30`, surface `#f8f9ff`, tertiary `#005136`, outline `#747689`, etc.) and the Inter type scale; added the full `mat-*` token set to `tailwind.config.js` and a new `M3` export in `design-tokens.ts`. | The login screen (and future screens) were redesigned in Stitch to a Material-3 blue/green scheme; tokens added without disturbing the legacy navy/emerald tokens still used by other screens |
| 2026-09-10 | Redesigned the Login screen to match the Stitch export exactly: “Live Network” pill (top-right), glowing `#0028d2` logo tile with `location_on` mark, “AccessMap” headline + “San Isidro, Cainta, Rizal”, full-width white Google “G” button (rounded-xl, `#e2e8f0` border, shadow) with real Google SVG logo, and Terms/Privacy footer. Added `react-native-svg` (SDK 57-compatible) for the Google logo. | User requested the login page match the approved Stitch design exactly |
