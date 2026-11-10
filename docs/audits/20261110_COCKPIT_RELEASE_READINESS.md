# Cockpit release readiness — is it ready to open to every player? (Phase 0, read-only)

**Date:** 2026-11-10 (Tue, read between 12:35 and 14:45 ET) · **Mode:** read-only discovery — nothing built, no flag, environment variable or data changed · **Verdict: not yet.**

The cockpit is on for two accounts. Switching it on for everyone is cheap in money (about **+12–15 % per check**, **$0.002–$0.003**), but **three things stand in the way**: the switch cannot be opened to anyone but the two accounts without a code change, and the same list is the pilot cohort of five other features; the server turns the cockpit on for League battles that the screen hides; and the evaluator already tops out at about seven model-calling battles per 15-minute run, whether the cockpit is on or off. Today none of that bites, because **no real owner outside the two accounts has run a check since 2026-10-23**.

Markers (BUILD_RULES §3): every `file:line` anchor below was **VERIFIED** — read in this session at `origin/main` = `d1dfc371` — unless a line says **ASSUMED**. "Not recorded" marks a number the records do not hold.

---

## 0. Preamble (BUILD_RULES §2, §3)

| | |
|---|---|
| Fetch | `git fetch origin` run first. `origin/main` = `d1dfc371916dfaa7531cb664eb4e990aceda98fb` (merge of #1037, 2026-11-09 12:12 CST). Re-fetched immediately before the push (result in the closing note of this section). |
| Branch | local `claude/cockpit-release-readiness-d2754a` (the desktop app suffixes a worktree's branch; cut at `origin/main`, tree clean at the start). Pushed by refspec as `claude/cockpit-release-readiness`. **No PR opened** (ruled: the rollout build carries this report). |
| Files changed | 1 — this report. Under the BUILD_RULES §2 review threshold. |
| Production reads | Firestore Admin SDK, **`.get()` and `count()` queries only** (project `tradeseven`): `agentBattles` (select-masked), `agentBattles/*/ticks`, `/calls`, `/callEvents`, `agentEvalRuns`, `callSweepQueue`, `callSweepState/singleton`. GitHub REST read of the Production deployments list (via `gh`, its own keyring auth; no token read). **No GCS read** (the shadow stream holds per-check tokens too; the Firestore tick records hold them as well, so the task's "`.get()` only" held). No `--raw`, no write call anywhere: every scratch script and `scripts/cockpit-2b-read.mjs` were grepped for `.set(`, `.update(`, `.delete(`, `.create(`, `.add(`, `runTransaction`, `batch(`, `bulkWriter`; the only hits are in-memory `Map`/`Set` calls, a hash `update`, and the 2b script's own comment naming them. |
| Uids | Recovered in memory from the archived week-1 raw dump (`reads-raw-archive/cockpit-live-week1-read-d5abe2/…/cockpit-week1-raw.json`, one uid per account label; the dump agrees with itself), passed to `scripts/cockpit-2b-read.mjs` inline in the child's environment for that run only. **No uid was printed or written.** The 2b read's output was scanned for both uids (whole and in 12-character pieces) before it was saved: clean. Tick and battle records carry `ownerId` and `agentId`; they were aggregated in memory, owners other than the two accounts are labelled by ordinal (`other1`) and the one such real owner is never identified. |
| Raw data | The extracts (`ticks.json`, `battles.json`, `runs.json`, counts) live in the session scratchpad, **outside the tree**; nothing raw is in the repo. The scripts are not committed ("build nothing"); their method is §8. |
| STOP conditions | None tripped: no read wrote, none needed a uid in a file. |
| Env | `COCKPIT_ALLOWLIST_UIDS` in production **was not read** (it is a secret and the task forbids touching it). "Two accounts" is the founder's statement, and the records agree: only those two accounts have `on` checks. |

*Closing note on the fetch:* `git fetch origin` was re-run immediately before the commit; `origin/main` was still `d1dfc371…` (no movement), so this branch is one docs-only commit on the current main.

### 0.1 The one-page gate table

Status: **met** / **not met** / **unknown**. "Blocks" = blocks a general release (an "everyone" switch), as opposed to a first staged share.

| # | Gate | Status | Evidence (this report's section) | Blocks? |
|---|---|---|---|---|
| G1 | `CALL_RECORDS_MODE` global state | **met** | `'on'` (`featureFlags.js:2855`); a non-allowlisted battle resolves `'off'` and nothing changes (§C1) | no |
| G2 | Who the allowlist admits | **not met** | exact-uid membership only; no percent, cohort or wildcard (`allowlist.js:36-39`, `mode.js:64-85`). Opening it to everyone needs code (§C1, §C2) | **yes** |
| G3 | The allowlist is shared | **not met** | seven other readers (§C2); a plain "everyone" would also open Film Room cards, Bomb mode, hypothesis records and activation evidence | **yes** |
| G4 | `cockpit-status` | **met** | answers any owner; one GET per agent Battle View already runs for all players with the character pane (`AgentBattleScreen.jsx:1240-1247`) | no |
| G5 | `COCKPIT_UI_ENABLED` and `COCKPIT_2B_ENABLED` | **met** | both `true` (`featureFlags.js:2926`, `:2974`); character pane on (`:2170`, `:2232`); inert for a player whose status is off (§C1) | no |
| G6 | League routing wall | **met, but only on the screen** | `LEAGUE_BATTLEVIEW_ROUTING_ENABLED = true` (`featureFlags.js:266`, `BattleViewScreen.jsx:30-40`) is client routing. The server resolves on the owner alone (`mode.js:80-85`), so League battles are `on` server-side today (18 founder League battle-days since the flip carry `on` records) | **yes** (unless the release resolver excludes League — §C2) |
| G7 | Model-visible text for a general population | **not met** | the framework chat blessed it for two accounts; §C4 lists every line. One line is false for League battles ("the player sees each one as a tile in their cockpit") | **yes** |
| G8 | Extra cost of `on` | **met** | +$0.0022 (measured) to +$0.0027 (schema estimate) per check, +11.7 % on a League check; about $0.05–$0.06 per battle-day (§A1) | no |
| G9 | Agent check: model time, failures, trades | **met** | +2.4 s median per check (p90 +3.9 s), 0 timeouts since the 40 s ceiling, model-path trade share equal (5.3 % vs 5.3 %); one 'off' owner is the only comparator (§A1) | no |
| G10 | Evaluator time headroom | **met today, not at scale** | last 10 sessions: max 5 battles and 2 model calls per run, max run 101.6 s of 290 s, 0 deferred / budget-skipped in all 875 runs. A run reaches about 7 model-calling battles at `on` (8 at `off`); about 9 full battle-days a day (§A2) | **yes, for the volume plan** (not for today's volume) |
| G11 | Call sweep throughput | **not met at scale** | one page of 20 queue rows per phase per 15 minutes, 52 runs a day: a call's expiry is stamped late once more than about 50 battles are open (§A3) | **yes, for the volume plan** |
| G12 | Rollback | **met (slow)** | env edit + production redeploy; commit-to-live measured at 8.3–13.7 min, median 9.1 (n=40). No redeploy-free switch exists (§C3) | the **"everyone" step** needs a kill switch |
| G13 | Staged switch-on | **not met** | no share-of-owners mechanism exists; proposal in §C3 | **yes** (it is the way in) |
| G14 | Live coverage of the receipts and tags | **unknown** | the answer-to-trade path has never fired live: 0 of 11 answered directives acted, 0 of 9 heard checks left a `no_matching_trade`; `exit_not_held`, the F-1 upside and refusals never happened (§B) | no (watch it per stage) |
| G15 | Open items | **2 block** | League slot label (with G6/G7) and the hot-bench "no price" ruling that was scoped "for the pilot"; 28 others can follow (§C5) | **yes** (two) |

**What a first stage needs:** G2/G3/G13 (a separate cohort switch, built so the five other features keep their two-account cohort), G6/G7 (resolve `on` for agent-mode battles of real owners only), and the Q2 re-ruling. G10–G12 matter for the size of the stage, not the first one.

---

## Part A — what turning it on costs

### A1. The agent's check, `on` against `off`

**Where the numbers come from.** Every check writes a permanent tick record (`agentBattles/{id}/ticks`, `captureSerializer.js:72-209`): `callEnvelope.{inputTokens, outputTokens, callMs, httpStatus}`, `model.{outcome, failureClass, timeoutKind, dispatched}`, `decision`, `actions[]`. Per-check tokens are **not** on the evaluation entry (they go to the GCS shadow log, `agent-evaluate.js:4761`), so the tick record is the Firestore source. **Each check is classed `on` / `off` from its own tick** (`schemaVersion 2` = calls active; 1 = off), then by date (`on` from the global flip at 2026-10-05T22:35:34Z, PR #931; the `shadow` era Sep 28–Oct 1 is excluded). Counts: 1,133 checks that dispatched a model call, Sep 22–Nov 10: 644 `on`, 321 `off`, 168 `shadow`. CPU seats never call the model (`model.outcome not_attempted`, `exitReason cpu_passive`; 2,598 ticks) and are not a comparator.

**Who the comparator is.** In the last 10 sessions (Oct 27–Nov 9; Nov 10 is partial) **every checked model call is `on`**: only the founder and FT_QA ran. There is **no `off` check from a real non-allowlisted owner in that window (n = 0)**. The only real `off` owner on record is one account, `other1`, active Oct 5–23 (League Oct 5–23, agent-mode one day, Oct 19). That owner's data is aggregated only. So the comparison below is: (a) the last 10 sessions, `on` alone, as asked; (b) `on` against `other1`'s `off` checks **in the same 15-minute runs** (same API weather, same League prompt), stated with the window it uses.

**A timeout change sits in the middle of it.** Until 2026-10-15 the SDK timeout was **20 s**; commit `e5ce2970` (2026-10-15 11:53 CDT) raised it to **40 s** (`agentEvalTransport.js:21`) because 20 s cut off every answer past about 1,900 tokens. Oct 6–15: `on` timed out on **59 of 272** checks (21.7 %), `other1`'s `off` on **1 of 87**; the first-week gap is consistent with the 20 s ceiling meeting `on`'s slower calls (`on` is +2.4 s at the median, below). Since Oct 16: **0 of 372** `on` checks and **0 of 115** `off` checks timed out. The first number is real history; the second is the cost at today's ceiling.

#### The requested view: last 10 sessions, `on` only

| Group | checks (dispatched) | ok | timeout / 400 / invalid_tool_result | output tokens median / p90 | input tokens median / p90 | model ms median / p90 | model-path trade | any trade |
|---|---|---|---|---|---|---|---|---|
| `on`, all | 162 | 157 | 0 / 0 / 5 | 1,526 / 1,933 | 16,107 / 18,501 | 17,776 / 21,835 (max 26,427) | 8 (4.9 %) | 16 (9.9 %) |
| `on`, agent-mode | 78 | 77 | 0 / 0 / 1 | 1,700 / 2,054 | 17,651 / 19,067 | 19,266 / 22,698 (max 26,427) | 3 (3.8 %) | 7 (9.0 %) |
| `on`, League | 84 | 80 | 0 / 0 / 4 | 1,285 / 1,825 | 15,039 / 16,136 | 15,827 / 20,753 (max 22,723) | 5 (6.0 %) | 9 (10.7 %) |
| `off`, same window | **0** | — | — | — | — | — | — | — |

"Model-path trade" = a committed swap whose source is the model (`haiku`); "any trade" adds the deterministic paths (risk manager, archetype, guardrail), which do not depend on the declarations tool and differ by owner configuration. The p90 output (1,933) is far under the 3,072-token cap: **0 checks hit the cap** in any group.

#### `on` against a real `off` owner (same 15-minute runs)

| Group | checks | ok | timeout / 400 / invalid | output tok median / p90 | input tok median / p90 | model ms median / p90 | model-path trade | any trade |
|---|---|---|---|---|---|---|---|---|
| **League, post-fix (Oct 16–23): 76 runs with both arms** | | | | | | | | |
| `on` | 76 | 76 | 0 / 0 / 0 | 1,228 / 1,762 | 14,989 / 15,364 | 14,649 / 19,618 (max 25,307) | 4 (5.3 %) | 13 (17.1 %) |
| `off` (`other1`) | 76 | 76 | 0 / 0 / 0 | 1,031 / 1,336 | 13,321 / 13,912 | 12,269 / 15,734 (max 17,810) | 4 (5.3 %) | 4 (5.3 %) |
| *difference* | | | | **+197** median, +209 mean | **+1,669** median, +1,127 mean | **+2,380** median, **+3,884** p90 | equal | owner-dependent |
| **League, whole concurrent window (Oct 6–23, includes the 20 s ceiling): 145 runs** | | | | | | | | |
| `on` | 211 | 187 | 14 / 10 / 0 | 1,213 / 1,641 | 14,600 / 15,273 | 14,245 / 19,837 | 10 (4.7 %) | 25 (11.8 %) |
| `off` | 145 | 139 | 1 / 5 / 0 | 1,088 / 1,480 | 13,523 / 13,978 | 12,890 / 16,996 | 9 (6.2 %) | 12 (8.3 %) |
| **Agent-mode, one day (Oct 19)** | | | | | | | | |
| `off` (1 battle) | 19 | 19 | 0 / 0 / 0 | 1,302 / 1,618 | 16,396 / 16,459 | 15,509 / 19,238 | 0 | 2 (10.5 %) |
| `on` agent-mode same day | 10 | 10 | 0 / 0 / 0 | 1,343 / 1,959 | 16,744 / 17,527 | 16,826 / 23,361 | 0 | 2 (20.0 %) |
| `on` agent-mode post-fix, all 181 checks | 181 | 178 | 0 / 0 / 3 | 1,637 / 2,020 | 17,128 / 18,346 | 18,943 / 22,308 (max 26,427) | 6 (3.3 %) | 26 (14.4 %) |

The 400s in the whole-window rows are Oct 8's "API usage limits reached" outage: 10 `on` and 5 `off` checks, both arms (the account-wide kind; they say nothing about `on`).

**Reading.**
- **Output:** `on` writes about **+200 tokens (+19 %)** per League check, the declarations block. **Input:** about **+1,100 to +1,700 tokens (+8–13 %)**: the `on` tool is **13,623 characters against 8,537** (`buildTradeDecisionTool`, `agentEvalToolSchema.js:496-501`; measured by serialising both; the `on` bytes match the pinned SHA-256 `7388755a…`, 13,623), so **+5,086 characters** in every request. A fit of measured input tokens on request bytes over 1,019 ok checks (r = 0.990) gives 0.343 tokens per byte, i.e. +1,744 tokens for the schema alone (a structural estimate; the measured difference is the lower range because the two owners' prompts differ).
- **Latency:** the in-repo comment holds (`agentEvalTransport.js:15-17`: call time follows output tokens): measured model ms = 1.84 s + 10.4 ms per output token (r = 0.974, n = 1,019). `on` is **+2.4 s at the median, +3.9 s at p90** per League check. The slowest `on` check ever seen is 26.4 s against the 40 s ceiling (the worst case at the full 3,072-token cap is about 34 s).
- **Failures:** at the 40 s ceiling, 0 timeouts and 0 transport failures for `on` (0 of 372) and `off` (0 of 115). `invalid_tool_result` (a bad trade field; the declarations block never reaches that validator, `agentEvalToolSchema.js:210-212`) is 7 of 372 `on` (1.9 %) and 0 of 115 `other1` `off`, against 3 of 119 for the founder's own pre-flip `off` checks (2.5 %): a rate without a clear arm effect.
- **Trades:** the share of checks that end in a **model-path trade is equal** (5.3 % vs 5.3 % post-fix; 4.7 % vs 6.2 % whole window). "Any trade" differs only through the owners' deterministic paths. **The tool does not make the agent trade more or less on this evidence.** The intervals are wide (4 of 76 → about 1.5–13 %).

**Limits (say them).** One `off` owner; `off` and `on` are different owners with different agent configurations; the `off` window is Oct 6–23, not the last 10 sessions; n = 76 pairs post-fix. The within-owner `before` view (the founder's `off` checks Sep 22–Oct 5, n = 119, output median 1,257, model 15.8 s) is confounded by the 20 s ceiling and by earlier prompt changes and is not used.

#### The extra API cost

Model on the evaluator: `claude-haiku-4-5-20251001` (`callEnvelope.returnedModel` on every tick). Price from the `claude-api` skill's table (cached 2026-11-03): **Haiku 4.5, $1.00 input / $5.00 output per million tokens**. **No `cache_control` exists anywhere in the evaluator** (grepped `agent-evaluate.js`, `agentEvalTransport.js`, `agentEvalPromptAssembly.js`), so the added tool bytes are billed at the full input price on every check.

| Per check | input | output | $ |
|---|---|---|---|
| measured (League, post-fix means) | +1,127 | +209 | **$0.00217** (`on` $0.02079 vs `off` $0.01861 = +11.7 %) |
| schema estimate | +1,744 | +200 | **$0.00274** |

Checks per `on` battle-day, last 10 sessions: median **21** (mean 20.3; min 15, max 22; n = 8 battles). Projection (conservative figure in bold; the measured one beside it):

| Battles a day | per battle-day | per day | per 21-session month |
|---|---|---|---|
| 1 (the founder's day today) | $0.046–**$0.058** | $0.05–0.06 | $1.0–1.2 |
| 50 | | $2.28–**$2.88** | $48–**$60** |
| 200 | | $9.11–**$11.52** | $191–**$242** |
| 1,000 | | $45.6–**$57.6** | $957–**$1,210** |

An `off` battle-day costs about **$0.39** (21 checks × $0.0186); `on` adds about 12–15 %. **These figures assume every battle gets its full ~21 checks; today's evaluator could not run that many (§A2): what it can actually spend at saturation is about 182 model checks a day, about $0.50 a day of extra cost.**

### A2. The cron's time

**The 4,000 ms is a threshold, not time spent.** `callsReserveMsFor(mode)` is 4,000 at `shadow`/`on`, 0 at `off` (`publish.js:60`, `:87`). It is added **once per battle, at the admission test** (`agent-evaluate.js:3047` → `shouldStartHaikuCall`, `agentEvalTransport.js:196-207`): a model call starts only if the remaining budget covers **10 s prompt-build + 42 s call (40 s SDK + 2 s backstop) + 12 s post-call = 64 s at `off`, 68 s at `on`** (`:52`, `:29-31`). Against `TIME_BUDGET_MS = 290,000` (`agent-evaluate.js:238`; `maxDuration 300`, `:234`) a call is started only if elapsed ≤ **226 s at `off`, 222 s at `on`**. A battle refused here gets a fallback HOLD (`failureClass budget_skipped`), the loop then defers anything left once elapsed passes 290 s (`:508-522`).

**The calls phase's own time** (`cronState.callsDiag.ms`, `publish.js:253`, `:352`, `:429`): the field is **overwritten every check, so it holds one sample per battle** (its latest check). 40 post-flip battles: **median 199 ms, p90 794 ms, max 1,854 ms**; the last 10 sessions (n = 8): median 427 ms, p90 1,211 ms. Against a 4,000 ms reserve, the actual phase uses about **5 %** of it at the median. **`skipped_budget`: 0 of 50** latest-check records (35 `none`, 15 `written`); **per-check frequency is not recorded** (neither `callsDiag` nor the evaluation entry keeps it). The run record's `budgetSkipped` is **0 in all 875 runs** since 2026-09-24, and `deferred` is 0 in all 875.

**Per-check time, `on` against `off`** (League, post-fix, `tickMs − callMs`, the non-model part of a check): `on` 7,319 ms median (p90 9,266) vs `off` 6,825 (p90 8,973): **+0.5 s**; with the model call (+2.4 s) a check takes **about +2.9 s (+13 %)**.

**How many battles one run handles today** (`agentEvalRuns`, 26 runs a session, 875 runs):

| Last 10 sessions (260 runs) | median | p90 | max |
|---|---|---|---|
| active battles in a run (`battlesTotal`, includes CPU seats) | 1 | 5 | 5 |
| model calls in a run | 0 | 2 | 2 |
| run wall time | 21.8 s | 64.5 s | **101.6 s** (budget 290 s) |
| run wall time, runs with ≥ 1 model call | 45.9 s | 77.8 s | 101.6 s |

**Headroom:** 188 s at the longest run (65 % of the budget), about 225 s at p90. Since 2026-09-24 the extremes are 14 battles in a run (Oct 6–7, with CPU seats), 5 model calls, 217.8 s, and **no run ever deferred or budget-skipped a battle**.

**What a run can hold.** Run wall time grows by **34.6 s per model-calling battle** (fit over the last 10 sessions, r = 0.94, intercept 4.8 s; all `on`). The last call may start at 222 s (`on`): 1 + ⌊(222 − 4.8) / 34.6⌋ = **7 model-calling battles per run at `on`**. At `off` (31.7 s per battle — 34.6 less the measured 2.9 s — and a 226 s cutoff) the same arithmetic gives 7 (the eighth would start at 227 s, one second past the cutoff): in continuous terms **7.3 vs 8.0, about −9 %** for `on`. With 26 runs a session that is about **182 model checks a day — about 9 full battle-days (21 checks each)**, `on` or `off`. The loop is **sequential and unchanged**: the file's own scale note says the real fix is per-battle fan-out (`agent-evaluate.js:493-502`). Past 7 concurrent model-calling battles each battle's check comes every ⌈N/7⌉ runs (the loop sorts by last start, so the starvation is fair, not absent).

**If every active battle ran `on`, using today's real count:**
- Active battles per session (max `battlesTotal` per day): Oct 27 4, Oct 28 4, Oct 29 5, Oct 30 5, Nov 2 1, **Nov 3–6 0**, Nov 9 1. Of these, the model-calling ones are the founder's and FT_QA's (≤ 2 per run); the rest are three CPU seats on League days.
- **All of today's real model-calling battles are already `on`.** Opening the switch to everyone adds **0** model-calling battles today and **no** extra run time. The wall time at today's peak stays about 4.8 + 2 × 34.6 = 74 s (observed max 101.6 s).
- The next real step up is outside the data: at 8 or more concurrent `on` battles the run reaches its admission cutoff and the extra battles start getting fallback HOLDs, with or without the cockpit; `on` brings that edge in by about one battle in eight.
- **An "everyone" rule must also decide CPU seats and ownerless battles.** `resolveCallRecordsMode` has no `isCpu` or `gameMode` test (`mode.js:80-85`; the call site `agent-evaluate.js:1040` passes the battle through); a CPU seat is `off` today only because its owner id is not on the list. A wildcard would turn them `on` (a calls context and a flip pass per CPU tick, no model call).

### A3. Firestore operations per `on` battle-day

**Measured: documents created by one `on` battle-day** (`count()` of each subcollection; one full-day battle = one battle-day):

| | calls | callEvents | declarations | callObservations | cockpit docs total |
|---|---|---|---|---|---|
| last 10 sessions (n = 8): median / mean | 21 / 20.4 | 29 / 28.1 | 14.5 / 15.0 | 20.5 / 20.1 | **median 85.5, mean 83.6, max 143** |
| since the flip (n = 43): median / mean | 11 / 12.5 | 14 / 16.3 | 10 / 9.9 | 11 / 12.1 | median 49, mean 50.7 |

One tick document per check is written whatever the mode (26 a battle-day).

**By code, not recorded per run (ASSUMED):** the publish transaction creates 1 declarations record + the new calls + queue-row merge (`publish.js:153-218`), the status update (`publish.js:295`), the flip's per-hit transaction (`flip.js:228-266`: `getAll` 2, create receipt, update call), the heard pass (`heard.js:121-149`). That is about 84 creates + about 15 queue merges + about 20 call updates + about 21 status updates ≈ **140 writes** and, by the page and transaction bounds, a few hundred reads per battle-day (the flip pass reads every open call, up to 50, once per check, `flip.js:77`, `:321-333`). Per-check read counts are not recorded.

**The chat calls block, per chat turn in battle mode at `on`** (`callsBlock.js:184-211`, `chat.js:609-642`): **4 queries** in parallel (open ≤ 6, then the three resolved states ≤ 5 each: **≤ 21 call documents**, a query is charged at least one read), plus **one batched get of ≤ 22 event references** when directive-answered calls exist (Amendment G) and **one battle re-read** only in the read race: **≤ 44 document reads per turn**, all inside a 1,500 ms deadline; at `off` none.

**The call sweep** (rider on `process-pending-reflections`, `*/15 13–1 UTC`, 52 runs a day, `vercel.json:205-206`; `runCallSweep` `sweep.js:446`): per run one state read, then a page of **20 queue rows** per phase (`due`, `nullOnly`) with one parent read each, and **25 battles of the last 7 days** for `reconcile` (`sweep.js:76-80`, `:493`, `:511-513`): **≤ 106 reads a run, ≤ 5,500 a day**; today the queue holds **1 row** and the cursor sits in `reconcile`. The deadline is `min(now + 20 s, start + 45 s)` (`sweep.js:73-74`, `:89-91`). **Throughput is the issue:** 20 rows a phase × 52 runs = **1,040 row-visits a day**, and the queue walk is ordered by expiry with a persisted cursor, so a row is revisited every ⌈N/20⌉ runs: **N = 50 open-call battles → 3 runs (45 min); 200 → 10 runs (2.5 h); 1,000 → 50 runs (12.5 h)**. A call's `expired_unresolved` stamp, its receipt and a heard confirmation then arrive that late; the tile and the chat block show a call as open past its deadline. Today's skip pass (`skippedOff`, `sweep.js:502`, `:521`) becomes real work for every battle.

**Projection to all of today's daily battles:** the real `on` battle-days today average **0.8 a session** (max 2): about 67 created documents a day. Scaled (documents ×84, writes ×~140, reads ×~500 estimated):

| Battles a day | created docs | writes | reads (estimate) |
|---|---|---|---|
| 50 | 4.2k | 7k | 25k |
| 200 | 16.8k | 28k | 100k |
| 1,000 | 84k | 140k | 500k |

At Firestore list prices as I know them (writes $0.18 and reads $0.06 per 100k; **ASSUMED, not checked in this session**) 1,000 battles a day costs about **$0.55 a day**: not a cost gate. The sweep lag and the single sequential evaluator are the gates.

---

## Part B — coverage

`scripts/cockpit-2b-read.mjs` was run over every session since 2026-10-23 (13 ET days: Oct 23, 26, 27, 28, 29, 30, Nov 2, 3, 4, 5, 6, 9, 10; Nov 10 is partial, 14:44 ET), both accounts, uids inline, no `--raw`. **Nov 3–6 had no battle**, so no row. 13 battle-days with any cockpit filing, event or mint:

| ET day | Account | Battle | Commands (kind) | Replacements landed | Chosen agent·bench·sheet | Acted / no match on chosen | Retired | Following | Event kinds |
|---|---|---|---|---|---|---|---|---|---|
| 10-23 | founder | `ny4mmSKz` | 1 (call_replace) | 0 | 1·0·0 | 0 / 0 | pick_already_held 1 | 3 | answered 1 · declared 10 · expired 16 · heard 1 · retired 1 |
| 10-23 | founder | `onLZktbO` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 9 · expired 13 |
| 10-23 | FT_QA | `5abyFRTt` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | answered 1 · declared 6 · expired 11 |
| 10-26 | founder | `f07WWesJ` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 7 · expired 10 |
| 10-27 | founder | `LuEg2J44` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 6 · expired 8 |
| 10-28 | founder | `xXjJxRt3` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 6 · expired 8 |
| 10-29 | founder | `5hKnf805` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 6 · expired 8 |
| 10-29 | founder | `Ct4E0m3T` | 2 (call_hold, call_replace) | 1 | 1·0·0 | 0 / 0 | none | 1 | answered 3 · declared 12 · expired 17 · heard 1 · superseded 1 |
| 10-30 | founder | `6byAs4Dn` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 10 · expired 22 |
| 10-30 | FT_QA | `pfNFqkwE` | 2 (call_hold, call_replace) | 1 | 1·0·0 | 0 / 0 | none | 1 | answered 3 · declared 8 · expired 12 · heard 2 · superseded 1 |
| 11-02 | founder | `mgsSpu9S` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | declared 17 · expired 29 |
| 11-09 | founder | `E0TvPcaD` | 3 (call_go 2, call_replace 1) | 2 | 1·1·0 | 0 / 0 | none | 0 | answered 6 · declared 12 · expired 23 · heard 2 · superseded 2 |
| 11-10 | founder | `jWQjlmkx` | 0 | 0 | 0·0·0 | 0 / 0 | none | 0 | answered 1 · declared 7 · expired 5 |

Eight commands in 13 battle-days, four confirmed replacements, **none acted, none "no matching trade"**. The script's non-recorded columns (card vs sheet, confirmations shown, 409 `replace_unconfirmed`, `counterpart_unavailable`) are "unknown — not recorded", as the script says.

### What has ever happened live (all history, `on` mode, both accounts)

A separate read-only census over every call and event on record (94 battles read: 71 belong to the two accounts, 23 to `other1`, who has no call records; **548 calls: 539 stamped `on`**, 9 carry no mode stamp (ASSUMED the shadow era, before the stamp existed; they are left out of every `on` count); 701 events, all on `on` calls), dated by ET day:

| Receipt / tag | Live count | First – last | Reading |
|---|---|---|---|
| `declared` events | 265 | Oct 6 – Nov 10 | the base path |
| `answered` events | 24 (21 calls: acks 10 — go 6, hold 4 — and directives 11 — go_now 5, replace 4, hold 2) | Oct 6 – Nov 10 | |
| **`heard`** events | **9** (7 founder, 2 FT_QA) | Oct 6 – Nov 9 | has happened |
| **`acted`** events (the heard pass's "Acted at the …" on an answered command) | **0** | never | **never happened live.** 12 calls carry `outcome.actedEvalId`, all founder and **all unanswered** (written by the flip pass from a committed trade that matches the call, `flip.js:264`), so the tag "Acted" has shown only on unanswered calls |
| **`no_matching_trade`** events | **0** | never | **never happened live.** 9 heard checks left neither receipt: consistent with every heard check holding |
| `expired` / `ended_with_battle` events | 342 / 56 | `ended_with_battle` last Oct 21 | |
| **`superseded`** events | **4** (3 founder, 1 FT_QA) | Oct 29 – Nov 9 | has happened (the replace flow) |
| **`retired`** events | **1** — `pick_already_held`, founder, Oct 23 | Oct 23 | has happened once; the other D-6 reasons (stock left the book, came in another way) **never** |
| **`exit_not_held`** mints (Amendment E) | **0** ever; **0 of 98 exit calls** minted since E merged (2026-10-30 03:30 UTC) | never | **never happened live** |
| **Entry minted upside because the check itself bought it** (Amendment F-1) | **0 of 4** entry calls minted since F merged (2026-11-02 21:33 UTC); the 4 are upside by the older held-at-mint rule | never | **never happened live** (rebuilt from `evaluations[]`: a `SWAP` whose `symbolIn` is the call's symbol at the call's own check; not `heldAtMint`, which F-1 conflates, F report §8.6). The same rebuild finds 21 of 150 entry calls minted before F were on a stock their own check bought, none upside — the bug F fixed; the Oct 30 audit's own rule counted 19 of 144, a different matching rule |
| **Refused answer** | **0 persisted** | — | `refused` is stored only for `directive_pending` with the 2b flag **off** (`call-response.js:86-90`); with it on (since Oct 23 03:35 UTC, PR #989) no refusal is persisted. The one live refusal on record is the Oct 30 FT_QA GILD 400 (`counterpart_not_held`), from the audit, not from a record. **Not recorded** |
| `invalidated` calls | 8 (4 `level_implausible`, 4 pre-reason-field) | Oct 9 – Oct 29 | |

**Read:** the answer-to-trade path (a player answers; the agent hears; a check acts or does not) has had **11 directives, 9 heard, 0 acted, 0 non-matching** live. Every unit-tested branch beyond `heard` is unproven in production. At a first stage the staged release should treat these as "watch" metrics, not as assumptions.

---

## Part C — the gates, from `origin/main` (`d1dfc371`)

### C1. Every switch a release passes through, and what a non-allowlisted player gets

| Switch | Value | file:line | For a player not on the allowlist |
|---|---|---|---|
| `CALL_RECORDS_MODE` (`'off'|'shadow'|'on'`) | `'on'` | `featureFlags.js:2855`; resolver `mode.js:50-58` | global `'on'` makes the per-owner list the only gate |
| Allowlist resolution | per owner | `mode.js:64-71` (`isCockpitOwnerAllowlisted`), `:80-85` (`resolveCallRecordsMode`), `allowlist.js:27-53` | owner not in the list → `'off'`. **The list is exact-string membership of the `COCKPIT_ALLOWLIST_UIDS` environment variable, read at call time; unset or empty = nobody; no wildcard, percent or cohort** (`allowlist.js:36-39`). No `gameMode` or `isCpu` test |
| What `'off'` does | | cron `agent-evaluate.js:1040`; tool `agentEvalToolSchema.js:496-501`; chat `chat.js:488`, `:638`, `:727`; answers `call-response.js:293`; bench `cockpit-bench.js:229`; sweep `sweep.js:245`, `:502`, `:521`; `file-directive.js:298` | the evaluation tool is the base literal (no `declarations`); no call, declaration, receipt or sweep row is read or written; the chat prompt has no calls block and its history windows drop cockpit filings; `POST /call-response` and the bench answer 404; the tick keeps its version-1 shape. Pinned byte-identical to the pre-build golden |
| `GET /api/agent/cockpit-status` | | `cockpit-status.js:67-104` | an owner asking about their own battle gets `200 { on: false, allowlisted: false, serverNowMs }` (`:95-99`), `no-store`; a non-owner 403, a missing battle 404 (`:92-94`); 5 s max duration; 60/min per IP, 30/min per user (`:45-50`). **It runs today for every player who opens an agent Battle View** (the hook is on whenever the screen flag and the pane are, `useCockpitStatus.js:82-110`, `AgentBattleScreen.jsx:1240-1247`): one request and one document read per view, 8 s client timeout (`:36`), and until it answers the chat's seen-marker waits (2a §13.10 item 2) |
| `COCKPIT_UI_ENABLED` | `true` | `featureFlags.js:2926`; accessor `:2929` (also needs `isCharacterPaneOn()`, true: `:2170`, `:2232`, `:2241`) | the Battle View asks the server and renders the answer; `on: false` reads off, so the layout is the shipped one |
| `COCKPIT_2B_ENABLED` | `true` | `featureFlags.js:2974`; accessor `:2977`; `call-response.js:230`; `cockpit-bench.js:229`; `AgentBattleScreen.jsx:2569` | global, not per owner; unreachable behind an off status |
| League routing wall `LEAGUE_BATTLEVIEW_ROUTING_ENABLED` | `true` | `featureFlags.js:266` (docstring `:240-265`); consumer `BattleViewScreen.jsx:30-40`; pin `leagueBattleviewRoutingWall.test.js` | **client routing only.** A League battle (`gameMode 'baggerbomb_tournament'`) goes to the League Arena, never to `AgentBattleScreen`, so no League player sees the cockpit or reaches `call-response`. **The server does not know the wall exists**: an allowlisted owner's League battle resolves `on`, gets the declarations tool, mints calls and (via the League arena's chat, which posts to `/api/agent/chat` — `useArenaEngine.js`; ASSUMED to carry the agent battle id) the calls block. The founder's 18 League battle-days since the flip carry `on` records (v2 ticks, calls, events) |

### C2. The shared allowlist — every reader, and a way to open the cockpit alone

`readCockpitAllowlist()` (`allowlist.js:47`) feeds **one list for seven readers** (non-test code, VERIFIED by grep at the head). Today's flag value shows who a plain "everyone" would open:

| # | Reader | file:line | Feature flag today | If the list became "everyone" |
|---|---|---|---|---|
| 1 | Cockpit mode | `mode.js:64-85` | `CALL_RECORDS_MODE 'on'` | the point of the change |
| 2 | `cockpit-status.allowlisted` (the client's verdict) | `cockpit-status.js:97` | feeds 2a–2e | see below |
| 2a | Film Room cards, client + server | `filmRoomGate.js:62-91,116-125` (verdict), `filmRoom/cardsGate.js:51` | `FILM_ROOM_CARDS_MODE 'allowlist'` (`featureFlags.js:3522`) | **opens Film Room cards for everyone** |
| 2b | Research modal Bomb mode | `bombModeGate.js:43-44`, `useBombModeForBattle.js:20,33` | `RESEARCH_MODAL_BOMB_MODE 'allowlist'` (`researchModalFlags.js:58`) | **opens Bomb mode for everyone** |
| 2c | Research modal sheet and Ask | `Sheet/sheetGate.js:48-51`; server `researchAsk.js:109-114`, `chat.js:454` | `RESEARCH_MODAL_SHEET_MODE 'off'` (`researchModalFlags.js:108`) | inert now; its pilot cohort would become everyone at the flip |
| 2d | Film Room v2 screen, review availability | `filmRoomGate.js:145-160`, `reviewAvailability.js:21-23` | `FILM_ROOM_V2_MODE 'on'` (`featureFlags.js:3067`) | already everyone; no dependency |
| 3 | Activation evidence observer | `activationEvidence/gate.js:28` (`tenant.js:201`) | `ACTIVATION_EVIDENCE_ENABLED true` (`activationEvidenceFlags.js:36`) | **the reflections cron would observe every owner's battles** (reads and cost) |
| 4 | Hypothesis records | `hypothesisRecords/gate.js:30,45`; callers `watchlist-analysis.js:328`, `watchlist-dialogue.js:853`, `watchlist-dialogue-abandon.js:95`, `watchlists.js:208,341,455`, `screener/chat.js:164`, `carriage.js:271`, `http.js:38`, `reviewPass.js:392,447` | `HYPOTHESIS_RECORDS_ENABLED true` (`featureFlags.js:3204`) | **opens the forge routes and the model-visible carriage in `decide.js` prompts, and the review pass, for everyone** |
| 5 | Setup menu labels | `setupMenuLabels/gate.js:26`, `reads.js:92`, `tenant.js:206` | `SETUP_MENU_LABELS_ENABLED false` (`setupMenuLabelsFlags.js:31`) | dark; pilot cohort becomes everyone at its flip |
| 6 | Tooling | `scripts/shadow-read-call-records.mjs:490` (rollback check, `rollbackRecipe.js:199`), `census-activation-evidence.mjs:615`, `census-setup-menu-labels.mjs:387` | — | they **iterate** the list as the owner set; an "everyone" breaks them |

**Proposal (not built): a second, cockpit-only cohort.** Keep `COCKPIT_ALLOWLIST_UIDS` exactly as it is (it stays the pilot cohort for rows 2a–5 and the tools). Change **one function**, `resolveCallRecordsMode` (`mode.js:84`), so the per-owner test is "allowlisted **or** in the cockpit release cohort", where the cohort is: a stable bucket of the owner (below), **and** `gameMode === 'baggerbomb_agent'` (League stays out — C5 item 1), **and** `isCpu !== true` and an owner id present. Leave `cockpit-status.allowlisted` (`:97`) as `isCockpitOwnerAllowlisted` — **the pilot verdict only** — so every client verdict that other features read keeps its two-account meaning, while `on` (`:96`) follows the new resolver. Rows 2a–2d, 3, 4, 5 and the tools never call `resolveCallRecordsMode`, so they do not move. The tests that must move with it: `allowlist.test.js` (src/ must not import the reader — unchanged), `cockpitFlags.test.js`, `mode.build1a.test.js`, `cockpit-status.test.js`. The change touches no fenced file (`mode.js`, `cockpit-status.js` are not on the §1 list).

### C3. Rollout and rollback

**Today's rollback.** Two routes, both slow:
1. **The allowlist route:** remove the uid from `COCKPIT_ALLOWLIST_UIDS` in Vercel and redeploy production. *"Vercel applies an environment change to new deployments only, so the running deployment keeps the value it was built with"* (`allowlist.js:19-21`; 2a §11 item 5: removal "takes a production redeploy"). **Measured:** commit-to-Production-live for the last 40 production deployments (GitHub deployments API timestamps against the commit times, 2026-10-25 → 2026-11-09): **min 8.3 min, median 9.1, p90 11.6, max 13.7**. A redeploy builds the same app, so expect the same order; the dashboard steps (edit the variable, press Redeploy) are not measured and no redeploy record exists (the deployment statuses carry only `success`). Open tabs keep the cockpit until they reload, change battle status or hit a 404 (2a §11 item 12).
2. **The flag route:** `CALL_RECORDS_MODE` back to `'off'` is one line plus the pin row (`featureFlags.js:2846-2848`; `callRecordsFlags.test.js`), a PR the founder merges **after 6 PM ET** (the standing merge-window rule), then the same ~9-minute deploy. Existing records are then neither read nor written.

**Proposal (not built): a staged switch-on** with a share of owners chosen stably:
- **Bucket:** `bucket = uint32(sha256(ownerId + salt)) mod 10,000`; admitted if `bucket < shareBp`. Stable per owner (no flicker), growable (raising the share only adds owners), and the salt can be rotated for a re-draw. The cockpit cohort rule is the one in §C2 (agent-mode, real owners only).
- **Where the share lives — two options.** (a) **An environment variable** (`COCKPIT_RELEASE_SHARE_BP`), exactly like the allowlist: no new mechanism, each step is an env edit + redeploy (~9 min). (b) **A Firestore control document**, read once per cron run and cached per request path — the precedent exists: `readMasteryFlagView(db)` reads one registry document per run (`agent-evaluate.js:336`; `masteryConfig.js:208-214`).
- **A kill switch with no redeploy is possible** with (b): a `cockpitRelease` document `{ shareBp, disabled }`; the resolver reads a cached view (TTL 60 s on request paths, once per run in the evaluator and the sweep) and **fails closed to the allowlist** on a missing document or a read error. Setting `disabled: true` takes effect on the next check (≤ 15 min in the cron) and the next request (≤ 60 s). `resolveCallRecordsMode` is synchronous and called from 8 sites (`chat.js:488`, `call-response.js:293`, `cockpit-bench.js:229`, `cockpit-status.js:96`, `file-directive.js:298`, `agent-evaluate.js:1040`, `sweep.js:245,502,521`), so each handler entry awaits one `ensureReleaseView(db)` and the resolver stays sync. Cost: one small read per run/handler cold start; the control document needs a rules/Admin-only write path (Console edit), not a client path. Client tabs still stay on until the next status ask (2a item 12), which `cockpit-status`'s `no-store` already bounds.
- **Stages and trips** (all measurable from records this report used): 2 accounts (today) → ~5 % → ~25 % → 100 %, each held at least one full session with real traffic, because **today there is no non-allowlisted traffic at all**; trips: any run with `budgetSkipped` or `deferred` > 0 or `wallMs` > 200 s (`agentEvalRuns`); `on` timeouts, 400s or `invalid_tool_result` above the `off` baseline (the tick records); the rollback check (`shadow-read-call-records.mjs --rollback-check`, extended to read the cohort rather than the list); sweep lag; the cost line. Because one battle gives at most 36 calls (2a item 14), the check's power comes from pooling battles, so a stage with fewer than about 5 real battles proves nothing.

### C4. What the model sees — an agent whose owner goes `on`

Exactly what changes, model-visible (all in the "fenced-class" lens, contract V1.4 §2):

1. **The evaluation tool** — `submit_trade_decision` becomes `TRADE_DECISION_TOOL_1A` (`agentEvalToolSchema.js:476`; selector `:496-501`): the base literal **plus one optional top-level property, `declarations`** (typed `['object','null']`, never `required`; `DECLARATIONS_PROPERTY :239-346`). **+5,086 characters in every request** (13,623 vs 8,537). The model-visible description strings are: the block (`TEXT_1A_DECLARATIONS :437-444`: *"The player sees each one as a tile in their cockpit and can answer it … The player may answer Go or Hold off; an answer that changes your default reaches you as a directive at a later check … Every call is graded against real prices … Nothing in this block executes a trade by itself"*), `horizonPhrase` (`ARM_D_HORIZON_PHRASE :390`), `said` (`:397`), `fork` (`:401`), `playerAsk` (`TEXT_1A_PLAYER_ASK :445`), the fork's `said` (`TEXT_1A_FORK_SAID :449`), plus the property's structure (calledShots ≤ 6 with symbol/direction/slot/counterpart/condition/horizonPhrase/expiresAtMs/defaultAction/said; watching ≤ 6; playerAsk; fork). No prompt section teaches it (`:214-216`). **Cost: +1.1–1.7k input and +0.2k output tokens per check (§A1).**
2. **A player's answer reaches the agent as a directive** at a later check: the canonical call-directive text is rendered by the control prompt (`agentEvalPromptAssembly.js:1240`, `isDirectiveActive` `directiveUtils.js:83-93`, which fails closed without the check context `mode.js:102-124`). Wording of the call_go / call_hold / call_replace texts was blessed in Amendments B and D. Amendment F removes two paths (a directive's canonical text into the next prompt; an acknowledgment's `answered:` row) and adds no text (F report §4); Amendment E changes none (E §12).
3. **The chat calls block** (`callsBlock.js`; read `chat.js:609-642`, only at `'on'` and battle mode): the heading `CALLS ON THE RECORD (…)` (`callsBlock.js:66`), ≤ 1,200 characters, ≤ 6 open + 5 newest resolved rows; each row the call line (`copy.js renderCallLine :169`), its state, the answer (`answered: Go now, bring in DHR`, `Bring in …`), its fact (`heard at the 13:00 check`, `acted at the … check`, `not confirmed heard`) and, from Amendment G, **three segment templates**: `replaced by a later request at 13:46`, `retired at the 13:15 check: DLTR left the book`, `… came into the book another way` (`callsBlock.js:111-123`, reason words `copy.js:284-291`). The chat history windows also stop filtering cockpit filings (`chat.js:727`, `:736`, `:739`).
4. **League battles of an `on` owner** get the same tool and chat block today (§C1) although the League prompt shows no tier column (`agentEvalPromptAssembly.js:1469-1476`, flat6 header) and `slot` is a required enum on every call (`agentEvalToolSchema.js:254-256`, `:265-269`): the agent guesses the slot, wrong for 47 % of League exit calls (E report §2, 60 of 127).
5. **Nothing else.** No `tool_choice` change (the call stays forced to `submit_trade_decision`), no change to the system or user prompt for `declarations`, `max_tokens` stays 3,072, temperature 0.4, no caching.

**What the framework chat must bless for a general release** (a line-by-line list, each in the file shown):
- (a) **The six description strings of the `on` tool** for *every* agent persona and archetype, not the two accounts' (`agentEvalToolSchema.js:381-453`).
- (b) **The claim "the player sees each one as a tile in their cockpit and can answer it"** (`:437-444`). It is **false for any battle whose owner never sees the cockpit**: League battles today (the wall, §C1), any client on an old bundle, a player whose status call fails. Either exclude those battles from `on`, or reword the sentence; this is the one model-visible statement that depends on the screen.
- (c) **The calls-block heading and its row, answer, fact and Amendment G templates** reaching the voice of every chat in battle mode (`callsBlock.js:66`, `:111-123`).
- (d) **The call-directive canonical texts** that land in the agent's prompt after any player answer (Amendments B, D).
- (e) **The League case** (item 4), if League stays in the release.
- (f) **Playing the cost against the persona:** +20 % output tokens (the block's own sentences) changes how long answers run (p90 1,762 vs 1,336 in League).

### C5. Open items — every "found, not fixed" from Build 2a, 2b, E, F and G

Status is checked at `origin/main` where the item names code. **Two items block; 28 can follow; 4 more are already resolved** (34 in all). Sources: 2a = `20261003_BUILD2A_COCKPIT_SCREEN.md` (§11, §13.9–13.10), 2b = `20261021_BUILD2B_COCKPIT.md` (§11, rulings), E = `20261029_COCKPIT_EXIT_NOT_HELD.md` (§15, §17), F = `20261102_COCKPIT_ENTRY_ALREADY_HELD.md` (§8, §1c), G = `20261104_COCKPIT_CALLS_BLOCK_STANDING.md` (§8).

#### The five you named

| # | Item | Source | Status at the head | Class | Reason |
|---|---|---|---|---|---|
| 1 | **The hot-bench "no price" rows** in the bench sheet | 2b Q2, Q3; `cockpit-bench.js:39-54` | **unchanged.** The price source is `voiceLayerCache.benchBriefs`: a hot-bench name always reads "no price" though the executor accepts it, and every stock row reads "no price" before the battle's first voice-layer run | **blocks** | the founder's ruling was "accept as built **for the pilot**" and sent it to the price-authority arc; every new battle shows empty prices for its first 15 minutes, and hot-bench names always. It needs a re-ruling for a general population (or the price-authority arc) |
| 2 | **The bench-cooldown entry case** | F §1(c); `callActions.js` has no cooldown test | **unchanged.** An entry on a stock swapped out in the last 24 h mints open and its buttons offer "If you say nothing it brings it in"; the executor refuses it. Live count **1 of 150** entry calls (0.7 %, League `MTCH`, resolved `hit`, never answered) | can follow | one live instance, never answered; add a rule only if post-launch `go_now`s on cooldown stocks show up. Measure the rate per stage |
| 3 | **The League slot label** (behind the wall) | E §15.1, §15.3, §17 cond 2; `featureFlags.js:249-265`, `agentEvalPromptAssembly.js:1469-1476` | **unchanged.** The wall holds on the screen only; the server mints `on` records for League; 47 % of League exit calls name the wrong tier | **blocks** | an owner-keyed "everyone" turns League `on` server-side for every League player, with a tool sentence about a cockpit they cannot see (§C4b). **Stops blocking if the release resolver excludes League** (§C2), which needs no fenced file |
| 4 | **The unknown-executor case** | E §15.8a (NH-L1-2, ruled "keep the letter") | **unchanged.** An unknown executor outcome (threw after the commit, and the landed-trade re-read also failed) leaves `executorResult` null, and an exit on the maybe-bought stock mints `exit_not_held` immutably | can follow | needs a double fault and an agent exiting the stock it is buying; **0 of 284 counted** and 0 `exit_not_held` ever. A wrong, immutable tag is the cost; count it per stage |
| 5 | **"See what it's eyeing"** (an honesty-guard string, now the hub's) | 2b Q1 (separate cleanup); `hubCopy.js:382`, `CommandDashboard.jsx:508`, `ReadColumn.jsx:139`, `ScoutingBoardSheet.jsx:151` | **unchanged, and it has spread**: the hub copy carries it too. The cockpit's own labels ("From {Agent}'s lists") comply; `deskHonesty.test.js:115` forbids "eyeing" only in the desk copy's scope | can follow | a copy cleanup in files the cockpit does not touch; it is not a cockpit gate, but it is the same rule the cockpit obeys, so fix it before the hub is the front door |

#### Everything else

| Item | Source | Status | Class | Reason |
|---|---|---|---|---|
| CB2-1 replaced/retired command read as a standing "answered:" row | 2b Q4 | **closed** by Amendment G (merged 2026-11-05 01:08 UTC) | resolved | |
| CB2-2 bare "answered: Bring in" read race | 2b Q5 | **closed** by G-2 (one re-read) | resolved | |
| Gameplan meeting expiry `setHours(16)` host-time bug | 2b found-not-fixed | **closed**: PR #987 merged 2026-10-22; `setHours(16` absent at the head | resolved | |
| `AssetResearchModal` has no focus or Escape handling | 2b found-not-fixed | **unchanged** (`draft/AssetResearchModal.jsx`: no Escape/focus code) | can follow | an accessibility gap on a modal the cockpit defers to; not a cockpit gate |
| False "has already left your book" line on a D-4 slot-tier refusal | E §15.2; `battleViewCopy.js:1343`, `:1346` | **unchanged** | can follow | unreachable while League routing holds and one-day battles keep a sold stock out for 24 h (F §8.3) |
| Scoped bench sheet's Pick buttons wait when the step is null | E §15.4 | unchanged | can follow | they wait, do not crash and do not file |
| Unreadable parent is not refused an acknowledgment (fail-open) | E §15.5 | ruled keep; row pins it | can follow | by ruling |
| An exit on the check's own `symbolOut` | E §15.6, §17 cond 1 | **verified closed** (`minting_check` skip; 5 of 284, none acted) | resolved | |
| Single tag when a recorded filing owns it (NH-L3-2) and the "bought stock judged on the pre-trade book" nit | E §15.8b, §15.8c | ruled accept | can follow | an omission, not a falsehood |
| **Position identity before multi-day battles** | E §17 cond 4 | unchanged; battles are one day (`agentBattleService.js:127`, `AGENT_BATTLE_DURATION_MODE 'fullday'`) | can follow | held is a symbol test, safe while the 24 h cooldown covers a one-day battle; **blocks the multi-day format arc**, not this release |
| Chip word and silence line keyed on the tag (F-2) | F §8.1 | ruled keep | can follow | by ruling |
| Details sheet default line ("If you say nothing · intent: bring in …") stays beside "Already in your book" | F §8.2 | ruled keep | can follow | an intent by the copy's own definition |
| `counterpart_not_held` → "{CP} has already left your book" is slot-tier | F §8.3 | unchanged | can follow | unreachable (counterpart stored only when in the slot tier; cooldown) |
| A directive filed before the stock arrived is not retired | F §8.4 | unchanged | can follow | 0 of 14 after-mint arrivals was answered |
| Gameplan-legs route mislabels "upside" vs "already in your book" | F §8.5 | ruled leave | can follow | practically unreachable (no mounted UI approves a meeting) |
| `heldAtMint: true` conflates "held at the seam" and "bought by this check" | F §8.6 | unchanged | can follow | reads must rebuild the split from `trades[]` (as Part B does) |
| Spec staleness (V1_0 §5.2, §5.4, §6.2, §7.1) | F §8.7 | unchanged | can follow | documents |
| Screen row idiom passes vacuously if its anchor is lost | F §8.8 | unchanged | can follow | a test |
| Other ways a command ends (a kill; an already-resolved call) | G §8 | unchanged | can follow | the amendment puts them out of scope |
| Calls-block heading does not mention the new segments | G §5 | ruled keep | can follow | by ruling |
| Q6: a stray `pickSymbol` is `invalid_request`, D-4 says `illegal_answer` (erratum, not folded) | 2b Q6 | open erratum | can follow | documents |
| Q1 "eyeing" erratum to Amendment D-3's label line (not folded) | 2b Q1 | open erratum | can follow | documents |
| Q7 "Filed · no check left today" can show for seconds while the last check runs | 2b Q7 | ruled keep | can follow | by ruling |
| 2a P1-7 the `directive_pending` line and the 60 s clock (up to ~90 s) | 2a §13.9 item 3 | open | can follow | a window of seconds |
| 2a "not yet heard" after the day's last check | 2a §13.9 item 4 | open | can follow | cosmetic |
| 2a event reader keeps 150 events | 2a §13.9 item 9 | open | can follow | 28 events a day today; a long-lived call is a day old at most |
| 2a "Battle ended" tag cannot show; +12 KB main chunk; status 404-vs-403 existence oracle | 2a §11 items 10, 11, 13 | open | can follow | cosmetic / size / by design |
| 2a an open tab stays on until reload after a rollback | 2a §11 item 12 | open | can follow | bounded by `no-store`; matters for the kill switch's wording |
| 2a per-view status call (seen-marker waits up to 8 s) and the sweep skip pass | 2a §13.10 | accepted | can follow | they scale with the release: the first costs one request per Battle View, the second becomes real work (§A3) |

---

## 7. What the rollout build should carry (not built here)

1. **A cockpit-only cohort**, one function (`mode.js:84`), agent-mode + real owners only, with a stable bucket (§C2, §C3). `cockpit-status.allowlisted` stays the pilot verdict.
2. **A Firestore control document** for the share and a disable switch, read like `readMasteryFlagView`, failing closed (§C3).
3. **The re-ruling on the hot-bench "no price"** or the price-authority arc (C5 item 1); a decision on League (C5 item 3): excluded by the resolver (recommended) or the slot label first.
4. **The framework chat's line-by-line blessing** for a general population (§C4), item (b) first.
5. **A volume plan the evaluator can hold:** about 9 full battle-days a day today, and a stated target; per-battle fan-out is the real fix (`agent-evaluate.js:493-502`). The sweep needs a bigger page or a per-battle expiry path past about 50 open battles (§A3).
6. **Per-stage trips** from the records used here (§C3), and an extended rollback check that reads the cohort.

**Questions for the founder** (none blocks reading this report): (1) League in or out of the first general stage? (2) Re-rule Q2 for general release, or hold for price authority? (3) What peak concurrent battle count is the first target? (4) Is a Firestore control document acceptable as the kill switch, given the redeploy-only rollback you have today?

---

## 8. Method, validation and limits

- **Scripts** (scratchpad, not committed): a read helper (parses the main checkout's `.env.local` in memory and passes only `FIREBASE_*` to the process; the archived dump gives the two uids by label), five extractors (battles select-masked to the fields named here; ticks; `agentEvalRuns`; call/event counts via `count()`; calls and events for the census) and analyses. **Every query is `.get()` or `count()`**; `.select()` masks keep unneeded fields (and text) out of memory.
- **Classification of a check** is from its own tick `schemaVersion` and date, never from its owner; mismatches would have been excluded (none found: v1 ticks stop on Oct 5 for the founder, v2 start Sep 28 with the shadow era excluded). `dispatched = true` is the denominator for failures; every dispatched tick had a `callEnvelope` (1,133 of 1,133) and a written capture.
- **Regressions:** input tokens on request bytes (n = 1,019, r = 0.990, 0.343 tokens/byte, intercept −1,423); model ms on output tokens (n = 1,019, r = 0.974, 10.4 ms/token, intercept 1.84 s); run wall time on model calls (last 10 sessions, n = 260, r = 0.94, 34.6 s/call, intercept 4.8 s; since Sep 24 n = 875, 29.0 s/call, r = 0.92, a mixed on/off cohort).
- **Limits.** (1) One real `off` owner; the `off` window ends Oct 23. (2) `callsDiag.ms` and `phaseResult` are one sample per battle; per-check `skipped_budget` is not recorded. (3) Per-check Firestore read counts are not recorded; the read figures are code bounds (ASSUMED). (4) The 40 s deploy time is from commit time to the GitHub deployment record; the redeploy path and the dashboard steps were not measured. (5) The cost uses Haiku 4.5's list price from the skill's cache of 2026-11-03; no usage report was read (no Admin API key was used). (6) Tick records start 2026-09-22; nothing earlier is measured. (7) 2026-11-10 is partial (read at 14:44 ET) and is included only in Part B. (8) The allowlist's production value was not read.
- **Nothing written:** no flag, environment variable, Firestore document, deployment or setting changed; `firebase deploy` was not run; no PR was opened.
