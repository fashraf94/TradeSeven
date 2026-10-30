# Phase 0 — Huddle S1 discovery

**Issued:** Oct 29, 2026. **Run:** Oct 30, 2026 (read-only session).
**Scope:** read-only discovery, hard STOP. Nothing was designed, specced, built, fixed, deployed or triggered.
**Main @** `0de404e1` · **Report branch:** `claude/huddle-phase0` (this file only) · **No PR.**
**Checked against:** `20261029_DRB_HUDDLE_CONCEPT_V1_2.md` (the adopted concept) and `docs/audits/20261028_PHASE0_DRB_DISCOVERY.md` (branch `claude/drb-phase0`, read with `git show`, not merged).

## 1. Plain-terms summary (for the founder)

1. **Yes, the plan can reach the agent without editing a protected file**, through the two slots the concept names. Line 12 is the catch.
2. **The sweep has a home.** It fits in the agent's check routine, which is not a protected file, just before the check settles its posture.
3. **Pre-market prices: no code reads one today.** The data plan may carry them, but only a paid test call at 8:30 would prove it. Until then Shadow says "overnight news".
4. **Plans expire on their own.** Every game lasts one session (170 of 170 checked) and no check runs after the close, so nothing needs clearing the next morning.
5. **"At its next check" promises too much.** Only about 3 in 4 checks read the instruction at all, and an instruction does not wake the agent. In the last 10 sessions the longest wait between two readings was 195 minutes.
6. **The queue copies two things that already exist:** the cockpit sweep's job list with its saved place, and the reflection job's claim, three tries and honest give-up. Neither alone fits a job that calls an AI and a voice service, and the reflection job manages only about one AI call every 15 minutes.
7. **newsfilter.io does not exist here.** There is no code, no key on this machine and no key on the live site. It is a new integration.
8. **There is nowhere to keep audio yet.** The only server storage in use holds logs. Playing it from the app's own address is allowed.
9. **The "worked" grade has a hole.** Film Tape keeps no prices for ranked games, and BaggerBomb prices arrive the next morning, not at the close.
10. **Posture does less, and more, than the concept says.** Half the preset settings are unused. What is live is four exit thresholds plus one paragraph of guidance. A switch to defensive can force a sale at the next check. No game in 30 sessions has run anything but balanced.
11. **Removing the brief card is wide.** It touches well over 10 files, so the mandatory review applies.
12. **Biggest surprise:** today only pre-approved sentences can enter the instruction slot. That rule is what keeps an archetype honest. The composed instruction would be the first free text to reach the agent, written by an AI and editable by the player. The slot would accept it. Whether it should is your call (Question 1).

## 2. Git state and production access

