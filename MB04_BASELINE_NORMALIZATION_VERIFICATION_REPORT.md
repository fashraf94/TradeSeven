# mb-04 Baseline Normalization Verification Report

| | |
|---|---|
| **Status** | ✅ Complete — **Outcome: C (qualified — multi-day modes only)** |
| **Date** | 2026-05-29 |
| **Branch** | `claude/mb04-baseline-normalization-verification` |
| **Author** | Claude Code (investigation on behalf of Flash / FantasyTrades) |
| **Spec** | `EXISTING_RULE_VOLUME_REGIME_EXTENSIONS.md` V1.1 §7 |
| **Type** | Discovery / investigation — **no production code changed** |

> **Data-access constraint (carry-forward from bench-staleness task).** This ran in an ephemeral sandbox with **no Firebase credentials**. Code/structure questions are answered fully from code + tests with file:line anchors. The behavioral test uses a throwaway harness (`/tmp/mb04_baseline_harness.mjs`, **not committed**) that imports **real production code unmodified** (`evaluateTriggers` from `api/_utils/agentTriggerGate.js`) and runs it on **synthetic** swap-evaluation moments. Fields that require live data to characterize precisely are flagged as **hand-offs** in §5.

---

## Executive summary

| # | Finding | Anchor |
|---|---|---|
| 1 | **mb-04 has no deterministic enforcement.** It is a rule *definition* whose text is injected into the LLM prompt as a **soft** "STRATEGY PREFERENCE"; Haiku enforces it by reasoning. `grep mb-04 api/` and `grep hurdle api/` both return **zero** hits. | `forgeKnowledgeBase.js:615-638`; `agentEvalPromptAssembly.js:283-323` |
| 2 | **The suspected baseline mismatch EXISTS.** Active performance is **entry-relative** ("Gain%"); bench performance is **previous-close-relative** ("Daily%"). (Refinement: bench is *prev-close*-relative, not literally market-open — baselines still differ.) | `agent-evaluate.js:293`; `agentEvalPromptAssembly.js:930` → `marketDataCache.js:593` |
| 3 | **One deterministic surface mixes the same baselines** — the wake-up gate's `bench_outperformance` trigger: active-weak check is entry-relative, bench check is prev-close-relative, threshold **hardcoded 0.5**. | `agentTriggerGate.js:90-113` |
| 4 | **Behavioral impact is battle-mode-dependent.** Real-trigger-gate decision-change (among swap-on-the-table moments): **~15% for same-day entries** (1d/fullday) but **24–35% for multi-day holds** (3d/5d, day 2+). Robust to volatility assumption. | `/tmp/mb04_baseline_harness.mjs` (Part A) |
| 5 | **Outcome: C (qualified — multi-day modes only).** Same-day = Outcome B (<20%). Multi-day = Outcome C (≥20% **and** prompt CSVs feed the mismatched numbers to Haiku un-normalized). | §4 |
| 6 | **Orthogonal (elevated):** the hardcoded `0.5` in the wake-up gate **misapplies user trait strength** (configured 0.3/0.7 ignored), compounding with the baseline mismatch in the same code block. Natural to fix alongside normalization. | `agentTriggerGate.js:106`; `traitLibrary.js:338/343/348` |

**Bottom line for the launch-blocker chain:** Stream D's pre-launch sequence **cannot proceed cleanly as-is** on multi-day battles. It needs **either** a baseline normalization **or** a launch-time restriction of volume modulation to same-day modes (see §4 / §4.1).

---

## §1 — mb-04 implementation location & baseline math

### 1.1 mb-04 is a prompt-delegated soft rule, not a code gate

The rule is **defined** in the knowledge base and its templated text is **interpolated into the agent prompt**; the actual swap decision is made by the LLM (Haiku).

- **Rule definition** — `src/data/forgeKnowledgeBase.js:615-638`:
  > *"Only swap if the bench stock's intraday performance exceeds the active stock's by at least {atr} ATR"* — `atr` default **0.5**, range **0.25–1.0** (`:629`). Category `mid_battle` ("Swap timing, hurdle rates…" `:10`).
