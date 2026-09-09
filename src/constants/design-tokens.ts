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