- **Repo:** `portfolio-duel` (remote `fashraf94/TradeSeven`).
  - `git fetch origin` ran first (BUILD_RULES §3) and brought nothing new.
  - `origin/main` = **`0de404e1ca1209244f548a877117771cc2e650bc`** (merge of PR #1016).
  - `git fetch origin claude/drb-phase0` gave `ef7e6943`. The discovery report was read with `git show` and not merged.
- **Where I worked:** the desktop app's worktree `.claude/worktrees/huddle-s1-discovery-88bca8`, local branch `claude/huddle-s1-discovery-88bca8`, HEAD `0de404e1`, clean tree. `main` itself stays checked out in the main checkout, so I did not switch to it. HEAD equals `origin/main`, so this is the same tree the prompt names.
  - The report is pushed as **`claude/huddle-phase0`** by refspec. The only file it adds is this report. No PR.
- **Production access used (reads only):**
  - **Firestore,** through the Firebase Admin service account in the main checkout's `.env.local`. Two read scripts outside the repo printed counts only: no uids, no ids, no text.
  - **Vercel CLI,** authenticated: `vercel env ls production`, filtered to names.
  - **Local env files:** names only.
- **Not done:** no writes; no call to Anthropic, OpenRouter, ElevenLabs, OpenAI, EODHD, EXA or newsfilter; no cron or admin route; `CRON_SECRET` not used; no secret value printed; Google Cloud Storage not opened.
- **A copy of this report outside the repo tree** is in the session scratchpad (BUILD_RULES §3).

## 3. Answers

**Marks.** **VERIFIED** = I read that line in this session. **PROD** = read from production in this session. **INFERRED** = a conclusion, with its evidence stated. **ASSUMED** = taken from a subagent. No subagent ran, so this report has no ASSUMED claims of that kind; the one inherited claim is marked "inherited" in §7.

### Q1 — The fence, at HEAD

**BUILD_RULES §1 list, verbatim (`docs/BUILD_RULES.md:14-24`, VERIFIED):**

```
- `api/agent/decide.js`
- `api/_utils/agentSwapExecution.js`
- `api/_utils/agentScoring.js`
- `api/_utils/agentRiskManager.js`
- `api/_utils/agentArchetypeConfig.js` (contains the hftConfig blocks)
- `api/_utils/agentBattleService.js` (incl. the `createAgentBattle` doc shape)
- `api/_utils/agentPromptAssembly.js`
- `api/_utils/agentEvalPromptAssembly.js` *(added June 10, 2026 — founder decision)*
- `api/_utils/agentGuardrails.js` *(added July 24, 2026 — founder fence-list reconciliation; the DR-4 guardrail-binding compilation target: deterministic risk enforcement — `applyGuardrails` / `checkSectorCap` / stop + trailing firing. The Sector Cap Activation arc, which added the fenced-config read + the derived `DIVERSIFIER_SECTOR_CAP_PCT` here while this file was still non-fenced, is a DELIBERATE GRANDFATHERED EXCEPTION, not a precedent — edits here are now §7-gated fence contact.)*
- `api/_utils/archetypeScoring.js` *(added July 24, 2026 — founder fence-list reconciliation; the "scoring engine" concept named explicitly — `ARCHETYPE_WEIGHTS` / `ARCHETYPE_TEMPERATURES` / `ARCHETYPE_CONSTRAINTS`.)*
- `api/_utils/tournamentUserScoring.js` *(fenced as a scoring-engine concept — it verbatim-ports the fenced `decide.js` threshold math under a source-text tripwire — but OUT OF SCOPE for the archetype-program activation flags; listed for scoring integrity only.)*
```

**The concept clause (`docs/BUILD_RULES.md:26`, VERIFIED):** "The scoring engine and `createAgentBattle` document shape are fenced as concepts, not just files: changes that alter their behavior from non-fenced call sites are fence contact too."

**Precedent for content, not files (`docs/BUILD_RULES.md:32`, VERIFIED):** a flip of `EXA_RETRIEVAL_ENABLED` is "a §7-class agent-channel change requiring fenced-file review" because it "changes what reaches the §1-fenced assemblers". The rule names that one flag; see the finding in §4.

**Flag-pin registry (`src/config/flagPinGuard.test.js`, VERIFIED).**
- `FLAG_SOURCE_MODULES` (`:45-51`): `src/config/featureFlags.js`, `api/_utils/compositionConfig.js`, `api/_utils/tournamentOrchestrator.js`, `src/config/agentFormFlags.js`.
- `DARK_BY_DESIGN` (`:60-298`), 27 names: `COMPILER_ENABLED`, `EQUIPPED_RULE_PRECEDENCE_ENABLED`, `CONTINUITY_MEMORY_ENABLED`, `INTRADAY_AGENT_USE_ENABLED`, `INTRADAY_RISK_ACTIVATION_ENABLED`, `WIRE_NEWSLINE_ENABLED`, `EDITORIAL_REVIEW_ENABLED`, `COMPOSITION_MIGRATION_FEED_ENABLED`, `COMPOSITION_DISPLAY_ENABLED`, `MANDATE_ROLLOVER_ENABLED`, `SHOW_IT_ENABLED`, `MANDATE_DORMANCY_DOWNSHIFT_ENABLED`, `AGENT_FORM_LAB_ENABLED`, `AGENT_FORM_HUB_ENABLED`, `AGENT_FORM_BATTLE_ENABLED`, `COMMAND_CENTER_SYNC_ENABLED`, `WEEKLY_LADDER_PLACEMENT_ENABLED`, `PREOPEN_PHASE_ROUTING_ENABLED`, `ARCHETYPE_VECTORS_V2_ENABLED`, `ARCHETYPE_REFRESH_MENU_ENABLED`, `ELIGIBILITY_ATTESTATION_ENABLED`, `DIRECTIVE_FIT_CHECK_ENABLED`, `BACKING_BETA_ENABLED`, `SHADOW_ASSEMBLY_ENABLED`, `EVAL_DEFERRED_BEAT_ENABLED`, `RESPONSE_FORK_ATTRIBUTION_ENABLED`, `SHADOW_CPU_QUOTE_INTEGRITY_ENABLED`.

**The four files:**

| File | Fenced? | The line that says so |
|---|---|---|
| `api/_utils/agentBattleService.js` | **Yes** | `docs/BUILD_RULES.md:19` (VERIFIED) |
| `api/cron/agent-evaluate.js` | **No** | Absent from `:14-24`. `:88` places the exclusivity ledger around its swap call sites "never inside fenced code". Heavily pinned by source tests (Q12) (VERIFIED) |
| `api/_utils/directiveWriter.js` | **No** | Absent from `:14-24` (VERIFIED) |
| `api/_utils/controlPromptRenderer.js` | **No** | Absent from `:14-24`. Its own header calls it "fence-ADJACENT" (`:4`) (VERIFIED) |

### Q2 — The instruction slot (`battle.directive`)

**Shape (`api/_utils/directiveFiling.js:77-89`, VERIFIED).**
- Every filing: `text`, `expiry`, `directiveThreadId`, `createdAt`.
- Only when minted from the menu: `adjustmentId`, `canonicalTextVersion`.
- Only for a cockpit command: `family: 'call'`, `expiresAtMs`, `basis`, `callId`, `kind`, `action`, `answerId`, `filedAt`, `textVersion` (`:30-46`).
- **There is no `directiveInstanceId` on the slot.** That name exists only on `battle.leanOverrides` rows, which bind to the slot's `directiveThreadId` (`controlPromptRenderer.js:31-32`, `:45-48`, `:179-181`, VERIFIED).
- `createAgentBattle` writes no `directive` key (`agentBattleService.js:139-331`, VERIFIED). The field appears at the first filing.

**`fileDirectiveTransactional` (`api/_utils/directiveWriter.js:86-145`, VERIFIED).**
- It validates one thing: that `arrayUnion` is a function (`:88`).
- It always appends an exchange: `{ chatExchanges: arrayUnion(stamped), ...fields }` (`:91`). A plan filing therefore puts a row in the battle's chat history.
- It adds only the `supersedes` stamp, and only when the slot it replaces is call-family (`:42-47`, `:89`).
- **It does not check** owner, battle status, agent binding, session, belief, budget or text. The header says so: "the writer gates nothing… admission (owner, active parent, binding, belief, canonical, budget, pending) stays with each route" (`:9-12`).
- It takes a transaction (chip, cockpit) or `null` (chat's plain update) (`:81-82`).
- Three callers exist: `api/agent/chat.js:1112`, `api/agent/file-directive.js:291`, `api/agent/call-response.js:412` (VERIFIED).

**What the routes check before calling it (VERIFIED).**
- **Chat route, in order:** auth `chat.js:421`; battle read `:451-455`; owner `:458-460`; agent belongs to battle `:475-477` (`agentBelongsToBattle`, `api/_utils/agentBattleBinding.js:48-52`); active status `:508-513` (review mode exempt); agent read `:516-519`; budget `:523-543`.
- **The closer model for a new route is `file-directive.js`,** because all of it sits in one transaction: flag `:176`, then owner `:207`, active `:209`, binding `:211`, belief `:216`, budget `:234-267`, write `:291-300`. Its header records the rule a new route must also keep: "this route writes EXISTING keys only" because the battle doc's shape is fenced as a concept (`:65-68`).

**The integrity gate.** This is the check a composed instruction would skip.
- Chat: "the ONLY directive body that can ever be persisted is a verbatim canonical allowlist string for the agent's own archetype" and the gate "never copies model free-text into a directive" (`api/_utils/directiveGate.js:4-12`, VERIFIED).
- Chip: canonical text server-side, the client's text ignored (`file-directive.js:230-232`, VERIFIED).
- Cockpit: code-templated `textVersion: 'callActions.v1'` (`directiveFiling.js:30-32`, VERIFIED).
- Nothing downstream enforces this. `resolveControls` needs only a string `text` and thread id (`controlPromptRenderer.js:123-126`), and `renderDirectiveBlock` puts the text in quotes with no sanitizer and no length cap (`:213-219`), inside the fenced prompt (`agentEvalPromptAssembly.js:1240-1246`) (VERIFIED).
- **PROD (70 non-CPU battles, last 30 sessions):** 69 ended with no directive, 1 with a cockpit directive, 0 with an ordinary one; longest text 48 characters. Since ordinary slots are never cleared, no ordinary directive was filed in these games (INFERRED). The slot has almost no live history.

**How a directive is replaced or cleared (VERIFIED).**
- **Replaced:** the whole object is set, latest wins, and nothing reads the prior slot (`directiveFiling.js:72-76`).
- **Never cleared by chat:** `agentEvalPromptAssembly.js:1231-1232`.
- **Retired:** call-family only, compare-and-clear (`directiveWriter.js:53-68`; `agent-evaluate.js:2681`, `:5823-5832`).
- **Killed:** a mode epoch in `controlEpochLog` (`controlPromptRenderer.js:38-41`, `:140-145`).
- **Not touched by an archetype change:** `api/agent/change-archetype.js:140-142`.

**Expiry (VERIFIED).** An ordinary directive has no clock.
- `end_of_battle` and `permanent` are always active; `3_games` counts trading days; an unknown value is treated as active (`directiveUtils.js:51-80`).
- Only a call-family directive has `expiresAtMs`, and it needs the check context with mode `'on'` (`:115-124`). So a real clock is not available to an ordinary filing.

**Does a ranked battle persist across the week? No.**
- `AGENT_BATTLE_DURATION_MODE = 'fullday'` (`agentBattleService.js:41`) and `tradingDays` is one date (`:129`) (VERIFIED).
- League pods get "fresh battles deployed daily" (`tournamentOrchestrator.js:146`), with a per-day guard (`:443-449`) (VERIFIED).
- "Day banked" is a one-day completion line (`agent-evaluate.js:6922-6926`, `hubCopy.js:308`) (VERIFIED).
- **PROD:** 170 of 170 battles in the last 30 sessions carry exactly one trading day.
- **So Tuesday's directive stays on Tuesday's completed document.** Wednesday's battle is a new document with no slot (INFERRED from the above).

**The "heard" receipt: what a grader reads (VERIFIED).**

| Record | Fields | Note |
|---|---|---|
| `agentBattles/{id}/ticks/{id}:{tickSeq}` (permanent; id at `captureContext.js:133`) | `controls.rendered`, `controls.directiveThreadId`, `controls.directiveTextHash`, `controls.directiveSuppressed`, plus `stageReached`, `exitReason`, `capturedAt`, `evalId` (`captureWriter.js:243-328`) | `rendered` is `'resolved'` only when a prompt was built (`agent-evaluate.js:4540`, `:4575-4579`), else `'not_rendered'` |
| `agentBattles/{id}/tickBodies/{id}:{tickSeq}` (120-day TTL) | `controlsAsRendered.directiveText`, `request.body` (the prompt as sent) (`captureWriter.js:210-232`) | Authority on what was sent |
| `agentBattles/{id}.evaluations[].heard` | `{ directiveThreadId, suppressed }` (`tickStamps.js:13-22`, `:358-359`) | Keeps the last 150 entries (`agent-evaluate.js:4738`) |

- **The test for heard:** `controls.rendered === 'resolved'`, thread id matches, and `directiveSuppressed` is null. The thread id alone is not enough, because it is also filled for a suppressed directive (`agent-evaluate.js:5092`).
- `directiveTextHash` is `canonicalContentHash(text)` (`:5095`; `api/_utils/canonicalHash.js:42`), so a stored text can be matched to a check.
- **The preset has no such receipt.** The permanent tick record has no preset field (`captureWriter.js:243-387`; no "preset" in `api/_utils/tickCapture/` non-test files). It is provable only from the prompt body ("STRATEGY PRESET: …", `agentEvalPromptAssembly.js:1155-1156`; 120 days) or from `entryPreset` on a trade row (`agent-evaluate.js:2196`, `:3895`), which exists only when the agent traded.

**A directive does not wake the agent (VERIFIED, PROD).**
- `evaluateTriggers` reads no directive. Its trigger types are `forced_open` (first evaluation), `forced_close` (final hour), and market conditions (`agentTriggerGate.js:44-55`, `:64-196`). The call site adds nothing (`agent-evaluate.js:2876-2878`).
- The comment at `agent-evaluate.js:2671-2673` names the trigger gate as a reader of the directive; the gate's code has no such read at HEAD.
- **PROD, last 10 sessions:** 531 admitted checks. 391 built a prompt (73.6%). The other 140: 89 with a pending gameplan meeting, 20 creating one, 31 with no trigger.
- **PROD, wait between checks that built a prompt:** median 15 min, 90th percentile 15 min, 99th 149 min, longest 195 min. 4.6% of waits exceeded 60 min. Per battle, the median longest wait was 76 min.

### Q3 — The preset slot (`battle.strategyPreset`)

**Valid values:** `aggressive`, `balanced`, `defensive` (`api/_utils/agentPresetConfig.js:6-63`). Anything else resolves to the default through `presetKeyOf` (`api/_utils/playerFieldReaders.js:37-39`). Creation default `'balanced'` (`agentBattleService.js:287`). All VERIFIED.

**What each does: live effects (VERIFIED).**

| Lever | aggressive | balanced | defensive | Where it acts |
|---|---|---|---|---|
| Emergency exit, × ATR from entry | −0.90 | −0.85 | −0.75 | `agentRiskManager.js:128-134` |
| VWAP failure, checks below VWAP | 3 | 2 | 1 | `:141-148` |
| VWAP dead band, % | 0.7 | 0.5 | 0.3 | `:141`; `agent-evaluate.js:1946` |
| Trail stop arms above, × ATR | 1.5 | 1.5 | 1.0 | `agentRiskManager.js:168-174` |
| Guidance paragraph in the prompt | yes | yes | yes | `agentEvalPromptAssembly.js:1155-1156` |

**Unused settings (VERIFIED).**
- `regime.favoredStrategies` and `regime.holdOnlyRegimes` are read only by `getPresetAdjustedStrategies` (`agentRegimeClassifier.js:122-148`), which `agent-evaluate.js:105` imports and nothing calls.
- `scoring.minConviction` has no reader; the only other mention is a comment (`platformGuardrails.js:39-41`).

**What "defensive" permits: everything.**
- No code blocks a trade under it. "Only trade with very high conviction" and "Sit out choppy regimes entirely" are prompt text (`agentPresetConfig.js:61`), and the platform conviction floor of 70 applies to all presets (`platformGuardrails.js:36-42`) (VERIFIED).
- It tightens forced exits, so it can cause more swaps. A position already at −0.75× ATR would hit the emergency exit at the next check, before any prompt (`agentRiskManager.js:128-134`, levers passed at `agent-evaluate.js:1982`) (VERIFIED; the consequence is INFERRED).

**Who may write it.**
- The owner, by rule (`firestore.rules:474-478`, VERIFIED).
- The client writer is `updateStrategyPreset` (`src/services/agentService.js:622`). Its UI is `StrategyPresetBadge`, imported at `AgentBattleScreen.jsx:114`, and `StrategyPresetToggle` (VERIFIED). The DRB report found neither mounted.
- **No server route sets it.** The only server writes are the creation default and the migration default (`agent-evaluate.js:1083`) (VERIFIED).
- **PROD:** 70 of 70 non-CPU battles in 30 sessions ran `balanced`.
- `docs/ARCHETYPE_PHASE1_MASTER_SPEC_V1_1.md:116` says user configuration "(incl. reclassified `strategyPreset`) frozen at lock", and `:261` lists a "mid-battle preset writer" for retirement. HEAD does not implement that. Whether it is still the plan is a founder call (Question 2).

### Q4 — Where a check-start sweep could live (R-6)

**In `api/cron/agent-evaluate.js`, one battle's check runs in this order (`processAgentBattle`, `:906`, VERIFIED):**

| Line | Step |
|---|---|
| `:910-914` | Dormant gate for a BaggerBomb battle before its first day |
| `:928-995` | Eval lock transaction |
| `:1012`, `:1034`, `:1040` | Capture context, calls mode, check context |
| `:1071-1095` | Migration guard: writes missing fields, then mirrors them in memory (`:1094`) |
| `:1125-1126` | Tournament context |
| **`:1153-1154`** | **`governingPreset` resolved once for the whole check** |
| `:1927` | First directive read (epoch telemetry) |
| `:3096` | Prompt built |
| `:4555` | Heard stamp, resolved from the same in-memory battle |

- **Earliest usable point: after `:1095`, before `:1153`.** Lock held, migration done, nothing has read either slot.
  - A preset written after `:1153` governs only the next check. The comment at `:1147-1152` says why re-reading is ruled out.
  - The write must also land on the in-memory `battle`, as `:1094` does. The heard stamp reads memory, "NEVER a doc re-read" (`:4545-4547`), and `battle` comes from the run's opening query (`:946-951`).
- **Fence:** `agent-evaluate.js` is outside it (Q1). A new helper in a new file is outside it, unless §1 adds it. A new importer of an archetype table must also record itself in `api/_utils/archetypeImportBoundaryBaseline.json` (`docs/BUILD_RULES.md:28`) (VERIFIED).
- **Limits of this home (VERIFIED):**
  - It runs only during market hours: the handler stops at `:443-446`, so nothing before the 9:30 tick.
  - It misses a lock-skipped check (`:987-995`) and a battle past the time budget (`:504-515`).
  - It sees `cpu_passive` seats unless it filters them.
- **A run-level sweep already has a pattern.** `runCanonicalOpenSweep` is an isolated subtask with its own timeout before the battle loop (`:452-463`, VERIFIED).

**The hub alternative (VERIFIED).**
- `deployAgent` is the one client door (`src/services/agentDeploy.js:104`). It returns `{ outcome: CREATED, success: true, agentBattleId }` at `:393-399`. The id is known from `:323`.
- The hub's provider receives that result at `src/contexts/DeployAttemptContext.jsx:493` and applies it at `:504`. That is the point right after a successful deploy.
- Two legacy shells call `deployAgent` directly (`CommandDashboard.jsx:291`, `CommandDashboardDesktop.jsx:200`). A hook in the provider would miss them; a hook in `agentDeploy.js` would not.
- This path covers a client deploy only. Ranked deploys are server to server (`tournamentOrchestrator.js:476-482`), so only Confirm or the sweep can reach them.

**Ranked seat retry window (VERIFIED).**
- Cron `*/10 11,12,13,14,21,22,23 * * 1-5` (`vercel.json:188-191`). Morning duties run until ET noon (`tournamentOrchestrator.js:134`, `:165`).
- **First tick and last retry:** 7:00 and 10:50 AM in EDT; **6:00 and 9:50 AM in EST**, from Nov 2.
- The day's duty marker stays unset while any seat is cooled, deferred or failed (`:1198-1201`), and a failed deploy waits at least 10 minutes (`:124`, `:509`). So retries continue on every tick of that window.

**A battle created at 9:50 ET.**
- The evaluator runs at :00, :15, :30, :45 (`vercel.json:156-159`), so its next tick is 10:00.
- League battles are never held back (`agent-evaluate.js:894`), and the first evaluation is a forced trigger (`agentTriggerGate.js:46-49`). So it gets a real check at 10:00 unless a quote, lock or meeting exit intervenes. VERIFIED.

### Q5 — Sessions, expiry and the evening job

**Helpers (VERIFIED).**

| Need | Helper |
|---|---|
| ET date of an instant | `etDateOf(ms)` `src/utils/stockAdmissionWindow.js:30`; `getETDate` + `formatDateString` `api/_utils/marketSchedule.js:61-70` |
| Session bounds, holiday and early close | `getSessionForDate(etDate)` `src/utils/marketCalendar.js:117`: `isTradingDay`, `isEarlyClose`, `openMs`, `closeMs`, `previousEtDate`; `null` outside 2026–2027 (`:69`), and the caller exits `calendar_missing` |
| Previous session | `getPreviousSessionDate` `marketCalendar.js:151` |
| Holiday, early close | `isMarketHoliday`, `isEarlyCloseDay` `marketSchedule.js:89-92` |
| Market open now | `isMarketOpen` `marketSchedule.js:130-147` |
| Which session a new BaggerBomb plays | `tieredFullDayTarget` `stockAdmissionWindow.js:66-74`; `LATE_DAY_START_MINUTES = 45` (`:26`) |
| Which session a battle belongs to | `battle.timing.tradingDays[0]` (`agentBattleService.js:129`) |

- A server can reject a cross-session attachment by comparing that battle field to the plan's session (INFERRED from the above).
- `nextSessionAfter` is private to `stockAdmissionWindow.js` (`:45`).
- **Early close:** `closeMs` is already 1:00 PM, and the BaggerBomb late start is 12:15 PM (`:23-26`).

**Crypto rosters (VERIFIED).**
- A roster holding crypto expires at 8:00 PM on a regular day (`agentBattleService.js:42`, `stockAdmissionWindow.js:72`).
- No check runs after the close: `isMarketOpen` is false from 4:00 PM (`marketSchedule.js:146`) and the handler returns at `agent-evaluate.js:443-446`.
- So R-9 costs nothing at the agent. What stays alive until 8:00 PM is the chat voice's read of the slot (`voiceLayerPrompt.js:3719`).

**The evening settle (VERIFIED).**
- `agent-evaluate?mode=settle` runs `0 2 * * 2-6` (`vercel.json:160-163`): **10:00 PM EDT, 9:00 PM EST**, Monday to Friday by ET date.
- It reads `status == 'active'` battles (`findActiveAgentBattles`, `agent-evaluate.js:348`), completes those past expiry (`:354-392`), and stops (`:398-405`).
- **It enumerates expiries only.** Stocks-only games have already completed at the first evaluator tick after the close (`:347` runs on every tick), so the evening run mostly sees Night Game rosters (INFERRED).

**What lists completed battles per session (VERIFIED).** The close pass: `completedBetween(db, fromIso, toIso)`, a single-field range on `completedAt` that needs no composite index (`api/_utils/filmTape/closePass.js:95-100`, selection `:7-10`), with the session rule `isBattleDay` in `src/utils/tapeSchedule.js`.

**An ET guard to copy (VERIFIED).**
- `api/cron/process-draft-claims.js`: dual hours in one entry, `25 13,14 * * 1-5` (`vercel.json:72-75`); `getClaimProcessingWindow` (`:97-112`, Intl, no offset math); `isAlreadyProcessedForDay` (`:126-128`). BUILD_RULES names it as the template (`:79`).
- For 8:30 ET the same shape is one entry, `30 12,13 * * 1-5` (INFERRED).
- Crons are holiday-blind (`tournamentOrchestrator.js:719`), so the job needs its own session check.

### Q6 — The queue pattern and the cron budget

**Two existing patterns, each holding half of what a per-player job needs (VERIFIED).**

| Part | Reflections: flag, claim, lease (`api/cron/process-pending-reflections.js`) | Call sweep: queue row, persisted cursor (`api/_utils/callRecords/queue.js`, `sweep.js`) |
|---|---|---|
| Enqueue | `pendingReflection` set in the same update as `status: 'completed'` (`agent-evaluate.js:7123-7129`) | One row per battle, `callSweepQueue/{battleId}`, written atomically by the code that creates the work (`queue.js:4-10`, `:57-63`) |
| Select | `status == 'completed'`, `pendingReflection == true`, oldest first, limit 5 (`:96-102`) | Pages of 20 by `nextExpiresAt`, resumed from `callSweepState/singleton` = `{ phase, lastNextExpiresAt, lastDocId }` (`sweep.js:16-25`, `:76`, `:476-483`) |
| Claim | Transaction re-checks the flag, counts the attempt, takes a 150 s lease (`:80`, `:139-151`) | None: each transition is its own transaction with fresh reads (`sweep.js:27-29`) |
| Retry | The flag stays set; the next 15-minute tick retries (`:26-28`) | The row stays until the work is done; the cursor passes over a skipped row and returns on the wrap (`sweep.js:23-24`) |
| Give up | After `MAX_REFLECTION_ATTEMPTS` = 3 (`reflectionOutcome.js:29`), the flag clears and the battle is marked no-lesson (`:27-28`) | No attempt cap |
| Done | One outcome write with the lease cleared (`:169-172`) | Row deleted only inside a transaction that re-read it (`sweep.js:50-52`) |
| Budget | `maxDuration` 120 s (`:64`), tenants' budget 50 s (`:67`), reflection phase 40 s (`:76`); "in practice one model call per tick, 48 ticks a day" (`:71-75`) | `min(now + 20 s, handlerStart + 45 s)`; below 2 s it logs `starved` and reads nothing (`sweep.js:88-91`, `:451-455`) |
| Idempotency | The claim transaction and the lease (`:135-138`) | "a stale cursor only re-reads; every transition is idempotent"; cursor written once per run (`sweep.js:534-536`) |

- **The call sweep is the live persisted-cursor queue.** It runs as a tenant of the reflections cron (`process-pending-reflections.js:261-274`) and makes no model call. A second persisted cursor, `masteryConfig/sweepCursor`, serves the mastery repair sweep on the evaluator's cadence (`masterySettlement.js:662-676`). The DRB report's "a queue with persisted cursors" for reflections was loose: the reflection job itself has none.
- **Not cursor models:** `mandate-rollover`'s cursor is a local variable of one run (`api/cron/mandate-rollover.js:83`), and `mandate-evaluate` records "NO durable value-cursor" (`:353`).
- **Per-day idempotency precedents:** deterministic per-date markers (`tournamentOrchestrator.js:179-181`, `:1372`) and `isAlreadyProcessedForDay`.
- **Cost shape:** the reflection job fits one 35 s model call per 15 minutes, and four other tenants share that cron. A huddle job also waits on speech (INFERRED).

**Cron budget (VERIFIED).** `vercel.json` holds **44** entries, counted with Node. `docs/BUILD_RULES.md:78` says "44/100". The rule also says to "prefer branching inside existing handlers over new entries".

**Enumerating active players (VERIFIED for the queries).**
- Owners with a battle now: `findActiveAgentBattles` (`agentBattleService.js:49-56`), single field.
- Owners with a battle in a session: `completedBetween` above, plus a `createdAt` range (single field).
- Owners with a recent deploy: `agents.lastDeployedAt`.
- One owner: `where('ownerId','==',uid).where('status','==','active')`. Equality on two fields needs no composite (INFERRED), and `ownerId + status + completedAt` already exists in `firestore.indexes.json`.
- Filter `isCpu`. CPU seats carry `ownerId: 'cpu-{n}'` (`tournamentCpu.js:61`).

**Counts (PROD, counts only).**

| Window | Non-CPU battles | Distinct owners | With a League game | With a BaggerBomb game |
|---|---|---|---|---|
| Last 1 session | 2 | 2 | 1 | 1 |
| Last 5 | 7 | 2 | 1 | 2 |
| Last 10 | 25 | 3 | 2 | 3 |
| Last 20 | 54 | 3 | 2 | 3 |
| Last 30 | 70 | 3 | 2 | 3 |

- Active at read time: 5 battles, 2 non-CPU, 2 owners.
- `agents.lastDeployedAt`: 2 owners in 5 sessions, 3 in 10, 3 in 20.
- Of 49 owner-sessions, 16 had two or more battles, and 12 had both a League game and a BaggerBomb.
- "League" here means any battle with a `groupId`; this read does not separate ranked pods from training pods.

### Q7 — Data for the names beat

**Pre-market prices: no code reads one. A priced source may exist in the plan, unproven.**
- **Live v2** (`/us-quote-delayed`, `api/_utils/intraday/intradayFetch.js:49`) is in the plan at 1 unit per ticker, 20 tickers per request (`intradayConfig.js:24-25`). The vendor's answer says `lastTradePrice` and `lastTradeTime` "keep updating with extended-hours prints" after 4:00 PM (`:52-54`), and the response carries `ethTime` and `ethVolume` (`:39`, `:51`). The repo records nothing about pre-market. The adapter reads no `eth*` field (`observation.js:110-126`) (VERIFIED).
- **The poller does not run then.** Quote collection is `[open, close + 30 min)` (`api/cron/intraday-poll.js:5-8`, `intradayConfig.js:108-109`) (VERIFIED).
- **`/real-time/`** selects `close || previousClose` (`marketDataCache.js:794-799`). The code does not say what it returns at 8:30 (VERIFIED for the code).
- **WebSocket:** the client drops `extended-hours` ticks (`websocketService.js:463-470`), and `/api/ws-config` answers `available: false` (`api/ws-config.js:40`), so no socket opens (VERIFIED).
- **Film Tape bars exclude pre-market. Confirmed:** `t < session.openMs` is dropped (`api/_utils/filmTape/bars.js:73`), and the closing row is out too (`:69`) (VERIFIED).

**Overnight news.**
- **newsfilter.io: nothing.** `git grep -il newsfilter` returns no file. No matching name in `.env.local`, `.env.vercel.production` or Vercel production (VERIFIED, PROD). There is no client, ingest, env var or query shape to reuse.
- **EODHD `/news`:** `api/news/stock.js:46`, `api/news/market.js:37`, `sonarCatalystFetch.js:123`, `validatedCatalystCache.js:88` (VERIFIED).
- **EODHD `/sentiments`: no use anywhere** (`git grep`, VERIFIED).
- **The Wire:** `fantasyTimesStories`, queried per ticker by `fetchRecentNews` (`agentTriggerGate.js:221-259`, default 120-minute window, 10 symbols), with no vendor call (VERIFIED).

**Ticker caching (VERIFIED).**
- **Reusable:** `getStockAnalysisData(symbol, { fields })` (`marketDataCache.js:560`), two layers, Firestore keys `{SYMBOL}_{field}` (`:618`). TTLs: daily 4 h, news 30 min (`:30-37`). Passing `price` always spends a live call (`:684-686`).
- **Per ticker, per day:** `validatedCatalysts/{date}.catalysts[SYMBOL]` (`validatedCatalystCache.js`, `getValidatedCatalyst`).
- **No "Price Authority" or EODHD call-budget module exists in code.** The hits for those terms are docs or unrelated time budgets. `docs/audits/20261007_EODHD_CALL_CENSUS.md` found the unified design "not in the repo", and about 86,000 of 100,000 daily calls in use at its modelled load.

**Holdings for one owner (VERIFIED).**
- A battle's `ownerId` is the agent's (`agentBattleService.js:141`). The casual clone's owner is the player (`casualClone.js:64`), and so is a training clone's (`trainingClone.js:127`). The one-owner query in Q6 therefore returns all of them.
- Positions: `battle.portfolio.{star,core,support,bench}`; `flattenPortfolioServer` is a fenced export, callable, not editable.
- At 8:30, a player's BaggerBomb is usually not deployed yet, so today's list is the League seat plus yesterday's completed games (INFERRED from Q5).

### Q8 — Audio and delivery

**`api/academy/generate-audio.js` (VERIFIED).**
- **Raw `fetch`,** no SDK (`:205-213`).
- **Endpoint:** `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=…` (`:184`).
- **Settings:** model `eleven_multilingual_v2`, `mp3_44100_128`, stability 0.5, similarity 0.75, style 0.3 (`:43-47`). SSML `<break>` tags between scenes (`:96-99`).
- **Output:** raw MP3 when `download` is set (`:229-234`), else base64 JSON (`:240-254`).
- **Auth:** admin secret only (`:138-151`). No in-app caller (DRB report; not re-swept).

**ElevenLabs SDK: none in `package.json`.** Timestamps or dialogue endpoints: none anywhere (`git grep`, VERIFIED). `ELEVENLABS_API_KEY` is present by name on Vercel production (PROD).

**Binary storage (VERIFIED, PROD for names).**
- **Firebase Storage: client config only.** `storageBucket` from `VITE_FIREBASE_STORAGE_BUCKET` (`src/firebase/config.js:23`), present by name on Vercel. The server's Admin init sets no bucket (`api/_utils/firebaseAdmin.js:14-22`). `firebase.json` has no storage block and there is no `storage.rules`.
- **GCS: logs only.** Bucket `fantasytrades`, project `macro-nuance-474602-f5`, credential `GCS_CREDENTIALS` (`api/_utils/shadowLogger.js:18`, `:25`, `:33-36`). `@google-cloud/storage` is in `package.json:20`. Reads exist only in scripts, not routes.

**Binary route to copy (VERIFIED).** Only one: `generate-audio.js:229-234` (`audio/mpeg`, `res.send(Buffer)`). No route returns `image/svg+xml`.

**CSP, re-confirmed (`vercel.json:38`, `:34`, VERIFIED).**
- No `media-src`, so media falls back to `default-src 'self'`. **Same-origin audio plays; `data:` and `blob:` audio is blocked.**
- `img-src 'self' data: https:` allows SVG as an image.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` blocks the microphone.

### Q9 — Hub surfaces

**Partnership today (VERIFIED).**
- `panels/PartnershipPanel.jsx:12-18` renders one line and takes no props. Its header says "No control, link, count or record fetch" (`:4-6`).
- Copy: `hubCopy.js:128-133`.
- `AreaPanel.jsx:30` mounts it with no data. `hubModel.js:64`: "Partnership takes no prop". Its reader fetches nothing because none exists.

**How a section gets a reader (VERIFIED).**
- Pattern: `useHubReaders.js` calls the hook (`:114`), adds it to `sections` (`:231`) and to `actions` (`:217`).
- **The hub's mount guard shapes this.** `commandCenterHub.mount.guard.test.js:654-664` bans `fetch(`, `getDoc`, `useEffect`, timers and listeners inside hub files, with named allowances only. Anything else must be a module outside the directory listed in the permitted map (`:595-626`) and named in `NAMED` (`:1197+`). The brief passed that way (`:603`, `:1207`, `:1293-1307`). A new reader or a Confirm call needs the same entries. This guard needs the full suite to prove.

**The brief card and its reader: what removing them touches (VERIFIED).**
- Source: `sections/BriefSection.jsx`; `CommandCenterHub.jsx:149`, `:230`, `:488`; `PhoneTabs.jsx:25`, `:86`, `:133`; `hub/composition.js:118`, `:120`, `:121`; `hub/hubModel.js:56-58`, `:143`; `hub/useHubReaders.js:59`, `:114`, `:217`, `:231`; `hub/useHubBrief.js`; the `brief` block of `hubCopy.js`.
- Tests and baselines that name it: `useHubBrief.test.js`, `hubCopy.s4.guard.test.js`, the mount guard, `useHubReaders.integration` and `.s4.integration`, 11 `CommandCenterHub*.jsdom.test.jsx` files, and `src/theme/` motion and token guard files with their baselines.
- `src/hooks/useDailyRegimeBrief.js` stays: the legacy shells and AgentPresence read it.
- **This crosses the ≥10-file review threshold** (`docs/BUILD_RULES.md:41`).

**Shadow:** still no tap handler and no speaking state at HEAD (`ShadowCanvas.jsx:50`, `:55`, `:228`; `ShadowStage.jsx:119`; VERIFIED). No further.

### Q10 — Grading inputs

**Tick capture (VERIFIED).**
- **Per-check record:** `agentBattles/{id}/ticks/{id}:{tickSeq}`, permanent, ids and numbers only (`captureWriter.js:6-11`). Holds `decision`, `actions[]`, `checks`, `risk.verdicts`, `controls`, `scores`, `exitReason`, `stageReached`.
- **Rendered body:** `tickBodies/{same id}`, all text, `expireAt` = capture + 120 days (`captureConfig.js:108`), TTL field declared at `firestore.indexes.json:741-743`. Reads are server-side.
- **Coverage is by design incomplete.** Capture skips below 10 s of budget (`captureConfig.js:89`) and a timed-out write is unknown (`captureWriter.js:17-21`). Exit reasons are a closed list (`captureConfig.js:120-129`). `TICK_CAPTURE_ENABLED = true` (`featureFlags.js:2737`).
- **Compliance note:** `actions[]` carries `source` (`captureConfig.js:219-225`), so a forced exit by the risk manager is separable from a model swap. A line like "no swaps today" cannot stop a forced exit (`agentRiskManager.js:128-134`).

**Trade list (VERIFIED, PROD).**
- `trades` is capped at the newest 50 (`agentSwapExecution.js:498-499`). Past that, the oldest rows drop with no marker on the list.
- `scoreState.tradeCount` keeps counting (`:508`), so `tradeCount > trades.length` detects it. Rows carry `tradeCountAtDecision` (`agent-evaluate.js:4147-4148`).
- **PROD:** highest `tradeCount` in 70 battles is 5. None above 30.

**Film Tape price series (VERIFIED, PROD).**
- **Path:** `agentBattles/{id}/tape/{etDate}/series/{symbol}`.
- **Resolution:** 10-minute bars from 1-minute candles (`bars.js:41`, `:130-141`), regular session only.
- **When:** written by the **candle pass**, `0 11 * * 2-6`: **7:00 AM EDT, 6:00 AM EST the next morning**, up to three attempts inside 10 sessions (`api/cron/film-tape-candles.js:5-10`, `candlePass.js:7-16`). The close pass at `15 2 * * 2-6` writes no series.
- **Symbols:** held at any check, sold, bought, planned, SPY, RSP, sectors. "Crypto is out of scope" (`candlePass.js:40-42`). A name the agent never held or planned has no series.
- **Not every completed battle.** `isTieredBattle` admits BaggerBomb only (`writeTapeDay.js:47-48`, `:89`). Every other mode gets a `skipped_mode` stub with no series (`tapeAssemble.js:1507-1521`).
- **PROD, last 10 sessions:** League games 14 `skipped_mode`, 1 no document; BaggerBomb 9 written, 1 no document; 9 of 9 written tapes have a series. The two with no document are today's games, whose close pass has not run (INFERRED).
- **No other ranked price series is stored.** `tournamentPrices.js` is a live batch quote (`:1-13`). What ranked games do keep is per-check numbers for held names: `evaluations[].evidence.px`, on checks that built a prompt (`tickStamps.js:23-25`).

### Q11 — Measurement

**No analytics or event-logging module exists, client or server.** A grep for posthog, mixpanel, amplitude, gtag, `logEvent`, `trackEvent`, firebase analytics and Vercel analytics across `src/`, `api/` and `package.json` returns nothing but false matches on the word "plausible" (VERIFIED).

- The nearest thing is `api/_utils/shadowLogger.js`. It is fire-and-forget (`:1-4`), which `docs/BUILD_RULES.md:74` forbids for catalog events. `agentEvalRuns` is one cron's run record, not a player event store (VERIFIED).
- No listen, completion or confirmation event exists anywhere (INFERRED from the above).

### Q12 — Fence and pin manifest

See §4.

## 4. Fence and pin manifest (Q12)

**Columns.** *Fenced:* named in BUILD_RULES §1. *Flag-pinned:* a flag source, or read by `flagPinGuard`. *Other guard:* a static test that reds on a change. New file names are placeholders until the spec sets them. Every "yes" is a finding, not an authorization.

| File | New or touched | Fenced | Flag-pinned | Other guard | Why |
|---|---|---|---|---|---|
| New enqueue cron under `api/cron/` | new | no | no | store scan | 8:30 ET job list |
| New worker cron under `api/cron/` | new | no | no | store scan | Script, speech, record |
| New `api/_utils/huddle/*` (prompt, store, compose, sweep helper) | new | no | no | store scan; §2.3 ratchet if it imports an archetype table | Per-player logic |
| New apply route under `api/` | new | no | no | store scan | Owner, session, idempotency, receipts |
| New confirm and edit route(s) | new | no | no | store scan | Plan status and revision |
| New same-origin audio route | new | no | no | none found | `audio/mpeg` body |
| New measurement write | new | no | no | store scan; §5 if a catalog event | Listens, completions, confirmations |
| `api/cron/agent-evaluate.js` | touched | **no** | no | **yes:** `tickStamps.pins` (counted source pins), `tickCapture.flagOff`, `callRecords.offGolden`, `callRecords.rollback`, `goldenPath`, `p4Flips`, `p4Equivalence` | One flag-gated sweep call after `:1095` |
| `vercel.json` | touched | no | no | §6 count | Enqueue and worker entries, 44 → 46 |
| `docs/BUILD_RULES.md` §6 line | touched | no | no | founder-cited PR | Count line |
| `src/config/featureFlags.js` (or own module, the `agentFormFlags.js` precedent) | touched or new | no | **yes** | hub `NAMED` list if the hub reads it | `DRB_HUDDLE_ENABLED`, dark |
| `src/config/flagPinGuard.test.js` | touched | no | **yes** | — | `DARK_BY_DESIGN` entry; `FLAG_SOURCE_MODULES` if a new module |
| New flag pin test | new | no | **yes** | — | The tripwire pin |
| `firestore.rules` | touched | no | no | `test/rules/*` | New collections; default deny at `:1438-1441` means no client read without a rule |
| `firestore.indexes.json` | touched if needed | no | no | none found | Any composite index |
| New `test/rules/*` denial test | new | no | no | — | Client write denied |
| `api/_utils/compositionProtectedStoresAllowlist.json` | touched | no | no | **yes:** `compositionProtectedStores.scan.test.js` counts every write site | One key per new write site |
| `api/_utils/archetypeImportBoundaryBaseline.json` | touched if needed | no | no | **yes:** §2.3 ratchet | A new importer of an archetype table |
| `src/services/agentDeploy.js` or `src/contexts/DeployAttemptContext.jsx` | touched | no | no | deploy suites; hub guard terminal | Apply after a client deploy |
| New client service and hook outside the hub dir | new | no | no | hub guard | Hub cannot `fetch` itself |
| `src/components/CommandCenter/commandCenterHub.mount.guard.test.js` | touched | no | no | **yes** (it is the guard) | Permitted and `NAMED` entries; brief rows |
| `hub/useHubReaders.js`, `hub/hubModel.js`, `hub/hubCopy.js`, `panels/PartnershipPanel.jsx`, `panels/AreaPanel.jsx`, `CommandCenterHub.jsx`, `PhoneTabs.jsx`, `hub/composition.js` | touched | no | no | hub guard; `hubCopy.s4.guard` | Chip, Partnership home, brief removal |
| `sections/BriefSection.jsx`, `hub/useHubBrief.js` and test | removed | no | no | hub guard | Brief card goes |
| 11 `CommandCenterHub*.jsdom.test.jsx`, 2 reader integration tests | touched | no | no | `src/theme/` motion and token baselines | Brief rows |
| `.env.example` | touched | no | no | none found | `NEWSFILTER_*`; ElevenLabs name |
| `docs/design/20261029_DRB_HUDDLE_CONCEPT_V1_2.md`, `docs/README.md` | new, touched | no | no | none found | Carried in the first build PR |

**Fenced files S1 calls or feeds, and does not edit (VERIFIED).**
- `flattenPortfolioServer` (`agentScoring.js`) and `sanitizeRuleText` (`agentPromptAssembly.js:301`, cuts text at 200 characters) are callable exports.
- **Feeds `agentEvalPromptAssembly.js`:** the slot's text renders into the fenced prompt (`:1240-1246`).
- **Feeds `agentRiskManager.js`:** the preset's levers select fenced exits (`agent-evaluate.js:1982`).

**Findings (each a "yes", none authorized here).**
1. **No fenced file is edited.** Yet the composed instruction is a new class of content reaching a fenced assembler. `docs/BUILD_RULES.md:32` treated exactly that as fenced-review territory for one flag. The clause at `:26` does not name the assembler. Whether the flag flip needs fenced-file review is unresolved: **R-6 is met by file, not obviously by concept.**
2. **The preset write** would be the first server writer of a live risk input. It stays inside `:26` by the letter (the risk manager is unchanged), but it changes what a fenced module acts on.
3. **Receipts cannot go on the battle.** `applications[]` must live on the huddle record: new battle keys touch the fenced document shape (`file-directive.js:65-68`). The filing's own keys (`directive`, `chatExchanges`, `strategyPreset`) already exist.
4. **Flag-pin:** the only "yes" rows are the new flag's own, which is the normal path.
5. **`agent-evaluate.js` is unfenced but heavily pinned.** Its one line is the file most likely to red a suite.

## 5. Concept corrections

| V1.2 says | The repo says |
|---|---|
| "it reaches the agent at its next check" (§0); status "at its next check" (§2, §7) | It reaches the agent at the next check **that builds a prompt**. 73.6% did; the longest wait was 195 min; a directive wakes nothing (Q2, VERIFIED + PROD). A plan confirmed before the first check is read at it, because the first check is forced, unless a meeting, proposal or quote exit intervenes |
| "as **one composed instruction**" (§3) | Only allowlisted or code-templated text has ever entered this slot; the gate "never copies model free-text into a directive" (`directiveGate.js:4-12`). The renderer has no sanitizer or cap (Q2). Free text is new, not a re-use of a live path |
| "No protected file is touched." (§0) | True by file. See §4 finding 1 |
| "read from the preset config in S1" (§3) | Half the config is unused. Printing it would claim false effects: "sit out choppy regimes" is prompt text only (Q3) |
| "owner-writable today" (§3) | True by rule. No server writer; no live use in 30 sessions (70 of 70 balanced); the Master Spec planned to freeze it at lock (Q3) |
| "defensive" still trades (§3) | True, and it can also force an exit at the next check, which the card does not say (Q3) |
| "`heardAt` (first check whose capture shows the plan in the prompt)" (§3) | True for the instruction. Posture has no capture field; it is provable only from the 120-day body or a trade row (Q2) |
| "the next morning's generation clears any slot the expired plan wrote, so yesterday's instruction never rides into today" (§3) | Nothing to clear. Each battle is one session (170 of 170), and tomorrow's is a new document. A clear would be a write to completed battles (Q2) |
| "A plan **expires at the stock-session close** (R-9, also for battles holding crypto)" (§3) | At the agent, this already holds: no check runs after the close. Nothing marks the slot expired, and the chat voice still reads it until 8:00 PM on a crypto roster (Q5) |
| "`supersededAt` (a chat or cockpit directive replaced it)"; "the receipt says *superseded*" (§3) | The writer stamps `supersedes` only when the replaced slot is call-family (`directiveWriter.js:42-47`). A plan is ordinary, so a chat filing over it leaves no stamp. Detection must compare the slot's thread id to the plan's |
| "A chat or cockpit directive filed later replaces the plan's instruction" (§3) | True. The reverse also holds: applying a plan overwrites any earlier chat or cockpit directive, latest wins. A live cockpit command is protected only by the answer endpoint's own check (`directiveUtils.js:136-150`), not by the writer |
| "Both writes go through **one new server route**" (§3) | The sweep runs inside the evaluator, so it is a second writer. It needs the same rules without the route |
| "ranked, deployed from 7:00" (§3) | 7:00 in EDT, **6:00 in EST** from Nov 2; retries run to 10:50 EDT or 9:50 EST (Q4) |
| "every battle the player owns", "both games" (§0, §9) | Three kinds share an `ownerId`: ranked agent, casual clone, training clone (Q7). "Both" undercounts |
| "the existing persisted-cursor queue pattern" (§6) | It exists, in the call sweep, which makes no model call and has no claim or attempt cap. Claim, lease and the attempt cap live in the reflection job, which has no cursor. A huddle job needs parts of both (Q6) |
| "newsfilter.io query by `symbols`, since prior close, paginated" (§2, §6) | No client, key or env name anywhere (Q7) |
| "EODHD news and daily sentiment per ticker" (§2, §6) | `/news` is used. `/sentiments` has never been called (Q7) |
| "stored: audio in storage" (§6) | No server media storage exists. Firebase Storage has no server setup and no rules; the GCS bucket holds logs (Q8) |
| "**Worked** (outcome): from the Film Tape price series" (§5) | BaggerBomb only; no ranked or crypto series; none for a name not held, traded or planned (Q10) |
| "At the close the plan is graded" (§0); "grading in an evening job" (§9) | The series lands at 6:00 or 7:00 AM ET the next morning, so an evening job has no prices. It still lands before 8:30 (Q10) |
| "holdings across the player's active battles" (§2) | At 8:30 a BaggerBomb is usually not deployed, and yesterday's games are completed, not active (Q7) |

**Checked and correct:** the fence status of the sweep's home; one-session plans; same-origin audio; pre-market exclusion in Film Tape; the 50-entry cap; the brief cron's DST drift (`vercel.json:180-183`); no ElevenLabs timestamps or dialogue code.

## 6. Founder questions

**Q1. Free text in the instruction slot, or fixed templates?**
- Today only pre-approved sentences reach the agent, and the composed instruction would break that. A player's edit box (R-5) would type directly into the trading prompt.
- **Recommendation: templates.** Lines and leans are built by code from fixed shapes with checked values (ticker, level, stance), the way cockpit commands are. Editing means changing those values or removing a line, not typing freely. It keeps the rule that protects archetypes and answers the fence question in §4.

**Q2. Should the server write the posture at all in S1?**
- It would be the first automated writer of a live risk setting. A switch can force a sale at the next check, no game has run non-balanced in 30 sessions, it leaves no receipt, and an older spec planned to lock this setting at deploy.
- **Recommendation: defer the write.** S1 carries posture as words inside the instruction. Reopen it once receipts have run for two weeks, with the card printing only the four real effects.

**Q3. What does "worked" mean for ranked games, and when is the grade computed?**
- Ranked games have no stored price series.
- **Recommendation:** grade after the morning price pass, before the 8:30 job. Show ranked "worked" as `?` until a ranked series exists, and task that series separately. Do not build a second price store for grading.

**Q4. When a plan meets a live instruction, which wins, and does a plan cost chat budget?**
- **Recommendation:** a plan replaces an earlier chat line (latest wins), but never displaces a live cockpit command; it waits and shows *pending*. A plan charges no chat budget.

**Q5. Does the old brief keep running after its card goes?**
- The chat voice and two Forge tools still read it, and each falls back without it.
- **Recommendation: keep the producer** until the Huddle is on. Retire it as its own task.

## 7. What I could not verify, and what would settle it

| Unverified | Why | What settles it |
|---|---|---|
| Whether Live v2 or `/real-time/` returns a pre-market print at 8:30 | The no-spend rule; the repo records only after-hours behaviour | One founder-approved call on one ticker at 8:30 ET |
| newsfilter.io plan, key and rate limits | No trace in the repo or env | The newsfilter account |
| ElevenLabs tier, credit multiplier and timestamp output on the chosen model | Account facts; no call allowed | The ElevenLabs account |
| Whether a Firebase Storage bucket exists with usable rules | Name present on Vercel; bucket not opened; no rules file | Firebase console |
| GCS lifecycle rules on `fantasytrades` | Not opened | GCS bucket settings |
| Whether a phone browser plays audio from a serverless route without byte-range support | Not testable here; a known Safari concern (INFERRED) | One iPhone test on a preview |
| Whether the 120-day TTL policy is live on `tickBodies` | Declared in the indexes file; deployed state not read | Firestore TTL console |
| Whether the deployed Firestore rules match `firestore.rules` | Deployed by hand (inherited from the DRB report) | Firebase console rules history |
| How the agent responds to a long composed instruction | No ordinary directive in 30 sessions; nothing to measure | A preview run, then receipts |
| Whether the Master Spec's preset freeze is still the plan | A document, not code | Founder ruling (Q2) |
| Whether ranked and training pods split the "League" counts | This read used `groupId` only | One count with the training marker |
| Production sample size | 3 owners, 25 battles in 10 sessions: real but thin | More sessions |
