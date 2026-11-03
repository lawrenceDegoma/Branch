"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * Applies the account's saved appearance on this device (for example after signing in on a new
 * browser). Choices made in Settings update the account first, so the two stay in step.
 */
export function AppearanceSync({ appearance }: { appearance: "SYSTEM" | "LIGHT" | "DARK" }) {
  const { theme, setTheme } = useTheme();
  const wanted = appearance.toLowerCase();

  useEffect(() => {
    if (theme !== wanted) setTheme(wanted);
    // Only react to the account value changing, not to local theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  return null;
}
