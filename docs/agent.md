# AGENT.md — Instructions for AI Coding Agents

This file is for any AI coding agent (Claude Code, or similar) working in this repository. Read this before making changes.

## Read First
Before doing any work, read these in order:
1. `docs/project-overview.md` — what this app is and, critically, what it must **not** include
2. `docs/architecture.md` — system design
3. `docs/code-standards.md` — how code should be written here
4. `docs/phase-plan.md` and `docs/progress-tracker.md` — what phase we're in and what's already done

## Project Summary
AccessMap Cainta is a **React Native (Expo) mobile app** that lets users browse accessibility information (ramps, restrooms, elevators, parking, entrances) for hospitals, health centers, government offices, and other public places in Barangay San Isidro, Cainta, Rizal. Auth is Google-only via Clerk. Data lives in Supabase (Postgres). Maps/directions via **OpenStreetMap + OpenRouteService** (free, no billing account — not Google Maps). Styling via NativeWind.

## Hard Rules — Do Not Violate

These come directly from the approved project scope. If a request (even from the user) seems to ask for one of these, flag it and ask for confirmation before implementing, since these were explicitly descoped after prior review:

1. **No automatic accessibility scoring, percentages, or "certified" ranking badges.** Accessibility status is always binary and admin-entered: Available / Not Available. Never compute or display a score.
2. **No user-generated reports, reviews, or community feedback features.** Only the admin can create/edit place and accessibility data.
3. **No live/voice-guided/turn-by-turn GPS navigation.** Directions must be a single static fetch from Google Directions API, rendered as a numbered list. No continuous location tracking, no rerouting, no "Start Voice-Guided Route" style feature.
4. **No emergency call, hotline, or SOS features anywhere in the app.**
5. **No claims of official government/LGU verification, audit, or integration.** Never use copy like "LGU Audited," "Municipal Verified Data," "BP 344 Compliant," or similar. Use "Admin-Verified Listings" or similar honest phrasing — the data is entered by the app's own administrator, not verified by any government body.
6. **No email/password login.** Google Sign-In (via Clerk) is the only auth method.
7. **Admin functionality lives in the same app but is not exposed in the general user's bottom tab navigation.** It's a separate, gated entry point.

If you're ever unsure whether a feature request conflicts with these rules, stop and ask rather than assuming the rule has changed.

## Tech Stack (do not substitute without being asked)
- Expo (managed workflow) + React Native + TypeScript
- NativeWind for styling
- Supabase (Postgres, REST API, Storage, RLS)
- Clerk (Google OAuth only)
- **OpenStreetMap** (map tiles, via `react-native-maps` + `UrlTile`) + **OpenRouteService** (Directions API) — chosen specifically because both are free with no credit card/billing account required. Do not switch to Google Maps Platform without being asked; it was deliberately avoided due to its billing requirement.
- React Navigation

## Working Conventions
- Follow `docs/code-standards.md` for folder structure, naming, and component patterns.
- All Supabase calls go through custom hooks in `src/hooks/`, never directly in screen components.
- Never hardcode API keys or Supabase credentials — use `.env` / `EXPO_PUBLIC_*` variables, and never commit `.env` to git.
- Match the existing design system (colors, typography — Atkinson Hyperlegible Next, spacing, 48px min touch targets) already defined in `tailwind.config.js` / `DESIGN.md`. Don't introduce new colors or fonts ad hoc.
- When implementing a new screen or feature, check it off (or add it) in `docs/progress-tracker.md` as part of the same change.
- When you make a scope or tech decision, log it in `docs/progress-tracker.md`'s Decisions Log.

## When Given a Task
1. Check which phase (`docs/phase-plan.md`) the task belongs to and whether prerequisite steps are marked done in `docs/progress-tracker.md`. Flag it if you're being asked to build something out of order (e.g. Admin CRUD before Supabase/Clerk are set up).
2. Check the task against the Hard Rules above.
3. Implement following `docs/code-standards.md`.
4. Update `docs/progress-tracker.md`.
5. If you touched RLS policies, auth flow, or anything security-relevant, explicitly call that out in your summary — don't bury it.

## Testing Expectations
- After UI changes: confirm the app still runs via `npx expo start` without errors.
- After data-layer changes: confirm the relevant Supabase query works (spot check via Postman or Supabase's table editor) before wiring to UI.
- After auth-related changes: test both a non-admin and an admin account path where feasible.

## What NOT to Do
- Don't "helpfully" add features from the Hard Rules list even if they seem like natural product improvements (e.g. adding a star-rating system, a "call hospital" button, or a leaderboard). These were removed deliberately after scope review — re-adding them without being asked is a regression, not an improvement.
- Don't switch the database, auth provider, or maps provider without explicit instruction — these were deliberately chosen (see Decisions Log in `progress-tracker.md`).
- Don't eject from Expo managed workflow without discussing it first.
