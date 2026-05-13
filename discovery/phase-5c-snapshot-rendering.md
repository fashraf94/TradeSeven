# Phase 5C Discovery — Snapshot Rendering in Review Mode

**Status:** Read-only discovery. No production code touched.
**Branch:** `claude/snapshot-rendering-review-mode-dQz88` (cut from `main`).
**Scope:** Inventory snapshot schema, characterize `buildReviewContext`, design a rendering pattern that surfaces Phase 4 technical snapshots to Gemma during Review chats — without producing implementation code.

---

## Q1 — Snapshot Schema Full Inventory

### 1.1 Complete output structure of `buildTechnicalSnapshot`

Source: `api/_utils/buildTechnicalSnapshot.js:23-114`. Pure function. Every leaf nullable; sub-objects always present (no missing branches — readers can safely traverse one level deep).

**Top-level fields:**

| Field | Type | Source | Notes |
|---|---|---|---|
| `symbol` | string | argument | Never null at top level. |
| `sectorName` | string \| null | `ranking.sectorName` | Sector display name. |
| `capturedAt` | ISO 8601 string | `new Date().toISOString()` | Set fresh on every call. Required for regime detection. |

**Nested categories:**

```
trend: { shortTerm, intermediate, longTerm }         // string | null direction labels ('up'/'down')
momentum: { rsi, macdAboveSignal, macdFreshBullishCross, macdFreshBearishCross,
            macdHistogram, divergence, upDayVolRatio }
volatility: { bbPercentB, bbUpper, bbLower, bBandwidthPercentile, atrPercent }
volume: { avgVolume, ratio, tier, nr7Flag, dailyRange }
smaStack: { aboveSMA20, aboveSMA50, aboveSMA200, sma200_position, distTo52wkHigh }
rs: { rsPercentile, sectorRSPercentile }
levels: { nearestSupport, nearestResistance,
          distanceToSupportPct, distanceToResistancePct }
pivots: object | null                                // entire ranking.pivots passed through unchanged
recentAction: { lastCandlePattern }                  // snake_case key
intraday: { vwap, currentPrice, vwapDeviation, sma20_5m, sessionDate }
composite: { technicalScore, technicalRank,
             sectorTechnicalRank, sectorTechnicalTotal }
```

**Nullability:** All leaves use the `?? null` coalescer. Booleans (`macdFresh*Cross`, `nr7Flag`, `aboveSMA*`) are `boolean | null` (NOT default-false — null when source data is missing).

**`pivots`** is unique: the *entire* sub-object is passed through (`ranking.pivots ?? null`). Tests show shape `{ r1, s1, ... }` but the snapshot writer doesn't enforce keys; reader must defensively probe.

### 1.2 Brief vs. snapshot field comparison

Source: cross-reference `voice-layer-cache.js:193-279` (portfolio brief) and `:394-432` (bench brief) against `buildTechnicalSnapshot.js:36-113`. Phase 5B-prep audit Finding 5.3 already itemized the access-path delta — extending it with full coverage below.

**Brief fields present in snapshots (same physical field, different path):**

| Concept | Brief path (flat) | Snapshot path (nested) |
|---|---|---|
| Symbol | `brief.symbol` | `snapshot.symbol` |
| Sector name | `brief.sector` | `snapshot.sectorName` |
| Sector technical total | `brief.sectorTechnicalTotal` | `snapshot.composite.sectorTechnicalTotal` |
| Technical score | `brief.technicalScore` | `snapshot.composite.technicalScore` |
| Technical rank | `brief.technicalRank` | `snapshot.composite.technicalRank` |
| RS percentile | `brief.rsPercentile` | `snapshot.rs.rsPercentile` |
| ATR % | `brief.atrPercent` | `snapshot.volatility.atrPercent` |
| Nearest support | `brief.nearestSupport` | `snapshot.levels.nearestSupport` |
| Nearest resistance | `brief.nearestResistance` | `snapshot.levels.nearestResistance` |
| Distance to support | `brief.distanceToSupportPct` | `snapshot.levels.distanceToSupportPct` |
| Distance to resistance | `brief.distanceToResistancePct` | `snapshot.levels.distanceToResistancePct` |
| Distance to 52wk high | `brief.distTo52wkHigh` | `snapshot.smaStack.distTo52wkHigh` |
| NR7 flag | `brief.nr7Flag` | `snapshot.volume.nr7Flag` |
| MACD fresh bullish | `brief.macdFreshBullishCross` | `snapshot.momentum.macdFreshBullishCross` |
| MACD fresh bearish | `brief.macdFreshBearishCross` | `snapshot.momentum.macdFreshBearishCross` |
| Divergence | `brief.divergence` | `snapshot.momentum.divergence` |
| Last candle pattern | `brief.lastCandlePattern` | `snapshot.recentAction.lastCandlePattern` |
| Intraday block | `brief.intraday.*` | `snapshot.intraday.*` (same leaf names — only outer key differs) |

**Brief fields absent from snapshots** (live-state / operational, not captured at decision time):

