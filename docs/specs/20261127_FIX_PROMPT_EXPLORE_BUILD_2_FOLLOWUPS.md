FIX PROMPT — Explore Build 2 follow-ups (dark)
For: Claude Code, a new session, in `C:\Users\fashr\portfolio-duel`.
From: the Explore chat, Nov 27, 2026.
Run after: PR #1125 (Explore Build 2) is merged to `main`.
Three small fixes left over from Explore Build 2's review. Nothing here changes the live app: `EXPLORE_MODE` stays `'off'`, `EXPLORE_COMPARE_ROUTE` stays `false`, and the publish command is founder-run only.
Preamble — check before any edit

1. `git fetch origin`. Cut `claude/explore-build-2-followups` from current `origin/main`.
2. STOP if `src/components/Explore/ExploreJumpRow.jsx` is not on `main` (Build 2 has not merged).
3. Commit this prompt first, at `docs/specs/20261127_FIX_PROMPT_EXPLORE_BUILD_2_FOLLOWUPS.md`.
4. Record the baseline: the Explore test files, `src/config/exploreFlags.test.js`, `sharedResearch.boundary.test.js`, and the six publish-step test files (`api/_utils/explore/*.test.js`, `scripts/explore-publish.test.js`), with counts.
5. Read `docs/audits/20261127_BUILD_EXPLORE_2.md`: review rows P-1, P-3, N-5 and the "Watch on the allowlist" list. These three fixes close them.

Rules for this task

* One branch, one draft PR, dark. The founder merges. Do not merge and do not watch CI.
* You may edit: files under `src/components/Explore/`; `api/_utils/explore/storyCheck.js` and the publish-step tests that pin it; the report.
* STOP paths (no edits): `src/components/SharedResearch/`, `src/components/CommandCenter/`, `src/services/sharedResearchService.js`, `src/components/Navigation/`, `src/config/exploreFlags.js`, `firestore.rules`, `firestore.indexes.json`, and every other file under `api/` and `scripts/`.
* No new research request, no new write, no new collection, no model or provider call.
* Never write to production and never send `--go`.
* Every fix gets a row that fails before the fix and passes after, and a mutant that the row kills.

F-1 — The story panel's Try again never drops focus
Where: `src/components/Explore/ExplorePanel.jsx`, the read-failed form (form E), the button marked `data-explore-retry-read`. Its handler is `research.retry` (handed in at `ExploreStory.jsx`, `onRetry`).
Today: the tap starts a fresh read, the panel redraws, the button leaves the page, and focus falls to `<body>`.
Ruling:

* After the tap, focus is on an element that is still on the page while the read is out and after it answers. Use the panel's own heading if it stays through the reload; otherwise the story's title. Never `<body>`.
* `preventScroll: true`. The tap never moves the page.
* This holds whether the retry succeeds (forms A, B or C draw) or fails again (form E draws again, and the player can Tab straight to Try again).
* Follow the shelf's fix (`ExploreShelf.jsx`, review P-3) so the two behave the same.

Also check, and report each as "fixed" or "already held": every other Try again in Explore (the front page's stories-read failure, the pinned bar in the failed state if it has one, the sheet host's failed load). Fix any that drops focus to `<body>`, by the same rule.
Rows: jsdom rows for retry-then-success and retry-then-failure, each asserting `document.activeElement` is not `<body>` both while the read is out and after it lands.
F-2 — The publish step refuses a padded id
Where: `api/_utils/explore/storyCheck.js`.
Today: a question id such as `" x "` passes the check, but the page reads it trimmed (`exploreView.js`, `questionsOf`). The stored record and the id the page hands the sheet (`item.questionId`) would not match.
Ruling:

* An id that is not equal to its own trimmed form is refused, not noted and not repaired. Same standing as SQ-5.
* This covers a question's `id`, a connection's `id`, a source's `id`, and each reference to one: a question's `fromConnection`, a connection's `sourceIds` entries and `leadsToStory`, a cell's and an input's `sourceId`, and `parent.storyId` / `parent.connectionId`.
* Before editing, list which of these already refuse a padded value and which pass today. Change only the ones that pass.
* The message names the field and says the page reads ids trimmed, so a padded id would not be found.
* Both pilot fixtures (`api/_utils/explore/__fixtures__/pilot/`) must still pass `check` unchanged. If either fails, STOP and report: do not edit a pilot.

Rows: one refused case per field changed, and one row proving both pilots still pass.
F-3 — The jump row fits at 320 px with two-digit counts
Where: `src/components/Explore/ExploreJumpRow.jsx` (and `exploreStyle.js` if a class is needed).
Today: with ten or more in a section, the last label runs about 7 px past the row at 320 px.
Ruling:

* Below 360 px wide, the jump row shows the section names without their counts. From 360 px up it is unchanged.
* The labels still never shrink below their words (review P-1 stands), and the accessible name of each button matches what is drawn.
* The counts stay wherever else the page already shows them (each section's own heading).
* Both copies of the row (in flow and pinned) follow the same rule, by one media query, not by measuring.

Rows: a browser row at 320×700 on a story with 12 listed sources and 10 questions: every label inside the row, nothing past the row's right edge, no sideways scroll. Keep the existing 393 and 320 fit checks passing. Add the fixture story to the smoke scenes (smoke branch only) as `jump-row-long`.
Checks

* `npm run lint:gate`.
* Full suite in WSL (`~/pd-ci`, suite lock, `TZ=UTC`, `--maxWorkers=8`).
* `npm run test:rules` (expected unchanged).
* Minified build. Bundle diff: only the Explore chunks move; the entry keeps its exports; with `'off'` no Explore chunk can be requested.
* Browser rows against a local smoke page: rebuild the smoke commit on top of this branch in a scratch tree. Never push it to the PR branch. Update `claude/explore-build-2-smoke` only if the founder needs a new preview; say so in the report.
* Mutants, at least: (M1) F-1's focus call removed; (M2) F-1 focusing an element that leaves with the reload; (M3) F-2's refusal turned into a note; (M4) F-3's media query removed. Each KILLED, each file restored byte for byte.
* Review: mandatory only at 10 or more files or 1,500 or more lines (BUILD_RULES §2). Under that, say so and skip it.

Report
`docs/audits/<build date>_FIX_EXPLORE_2_FOLLOWUPS.md`, in plain terms:

1. Verdict table (dark, STOP conditions, suite, lint, rules, build, browser rows, mutants).
2. For F-1: every Try again in Explore, "fixed" or "already held".
3. For F-2: the before-and-after table of which fields refused a padded value.
4. For F-3: the measured right edge of the last label against the row's, at 320, before and after.
5. Baseline counts before and after, with a reason for every moved number.
6. Anything found and not fixed, with why.

End the session message with the PR number, the head hash, and one line: "Dark · draft · the founder merges."
