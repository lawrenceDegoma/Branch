"use client";

import { addDays, formatCalendarDate, isCalendarDate } from "@branch/shared/calendar";
import { weekCount, type Pacing } from "@branch/shared/schedule";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { initialFormState } from "@/lib/form";
import { pluralize } from "@/lib/format";
import { createPlanAction } from "@/modules/plans/actions";

export type PlanCandidate = {
  roadmapId: string;
  title: string;
  kind: "CURATED" | "CUSTOM";
  versionId: string;
  versionNumber: number;
  sectionSizes: number[];
};

export function PlanSetupForm({
  groupId,
  candidates,
  defaultStartDate,
  replacing,
}: {
  groupId: string;
  candidates: PlanCandidate[];
  defaultStartDate: string;
  replacing: string | null;
}) {
  const [state, action] = useActionState(createPlanAction, initialFormState);
  const values = state.values;
  const [versionId, setVersionId] = useState(
    values?.roadmapVersionId ?? candidates[0]?.versionId ?? "",
  );
  const [mode, setMode] = useState<Pacing["mode"]>(
    (values?.pacingMode as Pacing["mode"]) || "PER_WEEK",
  );
  const [perWeek, setPerWeek] = useState(values?.problemsPerWeek ?? "4");
  const [startDate, setStartDate] = useState(values?.startDate ?? defaultStartDate);

  const candidate = candidates.find((c) => c.versionId === versionId);
  const pacing: Pacing =
    mode === "PER_SECTION"
      ? { mode }
      : { mode, problemsPerWeek: Math.max(1, Number(perWeek) || 1) };
  const total = candidate?.sectionSizes.reduce((sum, size) => sum + size, 0) ?? 0;
  const weeks = candidate ? weekCount(candidate.sectionSizes, pacing) : 0;
  const preview =
    candidate && isCalendarDate(startDate) && weeks > 0
      ? `${pluralize(total, "problem")} over ${pluralize(weeks, "week")}, ${formatCalendarDate(startDate)} – ${formatCalendarDate(addDays(startDate, weeks * 7 - 1), { year: "numeric" })}`
      : null;

  const curated = candidates.filter((c) => c.kind === "CURATED");
  const custom = candidates.filter((c) => c.kind === "CUSTOM");

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="groupId" value={groupId} />
      <FormField
        name="roadmapVersionId"
        label="Roadmap"
        error={state.fieldErrors?.roadmapVersionId}
      >
        {(props) => (
          <NativeSelect
            {...props}
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
          >
            {custom.length > 0 ? (
              <optgroup label="Your and your groups' roadmaps">
                {custom.map((c) => (
                  <option key={c.versionId} value={c.versionId}>
                    {c.title} (version {c.versionNumber})
                  </option>
                ))}
              </optgroup>
            ) : null}
            {curated.length > 0 ? (
              <optgroup label="Curated lists">
                {curated.map((c) => (
                  <option key={c.versionId} value={c.versionId}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        name="startDate"
        label="Start date"
        description="Week 1 begins on this day; each week after starts 7 days later, in the group's timezone."
        error={state.fieldErrors?.startDate}
      >
        {(props) => (
          <Input
            {...props}
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        )}
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">Pace</legend>
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="pacingMode"
            value="PER_WEEK"
            checked={mode === "PER_WEEK"}
            onChange={() => setMode("PER_WEEK")}
            className="size-4 accent-[var(--ink)]"
          />
          A set number of problems each week
        </label>
        {mode === "PER_WEEK" ? (
          <FormField
            name="problemsPerWeek"
            label="Problems per week"
            error={state.fieldErrors?.problemsPerWeek}
            className="ml-7 max-w-40"
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={perWeek}
                onChange={(event) => setPerWeek(event.target.value)}
              />
            )}
          </FormField>
        ) : null}
        <label className="flex items-center gap-3">
          <input
            type="radio"
            name="pacingMode"
            value="PER_SECTION"
            checked={mode === "PER_SECTION"}
            onChange={() => setMode("PER_SECTION")}
            className="size-4 accent-[var(--ink)]"
          />
          One section of the roadmap each week
        </label>
      </fieldset>

      <p aria-live="polite" className="rounded-[10px] bg-raised px-3 py-2.5 empty:hidden">
        {preview}
      </p>
      {replacing ? (
        <p className="text-ink-muted">
          This replaces {replacing}. Members keep every problem they&apos;ve solved; any weeks you
          moved by hand are reset.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <FormAlert state={state} className="mr-auto" />
        <Link href={`/groups/${groupId}`} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
        <SubmitButton pendingLabel="Saving…">
          {replacing ? "Replace plan" : "Start plan"}
        </SubmitButton>
      </div>
    </form>
  );
}
