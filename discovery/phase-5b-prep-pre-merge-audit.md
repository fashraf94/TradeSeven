# Phase 5B-Prep Pre-Merge Audit

**Branch:** `claude/cleanup-cron-contracts-JWf3u` (5 commits past `ce0178f`)
**Scope:** Read-only audit. No code changes. Verifies mechanical correctness, downstream blast radius, completeness of normalization, test coverage realism, and architectural foundation for Phase 5B-main and Phase 5C.
**Baseline:** All 844 tests passing (794 + 50 new).

---

## Q1 — Field Propagation End-to-End Correctness

### Path-by-path verification

For each of the eight newly propagated brief fields, the source path was re-traced against the upstream cron writer:

| Brief field | Cron source path | Writer source | Match |
|---|---|---|---|
| `sector` | `ranking?.sectorName ?? stock.sector ?? null` | `compute-index-intelligence.js:770` (`sectorName`) | ✓ |
| `sectorTechnicalTotal` | `ranking?.sectorTechnicalTotal ?? null` | `compute-index-intelligence.js:777,590` | ✓ |
| `nearestSupport` / `nearestResistance` / `distance{Support,Resistance}Pct` | `rankingLevels?.X ?? null` via `ranking?.levels \|\| techScore?.levels` | `compute-index-intelligence.js:797` (mirrored from `:531`) | ✓ |
| `distTo52wkHigh` | `factors?.distTo52wkHigh ?? null` (techScore.factors) | `indexIntelligence.js:396` | ✓ |
| `nr7Flag` | `ranking?.nr7Flag ?? techScore?.nr7Flag ?? false` | `compute-index-intelligence.js:784,556` | ✓ |
| `macdFreshBullishCross` / `Bearish` | `factors?.macdFresh*Cross ?? false` | `indexIntelligence.js:401-402` | ✓ |
| `divergence` | `rankingMomentum?.divergence ?? null` via `ranking?.momentum \|\| techScore?.momentum` | `compute-index-intelligence.js:800,538` | ✓ |
| `lastCandlePattern` | `rankingRecent?.lastCandlePattern ?? null` via `ranking?.recentAction \|\| techScore?.recentAction` | `compute-index-intelligence.js:801,545-547` | ✓ |

All eight paths are correct against the actual upstream writers.

### Finding 1.1 — Portfolio brief `sector` resolution diverges from bench brief — *Backlog*

**File:** `api/cron/voice-layer-cache.js:210` (portfolio) vs `:385` (bench)

```js
// Portfolio brief
sector: ranking?.sectorName ?? stock.sector ?? null,

// Bench brief (unchanged from pre-5B-prep)
const sector = asset.sector || (assetClass === 'crypto' ? 'Crypto' : 'Unknown');
```

For the same stock present in both a portfolio (e.g., MSFT in `star`) and a bench (e.g., MSFT in `bench.stocks`), the rendered sector could differ. Portfolio prefers `ranking.sectorName` (canonical, sourced from peerRankings or `STOCK_UNIVERSE`); bench uses `asset.sector` from the position object verbatim, with `'Unknown'` as final fallback.

In practice the values usually align (both `'Technology'`, `'Healthcare'`, etc.), but if `compute-index-intelligence.js:724` ever produces a more canonical name than what's stored on positions (e.g., `'Information Technology'` vs `'Technology'`), the header line would read differently across tier and bench renderings of the same symbol.

**Recommendation (backlog):** unify on one source-of-truth precedence. Lean toward `ranking?.sectorName ?? asset.sector ?? ...` for bench too, matching the portfolio convention. Defer because no test currently exercises divergent sector names and the production data may already align.

### Finding 1.2 — `||` (logical OR) vs `??` (nullish coalescing) on object falls-through fallbacks — *Defer*

**File:** `api/cron/voice-layer-cache.js:189-191` (portfolio) and `:391-393` (bench)

```js
const rankingLevels = ranking?.levels || techScore?.levels || null;
const rankingMomentum = ranking?.momentum || techScore?.momentum || null;
const rankingRecent = ranking?.recentAction || techScore?.recentAction || null;
```

