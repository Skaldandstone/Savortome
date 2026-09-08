import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { light, usePalette, type Palette } from '@/ui';
import { PaletteScope, useDecoration } from '@/ui/ThemeProvider';

export const woodlandEnabled = process.env.EXPO_PUBLIC_WOODLAND_BETA === 'true';

// Authored catalogue IDs only. Recipe titles are never classified into foods.
export const FOOD_ART_CELLS: Readonly<Record<string, number>> = { banana:0, apple:1, applesauce:2, crackers:3, yogurt:4, hummus:5, cereal:6, rice:7, oatmeal:8, beans:9, potato:10, scramble:11, pasta:12, peas:13, journal:14 };
export function TimberWash() {
  const { reduced } = useDecoration();
  if (!woodlandEnabled || reduced) return null;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={require('../../assets/woodland/timber.webp')} resizeMode="cover" fadeDuration={0} style={{width:'100%',height:'100%',opacity:0.08}} /></View>;
}
export function FoodIllustration({ foodId, size = 104 }: { foodId: string; size?: number }) {
  const { reduced } = useDecoration();
  const [failed, setFailed] = useState(false);
  const index = Object.hasOwn(FOOD_ART_CELLS, foodId) ? FOOD_ART_CELLS[foodId] : undefined;
  if (!woodlandEnabled || reduced || failed || index === undefined) return null;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ width:size, height:size, overflow:'hidden', backgroundColor:'#211e17', flexShrink:0 }}>
    <Image source={require('../../assets/woodland/food-atlas.webp')} fadeDuration={0} onError={() => setFailed(true)}
      style={{ position:'absolute', width:size * 4, height:size * 4, left:-(index % 4) * size, top:-Math.floor(index / 4) * size }} />
  </View>;
}

/** Quiet texture behind a solid reading surface; all content remains native. */
export function PaperPanel({ children, style }: { children: ReactNode | ((palette: Palette) => ReactNode); style?: StyleProp<ViewStyle> }) {
  const c = usePalette(); const { reduced } = useDecoration();
  const content = (palette: Palette) => typeof children === 'function' ? children(palette) : children;
  if (!woodlandEnabled) return <View style={style}>{content(c)}</View>;
  const paper = !reduced;
  return <View style={[styles.paper, { backgroundColor:paper ? '#f0e1c1' : c.surface, borderColor:c.border }, style]}>
    {paper && <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={require('../../assets/woodland/parchment.webp')} resizeMode="cover" fadeDuration={0} style={{width:'100%',height:'100%',opacity:0.18}} /></View>}
    <PaletteScope palette={paper ? light : c}>{content(paper ? light : c)}</PaletteScope>
  </View>;
}
const styles = StyleSheet.create({ paper:{borderWidth:1,borderRadius:5,overflow:'hidden',padding:18,marginVertical:12} });
