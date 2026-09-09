# AccessMap Cainta — Project Overview

## What This Is
AccessMap is a mobile application that provides accessibility information for public service facilities — hospitals, health centers, and government offices — in Barangay San Isidro, Cainta, Rizal. Users can browse, search, and filter places by accessibility features (ramps, restrooms, elevators, parking, entrances) before deciding to visit. An administrator maintains the place and accessibility data.

This is a thesis/academic system proposal (IPT2) prepared by Famela M. Otap, Section LFCA411A119, submitted to Noel Montecillo.

## Problem Statement
Accessibility information for public places is often unavailable, incomplete, or hard to find before visiting. This makes it difficult for persons with disabilities, senior citizens, and companions to know whether a location can accommodate their needs.

## Solution
A centralized mobile directory where users can look up verified accessibility details for public places — prioritizing hospitals, health centers, and government offices — before they travel there.

## Platform
**Mobile Application** (React Native via Expo, iOS + Android from one codebase).

## Core User Roles

| Role | Description |
|---|---|
| **General User** | Signs in with Google, browses/searches/filters places, views place details and accessibility info, gets directions/navigation. |
| **Administrator** | Signs in (same app, separate entry point), adds/edits/deletes place records and accessibility data. |

## In-Scope Features (summary)
- Google Sign-In only (via Clerk) — no email/password
- Browse & search public places, prioritized categories: Hospitals, Health Centers, Government Offices (Schools, Malls, Churches, Parks as secondary)
- Filter by accessibility feature (Ramps, Restroom/CR, Elevator, Parking, Entrance)
- Place details with accessibility checklist (Available / Not Available — no scores)
- Map view of place location (OpenStreetMap)
- Get Directions → static step-by-step turn instructions (no live GPS tracking, no voice navigation)
- Admin: add/edit/delete places and accessibility data

## Explicitly Out of Scope
- Automatic accessibility scoring/ranking/certification
- User-generated reports, reviews, or community feedback
- Live/voice-guided turn-by-turn navigation (Waze-style)
- Emergency call, hotline, or SOS features
- Booking/reservations, payments
- Integration with actual government/LGU systems (no real official verification — data is admin-entered only)
- Transportation/commuter routing
- Real-time accessibility condition monitoring

> **Important framing rule:** Nothing in the UI should imply official government verification, LGU audits, or automated/algorithmic verification of accessibility data. All accessibility info is manually entered and maintained by the app's own administrator. Use wording like "Admin-Verified Listings," never "LGU Audited" or "Municipal Verified Data."

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Frontend | React Native (via Expo) |
| Styling | NativeWind (Tailwind for RN) |
| Backend / DB / API | Supabase (PostgreSQL, auto-generated REST API, storage) |
| Supplementary Backend Logic | Node.js (only where Supabase's built-ins aren't enough) |
| Authentication | Clerk (Google OAuth only) |
| Maps & Directions | OpenStreetMap (map tiles) + OpenRouteService (Directions API) — free, no billing account required |
| Version Control | GitHub |
| Design | Figma |
| API Testing | Postman |

## Target Location
Barangay San Isidro, Cainta, Rizal — places listed are scoped to this barangay/municipality for the thesis deliverable; sample/seed data will be used for development and demo.

## Related Documents
- `architecture.md` — system architecture and data flow
- `build-plan.md` — how the system will be built, in order
- `phase-plan.md` — phase-by-phase plan from 0 to finish
- `code-standards.md` — coding conventions for this project
- `library-docs.md` — reference links/notes for each library used
- `progress-tracker.md` — living checklist of what's done
- `agent.md` — instructions for any AI coding agent (e.g. Claude Code) working on this repo
