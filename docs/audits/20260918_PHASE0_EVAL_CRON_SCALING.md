# Phase 0 — Eval-Cron Scaling Discovery (read-only)

**Date:** 2026-09-18
**Branch:** `claude/phase0-eval-cron-scaling`, cut from `origin/main` at HEAD `f1333943446c256d3f4228ef2a81e2327429e602` (the branch did not exist on origin before this session). Clean tree at open. `git fetch origin` was the first step of the session (BUILD_RULES §3); the remote-tracking ref was current. No source changes, no external calls, no Firestore access (no credentials; read-only Firestore is not available here — §2 says what that costs).
**Scope:** `api/cron/agent-evaluate.js` at HEAD, its cron entry, its callees, and the four named neighbors on the same schedule. Every claim carries `file:line` and a VERIFIED (read at that line in this session) or ASSUMED marker. Lines drift; re-verify before relying.
**Discipline:** discovery only. Sections 1–7 answer the prompt in order; the report ends with the facts that constrain a sharding spec and a measured-cost line. No recommendation among the three shard shapes is made — they are priced, and the report stops.

**One premise in the prompt is ahead of HEAD.** The prompt prices "the model call alone 15–20 s at the new 40 s ceiling". At HEAD the call ceiling is 22 s — the SDK's 20 s per-request timeout (`api/cron/agent-evaluate.js:2100`, VERIFIED) plus a 2 s abort backstop (`api/_utils/agentEvalTransport.js:14`, VERIFIED). No 40 s value exists anywhere in the tree (grep over `api/` and `docs/`, VERIFIED by absence). Where the ceiling matters to a price below, both values are given: 22 s (HEAD) and 40 s (prompt, ASSUMED pending).

---

## Executive verdict table

| # | Question | Verdict | Status |
|---|---|---|---|
| 1 | How are battles enumerated, ordered, and deferred? | One unbounded `status == 'active'` query with no ordering and no limit; a fair-rotation sort by `cronState.lastEvalStartedAt`; a sequential loop that breaks when elapsed exceeds 290 s. A deferred battle gets **nothing** — no evaluation entry, no status-feed beat, no doc write; only a console line and a count in the HTTP response. Next tick it leads only if its sort key is older than the others', and the key advances only on a real model attempt, so a battle that never triggers sits at the front permanently. | VERIFIED |
| 2 | What is the measured per-battle wall time? | **Not recorded anywhere in the tree.** The entry carries `buildMs` and `callMs` (added Sep 12) but no production value has been written into any committed file; nothing brackets the pre-call fetches or the post-call writes; the lock stamp `cronState.evaluatingAt` is nulled in the same write that stamps `evaluation.timestamp`, so the pair never coexists on a doc. The only figure in the repo is a Jul-22 live-ops datapoint: ~19.9 s for 8 battles (≈2.5 s each, mixed paths), UNVERIFIED against logs. | VERIFIED (absence) |
| 3 | What per-invocation state is shared across battles? | Almost none that is expensive: prices, daily OHLCV, intraday candles, the rankings doc, technical scores, market context and regime are all fetched **per battle** inside `processAgentBattle`. The per-invocation memos are three read caches (tournament group docs, mastery group docs, mastery siblings). Two invocations on disjoint battle sets recompute everything harmlessly. The contention documents are the tournament group's agent ledger (one whole-doc-set transaction per swap, shared by four battles) and the mastery repair-sweep cursor (one doc, read-then-set per invocation). | VERIFIED |
| 4 | Three shard shapes, priced | §4. (a) N cron entries costs N−1 slots; one slot is free, so N ≤ 2 without consolidating another entry. (b) HTTPS fan-out costs no slot; the repo holds exactly one internal fan-out precedent, with a production-measured auth hazard (the apex 307 strips `Authorization`) and no fetch timeout. (c) HEAD already sits at the ceiling the repo records for its plan (300 s); more requires a platform setting the repo never mentions (ASSUMED 800 s), and 60 battles at the prompt's 20–30 s do not fit even there. | VERIFIED / ASSUMED as marked |
| 5 | Downstream concurrency limits | Anthropic: `maxRetries: 0`, no 429 handling beyond classifying it, no recorded rate tier. EODHD: ≈74 GETs per battle per tick, 68 of them in one **unbounded** `Promise.all`, none with a timeout; only the intraday batch is capped (5 concurrent). No recorded REST rate tier; the only recorded number is a 50-connection websocket warning. Firestore: battle docs are lock-serialized; the ledger and the sweep cursor are the contention docs. | VERIFIED (code) / ASSUMED (tiers) |
| 6 | Same-schedule neighbors | 18 other entries fire on at least one of agent-evaluate's minutes during 13–21 UTC. The four named share the EODHD budget and three documents agent-evaluate reads (`fantasyTimesStories`, `voiceLayerCache/{battleId}`, `indexIntelligence/marketContext`). Beyond the four: `compute-index-intelligence?mode=intraday` rewrites `stockRankings` and all 239 `stockTechnicalScores` docs at :00 of 14–20, the same minute agent-evaluate reads them; `process-pending-reflections` writes `agentBattles` (completed docs) every quarter hour. | VERIFIED |
| 7 | Fence contact | None of (a), (b) or (c) needs a §1 file if the shard key is computed from the battle id inside the handler. A shard field stored on the battle doc touches the fenced `createAgentBattle` shape; a query change touches the fenced `agentBattleService.js`. `agentEvalTransport.js` is called "fenced" in a handler comment but is not on the §1 list — flagged. | VERIFIED |

---

## 1. The loop

### 1.1 Enumeration — query, ordering, limit

- The handler enumerates with `findActiveAgentBattles(db)` (`api/cron/agent-evaluate.js:231`, VERIFIED). That function is a single query, quoted in full (`api/_utils/agentBattleService.js:43-50`, VERIFIED — fenced file, read only):

  ```js
  const snapshot = await db
    .collection('agentBattles')
    .where('status', '==', 'active')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  ```

  **No `orderBy`, no `limit`.** Firestore returns a filtered query with no `orderBy` in document-id order (ASSUMED — platform behaviour, not repo code).
- Every returned battle is walked once in the expiry loop (`:234-266`, VERIFIED): expired ones are completed in place (`:241`), the rest are pushed to `activeBattles` (`:263-265`). This loop runs **before** the market-hours gate and before any budget consideration.
- Three per-invocation sweeps follow, all before the eval loop: the mastery repair sweep, cursor-paged, limit 25 (`:276-281`); the bare-GC-completion repair, limit 25 over a 96 h window (`:297`, defaults at `:4842`); the canonical-open sweep with its own 15 s timeout (`:316`). The market gate is at `:304-307`. All VERIFIED.

### 1.2 Ordering — the clause, quoted

`:343-345`, VERIFIED:

```js
activeBattles.sort((a, b) =>
  (a.cronState?.lastEvalStartedAt || '').localeCompare(b.cronState?.lastEvalStartedAt || '')
);
```

