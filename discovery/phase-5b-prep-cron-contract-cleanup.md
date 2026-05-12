# Phase 5B-Prep — Cron Contract Cleanup (Read-Only Discovery)

**Branch:** `claude/cleanup-cron-contracts-JWf3u` (cut fresh from `main` at `dab13aa`)
**Scope:** Audit only. No code changes. Investigates F3.1, F3.3, F3.4, F2.1 from the Phase 5A pre-merge audit (`discovery/phase-5a-pre-merge-audit.md`).
**Goal:** Surface cron contracts before Phase 5B (`buildIntradayLine`) and Phase 5C (snapshot rendering) build on them.

---

## Q1 — Sentinel-Zero Usage (F3.1)

### 1.1 — Where the cron writes `technicalScore` / `atrPercent`

**Portfolio briefs** (`api/cron/voice-layer-cache.js`):

| Line | Code | Behavior |
|------|------|----------|
| `:120` | `const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? 0;` | `0` fallback collapses three cases: missing-ranking, missing-techScore, and legitimate-zero |
| `:171` | `const atrPercentile = ranking?.atrPercentile ?? 0;` | `0` fallback collapses missing-ranking and lowest-decile |
| `:182,190` | `technicalScore, atrPercent: Math.round(atrPercentile * 100) / 100` | Both fields written; `atrPercent` rounds to 2dp; `0 * 100 / 100 = 0`, so missing → `0` |

**Bench briefs** (same file — *different convention*):

| Line | Code | Behavior |
|------|------|----------|
| `:287` | `const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? null;` | `null` for missing |
| `:290` | `const atrPercentileRaw = ranking?.atrPercentile;` | Raw value, no fallback |
| `:369-371` | `atrPercent: typeof atrPercentileRaw === 'number' ? Math.round(atrPercentileRaw * 100) / 100 : null` | `null` for missing |

**The two builders disagree on the contract.** Portfolio briefs use `0` as the missing sentinel; bench briefs use `null`. This is a latent inconsistency.

### Is `0` ever a genuine value?

Yes, for both fields:

- **`technicalScore`** is computed in `api/_utils/indexIntelligence.js:363,379`:
  ```js
  const technicalScore = rsVsSpyScore + sectorRSScore + smaScore + macdScore
                       + highProximity + volumeConfirmation + rsiContext;
  return { technicalScore: Math.min(100, technicalScore), ... }
  ```
  All seven factor sub-scores have minimum `0` (`rsiContext` explicitly assigns `0` at `:358` for `rsi < 30 && rsTrend === 'falling'`). Therefore a stock with a broken trend, oversold-with-falling-RSI, etc. can legitimately score `0`. Rare in practice, but the value is real.

- **`atrPercentile`** is computed in `api/cron/compute-index-intelligence.js:700-703`:
  ```js
  atrPercentileMap[item.sym] = atrValues.length > 1
    ? idx / (atrValues.length - 1)   // ← idx=0 gives 0
    : 0.5;
  ```
  The lowest-ATR stock in the universe gets `idx=0` → `atrPercentile=0`. This is then mirrored to the ranking doc at `:781` (`atrPercentile: Math.round(atrPercentile * 100) / 100`). So `0` is a real, meaningful value (rock-bottom volatility).

### 1.2 — Downstream consumers

**Voice layer renderers** (`api/_utils/voiceLayerPrompt.js`):
| Line | Predicate | Behavior on `0` |
|------|-----------|-----------------|
| `:978` | `if (brief.technicalScore != null && brief.technicalScore !== 0)` | Omits `Score N (rank ...)` segment |
| `:999` | `if (brief.atrPercent != null && brief.atrPercent !== 0)` | Omits `ATR N.N%` segment |

Both `0` and `null` are treated identically. A legitimately zero score/ATR is silently swallowed.

