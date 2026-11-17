import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { createPublishedRoadmap, createTestGroup, createTestUser } from "@/test/factories";
import { getGroupOverview } from "@/modules/groups/service";
import { getRankings } from "./rankings";
import { getAffiliation, searchOrganizations, setAffiliation } from "./service";

// Monday 2026-11-16, 12:00 in Los Angeles.
const NOW = new Date("2026-11-16T20:00:00Z");

const CSULB = "school:csulb.edu";
const CSUF = "school:fullerton.edu";
const GOOGLE = "company:google";

async function organizations() {
  await prisma.organization.createMany({
    data: [
      {
        id: CSULB,
        kind: "SCHOOL",
        name: "California State University, Long Beach",
        country: "US",
        aliases: ["CSULB", "Cal State Long Beach"],
      },
      {
        id: CSUF,
        kind: "SCHOOL",
        name: "California State University, Fullerton",
        country: "US",
        aliases: ["CSUF"],
      },
      { id: "school:lbcc.edu", kind: "SCHOOL", name: "Long Beach City College", country: "US" },
      { id: "school:stanford.edu", kind: "SCHOOL", name: "Stanford University", country: "US" },
      { id: GOOGLE, kind: "COMPANY", name: "Google", aliases: ["Alphabet"] },
      { id: "company:meta", kind: "COMPANY", name: "Meta", aliases: ["Facebook"] },
    ],
  });
}

let count = 0;
async function person(
  data: {
    schoolId?: string;
    companyId?: string;
    showAffiliation?: boolean;
    timezone?: string;
  } = {},
) {
  const n = ++count;
  const user = await createTestUser({ name: `Person ${n}` });
  await prisma.profile.create({
    data: {
      userId: user.id,
      username: `person${n}`,
      timezone: data.timezone ?? "America/Los_Angeles",
      schoolId: data.schoolId,
      companyId: data.companyId,
      showAffiliation: data.showAffiliation,
    },
  });
  return user;
}

const ids = (options: { id: string }[]) => options.map((o) => o.id);

describe("searching schools and companies", () => {
  it("matches abbreviations, web addresses, and every word of a name, best first", async () => {
    await organizations();
    expect(ids(await searchOrganizations("SCHOOL", "csulb"))[0]).toBe(CSULB);
    expect(ids(await searchOrganizations("SCHOOL", "CSUF"))[0]).toBe(CSUF);
    expect(ids(await searchOrganizations("SCHOOL", "stanford.edu"))).toEqual([
      "school:stanford.edu",
    ]);
    // Every word, anywhere in the name: both Long Beach schools, the one starting so first.
    expect(ids(await searchOrganizations("SCHOOL", "long beach"))).toEqual([
      "school:lbcc.edu",
      CSULB,
    ]);
    expect(ids(await searchOrganizations("SCHOOL", "cal state long beach"))).toEqual([CSULB]);
    expect(ids(await searchOrganizations("COMPANY", "alphabet"))).toEqual([GOOGLE]);
  });

  it("keeps schools and companies apart, and treats wildcards as text", async () => {
    await organizations();
    expect(await searchOrganizations("SCHOOL", "google")).toEqual([]);
    expect(await searchOrganizations("SCHOOL", "%")).toEqual([]);
    expect(await searchOrganizations("SCHOOL", "_")).toEqual([]);
    expect(await searchOrganizations("SCHOOL", "  ")).toEqual([]);
  });
});

