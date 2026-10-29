# Phase 0 — Daily Regime Brief (DRB) discovery

**Date:** Oct 28, 2026 (read-only session; finished just after midnight, Oct 29)
**Scope:** read-only discovery, hard STOP. Nothing was designed, specced, built, fixed, deployed or triggered.
**Main @** `be52068c` · **Report branch:** `claude/drb-phase0` (report file only)

## 1. Plain-terms summary (for the founder)

1. Today the brief is one shared market note. An AI writes it each weekday at 8:30 AM ET (7:30 after Nov 1): a paragraph, the week's key events and a few themes. It is the same for every player.
2. **It went stale because busy weeks overflow it.** The AI must list every big event. In peak earnings weeks that list is longer than the code allows, so the answer is cut off and thrown away.
3. It failed Mon–Wed this week and on 10 earlier days in July, August and October, always early in the busiest weeks. No recent change broke it.
4. On a failed day the hub keeps Friday's brief, labelled "Last session's brief". That is wrong; the last session was Tuesday.
5. **The trading agent does not read the brief.** Its buy, sell and swap decisions never see it, and a past ruling of yours forbids it.
6. The agent's chat voice, two Forge chat tools and the hub card read it. The chat tools skip it unless it is today's, so they have had none since Monday.
7. Its only way into a game is indirect: it colours what the agent says in chat, and a player's chat instruction does reach the agent.
8. **Safe to change or remove:** the brief, its wording and schedule, and the hub card. No score or trade depends on it. The fix touches no protected file.
9. **Timing:** ranked games lock their setup from 7:00 AM ET, before the 8:30 brief. A choice made from it reaches ranked play the next morning at the earliest.
10. Once a game is running, only a chat or cockpit instruction can still change it, up to the last check at 3:45 PM ET.
11. The watchlist, its thesis, the archetype, leans and tempo reach the agent at the next deploy (leans and tempo: ranked only). The hub's "idea" and "preference" never reach it.
12. About 3 real players deployed in the last 30 days, so a per-player brief is cheap. No app audio exists, and the site's security rules would block outside audio until changed.

## 2. Git state and production access

- **Repo:** `portfolio-duel` (remote `fashraf94/TradeSeven`).
  - `git fetch origin` ran first (BUILD_RULES §3) and brought nothing new.
  - `main` = `origin/main` = **`be52068c2711c819aa5e1d6880690d24b576b8ba`** (merge of PR #1006, the hub flip). Local `main` was already level, so no fast-forward was needed.
  - Working tree clean.
- **Where I worked:** the desktop app's worktree `.claude/worktrees/drb-discovery-ea5051`, local branch `claude/drb-discovery-ea5051` (the app's suffixed name), cut at `be52068c`. Local `main` is checked out in the main checkout, so I did not switch to it.
  - The report is pushed as **`claude/drb-phase0`** by refspec (`HEAD:refs/heads/claude/drb-phase0`). It contains one commit adding only this file. No PR.
- **Production access I had and used (reads only):**
  - **Firestore, through the Firebase Admin service account in the local `.env.local`.** I read `indexIntelligence/dailyRegimeBrief` and `indexIntelligence/marketContext`, listed the `indexIntelligence` document IDs, and ran player counts (`users` and `agents` counts, `agentBattles` by `createdAt`/`status`, printing counts only).
  - **Google Cloud Storage, through the credential file named by `GCS_CREDENTIALS_FILE`.** I listed and downloaded `fantasytrades/shadow/daily_regime_brief/` (113 runs).
  - **Vercel CLI 53.0.1, authenticated.** I read `vercel logs --environment production` for the brief's route. It returned only the Oct 28 run.
- **Not done:**
  - no writes anywhere;
  - no call to Anthropic, OpenRouter, ElevenLabs, OpenAI, EODHD, EXA or newsfilter;
  - no cron or admin route hit; `CRON_SECRET` not used;
  - no secret printed (env checks printed names only);
  - the scratch read scripts live outside the repo and are not committed.

## 3. Answers

Markers: **VERIFIED** = I read that line in this session. **ASSUMED** = taken from a subagent's read and not re-read by me. **PROD** = read from production (Firestore, the storage log, or Vercel logs) in this session. **INFERRED** = a conclusion from evidence, with the evidence stated.

### Q1 — The producer

**Route and schedule.**
- Handler: `api/cron/compute-daily-regime-brief.js:73` (VERIFIED). Auth is the `x-vercel-cron` header or `Bearer CRON_SECRET` (`:74-78`, VERIFIED).
- Cron entry: `vercel.json:180-183`, `"schedule": "30 12 * * 1-5"` (VERIFIED). That is 12:30 UTC Monday–Friday: **8:30 AM EDT now, 7:30 AM EST after DST ends on Nov 1**. There is no dual-hour entry and no ET guard (the header says so at `:5-6`, VERIFIED). It is entry 35 of 44 crons (counted from `vercel.json` this session).
- `maxDuration` is 60 s (`:31`, VERIFIED).

**Time zone, weekday and holiday logic.**
- `today` is the **UTC** date (`:81`, VERIFIED). At 12:30 UTC that matches the ET date. The fetcher's own header flags the UTC `forDate` as a known out-of-scope bug (`api/_utils/fetchEarningsCalendarEODHD.js:19-22`, VERIFIED).
- Weekdays come only from the cron's `1-5`. **There is no market-holiday logic.** The producer ran and wrote on the Jul 3 and Sep 7 2026 market holidays (PROD, storage log).
- Idempotency: it skips if the stored `forDate === today` (`:90-99`, VERIFIED).

**Model, prompt and inputs.**
- Model: `claude-sonnet-4-6` (`:66`, VERIFIED). One call with `max_tokens: 2500`, thinking disabled, effort `low`, forced tool `submit_daily_regime_brief` (`:168-179`, VERIFIED).
- Timeouts and retries: a 45 s timeout race (`:67`, `:180-184`) and SDK `maxRetries: 2` (`:60`), all VERIFIED.
- Prompt: `api/_utils/dailyRegimeBriefPrompt.js`. System prompt at `:76-91`, tool schema at `:12-70`, user prompt at `:208-235`, all VERIFIED.
- The user prompt receives:
  - from `indexIntelligence/marketContext`: regime, regimeDetail, volatility tier, breadth tier, top and worst sector with % change, and the technical leaders and laggards (top/bottom 5);
  - this week's macro events in full and next week's first 5;
  - this week's earnings in full and next week's first 5.

**Output.**
- Collection `indexIntelligence`, one fixed document ID `dailyRegimeBrief`, **overwritten in place** with `.set()` (`:85`, `:204-213`, VERIFIED).
- Fields: `dailyBrief` (string), `keyEvents[]` (each `{label, eventDate, eventTime, kind, whyItMatters, tickers[]}`, schema `:24-60`), `themes[]`, `forDate`, `generatedAt` (server timestamp), `model`, `tokenUsage {input, output}`, `sourceFailures[]`.
- Firestore keeps **no history**. Rules: public read, no client write (`firestore.rules:953-956`, VERIFIED).
- A copy of each **successful** run goes to GCS `fantasytrades/shadow/daily_regime_brief/{UTC date}/{id}.jsonl` (`api/_utils/shadowLogger.js:18`, `:52`, `:85`, VERIFIED). It is fire-and-forget (`.catch(() => {})` at `:239`, VERIFIED). The code sets no retention. The bucket holds 113 runs, Apr 29 → Oct 23 (PROD).
- On a model failure the handler returns 500 and **does not overwrite** (`:16-18`, `:249-258`, VERIFIED). Failures are not written to storage, so a failed day leaves no trace except the Vercel log.

