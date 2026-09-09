# AccessMap Cainta — Phased Build Plan

A sequenced set of phases, each with a ready-to-paste prompt (for Claude Code, Cursor, or this chat). Do them in order — each phase assumes the previous one is done and working before moving on. Don't skip ahead; UI phases depend on the design system from Phase 3.5, and most data-driven phases depend on real data existing in Supabase from Phase 2 onward.

Reference `agent.md` and `docs/DESIGN.md` in every phase — they're the source of truth for structure, tech stack, data model, scope rules, and visual design. If a prompt below conflicts with either, those files win; update this plan instead of drifting.

---

## Phase 0 — Project Setup
**Goal:** A running Expo app with the full stack installed and env vars in place. No features yet.

```
Set up a fresh Expo project (TypeScript template, Expo Router, managed workflow) in
this folder. Install and configure: nativewind, tailwindcss, @supabase/supabase-js,
@clerk/clerk-expo, expo-secure-store, react-native-maps, zod, @react-navigation/native,
@react-navigation/bottom-tabs, @react-navigation/native-stack. Create a .env.example
template with placeholders for EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_ORS_API_KEY (OpenRouteService — no
Google Maps API key is used in this project). Set up the folder structure exactly as
described in code-standards.md. Confirm `npx expo start` runs cleanly on iOS/Android
simulator or Expo Go with no errors before moving on.
```

**Done when:** `npx expo start` opens the app with no console errors, and `.env.example` lists all four variables (values can be placeholders for now).

---

## Phase 1 — Supabase Schema
**Goal:** Real tables in Supabase matching the data model in `architecture.md` §3.

```
Using the data model in architecture.md section 3, write Supabase migration SQL for
the places, accessibility_features, and users tables — including the foreign key from
accessibility_features to places, the enum/check constraints on category
(hospital | health_center | government | school | mall | church | park) and feature_type
(ramp | restroom | elevator | parking | entrance | other), and the unique constraint
on users.clerk_user_id. Enable Row Level Security on all three tables with the policies
described in library-docs.md (public read access on places/accessibility_features,
admin-only write). Save it as supabase/migrations/0001_init.sql. Then walk me through
running it against my Supabase project (via the Supabase CLI or the SQL editor).
```

**Done when:** you can see `places`, `accessibility_features`, and `users` tables in the Supabase dashboard, RLS is shown as enabled on all three, and the policies are visible in the Supabase dashboard's Policies tab.

---

## Phase 2 — Seed Data
**Goal:** Enough realistic sample data to build and demo against, prioritizing hospitals, health centers, and government offices in San Isidro, Cainta.

```
Write supabase/seed.sql with at least 12 sample places for Barangay San Isidro,
Cainta, Rizal: 4 hospitals/health-related, 3 barangay health centers, 3 government/
civic offices, plus 2 secondary places (school, mall, church, or park — pick any 2).
Each place needs a name, category, description, address, plausible latitude/longitude
within Cainta, Rizal, and operating_hours. Each place needs 3-5 rows in
accessibility_features covering ramps, restroom, parking, entrance, and elevator,
with a realistic mix of available/not_available statuses (don't make everything
available — some places should be missing an elevator or parking, matching how the
proposal's sample data should look). Insert one admin row into users with role='admin'
using a placeholder clerk_user_id I'll replace later. Run this against the Supabase
project from Phase 1 and confirm the row counts.
```

**Done when:** querying `places` in Supabase returns 12+ realistic San Isidro rows, each with matching rows in `accessibility_features`, and one `admin` row exists in `users`.

---

## Phase 3 — Static Screens (no backend wiring yet)
**Goal:** All 10 approved screens exist as static components with mock data, click-through-able.

```
Using DESIGN.md and the approved Stitch screens already reviewed in this
conversation, build these 10 screens as static components with hardcoded mock data
(no Supabase/Clerk/Maps calls yet): Login, Home/Place Directory, Browse by Category,
Accessibility Filter (bottom sheet), Place Details, Map/Location View, Turn-by-Turn
Directions, Profile, Admin Dashboard (Facility Directory list), and Add/Edit Place
form. Match the confirmed layout, spacing, and copy from the reviewed designs exactly
— including "Admin-Verified Listings" wording (never "LGU Audited" or "Municipal
Verified"), Available/Not Available accessibility indicators (no scores or
percentages), and no emergency call, community report, or live-navigation UI anywhere.
Wire up navigation between screens (bottom tabs for Home/Filter/Map/Profile, stack
navigation for Place Details/Directions/Admin) using mock data and placeholder
onPress handlers.
```

**Done when:** the app is fully click-through-able on device via Expo Go, all 10 screens visually match the approved designs, and no out-of-scope copy (scoring, LGU-audited claims, community reports, emergency features) appears anywhere.

