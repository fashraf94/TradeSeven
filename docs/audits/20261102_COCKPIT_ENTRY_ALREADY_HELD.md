# Cockpit entry-already-held — Amendment F build report

**Date:** 2026-11-02 · **Contract:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_F.md` (draft for blessing; committed byte for byte as the branch's first commit, `45e1319a`, sha256 `47fb8adf…dcccc`) · **PR:** opened "Hold — merge after Amendment F is blessed, after 6 PM ET." Not merged. **Review record:** `docs/audits/20261102_COCKPIT_ENTRY_ALREADY_HELD_REVIEW.md`.

## 0. Preamble (BUILD_RULES §2, §3)

| | |
|---|---|
| Branch | local `claude/entry-calls-held-stock-cc9d9e` (the app suffixes a worktree's branch); pushed as `claude/cockpit-entry-already-held` by refspec |
| Cut from | `origin/main` `406414863c61eb150e300b06af3297359eae610f` (PR #1019 merge) after `git fetch origin`; re-fetched before the Linux runs and before the push — main had not moved, so the tested tree is the branch head (main is its ancestor) |
| Session start | HEAD = origin/main, clean tree |
| Reads | Firestore `.get()` only, both allowlisted accounts, 2026-11-02 10:34:44 AM ET. No write, no deploy, no `firebase deploy` |
| uids | recovered in memory from the archived Build 2b raw dump by account label, handed to the read as `COCKPIT_ALLOWLIST_UIDS` in the child process's env only; never printed, never written. The extract was scrubbed (both uids also sit inside `agentId`, `resolvedAgentManifest.manifestId` and the shadow-gate envelopes) with the scrub asserted, and lives outside the repo |
| Stop conditions | none tripped: no entry call of the 19 was acted or answered; no template, wording or registry text changed; no fenced file edited |

## 1. The counts (before any change)

Population: **144** `mintedMode === 'on'` entry calls (called shot or Confirmation) across 124 battles (116 founder, 8 FT_QA); founder·League 66, founder·agent 52, FT_QA·agent 26. The Nov 1 audit saw 140; the 4 extra were minted since. The matching rule is the Nov 1 audit's: `source: 'haiku'`, `evaluationId === call.evalId`, written 0–10 min after the check's `promptBuiltAt`. The book is rebuilt by reversing later `trades`; **144 of 144** rebuilt books agree with the stored `heldAtMint` (the audit's 140 of 140).

### (a) Entry calls on their own check's committed `symbolIn`: **19 of 144 (13.2%)** — Nov 1: 19 of 140

| | |
|---|---|
| Account · mode | founder·League 16, founder·agent 1, FT_QA·agent 2 (League 16, agent 3) |
| Named counterpart | null 14 · named 5 (all 5 = the trade's own `symbolOut`) |
| `heldAtMint` | false on all 19, by construction |
| Final state | hit 7, expired_unresolved 8, ended_with_battle 4 |
| Kind · default | all called shots · hold 12, act 7 |
| Minted after the committing trade | 19 of 19 |
| **`outcome.actedEvalId` set** | **0 of 19** (every `outcome` is just `{ receiptRef }`) |
| **`playerResponse` present** | **0 of 19** |

**No STOP.** None of the 19 was acted or answered, so F-1 does not turn a plan that played out into an upside call, and no ruling is needed. Seven of the nineteen resolved `hit`; F-1 leaves that path alone (an upside call still resolves).

### (b) Entry calls that stayed open after their named counterpart left the book (any tier) while their own stock was not in it: **0**

27 of the 144 name a counterpart. In 6 of them the counterpart was in no tier at the mint or after a later trade while the call was open, and in **all 6 the call's own stock was in the book at that moment**, so none belongs to (b). Five are the (a) calls with a named counterpart (the counterpart is the trade's outgoing stock). The sixth is `eW:eval_009:call:1` (CTVA, counterpart GEV): it was already an upside call (`heldAtMint: true`, CTVA brought in earlier by a stagnation-risk trade), so F changes nothing for it. The case F leaves unchanged therefore has no live instance: an entry whose counterpart left while its stock is not in the book.

### (c) Entry calls on their own check's committed `symbolOut`, or under the bench cooldown at the seam: **1**

| | |
|---|---|
| On the check's own committed `symbolOut` | **0** |
| On a stock swapped out in the 24 h before `promptBuiltAt` (the executor stamps `cooldownUntil = attempt + 24 h`, `api/_utils/agentSwapExecution.js:465`) | **1** — founder·League `p5:eval_004:call:2`, MTCH, swapped out 10/21 12:16:06 PM, no named counterpart, resolved `hit` |

The cooldown count rebuilds the lock from the trade history (the seam's bench rows are not stored), so it is an approximation of the seam's lock set.

### (d) Extra, informational: entries whose stock came into the book **after** the mint, while the call was open: **14 of 144**

Not asked for, but it measures F-2's second clause ("the same holds after mint for a stock that comes into the book by another route"), which F-1 cannot reach. All 14 came in through the deterministic stagnation-risk path (`source: 'archetype'`, `risk_stagnation_*`): 9 founder calls (BLK ×2, NUE, COP, EOG ×5) and 5 FT_QA calls (LLY ×5, all on 10/7). None was answered. F-2's answer-time test is the only thing that covers them.

## 2. Verdict

| | Result |
|---|---|
| Counts | (a) 19 of 144, **none acted, none answered** (no STOP); (b) 0; (c) 0 + 1 cooldown; (d) 14 after-mint arrivals |
| F-1 (mint) | built: an entry on the check's committed `symbolIn` is an upside call. `candidate.js:358`. Exits unaffected; null matches nothing |
| F-2 (answer time) | built: the helper, the endpoint (acks and directives, ordering as the amendment states), the tile, the sheet, the 2b card, the strip chip, the Now card. Upside calls keep their own treatment |
| Refusal lines, spec rows | built (flag-on lines only); §7.1 one row, §7.3 two rows, each "(Amendment F)" |
| Model-visible | **no template, wording or registry text changes; zero bytes change in what the chat model reads.** This contradicts the draft amendment's sentence that F-1 "is a change in what the chat model reads" — see §4 and the questions in §9 |
| Off golden | byte-identical (the golden and the callsOn goldens pass; mint mode 'off' executes no changed line) |
| Fence | none of the 11 fenced files is in the diff; none newly imported (§4) |
| Tests | 66 new rows (§5), one fixture corrected in E's display suite |
| Linux suite, merged with current main | **exit 0** — 1,268 files passed / 8 skipped, **28,227 passed / 89 skipped / 0 failed** (§6) |
| lint:gate · vite build | both **exit 0** (§6) |
| Mutation | **37 of 37 mutants killed** on the final code, each by an F-named row (§6); the mutating review lens added 60 of its own (42 killed, 9 of the 18 survivors equivalent, the rest closed with rows) |
| BUILD_RULES §2 review | triggered (20 files); 6 lenses, every finding handed to a refuter (§7); no blocker, no major, no defect against the amendment's letter; the fixes are test rows, fixtures and comments only |
| Not merged | PR opened "Hold — merge after Amendment F is blessed, after 6 PM ET." |

## 3. What was built (cited at the head; the line numbers are the head's)

| | |
|---|---|
| **F-1** | `api/_utils/callRecords/candidate.js:358` (`composeCall`): `heldAtMint: row.direction === 'entry' && ((Array.isArray(held) && held.includes(row.symbol)) \|\| boughtHere)`. `boughtHere` (`:337`) is the Amendment E rev 3 constant, already computed from `committedSymbolIn` (`publish.js:384` ← `observe.js carryExecutorResult`); reused, not recomputed. Comments updated: header, rev-3 paragraph, `@param`s |
| **F-2 helper** | `api/_utils/callRecords/answers.js:161` `isEntryAlreadyHeld(call, book)`, beside `isExitNotHeld`, on `heldInAnyTier`. True for a non-pick entry on a stock held in any tier; false for exits, picks, an unreadable book. It says nothing about upside calls (their treatment comes first at every call site) |
| **F-2 endpoint** | `api/agent/call-response.js:337` (acknowledgments, beside E-2's check) and `:358` (directives, immediately before `isCallActionEligible`): `400 ineligible_action` / `symbol_already_held`, against the transaction's fresh parent, before any write, flag off or on. The header table is updated. All other ordering unchanged (§6 of the review record walks it) |
| **F-2 displays** | `src/screens/battleView/cockpitModel.js:628,633,637-638` (`tileOf`): `alreadyHeld = !isUpsideCall(target) && isEntryAlreadyHeld(target, book)` folds into `legal` (no buttons) and the tag (`call:already_held`, replacing only a bare `state:open`). `src/screens/battleView/cockpit2bModel.js:338` (the card drops its silence line) and `:371` (strip chip word). Copy: `battleViewCopy.js:1278` (tag "Already in your book", muted), `:1167` (chip word "already in your book"). The Now card and the sheet follow the tile. `book` is the screen's battle document, wired by Amendment E |
| **Refusal lines (flag on)** | `battleViewCopy.js:1345` `symbol_already_held` → "{SYM} is already in your book — nothing was filed."; `:1346` `counterpart_not_held` → "{CP} has already left your book — nothing was filed." Inside `if (v2)`; flag off falls to the generic 400 line |
| **Spec rows** | `docs/COCKPIT_BUILD2B_SPEC_V1_0.md` §7.1 (one tag row), §7.3 (two refusal rows), each marked "(Amendment F)" |
| **Comments only** | `observe.js:127` and `publish.js:381-383` (stale after F-1) |

## 4. Model-visible and the fence

**Confirmed in `callsBlock.js` and the chat path (verified by running code, not only reading).** `callsBlock.js:88` routes an upside call to `renderUpsideLine`; `copy.js:160` and `:173` return the same `conditionLine(call)` for both lines. Across 64 mints (4 horizons × above/below × act/hold × counterpart or none × on/shadow) × 4 states × 3 clocks (768 renderings) an F-1 call's row, the whole `buildCallsBlock`, `renderDeclaredEvent`, and the open/history ordering through the real `readCallsForBlock` are **byte-identical** to the ordinary-entry rendering and to the base commit's. The minted record differs from the base only in `heldAtMint` (and its canonical string and `publicationBytes`, 1330 → 1329). `entryAlreadyHeld.test.js` pins the row's bytes with a literal. No lifecycle module (`flip`, `heard`, `sweep`, `retire`, `publish`, `queue`, `events`) reads `heldAtMint`, so an F-1 call still resolves `hit` (7 of the 19 did).

**So the draft amendment's F-1 note ("a change in what the chat model reads for these records") overstates it: no byte moves.** The real data-dependent effect is the one F-2 has: an answer on an entry whose stock is in the book can no longer file, so it never becomes an `answered:` row, a §2 fact, or call-family directive text in the agent's slot. 14 of the 19 audited calls (no named counterpart) would have been accepted before. Amendment E's report §12 names its analogue ("a refused acknowledgment is never recorded, so it never becomes an `answered:` row"). I did not edit the amendment (it is the founder's draft, committed byte for byte); the wording is a question in §9.

**Fence (BUILD_RULES §1).** The 11 fenced files are blob-identical to main. The diff touches none and adds no new import to any module that reaches one. `call-response.js` already reaches `agentEvalPromptAssembly.js` and its imports through `directiveWriter.js → directiveUtils.js` — **called, not edited**; the two new checks are early returns before any write, so that path is reached less often, never with new input. `composeCall` calls no fenced function. `callActions.js` (the directive-template registry), `promptHonestyRegistry.js` and `callsBlock.js` are byte-unchanged.

## 5. Tests

66 new rows, one corrected fixture:

| File | Rows | What |
|---|---|---|
| `api/_utils/callRecords/entryAlreadyHeld.test.js` (new) | 21 | the helper (any tier, slot-blind, frozen book = raw doc, exits/picks/unreadable book false, holes in tier arrays); F-1 (bought here → upside; held at the seam → upside, unchanged; not held → ordinary entry; null / empty / non-string matches nothing; `held: null` + committed symbolIn still upside; an exit on the committed `symbolIn` still mints open and is never upside; mixed block; shadow; immutable and in the canonical form; an unknown executor outcome); the model-visible bytes |
| `api/agent/call-response.test.js` (+12, `Amendment F (F-2)`) | 12 | acks refused; directives refused (no budget, no exchange); **the GILD shape → `symbol_already_held`, with the not-held control keeping `counterpart_not_held`**; any tier; the control on a stock not held; upside → `illegal_answer/upside_call`; the endpoint's other ordering (expired, already_answered, belief_mismatch first); the directive rows keep expired / parent_not_active ahead of the check; an identical repeat after the stock came in; exits and picks untouched; unreadable parent; the shared-module and ordering source pin |
| `api/agent/call-response.2b.test.js` (+4) | 4 | the same refusals with the flag on, the GILD shape, the control, upside |
| `src/screens/battleView/entryAlreadyHeld.display.jsdom.test.jsx` (new) | 25 | the tile (buttons, tag, group, hold-default, flag off, any tier, no book, exits untouched, **upside keeps its own treatment**, recorded facts keep their tags, the chip word, the sheet), the 2a tile, the sheet, the 2b card, the strip chip and the Now card mounted; both refusal lines through `cockpitRefusalLine` and the real `refusalLineOf`; the screen's wiring |
| `src/screens/AgentBattleScreen.cockpit2b.jsdom.test.jsx` (+1) | 1 | the whole screen: the battle document holds the stock → chip, tag, no answer, no silence line |
| `api/_utils/callRecords/publish.test.js` (+3) | 3 | the committed `symbolIn` reaches the mint for an entry through `runModelCallsPhase` (committed → upside; blocked / no trade → not; bought JPM or sold AMD → not) |
| `cockpitModel.test.js` | 1 line | `call:already_held` joins the fact-tag table whitelist |
| `exitNotHeld.display.jsdom.test.jsx` | 1 fixture | E's "ordinary entry" control used AMD, which that book holds in `support`; after F-2 it is correctly withdrawn, so the control moved to XOM (bench) |

## 6. Verification

All on Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`), in a private git worktree of the shared clone with `node_modules` linked from an install whose lockfile hash equals main's (`40382e64edb6`); the full suite under `flock /tmp/pd-suite.lock`, `--maxWorkers=8`, each step's exit code written to its own file (no pipe).

