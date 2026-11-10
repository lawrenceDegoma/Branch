"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

// A small action menu (Base UI: arrow keys move, Escape closes and returns focus to the trigger).
// A floating layer, so it gets a shadow.

const Menu = MenuPrimitive.Root;
const MenuTrigger = MenuPrimitive.Trigger;

function MenuContent({ className, ...props }: MenuPrimitive.Popup.Props) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={4} align="end" className="z-50">
        <MenuPrimitive.Popup
          className={cn(
            "min-w-44 rounded-[10px] bg-surface p-1 text-sm text-ink shadow-float outline-none",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center rounded-md px-3 py-2 outline-none select-none data-highlighted:bg-raised pointer-coarse:py-2.5",
        className,
      )}
      {...props}
    />
  );
}

export { Menu, MenuContent, MenuItem, MenuTrigger };
