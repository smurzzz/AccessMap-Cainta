# Phase 10 — Testing & Polish Report

**Date:** 2026-09-16
**Scope:** Loading/error/empty-state audit of every data-fetching screen + flow verification (General User, Admin).

---

## 1. States audit — every data-driven screen

Legend: ✅ present · ➕ added this phase.

| Screen | Loading | Error (+ retry) | Empty | Notes |
|---|---|---|---|---|
| Home | ✅ `LoadingState` | ✅ ➕ retry button | ✅ filter-aware empty | Retry calls `usePlaces().reload` |
| Category | ✅ `LoadingState` | ✅ ➕ retry button | ✅ "no facilities registered yet" | Was missing retry |
| Explore | ✅ `LoadingState` | ✅ ➕ pull-to-refresh + retry | ✅ "no facilities match filters" | `RefreshControl` on web+native |
| Filter sheet | ✅ (lives over Home data) | ✅ via Home/Explore | ✅ "no facilities match" | Sheet itself has no fetch |
| Place Details | ✅ `LoadingState` | ✅ ➕ retry button | ✅ "facility could not be found" | `usePlace` gained `reload()` |
| Map | ✅ `LoadingState` | ✅ overlay | ✅ "No matching places" overlay | Map WebView now stays mounted on zero results (no unmount/remount churn) |
| Map search | — | — | ✅ suggestions dropdown | Search selects/pins the matching place (fixed earlier this phase) |
| Directions | ✅ route fetch state | ✅ error + permission states | ✅ (n/a — route result) | Retry affordance present |
| Profile | — | ✅ sign-out failure alert | ✅ saved-places empty state | |
| Admin — Directory | ✅ `LoadingState` | ✅ (analytics dir reload) | ✅ both "no places" and "no search match" | Delete failure → Alert |
| Admin — Analytics | ✅ "Syncing…" counters | ✅ `EmptyState` | ✅ zero-facility state | |
| Admin — Place form | ✅ `LoadingState` | ✅ save-failure Alert + not-found state | ✅ not-found state | |
| Login | — | ✅ inline sign-in error (verified live) | — | |

**Result:** every data-fetching screen now has all three states; every read screen has a retry path (button or pull-to-refresh).

## 2. Fixes applied this phase

1. **`src/hooks/usePlace.ts`** — added `reload()` (attempt counter, same pattern as `usePlaces`).
2. **`src/screens/place-details-screen.tsx`** — "↻ Try Again" button on load error.
3. **`src/screens/category-screen.tsx`** — "↻ Try Again" button on load error.
4. **`src/screens/explore-screen.tsx`** — pull-to-refresh (`RefreshControl`) so a failed load is always recoverable.
5. **`src/screens/home-screen.tsx`** — "↻ Try Again" button on load error.
6. **`src/screens/map-screen.tsx`** (earlier this phase, committed as `97a8540`) — search suggestions dropdown, search overrides `?place=` route param, map stays mounted on zero results, keyboard dismiss on select/submit.

## 3. Verification performed

- `npx tsc --noEmit` — clean.
- `npx eslint` on all touched files — clean.
- **Web smoke test** (Expo dev server, Chrome preview):
  - Splash → onboarding (3 steps) → login: renders correctly, all controls reachable.
  - Failed Google sign-in shows the inline error, no crash, button recovers.
  - Auth guard: deep-linking to `/(tabs)/map` while signed out correctly bounces to splash — authenticated routes are not reachable pre-auth.
- **Static flow wiring check** (all `router.push/back/replace` calls reviewed):
  - General User: login → Home → category/filter → place details → map (`?place=`) → directions → profile sign out — every leg is wired.
  - Admin: profile → `/admin/tabs` → directory → add (`/admin/place-form`) / edit (`params.id`) / delete (confirm Alert) → settings sign out — every leg is wired.

## 4. Not verifiable from this environment (needs human/device)

Real Google OAuth (needs a live Google account), so everything behind the session could only be statically reviewed on web: authenticated Home/Category/Details/Directions, admin CRUD against live Supabase, RLS non-admin write denial, and the iOS/Android device flows (no simulators available here).

**Manual device-test checklist (iOS + Android via Expo Go):**
1. Sign in with a real Google account → lands on Home; check `users` row created with correct role.
2. Home: browse, search a name, tap feature chips, open Filter sheet → apply → verify results narrow (AND semantics).
3. Place Details: open a hospital → verify features list, "Open in map", "Get Directions".
4. Map: search "Brookside" → pick suggestion → map flies + card updates; tap a pin; recenter.
5. Directions: allow location → verify numbered steps render once; deny permission → verify permission state.
6. Sign out → verify return to login and that deep links are blocked again.
7. Admin: sign in with the admin account → add a place with photo → verify it appears for a user account → edit features → delete with confirm.
8. RLS: attempt a write from a non-admin session → expect failure.
9. Airplane-mode check: each screen shows its error state with a working retry.

## 5. Bugs found

None new beyond the ones fixed in §2. Open items are testability blockers (OAuth + devices), not code defects.
