# Build report: the shared setup-evidence store (ID-1 Build 1)

**Date:** 30 October 2026. **Executor:** Claude Code (Opus 5.5, advisor Fable 5.1), own worktree. **Branch:** `claude/setup-evidence-store`, cut from `origin/main` at `0de404e1`, with `origin/main` at `337a5801` merged in for the final checks. **Contract:** `docs/design/20261030_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_4.md` §3. **Discovery:** `docs/audits/20261030_PHASE0_ID1_SHARED_EVIDENCE.md`.

## 1. In plain terms

Each trading day, the Trend Follower's setup rule can say what it thinks of a stock, and the price evidence it said it from. This build makes the shelf that keeps those answers: one permanent, dated record per stock, per completed trading day, per version of the rule. Once a record is on the shelf it never changes. **Nothing uses the shelf yet.** There is no cron, no screen, no flag and no caller, and nothing about trading or the game changes.

The one existing feature it touches is the idea review card. The card's request to the price provider moved into a shared module, so the shelf and the card ask the same way. The card behaves as it did.

| Question | Answer |
|---|---|
| Is it built? | Yes. `api/_utils/setupEvidence/` (six modules) and the shared request `api/_utils/eodhdDailyWindow.js`. |
| Does anything call it? | No. A test fails if anything outside this build names it. |
| Did it touch trading, scoring or the rule? | No. No fenced file, and nothing in `api/_utils/setupEvaluator/`. The golden guard passes with no new baseline entry. |
| Did the review card change? | Not in behaviour. One unpinned path changed its error text, which the card never showed (§6, decision 8). |
| Provider calls or production reads? | None. Every test injects its data. |
| Independent review | 4 lenses and 4 refuting verifiers: 33 findings, 22 confirmed, 8 partly, 3 refuted. No blocker. No wrong record on any payload shape in the fixtures; the one path found that could have stored one is closed (L2-1). |
| Mutation check | 456 planted defects; 49 survivors were real test gaps, and 48 of them now have a row. On the committed rows those 48 all fail as they should. The last is an accepted limit (§7). |
| Final runs | Linux suite on the merged tree: 28,072 passed, 0 failed, 89 skipped. Emulator suites: 526 passed. Lint gate, build and golden guard all clean (§11). |
| What you need to do | One thing after merging: **publish the Firestore rules** (§10). Nothing reads or writes the store before Build 2, so it can wait until then. |
| Open questions | Four, none blocking (§9). |

## 2. Preamble

