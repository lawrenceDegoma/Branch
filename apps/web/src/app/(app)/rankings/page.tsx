import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { getRankings } from "@/modules/affiliations/rankings";
import { getAffiliation } from "@/modules/affiliations/service";
import {
  MIN_MEMBERS,
  ordinal,
  RANKINGS_SHOWN,
  standingOf,
  type RankingRow,
  type Standing,
} from "@/modules/affiliations/standing";

export const metadata = { title: "Rankings" };

const KINDS = {
  schools: { kind: "SCHOOL", noun: "school", plural: "Schools" },
  companies: { kind: "COMPANY", noun: "company", plural: "Companies" },
} as const;
type Tab = keyof typeof KINDS;

const perMember = (value: number) => value.toFixed(1);

/**
 * Signed in only (owner decisions, 2026-11-17): schools and companies by the problems their
 * members solved this month. People are never ranked; an organization needs 5 members to appear.
 */
export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { user, profile } = await requireViewer();
  const requested = (await searchParams).kind;
  const tab: Tab = requested === "companies" ? "companies" : "schools";
  const { kind, noun, plural } = KINDS[tab];
  const now = new Date();
  const [rows, affiliation] = await Promise.all([getRankings(kind, now), getAffiliation(user.id)]);
  const mine = kind === "SCHOOL" ? affiliation.school : affiliation.company;
  const standing = standingOf(rows, mine);
  const month = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: profile.timezone,
  }).format(now);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Rankings"
        description={`Schools and companies by the problems their members solved in ${month}. Each person's month runs in their own time zone. People choose their own school and company, and are never ranked themselves.`}
      />
      <nav aria-label="Rankings" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(KINDS) as Tab[]).map((key) => (
            <li key={key}>
              <Link
                href={key === "schools" ? "/rankings" : `/rankings?kind=${key}`}
                aria-current={key === tab ? "page" : undefined}
                className={buttonVariants({
                  variant: key === tab ? "secondary" : "ghost",
                  size: "sm",
                })}
              >
                {KINDS[key].plural}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <StandingNote standing={standing} noun={noun} />

      <section aria-labelledby="ranked-heading" className="mt-6">
        <h2 id="ranked-heading" className="mb-3 text-base font-medium">
          {plural} in {month}
        </h2>
        {rows.length === 0 ? (
          <p className="text-ink-muted">
            No {noun} has {MIN_MEMBERS} members on Branch yet. Each one appears here once{" "}
            {MIN_MEMBERS} people have chosen it in Settings.
          </p>
        ) : (
          <>
            <ol aria-labelledby="ranked-heading" className="flex flex-col gap-2">
              {rows.slice(0, RANKINGS_SHOWN).map((row) => (
                <RankedItem key={row.id} row={row} mine={row.id === mine?.id} />
              ))}
            </ol>
            {rows.length > RANKINGS_SHOWN ? (
              <p className="mt-3 text-ink-muted">
                Showing the top {RANKINGS_SHOWN} of {rows.length}.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function RankedItem({ row, mine }: { row: RankingRow; mine: boolean }) {
  return (
    <li
      aria-current={mine ? "true" : undefined}
      className="flex items-start gap-3 rounded-xl bg-surface p-4 aria-[current=true]:bg-raised"
    >
      <span className="w-10 shrink-0 text-lg leading-6 font-semibold tabular">
        <span className="sr-only">Rank </span>
        {row.rank}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium break-words">{row.name}</span>
          {mine ? (
            <span className="inline-flex h-5 items-center rounded-full bg-surface px-2 text-xs font-medium whitespace-nowrap text-ink-muted">
              Yours
            </span>
          ) : null}
        </p>
        <p className="text-ink-muted tabular">
          {pluralize(row.solved, "problem")} solved · {pluralize(row.members, "member")} ·{" "}
          {perMember(row.perMember)} per member
        </p>
      </div>
    </li>
  );
}

function StandingNote({ standing, noun }: { standing: Standing; noun: string }) {
  const settings = (
    <Link href="/settings#affiliation" className="text-ink underline underline-offset-4">
      Settings
    </Link>
  );
  return (
    <p className="rounded-xl bg-surface p-4">
      {standing.status === "none" ? (
        <>
          You haven&apos;t added a {noun}. Add one in {settings} to count toward its total, without
          your name.
        </>
      ) : standing.status === "too-small" ? (
        <>
          <span className="font-medium">{standing.name}</span> appears here once {MIN_MEMBERS}{" "}
          people have chosen it. Until then your solves still count toward it.
        </>
      ) : (
        <>
          <span className="font-medium">{standing.row.name}</span> is {ordinal(standing.row.rank)}{" "}
          of {standing.of} this month, with {pluralize(standing.row.solved, "problem")} solved by{" "}
          {pluralize(standing.row.members, "member")} ({perMember(standing.row.perMember)} each).
        </>
      )}
    </p>
  );
}
