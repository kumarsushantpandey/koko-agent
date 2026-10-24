import { useState, useEffect } from "react";

export type ThemeType = "dark" | "neon" | "light";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    return (localStorage.getItem("koko_theme") as ThemeType) || "neon";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("koko_theme", theme);
  }, [theme]);

  const setTheme = (t: ThemeType) => {
    setThemeState(t);
  };

  const cycleTheme = () => {
    if (theme === "neon") setTheme("dark");
    else if (theme === "dark") setTheme("light");
    else setTheme("neon");
  };

  return { theme, setTheme, cycleTheme };
}
