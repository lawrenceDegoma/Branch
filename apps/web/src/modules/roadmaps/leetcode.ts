import { problemSlugSchema } from "@branch/shared/catalog";

const LEETCODE_HOSTS = new Set([
  "leetcode.com",
  "www.leetcode.com",
  "leetcode.cn",
  "www.leetcode.cn",
]);

/**
 * Extracts a problem slug from a LeetCode problem URL ("https://leetcode.com/problems/two-sum/
 * description/") or a bare slug ("two-sum"). Returns null for anything else, including other
 * sites, so Branch never stores arbitrary links.
 */
export function parseLeetCodeSlug(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (!value.includes("/")) {
    const slug = problemSlugSchema.safeParse(value.toLowerCase());
    return slug.success ? slug.data : null;
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!LEETCODE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const [first, slug] = url.pathname.split("/").filter(Boolean);
  if (first !== "problems" || !slug) return null;
  const parsed = problemSlugSchema.safeParse(slug.toLowerCase());
  return parsed.success ? parsed.data : null;
}
