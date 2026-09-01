# Ranks ↔ Archetype Audit — Phase 0 Discovery Report

**HEAD:** `bd6083739894200eee530016b15c20543fd22dad`
**Mode:** READ-ONLY. No code edited; no audited file (incl. the calibration-fenced `api/agent/decide.js` and `api/_utils/agentEvalPromptAssembly.js`) was modified. This report is the only artifact produced.
**Method:** 18-agent read-only fan-out (11 discovery areas + 7 adversarial hypothesis verifiers), plus direct re-verification of every load-bearing/surprising claim against HEAD. The cosine overlap matrix was computed deterministically (not by an LLM) from the verbatim weight vectors.

> **§7-GATED** marks any finding that *touches* the calibration-fenced files (`decide.js`, `agentEvalPromptAssembly.js`). Per the brief, no changes to those files are proposed; the flag is a routing tag only.

---

## Executive answer to the two founder questions

**Q1 — Do the six archetypes actually value different ranks from each other?**
**Partially. Contrarian and Speculator are genuinely distinct; but a three-way "quality/diversify" cluster is near-collinear.** Cosine similarity of the weight vectors flags two pairs above 0.85 — **diversifier ↔ guardian = 0.972** and **diversifier ↔ analyst = 0.860** — with analyst ↔ guardian at 0.846 just under the line. In plain terms: **Capital Preserver, by its stock-ranking math, is almost the same agent as Diversifier.** The universe does not collapse to "the same two or three fields" for all six, but half the roster (analyst / diversifier / guardian) shares one dominant axis.

**Q2 — Are the ranks built to a point where they're useful to the agent's reasoning?**
**Mixed. The producers are rich and fresh; the *archetype consumption* is narrow and, in two cases, measures the wrong thing.** The blend the agent draft-ranks on uses only **6 dimensions** (`fundamentalScore, technicalScore, baggerBombFit, atrPercentile, inverseComposite, sectorDiversity`). A fully-built Momentum Rank exists but carries **zero** archetype weight; the Contrarian has **no oversold signal** (its "cheap" lever is inverse *quality*, not price drawdown); `sectorDiversity` is a **full-universe per-sector constant**, not the shortlist-relative breadth the Diversifier's identity implies; and Capital Preserver's "safety/low-volatility" identity is **not encoded in its weights at all** (its ATR weight is 0.05 and *positive*).

---

## §A — Rank production inventory

### A.0 — Producer / collection map (corrects the brief's premise)

The brief assumed one board (`indexIntelligence/stockRankings`) fed by two producers. **The collection names in the brief are wrong.** There are two producers writing *different* collections, chained:

| Producer (cron) | Schedule (UTC) | Writes | Reads |
|---|---|---|---|
| `api/cron/compute-rankings.js` | `0 11 * * 1-5` (`vercel.json:69-70`) | `peerRankings/{TICKER}`, `sectorRankings/latest`, `scannerSummary/latest`, `priceHistory/*` | EODHD fundamentals/prices |
| `api/cron/compute-index-intelligence.js` | `30 10,11 * * 1-5` premarket + `0 14-20 * * 1-5` intraday (`vercel.json:149-155`) | **`indexIntelligence/stockRankings`** (the doc the archetype agent consumes), `stockTechnicalScores/{SYMBOL}`, 5 `indexIntelligence/{INDEX}` docs, `indexIntelligence/marketContext` | **`peerRankings`** (`:1017`), OHLCV |

**`compute-rankings.js` never writes `stockRankings` and never writes `fundamentalScore`/`technicalScore`/`baggerBombFit`** (grep: no match). It produces a fundamental peer **`compositeScore`**; `compute-index-intelligence.js` reads that and **re-emits it as `fundamentalScore`** (`fundScore = fund?.compositeScore` → `fundamentalScore: fundScore || null`, `compute-index-intelligence.js:1060,1117`). *Plain terms: what one job calls a stock's "composite" becomes the "fundamentalScore" input the archetypes weigh in the other job.*

### A.1 — `indexIntelligence/stockRankings.stocks[]` (the doc the archetype layer scores from)

Written at `compute-index-intelligence.js:1109-1159`, persisted at `:1211-1232` (`stocks: rankingStocks`). Universe = `ALL_TICKERS` = **239** (dynamic, not a hardcoded 230), symbols with ≥50 OHLCV bars.

