# Cockpit Build 0 — Call records foundation (build report)

**HEAD.** Branch cut from `origin/main` @ **`987a9a68cf8c25c4df79b6db10827cede528a06a`**, after `git fetch origin`. Build HEAD, the last code commit, is **`578135f4c3b7d782916ff69bc9ca0172c1f5b755`**; this report is committed on top of it.

**Date:** 2026-09-24 · **Builder:** Claude Code · **Branch:** `claude/cockpit-build0-call-records` · **Spec:** Cockpit Spec V1.3 §2–§3 · **Flag:** `CALL_RECORDS_MODE` ships `'off'`; there is no flip in this PR.

## Executive verdict

| Question | Answer |
|---|---|
| **What is this?** | This build is the foundation of the cockpit. When the AI evaluates a battle, it may now also state the trades it is "calling" as typed data, for example "bring AMD in for KO if it trades above $163.50 this session". Build 0 stores those calls, checks each against the prices seen on later checks, and marks it **hit** or **expired**. Nobody sees any of this yet: chat, tiles and endpoints are unchanged. |
| **Does merging change anything live?** | **No.** The switch (`CALL_RECORDS_MODE`) ships **off**. With the switch off, the following are proven byte-identical to a snapshot taken before the change, on 19 battle scenarios: every battle write, every prompt byte, the AI's tool definition and both capture documents. Arguments handed to other code are compared only where a scenario makes the call: the trade executor, the learning receipt and the trade narration (4 calls each), and the evaluation log (11). No scenario calls the tournament ledger or the anticipation and vision writers. For those, the proof shows only that they stay uncalled (review BR-6, §13). |
| **Protected (fenced) files touched?** | **None.** Nothing in BUILD_RULES §1 was edited. |
| **Tests** | Full suite **789 files / 15,515 tests pass** (exit 0); lint gate **pass**; database-rules emulator **16 files / 298 tests pass**; production build (`vite build`) **pass**; mutation battery **78/78** mutants killed (plus 3/3 rules mutants). |
| **Did the off switch really come with a one-line flip?** | **Yes, now.** Review found that the documented flip would have turned 17 existing tests red. Those 7 test files now pin the switch. A dry run of the real flip (the value plus its pin) passes the full suite: **789 files / 15,515 tests, exit 0**. |
| **Independent review** | Five reviewers read the change along separate lenses and raised **31 findings**. A second reviewer was told to disprove each one: 30 held, 1 held only in part (B-1), 3 severities were lowered, and none was disproved outright. Every code-level finding is fixed in this PR, each with a test shown to fail without its fix. |
| **Your decisions before switching to "shadow"** | 1. **Origin label (A-1).** As the spec is written, every battle without an equipped watchlist labels its calls "provenance unresolved", never "agent initiative". 2. **"Until the next check" calls (E-3).** These can never be marked *hit*: they expire at the next check's scheduled start, just before that check can look at prices. 3. **New text the AI reads (C-4).** The tool description needs your or Astra's sign-off. |
| **Cost once switched on** | About **1,040 more input tokens** per AI call (970 before the BR-3 rewording, §13). Up to **4 s** more per battle check on the AI path (2 s on others). A battle needs **48 s** left, instead of 44 s, to start its AI call. |
| **Next steps** | Astra reviews the branch. You merge after 6 PM ET; nothing changes at merge. Then: publish the rules, create the `calls` index in the Console, make the three rulings above, and open the one-line "shadow" PR. |

---

> **§0–§1 are the gate record.** They were written and committed at `c2f1b883`, before any source change, and are reproduced unchanged except for one marked revision note in §1.4. Their line numbers are at `987a9a68`; the build's own anchors (§3) are at build HEAD.

## 0. Pins

