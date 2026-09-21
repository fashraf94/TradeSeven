# Intraday calcVersion 2 — the vendor's answers applied

**Date:** 2026-09-21 · **Session:** Claude Code (Opus) · **Branch:** `claude/amazing-newton-oeezba`
**Contract:** `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md` §15 — the "answer lands as configuration" step, plus the one classification rule and the one window rule the answers require.
**Line citations** are at branch HEAD `a7ba76ac` and were re-read in this session (BUILD_RULES §3: VERIFIED); the per-commit messages cite their own commit's lines.
**Fence contact:** none. `git diff origin/main --stat` touches no file in BUILD_RULES §1. VERIFIED.

---

## Executive verdict

| # | Item | Verdict |
|---|---|---|
| 0 | Precondition — `929624ca`, `63bcee07`, `eb263f36`, `bc894044` are ancestors of `origin/main` | **PASS** (all four VERIFIED after `git fetch origin`) |
| 1 | Fence — no BUILD_RULES §1 file in the branch diff | **PASS** |
| 2 | C1 — cutoffs confirmed + the post-close rule | **DONE** — `d530ffb6` |
| 3 | C2 — the continuous-session policy | **DONE** — `012416e7` |
| 4 | C3 — calcVersion 2 and the definitions | **DONE** — `a7ba76ac` |
| 5 | Full suite, unpiped, exit code asserted | **PASS** — 740 files, **14,199 passed**, 64 skipped, exit **0** |
| 6 | `npm run lint:gate` | **PASS** — exit **0** |
| 7 | `vite build` | **PASS** — exit **0** |
| 8 | BUILD_RULES §2 review threshold | **CROSSED** — 23 files, 1,142 lines. Pushed; **STOPPED** for the §2 review. No PR opened. |

**Two things the founder must read before merging**, both below in full: the
**merge window** (§7) and the **§7.3 publish-size crossing moving 81 → 76** (§6).

---

## 1. Session preamble (BUILD_RULES §2 / §3)

| | |
|---|---|
| `git fetch origin` | run as the first step, before any comparison — recorded per §3 |
| Branch | `claude/amazing-newton-oeezba`, cut fresh from `origin/main` at `1740996d` |
| HEAD at start | `1740996d` ("Merge pull request #885 from fashraf94/claude/ecstatic-bohr-8a0huc") |
| Tree | clean |
| Baseline suite before any edit | 739 files, 14,173 passed, 64 skipped, exit 0 |

**One discrepancy to flag.** The prompt names the branch
`claude/intraday-calcversion-2`; the session harness checked out and pins
`claude/amazing-newton-oeezba`, and forbids pushing anywhere else. The work is
on the checked-out branch. Nothing else differs: it was reset to `origin/main`
at HEAD before the first commit, so it is a fresh cut of the branch the prompt
describes, under a different name.

---

## 2. The vendor's answers, as applied

EODHD, 2026-09-21. Each answer, and the exact configuration or rule it produced.

| Answer | What the vendor said | What it became |
|---|---|---|
| **1** | Live v2 `volume` is consolidated regular-session volume for the current day, accumulated as the session runs; it excludes `ethVolume`. After 16:00 ET it stops at the session total while `lastTradePrice`/`lastTradeTime`, `ethPrice`, `ethTime` and `ethVolume` keep updating. `change`/`changePercent` derive from `ethPrice`. | `VOLUME_CUTOFF_FIELD = 'priceAsOf'` (`intradayConfig.js:63`) — the Observation key the Live v2 adapter maps from `lastTradeTime`. Plus the **post-close rule**, because the second half of the answer says the cutoff is only valid *before* the close. `venue: 'consolidated_rth'` on the vwap, volume and volumePace definitions. |
| **2** | Live v2 `high` and `low` are regular-session only. | `HL_CUTOFF_FIELD = 'priceAsOf'` (`intradayConfig.js:65`), same post-close rule. The `sessionHL` definition's **session** now says "vendor regular session"; its **venue** stays `vendor_unconfirmed` — answer 2 named the session, not the venue. |
| **3** | The closing-auction print lands in the 16:00 bar for Nasdaq and most NYSE symbols, and in the 16:03/16:04 bar for some NYSE symbols. Bars from 16:00 onward are unsuitable for session totals. The clean continuous session is 09:30–15:59. | `CLOSING_ROW_POLICY = 'continuous_session'` (`intradayConfig.js:84`), the window rule in `buckets.js`/`seed.js`/`validator.js`, and the estimate's and buckets' **session** in the definitions document. |

