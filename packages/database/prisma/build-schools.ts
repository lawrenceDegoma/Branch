// Rebuilds prisma/data/organizations/schools.json from Hipo's university-domains-list (MIT).
//
//   curl -L -o /tmp/hipo.json https://raw.githubusercontent.com/Hipo/university-domains-list/<commit>/world_universities_and_domains.json
//   pnpm --filter @branch/database build-schools -- /tmp/hipo.json <commit>
//
// One school per first web domain, which becomes its permanent ID (`school:<domain>`); when two
// entries share a domain (a renamed or merged school), the first is kept. Sorted by domain so a
// rebuild's diff shows only what changed. Then record the commit in SOURCES.md and run
// `pnpm db:load-organizations`.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { schoolDomainSchema, schoolListSchema } from "@branch/shared/organizations";

const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const [input, commit] = argv;
if (!input || !commit || !/^[0-9a-f]{40}$/.test(commit)) {
  console.error("Usage: pnpm --filter @branch/database build-schools -- <hipo.json> <commit sha>");
  process.exit(1);
}

// Hipo's names, corrected where they're wrong or out of date. Keep this short and listed in
// SOURCES.md; better still, send the fix upstream.
const NAME_CORRECTIONS: Record<string, string> = {
  "csueastbay.edu": "California State University, East Bay",
  "humboldt.edu": "California State Polytechnic University, Humboldt",
};

type HipoEntry = { name: string; domains: string[]; alpha_two_code: string };
const entries = JSON.parse(readFileSync(input, "utf8")) as HipoEntry[];

const byDomain = new Map<string, [string, string, string]>();
let skipped = 0;
for (const entry of entries) {
  const domain = entry.domains[0]?.trim().toLowerCase() ?? "";
  const name = entry.name.replace(/\s+/g, " ").trim();
  const country = entry.alpha_two_code.trim().toUpperCase();
  if (!schoolDomainSchema.safeParse(domain).success || !name || !/^[A-Z]{2}$/.test(country)) {
    skipped += 1;
    continue;
  }
  if (!byDomain.has(domain)) {
    byDomain.set(domain, [domain, NAME_CORRECTIONS[domain] ?? name, country]);
  }
}

const list = schoolListSchema.parse({
  source: {
    url: "https://github.com/Hipo/university-domains-list",
    commit,
  },
  schools: [...byDomain.values()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
});
const output = path.join(import.meta.dirname, "data/organizations/schools.json");
// One school per line keeps the file reviewable and its diffs small.
writeFileSync(
  output,
  `{\n  "source": ${JSON.stringify(list.source)},\n  "schools": [\n${list.schools
    .map((school) => `    ${JSON.stringify(school)}`)
    .join(",\n")}\n  ]\n}\n`,
);
console.log(
  `${list.schools.length} schools written to ${output} (${entries.length - list.schools.length - skipped} shared a domain, ${skipped} skipped).`,
);
