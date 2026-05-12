# Phase 5A — Pre-Merge Audit

**Status:** Read-only. No code changes.
**Branch:** `claude/phase-5a-per-symbol-rendering-KMVJF` (three commits: `cf956a2`, `8c5c8b4`, `243a11c`)
**Auditor:** light architectural / quality pass before Phase 5B and 5C extend the pattern.

Findings are tagged **Critical** (blocks merge), **Backlog** (real, address before 5B/5C double down), or **Defer** (capture only).

---

## Q1 — Rendered Output Quality

### Finding 1.1 — `"%ile"` abbreviation reads awkwardly compared to alternatives — *Defer*

**File:** `voiceLayerPrompt.js:995`
```js
metricsParts.push(`RS ${ordinalSuffix(brief.rsPercentile)} %ile`);
```

`%ile` is an uncommon abbreviation. Trader-vernacular conventions vary — "percentile," "p.", or just bare integers in context ("RS 87") are more common. `%ile` is unambiguous but stylistically odd, and looks a bit like a typo or formula remnant.

Edge cases I verified empirically:
- `rsPercentile: 0` → `"RS 0th %ile"` — grammatical but unusual phrasing for a real signal (zeroth-percentile RS = strongest underperformer; worth surfacing, but "0th" looks like an error)
- `rsPercentile: 100` → `"RS 100th %ile"` — fine
- `rsPercentile: 11` → `"RS 11th %ile"` — teen-suffix correct

The ordinal suffix is technically right; the abbreviation choice is the friction.

**Recommendation (deferred):** before 5B/5C touch the helpers again, consider standardizing to either `"RS 87th percentile"` (+1 token per render) or `"RS 87"` (trusting the surrounding context). Not worth fixing for 5A alone.

---

### Finding 1.2 — `"Support $418 (-3.5%)"` parenthetical semantics are inferable but not labeled — *Defer*

**File:** `voiceLayerPrompt.js:1025`
```js
segments.push(`Support $${brief.nearestSupport} (${sign}${v.toFixed(1)}%)`);
```

The `(-3.5%)` parenthetical means "the support level is 3.5% below current price" — but the line itself doesn't say "below price." The 52wk-high segment has the word `"away"` which makes the framing clearer:

```
Levels: Support $418 (-3.5%), Resistance $432 (+1.8%), 52wk high -3.1% away.
```

`52wk high -3.1% away` reads more clearly than `Support $418 (-3.5%)`. The latter could be mis-read as "support level dropped 3.5% today" if you're scanning quickly. Gemma will likely infer correctly from context (`Levels:` prefix, dollar sign, the entire structure), but the segments aren't internally consistent.

**Recommendation (deferred):** consider `Support $418 (3.5% below)` and `Resistance $432 (1.8% above)` for self-evident framing. Or just accept the current form — Gemma will infer.

---

### Finding 1.3 — `"ATR 4.2%"` in the prompt while `DATA_CONFIDENCE_RULE` lists `"ATR%"` as "should not appear verbatim" — *Backlog*

**File:** `voiceLayerPrompt.js:1000` (header renders `"ATR 4.2%"`) vs `voiceLayerPrompt.js:1205` (rule says `"raw indicator values (RSI, ATR%, BB%B) should not appear verbatim"`).

This is the classic "show but don't tell" prompt pattern — the prompt may contain the value for Gemma's *reasoning*, while the rule constrains what Gemma *quotes back* in the response. Working as designed, but the wording invites confusion:

- The prompt literally contains the string `"ATR 4.2%"`.
- The rule says `"ATR%"` should not appear verbatim.
- Gemma may interpret "appear" ambiguously and either (a) refuse to use the ATR signal at all because the rule is too strict, or (b) quote it directly because the prompt example normalized the format.

The rule could be made explicit: "the prompt may show these for your context; do not quote the raw numbers in your responses." Two sentences would resolve the tension cleanly.

Severity is **Backlog** because Phase 5B (intraday) will add another value (`vwapDeviation N.N%`) that lands in the same "shown in prompt, paraphrase in response" bucket. The rule should be sharpened before Phase 5B doubles down.

