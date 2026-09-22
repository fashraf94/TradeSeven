# Intraday calcVersion 2 — independent §2 adversarial review

**Verdict: DO NOT MERGE at `b13770ec`.** The new mixed-version exclusion filters counts and SMA/MACD aggregates, but mixed sessions still change the reported VWAP error and its rollups. R1 is a bounded correctness fix before merge. The post-close freeze, continuous-session boundary, historical v1 window, and definitions versioning otherwise survive the probes below. The launch-capacity and sampling issues have separate dispositions; they are not reasons to redesign this PR without a contract change.

| Item | Result | Disposition |
|---|---|---|
| Mixed-version qualification | **CONFIRMED defect**: an excluded session changes aggregate residual P95 | **R1: fix before merge**, §10.2 / §10.5–§10.7 |
| Post-close ordering, carry, buckets | **VERIFIED** in source, existing tests, and additional offline probes | Pass, with the last-*published* qualification below |
| v1 grading under v2; deadline after deployment | **VERIFIED**; old reference window retained; existing deadline marks can still be written | Pass |
| Definitions v2 / retained v1 / receipt replay | **VERIFIED** locally | Pass; no hosted-document inspection |
| §7.3 sizing and launch | Actual 76-symbol staged estimate exceeds 10 MiB; 69 symbols trigger the 9 MiB guard | **R2: launch blocker unless diversity is bounded or publication is redesigned**; not a new 30-symbol contract failure |
| Post-close and unchanged-entry weighting | Measurably changes metrics; current §10.3 specifies per-log-entry comparisons | **R3: file a measurement-policy addendum before qualification freeze** |
| Full suite | Local baseline and closing run both exit 1; all focused mutation restores pass | Full-suite-green claim **NOT VERIFIED here** |
| Lint / production build / fence | Exit 0 / exit 0 / no fenced-file intersection | Pass |

## 1. Baseline, authority, and limits

Review date: **2026-09-21**. Workspace: `C:\Users\fashr\.codex\worktrees\4e8f\portfolio-duel`. Initial checkout was detached at `1740996d43100a94fa97f9e9958b48c297d2017f`, clean. Ran `git fetch origin` successfully before remote comparisons; checked out `origin/claude/amazing-newton-oeezba` detached and verified the required short SHA **`b13770ec`**, full SHA **`b13770ec7563adeb3af8fb77386702accb08a7bc`**. Fetched `origin/main` was `1740996d43100a94fa97f9e9958b48c297d2017f`. `npm ci` succeeded (1,116 packages); tree clean afterward. Runtime: Windows PowerShell, Node **v22.20.0**, npm **11.7.0**, Git `core.autocrlf=true`.

All repository `file:line` citations below are **VERIFIED at `b13770ec`**. Measured results mean local, offline execution against that source or its `git archive` snapshot. Forecasts are explicitly marked **ASSUMED**. No production database, deployed cron, provider request, paid model, actual Firestore transaction limit, or existing qualification calendar was inspected.

Scope is C1 `d530ffb6`, C2 `012416e7`, C3 `a7ba76ac`, and report `b13770ec`, on base `1740996d`. Authority read: `docs/BUILD_RULES.md:10` (fence), `:34` (§2), `:98` (display agreement); `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:79`–`:151` and `:216`–`:237`; the current build report; the prior A4/A5 amendments recorded at `docs/audits/20260919_BUILD1_INTRADAY.md:223`–`:224`. In particular, A5 makes bar completeness the coverage gate and the volume ratio diagnostic; this review does not incorrectly demand the superseded 90% gate. Vendor answers are the repository's recorded inputs (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:52`–`:56`), not independently authenticated vendor statements. The original separate build prompt was not supplied as an artifact; its requirements are assessed through the supplied review brief and the build report's explicit item map.

BUILD_RULES §2's independent refutation was performed by a second reviewer on a path-distinct archive of `b13770ec`, with no Git or source writes in the shared worktree. That reviewer reran the numerical probes, challenged scope/severity, and supplied independent deadline, historical-version, and mixed-aggregation reproductions. The coordinator ran four reversible mutations in the requested worktree, restoring each with Git before the next. Only this report is retained as a repository change.

## 2. Ranked findings and dispositions

### R1 — P2 / high confidence / CONFIRMED: mixed sessions still alter qualification aggregates

**Consequence:** the founder can see `symbolsQualified: 1` while the reported VWAP error includes a second symbol explicitly excluded for mixing calculation versions. Keeping raw diagnostic values is appropriate; feeding them into the same aggregate used by the rollup defeats the new exclusion.

