import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, useColorScheme } from "react-native";
import { dark, light, type Palette } from "./theme";

const PaletteContext = createContext<Palette>(light);
const DecorationContext = createContext({ reduced: false, toggle: () => {} });
const ReducedMotionContext = createContext(false);
export const useDecoration = () => useContext(DecorationContext);
export const useReducedMotion = () => useContext(ReducedMotionContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const palette = useMemo(() => (scheme === "dark" ? dark : light), [scheme]);
  const [reduced, setReduced] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => { void AsyncStorage.getItem('seconds-decoration').then(value => setReduced(value === 'reduced')).catch(() => {}); }, []);
  const toggle = () => setReduced(old => { const next = !old; void AsyncStorage.setItem('seconds-decoration', next ? 'reduced' : 'full').catch(() => {}); return next; });
  return <PaletteContext.Provider value={palette}><ReducedMotionContext.Provider value={reducedMotion}><DecorationContext.Provider value={{ reduced, toggle }}>{children}</DecorationContext.Provider></ReducedMotionContext.Provider></PaletteContext.Provider>;
}

/** Every component reads its colours from here rather than hard-coding them. */
export const usePalette = (): Palette => useContext(PaletteContext);
