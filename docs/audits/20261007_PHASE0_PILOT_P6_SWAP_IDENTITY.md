# Phase 0 — Pilot P6: Swap Identity Check (G01)

**Prompt:** "Phase 0 Prompt — Pilot P6: Swap Identity Check (G01)", Fable, 7 October 2026. **Session:** Claude Code, 7 October 2026, read-only discovery in its own worktree. **Branch:** `claude/phase0-p6-swap-identity`, cut from `origin/main` at **HEAD `e0993cba`** (`git fetch origin main` run first; `origin/main` = `e0993cba`, "Merge pull request #938"). The desktop app named the local worktree branch `claude/phase0-p6-swap-identity-45a757`; it is pushed under the prompt's name. **Tree clean at open and at close; no source changed** — the branch carries exactly one commit, this report. **No tests run, no credentials used, no network, no production reads.**

**Evidence labels:** **VERIFIED** = the line was read at HEAD `e0993cba` in this session; **TEST** = read from a test or fixture file at HEAD; **DOC** = asserted by a document, not checked in code; **INFERRED** = derived from verified reads, not itself read. Every path is the path `git ls-tree` reports at HEAD; every line number is at HEAD. Earlier maps (the September audits) are cited by their own line numbers at their own baselines and corrected where they drifted.

---

## Executive verdict

| # | Question | Verdict in one line |
|---|---|---|
| Q1 | The executor today | **G01 confirmed at HEAD.** `executeSwapServer` re-reads the battle inside its transaction, takes the outgoing stock as *whatever occupies the caller's tier and index at that moment* (`api/_utils/agentSwapExecution.js:159-166`), and checks only that something is there, that in ≠ out, and that the incoming stock is not already held. It never compares the occupant to the stock the decision was about, and it never reads `battle.status`. Both of IR-6's "two missing checks" are missing. |
| Q2 | Every production caller | **Six, exactly as BUILD_RULES §7 says**, all in `api/cron/agent-evaluate.js` (`:2021`, `:3589`, `:4826`, `:5048`, `:5450`, `:5676`); no seventh anywhere in `api/`, `src/` or `scripts/`. Two of the six (approved proposal, expired co-pilot proposal) pass a tier and slot index **stored minutes earlier**; four resolve the slot moments before the call. On a refusal, two callers tell the player nothing and one writes a history row saying the swap `auto_executed` when it did not. |
| Q3 | How the slot changes underneath a caller | **Only the executor itself writes slot symbols** on a live battle; nothing else (not deploys, directives, meetings, completion, the nightly reset, or any client write) changes which stock sits in a slot. So the hazard is one executor call landing on a belief formed before another executor call: a stored proposal or meeting executed on a later tick after the risk loop has traded, or an overlapping worker after the 120 s lock ages out. **The approved-proposal path is the widest window (unbounded) — confirmed**, with the expired co-pilot proposal (≤ ~25 min, the exact DCR-002 P02 shape) and the approved meeting (unbounded, live UI, symbol-only belief) behind it. |
| Q4 | What identity to check | **There is no position id, entry id, slot generation or portfolio revision at HEAD.** The smallest complete identity every caller can supply from fields it already reads is **`{ symbol, swappedInAt ?? null }`**: creation-time positions carry `null`, every swap-in carries its own instant (`agentSwapExecution.js:287`, the only writer), the nightly reset leaves it alone, and a symbol that leaves and returns carries a new instant. Four callers can supply it today; the two proposal paths and the meeting path must **store** it at creation (non-fenced sites) or run symbol-only and say so. |
| Q5 | What a mismatch should do | **Hold and record, at every caller, protective exits included**: a stop whose stock has already left has nothing to protect, and the new occupant has not been evaluated on its own numbers; the next tick's risk loop evaluates it. The refusal is a **failure-dimension fact** (`reason: outgoing_identity_mismatch`), never a fourth R3 protective outcome and never a new `holdKind`. **The cockpit can never write `acted` for a refusal** (proven); **it also writes no "no matching trade"** — a refusal yields *no* receipt today, by the heard writer's own rule (null result = unknown). The prompt's expectation on that point is corrected below. |
| Q6 | Rollout shape | `SWAP_IDENTITY_MODE ∈ { off, shadow, enforce }`, the `CALL_RECORDS_MODE` string-tri-state pattern. **Smallest shadow home: a conditional `identityCheck` object on the trade the executor already writes** (`trades[i]`), inside the same transaction — zero new writes, zero new collections, absent at `off`. **A pre-build census is possible today from existing records**: the belief symbol is embedded in `trades[].evaluationId` for four callers and in `evaluations[].symbolOut` for the model path, and the committed symbol is `trades[].symbolOut`. |
| Q7 | Verification evidence | Emit `{ verificationId, mode, expected, found, verdict, battleStatus, slot, tradeSeq, checkedAt }` from inside the transaction; on success it rides the trade row, on refusal it rides the typed error into each caller's existing refusal channel (evaluation entry, capture `checks.execution.reason`, feed beat, proposal history). **Existing records, no new collection**; P5's capture extension is the durable home for refusals. |
| Q8 | Clock and data seams | Six clock reads (`:127`, `:129`, `:132`, `:165`, `:183`, `:320`) and one network fetch (`:144`, pre-transaction, conditional). One trailing options bag (`{ now, fetchDailyReference }`) with defaults is byte-identical when unused. **Land them in P6**: same fenced function, same review, and the identity acceptance rows need a frozen clock anyway (Guard 3's activation-day branch depends on "today"). |
| Q9 | Tests and fixtures | Strong harnesses exist (an in-memory transaction double, an optimistic-concurrency **retrying** double, the tick-stamps harness with a frozen clock, four byte-pinned goldens). **The DCR probe file IR-3 promised is not in the repo**; the acceptance set re-creates the P02/P03 shapes. Twelve acceptance rows proposed. |
| Q10 | Fence protocol | **One fenced file** (`agentSwapExecution.js`), founder-gated by this package's prompt, §2 multi-lens adversarial review, `vite build`, mutation check, written record. Three things would make the change larger than the fix and are kept out: a minted position id (touches the fenced `createAgentBattle` shape), writing the verdict into the capture record (a schema bump that is P5's), and a new Firestore subcollection (rules, rules tests, index). One source pin in `agent-evaluate.test.js:134-143` breaks on any new trailing argument and must move in the same commit. |

**Corrections to the inputs (plan-said vs code-did):** the register's G01 anchors are at a September baseline and have drifted (current anchors in §1); the capability audit's note that "the mode UI is removed" is true for proposals but **the meeting-approval card is live** (`src/components/Agent/AgentActivityFeed.jsx:760`); the ledger's header still says "five" call sites (`api/_utils/tournamentAgentLedger.js:5`) while BUILD_RULES §7 and the code say six; spec §8.2's ref table has no row for the §7 verification identity; the prompt's Q5 premise that the matcher would report "no matching trade" for a refused swap does not hold (§5.4).

---

## 0. Preamble

### 0.1 Session open (BUILD_RULES §2/§3)

- `git fetch origin main` run first (§3). Local worktree branch `claude/phase0-p6-swap-identity-45a757` at `e0993cba` = `origin/main`. Tree clean. VERIFIED.
- Mode: read-only. The only write is this file. No fenced function was called (none is callable from a document).
- Report also written outside the repo tree (session scratchpad) and offered for download (§3).

### 0.2 Inputs found on `main`

| Input | Path at HEAD | Read |
|---|---|---|
| Pilot spec V1.4 | `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` — §6 `:82-97`, §7 `:99-101`, §9.1–9.3 `:115-119`, §10.3 `:131` | VERIFIED |
| Integrity register V2 | `docs/20260923_INTEGRITY_FINDINGS_REGISTER_V2.md` — G01 `:245`, G02 `:246`, IR-6 `:159-161`, C-table `:88-89`, build order step 6 `:207` | VERIFIED |
| Expanded capability audit (Sep 23) | `docs/audits/FantasyTrades_Expanded_Capability_Reuse_Audit_2026-09-23.md` — G01 row `:537`, ranked item 1 `:591` | VERIFIED |
| S2 architecture audit | `docs/FantasyTrades_S2_Architecture_Audit_2026-09-21.md` — executor note `:70`, G01 `:251-258`, G02 `:260-267` | VERIFIED |
| Language tables | `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` — §A `:6-14`, §E `:51-53` | VERIFIED |
| Call record contract + B + C | `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` (§4 `outcome` `:66`), `…_AMENDMENT_B.md` (B.9 `:16`, B.13 `:20`), `…_AMENDMENT_C.md` (C-3 acted match `:76`) | VERIFIED |
| BUILD_RULES | `docs/BUILD_RULES.md` — §1 `:10-32`, §2 `:34-53`, §3 `:55-62`, §7 `:84-91`, §8 `:93-96` | VERIFIED |
| DCR audit (for DCR-002) | `docs/audits/2026-09-20_DATA_CONSISTENCY_CONCURRENCY_RETRY_AUDIT.md:106-118` | VERIFIED |
| SI audit (for F08) | `docs/audits/2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md:149-161` | VERIFIED |

