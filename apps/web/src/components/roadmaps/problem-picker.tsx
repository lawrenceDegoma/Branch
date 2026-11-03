"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { lookupLeetCodeAction, searchProblemsAction } from "@/modules/roadmaps/actions";
import type { ProblemSummary } from "@/modules/roadmaps/service";
import { DifficultyPill } from "./difficulty-pill";

export function ProblemPicker({
  sections,
  target,
  onTargetChange,
  used,
  onAdd,
}: {
  sections: { key: string; title: string }[];
  target: string;
  onTargetChange: (key: string) => void;
  used: Set<string>;
  onAdd: (problem: ProblemSummary) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProblemSummary[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const text = query.trim();
    const timer = setTimeout(() => {
      startSearch(async () => setResults(text.length >= 2 ? await searchProblemsAction(text) : []));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const disabled = sections.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-target`} className="font-medium">
          Add to section
        </label>
        <NativeSelect
          id={`${id}-target`}
          value={target}
          onChange={(event) => onTargetChange(event.target.value)}
          disabled={disabled}
        >
          {sections.map((section) => (
            <option key={section.key} value={section.key}>
              {section.title || "Untitled section"}
            </option>
          ))}
        </NativeSelect>
        {disabled ? <p className="text-xs text-ink-muted">Add a section first.</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-search`} className="font-medium">
          Search problems
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
          />
          <Input
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title or LeetCode link"
            className="pl-9"
            autoComplete="off"
            disabled={disabled}
          />
        </div>
        <p aria-live="polite" className="text-xs text-ink-muted">
          {query.trim().length >= 2 && !searching
            ? results.length === 0
              ? "No matches in the catalog. Add it from a LeetCode link below."
              : `${results.length} ${results.length === 1 ? "match" : "matches"}`
            : ""}
        </p>
        {results.length > 0 ? (
          <ul className="flex flex-col divide-y divide-rule">
            {results.map((problem) => {
              const added = used.has(problem.id);
              return (
                <li key={problem.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{problem.title}</p>
                    <DifficultyPill difficulty={problem.difficulty} className="mt-1" />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={added || disabled}
                    onClick={() => onAdd(problem)}
                  >
                    {/* The visible word starts the accessible name (WCAG 2.5.3). */}
                    {added ? (
                      <>
                        Added<span className="sr-only">: {problem.title} is in this roadmap</span>
                      </>
                    ) : (
                      <>
                        <Plus aria-hidden="true" />
                        Add<span className="sr-only"> {problem.title}</span>
                      </>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <LinkAdder disabled={disabled} used={used} onAdd={onAdd} />
    </div>
  );
}

function LinkAdder({
  disabled,
  used,
  onAdd,
}: {
  disabled: boolean;
  used: Set<string>;
  onAdd: (problem: ProblemSummary) => void;
}) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [needsDetails, setNeedsDetails] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setUrl("");
    setNeedsDetails(null);
    setTitle("");
    setDifficulty("MEDIUM");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await lookupLeetCodeAction(
        url,
        needsDetails ? { title, difficulty } : undefined,
      );
      if (result.status === "error") return setMessage(result.message);
      if (result.status === "needs-details") {
        setMessage(null);
        return setNeedsDetails(result.slug);
      }
      if (used.has(result.problem.id))
        return setMessage(`${result.problem.title} is already in this roadmap.`);
      onAdd(result.problem);
      setMessage(`Added ${result.problem.title}.`);
      reset();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-url`} className="font-medium">
          Add from a LeetCode link
        </label>
        <Input
          id={`${id}-url`}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setNeedsDetails(null);
          }}
          placeholder="leetcode.com/problems/…"
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      {needsDetails ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-ink-muted">
            &ldquo;{needsDetails}&rdquo; isn&apos;t in the catalog yet. Add its details as shown on
            LeetCode.
          </legend>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-title`} className="font-medium">
              Problem title
            </label>
            <Input
              id={`${id}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-difficulty`} className="font-medium">
              Difficulty
            </label>
            <NativeSelect
              id={`${id}-difficulty`}
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </NativeSelect>
          </div>
        </fieldset>
      ) : null}
      <p aria-live="polite" className="text-xs text-ink-muted empty:hidden">
        {message}
      </p>
      <Button type="submit" variant="outline" disabled={disabled || pending || url.trim() === ""}>
        {pending ? "Checking…" : needsDetails ? "Add problem" : "Find problem"}
      </Button>
    </form>
  );
}
