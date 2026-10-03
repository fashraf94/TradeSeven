# Shadow vs CPU quote integrity — dark build record and cumulative review

**Date:** 2026-10-02 · **Contract:** `SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md` (controlling; external), with the v1.6 revision/verification note (`SHADOW_CPU_V1_6_REVISION_AND_VERIFICATION_NOTE.md`) and the v1.5 focused review (`20261002_SHADOW_CPU_SPEC_V1_5_FOCUSED_REVIEW.md`) as supporting evidence.
**Authorization:** founder, 2026-10-02 — dark implementation of v1.6; D10 (scoring-display contact and the 34 code/test files + one audit record) approved; P10 and P11 adopted (C-4's cache confirmation, B-3+'s precision wording). Same day, a second founder decision expanded the scope by four theme-guard files solely to register the new helper (§2): 38 implementation/support files + this record = 39. Merge and activation are separate founder decisions.
**Branch:** `claude/shadow-cpu-quote-integrity-v16`, cut fresh from `origin/main`.
**Base SHA (pre-build, OFF references captured here):** `44d0c63eba4e3099552d3ec3dbde6a89660a7e06`.
**Final SHA:** recorded in the PR (this file is part of the commit it would have to name).
**Flag:** `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false` — default-off, pinned, `DARK_BY_DESIGN`, no URL / environment / localStorage override.

## Verdict

**The dark build is complete and reviewable; the flag stays `false`.** Merge and activation are separate founder decisions.

| Item | Result |
|---|---|
| Contract coverage | Every accepted v1.6 requirement in the authorized scope is implemented: value-specific provenance, the identified context, C-2 lookup evidence with C-4's cache confirmation, one selected comparison through all four consumers, research containment with the no-body scaffold, and flag-off parity. |
| Flag | `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false`, pinned, `DARK_BY_DESIGN`, no URL / environment / localStorage override; other rollout flags untouched. |
| Flag-off parity | Pinned by **160 OFF references** captured at the base SHA (every reference added during the review independently re-captured: identical). With the flag off every consumer takes the shipped path. The one flag-independent change is the additive provenance metadata the contract requires in both states (`quoteOrigin` on proxy records, `isFallback` on the stock fallback; §4.1) — numbers, requests and caching unchanged; every other flag-off change is a value-preserving relocation pinned by those references. |
| Tests | Full suite on the final tree: **17,041 tests — 16,977 passed, 0 failed, 64 skipped** (the same 64 as the base). Every one of the base SHA's 16,428 tests is present with an **unchanged status**; the build adds 613. The build's 19 suites: **804 tests, all passing** — including both theme guards in full. Re-run with CI's command after the §10 correction: identical, test by test. Under Node 20.20.2, CI's runtime, after the §11 correction: the same result with Chromium available; without Chromium, as in CI, **16,954 passed, 0 failed, 87 skipped**: the same 64 plus 23 Chromium-dependent tests from three files that predate this build (§11). After the §12 correction, at `a0b0c449`: **17,122 tests — 17,035 passed, 0 failed, 87 skipped** without Chromium, 17,058 / 0 / 64 with it; the 81 added tests are the screen's new rows. |
| Lint gate (`npm run lint:gate`) | **Failed in CI on the draft PR**: 3 `react-hooks/rules-of-hooks` errors in two of this build's test harnesses, which the build's validation had not linted. **Corrected** (§10) with no change to production code, assertions, OFF references, lint rules or configuration, and no suppression: the gate now reports 0 problems, under Node 22 and under Node 20.20.2 (§11). |
| Final independent review (F1, F2) | **HOLD resolved.** An admitted battle with a missing or malformed portfolio now stays gated and incomplete without throwing — both sides, controller on and off, every contract case, with the qualified stored pair when one exists. Flag-off and excluded behaviour are unchanged, pinned by four new base-SHA references and a 64-scenario differential review. F2's WebSocket wording is corrected. §12. |
| Unit suite on CI's runtime (Node 20) | **Failed in CI at `b6931e23`**: one row (`TacticalRow.currentPrice.render.test.jsx`, the click payload) hit `ReferenceError: navigator is not defined` while importing `react-dom/client`. Node 20 has no global `navigator`, while Node 22, which every earlier local run used, does. **Corrected** (§11) in that row's setup only: the browser globals are stubbed before the import and every one is restored exactly afterwards. The full suite now passes under Node 20.20.2. |
| `vite build` | Passes under Node 22 and under Node 20.20.2, with the same 18 warning lines as a build of the base SHA (§10, §11). |
| Cumulative adversarial review | Five independent lenses, five refuters and a delta review of the fixes (BUILD_RULES §2). **3 major and 10 minor findings CONFIRMED and fixed** — one major was a regression of the fix round itself, caught by the delta review — each with rows proven red before the fix and green after. 3 findings REFUTED outright; parts of three others refuted or downgraded, each with its reason. The final independent review's F1 (an admitted battle with a malformed portfolio could crash) and F2 (WebSocket wording) are resolved (§12). Its mandatory delta review — three lenses, refuters, and a delta review of the follow-ups — confirmed five further pre-existing gated-path defects (B-1 to B-4, D-1) and one coverage gap (C-3), all fixed, and recorded two document-field crashes as separate tasks. **No confirmed finding is open.** |
| Mutation evidence | **99 / 99** non-equivalent mutants killed on the final tree (103 in the catalogue: every §8.3 obligation plus the review's own); 3 recorded equivalents and 1 behaviour-preserving control survive as expected; every mutated file restored (sha256 manifest diff: 0 lines). After the §10 correction, the 67 mutants that use the two edited test files were re-run: the same results and the same failing tests. After the §11 correction, under Node 20.20.2: the two catalogue mutants that use the corrected file fail the same tests, and six new mutants aimed at the corrected row are all killed (also under Node 22). After the §12 correction, the 83 mutants that touch the screen or its suite were re-run on the final tree under Node 20.20.2: **78 / 78 non-equivalent killed** (4 recorded equivalents and the control survive). |
| Browser | The no-body scaffold and the ArenaHeader bar's committed width were verified in Chromium against the real libraries. Everything else that needs a browser, the provider or the Firestore transport is a **pre-activation check** (§9). |
| Scope | 38 implementation/support files + this record = 39. The four theme-guard files were added by the founder's decision of 2026-10-02 (§2). Nothing else outside the approved scope was touched; no fenced file (BUILD_RULES §1) was edited. |
| Deviations | Two contract descriptions narrowed to keep the contract's own flag-off rules (C-2 / B-6: lookup evidence only behind the gated screen's opt-in), and one hardening adopted from the review (the gated path subscribes no WebSocket symbols of its own; wording corrected in §12, F2) — §9. |

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
| Contract editorial corrections (founder instruction; editorial, not a new spec round) | Made in a corrected copy of `SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md` delivered with this build (the contract is not in the repository): §1's inherited "Nothing was executed" bullet is labelled historical (it described the v1.4 session), and ON-ID row (6) now reads no-auth → `error` `{ code: 'no-auth' }` → "Battle unavailable", replacing the superseded no-auth → `empty` wording; an editorial note records both. The build implements the corrected reading. |

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

**Cumulative diff vs base (final tree):** 39 files — 24 modified (+2,798 / −365) and 15 new (16,606 lines, this record included; much of it the inlined base-SHA references). The review threshold (≥10 files or ≥1,500 lines) is met on both counts.

**Scope note — the theme guards (files 35–38).** Adding file 12 under `src/screens/battleView/` tripped the "every file in src/screens/battleView/ is on this list (hazard 34)" row of both theme guards. The fix needed four files outside the approved 34, so nothing was written there until the founder decided. Founder decision, 2026-10-02: approved, solely to register the helper — append it to both guarded lists, add zero-violation baseline entries in the existing schemas, keep the registration in the same commit as the helper, change nothing else, and fix the helper rather than grant an allowance if it had a genuine violation. It had none: the helper contains no `transition={{` opener and no hex literal at all.