Uses `||` rather than `??`. Functionally identical for the only realistic values (`null` or an object) — a truthy object never falls through. But `||` would prematurely fall through if the writer ever shipped an empty-string sentinel or `0` for these fields (impossible by current schema). Stylistic inconsistency with the rest of the brief writer which uses `??` exclusively.

**Recommendation (defer):** no behavioral impact today. Could flip to `??` for consistency in a future cleanup; not worth a separate commit.

### 1.2 — Test fixture realism

`realisticPortfolioBrief` (`voiceLayerPrompt.test.js:1650-1681`) and `realisticBenchBrief` (`:1683-1711`) include every field the cron writers now produce, plus `existingBadges` and `intraday` (set by other passes). I cross-checked field-by-field against `voice-layer-cache.js:193-224` and `:394-433`. ✓

The two fixtures don't include `thresholdProximity` by default because it's gated on `baseATR > 0` and not relevant to the Phase 5B-prep helper coverage. This matches reality: most briefs omit it.

### 1.3 — `?? false` vs `?? null` for boolean fields

The propagation uses `?? false` for `nr7Flag` / `macdFresh*Cross`. The renderer uses `=== true`, so `false` and `null` behave identically — both omit the corresponding line. This is consistent with the upstream writer (`indexIntelligence.js:401-402` writes `?? false`).

Alternative considered: `?? null` would let the renderer distinguish "flag is genuinely false" from "we have no data on this signal." For Phase 5A's `Signals:` line, this distinction has no value — neither case emits a line. The `?? false` choice matches the upstream and keeps the brief's boolean shape uniform. ✓

### 1.4 — Other dormant fields the cron could propagate (backlog)

Checked `techScore.factors` for fields that the renderer might want eventually but the cron doesn't currently propagate:

- `factors.upDayVolRatio` — already used to construct `momentumSummary` upstream, never surfaced as a separate brief field. Could feed a future "Volume confluence" signal.
- `factors.macdAboveSignal` — boolean. Could indicate MACD position without a fresh-cross event.
- `factors.macdHistogram`, `factors.sma{20,50,200}` — raw values, mostly useful for snapshots (Phase 5C).
- `ranking.dailyRange`, `ranking.bBandwidthPercentile`, `ranking.sma200_position` — already mirrored, not yet rendered.
- `ranking.momentumScore`, `ranking.momentumFactors` — Phase 1 work.

**Not findings.** Capture-only. No action in 5B-prep.

---

## Q2 — Sentinel-Zero Contract Change Blast Radius

### 2.1 — Downstream consumers of `brief.technicalScore` / `brief.atrPercent`

Production consumers (excluding tests):

| File:line | Pattern | Affected by null contract? |
|---|---|---|
| `voiceLayerPrompt.js:1009,1031` | `brief.technicalScore != null` / `brief.atrPercent != null` | ✓ Updated in commit 80692e2 |
| `agent/chat.js:212-232` | Reads `voiceLayerCache` doc, passes to `buildVoiceLayerPrompt` | Pass-through; renderer handles null correctly |

`brief.technicalScore` and `brief.atrPercent` are not read anywhere else. The blast radius is contained to the voiceLayer renderer.

Other readers of `s.technicalScore` / `s.atrPercent` from `stockRankings` / `stockTechnicalScores` (not from the brief):

| File:line | Pattern | Notes |
|---|---|---|
| `agentPromptAssembly.js:138` | `s.technicalScore != null ? Math.round(...) : '-'` | Already null-safe |
| `agentEvalPromptAssembly.js:1040,1118` | `tech?.atrPercent != null` / `ranking.technicalScore != null` | Already null-safe |
| `archetypeScoring.js:121,123` | `s.technicalScore ?? 50` / `s.atrPercentile ?? 0.5` | Median fallback (not 0-as-sentinel) |
| `buildTechnicalSnapshot.js:62,107` | `?? null` | Already null contract |

