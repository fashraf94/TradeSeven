# LevelStory Session 1 — Discovery scripts (THROWAWAY, NON-PRODUCTION)

Everything in this directory is a **throwaway inspection tool** for the Session-1
data-discovery study. It exists only to fetch raw EODHD fixtures and characterize the
seven data assumptions (A1–A7) documented in
`docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md`.

**These are NOT pipeline code.** Per the Session-1 hard constraints:

- No production parser lives here. No `config.js` is authored here.
- Nothing here imports from — or is imported by — the TradeSeven product codebase.
- Scripts read the EODHD key from the local `.env` (via a small inline parser, no `dotenv`
  dependency). They accept either `VITE_EODHD_API_KEY` (the name actually present in
  this repo's `.env`) or `EODHD_API_KEY`. They never hardcode, print, log, or persist the key.
  Every URL emitted for the record redacts it to `api_token=REDACTED`.
- After Session 1 is reviewed, this directory can be deleted with zero product impact.

## Scripts

| Script | Purpose | Reads | Writes |
|---|---|---|---|
| `recon.mjs` | 3-call §13 recon (A7 empirical): intraday max span, daily whole-response, earnings shape | `.env` | `fixtures/_recon/R{1,2,3}_*.json`, `recon-log.json` |
| `capture.mjs` | 39-call fixture capture: depth probes, daily EOD, sample 5m month, split-adjacent NVDA | `.env` | `fixtures/{depth-probe,daily,sample-5m,split-adjacent}/*.json`, `capture-log.json` |
| `earnings-future.mjs` | Probe forward-window earnings for scheduled-vs-reported | `.env` | `fixtures/earnings/AAPL_NVDA_TSLA_future_2026Q3.json` |
| `peek.mjs <path>` | Print top-level shape + first/last 3 records of any fixture | fixture path | stdout only |
| `characterize.mjs` | Grade A1–A6 against captured fixtures, emit `summary.json` | `fixtures/**` | `summary.json` |
| `a3-synth.mjs` | Re-run A3 cross-grain using 20:00 UTC synthetic bar instead of 19:55 (finds the closing-auction match) | `fixtures/{sample-5m,daily}/**` | stdout only |
| `a3-split-synth.mjs` | Show NVDA 10-for-1 split: daily raw + adjusted vs 5m 20:00 close | `fixtures/{split-adjacent,daily}/NVDA*` | stdout only |

## Logs (also throwaway)

- `recon-log.json` — 3 recon calls, per-call status/headers/bytes/counts (URLs redacted).
- `capture-log.json` — 39 capture calls, same shape.
- `summary.json` — A1–A6 characterization emitted by `characterize.mjs`; source of the report tables.

## Running

```
node discovery/recon.mjs           # 3 calls, ~2 seconds
node discovery/capture.mjs         # 39 calls in parallel, ~10 seconds
node discovery/earnings-future.mjs # 1 call
node discovery/characterize.mjs    # zero calls; reads fixtures/, emits summary.json
node discovery/a3-synth.mjs        # zero calls
node discovery/a3-split-synth.mjs  # zero calls
```

Order matters only for the first three (they populate `fixtures/`); the remaining scripts are pure fixture-inspection.
