# Build report — T2 `fix/guardrail-error-fail-closed`

**Date:** 2026-09-19 · **Executor:** Opus (Claude Code) · **Author of prompt:** Fable
**Source ruling:** adjudication V1.1 (`docs/audits/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md`)
**Branch:** `fix/guardrail-error-fail-closed`, cut fresh from `main` @ `6cd3699a` · **No PR, no merge, no flag flip.**
**Preamble (BUILD_RULES §3):** `git fetch origin` run as the session's first step; `origin/main` == `6cd3699a`. Branch cut clean from `origin/main`. Audit anchor `:2375` re-located to `:2375-2379` at HEAD and **VERIFIED**.

---

## Executive verdict

| | |
|---|---|
| **The bug** | The catch around `applyGuardrails` logged and **proceeded with Haiku's original decision**. That inverts the layer's purpose: the deterministic override exists to *stop* trades the thresholds forbid, so an exception there means the one check that could have blocked the swap did not run — and the proposal executed with its guardrails silently absent. |
| **Measured, not argued** | Under the pre-fix catch, the S7 test row calls `executeSwapServer` **twice** — once for the risk exit, once for the unguarded proposal. With the fix: **once**. That is the defect, demonstrated. |
| **The fix** | The proposal becomes HOLD, failure category `guardrail_error`, the error **message** recorded (no stack). Later legality checks still run on the now-HOLD result, exactly as today. |
| **Scope** | The **model proposal only.** Anything already executed earlier in the tick — S7 risk exits, meeting-approved swaps — is committed and stands. Nothing reverts a trade. |
| **Failing-file set** | **Unchanged from the gate: empty.** 22 → 23 files, 303 passing, 2 skipped. |
| **Verdict** | **DONE.** Pushed, not merged. One merge-composition note for Flash in §6.1. |

---

## 1. What changed — `api/cron/agent-evaluate.js` only (+53 / −4)

`agent-evaluate.js` is **not** on the §1 fence list. `agentGuardrails.js` **is**, and was neither edited nor read-modified — only *called*, exactly as before, and doubled in the new test file (tests only).

### The catch (`:2375-2411`)

```js
const message = String(err?.message || '').slice(0, 200);
const heldProposal = decision !== 'HOLD';

decision = 'HOLD';
if (heldProposal) {
  downgraded = true;
  holdKind = 'default_failure';
  validationErrors.push(`Guardrail evaluation failed — proposal held: ${message}`);
}

haikuFailure = { failureClass: 'guardrail_error', message, timestamp: …, timeoutKind: null };
```

Three properties worth naming:

* **`heldProposal` gates the downgrade.** A model that already said HOLD had no proposal to hold, so it keeps a *chosen* HOLD — no `downgraded`, no `holdKind`, no validation error. The prompt's "a chosen HOLD keeps whatever it writes today", enforced rather than assumed. The **fault is still recorded** either way: a guardrail that throws is a real engine fault whether or not it changed the outcome.
* **The message, never the stack.** `err.message` only, capped at 200 chars — the same shape every other failure record in this handler uses. Asserted negatively in the suite (the serialized entry matches no stack-frame pattern).
* **Setting `haikuFailure` buys two existing receipts for free**, rather than inventing new ones: the `eval_degraded` status-feed beat (`:3056`, whose own comment says "a silent fallback HOLD is indistinguishable from a deliberate one without this") and the durable `cronState.cronErrors` entry (`:3153`). A guardrail fault is now as visible as a transport fault instead of living only in the logs.

### `holdKind` (new field)
Declared at `:2011`, set on the four fallback-HOLD branches, composed **last** onto the evaluation record at `:2965`. `grep holdKind` across the repo returned **zero hits** before this change, so this is the single new field the prompt's common rules permit, not a new value — stated as required.

### Pins reconciled in the same commit (BUILD_RULES §2 precedent)
`api/_utils/__fixtures__/tickStampsHarness.js` gains `FAIL_CLOSED_ENTRY_KEYS = ['holdKind']`, appended to `BASE_ENTRY_KEYS`; `agent-evaluate.tickStamps.flagOff.test.js`'s key pin follows. **`PRE_PHASE_B_ENTRY_KEYS` is untouched** — it is frozen history bound to `tickStampsEntryGolden.flagOff.json`, which is why `holdKind` is composed last.

---

## 2. What deliberately did NOT change

* **`consecutiveEvalFailures` still counts this tick as a success.** It is gated on `haikuResult ? 'success' : …` (`:3146`), and the *model call* did succeed — it was the guardrail evaluation that failed. The counter is the degraded-transport disclosure signal; re-pointing it at a different fault class is a semantic change to an existing telemetry field and is outside this fix. Flagged, not silently altered.
* **The LOCK and distressed-regime checks** below the catch are `if (decision === 'SWAP' && …)`, so on the now-HOLD result they run and find nothing to block — "still run on the (now HOLD) result as today", literally.
* **No PROPOSAL is created.** The copilot-mode branch is also `decision === 'SWAP'`-gated, so failing closed holds the proposal rather than converting it into a pending one.

---

## 3. The second `applyGuardrails` site — checked, and NOT the same defect

