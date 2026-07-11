# LevelStory — Session 2: Config Contract + Fetch/Normalize Build Report

**Status:** ✅ **COMPLETE.** Config transcribed & frozen; fetcher + DST-aware normalizer + 6 test suites built; **50/50 tests green**; probe-scale data fetched & normalized on disk (gitignored). HARD STOP for founder review before the full-universe fetch and Session 3.

**Session type:** First BUILD session. Phase 0 (config contract) + Phase 1 (fetch/normalize/test). No level construction, event detection, or feature code (out of scope).

**Repo / branch / HEAD:** `fashraf94/TradeSeven` (working dir `portfolio-duel`) · branch `claude/level-study-session2-config-fetcher`, cut from the S1 completion tip `87ea275` · Phase 0 committed at `cc5d415`.

---

## Executive verdict table

| Deliverable | Verdict | Evidence |
|---|---|---|
| **Preflight** (branch, key, egress) | ✅ PASS | S2 branch off `87ea275`; `.env` gitignored; live AAPL daily bars returned. Key is `VITE_EODHD_API_KEY` (prompt said `EODHD_API_KEY` — §Findings F0). |
| **Phase 0 — config contract** | ✅ DONE | `research/level-study/config.js` (`STUDY_CONFIG_VERSION=1`, deep-frozen, pure data). All 10 §3 definitions + every knob transcribed. Rulings R1–R3/A1–A3 recorded. **7 ⚠ CHOICE flags** for founder review (§Config ambiguities). |
| **Traceability table** | ✅ DONE | `docs/LEVELSTORY_CONFIG_TRACEABILITY.md` maps every value → source section. |
| **Fetcher** (`01-fetch-history.js`) | ✅ BUILT | Node, disk-cached, paced, retry+backoff, intraday chunked ≤600 cal-days, per-run manifest. Fetched the 14-symbol probe: 44 artifacts, ~134 MB. |
| **Normalizer** (DST-aware) | ✅ BUILT | Auction tag (A2), split factors (A1), warmup tag (A6), self-built 9:30-anchored ET hourly bars (§4.4) — all in exchange time via `Intl` `America/New_York`. |
| **Test #1 — cross-grain invariant** | ✅ PASS | **100%** on all 14 symbols (733–737 auctioned sessions each within 0.1%), NVDA split window included. |
| **Test #2 — warmup guard** | ✅ PASS | No bar ≥ studyStart tagged warmup; study-window selector leaks none — all 14. |
| **Test #3 — hourly alignment + DST** | ✅ PASS | First hourly 09:30 ET, last 16:00 ET, 7 bars/session — proven on **June (EDT) AND January (EST)** fixtures. |
| **Test #4 — auction-bar tag** | ✅ PASS | ≤1 auction/session, at 16:00 ET on full days, both DST regimes — all 14. |
| **Test #5 — depth eligibility (R2)** | ✅ PASS | All 14 probe symbols ≥550 pre-study sessions. COIN thinnest (+12). |
| **Test #6 — split adjustment** | ✅ PASS | NVDA split window: adjusted 5m auction ≈ daily adjusted_close to **0.0000%**; raw jumps 10×, adjusted continuous. |
| **Isolation & fence** | ✅ CLEAN | Zero product imports; zero fence contact; data gitignored before first fetch. |

