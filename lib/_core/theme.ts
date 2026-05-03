import { Platform } from "react-native";

import themeConfig from "@/theme.config";

export type ColorScheme = "light" | "dark";

export const ThemeColors = themeConfig.themeColors;

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

type RuntimePalette = SchemePaletteItem & {
  // Legacy aliases
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
  // Extended design system tokens
  surface2: string;
  surface3: string;
  fg3: string;
  mute3: string;
  cardForeground: string;
  cardMuted: string;
  cardBorder: string;
  primaryInk: string;
  // Semantic colors
  successStrong: string;
  successSoft: string;
  warningStrong: string;
  warningSoft: string;
  errorStrong: string;
  errorSoft: string;
  info: string;
  infoStrong: string;
  infoSoft: string;
  // Brand soft tints
  primarySoft: string;
  primaryEdge: string;
  onPrimary: string;
  bgSunken: string;
  // Session colors
  sessionUpperA: string;
  sessionLowerA: string;
  sessionUpperB: string;
  sessionLowerB: string;
  sessionPush: string;
  sessionPull: string;
  sessionLegs: string;
  sessionFull: string;
  sessionRest: string;
  // Rarity
  rarityCommon: string;
  rarityRare: string;
  rarityEpic: string;
  rarityLegendary: string;
  // Levels
  levelBeginner: string;
  levelNovice: string;
  levelIntermediate: string;
  levelAdvanced: string;
  levelElite: string;
  levelLegend: string;
  // Recovery zones
  recoveryHigh: string;
  recoveryMid: string;
  recoveryLow: string;
};

/** Safe accessor — returns value or fallback if key not in base palette */
function pick(base: Record<string, string>, key: string, fallback: string): string {
  return (base as any)[key] ?? fallback;
}

function buildRuntimePalette(scheme: ColorScheme): RuntimePalette {
  const base = SchemeColors[scheme];
  return {
    ...base,
    // Legacy aliases
    text: base.foreground,
    background: base.background,
    tint: pick(base, 'tint', base.primary),
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
    // Three-tier surface model
    surface2: pick(base, 'surface2', '#1A1D1A'),
    surface3: pick(base, 'surface3', '#23272A'),
    // Foreground tiers
    fg3: pick(base, 'fg3', '#C9CCC3'),
    mute3: pick(base, 'mute3', '#555A4E'),
    cardForeground: pick(base, 'cardForeground', base.foreground),
    cardMuted: pick(base, 'cardMuted', base.muted),
    cardBorder: pick(base, 'cardBorder', base.border),
    primaryInk: pick(base, 'primaryInk', '#0A0B0A'),
    // Semantic
    successStrong: pick(base, 'successStrong', '#22C55E'),
    successSoft: pick(base, 'successSoft', 'rgba(74,222,128,0.12)'),
    warningStrong: pick(base, 'warningStrong', '#F59E0B'),
    warningSoft: pick(base, 'warningSoft', 'rgba(245,158,11,0.14)'),
    errorStrong: pick(base, 'errorStrong', '#EF4444'),
    errorSoft: pick(base, 'errorSoft', 'rgba(239,68,68,0.14)'),
    info: pick(base, 'info', '#60A5FA'),
    infoStrong: pick(base, 'infoStrong', '#3B82F6'),
    infoSoft: pick(base, 'infoSoft', 'rgba(59,130,246,0.14)'),
    // Brand soft tints
    primarySoft: pick(base, 'primarySoft', 'rgba(200,245,60,0.14)'),
    primaryEdge: pick(base, 'primaryEdge', 'rgba(200,245,60,0.35)'),
    onPrimary: pick(base, 'onPrimary', '#0A0B0A'),
    bgSunken: pick(base, 'bgSunken', '#05060A'),
    // Session colors
    sessionUpperA: pick(base, 'sessionUpperA', '#3B82F6'),
    sessionLowerA: pick(base, 'sessionLowerA', '#8B5CF6'),
    sessionUpperB: pick(base, 'sessionUpperB', '#06B6D4'),
    sessionLowerB: pick(base, 'sessionLowerB', '#10B981'),
    sessionPush: pick(base, 'sessionPush', '#EC4899'),
    sessionPull: pick(base, 'sessionPull', '#14B8A6'),
    sessionLegs: pick(base, 'sessionLegs', '#F59E0B'),
    sessionFull: pick(base, 'sessionFull', '#EF4444'),
    sessionRest: pick(base, 'sessionRest', '#374151'),
    // Rarity
    rarityCommon: pick(base, 'rarityCommon', '#9CA3AF'),
    rarityRare: pick(base, 'rarityRare', '#3B82F6'),
    rarityEpic: pick(base, 'rarityEpic', '#8B5CF6'),
    rarityLegendary: pick(base, 'rarityLegendary', '#F59E0B'),
    // Levels
    levelBeginner: pick(base, 'levelBeginner', '#22C55E'),
    levelNovice: pick(base, 'levelNovice', '#3B82F6'),
    levelIntermediate: pick(base, 'levelIntermediate', '#8B5CF6'),
    levelAdvanced: pick(base, 'levelAdvanced', '#F59E0B'),
    levelElite: pick(base, 'levelElite', '#EF4444'),
    levelLegend: pick(base, 'levelLegend', '#F97316'),
    // Recovery zones
    recoveryHigh: pick(base, 'recoveryHigh', '#22C55E'),
    recoveryMid: pick(base, 'recoveryMid', '#F59E0B'),
    recoveryLow: pick(base, 'recoveryLow', '#EF4444'),
  };
}

export const Colors = {
  light: buildRuntimePalette("light"),
  dark: buildRuntimePalette("dark"),
} satisfies Record<ColorScheme, RuntimePalette>;

export type ThemeColorPalette = (typeof Colors)[ColorScheme];

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