| | Head | Result |
|---|---|---|
| Full suite, first run | `887279ed` (the build) | exit 0 · 1,268 files passed / 8 skipped · 28,219 passed / 89 skipped / 0 failed · lint:gate exit 0 · `vite build` exit 0 |
| Full suite, after the review fixes and the mutation lens's rows | `0be619f4` | exit 0 · 1,268 files passed / 8 skipped · **28,227 passed / 89 skipped / 0 failed** (+8 rows: 3 publish, 3 helper / F-1, 1 endpoint, 1 display) · 276.6 s · lint:gate exit 0 · `vite build` exit 0 |
| The pushed head (this report and the review record on top of `0be619f4`; `git diff --stat 0be619f4 <head>` lists only those two files) | the head itself | re-built and re-tested in full on that exact commit; a report cannot carry its own commit's hash, so the result is in the PR description |

**Merged with current main.** `origin/main` was re-fetched before each Linux run and again before the push; it stayed at `406414863c61eb150e300b06af3297359eae610f` (PR #1019), an ancestor of the branch, so the tested tree is the branch head and there was nothing to merge. If main moves before the merge, CI tests the merge result.

**Not run:** `npm run test:rules` (the Firestore emulator suite) — no `firestore.rules` or rules-test file is touched, and WSL has no Java; `firebase deploy` was not run. **Local Windows runs** (CRLF checkout, `TZ=UTC`) of the touched suites were green throughout: they are not the record.

**Mutation** (the harness applies one mutant, runs the targeted files with the json reporter, restores the file byte for byte and hash-checks it; a run that fails with no failed test is BROKEN, never a kill): **37 of 37 KILLED**, each by at least one F-named row. They cover F-1 (off, leaks to exits, null matches everything, gated behind the held set, matches the counterpart, the pipe from `publish.js`), the helper (ignores direction, unreadable book counts as held, slot tier instead of any tier, picks, unknown direction, excludes upside), the endpoint (no ack check, no directive check, **the directive check moved after the eligibility test**, wrong reason, ack-only-for-go / -for-hold, skips go_now, skips expired / deadline / parent_not_active), the tile and card (buttons not withdrawn, tag not replaced, the upside gate, the state:open gate, silence kept / over-dropped, chip word kept / mis-keyed) and the refusal lines (removed, reworded, shown with the flag off).

**Off golden.** `api/cron/agent-evaluate.callRecords.offGolden.test.js` and `api/_utils/__fixtures__/callRecordsOffGolden.json` (pinned to LF by `.gitattributes`, SHA-256) are untouched and pass; at `CALL_RECORDS_MODE` 'off' no changed line executes (the cron's `callsStep` and `carryExecutorResult` return before `buildMintCandidate`; the endpoint 404s before F-2; `cockpitOn` is false on the client).

## 7. Review (BUILD_RULES §2)

Triggered: the cumulative diff is 20 files. Six lenses, each on its own `git archive` snapshot tree with a `node_modules` junction, read-only on git and on the shared tree; eight refuters (one per finding or per duplicated claim) on fresh trees; the mutating lens last on its own tree. Ids `EA-L<lens>-<n>`, refuters `EA-RF-<n>`. The full ledger, the CONFIRMED / REFUTED split and the dispositions are in `docs/audits/20261102_COCKPIT_ENTRY_ALREADY_HELD_REVIEW.md`. Headline: of 26 findings, 10 CONFIRMED, 10 PARTIAL, 1 REFUTED, 5 reproduced by the mutating lens (4 closed with rows, 1 inherited); **0 blockers, 0 majors, 0 defects against the letter**; every change the review caused is a test row, a fixture or a comment.

## 8. Found, not fixed (for separate tasking)

1. **Chip word and silence line are keyed on the tag, as in E-2.** On a held entry whose tag is a recorded fact (acted, acknowledged, a recorded event), the buttons are withdrawn but the chip keeps the agent's word and the card keeps "If you say nothing, it brings it in." Amendment E's founder ruling (2026-10-29, "one tag, no second line") covers this shape; the one clearly stale case is an unanswered entry with a recorded event (rare). Putting "already in your book" beside "Acted" would mislead (the act is why it is held). → question in §9.
2. **The details sheet's default line ("If you say nothing · intent: bring in AMD for KO") and the 2b plan sentence stay** beside "Already in your book". E's review refuted both as falsehoods (the line is an *intent* by the copy's own definition; the plan records what the agent said) and the founder ruled "keep". Pinned on purpose.
3. **`counterpart_not_held` → "{CP} has already left your book" is slot-tier, like E §15.2's `symbol_not_held` line.** `isCallActionEligible` tests the counterpart in the call's slot tier only. Unreachable in production today: `counterpartUsable` (`candidate.js:267-269`) stores an entry's counterpart only when it is in the slot tier at the seam, nothing moves a stock between tiers, and the 24 h bench cooldown blocks a sell-and-rebuy inside a one-day battle. Unit-level repro: a call on `slot: 'support'` with `counterpart: 'MSFT'` against a book with MSFT in `core` → `counterpart_not_held` and the line says it left. It becomes false with tier moves or multi-day battles (Amendment E condition 4, "same holding").
4. **A directive filed before the stock arrived is not retired.** `symbol_already_held` is not a D-6 book reason (the letter), and `isCallActionEligible` never tests an entry's own symbol, so a command filed on an entry and then outrun by the stock's arrival stays live to its deadline. No live instance: 0 of the 14 after-mint arrivals was answered.
5. **The gameplan-legs route.** `callsCtx.held` is `assetScores.map(...)` (`api/cron/agent-evaluate.js:3122`), rebuilt only after risk-loop exits (`:2547-2566`); `callsCtx.book` is fresh. A stock that came in earlier in the same tick through an approved gameplan meeting's legs is therefore not marked at mint (F-1 reads the model path's own trade; the first clause reads C-2's `held`), though F-2 still withdraws its buttons and refuses it at the endpoint — the visible difference is the label ("already in your book" vs "upside") and the chip word. Practically unreachable (no mounted UI sets a meeting `approved`). The mirror image exists today: an entry on the stock a leg *sold* gets `heldAtMint` true from the stale set. → question in §9. `agent-evaluate.js` is read-only for this task and was not touched.
6. **`heldAtMint: true` now conflates "held at the seam" and "bought by this check", with no discriminator** (the contract adds no field). The two analysis scripts read only the stored field over fixed pre-F windows, so they do not move; any future read after the deploy must rebuild the split from `trades[]`.
7. **Spec staleness shared with E.** `docs/COCKPIT_BUILD2B_SPEC_V1_0.md` §5.4's chip-word list (names neither "not in your book" nor "already in your book", nor three earlier words), §5.2's silence line (no held exception), §6.2's button table (no withdrawn row) and §7.1's E row (omits the silence-line drop) were already stale after E. Outside this task's spec scope (§7.1 and §7.3 rows only); no test reads the spec.
8. **The screen row idiom `tag.closest('[data-cockpit-tile]')?.… ?? 0`** (Amendment E's row, `AgentBattleScreen.cockpit2b.jsdom.test.jsx`, pre-existing) passes vacuously if the anchor is lost; F's row was fixed to bind the tile first, E's was left alone.

## 9. Questions for the founder / the framework chat (nothing blocks the build)

1. **Amendment F's model-visible sentences (lines 53 and 96–97)** say F-1 "is a change in what the chat model reads". Verified: it moves no byte. Suggested wording before blessing: "F-1 moves no byte the chat model reads; an F-1 call renders through `renderUpsideLine`, whose output equals `renderCallLine`'s. The data-dependent effect is F-2's: answers on an entry whose stock is in the book can no longer file, so they never become `answered:` rows, §2 facts or call-family directive text." (Four reviewers raised it independently.)
2. **Displays list, "no silence line" / "the strip chip reads 'already in your book'":** read it as **tag-keyed, like E-2** (as built, recommended — see §8 item 1), or as following the held test even when a recorded fact owns the tag?
3. **F-1's first clause.** "Held in the seam's book (as today)" is built as C-2's `held` set. Should it also test the frozen book (`seam.book`, as E-1 does for exits), which would close the gameplan-legs gap in §8 item 5 at the cost of changing C-2's semantics? Recommendation: leave it to F-2.
4. **Is F-2's removal of a directive path** (a directive on a held entry with no named counterpart was accepted before) to be named in the fenced-class record, as E's report §12 named its analogue? (Standing conditions say "the one model-visible effect is the data-dependent upside rendering".)

Nothing was merged, pushed to main, deployed or flagged. `firebase deploy` was not run.