| Field | Source / formula | Norm. | Null behavior | Cite |
|---|---|---|---|---|
| `fundamentalScore` | `peerRankings.compositeScore` = weighted avg of 8 pillar percentiles, **within-sector** | 0-100 | `\|\| null` (a true 0 → null) | `1060,1117` |
| `fundamentalRank` | `peerRankings.compositeRank` (within-sector) | ordinal | `\|\| null` | `1116` |
| `technicalScore` | 7-factor point sum, capped 100 (`indexIntelligence.js:362-363`) | 0-100 | passthrough | `1124` |
| `technicalRank` | 1-based ordinal, universe-wide sort by technicalScore | ordinal | — | `1123` |
| `compositeScore` | **avg of fund-rank% and sector-tech-rank%** (a *different* composite from peerRankings) | 0-100 | `null` unless both present | `1066-1071,1127` |
| `baggerBombFit` | `computeGameModeFits` (fund .10/tech .70/momentum-heat .20 + ATR modifier, `rankingConfig.js:821-826`) | 0-100 | `?? null` | `1129` |
| `baggerBombRank` | `assignGameModeRanks` (modes hardcoded `['baggerBomb']`) | ordinal | — | `1165`, `gameModeScoring.js:140` |
| `atrPercentile` | cross-sectional percentile of ATR% | 0-1 (2dp) | `?? 0.5` | `1027-1036,1130` |
| `momentumScore` | percentile of composite momentum-Z (see A.1a) | 0-100 | `?? null` | `1136` |
| `momentumRank` | ordinal of momentum-Z | ordinal | `?? null` | `1137` |
| `momentumFactors{}` | `{stability,heat,quality, residualMomentum,intermediateRS,acceleration,turnoverMom,fip,ker, overextensionPenalty,momentumBreakPenalty,peadAdjustment}` | mixed | `?? null` | `1138`, `momentumScoring.js:553-566` |
| `arch_scores{}` | per-symbol `{momentum_chaser,contrarian,diversifier,degen,analyst,guardian}` archetypeScores (pre-computed nightly, see §B) | 0-100 | `{}` | `1178-1188` |
| `sectorId` / `sectorName` / `industryName` | `STOCK_UNIVERSE` (ETF key / GICS name) / `TICKER_TO_INDUSTRY` | label | `null` | `1110-1115` |
| `sma200_position`, `trend`, `pivots`, `levels`, `momentum`(RSI-divergence), `recentAction`, `return1W/1M/3M/YTD/12M`, `dailyRange`, `nr7Flag`, `bBandwidthPercentile` | mirrored from tech / returns | mixed | `?? null` | `1132-1158` |

**A1 — momentumScore/Rank/Factors: PRESENT.** Produced by `momentumScoring.js` (`computeMomentumRankings`, imported/called once at `compute-index-intelligence.js:44,931`), written at `:1136-1138`. All three Gemini roadmap phases landed **in code**: Phase 1 = the persist step (comment "Momentum Rank (Phase 1)" `:1135`); Phase 2 = the full 6-metric engine + sub-pillars (residual momentum `momentumScoring.js:183`, FIP `:70`, KER `:105`, acceleration `:129`, turnover-momentum `:156`, RS126 `:262`; header `:1-2`); Phase 3 = risk overlays (overextension/break/PEAD `:338-345,509-525`). **Caveat:** PEAD is inert in production (`earningsMap=null`, `:928-931`) so `peadAdjustment` is always 0. (No `GEMINI_SYNTHESIS_MOMENTUM_RANKING` doc exists in-repo; phase evidence is code comments.)

**A2 — oversold/drawdown: NONE surfaced on the doc the archetype scorer reads.** Raw RSI (`factors.rsi`), Bollinger %B (`bbPercentB`), and distance-from-52-week-high (`distTo52wkHigh`) exist **only on `stockTechnicalScores/{SYMBOL}`** (`indexIntelligence.js:396,398`; `compute-index-intelligence.js:880-883`), which the archetype scorer does **not** read. `drawdownFrom20DayPeak` and a Bollinger-Z **collapse to discretized penalty scalars** (`momentumBreakPenalty` 0/0.3/0.6, `overextensionPenalty`) inside `momentumFactors` (`momentumScoring.js:374-382,354-363`) — the raw drawdown/Z are local variables, never persisted as fields. `stockRankings` carries `bBandwidthPercentile` (band *width*, a squeeze gauge), not band *position*. **No field named `drawdownFrom20DayPeak` or a raw oversold reading exists on `stockRankings`.**

**A3 — sector taxonomy.** A stock's sector on `stockRankings`/`peerRankings` is held in `sectorId` (SPDR ETF key, e.g. `XLK`) **and** `sectorName` (GICS name, e.g. `Technology`) — both from the single `STOCK_UNIVERSE` (`rankingConfig.js:15-82`); there is **no bare `sector` field**, and `stockTechnicalScores` carries **no** sector label at all. "Sector performance today" (`topSectorToday`, `worstSectorToday`, `sectorSnapshot` by ETF 1-day % change) is computed live but written to a **different doc — `indexIntelligence/marketContext`** (`compute-index-intelligence.js:950-953,970-989`) — **not** the per-stock rank docs. The labels match (both use `STOCK_UNIVERSE[id].name`), so a name-join is lexically valid — but nothing performs it: the archetype "top/bottom 3 performing sectors" strings are static prose (see §B7) and `decide.js` reads only `regime`/`regimeDetail` from marketContext, not the sector standings (`decide.js:1548-1556`, §7-GATED).