The upstream writer paths (`compute-index-intelligence.js` for `stockRankings` and `stockTechnicalScores`) are unchanged. Phase 5B-prep's sentinel change is scoped exclusively to the brief output and the renderer that consumes it.

### Finding 2.1 — `agent-evaluate.js:1589` uses `|| 0` on raw `techScore.technicalScore` — *Backlog (out of scope)*

**File:** `api/cron/agent-evaluate.js:1589`

```js
benchSectorScores[sector].push({ symbol: ..., score: techScore.technicalScore || 0, ... });
```

Same "0 collapses missing and legitimate-zero" pattern, but on the raw `stockTechnicalScores` read (not on a brief). Phase 5B-prep specifically scoped the cleanup to voice-layer-cache.js, so this is out of scope. The pattern is structurally identical to F3.1 — worth a separate backlog item.

Similarly, `agent-evaluate.js:459,753` use `stock.atrPercentile ? ... : 2.5` as a falsy-check; legitimate `atrPercentile: 0` falls through to `2.5`. Same backlog concern.

**Recommendation (backlog):** capture as a separate workstream item ("F3.1 redux — agent-evaluate `gameplanMeetingTrigger` baseATR fallback"). Not blocking for 5B-prep merge.

### 2.2 — ScoutAlert null-safety audit