| Pin | Value |
|---|---|
| Fetch | `git fetch origin` ran first (BUILD_RULES §3); `origin/main` advanced `2a1a16b1..987a9a68`. |
| Branch cut | `claude/cockpit-build0-call-records` from fetched `origin/main` @ **`987a9a68cf8c25c4df79b6db10827cede528a06a`** (merge of PR #901), clean tree. |
| Spec | `docs/design/COCKPIT_SPEC_V1_3.md` — copied byte-for-byte from the upload (`cmp` clean) and committed **alone** as `439cc0a1` ("docs(cockpit): spec V1.3"). `git show HEAD:docs/design/COCKPIT_SPEC_V1_3.md \| sha256sum` = **`5a6a9a4eee1c2337bba0f7b1348798d72cb639ee0c6b10dd785a621e71ea9939`**. |
| Contract | `docs/CALL_RECORD_FIELD_CONTRACT_V1_3.md` — `git show HEAD:… \| sha256sum` = **`7161e113efbac2e3fd05e4c45da3080d7d62ad0dcfc3ea1d9e30d38642c4fc25`** — **matches** the required pin. |
| Source baseline | Spec §3.13 names `main` @ `fc3a072e`. `git diff --stat fc3a072e 987a9a68 -- api/ src/ firestore.rules firestore.indexes.json vercel.json test/ package.json` is **empty**: the only commits between them add two review documents. Every seam below was re-read at `987a9a68`. |
| Inputs read, in order | the spec (§2–§3 build; §1, §4–§6 context) → the contract → `docs/audits/20260924_COCKPIT_SPEC_V1_2_REVIEW.md` (round 3) → round 2 → `docs/audits/20260923_PHASE0_COCKPIT.md` → `docs/BUILD_RULES.md`. |
| Input discrepancy | The task names `docs/audits/20260923_COCKPIT_SPEC_V1_1_REVIEW.md`; **that path is absent from `main`**. `main` holds round 1 as `docs/audits/20260923_COCKPIT_SPEC_V1_REVIEW.md` (read). Round 2 was read from its committed blob on the fetched branch `origin/docs/review-cockpit-spec-v1-1` @ `282fe109` (the provenance round 3 records). Neither file was copied into this branch. |

## 1. The reconciliation gate (read-only, at `987a9a68`)

**Verdict: PASS — no changed shape, no missing path. Two early-exit anchors in the spec's seam map are stale (moved seams, not conflicts); both paths exist with the shape the spec requires.** Every row below was read in this session (VERIFIED).

### 1.1 Spec §3.13 seam map

| Operation | Spec says (`fc3a072e`) | HEAD `987a9a68` — VERIFIED | Disposition |
|---|---|---|---|
| calls/capture context outside `try` | `agent-evaluate.js:866-908` | `api/cron/agent-evaluate.js:866-907` (capture context `:873-890`, `pendingNarrations` `:897`, `pendingAnticipations` `:906`); the `try` opens at `:908` | exact |
| initial fetch | `:1004-1018` | `:1004-1018` — `prices[symbol] = data.price` at `:1009` | exact |
| required-quote gate | `:1029-1042` | `:1029-1042` — `assessRequiredQuotes` `:1030`, lock release + `degraded_quotes` return `:1036-1041` | exact |
| augmentation fetch 1 (hot-bench rebuild) | `:1403-1411` | `:1403-1411` — `prices[symbol] = data.price` at `:1409` | exact |
| augmentation fetch 2 (catalyst) | `:2404-2411` | `:2404-2411` — `battle.portfolio.bench.stocks.push` `:2405`, `prices[ticker] = data.price` `:2410` | exact |
| forced execution-price replacement | `:2232-2251` | `:2232-2251` — `prices[symbol] = { ...prices[symbol], current: entryPrice }` at `:2242` (a new object; the fetched object is not mutated) | exact |
| prompt completion (`promptBuiltAt`) | `:2628-2634` | `:2628-2634` — `promptBuilt = true` `:2629`, `promptBuiltAt = new Date().toISOString()` `:2630` (ISO string) | exact |
| committed executor return consumed | `:3446-3463` | `:3446-3463` — `const swapResult = await executeSwapServer(…validation.resolvedTier, validation.resolvedSlotIndex…)` `:3446-3450` | exact |
| final evaluation update | `:4244` | `:4244` — `await battleRef.update(finalUpdate)`; `cronState.evalSeq` rides it (`:4166`); `evalSeq`/`evalId` minted `:2915-2916` | exact |
| narration dispatch | `:4276-4290` | `:4276-4291` inside the `finally` opened at `:4261` | exact |
| capture finalize | `:4366-4372` | `:4366-4372` | exact |
| early exit — passive / CPU | `:1086-1093` | **`:1236-1263`** (`battle.isCpu === true` `:1242`, write `battleRef.update(scoreUpdate)` `:1255`, `cpu_passive` `:1260`, return `:1262`). `:1086-1093` is inside `scoreHeldPositions`. | **moved seam** — the anchor is carried from the round-2 baseline `591b714d`; the path exists, same shape |
| early exit — proposal-pending | `:2104-2116` | **`:2269-2286`** (`skip_haiku` `:2273`, write `:2278`, `proposal_pending` `:2283`, return `:2285`). `:2104-2116` is inside the risk-swap L1 capture. | **moved seam** — same provenance; path exists, same shape |
| early exit — gameplan-pending | `:2295-2314` | `:2295-2314` (R11 pass `:2303`, write `:2307`, return `:2314`) | exact |
| early exit — gameplan-created | `:2334-2361` | `:2334-2361` (R11 pass `:2335`, write `:2355`, return `:2361`) | exact |
| early exit — no-trigger | `:2464-2483` | `:2464-2483` (write `:2477`, return `:2483`) | exact |
| early exit — budget-skipped | `:2555-2569` | `:2555-2569` (`budget_skipped` failure, falls through to `:4244`) | exact |

### 1.2 The eight exit paths and the write each commits before exiting

| # | Exit (§3.4) | Authoritative write before exit | Writes an evaluation entry? |
|---|---|---|---|
| 1 | model-result | `battleRef.update(finalUpdate)` `:4244` | yes (`evalId` minted `:2916`) |
| 2 | transport-failed-after-prompt (`promptBuilt` true, `haikuFailure` set: timeout/HTTP/`truncated_response`/`invalid_tool_result`, `:2729-2788`) | same `:4244` | yes |
| 3 | budget-skipped | same `:4244` | yes |
| 4 | no-trigger | `battleRef.update(scoreUpdate)` `:2477` | no |
| 5 | proposal-pending | `battleRef.update(scoreUpdate)` `:2278` | no |
| 6 | gameplan-pending | `battleRef.update(scoreUpdate)` `:2307` (after `runSuppressionDeterministicPass` `:2303`) | no |
| 7 | gameplan-created | `battleRef.update(scoreUpdate)` `:2355` (after the pass `:2335`) | no |
| 8 | passive / CPU | `battleRef.update(scoreUpdate)` `:1255` | no |
| — | excluded: degraded quotes (`:1036` lock release only), failed refresh (`refreshFailure`, reaches `:4244` with `refresh_failed`), failed prompt build (`build_timeout`/builder throw, `promptBuilt` false, reaches `:4244`), error exits (`catch` `:4250-4260`) | as listed | failed refresh / failed build: **yes**; others no |

### 1.3 The other gate items

| Item | HEAD — VERIFIED |
|---|---|
| `isSettlementQuoteUsable` shape | `api/_utils/agentQuoteHealth.js:23-29` (spec cites `:20-28`; the doc comment starts `:14`): `!!quote && quote.fallback !== true && typeof quote.current === 'number' && Number.isFinite(quote.current) && quote.current > 0`. Reads **`current`** and **`fallback`** — the detached `{ current, fallback, fetchedAtMs }` passes it unchanged. |
| Fields the awaited `executeSwapServer` returns | `api/_utils/agentSwapExecution.js:369` returns `{ closedTrade, incomingAsset }`; `closedTrade` (`:255-273`) carries `symbolOut` `:256`, `symbolIn` `:257`, `tier` `:259`, `slotIndex` `:260` (= the `resolvedTier`/`resolvedSlotIndex` passed in, `:117`). Consumed at `agent-evaluate.js:3446-3463`. |
| `firestore.indexes.json` `calls` index | **None.** 38 composite indexes (none on `calls`); `fieldOverrides` only for `ticks`, `tickBodies`, `signalDropCache`. No `__name__` field anywhere. The reflection analogue is `firestore.indexes.json:219-236`. |
| Pilot capture registration | **None.** No pilot flag in `src/config/featureFlags.js`, no pilot path in `api/_utils/tickCapture/`, no pilot spec under `docs/`. `TICK_CAPTURE_SCHEMA_VERSION = 1` (`captureConfig.js:38`) is the only version; `captureWriter.js:175,208` read it for both documents. **Composition rows 3 and 4 (pilot on) are therefore gated UNAVAILABLE.** |
| `TRADE_DECISION_TOOL` consumers | live call `api/cron/agent-evaluate.js:38` (import) + `:2671` (`tools: [TRADE_DECISION_TOOL]`); validator `api/_utils/agentEvalToolResultValidation.js:49` import, **`:51` captures `TRADE_DECISION_TOOL.input_schema` once**; `api/_utils/composition.m7e2eBudget.test.js:45,152`; `api/_utils/thresholdLintCopy.test.js:43,52,101` (source-level "no `20-day`"); `api/_utils/agentEvalToolSchema.test.js:9-29`; `api/scripts/test-voice-layer-phase-3.js:395-406` (source regex); `scripts/paired-eval-harness.js:65,123`; line-cite comment `api/_utils/platformGuardrails.js:38` (→ schema `:16`). |
| Validator's captured schema | top-level `required` + per-property type/enum only (`agentEvalToolResultValidation.js:39-43`); it will keep seeing the declarations-off constant. |
| `TIMING_ENTRY_KEYS` / `BASE_ENTRY_KEYS` | `api/_utils/__fixtures__/tickStampsHarness.js:79` / `:116-118` (unconditional lists; the flag-off suite requires them). |
| `agentEvalRuns` write from PR #896 | **Present** (merge `1ee84a07` is an ancestor of HEAD): `composeEvalRunRecord` `agent-evaluate.js:527-544`, write `db.collection('agentEvalRuns').doc(evalRun.runId).set(record)` `:561`, client-deny rules `firestore.rules:881-889`. |
| Other anchors the build uses | `shouldStartHaikuCall` `agentEvalTransport.js:167-176`; output ceiling `:59` (2,048); `getSessionForDate` `marketSchedule.js:177-203`, `MAINTAINED_HOLIDAY_YEARS = [2026, 2027]` `:77`; schedule `vercel.json:157-158` (`*/15 13,14,15,16,17,18,19,20,21 * * 1-5` for `/api/cron/agent-evaluate`); `intradayViews` rules `firestore.rules:448-452`; bench rows the prompt renders `agentEvalPromptAssembly.js:1168,1489-1516`, held rows = `assetScores` (`:1163-1165`); completion's transaction reads/writes the parent `agent-evaluate.js:5885-5895`. |

### 1.4 Readings recorded at the gate (no source conflict; stated so the review can check them)

1. **Transport-failed-after-prompt** is read as HEAD's own classification: `promptBuilt === true` and `haikuFailure` set after the call — timeout/HTTP error, `truncated_response` and `invalid_tool_result` alike (`:2729-2788`). Publication runs only from a tool result the trade validator **accepted** (`validation.valid`, `:2724-2725`).
2. **Phase key on the two excluded paths that still write an entry** (failed refresh, failed prompt build): at shadow/on they carry `declarationsPhase: 'none'`. This follows the contract of record (§2.1: the key is present on the entry whenever `CALL_RECORDS_MODE !== 'off'`) and spec §2 (presence on every path that writes an entry); the §3.4 matrix's "none written" is read as "`none` written" for those two and "nothing written" for the no-entry members of that row. No flips, no publication on either.
3. **Gameplan rows' examined set** = the held names the R11 deterministic pass evaluated with `applyGuardrails` (`:5078`), frozen inside the pass at that instant. A pass that returned before evaluating (no deployed guardrails, `:5069-5076`, or the executor flag off, `:5057`) examined nothing: no usable observation, so no flips on that exit (§3.8 requires one). *(Revised by review A-2: such an exit now stamps its own instant with an EMPTY examined set, so expiry runs and no hit can. See §8 and §11.6.)*
4. **Composition rows 3 and 4** are gated unavailable (no pilot registration), per spec §2.

Nothing above is a STOP: a stale anchor is a moved seam; every shape the spec reads is the shape HEAD has.

---

## 2. What was built (spec §3, in order)

| Step | Spec | Commit | What landed |
|---|---|---|---|
| 0 | inputs | `439cc0a1` | The spec, committed alone. |
| gate | §3.13 | `c2f1b883` | §0–§1 of this report, before any source change. |
| fixture | §3.12 row 1 | `20d207d7` | The frozen pre-change fixture (19 scenarios, captured from the untouched tree) and the calls store double. |
| 2.1 | §2 | `970a5a4d` | `CALL_RECORDS_MODE = 'off'`, `CALL_RECORDS_MODES`, `resolveCallRecordsMode()`, `callRecordsFlags.test.js`, `CALLS_ENTRY_KEYS`. |
| 2.2 | §3.1 | `60f070ea` | `buildTradeDecisionTool({ declarations })`. `TRADE_DECISION_TOOL` is the off build, the same object every import already holds. The validator is untouched. Output-size measurement. |
| 2.3 | §3.2 | `c1bab50b` | `callRecords/validate.js`: mapping, caps, ordinals, reason precedence. |
| 2.4 | §3.3–3.4 | `d9b95390` | `callsCtx` outside the `try`; detached quote copies at the three fetch sites; the eight observation seams; the executor result carried. |
| 2.5 | §3.5 | `9d97c82c` | `callRecords/horizon.js` and the `vercel.json` pin. |
| 2.6 | §3.6 | `4d3be008` | `callRecords/candidate.js`: built once, frozen, canonical form, evidence, provenance and origin. |
| 2.7 | §3.7 | `7a40302f` | `callRecords/publish.js`: the budget rule, the transaction (with the zero-open-call branch), the two-value wire, `callsDiag`, confirmed capture references, the admission reserve. |
| 2.8 | §3.8 | `3b21a2af` | `callRecords/flip.js` and `receipt.js`: the cursor-rotated scan, one transaction per call, the companion receipt, whole-trade `actedEvalId`, `callFlips`; hooks at every flip exit. |
| 2.9 | §3.9 | `966951fc` | Capture composition: `resolveCaptureSchema`, `CALL_KINDS`, allowlists, `calls`/`call()` on the live and NOOP contexts. |
| 2.10 | §3.10 | `9cda21d3` | Rules, the four rules suites, the `calls` composite index. |
| 2.11 | §3.12 | `f3046bcc`, `de80b1f5` | The remaining falsification rows (composition, quote shape, clock, prompts) and the mutation battery (§7). |
| review | BUILD_RULES §2 | `53fb58aa` | Schema: intent-only wording; deep-frozen; no shared nesting; honesty registry; both cost bounds (C-4, C-5, C-6, C-8). |
| review | | `ec19cd58` | Off golden: records every writer's arguments; handler-level finalize; SHA pin (C-2, C-9). |
| review | | `e87694a0` | The seven exact-key cron suites pin `CALL_RECORDS_MODE: 'off'`; runway text (C-1). |
| review | | `ca244f99` | Bounded stored record; blank optionals are absent; lone surrogates are malformed; the A-1 pin (E-2, A-4, A-3, E-4). |
| review | | `54e19147` | Deadline re-checks after the reads (E-1). Gameplan exits expire calls (A-2). No await at off (B-2). Removals in the phase log (B-4). Test integrity (D-1 to D-8). The E-3 pin. |
| review | | `2e87e1b6` | Publication's real-time rows hold under parallel load (D-2, second mode). |
| battery | §7 | `578135f4` | The calls store double refuses a runaway scan, so a cursor that never advances fails its row instead of hanging the worker. The mutation battery found this (§7). |

## 3. Files, with `file:line` (at build HEAD)

**The cron:** `api/cron/agent-evaluate.js`, **+180/−7** against `origin/main` (`git diff --numstat`). Every call-records site goes through `callsStep`/`callsStepAsync` (`api/_utils/callRecords/mode.js:85-104`), which is inert at off and isolated at shadow/on. The exit hooks and the model phase are not even awaited at off (review B-2).

| Seam | Line(s) |
|---|---|
| imports | `:38`, `:43-48`, `:109` |
| `callsCtx` declared outside the `try`; mode resolved once | `:907` |
| capture schema resolved once for the tick | `:915` |
| detached quote copies: initial fetch / hot-bench augmentation / catalyst augmentation | `:1037` / `:1446` / `:2480` |
| passive exit: observation; flips after its write | `:1284-1287`; `:1296` |
| proposal-pending: observation; flips | `:2317-2324`; `:2333` |
| gameplan-pending: the R11 pass's own observation (`:5255-5259`), or an empty examined set at the exit instant when the pass examined nothing (review A-2); flips | `:2360-2363`; `:2372` |
| gameplan-created: same; flips | `:2417-2420`; `:2428` |
| no-trigger: observation; flips | `:2550-2557`; `:2565` |
| admission reserve (48,000 ms at shadow/on; 44,000 at off) | `:2626` |
| budget-skipped observation | `:2654-2661` |
| model seam: observation at `Date.parse(promptBuiltAt)` | `:2734-2740` |
| the tool the model receives | `:2780` |
| truncation event (`stop_reason === 'max_tokens'`) | `:2826-2832` |
| declarations detached and validated from an ACCEPTED tool result | `:2850-2855` |
| committed executor result carried | `:3579` |
| entry exit classified; `declarationsPhase` stamped (`none` \| `expected`) | `:4143-4146` |
| the evaluation commit (`battleRef.update(finalUpdate)`) | `:4383` |
| evaluation identity recorded, only now | `:4386` |
| the calls phase: model row → publication, flips and one status write; budget-skipped and transport-failed rows → flips | `:4399-4408` |
| confirmed capture references recorded, before capture finalizes in the `finally` | `:4411-4413` |
| R11 pass takes `callsCtx` (the pin string in `agent-evaluate.suppressionPass.test.js` updated, same intent) | `:5220`, `:5255-5259` |

**New modules** in `api/_utils/callRecords/`:
- `mode.js`: mode, context, `callsStep`.
- `validate.js` (§3.2): `removedRecordFields` `:197`, the stored-record cap `:294-309`.
- `observe.js` (§3.3–3.4): `freezeObservation` `:88`, first seam wins.
- `horizon.js` (§3.5).
- `candidate.js` (§3.6): `resolveProvenance` `:97`, `buildMintCandidate` `:185`.
- `publish.js` (§3.7):
  - `callsBudget` `:89-98`
  - `publishDeclarations` `:126-216`, with deadline checks at `:148` (attempt start), `:167` (before the queue read) and `:177` (before the first write)
  - `removedLogToken` `:224`
  - `composeCallsDiag` `:235`
  - `writeCallsStatus` `:255`
  - `runModelCallsPhase` `:290-364`
- `flip.js` (§3.8):
  - `decideFlip` `:82`
  - `matchesWholeTrade` `:105`
  - `planFlip` `:129`
  - `flipOne` `:165-205`, with deadline checks at `:174` and `:184`
  - `runCallFlips` `:217-319`
  - `runExitCallsHook` `:331-359`
- `receipt.js` (§3.8 receipt).

**Changed (non-fenced):**
- `api/_utils/agentEvalToolSchema.js`: the literal is renamed `TRADE_DECISION_TOOL_BASE` with its line numbers preserved; the deep-frozen `DECLARATIONS_PROPERTY` `:233` and the builder `:363` are appended; the on-tool is built from its own structured clone (`:344-354`).
- `api/_utils/agentEvalTransport.js:165-183`: `callsReserveMs`, default 0.
- `api/_utils/tickCapture/{captureConfig,captureSerializer,captureContext,captureWriter}.js`.
- `src/config/featureFlags.js`: the flag and its docstring, appended.
- `firestore.rules`, `firestore.indexes.json`.
- `api/_utils/compositionProtectedStoresAllowlist.json`: five reviewed rows.
- `api/_utils/__fixtures__/tickStampsHarness.js`: `CALLS_ENTRY_KEYS`, `makeDeclarations`, `makeMaximalDeclarations`, `makeObservation`, `makeExecutorResult`.
- `api/_utils/__fixtures__/promptHonestyRegistry.js`: the schema module registered (review C-8).
- Seven cron test mocks pin `CALL_RECORDS_MODE: 'off'` (review C-1).

**Fence.** `git diff origin/main HEAD --name-only` ∩ BUILD_RULES §1 = **∅**. Fenced functions are **called, never edited**:
- `executeSwapServer` (`agentSwapExecution.js`) keeps its existing call sites. Its awaited return is only *read* (`closedTrade.{symbolOut,symbolIn,tier,slotIndex}`).
- `flattenPortfolioServer` and `flattenBenchServer`, defined in the fenced **`agentScoring.js:36`, `:57`** and imported by the cron (`agent-evaluate.js:25-29`), are called to name the examined sets.
- `applyGuardrails` (`agentGuardrails.js`) is called by the existing R11 pass exactly as before.

One non-fenced helper is also called: `selectBattleUniverse` (`src/data/battleUniverse.js`), which freezes the fork-option universe at the model seam.

**The schema extension is fenced-class under contract §2** and was reviewed as such (§8, lens C). It touches no fenced file.

## 4. The invariants that fail the build if broken

| Invariant | Held by (test) | Mutation that proves the test can fail |
|---|---|---|
| At off, byte-identical to the frozen pre-change fixture under injected clocks and ids: the tool schema, every battle write on every exit, every prompt byte, both capture outputs, and the serialized arguments of the writers the 19 scenarios invoke: `executeSwapServer`, `captureSwapReceipt` and `generateTradeNarration` (4 calls each), and `logEvaluation` (11). `reserveSymbol`, `confirmSwap`, `releaseReservation`, `generateAnticipation`, `logVisionTransition` and `logAnticipation` are invoked in no scenario (0 calls each). For them the proof is that they stay uncalled, not that their arguments are unchanged. Arguments are compared as JSON recorded after the scenario, with the database handle and the battle object replaced by placeholders; a transient change during the call, or an omitted or non-JSON value, is outside the comparison (review BR-6). | `agent-evaluate.callRecords.offGolden.test.js`: 19 scenarios × updates/prompts/capture/writer arguments/summary/thrown; golden SHA-256 pinned | M1a, M1b, M1c, MSa, RC2 |
| At off, existing calls / declarations / receipts / queue documents are neither read nor written | offGolden (seeded store, `callsTouches` = 0 on every scenario); callsOn row-5 "off: … rollback fixture" | M1c |
| No `merge` on a call | `publish.test.js` "…writes nothing with merge on a call" and the stray-call conflict row; flip writes are `update`s of mutable fields only | M7b, M9o |
| No fabricated `evalId` on a no-entry path | callsOn row 5 (every no-entry exit: `callFlips.evalId` null, no `evalSeq`/`declarationsPhase` in any write); `flip.test.js` non-model hook row | M5b |
| No observation reconstructed outside its seam | `observe.test.js` "the first seam wins"; callsOn row 4 (each of the **eight** exits its own instant and source) | M4b, M4c |
| No hit on the minting check | `flip.test.js` "never a hit on the minting check"; callsOn "a call minted by THIS check is never flipped by it", which asserts the minting guard itself fired (`skipped: { minting_check: 2 }`) | M9a, RD8 |
| No `actedEvalId` without a whole-trade executor match | `flip.test.js` whole-trade rows (wrong counterpart / slot / swapOut / opposite leg / no executor / non-model exit); callsOn row 9 (capture on and off, blocked swap, wrong counterpart, proposal pending); callsOn row 3 (a risk-loop swap is never an act) | M9f, M9g, M9h, M9i, M9j |
| No `written` before the commit returned; no commit issued after the deadline | `publish.test.js` "`written` never precedes the commit", the timeout rows, and the two slow-read rows | M8a, M8c, RE1a, RE1b |
| Only finite instants in the queue | `publish.test.js` "never Infinity / null / undefined in the queue" | M7f |
| Diff ∩ BUILD_RULES §1 = ∅ | `git diff origin/main HEAD --name-only` (§3) | — |

## 5. The composition proof (contract §9, four rows)

Tested in `agent-evaluate.tickStamps.callsOn.test.js` "§3.12 row 1" with **every other flag at its HEAD value**: the featureFlags mock overrides only `CALL_RECORDS_MODE` and holds `TICK_CAPTURE_ENABLED` on. The unit rows are in `captureComposition.calls.test.js`.

| calls | pilot | tool schema | capture record (registered version) | calls data | Status |
|---|---|---|---|---|---|
| off | off | the `TRADE_DECISION_TOOL` object itself (identity) | version 1, **no `calls` key**; byte-identical to the frozen fixture | zero reads, zero writes (rollback fixture) | **TESTED** |
| shadow/on | off | plus exactly one property, `declarations` | version 2 on **both** documents; `calls[]` = confirmed references | minted, flipped, referenced | **TESTED** |
| off | on | — | — | — | **UNAVAILABLE**: no pilot flag or capture registration exists at the baseline (§1.3). `resolveCaptureSchema` refuses (`available: false`, `pilot_unregistered`) and the writer emits nothing (`serialize_failed`). It never borrows a version. |
| shadow/on | on | — | — | — | **UNAVAILABLE**: same. |

The emitted schema is resolved **once** per tick (`agent-evaluate.js:915`) and stored on the capture context. **Both** composers read it: the `captureWriter.js` body and the permanent document (`schemaVersion: schema.version`). This holds on either finalize path: the tick's own `finally`, and the handler's finalize for an errored tick.

## 6. Margins, stated separately

**Output size (tokens, against the 2,048-token ceiling, `agentEvalTransport.js:59`).**
- Measured in `agentEvalToolSchema.declarations.test.js` on the shadow fixtures.
- chars/4 is the repo's convention; chars/3 is the pessimistic bound.
- The observed response distribution is the DR-13 baseline: mean ≈ 907, p99 ≈ 1,240.

| Block | Serialized | Tokens | Headroom vs mean | Headroom vs p99 |
|---|---|---|---|---|
| typical (two shots, one watched) | 498 chars | 125 | **+1,016** | **+683** |
| maximal (every cap at its limit) | 4,338 chars | 1,085 (1,446 at chars/3) | **+56** | **−277** |

The negative cell is stated, not hidden: a p99 response carrying a maximal block exceeds the ceiling. Shadow counts `stop_reason === 'max_tokens'` as a truncation event (`agent-evaluate.js:2826-2832`, `cronState.callsDiag.truncated`).
- **A malformed block cannot change a trade.** The trade validator walks only the off-schema properties, and a bad block is removed by the calls validator alone.
- **A large block can change a trade.** This is a measured risk, not a guarantee (review C-3). There are two paths:
  - **Truncation.** A response with no `tool_use` block takes HEAD's `truncated_response` path to the fallback HOLD. DR-13 recorded that production truncations kept a partial `tool_use` with the early fields intact, and the schema lists `declarations` last. Nothing enforces the model's key order, however.
  - **Latency.** A typical block adds 125 output tokens and a maximal one up to 1,085. The unchanged 20 s SDK / 22 s backstop ceilings then see more timeouts.
- The shadow read measures both paths against a rollback trigger (§10).

**Input cost (review C-5).** +4,154 chars of tool schema per model call at shadow/on; zero at off. (The C-4 wording measured +3,874 chars, 969 / 1,292 tokens; branch review BR-3's stored-only wording adds 280 chars, §13.)
- **1,039 tokens at chars/4, 1,385 at chars/3**, both pinned.
- The maximal eval request (the M7-E2E fixture) goes from **9,093 to 10,132 tokens** at chars/4, against the 12,000 input budget. That shadow-tool row is now in `composition.m7e2eBudget.test.js`.
- The budget is defined at chars/4. At chars/3 the *off* request already reads 12,122. A real `countTokens` measurement is on the pre-flip checklist.

**Wall time (ms, on the shared handler clock `TIME_BUDGET_MS = 290,000`).**

| Quantity | Value | Where |
|---|---|---|
| Admission requirement, model path | 44,000 at off (unchanged) → **48,000** at shadow/on. This is an intentional scheduling effect: a battle reached with 44–48 s left is `budget_skipped` at shadow where it would have run at off. | `agentEvalTransport.js:173-183`, `publish.js:81-83` |
| Protected tail | 12,000. Every calls hook's deadline is clipped to `handlerStart + 290,000 − 12,000`; the platform kill buffer is never used. | `publish.js:56`, `:89-98` |
| Model-path phase | Runs only at `available ≥ 4,000`, ≤ 4,000 in total: publication tx ≤ 3,000, existence re-read slice 500, status slice 500; the flips share the same deadline. Below 4,000 it still makes one **status-only write** (≤ 1,000, inside the tail boundary; review B-3). | `publish.js:290-364` (status-only `:299-310`) |
| Non-model flip hook | Runs only at `available ≥ 2,000`, ≤ 2,000 in total (status slice 500). | `flip.js:331-359` |
| One flip transaction | ≤ 800, never started past the deadline; no commit is issued once the ceiling has passed (review E-1). | `flip.js:52`, `:165-205` |
| Worst case added per check | model row 4,000; any other flip row 2,000; excluded rows 0; at off 0 | — |

**What the tail does and does not protect (review B-1, partly confirmed).**
- **Tail vs the anticipation gate.** 12,000 equals the anticipation batch's strict gate (`remainingBudget > 12_000`, `agent-evaluate.js:4474`); it does not exceed it. It is also less than one narration (10 s abort) plus capture's 10,000 floor (`captureConfig.js:81`).
- **When a skip happens.**
  - A calls phase that runs to its deadline leaves `12,000 + (available − P)`, where P is the phase's duration (≤ 4,000 on the model row, ≤ 2,000 on others).
  - With narrations queued, the anticipation batch and/or capture are skipped where off would have run them **exactly when, on off's timeline, what remains after the narrations falls in (12,000, 12,000 + P]**. The phase's P then takes it to 12,000 or below.
  - Without narrations the window is about 1 ms wide.
- **Off has the same limit.** Off has the same worst case for its own marginal battle: the verifier reproduced identical outcomes for a battle off admits at 44 s and one shadow admits at 48 s.
- **What is at risk.** Only the lowest-priority surfaces: anticipation skips are logged (`cron_budget_skip`) and capture gaps are counted (`skipped_budget`). The shadow read reports both (R3-3's "report forfeited coverage honestly").
- **Status.** The code conforms to §3.7, and R3-3 accepted the 12,000 tail. Whether to widen it is an optional question for the spec owner.

## 7. The falsification suite (§3.12) and the mutation table

Every §3.12 row below names the mutation that proves its test can fail. Each mutant is one exact-string edit, applied alone to a `git archive` snapshot of build HEAD, with its named test files run and the file then restored byte-exact (sha256-checked). The runner refuses a git checkout, so the shared working tree is never touched (BUILD_RULES §2 reviewer isolation; this is the mutating lens, run last). Rows `R…` are the review fixes' own guards. The three `-emu` rows ran `npm run test:rules` against a mutated copy of `firestore.rules`, at `de80b1f5`. `firestore.rules` and the four emulator suites are unchanged since then (`git diff de80b1f5 HEAD -- firestore.rules test/rules` is empty).

**A finding of the battery itself.** Its first run, at `2e87e1b6`, stopped at M9m (no document-id tie-break). Under that mutant the new 120-call row did not fail; it spun forever. The double resolves queries on microtasks and the row freezes `Date`, so no timer could fire. The fix (`578135f4`) makes the store double throw after 400 queries. M9m is now killed in about 2 s, and the runner now kills a hung mutant's whole process group and records it as an error, never a kill. The battery below ran in full at build HEAD. Two rows first missed their target string (RA2a: indentation; RC2: matched twice). Corrected, they ran separately on the same snapshot.

**Result: 78/78 source mutants killed; plus 3/3 rules mutants under the emulator.**

| Row | ID | Mutation (applied alone to a snapshot of build HEAD, then restored byte-exact) | File | Result | First test that went red |
|---|---|---|---|---|---|
| 1 | M1a | tool schema ignores the mode (declarations always on) | `agent-evaluate.js` | **KILLED** (10 failing) | offGolden › completed_hold: every battle write, every prompt byte and both capture documents are byte-identical; the seeded call records are neither … |
| 1 | M1b | capture schema at calls-off emits version 2 + calls[] | `captureConfig.js` | **KILLED** (21 failing) | offGolden › completed_hold: every battle write, every prompt byte and both capture documents are byte-identical; the seeded call records are neither … |
| 1 | M1c | off is not inert: callsActive() returns true for every mode | `mode.js` | **KILLED** (19 failing) | offGolden › completed_hold: every battle write, every prompt byte and both capture documents are byte-identical; the seeded call records are neither … |
| 1 | M1d | the pilot rows claim a version (resolver emits pilot rows as available) | `captureConfig.js` | **KILLED** (3 failing) | callsOn › rows 3–4 — pilot on (calls off / on): UNAVAILABLE at this baseline, reported and never claimed |
| 2 | M2a | declarationsPhase registered in BASE_ENTRY_KEYS | `tickStampsHarness.js` | **KILLED** (1 failing) | callsOn › the key lives in its own list — never in the unconditional TIMING or BASE lists |
| 2 | M2b | the entry stamps expected whatever the block | `agent-evaluate.js` | **KILLED** (23 failing) | callsOn › shadow · model_result_hold_no_block: the entry carries declarationsPhase 'none' as its LAST key, and nothing undefined |
| 2 | M2c | the mode is re-resolved mid-check at the tool seam (not carried in callsCtx) | `agent-evaluate.js` | **KILLED** (1 failing) | callRecordsFlags.test.js › the cron resolves the mode ONCE per check, through the resolver, and never reads the constant itself |
| 3 | M3a | the detached copy stores {px} instead of {current} (the R3-1 shape bug) | `observe.js` | **KILLED** (23 failing) | callsOn › model_result: the open call flips on THIS exit's observation — receipt from 'model_prompt', nothing published |
| 3 | M3b | a fallback quote is admitted (helper bypassed) | `observe.js` | **KILLED** (1 failing) | observe.test.js › px is projected from `current`; a fallback quote, a non-positive quote and a quote fetched after the instant are all excluded |
| 3 | M3c | replacedInPrompt dropped | `observe.js` | **KILLED** (3 failing) | callsOn › a forced-entry-price symbol observes its FETCHED quote, marked replacedInPrompt — never the execution price |
| 4 | M4a | fetchedAtMs <= observedAtMs no longer enforced | `observe.js` | **KILLED** (2 failing) | observe.test.js › px is projected from `current`; a fallback quote, a non-positive quote and a quote fetched after the instant are all excluded |
| 4 | M4b | the no-trigger exit reuses the initial handler instant | `agent-evaluate.js` | **KILLED** (2 failing) | callsOn › a call expiring AFTER the initial quote-health instant but BEFORE the exit resolves expired at the exit instant — never a hit at the health… |
| 4 | M4c | an observation is reconstructed at a later seam (freeze-once removed) | `observe.js` | **KILLED** (1 failing) | observe.test.js › the first seam wins; a later seam on the same check does not replace it |
| 5 | M5a | the no-trigger exit loses its flip hook | `agent-evaluate.js` | **KILLED** (3 failing) | callsOn › no_trigger: the open call flips on THIS exit's observation — receipt from 'no_trigger', nothing published |
| 5 | M5b | a no-entry exit fabricates an evalId | `flip.js` | **KILLED** (9 failing) | callsOn › no_trigger: the open call flips on THIS exit's observation — receipt from 'no_trigger', nothing published |
| 5 | M5c | budget-skipped / transport-failed rows lose their flips | `agent-evaluate.js` | **KILLED** (3 failing) | callsOn › transport_failed: the open call flips on THIS exit's observation — receipt from 'model_prompt', nothing published |
| 6 | M6a | no admission reserve (44,000 at shadow) | `publish.js` | **KILLED** (2 failing) | callsOn › admission: 46 s left admits the model at off (44,000 required) and skips it at shadow (48,000 required) |
| 6 | M6b | the protected tail is spendable (TAIL_RESERVE_MS = 0) | `publish.js` | **KILLED** (2 failing) | callsOn › the phase is skipped at available < 4,000 with a narration queued: the narration still dispatches, nothing is published, the wire says fail… |
| 6 | M6c | non-model hooks ignore the available >= 2,000 rule | `flip.js` | **KILLED** (3 failing) | callsOn › a gameplan-pending exit reached with < 2,000 ms available: the narration dispatches, the flip hook never starts — the BUDGET rule says so (… |
| 6 | M6d | the model path ignores the available >= 4,000 rule | `publish.js` | **KILLED** (3 failing) | callsOn › the phase is skipped at available < 4,000 with a narration queued: the narration still dispatches, nothing is published, the wire says fail… |
| 6 | M6e | the deadline is not clipped to the tail boundary | `publish.js` | **KILLED** (2 failing) | publish.test.js › model path: runs only at available ≥ 4,000; the deadline is min(now + 4,000, the tail boundary) |
| 7 | M7a | the parent status / committed-evalSeq check removed | `publish.js` | **KILLED** (2 failing) | publish.test.js › a completion committing between the parent read and the commit aborts the attempt; the retry reads `completed` → parent_terminal, n… |
| 7 | M7b | a call written with set(merge) instead of create | `publish.js` | **KILLED** (1 failing) | publish.test.js › publishes the record and every call create-once, arms the queue with the open calls' minimum, and writes nothing with merge on a ca… |
| 7 | M7c | the queue read/armed even with zero open calls | `publish.js` | **KILLED** (2 failing) | publish.test.js › declarations-only (watching / playerAsk): the record alone — no queue read, no queue write, an existing queue left unchanged |
| 7 | M7d | the queue arms the maximum, not the minimum | `publish.js` | **KILLED** (2 failing) | publish.test.js › publishes the record and every call create-once, arms the queue with the open calls' minimum, and writes nothing with merge on a ca… |
| 7 | M7e | an identical retry is not idempotent (treated as a conflict) | `publish.js` | **KILLED** (1 failing) | publish.test.js › an identical retry is idempotent success: nothing written, the queue untouched |
| 7 | M7f | a non-finite / null queue instant can be persisted | `publish.js` | **KILLED** (3 failing) | publish.test.js › declarations-only (watching / playerAsk): the record alone — no queue read, no queue write, an existing queue left unchanged |
| 8 | M8a | a timeout with nothing found says written | `publish.js` | **KILLED** (4 failing) | publish.test.js › late-timeout variant: the attempt outlives the deadline while completion lands — the re-read finds nothing (failed, per-id unconfir… |
| 8 | M8b | an un-re-readable timeout overwrites the wire with failed | `publish.js` | **KILLED** (2 failing) | publish.test.js › no attempt starts after the deadline: a contended retry past it refuses before reading |
| 8 | M8c | the wire says written whatever the publication did | `publish.js` | **KILLED** (1 failing) | callsOn › shadow, a conflicting publication: nothing confirmed, so nothing referenced |
| 8 | M8d | a third wire value leaks (phaseResult written to the wire) | `publish.js` | **KILLED** (1 failing) | callsOn › shadow, a conflicting publication: nothing confirmed, so nothing referenced |
| 9 | M9a | the minting check can hit its own calls | `flip.js` | **KILLED** (3 failing) | callsOn › a call minted by THIS check is never flipped by it (publication then flips, same check) — skipped by the MINTING guard itself (review D-8) |
| 9 | M9b | observedAtMs <= mintedAt no longer skipped | `flip.js` | **KILLED** (2 failing) | flip.test.js › not open / minting check / observation at or before the mint / nothing to do |
| 9 | M9c | exact expiry treated as expired (>= instead of >) | `flip.js` | **KILLED** (1 failing) | flip.test.js › expiry wins outside the horizon; the exact expiry instant is still inside it |
| 9 | M9d | a stale open read overwrites (the transaction trusts the page read) | `flip.js` | **KILLED** (3 failing) | flip.test.js › not open / minting check / observation at or before the mint / nothing to do |
| 9 | M9e | the receipt is not created with the transition | `flip.js` | **KILLED** (18 failing) | callsOn › model_result: the open call flips on THIS exit's observation — receipt from 'model_prompt', nothing published |
| 9 | M9f | entry match ignores the declared counterpart | `flip.js` | **KILLED** (3 failing) | callsOn › a declared counterpart the swap did not take (AMD for PG) → no act |
| 9 | M9g | match ignores the resolved slot (tier) | `flip.js` | **KILLED** (4 failing) | flip.test.js › entry: incoming symbol + resolved slot + declared counterpart |
| 9 | M9h | pick match ignores swapOut | `flip.js` | **KILLED** (1 failing) | flip.test.js › pick: incoming option + declared swapOut + resolved slot (+ the selected option when bound) |
| 9 | M9i | exit match accepts the opposite leg | `flip.js` | **KILLED** (1 failing) | flip.test.js › exit: outgoing symbol + resolved slot + declared counterpart |
| 9 | M9j | actedEvalId from a non-model exit | `flip.js` | **KILLED** (1 failing) | flip.test.js › a non-model exit never sets it, even with an executor result in the context |
| 9 | M9k | no wraparound (the head leg is never scanned) | `flip.js` | **KILLED** (3 failing) | flip.test.js › wraparound: resume after the persisted cursor to the end, then the start up to the cursor — each call once |
| 9 | M9l | the cursor is never persisted (always restart) | `flip.js` | **KILLED** (4 failing) | flip.test.js › deadline interruption: complete false, the cursor at the last examined call; the next check resumes after it with ITS OWN observation |
| 9 | M9m | no document-id tie-break in the scan | `flip.js` | **KILLED** (5 failing) | callRecordsRulesIndex.test.js › the exported FLIP_QUERY describes the same query the scan issues |
| 9 | M9n | an existing actedEvalId is rewritten | `flip.js` | **KILLED** (1 failing) | flip.test.js › an existing actedEvalId is never rewritten |
| 9 | M9o | a call write carries an immutable field (said rewritten) | `flip.js` | **KILLED** (1 failing) | flip.test.js › an answered call keeps its playerResponse and outcome fields; the flip only adds the receipt reference |
| 10 | M10a | the calls composite removed from firestore.indexes.json | `firestore.indexes.json` | **KILLED** (2 failing) | callRecordsRulesIndex.test.js › the query the scan ISSUES needs exactly calls: state ASC, mintedAt ASC, __name__ ASC — and the file has it |
| 10 | M10b | the calls composite reshaped (mintedAt DESCENDING) | `firestore.indexes.json` | **KILLED** (1 failing) | callRecordsRulesIndex.test.js › the query the scan ISSUES needs exactly calls: state ASC, mintedAt ASC, __name__ ASC — and the file has it |
| 11 | M11a | the slot table drifts from vercel.json (hourly minutes 0/30) | `horizon.js` | **KILLED** (7 failing) | horizon.test.js › the expanded slot table IS that expression (minute × hour × day-of-week, UTC) |
| 11 | M11b | the close-equality slot becomes eligible | `horizon.js` | **KILLED** (5 failing) | horizon.test.js › a normal RTH day has 26 slots, 09:30 → 15:45 ET (EDT: 13:30Z → 19:45Z) |
| 12 | M12a | a missing promptBuiltAt becomes the current time | `candidate.js` | **KILLED** (1 failing) | candidate.test.js › a missing promptBuiltAt → priceAsOf null — never the current time |
| 12 | M12b | legacy provenance (no version) collapses to null / initiative | `candidate.js` | **KILLED** (2 failing) | candidate.test.js › LEGACY: a frozen watchlist + a config hash, no version → { watchlistId, equippedConfigHash }, equipped |
| 12 | M12c | capture-off evidence claims availability unresolved | `candidate.js` | **KILLED** (3 failing) | callsOn › capture off: evidence carries tickId null / availability off — the calls do not depend on capture |
| 13 | M13a | clients may write calls | `firestore.rules` | **KILLED** (1 failing) | callRecordsRulesIndex.test.js › agentBattles/{battleId}/calls/{callId}: ONE block — owner read via the parent, no client write |
| 13 | M13b | any signed-in client may read the sweep queue | `firestore.rules` | **KILLED** (1 failing) | callRecordsRulesIndex.test.js › callSweepQueue/{battleId}: ONE top-level block, server-only — `allow read, write: if false;` |
| S | MSa | the off tool gains the declarations property | `agentEvalToolSchema.js` | **KILLED** (8 failing) | offGolden › the tool schema is byte-identical to the frozen constant |
| S | MSb | a present non-finite level is treated as malformed (not invalidated) | `validate.js` | **KILLED** (1 failing) | validate.test.js › \|level − px\| / px > 0.25 → level_implausible; exactly 0.25 is plausible |
| R | RE1a | E-1: publication reads after the deadline, then reads the queue anyway | `publish.js` | **KILLED** (1 failing) | publish.test.js › the first reads return after the deadline: no queue read starts, no commit is issued — the failed wire is true |
| R | RE1b | E-1: publication commits after reads that outlasted the deadline | `publish.js` | **KILLED** (1 failing) | publish.test.js › the queue read returns after the deadline: still no commit — nothing lands behind the failed wire |
| R | RE1c | E-1: a flip commits after reads that outlasted its 800 ms ceiling | `flip.js` | **KILLED** (1 failing) | flip.test.js › reads that outlast the 800 ms ceiling issue no commit: the flip is unconfirmed, the call stays open, no receipt (review E-1) |
| R | RD3 | D-3: the flip reads outside its transaction (no conflict set) | `flip.js` | **KILLED** (3 failing) | flip.test.js › a sweep resolves the call after the transaction read it: the attempt conflicts, the retry reads it closed — no transition, no receipt |
| R | RD4a | D-4: the persisted cursor is ignored (every check restarts) | `flip.js` | **KILLED** (4 failing) | flip.test.js › wraparound: resume after the persisted cursor to the end, then the start up to the cursor — each call once |
| R | RD4b | D-4: page cursors drop the document-id tie-break | `flip.js` | **KILLED** (3 failing) | flip.test.js › wraparound: resume after the persisted cursor to the end, then the start up to the cursor — each call once |
| R | RD4c | D-4: the head leg ends at the mint instant only (no id) | `flip.js` | **KILLED** (2 failing) | flip.test.js › wraparound: resume after the persisted cursor to the end, then the start up to the cursor — each call once |
| R | RD5 | D-5: publication reads after its first write | `publish.js` | **KILLED** (18 failing) | publish.test.js › publishes the record and every call create-once, arms the queue with the open calls' minimum, and writes nothing with merge on a ca… |
| R | RA2a | A-2: gameplan_pending with no examined pass freezes no observation | `agent-evaluate.js` | **KILLED** (1 failing) | callsOn › gameplan_pending with no deployed guardrail: the pass examined nothing — an EMPTY observation at the exit instant; expiry runs, no hit can … |
| R | RA2b | A-2: gameplan_created with no examined pass freezes no observation | `agent-evaluate.js` | **KILLED** (1 failing) | callsOn › gameplan_created with no deployed guardrail: the pass examined nothing — an EMPTY observation at the exit instant; expiry runs, no hit can … |
| R | RA3a | A-3: a blank counterpart removes the shot | `validate.js` | **KILLED** (1 failing) | validate.test.js › a BLANK optional string (counterpart, playerAsk symbol) is absent too — the key dropped, the row kept (review A-3) |
| R | RA3b | A-3: a blank playerAsk symbol removes the ask | `validate.js` | **KILLED** (1 failing) | validate.test.js › a BLANK optional string (counterpart, playerAsk symbol) is absent too — the key dropped, the row kept (review A-3) |
| R | RE4 | E-4: a lone surrogate passes as text | `validate.js` | **KILLED** (1 failing) | validate.test.js › a string with a LONE surrogate is malformed wherever text is required — it cannot be stored as UTF-8; a surrogate PAIR is text (re… |
| R | RE2a | E-2/A-4: the 16 KB cap measures the typed block alone | `validate.js` | **KILLED** (2 failing) | candidate.test.js › a block just under 16 KB by itself: the removals and identity push the RECORD over, so the crossing row is removed oversize (revi… |
| R | RE2b | E-2: the cap forgets the identity/minted allowance | `validate.js` | **KILLED** (1 failing) | candidate.test.js › a block that fits with its removal list but not with its identity and minted list: the crossing row is removed oversize (the allo… |
| R | RE2c | E-2: the stored removal list is unbounded | `validate.js` | **KILLED** (6 failing) | candidate.test.js › 1 valid shot + 300 empty rows: the stored record stays ≤ 16 KB, every valid call is kept, every removal is accounted for |
| R | RB4 | B-4: the phase log line drops the removals | `publish.js` | **KILLED** (1 failing) | publish.test.js › the phase log line carries the removals per check — a malformed or fully removed block stays readable after callsDiag is overwritte… |
| R | RC2 | C-2: the model SWAP hands the executor a changed evaluationMetadata at off | `agent-evaluate.js` | **KILLED** (1 failing) | offGolden › completed_swap: every battle write, every prompt byte and both capture documents are byte-identical; the seeded call records are neither … |
| R | RC6 | C-6: the on-tool shares the off tool's nested objects | `agentEvalToolSchema.js` | **KILLED** (1 failing) | agentEvalToolSchema.declarations.test.js › the property is DEEP-frozen, and the on-tool shares no object with the off tool (review C-6) |
| R | RD1 | D-1: a late non-model exit ignores the available >= 2,000 rule (end to end) | `flip.js` | **KILLED** (1 failing) | callsOn › a gameplan-pending exit reached with < 2,000 ms available: the narration dispatches, the flip hook never starts — the BUDGET rule says so (… |
| R | RD8 | D-8: the minting guard removed (end to end) | `flip.js` | **KILLED** (1 failing) | callsOn › a call minted by THIS check is never flipped by it (publication then flips, same check) — skipped by the MINTING guard itself (review D-8) |
| 13 | M13a-emu | clients may write `calls`, run against the Firestore emulator (`COMPOSITION_RULES_TEXT_PATH` → mutated copy) | `firestore.rules` | **KILLED** (4 failing / 11) | callsDenials.rules.mjs › the owner cannot create, update, merge or delete |
| 13 | M13b-emu | any signed-in client may read `callSweepQueue` (emulator) | `firestore.rules` | **KILLED** (4 failing / 11) | callSweepQueueDenials.rules.mjs › the owner of the keyed battle cannot READ a queue document |
| 13 | M13c-emu | any signed-in client may read `declarations`, owner check dropped (emulator) | `firestore.rules` | **KILLED** (4 failing / 11) | declarationsDenials.rules.mjs › another authenticated user is denied the document and the collection |

## 8. Review (BUILD_RULES §2)

**Method.**
- Five independent lenses (A to E below) each reviewed a `git archive` snapshot of `de80b1f5`, with `node_modules` symlinked and read-only on git and the working tree. The lenses were spec and contract conformance, cron wiring and budget, the flag-off guarantee (with the schema reviewed as fenced-class), test integrity, and Firestore semantics and security.
- Every finding was then handed to a **separate verifier** told to *refute* it with a concrete repro, each on its own snapshot. The E verifier ran the real `@google-cloud/firestore` 7.11.6 transaction runner against an in-memory backend.
- The mutating lens is the battery in §7, run last on its own snapshot of build HEAD.

**Tally: 31 findings.** **30 CONFIRMED, 1 PARTLY CONFIRMED (B-1), none refuted outright.** The verifiers did refute parts of findings:
- B-1's "leaves exactly 12,000" is true only with zero slack.
- D-8's mechanism was misworded.
- Three severities were lowered: B-1 and E-2 from P2 to P3, and D-4 from P2 to P3.

They widened three findings: A-4 (the uncapped removal list), D-2 (a second flake mode) and E-1 (the queue read). Two CONFIRMED findings are spec-level and wait on founder rulings (A-1, E-3). One is performance-only and deferred (E-5).

| ID | Severity (reviewer → verified) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| A-1 | P2 → P2 (spec-level) | Every battle created with the manifest write on carries `equippedConfigHash` even with no watchlist, so as specified every such call mints `provenance_unresolved / hash_without_watchlist`. `agent_initiative` is reachable only by battles created before the flag. | CONFIRMED | **Not changed; founder ruling needed before the shadow flip.** The code follows spec §3.6 and contract §4 as written, and `origin` is immutable. Pinned against the real manifest builder (`candidate.test.js`, "A REAL battle manifest…", `ca244f99`). |
| A-2 | P3 → P3 | The gameplan exits froze no observation when the R11 pass returned early, so not even expiry ran. | CONFIRMED | **Fixed** `54e19147`: the exit stamps its own instant with an empty examined set (`agent-evaluate.js:2360-2363`, `:2417-2420`), so expiry runs and no hit can. callsOn rows; RA2a/RA2b killed. |
| A-3 | P3 → P3 | A blank optional string (`counterpart`, `playerAsk.symbol`) removed the whole row. | CONFIRMED | **Fixed** `ca244f99`: a blank optional is absent (`validate.js:107`); a blank required string is still malformed. RA3a/RA3b killed. |
| A-4 | P3 → P3 (broader) | The 16 KB cap measured the typed block, not the stored record, and the removal list was uncapped (1,000 blank `watching` → 55 KB record). | CONFIRMED | **Fixed** with E-2. |
| A-5 | P3 → P3 | Report accuracy: the flatten helpers were cited to the wrong module, `selectBattleUniverse` was listed among fenced calls, and one row was mis-credited. | CONFIRMED | **Fixed** in this report (§3, §4). |
| B-1 | P2 → **P3** | The 12 s tail equals the anticipation gate, so a phase that runs to its deadline can skip anticipations or capture where off would run them. | **PARTLY CONFIRMED** | The code conforms to §3.7, and off has the same worst case for its marginal battle. "Leaves exactly 12,000" holds only with zero slack; the real window is P wide. **Disclosed** in §6; no code change. |
| B-2 | P3 → P3 | Six `await callsStepAsync` at off each cost one microtask turn. | CONFIRMED (informational) | **Fixed** `54e19147`: not awaited at off. |
| B-3 | P3 → P3 | Report accuracy: the diff stat, anchors, and the skipped-budget status-only write. | CONFIRMED | **Fixed** in this report (§3, §6). |
| B-4 | P3 → P3 | `callsDiag` is overwritten by every later check, and malformed / fully-removed reasons lived only there. | CONFIRMED (+ extension) | **Fixed** `54e19147`: the `[calls] phase` log line carries `removed=` per (source, reason) (`publish.js:224`, `:308`, `:362`). The shadow read sources are corrected (§10). |
| C-1 | P1 → P1 | The documented flip (value plus pin) turned 17 tests red in 7 suites (`+ "declarationsPhase"`), and flagPinGuard cannot see a string flag. | CONFIRMED | **Fixed** `e87694a0`: the seven suites pin `CALL_RECORDS_MODE: 'off'`; runway text updated; **flip dry run** in §9. |
| C-2 | P2 → P2 | The off golden did not compare arguments to mocked writers. The verifier's mutant in the model-SWAP `evaluationMetadata` left the **entire** suite green. The tick_error capture was `[]`. | CONFIRMED | **Fixed** `ec19cd58`: writer arguments recorded, handler-level finalize, `passRan` rows. RC2 killed. |
| C-3 | P2 → P2 | "The trade result is never altered by the block" was not established (truncation and latency). | CONFIRMED (mechanism) | **Report corrected** (§6): stated as a measured risk. Shadow metrics and a proposed rollback trigger are in §10. |
| C-4 | P2 → P2 | The descriptions promised follow-through that no mechanism keeps, addressed a player who sees nothing, and overlapped the user-visible `anticipationCandidates`. | CONFIRMED (text; drift unmeasured) | **Partly fixed** `53fb58aa`: intent-only wording; "never replaces this check's decision or your anticipationCandidates". Branch review BR-3 found the player still addressed; **completed by the BR-3 rewording (§13)**. **Model-visible text needs founder/Astra sign-off**; drift metrics are in §10. |
| C-5 | P3 → P3 | Input cost stated only at chars/4; M7-E2E measured only the off tool. | CONFIRMED | **Fixed** `53fb58aa`: both bounds pinned; M7-E2E shadow row; measured 9,093 → 10,062. `countTokens` is on the checklist. |
| C-6 | P3 → P3 | Shallow freeze: the on and off tools shared nested objects, so a push to the on-tool's `required` mutated the off tool and the validator. | CONFIRMED | **Fixed** `53fb58aa`: deep freeze and the on-tool's own clone (RC6 killed). The cron comment calling the tool "frozen" is corrected (`54e19147`). |
| C-7 | P3 → P3 | Fence citation: the flatten helpers live in `agentScoring.js`. | CONFIRMED | **Fixed** in this report. |
| C-8 | P3 → P3 | The new model-visible prose sat outside the honesty sweep. | CONFIRMED | **Fixed** `53fb58aa`: registered; the sweep passes. |
| C-9 | P3 → P3 | The golden's provenance label is a literal. | CONFIRMED | **Fixed** `ec19cd58`: SHA-256 pinned (`15a442dd…`). |
| D-1 | P2 → P2 | The late-exit row passed because the exit had no observation, not because of the budget rule. Two mutants stayed green end to end: removing the non-model budget rule, and giving every hook ten times the budget. | CONFIRMED | **Fixed** `54e19147`: the row deploys a stop, so the exit has an observation, and asserts the `[calls] flips skipped … exit=gameplan_pending` line. The log assertion is required: with the rule removed, the deadline has already passed, so nothing is touched. RD1 killed. |
| D-2 | P2 → P2 (broader) | Two publication rows raced a real timer against `Date.now()` at equal deadlines; under event-loop traffic a callback fires 1 ms early 12–17 % of the time. The verifier found a second mode: 20–40 ms absolute budgets stalled under parallel load (7/48 runs failed at 8-way). | CONFIRMED | **Fixed** in two commits. Mode (a) in `54e19147` (`rereadDeadlineMs ≤ now`). Mode (b) in `2e87e1b6`: candidates are built before the clock is read, with wide margins. 48/48 runs pass at 8- and 12-way concurrency. Production is unaffected: it always keeps 500 ms between the two deadlines. |
| D-3 | P2 → P2 | No row injected a competing write between a flip's transactional reads and its commit, so reading outside the transaction stayed green. | CONFIRMED | **Fixed** `54e19147` with two rows: a sweep resolves the call, and the battle completes. RD3 killed. Verifier's caveat: with the SDK's 500–1,500 ms retry backoff, production usually reports this race as `unconfirmed` (§11.9). |
| D-4 | P2 → **P3** | The cursor rows could not fail if the cursor were ignored or cut: examined calls left the open set, and the monopolization row cost no clock. | CONFIRMED | **Fixed** `54e19147` with three rows where calls stay open. (1) Acted-only continuation, asserting the exact read order. (2) 120 same-`mintedAt` calls across page boundaries, with a cursor persisted mid-page. (3) A prefix that exhausts each check's deadline. RD4a/b/c killed. |
| D-5 | P2 → P2 | The store double allowed a read after a buffered write; the Admin SDK throws. | CONFIRMED | **Fixed** `54e19147`: the double throws the SDK's own error. A read-after-write mutant in publication is now red (RD5). |
| D-6 | P3 → P3 | Row 3's assertions sat behind `if (!swappedIn.includes(...)) continue`. | CONFIRMED (drift risk) | **Fixed** `54e19147`: the row asserts both names were swapped in, then checks every call. |
| D-7 | P3 → P3 | The double retries at once where the SDK backs off 500–1,500 ms, and its ordered queries returned documents missing an order-by field. | CONFIRMED | **Modeled / documented** `54e19147`: ordered queries now exclude such documents; the retry gap is a stated KNOWN GAP in the fixture header (§11.9). |
| D-8 | P3 → P3 | The minting guard was proven only by unit rows, and the per-exit clock row covered 6 of the 8 exits. | CONFIRMED, wording corrected: the e2e row skipped via the minting guard, but would still pass via `before_mint` without it | **Fixed** `54e19147`. The e2e row asserts `skipped: { minting_check: 2 }` (RD8 killed). The clock row covers all eight exits and their sources; passive is held to "at or after its fetches", because it precedes the intraday fetch. |
| E-1 | P2 → P2 (wider) | The deadline was checked only at attempt start, so reads returning late still led to a commit after it. The verifier reproduced this on the real SDK runner, including a second read (the queue) starting after the deadline. | CONFIRMED | **Fixed** `54e19147`: re-checks before the queue read and before the first write (`publish.js:167`, `:177`) and in each flip (`flip.js:184`). With the re-check the SDK rolls back and writes nothing. RE1a/b/c killed. The residual case, a commit already in flight at the deadline, is §3.7's "a timeout is unconfirmed" (§11.2). |
| E-2 | P2 → **P3** | The removal list was unbounded and the cap measured the block. Bookkeeping bytes pushed the 64 KB loop to evict **valid** calls (2 valid shots + 1,250 junk → 69 KB record, 0 kept). | CONFIRMED | **Fixed** `ca244f99`: the record lists the first 16 removals and counts the rest per (source, reason) in `removedOverflow`; the 16 KB cap applies to the record as stored (plus a 2,048-byte identity/`minted` allowance). RE2a/b/c killed. |
| E-3 | P2 → P2 (spec-level) | `next_check` calls can never hit: they expire at the next slot, and the next check observes after its cron fires (650/650 simulated → `expired_unresolved`). | CONFIRMED | **Not changed; founder ruling needed before the shadow read counts them.** The code follows contract §5/§6 and spec §3.8. Pinned (`flip.test.js`, "a next_check call observed by the next check…"). |
| E-4 | P3 → P3 | A lone surrogate passed validation; protobuf writes it as invalid UTF-8 or U+FFFD. | CONFIRMED (server reaction ASSUMED) | **Fixed** `ca244f99`: malformed, row by row (RE4 killed). |
| E-5 | P3 → P3 | Each flip transaction reads the whole battle document for `status`. | CONFIRMED (performance only) | **Deferred**, reported for separate tasking. A `fieldMask` in a transactional `getAll` applies to every document read, so the fix needs a combined mask or a separate masked read. Correctness is unaffected. |

## 9. Verification runs

Every command below ran in this session. Output was redirected to files, never piped, so each exit code is the command's own. "Build HEAD" is `578135f4c3b7d782916ff69bc9ca0172c1f5b755`.

| Check | Where / command | Result |
|---|---|---|
| Full suite at **off** | working tree at build HEAD (clean), `npx vitest run` | **789 files passed (3 skipped); 15,515 tests passed (64 skipped); exit 0** |
| **Flip dry run** (review C-1) | `git archive` snapshot of build HEAD with exactly the two flip lines changed (`CALL_RECORDS_MODE = 'shadow'` and its pin `toBe('shadow')`), `npx vitest run`. The snapshot lives only in the session scratchpad; nothing from it was committed | **789 files passed (3 skipped); 15,515 tests passed (64 skipped); exit 0** |
| Lint gate | `npm run lint:gate` at build HEAD | **exit 0** |
| Rules (emulator) | `npm run test:rules` at build HEAD | **16 files, 298 tests passed; exit 0; includes the four new suites (11 tests each)** |
| `vite build` | `git archive` snapshot of build HEAD | **exit 0; the >500 kB chunk warning predates this branch** |
| Protected-store write scan | `compositionProtectedStores.scan.test.js` (in the full suite) | green; 5 reviewed allowlist rows (§3) |
| Mutation battery (§7) | its own `git archive` snapshot of build HEAD; each mutant restored byte-exact (sha256-checked) | **78/78 source mutants killed; plus 3/3 rules mutants under the emulator** |
| Fence | `git diff origin/main HEAD --name-only` ∩ BUILD_RULES §1 | **∅** |
| Base still current | `git fetch origin main` before the push | `origin/main` is still `987a9a68`; the branch needs no update |
| Diff size | `git diff --shortstat 987a9a68 <build HEAD>` (the base; before this report's commit) | 53 files, +20,503 / −20. Most of it is the frozen off golden (`callRecordsOffGolden.json`), which is data, not code. |

**Pre-existing, reported for separate tasking and not fixed (BUILD_RULES §3):** the root `firestore.rules.emulator.test.js` fails **identically on `origin/main`**. It runs under its own emulator command and is skipped in the default suite.
- Result: 25 passed, 33 skipped, and `[proposed-bundles-rules] expected exactly ONE bundles block to patch, found 0`.
- Cause: its in-memory patch regex no longer matches the `bundles` block.
- This branch does not touch that block (`git diff origin/main HEAD -- firestore.rules` has no `bundles` line).

## 10. Deployment checklist and the shadow read plan (§3.13)

**This PR ships `CALL_RECORDS_MODE = 'off'`. Nothing below happens in it.**

1. **Astra reviews the branch; the founder merges after 6 PM ET.** At off the merge changes no behavior (§4, §5 row 1).
2. **Publish `firestore.rules`** (founder: Console or `npm run deploy:rules`). The new blocks deny every client write and grant the owner read of `declarations`/`calls`/`callObservations`; `callSweepQueue` is server-only.
3. **Create the `calls` composite index by hand in the Firebase Console:** collection `calls`, scope *Collection*, fields `state` Ascending and `mintedAt` Ascending. `__name__` Ascending is Firestore's implicit tie-break, spelled out in `firestore.indexes.json`. Per `FIRESTORE_INDEX_DRIFT_CLEANUP.md` (the dual-write rule), **do not** run `firebase deploy --only firestore:indexes`: it prompts to delete the production-only drifted indexes. Wait for the index to show *Enabled* **before** the shadow flip.
4. **Rulings before the flip:**
   - **A-1:** the provenance origin of no-watchlist battles.
   - **E-3:** `next_check` horizons.
   - **C-4:** sign-off on the model-visible tool text (`agentEvalToolSchema.js:233-335`).
   - **C-5:** measure the maximal request with the real `countTokens` endpoint for both tools.
5. **Flip to `shadow` in its own PR.** The spec plans this for the morning after the merge; it now waits on step 4's rulings. The flip is the one line in `src/config/featureFlags.js` plus the direct pin in `src/config/callRecordsFlags.test.js`, in the **same commit** (BUILD_RULES §2). Those two lines are the whole flip (dry run in §9). The flip adds the admission reserve and the input cost (§6).
6. **Startup validation.** The first flip scan in each warm instance runs the exact query. A missing index logs `[calls] flip index MISSING …` and skips flips for 10 minutes instead of failing checks. After the flip, confirm the log is absent.
7. **Watch the log lines:**
   - `[calls] phase …`: model row, now with `removed=`.
   - `[calls] flips …` / `[calls] flips skipped …`: other rows.
   - `[calls] fault (isolated …)`.
   - `[calls] call_conflict …`.
   - `[calls] truncation_event …`.
   - `[calls] flip index MISSING …`.

**Shadow read: five sessions, labeled honestly (§3.13).** `cronState.callsDiag` holds only the *latest* check of each battle, because every later check overwrites it (review B-4). The per-check sources below are durable.

| Read | Source |
|---|---|
| records by kind and state, per day | `agentBattles/*/calls` (`kind`, `state`, `mintedAt`) |
| malformed and `invalidated` reasons | `[calls] phase … removed=` log lines (every check, including blocks that wrote no record); `declarations/{evalId}.removed` + `.removedOverflow` and `.minted[].reason` for records that exist |
| phase results | `evaluations[].declarationsPhase` + whether `declarations/{evalId}` exists (contract §2.1: resolve by existence); `[calls] phase … result=` log lines; `cronState.declarationsPhase` is the latest-check shortcut only |
| truncation events | `[calls] truncation_event` logs; `evaluations[].haikuError.failureClass === 'truncated_response'` |
| `call_conflict` (**expect 0**) | `[calls] call_conflict …` error logs |
| flip coverage and cursor progress | `[calls] flips …` log lines (per check); `cronState.callFlips` (latest) |
| receipts per transition | `callObservations/*` vs `calls` with `state ∈ {hit, expired_unresolved}` and `stateSource: 'check'` |
| **the known unresolved backlog** | Open calls whose battle got no later check. **No expiry repair exists until Build 1's sweep worker**; the queue (`callSweepQueue`) is armed, but nothing drains it in Build 0. |
| **trade-path safety (C-3)**, vs the 5 sessions before the flip | `evaluations[].callMs` p50/p95; `evaluations[].haikuError.failureClass` rates for `timeout` / `truncated_response` / `invalid_tool_result`; output tokens (`cronState.totalTokens.output` deltas; capture `callEnvelope.outputTokens`) |
| **model-behavior drift (C-4)**, same comparison | `evaluations[].decision` SWAP/HOLD mix; anticipation candidates per check (`evaluations[].candidates`, the per-check stamp, `tickStamps.js:293`; and the `anticipation` shadow-log stream) |
| **whole-run effect (B-4)**, same comparison | `agentEvalRuns/*`: `modelCalls`, `budgetSkipped` (these move reliably), `deferred`, `wallMs` |
| forfeited low-priority coverage (B-1) | `cron_budget_skip` anticipation skips; capture `skipped_budget` counts |

**Proposed rollback trigger (for the founder to confirm; not a spec rule).** Roll back to `off` (the same one line) if the shadow sessions, against the five before the flip, show any of the following:
- the model timeout rate up by ≥ 2 points;
- `truncated_response` + `invalid_tool_result` up by ≥ 1 point;
- p95 `callMs` up by ≥ 2,000 ms;
- the SWAP share, or anticipation candidates per check, moving by more than 25 % relative.

## 11. Known limits, readings and notes (for the reviewer)

1. **Order in the transaction is the spec's**: the parent check precedes the idempotence check. Consider a commit whose acknowledgement is lost, followed by completion before the SDK's retry. It reports `parent_terminal`/`failed` while the documents exist. Contract §2.1 readers resolve by document existence (`expected` plus a document means written), so the record stays truthful; the wire is only the latest-check shortcut.
2. **A timeout whose commit lands after the existence re-read** reports `failed` on the wire (spec: absent → failed) with per-id `unconfirmed`. The late documents exist and capture never references them. Readers resolve by existence. After review E-1 this needs a commit that was **already in flight** when the deadline passed: no commit is *issued* after it.
3. **`stateChangedAt` on a check transition is the observation instant** (`observedAtMs`), not the write's wall clock: the instant on a receipt is the instant the observation existed.
4. **`actedEvalId` is written only while the call is `open`** (§3.8 skips non-open calls). An act on a later check after a `hit` is not recorded in Build 0.
5. **The copilot proposal-creation path is unreachable at HEAD.** The launch guard (`agent-evaluate.js:3382-3386`) forces autopilot, so "proposal-only" is exercised as the proposal-pending exit and as a unit row with no executor result.
6. **The gameplan rows observe what the R11 pass examined.** When the pass examined nothing (no deployed guardrail, or the executor flag off), the exit stamps its own instant with an **empty** set (review A-2): expiry runs, and no hit can. Both behaviors are tested.
7. **Write cost at shadow/on.** Each qualifying check adds one battle-document update after its authoritative write (`cronState.callsDiag`, plus `callFlips` and the wire when they apply), and one transaction per flip. Owner clients listening to the battle document receive that update; nothing renders it. Each flip transaction also reads the whole battle document (E-5, deferred).
8. **The index validation memo is per process.** A missing index is re-validated after 10 minutes per warm instance.
9. **Test double vs production transactions.** The calls store double models an optimistic transaction (versions plus retry); the Admin SDK serializes with locks.
   - **Modeled as the SDK does:** the completion race resolves the same way in both (the retry, or the waiting writer, sees `completed`). The double throws on a read after a buffered write, as the SDK does (review D-5). It excludes documents missing an order-by field from ordered queries, as the index does (D-7).
   - **KNOWN GAP (D-7), stated in the fixture header:** the SDK backs off 500–1,500 ms before retrying a contended attempt; the double retries at once. In production, a flip contended past its 800 ms ceiling is therefore reported `unconfirmed` where the double resolves it (the D-3 verifier's caveat). The call stays open and a later check retries it. No assertion depends on retry timing.
10. **Pre-existing lint errors, not introduced here** (present on `origin/main`): `agent-evaluate.js` (unused `getPresetAdjustedStrategies`, two unused `_e`) and `captureWriter.test.js:12` (unused `runWithTickCaptureScope`). `npm run lint:gate` is the gate (§9).
11. **The protected-stores scan was red on this branch from `20d207d7` to `7a40302f`**, caused by the calls store fixture's forwarding `update`. It was caught at step 2.7 and allowlisted with a reviewed note. Every later commit is green on it.
12. **The validator drops a blank optional key** (A-3). "Kept exactly as declared" means projected onto the typed fields: a blank optional string is treated as absent, like `null`.
13. **Out of scope, reported and not fixed:**
    - E-5 (the flip parent read's size).
    - The pre-existing root rules-emulator regex drift (§9), offered as a separate task.
    - `TRADE_DECISION_TOOL` was never frozen before this build. Build 0 does not freeze the off literal either, because freezing it would change an object every existing import holds. Its on-tool shares nothing with it.

## 12. Post-review rulings applied

After this report was committed (`ac4292d8`), the founder ruled on the two spec-level findings of §8. Both rulings are applied on this branch, one commit each with its tests. This section **supersedes** the "pending ruling" statements for A-1 and E-3 in the executive verdict, in §8 and in §10 step 4. Those sections stand as they were written at review time. The third pre-flip decision, sign-off on the model-visible tool text (C-4), **remains open**, as does the `countTokens` measurement (C-5).

| Ruling | Commit | In plain words | Mutation check |
|---|---|---|---|
| **A-1** | `b0105b0f8f343ea5be8d4259aad68e0e06380709` | A battle with no equipped watchlist labels its calls **"agent initiative"**, whatever its config fingerprint says. "Provenance unresolved" now means only that a watchlist was frozen but is unusable. | 4/4 killed |
| **E-3** | `a78bbfb31f5958d069f4d07725054916d05b6e7a` | An "until the next check" call is judged **once, by that next check**: **hit** if its condition is met then, otherwise **expired**. Any later check can only expire it. Other horizons are unchanged. | 8/8 killed |

### 12.1 A-1: no frozen watchlist means agent initiative

**Ruling:** "origin is agent_initiative with hypothesisRef: null when the frozen agentContext.equippedWatchlist is absent, regardless of equippedConfigHash; provenance_unresolved only when a watchlist snapshot is present but unusable."

**Code** (`api/_utils/callRecords/candidate.js`):
- `resolveProvenance` (`:107-125`) returns `{ hypothesisRef: null, origin: 'agent_initiative' }` for an absent snapshot, `undefined` or `null` (`:109-110`), before the hash is read. `null` is the shape `createAgentBattle` writes when no watchlist is equipped.
- A present snapshot that is unusable stays `provenance_unresolved`:
  - `snapshot_corrupt` (`:114`, `:119`): a malformed snapshot or a malformed version.
  - `config_hash_missing` (`:124`): a valid snapshot with neither a version nor a hash, so its legacy reference cannot be built.
- `PROVENANCE_REASONS` (`:39`) drops the now-unreachable `hash_without_watchlist`.

**Tests** (`candidate.test.js`):
- The A-1 pin and the "A REAL battle manifest" row are now "A REAL battle manifest without a watchlist → agent_initiative, hypothesisRef null — the hash is ignored". They use the real `buildResolvedAgentManifest` with `equippedWatchlist: null`, and assert that the minted call carries no `provenanceReason`.
- Absent and `null` snapshots are covered with and without a hash.
- The unresolved row keeps only present-but-unusable snapshots.
- The reason vocabulary is pinned.

**Documents not edited:** contract §4's `origin` row still lists "hash without watchlist" under `provenance_unresolved`, and spec §3.6 defers to contract §4. Both are SHA-pinned inputs of this build (§0). The ruling supersedes them for Build 0; amending their text is the founder's to schedule.

### 12.2 E-3: a next_check call is judged once, by its next check

**Ruling:** "for calls with horizon.basis === 'next_check', the first check whose observedAtMs >= expiresAtMs evaluates the condition once — hit if met, else expired_unresolved; later checks expire it; other bases unchanged."

**Code** (`api/_utils/callRecords/flip.js`):
- `decideFlip` (`:113-122`) handles basis `next_check` with `observedAtMs ≥ expiresAt` (`:116`):
  - a later check → `expired_unresolved` (`:117`);
  - otherwise `hit` if the condition is met, else `expired_unresolved`.
- Every other basis is unchanged: `observedAtMs > expiresAt` → `expired_unresolved`; up to and including the expiry instant, `hit` if met.
- `conditionMet` (`:87`) holds the price test. A pick is never "met".
- `planFlip` (`:158`) and the per-call transaction (`:209`) both receive `priorScanAtMs`, so the transaction re-decides with it, not only the page read (`:316`).
- `runCallFlips` reads `priorScanAtMs` from `battle.cronState.callFlips.observedAtMs` (`:258`) and records its own observation instant in the status it returns (`:270`).

**How "first" is told from "later".** A check is *later* when the battle's persisted scan status shows that a previous check's flip scan ran at or after the slot (`priorScanAtMs ≥ expiresAt`). Consequences:
- **Normal case.** The check in the slot at `expiresAt` is the first, observes at slot + δ, and judges the call. This is the case review E-3 found could never hit.
- **Deferred battle, or an excluded exit (no observation, no scan).** The next check that scans is the first and judges the call, as the ruling reads.
- **Scan ran but did not reach the call.** The first check after the slot scanned, but its deadline cut the scan short or its transaction went unconfirmed. Every later check then only expires the call.
- **Known edges, disclosed.**
  - A non-model exit whose hook is budget-skipped (< 2,000 ms), or a model check whose calls phase is budget-skipped (< 4,000 ms), holds an observation but writes no scan status.
  - A failed or unconfirmed status write likewise leaves the prior instant where it was.
  - In both edges the next scanning check still counts as the first and judges the call, instead of only expiring it.
- **Picks** (basis `next_check`, no price condition) expire at the first check at or after their slot. That now includes the exact slot instant, which the old rule (`>`) excluded; in practice nothing changes.

**Wire change.** `cronState.callFlips` gains one field, `observedAtMs`: the status spec §3.8 names, `{ evalId, cursor, scanned, total, complete }`, plus this field, which the rule needs to tell a later check from the first. There is no reader in Build 0, and at off nothing is written (unchanged).

**Tests** (`flip.test.js`):
- The E-3 pin is replaced by three store-driven rows:
  - **Hit at the next check:** slot + 20 s, condition met → `hit`, receipt px 170.
  - **Miss at the next check:** condition not met → `expired_unresolved`, receipt px 160.
  - **A later check:** the first check after the slot scans, but an older call takes its whole deadline, so the `next_check` call is never reached. The next check, 15 minutes later, finds the condition met and still only expires it.
- Unit rows cover the exact slot instant, a prior scan before, at and after the slot, other bases unchanged, and picks at their slot.
- The two status-shape pins include `observedAtMs`.

**Documents not edited:** spec §3.8's "`observedAtMs > expiresAtMs` → `expired_unresolved`" and its status shape, and contract §5/§6, are SHA-pinned inputs (§0). The ruling supersedes them for `next_check`.

### 12.3 Verification at `a78bbfb3`

| Check | Result |
|---|---|
| Full suite, `npx vitest run` (redirected, never piped; exit recorded) | **789 files passed (3 skipped); 15,519 tests passed (64 skipped); exit 0** |
| Lint gate, `npm run lint:gate` | **exit 0** |
| Mutation check: its own `git archive` snapshot of `a78bbfb3`, each mutant restored byte-exact (sha256-checked) | **12/12 killed** (table below) |
| Not re-run for these two commits | The rules emulator, `vite build` and the §7 battery. `git diff ac4292d8 a78bbfb3 --stat` touches only `candidate.js`, `flip.js` and their two test files: no rules, index, app or cron code. |
| Review | These two commits implement founder rulings on findings the §8 verifiers had already confirmed. They were mutation-checked, not put through a new multi-lens review. |

| Ruling | ID | Mutation | Result | First test that went red |
|---|---|---|---|---|
| A-1 | RA1a | the pre-ruling rule restored: no snapshot + a config hash → `provenance_unresolved` (`hash_without_watchlist`) | **KILLED** (2 failing) | candidate.test.js › NO watchlist snapshot (absent or null) → agent_initiative … (ruling A-1) |
| A-1 | RA1b | a `null` snapshot (the shape `createAgentBattle` writes) treated as present → `snapshot_corrupt` | **KILLED** (2 failing) | candidate.test.js › NO watchlist snapshot (absent or null) → agent_initiative … (ruling A-1) |
| A-1 | RA1c | a present but unusable snapshot mints `agent_initiative` | **KILLED** (2 failing) | candidate.test.js › UNRESOLVED only for a PRESENT but unusable snapshot … (ruling A-1) |
| A-1 | RA1d | the reason vocabulary keeps the unreachable `hash_without_watchlist` | **KILLED** (1 failing) | candidate.test.js › UNRESOLVED only for a PRESENT but unusable snapshot … (ruling A-1) |
| E-3 | RE3a | the ruling removed: `next_check` follows the strict rule again | **KILLED** (3 failing) | flip.test.js › a pick never hits — only expiry resolves it (its next_check slot included …) |
| E-3 | RE3b | a later check judges the condition again (the prior scan ignored) | **KILLED** (2 failing) | flip.test.js › next_check (ruling E-3): the first check at or after the slot evaluates the condition once … |
| E-3 | RE3c | the `next_check` rule applied to every basis | **KILLED** (2 failing) | flip.test.js › expiry wins outside the horizon; the exact expiry instant is still inside it |
| E-3 | RE3d | the first check must be strictly after the slot (`>` instead of `>=`) | **KILLED** (2 failing) | flip.test.js › a pick never hits — only expiry resolves it (its next_check slot included …) |
| E-3 | RE3e | a prior scan exactly AT the slot does not make this a later check | **KILLED** (1 failing) | flip.test.js › next_check (ruling E-3): the first check at or after the slot evaluates the condition once … |
| E-3 | RE3f | the status does not record this scan's observation instant | **KILLED** (4 failing) | flip.test.js › a hit: state/stateChangedAt/stateSource flip, the receipt is created and referenced … |
| E-3 | RE3g | the prior scan instant is not read from the persisted status | **KILLED** (1 failing) | flip.test.js › next_check, a LATER check: … the next one finds it met and still only expires it (ruling E-3) |
| E-3 | RE3h | the transaction re-decides without the prior scan (only the page read has it) | **KILLED** (1 failing) | flip.test.js › next_check, a LATER check: … the next one finds it met and still only expires it (ruling E-3) |

### 12.4 Where the rest of this report is now out of date
- **Executive verdict, "Your decisions before switching to shadow":** items 1 (A-1) and 2 (E-3) are decided and applied. Item 3 (C-4, the model-visible tool text) remains.
- **§8, rows A-1 and E-3:** their disposition is now *applied* (this section).
- **§10 step 4:** A-1 and E-3 are done; the C-4 sign-off and the C-5 `countTokens` measurement remain.
- **§3 anchors:** the `file:line` anchors for `candidate.js` and `flip.js` predate these commits; the anchors in §12 are current.
- **The PR description** carries the report as it stood at `ac4292d8`; it does not include this section.

## 13. Branch review applied (BR-1, BR-2, BR-3, BR-5, BR-6)

Astra reviewed this branch at `43b61987`. The review is `docs/audits/20260924_BUILD0_CALL_RECORDS_REVIEW.md` on branch `docs/review-build0-call-records` (commit `3f6001611163f8487f65bdd8ec6b355b6f519d1c`, 214 lines, SHA-256 `944c70d99a28c16e5c9d37d68e9cc6c431ad29f4f648ec743d175b3164a960aa`).

Its verdict was **MERGE WITH CHANGES**: merging at off is allowed, but **do not enable shadow yet**. Five of its six findings are applied below, one commit each. Each commit carries its tests and is mutation-checked on its own snapshot. **BR-4, a contract and spec amendment, was not part of this request and remains open.** Per the review, BR-4 still blocks shadow.

This section **supersedes** two earlier statements:
- **§12.2:** its "later check" rule and its status field `observedAtMs`. BR-1 replaces the battle-level clock with a per-call judgment.
- **§8, row C-4:** its "Fixed" disposition, now marked "Partly fixed" with a pointer here.

Those sections otherwise stand as they were written.

| Finding | Commit | In plain words | Mutation check |
|---|---|---|---|
| **BR-1** (P2) | `98a03431e08981cef2744380c16fa4ac8e16c660` | An "until the next check" call is judged by **the first check that actually reaches it** at or after its slot. It is **hit** if its price condition is met then, otherwise **expired**. It counts as judged only when that check's database transaction commits. A check that fails, is skipped or runs out of time before reaching the call judges nothing, and the next check that reaches it judges it from its own prices. No battle-wide clock takes part. | 8/8 killed |
| **BR-2** (P2) | `2479aebc260005747ccd65aae793024d98a16e9e` | A game-plan check can mark a call **hit** only if its safety pass actually looked at prices, which means a stop-loss, trailing stop or profit target. A pass that checked only sector weight or position size looked at no price. It can still expire calls, but it can never mark one hit. | 6/6 killed |
| **BR-3** (P2) | `4507ef8235aafc59c89eb692e5cd7511f24488db` | The text the AI reads now says plainly that these records are stored only: nobody sees them, nobody answers them, nothing trades on them, and the next check never receives them. | 8/8 killed |
| **BR-5** (P3) | `e152624f814ce1274b5484d1f700089c88b78501` | The "nothing changes at off" proof now passes on any machine, including one with Windows-style line endings or a non-UTC timezone. | 5/5 killed |
| **BR-6** (P3) | `9b00a7c322d836e9dcf377a7e664833cd486f81b` | The report now claims only what the off proof shows. The 19 scenarios never call the tournament ledger or the anticipation writers, so the proof shows those stay uncalled, not that their arguments are unchanged. | Documentation only |
| **BR-4** (P2) | none | **Open.** The pinned contract (§4, §5, §6) and spec (§3.6, §3.8) still state the pre-ruling A-1 rule and the old E-3 expiry. Publishing a versioned amendment was not requested here. | none |

### 13.1 BR-1: a next_check call is judged per call, by the transaction that commits

**Code** (`api/_utils/callRecords/flip.js`):
- **`decideFlip(call, observation)`** (`:114-122`) takes no prior-scan argument.
  - For basis `next_check` with `observedAtMs ≥ expiresAt` (`:117`), it returns `hit` if the condition is met, else `expired_unresolved`.
  - Every other basis is unchanged.
- **`planFlip(call, { observation, evalId, executorResult })`** (`:158`) and the per-call transaction in `flipOne` (`:204-210`) carry no prior-scan instant either.
  - The transaction re-reads the call and its parent battle (`:204`).
  - `planFlip` skips any call that is no longer open (`:159`, `not_open`).
  - That re-read, not a battle clock, is what makes the judgment happen once. The state and the receipt are written in the same transaction.
- **`runCallFlips`** no longer reads `battle.cronState.callFlips.observedAtMs`.
  - Its status is again spec §3.8's shape, `{ evalId, cursor, scanned, total, complete }` (`:265`).
  - The `observedAtMs` field that §12.2 added is gone.

**Consequences, as the review adjudicated them:**
- **Racing scans.** A race guarantees **one committed judgment**, with one terminal state and one receipt. It does not guarantee that the earliest observation wins.
- **A late first reach.** It can leave a receipt observed well after the slot while the parent battle is still active. That receipt is the reaching check's own observation, not a quote from the missed slot.
- **Build 1's sweep.** It must honor this opportunity to be judged, or record a separately agreed unobserved-expiry policy. Expiring every `next_check` call at its slot would recreate E-3. No sweep exists at this build.

**Tests** (`flip.test.js`):
- **Unit rows:**
  - A judgment at or after the slot uses this observation: at the exact slot, +20 s, +15 min, +45 min, and unobserved.
  - A new "no battle clock" row passes a prior-scan instant before, at and after the slot. None of them changes a judgment.
  - Other bases are unchanged.
- **Store-driven rows**, the review's list:
  - A hit and a miss at the next check.
  - A call first reached by a later check → **hit**. This reverses §12.2's row, as the review required.
  - A persisted status carrying a scan instant decides nothing.
  - A failed first query.
  - A missing index, then recovery.
  - A budget-skipped hook.
  - A failed status write: the committed transition stands, and no later check judges the call again.
  - An aborted transaction.
  - An unconfirmed transaction that commits late: that commit is the judgment.
  - Two competing judgments: one terminal state and one receipt. The loser re-reads a terminal call and skips it.

### 13.2 BR-2: a gameplan pass observes only the prices it examined

**Code:**
- **`api/_utils/callRecords/observe.js`:**
  - `PRICE_SCANNING_GUARDRAIL_TYPES` (`:146`) lists `stopLoss`, `trailingStop` and `profitTarget`.
  - `passExaminesHeldPrices(guardrails)` (`:161`) mirrors the fenced `applyGuardrails`' own preconditions. Guardrails are indexed by type, the last entry of a type wins, and a scan runs only on a numeric value.
- **`api/cron/agent-evaluate.js:5258-5262`** (`runSuppressionDeterministicPass`):
  - The gameplan observation's `examined` set is every held name when the pass examined held prices. Otherwise it is empty.
  - An empty set still lets expiry run; no hit is possible.
  - The one-instant observation rule is unchanged, and so is the pass's own behavior. The change is inert at off.

**Fenced functions called, never edited:**
- `applyGuardrails` (`api/_utils/agentGuardrails.js`).
- `flattenPortfolioServer` (`api/_utils/agentScoring.js`).

The cron already called both at this site. The new tests also call them directly.

**Tests:**
- **`observe.test.js`:**
  - Ten guardrail configurations: sector-only, maxPosition-only, each price kind, mixed, non-numeric, and last-wins in both orders.
  - Each runs the real `applyGuardrails` with a Proxy recording every price read.
  - The adapter must agree with the helper: every held price is read exactly when it returns `true`, and none is read when it returns `false`.
  - A second row pins the verdicts and the kind list.
- **`agent-evaluate.tickStamps.callsOn.test.js`**, the review's two counterexamples:
  - Setup: gameplan pending and gameplan created, each with only a 40% sector cap and an older open "KO below $62.50" call.
  - The capture shows that the pass ran.
  - KO is quoted at 62.0, yet its call stays open with no receipt.
  - An expired call still expires, with a `gameplan_pass` receipt and px null.
  - The existing stop-loss rows are the positive control: a price-scanning pass on the same exits does hit.

### 13.3 BR-3: the declarations text names its real recipient

**Code** (`api/_utils/agentEvalToolSchema.js`):
- **The block text** (`:239-242`) is the review's suggested wording: "Optional record of conditional intent from this check. These fields are stored only; they are not shown to the player, do not request a response, do not execute or schedule a trade, and are not supplied to a later check. They do not change this check's decision or anticipationCandidates." The omission, cap and quote-source guidance is kept.
- **The fields:**
  - `defaultAction` (`:291`), `playerAsk` (`:307`) and `fork` (`:317`) use the review's text.
  - Both `said` fields (`:295`, `:334`) are now a conditional sentence, stored only and not shown to the player.
  - The `fork` sub-fields no longer speak of a choice being made.
- **Unchanged:** no field, enum or type moved, and the off tool is untouched. The off golden passes.

**Tests** (`agentEvalToolSchema.declarations.test.js`):
- A BR-3 row asserts the block clause by clause, the kept guidance and the exact field texts.
- It also asserts that no text addresses the player as a reader or answerer, or mentions waiting, suppressing, withholding, narration, permission, approval or confirmation.
- The C-4 row follows the new wording.
- The honesty sweep, the threshold-copy pin and the M7-E2E budget still pass.

**Cost.** The pins moved in the same commit, and §6 and the executive verdict were updated with them.
- The tool schema grows by **4,154 chars** per model call at shadow or on, up from 3,874.
- That is **1,039 tokens at chars/4** and **1,385 at chars/3**.
- The largest eval request (the M7-E2E fixture) is now 10,132 tokens, against a 12,000-token budget.

**Sign-off.** Astra signed off **the direction** of these edits. That is not a sign-off on this exact text or on future model behavior, so the model-visible diff above still needs that confirmation before shadow.

### 13.4 BR-5: the off proof is portable across checkout and timezone

**Reproduced first.** Setup: a `git -c core.autocrlf=true archive` of `4507ef82`, run in `TZ=America/Chicago` over the seven focused suites. Result: 83 passed and **5 failed**.
- Four failures are this build's: the golden SHA-256, two gameplan golden rows, and the queue-comment parser.
- The fifth predates Build 0 (13.8).

**Code:**
- **`.gitattributes`** is new and has one narrow line: `api/_utils/__fixtures__/callRecordsOffGolden.json text eol=lf`. The raw-byte SHA-256 check stays exactly as strict.
- **Both rules-comment parsers** now split on `/\r?\n/`: `callRecordsRulesIndex.test.js:44` and its emulator-suite copy, `test/rules/callRecordsRulesSuite.mjs:64`.
- **`api/_utils/__fixtures__/pinTimezoneUtc.js`** sets `process.env.TZ = 'UTC'`.
  - It is the golden test's **first** import (`:37`).
  - Vitest runs each file in its own child process here, so the pin never leaks into another file. A probe confirmed this.

**Tests:**
- **The golden suite:**
  - It asserts the attribute entry and CR-free fixture bytes.
  - It asserts that the process runs in UTC, with the pin as the first import.
- **The index suite** runs **both** parsers over a CRLF copy of `firestore.rules`. It expects exactly the LF result, inline comment included.

**After the fix:**
- **Same reproduction at `e152624f`:** **91 of 92 passed**. The one failure predates Build 0: `intradayPromptExclusions.test.js` › "the anticipation note reads only evalId and timestamp". It fails the same way on a CRLF archive of the base, `987a9a68` (13.8).
- **Git-level check, attribute dropped:** in a scratch clone, archiving with `core.autocrlf=true` put 13,008 CRs into the fixture. The SHA pin and the LF row went red (2 failing).
- **Git-level check, branch unmutated:** archived the same way, the fixture had 0 CRs and 25 of 25 passed.

### 13.5 BR-6: the off-proof claim narrowed

The executive verdict and §4's first invariant row now claim only the payloads the 19 scenarios exercise. The counts below were recomputed from the committed fixture.

| Writer | Calls across the 19 scenarios |
|---|---|
| `executeSwapServer` | 4 |
| `captureSwapReceipt` | 4 |
| `generateTradeNarration` | 4 |
| `logEvaluation` | 11 |
| `reserveSymbol`, `confirmSwap`, `releaseReservation`, `generateAnticipation`, `logVisionTransition`, `logAnticipation` | 0 each |

- **The zero-call writers:** the proof shows only that they are never called.
- **The comparison's limits** are now stated: arguments are compared as JSON recorded after the scenario, with the database and battle replaced by placeholders.
- **The review's alternative fix** was not done: extending coverage with a tournament reserve/confirm/release path and a dispatched anticipation, with payload snapshots.

### 13.6 Verification at `9b00a7c3`

| Check | Result |
|---|---|
| Full suite, `npx vitest run` (redirected to a file, never piped; exit recorded) | **789 files passed (3 skipped); 15,537 tests passed (64 skipped); exit 0** |
| Lint gate, `npm run lint:gate` | **exit 0** |
| Rules emulator, `npm run test:rules` | **16 files / 298 tests passed; exit 0** |
| Production build, `vite build`, on a `git archive` snapshot | **exit 0** |
| Mutation battery: a `git archive` snapshot of `9b00a7c3`; each mutant restored byte-exact (sha256-checked); 600 s hang guard | **27 of 27 killed**, 0 errors (13.7) |
| CRLF + America/Chicago, the seven focused suites (`git -c core.autocrlf=true archive`, `TZ=America/Chicago`) | At `4507ef82`, before BR-5: 5 failed, 83 passed. At `e152624f`: 1 failed, 91 passed. The remaining failure predates Build 0 (13.8). `9b00a7c3` adds only report text. |
| Fenced files | `git diff --name-only 987a9a68 9b00a7c3` over the eleven BUILD_RULES §1 files is **empty** |
| Review | These commits implement a completed external review's findings. They were mutation-checked, not put through a new multi-lens review. |

### 13.7 Mutation table

| Finding | ID | Mutation | Result | First test that went red |
|---|---|---|---|---|
| BR-1 | B1a | the next_check judgment removed (the strict rule again: never hit after the slot) | **KILLED** (10 failing) | flip.test.js › a pick never hits — only expiry resolves it (its next_check slot included: the first check there expires it) |
| BR-1 | B1b | judged only strictly AFTER the slot (> instead of >=) | **KILLED** (2 failing) | flip.test.js › a pick never hits — only expiry resolves it (its next_check slot included: the first check there expires it) |
| BR-1 | B1c | a clock heuristic: a first reach more than 10 min after the slot expires the call | **KILLED** (8 failing) | flip.test.js › next_check (E-3 / BR-1): at or after the slot the condition is judged from THIS observation — hit if met, else expired; before it, the … |
| BR-1 | B1d | decideFlip honors a caller-supplied prior-scan instant (the battle clock, unit level) | **KILLED** (1 failing) | flip.test.js › no battle clock: a prior scan instant — before, at or after the slot — cannot change a judgment, whatever a caller passes (BR-1) |
| BR-1 | B1e | BR-1 reverted end to end: the transaction reads the persisted scan instant from the battle and a later scan expires the call | **KILLED** (2 failing) | flip.test.js › no battle clock: a prior scan instant — before, at or after the slot — cannot change a judgment, whatever a caller passes (BR-1) |
| BR-1 | B1f | the status regains a scan instant (observedAtMs) | **KILLED** (4 failing) | flip.test.js › a hit: state/stateChangedAt/stateSource flip, the receipt is created and referenced, nothing immutable moves |
| BR-1 | B1g | the not_open skip removed: a terminal call is planned again | **KILLED** (4 failing) | flip.test.js › not open / minting check / observation at or before the mint / nothing to do |
| BR-1 | B1h | the transaction trusts the page read: its re-read call is treated as still open | **KILLED** (3 failing) | flip.test.js › two COMPETING judgments leave ONE terminal state and ONE receipt: the loser re-reads a terminal call and skips it (BR-1) |
| BR-2 | B2a | the adapter always says the pass examined held prices | **KILLED** (4 failing) | agent-evaluate.tickStamps.callsOn.test.js › gameplan_pending with a SECTOR-ONLY guardrail: the pass ran and examined no price, so it records an EMPTY … |
| BR-2 | B2b | the numeric-value precondition dropped (any configured scan kind counts) | **KILLED** (2 failing) | observe.test.js › the adapter agrees with the REAL helper on every configuration: every held price read ⟺ passExaminesHeldPrices, and no held price re … |
| BR-2 | B2c | profitTarget dropped from the price-scanning kinds | **KILLED** (2 failing) | observe.test.js › the adapter agrees with the REAL helper on every configuration: every held price read ⟺ passExaminesHeldPrices, and no held price re … |
| BR-2 | B2d | first-wins indexing (the fenced helper is last-wins) | **KILLED** (2 failing) | observe.test.js › the adapter agrees with the REAL helper on every configuration: every held price read ⟺ passExaminesHeldPrices, and no held price re … |
| BR-2 | B2e | the cron ignores the adapter: any pass freezes every held name (the pre-BR-2 behavior) | **KILLED** (2 failing) | agent-evaluate.tickStamps.callsOn.test.js › gameplan_pending with a SECTOR-ONLY guardrail: the pass ran and examined no price, so it records an EMPTY … |
| BR-2 | B2f | over-correction: the pass never examines anything, even with a stop deployed | **KILLED** (3 failing) | agent-evaluate.tickStamps.callsOn.test.js › gameplan_pending: the open call flips on THIS exit's observation — receipt from 'gameplan_pass', nothing p … |
| BR-3 | B3a | defaultAction addresses the player again (the C-4 text) | **KILLED** (3 failing) | agentEvalToolSchema.declarations.test.js › the wording states intent only: nothing executes, and the block never replaces the decision or anticipation … |
| BR-3 | B3b | the block no longer says it is not shown to the player | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-3 | B3c | the block no longer says it is not supplied to a later check | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-3 | B3d | playerAsk asks for a question FOR the player again | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-3 | B3e | fork asks for a choice the player should make again | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-3 | B3f | a `said` loses its stored-only framing | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-3 | B3g | a permission instruction slipped into an unpinned field (watching) | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-3 | B3h | the omission guidance dropped from the block | **KILLED** (2 failing) | agentEvalToolSchema.declarations.test.js › the wording names the recipient Build 0 really has: stored only, never shown to the player, no response req … |
| BR-5 | B5a | the UTC pin import removed from the golden test (run in `TZ=America/Chicago`) | **KILLED** (3 failing) | agent-evaluate.callRecords.offGolden.test.js › the process runs in UTC whatever the machine timezone, pinned by the FIRST import (review BR-5) |
| BR-5 | B5b | the pin module sets nothing (run in `TZ=America/Chicago`) | **KILLED** (3 failing) | agent-evaluate.callRecords.offGolden.test.js › the process runs in UTC whatever the machine timezone, pinned by the FIRST import (review BR-5) |
| BR-5 | B5c | the .gitattributes LF entry removed | **KILLED** (1 failing) | agent-evaluate.callRecords.offGolden.test.js › the fixture is checked out as LF on every platform: its .gitattributes entry pins it, and the checked-o … |
| BR-5 | B5d | this suite's rules parser reverted to an LF-only split | **KILLED** (1 failing) | callRecordsRulesIndex.test.js › this suite's parser: every block, comments stripped, is identical under CRLF — the queue's inline comment included |
| BR-5 | B5e | the rules-suite copy of the parser reverted to an LF-only split | **KILLED** (1 failing) | callRecordsRulesIndex.test.js › the rules-suite copy (test/rules/callRecordsRulesSuite.mjs): every block, comments stripped, is identical under CRLF — … |

### 13.8 Still open, and found outside this task

**Open before shadow:**
1. **BR-4.** A versioned contract and spec amendment that incorporates A-1 and the per-call E-3 rule.
   - It retires the contrary clauses: contract §4's "hash without watchlist", spec §3.6, spec §3.8's `observedAtMs > expiresAtMs` for `next_check`, and contract §5 and §6.
   - It moves their hash pins together.
   - The review also asks it to keep the "one committed judgment" wording and to align the tool's `next_check` horizon text with the judgment boundary. That text is model-visible, and this build did not change it.
2. **C-4 / BR-3 sign-off** on the exact model-visible text diff (13.3).
3. **C-5:** a real `countTokens` measurement of the tool with declarations.
4. **Deployment prerequisites (§10):** publish the rules and create the `calls` index.

**Found outside the task** (reported, not fixed):
- **The gameplan expiry is built in process-local time** (`api/cron/agent-evaluate.js:5949-5952`). This is a **product** issue, not only a test issue, and it predates Build 0.
  - The code builds "4:00 PM ET" by parsing an ET wall-clock string as local time, then calling `setHours(16)` in local time. That is correct only in a process running in ET.
  - In a UTC process the result is 16:00Z, which is 12:00 ET during daylight time. The golden captured exactly that.
  - The review names correcting it as a separate task.
- **`api/_utils/intradayPromptExclusions.test.js:54-62`:** a source regex with a literal `\n` fails on a CRLF checkout. It fails the same way at `987a9a68`, so it predates Build 0.
- **`test/rules/agentEvalRunsDenials.rules.mjs:133`** has the same LF-only rules parser this build fixed in its own two copies. Its target block (`firestore.rules:914`) carries an inline comment, so its posture row would fail on a CRLF checkout. It predates Build 0 and was not run here under CRLF.

### 13.9 Where the rest of this report is now out of date
- **Executive verdict, "Your decisions before switching to shadow":**
  - Item 2 (E-3) is superseded by BR-1's per-call rule.
  - Item 3 (C-4) now means confirming the BR-3 text diff.
  - BR-4 is a new prerequisite.
- **Executive verdict, "Independent review" and "Next steps":** Astra's branch review is done (this section). Its shadow gate is BR-1 through BR-4, and BR-4 remains.
- **§12.2** describes the battle-clock rule and the status field `observedAtMs`. BR-1 removed both (13.1).
- **§3 anchors:** the `file:line` anchors for `flip.js`, `observe.js`, `agentEvalToolSchema.js` and `agent-evaluate.js` predate these commits. The anchors in §13 are current.
- **The PR description** is now a two-paragraph summary that links to this report.
