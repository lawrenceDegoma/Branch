import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every server action starts by identifying the person (CLAUDE.md: "every app page and server
// action starts from requireViewer()"), before touching the database or a service. The only
// exceptions are the sign-in actions themselves, which exist for people who aren't signed in.
// Route handlers are few and checked by hand: the extension routes authenticate a bearer token,
// the cron route its secret, and /api/health and /api/photos serve nothing private.

const modules = path.resolve(import.meta.dirname, "../modules");
const SIGNED_OUT = new Set([
  "signInAction",
  "signUpAction",
  "signInWithProviderAction",
  "signOutAction",
  "resetPasswordAction",
]);
const IDENTIFIES = new Set(["requireViewer", "requireUser", "getSession"]);
/** The first thing an action waits for, or the first direct database use. */
const firstWork = /\bprisma\.|\bawait\s+(\w+)\(/;

function actionsIn(file: string) {
  const source = readFileSync(file, "utf8");
  const found: { name: string; body: string }[] = [];
  const pattern = /export async function (\w+)\([^)]*\)[^{]*\{/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const start = match.index + match[0].length;
    const end = source.indexOf("\n}\n", start);
    found.push({ name: match[1]!, body: source.slice(start, end === -1 ? undefined : end) });
  }
  return found;
}

describe("server actions", () => {
  const files = readdirSync(modules)
    .map((dir) => path.join(modules, dir, "actions.ts"))
    .filter((file) => {
      try {
        return readFileSync(file, "utf8").includes('"use server"');
      } catch {
        return false;
      }
    });

  it("exist", () => expect(files.length).toBeGreaterThan(5));

  for (const file of files) {
    for (const { name, body } of actionsIn(file)) {
      if (SIGNED_OUT.has(name)) continue;
      it(`${path.basename(path.dirname(file))}/${name} identifies the person before doing anything`, () => {
        const first = firstWork.exec(body);
        expect(first, "nothing awaited: no requireViewer/requireUser/getSession").not.toBeNull();
        expect(first![1] ?? "prisma", "the first thing done").toSatisfy((call: string) =>
          IDENTIFIES.has(call),
        );
      });
    }
  }
});
