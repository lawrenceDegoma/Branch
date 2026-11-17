"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ControlProps } from "@/components/forms/form-field";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchOrganizationsAction } from "@/modules/affiliations/actions";
import type { OrganizationOption } from "@/modules/affiliations/organizations";

type Item = { value: string; label: string; detail: string | null };

const toItem = (option: OrganizationOption): Item => ({
  value: option.id,
  label: option.name,
  detail: option.detail,
});

const DELAY_MS = 200;

/**
 * Like SearchSelect, but for lists too long to send to the browser (ten thousand schools): typing
 * asks Branch for up to 20 matches. The chosen ID is submitted under `name`, or nothing for none.
 */
export function OrganizationSelect({
  kind,
  noun,
  defaultValue,
  id,
  name,
  ...aria
}: ControlProps & {
  kind: "SCHOOL" | "COMPANY";
  /** "school" or "company", for the messages. */
  noun: string;
  defaultValue: OrganizationOption | null;
}) {
  const initial = defaultValue ? toItem(defaultValue) : null;
  const [value, setValue] = useState<Item | null>(initial);
  const [items, setItems] = useState<Item[]>(initial ? [initial] : []);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function search(text: string) {
    setQuery(text);
    clearTimeout(timer.current);
    const trimmed = text.trim();
    const request = ++latest.current;
    // The input shows the chosen name after a pick; that isn't a search.
    if (!trimmed || trimmed === value?.label) {
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const found = await searchOrganizationsAction(kind, trimmed);
      // A slower answer to an older query never replaces a newer one.
      if (request !== latest.current) return;
      setItems(found.map(toItem));
      setSearching(false);
    }, DELAY_MS);
  }

  const typed = query.trim() && query.trim() !== value?.label;
  return (
    <Combobox.Root
      items={items}
      filter={null}
      value={value}
      onValueChange={(next) => setValue(next)}
      onInputValueChange={search}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      name={name}
      autoHighlight
    >
      <div className="relative">
        <Combobox.Input
          id={id}
          {...aria}
          autoComplete="off"
          placeholder={`Search for your ${noun}`}
          className={cn(controlClassName, "h-10 pr-10 pointer-coarse:h-11")}
          onFocus={(event) => event.currentTarget.select()}
        />
        {value ? (
          <Combobox.Clear
            aria-label={`Remove ${noun}`}
            className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-ink-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </Combobox.Clear>
        ) : null}
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="w-(--anchor-width) max-w-(--available-width) rounded-[10px] bg-surface text-sm text-ink shadow-float">
            <Combobox.Status className="px-3 py-2.5 text-ink-muted empty:hidden">
              {searching
                ? "Searching…"
                : typed && items.length === 0
                  ? `No ${noun} matches “${query.trim()}”.`
                  : !typed && items.length === 0
                    ? `Type the name of your ${noun}.`
                    : null}
            </Combobox.Status>
            <Combobox.List className="max-h-[min(18rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 empty:hidden">
              {(item: Item) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 select-none data-highlighted:bg-raised"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="break-words">{item.label}</span>
                    {item.detail ? (
                      <span className="text-xs break-words text-ink-muted">{item.detail}</span>
                    ) : null}
                  </span>
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
