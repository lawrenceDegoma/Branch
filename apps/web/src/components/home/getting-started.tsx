import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ProgressBar } from "@/components/progress/progress-bar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HideGettingStarted } from "./hide-getting-started";

type Step = { done: boolean; title: string; description: string; actions: React.ReactNode };

/**
 * Home's checklist for new members: the few things that make Branch work for them. It goes away
 * once everything's done, or when they hide it.
 */
export function GettingStarted({
  inGroup,
  hasPlan,
  connected,
  shareSolves,
  solved,
  storeUrl,
}: {
  inGroup: boolean;
  /** One of their groups has a roadmap, so Home lists this week's problems. */
  hasPlan: boolean;
  connected: boolean;
  shareSolves: boolean;
  solved: boolean;
  storeUrl?: string;
}) {
  const steps: Step[] = [
    {
      done: inGroup,
      title: "Join or create a group",
      description:
        "Open the invite link a friend sent you, or start a group and invite them. Your group shares a roadmap and a few problems a week.",
      actions: (
        <Link href="/groups/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Create group
        </Link>
      ),
    },
    {
      done: connected,
      title: "Sync your LeetCode solves",
      description:
        "With the Branch extension for Chrome, problems you solve on leetcode.com or neetcode.io count here by themselves. It works in Chrome and other Chromium browsers on a computer.",
      actions: (
        <>
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Get the extension
              <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only"> (opens the Chrome Web Store in a new tab)</span>
            </a>
          ) : null}
          <Link
            href="/settings#extension"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Connect it
          </Link>
        </>
      ),
    },
    {
      done: shareSolves,
      title: "Share your solves with your groups",
      description:
        "Off until you turn it on: your groups see a post when you solve one of their problems. Your code is never posted.",
      actions: (
        <Link
          href="/settings#sharing"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Sharing settings
        </Link>
      ),
    },
    {
      done: solved,
      title: "Solve your first problem",
      description: hasPlan
        ? "Pick one from this week's problems and mark it solved, or let the extension do it."
        : "Mark one solved from any roadmap, or let the extension do it.",
      actions: hasPlan ? (
        <a href="#this-week" className={buttonVariants({ variant: "outline", size: "sm" })}>
          This week&apos;s problems
        </a>
      ) : (
        <Link href="/roadmaps" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Browse roadmaps
        </Link>
      ),
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section
      aria-labelledby="getting-started-heading"
      className="flex flex-col gap-4 rounded-xl bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 id="getting-started-heading" className="text-base font-medium">
            Get started
          </h2>
          <p className="text-ink-muted tabular">
            {done} of {steps.length} done
          </p>
          <ProgressBar value={done} total={steps.length} />
        </div>
        <HideGettingStarted focusTarget={inGroup ? "activity-heading" : "home-heading"} />
      </div>
      <ol aria-label="Steps" className="flex flex-col">
        {steps.map((step) => (
          <li
            key={step.title}
            className="flex gap-3 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0"
          >
            <span
              className={cn(
                "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border",
                step.done ? "border-brand bg-brand text-ground" : "border-control",
              )}
            >
              {step.done ? <Check aria-hidden strokeWidth={3} className="size-3.5" /> : null}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className={cn("font-medium", step.done && "text-ink-muted")}>
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </p>
              {step.done ? null : (
                <>
                  <p className="text-ink-muted">{step.description}</p>
                  <div className="flex flex-wrap gap-2">{step.actions}</div>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