### A.1a — Momentum Rank internals (`momentumScoring.js`)
`BMZ` = null-aware weighted sum of 6 winsorized-Z metrics — `MOMENTUM_WEIGHTS` residualMomentum .20 / intermediateRS .15 / acceleration .15 / turnoverMom .15 / fip .20 / ker .15 (`:32-39`) — then `−overextension −momentumBreak +pead` applied *before* ranking (`:509-525`). `momentumScore = percentileRank(BMZ)`, `momentumRank` = ordinal (`:527-537`). Sub-pillars: `stability={residualMomentum,intermediateRS}`, `heat={acceleration,turnoverMom}`, `quality={fip,ker}` (`:44-48`). Header asserts "zero mathematical overlap with Technical Score (no MACD/RSI/SMA/raw RS)" — verified: distinct indicators.

### A.2 — Secondary docs (not scored by archetypes)
- **`peerRankings/{TICKER}`** (18 keys, `compute-rankings.js:1353-1409`): `compositeScore` (8-pillar within-sector; ≥3-pillar minimum else dropped, `:873-892`), `compositeRank`, `tier`, `pillars{}`, `metrics{}` (~30 raw stats), `dnaBadge`, `debtRiskBadge`, `scanner`, `leaderboard`, `sectorSummary`, `computedAt`, `expiresAt(+26h)`.
- **`stockTechnicalScores/{SYMBOL}`** (`compute-index-intelligence.js:872-892,998-1004`): full technical payload (`rs20/rs50`, `atrPercent`, `bbPercentB`, `factors{rsi,distTo52wkHigh,...}`, `trend`, `levels`, `recentAction`) + `technicalRank`/`sectorTechnicalRank`. **Only `updatedAt`, no `expiresAt`.**

### A.3 — Staleness & null (cross-cutting)
- **No holiday/market-open guard** in `compute-rankings.js` (auth + HTTP-method only, `:1440-1448`); it fires every weekday and can overwrite with whatever the feed returns on a closed day. Aborts before persist only if `<50` fundamentals fetched (`:1478-1484`).
- **Failed run = no overwrite** (persist is skipped on throw), so yesterday's docs survive; **successful run = full `batch.set` overwrite**. The only staleness signal is `expiresAt` (`stockRankings` 24h premarket / 75min intraday `:1221`; `peerRankings` 26h). **No producer reads `expiresAt`** — the consumer must.
- **Null:** `peerRankings` *drops* sub-3-pillar stocks (no doc). `stockRankings` uses `|| null` on `fundamental*` (a genuine 0 → null), `?? null` on momentum/returns, neutral fallbacks elsewhere. Inside `computeArchetypeRankings`, missing dims default to **50** (fund/tech/bbFit) / **0.5** (atr) — a data-poor stock scores as *average*, never excluded.
- **beatRate fabrication:** for companies with <4 quarters of history, `beatRate` is a **sector constant** (`SECTOR_BEAT_RATES` or 0.68) that flows unchanged into the earnings-consistency pillar → `compositeScore` → `fundamentalScore`, tagged with `beatRateSource='sector_default'` (`compute-rankings.js:539-543,1390-1392`). *A young stock's `fundamentalScore` — and thus Contrarian's `inverseComposite` — can be partly built on a placeholder.*

---

## §B — Archetype consumption map

### B.1 — Live config, verbatim

**`ARCHETYPE_WEIGHTS`** (`archetypeScoring.js:14-63`) — dimensions `[fundamentalScore, technicalScore, baggerBombFit, atrPercentile, inverseComposite, sectorDiversity]`, each set sums to 1.00:

| archetype (label) | fund | tech | bbFit | atr | invComp | secDiv |
|---|---|---|---|---|---|---|
| `momentum_chaser` (Trend Follower) | 0.05 | **0.40** | 0.30 | 0.25 | 0.00 | 0.00 |
| `contrarian` (Contrarian) | 0.15 | 0.10 | 0.15 | 0.20 | **0.40** | 0.00 |
| `diversifier` (Diversifier) | 0.25 | 0.20 | 0.20 | 0.05 | 0.00 | **0.30** |
| `degen` (Speculator) | 0.00 | 0.15 | 0.25 | **0.60** | 0.00 | 0.00 |
| `analyst` (Fundamental Investor) | **0.40** | 0.30 | 0.15 | 0.05 | 0.00 | 0.10 |
| `guardian` (Capital Preserver) | 0.30 | 0.20 | 0.10 | 0.05 | 0.00 | **0.35** |

**`ARCHETYPE_TEMPERATURES`** (`:68-75`): momentum_chaser `{0.3,0.3}`, contrarian `{0.7,0.6}`, diversifier `{0.5,0.4}`, degen `{0.9,0.8}`, analyst `{0.2,0.2}`, guardian `{0.3,0.2}` (`{sonnet,haiku}`).

