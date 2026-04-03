/** @type {const} */
const themeColors = {
  // ── BodBot-inspired premium athletic palette ──────────────────────────────
  // Background: deep navy. Cards: white. Accent: energetic orange.
  // Two-surface model:
  //   • Screen background → navy (#0D2B6B)
  //   • Card surface      → white (#FFFFFF)
  //   • foreground        → white (readable on navy background)
  //   • cardForeground    → near-black (readable on white card surface)
  //   • muted             → soft blue-white (secondary text on navy)
  //   • cardMuted         → medium grey (secondary text on white card)
  // ─────────────────────────────────────────────────────────────────────────
  primary:         { light: '#E8600A', dark: '#FF6B1A' },   // Energetic orange — CTA & accent
  background:      { light: '#0D2B6B', dark: '#091D4A' },   // Deep navy
  surface:         { light: '#FFFFFF', dark: '#132254' },    // White cards on navy
  foreground:      { light: '#FFFFFF', dark: '#F1F5F9' },   // White — text on navy background
  muted:           { light: '#A8C4F0', dark: '#7A9DD4' },   // Soft blue-white — secondary on navy
  cardForeground:  { light: '#0F172A', dark: '#F1F5F9' },   // Near-black — text inside white cards
  cardMuted:       { light: '#64748B', dark: '#94A3B8' },   // Medium grey — secondary inside cards
  border:          { light: '#1E3A7A', dark: '#1E3A7A' },   // Navy dividers
  cardBorder:      { light: '#E2E8F0', dark: '#1E3A7A' },   // Light grey card internal borders
  tint:            { light: '#E8600A', dark: '#FF6B1A' },   // Tab bar active tint (same as primary)
  success:         { light: '#22C55E', dark: '#4ADE80' },
  warning:         { light: '#F59E0B', dark: '#FBBF24' },
  error:           { light: '#EF4444', dark: '#F87171' },
};

module.exports = { themeColors };
