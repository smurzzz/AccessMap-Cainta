// Runtime access to the single source of truth used by NativeWind.
// The values are loaded from tailwind.config.js so React Native styles cannot drift.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwind = require('../../tailwind.config.js') as {
  theme: {
    extend: {
      colors: Record<string, string | Record<string, string>>;
      fontSize: Record<string, [string, { lineHeight: string; fontWeight: string }]>;
    };
  };
};

const colors = tailwind.theme.extend.colors;
const fontSize = tailwind.theme.extend.fontSize;

const color = (name: string): string => {
  const value = colors[name];
  return typeof value === 'string' ? value : value[0];
};

export const DesignColors = {
  canvas: (colors.neutral as Record<string, string>)[50],
  card: (colors.neutral as Record<string, string>)[0],
  ink: color('ink'),
  muted: color('muted'),
  line: color('border'),
  slate: color('surface-muted'),
  navy: color('primary'),
  deepSlate: color('primary-deep'),
  green: color('secondary'),
  accent: color('secondary-accent'),
  blue: color('tertiary'),
  amber: color('focus'),
  mint: color('secondary-container'),
  paleMint: color('pale-mint'),
  softBorder: color('soft-border'),
  softGray: color('soft-gray'),
  toggleOff: color('toggle-off'),
  selected: color('selected'),
  white: color('white'),
  statusPosBg: color('status-pos-bg'),
  statusPosBorder: color('status-pos-border'),
  statusPosText: color('status-pos-text'),
  statusNegBg: color('status-neg-bg'),
  statusNegBorder: color('status-neg-border'),
  statusNegText: color('status-neg-text'),
  mapSurface: color('map-surface'),
  mapBorder: color('map-border'),
  mapLabel: color('map-label'),
  statusGray: color('status-gray'),
  matchSurface: color('match-surface'),
} as const;

export const DesignType = Object.fromEntries(
  Object.entries(fontSize).map(([name, [size]]) => [name, Number.parseInt(size, 10)]),
) as Record<keyof typeof fontSize, number>;

// Material-3 palette from the updated Stitch design system (see DESIGN.md YAML).
export const M3 = {
  primary: color('mat-primary'),
  onPrimary: color('mat-on-primary'),
  primaryContainer: color('mat-primary-container'),
  onPrimaryContainer: color('mat-on-primary-container'),
  primaryFixed: color('mat-primary-fixed'),
  primaryFixedDim: color('mat-primary-fixed-dim'),
  onPrimaryFixed: color('mat-on-primary-fixed'),
  onPrimaryFixedVariant: color('mat-on-primary-fixed-variant'),
  inversePrimary: color('mat-inverse-primary'),
  secondary: color('mat-secondary'),
  onSecondary: color('mat-on-secondary'),
  secondaryContainer: color('mat-secondary-container'),
  onSecondaryContainer: color('mat-on-secondary-container'),
  tertiary: color('mat-tertiary'),
  onTertiary: color('mat-on-tertiary'),
  tertiaryContainer: color('mat-tertiary-container'),
  onTertiaryContainer: color('mat-on-tertiary-container'),
  tertiaryFixed: color('mat-tertiary-fixed'),
  onTertiaryFixed: color('mat-on-tertiary-fixed'),
  tertiaryFixedDim: color('mat-tertiary-fixed-dim'),
  error: color('mat-error'),
  onError: color('mat-on-error'),
  errorContainer: color('mat-error-container'),
  onErrorContainer: color('mat-on-error-container'),
  background: color('mat-background'),
  onBackground: color('mat-on-background'),
  surface: color('mat-surface'),
  surfaceDim: color('mat-surface-dim'),
  surfaceBright: color('mat-surface-bright'),
  surfaceContainerLowest: color('mat-surface-container-lowest'),
  surfaceContainerLow: color('mat-surface-container-low'),
  surfaceContainer: color('mat-surface-container'),
  surfaceContainerHigh: color('mat-surface-container-high'),
  surfaceContainerHighest: color('mat-surface-container-highest'),
  onSurface: color('mat-on-surface'),
  onSurfaceVariant: color('mat-on-surface-variant'),
  surfaceVariant: color('mat-surface-variant'),
  surfaceTint: color('mat-surface-tint'),
  inverseSurface: color('mat-inverse-surface'),
  inverseOnSurface: color('mat-inverse-on-surface'),
  outline: color('mat-outline'),
  outlineVariant: color('mat-outline-variant'),
  loginBorder: color('login-border'),
} as const;
