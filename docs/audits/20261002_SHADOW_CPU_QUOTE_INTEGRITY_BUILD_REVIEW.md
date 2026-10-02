# Shadow vs CPU quote integrity — dark build record and cumulative review

**Date:** 2026-10-02 · **Contract:** `SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md` (controlling; external), with the v1.6 revision/verification note and the Fable v1.5 focused review as supporting evidence.
**Authorization:** founder, 2026-10-02 — dark implementation of v1.6; D10 (scoring-display contact and the 34 code/test files + one audit record) approved; P10 and P11 adopted (C-4's cache confirmation, B-3+'s precision wording). Same day, a second founder decision expanded the scope by four theme-guard files solely to register the new helper (§2): 38 implementation/support files + this record = 39. Merge and activation are separate founder decisions.
**Branch:** `claude/shadow-cpu-quote-integrity-v16`, cut fresh from `origin/main`.
**Base SHA (pre-build, OFF references captured here):** `44d0c63eba4e3099552d3ec3dbde6a89660a7e06`.
**Final SHA:** recorded in the PR (this file is part of the commit it would have to name).
**Flag:** `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false` — default-off, pinned, `DARK_BY_DESIGN`, no URL / environment / localStorage override.

<!-- REVIEW-VERDICT -->

---

## 1. Freshness, branch and baseline

