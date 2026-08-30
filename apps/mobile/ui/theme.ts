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
  accentSoft: "#33221a",
  good: "#7fc59b",
  warn: "#e2b768",
  warnSoft: "#322614",
};

export type Palette = typeof light;
// Private Android builds opt into the woodland beta. This never grants API authorization.
if (process.env.EXPO_PUBLIC_WOODLAND_BETA === 'true') {
  Object.assign(light, { bg:'#f3eddf',surface:'#fffaf0',surfaceSunken:'#e9e1d0',border:'#bdb29c',text:'#24342e',textMuted:'#566258',accent:'#795022',accentSoft:'#eadfc8' });
  Object.assign(dark, { bg:'#111e1d',surface:'#1b2b28',surfaceSunken:'#22352e',border:'#5b6452',text:'#f0e7d5',textMuted:'#b5bdaa',accent:'#e2b97b',accentSoft:'#3c3827' });
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
