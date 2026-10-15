# BaggerBomb stock thresholds — Phase 0 report (read-only)

October 15, 2026. Claude Code (Opus) for Flash; Fable writes the build prompt from this. Read-only session; it ends at a hard STOP.

## For Flash, in plain English

1. **Your battle.** The battle that started at 12:35 am today holds UNP and HUM, with ACN on the bench. Its modal sets UNP's TenBagger at **$287.85**, only **+0.48%** above your $286.48 entry. The old system gives each stock a threshold equal to 8 times its volatility *rank* (0 to 1), not its actual daily movement. UNP ranks near the bottom (3rd percentile), so it gets 0.24%. UNP opened at $290 this morning, five times that threshold, so it hit TenBagger at the opening bell. A normal UNP day moves about 1.4%. The measured model would put TenBagger at **$294.47**.
2. **Across all 228 stocks we can measure, the old numbers rank stocks in the right order but on the wrong scale.** Quiet stocks (Duke, CSX, UNP, KO) get thresholds 4 to 16 times too small. Busy stocks (HUM, MPC, INTU) get thresholds 1.5 to 2 times too big. Your CPU opponent uses a flat 2.5% on every stock.
3. **The live price feed is 15 minutes behind, sometimes up to 17, and moves in whole minutes.** It never showed two prices for the same minute. The game stops scoring at the 3:45 pm check, and that check sees 3:30 pm prices, so the last half hour of trading never counts.
4. **Late-start cutoff.** I recommend refusing new measured battles in the last **45 minutes** before the close. That leaves 2 scoring checks and about 30 minutes of real market movement. 20 minutes is the bare minimum for even one check.
5. **Three findings change the plan:**
   - Turning the code switch on without its control document blocks *every* new battle for *everyone*. The pilot allowlist needs a small change in a protected file.
   - The game keeps only its latest score snapshot. "Settle on the last good snapshot" therefore really means "the latest one if it is good, otherwise result unavailable", unless the build adds a new saved record.
   - Battles started outside market hours are not covered by any ruling. That is 37% of all battles, including yours.
6. **Made-up numbers.** The modal's "Historical (30 days)" box is placeholder data for every stock: UNP, HUM and ACN all show 40% / 2.0% / 12 of 30. The "Buy" rating can also be a default.

## Verdict table

| Task | Verdict |
|---|---|
| A. Preamble | `git fetch origin` ran first. On the app's session branch `claude/baggerbomb-stock-thresholds-phase-0-a90be2` at **495ee07b = origin/main**, clean tree. Nothing was created, committed or pushed. |
| B1. Battles | 1 active plus 30 completed in the last 7 days; 24 of them are tournament battles. **No battle carries `scoring.stockThresholdModel`.** |
| B2. Founder's battle | **`io4sC…` (active, created 00:35 ET, expires 20:00 ET).** It holds UNP and HUM, with ACN on the bench. Earlier candidates: `L7wzt…` (Oct 13: HUM, ACN, UNP) and `rFoJH…` (Oct 12: ACN, HUM, UNP). **Flash to confirm.** All three are legacy. The UNP case is explained (§B2). |
| B3. Zero checks | Battles with the model field, any value: **0 of 588** (`!= null` 0, `== null` 0). `stockThresholdInputs`: **0**. `stockThresholdControl` docs: **0**; `admission` is **absent**. |
| B4. FT_QA / Cipher | FT_QA's agent **Cipher** exists, holds a deploy-ready decision and is free (`activeBattleId: null`, no deploy lock). It has 5 completed full-day agent-vs-CPU battles, the last on Oct 14. It **can** create one, subject to the pilot gate in E6. |
| C. Live feed (interim; final after the 16:50 ET tail) | Delay **15:01 to 17:01** after the provider's minute stamp (median 15:19). Whole-minute stamps, per symbol. **0** same-minute/different-price cases, **0** missing or non-numeric fields. |
| C4. N for Ruling 2 | **Recommend N = 45** (2 scoreable ticks, about 30 minutes of market). Hard floor N = 20 (1 tick). The last evaluating tick is 15:45 ET (`isMarketOpen` gate). |
| D. Universe | **228 qualified** on arithmetic, **11 refused** (catalog). **228 EODHD calls.** Legacy rank and measured ATR agree on order (Spearman **0.987**) but not scale: median legacy/measured ratio **1.56**, 21 names below 0.5×, 20 above 2×. |
| E1. Timing | Ruling 1 touches `stockThresholdModel.js` :52, :61, :62, :63, :80 plus admission :141 and the exit at :230–235. **Watch the :61 trap.** K2-6 disappears if the stand-in comes from the receipt (Branch A, recommended). |
| E2. Unavailable frame | Four corrected early returns skip the risk pass, standing orders and `finalizeCronState`. About 20 sites coerce a null score to **0**. |
| E3. Expiry | The "Result unavailable" disposition exists (`agent-evaluate.js:6694`) but is **dead**: `completeBattle` returns at :6775 first, and the battle stays active forever. **Only the latest frame is stored.** |
| E4. Readers | Corrected-aware: research modal and chart, Why, live header, row enrichment, daily scores, completion. **Legacy-only on corrected games:** voice cache, chat prompt, reflection's threshold block, pattern-logger hits, film-tape replay, learning capture, bagger moment (inert), ManageStation (null-safe). |
| E5. Prompt | The fenced static text `agentEvalPromptAssembly.js:366` reads "ATR multiplier = priceChange% / baseATR". That contradicts the corrected multiplier (`stockThresholdModel.js:69`, frozen measured %). |
| E6. Admission | **The prompt's assumption is false.** Flag `true` with no control doc returns **503 for every regular creation** (`shared_admission_closed`); it is not legacy. The allowlist slot is admission :46–47. `agentBattleService.js:327`/`:336` key on the global flag. Firestore rules deny all client access (catch-all). |
| E7. Identity | The 5-tuple is hard-coded once (`src/utils/stockThresholdModel.js:6–10`). Both hashes are recomputed from the policy JSON when the module loads. Retiring v1 is safe because 0 v1 battles exist. |
| E8. Overlaps | The corrected **crypto** swap accepts a `fallback: true` adjusted-close fill on entry but refuses it on exit. **PR 966 is merged** (`531c2088`) and does not overlap. The non-200 adjusted-close fallback is still on main. |
| E9. Fence | Beyond §6: `agentBattleService.js:327/:336` (selection semantics) and the static prompt block `agentEvalPromptAssembly.js:356–397`/`:206`/`:541–547`. Ruling 3 needs **no** risk-manager edit. |
| F. Size | Estimated **38–45 files, about 2,200–3,500 lines including tests**. One branch and one PR is feasible, but well above the review threshold. **11 founder decisions** are listed in F2. |

---

## A. Preamble