describe("choosing a school and company", () => {
  it("saves, shows in Settings, and deletes on removal", async () => {
    await organizations();
    const ada = await person();
    await setAffiliation(
      ada.id,
      { schoolId: CSULB, companyId: GOOGLE, showAffiliation: true },
      NOW,
    );
    expect(await getAffiliation(ada.id)).toMatchObject({
      school: { id: CSULB, detail: "csulb.edu · United States" },
      company: { id: GOOGLE, name: "Google" },
      showAffiliation: true,
    });
    await setAffiliation(ada.id, { schoolId: null, companyId: null, showAffiliation: false }, NOW);
    expect(
      await prisma.profile.findUniqueOrThrow({
        where: { userId: ada.id },
        select: { schoolId: true, companyId: true },
      }),
    ).toEqual({ schoolId: null, companyId: null });
  });

  it("refuses organizations that aren't on the list", async () => {
    await organizations();
    const ada = await person();
    await expect(
      setAffiliation(
        ada.id,
        { schoolId: "school:nowhere.edu", companyId: null, showAffiliation: false },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_SCHOOL", field: "schoolId" });
    await expect(
      setAffiliation(
        ada.id,
        { schoolId: null, companyId: "company:nowhere", showAffiliation: false },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_COMPANY", field: "companyId" });
  });

  it("limits changes to 10 a day, but not the group switch", async () => {
    await organizations();
    const ada = await person();
    for (let i = 0; i < 10; i += 1) {
      await setAffiliation(
        ada.id,
        { schoolId: i % 2 ? CSULB : CSUF, companyId: null, showAffiliation: false },
        NOW,
      );
    }
    // The last save chose CSULB; flipping the switch alone still works.
    await setAffiliation(ada.id, { schoolId: CSULB, companyId: null, showAffiliation: true }, NOW);
    await expect(
      setAffiliation(ada.id, { schoolId: CSUF, companyId: null, showAffiliation: true }, NOW),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("keeps a school a school and a company a company (CHECK constraints)", async () => {
    await organizations();
    const ada = await person();
    await expect(
      prisma.profile.update({ where: { userId: ada.id }, data: { schoolId: GOOGLE } }),
    ).rejects.toThrow(/profile_school_kind/);
    await expect(
      prisma.profile.update({ where: { userId: ada.id }, data: { companyId: CSULB } }),
    ).rejects.toThrow(/profile_company_kind/);
    await expect(
      prisma.organization.create({ data: { id: "company:x", kind: "SCHOOL", name: "X" } }),
    ).rejects.toThrow(/organization_id_kind/);
    await expect(
      prisma.organization.create({
        data: { id: "school:x.edu", kind: "SCHOOL", name: "X", country: "usa" },
      }),
    ).rejects.toThrow(/organization_country_code/);
    // An organization someone chose can't be deleted out from under them.
    await prisma.profile.update({ where: { userId: ada.id }, data: { schoolId: CSULB } });
    await expect(prisma.organization.delete({ where: { id: CSULB } })).rejects.toThrow();
  });
});

describe("rankings", () => {
  async function solve(userId: string, slugs: string[], completedAt: Date) {
    const problems = await prisma.problem.findMany({ where: { leetcodeSlug: { in: slugs } } });
    await prisma.problemCompletion.createMany({
      data: problems.map((p) => ({ userId, problemId: p.id, source: "MANUAL", completedAt })),
    });
  }

  it("lists only organizations with 5 members, by this month's solves", async () => {
    await organizations();
    await createPublishedRoadmap();
    const beach = await Promise.all(
      Array.from({ length: 5 }, () => person({ schoolId: CSULB, companyId: GOOGLE })),
    );
    const titans = await Promise.all(Array.from({ length: 4 }, () => person({ schoolId: CSUF })));
    await solve(beach[0]!.id, ["two-sum", "valid-anagram"], NOW);
    await solve(beach[1]!.id, ["two-sum"], new Date("2026-11-02T18:00:00Z"));
    // Last month: not counted.
    await solve(beach[2]!.id, ["two-sum"], new Date("2026-10-20T18:00:00Z"));
    await solve(titans[0]!.id, ["two-sum", "valid-anagram", "min-stack"], NOW);

    const schools = await getRankings("SCHOOL", NOW);
    // Fullerton has more solves but only 4 members, so it isn't listed at all.
    expect(schools).toEqual([
      {
        id: CSULB,
        name: "California State University, Long Beach",
        rank: 1,
        members: 5,
        solved: 3,
        perMember: 0.6,
      },
    ]);
    expect(await getRankings("COMPANY", NOW)).toMatchObject([{ id: GOOGLE, solved: 3 }]);

    // A fifth member lists Fullerton, tied with Long Beach at 3 solves (ties by name).
    await person({ schoolId: CSUF });
    expect(
      (await getRankings("SCHOOL", NOW)).map((r) => [r.name, r.rank, r.solved, r.members]),
    ).toEqual([
      ["California State University, Fullerton", 1, 3, 5],
      ["California State University, Long Beach", 1, 3, 5],
    ]);

    // Removing a school removes that person's share at once.
    await prisma.profile.update({ where: { userId: beach[0]!.id }, data: { schoolId: null } });
    expect(ids(await getRankings("SCHOOL", NOW))).toEqual([CSUF]);
  });

  it("counts each person's month in their own time zone", async () => {
    await organizations();
    await createPublishedRoadmap();
    // 2026-11-01 05:00 UTC is October 31 in Los Angeles but November 1 in London.
    const early = new Date("2026-11-01T05:00:00Z");
    const pacific = await person({ schoolId: CSULB, timezone: "America/Los_Angeles" });
    const london = await person({ schoolId: CSULB, timezone: "Europe/London" });
    await Promise.all(Array.from({ length: 3 }, () => person({ schoolId: CSULB })));
    await solve(pacific.id, ["two-sum"], early);
    await solve(london.id, ["two-sum"], early);
    expect((await getRankings("SCHOOL", NOW))[0]!.solved).toBe(1);
  });
});

describe("groups", () => {
  it("see a member's school and company only with their switch on", async () => {
    await organizations();
    const shown = await person({ schoolId: CSULB, companyId: GOOGLE, showAffiliation: true });
    const hidden = await person({ schoolId: CSUF, companyId: GOOGLE });
    const group = await createTestGroup([
      { userId: shown.id, role: "ADMIN" },
      { userId: hidden.id, role: "MEMBER" },
    ]);
    const overview = await getGroupOverview(hidden.id, group.id);
    const label = (userId: string) =>
      overview.members.find((m) => m.userId === userId)?.affiliation;
    expect(label(shown.id)).toBe("California State University, Long Beach · Google");
    expect(label(hidden.id)).toBeNull();
  });
});
