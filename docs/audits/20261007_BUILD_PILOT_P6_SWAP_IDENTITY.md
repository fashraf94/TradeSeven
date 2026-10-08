# Build report — Pilot P6: Swap Identity Check (G01)

**Prompt:** "Build Prompt — Pilot P6: Swap Identity Check (G01)", Fable, 7 October 2026. **Session:** Claude Code, 7 October 2026, in its own worktree. **Branch:** `claude/pilot-p6-swap-identity`, cut from `origin/main` at **`3f784e8d`** after `git fetch origin main` (PR #939 — the P6 Phase 0 — merged, so the map was present; no STOP). The desktop app named the local branch `claude/pilot-p6-swap-identity-1c8f42`; it is pushed under the prompt's name. **Fence:** this prompt is the founder's sanctioned entry to `api/_utils/agentSwapExecution.js` (BUILD_RULES §1) — **the fenced diff is in §2 for sign-off.** **Decisions in force:** D1–D6 (7 Oct).

**Governing documents (read at `3f784e8d`):** `docs/audits/20261007_PHASE0_PILOT_P6_SWAP_IDENTITY.md` (the map; anchors re-verified before editing), `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` §6–§8, `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md`, `docs/BUILD_RULES.md`.

---

## Executive verdict

| Question | Answer |
|---|---|
| What does it do? | Every swap the agent makes now **names the position it means to sell** — the stock and the instant it entered the slot. Inside the swap's own transaction the executor compares that with what actually sits in the slot, and reads whether the battle is still active. At **shadow** it records the comparison on the trade and trades exactly as today; at **enforce** a stale belief or a finished battle is **refused — nothing is written** — and the caller holds and records why. |
| Is it live? | **No — dark.** `SWAP_IDENTITY_MODE = 'off'`. At off every one of the six executor calls is made with exactly its pre-P6 arguments and the executor computes nothing. |
| What changes at off? | **The three honest-record fixes, and nothing else** (§6): a failed auto-executed proposal is no longer filed `auto_executed`; a failed approved proposal is marked; the suppression pass no longer files every executor refusal as a guardrail fault. Proven by every existing golden plus a new executor-level golden captured from `main`'s untouched executor, and by reviewer S3's own 72-run base-vs-head differential (§7.1). |
| Fence contact? | **One fenced file:** `api/_utils/agentSwapExecution.js` (+143 / −8; full diff §2). Nothing else fenced is edited. One non-fenced helper gains an optional argument (`marketSchedule.getETDate(at)`, byte-identical for every existing caller). No position id is minted; the creation shape, the capture schema, rules, the cockpit matcher, the lock and every prompt are untouched. |
| Acceptance | **A1–A12 met**, plus the three record fixes, the census on a fixture, and table F free of §E words (§4). |
| Tests | Linux suite of record (CI-shaped `--maxWorkers=2`, `TZ=UTC`): **18,840 passed, 0 failed (18,927 rows incl. 87 skipped; exit 0)** at the code head. **Both flips dry-run green on Linux** (§9). `lint:gate` and `vite build`: **green** on an LF checkout of the pushed head. |
| Review (BUILD_RULES §2) | Mandatory (fence contact; 31 files). **4 lenses + 4 refuting verifiers + a mutation lens.** 30 P6 findings → **14 CONFIRMED, 12 PARTIAL, 4 REFUTED**; every one fixed or dispositioned (§8.1). One **pre-existing** high outside P6 (score forgery through a client-written proposal) — filed as a separate task. Mutation: **155 mutants, 135 caught, 6 equivalent; the 14 survivors each got a proven row** (9 reachable, 5 hardening) (§8). |
| Where the code departs from the prompt | §5 — the ones that need your eye: **table F's speaker follows the trade's provenance** (a guardrail stop on the model route speaks the protective line; a stagnation exit speaks the agent line); **the suppression pass's typed reason lands in `checks.execution.reason`, not `guardrail.faultClass`** (that enum is the capture schema P5 owns); a caller with no evaluation id gets **`verificationId: null`**; refused meeting legs and a refused expired proposal **also show in the feed**. |
| Things for you | §10: the founder questions. §11: the census — how and when. §12: the two flip steps (each one flag line + one pin line). |

---

## 0. Preamble

- **Session open (BUILD_RULES §2/§3).** `git fetch origin main` first; `origin/main` = `3f784e8d` ("Merge pull request #939"). Local worktree branch `claude/pilot-p6-swap-identity-1c8f42` at `3f784e8d`, tree clean. The Phase 0 map was present on `main`, so the STOP condition did not fire. Every commit staged explicit paths after re-checking the branch in the same command.
- **Inputs re-verified.** The Phase 0 anchors were at `e0993cba`; between `e0993cba` and `3f784e8d` only the Phase 0 report itself landed, so every executor and caller anchor still held. Each call site was re-read before editing.
- **Boundary check.** `git diff 3f784e8d..HEAD --stat` touches none of `agentRiskManager.js`, `agentGuardrails.js`, `agentBattleService.js`, `api/_utils/tickCapture/captureConfig.js` / `captureSerializer.js`, `firestore.rules`, `api/_utils/callRecords/flip.js` / `heard.js`, the lock/lease code, any prompt module or any tool schema (reviewer S3 confirmed with `diff -rq`). No position id is minted. No rules change, so the emulator rules suite was not re-run (nothing it covers moved).
- **Linux runs** used a private WSL clone (`~/pd-p6`); the shared `~/pd-amendd` was not touched. The census script was **not run** against anything but its fixture; no production read, no credentials.

---

## 1. What changed and where

**Commits** (`3f784e8d..HEAD`): `61615f79` **commit 1 — the seam (fenced)** · `bf8152c7` **commit 2 — the six callers**, table F, Amendment C, the census · `bf48fe1d` off-shape suites pin the flag (the shadow flip becomes one line) · `bb9968ce` direct-executor fixtures carry `status: 'active'` (the enforce flip becomes one line) · `63f183ac` §2 review fixes (S1–S4) · `24f277c0` rows that kill the mutation lens's survivors (S5) · this report.

### 1.1 The seam (fenced) — `api/_utils/agentSwapExecution.js`

| What | Where |
|---|---|
| Typed refusals: `SWAP_REFUSAL_REASONS`, `SwapRefusalError` (`reason`, `verification`, a readable message) | `:98`, `:105` |
| The flag read, guarded (`flagSwapIdentityMode`) and the resolver (`resolveSwapIdentityMode` — unknown → `'off'`) | `:115`, `:124` |
| `buildVerification` — Phase 0 §7.1's object from the transaction's own read; `refusalOf` — `battle_not_active` outranks a mismatch | `:138`, `:170` |
| The options bag `opts = { now, fetchDailyReference, expectedOut, identityMode }` | `:222` |
| One clock reading before the transaction (`startedAt` → ET date, UTC date, through `getETDate(at)`), the Guard 3 fetch through `fetchDailyReference` | `:240`, `:258` |
| One clock reading per attempt (`attemptAt` → stamps, beacon age, cooldown, `checkedAt`); the check and the enforce refusal, before every older refusal | `:276`, `:285` |
| `trades[i].verification` (absent at off) | `:407` |

`api/_utils/marketSchedule.js` (not fenced): `getETDate(at = new Date())` — the executor passes its injected instant; every existing caller passes nothing and gets the same value.

### 1.2 The flag — `src/config/featureFlags.js`

`SWAP_IDENTITY_MODE = 'off'`, `SWAP_IDENTITY_MODES = ['off', 'shadow', 'enforce']`, with the runway docstring and a `// Pinned by:` pointer. Dedicated pin and allowed-values suite: `src/config/swapIdentityFlags.test.js` (the `callRecordsFlags.test.js` pattern: value pin, frozen list, docstring pointer, never a `DARK_BY_DESIGN` key, ten odd values → `'off'`, the executor's default reads this flag through the guard).

### 1.3 The callers — `api/cron/agent-evaluate.js` + `api/_utils/swapIdentity.js` (new, not fenced)

| Caller | Belief handed to the executor | At mode ≠ off, on a typed refusal |
|---|---|---|
| **C1** risk loop | `expectedOutOfPosition(asset)` — the position the risk verdict was computed on | holds; feed beat `risk_swap_failed` takes the table F line (speaker by provenance: protective for the risk manager, agent for an archetype stagnation exit), `refusalReason`, `verificationId`, `verification` |
| **C2** model route | the position `validateTradeDecision` resolved from the model's `symbolOut` | `decision: HOLD`, `downgraded`, the `Swap execution failed:` prefix kept; the entry's conditional `executionRefusal`; capture `checks.execution = {status: 'evaluated', result: 'blocked', reason}`; no executor result carried to the cockpit (never `acted`) |
| **C3** approved proposal | the proposal's stored `symbolOut` + `outgoingSwappedInAt` (symbol-only without it) | history row `executionFailed: true` + `executionRefusal`; the existing feed beat takes the table F line |
| **C4** expired co-pilot proposal | the same stored belief | history row `resolution: 'auto_execution_failed'`, `executionFailed`, `executionRefusal`; a table F feed beat |
| **C5** suppression pass | the position the pass resolved by symbol | capture `checks.execution` blocked + reason (stage `gameplan_handled`); feed beat with the protective line + reason + verification |
| **C6** approved meeting | each leg's stored `symbolOut` + `swappedInAt` (symbol-only without it) | meeting history row `legRefusals[]` (incl. a **departed** leg, `verification: null`); a table F feed beat per refused or departed leg |

The mode is resolved **once per check** (`currentSwapIdentityMode()` in `processAgentBattle`) and threaded to every handler. `swapIdentityOptions(mode, belief)` returns **nothing at off**, so each call keeps its pre-P6 arguments (ten; nine for the meeting leg, which passes no snapshot — its options take the eleventh place with the snapshot's own default padded in). **Creation sites** store the identity at mode ≠ off only: the proposal (`outgoingSwappedInAt`, unreachable today under the launch guard — D6 keeps it), and each new meeting leg (`swappedInAt`, read from the trigger's own picture before the creation tick's suppression pass can trade).

### 1.4 Docs, census, tests

| File | What |
|---|---|
| `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` | **Table F** (V1.1 — 7 Oct 2026): the three lines verbatim from D5; `[SYM]` from `verification.expected.symbol`, never the occupant; the speaker rule (§5 row 1). |
| `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` | **Amendment C**: the §8.2 row `verificationId → trades[i].verification`, written by the executor at commit. |
| `scripts/census-swap-identity.mjs` (+ test, fixture) | The read-only census (§11). |
| Tests (new) | `api/_utils/agentSwapExecution.identity.test.js` (A1–A6, the seams), `api/_utils/agentSwapExecution.offGolden.test.js` + `api/_utils/__fixtures__/swapExecutorOffGolden.json` (A7), `src/config/swapIdentityFlags.test.js`, `api/_utils/swapIdentity.test.js`, `api/cron/agent-evaluate.swapIdentity.test.js` (A8–A11, the fixes), `scripts/census-swap-identity.test.js`. |
| Tests (changed) | `api/cron/agent-evaluate.test.js` — the 10th-argument pin moved (Phase 0 §10) and the `handlePendingProposal` signature pin; `api/cron/agent-evaluate.suppressionPass.test.js` — the pass's argument-object pin; `api/_utils/__fixtures__/tickStampsHarness.js` — `SWAP_IDENTITY_ENTRY_KEYS` (the `CALLS_ENTRY_KEYS` pattern); ten off-shape suites pin `SWAP_IDENTITY_MODE: 'off'` in their own mocks (the `CALL_RECORDS_MODE` precedent — §9); `agentSwapExecution.test.js` / `flat6TierStamp.passthrough.test.js` fixtures gain `status: 'active'`. |

---

## 2. The fenced diff, in full — for founder sign-off

`git diff 3f784e8d..HEAD -- api/_utils/agentSwapExecution.js` (LF, at the pushed head):

```diff
diff --git a/api/_utils/agentSwapExecution.js b/api/_utils/agentSwapExecution.js
index bdc2463b..90a70ffe 100644
--- a/api/_utils/agentSwapExecution.js
+++ b/api/_utils/agentSwapExecution.js
@@ -15,6 +15,9 @@ import { getETDate, formatDateString } from './marketSchedule.js';
 // June 2026 import rule (BUILD_RULES §4); the co-located test's import of this
 // module is the dependency-surface guard.
 import { resolveModeConfig } from '../../src/constants/agentGameModes.js';
+// P6 swap identity check (pilot spec §7) — the same Node-clean src import rule;
+// the same co-located guard.
+import { SWAP_IDENTITY_MODE, SWAP_IDENTITY_MODES } from '../../src/config/featureFlags.js';
 
 // ==================== VALIDATION ====================
 
@@ -89,6 +92,98 @@ export function validateTradeDecision(decision, battle) {
   return { valid: errors.length === 0, errors, resolvedTier, resolvedSlotIndex };
 }
 
+// ==================== P6 — THE SWAP IDENTITY CHECK (G01) ====================
+
+/** The typed refusals the executor raises at SWAP_IDENTITY_MODE 'enforce' (spec §7; founder decisions D2, D3). */
+export const SWAP_REFUSAL_REASONS = Object.freeze(['outgoing_identity_mismatch', 'battle_not_active']);
+
+/**
+ * A swap the executor refused at 'enforce' — nothing was written. The message
+ * stays readable for the callers' existing `err.message` catches; `reason` and
+ * `verification` carry the typed outcome.
+ */
+export class SwapRefusalError extends Error {
+  constructor(reason, verification, message) {
+    super(message);
+    this.name = 'SwapRefusalError';
+    this.reason = reason;
+    this.verification = verification;
+  }
+}
+
+/** The flag's value, or 'off' when it cannot be read (a hermetic test mock that omits it). Never throws. */
+function flagSwapIdentityMode() {
+  try {
+    return SWAP_IDENTITY_MODE;
+  } catch {
+    return 'off';
+  }
+}
+
+/** The mode `value` names, or 'off' for anything that is not one of the walked states. Never throws. */
+export function resolveSwapIdentityMode(value) {
+  try {
+    return SWAP_IDENTITY_MODES.includes(value) ? value : 'off';
+  } catch {
+    return 'off';
+  }
+}
+
+/**
+ * The verification evidence (Phase 0 §7.1), built from the transaction's own
+ * read. `expected` is the caller's belief about the outgoing position, `found`
+ * the slot's occupant at this attempt. The id derives from inputs only, so a
+ * transaction retry re-derives the same one.
+ */
+function buildVerification({ battleId, evaluationMetadata, mode, expectedOut, outAsset, liveData, resolvedTier, resolvedSlotIndex, checkedAt }) {
+  const found = { symbol: outAsset?.symbol ?? null, swappedInAt: outAsset?.swappedInAt ?? null };
+  let expected = null;
+  let basis = null;
+  let verdict = 'not_checked';
+  if (expectedOut) {
+    expected = { symbol: expectedOut.symbol ?? null, swappedInAt: expectedOut.swappedInAt ?? null };
+    // A stored belief without the entry instant (a legacy proposal, a client-
+    // written record) can only be checked by symbol, and says so.
+    basis = expectedOut.swappedInAt !== undefined ? 'symbol_and_entry' : 'symbol_only';
+    const sameSymbol = expected.symbol !== null && expected.symbol === found.symbol;
+    const sameEntry = basis === 'symbol_only' || expected.swappedInAt === found.swappedInAt;
+    verdict = sameSymbol && sameEntry ? 'match' : 'mismatch';
+  }
+  // A caller without an evaluation identity (a client-written proposal) gets
+  // no id rather than one every such call on the battle would share.
+  const evaluationId = evaluationMetadata?.evaluationId;
+  return {
+    verificationId: typeof evaluationId === 'string' && evaluationId ? `${battleId}:${evaluationId}:verify` : null,
+    mode,
+    expected,
+    found,
+    verdict,
+    basis,
+    battleStatus: liveData.status ?? null,
+    slot: { tier: resolvedTier ?? null, slotIndex: resolvedSlotIndex ?? null }, // never undefined (Firestore)
+    tradeSeq: liveData.scoreState?.tradeCount || 0,
+    checkedAt,
+  };
+}
+
+/** The refusal `verification` calls for at 'enforce', or null. An ended battle outranks a moved slot. */
+function refusalOf(verification) {
+  if (verification.battleStatus !== 'active') {
+    return {
+      reason: 'battle_not_active',
+      message: `Swap refused (battle_not_active): the battle's status is ${verification.battleStatus ?? 'missing'}`,
+    };
+  }
+  if (verification.verdict === 'mismatch') {
+    const { expected, found, slot } = verification;
+    return {
+      reason: 'outgoing_identity_mismatch',
+      message: `Swap refused (outgoing_identity_mismatch): expected ${expected.symbol} in ${slot.tier}[${slot.slotIndex}], found ${found.symbol ?? 'an empty slot'}`,
+    };
+  }
+  return null;
+}
+
 // ==================== EXECUTION ====================
 
 /**
@@ -112,9 +207,26 @@ export function validateTradeDecision(decision, battle) {
  * @param {Object} currentPrices - { symbol: { current, previousClose, ... } }
  * @param {Object} evaluationMetadata - { id, action, trigger, rationale, hypothesis, evaluationId, tradingDay }
  * @param {Object|null} snapshot - Phase 4: per-symbol technical snapshot { symbolOut, symbolIn }, persisted on trades[i].snapshot for Sprint 2 replay. Null when not provided.
+ * @param {Object} [opts] - P6 (pilot spec §7). Omitted while the flag is 'off', every default reproduces the
+ *   pre-P6 behaviour exactly; with the flag on, an omitted belief is recorded 'not_checked'.
+ * @param {() => Date} [opts.now] - the clock; read once before the transaction and once per transaction attempt.
+ * @param {Function} [opts.fetchDailyReference] - the Guard 3 daily-reference fetch (getStockAnalysisData's signature).
+ * @param {{symbol: string, swappedInAt?: string|null}|null} [opts.expectedOut] - the caller's belief about the
+ *   outgoing position. `swappedInAt` present (null for a creation-time position) → checked by symbol AND entry
+ *   instant; absent → by symbol only. Null → 'not_checked'.
+ * @param {string} [opts.identityMode] - 'off' | 'shadow' | 'enforce' (anything else → 'off'). 'off' computes
+ *   nothing; 'shadow' records `verification` on the trade row; 'enforce' also refuses a moved slot or an
+ *   inactive battle with a SwapRefusalError and writes nothing.
  * @returns {Object} { closedTrade, incomingAsset }
  */
