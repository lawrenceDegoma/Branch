import { describe, expect, it } from "vitest";
import { parseLeetCodeSlug } from "./leetcode";

describe("parseLeetCodeSlug", () => {
  it.each([
    ["https://leetcode.com/problems/two-sum/", "two-sum"],
    ["https://leetcode.com/problems/two-sum/description/?envType=study-plan", "two-sum"],
    ["leetcode.com/problems/3sum", "3sum"],
    ["https://www.leetcode.com/problems/Valid-Anagram/", "valid-anagram"],
    ["https://leetcode.cn/problems/two-sum/", "two-sum"],
    ["  two-sum  ", "two-sum"],
  ])("reads %s", (input, slug) => {
    expect(parseLeetCodeSlug(input)).toBe(slug);
  });

  it.each([
    "",
    "https://not-leetcode.test/problems/two-sum/",
    "https://leetcode.com/contest/weekly-contest-1/",
    "https://leetcode.com/problems/",
    "two sum",
    "javascript:alert(1)",
    "https://leetcode.com.evil.test/problems/two-sum/",
  ])("rejects %s", (input) => {
    expect(parseLeetCodeSlug(input)).toBeNull();
  });
});