**Cron logic** (`api/cron/voice-layer-cache.js`) — uses these fields for scoutAlert filtering:
| Line | Code | Comment |
|------|------|---------|
| `:402,406` | `const technicalScore = ranking?.technicalScore ?? techScore?.technicalScore ?? 0;` then `if (rsPercentile >= 85 && technicalScore >= 75)` | `0` filtered out anyway by `>= 75` — false negative for missing data is benign here |
| `:422` | `Technical score ${technicalScore}.` | A `0` here would print "Technical score 0." which is misleading if the underlying ranking was missing |
| `:433` | `ATR percentile ${Math.round((ranking.atrPercentile \|\| 0) * 100)}%.` | Uses `\|\|` (falsy collapse) so even `null` → `0%`, AND legitimate `0` → `0%` |

**Haiku/eval prompts:** `api/_utils/agentEvalPromptAssembly.js:1039-1041` reads `tech?.atrPercent` (the **raw `atrPercent` from `stockTechnicalScores`** — different field, range ~0.5%–5%, written at `compute-index-intelligence.js:554` as `atr?.percent ?? null`). This is a *separate field* from the briefs' `atrPercent` (percentile 0-1). It already uses `!= null` and is unaffected.

**Snapshot builder:** `api/_utils/buildTechnicalSnapshot.js:62,107` — `atrPercent: tech.atrPercent ?? null`, `technicalScore: ranking.technicalScore ?? null`. Both use `null` (correct).

**Tests:**
- `voiceLayerPrompt.test.js:899-911` — `'skips the ATR segment when atrPercent is missing or zero'` asserts `atrPercent: 0` produces no `ATR` segment. **Locks the current sentinel-collapsing behavior in tests.**
- `voice-layer-cache.test.js:75-126` — bench-brief tests assert `null` for missing (consistent with bench-brief writer).
- `voice-layer-cache.test.js:530-535` — portfolio brief regression guard asserts `briefs[0].technicalScore === 75` for a populated case; no test exercises the `?? 0` fallback path explicitly.

### 1.3 — What needs updating if cron writes `null`

| File | Line | Change |
|------|------|--------|
| `api/cron/voice-layer-cache.js` | `:120` | `?? 0` → `?? null` (portfolio brief technicalScore) |
| `api/cron/voice-layer-cache.js` | `:171,182,190` | Stop coercing missing `atrPercentile` to `0`; preserve `null` through to `atrPercent` (mirror bench-brief logic) |
| `api/cron/voice-layer-cache.js` | `:402,422` | scoutAlert filtering — switch to `null`-safe branch or document `0` is sentinel for `scoutAlerts` |
| `api/cron/voice-layer-cache.js` | `:433` | Replace `\|\| 0` with `!= null ? ... : 'N/A'` to avoid lying with `0%` |
| `api/_utils/voiceLayerPrompt.js` | `:978,999` | Drop the `&& !== 0` clause. Strict `!= null` suffices. |
| `api/_utils/voiceLayerPrompt.test.js` | `:899-911` | Invert the test: `atrPercent: 0` SHOULD render `"ATR 0%"`; `atrPercent: null` SHOULD omit |
| `api/cron/voice-layer-cache.test.js` | (new tests) | Add explicit null-propagation tests for portfolio briefs |

### 1.4 — Recommended approach

**Option A — Cron writes explicit `null`; renderers check `!= null`.** *(Recommended)*

Rationale:
- Bench-brief writer is already on this contract (`:287,369-371`). Aligning the portfolio path removes the latent inconsistency.
- `buildTechnicalSnapshot.js` (which feeds Phase 4 snapshots and will feed Phase 5C rendering) is already on this contract. Aligning the voice-layer source removes a translation layer.
- Distinguishes "no data this cycle" from "real bottom-decile" — both are decision-relevant for the agent.
- Cheap one-line cron change; renderer simplification (drop `!== 0` guards).

Options B and C considered and rejected:

