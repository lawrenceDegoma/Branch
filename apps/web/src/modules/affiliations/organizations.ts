import type { OrganizationKind } from "@branch/shared/organizations";

// Pure helpers for showing schools and companies.

export type OrganizationOption = { id: string; name: string; detail: string | null };

const regions = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string): string {
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

/** What tells two same-named schools apart: their web address and country. */
export function organizationOption(organization: {
  id: string;
  name: string;
  kind: OrganizationKind;
  country: string | null;
}): OrganizationOption {
  const [, key = ""] = organization.id.split(/:(.*)/s, 2);
  return {
    id: organization.id,
    name: organization.name,
    detail:
      organization.kind === "SCHOOL"
        ? [key, organization.country ? countryName(organization.country) : null]
            .filter(Boolean)
            .join(" · ")
        : null,
  };
}

/** The words of a search, lowercased, with LIKE's wildcards escaped. At most six. */
export function searchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((term) => term.replace(/[\\%_]/g, (c) => `\\${c}`));
}

/** One line for member lists: "School · Company", or null with neither. */
export function affiliationLabel(
  school: { name: string } | null,
  company: { name: string } | null,
): string | null {
  return [school?.name, company?.name].filter(Boolean).join(" · ") || null;
}