The new guard sets `qualification: { included: false, reason: 'calc_version_mixed' }` at `api/_utils/intraday/validator.js:330`–`:332`. `aggregateValidation` computes `qualified` at `:356`, but its `collect` helper reads **all `syms`** at `:358`; residual P95 uses that helper without filtering at `:361`, evaluation-linked inputs use all symbols at `:365`, lag bins use all symbols at `:369`, and event counts use all symbols at `:371`. Only SMA/MACD explicitly test qualification (`:362`–`:363`). The top-level P95 is emitted at `:380` and consumed by the trailing rollup at `api/_utils/intraday/validationRunner.js:173`–`:181`.

**Concrete reproduction:** grade the committed AAPL fixture with a qualified continuous-session ring and three v2 entries. Grade a second synthetic symbol-session case with the same ring, three v1/null-cutoff entries and three v2 entries whose estimates deliberately carry a large error. Both go through `validateSymbolSession`, rather than manufacturing its result object. Adding the mixed result changes:

| Measurement | Qualified symbol only | Same symbol plus excluded mixed symbol |
|---|---:|---:|
| `symbolsQualified` | 1 | 1 |
| `symbolsCalcVersionMixed` | 0 | 1 |
| Aggregate `p95AbsResidualOverPrice` | 0.005754103091832274 | 1.6938138045843696 |
| Lag-bin `0` comparison count | 3 | 6 |
| Lag-bin `0` reported absolute P95 | 1.927624535763812 | 567.4276245357638 |

The exaggerated error isolates membership; its size is not a production-error estimate. The mixed result itself correctly reports `calc_version_mixed`. Existing tests assert the flag/count and preserved raw comparisons (`api/_utils/intraday/validator.test.js:207`–`:217`), without asserting that adding an excluded session leaves qualified aggregates unchanged.

**Required before merge:** retain per-symbol diagnostics, but exclude mixed symbol-sessions from qualification aggregates and their event denominators/rollups; test a qualified+mixed pair and an all-mixed set, with unavailable rather than a fabricated zero when no eligible denominator remains. If raw aggregate diagnostics are also wanted, identify them separately. Clause: §10.2's checked exclusion, §10.5's reported metrics, and §10.6–§10.7's versioned measurement window (`docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:222`, `:231`, `:234`, `:237`).

**Refutation outcome:** CONFIRMED independently. The unfiltered aggregator predates this PR, but the PR adds and claims a mixed-version exclusion that it does not enforce end to end. The strongest counterargument is that every top-level residual is merely a raw diagnostic and qualification selects only counts. However, there is no separately identified qualified VWAP aggregate here, and these same values enter the §10.5 rollup used as measurement evidence. This finding concerns characterization/qualification evidence, not a demonstrated live trading or automated activation failure. A correctly timed deployment avoids mixing in the normal case; it does not make the newly added guard correct.

### R2 — P2 / high confidence in bytes, assumed launch diversity: the refusal guard is below plausible launch demand

**Consequence:** over-limit collection stops publishing fresh facts for the entire sweep. A named refusal avoids attempting an oversized transaction; it does not allow collection to continue. The next attempt reloads the last published state and can fail at the same boundary again (`api/_utils/intraday/intradayStore.js:194`–`:213`; `api/_utils/intraday/pollRunner.js:229`–`:230`, `:288`–`:299`).

The standing sizing simulation was rerun, including direct boundary measurements. Its source is `api/_utils/intraday/intradaySizing.test.js:17`–`:44`; storage accounting and serialization are `api/_utils/intraday/intradayStore.js:49`–`:60`, `:204`–`:209`, `:263` onward.

| 420-sweep measurement | Bytes |
|---|---:|
| Snapshot, 255 symbols / 30 actionable | 246,587 |
| Universe calculation state, 255 symbols | 52,165 |
| Largest actionable document among the 30 | 133,819 |
| Publish, 30 actionable | 4,311,641 |
| Publish, 255 actionable | 34,505,029 |
| Actual staged estimate, 76 actionable | 10,487,130 |
| 10 MiB comparison limit | 10,485,760 |
| Actual staged estimate, 69 actionable | 9,547,392 |
| `PUBLISH_MAX_BYTES`, 9 MiB | 9,437,184 |

The 30/255-point fit gives **134,192.836 bytes/additional symbol**, fixed **285,855.933 bytes**, crossing **76.009** at 10 MiB and **68.195** at 9 MiB. The fit is approximate: direct measurement at **76** is already 1,370 bytes over 10 MiB. **68 enters the fake transaction; 69 refuses before opening one.** Thus “approximately 68” is fair shorthand, but the first refused integer in this fixture is **69**. Entering a fake transaction is not proof of hosted Firestore success. The refusal emits exactly one line per attempt:

