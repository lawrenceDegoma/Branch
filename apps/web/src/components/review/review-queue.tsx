"use client";

import { CircleCheck } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { focusWhenRemoved } from "@/components/forms/confirm-action";
import { FormAlert } from "@/components/forms/form-alert";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/form";
import { recordReviewAction } from "@/modules/review/actions";
import type { ReviewOutcome } from "@/modules/review/schedule";

export type ReviewCardData = {
  problem: {
    id: string;
    title: string;
    leetcodeSlug: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
  };
  /** "Solved Nov 3" or "Last review Oct 30: Struggled", formatted on the server. */
  context: string;
  choices: { outcome: ReviewOutcome; label: string; when: string }[];
};

/**
 * The due reviews. Rating one removes its card, so the result is announced here (outside the
 * cards) and focus moves to the section heading instead of falling to the page body.
 */
export function ReviewQueue({ items, headingId }: { items: ReviewCardData[]; headingId: string }) {
  const [announcement, setAnnouncement] = useState("");
  return (
    <>
      <div role="status" className="empty:-mt-3">
        {announcement ? (
          <p className="flex items-start gap-2 rounded-[10px] bg-positive-soft px-3 py-2.5">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-positive" />
            {announcement}
          </p>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ol aria-label="Due reviews" className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.problem.id}>
              <ReviewCard
                item={item}
                onReviewed={(message, form) => {
                  setAnnouncement(message);
                  focusWhenRemoved(form, headingId);
                }}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

function ReviewCard({
  item,
  onReviewed,
}: {
  item: ReviewCardData;
  onReviewed: (message: string, form: HTMLFormElement | null) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(async (prev: FormState, data: FormData) => {
    const result = await recordReviewAction(prev, data);
    if (result.status === "success") onReviewed(result.message ?? "Saved.", form.current);
    return result;
  }, initialFormState);
  const { problem } = item;
  const headingId = `review-${problem.id}`;
  const promptId = `review-${problem.id}-prompt`;

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <div>
        <h3 id={headingId} className="flex flex-wrap items-center gap-2 font-medium">
          <a
            href={`https://leetcode.com/problems/${problem.leetcodeSlug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {problem.title}
            <span className="sr-only"> (opens LeetCode in a new tab)</span>
          </a>
          <DifficultyPill difficulty={problem.difficulty} />
        </h3>
        <p className="text-xs text-ink-muted">{[...problem.topics, item.context].join(" · ")}</p>
      </div>
      <form ref={form} action={action} noValidate className="flex flex-col gap-2">
        <input type="hidden" name="problemId" value={problem.id} />
        <p id={promptId} className="text-ink-muted">
          Try it again, then say how it went.
        </p>
        <div
          role="group"
          aria-labelledby={promptId}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {item.choices.map((choice) => (
            <ChoiceButton key={choice.outcome} {...choice} />
          ))}
        </div>
        {state.status === "error" ? <FormAlert state={state} /> : null}
      </form>
    </article>
  );
}

/** One outcome. Only the button that was pressed shows the pending label. */
function ChoiceButton({ outcome, label, when }: ReviewCardData["choices"][number]) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("outcome") === outcome;
  return (
    <Button
      type="submit"
      name="outcome"
      value={outcome}
      variant="outline"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
      className="h-auto min-h-12 flex-col gap-0 rounded-xl py-1.5 whitespace-normal pointer-coarse:h-auto"
    >
      <span>{mine ? "Saving…" : label}</span>{" "}
      <span className="text-xs font-normal text-ink-muted">back {when}</span>
    </Button>
  );
}