- **Trait strengths** — `src/data/traitLibrary.js:334` (`ruleIds: ['mb-09','mb-04','mb-07']`) → mb-04 atr **0.3 / 0.5 / 0.7** for subtle/moderate/dominant (`:338 / :343 / :348`).
- **How it reaches the decision-maker** — `api/_utils/agentEvalPromptAssembly.js:283-323`. Only `risk` and `allocation` rules become hard **CONSTRAINTS** (`:285-294`); everything else — including mb-04 (`mid_battle`) — becomes a **STRATEGY PREFERENCE** (`:296-300`) that Haiku "should follow when possible but may deviate with explanation."
- **No deterministic enforcement anywhere in the backend:**
  - `grep -rin "mb-04|mb04" api/` → **0 hits**
  - `grep -rin "hurdle" api/` → **0 hits** ("hurdle" exists only in `src/data/` definitions/rationale)
  - Validation (`api/_utils/agentSwapExecution.js`) sets `baseATR` on swapped assets (`:150, :192, :217`) but performs **no** bench-vs-active hurdle.
  - Guardrails (`api/_utils/agentGuardrails.js`) use `baseATR` only for trailing-stop implied-peak math (`:383-386`) — **no** hurdle.

> **Reframing vs. the V1.1 spec.** The spec's premise — that mb-04 is a deterministic `(bench_perf − active_perf) >= atr_threshold` check — does **not** match the code. mb-04 is a soft prompt preference. This is the Phase-0 discovery that reshaped the investigation; the mismatch question therefore applies to (a) the data presented to Haiku and (b) a separate deterministic trigger heuristic, not to a swap-hurdle function.

### 1.2 The two baselines (the heart of the matter)

| | Active stock | Bench stock |
|---|---|---|
| Metric shown to Haiku | **"Gain%"** | **"Daily%"** |
| Baseline (denominator) | **Entry price** (`swapPrice` or `startingPrices[symbol]`) | **Previous close** (EODHD `change_p`) |
| Formula | `((current − entry) / entry) * 100` | `((current − prevClose) / prevClose) * 100` |
| Code | `api/cron/agent-evaluate.js:283, :293` | `agentEvalPromptAssembly.js:930` → `marketDataCache.js:593` |
| Rendered in | ACTIVE CSV `agentEvalPromptAssembly.js:899-916` (Gain% col) | BENCH CSV `agentEvalPromptAssembly.js:918-946` (Daily% col) |
| Time meaning | **Cumulative since entry** (multi-day if entered earlier) | **Today only** |

### 1.3 The one deterministic surface that mixes them

`api/_utils/agentTriggerGate.js` — *"Determines whether to wake Haiku for a mid-battle evaluation"* (`:2`). The `bench_outperformance` trigger (`:90-113`):

```js
const hasWeakActive = assetScores.some(s => s.priceChange <= 0);   // active: ENTRY-relative  (:92)
if (hasWeakActive) {
  for (const benchAsset of benchAssets) {
    const dailyChangePct = benchPrice.changePercent || 0;          // bench: PREV-CLOSE-relative (:102)
    const benchATR = benchAsset.baseATR || 2.5;
    const benchATRMult = dailyChangePct / benchATR;                // (:104)
    if (benchATRMult >= 0.5) { /* fire */ }                        // HARDCODED 0.5 (:106)
  }
}
```

This is **not** `(bench − active) >= ATR`: it is two independent checks (active *sign* entry-relative; bench *magnitude* prev-close-relative), and it gates **whether Haiku is woken**, not whether a swap executes. The `0.5` is hardcoded and ignores the user's `atr` param (see §5.1).

---

## §2 — Mismatch verification

**Verdict: the mismatch EXISTS — definitively.** Active = entry-relative; bench = prev-close-relative. Confirmed at the anchors in §1.2 and §1.3. This rules out **Outcome A**.

The mismatch's magnitude is governed by **entry age**, which is **battle-mode dependent**:
- **Same-day entries** (1d / fullday battles started today): `entry ≈ today`, so **Gain% ≈ Daily%** — the mismatch barely bites.
- **Multi-day holds** (3d / 5d battles on day 2+): `entry` drifts from today's prev-close as days accumulate, so **Gain% (cumulative) ≠ Daily% (today)** — the mismatch can flip the sign of "is the active weak."

**Worked multi-day proof** (real harness scenario, 5-day battle on day 4):

