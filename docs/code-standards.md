# AccessMap — Code Standards

## Language & Tooling
- **TypeScript**, not plain JavaScript, for the whole app.
- **Expo** managed workflow (avoid ejecting unless a native module absolutely requires it).
- **ESLint + Prettier** enabled; run before every commit.
- Package manager: pick one (npm or yarn) and stick to it — don't mix lockfiles.

## Folder Structure
```
accessmap/
├── app/                    # screens (if using Expo Router) or navigation entry
├── src/
│   ├── components/         # shared/reusable UI components
│   │   ├── ui/              # generic (Button, Card, Badge, Toggle...)
│   │   └── features/        # feature-specific (PlaceCard, AccessibilityChecklist...)
│   ├── screens/             # one file per screen (if not using Expo Router)
│   ├── navigation/          # navigators, route types
│   ├── lib/
│   │   ├── supabase.ts       # supabase client init
│   │   ├── clerk.ts           # clerk config
│   │   └── maps.ts            # OpenStreetMap tile config + OpenRouteService directions helpers
│   ├── hooks/                # custom hooks (usePlaces, useAccessibilityFilter...)
│   ├── types/                 # shared TypeScript types (Place, AccessibilityFeature...)
│   ├── constants/              # design tokens, category lists, feature lists
│   └── utils/                   # pure helper functions
├── assets/                       # images, icons, fonts
├── docs/                          # this doc set
├── .env.example
├── app.config.js
└── package.json
```

## Naming Conventions
- Components: `PascalCase.tsx` (e.g. `PlaceCard.tsx`)
- Hooks: `camelCase.ts` starting with `use` (e.g. `usePlaces.ts`)
- Types/interfaces: `PascalCase`, no `I` prefix (e.g. `Place`, not `IPlace`)
- Supabase table/column names: `snake_case` (matches Postgres convention)
- TypeScript variables/functions: `camelCase`

## Component Rules
- Functional components only, with hooks — no class components.
- One component per file, default export matches filename.
- Keep components under ~200 lines; extract subcomponents if it grows past that.
- Props typed explicitly with an interface, not inline object types, when the component has more than 2–3 props.
- No inline arrow functions passed as props inside large lists (e.g. FlatList renderItem) if it causes avoidable re-renders — memoize where it matters, but don't over-optimize prematurely.

## Styling (NativeWind)
- Use Tailwind utility classes via NativeWind's `className` prop — no separate StyleSheet objects unless NativeWind can't express something (e.g. complex shadows, platform-specific tweaks).
- Pull colors, spacing, and font sizes from the design tokens defined in `tailwind.config.js` (sourced from `DESIGN.md`) — never hardcode hex colors or px values inline.
- Match the approved Stitch design system: Atkinson Hyperlegible Next typography, navy/emerald palette, min. 48px touch targets, 16px mobile margins.

## Data Layer Rules
- All Supabase queries go through `src/hooks/` (custom hooks) — screens/components should not call `supabase.from(...)` directly. This keeps data logic testable and swappable.
- Never hardcode Supabase URL/anon key in source — always via `.env` + `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Never trust client-side role checks alone for security — RLS policies in Supabase are the actual enforcement; client-side role checks are only for UI/UX (hiding buttons the user shouldn't see).

## Git Workflow
- `main` branch is always demo-ready.
- Feature branches: `feature/<short-description>` (e.g. `feature/place-filter`).
- Commit messages: short imperative summary (e.g. `Add accessibility filter bottom sheet`), not `fixed stuff` or `wip`.
- Open a PR (even solo) before merging to `main` if working across multiple sessions — gives a paper trail for the thesis documentation too.

## Scope-Compliance Rule (project-specific)
Before merging any UI-facing change, check it against the Out of Scope list in `project-overview.md`. Specifically reject/flag any code or copy that:
- Implies official LGU/government verification or auditing (use "Admin-Verified" language only)
- Adds scoring, percentages, or ranking of accessibility
- Adds user-submitted reports/reviews
- Adds emergency call, SOS, or hotline functionality
- Adds live/voice-guided GPS navigation (directions must remain a static, one-time fetched list)

## Accessibility Rules (the app about accessibility should itself be accessible)
- All interactive elements have accessible labels (`accessibilityLabel`).
- Minimum touch target 48x48.
- Don't rely on color alone to convey status (Available/Not Available) — always pair with an icon and text label.
- Support dynamic font scaling — test with device text size increased.
- Maintain contrast ratios per DESIGN.md (aim for AA at minimum, AAA where feasible).