import { PageHeader } from "@/components/shell/page-header";
import { ThemeSelect } from "@/components/theme/theme-select";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <section
        aria-labelledby="appearance-heading"
        className="grid max-w-4xl gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8"
      >
        <div>
          <h2 id="appearance-heading" className="text-base font-medium">
            Appearance
          </h2>
          <p className="mt-1 text-ink-muted">
            System matches your device and switches with it. Saved on this device.
          </p>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <ThemeSelect />
        </div>
      </section>
    </>
  );
}
