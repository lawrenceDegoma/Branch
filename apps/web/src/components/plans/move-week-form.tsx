"use client";

import { useActionState, useId } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { NativeSelect } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { moveAssignmentAction } from "@/modules/plans/actions";

/** Admin control to move one problem to another week (explicit submit, WCAG 3.2.2). */
export function MoveWeekForm({
  groupId,
  roadmapItemId,
  title,
  currentWeek,
  weekOptions,
}: {
  groupId: string;
  roadmapItemId: string;
  title: string;
  currentWeek: number;
  weekOptions: number;
}) {
  const id = useId();
  const [state, action] = useActionState(moveAssignmentAction, initialFormState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="roadmapItemId" value={roadmapItemId} />
      <label htmlFor={id} className="sr-only">
        Week for {title}
      </label>
      <NativeSelect
        id={id}
        name="weekNumber"
        defaultValue={currentWeek}
        className="h-8 w-28 pointer-coarse:h-10"
      >
        {Array.from({ length: weekOptions }, (_, i) => i + 1).map((week) => (
          <option key={week} value={week}>
            Week {week}
          </option>
        ))}
      </NativeSelect>
      <SubmitButton size="sm" variant="outline" pendingLabel="Moving…" aria-label={`Move ${title}`}>
        Move
      </SubmitButton>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-negative">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
