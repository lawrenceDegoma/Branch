import { difficultySchema } from "@branch/shared/catalog";
import { z } from "zod";

export const roadmapIdSchema = z.uuid();

export const roadmapDetailsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the roadmap a title.")
    .max(80, "Use at most 80 characters."),
  description: z
    .string()
    .trim()
    .max(500, "Use at most 500 characters.")
    .transform((value) => value || null),
});
export type RoadmapDetailsInput = z.infer<typeof roadmapDetailsSchema>;

export const MAX_SECTIONS = 50;
export const MAX_PROBLEMS = 500;

/** Draft content as edited. Saving allows work in progress (empty sections). */
export const draftContentSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z
          .string()
          .trim()
          .min(1, "Every section needs a title.")
          .max(80, "Section titles are at most 80 characters."),
        problemIds: z.array(z.uuid()),
      }),
    )
    .max(MAX_SECTIONS, `A roadmap can have at most ${MAX_SECTIONS} sections.`),
});
export type DraftContent = z.infer<typeof draftContentSchema>;

/** Why a draft can't be published yet, or null when it can. */
export function publishProblem(content: DraftContent): string | null {
  if (content.sections.length === 0) return "Add at least one section before publishing.";
  const empty = content.sections.find((section) => section.problemIds.length === 0);
  if (empty) return `"${empty.title}" has no problems. Add some or remove the section.`;
  const ids = content.sections.flatMap((section) => section.problemIds);
  if (ids.length > MAX_PROBLEMS) return `A roadmap can have at most ${MAX_PROBLEMS} problems.`;
  if (new Set(ids).size !== ids.length) return "A problem can appear only once in a roadmap.";
  return null;
}

export const newProblemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter the problem's title.")
    .max(200, "Use at most 200 characters."),
  difficulty: difficultySchema,
});
