# League Scoring Anomaly — Read-Only Discovery (Phase 0)

**Date:** 2026-07-18
**Branch:** `claude/league-scoring-anomaly-v6b19j` · **HEAD:** `51bc50ad` · tree clean
**Discovery preamble (BUILD_RULES §3):** `git fetch origin` run at session start. Every code citation below was read at this HEAD **this session** and is marked **VERIFIED**; forward-looking / data-dependent claims are marked **ASSUMED** or **NEEDS-DATA**. No project state was modified. Every file named in the task prompt is calibration-fenced (BUILD_RULES §1) — this is confirm-and-cite only. **No edits, no fix, HARD STOP after this report.**
**Method note:** findings were produced by direct reading plus an 11-agent read-only adversarial workflow (5 code investigators + one skeptic per hypothesis H1–H6, tasked to *refute* first). Every citation that reaches a verdict below was re-verified by hand. One investigator (client-orb) returned a malformed result and was discarded; its ground is covered by the H6 skeptic and by direct reading of `buildArenaModel.js`.

---

## ⚠️ Scope & access boundary (read first)

This session has **the repository, not the production system** — no Admin SDK, no Firestore, no EODHD key, no Vercel deploy log. The **Block A live-pod items cannot be executed here and are NOT fabricated.** What is delivered: complete **code-path forensics (Blocks B/C/D)** with `file:line` + quoted code; the **magnitude analysis** that narrows the field on the code alone; and the **exact live query** that finalizes the verdict. Per the §9 corollary, I identify **where in the banked data** the mass must live for the display to read what it reads.

| Block-A item | Needs | Here |
|---|---|---|
| A1 orb decomposition | live Firestore | **Method + prediction + query provided; NOT run** |
| A2 raw banked entries | live Firestore | **Query + what-to-flag provided; NOT run** |
| A3 duplication check | live Firestore | **Code shows it's structurally blocked; live spot-check query provided** |
| A4 EODHD recompute | live data + EODHD | **Recipe provided; NOT run** |
| A5 entry→deploy map | Vercel deploy log | **Anchored to git (fix @ Jul-15); per-entry map needs the deploy log** |

---

## Executive verdict (for the founder)

**Plain version:** The four orbs are a **faithful display of the banked numbers** — the bug is in the numbers, not the screen. On the code, **none of the six suspected "corruption" mechanisms (H1–H6) is actually present**: baselines are captured correctly, day-entries can't duplicate, the departed-leg and composite math don't double-count, and an ATR unit slip can only move small (±35) badge points. What *can* produce orbs this deep is **legitimate but unbounded accumulation on the agent half of the composite** — most of all a penalty that **re-banks every single day** an asset stays underwater, over a pod whose real age is very likely **longer than the "Day 3 of 5" it shows** (the day counter is decoupled from the calendar, and the pod sat while the banking cron was dead July 1–15). **The one query that settles it:** split each seat's orb into its *agent* part and its *user* part. The code predicts the **agent part dominates** — which would kill every user-layer theory and point the fix at the daily-penalty accumulator.

**Load-bearing facts:**
- The client renders `getWeeklyComposite` = the banked `compositePoints` snapshot (buildArenaModel.js:138; leagueTournament.js:1079-1084) — **the poison is upstream in `dailyScores…closeScores`, not the display** (H6 **CODE-REFUTED**).
- `basePoints = pctChange × 10 × tierMult` is **ATR-independent** (agentScoring.js:270 / baggerBombUtils.js:587); ATR drives only the bounded ±15/±30/±50 / −10/−20/−35 badge tiers. Four seats at −384…−2676 against *quiet legs* cannot be an ATR bug alone (H1 **magnitude-insufficient**).
- The tournament user-layer banking **was dead** (ESM crash: `baggerBombCalculator.js` extensionless `./constants`) until **fix `0f260391`, 2026-07-15 17:13 UTC**, because it rides the same cron (`snake-draft-daily-scores.js:19,20,482`) that crashed at module load. **These are the first flat6 user-banking entries the repaired path ever wrote and they are unvalidated.** The **agent** crons (`agent-evaluate.js`, `agent-daily-scores.js`) do **not** import that module — they stayed **alive**, banking a fresh badge penalty **every day**.
- **Blast radius is limited and there is a remediation window.** This is an `isTraining` pod, excluded from rank ratchet + leaderboard + bracket (tournamentAdvancement.js:282-287; tournamentLeaderboard.js:318). Even for ranked groups, a **negative** week is **absorbed** by the rank floor — floors only ratchet *up* (applyRankWeek, leagueTournament.js:828-835) — and rank ingests only at day-5 advancement (`isWeekBanked`), so at day 3 **nothing has ratcheted yet**. **But the same banking path serves ranked groups with no `isTraining` filter** (tournamentBanking.js:388) — they carry the identical signature.