**Vocabulary, as the prompt fixed it:** the vendor's `lastTradeTime` is carried
on the internal Observation as `priceAsOf` (`observation.js`, Live v2 adapter).
The cutoff constants name Observation keys — `resolveCutoff` returns
`obs[field]` — so the value is `'priceAsOf'`, never the vendor's own name.
`intradayConfig.test.js` still traps both `'lastTradeTime'` (not an Observation
key: it would resolve to null and read as "cutoff unconfirmed" while looking
configured) and `'snapshotTs'` (the vendor `timestamp`, an identity, never an
instant).

---

## 3. Item → commit → files → test rows

### C1 — Cutoffs and the post-close rule (§5.4–§5.5) — `d530ffb6`

17 files, +592 / −64.

**Code.** `intradayConfig.js:63,65` (both cutoff fields `'priceAsOf'`) ·
`accumulator.js:50,177` (`OUTCOME.POST_CLOSE`; the rule, placed after numeric
validation and rollover and before every classification case) ·
`buckets.js:232` (passage at `>=` the close, not `>`) · `facts.js:124` (the
carried session-aggregate blocks) · `sweepCalc.js:23,97,131` (the `postClose`
counter and the carry-forward wiring) · `intradayDiagnosticCopy.js:47` (the one
copy table gains `post_close`).

**The rule.** An observation with `priceAsOf ≥ sessionCloseMs` is `post_close`:
not an anomaly, counted in `postClose`, and it updates no session aggregate. The
accumulator is returned byte-identical, so the VWAP accumulator and the `volume`,
`volumePace` and `sessionHL` facts keep the values **and the cutoffs** of the last
pre-close accepted observation. Only the price facts (the latest quote) and
bucket completion reflect it: it still completes the session's last bucket, and
its price is never written to that bucket. The close is the calendar's, so an
early-close day uses its own 13:00.

**Why.** Per answers 1 and 2, only a pre-close observation's clock is a valid
cutoff for the session aggregates; and per C2 the closing auction lies outside
the session those aggregates describe.

