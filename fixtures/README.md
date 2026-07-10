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

---

## Capture manifest

> 🔴 **No fixtures captured yet — BLOCKED.** The environment's egress policy denies the EODHD host
> (`eodhd.com:443` → 403 at the proxy), so no live response could be obtained. Capture resumes the moment
> the founder allowlists EODHD and relaunches. See `docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md` §0/§12.

| File | Symbol | Grain | Range | Fetch date (UTC) | Request URL pattern (key redacted) | Truncation |
|---|---|---|---|---|---|---|
| _pending_ | | | | | | |

## Request URL patterns (templates, key redacted)

> _Populated during live fetch._

## Truncation notes

Per Session-1 spec §6: if a full-range 5-min response is too large to commit, this directory
holds a **representative sample month** PLUS the **first and last 3 sessions** of the full range,
and the omission is stated explicitly in the manifest above.
