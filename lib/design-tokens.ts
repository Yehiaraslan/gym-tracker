/**
 * ============================================================
 * Banana Pro — Design Tokens
 * ------------------------------------------------------------
 * Single source of truth for spacing, radii, shadows, gradients,
 * and typography constants. Matches the CSS design system.
 *
 * Colors live in theme.config.js → useColors(). Everything else
 * lives here so components import from one place.
 * ============================================================
 */

// ── SPACING — 4px base grid ────────────────────────────────
export const Space = {
  _0: 0,
  _1: 4,
  _2: 8,
  _3: 12,
  _4: 16,
  _5: 20,
  _6: 24,
  _7: 28,
  _8: 32,
  _10: 40,
  _12: 48,
  _16: 64,
} as const;

/** Shortcut aliases used across the app */
export const Gutter = Space._4;          // 16 — horizontal screen padding
export const CardPad = Space._4;         // 16 — standard card padding
export const CardPadLg = Space._5;       // 20 — hero card padding
export const Stack = Space._3;           // 12 — between stacked cards
export const StackLg = Space._4;         // 16 — larger card gap

// ── RADII — progression: bar → pill → button → card → hero ─
export const Radius = {
  none: 0,
  bar: 4,
  chip: 8,
  pill: 10,
  button: 12,
  card: 14,
  hero: 16,
  modal: 20,
  fab: 28,
  full: 9999,
} as const;

// ── ELEVATION / SHADOWS ────────────────────────────────────
// React Native shadows (iOS). For Android, use `elevation`.
export const Shadow = {
  none: {},
  /** Primary CTA — lime-colored shadow */
  cta: (color = '#C8F53C') => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  }),
  /** CTA pressed state — tighter */
  ctaPress: (color = '#C8F53C') => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 6,
    elevation: 4,
  }),
  /** FAB — soft black shadow */
  fab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  /** Card — subtle depth */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  /** Stat bar glow — used when value ≥ 80 */
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  }),
  /** Streak fire text shadow — used when streak ≥ 7 */
  fire: {
    textShadowColor: '#F59E0B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
} as const;

// ── TYPOGRAPHY SCALE ───────────────────────────────────────
// Sizes tuned for mobile; matches the CSS --fs-* tokens.
export const FontSize = {
  display: 32,    // splash / launch
  hero: 22,       // "Upper A" hero title
  title: 18,      // card titles, player name
  section: 16,    // section headers
  body: 14,       // primary reading text
  bodySm: 13,     // muted / secondary text
  meta: 12,       // timestamps, units
  eyebrow: 11,    // "TODAY'S QUEST"
  tiny: 9,        // sub-labels, unit captions
} as const;

export const LineHeight = {
  tight: 1.12,
  snug: 1.25,
  body: 1.45,
} as const;

export const LetterSpacing = {
  eyebrow: 1,       // uppercase eyebrows
  stat: 0.4,        // stat labels (STR, END, etc.)
  tight: -0.2,      // tight headlines
  display: -0.5,    // large display type
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semi: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

// ── SEMANTIC COLOR CONSTANTS ───────────────────────────────
// These are colors that aren't in the theme palette (useColors)
// but are used throughout the design system for specific purposes.

/** Session type colors — week strip dots, hero card tint */
export const SessionColors = {
  'upper-a': '#3B82F6',
  'lower-a': '#8B5CF6',
  'upper-b': '#06B6D4',
  'lower-b': '#10B981',
  push: '#EC4899',
  pull: '#14B8A6',
  legs: '#F59E0B',
  full: '#EF4444',
  rest: '#374151',
} as const;

/** Achievement rarity ring colors */
export const RarityColors = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
} as const;

/** Player level badge + label colors */
export const LevelColors: Record<string, string> = {
  Beginner: '#22C55E',
  Novice: '#3B82F6',
  Intermediate: '#8B5CF6',
  Advanced: '#F59E0B',
  Elite: '#EF4444',
  Legend: '#F97316',
};

/** Level emoji icons */
export const LevelIcons: Record<string, string> = {
  Beginner: '🌱',
  Novice: '🏋️',
  Intermediate: '💪',
  Advanced: '🔥',
  Elite: '⚡',
  Legend: '👑',
};

/** WHOOP-style recovery zones */
export const RecoveryZones = {
  high: '#22C55E',     // ≥ 67
  mid: '#F59E0B',      // 34–66
  low: '#EF4444',      // < 34
} as const;

/** RPG stat bar colors */
export const StatColors = {
  STR: '#EF4444',
  END: '#F59E0B',
  REC: '#22C55E',
  NUT: '#3B82F6',
} as const;

/** Color pool for custom program sessions */
export const ColorPool = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899', '#14B8A6',
] as const;

// ── SEMANTIC COLORS — default + soft tint pairs ────────────
export const SemanticColors = {
  success: '#4ADE80',
  successStrong: '#22C55E',
  successSoft: 'rgba(74, 222, 128, 0.12)',

  warn: '#FBBF24',
  warnStrong: '#F59E0B',
  warnSoft: 'rgba(245, 158, 11, 0.14)',

  error: '#F87171',
  errorStrong: '#EF4444',
  errorSoft: 'rgba(239, 68, 68, 0.14)',

  info: '#60A5FA',
  infoStrong: '#3B82F6',
  infoSoft: 'rgba(59, 130, 246, 0.14)',
} as const;

// ── LIME ACCENT RAMP ──────────────────────────────────────
export const Lime = {
  base: '#C8F53C',
  bright: '#D9FF57',
  dim: '#A6CC32',
  /** Soft tinted background */
  soft: 'rgba(200, 245, 60, 0.14)',
  /** Tinted border */
  edge: 'rgba(200, 245, 60, 0.35)',
} as const;

// ── MOTION ─────────────────────────────────────────────────
export const Duration = {
  fast: 120,
  med: 200,
  slow: 320,
} as const;

// ── ACTIVE OPACITY ─────────────────────────────────────────
export const ActiveOpacity = {
  primary: 0.7,
  secondary: 0.85,
} as const;