```
active: entry=$98.98   prevClose=$100.00   current=$99.58
        Gain%(entry-rel)  = +0.60%   →  "up since entry"
        Daily%(prevclose) = −0.42%   →  "down today"
bench:  Daily% = +4.75%  (1.90x ATR, clears the 0.5x hurdle)

Production path (active read as Gain% +0.60% ≤ 0 ? NO ) → bench_outperformance does NOT fire
Normalized path (active read as Daily% −0.42% ≤ 0 ? YES) → bench_outperformance FIRES
→ Decision changes purely from the baseline choice. Apples-to-oranges, proven.
```

---

## §3 — Behavioral impact test

### 3.1 Method & harness construction

- **File:** `/tmp/mb04_baseline_harness.mjs` (throwaway; **not committed** — only this report commits).
- **Real code under test:** imports `evaluateTriggers` from `api/_utils/agentTriggerGate.js` **unmodified**. Its only dependency (`flattenBenchServer` from `agentScoring.js`) is pure (no Firebase), so the import runs standalone in a `.mjs` harness (ESM repo, `package.json` `"type":"module"`).
- **Synthetic construction:** each scenario = one active holding + one bench candidate. Active's *today* move and *since-entry* drift are drawn from normals; the since-entry drift std grows with entry age (random-walk approximation) to model battle modes. Bench's today move drawn from a normal. **20,000 scenarios per entry-age bucket**, seeded for reproducibility.
- **Two measurements:**
  - **Part A (PRIMARY — real production code):** run the real `evaluateTriggers` twice per scenario — once with the active's **entry-relative** `priceChange` (production), once with the **prev-close-relative** value (normalized) — and record whether the `bench_outperformance` trigger fires. *This is "what is actually happening every tick."*
  - **Part B (SUPPORTING — reconstructed hurdle):** the spec's assumed math `(bench − active) >= atr·ATR`, computed mismatched vs normalized, swept over the trait atr values {0.3, 0.5, 0.7}. *This is "what if mb-04 were deterministic."*
- **Assumptions (flagged §5):** `BASE_ATR = 2.5%`, `σ_daily = 2.0%`. Robustness checked across `σ ∈ {1.5, 2.0, 2.5}`.

> **What "decision-change rate" means here.** *Conditional* = flips among moments where a bench actually clears the hurdle (a swap is genuinely on the table) — the metric the 20% threshold is applied to. *Overall* = flips across all scenarios.

### 3.2 Part A results (PRIMARY) — real `evaluateTriggers`

| Battle mode | days since entry | prod fire | norm fire | overall change | **conditional change** |
|---|---|---|---|---|---|
| 1d / fullday (entered today) | 0 | 13.6% | 13.6% | 4.0% | **15.0%** |
| 3d battle, day 2 | 1 | 13.3% | 13.4% | 6.5% | **24.2%** |
| 3d / 5d, day 3 | 2 | 13.2% | 12.8% | 8.1% | **30.9%** |
| 5d, day 4 | 3 | 13.7% | 13.6% | 9.2% | **33.9%** |
| 5d, day 5 | 4 | 13.4% | 13.3% | 9.4% | **35.4%** |

**σ-sensitivity (conditional change rate):**

| σ_daily | d0 | d1 | d2 | d3 | d4 |
|---|---|---|---|---|---|
| 1.5 | 18.6% | 25.9% | 31.5% | 33.6% | 34.6% |
| 2.0 | 14.7% | 25.6% | 31.3% | 33.7% | 35.1% |
| 2.5 | 12.3% | 25.5% | 31.7% | 33.4% | 35.1% |

→ Day 0 stays **<20%** across all assumptions; day ≥1 stays **≥24%**. The mode-split conclusion is robust.

### 3.3 Part B results (SUPPORTING) — reconstructed hurdle

| Battle mode | days | atr=0.3 | atr=0.5 | atr=0.7 |
|---|---|---|---|---|
| 1d / fullday | 0 | 22.4% | 25.7% | 27.1% |
| 3d day 2 | 1 | 37.5% | 42.4% | 44.6% |
| 3d/5d day 3 | 2 | 46.0% | 49.2% | 53.6% |
| 5d day 4 | 3 | 50.4% | 53.7% | 57.9% |
| 5d day 5 | 4 | 51.8% | 56.5% | 61.6% |

(conditional change rate, among swap signals). Higher than Part A because the full hurdle uses the active's *magnitude*, not just its sign — i.e., if mb-04 were deterministic, the mismatch would matter **even more**.

### 3.4 Sample comparisons (pasted from harness)