### Hypothesis scorecard (on the code; final adjudication = A1)

| # | Hypothesis (as stated) | Magnitude-capable? | Code verdict | Why |
|---|---|---|---|---|
| **H1** | ATR basis/unit fires false tiers | **No** (bounded ±35/leg/day) | **REFUTED as sole cause** | Base points are ATR-independent; badges can't reach thousands |
| **H2** | Banked baseline → `startingPrices`, full drift ×N | **No** | **REFUTED** | No `startingPrices` fallback in banking; canonical policy stamps a frozen era-correct open; snapshot read **once**, never ×N |
| **H3** | Duplicate day entries double/triple-count | **No** | **REFUTED** | Read-latest model discards duplicates; sole writer + in-tx guard; dead-cron gap *under*-counts, never duplicates |
| **H4** | Departed-leg `lockedPoints` sign/double-count | **Yes (mechanism)** | **REFUTED as a *bug* (med. conf.)** | No sign error, disjoint holding periods, RECOMPUTED not incremented — but `lockedPoints` is a **real** magnitude term that explains the **seat ordering** |
| **H5** | User baseline wrong-era ×1.5 | **No** | **REFUTED** | Canonical snapshot era-correct; legacy path uses *today's* open (understates); ×1.5 only scales a legit user total |
| **H6** | Composite/orb assembly double-count | **No** | **REFUTED** | Client orb is display-only, never persists, never touches CPU seats; `computeComposite` called once server-side per day; read-latest, never summed over days |

