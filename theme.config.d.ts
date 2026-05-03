type Swatch = { light: string; dark: string };

export const themeColors: {
  // Surfaces
  background:        Swatch;
  bgSunken:          Swatch;
  surface:           Swatch;
  surface2:          Swatch;
  surface3:          Swatch;
  border:            Swatch;
  cardBorder:        Swatch;
  // Foreground
  foreground:        Swatch;
  cardForeground:    Swatch;
  fg3:               Swatch;
  muted:             Swatch;
  cardMuted:         Swatch;
  mute3:             Swatch;
  primaryInk:        Swatch;
  // Brand
  primary:           Swatch;
  tint:              Swatch;
  primarySoft:       Swatch;
  primaryEdge:       Swatch;
  onPrimary:         Swatch;
  // Semantic
  success:           Swatch;
  successStrong:     Swatch;
  successSoft:       Swatch;
  warning:           Swatch;
  warningStrong:     Swatch;
  warningSoft:       Swatch;
  error:             Swatch;
  errorStrong:       Swatch;
  errorSoft:         Swatch;
  info:              Swatch;
  infoStrong:        Swatch;
  infoSoft:          Swatch;
  // Session colors
  sessionUpperA:     Swatch;
  sessionLowerA:     Swatch;
  sessionUpperB:     Swatch;
  sessionLowerB:     Swatch;
  sessionPush:       Swatch;
  sessionPull:       Swatch;
  sessionLegs:       Swatch;
  sessionFull:       Swatch;
  sessionRest:       Swatch;
  // Rarity
  rarityCommon:      Swatch;
  rarityRare:        Swatch;
  rarityEpic:        Swatch;
  rarityLegendary:   Swatch;
  // Levels
  levelBeginner:     Swatch;
  levelNovice:       Swatch;
  levelIntermediate: Swatch;
  levelAdvanced:     Swatch;
  levelElite:        Swatch;
  levelLegend:       Swatch;
  // Recovery zones
  recoveryHigh:      Swatch;
  recoveryMid:       Swatch;
  recoveryLow:       Swatch;
};

declare const themeConfig: {
  themeColors: typeof themeColors;
};

export default themeConfig;