```text
[intraday-publish] publish_oversize: 9547392 B staged for 69 actionable symbols exceeds 9437184 B — refusing the transaction (contract §7.3; the generation-pointer design is the fix at this scale)
```

The production check and message are `api/_utils/intraday/intradayStore.js:210`–`:213`; the ceiling is `api/_utils/intradayConfig.js:157`. Units have already been recorded (`api/_utils/intraday/pollRunner.js:223`–`:226`, `:260`–`:265`). This is one named line **per failing publish**, not a once-only alert or a recovery mechanism.

**Cause verified:** replacing only the two epoch-ms cutoff values with null in the generated log saves **18 bytes/entry × 420 = 7,560 bytes/symbol**, moving the fitted crossing from **76.009 to 80.547**. This isolates the reported 81→76 cause without pretending to rerun the entire v1 engine. The log fields are emitted at `api/_utils/intraday/sweepCalc.js:138`–`:150` and serialized as a string at `api/_utils/intraday/intradayStore.js:55`.

**Launch scenario, ASSUMED:** the stated 20 users × 3 portfolios is **60 simultaneously active portfolios** if all participate. Ordinary portfolio validation requires 2 star + 2 core + 2 support stocks and 3 bench stocks, distinct (`api/agent/decide.js:1108`–`:1137`): **9 equity slots/portfolio**, plus crypto. The collector takes the deduplicated held ∪ bench of active battle portfolios (`api/_utils/intraday/universe.js:32`–`:46`), and separates crypto from persisted equity actionable documents (`api/_utils/intraday/pollRunner.js:215`–`:216`, `:230`; `api/_utils/intraday/sweepCalc.js:67`–`:82`). The configured universe is 239 stocks plus 16 index/sector ETFs (`api/_utils/intraday/universe.js:4`–`:16`).

Uniform independent nine-equity selection within each portfolio gives expected distinct symbols:

```text
E[D] = N × (1 − (1 − 9/N)^B)
N=239, B=60: 215.11          N=255, B=60: 225.47
N=239, B=20: 128.08          N=255, B=20: 130.71
```

The B=20 sensitivity assumes each user's three portfolios are identical. Even six held equities without benches give **187.01** expected distinct stocks at N=239/B=60. These are diversity scenarios, not observed holdings or a forecast: shared shortlists/archetypes can create much more overlap, and non-concurrent portfolios reduce B. With N=239, the feasible union spans 9–239. No code here limits the union to 68.

**Plain answer:** the one-transaction publish **does not survive the illustrated 60-portfolio diversity scenario**; it is **not demonstrated safe for launch**. It survives this full-day sizing envelope only with sufficiently concentrated holdings/benches or a smaller concurrent population. Even the informational log compaction below would not cover ~215 symbols.

**Disposition:** require a pre-launch §7.3 capacity decision, measured against an explicit maximum distinct actionable set. The currently written §7.3 only mandates the generation-pointer design below 30 (`docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:148`); this PR still passes 30. Therefore capacity alone is not a contract-based demand to implement a redesign in this PR. The lowered tripwire is openly documented (`api/_utils/intraday/intradaySizing.test.js:101`–`:118`; build report `:255`–`:279`), but “nothing to do today” is not supported by the founder's launch-scale assumption. Independent review confirmed the arithmetic and refuted the stronger claim that *every* 20-user launch must fail.

### R3 — P2 measurement caveat / high confidence: sweep weighting and post-close source residuals

**All three requested effects occur.** Every observed actionable sweep appends a log entry (`api/_utils/intraday/sweepCalc.js:136`–`:151`). Alignment maps every entry (`api/_utils/intraday/validator.js:146`–`:166`). Included entries are filtered only by exclusion reason, then each contributes to the residual/price P95 and lag bins (`:195`–`:200`, `:233`–`:236`). There is no observation/cutoff deduplication or post-close exclusion.

**Fixture-day method:** use the 391 committed AAPL bars (`docs/audits/fixtures/AAPL_2026-09-17_1m.json:1`) as input to synthetic quotes; this is not a captured Live-v2 quote stream. Sweep minutes w=0…419; trade minute m=max(0,w−15); price is that fixture row's close, volume its cumulative bar volume, and high/low are fixture-row values. For m≥390, retain the auction-row price 336.91 and session volume. Feed every quote through real `runSweepCalc`; grade using the 390-row v2 reference. This deliberately simple proxy stamps a row's close at its start, as the existing sizing/poll fixtures do; it measures weighting effects, not real VWAP estimator accuracy. There are 405 pre-close log lines (including 15 unchanged opening repeats), 15 post-close lines, and 16 opening lines with no completed reference bar.

