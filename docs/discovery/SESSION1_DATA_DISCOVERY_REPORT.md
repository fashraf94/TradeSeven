# LevelStory — Session 1: Data Discovery Report

**Status:** 🔴 **BLOCKED — cannot complete.** Live EODHD verification is impossible in this environment:
the container's egress policy **denies the EODHD host** (`eodhd.com:443` → HTTP 403 at the proxy). The API
key is provisioned and every offline prerequisite is done, but no fixture can be captured and no A1–A7
assumption can be verified until the founder allowlists EODHD and relaunches. Details in §0 and §12.

**Session type:** Read-only data discovery + fixture capture. No pipeline code. Hard STOP for founder review.

---

## Executive verdict table (A1–A7)

> _Read this first (BUILD_RULES §8). Every row is_ **BLOCKED** _— not "fail." The assumptions are untested
> because the network path to EODHD is closed, not because the data is bad. Verdicts require live fixtures,
> which require egress access (§12)._

| # | Assumption | Verdict | Why |
|---|---|---|---|
| A1 | 5-min depth ≥ 36 months per symbol (incl. ETFs) | 🔴 BLOCKED | No network path to EODHD; 0 fixtures. |
| A2 | Daily warmup ≥ 550 sessions before study start | 🔴 BLOCKED | Same. |
| A3 | One adjustment basis across daily + 5m; cross-grain invariant (0.1%) | 🔴 BLOCKED | Same. |
| A4 | Intraday timestamp semantics (open/close, TZ, session bounds, pre/post) | 🔴 BLOCKED | Same. |
| A5 | Synthetic close-print bars + volume quirks; deterministic strip rule | 🔴 BLOCKED | Same. |
| A6 | Earnings-calendar coverage + fields (founder cross-checks dates) | 🔴 BLOCKED | Same. |
| A7 | API mechanics + revised full-refresh call budget | 🟡 PARTIAL (framework only) | Budget arithmetic laid out (§8); the one measured input (max 5m span per call) is unobtainable — no live call succeeds. |

**Range recommendation:** 🔴 **UNVERIFIED — decision deferred.** The 36-month window cannot be confirmed or
shrunk without the A1/A2 depth fixtures. See §9.

---

## 0. Repo / branch confirmation, spec files read, and the blocking chain

**Repository & branch (BUILD_RULES §2 open-of-session report):**
- **Repository:** `fashraf94/TradeSeven` (`git remote -v` → `https://github.com/fashraf94/TradeSeven`).
  The Session-1 prompt §0 anticipated a *standalone* LevelStory research repo and instructed a STOP if run
  inside TradeSeven. I stopped and asked; **the founder ruled to proceed inside TradeSeven**, with all new
  writes confined to `fixtures/`, `discovery/`, and `docs/discovery/`, and zero contact with product code.
