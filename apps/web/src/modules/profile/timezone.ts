import { z } from "zod";

const supported = new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]);

export function isValidTimeZone(value: string): boolean {
  return supported.has(value);
}

/** IANA timezones for pickers, sorted, with UTC first. */
export function listTimeZones(): string[] {
  return ["UTC", ...[...supported].filter((zone) => zone !== "UTC").sort()];
}

export const timeZoneSchema = z
  .string()
  .trim()
  .refine(isValidTimeZone, "Choose a timezone from the list.");
