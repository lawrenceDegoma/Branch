import { CircleUser, House, Map as MapIcon, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

// PRD §4: Home, Roadmaps, Groups, Review, Profile. Review is hidden until Phase 4 ships it.
export const primaryNav: NavItem[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/roadmaps", label: "Roadmaps", icon: MapIcon },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/profile", label: "Profile", icon: CircleUser },
];

/** A nav item is active on its own route and on any route nested beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
