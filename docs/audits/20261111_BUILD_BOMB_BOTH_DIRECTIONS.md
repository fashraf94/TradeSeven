# Build: Bomb mode — both directions, the Danger Zone, the levels table; then 'on' for everyone

**Date:** 2026-11-11 (the build prompt is dated Tue Nov 10). **Model:** Claude Opus 5.5, one local Claude Code session in the desktop app's worktree `.claude/worktrees/bomb-both-directions-8515b4` (local branch `claude/bomb-both-directions-8515b4`, pushed by refspec as **`claude/bomb-both-directions`**). **Brief:** "Bomb mode: both directions, the Danger Zone, the levels table, then 'on' for everyone" (BD-1 to BD-11, BO-1 to BO-4).

**Preamble.** `git fetch origin` ran first. `origin/main` was `7f883c9c` (the merge of PR #1032), and the worktree was clean on it. Read first, as the brief asks: `docs/BUILD_RULES.md` (§1, §2, §9, §10, §11); the Build A spec `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md` (BA-1 to BA-6, §3.1, §3.6, §4.3, the 2026-11-07 rulings); the Nov 7–8 flip report `docs/audits/20261108_FLIP_RESEARCH_MODAL_BOMB_MODE.md` (BF-3, the red-row dispositions, the kill-switch method, the WSL pattern); `src/utils/stockThresholdModel.js`; every file in `src/components/Research/BombMode/`; `BaggerBombTab.jsx` (`StockRewardDetails`); `AgentBattleScreen.jsx` (`StockDispatchRow`, the Why? panel, `openResearchTarget`, `bombModeOn`); `Sheet/sheetOpen.js`. **Fenced files (BUILD_RULES §1): none edited, none called.** The production reads below used the Admin SDK `.get()` / `.select()` only, with the main checkout's `.env.local` in place; nothing was written; no EODHD, Anthropic or OpenRouter call was made; no uid or email is in this report.

---

## The three read-only questions (one line each)

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

*(The build, the checks, the mutation table, the review and the phone checklist follow as the work lands.)*
