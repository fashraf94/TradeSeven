# LevelStory Session 1 — Fixtures

Raw, untouched EODHD API responses captured for the Session-1 data-discovery study
(`docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md`). These are the reference fixtures
every future parser is written against ("fixture-first parsing" — no parser before its
fixture exists).

**Integrity rule:** responses here are byte-for-byte what the API returned — never cleaned,
re-ordered, or pretty-printed beyond what the endpoint itself emitted. Any truncation applied
for repo size is recorded per-file below, with the untruncated shape described.

**Credential rule:** every request URL recorded here has the API key redacted to
`api_token=REDACTED`. The key is never printed, logged, or committed anywhere in this repo.

**Fetch date (UTC):** 2026-07-10.

---

## Capture manifest

### Recon (A7 — measure S, D, calendar shape)

| File | Purpose | Symbols | Range | Status | Records | Size |
|---|---|---|---|---|---|---|
| `_recon/R1_intraday_5m_AAPL_2020-01-01_2026-07-10.json` | Probe intraday max span | AAPL | 2020-01-01 → 2026-07-10 (6.5 yr) | 422 | error body — see A7 | 92 B |
| `_recon/R2_eod_AAPL_2021-02-01_2026-07-10.json` | Probe daily whole-response | AAPL | 2021-02-01 → 2026-07-09 | 200 | 1,365 | 165 KB |
| `earnings/AAPL_NVDA_TSLA_24mo.json` (moved from `_recon/`) | Probe earnings shape + accepts-list | AAPL,NVDA,TSLA | 2024-07-10 → 2026-07-10 | 200 | 24 | 4.5 KB |
| `earnings/AAPL_NVDA_TSLA_future_2026Q3.json` | Probe scheduled-vs-reported | AAPL,NVDA,TSLA | 2026-07-11 → 2026-10-31 | 200 | 3 | ~0.6 KB |

The R1 422 body is the finding: **`{"errors":{"to":["Max period length is 600 days"],"from":["Max period length is 600 days"]}}`** — the intraday endpoint enforces a **600 calendar-day per-request cap**. That is `S_max` and closes A7. See report §8.

### 5m depth probes (A1 — reach ≥ 36 months)

One 5m response per probe symbol for **2023-06-01 → 2023-06-30** (one month sitting at the 36-month edge from 2026-07-10). Every probe returned 1,659 bars — full month present.

| Directory | Count | Symbols | Range | Records/file |
|---|---|---|---|---|
| `depth-probe/` | 17 | AAPL,NVDA,MSFT,KO,PG,JNJ,TSLA,AMD,COIN,AFRM,HOOD,RKLB,SPY,XLK,XLE,SPHB,SPLV | 2023-06-01 → 2023-06-30 | 1,659 each |

### Daily EOD full history (A2 — warmup ≥ 550 sessions before 2023-07-10)

Deep daily history per probe symbol. Younger IPOs return only from their IPO date.

| Directory | Count | Symbols | Range | Records/file |
|---|---|---|---|---|
| `daily/` | 17 | (as above) | 2018-01-01 → 2026-07-10 | 2,140 mature / 1,241–1,410 for IPO-limited |

### 5m sample month (A3/A4/A5 characterization)

Recent full month of 5m data for 3 equity probes + 1 ETF.

| Directory | Count | Symbols | Range | Records/file |
|---|---|---|---|---|
| `sample-5m/` | 4 | AAPL, TSLA, AFRM, XLK | 2026-06-01 → 2026-06-30 | 1,659 each |

### Split-adjacent 5m (A3 — adjustment basis)

10-day 5m span around the NVDA 10-for-1 split effective **2024-06-10**.

| File | Symbol | Range | Records |
|---|---|---|---|
| `split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json` | NVDA | 2024-06-05 → 2024-06-14 | 632 |

---

## Request URL patterns (templates, key redacted)

```
GET https://eodhd.com/api/eod/{SYMBOL}.US?api_token=REDACTED&from={ISO}&to={ISO}&fmt=json
GET https://eodhd.com/api/intraday/{SYMBOL}.US?api_token=REDACTED&interval=5m&from={UNIX_EPOCH_SEC}&to={UNIX_EPOCH_SEC}&fmt=json
GET https://eodhd.com/api/calendar/earnings?api_token=REDACTED&symbols={SYM1.US,SYM2.US,...}&from={ISO}&to={ISO}&fmt=json
```

`SYMBOL` uses the `.US` exchange suffix (e.g. `AAPL.US`). Intraday `from`/`to` are Unix epoch seconds; EOD and earnings are ISO dates.

---

## Truncation notes

None. All 41 fixture files are byte-for-byte the API's response body. No full-range 5m request was made (each 5m request was ≤ 30 days), so the spec's "representative-month + first/last 3 sessions" fallback for oversized 5m responses did not activate.
