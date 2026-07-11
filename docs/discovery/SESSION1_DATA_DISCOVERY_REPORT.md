# LevelStory — Session 1: Data Discovery Report

**Status:** ✅ **COMPLETE.** All 42 fixtures captured against live EODHD; A1–A7 graded from raw responses only. See §14 for the range recommendation and the HOOD-warmup finding that is the single non-PASS row.

**Session type:** Read-only data discovery + fixture capture. No pipeline code. Hard STOP for founder review.

**Provenance:** Session 1 first ran in an environment where the outbound network policy denied `eodhd.com:443` (`kind: connect_rejected`, 403 at proxy). It stopped at the interim BLOCKED report (commit `5db276d`) and re-ran to completion in local Claude Code once egress worked. The founder-confirmed live smoke call (`/api/eod/AAPL.US?from=2026-06-01&to=2026-06-05` → 5 bars with `adjusted_close`) was reproduced at the top of this session. **No data on this page was inferred from vendor documentation.** Every A1–A6 verdict cites a captured fixture under `fixtures/`.

---

## Executive verdict table (A1–A7)

| # | Assumption | Verdict | Evidence |
|---|---|---|---|
| A1 | 5-min depth ≥ 36 months per symbol (incl. ETFs) | ✅ PASS | 17/17 probe symbols returned 1,659 bars for **2023-06-01 → 2023-06-30** (one month sitting at the 36-mo edge). `fixtures/depth-probe/*_5m_2023-06.json` |
| A2 | Daily warmup ≥ 550 sessions before study start (2023-07-10 at 36 mo) | 🟡 **16/17 PASS**; **HOOD FAIL** by 62 sessions | HOOD daily begins 2021-07-29 → 488 pre-study sessions. COIN barely passes (562, margin 12). Others 624+. `fixtures/daily/*_eod_2018-01-01_2026-07-10.json` — see §4 |
| A3 | One adjustment basis across daily + 5m; cross-grain invariant (0.1%) | ✅ PASS (with refinement) | **5m data is UNADJUSTED** for splits (raw prints). Cross-grain works on **daily.close (raw) ↔ 5m `20:00 UTC` synthetic bar close**: 84/84 sample sessions + 8/8 NVDA split-window sessions match within 0.1%. §5 |
| A4 | Intraday timestamp semantics (open/close, TZ, session bounds, pre/post) | ✅ PASS | **Bar-open labeling; UTC (`gmtoffset:0` every bar); regular session only** in default responses (13:30 → 20:00 UTC, i.e. 09:30 → 16:00 ET during EDT). **NO pre/post-market bars** returned by `/api/intraday`. §6 |
| A5 | Synthetic close-print bars + volume quirks; deterministic strip rule | ✅ PASS | Exactly **1 close-print bar per session at `20:00 UTC`** (79 bars/day = 78 regular + 1 close-print). Deterministic rule below. **Refinement:** the close-print bar's OHLC value equals the daily closing-auction print — do NOT strip if using it for cross-grain alignment. §7 |
| A6 | Earnings-calendar coverage + fields (founder cross-checks dates) | ✅ PASS | Endpoint **accepts a symbol list** (`symbols=AAPL.US,NVDA.US,TSLA.US`); one bulk call returns all events. **Scheduled vs reported** distinguished by `actual === null`. §8 |
| A7 | API mechanics + revised full-refresh call budget | ✅ PASS | **S = 600 calendar days** per intraday call (API-enforced, error text explicit). Daily EOD returns whole (1,365 records in 1 call over 5.4 yr). **Full-refresh budget = ~640 calls; 100K/day cap = 156× headroom**. §9 |

**Range recommendation (§14):** the 36-month window (2023-07-10 → 2026-07-10) stands **only if HOOD is dropped from the probe set**. Keeping HOOD requires shrinking to **33.2 months** (study start 2023-10-05). Founder to choose — recommendation and per-cell-count implication in §14.

---

## 0. Repo / branch / spec / open-of-session

