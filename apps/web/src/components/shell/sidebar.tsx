"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { Avatar } from "@/components/user/avatar";
import { cn } from "@/lib/utils";
import { isActivePath, primaryNav, type NavItem } from "./navigation";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-ink-muted transition-colors duration-(--duration-fast) hover:text-ink",
        // Light: a neutral pill marks the current page. Dark: the label brightens instead.
        "aria-[current=page]:bg-raised aria-[current=page]:font-medium aria-[current=page]:text-ink dark:aria-[current=page]:bg-transparent",
      )}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      {item.label}
    </Link>
  );
}

export type ShellViewer = { id: string; name: string; username: string };

export function Sidebar({ viewer, className }: { viewer: ShellViewer; className?: string }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn("sticky top-0 h-dvh flex-col border-r border-line px-3 pt-6 pb-4", className)}
    >
      <Link href="/home" className="mb-8 self-start rounded-md px-2.5 py-1">
        <BranchWordmark />
      </Link>
      <nav aria-label="Main" className="flex-1">
        <ul className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>
      <SidebarLink
        item={{ href: "/settings", label: "Settings", icon: Settings }}
        pathname={pathname}
      />
      <div className="mt-3 flex items-center gap-2.5 border-t border-line px-2.5 pt-4">
        <Avatar userId={viewer.id} name={viewer.name} />
        <div className="min-w-0 leading-4">
          <p className="truncate font-medium text-ink">{viewer.name}</p>
          <p className="truncate text-xs text-ink-muted">@{viewer.username}</p>
        </div>
      </div>
    </aside>
  );
}
