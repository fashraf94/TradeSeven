# Phase 0 — Reflection outage root cause (read-only)

**Date:** 10 Oct 2026 · **Session:** Claude Code (Fable 5.1) · **Branch:** `claude/reflection-outage-phase0` · **HEAD:** `a06c2a75` (the #951 merge of `claude/practice-field-phase0`) · **Status:** discovery only — nothing under `api/`, `src/`, `scripts/`, rules, indexes or flags was edited; no Firestore write; no PR; hard STOP after this report.
**Rests on:** the founder ruling sheet, Practice Field V1.1 (`docs/design/20261010_FOUNDER_RULING_SHEET_PRACTICE_FIELD_V1_1.md`, ruling 1 and Part 3 item 1), and the Practice Field discovery (`docs/audits/20261010_PHASE0_PRACTICE_FIELD_DISCOVERY.md` §Q9, §Q6 routes 1, 10, 11).

Every `file:line` below was read at HEAD `a06c2a75` in this session unless marked ASSUMED. Agent-generated and player text is described, never quoted. No uid, agent id or battle id appears in this report; paragraphs are named by the first eight hex characters of the SHA-256 of their text, as the discovery did.

---

## 0. Gate facts (BUILD_RULES §2 / §3)

- `git fetch origin` ran first. `origin/main` = `a06c2a75`; `origin/claude/practice-field-phase0` = `13373aae`.
- **The prompt's base branch is already merged.** `13373aae` is an ancestor of `origin/main` (PR #951 merged it; `a06c2a75` has parents `93953d62` and `13373aae`), and `git diff --stat 13373aae a06c2a75` is empty: the two trees are byte-identical. The prompt's check `git diff --stat origin/main...origin/claude/practice-field-phase0` is therefore empty — nothing outside `docs/` differs, so no STOP. This branch was cut from the identical tree at `a06c2a75` (the app's worktree branch carries a suffix; it is pushed by refspec as `claude/reflection-outage-phase0`, BUILD_RULES §2 "cut fresh from current main" satisfied by construction). Tree clean at start.
- **Firestore access:** read-only, through the same path the Practice Field census used (`FIREBASE_ADMIN_CREDENTIALS` parsed from the primary checkout's `.env.local`; the value was never printed; this worktree has no `.env.local`). Four scripts ran from the session scratchpad, never inside the tree, each gated in the same shell command on the replay report's §7 proof grep `\.(set|update|delete|add|create)\s*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete` → **no matches (exit 1) on every run**; one qualification for honesty: the window-reconstruction script was run a second time, unchanged, to capture output that had scrolled past, with the grep in the preceding gated command rather than in that one. The Admin SDK was used for `.collection / .doc / .where / .select / .get / .getAll` only. Run windows (UTC, 2026-10-10): census 21:32, status addendum 21:36, reproduction 21:41–21:44 (three calls) and 21:47 (one call), window reconstruction 21:47. Counts only were printed.
- **Model calls: 4 of the allowed 6**, all reproductions of the production reflection request for already-completed battles, nothing written back, no usage-limit error. **Spend: $0.1501** at list price (17,944 input tokens, 6,419 output tokens, `claude-sonnet-4-6` at $3 / $15 per million). The reproduction script's only departure from the literal `reflect.js` call expression is a bound reference to `messages.create` so the proof grep stays mechanical; the request body is the `reflect.js:215-227` shape unchanged.
- **Writes on this branch:** the ruling sheet, byte-identical (SHA-256 `aa0940e6c49e88ae1f69f8252a5d22489eb3d6d6274e883cbdd0ec3ca9da5111`, `cmp` clean against the founder's file); this report; two rows in `docs/README.md`. An out-of-tree copy of this report sits in the session scratchpad (BUILD_RULES §3).

---

## 1. In plain terms

**Why the calls fail.** After every finished game the agent is asked to write a short lesson about how it played, and in the same request it is also asked to fill in a nine-part review of the game's design. That one request is given **30 seconds** to come back (`api/agent/reflect.js:228`). A tournament game now produces a long answer, about 1,400 to 1,950 words' worth of tokens, and the model takes **32 to 39 seconds** to write it. I re-sent four real, already-finished games through the identical request: all four came back complete and valid, and all four came back after the 30-second deadline (§R1). In production the deadline fires first, the code treats that as a failure, writes the literal line *Reflection generation failed.* into the agent's memory as if it were a lesson, marks the game as done, and never tries again. The model call itself keeps running and is paid for; its answer is thrown away.

**How long.** The 30-second ceiling has been in the code since the reflection feature was built on 1 April 2026. The answers grew past it in **the week of 13 July 2026**: on 15 July the evaluation cron was given a much wider time budget, so every tournament game started producing a full day of evaluations with a hypothesis on each, and the reflection has had more to grade ever since. The permanent record (a feedback document is written only when a reflection succeeds) shows the cliff: through early July almost every reflection succeeded; since then **128 of 172** have failed, and **41 of 44** in the last 30 days. A separate, closed outage happened in the week of 15 June, when the previous model was retired and every call returned "not found" until the 17 June fix. On 8 October the shared API key's spending limit also refused calls, but the games from that day fail on timing alone when replayed today, so the limit cannot be separated from the main cause.

**What players see.** The agent record sheet shows each of the last five games with its lesson underneath, so a player opens it and reads *Reflection generation failed.* five times (§R5). Every fifth game the agent's lessons are "consolidated" into a first-person paragraph of strategic wisdom; both of the paragraphs that exist today were written from windows of five failed lessons, and six of the seven distinct paragraphs in the database say, in the agent's own voice, that most of its reflections failed. That paragraph is shown verbatim on the record sheet under "Strategic insight", it is copied into every training and casual clone (11 of 15 clones carry one), it is frozen into each new battle, and it is read by the trading brain and by the chat voice before every answer. Nothing is stuck in a queue; the system believes it has finished every reflection.

**The smallest fix** (sized in §3, none of it touches a fenced file): (1) stop writing the failure line as a lesson — a failed reflection leaves the game pending and the existing 15-minute cron retries it, with a cap; (2) make the request fit its budget — either give it more time (the cron has 50 seconds per tick, and the evaluation cron already runs at a 300-second ceiling) or ask for less, the obvious cut being the game-design review, which is most of the answer and which nothing in the product reads; (3) check that the answer was not cut off at the token ceiling (one reproduction came within 103 tokens of it); (4) write down why a reflection failed, so the next outage is diagnosable from the record instead of by re-running it. The consolidation filter and the reset of the existing paragraphs are separate steps; the reset waits per ruling 2.

---

## 2. Answers R1–R7

### R1. Root cause

**The call.** `generateReflection` (`api/agent/reflect.js:48`) reads the battle and agent docs and calls `callSonnetReflection` (`:99`, `:208-245`): `anthropic.messages.create` with model `claude-sonnet-4-6` (`:216`), `max_tokens: 2048` (`:217`), `temperature: 0.3` (`:218`), `thinking: { type: 'disabled' }` and `output_config: { effort: 'low' }` (`:221-222`), a forced tool call to `submit_reflection` (`:225-226`), raced against `setTimeout(…, 30_000)` rejecting with "Sonnet reflection timeout (30s)" (`:228`). The client is `new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 })` (`:34`). The response is parsed at `:232-242`: the first `tool_use` block's `input` must exist and carry both `selfReflection` and `gameDesignFeedback`, else it throws; `stop_reason` is never read. Any throw lands in the catch at `:100-112`, which substitutes the fallback object (`lesson: 'Reflection generation failed.'`, `:105`).

**Reproduction (VERIFIED, 4 calls, Saturday 2026-10-10 21:41–21:47 UTC, no concurrent cron traffic).** The identical request body was sent for the three most recent battles whose stored reflection is the fallback line, plus one control battle chosen for a low hypothesis count, without the 30-second race so the full outcome could be measured:

| # | Entry date | Mode | Evaluations | Hypotheses in prompt | Prompt chars (user / system) | Outcome | Elapsed | Input / output tokens | Tool call | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-10-09 | tournament, fullday | 17 | 8 | 8,230 / 585 | **valid** (`stop_reason: tool_use`, both keys present, 9 feedback keys, 5 grades) | **33.3 s** | 4,433 / 1,468 | 1 `tool_use` block | $0.035 |
| 2 | 2026-10-09 | tournament, fullday | 17 | 8 | 9,128 / 585 | **valid** (8 grades) | **39.5 s** | 4,672 / **1,945** | 1 block | $0.043 |
| 3 | 2026-10-09 | tournament, fullday | 18 | 7 | 8,116 / 585 | **valid** (7 grades) | **32.3 s** | 4,360 / 1,606 | 1 block | $0.037 |
| 4 (control) | 2026-10-08 | tournament, fullday | 17 | **3** | 8,578 / 585 | **valid** (3 grades) | **32.2 s** | 4,479 / 1,400 | 1 block | $0.034 |

Every response echoed `model: claude-sonnet-4-6` on HTTP 200, so the model id is accepted by the provider today (the `claude-api` skill's model table, cached 2026-10-06, lists it as current; the 44 successes since 17 June prove the same). No HTTP error, no refusal, no parse failure, no truncation: the failure class in production is **the client-side 30-second race winning against a 32–39-second response**. The elapsed times imply roughly 45–50 output tokens per second including time-to-first-token; 30 seconds therefore fits about 1,300–1,450 output tokens, and every reproduced tournament reflection produced 1,400 or more. The elapsed times were measured from a home machine and include client network and TLS overhead a Vercel lambda would not pay; that can only move the production margin by fractions of a second to a second or two, which makes the 32-second calls borderline and the 39-second ones hopeless — consistent with 3 successes in the last 44 rather than none. The control shows the dominant class covers even a 3-hypothesis tournament battle: the nine-key game-design section (`agentReflectionUtils.js:56-136`: six categories each with a rating and an observation of up to 100 words plus an optional suggestion, two free-text mechanics fields, one boolean) is the larger part of the output regardless of hypothesis count, and `hypothesisGrades` (`:34-49`, the hypothesis text echoed plus a reason per grade) adds to it.

**A second, rarer class is one token away.** Call 2 emitted 1,945 of the 2,048-token ceiling (`reflect.js:217`). A battle with nine or ten hypotheses (the census shows prompts with up to 10) can cross it; the SDK then returns `stop_reason: max_tokens` with the tool input absent or partial, `:232-242` throws, and the same fallback is written. The code never reads `stop_reason`, so this class is indistinguishable from the timeout in today's records. Not reproduced (budget), but the margin is measured.

**What differs between success and failure (CENSUS of the 87 memory entries and their 87 battle docs; all found).**

| | Failed (72 entries, 66 distinct battles) | Succeeded (15 entries) |
|---|---|---|
| Game mode | tournament 63 · agent 9 | agent 12 · tournament 3 |
| Evaluations on the battle (median, range) | 17 (2–26) | 3 (0–22) |
| Hypotheses in the reflection prompt (median, range) | 8 (0–10) | 3 (0–8) |
| Trades / status-feed entries (median) | 2 / 30 | 1 / 8 |
| User prompt size (median, range, chars) | 8,410 (5,180–10,726) | 5,864 (3,560–8,693) |
| Entry dates | 2026-07-10 → 2026-10-09 | 2026-05-02 → 2026-10-07 |
| Result | 28 wins · 44 losses | 7 wins · 4 losses · 4 draws |
| Archetype (failed / ok) | momentum_chaser 21/1 · guardian 14/4 · contrarian 12/4 · diversifier 12/4 · analyst 9/1 · degen 4/1 | |
| Caller | all 72 via the pending-reflections cron (every entry is dated after the 2 May cron split, `6fe210cb0`) | 2 before 17 June, 13 after |
| Delay from completion to reflection (median) | 15 min | 2 min |

Successes are short BaggerBomb agent battles with few evaluations and therefore little to grade; the two tournament successes with 7–8 hypotheses (16 July, 21 August) show the race is close rather than impossible. One failure on 14 July had zero hypotheses and a 6,057-character prompt, a near-twin of the 13 July success: size is dominant, not the whole story (a top-of-the-hour collision is the other candidate, below). The 72 entries reference 66 distinct battles because the casual-clone re-sync copies the parent's memory window onto the clone (`api/_utils/casualClone.js:93-98`).

**When it started (VERIFIED from the permanent record).** A game-design-feedback document is written only when the model call succeeded (`reflect.js:145-151`, `:367`), so for every completed non-CPU battle with a `reflectedAt` stamp (`process-pending-reflections.js:94-97`) the absence of that document means the fallback was written. Weekly, by completion date:

| Week of | Reflected | Succeeded | Failed |
|---|---|---|---|
| 2026-04-27 → 05-18 | 8 | 8 | 0 |
| 2026-05-25 | 1 | 0 | 1 |
| 2026-06-01, 06-08 | 7 | 7 | 0 |
| **2026-06-15** | 2 | 0 | 2 — `claude-sonnet-4-20250514` retired 15 June; every call 404'd until `5e67aad49` (17 June) moved the three agent-brain sites to `claude-sonnet-4-6` |
| 2026-06-22 | 10 | 5 | 5 |
| 2026-06-29 | 11 | 8 | 3 |
| 2026-07-06 | 16 | 13 | 3 |
| **2026-07-13** | 17 | 7 | 10 |
| 2026-07-20 | 11 | 1 | 10 |
| 2026-07-27 | 12 | 0 | 12 |
| 2026-08-03 | 11 | 5 | 6 |
| 2026-08-10 → 08-31 | 36 | 1 | 35 |
| 2026-09-07 → 09-28 | 26 | 2 | 24 |
| 2026-10-05 | 21 | 2 | 19 |
| **Since 17 June** | **172** | **44** | **128** |
| **Last 30 days** | **44** | **3** | **41** |

25 completed battles carry no `pendingReflection` at all and no reflection record: 19 non-CPU (11 completed before the 2 May cron split, in the fire-and-forget era the cron header describes, `process-pending-reflections.js:4-9`; 8 after it, in the weeks of 4 May, 18 May, 29 June, 20 July, 27 July and 3 August) and 6 CPU, which never reflect. The missing flag is not a date marker: every cron completion writes it, true or false, so a completed battle without it was finished elsewhere — the evaluator's repair transaction names the fenced `decide.js` expiry GC as that writer and uses the absence as its discriminator (`agent-evaluate.js:6618-6659`). Zero battles are pending today.

The 30-second race and the 2,048 ceiling date from the feature's first commit (`git blame reflect.js:217,228` → `5584cdf64`, 2026-04-01). What changed in mid-July is the input: `e43c7f158` (2026-07-15, "fair-rotation ordering + wider budget") raised the evaluation cron's ceiling from 60 to 300 seconds because "only ~1 battle per tick ever cleared" the budget guard and starved battles "defaulted to HOLD"; a starved tick leaves an evaluation entry with no hypothesis, a real tick carries the Haiku hypothesis (`agent-evaluate.js:3616`, `:3975`, `:4129` versus the `hypothesis: null` sites at `:2000`, `:5738`). After that commit every tournament battle carries a full day of evaluations with hypotheses, and the reflection output crossed the budget. The causal link between the commit and the cliff is ASSUMED from the dates and the field; the dates, the field and the cliff are VERIFIED. Whether Sonnet 4.6 at low effort is slower than the retired Sonnet 4 is not knowable from records (the 17 June commit message says the pin was meant to "preserve the prior latency profile").

**What the quiet-Saturday reproduction cannot show.** `agent-evaluate` and `process-pending-reflections` fire on the same `*/15` minute (`vercel.json:157-158`, `:201-202`); the median reflection runs 15 minutes after completion and many run within a minute of it, so reflections share the key with the evaluator's own calls. A 429 or 529 at that moment is retried by the SDK (`maxRetries: 2`, `reflect.js:34`, backoff inside the same 30-second race), which makes the deadline harder to meet. That contention class is plausible, not measured.

### R2. Evidence left behind

- **Console only.** The error message goes to `console.error` (`reflect.js:101`) and the consolidation driver's to `:192-195` / `agentConsolidationApply.js:357`. Those lines live in Vercel runtime logs; no retention setting or log sink is in the repo (not found).
- **Shadow stream.** `logReflection` (`reflect.js:115-130`) writes one JSONL line per reflection to `shadow/reflections/<date>/<id>.jsonl` in the `fantasytrades` GCS bucket (`api/_utils/shadowLogger.js:18`, `:51-53`, `:73`). Its fields are the battle, agent and owner ids, archetype, game mode, scores, the turn, trade and evaluation counts, and the `selfReflection` object — which on failure is the fallback object itself — plus `gameDesignFeedback: null`. **No error message, status, elapsed time, stop reason or usage is recorded.** The stream is disabled when `GCS_CREDENTIALS` is unset (`:25-27`), its write errors are swallowed (`:63-66`), and the call is fire-and-forget (`reflect.js:130`). The consolidation stream is better: a failed call logs `reason`, `error: err.message` and `durationMs` (`agentConsolidationApply.js:358-364`, `:371-377`, `:385-392`). The stream was not read (outside the allowed access path); whether production sets `GCS_CREDENTIALS` is not verifiable here.
- **Battle doc.** `reflectedAt` is stamped and `pendingReflection` cleared on every non-throwing return (`process-pending-reflections.js:94-97`); no outcome field exists. The only durable trace of a failure is the absence of a `gameDesignFeedback` document for a reflected battle (`reflect.js:145-151`) — an inference, not a record, and one that will vanish if the game-design half of the call is dropped.
- **Agent doc.** The fallback entry in `memory[]` (`reflect.js:255-271`), rolling, five deep.

**What would have to be recorded** for the next failure to be diagnosable without a reproduction: on the battle (and mirrored into the shadow line) an outcome record for each attempt — `outcome` (ok / failed), a `failureClass` from a fixed vocabulary (`timeout`, `max_tokens`, `no_tool_use`, `missing_keys`, `http_<status>` with the API error type, `connection`), `errorName`, `elapsedMs`, `stopReason`, `usage` (input / output tokens), `model`, `attempt` and `at`. The evaluator already keeps such a vocabulary (`agent-evaluate.js:2697`: `timeout | build_timeout | truncated_response | budget_skipped | …`) and is the pattern to copy. Today's four reproductions would have read `timeout` four times.

### R3. Failure handling as built

| Claim | Verdict | Anchors |
|---|---|---|
| The fallback is saved as an ordinary memory entry | **CONFIRMED** | catch → fallback object `reflect.js:100-112`; `buildMemoryEntry` gives it a `gameId`, `result`, `score`, `date` like any entry `:255-271`; written into the rolling window `:274-282` (plain) or `:289-296` (casual forward, transactional) |
| The pending flag is cleared with the fallback in place | **CONFIRMED** | `generateReflection` resolves normally `:203`; the cron clears the flag and stamps `reflectedAt` on any non-throwing return `process-pending-reflections.js:85-100`; its own comment states the fallback-and-clear as "the desired idempotent behavior" `:88-93` |
| Nothing retries | **CONFIRMED at the application level, CORRECTED at the transport level.** The cron retries only when `generateReflection` throws (`:101-106`), which the catch at `reflect.js:100` prevents. Inside the call, the SDK retries 408/409/429/5xx and connection errors up to twice (`maxRetries: 2`, `:34`), within the same 30-second race. The race does not abort the HTTP request (no abort signal is passed): the abandoned request completes, is billed, and its answer is discarded. | |
| The consolidation prompt formats fallback entries in with real ones | **CONFIRMED** | `formatMemory` renders every entry as a game header plus `Lesson:` and `Adjustment:` lines with no filter (`agentConsolidationPrompt.js:270-292`, `:285-286`); the window is substituted into the locked template at `{{agent.memory}}` (`:136-137`, `:194-198`) |
| A failed consolidation writes nothing | **CORRECTED** | The insight and disciplines are not written on a failed call, a missing tool call or a validation failure (`agentConsolidationApply.js:356-366`, `:368-379`, `:383-394`). But two writes precede the call and survive it: the milestone claim stamps `lastConsolidatedGamesPlayed` (`reflect.js:176-178`, `:305-313`; live because `CASUAL_CLONE_CONCURRENCY_ENABLED = true`, `src/config/featureFlags.js:237`), so that milestone can never consolidate again, and `pendingConsolidation: true` is written at `:182`. The comment at `:188-191` says "the next 5-game gate will retry"; the next gate is a new milestone, not a retry of this one, and `pendingConsolidation` is read by nothing (grep: only writers, `reflect.js:182`, `agentConsolidationApply.js:276`, `:307`, the two clone builders). Two agents carry `pendingConsolidation: true` today. |

**A gate fact that frames all of this.** Tournament completions set `pendingReflection` but `updateAgentStats: false` (`api/cron/agent-evaluate.js:6577-6588`, gate at `:6697`), so `gamesPlayed` never moves on a tournament battle and the `gamesPlayed % 5` consolidation gate (`reflect.js:169`) is unreachable for a tournament-only agent. That is why 89 of 99 agents sit at zero games played while 25 hold memory windows, and why only two agents have ever consolidated (eleven events in total, §R4).

### R4. Blast radius (counts only, read 2026-10-10 21:32–21:47 UTC)

- **Agents holding fallback entries: 19** of 99 agents (25 hold any memory; 12 hold only fallbacks; 13 hold at least one real entry). 87 entries: 72 fallback, 15 real.
- **Distinct learned paragraphs: 7**, held by 14 agents. One is the two-character string `""` on one agent (the discovery's finding, reconfirmed). **6 of 7 name the failure in their own words** (the text contains "reflection" and "fail"); those six sit on **13 agents: 2 non-clones and 11 clones**. One text is shared across two archetypes (five holders: one non-clone and four clones).
- **Shown to have been built from windows that included fallback entries.** By the memory window's dates: 0 — every non-clone holder's window has rolled past its last consolidation. By the permanent battle record (for each consolidation event, the five battles of the agent and its clones reflected before the event timestamp, checked against the feedback docs): **11 consolidation events exist on two non-clone agents (cycles 1–8 on one, 1–3 on the other); 10 of 11 windows contained at least one failed reflection; both current paragraphs (`5ebd5208`, cycle 8, week of 13 July; `83b35595`, cycle 3, week of 21 September) were built from windows of five failures out of five.** The four other failure-naming texts are clone-held copies of superseded parent paragraphs; which event produced which text is not recorded (the timeline keeps headline and narrative, not the insight text).
- **Live battles that froze such a paragraph: 1** — the only battle with status `active` at read time (a Saturday), on one agent. Historically, 110 of the 139 completed battles that froze any insight froze one of the six failure-naming texts. The discovery's "57 of 162 alive" used a liveness definition this read did not reproduce; the definition here is status `active`.
- **Clones carrying one: 11** of 15 clones.
- Also: 2 agents with `pendingConsolidation: true`; 13 agents with `evolutionCycle > 0` (inherited by clones, `trainingClone.js:75`); the last consolidation event is in the week of 21 September.

### R5. What players see

| Surface | Reads | Shows the failure line or its summary today? | Anchor |
|---|---|---|---|
| Agent record sheet, "Strategic insight" | `agent.consolidatedInsight` | **Yes, verbatim** — the paragraph that says most reflections failed, in italics | `src/components/Dashboard/AgentRecordSheet.jsx:253-256`; opened from `CommandDashboard.jsx:610` and `CommandDashboardDesktop.jsx:343` |
| Agent record sheet, evolution timeline rows | `agent.memory[]` → one game event per entry, `subtitle: m.lesson` | **Yes, verbatim** — *Reflection generation failed.* under each failed game, two-line clamp | `src/utils/evolutionTimeline.js:141-153`; rendered `AgentRecordSheet.jsx:97-106` |
| Agent record sheet, legacy cycle rows | first 80 chars of `consolidatedInsight` | only when `evolutionCycle` exceeds the number of real events — true for clones, which inherit the cycle but not the timeline (`trainingClone.js:59-74`); those rows stay off the live sheet because ranked owner lookups exclude clones (`trainingClone.js:106`, `:128`), and the two non-clone holders' event counts (8 and 3) match their cycles | `evolutionTimeline.js:120-121` |
| Evolution preview card (dashboard) | the same timeline, titles only | No — title is mode, result and score; no lesson text | `src/components/Dashboard/EvolutionPreviewCard.jsx:22`, `:44` |
| Agent "speech" line | `agent.memory[last].lesson` | Built (`src/hooks/useAgent.js:79-81`) but consumed only by `*.ARCHIVED.jsx` components (grep) — not live | |
| Chat voice, opener, trade narration, anticipation, workshop | `agent.consolidatedInsight` as "YOUR ACCUMULATED WISDOM" in the model prompt | **Indirectly** — the player-facing text is conditioned on the paragraph; whether the model repeats it is not recorded | `api/_utils/voiceLayerPrompt.js:1093-1097`; callers `:2909`, `:2973`, `:3033`, `:3081`, `:3208`, `:3498`, `:3759`, `:3985`; endpoints `api/agent/chat.js`, `ensure-opener.js`, `api/cron/agent-batch-review.js`, `voice-layer-cache.js`, `api/forge/*` |
| Tournament agent boards | `consolidatedInsight` as "STRATEGIC WISDOM" in the board prompt | Indirectly, via the board text shown in the draft theater and training battle view | `api/_utils/tournamentAgentBoards.js:161-162` → `api/tournament/produce-agent-boards.js:22` → `src/components/Tournament/DraftPlaybackTheater.jsx`, `src/screens/LeagueTrainingBattleView.jsx` |
| Trading brain | frozen `agentContext.consolidatedInsight` as "YOUR STRATEGIC WISDOM" / draft "STRATEGIC WISDOM" | Indirectly, through the agent's rationales in feeds | **F** `api/_utils/agentEvalPromptAssembly.js:775-777`; **F** `agentPromptAssembly.js:84-86`; frozen at **F** `agentBattleService.js:232` |
| The wire | the whole agent doc | the owner's client receives `memory[]`, `consolidatedInsight` and `disciplines` (owner-only read) | `firestore.rules:224` |
| Non-owner battle view | — | No — `consolidatedInsight` is excluded from the projection | `api/_utils/tournamentBattleView.js:42` |

`disciplines` reach no screen as text: the record sheet shows only their counts (`AgentRecordSheet.jsx:141-145`); the only readers are the three consolidation files and `reflect.js` (discovery Q6 route 11, reconfirmed by grep).

### R6. Fix options (no code)

None of the files an outage fix touches is in the BUILD_RULES §1 fence list (`reflect.js`, `process-pending-reflections.js`, `agentReflectionUtils.js`, `agentConsolidationApply.js`, `agentConsolidationPrompt.js`, `evolutionTimeline.js`, `AgentRecordSheet.jsx` — grep of `docs/BUILD_RULES.md` finds none). The fenced files near this path are read-only for every option: `agentBattleService.js:232` (the freeze) and the two prompt assemblers (§R5).

**(a) A failed reflection is never saved as a lesson, stays pending, and retries through the existing cron with a cap.**
- *What it touches.* `reflect.js:98-112` (the catch no longer substitutes a lesson; it returns a structured failure or rethrows), `:134-142` (no memory write on failure), `process-pending-reflections.js:85-107` (count attempts on the battle, e.g. `reflectionAttempts`; leave the flag true on failure; after the cap, mark the battle per option b and clear the flag so it leaves the queue). The queue reads oldest-first with a batch of five (`:54-60`, index `firestore.indexes.json:227-235`); without the cap a permanently failing battle would head the queue every tick, so the cap is part of the option, not an extra.
- *The retry alone would fail the same way.* Four of four reproductions exceed the 30-second race; a retry with a cap of N fails N times per tournament battle. The option only works together with a request that fits its budget: raise the race (the cron's budget is 50 seconds per tick with `maxDuration: 60`, `process-pending-reflections.js:34`, `:37`; one 40-second reflection per tick, or `maxDuration: 300` as `e43c7f158` did for the evaluator), and/or shrink the output (drop the game-design half, which nothing reads — founder decision 1 in §4; or cap the grades), and raise `max_tokens` from 2,048 to something that cannot be hit by a ten-hypothesis battle, and read `stop_reason` at `:232` so a `max_tokens` cut is named rather than parsed. Record the outcome per §R2 in the same change.
- *Tests.* `process-pending-reflections.test.js` mocks `generateReflection` (`:31-32`): new rows for failure-leaves-flag-and-increments, cap-reached-marks-and-clears, success-clears, and a budget row (one slow reflection does not starve the Wire sweep tenant, `:117-127`). `reflect.js` has no unit test of `generateReflection` (only `reflect.claimConsolidation.test.js`); add one with the SDK mocked: timeout → no memory write, no feedback write, structured failure; `max_tokens` → named failure; valid → unchanged writes. Each row mutation-checked (BUILD_RULES §2).

**(b) An honest "no reflection for this game" state after the cap.**
- *What it touches.* The battle gets an outcome field (§R2) and no memory entry. The record-sheet timeline builds game rows from `memory[]` only (`evolutionTimeline.js:141-153`), so a game without an entry simply disappears from the timeline; an honest row needs either a memory entry with `lesson: null` and an `outcome` marker (then `formatMemory` must skip it, option c) or a timeline that also reads the battle outcome. Touches `reflect.js`, `evolutionTimeline.js`, `AgentRecordSheet.jsx:97-106` (render the state), and the copy for the state. Not fenced.
- *Tests.* `evolutionTimeline` unit rows (a marked entry renders the state, never a lesson); a record-sheet render test.

**(c) Consolidation ignores failure entries and does not run on a window with fewer than N real reflections.**
- *What it touches.* The filter can live in `formatMemory` (`agentConsolidationPrompt.js:270`) or in the driver before `buildConsolidationPrompt` (`agentConsolidationApply.js:334`), leaving the locked template (`:14-172`, "DO NOT MODIFY", `:3-6`) untouched. The floor `realEntries >= N` (N a founder slot) goes at the gate in `reflect.js:169-198` or as a driver return `{ success: false, reason: 'insufficient_real_reflections' }`; either way the two pre-call writes (`:176-182`) must move after the check, or a skipped window burns its milestone (§R3). The game-number arithmetic in `formatMemory` (`:331-339`) assumes the window is contiguous; a filtered window needs the numbering derived from entries, not from position.
- *Tests.* `agentConsolidationPrompt.test.js` (`formatMemory` rows: fallback entries excluded, numbering holds), `agentConsolidationApply.test.js` (driver returns the new reason, writes nothing, stamps nothing), a `reflect.js` gate row (below N → no claim, no flag).

**(d) What a reset of the existing paragraphs at a week boundary would touch. Not done — ruling 2.**
- *Data.* `consolidatedInsight` and `disciplines` on the 14 holding agents (the apply writes both together, `agentConsolidationApply.js:271-273`); the 72 fallback entries in `memory[]` on 19 agents; `pendingConsolidation` on 2 agents; `lastConsolidatedGamesPlayed` on 2 agents; `evolutionCycle` and the 11 `evolutionTimeline` events (which the record sheet shows as history — a decision whether they stay); the 11 clones' copies (the casual re-sync re-copies the parent's insight, disciplines, cycle and memory at the next deploy, `casualClone.js:93-98`, so a reset must cover parents and clones together or rely on re-sync). Frozen copies on completed battles are history and stay; the one active battle keeps its frozen copy until it completes.
- *Code.* None in product: a one-off script under `scripts/` with the §7 proof discipline inverted (it writes), a dry run, and a before/after census. The trading prompt then omits the block (`agentEvalPromptAssembly.js:775` is conditional). Depends on scoring the 29 changed moments first (ruling 2).

### R7. Archetype carry-over (ruling 5) — its own package

**"Shelve on archetype change, restore on return."**
- *Writer.* `api/agent/change-archetype.js` commits `archetype`, the re-seeded `equippedTraits`, the birth provenance and the dial reset in one `txUpdateAgentSettings` (`:253-262`); it never references `consolidatedInsight`, `memory` or `disciplines` (grep, reconfirmed). The shelve adds, in the same transaction, a move of the learning set into a per-archetype shelf on the agent doc — `consolidatedInsight`, `disciplines`, `memory[]`, `evolutionCycle`, `lastConsolidatedGamesPlayed`, `pendingConsolidation`, the pending `lessons` — keyed by the outgoing archetype, and a restore (or a clean slate) from the shelf for the incoming one. The lean-invalidation rider the discovery anchored at `:363-370` (not re-read here) is the precedent for a learning-field rider on this write. `memory[]` must travel with the paragraph: if it stayed, the next consolidation under the new archetype would consume the old archetype's five games — the Contrarian-carries-a-Diversifier-paragraph mechanism again.
- *The gate.* `gamesPlayed` is archetype-agnostic (`agent.stats`), so "every five games" either keeps counting across archetypes (a restored paragraph then gets consolidated on a window that may be smaller than five) or is kept per shelf — a founder decision (§4).
- *Fence.* The agent doc gains fields; `createAgentBattle` keeps reading the live `consolidatedInsight` (`agentBattleService.js:232`), so the fenced doc shape is unchanged and no fenced file is edited. The `evolutionTimeline` the record sheet shows would need to be per shelf too, or the sheet shows another archetype's history.
- *Tests.* `change-archetype.test.js`, `.compat.test.js`, `.leanrider.test.js` exist; add shelve / restore / change-back-is-idempotent / first-change-has-no-shelf rows, plus a `casualClone` re-sync row.

**"A clone copies learned text only when the archetypes match."**
- *Writer.* Both clone builders copy `INHERITED_LOADOUT_FIELDS` (`api/_utils/trainingClone.js:59-74`, exported; consumed by `casualClone.js:57-60` and the deploy-time re-sync `:93-98`), which includes `consolidatedInsight`, `disciplines` and `evolutionCycle`; `memory` is reset on creation (`trainingClone.js:133`, `casualClone.js:69`) and copied from the parent on casual re-sync (`:97`). A training clone can be born with an overriding archetype (`trainingClone.js:272-278` seeds that archetype's traits). The change: when the clone's archetype differs from the ranked agent's, drop the three learning fields from the copy (and never copy `memory`); with a shelf in place, copy the shelf entry for the clone's archetype instead. Casual clones always share the parent's archetype by construction, so they are unaffected except through the shelf.
- *Tests.* `trainingClone.test.js`, `casualClone.test.js`, `casualCloneParity.test.js` exist; add mismatch-drops-learning and match-copies-learning rows, and a re-sync row.

**Battles already in flight.** A battle's trading brain reads only its frozen copy (`agentBattleService.js:232`; no re-read of `consolidatedInsight` anywhere in `agent-evaluate.js` or `decide.js` — grep VERIFIED), so a shelve mid-battle leaves the running battle on the old archetype's paragraph until it completes, and the next battle freezes whatever is live at creation. The chat voice reads the live agent doc (`voiceLayerPrompt.js:3208` and siblings; the endpoints pass the current doc), so the player's conversation switches paragraphs the moment the archetype changes while the brain in the running battle does not. Whether that split is acceptable, or the shelve should wait for the active battle to end (the agent has an `activeBattleId` lock), is a founder decision (§4).

**Sizing.** Three non-fenced files plus their tests, one new doc shape (the shelf), no index, no flag; medium (above the ~10-file review threshold only if the timeline and record sheet move with it). Independent of the outage fix in code; in order it should land after option (c) so that a restored paragraph is never a failure paragraph, and after the ruling-2 reset so that nothing shelves a failure paragraph for later restoration.

---

## 3. Proposed build packages, smallest first

| # | Package | Touches | Fenced? | Size | Depends on |
|---|---|---|---|---|---|
| P-OUT-1 | **Stop saving failures; make the call fit; record the outcome** (ruling 1 step two = R6 a + the request/budget change + R2's record) | `api/agent/reflect.js`, `api/cron/process-pending-reflections.js`, `api/_utils/shadowLogger.js` (record shape only), two test files (one new) | No | small — ~2 product files, ~150 lines, ~8 test rows | founder decisions 1–3 (§4) |
| P-OUT-2 | **Honest "no reflection" state + consolidation filter and floor N** (R6 b + c) | `reflect.js` (gate order), `agentConsolidationPrompt.js` (`formatMemory`) or `agentConsolidationApply.js` (driver), `src/utils/evolutionTimeline.js`, `AgentRecordSheet.jsx`, tests | No | small–medium | P-OUT-1; decision 4 (N) |
| P-RESET | **Reset the failure-built paragraphs at a week boundary** (ruling 2) | one-off script under `scripts/`, before/after census, report | No (data only) | small, but a write | scoring the 29 changed moments (ruling 2); P-OUT-2 so the next consolidation is clean |
| P-ARCH | **Archetype carry-over** (ruling 5, R7) | `api/agent/change-archetype.js`, `api/_utils/trainingClone.js`, `api/_utils/casualClone.js`, their tests; possibly `evolutionTimeline.js` / `AgentRecordSheet.jsx` for a per-shelf history | No | medium | decisions 5–6; after P-OUT-2 and P-RESET |

Each package is one branch from current `main` and one PR (BUILD_RULES §2). Cron behaviour verifies on the first production run (§6: crons do not run on preview). No new cron entry is needed; the count stays 43.

---

## 4. Founder decisions the discovery surfaced

1. **Drop the game-design review from the reflection call, or keep it and pay for the time.** It is most of the answer (nine required keys, six 100-word observations), nothing in the product reads the `gameDesignFeedback` collection (grep: only its writer, `reflect.js:367`), and without it the reflection would likely fit well inside 30 seconds. *For the player:* their agent's lesson arrives after every game; the hidden playtester questionnaire stops being filled in.
2. **Which budget shape.** Longer deadline (one reflection per 15-minute tick at ~40 seconds, or the 300-second ceiling the evaluator already uses) versus a smaller answer (decision 1) versus both. *For the player:* no visible difference if either works; the longer deadline costs more per reflection and still fails on a ten-hypothesis game unless the token ceiling also rises.
3. **The retry cap and the state after it.** How many attempts a failed reflection gets, and the wording of "no reflection for this game". *For the player:* a game that truly cannot be reflected shows an honest blank instead of a fake lesson.
4. **N, the floor of real reflections before a consolidation runs** (founder slot). *For the player:* the wisdom paragraph is written only when the agent actually has lessons to draw on; until then the record sheet keeps "consolidating…".
5. **Tournament games never count toward "every five games".** `gamesPlayed` does not move on a tournament completion (`agent-evaluate.js:6585`), so a tournament-only agent never consolidates and 89 of 99 agents sit at zero. Intended as part of the "no W/L" ruling, or an accident of it? *For the player:* today an agent that plays only tournaments never develops a wisdom paragraph at all.
6. **Archetype carry-over semantics** (ruling 5): does the five-game counter restart per archetype; does a shelve take effect immediately for the chat voice or wait for the active battle. *For the player:* whether their agent "sounds like" its new archetype mid-game while still trading on the old paragraph.
7. **What the success signal is from now on.** An explicit outcome record (R2) replaces the absence-of-feedback-doc inference, which decision 1 would otherwise destroy. *For the player:* nothing visible; it is what makes the next outage a five-minute read instead of a reproduction.

---

## 5. Not found

- Any stored copy of the failure messages: no log sink, retention setting or exporter for Vercel runtime logs is in the repo; the shadow stream never records the error (§R2).
- The contents of the GCS shadow stream, and whether `GCS_CREDENTIALS` is set in production (the name exists in the local `.env.local`; the stream is outside this session's access path).
- Which consolidation event produced each of the four clone-held, superseded paragraphs (the timeline stores headline and narrative, never the insight text).
- The error class of any past failure. Only today's four reproductions carry one (`timeout`); the `max_tokens` class is inferred from a 103-token margin, not observed.
- The exact share of the 8 October failures caused by the shared key's usage limit (ruling sheet item 10): the low-hypothesis battle from that day fails on timing alone when replayed, so the limit's contribution cannot be separated from the record.
- Reflection records for the 25 completed battles that carry no `pendingReflection` (19 non-CPU: 11 before the 2 May cron split, 8 after; 6 CPU) — no `reflectedAt`, no memory entry, no feedback doc.
- `REFLECTION_WRITER_INVESTIGATION_V2.md`, which the cron header cites (`process-pending-reflections.js:9`): not under `docs/`; the name appears only inside another audit.
- A unit test of `generateReflection` itself (`api/agent/`): none; only the milestone claim is tested.
- Sonnet 4's throughput before its 15 June retirement, so whether the 17 June swap itself slowed the call cannot be said.

---

**Branch:** `claude/reflection-outage-phase0` · **HEAD at report time:** `a06c2a75` (this commit will be recorded on push) · **Report:** `docs/audits/20261010_PHASE0_REFLECTION_OUTAGE_ROOT_CAUSE.md` · **Model spend:** $0.1501 (4 calls of 6 allowed; 17,944 input / 6,419 output tokens on `claude-sonnet-4-6`; nothing written back).
