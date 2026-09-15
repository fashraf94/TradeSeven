# Phase 0B — Film Room Mechanics Discovery

**Type:** READ-ONLY discovery. No code, config, flag or data changed. No PR. Hard STOP after this document.
**Date:** 2026-09-15
**Branch:** `claude/epic-bell-stwcxu` — see the branch note in §1.
**HEAD:** `a007a2b5dfe0ac1471c4edacebfcfeddc3ec05e8` (short `a007a2b5`) — "Merge pull request #849 from fashraf94/fashraf94-patch-17"
**Report also stored outside the repo tree** (BUILD_RULES §3): `~/20260915_PHASE0B_FILM_ROOM_DISCOVERY.md`

**Method.** Every factual claim carries a `path/file.js:line` citation read at this HEAD and is marked **VERIFIED** unless labelled otherwise. Section A was worked by the lead. Sections B–F were worked by seven read-only subagents (B1/B2, B3/B4, B5+F2, C1, D1–D3, E1–E3, F1/F3); **every load-bearing citation in each subagent report was re-opened by the lead before inclusion.** One subagent citation was found wrong and is corrected in §3-E2c. Nothing in this report is included on a subagent's word alone.

---

## 0. Executive verdict

| # | Question | Verdict |
|---|---|---|
| **A1** | Where the Film Room's numbers come from | **Three surfaces, two unrelated sources.** The Film Room computes a per-day number that omits every still-held position; the Command Center and the day-summary prose both read the battle's cumulative score. There is **no per-day total stored anywhere** for the surfaces to share. |
| **A1** | What decides an agent battle's outcome | `resolveCompletionDisposition` — cumulative score vs CPU score. **It counts badge points.** The result is **never written to the battle document** — it survives only in a feed sentence and the agent's career stats. |
| **B1** | Swap reasons at HEAD | **Nine.** `gameplan_proposal` is a **phantom** — zero writers; the spec documents claiming it are refuted. |
| **B1** | Can a gameplan proposal execute without player confirmation? | **No — no such path exists.** But the approval UI is **unreachable at HEAD**, so every gameplan meeting expires unapproved. A *separate* co-pilot timeout-accept path does exist and is double-blocked. |
| **B2** | Risk boundary persisted per swap? | **No.** Stop prices, trail levels and high-water marks are nowhere on the trade. They survive as English prose, or on a sibling record whose join key is **null on 3 of 6 swap paths**. |
| **B2** | Exit-time technical snapshot? | **Yes for 4 of 6 paths** — but mostly **daily-grain**, only the intraday block is tick-fresh, and the incoming stock's intraday block is always empty. |
| **B3** | Replacement picker | One function, shared by both paths. It reads **four shallow signals** — cooldown, asset type, held-set exclusion, and today's percent change. No scores, no archetype fit, no sector cap. |
| **B4** | Post-sale prices | A sold stock **stays on the bench and is quoted every 15 minutes — and none of it is ever written down.** The last recorded price is the sale price. |
| **B4** | Can the scorer replay a sold stock? | **Yes — it is a pure function.** This is the single most enabling fact in the report. |
| **B5** | Counterfactuals | Written by one job, **read by nothing live.** A second, parallel counterfactual field is read by the prompt layer and **has no writer at all.** |
| **C1** | Armed state | **For none of the six mechanisms can "was this armed at 11:35?" be answered from stored data.** Two are unrecoverable in principle. On a quiet tick the two guardrails are **never evaluated at all**. |
| **C1** | Freshness gate | Checks a **calendar date, not an age.** Disarms two mechanisms; one has its streak counter **destroyed, not paused**. |
| **D1** | Indicators to the trading brain | **Held positions get no RSI, no MACD, no relative strength, no trend, no volume.** The full technical stack exists only for bench candidates. |
| **D2** | Watchlist mid-battle | **Frozen at deploy.** Equip and unequip are hard-blocked (HTTP 409). The mid-battle agent is **structurally unaware a watchlist exists**. |
| **D3** | Anticipation entries | **Hybrid — and the condition half is a free-text English sentence.** No operator, no value, no expiry. "Did it pay off?" is **not computable at HEAD**. |
| **E1** | 5-minute candles | **Active portfolio only.** The fetcher is **fully generic over symbol** — sold stocks, bench and ETFs need a new caller, not new code. |
| **E2** | Sector ETF series | Mapping exists. **No sector or index intraday series is stored anywhere.** |
| **E3** | Cron budget | **39/40 slots used** — matches BUILD_RULES §6. The batch-review cron has the **tightest budget of any post-close cron** (60 s). Two in-repo precedents show how to ride an existing cron instead of spending the last slot. |
| **F1** | Film Room routing | **Nothing auto-routes on completion.** Three manual entry points. The in-battle banner opens on a *filed review*, not on completion. |
| **F1** | Trade rows | **Every number on a row is the sold stock's. The bought stock contributes only its ticker.** Confirmed by construction in the executor. |
| **F1** | Review chat grounding | **Structurally ungrounded at every flag value** — grounding requires battle mode and the Film Room sends review mode. |
| **F2** | Settings fingerprint | One hash function — but the two deploy paths feed it **different inputs**. Same configuration, two different fingerprints, **failing silently**. |
| **F3** | Industry layer | **Fully implemented**, both spec phases. **Zero reach into the Film Room.** |

---

## 1. Session record (BUILD_RULES §3)

- **`git fetch origin` was the first action of this session** (§3). It brought in new remote branches; no stale-ref condition was present.
- **Branch:** `claude/epic-bell-stwcxu`. **HEAD:** `a007a2b5dfe0ac1471c4edacebfcfeddc3ec05e8`.
- **`origin/main`:** `a007a2b5dfe0ac1471c4edacebfcfeddc3ec05e8` — **identical to HEAD** (0 ahead / 0 behind).
- **`git status --porcelain`:** empty. **Working tree clean at open.** No STOP condition.
- **History inspection used:** `git log --oneline -3`, `git log --all --oneline --diff-filter=A -- "*FILM_ROOM_REVIEW_LOOP*"`, `git ls-tree -r --name-only origin/main`. No history was rewritten, no branch created before the commit of this report, nothing checked out.

**Branch-name note (for the founder).** The Phase 0B prompt specifies branch `claude/phase0b-film-room`. This session's binding git instruction designates `claude/epic-bell-stwcxu` and forbids pushing elsewhere without explicit permission. That branch is cut from current `main` and clean, so it satisfies BUILD_RULES §2's substance (one task, one branch, fresh from `main`). The work landed there rather than improvising a second branch. **Precedent for this disposition:** `docs/audits/LEAGUE_BATTLEVIEW_PHASE0_FINDINGS_20260821.md`, whose branch note resolves the identical conflict the identical way. Flagging rather than choosing silently.

**Context document — NOT PRESENT.** The prompt states that `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_2_20260915.md` "must be on `main`". **It does not exist at this HEAD, anywhere in the tree, or in any commit reachable from any ref.** Verified three ways: the file is absent (`ls`); a repo-wide case-insensitive `find` for `*FILM_ROOM*` returns only the four `COMMAND_CENTER_FILM_ROOM_REDESIGN_*` files at the repo root; `git log --all --diff-filter=A` for the path returns nothing. This is a reporting limitation, not a blocker: the prompt reproduces the question list (its §11) in full, and the design note is context rather than a source of truth about code. **Consequence for §3's third column:** where a "document claim" is one the prompt itself states, it is confirmed or refuted below; where a claim lives only in the missing note, it is marked *not addressable*.

**Fence compliance.** `decide.js`, `agentEvalPromptAssembly.js`, `agentScoring.js`, `agentSwapExecution.js`, `agentArchetypeConfig.js`, `agentRiskManager.js`, `agentGuardrails.js` and `agentBattleService.js` were **read only**. No fenced file was modified. No function in them was called.

**Subagent discipline (prompt rule 6).** Seven read-only subagents were used. Each was instructed: no file creation, no state-changing git, no Firestore, no external API, no test runs. The lead re-opened every load-bearing citation before inclusion. Three subagents disclosed that they could not satisfy BUILD_RULES §3's "reports are files" clause because the task forbade file creation; that obligation is discharged by this document and its out-of-tree copy. One subagent wrote its findings to the session scratchpad (outside the repo tree), which is compatible with the read-only scope.

---

## 2. Plain-terms summary for the founder

*(No field names. One page.)*

**What is true today.**

The Film Room is not showing you a smaller version of your battle score. It is showing you a different number built from different ingredients. The score you see everywhere else — on the Command Center card, in the agent's own written day summary, on the live battle screen after it ends, and in the win/loss decision itself — is the whole picture: what every stock you were still holding was worth, plus what every stock you sold banked on its way out, plus the bonus points carried over from previous days. The Film Room's day number leaves out the first of those three entirely. For a one-day battle, it is *only* the sold stocks. If your sales went badly and the stocks you kept went well, the Film Room will show you a loss on a day you won. That is exactly the Sep 14 shape.

There is a second hole stacked on top. The overnight job that banks the day's bonus points only looks at battles that are still running. A battle ends at the closing bell, so by the time that job runs in the evening, the battle is finished and gets skipped. The final day of every battle therefore has no bonus record at all, and the Film Room reads that absence as zero. On a one-day stock battle, both holes fire at once.

Underneath the score, the record is thinner than the screen suggests. When the agent sells a stock, it writes down the sold stock's entry price, exit price and points — and nothing about the stock it bought. A trade row cannot tell you whether the swap was a good idea, because the incoming stock's numbers are never on it. The stop levels and trailing levels that actually forced the exit are not written down either; they survive only inside an English sentence, or on a separate record that, for half the exit routes, has no working link back to the trade. And the agent's own entry time for the position it just sold is destroyed by the sale, so you cannot even compute how long it held.

The good news is large and specific: the scoring function is pure arithmetic over a price series. It does not need a live battle. Point it at any stock's prices and it returns the same verdict it would have returned live. Everything the redesign wants to say about "what would have happened if it had held" is computable — it just has to be fetched, because none of it is stored.

**What that changes for the design.**

Three things. First, the headline number has to come from one place that every screen reads, and that place does not exist yet — it has to be written, per day, at the moment the battle's numbers are final. Second, "what was it worth against holding" cannot be read out of the record; it has to be recomputed from market data after the close, and the plumbing to fetch that already exists and works on any stock, sold or not. Third, several things the design assumes are already captured are not: which mechanism was watching which stock at which minute, what else was on the bench when the agent chose, and whether the condition the agent said it was waiting for ever came true. The first two are unrecoverable after the fact. The third is stored as a sentence rather than a rule, so no code can ever check it.

**The three biggest surprises.**

1. **The day score is not a slice of the real score.** It is the sale ledger plus a bonus figure that, on a battle's final day, is never written. Nobody wrote a bug; two correct-looking pieces were built against different definitions of "the day's points", and no single number exists for them to agree on.

2. **Nothing records what the agent was watching.** Whether a given protection was armed for a given stock at a given minute is never stored, and for two of them it cannot be reconstructed even in principle — one deliberately keeps no history, the other's counter is wiped rather than paused whenever the data goes stale. Worse, on a quiet minute where the agent was not woken up, the stop-loss and trailing-stop were not merely unarmed — they were never checked at all.

3. **The button for the player's own directive is not on any screen.** The strategy-meeting card exists and works, and the agent's side of it runs every day. But no live screen hands the card the meeting, so the player never sees it, never approves it, and the meeting quietly expires at the closing bell every time. This is why the Sep 14 Film Room showed no record of the directive: there was nothing to record, because the approval never happened. Two smaller cousins of this: the agent's suggested rules are written and displayed but wired to nothing, and its filed improvement suggestions are written by a robot with no human in the loop and read by no screen at all.

---

## 3. Findings A–F

Legend for the third column: **CONFIRMED** / **REFUTED** / **NOT ADDRESSED** refer to claims the *prompt* makes. Claims that live only in the missing design note are marked *not addressable* (see §1).

---

### A. Score and outcome

#### A1 — Where each Film Room number comes from; what the Command Center and day summary read; what decides the outcome

**Finding — the Film Room header carries no number at all.** `FilmRoomHeader.jsx` renders a back button, the words "Film Room", and `· N days`. The number read as −176 is the **Total** on `ScoreSummaryCard`, which sits directly beneath the sticky header.

**Finding — the Film Room's day score is `Σ that day's closed-trade points + that day's banked badge points`, and nothing else.**

```
computeDayScore(battle, dayNum):
  badgePoints = battle.scoreState.dailyScores["day"+N].badgePoints ?? 0
  tradePoints = Σ trades filtered to day N → .lockedPoints
  total       = tradePoints + badgePoints
```

**Finding — the battle's real score has a *third* term the Film Room has no access to.**

```
currentScore = activeScore + bankedScore + bankedBadgePoints
             = Σ HELD positions' totalPoints
             + Σ ALL closed trades' lockedPoints
             + Σ overnight-banked bonus points
```

and `totalPoints = basePoints + bonusPoints`, where `basePoints = priceChange × 10 × tierMultiplier` — the mark-to-market term. **The per-day record stores only `bonusPoints`.** The `basePoints` of held positions exist in no per-day record anywhere, so `computeDayScore` structurally cannot include them.

**Finding — on a battle's FINAL day, even the badge half is missing.** The only writer of `scoreState.dailyScores` is the `agent-daily-scores` cron, which selects `status == 'active'` battles. A stocks-only battle expires at 16:00 ET; the evaluate cron runs every 15 minutes through 21:45 UTC (17:45 ET) and completes it. By 01:45 UTC (20:45 ET), when `agent-daily-scores` runs, the battle is `completed` and is skipped. The completion payload writes no `dailyScores`. So the final day's entry is never written and `?? 0` applies. *(A battle whose portfolio carries crypto expires at 20:00 ET — after the last evaluate run but before the daily-scores run — so it does get its final-day entry. The asymmetry is derived from the cited schedules and expiry rules, not observed in production.)*

**Net for a one-day stocks-only battle: the Film Room Total is the day's sale ledger and nothing else.** That is the −176 vs +125 shape exactly.