**`ARCHETYPE_CONSTRAINTS`** (`:80-93`, prompt strings): momentum_chaser "≥5 from top-3 sectors, avoid sectors down >1%"; contrarian "≥5 from bottom-3 sectors, avoid the top sector"; diversifier "≥7 sectors, no sector >4"; degen "≥3 with ATR>0.80, ignore fundamentals"; analyst "≥5 with fund>70, **exclude any with fund<40**"; guardian "≥5 with fund>60, ≥6 sectors, avoid ATR>0.75".

Labels confirmed in `agentArchetypeConfig.js:36-219` and canonical `src/data/archetypeDisplay.js:18-25`. `copycat` is retired (one hit, in an `*.ARCHIVED.jsx`).

### B.2 — Fields each archetype touches / ignores
All six read the **same 6 dimensions**; differences are the weights above. **Every archetype ignores** (structurally — the field is never read by `computeArchetypeRankings`): `momentumScore/Rank/Factors`, `compositeScore` *directly* (only via `inverseComposite`), all returns, `sma200_position`, RSI, drawdown, `technicalRank`, `sectorTechnicalRank`, `snakeDraftFit`/`earningsGameFit` (nonexistent). Per-archetype **zeros**: `inverseComposite` is 0 for all but contrarian; `sectorDiversity` is 0 for momentum_chaser/contrarian/degen; `fundamentalScore` is 0 for degen.

### B.3 — Weight-overlap matrix (Q1, computed from the vectors above)

**Cosine similarity:**

| | mom | contr | divers | degen | analyst | guard |
|---|---|---|---|---|---|---|
| **momentum_chaser** | 1.000 | 0.503 | 0.606 | 0.761 | 0.659 | 0.476 |
| **contrarian** | 0.503 | 1.000 | 0.398 | 0.512 | 0.454 | 0.346 |
| **diversifier** | 0.606 | 0.398 | 1.000 | 0.340 | **0.860** | **0.972** |
| **degen** | 0.761 | 0.512 | 0.340 | 1.000 | 0.316 | 0.248 |
| **analyst** | 0.659 | 0.454 | 0.860 | 0.316 | 1.000 | 0.846 |
| **guardian** | 0.476 | 0.346 | 0.972 | 0.248 | 0.846 | 1.000 |

**Pairs > 0.85 (flagged):** `diversifier ↔ guardian` **0.972**, `diversifier ↔ analyst` **0.860** (and `analyst ↔ guardian` 0.846 just under). **Most distinct:** contrarian (max off-diagonal 0.512) and degen (max 0.761). *Answer to Q1: the archetypes do NOT all collapse — contrarian and degen are genuinely differentiated — but a quality/diversify cluster (analyst/diversifier/guardian) is near-collinear, with Capital Preserver essentially a re-weighting of Diversifier.*

### B.4 — Caller of `computeArchetypeRankings`
The brief's premise ("sole caller is `decode.js`, renamed from `strategy.js`") is **false on both counts**: **no `decode.js` or `strategy.js` exists** (find/glob empty), and there are **8 non-test call sites**. All agent-facing callers pass the **FULL** universe (no pre-slice); slicing, where any, happens *after* scoring:

| Call site | Input | Slice? | Fenced |
|---|---|---|---|
| `decide.js:343` (primary agent deploy) | full `stockRankings.stocks` (`:339`) | after scoring only (fallback top-35) | **§7** |
| `scouting-board.js:113` | full universe | top-10 after (`:115`) | no |
| `compute-index-intelligence.js:1180` (nightly `arch_scores`) | full `rankingStocks` | none | no |
| `tournamentAgentBoards.js:467` | full universe | after | no |
| `tournamentAgentDraft.js:258` | full universe | none (→symbols) | no |
| `tournamentBoardAutoCommit.js:161` | full universe | none | no |
| `trainingLifecycle.js:275` | **pre-filtered** pool∩not-taken | top-1 | no |
| `useTrainingDraft.js:179` | **pre-filtered** pool∩not-taken | top-N | no |

Only the two **training-draft overlays** pass a subset (the H3 exception).

### B.5 — `inverseComposite`
Confirmed `inverseComposite = 100 - (s.compositeScore ?? 50)` (`archetypeScoring.js:124`) and it is Contrarian's only non-zero "beaten-down" input (weight 0.40; 0.00 for all others). But `compositeScore` here is the `stockRankings` composite = **avg of fundamental-rank% and technical-rank%** (`compute-index-intelligence.js:1066-1071`) — i.e. inverse overall **quality/rank**, containing no drawdown/price-oversold term (see H2).

### B.6 — `sectorDiversity`
Confirmed computed over the **full passed array** (`for (const s of stocks) sectorCounts[...]++`, `:112-116`), value `((maxSectorCount − count[sector]) / maxSectorCount) × 100` (`:125-126`). Because both terms are fixed per call, the value is **exactly constant for every stock sharing a sector** within a call — a static per-sector bonus, **not** a shortlist-relative marginal-breadth reward. A unit test locks the full-universe contract (`compute-index-intelligence.test.js:142-155`: same stock scores 80 vs 0 full-universe vs sector-only). This matches the spec's *implementation* but not its stated *intent* ("over the top-N shortlist").

