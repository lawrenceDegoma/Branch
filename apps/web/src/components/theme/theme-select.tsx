"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";

const options: { value: "system" | "light" | "dark"; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render no selection until hydrated.
  const mounted = useMounted();

  return (
    <fieldset>
      <legend className="sr-only">Appearance</legend>
      <div className="inline-flex rounded-full bg-raised p-1">
        {options.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className="relative flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-ink-muted transition-colors duration-(--duration-fast) select-none hover:text-ink has-checked:bg-surface has-checked:font-medium has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring pointer-coarse:h-10"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={mounted && theme === value}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
