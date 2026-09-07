# Voice-layer grounding — Phase 0 discovery (V1.1)

**Date:** September 7, 2026 · **Read-only.** No prompt text changed; no repo file written except this report; no fenced file edited.
**For:** the founder, then Sol. The design (a grounding spec) is written after this is read.
**Base:** `origin/main` at `d1233488` (the #818 pane-flip merge; #816 and #817 are ancestors).
**Model:** Fable (per the brief). The findings below are model-facing and are meant to become honesty contracts.

---

## 0. Preamble — git verification (BUILD_RULES §2 / §3)

| Item | Value |
|---|---|
| Branch (harness-assigned) | `claude/voice-grounding-phase0-discovery-tn3lsa` — created locally from `origin/main`; this report is its first commit |
| HEAD at open | `d1233488122f5946626cbf0015151070e2fa188d` — "Merge pull request #818 from fashraf94/flip/battle-view-character-pane" |
| `git fetch origin` | **Run first**, before any comparison (§3). It pulled new refs (`smoke/character-pane`, `ops/step-minus-1-cron-quiesce`, `ui-redesign`, tag `backup-with-research`) |
| `origin/main` | `d1233488` — identical to HEAD (`git rev-list --left-right --count HEAD...origin/main` = `0 0`) |
| Working tree | Clean at open; clean after every read and after the measurement |
| Other state changes | `npm ci` (759 packages; deps were absent and are needed to execute `buildVoiceLayerPrompt` for item 16). A measurement script lives in the session scratchpad, not the repo. Nothing in the tree was touched. |
| Fence contact | **None.** Fenced files opened only to cite: `agentEvalPromptAssembly.js`, `decide.js`, `agentSwapExecution.js`. No fenced function called in a way that alters state. |
| Reads are against | `main` at `d1233488`. Every `file:line` below is VERIFIED in this session unless marked ASSUMED. |

**Documents read:** `docs/BUILD_RULES.md` · `docs/audits/COMMAND_CENTER_ARC_FOUNDATION.md` · `docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` (the ledger, D-42 → D-98) · `docs/audits/20260903_VOICE_CHAT_TIMEOUT_PHASE0_DISCOVERY.md` · `docs/audits/PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md` · `docs/design/PHASE_A3_RULINGS_AND_AMENDMENTS_V1.md`. The A2 rulings file the brief names does not exist in the tree (§4, discrepancy 1); D-72 and D-80 were read from the ledger rows that fold the A2 rulings in.

**Method.** One reader, every module in the brief read in full (`voiceLayerPrompt.js` 3,681 lines, `chat.js`, `voice-layer-cache.js`, `voiceLayerAnticipation.js`, `voiceLayerTradeNarration.js`, `directiveGate.js`, `debate.js`), the fenced assembler read only at the render sites, plus targeted greps for every absence claim. NOT FOUND and NOT MEASURED are stated as such; nothing inferred is presented as read.

---

## 1. Executive verdict

**The narrator and the decider share one text and nothing else.** At chat time the character's prompt is the cache's engine-composed briefs, the scoreboard, the last five trades and its own conversation. The decider's rationale for a hold, its hypothesis, its receipts and the evidence it weighed never enter that prompt. The one decider sentence the narrator does see is a swap's `rationale`, and only when a swap happened. Everything else it says about the decider's plans it composes.

**The "watching" voice is mandated on both sides of the fence.** The fenced eval prompt tells the decider to flag candidates it is "watching for the trigger" and to write "the specific condition that would make you act"; the non-fenced anticipation prompt then requires "eyeing / watching / keeping a closer eye on" and gives "I'm rotating out" and "I'd rotate it into Core" as target shapes. Exhibits 2 and 4 are the prompts working as written. The candidate list is never persisted on the check (D-79), so Bench cannot show it and the narrator cannot be checked against it.

**The chip → gate → reply loop resolves the directive after the reply is written.** The model composes its prose and its proposal in one call; the gate maps the proposal's id to allowlist text afterwards; the resolved text is never shown to any model, on this turn or the next. The code-owned status line that would make the acknowledgment honest has no client consumer on either surface today. Exhibit 1 is the confirmation rule doing what it is told ("receipt-plus-intent") against the chip's phrasing.

**Research questions route nowhere.** `research_only` is a model-emitted label the gate turns into a null write; no data path is called. The decider's "EPS revisions +47.2%" came from a fenced fundamentals block the narrator's cache never copies. The seam is data asymmetry, and the character's "I don't have that" is the one honest line in the exhibits.

| # | Question | Verdict | Anchor |
|---|---|---|---|
| A1 | What the voice prompt is assembled from | **CONFIRMED** — briefs, scoreboard, last 5 trades, conversation; `evaluations[]`, `strategyBrief`, receipts, evidence absent; `battle.directive` also absent from the chat prompt | `voiceLayerPrompt.js:2911-3005`, `chat.js:411-431` |
| A2 | The cache's per-symbol text | **FOUND** — engine code only, no model call; 15-min cron, daily technicals; one shared field with the decider (`intraday`) | `voice-layer-cache.js:112-293`, `:649-839` |
| B3 | The decider's evidence blocks | **FOUND** (fenced, cited) — 14 blocks; "ARCH score" **NOT FOUND** in the eval prompt | `agentEvalPromptAssembly.js:1122-1286` |
| B4 | Where any of it persists | **TABLE §2.B4** — the words persist (`evaluations[]`); the evidence mostly does not | `agent-evaluate.js:2628-2668`, `:2710` |
| B5 | The minimum non-fenced write | **ONE SENTENCE §2.B5** — a code-composed evidence stamp on the evaluation entry, beside D-79's candidates; non-fenced | `agent-evaluate.js:2628-2668` |
| C6 | The anticipation path | **FOUND** — "Eyeing CRWD here..." originates in the fenced eval prompt; the voice prompt requires the vocabulary | `agentEvalPromptAssembly.js:485-511`, `voiceLayerPrompt.js:3490-3558` |
| C7 | Trade narration's input | **FOUND** — the trade's `rationale` (the decider's tick rationale on autopilot swaps), asked to translate, not restate | `voiceLayerTradeNarration.js:117-136`, `voiceLayerPrompt.js:3315-3330` |
| C8 | The intention vocabulary | **LIST §2.C8** — 27 sites across four prompts, the opener template and the elicitation table | see list |
| D9 | Chip generators and the gate's mapping | **FOUND** — two generators; the mapping is model-chosen id → code text, after the reply, before the write; **no preview or dry-run** | `buildArenaModel.js:41-55`, `chat.js:537-553`, `directiveGate.js:59-95` |
| D10 | What the reply prompt receives | **CONFIRMED** — the user's text only; the resolved directive reaches no model call; the acknowledgment must be code-rendered | `chat.js:463-468`, `:584-607` |
| D11 | P-7 precisely | **FOUND on both sides**; the quoted chat-side string **NOT FOUND**; `ignoredDirectiveIds` write-only with a live instruction | `evalIdentityBlocks.js:57-58`, `decide.js:262`, `voiceLayerPrompt.js:117`, `agentEvalPromptAssembly.js:192` |
| E12 | The research seam | **CONFIRMED** — model-emitted label, deterministic null, no data path | `directiveGate.js:56, :72-74`, `voiceLayerPrompt.js:75, :96` |
| E13 | `debate.js` | **CONFIRMED unchanged**; the modal is mounted but its trigger is never passed | `debate.js:84-106, :159-169`, `AgentBattleScreen.jsx:1094, :2600` |
| E14 | The screener as a source | **FOUND** — one doc, 239 names, deterministic, callable server-side; fundamentals mirror sits on the same entries the cache already reads | `screenStocks.js:5`, `voice-layer-cache.js:741-752` |
| F15 | The hypothesis field | **CONTRADICTION FOUND** — schema forbids it in `rationale`; the fenced prompt's rule and all three examples put it there; frequency **NOT MEASURED** | `agentEvalToolSchema.js:41-46`, `agentEvalPromptAssembly.js:522-533` |
| G16 | Token cost | **MEASURED** — +980 tokens for all three blocks on a 7,779-token baseline (~9.3k total) | §2.G16 table |
| G17 | Fence status | **TABLE §2.G17** — every voice-side file is non-fenced; the eval assembler and the tool-call chain are the fence | BUILD_RULES §1 |
| H18 | Two surfaces, one endpoint | **FOUND** — five League branch points, all budget; prompt, gate and timeout identical; the League client drops every non-prose field | `chat.js:214, :278, :300-316, :692, :732-745`, `useArenaEngine.js:87-100` |
| H19 | The template opener | **FOUND** — the book and archetype are persisted facts; "I'll flag anything that starts moving" is a promise nothing delivers | `openerTemplateFloor.js:77-81` |
| H20 | The dark newsLines block | **FOUND** — battle fall-through only, framed as context; a different corpus and window from the decider's story join | `voiceLayerPrompt.js:1773-1783, :2984`, `agentTriggerGate.js:196-236` |
| H21 | Latency p50 / p95 | **NOT MEASURED** — the field lands in GCS `shadow/conversations/`, no reader exists, no credentials here | `chat.js:471`, `shadowLogger.js:52, :71` |
| H22 | Anticipation cadence | **NOT MEASURED**; re-narration is allowed by construction — budget is the only dispatch condition, no dedupe, no memory | `agent-evaluate.js:2852-2865`, `voiceLayerAnticipation.js:218-220` |

---

## 2. Findings

### A. What the narrator reads today

#### A1 — The voice prompt's assembly · CONFIRMED

The endpoint builds the system prompt once per turn at `api/agent/chat.js:420-431`, passing `agent`, `battle`, the elicitation target, the last-10 history, `anchorContext`, `marketSnapshot` (the cache doc), `mode`, the review arrays and the capabilities manifest. The battle fall-through of `buildVoiceLayerPrompt` assembles the blocks at `api/_utils/voiceLayerPrompt.js:2911-3005`:

| Block (in order) | Builder | Source field | Window |
|---|---|---|---|
| Identity | `:2912-2916` | `agent.name`, `agent.archetype`, `agent.stats` | — |
| `GAME_MECHANICS` | `:26-31` | static | — |
| `OUTPUT_FORMAT` | `:33-61` | static | — |
| `ARCHETYPE_PROPOSAL_BLOCK` | `:83-97` (pushed `:2974`) | static, gated on the archetype block | — |
| Partner model | `:912-932` | `agent.partnerProfile` | 15 dimensions |
| Convictions | `:934-956` | `agent.convictions` (confidence ≥ 0.3), `agent.consolidatedInsight` | top 8 |
| Anchor | `:2925` | the string `chat.js:355-363` builds from `indexIntelligence/marketContext` + today's `dailyRegimeBrief` | — |
| Portfolio briefs | `:1674-1722` | `voiceLayerCache.portfolioBriefs[]` | every held name |
| Bench briefs | `:1724-1752` | `voiceLayerCache.benchBriefs[]` | every bench name |
| Newsroom Wire | `:1773-1783` (pushed `:2984`) | `voiceLayerCache.newsLines` — **absent while dark** | ≤ 240 chars per symbol |
| Scout alerts | `:1754-1762` | `voiceLayerCache.scoutAlerts[]` | ≤ 5 (cache `:518`) |
| Market context | `:1785-1820` | `voiceLayerCache.marketContext` | — |
| `DATA_CONFIDENCE_RULE` | `:1822-1823` (pushed `:2987`) | static, only when a cache doc exists | — |
| Archetype four zones + menu | `:2536-2551` | `archetypeAdjustments` zones + allowlist | — |
| `THIRD_PATH_RULE`, user levers, `TWO_LEG_SIGNAL_RULE` | `:69-78`, `:2560-2575`, `:102-109` (pushed `:2995`) | static + `capabilitiesManifest` | — |
| Battle state | `:958-999` | `battle.gameMode`, `scoreState`, portfolio symbols + tier, **`trades` last 5 with `rationale || trigger`** (`:973-976`), `cronState.consecutiveEvalFailures` (`:986-989`) | trades 5 |
| Few-shot | `:2952` → `:214-227` | static per phase | — |
| Elicitation target | `:2955` → `chat.js:64-105` | `agent.partnerProfile` confidence | — |
| Phase rules | `:2958` → `:113-210` | static per phase | — |

The conversation history is the last 10 exchanges **filtered to those with a non-empty `userMessage`** (`chat.js:411-417`), so every agent-initiated exchange — opener, trade narration, anticipation — is dropped from what the model sees of its own past.

**Confirmed absent** (grep of `voiceLayerPrompt.js` and `chat.js`): `evaluations` appears only in the EVAL ENGINE HEALTH string (`:988`) and a comment (`chat.js:637`); `strategyBrief` nowhere; `statusFeed` only in comments (`:3469`, `chat.js:637`); `innerMonologue` nowhere; `.hypothesis` nowhere. The fenced assembler is imported for one helper only, `computeTimeRemaining` (`:9`). The active `battle.directive` is **also** absent from the chat prompt: `buildActiveDirectiveBlock` (`:3347-3360`) is called only by trade narration (`:3406`) and anticipation (`:3632`), never by the battle fall-through.

**Meaning.** The narrator's only decider text is a swap's rationale, and only for the last five swaps; on a hold day it reads nothing the decider wrote. This re-verifies the Sep 3 measurement's "never reaches the prompt" with one nuance that report did not state: the trade line does carry the decider's words.

#### A2 — `voiceLayerCache.portfolioBriefs[]` and per-symbol text · FOUND

**Fields** (`api/cron/voice-layer-cache.js:200-231`, `:262-272`, `:286`): `symbol`, `tier`, `price`, `changePercent`, `technicalScore`, `technicalRank`, `rsPercentile`, `trendSummary`, `momentumSummary`, `supportLevel` / `resistanceLevel` (always `null`, `:210-211`), `thresholdNote`, `atrPercent`, `sector`, `sectorTechnicalTotal`, `nearestSupport`, `nearestResistance`, `distanceToSupportPct`, `distanceToResistancePct`, `distTo52wkHigh`, `nr7Flag`, `macdFreshBullishCross`, `macdFreshBearishCross`, `divergence`, `lastCandlePattern`, `existingBadges`, `thresholdProximity` (`currentMultiplier`, `baseATR`, `redZone`, `swapLock` — from the fenced scoring helpers `detectRedZone` / `isSwapLocked`, called not edited), `intraday` (`vwap`, `currentPrice`, `vwapDeviation`, `sma20_5m`, `sessionDate`). Bench briefs mirror the shape minus tier and threshold fields, plus `assetClass`, `cooldownUntil`, `cooldownActive` (`:401-437`).

**Author: engine code.** The cron imports no model client (`:8-23`); `trendSummary` and `momentumSummary` are code-composed sentences from SMA and factor thresholds (`:141-178`); scout alert headlines are templates (`:477-478`, `:491-492`, `:505-506`). No model-authored text exists in the cache. `forgeSeeds` is written as `null` every tick (`:814`) — a dead field.

**Sources** (`:738-743`): EODHD real-time bulk prices (`:38-91`), `indexIntelligence/marketContext`, `indexIntelligence/stockRankings` (one doc, `.stocks[]` → `rankingsMap`, `:749-752`), `stockTechnicalScores/{symbol}`; `intraday` is read off `battle.cronState.intradayMomentum` (`:771`, `:286`), which the eval cron persists every tick (`agent-evaluate.js:1799`, `:2767`) — **the one evidence object the decider and the narrator share.** Freshness is stamped on the doc: prices `rest_15min`, technicals / rankings / market context `daily` (`:808-813`).

**Cadence.** `vercel.json:161-162` schedules the cache `*/15 13-20 * * 1-5` (UTC); the header comment at `:6` agrees (BUILD_RULES §6 check passed). The handler skips unless the market is `OPEN` or `PRE_MARKET` (`:660-663`). The eval cron runs `*/15 13-21` (`vercel.json:157-158`). So the cache's last write of a session lands at 19:45 UTC in summer time (the 20:00 tick sees `CLOSED_AFTERHOURS`) while evaluations continue through 21:45 UTC — the late-day gap is one to two hours (ET translation ASSUMED per DST; the schedules are VERIFIED).

**Meaning.** Everything the narrator "knows" about a name is a daily technical read plus a 15-minute price, composed by code; the decider's per-tick view (VWAP, risk status, regime, fundamentals, stories) is not in it, except VWAP.

### B. The decider's evidence — what it saw, and where any of it persists

#### B3 — The per-position evidence block (fenced — read to cite only) · FOUND

`buildLiveContextBlock` (`api/_utils/agentEvalPromptAssembly.js:1122-1286`) renders, in order:

| Evidence | Render site | Source object |
|---|---|---|
| Macro benchmarks SPY / QQQ / BTC | `:1138-1139` | `macroPrices` |
| Vision state | `:1144` | `momentumData.visionState` |
| Regime context — `MARKET POSTURE`, per-stock `STOCK REGIMES` | `:1150-1152` → `:1762-1779` | `momentumData.marketPosture`, `momentumData.regimes` |
| Active positions CSV — tier, symbol, sector, entry, prices, gain, ATR multiple, badges, ATR%, and under `PROFIT_TARGET_EXECUTOR_ENABLED` LockNow / NextBonus / Levels | `:1163-1165` → `:1458-1487` | `assetScores`, `prices`, `rankingsMap` |
| Bench CSV | `:1168` → `:1489-1517` | `battle.portfolio.bench`, `prices` |
| Bench technical context — trend (`:1588-1604`), momentum RSI / MACD / divergence (`:1606-1629`), volatility, volume, **relative strength `rsPercentile` + `sectorRSPercentile`** (`:1664-1684`), levels (`:1686-1710`), recent action, "Composite" (`:1719-1726`) | `:1172-1177` → `:1535-1586` | `rankingsMap`, `techScoresMap` |
| **Fundamentals** — P/E vs sector median, P/B, revenue growth, market-cap class, **`EPS rev 30d`**, beat rate, surprise percentile, with a basis note | `:1182` → `fundamentalsRender.js:134-200` (`:105` is the EPS line) | `rankingsMap[sym].fundamentals` — the mirror `compute-index-intelligence.js:536-560` writes; `FUNDAMENTAL_MIRROR_ENABLED = true` (`featureFlags.js:1549`) |
| Closed trades with ghost prices | `:1186` | `battle.trades`, `prices` |
| Trigger (why it was woken) | `:1190-1193` | `triggers` |
| **Intraday momentum snapshot** — VWAP $ and deviation, Bollinger width percentile with `[SQUEEZE]`, `NR7: YES`, daily range | `:1197-1201` → `:1826-1863` | `momentumData.vwap` (intraday fetch), `momentumData.rankings` (stockRankings) |
| **Risk status** — per symbol `HOLD` / `LOCKED (detail)` / `action (reason)`, rendered only when one is non-HOLD | `:1205-1207` → `:1784-1804` | `momentumData.riskStatus`, built at `agent-evaluate.js:1240-1382` through the fenced risk manager |
| Directive + standing leans | `:1228-1242` | `controlPromptRenderer.resolveControls` |
| Institutional intelligence | `:1244-1255` | Forge rules |
| **FantasyTimes stories** — bare headlines with reporter, age, sentiment, tickers (`agentNewsContext.js:293-302`), or the ranked intelligence block when Forge rules are equipped (`:207`) | `:1257-1276` | `news` from `fetchRecentNews` (`agentTriggerGate.js:196-236`), called at `agent-evaluate.js:1867` |
| Your last 3 decisions — evalId, age, action, `rationale` first 80 chars, `hypothesis` first 60 chars | `:1279-1283` → `:1389-1402` | `battle.evaluations` |

"ARCH score" is **NOT FOUND** in the eval assembler (no `arch_scores` / `archScore` / "ARCH score" occurrence). `arch_scores` is a `stockRankings` field (`voiceLayerPrompt.js:2261`) consumed by `computeArchetypeRankings` at draft and on the scouting board (`scouting-board.js:18`), not by the intraday evaluation.

**Meaning.** The decider decides on roughly fourteen blocks; the narrator's cache reproduces parts of four of them (levels, signals, trend, VWAP) from daily documents, and none of the fundamentals, regimes, risk verdicts or stories.

#### B4 — Persistence table · item · persisted where · author · staleness · in the voice prompt today

| Evidence item | Persisted where (readable at chat time without recompute) | Author | Staleness | In voice prompt today |
|---|---|---|---|---|
| Intraday momentum (VWAP, deviation, 5-min SMA20) | `battle.cronState.intradayMomentum` (`agent-evaluate.js:1799`, `:2767`) → cache brief `intraday` (`voice-layer-cache.js:286`) | eval cron (code) | per eval tick, then per cache tick | **Yes** — `buildIntradayLine` `voiceLayerPrompt.js:1241-1275` (held names only) |
| Bollinger width percentile (`[SQUEEZE]`) | `indexIntelligence/stockRankings.stocks[].bBandwidthPercentile` (write `compute-index-intelligence.js:1335-1361`; daily 10:30 / 11:30 UTC + hourly intraday mode 14–20 UTC, `vercel.json:149-154`) | index-intelligence cron (code) | ≤ 1 h during the session | **No** — not copied into the brief (`voice-layer-cache.js:200-231`) |
| NR7 flag | same `stockRankings` entry → cache `nr7Flag` (`:226`) | same | same | **Yes** — signals line `:1208` |
| Relative strength vs SPY (`rsPercentile`) | `stockTechnicalScores/{sym}.factors.rsPercentile` → cache `:134`, `:207` | index-intelligence cron | daily | **Yes** — header `:1131-1133` |
| Sector relative strength (`sectorRSPercentile`) | `stockTechnicalScores/{sym}.factors.sectorRSPercentile` (eval reads it `:1678-1679`, bench only) | same | daily | **No** — not in the brief |
| ARCH score (`arch_scores`) | `stockRankings.stocks[].arch_scores` | rankings cron | daily | **No**; and NOT in the eval prompt either (B3) |
| EPS revisions and the rest of the fundamentals line | `stockRankings.stocks[].fundamentals` mirror (`compute-index-intelligence.js:536-560`, `:1138`) from `estimatesCache/latest` (`compute-estimates.js:458`, weekly Saturday 10:00 UTC, `vercel.json:81-82`) with a `computedAt` vintage (`fundamentalsRender.js:157`, `:172-175`) | estimates + index-intelligence crons (code) | up to a week; vintage-marked | **No** — the cache already holds the same `rankingsMap` entry (`voice-layer-cache.js:749-752`) and copies none of its `fundamentals` |
| FantasyTimes story join (which stories were in the prompt) | **NOT FOUND.** Stories persist in `fantasyTimesStories`; the per-tick join is transient (`agent-evaluate.js:1867`); only `cronState.seenStoryIds` — the ids of stories that *triggered* an evaluation — is written (`:1916-1922`) | — | — | **No** (the dark Wire block is a different corpus — H20) |
| Risk status (WARNING / LOCK verdicts) | **NOT FOUND** as such. Transient `momentumData.riskStatus` (`:1240-1382`); the evaluation entry keeps only the outcome — `guardrailOverrides`, `guardrailSourceNote`, `downgraded` (`:2657-2662`). The cache computes its own `thresholdProximity` (`voice-layer-cache.js:262-272`) from different helpers — a parallel, not the same object | — | — | Proximity yes (the cache's own); the risk manager's verdicts no |
| Market posture / per-stock regimes | `evaluations[].marketPosture` (`:2659`); per-stock regimes not persisted; the cache carries `marketContext.regime` from the same `indexIntelligence/marketContext` doc (`voice-layer-cache.js:624`, ASSUMED the same field) | eval cron / index-intelligence | per tick / daily | Regime yes; posture and per-stock regimes no |
| The decider's `rationale`, `hypothesis`, `decision`, `conviction`, `triggers`, `symbolOut/In`, `tier`, `haikuError` | **`battle.evaluations[]`** (`agent-evaluate.js:2628-2668`, written `:2710-2721`, capped at 150) — the battle doc `chat.js` already loads (`:232-236`) | eval cron persisting the model's tool output | per tick | **No** |
| The whole eval prompt as the decider saw it | `agentBattles/{id}/shadowDiffs/{tickId}` (`shadowAssemblyCapture.js:15`, `:243-251`; `SHADOW_ASSEMBLY_ENABLED = true`, `featureFlags.js:1343`) — but by payload rule it holds **hashes only** in the identical steady state and full texts only on divergence (`:20-22`); plus the GCS stream `shadow/evaluations/` with rationale / hypothesis / triggers / scores, not evidence (`agent-evaluate.js:2686-2707`) | eval cron | per tick | **No** — and neither is a chat-time read |

**Meaning.** The decider's *words* are already persisted where the narrator could read them for free; its *evidence* is not, except VWAP, and the cache's technicals are a different tick from the decider's.

#### B5 — The minimum non-fenced write · ONE SENTENCE

Stamp a code-composed per-position evidence summary — built from the same `momentumData`, `rankingsMap`, `riskStatus` and `news` objects the assembler was handed at `agent-evaluate.js:1999-2001` — onto the `evaluation` record at `agent-evaluate.js:2628-2668` before the `:2710` write, beside the tick's `anticipationCandidates` that D-79 already records as a non-fenced write.

**Fence status:** `api/cron/agent-evaluate.js` is not on the §1 list; the evaluation-entry shape has non-fenced precedent (D-52 the Heard stamp, D-79 the candidates), and `evaluations[]` is an existing field so the `createAgentBattle` doc shape is untouched. A cheaper alternative — copying more `ranking` fields into the cache brief — would be the *cache's* evidence at the cache's tick, not the decider's; the spec should say which it is showing.

### C. Idle narration and self-prediction

#### C6 — The anticipation path · FOUND

**Origin (fenced, cited).** `agentEvalPromptAssembly.js:485-511` ("ANTICIPATION CANDIDATES — WHEN TO POPULATE"; a second variant at `:688-714`): `:487` "flag candidates worth narrating aloud to the user as pre-action watching … The Voice Layer (Gemma) will turn each entry into one short coach-style chat message (**"Eyeing CRWD here..."**). This is the agent thinking out loud"; `:492` bench candidates — "You are not swapping it in yet — **you are watching for the trigger**"; `:493` holdings — "**you are watching for the next session**"; `:495` "You did not flag this candidate in your previous evaluations — you are flagging it now … **you do not have a previousRegime field**"; `:501` `threshold` — "the specific condition that would make you act"; `:489` "DEFAULT IS EMPTY … 1-3 entries across ALL evaluations for that day". The tool schema repeats it: `agentEvalToolSchema.js:157-192` — `direction` enum `potential_entry | potential_exit` (`:169-173`), `threshold` example "**If it holds above the 20-day on the next test, I would rotate it into Core**" (`:180`).

**Handoff.** `agent-evaluate.js:2052-2058` queues every candidate with the tick's `evalId`; dispatch at `:2852-2865` when `TIME_BUDGET_MS − elapsed > 12_000` (`TIME_BUDGET_MS = 290_000`, `:130`), one `generateAnticipation` per candidate in `Promise.allSettled`, each under a 10 s abort (`voiceLayerAnticipation.js:145-157`); below the budget the batch is skipped with a shadow breadcrumb (`:2866-2887`). `generateAnticipation` re-reads battle, agent, market context, DRB and the cache (`:76-82`), builds the prompt (`:120-130`), writes one exchange `messageType: 'anticipation'` with `anticipationContext.{symbol, direction, threshold, evaluationId}` (`:190-208`) — the candidate's `signalSummary` and `rationale` are **not** persisted on the exchange, only in the shadow log (`:242-248`). The `_scratchpad` is requested at `voiceLayerPrompt.js:3475` and persisted as `scratchpad` (`voiceLayerAnticipation.js:180-182`, `:193`).

**The instruction text (non-fenced).** `voiceLayerPrompt.js:3490-3558`: `:3499` "Use observational language (**"eyeing", "watching", "keeping a closer eye on", "have my eye on"**)"; `:3502` "Eyeing CRWD on the bench."; `:3504` the threshold "what would make you act … THIS IS NOT OPTIONAL"; `:3514` "One more day of strength and it's a Star tier candidate"; `:3515` "One more session of underperformance and **I'm rotating out**"; `:3531` "If it holds above the 20-day on the next test, **I'd rotate it into Core**"; `:3537` "If we get one more session of underperformance, **I'm rotating out**"; `:3540` "**I'd consider it for Support tier**"; the identity `:3613` "tell the user what you're watching and what would make you act". The candidate block `:3566-3588` hands over `Signal summary`, `Threshold (action condition)`, `Additional rationale`.

**Meaning.** Exhibit 4's "I'll consider it a high-conviction Core swap" and "I'm rotating out … to stop the bleed" are the direction examples applied to a `threshold` sentence the decider wrote because the fenced prompt asked for a condition "that would make you act". The decider authored the conditional promise; nothing persisted it on the check; the narrator restated it in the first person.

#### C7 — The trade-narration path · FOUND

`generateTradeNarration` receives the `closedTrade` and reads `closedTrade.rationale` (`voiceLayerTradeNarration.js:117-120`), computes provenance (`:117`), and builds the prompt with `swap`, `rationale`, `provenance`, `directive` (`:124-136`). The prompt renders `Provenance:`, the snapshot legs via `buildSwapEntryBlock` (`voiceLayerPrompt.js:3320`), then "**Rationale (translate this — do not invent reasoning):**" (`:3324`). The instructions ask for a four-element composition — action, headline reason, replacement reason, optional door (`:3249-3253`) — "Translate it faithfully into natural language" (`:3258`), "must reflect the actual rationale provided … do not invent reasoning" (`:3263`). It is asked to **compose a translation**; verbatim restatement is neither required nor forbidden.

Which rationale: on an autopilot swap the trade's `rationale` is the decider's tick rationale (`agent-evaluate.js:2242` sets `rationale: haikuResult.rationale` on the swap metadata; `agentSwapExecution.js:113` documents that shape landing on the trade record — ASSUMED the trade field is that string, consistent with D-72's "the motive is `rationale`"); on a risk swap it is the risk manager's line (`:1545`). The narration exchange carries symbols, tier, timestamp, evaluationId and provenance (`:204-211`), not the rationale — the tape's trade card reads it from `trades[]`, not from the exchange.

#### C8 — Every instruction that invites the character to state its own intention or forecast · LIST

The vocabulary G2 removes, by surface:

**Battle chat — phase rules and examples (`api/_utils/voiceLayerPrompt.js`)**
1. `:117` (repeated verbatim at `:154`, `:186`) — the CONFIRMATION rule: "Acknowledge briefly … as receipt-plus-intent … ('Noted — carrying that into my next read.' / 'Got it; that's my lean now.') … ('I'll lean toward the strongest semis on my next read' / 'that's the bias I'm carrying into each look now') … 'I'll revisit if the setup tightens'".
2. `:118` — "I'm actually seeing some opportunity in our Star picks — CF and EIX have solid setups."
3. `:125` — CLOSING RULE: "state which option YOU lean toward … 'I'm leaning aggressive here … You on board or want to play it safer?'"
4. `:155` — "I'm seeing something interesting on AVGO — the technicals are lining up for a breakout. Want me to break down the setup or just roll with it?"
5. `:158` — "I'm leaning toward trusting what we've built. Talk me out of it?"
6. `:160` — "Based on how we've been running this, I'd go aggressive-momentum with a 3-stock sector cap."
7. `:187` — Mastery: "Lead EVERY conversation with a complete, pre-formed plan … 'Here's what I'm running and why.'"
8. `:188` — "Day-to-day execution is on you."
9. `:217` — DISCOVERY_EXAMPLE: "I'll lean toward the strongest semis on my next read … One thing I'll watch — if AVGO stalls at resistance while NVDA keeps pushing, I might revisit that Core slot. I'll flag it if I see it."
10. `:223` — MASTERY_EXAMPLE: "My lean is to drop AMD from Core and bring in AVGO … That's the lean I'm taking into the open unless you push back."
11. `:227` — CONFIRMATION_EXAMPLE: "I'll lean toward semi and software names … That's the bias I'm carrying into my next read; I might still pass if the setup isn't there, and my risk rules act on their own meanwhile."
12. `:78` — THIRD_PATH null-write hand-off (the *permitted* offer shape, still first-person intent): "I'd lean toward tightening the stop if you want me to".

**First message (`buildFirstMessagePrompt`)**
13. `:3040` — "One sentence naming 1-3 tickers … that you're **watching** or starting with."
14. `:3067` — "I'm leaning into semis today — TSM and AMAT specifically".
15. `:3070` — "I'm starting tight with LLY as the conviction play and KO as ballast."
16. `:3073` — "RKLB's the one I'm curious about".
17. `:3062` — the NOT-THIS example still models "starting the day watching RKLB and PANW".

**Anticipation (`buildAnticipationPrompt`)**
18. `:3499` — "eyeing", "watching", "keeping a closer eye on", "have my eye on" (required register).
19. `:3502` — "Eyeing CRWD on the bench."
20. `:3504` — "state what would make you act".
21. `:3514` — "One more day of strength and it's a Star tier candidate."
22. `:3515`, `:3537` — "One more session of underperformance and I'm rotating out."
23. `:3531` — "I'd rotate it into Core."
24. `:3540` — "I'd consider it for Support tier."
25. `:3613` — "tell the user what you're watching and what would make you act".

**Trade narration** — `:3287` "JNJ gives the portfolio some ballast **while we wait for clarity**" (mild; the rest is past tense by design).

**Outside the prompt module**
26. `api/_utils/openerTemplateFloor.js:80` — "**I'll flag anything that starts moving** — anything you want me watching from the open?"
27. `api/agent/chat.js:73`, `:76` — elicitation instructions "'act now at open' vs 'wait for confirmation'" and "Present a decision the agent could make independently."

**Fenced origin (cite only):** `agentEvalPromptAssembly.js:487` "Eyeing CRWD here..."; `:492-493` "you are watching for the trigger / for the next session"; `:501` and `agentEvalToolSchema.js:180` "the specific condition that would make you act … I would rotate it into Core". Removing the voice-side vocabulary alone leaves the decider still writing these sentences into `threshold`.

### D. The chip → gate → reply loop (G3, exhibit 1)

#### D9 — Chip generators and the gate's mapping · FOUND

**Two generators.**
- Code-authored, League only: `buildAskChips(youRank)` (`src/components/League/battleArena/buildArenaModel.js:41-55`) — five fixed strings plus one standing-aware line; each chip's text *is* the message (`:36-38`); sent verbatim with `leagueAsk: true` (`useArenaEngine.js:87-89`); flag-gated (`:548`).
- Model-authored, both surfaces: `suggestedActions` — requested by `OUTPUT_FORMAT` (`voiceLayerPrompt.js:43`, rule `:57` "2-3 genuinely different strategic choices as tappable buttons"), returned (`chat.js:588`), persisted on the exchange (`:662`), rendered on the last agent message (`AgentChat.jsx:355-360`), and a tap sends the chip text as the next user message verbatim (`:930-932` → `sendMessage` → POST `:876-883`). Nothing in the rule forbids a symbol-level action chip.

Exhibit 1's "Rotate NVDA to VLO (Energy)" can only be the second kind (the six League strings are fixed), so exhibit 1 is a Battle View chat turn.

**Where the mapping happens.** Inside the same model call that writes the reply, the model emits `_archetypeProposal` (`voiceLayerPrompt.js:83-97`) with a `selectedAdjustmentId` from its menu; after the call, `gateDirective` (`chat.js:537-547`) validates the id (`directiveGate.js:59-95`) and substitutes the code-owned canonical text (`:80` `getCanonicalText`) — "Widen the spread (target more sectors)" is `DV-02` (`src/data/archetypeAdjustments.js:158`). The chip's text never becomes directive text (`directiveGate.js:12`, `:89`). Order: reply generated (`chat.js:463-468`) → gate (`:537`) → write (`:686-708`).

**Preview before send: NOT FOUND.** The gate takes the parsed model output (`directiveGate.js:158-168`); there is no endpoint or dry-run that maps a chip string to an allowlist id without a model call (grep across `api/agent/` and the gate; the only "preview" hits are the compiler's `compilePreviews`, unrelated). The resolved string exists before the client receives it (`chat.js:551`, `:593`) but only after the model has already spoken.

#### D10 — What the reply prompt receives · CONFIRMED

The first call receives the system prompt, the filtered history and `userMessage: sanitizedMessage` (`chat.js:463-468`) — the user's text only. The reply `parsed.response` (`:584`) is composed before the gate runs (`:537`). The resolved directive is never fed to a model: the repair call re-asks for "the SAME conversational response" with a valid proposal (`directiveGate.js:110-113`); the next turn's prompt has no directive block (A1). The resolved text goes to `clientResponse.directive` (`:593`), `extractedRule` (`:585-587`), the exchange (`:645-660`) and the battle slot (`:694-707`).

**Can the reply be constrained?** Not by re-generation — the budget (`GEMMA_TIMEOUT_MS` 19 s + repair inside a 24 s deadline, `chat.js:59-60`) has no room for a second full call. The honest acknowledgment ("Filed: Widen the spread") can be **code-rendered** from the exchange's `directive.text` (one source, §9), which is exactly what `renderDirectiveStatus` already does for the no-change case (`directiveGate.js:47-53`, added to the response at `chat.js:604-606`) — but **no client consumes `directiveStatusLine` today** (grep of `src/`: none; `chat.js:603` "Frontend deferred"), and `AgentChat.jsx:910-918` ignores the response body on success and re-renders from the Firestore exchange. Forbidding the prose from restating the user's phrasing as a plan is a prompt rule; the current CONFIRMATION rule (`:117`) instructs the opposite — "receipt-plus-intent" — which is what produced "I'll be watching the Energy space closely for that VLO setup".

#### D11 — P-7 precisely · FOUND, with one NOT FOUND

**As the ledger records it** (`COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md:336`, `:363`): the identity text says equipped rules "never reverse" the archetype while the reconciler ranks `user_equipped` above `archetype_default` and drops the losing rule.
- Eval side: `EVAL_IDENTITY_SUBORDINATION_CLAUSE` (`api/_utils/evalIdentityBlocks.js:57-58`: "Your equipped rules refine how you apply these principles but never reverse them") with the Ask 2 yield clause acknowledging the falsehood (`:60-66`); the reconciler at `api/agent/decide.js:262-265` (fenced, cited); the DECISION PRECEDENCE block — floors and guardrails › user rules › archetype › defaults (`agentEvalPromptAssembly.js:125-131`, under `EQUIPPED_RULE_PRECEDENCE_ENABLED`); SURVIVAL MODE — "explicit permission to OVERRIDE user directives" at −1.0× ATR (`:191-197`); the leans block "never override … an active directive" (`controlPromptRenderer.js:237`).
- Chat side: the IMMUTABLE CORE zone "never reverse — this is the boundary" (`voiceLayerPrompt.js:2543-2547`); THIRD_PATH "Your archetype is your constitution" (`:70`); the CONFIRMATION rule's honest clause "your reflexive risk rules can act on their own meanwhile" (`:117`) — the one sentence where chat concedes risk precedence; and its EXCEPTION "you may decline in character rather than write a directive you don't believe in" (`:117`) — the nearest thing to "argue".

**The brief's quotation "you can honor or argue directives" is NOT FOUND** anywhere in `api/`, `src/` or `docs/` (§4, discrepancy 2). The contradiction the brief names is real in substance — the chat prompt never states that a filed directive can be overridden by the engine except in that one clause, while the eval prompt says so in three places — but the words are not in the repo.

**`ignoredDirectiveIds`:** schema `agentEvalToolSchema.js:61-66`; the live instruction "you MUST set ignoredDirectiveIds" in the fenced SURVIVAL MODE paragraph (`agentEvalPromptAssembly.js:192`); written on every entry (`agent-evaluate.js:2644`); **no reader** in `api/` or `src/` (grep: only the four sites above and two comments). Write-only, VERIFIED.

### E. The research seam (G4)

#### E12 — How a research question is classified and what follows · CONFIRMED

`research_only` is one of five labels the **model** emits in `_archetypeProposal.classification` (`voiceLayerPrompt.js:87`, rule `:96`). The gate treats it as a deliberate null (`directiveGate.js:56`, `:72-74`) and returns `status: 'no_change'`; the turn writes no directive and routes nowhere. `chat.js` imports no data path (`:1-22`): no `debate.js`, no `getStockAnalysisData`, no `screenStocks`, no fundamentals read. The model answers from the briefs alone, under two honesty rules: THIRD_PATH step 5 "ONE RESEARCH CUE — point them at a real screen to go explore … never a round-trip you'll bring back" (`:75`) and TWO_LEG "There is no catalyst feed in your data — never fabricate one" (`:108`). Exhibit 3's "I have no fundamental feed" is those rules working; the decider's "EPS revisions +47.2%" is the fenced fundamentals block (B3) the cache never copies.

#### E13 — `debate.js` · CONFIRMED unchanged

`maxDuration: 15` (`api/agent/debate.js:10`); owner check (`:72`); **book-only guard** — the symbol must be in `flattenPortfolioServer(portfolio)` (`:84-90`, 404 otherwise); `getStockAnalysisData(symbol, { fields: ['daily', 'price'] })` (`:96`); `calculateAllIndicators(daily)` (`:106`); a Haiku call (`claude-haiku-4-5-20251001`, `:160`) under a 10 s race (`:167-169`); returns `agentResponse`, `citedIndicators`, `conviction`, `suggestedAction` (`:203-215`). Latency ~2–4 s is the foundation's figure (ASSUMED; neither Anthropic nor EODHD is reachable from this environment). Client: `DebateModal` is mounted (`src/screens/AgentBattleScreen.jsx:2600-2606`) and `handleChallenge` exists (`:1094-1097`), but it is never passed as `onChallenge` (grep: the definition is its only occurrence), and the feed's Challenge button renders only when `onChallenge` is provided (`AgentActivityFeed.jsx:482-484`) — so the foundation's "entry point is unwired" still holds, by an unpassed prop.

#### E14 — The fundamental screener as a source · FOUND

- **Endpoint:** `POST /api/screener/chat` (`api/screener/chat.js:1-40`) — Gemma in research mode translates the ask into a `screenSpec`; `screenStocks(stocks, spec)` (`api/_utils/screenStocks.js:396`) runs it deterministically over the daily `indexIntelligence/stockRankings` doc (`:5`), one Firestore read; own `researchSessions` collection, 30-message soft budget.
- **Screenable fields** (`voiceLayerPrompt.js:2229-2263`): `compositeScore`, `fundamentalScore` / `fundamentalRank`, `technicalScore` / ranks, `momentumScore` / rank, `baggerBombFit` / rank, `atrPercentile`, `dailyRange`, `nr7Flag`, `bBandwidthPercentile`, `sma200_position`, `trend`, `recentAction`, realized returns 1W–12M, `arch_scores.*`, `momentumFactors.*`. **UNAVAILABLE by the screener's own list** (`:2269-2273`): price, market cap, P/E, valuation multiples, leverage, sentiment, news. Yet the same `stockRankings` entries carry the `fundamentals` mirror (P/E vs sector median, P/B, revenue growth, market-cap class, EPS revisions 30d, beat rate — `compute-index-intelligence.js:536-560`, `:1138`), which the set-analysis digest already reads for a saved cohort (`voiceLayerPrompt.js:2460-2519`, with forward consensus attributed to analysts).
- **Per-symbol read cost:** the whole doc — 239 names (`api/_utils/rankingConfig.js:359`, length measured by import) — then a map hit. The cache cron reads this exact doc every 15 minutes and builds `rankingsMap` (`voice-layer-cache.js:741`, `:749-752`), so the marginal cost of a per-symbol fundamentals line in the brief is zero reads. Latency: one Firestore get (ASSUMED sub-second; not measured). Cadence: index intelligence daily + hourly intraday (`vercel.json:149-154`); rankings 11:00 UTC (`:69-70`); estimates weekly Saturday (`:81-82`).
- **Callable from `chat.js`?** Yes — `screenStocks` is a pure util and the doc read is the same one the cache uses; no new model. But not *inside* the current turn budget (Hazard 7).
- `stockBriefs/{symbol}` — a weekly text brief (`compute-briefs` Sunday 01:00 UTC, `vercel.json:77-78`; reader `stockBriefService.js:40-67` with a 5-minute memory cache) — is read by the stock analysis endpoint, not by chat.
- **"Ranked by composite score":** the Search screener's caption is literally that string (`src/components/Search/screenerAdapter.js:336-350`) and ranks by `stockRankings.compositeScore`. The tournament spectator strip is also "ranked by composite" (`src/utils/tournamentSurfaces.js:218-238`) but that composite is `agentPoints + 1.5 × userPoints` — a different number with the same word. The brief does not say which surface the exhibit's watchlist is; if it is the Search screener, it is the same `compositeScore` the screener chat ranks by. One fenced labeling note: the eval bench line headed "Composite:" renders `technicalScore` / `technicalRank`, not `compositeScore` (`agentEvalPromptAssembly.js:1719-1726`) — report only.

### F. The hypothesis field

#### F15 — `evaluations[].hypothesis` · CONTRADICTION FOUND; frequency NOT MEASURED

- **Schema:** `rationale` — "Your inner monologue … 3-5 sentences … **Do NOT include the hypothesis here**" (`api/_utils/agentEvalToolSchema.js:38-42`); `hypothesis` — "A specific, falsifiable prediction … **Start with "Hypothesis:"** … graded in your post-battle debrief" (`:43-47`); both required (`:10`).
- **Fenced prompt (cite only):** the monologue rule "5. End with a **Hypothesis:** statement" (`agentEvalPromptAssembly.js:522-524`) and all three example monologues carry `**Hypothesis: …**` inline (`:527`, `:530`, `:533`; the second variant `:730-736`). The prompt asks for it in **both** places; `formatRecentEvals` strips the "Hypothesis: " prefix from the field (`:1399`), evidence the field carries it.
- **How often recent entries carry both:** NOT MEASURED — it needs a read of `battle.evaluations[]`, and this environment has no Firestore or GCS credentials. Exhibit 3's 1:00 PM check shows one entry that does.
- **Display today:** the `hypothesis` field is rendered nowhere on the Battle View — `HypothesisTicker` is imported (`AgentBattleScreen.jsx:61`) and never rendered, and it reads `statusFeed` entries carrying `.hypothesis`, which the cron never writes. The inline copy inside `rationale` renders as bold through D-87's `parseEmphasis` on Bench, Why? and the check card — attributed to the decider by construction, unlabelled as a prediction. The design question for the founder and Sol stands: render the field, labelled, attributed; and decide what to do with the inline duplicate (Hazard 12).

### G. Cost, latency, fence

#### G16 — Token cost of the grounding blocks · MEASURED

Method: `buildVoiceLayerPrompt` executed at HEAD (deps installed for this) with a fixture mirroring the Sep 3 measurement — 6 held, 10 bench, 4 scout alerts, 8 trades, 10 exchanges, 5 convictions, archetype block on; synthetic grounding blocks sized from the tool schema (a 3-5 sentence rationale = the fenced few-shot monologues, one hypothesis sentence, one decision line) — ASSUMED sizes; tokens ≈ chars / 4, the Sep 3 convention.

| Block | chars | ~tokens |
|---|---:|---:|
| Baseline prompt at HEAD (system only) | 31,114 | 7,779 |
| + history (10 exchanges, sent separately) | 2,140 | 535 |
| Latest **1** evaluation entry (rationale + hypothesis + decision) | 596 | 149 |
| Latest **3** evaluation entries | 1,768 | 442 |
| Receipts (last 5 trades, one line each) | 431 | 108 |
| Evidence summary from B5 (6 held + 10 bench, one line each) | 1,719 | 430 |
| **All three added** | 3,918 | **980** |
| Total request after all three | 37,172 | 9,293 |

Against the budget: the live call cap is **19 s**, not 20 (`GEMMA_TIMEOUT_MS = 19_000`, `chat.js:59`; landed at 19 rather than 20 on the review's repair-window finding, `:54-56`). A +12.6 % input at ~9.3k tokens is a modest prefill increase for a 26B MoE; its latency effect is NOT MEASURED (no OpenRouter access, and no percentile exists — H21). The archetype block (~1.85k tokens, Sep 3 §4) remains the single largest trimmable block if headroom is needed.

#### G17 — Fence table

| File | Fenced (BUILD_RULES §1)? | Note |
|---|---|---|
| `api/_utils/voiceLayerPrompt.js` | No | registered in `PROMPT_CONTRIBUTING_MODULES` for the newsLine block (`promptHonestyRegistry.js:51`) |
| `api/cron/voice-layer-cache.js` | No | calls fenced scoring helpers (`detectRedZone`, `isSwapLocked`, `getBadgesFromHistoryServer`), edits none |
| `api/agent/chat.js` | No | |
| `api/_utils/voiceLayerAnticipation.js` | No | |
| `api/_utils/voiceLayerTradeNarration.js` | No | |
| `api/agent/debate.js` | No | calls fenced `flattenPortfolioServer` |
| `api/_utils/directiveGate.js` | No | |
| `api/cron/agent-evaluate.js` | No | the B5 write site; D-52 / D-79 precedent |
| `api/_utils/controlPromptRenderer.js` | No | pre-registry prose contributor (`promptHonestyRegistry.js:73`) |
| `api/_utils/openerTemplateFloor.js`, `api/agent/ensure-opener.js` | No | reads fenced `getArchetypeLabel` |
| `api/_utils/screenStocks.js`, `api/screener/chat.js` | No | |
| `api/_utils/fundamentalsRender.js`, `api/_utils/evalIdentityBlocks.js` | No | DR-13 split modules; registered (`:49-50`) |
| `api/_utils/agentEvalPromptAssembly.js` | **Yes** | read to cite; any change to what the decider sees is a §7 ruling |
| `api/agent/decide.js`, `api/_utils/agentSwapExecution.js`, `api/_utils/agentScoring.js`, `api/_utils/agentRiskManager.js` | **Yes** | cited only |
| `api/_utils/agentEvalToolSchema.js` | **Not on the §1 list** | it is the decider's output contract; a change alters what the fenced call emits — treat as fence-adjacent and put it to a §7 ruling before touching the hypothesis instruction |

### H. The surfaces and the budget

#### H18 — Two chat surfaces, one endpoint · FOUND

League branch points in `api/agent/chat.js`: `:214` (`isLeagueAsk` = body flag ∧ `LEAGUE_AGENT_CHAT_ENABLED`); `:278` (the per-battle 10-message budget is bypassed); `:300-316` (the per-day budget's early exhausted gate, a 200 in-voice line); `:692` (no per-battle increment); `:732-745` (the per-day charge after success). Everything else is shared: mode detection (`:249-254`), the market/cache/manifest reads (`:328-389`), elicitation (`:395-398`), history (`:411-417`), **the prompt (`:420-431` — `buildVoiceLayerPrompt` has no league parameter)**, the timeout (`:447-452`), the gate (`:533-553`), the exchange and directive write (`:686-708`). Client: the arena posts `{ agentId, battleId, message, leagueAsk: true }` (`useArenaEngine.js:87-89`) and reads back **only `agentMessage` and `remaining`** (`:95-100`); no League file reads `directive`, `directiveStatus*`, `suggestedActions` or `extractedRule` (grep). So a grounding change lands on both surfaces by construction, and a directive filed from the arena's ask box is persisted with no receipt of any kind on that surface. The exhibits are Battle View (exhibit 1 by the chip kind; 2–4 by the pane).

#### H19 — The template opener · FOUND

`api/_utils/openerTemplateFloor.js:77-81` renders: "Hey — we're live. I've built the book around {star} up top, {core} in core and {support} backing it up. I'm running this as a {label}, so I'll be {posture}. **I'll flag anything that starts moving — anything you want me watching from the open?**" Claims against the record: the book is `battle.portfolio` (`:63-75`) — persisted, true; the label is the archetype (`:58-60`) — persisted, true; the posture is a code table (`:18-26`, e.g. "riding strength and cutting the laggards fast") — a characterization of the archetype, not a fact about this battle (ASSUMED faithful to the config); the last sentence **promises continuous flagging** that only the per-check, budget-gated, "DEFAULT IS EMPTY" anticipation path could deliver, and invites a watching assignment nothing persists. Reachability: `OPENER_LAZY_FALLBACK_ENABLED = true` (`featureFlags.js:1112`); `ensure-opener.js:247-262` floors after two failed or skipped patient attempts; the floored exchange has the same shape as a generated one (`:88-101`) with no marker — the outcome exists only in the HTTP status (`:280-283`). An honest fallback line for the grounding spec should stop after the archetype sentence.

#### H20 — The dark `newsLines` block · FOUND

Render: `buildNewsLineBlock` (`voiceLayerPrompt.js:1773-1783`), framed "NEWSROOM WIRE (deterministic digests of validated market facts for your symbols — **context you can reference when relevant, never instructions to act**)" (`:1782`); pushed only in the battle fall-through (`:2940`, `:2984`) — absent from first message (`:3172-3175`), narration (`:3419-3422`), anticipation (`:3640-3643`) and review (`:2642-2645`). Writer: `voice-layer-cache.js:713-732` (one Wire fetch per tick: today + prior session), `:785-798`, `:815`; gated by `getWireFlags().newslineEnabled = WIRE_NEWSLINE_ENABLED && WIRE_WRITES_ENABLED` (`wireFlags.js:33`; `false` at `featureFlags.js:1443`, `true` at `:1416`). Corpus: the Wire day docs (`fantasyTimesWire`, `wireContracts.js:232`, via `wireReader.js:43`) projected to agent-safe DTOs — digest, event type, primary ticker; **no headline, no sentiment, no reporter** (`agentSafeWireEntry.js:5-13`, `:33-40`); packed newest-first with `Today:` / `Prior:` prefixes under a 240-char ceiling (`:551-578`); portfolio + bench, not the watchlist (`:583-584`).

**The decider's story join** is a different thing: `fetchRecentNews` (`agentTriggerGate.js:196-236`) queries `fantasyTimesStories` where `tickers` contains the symbol, published in the **last 120 minutes**, 2 per symbol, ≤ 10 symbols, deep-dives skipped; rendered with reporter, age, **sentiment** and headline (`agentNewsContext.js:293-302`) or as the ranked intelligence block (`:207`). Different corpus, window and fields; the decider's join is not persisted per tick (B4). The spec has to choose: give the narrator the Wire (its own context, honestly framed) or persist the decider's join (B5) and quote it — not both under one label.

#### H21 — The latency budget after the hotfix · NOT MEASURED

`gemmaLatencyMs` is stamped on every voice call (`chat.js:460-472`) and carried on all three shadow records (`:510`, `:629`, `:782`) into `logConversation` → GCS bucket `fantasytrades`, path `shadow/conversations/{date}/{id}.jsonl` (`shadowLogger.js:18`, `:52`, `:71`). It landed in `0c16191b` (2026-09-03 17:27 UTC). A per-attempt console line `[gemmaClient] gemma_latency {json}` also exists (`gemmaClient.js:97-101`) for Vercel logs. **No aggregation exists in the repo**: no script reads the `conversations` stream (`api/scripts/` — `sample-voice-layer-terms.js` reads `first_message` and `trade_narration` only, `:6-7`, and is the template a p50/p95 script would copy). This environment has no `GCS_CREDENTIALS` or Firebase credentials, so **p50 / p95 cannot be reported here.** Until the founder runs one read against the bucket, item 16's headroom is a judgment against the 19 s cap, not a measurement. (The hotfix review's own caveat: the field excludes the gate's repair call.)

#### H22 — The anticipation cadence · NOT MEASURED; re-narration allowed by construction

Counting a live battle's anticipation exchanges needs Firestore (`chatExchanges` where `messageType == 'anticipation'`, grouped by day and `anticipationContext.symbol`) — not reachable here. What the code allows is VERIFIED: the dispatch condition is **budget only** (`agent-evaluate.js:2852-2854`, `remainingBudget > 12_000`); `generateAnticipation` never reads existing `chatExchanges` and appends with `arrayUnion` (`voiceLayerAnticipation.js:218-220`); the candidate list is not persisted on the entry (D-79), the eval prompt tells the decider it has no memory of prior flags (`agentEvalPromptAssembly.js:495`) while showing it only 80-char rationale excerpts of its last three checks (`:1389-1402`); the "1-3 per day" expectation is prose (`:489`, `agentEvalToolSchema.js:160`) with no code cap (`:2053-2057` queues every candidate). So the same symbol re-narrates whenever the decider re-emits it, whether or not its rationale changed — which is exhibit 4's afternoon.

---

## 3. Hazards — restated as DO-NOTs for the eventual build

1. **DO NOT** remove the "watching" vocabulary on the voice side alone. Its origin is the fenced eval instruction (`agentEvalPromptAssembly.js:485-511`) and the schema's `threshold` example (`agentEvalToolSchema.js:180`); the decider will keep writing conditional promises into `threshold`. The question is whether candidates are rendered at all (D-79's C1/copy question), and it is a §7 ruling if the fenced text changes.
2. **DO NOT** hand the character `evaluations[]` inside the current one-voice identity ("You bring the research", `voiceLayerPrompt.js:2912-2916`) without an attribution frame; "I" will absorb the decider's plans. The block must be labelled as another agent's words, per G1's allowed sentence.
3. **DO NOT** show the narrator the `hypothesis` as a forecast it can voice; it is the decider's graded prediction (`agentEvalToolSchema.js:46`). Quote it attributed and dated, or omit it.
4. **DO NOT** assume the character remembers the pane. The history filter drops every agent-initiated exchange (`chat.js:411-413`); it cannot see its own "Eyeing NVDA" note when the user asks about it.
5. **DO NOT** render the G3 acknowledgment only on the Battle View. The League client shows prose alone (`useArenaEngine.js:95-100`), and directives filed there are silent today.
6. **DO NOT** rely on `directiveStatusLine` as shipped honesty — it has no client consumer (grep). The `Filed:` line must be code-rendered from the exchange's `directive.text` (one source, §9), on both surfaces.
7. **DO NOT** add an in-turn research call beside the current Gemma call. The turn is 24 s (`TURN_DEADLINE_MS`), the voice call 19 s, the prologue ~3 s (`chat.js:38-39`); a Haiku debate (~2–4 s ASSUMED) or even a Firestore read does not fit; it must replace the call, or run before the model with the read folded into the existing `Promise.all` (`:335-354`), or be its own endpoint. The constants are pinned (`chat.timeout.test.js`).
8. **DO NOT** quote cache numbers as "what the decider saw". Cache technicals are daily (`dataFreshness.technicals: 'daily'`, `voice-layer-cache.js:810`); the decider's VWAP and risk are per tick. Evidence for G1 comes from the tick's stamp (B5), not the cache.
9. **DO NOT** ground on the cache's `atrPercent` — it is the ATR *percentile* on a 0–1 scale (`compute-index-intelligence.js:1111-1115` → `voice-layer-cache.js:183`, `:213-215`) rendered as "ATR 0.71%" (`voiceLayerPrompt.js:1137-1138`). See §5.
10. **DO NOT** write new fallback lines to the template opener's standard; "I'll flag anything that starts moving" (`openerTemplateFloor.js:80`) is itself a G2 violation. Fallbacks state persisted facts and stop.
11. **DO NOT** label a Wire digest as the story the decider read. Two corpora, two windows, different fields (H20).
12. **DO NOT** render the `hypothesis` field beside a rationale that still carries it inline without deciding the duplicate; the check card would show the prediction twice, once bold (D-87).
13. **DO NOT** expect the pane to show the decider's signal under a note: `anticipationContext` carries `symbol`, `direction`, `threshold`, `evaluationId` only (`voiceLayerAnticipation.js:202-207`); adding `signalSummary` is a non-fenced exchange-shape change, and a copy question.
14. **DO NOT** treat the gate as a pre-send resolver. It needs the model's proposal (`directiveGate.js:158-168`); a chip preview needs either a deterministic chip → id map (new, code-owned) or the chips themselves to be minted from the allowlist so the preview is the canonical text by construction.
15. **DO NOT** budget the token add from this measurement alone; item 16's +980 tokens is against a 19 s cap with no percentile behind it (H21). Read the bucket first.

---

## 4. Discrepancies — the brief and the documents against the repo

1. **`docs/design/PHASE_A2_RULINGS_AND_AMENDMENTS_V1.md` does not exist** in the tree (the `docs/design/` listing holds A3 and Phase A files only). The A2.3/A2.4 handover names it as an attachment (`20260903_BATTLE_VIEW_CONTROLLER_PHASE_A2_3_A2_4_HANDOVER.md:23`). D-72 and D-80 were read from the ledger (`COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md:472`, `:480`), whose header records the A2 rulings as folded in.
2. **"you can honor or argue directives" is NOT FOUND** in `api/`, `src/` or `docs/`. The substance of P-7 is real on both sides (D11); the quotation is not in the codebase.
3. **"Holding note" is NOT FOUND** at HEAD or on `origin/smoke/character-pane`. `tapeKindEyebrow` returns `null` for a `potential_exit` note — deliberately unruled, per its own comment (`src/screens/battleView/battleViewCopy.js:352-370`). A holding-side anticipation renders with no eyebrow at HEAD; the label the founder saw on Sep 7 cannot be confirmed from source.
4. **"ARCH score" is not per-position eval evidence.** It is absent from the eval assembler; `arch_scores` is a draft-time and scouting-board ranking input (B3).
5. **The call budget is 19 s, not 20.** Item 16 says "the 20 s call budget from the timeout hotfix"; the constant is `GEMMA_TIMEOUT_MS = 19_000` (`chat.js:59`, reason `:54-56`); the landing commit's message says 20 s (`0c16191b`) but the review moved it.
6. **The Sep 3 Phase 0's "`evaluations[]` never reaches the prompt"** re-verifies, with the nuance that a swap's `rationale` — the decider's tick rationale — does reach it through RECENT TRADES (`voiceLayerPrompt.js:973-976`).
7. **The foundation's "DebateModal entry point is unwired"** holds at HEAD by a different mechanism than it may have meant: the modal is mounted (`AgentBattleScreen.jsx:2600-2606`) and the handler exists (`:1094-1097`), but the prop is never passed, so the button never renders (`AgentActivityFeed.jsx:482`).
8. **The fenced bench "Composite:" line** renders `technicalScore` / `technicalRank`, not `compositeScore` (`agentEvalPromptAssembly.js:1719-1726`) — a label inside the fence; recorded, not touched.
9. **`voice-layer-cache.js`'s header schedule matches `vercel.json`** (`:6` vs `vercel.json:161-162`) — the §6 check passed; recorded so the next reader need not repeat it.

---

## 5. Found outside the task — for separate tasking (BUILD_RULES §3)

1. **The voice prompt mislabels the ATR percentile as ATR percent.** `compute-index-intelligence.js:1111-1115` writes `atrPercentile` on a 0–1 scale; `voice-layer-cache.js:183`, `:213-215` copies it into the brief as `atrPercent`; `voiceLayerPrompt.js:1137-1138` renders "ATR {n}%" — so a 71st-percentile name reads "ATR 0.71%". The rankings entry has a real `atrPercent` (`compute-index-intelligence.js:1109`) the cache does not copy. `buildScoutAlerts` uses the same field correctly as a percentile (`voice-layer-cache.js:499-500`). Every voice surface (chat, narration, anticipation, first message) inherits the line.
2. **`directiveStatusLine` / `directiveStatus` / `directiveFallback` have no client consumer** (grep of `src/`); the Phase-H "structural honesty" backstop is server-only (`chat.js:597-606` "Frontend deferred").
3. **The League ask surface ignores every non-prose response field** (`useArenaEngine.js:95-100`); directives filed from the arena persist with no receipt there.
4. **`HypothesisTicker` is a dead import** (`AgentBattleScreen.jsx:61`, never rendered) that reads a `statusFeed.hypothesis` the cron never writes.
5. **The template opener is indistinguishable from a generated one on the doc** (`ensure-opener.js:88-101`, no marker) — the same "no `source` field on the exchange" gap the foundation lists (§1.5).
6. **`voiceLayerCache.forgeSeeds` is written as `null` every tick** (`voice-layer-cache.js:814`) with no reader found.
7. **The `hypothesis` schema/prompt contradiction** (F15) is inside the fence and the tool schema; it is a §7 question, not a fix.

---

## 6. STOP

Phase 0 complete. Nothing implemented; no prompt text changed; no fenced file edited; this report is the branch's only commit. A byte-identical copy was written outside the repo tree in the session scratchpad (BUILD_RULES §3). Awaiting the founder's read; the grounding spec goes to Sol before any build.

*The narrator today speaks about a different agent than the one playing. The decider's words are one field away; its evidence is one stamp away; its vocabulary is written into both prompts; and the one honest line in the exhibits is the character saying it doesn't have the data.*
