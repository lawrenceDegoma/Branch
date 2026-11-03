import { cn } from "@/lib/utils";

export type ControlProps = {
  id: string;
  name: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * Label above the control, a persistent description for constraints, and an error tied to the
 * control with aria-describedby.
 */
export function FormField({
  name,
  label,
  description,
  error,
  className,
  children,
}: {
  name: string;
  label: string;
  description?: React.ReactNode;
  error?: string;
  className?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const id = `field-${name}`;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="font-medium text-ink">
        {label}
      </label>
      {children({
        id,
        name,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {description ? (
        <p id={descriptionId} className="text-xs leading-4 text-ink-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs leading-4 font-medium text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