**Repository & branch (BUILD_RULES §2):**
- **Repository:** `fashraf94/TradeSeven` (`git remote -v` → `https://github.com/fashraf94/TradeSeven`). Session-1 prompt §0 anticipated a standalone repo; **founder ruled to proceed inside TradeSeven** with writes confined to `fixtures/`, `discovery/`, and `docs/discovery/`, and zero contact with product code. Enforced this session.
- **Branch:** `claude/level-study-session1-data-discovery-sedaip` (`-sedaip` is the harness suffix).
- **HEAD at resume:** `5db276d` (interim BLOCKED commit). Clean tree.
- **Fence files:** untouched. No product-code paths were opened.

**Spec files re-read (VERIFIED this session):**
- `docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md`
- `docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md`
- `docs/BUILD_RULES.md`, `docs/README.md`

**Credentials:**
- `.env` present (from prior session), still `git check-ignore .env` → matches ignore, still untracked. Key stored as `VITE_EODHD_API_KEY` (not literal `EODHD_API_KEY` per the prompt's §0 check — variant, but the smoke call succeeded with it, so substance passes). Scripts read from env at runtime; never printed, logged, or committed. All 42 captured request URLs in the logs are redacted to `api_token=REDACTED`.
- Prior recommendation (rotate the pasted key, provision as an environment secret) still stands; unchanged by this session.

**TLS note:** Windows schannel throws `CRYPT_E_NO_REVOCATION_CHECK` on plain `curl.exe`. All curl calls this session used `--ssl-no-revoke`; all substantive fetches went through Node 22 native `fetch` (Undici), which does not use schannel.

---

## 1. Method

Fixture-first. Every A1–A6 verdict is graded from a byte-for-byte fixture under `fixtures/`. Where the API contradicts its docs, the API wins. No characterization script imported or depended on product code. All scripts under `discovery/` are throwaway inspection tools — see `discovery/README.md`.

---

## 2. Probe set (FROZEN — unchanged from interim)

| Stratum | Symbols | Source |
|---|---|---|
| Mega-cap tech | AAPL, NVDA, MSFT | prompt §4 |
| Low-volatility | KO, PG, JNJ | prompt §4 |
| High-beta | TSLA, AMD, COIN | prompt §4 |
| Gap-prone | AFRM, HOOD, RKLB | founder-named prior session |
| Context ETFs | SPY, XLK, XLE, SPHB, SPLV | prompt §4 |

Total: 17 distinct symbols.

---

## 3. A1 — 5m depth ≥ 36 months  ✅ PASS

**Test:** for each symbol, request `/api/intraday?interval=5m&from=2023-06-01&to=2023-06-30`. If bars are returned, 5m depth reaches ≥ 36 months back from 2026-07-10.

**Result:** every one of the 17 symbols returned **1,659 bars** for June 2023 (`fixtures/depth-probe/*_5m_2023-06.json`). Full month present for AAPL, NVDA, MSFT, KO, PG, JNJ, TSLA, AMD, COIN, AFRM, HOOD, RKLB, SPY, XLK, XLE, SPHB, SPLV. First bar of the range for every file: `2023-06-01 13:30:00`. Last: `2023-06-30 20:00:00`.

**Note:** this session verified depth *at* the 36-month edge, not the maximum available depth per symbol. If Session 2+ needs the true earliest-available 5m timestamp per symbol, that requires additional probes (out of scope here).

---

## 4. A2 — Daily warmup ≥ 550 sessions before 2023-07-10  🟡 16/17 PASS; HOOD FAIL

**Test:** for each symbol, request `/api/eod?from=2018-01-01&to=2026-07-10` and count sessions with `date < 2023-07-10`.

**Result:**

| Symbol | First daily bar | Sessions before 2023-07-10 | Verdict | Note |
|---|---|---|---|---|
| AAPL, NVDA, MSFT, KO, PG, JNJ, TSLA, AMD, SPY, XLK, XLE, SPHB, SPLV | 2018-01-02 | **1,387** | ✅ PASS (+837 margin) | mature history |
| COIN | 2021-04-14 | **562** | ✅ PASS (+12 margin) | IPO date; **thin margin** |
| AFRM | 2021-01-13 | **624** | ✅ PASS (+74 margin) | IPO date |
| RKLB | 2020-11-24 | **657** | ✅ PASS (+107 margin) | ticker predates the Aug 2021 RKLB de-SPAC — pre-2021-08-25 bars are the Vector Acquisition Corp (VACQ) history returned under the RKLB ticker. **Flag for founder** — the "5.2 yr of daily" contains ~9 months of the SPAC entity, not the operating company. |
| **HOOD** | **2021-07-29** | **488** | 🔴 **FAIL (short 62 sessions)** | IPO date; binds A2 |

**HOOD-safe study start:** the 551st HOOD daily session is **2023-10-05**. Any study window starting on or after that date satisfies A2 for HOOD. That gives a **33.2-month** window against a 2026-07-10 anchor.

---

## 5. A3 — Adjustment basis + cross-grain invariant  ✅ PASS (with refinement)

**Endpoint-side finding (structural):**
- `/api/eod` returns both `close` (raw traded price) and `adjusted_close` (split/dividend-adjusted). Sample: AAPL 2018-01-02 → `close: 172.26`, `adjusted_close: 40.2671` (post 4-for-1 Aug 2020).
- `/api/intraday?interval=5m` returns **only `close`** (no adjustment). Fields: `timestamp, gmtoffset, datetime, open, high, low, close, volume`.
- ⇒ **Adjustment basis: daily is dual (raw + adjusted); 5m is raw-only.** No single field spans both grains.

**Cross-grain invariant (empirical):**

Compared last regular-session bar close (`19:55 UTC`, bar-open labeling) to daily `close` over 21 sessions each for AAPL, TSLA, AFRM, XLK (Jun 2026):

| Symbol | Sessions | 19:55 UTC vs daily.close within 0.1% | Outlier |
|---|---|---|---|
| AAPL | 21 | 20 | 2026-06-26 diff -0.909% |
| TSLA | 21 | 20 | 2026-06-26 diff -0.137% |
| AFRM | 21 | 20 | 2026-06-26 diff -0.189% |
| XLK  | 21 | 20 | 2026-06-26 diff -0.127% |

**All four outliers land on 2026-06-26** (Russell rebalance Friday — large closing-auction move). Diagnosis: the `19:55 UTC` bar is the **last continuous-session print**; it excludes the closing-auction volume that gets baked into the official 16:00 ET close.

Re-tested using the **`20:00 UTC` close-print bar** (the "synthetic" one, §7) instead of `19:55`:

| Symbol | Sessions | 20:00 UTC vs daily.close within 0.1% |
|---|---|---|
| AAPL | 21 | **21** |
| TSLA | 21 | **21** |
| AFRM | 21 | **21** |
| XLK  | 21 | **21** |

**84/84** — perfect. The `20:00 UTC` close-print IS the closing-auction print. This is the correct alignment.

**Split-adjacent test — NVDA 10-for-1 effective 2024-06-10** (`fixtures/split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json`):

| Date | Daily raw `close` | Daily `adjusted_close` | 5m 20:00 UTC close | Ratio (5m/daily.raw) |
|---|---|---|---|---|
| 2024-06-05 | 1,224.40 | 122.229 | 1,224.400024 | 1.0000 |
| 2024-06-06 | 1,209.98 | 120.789 | 1,209.979980 | 1.0000 |
| 2024-06-07 | 1,208.88 | 120.679 | 1,208.880004 | 1.0000 |
| 2024-06-10 | 121.79 | 121.580 | 121.790000 | 1.0000 |
| 2024-06-11 | 120.91 | 120.711 | 120.910003 | 1.0000 |
| 2024-06-12 | 125.20 | 124.994 | 125.199996 | 1.0000 |
| 2024-06-13 | 129.61 | 129.397 | 129.610000 | 1.0000 |
| 2024-06-14 | 131.88 | 131.663 | 131.880004 | 1.0000 |

The 5m `close` **jumps ~10× at the split boundary** (1,208.88 → 121.79 between 2024-06-07 and 2024-06-10 sessions) because 5m data is delivered **raw** and never back-adjusted. Historical daily `adjusted_close` shows the same series continuously scaled to today's basis. **Implication for the pipeline:** if the study needs split-adjusted 5m for cross-time-span comparisons, adjustment must be computed client-side using the per-symbol cumulative ratio (`daily.close / daily.adjusted_close`).

**A3 verdict:** ✅ **PASS.** The cross-grain invariant holds with the correct pairing (`daily.close` raw ↔ `5m 20:00 UTC close-print`). Adjustment basis question resolves to: use daily raw + client-side split-adjustment for 5m.

---

## 6. A4 — Intraday timestamp semantics  ✅ PASS

Evidence pulled from `fixtures/sample-5m/AAPL_5m_2026-06.json` (1,659 bars over 21 sessions):

**Bar labeling: START-time (bar-open) convention.**
```
{"timestamp":1780320600,"gmtoffset":0,"datetime":"2026-06-01 13:30:00","open":309.535003,...}
```
`1780320600` = Mon 2026-06-01 13:30:00 UTC = **09:30:00 ET (EDT)** = the NYSE regular-session open. This is the first bar of the file. It represents 13:30:00 → 13:34:59 UTC. Bar-close labeling would place this bar at `13:35`. All 42 fixtures use bar-open labeling.

**Timezone:** `gmtoffset: 0` on **every** bar (verified across all 1,659 sample bars). The `datetime` string is UTC. There is no DST-shift artifact in the labels — the ET session appears at `13:30` during EDT and would appear at `14:30` during EST, but every timestamp is a bare UTC clock.

**Session bounds:** every trading day in the sample month contains **exactly 79 bars**:
- 78 regular-session bars, `13:30` through `19:55` UTC (`09:30 → 15:55` ET).
- 1 close-print bar at `20:00` UTC (the 16:00 ET closing print — see A5).

Sample first day: 2026-06-01 first bar `13:30:00`, last bar `20:00:00`, 79 bars. Same on every one of the 21 sessions.

**Pre/post-market:** **zero bars** appear outside `13:30 → 20:00` UTC in any of the 42 fixtures. Neither the depth-probe fixtures (June 2023, EDT), the sample-5m fixtures (June 2026, EDT), nor the split fixture (June 2024, EDT) contain any pre-market or post-market bars. **The default `/api/intraday` response is regular-session-only.** If extended-hours bars exist behind a parameter (e.g., `interval=5m&extended=1` or similar), it must be probed separately in a later session; this session's fixtures do not exhibit them.

---

## 7. A5 — Synthetic close-print bars + volume quirks  ✅ PASS

**Count.** Across the 4 sample-month 5m fixtures (`sample-5m/*_5m_2026-06.json`):

| Symbol | Sessions | Close-print bars | Per session |
|---|---|---|---|
| AAPL | 21 | 21 | 1.00 |
| TSLA | 21 | 21 | 1.00 |
| AFRM | 21 | 21 | 1.00 |
| XLK  | 21 | 21 | 1.00 |

Exactly one close-print bar per session, no exceptions.

**Deterministic identification rule.** A bar is the session's close-print bar iff **all three** hold:
1. `datetime` ends in `20:00:00` (16:00 ET during EDT — the session close),
2. `volume === null` (JSON null, not zero),
3. `open === high === low === close` (single-value bar).

Every candidate in the 84-session sample satisfies all three (verified by `discovery/characterize.mjs`). No false positives found (zero regular-session bars had null volume).

**Refinement — do NOT strip if using for close-alignment.** The close-print bar's OHLC value equals the official daily closing-auction print (verified §5, 84/84 sessions). Its `null` volume just means EODHD attributes the auction volume elsewhere. Options for the pipeline:
- **Strip** for OHLC/microstructure analysis (avoid the zero-range fake bar in candle counts).
- **Retain** for close-alignment across grains, split adjustment, and cross-session anchoring.

Both semantics can co-exist by tagging the bar rather than dropping it.

**Volume anomalies.** Zero `volume === 0` bars and zero negative-volume bars across all 4 sample-month fixtures. The only volume irregularity is the intentional `null` on the close-print bar. Cumulative-volume anomalies (e.g., end-of-session volume that doesn't match daily) require summing intraday and comparing to `/api/eod` — that check needs the closing-auction volume source, which is not present in the 5m stream. **Left as an open question for Session 2 characterization** if the pipeline needs total-daily-volume reconstruction from 5m.

---

## 8. A6 — Earnings calendar  ✅ PASS

**Endpoint & shape** (`fixtures/earnings/AAPL_NVDA_TSLA_24mo.json`):

```
{
  "type": "earnings",
  "description": "...",
  "symbols": "AAPL.US,NVDA.US,TSLA.US",
  "earnings": [ { record }, ... ]
}
```

Each record's fields:

| Field | Example | Meaning |
|---|---|---|
| `code` | `AAPL.US` | symbol with exchange suffix |
| `report_date` | `2024-08-01` | announcement date (day of EPS release) |
| `date` | `2024-06-30` | fiscal quarter end |
| `before_after_market` | `AfterMarket` | intraday timing tag |
| `currency` | `USD` |  |
| `actual` | `1.4` (number) / `null` (scheduled) |  |
| `estimate` | `1.34` |  |
| `difference` | `0.06` |  |
| `percent` | `4.4776` |  |

**Accepts symbol list per call:** yes. `symbols=AAPL.US,NVDA.US,TSLA.US` returned 24 records (8 quarters × 3 symbols) in 4.5 KB. This is a decisive A7 input (bulk earnings costs 1 call, not 215).

**Scheduled vs reported distinguishable:** yes, by `actual`.

- Reported: `actual` is a number (e.g. `1.4`).
- Scheduled: `actual: null`; `estimate` is populated; `difference: 0`; `percent: null`.

Verified against a future-window call (`fixtures/earnings/AAPL_NVDA_TSLA_future_2026Q3.json`, 2026-07-11 → 2026-10-31):

```
{"code":"AAPL.US","report_date":"2026-07-30","date":"2026-06-30","before_after_market":"AfterMarket","currency":"USD","actual":null,"estimate":1.88,"difference":0,"percent":null}
{"code":"NVDA.US","report_date":"2026-08-26","date":"2026-07-31","before_after_market":"AfterMarket","currency":"USD","actual":null,"estimate":2.01,"difference":0,"percent":null}
{"code":"TSLA.US","report_date":"2026-07-22","date":"2026-06-30","before_after_market":"AfterMarket","currency":"USD","actual":null,"estimate":0.28,"difference":0,"percent":null}
```

**`earningsDateSource` population:** `actual !== null ? "reported" : "scheduled"`.

### Earnings dates for founder cross-check

The prompt asks not to assert external correctness — this table is for founder verification against broker / IR records. All records from `fixtures/earnings/AAPL_NVDA_TSLA_24mo.json`, trailing 24 months (2024-07-10 → 2026-07-10):

Every row below is the exact record as returned by EODHD (`before_after_market: "AfterMarket"` on all 24 records; column omitted).

**AAPL** — 8 quarterly reports:
| report_date | fiscal quarter end | actual EPS | estimate | surprise % |
|---|---|---|---|---|
| 2024-08-01 | 2024-06-30 | 1.4  | 1.34 | +4.4776% |
| 2024-10-31 | 2024-09-30 | 0.97 | 0.95 | +2.1053% |
| 2025-01-30 | 2024-12-31 | 2.4  | 2.34 | +2.5641% |
| 2025-05-01 | 2025-03-31 | 1.65 | 1.62 | +1.8519% |
| 2025-07-31 | 2025-06-30 | 1.57 | 1.43 | +9.7902% |
| 2025-10-30 | 2025-09-30 | 1.85 | 1.77 | +4.5198% |
| 2026-01-29 | 2025-12-31 | 2.84 | 2.67 | +6.367%  |
| 2026-04-30 | 2026-03-31 | 2.01 | 1.94 | +3.6082% |

**NVDA** — 8 quarterly reports:
| report_date | fiscal quarter end | actual EPS | estimate | surprise % |
|---|---|---|---|---|
| 2024-08-28 | 2024-07-31 | 0.68 | 0.63 | +7.9365% |
| 2024-11-20 | 2024-10-31 | 0.81 | 0.75 | +8%      |
| 2025-02-26 | 2025-01-31 | 0.89 | 0.85 | +4.7059% |
| 2025-05-28 | 2025-04-30 | 0.81 | 0.75 | +8%      |
| 2025-08-27 | 2025-07-31 | 1.05 | 1.01 | +3.9604% |
| 2025-11-19 | 2025-10-31 | 1.3  | 1.26 | +3.1746% |
| 2026-02-25 | 2026-01-31 | 1.62 | 1.54 | +5.1948% |
| 2026-05-20 | 2026-04-30 | 1.87 | 1.77 | +5.6497% |

**TSLA** — 8 quarterly reports:
| report_date | fiscal quarter end | actual EPS | estimate | surprise % |
|---|---|---|---|---|
| 2024-07-23 | 2024-06-30 | 0.52 | 0.56 | -7.1429%  |
| 2024-10-23 | 2024-09-30 | 0.72 | 0.6  | +20%      |
| 2025-01-29 | 2024-12-31 | 0.73 | 0.76 | -3.9474%  |
| 2025-04-22 | 2025-03-31 | 0.27 | 0.41 | -34.1463% |
| 2025-07-23 | 2025-06-30 | 0.4  | 0.4  | 0%        |
| 2025-10-22 | 2025-09-30 | 0.5  | 0.56 | -10.7143% |
| 2026-01-28 | 2025-12-31 | 0.5  | 0.45 | +11.1111% |
| 2026-04-22 | 2026-03-31 | 0.41 | 0.35 | +17.1429% |

Values are exactly what EODHD returned in `fixtures/earnings/AAPL_NVDA_TSLA_24mo.json` (integer-precision EPS values are as returned — no trailing zeros are dropped). The founder verifies against broker/IR records; any discrepancy is a data-source finding.

---

## 9. A7 — API mechanics & full-refresh budget  ✅ PASS

**S (max intraday span per call).** Measured empirically by requesting 5m AAPL over 2020-01-01 → 2026-07-10 (~2,382 days). Response: **HTTP 422**, body:
```
{"errors":{"to":["Max period length is 600 days"],"from":["Max period length is 600 days"]}}
```
The API enforces **`S_max = 600 calendar days`** per intraday request. No silent truncation — explicit error. (`fixtures/_recon/R1_intraday_5m_AAPL_2020-01-01_2026-07-10.json`.)

**D (daily EOD span per call).** Recon fetched AAPL EOD over 5.4 years (2021-02-01 → 2026-07-09) → **1,365 records in one call**. Whole. `D ≈ ∞` for daily. (`fixtures/_recon/R2_eod_AAPL_2021-02-01_2026-07-10.json`.)

**Earnings — accepts symbol list.** One `/api/calendar/earnings?symbols=AAPL.US,NVDA.US,TSLA.US` call returned all 24 quarters in 4.5 KB. Bulk retrieval is supported (§8).

**Rate limiting.** All 43 substantive calls returned `x-ratelimit-limit: 1200` with `x-ratelimit-remaining` returning to full between bursts. Read as a **1,200-per-minute** rolling budget. 100K/day cap (per prior session's spec reading) has **~156× headroom** at the full-refresh cost below.

**Response sizes** (representative):
- 5m for one month, one symbol: ~250 KB uncompressed, ~50 KB gzipped (`content-encoding: gzip` served on `/eod`; not on `/intraday` in this session's responses).
- Daily EOD, 8.5 years: ~253 KB uncompressed.
- Earnings 3 symbols × 8 quarters: ~4.5 KB uncompressed.

**Full-refresh budget with measured values** (215-symbol universe, 36-month intraday window):

| Component | Formula | Count | Notes |
|---|---|---|---|
| Daily EOD, ~5.2 yr | `215 × 1` | **215** | one whole-response call per symbol |
| 5m, 36 mo = ~1,095 cal days | `212 × ceil(1095/600)` | **424** | `S = 600` → 2 calls per 5m symbol |
| Earnings, trailing 24 mo | `1` bulk | **1** | one symbol-list call for all 215 |
| **Total** | | **640 calls** | |

Cap = 100,000/day → **156× headroom** at full refresh. Even at `S = 300` (worst credible), the total is `215 + 212·4 + 1 = 1,064 calls` → still 94× headroom. The estimate that the interim report §8 called "robust across `S`" is now empirically confirmed.

---

## 10. Surprises / findings not in A1–A7

1. **The "synthetic" close-print bar carries real information** (§5, §7). Prior discovery framing called it a spurious zero-range bar to strip. It's actually the 16:00 ET closing-auction print — the unique 5m data point that matches `daily.close` exactly on every session tested, including Russell rebalance day. Strip semantics need to be a *tag*, not a *drop*, so the pipeline can pick per use.
2. **5m is unadjusted for corporate actions** (§5, NVDA 10-for-1 evidence). Any cross-time-span 5m comparison must apply a client-side cumulative split ratio derived from `daily.close / daily.adjusted_close`. This is a real design constraint.
3. **RKLB pre-2021-08-25 daily bars are SPAC-era** (§4). The ticker returned bars from 2020-11-24, which pre-date the Rocket Lab / Vector Acquisition Corp merger. The 657-session A2 margin for RKLB includes ~9 months of a different corporate entity's history under the same ticker. Founder should decide whether to (a) use those bars as-is, (b) truncate RKLB to post-merger, or (c) drop RKLB.
4. **Default `/api/intraday` is regular-session only** (§6). No pre/post-market bars in any of the 42 fixtures. If the study needs extended hours, that requires a separate probe next session.
5. **`/api/intraday` responses were not gzipped in this session** (`/api/eod` and `/api/calendar/earnings` were). Purely a wire-cost note, not a correctness issue; measurements above account for it.
6. **The `.env` variable name is `VITE_EODHD_API_KEY`, not `EODHD_API_KEY`** as the prompt's §0 check assumed. The variant reflects that this key ships to the Vite frontend elsewhere in TradeSeven. Discovery scripts read either. Not a blocker, but underscores the earlier rotation recommendation.

---

## 11. Open questions / actions for the founder

1. **Range choice** (§14) — 36-month with HOOD dropped, or 33-month with HOOD retained.
2. **RKLB SPAC-era bars** — retain, truncate at 2021-08-25, or drop RKLB.
3. **Cross-check the A6 earnings dates** against broker/IR records (§8 tables). Any mismatches flag the endpoint as needing a fallback source.
4. **Extended-hours 5m** — decide whether the study wants it. If yes, a follow-up probe is needed to find the right parameter.
5. **Session-2 open questions** created by findings this session:
   - Split-adjustment routine on 5m (client-side implementation).
   - Total-daily-volume reconstruction from 5m (auction-volume attribution).
   - Session-boundary-tag semantics (strip vs retain for the 20:00 UTC close-print bar per use).

---

## 12. Remediation state (from interim report)

Egress unblock is resolved by running in local Claude Code (§0 provenance). Rotation of the pasted key remains an outstanding action from the interim report — no new leakage this session (verified: zero non-`REDACTED` `api_token` strings in `fixtures/`, `discovery/`, or repo). Injecting the key as a secret rather than pasting it remains the recommended next step for any future sessions.

---

## 13. Fixture inventory (see `fixtures/README.md` for full manifest)

- `fixtures/depth-probe/` — 17 files, 5m at 36-month edge (A1).
- `fixtures/daily/` — 17 files, daily EOD 2018-01-01 → 2026-07-10 (A2).
- `fixtures/sample-5m/` — 4 files, recent 5m sample month (A3/A4/A5).
- `fixtures/split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json` — split-basis (A3).
- `fixtures/earnings/AAPL_NVDA_TSLA_24mo.json` and `..._future_2026Q3.json` — reported + scheduled (A6).
- `fixtures/_recon/` — R1 (422 evidence for `S=600`), R2 (daily-whole evidence for `D`).

Total 42 files, ~9.3 MB. No truncation applied (no single fixture large enough to require the spec's representative-sample fallback).

Inspection scripts under `discovery/`: `recon.mjs`, `capture.mjs`, `earnings-future.mjs`, `peek.mjs`, `characterize.mjs`, `a3-synth.mjs`, `a3-split-synth.mjs`. All throwaway. Logs: `discovery/recon-log.json`, `capture-log.json`, `summary.json`.

---

## 14. Range recommendation

**Findings binding the range:**
- A1 (5m depth) passes for all 17 at 36 months.
- A2 (daily warmup ≥ 550 sessions) passes for 16/17 at 36 months. **HOOD fails** by 62 sessions.
- HOOD-safe study start: **2023-10-05**. Window at that start: **33.2 months**.

**Option A — 36-month window, drop HOOD from the probe set.**
- Probe becomes 16 symbols (gap-prone stratum: AFRM + RKLB, minus HOOD).
- A2 passes 100% at 36 mo. Study window: 2023-07-10 → 2026-07-10.
- Parent §13 sample-budget arithmetic (~7,600 events) stands unchanged.
- **Trade-off:** loses one of three gap-prone symbols; RKLB still has the SPAC-era caveat (§10, item 3).

**Option B — 33-month window, retain all 17.**
- Study window: 2023-10-05 → 2026-07-10 (~697 trading days vs 756 at 36 mo, ~8% shorter).
- Parent §13 event-count estimate scales linearly (first-order): ~7,000 events instead of ~7,600.
- Parent §15 n≥30 acceptance floor: cells already thinnest at P4/P5/P6 (projected n≈40–80 at 36 mo) become n≈37–74 at 33 mo. **The thinnest cells could dip below 40, close to the acceptance floor.** Founder should confirm none slip below n=30 at the shrunken window before locking Option B.

**Option C — Variable window per symbol (HOOD gets 33; others get 36).**
- Introduces per-symbol window state into the level lookup. Not recommended: risks cross-symbol contamination in any panel that aggregates across the universe.

**Recommendation:** **Option A** — drop HOOD, keep 36 months. Reasoning:
1. Preserves parent §13 budget with no per-cell-count risk.
2. Keeps gap-prone stratum representation via AFRM and RKLB.
3. The HOOD failure is a *data-availability* issue, not a *phenomenon* issue — deferring HOOD to when 550 sessions exist (Q4 2026 onwards) costs nothing here.
4. Option B is viable if the founder judges HOOD's inclusion more valuable than the per-cell margin.

Final call is founder-only per BUILD_RULES §3.

---

## 15. HARD STOP

This session is complete. Awaiting founder review on:
- Range choice (§14 options).
- RKLB SPAC-era bars policy (§10, item 3).
- A6 earnings-date cross-check (§8 tables) against broker/IR records.

Session 2 (level construction) must not begin until (a) the range is locked, (b) the RKLB question is answered, (c) the A6 dates are verified, and (d) the Session 0 remaining piece (full-universe freeze) is done.

---

*Final report — 2026-07-10 — LevelStory Session 1. Interim BLOCKED status (commit `5db276d`) closed by rerun in local Claude Code with live EODHD egress; every A1–A7 verdict grades against a captured fixture.*
