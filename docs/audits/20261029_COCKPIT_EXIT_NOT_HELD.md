# Cockpit — exit calls on stocks not in the book (Amendment E): the count, and a STOP

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
