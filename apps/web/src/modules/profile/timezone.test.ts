import { describe, expect, it } from "vitest";
import { isValidTimeZone, listTimeZones } from "./timezone";

describe("timezones", () => {
  it("accepts IANA names and UTC", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects offsets, abbreviations, and junk", () => {
    expect(isValidTimeZone("+05:00")).toBe(false);
    expect(isValidTimeZone("PST")).toBe(false);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
  });

  it("lists UTC first without duplicates", () => {
    const zones = listTimeZones();
    expect(zones[0]).toBe("UTC");
    expect(new Set(zones).size).toBe(zones.length);
  });
});
