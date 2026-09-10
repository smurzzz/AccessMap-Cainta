---
name: Civic Clarity & High-Contrast Navigation
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444657'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#747689'
  outline-variant: '#c4c5da'
  surface-tint: '#1f41ff'
  primary: '#0028d2'
  on-primary: '#ffffff'
  primary-container: '#1e40ff'
  on-primary-container: '#d2d5ff'
  inverse-primary: '#bcc3ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#005136'
  on-tertiary: '#ffffff'
  tertiary-container: '#006c49'
  on-tertiary-container: '#63f1b4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bcc3ff'
  on-primary-fixed: '#000d60'
  on-primary-fixed-variant: '#0028d3'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.005em
  title-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  link-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  touch-min: 3rem
  margin-mobile: 1rem
  gutter-mobile: 0.75rem
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  bottom-nav-height: 4.25rem
---

## Brand & Style

This design system establishes an accessible-first, civic-utility navigation interface tailored for hyper-local public service facilities (health centers, hospitals, municipal halls) in San Isidro, Cainta, Rizal. The aesthetic rejects decorative clutter, gamified incentives, algorithmic scores, and ambiguous metaphors. Instead, it prioritizes immediate cognitive legibility, high tactile responsiveness, and structural transparency under high-stress situational constraints (e.g., medical emergencies, blinding daylight navigation, low-vision users, and physical mobility impairment).

The style synthesizes high-contrast structural discipline with a calm, utilitarian layout. Generous white space isolates critical information blocks, eliminating visual noise while maintaining strict WCAG AAA contrast ratios. Visual density remains calm and paced: information unfolds in digestible, predictable chunks designed specifically for single-handed thumb-reach navigation on mobile hardware.

## Colors

The palette is engineered to exceed WCAG AA contrast (AAA where feasible) across core functional flows, built on a calm Material-3 blue surface scheme with a strong civic primary.

- **Primary (`#0028d2`) & Primary Container (`#1e40ff`):** Ground the application with a clear civic identity. Used for prominent interactive buttons, the brand mark, and high-priority structural boundaries to guarantee uncompromised optical clarity.
- **On-Surface (`#0b1c30`) on Surface (`#f8f9ff`):** The default text/canvas pairing — deep navy ink on a soft anti-glare off-white canvas that prevents visual fatigue outdoors.
- **Secondary (`#565e74`):** Reserved for neutral, non-active states, tertiary details, and inactive controls.
- **Tertiary (`#005136`) & Tertiary Container (`#006c49`):** Deep emerald accents applied strictly to denote positive binary states ("Available", "Live Network", verified paths) and primary positive actions.
- **Surface Containers (`#eff4ff` → `#d3e4fe`):** Layered blue-tinted surfaces that separate cards, pills, and sheets without relying on diffuse shadows.
- **Outline (`#747689`) / Outline Variant (`#c4c5da`) & Structural Borders (`#e2e8f0`):** Concrete structural rules defining accessible card frames and bottom sheets without introducing perceptual noise.

## Typography

Typography relies entirely on **Inter** (with system sans-serif fallbacks), a humanist sans designed with excellent on-screen legibility, clear open apertures, and distinct character forms that keep scanning fast under low-vision conditions.

- **Generous Spacing & Heights:** All line-height configurations exceed standard system defaults by at least 15–20% to prevent typographic crowding and assist readers with motor-control or tracking issues.
- **Numerical Regularity:** Figures use clear, open apertures and robust strokes, enabling instant scanning of distances, floor levels, street addresses, and hotline numbers across Cainta.
- **Hierarchy Enforcement:** Font size steps are intentional and stark. Labels emphasize heavy weights (`700`) to guarantee legibility at small scale without falling back on unreadable low-contrast uppercase treatments.

## Layout & Spacing

The layout is strictly mobile-first, designed for responsive single-column vertical flows anchored to a 4px horizontal and vertical sub-grid.

- **Margins & Safe Zones:** Screen margins are locked at `16px` (`margin-screen: 1rem`) on phone displays, preserving precious screen real estate while protecting content from peripheral touchscreen mistouches.
- **Touch Target Floor:** Any tappable target (buttons, toggles, route indicators, back buttons) must conform strictly to a minimum boundary box of `48px x 48px` (`touch-min: 3rem`), regardless of the nested visual icon or text dimensions.
- **Thumb Zone Hierarchy:** Destructive or ancillary options reside in the upper third of the layout, while primary navigational interactions, bottom sheets, and route execution bars occupy the lower 40% thumb reach area.
- **Reflow & Breakpoints:** 
  - *Mobile (<640px):* Single continuous column; cards expand across 100% of the available width within 16px lateral padding.
  - *Tablet (640px–1024px):* Maximum container clamp at 640px centered; maintains single-column vertical focus to avoid scattering gaze paths for low-vision users.

