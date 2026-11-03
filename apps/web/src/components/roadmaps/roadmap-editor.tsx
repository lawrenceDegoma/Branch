"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { publishDraftAction, saveDraftAction } from "@/modules/roadmaps/actions";
import type { ProblemSummary } from "@/modules/roadmaps/service";
import { DifficultyPill } from "./difficulty-pill";
import { ProblemPicker } from "./problem-picker";

type EditorSection = { key: string; title: string; problems: ProblemSummary[] };

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

// Initial keys are deterministic so server and client render the same markup; sections added
// in the browser get fresh keys.
let keySeed = 0;
const newKey = () => `new-section-${++keySeed}`;

export function RoadmapEditor({
  roadmapId,
  initialSections,
  actions,
}: {
  roadmapId: string;
  initialSections: { title: string; problems: ProblemSummary[] }[];
  actions?: React.ReactNode;
}) {
  const [sections, setSections] = useState<EditorSection[]>(() =>
    initialSections.map((section, index) => ({ ...section, key: `section-${index}` })),
  );
  const [target, setTarget] = useState(sections[0]?.key ?? "");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const used = useMemo(
    () => new Set(sections.flatMap((s) => s.problems.map((p) => p.id))),
    [sections],
  );
  const problemCount = used.size;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(change: (current: EditorSection[]) => EditorSection[]) {
    setSections(change);
    setDirty(true);
    setStatus(null);
  }

  const content = () => ({
    sections: sections.map((s) => ({
      title: s.title.trim(),
      problemIds: s.problems.map((p) => p.id),
    })),
  });

  function save() {
    startTransition(async () => {
      const result = await saveDraftAction(roadmapId, content());
      setStatus(result);
      if (result.ok) setDirty(false);
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishDraftAction(roadmapId, content());
      if (result && !result.ok) setStatus(result);
    });
  }

  function addSection() {
    const key = newKey();
    update((current) => [
      ...current,
      { key, title: `Section ${current.length + 1}`, problems: [] },
    ]);
    setTarget(key);
    setFocusKey(key);
  }

  function addProblem(problem: ProblemSummary) {
    const key = sections.some((s) => s.key === target) ? target : sections[0]?.key;
    if (!key || used.has(problem.id)) return;
    update((current) =>
      current.map((s) => (s.key === key ? { ...s, problems: [...s.problems, problem] } : s)),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
        <p
          aria-live="polite"
          className={cn("text-ink-muted", status && !status.ok && "font-medium text-negative")}
        >
          {status?.message ??
            (dirty
              ? "Unsaved changes"
              : `${sections.length} ${sections.length === 1 ? "section" : "sections"} · ${problemCount} ${problemCount === 1 ? "problem" : "problems"}`)}
        </p>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button variant="outline" onClick={save} disabled={pending || !dirty}>
            Save draft
          </Button>
          <Button onClick={publish} disabled={pending}>
            {pending ? "Working…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          {sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-5 py-6 text-ink-muted">
              Roadmaps are made of sections, like &ldquo;Arrays&rdquo; or &ldquo;Week 1&rdquo;. Add
              one to start.
            </div>
          ) : null}
          {sections.map((section, sectionIndex) => (
            <section
              key={section.key}
              aria-label={section.title || "Untitled section"}
              className="rounded-xl bg-surface p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Section title"
                  value={section.title}
                  maxLength={80}
                  autoFocus={focusKey === section.key}
                  onChange={(event) =>
                    update((current) =>
                      current.map((s) =>
                        s.key === section.key ? { ...s, title: event.target.value } : s,
                      ),
                    )
                  }
                  className="font-medium"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move section ${section.title} up`}
                  disabled={sectionIndex === 0}
                  onClick={() => update((current) => move(current, sectionIndex, sectionIndex - 1))}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move section ${section.title} down`}
                  disabled={sectionIndex === sections.length - 1}
                  onClick={() => update((current) => move(current, sectionIndex, sectionIndex + 1))}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove section ${section.title}`}
                  onClick={() => update((current) => current.filter((s) => s.key !== section.key))}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {section.problems.length === 0 ? (
                <p className="mt-3 text-ink-muted">No problems yet. Add some from the panel.</p>
              ) : (
                <ol className="mt-3 divide-y divide-rule">
                  {section.problems.map((problem, index) => (
                    <li key={problem.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{problem.title}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                          <DifficultyPill difficulty={problem.difficulty} />
                          <span className="truncate">{problem.leetcodeSlug}</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${problem.title} up`}
                        disabled={index === 0}
                        onClick={() =>
                          update((current) =>
                            current.map((s) =>
                              s.key === section.key
                                ? { ...s, problems: move(s.problems, index, index - 1) }
                                : s,
                            ),
                          )
                        }
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${problem.title} down`}
                        disabled={index === section.problems.length - 1}
                        onClick={() =>
                          update((current) =>
                            current.map((s) =>
                              s.key === section.key
                                ? { ...s, problems: move(s.problems, index, index + 1) }
                                : s,
                            ),
                          )
                        }
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${problem.title}`}
                        onClick={() =>
                          update((current) =>
                            current.map((s) =>
                              s.key === section.key
                                ? { ...s, problems: s.problems.filter((p) => p.id !== problem.id) }
                                : s,
                            ),
                          )
                        }
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
          <Button variant="outline" onClick={addSection} className="self-start">
            <Plus aria-hidden="true" />
            Add section
          </Button>
        </div>

        <aside
          aria-label="Add problems"
          className="rounded-xl bg-surface p-4 sm:p-5 lg:sticky lg:top-6"
        >
          <h2 className="mb-4 text-base font-medium">Add problems</h2>
          <ProblemPicker
            sections={sections.map((s) => ({ key: s.key, title: s.title }))}
            target={target}
            onTargetChange={setTarget}
            used={used}
            onAdd={addProblem}
          />
        </aside>
      </div>
    </div>
  );
}
