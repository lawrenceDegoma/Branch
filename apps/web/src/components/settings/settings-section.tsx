/** One settings area: its title and description beside a panel holding the controls. */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="grid scroll-mt-20 gap-4 border-b border-line py-8 first:pt-0 last:border-b-0 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={`${id}-heading`} className="text-base font-medium">
          {title}
        </h2>
        <p className="mt-1 break-words text-ink-muted">{description}</p>
      </div>
      <div className="rounded-xl bg-surface p-4 sm:p-5">{children}</div>
    </section>
  );
}
