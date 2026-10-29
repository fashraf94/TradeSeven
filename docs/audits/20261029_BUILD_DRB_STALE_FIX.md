# Build — Daily Regime Brief stale fix

**Date:** Oct 29, 2026 · **Draft PR, not merged; the founder merges.**
**Branch:** `claude/drb-stale-fix`, pushed by refspec from the desktop app's worktree branch `claude/drb-stale-fix-a7ca91` (the app adds the suffix; same commits).
**Git state at start:** `git fetch origin` ran first. `origin/main` was `74d3078f`, and the worktree's branch was cut there with a clean tree. Local `main` was left alone because it is checked out in the main checkout; no fast-forward was needed for this worktree.
**Base:** `main` @ `74d3078f`. `main` has since moved to `fc0cb6f0` (PR #1007, agent form S0): no file overlap, merges clean, and the final checks ran on the merge (§5).
**Basis:** `docs/audits/20261028_PHASE0_DRB_DISCOVERY.md`, read from `claude/drb-phase0` @ `ef7e6943` with `git show`, not merged.

## 1. Plain-terms summary (for the founder)

1. **What was wrong.** In busy earnings weeks the AI was told to list every big company reporting. Its answer ran too long, was cut off, and the whole day's brief was thrown away, so the hub kept an old brief labelled "Last session's brief" for days.
2. **For the brief.** The AI now sees at most 8 earnings this week and 5 next week, plus a "(+37 more not listed)" count. It lists at most 10 events, each with one short sentence.
3. **If an answer is still cut off,** the brief is kept and the loss is recorded, unless the brief paragraph itself was cut. Every run now logs why the answer ended and how long it was.
4. **For the player.** The hub tells the brief's true age: "Last session's brief" only at exactly one session old; "Brief for Tue Oct 20 · 3 sessions old", folded behind More, from two to five; "No brief available" after five. "Generated" now names the day.
5. **The test calls.** Two real calls on a rebuilt Oct 28 (45 earnings, the Fed decision, GDP, PCE) both finished normally at about 1,300 of the 2,500-token limit; the failing runs are believed to have hit that limit (inferred in Phase 0, never logged). Each listed 10 events, all from the input, and returned the themes.
6. **One thing to decide.** The earnings feed sends no company sizes, so the 8 are picked by the order of the company list already in the code (big tech first). See FQ-1.

## 2. Verdict

| Item | Result |
|---|---|
| Fix A — cap what the model must write | Done. 8 + 5 earnings, "(+K more not listed)", "most important, up to 10", whyItMatters ~90 chars; `max_tokens` 2500 and the 45 s timeout unchanged |
| Fix B — visible failures, degrade instead of discard | Done. stop_reason, usage and the answer's shape logged on every answer; a lost `themes`/`keyEvents` is stored as `[]` and named in `sourceFailures`; no overwrite on failure |
| Fix C — hub true age, collapse when old | Done. Ages 0 / 1 / 2–5 / >5 as ruled; "Generated Fri 8:30 AM ET" |
| Stored document shape | Unchanged: the same 8 fields; new values only inside `sourceFailures` |
| Real model calls | 2 of 2 used: `stop_reason: tool_use` both times, output 1,302 and 1,335 tokens (§4) |
| Full suite (Linux, branch ∪ main) | `Test Files  1231 passed \| 8 skipped (1239)`, exit 0; lint:gate 0; vite build 0 (§5) |
| BUILD_RULES §2 review (15 files) | Done: 3 read-only lenses, a mutation lens (75 mutants), a refute pass, a second mutation pass (22 mutants), `vite build` (§7) |
| Fenced files | None touched; no fenced function called |
| Production | Nothing triggered: no cron or admin route hit, no `CRON_SECRET`, no Firestore or GCS write |

## 3. Files changed

| File | Why |
|---|---|
| `api/_utils/dailyRegimeBriefPrompt.js` | The fix. Limits at `:18-21`. The schema asks for the most important events up to 10 from listed lines only (`:42`), whyItMatters ~90 chars (`:66`). System prompt `:93`, `:102`. Ranking `:162` (`byImportance`). `selectEarnings` `:175` picks by importance and writes in date order. Count line `:184`. Honest headers `:274`, `:277`. `earningsListed` for the log `:282` |
| `api/_utils/dailyRegimeBriefPrompt.test.js` (new) | The prompt builder's first rows: the 50-event week, ranking, the macro section unchanged, the instructions, no size claim |
| `api/cron/compute-daily-regime-brief.js` | `callBriefModel` (`:79`, same parameters as before at `:83`; the call starts before the timer, and the timer is cleared at `:100`). `answerShapeOf` (`:122`). `readBriefAnswer` (`:143`; cut-brief rule at `:156`). The logs: "Calling Sonnet" `:281`, "Sonnet answered" `:291`, the degraded answer `:296`, failure `:354`. The write is unchanged (`:307`) |
| `api/cron/compute-daily-regime-brief.test.js` (new) | Handler-level rows with Firestore, the fetchers, the storage log and the SDK as doubles. Ruling rows (b) and (c). No overwrite on failure, the timeout, logging |
| `api/_utils/fetchEarningsCalendarEODHD.js` | Two additive item fields the ranking needs: `marketCap` (`:187`) and `priorityRank` (`:188`, from `PRIORITY_RANK` `:69`). The DRB cron is the only caller of `fetchEarningsCalendarEODHD()` (grep). `generate-recap.js:32` imports only `translateTiming`, which is unchanged. The "~8 readers" in the Phase 0 report call EODHD directly, not this module |
| `api/_utils/fetchEarningsCalendarEODHD.test.js` | Pins the two fields, including the real feed's shape (no `market_cap` key) |
| `src/components/CommandCenter/hub/activityDates.js` | `marketSessionsSince` (`:104`) and `formatHubWeekdayTime` (`:123`); ET date from `formatToParts` (`:91`). They live here, not in `hubDate.js`, because `hubDate.js` ships in the main bundle (this file's header; `hubDate.s4.test.js` guards it) |
| `src/components/CommandCenter/hub/useHubBrief.js` | Age → label, collapse or "No brief available" (`:36-37`, `:40`, `:59`). The clock is an argument; the hook passes `Date.now()` (`:74`). The hook's `isStale` is no longer read |
| `src/components/CommandCenter/hub/hubCopy.js` | `brief.aged` — "Brief for {date} · {n} sessions old" (`:502`) |
| `src/components/CommandCenter/sections/BriefSection.jsx` | Desktop body hidden until More when collapsed (`:55`). The caption wraps in its column (`:97`; measured, §6) |
| `src/components/CommandCenter/hub/hubModel.js` | Comment: the brief section's `collapsed?` |
| `src/components/CommandCenter/hub/useHubBrief.test.js` | Age rows (0, 1, 2, 3, 5, 6, weekend, ET midnight, DST, bad clock). The S4 row "the page's clock never reaches it" was rewritten as "the clock is an argument": the ruling makes the old row false |
| `src/components/CommandCenter/CommandCenterHub.s4.jsdom.test.jsx` | The four label states (ages 0, 1, 3, 6) at desktop and phone; the "Generated" day; the caption wrap pin |
| `src/components/CommandCenter/hubCopy.s4.guard.test.js` | The new phrase pinned literally and added to the banned-claims sample; a freshness scan (no "today / latest / current / new / live …") |
| `src/components/CommandCenter/hub/hubDate.s4.test.js` | The lazy-formatter count goes from 5 to 7 (two new formatters, each built on first use). The main-bundle name scan now covers the new helpers |
| `docs/audits/20261029_BUILD_DRB_STALE_FIX.md` | This report |

## 4. The verification calls

**Script.** A local script in the session scratchpad, not committed. It loaded `CLAUDE_API_KEY` from `.env.local` with `node --env-file`; only names were checked. It built the prompt with the real `buildDailyRegimeBriefPrompt` and ran the real exported `callBriefModel` (the handler's own call path: model, `max_tokens` 2500, effort low, thinking off, forced tool, 45 s race), then the real `readBriefAnswer`. Nothing touched Firestore or GCS, and the results were printed only.

**Fixture: the failed Wed Oct 28.**
- Macro: the real `getMacroEventsInWindow` for Oct 28 → Nov 8. This week: FOMC (Oct 28), PCE and GDP (Oct 29), jobless claims. Next week: 5.
- Earnings: 45 rows this week and 17 next week.
  - All are priority-list names with no market cap and `name` = symbol. That is the shape the real feed produces, because EODHD sends no `market_cap` and no `name` (`api/_utils/__fixtures__/earningsCalendarCapture.js:2-9`).
  - A non-list name (MA) was dropped, as the fetcher would drop it.

| | Call 1 (build commit `b6da73b3`) | Call 2 (after the review round, `76138355`) |
|---|---|---|
| `stop_reason` | `tool_use` | `tool_use` |
| `usage.input_tokens` | 2,678 | 2,686 |
| `usage.output_tokens` | **1,302** of 2,500 | **1,335** of 2,500 |
| Wall time | 24.6 s | 23.8 s |
| keyEvents returned | 10 | 10 |
| `themes` arrived | yes (5) | yes (5) |
| `readBriefAnswer` failures | none | none |
| Every event maps to a listed input line | yes | yes |
| Unlisted ("+37 more") names in events or brief | none | none |
| whyItMatters length | 71–89 chars | 76–92 chars |

**Notes on the calls.**
- `stop_reason` is `tool_use`, not `end_turn`. That is the normal end of a forced tool call, and it is not `max_tokens`.
- For comparison, Phase 0's largest *successful* run used 2,344 tokens for 21 events (Oct 21). Phase 0 inferred, but could not read, that the failing runs were cut at the 2,500 cap: the handler did not log `stop_reason` (Phase 0 §3 Q2). This build now logs it.
- With at most 10 events, the old fit (output ≈ 338 + 101 × events) gives a ceiling of about 1,350 tokens.
- The second call was used to verify the prompt as changed by the review. One wording change came after it: the earnings headers went from "priority names first" to "in date order" (refute pass N-1). It is a header-only change with no effect on what is listed.

## 5. Tests

| Run | Tree | `Test Files` line (read directly) | Exit |
|---|---|---|---|
| First full suite | `b6da73b3` (build commit) | `Test Files  1221 passed \| 8 skipped (1229)` — Tests 26953 passed \| 89 skipped | 0 |
| **Final full suite** | `0c5bad7d` merged with `main` @ `fc0cb6f0` (throwaway merge `df5c20c0`, not pushed) | **`Test Files  1231 passed \| 8 skipped (1239)`** — Tests 27119 passed \| 89 skipped (27208) | **0** |

**How the suites ran.**
- WSL Ubuntu, in a private worktree of `~/pd-ci`. Node 20.20.2 and npm 10.8.2 match CI; `npm ci` ran because the lockfile differs from the clone's.
- `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`.

**Lint and build.**
- `npm run lint:gate` exit 0 and `vite build` exit 0 at `b6da73b3`.
- Final tree (the same merge): `lint:gate` exit 0, `vite build` exit 0 (built in 14.3 s).
- The commit after `0c5bad7d` adds only this report. The pushed head is built again after push.

## 6. Smoke: the four label states

**How it was rendered.**
- A temporary jsdom file in a scratch snapshot mounted the real connected hub with the brief document mocked, at phone (390) and desktop (1216) widths.
- It wrote each brief section with the theme tokens to static HTML, which was opened in the desktop app's browser at phone width.

**What it showed.**

| Age | Phone caption (as rendered) | Body |
|---|---|---|
| 0 (Fri Oct 23 on Fri) | Brief for Fri Oct 23 · Generated Fri 8:30 AM ET | behind the row toggle, as before |
| 1 (Thu Oct 22) | Last session's brief · for Thu Oct 22 · Generated Thu 8:30 AM ET | behind the row toggle |
| 3 (Tue Oct 20) | Brief for Tue Oct 20 · 3 sessions old · Generated Tue 8:30 AM ET | behind the row toggle; on desktop no body until More |
| 6 (Thu Oct 15) | No brief available | none |

**Finding S-1.** The same as review L2-1 and L4-2, found independently. The aged caption measured **369 px** in a no-wrap slot: 9 px past the 360 px desktop side column and 69 px past the 300 px tablet one. The old stale caption already ran 46 px past tablet. The caption now wraps: 0 px overflow at both widths, two lines (`1a382b72`).

## 7. Review record (BUILD_RULES §2: 15 files, threshold met)

**Setup.**
- Every reviewer worked on its own `git archive` snapshot with `node_modules` junctioned, and was read-only on git and the worktree.
- The mutating lenses ran on their own trees, after the Linux suite.
- The scratch scripts and snapshots are in the session scratchpad and are not committed.

**Lenses.**
- **L1, producer + prompt:** 8 findings.
- **L2, hub age, labels and copy:** 7 findings.
- **L4, scope, wiring and guards:** 6 findings.
- **L3, mutation:** 75 mutants at `1a382b72`.
- **Refute pass:** every lens finding was put to a reviewer told to refute it, then the fixes were checked at `76138355`.
- **Second mutation pass (builder):** 17 mutants on the review-round behaviors, plus 5 re-plants of the L3 survivors, at the final code.

| Id | Finding | Refuter | Disposition |
|---|---|---|---|
| L1-1 / L4-1 | Prompt said "largest reporters / largest first", but the feed has no sizes | CONFIRMED | Fixed: no size claim. Headers say "in date order" (refute N-1 caught the interim "priority names first") |
| L1-2 | On `max_tokens`, a value cut mid-write (brief, last theme, last event) was stored | CONFIRMED | Fixed. The last field written is read as cut: a cut brief fails the run (FQ-2); a cut list loses its last element; tagged `*-incomplete` |
| L1-3 / L4-3a | The required-field check dropped events from complete answers that readers handle | CONFIRMED | Fixed: the check applies to cut answers only |
| L1-4 / L4-1 | Importance-ordered earnings could make the stored keyEvents non-chronological | CONFIRMED | Fixed: picked by importance, written by date |
| L1-5 | Timer started before `create()`: a synchronous throw leaves an unhandled rejection | REFUTED (unreachable in SDK 0.71.2; mechanism real with a stub) | Fixed anyway; a row pins it |
| L1-6 | The limit of 10 exists only in the prompt | CONFIRMED (note) | Not changed; readers cap their own lists |
| L1-7 | Count line looked like a bullet; `selectEarnings(x, undefined)` gave `more: NaN` | Bullet CONFIRMED; NaN REFUTED (limits are constants) | Fixed both |
| L1-8 | Usage not logged on a timeout | REFUTED (no response exists) | — |
| L2-1 / L4-2 / S-1 | Caption overflow | CONFIRMED (measured) | Fixed; style pinned |
| L2-2 | Weekend after a failed Friday: Thursday's brief reads "Last session's" | CONFIRMED (follows the ruling's letter) | FQ-3 |
| L2-3 | Unreadable `forDate` + "Generated {weekday}" reads current | REFUTED (the cron always writes a date) | — |
| L2-4 / L4-6 | "Today" relied on `en-CA` printing YYYY-MM-DD | CONFIRMED (fragility) | Fixed: `formatToParts` |
| L2-5 | The cron's UTC `today` can write a weekend date on a late manual run | CONFIRMED | Out of scope (§10) |
| L2-6 | A tab open > 5 sessions hides the brief while a fresh one exists | CONFIRMED (low reach) | Note (§10) |
| L2-7 | A clock of 1e300 threw | REFUTED (unreachable) | Fixed anyway (reads as no clock) |
| L4-3b | `keyEvents` not an array → `[]` | REFUTED as a defect (letter of "only a missing or empty brief fails") | FQ-4 |
| L4-4 | Shadow log's `sourceFailures` now carries output tags; list order now ranks with a thin guard | CONFIRMED (note) | The fetcher test pins three positions |
| L4-5 | Stale docs | CONFIRMED (note) | Out of scope (§10) |
| N-1 | Interim header "priority names first" over a date-ordered list | — | Fixed |
| N-2 | Cut brief fails the run: beyond "only missing or empty" | — | Kept, and the comments now state it; FQ-2 |
| N-3 | A cut into an empty list went untagged | — | Fixed |
| N-4 | Draft report said "biggest first" | — | This report |

**Tally.**
- 21 lens findings: 15 CONFIRMED, 4 REFUTED, 2 split.
- 3 refute-pass findings fixed or answered (N-1, N-2, N-3); N-4 is answered by this report.
- No blockers.

**Mutation.**
- **L3:** 75 mutants, 6 survivors.
  - **#19** (material): the timeout row passed for any timeout ≤ 45 s.
  - **#16:** the "Sonnet answered" line on a failed read.
  - **C1:** the timer not cleared.
  - **3a:** `more` could go negative.
  - **C7:** equivalent.
  - **43:** a formatter built at module load evades a text-only guard; left as a note.
  - Rows now kill #19 (at 44 s and 30 s), #16, C1 and 3a; re-planted at the final code, 5/5 KILLED.
- **Second pass:** 17 mutants on the review round's behaviors, 16 KILLED. M16 (caption back to no-wrap) survived, because jsdom has no layout; a style-pin row was added, and the re-plant was KILLED.
- Every mutated file was restored byte-identical.

**Build.** `vite build` exit 0, at `b6da73b3` and on the final tree (§5).

## 8. Builder's readings (stated, so each is a decision)

1. **Ranking without sizes.**
   - The ruling says "ordered by market cap with the priority list first".
   - Market cap stays the first key after priority, for when the feed carries one. Ties fall to the priority list's own order, then date, then symbol.
   - Today every row ties on cap, so the list's order decides (FQ-1).
   - The eight chosen rows are written in date order.
2. **Age.**
   - Age is the number of ET weekdays after `forDate`, up to and including today in ET. Holidays count, as ruled.
   - Friday's brief is age 0 on Saturday and Sunday and age 1 on Monday.
   - A `forDate` ahead of the clock is age 0. An unreadable date or clock means no age, and the brief reads as before.
3. **"Generated" carries the day at every age, age 0 included.** This follows item 3's text, while item 2's "age 0 → unchanged" applies to the label. The other option is a bare time on the brief's own ET day, using the existing `formatHubTimeOnDay`; that would be a one-line change.
4. **Phone.** The phone row already hides every body behind its toggle, so "collapsed" changes desktop only.
5. **Cut answers.**
   - Where the cut fell is read from the answer's key order.
   - The API's actual shape for a cut tool input was never observed (Phase 0 §7). Reading the last key fails safe either way: if the API sends `{}`, the run fails as before.
6. **`sourceFailures` names.** They use the existing kebab case:
   - `output-max-tokens`
   - `themes-truncated`
   - `themes-incomplete`
   - `key-events-truncated`
   - `key-events-incomplete`

## 9. Founder questions

**FQ-1. How should the 8 earnings be picked while the feed sends no company sizes?**
- **Today:** by the order of the company list in the code (big tech first, then sector by sector).
- **On Oct 28 that gives:** MSFT, GOOGL, GOOG, META, ADBE, AAPL, AMZN, INTC. LLY, XOM and CAT fall into "+37 more".
- **Also:** GOOG and GOOGL take two slots.
- **Recommendation:** accept for now. If size order matters, task a market-cap source separately, for example the app's own stock data. That would also make the ">$25B" filter real (§10.1).

**FQ-2. Should a brief that was itself cut off be kept?**
- **Two sentences of the ruling point different ways:** "an intact brief … accept it" against "only a missing or empty brief still fails".
- **Built:** a brief cut at the output cap is not intact, so the run fails and the previous brief stays, shown with its true age.
- **In practice:** almost unreachable, because the brief is the first ~300 tokens of a 2,500 cap.
- **Alternative:** store the fragment. That means deleting the throw at `compute-daily-regime-brief.js:156`; the row "cut off inside the brief itself" pins the current choice.
- **Recommendation:** keep. Chat personas inject the brief verbatim, and a sentence fragment is worse than yesterday's brief labelled with its age.

**FQ-3. What should the weekend label say after a failed Friday?**
- **Today:** Thursday's brief reads "Last session's brief · for Thu Oct 22" all weekend, although Friday was the last session. Friday's own brief reads "Brief for Fri Oct 23" on the weekend (age 0).
- **Recommendation:** on a non-session day, use the "sessions old" form at age 1 too ("Brief for Thu Oct 22 · 1 session old"), which needs a singular. This is a small follow-up if wanted.

**FQ-4. What should happen when a complete answer has no `keyEvents` list?**
- **Built:** the brief is stored with `keyEvents: []` and `key-events-truncated`, by "only a missing or empty brief still fails".
- **Recommendation:** keep. No reader needs events in order to show the brief.

## 10. Out of scope, noticed (not fixed)

1. **EODHD's earnings calendar sends no `market_cap` and no `name`** (capture fixture, 3,531 rows).
   - The fetcher's ">$25B" filter is therefore "priority list only": non-list mega-caps (V, MA, …) never reach the brief.
   - Every row renders as "MSFT (MSFT)".
   - The header's "mega-cap only" (pre-existing) is false for small list names such as KBH and JBLU.
2. **The cron's `today` is the UTC date** (`compute-daily-regime-brief.js:194`; known). A manual run after 8 PM ET writes tomorrow's date, possibly a Saturday, which the hub then shows as such.
3. **The macro calendar holds 2026 dates only** (known; FQ-5 of Phase 0).
4. **Stale docs:**
   - `DAILY_REGIME_BRIEF_TECHNICAL_REFERENCE.md` (still "~140 characters", "3-6 events", and no "kept with losses" failure row);
   - spec V1.2 §8.3 (the old "Last session's" meaning);
   - `__fixtures__/hubLayoutFixtures.js:61` (the old short caption, used by the layout suites).
5. **A hub tab left open for more than 5 sessions shows "No brief available" while a fresh brief exists.** The hook reads once per mount; before this build the tab showed the old body forever.
6. **Usage is not logged when the 45 s timeout wins**, because there is no response to read it from.
7. **The "no formatter at module load" guard checks text only** (mutant 43).
8. **Under load, one row timed out.** `CommandCenterHub.testIntegrity.jsdom` "every SVG paint…" hit its 5 s row timeout when run beside a mutation lens. It passes alone and in the Linux suite.

## 11. Not verified

- How the API delivers a cut-off tool input (see §8.5).
- The first production run. Crons do not run on Vercel preview; the first weekday run after merge and deploy will show the new "Sonnet answered" line in the Vercel log.
- The first call verified the prompt at `b6da73b3` and the second at `76138355`. The final header words differ from the second call's (§4).