**One-paragraph verdict.** On the code, **no H1–H6 corruption mechanism exists** — each is either structurally blocked or too small to matter. The −384…−2676 mass is most consistent with **legitimate cumulative accumulation concentrated in the AGENT half of the composite** (`agentPoints` = Σ over the pod's daily agent-battle docs of `activeScore` + Σ`lockedPoints` + `bankedBadgePoints`), driven by **(a) `bankedBadgePoints`, a daily `FieldValue.increment` accumulator that re-banks a −10/−20/−35 penalty *every day* an asset stays out of range, uncapped by the 5-day tournament length; (b) cumulative base** from each day's `startingPrices`; and **(c) Σ`lockedPoints`**, which scales with swap count and explains the activity-ordered ranking (Trend-Follower worst). This is closest to **H2's *spirit*** (cumulative drift dominates) but via the **agent daily-re-bank + base**, not the user-baseline bug H2 literally names. Because the day index is `max+1` (calendar-decoupled) and the pod sat ~2 weeks while user-banking was dead, this accumulation can exceed a 5-day envelope as a **scoring-model artifact, not necessarily a data corruption.** **The decisive test is A1:** decompose `compositePoints` into `agentPoints` vs `1.5 × totalPoints`. The code predicts `agentPoints` dominates → kills H1/H2/H5 and localizes the fix to the agent accumulators. Caveat: the panel refuted the six *stated* mechanisms; a defect outside them (or a genuine data issue) can only be surfaced by the A1/A2 decomposition — that is exactly why it must be run before any fix.

---

## Block A — Data forensics (method + code-derived predictions; live run required)

**A1 — Orb decomposition (the decisive table).** The displayed orb = the latest banked `dailyScores.day{N}.closeScores[odUserId]`:

```
compositePoints = computeComposite(agentPoints, totalPoints) = agentPoints + 1.5 × totalPoints   // leagueTournament.js:662, USER_LAYER_K=1.5 :894
  agentPoints = Σ over the group's agentBattles of scoreState.currentScore                        // fetchGroupAgentScores, tournamentBanking.js:60-87
     currentScore(per daily doc) = activeScore + Σ trades[].lockedPoints + bankedBadgePoints.total  // agent-evaluate.js:689-697
  totalPoints = Σ picks (closed-leg bankedScore + live-leg score from leg baseline)                // scorePick, tournamentUserScoring.js:146-168
```

**Query (Admin SDK, read-only):**
1. `tournamentGroups/{podId}` → `dailyScores` (all `day{N}`: `recordedDate`, `recordedAt`, `recordedBy`, `closeScores[uid].{totalPoints, agentPoints, compositePoints, picks}`), `baselinePolicy`, `canonicalOpens`, `players[].picks[].legs`, `players[].droppedPicks`, `createdAt`, `isTraining`, `startAnchor`.
2. `agentBattles where groupId == {podId}` → **per doc**: `ownerId`, `status`, `createdAt`, `portfolio.startingPrices`, `scoreState.{activeScore, bankedScore, currentScore, bankedBadgePoints.total, bankedBadgePoints.breakdown}`, `trades[].{symbolOut, entryPrice, exitPrice, lockedPoints, lockedGainPct, swapDay}`, `scoring.thresholds`.

| Seat | `agentPoints` (Σ over daily docs) | of which Σ`bankedBadgePoints` | of which Σ`lockedPoints` | of which Σ`activeScore` | `1.5 × totalPoints` (user) | `compositePoints` | **term carrying the mass** |
|---|---|---|---|---|---|---|---|
| 1 CPU Diversifier (−384.5) | | | | | | | |
| 2 User Capital Preserver (−734.0) | | | | | | | |
| 3 CPU Contrarian (−810.5) | | | | | | | |
| 4 CPU Trend Follower (−2676.5) | | | | | | | |

**Code-derived predictions per hypothesis:**
- **Leading (agent-cumulative / daily-re-bank):** `agentPoints ≈ compositePoints` (user half small); within it, **count the agentBattles docs per seat** — if it exceeds 3 (the shown day count), the pod's real age > "Day 3" and the accumulators (esp. `bankedBadgePoints`) carry that many days. Σ`bankedBadgePoints` far exceeding one day's live badge total confirms the daily re-bank as the driver.
- **H4 (ordering):** the seat spread tracks Σ`lockedPoints` (Trend-Follower many large-negative departed legs; Capital-Preserver few). Reconcile **each** `lockedPoints` against its own stored `entryPrice/exitPrice`: `≈ round(((exit−entry)/entry)×100×10) + bonus`. A mismatch = a real corruption the panel couldn't see from code.
- **H1:** `bankedBadgePoints.breakdown[day]` shows bust/crash/meltdown on a day whose move was < 1× the published ATR.
- **H2/H5 (user):** requires `1.5 × totalPoints` to dominate — predicted **not** the case. If it is, inspect `legs[].{baselinePrice, baselineSource, baselineCapturedAt, captureState}` for a wrong-era or ×split-off baseline.

**A2 — Raw banked entries.** Dump every `dailyScores.day{N}` and every agent doc's `bankedBadgePoints.breakdown[day]` with per-asset entry/close, `baseATR` used, multiplier, tier fired, base, total. **Flag any penalty tier fired on a stock whose day move was < 1× its published ATR** (H1 signature; ATR is recoverable from `scoring.thresholds[sym].threshold` on the doc / the user leg's `thresholdHistory`). **Also count agentBattles docs per seat vs the `dailyScores` day count** — a large excess is the elapsed-days-accumulation signature.