**Findings that extend/contradict Session 1** (report-don't-adapt): 6, in §Findings. The headline is **F3 — a market-wide vendor gap in the 5m closing-auction print, 2025-10-13→27**, which needs founder attention before outcome labeling in later sessions.

---

## 0. Preflight

- **Branch:** created `claude/level-study-session2-config-fetcher` from the S1 tip `87ea275` (fixtures + graded discovery report), per S2 prompt §0. (Note: this branches from the S1 session branch rather than `main`, per the explicit S2 instruction — the S1 fixtures/report are prerequisites; recorded here per BUILD_RULES §2.)
- **Credential:** `.env` present and gitignored (`git check-ignore .env` → match). Key read as `VITE_EODHD_API_KEY`; never printed, logged, or committed. All manifest URLs redacted (`api_token` → `REDACTED`).
- **Egress smoke:** `GET /api/eod/AAPL.US?from=2026-06-01&to=2026-06-05` → 5 daily bars with `adjusted_close`. ✅
- **TLS:** curl calls used `--ssl-no-revoke` (schannel); the fetcher uses Node native `fetch` (no schannel).

## 1. What was built

```
research/level-study/
  package.json          # isolated ESM package, zero deps, node --test
  config.js             # STUDY_CONFIG_VERSION=1, deep-frozen pure-data contract
  01-fetch-history.js   # orchestrator: fetch → normalize → depth sweep → manifest
  lib/
    session-time.js     # DST backbone: UTC epoch → America/New_York via Intl (no hardcoded offsets)
    eodhd-client.js     # cache, pacing, retry/backoff, intraday chunking, manifest, key handling
    normalize.js        # auction tag (A2), split factors (A1), warmup (A6), 9:30 hourly bars (§4.4)
    depth-eligibility.js# R2 ≥550-session sweep (the universe-freeze tool)
  tests/                # 6 suites, 50 subtests, node:test (zero deps)
  data/                 # GITIGNORED — raw cache + normalized daily.json/sessions.json
docs/
  LEVELSTORY_RULINGS_AND_AMENDMENTS_S2.md   # R1–R3, A1–A3 verbatim
  LEVELSTORY_CONFIG_TRACEABILITY.md         # every config value → source, ⚠ register
  discovery/SESSION2_BUILD_REPORT.md        # this file
  discovery/SESSION2_FETCH_MANIFEST_*.json  # small metadata (committed)
```

**Isolation:** every study file imports only other study files (config + lib) — no `src/`/`api/` imports either direction (verified). No fence file (`decide.js`, `agentScoring.js`, etc.) was opened or referenced. `research/level-study/data/` was added to `.gitignore` and verified (`git check-ignore`) **before the first fetch**; fixtures and code are not ignored.

## 2. Phase 0 — Config contract

`config.js` is `STUDY_CONFIG_VERSION = 1`, a single `Object.freeze`d (deeply) pure-data object — no study logic. It transcribes all ten §3 Session-0 definitions and every knob: level source families & confluence tiers, availability fields, lineage (match/merge/split/retire), episode/re-arm, hourly-class P/C/W thresholds, the full outcome grid, bridge columns, ambiguity rules, features (fingerprint + momentum + higher-TF + RS + context layers A2–A5), regime thresholds, extension buckets, P1–P6 (incl. P6's fallback ladders), honesty floors, holdout gates, sample budget, and report views. Sources cited inline; mapped in the traceability table.

**Config ambiguities flagged for founder review (⚠ — the only non-verbatim values):**

| # | Path | Choice | Basis |
|---|---|---|---|
| 1 | `range.holdoutStart` | `2025-12-10` | R1 "final ~7 months" + parent §13 "29 in-sample months" (2023-07-10 + 29 mo). Not exercised this session. |
| 2 | `fetch.dailyFetchStart` | `2018-01-01` | §A6 "≥550 with margin"; matches S1 fixtures; +837 margin for mature names. |
| 3 | `fetch.pacingMs` | `300` | Spec "gentle pacing", no number; 156× budget headroom. |
| 4 | `fetch.retry` | 4 attempts, 800ms×2 backoff | Spec "retry-with-backoff", no numbers; transient statuses only. |
| 5 | `levels…psychological.increments` | `null` | Parent §5.1 gives no band→increment map; feature default OFF. |
| 6 | `features.fingerprint.todBucketEtCutoffs` | `null` | Parent §8.2 names buckets, no ET cutoffs; pin in Session 5. |
| 7 | `hourlyClass.evaluationOrder` | table order | Rules are disjoint; order immaterial (recorded for determinism). |

Plus `universe.sectorMap = {}` (awaits the founder universe freeze, Addendum §A2.2).

## 3. Phase 1 — Fetch & normalize

**Fetch (probe = 14 symbols):** 44 cached artifacts, ~134 MB on disk (gitignored):
- 14 daily whole-responses (`2018-01-01 → 2026-07-10`, one call each — daily returns whole).
- 28 intraday 5m chunks (`2023-07-10 → 2026-07-10`, **2 chunks/symbol** at ≤600 cal-days; study window is 1,096 days).
- 1 bulk earnings call (9 equities, 2021-02-10 → 2026-07-10 → **192 records**).
- 1 January/EST DST fixture (`fixtures/sample-5m/AAPL_5m_2026-01.json`).

Disk cache verified working: the final idempotent run served 43/44 from cache (1 network re-fetch for the earnings key-fix, F5). Manifest committed under `docs/discovery/`.

**Warmup start (computed):** the 550th daily session before `2023-07-10` is **`2021-04-30`** (reference symbol AAPL). The fetcher starts daily at **`2018-01-01`**, giving mature names **1,387 pre-study sessions (+837 margin)**. COIN (listed 2021-04-14) has 562 pre-study sessions — above the 550 floor by 12, so it clears R2 on its full history without needing the 2018 start.

**Normalization (per §4.4, A1, A2, A6), all in exchange time:**
- Every 5m bar classified in `America/New_York` from its UTC epoch (no hardcoded offsets). Roles: `regular` / `auction` / `invalid` (all-null) / `other` (off-grid or out-of-window).
- Closing auction = the 16:00-ET (etMin 960), null-volume, zero-range print → tagged `closingAuction`, excluded from hourly/pattern math, retained as the session close.
- Split factor `f(S) = dailyAdjustedClose/dailyClose` applied to 5m → `adj*` fields on the daily adjusted basis.
- Self-built 9:30-anchored hourly bars: 7 buckets (09:30–10:30 … 15:30–16:00), auction excluded.
- Daily bars tagged `warmup` (date < 2023-07-10) and `holdout` (≥ 2025-12-10).
- Persisted `daily.json` + `sessions.json` per symbol; raw 5m fully cached (per-bar normalized 5m is reproducible on demand via `lib/normalize.js`, so not re-materialized — a size choice, not a data loss).

## 4. Test results — 50/50 green

`node --test` (Node 22 built-in runner, zero deps): **6 suites, 50 subtests, 50 pass, 0 fail.**

| # | Suite | Subtests | Result |
|---|---|---|---|
| 1 | cross-grain invariant | 15 (14 symbols + NVDA split) | ✅ 100% pass, all symbols within 0.1% |
| 2 | warmup guard | 14 | ✅ tags correct; selector leaks no warmup bar |
| 3 | hourly alignment + DST | 3 | ✅ June (EDT) & January (EST); UTC-window proof |
| 4 | auction-bar tag | 14 | ✅ ≤1/session at 16:00 ET, both regimes |
| 5 | depth eligibility | 2 | ✅ all 14 PASS; utility correctly FAILs a short symbol |
| 6 | split adjustment | 2 | ✅ 0.0000% match; raw 10× vs adjusted continuous |

Tests 3 and 6 are **fixture-based** (run off committed fixtures — no fetched data needed). Tests 1, 2, 4, 5 require the local gitignored probe data (`npm run fetch` first).

## 5. DST proof (the first-class correctness requirement)

The ET session maps to different UTC windows by regime — proven directly on the June (EDT) and January (EST) AAPL 5m fixtures:

| ET wall-clock | June 2026 (EDT, UTC−4) | January 2026 (EST, UTC−5) |
|---|---|---|
| 09:30 ET session open | **13:30 UTC** | **14:30 UTC** |
| 16:00 ET closing auction | **20:00 UTC** | **21:00 UTC** |
| First self-built hourly bar opens | 09:30 ET | 09:30 ET |
| Last self-built hourly bar closes | 16:00 ET | 16:00 ET |
| Hourly bars per full session | 7 | 7 |

Identical exchange-time anchoring, one-hour-shifted UTC — resolved correctly because all session logic derives ET from the UTC epoch via `Intl`. Both DST regimes are present in every one of the 14 symbols' 36-month 5m series (`tz=EDT/EST`).

## 6. Depth-eligibility sweep (R2 — the universe-freeze tool)

The exact PASS/FAIL output for the 14 probe symbols (the founder sweeps the frozen universe with this same utility):

| Symbol | First daily bar | Pre-study sessions | Margin vs 550 | Verdict |
|---|---|---|---|---|
| COIN | 2021-04-14 | 562 | **+12** | ✅ PASS (thinnest) |
| AAPL, NVDA, MSFT, KO, PG, JNJ, TSLA, AMD, SPY, XLK, XLE, SPHB, SPLV | 2018-01-02 | 1,387 | +837 | ✅ PASS |

All 14 clear R2. HOOD and RKLB were dropped upstream (R2/R3) and are not in the probe.

## 7. Findings — behavior that extends or contradicts Session 1

Per the fixture-first rule ("where live behavior contradicts a Session-1 finding, report it — do not silently adapt"). S1 characterized **84 EDT full-day sessions in June 2026**; the 36-month full-range fetch surfaces cases that sample could not:

- **F0 — Credential name.** The key is `VITE_EODHD_API_KEY`, not `EODHD_API_KEY` as the S2 prompt's preflight stated. (S1 §10 already recorded this.) Config records the real name; the standing key-rotation recommendation still stands.

- **F1 — The closing-auction print is NOT present on every session.** S1 §7: "exactly 1 close-print bar per session, no exceptions." At 36-month scale the auction print is present on ~97% of full sessions and **absent** on (a) half-days and (b) vendor-gap sessions (F2, F3). Handled: `hasAuction` is tagged; `sessionClose` falls back to the 15:55 ET close when the auction is missing. **Downstream impact:** EOD outcome labels on auction-less sessions use the 15:55 continuous close, not the 16:00 auction print, and cross-grain cannot be checked there.

- **F2 — Half-days (early 13:00 ET close).** 7 canonical NYSE half-days in-window (day-after-Thanksgiving, July 3, Christmas Eve), detected market-wide (12–14/14 symbols): 2023-11-24, 2024-07-03, 2024-11-29, 2024-12-24, 2025-07-03, 2025-11-28, 2025-12-24. These have ~43 regular bars, no 16:00 auction, and are flagged `earlyClose`. A strict `etMinutes===960` auction gate correctly yields "no auction" here (the 13:00 close survives as the last regular bar).

- **F3 — ⚠ Market-wide vendor gap in the 5m auction print, 2025-10-13 → 2025-10-27.** For ~11 consecutive full sessions, **13–14 of 14 symbols** have no 16:00 auction print in the 5m stream (plus 2025-05-06 at 12/14 and scattered single-symbol gaps). This is an **EODHD data characteristic, not symbol-specific**, and the single biggest item for founder attention: any later session that labels EOD outcomes or checks cross-grain on these dates must use the 15:55 fallback close and disclose it. Daily EOD for these dates is unaffected (present and correct).

- **F4 — Illiquid & anomalous 5m bars (new bar taxonomy).** Three sub-types S1's liquid-name sample never showed, all now handled deterministically:
  - **All-null bars** (`o=h=l=c=v=null`) → role `invalid`, stripped (pitfall #10). Rare on liquid names (AAPL 92 bars/12 sessions) but **pervasive on SPHB: 3,284 bars across 496 sessions** — SPHB's thin 5m stream returns many no-trade windows as all-null. SPHB/SPLV are used at **daily** grain (beta_appetite, §A3.2), so 5m sparsity is low-impact — but the founder may choose **not to fetch SPHB/SPLV 5m at all** for the full universe (§Decisions).
  - **Illiquid null-volume flat bars** (`o=h=l=c`, `v=null`, mid-session) → kept as `regular` no-trade bars (real price, unknown volume; counted as `nullVolRegularBarCount`). Common on SPHB (61 sessions), SPLV, XLK. A signature-only auction rule mis-tagged these as extra "auctions" (caught in test — see F-note).
  - **Off-grid halt prints** (e.g., 13:21, 10:06 — not 5-min aligned, null-volume zero-range) → role `other`, excluded. Verified they carry **no real volume** (lossless to drop).

- **F5 — Fetcher bug found & fixed: earnings cache key omitted the symbol list.** A 9-equity earnings call was served an AAPL-only cache hit (21 records). Fixed the cache key to include the symbol set (now 192 records). Principle enforced: a cache key must capture every request parameter that changes the response.

**F-note (auction detection, resolved):** because F4's illiquid flat bars and F2's half-days both stress the auction definition, detection was iterated to the **exact A2/S1 rule** — the *16:00-ET*, null-volume, zero-range, on-grid print — which uniquely isolates the true auction (0 multi-auction sessions across all 14 symbols; auctions only ever at etMin 960). This is faithful to A2, not a relaxation.

## 8. Data-quality summary (per symbol)

All 14: 2,141 daily bars (COIN 1,316), 754 5m sessions. `auc` = auctioned sessions; `gap` = full-day-no-auction (F3); `invSess`/`invBars` = all-null bars (F4); `nvReg` = sessions with illiquid null-volume regular bars.

| Sym | daily | pre-study | auc | half | gap | invSess | invBars | nvReg | cross-grain |
|---|---|---|---|---|---|---|---|---|---|
| AAPL | 2141 | 1387 | 733 | 7 | 14 | 12 | 92 | 1 | 733/733 |
| NVDA | 2141 | 1387 | 737 | 5 | 12 | 11 | 72 | 1 | 737/737 |
| MSFT | 2141 | 1387 | 737 | 4 | 13 | 12 | 18 | 2 | 737/737 |
| KO | 2141 | 1387 | 734 | 7 | 13 | 15 | 23 | 5 | 734/734 |
| PG | 2141 | 1387 | 735 | 7 | 12 | 13 | 21 | 6 | 735/735 |
| JNJ | 2141 | 1387 | 734 | 7 | 13 | 11 | 18 | 6 | 734/734 |
| TSLA | 2141 | 1387 | 733 | 7 | 14 | 10 | 78 | 1 | 733/733 |
| AMD | 2141 | 1387 | 733 | 7 | 14 | 12 | 72 | 9 | 733/733 |
| COIN | 1316 | 562 | 730 | 7 | 17 | 11 | 18 | 5 | 730/730 |
| SPY | 2141 | 1387 | 734 | 7 | 13 | 15 | 86 | 21 | 734/734 |
| XLK | 2141 | 1387 | 731 | 7 | 16 | 14 | 24 | 25 | 731/731 |
| XLE | 2141 | 1387 | 730 | 7 | 17 | 16 | 83 | 23 | 730/730 |
| **SPHB** | 2141 | 1387 | 733 | 7 | 5 | **496** | **3284** | 61 | 733/733 |
| SPLV | 2141 | 1387 | 731 | 7 | 16 | 15 | 85 | 32 | 731/731 |

Cross-grain is **100% wherever an auction exists** — the invariant never failed once across all auctioned sessions of all 14 symbols.

## 9. Manifest

`docs/discovery/SESSION2_FETCH_MANIFEST_2026-07-11T05-47-50-235Z.json` — 44 artifacts, ~133.7 MB, every URL redacted. Fields: per-symbol counts, warmup, depth sweep, earnings, and per-artifact `{tag, urlRedacted, fromCache, status, bytes, savedTo}`.

## 10. Founder decisions requested (at this STOP)

1. **Review the frozen config** via `docs/LEVELSTORY_CONFIG_TRACEABILITY.md`, especially the **7 ⚠ CHOICE flags** (§2). Confirm or adjust `holdoutStart`, `dailyFetchStart`, and the deferred nulls (`psychological.increments`, `todBucketEtCutoffs`).
2. **F3 — the 2025-10 auction-print gap.** Acknowledge the ~11-session market-wide gap (and scattered others). Policy for later sessions: 15:55 fallback close for EOD labels on auction-less sessions, disclosed in the footer. Confirm acceptable, or decide whether to source those closes elsewhere.
3. **SPHB/SPLV 5m (F4).** These are daily-grain beta-appetite inputs; their 5m is sparse. Decide whether the full-universe fetch should fetch 5m for SPHB/SPLV at all (recommend: **daily-only for SPHB/SPLV**, 5m only for SPY + the 11 sector ETFs per Addendum §A8).
4. **Supply the frozen universe file** (150–200 names, R2-eligible, incl. the two pre-2021 gap-prone replacements for HOOD/RKLB). Sweep it with `lib/depth-eligibility.js` before locking.
5. **Then greenlight** the full-universe fetch + Session 3 (level construction / lineage).

## 11. Scope boundary (what was deliberately NOT done)

No level construction, event detection, feature computation, or aggregation (Sessions 3+). No full-universe fetch (probe only). Data never committed. AFRM (an S1 gap-prone probe that passed A2) is **not** in the S2 14-symbol probe as enumerated in the prompt — noted; the gap-prone stratum is being re-formed in the universe freeze regardless.

---

## 12. HARD STOP

Tests green, deliverables committed. Awaiting founder review of the config (via the traceability table), the F3 auction-gap policy, the SPHB/SPLV 5m decision, and the frozen universe file. **Session 3 (level construction / lineage) does not begin until the founder greenlights.**

*Final report — 2026-07-11 — LevelStory Session 2. Config `STUDY_CONFIG_VERSION=1`; 50/50 tests green; probe = 14 symbols, ~134 MB fetched & normalized (gitignored); DST proven on EDT+EST; cross-grain 100%.*
