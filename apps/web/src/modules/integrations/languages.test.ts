import { describe, expect, it } from "vitest";
import { codeFence, languageLabel } from "./languages";

describe("languages", () => {
  it("names LeetCode's slugs and falls back to the slug", () => {
    expect(languageLabel("python3")).toBe("Python 3");
    expect(languageLabel("golang")).toBe("Go");
    expect(languageLabel("cobol")).toBe("cobol");
  });

  it("fences code so backticks inside can't close the block", () => {
    expect(codeFence("x = 1", "python3")).toBe("```python\nx = 1\n```");
    expect(codeFence("s = '````'", "cobol")).toBe("`````\ns = '````'\n`````");
  });
});
