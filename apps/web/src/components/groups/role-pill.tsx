export function RolePill({ role }: { role: "ADMIN" | "MEMBER" }) {
  if (role !== "ADMIN") return null;
  return (
    <span className="inline-flex h-5 flex-none items-center rounded-full bg-raised px-2 text-xs font-medium whitespace-nowrap text-ink-muted">
      Admin
    </span>
  );
}