**Cost of one day's run.**
- Anthropic: **one call.** Input 2,190–2,778 tokens (median 2,330); output 285–2,344 (median 846); wall time 9–40 s (median 21 s). PROD: 82 successful runs, Jun 18 → Oct 23.
- EODHD: **one request** to `/api/calendar/earnings` covering this week and next (`fetchEarningsCalendarEODHD.js:202-204`, VERIFIED). No per-ticker requests. The macro calendar makes **no network call** (`api/_utils/fetchMacroEvents.js:12-15`, VERIFIED). The code does not show how EODHD weights a calendar request against the plan; the EODHD dashboard would.
- Also: 2 Firestore reads, 1 Firestore write, 1 GCS object.

**Feature flags.** **None.**
- No flag in `src/config/featureFlags.js` governs the producer.
- No `DARK_BY_DESIGN` entry in `src/config/flagPinGuard.test.js:58-300` names it (I listed all 23 entry names; none relate). VERIFIED.
- The readers have their own gates; see Q3.

### Q2 — Why the hub shows Oct 23 on Oct 28

**Last successful write: Fri Oct 23 2026, 12:30:33 UTC (8:30 AM ET).** PROD: the document's `forDate: 2026-10-23`, `generatedAt` and `updateTime` agree. Its output was 542 tokens with 2 key events (AXP, SLB). Mon Oct 26, Tue Oct 27 and Wed Oct 28 all failed. A success would have overwritten the document, and none reached the storage log.

**Today's run (Wed Oct 28), from the Vercel production log (PROD):**
- 12:30:18 UTC: the request starts (deployment `dpl_6AM14FkD…`, branch main).
- 12:30:21.670: `Calling Sonnet {"forDate":"2026-10-28","econEvents":9,"earnings":45,"sourceFailures":[]}`. Inputs were complete.
- 12:31:02.412: `Brief generation failed {"message":"Malformed tool_use input (expected brief:string, keyEvents:[], themes:[])"}`, thrown at `compute-daily-regime-brief.js:193`. HTTP 500, duration 44,284 ms.
- `vercel logs` returned nothing older than this run, so the Oct 26 and 27 failures are inferred from the document and storage gap, not read.

**Root cause (INFERRED, high confidence): the answer is cut off at the 2,500-token output cap on heavy calendar weeks.**

Here is the chain, each link read in code:
1. Every earnings row that passes the >$25B filter, or the null-cap backstop, is stamped `significance: 'high'` (`fetchEarningsCalendarEODHD.js:175`, VERIFIED). So the prompt's "high-significance only" filter (`dailyRegimeBriefPrompt.js:140`, VERIFIED) removes nothing, and **every** remaining mega-cap report this week is rendered with no limit (`:229-230`, `renderEarnings` with no `limit`, VERIFIED).
2. The tool schema and system prompt then **order the model to list every one**: "do not omit events… If it has 5, return 5" (`dailyRegimeBriefPrompt.js:27`, `:87`, VERIFIED). Each event carries a 140-character `whyItMatters` and tickers.
3. Output grows about **101 tokens per key event** (fit over 82 successful runs: output ≈ 338 + 101 × keyEvents, PROD). At `max_tokens: 2500` (`compute-daily-regime-brief.js:170`, VERIFIED) the ceiling is about **21 events**. The largest success ever recorded is exactly 21 events and 2,344 tokens (Oct 21).
4. `keyEvents` sits before `themes` in the schema (`:24` vs `:61`). An answer cut off mid-list therefore arrives without `themes`, and that is exactly the check that throws (`:192-193`, VERIFIED).
5. Today's model time (~40.7 s from "Calling Sonnet" to failure) matches Oct 21's 2,344-token run (40.5 s). The 45 s timeout produces a different message (`Sonnet timeout (45s)`, `:181`), which was not seen.

**Every missed weekday since mid-May (PROD, from the storage log):**

| Missed days | Week | Cause |
|---|---|---|
| Jun 16–17 | quiet (3 earnings) | **Different, already fixed.** Retired Sonnet-4 model string, restored by `03dc383b1` on Jun 17 |
| Jul 14 (Tue) | peak earnings (Jul 13 had 19 events, 2,274 tokens) | output cap |
| Jul 20–21 (Mon–Tue) | peak (Jul 22 had 19 events, 2,243 tokens) | output cap |
| Jul 27–29 (Mon–Wed) | peak (Jul 30 had 17 events, 2,003 tokens) | output cap |
| Aug 3–4 (Mon–Tue) | late-season peak | output cap |
| Oct 19–20 (Mon–Tue) | peak (Oct 21 had 21 events, 2,344 tokens) | output cap |
| **Oct 26–28 (Mon–Wed)** | **peak + FOMC/GDP/PCE week** | output cap |

The failures land on the first days of peak earnings weeks, because "this week" counts only today forward (`fetchEarningsCalendarEODHD.js:221-222`, VERIFIED), so the list is longest early in the week. Treat ~21 as approximate, not a hard threshold: Oct 21 succeeded at 53 earnings rows while today failed at 45, because the model's wording varies near the ceiling. The handler does not log `stop_reason`, so the cut-off is inferred, not read. Confirming it would take one logged run, which I did not make (no-spend rule).

**Candidates ruled out:**
- **Cron removed, renamed or crowded out:** no. The entry is present (`vercel.json:180-183`), the only `vercel.json` change since Oct 19 is `1a2e053d` (Oct 26, which added `agent-evaluate?mode=settle`), and the run fired today (PROD).
- **Producer or prompt changed:** no. Last commits to the producer and prompt are `03dc383b1` (Jun 17); the fetchers' last change was `3ea405d43` (Jul 30, macro calendar). `git log --since=2026-09-01` on all five files is empty.
- **Flag flipped:** no flag exists.
- **Weekday logic:** no. Mon–Fri ran.
- **Missing inputs:** `sourceFailures` was empty (PROD).
- **Hub reading the wrong document:** no. It reads `indexIntelligence/dailyRegimeBrief` (`src/hooks/useDailyRegimeBrief.js:41`, VERIFIED). The hub commits since Oct 19 (`05cd1f29`, `b14d3973`, `b5f48349`) wire the card; none touch the producer.

**Is the hub label correct?**
- The date is correct: it formats the document's own `forDate` (`src/components/CommandCenter/hub/useHubBrief.js:29-36`, VERIFIED).
- The **words** are wrong when more than one session has passed:
  - `isStale` is only `forDate !== today (ET)` (`useDailyRegimeBrief.js:76`, VERIFIED), and every stale brief gets "Last session's brief · for {date}" (`hubCopy.js:499`, VERIFIED). On Wed Oct 28 the last session was Tue Oct 27, not Fri Oct 23.
  - There is no age limit, so a brief weeks old would still show under that label.
  - The "Generated" part prints a time with no day, "Generated 8:30 AM ET" (`hubDate.js:23-27`, `:37-40`, VERIFIED), which reads as this morning.