- `git fetch origin main` ran first. Branch `claude/setup-evidence-store` was cut from `origin/main` at `0de404e1ca1209244f548a877117771cc2e650bc`. `main` then moved (#1015, `337a5801`): it shares no file with this branch and leaves the lockfile alone, and it was merged for the final checks.
- `docs/BUILD_RULES.md` was read in full.
- Anchors re-verified at the base, all without drift in behaviour: `dailyBarsAdapter.js` (`buildDailyEvidence`, `attachAdjustedClose`, `ADAPTER_REFUSALS`, `expectedCompletedSession`, the newest-row and strictly-decreasing checks); `tfSetupV1.js` (`evaluateTfEntry`); `thresholds.js` (`describeRuleSet`, `MIN_COMPLETED_BARS`, `SEMANTICS_ID`); `marketDataCache.js` (`mapDailyRows`, `isCryptoSymbol`); `marketSchedule.js` (`getSessionForDate`, re-exported from `src/utils/marketCalendar.js`); `hypothesisRecords/review.js` (`fetchWindowDaily`, the claim pattern); `.github/workflows/tests.yml` (the golden guard step); `vitest.rules.config.mjs`.
- **One line of the build prompt describes the adapter one step off.** It says bars sent oldest-first are "refused by the adapter's own ordering check". A fully reversed payload is refused one step earlier, by the newest-row check, as `missing_bar` with no `after`. Both are retryable, so nothing changes in behaviour. The row pins the real reason, and proves "never re-sorted" by the refusal itself: a re-sort would have succeeded.

## 3. What was built

| File | What it does |
|---|---|
| `api/_utils/setupEvidence/sessionAt.js` | `lastCompletedSessionAt(instantMs)`: the completed session at an instant, from the calendar's own tables. Outside 2026 to 2027 it says `calendar_missing`, never a guess. |
| `api/_utils/setupEvidence/key.js` | The document id, `${session}__${symbol}__${ruleKey}`, lossless over the whole rule-set triple, and its parser. |
| `api/_utils/setupEvidence/classify.js` | The contract's final-or-retryable table. |
| `api/_utils/setupEvidence/acquire.js` | One provider read, through the adapter and the evaluator, and the snapshot document. |
| `api/_utils/setupEvidence/store.js` | The protocol: lease, ownership token, confirmation record, create-once. |
| `api/_utils/setupEvidence/index.js` | `getOrAcquireSnapshot` and `readSnapshot`. |
| `api/_utils/eodhdDailyWindow.js` | `fetchDailyPayload`, the one raw `/eod/` request. |
| `api/_utils/hypothesisRecords/review.js` | `fetchWindowDaily` is now a thin caller: oldest first, no timeout, its own `[]` for a non-array body. |
| `firestore.rules` | `setupEvidence/{id}` and `setupEvidenceClaims/{id}`: `allow read, write: if false`. |
| `api/_utils/compositionProtectedStoresAllowlist.json` | Six write-site keys and a note. The scan reads every `tx.*` write as unresolved, so they must be listed. Neither collection is protected. |

The fenced functions called: none. The evaluator's `buildDailyEvidence`, `attachAdjustedClose`, `expectedCompletedSession`, `evaluateTfEntry` and `describeRuleSet` are called and not edited.

## 4. Tests and where they run

Pure rows run in the ordinary suite with no network and no emulator: `sessionAt`, `key`, `classify`, `acquire`, `store` (the contract's two numbers), the rules tripwire, the import guard, the native-ESM smoke row, and `eodhdDailyWindow`, which also holds the review card's compatibility rows. Everything that needs Firestore is in the emulator suite: `test/rules/setupEvidenceStore.rules.mjs` (the protocol, on the Admin SDK) and `test/rules/setupEvidenceDenials.rules.mjs` (client denial on both collections). `review.test.js` is unchanged and green.

CI does not run `test:rules`. So `index.js` and `store.js` were loaded by nothing CI runs, which is why the native-ESM smoke row exists (L4-1): a vitest import cannot stand in, because vite-node turns a missing named export into `undefined`.

## 5. Advisor

Consulted with the plan before the first edit, and before declaring done, as the prompt orders. Review subagents never consulted it. The first call of the plan consultation timed out with nothing returned; the retry answered, so there are two answered consultations and one empty call.

**Before the first edit.** The advisor said: "Plan is sound; nothing here is a STOP." What changed because of it:
- The bars class runs through `lastCompletedSessionAt`, instead of a new next-session walker: "`.session === session` → contemporaneous, else `later_reconstruction`, and `calendar_missing` on fetchedAt → `later_reconstruction`."
- `capturedAt` equals `fetchedAt`: "A write-time stamp is a looser reading → question, not build."
- `detailHash` is canonicalised, and a row pins that key order does not move it.
- The raw URL string is pinned for the card, in today's parameter order, and fetch gets exactly one argument when no timeout is given.
- `observedAt` is the first fetch's `fetchedAt`.
- A decision the plan had left open was made: a programming error after the lease was taken releases the lease under its token, then throws.
- The test notes: the 2026-01-02 row needs a specific time, the second 01:30 ET instant is built by hand, the concurrency row holds the fetch open, and the tripwire filter must not count `setupEvidenceClaims` as `setupEvidence`.

**Before declaring done.** The advisor said: "Everything the prompt ordered is built, reviewed, verified, mutation-checked and run green on the merged tree. Nothing blocks the push." What changed because of it: no code, and these words in this report. §1 now says what was shown about wrong records, in place of a claim that went further than L2-1 allows. §11 no longer predicts runs on its own commit. The docs commit was amended rather than stacked, so there is one. One point was not followed: it asked to delete the sentence above about the timed-out call, because it saw no failed call. The tool result of that call reads "The advisor timed out", so the sentence stays.

## 6. Decisions, stated as decisions

1. **The clock is a function**, `now: () => Date`. A plain Date is refused, because it could only ever stamp a time before the request. **Build 2 and every later caller must pass a function.**
2. **The 30 minutes run from the second request's start** to the first response. So the two provider samples really are at least that far apart. `fetchedAt` stays the response instant.
3. **The claim document stays after a snapshot is final**, with `lease: null`. Phase 0 said delete it. The contract counts attempts on the claim and apart from completed snapshots, so deleting it would lose them. Contract over Phase 0.
4. **A session a request may not name is answered before any read, claim or fetch.** An unmaintained year or a future date is `retryable`. A malformed date, a non-session or a session that has not closed throws. Reading "must be a maintained trading session" as a precondition, it follows the contract's table.
5. **Three lines go beyond the contract's table, each failing closed:** a refusal whose `expected` is not the session is a programming error, so `insufficient_history` on an unfinished session can never go final; `unsupported_symbol_class` reaching the table is a programming error, because crypto is refused before any call; an unknown refusal is a programming error, so a new adapter refusal must be classified before it can be stored.
6. **A fourth line came from the review:** a payload whose defect the mapper would hide, or one that cannot be read, is `malformed_payload`, retryable (L2-1, L2-3). When nothing was dropped, the adapter's own checks still decide, as the contract asks.
7. **No `schemaVersion`.** The contract's content list omits it, so the letter holds (§9, Q3).
8. **A body that will not parse now throws `EODHD daily request failed`,** not the parser's own message, so no snippet of a body can reach an error. This is the one path of the shared request where the text changed. The card only tests whether an error happened, so it still reads `fetch_failed`, and a row pins that.
9. **A timeout throws the same message as a network failure.** The prompt's "today's messages" names no timeout, and the store treats both alike.
10. **`writer.commit` is `process.env.VERCEL_GIT_COMMIT_SHA`, null where it is not exposed.** There was no repo precedent. It needs Vercel's system variables to be on, or it will read null.
11. **`mapDailyRows`' drop count goes to the log**, as `fetchDailyOHLCV`'s does. The contract has no field for it (§9, Q3).
12. **One instrument, one key.** The key takes the hyphen form positions hold (`BRK-B`), at most 12 characters. `BRK.B`, `NVDA.US` and `nvda` are refused, never repaired.
13. **An expired worker may still create the final document**, a confirmed one included: the contract's parenthetical says the `create` decides. It writes nothing on the claim. An expired worker's first `confirm` observation is dropped.
14. **"A different reason or detail replaces it" is read within the confirm class** (§9, Q2).

## 7. Independent review (BUILD_RULES §2)

Each reviewer worked on its own LF `git archive` tree and was read-only on git. Reviewed at `481ec1e2`; the mutation lens ran last at `9bdab89c`, then again on the committed rows at `9524c1a8`.

| Lens | Subject | Findings | Verifier's verdicts |
|---|---|---|---|
| L1 | Store semantics, the lease token, the confirmation record under races | 11 | 8 confirmed, 1 partly, 2 refuted |
| L2 | The wrapper, the classification table, bar order, stamps | 9 | 5 confirmed, 3 partly, 1 refuted |
| L3 | Provenance and the record contract | 9 | 6 confirmed, 3 partly |
| L4 | Scope, fence, rules, import guard, the card | 4 | 3 confirmed, 1 partly |
| **Total** | | **33** | **22 confirmed, 8 partly, 3 refuted** |

| Id | Severity after verification | Finding | Verdict | Disposition |
|---|---|---|---|---|
| L1-1 | MEDIUM | The "five at once" row raced its own answer: flaky, red in most runs. The code was right. | CONFIRMED | Row fixed: it waits for all four losers before answering. |
| L1-2 | MEDIUM | No row failed if a claim mutation stopped being a transaction. | CONFIRMED | Rows added: a spy on plain reads and writes, and interleavings where a successor arrives mid-transaction. |
| L1-3 | none | "A different reason or detail replaces it" not applied to a retryable refusal. | REFUTED | The build took the plain reading. Pin row added. §9, Q2. |
| L1-4 | MEDIUM to LOW | Correct branches with no failing row. | CONFIRMED | Rows added. |
| L1-5 | LOW | Five rows that could not fail as named. | PARTLY | Fixed row by row. |
| L1-6 | LOW | After a forced ALREADY_EXISTS the lease stayed set. | CONFIRMED | Fixed: the winner path releases the lease. |
| L1-7 | LOW | A lost acknowledgement on the claim made a worker wait for itself. | CONFIRMED | Fixed: one token per call. |
| L1-8 | LOW | The 30 minutes compare two hosts' clocks. | CONFIRMED | Accepted. A fast clock shortens the gap by the skew, and no real skew is known. |
| L1-9 | none | A far-future `observedAt` would block finalising. | REFUTED | No writer can make one. |
| L1-10 | LOW | 75 or more first touches of one key can surface `ABORTED`. | CONFIRMED | No data harm. Not realistic now; a note for Build 2 (§8). |
| L1-11 | LOW | A missing API key read as an ordinary failure with no log. | CONFIRMED | Fixed: the cause goes to the log. |
| L2-1 | LOW (was MEDIUM) | A dropped row could hide a duplicate or malformed date. Harmful only when an unreadable twin came first with a different adjusted close. | PARTLY | Fixed: `malformed_payload`, retryable. None of the 34,528 fixture rows has the shape, so it is unobserved, but the record is permanent. |
| L2-2 | LOW (was MEDIUM) | No row pinned the ET date. | CONFIRMED | Rows added near ET midnight, winter and summer. |
| L2-3 | LOW | An object-valued field made the acquisition throw. | CONFIRMED | Fixed: `malformed_payload`. |
| L2-4 | LOW | From 2028-01-01 until the next close, the bars class of session 2027-12-31 reads `later_reconstruction`. | CONFIRMED | Accepted, conservative. It vanishes when the 2028 calendar lands, which the calendar's own TODO requires by December 2027. |
| L2-5 | nit | A BC instant aliased into a maintained year. | CONFIRMED | Fixed: a negative instant is malformed. |
| L2-6 | LOW | A window reaching 2025 skips adjacency, for 54 sessions up to 2026-03-20. | PARTLY | The adapter's own limit, stated on the record as `adjacency: not_available`. Pinned by a row. |
| L2-7 | nit | Two row titles claimed more than they tested. | PARTLY | Fixed. |
| L2-8 | none | First-read finals could be transient provider states. | CONFIRMED that the code matches the letter | §9, Q1. |
| L2-9 | none | Same as L1-3. | REFUTED | Same. |
| L3-1 | LOW (was HIGH) | `BRK.B` and `BRK-B` made two immutable snapshots. No path was found for a dotted symbol to reach a Trend Follower position. | PARTLY | Fixed, one line, because the id is a one-way door. **The proposed canonicaliser was rejected:** it would have stopped excluding `BTC-USD.CC`. |
| L3-2 | MEDIUM | The `capturedAt` row used a clock that never moved. | CONFIRMED | Row fixed. |
| L3-3 | MEDIUM | Five document-level mutants survived. | CONFIRMED | Table row over every stored class, at both bars classes. |
| L3-4 | LOW | The storability walk covered an ok document only. | CONFIRMED | Same table row. |
| L3-5 | LOW | A slash in `setupVersion` or the semantics prefix was unpinned. | PARTLY | Rows added. |
| L3-6 | LOW | No length bound on the symbol. | CONFIRMED | Fixed: 12 characters. |
| L3-7 | LOW | The crypto test knows 7 of the 33 crypto assets. No path was found to a position. | CONFIRMED mechanism | Out of scope here. A note for Build 2 (§8). |
| L3-8 | LOW | Same as L2-4. | CONFIRMED | Same. |
| L3-9 | nit | `sourceMetaOf` has no effect on its one literal input. | PARTLY | No fix: the prompt orders the allowlist, and the rows prove it. |
| L4-1 | MEDIUM | `index.js` and `store.js` load in nothing CI runs. | PARTLY | Fixed by a real `node` child process. **The proposed vitest `import()` row was proven useless:** it stayed green on a broken export. |
| L4-2 | LOW | The import guard missed some forms and folders. | CONFIRMED | Fixed: one regex over every string, plus the root files and `__mocks__`. |
| L4-3 | LOW | Two guard rows could not fail. | CONFIRMED | Rows removed or replaced. |
| L4-4 | LOW | The allowlist note said one `create` was ungated. There are two. | CONFIRMED | Reworded. |

**Attacked and not broken, across the lenses:** two different finals; an update of a final; an expired worker changing a successor's lease or observation; a lease that never frees; a confirmation on one fetch, or under 30 minutes on one clock; every adapter refusal on the wrong line; a re-sort; a stamp taken before the request; the review card over 10,374 cells of symbols, windows and fetch outcomes (the only differences are the body-failure text above); the key reaching a message, log or `cause`; the timeout on a stalled body, with a real local server; any grant reaching either collection.

**Mutation lens.** Head `9bdab89c`: 456 planted, 383 killed, 73 survived, of which 24 are equivalent and 49 were real gaps. All 20 mutants that open a rule verb went red. 48 of the 49 gaps got a row at `9524c1a8`, including one shipped row that could not fail as named, because its failing database also failed the release a mistaken path would run. Rerun on the committed rows, with no throwaway files: 48 of 48 killed, each by one committed row. The one accepted survivor is T74, a 2-second wait per settle, which fits inside the 5-second "no call ever waits" row: a per-call bound would risk a flaky row, and a real 30-minute wait still fails. On the unmodified tree the pure rows passed 383 of 383 in 7 runs and the emulator rows 78 of 78 in 13 runs, 3 of them with all cores loaded. The lens does not cover the evaluator, the calendar or `mapDailyRows`, real Firestore, or Linux for the emulator rows.

## 8. Notes for Build 2's brief

- Pass `now` as a function (§6, 1).
- Filter crypto on the position's own `isCrypto` before calling. The store's symbol test knows the seven agent crypto assets, which is all a position can hold today (L3-7).
- Positions hold `BRK-B`, and that is the only form the store takes. A dotted or suffixed symbol throws a TypeError.
- A first-touch burst of 75 or more callers on one key can surface `10 ABORTED`, with no data harm. Map it to `retryable` if a fan-out ever gets there (L1-10).
- `getOrAcquireSnapshot` throws on a programming error and on a Firestore failure. The tenant must isolate per-symbol failures.
- A newest-session `missing_bar` is never finalised by the store. The log line `fetch failed` and `lastAttemptAt` on the claim are what the first week's cutoff reads.

## 9. Founder questions, none blocking

- **Q1 (contract).** These finalise on the first read, by the table's letter, though each could be a passing provider state: a newest bar with no adjusted close (ok, split check not available), a truncated array (`insufficient_history`), a newest row of zeros (`missing_fact`). The newest bar missing outright is retryable, but the same bar present and incomplete is final, and permanent. Phase 0 reports that adjusted prices can lag. Should these newest-session cases move to `confirm`? Recommendation: yes, before Build 2 writes the first snapshot. The rows in the fixtures show none of these shapes, so the risk is unmeasured, not shown.
- **Q2 (contract wording).** A confirm observation survives a retryable result between its two samples, a refusal included, since the contract ties the observation to the confirmation rule. Two matching samples 30 minutes apart then finalise. Both verifiers agree this is the plain reading, and the other reading only delays the final by about 30 minutes. Keep it? Recommendation: keep, and add "of the confirm class" to the shape note's next version.
- **Q3 (contract).** Add `schemaVersion`, or a field for the mapper's drop count? Recommendation: `schemaVersion` yes before the first write, if at all: it cannot be added to immutable documents later. The drop count can stay in the log.
- **Q4 (operations).** `writer.commit` reads null unless Vercel's system environment variables are exposed. Fine to leave, or should Build 2 check?

## 10. What a reviewer must check, and the one post-merge step

Check:
1. `api/_utils/setupEvidence/store.js` against contract §3.
2. `api/_utils/setupEvidence/classify.js` against the table, and the four lines beyond it (§6, 5 and 6).
3. The allowlist keys and note in `api/_utils/compositionProtectedStoresAllowlist.json`: a human review the scan asks for.
4. `api/_utils/hypothesisRecords/review.js`: the diff is small, and it is the one live path this build touches.
5. Decisions 2, 3 and 12, which go past or against a proposal in Phase 0.

**After merging, one step: publish the Firestore rules.** It is needed before Build 2 runs. Nothing reads or writes the store before then. The two new blocks add nothing over the default deny, so behaviour is the same before and after you publish.

Pushed is not deployed. No cron or preview exercises this code.

## 11. Runs

| Check | Where | Result |
|---|---|---|
| Full vitest suite | Linux (WSL), Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, on the merged tree `9520d5b6` | 1,262 files passed, 8 skipped; 28,072 rows passed, 0 failed, 89 skipped; 257 s |
| `test:rules` | Windows, emulator, LF snapshot of `9520d5b6` (WSL has no Java) | 30 files, 526 rows passed |
| `lint:gate` | Linux, `9520d5b6` | exit 0 |
| `vite build` | Linux, `9520d5b6` | exit 0 |
| Golden guard | `scripts/ci/tf-setup-golden-guard.mjs`, compare mode | PASS against `main` `337a5801`: golden 767d22633672, `tf-setup-v1/sem-1`, one baseline entry, no new entry |

The docs commit on top holds documents only. Its own suite, lint gate and build are in the PR description.

The documents are committed byte-identical (SHA-256 of the committed blob): the contract `4c035c45ce8c14237d10c324df883803b853a7a210edb0253b271b3111c3565a`, the growth map V1.2 `ba0005ca5295847361bedccbefbea1cf1305c97e4204e4386551d07531e99322`, the Phase 0 report `86c39cce98090acc0e966d471955411275344c163aaeb48cb4946ad811528455`. C4 is appended after C3 with the contract §7 wording, and `git diff` shows added lines only.