- **Option B — Keep `0` as sentinel; document explicitly.** Cheaper today (one comment block, two test additions) but locks in an inconsistency with the bench-brief writer, the snapshot builder, and the downstream consumer's natural null-check idiom. Net: codifies tech debt.
- **Option C — Separate `scoreAvailable` flag.** Over-engineered for a single sentinel collision. Adds two fields where one nullable field suffices. Doesn't compose with `buildTechnicalSnapshot`'s existing convention.

---

## Q2 — Boolean Flag Contracts (F3.3)

### 2.1 — Boolean fields written by the cron

| Field | Source | Writer | Type produced |
|-------|--------|--------|---------------|
| `factors.aboveSMA200` | `indexIntelligence.js:288` | `technicals.sma200 !== null && currentPrice > technicals.sma200` | Strict boolean |
| `factors.aboveSMA50` | `indexIntelligence.js:289` | Same idiom | Strict boolean |
| `factors.aboveSMA20` | `indexIntelligence.js:290` | Same idiom | Strict boolean |
| `factors.macdAboveSignal` | `indexIntelligence.js:400` | `macd ? macd.macd > macd.signal : null` | Strict boolean or `null` |
| `factors.macdFreshBullishCross` | `indexIntelligence.js:401` | `macd?.freshBullishCross ?? false` | Strict boolean |
| `factors.macdFreshBearishCross` | `indexIntelligence.js:402` | `macd?.freshBearishCross ?? false` | Strict boolean |
| `nr7Flag` (stockTechnicalScores) | `compute-index-intelligence.js:556` | `nr7Result?.nr7 ?? false` | Strict boolean |
| `nr7Flag` (stockRankings) | `compute-index-intelligence.js:784` | `tech.nr7Flag ?? false` | Strict boolean |
| `cooldownActive` (bench brief) | `voice-layer-cache.js:350` | `cooldownUntil ? new Date(cooldownUntil) > now : false` | Strict boolean |

`divergence` is *not* boolean — it's the string union `'bullish' | 'bearish' | 'none' | null` (`analyticalPrimitives.js:216-255`, mirrored at `compute-index-intelligence.js:538`). The renderer correctly uses `=== 'bullish'` / `=== 'bearish'` string identity (`voiceLayerPrompt.js:1067-1068`).

### 2.2 — Verification

