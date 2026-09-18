/** @type {const} */
const themeColors = {
  // ── Banana Pro Design System ────────────────────────────────────────────
  // Dark-first, MY Lifestyle brand: teal (#2EBFBF) on deep navy (#0A1226 / #1E3A74).
  // Three-tier surface model with warm-neutral foreground.
  //
  // Surfaces:
  //   • bg         → screen background (#0A0B0A)
  //   • surface    → elevated cards (#14171A)  — deeper charcoal
  //   �� surface2   → second card tier (#1A1D1A)
  //   • surface3   → inputs, pressed buttons (#23272A)
  //
  // Foreground (warm-neutral, never pure white):
  //   • foreground  → #F5F7F2 (primary text on bg)
  //   • cardForeground → #EDEEE8 (primary text in cards)
  //   • fg3         → #C9CCC3 (subdued but readable)
  //   • muted       → #8A907F (secondary on bg)
  //   • cardMuted   → #747A6B (secondary in cards)
  //   • mute3       → #555A4E (tertiary / captions)
  //
  // Brand:
  //   • primary     → #C8F53C (lime — CTAs, XP, progress)
  //   • primaryInk  → #0A0B0A (text on lime)
  //
  // Color psychology rationale:
  //   • Near-black: reduces eye strain during workouts, signals premium/serious
  //   • Lime green (#C8F53C): universally signals health, strength, progress
  //   • Three-tier surfaces: clear hierarchy without harsh white contrast
  // ───��────────────────────────────────────────────────────────────────────

  // ── Surfaces ──
  primary:         { light: '#2EBFBF', dark: '#2EBFBF' },
  background:      { light: '#0A1226', dark: '#0A1226' },
  surface:         { light: '#111D38', dark: '#111D38' },
  surface2:        { light: '#162547', dark: '#162547' },
  surface3:        { light: '#1E3A74', dark: '#1E3A74' },

  // ── Foreground — warm-neutral ──
  foreground:      { light: '#F2F6FA', dark: '#F2F6FA' },
  cardForeground:  { light: '#E8EEF5', dark: '#E8EEF5' },
  fg3:             { light: '#BFCBDD', dark: '#BFCBDD' },
  muted:           { light: '#8A9BB8', dark: '#8A9BB8' },
  cardMuted:       { light: '#7C8DAA', dark: '#7C8DAA' },
  mute3:           { light: '#55658A', dark: '#55658A' },
  primaryInk:      { light: '#06101F', dark: '#06101F' },

  // ── Borders ──
  border:          { light: '#20345E', dark: '#20345E' },
  cardBorder:      { light: '#294273', dark: '#294273' },

  // ── Tint (tab bar active) ──
  tint:            { light: '#2EBFBF', dark: '#2EBFBF' },

  // ── Semantic ──
  success:         { light: '#4ADE80', dark: '#4ADE80' },
  successStrong:   { light: '#22C55E', dark: '#22C55E' },
  successSoft:     { light: 'rgba(74,222,128,0.12)', dark: 'rgba(74,222,128,0.12)' },
  warning:         { light: '#FBBF24', dark: '#FBBF24' },
  warningStrong:   { light: '#F59E0B', dark: '#F59E0B' },
  warningSoft:     { light: 'rgba(245,158,11,0.14)', dark: 'rgba(245,158,11,0.14)' },
  error:           { light: '#F87171', dark: '#F87171' },
  errorStrong:     { light: '#EF4444', dark: '#EF4444' },
  errorSoft:       { light: 'rgba(239,68,68,0.14)', dark: 'rgba(239,68,68,0.14)' },
  info:            { light: '#60A5FA', dark: '#60A5FA' },
  infoStrong:      { light: '#3B82F6', dark: '#3B82F6' },
  infoSoft:        { light: 'rgba(59,130,246,0.14)', dark: 'rgba(59,130,246,0.14)' },

  // ── Brand soft tints ──
  primarySoft:     { light: 'rgba(46,191,191,0.14)', dark: 'rgba(46,191,191,0.14)' },
  primaryEdge:     { light: 'rgba(46,191,191,0.35)', dark: 'rgba(46,191,191,0.35)' },
  onPrimary:       { light: '#06101F', dark: '#06101F' },

  // ── Session colors ──
  sessionUpperA:   { light: '#3B82F6', dark: '#3B82F6' },  // blue
  sessionLowerA:   { light: '#8B5CF6', dark: '#8B5CF6' },  // violet
  sessionUpperB:   { light: '#06B6D4', dark: '#06B6D4' },  // cyan
  sessionLowerB:   { light: '#10B981', dark: '#10B981' },  // emerald
  sessionPush:     { light: '#EC4899', dark: '#EC4899' },  // pink
  sessionPull:     { light: '#14B8A6', dark: '#14B8A6' },  // teal
  sessionLegs:     { light: '#F59E0B', dark: '#F59E0B' },  // amber
  sessionFull:     { light: '#EF4444', dark: '#EF4444' },  // red
  sessionRest:     { light: '#374151', dark: '#374151' },  // slate

  // ── Rarity ──
  rarityCommon:    { light: '#9CA3AF', dark: '#9CA3AF' },
  rarityRare:      { light: '#3B82F6', dark: '#3B82F6' },
  rarityEpic:      { light: '#8B5CF6', dark: '#8B5CF6' },
  rarityLegendary: { light: '#F59E0B', dark: '#F59E0B' },

  // ── Levels ──
  levelBeginner:     { light: '#22C55E', dark: '#22C55E' },
  levelNovice:       { light: '#3B82F6', dark: '#3B82F6' },
  levelIntermediate: { light: '#8B5CF6', dark: '#8B5CF6' },
  levelAdvanced:     { light: '#F59E0B', dark: '#F59E0B' },
  levelElite:        { light: '#EF4444', dark: '#EF4444' },
  levelLegend:       { light: '#F97316', dark: '#F97316' },

  // ── Recovery zones (WHOOP-style) ──
  recoveryHigh:    { light: '#22C55E', dark: '#22C55E' },  // ≥ 67
  recoveryMid:     { light: '#F59E0B', dark: '#F59E0B' },  // 34–66
  recoveryLow:     { light: '#EF4444', dark: '#EF4444' },  // < 34
};

module.exports = { themeColors };
