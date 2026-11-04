/** A native checkbox with its label beside it and an optional description tied to it. */
export function CheckboxField({
  id,
  name,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  description?: React.ReactNode;
  defaultChecked?: boolean;
}) {
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        aria-describedby={descriptionId}
        className="mt-px size-5 shrink-0 cursor-pointer accent-(--primary-fill) pointer-coarse:size-6"
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="cursor-pointer font-medium text-ink">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-xs leading-4 text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
