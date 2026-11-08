import { ANALYZED_LANGUAGES } from "@/modules/integrations/languages";
import type { SubmissionItem } from "@/modules/integrations/submissions";

const CONFIDENCE = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" } as const;

/**
 * A solution's estimated complexity, shown as an estimate: "probably" (or "at most", for a
 * ceiling the code may never reach), what its letters stand for, its confidence, the reasons,
 * and what the method can't tell. Never a verdict on the solution.
 */
export function SolutionAnalysis({
  analysis,
  language,
}: {
  analysis: SubmissionItem["analysis"];
  language: string;
}) {
  if (!ANALYZED_LANGUAGES.has(language)) {
    return <Note>Not analyzed: only Python solutions are analyzed so far.</Note>;
  }
  if (!analysis || analysis.status === "QUEUED" || analysis.status === "RUNNING") {
    return <Note>Estimating its complexity…</Note>;
  }
  const result = analysis.result;
  if (analysis.status === "FAILED" || !result) {
    return <Note>This solution couldn&apos;t be analyzed.</Note>;
  }
  if (result.outcome !== "OK" || !result.confidence) {
    return <Note>{result.message ?? "This solution couldn't be analyzed."}</Note>;
  }
  return (
    <div className="rounded-[10px] bg-raised px-3 py-2">
      <p>
        {result.bound ? "At most" : "Probably"}{" "}
        <strong className="font-medium">{result.time}</strong> time and{" "}
        <strong className="font-medium">{result.space}</strong> space.{" "}
        <span className="text-ink-muted">
          {CONFIDENCE[result.confidence]} confidence, from reading the code.
        </span>
      </p>
      {result.notation ? (
        <p className="mt-1 text-ink-muted">
          <WithCode text={result.notation} />
        </p>
      ) : null}
      <details className="group mt-1">
        <summary className="inline-flex min-h-8 cursor-pointer items-center font-medium text-ink-muted hover:text-ink pointer-coarse:min-h-11">
          <span className="group-open:hidden">Why, and what it can&apos;t tell</span>
          <span className="hidden group-open:inline">Hide the reasons</span>
        </summary>
        <div className="flex flex-col gap-2 pb-1">
          <ul aria-label="Reasons" className="list-disc pl-5">
            {result.reasons.map((reason) => (
              <li key={reason}>
                <WithCode text={reason} />
              </li>
            ))}
          </ul>
          <p className="font-medium">Limits</p>
          <ul aria-label="Limits" className="list-disc pl-5 text-ink-muted">
            {result.limitations.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

/** The analyzer marks names from the code with backticks; show them as code. */
function WithCode({ text }: { text: string }) {
  return text.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className="font-mono text-[0.8125rem]">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted">{children}</p>;
}
