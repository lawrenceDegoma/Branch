"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export const THEME_STORAGE_KEY = "branch-theme";

// Default to the operating system preference; an explicit choice persists per device.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
    >
      {children}
    </NextThemesProvider>
  );
}