---

## Phase 3.5 — Design System Lock-In
**Goal:** Tailwind config formally matches `docs/DESIGN.md` so every screen pulls from the same tokens instead of ad hoc values.

```
Using DESIGN.md (Stitch export design system), configure tailwind.config.js with
the confirmed colors (primary navy #0F2942, secondary/accessibility green #059669,
tertiary/wayfinding blue #2563EB, neutral surfaces #F8FAFC/#FFFFFF, focus amber
#D97706), the Atkinson Hyperlegible Next font family across all text levels, the
spacing scale (8pt grid, 48px minimum touch target), and the two-tier radius scale
(8px for buttons/inputs/badges, 16px for cards/sheets/panels). Then audit all 10
screens built in Phase 3 and replace any hardcoded hex colors, px values, or inline
font sizes with the corresponding NativeWind utility classes from this config.
```

**Done when:** grepping the codebase for hex color literals or hardcoded font sizes outside `tailwind.config.js` returns nothing, and all 10 screens still render correctly.

---

## Phase 4 — Supabase Data Wiring (read-only screens)
**Goal:** Home, Category, Filter, and Place Details show real Supabase data instead of mocks.

```
Create src/lib/supabase.ts (client init using EXPO_PUBLIC_SUPABASE_URL and
EXPO_PUBLIC_SUPABASE_ANON_KEY) and custom hooks in src/hooks/: usePlaces (list,
optionally filtered by category), usePlace (single place by id, with its
accessibility_features joined), and useAccessibilityFilter (places filtered by
selected feature types, per architecture.md section 4). Wire these into the Home,
Browse by Category, Accessibility Filter, and Place Details screens from Phase 3,
replacing all mock data. Add loading and empty states (no results / still loading)
to each screen per code-standards.md's accessibility rules.
```

**Done when:** Home shows the real 12+ seeded places, category chips filter correctly, the accessibility filter sheet actually narrows results against real data, and tapping a place shows its real details and accessibility checklist.

---

## Phase 5 — Clerk Auth (Google-only)
**Goal:** Real Google Sign-In gates the app; role (user/admin) is read from Supabase.

```
Set up Clerk in this Expo app per their Expo quickstart, with only Google OAuth
enabled (disable email/password and any other method in the Clerk dashboard — confirm
this in your response). Wrap the app in ClerkProvider using
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Wire the Login screen's "Continue with Google"
button to real Clerk sign-in. Add an auth guard: unauthenticated users see only the
Login screen; authenticated users land on Home. After sign-in, look up the user's
role from the users table in Supabase by clerk_user_id (insert a new row with
role='user' if none exists yet, per architecture.md section 2.2). Store the resolved
role in app state/context so screens can read it.
```

**Done when:** you can sign in with a real Google account, land on Home, and confirm in Supabase that a matching row now exists in `users` with the correct `clerk_user_id`.

---

## Phase 6 — Admin Entry Point + CRUD
**Goal:** Admins reach a separate (non-tab-bar) entry point and can add/edit/delete places.

```
Build a separate Admin entry point that is NOT part of the general user's bottom tab
bar, reachable only when the signed-in user's role (from Phase 5) is 'admin' — per
architecture.md section 2.2 and agent.md's Hard Rules. Wire the Admin Dashboard's
Facility Directory list to real Supabase data (all places, with edit/delete actions).
Wire the Add/Edit Place form to insert/update rows in places and
accessibility_features. Add photo upload to a place-photos bucket in Supabase Storage
for the Entrance Photo Upload field, and store the resulting URL on the place row.
Wire the Delete action with a confirmation prompt. Manually update the seeded admin
user's clerk_user_id in Supabase to match your real signed-in Clerk user so you can
test the admin flow end to end.
```

**Done when:** signed in as the admin account, you can add a new place with a photo, see it immediately appear for a general user account, edit its accessibility features, and delete it — and confirm that a non-admin account cannot reach the Admin entry point or perform any write (test the RLS policy by attempting a write from a non-admin session).

---

## Phase 7 — OpenStreetMap + OpenRouteService Directions
**Goal:** Real map pins and a static, one-time-fetched step-by-step directions screen — using free, no-billing-required services.

