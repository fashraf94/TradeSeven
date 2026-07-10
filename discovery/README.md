# LevelStory Session 1 — Discovery scripts (THROWAWAY, NON-PRODUCTION)

Everything in this directory is a **throwaway inspection tool** for the Session-1
data-discovery study. It exists only to fetch raw EODHD fixtures and characterize the
seven data assumptions (A1–A7) documented in
`docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md`.

**These are NOT pipeline code.** Per the Session-1 hard constraints:

- No production parser lives here. No `config.js` is authored here.
- Nothing here imports from — or is imported by — the TradeSeven product codebase.
- Scripts read the EODHD key from the `EODHD_API_KEY` environment variable only. They never
  hardcode, print, log, or persist the key. Every URL they emit for the record redacts it.
- After Session 1 is reviewed, this directory can be deleted with zero product impact.

## Scripts

> _Populated during live fetch (pending EODHD key availability)._