### B.7 — Constraint enforcement: **PROMPT-ONLY**
`ARCHETYPE_CONSTRAINTS[archetype]` is interpolated into the Sonnet strategy **system prompt** as advisory text ("...Use it as your primary sorting signal.", `agentPromptAssembly.js:38-40`; identical block in `tournamentAgentBoards.js:126-127`). **No mechanical post-response filter enforces it:** `validatePortfolio` (`decide.js:1102-1143`, §7) checks only slot counts, symbol-in-universe, crypto validity, duplicates — it never references `fundamentalScore`, `atrPercentile`, `sectorName`, or the archetype. `buildFallbackPortfolio` (`decide.js:1145-1189`, §7) is archetype-*agnostic*. `scouting-board.js` and `agentEvalPromptAssembly.js` carry no such filter either. → **The analyst "exclude fund<40" is honor-system prose, never enforced.** The `CONSTITUTION_FUNDAMENTAL_INVESTOR_V1.md:16` "refused outright / mechanically reachable" language is a plan-said≠code-did divergence.

---

## §C — Surface map (which prompt sees which rank field)

`YES file:line` = surfaced as a value; `NO` = grep-confirmed absent; `RAW` = a raw metric, not the named rank field. Draft (Sonnet) and Portfolio (Haiku) share `formatMarketCSV`.

