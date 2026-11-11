import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { acceptanceTests } from "../../scripts/acceptance.mjs";

// docs/ACCEPTANCE.md maps each acceptance scenario to the browser tests that prove it. A test
// renamed or removed without updating the map fails here, so the map stays true.

const root = path.resolve(import.meta.dirname, "../..");
const map = readFileSync(path.resolve(root, "../../docs/ACCEPTANCE.md"), "utf8");
const tests = acceptanceTests(map);

describe("docs/ACCEPTANCE.md", () => {
  it("maps every PRD scenario (1 to 11) to at least one test", () => {
    for (let scenario = 1; scenario <= 11; scenario++) {
      const section = map.split(new RegExp(`^## ${scenario}\\. `, "m"))[1]?.split(/^## /m)[0];
      expect(section, `scenario ${scenario}`).toBeDefined();
      expect(acceptanceTests(section!).length, `scenario ${scenario}`).toBeGreaterThan(0);
    }
  });

  for (const { file, title } of tests) {
    it(`${file} has the test "${title}"`, () => {
      const source = readFileSync(path.join(root, file), "utf8");
      // Titles may wrap onto the next line after `test(`; compare without line breaks.
      expect(source.replace(/\(\s+"/g, '("')).toContain(`test("${title}"`);
    });
  }
});
