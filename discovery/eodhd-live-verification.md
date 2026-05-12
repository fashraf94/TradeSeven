# EODHD Intraday Endpoint — Live Verification

**Date:** 2026-05-12
**Branch:** `claude/eodhd-live-verification-2245` (cut from `main` @ `aa9e7a9`)
**Author:** Claude (read-only discovery)
**Status:** ⚠️ **BLOCKED — live curl could not be executed from this environment.** See "Failure mode" below. The report still captures what is known from the code path and from prior-commit documentation, plus a turnkey replay script the operator can run from any machine that has both the API key and outbound network.

---

## TL;DR

- Two independent blockers prevented the live curl from running here:
  1. `EODHD_API_KEY` is **not set** in this sandbox's process env, and no `.env` / `.env.local` is checked into the repo.
  2. The Anthropic sandbox egress proxy **denied** outbound TLS to `eodhd.com` with HTTP 403 + `x-deny-reason: host_not_allowed` (proven via `curl -sv` — connection completes TLS handshake against an `Anthropic` MITM cert, then the proxy returns the 403).
- I did **not** fabricate response data. The "Date range analysis" and "Field format confirmation" sections below are intentionally empty placeholders waiting on a real response capture.
- Everything we already knew about the response shape (from `parseEodhdDatetime` and from commit `330b5fa`'s May 6 commit message) is summarised in "Prior-evidence baseline" so the operator can compare against the live capture quickly.
- The referenced `discovery/vwap-production-failure-investigation.md` was **not found** anywhere in the repo (not on `main`, not on `claude/fix-intraday-null-production-co4TL`, not in any other branch). Either it lives on a branch that hasn't been pushed yet, or the path is different. Flagging in case it changes the brief.

---

## 1. Failure mode (why no live data here)

### 1a. No credential

```text
$ env | grep -i eodhd
(no output)

$ ls -la .env .env.local 2>/dev/null
(no such files)

$ grep EODHD .env.example
.env.example:11:#   EODHD_API_KEY    - Market data (stocks, crypto, news)
```

The .env.example documents the var name as `EODHD_API_KEY` (consistent with `api/_utils/marketDataCache.js:212`: `process.env.EODHD_API_KEY`). The actual secret lives in Vercel's Environment Variables, not in the repo.

### 1b. Sandbox egress blocked

Verbose curl against the real production URL:

```text
$ curl -sv "https://eodhd.com/api/intraday/AAPL.US?api_token=demo&interval=5m&fmt=json"
* Connected to eodhd.com (134.209.140.199) port 443
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
*  issuer: O=Anthropic; CN=sandbox-egress-production TLS Inspection CA
> GET /api/intraday/AAPL.US?api_token=demo&interval=5m&fmt=json HTTP/2
> Host: eodhd.com
< HTTP/2 403
< x-deny-reason: host_not_allowed
< content-length: 21
Host not in allowlist
```

Repeated for `https://eodhd.com/`, `https://api.eodhd.com/`, `https://eodhistoricaldata.com/` — all 403 with the same deny reason. EODHD is not on the sandbox's outbound allowlist. (Even the public `demo` token would have given us *something* if egress were open.)

**Implication:** This task cannot be completed end-to-end inside the agent sandbox. The operator (or a non-sandboxed agent run) must execute the curl from a host that has the token and unrestricted outbound HTTPS to `eodhd.com`.

---

## 2. Curl commands — exactly what to run

URL structure mirrors `fetchIntradayCandles` at `api/_utils/marketDataCache.js:639` (default-window form, no `from`/`to`). API base: `https://eodhd.com/api` (`marketDataCache.js:27`). Symbol formatting: dots become hyphens (`BRK.B` → `BRK-B`) and the `.US` suffix is appended for equities (`marketDataCache.js:86–104`); for AAPL/MU that is just `AAPL.US` and `MU.US`.

Run these from any machine with `EODHD_API_KEY` exported (the prompt history will redact `$EODHD_API_KEY` automatically; if you need to share output, double-check no token leaked into the body).

### A. AAPL.US — default window (the production code path)

```bash
curl -sw "\n---HTTP_STATUS=%{http_code}\n" \
  "https://eodhd.com/api/intraday/AAPL.US?api_token=$EODHD_API_TOKEN&interval=5m&fmt=json" \
  | tee /tmp/eodhd_aapl.json
```

> Note: the brief uses `EODHD_API_TOKEN` while the codebase uses `EODHD_API_KEY`. They refer to the same secret — export whichever matches your shell.

### B. MU.US — default window (cross-check on a second symbol seen in prod data)

```bash
curl -sw "\n---HTTP_STATUS=%{http_code}\n" \
  "https://eodhd.com/api/intraday/MU.US?api_token=$EODHD_API_TOKEN&interval=5m&fmt=json" \
  | tee /tmp/eodhd_mu.json
```

### C. AAPL.US — explicit 48-hour window (Option B from the failure investigation)

```bash
NOW=$(date +%s)
FROM=$((NOW - 48 * 3600))
curl -sw "\n---HTTP_STATUS=%{http_code}\n" \
  "https://eodhd.com/api/intraday/AAPL.US?api_token=$EODHD_API_TOKEN&interval=5m&fmt=json&from=$FROM&to=$NOW" \
  | tee /tmp/eodhd_aapl_window.json
```

This is the same `from=NOW-Xh&to=NOW` shape that commit `330b5fa` removed from the default code path. If the lag is still ≥1 trading day, this should return `[]` (or a much smaller array than A); if it returns the same data as A, the lag has cleared.

### Helper one-liners for the captured JSON

Once `/tmp/eodhd_aapl.json` exists, these summarise the response without scrolling:

```bash
# Total candle count
jq 'length' /tmp/eodhd_aapl.json

# Field names on the first candle (use this to verify shape)
jq '.[0] | keys' /tmp/eodhd_aapl.json

# First 3 and last 3 candles (newest-vs-oldest will become obvious)
jq '.[:3], .[-3:]' /tmp/eodhd_aapl.json

# Date range — min/max of datetime strings
jq '[.[].datetime] | (min, max)' /tmp/eodhd_aapl.json

# Are any candles dated today (2026-05-12, ET)?
jq '[.[] | select(.datetime | startswith("2026-05-12"))] | length' /tmp/eodhd_aapl.json
```

(Adjust `2026-05-12` to whatever today's ET date is when you actually run this.)

---

## 3. Raw response samples — AAPL.US

> _Empty until the operator pastes the live capture. Do not fill in from memory._

**HTTP status:** ⏳

**Total candles:** ⏳

**First 3 candles (raw JSON, untouched):**

```json
⏳
```

**Last 3 candles (raw JSON, untouched):**

```json
⏳
```

---

## 4. Raw response samples — MU.US

**HTTP status:** ⏳

**Total candles:** ⏳

**First 3 candles:**

```json
⏳
```

**Last 3 candles:**

```json
⏳
```

---

## 5. Date range analysis

| Symbol | Earliest `datetime` (UTC) | Latest `datetime` (UTC) | Latest ET date | Today's ET date | Trading-day lag |
|---|---|---|---|---|---|
| AAPL.US | ⏳ | ⏳ | ⏳ | 2026-05-12 | ⏳ |
| MU.US   | ⏳ | ⏳ | ⏳ | 2026-05-12 | ⏳ |

> "Trading-day lag" = number of NYSE trading days between `latest ET date` and today (skipping weekends and any NYSE holiday). `marketSchedule.js` already carries the holiday list; if the latest date is e.g. 2026-05-08 (Fri) and today is 2026-05-12 (Tue), the lag is **1 trading day** (Mon May 11 missed), not 4 calendar days.

**Today's ET date assumption:** 2026-05-12 (Tuesday). Confirm against `TZ=America/New_York date +%F` on the machine running the curl.

---

## 6. Field format confirmation

`parseEodhdDatetime` (`api/_utils/marketDataCache.js:754–763`) accepts exactly two formats:

1. `'YYYY-MM-DD HH:mm:ss'` — space-separated, no offset, treated as UTC via `Date.UTC(...)`
2. `'YYYY-MM-DDTHH:mm:ss(.sss)?Z'` — ISO 8601 with `Z`

Anything else returns `null` and silently drops the candle out of `filterToCurrentSession`. The fallback in `fetchIntradayCandles` (`marketDataCache.js:683`) already converts a missing `datetime` to ISO-with-Z via `new Date(d.timestamp * 1000).toISOString()`, so the second form is only seen post-mapping; raw EODHD responses normally use form 1.

| Field | Expected | Observed | Match? |
|---|---|---|---|
| `datetime` (string) | `'YYYY-MM-DD HH:mm:ss'` UTC | ⏳ | ⏳ |
| `timestamp` (number, Unix seconds) | Optional fallback when `datetime` missing | ⏳ | ⏳ |
| `gmtoffset` (number) | Documented by EODHD; not consumed by our code | ⏳ | ⏳ (informational only) |
| `open` / `high` / `low` / `close` | `Number.isFinite` (rejected if `null`) | ⏳ | ⏳ |
| `volume` | Optional (defaults to 0 when absent) | ⏳ | ⏳ |
| Any unexpected fields | — | ⏳ | ⏳ |

If `datetime` comes back in any other form (e.g. with a timezone offset like `-04:00`, or as a Unix epoch in `datetime` rather than a string), `parseEodhdDatetime` will return `null` and `filterToCurrentSession` will drop **every** candle — which is one of the candidate root causes for the production `intraday: null`. Confirming the exact format is the most load-bearing part of this verification.

---

## 7. Optional with-window curl comparison

| Variant | Expected behavior under "lag ≥ 1 trading day" hypothesis | Observed |
|---|---|---|
| Default (no `from`/`to`) | Returns recent candles up to lagged latest date | ⏳ |
| Explicit `from=NOW-48h&to=NOW` (Option B) | Returns `[]` because the queried window is entirely after the latest published candle | ⏳ |

If both return non-empty arrays of similar size, the lag has cleared and the original session-boundary fix (acdc3c6 + a4f1ea9) was the actual culprit, not the EODHD feed. If only the default returns data, the lag is still in effect and Fix v2 must keep the default-window code path.

---

## 8. Prior-evidence baseline (what we already knew, not from today's run)

From commit `330b5fa` (May 6 2026, "fix(market-data): default fetchIntradayCandles to EODHD's natural window"):

> "Manual curl verification confirmed: omitting from/to returns ~200 candles of recent intraday data (May 4-5)."

So as of May 6:
- Default-window curl returned **~200 candles**
- Latest data was **May 4–5** (i.e. queried May 6, lag was 1 trading day from May 5 → 1 day; or 2 calendar days from May 4)
- Explicit `from=NOW-8h&to=NOW` returned `[]` (the bug being fixed)

From `parseEodhdDatetime` (`marketDataCache.js:754–763`) and the function-level comment (`marketDataCache.js:743–752`):
- EODHD documented response shape uses space-separated `YYYY-MM-DD HH:mm:ss` interpreted as UTC
- A `timestamp` (Unix seconds) field exists and is used as a fallback inside `fetchIntradayCandles`

From `filterToCurrentSession` (`marketDataCache.js:808` onward):
- Filter compares each candle's ET-converted date string against today's ET date string (`toEtParts`)
- If no candle matches today's ET date, the function returns `[]` and `calculateVWAP` returns `null` — which is exactly the production symptom being investigated

So the failure chain we're trying to confirm-or-deny with the live curl is:

```
EODHD lag ≥ 1 trading day
  → all returned candles dated yesterday-or-earlier (ET)
  → filterToCurrentSession returns []
  → calculateVWAP returns null
  → cronState.intradayMomentum entry is null
  → portfolio brief renders intraday: null
```

---

## 9. Synthesis

> EODHD lag status as of **2026-05-12 (this verification could not be executed live in the agent sandbox; lag is undetermined from this run)**: **⏳ unknown — requires operator-side curl execution**. Latest available date: **⏳**. Response shape **cannot be confirmed against `parseEodhdDatetime` expectations** from this run because the live response was not obtained. Fix v2 design should be deferred until the operator runs section 2's curl commands and pastes the captures into sections 3–7; the strongest prior evidence (commit `330b5fa`'s May 6 manual curl) shows lag was 1 trading day a week ago and the default-window code path was the only one returning data, but a week is long enough that this needs re-verification before committing to either Option A or Option B.

---

## 10. What to do next

1. **Operator:** export `EODHD_API_KEY` (or `EODHD_API_TOKEN` — same secret) on a non-sandboxed shell and run the three curls in section 2.
2. Paste the raw JSON (first 3 + last 3 candles per symbol) into sections 3 and 4.
3. Re-run the `jq` summaries from section 2 to fill in sections 5, 6, and 7.
4. Re-write section 9's synthesis with concrete numbers.
5. Hand the completed file back for the Fix v2 design discussion.

Alternative path if egress to `eodhd.com` can be added to the sandbox allowlist *and* `EODHD_API_KEY` can be injected as a session secret: re-run this discovery task and the agent can complete sections 3–9 itself.