**A3 — Duplication check.** Code shows tournament day-entries **cannot** structurally duplicate in production (see D3/E). Live spot-check: enumerate `dailyScores` keys — expect sequential `day1…day{N}`, each a **distinct** `recordedDate` (ET dates ≥ Jul-16), no missing `recordedDate`; and for the agent side, no two `status:'active'` docs for one agent. A single `day{N}` snapshot should *already* equal the observed magnitude (proving it's one cumulative stamp, not a cross-day sum).

**A4 — Hand recompute (recipe).** Pick the user's AAPL Day-1 leg; pull EODHD official open/close for that ET date. Expected `pctChange = (close − legBaseline)/legBaseline × 100`; `multiplier = pctChange_fromThresholdBaseline / ((atrPercentile||0.5)×8)` (≈4.0, tournamentUserScoring.js:99-102); expected points `= round(pctChange × 10 × 1.0) + Σ tier`. Compare to stored `closeScores…picks[AAPL]`. Base-off → baseline (H2/H5); tier-off → ATR (H1).

**A5 — Timestamps vs deploys.** The ESM fix `0f260391` deployed **no earlier than 2026-07-15 17:13 UTC**; **every flat6 user-banking entry must post-date it** (they are the first). Cross-check `agentBattles[].createdAt` against the Tue–Fri deploy cadence to establish the pod's real age (the elapsed-days fork). **Pushed ≠ deployed — confirm against the Vercel deploy log (unavailable here).**

---

## Block B — Server banked-scorer code path (VERIFIED unless noted)

**B1 — ATR resolution.**
- *User layer:* `baseATR = resolveBaseATR(pick.symbol, atrPercentiles) ?? (isCryptoSymbol ? 5.0 : 2.5)` — **tournamentBanking.js:188-189**; `resolveBaseATR = (atrPercentiles[SYM]||0.5)×8` (~4.0) or **null** on store-miss — **tournamentUserScoring.js:99-102**; `loadAtrPercentiles` returns **null on any failure** — **:64-85** [VERIFIED]. **Units** consistent (percent/percent). **Risk (H1, bounded):** a silent store-load failure drops symbols to **2.5**, inflating multipliers ~1.6× and firing false tiers — but only on **badge** points (≤ −35/leg/day), so magnitude-insufficient alone.
- *Agent layer:* `baseATR = thresholds[sym]?.threshold || asset.baseATR || 2.5`, **frozen on the doc** at creation (buildThresholds, decide.js:820-826) — not re-resolved, so it doesn't share the user path's store-load fragility. **`baseATR` feeds ONLY the multiplier→badges; `basePoints` is ATR-independent** — **agentScoring.js:262-270**, byte-identical to `calculateAssetScoreV3` — **baggerBombUtils.js:578,587** [VERIFIED].

**B2 — Baseline resolution.**
- *User layer:* a null baseline settles from the **frozen `canonicalOpens` snapshot** (canonical policy) — **tournamentBanking.js:196-226** — or **today's fresh `quote.open`** (legacy) — **:231-232**. **There is NO `startingPrices` fallback** (grep: 0 hits in tournamentBanking) [VERIFIED]. `LEAGUE_CANONICAL_OPEN_CAPTURE = true` — **featureFlags.js:260** [VERIFIED], so pods created under it carry `baselinePolicy: CANONICAL_OPEN`, and the snapshot is captured **once per symbol, immutable** (canonicalOpen.js:121) by the sweep that runs in the **alive** cron — **agent-evaluate.js:82,182 (`runCanonicalOpenSweep`)** [VERIFIED]. **Consequence:** user baselines were stamped **era-correctly** even while user-banking was dead — refuting the "stale baseline" premise of H2/H5. *(Confirm this pod's `baselinePolicy` in A1 — NEEDS-DATA.)*
- *Agent layer (cumulative model):* base measured from `entryPrice = swapPrice || startingPrices[sym]` — **agent-evaluate.js:589,599**; `swapPrice` cleared nightly (agent-daily-scores.js:162-167). But each tournament day is a **fresh 1-day battle doc re-based to that day's open** (`fetchValidatedStartingPrices`, `forceRefresh` — **decide.js:771-802,1137,1149**), prior day completed (decide.js:1091-1120), so per-doc base = ≤1 day drift and the cross-doc sum is **legitimate cumulative, not ×N** — **A-DAILYCHAIN verified**; `AGENT_BATTLE_DURATION_MODE='fullday'` (agentBattleService.js:23) [VERIFIED]. **Tripwire (from the daily-chain analysis):** this "no double-count" property *depends* on fullday daily docs; a revert to multi-day, a non-re-based redeploy, or two simultaneously-active docs would break it — worth an explicit A2 check.

**B3 — Threshold application.** Penalty tiers applied **per leg** from `history.{max,min}Multiplier`: agent live/CPU **agent-evaluate.js:629-635**, daily bank **agent-daily-scores.js:122-133** (`FieldValue.increment(todayBadgePoints)` :176), swap-out **agentSwapExecution.js:239-241**, user leg **tournamentUserScoring.js:127-133** [VERIFIED]. **The load-bearing behavior:** `thresholdHistory` is **zeroed every night** (agent-daily-scores.js:137-151), so a persistently out-of-range asset **re-banks its penalty every day**, and `bankedBadgePoints.total` is a **monotonic daily accumulator** — **uncapped by the 5-day tournament length**. Summed across the pod's daily docs (each inits `{total:0}`, banks once — agentBattleService.js:239), this yields a legitimate but potentially very large multi-day penalty total. **Constants are canonical and shared** (−10/−20/−35 from `baggerBombScoring.js:33-40`, re-exported by `agentScoring.js:20-28`; the doc's `scoring.pointValues` is a **written-never-read** snapshot, agentBattleService.js:150-153); **no stale local −7.5 copy survives** [VERIFIED].

