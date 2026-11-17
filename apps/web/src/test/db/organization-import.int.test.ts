import { prisma } from "@branch/database";
import { readOrganizationLists, syncOrganizations } from "@branch/database/organization-import";
import { describe, expect, it } from "vitest";

describe("syncOrganizations", () => {
  it("loads the real lists once, then changes nothing", async () => {
    const lists = readOrganizationLists();
    const first = await syncOrganizations(prisma, lists);
    expect(first.changed).toBe(first.schools + first.companies);
    expect(await prisma.organization.count()).toBe(first.schools + first.companies);
    expect(
      await prisma.organization.findUnique({ where: { id: "school:csulb.edu" } }),
    ).toMatchObject({
      kind: "SCHOOL",
      country: "US",
      aliases: ["CSULB", "Cal State Long Beach", "Long Beach State"],
    });
    expect((await syncOrganizations(prisma, lists)).changed).toBe(0);
  });

  it("renames in place and never deletes one a list dropped", async () => {
    const source = {
      url: "https://github.com/Hipo/university-domains-list",
      commit: "a".repeat(40),
    };
    await syncOrganizations(prisma, {
      schools: { source, schools: [["a.edu", "A College", "US"]] },
      aliases: { "a.edu": ["AC"] },
      companies: [{ slug: "acme", name: "Acme", aliases: [] }],
    });
    // The next list drops the school and renames the company.
    const next = await syncOrganizations(prisma, {
      schools: { source, schools: [] },
      aliases: {},
      companies: [{ slug: "acme", name: "Acme Corporation", aliases: [] }],
    });
    expect(next.changed).toBe(1);
    expect(
      (await prisma.organization.findMany({ orderBy: { id: "asc" } })).map((o) => [o.id, o.name]),
    ).toEqual([
      ["company:acme", "Acme Corporation"],
      ["school:a.edu", "A College"],
    ]);
  });

  it("refuses aliases for schools that aren't listed", async () => {
    await expect(
      syncOrganizations(prisma, {
        schools: { source: { url: "https://example.com", commit: "a".repeat(40) }, schools: [] },
        aliases: { "missing.edu": ["M"] },
        companies: [],
      }),
    ).rejects.toThrow(/missing\.edu/);
  });
});
