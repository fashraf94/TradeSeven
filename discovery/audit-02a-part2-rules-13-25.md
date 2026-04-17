# Audit 02a — Part 2: Rules 13–25 (Intraday Momentum + Regime-Aware Strategy)

**Source location:** `api/_utils/agentEvalPromptAssembly.js:90–136`.

## Rules 13–16 — Intraday Momentum Signals block

Heading: `━━━ INTRADAY MOMENTUM SIGNALS ━━━` (lines 90–102).

### Rule 13 — VWAP deviation significance threshold

- **Quote** (lines 94–95): "VWAP DEVIATION: Price above VWAP = intraday bullish momentum. Price below VWAP = intraday bearish momentum. Deviation >1.5% is significant."
- **Classification:** `market_regime` (intraday momentum signal).
- **Trigger:** `abs(vwapDeviationPct) > 1.5`.
- **Action:** treat as intraday momentum signal (bullish if above, bearish if below); affects swap-in/swap-out thesis.
- **R-map:** R7 — applies everywhere as an input; supports R2 when below VWAP and falling.

### Rule 14 — BB squeeze on active holding = patience

- **Quote** (lines 96–99): "BOLLINGER BANDWIDTH PERCENTILE: Low percentile (≤20th) = 'squeeze' — volatility contracted, breakout likely. High percentile (≥80th) = expanded volatility. Squeezes on your active holdings suggest patience (breakout coming)."
- **Classification:** `market_regime` + `risk_management`.
- **Trigger:** `bBandwidthPercentile[activeSymbol] <= 20`.
- **Action:** prefer HOLD the active position; don't swap out during squeeze.
- **R-map:** R1 (Bonus Lock-In) adjacent — "don't exit before breakout"; R7.

### Rule 15 — BB squeeze on bench stock = swap opportunity

- **Quote** (line 99): "Squeezes on bench stocks suggest swap opportunity (catch the breakout)."
- **Classification:** `market_regime`.
- **Trigger:** `bBandwidthPercentile[benchSymbol] <= 20`.
- **Action:** flag bench symbol as swap-in candidate.
- **R-map:** R7; also feeds R4 (Catch-Up) when offense is warranted, but R4 is not invoked in prompt.

### Rule 16 — NR7 — don't swap out unless bleeding

- **Quote** (lines 100–102): "NR7 (Narrowest Range 7 Days): When flagged, the stock's daily range is the tightest in 7 days. This is a volatility contraction pattern — often precedes a sharp directional move. Do NOT swap out NR7 stocks unless they're bleeding."
- **Classification:** `market_regime` + `risk_management`.
- **Trigger:** `nr7Flag[activeSymbol] === true && !bleeding(activeSymbol)`.
- **Action:** HOLD — do not swap out.
- **R-map:** R1 adjacent (protect potential breakout); R7. **Ambiguity:** "bleeding" is not defined in the prompt — see Part 4.

## Rules 17–25 — Regime-Aware Strategy block

Heading: `━━━ REGIME-AWARE STRATEGY ━━━` (lines 104–136). Opens with (line 106): "Your decisions should adapt to the current market posture and per-stock regimes:"

### Rule 17 — Market posture: risk_on

- **Quote** (line 109): "risk_on: Offense permitted. Swaps for upside OK. Full conviction range."
- **Classification:** `market_regime` (market-wide posture).
- **Trigger:** `marketPosture === 'risk_on'`.
- **Action:** allow offensive swaps; conviction threshold is the standard 70% (Rule 8), not raised.
- **R-map:** R7 with R4 tilt (when behind on score, offense permitted).

### Rule 18 — Market posture: selective (≥80% conviction required)

- **Quote** (line 110): "selective: Moderate caution. Only swap on >80% conviction. Prefer relative strength."
- **Classification:** `market_regime` + `meta` (raises conviction bar).
- **Trigger:** `marketPosture === 'selective'`.
- **Action:** swap only if `conviction > 80`; prefer symbols showing relative strength.
- **R-map:** R7. **Contradiction candidate** with Rule 8 (70% global floor) — see Part 4.

### Rule 19 — Market posture: defensive

- **Quote** (line 111): "defensive: Capital preservation. Swaps are defensive only (cut losers). Do not chase."
- **Classification:** `market_regime` + `risk_management`.
- **Trigger:** `marketPosture === 'defensive'`.
- **Action:** only allow swaps that cut losing positions; forbid momentum-chasing swaps.
- **R-map:** R2 tilt (cut losers); R5 tilt (protect lead). Overlaps with Rule 4c (Late battle defensive-only).

### Rule 20 — Stock regime: directional_expansion