**B4 — Departed legs.** `lockedPoints` in `executeSwapServer`: `entryPrice = swapPrice || startingPrices[out]`, `exitPrice = live || entry`, `rawPctChange = (exit−entry)/entry×100`, scored, `lockedPoints = round(scoreResult.totalPoints)` — **agentSwapExecution.js:191-254** [VERIFIED]. **No sign error** (shorts negated once, :232, "avoiding the prior double-negation"); **no double-count** — the swapped-out asset is written OUT of the slot (:293-294) so it is in `trades[]` **XOR** `activeScore`; the sum is **RECOMPUTED via `.reduce()`, never incremented** (agent-evaluate.js:690), so eval passes / tx retries can't accumulate [VERIFIED, H4-skeptic med-conf]. **`lockedPoints` is nonetheless a real magnitude term** that scales with swap count — the code-supported source of the **activity-ordered** ranking. **A1 must reconcile each `lockedPoints` against its own stored entry/exit prices** to distinguish "legitimate churn losses" from an unseen corruption.

**B5 — User layer.** Baselines start null for draft/claim/market-closed legs (createLeg, leagueTournament.js:938-981), settled by banking (B2). Flip/drop legs bank at **tournamentBanking.js:237-262** (telescoping intervals: a closed leg banks to `flipPrice`, the new leg baselines *at* `flipPrice` — flip.js — so no banked/live overlap); settle-once idempotent (`bankedScore === undefined` gate, :237) [VERIFIED]. Dropped picks keep counting (`scorablePicks` includes `droppedPicks`, :180-183), ×1.5 in composite. `scoreLeg` returns null (scores 0) for `baselinePrice ≤ 0` (tournamentUserScoring.js:119-121), so a zero baseline can't blow up `pctChange` [VERIFIED].

---

## Block C — Composite assembly (client + server)

**C1 — Live orb.** Rivals' orbs = `getWeeklyComposite(group, uid)` — **buildArenaModel.js:138** = the **final day's `compositePoints`**, never a cross-day sum — **leagueTournament.js:1079-1084** [VERIFIED]. The your-seat live estimate `youLiveScore = computeComposite(priorBankedAgent + Σ agentStars + swapBanked, Σ userStars + droppedBanked)` — **buildArenaModel.js:329-334** — *does* have the shape H6 fears, **but it is display-only**: consumed as a render prop (ClimbArena.jsx:64, ArenaDesktop/Mobile), `buildArenaModel` is imported **only by client React** (useArenaModel.js), **never by `api/`/`cron/`** — it cannot write `closeScores.compositePoints`. It is further gated `mode==='training'` **and the human you-seat only** (buildArenaModel.js:231-236), so it never computes the three CPU seats, and it nulls out the instant `dayBanked` flips (§9 display-agreement). Server-side `computeComposite` is called **exactly once** (tournamentBanking.js:318); all consumers read the single latest snapshot [VERIFIED]. **⇒ H6 CODE-REFUTED; the client is a faithful mirror; the poison is in the banked `closeScores`.** *(The dedicated client-orb investigator returned a malformed result and was discarded; this conclusion rests on the H6 skeptic + direct reading.)*

**C2 — CPU vs user parity.** CPU seats are **real system-owned agents** (`cpu-{n}`/`cpu-agent-{n}`, leagueTournament.js:292-311) banked through the identical `computeBankingUpdate` / `fetchGroupAgentScores` / `computeComposite` path — **no scorer divergence** [VERIFIED]. That is precisely why *all four* seats are negative: one shared banking path. The only human/CPU divergence is downstream (rank uses `applyRankWeekFrozen` for CPUs, leagueTournament.js:849-859) and does not touch the orb.

---

## Block D — Blast radius

**D1 — Same path for ranked + base-layer?** **Yes.** `bankAllTournamentGroups` queries `tournamentGroups where status == BATTLE` with **no `isTraining`/`isDev` filter** (only `players.length === GROUP_SIZE`) — **tournamentBanking.js:388-397** [VERIFIED]. **Ranked base-layer and bracket groups are banked by the identical scorer** — sample a non-training group's banked entries for the same signature (penalty tiers on quiet legs / impossible magnitudes) — [NEEDS-DATA].