**Part A (real trigger gate), 5d day-4:**
```
active: entry=$96.83  prevClose=$100.00  current=$98.30
        Gain%(entry-rel)=+1.52%   Daily%(prevclose-rel)=−1.70%
bench:  Daily%=+1.42% → 0.57x ATR (clears 0.5x)
PROD fires (active Gain +1.52% ≤0? false): false
NORM fires (active Daily −1.70% ≤0? true ): true   → DECISION CHANGED
```

**Part B (reconstructed hurdle, atr=0.5, hurdle=1.25 pts):**
```
B1: activeGain +1.83% | activeDaily −1.13% | bench +1.25%
    MISMATCHED (1.25 − 1.83  = −0.58 ≥ 1.25)? false
    NORMALIZED (1.25 −(−1.13)=  2.38 ≥ 1.25)? true    → DECISION CHANGED
B2: activeGain +2.06% | activeDaily +0.75% | bench +3.07%
    MISMATCHED (3.07 − 2.06  =  1.01 ≥ 1.25)? false
    NORMALIZED (3.07 − 0.75  =  2.31 ≥ 1.25)? true    → DECISION CHANGED
```

---

## §4 — Outcome determination

**Applying the 20% threshold honestly (not mechanically), reconciled with the LLM-delegated reframing:**

| Battle mode | Deterministic rate (Part A) | Prompt surface | **Outcome** |
|---|---|---|---|
| **1d / fullday** | **15%** (<20%; robust 12–19%) | mismatched but Gain%≈Daily% | **B** — mismatch exists but bounded |
| **3d / 5d (day 2+)** | **24–35%** (≥20%) | feeds mismatched Gain%/Daily% to Haiku **un-normalized** (`agentEvalPromptAssembly.js:899-946`), nothing instructs conversion | **C** — mismatch exists **and** materially affects what the decision is built on |

- **Outcome B condition** ("rate <20% OR LLM softness absorbs the gap") is satisfied for **same-day** modes by the rate alone.
- **Outcome C condition** ("rate ≥20% AND prompt CSVs present mismatched numbers un-normalized, so the LLM cannot be assumed to compensate") is satisfied for **multi-day** modes — both clauses hold.

### **Outcome: C (qualified — multi-day modes only).**

**Operational consequence (concrete, not left to the reader):**
Stream D's pre-launch sequence **cannot proceed cleanly as-is**. Tuning volume modifiers on top of a hurdle whose base inputs flip 24–35% of multi-day swap decisions would bake the baseline defect into the modulation tuning. **Before Stream D proceeds, exactly one of the following must happen:**
1. **Normalize the mb-04 baseline** (fixes all battle modes), **or**
2. **Restrict Stream D volume modulation to same-day (1d/fullday) battles at launch** (where the impact is Outcome B / <20%), deferring multi-day to post-launch.

**Live-product hand-off (no overclaiming on LLM behavior):** the deterministic numbers measure the **trigger/wake-up** surface (Part A, real code) and the **reconstructed** hurdle (Part B) — i.e., *what is surfaced to Haiku*. Haiku's *final* soft decision cannot be measured deterministically without an LLM harness (deliberately out of scope per the task). The **verified** finding is: *the baseline mismatch materially changes what multi-day swap decisions are built on.* The residual question — *does Haiku's final trade actually change?* — is the clearly-labeled live-data study in §5.2.

### §4.1 — Remediation option space (named, not evaluated — for the design session)

1. **Option 1 — Normalize the baseline (all modes).** Make the mb-04 comparison apples-to-apples by giving the active side its own **prev-close-relative intraday** change (the active stock already has a `changePercent` in `prices[symbol]`). Touch points: the wake-up gate's weak-active check (`agentTriggerGate.js:92`) and the ACTIVE CSV / prompt framing so mb-04 reads an intraday-comparable active number (`buildPortfolioCSV`, `agentEvalPromptAssembly.js:899-916`). Estimated **~30–50 lines**. Resolves every battle mode.
2. **Option 2 — Restrict Stream D to same-day modes at launch.** Ship volume modulation only for 1d/fullday battles (Outcome B); defer multi-day until the baseline fix lands post-launch. No mb-04 code change now; a scope/config decision inside Stream D.
3. **Option 3 — Combined.** Normalize the baseline **and** keep Stream D conservatively scoped at launch, decoupling the launch date from the normalization's regression risk.