| Run (both complete guard suites: `npx vitest run src/theme/motion.guard.test.js src/theme/tokens.guard.test.js`) | Result |
|---|---|
| Before registration | **2 failed / 166 passed (168)** — the hazard-34 row of each guard: "these src/screens/battleView/ files are not on the guarded list: src/screens/battleView/shadowCpuQuoteIntegrity.js" |
| After registration | **172 passed (172)** — the two hazard-34 rows green, plus four new per-file rows (each guard's "has not gained a … literal" and "baseline is not stale" rows for the helper) |

## 3. What was built

Everything below is reached only through `isShadowCpuQuoteIntegrityOn()` (`src/config/featureFlags.js:2948`), a plain read of `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED = false` (`src/config/featureFlags.js:2945`), or through an optional input that only the gated screen passes. With the flag off, every consumer takes the shipped path. Line numbers are at the final commit.

**Flag (§3.1, A-9).** Constant, accessor, `// Pinned by:` pointer and default-off prose appended after the previous end of file. `DARK_BY_DESIGN` entry with its runway note (`src/config/flagPinGuard.test.js:188`). No URL, environment or localStorage override; the pin suite asserts the accessor is a pure constant read.

**Provenance (§4.1–4.2, R-3, R-12).** Both proxies add `quoteOrigin: { version: 1, price, previousClose }` inside the existing record, mirroring the unchanged `close || previousClose || 0` truthiness term for term (`api/stocks/prices.js:24`, `api/crypto/prices.js:14`). The batch service copies the origin exactly and adds nothing when it is absent (`src/services/eodhdAPI.js:117`); stock fallbacks gain `isFallback: true` and `configured-fallback` origins (`src/services/eodhdAPI.js:124`); numbers, cache keys, TTLs and requests are unchanged in both flag states.

**Gated interpretation (file 12, pure).** `readQuoteOrigins` (`src/screens/battleView/shadowCpuQuoteIntegrity.js:93`): `unproven` for missing, malformed or unknown origins; `isFallback` contradicts a genuine claim; `source === 'websocket'` makes the current unknown (R-3). `readMarketTime` (`src/screens/battleView/shadowCpuQuoteIntegrity.js:121`): Unix seconds → ms explicitly; a future time fails as a time only (A-7/V-9). `interpretQuote` (`src/screens/battleView/shadowCpuQuoteIntegrity.js:141`): a usable current needs `provider-close` and a finite positive value; the market time is read only for a qualified current; previousClose qualifies independently. `adoptQuote` (`src/screens/battleView/shadowCpuQuoteIntegrity.js:218`): §4.3 Option 1 — a strictly older (both timed) arrival is rejected whole; equal, absent or unattached times adopt the arrival with its own time; A-8 keeps a genuine previousClose independently.

**Identity and lifecycle (§3.1, §3.2, C-2, B-4/B-5, C-4, A-4).**
- `useAgentBattleId` (`src/hooks/useAgentBattleId.js:39`): without options it is the shipped hook exactly — return shape, render passes, commits and the three-argument listener call. With the gated screen's `{ confirmCache: true }` (flag on, query path only) it adds one `lookup` object per generation (agent, generation, status, battle ID, `fromCache`, error identity, all from the CURRENT agent's lookup or else `pending`), stamps no-auth as an error (B-4), treats an empty result from cache as unconfirmed (B-5), and asks the existing listener for metadata events so an unconfirmed empty can recover (C-4); a confirmed empty is sticky for its generation. The generation advances when the agent changes while opted in and whenever the opt-in flips, so the direct-ID route (called with `null` and no opt-in) retires it (review delta D-1).
- `useAgentBattle` (`src/hooks/useAgentBattle.js:28`): with `{ integrity: true }` it adds one atomic envelope `{ requestedId, snapshotId, status, data, error }` (`src/hooks/useAgentBattle.js:120`); retired subscription callbacks are dropped; legacy fields unchanged.
- The screen resolves one requested ID (`src/screens/AgentBattleScreen.jsx:1051`) and one gate (`src/screens/AgentBattleScreen.jsx:1059`; `src/screens/battleView/shadowCpuQuoteIntegrity.js:315`): pending, "No active battle", "Battle unavailable" (carrying the current error's code as `data-battle-error`), excluded → the shipped path, admitted → the gated path. The [A-4] exclusion memory ends when another ID is requested, and an excluded battle's lookup error follows legacy (the legacy-retained ID is kept). Terminal states render `GatedShell` (`src/screens/AgentBattleScreen.jsx:363`), whose pending state reuses the shipped loading indicator verbatim (`src/screens/AgentBattleScreen.jsx:339`).
- Admitted: one identified context per matching snapshot (`src/screens/battleView/shadowCpuQuoteIntegrity.js:404`), lineage reconciliation with conservative invalidation (`src/screens/battleView/shadowCpuQuoteIntegrity.js:454`), position tokens (`src/screens/battleView/shadowCpuQuoteIntegrity.js:496`) and identity-checked arrivals (`src/screens/battleView/shadowCpuQuoteIntegrity.js:509`).

**Quotes and scoring (§4.3, §6).** The gated poll (`src/screens/AgentBattleScreen.jsx:1315`) issues the same two batch calls at the same cadence, only for the identified held positions; each kind's result stands alone (`Promise.allSettled`, §4.3 rule 2); a failure leaves positions stale or unavailable, never entry or a fallback. Gated enrichment (`src/screens/AgentBattleScreen.jsx:1146`) scores a position through the shared `enrichHeldPosition` (`src/screens/AgentBattleScreen.jsx:181`) only from `q.accepted.price` and `q.genuineClose`; unavailable rows carry `quoteAvailability` and no current-derived field, and `TacticalRow` branches before any formatting (`src/components/BaggerBomb/TacticalRow.jsx:257`). The gated path subscribes no WebSocket symbols (`src/screens/AgentBattleScreen.jsx:1260`).

**One selected comparison (§5, C-1, B-1, B-3+, P8, P9).** `selectComparison` (`src/screens/battleView/shadowCpuQuoteIntegrity.js:656`) picks the browser pair (complete, finite), the qualified stored pair (`src/screens/battleView/shadowCpuQuoteIntegrity.js:547`) with its actual stored date, time and zone, a stored final, or "unavailable"; it computes the three-way lead (a tie emphasizes neither side), the two-branch bar width (`src/screens/battleView/shadowCpuQuoteIntegrity.js:568`) and the margin prose from the displayed hundredths (`src/screens/battleView/shadowCpuQuoteIntegrity.js:595`). The screen selects it once (`src/screens/AgentBattleScreen.jsx:1537`) and hands the same object to all four consumers: `ArenaHeader` (`src/screens/battleView/ArenaHeader.jsx:135`), the legacy `ScoreHeader` (`src/screens/AgentBattleScreen.jsx:571`), `CharacterAvatar` (`src/screens/battleView/CharacterAvatar.jsx:267`) and `CharacterPane` (`src/screens/battleView/CharacterPane.jsx:301`). Each branches on it before any `??` / `|| 0` default. A switch remounts the counters (`SwitchCounter`, `src/screens/battleView/ArenaHeader.jsx:112` — `AnimatedScore`'s new `instant` and `fractionDigits`, `src/components/shared/AnimatedScore.jsx:26`) and the bar's teal half with `initial={false}` (`src/screens/battleView/ArenaHeader.jsx:374`), so the switching commit carries the selected digits, label, tint and width. The ArenaHeader's label and seam share one child slot, as the base's seam did, so the flag-off markup (and its SSR `useId`s) is byte-identical.

**Held research containment (§7.2, E-1, B-7–B-10).** A held click opens research only for a usable position of the current context (`src/screens/AgentBattleScreen.jsx:2335`), passing `controlledQuote` (`src/screens/AgentBattleScreen.jsx:3412`) — the qualified price, the position key and today's session-qualified extremes; otherwise a notice (`src/screens/AgentBattleScreen.jsx:417`). The modal validates the contract and fails closed (`src/components/draft/AssetResearchModal.jsx:129`), never fetches a held price (`src/components/draft/AssetResearchModal.jsx:153`), admits navigation only through the screen (`src/screens/AgentBattleScreen.jsx:1674`), and sends the daily change — never the entry return — to "Why is it moving?" (`src/components/draft/AssetResearchModal.jsx:1368`). The research hook's controlled mode (`src/components/Research/useResearchData.js:101`) polls nothing, uses only today's supplied values (`src/components/Research/useResearchData.js:75`; B-7, B-8) and draws a no-body scaffold for today (`src/components/Research/useResearchData.js:61`; B-10), which the chart recognizes and never reads as an open (`src/components/Research/StockChart.jsx:85`); `OHLCDisplay` shows "—" for a missing open with a neutral close colour, only when asked.

## 4. OFF references (captured at the base SHA)

- Method: each test file has OFF rows whose comparison helper writes `<file-prefix>.<name>.json` when `SHADOW_OFF_CAPTURE_DIR` is set. The rows were run in the base extraction (`git archive 44d0c63e`) with only the test file copied in, then embedded inline between `// BEGIN GENERATED OFF REFERENCES` / `// END GENERATED OFF REFERENCES` markers, stamped with the base SHA. Markup is compared by SHA-256 digest where it is large (screen captures).
- **160 references across 14 test files.** 153 before the review (151 at first capture; two StockChart rows — a `_scaffold` field on the raw element without the controlled prop, 1D and bomb — were added mid-build and captured at the base the same way); each first-round capture was run twice at the base and was byte-identical (determinism). The review round added 7, each captured at the base the same way and independently re-captured by a reviewer: the screen's `loadingReturn` (the legacy loading return, whose spinner the build moved into a shared indicator) and `swapTransition` (a swap delivered mid-session with the breakdown and legacy research open); the header's `presenceOnMarkup` (the shipped, presence-on header's serialized markup, SSR `useId`s included); and the hook's `cachedThenServerSameId`, `sameErrorAcrossAgents`, `agentChangePasses` and `returnShape` (commit, render-pass and return-shape parity of the one-argument call).
- Defects re-verified at the base inside the captures: `close: null` → price 103 indistinguishable from a genuine 103; the stock 430 fallback unmarked; a late write returned through the cache; the screen kept the previous battle across A→B and after a subscription error; a `data.id` field overrode the document id; the pane-off face read 0–0; 1W showed today's open as the week's; the bomb aggregate used yesterday's bar; yesterday's 15:30 bar redrawn with today's high (B-7); `todayDailyCandle` with `open: 0` / `close: 0`; crypto Priority 2 on the previous UTC day (B-8); the "Why is it moving?" body carrying the entry-relative 3.96 and `close: 0` (B-9).
- No flag-off golden was regenerated; every pre-existing golden and screen suite passes unchanged.
- Two files need the pure helper copied alongside to re-run at the base SHA (`ArenaHeader.render.test.jsx`, `eodhdAPI.placeholderPrices.test.js` — their ON sections import it); their reference headers now say so, and with it all 28 of their references reproduce exactly.

## 5. Tests and validation

**Harness.** Every suite exercises the real production module with mocks only at the stated boundaries: Firestore `onSnapshot` (under the REAL `useAgentBattleId` / `useAgentBattle`), the price network (`stockAPI` / `fetch`), the WebSocket prices hook, `lightweight-charts` (chart suite), the heavy research tabs, and framer-motion in the screen suite (stubbed for deterministic markup — except the gated tug-of-war bar, which the stub hands to the real library so its committed inline width is observable per commit). The canonical display scorer is never mocked; the real `standingFromDuel`, `computeTugOfWarWidth` and `formatScoreDisplay` are the oracles.

**The build's suites at the final commit.**

| # | Suite | Tests |
|---|---|---|
| 2 | `src/config/flagPinGuard.test.js` (pin registry incl. the new `DARK_BY_DESIGN` entry) | 6 |
| 3 | `src/config/shadowCpuQuoteIntegrityFlags.test.js` | 10 |
| 6–7 | `api/stocks/prices.quoteOrigin.test.js`, `api/crypto/prices.quoteOrigin.test.js` | 47 + 46 |
| 9 | `src/services/eodhdAPI.placeholderPrices.test.js` | 46 |
| 11 | `src/hooks/useAgentBattle.quoteSnapshot.test.jsx` | 11 |
| 13 | `src/screens/battleView/shadowCpuQuoteIntegrity.test.js` | 104 |
| 15 | `src/screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx` | 142 |
| 17 | `src/components/BaggerBomb/TacticalRow.currentPrice.render.test.jsx` | 22 |
| 19 | `src/screens/battleView/ArenaHeader.render.test.jsx` (real framer-motion rows included) | 41 |
| 21, 23 | `CharacterAvatar.render.test.jsx`, `CharacterPane.comparison.render.test.jsx` | 27 + 9 |
| 25 | `src/components/draft/AssetResearchModal.controlledQuote.test.jsx` | 22 |
| 27 | `src/components/Research/useResearchData.controlledQuote.test.jsx` | 24 |
| 29 | `src/components/shared/AnimatedScore.instant.test.jsx` | 18 |
| 32 | `src/components/Research/StockChart.controlledSession.test.jsx` | 24 |
| 34 | `src/hooks/useAgentBattleId.lookupEvidence.test.jsx` | 33 |
| 35–36 | `src/theme/motion.guard.test.js`, `src/theme/tokens.guard.test.js` (complete suites) | 81 + 91 |
| | **Total** | **804, all passing** |

**OFF references.** **160 inline references in 14 test files** — the 153 of the first capture plus 7 added in the review round (screen `loadingReturn` and `swapTransition`; header `presenceOnMarkup`; hook `cachedThenServerSameId`, `sameErrorAcrossAgents`, `agentChangePasses`, `returnShape`), each block stamped with the base SHA. Every reference was captured by running the test file's OFF rows against the base production files (`git archive 44d0c63e`) with `SHADOW_OFF_CAPTURE_DIR` set — never by blessing build output. During the review the test-integrity lens re-derived all 153 first-round references from the base files (153 / 153), refuter B independently re-captured the 9 header digests and the hook rows, refuter D the 13 screen references plus `swapTransition`, and I re-captured every reference added in the review round (screen 15 / 15, hook 11 / 11, header `presenceOnMarkup` 9 / 9): all identical. Two files (`ArenaHeader.render.test.jsx`, `eodhdAPI.placeholderPrices.test.js`) need the pure helper copied alongside at the base SHA, as their reference headers now state; with it, their 28 references reproduce exactly.

**Full suite.** `npx vitest run` on the final tree: **836 test files, 17,041 tests — 16,977 passed, 0 failed, 64 skipped.** Against the base-SHA baseline (16,428 tests: 16,364 passed, 64 skipped, run in an isolated `git archive` extraction): every baseline test is present with the **same status** (0 missing, 0 status changes); the build adds 613 tests, every one uniquely named. The same 64 tests are skipped in both runs. The two theme-guard suites, which failed their hazard-34 row before the approved registration, pass in full (§2).

**`vite build`** (BUILD_RULES §2 — no test imports `App.jsx`): `npx vite build` succeeded on the final tree (✓ built in 18.9 s). Its 18 warning lines (four CSS syntax warnings, 13 dynamic-import notices and the chunk-size notice) all predate this build: a build of the base SHA prints the same 18 (§10; this sentence previously named only the chunk-size notice).

**Rows labelled ON that also pass against base production code** (test-integrity F14 — parity or positive-control rows, not guards of new behaviour): the screen's "term explanations stay accessible", ON-ID (2) "an unchanged successful result", "the direct-ID route never subscribes the lookup query", the [A-4] excluded-then-errored row (a guard that is also a parity statement), and ON-DAY2's "no retained close → 75" rows; in the service suite the pre-upgrade-record, [A-8], missing/stale→recovery, [C-3] and unknown-origin-control rows; in the hook suites "one listener, same call shape", "no `integrity` key", "(13) no timers" and "metadata-only events re-run legacy setters"; in the research suites "stock daily change: the same figure legacy computes", "open supplied … the open shows" and "a real daily candle of today keeps its observed open". The review round added further spec-literal parity rows, each labelled PARITY in its block comment (refuter D's CPU matrix, crypto ordering at the screen, pane-off ON-F4a).

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

**Method (BUILD_RULES §2).** Five independent lenses — provenance (provider → every gated consumer), lifecycle / cache / identity, off-state / dark-merge guarantee, presentation agreement, test integrity — each on its own copy of the build tree (`snapshot-r1.tar`, sha256 `444174d8…`) under the session scratchpad, `node_modules` symlinked, read-only on git and on the shared tree. Every finding was then handed to one of four refuters (A–D), each on its own fresh copy, instructed to refute it with a concrete repro; a finding that survived an honest attempt is CONFIRMED. The fixes were then reviewed as a delta by a sixth, independent reviewer on a copy of the fixed tree (one major finding, CONFIRMED by a further refuter and fixed — see below), and the mutation pass ran last on its own tree (§8).

**Lens totals.** Provenance: 1 minor (test gap), 1 question. Lifecycle: 1 major, 1 minor, 2 questions. Off-state: 3 minor, 2 nits, no questions. Presentation: no confirmed defect; 1 hypothesis the lens refuted itself (H-1, a `SwitchCounter` lane race: React 19 renders Sync and Default lanes together, executed repro), 1 question, 3 nits. Test integrity: 1 major, 6 minor, 8 nits and 1 note; it also re-captured all 153 OFF references against the base production files (153 / 153 reproduced) and ran 41 mutations of its own.

| Finding | Lens · severity | Claim | Refutation | Disposition |
|---|---|---|---|---|
| lifecycle **F-1** | lifecycle · **major** | The [A-4] exclusion memory never ends: A (excluded) → B → A, and A's new subscription errors before its first snapshot → the legacy path renders the retained B (direct route) or the opening prop (query route) and polls | **CONFIRMED** (A): reproduced on the direct route, the query route and a same-agent ab-1 → ab-9 → ab-1 sequence; the shipped 98-row screen suite was green with it. Latent under today's `App.jsx` navigation (it remounts the screen between battles) but supported by the contract (§3.2, ON-ID 1) | **Fixed.** The memory is cleared during render as soon as another ID is requested (`src/screens/AgentBattleScreen.jsx:1057`); 4 new screen rows; mutant `a4-memory-kept-across-ids` killed |
| off-state **F3** | off-state · minor | With the flag on, an EXCLUDED battle on the query path is torn down to "Battle unavailable" by a later lookup error; flag off keeps the legacy screen | **CONFIRMED** (A), on the reading that A-4 and OFF-7 ("legacy behaviour resumes") cover an excluded battle; the C-4 table governs the gated path, which A-4 switches off. A showed an F3-only fix is unsafe (another agent's error would revive the battle) | **Fixed with F-1 as one change:** while the memory names the ID the legacy hook still retains (`queriedId`, retained only through an error callback) and the lookup is in error, the screen keeps requesting it (`src/screens/AgentBattleScreen.jsx:1049`) and `resolveGate` lets the envelope decide (`src/screens/battleView/shadowCpuQuoteIntegrity.js:331`). Confirmed-empty and unconfirmed-empty after exclusion are unchanged ("No active battle" / "Battle unavailable"). 5 screen rows + 1 gate row; mutants `a4-lookup-error-teardown`, `a4-gate-no-fallthrough`, `a4-hold-excluded-not-retained` killed (`a4-hold-without-legacy-retention` is a recorded equivalent, §8) |
| lifecycle **F-2** | lifecycle · minor | One poll's two batch calls share one `Promise.all` / `catch`: a stock rejection discards the crypto call's genuine answers | **CONFIRMED** (A): §4.3 rule 2, "A later request failure does not disqualify another request's genuine success"; conservative direction, never a wrong number | **Fixed:** `Promise.allSettled`, each kind applied on its own (`src/screens/AgentBattleScreen.jsx:1331`); same calls, order and cadence; 4 rows; mutant `batch-one-failure-poisons-all` killed |
| off-state **F1** | off-state · minor | With presence on (the shipped default), the default `ArenaHeader`'s serialized markup differs from base: a new child slot shifts the face's SSR `useId`s | **CONFIRMED** (B): SSR ids differ (`_R_4au_` → `_R_8ku_`); the client DOM (`createRoot`) is identical; OFF-6 parity is serialized-markup parity and the repo's own "ONE CHILD SLOT" rule applies | **Fixed:** label and seam share one child slot (`src/screens/battleView/ArenaHeader.jsx:346`). New OFF row `presenceOnMarkup` (9 digests captured at the base SHA; B's independent capture matched mine digest for digest); presence-on SSR of the header and of the screen's paneOn golden byte-identical to base; mutant `arena-extra-slot` killed |
| off-state **F2** | off-state · minor | Flag off, `useAgentBattleId` commits once more than base when a cached first result is followed by a server event with the same ID | **CONFIRMED** (B): SDK-legal flag-off with the pinned SDK (needs a concurrent reference to the document; rare); same root cause as the build's known residual (the `nullToNull` extra commit) | **Fixed:** the C-2 evidence machinery runs only behind the gated screen's opt-in `{ confirmCache: true }`; without it the hook is the pre-build hook (`src/hooks/useAgentBattleId.js:151`). 4 new OFF rows captured at the base SHA plus `nullToNull` now exact; the known residual is gone. **Deviation, recorded in §9:** B-6's "flag off included" render pass and C-2's always-present `lookup` become opt-in-only (the direct-ID route gets no `lookup`, which it ignores anyway; a missing `lookup` fails closed to pending). Mutant `refB-evidence-flag-off` killed |
| provenance **F-1** | provenance · minor | A bare WebSocket overlay fed into gated SCORING survives the screen suite | **CONFIRMED** (C): the production code is correct (scoring reads only `q.accepted.price`), but no row could fail | **Fixed:** an ON-F2a row with an overlay for a player, a CPU and a crypto holding (mutant `refC-MUT-A-ws-into-scoring` killed; its hoist-only control survives as it must). Hardening adopted from C: the gated path subscribes no WebSocket symbols at all (`src/screens/AgentBattleScreen.jsx:1260`), so the pending shell never subscribes the opening prop's symbols; pinned by a row recording the hook's argument (mutant `ws-gated-subscribe` killed) |
| test integrity **F1** | test integrity · **major** | The legacy `ScoreHeader`'s gated tie tint (P8) has no test; "tie as a player lead" survives | **CONFIRMED** (C): both tie-as-player and tie-as-CPU mutants survived 98/98 | **Fixed:** tie-tint assertions at the stored 0–0 step of §5.4 in every layout and in the browser 0–0 control, with positive controls (mutants `refC-MUT-B…`, `refC-MUT-B2…` killed) |
| test integrity **F2** | test integrity · minor | Screen-level ON-ID (1) cannot fail under "accept evidence from a retired generation" | **CONFIRMED** (C) | **Fixed:** the row asserts that the retired callback opens no document listener and the current one does (mutant `refC-MUT-C-retired-evidence` killed at the screen) |
| test integrity **F3** | test integrity · minor | `initial === false` assertions are vacuous; the legacy header's switch remount has no committed-width guard | **CONFIRMED** with a refinement (C): the assertions guard the prop, not the switch; the shipped "A→B never ramps" row actually remounted the whole screen | **Fixed:** the screen suite renders the gated bar with the real framer-motion inside its stub and asserts the committed inline width per commit, with negative control NC1 (same kind: old width, same node), a within-battle context switch, and A→B on a persistent screen. Mutants `v3-no-context-switch`, `refC-MUT-D2/D3/D4` killed |
| test integrity **F7** | test integrity · minor | ON-F2a's unqualified-click matrix ran on the player side only | **PARTIALLY CONFIRMED** (D): the CPU **stale** click is a distinct state no row clicked (a CPU-only "keep the stale tuple" mutant survived 98/98); CPU × fallback / unknown / substitution / WebSocket are the same screen state as the covered CPU × missing (parity) | **Fixed:** a CPU block — 5 spec-literal parity rows + the stale guard row (mutant `refD-F7-cpu-stale-details` killed) |
| test integrity **F8** | test integrity · minor | ON-F2b's scenarios each ran on one side | **PARTIALLY CONFIRMED** (D): a CPU same-symbol re-entry at an identical price (swap identity only) and the CPU lifecycle sequence were unguarded (a CPU-only lineage mutant survived 198/198) | **Fixed:** 2 guard rows + 2 parity rows (mutants `refD-F8-cpu-lineage-no-swap-id` and `refD-F7-cpu-stale-details` killed) |
| test integrity F9 | test integrity · minor | ON-F2c exercised chat names only | **REFUTED** (D): bench, chat and tape names reach the screen through ONE `AgentChat` callback with one payload shape; the bench roster is an input of that component, and the pane's bench and tape have no research door — no screen mutation can tell them apart | No change |
| test integrity F10 | test integrity · minor → nit | ON-F3a at the screen was stock-only and asserted no badges or totals | **PARTIALLY CONFIRMED, downgraded** (D): the defect class (importing a rejected record's close) is killed by 5 gate and batch rows; the screen path after the stock/crypto merge is market-agnostic | **Rows added:** 8 crypto parity rows (both sides) and 3 day-2 rows asserting badge count, total, row price, header prose, tuple and request count |
| test integrity F11 | test integrity · nit / **minor** | ON-ROW's withheld channels were proven structurally; no double-count check | Channels **REFUTED** (D: re-enabling the fuse fails both shipped ON-ROW rows, incidentally); the double count **CONFIRMED, minor**: a mutant adding the banked points twice to the gated total survived 98/98 (every switch fixture had no closed trades) | **Fixed:** 2 rows pin the gated browser total with banked points (mutant `refD-F11b-double-banked` killed); a per-channel marker row hardens the TacticalRow suite (mutant `refD-F11a-fuse-in-unavailable` killed) |
| test integrity F15 | test integrity · nit | OFF-5 had no swap-transition capture | **REFUTED as a defect** (D): the flag-off swap path is not on the production diff except the poll effect's dependency array, which flag-off is the same restart condition | **Row added:** OFF `swapTransition` (a swap delivered mid-session with the breakdown and legacy research open, then a poll), reference captured at the base SHA; my independent re-capture of all 15 screen references matches |
| test integrity F16 | test integrity · nit | ON-F4a omitted the pane-off layout | **REFUTED** (D): the rows are one `boardRows` element for every controller-on layout and holdings come from layout-free selectors | Parity row added |
| test integrity F4 | note | §8.3 "skip the −0.00 normalization" is an equivalent mutant: after `Math.round(v·100)/100` the only negative zero is `-0`, and `(-0).toFixed(2)` is `"0.00"` with `-0 >= 0` true | Not a defect | Kept as defensive code; recorded as an equivalent mutant (§8) |
| test integrity F5 / off-state N1 | nit | The "regenerate at the base SHA" recipe of two test files needs the new helper present | Verified: with the helper copied in, all 28 references of both files reproduce exactly | **Fixed:** the recipe is stated in both files' reference headers |
| off-state N2 | nit | `GatedShell` copied the spinner's raw `transition={{…}}` (BUILD_RULES §11) | — | **Fixed:** the pending shell reuses the shipped indicator (`BattleLoadingIndicator`), which the legacy loading return now also renders; new OFF row `loadingReturn` captured at the base SHA (mutant `loading-indicator-markup` killed). Its background uses `cssVar('bg-dashboard')`, and the gated counter's colour `cssVar('teal')` (§10) |
| lifecycle Q-1 | question | "Battle unavailable" did not carry the error identity anywhere observable | — | **Addressed:** `data-battle-error` carries the current error's code; ON-ID (4)(5), (6) and (10) assert it, and that a retired lookup's code never shows (mutant `shell-error-any-generation` killed) |
| provenance Q-1 / lifecycle Q-2 | question | The WebSocket hook was fed the opening prop's symbols while pending | — | **Addressed** by the hardening above |
| presentation Q-1 | question | Crypto classification differs between the screen (33 symbols) and the modal (100): 67 symbols are crypto to the modal only. If held, the screen would poll them as stocks and the hook would drop (never misdate) their ET-dated extremes after 8 PM ET | No wrong number | **Residual** (§9): whether a held position can carry such a symbol is a pick-universe question |
| presentation N-1 | nit | The stored-time label has no year | — | **Residual** (§9) |
| presentation N-2 | nit | `comparison.accessibleText` is built but unused | — | **Residual** (the DOM text carries the same content) |
| presentation N-3 | nit | Three consumers derive the duel inline instead of calling `duelFor` | — | **Residual** (consumer rows assert all four equal `duelFor`) |
| test integrity F6 | nit | Capture mode asserts nothing | No live risk (nothing sets the variable) | **Residual** |
| test integrity F12 | nit | ON-F5a frames are not captured at the screen (per commit only) | Frame-stepped in `AnimatedScore.instant.test.jsx` | **Residual** |
| test integrity F13 | nit | The proxy suite hand-rolls the client's `parseFloat || 0` | The real path is covered by the service suite | **Residual** |
| test integrity F14 | nit | 15 ON-labelled rows pass unchanged against base production code (feature absent) | They are parity or positive-control rows | **Recorded** (§5) |


**The fix round, reviewed as a delta.** A sixth reviewer took a copy of the fixed tree (`snapshot-r2.tar`), diffed it against the reviewed one, re-captured every new OFF reference from the base production files (37 / 37), ran 23 mutations of its own against the new rows (all red where claimed) and checked the theme-guard registration (exact; both guards go red when the helper gains a raw `transition={{` or a core hex).

| Finding | Severity | Claim | Refutation | Disposition |
|---|---|---|---|---|
| delta **D-1** | **major** (a regression of the fix round) | Making the C-2 evidence opt-in left the generation blind to an un-gated phase: with the flag on, query A → the direct-ID route (the hook called with `null`, no opt-in) → query A returned to the retired generation, and its listener's evidence settled the screen — the old battle subscribed and shown before the current lookup delivered | **CONFIRMED** (refuter E) at hook and screen level, with the reviewed tree as a positive control; latent under today's navigation, contrary to C-2's letter ("advances exactly when the requested `agentId` changes") | **Fixed:** the tracked pair records the opt-in and the generation advances when it flips (`src/hooks/useAgentBattleId.js:59`). Flag off nothing is ever written; every base-captured OFF row holds; StrictMode advances once per change. 4 hook rows + 1 screen row, all red with the fix reverted (mutant `d1-generation-blind-to-opt-in` killed) |
| delta N-1 | nit | The delta brief's file list omitted a comment-only change to `eodhdAPI.placeholderPrices.test.js` (the regeneration note) | — | Scope accounting only (file 9 is in scope) |
| delta Q-1 | question | After an excluded battle's lookup error, a later snapshot that passes admission would take the gated path while the lookup is in error | **Not reachable** (refuter E's writer census: nothing in `api/` or `src/` changes `gameMode`, `groupId` or the opponent on a live battle document; the only opponent writer is an orphaned endpoint that refuses once an opponent exists) | **Residual** (wording; §9) |

**The mutation pass's own findings.** The full pass (§8) left four mutants alive on the first complete run; each was resolved before the final run:

| Mutant | Why it survived | Disposition |
|---|---|---|
| `accept-retired-position-callback` | The poll effect's `active` flag already drops a retired effect's answers; the per-position identity check guards only an answer that resolves between the commit that changed a position and that effect's cleanup — a window `act()` cannot stage | `positionToken` / `applyQuoteArrival` moved unchanged into the pure gate module (`src/screens/battleView/shadowCpuQuoteIntegrity.js:509`) and pinned by 3 unit rows → killed |
| `accept-retired-snapshot-callback` (`useAgentBattle`) and the matching `useAgentBattleId` guard | The rows delivered retired callbacks before the new subscription settled, where the generation check alone hides them | One row in each hook suite delivers them AFTER the current one settled (an overwrite would knock the screen back to pending) → killed |
| `omit-consumer-avatar` | The rows inspect the faces rendered in a window; the pane's mark did not re-render, so a stale or legacy duel went unseen | The face recorder also tracks every mounted face's current input (payloads and markup unchanged); a row asserts every live face shows the one selected duel at each step → killed, together with new pane and arena variants |
| `details-by-symbol` | A changed position always restarts with no quote, so the status check closes the view in the same render as the identity check | **Equivalent** (recorded). The §8.3 obligation it names is now also expressed at the click resolver (`details-by-symbol-resolver`) → killed |


**Totals.** **3 major** (lifecycle F-1, test-integrity F1, delta D-1) and **10 minor** findings CONFIRMED — lifecycle F-2; off-state F1, F2, F3; provenance F-1; test-integrity F2, F3, F7 (partly), F8 (partly) and F11's double count — **all fixed**, each with rows proven red before the fix and green after. Test-integrity F10 was downgraded to a nit (rows added). **REFUTED:** test-integrity F9, F15 (as a defect; the swap capture was added anyway) and F16, F11's channel half, and presentation H-1 (refuted by the lens itself). The remaining nits and questions are dispositioned row by row above. No confirmed finding is open.

## 8. Mutation checks

**Method.** A catalogue of **103 mutants**: every mutation the contract's §8.3 requires (the v1.3 list and each amendment's items), plus those the lenses, the refuters and the mutation pass itself added. Each is one exact edit set in production code and names the suites that must fail. The runner applied them one at a time to an isolated copy of the final tree (never the repository), ran those suites, restored the files, and finally compared a sha256 manifest of every `src/` and `api/` file with the one taken before the run: **restore diff 0 lines**.

**Result: 99 / 99 non-equivalent mutants killed**; none survived. 3 recorded equivalents survive as expected, and 1 behaviour-preserving control survives as it must.

| # | Mutant | Obligation | In | Result (failed / run) |
|---|---|---|---|---|
| 1 | `drop-proxy-origin-stock` | drop a proxy origin | stock proxy | killed (22 / 47) |
| 2 | `drop-proxy-origin-crypto` | drop a proxy origin | crypto proxy | killed (20 / 46) |
| 3 | `promote-prevclose-stock` | promote previousClose-as-current | stock proxy | killed (7 / 47) |
| 4 | `promote-prevclose-gate` | promote previousClose-as-current (gate) | gate | killed (7 / 246) |
| 5 | `genuine-from-absent-marker` | infer "genuine" from an absent marker | gate | killed (6 / 246) |
| 6 | `accept-websocket-current` | accept a WebSocket-overwritten current | gate | killed (5 / 246) |
| 7 | `runtime-rejection-untimed` | reintroduce runtime rejection (untimed current rejected) | gate | killed (16 / 292) |
| 8 | `poison-after-failure` | poison an earlier success after a later failure | screen | killed (23 / 142) |
| 9 | `omit-strict-older` | omit the strict-older comparison | gate | killed (11 / 292) |
| 10 | `reject-equal-times` | reject equal arrivals | gate | killed (19 / 292) |
| 11 | `reject-untimed-arrival` | reject untimed arrivals | gate | killed (11 / 292) |
| 12 | `import-prevclose-from-rejected` | import previousClose from a rejected older record | gate | killed (6 / 292) |
| 13 | `restore-prop-sources` | restore controller-off prop sources | screen | killed (12 / 142) |
| 14 | `accept-retired-position-callback` | accept retired position callbacks | gate | killed (2 / 246) |
| 15 | `accept-retired-snapshot-callback` | accept retired snapshot callbacks | useAgentBattle | killed (1 / 11) |
| 16 | `terminal-states-loading` | leave terminal states loading | screen | killed (2 / 142) |
| 17 | `details-by-symbol` | EQUIVALENT (recorded): key the open view's validity by symbol — a changed position always restarts with no quote, so the status check closes the view in the same render | screen | **survived** (equivalent) (0 / 142) |
| 18 | `merged-wsprice` | pass the merged price map into controlled wsPrice | screen | killed (1 / 142) |
| 19 | `nonheld-bypass-admission` | let non-held navigation bypass held admission | research modal | killed (3 / 22) |
| 20 | `block-all-nonheld` | block all non-held research | screen | killed (1 / 142) |
| 21 | `held-price-fill-modal` | enable a held-price fill | research modal | killed (10 / 22) |
| 22 | `held-price-poll-hook` | enable a held-price poll | useResearchData | killed (6 / 46) |
| 23 | `unavailable-numeric-defaults` | pass unavailable through numeric defaults | TacticalRow | killed (46 / 164) |
| 24 | `omit-consumer-avatar` | omit a consumer | screen | killed (1 / 142) |
| 25 | `omit-consumer-scoreheader` | omit a consumer (legacy header) | screen | killed (5 / 142) |
| 26 | `separate-renders-label` | update labels and scores in separate renders (counter not keyed: old-source ramp) | ArenaHeader | killed (4 / 183) |
| 27 | `require-lastscoredat` | require lastScoredAt for complete active quotes | gate | killed (21 / 246) |
| 28 | `constructor-zeros` | accept constructor zeros without a time | gate | killed (8 / 246) |
| 29 | `stored-time-now` | replace stored time with now | gate | killed (5 / 246) |
| 30 | `enable-while-off` | enable new behaviour while off | featureFlags | killed (5 / 16) |
| 31 | `enable-for-excluded` | enable new behaviour for an excluded battle | gate | killed (8 / 256) |
| 32 | `b11-instant-value-only` | [B-11] run the instant reset only when value changes | AnimatedScore | killed (1 / 18) |
| 33 | `v1-effect-sync` | [V-1] sync instant via an effect (first commit shows the old value) | AnimatedScore | killed (4 / 18) |
| 34 | `v1-no-generation-guard` | [V-1] drop the generation guard | AnimatedScore | killed (1 / 18) |
| 35 | `v1-keep-transition` | [V-1] keep the CSS transition on the instant render | AnimatedScore | killed (3 / 18) |
| 36 | `v1-cleanup-default-effect` | [V-1] add a cleanup to the default value effect | AnimatedScore | killed (6 / 18) |
| 37 | `v2-zero-duration-only` | [V-2] a zero-duration transition only, no same-commit width | ArenaHeader | killed (6 / 183) |
| 38 | `v3-no-context-switch` | [V-3] no instant on a context change | gate | killed (5 / 287) |
| 39 | `v4-null-score-keys` | [V-4] pass null score keys | gate | killed (5 / 246) |
| 40 | `c1-round-stored` | [C-1] round a stored pair to whole numbers | gate | killed (22 / 287) |
| 41 | `c1-tie-as-player` | [C-1] use >= (tie as player lead) for the gated tint | gate | killed (6 / 145) |
| 42 | `c1-bar-from-helper` | [C-1/B-1] derive the gated bar from computeTugOfWarWidth for every pair | gate | killed (6 / 246) |
| 43 | `b1-signed-for-nonneg` | [B-1] use the signed formula for non-negative pairs | gate | killed (1 / 145) |
| 44 | `c1-threshold-raw` | [C-1] compare the threshold on raw values | AnimatedScore | killed (1 / 18) |
| 45 | `c1-skip-negzero` | EQUIVALENT (recorded, test-integrity F4): [C-1] skip the -0.00 normalization — Math.round leaves only -0, and (-0).toFixed(2) is "0.00" with -0 >= 0 | AnimatedScore | **survived** (equivalent) (0 / 122) |
| 46 | `c1-format-without-fd` | [C-1] change formatting when fractionDigits is absent | AnimatedScore | killed (14 / 18) |
| 47 | `c1-browser-two-decimals` | [C-1] format browser pairs with two decimals | gate | killed (16 / 287) |
| 48 | `b3-tied-equal-digits` | [B-3+] show "Tied" for equal digits with different stored values | gate | killed (2 / 104) |
| 49 | `b3-margin-from-stored` | [B-3+] compute margins from stored values | gate | killed (1 / 104) |
| 50 | `b4-noauth-empty` | [B-4] stamp no-auth as empty | useAgentBattleId | killed (2 / 175) |
| 51 | `b5-fromcache-confirmed` | [B-5] treat empty fromCache:true as confirmed | useAgentBattleId | killed (6 / 175) |
| 52 | `c4-omit-metadata` | [C-4] omit includeMetadataChanges with the flag on | useAgentBattleId | killed (6 / 175) |
| 53 | `c4-options-when-off` | [C-4] pass an options object with the flag off | useAgentBattleId | killed (10 / 33) |
| 54 | `c4-downgrade-confirmed` | [C-4] downgrade a confirmed empty on a later fromCache:true event | useAgentBattleId | killed (2 / 175) |
| 55 | `c2-settle-unchanged-id` | [C-2] settle on an unchanged ID / accept retired-generation evidence | useAgentBattleId | killed (11 / 175) |
| 56 | `c2-missing-lookup-settled` | [C-2] treat a missing lookup as settled | gate | killed (1 / 104) |
| 57 | `c2-lookup-on-direct` | [C-2] consult lookup on the direct-ID route | gate | killed (113 / 246) |
| 58 | `static-face-reactive` | [static legacy face] leave the pane-off face reactive in admitted battles | screen | killed (4 / 142) |
| 59 | `b7-prior-session-patch` | [B-7] patch a prior-session bar with today's extremes | useResearchData | killed (1 / 24) |
| 60 | `b8-priority2-et` | [B-8] select Priority 2 by ET date for crypto | useResearchData | killed (2 / 46) |
| 61 | `b9-entry-return-change` | [B-9] send the entry-relative return as change | research modal | killed (5 / 22) |
| 62 | `b10-show-scaffold-open` | [B-10] show the scaffold's open on hover | StockChart | killed (3 / 24) |
| 63 | `b10-aggregate-scaffold-open` | [B-10] aggregate the scaffold's open | StockChart | killed (1 / 24) |
| 64 | `b10-synth-body` | [B-10] draw a synthesized open as a body in controlled mode | useResearchData | killed (8 / 24) |
| 65 | `b10-scaffold-outside` | [B-10] apply the scaffold outside controlled held research | StockChart | killed (6 / 24) |
| 66 | `v6-only-tdc` | [V-6] substitute supplied extremes only in todayDailyCandle | useResearchData | killed (9 / 24) |
| 67 | `v6-zero-open-close` | [V-6] write open: 0 / close: 0 in controlled mode | useResearchData | killed (6 / 46) |
| 68 | `e1-lastcandle-open` | [E-1] fall back to the last candle's open in controlled mode | StockChart | killed (4 / 24) |
| 69 | `e1-1w-today-open` | [E-1] show today's open as the week's in 1W | StockChart | killed (2 / 24) |
| 70 | `e1-close-colour` | [E-1] colour the close from a missing open | OHLCDisplay | killed (5 / 24) |
| 71 | `a5-rewrite-same-position` | [A-5/V-8] treat the nightly rewrite as the same position | gate | killed (2 / 246) |
| 72 | `v9-future-invalidates-price` | [V-9] let a future timestamp invalidate the price | gate | killed (2 / 246) |
| 73 | `a4-clear-excluded-on-error` | [A-4] clear an excluded battle on a later error | gate | killed (3 / 246) |
| 74 | `guard-motion-literal` | [guards] a raw transition literal in the registered helper | gate | killed (1 / 81) |
| 75 | `guard-core-hex` | [guards] a core-palette hex in the registered helper | gate | killed (1 / 91) |
| 76 | `loading-indicator-markup` | [OFF-6] change the shared loading indicator markup | screen | killed (2 / 142) |
| 77 | `shell-error-any-generation` | [C-2] show no error identity on the unavailable shell | screen | killed (3 / 142) |
| 78 | `arena-extra-slot` | [OFF-6] an extra child slot in the ArenaHeader container (SSR useId shift) | ArenaHeader | killed (1 / 41) |
| 79 | `a4-memory-kept-across-ids` | [A-4/F-1] keep the exclusion memory when another ID is requested | screen | killed (4 / 142) |
| 80 | `a4-lookup-error-teardown` | [A-4/F3] tear an excluded battle down on its lookup error (drop the legacy retention) | screen | killed (1 / 142) |
| 81 | `a4-gate-no-fallthrough` | [A-4/F3] resolveGate: a lookup error is unavailable even for the excluded requested ID | gate | killed (2 / 246) |
| 82 | `a4-hold-without-legacy-retention` | EQUIVALENT (recorded): drop the `excludedFor === queriedId` conjunct — the fallback returns queriedId itself | screen | **survived** (equivalent) (0 / 142) |
| 83 | `a4-hold-excluded-not-retained` | [A-4/F3] hold the EXCLUDED id on any lookup error, even where legacy drops it (unconfirmed empty) | screen | killed (1 / 142) |
| 84 | `batch-one-failure-poisons-all` | [§4.3 rule 2] one rejected batch call withholds BOTH kinds | screen | killed (2 / 142) |
| 85 | `ws-gated-subscribe` | [§4.2/§3.1] subscribe the WebSocket hook on the gated path | screen | killed (1 / 142) |
| 86 | `refC-MUT-A-ws-into-scoring` | [§4.2] a bare WebSocket overlay reaches gated scoring (screen merge) | screen | killed (1 / 142) |
| 87 | `refC-HOIST-ONLY-control` | CONTROL: the hoist alone must change nothing (expected SURVIVED) | screen | **survived** (control) (0 / 142) |
| 88 | `refC-MUT-B-tie-as-player` | [C-1/P8] legacy ScoreHeader tints a tie as a player lead | screen | killed (2 / 142) |
| 89 | `refC-MUT-B2-tie-as-cpu` | [C-1/P8] legacy ScoreHeader tints a tie as a CPU lead | screen | killed (2 / 142) |
| 90 | `refC-MUT-C-retired-evidence` | [C-2] accept evidence from a retired generation (screen-level guard) | useAgentBattleId | killed (7 / 175) |
| 91 | `refC-MUT-D2-legacy-no-key` | [V-2] legacy header: no remount on a switch | screen | killed (2 / 142) |
| 92 | `refC-MUT-D3-legacy-no-initial` | [V-2/B-12 NC2] legacy header: remount without initial={false} | screen | killed (4 / 142) |
| 93 | `refC-MUT-D4-legacy-remount-always` | [V-2] legacy header: remount on every render (same-kind spring lost) | screen | killed (2 / 142) |
| 94 | `refB-evidence-flag-off` | [C-2/ON-ID 9] run the lookup-evidence machinery without the opt-in (flag-off extra commits / render pass / lookup key) | useAgentBattleId | killed (7 / 175) |
| 95 | `refD-F7-cpu-stale-details` | [ON-F2a] a CPU detail keeps using the last accepted (stale) tuple | screen | killed (2 / 142) |
| 96 | `refD-F8-cpu-lineage-no-swap-id` | [ON-F2b/§3.2] the CPU lineage drops the swap identity (same-symbol re-entry at an identical price = same position) | gate | killed (1 / 246) |
| 97 | `refD-F11a-fuse-in-unavailable` | [ON-ROW] re-enable the fuse in the unavailable row | TacticalRow | killed (3 / 164) |
| 98 | `refD-F11b-double-banked` | [ON-ROW/ON-VALID] the gated browser total adds the banked points twice | screen | killed (2 / 142) |
| 99 | `hook-drop-active-guard` | [C-2] accept a retired listener's queued callback (drop only the `active` guard; the generation check stays) | useAgentBattleId | killed (1 / 175) |
| 100 | `omit-consumer-pane` | omit a consumer (the character pane) | screen | killed (4 / 142) |
| 101 | `omit-consumer-arena` | omit a consumer (ArenaHeader) | screen | killed (31 / 142) |
| 102 | `details-by-symbol-resolver` | [§7.2] key details by symbol only: resolve a row click by symbol, ignoring the row's position key | gate | killed (1 / 246) |
| 103 | `d1-generation-blind-to-opt-in` | [C-2] the generation ignores an un-gated phase (query → direct → query returns to the retired generation) | useAgentBattleId | killed (5 / 175) |

**Recorded equivalents.** `c1-skip-negzero` — after `Math.round(v·100)/100` the only negative zero is `-0`, and `(-0).toFixed(2)` is `"0.00"` with `-0 >= 0`, so the output is `+0.00` with or without the guard (test-integrity F4); the guard stays as defensive code. `a4-hold-without-legacy-retention` — the fallback returns the legacy-retained `queriedId` itself, which can only be null (same outcome) or the excluded ID while the memory is set. `details-by-symbol` — a changed position always restarts with no quote, so the status check closes the open view in the same render; the obligation it names is pinned at the click resolver (`details-by-symbol-resolver`). The control `refC-HOIST-ONLY-control` moves a block without changing behaviour and must survive.

**Other mutation evidence in this review** (each in its reviewer's own snapshot, every file restored and hash-verified): the test-integrity lens ran 41 mutations of its own; refuter A, 3 fix variants (including the unsafe F3-only fix); refuter B, the review-tree hook and header against the new OFF rows; refuter C, 8 characterization mutants; refuter D, 5; refuter E, the D-1 fix reverted; the delta reviewer, 23 against the new rows. Every mutant that revealed a gap during the review is in the catalogue above, killed by the row added for it.

## 9. Residuals, pre-activation checks and separate tasks

**Deviations from the contract's wording (each keeps a stronger requirement of the same contract).**
- **C-2 / B-6 — lookup evidence is opt-in.** The contract adds `lookup` to every `useAgentBattleId` call and allows one extra render pass flag-off (B-6), while also requiring "no extra commit" (C-2) and flag-off commit parity (ON-ID 9). Review showed evidence writes alone commit the calling screen flag-off (off-state F2 and the `nullToNull` case). The evidence now runs only behind `{ confirmCache: true }` — the gated screen's existing query-path call — and the hook is otherwise the pre-build hook (same return shape, render passes, commits and listener call). The direct-ID route therefore gets no `lookup` (the contract says it ignores `lookup` entirely); a gated caller that failed to opt in would fail closed to the pending shell (ON-ID 8). The build's former known residual (one extra flag-off commit in `nullToNull`) no longer exists. With the flag on, the generation also advances when the opt-in flips (delta D-1), which adds one render pass — no commit — on a query ↔ direct switch.
- **No WebSocket symbol subscriptions of its own on the gated path.** Adopted from refuter C as hardening of §4.2 and §3.1 ("issue no quote request built from opening props"): the gated path passes the hook an empty list, so this screen subscribes no symbols; flag-off and excluded battles make the shipped call. *Corrected 2026-10-02 (final independent review, F2): this bullet previously said the non-held research modal then receives no `wsPrice`, which overstated the consequence.* The empty list stops only the screen's own subscriptions (`src/hooks/useWebSocketPrices.js:44`). The hook keeps its price listener and its flush interval (`:79`, `:92`), so it still consumes the shared manager's price events for other subscribers' symbols, and the gated non-held research modal still receives its effective price, a WebSocket price included (`src/screens/AgentBattleScreen.jsx:3436`). Held positions stay protected: gated held scoring reads only the accepted REST quote (`q.accepted.price`), and the controlled held view receives no `wsPrice`. The checked-in transport endpoint returns a disabled transport (`api/ws-config.js:40`). No shared socket-hook change was made (§12).

**Residuals (known, disclosed, not fixed here).**
1. **ChartHeader `0.00%` pill** (out-of-scope file): in controlled research it renders `percentChange || change || 0` until the research hook's daily change loads.
2. **Crypto timestamps** are normalized as Unix seconds explicitly (V-11); units are unverified against the live provider.
3. **Crypto classification differs** between the screen (33 symbols) and the modal/hook/chart (100): 67 symbols are crypto to the modal only. If such a symbol were held, the screen would poll it as a stock and its ET-dated extremes would be dropped (never misdated) between 8 PM and midnight ET. No wrong number; whether a held position can carry such a symbol is a pick-universe question.
4. **The stored-time label has no year** ("Oct 1, 12:47 PM EDT"): a pair last scored in an earlier year reads like this year's.
5. `comparison.accessibleText` is built but unused (the DOM text carries the same content); three consumers derive the duel inline rather than calling `duelFor` (rows assert all four agree).
6. **Colours copied for parity** in new branches, with no `--ft-*` token to consume: the unavailable row's clickable symbol keeps the shipped `#14b8a6`, and the gated CPU counter keeps the legacy `tokens.textFaint || '#64748b'` fallback (both non-core, outside the token guard's palette).
7. **Test notes:** capture mode asserts nothing (no live risk: nothing sets `SHADOW_OFF_CAPTURE_DIR`); ON-F5a is probed per commit at the screen (frames are stepped in `AnimatedScore.instant.test.jsx`); the proxy suite hand-rolls the client's `parseFloat || 0` (the real path is covered by the service suite); the "−0.00" guard is an equivalent mutant.
8. **Excluded → admitted on a live document (delta Q-1):** if a live battle document ever changed from an excluded mode to an admitted one after a lookup error, the gate would take the gated path while the lookup is in error. Unreachable with today's writers; recorded for the founder as a wording question.
9. **Lifecycle F-1 was latent under today's navigation**: `App.jsx` reaches the battle screen through another screen, which remounts it; the in-place A→B→A the contract supports is now handled regardless.

**Pre-activation checks** (required before any flag flip; none was run in this build, by design):
1. **Real-browser paint of the legacy `ScoreHeader` bar** on a comparison switch, in the pane-off and tabbed layouts. The screen suite now renders that bar with the real framer-motion and checks the committed width per commit, but jsdom does not paint.
2. **The full gated screen in a real browser**, from a local dev build with the constant flipped and never committed: pending, "No active battle", "Battle unavailable", admission and exclusion, switches between browser and stored pairs, unavailable rows, held research containment and the notice.
3. **Firestore WebChannel behaviour for C-4** in a browser: an offline start, then recovery from "Battle unavailable" (`unconfirmed-empty`) to "No active battle" or to a battle; the raise logic is verified, but browser online detection and reconnection timing are not (≈104 s was observed on the emulator).
4. **Provider behaviour against the live service:** after-hours timestamps, `"NA"`, crypto timestamp units and crypto high/low session semantics.
5. **A visual pass of the bomb view's scaffold candle** (its pixel footprint could not be attributed in the browser check).
6. **Firestore `-0` round-trip** for stored scores (the formatter normalizes it regardless).
7. **The flip PR reconciles its own pins in the same commit** (BUILD_RULES §2): the false pin in `src/config/shadowCpuQuoteIntegrityFlags.test.js`, the `DARK_BY_DESIGN` entry and the default-off prose in `featureFlags.js`.

**Separate tasks, outside this build** (as authorized): entry timing; the swapped-position entry question (a separate read-only investigation, contract §10.3); server scoring, settlement and the server-side substitution path (R-4); League; shared-pricing redesign; the ChartHeader pill; unifying crypto classification.

## 10. Correction after the draft PR: the CI lint gate

**What failed.** On the draft PR, the `Tests` workflow (`.github/workflows/tests.yml`; run 37041212893, job 110951501700, as reported by the founder) stopped at its first step after install, `npm run lint:gate` (`eslint.gate.config.js`: only `no-undef` and `react-hooks/rules-of-hooks`, `--max-warnings 0`), so the unit suite never ran in CI. All three errors are `react-hooks/rules-of-hooks`, all in test harnesses this build added. Reproduced locally at `fd80eb5b` exactly as reported (exit 1, "3 problems (3 errors, 0 warnings)"):

| Site | Rule message | Cause |
|---|---|---|
| `src/hooks/useAgentBattleId.lookupEvidence.test.jsx:701`, columns 25 and 60 (two errors) | `React Hook "useAgentBattleId" is called conditionally.` | The (9) [B-6] row's `Counting` component picked one of two hook calls with a ternary: `gated ? useAgentBattleId(agentId, GATED) : useAgentBattleId(agentId)`. Every render made exactly one call to the same hook, so the row behaved correctly, but the rule rightly rejects the shape. |
| `src/screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx:173` | `React Hook "React.useEffect" is called in function "default" that is neither a React function component nor a custom React Hook function.` | The `AssetResearchModal` mock's component was an anonymous arrow function under the `default` key, so the rule could not recognize it as a component. |

**Why the build's own validation missed it.** §5 and §8 ran the full suite, the build's suites, both theme guards, the mutation pass and `vite build`, but not `npm run lint:gate`, which CI runs before the unit suite. This correction ran it before and after.

**The correction.** Two test files, both already in the build's inventory (§2). No production file, assertion, OFF reference, lint rule or ESLint configuration changed, and no suppression was added.
- `src/hooks/useAgentBattleId.lookupEvidence.test.jsx:701-704`: the options are selected first (`const options = gated ? GATED : undefined;`) and the hook is called once, unconditionally (`useAgentBattleId(agentId, options)`), the shape the file's `Probe` harness already uses (`:96`). `undefined` takes the hook's `{ confirmCache } = {}` default (`src/hooks/useAgentBattleId.js:39`), so the flag-off render still makes the legacy call.
- `src/screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx:161`: the mock's component is now a named function component, `ResearchModalRecorder` (like the file's `FaceRecorder`); its body is unchanged.

The fix was pushed first, as `79202075`, after the lint gate and the two edited suites passed; its diff from `fd80eb5b` is byte-identical to the working-tree diff validated below. This record follows in the next commit.

**Validation of the correction** (the corrected tree, `fd80eb5b` plus the two edits; every run sequential):

| Check | Result |
|---|---|
| `npm run lint:gate` | Before: exit 1, the 3 errors above. After: **exit 0, 0 problems.** |
| The edited suites | `useAgentBattleId.lookupEvidence.test.jsx` 33 and `AgentBattleScreen.quoteAvailability.jsdom.test.jsx` 142 tests, all passing (the same counts as before). |
| Full suite, with CI's command and worker count (`CI=true npm run test:run -- --maxWorkers=2`) | **836 test files, 17,041 tests: 16,977 passed, 0 failed, 64 skipped.** Compared test by test (file, full name and status) with the final run in §5: identical — 0 missing, 0 added, 0 status changes. |
| `vite build` | Passes (`npx vite build`, ✓ built in 23.8 s). Its 18 warning lines (four CSS syntax warnings, 13 dynamic-import notices and the chunk-size notice) are identical to those of a build of the base SHA (`git archive 44d0c63e`), so none comes from this build. §5 previously named only the chunk-size notice and is corrected. |
| Affected mutants | Every catalogue entry whose named suites include either edited file: **67 of the 103**, re-run on a fresh snapshot of the corrected tree. **64 / 64** non-equivalent mutants killed; the 2 recorded equivalents among them (`details-by-symbol`, `a4-hold-without-legacy-retention`) and the control (`refC-HOIST-ONLY-control`) survive as expected. Compared with the final pass in §8, every mutant has the same status, the same failed / run counts and the **same set of failing tests** (534 failing tests compared). Restore diff: 0 lines. |
| Node version | Local runs use Node 22.22.0; CI uses Node 20. The build's diff uses no JavaScript API newer than Node 20 (searched for the later `Promise`, grouping, `Set`, iterator and array additions; only `Array.prototype.at`, available since Node 16.6, appears). **Incomplete, corrected in §11:** the search covered JavaScript built-ins, not the Web globals Node 21+ adds (`navigator`, `WebSocket` …), and the next CI run failed on exactly such a global. |

**Scope.** Unchanged: 38 implementation/support files + this record = 39. The correction edits two of the 38, and this record.

## 11. Second correction after the draft PR: Node 20, CI's runtime

**What failed.** At `b6931e23` the lint gate passed in CI and the unit suite failed (run 37056510281, job 111002424534, as reported by the founder) on one row: `src/components/BaggerBomb/TacticalRow.currentPrice.render.test.jsx` › "the click payload names the side only when the screen opts in (the legacy callback is untouched)", with `ReferenceError: navigator is not defined` while importing `react-dom/client`. CI runs Node 20 (`actions/setup-node` with `'20'`, which resolved to 20.20.2 in that run, as reported). Every local run in §5, §8 and §10 used Node 22.22.0.

**Reproduced** under Node 20.20.2 (the official linux-x64 build from nodejs.org, its SHA-256 checked against the release's `SHASUMS256.txt`) with CI's command: exactly that failure (the file: 1 failed, 21 passed), thrown at `node_modules/react-dom/cjs/react-dom-client.development.js:27998`.

**Cause.** The row runs in Vitest's default Node environment and installed a JSDOM `window` and `document` by hand before importing `react-dom/client`. Once `window` exists, React DOM's development build reads `navigator.userAgent` at import (for its DevTools notice). Node 21+ has a global `navigator`, so the row passed on Node 22; Node 20 has none, so the import throws. The row also left `IS_REACT_ACT_ENVIRONMENT` set after it finished, and "restored" `window` and `document` by assignment, which leaves them defined (as `undefined`) instead of absent. It is the only test in this build that installs JSDOM by hand; the build's other DOM suites use `@vitest-environment jsdom`, which supplies `navigator` itself.

**The correction** (`src/components/BaggerBomb/TacticalRow.currentPrice.render.test.jsx:22`, `:274-282`, `:303-304`). Inside the row's `try`, before `react-dom/client` is imported, `vi.stubGlobal` installs `window`, `document`, `navigator` (JSDOM's) and `IS_REACT_ACT_ENVIRONMENT`. The `finally` calls `vi.unstubAllGlobals()`, which in the pinned Vitest 4.0.17 puts back each global's original property descriptor, or deletes the global if it was absent. This is the repository's idiom for test globals (34 other test files use `vi.stubGlobal`). JSDOM's `navigator` is installed under every Node version, so the row sees the same environment on 20 and on 22. No production file, assertion, OFF reference, lint rule, ESLint configuration or CI setting changed, and no test is skipped. The fix is commit `02bacdd4`, whose diff from `b6931e23` is byte-identical to the working-tree diff validated below; this record follows in the next commit, and both were pushed together after the validation.

**Restoration, verified** on a scratch copy of the file with a probe row added after it, under both runtimes. The stubs were live while the row ran. Afterwards every descriptor equals the one recorded before it ran: on Node 20.20.2 all four globals are absent again; on Node 22.22.0 the native `navigator` accessor is back (the same getter and setter) and the other three are absent. Negative control: the same probe with `vi.unstubAllGlobals()` removed fails (`window presence`) on both runtimes.

**Validation under Node 20.20.2** (npm 10.8.2; runs sequential; the corrected tree is `b6931e23` plus this edit):

| Check | Result |
|---|---|
| The failing file | Before: 1 failed, 21 passed (the `ReferenceError`). After: **22 / 22 passed**, also under Node 22.22.0. |
| `npm run lint:gate` | exit 0, 0 problems. |
| Full suite, CI's command (`CI=true npm run test:run -- --maxWorkers=2`), **no Chromium**, as on CI's runner (`CHROMIUM_PATH` pointed at a missing path; the container's Playwright variables unset) | **836 files, 17,041 tests: 16,954 passed, 0 failed, 87 skipped**, CI's 87. Against the Node 22 run of §10, test by test: 0 missing, 0 added, exactly 23 status changes, all passed → skipped, all in the three Chromium files below. |
| Full suite, CI's command, Chromium available | **17,041 tests: 16,977 passed, 0 failed, 64 skipped**; identical, test by test, to the Node 22 run of §10. |
| `vite build` | Passes (✓ built in 21.5 s), with the same 18 warning lines as the base SHA's build (one prints in a different position). |
| Affected mutants | The catalogue entries that use the corrected file, `unavailable-numeric-defaults` and `refD-F11a-fuse-in-unavailable`: killed, each failing the same tests as in the final pass (46 / 164 and 3 / 164). The corrected row had no mutant of its own, so six were added, each one edit in `TacticalRow.jsx`: the side passed without the opt-in; the sides swapped; the side dropped at the unavailable call site; dropped at the usable one; the opt-in not forwarded to the player side; not forwarded to the CPU side. **6 / 6 killed under Node 20.20.2 and under Node 22.22.0**, each by an assertion failure in exactly the corrected row (1 / 22). Restore diff: 0 lines. |
| Installed packages | The same lockfile-installed `node_modules` as every other run. Its six native addons (Rollup, Lightning CSS, Tailwind Oxide) are N-API prebuilt binaries, which do not depend on the Node version. |

**The skipped tests, accounted for.** Locally 64 tests are skipped; in CI, 87. None of the files below is part of this build, and all predate the base SHA.

| Skipped | Where | What it needs to run | CI | This container |
|---|---|---|---|---|
| 23 | `src/components/Forge/workshop/character/CharacterArea.bounds.browser.test.jsx` (6), `src/components/League/battleArena/AgentDock.bounds.browser.test.jsx` (4), `src/components/League/battleArena/mobileHero.bounds.browser.test.jsx` (13) | A Chromium executable at `CHROMIUM_PATH`, or at `/opt/pw-browsers/chromium` when that is unset (`describe.skipIf(!hasBrowser)`). Each renders components with `renderToStaticMarkup`, opens the markup in headless Chromium through `playwright-core` (`--no-sandbox`; `CharacterArea` writes its pages to a temporary directory) and measures real layout. No dev server, no network. Added in PR #869 (`35b38df9`, 2026-09-18). | skipped: the runner has no Chromium at either path | run and pass: Chromium ships at `/opt/pw-browsers/chromium` |
| 58 | `firestore.rules.emulator.test.js` | `FIRESTORE_EMULATOR_HOST`, a running Firestore emulator. `npm run test:rules` runs it; the `Tests` workflow deliberately does not. | skipped | skipped |
| 2 | `src/screens/__golden__/captureFlagOffGolden.test.jsx`, `src/screens/__golden__/captureControllerOnGolden.test.jsx` | `GOLDEN_OUT_DIR` (golden-capture runs only) | skipped | skipped |
| 4 | `api/_utils/agentGuardrails.test.js` (2), `api/agent/log-rule-compat-event.off.test.js` (1), `api/agent/set-rule-hardness.off.test.js` (1) | The other flag state: `PROFIT_TARGET_EXECUTOR_ENABLED` false, `RULE_COMPAT_MODE` `'off'`, `FORGE_HARDSOFT_AUTHORING_ENABLED` false | skipped | skipped |

The 23 Chromium tests depend only on the runner's environment, so by the same condition they would skip in CI for any branch, `main` included. Nothing in this build needs a browser in CI.

**Correction to §10.** §10's Node row said the build's diff used no JavaScript API newer than Node 20. That search covered JavaScript built-ins only, not the Web globals Node 21+ adds (`navigator`, `WebSocket` …), and this failure was exactly such a global. The definitive check is now the full suite under Node 20.20.2 itself, above.

**Scope.** Unchanged: 38 implementation/support files + this record = 39. The correction edits one of the 38 (the TacticalRow test) and this record.

## 12. Third correction: the final independent review (F1, F2) and its delta review

A final independent read-only review of `1e2ac4e2` (founder-supplied, 2026-10-02) returned **HOLD** on one finding, F1 (P2, CONFIRMED), with a documentation finding, F2 (P3). Both are resolved here. The mandatory review of the production fix (BUILD_RULES §2) then confirmed five further gated-path gaps, all pre-existing and all fixed. Commits: `ca2953ef` (the F1 fix, its rows, the F2 wording), `9ec1ea8b` (the delta review's follow-ups), `a0b0c449` (the follow-ups' own delta review, D-1), then this record. The flag stays `false`.

### F1 — an admitted battle with a malformed portfolio could crash instead of staying gated and incomplete

**Contract.** §3.1: an admitted battle with missing or malformed portfolios stays gated and incomplete, never an escape to legacy. §5.2: empty or malformed portfolios are not an all-cash success.

**Reproduced before any edit**, on a scratch copy of the screen suite with the real screen and real subscription hooks, under Node 20.20.2. Each contract case was run for both sides, with the controller on and off, and with the opening prop either well formed (the review's fixture) or mirroring the malformed document (as a client snapshot of that document would be): 88 cases.

| Variant at `1e2ac4e2` | Result |
|---|---|
| Controller on, well-formed prop; a tier that is an object, a string or a number (either side) | `TypeError: (portfolio[tier] \|\| []).forEach is not a function` at `src/screens/AgentBattleScreen.jsx:1246:33` (the legacy symbol loop) when the document arrives: 6 cases |
| Controller off, well-formed prop (the review's controls) | All 22 render gated and incomplete, with the qualified stored pair |
| Prop mirroring the document, controller on or off; the same three tier cases | The same `TypeError`, thrown **at mount**: the pending shell itself crashed, because the legacy loop read the opening prop. This variant was not in the review. 12 cases |
| Missing, null or empty portfolio; a string or array portfolio; every tier empty; a non-object or unnamed position | No crash; gated and incomplete |

With only the symbol loop guarded (scratch), the same cases then threw `(p.star || []).map is not a function` in the two legacy enrichment memos (`:1409` and `:1441` at `1e2ac4e2`). All three calculations crashed independently; with all three guarded, all 88 cases rendered gated and incomplete.

**Cause.** On the gated path the screen discards three legacy results — `allSymbols` (the socket gets `NO_WS_SYMBOLS`, the poll plans from the identified context) and both `legacyEnriched*Portfolio` memos (the rows come from `gatedEnriched`) — but still computed them, assuming array tiers, over the subscribed document (controller on) or the opening prop (controller off, and the pending shell). The gate helper's context builder was already safe (`portfolioValid`, `src/screens/battleView/shadowCpuQuoteIntegrity.js:367`). The roster, deploy-plan and content-stable helpers were read and are safe for these inputs.

**The fix.** Each of the three memo bodies returns a stable empty value whenever `gatedPath` is true (pending, the terminal shells or admitted), and `gatedPath` joins each memo's inputs: `NO_LEGACY_SYMBOLS` (`src/screens/AgentBattleScreen.jsx:366`), the symbol loop (`:1282`, inputs `:1293`), the player enrichment (`:1449`, `:1457`) and the CPU enrichment (`:1483`, `:1491`). Every hook is still called on every render. With the flag off, or for an excluded battle, `gatedPath` is false: the shipped code runs unchanged and the added input is a constant, so recomputation timing is unchanged. Malformed portfolios still fail `portfolioValid`, so the comparison stays incomplete: the qualified stored pair, else "Comparison unavailable"; a completed battle shows its stored final; never complete, never all-cash.

**Regression rows** (screen suite, real screen; `src/screens/AgentBattleScreen.quoteAvailability.jsdom.test.jsx:4361` onward):

| Rows | What they pin |
|---|---|
| The review's fixture (`:4402`), 4 | Player and CPU star tier an object, controller on and off, well-formed prop: pending, then admitted; the qualified stored pair ("Last scored … · browser quotes incomplete", `+12.40` / `+3.10`); only the identified document's held symbols are requested, never the prop's star; no socket symbols |
| Every contract case (`:4428`), 44 | Eleven missing/malformed cases × both sides × both controller states, the prop mirroring the document: the pending shell builds nothing; admitted; requests equal the named non-cash positions in the array tiers; no socket symbols; incomplete before and after a poll — even when every polled quote is genuine |
| No stored pair, completed (`:4457`), 4 | "Comparison unavailable" with no digits and no bar; a completed battle shows its stored final |
| Parity (`:4479`), 4 | Flag off and excluded (a group stamp), controller on: the same documents still throw exactly as at the base SHA — four new OFF references captured at `44d0c63e` (twice, byte-identical; re-captured by a reviewer), so the generated block now holds 19 |
| Pending → excluded, controller off (`:4501`), 1 | The excluded battle's screen text, requests and socket list equal flag-off's after a pending phase (the only row that sees `gatedPath` missing from the symbol list's inputs) |

On the unfixed screen 18 of these rows fail, every one with the review's `TypeError`: the 12 non-array-tier matrix rows, the 2 controller-on fixture rows and the 4 stored/completed rows. The other 39 pass on both screens: the cases that never crashed, which pin gated-and-incomplete, plus the parity and transition rows. On the fixed screen all pass.

### The delta review (BUILD_RULES §2)

Three independent lenses, each on its own snapshot (parity; gated-path completeness; test integrity), every finding handed to a refuter instructed to refute it with a concrete repro, then a delta review of the follow-up fixes with its own refuter.

| Finding | Claim | Refutation | Disposition |
|---|---|---|---|
| Lens A (parity) | No regression: a differential probe ran the fixed and unfixed screens through 64 scenarios (flag-off lifecycle, every exclusion, every transition into and out of excluded) — all equal; the ordered hook sequence is identical | — | Verified sound |
| A-N1, A-N2 | A malformed opening prop no longer crashes the gated pending shell; an excluded record then renders (controller on) or throws at classification (controller off) | Facts CONFIRMED; the "parity violation" reading REFUTED: the difference lies only in the gated pending state, which by §3.1 builds nothing from the opening prop; after classification the excluded view deep-equals flag-off's | Recorded (behaviour notes) |
| A-N3 | The gated path no longer calls `enrichAsset` in the discarded memos | CONFIRMED unobservable | — |
| **B-1** (major) | A slot that vanishes (a malformed tier, or a valid tier that shrinks) and returns holding another position restarts at lineage generation 1; its token repeats the retired one and the retained quote prices the new position — complete, with the wrong price | **CONFIRMED** with the refuter's own repro (shrink and regrow, no malformed data: XOM priced at TSLA's `$255.00`, comparison `browser`); the in-flight-answer route REFUTED (the poll effect's cleanup drops it) | **Fixed** (below) |
| **B-2** (major) | A position whose symbol is not a string throws at render (an object) or crashes the screen on a row tap (a number, boolean or array) | **CONFIRMED**; flag-off identical | **Fixed** (gated) |
| **B-3** (minor) | A cash position with an object `previousAsset` throws at render | **CONFIRMED**; flag-off identical | **Fixed** (gated) |
| **B-4** (minor) | `isCash: 1` with a symbol is held and scored, yet its row reads CASH 0 pts (BUILD_RULES §9) | **CONFIRMED** (legacy also polls it, but scores and shows it consistently as cash) | **Fixed** (gated) |
| B-5 (note) | A whitespace-only symbol passes the helper's rule and is polled as `" "` | CONFIRMED; no throw, incomplete | Not fixed (the helper's rule; residual) |
| B-6 (note) | `trades: {}` throws at the screen's `bankedScore`, flag on and off | CONFIRMED | Not fixed: a document field outside the portfolio scope (separate task) |
| C-1 (minor) | "Never a default 0–0" asserted `not.toContain('+0.00')` on an empty list | CONFIRMED | Fixed: no digits and no bar |
| C-2 (nit) | A counter check skipped with the controller off, where it also holds | CONFIRMED | Fixed |
| C-3 (minor) | No row reached the terminal shells with a malformed opening prop; a guard narrowed to "admitted or pending" survived all 200 rows | CONFIRMED (it also threw on "No active battle") | Fixed: 6 rows (missing, error, confirmed-empty × controller on/off) |
| C-4 (note) | The request oracle restates the context's held rule | PARTIALLY CONFIRMED | Comment corrected |
| C-5 (nit) | The excluded parity rows see only the symbol-loop guard | CONFIRMED | Recorded: the memo guards' excluded behaviour is pinned by the OFF-7 rows and the transition row |
| Lens D (delta review of the follow-ups) | No regression; B-1…B-4 fixed on both sides; flag-off and excluded untouched | — | Verified sound |
| **D-1** (minor) | A held position with a non-string `name` reaches the controlled research view; the real modal renders it as text | **CONFIRMED** with the real modal: "Objects are not valid as a React child". The cited site was wrong: with `version={2}` the text renders in `src/components/Research/ChartHeader.jsx:59`, and after a "Why?" tap in `src/components/Research/WhyMovingPopup.jsx:438` | **Fixed** (gated) |
| D-2 (nit) | The B-4 row's title misdescribed its reference | CONFIRMED | Fixed |
| D-3, D-4 (notes) | A numeric `previousAsset` is now hidden on gated cash rows; a slot that returns with the same position also starts empty until the immediate re-poll | — | Recorded (intended) |

None of B-1…B-6 or D-1 is a regression of the F1 fix: each behaves identically on `1e2ac4e2`. B-1's malformed-interlude route was unreachable there only because the screen crashed first.

**The follow-up fixes** (screen only; never reached flag-off or for an excluded battle):
- **B-1:** when the lineage changes within the same battle generation, only the quotes whose slot the new lineage still has are kept (`keepLiveSlots`, `src/screens/AgentBattleScreen.jsx:320`, call `:1155`); a returning slot starts empty. The helper's token can still repeat for a returning slot (`reconcileLineage` forgets vanished slots); with no retained evidence and the poll effect's cleanup cutting in-flight answers, nothing can match it — a helper-side tombstone is recorded as a separate task (the helper is outside this correction's files).
- **B-2, B-3, B-4:** gated rows go through `gatedRowAsset` (`:334`, call `:1196`), which drops a non-string symbol, drops a non-string cash `previousAsset`, and sets a truthy-but-not-true `isCash` to false; a well-formed position comes back as the same object. The gated tap handler requires a string symbol (`:1710`).
- **D-1:** the controlled research view's name falls back to the symbol unless it is a non-empty string (`:2399`).

Rows (`:4562` onward): B-1 through a malformed interlude (controller on and off) and through a shrink and regrow, 3; B-2 four symbol types × both sides (render, tap and chat), 8; B-3 both sides with a string control, 2; B-4, 1; C-3, 6; D-1 (object, number, string control), 3. On `ca2953ef` 14 of the follow-up rows fail for the defects' own reasons and the C-3 rows pass by design (they kill the narrowed guard); on `9ec1ea8b` the two malformed D-1 rows fail; all pass now.

**Negative controls (mutation, Node 20.20.2, final tree).** Each guard removed or bent in a copy; the whole screen suite run against it:

| Mutant | Rows that fail |
|---|---|
| `f1-symbols-unguarded` — the legacy symbol loop runs on the gated path | 25 / 220 |
| `f1-player-enrichment-unguarded` / `f1-cpu-enrichment-unguarded` | 16 / 9 |
| `f1-guards-admitted-only` — pending and the terminal shells unguarded | 18 |
| `c3-guards-admitted-or-pending` — the terminal shells unguarded | 6 (the C-3 rows) |
| `f1-guards-on-excluded` — guards keyed on the flag: excluded battles lose their legacy list and rows | 10 |
| `f1-symbols-deps-blind` — `gatedPath` dropped from the symbol list's inputs | 1 (the pending → excluded row) |
| `b1-keep-vanished-evidence` | 3 |
| `b2-row-keeps-bad-symbol` / `b2-tap-accepts-any-symbol` | 8 / 8 |
| `b3-cash-keeps-bad-previous` / `b4-row-keeps-cash-flag` | 2 / 1 |
| `b2-b4-sanitizer-bypassed` | 11 |
| `ws-gated-subscribe-both` — both socket guards removed | 61 |
| `f2-nonheld-no-wsprice` | 1 |
| `d1-research-keeps-bad-name` | 2 / 223 |

Two survive by design and are recorded as equivalents. `f1-enrichment-deps-blind` drops `gatedPath` from the two enrichment memos' inputs: every `gatedPath` flip also switches `agentBattle` (`gatedFields` vs `battleHook`), so `enrichAsset` changes identity and both memos rebuild anyway; two reviewers tried to refute this and could not. The input stays, for correctness by construction. `ws-gated-subscribe`, the original single edit, is now redundant because the gated symbol list is also empty; its obligation is checked by `ws-gated-subscribe-both`. The in-suite parity rows are negative controls too: the same inputs, on the path without the guard, still throw exactly as at the base SHA.

### F2 — the WebSocket description

Corrected in §9 and in the verdict's Deviations row. The empty symbol list stops only this screen's own subscriptions. Verified in this session under Node 20.20.2 with the REAL hook and a fake socket manager: zero subscribe calls, one price listener, and after one flush interval the returned prices held `{ NVDA: 999 }` from a global event. A screen row (`:4528`) pins the consequence: a WebSocket price for a non-held name reaches non-held research as its effective price (`wsPrice` 111), while held scoring stays on the qualified REST quote (the comparison is the browser estimate, not the 999 overlay) and the controlled held view receives no `wsPrice`. No shared socket-hook change was made.

**Validation of the correction** (the final tree `a0b0c449`; Node 20.20.2; CI's command; runs sequential):

| Check | Result |
|---|---|
| The screen suite | **223 / 223** (142 before, plus 81 rows) |
| `npm run lint:gate` | exit 0, 0 problems; the full ESLint counts for the screen and its suite are unchanged from `1e2ac4e2` (all pre-existing) |
| Full suite, no Chromium (as on CI's runner) | **836 files, 17,122 tests: 17,035 passed, 0 failed, 87 skipped.** Against the Node 20 run at `1e2ac4e2`, test by test: 0 missing, 0 status changes, 81 added — the screen's new rows, all passing |
| Full suite, Chromium available | **17,058 passed, 0 failed, 64 skipped**; the same comparison: 0 missing, 0 status changes, 81 added |
| `vite build` | Passes (✓ built in 20.0 s), with the base SHA's 18 warning lines |
| Affected mutants | Every catalogue entry that edits the screen or names its suite: 82 on `9ec1ea8b`, plus `d1-research-keeps-bad-name` on `a0b0c449` — **78 / 78 non-equivalent killed**. The 4 recorded equivalents and the control survive (re-checked on `a0b0c449` with the D-1 rows in place). Restore diffs: 0. The catalogue now holds 120 entries; those touching neither the screen nor its suite are unaffected by this correction |

### Residuals and separate tasks added by this correction

- **Shipped (flag-off) behaviour, preserved by design:** the legacy path still throws on these malformed inputs — a non-array tier with the controller on, a non-string symbol (render or tap), an object cash `previousAsset`, an object `name` in research. Fixing the shipped path is a separate task.
- **The helper's repeating token** for a returning slot (above): harmless now, worth a tombstone in `reconcileLineage` (separate task).
- **Document fields outside the portfolio scope**, flag on and off: `trades: {}` throws at `bankedScore` (B-6); a malformed `scoring.thresholds` entry (even a numeric string) throws `baseThreshold.toFixed is not a function` in the real BaggerBomb tab of held research.
- **Display only:** a numeric-string or boolean entry price shows unformatted in research ("Baseline: $100."); a whitespace-only symbol is polled as `" "` (B-5).

**Pre-merge note (found after the validation, 2026-10-03).** `main` has moved to `e6a84445` (PR #924), which adds a flag inside `src/config/featureFlags.js` and a pin to `src/config/flagPinGuard.test.js`, two files this build also edits. A trial merge is textually clean, and `flagPinGuard.test.js` passes on the merged tree. But one of this build's own rows fails there: `src/config/shadowCpuQuoteIntegrityFlags.test.js:69` hashes the first 164,705 bytes of `featureFlags.js` against the base SHA's file (an append-only check), and #924's addition sits before this build's block (`expected '8a8251e9…' to be '2f5c438c…'`). The `Tests` workflow checks out the pull request merged into `main`, so this row is expected to be red there until it is reconciled. Two ways: merge `main` into the branch and restate the check against the merge base, or make the check over the pre-existing exports rather than a byte prefix. Not changed here: that test file is outside this correction's scope, so it is the founder's decision.

**Scope.** Unchanged: 38 implementation/support files + this record = 39. This correction edits the screen, the screen suite and this record only.
