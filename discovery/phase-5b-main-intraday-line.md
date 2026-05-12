# Phase 5B-main Discovery — Intraday Line Rendering

**Scope:** Read-only. Inventory + design recommendations for the
`buildIntradayLine` helper that will land in `voiceLayerPrompt.js`.

**Prior work referenced:**
- `discovery/phase-5a-pre-merge-audit.md` (helper contract, DATA_CONFIDENCE_RULE)
- `discovery/phase-5b-prep-cron-contract-cleanup.md` (sketch + predicate, §4.3)
- `discovery/phase-5b-prep-pre-merge-audit.md` (field propagation audit)

---

## Q1 — Intraday data shape verification

### 1.1 — `brief.intraday` shape (post-5B-prep)

`voice-layer-cache.js:279` attaches the cron-computed payload verbatim:

```js
brief.intraday = intradayMomentumMap[symbol] || null;
```

The map is `battle.cronState.intradayMomentum`, written by `agent-evaluate.js:374`:

```js
momentumData.vwap[symbol] = { ...vwapResult, sma20_5m };
```

Where `vwapResult` is the return of `calculateVWAP()`
(`technicalCalculations.js:378-410`):

| Field | Type | Source | Nullability |
|---|---|---|---|
| `vwap` | `number` (4 decimals) | `cumulativeTPV / cumulativeVolume` | Always present when intraday object is non-null |
| `currentPrice` | `number` (4 decimals) | last candle's `close` | Always present when intraday object is non-null |
| `vwapDeviation` | `number` (4 decimals, **percent**) | `((currentPrice − vwap) / vwap) * 100` | Always present when intraday object is non-null |
| `sma20_5m` | `number` (4 decimals) \| `null` | `calculate5minSMA20()` — last 20 5m closes / 20 | Independently nullable when `candles.length < 20` |

