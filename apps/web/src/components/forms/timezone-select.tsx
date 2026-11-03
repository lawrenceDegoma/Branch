"use client";

import { NativeSelect } from "@/components/ui/input";
import { useMounted } from "@/hooks/use-mounted";
import type { ControlProps } from "./form-field";

/**
 * Timezone picker. Without a saved value it defaults to the browser's zone, which is only known
 * after hydration, so the select remounts once mounted.
 */
export function TimezoneSelect({
  zones,
  value,
  ...props
}: ControlProps & { zones: string[]; value?: string }) {
  const mounted = useMounted();
  const detected = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const initial = value || (detected && zones.includes(detected) ? detected : "UTC");

  return (
    <NativeSelect key={mounted ? "client" : "server"} defaultValue={initial} {...props}>
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone.replaceAll("_", " ")}
        </option>
      ))}
    </NativeSelect>
  );
}