- When the document is missing, the card shows "No brief available" (`hubCopy.js:494`, `BriefSection.jsx:38-40`, VERIFIED). When the read fails twice it shows "Couldn't load the brief · Retry" (`:31-36`).

**Meanwhile every server reader dropped the brief silently.** They all require `forDate === today`, so since Monday the chat voice and the Forge tools have run without it (Q3), while the hub kept showing Friday's.

The fix (described only) is in §4.

### Q3 — Readers census

There are two kinds of reader. Server readers check freshness (`forDate === today`, with `today` the **UTC** date) and drop a stale brief. The client readers show whatever is stored. "Live" means its gate is on at HEAD.

**Server readers (each builds `anchorContext` for the Gemma text persona, the "Voice Layer"):**

| # | Reader | Fields read | Checks freshness? | Live? | Effect if the brief disappeared or changed shape |
|---|---|---|---|---|---|
| S1 | Deploy opener, `api/agent/decide.js:1625-1653` (`generateFirstMessageOnDeploy`; `decide.js` is **fenced**) | `forDate`, `dailyBrief` | yes, `:1650` | yes: tiered deploys (`:991-1002`) and human tournament deploys; CPU agents skip it (`:1583-1584`) | The opener's prompt falls back to "Daily regime brief unavailable. Lean on portfolio composition only." (`api/_utils/voiceLayerPrompt.js:3514`). **No trade decision changes.** Both call sites run after the battle is created (`:991`, `:1578`) |
| S2 | Lazy opener, `api/agent/ensure-opener.js:214-237` (called from `src/components/Agent/AgentChat.jsx:789`) | same | yes, `:234` | yes | Same fallback, text only |
| S3 | Battle chat, `api/agent/chat.js:589-623` | same | yes, `:620` | yes | Chat replies lose the paragraph. Also stored on each exchange record as `anchorContext` (`:841`, `:1026`); nothing reads it back (grep for `.anchorContext`: no hits). **Indirect path to trades: see below** |
| S4 | Trade narration, `api/_utils/voiceLayerTradeNarration.js:104-136`, called by `api/cron/agent-evaluate.js:4946` **after** swaps | same | yes, `:133` | yes | Narration text only; runs after the decision |
| S5 | Anticipation notes, `api/_utils/voiceLayerAnticipation.js:225-257`, called by `agent-evaluate.js:4986` after the decision | same | yes, `:254` | yes | Note text only |
| S6 | Forge Workshop chat, `api/forge/workshop-chat.js:355-376` (UI: `src/components/Forge/WorkshopChat.jsx:529`) | same | yes, `:372` | yes, no flag in the handler | Workshop replies lose the context; its prompt tells the model to cite the brief (`voiceLayerPrompt.js:314`, `:2051-2061`) |
| S7 | Signal Drop watchlist dialogue, `api/forge/watchlist-dialogue.js:1125-1140` (UI: `src/components/SignalDrop/WatchlistChat.jsx:328`) | `forDate`, `dailyBrief` | yes, `:1135` | yes | The prompt falls back to "No anchor context available…" (`voiceLayerPrompt.js:3096`) |
| S8 | Signal Drop expansion, `api/forge/expand-signal.js:132-170` | `forDate`, `dailyBrief` | yes, `:148`, `:168` | deployed, but **no in-app caller**; only `scripts/test-signal-drop-pipeline.js:577` calls it | none for players |
| S9 | Discover "Current Events" rail, `api/discover/current-events.js:131-175` | `keyEvents`, `forDate` | marks it `fresh`/`stale` and drops past events | **no**: `WATCH_LIST_RAIL_ENABLED = false` (`featureFlags.js:13`), mounted at `src/components/discover/DiscoverPanel.jsx:443` | none today |

**Client readers (one hook, `src/hooks/useDailyRegimeBrief.js:28-82`, which reads every field and computes `isStale`):**

| # | Reader | Fields | Shows a stale brief? | Live? | Effect if removed |
|---|---|---|---|---|---|
| C1 | **Command Center hub** brief card: `hub/useHubBrief.js:51-55` → `hub/useHubReaders.js:114`, `:231` → `CommandCenterHub.jsx:486` → `sections/BriefSection.jsx` | `dailyBrief`, `forDate`, `generatedAt`, `isStale` | **yes**, labelled "Last session's…" | yes: `COMMAND_CENTER_HUB_ENABLED = true` (`featureFlags.js:3455`) | The card shows "No brief available". Nothing else |
| C2 | Legacy Command Dashboard (mobile) `src/components/Dashboard/CommandDashboard.jsx:148` and desktop Read column `desktop/ReadColumn.jsx:32` | brief, keyEvents, themes, loading | yes | **fallback only.** With the hub on, `App.jsx:8943-8948` picks the hub, and these mount only if the hub chunk fails to load (`CommandCenterHubGate`, `App.jsx:9003`, `:9077-9082`) | That fallback's Read card empties |
| C3 | AgentPresence face, `src/components/AgentPresence/useAgentPresence.js:17` and `presenceBinding.js:104` | only the hook's `loading` flag, as a "reading" cue on the legacy command surface | n/a | `AGENT_PRESENCE_ENABLED = true` (`:1338`), but this cue is fed only by the C2 legacy shells | The face loses one "reading" cue |

**Checked, and they do not read the brief** (grep for `dailyRegimeBrief`, `regime brief`, `anchorContext` and `dailyBrief` across `api/` and `src/`, every non-test hit listed and opened):
- **The trading prompts.**
  - `api/_utils/agentPromptAssembly.js` (deploy pick) and `api/_utils/agentEvalPromptAssembly.js` (intraday swaps): zero hits for `anchorContext`, `keyEvents`, `themes`, `dailyBrief` or `indexIntelligence` (both fenced, read only).
  - `api/cron/agent-evaluate.js` reads only `stockRankings`, `marketContext` and `SPY` from `indexIntelligence` (`:1504-1508`).
  - `decide.js` reads `stockRankings` (`:344`, `:1405`), and reads the brief only inside the opener (S1).
- **The regime stamp on battles** says so in writing: "The DRB is NOT read in the tick and no DRB read is authorized (founder ruling) — drbRegime / drbForDate stay null" (`api/_utils/regimeStamp.js:25-28`, `:103-104`).
- **The cockpit** calls block (`chat.js:612`, `buildCallsBlockForChat`) is a separate input to chat and does not read the brief.
- **Not readers:** the Film Room (`api/film-room/`, `src/components/FilmRoom`), FantasyTimes and the Wire (`api/fantasytimes/`), reflection and wisdom writing, and the daily review `api/cron/agent-batch-review.js` (passes `anchorContext: null`, `:394`). Also `api/forge/watchlist-analysis.js:668` and `api/screener/chat.js:501`, both `null`.
- **Name collisions, not this brief:** "DRB lessons attribution redirect" in `agent-batch-review.js:57` and `agentConsolidationApply.js:306` is a casual-clone lesson re-keying; it never touches this brief.
- **Capture and record builds:** no trading-side record of what the agent saw can hold the brief, because neither trading prompt contains it. I did not open each capture writer. The only per-exchange record holding brief text is the chat exchange (S3). The opener's diagnostics record only `hadAnchorContext: true/false` (`decide.js:1779`, `voiceLayerAnticipation.js:412`, `voiceLayerTradeNarration.js:308`).