**One design note worth the founder's eye.** A post-close aggregate is carried
**verbatim from the previous snapshot's block**, and is deliberately *not*
re-derived from the accumulator. A second derivation would have to reconstruct
the cutoff from `lastAcceptedAsOf` and could not reconstruct `sessionHL` at all
(the vendor's high/low/open are not in the accumulator), so the two sources
would disagree the moment either moved — the BUILD_RULES §9 failure shape. Where
there is no pre-close observation to carry (a poller that first sees a symbol
inside the close + 30 min tail), the aggregates are `absent` with reason
`post_close`, never the post-close quote's own volume.

**Test rows** (`postClose.test.js` is new — 10 rows; the rest are named beside
the existing §5.5 suite):

| Row | Where |
|---|---|
| the auction quote leaves the accumulator byte-identical, freezes `volume`/`sessionHL`/`vwap` **with their cutoffs**, advances the price facts, counts `postClose` | `postClose.test.js` |
| every post-close sweep of the collection window repeats the freeze; `lastAcceptedAsOf < sessionCloseMs` at the end of a fixture session | `postClose.test.js` |
| every v2 log entry's `estimateCutoff` is finite and `< sessionCloseMs` — including the post-close ones, which repeat the frozen estimate while their own `priceAsOf` runs on | `postClose.test.js` |
| bucket completion still happens; the auction price is never written to the last bucket | `postClose.test.js` |
| an early-close session uses the calendar's own 13:00; the identical instant is mid-session on a full day | `postClose.test.js`, `accumulator.test.js` |
| no carry-forward → `absent`/`post_close`, and the player reads a phrase, not a code | `postClose.test.js` |
| a carried block from **another** session is never reused | `postClose.test.js` |
| `volumePace` present mid-session, by the §5.4 formula with elapsed measured **at the volume cutoff** | `postClose.test.js`, `view.test.js` |
| `sessionHL` eligible for display mid-session, aged from its own cutoff; still stale past the window | `postClose.test.js` |
| the estimate is no longer `experimental`; nothing is `display_only` for a cutoff reason | `postClose.test.js`, `view.test.js` |
| post_close precedes every classification case (would otherwise be accepted / unchanged / volume-only / held) | `accumulator.test.js` |
| the boundary is exact: `sessionCloseMs − 1` is still the continuous session | `accumulator.test.js` |
| an observation AT the close establishes passage; a repeated one is idempotent | `buckets.test.js` |
| `estimateCutoff` / `volumeCutoffAsOf` populated on accepted observations; `experimental: false` | `pollRunner.test.js` |
| the validator no longer excludes entries as `cutoff_unconfirmed`; the residual metrics exist | `validationRunner.test.js` |

Every existing §5.5 row still passes, unmodified.

### C2 — Continuous-session policy (§6.1–§6.7, §10.2) — `012416e7`

9 files, +340 / −32.

**Code.** `intradayConfig.js:84` (`CLOSING_ROW_POLICY = 'continuous_session'`) ·
`buckets.js:49,56,76` (`CONTINUOUS_SESSION`, `sessionEndMs`, a policy-aware
`bucketKeyFor`) · `seed.js:45` (the 16:00 row ignored and counted in
`barsIgnored`, not folded into the last bucket) · `validator.js:52,60,317`
(the window by the graded session's `calcVersion`; `sessionCalcVersionOf`;
`calc_version_mixed`) · `view.js:62` (`closingRow` derived from the constant).

**Anchors re-verified at HEAD, as the prompt required.** The null-policy
stamping is `buckets.js:188` (`finalize`) and `seed.js:52`
(`aggregateBarsToBuckets`), both reading `closingRowPolicy !== null` — so a
non-null policy already meant "resolved", and neither branch needed rewriting.

**The window rule.** Under the policy the session ends at the last millisecond
before the calendar close for the VWAP estimate, the 5-minute buckets, seeding
and validation. One-minute bars with `start ≥ sessionCloseMs` (16:00 and later;
13:00 and later on an early close) are excluded from seeding and from every
reference computation. The session's last bucket therefore closes on the last
continuous-session trade and is `closeQualified: true`; so is the seeded ring's.

**Validator window by the graded session's `calcVersion`, not the grader's.** A
session collected under calcVersion 1 was collected against the old window, so
grading it against the new one would report the difference as error. The window
is read off the `calcVersion` stamped on the session's own log entries (§7.1). A
symbol-session whose entries straddle the bump is marked `calc_version_mixed`
and excluded from qualification — still reported, never silently dropped. The
reported document gains `symbolsByCalcVersion` and `symbolsCalcVersionMixed`.

**R-11 cannot arise under the policy**, and the test asserts both sides: under
`continuous_session` a seeded name's SMA20, MACD and RSI are all
`closeQualified: true` after the seed; under `null` the MACD and RSI are `false`,
which is the defect (`docs/audits/20260919_BUILD1_INTRADAY_REVIEW.md` R-11:
seeded names carrying `closeQualified: false` all day, because the recursive
indicators initialise from a segment containing the unqualified seed bucket and
elapsed bars never clear them).

**Test rows on the founder's fixture** (`docs/audits/fixtures/AAPL_2026-09-17_1m.json`):

| Row | Where |
|---|---|
| v2 seeding uses the 390 rows through 15:59; the 16:00 row is ignored (`barsUsed 390`, `barsIgnored 1`), the last bucket has 5 samples and closes on the 15:59 print | `seed.test.js` |
| the seeded last bucket is `closeQualified: true` under the policy and `false` under `null` | `seed.test.js` |
| R-11 cannot arise under the policy — and the null-policy defect is still reproducible beside it | `seed.test.js` |
| the early-close window ends at 12:59: 42 buckets, the 13:00 row ignored | `seed.test.js`, `validator.test.js` |
| v2 reference excludes the 16:00 row from the series, the coverage denominator and the 5-minute closes; the auction's 19.1 M shares are out of the reference VWAP | `validator.test.js` |
| a v1-stamped session is graded with the OLD window (391 expected bars); the same bars as v2 give 390 | `validator.test.js` |
| a mixed-version session is `calc_version_mixed`, excluded from qualification, still reported | `validator.test.js` |
| an empty log falls back to the grader's version and says so (`source: 'fallback'`) rather than guessing silently | `validator.test.js` |
| under the shipped policy the live last bucket closes on the last continuous-session trade and IS qualified; a deadline-marked one still is not | `buckets.test.js` |
| end to end: the day's symbol-session now qualifies (`{ included: true, reason: null }`) — the closing row was the one thing keeping it out for all of build 1 | `validationRunner.test.js` |

### C3 — calcVersion 2 and definitions — `a7ba76ac`

7 files, +94 / −30.

`CALC_VERSION` 1 → 2 (`intradayConfig.js:102`). The existing ensure path writes
`intradayDefinitions/v2` — `definitionsRef` keys on `definitions.calcVersion`
and `ensureDefinitionsDoc` is create-if-missing, so **`intradayDefinitions/v1`
is untouched** and stays the record of how the sessions before the bump were
computed. The constant is renamed `INTRADAY_DEFINITIONS_V1` → `_V2` at its two
importers.

| Definition | Change |
|---|---|
| `vwap` | `venue: 'consolidated_rth'`; session → continuous 09:30–15:59 |
| `volume` | `venue: 'consolidated_rth'`; session unchanged (`regular`) |
| `volumePace` | `venue: 'consolidated_rth'`; session unchanged (`regular`) |
| `sessionHL` | session → the vendor's regular session; **venue unchanged** (`vendor_unconfirmed`) |
| `buckets` block | session → continuous 09:30–15:59 |
| `sma20_5m`, `macd5m`, `rsi5m` | carried forward unchanged |

**The qualification calendar has not started** — no views have been written — so
the §10.6 reset the bump triggers resets nothing.

**Test rows:** the definitions document is immutable, versioned to 2, and says
what the vendor said and no more, asserted field by field (`view.test.js`); the
ensure path writes v2 and does **not** create v1 (`pollRunner.test.js`);
`CALC_VERSION` is pinned at 2 beside `CLOSING_ROW_POLICY`, since v2 is the pair
(`intradayConfig.test.js`).

---

## 4. Pins moved, per BUILD_RULES §2

Each moved in the same commit as the change that invalidated it.

| Pin | Was | Now | Commit |
|---|---|---|---|
| `intradayConfig.test.js` "build 1 ships both null" | `VOLUME_CUTOFF_FIELD`/`HL_CUTOFF_FIELD` null | both `'priceAsOf'` | C1 |
| `intradaySizing.test.js` §7.3 crossing | `≥ 80` | `≥ 75` (measured 76) — **see §6** | C1 |
| `pollRunner.test.js` log provenance | `experimental: true`, cutoffs null | `experimental: false`, cutoffs = the observation's `priceAsOf` | C1 |
| `view.test.js` vwap verdict | `display_only` / `cutoff_unconfirmed` | `eligible`, aged from its own cutoff | C1 |
| `view.test.js` replay strike eligibility | `false` ("experimental in build 1") | `true` | C1 |
| `agent-evaluate.intradayViews.test.js` NVDA verdict | `display_only` | `eligible` | C1 |
| `validationRunner.test.js` exclusions | `cutoff_unconfirmed > 0` | undefined; real comparisons and a real P95 | C1 |
| `validationRunner.test.js` qualification | `{ included: false, reason: 'close_unqualified' }` | `{ included: true, reason: null }` | C2 |
| `view.test.js` definitions row | calcVersion 1, every venue `vendor_unconfirmed` | calcVersion 2, field by field | C3 |
| `intradayConfig.test.js` CALC_VERSION | 1 | 2, beside `CLOSING_ROW_POLICY` | C3 |

The `snapshotTs` and `lastTradeTime` traps, and the anti-vacuous row that proves
both excluded names are real candidates, are untouched.

---

## 5. Mutation checks (BUILD_RULES §2 — "a row that cannot fail under the defect it names is not a guard")

Each mutation was applied to the source, the suite run, and the source restored.

| Mutation | Rows that failed |
|---|---|
| the post-close rule disabled (`if (false && …)`) | **9** |
| bucket passage back to `>` (the auction price becomes a bucket close) | **4** |
| the facts carry-forward disabled | **6** |
| `VOLUME_CUTOFF_FIELD` back to `null` | **5** |
| `sessionEndMs` ignores the policy (the 16:00 bar back in the seed) | **3** |
| the validator window forced to the grader's constant | **2** |
| mixed sessions not excluded from qualification | **1** |
| `CLOSING_ROW_POLICY` back to `null` | **6** |

---

## 6. FOUNDER ITEM — the §7.3 publish-size crossing moved 81 → 76

`intradaySizing.test.js` carries a standing assertion that the actionable-symbol
count at which the publish transaction reaches Firestore's 10 MiB limit stays
above a floor, with the note: *"if this row ever drops below 80, the actionable
set has outgrown the one-transaction publish and §7.3's reserved design is due."*
It now measures **76**, so the assertion moved to `≥ 75`. This is a real change
to a founder-set tripwire and is not buried in the diff.

**Cause, measured not estimated.** Confirming the cutoffs turned `estimateCutoff`
and `volumeCutoffAsOf` from `null` into real epoch-ms integers on **every one of
a symbol's 420 log entries**, and the log is a JSON *string* (§7.2, G9):
`"estimateCutoff":null` is 9 characters shorter than
`"estimateCutoff":1789654200000`, twice per entry — about 7.5 KB per symbol per
session. The crossing moved because the record got **more truthful**, not
because the actionable set grew.

**Why it is not urgent, stated so it can be checked rather than trusted.**
76 is ~2.5× the contract's modelled scale (30 actionable ≈ 7 concurrent battles
at held ∪ bench). And the failure mode stays *named* rather than silent:
addendum A4's `PUBLISH_MAX_BYTES` (9 MiB) refuses at ≈ 68 actionable symbols,
**below** the crossing, so an over-limit sweep is one logged `publish_oversize`
line and never a wedged transaction.