- `git fetch origin` was the first command (BUILD_RULES §3). `origin/main` = `495ee07b` (Merge PR #962). The worktree branch is the app-created `claude/baggerbomb-stock-thresholds-phase-0-a90be2` at the same SHA, and the tree is clean. I did not switch branches. Every code read is therefore of current main.
- **Read-only held:**
  - no branch, commit, push, flag, env, rules or deploy change;
  - no Firestore write (Admin SDK `get`, `count` and `select` only);
  - no EODHD call other than GET.
  - Scripts and raw dumps live only in the session scratchpad, outside the repo. No uid, API key or email appears in this report. Owners are labelled `owner-n`, and battle ids are cut to 5 characters, as in the cockpit week-1 audit.
- **Citation markers:**
  - **VERIFIED**: I re-read the line in this session.
  - **VERIFIED (sub)**: a read-only subagent quoted the line verbatim in this session, and I did not re-read it.
  - **ASSUMED**: inferred.
  - Four isolated read-only subagents mapped E1–E8. I re-read every load-bearing line they cited.
- **Owner labels:**
  - **founder = owner-1**: agent "shadow". Its battle `uKKR6…` is the one the cockpit audit labels founder (`docs/audits/20261009_COCKPIT_LIVE_WEEK1_READ.md:75`).
  - **FT_QA = owner-12**: agent Cipher. Its battle `q84cK…` is the one that audit labels FT_QA (same file, :75).
  - The server-only allowlist env (`COCKPIT_ALLOWLIST_UIDS`) is not in the local env files, so the labels come from those audit matches, not from env.
  - `TEST_USER_UID` / `TEST_USER_AGENT_ID` match neither account.

## B. The founder's battle (production, Admin SDK reads only)

### B1. Active battles and the last 7 days

Read at 2026-10-15T17:11Z: 1 active, 31 in the window (`expiresAt ≥ now − 7 d`). The tournament rows have no embedded CPU (`decide.js:1557` `opponent: null`).

| Battle | Status | gameMode | Duration | Created (ET) | Expires (ET) | Owner | Agent | Agent side held | CPU side held | stockThresholdModel |
|---|---|---|---|---|---|---|---|---|---|---|
| 5gnep… | completed | baggerbomb_tournament | fullday | Oct 8, 07:00 | Oct 8, 16:00 | founder (owner-1) | shadow | V, PM, ZS, AFRM, AMD, CTVA | — (no embedded CPU) | absent |
| Lt6Sg… | completed | baggerbomb_tournament | fullday | Oct 8, 07:01 | Oct 8, 16:00 | owner-11 | CPU — Capital Preserver | VLO, META, GOOGL, PSX, GOOG, FCX | — (no embedded CPU) | absent |
| 1I37Z… | completed | baggerbomb_tournament | fullday | Oct 8, 07:01 | Oct 8, 16:00 | owner-2 | CPU — Trend Follower | GME, MPC, AMAT, INTC, SHOP, GEV | — (no embedded CPU) | absent |
| DlhBT… | completed | baggerbomb_tournament | fullday | Oct 8, 07:01 | Oct 8, 16:00 | owner-6 | CPU — Contrarian | ACN, QCOM, CRWD, SNOW, CRWV, CEG | — (no embedded CPU) | absent |
| GUWLz… | completed | baggerbomb_tournament | fullday | Oct 8, 07:02 | Oct 8, 16:00 | owner-7 | 1Agent | CTVA, AFRM, AMAT, ZS, PM, FMC | — (no embedded CPU) | absent |
| 6vXTl… | completed | baggerbomb_tournament | fullday | Oct 8, 07:02 | Oct 8, 16:00 | owner-5 | CPU — Diversifier | VLO, MPC, PSX, GOOG, XOM, PWR | — (no embedded CPU) | absent |
| 1jPMs… | completed | baggerbomb_tournament | fullday | Oct 8, 07:02 | Oct 8, 16:00 | owner-3 | CPU — Speculator | ACN, PANW, RKLB, AMD, SHOP, CRWD | — (no embedded CPU) | absent |
| InH6s… | completed | baggerbomb_tournament | fullday | Oct 8, 07:02 | Oct 8, 16:00 | owner-8 | CPU — Fundamental Investor | MU, GME, META, GOOGL, PLTR, FCX | — (no embedded CPU) | absent |
| PMhbP… | completed | baggerbomb_tournament | fullday | Oct 8, 07:03 | Oct 8, 16:00 | founder (owner-1) | shadow | PM, COP, ZS, CTVA, AFRM, CVX | — (no embedded CPU) | absent |
| 1mmuX… | completed | baggerbomb_tournament | fullday | Oct 8, 07:03 | Oct 8, 16:00 | owner-4 | CPU — Diversifier | VLO, MPC, PSX, GOOG, XOM, FCX | — (no embedded CPU) | absent |
| LKT3p… | completed | baggerbomb_tournament | fullday | Oct 8, 07:03 | Oct 8, 16:00 | owner-10 | CPU — Speculator | INTC, ACN, RKLB, SHOP, CRWD, CRWV | — (no embedded CPU) | absent |
| K6rZ0… | completed | baggerbomb_tournament | fullday | Oct 8, 07:04 | Oct 8, 16:00 | owner-9 | CPU — Fundamental Investor | MU, GME, META, GOOGL, PLTR, NVDA | — (no embedded CPU) | absent |
| nBukr… | completed | baggerbomb_tournament | fullday | Oct 9, 07:00 | Oct 9, 16:00 | founder (owner-1) | shadow | V, HUM, ZS, AFRM, AMT, CTVA | — (no embedded CPU) | absent |
| H5prZ… | completed | baggerbomb_tournament | fullday | Oct 9, 07:01 | Oct 9, 16:00 | owner-11 | CPU — Capital Preserver | VLO, META, GOOGL, PSX, GOOG, FCX | — (no embedded CPU) | absent |
| UPLgs… | completed | baggerbomb_tournament | fullday | Oct 9, 07:01 | Oct 9, 16:00 | owner-2 | CPU — Trend Follower | GME, MPC, AMAT, INTC, SHOP, GEV | — (no embedded CPU) | absent |
| NPRYQ… | completed | baggerbomb_tournament | fullday | Oct 9, 07:01 | Oct 9, 16:00 | owner-6 | CPU — Contrarian | ACN, QCOM, CRWD, SNOW, CRWV, CEG | — (no embedded CPU) | absent |
| EH5dV… | completed | baggerbomb_tournament | fullday | Oct 9, 07:02 | Oct 9, 16:00 | owner-7 | 1Agent | CTVA, AFRM, AMT, ZS, CCI, HUM | — (no embedded CPU) | absent |
| s3Evo… | completed | baggerbomb_tournament | fullday | Oct 9, 07:02 | Oct 9, 16:00 | owner-5 | CPU — Diversifier | VLO, MPC, PSX, GOOG, XOM, PWR | — (no embedded CPU) | absent |
| nVeA1… | completed | baggerbomb_tournament | fullday | Oct 9, 07:02 | Oct 9, 16:00 | owner-3 | CPU — Speculator | ACN, PANW, RKLB, AMD, SHOP, CRWD | — (no embedded CPU) | absent |
| AVSXd… | completed | baggerbomb_tournament | fullday | Oct 9, 07:03 | Oct 9, 16:00 | owner-8 | CPU — Fundamental Investor | MU, GME, META, GOOGL, PLTR, FCX | — (no embedded CPU) | absent |
| 3vzKW… | completed | baggerbomb_tournament | fullday | Oct 9, 07:03 | Oct 9, 16:00 | founder (owner-1) | shadow | HUM, COP, ZS, CTVA, AFRM, CVX | — (no embedded CPU) | absent |
| lF2Y1… | completed | baggerbomb_tournament | fullday | Oct 9, 07:03 | Oct 9, 16:00 | owner-4 | CPU — Diversifier | VLO, MPC, PSX, GOOG, XOM, FCX | — (no embedded CPU) | absent |
| V8LPc… | completed | baggerbomb_tournament | fullday | Oct 9, 07:04 | Oct 9, 16:00 | owner-10 | CPU — Speculator | INTC, ACN, RKLB, SHOP, CRWD, CRWV | — (no embedded CPU) | absent |
| Tt7cr… | completed | baggerbomb_tournament | fullday | Oct 9, 07:04 | Oct 9, 16:00 | owner-9 | CPU — Fundamental Investor | MU, GME, META, GOOGL, PLTR, NVDA | — (no embedded CPU) | absent |
| uKKR6… | completed | baggerbomb_agent | fullday | Oct 9, 09:34 | Oct 9, 20:00 | founder (owner-1) | shadow | VLO, MPC, PANW, PLTR, ZS, HUM, ETH | NOW, NVO, OKE, EBAY, CSX, PSA, SOL | absent |
| rFoJH… | completed | baggerbomb_agent | fullday | Oct 12, 12:28 | Oct 12, 20:00 | founder (owner-1) | shadow | GME, ACN, HUM, AFRM, UNP, CSX, BTC | KLAC, BMY, VLO, NKE, ETN, WMB, XRP | absent |
| NoWNY… | completed | baggerbomb_agent | fullday | Oct 12, 14:18 | Oct 12, 20:00 | FT_QA (owner-12) | Cipher | META, PLTR, LLY, AMZN, HUM, ISRG, SOL | ZS, AMGN, EOG, F, BA, DD, ETH | absent |
| L7wzt… | completed | baggerbomb_agent | fullday | Oct 13, 13:21 | Oct 13, 20:00 | founder (owner-1) | shadow | HUM, GME, ACN, CTVA, UNP, CSX, BTC | CRWD, ELV, OXY, CMG, HON, ROST, ADA | absent |
| vwuCE… | completed | baggerbomb_agent | fullday | Oct 14, 11:38 | Oct 14, 20:00 | founder (owner-1) | shadow | HUM, LLY, MPC, ACN, SHOP, AMGN, SOL | AMAT, ISRG, TRGP, AZO, DE, EQR, ETH | absent |
| BJVQK… | completed | baggerbomb_agent | fullday | Oct 14, 13:52 | Oct 14, 20:00 | FT_QA (owner-12) | Cipher | MPC, VLO, GME, LLY, MA, PFE, BTC | ZS, BSX, DVN, DKNG, DE, LOW, BNB | absent |
| io4sC… | active | baggerbomb_agent | fullday | Oct 15, 00:35 | Oct 15, 20:00 | founder (owner-1) | shadow | MPC, VLO, GME, HUM, UNP, CSX, BTC | INTU, ELV, OXY, ROST, HON, PSX, BNB | absent |

### B2. The battle holding UNP / HUM / ACN

**`io4sC…`** (active):
- Agent "shadow", archetype diversifier.
- Created 2026-10-15 00:35 ET; trading day Oct 15; expires 20:00 ET (crypto-extended close).
- No swaps yet. Score 170 vs CPU 240 at the 13:00 ET tick.
- UNP and HUM are held. ACN is on the agent's bench (in `startingPrices` at $215.03, not held).

**Two earlier battles also held all three:**

| Battle | Date | UNP | HUM | ACN |
|---|---|---|---|---|
| `L7wzt…` | Oct 13 | 0.16% | 7.52% | 7.6% |
| `rFoJH…` | Oct 12 | 0.16% | 7.52% | 7.52% |

The same UNP pattern appears in both.

**How the modal draws its targets** (legacy battle, live ungated path; `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false`, `src/config/featureFlags.js:3044`, VERIFIED):

- **Threshold T** = `scoring.thresholds[SYM].threshold`, or 2.5 when that is missing.
  - `src/screens/AgentBattleScreen.jsx:1399` `const thresholds = agentBattle?.scoring?.thresholds || {};`
  - `src/utils/researchAssetBuilder.js:76–79`
  - VERIFIED.
  - That map is written once, at creation, from each asset's `baseATR`. See `agentBattleService.js:173` (VERIFIED (sub)) and `decide.js:1151–1156`.
- **Stored `baseATR`:**
  - Agent stocks: `(atrPercentile || 0.5) * 8` (`api/agent/decide.js:1265`, VERIFIED). `atrPercentile` is the stock's cross-sectional ATR rank in `indexIntelligence/stockRankings`, computed at `api/cron/compute-index-intelligence.js:1278–1283` (VERIFIED) and stored to 2 decimals (:1401, VERIFIED).
  - CPU stocks: always **2.5** (`api/_utils/cpuOpponentGenerator.js:13` `baseATR: asset.baseATR || (isCrypto ? 5.0 : 2.5)`, VERIFIED). The ranking rows carry no `baseATR`; my read found `baseATR: null` on all 235.
- **Baselines:**
  - **Tab** baseline = `portfolio.startingPrices[SYM]`, the deploy entry. It never uses `swapPrice` or the previous close. Lines: `researchAssetBuilder.js:84–90` (VERIFIED) and `BaggerBombTab.jsx:51–66` (VERIFIED). `dailyLevels` and `previousClosePrice` never reach an agent-battle asset (VERIFIED (sub), repo-wide grep).
  - **Chart** ("bomb") baseline = the previous session's daily close from the OHLCV fetch, once that loads: `src/components/draft/AssetResearchModal.jsx:248–261` and `src/components/Research/chartUtils.js:184–192` (VERIFIED).
  - The chart's **HIT** markers use today's whole-session highs and lows, including the pre-entry open: `StockChart.jsx:119`, `:132–133` (VERIFIED).
- **Six targets** = `BASE × (1 ± k·T/100)` with k = 1, 1.5, 2 (`src/constants/baggerBombScoring.js:14–28`, VERIFIED).
- **v1/v2 math** = `fill × (1 + k·p/100)`, with p = the 6-dp half-even measured ATR14 % (`stockThresholdModel.js:65`, `stockThresholdAdmission.js:11–22`, VERIFIED).
  - I used the stored entry as the fill and p from today's measurement of the Oct 14 session.
  - For a battle created at 00:35 ET Oct 15, that is the same 15-session window the model would have frozen. The real fill would have been a fresh validated real-time quote, so these are **approximations**.

**`io4sC…` per stock** (tab = entry baseline; chart = previous close; order is Bagger / Double / Ten / Bust / Crash / Meltdown):

| Side · slot | Stock | Entry | Stored baseATR (source) | Modal T | Tab targets | Chart targets (prev close) | Measured p (Oct 14) | v1/v2 targets from the same fill |
|---|---|---|---|---|---|---|---|---|
| agent star | MPC | 484.71 | 6.48 (rank 0.81 × 8) | 6.48 | 516.12 / 531.82 / 547.53 / 453.30 / 437.60 / 421.89 | 516.34 / 532.05 / 547.77 / 453.50 / 437.79 / 422.07 | 3.329415 | 500.85 / 508.92 / 516.99 / 468.57 / 460.50 / 452.43 |
| agent star | VLO | 459.91 | 6.64 (0.83 × 8) | 6.64 | 490.45 / 505.72 / 520.99 / 429.37 / 414.10 / 398.83 | 490.31 / 505.57 / 520.84 / 429.25 / 413.99 / 398.72 | 3.512083 | 476.06 / 484.14 / 492.21 / 443.76 / 435.68 / 427.61 |
| agent core | GME | 27.15 | 7.04 (0.88 × 8) | 7.04 | 29.06 / 30.02 / 30.97 / 25.24 / 24.28 / 23.33 | same (prev close 27.15) | 4.175217 | 28.28 / 28.85 / 29.42 / 26.02 / 25.45 / 24.88 |
| agent core | **HUM** | 427.77 | 7.52 (0.94 × 8) | 7.52 | 459.94 / 476.02 / **492.11** / 395.60 / 379.52 / 363.43 | 459.54 / 475.61 / 491.68 / 395.26 / 379.19 / 363.12 | 5.019804 | 449.24 / 459.98 / **470.72** / 406.30 / 395.56 / 384.82 |
| agent support | **UNP** | 286.475 | **0.24 (0.03 × 8)** | 0.24 | 287.16 / 287.51 / **287.85** / 285.79 / 285.44 / 285.10 | 287.12 / 287.46 / 287.80 / 285.74 / 285.40 / 285.06 | **1.396128** | 290.47 / 292.47 / **294.47** / 282.48 / 280.48 / 278.48 |
| agent support | CSX | 48.28 | 0.32 (0.04 × 8) | 0.32 | 48.43 / 48.51 / 48.59 / 48.13 / 48.05 / 47.97 | same | 1.383300 | 48.95 / 49.28 / 49.62 / 47.61 / 47.28 / 46.94 |
| cpu star | INTU | 310.44 | 2.5 (CPU default) | 2.5 | 318.20 / 322.08 / 325.96 / 302.68 / 298.80 / 294.92 | same | 3.292853 | 320.66 / 325.77 / 330.88 / 300.22 / 295.11 / 290.00 |
| cpu star | ELV | 428.10 | 2.5 (CPU default) | 2.5 | 438.80 / 444.15 / 449.51 / 417.40 / 412.05 / 406.69 | ≈ same | 2.521060 | 438.89 / 444.29 / 449.69 / 417.31 / 411.91 / 406.51 |
| cpu core | OXY | 61.41 | 2.5 | 2.5 | 62.95 / 63.71 / 64.48 / 59.87 / 59.11 / 58.34 | same | 2.434457 | 62.91 / 63.65 / 64.40 / 59.91 / 59.17 / 58.42 |
| cpu core | ROST | 230.57 | 2.5 | 2.5 | 236.33 / 239.22 / 242.10 / 224.81 / 221.92 / 219.04 | same | 2.192083 | 235.62 / 238.15 / 240.68 / 225.52 / 222.99 / 220.46 |
| cpu support | HON | 207.61 | 2.5 | 2.5 | 212.80 / 215.40 / 217.99 / 202.42 / 199.82 / 197.23 | same | 1.972448 | 211.70 / 213.75 / 215.80 / 203.52 / 201.47 / 199.42 |
| cpu support | PSX | 297.22 | 2.5 | 2.5 | 304.65 / 308.37 / 312.08 / 289.79 / 286.07 / 282.36 | ≈ same | 2.876196 | 305.77 / 310.04 / 314.32 / 288.67 / 284.40 / 280.12 |

Notes on the table:
- BTC (agent) and BNB (CPU) are crypto: T = 5, from `agentCryptoAssets`, and they are outside the stock model.
- The stored ranks are each stock's `baseATR ÷ 8` at deploy. Today's 17:01Z rankings give UNP 0.03, HUM 0.92 and ACN 0.93; the rankings doc is recomputed intraday.
- Tab and chart disagree slightly because they use different baselines (entry vs previous close). This is a legacy display issue (F3).

**UNP "TenBagger after a tiny gain", in plain terms:**
1. The old system ranks every stock by recent volatility, from 0 (calmest) to 1 (wildest), and multiplies the rank by 8.
2. UNP is one of the calmest names, at rank 0.03, so its threshold is **0.24%**.
3. TenBagger is 2× the threshold: **+0.48%**, or $287.85 from the $286.48 entry.
4. UNP's real average daily range is **1.40%** ($4.00), and it opened today at **$290.00**. That is +1.23%, five times the threshold, so the battle recorded UNP's peak at **4.85×** the threshold within the first tick (`thresholdHistory.UNP.maxMultiplier` 4.846).
5. The chart also shows "TenBagger HIT!", because its line sits at $287.80 from yesterday's close and today's session high is $290.
6. With the measured model, the same fill would need +2.79% ($294.47) for TenBagger, and BaggerBomb would sit at $290.47. So the opening print would be just short of a BaggerBomb.
7. HUM is the opposite case. Its rank (0.94) makes the threshold 7.52% and TenBagger +15%, against a measured 5.02%.

### B3. Zero checks (Admin SDK `count()`)

| Check | Result |
|---|---|
| `agentBattles` where `scoring.stockThresholdModel != null` | **0** |
| `agentBattles` where `scoring.stockThresholdModel == null` | **0**, so the field is absent on all **588** battles |
| `stockThresholdInputs` docs | **0** |
| `stockThresholdControl` docs | **0**; `stockThresholdControl/admission` **does not exist** |

So no v1 battle has ever existed, and retiring v1 strands nothing.

### B4. FT_QA and Cipher

- Owner-12 has two agents named "Cipher".
- The live one (`casua…`, diversifier) has:
  - `lastDecision.portfolio` present;
  - `activeBattleId: null`;
  - `deployingAt: null`;
  - `deployProgress.stage: 'complete'`;
  - `lastDeployedAt` 2026-10-14 17:52Z;
  - 5 completed `baggerbomb_agent` battles, the last one `BJVQK…` on Oct 14.
- The other (`Rv4nd…`) has never deployed and has no decision.
- FT_QA can therefore create a full-day agent-vs-CPU battle today. Every tiered creation is full-day with an embedded CPU (`agentBattleService.js:37`, `:141`; `decide.js:943–944`), and all 81 tiered battles to date carry crypto in support[2], so all expire at 20:00 ET.
- The cooldown rule was not re-derived (ASSUMED: nothing blocks a deploy 23 h after the last one).
- Under the pilot, creation is still subject to E6.

## C. Live delayed-feed measurement

Status: INTERIM — generated 2026-10-15T17:35:42.596Z; the close and post-close tail are still running (ends 16:50 ET).

**C1. Method**

- **Endpoint and parsing:** the collector's own endpoint and field parsing.
  - `GET https://eodhd.com/api/real-time/{SYM}.US?fmt=json` (`stockThresholdMeasurementProvider.js:31–32`, `:48`, VERIFIED).
  - Price = `strictNumber(close)`; provider time = `strictNumber(timestamp)` in Unix seconds (`:50–51`, VERIFIED).
  - The endpoint supports multi-symbol requests (`s=` adds symbols). The response is an array of the same per-symbol objects, so one request per poll covered every symbol.
- **Symbols:** UNP, HUM, ACN, AAPL, MSFT, JPM, XOM, JNJ, KO, NVDA.
- **Schedule (ET):**

| Phase | Window | Symbols | Interval |
|---|---|---|---|
| A | 13:04–13:45 | all 10 | 60 s |
| B | to 15:45 | UNP, HUM, ACN | 5 min |
| C | 15:45–16:20 | all 10 | 60 s |
| D | 16:20–16:50 | UNP, HUM, ACN | 60 s |

- **What was recorded for each sample:**
  - send time, receive time and the server `Date` header;
  - the raw quote, with `timestamp`, `gmtoffset`, OHLC, volume, `previousClose`, `change` and `change_p`.
- **Counts:** 33 polls, 330 symbol-quotes (A: 330), HTTP errors 0.
- **Clock:** local clock vs EODHD `Date` header: server ahead by 0.92–1.92 s (median 1.45 s); delays below use the server `Date`.

**C2. Results**

- **Precision:** `timestamp` is integer Unix seconds and always a whole minute (`timestamp % 60 = 0` on every sample). It is per symbol: one response can carry different minutes for different symbols. `gmtoffset` is 0.
- **Delay** (server `Date` minus provider `timestamp`): n = 330 regular-session quotes: min 15:01, p10 15:19, median 15:19, p90 16:01, p99 16:19, max 17:19.
  - At wall time W the feed normally serves the minute bar stamped **floor(W) − 15 min**.
  - Sometimes it lags one or two more minutes (the 16:xx and 17:xx tails), then catches up with a 120 s jump.
- **How the provider time moved** across 60 s neighbouring polls (all symbols): 0 s: 52 · 60 s: 227 · 120 s: 41.
  - Liquid names (AAPL, MSFT, JPM, XOM, JNJ, KO, NVDA) advanced on 85–92% of polls.
  - UNP, HUM and ACN advanced on 62–73%, with more 0 s / 120 s pairs.
  - The provider time never went backwards.

| Symbol | Samples | Delay min / median / p90 / max (m:ss) | Advance rate per 60 s | Step sizes on 60 s neighbours | Backwards | Same time, different price | Missing / non-numeric fields | Last provider time (ET) |
|---|---|---|---|---|---|---|---|---|
| UNP.US | 33 | 15:01 / 15:19 / 16:19 / 17:01 | 0.72 | 0s×9, 60s×15, 120s×8 | 0 | 0 | none | 13:20:00 |
| HUM.US | 33 | 15:01 / 15:19 / 16:19 / 17:19 | 0.59 | 0s×13, 60s×9, 120s×10 | 0 | 0 | none | 13:18:00 |
| ACN.US | 33 | 15:01 / 15:19 / 16:19 / 17:01 | 0.75 | 0s×8, 60s×16, 120s×8 | 0 | 0 | none | 13:20:00 |
| AAPL.US | 33 | 15:01 / 15:19 / 15:20 / 16:01 | 0.94 | 0s×2, 60s×29, 120s×1 | 0 | 0 | none | 13:20:00 |
| MSFT.US | 33 | 15:01 / 15:19 / 15:20 / 16:19 | 0.88 | 0s×4, 60s×25, 120s×3 | 0 | 0 | none | 13:20:00 |
| JPM.US | 33 | 15:01 / 15:19 / 15:19 / 16:19 | 0.91 | 0s×3, 60s×27, 120s×2 | 0 | 0 | none | 13:20:00 |
| XOM.US | 33 | 15:01 / 15:19 / 15:19 / 16:19 | 0.91 | 0s×3, 60s×27, 120s×2 | 0 | 0 | none | 13:20:00 |
| JNJ.US | 33 | 15:01 / 15:19 / 15:19 / 16:19 | 0.91 | 0s×3, 60s×27, 120s×2 | 0 | 0 | none | 13:20:00 |
| KO.US | 33 | 15:01 / 15:19 / 15:20 / 16:19 | 0.88 | 0s×4, 60s×25, 120s×3 | 0 | 0 | none | 13:20:00 |
| NVDA.US | 33 | 15:01 / 15:19 / 15:19 / 16:19 | 0.91 | 0s×3, 60s×27, 120s×2 | 0 | 0 | none | 13:20:00 |

**Same time, different price.** None so far: for every symbol, each provider minute carried exactly one `close`. Under Ruling 1, "same time, same price" is the normal case, and "same time, different price" did not occur in this sample.

**Missing or non-numeric fields.** None in any sample. Every one of `timestamp`, `open`, `high`, `low`, `close`, `volume`, `previousClose`, `change` and `change_p` passed `strictNumber`.

**C3. Close behaviour** (every sample observed at or after 15:55 ET):

```
(no samples yet at or after 15:55 ET)
```

_Reading of the close behaviour pending: the close falls at 16:00 ET and the tail runs to 16:50 ET._

**C4. N for Ruling 2**

**Facts the recommendation rests on (all VERIFIED):**
- **Evaluator schedule:** `vercel.json:158` `*/15 13,14,15,16,17,18,19,20,21 * * 1-5`, so ticks run at :00/:15/:30/:45 ET from 09:00 to 17:45.
- **No evaluation at or after the close:** `processAgentBattle` runs only while `isMarketOpen()` (`api/cron/agent-evaluate.js:400–402`; `api/_utils/marketSchedule.js:139–146`, `minutes < closeMinutes`, close 16:00 or 13:00 on early-close days). **The last evaluating tick is 15:45 ET.** The expiry sweep runs at every tick regardless (`:321`).
- **What each tick sees:** a provider time of roughly W − 15 min (C2). The 15:45 tick therefore scores on **≈ 15:30 provider time**, the latest market moment any battle is ever scored on. Everything after about 15:30 ET is never observed. That is true for legacy battles too.
- **The fill's provider time:** a corrected battle created at C gets a fill quote stamped T_f ≈ C − 15 (to C − 17) min.
- **Which ticks can score it:** under Ruling 1, a tick at W scores a held stock when its quote is strictly later than T_f, or at the same time with the same price.
  - With the measured 15–17 min delay band, any tick at least **3 minutes** after creation is strictly later.
  - A tick 0–3 minutes after creation can see T_w ≤ T_f. That frame is unavailable unless the K2-6 stand-in (Branch A) values it at the fill.

**Worst case for a battle created exactly N minutes before the 16:00 close** (C = 16:00 − N, 3-minute margin):

| N (minutes before close) | Created at (ET) | Scoreable ticks (Ruling 1) | Which ticks | Market time actually scored (≈ N − 15) |
|---|---|---|---|---|
| 15 | 15:45 | **0** | — | none: no valid frame; Ruling 4 gives result unavailable |
| 20 | 15:40 | 1 | 15:45 | ≈ 5 min |
| 30 | 15:30 | 1 | 15:45 (15:30 races creation) | ≈ 15 min |
| **45** | **15:15** | **2** | 15:30, 15:45 | **≈ 30 min** |
| 60 | 15:00 | 3 | 15:15, 15:30, 15:45 | ≈ 45 min |
| 75 | 14:45 | 4 | 15:00 … 15:45 | ≈ 60 min |

General rule: worst-case scoreable ticks = floor((N − 18) / 15) + 1 for N ≥ 18, and 0 below.

**Recommendation: N = 45 minutes,** refusing corrected creation from 15:15 ET (12:15 on early-close days).
- That guarantees two scoreable frames. A single invalid frame cannot then end the battle as "result unavailable", and the agent gets a decision tick with a real price move behind it.
- **N = 20 is the hard floor:** one frame and about 5 minutes of market.
- In production history, **6 of 81 tiered battles** were created between 15:00 and 15:59 ET (five at 15:04–15:06, one at 15:20). N = 45 would have refused only the 15:20 one; N = 60 would have refused all six.
- Two implementation notes:
  - Put the cutoff in `prepareStockCreation` before any GET (`stockThresholdAdmission.js:40–47` region).
  - Measure it at the collector's `began` instant against the calendar close (`getSessionForDate(...).closeMs`), never a 15:40 literal, so early-close days work.

**What this does not cover:** creation after the close, before the open or at weekends (F2 #3). The 09:30 ET first tick of the next session was not measured.

## D. Universe numbers (no Firestore writes)

**Route and cost.**
- Neither the PR 955 tooling nor the collector fits:
  - `scripts/collect-threshold-export.js` fetches `eod`, `splits` and `div` per symbol plus Firestore.
  - `threshold-audit.js` measures offline.
  - The collector would bill `fundamentals` (10) and `real-time` (1) per symbol.
- So a scratch script used the collector's **exact `eod` request shape** (`stockThresholdMeasurementProvider.js:25–29`, `:39`: `from` = 14 sessions back, `to` = source session, `period=d`, `order=a`). It then called the runtime `measureStock` (`api/_utils/measuredStockThreshold.js:83`) and `effectiveStockPercentage` (`stockThresholdAdmission.js:11`) directly.
- It applied the collector's catalog refusals (`:18`). It skipped the identity check (fundamentals) and the fill-quote validation.
- **Cost: 228 EODHD `eod` calls** (1 per qualified-path symbol).
- The window was the 15 sessions 2026-09-24 → 2026-10-14, measured at 17:14Z.
- **Universe:** 239 symbols = the 235 rankings rows ∪ `ALL_TICKERS`. HES, IPG, K and WBA are in `ALL_TICKERS` but not in the rankings.

**Results:**
- 228 qualified on arithmetic. 11 were refused with `catalog_unavailable`: AVB, CTRA, EA, EQR, HES, IPG, K, MMC, PARA, WBA, WBD.
- No arithmetic refusal: no missing session, incoherent OHLC or quantized-zero.
- Measured ATR14 %: min **0.979** (BRK-B), median **2.388**, max **8.816**. 1 name is below 1% and 12 are above 5%.
- Legacy baseATR (rank × 8): min 0.08, median 4.00, max 8.00. **27 names are below 1%.**
- Ratio legacy ÷ measured:
  - median **1.556**, p10 0.526, p90 1.996;
  - 39 of 228 within 0.8–1.25×;
  - 21 below 0.5×; 20 above 2×.
- Spearman rank correlation **0.987**: the legacy number is a near-perfect rank with the wrong scale.
- **Falsy-zero quirk:** BRK-B has rank 0, and `(0 || 0.5) * 8` gives **4.00** instead of ≈ 0. Its ratio of 4.09 is the largest in the universe. The swap-in paths give 2.5 for the same input (`agent-evaluate.js:1595`, `:2669`, VERIFIED).

**10 largest disagreements: legacy far below measured** (thresholds too easy):

| Symbol | Rank | Legacy % | Measured % | Ratio | TenBagger move, legacy | TenBagger move, measured |
|---|---|---|---|---|---|---|
| DUK | 0.01 | 0.08 | 1.262 | 0.063 | +0.16% | +2.52% |
| CSX | 0.02 | 0.16 | 1.383 | 0.116 | +0.32% | +2.77% |
| NSC | 0.02 | 0.16 | 1.373 | 0.117 | +0.32% | +2.75% |
| PPL | 0.03 | 0.24 | 1.503 | 0.160 | +0.48% | +3.01% |
| UNP | 0.03 | 0.24 | 1.396 | 0.172 | +0.48% | +2.79% |
| KO | 0.03 | 0.24 | 1.379 | 0.174 | +0.48% | +2.76% |
| O | 0.04 | 0.32 | 1.450 | 0.221 | +0.64% | +2.90% |
| AEE | 0.04 | 0.32 | 1.438 | 0.223 | +0.64% | +2.88% |
| FDX | 0.05 | 0.40 | 1.686 | 0.237 | +0.80% | +3.37% |
| FE | 0.05 | 0.40 | 1.521 | 0.263 | +0.80% | +3.04% |

**10 largest disagreements: legacy far above measured** (thresholds too hard):

| Symbol | Rank | Legacy % | Measured % | Ratio | TenBagger move, legacy | TenBagger move, measured |
|---|---|---|---|---|---|---|
| BRK-B | 0 | 4.00 | 0.979 | 4.088 | +8.00% | +1.96% |
| VZ | 0.71 | 5.68 | 2.348 | 2.419 | +11.36% | +4.70% |
| GIS | 0.82 | 6.56 | 2.796 | 2.346 | +13.12% | +5.59% |
| T | 0.75 | 6.00 | 2.578 | 2.328 | +12.00% | +5.16% |
| WMB | 0.65 | 5.20 | 2.401 | 2.166 | +10.40% | +4.80% |
| CSCO | 0.65 | 5.20 | 2.404 | 2.163 | +10.40% | +4.81% |
| EIX | 0.77 | 6.16 | 2.888 | 2.133 | +12.32% | +5.78% |
| PSX | 0.74 | 5.92 | 2.876 | 2.058 | +11.84% | +5.75% |
| LLY | 0.73 | 5.84 | 2.843 | 2.054 | +11.68% | +5.69% |
| TTWO | 0.75 | 6.00 | 2.927 | 2.050 | +12.00% | +5.85% |

**Call-outs:**

| Symbol | Rank | Legacy % | Measured % | Ratio | TenBagger move, legacy | TenBagger move, measured |
|---|---|---|---|---|---|---|
| UNP | 0.03 | 0.24 | 1.396 | 0.172 | +0.48% | +2.79% |
| HUM | 0.92 | 7.36 | 5.020 | 1.466 | +14.72% | +10.04% |
| ACN | 0.93 | 7.44 | 4.485 | 1.659 | +14.88% | +8.97% |

The full 239-row table is in Appendix 1.

## E. Build contact map (current main, 495ee07b)

### E1. Timing (Ruling 1)

**Current predicate and seeds** (`src/utils/stockThresholdModel.js`, all VERIFIED):

- **:48** checks fill-evidence order. It forces `quoteAsOf ≤ fillQuote.observedAt ≤ enteredAt` (an upper bound; it stays).
- **:52** `initialRewardHistory`: `… high: r.fill, low: r.fill, observedAt: r.enteredAt, crossedTiers: [] }`. It seeds the **wall-clock** entry time.
- **:61** `… instantMs(h.observedAt) < instantMs(r.enteredAt)) return unavailable('invalid_reward_history')`. This is a wall-clock lower bound on the stored history.
- **:62** `isEntry` is the entry-commit carve-out. It requires `quote.observedAt === r.enteredAt` and `h.observedAt === r.enteredAt`.
- **:63** **is the K2-2 predicate**: `… (!isEntry && (instantMs(quote.asOf) < instantMs(r.enteredAt) || instantMs(quote.asOf) < instantMs(h.observedAt)))) return unavailable('missing_post_entry_quote')`.
- **:80** `history.observedAt: isEntry ? r.enteredAt : quote.asOf`. The history mixes wall-clock and provider clocks.

**Exit and stand-in** (`api/_utils/stockThresholdAdmission.js`, VERIFIED):

- **:129–130** `decisionQuote` turns EODHD's `timestamp` (seconds) into `asOf` and sets `price` to null when `fallback === true`.
- **:138–141** `scoreCorrectedPosition`. The `stockEntryCommit` marker stands in with `{ kind: 'entry_commit', price: r.fill, asOf: r.fillQuote.quoteAsOf, observedAt: r.enteredAt }`.
- **:230** exit: `instantMs(outQuote.asOf) > instantMs(at)` is an upper bound only.
- **:232** calls the scorer with `{ entryCommit: false }`, so an exit inherits :63.
- **:235** the exit price comes from that one context.
- **:268** the marker is set only in the executor's `.then`.

**Other wall-clock lower bounds** (grep of api/ and src/, non-test; VERIFIED (sub)):
- None beyond :61 and :63.
- The provider's :67, :70 and :71 are upper or session bounds and stay.

**What Ruling 1 needs (edit set):**
1. **:52** seeds `observedAt: r.fillQuote.quoteAsOf`.
2. **:61** must accept `h.observedAt ≥ quoteAsOf`. **Trap:** if only :52 changes, :61 rejects every fresh history, because :48 guarantees `quoteAsOf ≤ enteredAt`.
3. **:63** becomes the three-way rule:
   - `asOf > quoteAsOf` is valid;
   - `asOf == quoteAsOf` is valid only if `price === r.fill`;
   - otherwise `missing_post_entry_quote`.
   - Today `<` lets an equal-time quote through with any price.
4. **:62/:80** drop the `entry_commit` carve-out, or re-key it on `quoteAsOf`.
5. **Exit "strictly later"** needs a flag on `stockRewardContext` (it has none) or a post-check at admission :232–235.
6. **admission :141** stand-in: see K2-6.

**K2-6 (landed-trade recovery sets no marker).**
- The recovery is `api/_utils/landedTrade.js:106–109` (VERIFIED). It rebuilds the result from the doc, so the `.then` at admission :266–270 never runs.
- Its callers:
  - risk-swap catch `agent-evaluate.js:2152–2154`
  - model-swap catch `:3816–3817`
  - both VERIFIED (sub).
- The marker's only reader is admission :138/:140 (VERIFIED). Creation never sets one either.
- **Under Ruling 1 the stand-in is exactly the case the ruling admits**: same provider time, same price.
  - **Branch A (recommended):** stand in with the receipt's own fill quote whenever the tick quote predates `quoteAsOf`. The marker loses its last consumer and is deleted, **K2-6 disappears**, and creation is covered too.
  - **Branch B:** drop the stand-in. That frame is unavailable until the next tick; under Ruling 3 this no longer blocks risk. K2-6 also disappears.
  - Only a marker-gated stand-in keeps K2-6.

**Quote source** (VERIFIED):
- The evaluator fetches with `getStockAnalysisData(symbol, { forceRefresh: true, fields: ['daily','price'] })` (`agent-evaluate.js:1110`).
- That goes to `real-time/{SYM}` (`api/_utils/marketDataCache.js:794`) and carries `timestamp: data.timestamp` (:814).
- **Hazard at :799:** `const selected = data.close || data.previousClose || 0;`. When `close` is falsy, the corrected valuation takes **previousClose stamped with a fresh provider time**, which Ruling 1 would accept as a later quote. The collector uses `close` strictly (`stockThresholdMeasurementProvider.js:50`).
- **M1 does not check the timestamp** (`api/_utils/agentQuoteHealth.js:25–28`, VERIFIED). An undated quote passes M1 and becomes an unavailable corrected context.

### E2. Unavailable frame (Ruling 3)

**Corrected early returns in `processAgentBattle`** (`api/cron/agent-evaluate.js`, VERIFIED). Each skips the rest of the tick: risk pass, forced exits, standing orders, trigger gate, model call, `statusFeed`, evaluation entry and `finalizeCronState`.

| Line | Shape | When |
|---|---|---|
| :1335–1337 | `if (scoreUpdate['scoreState.stockScoreEvidence'].status !== 'valid') { await battleRef.update(scoreUpdate); summary.held++; return; }` | before the risk pass (**K3-1**) |
| :2453–2456 | `if (correctedStockGame) { await battleRef.update(scoreUpdate); if (!finiteStock(currentScore) …) { summary.held++; return; } }` | after forced exits |
| :2478–2480 | same shape | after `handlePendingProposal` |
| :2518–2520 | same shape | after `handleGameplanMeeting` |

**Exits before the lock or the tick body** (keep as they are):
- `:842` `if (stockRoute.status === 'unavailable') { summary.errors++; return; }` (VERIFIED).
- `:859–860` corrected re-read inside the lock transaction (VERIFIED (sub)).

**Locations Ruling 3 keeps running:**
- **Risk pass:** loop `:1827–1884`, with `evaluateRisk(` at `:1866–1874` receiving `score.rewardContext || null` (VERIFIED). The executor is at `:2141–2151`.
  - In `api/_utils/agentRiskManager.js`, both LOCK branches go dark on an unavailable context:
    - `:150` `if (rewardContext !== null && rewardContext.status === 'valid' && rewardContext.proximity?.locked)`
    - `:153` `if (rewardContext === null && atrMultiplier > 0)`
  - EMERGENCY (`:128` `if (atrMultiplier <= bustBuffer)`), VWAP SWAP_OUT and TRAIL_STOP still run on the calibrated `baseATR`, which survives in the unavailable score (`src/utils/baggerBombUtils.js:537`).
  - All VERIFIED except :537 (VERIFIED (sub)).
  - **No fenced edit is needed for Ruling 3's risk half.**
- **Standing stop orders** = the deployed guardrails, via `applyGuardrails(`:
  - main path `:3423–3425` (VERIFIED), which runs only after the trigger gate;
  - R11 suppression pass `:5674`/`:5714`, gated by `PROFIT_TARGET_EXECUTOR_ENABLED = true` (`featureFlags.js:1984`, VERIFIED (sub)).
  - There is no separate "stop order" store.
- **M1 whole-tick gate:** `:1134–1146` (`assessRequiredQuotes`; lock released; `return`), VERIFIED. Unchanged by Ruling 3.
- **`finalizeCronState`:** defined at `api/_utils/agentCronState.js:35`. It writes `cronState.lastEvaluatedAt`, `cronState.evaluatingAt: null` (lock release) and the counters (VERIFIED). Callers are at :1384, :2484, :2528, :2612, :2744 and :4645, with the final write at :4692.
  - **Precision on K2-5:** feed beats and the evaluation entry are call-site fields, not `finalizeCronState`'s.
  - The lock is inert: `EVALUATING_LOCK_TIMEOUT_MS = 120_000` (`:214`, VERIFIED) against a 15-minute cadence.

**"Never zero" surface.** Once the tick continues with `currentScore === null`, these sites write **0**:
- **Feed beats in `agent-evaluate.js`:** `:1921`, `:1992`, `:2004`, `:2039`, `:2119`, `:2196`, `:2369`, `:4149`, `:4169`.
- **R11 pass:** `:5757`, `:5767`, `:5791`, `:5832`, `:5889`, `:5954`, `:6096`.
- **Proposal:** `:4077` `scoreAtProposal`.
- **Completion status line:** `:6802` `const currentScore = scoreState.currentScore || 0;` (VERIFIED) → `:6919`.
- Sources: VERIFIED (sub), except :6802, which is VERIFIED.
- **Outside §6:**
  - `battlePatternLogger.js:40–42`: null is logged as a **draw** (VERIFIED);
  - `voiceLayerPrompt.js:1142–1156`: "You 0 — Opponent 0 (TIED…)" (VERIFIED);
  - `agentReflectionUtils.js:190` (VERIFIED);
  - `agentNewsContext.js:81` (VERIFIED).
- Already null-safe: `:5085`, `:5374`, `:5612`.

### E3. Expiry (Ruling 4)

**Expiry loop** (`api/cron/agent-evaluate.js`, VERIFIED):
- `:321` "runs regardless of market hours"
- `:326` `if (battle.expiresAt && new Date(battle.expiresAt) < new Date())`
- `:332` → `completeBattle`
- `:333–335` on commit, `logBattlePattern(...)` with the run's **pre-transaction** snapshot
- `:347–351` `corrected_score_unavailable` → logged, `summary.errors++`, battle stays **active**

**`resolveCompletionDisposition`:** `:6694` already returns `{ result: null, completionContext: 'corrected_score_unavailable', statusMessage: 'Result unavailable: incomplete pinned stock evidence.', updateAgentStats: false, pendingReflection: false, … }` (VERIFIED). It is dead inside completion because **`completeBattle` returns first at `:6775`** `return { committed: false, reason: 'corrected_score_unavailable' }` (VERIFIED). Its only live consumer is the film tape (`api/_utils/filmTape/battleResult.js:13`).

**`completeBattle` and what it writes** (one transaction):

*Battle doc:*
- `status: 'completed'`, `completedAt` (`:6887–6888`)
- `pendingReflection` and `reviewPending` from the disposition (`:6893`, `:6912`)
- `'cronState.evaluatingAt': null` (`:6913`)
- a statusFeed `battle_complete` line with `score: Math.round(currentScore*100)/100` (`:6916–6919`)
- `completionContext` (`:6925`)
- the dark `receiptCoverage`
- vision retirement (`:6936`), regardless of disposition
- the mastery eligibility stamp (`:6959`), regardless of disposition
- `completionReason: 'expired_repaired'` on the repair branch only
- Sources: VERIFIED for :6887–6919 and :6984–6987; VERIFIED (sub) for the rest.

*Agent doc:*
- **The active-battle pointer is released only here.**
  - `:6984` `pointerCurrent`
  - `:6985–6987` no-stats path `t.update(agentRef, { activeBattleId: null })` (VERIFIED)
  - stats path `:6990–7023`, writing to the parent ranked agent for a casual clone
  - `:7022`/`:7025` (VERIFIED (sub))
- `decide.js` only re-points it.

*After commit:*
- vision log
- mastery XP (`MASTERY_XP_ENABLED = false`)
- dark settlement record
- `completeBattle` writes no film tape, cooldown or `lastDeployedAt`
- the pattern logger runs in the two callers: `:335` and GC `:7145` (VERIFIED)

**What the stuck state blocks today:**
- redeploy: 503 at `decide.js:811–813` (VERIFIED) and the tournament guard at `:1368`;
- the nightly corrected checkpoint: `stockThresholdAdmission.js:279` `refuseStock('missing_committed_daily_score')` (VERIFIED);
- the battle counts as an error every run.

**Ruling 4 terminal "result unavailable": what it must write** (one transaction):
1. `status: 'completed'` and `completedAt`, which frees the active-battle queries in `decide.js`.
2. `completionContext: 'corrected_score_unavailable'` (or a new value).
3. Explicit `pendingReflection: false` and `reviewPending: false`. The GC-repair discriminator relies on the field being present (`:6746`).
4. `'cronState.evaluatingAt': null`.
5. `activeBattleId: null` on the agent, only while `pointerCurrent`.
6. A statusFeed line with a **null** score.
7. Leave scoring, scoreState, trades, evaluations and `stockThresholdInputs` as they are.

It must also:
- **not** depend on `readCorrectedInputs` succeeding (`:6776` throws on corrupt inputs);
- cover route `'unavailable'` as well.

**What it must not write:**
- stats or the parent redirect;
- a `result` or draw;
- reflection or review queue flags set to true;
- the mastery stamp or award;
- `battlePatterns` (both callers need a disposition check);
- `completionReason: 'expired'` (that would pull it into the GC repair at `:7127`, VERIFIED);
- any `lastDeployedAt` change.

Open for Flash: vision retirement and the dark settlement record (F2).

**"Latest committed frame valid for its final roster": only one frame exists.**
- The corrected score patch overwrites `scoreState.*`, `scoring.stockScoreVersion` and `scoreState.stockScoreEvidence` in place (`stockThresholdAdmission.js:151–153`, VERIFIED).
- **Invalid frames are committed too** (`agent-evaluate.js:1335–1336`, VERIFIED).
- A swap writes `stockScoreEvidence: { status: 'unavailable', reason: 'roster_changed_awaiting_score' }` and bumps `scoring.stockRosterVersion` (`:253`, VERIFIED). `rosterToken` includes that version (`stockThresholdModel.js:38`, VERIFIED), so **no pre-swap frame can ever be valid for the final roster.**
- The only other copies:
  - `evaluations[]` scores: no opponent score, no evidence, capped at 150;
  - tick captures: no evidence;
  - `dailyScores.{day}`: a copy of an already-valid latest frame.
- So today "latest valid frame for the final roster" equals **"the latest stored frame, if valid"**. Settling on an earlier valid frame after an invalid last tick needs a new last-valid-frame record, written only on valid commits and keyed by roster token. → **F2 decision.**

**How often the rule would fall back to "result unavailable" under Ruling 1.**
- All 81 tiered battles carry crypto, so they expire at 20:00 ET. The **final stock frame is the 15:45 ET tick's** (market gate, E2/C4).
- **Branch A (receipt stand-in):** timing alone almost never invalidates that frame. The final frame is lost only when:
  - a held stock's final-tick quote is undated, `NA`-dated or non-numeric but still passes M1 (0 of the feed samples in C);
  - or evidence is corrupt;
  - or the battle got no scoreable tick at all (Ruling 2 prevents that).
  - A fallback quote fails M1, so the whole tick is skipped and the previous frame stands.
- **Branch B (no stand-in):** a swap at the final tick leaves the frame unavailable whenever the provider minute advanced between the tick's quote fetch (`:1110`) and the collector's fill fetch.
  - In production history, **6 of 203 trades (3%) landed in the 15:45 tick, in 6 of 81 battles (7.4%)**, all with a stock incoming.
  - The feed advanced on 67–92% of 60-second polls (C).
  - So Branch B would lose the final frame in roughly **4–7% of battles**.

### E4. Readers

| # | Surface | Where (key line) | Model check | Class |
|---|---|---|---|---|
| 1a | Voice cache cron | `api/cron/voice-layer-cache.js:354` `const baseATR = stock.baseATR;` · `:377` `signedChange / baseATR` · `:938` `battle.thresholdHistory \|\| {}` (VERIFIED) | none | **Legacy-only.** On a corrected game, badges are always empty: stock `thresholdHistory` stays `{}` (`agent-evaluate.js:1319`, VERIFIED). |
| 1b | Chat prompt | `api/agent/chat.js:593` reads the cache. `api/_utils/voiceLayerPrompt.js:1883` `Threshold: ${multStr}x (baseATR ${atrStr}%)` · `:1142–1156` score `?? 0` (VERIFIED) | none | **Legacy-only.** A null score reads "You 0 — Opponent 0 (TIED)". |
| 1c | Other cache readers | `ensure-opener.js:223`, `decide.js:1634`, trade narration, anticipation, `research.js:127` (VERIFIED (sub)) | none | **Legacy-only** |
| 2 | Reflection | `api/_utils/agentReflectionUtils.js:190`, `:225–231` (`baseATR=${t.threshold}, maxMult=…`) (VERIFIED) | upstream gate only (`:6694` `pendingReflection: false` unless valid) | Scores **corrected-aware (indirect)**. THRESHOLDS block **legacy-only**: it prints legacy baseATR and maxMult 0. |
| 3 | Pattern logger | `api/_utils/battlePatternLogger.js:40–42`, `:165–171` (VERIFIED) | none; commit-gated | Score **indirect**. Hits and penalties **legacy-only**: always 0. Null logged as a draw. |
| 4 | Film tape (rechecked after #962 and #963; `stockModelRoute` has no hits in `filmTape/` or `film-tape-*`) | result `battleResult.js:13` · merge `tapeMerge.js:495` drops `scoring` · score rows `tapeAssemble.js:994` · replay `tapeAssemble.js:407`/`:410` legacy ATR and history (VERIFIED) | indirect only | Result **indirect**. Merge **legacy (latent)**. Score rows **indirect, unlabelled**. Replay **legacy-only**: it mixes corrected `lockedPoints` with a legacy rescore. |
| 5 | Bagger moment | `src/screens/battleView/deriveBaggerMoment.js:59` (VERIFIED) | none | **Legacy-only, inert** (history empty; corrected rows never pass `baggerFooter`). |
| 6 | Batch review | `api/cron/agent-batch-review.js:257–291` (VERIFIED (sub)) | none | **Legacy-only, null-safe** ("N/A"). |
| 7 | Evidence labels | `api/_utils/tickStamps.js:203` `atrX: round2(score.multiplier)` → `decisionRecord.js:1036` "ATR multiple" (VERIFIED (sub)) | none | **Indirect number, legacy label** ("ATR multiple" is really the frozen measured unit). |
| 8 | ManageStation score card | `src/components/Dashboard/ManageStation.jsx:33` `battle.scoreState?.currentScore` (VERIFIED). Same raw read in `ReviewStation.jsx:21`, `BattleHistoryScreen.jsx:245–246` and `baggerbombAdapter.js:525` (VERIFIED (sub)) | none | **Legacy-only, null-safe** ("—"). |
| 9 | Research modal and chart | `AgentBattleScreen.jsx:2717`, `:2761–2762`; `researchAssetBuilder.js:72`; `BaggerBombTab.jsx:46` (VERIFIED) | `stockModelRoute` + `committedStockContext` | **Corrected-aware.** The chart draws **no** targets on corrected rows (threshold null), so the six-target chart redraw is still to build. |
| 10 | Why | `selectWhyState.js:422` (VERIFIED); `WhyPanel.jsx:202` `proximity?.text ?? null` (VERIFIED) | yes | **Corrected-aware.** The proximity line is silently blank: the corrected proximity has no `text`. |
| 11 | Live header, faces, row enrichment, daily scores, completion | `AgentBattleScreen.jsx:1709`, `:216–218`; `agent-daily-scores.js:55–57`; `agent-evaluate.js:6694`/`:6775` | yes | **Corrected-aware** |
| 12 | Learning capture L1 (`LEARNING_L1_CAPTURE_ENABLED = true`) | `agent-evaluate.js:2301–2302` `outgoingBaseATR`, `thresholdHistory` (VERIFIED); also `:3946`, `:5296`, `:5551`, `:6026` | none | **Legacy-only.** It feeds tape replay. The corrected `closedTrade.outgoingRiskHistory`/`rewardContext` are never read. |
| 13 | Command Center desk | `baggerbombAdapter.js:218` (`COMMAND_CENTER_SYNC_ENABLED = false`) | — | **Not mounted** |
| 14 | Old dashboards / archived | `DashboardLoop.jsx:92` etc. | — | **Not mounted** |
| 15 | Cockpit, `useAgentBattle.js` | no score or threshold reads | — | none |

### E5. Prompt (fenced `api/_utils/agentEvalPromptAssembly.js`, all VERIFIED)

Tiered games get this block (`:356` checks `promptVariant === 'flat6'`; tiered falls through):

```
:363  Base points = (currentPrice - entryPrice) / entryPrice × 100 × 10 × tierMultiplier
:364  Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x
:366  Threshold bonuses (flat, triggered when ATR multiplier = priceChange% / baseATR crosses level):
:367    +1.0x ATR → BaggerBomb: +15 pts
:368    +1.5x ATR → DoubleBagger: +30 pts
:369    +2.0x ATR → TenBagger: +50 pts
:371  Threshold penalties:
:372    -1.0x ATR → Bust: -10 pts
:373    -1.5x ATR → Crash: -20 pts
:374    -2.0x ATR → Meltdown: -35 pts
:376  When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.
:394     - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.
:396     - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),
```

Also legacy-unit idiom:
- `:206` override machinery "breached -1.0x ATR (Bust)" (VERIFIED (sub));
- worked examples `:541`, `:544`, `:547` ("0.74x ATR", "1.0x ATR threshold (+1.8%)", "1.09x its ATR") (VERIFIED (sub));
- the data header `:1491` `…,ATR Mult,Badges,ATR%` (VERIFIED).

The corrected rows (`:1496–1502`, VERIFIED) are self-labelled ("measured reward, fill $…, frozen …%, mult …, calibrated risk ATR …%").

**The contradiction:** `:366`'s divisor is `baseATR`, but the corrected multiplier divides by the frozen measured % (`stockThresholdModel.js:69`, VERIFIED). The 0.2× bands at :394/:396 are really 0.2 of the frozen unit (`stockThresholdModel.js:74`). There is no "x8" or "percentile" wording anywhere. Base points and tier points at :363–374 are consistent.

### E6. Admission

- **(a) Selected battles.**
  - `stockThresholdAdmission.js:40` `if (!stockAdmissionEnabled()) return null;`
  - `:41` `if (battleDoc.gameMode !== 'baggerbomb_agent' || battleDoc.duration !== 'fullday' || !battleDoc.opponent?.portfolio) return null;` (VERIFIED)
  - With the flag on, that is **every tiered creation for every user**. Tournament creations have `opponent: null` and are never selected.
- **(b) Allowlist slot.** Between `:46` and `:47`, before the first measurement GET at `:51`:
  - `if (!allowlisted(control, battleDoc.ownerId)) return null;` It must be `return null` (stay legacy), **not** `refuseStock`.
  - `ownerId` is trustworthy:
    - the rules require `ownerId == request.auth.uid` on create (`firestore.rules:273`);
    - owner updates cannot touch it (`:335`);
    - both VERIFIED (sub).
  - The transaction's whole-doc re-read (`:64–65`, VERIFIED) already refuses an in-flight pilot creation if the allowlist changes mid-creation.
  - **Hazard today:** `validStockAdmissionControl` (`stockThresholdPolicyRegistry.js:11`, VERIFIED) ignores unknown fields. A control doc with an allowlist field, on today's code, selects **everyone**.
- **(c) Flag `true` with no control doc → refusal, not legacy.** **The prompt's assumption is false.**
  - `:46` `if (!controlSnap.exists || !validStockAdmissionControl(control)) refuseStock('shared_admission_closed');` (VERIFIED)
  - → `agentBattleService.js:336` rethrows (VERIFIED)
  - → `decide.js:985` restores the cooldown, and `:1073` returns **HTTP 503** `{ error: 'Stock admission unavailable', reason, retriable: true }` (VERIFIED).
  - The same happens with `enabled: false`. No control-doc state yields legacy for a selected creation. That matches the runbook (`…ADMISSION_RUNBOOK_V1_20261013.md:31`).
  - **Byte-identical legacy creation for everyone holds only while the code flag is false** (`src/config/featureFlags.js:3259`, VERIFIED; the runbook's `:3201` anchor is stale).
  - With the flag on, tournament creations stay byte-identical with zero extra reads.
  - **Fence-adjacent:** two lines key on the global flag, not on per-battle selection:
    - `agentBattleService.js:327` `if (!isTournament && stockSelected !== stockAdmissionEnabled()) refuseStock('creation_selection_changed');`
    - `:336` (VERIFIED)
    - With the flag on and an allowlist, a non-pilot user's ordinary creation failure becomes a retriable 503 with a cooldown restore, instead of today's 500, and every non-pilot creation pays one extra control read.
    - `agentBattleService.js` is §1-fenced. → F2.
- **(d) Rules.**
  - There is no explicit match for `stockThresholdControl` or `stockThresholdInputs`.
  - Both fall to `firestore.rules:1419–1422` `match /{document=**} { allow read, write: if false; }` (VERIFIED).
  - So client access is denied. No rules test names either collection (VERIFIED (sub)).

### E7. Model identity (the v2 change surface)

The tuple is hard-coded **once**, at `src/utils/stockThresholdModel.js:5–11` (VERIFIED):
- `modelId: 'stock_measured_atr14_fullday_v1'`
- `publicationRuleId: 'eodhd_us_completed_session_observation_v1'`
- `policyHash: 'baa2b396…'`
- `publicationRuleHash: '3ad8e14b…'`
- `approvedPolicyRef: 'owner_baggerbomb_stock_thresholds_v1_20261013@v1'`

How the registry uses it:
- `api/_utils/stockThresholdPolicyRegistry.js:1` imports `docs/specs/BAGGERBOMB_STOCK_THRESHOLDS_POLICY_CANDIDATE_V1_20261012.json`.
- `:6` **recomputes both hashes** with `canonicalContentHash` and throws on mismatch.
- `:7` adds `collectorId: 'eodhd_stock_server_collector_v1'` and `activationAuthorized: false`.
- `:8` holds one model only (`sameModel(model) ? STOCK_APPROVAL : null`).
- All VERIFIED.
- The model id sits inside the hashed policy and the rule id sits inside the hashed rule, so a v2 id moves both hashes.

| File | Kind | Pins |
|---|---|---|
| `src/utils/stockThresholdModel.js:6–10` | code (source of truth) | all 5 |
| `api/_utils/stockThresholdPolicyRegistry.js:6–7` | code | recomputed hashes; collectorId |
| `docs/specs/…POLICY_CANDIDATE_V1_20261012.json` | data imported by code | modelId :8 (hashed), ruleId :33 (hashed), hashes :111–112 (recorded only, not read) |
| `api/_utils/__fixtures__/stockThresholdHarness.js:37` | test fixture | collectorId; `STOCK_MODEL` by import |
| `api/cron/agent-evaluate.stockThresholds.test.js:171` | test | modelId literal |
| `stockThresholdAdmission.test.js:10`, `decide.stockSettlementGuard.test.js:18` | tests | `STOCK_MODEL` by import |
| `docs/approvals/…ADOPTION_20261013.md:5–10`, runbook `:22–26`, dormant spec `:21`, implementation review `:16` | docs | all or most |

Copies are also persisted into the battle stamp, receipts, `stockScoreEvidence.model`, `closedTrade.stockThresholdModel`, the input attestation and the control doc's `model`. **None exist in production (B3).**

**Retiring v1:** `stockThresholdModel.js:27` (VERIFIED) makes any v1 stamp `unavailable`. With 0 v1 battles that is safe, but the Ruling 4 terminal should also handle route `unavailable`, so a stray stamp can still end. A separate, unrelated hash: `measuredStockThreshold.js:13` `POLICY_HASH` (the stage-1 measurement policy).

### E8. Open overlaps

- **Corrected crypto swap** (`stockThresholdAdmission.js`, VERIFIED):
  - The incoming fill `:236` `const fill = inReceipt?.fill ?? prices[benchAsset.symbol]?.current;` / `:237` `if (!positive(fill)) …` **ignores `fallback: true`**. The exit side refuses it (`:130`).
  - A non-200 response yields `{ current: result.daily[0].close, fallback: true }` (`marketDataCache.js:825–828`, VERIFIED), where `daily[].close` is the **adjusted** close (`:317`, VERIFIED (sub)).
  - So a corrected game can open a crypto position at a stale adjusted daily close.
  - The same fallback-blind `current > 0` check scores crypto each tick (`agent-evaluate.js:1313`, `:1317`, VERIFIED (sub)).
  - A second, parity-only gap: there is no positive check on the outgoing crypto entry (`:231`), so a 0 or undefined entry banks 0 points.
  - Excluding this route from the pilot (per the default plumbing) is the right call.
- **PR 966: MERGED** (`531c2088 Merge pull request #966 …/claude/na-quote-invalid-price`, VERIFIED with `git log`).
  - Its only production change is `api/_utils/marketDataCache.js` (`toUsableQuotePrice`).
  - **No overlap** with `agent-evaluate.js` production code, `agentSwapExecution.js`, `stockThresholdAdmission.js` or the capture fields (VERIFIED (sub), merge diff).
  - The **non-200 adjusted-close fallback is still on main** (`marketDataCache.js:789–790`, :825–828); its build record flags it as urgent (`docs/audits/20261014_BUILD_NA_QUOTE_INVALID_PRICE.md:160`).
  - **Universe hygiene** exists only as out-of-scope text; there is no code.

### E9. Fence

§1-fenced files touched by this map:
- `api/agent/decide.js`
- `api/_utils/agentSwapExecution.js`
- `api/_utils/agentScoring.js`
- `api/_utils/agentRiskManager.js`
- `api/_utils/agentBattleService.js`
- `api/_utils/agentEvalPromptAssembly.js`
- `api/_utils/agentGuardrails.js`

| Contact | Needed by | In adopted §6? |
|---|---|---|
| `agentBattleService.js:327`, `:336`: key on per-battle selection, not the global flag | Ruling 5 ("everyone else stays legacy") | **Partly.** §6 names the creation contact (`:309`/`:323` at the spec baseline; these are the drifted lines), but this is a **behavior change** for non-pilot users. → F2. |
| `agentEvalPromptAssembly.js:356–397`, `:206`, `:541–547`: model-aware tiered reward text | a truthful prompt for v2 games (E5) | **No.** §6 lists only `:1135`, `:1424`, `:1470`, `:1502`. → F2. |
| `agentRiskManager.js:150`/`:153` | Ruling 3 | No edit needed. The unavailable context already disables only LOCK. |
| `decide.js:811–813`, `:1368` settlement guards | Ruling 4 | No edit needed. They release once completion commits. |
| `agentSwapExecution.js:228` dispatch, `agentGuardrails.js:717` | — | unchanged |

No other fence contact is needed. The rest is non-fenced:
- `stockThresholdModel.js`, admission, registry, provider;
- `agent-evaluate.js` (`processAgentBattle` and completion, both §6);
- the readers (K3-3, default-approved);
- the modal and chart (default-approved);
- `marketDataCache.js` (shared).

## F. Size and risks

### F1. Size

| Slice | Files (approx.) | Lines (approx.) |
|---|---|---|
| v2 contract: model, registry, new v2 policy JSON, approval doc, runbook | 5–6 | 150–300 |
| Ruling 1: model :52–:80, admission :129–:141/:230–:268, marker removal | 2 | 60–120 |
| Ruling 2: late-start refusal in `prepareStockCreation`/collector, early-close aware | 1–2 | 30–60 |
| Ruling 3: four early returns → continue with risk; null-safe feed, R11 and proposal writes; `finalizeCronState` on every corrected exit | 1 (`agent-evaluate.js`) | 120–250 |
| Ruling 4: terminal completion, both pattern-logger callers, null statusFeed score, optional last-valid-frame record | 2–3 | 120–250 |
| Ruling 5: allowlist in control and registry, selection `return null`, fenced `agentBattleService.js:327/:336` | 3 | 40–80 |
| Modal and chart: six fill targets on the chart and tab, WhyPanel proximity text | 3–4 | 80–200 |
| K3-3 readers: voice cache, chat prompt, other cache readers, reflection, pattern logger, film tape (merge, replay, capture), bagger moment, ManageStation / ReviewStation / history, evidence label | 10–13 | 300–600 |
| Crypto-swap route excluded from the pilot | 1 | 10–30 |
| Tests (unit, evaluator replays, guards, mutation rows) | 12–16 | 1,200–2,000 |
| **Total** | **≈ 38–45** | **≈ 2,200–3,500** |

One branch and one PR is **feasible**. Everything sits in a known set of files, and the only fenced edits are `agentBattleService.js` (2 lines) and, if approved, the prompt block. It is far above the review threshold (≥10 files / ≥1,500 lines), so BUILD_RULES §2 requires:
- the multi-lens adversarial review with refuting verifiers;
- mutation checks;
- `vite build`;
- a `docs/audits/` record.

A clean split, if Fable prefers: (1) contract and rulings; (2) readers and modal.

### F2. Founder decisions not covered by Rulings 1–5

1. **Pilot gate semantics.** With the code flag on, every tiered creation is *selected*. A missing or disabled control doc then 503s **everyone**. For the pilot:
   - non-allowlisted owners must `return null` before any read;
   - fenced `agentBattleService.js:327/:336` must key on per-battle selection, or non-pilot failures become 503s with cooldown restores.
   - Approve that fence contact. Also decide whether "control missing" should mean *legacy for all* during the pilot, which reverses the runbook's "never legacy as a fallback".
2. **Ruling 4 frame record.** Either add a last-valid-frame record (a new write on each valid commit), or accept "the latest stored frame if valid, else result unavailable". Any swap makes every earlier frame unusable by construction.
3. **Creation outside regular hours.** 30 of 81 tiered battles (37%) were created pre-open, after close or at weekends, including `io4sC…` at 00:35 ET. The corrected collector:
   - refuses 16:00–16:15 ET (publication window, `stockThresholdMeasurementProvider.js:22`, VERIFIED);
   - otherwise fills from whatever real-time returns at that moment (see C3);
   - then plays the next trading day. Its first evaluating tick (09:30 ET) sees ≈ 09:15 provider time, which this session did not measure.
   - Allow, refuse, or defer the fill to the open?
4. **K2-6 stand-in.** Branch A (receipt fill as the same-time valuation; recommended) or Branch B (drop it).
5. **Prompt truthfulness.** The static tiered reward text (fenced, outside §6) teaches the legacy `baseATR` divisor to v2 games. Approve the fence contact, or accept the self-labelled rows as enough.
6. **Terminal side effects.** Should "result unavailable" retire the battle's vision (`:6936`) and write the dark settlement record? Neither is a reward.
7. **Evaluator quote fallback to `previousClose`** (`marketDataCache.js:799`). For corrected stocks, should valuation take `close` strictly, as the collector does? It is a shared quote path.
8. **Completion timing.** Every tiered battle carries crypto, so `expiresAt` is 20:00 ET (00:00 UTC), outside cron hours. Completion, and Ruling 4's terminal write, land at the **next weekday's 09:00 ET** run; a Friday battle completes Monday. Also, crypto stops being evaluated at 15:45 ET, like stocks (`isMarketOpen` gate). Accept, or schedule?
9. **v2 policy content.** Should the v2 JSON carry Ruling 1's timing rule and Ruling 2's N as hashed policy fields? Then a later change of N is a v3. Or should they stay code constants under the v2 id?
10. **Pilot crypto.** Excluding the corrected crypto swap: refuse every crypto swap in pilot games (simplest), or only refuse `fallback: true` fills?
11. **Allowlist identity.** Key on `ownerId` (account) or `agentId` (Cipher only)? Accounts can own several agents (FT_QA owns two "Cipher"s).

### F3. Out-of-scope bugs (reported, not fixed)

1. **CPU stocks always use a flat 2.5%** (`cpuOpponentGenerator.js:13`). The rankings rows have no `baseATR`, so the two sides of every tiered battle score on different scales.
2. **Falsy-zero rank:** `decide.js:1265` gives the calmest stock (rank 0) **4.0%**, while the swap paths give 2.5% (`agent-evaluate.js:1595`, `:2669`). Today that is BRK-B.
3. **Legacy modal disagreements:**
   - The tab uses the deploy entry and ignores `swapPrice`.
   - The chart uses the previous close, and its HIT markers count whole-session highs and lows from before entry.
   - For synthetic (hot-bench or catalyst) swap-ins, the tab's baseline is the live price at modal open, with T = 2.5. The server scores with the stored `atrPercentile × 8`. (`BaggerBombTab.jsx:57`, `agentSwapExecution.js:426`; VERIFIED.)
4. **Placeholder data in the modal:**
   - `BaggerBombTab.jsx:73–86` → `:328–404` **renders on every legacy stock**. Any symbol outside its 7-name table shows 40% hit rate / 2.0% avg move / 12/30 days. It is skipped only on the corrected route (`:46`) or with no baseline (`:94`).
   - `AssetResearchModal.jsx:56–` `getMockFundamentals().rating` renders "Buy" at `:799–800` (v2 layout) when the profile has no `ratingText` (`:347`).
   - The mock `TechnicalAnalysisTab` (random sparkline) is mounted only in the version-1 layout (`:911` `version < 2`, `:1220`). The battle screen passes `version={2}`, which uses the real `TechnicalTabV2` (`:853`). So it is **not shown here**.
   - All VERIFIED.
5. **`indexIntelligence/stockRankings` is recomputed intraday** (computedAt 2026-10-15T17:01Z). A deploy's thresholds depend on when the rankings cron last ran.
6. **The pattern logger logs a null-score battle as a draw** (`battlePatternLogger.js:42`). That is latent until Ruling 4 commits terminal completions.
7. **Stale anchors:**
   - runbook `:33` cites `featureFlags.js:3201`; the flag is now at `:3259`;
   - `filmTape/battleResult.js:6` cites `agent-evaluate.js:5985`; the function is now at `:6692`;
   - the takeover's "~:6675" disposition is now `:6694`.

## Appendix 1. Universe table (all 239 symbols)

Measured ATR14 % is the six-decimal half-even `scoringPctDecimal` of the Oct 14 session. "Qualified (arithmetic)" means `measureStock` arithmetic was valid and the effective percentage is positive. The security-identity check (fundamentals) and fill validation were not run.

| Symbol | Today's rank (atrPercentile) | Legacy baseATR (rank × 8) % | Measured ATR14 % (6-dp) | Ratio legacy ÷ measured | Status |
|---|---|---|---|---|---|
| AAPL | 0.24 | 1.92 | 1.919008 | 1.001 | qualified (arithmetic) |
| ABBV | 0.59 | 4.72 | 2.320394 | 2.034 | qualified (arithmetic) |
| ABT | 0.49 | 3.92 | 2.244763 | 1.746 | qualified (arithmetic) |
| ACN | 0.93 | 7.44 | 4.485025 | 1.659 | qualified (arithmetic) |
| ADBE | 0.78 | 6.24 | 3.125668 | 1.996 | qualified (arithmetic) |
| ADP | 0.28 | 2.24 | 1.862922 | 1.202 | qualified (arithmetic) |
| AEE | 0.04 | 0.32 | 1.438065 | 0.223 | qualified (arithmetic) |
| AEP | 0.15 | 1.20 | 1.542626 | 0.778 | qualified (arithmetic) |
| AFRM | 0.94 | 7.52 | 4.822011 | 1.560 | qualified (arithmetic) |
| ALB | 0.79 | 6.32 | 3.310780 | 1.909 | qualified (arithmetic) |
| AMAT | 0.91 | 7.28 | 4.274711 | 1.703 | qualified (arithmetic) |
| AMD | 0.93 | 7.44 | 4.252028 | 1.750 | qualified (arithmetic) |
| AMGN | 0.53 | 4.24 | 2.422916 | 1.750 | qualified (arithmetic) |
| AMT | 0.56 | 4.48 | 2.475925 | 1.809 | qualified (arithmetic) |
| AMZN | 0.4 | 3.20 | 2.175355 | 1.471 | qualified (arithmetic) |
| AON | 0.41 | 3.28 | 2.069574 | 1.585 | qualified (arithmetic) |
| APD | 0.19 | 1.52 | 1.763696 | 0.862 | qualified (arithmetic) |
| ARE | 0.85 | 6.80 | 3.816525 | 1.782 | qualified (arithmetic) |
| AVB | 1 | 8.00 | — | — | refused: catalog_unavailable |
| AVGO | 0.8 | 6.40 | 3.122434 | 2.050 | qualified (arithmetic) |
| AWK | 0.29 | 2.32 | 1.918175 | 1.209 | qualified (arithmetic) |
| AXP | 0.12 | 0.96 | 1.654512 | 0.580 | qualified (arithmetic) |
| AZO | 0.62 | 4.96 | 2.473763 | 2.005 | qualified (arithmetic) |
| BA | 0.72 | 5.76 | 3.013647 | 1.911 | qualified (arithmetic) |
| BAC | 0.48 | 3.84 | 2.411531 | 1.592 | qualified (arithmetic) |
| BE | 0.98 | 7.84 | 8.816328 | 0.889 | qualified (arithmetic) |
| BKNG | 0.68 | 5.44 | 2.943517 | 1.848 | qualified (arithmetic) |
| BKR | 0.67 | 5.36 | 2.623907 | 2.043 | qualified (arithmetic) |
| BLK | 0.38 | 3.04 | 2.124451 | 1.431 | qualified (arithmetic) |
| BMY | 0.76 | 6.08 | 2.995018 | 2.030 | qualified (arithmetic) |
| BRK-B | 0 | 4.00 | 0.978572 | 4.088 | qualified (arithmetic) |
| BSX | 0.55 | 4.40 | 2.576412 | 1.708 | qualified (arithmetic) |
| C | 0.6 | 4.80 | 2.641110 | 1.817 | qualified (arithmetic) |
| CAG | 0.76 | 6.08 | 3.158547 | 1.925 | qualified (arithmetic) |
| CAT | 0.87 | 6.96 | 3.778371 | 1.842 | qualified (arithmetic) |
| CB | 0.08 | 0.64 | 1.517323 | 0.422 | qualified (arithmetic) |
| CCI | 0.79 | 6.32 | 3.220495 | 1.962 | qualified (arithmetic) |
| CE | 0.8 | 6.40 | 3.542589 | 1.807 | qualified (arithmetic) |
| CEG | 0.97 | 7.76 | 5.796436 | 1.339 | qualified (arithmetic) |
| CF | 0.74 | 5.92 | 3.173208 | 1.866 | qualified (arithmetic) |
| CHTR | 0.88 | 7.04 | 4.473627 | 1.574 | qualified (arithmetic) |
| CI | 0.66 | 5.28 | 2.775202 | 1.903 | qualified (arithmetic) |
| CL | 0.12 | 0.96 | 1.581314 | 0.607 | qualified (arithmetic) |
| CMCSA | 0.5 | 4.00 | 2.224162 | 1.798 | qualified (arithmetic) |
| CME | 0.34 | 2.72 | 2.259733 | 1.204 | qualified (arithmetic) |
| CMG | 0.86 | 6.88 | 4.076952 | 1.688 | qualified (arithmetic) |
| COIN | 0.96 | 7.68 | 5.470448 | 1.404 | qualified (arithmetic) |
| COP | 0.33 | 2.64 | 2.081033 | 1.269 | qualified (arithmetic) |
| COST | 0.06 | 0.48 | 1.733625 | 0.277 | qualified (arithmetic) |
| CRM | 0.82 | 6.56 | 3.416281 | 1.920 | qualified (arithmetic) |
| CRWD | 0.91 | 7.28 | 4.428064 | 1.644 | qualified (arithmetic) |
| CRWV | 0.98 | 7.84 | 7.716848 | 1.016 | qualified (arithmetic) |
| CSCO | 0.65 | 5.20 | 2.403904 | 2.163 | qualified (arithmetic) |
| CSX | 0.02 | 0.16 | 1.383300 | 0.116 | qualified (arithmetic) |
| CTRA | 0.81 | 6.48 | — | — | refused: catalog_unavailable |
| CTVA | 1 | 8.00 | 6.060827 | 1.320 | qualified (arithmetic) |
| CVS | 0.53 | 4.24 | 2.704155 | 1.568 | qualified (arithmetic) |
| CVX | 0.27 | 2.16 | 1.884796 | 1.146 | qualified (arithmetic) |
| D | 0.15 | 1.20 | 1.641720 | 0.731 | qualified (arithmetic) |
| DD | 0.16 | 1.28 | 1.777931 | 0.720 | qualified (arithmetic) |
| DE | 0.72 | 5.76 | 3.040028 | 1.895 | qualified (arithmetic) |
| DG | 0.71 | 5.68 | 2.973189 | 1.910 | qualified (arithmetic) |
| DHI | 0.69 | 5.52 | 2.803908 | 1.969 | qualified (arithmetic) |
| DHR | 0.68 | 5.44 | 2.784415 | 1.954 | qualified (arithmetic) |
| DIS | 0.2 | 1.60 | 1.758353 | 0.910 | qualified (arithmetic) |
| DKNG | 0.95 | 7.60 | 5.678382 | 1.338 | qualified (arithmetic) |
| DLR | 0.51 | 4.08 | 2.555141 | 1.597 | qualified (arithmetic) |
| DLTR | 0.69 | 5.52 | 2.815257 | 1.961 | qualified (arithmetic) |
| DOW | 0.58 | 4.64 | 2.640337 | 1.757 | qualified (arithmetic) |
| DTE | 0.1 | 0.80 | 1.570415 | 0.509 | qualified (arithmetic) |
| DUK | 0.01 | 0.08 | 1.262120 | 0.063 | qualified (arithmetic) |
| DVN | 0.63 | 5.04 | 2.737237 | 1.841 | qualified (arithmetic) |
| EA | 0 | 4.00 | — | — | refused: catalog_unavailable |
| EBAY | 0.66 | 5.28 | 2.593625 | 2.036 | qualified (arithmetic) |
| ECL | 0.17 | 1.36 | 1.805809 | 0.753 | qualified (arithmetic) |
| ED | 0.09 | 0.72 | 1.568691 | 0.459 | qualified (arithmetic) |
| EIX | 0.77 | 6.16 | 2.887875 | 2.133 | qualified (arithmetic) |
| ELV | 0.51 | 4.08 | 2.521060 | 1.618 | qualified (arithmetic) |
| EMR | 0.45 | 3.60 | 2.413619 | 1.492 | qualified (arithmetic) |
| EOG | 0.35 | 2.80 | 2.085553 | 1.343 | qualified (arithmetic) |
| EQIX | 0.47 | 3.76 | 2.586819 | 1.454 | qualified (arithmetic) |
| EQR | 0.48 | 3.84 | — | — | refused: catalog_unavailable |
| ETN | 0.83 | 6.64 | 3.444155 | 1.928 | qualified (arithmetic) |
| ETR | 0.21 | 1.68 | 1.712235 | 0.981 | qualified (arithmetic) |
| EXC | 0.09 | 0.72 | 1.567740 | 0.459 | qualified (arithmetic) |
| EXR | 0.26 | 2.08 | 1.851240 | 1.124 | qualified (arithmetic) |
| F | 0.39 | 3.12 | 2.211025 | 1.411 | qualified (arithmetic) |
| FANG | 0.4 | 3.20 | 2.125028 | 1.506 | qualified (arithmetic) |
| FCX | 0.84 | 6.72 | 3.509881 | 1.915 | qualified (arithmetic) |
| FDX | 0.05 | 0.40 | 1.686399 | 0.237 | qualified (arithmetic) |
| FE | 0.05 | 0.40 | 1.521062 | 0.263 | qualified (arithmetic) |
| FMC | 0.99 | 7.92 | 5.253964 | 1.507 | qualified (arithmetic) |
| FOXA | 0.64 | 5.12 | 2.630721 | 1.946 | qualified (arithmetic) |
| GD | 0.16 | 1.28 | 1.655692 | 0.773 | qualified (arithmetic) |
| GE | 0.38 | 3.04 | 2.287729 | 1.329 | qualified (arithmetic) |
| GEV | 0.91 | 7.28 | 4.229368 | 1.721 | qualified (arithmetic) |
| GILD | 0.5 | 4.00 | 2.321405 | 1.723 | qualified (arithmetic) |
| GIS | 0.82 | 6.56 | 2.796458 | 2.346 | qualified (arithmetic) |
| GM | 0.5 | 4.00 | 2.570741 | 1.556 | qualified (arithmetic) |
| GME | 0.85 | 6.80 | 4.175217 | 1.629 | qualified (arithmetic) |
| GOOG | 0.44 | 3.52 | 2.295918 | 1.533 | qualified (arithmetic) |
| GOOGL | 0.44 | 3.52 | 2.313765 | 1.521 | qualified (arithmetic) |
| GS | 0.42 | 3.36 | 2.341474 | 1.435 | qualified (arithmetic) |
| HAL | 0.52 | 4.16 | 2.391106 | 1.740 | qualified (arithmetic) |
| HD | 0.35 | 2.80 | 1.994412 | 1.404 | qualified (arithmetic) |
| HES | — | — | — | — | refused: catalog_unavailable |
| HON | 0.27 | 2.16 | 1.972448 | 1.095 | qualified (arithmetic) |
| HOOD | 0.95 | 7.60 | 5.005971 | 1.518 | qualified (arithmetic) |
| HSY | 0.31 | 2.48 | 1.900413 | 1.305 | qualified (arithmetic) |
| HUM | 0.92 | 7.36 | 5.019804 | 1.466 | qualified (arithmetic) |
| IBM | 0.53 | 4.24 | 2.389099 | 1.775 | qualified (arithmetic) |
| ICE | 0.23 | 1.84 | 1.967728 | 0.935 | qualified (arithmetic) |
| IFF | 0.31 | 2.48 | 1.999362 | 1.240 | qualified (arithmetic) |
| INTC | 0.97 | 7.76 | 5.423388 | 1.431 | qualified (arithmetic) |
| INTU | 0.83 | 6.64 | 3.292853 | 2.016 | qualified (arithmetic) |
| IPG | — | — | — | — | refused: catalog_unavailable |
| IRM | 0.64 | 5.12 | 2.811139 | 1.821 | qualified (arithmetic) |
| ISRG | 0.62 | 4.96 | 2.741631 | 1.809 | qualified (arithmetic) |
| ITW | 0.34 | 2.72 | 2.070827 | 1.313 | qualified (arithmetic) |
| JNJ | 0.47 | 3.76 | 2.351227 | 1.599 | qualified (arithmetic) |
| JPM | 0.18 | 1.44 | 1.772945 | 0.812 | qualified (arithmetic) |
| K | — | — | — | — | refused: catalog_unavailable |
| KHC | 0.46 | 3.68 | 2.316237 | 1.589 | qualified (arithmetic) |
| KLAC | 0.9 | 7.20 | 4.180786 | 1.722 | qualified (arithmetic) |
| KMB | 0.35 | 2.80 | 1.957262 | 1.431 | qualified (arithmetic) |
| KMI | 0.38 | 3.04 | 2.004284 | 1.517 | qualified (arithmetic) |
| KO | 0.03 | 0.24 | 1.379074 | 0.174 | qualified (arithmetic) |
| KR | 0.62 | 4.96 | 2.574553 | 1.927 | qualified (arithmetic) |
| LEN | 0.89 | 7.12 | 4.223901 | 1.686 | qualified (arithmetic) |
| LIN | 0.13 | 1.04 | 1.636464 | 0.636 | qualified (arithmetic) |
| LLY | 0.73 | 5.84 | 2.843099 | 2.054 | qualified (arithmetic) |
| LMT | 0.22 | 1.76 | 1.877525 | 0.937 | qualified (arithmetic) |
| LOW | 0.46 | 3.68 | 2.277779 | 1.616 | qualified (arithmetic) |
| LRCX | 0.94 | 7.52 | 4.452461 | 1.689 | qualified (arithmetic) |
| LYV | 0.39 | 3.12 | 2.134734 | 1.462 | qualified (arithmetic) |
| MA | 0.14 | 1.12 | 1.625602 | 0.689 | qualified (arithmetic) |
| MAA | 0.43 | 3.44 | 1.823090 | 1.887 | qualified (arithmetic) |
| MAR | 0.24 | 1.92 | 1.780239 | 1.079 | qualified (arithmetic) |
| MCD | 0.11 | 0.88 | 1.553199 | 0.567 | qualified (arithmetic) |
| MDLZ | 0.21 | 1.68 | 1.798211 | 0.934 | qualified (arithmetic) |
| MDT | 0.61 | 4.88 | 2.632616 | 1.854 | qualified (arithmetic) |
| META | 0.71 | 5.68 | 3.050232 | 1.862 | qualified (arithmetic) |
| MLM | 0.54 | 4.32 | 2.421081 | 1.784 | qualified (arithmetic) |
| MMC | 0.14 | 1.12 | — | — | refused: catalog_unavailable |
| MMM | 0.32 | 2.56 | 2.057817 | 1.244 | qualified (arithmetic) |
| MO | 0.24 | 1.92 | 1.810680 | 1.060 | qualified (arithmetic) |
| MOS | 0.89 | 7.12 | 4.553994 | 1.563 | qualified (arithmetic) |
| MPC | 0.82 | 6.56 | 3.329415 | 1.970 | qualified (arithmetic) |
| MRK | 0.52 | 4.16 | 2.408593 | 1.727 | qualified (arithmetic) |
| MS | 0.57 | 4.56 | 2.490221 | 1.831 | qualified (arithmetic) |
| MSFT | 0.37 | 2.96 | 2.290923 | 1.292 | qualified (arithmetic) |
| MTCH | 0.44 | 3.52 | 2.349444 | 1.498 | qualified (arithmetic) |
| MU | 0.94 | 7.52 | 4.844487 | 1.552 | qualified (arithmetic) |
| NEE | 0.17 | 1.36 | 1.691609 | 0.804 | qualified (arithmetic) |
| NEM | 0.73 | 5.84 | 2.940122 | 1.986 | qualified (arithmetic) |
| NFLX | 0.43 | 3.44 | 2.169072 | 1.586 | qualified (arithmetic) |
| NKE | 0.81 | 6.48 | 3.243626 | 1.998 | qualified (arithmetic) |
| NOC | 0.42 | 3.36 | 2.158666 | 1.557 | qualified (arithmetic) |
| NOW | 0.87 | 6.96 | 3.974154 | 1.751 | qualified (arithmetic) |
| NSC | 0.02 | 0.16 | 1.372945 | 0.117 | qualified (arithmetic) |
| NUE | 0.58 | 4.64 | 2.555849 | 1.815 | qualified (arithmetic) |
| NVDA | 0.65 | 5.20 | 2.543257 | 2.045 | qualified (arithmetic) |
| NVO | 0.26 | 2.08 | 1.780093 | 1.168 | qualified (arithmetic) |
| NWS | 0.36 | 2.88 | 2.069117 | 1.392 | qualified (arithmetic) |
| O | 0.04 | 0.32 | 1.450247 | 0.221 | qualified (arithmetic) |
| OKE | 0.59 | 4.72 | 2.592460 | 1.821 | qualified (arithmetic) |
| OMC | 0.32 | 2.56 | 2.112522 | 1.212 | qualified (arithmetic) |
| ORCL | 0.96 | 7.68 | 5.052205 | 1.520 | qualified (arithmetic) |
| ORLY | 0.22 | 1.76 | 1.769029 | 0.995 | qualified (arithmetic) |
| OXY | 0.56 | 4.48 | 2.434457 | 1.840 | qualified (arithmetic) |
| PANW | 0.92 | 7.36 | 4.713783 | 1.561 | qualified (arithmetic) |
| PARA | 0.99 | 7.92 | — | — | refused: catalog_unavailable |
| PCG | 0.76 | 6.08 | 3.060897 | 1.986 | qualified (arithmetic) |
| PEG | 0.3 | 2.40 | 1.958819 | 1.225 | qualified (arithmetic) |
| PEP | 0.28 | 2.24 | 1.915702 | 1.169 | qualified (arithmetic) |
| PFE | 0.3 | 2.40 | 1.970949 | 1.218 | qualified (arithmetic) |
| PG | 0.15 | 1.20 | 1.644139 | 0.730 | qualified (arithmetic) |
| PGR | 0.56 | 4.48 | 2.495985 | 1.795 | qualified (arithmetic) |
| PKG | 0.25 | 2.00 | 1.829821 | 1.093 | qualified (arithmetic) |
| PLD | 0.36 | 2.88 | 1.934090 | 1.489 | qualified (arithmetic) |
| PLTR | 0.77 | 6.16 | 3.085457 | 1.996 | qualified (arithmetic) |
| PM | 0.49 | 3.92 | 2.153894 | 1.820 | qualified (arithmetic) |
| PPG | 0.33 | 2.64 | 1.989538 | 1.327 | qualified (arithmetic) |
| PPL | 0.03 | 0.24 | 1.502569 | 0.160 | qualified (arithmetic) |
| PSA | 0.23 | 1.84 | 1.820098 | 1.011 | qualified (arithmetic) |
| PSX | 0.74 | 5.92 | 2.876196 | 2.058 | qualified (arithmetic) |
| PWR | 0.88 | 7.04 | 3.856089 | 1.826 | qualified (arithmetic) |
| QCOM | 0.85 | 6.80 | 3.902047 | 1.743 | qualified (arithmetic) |
| RKLB | 0.97 | 7.76 | 6.430865 | 1.207 | qualified (arithmetic) |
| ROST | 0.41 | 3.28 | 2.192083 | 1.496 | qualified (arithmetic) |
| RTX | 0.18 | 1.44 | 1.659911 | 0.868 | qualified (arithmetic) |
| SBAC | 0.78 | 6.24 | 3.131300 | 1.993 | qualified (arithmetic) |
| SBUX | 0.6 | 4.80 | 2.500191 | 1.920 | qualified (arithmetic) |
| SCHW | 0.29 | 2.32 | 1.790880 | 1.295 | qualified (arithmetic) |
| SHOP | 0.86 | 6.88 | 3.731718 | 1.844 | qualified (arithmetic) |
| SHW | 0.45 | 3.60 | 2.332092 | 1.544 | qualified (arithmetic) |
| SLB | 0.74 | 5.92 | 2.891893 | 2.047 | qualified (arithmetic) |
| SNOW | 0.9 | 7.20 | 4.327325 | 1.664 | qualified (arithmetic) |
| SO | 0.07 | 0.56 | 1.505610 | 0.372 | qualified (arithmetic) |
| SPG | 0.06 | 0.48 | 1.490042 | 0.322 | qualified (arithmetic) |
| SPGI | 0.25 | 2.00 | 1.838293 | 1.088 | qualified (arithmetic) |
| SRE | 0.06 | 0.48 | 1.558552 | 0.308 | qualified (arithmetic) |
| STZ | 0.55 | 4.40 | 2.419075 | 1.819 | qualified (arithmetic) |
| SYK | 0.61 | 4.88 | 2.566034 | 1.902 | qualified (arithmetic) |
| SYY | 0.07 | 0.56 | 1.596092 | 0.351 | qualified (arithmetic) |
| T | 0.75 | 6.00 | 2.577614 | 2.328 | qualified (arithmetic) |
| TJX | 0.29 | 2.32 | 1.982877 | 1.170 | qualified (arithmetic) |
| TMO | 0.67 | 5.36 | 2.822129 | 1.899 | qualified (arithmetic) |
| TMUS | 0.79 | 6.32 | 3.089097 | 2.046 | qualified (arithmetic) |
| TRGP | 0.59 | 4.72 | 2.388073 | 1.976 | qualified (arithmetic) |
| TSLA | 0.68 | 5.44 | 2.983713 | 1.823 | qualified (arithmetic) |
| TSN | 0.08 | 0.64 | 1.559783 | 0.410 | qualified (arithmetic) |
| TTWO | 0.75 | 6.00 | 2.926644 | 2.050 | qualified (arithmetic) |
| TXN | 0.7 | 5.60 | 2.895574 | 1.934 | qualified (arithmetic) |
| UDR | 0.2 | 1.60 | 1.783611 | 0.897 | qualified (arithmetic) |
| UNH | 0.7 | 5.60 | 2.825041 | 1.982 | qualified (arithmetic) |
| UNP | 0.03 | 0.24 | 1.396128 | 0.172 | qualified (arithmetic) |
| UPS | 0.11 | 0.88 | 1.672732 | 0.526 | qualified (arithmetic) |
| USB | 0.21 | 1.68 | 1.800543 | 0.933 | qualified (arithmetic) |
| V | 0.18 | 1.44 | 1.685395 | 0.854 | qualified (arithmetic) |
| VICI | 0.12 | 0.96 | 1.556545 | 0.617 | qualified (arithmetic) |
| VLO | 0.84 | 6.72 | 3.512083 | 1.913 | qualified (arithmetic) |
| VMC | 0.57 | 4.56 | 2.459539 | 1.854 | qualified (arithmetic) |
| VRTX | 0.54 | 4.32 | 2.370683 | 1.822 | qualified (arithmetic) |
| VTR | 0.41 | 3.28 | 2.150787 | 1.525 | qualified (arithmetic) |
| VZ | 0.71 | 5.68 | 2.348044 | 2.419 | qualified (arithmetic) |
| WBA | — | — | — | — | refused: catalog_unavailable |
| WBD | 0.01 | 0.08 | — | — | refused: catalog_unavailable |
| WEC | 0.09 | 0.72 | 1.579793 | 0.456 | qualified (arithmetic) |
| WELL | 0.32 | 2.56 | 2.087756 | 1.226 | qualified (arithmetic) |
| WFC | 0.47 | 3.76 | 2.371535 | 1.585 | qualified (arithmetic) |
| WM | 0.13 | 1.04 | 1.523258 | 0.683 | qualified (arithmetic) |
| WMB | 0.65 | 5.20 | 2.400903 | 2.166 | qualified (arithmetic) |
| WMT | 0.37 | 2.96 | 1.998475 | 1.481 | qualified (arithmetic) |
| WY | 0.63 | 5.04 | 2.561980 | 1.967 | qualified (arithmetic) |
| XEL | 0.1 | 0.80 | 1.609418 | 0.497 | qualified (arithmetic) |
| XOM | 0.26 | 2.08 | 1.815071 | 1.146 | qualified (arithmetic) |
| YUM | 0.19 | 1.52 | 1.745177 | 0.871 | qualified (arithmetic) |
| ZS | 0.88 | 7.04 | 4.735786 | 1.487 | qualified (arithmetic) |

## Appendix 2. Evidence and cost

**Scripts and raw outputs** (session scratchpad, outside the repo):
- `reads/readB.mjs`, `readB4*.mjs`, `readB5.mjs`, `readB6.mjs`
- `universe/measureD.mjs` → `universe.json`
- `feedpoll/poll.mjs`, `poll2.mjs`, `analyze.mjs` → `samples.jsonl`, `analysis.json`

**Firestore:** Admin SDK `get`, `count()` and `select()` only:
- `agentBattles` (active, 7-day window, full-collection `select` for timing);
- `agents` (Cipher);
- `users` (existence and an FT_QA string test, booleans only);
- `indexIntelligence/stockRankings`;
- `stockThresholdInputs` / `stockThresholdControl` counts.

**EODHD:** Task C: 330 symbol-quotes on the multi-symbol real-time endpoint (EODHD bills 1 call per symbol; my tally). Task D: 228 `eod` calls. Account counter (`/api/user`, shared with production crons, so not attributable): 39732 at start; end reading pending. Daily limit 100,000.
