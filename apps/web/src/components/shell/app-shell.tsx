import { MobileHeader } from "./mobile-header";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

/**
 * Desktop: labelled sidebar on the page ground beside a fluid canvas.
 * Below 1024px: a compact header and a bottom bar with the primary destinations.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <Sidebar className="hidden lg:flex" />
      <div className="flex min-w-0 flex-col">
        <MobileHeader className="lg:hidden" />
        <main
          id="main"
          tabIndex={-1}
          className="w-full max-w-[1280px] flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-8 lg:pt-9 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <MobileNav className="lg:hidden" />
    </div>
  );
}
