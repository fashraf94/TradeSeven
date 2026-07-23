# Archetype Config — Read-Only Verification Note

**Scope:** read-only verification (no code, no branch, no writes).
**Preamble (BUILD_RULES §3):** `git fetch origin` run at session start. HEAD `5c04de2` on `claude/archetype-config-verify-xm8b04`, clean tree. Every claim below carries a repo-relative `file:line` + VERIFIED (read this session) marker. Anchors re-verified at this HEAD; inherited census anchors (`docs/ARCHETYPE_CONTROL_CENSUS_REPORT_V1.md`) were **not** trusted — several drifted (noted inline).
**Method:** 5-dimension parallel verification + adversarial refutation pass (20 agents) that specifically attacked every negative / dead-field / hard-vs-soft / "differs-from-copy" claim. Load-bearing crux items were also re-checked by hand.

---

## Executive verdict table

| # | Dimension | Verdict |
|---|---|---|
| 1 | Guardian wires | All 4 wire entries VERIFIED. Dead-field sweep: **6 guardian fields are DEAD** (zero behavioral readers). File header overclaims — regime router / conviction scoring / trade frequency are all dead. |
| 2 | Contrarian constraint | **SOFT prompt only** — no code exclusion. "≥5 from bottom-3" is against the **25–35 shortlist**, not the 6-pick book. "Avoid top sector" = ranking bias, not a hard exclusion. |
| 3 | Diversifier weights | Full entry sums to 1.00. The 0.70 beyond sectorDiversity 0.30 is **LIVE** — consumed nightly and read downstream. |
| 4 | Canonicality | 6 DEF docs listed. Claimed **Contrarian Zone-4 staleness does NOT hold** — code zone-encoding == snapshot byte-identical; markdown DEFs are the older-grounded frozen artifacts. |
| 5 | Signal table | `bbFit` is NOT a field (it's `baggerBombFit`). `momentumScore`, `return1M`, `arch_scores.*` are REAL/persisted. `inverseComposite`/`sectorDiversity` are rank-time-derived. Cron: `stabilization`/`turn` DENIED, `resistance`/`oversold` confirmed (S/R level; RSI zone label). |

---

## 1. GUARDIAN WIRES

**The four live wire entries** (all VERIFIED):

| Wire | file:line | Guardian value |
|---|---|---|
| `ARCHETYPE_WEIGHTS.guardian` | `api/_utils/archetypeScoring.js:55-62` | fund **0.30** / tech **0.20** / baggerBombFit **0.10** / atrPercentile **0.05** / inverseComposite **0.00** / sectorDiversity **0.35** — sum **1.00** |
| `ARCHETYPE_TEMPERATURES.guardian` | `api/_utils/archetypeScoring.js:74` | `{ sonnet: 0.3, haiku: 0.2 }` |
| `ARCHETYPE_CONSTRAINTS.guardian` | `api/_utils/archetypeScoring.js:91-92` | "…≥5 stocks with fundamentalScore>60. Spread across ≥6 sectors. Avoid stocks with ATR percentile>0.75. Your edge is avoiding busts, not chasing baggers." |
| `hftConfig.guardian` | `api/_utils/agentArchetypeConfig.js:195-210` | `forcedRotation.enabled: **false**` (:199); `hurdleFloor` default atr **0.5** (:200-208); `swapWindow` cap **2** / window **120min** (:209) |

**Dead-field trap check (guardian config object) — VERIFIED reader census:**

- **LIVE (real physics):** WEIGHTS → `computeArchetypeRankings` (`archetypeScoring.js:108`); TEMPERATURES → `decide.js:252`, `tournamentAgentBoards.js:363`; CONSTRAINTS → `agentPromptAssembly.js:22-23`, `tournamentAgentBoards.js:121-122` (soft prompt); `hftConfig.forcedRotation.enabled` → `agentRiskManager.js:154-159`; `hftConfig.hurdleFloor.*` → `agentRiskManager.js:315-344` (called `agent-evaluate.js:1390,2118`); `hftConfig.swapWindow.*` → `agent-evaluate.js:1341-1344`; `label` → `getArchetypeLabel`; `defaultConfig` → `create-profile.js:108-111`, `tournamentCpu.js:73-75`.
- **LIVE but DISPLAY-ONLY (correction — prior census marked these DEAD):** `sectorConcentrationCap` (guardian:2) → `behaviorFingerprint.js:152` → `CharacterKit.jsx:89-90` (fingerprint chart, **not** the hard sector cap — that's the `se-07` maxSectorWeight guardrail); `defaultPreset` ('defensive') → `behaviorFingerprint.js:157` (discipline axis) + profile seed. Real readers, but display/fingerprint only — no runtime physics.
- **DEAD — zero behavioral readers** (only the `archetypeRegistry.js` projection, which its own header `:5-8` declares has **zero production readers**, + the committed snapshot + tests). All CONFIRMED by adversarial refutation (tried to find a reader, found none):
  - `convictionMods.convictionThreshold` (guardian 1.2) — `agentArchetypeConfig.js:211-213`
  - `regimePreferences.favoredStrategies` (`['rs_momentum']`) — `:191` — the regime classifier reads `presetConfig.regime.favoredStrategies` (`agentRegimeClassifier.js:135-148`), a **different namespace**; even that reader (`getPresetAdjustedStrategies`) is imported but never called. Prior census claim that this field feeds the classifier is **WRONG at HEAD**.
  - `regimePreferences.avoidedStrategies` (`['volatility_squeeze']`) — `:192`
  - `regimePreferences.canEnterDistressed` (`false`) — `:193` — distressed swap-in is **universal** (`platformGuardrails.js:58-64`), the flag gates nothing.
  - `tradeFrequency` ('low') — `:215`
  - `avatarColors` (config field) — `:217` — every runtime reader uses the **agent-document** field `agent.avatarColors`, never `ARCHETYPE_CONFIGS[x].avatarColors`.
  - `forcedRotation.ticksThreshold` / `winnerThreshold` — DEAD-**for-guardian** (reached only inside the `if (fr?.enabled …)` block, false for guardian).
- **Header overclaim:** `agentArchetypeConfig.js:2-4` claims "real mechanical effects on the regime router, risk manager, conviction scoring, and trade frequency." At HEAD only the **risk-manager / hftConfig** path is real; regime router (`regimePreferences`), conviction scoring (`convictionMods`), and trade frequency (`tradeFrequency`) are all dead.

## 2. CONTRARIAN CONSTRAINT

Definition: `archetypeScoring.js:83-84` — "Your shortlist MUST include at least 5 stocks from today's bottom 3 performing sectors. Avoid the top-performing sector entirely."

- **Hard vs soft → SOFT (ranking bias), CONFIRMED.** The string is injected verbatim into LLM system prompts only — Sonnet strategy prompt (`agentPromptAssembly.js:22-24,35`) and tournament board prompt (`tournamentAgentBoards.js:121-123`). **No filter/clamp/array-removal** strips top-sector stocks anywhere (searched `decide.js`, `tournamentAgentDraft.js`, `agentGuardrails.js`). "Avoid the top sector entirely" is an instruction the model may or may not follow, not a code exclusion.
- **The only hard sector guardrail is Diversifier-exclusive.** `agentGuardrails.js:71` returns null unless `archetype === 'diversifier'`; `maxSectorWeight` (`:272-292`) is a generic concentration cap with no notion of today's top/bottom sectors and is never keyed to contrarian.
- **Book-size arithmetic, CONFIRMED.** The "≥5" floor is worded against the **shortlist = 25–35 names** (`agentPromptAssembly.js:26,166`) → **5 of ~25–35 ≈ 14–20%** of the candidate pool. It does **not** bind the final portfolio, which is **6 picks** (`AGENT_PICKS_PER_AGENT = 6`, `leagueTournament.js:74`; draft loop `tournamentAgentDraft.js:113`). No code re-applies the floor to the 6-pick book. (If mis-applied to the book it would be 5-of-6, but the string says "shortlist" and nothing enforces it there.)
- The constraint never reaches the Haiku eval/swap path — `agentEvalPromptAssembly.js` doesn't import `ARCHETYPE_CONSTRAINTS` at all.

## 3. DIVERSIFIER WEIGHTS

Full entry `archetypeScoring.js:31-38` (VERIFIED, sum **1.00**):

| dim | weight |
|---|---|
| fundamentalScore | 0.25 |
| technicalScore | 0.20 |
| baggerBombFit | 0.20 |
| atrPercentile | 0.05 |
| inverseComposite | 0.00 |
| sectorDiversity | 0.30 |

The **~0.70 beyond sectorDiversity** = fund 0.25 + tech 0.20 + baggerBombFit 0.20 + atr 0.05 (+ inverseComposite 0.00).

**Verdict: the 0.70 is LIVE, not dormant (CONFIRMED by refutation).**
- `computeArchetypeRankings` iterates **every** weight key — `for (const [dim, weight] of Object.entries(weights))` (`archetypeScoring.js:130`) — so all four non-zero contributors multiply into `archetypeScore`. (`inverseComposite` 0.00 is the only inert term — visited but ×0.)
- `diversifier` **is** in the nightly `ARCHETYPES` precompute (`compute-index-intelligence.js:48`, loop `:1058-1067`) → `arch_scores.diversifier` is written to every stock and persisted.
- Downstream readers of that number: League draft fit board `boardModel.js:56-64,117-129` (ranks the pool by `arch_scores.diversifier`); screener dot-path allowlist `screenStocks.js:40-54`; voice layer rankBy `voiceLayerPrompt.js:2240`.

So at the code level the full vector is read nightly and consumed downstream. ("Never read this program" holds only in the sense that prior write-ups surfaced only the 0.30 — the 0.70 is live in the pipeline.)

## 4. CANONICALITY

**Six archetype DEF docs (repo root, all VERIFIED to exist; glob `ARCHETYPE_DEF*` returns exactly these):**

| Doc | code-id |
|---|---|
| `ARCHETYPE_DEF_CAPITAL_PRESERVER_2026-06-24.md` | guardian |
| `ARCHETYPE_DEF_CONTRARIAN_2026-06-24.md` | contrarian |
| `ARCHETYPE_DEF_DIVERSIFIER_2026-06-24.md` | diversifier |
| `ARCHETYPE_DEF_FUNDAMENTAL_INVESTOR_2026-06-24.md` | analyst |
| `ARCHETYPE_DEF_SPECULATOR_2026-06-24.md` | degen |
| `ARCHETYPE_DEF_TREND_FOLLOWER_TEMPLATE_2026-06-24.md` | momentum_chaser |

**The claimed Contrarian Zone-4 staleness did NOT survive verification (two refutations + hand-check):**
- The first-pass finding flagged snapshot "flip / claim" (`registry-snapshot json:1363`) vs markdown DEF "claim / rank at setup" (no "flip"). But:
- **"flip" is the generic bidirectional tournament lever** — `voiceLayerPrompt.js:2543` defines it as "FLIP a position long↔short," archetype-independent. Not a "stale short-flip lever."
- **Code zone-encoding == snapshot, byte-identical.** `src/data/archetypeAdjustments.js:83` (contrarian `outOfScopeUserLever`) is byte-for-byte equal to snapshot `json:1363` (hand-verified). A programmatic diff of all **4 zones × 6 archetypes** between `archetypeAdjustments.js` and the snapshot matched everywhere. `archetypeAdjustments.js:20` labels itself the *"corrected mode-aware"* model — so **code + snapshot ARE the corrected pair**.
- **Staleness direction is reversed from the premise.** The markdown DEFs self-declare grounding on a June-23/24 config extract (HEAD `f8c2316`) and their blobs are byte-identical across their entire git history — no in-repo "correction" event. The snapshot is machine-generated 2026-07-23 from live wires. So the markdown DEF is the **older-grounded frozen artifact**; the snapshot reflects the fresher state.
- Substantive quantitative anchors match DEF ↔ snapshot for all six (stops, sector caps, fundamental-exclusion thresholds).

**Verdict:** all six are substantively **CONSISTENT** between the live code zone-encoding and the snapshot. The only difference is prose compaction in the markdown DEFs (they enumerate specific actions rather than the compact "flip / claim" verb) — cosmetic, not a strategy divergence. One systematic authoring nit across all six: the DEF "Voice (seed)" block attributes an expanded quote to `archetypeIdentity.js` that lives only in the markdown (real `archetypeIdentity.js:30-31` voice is terser) — attribution imprecision, not per-archetype staleness.

## 5. SIGNAL TABLE

Real-field status at eval/ranking time (all VERIFIED). Producer = where the field is *written*, not consumed:

| Field | Status | Producer file:line |
|---|---|---|
| `atrPercentile` | **REAL, persisted** | `compute-index-intelligence.js:916-925,1009` (cross-sectional percentile) |
| `bbFit` | **NOT a field — ALIAS** of `baggerBombFit` | `bbFit` is only a local var / `BB_FIT` CSV column (`agentPromptAssembly.js:227,230`). Real field `baggerBombFit` ← `gameModeScoring.js` `computeGameModeFits`, written `compute-index-intelligence.js:1008` |
| `fundamentalScore` | **REAL, persisted** | `compute-index-intelligence.js:1000` (← `peerRankings` composite) |
| `momentumScore` | **REAL, persisted; DISTINCT from technicalScore** | `momentumScoring.js:528` (`percentileRank(bmz)`), written `compute-index-intelligence.js:1015`. `technicalScore` is a separate producer (`computeTechnicalScore`, `:1003`) |
| `arch_scores.*` | **REAL, persisted** | `compute-index-intelligence.js:1054-1067` — 6 keys (the archetype names) → 0-100 number |
| `inverseComposite` | **DERIVED at rank-time, NOT persisted** | `archetypeScoring.js:124` (`100 - compositeScore`) |
| `sectorDiversity` | **DERIVED at rank-time, NOT persisted** | `archetypeScoring.js:110-126` (universe-dependent) |
| `return1M` | **REAL, persisted** | `returnCalculations.js:21,71` (21-bar), written `compute-index-intelligence.js:1035` — contradicts any "return1M absent" claim |

**Cron technical indicator list (actual, `api/cron/compute-index-intelligence.js:661-758,320-346`, VERIFIED):**
SMA 20/50/200 · RSI-14 (+zone) · MACD 12/26/9 (fresh bull/bear cross) · ATR-14 · NR7 + dailyRange · Bollinger 20/2 (bandwidth/%B) · VolumeProfile RVOL · pivot levels · multi-TF trend (`classifyTrend`) · swing highs/lows + nearest S/R (`findNearestLevels`) · RSI divergence · candle pattern · RS vs SPY (rs20/rs50) + sector RS · `computeTechnicalScore` composite · `computeMomentumRankings` · returns 1W/1M/3M/YTD/12M. Index-level adds volumeRatio and 52-week range/rangePosition.

**The disputed `stabilization/turn/resistance/oversold` set (CONFIRMED):**
- `resistance` — **REAL:** `levels.nearestResistance` (`analyticalPrimitives.js:161`, mirrored `compute-index-intelligence.js:1025`).
- `oversold` — **CONFIRMED only as an RSI zone string** (`technicalCalculations.js:95`, `rsi<=30 ? 'oversold'`), not a standalone persisted field.
- `stabilization` — **DENIED.** `grep -i stabiliz` over `api/` = 0 hits (only prose in docs/snapshots).
- `turn` — **DENIED (as an indicator).** Every `\bturn\b` hit in `api/` is a conversational-turn reference, never a computed market field.

This matches the Contrarian DEF's own Zone-2 caveat (`ARCHETYPE_DEF_CONTRARIAN_2026-06-24.md:47`): "confirm the real indicator set at build; soften the language to what's actually computed" — of its "turn / basing / stabilizing / resistance / oversold" reads, only resistance (S/R levels) and oversold (RSI zone) are actually computed.

---

---

# Addendum — items 6 & 7 (same read-only pass, HEAD `5c04de2`)

| # | Dimension | Verdict |
|---|---|---|
| 6 | FI floor semantics | **SOFT prompt only.** No hard `fundamentalScore<40` enforcement anywhere. Both clauses reach only the **draft-time** Sonnet assemblers, never the per-tick eval/swap path → "<40 exclude" and ">70 ≥5" are draft-composition, not ongoing. The DEF doc's "real hard exclusion" is refuted. |
| 7 | Guardian exit writers | **"Winners are simply held" is an OVERCLAIM.** ≥3 profit-exit paths apply to guardian (always-on trail-stop, discretionary Haiku swap, equippable trailing-stop guardrail; + a vwap edge). Only forced-rotation is genuinely off. |

## 6. FI (analyst) FLOOR SEMANTICS

**Exact text** — `ARCHETYPE_CONSTRAINTS.analyst`, `archetypeScoring.js:89-90` (VERIFIED):
> "Your shortlist MUST include at least 5 stocks with fundamentalScore above 70. Exclude any stock with fundamentalScore below 40."

**Enforcement points (VERIFIED):** it is a **soft prompt string**, injected only by the two **draft-time** assemblers:
- Casual strategy path — `agentPromptAssembly.js:5,22-23,35` (`buildStrategySystemPrompt`), caller `decide.js:302` (builds the 25–35 shortlist, once).
- Tournament draft board — `tournamentAgentBoards.js:49,121-122,368` (`buildBoardSystemPrompt`), draft-time.
- **NOT the eval/swap path:** `agentEvalPromptAssembly.js` never imports `ARCHETYPE_CONSTRAINTS`; `buildEvalSystemPrompt` (`:43`, called per-tick at `agent-evaluate.js:1923`) never carries the clause.

**"<40 exclude" → SHORTLIST-ONLY, SOFT (CONFIRMED by refutation).** There is **no** hard `fundamentalScore<40` gate — `fundamentalScore` has **0 occurrences** in `agentGuardrails.js`, `decide.js`, `agent-evaluate.js`, `agentScoring.js`. No candidate-pool filter, no swap-time gate. The DEF doc's "real fundamentalScore<40 exclusion" traces to identity prose only — `src/data/archetypeAdjustments.js:171` (analyst immutableCore: "…a real fundamentalScore<40 exclusion, **made into identity**…"). Adjacent-but-non-refuting: `seasonRuleRegistry.js:149-162` SE-05 "Fundamental Floor" reads a *different* field (`overallScore`) vs a *configurable* `minScore` (not 40), is `PRIORITY.SOFT`, and lives in the season-sim subsystem — not the archetype draft/eval path.

**">70 ≥5" → DRAFT-COMPOSITION, not ongoing (CONFIRMED).** Same single string, same two draft-time injectors; never re-checked at swap (the eval assembler doesn't carry it). It is a one-time soft draft target that the Sonnet model may or may not satisfy — nothing re-imposes the "5-above-70" count when swaps are considered.

## 7. GUARDIAN EXIT WRITERS — "winners are simply held" is an overclaim

Every runtime path that can exit a **guardian** position **at a profit** (VERIFIED; completeness-swept):

| Path | file:line | Fires in profit? | Applies to guardian? |
|---|---|---|---|
| **TRAIL_STOP `stepped_trail`** | `agentRiskManager.js:137-144` | **Yes — by construction** (atrMultiplier ≥ trailATR). Guardian defensive preset sets `trailStopATR=**1.0**` (`agentPresetConfig.js:56`) → fires at **+1.0x ATR** below the 5-min SMA20 | **Yes — always-on**, preset-driven, never archetype-gated. **The definitive counterexample.** |
| **Discretionary Haiku swap** (`haiku_decision`) | `agent-evaluate.js:2089-2221` (gate `:2118`, cap `:2135`) | Yes — can rotate a non-LOCKed winner into a better bench name | Yes — gated only by hurdleFloor (guardian 0.5 + benchPositive) and the 2/120min cap; neither blocks profit-taking |
| **`guardrail_trailingStop`** | `agentGuardrails.js:246-267` | Yes — fires on drawdown-from-peak while still net-above-entry | Yes, **if user equips** a trailingStop guardrail (archetype-agnostic; only the Diversifier sector cap is archetype-gated, `:71`) |
| `vwap_failure` SWAP_OUT (edge) | `agentRiskManager.js:109-120` | Possible — VWAP-relative, not entry-relative; a name up-on-day can lose VWAP late | Yes — guardian defensive is the **most** sensitive (`vwapFailureTicks=1`, `agentPresetConfig.js:53`) |

**Not profit-exits / not exits:**
- `bust_avoidance` (`agentRiskManager.js:100-107`) — loss-side only (guardian bustBuffer −0.75); `guardrail_stopLoss` (`agentGuardrails.js:208-244`) — loss-side.
- `threshold_proximity` **LOCK** (`agentRiskManager.js:122-135`) — **not an exit**; it *protects* a winner near a 1.0/1.5/2.0x ATR bonus band from being swapped.
- `profitTarget` guardrail (`agentGuardrails.js:341-364`) — soft `action:'note'`, explicitly no override.

**Genuinely OFF for guardian:** `stagnation` forced-rotation (`agentRiskManager.js:154-166`) — gated on `forcedRotation.enabled`, which is `false` for guardian (`agentArchetypeConfig.js:199`); confirmed no override flips it (resolveHftConfig has zero per-mode deltas). **Dormant (launch-guarded):** `gameplan_rotation` / copilot-proposal swaps (autopilot-only launch guard, `agent-evaluate.js:2099-2105`). **Settlement** (`completeBattle`) scores the held book in place — not a swap exit.

**Verdict:** guardian is **not** buy-and-hold on winners. It has an always-on deterministic profit exit (trail-stop at +1.0x ATR on a short-MA break), a discretionary Haiku rotation of non-locked winners, and an equippable trailing-stop guardrail. What guardian *lacks* vs active archetypes is the forced-rotation churn, and its 2/120min cap limits swap **frequency** — not the **existence** of profit exits. The only winners structurally protected are those near an ATR bonus band (via LOCK).

---

*Read-only. No files edited, no branch pushed. Reported for founder tasking; any follow-up (e.g. resyncing the frozen markdown DEFs to live wires, the `agentArchetypeConfig.js:2-4` header overclaim, or reconciling the FI/guardian DEF "real exclusion" / "holds winners" language with the soft/exit reality) is separate work per BUILD_RULES §3.*
