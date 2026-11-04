# Cockpit calls block — "a command that no longer stands" (Amendment G)

**Date:** 2026-11-04 · **Task:** the chat calls block says when a command no longer stands (G-1) and a named answer's row always carries its name (G-2) — the Build 2b report's CB2-1 and CB2-2 (`docs/audits/20261021_BUILD2B_COCKPIT.md`, §11 Q4/Q5).
**Contract:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_G.md` — **blessed 2026-11-04** (framework chat, revision 2), with one condition, met as built (§9). Revision 1 was committed byte for byte (blob `1344ac6c`, equal to the founder's file); **revision 2** (the founder's, 2026-11-04, folding in this build and the rulings in §5) was committed over it as a new commit, byte for byte (blob `55411a99`, equal to the founder's file). The blessing commit then edited only the amendment's status line and appended its Blessing record.
**Status:** built, tested, mutation-checked, run on Linux; the founder ruled on the seven readings (§5) on 2026-11-04, the amendment is blessed, and no code changed. **Merge after 6 PM ET** (the PR's first line, replacing the earlier hold, "Blessed 2026-11-04 (framework chat) — merge after 6 PM ET."). Not merged.

---

## 0. Preamble

| | |
|---|---|
| Fetch | `git fetch origin` first; `origin/main` = `9d97b396` at the start and on every re-fetch since, including just before the push (no movement, so the branch **is** the merged tree) |
| Local branch | `claude/cockpit-calls-block-standing-4640cc` (the app suffixes a worktree's branch; cut at `origin/main`) |
| Remote branch | pushed by refspec `HEAD:refs/heads/claude/cockpit-calls-block-standing` |
| Code head under test | `daad84e7` (only docs-only commits sit on top: this report, then amendment rev 2 and the rulings; lint and build were re-run on the pushed head, §6) |
| Production reads | none; no `firebase deploy` |
| Files changed | 4: the amendment, `callsBlock.js`, the new `amendmentG.test.js`, this report. **Under** the BUILD_RULES §2 review threshold (10 files or 1,500 lines), so no multi-lens review was run — see §7 |

## 1. Executive verdict

| Question | Answer |
|---|---|
| Does a replaced or retired command now read differently from a standing one? | **Yes.** `… · answered: Bring in DLTR · heard at the 13:00 check · replaced by a later request at 13:46` (the FT_QA row, pinned byte for byte). |
| Does a row with no event change? | **No.** Every existing calls-block, entry-already-held, build2b-answers and copy test passes untouched (80 rows), and a new row strips the three templates from a block with events and gets the plain block back. |
| New model-visible text | **Exactly the three templates.** Heading, 1,200-character cap and whole-row truncation are unchanged and pinned. |
| Can a named answer still render with no name? | **Not through the race.** A named answer whose directive record is not in the battle in hand triggers **one** re-read of the battle document; if that fails the block is null. |
| Fence | No fenced file edited, none called. `api/agent/chat.js` is **untouched** (a test pins its one call). |
| Failure behaviour | A failed or timed-out event read, a failed re-read, or a vanished battle document → the whole block is null (the chat turn continues), as every calls-block read failure is today. |
| Tests | 41 new rows; mutation check **34 / 34 killed** (23 on G-1, 11 on G-2). |
| Linux full suite / lint:gate / vite build | **Green.** Suite exit 0: 28,276 rows passed, 0 failed (1,269 files; 89 skipped rows in 8 skip-gated files, none mine). `lint:gate` exit 0. `vite build` exit 0. |
| Founder rulings | **All seven readings ruled 2026-11-04** (§5): keep as built; reading 1 is a field-path correction to the amendment (now in rev 2). Nothing open. |

## 2. What was built — `api/_utils/callRecords/callsBlock.js` (all VERIFIED at the code head)

**G-1 — a segment after the §2 fact**
- `endedSegmentOf` ([callsBlock.js:120](../../api/_utils/callRecords/callsBlock.js)) — pure; the three templates; both events present → the earlier by `at` (a tie goes to `superseded`). `{HH:MM}` is `fmtTimeEt(at)` from `copy.js`, the same 24-hour ET clock `checkLabel` uses. The reason text comes from `RETIRED_REASON_TEXT`, guarded by `RETIRED_REASONS`, so the wording has one source (BUILD_RULES §9).
- `renderCallsRow` ([:132](../../api/_utils/callRecords/callsBlock.js)) appends the segment **after** the §2 fact ([:145](../../api/_utils/callRecords/callsBlock.js)); with no `events` the row is as it was.
- `readEndingEvents` ([:201](../../api/_utils/callRecords/callsBlock.js)) — ids from `events.js` `eventIdOf` (`${thread}:superseded`, `${thread}:retired`), **one** `db.getAll(...)` with `withTimeout` against the block's deadline, a short read throws.
- Which calls: every call the block read whose `playerResponse.kind === 'directive'` ([`directiveThreadOf`, :74](../../api/_utils/callRecords/callsBlock.js)), keyed by `playerResponse.directiveThreadId` (the same id `selectedPickOf` uses), de-duplicated by thread. No such call → no read at all.

**G-2 — the read race**
- `needsBattleReread` ([:219](../../api/_utils/callRecords/callsBlock.js)) — true only for a **named answer** (`NAMED_ANSWERS`: pick, replace, go_now) whose thread has **no directive record** (`directiveRecordOf(...) === null`). A record that is there but has no chosen name (a plain go_now) is not the race and costs no read.
- `rereadBattle` ([:227](../../api/_utils/callRecords/callsBlock.js)) — one `agentBattles/{id}` get inside the deadline; unreadable or missing → throws → null.
- The block renders from the fresh document (`doc = fresh ?? battle`, [:249](../../api/_utils/callRecords/callsBlock.js)), so the name **and** the check times come from the same document.

**One deadline.** `buildCallsBlockForChat` ([:238](../../api/_utils/callRecords/callsBlock.js)) computes the deadline once and threads it down: `readCallsForBlock` gained an optional `deadlineMs` (default is the old behaviour, so its other caller, the rules-index test, is unaffected), and the events batch and the conditional re-read start together once the calls are in hand. The builder also takes an optional `timeoutMs` (default `CALLS_BLOCK_TIMEOUT_MS`, which `chat.js` never passes) so the timeout rows do not wait 1.5 real seconds.

**Fence functions called:** none. **Fence functions edited:** none. `callsBlock.js` is not fenced; it is already in `PROMPT_CONTRIBUTING_MODULES` (`promptHonestyRegistry.js:57`), so the prose sweep covers the new strings. `api/agent/chat.js:612` is unchanged.

## 3. Tests — `api/_utils/callRecords/amendmentG.test.js` (41 rows)

The event fixtures are built by the real `buildCallEvent`, so a reader that looks in the wrong place for a stored field cannot pass on a hand-rolled shape.

| Group | What it pins |
|---|---|
| Frozen literals | the FT_QA row; the three templates; EDT **and** EST (13:46 from both 17:46Z and 18:46Z — not UTC, not a fixed offset); 00:05 not 24:05; all three "left the book" reasons and `pick_already_held` |
| Both events / unfillable | the earlier shows (both orders); tie → superseded; no usable `at`, an unknown reason, a prototype key (`toString`), no symbol, no check label → no segment and the other event still shows |
| Byte identity | no `events`, an empty map, empty slots, another thread's event → the pre-amendment literal for held / acted / ack / unanswered rows; an ack that carries a thread id is neither read nor rendered; end to end with no event documents the block equals the old block; strip-the-templates equals the plain block |
| The read | one `getAll`, four refs for two threads (de-duplicated, open **and** history, keyed by `playerResponse`'s thread, not the call's own copy); no directive call → no `getAll` at all |
| Failure / timeout | a rejected `getAll` → null (logged); a hanging one → null at 1,499 → 1,501 ms; the builder's own `timeoutMs: 100` → null at 99 → 101 ms; **1,000 ms spent in the queries leaves 500 ms for the events, not a fresh 1,500** |
| G-2 race | replace / named go_now / pick: stale battle + successful re-read gives the name, and the **fresh** document's checks; the bare "answered: Bring in" is shown to be what a skipped re-read would render; one re-read for three missing records, issued **after** the last calls read; **no** re-read when the record is there (including a plain go_now and a record in the parent's slot), for non-named answers, acks and unanswered calls; a failed re-read, a vanished battle, a hanging re-read (same deadline) → null; a re-read that **succeeds** and still has no record renders the bare word, once (§5 reading 6) |
| Off / shadow | `off`, `shadow`, `null`, `undefined`: the access log is empty and `getAll` is never called |
| Stays as it is | heading, 1,200 cap, 1,500 ms pinned; a longer row pushes an older row into "… n more" (fewer rows shown than without segments — non-vacuous), rows stay whole; `chat.js` still makes its one call |

`callsBlock.test.js`, `entryAlreadyHeld.test.js`, `build2b.answers.test.js` and the voice goldens were **not edited**.

## 4. Mutation check (BUILD_RULES §2 "a row that cannot fail under the defect it names is not a guard")

Runner: each mutant is applied to the **committed LF blob**, tested over the four calls-block files (92 rows), then restored from the blob (`mutate.mjs`; the working file's hash equals `HEAD:` after the run). Baseline green at 92; every mutant ran at 92 rows (no mutant broke a file load).

| Rule | Mutants | Killed |
|---|---|---|
| G-1 order and choice | segment before the fact · the later event wins · a tie goes to retired | 3 / 3 |
| G-1 what is read | retired id read as the superseded id · no `kind === 'directive'` check · thread from the top-level copy · history rows not read · lookup by call id · `buildCallsBlock` drops `events` · threads not de-duplicated · short `getAll` accepted | 8 / 8 |
| G-1 wording | UTC clock · `pick_already_held` reads "left the book" · `{SYM}` from `extra` · `{check}` from the top level | 4 / 4 |
| G-1 guards | no `RETIRED_REASONS` guard · no symbol guard · no label guard · a string `at` accepted | 4 / 4 |
| G-1 failure / gate | failed events read swallowed · events read gets a fresh 1,500 ms · the `'on'` gate removed · the builder ignores its own `timeoutMs` | 4 / 4 |
| G-2 trigger | every directive row re-reads · never re-reads · trigger is a missing name · go_now not named · any answer re-reads | 5 / 5 |
| G-2 render / failure | stale document rendered · stale checks · failed re-read swallowed · missing document accepted · battle read twice · re-read gets a fresh 1,500 ms | 6 / 6 |

One equivalent mutant was identified and not counted: dropping `{ deadlineMs }` from the `readCallsForBlock` call in the builder gives the same deadline (the default is computed from the same clock reading in the same tick).

## 5. Readings for the founder — RULED 2026-11-04

**Founder ruling, 2026-11-04: keep all seven readings as built.** Reading 1 is a field-path correction to the amendment; readings 2–7 are recorded as built. The amendment was re-issued as **revision 2** and committed byte for byte over `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_G.md` (blob `55411a99`). Revision 2 changes no rule and adds no string, and I checked each point it states against the built code (11 calls / 22 refs; the tie; the no-segment cases; the two null cases and the bare-word case in G-2), so **no code or test changed** after the rulings. The only commits since the Linux record are docs (the amendment and this report), and no test reads either file (a grep of test sources finds only comment citations), so the §6 suite result stands.

| # | Reading | Ruling | Where it now stands in rev 2 |
|---|---|---|---|
| 1 | `{SYM}` is the stored retired event's top-level `symbol`, not `extra.symbol` | **Field-path correction to the amendment** | G-1 placeholders: "`{SYM}` … sits at the event's top level, because `buildCallEvent` spreads its `extra` argument there" |
| 2 | An event that cannot fill its template gives no segment | Recorded as built | G-1 notes: "gives **no segment** … No fourth string is ever invented" |
| 3 | Which calls are read: every directive-answered call the block read | Recorded as built | G-1 notes: "at most 11 calls and 22 event references in one batch … including calls whose rows the cut later drops" |
| 4 | The re-read trigger is a missing directive record; a plain `go_now` whose record is also missing costs one bounded read | Recorded as built | Rev 2 keeps G-2's existing wording ("only when a named answer's record is not found") and does not restate the plain-`go_now` cost; it is recorded here only |
| 5 | A re-read that finds no battle document → null | Recorded as built | G-2: "If the re-read fails, **or finds no battle document**, the block degrades to null" |
| 6 | A re-read that succeeds and still has no record renders the bare word | Recorded as built | G-2, new bullet: renders the answer word without a name, "incomplete but not false" |
| 7 | A tie between the two events goes to `superseded` | Recorded as built | G-1 notes: "A tie goes to `superseded`" |

The readings as raised, for the record:

1. **Stored field names.** The brief says `{SYM}` is the retired event's `extra.symbol`. `extra` is `buildCallEvent`'s *argument*; it spreads to the **top level** of the stored document (`events.js:86`, and `retire.test.js:75` asserts `symbol`/`reason` there). The block reads `symbol` and `reason` from the top level and `{check}` from `evidence.checkLabel`. The amendment text is right about the fields' meaning; only the path differs.
2. **An event that cannot fill its template** (no usable `at`; an unknown reason; no symbol or check label) yields **no segment** — the row stays as today. The amendment is silent; inventing a fourth string would break "the three templates are the only new text". The writers fill them on their normal path (`directiveWriter.js:96-103` from the filing's own timestamp; `retire.js:181-191` from the retiring check), so an event missing one is a malformed document and this is a belt-and-braces case.
3. **Which calls are read.** Every directive-answered call the block *read* (at most 6 open + 5 history = 22 refs in one batch), not only the rows that survive the 1,200-character cut — the cut is only known after rendering, and a longer row can change it.
4. **The re-read trigger is record absence.** A plain `go_now` whose record is *also* missing (it cannot be told from a named one without the record) triggers the one bounded re-read too; nothing else does. A grep of `api/` found no write-side trimming of `chatExchanges` (only the voice grounding's read-time `slice(-window)`), so a permanently absent record is not expected; if one existed, the cost would be one battle read per chat turn.
5. **A re-read that finds no battle document → null**, not a render from the stale one — rendering would be the very bare "answered: Bring in" this clause removes.
6. **A re-read that succeeds and still has no record renders the bare word** ("answered: Bring in"), as today. The amendment's rule names only the *failed* re-read as the null case, so this is the letter; degrading to null instead would honour "never without its name" at the cost of hiding the row. Built the conservative way, no new string; flipping it is a founder call. A row pins it (one read, not two).
7. **A tie between the two events goes to `superseded`.** "The earlier one by `at`" is silent on equal instants (impossible in practice: they are written by different code paths at different moments). A row and a mutant pin the choice.

Also stated, not asked: the segment shows whatever the call's `state` is (an already-resolved call still shows its resolved state first; the amendment lists that as out of scope), and the heading is not updated to mention the new segments — the amendment's "What stays" says it is unchanged.

## 6. Verification

**Tree under test.** `origin/main` was `9d97b396` at the start and was re-fetched twice (after the suite, and before the push): it never moved, and it is this branch's merge base, so the branch tree **is** the merged tree (nothing to merge in; no census or guard test from main to catch up on).

**Linux, CI-shaped** (WSL Ubuntu, a private git worktree of the shared `pd-ci` clone at the code head, `node_modules` linked to the install whose lockfile hash `40382e64edb6` equals main's; Node 20.20.2 / npm 10.8.2, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`, one suite at a time; exit codes written to files and asserted):