| Metric | Exclude the 15 post-close lines | Current all-entry result |
|---|---:|---:|
| Aligned comparisons | 389 | 404 |
| P95 of absolute residual / price | 0.000278984567171515 | 0.000276525675502796 |
| Same P95, basis points | 2.7898456717 | 2.7652567550 |
| Lag-bin `0`: n | 389 | 404 |
| Lag-bin `0`: mean residual | −0.003315445365 | −0.000924125708 |
| Lag-bin `0`: absolute P95 | 0.092558709850 | 0.091830028949 |
| Price-source absolute P95 | 0.4000 | 0.3850 |

**(a) Frozen estimate:** the final pre-close estimate appears **16 times** instead of once (the original plus 15 tail entries). It accounts for 16/404 = **3.96%** of comparisons instead of 1/389 = **0.257%**. Its residual remains **0.061090764079** against the 15:59 reference cutoff. All 15 tail lines still report **alignmentLagMs=0**, because lag uses the frozen estimate cutoff, not the advancing quote clock (`api/_utils/intraday/validator.js:157`–`:162`). That is correct estimate alignment, but it must not be read as fresh independent evidence. P95's denominator uses each tail entry's after-hours price (`:197`), so even the normalized value need not be frozen.

**(b) Price-source residual:** this has its own price-time lookup (`api/_utils/intraday/validator.js:150`–`:153`), rather than reusing the estimate cutoff. Because the v2 reference stops before the close, a 16:14 quote is paired with the **15:59-start bar ending at 16:00**, close **337.09**. Tail price **336.91** gives residual **−0.18**; at that point quote/reference age is **14 minutes**, while the estimate's reported alignment lag remains zero. A sensitivity run with an explicitly artificial tail price **347.09** gives last residual **10.00** and raises whole-day price-source P95 from **0.40 to 0.63**. Thus after-hours market movement and source disagreement are pooled. This diagnostic is per-symbol (`:236`), not one of the top-level rollup fields (`api/_utils/intraday/validationRunner.js:178`).

**(c) Unchanged pre-close observations:** make m=120…179 repeat m=119, retaining the same price/time/volume; change only sweep availability. The real classifier returns 60 additional unchanged outcomes. Comparing this *same generated day* before/after deduplicating identical estimate/price observations:

| Pre-close-only metric | Current sweep weighting | Unique observations |
|---|---:|---:|
| Comparisons / lag-bin `0` n | 389 | 329 |
| P95 absolute residual / price | 0.000920680607269848 | 0.000925147490164193 |
| Lag-bin `0` mean | 0.127967530912 | 0.151811446501 |
| Lag-bin `0` absolute P95 | 0.309201375146 | 0.310572012448 |
| Price-source absolute P95 | 0.3850 | 0.4115 |

The illiquid sequence has a different estimator history; compare columns within that table, not its level against the first table. The observation at minute 119 gets 61 votes instead of one. Deduplication was an analysis counterfactual, not a source edit. Blindly deduplicating by cutoff alone would also discard legitimate volume-only revisions (`api/_utils/intraday/accumulator.js:236`–`:239`).

**Fix-or-file decision:** **file (a), (b), and (c) as a bounded §10.3/§10.5 measurement-policy addendum before qualification freeze (§10.6), not three undocumented implementation requirements before this merge.** §10.3 explicitly says “Per log entry” (`docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:225`), so sweep-weighted distributions comply with the written comparison unit. If the programme intends independent observations, specify deduplication identity or exclude post-close lines from series metrics and reconcile calcVersion under §10.7. Before interpreting (b) as price-source accuracy, exclude the tail or report a separate post-close/reference-age stratum. The measurement effect is CONFIRMED; the claim that all duplication automatically violates the present contract was REFUTED by independent review.

## 3. Lens 1 — post-close behavior and persistence