- **Source produces strict booleans:** Every upstream produces a literal `true`/`false` (via `Array.every`, `>`, `>=`, or literal assignment). The `?? false` fallback at the writer only triggers for `undefined`/`null` upstream (e.g., when `macd` is `null` because there's not enough history).
- **Firestore preserves the boolean type:** `firebaseAdmin.js` does no middleware coercion. The `firebase-admin` SDK preserves JavaScript primitives — a boolean written stays boolean on read. Confirmed by absence of any coercion in `voice-layer-cache.js` between Firestore read and brief object construction.
- **Phase 5A strict checks (`=== true`) work correctly:** Given the above, `brief.nr7Flag === true` will fire iff the cron computed a true NR7. There is no current path where a truthy non-boolean reaches the renderer.

### 2.2a — Caveat (not currently exercised)

`voice-layer-cache.js` **does not propagate** `nr7Flag`, `macdFreshBullishCross`, `macdFreshBearishCross`, `divergence`, or `lastCandlePattern` into the brief object literal (`:177-191` for portfolio; `:354-372` for bench). Therefore `buildSignalsLine` currently returns `null` for *every brief* in production — the helper is dormant. The Phase 5A audit's F3.3 concern is forward-looking: once the cron starts propagating these fields, the strict-`=== true` check is correct *as long as the upstream invariants hold*.

The Workstream that wires these flags into briefs (next phase) needs to write either:
```js
nr7Flag: ranking?.nr7Flag ?? false,                    // or `?? null` — see 2.3
macdFreshBullishCross: techScore?.factors?.macdFreshBullishCross ?? false,
macdFreshBearishCross: techScore?.factors?.macdFreshBearishCross ?? false,
divergence: ranking?.momentum?.divergence ?? null,
```

### 2.3 — Recommendation

**Lock the contract on the cron writer side; keep renderer strict.**

- Cron writes literal boolean (or `null`). No truthy non-booleans.
- Renderer uses `=== true` strict identity (as today).
- Add a contract comment above `buildSignalsLine` documenting the strict-boolean assumption.
- For symmetry with the rest of the brief, prefer `?? false` (matches `factors.macdFreshBullishCross` writer) over `?? null` for the *flag* fields — the rendering predicate is `=== true`, so `false` and `null` behave identically in the renderer, but `false` matches the upstream Firestore shape.

Do **not** widen renderer to `Boolean(brief.nr7Flag)` — that would mask a future cron bug (e.g., serializing `1` as a "thinking-about-it" sentinel) instead of surfacing it.

---

## Q3 — `lastCandlePattern` Naming (F3.4)

### 3.1 — Source of truth

**Computed in** `api/_utils/analyticalPrimitives.js:280-348` (`detectCandlePattern`).

**Written by** `api/cron/compute-index-intelligence.js:546`:
```js
const recentAction = {
  lastCandlePattern: detectCandlePattern(opens, highs, lows, closes, volumes, vp?.avgVolume ?? null),
};
```

Then mirrored to the ranking doc at `:801` as `recentAction: tech.recentAction ?? null`.

**The complete set of values:**
```
'bullish_engulfing'   ← compound, snake_case
'bearish_engulfing'   ← compound, snake_case
'hammer'              ← single word
'shooting_star'       ← compound, snake_case
'doji'                ← single word
null                  ← no pattern / suspicious candle / insufficient data
```

Five string literals, three of which are compound snake_case. JSDoc return type at `:295` declares the union exactly.

### 3.2 — Naming convention

**snake_case, machine-stable.** The values are designed to be programmatic identifiers (stable across versions, suitable for indexing / comparison) — they were chosen to mirror `src/services/confluenceDetection.js` per the comment at `:287`.

### 3.3 — Renderer behavior

Two renderers consume the field:

1. **`voiceLayerPrompt.js:1072-1074`** (Phase 5A — dormant; field not yet propagated):
   ```js
   if (typeof brief.lastCandlePattern === 'string' && brief.lastCandlePattern.trim()) {
     flags.push(`Recent candle: ${brief.lastCandlePattern.trim()}.`);
   }
   ```
   Would render `Signals: Recent candle: bullish_engulfing.` — snake_case bleeds into Gemma's prompt.

2. **`agentEvalPromptAssembly.js:1107-1111`** (live in production — used by eval cron):
   ```js
   function renderBenchRecentActionLine(ranking) {
     const pattern = ranking?.recentAction?.lastCandlePattern;
     if (!pattern) return null;
     return `Recent action: ${pattern}`;
   }
   ```
   Currently renders `Recent action: shooting_star` to the Haiku eval prompt. **Same issue, already shipped.**

### 3.3 — Normalization options

**Option A — Cron writes human-readable.** Change `detectCandlePattern` return values to `'bullish engulfing'` / `'shooting star'` / etc.
- *Pro:* Single point of normalization. Renderers stay dumb.
- *Con:* Breaks any existing snake_case consumer/test. Lower stability — strings now contain a presentation choice.
- *Touch:* `analyticalPrimitives.js`, plus tests at `compute-index-intelligence.test.js:708,717,723,729,735` and `buildTechnicalSnapshot.test.js:20,127,199`.

**Option B — Renderer normalizes (replace `_` with space).** Apply `pattern.replace(/_/g, ' ')` in both renderers.
- *Pro:* Cheap, two-line change. Keeps machine-stable storage. No upstream test breakage.
- *Con:* Duplicates the normalization logic across two renderers (drift risk). Capitalization remains undecided (`"bullish engulfing"` vs `"Bullish engulfing"`).

**Option C — Hybrid: stable key + display-name map.** Keep snake_case in storage; add a small `PATTERN_DISPLAY_NAMES` lookup in a shared util (e.g., `analyticalPrimitives.js` or a new `candlePatterns.js`).
  ```js
  export const PATTERN_DISPLAY_NAMES = {
    bullish_engulfing: 'bullish engulfing',
    bearish_engulfing: 'bearish engulfing',
    hammer: 'hammer',
    shooting_star: 'shooting star',
    doji: 'doji',
  };
  ```
- *Pro:* Single source of truth. Both renderers import. Survives future patterns (e.g., `doji_dragonfly`, `morning_star`). Doesn't conflate storage with presentation.
- *Con:* One extra file/export. Renderers must import the map. Tests for the map.

**Recommendation: Option C.** It's only marginally more code than Option B but composes correctly with the suspicious-candle filter additions you'll likely make in 5C / future work (more pattern names = more snake_case literals — Option B would proliferate; Option C absorbs new entries into one place).

### 3.4 — Suspicious-candle filter (Q9 deferral note)

The suspicious-candle filter referenced in Phase 5A's Q9 is **already in place upstream** — `isSuspiciousCandle` (`analyticalPrimitives.js:269`) is called inside `detectCandlePattern` (`:312-325`) and returns `null` for split-day-artifact candles (≥25% body without ≥10× volume). The Q9 deferral concerned *additional renderer-side filtering* (e.g., suppressing the `Recent candle:` line when accompanied by low-confidence signals), which is **out of scope** for Phase 5B-prep. No changes needed here — note for the audit trail.

---

## Q4 — Helper Contract Documentation (F2.1)

### 4.1 — Current helper signatures

| Helper | Signature | Return | Caller idiom |
|--------|-----------|--------|--------------|
| `buildHeaderLine(brief)` (`:953`) | `(brief) => string` | Empty string `''` if `brief` falsy; else always ≥ `"SYMBOL"`. Never `null`. | Unconditional inline: `let entry = \`${buildHeaderLine(b)}\n…\`` |
| `buildLevelsLine(brief)` (`:1011`) | `(brief) => string \| null` | `null` if `brief` falsy or no segment qualifies; else `"Levels: …"` | Conditional: `if (levelsLine) entry += \`\n${levelsLine}\`` |
| `buildSignalsLine(brief)` (`:1059`) | `(brief) => string \| null` | `null` if `brief` falsy or no flag fires; else `"Signals: …"` | Conditional: `if (signalsLine) entry += \`\n${signalsLine}\`` |

**Defensive patterns:**
- Every helper begins with a `!brief` short-circuit (different sentinels: `''` vs `null` — see contract proposal below).
- Each segment is independently gated with a tight typeof / range / strict-equality predicate (e.g., `typeof brief.rsPercentile === 'number'`, `Math.abs(brief.distanceToSupportPct) <= 10`, `brief.nr7Flag === true`).
- Order within each line is fixed (Score → RS → ATR; Support → Resistance → 52wk; MACD → divergence → NR7 → candle) so output is stable.
- The em-dash separator in `buildHeaderLine` is omitted when `metricsParts` is empty (`:1003-1004`), avoiding an orphan `" — "` suffix.
- `buildPortfolioBriefsBlock` (`:1086-1122`) is the orchestrator: builds the header unconditionally, appends conditional lines, then appends Phase-4 sections (BaggerBomb / threshold / badges).

### 4.2 — Proposed contract comment

Insert this block above `buildHeaderLine` (before line `:947`):

```js
// ==================== PER-SYMBOL LINE HELPERS — CONTRACT ====================
//
// Three per-symbol line helpers exist for portfolio & bench briefs:
//
//   buildHeaderLine(brief)  → string         ALWAYS-EMIT
//   buildLevelsLine(brief)  → string | null  CONDITIONAL
//   buildSignalsLine(brief) → string | null  CONDITIONAL
//
// ALWAYS-EMIT helpers (return string):
//   - Caller inlines unconditionally: `entry = `${buildHeaderLine(b)}\n…``
//   - Defensive null brief → returns `''` (never throws, never null)
//   - At minimum returns the symbol token (`"NVDA"`); segments degrade
//     independently when their input fields are missing.
//
// CONDITIONAL helpers (return string | null):
//   - Caller branches: `const line = buildLevelsLine(b); if (line) entry += `\n${line}`;`
//   - Returns null when no segment predicate fires (Gemma sees no orphan stub).
//   - Each segment has its own predicate (typeof check + range gate).
//   - Order within a line is fixed (lock in tests).
//
// Brief input invariants (from voice-layer-cache.js):
//   - Boolean flags (nr7Flag, macdFresh*Cross) are LITERAL boolean or undefined.
//     Renderers use `=== true` strict identity; permissive coercion is NOT
//     used so that a future cron-side type drift surfaces, doesn't get masked.
//   - `divergence` is one of 'bullish' | 'bearish' | 'none' | null; renderers
//     use string === identity.
//   - `lastCandlePattern` is a snake_case key from analyticalPrimitives.js's
//     detectCandlePattern (or null). Renderer normalizes for display.
//   - Numeric metrics (technicalScore, atrPercent, rsPercentile) are null when
//     missing — never 0-as-sentinel. (Cf. Phase 5B-prep cron contract cleanup.)
//
// Adding a new line helper:
//   - If the line is always meaningful for every brief (e.g., a price banner),
//     pattern after buildHeaderLine: return string, never null.
//   - If the line is conditional on data availability or a predicate (e.g.,
//     "only when intraday VWAP is within ±2% of price"), pattern after
//     buildLevelsLine: return string | null, caller branches.
// =============================================================================
```

### 4.3 — Phase 5B's `buildIntradayLine`

**Should follow the CONDITIONAL pattern** (`string | null`).

Predicate proposal: emit only when `brief.intraday` is non-null AND has at least one numeric component (`vwap`, `currentPrice`, `vwapDeviation`, `sma20_5m`) — see `voice-layer-cache.js:236-246` for the upstream shape. Skip emission when intraday is `null` (no fetch this cycle), when `vwapDeviation` is null (crypto bench placeholders), or when all components are null (degraded brief).

Rough sketch (illustrative, not the implementation):
```js
export function buildIntradayLine(brief) {
  const i = brief?.intraday;
  if (!i || (i.vwap == null && i.currentPrice == null && i.sma20_5m == null)) return null;
  const segments = [];
  if (typeof i.vwapDeviation === 'number') {
    const sign = i.vwapDeviation > 0 ? '+' : '';
    segments.push(`VWAP ${sign}${i.vwapDeviation.toFixed(2)}%`);
  }
  if (typeof i.sma20_5m === 'number' && typeof i.currentPrice === 'number') {
    const dev = ((i.currentPrice - i.sma20_5m) / i.sma20_5m) * 100;
    const sign = dev > 0 ? '+' : '';
    segments.push(`5m SMA20 ${sign}${dev.toFixed(2)}%`);
  }
  if (segments.length === 0) return null;
  return `Intraday: ${segments.join(', ')}.`;
}
```

(Exact predicate, format, and threshold gates are Phase 5B's call. This is shape-only.)

---

## Q5 — Test Coverage Impact

### 5.1 — Tests affected by each cleanup

**If cron switches sentinel-0 → null for `technicalScore` / `atrPercent`:**
- `api/_utils/voiceLayerPrompt.test.js:899-911` — `'skips the ATR segment when atrPercent is missing or zero'`. Behavior changes: `atrPercent: 0` SHOULD render `"ATR 0%"`. Update assertion or split into two tests.
- `api/cron/voice-layer-cache.test.js` — no tests currently exercise the `?? 0` fallback for portfolio briefs (i.e., `priceMap` populated but `rankingsMap` empty). The change is in code that isn't asserted today, so the cron tests don't break — but a new regression test is needed (see 5.2).

**If renderer strict-`=== true` check is documented (no behavior change):**
- No tests break. The contract comment lands above existing helpers with passing tests.

**If `lastCandlePattern` is normalized at the renderer (Option C: shared display-name map):**
- `api/_utils/voiceLayerPrompt.test.js:1062-1075` — current assertions use already-clean strings (`'hammer'`, `'engulfing'`). Add new cases for `'bullish_engulfing'` → `"Recent candle: bullish engulfing."`.
- `api/_utils/agentEvalPromptAssembly.test.js:238,268,296` — same: current cases use `'hammer'` / `'doji'` (no compound names). Add compound-pattern cases. Also: `renderBenchRecentActionLine` itself is not directly unit-tested today; covered transitively through the bench-brief rendering tests around `:238-300`.
- New unit tests for `PATTERN_DISPLAY_NAMES` map (Option C only).

**If `lastCandlePattern` is normalized at the cron (Option A — not recommended):**
- `api/cron/compute-index-intelligence.test.js:708,717,723,729,735` — all five detectCandlePattern test cases assert against snake_case literals. All change.
- `api/_utils/buildTechnicalSnapshot.test.js:20,127,199` — fixtures use `'doji'` (single word, no change) but the contract assertion at `:127` would still need an update if Option A redefined the union.

### 5.2 — Proposed new tests

**Cron contract tests** (`api/cron/voice-layer-cache.test.js`):
1. *Portfolio brief preserves null technicalScore when both ranking and techScore are missing.* (today: returns 0 — change captures the new contract)
2. *Portfolio brief preserves null atrPercent when ranking is missing.*
3. *Portfolio brief preserves legitimate `technicalScore: 0` from rankings.* (regression guard: cron passes through the real value)
4. *Portfolio brief preserves legitimate `atrPercentile: 0` (rounded to atrPercent: 0).* (same)
5. *Bench / portfolio convention parity:* the same input shape produces the same null-vs-value outputs in both `buildPortfolioBriefs` and `buildBenchBriefs`.

**Renderer tests** (`api/_utils/voiceLayerPrompt.test.js`):
6. *`buildHeaderLine` renders `"Score 0"` when `technicalScore: 0`.*
7. *`buildHeaderLine` renders `"ATR 0%"` when `atrPercent: 0`.*
8. *`buildHeaderLine` omits Score segment only when `technicalScore: null`.*
9. *`buildSignalsLine` renders `"Recent candle: bullish engulfing."` for `lastCandlePattern: 'bullish_engulfing'`.* (Option B or C)
10. *`buildSignalsLine` strict-boolean guard:* `nr7Flag: 1` (number) does NOT render NR7 line — locks the strict-`=== true` contract documented in the comment.

**Pattern-map test** (Option C only — `api/_utils/analyticalPrimitives.test.js` or a new `candlePatterns.test.js`):
11. *`PATTERN_DISPLAY_NAMES` covers every value returned by `detectCandlePattern`.* Iterate the documented union; every key resolves to a non-empty display string.

---

## Synthesis

**Phase 5B-prep should make the following changes:**

1. **F3.1 — Sentinel-zero cleanup (Option A).** Cron writes explicit `null` for missing `technicalScore` and `atrPercent`; renderers drop the `&& !== 0` guard. Aligns portfolio writer with bench writer, with `buildTechnicalSnapshot`, and with the existing downstream null-check idiom. Files: `voice-layer-cache.js` (4 lines), `voiceLayerPrompt.js` (2 lines), `voiceLayerPrompt.test.js` (1 test inverted), `voice-layer-cache.test.js` (5 new tests per §5.2).

2. **F3.3 — Boolean contract documentation.** Add the contract comment from §4.2 above `buildHeaderLine` in `voiceLayerPrompt.js`. Lock in strict-`=== true` semantics for `nr7Flag` / `macdFresh*Cross`. No code behavior change; add 1 regression test per §5.2 #10. Note: the field-propagation work (cron writing these flags into briefs) is **deferred to the next workstream** — F3.3 here is contract-only.

3. **F3.4 — `lastCandlePattern` display normalization (Option C).** Add `PATTERN_DISPLAY_NAMES` map alongside `detectCandlePattern` in `analyticalPrimitives.js`; update both renderers (`voiceLayerPrompt.js`, `agentEvalPromptAssembly.js`) to lookup-then-render. Files: `analyticalPrimitives.js` (~10 LOC), `voiceLayerPrompt.js` (3 lines), `agentEvalPromptAssembly.js` (3 lines), plus tests per §5.2 #9 & #11.

4. **F2.1 — Helper contract comment.** Insert the contract block from §4.2. No behavior change.

**Recommended option for each:**
- F3.1: **Option A** (cron writes null).
- F3.3: **Strict-bool renderer; document via contract comment** (no widening to `Boolean()`).
- F3.4: **Option C** (display-name map). Option B (renderer-side `replace`) is acceptable if avoiding the new file is preferred; the report's vote is Option C for forward-compat.
- F2.1: contract comment as drafted in §4.2.

**Estimated implementation scope:**
- Files modified: `api/cron/voice-layer-cache.js`, `api/_utils/voiceLayerPrompt.js`, `api/_utils/analyticalPrimitives.js`, `api/_utils/agentEvalPromptAssembly.js`.
- Tests modified: `api/_utils/voiceLayerPrompt.test.js`, `api/cron/voice-layer-cache.test.js`. Possibly `api/_utils/agentEvalPromptAssembly.test.js` for new pattern-display assertions.
- Tests added: ~9 new tests across renderer + cron + (optional) pattern-map.
- Net LOC change: roughly +60 LOC code, +120 LOC tests, before subtracting the (small) renderer simplifications.

**Open design questions to discuss:**
- (i) **F3.1 scoutAlert paths in `voice-layer-cache.js:402-433`** also use `?? 0` and `|| 0` for `technicalScore` / `atrPercentile`. Do those switch to `null`-aware too, or stay as-is since they're informational strings (the user-visible text "ATR percentile 0%" is harmless when degraded)? Recommend switching for symmetry, but it's debatable.
- (ii) **F3.4 capitalization.** Display value `"bullish engulfing"` or `"Bullish engulfing"`? `voiceLayerPrompt.js` would emit `"Signals: Recent candle: bullish engulfing."` (lowercase makes the sentence flow); `agentEvalPromptAssembly.js` emits `"Recent action: bullish engulfing"` (no sentence boundary, capitalize?). Lean toward lowercase everywhere for consistency.
- (iii) **F2.1 contract comment scope.** Should the comment also document the *brief input invariants* (`nr7Flag is boolean`, `divergence is string union`, etc.) or stay focused on return-type contract? The draft in §4.2 includes a short invariants block; trim if too long.
- (iv) **F3.3 cron-side propagation.** The brief object literal in `voice-layer-cache.js` currently does not include `nr7Flag` / `macdFresh*Cross` / `divergence` / `lastCandlePattern` / `nearestSupport`/`Resistance`/`distanceToSupport/ResistancePct` / `distTo52wkHigh` / `sector` / `sectorTechnicalTotal`. Helpers `buildLevelsLine` and `buildSignalsLine` are therefore dormant in production. **Should propagation be included in this same workstream**, or treated as a separate follow-up? If included, scope grows by ~20 LOC in `voice-layer-cache.js` and several test cases. Recommend: **defer to a follow-up** so this cleanup stays narrowly focused on contract-locking before any field-wiring lands.

**Findings to defer (not in 5B-prep):**
- **Renderer field-propagation in `voice-layer-cache.js`** (Q2 §2.2a above) — out of scope. Surface as a separate workstream item.
- **Suspicious-candle renderer-side filter** (Q3 §3.4) — already filtered upstream by `isSuspiciousCandle`; Q9 deferral concerns additional render-layer filtering, not in 5B-prep scope.
- **F1.x / F4.x findings from the Phase 5A audit** (DATA_CONFIDENCE_RULE wordsmithing) — separate workstream covering prompt-level changes, not cron contract.

*End of report.*