**D2 — Leaderboard / career-rank ingestion (corrected).** Flow: `lockTopTwo` sets `finalScores[uid] = getWeeklyComposite` (tournamentAdvancement.js:108) → bracket doc (:594-603) → rank writer `computeRankBreakdown({weeklyComposite})` → `applyRankWeek` (tournamentRank.js:80-84) [VERIFIED]. **Three corrections to the working assumption:**
1. **A negative week is ABSORBED, not ratcheted down.** `applyRankWeek`: `rp = max(priorFloor, 0, rp+delta)`, `floorRp = max(priorFloor, tier.floor)` — **leagueTournament.js:828-835** [VERIFIED]. Floors are permanent **minimums**; they only ratchet **up**. A poisoned *negative* composite pins `rp` at the floor — it does **not** permanently demote. *(A spuriously **positive** poison would ratchet up permanently — but the observed symptom is negative.)*
2. **Rank ingests only at day-5 advancement** (`isWeekBanked`, leagueTournament.js:1092-1094); the pod is **day 3**, so `tournamentRanks` has **not yet** ingested — **a remediation window exists** [VERIFIED per B-BLAST].
3. **This pod is excluded entirely** — `isTraining` takes the plain finish with **no ladder side-effects** (tournamentAdvancement.js:282-287) and is excluded from the seasonal leaderboard (tournamentLeaderboard.js:318) [VERIFIED].
Residual permanent artifact if a *ranked* group's poison ever applies: the **`appliedGroups.{groupId}` idempotency lock** (tournamentRank.js:76,101) blocks a clean re-apply → a correction there needs a **migration**, not a re-run.

**D3 — Idempotent / re-runnable?** User banking is **write-once per ET date** (`recordedDate` guard inside the transaction; `dayN = max+1`) — **tournamentBanking.js:117-127,357-364** [VERIFIED]: a corrected re-bank of an already-recorded day is **skipped, not overwritten**, so remediation is a **migration** (clear/rewrite the `day{N}` entries), not a plain re-run. The **leaderboard** is SET/re-summed and **self-heals** on re-run; **rank** is per-`appliedGroups` idempotent (migration if already applied). The agent side accumulates `bankedBadgePoints` via `FieldValue.increment` (agent-daily-scores.js:176), reinforcing "migration, not re-run" (a naïve re-bank would double-increment).

---

## Appendix — why the code narrows the field

1. `basePoints = pctChange × 10 × tierMult` is **ATR-independent** (agentScoring.js:270 / baggerBombUtils.js:587); flat6 `tierMult = 1.0` (agentGameModes.js:70). An ATR bug moves only **badge** points, capped −35/leg/day → four seats at −384…−2676 with quiet legs **must** be base-driven or accumulation-driven.
2. The large ATR-independent negative terms are all **agent-side and cumulative**: `activeScore` (base from each day's `startingPrices`), Σ`lockedPoints` (realized swaps), and Σ`bankedBadgePoints` (a daily re-bank accumulator). The user half is ×1.5 but structurally bounded (era-correct baselines, ≤ a few days' drift for a genuine 3-day pod).
3. The tournament day index is **`max+1`** (tournamentBanking.js:126) — **decoupled from the calendar**. With user-banking dead Jul 1–15 and the agent crons alive, a stuck-underwater book **bled a fresh daily penalty for every calendar day** while the day counter barely moved. That makes a −2676 orb reconcilable as **model behavior over a longer-than-nominal window, not necessarily a data corruption** — and **A1 (agent/user split) + A2 (doc count vs day count, per-trade reconcile)** are what distinguish "legitimately large" from "genuinely corrupt."

**Recommended §7 fix framing (for founder decision, not executed here):** the primary lever is the **agent `bankedBadgePoints` daily re-bank with no elapsed-day cap** combined with the **calendar-decoupled day index** — a persistently out-of-range asset accrues unbounded penalty. Whether that is "working as designed" or the bug is a **founder scoring-model call**, gated behind A1. Secondary hardening: fail-loud (not silent 2.5 fallback) on an ATR percentile-store miss in banking (B1), and the fullday-daily-doc tripwire (B2).

**HARD STOP.** No fixes, no edits, no branch beyond this report artifact. All named files remain fenced; remediation is a separate §7 gated pass after founder review.