- **Quote** (lines 114–118): "directional_expansion: Strong trend + volume. Strategies: S1 Volatility Squeeze Breakout (BB squeeze + volume surge + price above upper BB). S2 52-Week High Breakout (within 5% of 52W high + volume > 1.2x + intraday range position > 80% to confirm buyers driving breakout, not just tagging resistance). Hold winners. Do not fight the trend."
- **Classification:** `market_regime`.
- **Trigger:** `stockRegime === 'directional_expansion'`.
- **Action:** HOLD winners in this regime; apply S1/S2 strategy templates when evaluating new entries.
- **R-map:** R1 adjacent (hold winners); R7.

### Rule 21 — Stock regime: directional_contraction

- **Quote** (lines 119–121): "directional_contraction: Quiet uptrend. Strategy: S3 RS Momentum + VWAP Pullback (RS > 80th percentile + pullback to VWAP + 5min RSI bouncing off 40). Hold, tighten expectations."
- **Classification:** `market_regime`.
- **Trigger:** `stockRegime === 'directional_contraction'`.
- **Action:** HOLD; lower expected-gain threshold.
- **R-map:** R7.

### Rule 22 — Stock regime: choppy (avoid swapping INTO)

- **Quote** (lines 122–124): "choppy: No clear direction. Strategy: S4 VWAP Mean Reversion only (deviation > 1 std below VWAP + 5min RSI < 25 recovering). Avoid swapping INTO choppy stocks."
- **Classification:** `market_regime`.
- **Trigger:** `stockRegime[candidate] === 'choppy'`.
- **Action:** reject swap-in candidate unless S4 mean-reversion setup present.
- **R-map:** R7. **Contradiction candidate** with Rule 24 (S5 cross-regime) — see Part 4.

### Rule 23 — Stock regime: distressed (STRICT EXCLUSION)

- **Quote** (lines 125–126): "distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed stocks. If held, evaluate for swap-out immediately."
- **Classification:** `market_regime` + `risk_management`.
- **Trigger:** `stockRegime === 'distressed'` (per-symbol).
- **Action:** do not swap in; swap out if currently held.
- **R-map:** R2 tilt (when the distressed symbol is near a penalty).
- **Enforcement:** **This is the one code-level branch** — `api/cron/agent-evaluate.js:858–864` blocks SWAP when `stockRegimes[haikuResult.symbolIn] === 'distressed'` regardless of Haiku's prompt compliance.

### Rule 24 — S5 News-Catalyst Momentum (cross-regime)

- **Quote** (lines 128–134): "S5 News-Catalyst Momentum (Star/Core tier): When a FantasyTimes story with positive sentiment tags a stock AND volume ratio > 1.2x AND 5-min price breaks above previous day's high AND price is above VWAP → strong entry signal. Assign to Star if ATR High/Extreme, Core if ATR Normal. Exit when 5-min RSI > 85 then drops below 80 (hype exhaustion) OR a negative FantasyTimes story appears on the ticker. Applies across ALL regimes except Distressed."
- **Classification:** `market_regime` + `conflict_resolution` (explicitly cross-cuts other regimes).
- **Trigger:** `positiveNewsStory && volRatio > 1.2 && break(prevDayHigh) && price > VWAP && stockRegime !== 'distressed'`.
- **Action:** strong swap-in signal; force Star assignment if ATR high/extreme, Core if normal.
- **R-map:** R4 adjacent (aggressive entry when offense is warranted); R7. **Contradictions** with Rule 5 (prefer Support) and Rule 22 (avoid swapping into choppy) — see Part 4.

### Rule 25 — NR7 priority for S1 (Squeeze Breakout)

- **Quote** (line 136): "NR7-flagged stocks get priority consideration for Squeeze Breakout strategy (S1)."
- **Classification:** `market_regime`.
- **Trigger:** `nr7Flag[candidate] === true`.
- **Action:** rank as priority candidate under S1 (directional_expansion regime).
- **R-map:** R7.

## Part 2 → Part 3 handoff

Part 3 covers rules 26–35 (Risk Status + Forge Rules + Anti-Thrash + Survival Mode blocks). Key things to carry forward:

- Rule 23 `distressed` is the only rule with a code-level enforcement backstop (`agent-evaluate.js:858`).
- Rules 20–25 give per-regime prose guidance — this is the raw material that must be reproduced by R1–R7 if the new design replaces regime-based prompting.
- Conviction thresholds now have **two stackable raises**: Rule 4b Mid-battle (80%) and Rule 18 selective posture (80%). When both apply, the floor is 80% — but the prompt doesn't say whether they compound or take the max. See Part 4.
- No rule in the block references opponent score → R4/R5 still uncovered.
