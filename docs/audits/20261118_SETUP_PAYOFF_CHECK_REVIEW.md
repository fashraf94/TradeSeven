# Review — setup payoff check (BUILD_RULES §2)

**Date:** 18 Nov 2026 · **Reviewed:** branch `claude/setup-payoff-check` at `278c5edd` (6 files, 2,173 lines against `main`, past the 1,500-line threshold) by three lenses and three refuters; then the changes after it, `278c5edd` → `b2270519`, by a delta reviewer · **Report:** `docs/audits/20261118_SETUP_PAYOFF_CHECK.md` · **Prompt:** the setup payoff experiment prompt, 18 Nov 2026 (Fable).

## In plain terms

Three independent reviewers checked the scripts and the report, each looking for a different kind of mistake. Every mistake they raised then went to a second reviewer told to prove it wrong. No fixed number moved, and no reviewer found a code error in the measurement. A further reviewer then checked everything changed after the review, the rewritten report included, and found one more point worth the founder's eye: the Fundamental Investor's quota cannot be met at all. The wording changed where the report claimed more than the data shows. The biggest change: a January–May "worse" result, added after the main results, does not hold up once overlapping three-day windows are allowed for, and the report now says so wherever it uses that result.

| Item | Verdict |
|---|---|
| Lenses | 3: method fidelity and statistics (L1), data fidelity and rule compliance (L2), the report against the data (L3) |
| Refuters | 3, one per lens, each told to refute every finding with a reproduction |
| Findings | 29: **15 confirmed, 12 partly confirmed, 2 refuted**; then 10 from the delta review (1 medium, 3 low, 6 info), all applied |
| Severity after refutation | **No high.** 2 medium (SP-L3-3 and SP-L3-4, both report wording or disclosure), 16 low, 11 info |
| Numbers moved | **No fixed figure.** Every value in `summary.json` before the review is identical after it. Additions are labelled as such: session-weighted arm means, the overlap sensitivity, the quota reading (R-10), the Part B base by period, and two integrity counts |
| Independent confirmations | L1's own code reproduced every headline point estimate and interval, and Parts B to E (below). L2 re-ran shards byte for byte. L3 recomputed every hand-typed number in the report at `278c5edd`: 0 mismatches. The delta reviewer re-checked the rewritten report at `b2270519`: 78 scripted prose assertions and 3 hand-built tables, one rounding (DR-9) |
| Mutation check | No test was added. The scripts' own gates were mutation-checked: R2's three planted copies now stop (below), and nine planted forms trip the grep |
| `vite build` | Stops locally at `Rollup failed to resolve import "three"` (`src/components/AgentForm/engine/bloom.js`). `three` is not installed on this machine, a known gap. This branch touches no `src/` file; the Vercel preview build is the real check |

## Method

- **Isolation (the Sep 2 ruling).** Each reviewer and refuter had its own `git -c core.autocrlf=false archive` extraction of `278c5edd`, with its own copy of both run folders, all under the session scratchpad and with `node_modules` linked. All were read-only on git and on the working tree.
  - None ran the provider fetch; L2 and R2 tested it with fakes, with the network blocked.
  - Mutating checks (planted records, planted grep forms, a swapped bar) ran only in each reviewer's own copy.
- **Refutation.** Each refuter received its lens's findings as claims with their evidence. Its instruction: refute each one with a reproduction, correct its severity, and name the minimal fix.

## Findings and dispositions

Severity is the refuter's. "Report" means `docs/audits/20261118_SETUP_PAYOFF_CHECK.md`; line numbers in the claims are at `278c5edd`.

