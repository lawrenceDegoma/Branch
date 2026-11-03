# Curated roadmap drafts — awaiting owner review

These files are **drafts**. They are not loaded by `pnpm db:seed`, and nothing in the app is
labeled curated from them until the owner approves them.

| File                | Contents                                                                        |
| ------------------- | ------------------------------------------------------------------------------- |
| `catalog.json`      | The 150 problems in NeetCode 150 (a superset of Blind 75), with 18 pattern tags |
| `neetcode-150.json` | NeetCode 150, grouped by pattern in NeetCode's order                            |
| `blind-75.json`     | Blind 75 as organized by NeetCode, grouped by pattern                           |

## Source and license

- Source: [`neetcode-gh/leetcode` `.problemSiteData.json`](https://github.com/neetcode-gh/leetcode/blob/5a3c1b2d59b4e5c6252006343d73849ebc75f796/.problemSiteData.json),
  pinned at commit `5a3c1b2d59b4e5c6252006343d73849ebc75f796`, retrieved 2026-11-03.
- License: MIT, Copyright (c) NeetCode. Keep the attribution (each roadmap's `sourceUrl` points at
  the pinned file and is shown as "Source" on the roadmap page).
- Only identifiers and metadata were taken: LeetCode slug, title, difficulty, pattern, and list
  membership. No problem statements, solutions, or videos.

## Before approving, please check

1. **List membership.** The source flags exactly 150 and 75 problems, and every Blind 75 problem is
   also in NeetCode 150. Blind 75 here is NeetCode's rendition of the original list.
2. **Title casing.** Titles follow NeetCode's casing, which sometimes differs from LeetCode's
   official titles ("Best Time to Buy **And** Sell Stock" vs LeetCode's "Buy **and** Sell").
   Importing overwrites titles for existing catalog problems; three seed titles would change.
3. **LeetCode Premium.** Seven problems are Premium on LeetCode (six of them in Blind 75):
   Encode and Decode Strings, Walls And Gates, Number of Connected Components In An Undirected
   Graph, Graph Valid Tree, Alien Dictionary, Meeting Rooms, Meeting Rooms II. Branch links to
   LeetCode, so members without Premium can't open these.
4. **Naming.** "NeetCode 150" and "Blind 75" are other parties' names. The descriptions state that
   Branch is not affiliated; confirm this is acceptable before showing them publicly.
5. **Spot-check** a handful of slugs and difficulties against LeetCode.

**Grind 75 is not drafted.** Its list has no openly licensed, machine-readable source: the
Tech Interview Handbook repository (MIT) only proxies to a separately hosted site, and scraping
that site's bundle would not be an appropriate source. Options: obtain the data with permission
from its author, or enter it by hand as a custom roadmap.

## Approving

Import approved files into any environment (development or production) from the repository root.
Paths are relative to `packages/database`, and `DATABASE_URL` selects the target database:

```bash
pnpm db:import-curated -- --catalog prisma/data/curated-drafts/catalog.json \
  prisma/data/curated-drafts/neetcode-150.json prisma/data/curated-drafts/blind-75.json --allow-draft
```

Or move them into `prisma/data/` (catalog merged into `catalog.json`, roadmaps into `roadmaps/`) so
the development seed loads them. Re-importing is idempotent; changed content becomes a new version.
