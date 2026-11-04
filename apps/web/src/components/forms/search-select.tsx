"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ControlProps } from "./form-field";

export type SearchSelectItem = { value: string; label: string };

/**
 * A select you can type into, for lists too long for a native select (which can fill the whole
 * screen). Typing filters the list; the chosen item's `value` is submitted under `name`.
 */
export function SearchSelect({
  items,
  defaultValue,
  emptyText,
  id,
  name,
  ...aria
}: ControlProps & {
  items: SearchSelectItem[];
  defaultValue?: string | null;
  emptyText: string;
}) {
  return (
    <Combobox.Root
      items={items}
      defaultValue={items.find((item) => item.value === defaultValue) ?? null}
      name={name}
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
              {emptyText}
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 empty:hidden">
              {(item: SearchSelectItem) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 select-none data-highlighted:bg-raised"
                >
                  <span className="flex-1">{item.label}</span>
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
