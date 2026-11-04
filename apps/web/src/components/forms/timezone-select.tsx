"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { controlClassName } from "@/components/ui/input";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import type { ControlProps } from "./form-field";

const label = (zone: string) => zone.replaceAll("_", " ");

/**
 * Timezone picker: a combobox, because ~400 zones make a native select fill the screen. Typing
 * filters ("new y" finds America/New York); the chosen zone is submitted under `name`.
 * Without a saved value it defaults to the browser's zone, which is only known after hydration,
 * so the combobox remounts once mounted.
 */
export function TimezoneSelect({
  zones,
  value,
  id,
  name,
  ...aria
}: ControlProps & { zones: string[]; value?: string }) {
  const mounted = useMounted();
  const detected = mounted ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
  const initial = value || (detected && zones.includes(detected) ? detected : "UTC");

  return (
    <Combobox.Root
      key={mounted ? "client" : "server"}
      items={zones}
      defaultValue={initial}
      itemToStringLabel={label}
      name={name}
      required
      autoHighlight
    >
      <div className="relative">
        <Combobox.Input
          id={id}
          {...aria}
          autoComplete="off"
          className={cn(controlClassName, "h-10 pr-10 pointer-coarse:h-11")}
          onFocus={(event) => event.currentTarget.select()}
        />
        {/* Decorative: clicks pass through to the input, which opens the list (as does ↓). */}
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
        />
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="w-(--anchor-width) max-w-(--available-width) rounded-[10px] bg-surface text-sm text-ink shadow-float">
            <Combobox.Empty className="px-3 py-2.5 text-ink-muted empty:hidden">
              No timezone matches.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 empty:hidden">
              {(zone: string) => (
                <Combobox.Item
                  key={zone}
                  value={zone}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 select-none data-highlighted:bg-raised"
                >
                  <span className="flex-1">{label(zone)}</span>
                  <Combobox.ItemIndicator>
                    <Check aria-hidden="true" className="size-4 text-ink-muted" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