| ScoutAlert | Predicate | Behavior on null | Verdict |
|---|---|---|---|
| `rs_breakout` (`:466`) | `rsPercentile >= 85 && typeof technicalScore === 'number' && technicalScore >= 75` | Excludes null (no alert emitted) | ✓ |
| `volume_surge` (`:477-488`) | Gates on `volumeConfirmation >= 10` only; `scoreClause` empty when null | `${''}${'RS supportive.'} ${''}`.trim()` → no orphan stub | ✓ |
| `game_fit` (`:491-502`) | Gates on `baggerBombFit >= 85 && baggerBombRank <= 15`; `atrClause` is `'ATR percentile N/A.'` when null | Renders `Composite score X. ATR percentile N/A.` | ✓ |

The `volume_surge` detail template has a potential cosmetic edge case: when `scoreClause = ''` AND macd clause empty AND `rsPercentile < 60`, the trimmed output is `'RS neutral or weak.'`. Clean. When `scoreClause = 'Technical score 80. '` AND macd clause non-empty, no double-spaces. The template's `${A}${B} ${C}` shape with `.trim()` handles all combinations. No orphan stub. ✓

### Finding 2.2 — `game_fit` displays "ATR percentile N/A." when atrPercentile is null — *Defer*

**File:** `api/cron/voice-layer-cache.js:494`

The new null-safe path emits the literal string `"ATR percentile N/A."` to the scoutAlert detail. The user (Gemma) would see "N/A" verbatim. This is consistent with the existing `Composite score ${ranking.compositeScore ?? 'N/A'}` convention on the same line, so the inconsistency is minimal — but "N/A" is a renderer-level token that probably shouldn't appear in user-facing strings, given the DATA_CONFIDENCE_RULE framing. An alternative is to omit the clause entirely.

**Recommendation (defer):** matches existing convention on the same line. If `Composite score N/A` is acceptable, `ATR percentile N/A.` is too. Re-examine when DATA_CONFIDENCE_RULE wording is revisited (already-flagged F4.1 backlog item from Phase 5A).

### 2.3 — Other crons reading these fields

`compute-daily-regime-brief.js` and `compute-index-intelligence.js` are upstream writers, not readers. `agent-evaluate.js:1589` is the only other cron reader using a 0-sentinel pattern (covered above in Finding 2.1).

No other crons are affected by the sentinel change.

---

## Q3 — `PATTERN_DISPLAY_NAMES` Completeness and Consistency

### 3.1 — Coverage

`detectCandlePattern` (`analyticalPrimitives.js:297-348`) returns exactly:
```
'bullish_engulfing' | 'bearish_engulfing' | 'hammer' | 'shooting_star' | 'doji' | null
```

`PATTERN_DISPLAY_NAMES` (`analyticalPrimitives.js:355-361`) has all 5 non-null entries. `analyticalPrimitives.test.js:24-30` iterates the documented union and asserts every key resolves; locks the coverage at test time. ✓

### 3.2 — Defensive fallback edge cases

The renderers use `PATTERN_DISPLAY_NAMES[key] || key.replace(/_/g, ' ')`:

- **Empty string:** `voiceLayerPrompt.js:1104` short-circuits on `brief.lastCandlePattern.trim()` (falsy for `''` and whitespace-only). `agentEvalPromptAssembly.js:1110` uses only `if (!pattern) return null` — doesn't trim.
- **Whitespace-only:** voice-layer renderer correctly omits; agent-eval renderer would render `"Recent action:    "` (preserved whitespace). Minor cosmetic concern; cron writers don't emit whitespace-only patterns today.
- **Non-letter chars in key:** `'pattern-name'` → fallback `'pattern-name'` (unchanged). Hyphens persist. Defensive only; cron writers don't emit these.
- **Numeric values, objects, etc.:** voice-layer renderer's `typeof === 'string'` guards. Agent-eval renderer trusts the upstream shape.

### Finding 3.1 — Renderer trim/normalization inconsistency between voiceLayer and agent-eval — *Backlog*

**File:** `voiceLayerPrompt.js:1104-1108` vs `agentEvalPromptAssembly.js:1108-1113`

The voice-layer renderer trims the pattern key (`brief.lastCandlePattern.trim()`) before lookup; the agent-eval renderer does not. If the cron ever wrote `' doji '` (whitespace-padded), voice-layer would render `"Recent candle: doji."` correctly, but agent-eval would render `"Recent action:  doji "` with preserved whitespace.

In practice, `detectCandlePattern` returns literals (`'doji'`, `'bullish_engulfing'`, etc.) with no padding, so this divergence is theoretical. But the two renderers now share a normalization concern (the display map) and should share its defensive layer too.

**Recommendation (backlog):** add a small `displayCandlePattern(key)` helper in `analyticalPrimitives.js` that wraps the lookup + fallback + trim, and have both renderers call it. Defers the helper-extraction decision to when a third renderer needs it (e.g., Phase 5C snapshot rendering).

### 3.3 — Capitalization consistency

Both maps use lowercase: `'bullish engulfing'`, `'shooting star'`, `'doji'`. The voice-layer emits `"Recent candle: shooting star."` (sentence-cap from `"Recent candle: "`); agent-eval emits `"Recent action: bullish engulfing"` (no trailing period, no capitalization). Lowercase across both. ✓

The lack of a period at the end of `Recent action:` line (agent-eval) is a minor formatting difference from `Recent candle:` (voice-layer, has period). Not a Phase 5B-prep regression — predates this PR.

---

## Q4 — Test Coverage Realism and Gaps

### 4.1 — Production brief shape match

`realisticPortfolioBrief` and `realisticBenchBrief` (in `voiceLayerPrompt.test.js:1650-1711`) field-by-field comparison against `voice-layer-cache.js:193-224` (portfolio) and `:394-433` (bench):

- Both fixtures: 100% of fields the cron writes are present.
- Portfolio fixture: includes `existingBadges: []` and `intraday: null` (cron-set even when no data). ✓
- Bench fixture: no `existingBadges` or `intraday` (cron doesn't set these on bench). ✓ Matches reality.

The fixtures don't include `thresholdProximity` (gated on `baseATR > 0` upstream). Realistic — most briefs omit it. ✓

### 4.2 — Edge case coverage

- **All 4 signals fire simultaneously:** `voiceLayerPrompt.test.js:1758-1773` ("renders both Levels and Signals when all propagated fields are present and active") covers MACD bullish + divergence bullish + NR7 + candle pattern shooting_star. ✓
- **No signals fire:** Covered transitively via "header degrades when ranking lacks sector context" (`:1787-1804`) and the cooldown-only bench test (`:1818-1840`). ✓
- **Levels + Signals coexistence:** Covered in the "all propagated fields" test. ✓
- **ScoutAlert end-to-end:** `voice-layer-cache.test.js` has 6 new buildScoutAlerts tests covering rs_breakout, volume_surge, and game_fit paths with both null and present technicalScore/atrPercentile. ✓

### Finding 4.1 — No round-trip "cron writes → renderer renders" test — *Backlog*

**Coverage gap:** the integration tests use fixture briefs (`realisticPortfolioBrief`, `realisticBenchBrief`) that imitate the cron output but are not produced by the cron under test. A field-name drift between writer and reader (e.g., cron writes `closestSupport`, renderer reads `nearestSupport`) would slip through:
- Cron tests pass (assert the new field name on the brief).
- Renderer tests pass (fixture uses the old name).
- Production fails silently — the renderer reads `undefined` for the renamed field.

The voice-layer-cache.test.js field-propagation tests verify the cron writes the correct field names, and voiceLayerPrompt.test.js helpers test the renderer reads those names. The names happen to match. But no single test asserts the round-trip.

**Recommendation (backlog):** add 2-3 tests that call `buildPortfolioBriefs` directly with a realistic Firestore-shape input, then pass the result through `buildPortfolioBriefsBlock`. Catches field-name drift in a single assertion. Low priority — field names are documented in the contract comment and tested on both sides.

### 4.3 — Inversion cleanliness

`voiceLayerPrompt.test.js:899-911` (the old "skips the ATR segment when atrPercent is missing or zero" test) is replaced by 4 new tests (lines 901-951) covering: `atrPercent: 0` renders, `atrPercent: null` omits, `technicalScore: 0` renders, `technicalScore: null` omits. No stale assertions about the old behavior remain. ✓

A semantic note: the new tests explicitly cite F3.1 in a comment block above them, anchoring the inversion to the discovery doc. ✓

### 4.4 — Cross-commit integration tests (PATTERN_DISPLAY_NAMES + propagation)

`voiceLayerPrompt.test.js:1750-1763` ("renders the normalized candle pattern in the Signals line") tests `lastCandlePattern: 'bullish_engulfing'` → `"Recent candle: bullish engulfing."`. This requires both:
1. The map lookup added in Commit 2 (`9d6f162`)
2. The brief field included in fixtures matching Commit 4 (`e3aef09`)

End-to-end normalization is locked. ✓

Additionally `voiceLayerPrompt.test.js:1768-1772` (all-signals-fire test) asserts `Recent candle: shooting star.` (normalized from `shooting_star`). ✓

---

## Q5 — Architectural Readiness for Phase 5B-main and Phase 5C

### 5.1 — Contract comment quality

The contract comment (`voiceLayerPrompt.js:948-975`, commit `ed05094`) covers:
- ALWAYS-EMIT vs CONDITIONAL distinction (sentinel returns, caller idiom)
- Boolean flag invariant (strict `=== true`)
- `divergence` union
- `lastCandlePattern` snake_case + PATTERN_DISPLAY_NAMES
- Null-not-zero for numeric metrics

What 5B-main / 5C authors would need that's NOT covered:

- The contract for `existingBadges` (array, default `[]`), `thresholdProximity` (optional object), `intraday` (null sentinel).
- The structural difference between brief shapes (flat) and snapshot shapes (nested per-category — see `buildTechnicalSnapshot.js`). A Phase 5C author looking at the comment might wrongly assume `buildSignalsLine(snapshot)` works because both have `macdFreshBullishCross` — but snapshots store it at `momentum.macdFreshBullishCross`, not flat.

### Finding 5.1 — Contract comment doesn't flag the brief-vs-snapshot schema difference — *Backlog*

**File:** `voiceLayerPrompt.js:948-975`

The contract comment is brief-centric. Phase 5C will wire `proposalHistory[i].snapshot` and `trades[i].snapshot` into `buildReviewContext`. Snapshots are produced by `buildTechnicalSnapshot.js`, which uses a *nested per-category* shape (`momentum.macdFreshBullishCross`, `volume.nr7Flag`, `levels.nearestSupport`, etc.) rather than the brief's flat shape.

A Phase 5C author who reads the contract comment and tries to reuse `buildSignalsLine(snapshot)` will read `undefined` for every flag. The Phase 5A pre-merge audit's F2.2 already flagged this ("Phase 5C should introduce a `buildSnapshotLeg` helper"), and the contract comment doesn't replicate that warning.

**Recommendation (backlog):** add one line to the contract comment noting the brief shape is flat and that snapshot rendering needs its own helper family. Cheap insurance against drift.

### 5.2 — Sentinel-zero pattern propagation to snapshots

`buildTechnicalSnapshot.js` already uses `?? null` consistently (lines `:38-111`). The snapshot shape was already on the null contract before 5B-prep — no work needed for 5C compatibility. ✓

### 5.3 — Brief field names vs snapshot field names

Same physical concept, different access path:

| Concept | Brief path | Snapshot path |
|---|---|---|
| MACD fresh bullish cross | `brief.macdFreshBullishCross` | `snapshot.momentum.macdFreshBullishCross` |
| NR7 flag | `brief.nr7Flag` | `snapshot.volume.nr7Flag` |
| Nearest support | `brief.nearestSupport` | `snapshot.levels.nearestSupport` |
| Distance to 52wk high | `brief.distTo52wkHigh` | `snapshot.smaStack.distTo52wkHigh` |
| Technical score | `brief.technicalScore` | `snapshot.composite.technicalScore` |
| Last candle pattern | `brief.lastCandlePattern` | `snapshot.recentAction.lastCandlePattern` |

Phase 5C author must write a separate snapshot renderer that knows the nested structure. This is fine and expected — see Finding 5.1 for the comment-doc gap.

### 5.4 — Patterns 5B/5C should NOT replicate

- **`PATTERN_DISPLAY_NAMES[key] || key.replace(/_/g, ' ')`**: the `|| fallback` is a *defensive* fallback for unknown keys, not a primary path. 5B/5C should not use this pattern as a default — the map should be exhaustive for known inputs, with the fallback only firing for genuinely unexpected values. Fine as-is here.

- **`sector` resolution divergence** (Finding 1.1): Phase 5B-main / 5C should not replicate the portfolio-vs-bench `sector` fallback split. If 5C introduces sector display in snapshot rendering, use one source-of-truth precedence.

- **Bench briefs' `'Unknown'` hardcode** (`voice-layer-cache.js:385`): `'Unknown'` is a magic string in the renderer's data path. Not a regression from 5B-prep — predates it. Phase 5B-main / 5C should prefer `null` and let renderers gate, rather than passing magic strings.

---

## Synthesis

**Phase 5B-prep should be merged with [4] follow-up workstream items captured.**

The five commits are mechanically correct: source paths verified, blast radius contained, normalization complete, test coverage realistic. No critical findings. The 4 backlog items are:

1. **F1.1 — Unify portfolio/bench `sector` resolution.** Cosmetic alignment; not blocking.
2. **F2.1 — `agent-evaluate.js:1589,459,753` carries the same 0-as-sentinel pattern that 5B-prep fixed in `voice-layer-cache.js`.** Separate workstream; out of 5B-prep scope.
3. **F3.1 — Renderer trim consistency between voiceLayer and agent-eval for candle patterns.** Defensive layering; consider when a third renderer arrives.
4. **F5.1 — Contract comment should flag the brief-vs-snapshot schema gap before Phase 5C author misreads it.** Cheap forward-compat note.

Two defer items (no action): Finding 1.2 (`||` vs `??` on object falls-through), Finding 2.2 (`N/A` literal in scoutAlert detail).

**Confidence: high.** The five commits do what the prompt described, with verified source paths and clean integration test coverage. Phase 5B-prep is ready to merge as-is; the four backlog items are forward-compat refinements, not blockers.

*End of audit. Awaiting merge decision.*
