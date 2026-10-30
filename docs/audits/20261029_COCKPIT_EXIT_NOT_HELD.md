# Cockpit — exit calls on stocks not in the book (Amendment E): the count, and a STOP

> **Update, 2026-10-29 (after the rulings):** Option 1 was ruled (Amendment E rev 2), then rev 3 (the check's own committed trade). The fix is built to rev 3 and the BUILD_RULES §2 review has been run — §9–§16 here and `docs/audits/20261029_COCKPIT_EXIT_NOT_HELD_REVIEW.md` — and the founder has ruled on the review's open items (§9, §15). **Blessed 2026-10-29 (framework chat), with four conditions folded into rev 4; conditions 1–3 are built after the review and recorded in §17.** §1–§8 and the appendix are the count and the STOP as they were written.

**Date:** 2026-10-29 · **Branch:** `claude/cockpit-exit-not-held-3ef5fc` (the app's suffix; cut at `origin/main` `a5c35ba6`; push target by refspec `claude/cockpit-exit-not-held`) · **Status:** STOPPED before building, on the prompt's own gate. Nothing built, nothing pushed, no PR.

## 1. Verdict

| Question | Answer |
|---|---|
| Does the gate fire? (b) held in a different tier > 5% of exit calls | **YES — 60 of 284 = 21.1%** (founder 23.2%, FT_QA 0%). Both denominators agree: nothing was unreadable. |
| (a) exit calls on a stock not held anywhere at the check | **1 of 284 = 0.35%** — the 2026-10-23 FT_QA CVX call (named in §3). |
| What drives (b)? | **Every one of the 60 is in a League Tournament battle**, where the check's prompt has no Tier column, so the model fills the required `slot` field blind. In tiered (agent-mode) battles, (b) is **0 of 157**. |
| What would the draft do if built as written? | Had E-1 been live at those checks, **61 of 284 (21.5%)** exit calls would have minted `invalidated` — 60 of them on stocks the agent does hold — reading "Dropped · not in your book" (records already minted stay frozen; going forward the same rate repeats on League battles). Today, under E-2, the 2 open (b) calls (PPG and LLY in `5hKnf805…`) would lose their buttons and read "Not in your book", which is false for both. |
| What the verdict rests on | For the 127 League checks the stored prompt shows no tiers, so "the book" is the battle document rolled back to each check (§7). Read those 127 as unreadable instead and (b) is **0 of 157 readable** — the gate would not fire, and (a) would still be 1. I read "the stored prompt or book where the records allow it" to include the battle document and its trades; that reading is yours to overrule. |
| What I recommend | A ruling, per the prompt. My pick: **Option 1** (§5) — test "held in any tier of the book", not "held in the call's slot tier". It fixes the live bug (1 call), keeps the copy true, and matches how `canComeIn` already reads `slot`. |

## 2. The counts

**Population (read 2026-10-29 14:52 ET, read-only):** 121 battles (founder 114, FT_QA 7); 422 call documents; `mintedMode === 'on'` on 413 (founder 369, FT_QA 44); no call is `'shadow'`; 9 founder calls carry no `mintedMode` (pre-Amendment C) and are out of scope. **Exit calls** (called shot or Confirmation, `direction: 'exit'`) with `mintedMode === 'on'`: **284**, in 35 battles.

| | Founder | FT_QA | Both |
|---|---:|---:|---:|
| Exit calls (`mintedMode: 'on'`) | 259 | 25 | **284** |
| **(a)** symbol not held anywhere at the minting check | 0 | 1 | **1 (0.35%)** |
| **(b)** symbol held, in a different tier from the call's `slot` | 60 (23.2%) | 0 | **60 (21.1%)** |
| Held in the call's slot tier (control) | 199 | 24 | 223 |
| Unreadable (records do not allow a verdict) | 0 | 0 | 0 |

**(b) by game mode and by what the check's prompt showed the agent:**

| Battle mode | Check's prompt | Exit calls | (b) | (a) |
|---|---|---:|---:|---:|
| `baggerbomb_tournament` (League) | no Tier column | 127 | **60 (47.2%)** | 0 |
| `baggerbomb_agent` | Tier column shown | 157 | **0 (0.0%)** | 1 |

**Shape of the 60 (b) calls:** called slot → actual tier: core→star 21, star→support 12, core→support 10, support→core 9, star→core 8. Kind/default: called shot (hold-default) 38, Confirmation (act-default) 22. State today: ended with battle 23, expired unresolved 20, hit 14, open 2, invalidated 1 (by an existing price-line reason). 23 distinct symbols, 16 of the 17 tournament battles. **None of the 60 has a recorded answer**; the 12 recorded answers on exit calls are all on calls held in their slot.

## 3. The 2026-10-23 FT_QA CVX call

`5abyFRTtk6ThIgO0a8yN:eval_010:call:1` — FT_QA, a Confirmation, `direction: exit`, `slot: core`, default `act`, counterpart `LMT`, minted 2026-10-23 3:01:23 PM ET (`mintedAt` 1792782083958), state `expired_unresolved`, no recorded answer. The check's stored prompt (`tickBodies`, a tiered prompt) lists the held book by tier, and **CVX is in none of them** — class (a), read from the stored prompt, exact. The record around it (VERIFIED, read-only): the 3:01 PM check (`eval_010`) and the next one (`eval_011`) were both downgraded to HOLD with `validationErrors: ["CVX below haiku_decision hurdle floor (below_floor) — swap blocked"]`, and EOG is held in core (bought at 12:01 PM ET). That the blocked swap was specifically EOG → CVX is ASSUMED from the task description: the downgrade clears `symbolOut` and `symbolIn`.

## 4. Why the draft's slot-tier test fails here

- **The model is asked for a tier it cannot see.** `slot` is required (`agentEvalToolSchema.js:265-269`, "the slot the trade lands in (entry) or leaves (exit)"). The League Tournament prompt drops the Tier column on purpose (`agentEvalPromptAssembly.js:1469-1476`, "the eval model must never be told a 2x slot exists in tournament mode"), while the battle document still stores `star:2 / core:2 / support:2`. The mint checks only that `slot` is one of the three words (`validate.js:144`). So in League battles the declared `slot` agrees with the book 52.8% of the time.
- **The swap code already treats `slot` as a hint, not a fact.** `canComeIn` looks at the call's slot "first (a symbol is held once), else wherever the book holds it" (`swappable.js:96-98`). The draft takes D-7's frozen book but applies the filing check's strict slot-tier test to it (callActions.js:181), which is stricter than D-7's own `canComeIn`.
- **Directive answers are already refused on these calls today.** `isCallActionEligible` tests the strict slot tier (`callActions.js:180-181`), the tile offers its buttons without any held test (`cockpitModel.js:614-616`), and the 400 is not persisted, so I cannot count the taps. By the code, a "Hold off" on any of the 60 returns `400 symbol_not_held`, and the refusal line then says the stock "has already left your book" (`battleViewCopy.js:1329`) — false for a stock held in another tier. That is outside this task (BUILD_RULES §3: report, do not fix); it is also what an "any tier" E-2 would leave untouched.

## 5. The ruling needed

| | E-1 test at mint | E-2 test at answer / display | Effect on the 284 | Copy true? |
|---|---|---|---|---|
| **Draft, as written** | not in the call's slot tier | not in the call's slot tier | 61 calls (21.5%) minted `invalidated`; the 2 open (b) calls lose their buttons | **No** for 60 |
| **Option 1 (recommended)** | not in **any** tier of the frozen book | not in **any** tier of the fresh parent (acks included) | 1 call (the CVX one) | Yes |
| **Option 2** | Option 1, plus: for an exit, `slot` is **set from the book** at mint (the tier that holds it), the agent's word kept beside it | as Option 1 | 1 call dropped; 60 calls carry their true tier, so every slot-tier test downstream (eligibility, retire, `canComeIn`) becomes exact | Yes |

My pick is **Option 1**: it is the amendment's purpose and nothing more, and the tournament `slot` label becomes its own task (Option 2 is that task, and it changes an immutable field's source, so it needs its own amendment line). Under Option 1 the wording of E-1/E-2 changes from "its slot tier" to "any tier of the book"; the held test would sit beside the legality table in `answers.js` and `callActions.js` would use it (§6).

**Questions for the founder / framework chat:**
1. Option 1, 2 or the draft as written?
2. If a price-line defect and a not-held exit coincide, which reason does the record carry? My reading: the existing price-line reasons keep precedence (`candidate.js:301`), `exit_not_held` applies to calls otherwise valid. The draft is silent.
3. The tournament `slot` label (47% blind guesses): task it separately, as Option 2 or as a prompt change? It touches a fenced assembler if the answer is "show the tier", so that part is yours.

## 6. What I will build on a ruling (no work started)

- **E-1:** `candidate.js` `composeCall` — reason `exit_not_held` for an exit call whose symbol is not in the frozen `seam.book`; a separate constant (the pinned `INVALIDATION_REASONS` stays three); D-9 row in `battleViewCopy.js` (`COCKPIT_DROPPED_REASON_TEXT`, "not in your book"); the pin at `cockpitModel.2b.test.js:223` moves in the same commit.
- **E-2 endpoint:** `call-response.js` — in the acknowledgment branch, after the existing `expired` checks and before any write, `400 ineligible_action` / `symbol_not_held` using the same held helper that eligibility uses (moved, not copied, to `answers.js`, which the client can import; `callActions.js` is server-only). The directive path keeps its current order and reasons.
- **E-2 displays:** the held test beside `tileAnswersFor` in `answers.js`; `buildCockpitFeed`/`tileOf` take the screen's `agentBattle.portfolio` (absent → no claim); no buttons, no "Who comes in?", tag "Not in your book" on the 2a tile, the details sheet and the 2b card.
- **Tests:** E-1 (not held anywhere / held elsewhere / held in slot), E-2 endpoint (ack + directive on a stock that left; control), E-2 on each display, a short mutation check on both rules; full Linux suite on the merge with main (`flock`, `--maxWorkers=8`, `TZ=UTC`, exit code asserted), `lint:gate`, `vite build`.
- **Size warning:** the file count will reach about 12 (≥10 triggers BUILD_RULES §2's mandatory multi-lens review). I will say so in the PR.
- **No model-visible text change:** not yet checked against `callsBlock.js` (build-phase item; the amendment asserts an invalidated call already renders as such).

## 7. Method, validation, limits

- **Session opening (BUILD_RULES §2/§3):** `git fetch origin` first; `origin/main` = `a5c35ba6` = HEAD, tree clean. This main already contains the callRecords deadline-flake fix (PR #1010, merge `7d6c3a2f`), so the sibling task's rows are on main and none are edited here; no file overlap to report.
- **Read:** Firestore Admin `.get()` only (battles by owner, `calls`, `tickBodies`); no raw dump written. The two owner uids were recovered **in memory** from the archived Build 2b raw dump's `ownerId` by account label (the prompt carried no uids), set as `COCKPIT_ALLOWLIST_UIDS` for the one process, and never printed or written. A git-ignored copy of `.env.local` sat at the worktree root for the run and was removed after.
- **The book at the minting check.** 157 of 284 checks' stored prompts carry the Tier column — exact tiers, all in agent-mode battles (VERIFIED). For the other 127 — all League, and all 60 of the (b) calls — no stored tier exists: the prompt gives the held set (`ACTIVE POSITIONS`) and the tier comes from the battle document rolled back to the check's `promptBuiltAt` (current portfolio, later trades reversed by tier and `slotIndex`). **That tier is a derivation (ASSUMED): it was never compared to a stored tier for a League check.** What backs it: the rolled-back held set equals the stored prompt's held set in **284 of 284** live checks, with 0 rollback errors (no slot / `symbolIn` mismatch); on the Oct 14 archive it matched in 525 of 525 checks, League included, and the rolled-back tiers matched the stored Tier column in 1,211 of 1,211 rows (those rows are agent-mode checks, the only ones with a stored tier).
- **Not asserted:** whether a tap on one of the 60 happened and was refused (400s are not persisted); FT_QA has only 25 exit calls in 7 battles; the 0.35% (a) rate rests on one call. Stored prompts expire after 120 days; all 284 were still present.
- **Script:** the read script lived in the session scratchpad, not the tree (to keep this task's file count down); its logic is the three paragraphs above. Say if you want it committed as `scripts/`.

## 8. State of the branch

Local commits only: `de33ae8f` (Amendment E, byte for byte, sha256 `10d76f72…3b2f`, blob verified equal to the source) and this report. Not pushed; no PR. The PR, when it opens, starts with "Hold — merge after Amendment E is blessed, after 6 PM ET."

## 9. The build — the rulings and what was done

Two rulings of 2026-10-29. First: **Option 1**, written into Amendment E revision 2. Second: **revision 3** (the check's own committed trade), with five rulings on the open items and an instruction to run the §2 review. §1–§8 and the appendix are the count and the STOP as written; the only change to them is one update line under the title.

| Ruling | Done |
|---|---|
| **Rev 2 / Option 1.** E-1 and E-2 test "held in any tier": E-1 against `seam.book`, E-2 against the fresh parent (acknowledgments included) and against the battle document on the 2a tile, the details sheet and the 2b card; one helper beside the legality table | `heldInAnyTier` / `isExitNotHeld` in `answers.js`; all three ask it (§11). Rev 2 committed byte for byte as `3ab2813f` (sha256 `0ba71400…a046be`); `de33ae8f` stays |
| Do not change D-4's slot-tier filing check or D-6 retirement; confirm League routing first | `callActions.js` and `retire.js` are untouched (`git diff origin/main` lists neither). Routing confirmed, file:line in §10 |
| Precedence: existing price-line reasons win | `candidate.js:328`; pinned by a row and by mutant M2 |
| The League slot label and its false refusal line: follow-up, not this task; no prompt change, no Option 2 | §15 |
| Leave the read script uncommitted | It stayed in the session scratchpad |
| **Rev 3.** E-1 does not drop an exit whose symbol is the check's own committed `symbolIn` (`callsCtx.executorResult`, `observe.js carryExecutorResult`; null matches nothing); passed from `publish.js` into `buildMintCandidate` → `composeCall` as a required parameter, like `held` and `book`; `symbolIn` only; E-2 unchanged; no fenced file | Rev 3 committed byte for byte as `46523136` (sha256 `4ed78931…c1112`). `publish.js:383` hands `callsCtx.executorResult?.symbolIn ?? null` to `buildMintCandidate`, which throws if it is `undefined` (`candidate.js:413`) and hands it to `composeCall` (`:454`); the exemption is `candidate.js:325,328`. Every direct test caller now passes `committedSymbolIn: null`. Tests: 7 mint rows, 1 shadow row, 3 `publish.test.js` rows that drive the real `carryExecutorResult`, and mutants M20–M26 |
| Model-visible: your reading is right, no stop (rev 3 corrects the sentence). Keep the strip chip. Keep the unreadable-parent fail-open. Bench-sheet Pick wait and the routing-flag docstring stay "found, not fixed" | §12, §15 |
| Fetch `origin/main` (now `982f6661`) and rerun the full Linux suite on the merge under the lock, plus `lint:gate` and `vite build` | §14 |
| Run the BUILD_RULES §2 review on the final diff: multi-lens, a refuter for every finding, snapshot trees, written to `docs/audits/`, cited from the PR | `docs/audits/20261029_COCKPIT_EXIT_NOT_HELD_REVIEW.md` |
| Push, update the report, stop | Done at `712956af` |
| **Rulings on the review's open items.** Q1: keep the letter. Q2: accept the single tag. Keep the card's silence-line change. Record them in the report (Q1 and Q2 move to "found, not fixed"), push, stop; keep the hold line | Recorded here and nothing built: no rev 4, no change to the tile's tag, and `cockpit2bModel.js:336` stays. Q1 and Q2 are §15 items 8a and 8b. The review record carries the same note (its §4). The hold line stays |
| **The blessing (framework chat, 2026-10-29), four conditions, folded into rev 4** (no rule changes). Build 1–3; no second §2 review; replace the PR's first line; push; stop | Rev 4 committed byte for byte as `b8628ba8` (sha256 `f8d5c7cd…18a4`). Condition 1 (the outgoing case), 2 (guard the wall) and 3 (D-9's table) are built and recorded in **§17**; condition 4 (position identity before multi-day battles) is the multi-day format arc's. The PR's first line is now "Blessed 2026-10-29 (framework chat) — merge after 6 PM ET." |

Branch commits (local branch `claude/cockpit-exit-not-held-3ef5fc`, pushed as `claude/cockpit-exit-not-held`): `de33ae8f` Amendment E rev 1 · `ca740fa6`, `c87fc4b2` the count report · `3ab2813f` rev 2 · `f7c0c1db` the build · `6d967995` one more display row · `cf5ce476` the One Door census oracle · `8b8b097a` the first build report · `46523136` rev 3 · `04be9e27` the rev 3 build (**the reviewed head**) · `ccb2ec46` the review's fixes · `9a13c810` the review record and the report brought up to rev 3 · `720e8401` the production-line count · `712956af` the review record's CONFIRMED / REFUTED split · `73c0ad36` the founder's rulings on the review's open items · `b8628ba8` rev 4 · `ce646f69` conditions 1–3 · `14b4ca5c` the wall pin's whole-phrase needles · the report update (this commit).

## 10. League routing — confirmed (ruling item 3)

The ruling said to stop if a League battle can reach the cockpit or `call-response` from the app. It cannot (VERIFIED, read at this HEAD):

- `src/screens/BattleViewScreen.jsx:31-39` sends a League battle to the League Arena **before** the `agentDeployed → AgentBattleScreen` branch at `:43`. The discriminator is `src/screens/battleViewRouting.js:13` (`gameMode === 'baggerbomb_tournament'`). The flag that gates it, `LEAGUE_BATTLEVIEW_ROUTING_ENABLED`, is `true` (`src/config/featureFlags.js:257`).
- `AgentBattleScreen` is imported in one place, `src/App.jsx:51`, and handed to `BattleViewScreen` at `:9701`. The cockpit's answer client (`src/hooks/useCockpitAnswer.js:37`, `CALL_RESPONSE_PATH`) is used by `AgentBattleScreen.jsx` only.
- The server does not gate by mode: `api/agent/cockpit-status.js:96` answers `on` from the calls mode and the allowlist alone, and the founder's League battles do mint at `'on'` (the 127 League exit calls in §2). The routing above is the only wall.
- Data, read-only: the founder's League battles hold 195 calls in 20 battles, **0 answered and 0 cockpit filings**; all 13 recorded answers (founder 12, FT_QA 1) are in agent-mode battles.

Two cautions for whoever owns that flag. (1) `call-response.js:370` still has a League budget branch; only a direct API caller can reach it. (2) With the flag off, a League battle falls through to `AgentBattleScreen` (`BattleViewScreen.routing.dark.test.jsx` documents it), and the 47% would then reach the cockpit with D-4's slot-tier check and its "has already left your book" line live (§15).

Amendment E rev 3 now records the routing and the flag in its "What stays as it is" (the flag is the only wall; it must stay on until the League slot label is fixed).

## 11. What changed

| Rule | Where |
|---|---|
| **The one helper** | `api/_utils/callRecords/answers.js:126` `heldInAnyTier(book, symbol)` → true / false / null (null = no readable book; proves nothing) and `:140` `isExitNotHeld(call, book)` (an exit shot or Confirmation only; false for entries, picks and an unreadable book). `book` is anything carrying `portfolio`: the seam's frozen book, the fresh parent, the screen's battle document. The bench is not the book; the crypto row (support) is; a hole in a tier array is skipped |
| **E-1** | `api/_utils/callRecords/candidate.js:325,328` in `composeCall`: `invalidationReason(row, observation) ?? (!boughtHere && isExitNotHeld(…, seam.book) ? EXIT_NOT_HELD_REASON : null)`, where `boughtHere` (rev 3) is `nonEmptyString(committedSymbolIn) && row.symbol === committedSymbolIn`; `:105` `EXIT_NOT_HELD_REASON = 'exit_not_held'` (a separate constant: the pinned `INVALIDATION_REASONS` stays three). The same expression feeds `state`, `invalidatedReason` and `minted[].reason`; `replacementOptions` stays null for it (D-3). An unknown seam (`book: null`) invalidates nothing; a frozen book is always readable. Rev 3: `publish.js:383` → `buildMintCandidate` (required, `candidate.js:413`) → `composeCall` (`:454`). D-9 row: `src/screens/battleView/battleViewCopy.js:1315` `exit_not_held: 'not in your book'` → "Dropped · not in your book" |
| **E-2, endpoint** | `api/agent/call-response.js:327`, in the acknowledgment branch, after the two `expired` checks and before any write: `400 ineligible_action`, reason `symbol_not_held`, against the transaction's fresh `parent`, flag off or on. Every other ordering is as it was; the directive rows keep `isCallActionEligible`'s slot-tier check (D-4) and refuse a stock in no tier by it. An identical repeat still returns the stored response |
| **E-2, displays** | `src/screens/battleView/cockpitModel.js:620-629,692` (`tileOf`): when the call the buttons would answer is an exit in no tier of `book`, it offers no button and no "Who comes in?" step, and an unanswered, un-acted, otherwise-Live tile carries the tag `call:not_held` → "Not in your book" (`battleViewCopy.js:1272`). A recorded answer, an act, a retirement, a replacement, a recorded event and a resolved state keep their own tags. The details sheet (`sheetOf`) and the 2b card (`cardViewOf`) read the tile, so they follow. `buildCockpitFeed` takes `book`; `AgentBattleScreen.jsx:2632` passes `{ portfolio: agentBattle?.portfolio ?? null }` — the screen's own document — and the memo watches `agentBattle?.portfolio` |
| **Two additions beyond the list** | (1) The 2b strip chip, where a waiting card shows by default, says "· not in your book" instead of "· exit" (`cockpit2bModel.js:367`, `battleViewCopy.js:1165`) — **ruled: keep.** (2) From the review (NH-L3-1): the 2b card drops "If you say nothing, it exits." where the tile reads "Not in your book" (`cockpit2bModel.js:336`) — one line — **ruled: keep** |

Nothing fenced is edited or called (BUILD_RULES §1): none of the fenced files is in the diff, and the diff adds no import of one. No prompt text, no flag, no cron, no schema, no rules. Rev 3 reads a value the cron already carries; `agent-evaluate.js` is not in the diff.

## 12. Model-visible text — checked, no change

`api/_utils/callRecords/callsBlock.js` is the only place call records become prompt text. It reads the open calls and the three resolved states (`:50` `RESOLVED_STATES = hit, expired_unresolved, ended_with_battle`; the queries at `:140-143`). `invalidated` is in neither list, so an invalidated call is **not rendered at all**. Amendment E rev 3 corrects its Standing-conditions sentence to say so, and the founder has ruled the reading right: no stop. No template, wording, registry entry or prompt-contributing module changed. The data-dependent effects, both intended: a call minted `exit_not_held` is absent from the chat block's open rows (as any call born invalidated is), and an acknowledgment now refused is never recorded, so it never becomes an `answered:` row. The review's L4 lens re-derived this independently (the only model path is `chat.js:612` `buildCallsBlockForChat`, and `voiceLayerPrompt.js`).

## 13. Tests and the mutation check

| File | Rows |
|---|---|
| `api/_utils/callRecords/exitNotHeld.test.js` (new) | 23 — the helper (each tier, crypto, bench, unreadable books, holes in a tier, the exit-only guard); E-1 (not held anywhere in both kinds, **held in another tier is not dropped**, held in its slot, precedence, unknown seam, entries untouched, a mixed block, shadow mode); **rev 3** (an exit on the committed `symbolIn` is open whichever tier it names, the CVX shape is still dropped, null / empty / non-string match nothing, only that stock, `symbolIn` only and the price line still wins, shadow, a mixed block, the parameter is required) |
| `api/_utils/callRecords/publish.test.js` | +3 — the committed `symbolIn` reaches the mint through the real `carryExecutorResult`; no swap, a swap with no closed trade, a swap that bought another stock or sold this one exempt nothing |
| `api/agent/call-response.test.js` | +9 — acknowledgment refused (go and hold), directive refused (unchanged), control, **any tier**, ordering (expired / already_answered first), **identical repeat after the stock left** (rewritten by the review: it now writes through the store's API, with a control and a no-write check), entries not asked, unreadable parent, the import is the shared one. The act-default exit fixture is a `confirmation` |
| `api/agent/call-response.2b.test.js` | +2 — the same, flag on |
| `src/screens/battleView/exitNotHeld.display.jsdom.test.jsx` (new) | 15 — the tile model (buttons, step, tag, group; hold-default; flag off; any tier; no book; entries and upside; recorded facts keep their tags, including a recorded event; the chip word on a held button-less exit), the 2a tile, the details sheet and the 2b card mounted (the card no longer promises an exit), and the screen's wiring |
| `src/screens/AgentBattleScreen.cockpit2b.jsdom.test.jsx` | +1 — the mounted screen: NVDA leaves the book → no Now card for it, no step, the chip and the opened card say so, nothing posted |
| Pins moved | `cockpitModel.2b.test.js` (the D-9 table's fourth row), `cockpitModel.test.js` (the fact table gains `call:not_held`), `oneDoor.census.test.js` (below), and the eight direct callers of `buildMintCandidate` (`committedSymbolIn: null`) |

Fixtures changed: `AgentBattleScreen.cockpit.jsdom`, `.cockpit.reducedMotion.jsdom` and `.cockpit2b.jsdom` each had an **exit call on MU while their book held no MU** — a Needs-you card for a stock the player did not own, the very thing this fix removes. Each book now holds MU. `oneDoor.census.test.js` failed once in the first full run: its non-vacuity oracle used `answers.js` as the module only the answer endpoint reaches, and the mint (reached by the evaluator) now asks the helper beside it. The oracle is now `callRecords/commands.js`; the ledger and plays assertions are untouched. It moved once before, for `callActions.js` (#986).

**Mutation check** (32 mutants, one exact replacement each, restored byte for byte; `mutate.mjs` in the scratchpad): **32 of 32 killed on the final code head.** The first 19 covered E-1, the helper, the endpoint and the displays (one survived the first pass and a row was added); M20–M26 cover rev 3 (the exemption ignored, any trade exempting every exit, a null matching, `publish.js` handing over `symbolOut` or nothing, the parameter no longer required, `composeCall` not handed it); M27–M32 came from the review (§ review record 5). The review's L5 lens ran 43 further, independent mutants.

## 14. Verification

Tested tree **`ccb2ec46`** — the last code commit; the pushed head adds only this report and the review record. It contains the rev 3 build; `origin/main` is `982f6661` (PR #1013, fetched again before the run; its files — documents, `featureFlags.js`, flag-pin tests — overlap none of this branch's), so the suite ran on a **throwaway merge of the two, `10a80a1b`** (made inside the Linux worktree, never pushed).

| Check | Result |
|---|---|
| **Full suite, Linux** on the merge (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `CI=true`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`) | **Exit code 0**, read from `exit-code.txt`: 1,233 files passed, 8 skipped; **27,172 tests passed, 89 skipped, 0 failed**; 228 s |
| Earlier full runs (same method) | `f7c0c1db`: exit 1, one row (`oneDoor.census.test.js`, §13) — fixed. `cf5ce476`: exit 0, 27,159. The rev 3 head `04be9e27` merged with main: exit 0, 27,169. This run is 27,172: the three rows the review added |
| `lint:gate` (`eslint . --config eslint.gate.config.js --max-warnings 0`) | Exit 0 on the merge |
| `vite build` | Exit 0 on the merge (the chunk-size notice is not new) |
| Off-golden | `agent-evaluate.callRecords.offGolden.test.js` passes in the suite; `callRecordsOffGolden.json` is not in the diff and its SHA-256 matches the test's pin. At `'off'` the phase is never reached (`agent-evaluate.js:4889`) |
| The deadline-flake rows (`retire.test.js`, the sibling rows) | None went red in any run. PR #1010 is already in `main`; this branch edits none of those rows |
| Mutation check | 32 of 32 killed on the final code head (§13) |
| Rules suite (`npm run test:rules`, Windows) | Not run: no rules, indexes or Firestore shapes changed |

The Linux worktree (`~/pd-ci-exit`, a private `git worktree` of the shared clone) had its own `node_modules` from `npm ci` (main's lockfile carries `three@0.184.0`, which the shared clone lacks); the shared clone's HEAD and `node_modules` were not touched. The suite logs are in `~/runs-exit/` (`rev3`, `final2`).

**Verification of the post-review changes (§17: rev 4, the outgoing-case rows, the flag's docstring, the wall pin, D-9's table).** Tested tree **`14b4ca5c`** — the last code commit; the pushed head adds only this report and the review record's last section. `origin/main` was fetched again and is still `982f6661`, so the suite ran on a **throwaway merge of the two, `4a1c8977`** (made inside the Linux worktree, never pushed).

| Check | Result |
|---|---|
| **Full suite, Linux** on the merge (same method as above: Node 20.20.2, `TZ=UTC`, `CI=true`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`) | **Exit code 0**: 1,234 files passed, 8 skipped; **27,178 tests passed, 89 skipped, 0 failed**; 232 s. Six more rows than the 27,172 above: the four outgoing-case rows and the wall pin's two. Log: `~/runs-exit/rev4b` |
| `lint:gate` | Exit 0 on the merge |
| `vite build` | Exit 0 on the merge (the chunk-size notice is not new). The same build on the exact pushed head is in the PR body |
| `flagPinGuard.test.js` | Passes (Windows, and inside the Linux suite on the merge with main's changes to it). It scans the new pin's bare `expect(…).toBe(true)` line and requires the flag's "Pinned by:" pointer, which now exists |
| Affected suites, Windows | `src/config`, `api/_utils/callRecords` and the routing tests green, except one known row: `shadowCpuQuoteIntegrityFlags.test.js` "the guard registers it as dark by design" fails on the Windows CRLF working copy and passes on Linux/LF (the Windows-only failure the house already lists; not caused by this branch) |
| Mutation check | M33 (the `minting_check` skip removed), M34 (the tier match removed), M35 (the flag turned off) and M36 (the docstring's wall paragraph lost) are all **killed**; M36 first survived a pin that tested single words and was killed after the pin was changed to whole phrases (`14b4ca5c`). M1–M32 were killed on the last production-logic head; no production logic changed since (the one production file touched is a comment) |
| Off-golden, rules | `callRecordsOffGolden.json` is not in the diff; the off-golden test passes in the suite. Rules suite not run: no rules, indexes or Firestore shapes changed |

## 15. Found, not fixed

1. **The League slot label.** The tournament prompt shows no tiers (`agentEvalPromptAssembly.js:1469-1476`) while the declaration schema requires `slot` (`agentEvalToolSchema.js:265-269`): 47% of League exit calls name the wrong tier (§2). Showing the tier touches a fenced assembler; deriving `slot` from the book at mint was Option 2. Ruled: a follow-up.
2. **The false "has already left your book" line.** `battleViewCopy.js:1337` answers any `symbol_not_held` with that sentence. D-4's slot-tier check refuses a directive on a stock held in another tier with that code, so the sentence would be false there. Not reachable from the app while League routing holds (§10). Ruled: a follow-up.
3. **The routing flag is the only wall.** §10: `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` stays `true`, or the League slot label becomes a live cockpit problem. Its docstring said "Default OFF (dark)" while the value is `true`, and the line after the declaration is a stray `typeof window … 'leagueRouting' === '1'` expression statement that does nothing. Ruled: found, not fixed. **Since superseded:** the blessing made the docstring a condition — it is rewritten and pinned (§17, condition 2); the stray statement is left as it was.
4. **The scoped bench sheet's Pick buttons wait when the step is null** (`cockpit2bModel.js:625-627`) — they do not crash and do not file. Ruled: found, not fixed.
5. **An unreadable parent.** A battle document with no `portfolio` at all is not refused an acknowledgment (it proves nothing, the stance `counterpartUsable` takes). Ruled: keep the fail-open; a row pins it.
6. **`symbolOut`.** An exit on the stock the check itself sold mints open (it is in the seam's book) and is unanswerable from birth (E-2 reads the fresh parent). Ruled: `symbolOut` unchanged. **Since verified (§17, condition 1):** that check's flip pass skips the call (`minting_check`), so it is never acted at its own check; the count is 5 of 284 (none acted).
7. **Existing tests encoded the bug** (§13): three screen fixtures offered answers on an exit for a stock their book did not hold.
8. **From the review** (`docs/audits/20261029_COCKPIT_EXIT_NOT_HELD_REVIEW.md` §3–§4), three items, two of them put to the founder and ruled:
   - **8a. NH-L1-2 (Q1) — ruled: keep the letter.** An UNKNOWN executor outcome (the executor threw after the commit and the landed-trade re-read also failed) leaves `executorResult` null, so an exit on the maybe-bought stock mints `exit_not_held`, immutably. This matches rev 3 ("a missing value matches nothing"). Not built: no rev 4, no flag on the calls context. The sketch (a flag at the cron's `swapOutcomeUnknown` branch, through `publish.js`, skipped in `composeCall`) stays in the review record §4 for anyone who reopens it. It needs a double fault and an agent that exits the stock it is buying; 0 of 284 counted records did.
   - **8b. NH-L3-2 (Q2) — ruled: accept the single tag.** When a recorded filing owns a tile's tag (a live command with a new ask; a directive that left the slot) the buttons are withdrawn but "Not in your book" does not show, for at most one check until D-6 retires the command. The recorded tags are true; it is an omission, not a falsehood. Not built; the additive second line the refuter prototyped stays in the review record.
   - **8c. NH-L1-1** (a nit, left): the bought stock's options and counterpart are judged on the pre-trade book, as D-3 and D-7 specify.

## 16. Review and the PR

This branch changes **32 files** against `origin/main` — 28 code and test files (1,062 insertions, 48 deletions; the ten production files account for 156 and 33, comments included: the nine that were reviewed plus the routing flag's docstring, a comment) plus the amendment, the Build 2b spec, this report and the review record — past BUILD_RULES §2's mandatory-review line (≥10 files). **The review has been run**: five lenses on snapshot trees of `04be9e27`, a refuter for every finding, written to `docs/audits/20261029_COCKPIT_EXIT_NOT_HELD_REVIEW.md`. **16 distinct findings: 9 CONFIRMED, 5 PARTIAL (each with a refuted half), 2 REFUTED as defects; no blocker.** Fixed in `ccb2ec46`: a repeat row that could not fail (rewritten), three new rows and a fixture correction for the mutants that survived, the card's false "it exits" line, four stale comments, and this report. The review's two open questions were then ruled — Q1 keep the letter, Q2 accept the single tag (both now §15 items 8a and 8b) — and the card's silence-line change was ruled keep (§11). The blessing then added conditions 1–3, built after the review and listed as post-review changes in §17; by ruling there is no second §2 review. The PR's first line is now "Blessed 2026-10-29 (framework chat) — merge after 6 PM ET." (it was "Hold — merge after Amendment E is blessed, after 6 PM ET."). Nothing is merged, subscribed to or watched (BUILD_RULES §2).

## 17. Framework conditions (the blessing of 2026-10-29)

The framework chat blessed Amendment E with four conditions and folded them into **revision 4** (committed byte for byte as `b8628ba8`, sha256 `f8d5c7cd…18a4`, over rev 3; no rule changes). Conditions 1–3 are built here; condition 4 is recorded for the multi-day format arc. The PR's first line is now "Blessed 2026-10-29 (framework chat) — merge after 6 PM ET."

### Condition 1 — the outgoing case (verified; the code does not read `acted`)

An exit call on the stock its **own check sold**. The condition expected it to read `acted` through `flip.js`'s exit match. It does not, and rev 4 says what happens instead. Verified against the code:

| Claim | Where |
|---|---|
| The stock is in the seam's book (the book **before** the check's own trade), so E-1 mints the call **open** | `candidate.js:325,328` (`isExitNotHeld` against `seam.book`); a mint row |
| That check's flip pass **skips** the call: `planFlip` returns `{ skip: 'minting_check' }` when `call.evalId === evalId` | `flip.js:184`; the page scan and the in-transaction recheck both call `planFlip` (`flip.js:235,356`) |
| So it is never `acted` by its own check, even when the executor result is exactly its whole trade | `matchesWholeTrade` is true for it (`flip.js:170` symbolOut, `:160` tier); `planFlip` never reaches it |
| The **heard** pass cannot act it either | `heard.js` `planHeard` returns `{ skip: 'not_this_thread' }` unless the call carries a directive answer on the thread in the prompt; a call minted at this check has none (`heard.js:80-81`), and the pass reads calls by `directiveThreadId` (`heard.js:185`) |
| It stays **open on a sold stock** until its line or its deadline resolves it; meanwhile E-2 refuses every answer and the card reads "Not in your book", which is true | `call-response.js:327`; `cockpitModel.js:620-629` |
| **League:** the exit match also needs the trade's tier to equal the call's `slot` (`flip.js:160`; `heard.js` `legMatches`, same test), so a guessed slot also leaves a **later** sale of the stock un-acted, the call still open on a sold stock. E-2 makes it unanswerable and League routing keeps it out of the cockpit. League slot label follow-up | `flip.js:160`; amendment rev 4, "What stays as it is" |

**The row** (`api/_utils/callRecords/flip.test.js`, four rows under "Amendment E — an exit call on the check's own committed symbolOut"): it mints the exit on TSLA, runs the real flip pass at that check with the executor result `TSLA → AMD` (the call's whole trade, and the price line met), and asserts the call is **open, not acted, with nothing written** (`diag.skipped = { minting_check: 1 }`); `planHeard` skips it; `isExitNotHeld` is false on the book before the sale and true after; and a trade in another tier fails the exit match. Mutants M33 (no minting-check skip) and M34 (no tier match) are killed by them. **The code agrees with rev 4; nothing to stop for.**

**The count** (read-only; the same rules as the pre-build count — uids held in memory only, recovered from the archived dump, never printed or written; Firestore `.get()` only): of the **284 exit calls** counted before the build, **5 named their own check's committed `symbolOut`** (a model-path trade — `source: 'haiku'`, `evaluationId` equal to the call's `evalId`, written within ten minutes after the check's prompt), all five founder calls, all five in League battles, **all five with a call `slot` different from the tier the trade actually used** (core vs star, star vs support, support vs core, …). **None was acted** (0 of 5): two ended `hit`, one `expired_unresolved`, two `ended_with_battle`. **0 of 284 named their own check's committed `symbolIn`** — the figure rev 3 states. (The read now sees 287 exit calls, three minted since; the three add nothing to either count.) Fifteen exit calls came from a check that committed a trade.

### Condition 2 — guard the wall (`LEAGUE_BATTLEVIEW_ROUTING_ENABLED`)

`src/config/featureFlags.js`: the flag's docstring is rewritten. It says the flag is **ON** (the old text said "Default OFF"), that it is **the only wall** keeping League battles — whose exit-call slots are guessed — out of the cockpit (Amendment E), and that it **must not be turned off until the cockpit arc's League slot label follow-up lands**. It names its pin. **The value stays `true`; this is not a flip.** The stray expression statement under the declaration is left as it was.

The pin (`src/config/leagueBattleviewRoutingWall.test.js`, the house way — `flagPinGuard.test.js`'s rules):
- a **loud line** `expect(FLAG, MESSAGE).toBe(true)` whose message names Amendment E and the follow-up, and the **bare line** `expect(FLAG).toBe(true)` that the guard scans (the guard's regex does not see a pin that carries a message argument, so the two are two lines) — `flagPinGuard.test.js` therefore checks the pin against the live value and requires the flag's "Pinned by:" pointer, which now exists;
- a second row that fails if the docstring stops naming the wall, Amendment E and the follow-up (whole phrases), or says "Default OFF" again.

Mutants M35 (flag turned off: both the pin and the guard go red) and M36 (the docstring loses its Amendment E phrase) are killed. M36 first **survived** a version of the row that tested single words ("Amendment E" also appears in the Pinned-by line); the row now tests whole phrases.

### Condition 3 — D-9's display table

`docs/COCKPIT_BUILD2B_SPEC_V1_0.md`: **§7.2** gains `exit_not_held` → "not in your book" *(Amendment E)*; **§7.1** gains the row *an open exit whose stock is in no tier of the book (nothing answered, nothing acted, otherwise Live) — no buttons, no "Who comes in?" step* → "Not in your book", muted *(Amendment E)*. No test reads that spec.

### Condition 4 — recorded, not built

For the multi-day format arc: E-2's "held" is a **symbol** test, safe while the 24-hour bench cooldown keeps a sold stock from returning within a one-day battle. Before multi-day battles reach the allowlist, "held" becomes "the same holding" (position identity, as P6 and ID-1 use it).

### Changes made after the §2 review (listed as such; no second review, by ruling)

| Change | Kind | Where |
|---|---|---|
| Amendment E rev 4, byte for byte | document | `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_E.md` (`b8628ba8`) |
| The outgoing-case rows | **test only** | `api/_utils/callRecords/flip.test.js` (+4 rows, two imports) |
| The routing flag's docstring | **comment only — the one production file touched**; the value is unchanged | `src/config/featureFlags.js` |
| The tripwire pin | **test only** (new file, two rows) | `src/config/leagueBattleviewRoutingWall.test.js` |
| D-9's two rows | document | `docs/COCKPIT_BUILD2B_SPEC_V1_0.md` §7.1, §7.2 |
| This section and the updated §9, §14–§16 | document | this report; the review record's last line |

No production logic changed after the review. Verification of these changes is §14: `flagPinGuard.test.js` and the affected suites on Windows, the full Linux suite on the merge with main under the lock, `lint:gate` and `vite build`, and mutants M33–M36.

## Appendix — every (a) and (b) call

Columns: account · call · symbol · called slot · tier held at the check · state · minted (ET day) · answer.

| Class | Account | Call | Symbol | Called slot | Held at the check | State | Minted (ET day) | Answer |
|---|---|---|---|---|---|---|---|---|
| (a) | FT_QA | `5abyFRTtk6ThIgO0a8yN:eval_010:call:1` | CVX | core | not held | expired_unresolved | 2026-10-23 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_002:call:1` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_003:call:0` | GEV | star | support | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_004:call:1` | LRCX | star | support | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_005:call:0` | GEV | star | support | hit | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_005:call:0` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_006:call:1` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_009:call:0` | GEV | star | support | expired_unresolved | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_007:call:0` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_010:call:0` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_013:call:0` | GEV | star | support | hit | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_012:call:0` | BE | core | star | hit | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_015:call:1` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `zC5A8aJCn19GdtqCEgeP:eval_013:call:0` | BE | core | star | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_016:call:0` | GEV | star | support | ended_with_battle | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_017:call:0` | GEV | star | support | expired_unresolved | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_017:call:1` | PANW | core | star | expired_unresolved | 2026-10-06 | — |
| (b) | founder | `CtzRnqPHwItu1Xp4SmCR:eval_017:call:2` | BE | core | star | expired_unresolved | 2026-10-06 | — |
| (b) | founder | `Zz3Ne66K6BdmG796vQeW:eval_012:call:1` | GEV | core | support | hit | 2026-10-07 | — |
| (b) | founder | `5gneptzsySUe1rUEW5tv:eval_002:call:1` | BE | core | star | hit | 2026-10-08 | — |
| (b) | founder | `PMhbPZ3af5qrNW93WOsd:eval_003:call:0` | LLY | core | support | ended_with_battle | 2026-10-08 | — |
| (b) | founder | `PMhbPZ3af5qrNW93WOsd:eval_004:call:1` | LLY | core | support | ended_with_battle | 2026-10-08 | — |
| (b) | founder | `5gneptzsySUe1rUEW5tv:eval_006:call:0` | BE | core | star | hit | 2026-10-08 | — |
| (b) | founder | `5gneptzsySUe1rUEW5tv:eval_007:call:0` | AMD | core | support | hit | 2026-10-08 | — |
| (b) | founder | `PMhbPZ3af5qrNW93WOsd:eval_007:call:1` | LLY | star | support | ended_with_battle | 2026-10-08 | — |
| (b) | founder | `5gneptzsySUe1rUEW5tv:eval_010:call:1` | AMD | core | support | ended_with_battle | 2026-10-08 | — |
| (b) | founder | `nBukrwRi75wAawApwPFF:eval_001:call:0` | AMD | star | support | invalidated | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_004:call:0` | CTVA | support | core | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_005:call:0` | CTVA | support | core | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_005:call:1` | ZS | star | core | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_005:call:2` | AFRM | core | support | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_006:call:0` | CTVA | support | core | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `nBukrwRi75wAawApwPFF:eval_006:call:0` | ZS | star | core | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_007:call:0` | ZS | star | core | expired_unresolved | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_010:call:0` | ZS | star | core | expired_unresolved | 2026-10-09 | — |
| (b) | founder | `3vzKWJ2JyZQljzg4xtfm:eval_016:call:0` | ZS | star | core | ended_with_battle | 2026-10-09 | — |
| (b) | founder | `s6Zg8BGLHCkHEVM4thT0:eval_004:call:0` | MSFT | core | support | ended_with_battle | 2026-10-19 | — |
| (b) | founder | `oMSgTiMlWZmDMdVoELIj:eval_003:call:1` | NUE | core | star | ended_with_battle | 2026-10-20 | — |
| (b) | founder | `oMSgTiMlWZmDMdVoELIj:eval_019:call:0` | MTCH | star | core | expired_unresolved | 2026-10-20 | — |
| (b) | founder | `LCjTNSD1hJ0PwwZN03p5:eval_005:call:1` | SYK | core | star | expired_unresolved | 2026-10-21 | — |
| (b) | founder | `xyyy90tyQ0hoo7Bi3Mlk:eval_007:call:0` | TMO | support | core | hit | 2026-10-22 | — |
| (b) | founder | `xyyy90tyQ0hoo7Bi3Mlk:eval_012:call:0` | TMO | support | core | expired_unresolved | 2026-10-22 | — |
| (b) | founder | `xyyy90tyQ0hoo7Bi3Mlk:eval_017:call:0` | TMO | support | core | expired_unresolved | 2026-10-22 | — |
| (b) | founder | `onLZktbO8QurFNBgtmpp:eval_004:call:1` | CRM | star | core | expired_unresolved | 2026-10-23 | — |
| (b) | founder | `onLZktbO8QurFNBgtmpp:eval_007:call:2` | ADP | core | star | hit | 2026-10-23 | — |
| (b) | founder | `onLZktbO8QurFNBgtmpp:eval_009:call:0` | LMT | core | star | hit | 2026-10-23 | — |
| (b) | founder | `onLZktbO8QurFNBgtmpp:eval_017:call:0` | LMT | core | star | expired_unresolved | 2026-10-23 | — |
| (b) | founder | `onLZktbO8QurFNBgtmpp:eval_017:call:1` | SYK | core | support | expired_unresolved | 2026-10-23 | — |
| (b) | founder | `f07WWesJauilEEl3XWGW:eval_003:call:1` | LEN | support | core | expired_unresolved | 2026-10-26 | — |
| (b) | founder | `f07WWesJauilEEl3XWGW:eval_004:call:2` | HUM | core | star | hit | 2026-10-26 | — |
| (b) | founder | `f07WWesJauilEEl3XWGW:eval_006:call:2` | CAG | support | core | expired_unresolved | 2026-10-26 | — |
| (b) | founder | `f07WWesJauilEEl3XWGW:eval_008:call:1` | CAG | support | core | hit | 2026-10-26 | — |
| (b) | founder | `LuEg2J44qSUv0aBuxUvq:eval_005:call:0` | TSLA | core | star | expired_unresolved | 2026-10-27 | — |
| (b) | founder | `LuEg2J44qSUv0aBuxUvq:eval_012:call:1` | NVDA | core | star | hit | 2026-10-27 | — |
| (b) | founder | `xXjJxRt33EEGDESe9YrA:eval_005:call:2` | TSLA | core | star | expired_unresolved | 2026-10-28 | — |
| (b) | founder | `xXjJxRt33EEGDESe9YrA:eval_008:call:0` | PANW | star | core | hit | 2026-10-28 | — |
| (b) | founder | `xXjJxRt33EEGDESe9YrA:eval_011:call:0` | AMD | star | support | expired_unresolved | 2026-10-28 | — |
| (b) | founder | `xXjJxRt33EEGDESe9YrA:eval_012:call:0` | AMD | star | support | expired_unresolved | 2026-10-28 | — |
| (b) | founder | `xXjJxRt33EEGDESe9YrA:eval_015:call:0` | AMD | star | support | expired_unresolved | 2026-10-28 | — |
| (b) | founder | `5hKnf805H2QfGkOVClWA:eval_006:call:1` | PPG | core | support | open | 2026-10-29 | — |
| (b) | founder | `5hKnf805H2QfGkOVClWA:eval_014:call:2` | LLY | core | support | open | 2026-10-29 | — |
