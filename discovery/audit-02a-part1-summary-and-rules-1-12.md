# Audit 02a — Part 1: Summary + Rules 1–12 (Decision Framework)

**Scope:** Behavioral-rule inventory of the Haiku mid-battle evaluation prompt. Split into 4 parts to avoid write timeouts.

**Sources:**
- `api/_utils/agentEvalPromptAssembly.js:21–205` — `buildEvalSystemPrompt()` (main system prompt).
- `api/_utils/agentEvalPromptAssembly.js:215–295` — `buildAgentIdentityBlock()` (identity + Forge Rules block).
- Cross-reference only: `api/cron/agent-evaluate.js:858–864` (the single code-level regime branch — distressed swap-in block).

## Executive summary

- **37 behavioral rules** encoded in prompt prose; **1** code-level branch.
- Rules distribute across 8 labeled blocks: Decision Framework (12), Intraday Momentum Signals (4), Regime-Aware Strategy (9), Risk Status (3), Forge Rules (3), Anti-Thrash (3), Survival Mode (1), Institutional Lag (1 conditional) + Forge trade checklist (1).
- 3 additional meta blocks (Status Feed, Trade Reasoning, Inner Monologue Format) are output-format instructions — catalogued but not counted in the 37.
- Proposed-regime coverage (R1–R7) is uneven: **R1 Bonus Lock-In** and **R2 Bust Defense** are well-represented via Threshold Proximity + Survival Mode. **R3 Endgame** is only implicit in the time-bucket rules. **R4 Catch-Up** and **R5 Protect Lead** have no dedicated rules today — head-to-head score state is **absent** from the current prompt. **R6 Rule-Directive Conflict** is addressed by Survival Mode + Forge precedence. **R7 Normal Optimization** is the default fallback.
- Known contradictions / ambiguities: 5 (detailed in Part 4).

## Rules 1–12 — Decision Framework block

**Source location:** `api/_utils/agentEvalPromptAssembly.js:41–88` (heading `━━━ DECISION FRAMEWORK ━━━`).

### Rule 1 — DEFAULT TO HOLD

- **Quote** (lines 43–45): "DEFAULT TO HOLD. You need a compelling, data-backed reason to trade. Most evaluations should result in HOLD. Trading is expensive — the incoming asset resets to 0 points and needs time to earn bonuses."
- **Classification:** `meta` + `risk_management` (baseline disposition, not triggered by game state).
- **Trigger:** always-on baseline.
- **Action:** prefer HOLD absent positive evidence.
- **R-map:** R7 (Normal Optimization) — default baseline. Active under every regime.

### Rule 2a — Don't sell a winner with intact momentum

- **Quote** (lines 47–49): "Do NOT sell a winner just to 'bank' positive points if its momentum is intact and it has room to earn the next threshold bonus."
- **Classification:** `threshold_proximity` + `risk_management`.
- **Trigger:** `priceChange > 0 && momentumIntact && !atNextThreshold`.
- **Action:** prefer HOLD; do not swap out winner.
- **R-map:** R1 (Bonus Lock-In) — the anti-premature-exit flavor; also R7.

### Rule 2b — Don't hold a bleeding loser if bench has better forward EV

- **Quote** (lines 50–52): "Do NOT hold a bleeding loser just to avoid locking in a loss. If the stock is falling and the bench alternative has better forward EV, cut the loser and move on."
- **Classification:** `risk_management` + `conflict_resolution`.
- **Trigger:** `priceChange < 0 && existsBench(forwardEV > heldForwardEV)`.
- **Action:** SWAP out the loser.
- **R-map:** R2 (Bust Defense) when near penalty; R7 otherwise.

### Rule 2c — Ask forward-EV question

- **Quote** (lines 53–54): "Ask: 'Over the remaining battle time, which asset will earn MORE points from this moment forward?'"
- **Classification:** `meta` (reasoning instruction).
- **Trigger:** always-on reasoning frame.
- **Action:** frame decisions as forward-EV comparison.
- **R-map:** R7 baseline — applies under all regimes.

### Rule 3 — Relative strength vs macro benchmarks

- **Quote** (lines 56–59): "RELATIVE STRENGTH: Compare asset performance to the MACRO BENCHMARKS. A stock that is down 1% on a day the market is down 3% is showing strength — it is outperforming. Do not panic-sell outperformers. A stock that is flat on a day the market is up 2% is showing weakness."
- **Classification:** `market_regime` (uses SPY/QQQ deltas as comparison).
- **Trigger:** always-on frame; activates when signed(stockPct) differs from signed(macroPct).
- **Action:** do not panic-sell relative outperformers; flag relative underperformers as weak.
- **R-map:** R7 — applies everywhere; feeds R2 (cutting weakness) and R1 (holding strength).

