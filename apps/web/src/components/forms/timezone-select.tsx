"use client";

import { useMemo } from "react";
import { useMounted } from "@/hooks/use-mounted";
import type { ControlProps } from "./form-field";
import { SearchSelect } from "./search-select";

/**
 * Timezone picker. Typing filters ("new y" finds America/New York). Without a saved value it
 * defaults to the browser's zone, which is only known after hydration, so it remounts once mounted.
 */
export function TimezoneSelect({
  zones,
  value,
  ...props
}: ControlProps & { zones: string[]; value?: string }) {
  const mounted = useMounted();
  const detected = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const initial = value || (detected && zones.includes(detected) ? detected : "UTC");
  const items = useMemo(
    () => zones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })),
    [zones],
  );

  return (
    <SearchSelect
      key={mounted ? "client" : "server"}
      items={items}
      defaultValue={initial}
      emptyText="No timezone matches."
      {...props}
    />
  );
}