| Step | Head | Result |
|---|---|---|
| Full suite, first run | `0ad0f77f` (before the last two test rows) | exit 0 · 28,274 passed · 0 failed · 89 skipped · 301 s |
| Full suite, **record** | `daad84e7` (the final code head) | exit 0 · **28,276 passed · 0 failed · 89 skipped** · 1,269 files passed + 8 skipped · 280 s · the 41 `amendmentG` rows all in the run |
| `npm run lint:gate` | `daad84e7` | exit 0 (`--max-warnings 0`) |
| `vite build` | `daad84e7` | exit 0 (only the usual chunk-size advisory) |

The shared-checkout rule held: `pd-ci`'s own HEAD was never moved, and `~/pd-af0` (another session's run was using it) was only read for its `node_modules`.

**Windows, targeted:** `callsBlock`, `entryAlreadyHeld`, `build2b.answers` and `copy` tests unchanged and green (80 rows) before the new file existed; the 92-row mutation baseline (§4) is those four plus `amendmentG`.

**The pushed head** sits on `daad84e7` through docs-only commits (this report; later, amendment rev 2 and the §5 rulings). No test reads `docs/` (the directory walkers all scan `api/` or `src/`, and a grep of test sources finds only comment citations of the contract files), so they cannot move a suite result. `lint:gate` and `vite build` were nevertheless re-run on the exact commit that was pushed when the PR was opened, `89e91f56` — exit 0 and exit 0, recorded in the PR description (a report cannot hold the result of building itself).