```
Add react-native-maps with a MapView using a UrlTile child component pointed at the
OpenStreetMap tile server (https://tile.openstreetmap.org/{z}/{x}/{y}.png) — no API
key needed for map display. Wire the Map/Location View screen to show the selected
place pinned using its real latitude/longitude. Request device location permission
with a clear rationale prompt (used only to compute a route, not for continuous
tracking). On "Get Directions," call the OpenRouteService Directions API v2
(configured with EXPO_PUBLIC_ORS_API_KEY) once with origin = current device location
and destination = the place's coordinates; parse the response's
features[].properties.segments[].steps[] into a numbered list (distance + the
instruction string, which ORS already returns as plain text) and render it on the
Turn-by-Turn Directions screen from Phase 3. Map each step's type field to a simple
directional icon (turn left/right/straight/arrive). Do not add any live location
tracking, rerouting, or voice guidance — this must remain a single static fetch per
agent.md's Hard Rules.
```

**Done when:** tapping a place's pin shows the correct location on a real OpenStreetMap-based map, and tapping "Get Directions" shows a real numbered list of turn instructions with distance/time, fetched once via OpenRouteService — refreshing or moving the device does not change the displayed route.

---

## Phase 8 — Profile Screen + Sign Out
**Goal:** Real Clerk user info displayed; working sign-out.

```
Wire the Profile screen from Phase 3 to show the real signed-in user's Google name,
email, and avatar from Clerk. Wire the Log Out action to Clerk's sign-out method and
confirm it correctly returns the user to the Login screen (auth guard from Phase 5
should handle this automatically — verify it does).
```

**Done when:** Profile shows your real Google account info, and tapping Log Out returns you to Login and blocks access to Home/Admin until you sign in again.

---

## Phase 9 — Scope-Compliance & Accessibility Audit
**Goal:** Catch any drift back toward out-of-scope features or inaccessible UI before QA.

```
Audit the entire app against agent.md's Hard Rules and code-standards.md's
Accessibility Rules. Specifically check for and remove/fix: any scoring or
percentage display, any "LGU Audited"/"Municipal Verified"/official-verification
wording, any user-submitted report or review UI, any emergency call/SOS/hotline
element, any live or voice-guided navigation behavior, any email/password login
remnant, missing accessibilityLabel props on interactive elements, touch targets
under 48px, and any place where accessibility status is conveyed by color alone
without an accompanying icon/text label. List everything found and fixed.
```

**Done when:** the audit response confirms zero remaining violations of agent.md's Hard Rules, and a manual pass through the app confirms it.

---

## Phase 10 — Testing & Polish
**Goal:** Loading/error states everywhere, both platforms tested, known bugs fixed.

```
Audit every data-fetching screen (Home, Category, Filter, Place Details, Admin
Dashboard) for: a skeleton or spinner loading state, an explicit error state (e.g.
Supabase request fails), and an empty state (e.g. filter matches zero places). Fix
any screen missing one of these. Then walk through the full General User flow
(sign in → browse → filter → view details → get directions → sign out) and the full
Admin flow (sign in → add place → edit place → delete place → sign out) on both iOS
and Android (simulator or Expo Go), and list any bugs found.
```

**Done when:** both flows complete without errors on both platforms, and every data-driven screen has visible loading/error/empty handling.

---

## Phase 11 — Deployment Prep
**Goal:** A shareable build (or confirmed Expo Go demo path) ready for the thesis presentation.

```
Set up EAS Build for this project (eas.json + app.config.js updates as needed) and
produce a preview build I can install on a physical device, OR — if EAS isn't
feasible in the time remaining — confirm and document the exact steps to run the app
live via Expo Go for the presentation, including which device/network setup is
needed. Finalize the seed data in Supabase so the demo tells a clean story: search
→ filter → view a hospital's accessibility details → get directions → admin adds a
new place live. Update progress-tracker.md to reflect everything completed.
```

**Done when:** you have either an installable build or a confirmed, tested Expo Go demo path, seed data supports a clean live demo, and `progress-tracker.md` is fully up to date.

---

## Still-open scope (resolve before the phase that needs them)
These are things worth deciding explicitly rather than letting an agent guess mid-phase:
1. **Supplementary Node.js backend** — architecture.md marks this as optional. Decide before Phase 7 whether the Google Directions API call happens client-side (with a restricted key) or through a small proxy endpoint. Default to client-side unless a specific reason comes up.
2. **Admin self-provisioning** — currently, becoming an admin requires manually editing a row in Supabase (see Phase 6). Decide if this is acceptable for the thesis demo or if a simple internal admin-invite mechanism is worth building — default is manual, per agent.md.
3. **Multiple admins** — proposal assumes a single administrator role; confirm before Phase 6 if more than one admin account is needed for the demo.

## How to use this file
- Copy one phase's prompt at a time into Claude Code (or this chat) — don't paste multiple phases at once.
- After each phase, verify the "Done when" condition before starting the next.
- If a phase reveals `architecture.md` or `agent.md` needs updating (new table column, new rule, changed nav), update those files immediately — don't let this plan drift out of sync with the real code.
- Check off each phase in `progress-tracker.md` as you complete it.