- **Ordering and boundary — VERIFIED:** numeric validation occurs first; prior/future-session handling and rollover precede the post-close branch; the branch tests `priceAsOf >= obsSession.closeMs` before all ordinary classifications (`api/_utils/intraday/accumulator.js:148`–`:180`). Thus close−1 ms remains eligible for ordinary classification, an early close uses the calendar close, and a first observation after close starts/reset its own session before freezing. The existing boundary/classification rows passed; the disabled-rule mutation killed nine tests.
- **Exact carry source — VERIFIED:** `intradaySnapshots/latest.symbols[sym].indicators`, as read transactionally when acquiring the current lease (`api/_utils/intraday/intradayStore.js:89`–`:102`), enters the calculation through `lease.previous.symbols` (`api/_utils/intraday/pollRunner.js:273`–`:276`). It is **not** the attempted prior sweep's unpublished result, a view, a previous actionable log, or a re-derived accumulator. `sweepCalc.js:131`–`:132` passes that block to `facts.js:132`–`:136`.
- **Refused/lost prior publish — MEASURED:** publish generation 1 at 15:58; compute 15:59, then refuse with a 1-byte test ceiling or replace its lease owner before publish; acquire another lease and process 16:00. Both paths carry generation 1's **15:58 cutoff 1789675080000**, not failed 15:59's 1789675140000. All four aggregate blocks and the accumulator are byte-identical to the persisted generation. Both cutoffs are before close 1789675200000. Production size/lease checks return before the publication writes (`intradayStore.js:210`–`:225`). If a different lease holder successfully published meanwhile, the next acquisition reads that holder's published snapshot.
- **No carry / wrong session — VERIFIED:** first-seen-after-close produces `absent`, null values/cutoffs, `post_close`; a different `sessionEtDate` is refused (`api/_utils/intraday/facts.js:35`–`:47`, `:132`–`:136`; passing tests `api/_utils/intraday/postClose.test.js:168` onward). After a same-session pre-close state exists, the accumulator stays byte-identical across the whole generated 15-observation tail; the first-ever/rollover initialization is the explicit exception.
- **Carry wording limit — CONFIRMED:** HELD observations are skipped before facts rebuilding (`api/_utils/intraday/sweepCalc.js:100`–`:104`), so the held-contamination hypothesis is REFUTED. However, ACCEPTED 15:57 volume=1000 → UNCHANGED at the same timestamp with volume=null → POST_CLOSE carries an **absent/volume_invalid** block, while the accumulator still has accepted volume 1000. The unchanged branch can report invalid volume (`api/_utils/intraday/accumulator.js:228`–`:231`); facts publish absence (`api/_utils/intraday/facts.js:155`–`:157`). Therefore “last published block” is exact; “always the last accepted ready aggregate” is too strong. This conservative pre-close absence behavior is inherited, not a request to reconstruct an older value in this PR.
- **Bucket passage/deadline — VERIFIED:** `>= close` finalizes open current-session buckets and returns before inserting the auction price (`api/_utils/intraday/buckets.js:225`–`:238`). No auction value is written. Repeated passage is idempotent because only open buckets finalize (`:211`–`:223`). Deadline marking remains separate, incomplete/unqualified, with no state advance (`:273`–`:295`).

## 4. Lens 2 — continuous window, seed quality, and Monday's v1 session

**Window — VERIFIED:** `sessionEndMs` is close−1 only for `continuous_session`; bucket membership rejects anything beyond it (`api/_utils/intraday/buckets.js:56`–`:82`). Seed bars go through that membership check (`api/_utils/intraday/seed.js:38`–`:55`). The v2 reference's last permitted start is close−60,000, with later rows rejected (`api/_utils/intraday/validator.js:52`–`:53`, `:69`–`:78`). Therefore 16:00, 16:03, and 16:04 starts are excluded by construction; no NYSE-specific guessed auction assignment is needed.

Measured committed fixture: **391 total rows**, **390 used / 1 ignored**, **25,452,766** continuous-session shares versus **44,574,829** including the **19,122,063** auction shares. Early-close tests use 211 candidate rows, **210 used / 1 ignored**, **42 buckets**, ending at 12:59 (`api/_utils/intraday/seed.test.js:76`–`:90`, `:120`–`:129`; `api/_utils/intraday/validator.test.js:162`–`:187`). These tests passed in all restored focused runs.

**Quality — VERIFIED:** live finalization marks the last bucket qualified iff policy is non-null (`api/_utils/intraday/buckets.js:179`–`:188`); seed construction does likewise (`api/_utils/intraday/seed.js:48`–`:52`). The seeded-ring test confirms SMA20/MACD/RSI qualified under the continuous policy and reproduces null-policy MACD/RSI unqualification (`api/_utils/intraday/seed.test.js:100`–`:117`). Thus the named R-11 seed defect is absent on a new v2 seed. Deadline buckets remain unqualified (`api/_utils/intraday/buckets.js:279`–`:287`). The null seed/reference path is retained for historical grading; it is not a promise that today's live accumulator can simulate the entire former v1 engine just by changing configuration.

**Next-morning v1 grading — VERIFIED:** the runner reconciles the graded session deadline before loading/validating (`api/_utils/intraday/validationRunner.js:69`–`:76`, `:117`, `:139`–`:140`). Numeric log stamps, not the grader constant, choose the historical window (`api/_utils/intraday/validator.js:60`–`:65`, `:317`–`:320`). A v1 log therefore includes the **16:00 row**, expects **391 bars**, uses their summed volume over that session's stored `lastAcceptedVolume`, and excludes its null estimate cutoffs as `cutoff_unconfirmed` (`:121`–`:140`, `:155`). There is no reconstruction of confirmed cutoffs from current config.

