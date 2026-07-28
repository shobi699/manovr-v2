"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Appearance } from "@/lib/settings";

const ThemeContext = createContext<{
  appearance: Appearance;
  setAppearance: (app: Partial<Appearance>) => void;
} | null>(null);

export function ThemeProvider({
  children,
  initialAppearance,
}: {
  children: React.ReactNode;
  initialAppearance: Appearance;
}) {
  const [appearance, setAppearanceVal] = useState<Appearance>(initialAppearance);

  const applyAppearance = (app: Appearance) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;

    // 1. تم رنگی
    let resolvedTheme = app.theme;
    if (resolvedTheme === "auto") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", resolvedTheme);

    // 2. رنگ Accent
    root.style.setProperty("--accent", app.accent);
    root.style.setProperty("--accent-soft", app.accent + "18"); // ~10% opacity
    root.style.setProperty("--accent-hover", app.accent + "cc"); // ~80% opacity for hover

    // 3. فونت سایز
    root.style.setProperty("font-size", `${app.fontSize}px`);

    // 4. تراکم جدول (Density)
    if (app.density === "compact") {
      root.style.setProperty("--table-padding", "6px 12px");
    } else {
      root.style.setProperty("--table-padding", "10px 16px");
    }

    // 5. موقعیت سایدبار
    root.setAttribute("data-nav-position", app.navPosition || "right");
  };

  useEffect(() => {
    applyAppearance(appearance);

    // شنونده تغییر تم سیستم
    if (appearance.theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyAppearance(appearance);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, [appearance]);

  const setAppearance = (newApp: Partial<Appearance>) => {
    setAppearanceVal((prev) => {
      const updated = { ...prev, ...newApp };
      applyAppearance(updated);
      return updated;
    });
  };

  return (
    <ThemeContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
