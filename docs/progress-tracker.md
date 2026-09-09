# AccessMap — Progress Tracker

Living checklist. Update as you go — check items off, add dates, note blockers. Mirrors `phase-plan.md`.

**Last updated:** _(fill in date)_

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
- [ ] Login screen (static)
- [ ] Home / Place Directory (static)
- [ ] Browse by Category (static)
- [ ] Accessibility Filter sheet (static)
- [ ] Place Details (static)
- [ ] Map / Location View (static)
- [ ] Turn-by-Turn Directions (static/mock)
- [ ] Profile screen (static)
- [ ] Admin Dashboard (static)
- [ ] Add/Edit Place form (static)
- [ ] Supabase project created
- [ ] Tables created (`places`, `accessibility_features`, `users`)
- [ ] Sample/seed data loaded
- [ ] Home connected to real Supabase data
- [ ] Category browse connected
- [ ] Filter connected
- [ ] Place Details connected

## Phase 2B — Auth + Maps + Admin CRUD
- [ ] Clerk project set up, Google-only enabled
- [ ] Clerk Expo SDK integrated
- [ ] Login screen wired to real Google Sign-In
- [ ] Auth guard (unauthenticated → Login only)
- [ ] Role fetched from `users` table after login
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