- `brief.changePercent` — relative to prior close, snapshot has `current` price but no `previous`.
- `brief.price` — raw current price absent at top level (lives only in `intraday.currentPrice`, which is null for bench symbols).
- `brief.tier` / `brief.assetClass` — slot-state, not symbol-state.
- `brief.trendSummary` / `brief.momentumSummary` — prose synthesized by cron; snapshot has raw `trend.{shortTerm,intermediate,longTerm}` + raw momentum factors but no prose layer.
- `brief.thresholdNote` — BaggerBomb threshold prose.
- `brief.thresholdProximity` — live multiplier + redZone + swapLock state.
- `brief.existingBadges` — accumulated battle state.
- `brief.cooldownUntil` / `brief.cooldownActive` — bench-specific operational state.

**Snapshot fields absent from briefs:**

- `snapshot.capturedAt` — decision-time anchor, snapshot-only by definition.
- `snapshot.trend.{shortTerm,intermediate,longTerm}` — raw direction labels (briefs paraphrase as `trendSummary`).
- `snapshot.momentum.rsi`, `momentum.macdAboveSignal`, `momentum.macdHistogram`, `momentum.upDayVolRatio` — briefs absorb these into `momentumSummary` prose.
- `snapshot.volatility.bbPercentB`, `bbUpper`, `bbLower`, `bBandwidthPercentile` — briefs don't surface Bollinger fields.
- `snapshot.volume.avgVolume`, `volume.ratio`, `volume.tier`, `volume.dailyRange` — briefs hide all of these.
- `snapshot.smaStack.aboveSMA20/50/200`, `smaStack.sma200_position` — booleans absent from briefs.
- `snapshot.rs.sectorRSPercentile` — briefs surface only the broad rsPercentile.
- `snapshot.pivots` (entire object).
- `snapshot.composite.sectorTechnicalRank` — briefs show only the broad rank.

### 1.3 Same-named fields with shifted semantics

- **`intraday.sessionDate`** — added in commit `9bae3c0` (Fix v2 backlog bundle, 2026-05-13 03:57 UTC). Identical semantics in briefs and snapshots: latest ET date present in the EODHD intraday response. Brief-side propagation verified in `voice-layer-cache.js:279`.

- **`intraday.vwap`** — semantic shift across the three snapshot regimes (see Q3). Same field, different meaning depending on `capturedAt`. This is the central asymmetry Phase 5C must handle.

- **`intraday.currentPrice`** — same definition in both, but in snapshots it's the canonical price reference for that symbol at capture time (no `brief.price` analog in the nested intraday block).

- No other same-named fields shifted meaning between brief and snapshot writers.

### 1.4 Three snapshot write paths in `agent-evaluate.js`

**Path A — Risk-triggered swap** (`:638-657`, executes via `executeSwapServer`)
- Trigger: `riskResult` returned by risk manager (stop-out, threshold breach, etc.).
- Captures: `{ symbolOut, symbolIn }`, both via `buildTechnicalSnapshot`.
- Destination: forwarded as 7th arg to `executeSwapServer` → `trades[i].snapshot`.
- Extra context: `exitReason: riskResult.reason`, `entryRegime`, `entryMarketPosture` — these live on `evaluationMetadata`, not on the snapshot.

**Path B — Autopilot Haiku-decided swap** (`:977-995`)
- Trigger: Haiku returns a SWAP decision when `mode === 'autopilot'`.
- Captures: `{ symbolOut, symbolIn }`, both via `buildTechnicalSnapshot`.
- Destination: forwarded as 7th arg to `executeSwapServer` → `trades[i].snapshot`.
- Extra context: `trade_reasoning` (Phase 8 structured reasoning) on `evaluationMetadata`.

**Path C — Co-pilot / Manual proposal** (`:1008-1024`, written onto `pendingProposal`)
- Trigger: Haiku returns a SWAP decision when `mode === 'copilot'` or `'manual'`.
- Captures: same `{ symbolOut, symbolIn }` pair via `buildTechnicalSnapshot`.
- Destination: `pendingProposal.snapshot`, which gets archived to `proposalHistory[i].snapshot` on every resolution path.
- **Two downstream forwards:** `:1305` (approved proposal → executeSwapServer → trades[i].snapshot) and `:1387` (auto-executed expired copilot proposal → executeSwapServer → trades[i].snapshot). Vetoed and lapsed proposals retain `snapshot` on `proposalHistory[i]` only.

**All three paths invoke `buildTechnicalSnapshot` identically** with the same `(symbol, { momentumData, technicalScoresMap, rankingsMap })` signature. No path captures extra fields beyond the standard snapshot shape.

**Resolution-time context (separate from `snapshot`):**
- `proposalHistory[i].scoreAtProposal` — written at proposal creation (`:1040`).
- `proposalHistory[i].scoreAtVeto`, `.vetoedAtPrice`, `.vetoedAtTimestamp` — written at veto (`:1340-1347`).
- `proposalHistory[i].scoreAtResolution` — written at auto-execution / lapse (`:1418`).

These ride alongside the snapshot but aren't part of the snapshot object itself — Phase 5C must read them from the proposal/trade wrapper, not from `snapshot.*`.

---

## Q2 — `buildReviewContext` Characterization

### 2.1 Function signature, output, position

**Signature** (`voiceLayerPrompt.js:1475`):
```js
buildReviewContext(battle, dailyReviews, dailyGrades) → string
```

**Output structure** (`:1475-1554`):

