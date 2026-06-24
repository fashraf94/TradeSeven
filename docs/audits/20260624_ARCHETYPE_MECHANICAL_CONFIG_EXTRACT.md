# Archetype Mechanical Config — Read-Only Extract
### FantasyTrades · grounding for Phase-0 identity authoring · 2026-06-24

**Repo:** `/home/user/TradeSeven` · **HEAD:** `f8c2316` · **Mode:** read-only extract. No edits, no build, no recommendations. Every value below was read this session and is **VERIFIED** with `file:line`. Where I did not trace a downstream chain I say so explicitly.
**Sources read:** `api/_utils/agentArchetypeConfig.js` (fenced — read only), `api/_utils/archetypeScoring.js`, `api/_utils/agentPresetConfig.js`, `api/_utils/agentRegimeClassifier.js`, `api/agent/decide.js`, `api/cron/agent-evaluate.js`, `api/agent/create-profile.js`, `api/_utils/tournamentCpu.js` + repo-wide consumer greps.

---

## 0. Headline: which dials actually fire

The per-archetype config is split across two files. **Only four wires actually shape trading today.** Five fields in `agentArchetypeConfig.js` are **declared but read by nothing** — authoring identity from them would describe behavior the engine does not execute.

| Dial | Where it lives | Consumed at | Status |
|---|---|---|---|
| **`hftConfig`** (forcedRotation / hurdleFloor / swapWindow) | `agentArchetypeConfig.js:35-47…` | `resolveHftConfig` → `agent-evaluate.js:988` (live risk manager) | **LIVE — the risk physics** |
| **`ARCHETYPE_WEIGHTS`** (6 ranking dims) | `archetypeScoring.js:14-63` | `computeArchetypeRankings` → `decide.js:243`; tournament boards `tournamentAgentBoards.js:49` | **LIVE — the draft fit-sort (ARCH column)** |
| **`ARCHETYPE_TEMPERATURES`** (sonnet/haiku) | `archetypeScoring.js:68-75` | `decide.js:309` (sonnet), `decide.js:388` (haiku) | **LIVE — LLM creativity** |
| **`ARCHETYPE_CONSTRAINTS`** (shortlist rule) | `archetypeScoring.js:80-93` | `agentPromptAssembly.js:13-14` (Sonnet system prompt); `tournamentAgentBoards.js:121-122` | **LIVE — the hard shortlist rule** |
| `label` | `agentArchetypeConfig.js` | prompts/logs | LIVE (display) |
| `avatarColors` | `agentArchetypeConfig.js` | UI (mirrored in `archetypeCharacter.js`) | LIVE (display only) |
| `defaultConfig` {risk,concentration,momentum} | `agentArchetypeConfig.js` | `create-profile.js:111` (seeds `agent.config`); `tournamentCpu.js:73-75` (CPU descriptor) | **SEED ONLY** — downstream mechanical effect of `agent.config` not traced here |
| `defaultPreset` | `agentArchetypeConfig.js` | — | **DEAD** (0 reads; battles hardcode `strategyPreset:'balanced'`, `agentBattleService.js:202`) |
| `regimePreferences` (favoredStrategies / avoidedStrategies / canEnterDistressed) | `agentArchetypeConfig.js` | — | **DEAD** (0 reads; the regime classifier uses the **preset's** regime, not the archetype's) |
| `convictionMods` (volume/macd/rs weights, convictionThreshold) | `agentArchetypeConfig.js` | — | **DEAD** (0 reads) |
| `sectorConcentrationCap` | `agentArchetypeConfig.js` | — | **DEAD** (0 reads) |
| `tradeFrequency` ('high'/'moderate'/…) | `agentArchetypeConfig.js` | — | **DEAD** (0 reads; descriptive label only — the real frequency physics is `hftConfig.forcedRotation` + `swapWindow`) |

> **Authoring caution:** real archetype differentiation today = `hftConfig` + `ARCHETYPE_WEIGHTS` + `ARCHETYPE_TEMPERATURES` + `ARCHETYPE_CONSTRAINTS`. The DEAD fields *read* like behavior (e.g. contrarian `rsWeight:-0.5`, guardian `avoidedStrategies:['volatility_squeeze']`, contrarian `canEnterDistressed:true`) but do not fire. (Corroborated by prior founder docs: `KEYSTONE_PRELOCK_FINDINGS.md:402`, `FORGE_ENFORCEMENT_KEYSTONE_DISCOVERY_REPORT.md:205` — "`defaultPreset` … 6 defs, 0 reads".)

---

## 1. Live mechanical picture, per archetype

