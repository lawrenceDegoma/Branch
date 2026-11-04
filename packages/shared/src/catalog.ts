import { z } from "zod";

// Contracts for the problem catalog and roadmap definitions. Used by the database seed and
// importer, the web app, and (later) the browser extension.

const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const problemSlugSchema = z
  .string()
  .trim()
  .max(120)
  .regex(kebabCase, "Use the LeetCode slug, e.g. two-sum.");

export const tagSlugSchema = z.string().trim().max(60).regex(kebabCase);

export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const catalogProblemSchema = z.object({
  slug: problemSlugSchema,
  title: z.string().trim().min(1).max(200),
  difficulty: difficultySchema,
  tags: z.array(tagSlugSchema).default([]),
  /** Requires a LeetCode subscription. */
  premium: z.boolean().default(false),
  /** A free equivalent elsewhere, for premium problems. */
  freeUrl: z
    .url({ protocol: /^https$/ })
    .max(300)
    .optional(),
});

export const catalogSchema = z
  .object({
    tags: z.array(z.object({ slug: tagSlugSchema, name: z.string().trim().min(1).max(60) })),
    problems: z.array(catalogProblemSchema),
  })
  .superRefine((catalog, ctx) => {
    const tagSlugs = new Set<string>();
    for (const tag of catalog.tags) {
      if (tagSlugs.has(tag.slug))
        ctx.addIssue({ code: "custom", message: `Duplicate tag "${tag.slug}"` });
      tagSlugs.add(tag.slug);
    }
    const problemSlugs = new Set<string>();
    for (const problem of catalog.problems) {
      if (problemSlugs.has(problem.slug)) {
        ctx.addIssue({ code: "custom", message: `Duplicate problem "${problem.slug}"` });
      }
      problemSlugs.add(problem.slug);
      if (problem.freeUrl && !problem.premium) {
        ctx.addIssue({
          code: "custom",
          message: `Problem "${problem.slug}" has a free alternative but isn't premium`,
        });
      }
      for (const tag of problem.tags) {
        if (!tagSlugs.has(tag)) {
          ctx.addIssue({
            code: "custom",
            message: `Problem "${problem.slug}" uses unknown tag "${tag}"`,
          });
        }
      }
    }
  });
export type Catalog = z.infer<typeof catalogSchema>;

export const roadmapDefinitionSchema = z
  .object({
    slug: z.string().trim().max(80).regex(kebabCase),
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    /** Where the problem mapping comes from; required for curated public lists. */
    sourceUrl: z.url({ protocol: /^https$/ }).optional(),
    sections: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(80),
          problems: z.array(problemSlugSchema).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((definition, ctx) => {
    const seen = new Set<string>();
    for (const section of definition.sections) {
      for (const slug of section.problems) {
        if (seen.has(slug)) {
          ctx.addIssue({ code: "custom", message: `Problem "${slug}" appears more than once` });
        }
        seen.add(slug);
      }
    }
  });
export type RoadmapDefinition = z.infer<typeof roadmapDefinitionSchema>;

export function leetcodeProblemUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}
