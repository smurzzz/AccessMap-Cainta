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
- [ ] Admin entry point built (separate from bottom tabs)
- [ ] OpenRouteService account + API key created
- [ ] Map/Location View wired to real coordinates (OpenStreetMap tiles)
- [ ] Directions API integrated (OpenRouteService), static step list rendering
- [ ] Location permission flow implemented
- [ ] Admin Add/Edit form wired to Supabase (insert/update)
- [ ] Photo upload to Supabase Storage working
- [ ] Admin Delete wired
- [ ] RLS verified: non-admin cannot write (tested)

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