`runSuppressionDeterministicPass` calls `applyGuardrails` at `:3820` inside its own try/catch (`:4105`). That catch is already fail-closed in the relevant sense: the R11 pass passes `haikuResult: null`, so **there is no model proposal to proceed with**. It logs, emits a `risk_swap_failed` feed beat, and releases the tournament reservation. **No sibling bug; nothing filed.** (BUILD_RULES §3 would have required filing rather than fixing had one existed.)

---

## 4. Tests added — `api/cron/agent-evaluate.guardrailErrorFailClosed.test.js` (218 lines, 5 rows)

Real `processAgentBattle` on the shared tick harness. The fenced `agentGuardrails.js` is **doubled in tests only** (the premise of the suite is that the evaluator throws); `injectDiversifierSectorCap` and the observe-cap resolver stay real, so the gate deciding *whether the evaluator runs at all* is production code.

| Row | Asserts |
|---|---|
| **throws on a SWAP proposal** | HOLD, `symbolOut/In` null, `downgraded`, `holdKind`, `failureClass: 'guardrail_error'`, the exact message, **no stack anywhere in the serialized entry**, the validation error, **`executeSwapServer` never called**, `summary.swapped === 0`, the entry still written, and an `eval_degraded` feed beat |
| **S7 exit survives** | A **real** bust-avoidance exit (KO priced at −0.91x ATR, past the balanced preset's −0.85x buffer — the production risk manager, not a stub) fires *before* the model call. The guardrail then throws on an unrelated proposal. `executeSwapServer` called **exactly once**, the risk beat is on the feed with `bust_avoidance`, the proposal's incoming ticker **never reached the executor**, and the entry is a `guardrail_error` HOLD. |
| **a chosen HOLD stays chosen** | no `downgraded`, no `holdKind`, empty `validationErrors` — but the fault **is** recorded |
| **evaluator does not throw** | a guarded tick still executes its SWAP, no failure record |
| **no regression** | an unguarded HOLD tick is byte-identical to the pre-fix golden, plus the anti-vacuity check that `holdKind` is present-and-null |

### Mutation check (BUILD_RULES §2)
The pre-fix catch was restored. **All 3 defect rows go red**; the 2 no-regression rows stay green, which is correct — they assert behaviour the fix does not change. Restored, re-verified green.

The S7 row's failure mode under mutation is the headline evidence: `expected "vi.fn()" to be called 1 times, but got 2 times`. The old code really did execute the proposal the guardrail could not evaluate.

---

## 5. Verification

| Check | Result |
|---|---|
| `npx vitest run api/cron/agent-evaluate api/_utils/agentGuardrails` | **23 files passed, 303 passed / 2 skipped** |
| Failing-file set vs. gate | **unchanged — empty** |
| `npx eslint` on the 4 touched files | 3 errors, **all pre-existing** in `agent-evaluate.js` (`getPresetAdjustedStrategies`, two `_e`). New test file lints clean. |
| Repo-level `executeSwapServer` call-site census | **passes with its allowlist untouched** — the mock is assigned by reference (`executeSwapServerMock`). |
| BUILD_RULES §2 review threshold | **not reached** — 4 files + this report. `vite build` not required and not run. |

Linux is the suite of record; no Windows run was performed.

---

## 6. Founder-visible decisions

**6.1 `holdKind` is added by BOTH T2 and T3 — deliberately, and identically.** Each task is its own branch cut from `main`, and the prompt's common rules bind every task: "fallback HOLDs write `holdKind: 'default_failure'` … otherwise add the single field and say so." No kind field existed on `main`, so each branch that produces a fallback HOLD must add it to stand alone.

The two additions are written to be **textually identical** at all three sites — the declaration beside `haikuFailure`, the last position in the evaluation literal, and the `FAIL_CLOSED_ENTRY_KEYS` harness constant — so merging both yields a conflict that resolves to "take either side", not a semantic merge. **Flagged for Flash's blind review**: confirm the resolution keeps one copy of each, and that T3's extra `holdKind = 'default_failure'` on its `invalid_tool_result` branch survives.

**6.2 A guardrail fault is recorded even when it changed nothing.** If the model chose HOLD and the evaluator threw, the record still carries `guardrail_error` (with `holdKind: null`, `downgraded: false`). The alternative — recording nothing because the outcome was unaffected — would hide a recurring guardrail fault for exactly as long as the model happened to be holding.

**6.3 `consecutiveEvalFailures` unchanged.** See §2. This is the one place where "the tick degraded" and "the transport degraded" now differ, and the counter follows the transport. Named here so the exit-dials arc does not rediscover it as a surprise.

---

## 7. `git diff --stat`

```
 api/_utils/__fixtures__/tickStampsHarness.js              |  14 +-
 api/cron/agent-evaluate.js                                |  53 +++++-
 api/cron/agent-evaluate.guardrailErrorFailClosed.test.js  | 218 ++++++++++++++++
 api/cron/agent-evaluate.tickStamps.flagOff.test.js        |   8 +-
 docs/audits/…_T2_guardrail-error-fail-closed.md           | (this report)
```

Only the fix, its tests, the two pin reconciliations it forces, and this report.

**STOP.** T2 complete. Next: T1 `fix/eval-tick-coherence`.