- **Branch:** `claude/level-study-session1-data-discovery-sedaip` (the designated branch; `-sedaip` is a
  harness-added suffix on the prompt's `claude/level-study-session1-data-discovery`).
- **HEAD at session start:** `caf74a66fdc50ea34bc3eda7cbc1ae2f72c059cb` — clean working tree.

**Spec files found and read in full (VERIFIED this session):**
- `docs/LEVEL_INTERACTION_EVENT_STUDY_SPEC_V1_1.md` — parent spec V1.1.
- `docs/LEVEL_STUDY_SPEC_V1_1_ADDENDUM_A_CONTEXT_LAYER_V1_1.md` — Addendum A **v1.1**.
- **Addendum v1.0 cleanup check:** no stale v1.0 copy exists in the repo — only v1.1 is present. Nothing to flag.
- Also read (binding per repo `CLAUDE.md`): `docs/BUILD_RULES.md`, `docs/README.md`.

**Two blockers, in the order they surfaced:**

1. **Key not in the environment (resolved).** The spec said the EODHD key "lives in the local environment."
   It did not: `EODHD_API_KEY` was unset, no market-data key existed under any alternate name, and no `.env`
   file was present. The founder supplied the key; it is now stored in a gitignored, `chmod 600` `.env`
   (verified untracked via `git check-ignore`). **The key is never printed, logged, or committed.**
   ⚠️ _Security note: the key was pasted into the chat transcript, so it now lives in that (private but
   recorded) transcript. **Recommend rotating this EODHD key** once it can be injected as an environment
   secret instead (§11)._

2. **EODHD host blocked by egress policy (NOT resolved — the hard blocker).** The environment's outbound
   network policy does not permit the EODHD host. Evidence, from the agent proxy's own status endpoint:

   ```json
   { "ts": "2026-07-10T15:02:07.711Z",
     "kind": "connect_rejected",
     "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
     "host": "eodhd.com:443" }
   ```

   A test `GET https://eodhd.com/api/eod/AAPL.US?...` returned `curl (56) CONNECT tunnel failed, response 403`.
   Per the proxy README, a 403 CONNECT means "the destination host is not allowed by your organization's
   egress policy for this session. Do not retry or route around it — report the blocked host." I did not retry,
   did not probe alternate EODHD domains, and did not touch the proxy/TLS config. **This is an environment
   configuration gap, not a data finding — but it is the finding that stops Session 1.**

---

## 1. Method note (unchanged intent)

Fixture-first: no assumption is graded from vendor documentation — only from raw responses captured under
`fixtures/`. "Plan-said ≠ code-did applies to vendors too." Because zero live responses exist, **no A1–A6
verdict is issued** rather than issuing a doc-based guess. A7 is a *framework* only, clearly marked ASSUMED.

---

## 2. Probe set — FROZEN for Session 1

12-symbol stratified probe (parent §4.2) + 5 context symbols (Addendum §A2.3/§A3):

| Stratum | Symbols | Source |
|---|---|---|
| Mega-cap tech | AAPL, NVDA, MSFT | prompt §4 (fixed) |
| Low-volatility | KO, PG, JNJ | prompt §4 (fixed) |
| High-beta | TSLA, AMD, COIN | prompt §4 (fixed) |
| **Gap-prone** | **AFRM, HOOD, RKLB** | **founder-named this session** (from DKB universe; distinct from the high-beta trio) |
| Context ETFs | SPY, XLK, XLE, SPHB, SPLV | prompt §4 (direction-tag + appetite features) |

Total distinct symbols to fetch this session: 17.

---

## 3.–7. A1–A6 findings
🔴 **BLOCKED — no fixtures.** Each of A1 (5m depth), A2 (daily warmup depth), A3 (adjustment basis +
cross-grain invariant), A4 (timestamp semantics), A5 (synthetic bars / volume quirks), and A6 (earnings
calendar) requires at least one successful EODHD response to grade. None could be obtained. The fetch +
characterization plan for each is pre-staged and will run unchanged the moment egress is opened (§13).

---

## 8. A7 — API mechanics & budget (framework only; empirical inputs BLOCKED)

The empirical half of A7 — max date range per intraday call, pagination mechanism, observed rate limiting,
response sizes — **cannot be measured** without a live call and is therefore BLOCKED. What can be stated now
is the **budget arithmetic**, parameterized on the single unknown that a 5-minute recon call would resolve:
`S` = the maximum number of trading days of 5m data returned per intraday request.

**Full-refresh scope (from parent §4.2/§4.5 + Addendum §A8), 215 symbols:**

| Component | Symbols | Range | Calls per symbol | Notes |
|---|---|---|---|---|
| Daily (warmup + study) | 215 | ~5.2 yr (~1,310 sessions) | `ceil(1310 / D)` | `D` = max daily-EOD span per call. If EOD returns the full multi-year range whole (spec's assumption), `D`≈∞ → **1 call/sym**. **Must verify.** |
| 5-minute | ~215 minus non-5m context — i.e. ~200 equities **+ SPY + 11 sector ETFs** ≈ 212 | 36 mo (~756 sessions) | `ceil(756 / S)` | `S` is the key unknown. Vendor *docs* claim ~600 days/5m call (⇒ 2 calls/sym) but §A7 forbids trusting docs; if `S`≈120 ⇒ 7 calls/sym. **Must measure.** |
| Earnings calendar | 3 (A6 probe) → full universe at refresh | trailing 24 mo | `1` bulk **or** `1/sym` | Depends whether the endpoint accepts a symbol list per call (an A6/A7 finding). |

**Total calls for one full refresh (parameterized):**
`≈ 215·ceil(1310/D)  +  212·ceil(756/S)  +  E`
- If daily is whole (`D`→1 call) and `S`≈600: `≈ 215 + 424 + E ≈ 640 + E`.
- If daily is whole and `S`≈120: `≈ 215 + 1484 + E ≈ 1,700 + E`.

Both land **inside** the spec's stated envelope of **1,500–2,500 (+250 warmup)** — the warmup is already folded
into the "~5.2 yr daily" line here rather than added separately. The estimate is **robust to `S` across its
plausible range** and stays far under EODHD's 100K/day cap either way. The one thing that would break it is
`S` being much smaller than 120 or the daily EOD endpoint *also* being span-limited — exactly the two facts a
single recon session resolves. **Verdict: PARTIAL** — arithmetic sound, empirical inputs pending egress.

---

## 9. Range recommendation — DEFERRED

The 36-month window's survival depends on **A1 (5m depth)** and **A2 (550-session daily warmup)**, both BLOCKED.
The parent §4.2 "BZ.COMM lesson" is explicit: *confirm actual 5-min history depth per symbol via live fixtures
before locking the range; never assume vendor depth.* Issuing a range verdict now would violate that rule.

- **If** the eventual fixtures confirm ≥ 36 months of 5m depth across all strata → the 36-month window stands
  and §13's ~7,600-event budget holds.
- **If** depth is shallower for part of the universe → the range shrinks to the verified floor, §13's arithmetic
  is restated at that floor, and the rarest primary cells (e.g. resistance `BREAK_RECLAIM` at F2+, projected
  n≈40–80 at 36 mo) are re-checked against the n≥30 acceptance floor (§15). A material shrink would endanger
  P4/P5/P6, whose cells are already the thinnest.

No number is asserted until the depth fixtures exist.

---

## 10. Surprises not covered by A1–A7

1. **The environment was not network-provisioned for the one host the session needs.** The spec's premise
   ("network calls this session go to EODHD only") assumed EODHD was reachable; the egress policy blocks it.
   Session 1 cannot run in this environment as configured.
2. **The key was not in the environment either.** The spec assumed it "lives in the local environment"; it was
   absent under every name, with no `.env`. Both the credential *and* the network path were missing — two
   independent provisioning gaps.
3. **Repo mismatch vs. the prompt's premise.** The prompt was written for a standalone research repo; the
   session runs inside TradeSeven (founder-ratified). Recorded so the isolation constraints (§2/§8) are auditable.

---

## 11. Open questions / actions for the founder

1. **Allowlist EODHD egress (the unblock).** Add the EODHD API host(s) to this environment's outbound network
   policy, then relaunch/re-poke the session. EODHD serves its REST API from `eodhd.com` (and historically the
   legacy `eodhistoricaldata.com`); allowlisting `eodhd.com` is sufficient for the `/api/eod`, `/api/intraday`,
   and `/api/calendar/earnings` endpoints this study uses. See §12 for the exact remediation.
2. **Prefer an injected env secret over the pasted key, and rotate.** Provide `EODHD_API_KEY` via the
   environment's secret configuration so it never appears in a transcript; rotate the pasted key afterward.
3. **Confirm the full-universe freeze (Session 0).** The 150–200 → 215 universe freezes at Session 0; the
   12-symbol probe here is the stratified stand-in. If depth varies across the probe once fixtures exist, a
   full-universe depth sweep after freeze becomes a required follow-up (recommended pre-emptively).

---

## 12. Remediation to unblock (precise)

**Root cause:** `eodhd.com:443` returns 403 at the egress proxy → the host is not on this environment's
allowlist. This is an environment/network-policy setting, not something a session can change from inside
(and the proxy README forbids routing around it).

**Fix (founder / workspace admin):**
1. In the environment's network configuration (Claude Code on the web → environment settings; network policy
   docs: `code.claude.com/docs/en/claude-code-on-the-web`), move from a policy that blocks `eodhd.com` to one
   that allows it — either a broader/trusted network policy or an explicit allowlist entry for `eodhd.com`
   (and `eodhistoricaldata.com` if the legacy host is ever used).
2. Add `EODHD_API_KEY` as an environment secret (so it's injected, not pasted).
3. Relaunch or re-poke this session on the same branch.

**Self-check I will run first on resume:** `curl -sS "$HTTPS_PROXY/__agentproxy/status"` (expect no fresh
`connect_rejected` for `eodhd.com`) then a 1-symbol `/api/eod` smoke call. Only on success do fixtures begin.

---

## 13. Resume plan (pre-staged; runs unchanged once egress opens)

1. **Recon (A7 empirical):** one `/api/intraday?interval=5m` call for AAPL over a multi-year `from`→`to` to
   measure `S` (whole / truncated / paginated), response size, and any rate-limit headers; one `/api/eod`
   over ~5.2 yr to confirm daily returns whole; one `/api/calendar/earnings` to learn its shape.
2. **Fixture capture (§6):** 3 equity probes × {daily incl. warmup, 5m sample month} + 1 ETF × 5m month +
   earnings for AAPL/NVDA/TSLA; raw, untouched; `fixtures/README.md` manifest with **key-redacted** URLs and
   any truncation noted (representative month + first/last 3 sessions if a full 5m range is too large to commit).
3. **Characterize A1–A6** against the captured fixtures (depths, adjustment fields + cross-grain invariant over
   ≥20 sessions/symbol, timestamp semantics around a known open/close, synthetic-bar count + strip rule,
   earnings-date table for founder cross-check).
4. **Grade** the executive table, issue the **range recommendation**, restate §13 budget at the verified floor
   if it shrinks, then **HARD STOP** for founder review.

---

*Interim report — July 10, 2026 — LevelStory Session 1. BLOCKED on environment egress to EODHD; no data
fabricated, no assumption graded from documentation. Resume is a single relaunch away once the host is allowlisted.*