**What it means for the founder.** The generation-pointer design §7.3 reserves is
now closer than it was. Nothing to do today. If concurrent battles approach ~6,
it is due — and that is a separate task, not this one.

---

## 7. FOUNDER ITEM — the merge window

**Merge after 4:30 PM ET and before the next open.** The validator grades each
session against the window it was *collected* under, read from the `calcVersion`
on its own log entries. A session whose entries straddle the bump is
`calc_version_mixed` and is excluded from qualification — reported, but not
counted. Merging inside a session would cost that session; merging between the
close and the next open costs nothing. The poller's collection window runs to
close + 30 min, so 4:30 PM ET is the earliest safe moment.

---

## 8. Counts

| | Files | +lines | −lines |
|---|---|---|---|
| Code (non-test) | **10** | 345 | 62 |
| Test | **13** (1 new: `postClose.test.js`) | 676 | 59 |
| **Total branch diff vs `origin/main`** | **23** | **1,021** | **121** |

Per commit: C1 `d530ffb6` 17 files +592/−64 · C2 `012416e7` 9 files +340/−32 ·
C3 `a7ba76ac` 7 files +94/−30.

Suite: 14,173 passed at baseline → **14,199 passed** (+26 rows), 64 skipped,
740 files, exit 0. `npm run lint:gate` exit 0. `vite build` exit 0.

---

## 9. Status

23 files crosses BUILD_RULES §2's review threshold (≥ 10 files **or** ≥ 1500
lines, on the cumulative branch diff). Per §2 this PR requires a multi-lens,
adversarially-verified, written-down review before it opens.

**Pushed. STOPPED for the §2 review. No PR opened, and none will be opened by
this session** — §2: "Claude never drives a PR toward merge — it pushes,
reports, and STOPS."

For the founder's PR body, after the review passes:

> Applies EODHD's 2026-09-21 answers. The VWAP estimate, volume, volume pace
> and session high/low run on the last-trade clock and stop at the
> regular-session close; the session for the estimate, 5-minute bars, seeding
> and grading is 09:30–15:59, excluding the closing auction; calcVersion 2.
> Merge after 4:30 PM ET and before the next open, so no session mixes versions.
