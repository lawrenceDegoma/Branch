"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export const THEME_STORAGE_KEY = "branch-theme";

// Default to the operating system preference; an explicit choice persists per device. The nonce
// lets next-themes' inline script (which sets the class before hydration) run under the CSP.
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      nonce={nonce}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
    >
      {children}
    </NextThemesProvider>
  );
}
