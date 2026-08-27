import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { dark, light, type ThemeColors } from "../theme";

type Ctx = {
  dark: boolean;
  setDark: (v: boolean) => void;
  colors: ThemeColors;
};

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setDark] = useState(false);
  const value = useMemo<Ctx>(
    () => ({
      dark: isDark,
      setDark,
      colors: isDark ? dark : light,
    }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
