# AccessMap — Cainta

An accessibility directory app for Barangay San Isidro, Cainta, Rizal: find hospitals, health centers, government offices, schools, and parks — with admin-verified accessibility information (ramps, accessible restrooms, parking, entrances, elevators) and one-shot walking directions.

Built for a thesis presentation. Mobile-first (Android), with a web build also available.

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Expo (SDK 57) + React Native + TypeScript + Expo Router |
| Styling | NativeWind (Tailwind) over a locked design-token system (`src/constants/design-tokens.ts`, `docs/DESIGN.md`) |
| Database | Supabase (Postgres) with Row Level Security — public read, admin-only write |
| Auth | Clerk (`@clerk/clerk-expo`), Google sign-in only |
| Maps | WebView + Leaflet over OSM data (Stadia Alidade Smooth tiles, CARTO fallback) |
| Directions | OpenRouteService (key optional) with automatic keyless OSRM fallback |
| Builds | EAS Build (`eas.json`) — Android preview APK |

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the real values
npx expo start
```

Open on a phone with **Expo Go** (scan the QR code), on an Android emulator, or in a browser (`w`).

### Environment variables

All are read from `.env` (see `.env.example`). Only `EXPO_PUBLIC_*` vars are bundled into client builds; the same four keys are configured in EAS for cloud builds (`eas env`).

| Variable | Used for | Required |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Database connection | yes |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Database access (RLS applies) | yes |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Google sign-in | yes |
| `EXPO_PUBLIC_ORS_API_KEY` | Pedestrian routing quality | no — falls back to free keyless OSRM |
| `EXPO_PUBLIC_STADIA_API_KEY` | Basemap tiles | no — falls back to CARTO Voyager |

## Database

Schema and RLS live in `supabase/migrations/`; demo data (12 San Isidro places + accessibility features) in `supabase/seed.sql`. Run both in the Supabase SQL editor.

## Installing the Android APK

The presentation build is produced by EAS:

```bash
eas build --platform android --profile preview   # installable .apk
eas build --platform android --profile production # Play-store .aab
```

Download the latest APK from the [EAS builds dashboard](https://expo.dev/accounts/henry26/projects/accessMap/builds), then on the device allow **Install unknown apps** for the browser and install.

## Documentation

- `docs/demo-guide.md` — thesis presentation run-of-show and device checklist
- `docs/phased-build-plan.md` — the phased plan this project was built against
- `docs/progress-tracker.md` — what is done and what remains
- `docs/architecture.md`, `docs/DESIGN.md`, `docs/code-standards.md` — source-of-truth docs

## Scope notes

Deliberately out of scope (per the project rules): accessibility scoring/percentages, community reports/reviews, emergency calling, and live turn-by-turn navigation. Accessibility status is binary and admin-verified.