**Recommendation (backlog):** capture as a Phase 5B prerequisite — wordsmith the rule so the show/quote distinction is explicit. Combine with Finding 4.1 below.

---

### Finding 1.4 — Conditional-line order is good; density may become a concern at full population — *Defer*

**File:** `voiceLayerPrompt.js:1086-1124` (assembly order).

Order is: `header → trend → momentum → levels → signals → BaggerBomb → threshold → swap-lock → badges`. State (header) → narrative context (trend/momentum) → action zones (levels) → fresh events (signals) → scoring telemetry. This is defensible — signals are the most decision-relevant conditional flags and they sit right above the BaggerBomb-specific scoring section, which is where Gemma maps observations to actions.

The audit prompt asked whether signals should come *before* levels because they're more decision-critical. I'd argue the current order is actually better: levels establish "where could this go" (risk framing) and signals add "what's happening now" (action framing). Signals → scoring is a clean handoff.

Density: a fully-loaded brief is 8 lines, with 6 portfolio positions that's ~48 lines under `YOUR PORTFOLIO` plus another ~32 under `YOUR BENCH` (8 bench × 4 average lines). The full prompt mid-battle is well within the 128K context, but legibility for Gemma's middle-attention window is something to monitor — especially once Phase 5B adds another line and Phase 5C inflates Review Mode.

**Recommendation (deferred):** no action for 5A. After 5B ships, sample a real-world worst-case prompt and eyeball whether the brief block needs to compact (e.g., merge trend+momentum into one line when both are short).

---

## Q2 — Helper Architecture for 5B / 5C

### Finding 2.1 — Helpers are consistent in shape, *inconsistent* in null-return contract — *Backlog*

**File:** `voiceLayerPrompt.js:953-1078`.

All three helpers share:
- single positional argument: `brief`
- top-level defensive `if (!brief) return …`
- segment-array → join pattern
- skip-when-falsy gating per segment

But the return contract diverges:

| Helper | Returns when brief is null | Returns when no segments | Caller treats |
|---|---|---|---|
| `buildHeaderLine` | `''` (empty string) | non-empty string (always at minimum `"SYMBOL"`) | always inlines |
| `buildLevelsLine` | `null` | `null` | `if (line) entry += line` |
| `buildSignalsLine` | `null` | `null` | `if (line) entry += line` |

`buildHeaderLine` returns a string (sentinel: empty string), the other two return `string | null`. This is defensible because the header is always emitted and the conditional lines are not — but a new helper author for Phase 5B might pick the wrong contract.

Phase 5B's `buildIntradayLine` is a *conditional* line (emit only when `brief.intraday` is non-null and has meaningful values). It should follow the `buildLevelsLine` / `buildSignalsLine` contract: `string | null`. This should be documented before 5B starts.

**Recommendation (backlog):** before Phase 5B, add a one-paragraph contract comment above the helpers documenting: (a) conditional helpers return `string | null`, (b) always-emit helpers return `string`, (c) callers branch on `if (line)`. Cheap to do, will prevent drift.

---

### Finding 2.2 — Phase 5C snapshot rendering should be a *block* helper, not a per-line family — *Defer*

**File:** N/A for 5A (Phase 5C territory). Observation only.

Phase 5C wires `proposalHistory[i].snapshot` and `trades[i].snapshot` into `buildReviewContext`. Each snapshot is a *pair* of structured snapshots (`symbolOut`, `symbolIn`), each with ~50 leaves. The natural shape is one helper per *snapshot leg* (not per-line), returning a compressed 4-6 line technical context paragraph. E.g.,

```js
function buildSnapshotLeg(snapshot, label) {
  // returns "What MSFT looked like when we vetoed:\n  RS 87%ile, fresh MACD bullish cross,\n  above all SMAs, 2.3% below 52wk high."
}
```

Then `buildReviewContext` calls `buildSnapshotLeg(p.snapshot?.symbolIn, 'when proposed')` and renders the pair.

