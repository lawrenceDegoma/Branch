# neetcode.io support: feasibility spike

Date: 2026-11-07. Method: a throwaway, local-only Chrome extension (MV3) like the LeetCode one in
[LEETCODE-SPIKE.md](LEETCODE-SPIKE.md), watching the owner's own neetcode.io session while they ran
and submitted "Contains Duplicate" and "Two Sum" in Python. It wrapped the page's `fetch`,
`XMLHttpRequest`, and `WebSocket`, recorded request shapes with code, tokens, and personal fields
redacted, made no requests of its own, and sent nothing anywhere. Everything below is observed
behaviour on that date, not a documented or supported neetcode.io API; it can change without
notice.

## Verdict

**Feasible, passively**, and simpler than LeetCode: one request and its reply carry the code,
language, problem, and verdict. The extension needs no extra requests and no neetcode.io
credentials.

## Observations

All requests below are same-origin `POST`s (XHR) to `neetcode.io/api/…`, with a JSON body
`{ "data": { … } }` and a reply `{ "data": … }`. Sign-in is Firebase (`securetoken.googleapis.com`).

### Opening a problem

`/api/getProblemMetadataFunctionHttp` with `{ problemId: "duplicate-integer" }`. The reply includes:

| Field                                                     | Seen                                       |
| --------------------------------------------------------- | ------------------------------------------ |
| `id`                                                      | `duplicate-integer` (neetcode.io's own ID) |
| `name`                                                    | `Contains Duplicate` (LeetCode's title)    |
| `difficulty`, `topics`                                    | `Easy`; `Array`, `Hash Table`, …           |
| `description`, `article_body`, `solutions`, `starterCode` | NeetCode's content and official solutions  |
| `submissionHistory`                                       | The person's past submissions, with code   |

neetcode.io's IDs differ from LeetCode's slugs (`duplicate-integer`, `two-integer-sum`, `is-anagram`),
and the page has no link to LeetCode. `name` is LeetCode's title for both problems observed.

### Running (not submitting)

`/api/runCodeFunctionHttp` with `{ lang, problemId, rawCode, testCases }`; the reply is an array, one
result per test case. A run is never a submission and must not count.

### Submitting

`/api/executeCodeFunctionHttp` with `{ lang: "python", problemId, rawCode }`. The reply is the
verdict (no polling):

| Field                                             | Seen                                                         |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `status.id`, `status.description`                 | `3` "Accepted"; runs also showed `11` "Runtime Error (NZEC)" |
| `correct_test_case_count` / `test_case_count`     | `34/34`, `33/33`                                             |
| `date`                                            | ISO time it was judged                                       |
| `token`                                           | The judge's ID for the run (not needed)                      |
| `distribution`, `streakUpdate`, `submissionIndex` | Not needed                                                   |

The status IDs follow the Judge0 convention (1 queued, 2 processing, 3 accepted). There is no
submission ID; `submissionIndex` repeats across problems. Then the page calls
`/api/callableFunctionHttp` `saveProblemAttemptSession` with `accepted: true`.

### Other things seen

`getUserStreakData`, `getContinueState`, and `getCompletedProblems` (which returns LeetCode URLs
for solved problems) on load; course details; GitHub sync status. None are needed.

## Design consequences

1. **Signal:** the reply to `executeCodeFunctionHttp` with `status.id` 3 and every test passed.
   It's only made when the person presses Submit, so runs and old submissions never sync.
2. **Problem:** LeetCode's slug made from the problem's title (`name`), remembered from that tab's
   problem-details reply. All 150 problems in Branch's catalog have the slug their title gives
   ("Pow(x, n)" → `powx-n`). If the title wasn't seen, nothing is sent and the popup says so; if a
   title isn't LeetCode's, the submission waits unmatched and is deleted after 30 days, never
   counted against the wrong problem.
3. **Payload:** the code and language from the submit request (`python` → `python3`, `go` →
   `golang`, as LeetCode names them), the judging time, and `source: NEETCODE`. The ID is the
   judging time in milliseconds, unique per person and site.
4. **What's not read:** from the problem-details reply only `id` and `name` are kept; the
   description, NeetCode's solutions, and past submissions are never stored or sent.
5. **Terms:** neetcode.io's terms (read by the owner, 2026-11-07) don't mention extensions,
   automated access, or scraping. They prohibit distributing or creating derivative works from
   "material obtained with this service"; the extension sends none of neetcode.io's material, only
   the person's own code and which LeetCode problem it solves.
6. **Permissions:** content scripts on `https://neetcode.io/*` (one in the page's world to observe,
   the shared isolated relay). Chrome treats the new site as a new permission: existing users
   approve it when 1.1.0 arrives.

## Limits

- Observed with one account, two free problems, and Python only. Other languages, Pro problems,
  courses' custom problems, and other neetcode.io pages were not tested.
- A problem neetcode.io names differently from LeetCode won't match automatically.
- Like LeetCode, it syncs only while the tab is open and the extension is connected.
