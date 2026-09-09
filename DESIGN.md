---
name: Civic Clarity & High-Contrast Navigation
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#111c2d'
  on-tertiary-container: '#79849a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-xl-mobile:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: 0em
  headline-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0.005em
  body-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0.015em
  label-lg:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  touch-min: 3rem
  margin-screen: 1rem
  gutter-xs: 0.25rem
  gutter-sm: 0.5rem
  gutter-md: 1rem
  gutter-lg: 1.5rem
  gutter-xl: 2rem
  stack-section: 2.5rem
---

## Brand & Style

This design system establishes an accessible-first, civic-utility navigation interface tailored for hyper-local public service facilities (health centers, hospitals, municipal halls) in San Isidro, Cainta, Rizal. The aesthetic rejects decorative clutter, gamified incentives, algorithmic scores, and ambiguous metaphors. Instead, it prioritizes immediate cognitive legibility, high tactile responsiveness, and structural transparency under high-stress situational constraints (e.g., medical emergencies, blinding daylight navigation, low-vision users, and physical mobility impairment).

The style synthesizes high-contrast structural discipline with a calm, utilitarian layout. Generous white space isolates critical information blocks, eliminating visual noise while maintaining strict WCAG AAA contrast ratios. Visual density remains calm and paced: information unfolds in digestible, predictable chunks designed specifically for single-handed thumb-reach navigation on mobile hardware.

## Colors

The palette is engineered to surpass WCAG AAA standards (7:1 contrast ratio for normal text against corresponding backgrounds) across core functional flows. 

- **Primary (`#0f172a`) & Deep Slate (`#1e293b`):** Ground the application with clear informational hierarchy. Used for high-priority typography, critical structural boundaries, and prominent interactive buttons to guarantee uncompromised optical clarity.
- **Vibrant Emerald (`#059669`) & Vivid Accent (`#10b981`):** Applied strictly to denote positive binary states ("Available", "Ramp Access Verified", "Step-free Entrance"), confirmed paths, and primary positive actions. Emerald provides high visibility against slate neutrals without causing chromatic eye strain.
- **Base Neutral Slate (`#f8fafc`):** An anti-glare canvas that softens extreme optical glare outdoors while maintaining stark contrast with primary text.
- **Dividers & Structural Borders (`#e2e8f0`):** Concrete structural rules defining accessible card frames and bottom sheets without introducing perceptual noise.
- **Status Gray (`#94a3b8` / `#64748b` for AAA typography):** Reserved exclusively for neutral, non-active states, tertiary details, and negative binary states ("Not Available", "No Tactile Paving"), ensuring visual neutrality without ambiguity.

## Typography

Typography relies entirely on **Atkinson Hyperlegible Next** (with standard Atkinson Hyperlegible and system humanist sans-serif fallbacks), designed explicitly to eliminate letterform confusion among individuals with visual impairments. Distinctions between similar characters (such as uppercase 'I', lowercase 'l', and number '1') are structurally reinforced.

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

1. **Surface Separation via Borders:** Layers rely on explicit 1px or 2px solid lines (`#e2e8f0` or `#0f172a`) to delineate boundaries. 
2. **Surface Planar Stacking:**
   - **Canvas Ground (0):** `#f8fafc`
   - **Card & Component Surface (1):** `#ffffff` with a crisp 1.5px `#e2e8f0` structural perimeter.
   - **Raised Interactive / Overlay Sheets (2):** `#ffffff` with a high-contrast top boundary (`#1e293b`, 2px) and a deliberate, high-opacity 4px offset hard keyline edge (`rgba(15, 23, 42, 0.08)`) to visually decouple floating modals from base maps without inducing motion sickness or blur.
3. **Focus States:** Every active touch, keyboard, or screen-reader focus receives an unmistakable 3px double outline using `#0f172a` separated by a 2px white offset gap, visible against any map background.

## Shapes

The design system adopts a **Soft (`1`)** shape language (4px to 8px corner radii). Sharp structural geometry conveys official civic reliability and maximizes clear content area, while subtle softening prevents visual harshness:

- **Cards and Bottom Sheets:** `8px` (`rounded-lg`) corner radii on standard containers. Bottom sheets only apply this radius to the top-left and top-right apexes.
- **Buttons and Selectors:** `8px` corner radii, creating predictable touch boundaries that visually reinforce interactive surfaces.
- **Binary Badges and Status Pills:** `4px` corner radii. True full-rounded pills are avoided for data tags so they are not confused with primary pill buttons.

## Components

### 1. Buttons
- **Primary Action Button:** Full-width or inline minimum 48px height. Background `#0f172a`, text `#ffffff`, typography `label-lg`. Focus ring: 3px `#059669`.
- **Secondary Action Button:** Minimum 48px height. Background `#ffffff`, border 2px `#0f172a`, text `#0f172a`.
- **Accessibility/Assistance Action Button:** Emerald fill (`#059669`), text `#ffffff`, high-contrast wheelchair or emergency icon paired with literal textual descriptions (e.g., "Request Wheelchair Ramp").

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
- Active tab uses `#0f172a` stroke with an underlying 3px solid `#059669` indicator line; inactive tabs use `#64748b`. Every icon is paired with a visible `label-sm` text title.

### 6. Inputs & Search Fields
- Minimum height 52px. Border: 2px solid `#1e293b`, background: `#ffffff`.
- Placeholder text: `#64748b`. Clear, high-contrast "Clear Text" button with a dedicated 48px hit area. Never relies on floating labels that reduce font size below 14px.