If Phase 5C tries to reuse `buildHeaderLine` / `buildLevelsLine` / `buildSignalsLine` directly, it'd produce the *live* brief format (`"MSFT [core] +1.5% — Score …"`) which is wrong for a frozen historical snapshot (no live `tier`, no live `changePercent`). Different abstraction needed.

**Recommendation (deferred):** Phase 5C should introduce a `buildSnapshotLeg(snapshot, ...) → string | null` helper rather than wiring per-line helpers from 5A. Document this when 5C kicks off; 5A is fine as-is.

---

### Finding 2.3 — Mild duplication of the segment-array pattern; no abstraction warranted yet — *Defer*

**File:** `voiceLayerPrompt.js:973-1004` (header metrics) and `:1014-1051` (levels) and `:1062-1077` (signals).

All three helpers do:
1. Initialize `[]`
2. Conditionally `.push()` segment strings
3. Bail if empty
4. Join with delimiter

A `collectSegments({prefix, joiner, predicates})` helper could DRY this, but at three callers it's premature abstraction. The patterns are similar enough to compare side-by-side but different enough (different delimiters, different bail conditions) that the abstraction would obscure intent.

If Phase 5C adds 2-3 more helpers using the same pattern, the abstraction might pay off. Not today.

---

## Q3 — Predicate Edge Cases Not in Tests

### Finding 3.1 — `technicalScore === 0` and `atrPercent === 0` are silently treated as "missing data" — *Backlog*

**File:** `voiceLayerPrompt.js:978` and `:999`
```js
if (brief.technicalScore != null && brief.technicalScore !== 0) { ... }
if (brief.atrPercent != null && brief.atrPercent !== 0) { ... }
```

Empirically confirmed: `technicalScore: 0` and `atrPercent: 0` both omit their segments from the rendered header. The pattern is defensive against the cron's "0 is sentinel for missing data" convention (`voice-layer-cache.js` falls back to 0 when ranking data is unavailable).

The problem: a stock with a *genuine* technical score of 0 (lowest possible — broken trend, no momentum) is indistinguishable from a stock with missing data. Same for `atrPercent: 0` (which is impossible in practice — every stock has some volatility — but defensively flagged).

In production this is rarely visible: scores in the bottom decile are rare, and bona-fide-zero stocks are essentially nonexistent. But the renderer "swallows" data that would be high-value if real.

Cleaner approach (for backlog): use explicit `null` for missing data at the cron layer and use strict `!= null` checks in the helpers. That's a `voice-layer-cache.js` change, out of scope for 5A. Document for later.

**Recommendation (backlog):** when Phase 5B touches the cache writer for intraday data, also revisit the "0 as sentinel" pattern. If the cron starts writing explicit `null`, the helpers can drop the `!== 0` guard.

---

### Finding 3.2 — Both MACD fresh-cross flags `true` simultaneously renders contradictory output — *Defer*

**File:** `voiceLayerPrompt.js:1064-1065`
```js
if (brief.macdFreshBullishCross === true) flags.push('Fresh MACD bullish cross.');
if (brief.macdFreshBearishCross === true) flags.push('Fresh MACD bearish cross.');
```