Independent historical-shape probe: null-policy ring + three v1/null-cutoff log entries + grader version 2 yielded **391/391**, **0 VWAP comparisons**, **3 cutoff_unconfirmed**, `close_unqualified`, and `symbolsByCalcVersion: {"1":1}`. Supplying the fixture's full 44,574,829-share denominator gave ratio **1.0**. This is a fixture denominator, not Monday's observed live volume; for a different stored last accepted volume, the ratio changes. A separate sensitivity using 25,452,766 gave **1.7512764232** on the v1 391-row basis. Coverage is decided by missing bars, not either ratio, per A5.

**Empty/mixed logs — VERIFIED with R1 exception:** an empty log explicitly returns `source: 'fallback'`, uses grader v2's **390-row** window, and reports `calcVersionSource` (`api/_utils/intraday/validator.js:62`, `:335`–`:336`). With the full fixture-volume denominator, that empty-log reference ratio is **0.5710120839723244**. It does not identify an unknown historical session as v1. Mixed logs select the maximum numeric version and mark the mixed state (`:61`–`:65`, `:330`–`:335`). `symbolsByCalcVersion` counts the selected version; mixed symbols also appear in `symbolsCalcVersionMixed` (`:377`–`:378`). Those counters are correct, but the metric exclusion is incomplete (R1).

**Deploy at 16:30–17:59 ET — VERIFIED:** in September EDT the poll cron continues through 17:59 ET (`vercel.json:161`–`:162`). Every enabled invocation applies deadline processing before the collection-window guard (`api/_utils/intraday/pollRunner.js:185`–`:199`). Consequently **yes, v2 code can still write a v1 session's state**: incomplete/deadline/unqualified marks on open or missing-last buckets, `deadlineAppliedAt`, and the calculation document's deadline stamp (`:64`–`:70`). Independent fake-store probe scanned completed/open/missing-last v1 documents: the completed document stayed byte-identical; the other two got only the expected deadline changes; `stateJson`, `logJson`, accumulator numbers, existing closes and `endMs` stayed unchanged. Repetition returned `already_applied`. This is the existing §6.2 reconciliation, not a v2 numerical reinterpretation. The merge-window advice avoids new v2 log entries, but does not mean “zero writes to the old session.” On an early close the collection tail ends at that day's close+30 minutes.

## 5. Lens 3 — definitions and informational log redundancy

**Definitions — VERIFIED:** `CALC_VERSION=2`, both cutoff fields name the internal Observation key `priceAsOf`, and policy is `continuous_session` (`api/_utils/intradayConfig.js:63`, `:65`, `:84`, `:102`). `definitionsRef` uses `v${calcVersion}` (`api/_utils/intraday/intradayStore.js:37`); the ensure helper checks existence and only writes when absent (`api/_utils/intraday/evaluatorHook.js:79`–`:87`), called on initial calculation state (`api/_utils/intraday/pollRunner.js:285`). A fake store preloaded with a v1 sentinel retained it byte-for-byte while ensure created v2.

The v2 definitions give consolidated-RTH venue to VWAP/volume/pace, continuous-session text to VWAP/buckets, vendor-regular-session text to sessionHL, and leave **sessionHL venue `vendor_unconfirmed`** (`api/_utils/intraday/view.js:31`–`:64`). The existing receipt-only replay test deletes the snapshot and replays from stored view+v2 definitions; mismatched v1 definitions are refused (`api/_utils/intraday/view.test.js:126`–`:173`; implementation `api/_utils/intraday/view.js:162`–`:175`). These tests passed. No assertion is made that v2 already exists in the hosted database.

**Informational for a pre-launch spec, not an implementation request:** JSON field cost includes its leading separator, key, colon and value. In the homogeneous v2 sizing day, `experimental:false` costs **21 bytes/entry**, `calcVersion:2` **16**: **37 repeated bytes/entry**, or **15,540 bytes per 420-entry document**. These are the two measured constant-valued fields. `generation` changes every sweep and must not be hoisted as if it were constant. Version/experimental hoisting would also need explicit handling for historical mixed sessions.

On each ordinary pre-close entry, `estimateCutoff===volumeCutoffAsOf===priceAsOf`: the extra cutoff keys cost **31+33=64 bytes/entry**. That identity is not valid in the post-close tail; those cutoffs must remain explicit or use a lossless encoding. In the standing sizing fixture there are **390 pre-close and 30 post-close** lines, so suppressing only the redundant pre-close cutoff pair saves **24,960 bytes/document**. Together with the constant fields that is **40,500 raw log-string bytes/document**, before small once-per-document metadata. This sizing fixture runs quote timestamps through 420 minutes; it is distinct from the 15-minute-delayed/15-tail metric fixture above (`api/_utils/intraday/intradaySizing.test.js:23`–`:40`).

