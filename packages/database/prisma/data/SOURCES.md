# Data sources

Branch stores only problem identifiers and metadata: LeetCode slug, title, difficulty, pattern,
Premium status, and list membership. No problem statements, solutions, or videos.

| File                           | Contents                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| `catalog.json`                 | 150 problems with 18 pattern tags                           |
| `roadmaps/patterns-150.json`   | Patterns 150: all 150 problems, grouped by pattern          |
| `roadmaps/essentials-75.json`  | Essentials 75: a shorter core set of 75, grouped by pattern |
| `roadmaps/starter-sample.json` | A labeled development sample (22 problems)                  |

Patterns 150 and Essentials 75 were approved by the owner on 2026-11-03. Branch is not affiliated
with LeetCode or with the authors of the lists below, and does not use their list names.

## Problem selection, patterns, difficulty, and Premium status

- [`neetcode-gh/leetcode` `.problemSiteData.json`](https://github.com/neetcode-gh/leetcode/blob/5a3c1b2d59b4e5c6252006343d73849ebc75f796/.problemSiteData.json),
  pinned at commit `5a3c1b2d59b4e5c6252006343d73849ebc75f796`, retrieved 2026-11-03. Each curated
  roadmap's `sourceUrl` points here and is shown as "Source" on the roadmap page.
- Free alternatives for the seven Premium problems are that file's `freeLink` values (LintCode).

> MIT License
>
> Copyright (c) 2022 neetcode-gh
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
> BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Titles

Titles follow LeetCode's official capitalization, cross-checked against the problem index of
[`kamyu104/LeetCode-Solutions`](https://github.com/kamyu104/LeetCode-Solutions/tree/a5bad320840b8f8f54c2b8619ca929c504381aaf)
(MIT, Copyright (c) 2018 https://github.com/kamyu104/LeetCode-Solutions), pinned at commit `a5bad320840b8f8f54c2b8619ca929c504381aaf`.
That index records some titles and difficulties as first published; where LeetCode has since
renamed a problem ("3Sum", "Two Sum II - Input Array Is Sorted") the current title is used, and
difficulties follow the more current NeetCode data. Three slugs absent from the index (Subtree of
Another Tree, Design Add and Search Words Data Structure, Coin Change II) were titled by hand.

## Adding or changing lists

Drafts awaiting review go in `curated-drafts/`; `pnpm db:import-curated` refuses files there
without `--allow-draft`. To load approved lists into any environment (from the repository root;
paths are relative to `packages/database`; `DATABASE_URL` selects the database):

```bash
pnpm db:import-curated -- --catalog prisma/data/catalog.json \
  prisma/data/roadmaps/patterns-150.json prisma/data/roadmaps/essentials-75.json
```

Re-importing is idempotent; changed content becomes a new version. `pnpm db:seed` loads everything
in this folder for development. Grind 75 is out of scope: it has no openly licensed source.
