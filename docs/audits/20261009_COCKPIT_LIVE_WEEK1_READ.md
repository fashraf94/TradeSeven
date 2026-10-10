# Cockpit live week 1 — the rollback safety check and the week's read

**Date:** 2026-10-09 · **Branch:** `claude/cockpit-live-week1-read` · **HEAD:** `9850851c` (= `origin/main` after `git fetch origin`, the #947 merge) · **Tree:** clean at start
**Scope:** the two allowlisted accounts — labelled **founder** and **FT_QA** throughout (no uid appears in this file or the script) — on the ET sessions **Oct 6–9, 2026**, the first week after #931 set `CALL_RECORDS_MODE = 'on'` and `COCKPIT_UI_ENABLED = true`. Facts only; no recommendations.
**Read-only:** Firestore reads through the Admin SDK (`.env.local` credentials, as the existing read scripts load them), `git` reads, nothing else. No product source, flag, rule, index or schema changed. No API call. The raw dump went to the git-ignored `reads-raw/` folder (this branch adds the ignore line); nothing raw is committed. The two uids were passed inline for each run (`COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA>`), never written to `.env.local` or any file.
**BUILD_RULES §2:** the branch diff is 3 files (this report, the script, one `.gitignore` line block), about 935 lines: under the review threshold (10 files or 1,500 lines), so no §2 review was run.
**Sources:** Step 1 — `scripts/shadow-read-call-records.mjs --rollback-check` (unchanged). Step 2 — `scripts/cockpit-week1-read.mjs` (new, this branch); every table under A–H below is its output, inserted verbatim. Re-run: `COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> node scripts/cockpit-week1-read.mjs --out <file>`.

---

## Step 1 — the rollback safety check: **NO TRIP**

`COCKPIT_ALLOWLIST_UIDS=<founder>,<FT_QA> node scripts/shadow-read-call-records.mjs --rollback-check --since=2026-10-05T22:35:34Z`, read at 2026-10-10T00:20:47Z (Oct 9, 20:20 ET).

`--since` is the instant #931 merged to main (`git log`: merge `693dc323`, 2026-10-05 17:35:34 −05:00 = 18:35 ET). That is the merge, not the production deploy; the deploy instant is not read. The first check that carries the live stamp (`declarationsPhase`) ran Oct 6 at 09:31 ET (A). No entry in either account's battles falls between the merge instant and that check (the Oct 5 row below is 0), so a `--since` at the merge and one at the deploy select the same entries.

| Bar (all three must hold to trip) | This week | Met? |
|---|---|---|
| At least 60 calls-enabled model calls | 220 | met |
| `invalid_tool_result` rate above 3 % | 1 of 220 = 0.45 % | not met |
| One-sided Fisher p < 0.05 against round 3's 1A-C arm (7 of 386) | p = 0.9736 | not met |

| ET session | Model calls | invalid_tool_result |
|---|---|---|
| 2026-10-05 | 0 | 0 |
| 2026-10-06 | 65 | 0 |
| 2026-10-07 | 70 | 0 |
| 2026-10-08 | 34 | 0 |
| 2026-10-09 | 51 | 1 |

Owners 2 · battles 31 · none at the 150-entry retention cap.

Three facts about the same run:
- **10 of the 220 never reached the model.** On Oct 8 from 14:45 to 15:46 ET, ten founder checks got HTTP 400 "You have reached your specified API usage limits" (B, H). The check counts any entry with a `callMs` as a model call, and these carry one (133–310 ms). Without them the count is 1 of 210.
- **`violations=89`**, printed by the same run, comes from the shadow read's pre-Build-1a integrity checks. All 89 are this week's calls that the sweep closed correctly (H.5). Re-checked against the current contract: 0 violations (H.4).
- **`tripped=2`**, printed by the same run, is the shadow era's §10 trigger table, not the S-9 verdict. It compares Sep 21–25 with every entry since Sep 26 in every battle: the timeout rate moved +2.87 points and candidates per check −27 %. Both are the descriptive B figures below, measured another way.

Nothing was changed.

---

## Summary in plain terms

| Question | Answer |
|---|---|
| Did the safety check trip? | **No.** 1 malformed agent answer in 220 checks (0.45 %); the trip line is above 3 % *and* statistically worse than the tested text's 7 in 386. |
| What ran this week? | 13 battle-days. Founder: 11 momentum_chaser battle-days, Oct 6–9. FT_QA: 2 diversifier battle-days, Oct 6–7 only (no FT_QA battle on Oct 8 or 9). This week the account and the archetype are the same split, so each table's two rows are both. |
| What else changed on main? | 15 merges after #931. Six touch the evaluator, swap execution, the calls pipeline or chat: #937, #940, #942, #943, #946, #947. One flag moved: `SWAP_IDENTITY_MODE` off → shadow (#941, 00:57 ET Oct 8). #947 merged at 20:00 ET Oct 9, after the week's last check. None touched a cockpit file. |
| Was the agent healthy? | Malformed answers: 1 of 187 founder, 0 of 33 FT_QA (pre-flip founder 2.5 %). Answers cut off at the length limit: 0. **Timeouts: founder 13.4 % (pre-flip 7.0–8.4 %), FT_QA 39.4 % (no pre-flip battles).** **On Oct 8 the model API refused 10 checks between 14:45 and 15:46 ET: "usage limits reached."** |
| How much did the agent declare? | Per battle-day: founder 9.4 declaring checks and 10 calls; FT_QA 6.5 and 12.5. 135 calls in all: 91 called shots, 44 confirmations, 0 picks. 11 were "upside" calls on a stock already held, which take no answer. |
| Did the agent name replacements? | Rarely. Of 101 exit calls, 12 kept a usable replacement; 9 named one that was not usable (e.g. "TBD", "none", "SHOP or MSFT"), stored for audit only; 80 named none. |
| Did you answer? | Founder: 4 answers. 2 overrides ("Go now", 1 message each, both from the cockpit) and 2 agreements ("Hold", free). FT_QA: 0 answers on 25 calls, and 2 messages sent through chat. No refusal is stored (`directive_pending`, the only kind the records keep). |
| Did the agent hear the overrides? | Yes, both at the next check, 10 and 9 minutes after filing. Neither condition was met, so neither was acted on. Each stayed in the agent's prompt until the close (13 and 11 checks); the agent decided HOLD at every one. One of them (VLO) stayed in the prompt for 11 checks after the risk loop had already sold VLO (H.8). |
| How did the calls end? | 23 hit, 65 expired, 44 ended with the battle, 3 dropped (price line out of range), 0 still open. |
| 2b sizing | Exit calls with no usable replacement: founder 7 per battle-day, FT_QA 6. At the checks that made them, the agent was already eyeing an available bench name in 33 of 54 (founder) and 8 of 10 (FT_QA). |
| Anything broken? | No failed publication. No record missing an Amendment C field. 0 integrity violations under the current contract. Three things to read: the Oct 8 usage-limit hour, the VLO directive that outlived its stock, and one acted call whose tile now reads "Battle ended" (H). |
| Anything needed from you? | The questions at the end. |

---

## Read window and battles

Read at 2026-10-10T00:42:04.739Z (2026-10-09 20:42 ET) · HEAD `9850851c` · #931 merged 2026-10-05T17:35:34-05:00 (`693dc323`). Battles owned by the two accounts: 98 (founder 95, FT_QA 3); read in full (expiry on/after 2026-09-21, or active): 31. Week = ET sessions 2026-10-06, 2026-10-07, 2026-10-08, 2026-10-09; pre-flip = 2026-09-21 up to the #931 merge instant, split by whether the entry carries `declarationsPhase` (the shadow era) or not.

| Account · archetype | Window | Battles | Battle-days | Evaluation entries | ET days |
|---|---|---|---|---|---|
| FT_QA · diversifier | week | 2 | 2 | 33 | 2026-10-06, 2026-10-07 |
| founder · contrarian | pre-flip · off | 1 | 1 | 15 | 2026-09-21 |
| founder · momentum_chaser | week | 11 | 11 | 187 | 2026-10-06, 2026-10-07, 2026-10-08, 2026-10-09 |
| founder · momentum_chaser | pre-flip · shadow | 9 | 9 | 157 | 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01 |
| founder · momentum_chaser | pre-flip · off | 7 | 7 | 119 | 2026-09-22, 2026-09-23, 2026-09-25, 2026-10-02, 2026-10-05 |

- Active at read: founder `uKKR6…` (expires 2026-10-09 20:00 ET). Battles in scope with no evaluation entry: FT_QA `q84cK…` (created 2026-10-05 17:06 ET, expires 2026-10-05 20:00 ET, status completed).

---

## A. Other changes this week

**In plain terms.** Merge times below are when the code reached main, not when it was deployed. The check table shows which merges could have been live for which session. The six merges that reach the five named areas:

| PR | Live or dark at its merge | Area | Figures it could affect |
|---|---|---|---|
| #937 P1a (14:43 ET Oct 7, mid-session) | dark: `HYPOTHESIS_RECORDS_ENABLED = false`, `PILOT_JOURNEY_MODE = 'off'` | calls pipeline: `candidate.js` gains a provenance reason that applies only to a frozen `equippedHypothesis`, which no battle carries while dark; `process-pending-reflections.js` gains a tenant after the sweep that "returns before any read" while the flag is false (`process-pending-reflections.js:29-31`) | none while dark (C origin; H sweep, if it were live) |
| #940 P6 (22:17 ET Oct 7) | dark at `SWAP_IDENTITY_MODE = 'off'`, except three proposal-record fixes its report names | swap execution (`agentSwapExecution.js`, fenced) + evaluator | B, E (trades), F, through the proposal records only |
| #941 flip (00:57 ET Oct 8) | `SWAP_IDENTITY_MODE = 'shadow'` from Oct 8: the executor records an identity comparison on each trade and "trades exactly as today" (P6 report) | swap execution | E (trade records); not trade outcomes |
| #942 integrity (01:01 ET Oct 8) | live, no flag: changes planted or malformed proposal records only (its report §9) | evaluator + executor metadata | B, E — for planted records only |
| #943 integrity follow-up 2 (13:55 ET Oct 8, mid-session) | live, no flag: the cron's own meeting copy; type-checked readers (`chat.js` `dailyGrades`) | evaluator, chat, executor metadata | B, D (chat), E |
| #946 enforce readiness (22:45 ET Oct 8) | live, no flag: unconfirmed-outcome labels and the meeting's stored rationale | evaluator, Battle View tape/why panels (not cockpit files) | E (trade rows), the Battle View's tape (not the tiles) |
| #947 P1b (20:00 ET Oct 9) | dark; merged after the week's last check | evaluator (`decide.js`, fenced) | none this week |

#932 (homepage), #933 (Film Tape end-of-day writer), #936 (Backing), #938 (research records, behind the P1a gate; its `api/screener/chat.js` is the screener's chat, not the agent's) and #945 (offline experiment scripts) reach none of the five areas. #934, #935 and #939 changed documents only.

- #931 (`693dc323`, 2026-10-05T17:35:34-05:00 = 2026-10-05 18:35 ET): flags -CALL_RECORDS_MODE = 'off' · +CALL_RECORDS_MODE = 'on' · -COCKPIT_UI_ENABLED = false · +COCKPIT_UI_ENABLED = true. First week entry carrying `declarationsPhase` (the earliest proof the flip was deployed): founder `CtzRn…` eval_001 at 2026-10-06 09:31 ET. Merge times are not deploy times; no deploy record is read.
- Direct (non-merge) commits on main's first-parent line since #931: none.

| PR | Merged (ET) | Title | Code files | Areas touched (non-test code) | Flag lines changed |
|---|---|---|---|---|---|
| #932 | 2026-10-06 16:25 ET | fashraf94/claude/homepage-static-html | 1 | none of the five | — |
| #933 | 2026-10-06 19:52 ET | fashraf94/claude/film-tape-smoke-fixes-amendment-d | 10 | none of the five | — |
| #934 | 2026-10-07 11:16 ET | fashraf94/claude/phase0-pilot-records | 0 | none of the five | — |
| #935 | 2026-10-07 12:19 ET | fashraf94/docs/eodhd-call-census | 0 | none of the five | — |
| #936 | 2026-10-07 12:43 ET | fashraf94/backing/qa-fixes | 14 | none of the five | — |
| #937 | 2026-10-07 14:43 ET | fashraf94/claude/pilot-p1a-hypothesis-records | 20 | calls pipeline: `candidate.js`, `process-pending-reflections.js` | `+HYPOTHESIS_RECORDS_ENABLED = false` `+PILOT_JOURNEY_MODE = 'off'` `+PILOT_JOURNEY_MODES = Object.freeze(['off', 'advisory', 'live'])` |
| #938 | 2026-10-07 17:28 ET | fashraf94/claude/pilot-p2-research-records | 23 | none of the five | — |
| #939 | 2026-10-07 18:47 ET | fashraf94/claude/phase0-p6-swap-identity | 0 | none of the five | — |
| #940 | 2026-10-07 22:17 ET | fashraf94/claude/pilot-p6-swap-identity | 6 | swap execution: `agentSwapExecution.js`, `swapIdentity.js`; evaluator: `agent-evaluate.js` | `+SWAP_IDENTITY_MODE = 'off'` `+SWAP_IDENTITY_MODES = Object.freeze(['off', 'shadow', 'enforce'])` |
| #941 | 2026-10-08 00:57 ET | fashraf94/claude/flip-swap-identity-shadow | 1 | none of the five | `-SWAP_IDENTITY_MODE = 'off'` `+SWAP_IDENTITY_MODE = 'shadow'` |
| #942 | 2026-10-08 01:01 ET | fashraf94/claude/integrity-proposal-forgery | 7 | swap execution: `executionAuthority.js`, `executorMetadata.js`, `swapIdentity.js`; evaluator: `agent-evaluate.js` | — |
| #943 | 2026-10-08 13:55 ET | fashraf94/claude/integrity-followup-2 | 13 | swap execution: `executorMetadata.js`, `landedTrade.js`, `swapIdentity.js`; chat: `chat.js`; evaluator: `agent-evaluate.js` | — |
| #945 | 2026-10-08 22:39 ET | fashraf94/claude/experiment-growth-replay | 1 | none of the five | — |
| #946 | 2026-10-08 22:45 ET | fashraf94/claude/enforce-readiness | 17 | swap execution: `executorMetadata.js`; evaluator: `agent-evaluate.js`; battle view (shared): `PaneTape.jsx`, `TapeCards.jsx`, `WhyPanel.jsx`, `battleViewCopy.js`, `selectWhyState.js` | — |
| #947 | 2026-10-09 20:00 ET | fashraf94/claude/pilot-p1b-deploy-carriage | 17 | evaluator: `decide.js` | — |

| ET session | First · last week check (any account) | Merged before the first check | Merged between the first and last check |
|---|---|---|---|
| 2026-10-06 | 09:31 · 15:47 ET | — | — |
| 2026-10-07 | 09:31 · 15:47 ET | #932 #933 | #934 #935 #936 #937 |
| 2026-10-08 | 09:31 · 15:46 ET | #932 #933 #934 #935 #936 #937 #938 #939 #940 #941 #942 | #943 |
| 2026-10-09 | 09:30 · 15:46 ET | #932 #933 #934 #935 #936 #937 #938 #939 #940 #941 #942 #943 #945 #946 | — |

---

## B. Health

**In plain terms.** The founder's numbers sit beside the founder's own battles from Sep 21 up to the flip, split into the shadow era (the calls tool was on but nothing was shown) and the off era. FT_QA had no battle before the flip that ran a check (its Oct 5 battle has no evaluation entry), so it has no comparison row. The pre-flip prompts differ from the live one, so the rows are descriptive, not a test. Timeouts are the 20-second limit (`callMs` p95 ≈ 20,004 ms in every row). The ten Oct 8 failures are the API refusing the request ("usage limits"); they are not timeouts and not malformed answers.

| Account · archetype | Window | Battle-days | Model calls | invalid_tool_result | max_tokens stops (bodies read) | truncated_response | Timeouts | callMs p50 | callMs p95 | Candidates / model-ok check |
|---|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | week | 2 | 33 | 0 / 33 (0.00%) | 0 (20 of 33) | 0 | 13 / 33 (39.39%) | 19311 | 20006 | 2.05 (20) |
| founder · contrarian | pre-flip · off | 1 | 15 | 0 / 15 (0.00%) | 0 (0 of 15) | 0 | 1 / 15 (6.67%) | 16190 | 20007 | 1.86 (14) |
| founder · momentum_chaser | week | 11 | 187 | 1 / 187 (0.53%) | 0 (162 of 187) | 0 | 25 / 187 (13.37%) | 15416 | 20004 | 1.17 (151) |
| founder · momentum_chaser | pre-flip · shadow | 9 | 157 | 4 / 157 (2.55%) | 0 (146 of 157) | 0 | 11 / 157 (7.01%) | 15303 | 20004 | 1.15 (142) |
| founder · momentum_chaser | pre-flip · off | 7 | 119 | 3 / 119 (2.52%) | 0 (109 of 119) | 0 | 10 / 119 (8.40%) | 15784 | 20004 | 1.48 (106) |

- Other failure classes (every entry, model call or not): FT_QA · diversifier week: none; founder · contrarian pre-flip · off: none; founder · momentum_chaser week: `400` ×10; founder · momentum_chaser pre-flip · shadow: none; founder · momentum_chaser pre-flip · off: none.
- HTTP-status failures by message: `week · founder · momentum_chaser · 400: {"type":"error","error":{"type":"invalid_request_error","message":"You have reached your specified API usage l…` ×10.
- `invalid_tool_result` by the field that failed: `pre-flip · off · founder · momentum_chaser: anticipationCandidates` ×1, `pre-flip · off · founder · momentum_chaser: riskAssessment` ×1, `pre-flip · off · founder · momentum_chaser: trade_reasoning` ×1, `pre-flip · shadow · founder · momentum_chaser: hypothesis` ×4, `week · founder · momentum_chaser: anticipationCandidates` ×1.

| Account · archetype | ET day | Model calls | invalid_tool_result | Timeouts | HTTP-status failures | First · last failure (ET) |
|---|---|---|---|---|---|---|
| FT_QA · diversifier | 2026-10-06 | 15 | 0 | 7 | 0 | 12:16 · 15:46 |
| FT_QA · diversifier | 2026-10-07 | 18 | 0 | 6 | 0 | 11:46 · 15:46 |
| founder · momentum_chaser | 2026-10-06 | 50 | 0 | 6 | 0 | 09:47 · 14:32 |
| founder · momentum_chaser | 2026-10-07 | 52 | 0 | 12 | 0 | 12:16 · 15:17 |
| founder · momentum_chaser | 2026-10-08 | 34 | 0 | 4 | 10 | 12:02 · 15:46 |
| founder · momentum_chaser | 2026-10-09 | 51 | 1 | 3 | 0 | 09:46 · 14:46 |

- A model call is an entry with a finite `callMs`. `max_tokens` is read per check from the tick body's `response.body.stop_reason` (`cronState.callsDiag.truncated` holds only the latest check); a body that is absent or unreadable is left out of that column's denominator.

---

## C. Declarations

**In plain terms.** A *declaring check* is a check whose answer carried something to record. Every declaring check this week wrote its record (columns 3 and 4 match). *Watching-only* records list names the agent is watching and mint no call. Restated calls follow Amendment C-6: a call that repeats one still open on the same battle, day, symbol, direction, slot, side and default, with a level within 1 %, is a restatement. The cockpit folds it into one tile.

| Account · archetype | Battle-days | Declaring checks / battle-day | Declarations records / battle-day | …of them watching-only | Calls minted / battle-day | Checks / battle-day |
|---|---|---|---|---|---|---|
| FT_QA · diversifier | 2 | 6.50 · 6.50 · 6–7 (n=2) | 6.50 · 6.50 · 6–7 (n=2) | 2 | 12.50 · 12.50 · 11–14 (n=2) | 16.50 · 16.50 · 15–18 (n=2) |
| founder · momentum_chaser | 11 | 9.36 · 9 · 4–15 (n=11) | 9.36 · 9 · 4–15 (n=11) | 39 | 10 · 9 · 4–16 (n=11) | 17 · 17 · 15–18 (n=11) |

| Battle | Account | ET day | Checks | Declaring | Records | Calls minted |
|---|---|---|---|---|---|---|
| `bDveg…` | FT_QA | 2026-10-07 | 18 | 7 | 7 | 14 |
| `iIt9g…` | FT_QA | 2026-10-06 | 15 | 6 | 6 | 11 |
| `3vzKW…` | founder | 2026-10-09 | 18 | 12 | 12 | 10 |
| `5gnep…` | founder | 2026-10-08 | 17 | 9 | 9 | 9 |
| `CtzRn…` | founder | 2026-10-06 | 18 | 15 | 15 | 16 |
| `N6UPR…` | founder | 2026-10-07 | 17 | 10 | 10 | 6 |
| `PMhbP…` | founder | 2026-10-08 | 17 | 8 | 8 | 8 |
| `Zz3Ne…` | founder | 2026-10-07 | 17 | 6 | 6 | 4 |
| `bzYya…` | founder | 2026-10-07 | 18 | 10 | 10 | 12 |
| `cXFPX…` | founder | 2026-10-06 | 17 | 4 | 4 | 8 |
| `nBukr…` | founder | 2026-10-09 | 17 | 9 | 9 | 16 |
| `uKKR6…` | founder | 2026-10-09 | 16 | 11 | 11 | 9 |
| `zC5A8…` | founder | 2026-10-06 | 15 | 9 | 9 | 12 |

| Account · archetype | Calls | Kind | Direction · default (called shots + confirmations) | Upside calls (`heldAtMint`) | `saidOk` | `mintedMode` |
|---|---|---|---|---|---|---|
| FT_QA · diversifier | 25 | `called_shot` ×18, `confirmation` ×7 | `entry · act` ×4, `entry · hold` ×8, `exit · act` ×7, `exit · hold` ×6 | `called_shot:false` ×16, `called_shot:true` ×2, `confirmation:false` ×7 | `false` ×4, `true` ×21 | `on` ×25 |
| founder · momentum_chaser | 110 | `called_shot` ×73, `confirmation` ×37 | `entry · act` ×6, `entry · hold` ×16, `exit · act` ×37, `exit · hold` ×51 | `called_shot:false` ×64, `called_shot:true` ×9, `confirmation:false` ×37 | `false` ×16, `true` ×94 | `on` ×110 |

| Account · archetype | Direction | Counterpart kept | Nulled (raw kept) | Absent | `counterpartRaw` values (nulled) | Kept values |
|---|---|---|---|---|---|---|
| FT_QA · diversifier | exit | 1 | 0 | 12 | none | `PWR` ×1 |
| FT_QA · diversifier | entry | 1 | 0 | 11 | none | `BTC` ×1 |
| founder · momentum_chaser | exit | 11 | 9 | 68 | `BE` ×1, `GEV` ×1, `SHOP or MSFT` ×1, `TBD` ×1, `none` ×4, `undecided` ×1 | `EOG` ×2, `MPC` ×1, `MSFT` ×1, `PANW` ×3, `PLTR` ×1, `PM` ×3 |
| founder · momentum_chaser | entry | 8 | 1 | 13 | `CTVA` ×1 | `AFRM` ×3, `BE` ×1, `BTC` ×1, `CTVA` ×1, `GEV` ×1, `LLY` ×1 |

| Account · archetype | Records | `watchingSource` | Non-empty watch list | Validator removals (`source:reason`) | `mintedMode` |
|---|---|---|---|---|---|
| FT_QA · diversifier | 13 | `null` ×6, `top_level` ×7 | 7 | none | `on` ×13 |
| founder · momentum_chaser | 103 | `declarations` ×1, `null` ×34, `top_level` ×68 | 69 | `block:malformed_block` ×1, `calledShots:malformed` ×13, `calledShots:no_slot_before_battle_end` ×1 | `on` ×103 |

| Account · archetype | ET day | Calls minted | Restated calls (C-6, joined an open thread at mint) | Threads of ≥ 2 calls | Largest thread |
|---|---|---|---|---|---|
| FT_QA · diversifier | 2026-10-06 | 11 | 4 | 3 | 3 |
| FT_QA · diversifier | 2026-10-07 | 14 | 4 | 4 | 2 |
| founder · momentum_chaser | 2026-10-06 | 36 | 6 | 5 | 3 |
| founder · momentum_chaser | 2026-10-07 | 22 | 2 | 2 | 2 |
| founder · momentum_chaser | 2026-10-08 | 17 | 2 | 2 | 2 |
| founder · momentum_chaser | 2026-10-09 | 35 | 11 | 4 | 6 |

---

## D. Answers

**In plain terms.** An *override* is an answer that files an instruction for the agent and costs one message; an *agreement* is free and files nothing. The only refusal the records keep is `directive_pending` (Amendment B.5), and none was stored. The endpoint returns its other refusals (`illegal_answer`, `already_answered`, `expired`, budget, and so on) to the screen without storing them, so their count lives only in the Vercel logs, which this read cannot reach. The two founder `hold` agreements on ZS above 230.35 and PANW above 427 were filed four and eight seconds after the ZS "Go now". They sit on other threads (ZS *above* is not ZS *below*, C-6), so the "one thread, one live answer" rule did not apply (H.6).

| Account | Battle | Call | Kind · direction · default | Answer | Type | Mint → answer (min) | Filed | heardEvalId |
|---|---|---|---|---|---|---|---|---|
| founder | `cXFPX…` | VLO below 417.19 (`eval_002:call:0`) | called_shot · exit · hold | `go_now` | override (directive, 1 message) | 33.3 | 2026-10-06 12:37 ET | eval_005 |
| founder | `uKKR6…` | ZS below 228 (`eval_004:call:0`) | called_shot · exit · hold | `go_now` | override (directive, 1 message) | 20.5 | 2026-10-09 13:06 ET | eval_006 |
| founder | `uKKR6…` | ZS above 230.35 (`eval_005:call:0`) | called_shot · exit · hold | `hold` | agree (acknowledgment, free) | 5 | 2026-10-09 13:06 ET | null |
| founder | `uKKR6…` | PANW above 427 (`eval_005:call:1`) | called_shot · exit · hold | `hold` | agree (acknowledgment, free) | 5.1 | 2026-10-09 13:06 ET | null |

| Account · archetype | Calls | Answered | Overrides | Agreements | By answer | Refused (`refused` stored) | Mint → answer, min (mean · median · min–max) |
|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | 25 | 0 | 0 | 0 | none | none | n/a (no unit) |
| founder · momentum_chaser | 110 | 4 | 2 | 2 | `go_now` ×2, `hold` ×2 | none | 15.97 · 12.80 · 5–33.3 (n=4) |

| Account · archetype | Battles | Messages charged (`chatBudgetUsed`, summed) | Cockpit filings (`source: cockpit`) | Chat sends (`userMessage`) | Other directive filings |
|---|---|---|---|---|---|
| FT_QA · diversifier | 2 | 2 | 0 | 2 | 0 |
| founder · momentum_chaser | 11 | 2 | 2 | 0 | 0 |

---

## E. Receipts

**In plain terms.** *Heard* means the agent's next check had the instruction in its prompt. *Acted* means a committed trade matched the call. Both overrides were heard at the next check, neither was acted on, and neither drew a "no matching trade" receipt. That receipt needs the model's own trade at a check that heard the instruction; the model held at every one. Both stayed in the slot until the close. The slot is empty at read; the sweep is the writer that retires a call slot past its lifetime (Amendment C, Standing conditions), and the clearing instant is not recorded.

**Overrides heard and then traded against.** No model decision went against either override: HOLD at all 24 checks that heard one. One trade during an override touched the call's stock, and it came from the risk loop, not the model: at 13:17 ET on Oct 6 a stagnation exit sold VLO for CEG while "If VLO below $417.19 by today's close, go ahead and exit for MPC" was live. The price line was never seen (the call expired), and the replacement was not the named MPC. The ZS override saw one trade in the same tier on another stock (ACN→HUM, stagnation) and none on ZS. After hearing "Go now" on ZS, the agent restated the same ZS line six more times with its own default changed from hold to act. Those six are a new thread, because the default is part of the C-6 key. **Second overrides refused (`directive_pending`): 0.**

- Call events in the week, by account and kind: `FT_QA:declared` ×11, `FT_QA:expired` ×23, `founder:answered` ×4, `founder:declared` ×64, `founder:ended_with_battle` ×44, `founder:expired` ×42, `founder:heard` ×2.
- `outcome.actedEvalId` set on week calls: 1. Directive answers: 2; heard: 2. Calls carrying `refused` (`directive_pending` — the only refusal stored, Amendment B.5): 0.

**founder `cXFPX…` — `go_now` on VLO exit below 417.19 (default hold, this_session, counterpart MPC)**
- Filed 2026-10-06 12:37 ET → heard at eval_005 (2026-10-06 12:47 ET): 10.3 min. The call ended `expired_unresolved` (sweep, 2026-10-06 16:31 ET); acted: no.
- In the slot (checks whose `heard` stamp names the thread): 13 checks, 12:47 → 15:47 ET (179.5 min); decisions at those checks: `HOLD` ×13. Lifetime end 2026-10-06 16:00 ET. A later directive filing on another thread: none. `battle.directive` at read: empty.
- Committed trades from filing to lifetime end: VLO→CEG (star, 13:17 ET, stagnation, the call’s symbol, the call’s slot). Later calls on the same symbol, direction, side and level band (1 %): 0 — none.

**founder `uKKR6…` — `go_now` on ZS exit below 228 (default hold, this_session, counterpart null)**
- Filed 2026-10-09 13:06 ET → heard at eval_006 (2026-10-09 13:15 ET): 9.2 min. The call ended `expired_unresolved` (sweep, 2026-10-09 16:31 ET); acted: no.
- In the slot (checks whose `heard` stamp names the thread): 11 checks, 13:15 → 15:45 ET (149.9 min); decisions at those checks: `HOLD` ×11. Lifetime end 2026-10-09 16:00 ET. A later directive filing on another thread: none. `battle.directive` at read: empty.
- Committed trades from filing to lifetime end: ACN→HUM (support, 15:01 ET, stagnation, the call’s slot). Later calls on the same symbol, direction, side and level band (1 %): 6 — `default act → expired_unresolved` ×6.

---

## F. Grading

**In plain terms.** 8 of the founder's 11 battles end at the 16:00 ET close, the same instant a `this_session` call's deadline falls. In those battles the sweep closes the call as "ended with the battle"; in a battle that ends at 20:00 ET the same call reads "expired". The two labels therefore split by the battle's end time, not by anything the agent did. "Hit and acted" counts hits whose trade matched. One call that was acted on but never hit (AMZN) appears under `ended_with_battle` (H.7).

| Account · archetype | Kind | Calls | hit | expired_unresolved | ended_with_battle | invalidated | open | hit and acted |
|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | called_shot | 18 | 2 | 16 | 0 | 0 | 0 | 0 |
| FT_QA · diversifier | confirmation | 7 | 0 | 7 | 0 | 0 | 0 | 0 |
| founder · momentum_chaser | called_shot | 73 | 13 | 24 | 33 | 3 | 0 | 0 |
| founder · momentum_chaser | confirmation | 37 | 8 | 18 | 11 | 0 | 0 | 0 |

- `expired_unresolved` by horizon and writer: `FT_QA · diversifier: next_check · check` ×2, `FT_QA · diversifier: this_session · sweep` ×21, `founder · momentum_chaser: next_check · check` ×18, `founder · momentum_chaser: this_session · sweep` ×24.
- Expired vs ended, by the battle's own end time (a battle that ends at the 16:00 close and a `this_session` deadline fall on the same instant): `FT_QA · diversifier: battle ends 20:00 ET → expired_unresolved` ×23, `founder · momentum_chaser: battle ends 16:00 ET → ended_with_battle` ×44, `founder · momentum_chaser: battle ends 16:00 ET → expired_unresolved` ×17, `founder · momentum_chaser: battle ends 20:00 ET → expired_unresolved` ×25.
- `invalidated` by minted reason: `founder · momentum_chaser: level_implausible` ×3.

---

## G. 2b sizing on live data

**In plain terms.** This is Build 2's discovery measure B8 (`docs/audits/20261002_PHASE0_BUILD2_COCKPIT.md`, 6.42 per battle-day on round 3's replay of the 1A-C text), counted on live records. Under Amendment C-3 a stored counterpart is usable by construction, so "no usable replacement" means the stored counterpart is null, whether the agent named none (raw absent) or named something unusable (raw present). "The agent was eyeing" is read two ways because the records hold two lists: the check's anticipation candidates and its watch list. A bench name counts only when that same check's prompt showed it as `available`, not `locked until …`.