**Finding — the Command Center and the day summary both read the cumulative score.** `ReviewStation` reads `latest.scoreState.currentScore`. The batch-review cron feeds the *same* field into the Haiku prompt that authors the day-summary prose. Both are fed the raw `agentBattles` document — the Command Center's tap handler passes that very object to the Film Room, which re-subscribes to the same document by ID. **One document, one tap apart, two numbers.**

**Finding — the live battle screen agrees with the Command Center, not the Film Room.** For a completed battle `AgentBattleScreen` freezes on `scoreState.currentScore`. *(Separate observation: its **live** client total is `active + banked` and omits `bankedBadgePoints`, so it drifts from the server's cumulative score on multi-day battles — a §9 display-agreement issue, reported not fixed.)*

**Finding — the outcome is decided by `resolveCompletionDisposition`, it does count badge points, and it is never persisted.**
- `result = currentScore > opponentScore ? 'win' : (currentScore < opponentScore ? 'loss' : 'draw')`; tournament mode returns `result: null` with group placement instead.
- **Badge points count on both sides:** bonus points ride inside `totalPoints`, plus `bankedBadgePoints`, plus `lockedPoints` (itself a `totalPoints`).
- **The completion payload contains no `result` field.** The outcome survives only in (i) the feed sentence, (ii) the feed entry's `score`, (iii) the agent's career stats, (iv) `completionContext` for tournament mode. Any surface wanting to show Win/Loss must re-derive it or parse prose.

**Finding — there is no single source every surface could read today.** `scoreState` holds cumulative `currentScore`/`activeScore`/`bankedScore`/`bankedBadgePoints`; `dailyScores.dayN` holds badge points only. **No per-day total is stored, and no stored outcome exists.** The Film Room already receives the full document client-side via a live snapshot, so nothing is being withheld by a view layer — the number simply is not there to read.

**Evidence**

| Claim | `file:line` |
|---|---|
| Header renders no score; `· N days` | `src/components/FilmRoom/FilmRoomHeader.jsx:41-56`; `totalDays` at `src/screens/FilmRoomScreen.jsx:110` |
| The Total / Trades / Badges figures | `src/components/FilmRoom/ScoreSummaryCard.jsx:43`, `:57`, `:63`; call `:11` |
| `computeDayScore` body | `src/utils/computeDayScore.js:20-36`; badge read `:22`; trade sum `:24-29`; total `:34` |
| Day filter (`swapDay`, else `dayOf`) | `src/utils/computeDayScore.js:11-18`; `src/utils/dayOfTimestamp.js:25-41` |
| `currentScore` three-term composition | `api/cron/agent-evaluate.js:875` (active), `:876-878` (banked), `:882` (badges), `:883` (sum), written `:885-891` |
| `totalPoints = basePoints + bonusPoints` | `api/_utils/agentScoring.js:296`; `basePoints` `:270`; `bonusPoints` `:286` |
| Only writer of `dailyScores`; badge-only payload | `api/cron/agent-daily-scores.js:182-187`; bonus-only accumulation `:130`; held-only loop `:84` |
| `scoreState` creation shape (no per-day total) | `api/_utils/agentBattleService.js:274-286` |
| Active-only battle query | `api/_utils/agentBattleService.js:43-47` |
| Cron schedules | `vercel.json:64-67` (daily-scores `45 1 * * 2-6`), `:156-159` (evaluate `*/15 13…21 * * 1-5`) |
| Expiry = 16:00 ET last day; 20:00 ET with crypto | `api/_utils/agentBattleService.js:334-356`, `:377-391`; `api/_utils/marketSchedule.js:270` |
| Expiry sweep → `completeBattle` | `api/cron/agent-evaluate.js:224`, `:230` |
| Completion payload writes no `dailyScores`, no `result` | `api/cron/agent-evaluate.js:4498-4538` |
| Outcome decision | `api/cron/agent-evaluate.js:4309-4333`; result `:4322-4323`; tournament `:4312-4320` |
| Career stats consume `result` | `api/cron/agent-evaluate.js:4589`, `:4604-4612` |
| Opponent score | `api/cron/agent-evaluate.js:872` |
| Command Center reads `currentScore` | `src/components/Dashboard/ReviewStation.jsx:21`, rendered `:58`; mounts `CommandDashboard.jsx:595`, `CommandDashboardDesktop.jsx:331` |
| Day-summary prompt is fed `currentScore` | `api/cron/agent-batch-review.js:267`; entry written `:317-327`, `:336`; rendered `src/components/FilmRoom/DaySummaryCard.jsx:115` |
| Same doc to both surfaces | `src/components/Dashboard/CommandDashboard.jsx:284`; `src/hooks/useRecentCompletedAgentBattles.js:29-51`; `src/hooks/useAgentBattle.js:26-44`; `src/screens/FilmRoomScreen.jsx:35-36` |
| Completed-battle freeze | `src/screens/AgentBattleScreen.jsx:1046-1050`; live client total `:1034-1037` |
| Eval prompt uses the same three-term decomposition | `api/_utils/agentEvalPromptAssembly.js:1135` |

**Document claims.** The prompt's claim that *"its Film Room header read −176 while the Command Center and the day summary read +125"* — **CONFIRMED as to mechanism**: the three surfaces read two unrelated sources, and the Film Room's omits the mark-to-market term entirely; on a one-day stocks-only battle it also loses the badge term. The specific production figures were not checked (no Firestore access) — see §4, Query 1. The prompt's claim that the trade rows show only the sold stock's numbers — **CONFIRMED**, see F1. The prompt's claim of no record of the filed directive — **CONFIRMED and explained**, see B1.

---

### B. Swaps and what the records keep

#### B1 — Every swap reason, and the gameplan confirmation gate

**Finding — nine `exitReason` values, produced by six `executeSwapServer` call sites.**

| `exitReason` | Mechanism | Origin `file:line` |
|---|---|---|
| `bust_avoidance` | risk manager, ATR buffer breach | `api/_utils/agentRiskManager.js:131` |
| `vwap_failure` | risk manager, consecutive ticks below VWAP | `api/_utils/agentRiskManager.js:144` |
| `stepped_trail` | risk manager, ATR level + SMA cross | `api/_utils/agentRiskManager.js:168` |
| `stagnation` | archetype forced rotation (Knob A) | `api/_utils/agentRiskManager.js:189` |
| `haiku_decision` | the model's own SWAP, no guardrail note | `api/cron/agent-evaluate.js:2295-2297` |
| `guardrail_stopLoss` | `applyGuardrails` forced exit | `api/_utils/agentGuardrails.js:352-353`, `:558` |
| `guardrail_trailingStop` | `applyGuardrails` forced exit | `api/_utils/agentGuardrails.js:352-353`, `:558` |
| `guardrail_profitTarget` | profit-target executor | `api/_utils/agentGuardrails.js:352-353`, `:558`; flag `src/config/featureFlags.js:1850` (`true`) |
| `gameplan_rotation` | approved gameplan meeting (hardcoded literal) | `api/cron/agent-evaluate.js:3996` |

Corroborated by a closed, fail-closed enum of exactly these nine: `api/_utils/learning/learningEnums.js:30-47`. Call sites: `api/cron/agent-evaluate.js:1619`, `:2419`, `:3216`, `:3427`, `:3787`, `:3990` — matching BUILD_RULES §7's "six `executeSwapServer` call sites". Reasons that exist but can never reach a trade: `threshold_proximity` (returns `LOCK`; the dispatch filter at `:1382` queues only three actions) and `guardrail_max_sector_weight` (returned with `decision: 'HOLD'`).

**Finding — `gameplan_proposal` is a phantom.** Exhaustive non-test grep returns exactly one hit repo-wide, and it is a comment: `api/_utils/agentRiskManager.js:29`. It is absent from both closed enums. The repo already knows: `api/_utils/invariant1Matrix.test.js:18-19`.

**Finding — `gameplan_meeting`: the cron proposes, the player confirms, and no path executes without confirmation.**
- **Proposer:** the cron, deterministically, **no LLM**. `detectGameplanMeetingTrigger` (`api/cron/agent-evaluate.js:1836`, defined `:4161`) is pure heuristics over battle state — e.g. three consecutive losing trades (`:4172-4181`) — capped at one per ET day (`:4164`). The meeting is built with `status: 'pending'` and an expiry of 16:00 ET (`:4280-4293`, `:4274-4277`), persisted at `:1862-1868`, and the tick then returns without evaluating (`:1870`).
- **Confirmer:** the human coach, via one client-side writer. `GameplanMeetingCard.jsx:123` / `:138` → `:22` → `src/services/agentService.js:613-627`, stamping `resolvedBy: 'coach'` at `:622`.
- **The gate:** `if (meeting.status === 'approved')` at `api/cron/agent-evaluate.js:3943` is the **only** branch containing an `executeSwapServer` call (`:3990`).
- **The absence:** the expiry branch writes `status: 'expired'`, pushes a hold beat, clears the meeting and returns — **there is no `executeSwapServer` between `:4134` and `:4145`**. The rejected branch likewise (`:4117-4126`). No server-side writer of `'approved'` exists.

**Finding (and this answers the motivating case) — the gameplan approval UI is unreachable at HEAD.** `GameplanMeetingCard.jsx:16` returns `null` unless the meeting is pending. Its only non-archived mount is `AgentActivityFeed.jsx:758-761`, which needs the prop declared at `:648`. **Neither live mount passes it** — `src/screens/battleView/PaneTape.jsx:223-232` and `src/components/Agent/GameTapeView.jsx:636-646`. `src/screens/AgentBattleScreen.jsx:659` destructures `gameplanMeeting` and never uses it. The only passer is `src/components/Agent/AgentStrategyTab.ARCHIVED.jsx:199-202`. **Net: meetings are created daily, block the model for the rest of the day (`:4148`), and always expire unapproved at 16:00 ET. `gameplan_rotation` is in practice unproduced.** *(Probable wiring regression; no ruling found saying it was deliberate. Reported for separate tasking per §3 — not fixed.)*

**Finding — a real auto-accept exists on the *other* proposal channel, and is double-blocked.** For `pendingProposal` (co-pilot mode), expiry auto-executes: `api/cron/agent-evaluate.js:3384` under `// Auto-execute on expiry` (`:3385`) → `executeSwapServer` at `:3427`, recorded as `auto_executed` / `resolvedBy: 'system'` (`:3541-3542`). It cannot fire at HEAD because (i) the launch guard at `:3150-3163` short-circuits every autopilot battle *before* the expiry check, resolving without executing, and (ii) no reachable UI can leave autopilot — the only mode setter's sole caller is imported by an archived file and commented out at `src/screens/AgentBattleScreen.jsx:64`. **A direct Firestore write of `executionMode: 'copilot'` would re-arm it.**

**Document claims.** `FORGE_ENFORCEMENT_KEYSTONE_SPEC_V1_4.md:392` and `:513` list `gameplan_proposal` as a live reason — **REFUTED by code.** The prompt's premise that `gameplan_proposal` is a reason at HEAD — **REFUTED**; the real literal is `gameplan_rotation`. The prompt's question "whether any path executes a proposal without an explicit player confirmation" — **answered: for gameplan meetings, no such path exists; for co-pilot proposals, one exists and is dormant.**

---

#### B2 — Fields persisted per swap

**Finding — the trade record is built at `api/_utils/agentSwapExecution.js:255-273` and is written by exactly one function.** Thirteen fields are unconditional; caller metadata is spread after them; `snapshot` last. The `trades[]` array is **capped at 50** (`:354`).

**Unconditional block:** `symbolOut` `:256` · `symbolIn` `:257` · `name` `:258` (the *outgoing* asset's) · `tier` `:259` (slot tier) · `slotIndex` `:260` · `entryPrice` `:261` · `exitPrice` `:262` · `lockedPoints` `:263` · `lockedGainPct` `:264` · `swappedOutAt` `:265` · `swapDay` `:266` · `isCrypto` `:267` (outgoing) · `direction` `:268` · `snapshot` `:272`.

**Metadata block** (`...evaluationMetadata`, `:270`): `id`, `action`, `trigger`, `rationale`, `hypothesis`, `evaluationId`, `tradingDay`, `entryRegime`, `entryMarketPosture`, `entryConviction`, `entryPreset`, `entryMode`, `exitReason`, `swapMotive`, `source`, `archetype`, `hftKnobsSource`, `swapProvenance`, `trade_reasoning` — per site at `api/cron/agent-evaluate.js:1551-1573` (risk), `:2349-2387` (model), `:2631-2658` + floors `:3230-3234`/`:3436-3440` (proposal), `:3732-3748` (R11), `:3994-4005` (gameplan). **Presence genuinely varies:** risk swaps carry no `swapMotive` or `trade_reasoning`; gameplan swaps carry no `hypothesis`, `swapMotive` or `trade_reasoning`. There is **no validator** on the write, so historical documents may carry other shapes (UNVERIFIED — no Firestore access).

**Direct answers.**

- **`reason`: NOT a field.** No trade carries a field named `reason`. The carriers are `exitReason` (why the position closed) and `trigger` (what woke the agent). The fenced consumer documents this as "Trap 1" at `api/_utils/agentRiskManager.js:493-496`. **They are not synonyms:** on the model path `trigger` is a comma-joined list of gate-trigger types (`api/cron/agent-evaluate.js:2351`), orthogonal to the exit reason.
- **`source`: YES**, five values (`risk_manager`, `archetype`, `haiku`, `guardrail`, `gameplan_meeting`), plus `archetype` and `hftKnobsSource`, from `buildSwapReceiptSource` at `api/_utils/agentRiskManager.js:566-572`; closed enum `api/_utils/learning/learningEnums.js:18-24`.
- **Risk boundary: NO — the sharpest gap in the record.** No stop price, no trail activation level, no high-water mark, no threshold value is on the trade. For risk-manager swaps the numbers exist **only as English prose** inside `rationale` (`api/cron/agent-evaluate.js:1554` ← `api/_utils/agentRiskManager.js:132`, `:145`, `:169`, `:190`), recoverable only by string parsing. For guardrail swaps the structured record `{type, symbol, metric, threshold, actual, action, …}` (`api/_utils/agentGuardrails.js:456-463`, `:539-555`) lives on a **sibling** `evaluations[]` entry (`api/cron/agent-evaluate.js:2771-2772`, assembled `:2908`, cap 150, written `:2919`), joined by `trades[].evaluationId === evaluations[].evalId`. **That join is null-by-design on 3 of 6 paths** — risk (`evalId: null` `:1642`, synthetic id `:1562`), R11 (`:3818`, `:3737`), gameplan (`:3982`) — and the cron says why: `:3665-3667`. So for a stop that fired via the R11 pass, **the threshold is recoverable only from feed prose.** The learning schema states the same in its own words: `api/_utils/learning/learningSchemas.js:158-160`.
- **Prices:** `entryPrice` (outgoing asset's own entry) and `exitPrice` (live beacon preferred when under 120 s old, else the REST quote; `api/_utils/agentSwapExecution.js:185-188`, `:194`). The **incoming** asset's entry fill is written to the portfolio slot, not the trade (`:286`). Intermediate quantities (`rawPctChange` `:242`, `thresholdPriceChange` `:243-245`, the Guard-3 baseline `:225-235`) are not persisted.
- **Tier: three different things share the word.** (1) slot tier on the trade (`:259`); (2) the flat-6 multiplier, on the **slot** only, tournament mode only (`:297-299`); (3) the tempo dial band, inside `swapProvenance` (`api/_utils/swapProvenance.js:35-39`) — **this one is on the trade.** Conviction is a 0-100 number, not a tier (floor of 70 enforced at `api/_utils/agentSwapExecution.js:77-79`).
- **Timestamps:** `swappedOutAt`, `swapDay`, `tradingDay` (metadata), and the snapshot's `capturedAt`. `swappedInAt`/`swappedInDay` are on the **slot**, not the trade. **Gap: the outgoing position's own entry timestamp is destroyed by the swap** and never lands on the trade — the cron snapshots it pre-swap only for the learning receipt (`:1615-1617`, `:2405-2407`, `:3782-3784`, `:3987-3989`). **A Film Room reading trades alone cannot compute holding period.** On proposal paths `tradingDay` is the *creation* day and can disagree with `swapDay` (`:3219`, `:3430`).
- **Exit-time technical snapshot: YES on 4 of 6 paths, with three material caveats.** `snapshot = { symbolOut, symbolIn }`, each from `api/_utils/buildTechnicalSnapshot.js:23-111`, built inline at swap time on risk (`:1579-1590` → `:1622`), model (`:2391-2403` → `:2422`) and R11 (`:3751-3763` → `:3790`). Caveats: **(i) gameplan swaps persist `snapshot: null`** — the call at `:3990-4006` passes only nine arguments, so the parameter default at `api/_utils/agentSwapExecution.js:117` applies; **(ii) proposal swaps persist a stale snapshot** taken at proposal creation, 10-15 minutes earlier (`:3236`, `:3442` ← `:2594-2605`; the cron is candid at `:3320-3322`); **(iii) mixed grain** — momentum, volatility, SMA-stack and relative strength come from the daily technical documents and levels/trend/pivots/composite from the daily rankings (the cron calls them "daily-grain technicals" at `:1197-1199`); **only the intraday block is tick-fresh**, and because intraday data is populated for held symbols only (`:967`), **`snapshot.symbolIn.intraday.*` is all-null for every bench swap-in.**
- **Bench composition and cooldown at swap time: NOT persisted.** Only the live, mutable bench exists, overwritten inside the swap transaction (`api/_utils/agentSwapExecution.js:359-360`, computed `:323-351`). The revolving-door entry is replace-or-append (`:340-346`), so a round trip **destroys the prior cooldown rather than versioning it**. Exhaustive negative grep for `benchAtSwap|benchSnapshot|benchComposition|cooldownAtSwap`: zero hits. The only `cooldownUntil` writer is `:320`. The related per-tick counters are flushed to a live map (`api/_utils/agentCronState.js:36-48`) and reset to zero for the incoming symbol before the flush (`:1665-1666`, `:3826-3827`). The bench is also augmented in memory mid-tick with hot-bench assets (`:1120-1127`), so **even the stored bench is not what the validator saw.**

**Other places a swap is recorded:** `statusFeed[]` (cap 100, `api/cron/agent-evaluate.js:681`), `evaluations[]` (cap 150), `proposalHistory[]` (cap 50), `gameplanMeetingHistory[]` (uncapped), narration queue, and the L1 learning receipts (`api/_utils/learning/captureReceipt.js:405-421`; schema `learningSchemas.js:96-200`; create-only). **The receipts carry several things the trade lacks** — entry-ATR provenance, the outgoing position's entry timestamp and day, its threshold history, and decision-time provenance — and are live (`src/config/featureFlags.js:1050`, `:1070`, gated on `classifyEvidence === 'live_agent'`). **Worth considering as a Film Room source.**

**Document claim.** The prompt asks whether there is an exit-time technical snapshot "or only entry snapshots" — **partially confirmed, with the precision the question needs:** there is a genuine exit-time snapshot on most paths, but it is mostly daily-grain, absent on gameplan swaps, stale on proposal swaps, and the *incoming* side's intraday half is always empty.

---

#### B3 — The replacement picker for emergency and guardrail exits

**Finding — one live picker, three call sites, both paths share it.** `pickSwapReplacementCandidate` at `api/_utils/agentRiskManager.js:434` (doc `:418-433`). Call sites: `api/cron/agent-evaluate.js:1444-1461` (stagnation, with a quality predicate), `:1464-1469` (emergency — **no quality predicate**, comment `:1461-1463`), and `api/_utils/agentGuardrails.js:503-508` inside `applyGuardrails` (**no quality predicate**, comment `:499-501`).

**Finding — `pickEmergencyReplacement` is dead.** Defined at `api/_utils/agentRiskManager.js:394-416`, still exported, **zero live callers**. Two negative regressions lock it out: `api/cron/agent-evaluate.test.js:313`, `api/cron/agent-evaluate.suppressionPass.test.js:111`. It was retired because it lacks held-symbol exclusion — compare its filter (`:398-404`) with the live one (`:440-447`); the production bugs are named at `api/cron/agent-evaluate.js:1429-1431` ("June 11: LRCX→LRCX self-swap, PANW triple-slot").

**Finding — the picker reads four shallow signals and nothing else.**

| Signal | Read? | `file:line` |
|---|---|---|
| Held-symbol exclusion | **Yes** | `api/_utils/agentRiskManager.js:437`, `:441` |
| Cooldown | **Yes** | `:443` |
| Asset type (stock↔stock, crypto↔crypto) | **Yes** | `:445` |
| Ranking = today's percent change, descending | **Yes — the only ordering signal** | `:452-456` |
| Quality predicate | Injected; default pass-through | `:434`, loop `:458-460` |
| Technical / fundamental / archetype scores | **No** | absent from `:434-461` |
| Sector caps | **No on the forced-exit path** | `checkSectorCap` (`api/_utils/agentGuardrails.js:773`) is invoked only at `:367`, `:391`, both gated on a *model-proposed* swap |
| Exclusivity ledger | **No inside the picker** — enforced around it | `api/cron/agent-evaluate.js:451-463`, `:1436-1441`, `:481-490` |

Archetype fit reaches it **only** on the stagnation path, via `clearsHurdleFloor` (`api/_utils/agentRiskManager.js:364-382`). Emergency and guardrail reasons bypass that floor by construction (`EMERGENCY_BYPASS_REASONS`, `:32-38`; step 1 at `:339-341`).

**Finding — one asymmetry between the two paths.** The risk path's held-set unions the tournament cross-agent held set (`api/cron/agent-evaluate.js:1436-1441`, which the code calls "belt over the bench filter's suspenders"); **the guardrail path's does not** — it uses the battle's own positions only (`api/_utils/agentGuardrails.js:241`, `:506`, `:671-683`). Cross-agent exclusivity there rests on the upstream in-memory filter plus the reserve ledger. *(Reported for separate tasking per BUILD_RULES §3 — may well be intentional.)*

**Document claim.** The prompt asks about `pickEmergencyReplacement` "or a later route" — **the later route is confirmed and the original is confirmed dead.**

---

#### B4 — After a sale: quoting, persistence, sampling, and replayability

**Finding — a sold stock returns to the bench with a 24-hour cooldown and is quoted on every tick thereafter.** The revolving door builds the outgoing entry at `api/_utils/agentSwapExecution.js:313-321` (cooldown `:320`), replace-or-append at `:338-346`, persisted `:357-360`. The per-tick quote set explicitly includes bench symbols: `api/cron/agent-evaluate.js:689-693`, unioned at `:699`, fetched `:707-721`. **The bench is never trimmed by the cron** — every bench mutation there is in-memory only (`:454`, `:1123-1126`, `:1904`; comment `:443-448`). At `*/15` over nine UTC hours on weekdays, that is **36 quotes per trading day for a stock the battle no longer holds.**

**Finding — none of it is written down. The last persisted price for a sold stock is its exit price.**

| Candidate writer | Persists a post-sale price? | Evidence |
|---|---|---|
| Closed-trade record | Sale price only | `api/_utils/agentSwapExecution.js:194`, `:262`, `:265` |
| Per-tick quote map | **No — explicitly never written** | `api/cron/agent-evaluate.js:702-705` |
| Last-tick price / timestamp in cron state | **No — actively pruned to held symbols** | `api/cron/agent-evaluate.js:1265`; `api/_utils/agentVwapFloor.js:63-69` |
| Threshold history | **No — frozen at the moment of sale** | per-tick writes cover held positions only (`:773`, `:906-908`); the executor copies the map forward (`:290`) |
| `agent-daily-scores` | **No price field at all** | update object `api/cron/agent-daily-scores.js:172-192`; symbol set `:242-246` |
| `baggerbomb-v4-daily-scores` | Writes closing prices — but the **`battles`** collection, active-only | `api/cron/baggerbomb-v4-daily-scores.js:169`, `:208`, `:160`, `:340-343` |
| `compute-daily-baggerbomb-levels` | `battles` only | `api/cron/compute-daily-baggerbomb-levels.js:288`, `:348` |
| Per-tick evaluation record | No price field | `api/cron/agent-evaluate.js:2738-2787` |
| Shadow-assembly capture | **Incidental and unusable** — full prompt text only on divergence | `api/_utils/shadowAssemblyCapture.js:225-233`, `:243-248`; flag `src/config/featureFlags.js:1348` (`true`) |
| Review counterfactuals | Vetoed **buys** only, one spot price, never sales | `api/cron/agent-batch-review.js:207-231` |

**Finding — threshold touches are sampled once per 15-minute tick, not from OHLC.** The scorer supports an intraday-extremes channel (`api/_utils/agentScoring.js:272-279`), but **every agent-path caller passes an empty extremes object**: `api/cron/agent-evaluate.js:815-821` (held), `:863-869` (CPU), `api/_utils/agentSwapExecution.js:248` (sale lock), `api/cron/agent-daily-scores.js:122-128` (with the comment at `:126`). Ratcheting comes from persisting and re-reading the running extremes each tick (`:906-908`, `:818`). **A threshold crossed and reversed inside a 15-minute window is invisible to agent-battle scoring.** The user-side V4 layer *does* thread extremes (`src/hooks/useBaggerBombBattleV4.js:368`; `api/cron/baggerbomb-v4-daily-scores.js:186-192`) — so the channel is live on one side and dark on the other. **This is a §9 display-agreement hazard for the redesign:** a "would have touched bagger" claim computed from OHLC will disagree with the points the battle actually banked.

**Finding — the scorer is pure, and can be run on any price series for any stock.**

```js
// src/utils/baggerBombUtils.js:535  (canonical)
export function calculateAssetScoreV3(asset, priceChange, history = {}, extremes = {}, thresholdPriceChange = null)
// api/_utils/agentScoring.js:224     (server port, same math)
export function calculateAssetScoreServer(asset, priceChange, history = {}, extremes = {}, thresholdPriceChange = null)
```

No database handle, no battle object, no network, no clock in `:535-627`; its only import is the zero-import constants file (`:4-8`). It is **already run server-side** — `api/cron/baggerbomb-v4-daily-scores.js:24` imports it into a Vercel function. Everything it needs about a sold stock is on the closed trade or its bench entry. **BUILD_RULES §4 makes this the sanctioned path** ("Never create a local copy of scoring math"; two production bugs came from copying it).

> **Correction to the prompt's premise:** `calculateAssetScoreV3` is **not** in `src/constants/baggerBombScoring.js`. That file is constants-only. The function is at `src/utils/baggerBombUtils.js:535`. *(Caught by subagent, re-verified by the lead.)*

**Document claim.** The prompt asks whether the scorer "could be run on a price series for a stock the battle no longer holds" — **CONFIRMED, unambiguously.** The prompt's implicit assumption that some post-sale price is retained — **REFUTED.**

---

#### B5 — Counterfactuals, proposed rules, forge suggestions

**Finding — `dailyReviews[].counterfactuals` has one writer and no live reader.** Computed in-request at `api/cron/agent-batch-review.js:208-231`, pushed at `:217-227` as `{proposalId, symbolIn, vetoPrice, closePrice, deltaPct, outcome, summary}`, embedded at `:325`, persisted at `:336`. Its input is vetoed proposals from today (`:190-192`), each needing a veto-time price captured upstream (`api/cron/agent-evaluate.js:3358-3372`). **It is suppressed entirely on a veto-only day** — the handler skips a battle with no trades and no evaluations (`:198-203`). **Readers: zero live.** The only consumer is `src/components/Agent/FilmRoomCard.ARCHIVED.jsx:163`, `:168`; the voice layer builds its own counterfactual block from proposal history instead (`api/_utils/voiceLayerPrompt.js:2146-2148`).

**Finding — a second counterfactual field is read by the prompt layer and has no writer anywhere.** `counterfactualPoints` is read at `api/_utils/voiceLayerPrompt.js:1600` and `:2137-2138`; a repo-wide grep finds **no production writer** — only those reads plus that file's tests. The points clause therefore always falls through to "no counterfactual recorded" (`:2139`). **Two parallel representations exist and neither reaches a surface.** *(Lead-verified by independent grep.)*

**Finding — `proposedRules` is still written, ungated, and inert.** It is a *required* field of the review tool schema (`api/cron/agent-batch-review.js:86`, shape `:92-104`), spread into the entry at `:320` and persisted at `:336`. **No feature flag gates it** — the file imports exactly one thing from the flag module (`:18`). It is rendered read-only at `src/components/FilmRoom/DaySummaryCard.jsx:167-200`, with accept/reject explicitly deferred (`:26-28`). **Written, displayed, wired to nothing.**

**Finding — `forgeSuggestions[]` is written by the auto-debrief with NO player turn.** `api/cron/agent-batch-review.js:439-449` builds the record; `:451-457` writes it via array-union onto the agent document. The whole path is cron-driven with a **synthetic turn**: `:382-387` calls the voice model with an empty history and the sentinel message `__REVIEW_START__`; the persisted exchange carries a null user message and an auto-debrief marker (`:143-157`). **The "only when the user explicitly asks" constraint is prompt prose with no code guard** (`api/_utils/voiceLayerPrompt.js:437`) — contrast the chat path, which *is* gated (`api/agent/chat.js:872-882`, `:1092-1093`). **Readers in `src/`: zero** (lead-verified grep). Attribution also diverges: the cron redirects to the parent agent (`:455-457`); the chat path does not (`api/agent/chat.js:1093`).

**Document claim.** The prompt asks whether the auto-debrief still writes forge suggestions "with or without a player turn" — **CONFIRMED: it writes them without one.**

---

### C. Mechanisms and armed state

#### C1 — Arming, firing, persistence, the freshness gate, and what it disarms

**Structural finding that governs the rest.** The six mechanisms do not share an arming window; they live in two layers at different points in the tick.

- **Layer 1 — risk manager** (`bust_avoidance`, `vwap_failure`, `stepped_trail`, `stagnation`): evaluated for every held symbol on **every** tick, in the loop at `api/cron/agent-evaluate.js:1333-1389`, which runs *before* the proposal gate (`:1805`), the gameplan gate (`:1818`) and the trigger gate (`:1926`).
- **Layer 2 — guardrails** (`guardrail_stopLoss`, `guardrail_trailingStop`): `applyGuardrails` has exactly two call sites — `:2205`, **downstream of the trigger gate's early return at `:1934-1951`**, and `:3624` inside the R11 suppression pass (hard-gated on `PROFIT_TARGET_EXECUTOR_ENABLED`, `:3610`). **On a tick where the trigger gate does not open, the stops are never evaluated at all.** The code says so at `:3586-3593`.

Hard preconditions on both: the quote-health gate returns early if any held symbol lacks a usable quote (`:733-741`; `api/_utils/agentQuoteHealth.js:23-29`, `:41-52`), and the cron early-returns when the market is closed (`:293-296`).

**The priority chain** (`api/_utils/agentRiskManager.js:115-195`) — a single `return` per tick, so **later mechanisms are masked by earlier ones**:

| # | Mechanism | Arming + firing predicate | `file:line` |
|---|---|---|---|
| 0 | input guard | needs current price, entry > 0, ATR > 0, else HOLD | `:116-118` |
| 1 | `bust_avoidance` | `atrMultiplier <= bustBuffer` (default `-0.85`) | `:128-134`; constant `:120` |
| 2 | `vwap_failure` | snapshot present **and** consecutive-tick count ≥ threshold (default 2) **and** *this* tick's deviation below the dead band | `:140-147`; constants `:121`, `:141` |
| 3 | `LOCK` | within 0.2× ATR below a bonus threshold `[1.0, 1.5, 2.0]` | `:150-162`; constants `:7-8` |
| 4 | `stepped_trail` | `atrMultiplier >= trailATR` (default 1.5) **and** 5-min SMA20 present **and** price below it | `:165-171`; constant `:122` |
| 5 | `stagnation` | rotation enabled **and** `withinAge` **and** tick count ≥ threshold **and** today's change below the winner threshold | `:181-193` |

Note the interaction: with a trail level of 1.5, the band `[1.3, 1.5)` returns `LOCK`, not `TRAIL_STOP`.

**Constants and their sources.**
- **Preset-driven** (`battle.strategyPreset` → `api/_utils/agentPresetConfig.js`, resolved `api/cron/agent-evaluate.js:684`, passed `:1377`): bust buffer `-0.90/-0.85/-0.75` (`:14`, `:35`, `:53`); VWAP failure ticks `3/2/1` (`:15`, `:36`, `:54`); VWAP dead band `0.7/0.5/0.3` (`:19`, `:37`, `:55`); trail ATR `1.5/1.5/1.0` (`:20`, `:38`, `:56`); unknown preset falls back to balanced (`:66`). **Archetype config deliberately carries no bust levers** — `api/_utils/agentArchetypeConfig.js:12-15` records the old block as removed and dead.
- **Archetype-locked** (forced rotation, `api/_utils/agentArchetypeConfig.js`): momentum_chaser `:49`, analyst `:80`, diversifier `:109`, contrarian `:136`, degen `:165`, **guardian disabled** `:199`; unknown archetype falls back to analyst (`:221-223`). Swap-window caps `:59`, `:90`, `:119`, `:146`, `:177`, `:209`. Hurdle floors `:54`, `:85`, `:114`, `:141`, `:172`, `:204`, each with bench-positive required.
- **Guardrail thresholds are user/agent config**, frozen on the battle document at deploy and read at `api/cron/agent-evaluate.js:2191`.
- **The tempo dial is live** (`src/config/featureFlags.js:723`): it divides the rotation tick threshold, floored at 1 (`api/_utils/tempoDialClamp.js:150-155`, applied `api/cron/agent-evaluate.js:1290-1298`), and its version binding holds (`api/_utils/tempoDialBands.js:32` = `api/_utils/agentArchetypeConfig.js:30`). It never touches `enabled`, the percent threshold, the winner threshold or the tick-age bound (`api/_utils/tempoDialClamp.js:37-40`).

**Guardrail predicates.** Stop-loss needs the guardrail present and numeric (`api/_utils/agentGuardrails.js:251-253`) and a computable P&L (`:686-705`); it fires on `pnl <= -|value|` with worst-breach selection (`:255-265`, `:728-751`). Trailing needs **no stop-loss breach this tick** (`:291`) and a **real implied peak** (`:712-723`) — so it is armed only once the position has actually been in profit (`:710`). Both then run one compose block: lock deference (`:452-466`), reinforcement of a model-proposed swap (`:468-496`), or a forced exit (`:502-508`, `:538-559`); secondary breaches are logged `pending_next_tick`, not exited (`:266-281`).

**Stagnation has two extra gates after detection** (which the code calls detection-only at `api/_utils/agentRiskManager.js:175-176`): a swap-window circuit breaker (`api/cron/agent-evaluate.js:1400-1421`; counter `api/_utils/agentRiskManager.js:513-543`) and the hurdle floor, where **returning no candidate *is* the veto** (`api/cron/agent-evaluate.js:1442-1458`).

---

**(c) Armed-state persistence — the answer the redesign needs.**

`finalizeCronState` writes **exactly eight keys** (`api/_utils/agentCronState.js:35-48`): last-evaluated timestamp, the evaluating lock, VWAP tick counts, intraday momentum, stagnation tick counts, last tick price, last tick timestamp, VWAP fire guard. **All are last-write-wins maps. There is no tick-indexed series anywhere in the document.**

The only durable per-symbol risk *verdict* is the tick stamp: `evidence[symbol].risk = { action, reason }` (`api/_utils/tickStamps.js:150-155`, `:198`), written only when the flag is on **and a prompt was built** (`api/cron/agent-evaluate.js:2805`) onto the evaluation entry (`:2830-2844`, cap 150 at `:2908`). Its field list is closed at eight entries (`api/_utils/tickStamps.js:87-89`) and contains **no tick counter, no 5-min SMA, no session change, no age flag**.

**Two further limits make even triggered ticks weaker than they look.** First, `evidence[symbol].risk` records the **winner of the whole priority chain**, not per-mechanism state — a stamped HOLD cannot distinguish "disarmed" from "armed but not triggered", and a LOCK or TRAIL masks whatever was armed below it (`api/_utils/agentRiskManager.js:98-104`). Second, **the stamped ATR multiple is not the risk manager's own**: the stamp takes the scorer's multiplier (`api/_utils/tickStamps.js:193`), computed against the previous close on day 2+ (`api/cron/agent-evaluate.js:809-813`; `api/_utils/agentScoring.js:259-262`), while the risk manager computes its multiple against the **entry price** (`api/_utils/agentRiskManager.js:124-125`). **A reviewer re-deriving the bust or trail predicate from the stamp would be using the wrong number.** *(Reported for separate tasking.)*

| Mechanism | Armed state persisted per symbol per tick? | Derivable post-hoc? | Disarmed by the stale-intraday gate? |
|---|---|---|---|
| `bust_avoidance` | **No** — no verdict among the eight keys (`agentCronState.js:36-47`); chain-winner only on triggered ticks (`tickStamps.js:150-155`) | **No** — needs a per-tick quote, never stored; the intraday map is last-write-wins (`agentCronState.js:39`); the bust buffer depends on a preset that is **never stamped** (`agent-evaluate.js:684`) | **No** — reads no intraday input (`agentRiskManager.js:127-134`) |
| `vwap_failure` | **Partially** — tick count (`agentCronState.js:38`), intraday map (`:39`), fire guard (`:47`), all overwritten each tick | **No for a past tick** — the counter conjunct is absent even from the stamp's closed field list (`tickStamps.js:87-89`). A *fire* leaves the exit snapshot (`buildTechnicalSnapshot.js:99-105`) | **Yes — doubly.** Predicate blocked (`agentRiskManager.js:140`) **and the counter is reset to 0, not paused** (`agent-evaluate.js:1344-1346`), then persisted |
| `stepped_trail` | **No** — the 5-min SMA lives only in the last-write-wins map (`agentCronState.js:39`); not a stamp field | **No** — the repo states the statelessness: `trailActivation: null, // NOT stored (stateless)`, `trailStepLevel: null, // NOT stored (not stepped)` (`learningSchemas.js:159-160`) | **Yes** — SMA presence fails (`agentRiskManager.js:165`); intent stated at `agent-evaluate.js:973-977` |
| `guardrail_stopLoss` | **Threshold yes, evaluation no** — the frozen guardrail array is durable (`agent-evaluate.js:2191`); outcomes only as guardrail overrides on **triggered** ticks (`:2771`); suppression-pass outcomes reach the feed only (`:3665-3669`) | **Partially, triggered ticks only** — `{type, symbol, threshold, actual, action}`, including lock-deferrals and pending secondaries (`agentGuardrails.js:271-279`, `:455-464`). On a quiet tick it was **never evaluated**, and nothing records that either | **No** — P&L uses entry and current price only (`agentGuardrails.js:700-705`). *Indirect:* see below |
| `guardrail_trailingStop` | **Peak input yes, evaluation no** — the running peak is written every tick (`agent-evaluate.js:908`; `agentScoring.js:298-301`) | **Partially** — the peak is a **monotone running max** (`agentScoring.js:278`), not invertible, so its value at 11:35 is unrecoverable; `highWaterMark: null, // NOT stored` (`learningSchemas.js:158`) | **No** — drawdown uses entry, current, peak and ATR (`agentGuardrails.js:712-726`) |
| `stagnation` | **Partially, and one input never** — tick count, last price and last timestamp persist (`agentCronState.js:42-44`); **the tick-age flag is explicitly never persisted** (`agentCronState.js:41`; `agentRiskManager.js:216-217`) | **No** — the age flag is unrecoverable by construction; today's percent change is not stored (the stamp's change figure is change-from-**entry**, `tickStamps.js:167-172`); the post-dial threshold is durable only on executed swaps (`swapProvenance.js:32-46`), dropped from the epoch log (`controlSuppressionTelemetry.js:156-168`) | **No by this gate** — but **yes by the separate 20-minute tick-age gate** (`agentRiskManager.js:249-254` → `:183`) |

**Bottom line: for none of the six can "was this armed at 11:35?" be answered from stored data alone.**

---

**(d) The intraday freshness gate — one gate, one call site.**

```js
// api/cron/agent-evaluate.js:978
if (vwapResult && isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount: sessionCandles.length })) {
  momentumData.vwap[symbol] = { ...vwapResult, sma20_5m, sessionDate };   // :980
}
// api/_utils/agentVwapFloor.js:36-38
export function isVwapSessionUsable({ sessionDate, todayET, sessionCandleCount }) {
  return sessionDate === todayET && sessionCandleCount >= MIN_SESSION_CANDLES;  // MIN = 3, :13
}
```

- **What it checks:** the 5-minute candle payload for each **held** symbol (fetched at `api/cron/agent-evaluate.js:947`), against two conditions — the latest session in the data is today's ET date, and that session has at least three candles.
- **It checks a calendar DATE, not an AGE.** The session date is the latest ET date *present in the candles* — the helper anchors on the data, not the clock (`api/_utils/marketDataCache.js:1058-1063`, `:1079`), and its `now` parameter is **declared reserved and unused** (`:1032-1034`, `:1040`). **A payload whose newest bar is 09:35 ET still passes at 15:55 ET, as long as it is today's 09:35.**
- **Clock:** two different ET derivations feed one equality — the today-side round-trips through `toLocaleString` (`api/_utils/marketSchedule.js:96-105`), the data side uses `Intl` with `America/New_York` (`api/_utils/marketDataCache.js:1000-1016`). They agree on a UTC host. Flagged, not asserted as a defect.
- **A second instance** of the same predicate guards the cascade-guard replacement (`api/_utils/agentVwapFloor.js:102-108`), on a fresh fetch, fail-closed (`api/cron/agent-evaluate.js:504-534`, `:526-528`).
- **Do not conflate** this with the 20-minute tick-age bound, which is the age of *our own previous tick* (`api/_utils/agentRiskManager.js:245-254`), not of market data. They disarm different mechanisms.

**(e) Exactly what disarms.** When the gate fails, **no intraday entry is written at all** (the assignment is inside the `if`), so the downstream snapshot is null (`api/cron/agent-evaluate.js:1337`, `:1366-1370`).

- **DISARMED (2 of 6):** `vwap_failure` — **doubly**: the predicate's first conjunct fails (`api/_utils/agentRiskManager.js:140`) **and the streak counter is actively zeroed rather than paused** (`api/cron/agent-evaluate.js:1344-1346`), then persisted — so a single stale tick mid-streak destroys the streak and recovery needs a full fresh run. `stepped_trail` — the SMA-presence conjunct fails (`api/_utils/agentRiskManager.js:165`); the intent is stated at `api/cron/agent-evaluate.js:973-977`.
- **STILL FIRE (4 of 6):** `bust_avoidance`, `stagnation`, `guardrail_stopLoss`, `guardrail_trailingStop` — none reads intraday data. `LOCK` also survives and keeps deferring guardrail exits.
- **One indirect effect, named rather than folded in:** the trigger gate's VWAP-deviation trigger requires the intraday entry (`api/_utils/agentTriggerGate.js:116-131`, `:180`), so a stale tick makes the gate **less likely to open** — which makes the two guardrails **less likely to be evaluated at all**. That is an availability effect, not a disarm.

**Flags (live values, `src/config/featureFlags.js`):** tempo dial `:723` true; profit-target executor `:1850` true; sector cap mode `:822` `'observe'`; tick stamps `:2238` true; archetype integrity `:770` `'enforce'`; shadow assembly `:1348` true; L1 capture `:1050` / `:1070` true; regime stamp `:1089` true. **No flag gates the risk manager itself** — it is called unconditionally (`api/cron/agent-evaluate.js:1372-1379`).

**Further ambiguities flagged.** "Stale" and "thin" are indistinguishable after the fact (the candle count is never persisted). `"stepped_trail"` is a **misnomer** — there is no step ladder and no trail state, corroborated by the schema's own comment. A regular-battle stagnation **veto** is indistinguishable from an empty bench in the feed — both emit the same pool-empty message (`api/cron/agent-evaluate.js:1488-1501`).

**Document claim.** The prompt asks whether armed state is "persisted or derivable from what is persisted" — **answered: neither, for any of the six.**

---

### D. What reaches the trading brain

> **Premise correction.** The prompt describes `agentEvalPromptAssembly.js` as "consumed by `api/agent/decide.js`". **It is not.** `decide.js` is the **deploy-time** path and imports `agentPromptAssembly.js` only (`api/agent/decide.js:15`). The **mid-battle** eval prompt is assembled by `agentEvalPromptAssembly.js` and consumed by `api/cron/agent-evaluate.js:2035-2041`. *(Caught by subagent, lead-verified.)*

#### D1 — Indicators into the battle eval prompt vs the voice layer

**Finding — held positions and bench candidates receive radically different data, and the asymmetry is the headline.**

**Reaches the eval prompt, HELD positions:** current price, gain from entry, ATR multiple, badges, ATR percent (`api/_utils/agentEvalPromptAssembly.js:1481`); lock-now, next-bonus distance and support/resistance levels (`:1483`, helpers `:1413`, `:1424-1432`, `:1437-1451`, gated on the live profit-target flag at `:1463`); session VWAP and deviation, Bollinger-width percentile with squeeze/expanded word, NR7 flag, daily range (`:1840`, `:1845`, `:1848`, `:1851`); market posture, per-stock regime, risk status, and the three macro benchmarks (`:1767`, `:1774`, `:1784-1806`, `:1136-1138`).

**Reaches the eval prompt, BENCH candidates only:** the entire technical stack — trend (`:1594-1601`), **RSI-14** (`:1611`), **MACD with fresh-cross flags** (`:1615-1619`), RSI divergence (`:1624`), **Bollinger %B** (`:1641`), ATR regime (`:1645`), volume tier and relative volume (`:1656`, `:1658`), **relative-strength percentiles** (`:1675`, `:1679`), levels (`:1692`, `:1700`), last candle pattern (`:1716`), composite score and rank (`:1722-1723`). The builder is bench-only by construction (`:1541`).

> **So: held positions get NO RSI, NO MACD, NO relative strength, NO trend, NO volume.** Lead-verified by grepping the held-position builder body (`:1458-1487`) for all five — zero hits. **A Film Room that shows "what the agent saw" must render two different card layouts, or it will imply the agent had RSI on a position it never had RSI for.**

**Reaches the voice/narration layer only:** ATR percentile (`api/_utils/voiceLayerPrompt.js:1184-1186`), distance to 52-week high (`:1227-1231`), 5-minute SMA20 deviation (`:1309-1318`), sector technical rank and total (`:1364-1365`, `:1153-1166`), up-day volume ratio (`api/cron/voice-layer-cache.js:254`, `:507`), SMA-stack and RSI-health prose (`:178-205`, `:241-242`), threshold-proximity / red-zone / swap-lock (`:353-388`), realized 1W–12M returns (`api/_utils/voiceLayerPrompt.js:2319-2323`), momentum score/rank/factors (`:2305-2306`, `:2330`), archetype scores (`:2328`).

**Finding — `compute-daily-baggerbomb-levels.js` does not touch the agent path at all.** It queries and writes the **`battles`** collection (`:288-291`, `:348-350`) and is read only by React components. The agent's levels come from `api/cron/compute-index-intelligence.js:1062-1064` → the rankings document (`:1372`).

**Finding — the eval system prompt asks for data the prompt never supplies.** Its playbook keys on "price above upper Bollinger band" (`api/_utils/agentEvalPromptAssembly.js:415`) and "MACD histogram no longer contracting" (`:420-421`); the upper/lower bands and the MACD histogram appear **nowhere** in that assembler. Two further strategies key on RSI-14, which held positions never receive. **A live prose-honesty gap in a fenced assembler — reported for separate tasking per BUILD_RULES §3, not fixed.**

**Finding — two better Film Room sources already exist.** (i) The per-swap technical snapshot captures things **no prompt ever renders**: MACD histogram, up-day volume ratio, Bollinger bands, average volume, distance to 52-week high, pivots, sector technical rank (`api/_utils/buildTechnicalSnapshot.js:52`, `:54`, `:59-60`, `:66`, `:77`, `:93`, `:109`). Under §9 these must be labelled "recorded at decision time", **never** "the agent saw this". (ii) The tick stamps write an eight-field evidence record per held position onto each evaluation entry, **each pinned to the rendered value by construction** (`api/_utils/tickStamps.js:164-179`, `:182-203`), plus data vintages (`:240-259`), live at `src/config/featureFlags.js:2238`. **This is the only structure guaranteed to equal what the model was shown.**

#### D2 — Watchlist fields per prompt; equip/unequip; freeze; off-universe

| Field | Deploy — Sonnet strategy | Deploy — Haiku portfolio | Mid-battle eval |
|---|---|---|---|
| Name | **Yes** `api/_utils/agentPromptAssembly.js:144` (sanitized `:140`) | no | **no** |
| Tickers | **Yes** `:146` (filtered `:137-138`) | **Yes** `:207` (filtered `:201-203`) | **indirect only** — they enter the hot bench (`api/cron/agent-evaluate.js:1025-1033`), become synthetic bench assets (`:1105-1118`), merge into the bench (`:1120-1127`) and render as ordinary bench rows (`api/_utils/agentEvalPromptAssembly.js:1168`) **with no marker that they are user-equipped** |
| Thesis | **Yes** `:141`, `:148` | no | **no** |
| "User equipped this" framing | **Yes** `:143`, `:149-159` | **Yes** `:205-211` | **no** |

Call sites: `api/agent/decide.js:439-447` (Sonnet), `:506-509` (Haiku). A grep of the eval assembler for watchlist/equipped/thesis returns only rule-precedence prose and the unrelated Vision thesis. **The mid-battle agent is structurally unaware a watchlist exists.** *Design implication:* at deploy the agent is told "the user personally equipped this, here is their thesis"; mid-battle that framing is gone. **If the Film Room narrates "your watchlist pick", it must be honest that mid-battle the agent had no idea it was yours.**

**Equip / unequip while a battle is active: both hard-blocked.** `api/agent/equip-watchlist.js:89` throws on an active battle → HTTP 409 (`:40`); `api/agent/unequip-watchlist.js:69` → 409 (`:33`). The check runs inside the transaction before any write. **The operation never succeeds, so it never affects the running battle.** Intent stated at `equip-watchlist.js:8-9`.

**Freeze in multi-day battles: frozen at deploy.** The watchlist document is read **once** (`api/agent/decide.js:353-373`), snapshotted as `{watchlistId, name, tickers}` (`api/_utils/watchlistEquip.js:170-176` — **thesis deliberately not snapshotted**), and stamped onto the battle (`api/_utils/agentBattleService.js:198-200`, with the intent written out at `:194-197`). **Every mid-battle refresh reads the snapshot** (`api/cron/agent-evaluate.js:1022`); no re-read of the watchlist document exists in the cron. What *is* re-derived each rebuild is the candidate pool **around** the frozen tickers — rebuilds fire on a new trading day **or** whenever the rankings document is fresher than the last rebuild, i.e. intraday too (`:169-171`), then the frozen tickers are re-admitted under a soft cap they always survive (`:1025-1033`; `api/_utils/watchlistEquip.js:140-157`). **Membership frozen; ranking data refreshed.**

**Off-universe swap-in: blocked.** `api/_utils/agentSwapExecution.js:44-48` requires the incoming symbol to be in the bench or the hot bench; both are closed sets derived from the rankings document plus the frozen tickers. Same-path constraints: conviction floor 70 (`:79-81`), self-swap and duplicate-slot bans (`:51-56`), 24-hour cooldown (`:58-64`), type match (`:67-75`); tournament mode narrows further (`api/cron/agent-evaluate.js:1013-1015`, `:1030`, `:1108`).

> **Latent defect found in passing — reported, not fixed.** An **off-universe equipped ticker** (in the frozen snapshot, absent from the rankings) lands in the hot bench but gets **no synthetic bench asset**, because that loop iterates the rankings array (`api/cron/agent-evaluate.js:1093`). It therefore passes validation via the hot-bench branch (`api/_utils/agentSwapExecution.js:45`) but resolves to null at the swap site (`api/cron/agent-evaluate.js:3107-3113`, `:2342`) and is dereferenced unguarded in the executor (`api/_utils/agentSwapExecution.js:167`) — a TypeError inside the Firestore transaction. **Practically unreachable at HEAD** because such a ticker never appears in the bench block the model reads (`api/_utils/agentEvalPromptAssembly.js:1489-1517`), so the model cannot name it. Severity: latent. The unreachability half is **ASSUMED by reading**, not executed.

#### D3 — Anticipation entries

**Finding — hybrid, and the condition half is free text.** Schema at `api/_utils/agentEvalToolSchema.js:157-192`:

| Field | Structured? | `file:line` |
|---|---|---|
| `symbol` | **structured** (ticker string) | `:165-168` |
| `direction` | **structured — a real enum** (`potential_entry` / `potential_exit`) | `:169-173` |
| `signalSummary` | free text | `:174-177` |
| **`threshold`** | **FREE-TEXT ENGLISH SENTENCE** — *"If it holds above the 20-day on the next test, I would rotate it into Core."* | `:178-181` |
| `rationale` | free text, optional | `:182-185` |
| `signalSource` | free-text tag (suggested values, **not** an enum) | `:186-189` |

Required: symbol, direction, summary, threshold (`:163`). **There is no operator, no numeric value, and no expiry field anywhere.** The prompt-side "must be specific" instruction (`api/_utils/agentEvalPromptAssembly.js:499`) is prose enforced by nothing. **Nothing in the codebase parses, evaluates, or closes the loop on a threshold — so a Film Room "did the anticipation pay off?" feature is not computable at HEAD** without NL parsing or a schema change.

**Finding — one writer module, two paths, and the live one is the fragile one.** Both are in `api/_utils/voiceLayerAnticipation.js`: the model path (`:338-368`, **LIVE**) persists `{symbol, direction, threshold, evaluationId}`; the grounded path (`:104-128`, **DARK**) **drops the threshold** and substitutes a time slot (`:118-125`). Grounding mode is `'shadow'` at `src/config/featureFlags.js:2137`, and the resolver never returns `'on'` for any user under that setting (`:2166-2172`, `:2188-2193`), so both gates fail (`voiceLayerAnticipation.js:187-188`, `:260`) and **the model path is what production writes.**

> **Highest-risk coupling in the feature.** A Film Room built against the grounded shape renders nothing today; built against the threshold it works today and **breaks the day grounding flips to `'on'`.**

**Finding — a third, better source already exists.** The tick stamp writes `[{symbol, direction, signalSummary, threshold, signalSource?}]` onto the evaluation entry (`api/_utils/tickStamps.js:275-289`, spread at `api/cron/agent-evaluate.js:2833`), live at `src/config/featureFlags.js:2238`. It is **grounding-mode-independent**, survives both paths, keeps both the summary and the threshold, and is keyed to the evaluation. By contrast the chat record only tells you which candidates got *narrated*, and narration is budget-gated (skipped under 12 s of remaining cron budget, `api/cron/agent-evaluate.js:3059`, `:3080-3090`).

**Finding — the producer is LLM tool-output parsing, and only that.** The model emits candidates via its decision tool (schema `:157-192`, guidance `api/_utils/agentEvalPromptAssembly.js:484-505`, `:687-708`); the cron queues any candidate with a truthy symbol (`api/cron/agent-evaluate.js:2162-2166`) on hold, swap and proposal paths alike (`:2154-2158`), stamps it (`:2833`), and dispatches narration (`:3058-3078`). **No player form. No cron-authored entries. No other model.**

**Finding — the existing Film Room reader throws the structure away.** `src/components/FilmRoom/AnticipationLogSection.jsx:13-15` filters by type and day and renders **only the prose** (`:70`) and a timestamp (`:72-76`). It reads none of the structured context — so symbol, direction and threshold are persisted and discarded at render. Precedent for surfacing them exists at `src/components/Agent/deriveChatMessages.js:89-92`.

**Document claim.** The prompt asks whether anticipation entries are "free text only or carry structured condition fields" — **answered precisely: two of six fields are structured, the condition itself is not.**

---

### E. Intraday data and computation budget

#### E1 — 5-minute candles

**Finding — one fetcher, two call sites, active portfolio only.**

```js
// api/_utils/marketDataCache.js:792
export async function fetchIntradayCandles(symbol, options = {})
// :799
let url = `${API_BASE}/intraday/${eohdSymbol}?api_token=${apiKey}&fmt=json&interval=${interval}`;
```
`API_BASE` at `:27`; interval defaults to `'5m'` at `:793`; an optional window is appended **only** if a lookback is passed (`:800-804`). Batch wrapper at `:883`. Call sites: `api/cron/agent-evaluate.js:947` (`fetchIntradayBatch(portfolioSymbols, { interval: '5m' })`) and `:510` (single-symbol cascade qualification).

| Cohort | Gets 5-minute candles? |
|---|---|
| Active portfolio | **Yes**, every 15 minutes during the window (`api/cron/agent-evaluate.js:947` ← `:687-688`) |
| Bench stocks | **No** — the bench symbol list (`:693`) is used for the technical-score document reads (`:943-944`), never for intraday |
| **Sold stocks** | **No** — once out of the portfolio they are absent from the held-symbol list |
| Index ETFs (SPY/QQQ) | **No intraday** — they are in the macro set (`:694`, `:699`) which drives daily + spot price only (`:707-710`) |
| Sector ETFs | **No** |

*(Corroborated in prose by a second consumer: `api/cron/voice-layer-cache.js:393-395`.)*

**Finding — the fetcher is fully generic over symbol; sold stocks, bench and ETFs need a new caller, not new code.** It takes a bare string and carries no battle state (`:792`). Symbol handling is three pure helpers (`:76`, `:82`, `:86`) — a sold stock, a sector ETF and an index format identically. **It is not cached**: unlike the daily path, it calls `fetch` directly at `:807`, so every call is live.

| Constraint | Value | `file:line` |
|---|---|---|
| Symbol-count cap | **None** | `api/_utils/marketDataCache.js:887-888` |
| Concurrency | **5** | `:884` |
| Inter-batch pacing | **200 ms** | `:906-909` |
| Failure isolation | per-symbol; a rejection yields an empty array | `:894-902` |
| Retry / 429 handling | **None** | grep returns only pacing comments |
| Multi-symbol batching in one URL | **Not supported** — one GET per symbol | `:799` |

*Cost shape:* a 6-held + 6-sold + 1 sector ETF + 1 index replay is 14 symbols ≈ 3 waves ≈ ~600 ms of pacing plus round-trips.

**Finding — how many prior sessions one request returns is NOT determined by code.** Production passes no window; the docstring says why (`:787-790`), and a regression test pins it (`api/_utils/marketDataCache.test.js:75-93`). **The window size is the provider's server-side default and is nowhere expressed in this repo.** In-repo measurements (**DOC, not HEAD behaviour**): a default-window request returned **6,478 candles = 82 sessions × 79 bars** in May 2026 (`discovery/eodhd-session-boundary-analysis.md:12`, `:25-30`); explicit windows are capped at **600 calendar days** with an HTTP 422 beyond (`docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md:21`, `:290-294`; encoded at `research/level-study/config.js:118` — a study harness, not product code). **Counter-evidence worth re-testing:** windowed requests are reported to have returned empty in operator testing (`CALIBRATION_DATA_DISCOVERY_REPORT.md:145`). **Do not design around a tight window without probing it** — see §4.

**Finding — extended-hours bars are neither requested nor filtered at fetch time.** No such parameter is sent (`:799`); the fetcher's only two filters drop non-finite bars (`:828-834`) and the synthetic close print (`:851-857`). The regular-hours clamp is a **separate, opt-in** function (`:1040`, constants `:963-966`, applied `:1067-1077`). **Asymmetry that matters for a replay:** the VWAP calculation receives session-filtered candles but the 5-minute SMA receives the **unfiltered** array, deliberately (`api/cron/agent-evaluate.js:971` vs `:979`, comment `:957-963`). In-repo probes report zero non-RTH bars in the default response (**DOC**: `discovery/eodhd-session-boundary-analysis.md:18`; `docs/discovery/SESSION1_DATA_DISCOVERY_REPORT.md:164`) — but the boundary document itself calls the clamp "belt-and-suspenders," i.e. nobody proved the endpoint cannot emit them. **Open question requiring a probe.**

**Post-close retrievability cannot be read from code.** The probe is written out in §4.

#### E2 — Sector and index series

**Finding — a sector-to-ETF mapping exists, in two copies, with the server-side one authoritative.** `api/_utils/rankingConfig.js:15-90` defines 11 GICS sectors keyed by sector-SPDR ticker (239 tickers); `:362` derives the ETF list; `:367-379` adds industry ETFs; **`TICKER_TO_SECTOR` at `:430`, populated `:440-456`, maps a stock straight to its sector ETF ticker.** The client copy is `src/constants/sectors.js:4+`, and the server file's header (`:7-8`) flags the duplication.

> **Gap for the redesign.** The mapping is ticker → sector id. **There is no reverse name → ETF helper** (greps for the obvious names return only a test fixture). This matters because the sector string stored on a battle asset is a **free-text name**, not a ticker (`api/agent/decide.js:772-773`, stamped `api/_utils/agentBattleService.js:399-403`), and that name can come from the fundamentals provider, producing strings like "Consumer Cyclical" / "Financial Services" that do **not** match the internal names ("Consumer Discretionary" / "Financials"). **Key off `TICKER_TO_SECTOR[symbol]`, not off the stored sector string.**

**Finding — no sector or index intraday series is stored anywhere; sector ETF closes are in-memory only.**

| Thing | Stored? | Evidence |
|---|---|---|
| Sector ETF close series | **No — in-memory only** | built `api/cron/compute-index-intelligence.js:769`, filled `:783`, consumed `:935-937`, discarded on return |
| Sector derived snapshot (3 scalars/sector) | **Yes** | built `:791-799`, written `:1183-1206` |
| Index derived technicals (scalars, no series) | **Yes** | write loop `:1174-1181`; payload shape `:446-469` |
| SPY / QQQ **daily** OHLCV series | **Yes — incidentally**, in the market-data cache | macro set `api/cron/agent-evaluate.js:694` → `:699` → `:709`; doc key `api/_utils/marketDataCache.js:618`, write `:187`; 90-day window `:257`, 4-hour TTL `:31` |
| Sector ETFs in that cache | Only if held — they are excluded from the rankings universe | `api/_utils/rankingConfig.js:355-359` |
| **Any intraday series, any symbol** | **No** | `fetchIntradayCandles` (`:792-873`) has no cache read or write; only derived scalars persist (`api/cron/agent-evaluate.js:979-980`) |

**Finding — sector relative strength is computed in one place, from daily bars only.** Orchestration at `api/cron/compute-index-intelligence.js:929-950`: per stock, look up the sector (`:934`), require ≥22 ETF closes (`:935`), compute RS against the **sector ETF** (`:937`), then percentile-rank within the sector (`:945-950`).

> **Citation correction.** A subagent placed the RS function at `api/_utils/indexIntelligence.js:396-410`. **That is wrong** — `:398` is `computeTechnicalScore`. The lead re-opened the file: **`computeRS` is at `api/_utils/indexIntelligence.js:185-199`** (`computeRSTrend` at `:208`). The math is `((ratioToday − ratioPeriodAgo) / ratioPeriodAgo) × 100` (`:191-193`), generic over benchmark. The sector percentile feeds `computeTechnicalScore` (param `:407`, fallback to the market percentile `:416`, echoed `:525`) and is persisted per symbol (`api/cron/compute-index-intelligence.js:1212-1214`, re-read `:1299`). **Inputs are daily bars** (`:763-765`) — nothing here touches 5-minute data.

*(Do not confuse this with the client-side breadth service's differently-defined "relative strength" at `src/services/breadthIndicatorService.js:205-268`.)*

#### E3 — Batch review cron and the cron budget

**Finding — the batch-review cron has the tightest budget of any post-close cron.**

| Knob | Value | `file:line` |
|---|---|---|
| Schedule | `25 20,21 * * 1-5` → 4:25 PM and 5:25 PM ET (EDT) | `vercel.json:196-199`; DST rationale `api/cron/agent-batch-review.js:3-8` |
| Function ceiling | **`maxDuration: 60`** | `api/cron/agent-batch-review.js:63` |
| Soft deadline | **45 s**, "one review can cost ~30 s" | `:69`, rationale `:65-68`, enforced `:525`, `:527-530` |
| Model call timeouts | 15 s each (review + debrief) | `:301-304`, `:379` |
| Queue cap | **5** | `:41`, `:47` |
| Active-battle cap | **None** — an unbounded query | `:486`; `api/_utils/agentBattleService.js:43-50` |

**Per battle** it resolves the day, dedupes against existing reviews, filters the day's trades/evaluations/vetoes/debates, **fetches one spot price per vetoed proposal serially** (`:210-234`), calls the review model, writes one Firestore update, then runs a non-fatal debrief. **At ~30 s per battle inside a 45 s soft deadline, it completes roughly 1-2 battles per firing.** A candle-fetching replay does not fit here without raising the ceiling. For comparison: the evaluate cron, orchestrator, index intelligence and mandate crons all run at 300 s; **`agent-daily-scores` declares no ceiling at all** (lead-verified: zero occurrences in that file), so it inherits the platform default and must be measured before being loaded.

**Finding — the cron array holds exactly 39 entries**, matching BUILD_RULES §6's "39/40 … one slot remains." Lead-verified two ways (JSON parse and the array bounds at `vercel.json:43` … `:200`). The full table of 39 paths and schedules is in the subagent record; the entries relevant here are listed under E1/E3 above. Two structural notes: **a query-parameter variant costs a full slot** (proved by the pulse/econ/column/intelligence pairs), so "riding an existing cron" means **branching inside a handler that already fires**; and `api/cron/` holds 21 non-test handlers, of which the two season handlers have no entry — consistent with §6.

**Finding — a second, later pass can ride an existing cron, and the repo has two named precedents.**

1. **`api/cron/process-pending-reflections.js`** hosts two duties unrelated to its own: a wire sweep at `:103-123` (flag-gated `:110`, with a remaining-budget floor `:111-112`, isolating try/catch `:120-122`) and a weekly editorial review at `:125-152` (day-gated `:137`, budget-floored `:140`). It documents the trap at `:56-59`: **no early return on an empty primary queue**, or the rider becomes dead code.
2. **`api/_utils/tournamentOrchestrator.js:1091-1131`** hangs three sweeps off the tick's duty routing, each commented **"Zero new cron."**

| Host | Window (ET, EDT) | Budget | Seam | Fit |
|---|---|---|---|---|
| `api/cron/agent-daily-scores.js` | **8:45 PM**, prior weekday | **none declared** — must be measured | handler `:208`; trading-day gate `:219-226`; already queries active battles `:230` and already loops per-symbol market data `:242-266` | ★★★ latest slot, already battle-shaped and already fetching |
| `api/cron/process-pending-reflections.js` | through 8 PM and past midnight, incl. weekends | 60 s / 50 s soft | the documented rider slots at `:103`, `:125` | ★★★ best for a flag-gated, budget-floored pass that drains across runs |
| `api/cron/tournament-orchestrator.js` | 5-7 PM, every 10 min | **300 s** (`:28`) | `runOrchestratorTick` (`api/_utils/tournamentOrchestrator.js:1067-1131`) | ★★★ best budget; tournament-scoped by design |
| `api/cron/agent-batch-review.js` | 4:25 / 5:25 PM | 60 s / 45 s | the per-battle loop `:526-545` | ★★ semantically perfect, budget too tight as-is |
| `api/cron/agent-evaluate.js` | last ticks 5:00-5:45 PM | 300 s (`:135`) | already the sole owner of the intraday batch (`:947`) | ★ natural home, but the most fence-adjacent handler in the repo — **founder scrutiny before touching** |

**The four ingredients both precedents share:** a flag gate read at call time; a time/day gate (for a post-close pass, an ET-hour guard using `Intl` per BUILD_RULES §6 — the helper at `api/_utils/marketDataCache.js:1000` is already exported); a remaining-budget floor so the rider can never starve the host; and an isolating try/catch plus a queue flag so unfinished work drains across runs (the pattern at `api/cron/agent-batch-review.js:41-51`).

**Two constraints to carry forward.** Crons do not run on Vercel preview (BUILD_RULES §6) — verification is unit tests on the guard plus the first production run. And on the founder's own budget, **a rider is preferable to spending the last slot.**

---

### F. Surfaces and hygiene

#### F1 — Routing, render, and the review chat

**Finding — nothing auto-routes on completion; there are three manual entry points.** All converge on the same two-line navigation.
1. **In-battle banner** — `src/App.jsx:9446` → `src/screens/BattleViewScreen.jsx:43-51` → `src/screens/AgentBattleScreen.jsx:514`. **Its gate is a filed daily review, not completion**: `:2292` requires `dailyReviews.length >= 1`; status only swaps the copy (`src/components/FilmRoom/FilmRoomBanner.jsx:9`, `:49-53`). **So on a multi-day battle the Film Room is reachable from day 2 while the battle is still live.**
2. **Battle history "Review →"** — `src/App.jsx:9734` → `src/screens/BattleHistoryScreen.jsx:322-338`; data from `src/App.jsx:4795-4830` (completed only).
3. **Command Dashboard Review station** — `src/components/Dashboard/CommandDashboard.jsx:284`, `:595` (desktop `:192`, `:331`).

The route itself is `src/App.jsx:9465-9476`, inside an error boundary (`:9468`). **The passed battle object is used only for its ID** (`src/screens/FilmRoomScreen.jsx:35`); the screen re-subscribes to the live document (`:36`; `src/hooks/useAgentBattle.js:26-44`), which returns the **raw, unsanitized** document — so nothing is being withheld from the Film Room by a view layer.

**Finding — the League recap and the solo Film Room share only a name.** Solo is a full screen (`src/screens/FilmRoomScreen.jsx:33`) over the agent-battle document; League is an **overlay** (`src/components/League/battleArena/ArenaOverlays.jsx:279`) rendering `FilmRoomRecap.jsx:71` over a composite climb history (`src/components/League/LeagueRecapEntry.jsx:27-30`, `:65-68`), entered from `src/screens/LeagueParticipantView.jsx:210-212` and the arena (`ArenaDesktop.jsx:126`, `ArenaMobile.jsx:220`). **No shared component, no shared data source.** *(Naming trap: `src/components/League/LeagueSpectate.jsx:71` declares a third, unrelated local `FilmRoom`.)*

**Per-component render inventory** (mount order at `src/screens/FilmRoomScreen.jsx:112-195`):

| Component | Reads | Displays | `file:line` |
|---|---|---|---|
| `FilmRoomHeader` | trading-day count | back, title, `· N days`, wraps the picker | `FilmRoomHeader.jsx:4`, `:52-56`, `:62` |
| `DayPicker` | trading days; reviewed days | one pill per day, amber dot when reviewed. **Returns null for a single-day battle** | `DayPicker.jsx:4`, `:6-10`, `:21-31` |
| `ScoreSummaryCard` | banked badge points; day-filtered trade points | Total / Trades / Badges | `ScoreSummaryCard.jsx:11`, `:38-66` |
| `AutoDebriefHero` | auto-debrief chat exchanges for the day | amber post-market debrief with clickable tickers | `AutoDebriefHero.jsx:13-19`, `:91`, `:103-106` |
| `DaySummaryCard` | the day's review: grade, date, summary, rationale, lesson, proposed rules | grade badge, prose, lesson block, **read-only** rules list | `DaySummaryCard.jsx:50-51`, `:106-117`, `:133-165`, `:167-209` |
| `TrainingReportCard` | mastery award fields | **Nothing at HEAD** — returns null on the dark flag | `TrainingReportCard.jsx:44-48` |
| `TradeHistorySection` | day-filtered trades | tier chip, `out → in`, a percentage, entry/exit/points/time | `TradeHistorySection.jsx:29-50`, `:81-138`, `:163-172` |
| `AnticipationLogSection` | anticipation exchanges for the day | prose + timestamp **only** | `AnticipationLogSection.jsx:13-15`, `:70-76` |
| `FilmRoomChat` | review-mode exchanges; review budget | chat with an `N/5` counter, disabled at 5 | `FilmRoomChat.jsx:10`, `:145-175`, `:353-357` |

**Finding — a trade row shows the SOLD stock's numbers, exclusively.**

| Element | Source | Belongs to | `file:line` |
|---|---|---|---|
| Tier chip | `trade.tier` | **sold** stock's slot | `:29-30`, `:81` |
| Left ticker | `trade.symbolOut` | **SOLD** | `:102` |
| Right ticker | `trade.symbolIn` | **BOUGHT** | `:124` |
| **The percentage** | `(exitPrice − entryPrice) / entryPrice` | **SOLD** | `:32-35`, `:137-138` |
| `Entry $X` | `trade.entryPrice` | **SOLD** | `:163` |
| `Exit $Y` | `trade.exitPrice` | **SOLD** | `:164` |
| `Banked Z pts` | `trade.lockedPoints` | **SOLD** | `:165-167` |
| Timestamp | `trade.swappedOutAt` | the swap event | `:168-172` |
| Reason badge (dark) | `exitReason` / `swapMotive` | the decision | `:48-50`, `:150-162` |

**The bought stock contributes exactly one thing: its ticker string.** This is true by construction in the executor — every scored and recorded quantity is keyed on the outgoing symbol (`api/_utils/agentSwapExecution.js:166-167`, `:191-194`, `:206-216`, `:242`, `:248-251`, `:255-273`); even the name and crypto flag are the outgoing asset's (`:258`, `:267`).

> **Consequence for the redesign:** a trade row **cannot** answer "was this swap a good idea?" The incoming asset's basis is written to the **portfolio slot**, not the trade (`api/_utils/agentSwapExecution.js:281-289`). A true swap verdict needs a join from trades to the portfolio on the incoming symbol — **that join does not exist anywhere in `src/` today.**

**Flags and archived files.** `SWAP_MOTIVE_DISPLAY_ENABLED` is **false** (`src/config/featureFlags.js:1519`) and gates only the row's reason badge. `MASTERY_SURFACE_ENABLED` is **false** and lives at **`api/_utils/masteryConfig.js:117`, not in the flag module** — note `src/components/FilmRoom/TrainingReportCard.jsx:22` imports it from `api/`, the reverse of the §4 direction; the file claims this is sanctioned as a browser-clean constants leaf (`masteryConfig.js:114-116`). *(Reported as-is; not adjudicated. Worth checking whether it is registered in the §2 flag-pin guard's source modules.)* The other eight Film Room components carry **no flag gate**. **All 18 `*.ARCHIVED.jsx` files are dead** — zero non-archived importers; the only textual reference is a comment confirming it (`src/data/decisionRecord.js:827`). `AgentFilmRoom.ARCHIVED.jsx` and `FilmRoomCard.ARCHIVED.jsx` are **not** the live Film Room.

**Finding — the review chat is structurally ungrounded at every flag value.**
- Endpoint `POST /api/agent/chat` with `mode: 'review'` (`src/components/FilmRoom/FilmRoomChat.jsx:276`, `:282`); budget 5, enforced server-side (`api/agent/chat.js:370`, `:509-514`); model is the voice model with a 19 s timeout (`:100`, `:759`).
- **`const grounded = groundingMode === 'on' && mode === 'battle';`** — `api/agent/chat.js:476`, and the client's review mode is honoured verbatim (`:465-466`). **So grounding is always false for the Film Room, at every value of the mode constant.** Shadow assembly is likewise battle-only (`:483`), so **a Film Room turn produces no grounding record at all.** The intent is stated at `:473-474`.
- Context sent: agent, battle, elicitation target, last 10 exchanges (research excluded, agent-initiated dropped — `:660-672`), anchor context (`:592`), market snapshot (`:595`), daily reviews and grades — but **the capabilities manifest is null in review mode** (`:558`).
- Where grounding *does* touch this lane is the cron: the auto-debrief exchange is stamped with a grounding version only when the mode resolves to `'on'` (`api/cron/agent-batch-review.js:156`), which at the live `'shadow'` setting means **the key is absent** — pinned by `api/cron/agent-batch-review.grounding.test.js:44-48`. **That exchange is exactly what the debrief hero renders.**

#### F2 — The settings fingerprint

**Finding — one hash function, one producer, one persist site — and a real drift at the call site.**

| Stage | `file:line` |
|---|---|
| Hash | `api/_utils/canonicalHash.js:42-45` (SHA-256 over a stable stringify) |
| Serializer | `:20-34` — recursively sorted keys, array order preserved |
| Input assembly (7 axes) | `api/_utils/resolvedAgentManifest.js:129-139` |
| Hash computation | `:165` |
| Persist (create-only) | `api/_utils/agentBattleService.js:236-245`, gated on `MANIFEST_WRITE_ENABLED` |
| Caller A — tiered | `api/agent/decide.js:912-927`, passing the resolved watchlist snapshot at **`:919`** |
| Caller B — tournament | `api/agent/decide.js:1458-1479`, passing **hardcoded `null`** at **`:1464`** |

**Both callers reach the same function.** There is no second implementation, no differing key order, no differing serializer, and no backfill — the field is create-only by construction (`api/_utils/resolvedAgentManifest.js:9-12`).

**The drift is caller-supplied.** Six of the seven axes are identical between the two paths. The seventh — the equipped watchlist — is a real snapshot on the tiered path (resolved by an actual document read, `api/agent/decide.js:353-374`, shaped `api/_utils/watchlistEquip.js:170-176`) and **hardcoded `null` on the tournament path**. **The same agent, with the same equipped configuration, therefore produces two different fingerprints depending on game mode.**

The repo's own tests make the contradiction visible without catching it: `api/_utils/resolvedAgentManifest.test.js:212-216` pins that game mode does **not** move the hash (true of the *builder argument*), while `:239` pins that a null watchlist **does**. At the call site, game mode **determines** the watchlist — so it moves the hash **indirectly, through a channel the unit test never exercises.**

**What it breaks, and why silently.** There are **zero production readers**. The field exists to serve one query — the composite index at `firestore.indexes.json:296-303`, round-tripped by `test/rules/equippedConfigHashQuery.rules.mjs:93`, `:128` (whose own header at `:9-16` admits the emulator does not prove the production index exists). So a "battles fought under configuration X" query splits one agent's tiered and tournament battles into two buckets even when nothing about the agent changed, **returning fewer rows and never an error.** Nothing reads the field back, so no assertion anywhere can catch it.

**Ambiguity flagged rather than guessed.** Whether `decide.js:1464` is intentional cannot be determined from HEAD: there is **no comment** on it, in pointed contrast to the adjacent line (`:1463`), which cites a founder ruling. **The founder should rule on what the field is meant to mean** — *"the configuration the user has equipped"* (in which case the tournament path is wrong) or *"the configuration that governed this battle"* (in which case it is right, but the game-mode-indifference test is misleading about the field's real behaviour). `decide.js` is fenced; it was read, not touched.

**Flag hygiene note.** `MANIFEST_WRITE_ENABLED` is **`true`** (`src/config/featureFlags.js:1326`), but its docstring at `:1313` still calls FALSE the default and `:1316` describes TRUE as "preview smoke only". The test pins were reconciled at the flip; **the docstring was not** — a BUILD_RULES §2 flip-reconciliation miss. Reported, not fixed.

#### F3 — Industry / group data layer

**Finding — `INDUSTRY_LAYER_SPEC_V1.md` is FULLY IMPLEMENTED, both phases. It is not spec-only. And none of it reaches the Film Room.**

- **Taxonomy** (pre-existing, reused read-only): `api/_utils/rankingConfig.js:92`, `:367`, `:439-454`.
- **Phase 1 — industry as a screenable dimension:** cron stamp `api/cron/compute-index-intelligence.js:50`, `:1328-1329` (and independently `api/cron/compute-rankings.js:21`, `:1612`); screening engine `api/_utils/screenStocks.js:30`, `:65`, `:226-234`, `:487-488`; prompt vocabulary `api/_utils/voiceLayerPrompt.js:2375`.
- **Phase 2 — industry rollup:** minimum group size and metric list `api/cron/compute-index-intelligence.js:478`, `:518`; builder `:526-546` with both gates (`:537`, `:541`); called `:1465`, written `:1472`; rollup screener `api/_utils/screenStocks.js:535`; chat wiring `api/screener/chat.js:103`, `:294`, `:296`; UI `src/components/Search/IndustryRow.jsx:46`, `ScreenerView.jsx:26`, `:802-805`, `screenerAdapter.js:107`, `:130`; prompt rules `voiceLayerPrompt.js:2340-2342`, `:2372`.
- **Absent:** `peerGroup`, `subSector`, `subIndustry` — **zero non-test hits** across `src/` and `api/`.
- **Reach into the Film Room: none.** The full consumer list contains no file under `src/components/FilmRoom/`. The layer lives in the Screener/Research surface plus two tournament free-agent components.
- **The single agent-side touch is a prompt label, not a data layer:** a sector/industry parenthetical spliced into the eval prompt (`api/_utils/fundamentalsRender.js:114-116` → `api/_utils/agentEvalPromptAssembly.js:1179-1183`), behind a live flag (`src/config/featureFlags.js:1554`).
- *Do not confuse* the per-ticker fundamentals collection written at `api/cron/compute-rankings.js:1327` with a peer-group aggregate; it is per-ticker, consumed as a lazy read.

---

## 4. Data queries and live probes for the founder

**None of these were run.** Per rule 3 of the prompt, no production Firestore query and no external API call was made in this session. Each is written to be run as-is.

### Query 1 — Confirm the Sep 14 battle's arithmetic (read-only Firestore)

Run in the Firebase console, or with the admin SDK against production. **Reads only.**

```js
// Node, firebase-admin already initialised.
// Replace BATTLE_ID with the Sep 14 BaggerBomb battle's document id.
const snap = await db.collection('agentBattles').doc('BATTLE_ID').get();
const b = snap.data();

const dayN = 1; // the battle's trading day under inspection
const dayTrades = (b.trades || []).filter(t =>
  typeof t.swapDay === 'number' ? t.swapDay === dayN : true);

console.log(JSON.stringify({
  status:            b.status,
  completedAt:       b.completedAt,
  expiresAt:         b.expiresAt,
  tradingDays:       b.timing?.tradingDays,
  // --- what the Command Center and the day summary read ---
  currentScore:      b.scoreState?.currentScore,
  activeScore:       b.scoreState?.activeScore,
  bankedScore:       b.scoreState?.bankedScore,
  bankedBadgeTotal:  b.scoreState?.bankedBadgePoints?.total,
  opponentScore:     b.scoreState?.opponentScore,
  // --- what the Film Room reads ---
  dailyScoresKeys:   Object.keys(b.scoreState?.dailyScores || {}),
  dayEntry:          b.scoreState?.dailyScores?.[`day${dayN}`] ?? null,   // expect: MISSING on the final day
  dayBadgePoints:    b.scoreState?.dailyScores?.[`day${dayN}`]?.badgePoints ?? 0,
  dayTradePoints:    dayTrades.reduce((s, t) => s + (t.lockedPoints || 0), 0),
  filmRoomTotal:     (b.scoreState?.dailyScores?.[`day${dayN}`]?.badgePoints ?? 0)
                     + dayTrades.reduce((s, t) => s + (t.lockedPoints || 0), 0),
  // --- the gap ---
  heldPositionTerm:  b.scoreState?.activeScore,   // the term the Film Room omits entirely
  portfolioHasCrypto: ['star','core','support'].some(t =>
                        (b.portfolio?.[t] || []).some(a => a?.isCrypto === true)),
}, null, 2));
```

**How to read it.** `filmRoomTotal` should reproduce the −176 the founder saw. `currentScore` should reproduce the +125. `dayEntry` being **null/absent** confirms the final-day hole (§3-A1); `portfolioHasCrypto: false` confirms the 16:00 ET expiry that causes it. `heldPositionTerm` is the number the Film Room never shows.

### Query 2 — How often the final-day hole fires (read-only Firestore)

```js
// Read-only. Counts completed battles whose LAST trading day has no dailyScores entry.
const snap = await db.collection('agentBattles')
  .where('status', '==', 'completed')
  .orderBy('completedAt', 'desc').limit(200).get();

let missing = 0, present = 0;
for (const d of snap.docs) {
  const b = d.data();
  const days = b.timing?.tradingDays || [];
  if (!days.length) continue;
  const lastKey = `day${days.length}`;
  (b.scoreState?.dailyScores?.[lastKey]?.recorded ? present++ : missing++);
}
console.log({ sampled: snap.size, finalDayRecorded: present, finalDayMissing: missing });
```

**Expected on the §3-A1 finding:** `finalDayMissing` dominates, with the residue being crypto-carrying battles.

### Probe 3 — When a session's candles become retrievable after the close

Cannot be read from code (§3-E1). **One GET per run; never prints the key.** The `api/` code reads `EODHD_API_KEY` (`api/_utils/marketDataCache.js:212`); the repo's local `.env` carries it as `VITE_EODHD_API_KEY` (`discovery/README.md:13-14`). The probe accepts either.

```javascript
// eodhd-close-latency-probe.mjs — READ-ONLY. Node 18+.
//   export EODHD_API_KEY='...'        # or VITE_EODHD_API_KEY
//   node eodhd-close-latency-probe.mjs SPY
// Run at 16:05, 16:15, 16:30, 17:00, 17:30, 18:00, 19:00, 20:00, 21:00, 22:00 ET,
// then 08:00 ET next morning. The FIRST run printing todayPresent:true with
// barsToday near 78 is the answer.

const SYMBOL = (process.argv[2] || 'SPY').toUpperCase();
const KEY = process.env.EODHD_API_KEY || process.env.VITE_EODHD_API_KEY;
if (!KEY) { console.error('Set EODHD_API_KEY or VITE_EODHD_API_KEY. Never hardcode it.'); process.exit(1); }

// EXACTLY the production URL shape: default window, no from/to.
// (api/_utils/marketDataCache.js:799 — pinned by marketDataCache.test.js:75-93)
const url = `https://eodhd.com/api/intraday/${SYMBOL}.US?api_token=${KEY}&fmt=json&interval=5m`;
const redacted = url.replace(KEY, 'REDACTED');

const etParts = (d) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  const hh = g('hour') === '24' ? '00' : g('hour');
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hh}:${g('minute')}` };
};

// The feed sends 'YYYY-MM-DD HH:mm:ss' with no zone suffix, and it is UTC.
// Parse manually — new Date(bare) is host-local and would be wrong.
// (mirrors parseEodhdDatetime, api/_utils/marketDataCache.js:980-994)
const parseUtc = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(s || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
};

const nowEt = etParts(new Date());
const res = await fetch(url);
if (!res.ok) {
  console.log(JSON.stringify({ probedAtET: `${nowEt.date} ${nowEt.time}`, url: redacted,
    httpStatus: res.status, bodyHead: (await res.text()).slice(0, 300) }, null, 2));
  process.exit(0);
}

const rows = await res.json();
const byDate = new Map();
for (const r of Array.isArray(rows) ? rows : []) {
  const d = parseUtc(r.datetime) || (r.timestamp ? new Date(r.timestamp * 1000) : null);
  if (!d) continue;
  const { date, time } = etParts(d);
  const e = byDate.get(date) || { bars: 0, lastBarET: null, lastClose: null, nullVolumeBars: 0 };
  e.bars += 1;
  if (r.volume === null || r.volume === undefined) e.nullVolumeBars += 1;
  if (!e.lastBarET || time > e.lastBarET) { e.lastBarET = time; e.lastClose = r.close; }
  byDate.set(date, e);
}
const dates = [...byDate.keys()].sort();
console.log(JSON.stringify({
  probedAtET:        `${nowEt.date} ${nowEt.time}`,
  symbol:            `${SYMBOL}.US`,
  url:               redacted,
  totalBars:         Array.isArray(rows) ? rows.length : null,
  distinctSessions:  dates.length,                 // also answers "how many prior sessions"
  firstSession:      dates[0] ?? null,
  lastSession:       dates.at(-1) ?? null,
  todayET:           nowEt.date,
  todayPresent:      byDate.has(nowEt.date),       // <-- THE ANSWER
  barsToday:         byDate.get(nowEt.date)?.bars ?? 0,
  lastBarTodayET:    byDate.get(nowEt.date)?.lastBarET ?? null,
  lastThreeSessions: dates.slice(-3).map((d) => ({ etDate: d, ...byDate.get(d) })),
}, null, 2));
```

**Read it against two in-repo claims, both worth disproving.** A mid-session capture reported the default response stale by one trading day (`discovery/eodhd-session-boundary-analysis.md:14`) — **measured mid-session, not post-close, which is precisely why this probe is needed.** And a complete session should read as **78 usable bars**: 79 arrive, of which one is a synthetic close print that production strips (`api/_utils/marketDataCache.js:851-857`); the probe reports `nullVolumeBars` so you can watch it arrive.

**Why the answer matters:** it decides whether a post-close replay can run at 4:25 PM ET (the batch-review cron) or must wait until 8:45 PM ET (the daily-scores cron) or the next morning.

### Probe 4 — Can an explicit window retrieve a specific past session?

Settles the contradiction between the code's docstring (`api/_utils/marketDataCache.js:787-790`) and a report of empty responses (`CALIBRATION_DATA_DISCOVERY_REPORT.md:145`). **This determines whether replaying day 2 of a 5-day battle is one call or is impossible without the full default window.**

```bash
# READ-ONLY. Run alongside Probe 3 at each post-close checkpoint.
KEY="${EODHD_API_KEY:-$VITE_EODHD_API_KEY}"
FROM=$(date -u -d '12 hours ago' +%s)   # macOS: date -u -v-12H +%s
TO=$(date -u +%s)
curl -sS "https://eodhd.com/api/intraday/SPY.US?api_token=${KEY}&fmt=json&interval=5m&from=${FROM}&to=${TO}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);console.log(JSON.stringify({rows:Array.isArray(a)?a.length:a,first:a[0]?.datetime??null,last:a[a.length-1]?.datetime??null}))})"
# NOTE: the URL contains the key — do not paste raw shell history into a report.
```

### Probe 5 — Are extended-hours bars ever present?

The repo's clamp is described by its own author as defensive rather than proven (§3-E1). Probe 3 already answers this incidentally: if `lastBarTodayET` ever exceeds `15:55`, or a session's `bars` materially exceeds 79, extended-hours bars are arriving. **No separate run is needed** — read Probe 3's `lastThreeSessions` block.

### Probe 6 — The unmeasured budget on the best cron host

`api/cron/agent-daily-scores.js` declares **no** `maxDuration` (lead-verified: zero occurrences), so it inherits the platform default. Before loading it with candle fetches (§3-E3), read the actual wall time of a production run from the Vercel logs for `/api/cron/agent-daily-scores` and compare against the plan's default ceiling. **No code change and no probe script is needed — this is a log read.**

---

## 5. Cross-arc findings

**Command Center arc.**
1. **The Command Center and the Film Room disagree by construction, one tap apart** (§3-A1). The dashboard hands the Film Room the very object it just read a score from, and the Film Room computes a different number from different fields. Any Command-Center-side fix that does not also give the Film Room a per-day total leaves the disagreement in place.
2. **A battle's outcome is not a stored fact** (§3-A1). No `result` field exists on the document. Every surface that wants to show Win/Loss must re-derive it from two scores or parse a feed sentence — a §9 display-agreement hazard the moment two surfaces derive it differently.
3. **The Review station's "debrief pending" copy is honest about a real race** (`src/components/Dashboard/ReviewStation.jsx:24-36`), and §3-A1 explains the underlying cause: battles complete before the day's last review run.
4. **The live battle screen's in-flight total omits carried-over badge points** (`src/screens/AgentBattleScreen.jsx:1034-1037` vs `api/cron/agent-evaluate.js:883`), so it drifts from the server's cumulative score on multi-day battles before snapping back at completion. Reported for separate tasking.

**Forge Record stream.**
5. **Forge suggestions are written by a cron with no human in the loop and read by nothing** (§3-B5). The "only when the user explicitly asks" rule is prompt prose with no code guard. **Surfacing them means first deciding what to do about robot-authored suggestions no player ever requested.**
6. **Proposed rules are written, rendered, and wired to nothing** (§3-B5) — accept/reject is explicitly deferred at `src/components/FilmRoom/DaySummaryCard.jsx:26-28`.
7. **Attribution diverges between the two writers** — the cron redirects to the parent agent, the chat path does not (§3-B5). Whether that is intentional is **UNVERIFIED**.
8. **The settings fingerprint splits one agent's history into two buckets by game mode, silently** (§3-F2). Any Forge Record feature keyed on "battles fought under this configuration" inherits that split.

**Harness / spine thread.**
9. **The learning receipts already carry what the trade records lack** — entry-ATR provenance, the outgoing position's entry timestamp and day, its threshold history, decision-time provenance (§3-B2). They are live and create-only. **The cheapest path to a richer Film Room may be reading them rather than widening the trade record** — which would also avoid fence contact, since the trade shape is written inside a fenced file.
10. **Tick stamps are the only structure guaranteed to equal what the model was shown** (§3-D1), pinned to rendered values by construction — the §9-correct source for any "here is what the agent saw" panel.
11. **Two parallel counterfactual representations exist and neither reaches a surface**; the one the prompt layer reads has **no writer at all** (§3-B5). **Pick one source and bind both surfaces to it** (BUILD_RULES §9).
12. **Anticipation has a grounding-mode time bomb** (§3-D3): the live shape carries the threshold, the dark shape drops it. Build against the tick stamp, not the chat record.
13. **The `src/` → `api/` import in `TrainingReportCard.jsx:22`** and the **`MANIFEST_WRITE_ENABLED` docstring drift** (§3-F1, §3-F2) are both §2/§4 hygiene items surfaced in passing. Reported, not adjudicated.
14. **Documentation line anchors are systematically stale** across `ARCHETYPE_MASTERY_DISCOVERY_REPORT_V1.md`, `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md` and `FORGE_ENFORCEMENT_KEYSTONE_*`. **Do not seed the redesign from them** — re-verify at HEAD, per BUILD_RULES §3.

---

## 6. NOT REACHED

**None.** All questions A1 through F3 were reached and answered. Four answers carry explicitly bounded confidence, restated here so the limits are not lost in the detail:

1. **E1c — sessions per request.** Not determined by code; the in-repo figures are DOC measurements from May 2026, with contradicting evidence about windowed requests. Probes 3 and 4 settle it.
2. **E1d — extended hours.** The code neither requests nor filters them; the "none arrive" claim is DOC and self-described as unproven. Probe 3 answers it incidentally.
3. **E1e — post-close retrievability.** Unreadable from code by construction. Probe 3.
4. **D2 latent defect reachability.** The off-universe equipped-ticker crash path was established by reading only; the "unreachable in practice" half is **ASSUMED**, not executed.

Additionally, three items are **UNVERIFIED for historical production data** because this session made no Firestore query: the shape of trade records written before the current field set; how often the shadow-assembly divergence path actually fires; and how long a sold symbol really stays on the bench in production (bounded in code only by re-entry and tournament filtering, with an open watch item at `api/_utils/agentSwapExecution.js:334-337`).

---

## 7. Bugs found outside this task's scope — reported, not fixed (BUILD_RULES §3)

1. **The gameplan approval UI is unreachable** — no live mount passes the meeting to the card (§3-B1). Probable wiring regression; meetings expire unapproved every day.
2. **The review dedupe key is not the key that gets written** — the dedupe compares against one date and the entry is stamped with another (`api/cron/agent-batch-review.js:176-178` vs `:318`), so a final-day review carries the date of the day *after* the battle. Independently found by two subagents and lead-verified.
3. **A §9 display-agreement consequence of (2):** the day card shows "Day N" beside that wrong calendar date (`src/components/FilmRoom/DaySummaryCard.jsx:51`).
4. **`counterfactualPoints` has no writer** — the prompt clause it feeds always falls through (§3-B5).
5. **The guardrail path's held-set omits the cross-agent held set** that the risk path unions in (§3-B3). May be intentional.
6. **The eval prompt's playbook asks for indicators the prompt never supplies** — a prose-honesty gap inside a fenced assembler (§3-D1).
7. **The tick stamp's ATR multiple is not the risk manager's** — a reviewer re-deriving bust or trail predicates from it would use the wrong number (§3-C1).
8. **An off-universe equipped ticker can reach an unguarded dereference** inside the swap transaction; latent, not live (§3-D2).
9. **The live battle screen's in-flight total omits carried badge points** (§5, item 4).
10. **`MANIFEST_WRITE_ENABLED`'s docstring still describes the pre-flip default** — a §2 flip-reconciliation miss (§3-F2).
11. **`pickEmergencyReplacement` is dead but still exported** (§3-B3). Removal is fenced-file contact; the Aug 16 addendum already calls it separate hygiene.

---

## 8. STOP

This is a read-only discovery. **No code, configuration, feature flag or data was changed. No fenced file was modified. No PR was opened, no branch merged, no CI watched.** The only file created is this report.