Empirically confirmed: setting both to `true` yields `"Signals: Fresh MACD bullish cross. Fresh MACD bearish cross."` — which is semantically impossible (MACD can't simultaneously cross both directions on the same bar).

The helper renders what it's told; the data-integrity contract lives in the cron. If both flags are true, that's a cron bug, and surfacing the contradiction to Gemma would actually *help* debugging (Gemma might call it out).

Severity is **Defer** because this is defensive-by-design behavior. The renderer shouldn't be in the business of cleaning up cron mistakes — that loses observability into upstream data quality.

**Recommendation:** leave as-is. If the data-quality contract is ever in doubt, add an `expect(macdFreshBullishCross && macdFreshBearishCross).toBe(false)` assertion in the cron tests rather than masking it in the renderer.

---

### Finding 3.3 — `nr7Flag` strict `=== true` check misses truthy non-boolean values — *Backlog*

**File:** `voiceLayerPrompt.js:1070`
```js
if (brief.nr7Flag === true) flags.push('NR7 contraction — breakout pending.');
```

Empirically confirmed: `nr7Flag: 1` renders nothing (returns `null`). Strict identity to `true` means only the literal boolean fires the line.

This is fine if the cron *always* writes a strict boolean. Per the Phase 4 snapshot inventory, `nr7Flag` is documented as `boolean | null` (`buildTechnicalSnapshot.js`), so the strict check is correct.

However, the same strict check is used for `macdFreshBullishCross` and `macdFreshBearishCross` (also documented as `boolean | null`). If any of these ever flips to e.g. integer-typed serialization in Firestore (date types sometimes deserialize unexpectedly), the helper would silently swallow the signal.

**Recommendation (backlog):** before Phase 5B, decide whether the helpers should be permissive (`Boolean(brief.nr7Flag) === true` — accepts `1`, `'yes'`) or strict. Currently strict; lock the contract in a comment so future contributors don't accidentally widen it.

---

### Finding 3.4 — `lastCandlePattern` snake_case from cron bleeds into the rendered output — *Backlog*

**File:** `voiceLayerPrompt.js:1072-1074`
```js
if (typeof brief.lastCandlePattern === 'string' && brief.lastCandlePattern.trim()) {
  flags.push(`Recent candle: ${brief.lastCandlePattern.trim()}.`);
}
```

Empirically confirmed: `lastCandlePattern: 'doji_dragonfly'` renders as `"Signals: Recent candle: doji_dragonfly."` — snake_case visible in the prompt.

I haven't checked the cron writer to confirm whether it produces snake_case or human-readable strings. If the cron writes `'doji'` / `'hammer'` / `'engulfing'` (single words), output is clean. If it writes `'bullish_engulfing'` / `'shooting_star'` / `'doji_dragonfly'`, the output looks like raw symbol names.

This matters more once the suspicious-candle filter (deferred in 5A's Q9) gets wired in — the pattern names will be more nuanced and potentially compound.

**Recommendation (backlog):** when Workstream wires `lastCandlePattern` into the brief (it's not on the brief today per discovery), confirm the cron's naming convention. If snake_case, add a `.replace(/_/g, ' ')` step in the helper, or normalize at the cron writer. Document the contract either way.

---

## Q4 — DATA_CONFIDENCE_RULE Coherence

### Finding 4.1 — Tension between "show in prompt" and "don't quote verbatim" needs explicit framing — *Backlog* (overlaps with Finding 1.3)

**File:** `voiceLayerPrompt.js:1205`
```
"Percentile and rank values may be paraphrased as bands ("top decile,"
"best in sector") in responses; raw indicator values (RSI, ATR%, BB%B)
should not appear verbatim."
```

The rule says raw indicator values "should not appear verbatim" — but the prompt itself now literally contains `"ATR 4.2%"` in the header line. Gemma sees the same string the rule tells her not to produce. Two failure modes:

1. **Over-correction**: Gemma reads the rule and concludes "I shouldn't reason about ATR at all because the value's in my prompt."
2. **Under-correction**: Gemma reads the example as normalization ("the system shows ATR like this, so I can quote it back").

The OUTPUT_FORMAT rule (line 45) is clearer on this distinction — it gives a positive example ("NVDA is pushing toward its scoring threshold") and a negative example ("not 'NVDA is at 0.98 ATR'"). The new DATA_CONFIDENCE_RULE sentence only has the negative side.

**Recommendation (backlog):** sharpen the wording. Suggested edit (to discuss): "The prompt may show raw indicator values for your reasoning context (e.g., `ATR 4.2%` in the brief header). Do not quote these raw values in your response — interpret them ('volatility is elevated') or paraphrase percentile/rank as bands ('top decile')." Combine with Finding 1.3.

---

### Finding 4.2 — `"Technical Score"` is in OUTPUT_FORMAT's prohibited examples but not in DATA_CONFIDENCE_RULE's new list — *Backlog*

**File:** `voiceLayerPrompt.js:45` says `"not 'Technical Score is 87'"`. `voiceLayerPrompt.js:1205` says raw indicator values are `"(RSI, ATR%, BB%B)"`. `"Technical Score"` is in OUTPUT_FORMAT's verbose example but absent from the DATA_CONFIDENCE_RULE list.

The header now renders `"Score 87 (rank #4/28 in Tech)"` — the value most likely to leak verbatim because it's the *first* thing in the metrics segment and it has a simple, quotable form. If the list in DATA_CONFIDENCE_RULE is read as exhaustive (RSI, ATR%, BB%B and nothing else), Gemma may conclude technical score *can* be quoted.

The two rules don't outright contradict, but they're not aligned. OUTPUT_FORMAT remains the wider rule ("NEVER quote raw data numbers"); DATA_CONFIDENCE_RULE is the carve-out for percentiles/ranks. The new sentence implicitly distinguishes "Score 87" (raw indicator → don't quote) from "RS 87th percentile" (percentile → may paraphrase as band) — but it doesn't say so.

**Recommendation (backlog):** wordsmith the list so it's clearly illustrative ("e.g., RSI, ATR%, BB%B, Technical Score") rather than exhaustive. Or — better — frame the rule by *kind* of value (raw indicator vs. derived percentile/rank/band) and skip the enumeration entirely.

---

### Finding 4.3 — A positive paraphrase example for RSI would make the rule actionable — *Defer*

**File:** `voiceLayerPrompt.js:1205`.

The new sentence has a positive example for percentiles (`"top decile," "best in sector"`) and a negative-by-implication for raw indicators (RSI, ATR%, BB%B → don't quote). It doesn't have a positive example for the *raw indicator* case.

Gemma is told "don't quote RSI 67" but not "do say 'momentum is firm but not stretched.'" The OUTPUT_FORMAT rule has the equivalent ("Say 'momentum has been strong this week'") but it's spatially separated. Co-locating an example with the new clause would make the rule actionable in one place.

**Recommendation (deferred):** at the same time as Finding 4.1 wordsmithing, consider adding one positive paraphrase example for raw indicators. Or leave it — the OUTPUT_FORMAT rule already covers it, and adding more text raises the rule's own footprint.

---

## Synthesis

**Phase 5A should be merged with the following follow-up workstream items captured:**

- **F1.3 + F4.1 (BACKLOG):** wordsmith `DATA_CONFIDENCE_RULE` to make the "show in prompt, don't quote in response" distinction explicit before Phase 5B adds intraday/VWAP rendering. These three findings cluster around the same prompt-vs-response framing question.
- **F2.1 (BACKLOG):** add a contract comment documenting the helpers' return-type convention (`string` for always-emit, `string | null` for conditional) before Phase 5B's `buildIntradayLine` lands.
- **F3.1, F3.3, F3.4 (BACKLOG):** as part of the Workstream that wires the new fields into `voice-layer-cache.js` briefs, confirm the cron contract for: `0` vs `null` sentinels, strict-bool vs truthy flag types, and snake_case vs human-readable candle pattern names.
- **F4.2 (BACKLOG):** sharpen the indicator list to be explicitly illustrative (or replace with a "by kind" framing) so `"Score 87"` doesn't slip through.
- **F1.1, F1.2, F1.4, F2.2, F2.3, F3.2, F4.3 (DEFER):** capture as design notes; no immediate action.

**Zero Critical findings.** The three commits are functionally correct, the tests are appropriately scoped, and the architecture is sound enough for Phase 5B/5C to build on. The findings flagged Backlog are mostly *contract / documentation* improvements rather than implementation bugs — they don't block merge but should be addressed before Phase 5B touches the same code surface and doubles down on the patterns.

**Suggested merge path:** merge 5A as-is; capture Backlog items as a tracked checklist; address them as the first step of Phase 5B (since 5B will edit the same file and rule).

---

*End of pre-merge audit. Awaiting decision.*