**Not run:** the emulator rules suite (§8).

## 7. BUILD_RULES §2 review threshold

3 code/doc files + this report = 4 files. About 820 added lines in all, of which 500 are the new test file and 80 the amendment; the code change itself is about 110 lines. Under 10 files and 1,500 lines, so the multi-lens adversarial review was **not** run; the mutation check (§4) and the byte-identity rows are this build's guards. If a reviewer wants one anyway, the diff is `origin/main...claude/cockpit-calls-block-standing`.

## 8. Not done / for separate tasking

- The emulator rules suite (`npm run test:rules`) was **not** run: no rules, indexes or fixtures changed, the four query shapes `readCallsForBlock` issues are unchanged (the rules-index row that drives it passes in the main suite), and the events are document gets, not queries — no new index.
- Other ways a command ends (a kill; a call that has already resolved) stay out of scope, as the amendment says.
- Cost, once live: one extra batched Firestore get per chat turn in a battle with a directive-answered call (the 1,500 ms block deadline is unchanged), plus one battle-document read only in the race.

## 9. Blessing (framework chat, 2026-11-04)

Amendment G **revision 2** was blessed on 2026-11-04 with one condition: the `retired` segments take their reason phrase from `RETIRED_REASON_TEXT` (`copy.js`), not from separate literals, with the frozen-literal test pinning the rendered result.

**Condition met as built; no code change.** `endedSegmentOf` builds the retired segment with `${RETIRED_REASON_TEXT[retired.reason]}` (`callsBlock.js:125`), importing the map and `RETIRED_REASONS` from `./copy.js` (`callsBlock.js:57`) and guarding on `RETIRED_REASONS.includes(...)` (`callsBlock.js:124`). The map is `copy.js:286-291`. `callsBlock.js` holds neither phrase as a string literal in code (only in comments, `:45` and `:112-113`). The rendered result is pinned by the frozen literals in `amendmentG.test.js` (`:111-118` for the three "left the book" reasons and `pick_already_held`; `:125` end to end), and the mutation check killed the mutant that swaps the lookup for a literal (G1-10, §4).

The condition and the blessing are recorded in the amendment's status line and a Blessing record at its end. The PR's first line now reads "Blessed 2026-11-04 (framework chat) — merge after 6 PM ET."; its description records the amendment as blessed and the seven readings as ruled.
