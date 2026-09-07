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
  accent: "#b4451f",
  onAccent: "#ffffff",
  actionSurface: "#fdeee7",
  actionText: "#572612",
  accentSoft: "#fdeee7",
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
  accent: "#f08d5f",
  onAccent: "#201b16",
  actionSurface: "#33221a",
  actionText: "#f2ece4",
  accentSoft: "#33221a",
  good: "#7fc59b",
  warn: "#e2b768",
  warnSoft: "#322614",
};

export type Palette = typeof light;
// Private Android builds opt into the woodland beta. This never grants API authorization.
if (process.env.EXPO_PUBLIC_WOODLAND_BETA === 'true') {
  Object.assign(light, { bg:'#eee3cd',surface:'#f8eedb',surfaceSunken:'#e4d7be',border:'#9b8054',text:'#302b21',textMuted:'#65573f',accent:'#705024',onAccent:'#fffaf0',accentSoft:'#ddd0b5',good:'#425c36',warn:'#79551c',warnSoft:'#f4e6c2',actionSurface:'#e5dbe6',actionText:'#493b4c' });
  Object.assign(dark, { bg:'#101514',surface:'#191e1b',surfaceSunken:'#222620',border:'#766347',text:'#eddfc5',textMuted:'#c0af92',accent:'#e1ba7d',onAccent:'#191711',accentSoft:'#393227',good:'#b7c39a',warn:'#edc986',warnSoft:'#423921',actionSurface:'#3e3344',actionText:'#f3debb' });
}

export const radius = { sm: 10, md: 14, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const type = {
  micro: 12,
  small: 13,
  body: 15,
  title: 17,
  display: 26,
};