-export async function executeSwapServer(db, battleId, battle, resolvedTier, resolvedSlotIndex, benchAsset, currentDay, currentPrices, evaluationMetadata = {}, snapshot = null) {
+export async function executeSwapServer(db, battleId, battle, resolvedTier, resolvedSlotIndex, benchAsset, currentDay, currentPrices, evaluationMetadata = {}, snapshot = null, opts = {}) {
+  const {
+    now: clock = () => new Date(),
+    fetchDailyReference = getStockAnalysisData,
+    expectedOut = null,
+    identityMode = flagSwapIdentityMode(), // SWAP_IDENTITY_MODE
+  } = opts;
+  const mode = resolveSwapIdentityMode(identityMode);
   const battleRef = db.collection('agentBattles').doc(battleId);
 
   // ---- Guard 3 (parity with the live-eval badge baseline) ----
@@ -124,12 +236,14 @@ export async function executeSwapServer(db, battleId, battle, resolvedTier, reso
   // missing), pre-fetch its daily series as the Guard 2 reference. swapPrice and
   // validated day-1 startingPrice need no reference, so those paths fetch nothing.
   // Fetched here — before the transaction — so no network I/O runs inside it.
-  const todayET = formatDateString(getETDate());
+  // P6 §8: one clock reading for every pre-transaction date.
+  const startedAt = clock();
+  const todayET = formatDateString(getETDate(startedAt));
   const activationDateET = battle?.activatedAt
-    ? formatDateString(new Date(new Date(battle.activatedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })))
+    ? formatDateString(getETDate(new Date(battle.activatedAt)))
     : todayET;
   const isActivationDay = todayET === activationDateET;
-  const utcToday = new Date().toISOString().slice(0, 10);
+  const utcToday = startedAt.toISOString().slice(0, 10);
 
   const preOut = battle?.portfolio?.[resolvedTier]?.[resolvedSlotIndex];
   const preStartingPrice = battle?.portfolio?.startingPrices?.[preOut?.symbol];
@@ -141,7 +255,7 @@ export async function executeSwapServer(db, battleId, battle, resolvedTier, reso
   if (guard3NeedsRef) {
     guard3Symbol = preOut.symbol;
     try {
-      const refData = await getStockAnalysisData(preOut.symbol, { forceRefresh: true, fields: ['daily', 'price'] });
+      const refData = await fetchDailyReference(preOut.symbol, { forceRefresh: true, fields: ['daily', 'price'] });
       if (Array.isArray(refData?.daily)) guard3Daily = refData.daily;
     } catch (err) {
       // No reference → Guard 2 accepts previousClose unchanged (err toward not intervening).
@@ -157,12 +271,31 @@ export async function executeSwapServer(db, battleId, battle, resolvedTier, reso
 
     const liveData = battleSnap.data();
     const outAsset = liveData.portfolio[resolvedTier]?.[resolvedSlotIndex];
+    // P6 §8: one clock reading per attempt — the stamps, the beacon's age and
+    // the bench cooldown all derive from it; a retry reads it afresh.
+    const attemptAt = clock();
+
+    // ---- P6: the swap identity check (G01, pilot spec §7) ----
+    // From THIS attempt's read: the occupant against the caller's belief, and
+    // the battle's status. Computed before every other refusal, so a stale
+    // belief is named as such even where the older checks below would also
+    // throw (a slot that now holds the incoming symbol reads as a self-swap).
+    // 'off' computes nothing.
+    let verification = null;
+    if (mode !== 'off') {
+      verification = buildVerification({
+        battleId, evaluationMetadata, mode, expectedOut, outAsset, liveData,
+        resolvedTier, resolvedSlotIndex, checkedAt: attemptAt.toISOString(),
+      });
+      const refusal = mode === 'enforce' ? refusalOf(verification) : null;
+      if (refusal) throw new SwapRefusalError(refusal.reason, verification, refusal.message);
+    }
 
     if (!outAsset) {
       throw new Error('Asset no longer available in slot');
     }
 
-    const now = new Date().toISOString();
+    const now = attemptAt.toISOString();
     const outSymbol = outAsset.symbol;
     const inSymbol = benchAsset.symbol;
 
@@ -180,7 +313,7 @@ export async function executeSwapServer(db, battleId, battle, resolvedTier, reso
     // Prefer live beacon prices over REST-fetched (15-min delayed) prices
     const beacon = liveData.livePriceBeacon;
     const beaconFresh = beacon?.updatedAt &&
-      (Date.now() - new Date(beacon.updatedAt).getTime()) < 120000; // < 2 min
+      (attemptAt.getTime() - new Date(beacon.updatedAt).getTime()) < 120000; // < 2 min
 
     const getPrice = (symbol) => {
       if (beaconFresh && beacon.prices?.[symbol] > 0) return beacon.prices[symbol];
@@ -270,6 +403,8 @@ export async function executeSwapServer(db, battleId, battle, resolvedTier, reso
       ...evaluationMetadata,
       // Phase 4: per-symbol technical snapshot at decision time (null if caller did not provide one)
       snapshot,
+      // P6: the identity verification, on the row it verified (absent at 'off').
+      ...(verification ? { verification } : {}),
     };
 
     // ---- Build incoming asset ----
@@ -317,7 +452,7 @@ export async function executeSwapServer(db, battleId, battle, resolvedTier, reso
       baseATR: outAsset.baseATR,
       isCrypto: outAsset.isCrypto || false,
       direction: outAsset.direction || null,
-      cooldownUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
+      cooldownUntil: new Date(attemptAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
     };
 
     let updatedBenchStocks;
```

The one non-fenced line it leans on — `git diff 3f784e8d..HEAD -- api/_utils/marketSchedule.js`:

```diff
diff --git a/api/_utils/marketSchedule.js b/api/_utils/marketSchedule.js
index 68ed8b46..07b6428e 100644
--- a/api/_utils/marketSchedule.js
+++ b/api/_utils/marketSchedule.js
@@ -57,8 +57,9 @@ const SERVER_TTL = {
 // TIMEZONE HELPERS
 // ============================================
 
-export function getETDate() {
-  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
+/** The ET wall-clock date for `at` (now, by default) — Pilot P6 passes its injected clock's instant. */
+export function getETDate(at = new Date()) {
+  return new Date(at.toLocaleString('en-US', { timeZone: 'America/New_York' }));
 }
 
 export function formatDateString(date) {
```

---

## 3. The verification object, as built

```
trades[i].verification = {
  verificationId,   // `${battleId}:${evaluationId}:verify` — from inputs, the same across a retry; null if the caller has no evaluation id
  mode,             // 'shadow' | 'enforce'
  expected,         // { symbol, swappedInAt } — the caller's belief; null when it passed none
  found,            // { symbol, swappedInAt } — the slot's occupant at this attempt (null/null for an empty slot)
  verdict,          // 'match' | 'mismatch' | 'not_checked'
  basis,            // 'symbol_and_entry' (the belief carries swappedInAt, null included) | 'symbol_only' | null (not_checked)
  battleStatus,     // liveData.status ?? null
  slot,             // { tier, slotIndex } — never undefined
  tradeSeq,         // scoreState.tradeCount at the read (pre-state)
  checkedAt,        // this attempt's clock reading
}
```

A creation-time position has no `swappedInAt`; its belief carries `null` and matches only the original (A4). A symbol that left and came back carries a new instant and mismatches (A3). At enforce `battle_not_active` (any status other than exactly `'active'`, a missing one included) outranks a mismatch, and both are evaluated before the older refusals — so a replayed swap whose slot now holds the incoming stock is named as a stale belief rather than "cannot replace itself" (A2, A9). The Admin SDK's own transaction aborts on a thrown application error without retrying and rejects with the same error object, so `reason` and `verification` reach the caller intact (verified by reviewer S1 against `@google-cloud/firestore`'s `transaction.js`).

---

## 4. Acceptance results

| # | Row (Phase 0 §9.2 / the prompt) | Result | Proof |
|---|---|---|---|
| A1 | Belief matches → commits; `trades[i].verification` at shadow and enforce, absent at off | **Met** | `agentSwapExecution.identity.test.js` "A1": the exact object at both modes; the returned trade IS the written row; shadow and enforce differ from off by exactly that one key (whole-write comparison); a caller with no belief records `not_checked` (`expected`/`basis` null) and proceeds |
| A2 | Changed slot (P02): enforce refuses typed, writes nothing; shadow commits with `mismatch` | **Met** | "A2" rows: `SwapRefusalError` (`reason`, `verification`, readable message), no buffered write in any attempt; shadow trades XOM as today and its row says mismatch; enforce names a stale belief even where the older checks would also throw (the slot now holds the incoming symbol; an emptied slot) — shadow keeps today's messages word for word |
| A3 | Symbol left and returned → mismatch | **Met** | "A3": enforce refuses, shadow records; a belief stored without the instant can only check the symbol and says `symbol_only` |
| A4 | Creation-time position: null matches the original, mismatches a returned swap-in | **Met** | "A4": both directions (null ≠ an instant; an instant ≠ null) |
| A5 | Finished battle → `battle_not_active` (D3); shadow records the status | **Met** | "A5": `completed` refused even with a matching identity; outranks a moved slot; needs no belief; a missing status fails closed; shadow commits and records `battleStatus` |
| A6 | Transaction retry: verdict from the fresh read, id identical across attempts, one write | **Met** | "A6" against a retrying double (the body re-runs on a competing commit): attempt 1 `match`, attempt 2 `mismatch` on the fresh read; the same exact id on both; one commit; each attempt its own clock reading; at enforce the second run refuses and only the competing write stands |
| A7 | Off byte-identical, pinned by an executor-level golden | **Met** | `agentSwapExecution.offGolden.test.js` + `swapExecutorOffGolden.json` (SHA-256 `b7de67bc…` over LF bytes), **captured by running this same file (every line but the SHA pin) against `main`'s untouched executor** in a Linux checkout of `3f784e8d` — re-captured after every edit to the file, byte-identical each time; reviewer S4 reproduced it independently. 16 shapes (every write path — swapped-in, held-from-start with the Guard 3 fetch, activation day, no `activatedAt`, crypto short round trip, bench replace, fresh and stale beacon, flat6, the 50-trade cap, no metadata — and every pre-P6 refusal) × **4 ways**: the pre-P6 ten-argument call; `'off'` named with a belief that matches nothing; an unknown mode; the clock and fetch **injected** with the system clock set years away (a bypass of either seam moves a stamp or a date gate) |
| A8 | Each caller's refusal, through `processAgentBattle` | **Met** | `agent-evaluate.swapIdentity.test.js`, the **real executor** with a competing commit landed just before it reads: **C1** protective beat with reason + verification, the new occupant never named by any call, the loop continues (PG's exit commits after KO's refusal); **C2** HOLD / downgraded / prefix / `executionRefusal` / capture `evaluated·blocked·reason` / no carried result (calls shadow: `carryExecutorResult` not called on a refusal, called once on a commit) / the entry key last and after `declarationsPhase`; **C3** history row + table F beat; **C4** `auto_execution_failed` + refusal + beat; **C5** capture blocked, no guardrail fault, protective beat; **C6** a departed and a returned leg — one executor call, both recorded, beats in the feed. Plus the slot **already** moved before the tick for C3/C4 (stored and legacy beliefs, enforce and shadow) |
| A9 | Duplicate approval → refused by identity | **Met** (§5 row 6) | The stale-worker replay (a snapshot taken before the first run committed) is refused as `outgoing_identity_mismatch` with `found: AMD` — at off the same replay fails on the self-swap invariant and the honest record marks it. A replay on a fresh read never reaches the executor (bench-gone lapse) — pinned too |
| A10 | Shadow changes no behaviour | **Met** | Off vs shadow for **every committing caller** (two risk exits, model SWAP, HOLD, approved proposal, expired co-pilot proposal, approved meeting, the suppression pass) at calls off, and three of them at calls shadow: every battle write identical once `verification` / `executionRefusal` are lifted, capture documents byte-identical, one verification per committed trade |
| A11 | Creation sites store the identity; a legacy record runs `symbol_only` | **Met** (§5 row 7) | Meeting legs at shadow carry the picture's `swappedInAt` (null for creation-time positions) and nothing at off (`Object.keys` = the three pre-P6 keys); a leg stored after an earlier execution this tick keeps the picture's instant; the proposal site by source pin (unreachable under the launch guard); legacy proposals → `symbol_only` |
| A12 | Mutation rows | **Met** | §8.2: 155 single-point mutants — 135 caught, 6 equivalent (argued), 14 survivors all now killed by rows landed in `24f277c0` (9 reachable, 5 hardening); every A12 mutant the Phase 0 named is caught (the comparison removed, the status read removed, the id made a clock value, …) |
| — | The three honest-record fixes | **Met** | §6, each with an off row and a "success is unchanged" row |
| — | The census on a fixture | **Met** | `scripts/census-swap-identity.test.js` (24 rows) on `scripts/__fixtures__/swapIdentityCensusBattles.json`: every caller's join, repeated pre-Sep-21 eval ids, an ambiguous join, a co-pilot model swap, a planted verification, the disagreement signal, `--since` on every channel, a read-only member-call allowlist |
| — | Table F has no §E words | **Met** | `api/_utils/swapIdentity.test.js`: table F parsed from the spec file and compared byte for byte with the shipped constants; the §E list (+ "chose to hold") over the templates and every rendering; placeholders filled from the record only (a missing value → no line) |

---

## 5. Where the code departs from, or reads, the prompt and Phase 0

| # | Prompt / Phase 0 said | The build does | Why |
|---|---|---|---|
| 1 | Table F: "`outgoing_identity_mismatch` (agent, proposal or meeting)" / "(protective)"; Phase 0 §5.3 groups C1 and C5 as protective | **The speaker follows the trade's own provenance (its receipt `source`), not the route that ran it.** Deterministic exits — the risk manager's protective exits and the equipped guardrails (stop, trailing stop, profit target) — speak the **protective** line on either route; everything the agent decided — a model swap, an **archetype (stagnation) exit**, a proposal, a meeting leg — speaks the **agent** line. Table F's rule text says so. | Reviewers S2 and S4 showed that routing by caller gives one check two speakers: a guardrail stop forced on the model route would read "The agent tried to swap…" while the battle view's own label for the same check reads "A guardrail called for a swap · it did not go through" (D-70; BUILD_RULES §9), and a stagnation exit — which the cron itself calls "archetype-authored" — would read "Protection was set to sell…". Verifiers SV2 and SV4 agreed on the facts but judged it a wording-rule question for you. The rule is new text in this PR, so I chose the reading that agrees with the record. **Founder: confirm, or ask for routing by caller (a one-line change in each catch). Either way, the profit target sits under "Protection" — see Q2.** |
| 2 | "C5's fault class becomes the typed reason instead of `guardrail_error`" | An executor throw in the suppression pass is **no longer filed as a guardrail fault at all**: it is recorded as the execution check the pass ran — `checks.execution = {status: 'failed'}`, or for a typed refusal `{status: 'evaluated', result: 'blocked', reason}` — with `stage: 'gameplan_handled'`. The pass's own faults stay `guardrail_error`. | `guardrail.faultClass` is `enum:GUARDRAIL_FAULT_CLASSES`, which admits only `'guardrail_error'` (`api/_utils/tickCapture/captureConfig.js:155`, `captureSerializer.js:89`). The typed reason written there would be nulled by the serializer — or the enum would have to widen, which is the capture schema the prompt reserves for P5. `checks.*.reason` is an existing `id` field: the typed reason lands with no schema change, and the record says what happened (the guardrail layer did not fault; the execution failed). The executor's message text now lives in the feed beat and the log, not the capture body (reviewers S2-6 / S3-5; the obvious home, `validationErrors()`, would put a decision count on a tick that made no decision). **Founder: confirm, or ask P5 to widen the enum.** |
| 3 | `verificationId = ${battleId}:${evaluationMetadata.evaluationId}:verify` | The same — and **`null`** when the caller has no evaluation id. | Every server-built path supplies one (verified at all six sites); only an owner-written proposal can omit it, and the literal template then gives `<battle>:undefined:verify`, shared by every such call. Amendment C says so. |
| 4 | "basis is `symbol_and_entry` when `expectedOut.swappedInAt` was supplied, else `symbol_only`" | The same — and when **no** belief was passed (`not_checked`), `expected` and `basis` are both `null`. | `symbol_only` on a row that checked nothing would be counted as a symbol check. "Supplied" = the key is present: a creation-time position's belief carries `swappedInAt: null` and is checked by symbol AND entry. |
| 5 | "Every existing clock read derives from one `now()` per attempt" | **Two** readings per executor call: one before the transaction (today's ET and UTC dates for the Guard 3 gate) and one per transaction attempt (the stamps, the beacon's age, the bench cooldown, `checkedAt`). | Reading the in-transaction stamps from the pre-transaction instant would stamp a trade before its own Guard 3 fetch and freeze it across a retry — a behaviour change at off. One reading per attempt keeps today's semantics exactly (a retry re-reads the time); the off golden proves the bytes. The ET conversion goes through `marketSchedule.getETDate(at)`, which gains an optional instant (non-fenced; every existing caller unchanged) so the fenced file keeps no copy of it (review S1-3). |
| 6 | A9: "the same approved proposal processed on two ticks → the second is refused by identity" | Proven in the shape that reaches the executor: a **second worker holding a snapshot taken before the first run committed**. | A replay on a **fresh** read never reaches the executor at any mode: C3 re-resolves the incoming symbol on the bench first, and it left the bench when the first run committed — the bench-gone lapse holds it (pinned by its own row). The stale-snapshot replay is the overlap case of Phase 0 §3.1 (the lock ages out at 120 s). |
| 7 | A11: "the proposal and meeting creation sites store the identity" | The meeting site is proven through `processAgentBattle`; the **proposal** site by a source pin. | The proposal-creation branch is unreachable: the model path forces `mode = 'autopilot'` before it (the launch guard). D6 keeps it storing the identity for the day the authority arc revives it. Its readers (C3/C4) are proven with and without the stored identity. |
| 8 | Phase 0 §4.4: C1's belief from "the position already read at `:2017-2019`" (the slot re-resolved on the refreshed book) | C1's belief is **`asset`** — the position the risk verdict was computed on, from the tick's own picture. | Reviewer S2-3: for a second or later exit in one tick, the refreshed book could already hold a *returned* symbol, and the check would pass it and sell it under another position's verdict. `asset` is the same read for the first exit; verifier SV2 tested the change and found no false refusal (only an executor commit can change a slot). |
| 9 | (unstated) Meeting legs' identity at creation | Read from the **trigger's own picture** (`flatPortfolio`), the one each leg was chosen from; a leg the picture cannot place stores nothing (symbol-only). | Reviewer S2-4: after a proposal executed earlier the same tick, the refreshed book no longer holds the leg's symbol, and the leg would silently lose its identity. Never `null` for "not found" — null means a creation-time position (verifier SV2). |
| 10 | "C3 and C4: the history row carries the typed refusal"; "C6: each leg's refusal is recorded" | Recorded as asked — **and** at mode ≠ off a refused expired proposal (C4) and each refused or departed meeting leg (C6) also push a `hold` feed beat with the table F line. | C4 and C6 had no player-visible trace at all; the meeting card disappears the moment the player approves it, and D2's default is "do nothing **and say so**". Verifier SV2 judged the beats not required by the prompt (not a regression either). **Founder: keep, or strike — the history records stand alone.** |
| 11 | (shape, unstated) | Every refusal record is `{reason, verificationId, verification, line}`; feed beats carry `refusalReason`, `verificationId`, the executor's `verification`, and take the table F line as their `message`. Meeting legs add `symbolOut` / `symbolIn`. | "Player-facing text written by the server at mode ≠ off (feed beats, history rows) uses table F." The typed fields govern; the line renders them; a line whose placeholder the record cannot fill is not written. For the risk route and the suppression pass the beat is the refusal's only record, so it carries the evidence (review S4-5). |
| 12 | Honest-record fix for C3: "marks a failed execution instead of a bare `approved`" | `executionFailed: true` beside `resolution: 'approved'`; C4: `resolution: 'auto_execution_failed'` + `executionFailed: true`. | The coach's approval is a true fact; the failed execution is a second one. `auto_execution_failed` is read by nothing that matches `auto_executed` (`voiceLayerPrompt.js` provenance, `AgentChat.jsx`'s lapsed filter) — correct, since no trade exists. |
| 13 | Phase 0 §6.1 named the shadow field `identityCheck` | `trades[i].verification` | The build prompt names it `verification`; Phase 0 §7 names the object the same. |
| 14 | (ordering, unstated) | At **enforce** the identity/status refusal is evaluated **before** the older refusals (empty slot, self-swap, duplicate incoming). At shadow and off the older checks run exactly as today. | A stale belief whose slot is empty or now holds the incoming stock is named as what it is. Both refuse and write nothing. |

---

## 6. What changes at `off` — the three record fixes, and nothing else

At `SWAP_IDENTITY_MODE = 'off'` every executor call keeps exactly its pre-P6 arguments (the options spread is empty), the executor computes nothing, and no creation site stores anything. Three things change at **every** mode, because each corrects a false history written on a failure path and none changes a trade:

| # | Where | Before (main) | After (every mode) | Proof |
|---|---|---|---|---|
| 1 | C4 — an expired co-pilot proposal whose auto-execution **threw** | `proposalHistory[]` row `resolution: 'auto_executed'` — a swap that never happened | `resolution: 'auto_execution_failed'`, `executionFailed: true` (+ `executionRefusal` at mode ≠ off) | `agent-evaluate.swapIdentity.test.js` "HONEST RECORD … C4" (off) and the enforce row; a successful auto-execution is still `auto_executed` with no marker |
| 2 | C3 — an approved proposal whose execution **threw** | the row stays a bare `resolution: 'approved'` | `executionFailed: true` beside `resolution: 'approved'` (+ `executionRefusal` at mode ≠ off); the feed beat is today's, word for word | "HONEST RECORD … C3" (off), the A9 off row (today's self-swap failure is now marked), and "a successful approval is filed exactly as before" |
| 3 | C5 — the suppression pass, when the **executor** throws | capture `guardrail: {suppressionPassFaulted: true, faultClass: 'guardrail_error'}` — every executor refusal filed as a guardrail fault | capture `checks.execution = {status: 'failed', stage: 'gameplan_handled', …}` (`evaluated / blocked / reason` for a typed refusal at mode ≠ off); the guardrail fault is no longer written for it. The pass's **own** faults (the evaluator throws) are still `guardrail_error`. The feed beat is today's. | "HONEST RECORD … C5" (off) + "the pass's OWN fault … is still guardrail_error" |

Everything else at `off` is byte-identical: every existing golden passes unchanged (callRecords offGolden — every battle write, prompt byte, capture document and **writer argument** on 19 exits; tickStampsEntryGolden.flagOff; tickCoherence T1 noSwap; guardrailErrorFailClosed T2 pre-fix; rollback), plus the new executor-level golden (16 shapes × 4 ways, captured from main's untouched executor). None of the three fixes is on a path those goldens drive (all three are failure paths of dormant or rare branches), which is why each has its own row.

---

## 7. What the review proved about `off`

### 7.1 Reviewer S3's base-vs-head differential

S3 built its own harness — `processAgentBattle` with the **real** executor (wrapped), capture on, a frozen clock — and ran **36 scenarios × calls off/on = 72 runs** against `main`'s product code and this branch's (swapping `agent-evaluate.js` and `agentSwapExecution.js` in and out of its tree, restored byte-exact). **58 identical; the 14 that differ are exactly the three intended fixes** (C3 `executionFailed`; C4 `auto_execution_failed`; C5's capture moving from the guardrail fault to the execution check). Byte-identical in both trees: hold; model swap (success, throw, slot moved, slot emptied, battle ended); risk exits (the same variants); approved proposal (success, slot moved, bench gone); vetoed; launch guard; expired co-pilot (success, bench gone); expired manual; pending proposal; approved meeting (success, throw, slot moved); rejected meeting; meeting created; the suppression pass (forced, slot moved, evaluator throws, a real guardrail) — every battle write, prompt, capture document, writer argument (10, or 9 for the meeting leg), summary and stored document.

### 7.2 Shadow and enforce, against the same harness

Shadow minus `trades[].verification`, the entry's `executionRefusal: null`, the executor's eleventh argument, new meeting legs' `swappedInAt` and departed-leg records **equals off in all 72 runs**; capture documents and prompts identical. At enforce the differences appear only in the refused scenarios. A10 now pins this for every committing caller at calls off and shadow (§4).

---

## 8. BUILD_RULES §2 review

**Mandatory** (fence contact; 31 files, +5,570 / −40 at the code head `24f277c0`, before this report). Run as a multi-lens adversarial review with subagents, each on **its own** LF `git archive` snapshot tree under the session scratchpad (`node_modules` linked by junction), read-only on git and on every other tree: **4 lenses** — S1 the fenced seam, S2 the six callers and their records, S3 the off guarantee / boundaries / flips, S4 the record, the words, the docs, the census and the tests — at `bb9968ce`; **4 verifiers** (SV1–SV4, one per lens, each on its own tree, told to refute every finding with a probe); and **a mutation lens** (S5) run last, on its own tree of the fix head `63f183ac`. Ids are this build's own (S·, SV·), distinct from P1a's L· and P2's R·. Every tree was unlinked (junction by junction) and deleted afterwards; the real `node_modules` file count was 47,066 before and after.

### 8.1 Findings, verdicts, dispositions

| ID | Finding (short) | Verdict | Disposition |
|---|---|---|---|
| S1-1 | The clock seam's tests could not see a bypass of `utcToday` (crypto Guard 2 cutoff), and golden way 4 compared against the REAL clock — blind on the fixture's own date | PARTIAL (low; (a) confirmed, (b) refuted as a gap — two identity rows straddle the ET boundary) | **Fixed** — way 4 now runs under a system clock years away; a UTC-cutoff row (crypto) and an ET-cutoff row (stock) pin the dates by the injected clock |
| S1-2 · S2-7 · S4-4 | `verificationId` could be `<battle>:undefined:verify` (shared); Amendment C said "one per executor call" | PARTIAL / CONFIRMED (nit) | **Fixed** — `null` without an evaluation id (§5 row 3); Amendment C: "one per decision verified; a retry or a replay re-derives it" |
| S1-3 | The fenced file carried its own copy of `getETDate`'s conversion | CONFIRMED (nit) | **Fixed** — `getETDate(at)` (non-fenced, optional instant) for both conversions |
| S1-4 · S3-OOS-1 | A client-written proposal's `evaluationMetadata` overrides `lockedPoints` / prices / symbols on the trade row → score forgery | CONFIRMED (**high, pre-existing** — same on base) | **Separate task** (§13); not P6's |
| S2-1 · S4-1 | Table F's speaker by caller: a guardrail stop on the model route spoke "The agent…", a stagnation exit "Protection…" | REFUTED as a build defect (SV2) / PARTIAL (SV4) — both: the facts hold, the rule is a founder question | **Changed to provenance routing** and flagged (§5 row 1; Q1) |
| S2-2 | A proposal without tier/slot put `undefined` into the refusal record at enforce → the write threw every tick, the proposal never cleared | CONFIRMED (medium → low; fix before the enforce flip) | **Fixed** — slot null-filled; rows at the executor and through `processAgentBattle` |
| S2-3 | The risk loop's 2nd+ exit read its belief off the refreshed book — a returned symbol passed and was sold under another position's verdict | PARTIAL (low; the departed-symbol skip is old behaviour) | **Fixed** — belief = `asset` (§5 row 8); the silent skip → §13 |
| S2-4 | New meeting legs stamped from the refreshed book lost their identity after an earlier execution that tick | CONFIRMED (nit) — "store null when not found" refuted | **Fixed** — stamped from the trigger's picture; a leg it cannot place stores nothing (§5 row 9) |
| S2-5 | C4 and C6 refusals left no player-visible trace | REFUTED (not required by the prompt; not a regression) | **Built anyway** at mode ≠ off, flagged (§5 row 10; Q4) |
| S2-6 · S3-5 | C5's honest fix drops the executor's text from the capture body | PARTIAL / CONFIRMED (nit) — the suggested `validationErrors()` home is wrong (it would count a decision on a tick that made none) | **Declared** (§5 row 2) — the text stays in the feed beat and the log |
| S2-8 | `battle_not_active` does not stop the tick | REFUTED as a defect (writes nothing) | §13 follow-up |
| S3-1 | The executor's flag default threw under a hermetic mock that omits the flag; a caller that omitted the mode could split from the executor | PARTIAL (nit — loud, fails closed, no production caller) | **Fixed anyway** (cheap): a guarded flag read in the executor; the exported pass defaults to the flag's own value |
| S3-2 | The off goldens never drive the proposal, meeting or pass paths; A10 covered 3 scenarios at calls off | PARTIAL (nit) | **Fixed** — A10 over every committing caller, calls off and shadow (§4); S3's 72-run differential recorded (§7) |
| S3-3 | A planted `verification` lands on the trade row at off and the census would count it | CONFIRMED (nit; base writes the same key) | **Fixed in the census** — only executor-written verifications count; the rest are "invalid" |
| S3-4 | More false records outside the three fixes (lapse branches; an untyped meeting throw; provenance ignores `executionFailed`) | CONFIRMED (low; all on base) | §13 — a fourth off change needs your sanction |
| S3-6 · S4-11 · S4-12 | Stale or wrong text (the fenced docstring after a flip, "ten arguments", the golden's file name, the tables header, a "SILENTLY" comment) | CONFIRMED / PARTIAL (nit) | **Fixed** — including the fenced docstring, so a flip never touches the fence; the pin row's title is value-neutral |
| S4-2 | The census joined model rows on a non-unique `evalId` (pre-Sep-21 battles repeat `eval_151`) and bucketed a co-pilot battle's model swaps as proposals | CONFIRMED (low) | **Fixed** — join on id + incoming symbol + decision; ambiguous counted apart; caller from the entry's decision |
| S4-3 | The C3/C4 rows moved the slot only inside the executor, so a "belief from the slot" mutant survived | CONFIRMED (medium, test integrity) | **Fixed** — rows with the slot already moved before the tick (stored and legacy beliefs, enforce and shadow) |
| S4-5 | Risk/suppression refusals kept only an id on the beat | REFUTED (the amendment scoped it; capture's execution slot is the model route's) | Beats now carry the `verification` too (§5 row 11) |
| S4-6 | Census `--since` skipped history rows; the space form was ignored | CONFIRMED (low) | **Fixed** |
| S4-7 | The census's read-only guard missed `.add(` | PARTIAL (nit) | **Fixed** — an allowlist of every member call |
| S4-8 | Nothing pinned `passExecutorInFlight = false` | CONFIRMED (low) | **Fixed** — a post-commit refresh fault stays the pass's own fault |
| S4-9 | Nothing pinned "legs stamped before the pass trades" | CONFIRMED (low) | Moot after S2-4 (the picture is untouched by the pass — S5 shows the mutant equivalent); the S2-4 row covers it |
| S4-10 | The census report did not print every window or explain unknown | PARTIAL (nit) | **Fixed** |
| S4-13 | An unfillable table F line leaves the executor's raw message (naming the occupant) on the beat | PARTIAL (nit; only a malformed owner-written record) | Declared — that is the pre-P6 message |

**Tally (lenses S1–S4): 30 P6 findings — 14 CONFIRMED, 12 PARTIAL, 4 REFUTED** (plus one pre-existing high, confirmed by two lenses and a verifier). No critical. No off-guarantee, fence or boundary defect: S3's differential and S4's own run (58 files at off, shadow and enforce — only the pin row moves) both came back clean.

### 8.2 Mutation lens (S5) — acceptance row A12

Run last, on its own LF tree of `63f183ac`, against 14 test files (376 rows green at baseline): **155 single-point mutants** across the executor, the helper, the six caller sites, the census, `getETDate` and the flag — **135 caught, 6 equivalent, 14 survived.**

- **Every A12 mutant the Phase 0 named is caught:** the comparison removed (37 rows), symbol-only (8), the status read removed (5 / 4), the id made a clock value (9 / 8 / 8 — A6 among them), enforce not refusing (32), shadow refusing (13), verification at off (55, the A7 golden among them), the identity check moved behind the older refusals (3 / 5), every clock and fetch bypass (1–23 each), the resolver accepting unknown values (22).
- **9 reachable survivors (S5-1 … S5-6), each given a row** in `24f277c0`, proven to fail under its mutant and pass on the code (146/146 with the rows added): the activation-date conversion (an evening-ET activation; the two A12 clock variants that had survived), a belief with no symbol at the executor, an empty stored symbol, the census's proposal-history join and ambiguity, `--since` on an overdue active battle, and the census import loading no env file.
- **5 unreachable survivors (S5-7, S5-8)** — the off-gates on C3–C6 and the caller-side flag fallback, which matter only if a typed refusal arrives at off (impossible: the executor computes nothing there) or a mock omits the flag — given hardening rows anyway.
- **6 equivalent**, each argued: the resolver is idempotent (2); a typed error can only come from the in-flight executor call; the meeting stamp reads a picture the pass never touches (so before/after the pass is the same — S4-9); every leg is placeable by construction; the census's decision filter is implied by its `symbolOut` filter.
- **Net: 135 caught + 9 killed by new rows + 5 hardened = every non-equivalent mutant now fails a row.** Spot-checked in the worktree after landing (S5-1 under the UTC-date mutant, S5-2 under the null-symbol mutant: each caught; the executor restored byte-exact).

---

## 9. Test runs

| Run | Where | Result |
|---|---|---|
| Full suite, CI-shaped (`--maxWorkers=2`, `TZ=UTC`) — **the suite of record** | WSL Ubuntu (private clone), final code head `24f277c0` | **18,840 passed, 0 failed (18,927 rows incl. 87 skipped; 254 s; exit 0)** |
| **Flip 1 dry run** — `SWAP_IDENTITY_MODE` → `'shadow'` + its pin row, nothing else | same clone, `24f277c0` | **18,840 passed, 0 failed** (254 s) |
| **Flip 2 dry run** — → `'enforce'` + its pin row, nothing else | same clone, `24f277c0` | **18,840 passed, 0 failed** (256 s) |
| Control for the dry runs — the flag moved **without** its pin | same clone | the module exports `'shadow'` / `'enforce'`; **exactly the pin row fails** (1 of 17) — so the dry runs ran the flipped flag |
| How the flips became one line | earlier dry runs | at `bf8152c7` the shadow flip failed **78 rows in 11 off-shape suites** → commit `bf48fe1d` pinned them `'off'` (the `CALL_RECORDS_MODE` precedent); at `bf48fe1d` shadow was green and enforce failed **12 rows in the 2 direct-executor suites** (fixtures without `status`) → commit `bb9968ce`. Reviewers S3 and S4 re-ran the flips independently on their own trees (S4: 58 files; S3: 47 files) — only the pin row moved |
| Full suite, CI-shaped | WSL, commit 2 `bf8152c7` | 18,791 passed, 0 failed (87 skipped; 248 s) |
| The A7 fixture's provenance | WSL, a clean checkout of `origin/main` @ `3f784e8d` running the final generator file | fixture SHA-256 `b7de67bc…` — byte-identical to the committed one (also reproduced by S4 on its own base tree) |
| `npm run lint:gate` | LF checkout of the pushed head | **green** (exit 0) |
| `vite build` | LF checkout of the pushed head | **green** (exit 0) — the pushed commit is the built commit |
| Emulator rules suite | — | **not run**: `firestore.rules` and `test/rules/` are untouched (`git diff 3f784e8d..HEAD` empty for both) |
| Windows note | CRLF worktree, targeted cron/config/executor suites | the same 5 platform-only failures as on `main` here (the `evalRun` "exactly ONE block" rule row and the `tickStamps.pins` anti-vacuous row read CRLF; the tickCoherence T1 noSwap golden and the `shadowCpuQuoteIntegrityFlags` guard row are CRLF/regex; the film-tape e2e times out under load) — none is this build's, all pass on Linux |

---

## 10. Founder questions and carry-forwards

**Questions (each has a default already built; nothing blocks the merge):**

- **Q1 — Table F's speaker (§5 row 1).** Built: by the trade's provenance — a guardrail stop on the model route speaks "Protection was set to sell…", a stagnation exit speaks "The agent tried to swap…". The alternative is by caller (risk route and suppression pass protective, every other route agent), one line in each catch. Recommended: keep provenance — it is the reading that agrees with what the battle view already says about the same check.
- **Q2 — The profit target.** A guardrail profit target is a deterministic user order, not protection, but table F has only the two speakers; under either routing it reads "Protection was set to sell [SYM]…". If you want a third line for it ("Your profit target was set to sell [SYM]…"), that is a V1.2 of table F and a one-line routing change.
- **Q3 — The suppression pass's typed reason (§5 row 2).** Built: in `checks.execution.reason`, with the guardrail fault no longer written for executor throws. Confirm, or ask P5 to widen `GUARDRAIL_FAULT_CLASSES` in its schema bump.
- **Q4 — The extra feed beats for C4/C6 refusals (§5 row 10).** Built: at mode ≠ off a refused meeting leg (or one whose stock has left) and a refused expired proposal show a table F line in the feed. Keep, or strike — the history rows stand alone.
- **Q5 — The census before flip 1.** Optional: run it once (§11) for G01's realized rate over the retained window; the shadow read is the one that matters for flip 2.

**Carry-forwards:**
- **P5** copies `verificationId` into the tick record's `actions[]` (Amendment C) — and, if Q3 goes that way, widens the guardrail fault enum.
- **No client reads** `executionRefusal`, `legRefusals` or a beat's `refusalReason` / `verification` yet; the model route's refusal still shows the existing "Argued for a swap · it did not go through" (the `Swap execution failed:` prefix is kept). Rendering the records is a client build's job.
- **The cockpit** never marks a refused swap `acted` and writes no "no matching trade" for it (no committed result is carried — proven at calls shadow). A visible "the trade was refused" receipt on a call is the cockpit arc's (Phase 0 §5.4).

---

## 11. The census — how to run it (not run by this session)

`scripts/census-swap-identity.mjs` is read-only by construction (`.select()`, `.get()`, `getAll()` only; its test pins **every** member call in the file to a reviewed read-only allowlist, so a write, an `.add` or a batch added later fails CI). It loads `.env.local` and the Admin SDK **only inside `main()`**, so importing it (the test does) touches nothing. The founder runs it from the repo root:

```bash
node scripts/census-swap-identity.mjs --out docs/audits/20261008_SWAP_IDENTITY_CENSUS_0.md --json census-0.json
```

| When | Command | What to read |
|---|---|---|
| **Before flip 1** (optional, any time — needs no build) | the command above, no `--since` | §1 of the report: per caller, rows where the believed outgoing symbol ≠ the committed one. This is G01's realized frequency over the retained window (`trades[]` keeps 50 rows per battle, `evaluations[]` 150). `Belief unknown` is a join that aged out — never counted as a match; `Belief ambiguous` is a repeated evaluation id with conflicting beliefs (battles older than the Sep 21 evaluation counter) — never counted as a mismatch. |
| **The shadow read** (after ≥ 5 full sessions at `shadow`) | `node scripts/census-swap-identity.mjs --since=<the shadow flip's production deploy, ISO> --out docs/audits/<date>_SWAP_IDENTITY_SHADOW_READ.md` | §2: `trades[].verification` by caller × verdict × basis. **`Verdict disagrees with the symbol comparison` must be 0** (the script exits 2 otherwise). `mismatch` rows are the swaps enforce would have refused; `symbol_only` rows are beliefs stored before the build (legacy proposals and meeting legs); `invalid` rows carry a `verification` the executor did not write (wrong mode or id — e.g. planted through a client-written proposal) and are excluded from every verdict. §3: refusals (none expected at shadow) and the honest-record markers. |
| During `enforce` | same, with `--since=<enforce deploy>` | §3: refusals per channel and reason. |

The belief joins (Phase 0 §6.3): risk `risk_<reason>_<SYM>_<ms>`, suppression `guardrail_<type>_<SYM>_<ms>`, meeting `gameplan_<OUT>_<IN>_<ms>` (all three from `trades[].evaluationId`); model and proposal rows join the evaluation entry with the same `evalId` **and** incoming symbol that decided SWAP (model) or PROPOSAL (proposal), else `proposalHistory[].evaluationMetadata.evaluationId`. `--since` (either `--since=<ISO>` or `--since <ISO>`) applies to every channel: trades by `swappedOutAt`, entries and beats by `timestamp`, history rows by `resolvedAt` (else `createdAt`). Run it at least weekly during the shadow period — the 50-row cap rolls.

## 12. The two flip steps

Each is the founder's own PR, never a build PR, and each is **exactly two lines** — the flag and its pin row (BUILD_RULES §2). Both were dry-run on the Linux suite of record at this branch's head (§9).

**Flip 1 — `off` → `shadow`** (after this PR merges and deploys):
- `src/config/featureFlags.js`: `export const SWAP_IDENTITY_MODE = 'off';` → `'shadow';`
- `src/config/swapIdentityFlags.test.js`: `expect(SWAP_IDENTITY_MODE).toBe('off');` → `.toBe('shadow');`

From the next tick: every committed swap carries `trades[i].verification`; proposal and meeting creation store the outgoing identity; every evaluation entry carries `executionRefusal: null`; nothing is refused. Then run the census at least weekly; after **≥ 5 full trading sessions**, the shadow read.

**Flip 2 — `shadow` → `enforce`** (after the shadow read shows the mismatch rate and zero disagreements):
- `src/config/featureFlags.js`: `'shadow'` → `'enforce'`
- `src/config/swapIdentityFlags.test.js`: `.toBe('shadow')` → `.toBe('enforce')`

From the next tick: a swap whose outgoing position moved, or that reaches a battle that is no longer active, is refused and held, and the refusal is recorded (§1.3).

**Rollback** is the same line back. Rolling back stops new verifications and refusals; it rewrites none already recorded.

---

## 13. Out of scope — noted, not fixed (BUILD_RULES §3)

- **Score forgery through a client-written proposal (pre-existing, high; S1-4 / S3-OOS-1, confirmed by SV1 and a probe at flag off on base and head).** The owner may write `executionMode` and `pendingProposal` wholesale (`firestore.rules:459`); the proposal handler's launch guard keys on that client-writable `executionMode`; the approved and expired paths spread `proposal.evaluationMetadata` into the executor's metadata, which the executor spreads into the trade row **after** its computed fields — so a planted `lockedPoints: 9999` lands on `trades[]`, and `bankedScore` sums `trades[].lockedPoints`. P6 neither causes nor fixes it (at shadow/enforce the executor's `verification` overrides a planted one; the census counts a planted one as invalid). **Filed as a separate task** (the chip in this session).
- **Two more false history rows in the proposal handler**, outside the three fixes: the approved branch's bench-gone and reserve-lost lapses still file a bare `approved`, and the expired co-pilot branch's bench-gone and reserve-lost lapses still file `auto_executed` although nothing executed (their feed beats say "could not execute" / "Lapsed."). `detectTradeProvenance` (`api/_utils/voiceLayerPrompt.js:~1835`) also ignores `executionFailed`, so a failed approval can still lend "approved" provenance to a same-pair trade within 5 minutes. All dormant (launch guard).
- **An approved meeting whose executor throws an UNTYPED error is still silent** — no beat, no history marker, at every mode (the catch logs only; Phase 0 already recorded it). This is the one item here on a live path (the meeting-approval card is mounted); P6 records only typed refusals and departed legs, as asked (S3-4 c).
- **More owner-forgeable records** (SV3, folded into the score-forgery task): an owner-planted `executionFailed` / `executionRefusal` on a proposal flows into `proposalHistory` unchanged, and `gameplanMeetingHistory` is itself owner-writable — so the census's §3 counts trust records an owner could write. The census counts only executor-written `verification` objects as verdicts.
- **The suppression pass's "Guardrail exit failed" beat** is pushed even when the swap committed and only the post-commit refresh threw (pre-existing; the capture side is now pinned correct — S4-8).
- **A risk exit whose stock has left the book** is skipped with a log line only (`if (!slot)` in the risk loop) — the same at every mode, older than P6; recording it as a protective refusal would be D2's "say so" (S2-3 tail).
- **`battle_not_active` does not stop the tick** — later exits are each refused (nothing is written) and the model is still called once. A short-circuit is a cheap follow-up (S2-8).
- **The meeting trigger's picture is not rebuilt after a proposal executes in the same tick** (pre-existing; the identity stamp now reads that same picture, so the record is consistent with what was diagnosed).
- **The incoming stock is not re-validated against the live bench at commit** (Phase 0 §1.4), and **the feed shows believed rather than committed symbols on a successful swap** (Phase 0 §2.3) — both as the prompt says; once `enforce` is on, a refusal makes them agree for the outgoing symbol.
- **Under a lease overlap a stale worker rewrites `proposalHistory`** from its stale snapshot (the A9 replay row shows it) — the sharding spec's worker-lease item.
- `api/_utils/tournamentAgentLedger.js:5` still says "five" call sites (Phase 0 §14 item 3).

---

## 14. Branch and PR

Local branch `claude/pilot-p6-swap-identity-1c8f42` (the app's suffix), pushed as `claude/pilot-p6-swap-identity`; commits in §1; this report is the last commit. **Pushed, PR opened, and stopped** — the founder reads CI, signs off the fenced diff (§2), and merges. Nothing here runs on a schedule; no cron entry is added. A byte-exact copy of this report was written outside the repo tree (the session scratchpad) per BUILD_RULES §3. The pre-existing score-forgery path (§13) is filed as a separate task.

*Build report — Pilot P6, Claude Code, 7 October 2026, base `3f784e8d`.*