**Does DRB text or data reach the Trading Brain's decisions today? No, not directly. Indirectly, yes: through the player, via chat.**
- **Direct:** no trading prompt, deploy or intraday, contains any brief field (evidence above).
- **Indirect, one path that is live:**
  1. The battle chat persona sees the brief when it is fresh (S3).
  2. A chat turn can file a coaching directive: `chat.js:870-893` (`gateDirective`), then `chat.js:1112` → `fileDirectiveTransactional`, which writes the battle's `directive` slot (`api/_utils/directiveWriter.js:1-12`, `:110-139`).
  3. The intraday evaluator passes that to the fenced swap prompt: `agent-evaluate.js:1927` → `agentEvalPromptAssembly.js:1240`.

  So the brief can colour what the agent's chat says, and a directive the player files in that conversation does reach the agent's next check. The directive's source is the player's chat turn; the brief is never forwarded verbatim. (VERIFIED at the cited lines; I did not trace `gateDirective`'s internals.)
- **Indirect, through Forge (player action required):**
  - A Workshop thesis is shaped by a chat that saw the brief (S6) and becomes strategy dimensions only when the player compiles it (`workshop-chat.js:17-19`).
  - A Signal Drop watchlist is shaped by a dialogue that saw the brief (S7) and matters only once the player saves and equips it.

  Either reaches the agent only at a later deploy.

**Calibration fence.** Only S1 sits in a fenced file (`decide.js`, `BUILD_RULES.md:14`), and it is a text-only branch that runs after the portfolio is committed. Nothing else in the census is fenced. Removing or reshaping the brief changes **no score and no trade decision**. It changes chat text, the hub card and the legacy fallback card.

### Q4 — What the DRB already gathers

| Input | Source in code | Also collected elsewhere? | Freshness at 8:30 AM ET |
|---|---|---|---|
| Regime, regimeDetail, volatility tier, breadth tier, top/worst sector ± %, technical leaders/laggards (5 each) | `indexIntelligence/marketContext`, written by `api/cron/compute-index-intelligence.js:1215-1217`; pre-market run `30 10,11 * * 1-5` (`:4`), intraday hourly `0 14-20` (`:5`) | **Yes, the same document** is read by the trading evaluator (`agent-evaluate.js:1507`), by every Voice Layer reader for its regime line, and by the regime stamp | From the pre-market runs (10:30 and 11:30 UTC, i.e. 6:30 and 7:30 AM EDT), which reflect the **prior close** (`:4-9`). Intraday refresh starts at 10:00 AM ET |
| Macro calendar, this week in full and next week top 5 | `api/_utils/macroCalendar.js` via `fetchMacroEvents.js:24-52`: hand-entered 2026 arrays (FOMC, CPI, PPI, PCE, Retail Sales, GDP, Productivity, `:104-217`) plus computed dates (NFP, ISM ×2, Consumer Confidence, Jobless Claims, `:245-311`) | **Yes:** FantasyTimes econ (`api/fantasytimes/generate-econ.js:30`) uses the same module; it is value-locked into the Wire's generation hash (`macroCalendar.js:470-485`, lock at `:482`). FantasyTimes also ingests EODHD econ data separately (`ingest-econ` cron) | Static data, always "current". **Side finding: the hand-entered arrays are 2026-only** (`:420-421`, `:443-451`). From late December the "next week" preview and from Jan 1 2027 the whole calendar lose FOMC, CPI, PPI, PCE, Retail Sales, GDP and Productivity, silently, for the brief **and** FantasyTimes. Report it for separate tasking |
| Earnings, this week (today forward) in full and next week top 5, >$25B or priority list | EODHD `/calendar/earnings`, one request per run (`fetchEarningsCalendarEODHD.js:182-238`); priority backstop list `:39-63`; threshold `:31` | **Yes:** about 8 other EODHD earnings readers (header `:7-12`; e.g. `api/fantasytimes/ingest-earnings.js:31`, `api/stocks/earnings-calendar.js`, `api/cron/compute-estimates.js`) | Fetched live at run time. Today 52 rows had a null market cap and were kept by the backstop (PROD log), so EODHD's cap field is often missing |
| FantasyTimes stories / the Wire, news, sector ETFs beyond `marketContext`, `stockRankings`, per-player data | **not gathered** | n/a | n/a |

Only the narration (the `dailyBrief` paragraph, `keyEvents[].whyItMatters` and `themes`) exists nowhere else. Every **fact** the brief uses is already collected by another job.

### Q5 — Per-player inputs available at brief time (~8:30 AM ET)

All of these are server-readable by a cron through the Admin SDK.

| Input | Where it lives | Server reader | Notes |
|---|---|---|---|
| Archetype | `agents/{agentId}.archetype` (there is no `equippedArchetype` or `characterId` field) | `decide.js:370-372`; `agentPromptAssembly.js:74-77` (ASSUMED) | Frozen into the battle (`agentBattleService.js:192`, VERIFIED) |
| Active watchlist | `agents/{id}.equippedWatchlistId` → `watchlists/{id}` (`tickers`, `thesis`, `status`) | `decide.js:382-400` (VERIFIED) | Used only when committed and not deleted (`api/_utils/watchlistEquip.js:51-56`, ASSUMED) |
| The idea, and whether it is due for review | `watchlists/{wid}/hypothesisVersions/v{n}`, status `review_due` set by the server review pass in `process-pending-reflections` (ASSUMED) | `api/_utils/hypothesisRecords/store.js`, `carriage.js` (ASSUMED); client check `src/services/dueIdeaCheck.js:64` (VERIFIED) | **Only for allowlisted players:** flag `HYPOTHESIS_RECORDS_ENABLED = true` (`featureFlags.js:3188`) **and** the server-only cockpit allowlist (`hypothesisRecords/gate.js:52-55`), both VERIFIED |
| Deployed and active games | `agents/{id}.activeBattleId`; `agentBattles/{id}` (`ownerId`, `status`, `gameMode`, `groupId`) | `findActiveAgentBattles` (`agentBattleService.js:49-56`, ASSUMED) | Command Center BaggerBomb deploys run on a separate **casual clone** agent (`src/services/agentDeploy.js:178-218`, VERIFIED; `CASUAL_CLONE_CONCURRENCY_ENABLED = true`, `featureFlags.js:237`, VERIFIED). Ranked deploys use the ranked agent |
| Holdings | The agent's: `agentBattles/{id}.portfolio` and `agents/{id}.lastDecision`. The player's own: the Dashboard watchlist is browser-only (localStorage), so a server cannot read it; mandate books at `mandates/{id}` are a separate, headless system | as left (ASSUMED) | Nothing user-held reaches the trading agent |

**A per-user cron or batch pattern to copy?** **No cron iterates all players today** (subagent search; ASSUMED). The nearest patterns:
- **`tournament-orchestrator`.** A per-player, ET-aware morning fan-out with per-ET-date markers, the closest model (VERIFIED for timing, Q7). Its markers are at `api/_utils/tournamentOrchestrator.js:1062-1066`.
- **`agent-evaluate`.** Iterates every active battle under a time budget.
- **`process-pending-reflections`.** A queue with persisted cursors.
- **`mandate-rollover`.** A per-user cursor walk; dark.

BUILD_RULES §6 prefers branching inside an existing handler over a new cron entry (44 of 100 used).

**How many active players? (PROD, counts only):**
- 12 `users` documents; 104 `agents` documents (most are clones, CPU agents or system agents).
- Distinct **non-CPU owners who created a battle**: **1** in the last 24 h, **3** in the last 7, 14 and 30 days.
- Battles created in the last 30 days: 145 (120 tournament, 25 BaggerBomb).
- Active battles right now: 1.

### Q6 — Records a "daily decision" could write to (existing records only)

The common theme: almost everything is **server-written and frozen at deploy**, and the hub's idea and partnership surfaces do not reach the agent at all.

**Ideas (create, reaffirm, retire; due-for-review; the three-choice deploy screen).**
- **Write paths, server only:**
  - create: `POST /api/forge/watchlists/{id}/hypothesis-versions`;
  - reaffirm, retire and the other moves: `POST /api/forge/watchlists/{id}/hypothesis-transition` (header `:1-23`, VERIFIED).
  - Clients cannot write versions (`firestore.rules:1211-1215`, ASSUMED).
- **Validation:**
  - flag + allowlist gate, otherwise 404 (`hypothesis-transition.js:23`, VERIFIED);
  - rate limit of 10 per minute (`:37`, VERIFIED);
  - compare-and-set on `expectedStatus`/`expectedVersion`, and `opId` idempotency (`:21-22`, VERIFIED);
  - reaffirm is allowed only from `review_due` (`:15-19`, VERIFIED).
- **Due state:** written only by the server review pass.
- **The three-choice screen** is `src/components/Dashboard/deployCeremony/DueIdeaInterstitial.jsx:14-21` (VERIFIED): *Reaffirm and deploy*, *Retire and deploy*, *Deploy without it*. It is reachable from the hub's deploy path (`DeployAttemptContext.jsx`, ASSUMED). The hub itself only shows the idea, read-only.
- **Reaches the agent: never.**
  - The carried version is frozen into the battle (`agentBattleService.js:211-231`, VERIFIED), but nothing the agent reads uses it. The flag's own docstring says "Nothing the agent sees or trades reads any of it" (`featureFlags.js:3147`, VERIFIED).
  - Neither trading prompt contains `equippedHypothesis` (grep, VERIFIED).
  - It is never carried on tournament battles (`agentBattleService.js:211-214`, VERIFIED).
- **What does reach the next deploy is the watchlist's `thesis` text**, rendered into the deploy prompt as "Thesis: …" (`decide.js:429-440`, `agentPromptAssembly.js:132-149`, VERIFIED). It is editable only while the list is a draft (ASSUMED).

**Partnership memory and confirmed preferences.**
- "A preference will only ever stand once you confirm it." is **placeholder copy** in a reserved panel:
  - the copy is `hubCopy.js:128-133`: "Partnership isn't part of this release…";
  - `PartnershipPanel.jsx:1-6` says "No control, link, count or record fetch… there is none to take";
  - both VERIFIED.
- **Nothing enforces confirmation, because no such record exists.** A grep for `partnershipMemory`, `pendingPreference`, `confirmedPreference` and `preferenceProposal` finds nothing (VERIFIED).
- **Nearest existing records:**
  - `agents/{id}.memory`: written by the reflection step on the server, read at the next deploy. It is not player-authored. (ASSUMED)
  - `battle.leanOverrides[]`: has a `confirmedAt` field and live readers (`agentEvalPromptAssembly.js:1242`, VERIFIED), but **no writer** outside tests (grep, VERIFIED).

**Watchlist adds, Signal Drop, watch flags.**
- **Forge watchlists:**
  - Tickers and thesis are edited server-side while the list is a draft. Equipping requires a committed list and is refused during a live game (`api/agent/equip-watchlist.js:89`, VERIFIED).
  - **Reaches the agent at the next deploy** (`decide.js:382-400`, VERIFIED), as a frozen snapshot, never live.
  - The hub offers watchlist equip (`LoadoutSheets.jsx`, ASSUMED).
- **Dashboard watchlist:** browser-only. Never reaches the agent.
- **Signal Drop:**
  - `parse-signal` writes `users/{uid}/signalDrops/{dropId}` (server-only).
  - The path runs dialogue → draft list → commit → equip → next deploy (ASSUMED). The drop record itself never reaches the agent.
- **"Watch flags":** none exist.

**Shared Research.**
- No `sharedResearch` or `researchNotes` record exists.
- The live research records (`researchWork/{id}`) are server-only, behind the same flag + allowlist, and never reach the agent (ASSUMED; the docstring at `featureFlags.js:3147` covers them).
- "Show It" research is dark: `SHOW_IT_ENABLED = false` (`featureFlags.js:2432`, VERIFIED).

**Forge Character: standing leans and tempo dial.**
- **Fields:** `agents/{id}.standingLeans` and `dials.tempo`.
- **Writes:** server routes `equip-lean`, `unequip-lean` and `set-tempo-dial`, refused during a live game (`set-tempo-dial.js:104`, VERIFIED).
- **Flags:** `STANDING_LEANS_ENABLED = true` (`featureFlags.js:703`) and `TEMPO_DIAL_ENABLED = true` (`:723`), both VERIFIED.
- **How they reach the agent:**
  - rendered in the deploy prompt;
  - frozen into the battle;
  - read by every check from the frozen copy (`agentEvalPromptAssembly.js:1241`, VERIFIED).
- **Caveat (VERIFIED):** the casual clone that plays Command Center BaggerBomb games copies its loadout from the ranked agent through a fixed field list. That list has **no `standingLeans` and no `dials`** (`api/_utils/trainingClone.js:59-84`; `casualClone.js:91-98`). So Forge leans and tempo reach ranked and tournament games, but **not** hub BaggerBomb games, unless something else copies them; the subagent found nothing.
- **Writable outside the Forge?**
  - The routes accept any authenticated owner, but the only UI is the Forge Character area (ASSUMED).
  - Archetype can be changed from the Dashboard (battle-locked; ASSUMED).
  - Watchlist equip is in the hub.

**Live in-game channels** (the only records that reach a game already running; see Q7):
- `battle.directive`: written via chat (live), the chip route (dark) or cockpit answers (allowlist only).
- `battle.strategyPreset`:
  - **Client-writable** by the owner (`firestore.rules:474-478`, VERIFIED) and read by every check as the governing preset (`agent-evaluate.js:1150-1154`, VERIFIED).
  - Its writer is `updateStrategyPreset` (`src/services/agentService.js:622-628`, VERIFIED). The only UI that calls it is `StrategyPresetBadge`, which `AgentBattleScreen.jsx:114` imports but never renders, and an archived tab (VERIFIED). So the channel is open but has **no mounted control**.
- `executionMode`: also owner-writable, but the evaluator forces autopilot (`agent-evaluate.js:3790-3793`, VERIFIED), so it has no effect.

### Q7 — Timing: when can a player's change reach the agent?

Times are EDT (today). After DST ends on Nov 1, every UTC cron lands an hour earlier in ET unless it has an ET guard.

**Ranked auto-deploy.**
- The ranked game is deployed by the tournament orchestrator cron, `*/10 11,12,13,14,21,22,23 * * 1-5` (`vercel.json`, entry 37), gated by the module constant `TOURNAMENT_DEPLOY_ENABLED = true` (`api/_utils/tournamentOrchestrator.js:120`, VERIFIED). Its morning duty runs until ET noon (`:134`, VERIFIED).
- The first clean tick is **7:00 AM ET (EDT) / 6:00 AM ET (EST)** (`:1062-1066`, VERIFIED).
- Seats are paced and failed seats retry every 10 minutes through the 14:xx UTC hour, i.e. up to ~10:50 AM EDT (`:58-63`, `:122-124`, ASSUMED). Each seat posts a prescribed six to `/api/agent/decide` → `runPrescribedTournamentDeploy` (`api/agent/decide.js:1382`, VERIFIED as the function; call path ASSUMED).
- The hub's "7:00 AM ET": I found **no literal "7:00" in the hub code**. The 7:00 AM events are this first orchestrator tick and the stock-ranking run (`api/cron/compute-rankings.js:5`, `0 11 * * 1-5`, VERIFIED). The hub's Scouting Board dates itself from that run (`src/components/Dashboard/ScoutingBoardSheet.jsx:76-80`, VERIFIED).

**BaggerBomb (tiered) deploy.**
- Not scheduled. The player holds to deploy, which posts to `/api/agent/decide` (`src/services/agentDeploy.js:233`, ASSUMED).
- The CPU opponent is generated inside that request (`decide.js:828-837`, `:944-948`, ASSUMED).
- A deploy from 3:15 PM ET, or on a non-trading day, plays the next session (`src/utils/stockAdmissionWindow.js:23-26`, `:70`, ASSUMED).
- Tournament `isCpu` system agents ride the orchestrator fan-out above and get no opener (`decide.js:1583-1584`, VERIFIED).

**Game start and end.**
- Start is 9:30 AM ET: `localOpen: '09:30'` (`api/_utils/agentBattleService.js:159`, ASSUMED); the evaluator is gated by `isMarketOpen()` (`api/cron/agent-evaluate.js:443`, ASSUMED). Its cron is `*/15 13-21 * * 1-5`, so the first check is 9:30 and the last is **3:45 PM**.
- End:
  - stocks-only games end at 4:00 PM ET (`expiresAt`);
  - rosters holding crypto run to 8:00 PM ("Night Game") (`agentBattleService.js:121-131`, ASSUMED);
  - the evening settle `agent-evaluate?mode=settle` at `0 2 * * 2-6` (10 PM EDT / 9 PM EST) only sweeps expiries (`vercel.json`, entry 30, VERIFIED; behavior ASSUMED).

**"Changes apply to your next deploy … never rewrites a game in progress": where it is enforced.**
- Copy: `src/components/CommandCenter/hub/hubCopy.js:198`, `:200`, `:203` (VERIFIED).
- **Freeze at deploy:** `decide.js` reads the equipped watchlist (`decide.js:382-400`, VERIFIED) and resolves which version of its idea the battle carries (`:402-410`, VERIFIED), then hands both to `createAgentBattle` (`:964-973`, ASSUMED).
- The battle stores `agentContext` (`agentBattleService.js:190-231`, VERIFIED):
  - archetype;
  - active rules;
  - guardrails, "frozen at battle creation so mid-battle re-deploys don't whiplash live execution";
  - the equipped watchlist with `snapshotAt`;
  - the equipped idea version. This is **never on a tournament battle** (`:211-214`), and ranked deploys pass `equippedWatchlist: null` (`decide.js:1560`, VERIFIED).
- **Lock during a game:** equipping a watchlist and changing the tempo dial both refuse with `battle_active` while `agent.activeBattleId` is set (`api/agent/equip-watchlist.js:89`, `api/agent/set-tempo-dial.js:104`, VERIFIED).
- **Intraday reads use only the snapshot:**
  - `const ctx = battle.agentContext` (`agent-evaluate.js:1128`, VERIFIED);
  - the swap prompt reads `battle.agentContext?.standingLeans` (`agentEvalPromptAssembly.js:1241`, VERIFIED);
  - the tiered watchlist refresh re-folds the **frozen** `battle.agentContext.equippedWatchlist.tickers` (`agent-evaluate.js:1565-1574`, VERIFIED), not the player's live watchlist.

**Latest moment a player change can affect today's game.**
- **Loadout** (archetype, rules, leans, tempo, plus the watchlist and its idea on BaggerBomb; ranked carries no watchlist or idea): only at the deploy itself. For ranked that is the orchestrator tick that reaches the seat, 7:00 AM ET or later. For BaggerBomb it is the moment the player holds to deploy.
- **Today's 8:30 AM brief therefore arrives after the ranked deploy has frozen the loadout.** A brief-driven loadout choice can reach a ranked game no earlier than the next day's deploy. For a BaggerBomb game it can apply only if the player deploys after reading it.
- **During the game,** the player-writable inputs re-read on every check are on the battle document:
  - `battle.directive` (`agentEvalPromptAssembly.js:1240`, `agent-evaluate.js:1927`, VERIFIED);
  - `battle.strategyPreset`, which is owner-writable by rule but has no mounted control (Q6).
- `battle.leanOverrides` is read too (`agentEvalPromptAssembly.js:1242`), but nothing writes it (Q6).
- The last check that can apply them is **3:45 PM ET**. Battles past a run's time budget are deferred (`agent-evaluate.js:502-509`, ASSUMED).
- **Clone caveat:** Forge leans and tempo do not reach hub BaggerBomb games at all (Q6). Those games run on a casual clone that does not copy them.

**Is there a live path into a running game? Yes: the directive slot, through three routes.**
- **Typed directive in battle chat:** `POST /api/agent/chat`. **Live**: `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`featureFlags.js:770`, VERIFIED). Written via `fileDirectiveTransactional` (`chat.js:1112`, VERIFIED).
- **Directive chip:** `POST /api/agent/file-directive`. **Dark**: it requires voice grounding resolved `'on'` (`api/agent/file-directive.js:18-21`, VERIFIED), and `VOICE_GROUNDING_MODE = 'shadow'` (`featureFlags.js:2283`, VERIFIED).
- **Cockpit answers:** `POST /api/agent/call-response`. **Live only for allowlisted owners**: `CALL_RECORDS_MODE = 'on'` (`featureFlags.js:2839`, VERIFIED) resolves to `'on'` only for uids in the server-only `COCKPIT_ALLOWLIST_UIDS` (`api/_utils/callRecords/mode.js:13-15`, VERIFIED). The route returns unavailable otherwise (`api/agent/call-response.js:278`, VERIFIED).

**Weekday timeline (ET, EDT; EST from Nov 2 in brackets):**

| Time | What happens |
|---|---|
| 6:30 & 7:30 AM [5:30 & 6:30] | Market context written (pre-market, prior close). The cron is dual-hour with no skip guard seen, so both runs overwrite |
| 7:00 AM [6:00] | Stock rankings run; first ranked auto-deploy tick (seats retry to ~10:50 AM) → **ranked loadout frozen** |
| 8:30 AM [7:30] | Daily Regime Brief |
| 9:30 AM | Game start, first agent check |
| 3:15 PM | BaggerBomb deploys from here play the next session |
| 3:45 PM | Last agent check: **last moment a chat/cockpit directive can affect today** |
| 4:00 PM | Stocks-only games end (crypto rosters 8:00 PM) |
| 10:00 PM [9:00] | Evening settle sweep |

### Q8 — Audio readiness (inventory only)

**Audio or text-to-speech code.**
- **One server endpoint exists, with no caller:** `api/academy/generate-audio.js`.
  - It calls ElevenLabs text-to-speech (`:184`, VERIFIED), with an `ELEVENLABS_API_KEY` check at `:153-156` (VERIFIED).
  - It is admin- or cron-secret-only (`:138-151`, ASSUMED), batch-sized (`maxDuration: 300`, `:22`, VERIFIED), and returns MP3 or base64 JSON (ASSUMED).
  - A grep for `generate-audio` across `src/`, `api/` and `scripts/` finds no caller (VERIFIED).
- **The only client playback is two sound-effect hooks using `new Audio(path)`:** `src/hooks/useShockwave.js:34` and `src/hooks/useBaggerShockwave.js:29` (ASSUMED).
  - Their files, `/sounds/*.mp3`, **do not exist**: `public/` holds only `vite.svg`, and `src/assets` only `react.svg` (VERIFIED).
- **No audio player component**, no `speechSynthesis`, no `AudioContext`, no audio dependency in `package.json`, and no Firebase Storage or GCS media. The GCS bucket is used only for JSONL logs. (ASSUMED from the subagent's sweep, except the `public/` and `src/assets` listings, which I VERIFIED.)

**Env var names.**
- `ELEVENLABS_API_KEY`:
  - referenced in `generate-audio.js`;
  - present by name in the local `.env.local` (names-only check);
  - **absent from `.env.example`** (ASSUMED).
- No OpenAI key and no other TTS variable is referenced anywhere in code. `OPENROUTER_API_KEY` is the Gemma **text** layer (the Voice Layer), not audio.

**CSP and headers.**
- There is no middleware and no meta CSP. The CSP is the `vercel.json` header for `/(.*)` (line 38, VERIFIED):
  - `default-src 'self'`
  - `connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://accounts.google.com wss://ws.eodhistoricaldata.com https://*.vercel.app`
  - **no `media-src`**
- What that means:
  - **Audio from another domain is blocked** (media falls back to `default-src 'self'`), and so are `data:` and `blob:` audio.
  - **A WebSocket to any TTS service is blocked**; the only `wss:` allowed is the EODHD feed.
  - **Same-origin audio would play**, e.g. an `/api/...` route returning `audio/mpeg`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (`vercel.json:34`, VERIFIED) blocks microphone input.

**The Shadow component (read only; nothing changed).**
- Files: `src/components/CommandCenter/ShadowStage.jsx`, `ShadowCanvas.jsx`, `ShadowStill.jsx`, and `hub/shadowCanvas.js`, `shadowGeometry.js`, `shadowBloom.js`, `shadowStatus.js` (ASSUMED list).
- It is named in the copy as "Shadow · your research partner" (`hubCopy.js:83-84`, VERIFIED).
- **No tap handler on Shadow itself:** it renders as `role="img"` (`ShadowCanvas.jsx:241`, VERIFIED). Clicks in the stage go to the area controls (`ShadowStage.jsx:160-167`, ASSUMED).
- **No speaking state:** its states are `ambient`, `still` and `processing` only (`hubCopy.js:107`, VERIFIED). It "blooms" on area events and speeds up while processing (ASSUMED).
- **Separate component:** the AgentPresence face (`src/components/AgentPresence/`) has a mouth, but it is mood-driven, not speech-driven. Its binding explicitly drops "agent-speaking" as a signal with no real source (`presenceBinding.js:99-101`, VERIFIED).

## 4. Stale-brief root cause and the fix I would make (described only; nothing applied)

**Root cause.** In heavy earnings weeks the brief's answer is longer than its 2,500-token output cap. Three things make it so:
- the earnings list is unbounded (every >$25B report this week is marked "high");
- the prompt orders the model to list every event;
- each event carries a ~140-character explanation.

The answer is cut off inside `keyEvents`, arrives without `themes`, fails the shape check, and is discarded. By design the stored brief is not overwritten. There is one run a day and no retry, so a single failure means the whole day shows the last good brief. This has happened on 13 weekdays since July (§3 Q2).

**What a fix has to respect: the time budget.**
- Raising `max_tokens` alone turns "Malformed" into "Sonnet timeout (45s)". Today's run already used ~41 s of model time.
- The limits are the 45 s race (`compute-daily-regime-brief.js:67`), `maxDuration: 60` (`:31`) and SDK `maxRetries: 2` (`:60`). A retry cannot fit inside 60 s.

**The fix I would make (smallest that removes the cause):**
1. **Cap what the model must write.**
   - Render at most N earnings this week in the user prompt (e.g. 8, by market cap or the priority list) and say "+K more".
   - Change the "do not omit … if 5, return 5" wording to "the most important up to N". The rule exists to stop invented events, and that guard stays.
   - Shorten `whyItMatters`.

   This keeps output well under the cap with no timing change.
   - Files: `api/_utils/dailyRegimeBriefPrompt.js` (`:27`, `:87`, `:138-153`, `:229-230`). Possibly `api/_utils/fetchEarningsCalendarEODHD.js:175`, if the cut belongs in the fetcher instead.
2. **Make the failure visible and recoverable.**
   - Log `stop_reason` and `usage` on every call (`compute-daily-regime-brief.js:184-193`).
   - Optionally add a second cron entry (e.g. `45 12 * * 1-5`). It costs nothing on success, because the idempotency guard at `:90-99` skips, and it gives one same-morning retry.

   Files: `compute-daily-regime-brief.js`, plus `vercel.json`, which would take the cron count 44 → 45 and needs the BUILD_RULES §6 count line updated by a founder-cited PR.
3. **Fix the hub's wording (separate, small).**
   - Say "Brief for Fri Oct 23" plus the age ("3 sessions old"), or hide the body past one session, instead of "Last session's brief".
   - Put the day on "Generated …".

   Files: `src/components/CommandCenter/hub/hubCopy.js:497-499`, `hub/useHubBrief.js:29-36`, and their S4 tests (`CommandCenterHub.s4.jsdom.test.jsx`, `hubCopy.s4.guard.test.js`, `useHubBrief.test.js`). This touches the hub, which has a mount guard that needs the full suite.
4. **Optional hardening.**
   - Accept a brief whose `themes` is missing but whose `brief` is intact (degrade instead of discarding).
   - Fix the UTC `today` (`:81`) to the ET date.

**Tests.** No test covers the producer handler or the prompt builder: there is no `*.test.js` for `compute-daily-regime-brief.js` or `dailyRegimeBriefPrompt.js` (searched). Only the fetcher (`fetchEarningsCalendarEODHD.test.js`) and the calendar (`macroCalendar*.test.js`) have tests. A fix would add the first rows: the cap holds on a 50-event week, and a missing `themes` degrades instead of discarding.

**Fenced files: none.**
- The producer, its prompt, its fetcher, `vercel.json` and the hub files are all outside BUILD_RULES §1.
- The one fenced reader (`decide.js` opener) needs no change.
- Option 2's `vercel.json` edit is a §6 cron-budget change, not fence contact.

**Likely self-healing.** The "this week" earnings list shrinks as the week goes on, so the brief will probably succeed again late this week (Thu Oct 29 or Fri Oct 30) and fail again at the next peak week (early-to-mid November). This is INFERRED from the pattern, not observed.

## 5. Dependency map

| DRB output | Reader | Effect if removed | Fenced? |
|---|---|---|---|
| `dailyBrief` (fresh only) | Deploy opener in `decide.js` (S1) | Opener text uses its "brief unavailable" fallback; **no portfolio or score change** | **yes** (file); text-only branch after the battle is created |
| `dailyBrief` (fresh only) | Lazy opener `ensure-opener.js` (S2) | Opener text only | no |
| `dailyBrief` (fresh only) | Battle chat `chat.js` (S3) | Chat text only. Indirect: a player-filed directive in chat reaches the agent's next check; the directive comes from the player, not the brief | no (chat.js); the directive is read by fenced `agentEvalPromptAssembly.js:1240`, unchanged |
| `dailyBrief` (fresh only) | Trade narration and anticipation notes (S4, S5) | Note text only, written after the decision | no |
| `dailyBrief` (fresh only) | Forge Workshop chat (S6), Signal Drop watchlist dialogue (S7) | Chat text only; reaches the agent only if the player compiles or equips something later | no |
| `dailyBrief` (fresh only) | Signal Drop expansion (S8) | none (no in-app caller) | no |
| `keyEvents`, `forDate` | Discover Current Events rail (S9) | none (flag off) | no |
| `dailyBrief`, `forDate`, `generatedAt` (any age) | Command Center hub brief card (C1) | Card shows "No brief available" | no |
| `dailyBrief`, `keyEvents`, `themes` (any age) | Legacy Command Dashboard / Read column (C2), fallback only | Fallback card empties | no |
| hook `loading` | AgentPresence "reading" cue (C3), legacy shells only | One idle cue lost | no |
| *(none)* | Trading prompts (deploy pick, intraday swaps), scoring, regime stamp, Film Room, FantasyTimes, reflection, daily review | **nothing changes** | n/a |

## 6. Founder questions (yours alone to decide)

**FQ-1. Fix the stale brief now, or let it ride until the redesign?**
- The brief fails on the first days of every peak earnings week. The next peak is likely early-to-mid November, before any redesign could ship.
- **Recommendation: fix now, separately.** Cap the events the model must list, and log why a run fails (§4 items 1–2). It is small, non-fenced and reversible, and it does not prejudge the redesign.

**FQ-2. What should the hub card do when the brief is older than one session?**
- Today it says "Last session's brief · for Fri Oct 23" on a Wednesday, with no age limit.
- **Recommendation:** show the true age ("Brief for Fri Oct 23 · 3 sessions old") and collapse the body. Hide it entirely if older than a week.

**FQ-3. Does the existing ruling still stand that the brief is never read by the trading agent?**
- The ruling is recorded in code: "no DRB read is authorized" in the agent's checks.
- **Recommendation: keep it.** Whatever the brief becomes, it informs the player. Any effect on the agent goes through a record the player owns and confirms, never through the brief text itself. It also keeps the trading engine's protected files out of the redesign.

**FQ-4. Which window should a future "daily decision" target?**
- **Ranked setup locks from 7:00 AM ET**, before an 8:30 brief. A morning choice can therefore reach ranked play only the next day, unless either:
  - the brief moves before 7:00 (its market inputs are written by 6:30 and 7:30 AM; 7:30 is too late for a 7:00 deploy), or
  - the choice uses the one live channel (the in-game instruction slot, read every 15 minutes until 3:45 PM).
- BaggerBomb games take the setup at the moment the player deploys.
- Of today's records:
  - the watchlist and its thesis, the archetype, and the leans and tempo reach the next deploy. Leans and tempo reach ranked games only;
  - the hub's "idea" and "preference" surfaces reach the agent never.
- **Recommendation:** decide the window first, before any design work. It fixes the brief's time and narrows the choice to the records that actually reach the agent.

**FQ-5. Task the 2027 economic calendar separately?**
- The brief's hand-entered calendar (Fed decisions, CPI, PPI, PCE, Retail Sales, GDP, Productivity) holds 2026 dates only. FantasyTimes economics coverage uses the same list.
- From late December the brief's "next week" preview, and from Jan 1 both products, silently lose those events.
- **Recommendation: yes,** as its own small task before mid-December.

## 7. What I could not verify, and what would settle it

| Unverified | Why | What settles it |
|---|---|---|
| That the cut-off is `stop_reason: max_tokens` and not, say, an array returned as a string | The handler logs neither `stop_reason` nor the raw tool input; the no-spend rule bars a test call | One logged production run (fix item 2), or one founder-approved local call with today's inputs |
| Why Mon Oct 26 and Tue Oct 27 failed | `vercel logs` returned only today's run (retention) | Vercel Observability with a longer log window, or a log drain |
| EODHD's billing weight for one `/calendar/earnings` request | Not in code | EODHD account dashboard |
| Whether `ELEVENLABS_API_KEY` is set on Vercel and on what plan | The name is in the local `.env.local` (names only checked); Vercel env not read | `vercel env ls` (names only) and the ElevenLabs account |
| Storage-log retention | No lifecycle rule in code; bucket policy not read | GCS bucket lifecycle settings |
| Who is on the cockpit allowlist, and so how many players have idea, research and cockpit records | The list is a server-only env variable (`COCKPIT_ALLOWLIST_UIDS`), not read | `vercel env` (value), with the founder's approval |
| Whether the deployed Firestore rules match `firestore.rules` | Rules are deployed by hand | Firebase console rules history |
| Whether any casual clone already carries leftover leans or tempo | A data question; the inherit list says new syncs copy none | One read of the `agents` documents with `casual-agent-` IDs |
| Subagent-read citations marked ASSUMED in Q5–Q8 | Read by a subagent, not re-read by me | Re-read at the cited lines before building on them |