The pilot spec is present, so the STOP condition did not fire.

### 0.3 Method

Direct reads only, no subagents. The executor was read in full (`api/_utils/agentSwapExecution.js`, 413 lines, last changed 2026-08-20 in `647d50cf`). `api/cron/agent-evaluate.js` (6,464 lines, last changed 2026-10-03) was read at every executor call site, the lock, the proposal and meeting handlers, the suppression pass, the evaluation entry and its commit, plus the creation sites for proposals and meetings. Callers were enumerated by `grep` for `executeSwapServer` across `api/`, `src/` and `scripts/` (test files excluded), and the result cross-checked against the repo-level consumer pin in `api/cron/agent-evaluate.test.js:827`. Slot writers were enumerated by `grep` for `portfolio.` key writes and whole-object `portfolio:` writes across `api/`, `src/services` and `scripts/`.

### 0.4 What was not inspected (bounds)

`evaluateRisk` and `applyGuardrails` internals (fenced; only their outputs at the call sites were read); `validateTradeToolResult`; the Mandate executor (`api/_utils/mandateExecution.js`, a different mode and collection); the user-layer `src/services/swapServiceV4.js`; `resolveTournamentContext` and the ledger beyond the cron's wrappers; `captureWriter` beyond its batch write; `getETDate`'s body; the Firestore rules test suites; client components beyond their mount points; production data of any kind. Missing inspection is not evidence of absence; each bound is named where it matters below.

---

## 1. Q1 — The executor today

**File:** `api/_utils/agentSwapExecution.js` (fenced, BUILD_RULES §1 `:15`). The only production importer is `api/cron/agent-evaluate.js:54`. VERIFIED.

### 1.1 Signature

`executeSwapServer(db, battleId, battle, resolvedTier, resolvedSlotIndex, benchAsset, currentDay, currentPrices, evaluationMetadata = {}, snapshot = null)` — `:117`. The caller supplies the position **by tier and index**, the incoming stock **as an object** (`benchAsset`), and its own in-memory `battle` snapshot. Returns `{ closedTrade, incomingAsset }` (`:369`). VERIFIED.

### 1.2 What it reads before the transaction

| Line | Read | Kind |
|---|---|---|
| `:127` | `formatDateString(getETDate())` — today, ET | wall clock |
| `:128-130` | `battle.activatedAt` converted via `new Date(...).toLocaleString('en-US', { timeZone: 'America/New_York' })`, else today | wall clock |
| `:132` | `new Date().toISOString().slice(0,10)` — today, UTC | wall clock |
| `:134-135` | `preOut = battle.portfolio[tier][slot]` and its `startingPrices` entry — **the caller's snapshot, not the live doc** | caller belief |
| `:136-138` | `guard3NeedsRef`: true only when `preOut` has no `swapPrice` and is not a validated day-1 starting price | derived |
| `:141-150` | `await getStockAnalysisData(preOut.symbol, { forceRefresh: true, fields: ['daily','price'] })` — **a network fetch**, only when `guard3NeedsRef` | data fetch |

All VERIFIED. The fetch is outside the transaction by design (`:126`).

### 1.3 Inside the transaction (`:152-370`)

1. `transaction.get(battleRef)` `:153`; missing doc → `throw new Error('Agent battle not found')` `:154-156`.
2. **`outAsset = liveData.portfolio[resolvedTier]?.[resolvedSlotIndex]`** `:159`; empty → `throw new Error('Asset no longer available in slot')` `:161-163`.
3. `now = new Date().toISOString()` `:165` (wall clock, inside the transaction — re-read on every retry).
4. **`outSymbol = outAsset.symbol`** `:166` — **this is how the outgoing stock is picked: by position, from the live read, with no comparison to anything the caller believed.** `inSymbol = benchAsset.symbol` `:167` — from the caller's object, never re-checked against the live bench.
5. Self-swap `:172-174` and duplicate-incoming `:175-178` throws (the VWAP Floor B5 invariants).
6. Live beacon preferred when fresher than 2 min (`Date.now()` `:183`) `:181-188` — so the executed price can differ from the caller's quote (the S2 audit's `:70` note; confirmed).
7. Entry/exit prices `:191-194`; mode config `:201`; locked points `:203-252`. **The only place the caller's belief meets the live occupant is `:230`**: `daily: guard3Symbol === outSymbol ? guard3Daily : null` — and its sole effect is whether the pre-fetched daily reference is used for the badge baseline. A changed occupant silently loses the reference; it is never refused.
8. `closedTrade` `:255-273` — carries `...evaluationMetadata` (`:270`) and `snapshot` (`:272`).
9. Incoming price `:276`; `<= 0` → `throw new Error('Cannot complete swap: no valid price …')` `:277-279`.
10. `incomingAsset` `:281-299` — `swappedInAt: now` `:287`, `swappedInDay: currentDay` `:288`.
11. Slot write `:302-303`; threshold reset `:306-311`; bench round trip `:314-351` (cooldown `Date.now() + 24h` `:320`); `trades` capped `slice(-50)` `:354`; `updates` `:357-365` (`tradeCount + 1` `:363`); `transaction.update` `:367`.

All VERIFIED.

### 1.4 Every check it makes, and the ones it does not