| Account · archetype | Exit calls, counterpart null | Raw absent / raw present | Per battle-day | Checks carrying ≥ 1 | Checks with a readable bench (tick body) | …bench shows ≥ 1 available name | …≥ 1 available bench name among its anticipation candidates | …≥ 1 among its watch list | …either |
|---|---|---|---|---|---|---|---|---|---|
| FT_QA · diversifier | 12 | 12 / 0 | 6 · 6 · 5–7 (n=2) | 10 | 10 of 10 | 10 | 8 | 4 | 8 |
| founder · momentum_chaser | 77 | 68 / 9 | 7 · 8 · 2–15 (n=11) | 54 | 53 of 54 | 52 | 23 | 21 | 33 |

- Exit calls in the week (called shots + confirmations): 101; of them with a counterpart kept: 12. "Available" = the bench row's Status is `available` (not `locked until …`) in that check's own prompt; "eyeing" is read two ways — the check's `candidates[].symbol` (anticipation candidates) and its declarations record's `watching` list.

---

## H. Anything broken

**In plain terms.** No publication failed, no record is missing an Amendment C field, and every call checks out against the current contract: receipt, writer, event and tick reference all match. The sweep closed every past-deadline call within 31 minutes. Its host runs every 15 minutes (`vercel.json:201-202`). What is worth reading:
- **The Oct 8 usage-limit hour** (B): ten founder checks, 14:45–15:46 ET, refused by the API with "You have reached your specified API usage limits." Two of the founder's battles that day ended on such a check (`callsDiag.exit = transport_failed_after_prompt` on `5gnep…` and `PMhbP…`). On FT_QA's two battles the last check failed on a timeout.
- **H.5**: the shadow read's own integrity check flags the 89 calls the sweep closed. It predates Build 1a: it counts only `hit` and `expired_unresolved` as terminal and expects `stateSource = 'check'`, so every `ended_with_battle` and every sweep expiry fails it. These are the 89 the Step 1 run printed.
- **H.6**: no answer was filed on a thread holding a live answer, and none on a call that was not its thread's newest.
- **H.7**: one call was acted on and later closed another way. The agent exited AMZN at the 14:30 check on Oct 8; the call's price line never triggered; it closed "ended with the battle". Its tile showed "Acted" until the close and "Battle ended" after: `callTag` tags a terminal state first, and only `hit` keeps the "Acted" tag.
- **H.8**: no rule retires a "Go now" instruction when its stock leaves the book another way (Amendment B.13 retires only a pick's). The VLO instruction stayed in 11 more prompts after the risk loop sold VLO at 13:17 ET.
- Two `battle_ended` sweep receipts on `N6UPR…` and one on `Zz3Ne…` carry an instant 3–4 seconds before the battle's `completedAt`. The sweep acts only on a parent that is already terminal, so this reads as `completedAt` being stamped a few seconds after the status change. It is recorded, not diagnosed.

1. **Publication.** `expected` with no declarations record (failed or unconfirmed): none. Records whose entry is not `expected`: none. `cronState.declarationsPhase` (latest check per battle): `FT_QA:written` ×2, `founder:written` ×11. Week entries without `declarationsPhase`: 0 — none.
2. **Sweep.** Sweep logs are Vercel-only (`sweep.js:176`), not read. From the records: sweep receipts `FT_QA:past_deadline` ×21, `founder:battle_ended` ×44, `founder:past_deadline` ×24; minutes from the deadline to the sweep receipt (past_deadline) 16.19 · 31.10 · 0.6–31.1 (n=45); from battle completion to the receipt (battle_ended) 23.68 · 30.60 · -0.1–30.7 (n=44). Week calls still open past their deadline at read: none. `callSweepQueue` rows for week battles: none. `callSweepState/singleton`: phase reconcile, updated 2026-10-09 20:30 ET.
   Sweep receipts (battle_ended) observed before the battle's `completedAt`: `N6UPR…` (2 receipts, up to 2965 ms before); `Zz3Ne…` (1 receipts, up to 3795 ms before).

| Battle | Account | Status | Latest callsDiag evalId | exit | phaseResult | perId results | truncated | faults | flips (scanned · complete · stopped · failed · unconfirmed) | heard pass (stopped · skipped · failed · unconfirmed) | ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `3vzKW…` | founder | completed | eval_018 | model_result | none | none | false | 0 | 8 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 73 |
| `5gnep…` | founder | completed | eval_017 | transport_failed_after_prompt | none | none | false | 0 | 2 · true · null · 0 · 0 | n/a | 53 |
| `bDveg…` | FT_QA | completed | eval_018 | transport_failed_after_prompt | none | none | false | 0 | 13 · true · null · 0 · 0 | n/a | 54 |
| `bzYya…` | founder | completed | eval_018 | model_result | written | `confirmed` ×2 | false | 0 | 10 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 571 |
| `CtzRn…` | founder | completed | eval_018 | model_result | none | none | false | 0 | 11 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 739 |
| `cXFPX…` | founder | completed | eval_017 | model_result | written | `confirmed` ×3 | false | 0 | 7 · true · null · 0 · 0 | null · `nothing_to_do` ×1 · 0 · 0 | 722 |
| `iIt9g…` | FT_QA | completed | eval_015 | transport_failed_after_prompt | none | none | false | 0 | 8 · true · null · 0 · 0 | n/a | 127 |
| `N6UPR…` | founder | completed | eval_017 | model_result | none | none | false | 0 | 2 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 129 |
| `nBukr…` | founder | completed | eval_017 | model_result | none | none | false | 0 | 8 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 66 |
| `PMhbP…` | founder | completed | eval_017 | transport_failed_after_prompt | none | none | false | 0 | 5 · true · null · 0 · 0 | n/a | 56 |
| `uKKR6…` | founder | active | eval_016 | model_result | written | `confirmed` ×1 | false | 0 | 8 · true · null · 0 · 0 | null · `nothing_to_do` ×1 · 0 · 0 | 507 |
| `zC5A8…` | founder | completed | eval_015 | model_result | none | none | false | 0 | 11 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 478 |
| `Zz3Ne…` | founder | completed | eval_017 | model_result | none | none | false | 0 | 1 · true · null · 0 · 0 | no_heard · none · 0 · 0 | 65 |

   Latest `callsDiag.exit` per battle: `FT_QA:transport_failed_after_prompt` ×2, `founder:model_result` ×9, `founder:transport_failed_after_prompt` ×2. Each check overwrites `callsDiag`; earlier checks' diagnostics are not retained.

3. **Amendment C fields.** Missing on week records: none (over 135 calls, 116 declarations records). Records with `mintedMode` other than `'on'` (the cockpit hides them): 0.
4. **Integrity, current contract** (terminal = hit · expired_unresolved · ended_with_battle, each with a receipt and its writer's `stateSource` — the flip's `check` or the sweep's; every transition with its event; every tick reference resolving): 0 violation(s) — none. By design and not counted: 41 watching-only declarations records with no `declared` event (publish.js:195); 1 unanswered call(s) with a flip-stamped `actedEvalId` and no `acted` event (flip.js:252).
5. **The shadow read's integrity checks on the same week calls** (`shadow-read-call-records.mjs` `integrityViolations`, written before Build 1a: terminal = hit · expired_unresolved only, `stateSource` must be `check`): 89 — `terminal_has_receipt: receipt exists but state=ended_with_battle` ×44, `terminal_has_receipt: stateSource=sweep (expected 'check')` ×45.
6. **Tile states the records do not explain.** Answers filed on a thread holding a live directive answer (the tile offers none then, C-6): none. Answers filed on a call that was not its open thread's newest at that instant (the tile's buttons answer the newest, Build 2a spec §7.2): none.
7. **Acted, then resolved some other way** (the tile tags a terminal state first, so these read by their state, not "Acted" — `cockpitModel.js` `callTag`): founder `5gnep…:eval_001:call:0` AMZN exit below 244.51, acted at eval_012 (2026-10-08 14:30 ET), now `ended_with_battle`.
8. **A live directive about a symbol that left the book** (no rule retires a `call_go` when its symbol is sold by another path; B.13 retires only a pick's): founder `cXFPX…` VLO: sold VLO→CEG at 13:17 ET (stagnation); the directive was in 11 later checks' prompts.

---

## Questions for the founder

1. **The usage limit.** The model API refused ten founder checks on Oct 8, 14:45–15:46 ET, with "You have reached your specified API usage limits." Did you know about the limit, and was it changed afterwards? (Oct 9 shows no such refusal.)
2. **What the safety check counts.** S-9 counts those ten refusals as model calls (they carry a `callMs`). Should a request the API refused before any model ran count toward the denominator? This week the verdict is the same either way: 1 of 220, or 1 of 210.
3. **Timeouts.** The share of checks that hit the 20-second limit was 13.4 % for the founder this week (7.0–8.4 % before the flip) and 39.4 % for FT_QA (both FT_QA battles began in the late morning, 11:08 and 11:57 ET). S-9 watches only malformed answers. Do you want the timeout share in the weekly read only, or in the rollback check too?
4. **"Eyeing" in 2b sizing.** G reads it as the check's anticipation candidates, as its watch list, and as either: 23, 21 and 33 of the founder's 54 checks. Which reading did you mean?
5. **An instruction about a stock already sold.** Is it right that "If VLO below $417.19 … exit for MPC" stayed in 11 prompts after the risk loop sold VLO for CEG (H.8)?
6. **Acted, then "Battle ended".** The AMZN call was acted on at 14:30 ET on Oct 8 and now reads "Battle ended" (H.7). Is that the reading you want for a call the agent acted on before the close?
7. **Expired vs ended.** A `this_session` call reads "Battle ended" in a battle that ends at 16:00 ET and "Expired" in one that ends at 20:00 ET (F). Is the split by the battle's end time intended?
8. **FT_QA's week.** FT_QA played Oct 6 and 7 only, answered none of its 25 calls, and sent two chat messages. Was that the plan for the QA account this week?