*(These are on the table to give the now-required design conversation a concrete starting point. Evaluating/choosing among them is the design session's job, not this investigation's.)*

---

## §5 — Open questions / hand-offs / orthogonal findings

### 5.1 — (ELEVATED) Hardcoded `0.5` in the wake-up gate misapplies user trait strength

**This is structurally important, not a parenthetical.** `agentTriggerGate.js:106` hardcodes the bench-outperformance threshold at `0.5`. But the rule param is configurable **0.25–1.0**, and traits set it to **0.3 / 0.5 / 0.7** (`traitLibrary.js:338/343/348`). Therefore:

- A user on a **subtle** trait (0.3 — wants to swap *more* readily) and a user on a **dominant** trait (0.7 — wants *stronger* proof) get the **same** `0.5` gate. **Trait strength is silently ignored at the gate level.**
- This **compounds with the baseline mismatch** — both defects live in the *same* code block (`:90-113`): the gate uses the wrong threshold *and* mixes baselines.
- **Sequencing:** the natural place to fix this is **during the baseline-normalization work** (Option 1), because both changes touch the trigger gate. Doing them together avoids two separate passes over the same block.
- Per the investigation-only constraint this is **documented, not fixed** — but it should be folded into the same work package, not filed as a generic backlog item.

### 5.2 — Live-product behavior study (hand-off; needs Firebase)

To convert the deterministic finding into a live decision-change rate, a follow-up with live data should measure: (a) the distribution of (entry vs previous-close) gaps **by battle mode** in real `agentBattles` (confirms how often multi-day holds actually diverge), and (b) whether Haiku's executed swaps differ when the ACTIVE CSV is normalized. This weights the synthetic rates by real frequency and tests the soft-LLM compensation question directly.

### 5.3 — The whole "hurdle" family is prompt-delegated

mb-04 is not unique: mb-11 (final-hour hurdle reduction), mb-12 (hurdle time-decay), phase-decay, comeback, and hot-streak rules all manipulate "swap hurdle rate" **only in prompt text** (`forgeKnowledgeBase.js:800-843, :986-1000, :1062-1130`). If Stream D implements volume modulation **deterministically**, it must first decide *where the hurdle lives* (prompt vs new code). That decision determines which baseline surface matters and is a prerequisite for the §4.1 design conversation.

### 5.4 — ATR-unit ambiguity in the hurdle

The rule text says "by at least {atr} ATR" without specifying **whose** ATR (active's, bench's, or combined). The only deterministic surface (the trigger gate) uses the **bench** ATR; Part B followed that convention. The design session should pin this down before tuning modifiers on top of it.

### 5.5 — Synthetic-distribution caveat

`σ_daily = 2.0%` and `ATR = 2.5%` are modeling assumptions. The conclusion is robust across `σ ∈ {1.5, 2.0, 2.5}` (§3.2), but the **real** frequency weighting — especially the entry-vs-prev-close gap distribution per mode — needs Firestore to confirm (folded into §5.2).

---

## Verification anchors (index)

| Claim | Anchor |
|---|---|
| mb-04 definition, atr default/range | `src/data/forgeKnowledgeBase.js:615-638`, `:629` |
| Trait strengths 0.3/0.5/0.7 | `src/data/traitLibrary.js:334, :338, :343, :348` |
| Rule → soft prompt injection | `api/_utils/agentEvalPromptAssembly.js:283-323` (`:285-300`) |
| Active "Gain%" (entry-relative) | `api/cron/agent-evaluate.js:283, :293`; CSV `agentEvalPromptAssembly.js:899-916` |
| Bench "Daily%" (prev-close-relative) | `agentEvalPromptAssembly.js:930`; origin `api/_utils/marketDataCache.js:593` |
| Deterministic baseline-mixing trigger | `api/_utils/agentTriggerGate.js:90-113` (`:92, :102-104, :106`) |
| No deterministic enforcement | `grep mb-04 api/` = 0; `grep hurdle api/` = 0; `agentGuardrails.js:383-386`; `agentSwapExecution.js:150,192,217` |
| Import-safe pure helpers | `api/_utils/agentScoring.js:43-75` |
| Behavioral test | `/tmp/mb04_baseline_harness.mjs` (Part A real `evaluateTriggers`; Part B reconstructed hurdle) |
