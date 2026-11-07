"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, primaryNav } from "./navigation";

export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="grid grid-cols-5">
        {primaryNav.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-1 text-xs text-ink-faint transition-colors duration-(--duration-fast) aria-[current=page]:font-medium aria-[current=page]:text-ink"
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
