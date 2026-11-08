import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const TABS = [
  { href: "/review", label: "Reviews" },
  { href: "/review/solutions", label: "Your solutions" },
] as const;

/** Review's two sections: the review queue, and your solutions with their analysis. */
export function ReviewTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Review sections" className="mb-6">
      <ul className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.href === current ? "page" : undefined}
              className={buttonVariants({
                variant: tab.href === current ? "secondary" : "ghost",
                size: "sm",
              })}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
