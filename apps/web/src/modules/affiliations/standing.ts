// Pure ranking rules (owner decisions, 2026-11-17). An organization appears only with at least 5
// members, so a total never reveals one person; people are never ranked.

export const MIN_MEMBERS = 5;
export const RANKINGS_SHOWN = 50;

export type RankingRow = {
  id: string;
  name: string;
  rank: number;
  members: number;
  solved: number;
  /** Solved per member, to one decimal place. */
  perMember: number;
};

/** Competition ranking ("1, 2, 2, 4") over rows already sorted by solved, most first. */
export function rankRows(
  rows: { id: string; name: string; members: number; solved: number }[],
): RankingRow[] {
  let rank = 0;
  return rows.map((row, index) => {
    if (index === 0 || row.solved !== rows[index - 1]!.solved) rank = index + 1;
    return { ...row, rank, perMember: Math.round((row.solved / row.members) * 10) / 10 };
  });
}

export type Standing =
  | { status: "none" }
  | { status: "too-small"; name: string }
  | { status: "ranked"; row: RankingRow; of: number };

/** Where the viewer's own school or company stands. Never reveals a small one's member count. */
export function standingOf(
  rows: RankingRow[],
  organization: { id: string; name: string } | null,
): Standing {
  if (!organization) return { status: "none" };
  const row = rows.find((r) => r.id === organization.id);
  return row
    ? { status: "ranked", row, of: rows.length }
    : { status: "too-small", name: organization.name };
}

const ORDINAL = new Intl.PluralRules("en", { type: "ordinal" });
const SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n: number): string {
  return `${n}${SUFFIX[ORDINAL.select(n)] ?? "th"}`;
}
