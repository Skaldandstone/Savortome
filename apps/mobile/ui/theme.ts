/**
 * The mobile mirror of the web design tokens. Same palette, expressed as
 * plain objects because React Native has no CSS custom properties.
 */
export const light = {
  bg: "#fbf8f4",
  surface: "#ffffff",
  surfaceSunken: "#f4efe8",
  border: "#e6ddd1",
  text: "#241d17",
  textMuted: "#6f6459",
  accent: "#916008",
  accentSoft: "#fbeeda",
  good: "#2f6b46",
  warn: "#8a6100",
  warnSoft: "#fdf3d9",
};

export const dark: typeof light = {
  bg: "#16130f",
  surface: "#201b16",
  surfaceSunken: "#2a231c",
  border: "#3a3129",
  text: "#f2ece4",
  textMuted: "#a89c8e",
  accent: "#e89a0c",
  accentSoft: "#33260f",
  good: "#7fc59b",
  warn: "#e2b768",
  warnSoft: "#322614",
};

export type Palette = typeof light;

export const radius = { sm: 10, md: 14, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const type = {
  micro: 12,
  small: 13,
  body: 15,
  title: 17,
  display: 26,
};
