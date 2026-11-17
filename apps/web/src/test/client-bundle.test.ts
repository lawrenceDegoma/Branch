import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Zod validates on the server. A client component that imports a module built with Zod (a
// schemas.ts, lib/form.ts, or a shared contract) ships all of it to every browser, about 27 KB
// compressed, even for one constant. So limits and labels that forms need live in Zod-free files
// (limits.ts, lib/form-state.ts), and this test walks every client component's imports to keep it
// that way. Server actions ("use server") stop the walk: the browser gets only a reference.

const src = path.resolve(import.meta.dirname, "..");
const shared = path.resolve(src, "../../../packages/shared");
const FORBIDDEN = new Set(["zod"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "test" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

function resolve(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(src, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else if (specifier.startsWith("@branch/shared/")) {
    const exports = JSON.parse(readFileSync(path.join(shared, "package.json"), "utf8")).exports;
    const target = exports[`./${specifier.slice("@branch/shared/".length)}`];
    return target ? path.join(shared, target) : null;
  } else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Runtime imports only: `import type` and imports whose every name is `type X` are erased. */
function runtimeImports(source: string): string[] {
  const found: string[] = [];
  const pattern =
    /^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s+"([^"]+)"|^\s*import\s+"([^"]+)"/gm;
  for (const match of source.matchAll(pattern)) {
    if (match[5]) {
      found.push(match[5]);
      continue;
    }
    if (match[2]) continue;
    const names = match[3]!.match(/\{([^}]*)\}/)?.[1];
    const onlyTypes =
      names !== undefined &&
      !match[3]!.replace(/\{[^}]*\}/, "").replace(/[\s,]/g, "") &&
      names
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .every((n) => n.startsWith("type "));
    if (!onlyTypes) found.push(match[4]!);
  }
  return found;
}

/** The chain of files from `start` to a forbidden package, or null. */
function pathToForbidden(start: string): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, trail: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    if (file !== start && /^\s*["']use server["']/m.test(source.slice(0, 200))) return null;
    for (const specifier of runtimeImports(source)) {
      if (FORBIDDEN.has(specifier)) return [...trail, file, specifier];
      const next = resolve(file, specifier);
      const found = next ? walk(next, [...trail, file]) : null;
      if (found) return found;
    }
    return null;
  };
  return walk(start, []);
}

describe("client components", () => {
  it("never pull Zod into the browser", () => {
    const clients = sourceFiles(src).filter((file) =>
      /^\s*["']use client["']/.test(readFileSync(file, "utf8")),
    );
    expect(clients.length).toBeGreaterThan(20);
    const offenders = clients
      .map((file) => pathToForbidden(file))
      .filter((trail): trail is string[] => trail !== null)
      .map((trail) => trail.map((f) => path.relative(src, f)).join(" → "));
    expect(offenders).toEqual([]);
  });

  it("would notice one that does", () => {
    expect(runtimeImports(`import { z } from "zod";`)).toEqual(["zod"]);
    expect(runtimeImports(`import type { Foo } from "./schemas";`)).toEqual([]);
    expect(runtimeImports(`import { type Foo, type Bar } from "./schemas";`)).toEqual([]);
    expect(runtimeImports(`import { type Foo, BAR } from "./schemas";`)).toEqual(["./schemas"]);
    expect(runtimeImports(`export { BAR } from "./limits";`)).toEqual(["./limits"]);
  });
});
