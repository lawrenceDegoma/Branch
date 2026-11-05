# LeetCode extension: feasibility spike (M15)

Date: 2026-11-05. Method: a throwaway, local-only Chrome extension (MV3) that observed the owner's
own LeetCode session while they ran and submitted solutions to "Contains Duplicate" in Python 3.
It wrapped the page's `fetch` and `XMLHttpRequest` in the page's own context, recorded watched
requests with code, tokens, and personal fields redacted, made no requests of its own, and sent
nothing anywhere. Everything below is observed behaviour on that date, not a documented or
supported LeetCode API; it can change without notice.

## Verdict

**Feasible, passively.** An accepted submission, its code, language, problem, and time can all be
read from traffic the LeetCode page already makes. The extension needs no extra requests to
LeetCode, no LeetCode credentials, and no background activity.

## Observations

### Submitting

`POST /problems/<slug>/submit/` (fetch, JSON body) when the person presses Submit:

| Request field                         | Meaning                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `typed_code`                          | The submitted code (present; 82 and 116 characters seen) |
| `lang`                                | Language slug, e.g. `python3`                            |
| `question_id`                         | LeetCode's numeric question ID as a string, e.g. `"217"` |
| `solve_elapsed_ms`, `solve_session_*` | LeetCode's own timing; not needed                        |

Response: `{ "submission_id": 2189874571 }` (a number). The problem's slug is in the URL path.
Submitting identical code again gets a **new** submission ID. Rapid resubmits got **HTTP 429**
from LeetCode (rate limited), with an HTML body.

### The verdict

Submissions no longer poll `/submissions/detail/<id>/check/`. The page moves to
`/problems/<slug>/submissions/<id>/` and polls GraphQL (`POST /graphql/`, XHR, response read as a
blob) with operation `submissionDetails`, variables `{ submissionId: "<id>" }`. Fields used:

| Field                           | Seen                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| `statusCode`                    | `16` while judging, then `10` Accepted or `15` Runtime Error |
| `totalCorrect`/`totalTestcases` | `80/80` when accepted; `0` while judging                     |
| `code`                          | The submitted code                                           |
| `lang.name`                     | `python3` (`verboseName` `Python3`)                          |
| `question.titleSlug`            | `contains-duplicate`; `question.questionId` `"217"`          |
| `timestamp`                     | Unix seconds of the submission                               |
| `runtime`, `memory`             | Milliseconds and bytes once judged                           |
| `user.username`                 | The LeetCode account (not needed; must not be stored)        |

Other status codes (Wrong Answer, Time Limit Exceeded, Compile Error, …) were not observed;
only `10` matters for completion. The same response is fetched again whenever a person opens an
old submission's page, so seeing `statusCode: 10` does **not** by itself mean a new solve.

### The page

After an accepted submit, `[data-e2e-locator="submission-result"]` reads "Accepted". After a
failed one, `[data-e2e-locator="console-result"]` reads the verdict (e.g. "Runtime Error"). These
are LeetCode's test hooks and could serve as a fallback signal.

### Running (not submitting)

`POST /problems/<slug>/interpret_solution/` returns an `interpret_id` like `runcode_…`; the page
then polls `/submissions/detail/runcode_…/check/`, whose result has
`task_name: "judger.runcodetask.RunCode"`. Runs never produce a numeric submission ID, so they
are easy to ignore.

### Other things seen

- A collaboration WebSocket (`collaboration-ws.leetcode.com`) on problem pages; unrelated.
- LeetCode has its own AI complexity analysis (`submissionAnalysis`, a limited number of uses).
  Branch must not read it; Phase 4 analysis stays Branch's own.

## Design consequences

1. **Signal:** a submission counts when the extension saw the person press Submit in that tab
   (the `submit` request gave it the ID) **and** then saw `submissionDetails` for that ID with
   `statusCode` 10 and all tests passing. Requiring the observed submit means browsing old
   submissions never syncs them as new solves.
2. **Payload:** submission ID, problem slug, language, code, and LeetCode's timestamp, taken from
   the `submissionDetails` response (falling back to the submit request's `typed_code`/`lang`).
   Never the username, profile, runtime distributions, or anything else.
3. **No extra traffic:** the extension only observes; it never calls LeetCode. This respects the
   rate limiting seen above and LeetCode's terms, which (per their published text) prohibit
   scraping and crawling, unattended processes, and burdening their infrastructure.
4. **Duplicates:** Branch keys submissions on (user, LeetCode submission ID), so the repeated
   `submissionDetails` polls and retries are harmless; completion stays one per user and problem.
5. **Matching problems:** by slug against Branch's catalog (`Problem.leetcodeSlug`).
6. **Resilience:** recognize the shapes defensively (unknown shape → do nothing, log a count in
   the popup); the page test hooks are a second signal; manual completion is always available.
   A LeetCode change can make the extension stop syncing, but cannot corrupt progress.
7. **Permissions:** content scripts on `https://leetcode.com/*` only (one in the page's world to
   observe, one isolated to relay), `storage` for the queue and connection, and host access to
   Branch's own origin to send. No `tabs`, `webRequest`, `cookies`, or `<all_urls>`.

## Limits

- leetcode.com only (not leetcode.cn).
- Observed in Chrome with one account, one problem, one language. Other languages, contest
  pages, and the older problem UI were not tested; the extension must tolerate their absence.
- The extension can only sync while the tab is open and the person is connected; submissions
  made elsewhere (another browser, the mobile app) are not seen.