Single labeled block prefixed `REVIEW CONTEXT:`. Sections, in order:

1. **`BATCH REVIEW SUMMARY (date)`** — only if `dailyReviews` is non-empty: latest review's headline, summary, finalScore vs opponentScore, keyMoments list. Falls back to a "No consolidated review available yet" sentinel.
2. **`TRADES (n)`** — all trades from `battle.trades` (no cap), rendered as one line each: `- ${symbolOut} → ${symbolIn} [tier] — ${outcome} | ${rationale}`.
3. **`COUNTERFACTUALS (vetoed / expired proposals)`** — filter on `resolution === 'vetoed' || resolution === 'lapsed'`, then `slice(-6)` (last 6 only). Line: `- ${swap} (${resolution}) — ${counterfactual} | ${rationale}`.
4. **`USER TRADE GRADES`** — all `dailyGrades` entries, target/grade/note.
5. **`DIRECTIVE OUTCOMES`** — `slice(-5)` of `battle.liveDirectives || battle.directiveOutcomes`, "directive text — outcome (resultPoints)".

Returns `'REVIEW CONTEXT:\n' + lines.join('\n')` — always a string, never null.

**Position in the Review prompt** (`:1701-1705`):
```
[identity, GAME_MECHANICS, OUTPUT_FORMAT, partnerModel, convictions, anchor,
  (portfolioBriefs?), (benchBriefs?), (scoutAlerts?), (marketContext?), (DATA_CONFIDENCE_RULE?),
  reviewContext,   ← Block 5'
  REVIEW_FEW_SHOT,
  REVIEW_PHASE_RULES]
```

`buildReviewContext` sits as Block 5' near the bottom — between optional market-snapshot blocks and the few-shot/phase-rules tail. The bottom of the prompt is the high-attention zone, so review context is well-positioned for Gemma to anchor on.

### 2.2 Iteration over `proposalHistory` and `trades`

- **`trades`**: all of them, no slice. Line 1499-1510. If the battle is multi-day this could grow unbounded; in practice trades-per-battle is small (<30) so this is fine today.
- **`proposalHistory`**: filtered to `vetoed`/`lapsed` only, then `slice(-6)`. The `auto_executed` and `approved` resolutions are excluded — those become trades, so they're rendered in the TRADES section instead.
- **No differentiation in render depth** between counterfactuals and trades currently — both render as a one-line summary. The **snapshot field is not consulted on either path**; only the proposal/trade wrapper's flat metadata (symbolOut, symbolIn, resolution, counterfactualPoints, rationale, outcomePoints, tier, trigger) gets rendered.

This is precisely the gap Phase 5C closes: snapshots ride on `proposalHistory[i].snapshot` and `trades[i].snapshot` but are currently dropped on the floor at render time.

### 2.3 Review chat mode entry points

**Mode detection** (`api/agent/chat.js:112-120`):
```js
function detectMode(battle) {
  const marketState = getMarketState();
  const isMarketClosed = CLOSED_STATES.has(marketState.state);
  if (!isMarketClosed) return 'battle';
  const latestReview = (battle.dailyReviews ?? []).at(-1) ?? null;
  return isReviewForToday(latestReview) ? 'review' : 'battle';
}
```

Review mode activates when **both** conditions hold:
1. Market is in a closed state (`CLOSED_STATES`).
2. `battle.dailyReviews[-1]` has a `date` matching today's ET date, OR `createdAt` within the last 20 hours (`:90-110`).

**User triggers:**
- **Manual chat after close** — user opens AgentChat panel post-market, types a message → `chat.js` handler → `detectMode` returns `'review'` → `buildVoiceLayerPrompt({ mode: 'review', ... })`.
- **Auto-debrief** — `agent-batch-review.js:229-340` fires the same Review prompt with the synthetic message `'__REVIEW_START__'` and appends the response to `chatExchanges[]` with `isAutoDebrief: true`. Runs at 4:15 PM ET on weekdays.

**No sub-modes.** A single Review prompt structure is reused for both manual and auto-debrief paths. There is no "battle-specific review" vs "portfolio review" — the same `buildReviewContext` runs against whichever battle the user opened.

Budget: 5 messages/day in Review (vs. 10 in Battle mode) — `MODE_BUDGET` in `chat.js:122-125`.

---

## Q3 — Snapshot Regime Detection

### 3.1 Three regimes and their signals

| Regime | Window | `intraday.vwap` semantics | `intraday.sessionDate` |
|---|---|---|---|
| **A — Pre-Fix-v1** | 2026-05-07 → 2026-05-12 ~17:39 UTC | Multi-month aggregate VWAP, mislabeled as "session" | Field absent (key not in snapshot) |
| **B — Fix-v1-era** | 2026-05-12 ~17:39 UTC → 2026-05-13 ~04:04 UTC | `intraday.vwap` typically null (filterToCurrentSession over-filtered when EODHD's response lacked today's bars) | Field absent |
| **C — Post-Fix-v2** | 2026-05-13 ~04:04 UTC onwards | True session VWAP for the latest ET session in the EODHD response | Field present (e.g., `'2026-05-13'`) |

**Available signals on each snapshot:**