| Check | Where | Present |
|---|---|---|
| Battle document exists | `:154` | yes |
| Slot at (tier, index) is non-empty | `:161` | yes |
| in ≠ out | `:172` | yes |
| in not already in an active slot | `:175` | yes |
| incoming has a usable price | `:277` | yes |
| **occupant is the stock the decision was about** | — | **no** (G01) |
| **battle is still active** (`status`) | — | **no** (IR-6's second check; `status` is not read anywhere in the file) |
| incoming is still on the live bench / not on cooldown | — | no (symmetric staleness on the in-side; outside G01, noted for completeness) |
| tier/index still refers to the same position as at decision time | — | no (slots never move, but their occupants do) |

VERIFIED by reading `:117-371` end to end.

### 1.5 Returns and refusals

Success: `{ closedTrade, incomingAsset }` `:369`. Refusals: four untyped `throw new Error(message)` at `:155`, `:162`, `:173`/`:177`, `:278`. Callers distinguish nothing but the message string (the model path renders the string into `validationErrors[0]`, §2). There is no typed outcome today. VERIFIED.

### 1.6 G01 as stated — confirm or correct

- Register `:245` "the swap executor validates the current slot occupant, not a required expected-outgoing identity, at commit" — **confirmed**, with one precision: it validates that *an* occupant exists (`:161`), not the occupant's identity in any sense.
- Capability audit `:537` "checks live slot existence/self/duplicate, but uses current occupant rather than a required expected outgoing identity" — **confirmed**. Its anchors (`agent-evaluate.js:4384`, `:2126`, `:5241`; `agentSwapExecution.js:152`) are at `f6728ffc` and have drifted; current anchors are in §2.
- S2 audit `:70` "transactionally rereads the slot … A fresh live beacon may replace the price supplied by the caller" — **confirmed** (`:153`, `:181-188`).
- Register IR-6 `:159-161` "the battle is still active, and the stock being sold is the one the decision was about" — **both absent at HEAD, confirmed**. IR-6's gate ("opens after the eval-fixes PR merges") is satisfied: the T1–T4 integration landed 2026-09-19 (`docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md`). DOC.
- `validateTradeDecision` (`:28-90`) is a caller-side mirror that resolves tier/slot **by symbol on the caller's snapshot** (`:35-41`) — it is the belief-former for the model path, not a check at commit. VERIFIED.

---

## 2. Q2 — Every production caller

### 2.1 The census

`grep -n "await executeSwapServer(" api/cron/agent-evaluate.js` → `:2021`, `:3589`, `:4826`, `:5048`, `:5450`, `:5676`. No other call expression in `api/`, `src/` or `scripts/` (test files and comments excluded); the repo-level pin `api/cron/agent-evaluate.test.js:827-840` enforces exactly this set (TEST). BUILD_RULES §7 `:88` says six — **current**. `api/_utils/tournamentAgentLedger.js:5` still says "the five non-fenced call sites" — a stale comment, report only. All VERIFIED.

Shared wrappers every site uses (VERIFIED): `reserveTournamentSymbolIn` `:731-740` (no-op `{reserved:true}` for regular battles), `confirmTournamentSwap` `:651-669` (sources symbols from the **actual** `closedTrade`, with the comment at `:2043-2044` stating the hazard in the code's own words: *"executeSwapServer swaps whatever occupies the slot at transaction time"*), `releaseTournamentReservation` `:674-681`, `refreshBattleFromDoc` `:710-721` (the single re-read chokepoint; returns `false` on an empty read), `captureFor()` `:4713-4715` (the helpers reach their own tick's capture context).

### 2.2 Caller rows

**C1 — Risk route** (`:1795-2243`). VERIFIED.
- *Trigger:* the risk manager's per-position verdicts collected as `riskSwaps` before the loop; the loop at `:1795` destructures `{ score, asset, riskResult }`.
- *Belief:* `score.symbol`, from `assetScores` built at tick admission from `battle.portfolio`; the slot is resolved **by symbol on the in-memory battle immediately before the call** (`:1908`), and the in-memory battle is refreshed after every earlier commit (`:2203`). Moment: the same tick, seconds before the call.
- *Incoming and slot:* `replacement` from the in-memory bench (`:1843-1870`); `slot.tier/slotIndex` (`:1908`).
- *Awaits between belief and commit:* `qualifyCascadeReplacement` fetch (`:1916`, only when the VWAP cascade guard is active); `reserveTournamentSymbolIn` (`:1998`, tournament only); then the executor's own guard-3 fetch (`agentSwapExecution.js:144`).
- *On refusal today:* `catch` `:2222-2243` → `console.error`, feed beat `action: 'risk_swap_failed'` with `symbolOut: score.symbol` (the belief) `:2226-2239`, compensating release `:2242`; the loop **continues** to the next risk swap. No capture check, no evaluation entry (risk swaps carry no eval id: `:2057`).
- *Recorded after success:* capture `action` from `closedTrade` (`:2029-2039`); confirm (`:2045-2049`); narration queued with `evalId: null` (`:2056-2059`); feed beat with `symbolOut: score.symbol` — **the belief, not the committed symbol** (`:2060-2073`); `summary.swapped`; L1 receipt with `outgoingSwappedInAt` from the pre-swap position (`:2089-…`, position read at `:2017-2019`); refresh (`:2203`), and on a failed refresh the tick stops discretionary work (`:2209`, F1b). The cockpit matcher is **never fed** (only `:3595` carries a result). Film tape: `trades[]` is the spine (`src/screens/battleView/buildTape.js:16-30`); the server tape joins tick actions, trades and receipts on `swappedOutAt + symbols` (`api/_utils/filmTape/tapeAssemble.js:404-418`).

**C2 — Model route** (`:3366-3777`). VERIFIED.
- *Trigger:* trigger gate passed, the model returned `SWAP`.
- *Belief:* `haikuResult.symbolOut` — the model's own output, grounded in the prompt finished at `promptBuiltAt` (`:2734`) from the in-memory battle, which was refreshed and rebuilt after the risk loop (`:2279-2314`). `validateTradeDecision(haikuResult, battle)` (`:3366`) resolves tier/slot by symbol on that same snapshot. Nothing refreshes `battle` between the prompt build and the entry write — pin 3 of `agent-evaluate.tickStamps.pins.test.js`, cited at `:4166-4169` (TEST). So **within the tick the belief cannot drift**.
- *Incoming and slot:* `benchAsset = findBenchAsset(battle.portfolio?.bench, haikuResult.symbolIn)` (`:3486`); `validation.resolvedTier/SlotIndex` (`:3591`).
- *Awaits:* the model call itself (`messages.create` `:2776`, 20 s SDK timeout, 22 s hard ceiling — `api/_utils/agentEvalTransport.js:14`); synchronous validation, guardrails, hurdle (`:3414-3429`) and cap (`:3437-3444`); reserve (`:3557`); the executor's guard-3 fetch.
- *On refusal today:* `catch (swapErr)` `:3758-3777` → capture `checks.execution = { status: 'failed' }` only if `executorAdmitted` (`:3760-3772`); `validationErrors.push('Swap execution failed: …')` (`:3774`); `decision = 'HOLD'`, `downgraded = true` (`:3775-3776`); release. The evaluation entry then records `decision: HOLD`, `symbolOut` = the belief (`:3944`), `validationErrors`, `downgraded`, `holdKind: null` (`:3968-3969`, `:4003`); the battle view renders *"Argued for a swap · it did not go through"* off the `Swap execution failed` prefix (`src/data/decisionRecord.js:88-98`, `src/screens/battleView/selectWhyState.js:160-166`).
- *Recorded after success:* `carryExecutorResult(callsCtx, swapResult)` (`:3595` — symbols, tier and slot from `closedTrade`, `api/_utils/callRecords/observe.js:205-221`); capture `action` + `checks.execution = passed` (`:3598-3608`); confirm (`:3613-3617`); narration with the eval id (`:3621-3624`); L1 receipt (`:3627-3745`); the evaluation entry with `decision: SWAP` and **`symbolOut: haikuResult.symbolOut` (the belief)** while **`trades[i].symbolOut` is the committed symbol** — two records that can disagree today, joined by `evaluationId === evalId`. The cockpit's heard pass decides `acted` from the carried result (`api/_utils/callRecords/flip.js:146-165`, `heard.js:93-94`).

**C3 — Approved proposal** (`:4781-4969`, inside `handlePendingProposal` `:4751`). VERIFIED.
- *Trigger:* `battle.pendingProposal.resolvedAt && resolution === 'approved'` (`:4779-4781`). The resolution is written **by the client**: `src/services/agentService.js:583-595` spreads the client's copy of the whole proposal and sets `resolution`; `firestore.rules:456-459` lets the owner write `pendingProposal` and `executionMode` wholesale. Reached only when `executionMode !== 'autopilot'` — the launch guard (`:4755-4772`) clears proposals on autopilot battles, and the model path forces autopilot at creation (`:3398-3405`). **No shipped UI reaches it**: `ProposalCard`, `ProposalBanner` and `ExecutionModeToggle` are imported only by `src/components/Agent/AgentStrategyTab.ARCHIVED.jsx` and the toggle import is commented out in `src/screens/AgentBattleScreen.jsx:98`. An owner's direct Firestore write can (G01's alternate authority).
- *Belief:* `proposal.symbolOut`, `proposal.tier`, `proposal.slotIndex` — **stored at proposal creation** (`:3807-3813`, from that earlier tick's `validation.resolvedTier/SlotIndex`), or written by the client. Moment: creation (TTL 10 min co-pilot / 15 min manual, `:3786`) or whenever the client wrote it.
- *Incoming and slot:* `proposal.symbolIn` re-resolved on the in-memory bench at execution (`:4788`, fresh); the slot is the **stored** tier and index, passed straight through (`:4828`).
- *Awaits:* `fetchPricesForProposal` (`:4786` — two `forceRefresh` fetches, `:4728-4741`); reserve (`:4792`); the executor's fetch. **The approved branch runs before the expiry check** (`:4779` vs `:4998`), so an approved proposal executes however old it is.
- *On refusal today:* `catch` `:4955-4963` → `console.error`, feed beat `action: 'hold'` "Approved swap failed: …" (`:4957-4961`), release; then the proposal is moved to `proposalHistory` **still carrying `resolution: 'approved'`** and cleared (`:4966-4968`) — the history shows an approval with no sign it never executed.
- *Recorded after success:* capture `action` via `captureFor()` (`:4848-4858`); confirm (`:4859`); feed `action: 'swap', source: 'proposal_system'` with the **belief** symbols (`:4866`); L1 receipt (clears `pendingProposal` before its await, `:4892`); **no narration** (TODO at `:4813-4817`); no evaluation entry of its own (the tick continues to the model path). Cockpit: never fed.

**C4 — Expired co-pilot proposal** (`:5009-5157`). VERIFIED.
- *Trigger:* an unresolved proposal past `expiresAt` with `mode === 'copilot'` (`:4998-5009`).
- *Belief:* the same stored tier/slot/symbolOut from creation. **While the proposal is pending, every tick returns `skip_haiku` (`:5002-5006`) after the risk loop has already run** — `handlePendingProposal` is called at `:2317`, below the loop — so protective exits can replace the proposal's slot during the TTL, and the expiry tick then hands the executor the stale tier and index (`:5050`). This is DCR-002's P02 reproduction shape exactly (DCR audit `:106-118`).
- *Incoming and slot:* bench re-resolved (`:5015`); stored slot (`:5050`).
- *Awaits:* fetch (`:5014`), reserve (`:5019`), the executor's fetch.
- *On refusal today:* `catch` `:5153-5157` → **`console.error` and release only — nothing player-visible**; then `resolvedProposal.resolution = 'auto_executed'` is written to history (`:5172-5175`) **even though nothing executed** — a false record.
- *Recorded after success:* capture `action` (`:5065-5075`); confirm (`:5076`); feed `swap` (`:5083`); L1 (clears first, `:5100`); no narration; cockpit never fed.

**C5 — Suppression guardrail pass** (`runSuppressionDeterministicPass` `:5236-5618`; invoked at `:2361` on a pending meeting and `:2403` on a newly created one; gated by `PROFIT_TARGET_EXECUTOR_ENABLED`, `:5243`, which is `true` at HEAD — `src/config/featureFlags.js:1984`). VERIFIED.
- *Trigger:* `applyGuardrails` on the in-memory battle returns `SWAP` with a `guardrail_*` source note (`:5264-5272`, `:5351-5356`).
- *Belief:* `deterministicResult.symbolOut` from that evaluation; slot by symbol at `:5359`. The in-memory battle was refreshed after the risk loop. Moment: the same tick, seconds before.
- *Incoming and slot:* bench lookup (`:5364`); `slot.tier/slotIndex`.
- *Awaits:* reserve (`:5429`); the executor's fetch.
- *On refusal today:* `catch` `:5584-5617` → capture `guardrail({ suppressionPassFaulted: true, faultClass: 'guardrail_error', message })` (`:5589-5597`) — **an executor refusal is filed under the guardrail fault class**; feed `risk_swap_failed` (`:5599-5613`); release.
- *Recorded after success:* capture `action` (`:5455-5465`); confirm (`:5469`); narration with `evalId: null` (`:5475-5478`); feed `guardrail_forced_swap` with the belief symbols (`:5486`); L1; refresh (`:5582`). The tick exits `gameplan_pending` / `gameplan_created` with **no evaluation entry**. The calls observation was frozen before the pass could trade (`:5279-5283`, BR-2). Cockpit: never fed (`flip.js:283` reads the result only on `model_result`).

**C6 — Meeting rotation** (`handleGameplanMeeting` `:5624-5848`). VERIFIED.
- *Trigger:* `battle.gameplanMeeting.status === 'approved'` (`:5629`), written by the client: `src/services/agentService.js:622-635` re-reads the meeting and writes `status` (rules allow the owner to write `gameplanMeeting` wholesale). **The approval UI is live**: `GameplanMeetingCard` is mounted in `src/components/Agent/AgentActivityFeed.jsx:760`.
- *Belief:* `swap.symbolOut` from `meeting.suggestedSwaps[]`, written at meeting **creation** by `detectGameplanMeetingTrigger` (`:5963-5968`: each leg is `{ symbolOut, symbolIn, rationale }` — **no tier, no slot, no identity**). At execution the slot is re-resolved **by symbol** on the in-memory battle (`:5645`); `if (!slot) continue;` (`:5646`) skips a departed symbol **silently**, and finds a returned symbol as if it were the original. Moment: creation (expiry 4 PM ET, `:5972-5975`), but **the approved branch runs before the expiry check** (`:5629` vs `:5827`).
- *Incoming and slot:* bench lookup at execution (`:5636`); the re-resolved slot.
- *Awaits per leg:* reserve (`:5650`); the executor's fetch; the loop refreshes after every leg (`:5801`).
- *On refusal today:* `catch` `:5802-5806` → **`console.error` and release only**; the loop continues; the meeting is moved to history and cleared (`:5808-5811`). Silent to the player.
- *Recorded after success:* capture `action` (`:5693-5703`); confirm (`:5706`); narration with `gameplanEvalId` (`:5717-5720`); feed `swap`, `source: 'gameplan_meeting'`, belief symbols (`:5724`); L1 (`:5750-5799`); refresh (`:5801`). No evaluation entry of its own. Cockpit: never fed.

### 2.3 Two observations that cut across the rows

- **Three of the six paths record the belief, not the commit, in the player-visible feed** (C1 `:2060-2073`, C5 `:5486`, C6 `:5724`; C3/C4 likewise). Only capture `actions[]`, `trades[]` and the ledger confirm use the committed symbols. BUILD_RULES §9's display-agreement rule already names this bug family. VERIFIED.
- **Capture's `checks.execution` is written at one site only** (C2, `:3574`, `:3608`, `:3767`). The other five record a committed `action` but no execution verdict, and on refusal C3, C4 and C6 record nothing in capture at all. VERIFIED.

---

## 3. Q3 — How the slot can change underneath a caller

### 3.1 Who writes slot symbols at HEAD

Bounded search: `grep` for `` `portfolio.${ ``, `'portfolio.star'` and siblings, and whole-object `portfolio:` writes across `api/`, `src/services`, `scripts/` (tests excluded). VERIFIED.

| Writer | What it changes | Can it change which stock is in a slot? |
|---|---|---|
| `executeSwapServer` `agentSwapExecution.js:358` | one tier array, bench, history, trades | **yes — the only one** |
| `createAgentBattle` `api/_utils/agentBattleService.js:155-157` | the whole portfolio at creation | creation only |
| `api/cron/agent-daily-scores.js:154-175` | rewrites the whole `portfolio` object nightly, deleting `swapPrice`/`swappedInDay` (moved to `previousSwapPrice`/`previousSwapDay`); **symbols and `swappedInAt` untouched** | no |
| `api/agent/set-opponent.js:94-96` | `opponent.portfolio` (the CPU opponent sub-object) | no (not the agent's slots) |
| `api/agent/decide.js:722-760` with an existing active battle | logs the new portfolio and returns; **no battle write** | no |
| Clients | `firestore.rules:456-459` allowlist: `executionMode, pendingProposal, battleLedger, updatedAt, strategyPreset, gameplanMeeting, gameplanMeetingHistory, dailyGrades, feedBookmarks, reviewDecisions` | no |
| Directives, meetings, completion (`completeBattle` `:6075-…` writes `status`, never `portfolio`), forced exits | none writes a slot | no |

So "the slot changed underneath a caller" always means **another executor call committed between the belief and this commit**. The lock does not prevent it: the lock transaction refreshes only `controlEpochLog` and `regimeAtStart` onto the tick's query-time snapshot (`:829-838`), ages out at 120 s (`:185`) against a 290 s budget (`:186`), and `finalizeCronState` clears it unconditionally (`api/_utils/agentCronState.js:37`). The cron runs every 15 min on weekdays (`vercel.json:157-158`), so an overlap needs a manual or duplicate invocation rather than ordinary cadence; the lease is still unfenced (DCR-002 part 2, the sharding spec's item). VERIFIED.

### 3.2 Per caller: what can intervene

| Caller | Same tick, earlier | Later tick | Overlapping worker | Completion |
|---|---|---|---|---|
| C1 risk | earlier risk swaps — mitigated by refresh after each (`:2203`), loop stops on a failed refresh (`:2209`) | n/a (belief is seconds old) | yes | not checked by the executor |
| C2 model | risk loop — mitigated by the post-loop rebuild (`:2279-2314`); pin 3 proves no refresh gap after the prompt | n/a | yes (lease case) | not checked |
| C3 approved proposal | the risk loop on **this** tick runs before the handler (`:2317`) | **every** intervening tick's risk loop and suppression pass; a player approving minutes or days later; a client rewriting the object | yes | not checked |
| C4 expired proposal | same | every tick inside the TTL (`skip_haiku` returns after risk ran) | yes | not checked |
| C5 suppression | risk loop — mitigated by refresh/rebuild | n/a | yes | not checked |
| C6 meeting | risk loop on this tick; earlier legs of the same meeting — mitigated by per-leg refresh (`:5801`) | every tick since creation (risk loop + suppression pass on meeting-pending ticks `:2361`); approval ignores expiry | yes | not checked |

### 3.3 Ranking by window width — the approved-proposal path is the worst case, confirmed

1. **C3 approved proposal — unbounded.** Belief stored at creation or authored by the client; the approved branch ignores `expiresAt`; the stored tier and index are passed through. Dormant for the shipped UI, reachable by an owner write of `executionMode` + `pendingProposal` (the G01 alternate authority).
2. **C6 approved meeting — unbounded, live UI.** Approval ignores the 4 PM expiry; the belief is symbol-only, so a departed symbol is skipped silently and a **returned** symbol is traded as if it were the original position (§4).
3. **C4 expired co-pilot proposal — ≤ TTL + one cron interval (~25 min)**, with the risk loop running on every intervening tick. Dormant (mode forced autopilot), reachable by owner write. The reproduced P02 shape.
4. **C2 model — seconds** (≤ 22 s model call, synchronous gates, reserve, guard-3 fetch); in-tick drift impossible; cross-tick only via lease overlap.
5. **C5 suppression — seconds.**
6. **C1 risk — seconds**, belief resolved immediately before.

INFERRED from the VERIFIED reads above.

---

## 4. Q4 — What identity to check

### 4.1 What identifies a position at HEAD

Bounded search for `positionId | entryId | slotGeneration | portfolioVersion | portfolioRevision | bookRevision | positionKey` across `api/` and `src/`: only unrelated `entryId`s (academy, season, earnings). **No position id, entry id, slot generation or portfolio revision exists.** VERIFIED.

Fields a slot asset carries:

| Origin | Fields | Source |
|---|---|---|
| Creation | `symbol, name, baseATR, isCrypto, sector, [direction], [tierMultiplier]` | `agentBattleService.js:155-157`, `:399-406` (`deepCopyArrayWithSector`), `stampMode` — **no `swappedInAt`** |
| Swap-in | `symbol, name, isCrypto, baseATR, swapPrice, swappedInAt, swappedInDay, [direction], [tierMultiplier]` | `agentSwapExecution.js:281-299` |
| After the nightly reset | `swapPrice → previousSwapPrice`, `swappedInDay → previousSwapDay`; **`swappedInAt` kept** | `agent-daily-scores.js:154-168` |

`swappedInAt` has exactly one writer (`agentSwapExecution.js:287`; `api/_utils/researchCard.js:229` only reads it). VERIFIED.

### 4.2 Is the symbol enough? No.

A symbol can leave a slot and come back (the revolving-door bench, `:313-351`); the same symbol is then a different position with a different entry price and history. Symbol-only passes that case wrongly, and C6 already resolves by symbol (`:5645`), so a returned symbol is exactly the case it cannot see. Two creation-time positions cannot be confused with each other (one symbol per slot; the duplicate ban keeps symbols unique across the book). INFERRED.

### 4.3 Recommendation: `{ symbol, swappedInAt ?? null }`

- Creation-time positions carry `null`; every swap-in carries its own instant; a symbol that leaves and returns carries a new instant, and can only return after the 24 h cooldown (`:320`), so two instants never collide.
- **No new field is written anywhere**, so the fenced `createAgentBattle` document shape (BUILD_RULES §1 `:19`, fenced "as a concept" `:26`) and every reader stay untouched.
- The comparison inside the transaction is two field equalities on `outAsset` (`:159`).

The alternative — an executor-minted position id with creation-time ids — would touch the creation shape and every consumer, which is larger than the fix (§10).

### 4.4 Which callers can supply it today

| Caller | Can supply `{symbol, swappedInAt}` now? | From | Change needed |
|---|---|---|---|
| C1 risk | yes | `battle.portfolio[slot.tier][slot.slotIndex]` — already read at `:2017-2019` | pass it |
| C2 model | yes | `battle.portfolio[validation.resolvedTier][validation.resolvedSlotIndex]` — already read at `:3551-3553` | pass it |
| C5 suppression | yes | already read at `:5446` | pass it |
| C6 meeting | **not meaningfully**: `:5673-5675` reads the *current* occupant, so the check would be vacuous for the returned-symbol case | — | store `{symbol, swappedInAt}` per leg at creation (`:5963-5968`, non-fenced); a client-written meeting without it runs **symbol-only** and the verdict says so |
| C3 approved proposal | no — the proposal stores tier/slot/symbol only (`:3807-3813`) | — | store `outgoingSwappedInAt` at creation (`:3807`); legacy or client-written proposals run symbol-only and say so |
| C4 expired proposal | no — same record | — | same |

VERIFIED anchors, INFERRED recommendation.

---

## 5. Q5 — What a mismatch should do

### 5.1 The typed outcome

The executor refuses with a **typed error** carrying `reason: 'outgoing_identity_mismatch'` (and, if D3 is adopted, `reason: 'battle_not_active'`) plus the verification object of §7. Existing catches keep working unchanged (they read `err.message`); callers that want the typed reason read `err.reason`.

### 5.2 Checked against the vocabularies

| Vocabulary | At HEAD | Fit |
|---|---|---|
| Evaluation `holdKind` | `HOLD_KINDS = ['default_failure']` (`api/_utils/tickCapture/captureConfig.js:192`), meaning "the tick failed closed with no usable proposal" (`agent-evaluate.js:3993-4003`) | **Not a hold kind.** The model *did* propose; the refusal is an execution failure. Today's model-path refusal already keeps `holdKind: null` and uses `downgraded` + the `Swap execution failed` prefix. Keep that shape; add the typed reason beside it. Spec §6 `:86`: proposal, override, executed action and failure are separate dimensions — this lands in the failure dimension. |
| Capture `checks.execution` | `status ∈ {evaluated, bypassed, not_evaluated, unknown, failed}`, `result ∈ {passed, blocked, faulted}`, `reason: id` (`captureConfig.js:171-186`, `captureSerializer.js:103-108`) | **`status: 'evaluated', result: 'blocked', reason: 'outgoing_identity_mismatch'`** — a refusal is a verdict, not a crash; `failed` stays for throws with no verdict. `reason` is an existing `id`-kind field, so **no schema bump**. |
| R3 protective outcomes | `fired_replaced \| fired_slot_empty \| mode_blocked`, "untouched" (spec §6 `:84`; tables §A `:6-14`) | **None of the three.** Nothing fired, the slot is not empty, no mode rule applies. A fourth wire value would break "one enum". The protective-outcome field stays absent and the typed refusal sits in the failure dimension. |
| Cockpit receipts | `acted` from `matchesWholeTrade` on a **present** result; `no_matching_trade` from a present result that misses the leg (Amendment B B.9 `:16`; `heard.js:93-104`) | §5.4. |

### 5.3 Per caller on mismatch

| Caller | On mismatch | Why |
|---|---|---|
| C1 risk, C5 suppression (protective) | **Hold and record.** Feed beat with the typed reason; capture `checks.execution` blocked; no trade. **Never re-resolve by symbol and sell the new occupant.** | The stock whose stop breached is no longer held — there is nothing to protect. The new occupant has not been evaluated on its own numbers; the next tick's risk loop (every tick) evaluates it. Selling it would be a trade no rule asked for. |
| C2 model | Hold and record: `decision: HOLD`, `downgraded: true`, `validationErrors[0]` keeps the prefix, plus the typed reason on the entry (conditional key, §7) and capture. | The model's premise is gone; re-asking the model is the next tick's job. |
| C3/C4 proposals | Hold and record; the history row carries the typed refusal (**not** `auto_executed`). | Fixes the false history row (§2, C4). |
| C6 meeting | Hold and record per leg; the meeting history carries per-leg refusals; a departed-symbol leg stops being silent. | Fixes `if (!slot) continue;` silence (`:5646`). |

### 5.4 The cockpit's matcher — proven, with one correction to the prompt

- **Never `acted`.** `matchesWholeTrade` returns `false` unless the executor result has non-empty `symbolIn`, `symbolOut`, `tier` and an integer `slotIndex` (`api/_utils/callRecords/flip.js:146-149`); the result is carried only by `carryExecutorResult` at `agent-evaluate.js:3595`, **after** the awaited executor call, so a throw leaves `callsCtx.executorResult` at its initial `null` (`api/_utils/callRecords/mode.js:148`); `heard.js:49-52` (`executorResultPresent`) then returns `false` and `acted` (`:93-94`) is `false`; `outcome.actedEvalId` is written "only from a committed executor result after execution" (contract §4 `:66`). VERIFIED.
- **Not "no matching trade" either.** `noMatch = present && !acted && …` (`heard.js:100`); with no present result, nothing is written — *"a null result is unknown: nothing"* (`heard.js:21`; pinned by `heard.test.js:107` and `:204`, TEST). By Amendment B B.9 a no-match needs a present, parsed trade that misses the leg; a refusal is "no committed trade", which the writer treats as unknown by design. **So a refused swap yields no receipt at all today.** P6 should not change the matcher. A visible "the trade was refused" receipt on a call would be a new event kind for the cockpit arc (Build 1b/2b), not P6.
- The five non-model callers never feed the matcher (`flip.js:283`), so a committed proposal or meeting swap is never `acted` either — a standing limit, not a P6 item.

### 5.5 Player-facing lines (tables style; typed fields govern; no §E words)

Proposed as a new table **F. Execution refusals** in a V1.1 of the language tables (amendments version-bump, tables `:55`); founder blesses the wording (spec §11 `:136`).

| Wire value | Player line |
|---|---|
| `refused / outgoing_identity_mismatch` (model, proposal, meeting) | "The agent moved to swap [SYM] for [SYM2], but [SYM] was no longer in that slot when the trade reached the book. Nothing happened — the book had already changed, so the trade was not placed." |
| `refused / outgoing_identity_mismatch` (protective) | "Protection wanted to act on [SYM], but [SYM] had already left the slot by the time the trade reached the book. Nothing happened — the position it would have sold was a different one." |
| `refused / battle_not_active` (if D3) | "This trade reached the book after the battle had ended. Nothing happened." |

Each names what happened, claims no judgment call, and uses none of §E's words. The `[SYM]` placeholders are filled from `verification.expected.symbol`, never from the current occupant.

---

## 6. Q6 — Rollout shape

### 6.1 The flag

`SWAP_IDENTITY_MODE ∈ { off, shadow, enforce }` in `src/config/featureFlags.js`, a string tri-state pinned directly by a new `src/config/swapIdentityFlags.test.js` in the `callRecordsFlags.test.js:44-74` shape (value pin, frozen list, docstring pointer, never a `DARK_BY_DESIGN` key, resolver). Unknown values resolve to `off`. Precedent docblocks: `featureFlags.js:2786-2830` (`CALL_RECORDS_MODE`) and `:3086-3110` (`PILOT_JOURNEY_MODE`). VERIFIED. The executor reads the constant with an injectable override in its options bag (§8), so production reads the flag and the harness injects.

| Mode | Behaviour |
|---|---|
| `off` | No comparison computed; the `updates` object (`:357-365`) and the return value are byte-identical to today. |
| `shadow` | Compute `{ expected, found, verdict }` inside the transaction; write it as `closedTrade.identityCheck` (→ `trades[i]`) and return it; **the trade proceeds exactly as today**. This is the census. |
| `enforce` | As shadow, plus the typed refusal on `mismatch` (and on `battle_not_active` if D3). |

### 6.2 The smallest place for the shadow verdict

**`trades[i].identityCheck`, written by the executor in the same transaction.** Zero new writes, zero new collections, no caller change, absent at `off`, countable by a read-only script over `agentBattles.trades[]` in the shape of `scripts/shadow-read-call-records.mjs:160-206` (VERIFIED). Caveat: `trades[]` is capped at 50 (`:354`), so the census must run at least weekly, or read the capture `ticks` once P5 copies the verdict there. The capture permanent record is the right **durable** home, but adding a field to `actions.*` is a serializer-allowlist change and a schema bump (`captureSerializer.js:66-135`, `captureConfig.js:38`), which spec §10.3 `:131` assigns to P5 ("state facts arrive from P6").

### 6.3 A census is possible before any build

The belief symbol is already recorded beside the committed symbol in existing records (VERIFIED):

| Caller | Belief | Committed | Join |
|---|---|---|---|
| C1 risk | embedded in `trades[].evaluationId = risk_<reason>_<SYM>_<ms>` (`:1964`) | `trades[].symbolOut` | same row |
| C5 suppression | `trades[].evaluationId = guardrail_<type>_<SYM>_<ms>` (`:5400`) | same | same row |
| C6 meeting | `trades[].evaluationId = gameplan_<OUT>_<IN>_<ms>` (`:5668`) | same | same row |
| C2 model | `evaluations[].symbolOut` (`:3944`) | `trades[].symbolOut` | `trades[].evaluationId === evaluations[].evalId` |
| C3/C4 proposals | `proposalHistory[].symbolOut` | `trades[]` via the proposal's `evaluationMetadata.evaluationId` | dormant paths |

A read-only script counting rows where the two symbols differ measures G01's realized frequency over the retained window (trades cap 50, evaluations cap 150 at `:4273`) **without a build**. This session performed no production read; the census needs founder authorization and the existing credential loaders (`scripts/loadLocalEnv.js`, `api/_utils/firebaseAdmin.js`, the shadow-read precedent). Recommended as step 0 of the shadow period.

---

## 7. Q7 — Verification evidence

### 7.1 What the seam emits

```
verification = {
  verificationId,          // stable across transaction retries (derived, never Date.now() inside the tx)
  mode,                    // 'shadow' | 'enforce'
  expected: { symbol, swappedInAt },   // the caller's belief; swappedInAt null for creation-time positions
  found:    { symbol, swappedInAt },   // the occupant at transaction time, from liveData
  verdict,                 // 'match' | 'mismatch' | 'not_checked' (caller supplied no expected identity)
  basis,                   // 'symbol_and_entry' | 'symbol_only' (stored belief lacks swappedInAt)
  battleStatus,            // liveData.status
  slot: { tier, slotIndex },
  tradeSeq,                // liveData.scoreState.tradeCount at the read (pre-state)
  checkedAt,               // the injected clock
}
```

`verificationId` must survive a transaction retry (the callback re-runs, `versionedFirestore.js:1-15` TEST) — derive it from inputs: `${battleId}:${evaluationMetadata.evaluationId}:verify`. Every caller already supplies a unique `evaluationId` (model: `evalId`; risk, suppression, meeting: ids with a caller-side `Date.now()`; proposals: the creating tick's `evalId`). The in-memory `trade_NNN` id is **not** suitable: it is minted from the pre-swap in-memory `tradeCount` and can collide after a refresh failure (the create-only receipt guard at `captureReceipt.js:411-419` exists for exactly that reason, VERIFIED).

### 7.2 Where it lives

| Outcome | Home | Why this record |
|---|---|---|
| Committed (shadow or enforce-match) | `trades[i].verification` — the trade row the fenced writer already builds (`:255-273`); post-state is the row itself (`tradeCount + 1`) | The Film Room's spine is `trades[]` (`buildTape.js:16`); the server tape joins trades, ticks and receipts (`tapeAssemble.js:404-418`); P5 copies `verificationId` into the tick record's `actions[]` for the §8.2 joins. |
| Refused (enforce-mismatch) | the typed error's payload → each caller's existing refusal channel: C2 the evaluation entry (a **conditional** key `executionRefusal`, present only at mode ≠ off — entry keys are golden-pinned at off, `tickStampsHarness.js:57-132`, so follow the `declarationsPhase` / `CALLS_ENTRY_KEYS` pattern, `:4160-4163`, `:132`) and capture `checks.execution.reason`; C1/C5 the feed beat; C3/C4/C6 the history rows | No trade row exists; the feed is capped (`STATUS_FEED_CAP` 100, `:1009`); the capture permanent record (bodies TTL, record retained) is the durable home — via P5's writer extension, with `checks.execution.reason` carrying the id from P6 day one. |

**No new collection.** A `verifications/` subcollection would need rules, rules tests and an index, and would duplicate the trade row; the only thing it would add — durable refusals beyond the feed cap — the capture record already provides. Spec §8.2's ref table (`:107`) has no row for the verification identity; the P6 build should add `verificationId → trades[i].verification / ticks[].actions[].verificationId, by the executor at commit` (docs change, P5/P6 joint).

---

## 8. Q8 — Clock and data seams

### 8.1 Where the executor reads the clock and fetches data

| Line | Read | Used for |
|---|---|---|
| `:127` | `getETDate()` (via `api/_utils/marketSchedule.js:60`) | `todayET` → Guard 3 activation-day gate, `resolveThresholdBaseline` |
| `:129` | `new Date(...)` | `activationDateET` |
| `:132` | `new Date()` | `utcToday` |
| `:144` | `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily','price'] })` | Guard 3 daily reference (conditional) |
| `:165` | `new Date().toISOString()` (inside the transaction) | `swappedOutAt`, `swappedInAt`, `updatedAt` |
| `:183` | `Date.now()` (inside) | beacon freshness |
| `:320` | `Date.now()` (inside) | bench cooldown |

Callers' own clock reads around the call (`evaluationId` suffixes, feed timestamps) are non-fenced and out of P6's scope. VERIFIED.

### 8.2 Smallest injection points, byte-identical when unused

One trailing options bag on the existing signature: `opts = {}` with `{ now = () => new Date(), fetchDailyReference = getStockAnalysisData, expectedOut = null, identityMode = SWAP_IDENTITY_MODE }`. Every clock read derives from one `now()` per attempt (ET date, activation date, UTC date, ISO stamps, beacon age, cooldown); the fetch goes through `fetchDailyReference`. With defaults the values are the ones produced today, so the written document is byte-identical (the harnesses that pin executor output — `flat6TierStamp.passthrough.test.js:181`, `p4Flips.test.js` — compare values, not source). The one visible difference is that today `:165` and `:320` take two separate readings a few milliseconds apart; deriving both from one instant is a sub-millisecond change no test or reader depends on. INFERRED.

### 8.3 P6 or the harness build?

**P6.** Spec §7 `:101` assigns the seams to P6 explicitly; they touch the same fenced function under the same review; the identity acceptance rows need a frozen clock anyway (Guard 3's activation-day branch, `:131`, depends on "today" versus `battle.activatedAt`, which `agentSwapExecution.test.js:127-152` cannot pin today — it uses the real clock, TEST); and a second fenced touch later is a second founder gate. The database seam already exists: `db` is the first parameter, and the harness fixtures pass their own (`inMemoryFirestore.js:147`, `versionedFirestore.js:93`).

---

## 9. Q9 — Tests and fixtures

### 9.1 What exists (all TEST)

| Asset | Covers | Note |
|---|---|---|
| `api/_utils/agentSwapExecution.test.js` | snapshot threading `:57`, Guard 3 day-2 baseline `:127`, `lockedGainPct` `:154`, B5 self/duplicate `:179`, B4 bench round trip `:218`, validator mirrors `:258` | hand-rolled `runTransaction` double (`:43-53`), real clock, `getStockAnalysisData` mocked |
| `api/_utils/flat6TierStamp.passthrough.test.js:181` | executor behaviour through an in-memory harness | a sanctioned test consumer (`agent-evaluate.test.js:827-840`) |
| `api/cron/agent-evaluate.test.js` | source pins: 10th positional arg `:134-143`, six sites preceded by reserve `:714-728`, confirm/release at six `:730-745`, confirm sources from `closedTrade` `:821-825`, repo-level consumers `:827` | **`:134-143`'s regex requires each call to end right after `snapshot`** — any new trailing argument breaks it |
| `api/cron/agent-evaluate.tickCoherence.test.js:204-394` | T1: post-exit rebuild, lock-set prune, two queued risk swaps, no-swap prompt golden | executor doubled (`:44`, `:70-72`); runs `processAgentBattle` |
| `api/cron/agent-evaluate.guardrailErrorFailClosed.test.js:156-256` | T2: a throwing guardrail holds; an earlier S7 exit survives; pre-fix golden | same harness shape |
| `api/cron/agent-evaluate.callRecords.offGolden.test.js:346-441` | every battle write, prompt byte and capture document byte-identical at calls-off; SHA-pinned fixture, LF-pinned, UTC-pinned | the model for a mode-off proof |
| `api/cron/agent-evaluate.callRecords.rollback.test.js:231-282` | rollback golden with call state seeded | |
| `api/cron/agent-evaluate.suppressionPass.behavior.test.js:114-221` | the exported pass executed with a mocked executor: flag off no-op, stop fires, deferrals | the template for C5 rows |
| `api/cron/agent-evaluate.astraFindings.test.js:264-296`, `:552-582` | F1b refresh failure stops discretionary work; E1 | |
| `api/_utils/callRecords/heard.test.js:107`, `:182`, `:204` | acted needs a whole-trade match; a null result writes nothing | the Q5 proof |
| `api/_utils/learning/captureReceipt.test.js:180` | create-only duplicate refusal | |
| Fixtures | `api/_utils/__fixtures__/inMemoryFirestore.js:28,147` (transaction double); **`versionedFirestore.js:1-30` (optimistic-concurrency simulator that re-runs the body on a moved read — the retry row)**; `callsFirestore.js:237`; `tickStampsHarness.js` (`FROZEN_NOW` `:33`, `HELD` `:46`, `BENCH` `:48`, `makeTickBattle` `:152`, entry-key lists `:57-132`) | |
| Goldens | `tickStampsEntryGolden.flagOff.json`, `tickCoherenceLiveContextGolden.noSwap.txt`, `callRecordsOffGolden.json`, `callRecordsRollbackGolden.json` | all must stay byte-identical at `off` |

**Missing:** IR-3 (register `:134`) promised "the DCR probe file" in `docs/audits/`; `docs/audits/fixtures/` holds only `AAPL_2026-09-17_1m.json`, and no P02/P03 probe exists under `docs/` or `scripts/` (bounded grep). The acceptance set re-creates those shapes.

### 9.2 Proposed acceptance set

| # | Row | Harness | Shape |
|---|---|---|---|
| A1 | expected matches → commits; `trades[i].identityCheck` present at shadow/enforce, **absent at off** | executor unit | `makeMockDb` |
| A2 | **changed slot**: expected A, live slot holds B → enforce refuses (typed reason, nothing written); shadow commits with `verdict: 'mismatch'` | executor unit | the P02 shape |
| A3 | **symbol left and returned**: same symbol, different `swappedInAt` → mismatch | executor unit | |
| A4 | creation-time position (`swappedInAt` absent, expected `null`) vs a returned swap-in → mismatch; vs the original → match | executor unit | |
| A5 | **finished battle**: `status: 'completed'` → typed refusal (if D3); shadow records `battleStatus` | executor unit | the P03 shape |
| A6 | **transaction retry**: the slot changes between the first and second callback run → the verdict is from the fresh read, `verificationId` identical across attempts, one write | `versionedFirestore.js` | |
| A7 | `off` **byte-identical**: the captured `updates` object and return value equal a frozen fixture for every existing row | executor unit golden | the offGolden pattern |
| A8 | **each caller shape** on a typed refusal, through `processAgentBattle`: C1 feed beat + loop continues; C2 HOLD/downgraded/prefix + capture `blocked` + conditional entry key (flag-off golden intact) + no carried result; C3 (`executionMode: 'copilot'`, `resolution: 'approved'`) history row carries the refusal; C4 expired co-pilot history row is **not** `auto_executed`; C5 via the exported pass (fault class is the typed reason, not `guardrail_error`); C6 meeting `status: 'approved'` with a departed and a returned leg | tick harnesses | |
| A9 | **duplicate approval**: the same approved proposal processed on two ticks → the second is refused by identity (the slot now holds `symbolIn`) | tick harness | the DCR-008-adjacent replay case |
| A10 | **shadow without behaviour change**: a full tick at shadow writes the same documents as at off plus exactly the `identityCheck` key | tick harness golden diff | |
| A11 | the proposal and meeting creation sites store the identity; a legacy record without it runs `basis: 'symbol_only'` | tick harness | |
| A12 | mutation rows: remove the comparison → A2/A3/A4 fail; remove the status read → A5 fails; return `Date.now()` for the id → A6 fails | BUILD_RULES §2 | |

---

## 10. Q10 — Fence protocol

| File | Fenced? | What BUILD_RULES requires | Note |
|---|---|---|---|
| `api/_utils/agentSwapExecution.js` | **yes** (§1 `:15`) | the sanctioned entry is this package's founder prompt (spec §7 "fenced, founder-reviewed, its own package"); §2 multi-lens adversarial review (`:43-52`), explicit `vite build`, mutation check, written `docs/audits/` record; founder sign-off on the diff | the only fenced file |
| `api/_utils/agentSwapExecution.test.js` | co-located test | keep the §4 dependency-surface guard comment | |
| `api/cron/agent-evaluate.js` | no | six call sites + six catches + two creation sites; **every golden must stay byte-identical at off** (`offGolden`, `tickStampsEntryGolden.flagOff`, T1 noSwap, T2 pre-fix, rollback) | the file is a concept-fence contact only if it alters executor behaviour from outside — it does not |
| `api/cron/agent-evaluate.test.js` | no | move the `:134-143` pin in the same commit (a trailing argument ends the call differently); the six-site counts stay | |
| `api/_utils/__fixtures__/tickStampsHarness.js` | no | a conditional entry-key list for the mode (the `CALLS_ENTRY_KEYS` pattern `:132`) | |
| `src/config/featureFlags.js` + `src/config/swapIdentityFlags.test.js` | no | string tri-state pinned directly; flip PRs move the pin (§2 `:53`) | |
| `api/_utils/agentRiskManager.js` (`findPortfolioSlot`), `agentGuardrails.js`, `agentBattleService.js` | yes | **not touched** — read-only use; the identity key is chosen so the creation shape stays as it is | |
| `api/_utils/tickCapture/captureConfig.js` / `captureSerializer.js` | no | **not touched in P6** — `checks.execution.reason` already exists; the `actions.*` copy is P5's schema bump | |
| `firestore.rules` | no | **not touched** — no new collection | |

Review threshold: P6 as split below is roughly 10–12 files, so the §2 threshold (`:41`) is met or near; the review is mandatory anyway on fence contact. Reviewer isolation per `:52` (snapshot trees, read-only on git).

**Larger than the fix, kept out:** a minted position id (creation shape, every reader); the capture-record copy of the verdict (schema bump, P5); a `verifications/` subcollection (rules + tests + index); and folding the lease/worker-generation fence in (sharding spec, IR-6 `:160`). **Flagged, decided by D3:** the battle-active check is one extra read of a field already in `liveData` and its own refusal type; spec §9.3 `:119` names the finished-battle case as a required P7 outcome, which argues for including it.

---

## 11. The merged caller table (Q2–Q5)

| Caller | Belief source and moment | Window | Identity available today | Proposed mismatch behaviour |
|---|---|---|---|---|
| C1 risk `:2021` | slot by symbol on the in-memory battle, seconds before (`:1908`) | seconds; overlap only | yes (`:2017-2019`) | hold; feed beat typed; capture blocked; next tick re-evaluates the new occupant |
| C2 model `:3589` | model output over a prompt built at `promptBuiltAt` (`:2734`); slot by symbol on the same snapshot (`:3366`) | ≤ 22 s + gates; overlap only | yes (`:3551-3553`) | HOLD, downgraded, prefix kept, typed reason on the entry (conditional) and capture; no carried result → no cockpit receipt |
| C3 approved proposal `:4826` | stored tier/slot/symbol at creation (`:3807-3813`) or client-written; approval ignores expiry | **unbounded** | no — store `outgoingSwappedInAt` at creation; else symbol-only, recorded | hold; history row carries the typed refusal |
| C4 expired co-pilot proposal `:5048` | same stored belief; risk loop runs on every pending tick | ≤ TTL + 15 min | no — same | hold; history row is **not** `auto_executed` |
| C5 suppression `:5450` | guardrail evaluation on the in-memory battle; slot by symbol just before (`:5359`) | seconds; overlap only | yes (`:5446`) | hold; feed beat typed; fault class is the typed reason |
| C6 meeting `:5676` | leg symbol stored at creation (`:5963-5968`); slot re-resolved by symbol at execution (`:5645`); approval ignores expiry; live UI | **unbounded** | not meaningfully — store `{symbol, swappedInAt}` per leg at creation; else symbol-only, recorded | hold per leg; departed and mismatched legs recorded, not skipped silently |

---

## 12. Founder decisions (plain language, recommended default first)

**D1 — The identity key.** *Default:* the stock symbol plus the instant it entered the slot (`swappedInAt`, blank for stocks held since the start). Nothing new is written anywhere; a stock that left and came back is told apart. *Alternative:* mint a position id for every slot, which means changing the battle-creation shape (fenced) and every reader.

**D2 — Protective exits when the stock already left.** *Default:* do nothing and say so. A stop on a stock that is no longer there has nothing to protect; the stock now in the slot gets its own check at the next tick, minutes later. *Alternative:* find the stock wherever it is now and sell it — rejected, because a stop fires on a symbol the book no longer holds only when that symbol has left the book entirely.

**D3 — Include "the battle is still active" in this package.** *Default:* yes. It is the second half of IR-6, one read of a field the transaction already has, and the harness (spec §9.3) must show a finished-battle rejection anyway. *Alternative:* leave it to the sharding spec with the worker-lease fence.

**D4 — The shadow period.** *Default:* first a read-only census of existing records (§6.3; no build, one authorized production read); then `off → shadow` for at least five full sessions with one shadow read (the call-records precedent); then `shadow → enforce` as its own one-line flip after that read shows the mismatch rate and no shadow-only faults. *Alternative:* enforce directly after the census if it shows zero mismatches — not recommended; the seam's own faults are what shadow is for.

**D5 — The player-facing lines.** *Default:* the three lines in §5.5, as a new table F in a V1.1 of the language tables, blessed with the rest of that version. *Alternative:* reuse the existing "it did not go through" label with no typed reason shown — honest but less specific.

**D6 — The dormant proposal paths.** *Default:* give them the stored identity now (cheap, non-fenced, closes the widest window) and leave their removal to the authority arc (register step 4). *Alternative:* delete them in P6 — a scope change the authority arc owns.

---

## 13. Proposed build split

| Step | Content | Size (est.) | Fence | Gate |
|---|---|---|---|---|
| **PR 1, commit 1 — the seam** | `agentSwapExecution.js`: the options bag (`expectedOut`, `identityMode`, `now`, `fetchDailyReference`), the comparison and (D3) status read inside the transaction, the typed refusal, `closedTrade.identityCheck` at mode ≠ off; flag + pin test; executor unit rows A1–A7, A12; executor-level off golden | ~90 lines fenced, ~250 test, ~40 flags; 4 files | **yes** | founder sign-off on the fenced diff; §2 review |
| **PR 1, commit 2 — the callers** | six sites pass `expectedOut`; six catches record the typed reason (capture `checks.execution.reason`, feed, history rows, conditional entry key); proposal and meeting creation store the identity; `agent-evaluate.test.js:134-143` pin moved; harness entry-key list; rows A8–A11 | ~400 lines; 6–8 files | no | same PR, same review (the seam without callers emits `not_checked` everywhere) |
| **Flip 1** | `off → shadow`, one line + pin, after the §6.3 census | 2 lines | no (§2 flag-flip convenience applies; the flag is not an agent-channel flag like `EXA_RETRIEVAL_ENABLED`) | founder; then the shadow read after ≥ 5 sessions |
| **Flip 2** | `shadow → enforce`, one line + pin, after the read | 2 lines | no | founder; P7 final runs may then claim §9.3's case E; P5 copies the verdict into the capture record in its own build |

Flag stays `off` through PR 1; the PR is dark by construction and every existing golden proves it.

---

## 14. Corrections to the register, the audits and the spec

1. Register G01 (`:245`) and the capability audit G01 row (`:537`) cite `agent-evaluate.js:2126, :4384, :5241` and `agentSwapExecution.js:152` at `f6728ffc`; at HEAD the executor's transaction still opens at `:152`, but the callers are at `:2021, :3589, :4826, :5048, :5450, :5676`. The finding itself is confirmed unchanged.
2. The capability audit's counter-evidence "the mode UI is removed" (`:537`) holds for proposals; **the meeting-approval card is live** (`AgentActivityFeed.jsx:760`), so C6 is the one human-approval route reachable from the shipped UI.
3. `api/_utils/tournamentAgentLedger.js:5` says five call sites; BUILD_RULES §7 `:88` and the code say six. Comment drift; report only.
4. Spec §7 `:101` says the seam "emits a verification identity plus pre/post-state evidence that §8 links"; §8.2's ref table (`:107`) has no row for it. P6/P5 add one (§7.2).
5. The prompt's Q5 expected the cockpit to report "no matching trade" for a refused swap; at HEAD a refusal produces no receipt at all, by the heard writer's null-result rule (§5.4). "Never acted" holds.
6. IR-3's promised DCR probe file is not in the repo (§9.1); the acceptance set re-creates P02 and P03.
7. Register build-order step 6's gate ("Eval-fixes PR merged") is satisfied (`20260919_BUILD_EVAL_FIX_INTEGRATION.md`).
8. Found outside scope, reported for separate tasking (BUILD_RULES §3 `:61`): C4 writes `resolution: 'auto_executed'` to history after a failed execution (`:5172-5175`); C3 keeps `resolution: 'approved'` with no failure marker (`:4966`); C5 files an executor refusal under `faultClass: 'guardrail_error'` (`:5593`); five feed beats record the belief symbols rather than the committed ones (§2.3) — a §9 display-agreement case; the incoming `benchAsset` is never re-validated against the live bench at commit (§1.4).

---

## 15. Close

- HEAD `e0993cba`; branch `claude/phase0-p6-swap-identity`; no source file changed; the only commit is this report.
- Fence: no fenced file edited, no fenced function called.
- Delivery ends at *pushed* (BUILD_RULES §2): one PR, no CI watching, no merge.