| Offline serialization counterfactual | Largest actionable doc, 30-symbol run | Fitted 10 MiB crossing | Fitted 9 MiB guard |
|---|---:|---:|---:|
| Current | 133,819 B | 76.009 | 68.195 |
| Hoist the two constant fields, add metadata | 118,326 B | 85.930 | 77.096 |
| Also encode pre-close cutoffs as `priceAsOf`, retain explicit tail cutoffs | 93,392 B | 108.781 | 97.598 |

These are directly reserialized fixture documents measured with the same byte estimator, including added metadata; they are not a deployed schema, integer capacity guarantee, or permission to alter §7.1 silently. Contract version/provenance and mixed-log preservation remain requirements (`docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md:141`, `:237`). The ~109 fitted crossing still falls far below the ~215-stock launch diversity example.

## 6. Lens 4 — tests, mutations, fence, and restoration

| Command/run | Files | Tests | Exit |
|---|---|---|---:|
| Initial `npx vitest run`, before mutations | 700 passed / 37 failed / 6 skipped, 743 total | 13,855 passed / 46 failed / 87 skipped, 13,988 collected | **1** |
| Focused baseline: every `api/_utils/intraday/*.test.js` plus `api/_utils/intradayConfig.test.js` | 17 passed | 204 passed | **0** |
| Final full `npx vitest run`, after all restores | 701 passed / 36 failed / 6 skipped, 743 total | 13,856 passed / 45 failed / 87 skipped, 13,988 collected | **1** |
| `npm run lint:gate` | — | — | **0** |
| `npx vite build` | — | — | **0** |

Initial/final full runs took **75.39 s / 72.72 s**. The only removed failure header was the initial 5-second timeout in `src/config/backingBetaFlags.test.js`; there were **no new failure headers** after restoration. The full suite returned to the same substantive failing baseline, not a green baseline. A first broad filename filter also selected the unrelated `intradayPromptExclusions.test.js` and reproduced its baseline failure; explicit test filenames were used for the 204-test mutation battery.

Representative baseline failures show CRLF-sensitive source/golden assertions, Windows `\\` versus `/` comparisons, native imports of drive-letter paths, unavailable POSIX `grep`, and local-date assumptions. Examples in the captured log include `api/_utils/fantasyTimesConsensus.n4.test.js` expecting `api/health.js` but receiving `api\\health.js`, `src/constants/eligibility.test.js` matching LF against CRLF text, `src/data/decisionRecord.test.js` embedding a Windows path into JavaScript, and `src/utils/dateUtils.test.js` expecting day 21 but receiving 20. The 11 suite-load failures also prevent some tests from being collected. These observations explain why this Windows run cannot reproduce the build report's Linux-style count; **not every baseline failure was root-caused**, and this review does not repair unrelated tests or claim them all harmless. Test counts in the report are retained exactly as emitted, not normalized to the build report's totals. Source anchors for representative platform assumptions are included in the out-of-scope list below.

Four requested mutations were applied separately to this worktree and rerun locally; none is merely cited from the build report:

| Mutation at reviewed source | Mutated result | Git restore and rerun |
|---|---|---|
| Disable post-close branch: `api/_utils/intraday/accumulator.js:176`, `if (false && …)` | 9 failed / 195 passed; 2 failed files; exit 1 | 17 files / 204 tests passed; exit 0 |
| Disable carry branch: `api/_utils/intraday/facts.js:124`, `if (false && postClose)` | 6 failed / 198 passed; 1 failed file; exit 1 | 17 files / 204 tests passed; exit 0 |
| Force grader constant: `api/_utils/intraday/validator.js:318`, use `calcVersion` | 2 failed / 202 passed; 1 failed file; exit 1 | 17 files / 204 tests passed; exit 0 |
| Restore strict passage `>`: `api/_utils/intraday/buckets.js:232` | 4 failed / 200 passed; 2 failed files; exit 1 | 17 files / 204 tests passed; exit 0 |

Each file was restored with `git restore --source=HEAD --worktree -- <that file>` inside a `finally` block; `git diff --exit-code -- <file>` verified restoration **before the next mutation**. The four restoration counts equal the focused baseline. A final full run then checked for broader regressions. The strict-passage mutant is killed; under the shipped continuous policy, the exact-close quote can be rejected rather than necessarily becoming a bucket close, so the build report's parenthetical is not a universal description of that mutant (`api/_utils/intraday/buckets.js:76`–`:81`, `:232`–`:238`).

