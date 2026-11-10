import { describe, expect, it } from "vitest";
import { CHANGELOG, type ChangelogEntry } from "./entries";
import { unseenEntries } from "./whats-new";

const ID = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$/;

describe("the changelog", () => {
  it("has permanent, unique IDs that start with their date (the database checks the shape too)", () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of CHANGELOG) {
      expect(entry.id).toMatch(ID);
      expect(entry.id.startsWith(`${entry.date}-`)).toBe(true);
      expect(Number.isNaN(Date.parse(entry.date))).toBe(false);
    }
  });

  it("is newest first", () => {
    const dates = CHANGELOG.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("keeps the card short and every entry filled in", () => {
    for (const entry of CHANGELOG) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeLessThanOrEqual(80);
      expect(entry.summary.length).toBeLessThanOrEqual(120);
      expect(entry.details.trim().length).toBeGreaterThan(entry.summary.length);
      // Other parties' list names stay out of Branch's own text (owner decision).
      expect(`${entry.title} ${entry.summary} ${entry.details}`).not.toMatch(
        /\b(Blind|Grind|NeetCode \d+)\b/,
      );
    }
  });
});

describe("unseenEntries", () => {
  const entry = (id: string): ChangelogEntry => ({
    id,
    date: id.slice(0, 10),
    title: id,
    summary: id,
    details: id,
  });
  const entries = [entry("2026-11-20-c"), entry("2026-11-12-b"), entry("2026-11-05-a")];

  it("shows everything since the day someone joined, until they dismiss it", () => {
    expect(
      unseenEntries(entries, { seenId: null, joinedOn: "2026-11-01" }).map((e) => e.id),
    ).toEqual(["2026-11-20-c", "2026-11-12-b", "2026-11-05-a"]);
    // Nothing from the day they joined or before.
    expect(
      unseenEntries(entries, { seenId: null, joinedOn: "2026-11-12" }).map((e) => e.id),
    ).toEqual(["2026-11-20-c"]);
    expect(unseenEntries(entries, { seenId: null, joinedOn: "2026-11-25" })).toEqual([]);
  });

  it("shows only what came after the dismissed entry", () => {
    const after = (seenId: string) =>
      unseenEntries(entries, { seenId, joinedOn: "2026-11-01" }).map((e) => e.id);
    expect(after("2026-11-20-c")).toEqual([]);
    expect(after("2026-11-12-b")).toEqual(["2026-11-20-c"]);
    // An entry that no longer exists: just the newest.
    expect(after("2026-11-10-gone")).toEqual(["2026-11-20-c"]);
  });
});
