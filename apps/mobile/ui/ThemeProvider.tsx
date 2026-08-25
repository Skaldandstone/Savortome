import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type Palette } from "./theme";

const PaletteContext = createContext<Palette>(light);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const palette = useMemo(() => (scheme === "dark" ? dark : light), [scheme]);
  return <PaletteContext.Provider value={palette}>{children}</PaletteContext.Provider>;
}

/** Every component reads its colours from here rather than hard-coding them. */
export const usePalette = (): Palette => useContext(PaletteContext);