| Id | Claim (short) | Refuter | Severity | Disposition |
|---|---|---|---|---|
| SP-L1-1 | The post-hoc January–May "worse" (−0.108 [−0.210, −0.007]) does not survive an interval that allows for overlapping three-session windows (lag-1 correlation 0.26) | CONFIRMED: 0 of 35 overlap-aware variants stay below zero; L1 missed two places where the report leans on it | low | **Fixed.** `analyze.mjs` adds an overlap sensitivity: a circular block bootstrap with blocks of 3 and 5, same seed and count. January–May blocks of three give [−0.232, +0.003]; the short headline holds at [+0.047, +0.248]. The report hedges the row in the bullets, Part A, Surprise 2 and founder questions 1 and 5 |
| SP-L1-2 | A label is named from one paired session (lo = hi) | CONFIRMED; labels from 2–3 sessions are affected too | low | **Fixed in display.** `tables.mjs` shows "too few sessions (n)" below five paired sessions. `summary.json` keeps the fixed label |
| SP-L1-3 | The arm-means table (per trade) cannot be reconciled with the per-session test | PARTLY: the numbers hold; there is no decay wording, and the prompt defines session weighting | info | **Fixed.** The report gives the test's own session-weighted means (event +0.028, G2 −0.118, every stock +0.033) and says the +0.146 is mostly G2 lagging |
| SP-L1-4 | The list of post-results changes omits the replaced Part D row | PARTLY ("mixed sources" is wrong; the session sets differed) | info | **Fixed:** the Preamble names it (fetched bars on all 120 sessions, median 49) |
| SP-L1-5 | "The extra names did worse" was not tested | PARTLY: whole long-window sets L3 and L4 are worse too | low | **Fixed:** the wording is about whole candidate sets: short L3–L5 (and H2); long L2–L4; L5 not |
| SP-L2-1 | Step 0 ran after the fetch; the prompt says "before anything else"; report l.72 gave the opposite order | CONFIRMED. `fetchLong.mjs` was byte-identical to the committed file when it ran | low | **Disclosed** in the Preamble with times; l.72 corrected. `analyze.mjs` now computes Step 0 before reading anything the fetch produced |
| SP-L2-2 | `analyze.mjs` trusts the shards' own mismatch counts | CONFIRMED; L2's fix alone would not catch a planted ATR or a stray shard | low | **Fixed** (`7133ec29`, `43beaf0c`). Step 0 compares every compact record with `replay.json`. Each record's limit must equal SMA_fast + 2 × ATR in exact decimal (28,654 and 52,696 checked, 0 differ). That ties ATR and SMA_fast only: the swing high and the pattern assessments are not tied (DR-6; disclosed in Step 0). Shards merge strictly. R2's three planted copies now stop: ATR × 3 at Step 0; a stray fetched shard as a duplicate symbol; the swapped 17 Nov bar at Step 0 with 86 mismatches. The control passes |
| SP-L2-3 | The 260 cap is per run folder; the lock is taken after the counter is read | CONFIRMED (a design gap; the 241 checks out independently) | low | **Fixed** (`7133ec29`, and DR-4 below): the lock is taken first, sits in the run folder's parent and is released on any exit, and the cap counts every run folder beside it (DR-5). Disclosed: the run used `30954dc2`'s version |
| SP-L2-4 | The write-verb grep misses `.js` / `.cjs` files, Google Cloud clients, raw requests and URLs | CONFIRMED (none of the missed forms exists in the scripts) | info | **Fixed:** it reads the import guard's extension set and refuses those forms. It now calls itself a tripwire, not a proof. Six planted forms trip it |
| SP-L2-5 | All 86 overlap fact differences come from the stored series' preliminary 17 Nov bar | CONFIRMED; the final bar changes 0 of 1,118 labels, and 24 report lines move in the third decimal | info | **Fixed:** Step 0 and the Limits section say so |
| SP-L2-6 | The 221 cap works by a slightly different route (no session from the calendar; the replay cannot set its clock) | CONFIRMED | info | **Fixed:** the wording gives both (`storeReplay.mjs:46`, `dailyBarsAdapter.js:97`) |
| SP-L2-7 | Same as SP-L1-4 | PARTLY | info | As SP-L1-4 |
| SP-L2-8 | "119 split refusals" counts the universe only; five sector funds add 180 | CONFIRMED; none feeds a result | info | **Fixed:** "among the 228", with the funds named |
| SP-L2-9 | `runDirOf` creates any path it is given; the frequency-folder guard uses `path.resolve` | PARTLY: the realpath half is REFUTED (a junction was refused); the creation half stands | info | **Fixed:** `--run` must be absolute; both guards also compare real paths |
| SP-L3-1 | The opening "No." is not the label named in advance | PARTLY | low | **Fixed:** the bullets open "Not reliably" with the named label (better, +0.15) first |
| SP-L3-2 | +0.15 weights sessions equally; "per trade the gap is +0.04" | REFUTED in its core: the pooled +0.04 is not a per-trade gap (event-weighted pairing gives +0.125); a residual on Surprise 1 | low | **Not adopted** (+0.04 would mislead). Surprise 1 now uses same-session figures. The method sentence says the test weights sessions equally |
| SP-L3-3 | The post-hoc row is used without its label (Part A plain terms, founder questions 1 and 5) | CONFIRMED | medium | **Fixed:** each use is labelled post hoc and hedged (with SP-L1-1) |
| SP-L3-4 | The code states quotas ("at least 3 stocks with …"); Part E applies each level to every slot without saying so | PARTLY: the undisclosed reading is CONFIRMED; "wrong" is REFUTED (the prompt asks for gates; the quota is on a 25–35-name shortlist; precedent #1087). L3's 46.6% is corrected to 63.8% | medium | **Disclosed and added.** Reading R-10, the quotes in full, and a post-review quota reading in `analyze.mjs`: the Speculator fills all seven on 63.8% of short-window mornings (66.4% long); the Fundamental Investor above 70 never does; the Capital Preserver 0% / 4.1%. In the bullets and founder questions 3 and 4 |
| SP-L3-5 | Same as SP-L1-5, plus "looser limits did worse" | PARTLY (l.16 was right) | low | As SP-L1-5 |
| SP-L3-6 | Founder question 4 says "at most" where the figure is a median | REFUTED ("on a typical morning" scopes it) | info | Question 4 rewritten for R-10 anyway |
| SP-L3-7 | Several labels lack their size | CONFIRMED | low | **Fixed:** sizes beside every label in the prose |
| SP-L3-8 | "Halves" where the split is two-thirds / one-third | CONFIRMED | info | **Fixed:** "periods" |
| SP-L3-9 | "Today's scores, approximate" is missing on the archetype splits, the Part E rows and the slots bullet | PARTLY (disclosed once under Limits) | low | **Fixed** in each place |
| SP-L3-10 | The eight-bullet cap is met in letter only; some sections lack "In plain terms" | PARTLY (those sections are not Parts) | info | Requests, Limits and Surprises now open with "In plain terms"; the bullets stay at eight |
| SP-L3-11 | Part D's short-window median covers 90 of 120 sessions; the removed row is not named | PARTLY | low | **Fixed** (as SP-L1-4), with the dates 14 Jul → 17 Nov |
| SP-L3-12 | Part D: "rises and falls with the market" was not tested; the first bar is 22 Dec, not 20 Dec | CONFIRMED | low | **Fixed** |
| SP-L3-13 | "A coin flip, the same as every stock"; "about the same as any of the 228"; "volume and the 20-day high bind" | PARTLY (the "cuts sharply" part REFUTED) | low | **Fixed:** the shares are given for both arms; the one-session "worse" is named; the binding is "the pattern itself and the uptrend" (346 → 189) |
| SP-L3-14 | Part B omits some of Part A's measurements that `summary.json` holds | CONFIRMED | low | **Fixed:** one-session measurements, percent labels and the base by period are rendered |
| SP-L3-15 | Code claims without `file:line` | CONFIRMED (all seven proposed lines verified) | low | **Fixed:** the citations are added |

**Info notes, refuted or not:**
- **Dividend flag at *t* → *t* + 1 (L1, a).** CONFIRMED that a dividend at *t* + 1 cannot move a return measured from that day's open. So the "dividend steps dropped" row is conservative. R1's run with only in-window steps gives +0.148 [+0.050, +0.251], the same label. The fixed row is kept and called conservative (R-9).
- **L1, d.** CONFIRMED (22 Dec), fixed.
- **I-1.** "Moves the shares by at most 0.3 points": applied.
- **I-2.** The long confirmation is better in units, but no clear difference in percent: added to the bullets.
- **I-3 (a second cause for "not 500").** PARTLY: the arithmetic is right, but the calendar is the only binding cause. The report now says the bars already reach 1 Nov 2024.
- **I-4.** About 11 chance labels expected against 15 and 12 observed; covered by Limits.
- **I-5 (the split tables' sessions column).** PARTLY; fixed: each table carries its own counts.

## What the reviewers confirmed independently

- **L1** recomputed with fresh code that imports nothing from `analyze.mjs`:
  - Part A: the short and long headlines, against G1, by period, the volatility thirds and the arm means. Every point estimate matched, and every mulberry32 interval matched to 3 decimals.
  - Part B: the L0 self-check in BigInt decimal (189 of 189, 465 of 465; 31 and 70 valid), the tightness order and the recommendation.
  - Part C's counts; Part D in both windows, under three tie rules; every Part E row.
  - The git order: `30954dc2`'s `analyze.mjs` reproduces the first summary exactly, and the post-results changes touch only the paths named.
- **L2 and R2:**
  - The stored and fetched shards re-run byte for byte, and all 28,920 compact records equal `replay.json`.
  - Step 0 stops with no outcome computed when one export record is flipped.
  - `requests.json` agrees with the 241 bar files, the transcript and the provider function: one request each, no retry.
  - The long window uses stored verdicts and prices for the overlap. Rule 2: six added files only, and the import guard passes 72 of 72. Rule 7: no id, uid, email or list token in any output.
- **L3 and R3:**
  - Every hand-typed number in the report matches `summary.json` (0 mismatches over the bullets, the verdict table, the readings and every Part).
  - Every `file:line` citation says what the report claims.

## The delta review (`278c5edd` → `b2270519`)

The three lenses reviewed `278c5edd`. The scripts then gained new logic, and the report was largely rewritten. One more reviewer, on its own `git archive` of `b2270519`, checked every change against this record.
- **Prose.** It recomputed the rewritten report's prose from the final `summary.json` (78 scripted assertions and the three hand-built tables).
- **No fixed figure moved.** It re-ran both `analyze.mjs` versions on copies of the same inputs: all 15,741 pre-review values are identical.
- **New code.** It reimplemented the block bootstrap independently and confirmed each fix.

Its findings, all applied in the next commit:

| Id | Claim (short) | Severity | Disposition |
|---|---|---|---|
| DR-1 | The Fundamental Investor's quota ("at least 5 stocks above 70") cannot be met by any book, since only 2 of the 228 score above 70; its quota "median 2" was arithmetic, not a measurement | medium | **Fixed.** The quota reading records "cannot be met" when fewer than N stocks in the universe pass both rules (100% of mornings for the Fundamental Investor). R-10, founder question 4 and the Part E tables say so. The Speculator and the Capital Preserver are unchanged |
| DR-2 | "No evidence of a reversal" overclaims: the block interval's upper end only just clears zero | low | **Fixed:** "not robust evidence of a reversal" |
| DR-3 | "Every candidate did poorly" is unscoped; against G2 no candidate is worse over three sessions | low | **Fixed:** "every candidate's own three-session average was below zero" (short −0.21 to −0.37, long −0.03 to −0.20), and against G2 none is worse over three sessions |
| DR-4 | `fetchLong.mjs` leaks its lock on a thrown error after the lock is taken (it fails closed) | low | **Fixed:** an exit handler releases it on any exit, an interrupt included |
| DR-5 | The cap covers run folders under the same parent, not every run folder | info | **Fixed** in wording (report and this record) |
| DR-6 | The limit identity ties ATR and SMA_fast only; a planted swing high passes Step 0 | info | **Disclosed** in Step 0 and under SP-L2-2. Those facts come from the same re-run, which L2 reproduced byte for byte |
| DR-7 | The grep misses `node:https`, `undici` and similar imports | info | **Fixed:** they are added, and three planted forms trip it |
| DR-8 | Windows treats a drive-less `\x` as absolute, so `--run '\FREQ\x'` passes the absolute-path check | info | **Fixed:** on Windows `--run` needs a drive letter or a UNC path; `\FREQ\y` is refused before any folder is made |
| DR-9 | The long confirmation's "+0.15" double-rounds 0.1447 | info | **Fixed:** "+0.145" |
| DR-10 | This record's "0 mismatches" refers to the report at `278c5edd` | info | **Fixed** (the table above) |

## After the review

- `7133ec29`: script fixes for SP-L2-1 to SP-L2-4 and SP-L2-9, the sensitivity, the session-weighted means, the Part B rows and the per-table session counts.
- `43beaf0c`: the limit identity and strict merging (R2's acceptance cases), the quota reading, and "too few sessions".
- The delta-review commit: DR-1, DR-4, DR-7 and DR-8 in the scripts, and the wording fixes.
- The report: every fix in the table above.
- `summary.json`: every value present before the review is identical after it.

## Housekeeping

- **A stray empty folder `C:\FREQ\x` exists.** Lens L2 created it with a mis-quoted `--run` while testing the run-folder guard. Its own removal was blocked by the permission check, so it is left for the founder to delete; it holds nothing. `--run` now refuses a relative or drive-less path.
- **The run folder's `summary.json` changed during the review.** A determinism re-run at 17:03 CST rewrote it with identical bytes.
- **R1 and R2 edited their own snapshots' `lib.mjs`,** pointing it at their data copies, so those snapshots are not pristine archives. R2 wrote five stray script copies to `/tmp` by mistake and deleted them.