- `snapshot.capturedAt` — always present (every snapshot has it; `buildTechnicalSnapshot.js:39`). ISO 8601 timestamp. Authoritative for time-based regime classification.
- `snapshot.intraday.sessionDate` — present only in Regime C. Binary "has Fix v2 been applied?" signal.
- `snapshot.intraday.vwap` — null in B, populated in A and C (but with different semantics).
- `snapshot.intraday === null`? — not the right check. `buildTechnicalSnapshot.js:99-105` always emits `intraday: {…}` with null leaves, never `intraday: null`. So `intraday` is *always* truthy; the per-leaf checks are what matters.

### 3.2 Fix v2 merge date

Concretely:
- **PR #405 merged:** commit `2a7759f` at **2026-05-12 23:04:22 -0500 = 2026-05-13 04:04 UTC**.
- **`sessionDate` field added to `buildTechnicalSnapshot`:** commit `9bae3c0` at **2026-05-13 03:57:10 UTC** (part of the Fix v2 backlog bundle, merged in PR #405).

Treat **2026-05-13 04:04 UTC** as the Regime B → C boundary. Snapshots with `capturedAt >= 2026-05-13T04:04:00Z` are Regime C; earlier ones are A or B.

### 3.3 Fix v1 merge date

- **PR #403 merged:** commit `aa9e7a9` at **2026-05-12 12:39:11 -0500 = 2026-05-12 17:39 UTC**.
- The fix landed on `main` via merge of `a4f1ea9` (`fix(eval): apply session boundary filter before VWAP calculation`, 2026-05-12 17:31:39 UTC).

Treat **2026-05-12 17:39 UTC** as the Regime A → B boundary. Note: the Fix v1 window is narrow — ~10.5 hours — and largely covers the overnight period, so the population of Regime B snapshots may be near zero in practice (very few battles capture snapshots between 17:39 UTC = 12:39 ET on a Tuesday and 04:04 UTC = midnight ET the next day, because Phase 4 snapshots fire during evaluation runs, and live evaluation slows after close).

### 3.4 Recommended detection approach

**Hybrid — field-presence primary, date as fallback:**

```
isPostFixV2 = snapshot.intraday?.sessionDate != null
isPreFixV1  = snapshot.capturedAt && new Date(snapshot.capturedAt) < FIX_V1_MERGE_UTC
isFixV1Era  = !isPostFixV2 && !isPreFixV1
```

Where `FIX_V1_MERGE_UTC = '2026-05-12T17:39:00Z'`. (Phase 5C implementation can put this constant in a single locked location.)

**Rationale:**
- `sessionDate` presence is a clean binary that won't break if Fix v3 ever happens — any future fix to intraday will still surface a populated `sessionDate`, so "has sessionDate → trust intraday" is durable.
- The hard date constant is only consulted for the A-vs-B distinction *within the pre-Fix-v2 window*. The blast radius of the constant being off by a few minutes is low because both A and B render identically (intraday is suppressed in both — see Q5.4).
- `capturedAt` is the authoritative timestamp; it's always present and never mutated.

**Why not just `intraday.vwap != null`?** Because Regime A had populated vwap with *wrong* semantics, so a presence check would falsely admit pre-Fix-v1 snapshots into the "render this" bucket.

---

## Q4 — Decision Relevance for Review

### 4.1 What fields tell the forensic story

**For "why did the agent propose this swap?"** — the strongest signals at proposal time:
- `composite.technicalScore` + `composite.sectorTechnicalRank` — was symbolIn ranked above symbolOut in their sectors?
- `momentum.macdFreshBullishCross` / `momentum.macdFreshBearishCross` — fresh-trigger flag that drove entry timing.
- `momentum.divergence` — divergence direction at decision time.
- `levels.distanceToSupportPct` / `levels.distanceToResistancePct` — was the entry at a level?
- `recentAction.lastCandlePattern` — pattern fired immediately before the decision.
- `rs.rsPercentile` + `rs.sectorRSPercentile` — relative strength tier.
- `volume.nr7Flag` — contraction/expansion regime.
- `scoreAtProposal` (wrapper field, not snapshot field) — agent's conviction score.

**For "was this trade well-justified?"** — what matters at execution time:
- `trend.{shortTerm, intermediate, longTerm}` — was multi-timeframe alignment present?
- `composite.technicalScore` — top-quartile selection?
- `smaStack.aboveSMA50` / `aboveSMA200` — were major MAs supportive?
- `volatility.atrPercent` — was risk sized to volatility?
- `intraday.vwapDeviation` — entry vs session VWAP (post-Fix-v2 only).
- `evaluationMetadata.entryRegime` + `entryMarketPosture` (wrapper field) — macro context at execution.

**For "what did the agent miss?"** — fields that often expose missed warnings:
- `momentum.divergence === 'bearish'` while agent went long.
- `levels.distanceToResistancePct` close to 0 (entered into resistance).
- `volume.nr7Flag` true (contraction warned of imminent volatility — context dropped).
- `smaStack.sma200_position` indicating bear-stack alignment despite a long entry.

### 4.2 Live-state fields that DON'T need to render in Review

Snapshots don't carry these (by design — see Q1.2), so Phase 5C doesn't need to suppress them, but it's worth flagging that the brief-render features below have no historical analog and should NOT be invented for Review:

- `thresholdProximity` (live multiplier toward swap-lock / red zone) — operational, only meaningful while a position is open.
- `swapLock` state — operational.
- `cooldownActive` — bench-state, transient.
- `existingBadges` — battle-cumulative, not point-in-time.
- `thresholdNote` — BaggerBomb-tier prose, derived from live state.

### 4.3 Snapshot fields without brief analog worth surfacing

These are *captured at decision time only*, do not exist in briefs, and are valuable for forensic reasoning:

- **`capturedAt`** — anchors the snapshot in time. Without it, Gemma can't say "this was the read 90 minutes before the close." Should always render.
- **`scoreAtProposal` / `scoreAtVeto` / `scoreAtResolution`** (on the wrapper, not the snapshot) — agent conviction trajectory. The pair `(scoreAtProposal, scoreAtResolution)` quantifies how the read aged.
- **`trend.{shortTerm, intermediate, longTerm}`** — three-timeframe raw labels are easier for Gemma to reason about ("up/up/up still aligned at proposal, but rolled to up/up/down by close").
- **`smaStack.aboveSMA20/50/200`** — moving-average stack at decision time.
- **`rs.sectorRSPercentile`** — sector-relative read (briefs only carry broad rsPercentile).
- **`composite.sectorTechnicalRank`** — within-sector rank.

### 4.4 Desired reader experience

The Review phase rules (`voiceLayerPrompt.js:334-365`) frame Gemma as a debrief partner who **leads with the headline, walks through one trade at a time, surfaces counterfactuals naturally**. The desired snapshot-rendering experience should support:

- **Quick scan first.** When Gemma opens with the headline trade, she should be able to cite 1-2 telling snapshot fields ("score was 78 at the call, dropped to 61 by close"). This means a *compact* per-snapshot summary is the default render.
- **Detail on demand.** When user engages with a specific trade ("walk me through NVDA"), the full per-leg detail block is what Gemma reaches for. This argues for the rendering being self-contained per swap (no cross-swap aggregation) so Gemma can pull one block into focus.
- **Counterfactual depth > trade depth.** Counterfactuals (vetoed/lapsed) are the high-signal forensic moments; trades were already executed and their P&L speaks for itself. Render counterfactuals with more snapshot detail; render trades more compactly.
- **Time anchoring.** Every snapshot block should lead with `Captured: <human-readable timestamp>` so Gemma can frame "this was the read 2 hours before close, by the time it lapsed we were…"

Both "quick scan" and "detailed forensic walkthrough" are valuable. There aren't formal sub-modes today; the rendering should support both reading patterns from one fixed output by **compact-by-default per entry, with enough detail per entry to walk through when called on**.

---

## Q5 — Rendering Pattern Design

### 5.1 Helper reuse decision

**The existing `buildHeaderLine` / `buildLevelsLine` / `buildSignalsLine` / `buildIntradayLine` helpers cannot be directly applied to snapshots.** Confirmed three ways:

1. The contract comment at `voiceLayerPrompt.js:978-987` explicitly says so (added in commit `0f2034e` after the Phase 5A audit flagged the gap).
2. Brief access is flat (`brief.nr7Flag`); snapshot access is nested (`snapshot.volume.nr7Flag`). Calling `buildSignalsLine(snapshot)` reads `undefined` for every flag and silently emits nothing.
3. Many fields snapshots have (`trend.{...}`, `smaStack.{...}`, `rs.sectorRSPercentile`, `capturedAt`, `pivots`) don't exist on briefs at all, so brief helpers have no rendering logic for them.

**Three candidate approaches:**

| Approach | Pro | Con |
|---|---|---|
| **Reuse existing helpers directly** | Zero new code | Doesn't work (see above) |
| **Flatten adapter** — `flattenSnapshot(snap)` → brief-shape, then reuse | Reuses tested helpers | Loses access to snapshot-only fields (`trend.*`, `smaStack.*`, `capturedAt`); silent field renames create maintenance hazard |
| **New `buildSnapshotLeg` family** — purpose-built helpers that traverse nested structure and emit snapshot-flavored output | Explicit data path, full schema access, no hidden coupling | More code, parallel implementation risks drift |

**Recommendation:** new `buildSnapshotLeg` family. The nesting is the natural shape of the data, snapshot-only fields are first-class, and tests pin both helper families independently. The cost is a few hundred lines of helper code; the benefit is that any future snapshot schema change (Phase 4.x backlog) is a one-locality edit.

### 5.2 Rendering granularity

**Recommended: one block per swap entry (counterfactual or trade), with `symbolOut` + `symbolIn` as adjacent legs inside the block.**

```
[Counterfactual / Trade header line — swap pair, resolution, capture time, score delta]
  [symbolOut leg — 4-6 lines of compact technical readout]
  [symbolIn leg  — 4-6 lines of compact technical readout]
```

**Why not one aggregated section?** Snapshot fields are per-symbol; aggregating across swaps either drops symbol identity or duplicates labels. Per-swap blocking lets Gemma quote one entry verbatim.

**Why not a single leg (just symbolIn, since "what we entered" is the decision)?** Forensic context wants both: "we sold X with score 82, bought Y with score 68 in the same sector — that's the real story." Both legs render.

**Differentiation between counterfactuals and trades:**
- Counterfactuals get a header prefix `COUNTERFACTUAL — vetoed by Coach` / `lapsed (no Coach action)` / `auto-executed at expiry`.
- Trades get `TRADE — approved by Coach` / `executed (autopilot)` / `executed (risk-triggered)`.
- Render depth: counterfactuals **full leg detail**, trades **compact leg detail** (header + signals only). See Q6 for token-budget rationale.

### 5.3 Line structure per snapshot leg

Following the existing brief render convention (header → details), a snapshot leg should be:

```
SYMBOL — Score X (rank #N/total in Sector), RS Nth %ile, ATR N.N%
Trend: up/up/down (short/int/long)
Signals: Fresh MACD bullish cross. NR7 contraction. Bullish divergence forming.
Levels: Support $X (-2.1%), Resistance $Y (+3.4%).
Intraday: Today's session — 0.8% above session VWAP, 0.3% above 5m SMA20.
```

Each downstream line is **conditional** (gated by predicate, same pattern as Phase 5A helpers — emit nothing rather than "Signals: none"). The header line is always emitted.

**Capture-time context** rides on the per-entry wrapper line, not per-leg:

```
COUNTERFACTUAL — vetoed by Coach
  Captured: 2026-05-12 14:32 ET | Score at proposal: 72.4 → at veto: 68.1
  AAPL → MSFT  (Star tier)  |  Counterfactual: would have scored +4.2 pts
  AAPL leg:
    SYMBOL — …
  MSFT leg:
    SYMBOL — …
```

The wrapper line carries the human-readable timestamp (rendered from `capturedAt`), conviction trajectory (rendered from `scoreAtProposal` + `scoreAtVeto` / `scoreAtResolution`), and the proposal-level summary (resolution, counterfactual points).

### 5.4 Three regimes — render strategy per regime

| Regime | Intraday | Other snapshot fields | Disclaimer? |
|---|---|---|---|
| **A — Pre-Fix-v1** | **Suppress entirely** (mislabeled multi-month VWAP would mislead Gemma) | Render normally | None — silent suppression keeps the prompt clean |
| **B — Fix-v1-era** | **Suppress entirely** (intraday.vwap typically null; gating on `typeof === 'number'` already drops it, but explicit suppression is safer) | Render normally | None |
| **C — Post-Fix-v2** | **Render full intraday line** (same prefix logic as `buildIntradayLine`: today/prior based on sessionDate vs ET today) | Render normally | None |

**Why no disclaimers?** Adding "data captured before [date], may be stale" to pre-Fix-v2 snapshots invites Gemma to spend tokens speculating about data quality instead of doing the forensic work. Cleaner to silently elide unreliable fields and let the reliable fields carry the analysis. The agent reader doesn't need to know about Fix v1/v2 internals.

**Why not hide the entire snapshot for Regime A/B?** Because the non-intraday fields (trend, momentum, levels, composite, rs, smaStack) were *not* affected by the VWAP boundary bugs. They came from `stockRankings` and `stockTechnicalScores`, which are EOD-computed and never had the session-boundary issue. Throwing the whole snapshot away to hide one bad field would discard 80% of the forensic value.

**Mixed strategy per field is the right call.** Intraday is the only gated field; everything else renders unconditionally.

---

## Q6 — Token Budget and Prompt Length

### 6.1 Phase 5A/5B baseline

The Phase 5B-main intraday line adds ~17 tokens per portfolio brief; with 6 portfolio + 1-2 bench briefs, total per-cycle Voice Layer overhead from per-symbol lines is ~150 tokens. That's the operating budget reference point.

### 6.2 Review surface area

Per `buildReviewContext` today:
- Trades: all of them (no cap; usually 5-15 per battle on a multi-day battle).
- Counterfactuals: `slice(-6)` — last 6.

Phase 5C scope realistically:
- 3-5 most recent counterfactuals × full leg detail (~190 tokens each).
- 2-3 most recent trades × compact leg detail (~90 tokens each).

### 6.3 Per-snapshot-leg token estimate

| Line | Approx tokens |
|---|---|
| Wrapper header (capture time + score delta + swap pair + resolution clause + counterfactual line) | ~30 |
| Per-leg header (SYMBOL — Score, rank, RS, ATR) | ~15 |
| Per-leg trend line | ~10 |
| Per-leg signals line (variable; ~half fire) | ~10-20 |
| Per-leg levels line (variable; gated on ±10% / ±5% predicates) | ~10-15 |
| Per-leg intraday line (Regime C only) | ~15 |
| Per-leg subtotal (full detail) | **~70-85** |

**Per-swap entry (2 legs + wrapper):**
- Full detail: `30 + 2 × 80 = 190 tokens`.
- Compact detail (header + signals only, no trend/levels/intraday): `30 + 2 × 30 = 90 tokens`.

### 6.4 Aggregate Review-mode delta

With **5 counterfactuals (full) + 3 trades (compact)**:
- Counterfactuals: 5 × 190 = 950 tokens.
- Trades: 3 × 90 = 270 tokens.
- **Total added to `buildReviewContext`: ~1,220 tokens.**

For reference, today's full Review prompt is roughly 3,000-4,000 tokens (identity + game mechanics + output format + partner model + convictions + anchor + market snapshot blocks + reviewContext + few-shot + phase rules). A 1,200-token addition is a **~30% growth in prompt length** — meaningful but not prohibitive given Gemma's context window.

### 6.5 Recommendations

1. **Default to compact + tiered detail.** Counterfactuals render full; trades render compact. The user can elicit deeper detail conversationally ("walk me through that NVDA trade") rather than having the prompt pre-load everything.
2. **Cap counterfactual render at 5, trade render at 3.** Today's counterfactual cap is 6; Phase 5C should match-or-tighten, not expand.
3. **Token-cost the helper output in tests.** A test that fixes `buildSnapshotLeg(maxCaseSnapshot)` against an expected string lets future schema changes show their token cost at PR review time.
4. **Watch for context degradation.** Gemma's Review-mode few-shot is a single example (`REVIEW_FEW_SHOT`, ~250 tokens). If snapshot-rendering pushes prompt total >5,500 tokens, consider trimming the market snapshot blocks (which exist for live battle continuity but are arguably noise in Review).
5. **Threshold beyond which response quality degrades** is empirical, not theoretical — the safe-feeling band given Phase 5A/5B observations is total prompt under ~6,000 tokens. Phase 5C's 1,200-token delta keeps us inside that.

---

## Q7 — Existing Precedent and Workshop Mode Parallel

### 7.1 Workshop mode

`buildWorkshopContextBlock` (`voiceLayerPrompt.js:1334-1366`) renders **none** of the per-swap historical context. It surfaces:
- Turn count + budget.
- Previous thesis (raw JSON dump).
- Optional preloaded seed context (theme/sector/watchlist).

Workshop has no concept of `proposalHistory` or `trades` — there is no active battle, by design. The mode is forward-looking (build strategy → compile activeThesis), so snapshots simply don't enter the prompt.

**Phase 5C cannot reuse a Workshop pattern** — no analogous rendering exists there.

### 7.2 Other forensic / historical surfaces

**`agent-batch-review.js` (Haiku batch review cron, 4:15 PM ET):**
- Renders today's trades as one-line CSV-like text: ``- ${symbolOut} → ${symbolIn} (${tier}): ${lockedGainPct}% / ${lockedPoints} pts [trigger: ${trigger}]`` (`:121-123`).
- Renders today's vetoes as one-line text: ``- ${symbolOut} → ${symbolIn}: reason=${userReason}`` (`:125-127`).
- Computes counterfactuals **live** via `getStockAnalysisData(veto.symbolIn)` (`:97`) — does **not** consult `proposalHistory[i].snapshot`. The snapshot field is loaded but never rendered.
- The Haiku batch review writes `dailyReviews[i].counterfactuals` (`:208`), which `buildReviewContext` then reads for its COUNTERFACTUALS section.

**`agentReflectionUtils.js#truncateBattleHistory`:**
- Keeps all trades (`:196`) with `hypothesis`/`rationale` text-capped to 100 words. No snapshot rendering.
- This is the Sonnet-flow truncation path (reflection / consolidation). Snapshots are simply not surfaced.

**`agentEvalPromptAssembly.js#buildClosedTradesCSV` (`:1124-1142`):**
- Renders closed trades as CSV rows for the live-battle Haiku prompt. Format: `Symbol, Tier, Exit Day, Entry→Exit, Gain%, Locked Pts`. No snapshot data — just outcome numbers.

**No surface in the codebase currently renders snapshot technical-state data into any LLM prompt.** Phase 5C will be the first.

### 7.3 Codebase patterns for "this happened at time T with context X"

The dominant pattern across the codebase is **flat one-line text records**, e.g.:
- `agent-batch-review.js:121-123` — trades as CSV.
- `voiceLayerPrompt.js:1500-1525` — counterfactuals as bullet list.
- `agentEvalPromptAssembly.js:1131-1140` — closed trades as CSV with header row.

There is **no precedent for a per-entry nested rendering block** (multiple per-symbol lines under one entry header). Phase 5C would introduce this pattern. The closest analog is `buildPortfolioBriefsBlock` (`voiceLayerPrompt.js:1184-1232`) — one block per symbol, with header + Trend + Momentum + conditional Levels/Signals/Intraday/Threshold/Badges lines. **That's the structural template Phase 5C should mirror**, just driven by snapshot data instead of brief data.

---

## Synthesis

**Phase 5C should render snapshots in Review mode using per-swap-entry nested blocks (`COUNTERFACTUAL`/`TRADE` header + capture-time wrapper line + two per-leg sub-blocks) for the most recent 5 counterfactuals and most recent 3 trades.** The brief-vs-snapshot schema asymmetry is handled by **introducing a parallel `buildSnapshotLeg` helper family that traverses the nested snapshot structure directly, with no flattening adapter — keeping access paths explicit and giving snapshot-only fields (`trend.{shortTerm,intermediate,longTerm}`, `smaStack.*`, `rs.sectorRSPercentile`, `capturedAt`) first-class rendering**. The three snapshot regimes are gated by **a hybrid detector — `snapshot.intraday.sessionDate != null` as the primary post-Fix-v2 signal, with `new Date(snapshot.capturedAt) < FIX_V1_MERGE_UTC` (2026-05-12T17:39:00Z) as the fallback for distinguishing Regime A vs B** — and rendered as **suppress-intraday-silently for Regimes A and B, full intraday line for Regime C; all non-intraday fields render unconditionally across all regimes**.

**Estimated token impact:** ~190 tokens per full-detail counterfactual leg pair, ~90 tokens per compact trade leg pair. Typical Review with 5 counterfactuals + 3 trades adds ~1,220 tokens to the existing Review context — roughly a 30% prompt growth, within Gemma's context envelope.

**Recommended rendering (one counterfactual, Post-Fix-v2):**

```
COUNTERFACTUAL — vetoed by Coach
Captured: 2026-05-12 14:32 ET | Score at proposal: 72.4 → at veto: 68.1
AAPL → MSFT (Star tier) | Counterfactual: would have scored +4.2 pts
AAPL leg:
  AAPL — Score 64 (rank #18/28 in Technology), RS 52nd %ile, ATR 1.8%
  Trend: up/up/down (short/int/long)
  Signals: Bearish divergence forming.
  Levels: Resistance $182.92 (+2.2%).
MSFT leg:
  MSFT — Score 81 (rank #4/28 in Technology), RS 76th %ile, ATR 1.4%
  Trend: up/up/up (short/int/long)
  Signals: Fresh MACD bullish cross. NR7 contraction — breakout pending.
  Levels: Support $415.00 (-1.3%), 52wk high +2.8% away.
  Today's session: 0.7% above session VWAP, 0.4% above 5m SMA20.
```

### Design recommendations (7)

1. **New `buildSnapshotLeg(snap)` helper family in `voiceLayerPrompt.js`** — parallel to brief helpers; sub-helpers `buildSnapshotHeader`, `buildSnapshotTrend`, `buildSnapshotSignals`, `buildSnapshotLevels`, `buildSnapshotIntraday`. Conditional-emit convention matches Phase 5A/5B.
2. **Single entry-wrapper helper `buildSwapEntryBlock(entry, kind)`** — accepts `(proposalOrTrade, 'counterfactual' | 'trade')`, emits the wrapper header + capture-time line + two per-leg sub-blocks. This is the only function `buildReviewContext` itself needs to call.
3. **Regime detector as a small pure utility** — `detectSnapshotRegime(snapshot) → 'pre-fixv1' | 'fixv1-era' | 'post-fixv2'`. Localizes the `FIX_V1_MERGE_UTC` constant and the `sessionDate`-presence check in one tested spot.
4. **Snapshot-leg helpers return `null` when their predicate fails** — same contract as Phase 5A/5B conditional helpers. Caller does `if (line) entry += '\n' + line`. No empty-section noise.
5. **Render counterfactuals at full depth, trades at compact depth (header + signals only)** — counterfactuals carry the forensic surprise; trades' outcomes already speak for themselves in the existing TRADES section.
6. **Cap counterfactual render at 5, trade render at 3** — matches existing `slice(-6)` for counterfactuals; tightens the trade cap (currently uncapped) to prevent multi-day battles from blowing the budget.
7. **Token-cost the largest leg in a snapshot fixture test** — pin a high-coverage snapshot to an expected rendered string and an expected approximate token count. Future schema additions surface the cost diff at PR review.

### Open questions (5)

1. **What does Gemma's behavior look like with 1,200 added tokens?** The token budget projection is theoretical. A 5-10 sample empirical comparison (same battle, prompt with vs. without snapshot rendering, side-by-side Gemma responses) would calibrate whether full-depth counterfactuals add forensic value or just dilute attention.
2. **Should approved-but-now-executed proposals (`resolution === 'approved'` or `'auto_executed'`) carry their snapshot through into the TRADES section?** They already become `trades[i]` via `executeSwapServer` and have `trades[i].snapshot` populated, but currently aren't differentiated from autopilot-executed trades. Worth surfacing the "this trade started as a copilot proposal Coach approved" distinction in the trade rendering, or out of Phase 5C scope?
3. **Should the wrapper line render `scoreAtProposal → scoreAtResolution` as a delta or as both endpoints?** "Score 72.4 → 68.1" reads as a deterioration; "Score 72.4 at proposal, 68.1 at veto (Δ -4.3)" is more explicit. Either works; pick one and lock in tests.
4. **Are snapshots persisted long enough to matter for multi-day battles?** `proposalHistory` is capped at `.slice(-50)` in `agent-evaluate.js:1349,1420,1325`. For a multi-day battle generating >50 proposals, oldest snapshots are dropped before Review can see them. Is the 50-entry cap appropriate for Review's `slice(-5)` window? Probably yes — but worth verifying with a representative multi-day battle export.
5. **Should the auto-debrief (4:15 PM ET cron) and the user-initiated chat both render snapshots identically?** Currently both call `buildVoiceLayerPrompt({mode: 'review'})` so they'd get the same render. The auto-debrief opens with `__REVIEW_START__` and is bounded to a single agent turn; the user-initiated chat is a multi-turn dialogue. Same prompt is probably fine — but if budget concerns argue for cropping snapshots in the auto-debrief, that's a behavioral split worth surfacing.

---

*End of Phase 5C discovery. No production code changed.*