The whole `brief.intraday` is `null` when:
- The symbol is absent from `intradayMomentumMap` (cron didn't compute it this cycle)
- `calculateVWAP()` returned `null` (no candles, `cumulativeVolume === 0`, or non-finite values — `technicalCalculations.js:391, 399-401`)
- The intraday fetch failed (`agent-evaluate.js:378-380` logs warn, leaves `momentumData.vwap[symbol]` unset)

When `brief.intraday` is non-null, **`vwap`/`currentPrice`/`vwapDeviation` always travel together** (atomic from `calculateVWAP`'s return). The only sub-field that can be `null` while the parent is populated is `sma20_5m` — fewer than 20 candles into the trading day, or at market open before enough bars have closed.

### 1.2 — Where it's computed and when

`agent-evaluate.js` runs the parallel fetch at `:355-363`:

```js
const [intradayResult, ...] = await Promise.allSettled([
  fetchIntradayBatch(portfolioSymbols, { interval: '5m' }),
  ...
]);
```

- **Fetch scope:** `portfolioSymbols` only (star/core/support — see `:213`). Bench is excluded.
- **Routing:** `fetchIntradayBatch → fetchIntradayCandles → formatEODHDSymbol` handles crypto via `-USD.CC` suffix (`marketDataCache.js:86-89, 632-690`). Active-tier crypto (e.g., BTC in `star`) gets intraday correctly.
- **Schedule:** `*/15 13-20 UTC * * 1-5` (`vercel.json:135`). Same cadence as voice-layer-cache (`:143`, `*/15 13-20 UTC * * 1-5`).

**Cron interleaving:** both crons fire at the same minute marks. `voice-layer-cache` reads `battle.cronState.intradayMomentum` which `agent-evaluate` writes at the end of its run. So `voice-layer-cache` typically sees the **prior cycle's** intraday data, not the same cycle — at worst 15 minutes stale, no different from the rest of the brief data.

**Partial data cases:**
1. **`sma20_5m` null with vwap present:** Market just opened, < 100 minutes of 5m candles. `calculate5minSMA20` returns `null` for `candles.length < 20`.
2. **Whole intraday null:** Symbol missing from the map. Common at market open before the first eval cycle completes, or for any symbol where `fetchIntradayCandles` returned empty/partial.
3. **Partial-candle filter:** `marketDataCache.js:668-680` drops in-progress candles where any OHLC field is null. Defends against a pre-existing crash bug — relevant because at minute :00/:15/:30/:45 the freshest candle is still forming.

### 1.3 — Bench briefs and intraday — confirmed absent

`buildBenchBriefs` (`voice-layer-cache.js:298-436`) does not accept an `intradayMomentumMap` parameter and never sets `brief.intraday` on bench briefs. The handler at `:677` calls it with no intraday argument:

```js
const benchBriefs = buildBenchBriefs(battle.portfolio, priceMap, rankingsMap, techScoresMap);
```

Cross-verified against the post-5B-prep test fixture in
`voiceLayerPrompt.test.js:1683-1711` — `realisticBenchBrief` does **not**
include an `intraday` key. Phase 5B-prep pre-merge audit explicitly flagged
this asymmetry (`phase-5b-prep-pre-merge-audit.md:195-196`) and it survived
the merge as intended.

---

## Q2 — Rendering format design

### 2.1 — Recommended format: prose-with-numbers (Option B variant)

The four candidates from the prompt mapped to existing precedents:

| Option | Sample | Tokens (per brief) | Match to existing patterns |
|---|---|---|---|
| A — deviation-only | `Intraday: VWAP +0.69%, 5m SMA20 +0.30%.` | ~10 | Compact, but "VWAP +0.69%" is ambiguous (deviation of what? Of price? Of the VWAP value?) |
| B — explicit prose | `Intraday: Price 0.7% above session VWAP, holding above 5m SMA20.` | ~22 | Self-documenting; matches `DATA_CONFIDENCE_RULE`'s paraphrase intent |
| C — hybrid | `Intraday: VWAP +0.7% (price above), 5m SMA20 trending up.` | ~24 | Doubles tokens for marginal benefit; "trending up" not computable from one snapshot |
| D — signal-only gate | (no emission when small) | 0 or ~22 | Threshold arbitrary; loses the "balanced — at VWAP" signal |

**Recommended:** A modified Option B that adopts the **Levels-line idiom**:
"<deviation>% above/below <reference>". Numbers stay present (so Gemma can
*reason* with them), but the framing is unambiguous prose (so Gemma can
*paraphrase* without inventing a referent).

**Suggested format:**
```
Intraday: 0.7% above session VWAP, 0.1% above 5m SMA20.
```

- Sign → "above" / "below" word; absolute value of % rendered.
- Magnitude `0.0%` → `"at session VWAP"` (omit the number; the `0.0% above` reading is awkward).
- Match the Levels line's `.toFixed(1)` convention — 1 decimal place is plenty for a 15-min refresh signal.
- Token cost: ~14-18 tokens per brief × 6 portfolio briefs = **~85-110 marginal tokens** when fully populated. In line with the Phase 5 discovery estimate (90-180).

This is closest to the discovery report's Option B prose, with one
adjustment: it preserves the `currentPrice` vs `sma20_5m` magnitude as a
deviation %, not as a directional word ("holding above" / "trending up").
"Holding above" implies stability over time, which one snapshot can't
support. **One snapshot, one comparison — render the comparison, not the trend.**

### 2.2 — Handling `sma20_5m`

`sma20_5m` is a single value per cycle, so there is **no prior value to compare to** — "trending up" can't be derived. The two coherent options:

- **A. Price-vs-SMA20 deviation (recommended):**
  `((currentPrice − sma20_5m) / sma20_5m) * 100` → `"0.3% above 5m SMA20"`.
  Same idiom as the VWAP segment; same meaning ("intraday positioning").

- **B. Boolean side flag:** `"price above 5m SMA20"`.
  Drops the magnitude. Acceptable but loses information that's free to include.

- **C. Skip sma20_5m segment entirely:** Reduces signal but matches the
  cron's downstream consumer — `agentRiskManager.js:76` *uses* `sma20_5m`
  as a trail-stop reference, so it's not dead weight in the system, but for
  the **voice layer specifically** it's a marginal signal vs. VWAP.

**Recommendation:** Option A. The marginal token cost (`~5 tokens`) is low; the segment degrades cleanly when `sma20_5m` is null (early in session).

### 2.3 — Token cost confirmation

For 6 fully-populated portfolio briefs:

| Scenario | Per-brief tokens | Total |
|---|---|---|
| Full segments (VWAP + SMA20) | ~17 | ~100 |
| VWAP only (sma20_5m null at market open) | ~10 | ~60 |
| Both segments null (intraday entirely null) | 0 (line omitted) | 0 |

Mid-trading-session realistic worst case: **~100 tokens.** Phase 5 discovery's
90-180 estimate holds.

---

## Q3 — Emission predicate

### 3.1 — Recommended predicate

Pattern after `buildSignalsLine` (segment-independent gating, return `null`
when nothing fires):

```
- VWAP segment fires when typeof intraday.vwapDeviation === 'number'.
- SMA20 segment fires when typeof intraday.sma20_5m === 'number'
  AND typeof intraday.currentPrice === 'number'.
- If no segment fires, buildIntradayLine returns null.
```

This is the prompt's **Option B** ("emit when at least one numeric component"),
with the per-segment predicates matching the existing per-symbol-line helper
conventions.

### 3.2 — Reasoning

| Option | Verdict | Why |
|---|---|---|
| A — emit whenever `intraday` non-null | Reject | Would emit `Intraday:` headers with empty bodies if every sub-field were null (degenerate case but a stub line is worse than no line — same reason `buildLevelsLine` returns null when no segment qualifies) |
| **B — emit when ≥1 numeric component** | **Adopt** | Matches `buildSignalsLine` exactly. Each segment self-gates; the line as a whole emits when any segment fires. |
| C — threshold-gate on `|vwapDeviation|` | Reject | Threshold is arbitrary. `vwapDeviation = 0.05%` IS meaningful context ("balanced at session VWAP"). The CONDITIONAL pattern is for *no data*, not *unimportant data* — interpretation belongs to Gemma. |
| D — combined-signal gate | Reject | Adds composite predicate complexity for no clear payoff. |

**Note on noise:** Phase 5A explicitly chose `±10%` gates for Levels and
strict-`=== true` for Signals because their predicates are about
**actionability**, not data presence. The intraday line is about **data
presence**: the deviation is the signal, and 0.05% is a valid value to
show ("balanced"). No threshold gate.

### 3.3 — Consistency check against existing CONDITIONAL helpers

| Helper | Predicate per segment | Bail when |
|---|---|---|
| `buildLevelsLine` | `Math.abs(distance) <= 10` (5 for 52wk high) | All three segments fail their distance gate |
| `buildSignalsLine` | Strict `=== true` for flags; string `===` for divergence | All flags false and pattern null |
| **`buildIntradayLine` (proposed)** | `typeof === 'number'` per sub-field | All sub-fields non-numeric |

Pattern is consistent: every CONDITIONAL helper returns `null` when its
union of segment predicates is empty. The intraday helper's predicate
type — "data is present" rather than "in the action zone" — is appropriate
for its semantics.

---

## Q4 — DATA_CONFIDENCE_RULE intraday clause

### 4.1 — Current rule (post-5A refinement, `voiceLayerPrompt.js:1249-1250`)

> DATA CONFIDENCE:
> Portfolio data refreshes every 15 minutes. Frame prices as trends, not exact current values. Say "CF is up solidly today" not "CF is at $78.42." If data feels stale, acknowledge it: "as of last check." The prompt may show raw indicator values (e.g., "ATR 4.2%", "Score 87", "RS 87th %ile") to support your reasoning — do not quote these verbatim in responses. Interpret raw indicators qualitatively ("volatility is elevated"); paraphrase percentiles and ranks as bands ("top decile," "best in sector"). Never invent numbers — if a field is missing, skip it entirely.

### 4.2 — Recommended insertion

Insert **one sentence** between the existing "Interpret raw indicators...
top decile, best in sector" clause and the "Never invent numbers..." closer:

> Intraday signals (session VWAP, 5-min SMA20) describe today's session positioning — paraphrase as "holding above session VWAP" or "session momentum is constructive," not the exact deviation percentage.

**Full rule with insertion:**

> DATA CONFIDENCE:
> Portfolio data refreshes every 15 minutes. Frame prices as trends, not exact current values. Say "CF is up solidly today" not "CF is at $78.42." If data feels stale, acknowledge it: "as of last check." The prompt may show raw indicator values (e.g., "ATR 4.2%", "Score 87", "RS 87th %ile") to support your reasoning — do not quote these verbatim in responses. Interpret raw indicators qualitatively ("volatility is elevated"); paraphrase percentiles and ranks as bands ("top decile," "best in sector"). **Intraday signals (session VWAP, 5-min SMA20) describe today's session positioning — paraphrase as "holding above session VWAP" or "session momentum is constructive," not the exact deviation percentage.** Never invent numbers — if a field is missing, skip it entirely.

**Why this placement:**
- Sits adjacent to the existing "raw indicator values" treatment so the
  show/quote framing is unified.
- Comes before "Never invent numbers" (the closer) so it doesn't disrupt
  the rule's final guard.
- Bolded label "Intraday signals" makes it scannable for the implementer;
  the bold should NOT be in the rendered prompt — that's just for review
  legibility here.

### 4.3 — Tensions identified

**Tension 1 (resolved):** The opening sentence says *"Frame prices as
trends, not exact current values"* — does session VWAP count as a price?

The brief renders **the deviation %**, not the dollar value of VWAP. The
existing "prices" rule applies to absolute dollar amounts (`"$78.42"`), and
the existing "indicators" rule applies to raw indicator values
(`"ATR 4.2%"`). The deviation `"0.7% above session VWAP"` reads more like
the indicator class than the price class. The new clause carves it out
explicitly so Gemma doesn't have to infer.

**Tension 2 (minor):** The example list `"ATR 4.2%", "Score 87", "RS 87th
%ile"` doesn't include an intraday example. Phase 5A pre-merge audit
F4.2 noted this list reads as exhaustive even though it's marked `e.g.`.
The intraday clause is a separate sentence (not a list extension), so
no edit to the list is required — but if a future pass collapses the
clauses, add `"0.7% above session VWAP"` to the e.g. list.

**Tension 3 (unintroduced):** No prior helper in the prompt mentions
"session VWAP" — the term is new to the rule. The intraday line itself
will be the introducer (`"Intraday: 0.7% above session VWAP, ..."`), so
Gemma sees the term referenced both in the brief and in the rule. Mutually
reinforcing — good for grounding.

---

## Q5 — Bench intraday handling

### 5.1 — Confirmation: bench briefs still have no intraday post-5B-prep

`voice-layer-cache.js:298` (`buildBenchBriefs` signature) takes no
`intradayMomentumMap` parameter. The 5B-prep field-propagation work
extended bench briefs with `sectorTechnicalTotal`, `nearestSupport`,
`nearestResistance`, `nr7Flag`, `macdFreshBullishCross`,
`macdFreshBearishCross`, `divergence`, `lastCandlePattern`, etc.
(`:412-427`) — but it did **not** add `intraday` to bench.

This is intentional: `agent-evaluate.js:356` fetches intraday only for
`portfolioSymbols`, not `benchSymbols`. Adding bench intraday is a
cron-side change, not a renderer change.

### 5.2 — Recommendation: do NOT extend to bench in 5B-main

**Arguments for adding (per the prompt):**
- Symmetry with portfolio
- Bench candidates' intraday momentum informs swap timing

**Arguments against (recommended):**
1. **Cron cost.** Bench typically holds 8-10 symbols. Adding bench to
   `fetchIntradayBatch` doubles the EODHD intraday payload per cycle.
   `fetchIntradayBatch` is concurrency-limited at 5 (`marketDataCache.js:701`)
   with 200ms inter-batch delay — a doubling extends per-cron-cycle latency
   measurably, especially when stacked under the existing eval-cron deadline.
2. **Crypto bench split.** EODHD intraday for crypto **does** work
   (`formatEODHDSymbol` routes correctly), but bench crypto is often the
   single legacy slot. The routing isn't a blocker, just adds N fetches.
3. **Decision-relevance is secondary.** The bench brief already surfaces
   daily `changePercent`, `rsPercentile`, and the Phase 5A
   Signals/Levels lines. For swap timing, daily momentum dominates;
   session VWAP is a 15-minute-old marginal refiner.
4. **Phase 5 discovery's prior verdict held.** Nothing in 5A or 5B-prep
   surfaced a use case for bench session VWAP that wasn't already known.

**Recommend:** Phase 5B-main leaves bench briefs without intraday. Track as
a possible Phase 5C+ enhancement *if* a clear decision use case emerges
(e.g., swap-timing prompt fragments that need session VWAP context).

---

## Q6 — Production verification of 5B-prep propagation

### 6.1 — Has voice-layer-cache run since 5B-prep merged?

Yes — **inference from schedule, not direct observation.**

- Merge: 2026-05-12 11:29 Central = **16:29 UTC** (commit `c5b0df5`, PR #401).
- Cron schedule: `*/15 13-20 UTC * * 1-5` (`vercel.json:143`).
- Today is Tuesday (2026-05-12). The cron should have run at 16:30, 16:45,
  17:00, 17:15, ... UTC after the merge.

By Vercel cron semantics, the cron picks up the latest deployed code on
its next tick after deployment. Assuming the merge triggered a normal
deploy, the post-5B-prep code path was active for the 16:30 UTC tick or
the 16:45 UTC tick.

### 6.2 — Can production briefs in Firestore be verified?

**Not from this discovery agent.** This environment has no Firestore
read access and no shadow-log dump in the repo. Verification requires:

- Vercel Logs (cron run output for `voice-layer-cache`), or
- Firestore Console (`voiceLayerCache/{battleId}` doc snapshot), or
- An admin endpoint that returns the cached briefs

Recommend the implementer **run this check before merging 5B-main**, since
the post-5A dormancy was the exact failure mode 5B-prep was meant to
solve — confirming the fix is the cheapest possible insurance against
shipping a second dormancy.

### 6.3 — Are Phase 5A's Signals and Levels lines appearing in production?

**Same answer:** can't observe directly. The code path is in place
(`voiceLayerPrompt.js:1134-1138`), the cron writer is populating the
required fields (`voice-layer-cache.js:189-223`), and the integration
tests at `voiceLayerPrompt.test.js:1713+` lock the rendering in CI. So
the prediction is "yes, both lines render when their predicates fire" —
but actual production observation isn't available to this agent.

### 6.4 — Status

**Verify before 5B-main merge.** Add to the 5B-main merge checklist:

- [ ] Pull one recent `voiceLayerCache/{battleId}` doc.
- [ ] Confirm `portfolioBriefs[].nr7Flag` is a literal boolean.
- [ ] Confirm `portfolioBriefs[].nearestSupport`, `nearestResistance`,
      `distanceToSupportPct`, `distanceToResistancePct`, `distTo52wkHigh`
      are numbers (or `null`, never `0`).
- [ ] Confirm `portfolioBriefs[].divergence` is one of
      `'bullish'|'bearish'|'none'|null`.
- [ ] Confirm `portfolioBriefs[].lastCandlePattern` is a snake_case
      string or null.
- [ ] Confirm `portfolioBriefs[].intraday` either has the four-field
      shape or is `null`.
- [ ] (Optional) Sample one recent Voice Layer chat to see whether the
      Signals/Levels lines appeared in the constructed prompt.

If any check fails, surface as a 5B-prep follow-up before adding the
intraday line on top.

---

## Synthesis

Phase 5B-main should implement **a CONDITIONAL `buildIntradayLine`
helper** rendering the format:

> `Intraday: 0.7% above session VWAP, 0.1% above 5m SMA20.`

(Sign rendered as `above`/`below`; magnitude as `.toFixed(1)`%; segments
independently gated.)

with the predicate **"emit when at least one numeric component is
present"** (each segment self-gates on `typeof === 'number'`; helper
returns `null` when no segment fires — matches `buildSignalsLine`
conventions).

The helper adds **one new line** to `buildPortfolioBriefsBlock` (inserted
between the Signals line and the BaggerBomb/Threshold block, preserving the
current header → trend → momentum → levels → signals → scoring order).

DATA_CONFIDENCE_RULE intraday clause (inserted between the existing
"interpret raw indicators qualitatively..." clause and the "Never invent
numbers..." closer):

> Intraday signals (session VWAP, 5-min SMA20) describe today's session positioning — paraphrase as "holding above session VWAP" or "session momentum is constructive," not the exact deviation percentage.

Bench intraday: **No** — out of scope for 5B-main. The cron-side cost (doubled
intraday fetch payload) outweighs the secondary swap-timing signal. Keep as
a possible Phase 5C+ enhancement if a clear use case emerges.

Production verification of 5B-prep propagation: **Cannot be observed
from this discovery agent.** Code path is in place and locked by CI tests;
recommend the implementer pull one recent `voiceLayerCache` doc and
verify field types before merging 5B-main (checklist above in §6.4).

---

## Open design questions

1. **Sign convention.** The proposed format uses `"0.7% above"` /
   `"0.7% below"` (unsigned magnitude + prose direction). The Levels line
   uses `"(-1.76%)"` (signed parenthetical). Both are defensible. The prose
   form matches the DATA_CONFIDENCE_RULE paraphrasing intent more directly;
   the parenthetical form matches the Levels-line idiom. Lean toward prose,
   but explicit confirmation worth a sentence in the implementation prompt.

2. **Zero/near-zero deviation handling.** When `|vwapDeviation| < some
   epsilon` (e.g., `< 0.05`), should the segment render as
   `"at session VWAP"` (omit the number) or as `"0.0% above session VWAP"`
   (literal render)? The "at" form reads better; the "0.0% above" form is
   more uniform. Implementation can defer this to "literal render" and
   revisit if production prompts show awkward 0.0% lines. Not a blocker.
