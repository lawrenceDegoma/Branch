import { describe, expect, it } from "vitest";
import { affiliationLabel, organizationOption, searchTerms } from "./organizations";

describe("search terms", () => {
  it("lowercases, splits on spaces and commas, and keeps at most six words", () => {
    expect(searchTerms("  Cal State,  Long Beach ")).toEqual(["cal", "state", "long", "beach"]);
    expect(searchTerms("a b c d e f g h")).toHaveLength(6);
    expect(searchTerms("   ")).toEqual([]);
  });

  it("escapes LIKE's wildcards, so they match only themselves", () => {
    expect(searchTerms("100% a_b c\\d")).toEqual(["100\\%", "a\\_b", "c\\\\d"]);
  });
});

describe("showing an organization", () => {
  it("tells schools apart by web address and country", () => {
    expect(
      organizationOption({
        id: "school:csulb.edu",
        name: "California State University, Long Beach",
        kind: "SCHOOL",
        country: "US",
      }),
    ).toEqual({
      id: "school:csulb.edu",
      name: "California State University, Long Beach",
      detail: "csulb.edu · United States",
    });
  });

  it("shows companies by name alone", () => {
    expect(
      organizationOption({ id: "company:google", name: "Google", kind: "COMPANY", country: null })
        .detail,
    ).toBeNull();
  });

  it("joins school and company for member lists", () => {
    expect(affiliationLabel({ name: "Stanford University" }, { name: "Google" })).toBe(
      "Stanford University · Google",
    );
    expect(affiliationLabel(null, { name: "Google" })).toBe("Google");
    expect(affiliationLabel(null, null)).toBeNull();
  });
});