| Field | Draft CSV — Sonnet (`agentPromptAssembly.js`) | Portfolio tool — Haiku (`decide.js`, §7) | Mid-battle eval (`agentEvalPromptAssembly.js`, §7) | Voice Layer (`voiceLayerPrompt.js`) |
|---|---|---|---|---|
| `fundamentalScore` | **YES** `:245` (FUND col) | **YES** `:245` (via CSV) | **NO** (raw PE/PB/rev-growth via Stream D, `fundamentalsRender.js:96-111`) | **NO** per-pick (screenable-field name only, `:2239`) |
| `technicalScore` | **YES** `:246` | **YES** `:246` | **YES** `:1617` (bench "Composite:") | **YES** `:1115` ("Score N") |
| `technicalRank` | NO | NO | **YES** `:1618` (bench) | **YES** `:1119` (rank #N/total) |
| `compositeScore` | **NO** (no COMPOSITE col) | **NO** `:1129` (grep-confirmed) | **NO** | scout-alerts only (`voice-layer-cache.js:506`) |
| `baggerBombFit` | **YES** `:247` (BB_FIT) | **YES** `:247` | **NO** | NO per-pick (used as ≥85 gate) |
| `atrPercentile` | **YES** `:248` (ATR_PCT) | **YES** `:248` | **NO** (raw `atrPercent` regime label only) | **YES** `:1137` ("ATR N%") |
| `archetypeScore` / `arch_scores` | **YES** `:249` (ARCH) | **YES** `:249` | **NO** | **NO** (`arch_scores.<key>` is only a screenable-field name) |
| `momentumScore` / `momentumRank` | **NO** | **NO** | **NO** | **NO** per-pick (screenable name `:2241`; cohort median only) |
| oversold / drawdown | **NO** | **NO** | **NO** ("oversold" only as example prose `:331,550`) | **NO** |
| `sectorName` | **YES** `:244` | **YES** `:244` | (regime/levels context) | YES (header) |
| *(mirror)* `PE_VS_SECT/REVG_PCT/MCAP_CLS` | **YES** (mirror ON, `fundamentalsRender.js:42`) | **YES** (10-col CSV today) | **YES** raw fundamentals block `:1077` | (Research digest only) |

**C1 — Does Haiku see only `archetypeScore`? NO.** The portfolio step is fed `formatMarketCSV([...shortlistData, ...])` as its system prompt (`decide.js:495,504-507`, §7), i.e. the **same column set as the draft** — the four raw components (`FUND/TECH/BB_FIT/ATR_PCT`) **alongside** the blend (`ARCH`), plus the 3 fundamentals-mirror columns (mirror flag hard-coded `true`, `featureFlags.js:1549`). So the archetype's per-stock reasoning does **not** collapse to one number at portfolio time — Haiku sees the ingredients and could overrule the blend. The one component *never* shown is `compositeScore`.

**C2 — Did Stream D land? YES, but not as the composite `fundamentalScore`.** `FUNDAMENTAL_MIRROR_ENABLED=true` and `buildFundamentalsBlock` is imported and pushed into the eval prompt (`agentEvalPromptAssembly.js:52,1077`, §7). But it renders **raw** fundamentals (`PE`, `P/B`, `rev growth`, `mcap`, `EPS rev 30d`, `beat rate`, `surprise pctl`, `fundamentalsRender.js:96-111`) — **not** the composite `fundamentalScore` the `STREAM_B_SESSION_2` doc implied. Divergence.

**C3 — Does the Voice Layer get rank fields? YES — more than the label.** Own picks (portfolio/bench) print `technicalScore` ("Score N"), `technicalRank` ("rank #N/total"), `atrPercentile` ("ATR N%"), and RS percentile into the "YOUR PORTFOLIO/BENCH" block (`voiceLayerPrompt.js:1115-1138`, pushed at `:2982`); watchlist scouts add `compositeScore` + `baggerBombRank`. The prompt's own `DATA_CONFIDENCE_RULE` (`:1823`) explicitly acknowledges the agent is shown "Score 87 / ATR 4.2% / RS 87th %ile". **But** no per-pick `momentumScore`, `fundamentalScore`, or `archetypeScore`. So the "an agent can't see its own ranks" concern is **unfounded for technicals/ATR** and **true for fundamentals/momentum/archetype-fit**.

---

## §D — Identity ↔ math alignment

| Archetype | Identity claim (verbatim, `ARCHETYPE_DEF_*_2026-06-24.md`) | Live signal that should back it | Verdict |
|---|---|---|---|
| **Trend Follower** | "I buy strength... I read price, not pedigree" (`TREND_FOLLOWER:18-19`) | technical/momentum dominance | **ALIGNED** — tech 0.40 + bbFit 0.30 + atr 0.25, fund 0.05. (Backed by `technicalScore`, though the Momentum *Rank* is ignored; strength is carried by technicalScore.) |
| **Contrarian** | "I buy the oversold and out-of-favor — but not the broken" (`CONTRARIAN:20`) | an oversold signal distinct from low-quality | **UNSUPPORTED** — no live oversold field reaches the scorer; the only "cheap" lever is `inverseComposite` = inverse *quality/rank* (conflates low-quality with oversold). Real drawdown/RSI exist but are never read. |
| **Speculator** | "I chase volatility, not safety... fundamentals are nothing to me" (`SPECULATOR:20-22`) | ATR dominance | **ALIGNED** — atr 0.60 (highest), fund 0.00. |
| **Fundamental Investor** | "Quality is the price of admission" / "quality is the GATE, technicals the TRIGGER" (`FUNDAMENTAL_INVESTOR:20,28`) | fundamental floor enforced + technical secondary | **DRIFT** — fund-dominant tilt is real (0.40 top weight), but the "gate" (`fund<40` exclusion) is **prompt-only, not mechanical** (§B7); "trigger" is just a co-weight (tech 0.30), not a sequenced entry gate. |
| **Diversifier** | "I spread, always — breadth is the strategy itself... indifferent to what fills the slots" (`DIVERSIFIER:22-23`) | sector spread that varies across the universe | **DRIFT** — `sectorDiversity` weight is real (0.30, top weight) but is a **full-universe per-sector constant**, not the shortlist-relative breadth the identity implies (§B6). |
| **Capital Preserver** | "I protect capital first. Quality names, low volatility... patience is my edge" (`CAPITAL_PRESERVER:30-32`) | low-ATR / high-financialHealth weighting | **UNSUPPORTED** — the weight vector encodes **no low-volatility preference**: `atrPercentile` weight is 0.05 and **positive** (mildly *rewards* volatility). "Safety" lives only in the constraint string ("avoid ATR>0.75") + physics config (`forcedRotation` off); the vector is diversification-dominated (`secDiv` 0.35) → cosine 0.972 with Diversifier. |

*Note:* `atrPercentile` is a **positive** weight for **all six** archetypes (0.05–0.60). **No archetype's scoring vector penalizes volatility** — "low-vol/safety" is nowhere in the ranking math, only in prompt strings/physics.

---

## §4 — Hypotheses

| # | Hypothesis | Verdict | Basis |
|---|---|---|---|
| **H1** | `momentumScore` produced but zero weight in every archetype vector — Momentum Rank is UI-only | **PARTIAL** | Produced + persisted ✓ (`:1136`); **zero archetype weight** ✓ (structurally not a dimension, `archetypeScoring.js:118-131`); "UI-only/dead" **✗** — live consumers: screener baseline (`screenStocks.js:64`), cohort digest → voice-layer prompt (`cohortDigest.js:66`; `voiceLayerPrompt.js:2241`). Only agent-scoring path: `momentumFactors.heat` → `baggerBombFit` (0.20). §7: `decide.js` has zero momentum refs. |
| **H2** | Contrarian's only cheap/oversold signal is `inverseComposite`, conflating low-quality with oversold; no drawdown/RSI reaches it | **CONFIRMED** | `inverseComposite`=100−composite (inverse quality) is the only "cheap" lever (0.40); scorer reads only 6 fields, none a drawdown/RSI (`archetypeScoring.js:118-127`); real signals stamped on the same objects go unread; `decide.js` has no contrarian oversold branch (§7). |
| **H3** | `sectorDiversity` computed over full-universe counts → near-constant per sector, not shortlist-relative | **CONFIRMED** | Full-array counts (`:112-126`), exactly constant per sector; primary caller passes full universe with a "must run FULL" comment (`:1176`); unit-test locked. (Nuance: two training-draft overlays pass a filtered subset.) |
| **H4** | Haiku gets only `ARCHETYPE_SCORE` + same raw columns for every archetype; differs only by sort order + one column | **PARTIAL** | Column half ✓ (raw cols identical; only ARCH value + sort vary, `agentPromptAssembly.js:242-254`); universal half **✗** — Haiku also gets the archetype-shaped **brief**, an archetype-dependent **shortlist membership** (`decide.js:486-495`, §7), and archetype-specific **temperature** (`:344`). |
| **H5** | Mid-battle eval sees NO rank fields (Stream D not landed) | **REFUTED** | `technicalScore`+`technicalRank` reach it (bench "Composite:" line, `agentEvalPromptAssembly.js:1614-1621`, flagless, §7), plus `rsPercentile`/`sectorRSPercentile`; Stream D **did** land (raw fundamentals block). *Narrow truth:* partial coverage — `compositeScore/momentumScore/fundamentalScore/atrPercentile/archetypeScore` absent; bench-only, not held positions. |
| **H6** | `guardian` weights added after the differentiation spec, undocumented; check if it differs from analyst | **PARTIAL** | **Differs from analyst** ✓ (secDiv 0.35 vs 0.10; + physics: `forcedRotation` off, slower cadence). **"Undocumented/added-after" ✗** — documented in multiple docs + dedicated constitution/DEF; header lists guardian as an original illustrative seed; `git log -S` puts guardian & analyst blocks in the same commit. *(Material point: guardian differs from analyst but is ~identical to **diversifier** — cosine 0.972.)* §7: config physics in `decide.js`-adjacent readers. |
| **H7** | `snakeDraftFit`/`earningsGameFit` computed nightly, consumed by no agent path | **REFUTED** | Both fields **do not exist anywhere** (grep empty); `GAME_MODE_PROFILES` = `{standard, baggerBomb}` only (`rankingConfig.js:814-838`); the one fit that exists, `baggerBombFit`, is a live archetype dimension and drives draft + eval + tournament paths. |

---

## Findings

Each: plain-game sentence → technical detail → citation → `§7-GATED` if it touches a fenced file.

**F1 — The board the archetypes read is built by a different job than the plan names, and "fundamentalScore" is a renamed copy of another job's "composite."**
`compute-rankings.js` writes `peerRankings` (fundamentals), not `stockRankings`; `compute-index-intelligence.js` reads `peerRankings.compositeScore` and re-emits it as `stockRankings.fundamentalScore`. `snakeDraftFit`/`earningsGameFit` don't exist. — `compute-index-intelligence.js:1060,1117,1211`; `compute-rankings.js:1327`.

**F2 — Capital Preserver and Diversifier are almost the same agent by their ranking math.** Cosine(diversifier, guardian)=0.972, cosine(diversifier, analyst)=0.860 — a near-collinear analyst/diversifier/guardian cluster; only Contrarian and Speculator are strongly distinct. — computed from `archetypeScoring.js:14-63`.

**F3 — The Diversifier's and Capital Preserver's biggest lever is a near-static "how crowded is your sector" number, not a live breadth bonus.** `sectorDiversity` (guardian 0.35 top weight, diversifier 0.30 top weight) is exactly constant per sector across the fixed 239-name universe. — `archetypeScoring.js:112-126`; test `compute-index-intelligence.test.js:142-155`.

**F4 — The Contrarian has no way to see that a stock is beaten down.** Its only "cheap" input flips the stock's overall quality/rank; genuine drawdown/RSI/return data exists on the same records but the scorer never reads it. — `archetypeScoring.js:118-127`; `compute-index-intelligence.js:1066-1071`. `decide.js` has no contrarian branch — `§7-GATED`.

**F5 — A complete Momentum Rank engine is built and saved but the agents never score on it.** Zero weight in all six vectors; only `momentumFactors.heat` leaks in via `baggerBombFit` (0.20). It does reach UI/screener/voice-layer, so it isn't dead — just invisible to draft/portfolio/eval math. — `momentumScoring.js`; `archetypeScoring.js:118-131`; `decide.js` (no momentum refs) — `§7-GATED`.

**F6 — Every archetype "rule" (including "exclude fundamentals below 40") is a suggestion in the prompt, not a hard filter.** `ARCHETYPE_CONSTRAINTS` is injected as text; the deterministic validator checks only slot counts and real tickers. — `agentPromptAssembly.js:38-40`; `decide.js:1102-1143` — `§7-GATED`.

**F7 — Haiku is shown the raw ingredient scores, not just the blended fit number.** The portfolio prompt is the same `formatMarketCSV` (FUND/TECH/BB_FIT/ATR_PCT/ARCH + 3 fundamentals-mirror cols). — `agentPromptAssembly.js:242-254`; `decide.js:495,504-507` — `§7-GATED`.

**F8 — `compositeScore` is shown to no agent surface at all**, yet it is the entire basis of the Contrarian's "cheapness." — `agentPromptAssembly.js:239-255` (absent); `archetypeScoring.js:124`.

**F9 — Mid-battle, the agent sees a bench stock's technical score/rank and (raw) fundamentals, but not its composite, momentum, or archetype-fit; and nothing for stocks it already holds.** Stream D shipped raw fundamentals, not the composite `fundamentalScore` the plan implied. — `agentEvalPromptAssembly.js:1614-1621,1077`; `fundamentalsRender.js:96-111` — `§7-GATED`.

**F10 — The Voice Layer does let an agent quote its own technicals and ATR** ("Score N, rank #N/total, ATR N%"), refuting part of the archetype-integrity worry — but it still can't see its own momentum, fundamental, or archetype-fit numbers per pick. — `voiceLayerPrompt.js:1115-1138,1823`.

**F11 — The draft table header doesn't match the spec.** Actual `TICKER|SECTOR|FUND|TECH|BB_FIT|ATR_PCT|ARCH` (pipe-delimited, no COMPOSITE); spec claimed a comma-delimited 8-column header with COMPOSITE. — `agentPromptAssembly.js:242`.

**F12 — No archetype's weights make it prefer calmer stocks.** `atrPercentile` is a positive weight for all six (guardian included, 0.05), so higher volatility mildly *raises* every archetype's score; "safety" for Capital Preserver lives only in a prompt string + physics config. — `archetypeScoring.js:14-63,123`.

**F13 — `guardian` is a fully-built, documented, original archetype** (constitution, DEF doc, display map, physics config), not an undocumented late add-on — but its distinctiveness from analyst is diversification, and it is ~identical to diversifier. — `agentArchetypeConfig.js:187`; `docs/ARCHETYPE_CONFIG_VERIFICATION_NOTE.md:27`.

**F14 — Data-integrity notes (peripheral to the archetype path but on the rank docs):** (a) a young company's `fundamentalScore` can be built on a **fabricated sector-average beat rate** (`compute-rankings.js:539-543`); (b) `scannerSummary/latest` top-3 always shows score 0 and isn't sorted — a wiring bug (`compute-rankings.js:1264`); (c) `rs50.percentile` is hardcoded 0 (`compute-index-intelligence.js:875`); (d) the momentum PEAD overlay is wired but inert (`earningsMap=null`, `:928-931`); (e) `compute-rankings.js` has no market-holiday guard (`:1440-1448`).

**F15 — The "top/bottom 3 performing sectors" the constraints reference are never joined to the live sector-performance data.** Sector daily performance is on `indexIntelligence/marketContext`; the archetype prompt path only injects the constraint *string* and (for `decide.js`) reads `regime` from marketContext, not the sector standings. — `compute-index-intelligence.js:950-953,970-989`; `decide.js:1548-1556` (`§7-GATED`).

---

## Open questions for founder ruling (max 8)

1. **Capital Preserver ≈ Diversifier (0.972).** Intended? If Capital Preserver should be a *safety* agent, its weight vector currently has no low-volatility term (ATR weight 0.05, positive) and is dominated by sector-diversification. (§B3, §D, F2/F12)
2. **Contrarian has no oversold signal.** Should it get a real drawdown/RSI/price-oversold input (the data already exists on `stockTechnicalScores` and as `momentumFactors` penalties), instead of `inverseComposite` = inverse quality? (§H2, F4)
3. **Momentum Rank is invisible to agent scoring.** Is the full 6-factor Momentum Rank meant to feed archetype weights (esp. Trend Follower), or is UI/screener/voice-only the intended end state? (§H1, F5)
4. **`sectorDiversity` is a full-universe constant, not shortlist-relative.** The spec intended top-N-relative; the code is universe-relative and test-locked. Change the semantic, and at which surface (it would alter the nightly `arch_scores` pre-compute contract)? (§B6, H3, F3)
5. **Constraints are prompt-only.** Should any constraint — starting with the analyst `fund<40` "gate" the constitution calls mechanical — be enforced deterministically post-response? (§B7, F6)
6. **`compositeScore` reaches no agent prompt** yet underpins Contrarian's lever. Should it (or the raw components behind it) be surfaced? (§C, F8)
7. **Stream D shipped raw fundamentals to the eval prompt, not the composite `fundamentalScore`.** Is the raw-metrics block the intended deliverable, or is the composite still owed to mid-battle eval? (§C2, F9)
8. **Sector-performance data and the sector constraints are on different docs and never joined.** Should the prompt pair `marketContext.sectorSnapshot` (today's top/bottom sectors) with the "top/bottom 3 sectors" constraint so the rule is answerable? (§A3, F15)

---

**HARD STOP — Phase 0 complete. No weights proposed, no rank fields proposed, no branch opened for code changes. Next step: founder ruling session, then a separate build spec.**