For each: the LIVE wires only (with a one-line gloss of what each does). All `hftConfig` carry `requireBenchPositive:true` and `swapWindow.countEmergencies:false`. `hftConfig` numbers are flagged by the file header (`agentArchetypeConfig.js:17-20`) as **launch-seed/ILLUSTRATIVE — not yet calibrated**; the *relative* ordering is intentional, absolute values are placeholders.

### Trend Follower — `momentum_chaser` (`agentArchetypeConfig.js:27-57`)
- **Risk physics (`hftConfig`):** forcedRotation **ON** (pct 0.0015 / 3 ticks / winner 0.0015) → rotates out of a winner on a small +0.15% drift; hurdleFloor **0.3** haiku / **0.55** stagnation → low bar to swap in (needs 0.3×ATR edge); swapWindow **8 / 60min** → trades briskly.
- **Draft fit-sort (`ARCHETYPE_WEIGHTS`):** technical **0.40**, baggerBombFit **0.30**, atrPercentile **0.25**, fundamental 0.05 → sorts the universe almost entirely on technicals + volatility/fit; fundamentals near-ignored.
- **Temperature:** sonnet **0.3** / haiku **0.3** → disciplined, low-variance picks.
- **Shortlist rule (`ARCHETYPE_CONSTRAINTS`):** *"MUST include ≥5 stocks from today's top 3 performing sectors. Avoid sectors down >1% today."*

### Fundamental Investor — `analyst` (`agentArchetypeConfig.js:58-86`)
- **Risk physics:** forcedRotation ON (pct 0.003 / 6 ticks / winner 0) → slower to rotate; hurdleFloor **0.4 / 0.5**; swapWindow **4 / 60min**.
- **Fit-sort:** fundamental **0.40**, technical **0.30**, bbFit 0.15, sectorDiversity 0.10 → quality-led sort.
- **Temperature:** sonnet **0.2** / haiku **0.2** → the most deliberate, lowest-variance of the six.
- **Shortlist rule:** *"MUST include ≥5 stocks with fundamentalScore > 70. Exclude any stock with fundamentalScore < 40."* (a real quality floor.)

### Diversifier — `diversifier` (`agentArchetypeConfig.js:87-113`)
- **Risk physics:** forcedRotation ON (0.003 / 6 / 0); hurdleFloor **0.4 / 0.5**; swapWindow **4 / 60min**.
- **Fit-sort:** fundamental 0.25, sectorDiversity **0.30**, technical 0.20, bbFit 0.20, atr 0.05 → rewards spreading across sectors; downweights volatility.
- **Temperature:** sonnet **0.5** / haiku **0.4** → moderate variance.
- **Shortlist rule:** *"MUST span ≥7 different sectors. No sector may have more than 4 stocks."*

### Contrarian — `contrarian` (`agentArchetypeConfig.js:114-142`)
- **Risk physics:** forcedRotation ON (0.003 / 6 / 0); hurdleFloor **0.4 / 0.5**; swapWindow **4 / 60min**.
- **Fit-sort:** **inverseComposite 0.40** (buys LOW composite — beaten-down names), atr 0.20, fundamental 0.15, bbFit 0.15, technical 0.10 → the only archetype that inverts the composite. *This is where its contrarian-ness actually lives.*
- **Temperature:** sonnet **0.7** / haiku **0.6** → high variance / independent.
- **Shortlist rule:** *"MUST include ≥5 stocks from today's bottom 3 performing sectors. Avoid the top-performing sector entirely."*

### Speculator — `degen` (`agentArchetypeConfig.js:143-171`)
- **Risk physics:** forcedRotation ON, **most sensitive** (pct **0.001** / 3 ticks / winner 0.002); hurdleFloor **0.2** haiku (lowest bar to enter) / 0.6 stagnation; swapWindow **12 / 60min** (the most frenetic).
- **Fit-sort:** **atrPercentile 0.60** (volatility above all), bbFit 0.25, technical 0.15, **fundamental 0.00**.
- **Temperature:** sonnet **0.9** / haiku **0.8** → the highest variance / most improvisational.
- **Shortlist rule:** *"MUST include ≥3 stocks with ATR percentile > 0.80. Ignore fundamental scores entirely — focus only on volatility and momentum."*

