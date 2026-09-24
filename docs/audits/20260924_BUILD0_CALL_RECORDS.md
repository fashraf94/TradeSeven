# Cockpit Build 0 — Call records foundation (build report)

**Date:** 2026-09-24 · **Builder:** Claude Code · **Branch:** `claude/cockpit-build0-call-records` · **Spec:** Cockpit Spec V1.3 §2–§3 · **Flag:** `CALL_RECORDS_MODE` ships `'off'`; no flip in this PR.

> **Status of this file:** the pins and the §1 reconciliation gate below were written and committed **before any source change** (the gate is read-only). The build sections are appended at delivery.

---

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
3. **Gameplan rows' examined set** = the held names the R11 deterministic pass evaluated with `applyGuardrails` (`:5078`), frozen inside the pass at that instant. A pass that returned before evaluating (no deployed guardrails, `:5069-5076`, or the executor flag off, `:5057`) examined nothing: no usable observation, so no flips on that exit (§3.8 requires one).
4. **Composition rows 3 and 4** are gated unavailable (no pilot registration), per spec §2.

Nothing above is a STOP: a stale anchor is a moved seam; every shape the spec reads is the shape HEAD has.

---

*(§§2–10 — build, composition proof, margins, mutation table, review findings, deployment checklist — are appended at delivery.)*