The comment above it (`:335-342`) states the intent: ascending by the last tick that **started a Haiku call**, written only on a real attempt, so budget-skipped ticks do not refresh it; never-evaluated battles sort to the front as `''`. The comment closes: *"This makes starvation FAIR … it does NOT make it go away — the real fix is per-battle fan-out."* (`:340-342`, VERIFIED.)

Two consequences the comment does not state:

- `cronState.lastEvalStartedAt` has exactly one writer, `:3047`, gated on `haikuAttempted` (VERIFIED — grep finds no other assignment). Every path that ends without a model attempt — the CPU-passive flush (`:941`), the risk-only flushes (`:1822`, `:1839`, `:1879`), the no-trigger flush (`:1958`) — leaves the key untouched. A battle that never triggers therefore keeps `''` (or its last attempt's stamp) forever and **leads the sort on every tick**. Fair rotation is fair among battles that attempt calls; it does not rotate the ones that don't.
- Ties (equal keys, including `''`) fall through to insertion order, i.e. the query's document-id order, because `Array.prototype.sort` is stable on Node ≥ 12 (Node in this container is v22.22.2, VERIFIED; stability is a language guarantee, ASSUMED for the Vercel runtime).

### 1.3 The per-battle function's boundaries

`processAgentBattle(db, battle, summary, cronStartTime, tournamentGroupCache, masteryFlagView)` at `:564` (VERIFIED). It owns everything for one battle: the lock (`:568-607`), the migration write (`:640-646`), tournament context (`:676-677`), attribution (`:689`), symbol collection (`:698-710`), the price fan-out (`:713-733`), the quote-health guard (`:744-752`), the CPU-passive flush (`:941`), the parallel data batch (`:948-966`), the hotBench rebuild (`:1000-1104`), regime classification, the risk manager and its swaps, the proposal/gameplan/suppression passes, the news query (`:1887`), the trigger gate (`:1937`), the model call block (`:1965-2152`), the record build (`:2845-2894`), the shadow log (`:2978-3013`), the final write (`:3113`), and the `finally` block that dispatches narrations and anticipations (`:3119-3209`). Five flush sites persist cron state through `finalizeCronState` (`api/_utils/agentCronState.js:35-49`, VERIFIED), each releasing the lock (`:37`).

### 1.4 The `TIME_BUDGET_MS` check — where, what, and what happens

- Constant: `const TIME_BUDGET_MS = 290_000;` at `:150`, beside `EVALUATING_LOCK_TIMEOUT_MS = 120_000` at `:149` and `export const config = { maxDuration: 300 }` at `:146` (all VERIFIED). The comment at `:141-145` records the July raise 60 → 300 as "Mitigation, not architecture".
- The **handler-level** check sits at the top of each loop iteration (`:348-355`, VERIFIED):

  ```js
  for (const battle of activeBattles) {
    const elapsed = Date.now() - startTime;
    if (elapsed > TIME_BUDGET_MS) {
      const remaining = activeBattles.length - summary.evaluated - summary.errors;
      console.log(`${LOG_PREFIX} Time budget exceeded (${elapsed}ms). ${remaining} agent(s) deferred to next tick.`);
      summary.skipped += remaining;
      break;
    }
    ...
  ```

  It compares elapsed-since-handler-start against 290 s and **reserves nothing for the battle about to start**. A battle admitted at 289.9 s still runs its full pre-call phase (§5.2: ~74 EODHD GETs with no timeout) before the per-battle guard can say anything. Only the model phase is reserved, by the second check below.
- The **per-battle** check is `shouldStartHaikuCall({ elapsedMs, timeBudgetMs })` at `:2006` (VERIFIED), which requires `10 s + 22 s + 12 s = 44 s` remaining (`api/_utils/agentEvalTransport.js:167-178`, constants at `:14-15`, `:36`, VERIFIED). Below that it sets `failureClass: 'budget_skipped'` (`:2008-2013`) and the tick continues down the normal write path with a fallback HOLD.
- What a **deferred** battle (handler-level break) gets: **nothing**. No lock is taken, no `budget_skipped` entry, no `eval_degraded` feed beat, no `cronState` field, no `scoreState.lastScoredAt` advance (that write is at `:901`, inside the per-battle function). The only traces are the console line and the `skipped` count in the JSON response (`:388`), where it is **conflated** with lock-skips (`summary.skipped++` at `:606`). Nothing persists the response. VERIFIED.
- What a **budget-skipped** battle (per-battle guard) gets: an evaluation entry whose rationale is the placeholder *"Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD."* (`:2854-2857`), a status-feed beat with `action: 'eval_degraded'` (`:2965-2975`), a `cronErrors` row (`:3065-3074`), `consecutiveEvalFailures` unchanged (`:3056-3059`; helper at `agentEvalTransport.js:192-197`), no `totalHaikuCalls` increment (`:3042`), and no `lastEvalStartedAt` refresh (`:3047`). VERIFIED.

### 1.5 Next tick — first, same order, or luck?

- A deferred battle's `lastEvalStartedAt` is unchanged, so on the next tick it sorts **ahead of every battle that attempted a call this tick** (those carry a newer stamp) and **level with** every battle that ran without attempting (§1.2). Within that level group, order is document-id order. So: first among attempters, luck among non-attempters. VERIFIED (sort at `:343-345`, writer at `:3047`).
- Overlap between invocations is anticipated by design: the lock (`:568-601`) is stolen once it is older than 120 s while an invocation may live 290 s; the regime-stamp transaction comment names this exact race (`:1170-1176`, VERIFIED). Whether Vercel starts the :15 invocation while the :00 one is still running is platform behaviour (ASSUMED yes — nothing in the repo prevents it, and the code is written as if it happens).

---

## 2. Measured per-battle wall time

### 2.1 What the record carries

- `buildMs` and `callMs` were added Sep 12 (`docs/audits/20260912_BUILD_EVAL_TRANSPORT_HYGIENE.md:126-132`, VERIFIED) and ride the entry (`agent-evaluate.js:2892-2893`) and the GCS shadow record (`:3011-3012`). Declared at `:1991-1992`; `buildMs` measured at `:2064` (or on failure `:2130`); `callMs` in a `finally` around `messages.create` alone (`:2103`). All VERIFIED.
- `promptBuiltAt` (`:2066`) and `evaluation.timestamp = now` (`:2276`) are the only other instants on the entry, and `now` is captured **after** the call block (`:2276` follows `:2150`) — the same fact the Sep 11 discovery recorded (`docs/audits/20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md:92-96`, VERIFIED).
- **No field brackets the pre-call fetches** (`:713-733`, `:948-966`, `:1086`, `:1887`) **or the post-call writes** (`:3113`, `:3134-3149`, `:3166-3208`). VERIFIED by reading the entry shape at `:2845-2894` and the `finalUpdate` keys at `:3025-3078`. This is a finding: the handler's whole-invocation `duration` (`:385-388`) is the only wall-time figure produced, and it goes to the function log and the HTTP response, neither persisted.

### 2.2 What the tree holds — and what could not be measured

- **Production values of `buildMs`/`callMs`: none in the tree.** The transport-hygiene report states expectations only ("expected sub-second", "expected well under 20 000" — `20260912_BUILD_EVAL_TRANSPORT_HYGIENE.md:500-501`) and defers re-tuning to "the first week of `buildMs`" (`:523`). The Sep 12 flip report confirms the fields did not exist at its HEAD (`20260912_FLIP_SHADOW_ASSEMBLY_OFF.md:155-157`). The eval-harness run records are `.gitignore`d (`api/scripts/archetype-integrity-eval/.gitignore:1-6`) and carry no latency field (grep, VERIFIED by absence). All VERIFIED.
- **Committed sample documents:** the P4 creation snapshot carries `lastEvaluatedAt: null`, `lastTriggeredAt: null`, `evaluatingAt: null` (`api/_utils/__p4_snapshots__/createAgentBattle.tieredDoc.snap.json:274-284`); the tick-stamps golden is synthetic, every timestamp `2026-09-09T15:00:00.000Z` (`api/_utils/__fixtures__/tickStampsEntryGolden.flagOff.json:78, :131, :138-139`). Neither yields a duration. VERIFIED.
- **The `evaluatingAt → evaluation.timestamp` estimate the prompt asks for cannot be taken from any doc, committed or live**, because `finalizeCronState` writes `cronState.evaluatingAt = null` (`agentCronState.js:37`) on the same `finalUpdate` that carries the entry (`:3078`, `:3113`). The two instants never coexist on a persisted document. The lock instant survives only in a live read taken mid-tick or in the function log. VERIFIED.
- **The only per-battle number in the repo** is the Jul-22 live-ops datapoint: one invocation ~19.9 s, `evaluated: 8`, ≈2.5 s per battle across mixed paths (`docs/ARCHETYPE_CONTROL_CENSUS_REPORT_V1.md:257`, marked there "UNVERIFIED against logs"; `:1066` notes `evaluated` counts every flush path, not model calls). It predates the Jul max-tokens raise to 2048, the tick stamps, and the Sep 12 transport changes. VERIFIED as a citation; the number itself ASSUMED.
- **The last ten days of live evaluation entries** were not readable here (no credentials). `scripts/phase0-eval-timeouts-readonly.js` exists for exactly this read (VERIFIED present, 18 KB) and, per the Sep 11 report, prints the slot-offset proxy `timestamp − floor(timestamp to the 15-minute slot)` per entry (`20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md:96`); the Sep 12 build did not extend it to `buildMs`/`callMs` (`20260912_BUILD_EVAL_TRANSPORT_HYGIENE.md:524`). The founder can produce the ten-day table from the console with that script; the spec should not be written against numbers this session could not see.

### 2.3 Code-derived envelope for one triggered battle (HEAD)

| Phase | Bound | Basis |
|---|---|---|
| Lock transaction | one Firestore transaction | `:568-601` VERIFIED |
| Price fan-out | one **unbounded** `Promise.all` of ≈34 `getStockAnalysisData(forceRefresh)` calls, each issuing one `/eod/` and one `/real-time/` GET with **no timeout** | `:713-733`; `marketDataCache.js:622-632, :638, :352-357, :742-745` VERIFIED; count from `20260918_PHASE0_INTRADAY_DATA.md:431, :440` VERIFIED |
| Parallel batch | intraday candles for held symbols (5 concurrent, 200 ms between batches, no timeout) ∥ rankings doc ∥ tech scores `getAll` ∥ marketContext + SPY | `:948-966`; `marketDataCache.js:883-913, :807` VERIFIED |
| News | up to 10 **sequential** Firestore queries | `agentTriggerGate.js:201, :209-217` VERIFIED |
| Prompt build | ≤ 10 s (ceiling); institutional agents add ⌈(held+bench)/10⌉ sequential batches + 1 aggregate read | `:2022-2064`; `agentEvalTransport.js:36`; `agentEvalPromptAssembly.js:904, :919` VERIFIED |
| Model call | ≤ 22 s (SDK 20 s + 2 s backstop); prompt's 40 s ASSUMED | `:2084-2100`; `agentEvalTransport.js:14` VERIFIED |
| Post-call | 12 s reserved; narrations ≤ 10 s Gemma each in parallel, then anticipations ≤ 10 s, gated on 12 s remaining | `agentEvalTransport.js:15`; `:3134-3149`, `:3166-3168` VERIFIED |
| Final write | one `battleRef.update` rewriting the whole `evaluations` array (cap 150) and `statusFeed` (cap 100) | `:3016`, `:692`, `:3113` VERIFIED |

Sum of the reserved model-phase bounds: **44 s** (62 s under a 40 s ceiling). The pre-call phase has **no upper bound** at HEAD.

---

## 3. Shared per-invocation state

### 3.1 Computed once per invocation and reused across battles

| State | Where | Reused by | Two invocations on disjoint sets |
|---|---|---|---|
| `tournamentGroupCache` (Map of group docs) | `:331`; consumed `:676`; filled in `tournamentAgentLedger.js:16-28` | every tournament battle in the same group | Read memo. Computed twice, no write. Harmless. VERIFIED |
| `masteryGroupCache`, `masterySiblingsCache` | `:223-224`; consumed by `completeBattle` `:241` and the sweeps `:276-281`, `:297` | completions and the repair sweep | Read memos. Harmless. VERIFIED |
| `masteryFlagView` | `:209-221`; one registry read only when `MASTERY_XP_ENABLED` (false at HEAD, `api/_utils/masteryConfig.js:41`) | all completions | Zero reads today. VERIFIED |
| `anthropicClient` singleton | `:152-168` (module-level `let`) | every call in the process | Per-process; each invocation constructs its own unless the container is warm. Harmless. VERIFIED |
| `memoryCache` (L1 market-data cache) | `api/_utils/serverCache.js:15` (module-level Map) | `getStockAnalysisData` **when not forceRefresh** | agent-evaluate passes `forceRefresh: true` (`:721`), so it never reads this cache; the write-back is to the L2 doc, below. VERIFIED |
| `startTime` / `cronStartTime` | `:193`, threaded to `:564` | both budget checks | Per invocation by construction. VERIFIED |

**Everything the prompt lists as "computed once" is in fact computed per battle** (VERIFIED, all inside `processAgentBattle`): the price map (`:713-733`), the intraday/VWAP map (`:948-995`), the rankings doc and derived `momentumData.rankings`/`rankingsMap` (`:959`, `:1003`, `:1211-1213`), the technical-scores map (`:955`, `:960`, `:1144`, exposed at `:1214`), market context + SPY and the posture (`:961-964`, `:1191-1193`), the fresh ATR map (`:1222`), the cascade-qualification memo (`:1280`, per tick per battle), and the news set (`:1887`). Sharding therefore loses no once-per-invocation computation; it also gains none — each shard repeats the same per-battle fetches its battles would have made anyway.

**"The intraday snapshot once build 1 lands"** — no such build is in the tree. The Sep 18 intraday discovery describes a candidate 5-minute universe poll and its EODHD cost (`docs/audits/20260918_PHASE0_INTRADAY_DATA.md:464-470`, VERIFIED) but names no document and no consumer; today's `intradaySnapshot` is the per-battle VWAP map published at `:991`. Whether a future snapshot doc is read-shared or written per shard is a question for that build's spec, not a fact at HEAD. ASSUMED absent.

### 3.2 Every document written outside the battle's own doc during a tick

| Document | Writer | When | Contention if the battle set is split across invocations |
|---|---|---|---|
| `tournamentGroups/{groupId}/ledger/agentHeldSet` | `reserveSymbol` / `confirmSwap` / `releaseReservation` — **whole-doc `tx.set`** inside a transaction | every tournament swap (six wrapped `executeSwapServer` sites, BUILD_RULES §7) | **Yes.** Four battles share one ledger; if two of them land in different shards and swap in the same instant, both transactions target the same doc — Firestore retries the loser (admin SDK default 5 attempts, ASSUMED), correctness is preserved by the reserve/confirm protocol, latency is added. `api/_utils/tournamentAgentLedger.js:4-8, :77-82, :399, :407, :473, :497`; `src/constants/leagueTournament.js:18, :29-30` VERIFIED |
| `tournamentGroups/{groupId}` | `canonicalOpenSweep` transaction (conditional, idempotent) | every invocation, before the loop | Idempotent conditional writes (`canonicalOpenSweep.js:39-44, :60-61, :141` VERIFIED); N invocations = N transactions per group per tick. Note the handler comment at `:309-312` says the sweep is inert "with `LEAGUE_CANONICAL_OPEN_CAPTURE` off" — the flag is `true` at `src/config/featureFlags.js:375` (VERIFIED). Stale comment, reported below |
| `masteryConfig/sweepCursor` | `runRepairSweep` — read cursor, page 25, `set` cursor | every invocation | **Yes.** N invocations read the same cursor and each `set`s a different value; pages are skipped or repeated. The sweep is stamps-only and idempotent (handler comment `:270-274`), so the cost is wasted reads and delayed repairs, not corruption. `api/_utils/masterySettlement.js:674-676, :712-714` VERIFIED |
| `agents/{agentId}` (stats, `activeBattleId`), `agents/{parentId}` for casual clones | `completeBattle` transaction | expiry of that battle | Transactional; the second invocation to attempt the same expired battle gets `committed: false` and counts `completionSkipped` (`:255-258`). `:4517, :4540, :4707, :4731, :4745` VERIFIED |
| `agents/{agentId}/battlePatterns/{battleId}` | `logBattlePattern` (fire-and-forget) | after a committed completion | Per battle. `:244`; `api/_utils/battlePatternLogger.js:63-65` VERIFIED |
| `battleSettlements/{battleId}`, `agentBattles/{id}.receiptCoverage` | `writeBattleSettlementRecord` | completion, **dark** (`SHADOW_ASSEMBLY_ENABLED = false`, `featureFlags.js:1482`) | None today. `:4809`; `shadowAssemblyCapture.js:448, :457` VERIFIED |
| `agentBattles/{id}/shadowDiffs/{tickId}` | `runShadowTickCapture` | per tick, **dark** | None today. `:3091`; `shadowAssemblyCapture.js:257-259` VERIFIED |
| `learningReceipts/{agentId}/receipts/{…}` | `captureSwapReceipt` (live: `LEARNING_L1_CAPTURE_ENABLED = true`, `featureFlags.js:1167`) | every committed swap, six sites | Per battle/agent; no cross-battle contention. `:1731, :2605, :3388, :3585, :3970, :4172`; `api/_utils/learning/captureReceipt.js:407-409` VERIFIED |
| `marketDataCache/{SYM}_daily` (L2 cache) | `setCachedData`, fire-and-forget, after every forced `/eod/` fetch | every symbol of every battle, every tick | Already N-writers-per-tick today (each battle rewrites the docs for its symbols); last-write-wins with identical payloads. Harmless. `marketDataCache.js:188, :657-660` VERIFIED |
| GCS `shadow/evaluations/{day}/…` | `logEvaluation` / `logAnticipation`, fire-and-forget | per tick | Object store, not Firestore. `api/_utils/shadowLogger.js:36, :60` VERIFIED |
| `agentBattles/{otherBattleId}` | none — every battle write is to `battleRef` or, inside the ledger transaction, a **read** of a stale reservation's battle (`tournamentAgentLedger.js:391`) | — | The lock (`:568-601`) serializes writers per battle; disjoint shards never contend. VERIFIED |

Documents read but never written by the tick (safe under any split): `indexIntelligence/{stockRankings,marketContext,SPY,dailyRegimeBrief}` (`:959-964`; `voiceLayerTradeNarration.js:111-112`), `stockTechnicalScores/*` (`:955`; `captureReceipt.js:147`), `institutionalHoldings/*`, `institutionalAggregates/latest` (`agentEvalPromptAssembly.js:904, :919`), `fantasyTimesStories` (`agentTriggerGate.js:211-217`), `voiceLayerCache/{battleId}` (`voiceLayerTradeNarration.js:113`; `voiceLayerAnticipation.js:221`), `agents/{id}` for attribution (`casualClone.js:291-305`). All VERIFIED.

---

## 4. Three shard shapes, priced

Common baseline for all three: 39 of an assumed 40 cron entries are used (`vercel.json:43-200`, counted programmatically = 39, VERIFIED; the 40 ceiling is "assumed Pro", BUILD_RULES §6 `:78`, and no plan-tier statement exists in the repo — `20260918_PHASE0_INTRADAY_DATA.md:373` VERIFIED). The handler already accepts either the `x-vercel-cron: 1` header **or** `Authorization: Bearer ${CRON_SECRET}` (`agent-evaluate.js:186-190`, VERIFIED), which is the in-repo internal-call pattern BUILD_RULES §6 names (`:81`). Query-string variants of one path are an established cron shape (`vercel.json:153` `compute-index-intelligence?mode=intraday`; `:85-96` `generate-pulse?period=…`, VERIFIED).

### (a) N cron entries, `?shard=k&of=N`, battles by stable hash of battle id

| Dimension | Price |
|---|---|
| **Cron slots** | N entries replace one: 39 − 1 + N. With one slot free, **N = 2 is the maximum** without de-registering another entry (40/40, nothing left for anything else). N = 3 requires consolidating one existing entry first. VERIFIED arithmetic; ceiling ASSUMED. |
| **Handler changes** | (i) parse `req.query.shard` / `of` (the `?mode=` precedent is read at `compute-index-intelligence.js:709` via `req.query`, VERIFIED); (ii) filter `activeBattles` (or `allBattles`, see below) by `hash(battle.id) mod N === k` — a `createHash('sha256')` helper has four in-repo precedents (`api/_utils/canonicalHash.js:44`, `contentHash.js:8`, `mandateSchema.js:58`, `wireEditorialSampling.js:123`, VERIFIED); (iii) decide which shard runs the per-invocation work that is not per battle: the expiry/completion loop (`:234-266`), the mastery sweep (`:276-281`), the GC repair (`:297`), the canonical-open sweep (`:316`). Left unsharded, each runs N times per tick (safe — §3.2 — but N× the reads and N racers on the sweep cursor). |
| **Ordering** | The fair-rotation sort is per invocation (`:343-345`), so it is preserved **within** a shard. A battle's shard is fixed for its life (hash of a fixed id), so cross-shard rotation is not needed. **Lost:** global balance — hash variance can put more battles in one shard, whose tail defers while the other shard idles. With N = 2 and 60 battles the split is 30 ± a few; the per-shard budget is unchanged (290 s), so each shard funds the same battles-per-tick as today — the gain is exactly 2×. |
| **Concurrency hazards (§3)** | Two invocations start on the same minute. Same-group tournament battles can land in different shards → ledger transaction contention (§3.2 row 1). A shard key of `groupId ?? battle.id` keeps a group together (a BaggerBomb battle has no group — `resolveTournamentContext` returns null from in-memory fields, `tournamentAgentLedger.js:16-17` VERIFIED). The sweep cursor is written by both shards unless gated to shard 0. EODHD instantaneous concurrency doubles (§5.2). Anthropic concurrent calls go from 1 to 2 (§5.1). |
| **Fence contact** | None, provided the hash is computed in the handler from `battle.id`. A persisted shard field would touch the fenced `createAgentBattle` doc shape; changing the query would touch `agentBattleService.js:43-50`. §7. |
| **The tape** | Identical failure states to today, only less often: a deferred battle in the slow shard records nothing and its `scoreState.lastScoredAt` (`:901`) does not advance, so the Desk shows the **late** posture — *"Last check 12:47 PM · next was due ~1:02 PM"* (`src/screens/battleView/deriveTurnLine.js:22`, `:27-32`, VERIFIED) — while a neighbour's agent in the fast shard shows a fresh check for the same slot. A budget-skipped battle shows the degraded check (§1.4) with the Why panel's *"did not complete"* line (`src/screens/battleView/battleViewCopy.js:270-276`, VERIFIED) and no Heard/evidence stamps (`deriveHeard.js:33`). |

### (b) One cron entry that fans out over HTTPS with `CRON_SECRET`

| Dimension | Price |
|---|---|
| **Cron slots** | One — the existing entry, with the fan-out branch selected by a query param or flag. 39/40 unchanged. |
| **Precedent** | Exactly one internal HTTPS fan-out exists: the tournament orchestrator's deploy call to `/api/agent/decide` — `buildDeployRequest` sends `Authorization: Bearer ${process.env.CRON_SECRET}` (`api/_utils/tournamentOrchestrator.js:312-320`, VERIFIED), `fanOutDeploys` POSTs it with the global `fetch` and **no timeout or abort signal** (`:476-482`, VERIFIED), sequentially with ≥ 20 s pacing against a 3/min rate limit on that endpoint (`:58-63`, VERIFIED). The base URL comes from `TOURNAMENT_DEPLOY_BASE_URL` or `https://${VERCEL_PROJECT_PRODUCTION_URL}` (`:292-300`, VERIFIED). **Recorded hazard:** the apex `fantasytrades.io` answers 307 to `www.`, and `Authorization` is stripped across that origin change, producing a 401 — measured in production (`:250-254`, citing `docs/audits/20260805_PR2_POST_FLIP_LIVE_VERIFICATION.md:148`, whose line was read this session — both VERIFIED). `normalizeDeployBase` rewrites the apex to `www` (`:272-290`, VERIFIED). A manual POST trigger with the same secret exists at `api/tournament/run-duty.js` (`maxDuration: 300` `:26`, `requireAdminSecret` `:42` → `ADMIN_SECRET` falling back to `CRON_SECRET`, `api/_utils/adminSecretAuth.js:23`, VERIFIED). |
| **Handler changes** | (i) an outer branch: enumerate (`:231`), run the pre-loop work once (completion, sweeps — this is where shape (b) is cleaner than (a): the outer owns them, the slices only evaluate), sort (`:343-345`), deal battles into N slices **round-robin after the sort** (global fairness kept), and `await Promise.all` of N fetches to itself with `?slice=k&of=N` plus the ids (query string or POST body — the handler is GET-only today, so a body means a method change); (ii) an inner branch: skip the pre-loop work, evaluate only the listed ids (re-querying by id is still needed to get fresh docs — the lock transaction re-reads anyway, `:568-571`). |
| **Outer budget** | The outer is its own function with its own `maxDuration`; `Promise.all` makes its wall time the **slowest slice**, not the sum. If the outer keeps `maxDuration: 300`, a slice that runs to its own 300 s kills the outer at the same instant — the outer's summary is lost, the slices are separate invocations and continue to their own end (ASSUMED — Vercel does not cancel a callee when the caller dies). `waitUntil` from `@vercel/functions` is an in-repo precedent for returning early while work continues (`api/agent/equip-bundle.js:55, :333`; `set-tempo-dial.js:46, :182`, VERIFIED) but only extends the outer's own lifetime to its ceiling. |
| **A slice that times out** | Same failure shape as today, scoped to that slice: the battle in flight at the kill loses its `finalUpdate` (lock stolen after 120 s, `:149`, `:575`), its narrations in `finally` never dispatch, the remaining battles of that slice are deferred with no entry. The outer sees a 504/connection error for that slice and cannot tell which battles were reached. The inner should set its own `TIME_BUDGET_MS` relative to its own start, which `processAgentBattle` already supports through `cronStartTime` (`:564`). |
| **Concurrency hazards (§3)** | N + 1 concurrent invocations of one function (platform per-function concurrency limit ASSUMED not reached at N ≤ 6). Ledger contention as in (a) unless the outer deals by group. Sweep-cursor contention **avoided** if the outer owns the sweeps. EODHD and Anthropic concurrency N× (§5). The fan-out itself adds N HTTPS round-trips within Vercel's edge (latency small, ASSUMED). |
| **Fence contact** | None. §7. |
| **The tape** | As (a): a battle in a slow slice shows the late posture or the degraded check; the difference from (a) is that global fairness is preserved (round-robin after the sort), so the same battle is not slow-sliced tick after tick. |

### (c) Raise the ceiling only

| Dimension | Price |
|---|---|
| **What the plan permits** | The repo self-identifies as Vercel Pro (`2026-06-10_TOURNAMENT_DESIGN_AUDIT.md:81`, citing `decide.js:33`), records "Vercel Pro allows up to 300 seconds" (`docs/KAI_TIMEOUT_FINDINGS_2026-04-30.md:96`, Apr 2026), and holds no plan-tier statement (`20260918_PHASE0_INTRADAY_DATA.md:373`). All VERIFIED as citations; the tier ASSUMED. `vercel.json` contains no runtime/duration/Fluid configuration (keys: `framework`, `functions.includeFiles`, `headers`, `crons` — `vercel.json:1-43`, VERIFIED) and the word "Fluid" appears nowhere in `docs/` or config (VERIFIED by absence). **Platform limits (ASSUMED, not in the repo):** Pro allows `maxDuration` up to 300 s on the classic serverless runtime and up to 800 s with Fluid Compute enabled; Hobby 60 s / 300 s; Enterprise 900 s. **At HEAD the handler is already at 300** (`:146`) — "raise the ceiling" buys **zero** seconds unless Fluid Compute is enabled as a project setting outside the repo. |
| **Sequential battles bought** | Budget 290 s today; 790 s if Fluid at 800 s. At the prompt's 20–30 s per battle: **10–14** today, **26–39** at 790 s. At the 44 s reserved worst case (62 s under a 40 s ceiling): 6 (4) today, 17 (12) at 790 s. At the Jul-22 healthy 2.5 s: ~115 today, ~315 at 790 s. Sixty battles at 20–30 s need 1,200–1,800 s: **deferral persists at every ceiling the plan offers.** |
| **Cron slots** | Zero. |
| **Concurrency hazards** | New, not fewer: an invocation running toward 800 s **overlaps the next tick's start** (900 s cadence). The :15 invocation sees the :00 invocation's in-flight battle as locked (`:575`, skipped as `summary.skipped`), but the :00 invocation's not-yet-reached tail is unlocked, so both invocations process it — uncontrolled two-way parallelism with the same unbounded EODHD fan-out, and `lastEvalStartedAt` written by both. Fluid Compute also changes the instance model to many concurrent invocations per process (ASSUMED): module-level state becomes shared — the `anthropicClient` singleton (`:152`) and `memoryCache` (`serverCache.js:15`) are harmless; `compute-index-intelligence.js`'s module-level `intradayQuotes` reset per invocation (`:102`, `:722`) is not, though that handler runs on :00 only (§6). |
| **Fence contact** | `:146` and `:150` (non-fenced); the test pin `api/cron/agent-evaluate.tickStamps.flagOn.test.js:112` mirrors `290_000` and must move in the same commit (the §2 pin-reconciliation rule by analogy). A ceiling change on the call itself edits `agentEvalTransport.js:14` and `:2100` — see §7 on that file's status. |
| **The tape** | Same two states; they arrive later in the invocation rather than in a different shard. At 800 s a battle at the tail is evaluated up to 13 minutes after the slot it is attributed to — `evaluation.timestamp` is `now` at `:2276`, so the card carries the late time honestly, but the Desk's `lastScoredAt + 15 min` "next check" (`deriveTurnLine.js:14-16`) will read as due before the tail battle's next evaluation can arrive. |

---

## 5. Downstream concurrency limits

### 5.1 Anthropic

- **Client construction:** `new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 0 })` at `agent-evaluate.js:165`, in a module-level singleton (`:152-168`). The comment (`:154-164`) records `maxRetries: 0` as a deliberate deviation from the codebase's `maxRetries: 2` convention, with the founder decision "measure first, no retries now" and the note that this file has exactly one `messages.create` site. VERIFIED.
- **Retry / backoff on 429:** none. The SDK retries nothing at 0; the call site catches, classifies by HTTP status — `classifyHaikuFailure` returns `'429'` as the class (`agentEvalTransport.js:74-80`, VERIFIED) — records `haikuError`, emits the `eval_degraded` beat (`:2965-2975`), increments `consecutiveEvalFailures` (`:3056-3059`), and the tick ends as a HOLD. A 429 costs the battle its decision for that slot and nothing else.
- **Recorded rate-limit tier:** none. Grep over `docs/` for Anthropic tier / RPM / tokens-per-minute finds nothing (VERIFIED by absence). The prompt's 60 calls per 15 minutes at 10–20 concurrent is priced against an unknown.
- **Other callers on the same minutes** (§6): `mandate-evaluate` (direct transport, `featureFlags.js:1967`; `mandateModelCall.js:41` client with SDK-default retries, `:152` `messages.create`), `process-pending-reflections` (`reflect.js:34`, `maxRetries: 2`), `scan-movers` → `generate-mover` → `wireModelCall` (`wireModelCall.js:46`), `generate-econ?mode=recap` at :00/:30, the orchestrator at :00/:30 in 13, 14, 21 (`tournament-orchestrator.js:33`, `maxRetries: 2`). Twenty-one `new Anthropic(` sites exist in `api/` (VERIFIED grep); they share one key and therefore one rate bucket (ASSUMED — the tier is per organization/key).

### 5.2 EODHD

- **The batch helper:** `fetchIntradayBatch` — `CONCURRENCY = 5`, `Promise.allSettled` per batch, 200 ms sleep between batches (`marketDataCache.js:883-913`; `:884`, `:909-911`, VERIFIED). It bounds only the intraday leg (held symbols, ≈6).
- **The price fan-out is unbounded:** `Promise.all(allSymbols.map(...))` at `:718-733` over ≈34 symbols, each `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily','price'] })` (`:721`) issuing one `/eod/` and one `/real-time/` GET (`marketDataCache.js:622-632` skip cache, `:638` → `:352-357`, `:684-686` → `:742-745`) — **≈68 concurrent GETs per battle**, then the hotBench-refresh fetches (`:1086`, `Promise.allSettled`, unbounded) and up to five catalyst fetches (`:1919`, sequential). Per-battle total ≈74 (`20260918_PHASE0_INTRADAY_DATA.md:431`, derivation `:440`, VERIFIED). **No EODHD fetch anywhere in `marketDataCache.js` carries a timeout or abort signal** (VERIFIED by grep: the only "timeout" match is a comment at `:222`); a stalled GET holds `Promise.all` and therefore the serial loop — the class of failure `KAI_TIMEOUT_FINDINGS_2026-04-30.md:13-15` documented for `scan-movers`.
- **Under shapes (a)/(b) with N shards:** N battles' fan-outs fire in the same instant — N × 68 GETs, on a minute already carrying `voice-layer-cache`'s bulk quotes (20 symbols per GET, `voice-layer-cache.js:33, :53-58`), `scan-movers`' per-symbol quotes at 8 concurrent (`scan-movers.js:36, :42`), `mandate-evaluate`'s 100-symbol batches (`mandateConfig.js:110`), and at :00 of 14–20 `compute-index-intelligence`'s 256-name refresh (`compute-index-intelligence.js:744`; count at `20260918_PHASE0_INTRADAY_DATA.md:418`).
- **Recorded limits:** no REST request-rate or connection tier is recorded. The intraday discovery worked against a 100,000 calls/day budget (`:631`, ASSUMED there) and found ≈2,664 calls per active battle per day (`:25`, `:431`); at 60 battles that is ≈160,000/day before the fixed ≈6,530 — **the daily budget, not the per-minute burst, is the first EODHD wall at launch scale** (arithmetic VERIFIED; budget ASSUMED). The only concurrency number in the tree is the client websocket's "concurrent connection limit (50 max)" warning (`:238`, VERIFIED) — a stream limit, ASSUMED not applicable to REST.

### 5.3 Firestore write contention on the documents in §3.2

- **`agentBattles/{id}`:** one writer per battle per tick, enforced by the lock transaction (`:568-601`). Disjoint shards never contend. Overlapping invocations on the **same** battle are resolved by the lock: the second skips (`:575`, `:606`) unless the first is older than 120 s, in which case the second steals it and both may write (the race the regime-stamp transaction guards, `:1170-1187`).
- **`tournamentGroups/{g}/ledger/agentHeldSet`:** whole-doc `tx.set` per swap; two shards swapping in one group contend; transactions serialize with retries (§3.2). The reserve → confirm → release protocol was designed for concurrent writers (`tournamentAgentLedger.js:4-8`), so correctness holds; the cost is retry latency inside the per-battle slice.
- **`masteryConfig/sweepCursor`:** read-then-`set` per invocation with no transaction (`masterySettlement.js:674-676, :712-714`); N invocations race; idempotent stamps-only work, so wasted pages not corruption.
- **`tournamentGroups/{g}`:** canonical-open sweep transactions, idempotent conditional writes; N× per tick under (a).
- **`marketDataCache/{SYM}_daily`:** fire-and-forget identical rewrites from every battle that fetched the symbol; already many-writers today; harmless.
- **`agents/{id}`:** completion transaction; second attempt sees `committed: false`. Under (a) with an unsharded expiry loop, N invocations each attempt every expired battle — N transactions, one commit.

---

## 6. The eval cron's neighbours on the same schedule

Computed from `vercel.json:43-200` (VERIFIED, programmatic): 18 other entries fire on at least one of :00/:15/:30/:45 during 13–21 UTC on weekdays. The four the prompt names, in detail:

| Entry (`vercel.json`) | Schedule | Fires with agent-evaluate at | `maxDuration` | Reads that agent-evaluate also touches | Writes that agent-evaluate also touches | EODHD / Anthropic on that minute |
|---|---|---|---|---|---|---|
| `/api/cron/voice-layer-cache` (`:161`) | `*/15 13-20` | :00/:15/:30/:45, hours 13–20 | 60 (`voice-layer-cache.js:30`) | `agentBattles` via the same `findActiveAgentBattles` (`:827`); `indexIntelligence/marketContext` + `stockRankings` (`:898-899`); `stockTechnicalScores` `getAll` (`:894`) | **`voiceLayerCache/{battleId}`** — one batched `set` per active battle (`:923`, `:962-963`, commit `:983`). agent-evaluate **reads** this doc in its `finally` narration/anticipation path (`voiceLayerTradeNarration.js:113`; `voiceLayerAnticipation.js:221`) — a read-after-write dependency on the same minute, not a write conflict. Writes nothing to `agentBattles` (VERIFIED). | EODHD real-time bulk, 20 symbols per GET (`:33`, `:53-58`), for every active battle's held + bench symbols. No Anthropic. |
| `/api/cron/mandate-evaluate` (`:185`) | `*/15 14-22` | :00/:15/:30/:45, hours 14–21 | 300, budget 290 (`mandate-evaluate.js:61-62`) | `indexIntelligence/marketContext` as the regime source (`MANDATE_REGIME_SOURCE`, `mandateConfig.js:269`; read `:374-375`, `:688-689`) | `mandateSnapshots/{tickKey}` (`:284`, `:661`), `mandates/{id}` (`:447`, `:576`, `:746`) — none touched by agent-evaluate | EODHD real-time in 100-symbol batches (`mandateConfig.js:110`); Anthropic **direct** `messages.create` per evaluated book (`featureFlags.js:1967`; `mandateModelCall.js:152`) with `MANDATE_EVAL_ENABLED = true` (`featureFlags.js:1922`). |
| `/api/fantasytimes/poll-batch` (`:113`) | `*/15 * * * 1-5` | :00/:15/:30/:45, all hours | 10 (`poll-batch.js:16`) | `fantasyTimesBatches` (`:56`) — not touched by agent-evaluate | **`fantasyTimesStories` add** (`:208`), `fantasyTimesBatches` update (`:248`). agent-evaluate **reads** `fantasyTimesStories` for the trigger gate on the same minute (`agentTriggerGate.js:211-217`) — a story landing mid-tick is seen by later battles and not earlier ones. | No EODHD. Anthropic **batch retrieve/results** only (`:6`, `:74`), no generation. |
| `/api/fantasytimes/scan-movers` (`:129`) | `*/15 13-20` | :00/:15/:30/:45, hours 13–20 | 60 (`scan-movers.js:28`) | none shared | **`fantasyTimesStories` add** via `generateAlexMoverStory` (`:11` import; `generate-mover.js:82`), `fantasyTimesConsensus`/`fantasyTimesSuppressions` (`generate-mover.js:175, :340, :374`) — the stories are read by agent-evaluate as above | EODHD real-time, one GET per symbol, 8 concurrent (`:36`, `:42`, `:58-60`) over the tracked-ticker set; Anthropic `messages.create` per detected mover (`wireModelCall.js:46`). |

Beyond the four (same minutes, VERIFIED from the schedule table): `process-pending-reflections` (`:193`, `*/15 13-0`) **writes `agentBattles`** — completed docs only (`process-pending-reflections.js:47-53`, `:87-89`) — and calls Anthropic through `reflect.js:34`; `compute-index-intelligence?mode=intraday` (`:153`, `0 14-20`) rewrites `indexIntelligence/stockRankings` **and all 239 `stockTechnicalScores` docs in one atomic batch** (`compute-index-intelligence.js:592-593`, `:1211`) at :00 — the minute agent-evaluate and voice-layer-cache read both; its `computedAt` drives agent-evaluate's intraday hotBench rebuild (`:1012-1014`), so a battle evaluated before the batch commits sees the prior vintage and one evaluated after sees the new one, within the same tick; `generate-econ?mode=recap` (:00/:30, all hours), `generate-pulse` (:30 of 13–14; :00 of 16–17; :15 of 20–21), `generate-recap` (:00 of 13, 20, 21), `tournament-orchestrator` (:00/:30 of 13, 14, 21; 300 s), `snake-draft-autopick` and `live-draft-fire` (:00/:30, all hours), `lobbies/cleanup-expired` (every quarter hour), `mandate-rollover` (:00–:45 of 13), `ingest-econ` (:45 of 14, 18), `snake-draft-daily-scores` (:15 of 21). None of these writes a document agent-evaluate writes; the shared surfaces are EODHD, the Anthropic key, and the read-side documents above.

---

## 7. Fence contact

BUILD_RULES §1 list, re-read this session (`docs/BUILD_RULES.md:14-24`, VERIFIED). Files each shape would change:

| File | (a) N entries | (b) fan-out | (c) ceiling | Fence status |
|---|---|---|---|---|
| `vercel.json` | edit (N entries) | none | none | outside |
| `api/cron/agent-evaluate.js` | edit (`:184-388` handler: shard parse, filter, sweep gating) | edit (outer/inner branches in the handler; `processAgentBattle` untouched) | edit `:146`, `:150` | outside (not on §1) |
| new `api/_utils/…` pure helper (hash / slice) + its test | add | add | — | outside |
| `api/cron/agent-evaluate.handler.test.js` (+ the tick-stamps harness tests if the handler signature moves) | edit | edit | edit `tickStamps.flagOn.test.js:112` (pin) | outside |
| `src/config/featureFlags.js` + `flagPinGuard.test.js` registry | only if flag-gated | only if flag-gated | — | outside (§2 flag-flip rule applies) |
| `api/_utils/tournamentOrchestrator.js` (`deployBaseUrl`, `normalizeDeployBase`) | — | **import**, no edit (or duplicate the apex→www rule) | — | outside |
| `api/_utils/agentEvalTransport.js` | — | — | edit `:14` only if the call ceiling itself changes | **not on §1**, but `agent-evaluate.js:141-145` calls it "the fenced pre-call guard". Discrepancy flagged; treat a ceiling edit there as founder-gated (ASSUMED) |
| `api/_utils/agentBattleService.js:43-50` | **only if** the query changes (orderBy/limit/shard field) | same | — | **§1 FENCED** — avoided by hashing `battle.id` in the handler |
| `createAgentBattle` doc shape | **only if** a shard key is persisted on the doc | same | — | **§1 FENCED** (concept) — avoided by deriving the key |
| `api/_utils/agentCronState.js` | none (a `tickMs` field would be a one-line add here, §2 finding) | none | none | outside |
| Vercel project settings (Fluid Compute) | — | — | required for any gain | outside the repo entirely |

No shape needs a §1 edit. Both fenced touch points are avoidable by construction and are listed so the spec author does not drift into them.

---

## Facts that constrain the spec

1. **No per-battle wall time exists in any record** (§2). A sharding spec cannot be validated against a number the tree does not hold; the first change should add one (a `Date.now()` pair around `processAgentBattle`, written through `finalizeCronState` — non-fenced, one line) and the ten-day table should be read from the console with `scripts/phase0-eval-timeouts-readonly.js` before the shard count is chosen.
2. **Everything expensive is per battle; the per-invocation state is three read memos** (§3.1). Sharding loses no shared computation.
3. **The pre-loop work is per invocation and not per battle** — the full active query, the expiry/completion loop, the mastery sweep with its cursor doc, the GC repair, the canonical-open sweep (§1.1, §3.2). N invocations = N× those reads and N racers on the cursor unless one shard (or the fan-out's outer) owns them.
4. **One cron slot is free**; shape (a) is bounded at N = 2 without de-registering something else (§4a). Query-string shard params have precedent.
5. **The handler already accepts `Bearer CRON_SECRET`** (`:186-190`); shape (b) needs no auth change. The one fan-out precedent recorded a production 401 from the apex 307 and carries no fetch timeout — any (b) must resolve the base through `VERCEL_PROJECT_PRODUCTION_URL`/`www` and bound the slice call (§4b).
6. **The lock is per battle and stealable at 120 s while an invocation may live 290 s**; cross-invocation concurrency is already tolerated by design (§1.5, §5.3). Shards must keep battle sets disjoint or accept lock-skips.
7. **Four tournament battles share one whole-doc-set ledger** (§3.2); a shard key by `battle.id` can split a group across shards, a key by `groupId ?? battle.id` cannot. BaggerBomb battles carry no group.
8. **EODHD per battle ≈ 74 GETs, 68 in one unbounded `Promise.all` with no timeout** (§5.2). N parallel shards multiply instantaneous concurrency N× on a minute already shared with four other EODHD callers; at 60 battles the recorded daily budget is exceeded before burst limits matter.
9. **Anthropic: `maxRetries: 0`, a 429 becomes a HOLD tick, no recorded tier** (§5.1). Parallel shards raise the eval cron's burst from 1 to N concurrent calls beside four other callers on the same minutes.
10. **`maxDuration` is already at the ceiling the repo records for its plan** (§4c). Shape (c) has no headroom without a platform setting the repo never mentions, and 60 battles × 20–30 s exceeds even the ASSUMED 800 s; an 800 s invocation also overlaps the next tick.
11. **The loop-level budget check reserves nothing for a battle's pre-call phase** (§1.4); a battle can be admitted at 289.9 s with an unbounded fetch ahead of it. Any per-slice budget inherits this.
12. **The fair-rotation key advances only on model attempts** (§1.2); never-triggering battles lead every tick. Round-robin dealing after the sort (shape b) keeps whatever fairness the sort has; hash assignment (shape a) fixes each battle's shard for life.

## Measured cost

**Per-battle wall time: NOT MEASURED in the repo.** Basis: the only figure in the tree is the Jul-22 live-ops datapoint of ~19.9 s for 8 battles (≈2.5 s each, mixed paths, UNVERIFIED against logs — `docs/ARCHETYPE_CONTROL_CENSUS_REPORT_V1.md:257`); `buildMs`/`callMs` have carried no production value into the tree since they were added on Sep 12 (`20260912_BUILD_EVAL_TRANSPORT_HYGIENE.md:500-501, :523`); no field brackets the pre-call fetches or the post-call writes, and the lock stamp is nulled in the write that stamps the entry, so the `evaluatingAt → timestamp` estimate cannot be taken from any document. Code-derived envelope for one triggered battle at HEAD: pre-call ≥ ~0.5 s and **unbounded** (≈74 EODHD GETs without timeouts, ≥ 3 sequential Firestore phases), build ≤ 10 s, call ≤ 22 s (40 s per the prompt, ASSUMED), post-call 12 s reserved (up to ~20 s of Gemma dispatch) — **44 s reserved at HEAD, 62 s under a 40 s ceiling, plus whatever the pre-call phase takes.** The prompt's 20–30 s per battle is ASSUMED (not in the tree).

---

## Findings outside this task, for separate tasking (BUILD_RULES §3)

- **R1.** `cronState.lastEvalStartedAt` is written only on model attempts (`:3047`), so battles that never trigger lead the fair-rotation sort permanently (`:343-345`). The mitigation's own comment does not say this.
- **R2.** `summary.skipped` conflates lock-skips (`:606`) and budget deferrals (`:353`); the deferral count the watch ledger asks for (`docs/LAUNCH_READINESS_WATCH_LEDGER.md:116-118`) is not separable from the response, and the response is not persisted.
- **R3.** No EODHD fetch in `marketDataCache.js` has a timeout (`:357`, `:745`, `:807`); the price fan-out at `agent-evaluate.js:718-733` is unbounded. A single stalled GET holds the serial loop — the `scan-movers` failure class of Apr 30.
- **R4.** The loop-level budget check (`:349-355`) reserves nothing for the admitted battle's pre-call phase.
- **R5.** Stale comments: `agent-evaluate.js:309-312` says the canonical-open sweep is inert with `LEAGUE_CANONICAL_OPEN_CAPTURE` off, but the flag is `true` (`featureFlags.js:375`); `voiceLayerTradeNarration.js:188`, `voiceLayerAnticipation.js:290` and `tournamentAgentLedger.js:64` still cite "the cron's 60s maxDuration", raised to 300 in July (`agent-evaluate.js:141-146`).
- **R6.** `agentEvalTransport.js` is called "fenced" at `agent-evaluate.js:141-145` but is not on BUILD_RULES §1 (`:14-24`). One of the two should change.
- **R7.** The evaluation entry has no `tickMs`; adding one beside `buildMs`/`callMs` through `finalizeCronState` is a one-line non-fenced change and the precondition for Fact 1.
