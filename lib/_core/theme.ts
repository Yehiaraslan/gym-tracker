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
  warningStrong: string;
  errorStrong: string;
  info: string;
  infoStrong: string;
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
    warningStrong: pick(base, 'warningStrong', '#F59E0B'),
    errorStrong: pick(base, 'errorStrong', '#EF4444'),
    info: pick(base, 'info', '#60A5FA'),
    infoStrong: pick(base, 'infoStrong', '#3B82F6'),
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