| Item | Result |
|---|---|
| Fetch | `git fetch origin` first, exit 0 |
| Fetched `origin/main` | `44d0c63e` (Merge PR #922, 2026-10-01 22:53 −0500) |
| Session HEAD at start | `claude/sleepy-brahmagupta-oy2rna` at `44d0c63e`, clean tree and index, no untracked files, no stash — preserved untouched |
| Task branch | `claude/shadow-cpu-quote-integrity-v16`, fresh from `origin/main` at `44d0c63e` |
| Drift vs the contract's verified main | 0 commits (the contract and its note were verified at `44d0c63e`) |
| `AGENTS.md` | none in the repository |
| Baseline suite at the base SHA (isolated `git archive` extraction) | 16,428 tests: 16,364 passed, 0 failed, 64 skipped |

Every anchor the contract cites was re-read at `44d0c63e` before any edit (VERIFIED). The contract's "all 13 confirmed absent" counts 13; the inventory actually lists 14 new files (13 tests + file 12). All 14 were absent at the base. The 34 + 1 total is unaffected.

## 2. Scope as built

**38 implementation/support files plus this record — 39 in total.** Files 1–34 are exactly the §9 inventory (17 production, 17 test). Files 35–38 are the four theme-guard files the founder approved on 2026-10-02, solely to register file 12 with the existing guards (hazard 34); see the scope note below.

| # | File | Kind |
|---|---|---|
| 1 | `src/config/featureFlags.js` | flag, accessor, docstring, `Pinned by:` — appended after `:2895`; no earlier line changed |
| 2 | `src/config/flagPinGuard.test.js` | `DARK_BY_DESIGN` entry |
| 3 | `src/config/shadowCpuQuoteIntegrityFlags.test.js` | new — pin, accessor purity, append-only digest, admission |
| 4–5 | `api/stocks/prices.js`, `api/crypto/prices.js` | value-specific `quoteOrigin` inside the existing record |
| 6–7 | `api/{stocks,crypto}/prices.quoteOrigin.test.js` | new — real handlers, real server cache |
| 8 | `src/services/eodhdAPI.js` | origins preserved; stock fallback `isFallback` + `configured-fallback` origins |
| 9 | `src/services/eodhdAPI.placeholderPrices.test.js` | new — real batch service, real CacheService, deferred network |
| 10–11 | `src/hooks/useAgentBattle.js` + `.quoteSnapshot.test.jsx` | optional atomic envelope |
| 12–13 | `src/screens/battleView/shadowCpuQuoteIntegrity.js` + `.test.js` | new — the pure gate |
| 14–15 | `src/screens/AgentBattleScreen.jsx` + `.quoteAvailability.jsdom.test.jsx` | gated screen; real screen with boundary fakes |
| 16–17 | `src/components/BaggerBomb/TacticalRow.jsx` + `.currentPrice.render.test.jsx` | availability contract, click side |
| 18–19 | `src/screens/battleView/ArenaHeader.jsx` + `.render.test.jsx` | selected comparison; real framer row |
| 20–23 | `CharacterAvatar.jsx`, `CharacterPane.jsx` + tests | selected duel or neutral face |
| 24–25 | `src/components/draft/AssetResearchModal.jsx` + `.controlledQuote.test.jsx` | controlled held quote; navigation admission |
| 26–27 | `src/components/Research/useResearchData.js` + `.controlledQuote.test.jsx` | controlled mode |
| 28–29 | `src/components/shared/AnimatedScore.jsx` + `.instant.test.jsx` | `instant`, `fractionDigits` |
| 30–32 | `src/components/Research/StockChart.jsx`, `src/components/shared/OHLCDisplay.jsx` + `StockChart.controlledSession.test.jsx` | E-1 controlled session |
| 33–34 | `src/hooks/useAgentBattleId.js` + `.lookupEvidence.test.jsx` | C-2 lookup evidence, C-4 `confirmCache` |
| 35–36 | `src/theme/motion.guard.test.js`, `src/theme/tokens.guard.test.js` | approved expansion — file 12 appended to both `GUARDED_FILES` lists; no guard logic, coverage, exemption or allowance changed |
| 37–38 | `src/theme/motionGuardBaseline.json`, `src/theme/tokenGuardBaseline.json` | approved expansion — file 12's zero-violation entries in the existing schemas: motion `count: 0` with an authority note; token `{}` |

**Cumulative diff vs base:** 20 tracked files +2,594 / −310; 14 new files, 14,530 lines (much of it the inlined base-SHA references). Review threshold (≥10 files, ≥1,500 lines) met on both counts.

**Scope note — the theme guards (files 35–38).** Adding file 12 under `src/screens/battleView/` tripped the "every file in src/screens/battleView/ is on this list (hazard 34)" row of both theme guards. The fix needed four files outside the approved 34, so nothing was written there until the founder decided. Founder decision, 2026-10-02: approved, solely to register the helper — append it to both guarded lists, add zero-violation baseline entries in the existing schemas, keep the registration in the same commit as the helper, change nothing else, and fix the helper rather than grant an allowance if it had a genuine violation. It had none: the helper contains no `transition={{` opener and no hex literal at all.

| Run (both complete guard suites: `npx vitest run src/theme/motion.guard.test.js src/theme/tokens.guard.test.js`) | Result |
|---|---|
| Before registration | **2 failed / 166 passed (168)** — the hazard-34 row of each guard: "these src/screens/battleView/ files are not on the guarded list: src/screens/battleView/shadowCpuQuoteIntegrity.js" |
| After registration | **172 passed (172)** — the two hazard-34 rows green, plus four new per-file rows (each guard's "has not gained a … literal" and "baseline is not stale" rows for the helper) |

## 3. What was built

<!-- IMPLEMENTATION -->

## 4. OFF references (captured at the base SHA)

- Method: each test file has OFF rows whose comparison helper writes `<file-prefix>.<name>.json` when `SHADOW_OFF_CAPTURE_DIR` is set. The rows were run in the base extraction (`git archive 44d0c63e`) with only the test file copied in, then embedded inline between `// BEGIN GENERATED OFF REFERENCES` / `// END GENERATED OFF REFERENCES` markers, stamped with the base SHA. Markup is compared by SHA-256 digest where it is large (screen captures).
- 153 references across 14 test files (151 at first capture; two StockChart rows — a `_scaffold` field on the raw element without the controlled prop, 1D and bomb — were added mid-build and captured at the base the same way). Each capture was run twice at the base and was byte-identical (determinism).
- Defects re-verified at the base inside the captures: `close: null` → price 103 indistinguishable from a genuine 103; the stock 430 fallback unmarked; a late write returned through the cache; the screen kept the previous battle across A→B and after a subscription error; a `data.id` field overrode the document id; the pane-off face read 0–0; 1W showed today's open as the week's; the bomb aggregate used yesterday's bar; yesterday's 15:30 bar redrawn with today's high (B-7); `todayDailyCandle` with `open: 0` / `close: 0`; crypto Priority 2 on the previous UTC day (B-8); the "Why is it moving?" body carrying the entry-relative 3.96 and `close: 0` (B-9).
- No flag-off golden was regenerated; every pre-existing golden and screen suite passes unchanged.

## 5. Tests and validation

<!-- TESTS -->

## 6. Browser verification and its limits

Both checks ran in Chromium 141 (`/opt/pw-browsers/chromium`, driven by `playwright-core` 1.61.1) against a scratch Vite build of the **real** repository modules (aliases into `src/`; outside the repository, never committed). The page clock was pinned to Thu 2026-10-01 1:00 PM ET, because the chart's crosshair throttle reads `Date.now()`. Fixtures are synthetic; no provider, Firebase or production data was touched.

**(a) No-body scaffold (B-10, E-1) — real `StockChart` + `OHLCDisplay` + `lightweight-charts` 5.1.0.** The painted footprint of the rightmost candle was measured from a composite of every chart canvas with the crosshair hidden (a column counts when it carries ≥ 10 painted pixels vertically).

| Scenario | Rightmost candle as painted | Readout at rest | Hover on that candle | Hover on the previous bar | After leaving |
|---|---|---|---|---|---|
| `scaffold1D` — controlled, today's bar is the hook's scaffold (open = close = 104) | **1 column** (wick only — no body) | O **—**, H 106.00, L 101.50, C 104.00; close colour **neutral** `rgb(230, 237, 243)` | same: O **—**, neutral | O 101.00 H 103.00 L 100.00 C 100.00 — the observed bar untouched | back to O **—** |
| `body1D` — control: controlled, an observed open 102 supplied | 93 columns (body drawn) | O 102.00 … C 104.00; close colour green | O 102.00 | unchanged | O 102.00 |
| `legacy1D` — no `controlledSession` (default consumer) | 93 columns | O 103.00 (legacy) | O 100.00 (legacy) | unchanged | O 103.00 |
| `scaffoldBomb` — controlled bomb view, scaffold half-hour bar | not attributable: the bomb view's HIT labels overlap the bar's columns | O 103.00 — today's first **observed** half-hour open | O **—**, neutral | the observed 10:00 bar's own values | O 103.00 |

The only console error was a 404 for a static resource the scratch page does not ship (no page error). Screenshots of all four scenarios are kept with the scratch evidence; the bomb view's no-body rendering is therefore **visual-only** evidence.

**(b) Bar width at commit — real `framer-motion` 12.23.24, `ArenaHeader`.** A layout-effect probe read the teal half's inline width synchronously in the commit, then the painted width after one animation frame.

| Step | Committed inline width (same commit) | Painted after one frame | Settled |
|---|---|---|---|
| **Switch** browser (60–20) → last-scored (10–30): keyed remount with `initial={false}` | **25%** = the selected width | 148 px of a 592 px track = 25% | 25% |
| **Negative control** browser (60–20) → browser (20–60), same context: no remount, the existing tween runs | **75%** — the old width | 75% | 25% |

So in a real browser the switch commits and paints the selected width in the switching commit, and the control shows the check can fail. The jsdom real-framer rows (`ArenaHeader.render.test.jsx`) assert the same synchronously, with their own negative control.

**Not established in a browser** (jsdom or source evidence only) — each is a pre-activation check in §9: the legacy `ScoreHeader` bar (pane-off and tabbed layouts); the full gated screen; Firestore WebChannel timing for C-4's recovery; provider behaviour. Mocked charts and jsdom do not establish browser paint.

## 7. Cumulative adversarial review

<!-- REVIEW -->

## 8. Mutation checks

<!-- MUTATIONS -->

## 9. Residuals, pre-activation checks and separate tasks

<!-- RESIDUALS -->