## Elevation & Depth

This design system uses **low-contrast structural outlines and planar surface shifts** instead of blurred diffuse drop shadows. Diffuse shadows often degrade under direct outdoor sunlight, creating muddy borders for visually impaired individuals.

1. **Surface Separation via Borders:** Layers rely on explicit 1px or 2px solid lines (`#e2e8f0` or `#0028d2`) to delineate boundaries. 
2. **Surface Planar Stacking:**
   - **Canvas Ground (0):** `#f8f9ff`
   - **Card & Component Surface (1):** `#ffffff` with a crisp 1.5px `#e2e8f0` structural perimeter.
   - **Raised Interactive / Overlay Sheets (2):** `#ffffff` with a high-contrast top boundary (`#0028d2`, 2px) and a deliberate, high-opacity 4px offset hard keyline edge (`rgba(0, 40, 210, 0.08)`) to visually decouple floating modals from base maps without inducing motion sickness or blur.
3. **Focus States:** Every active touch, keyboard, or screen-reader focus receives an unmistakable 3px double outline using `#0028d2` separated by a 2px white offset gap, visible against any map background.

## Shapes

The design system adopts a **Soft (`1`)** shape language (4px to 8px corner radii). Sharp structural geometry conveys official civic reliability and maximizes clear content area, while subtle softening prevents visual harshness:

- **Cards and Bottom Sheets:** `8px` (`rounded-lg`) corner radii on standard containers. Bottom sheets only apply this radius to the top-left and top-right apexes.
- **Buttons and Selectors:** `8px` corner radii, creating predictable touch boundaries that visually reinforce interactive surfaces.
- **Binary Badges and Status Pills:** `4px` corner radii. True full-rounded pills are avoided for data tags so they are not confused with primary pill buttons.

## Components

### 1. Buttons
- **Primary Action Button:** Full-width or inline minimum 48px height. Background `#0028d2`, text `#ffffff`, typography `label-lg`. Focus ring: 3px cobalt highlight.
- **Secondary Action Button:** Minimum 48px height. Background `#ffffff`, border 2px `#0028d2`, text `#0028d2`.
- **Accessibility/Assistance Action Button:** Emerald fill (`#005136`), text `#ffffff`, high-contrast wheelchair or emergency icon paired with literal textual descriptions (e.g., "Request Wheelchair Ramp").

### 2. Binary Status Indicators
- Replaces ambiguous percentage ratings, gamified badges, and star systems with factual, dual-state status labels.
- **Positive State ("Available"):** Container background `#ecfdf5`, border 1.5px `#059669`, text `#065f46`, paired with an explicit solid Checkmark SVG icon.
- **Negative State ("Not Available"):** Container background `#f1f5f9`, border 1.5px `#64748b`, text `#334155`, paired with an explicit Slash/Cross SVG icon. 
- *Rule:* Color must never be the sole differentiator; distinct shape icons and literal text are mandatory.

### 3. Accessible Facility Cards
- Background: `#ffffff`, border: 1.5px `#e2e8f0`, internal padding: 16px.
- Distinct card hierarchy: Top row contains facility title (`headline-sm`) and civic department tag. Middle block contains physical attributes (e.g., "Elevator", "Ramp: Grade 1:12", "Braille Signage") rendered via binary indicators. Bottom block contains single-action navigation triggers.

### 4. Thumb-Friendly Bottom Sheets
- Fixed or multi-snap bottom sheet anchored to lower viewport bounds.
- Top-level persistent drag handle (40px width, 4px height, `#94a3b8`) seated above a prominent close/dismiss target.
- Bottom sheets default to 50% screen height on selection, expanding to 90% without obscuring emergency call buttons.

### 5. Persistent Bottom Tab Bar
- Height: 64px fixed, positioned above mobile OS home indicators. Background: `#ffffff` with a solid 1px `#e2e8f0` top boundary.
- Exactly 3 to 4 destinations (e.g., "Explore Facilities", "Saved Routes", "Emergency Help").
- Active tab uses `#0028d2` stroke with an underlying 3px solid `#005136` indicator line; inactive tabs use `#565e74`. Every icon is paired with a visible `label-sm` text title.

### 6. Inputs & Search Fields
- Minimum height 52px. Border: 2px solid `#0b1c30`, background: `#ffffff`.
- Placeholder text: `#747689`. Clear, high-contrast "Clear Text" button with a dedicated 48px hit area. Never relies on floating labels that reduce font size below 14px.