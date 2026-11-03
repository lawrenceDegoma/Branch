// Spreads a roadmap's items across weeks, in roadmap order.

export type Pacing = { mode: "PER_WEEK"; problemsPerWeek: number } | { mode: "PER_SECTION" };

export const MAX_PROBLEMS_PER_WEEK = 50;
export const MAX_WEEK = 104;

export function generateAssignments(
  sections: { itemIds: string[] }[],
  pacing: Pacing,
): { itemId: string; weekNumber: number }[] {
  if (pacing.mode === "PER_SECTION") {
    return sections
      .filter((section) => section.itemIds.length > 0)
      .flatMap((section, index) =>
        section.itemIds.map((itemId) => ({ itemId, weekNumber: index + 1 })),
      );
  }
  const perWeek = Math.max(1, Math.min(MAX_PROBLEMS_PER_WEEK, Math.floor(pacing.problemsPerWeek)));
  return sections
    .flatMap((section) => section.itemIds)
    .map((itemId, index) => ({ itemId, weekNumber: Math.floor(index / perWeek) + 1 }));
}

/** Number of weeks a pacing produces, for previews. */
export function weekCount(sectionSizes: number[], pacing: Pacing): number {
  const nonEmpty = sectionSizes.filter((size) => size > 0);
  if (pacing.mode === "PER_SECTION") return nonEmpty.length;
  const total = nonEmpty.reduce((sum, size) => sum + size, 0);
  return Math.ceil(total / Math.max(1, pacing.problemsPerWeek));
}
