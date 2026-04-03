/** @type {const} */
const themeColors = {
  // ── Industry-standard gym tracker palette ─────────────────────────────────
  // Modeled on WHOOP, Hevy, Strong — the three most respected strength apps.
  // Background: near-black charcoal. Cards: elevated dark surface. Accent: lime green.
  //
  // Two-surface model:
  //   • Screen background → near-black  (#0A0B0A)
  //   • Card surface      → elevated charcoal (#1A1D1A)
  //   • foreground        → white (readable on dark background)
  //   • cardForeground    → white/near-white (readable on elevated card)
  //   • muted             → warm grey (secondary text on dark background)
  //   • cardMuted         → medium grey (secondary text inside cards)
  //
  // Color psychology rationale:
  //   • Near-black: reduces eye strain during workouts, signals premium/serious
  //   • Lime green (#C8F53C): universally signals health, strength, progress
  //   • Elevated charcoal cards: clear hierarchy without harsh white contrast
  // ─────────────────────────────────────────────────────────────────────────
  primary:         { light: '#C8F53C', dark: '#C8F53C' },   // Lime green — CTA, accent, progress
  background:      { light: '#0A0B0A', dark: '#0A0B0A' },   // Near-black (WHOOP/Hevy standard)
  surface:         { light: '#1A1D1A', dark: '#1A1D1A' },   // Elevated charcoal cards
  foreground:      { light: '#F5F5F5', dark: '#F5F5F5' },   // Near-white — text on dark background
  muted:           { light: '#7A8070', dark: '#7A8070' },   // Warm grey — secondary on dark bg
  cardForeground:  { light: '#EDEEE8', dark: '#EDEEE8' },   // Soft white — text inside cards
  cardMuted:       { light: '#6B7060', dark: '#6B7060' },   // Muted grey — secondary inside cards
  border:          { light: '#2A2D2A', dark: '#2A2D2A' },   // Subtle dark dividers
  cardBorder:      { light: '#2E322E', dark: '#2E322E' },   // Card internal borders
  tint:            { light: '#C8F53C', dark: '#C8F53C' },   // Tab bar active tint (lime green)
  success:         { light: '#4ADE80', dark: '#4ADE80' },   // Green — completion, PRs
  warning:         { light: '#FBBF24', dark: '#FBBF24' },   // Amber — deload, warnings
  error:           { light: '#F87171', dark: '#F87171' },   // Red — errors, missed sessions
};

module.exports = { themeColors };