### Rule 4a — Clock: Early battle (>60% time remaining)

- **Quote** (line 64): "Early battle (>60% time remaining): Swaps have full runway. Offense OK."
- **Classification:** `time_clock`.
- **Trigger:** `timeRemainingPct > 60`.
- **Action:** offense permitted; swaps OK on normal conviction.
- **R-map:** R7.

### Rule 4b — Clock: Mid battle (30–60% remaining)

- **Quote** (line 65): "Mid battle (30-60% remaining): Only swap on strong conviction (>80%)."
- **Classification:** `time_clock`.
- **Trigger:** `30 <= timeRemainingPct <= 60`.
- **Action:** swap only if `conviction > 80`.
- **R-map:** R7 with R3 tilt.

### Rule 4c — Clock: Late battle (<30%)

- **Quote** (lines 66–68): "Late battle (<30% remaining): Swaps are DEFENSIVE ONLY — cut a position approaching Bust/Crash to protect banked points. Do NOT chase momentum late."
- **Classification:** `time_clock` + `risk_management`.
- **Trigger:** `timeRemainingPct < 30`.
- **Action:** swaps allowed only to cut losers near penalty; no offensive swaps.
- **R-map:** R3 (Endgame) — the clearest R3 anchor in the prompt; overlaps with R2 when penalty proximity also holds.

### Rule 5 — Tier impact / prefer Support swaps

- **Quote** (lines 70–73): "TIER IMPACT AWARENESS: Star swaps affect score at 2.0x — high reward but high cost if wrong. Support swaps are low-impact (1.0x) — safer to experiment. Prefer swapping in Support tier unless the case for Star is overwhelming."
- **Classification:** `risk_management`.
- **Trigger:** any swap decision.
- **Action:** bias swap selection toward Support tier; require overwhelming case for Star.
- **R-map:** R7; applies under every regime. (Note conflict with Rule 24/S5 — Part 2.)

### Rule 6a — Threshold proximity: near positive bonus → HOLD

- **Quote** (lines 76–77): "If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD. Let it earn the bonus."
- **Classification:** `threshold_proximity`.
- **Trigger:** `direction == 'positive' && (nextBonus.mult - currentMultiplier) <= 0.2`.
- **Action:** HOLD the position — hard guidance.
- **R-map:** **R1 (Bonus Lock-In) — primary anchor.**

### Rule 6b — Threshold proximity: near negative penalty → consider cut

- **Quote** (lines 78–79): "If an active stock is within 0.2x ATR of a penalty (-10/-20/-35), seriously consider cutting it before the penalty locks in."
- **Classification:** `threshold_proximity` + `risk_management`.
- **Trigger:** `direction == 'negative' && (currentMultiplier - nextPenalty.mult) <= 0.2`.
- **Action:** bias toward SWAP to cut the position.
- **R-map:** **R2 (Bust Defense) — primary anchor.**

### Rule 7 — Sector awareness / diversification rotation

- **Quote** (lines 81–83): "SECTOR AWARENESS: Do not swap a bleeding stock for a bench stock in the same sector — if the sector is weak, the replacement will bleed too. Rotate into a different sector for diversification."
- **Classification:** `market_regime` (sector-level) + `conflict_resolution`.
- **Trigger:** `swapUnderConsideration && sector(out) == sector(in) && sectorWeak`.
- **Action:** reject same-sector replacement; pick different sector.
- **R-map:** R2 context (when rotating out of a loser); R7 otherwise. **Requires sectorDrift data** (audit 01 flagged this gap).

### Rule 8 — Conviction threshold (<70% → MUST HOLD)

- **Quote** (lines 85–88): "CONVICTION THRESHOLD: If your conviction for a SWAP is below 70%, you MUST output decision 'HOLD'. Use your rationale to explain why you were tempted but lacked the conviction to pull the trigger. Marginal edges are not worth the cost of resetting a scoring baseline."
- **Classification:** `meta` + `risk_management`.
- **Trigger:** `swap && conviction < 70`.
- **Action:** force HOLD; explain in rationale.
- **R-map:** R7 baseline. **Ambiguous interaction** with Market Posture `selective` (>80% threshold, Rule 18) — see Part 4.

## Part 1 → Part 2 handoff

Part 2 covers rules 13–25 (Intraday Momentum Signals + Regime-Aware Strategy blocks). Key things to carry forward:

- Rules 6a/6b, 4c, 8 are the existing R1/R2/R3 anchors.
- No rule so far references opponent score → R4/R5 remain uncovered at this point.
- Rule 5 (prefer Support) will likely collide with S5 News-Catalyst (Rule 24) which forces Star/Core assignment.
