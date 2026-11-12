# Build: Bomb mode — both directions, the Danger Zone, the levels table; then 'on' for everyone

**Date:** 2026-11-11 (the build prompt is dated Tue Nov 10). **Model:** Claude Opus 5.5, one local Claude Code session in the desktop app's worktree `.claude/worktrees/bomb-both-directions-8515b4` (local branch `claude/bomb-both-directions-8515b4`, pushed by refspec as **`claude/bomb-both-directions`**). **Brief:** "Bomb mode: both directions, the Danger Zone, the levels table, then 'on' for everyone" (BD-1 to BD-11, BO-1 to BO-4).

**Preamble.** `git fetch origin` ran first. `origin/main` was `7f883c9c` (the merge of PR #1032), and the worktree was clean on it. Read first, as the brief asks: `docs/BUILD_RULES.md` (§1, §2, §9, §10, §11); the Build A spec `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md` (BA-1 to BA-6, §3.1, §3.6, §4.3, the 2026-11-07 rulings); the Nov 7–8 flip report `docs/audits/20261108_FLIP_RESEARCH_MODAL_BOMB_MODE.md` (BF-3, the red-row dispositions, the kill-switch method, the WSL pattern); `src/utils/stockThresholdModel.js`; every file in `src/components/Research/BombMode/`; `BaggerBombTab.jsx` (`StockRewardDetails`); `AgentBattleScreen.jsx` (`StockDispatchRow`, the Why? panel, `openResearchTarget`, `bombModeOn`); `Sheet/sheetOpen.js`. **Fenced files (BUILD_RULES §1): none edited, none called.** The production reads below used the Admin SDK `.get()` / `.select()` only, with the main checkout's `.env.local` in place; nothing was written; no EODHD, Anthropic or OpenRouter call was made; no uid or email is in this report.

**The founder merges. Nothing reaches players until he does.**

## Executive verdict

| # | Area | Status | What the player sees | What they saw before |
|---|---|---|---|---|
| 1 | **PR 1** (the refinement) | **Built, ready for the founder's merge: PR #1041.** Branch `claude/bomb-both-directions`; its head is in the PR description. | Everything below, on the allowlist (the founder and FT_QA) until PR 2. | — |
| 2 | **PR 2** (`'allowlist'` → `'on'`) | **Built as a DRAFT: PR #1042.** Branch `claude/bomb-mode-on`, one commit `d920c1a5`. BO-1 passed. **Merge only after PR 1 and the phone check.** | Bomb mode for every player in a live agent battle. | Bomb mode only for the founder and FT_QA. |
| 3 | Both directions (BD-1, BD-3) | Built | Bust, Crash and Meltdown with names, prices and % on one scale with the upside; a hit rung reads `BUST · HIT 1:15`. | "−10 −20 −35" ticks in a "Below · compressed" strip. |
| 4 | The lead (BD-2) | Built | The nearer side's pill is the strong one; it changes only when the other side is a full brick nearer, so a flat stock doesn't flicker. | One pill, always the upside's, even when Bust was nearer. |
| 5 | The bar and its line (BD-4) | Built | Meltdown … TenBagger on one bar; `↓ 3.2% · 5 bricks to Bust −10 · ↑ 4.8% · 8 to +15`; "What has to happen" names the side that leads. | Entry → upside only. |
| 6 | The Danger Zone (BD-5) | Built | Within 0.5 % above the next rung down, the 💣 view becomes the "Danger zone" (red goal line, the distance as the big number). A hit plays nothing, one quiet line names it. | Nothing near the downside. |
| 7 | The levels table (BD-6) | Built | "All levels" under the bar: seven rows by price, a live marker, banked / hit / next states, a collapsed Details. | The old stats table, only in the Why? popup. |
| 8 | Why? (BD-7) | Built | The proximity line, then "See all levels ›", which opens 💣. | The whole stats table, filling the popup. |
| 9 | The chip (BD-8) | Built, **one reading for you** (§1.3) | `scored $268.09 at the 1:00 check`. | `scored … at 12:44` (the quote's own minute). |
| 10 | The entry time (BD-9) | Built | The price's own time: SYK `Mon 4:05 PM`; AMZN **`Tue 11:00 AM`** (16 min before the 11:16 commit, §1.2). | `Mon 10:21 PM`; `Tue 11:16 AM`. |
| 11 | Suites, both PRs | **All green on Linux** | — | — |
| 12 | Mutation | **PR 1: 7 of 7 of the brief's mutants killed; 38 of 38 review-fix mutants killed.** All files restored byte for byte (SHA-256). | — | — |
| 13 | Review (§2 threshold) | **Run: four lenses + four refuters.** 29 files, +2,097 / −283 at the review head; 30 files after the fixes. Every confirmed in-scope finding fixed; the rest reported or put to you as questions (§6, §10). | — | — |
| 14 | Phone renders | 375×812 screenshots in Edge, 0 overlaps, page width 375 (§7). | — | — |

---

## 1. The three read-only questions (one line each)

| ID | Answer |
|---|---|
| **BD-I1** | **It committed with a 12:44 quote.** The 1:00 check committed at 1:00:59 PM ET (evaluation `eval_010`; its tick record was written at 1:01:04 PM), two minutes before the 1:02 screen, so the screen did not miss a check and nothing was still queued. The quote it scored carries EODHD's own time, and on this battle every quote's provider time runs 15.5–17.5 minutes behind the moment the evaluator observed it. So the chip printed 12:44. **Report only** (the scorer is out of scope). **BD-8 ships, and it must name the check from the observation time, not the quote's time** (§1.3). |
| **BD-I2** | **The battle started Monday night (10:21 PM ET), and SYK's fill is Monday's 4:05 PM ET trade** (`fillQuote.quoteAsOf` = 2026-11-09T21:05:00Z), inside Monday's extended session (4:00–8:00 PM ET). BD-9 goes ahead. One correction to its premise: during the session the fill quote's time is **about 16 minutes** before `enteredAt`, not "within a minute" (AMZN: 11:00 AM vs 11:16 AM), for the same reason as BD-I1. |
| **BO-1** | **Passes.** `stockThresholdControl/admission`: `enabled: true`, `audience: { mode: 'all' }`, `schemaVersion: 2`, `epoch: 2`, last written **2026-10-28 19:24:00 UTC** (3:24 PM ET, Oct 28). PR 2 is built. |

### 1.1 BD-I1 — why both chips read "scored … at 12:44" on a 1:02–1:03 PM ET screen

**The battle.** One agent battle expiring on Nov 10 (ET) held AMZN and SYK: **`jWQjlmkxHyo2TFm0UILN`** (`baggerbomb_agent`, `fullday`, activated 2026-11-10T03:21:13.902Z = Mon Nov 9, 10:21 PM ET; trading day `2026-11-10`; expires 2026-11-11T01:00Z = the 8:00 PM ET Night Game close, because it holds BTC; completed). It is the only battle expiring Nov 9–14 that held both. Its AMZN fill is $270.22 and its SYK fill $325.73, the founder's numbers. SYK left the roster at the 1:30 check (a swap to CHTR).

**What was read (VERIFIED, production, read-only):**

| Record | AMZN (`9b53b628…`) | SYK (`757cc4b2…`) |
|---|---|---|
| Receipt `enteredAt` | 2026-11-10T16:16:05.359Z (Tue 11:16:05 AM ET) | 2026-11-10T03:21:18.150Z (Mon 10:21:18 PM ET) |
| `fillQuote.quoteAsOf` | 2026-11-10T16:00:00Z (Tue 11:00 AM ET) | 2026-11-09T21:05:00Z (Mon 4:05 PM ET) |
| `fillQuote.observedAt` | 2026-11-10T16:16:03.524Z | 2026-11-10T03:21:15.424Z |
| Latest committed context: `quoteEvidence.providerAsOf` | 2026-11-10T20:29:00Z (3:29 PM ET) | 2026-11-10T18:14:00Z (1:14 PM ET) |
| … `quoteEvidence.observedAt` | 2026-11-10T20:45:58.249Z (the 3:45 check) | 2026-11-10T18:30:30.452Z (the 1:30 check, its last) |
| … `currentPrice` | $271.78 | $321.47 |
| `evidence.px` at the 1:00 check (`eval_010`) | $268.09 | $323.13 |

`scoreState.lastScoredAt` (today's latest) is 2026-11-10T20:45:58.248Z, the 3:45 check.

**When the 12:45 and 1:00 checks committed** (the battle's `evaluations[]` and its `ticks` capture records):

| Check | Evaluation entry | Tick record written | Score version | Total |
|---|---|---|---|---|
| 12:45 | `eval_009` at 17:45:59.686Z (12:45:59 PM ET) | `:14` at 17:46:07.776Z | 29 | −172 |
| 1:00 | `eval_010` at 18:00:58.906Z (1:00:59 PM ET) | `:15` at 18:01:03.900Z (1:01:04 PM ET) | 31 | −166 |
| 1:15 | `eval_011` at 18:16:01.756Z (1:16:01 PM ET) | `:16` at 18:16:09.917Z | 33 | −164 |

**The lag, read on every quote the battle stored** (observation minus provider time): the committed contexts of DHI 17 m 30 s, GIS 15 m 29 s, SYK 16 m 30 s, ARE 16 m 29 s, MOS, DG, TTWO, AMZN and CHTR 16 m 58 s each, CCI 15 m 58 s; the intraday fill quotes of AMZN 16 m 03 s, TTWO 16 m 44 s, CHTR 16 m 39 s, CCI 16 m 02 s. **Every quote's provider time is 15.5–17.5 minutes older than the check that read it.**

**What happened (the 1:00 check's own provider time is INFERRED; the commit times are READ).** The 1:00 check's contexts were overwritten by later checks, so its exact `providerAsOf` is not on the record any more. It observed its quotes at about 1:00:30 PM ET; with the 15.5–17.5-minute lag measured above, their provider time is 12:43–12:45 PM, which is the "12:44" the founder saw. The 12:45 check's quotes would carry about 12:28–12:30 PM, and the 1:15 check had not run by 1:03. So the screen at 1:02–1:03 held the **1:00 check's committed context**, and it printed that context's provider minute.

- Did the 1:00 check commit after 1:03 (still in the queue)? **No**: 1:00:59 PM.
- Did it commit with a 12:44 quote? **Yes**: the quote EODHD timestamps 12:44, observed at the 1:00 check.
- Did the screen miss a committed check? **No**: "12:44" can only come from the 1:00 check.

**Report only.** The scorer and the quote source are out of scope. Two observations for separate tasking:
1. Every check scores a quote about 16 minutes older than the check. The same delay is in every fill quote.
2. On the founder's screen, the modal's live AMZN price ($268.09) equalled the 1:00 check's scored price, so the modal's "live" quote may carry the same delay. This is ASSUMED, not read.

### 1.2 BD-I2 — why SYK's entry reads "Mon 10:21 PM"

The entry label prints `stockThresholdReceipt.enteredAt`, the wall-clock moment the battle was created (Mon 10:21:18 PM ET; the battle's `activatedAt` is 10:21:13 PM). The price itself is Monday's **4:05 PM ET** trade (`fillQuote.quoteAsOf`), observed at 10:21:15 PM. `sourceSession` is `2026-11-09`. 4:05 PM is inside Monday's extended session (post-market, 4:00–8:00 PM ET), so BD-9's gate passes. The battle's other overnight fills are the same shape: DHI 4:00 PM, ARE 4:00 PM, DG 4:00 PM, GIS 4:09 PM, MOS 4:29 PM.

**The premise "during the session the two are within a minute" does not hold here.** For the intraday entries the fill quote's time is about 16 minutes before `enteredAt` (AMZN 11:00:00 vs 11:16:05 AM; TTWO 11:14 vs 11:30 AM; CHTR 1:14 vs 1:30 PM; CCI 1:30 vs 1:46 PM), for BD-I1's reason. **BD-9 is built as ruled**, so AMZN's entry line moves from "Tue 11:16 AM" to **"Tue 11:00 AM"**, the price's own time. The founder's checklist item 8 says so.

### 1.3 Built differently from the letter, for the founder to confirm: BD-8's check

The ruling says the chip's check comes from `checkSlotOf(scored.atMs, …)`. `scored.atMs` is the quote's provider time (`quoteEvidence.providerAsOf`, Build A §3.2). With the ~16-minute lag, that names the **wrong check on every live chip**:

| AMZN at the 1:00 check | Instant | `checkSlotOf` → chip |
|---|---|---|
| The letter: `scored.atMs` (provider time) | 17:44:00Z (12:44 PM ET) | `scored $268.09 at the 12:30 check` ✗ |
| Built: `quoteEvidence.observedAt` | ≈18:00:30Z (1:00:30 PM ET) | `scored $268.09 at the 1:00 check` ✓ |

**Built:** the record carries the context's `quoteEvidence.observedAt` (the moment the check read the quote) as `scored.checkAtMs`, and the chip names `checkSlotOf(scored.checkAtMs, …)`. The price and its provider time are unchanged. **Question for the founder:** keep this, or build the letter?

---

## 2. PR 1 — the rows as built

| ID | What the player sees | Built (file) | Rows |
|---|---|---|---|
| **BD-1** | Both directions on one ladder: Bust, Crash and Meltdown carry names, prices and % like the upside; the distance down is measured the same way as up. | `ladder.js`: `finish` → `nextDown`, `hitPoints`; `hit` on a crossed downside rung; `toGoDown`; `brickUnit`; `brickPlan(ladder, BUST_TIERS)`; `rungPct`. | `bothDirections.test.js` "BD-1" (9 rows): the founder's AMZN reproduces Bust $259.53, +15 $280.91, ↓ 3.19 % · 5 bricks, ↑ 4.78 % · 8 bricks; `bricksSupported(BUST_TIERS)` pinned; the downside counts alone go if the bust multipliers leave whole bricks. |
| **BD-2** | The lead side doesn't flicker on a flat stock: it moves only when the other side is a full brick nearer. | `ladder.js stepLead`, `LEAD_BAND_BRICKS = 1`; the state in `useBombView` beside the zones, reset with the symbol. | `bothDirections.test.js` "BD-2" (9 rows: ±0.45 brick for 200 steps never switches, from either lead; a steady one-brick move switches once; at entry the lead is up; no next rung never leads; zones force it); `useBombView.bothDirections` (band in the hook, reset with the symbol, the sheet line follows). |
| **BD-3** | The Fuse shows the whole ladder at one scale, both ways; the lead's pill is strong, the other quiet; the bead's halo and the rail turn red when the stock is heading down; a hit rung reads `BUST · HIT 1:15`. | `FuseChart.jsx` (rewritten layout); `pricedRungs` (drop-price rule, then the inline next price). | `bothDirections.views` "BD-3" (8 rows) and the 375-px legibility block: 7 cases × 5 heights (280, 324, 354, 375, 404) with **no two label boxes overlapping**, every name and points kept; the drop-price row at 280 px. Build A's Fuse rows: two rewritten (§3). |
| **BD-4** | Under the chart: Meltdown on the left, TenBagger on the right, entry in the middle; one to-go line, lead first (`↓ 3.2% · 5 bricks to Bust −10 · ↑ 4.8% · 8 to +15`); "What has to happen" names the side that leads. | `BombSheet.jsx` (bar), `sheetToGo`; `bombView.sheetLine` (lead-aware). | `bothDirections.views` "BD-4" (10 rows), incl. the ruling's example line to the character, the band's live number, and the three "what has to happen" templates. |
| **BD-5** | Within 0.5 % above Bust (or the next unhit downside rung) during the session, the 💣 view becomes the **Danger zone**: the rung as a red goal line, the distance as the big number, `to Bust −10 · 0.42%`, the clock and the scored chip; a hit plays nothing, one quiet line names it. | `redZone.js stepDangerZone`, `stepZones` (same constants); `RedZone side="down"`; `BombPlot` routing and chip; `useBombView` (zones, hit times, spectate series, 1-s clock); `sheetOpen.js` (FQ-9). | `dangerZone.test.js` (21 rows: bands, close, never on preview/crypto, no moment, both zones at once); `useBombView.bothDirections` "BD-5" (5 rows); `bothDirections.views` "BD-5" (5 rows); `sheetOpen.test.js` +1 row. Build A's 23 red-zone rows unedited and green. |
| **BD-6** | Under "What has to happen", **All levels**: seven rows by price with the live marker where the price sits; points and state per rung (`✓ banked 1:15`, `hit 1:15`, `next · 8 bricks`); a collapsed **Details** with the exact facts the old stats table had. | `BombSheet.jsx levelRows`, `LevelsTable`, `Details`; `selectBombRecord` carries `record.details` from the committed context; `bombView.rungFacts`, `liveMovePct`. | `bothDirections.views` "BD-6" (8 rows) incl. **display agreement**: every rung's % and price are the same strings in the Fuse, the bar and the table, and the pill equals the bar's lead text. |
| **BD-7** | Battle View → Why?: the proximity line, then **See all levels ›**, which opens 💣 with the levels table. With Bomb mode off, nothing changes. | `AgentBattleScreen.jsx`: `StockDispatchRow onSeeAllLevels` (passed only when `bombModeOn`), `handleSeeAllLevels` through the screen's own door, `bombLevelsDoor` (dropped when research closes), `opensOnBomb` on the three mounts; `AssetResearchModal.jsx opensOnBomb`. | `AgentBattleScreen.bombModeOn.jsdom` +3 rows (the door opens AAPL on 💣 with `opensOnBomb`; a later plain tap carries none; off = today's panel); `AssetResearchModal.sheetModeOn.jsdom` +1 (with the sheet on, the door still lands on 💣 and the table). The three mode-off goldens unchanged and green. |
| **BD-8** | The chip names the check: `scored $268.09 at the 1:00 check` (or `at Mon's 3:45 check`). | `bombView.scoredAtText` from `scored.checkAtMs` (= `quoteEvidence.observedAt`, §1.3). | `bothDirections.views` "BD-8" (3 rows on the production-shaped AMZN: provider 12:44, read 1:00:28 → "the 1:00 check", never 12:44/12:30); Build A's chip rows rewritten (§3). |
| **BD-9** | The entry line shows the price's own time: AMZN `Entry $270.22 · Tue 11:00 AM`, SYK `Mon 4:05 PM`. | `selectBombRecord`: `entry.atMs` = `fillQuote.quoteAsOf` (label, ghost split, check dots). | `bothDirections.views` "BD-9" (2 rows); `selectBombRecord.test` measured row rewritten to assert `quoteAsOf ≠ enteredAt` in the harness. |
| **BD-10** | No downside line says "banked"; no "will"; "Danger zone" is the only new name. | Every string in `bombCopy.js`; downside keys `down…`/`danger…`; downside nodes `data-side="down"`. | `bombCopy.honesty` +8 rows (enumerated by key prefix and by rendered downside node; no "will"; the two zone names only; no agent verb; a preview's table has no state and no "entry"), and the forbidden-terms nets now render the new views in every state. |
| **BD-11** | — | "Refinement — both directions (2026-11-10)" appended to the Build A spec. | — |

## 3. Existing rows rewritten (and why)

Every rewrite follows a ruling that changes the row's subject; none was loosened to pass.

| File | Row | Was | Now | Ruling |
|---|---|---|---|---|
| `bombView.test.js` | five chip rows | `… scored $160.19 at 1:00` | `… at the 1:00 check` | BD-8 |
| `bombView.test.js` | held sheet line | `Needs $161.20 at a check · next check 3:45` | `Needs $161.20 at a check for +15 · Bust at $150.00 · next check 3:45` | BD-4 |
| `selectBombRecord.test.js` | measured scored price | `entry.atMs = enteredAt`; `scored = { price, atMs, source }` | `entry.atMs = fillQuote.quoteAsOf` (asserted ≠ `enteredAt`); `scored` also carries `checkAtMs = observedAt` | BD-9, BD-8 |
| `selectBombRecord.test.js` | latest check read | `scored` without `checkAtMs` | with `checkAtMs` | BD-8 |
| `selectBombRecord.test.js` | measured check dots | "since the receipt's enteredAt" | "since the fill quote's time", plus a check between the two instants that is now drawn (review C7) | BD-9 |
| `FuseChart.jsdom.test.jsx` | (the D1 helper) | — | also: nothing in the line may refuse to wrap (review C12) | BD-4 |
| `FuseChart.jsdom.test.jsx` | right-of-rail live label | 12 live prices, ≥ 3 must land right | the same 12 + 100.7, 105.5, 97.2 (the full-scale right column has fewer clear gaps; the row still checks ≥ 3 right-hand labels against every block) | BD-3 |
| `FuseChart.jsdom.test.jsx` | the two "D1" sheet rows | the SVG to-go text clamped by x | the to-go line is HTML in the sheet's flow (wraps), outside the SVG, `overflow-wrap: anywhere`, at 270 px too | BD-4 |
| `AssetResearchModal.bombModeOn.jsdom` | entry label; held line; red-zone chip; earlier-session chip | `WED 10:02 AM`; `Needs $X at a check · …`; `at 1:00`; `at Wed 10:02` | `WED 9:47 AM`; `… for +15 · Bust at $98.73 · …`; `at the 1:00 check`; `at Wed's 10:00 check` | BD-9, BD-4, BD-8 |
| `Sheet/packs.test.js` | Build C's entry marker | `Entry · Wed 10:02` | `Entry · Wed 9:47` | BD-9 (see §9 item 3) |

## 4. Checks — PR 1

All on Linux (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, lockfile `40382e64edb6`, `node_modules` linked to `~/pd-af0`'s install of that lockfile), in this session's detached worktree `~/pd-ci-bombdir`. Exit codes are read from each run's own exit; nothing is piped through `tail`; the `Test Files` lines are vitest's own.

| Check | Tree | Result |
|---|---|---|
| Full suite, `vitest run --maxWorkers=8`, `flock /tmp/pd-suite.lock` | `519968d3` (the code after the review fixes) | **exit 0** · `Test Files 1391 passed \| 9 skipped (1400)` · `Tests 30399 passed \| 107 skipped (30506)` · 296 s |
| `npm run test:rules` (Temurin JDK 21) | `519968d3` | **exit 0** · `Test Files 40 passed (40)` · `Tests 727 passed (727)` |
| `npm run lint:gate` | `519968d3` | **exit 0** |
| Minified build (`vite build`) | `519968d3` | **exit 0** |
| The three mode-off goldens (`AssetResearchModal.bombModeOff`, `AgentBattleScreen.bombModeOff`, `AgentBattleScreen.sheetModeOff`) | in the suite above | **green, files unchanged**: the off path renders, and hands the modal the same props, byte for byte |
| Full suite on the build commit before the review | `c68df6e7` | exit 0 · `1391 passed \| 9 skipped (1400)` · `30366 passed \| 107 skipped (30473)` |
| The pushed head (this report and the test-only commit `473ab139` on top of `519968d3`) | the commit carrying this report | the full suite, `lint:gate` and the minified build re-run on the exact pushed commit; results in the PR description |

`origin/main` was re-fetched before the final checks and had not moved from `7f883c9c`, so there was nothing to merge.

## 5. Mutation — PR 1

The runner (`mutate.mjs`, session scratchpad) works on a `git archive` snapshot of `519968d3`. For each mutant: a control run of its test files (unmutated, exit 0), one exact edit that must land exactly once (else BROKEN), the run, then a byte-for-byte restore checked by SHA-256. Killed means a non-zero exit **and** failed rows in the JSON report (a crashed worker is never a kill).

**The brief's seven: 7 of 7 killed, all restored.**

| # | Mutant | Edit | Result | Rows that caught it (first) |
|---|---|---|---|---|
| M1 | The lead rule becomes "nearer side, no band" | `ladder.js stepLead`: `dn <= u − 1` / `u <= dn − 1` → `dn < u` / `u <= dn` | **killed**, 4 rows | `bothDirections.test` "±0.45 brick for 200 steps never switches", "…from a down lead" |
| M2 | A downside rung disappears from the Fuse | `FuseChart.jsx`: `ladder.down.map(` → `.filter(r => r.key !== 'crash').map(` | **killed**, 10 rows | "the downside rungs are drawn like the upside…", the 375-px legibility cases |
| M3 | A downside string says "banked" | `bombCopy.js downLevelHit`: `hit…` → `banked…` | **killed**, 3 rows | honesty "no downside template says 'banked'", "no rendered downside node says 'banked'" |
| M4 | The Danger Zone enters on a preview | `redZone.js stepDangerZone`: drop `held !== true \|\|` | **killed**, 3 rows | `dangerZone.test` "a preview … never enters", "a loading ladder seeds nothing" |
| M5 | The Why? panel shows `StockRewardDetails` with Bomb mode on | `AgentBattleScreen.jsx`: `typeof onSeeAllLevels === 'function'` → `false && …` | **killed**, 2 rows | `AgentBattleScreen.bombModeOn` "mode 'on': no StockRewardDetails block…" |
| M6 | The chip prints the quote's minute instead of the check | `bombView.js scoredAtText`: `slot !== null` → `slot === -1` | **killed**, 10 rows | `bombView.test` chip rows; `bothDirections.views` "the 1:00 check, not the quote's minute" |
| M7 | The table's price for a rung differs from the Fuse's | `BombSheet.jsx`: `levelSub(pctText, facts.priceText)` → `levelSub(pctText, money(r.price + 0.01, d))` | **killed**, 2 rows | "each row: …", **DISPLAY AGREEMENT (§9)** |

**The review fixes and lens C's coverage rows: 38 of 38 killed, all restored.** At first 36 were killed; RD4 and RD5 survived because their rows could not fail (a vacuous `decimals: 2`, and a clamp that hid the goal's position). Both rows were made able to fail, and both mutants were then killed. There is one mutant per fix and per lens C survivor:
- RA1, RA3, RA6a, RA6b, RA8, RA9;
- RB1, RB1b, RB2, RB4;
- RD1, RD4, RD5, RD6, RD7, RD9;
- RC1 (BD-8 at the selector), RC2 (the Fuse ignores the banded lead), RC3a–c (the Danger Zone through the plot), RC4, RC5, RC6a–b (Details), RC7 (check dots since `enteredAt`), RC8a–d (the door at the source; the proximity line kept), RC9a–b (an inline price on its points; labels past the right edge), RC10 (float slack), RC11a–b (the honesty net's per-kind counts; the all-hit wording), RC12 (`nowrap` on the to-go line);
- RN1 (the band's edge), RN5 (amber in the Danger Zone).

The per-mutant results are in three files beside this report's copy (in `BombBothDirections/`). *(Corrected 2026-11-11 by the pre-flip fix PR, BP-8. This line first named one file, `mutants.result.json`, which is not there.)*
- `mutants-brief.result.json`: the brief's seven, M1–M7, all killed.
- `mutants-review.result.json`: the 38 review-fix and lens C mutants, first pass. RD4 and RD5 read SURVIVED there.
- `mutants-review-RD4-RD5.result.json`: the rerun of RD4 and RD5 after their rows were made able to fail. Both killed.

## 6. The review (BUILD_RULES §2)

**Why:** at the review head (`7dca40e8`) the cumulative diff was 29 files, +2,097 / −283, past both thresholds. After the fixes it is 30 files, +2,531 / −289.

**How:**
- Four lenses, each on its own `git archive` snapshot with `node_modules` junctioned, read-only on git and on the shared tree.
- One refuter per lens, on a fresh snapshot, told to refute every finding with a concrete repro.
- Lens D and its refuter measured real browser boxes in headless Edge: 70,740 renders, with three monospace faces standing in for a phone's.
- Lens C planted 113 mutants.
- The fixes are in `519968d3` and `473ab139`.

### 6.1 Lens A: display honesty (§9)

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| A1 | The brick count divided a displayed distance by an exact unit. At the fill, about half of all positions printed "7 bricks" to a rung drawn on brick 6 (AMZN at $270.22). | CONFIRMED: 50.4 % of 20,000 positions; partly inherited | **Fixed.** The unit is now taken from the displayed prices (`shownBrickUnit`); a sweep reads 6 both ways. |
| A2 | The sheet line states the scoring condition at the display-rounded price, but the scorer compares the exact target. At that exact cent the sentence is false for about half of all rungs: "Bust (−10) if it's at or below $97.63" when the exact Bust is $97.625. The founder's AMZN: 4 of 6 rungs. | CONFIRMED for the conditional lines (`upNeeds`, `downIfAtCheck`; Build A's `needsFor` and `afterBank` are inherited). PARTLY for the hedged ones. | **Question Q2 (§10), not built.** The fix rounds each rung in its award direction (upside up, downside down). That moves prices you quoted by a cent: $286.25 → $286.26, $291.59 → $291.60, $254.19 → $254.18, $248.85 → $248.84. |
| A3 | Screen readers announced the Danger Zone's SVG as "Red zone", and the aria-labels I edited were inline literals. | CONFIRMED | **Fixed.** It has its own label, and every edited label is in `bombCopy.js`. |
| A4 | The Details footnote says "half-even", but Bomb mode prints `toFixed` cents. | PARTLY: 0 differences in 300,000 realistic rung prices | Reported. The footnote is carried unchanged, as ruled. |
| A5 | "+3.96 %" (from the displayed prices) sits beside Details' exact "3.954943 %". | As ruled | Founder note (§10). |
| A6 | A live price exactly on +15 sat under +15 in the table, while the bar said "At +15". "+0.0 %" was painted red. | CONFIRMED | **Fixed.** A tie sits past the rung in its award direction, and the colour follows the printed %. |
| A7 | The pill's % is rounded twice (2 dp, then 1 dp). | CONFIRMED: a nit, inherited on the upside | Reported. |
| A8 | For one render after the last upside bank, the line and the to-go line disagreed on the lead. | CONFIRMED: one frame | **Fixed** in the hook. |
| A9 | "Every rung below hit" was defined but never used. | CONFIRMED | **Fixed.** The bar's line and the Fuse's quiet pill now say it. |
| A10 | The no-slot fallback prints the provider time, and a read 15 minutes or more after its slot names the next slot. | Code CONFIRMED; production reach not established | Reported. |
| A11 | For a bank seen after 4:00 PM, the red-zone chip says "live" while the sheet chip says "last". | Inherited; reach not established | Reported. |
| A12 | Check dots starting at `quoteAsOf` could draw an earlier same-symbol position's dot. | **REFUTED**: a sold name is on a 24-hour cooldown | — |

### 6.2 Lens B: wiring and lifecycle

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| B1 | The zone memory and seen times were keyed to the symbol, not the position. A sold and re-bought ticker would name the first position's check. | PARTLY: real on both sides (the red side is inherited), but the reach is narrow because of the 24-hour re-buy cooldown | **Fixed** with the refuter's safe version: reset on a new non-null position, but survive a one-frame null. Two rows. |
| B2 | A preview turning held kept the preview's lead, because BD-2 resets only with the symbol. | PARTLY: a gap in the ruling's letter | **Fixed.** The lead takes a fresh first look when the ladder flips between preview and held. |
| B3 | On a two-decimal tie, the first frame's lead ignores the zone (thresholds about 0.5 % or less). | CONFIRMED: one frame | Reported. |
| B4 | The first frame's `mode` was `undefined`. | CONFIRMED: every consumer read it as the Fuse | **Fixed**: `mode: 'fuse'`. |
| B5 | The Danger Zone draws one empty frame when its last rung is hit. | PARTLY: the live-null half is refuted, and the shape is Build A's | Reported. |
| B6 | The door's intent lasts the whole research session. | **REFUTED**: it is read only at open, and the overlay blocks taps | — |
| — | A red banked moment that interrupts a showing Danger Zone leaves the view red afterwards. | A fact, not a defect | **Question Q4 (§10).** |

Lens B checked these and found them clean:
- the three mode-off goldens;
- the Why? panel with Bomb mode off is byte-identical to `main`'s (rebuilt by reverse patch);
- no new prop is passed when the mode is off;
- requests: the Danger Zone asks exactly what the red zone asks (the 1-minute series and its 15-second poll), with no new request;
- League battles, crypto and previews never enter a zone;
- a hit's check and its score share one commit;
- no render loops;
- the new hooks sit above the screen's early return.

### 6.3 Lens C: test integrity (113 mutants: 84 killed, 29 survived)

No row asserted wrong behaviour. Every survivor is code that is correct as built but that no row would catch if it broke. The refuter applied every survivor at once and ran it against roughly 72 more test files found from the import graph: 0 failures. So lens C's set was not too narrow.

| ID | Survivor (mutant) | Refuter | Row added (mutant now killed, §5) |
|---|---|---|---|
| C1 | BD-8's `checkAtMs` taken from `providerAsOf` (SEL2): in the harness both are 14:02 | CONFIRMED | A selector row on the real harness with the quote 16 minutes older than the read: "the 10:45 check", `checkAtMs ≠ atMs` (RC1) |
| C2 | The Fuse ignoring the hook's banded lead (F21, P3) | CONFIRMED (the honesty net renders other leads, but only scans words) | $270.22 → $269.50: the hook keeps up while a first look says down; BombPlot draws `data-fuse-lead="up"` (RC2) |
| C3 | The Danger Zone through the plot: no chip (P4), no hit times (P5), a closed chip saying "live" (U12) | CONFIRMED | Three hook → BombPlot rows: "…at the 1:00 check"; after 4:30 PM, "last …"; the seen hit line (RC3a–c) |
| C4 | The banked moment losing to a showing Danger Zone (R8): the row could not fail | CONFIRMED, not equivalent | The row now starts with the Danger Zone showing (RC4) |
| C5 | The hook's "never for a preview" row was vacuous (its Bust was 3.4 % away) | CONFIRMED | The preview's Bust is inside the band, asserted (RC5) |
| C6 | Details: selector dropped (SEL3), wrong price (SEL5), hook drop (U5) | CONFIRMED | The selector's Details equal the committed context's fields; the hook passes them to the sheet (RC6a–b) |
| C7 | Check dots since `enteredAt` (SEL4): no dot between the two instants | CONFIRMED | A check at 13:55, between `quoteAsOf` 13:47 and `enteredAt` 14:02, is drawn; the stale row title is corrected (RC7) |
| C8 | The gated door (SC2, SC3, SC5, SC10, flag-dark) and the proximity line dropped with the door (SC7x, live path) | CONFIRMED | Source rows for every mount's `opensOnBomb` spread and the door's routing; the 'on' row asserts the proximity panel (RC8a–d) |
| C9 | The 375-px box test: an inline price drawn on its points (F13); labels past the right edge (F14) | PARTLY (F12 was killed by the narrow-sheet row; the overlap rows share the component's box model) | Same-line boxes inside one rung now count; every label must end inside the plot (RC9a–b). The model's glyph width is checked in Edge (§7) and on the phone (checklist item 9). |
| C10 | No float slack on the downside count (L14): $99 at 3 % read 3 bricks at $97.02 | CONFIRMED (30 natural cent prices on a small grid) | Float-exact distances read exact counts on both sides (RC10) |
| C11 | The honesty net: the per-node scan shrinks silently without `data-level-side` (B6); no all-downside-hit state (B12x) | PARTLY (the pills' and line's copy come from `down…` templates the net already scans) | Every node kind counted; an all-hit state rendered with its own wording (RC11a–b) |
| C12 | The rewritten D1 rows let `white-space: nowrap` through (B9, B10) | CONFIRMED | Nothing in the line may refuse to wrap (RC12) |
| N1 | The band's edge, `<=` → `<` (L1) | CONFIRMED (reachable: $100 at 6 %, live $99.50) | `stepLead('up', { up: 6.5, down: 5.5 })` is down (RN1) |
| N5 | The Danger Zone's accent swapped for the amber heat (RZ3) | CONFIRMED | The numeral's colour is the risk red, not amber (RN5) |
| N6 | `[data-rz-banked-moment]` null on the downside cannot fail; the `key === 'bust'` filter was needless | PARTLY | The filter is removed (every Fuse price asserted at 354 px); the moment row stays as documentation |

### 6.4 Lens D: mobile layout, motion, tokens

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| D1 | After the close, the Danger Zone's "Market closed · last tick 3:59 PM" tag wrapped and covered the big number: always at 320; at 375 in a monospace face 0.596 em or wider. | CONFIRMED, new (the red zone's own layout clears it) | **Fixed** with refuter D's tested layout: the tags, numeral, sub-line and hit line in one flow column, and the plot starting under it. |
| D2 | The quiet hit line wrapped onto the numeral. | PARTLY | **Fixed** by the same column. |
| D3 | A trace that fell 0.6 % or more over the hour ran through the numeral. | PARTLY: real, and **main's red zone has the same exposure** | **Fixed for the Danger Zone** (its plot starts under the text). The red zone's is reported. |
| D4 | With live at or below the rung, the goal line struck through the text or left the plot. | PARTLY: it mirrors a gap in main's red zone (`lo`) | **Fixed for the Danger Zone**: the goal is always the window's edge, and it is clamped. The red zone's is reported. |
| D5 | On a crowded side, an inline price could run past the SVG edge (sub-cent tokens). | CONFIRMED, new | **Fixed.** It drops to 7 px, or is dropped; the table carries it. |
| D6 | With all three upside rungs banked, the bar's "+30 ✓" and "+50 ✓" collided. | CONFIRMED, new | **Fixed.** The bar's labels carry no tick; the green check disc marks a banked rung. |
| D7 | At 320×280, a live price just above the baseline put its label on the baseline's title. | PARTLY: 320 only, new | **Fixed.** No band is reserved at the baseline right of the rail. |
| D8 | With all upside rungs banked and their times shown, at 320–360 px the live label touches a long "… · BANKED · 12:45" title. | PARTLY: main has it too | Reported. |
| D9 | The to-go line could leave an arrow at a line end, or start a line with "·". | CONFIRMED | **Fixed** with no-break spaces. |
| D10 | "See all levels ›" drew at 16 px, because `index.css` forces every button to 16 px. | CONFIRMED | **Fixed.** The size is on a span, with 8 px of padding for the tap target. |
| D11 | Titles and pills had sub-pixel em-box contact in one face. | **REFUTED**: that face's descent exceeds the box model, and no ink touches | — |
| D12 | The Fuse, bar and table draw the downside in `BT.red` (`--ft-neg`), while the Danger Zone uses `BT.risk` (`--ft-red`). | PARTLY | **As ruled**: BD-3 names `BT.red`, BD-5 names `BT.risk`. Founder note (§10). |
| D13 | Same as A3. | CONFIRMED | Fixed. |
| — | Refuter D's extra finding: the Fuse places labels at 0.6 em per glyph. On a phone whose bold monospace is wider (Lucida's synthetic bold is 0.62 em), 129 renders at 375 show small overlaps. | Depends on the face; unverified on a phone | **Phone checklist item 9.** |

Lens D measured these clean:
- 49,140 Fuse renders: 19 ladders × 15 live positions × widths 320–430 × heights 280–404, in two faces;
- 3,360 sheet renders: no horizontal scroll, no table rows overlapping;
- 7,800 Danger Zone renders, apart from D1–D4;
- `motion.guard`, `tokens.guard` and `bombMotion` are green: no hex, no `transition={{`, and SVG colours go through `style`.

## 7. Phone renders (375×812)

The real components were rendered to static HTML at 375 px, with `tokens.css` and the app's font stack, and drawn in headless Edge (playwright-core 1.61.1, `msedge.exe`). The plot uses the modal's full phone width and is 375 px high; the sheet is at the drawer's width. Measured on the drawn page, in all five: **0 text overlaps, 0 clipped labels, and a page `scrollWidth` of 375.**

| File | State |
|---|---|
| `1-up-leading.png` | AMZN at $277.50: the gold pill leads |
| `2-down-leading.png` | AMZN-like (fill $270.22, live $268.09): the red pill leads; `↓ 3.2% · 5 bricks to Bust −10 · ↑ 4.8% · 8 to +15` |
| `3-danger-zone.png` | AMZN at $260.40, 0.33 % above Bust: the Danger zone |
| `4-why-panel.png` | Battle View → Why? with Bomb mode on: the proximity line, then "See all levels ›" |
| `5-why-panel-off.png` | The same row with Bomb mode off: unchanged, with the old stats table |

Copies are in `C:/Users/fashr/Documents/FantasyTrades/ResearchModal/BombBothDirections/`. The Danger Zone page is a static render, so its text column is placed at the layout's default; the live page measures it.

## 8. PR 2: Bomb mode on for everyone (draft)

**BO-1 passed** (one-line answer in §1). `enabled: true`, `audience: { mode: 'all' }`, epoch 2, written 2026-10-28 19:24 UTC.
- It was read through the main checkout's own `run(['show'])`, the script's own code path; `--apply` is refused on `show`.
- A log wrapper would have redacted any owner list. There was none.

**BO-2, the flip.**
- Branch `claude/bomb-mode-on`, cut fresh from `origin/main` `7f883c9c`. No branch of that name existed.
- One commit, `d920c1a5`, 7 files, +32 / −14. In that commit (BUILD_RULES §2):
  - the literal `'allowlist'` → `'on'` (`src/config/researchModalFlags.js`);
  - its pin row (`researchModalFlags.test.js`, title and value);
  - the docstring's runway;
  - the guard's note (`flagPinGuard.test.js`);
  - the reconciled red rows below.

**The rows that went red under `'on'`.** The sweep ran on `main` plus the bare flip (`15830e2f`): exit 1, `4 failed | 1383 passed`, `16 failed | 30244 passed`. Every red row pins the mode-off modal or screen. None is one of Bomb mode's own rows; those mock the flag.

| File | Red rows | Why | Disposition |
|---|---|---|---|
| `AgentBattleScreen.quoteAvailability.jsdom` | 4: OFF paneDesktopActive, OFF chatResearch, the AGENT_FORM kill-switch desktop scene, OFF swapTransition | Its references were captured with Bomb mode off; under `'on'` the screen hands the modal `bombContext`. | **kill-switch** (holds `'off'` by mock) |
| `AssetResearchModal.controlledQuote` | 2: OFF heldLegacy; ON healthy held bomb view | A mount with no `bombContext` loses the 💣 pill under `'on'` (BA-5). | **kill-switch** |
| `AssetResearchModal.stockReward` | 6: v2 Ruling 15's measured-model chart rows | The same. That chart is the mode-off path, deleted at the `'on'` cleanup. | **kill-switch** |
| `AssetResearchModal.wiring` | 4: W-1 ×3, W-3 | The same. | **kill-switch** |
| **Total** | **16 rows in 4 files** | | 16 kill-switch, 0 rewrite, 0 delete |

**Both suites on both trees.** PR 2 is cut without PR 1 but merges after it, so its dispositions must hold on both.

| Tree | Full suite | `test:rules` |
|---|---|---|
| `main` + the flip, reconciled (`d920c1a5`) | **exit 0** · `1387 passed \| 9 skipped (1396)` · `30260 passed \| 107 skipped (30367)` | **exit 0** · `40 passed (40)` · `727 passed (727)` |
| PR 1's head + the flip commit (`519968d3` + `d920c1a5`, applied uncommitted in a scratch tree) | **exit 0** · `1391 passed \| 9 skipped (1400)` · `30399 passed \| 107 skipped (30506)` | **exit 0** · `40 passed (40)` · `727 passed (727)` |

**Builds, by the Nov 7 method** (unminified, `diff -rq`, maps excluded, hashed names included):

| Comparison | Result |
|---|---|
| **Kill switch**: `d920c1a5` with the literal set back to `'allowlist'`, against `main` | **0 of 57 non-map files differ** |
| **Value only**: `d920c1a5` as pushed, against `main` with only the literal set to `'on'` | **0 of 57 differ** |
| `d920c1a5` against `main` unchanged (for the record) | 103 entries: the hashed chunks are renamed because the entry chunk's content changed (the literal) |
| Minified build of `d920c1a5` | **exit 0** |
| `lint:gate` on `d920c1a5` | **exit 0** |

**BO-3, League, accepted.** A League battle never scores stocks on the measured model, so a League stock shows the held-preview line ("Held · rungs shown from yesterday's close …"). It never shows the Danger Zone, because it reaches the zone machines with `held` false.

**BO-4, the description.** It opens "Merge only after PR 1 (#1041) is merged and the founder's phone check is clean." It then says, in plain words:
- what everyone gets;
- held crypto and legacy-scored stocks show the held line;
- League, per BO-3;
- what `'on'` changes beyond battles: the draft, acquire and watchlist modals lose the Bomb tab, and the legacy Film Room loses 💣 and opens on Analysis and 1D.

**Rollback:** the same kill switch, one step back with its pin (`'on'` → `'allowlist'`), with both suites run on the rollback.


## 9. Found on the way (reported, not fixed)

1. **Every check scores a quote about 16 minutes older than the check** (§1.1). On every quote this battle stored, fill quotes included, EODHD's provider time is 15.5–17.5 minutes before the evaluator observed it. Scoring and the quote source are out of scope. BD-8 names the check from the observation, so the chip is right either way.
2. **The modal's "live" price may carry the same delay** (ASSUMED). On the founder's screen, the live AMZN price ($268.09) equalled the 1:00 check's scored price.
3. **BD-9 also moves Build C's sheet "Entry" marker.** `packs.js` reads the same `record.entry.atMs` the 💣 view does, so its marker now sits at the fill quote's time too (10:02 → 9:47 in the harness). I kept one field so the sheet and 💣 can't disagree (§9). The sheet is dark (`RESEARCH_MODAL_SHEET_MODE = 'off'`). Q3 asks whether you want it otherwise.
4. **The red zone (upside, Build A) has the same two layout gaps** the Danger Zone had (§6.4 D3, D4): a trace can cross its big number, and a live price far below an unbanked rung can push the goal off its plot. Fixed only on the downside, which this build owns; the red zone's layout is unchanged.
5. **The ghost line crosses the baseline label** (pre-existing in Build A's Fuse): the 30-minute line is drawn over the plot, with the label under it. It shows in the screenshots; it is not a box overlap.
6. **The all-banked line rarely prints now.** With every upside rung banked and Bust unhit, the downside leads, so the sheet line is the downside's line; "+95 banked" stays in the sheet's header. As built per BD-2 and BD-4.

## 10. Questions for the founder

| # | Question | As built |
|---|---|---|
| **Q1** | **BD-8: the chip names the check from the moment the check read the quote, not from the quote's provider time** (§1.3). The letter names the wrong check on every live chip (12:44 → "the 12:30 check" for the 1:00 check). Keep it? | Built from `quoteEvidence.observedAt`. |
| **Q2** | **A2: round each rung in its award direction?** "Bust (−10) if it's at or below $97.63 at a check" is false when the exact Bust is $97.625. Directional rounding (upside up, downside down) makes every such line true. It moves four of AMZN's six prices by a cent ($286.26, $291.60, $254.18, $248.84), including prices you quoted in the brief. Build A's "Needs $X at a check" has the same gap. | Not built: nearest-cent rounding, as before. The Details still give the exact targets. |
| **Q3** | **BD-9 and the sheet:** should Build C's sheet "Entry" marker keep `enteredAt` while 💣 shows the fill quote's time? | One field for both (the fill quote's time). |
| **Q4** | **Both zones at once:** when a red-zone banked moment interrupts a showing Danger Zone, should the view return to the Danger Zone afterwards? It is nearer, and was showing. As built it stays red, which only arises with a threshold under about 0.5 %. | Stays red ("the zone already showing stays"). |
| **Q5** | **Two reds:** the Fuse, bar and table draw the downside in `--ft-neg` (#ff4d5e, as BD-3 names `BT.red`), and the Danger Zone in `--ft-red` (#ef4444, as BD-5 names `BT.risk`). One red for both? | As ruled. |
| **Q6** | **One rung, two %s:** the table's "+3.96 %" (from the displayed prices, as ruled) sits above Details' "Frozen measured %: 3.954943 %". | As ruled. |

## 11. The founder's phone checklist (the first market session after PR 1 merges)

You're on the allowlist, so you see it before anyone else. Times are Central (the market runs 8:30 AM – 3:00 PM CT); the app prints Eastern.

1. **A held stock that's down from entry:** 💣 shows Bust, Crash and Meltdown with their names, prices and %. The red pill is the strong one, and the rail fills red below entry.
2. **A held stock that's up:** the gold pill leads.
3. **A stock near flat:** watch it for five minutes. The lead (the strong pill, and the first half of the line under the bar) doesn't flip back and forth.
4. **Under the bar:** "All levels", seven rows, with the live marker between the right two rows. Tap "Details" once to see it open.
5. **Battle View → Why?** on a measured stock: short, with "See all levels ›", which opens 💣 with the levels table.
6. **The chip** reads "scored … at the 1:15 check" (whatever the latest check was), not a bare minute like "12:44".
7. **The Danger Zone:** if a held stock sits within 0.5 % above a downside rung, the 💣 view turns into the Danger zone: a red goal line, the distance as the big number, "to Bust −10 · 0.42%". If none does, write "no Danger Zone this session".
8. **The entry line's time:** a stock entered overnight shows its price's time ("Mon 4:05 PM", not "Mon 10:21 PM"). A stock entered during the session now shows about **16 minutes earlier** than before. AMZN would read "Tue 11:00 AM", not "11:16 AM", because that is the time EODHD stamps on the fill price (§1.2).
9. **On your phone's font:** look for any label touching another on the 💣 chart, especially the rung names against the pills. The layout assumes a monospace glyph about 0.6 em wide. Some phones draw bold monospace wider (§6.4, refuter D's extra finding). A screenshot of any touch is enough.
10. **A rung's price ends in the cent that makes its line true** *(added by the pre-flip fix PR, BP-1)*. An upside rung is rounded up, a downside rung down. For example AMZN's Crash shows **$254.18**, not $254.19, and its +30 shows $286.26. The Fuse, the bar, the levels table and "What has to happen" all print the same number.
11. **The downside levels and the Danger Zone are the same red** *(added by the pre-flip fix PR, BP-2)*. Compare the Bust row's red in the levels table with the Danger Zone's goal line and big number.

## 12. What ran, where, and cleanup

- **Windows:**
  - This worktree, branch `claude/bomb-both-directions-8515b4`, cut from `origin/main` `7f883c9c`, pushed by refspec to `claude/bomb-both-directions`.
  - PR 2's worktree, in the session scratchpad: branch `claude/bomb-mode-on`, cut fresh from `7f883c9c`.
  - Targeted vitest and ESLint ran from the parent checkout's `node_modules`.
- **WSL:** `~/pd-ci-bombdir` (PR 1; `main`'s builds) and `~/pd-ci-bombdirk` (PR 2; the combined tree). Both are detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0`. Runs went under `~/pd-bombdir-runs`. Not touched: `~/pd-ci`'s HEAD, `~/pd-ci-bombflip*`, `~/pd-bomb-runs` (another session's) and every other session's trees.
- **Production reads (read-only, §1):** the session scratchpad's `prod/bo1-show.mjs`, `bdi-find*.mjs`, `bdi-read.mjs` and `bdi-vintage.mjs`.
- **Review:** eight subagents (four lenses, four refuters), each on its own `git archive` snapshot in the scratchpad. Their harnesses and results stay there.
- **Cleanup:** after the last check, both WSL trees, their `node_modules` links and `~/pd-bombdir-runs` are removed under the suite lock (`unlink`, `git -C ~/pd-ci worktree remove --force`, `worktree prune`); PR 2's Windows worktree and the review snapshots are removed (junctions first). The space freed is in the PR description.
- **What was deleted and what survives** *(added 2026-11-11 by the pre-flip fix PR, BP-8, from a directory listing that day; the bullet above did not say)*:
  - **Deleted:** the eight reviewers' `git archive` snapshot trees, with their `node_modules` junctions. These were the four lenses' and the four refuters' working copies. Also deleted: the mutation tree `mut/tree`, where every mutant ran (each `mut/out-*/*-control.json` records that path). Also deleted: PR 2's Windows worktree, and the WSL trees `~/pd-ci-bombdir` and `~/pd-ci-bombdirk` with `~/pd-bombdir-runs`. On Nov 11, none of those paths exists, and `git -C ~/pd-ci worktree list` shows no `bombdir` entry.
  - **Survives in the session scratchpad** (`…/36afc57d2939746c/317d0735-…/scratchpad/`):
    - `review/lensD-out/` (29 files): lens D's Edge harness and measurements;
    - `review/refC-out/` (23 files): refuter C's import-graph sweep;
    - `review/refD-out/` (57 files): refuter D's layout probes;
    - `review/pr1.diff`;
    - `mut/out-brief/`, `mut/out-review/` and `mut/out-review2/`: each mutant's control and mutant JSON, plus each set's `mutants.result.json`;
    - `phone/`: the five renders' HTML and PNG;
    - `prod/`: the five read-only production scripts;
    - `wsl/`: the twelve step scripts.
  - Lenses A and B and refuters A and B returned their findings as text, so they have no result folder.
  - **Survives in `C:/Users/fashr/Documents/FantasyTrades/ResearchModal/BombBothDirections/`:** the five PNGs and the three result files named in §5.