### Capital Preserver — `guardian` (`agentArchetypeConfig.js:172-203`)
- **Risk physics:** forcedRotation **OFF** (the only one — won't chase rotation, `agentArchetypeConfig.js:181-184`); hurdleFloor **0.5 across the board** (highest bar to swap); swapWindow **2 / 120min** (slowest by far).
- **Fit-sort:** sectorDiversity **0.35**, fundamental 0.30, technical 0.20, bbFit 0.10, atr 0.05 → spread + quality, volatility downweighted hardest.
- **Temperature:** sonnet **0.3** / haiku **0.2** → low variance.
- **Shortlist rule:** *"MUST include ≥5 stocks with fundamentalScore > 60. Spread across ≥6 sectors. Avoid stocks with ATR percentile > 0.75. Your edge is avoiding busts, not chasing baggers."*

---

## 2. Cross-archetype comparison (the four live wires)

### 2a. `hftConfig` — the live risk physics (`agentArchetypeConfig.js:35-195`)
| archetype | forcedRotation | hurdleFloor haiku/stag/default | swapWindow cap / window |
|---|---|---|---|
| momentum_chaser | ON · pct0.0015 · 3t · win0.0015 | 0.3 / 0.55 / 0.3 | 8 / 60min |
| analyst | ON · pct0.003 · 6t · win0 | 0.4 / 0.5 / 0.4 | 4 / 60min |
| diversifier | ON · pct0.003 · 6t · win0 | 0.4 / 0.5 / 0.4 | 4 / 60min |
| contrarian | ON · pct0.003 · 6t · win0 | 0.4 / 0.5 / 0.4 | 4 / 60min |
| degen | ON · pct0.001 · 3t · win0.002 | 0.2 / 0.6 / 0.2 | 12 / 60min |
| guardian | **OFF** | 0.5 / 0.5 / 0.5 | 2 / 120min |

*Gloss:* **forcedRotation** = active-trading floor (forces exit from a stalled winner once pct/tick thresholds hit; lower pct = twitchier). **hurdleFloor.atrMultiplier** = deterministic quality gate — a challenger must beat the held name by X×ATR to swap in (lower = easier entry). **swapWindow.capPerWindow** = circuit-breaker ceiling on swaps per window.

### 2b. `ARCHETYPE_WEIGHTS` — draft fit-sort, sums to 1.0 (`archetypeScoring.js:14-63`)
| archetype | fundamental | technical | baggerBombFit | atrPercentile | inverseComposite | sectorDiversity |
|---|---|---|---|---|---|---|
| momentum_chaser | 0.05 | **0.40** | 0.30 | 0.25 | 0 | 0 |
| analyst | **0.40** | 0.30 | 0.15 | 0.05 | 0 | 0.10 |
| diversifier | 0.25 | 0.20 | 0.20 | 0.05 | 0 | **0.30** |
| contrarian | 0.15 | 0.10 | 0.15 | 0.20 | **0.40** | 0 |
| degen | 0.00 | 0.15 | 0.25 | **0.60** | 0 | 0 |
| guardian | 0.30 | 0.20 | 0.10 | 0.05 | 0 | **0.35** |

*Gloss:* produces the per-stock `archetypeScore` (the "ARCH" column) the Sonnet draft is told to use as its **primary sorting signal** (`agentPromptAssembly.js:14`). `inverseComposite` = `100 − compositeScore` (rewards beaten-down names); `sectorDiversity` is computed dynamically from the universe's sector counts (`archetypeScoring.js:125-126`).

### 2c. `ARCHETYPE_TEMPERATURES` (`archetypeScoring.js:68-75`)
| archetype | sonnet | haiku |
|---|---|---|
| analyst | 0.2 | 0.2 |
| guardian | 0.3 | 0.2 |
| momentum_chaser | 0.3 | 0.3 |
| diversifier | 0.5 | 0.4 |
| contrarian | 0.7 | 0.6 |
| degen | 0.9 | 0.8 |

*Gloss:* LLM sampling temperature — sonnet on the strategy/draft call (`decide.js:309`), haiku on the portfolio call (`decide.js:388`). Higher = more creative/variable picks.

### 2d. `ARCHETYPE_CONSTRAINTS` — verbatim (`archetypeScoring.js:80-93`); injected into the Sonnet system prompt
(Full text in §1 per archetype.) These are the **hardest-edged live differentiator**: an explicit shortlist rule the draft brain is instructed to obey (top/bottom sectors, fundamental floors, ATR floors/ceilings, sector spread).

### 2e. `defaultPreset` → preset risk levers (the bridge that is **NOT wired**)
`defaultPreset` (e.g. momentum_chaser `'aggressive'`, guardian `'defensive'`) is **dead** — battles set `strategyPreset:'balanced'` directly (`agentBattleService.js:202`), and the live preset is user-toggled, not archetype-seeded. For reference, the preset levers that WOULD apply (`agentPresetConfig.js`) are: aggressive `bustBuffer -0.90 / vwapFailureTicks 3 / trailStopATR 1.5 / minConviction 65`; balanced `-0.85 / 2 / 1.5 / 75`; defensive `-0.75 / 1 / 1.0 / 85`. **Every archetype currently runs the `balanced` row regardless of its `defaultPreset`.**

---

## 3. Dead / unused fields (do not author identity from these)

| Field | Per-archetype values that *look* meaningful but don't fire | Verification |
|---|---|---|
| `defaultPreset` | momentum_chaser/degen `aggressive`; guardian `defensive`; rest `balanced` | 0 reads repo-wide; `agentBattleService.js:202` hardcodes `balanced`. Corroborated `KEYSTONE_PRELOCK_FINDINGS.md:402`. |
| `regimePreferences.favoredStrategies` | momentum_chaser `['volatility_squeeze','52_week_high']`; degen adds `'news_catalyst'`; diversifier/guardian `['rs_momentum']`; contrarian `['vwap_mean_reversion']` | 0 reads; regime selection uses **preset** `regime.favoredStrategies` (`agentRegimeClassifier.js:122-148`), a different vocabulary. |
| `regimePreferences.avoidedStrategies` | guardian `['volatility_squeeze']`; others `[]` | 0 reads. |
| `regimePreferences.canEnterDistressed` | contrarian `true`; all others `false` | 0 reads — nothing gates distressed entry on this flag. |
| `convictionMods` | momentum_chaser `{volume1.2,macd1.2,rs0.8}`; contrarian `{rs:-0.5}`; degen `{convictionThreshold:0.85}`; analyst `1.15`; guardian `1.2`; diversifier `{}` | 0 reads. |
| `sectorConcentrationCap` | momentum_chaser/analyst/contrarian 3; degen 4; diversifier/guardian 2 | 0 reads. |
| `tradeFrequency` | momentum_chaser `high`; degen `highest`; guardian `low`; rest `moderate` | 0 reads — label only; real frequency = `hftConfig.forcedRotation` + `swapWindow`. |

---

## 4. Flags — non-obvious / things that surprised me

1. **`convictionMods` is entirely dead, including the eye-catching `contrarian.rsWeight:-0.5`.** Reads like "contrarian inverts relative strength," but the contrarian effect that *fires* is `ARCHETYPE_WEIGHTS.contrarian.inverseComposite:0.40` + the bottom-3-sectors `ARCHETYPE_CONSTRAINTS`. Author contrarian identity from those, not `rsWeight`.
2. **`regimePreferences` is dead despite looking authoritative** (it has a `favoredStrategies`/`avoidedStrategies`/`canEnterDistressed` shape that strongly implies it routes strategy selection). The router actually keys off the **preset's** regime block, and the two use **different strategy-name vocabularies** (archetype: `volatility_squeeze`; preset: `volatility_squeeze_breakout`) — so even if it were wired, the names wouldn't match. Treat `canEnterDistressed:true` for contrarian as **not active**.
3. **`defaultPreset` is dead → no archetype currently changes its base risk levers.** All six run the `balanced` preset's stops/buffers (`bustBuffer -0.85`, `vwapFailureTicks 2`, `trailStopATR 1.5`, `minConviction 75`) unless the user toggles `strategyPreset`. Archetype risk differentiation comes **only** from `hftConfig` (forcedRotation/hurdleFloor/swapWindow), not from these base levers.
4. **`hftConfig` values are explicitly launch-seed / ILLUSTRATIVE, not calibrated** (`agentArchetypeConfig.js:17-20`). The *relative* differentiation is intentional and real (degen frenetic vs guardian glacial); the *absolute* numbers are placeholders pending post-merge calibration. Safe to author identity from the relative ordering, not from exact figures.
5. **`defaultConfig` {risk,concentration,momentum} is a seed, not a live physics dial (as far as traced).** It populates `agent.config` at profile creation (`create-profile.js:111`) and the CPU descriptor (`tournamentCpu.js:73-75`). I did **not** trace whether `agent.config` then drives live trade decisions — if you want to author from these three numbers, that chain needs a separate look.
6. **`guardian` is the only archetype with `forcedRotation` OFF** (`agentArchetypeConfig.js:181-184`) — mechanically it is the one archetype that will *not* be force-rotated out of a stagnant position; combined with swapWindow 2/120min, it is by far the lowest-churn agent. That's a real, fired behavior worth anchoring identity on.

---

*End of extract. Read-only — no edits, no plan changes. The four live wires (§0/§2) are the grounded basis for Phase-0 identity authoring; the §3 dead fields are not.*