**Fence check — VERIFIED:** diff against freshly fetched `origin/main` at 1740996d contains **24 files, +1,348/−121** (including the 327-line build report). Intersecting with all eleven §1 paths yielded **zero**; an explicit diff of those paths was empty. No new scored/trading-policy call-site change was found in the changed production modules: they concern intraday facts, buckets, grading, definitions/config and diagnostic wording. No fenced function was edited for this review. The build succeeded with the existing >500 kB chunk warning; it is not a performance clearance.

## 7. Claims stronger than the available evidence

1. **“Excluded from qualification” is incomplete.** The new mixed flag/count works, but residual and evaluation aggregates do not all honor it: R1 (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:152`–`:158`; implementation `api/_utils/intraday/validator.js:358`–`:380`).
2. **“Last pre-close accepted observation” needs “last successfully published block.”** Refused/lost publications are not carry sources, and a published invalid-volume absence may be the carried block: §3 above (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:83`–`:104`; `api/_utils/intraday/facts.js:132`–`:136`).
3. **“Nothing to do today” / no urgency is not supported at the stated launch diversity.** 30-symbol arithmetic and a log line do not establish capacity for 60 portfolios. The guard prevents a transaction attempt, not a collection stall (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:270`–`:279`; `api/_utils/intraday/intradayStore.js:194`–`:213`).
4. **“Costs nothing” after 16:30 needs its scope stated.** No new mixed collection entries are expected, but deadline state can still be written. Those writes preserve old numeric/log semantics in the probe (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:285`–`:291`; `api/_utils/intraday/pollRunner.js:185`–`:199`).
5. **“No views have been written” / the reset resets nothing is NOT VERIFIED here.** It is a hosted-state assertion, not something repository source proves (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:203`–`:204`). Any qualification-calendar disposition remains conditional on that actual state.
6. **Full-suite green and 740 files were not reproduced on this machine.** Our complete command exited 1 both times. The branch has **24** changed files once its report commit is included; **23** correctly describes the pre-report code/test diff (`docs/audits/20260921_INTRADAY_CALCVERSION_2.md:19`–`:22`, `:295`–`:307`).

## 8. Out-of-scope items, filed only

- **Windows test portability:** CRLF/source hashes, path normalization, embedded native imports, POSIX tools and timezone assumptions deserve separate test-infrastructure work; no source/test changes made here. Representative anchors: `api/_utils/fantasyTimesConsensus.n4.test.js:46`–`:50` (reader census), `src/constants/eligibility.test.js:43`–`:45` (literal-LF counsel-marker test), `src/data/decisionRecord.test.js:78`–`:79` (plain-Node command construction), and `src/utils/dateUtils.test.js:78`–`:84`. Full failure lists are in the retained logs, not promoted to new PR defects.
- **Pre-existing rollup statistics/version mixing:** trailing rollup averages completed daily metrics without a calcVersion/policyVersion cohort filter (`api/_utils/intraday/validationRunner.js:168`–`:183`); aggregate P95 is a P95 of per-symbol P95s, and lag-bin P95 is a median of symbol P95s (`api/_utils/intraday/validator.js:361`, `:369`–`:380`). Those are not pooled empirical quantiles. Broader correction belongs to the qualification-programme specification; R1 is the narrower new exclusion failure.
- **Pre-close invalid-volume carry wording:** retaining a conservative absence is inherited behavior, documented above; no recovery mechanism added (`api/_utils/intraday/accumulator.js:228`–`:231`; `api/_utils/intraday/facts.js:155`–`:157`).

## 9. Evidence and delivery record

Local evidence is retained outside the repository at `C:\Users\fashr\.codex\visualizations\2026\09\21\01a0c656-7444-7870-a907-4cce28c93204\intraday-review`: `baseline-vitest.log`, `final-vitest.log`, `lint.log`, `build.log`, `mutation-results.json` and each mutation/restore log; `probes.mjs` / `probes.json`; `carry-probe.mjs` / `carry-probe.json`; and the independent reviewer's `refuter/REFUTER_NOTES.md`, `refuter-probes.mjs`, `refuter-probes-results.json`, `independently-rerun-probes.json`. All custom Node probes exited 0. Scripts are offline and accept the source root where applicable; the sizing probe extracts the existing simulation function from its test rather than substituting new sizing logic. Evidence scripts and the archive are deliberately not staged.

Before report creation, `git status --short` and `git diff --check` were clean and HEAD remained `b13770ec`. After report creation, `git status --short` showed **only this report** untracked, and the tracked-source diff against `b13770ec` was empty. Publication is the explicitly requested branch `claude/review-intraday-calcversion-2`, one-file commit `review(intraday): calcVersion 2 §2 review`. No implementation fix, PR creation, merge, or deployment is part of this review.
