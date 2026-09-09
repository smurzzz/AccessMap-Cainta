# AccessMap — Phase Plan (Phase 0 → Finish)

Maps to the proposal's timeline (Section 8) but broken into concrete phases. Adjust week counts to your actual calendar; the order should not change.

## Phase 0 — Planning & Requirements (≈1 week)
**Goal:** Lock scope so nothing drifts mid-build.
- [ ] Finalize proposal document (platform = mobile, tech stack updated to Expo/RN/NativeWind/Supabase/Clerk, scope sections consistent — no contradictions like "Mobile application version" listed as out of scope while the whole app is mobile)
- [ ] Finalize feature list — cross-check against Out of Scope list in `project-overview.md`
- [ ] Finalize all 10 core screens' approved designs (Stitch) with no remaining scope leaks (no LGU-audited claims, no scoring, no community reports, no emergency call)
- [ ] Set up project management (this doc + `progress-tracker.md`) and repo

**Exit criteria:** Proposal document, design set, and scope docs all agree with each other.

## Phase 1 — System Design (≈2 weeks)
**Goal:** Know exactly what you're building before writing app code.
- [ ] Finalize `architecture.md` (data flow, data model, auth flow)
- [ ] Design Supabase schema + RLS policies on paper/diagram
- [ ] Set up Figma/Stitch source of truth for design tokens (already largely done via DESIGN.md)
- [ ] Set up Expo project skeleton + navigation structure (empty screens, correct routing)
- [ ] Set up GitHub repo, branch strategy (see `code-standards.md`)

**Exit criteria:** Empty app runs on device via Expo Go with correct navigation between all planned screens.

## Phase 2 — Core Development (≈4 weeks)
Broken into two-week sub-phases to stay trackable.

### Phase 2A — Static UI + Supabase (≈2 weeks)
- [ ] Build all 10 screens as static components matching designs
- [ ] Stand up Supabase project, tables, seed data
- [ ] Connect Home, Category, Filter, Place Details to real Supabase data

### Phase 2B — Auth + Maps + Admin CRUD (≈2 weeks)
- [ ] Integrate Clerk (Google-only), auth guard, role handling
- [ ] Build separate Admin entry point
- [ ] Integrate OpenStreetMap + OpenRouteService (Map view + static Directions)
- [ ] Wire Admin Add/Edit/Delete to Supabase (with photo upload)
- [ ] Enforce RLS (verify non-admins can't write)

**Exit criteria:** End-to-end flow works: sign in → browse/search/filter → view place → get directions; and separately: admin signs in → adds/edits/deletes a place → change reflects for general users.

## Phase 3 — Testing & QA (≈1 week)
- [ ] Functional test pass, both roles, both platforms (iOS/Android)
- [ ] Accessibility audit of the app itself (contrast, touch targets, screen reader labels — practice what the app preaches)
- [ ] Scope-compliance check: no scoring, no LGU-audited claims, no community reporting, no emergency features, no live/voice navigation anywhere in the shipped build
- [ ] Bug fixing pass

**Exit criteria:** No known critical bugs; scope-compliance checklist fully passes.

## Phase 4 — Deployment (≈1 week)
- [ ] Production Supabase environment finalized (or confirm dev environment is acceptable for thesis demo)
- [ ] EAS Build for a shareable build (or finalize Expo Go demo path)
- [ ] Final seed/sample data finalized for demo (per proposal's "use of sample data for development, testing, and deployment demonstration")
- [ ] Documentation finalized (`README`, this doc set)

**Exit criteria:** App is installable/runnable by someone other than the developer, using only the docs.

## Phase 5 — Project Presentation (1 day)
- [ ] Rehearse demo script (search → filter → hospital details → directions → admin edit)
- [ ] Prepare slides/proposal recap
- [ ] Backup plan if live demo fails (recorded screen capture)

---

## Phase Summary Table

| Phase | Focus | Est. Duration |
|---|---|---|
| 0 | Planning & Requirements | 1 week |
| 1 | System Design | 2 weeks |
| 2A | Static UI + Supabase | 2 weeks |
| 2B | Auth + Maps + Admin CRUD | 2 weeks |
| 3 | Testing & QA | 1 week |
| 4 | Deployment | 1 week |
| 5 | Presentation | 1 day |

Matches the proposal's total (~9 weeks + presentation day), same as Section 8 of the proposal document.
