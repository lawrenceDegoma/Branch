import { describe, expect, it } from "vitest";
import { companyId, organizationKind, schoolId } from "./organizations";

describe("organization IDs", () => {
  it("name their kind", () => {
    expect(organizationKind(schoolId("csulb.edu"))).toBe("SCHOOL");
    expect(organizationKind(schoolId("hunter.cuny.edu"))).toBe("SCHOOL");
    expect(organizationKind(companyId("jane-street"))).toBe("COMPANY");
  });

  it("reject anything else", () => {
    for (const id of [
      "",
      "csulb.edu",
      "school:",
      "school:csulb",
      "school:CSULB.edu",
      "school:csulb.edu/",
      "company:",
      "company:Jane Street",
      "company:google.com",
      "user:abc",
      "school:csulb.edu:x",
    ]) {
      expect(organizationKind(id), id).toBeNull();
    }
  });
});
