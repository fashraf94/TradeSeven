# Phase B — the tick stamps: Phase 0 discovery (V1 report)

**Date:** September 8, 2026
**Seed:** `PHASE_B_TICK_STAMPS_PHASE0_SEED_V1.md` (Flash, with Fable). **Read-only. `file:line`. NOT FOUND is a first-class answer. Hard STOP after this report.**
**Branch:** `claude/phase-b-tick-stamps-phase0-04izpk` (harness-assigned; recorded). This report is the branch's docs-only first commit. **No code changes.**
**Base:** `origin/main` @ `4a8ae54a` — PR #825 (`claude/grounded-deploy-opener-tc54h2`, the opener fence contact, commit `28281ed5`) on top of PR #824 (`record-rendering-access-control`) and PR #823 (`voice-grounding-shadow`): the grounding build and the opener fence contact are both merged.
**Citation convention:** every `file:line` below was read at `4a8ae54a` in this session (VERIFIED) unless marked ASSUMED. Lines drift — re-verify before building.

---

## 0. Preamble — git verification (BUILD_RULES §2 / §3)

- **`git fetch origin` was the first step.** It pulled four branches (`ops/step-minus-1-cron-quiesce`, `smoke/character-pane`, `ui-redesign`, `ui-redesign-backup`) and one tag (`backup-with-research`) the container had not seen. `origin/main` was already at `4a8ae54a`.
- **Branch / HEAD / tree:** `claude/phase-b-tick-stamps-phase0-04izpk` at `4a8ae54a5f0d89915dbe15cee63d4b506e36bd7f` = `origin/main`; clean tree; the branch did not yet exist on `origin` at session start.
- **The unmerged sibling.** `origin/claude/flat6-evaluation-rendering-1pouzh` @ `4e0dd90a` (one commit, "Route the League pane's record through the shared renderer (D-80/D-99)"; five files). It moves `normalizeForDuplicate`, `rationaleCarriesHypothesis`, `HYPOTHESIS_LABEL` and `displayHypothesis` out of `api/_utils/voiceLayerGrounding.js` (HEAD `:122`, `:137`, `:149`, `:247`) into `src/data/decisionRecord.js` (re-exported from the grounding module), adds `renderHypothesis(evaluation)` there (+128 lines to `decisionRecord.js`), and routes `src/components/Tournament/Flat6BattleView.jsx:326-331` through `renderMotive`. Every citation this moves is flagged inline as **[moves under the flat6 branch]**.
- **No Firestore access.** The container carries no `FIREBASE_*` / `GOOGLE_APPLICATION_CREDENTIALS` and no service-account file, so **no recent battle document is readable**. The size arithmetic (§3) is computed from the repo's own fixtures (`api/_utils/__fixtures__/voiceGroundingFixtures.js`, zero imports) and the cron's entry composition, with the Firestore storage-size rule applied by a scratchpad script (`sizing.mjs`, outside the tree; not committed). Real-doc numbers stay ASSUMED until one is read.
- A byte-identical copy of this report was written to the session scratchpad first and offered for download (BUILD_RULES §3). One subagent did a read-only consumer sweep; every citation it returned that this report relies on was re-read by the author.

---

## 1. Executive verdict

| # | Item | Verdict | One sentence |
|---|---|---|---|
| A1 | The stamp site | **CONSTRAINED** | The resolution the decider's prompt was built from dies inside the fenced builder (`agentEvalPromptAssembly.js:1229-1241`); the cron must call the same pure `resolveControls` on the same `battle` object at the stamp site — it already imports it (`agent-evaluate.js:69`). |
| A2 | The stale-snapshot hazard | **FOUND** | The assembler renders `battle.directive` as it stands when `buildLiveContextBlock` is called at `:2002`, and nothing re-reads the doc between there and the record at `:2629`, so `battle.directive.directiveThreadId` at the stamp site names exactly the rendered thread. |
| A3 | flat6 parity | **NO SIBLING SITE** | One cron processes both game modes (`tournamentCtx`, `:659`); the directive block is rendered once for both at `:1229-1241`; the flat6 difference is the system prompt (`:340-344`, `:549`) and the League reader (`Flat6BattleView.jsx:196-199`). |
| A4 | The five early returns | **VERIFIED** | Five sites advance `lastScoredAt` with no entry (`:924`, `:1805`, `:1822`, `:1862`, `:1941`); the client's `isDecidedAt` `>=` join (`deriveTurnLine.js:94-100`) already returns the absence state on those ticks. |
| A5 | Cost and the cap | **MEASURED (fixtures)** | The Heard stamp is 67 bytes; the evidence stamp is the cost (0.9–2.6 KB per entry); a 3-day battle writes ≤78 entries, so the 150 cap never binds — the constraint is the whole document, 18 % of 1 MiB today and 38–49 % with everything stamped, re-sent to every listener on every tick. |
| A6 | The client join | **FOUND** | `deriveReceipts.js:78-108` derives from the exchange walk only; `heard` joins by `directiveThreadId` against `evaluations[].heard` beside it, the screen merges at `AgentBattleScreen.jsx:1384`, the copy home is `decisionRecord.js` (`filedLabel :390`), and one test bans the word `Heard` (`AgentChat.receipts.render.test.jsx:83-88`). |
| B7 | What the eval prompt renders | **FOUND** | Fourteen blocks (`buildLiveContextBlock :1122-1286`); every source object is a `const` in `processAgentBattle` scope at the stamp site; "ARCH score" is **NOT FOUND** in the eval assembler. |
| B8 | Shape and author | **PROPOSED** | Nine fields per position plus one vintages block per entry (~124 bytes/position, ~0.9 KB for seven); cut order: `renderedText`, bench evidence, the story ids, the fundamentals fields. |
| B9 | Who reads it | **MAPPED** | Why? (`selectWhyState`), Bench (`selectBench`), the narrator (`renderRecordEntry`), the tape (`buildTape`), the harness — none reads evidence today; the only evidence copy that exists is the narrator's CURRENT CONTEXT (the cache), which the stamp does not replace but labels against. |
| C10 | The candidates | **FOUND** | The queue at `:2055-2061` holds the model's raw tool items (schema `:157-192`); persisting `threshold` is persisting the decider's output; the render withholding is **D-103**, not D-101 (`voiceLayerAnticipation.js:118-120`). |
| C11 | Bench's read | **FOUND** | Bench's only text input is `evaluations[].rationale` (`selectBench.js:14`), one sentence pass (`:196-206`); candidates on the entry would be a second, structured input with a C1 question on `signalSummary`. |
| D12 | The typed-directive transaction | **CONSTRAINED** | The chat path's one update (`chat.js:996-1008`) has no compare-and-set, a non-transactional cap check before the model call (`:490-510`) and an `increment(1)`; `directiveFiling.js` is zero-import by contract (`:21`), so the transaction is injected or lives in a sibling module; the eleventh-message case needs a ruling. |
| D13 | The error-body attestation | **FOUND** | The client branches on `res.status` and `data.error` (`AgentChat.jsx:956-975`); the honest string does not exist yet (`battleViewCopy.js:499-502` says it returns when the server attests); the arena makes the same unprovable claim (`useArenaEngine.js:95-99`). |
| D14 | The inert abort signal | **CONFIRMED at HEAD** | The timer is cleared at `chat.js:747` and the dead signal passed to the gate at `:828`; the repair is bounded by `deadlineMs` (`:829`, `directiveGate.js:110-112`) instead; the transaction is not its natural home. |
| E15 | What Heard lets the UI say | **MAPPED** | Four surfaces render a directive (the card, *This turn*, the League arena lane, the narrator's CURRENT DIRECTIVE) plus the tape's Acted echo; one `heardLabel(slot)` in `decisionRecord.js` serves all of them; the Battle View's `ArenaHeader.jsx` carries no directive (NOT FOUND). |
| E16 | The structured Direct control | **CONSTRAINED** | Allowlist, canonical text, the route and the receipt path exist; the menu component, its home, and the gate are unbuilt; `File it · 1 message` is NOT FOUND in `src/`; the route 404s for everyone at the shipped `'shadow'` (`featureFlags.js:2137`, `file-directive.js:172`). |
| F17 | Fence and cost | **CONFIRMED** | The record is built at `:2629-2671` after the Haiku swap (`:2312`) and the risk swaps (`:1613`), rides `evaluations` (`:2713`, `:2724`) into the one final update (`:2805`); keys on the entry only. |
| F18 | Files the build touches | **LISTED** | About twelve source files and twelve tests, none fenced; over the ≥10-file review threshold (BUILD_RULES §2) — the adversarial multi-lens review and the explicit `vite build` are required. |

**The two things to carry to the spec:** (1) the Heard stamp must be gated on `haikuAttempted` (`agent-evaluate.js:1980`), because a `budget_skipped` tick writes an entry without ever building the prompt (§5 hazard 2); (2) the size question is not the 150 cap, it is bytes-per-entry times a whole-document subscription — the evidence stamp has to be lean by design (§3).

---

## 2. Findings — items 1–18, in order

### A. The Heard stamp (D-52)

#### A1 — The stamp site · CONSTRAINED

**The record.** The evaluation entry is composed at `api/cron/agent-evaluate.js:2629-2671` (`const evaluation = { … }`) and written last: `evaluations = [...battle.evaluations, evaluation].slice(-150)` at `:2713`, spread into `finalUpdate` at `:2722-2752`, `await battleRef.update(finalUpdate)` at `:2805`. (The seed's `~:2628-2668` / `~:2796` have drifted by one to nine lines — §6.)

**What `resolveControls` returns.** `api/_utils/controlPromptRenderer.js:104-202`: `{ directive: { effective: obj|null }, leans: { effective: [] }, suppressionDescriptors: [{ target: 'directive'|'lean', id, version?, reason }] }`. For the directive the reasons are `malformed` (`:127-132`), `mode_not_enforce` (`:134-139`, any `archetypeIntegrityMode !== 'enforce'`), `epoch_killed` (`:140-145`, the `controlEpochLog` kill set), else rendered (`:147`). The text and thread id are on `directive.effective` (`{text, directiveThreadId, adjustmentId?}`, `:88`). **Expiry is not a reason here** — it is the caller's pre-gate: `isDirectiveActive(battle?.directive, battle) ? battle.directive : null` (`agentEvalPromptAssembly.js:1234`), and `directiveUtils.js:25-31` fails OPEN (uncertain → active). So an expired directive arrives as `directive: null` and leaves no descriptor.

**Where in the tick it is produced — twice, and neither survives to the stamp site:**
1. `recordControlEpochIfNeeded` at `agent-evaluate.js:1306-1325` passes `resolveControls` (`:1316`) and `directive: isDirectiveActive(…) ? battle.directive : null` (`:1317`). Inside, `controlSuppressionTelemetry.js:200` returns `null` unless the mode-epoch key changed (`shouldLogControlEpoch :51-55`) — in steady state it never resolves; when it does, it returns the `event` (`:247`), and the cron discards it (`:1307` is a bare `await`).
2. The fenced builder: `buildLiveContextBlock(battle, …)` called at `:2002-2005` resolves in a block scope (`agentEvalPromptAssembly.js:1228-1242`), pushes `directiveBlock` (`:1240`) and returns the joined string (`:1285`). **The resolution dies inside the prompt builder.**

**What IS in scope at the stamp site:** the same `battle` object (`:547` parameter, mutated in place), `ARCHETYPE_INTEGRITY_MODE` and `STANDING_LEANS_ENABLED` (`:79`), `resolveControls` (`:69`), `isDirectiveActive` (imported — used at `:1317`), and `haikuAttempted` (`:1961`, `:1980`). The `ignoredDirectiveIds` and `directiveThreadId` already on the entry (`:2647`, `:2649`) are **the model's echo** from the tool schema (`agentEvalToolSchema.js:61-71`) — self-report, the basis of *Acted*, never of *Heard*.

**Meaning.** D-52's design holds exactly as ruled: the cron computes `resolveControls({ modes: {archetypeIntegrityMode, standingLeansEnabled}, directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : null, standingLeans: battle.agentContext?.standingLeans, leanOverrides: battle.leanOverrides, controlEpochLog: battle.controlEpochLog })` — the argument list at `agentEvalPromptAssembly.js:1229-1238`, byte for byte — after the decision, and stamps `{ directiveThreadId, suppressed }`. Pure, zero-import, no I/O. The build must pin the two calls together (§5 hazard 4).

#### A2 — The stale-snapshot hazard · FOUND (refined)

**Which read produces the rendered object.** `battle` enters `processAgentBattle` from the handler's initial query (`activeBattles`, iterated at `:331`, passed at `:344`). The lock transaction re-reads the doc but copies back only `controlEpochLog` and `regimeAtStart` (`:563-578`) — `directive` is **not** refreshed there. However, `refreshBattleFromDoc` (`:463-467`) does `Object.assign(battle, refreshedDoc.data())` — the whole doc — and is called at `:1773` inside the risk-swap loop, **before** the prompt build. So on a risk-swap tick the rendered directive is fresher than the query snapshot; on every other tick it is the query snapshot. V2 hazard 3's "once at its start" is therefore approximately right and precisely wrong (§6 item 5).

**Is `directiveThreadId` available at the stamp site, naming *that* thread?** Yes. The eleven `refreshBattleFromDoc` sites are `:1773`, `:2962`, `:3147`, `:3171`, `:3350`, `:3708`, `:3904`, `:3914`, `:3926`, `:3944` — none lies between the prompt build (`:2002`) and the record (`:2629`); `battle.directive` is assigned nowhere in the file (the only reads are `:1317` and, inside the fence, `:1234`). So `battle.directive?.directiveThreadId` read at `:2629` is the identity of the object the assembler rendered. A directive filed during the tick (the chat write at `chat.js:996-1008` or the route's transaction at `file-directive.js:282-287`) is on the doc, not in this object — the stamp names the older thread, which is the truth.

**Meaning.** The stamp must read the in-memory `battle.directive` at the stamp site and never re-read the doc — a re-read would name "the current directive" (the hazard the seed names). D-51's qualification ("only D-52's stamp can support that claim", ledger `:516`) is satisfiable exactly this way.

#### A3 — flat6 (League) parity · NO SIBLING SITE

- One cron, one `processAgentBattle`. Tournament battles resolve `tournamentCtx` at `:659-660` (null for regular battles) and share every line after it, including the record at `:2629-2671`.
- The system prompt branches: `buildEvalSystemPrompt` (`agentEvalPromptAssembly.js:340-344`) returns `buildFlat6EvalSystemPrompt` (`:549`) when `resolveModeConfig(gameMode).promptVariant === 'flat6'`. The seed's `:688-714` region is the flat6 prompt's **ANTICIPATION CANDIDATES — WHEN TO POPULATE** instruction (`:688-714`; its tiered twin is `:485-511`) — not a directive render. The only directive mention in the flat6 system prompt is the survival-mode few-shot (`:736`, "I know directive d1 says …"), also present tiered (`:533`), and `renderSurvivalMode` (`:191-194`) in both.
- The directive block itself is rendered **once, for both modes**, inside `buildLiveContextBlock` (`:1229-1241`), which both variants receive as the third message (`agent-evaluate.js:2000-2006`). The flat6 difference in the live block is the portfolio CSV dropping the Tier column (`:1462-1466`).
- The League differences that matter are outside the cron: the reader (`Flat6BattleView.jsx:196-199` takes the last three entries with words, unjoined to `lastScoredAt`; `:326-331` renders raw bytes **[moves under the flat6 branch]**), the non-owner projection (`tournamentBattleView.js:36-40` omits `evaluations` entirely), and the budget store (D-105).

**Meaning.** There is no second stamp site to build or to forget; the parity risk is on the League *reader*, which today has no `lastScoredAt` join and no receipts at all.

#### A4 — The five early returns · VERIFIED

All five write `scoreUpdate` (built at `:879-885`, `scoreState.lastScoredAt` at `:884`) without an `evaluations` key and `return`:

| # | Site | Update | Entry written? |
|---|---|---|---|
| 1 | CPU-passive tournament battle, `:911-929` | `:924` | No |
| 2 | Pending proposal (`skip_haiku`), `:1800-1809` | `:1805` | No |
| 3 | Pending gameplan meeting, `:1817-1826` (after the R11 pass `:1818`) | `:1822` | No |
| 4 | Gameplan trigger fired, `:1856-1865` | `:1862` | No |
| 5 | Trigger gate declined, `:1928-1945` | `:1941` | No |

Two further exits write no `scoreUpdate` at all and so do not advance `lastScoredAt`: the degraded-quotes guard (`:728-735`, lock release only) and the lock-contention return (`:587-591`); the handler-level `market_closed` skip (`:287-290`) precedes every battle.

**The client's absence rule.** `isDecidedAt(entryTimestamp, lastScoredAt)` = `entryMs >= scoredMs` (`src/screens/battleView/deriveTurnLine.js:94-100`, "`>=`, never `===`"); `selectLatestDecision` (`:110-120`) returns `null` on those ticks; `selectWhyState` re-applies it (`selectWhyState.js:119-125`). A Heard stamp lives on an entry, an entry exists only on a decided tick, so an early-return tick contributes no Heard row by construction; the last Heard stays a past fact (`Heard at the 12:45 check`), which is true.

#### A5 — The cost and the cap · MEASURED from fixtures (no real doc readable)

See §3 for the tables. The verdict in one paragraph: the Heard stamp is **67 bytes** (`{ directiveThreadId, suppressed: null }`, 165 with `renderedText`); a full cron entry is **876 bytes** (HOLD) to **1,053** (SWAP) with the fixture's prose; the cron is `*/15 13-21 UTC Mon-Fri` (`vercel.json:157-158`) gated by `isMarketOpen()` (`marketSchedule.js:158-170`; 9:30–16:00 ET, `:23-25`) — **26 slots a day**, and an entry only on a triggered tick; so a 3-day battle (D-14) writes **≤78 entries, and the `slice(-150)` cap (`:2713`) never binds** (it binds from the sixth day). The document today is ~18 % of 1 MiB at three days; with Heard + full evidence for seven positions and ten bench names + three candidates on every tick it is ~49 %; at the 150 cap with that maximal shape it is ~82 %. **Tight only at the cap with the maximal shape — but the arithmetic that matters is not the limit, it is that the Battle View subscribes to the whole document** (`onSnapshot`, V2 Q3b) and receives every byte on every tick; a 400–500 KB doc on a phone every fifteen minutes is the design constraint. Duration is hard-set to `fullday` today (`agentBattleService.js:35`), so the 3-day numbers are a forward bound.

#### A6 — The client · FOUND

- **The seam.** `deriveReceipts(chatExchanges, directive, battleStatus)` (`src/screens/battleView/deriveReceipts.js:78-108`) walks exchanges only (`directiveFilings :56-67`, `threadIdOf :38-42`) and returns `{ [directiveThreadId]: { state, at } }`. It is called once, in the screen: `AgentBattleScreen.jsx:1384`. `heard` joins by the same key: a pure sibling (`deriveHeard(evaluations)` → `{ [threadId]: { at, count } }` from `evaluations[].heard.directiveThreadId`, last entry wins) merged into the receipt object at `:1384` — or a fourth parameter on `deriveReceipts`; either way the tape's `dispositionAt` (`buildTape.js:246-255`) keeps reading the same walk (D-77).
- **What the card shows.** `ExecutionCard` (`AgentChat.jsx:120-190`) takes `receipt` (looked up by `message.directive.directiveThreadId`, `:388`) and renders `BATTLE_VIEW_COPY.receiptLine(receipt)` (`:123`, `:187`); `receiptLine` (`battleViewCopy.js:708-714`) switches on `state` → `filed(at)` (`:448`, = `filedLabel(etTime(iso))`), `replaced(at)` (`:464-467`), `expired` (`:468`). `Heard {slot}` beneath `Filed {time}` is a second line on the same card from the same receipt object.
- **The copy home.** `filedLabel` is in `src/data/decisionRecord.js:390` (zero-import, Node-clean — the narrator imports it too); the receipt words `replaced`/`expired` and `receiptLine` are still in `battleViewCopy.js` (§6 item 4). A `heardLabel(slot)` belongs beside `filedLabel` so the narrator's CURRENT DIRECTIVE line (E15) can say the same words. The slot formatter is already shared: `etSlotTime` (`deskCopy.js:79`, imported by `voiceLayerGrounding.js:57`) and `slotLabel` (`deriveTurnLine.js:68`) — D-83.
- **What must move with it.** `battleViewCopy.js:16-19` states the rule "No `Heard` … (those are Phase B or never)", and `AgentChat.receipts.render.test.jsx:83-88` asserts the rendered card contains none of `Heard`, `Holding`, `Declined`, `Honored`, `Superseded`. Both are Phase B's to amend in the same commit.
- **`Acted` stays what it is:** the trade card's `↳ from directive` (`TapeCards.jsx:289` via `buildTape.js:150-159`; flag-off `AgentChat.jsx:1404-1419`), keyed to the model's echo on the statusFeed swap entry (`agent-evaluate.js:2586`, `:2606`).

### B. The evidence stamp (grounding discovery B5)

#### B7 — What the eval prompt renders per position, and what the cron holds · FOUND

`buildLiveContextBlock(battle, prices, macroPrices, assetScores, triggers, news, recentEvals, momentumData, presetConfig)` (`api/_utils/agentEvalPromptAssembly.js:1122`, fenced, read to cite) renders, in order, from objects that are all `const`s in `processAgentBattle` scope at `:2629`:

| # | Block (fenced render site) | Source object at the stamp site (`agent-evaluate.js`) | Vintage |
|---|---|---|---|
| 1 | Header + macro SPY/QQQ/BTC (`:1133-1139`) | `macroPrices` `:738-742` from `prices` | per tick |
| 2 | Vision state (`:1144`) | `momentumData.visionState` `:1240` | per tick (doc read) |
| 3 | Regime — `MARKET POSTURE`, per-stock regimes (`:1150-1152` → `:1762`) | `marketPosture` `:1176-1178`, `stockRegimes` `:1180-1186` (= `momentumData.regimes`) | daily technicals; posture already persisted (`:2662`) |
| 4 | Strategy preset (`:1156-1158`) | `presetConfig` `:678` | static |
| 5 | **ACTIVE POSITIONS** CSV — tier, symbol, sector, entry, $entry, $current, gain %, **ATR multiple**, badges, ATR %, LockNow/NextBonus/Levels (`:1163-1165` → `:1458-1487`) | `assetScores` `:767` (fenced scorer output: `priceChange`, `multiplier`, `badges`), `prices[sym]` `:696-715` (`getStockAnalysisData`, `forceRefresh`), `momentumData.rankingsMap` `:1194-1196` | per tick (quote), daily (Levels) |
| 6 | Bench CSV (`:1168` → `:1489`) | `battle.portfolio.bench`, `prices` | per tick |
| 7 | Bench technical — trend, RSI/MACD, volatility, volume, **`rsPercentile` + `sectorRSPercentile`** (`:1664`), levels, composite (`:1172-1177` → `:1535`) | `momentumData.rankingsMap` `:1194`, `momentumData.techScoresMap` `:1197` (= `technicalScoresMap` `:933`) | daily |
| 8 | **Fundamentals** — P/E, P/B, growth, cap class, **`EPS rev 30d`** (`fundamentalsRender.js:105`), vintage `as of` (`:157-174`, `:189`) (`:1182`) | `momentumData.rankingsMap[sym].fundamentals` (the mirror) | weekly, `computedAt`-marked |
| 9 | Closed trades with ghost prices (`:1186`) | `battle.trades`, `prices` | — |
| 10 | Trigger — why woken (`:1190-1193`) | `triggers` `:1920` (already persisted as types `:2654`) | per tick |
| 11 | **INTRADAY MOMENTUM** — VWAP $ + deviation, BB width pctl `[SQUEEZE]`, `NR7: YES`, range (`:1197-1201` → `:1826-1863`) | `momentumData.vwap[sym]` `:974`; `momentumData.rankings[sym]` `:1089` (`bBandwidthPercentile`, `nr7Flag`, `dailyRange`) | VWAP per tick; rankings ≤1 h intraday |
| 12 | **RISK STATUS** — `HOLD` / `LOCKED (detail)` / `action (reason)`, only when one is non-HOLD (`:1205-1207` → `:1784-1804`) | `riskStatus` `:1243`, `:1375`, `:1385` (fenced risk manager output, per symbol) | per tick |
| 13 | Directive + standing leans (`:1229-1241`) | `battle.directive`, `battle.agentContext.standingLeans`, `battle.leanOverrides`, `battle.controlEpochLog` | — (A1) |
| 14 | Institutional intelligence (`:1244-1255`); **FantasyTimes stories** — bare headlines or the ranked block (`:1257-1276`) | `news` `:1870` (`fetchRecentNews`, `agentTriggerGate.js:196-236`: `{ id: doc.id, ...data }` `:226`, ≤2 per symbol, ≤10 symbols, 120-min window) | per tick |
| 15 | YOUR LAST 3 DECISIONS (`:1279-1283` → `formatRecentEvals :1389-1402`) | `battle.evaluations` | — |

- **"ARCH score": NOT FOUND** in the eval assembler (`grep -i arch_score|archScore|ARCH score`, zero hits at HEAD) — re-confirms the grounding discovery's discrepancy 4. It is a draft-time / scouting-board ranking input, never per-position eval evidence; it cannot be stamped as "what the decider saw".
- **"Threshold proximity" is not a block.** What the decider sees is the row's ATR multiple and badges (`:1479`, from `assetScores[].multiplier` / `.badges`) and the risk verdict (`riskStatus`). The cache's `thresholdProximity` is a different computation (grounding hazard 8) and must not be stamped as the decider's.
- **The story join** is the `news` array's `id`s (`:226`) — the per-tick join the grounding discovery found NOT persisted (only `cronState.seenStoryIds`, `:1923-1925`). Stamping the ids is cheap; stamping headlines is not.

**Meaning.** A code-composed `evidence: { [symbol]: {…} }` can be built at `:2629` from `prices`, `assetScores`, `momentumData.{vwap,rankings,rankingsMap,techScoresMap,regimes}`, `riskStatus`, and `news` with no recomputation and no model — exactly B5's sentence. Nothing has to be threaded; everything is already in scope.

#### B8 — The shape and its author · PROPOSED

**Author:** the cron (engine), stamped `v` (vintages) per entry, never per field — a vintage per field costs more than the field. The question "what did the decider see for CF at 12:45?" is answered by `evaluations[i].evidence.CF` + the entry's `timestamp` (the tick) + `evaluations[i].vintages`.

Proposed minimum, per held position (from the table above, the fields the decider's own prompt shows for a held name):

```
evidence[sym] = { px, chg, atrX, vwapDev, bbPct, nr7, rsPct, regime, risk }   // ~124 bytes
vintages      = { quote: 'tick', vwap: 'tick', tech: 'daily', fund: 'weekly', fundAsOf: 'YYYY-MM-DD', rankingsAt: iso }  // once per entry
```

`px`/`chg` from `prices[sym].current/.changePercent`; `atrX` from `assetScores[].multiplier`; `vwapDev` from `momentumData.vwap[sym].vwapDeviation`; `bbPct`/`nr7` from `momentumData.rankings[sym]`; `rsPct` from `techScoresMap[sym].factors.rsPercentile`; `regime` from `stockRegimes[sym]`; `risk` from `riskStatus[sym].action` (+ `reason` when non-HOLD). Optional second tier: `sectorRs`, `epsRev30d`, `stories: [ids]` (~232 bytes/position with all three and the vintages inline).

**Bytes** (Firestore-rule; §3): lean 124 × 7 = **899 per entry**; full 232 × 7 = 1,655; ten bench names at 86 = 905. Per day (26 ticks): lean **23 KB**, full 43 KB, full + bench 67 KB. Three days: lean 70 KB, full + bench 200 KB.

**Where it conflicts with A5, cut in this order:** (1) `heard.renderedText` (the text is on the slot and the exchange); (2) bench evidence (Bench reads the decider's sentences and, with C, its flags — not numbers); (3) `stories` ids (the join can be reconstructed from `seenStoryIds` for triggering stories only — an accepted loss); (4) `epsRev30d`/`sectorRs` (weekly and daily fields the narrator's CURRENT CONTEXT already carries at their own vintage); never `risk`, `atrX`, `vwapDev` — the three the cache cannot reproduce (grounding B4: risk verdicts NOT FOUND, VWAP the decider's tick).

#### B9 — Who reads it · MAPPED (the table is §4.1)

- **Why? V2 "the piece's lines" (D-75):** `selectWhyState(evaluation, symbol, lastScoredAt)` (`selectWhyState.js:100-229`) reads `haikuError`, `triggers`, `rationale`, `downgraded`, `validationErrors[0]`, `guardrailSourceNote`, `guardrailOverrides`, `decision`, `symbolOut/In`; `WhyPanel.jsx:161-206` extracts the sentences naming the piece. It reads **no evidence** today — facts on the panel are the row's own numbers. The stamp adds a source (`evaluation.evidence[symbol]`), it replaces nothing.
- **Bench (D-92):** `selectBench.js:135-158`, `:179-209` — `evaluations[].rationale` only (C11).
- **The narrator's YOUR RECORD (spec V1.3 §3.2, `docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_3.md:45`):** `buildYourRecordBlock({ evaluations, directive })` (`voiceLayerGrounding.js:273-280`, last `RECORD_WINDOW = 3` `:93`, newest first) → `renderRecordEntry` (`:188-244`: slot, state label, `wokenBy`, the motive through `renderMotive`, the hypothesis line **[the hypothesis helpers move under the flat6 branch]**) → `renderCurrentDirective` (`:257-263`); called from `voiceLayerPrompt.js:3005-3010` under `grounded` only. **CURRENT CONTEXT (§3.3, spec `:66`)** is the cache at its labelled vintages (`CURRENT_CONTEXT_HEADING :284`, `CONTEXT_VINTAGE_SENTENCE :287`) — the one evidence copy that exists today, explicitly "not the evidence the trading process saw". The stamp joins YOUR RECORD as *what the decider saw at that check*; it does not replace CURRENT CONTEXT (different vintage, different purpose) — the spec's §3.3 sentence is what keeps the two from being confused.
- **The tape:** `buildCheckEntries` (`buildTape.js:258-266`) walks every entry through `selectWhyState`; the check card (`TapeCards.jsx:309-331`) renders label, trigger, sentences.
- **The harness:** `api/scripts/voice-grounding-harness.js:429`, `:449` feeds `hostileEvaluations()` through `renderRecordEntry`.
- **The League pane:** `Flat6BattleView.jsx:196-199`, `:326-331` (raw bytes) **[moves under the flat6 branch]**.
- **The fenced decider itself:** `formatRecentEvals` (`agentEvalPromptAssembly.js:1389-1402`) reads a fixed whitelist (`timestamp, decision, symbolOut, symbolIn, tier, rationale, hypothesis, evalId`) — new keys are inert to it, as D-52 records (at HEAD `:1279-1283` + `:1389-1402`, not `:1284-1297`; §6). `agentTriggerGate.js:20-30` reads `evaluations.length` only.

**Meaning.** The stamp replaces **no** existing copy — there is none; every consumer gains a field it can read from the entry it already holds. The one thing it must be labelled against is the narrator's CURRENT CONTEXT.

### C. The candidates on the entry (D-79)

#### C10 — The queue · FOUND

- **The queue.** `if (Array.isArray(haikuResult?.anticipationCandidates)) for (const candidate …) if (candidate && typeof candidate === 'object' && candidate.symbol) pendingAnticipations.push({ candidate, evalId })` (`agent-evaluate.js:2055-2061`; `pendingAnticipations` declared `:607`; dispatched in the `finally` at `:2858-2878`, budget-gated at `:2860`, deduped under `'on'` at `:2865-2866`). The candidate objects are the model's raw tool items: schema `agentEvalToolSchema.js:157-192` — required `symbol`, `direction` (`potential_entry|potential_exit`), `signalSummary`, `threshold`; optional `rationale`, `signalSource`. The only validation is a truthy `symbol` (`:2057`).
- **Stamping them.** `candidates: [{ symbol, direction, signalSummary, threshold, signalSource? }]` — the four required fields plus the tag, `rationale` cut (optional and the largest): **219–383 bytes each** (§3); the fenced instruction says a busy day yields 1–3 across all evaluations (`agentEvalPromptAssembly.js:692`), so the realistic cost is ~1 KB per day, not per tick. Stamp them on the entry at `:2629` beside `hypothesis` — persisting the decider's output is the same act as persisting `hypothesis` (`:2644`).
- **Persisting vs rendering `threshold`.** The render withholding is **D-103** (ledger `:503`), not D-101 (§6 item 3): under `'on'` for the owner, `composeAnticipationNote({ symbol, direction, slot, signalSummary })` (`voiceLayerAnticipation.js:101-102`) names the event; `anticipationContext` carries provenance only — "no `threshold`, no `signalSummary`" (`:118-120`); the signal clause enters the text only if it passes the reply lint (`:148`). The legacy model path still persists `threshold` on `anticipationContext` (`:350-353`, owner not `'on'`). The pane reads `direction` only (`deriveChatMessages.js:84-92`). So: **persist on the entry, render only through the D-103 composer** — the build cannot confuse the two if the spec cites `:118-120` as the render rule.

#### C11 — Bench's read · FOUND

- **Today:** `selectBench.js:14` — "The only text input this module has is `evaluations[].rationale`"; `selectLastDecidedWithWords` (`:135-158`) scans back to the last entry whose `selectWhyState` output carries a rationale (the D-92 scan-back, entry's own timestamp as the stamp `:129`); `selectBench` (`:179-209`) splits sentences (`splitSentences`, `selectWhyState.js:292-333`) and keeps each sentence naming a roster symbol (`namesSymbol :250-261`) as one card (`:196-206`), the unnamed roster as `rest` (`:209`); `PaneBench.jsx:97-183` renders cards, chips, the `Named at the {t} check` heading and the author footer.
- **What changes with the candidates on the entry:** Bench gains a **second, structured input** — `evaluations[i].candidates[]` filtered to `direction === 'potential_entry'` and to the roster — and can mark a bench name the decider flagged without an exchange, keyed by the same slot. D-92's "Bench quotes the decider only" holds (the decider wrote the flag). Two questions for the spec, not the build: whether `signalSummary` (a model sentence, C1-clean by authorship but not lint-checked) renders beside the flag or only the fact of the flag renders; and whether a flagged name leaves `rest` (`:209`) or stays there with a mark.

### D. The typed-directive transaction (P-1a/b/c)

#### D12 — The one update vs the transaction · CONSTRAINED

**The chat path today (`api/agent/chat.js`).** Budget read `currentBudget = battle[budgetField] || 0` (`:490-492`, `MODE_BUDGET :357-360` from `BATTLE_CHAT_BUDGET`), cap check `if (!isLeagueAsk && currentBudget >= budgetLimit)` **before the model call, non-transactional** (`:496-510`); the gate mints the directive (`gateDirective` `:820-830` → `normalizedDirective` / `effectiveHasDirective` `:834-835`; the object is `{ text, expiry, adjustmentId, canonicalTextVersion }`, `directiveGate.js:158-161`); the thread id is minted at `:939`; the exchange is composed `:955-992` (`directive: buildDirectiveRecord(…)` `:963-965`, top-level `directiveThreadId` `:966`, `groundingVersion` `:991`); **the one update** `:996-1008`: `chatExchanges: arrayUnion(exchange)`, `[budgetField]: FieldValue.increment(1)` (non-League), `recentElicitationTargets`, and the slot `directive: buildDirectiveSlot(…)` when a thread was minted (`:1005-1007`). The League charge runs **after** the write through `chargeAgentChatBudget` (`:1034`, a transaction in `agentChatBudget.js:103-105`) and a charge failure is swallowed (`:1040-1044`). (The seed's `:686-708` is now `:996-1008`; §6.)

**What it lacks against `file-directive.js`:** (a) the compare-and-set on the current thread — `file-directive.js:209-214` (check 4) vs nothing; (b) the atomic budget — an in-transaction read and explicit count (`:257-262`; League `:240-255`) vs `increment(1)` after a plain pre-call read — the overspend-by-one (build report §5 item 2, `:271`); (c) the active-battle check inside the transaction (`:205`) vs at the top of the handler; (d) the audit exchange sharing the thread id — **already shared**: the chat exchange carries `directiveThreadId` top-level and inside `directive` exactly as the route's does (`:963-966` vs `file-directive.js:126-127`), from the one shape module (`directiveFiling.js:29`, `:50`).

**Can `directiveFiling.js` host the transaction?** Not with imports: it is **zero-import by contract** (`:21`, "consumed by both routes and by their tests"), and a transaction needs `FieldValue`, `randomUUID`, `resolveBudgetDay`/`AGENT_CHAT_*`, `TOURNAMENT_GAME_MODE`, `toIso`. Two honest options: (i) keep it zero-import and add the transaction body as a function that takes its collaborators as parameters — the house pattern `recordControlEpochIfNeeded({ battleRef, battle, arrayUnion, resolveControls, … })` (`controlSuppressionTelemetry.js:187-192`); (ii) extract `file-directive.js:196-299` into a sibling module both routes import. Either way the function owns only the re-reads, the mint, the slot/record build and the two writes; it takes the composed exchange (the chat turn's has a user half, the reply, the scratchpad, the gate outcome; the chip's does not) as an argument.

**What the chat path would pass:** the gate's minted object (`normalizedDirective`), the exchange minus its directive fields, `expectedDirectiveThreadId` = the slot as read at the turn's start (`battle.directive?.directiveThreadId`, the value `:950-951` already reports to the client), `budgetField`/`isLeagueAsk`, `mode`. **What it must re-read inside the transaction:** `battle.directive.directiveThreadId` (the CAS), `battle.status`, `battle[budgetField]`, and for League `resolveBudgetDay` + the `agentChatBudget` doc. **Recorded, protected stores:** the route's two transaction writes are rows in `compositionProtectedStoresAllowlist.json:169-170` with a human-review note (`:274`); a chat transaction adds rows of the same kind beside `:163`.

**Two design questions the transaction forces (rulings, not build details):** (1) the chat client sends no belief (`AgentChat.jsx:951`: `{ agentId, battleId, message }`), so "conflict" for a typed directive means "the slot changed during the ~20 s turn" — D-18 latest-wins says file anyway; the honest outcome records the *actual* replaced thread from the in-tx read rather than the pre-turn one. (2) Moving the charge into the transaction means an eleventh concurrent turn fails **at commit, after the model answered** — the player waits 20 s for a 429 with no reply; the alternative keeps the pre-call check and accepts the overspend. Neither is a build decision.

#### D13 — The error-body attestation · FOUND

- **Where the client reads the error body.** Battle View: `AgentChat.jsx:954` (`data = await res.json()`), branches `:956-975` on `res.status` (401, 429, 504) and `data.error` (`budget_exceeded` / `chat_budget_exceeded`), else `sendFailedCopy` (`:909`, = `BATTLE_VIEW_COPY.chatSendFailed` under the flag); the network `catch` `:988-991` shows the same line. Arena: `useArenaEngine.js:94-100` — any non-ok or bodyless 200 → `ASK_FAILED_LINE`, with the comment "The server did NOT charge on either" (`:95-97`) — the same unprovable claim D-90 removed from the Battle View (§7 item 1). Chip filings already read the status: `AgentChat.jsx:1024-1027` → `filingFailureLine(res.status)`; `useArenaEngine.js:143-151` (adopts the 409's `currentDirectiveThreadId`).
- **What the server sends today:** `{ error: 'Agent response timed out. Try again.' }` (504, `chat.js:1100`) or `{ error: 'Agent unavailable…' }` (500, `:1102`) — nothing about persistence; and because the write at `:996` precedes the League charge (`:1034`) and any later throw, a 500 can arrive with the exchange persisted and charged (D-90; `battleViewCopy.js:482-492`).
- **The string that would branch on it.** It does not exist yet, by design: `battleViewCopy.js:499-502` — "`nothing was sent` comes back when the server attests to it, and that attestation rides the P-1 concurrency branch"; the shipped line is `chatSendFailed: 'The character couldn\'t answer just now'` (`:502`). The filing family shows the pattern: `FILING_CONFLICT_LINE` … `FILING_FAILED_LINE` (`decisionRecord.js:405-408`) with `filingFailureLine(status)` (`:427-432`) — and its comment (`:400-404`) states the rule: a status returned *before any write* may say nothing was filed; a 5xx cannot. With the transaction the chat handler knows three outcomes — threw before the transaction (nothing persisted, nothing charged), rejected inside it (same), committed then threw (persisted and charged) — so the error body can carry `persisted` / `charged` booleans (or a `status` word), and a `CHAT_NOT_SENT_CLAUSE` in `decisionRecord.js` beside the filing lines is what `chatSendFailed` appends when `persisted === false`. The arena consumes the same field at `:98-99`.

#### D14 — The gate's inert abort signal · CONFIRMED at HEAD

- The timeout Phase 0 has no §10.1; the finding is at `20260903_VOICE_CHAT_TIMEOUT_PHASE0_DISCOVERY.md:143` (§3, "minor, pre-existing") and `:266` (§11 item 2): the signal passed to the gate can never fire because its timer was already cleared. At HEAD: `controller` `:724`, timer `:729`, **cleared at `:747`** (the `finally` of the voice call), then passed to the gate at **`:828`** (`signal: controller.signal`). Still inert. Inside the gate, `attemptRepair` checks `signal?.aborted` (`directiveGate.js:111`) and forwards it (`:122-123`) — dead paths; the real bound is `deadlineMs` (`chat.js:829`; `directiveGate.js:110-112`, clamped to `REPAIR_TIMEOUT_MS :36`).
- **Is the transaction the natural place to wire it?** No. The gate runs before the write; the transaction comes after; the repair is already bounded by the deadline. The cheapest honest change is to stop passing the dead signal (or re-arm a controller for the gate's window) — the timeout Phase 0 filed it for separate tasking and it stays there. Wiring it into a directive-transaction PR would be scope creep with no behavioural effect.

### E. The receipt ceiling on screen, and Direct

#### E15 — What Heard lets the UI say · MAPPED (the table is §4.2)

Every surface that renders a directive today, with its copy source:

1. **The directive card** — `ExecutionCard` (`AgentChat.jsx:120-190`), eyebrow `Directive` (`battleViewCopy.js:463`), receipt line `receiptLine` (`:708-714` → `filed :448` = `filedLabel`, `replaced :464-467`, `expired :468`).
2. ***This turn*** — `ThisTurnStrip.jsx:23-29` (thread id, text, `receipts[threadId].at`), `COPY.filed(filedAt)` at `:60`, `nothingQueued` (`battleViewCopy.js:449-452`); hidden at completion (`:24`).
3. **The League arena lane** — `applyFiled` (`arenaEngineCore.js:165-179`): a `VoiceLane` line of kind `directive` with `t: filedLabel(etTime(createdAt))` (`VoiceLane.jsx:10-12`, icon `:30`); source is the route's post-commit response, not the doc (`useArenaEngine.js:154-158`). The Battle View's `ArenaHeader.jsx` carries **no directive** (NOT FOUND); the "arena lane" is the League surface.
4. **The narrator's CURRENT DIRECTIVE line** — `renderCurrentDirective` (`voiceLayerGrounding.js:257-263`): heading `:154` ("in front of it at each check while current — it may or may not act on it"), `"{text}" — filed {t}`, or `NO_DIRECTIVE_LINE :155`; fed by `voiceLayerPrompt.js:3008` through `resolveEffectiveDirective`.
5. **The Acted echo** — `↳ from directive` (`battleViewCopy.js:403`; `TapeCards.jsx:289`; flag-off `AgentChat.jsx:1419`) — stays.
6. **The Desk** — dark (`COMMAND_CENTER_SYNC_ENABLED = false`, `featureFlags.js:1892`); no directive line found in `deskCopy.js` (NOT FOUND).

**One copy string serves all of them:** `heardLabel(slot)` → `Heard at the {slot} check` in `src/data/decisionRecord.js` beside `filedLabel :390` (zero-import; the narrator imports it at `voiceLayerGrounding.js:58-`; the clients through `battleViewCopy.js:55`). The card and *This turn* read `Filed 12:31 PM · Heard at the 12:45 check` from the merged receipt (A6); the narrator's line becomes `"{text}" — filed {t} · heard at the {slot} check`; the arena needs a doc read it does not have today (§5 hazard 15). The slot comes from `etSlotTime` / `slotLabel` (D-83), never the entry's exact minute.

#### E16 — The structured Direct control · CONSTRAINED

**By construction today:** the allowlist menu — `getAllowlist(codeId)` (`src/data/archetypeAdjustments.js:214`), `isValidAdjustmentId :219`, `getCanonicalText :224`, `getCanonicalTextVersion :245`; the resolved canonical text shown before the tap — the chip label `Files: {canonical}` (`filesChip`, `decisionRecord.js:386-387`; rendered `AgentChat.jsx:108`, `CommandDock.jsx:41`) from the server's normalizer (`chat.js:871-873`); the tap — `fileDirective(adjustmentId)` (`AgentChat.jsx:1005-1040`, `:1054`; arena `fileLive`, `useArenaEngine.js:131-160`) posting `{ agentId, battleId, adjustmentId, expectedDirectiveThreadId }`; the belief — `AgentChat.jsx:583-602` from the doc's slot (`AgentBattleScreen.jsx:1801`, `:2499`), the arena's from the last grounded answer/filing (`useArenaEngine.js:128-129`); the receipt path — shared (A6, E15).

**Left to build for the control itself:**
- **The menu component.** NOT FOUND in `src/`. It reads `getAllowlist(archetype)` client-side; the archetype is `battle.agentContext.archetype || agent.archetype` (`getEffectiveArchetype`), both owner-readable. `File it · 1 message` (D-31) is **NOT FOUND** in `src/` — it exists only in the Controller brief (`docs/design/COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md:101`) and the spec's §6.4 (`VOICE_LAYER_GROUNDING_SPEC_V1_3.md:105-106`). The `Current: {text} — a new one replaces it` preface (brief `:101`) is likewise unbuilt.
- **Its home in the pane.** The pane has three section slots — `PANE_SECTION = { CHAT, BENCH, TAPE }` (`useCharacterPane.js:39-49`), the segmented control (`CharacterPane.jsx:61-63`, `:360`), the three panels (`:386-387`). No fourth slot. D-53 puts Direct on the score header, D-91 makes the character the door; the `Files:` chips already live inside the Chat section's composer as the precedent (`AgentChat.jsx:108`, `:1054`). Where the menu opens — the Chat section (beside the chips) or the header (D-53) — is a placement ruling.
- **The gate.** Chips exist only on a grounded turn (`chat.js:464-465`, `:871`), and the route is live only for a caller resolving `'on'` (`file-directive.js:172`, D-106) — at HEAD `VOICE_GROUNDING_MODE = 'shadow'` (`featureFlags.js:2137`), so a menu shipped today 404s for everyone; `filingFailureLine(404)` already renders the "no longer on the menu" line for that case (`decisionRecord.js:413-432`). The control's flag is the grounding walk, or its own.
- **The receipt path** — already shared; nothing to build.

### F. Fence and cost

#### F17 — Composed after the decision, riding the final update · CONFIRMED

- **The six `executeSwapServer` sites:** `:1613` (risk loop), `:2312` (the Haiku SWAP), `:3016` (approved proposal), `:3227` (expired proposal auto-execute), `:3587` (the R11 suppression pass), `:3790` (gameplan rotation), each inside the reserve → confirm → release wrapper (`:475`, `:404`, `:427`).
- **Order in the tick:** risk swaps `:1387-1796` → early returns → the Haiku call `:1989-2010` → the SWAP path `:2245-2560` (`:2312`) → the statusFeed entries `:2571-2626` → **the record `:2629-2671`** → the shadow log `:2689-2710` → `evaluations` `:2713` → `finalUpdate` `:2722-2752` → `runShadowTickCapture` `:2783-2802` (receives `evaluation`; capture-only) → **`await battleRef.update(finalUpdate)` `:2805`**. The stamps are composed after the decision and every swap this tick executes, and add keys to `evaluation` only; `evaluations` is an existing field seeded by the fenced `createAgentBattle` (`agentBattleService.js:248`), so no top-level battle key is added (V2 hazard 9). The proposal/gameplan/R11 functions write their own updates (`:2961`, `:3071`, `:3146`, `:3170`, `:3349`, `:3913-3943`) and no entry — no stamp exists there, by construction.

#### F18 — Every file the build would touch · LISTED

| File | Fenced? | Change |
|---|---|---|
| `api/cron/agent-evaluate.js` | No | the three stamps on `evaluation` (`:2631-2671`); a `resolveControls` call gated on `haikuAttempted` (`:1980`) |
| `api/agent/chat.js` | No | the transaction replacing `:996-1008`; the attested error body (`:1100-1102`) |
| `api/agent/file-directive.js` | No | its transaction body (`:196-299`) shared |
| `api/_utils/directiveFiling.js` | No (zero-import, `:21`) | the injected transaction — or a sibling module |
| `src/screens/battleView/deriveReceipts.js` | No | the `heard` join (or `deriveHeard`) |
| `src/data/decisionRecord.js` | No (zero-import) | `heardLabel`, the not-sent clause **[+128 lines under the flat6 branch; anchors past `:363` move]** |
| `src/screens/battleView/battleViewCopy.js` | No | re-export; `:16-19` rule; `chatSendFailed :502` |
| `src/components/Agent/AgentChat.jsx` | No | the card's second line (`:120-190`); the send-failure branch (`:954-977`) |
| `src/screens/battleView/ThisTurnStrip.jsx` | No | the Heard clause (`:60`) |
| `src/screens/battleView/selectBench.js`, `PaneBench.jsx` | No | the candidates as a second input (C11) |
| `src/screens/battleView/selectWhyState.js`, `WhyPanel.jsx` | No | the evidence lines (B9) |
| `src/components/League/battleArena/{useArenaEngine.js, arenaEngineCore.js, VoiceLane.jsx}` | No | the attested ask failure; Heard only with a doc read |
| `api/_utils/voiceLayerGrounding.js` | No | `renderCurrentDirective :257-263` (Heard), `renderRecordEntry :188-244` (evidence line) **[`:122-143`, `:247-255` move under the flat6 branch]** |
| `api/_utils/compositionProtectedStoresAllowlist.json` | No | rows for the chat transaction's writes (beside `:163`, like `:169-170`) |
| **Tests** | | `agent-evaluate.test.js` (+ `goldenPath`), `chat.test.js`, `file-directive.test.js`, `deriveReceipts.test.js`, `decisionRecord.test.js`, `voiceLayerGrounding.test.js`, `voiceLayerPrompt.grounding.goldens.test.js` (grounded fixtures only — the OFF goldens must not move), `selectBench.test.js`, `selectWhyState.test.js`, `buildTape.test.js`, `AgentChat.receipts.render.test.jsx:83-88` (bans `Heard`), `ThisTurnStrip.render.test.jsx`, `deskHonesty.test.js` (scans the copy), `compositionProtectedStores.scan.test.js` |
| **Read, never edited** | **Yes** | `agentEvalPromptAssembly.js` (`:1229-1241` cited), `agentEvalToolSchema.js` (fence-adjacent), `agentSwapExecution.js`, `agentBattleService.js` |

Count: ~14 source files + ~14 tests → **over the ≥10-file review threshold** (BUILD_RULES §2): multi-lens adversarial review with refutation, an explicit `vite build`, mutation checks on new rows, a `docs/audits/` record — or the build is split so each PR stays under it (the seed's P-1a/b/c split is one natural cut: the stamps; the transaction; the surfaces). Any change to the assembler, the schema, or the decision inputs remains a STOP — none is needed.

---

## 3. The size arithmetic (A5, B8)

**Method.** No real battle document is readable (§0). Every object below is built from the repo: the fixture entries in `voiceGroundingFixtures.js` (`EVALUATIONS`, `CHAT_EXCHANGES`, `TRADES` — realistic prose), the cron's full key list (`agent-evaluate.js:2631-2671`), the tool schema (`agentEvalToolSchema.js`), a statusFeed swap entry (`:2591-2609`), and the P4 `createAgentBattle` snapshot (`api/_utils/__p4_snapshots__/createAgentBattle.tieredDoc.snap.json` — 2 star + 2 core + 3 support = **7 positions**, the seed's seven). Bytes are computed two ways: JSON length and Firestore's storage-size rule (string = UTF-8 bytes + 1; number 8; boolean/null 1; map = Σ(field name + 1 + value)); the Firestore column is used for totals. Ticks: 26 slots per market day (`vercel.json:157-158` ∧ `marketSchedule.js:158-170`); 78 for a 3-day battle; 150 the cap (`:2713`). **All ASSUMED against a real document; the proportions are what matter.**

### 3.1 Per object

| Object | JSON bytes | Firestore-rule bytes |
|---|---:|---:|
| Fixture entry `eval_004` (SWAP, as the fixture stores it) | 547 | 505 |
| Fixture entry `eval_005` (HOLD, as the fixture stores it) | 631 | 581 |
| **Full cron entry, SWAP** (every `:2631-2671` key, fixture prose, `trade_reasoning` filled) | 1,173 | **1,053** |
| **Full cron entry, HOLD** (every key) | 986 | **876** |
| `heard: { directiveThreadId, suppressed: null }` | 78 | **67** |
| `heard` with a suppression reason | 92 | 83 |
| `heard` + `renderedText` (~85-char canonical sentence) | 180 | 165 |
| `heard` with no directive current | 44 | 31 |
| `evidence` — one position, full set (13 fields + inline vintages) | 262 | 232 |
| `evidence` — one position, **lean set (9 fields)** | 131 | **124** |
| `evidence` — one bench name (7 fields) | 88 | 86 |
| `evidence` — 7 positions × full | 1,887 | 1,655 |
| `evidence` — **7 positions × lean** | 970 | **899** |
| `evidence` — 10 bench × bench set | 956 | 905 |
| `candidate` — one, all six schema fields | 408 | 383 |
| `candidate` — one, the four required fields | 236 | 219 |
| `candidates` — three, all six fields | 1,228 | 1,149 |
| statusFeed swap entry (`:2591-2609`) | 727 | 646 |
| `trades[]` entry (fixture) | 296 | 264 |
| `chatExchanges[]` entry (fixture, largest) | 660 | 578 |
| The tiered battle doc at creation (P4 snapshot) | 3,817 | 3,241 |

### 3.2 Per entry, per day, per battle

| Entry composition | bytes / entry | × 26 (one day) | × 78 (3-day, D-14) | × 150 (the cap) |
|---|---:|---:|---:|---:|
| Today — HOLD entry | 876 | 22,776 | 68,328 | 131,400 |
| Today — SWAP entry | 1,053 | 27,378 | 82,134 | 157,950 |
| + `heard` (min) | 943 | 24,518 | 73,554 | 141,450 |
| + `heard` + `renderedText` | 1,041 | 27,066 | 81,198 | 156,150 |
| + `heard` + evidence 7 lean | 1,842 | 47,892 | 143,676 | 276,300 |
| + `heard` + evidence 7 full | 2,598 | 67,548 | 202,644 | 389,700 |
| + `heard` + evidence 7 full + 10 bench | 3,503 | 91,078 | 273,234 | 525,450 |
| + all of the above + 1 candidate | 3,886 | 101,036 | 303,108 | 582,900 |
| + all of the above + 3 candidates, SWAP-sized, `renderedText` (the maximal shape every tick) | 4,927 | 128,102 | 384,306 | 739,050 |

The candidates row is a ceiling, not a forecast: the fenced instruction expects 1–3 candidates **per day** across all evaluations (`agentEvalPromptAssembly.js:692`), ~1 KB/day.

### 3.3 The whole document against 1 MiB (1,048,576 bytes)

Rest-of-document allowance: statusFeed cap 100 (`agent-evaluate.js:675`) × 646 = 64,600; `trades` cap 50 (`agentSwapExecution.js:354`) × 264 = 13,200; `chatExchanges` **uncapped** (assumed 40 × 578 = 23,120); base doc 3,241; +20,000 ASSUMED for `cronState` maps, `thresholdHistory`, `agentContext` growth, `proposalHistory` (cap 50) — **124,161**.

| Scenario | `evaluations` bytes | + rest of doc | % of 1 MiB |
|---|---:|---:|---:|
| Today, 3 days (HOLD) | 68,328 | 192,489 | **18.4 %** |
| Today, at the 150 cap | 131,400 | 255,561 | 24.4 % |
| + `heard`, 3 days | 73,554 | 197,715 | 18.9 % |
| + `heard` + evidence 7 lean, 3 days | 143,676 | 267,837 | **25.5 %** |
| + `heard` + evidence 7 full + 10 bench, 3 days | 273,234 | 397,395 | 37.9 % |
| + the maximal shape every tick, 3 days | 384,306 | 508,467 | 48.5 % |
| + the maximal shape, at the 150 cap | 739,050 | 863,211 | **82.3 %** |

**Reading it.** The Heard stamp is free (+5 KB per 3-day battle). The lean evidence set costs +70 KB per 3-day battle and keeps the doc at a quarter of the limit. The full set with bench evidence doubles the document; the maximal shape at the cap is tight (82 %) and, with `chatExchanges` uncapped and a chatty owner, would cross the limit — **a design constraint: the evidence stamp is lean, bench evidence is cut first, `renderedText` is never stamped.** The second constraint is not the limit but the wire: the Battle View subscribes to the whole document and every tick re-sends all of it to every listener (V2 Q3b); 400–500 KB per fifteen minutes on a phone is the number the spec should weigh, not 1 MiB.

---

## 4. The consumer map

### 4.1 Readers of `battle.evaluations[]` today (B9)

| Reader | `file:line` | Fields read | Produces | Join |
|---|---|---|---|---|
| Latest decision | `src/screens/battleView/deriveTurnLine.js:110-120` | `timestamp` + `scoreState.lastScoredAt` | the one "latest decision" entry | last entry, `isDecidedAt` `>=` (`:94-100`) |
| Why? state | `src/screens/battleView/selectWhyState.js:100-229` | `timestamp`, `haikuError`, `triggers`, `rationale`, `downgraded`, `validationErrors[0]`, `guardrailSourceNote`, `guardrailOverrides`, `decision`, `symbolOut/In` | the six-state Why? view model (`AgentBattleScreen.jsx:1722`, `:2155` → `WhyPanel.jsx:161-206`) | re-applies `>=` (`:119-125`) |
| Bench | `src/screens/battleView/selectBench.js:135-158`, `:179-209` | `rationale` (through `selectWhyState`) | the Bench roster's quoted sentences (`PaneBench.jsx:97-183`) | scan-back past `lastScoredAt`, entry's own stamp (`:129`) |
| The tape | `src/screens/battleView/buildTape.js:258-266` | every field `selectWhyState` reads + `evalId`, `scores.banked` | one check card per entry (`TapeCards.jsx:309-331`), the quiet runs (`:342-351`) | all entries; `trades[].evaluationId === evalId` (`:236-242`); directive disposition by timestamp (`:246-255`) |
| Turn line | `deriveTurnLine.js:145`, `:190-191` → `TurnLine.jsx:44-63` | via the latest decision | `decided` dot + text | latest |
| League pane | `src/components/Tournament/Flat6BattleView.jsx:196-199`, `:326-331` **[moves under the flat6 branch]** | `rationale`, `hypothesis`, `evalId` | "The agent's read" — raw bytes | last 3 with words, **no `lastScoredAt` join** |
| Forge stats | `src/services/forgeStatsService.js:71`, `:85-90` | `citedForgeRules[]` | rule tallies | all entries, last 50 battles |
| **Narrator — YOUR RECORD** | `api/_utils/voiceLayerGrounding.js:273-280` → `:188-244` → `:167-178`; called `voiceLayerPrompt.js:3005-3010` | `timestamp`, `triggers`, `haikuError`, `rationale`, `hypothesis`, `downgraded`, `guardrailOverrides`, `guardrailSourceNote`, `validationErrors`, `decision`, `tier`, `symbolOut/In` | the grounded prompt's record block (grounded only) | last 3, newest first |
| Anticipation slot | `api/_utils/voiceLayerAnticipation.js:97-100` | `evalId`, `timestamp` | the note's slot | `find(e => e.evalId === evalId)` |
| The decider | `api/_utils/agentEvalPromptAssembly.js:1279-1283` → `:1389-1402` (fenced) | whitelist: `timestamp, decision, symbolOut, symbolIn, tier, rationale(80), hypothesis(60), evalId` | `YOUR LAST 3 DECISIONS` | last 3 |
| Trigger gate | `api/_utils/agentTriggerGate.js:20-30` | `.length` | `forced_open` | count |
| Reflection | `api/_utils/agentReflectionUtils.js:155-191`, `:311-315` | `decision`, `evalId`, `timestamp`, `conviction`, `scores.total`, `hypothesis` | the post-battle reflection prompt | first 3 + swaps + last 5 |
| Batch review | `api/cron/agent-batch-review.js:189`, `:198` | `day` | today's review set | `day === currentDay` |
| Shadow capture | `api/_utils/shadowAssemblyCapture.js:183-188`, `:418`; `resolveTerminalGate :300-310` | array → `buildLiveContextBlock`; `.length`; `symbolOut/In` fallback | the shadow diff envelope | — |
| The harness | `api/scripts/voice-grounding-harness.js:429`, `:449` | fixtures | `renderRecordEntry` exercise | fixture |
| Non-owner projection | `api/_utils/tournamentBattleView.js:36-40` | — | **`evaluations` withheld** from non-owners | — |

**Not a reader of evidence, anywhere.** The only evidence copy in the product is the narrator's CURRENT CONTEXT (`voiceLayerGrounding.js:284-287`, the cache brief) — a different vintage by declaration.

### 4.2 Surfaces that render a directive today (E15)

| Surface | `file:line` | Reads | Copy today | Heard would read |
|---|---|---|---|---|
| The directive card | `AgentChat.jsx:120-190`, `:388` | `message.directive.{text,directiveThreadId}`, `receipts[threadId]` | `Directive` / `Filed {t}` / `Replaced {t}` / `Expired` (`battleViewCopy.js:463`, `:448`, `:464-468`, `:708-714`) | `Filed 12:31 PM · Heard at the 12:45 check` |
| *This turn* | `ThisTurnStrip.jsx:23-29`, `:60` | `directive.{directiveThreadId,text}`, `receipts[threadId].at` | `This turn` / `Filed {t}` + text / `Nothing queued · next check ~{t}` (`battleViewCopy.js:447-452`) | the same line |
| The League arena lane | `arenaEngineCore.js:165-179` → `VoiceLane.jsx:10-12`, `:30` | the route's response (`useArenaEngine.js:154-158`) | kind `directive`, `t = filedLabel(etTime(createdAt))` | needs a doc read (none today) |
| The narrator | `voiceLayerGrounding.js:154-155`, `:257-263` (from `voiceLayerPrompt.js:3008`) | the resolved `battle.directive` | `CURRENT DIRECTIVE (…): "{text}" — filed {t}` / `none filed.` | `— filed {t} · heard at the {slot} check` |
| The Acted echo | `buildTape.js:150-159` → `TapeCards.jsx:289`; flag-off `AgentChat.jsx:1404-1419` | statusFeed `directiveThreadId` (the model's echo) | `↳ from directive` (`battleViewCopy.js:403`) | unchanged |
| The receipts source | `deriveReceipts.js:38-42`, `:56-67`, `:78-108`; `AgentBattleScreen.jsx:1384` | exchanges + slot + status | the `{threadId: {state, at}}` map | + `heardAt` per thread |
| Battle View `ArenaHeader.jsx`; the Desk | — | — | **NOT FOUND** (no directive) | — |

---

## 5. Hazards — DO-NOTs for the build

1. **DO NOT take Heard from the model's echo.** `directiveThreadId` (`agent-evaluate.js:2649`) and `ignoredDirectiveIds` (`:2647`) are self-report from the tool schema (`agentEvalToolSchema.js:61-71`); the few-shot ids are `d1`-style (`agentEvalPromptAssembly.js:736`). Heard is the cron's own `resolveControls` call and nothing else.
2. **DO NOT stamp Heard on a `budget_skipped` tick.** The Haiku call is skipped at `:1972-1978` **before** `buildLiveContextBlock` at `:2002` — the prompt was never built, yet an entry is written (`haikuError.failureClass = 'budget_skipped'`, `:2670`). Gate the stamp on `haikuAttempted` (`:1980`). A `timeout` / `truncated_response` tick DID render the prompt (`:2002` ran) — Heard is true there with no decision; the copy must never let "Heard" imply "decided" (D-65/D-69 absence lines stay).
3. **DO NOT read the doc at the stamp site.** Name `battle.directive.directiveThreadId` from the in-memory object at `:2629`; a re-read names "the current directive" (A2). `refreshBattleFromDoc` (`:463-467`) runs at `:1773` before the prompt and nowhere between `:2002` and `:2629`.
4. **DO NOT let the cron's `resolveControls` call drift from the fenced one.** Same `modes` (`:1312-1313` ≡ `agentEvalPromptAssembly.js:1231-1232`), same `isDirectiveActive` pre-gate (`:1317` ≡ `:1234`), same `standingLeans` / `leanOverrides` / `controlEpochLog`. Pin with a source tripwire on the fenced call (the `controlPromptRenderer.test.js` precedent the fence cites at `:1220-1221`).
5. **DO NOT stamp `renderedText`.** The text is on the slot and on the exchange; +98 bytes per tick buys nothing the thread id does not.
6. **DO NOT stamp evidence from the cache** (grounding hazard 8) **or a "proximity" number the decider never saw**; the decider's proximity is the row's ATR multiple (`:1479`) and the risk verdict.
7. **DO NOT add a top-level battle key** (V2 hazard 9); keys on `evaluation` only, riding `:2713` / `:2724`.
8. **DO NOT treat the 150 cap as the size guard.** A 3-day battle is ≤78 entries; the guard is bytes per entry × a whole-document subscription (§3.3). `chatExchanges` is uncapped.
9. **DO NOT render `threshold` or `signalSummary` outside the D-103 composer** (`voiceLayerAnticipation.js:101-102`, `:118-120`, `:148`); the pane reads `direction` only (`deriveChatMessages.js:84-92`).
10. **DO NOT give `directiveFiling.js` an import.** `:21` — zero imports by contract; inject collaborators (`controlSuppressionTelemetry.js:187-192`) or use a sibling module.
11. **DO NOT move the chat budget charge into the transaction without ruling the eleventh-message case.** The cap is checked before the model call (`chat.js:496-510`); a commit-time reject discards a 20-second answer.
12. **DO NOT claim `nothing was sent` from a 5xx.** The exchange write (`:996`) precedes the League charge (`:1034`) and every later throw returns 500 (`:1102`) with the exchange persisted (D-90). The attestation is the transaction's outcome; the arena's comment at `useArenaEngine.js:95-97` makes the same unprovable claim today.
13. **DO NOT introduce `Heard` copy without moving `AgentChat.receipts.render.test.jsx:83-88` and `battleViewCopy.js:16-19` in the same commit** — and `deskHonesty.test.js` scans the copy module.
14. **DO NOT name the check by the entry's exact minute** — slot only (D-83): `etSlotTime` (`deskCopy.js:79`), `slotLabel` (`deriveTurnLine.js:68`).
15. **DO NOT expect the League arena to show Heard for free.** It renders the route's response only (`useArenaEngine.js:154-158`), reads no `evaluations`, and non-owners get none (`tournamentBattleView.js:36-40`); Heard on the arena is a new doc read for the owner.
16. **`isDirectiveActive` fails OPEN** (`directiveUtils.js:25-31`): an uncertain expiry renders — and so is Heard. True by construction; say so in the spec.
17. **Under any `ARCHETYPE_INTEGRITY_MODE` but `'enforce'` every directive is `mode_not_enforce`** (`controlPromptRenderer.js:134-139`); live value `'enforce'` (`featureFlags.js:770`). A flip makes every receipt read suppressed — truthful, and the durable kill is `epoch_killed` (`:140-145`) — but a flip-day battle will show it.
18. **The review threshold** (BUILD_RULES §2, ≥10 files) is crossed by the whole of Phase B; split by P-1a/b/c or review adversarially.
19. **The flat6 branch moves anchors:** `decisionRecord.js` past `:363` (+128 lines); `voiceLayerGrounding.js:122-143`, `:247-255` (the hypothesis helpers); `Flat6BattleView.jsx:326-331` (joins `renderMotive`). Re-cite after it merges.
20. **The evaluation object also rides the shadow capture** (`runShadowTickCapture`, `:2783-2802`) — capture-only, but the new keys enlarge that envelope too (`shadowAssemblyCapture.js`); recorded, not a blocker.

---

## 6. Discrepancies — the seed, the ledger and the documents against the repo

1. **Drifted anchors.** Seed: entry `~:2628-2668` → **`:2629-2671`**; write `~:2796` → **`:2805`**; queue `~:2052-2057` → **`:2055-2061`**; `chat.js:686-708` → **`:996-1008`**. D-52 (ledger `:452`): `agentEvalPromptAssembly.js:1284-1297` → **`:1279-1283` + `:1389-1402`**; `agentTriggerGate.js:22-30` → **`:20-30`** (same content). V2's `:562-571` → **`:563-578`**. Build report §5 item 2's `chat.js:278` / `:692` → **`:496`** / **`:1002`**.
2. **`agentEvalPromptAssembly.js:688-714` is not a directive render.** It is the flat6 system prompt's ANTICIPATION CANDIDATES instruction (builder `:549`); the tiered twin is `:485-511`; the directive block renders once for both modes at `:1229-1241`. There is **no sibling tournament tick** (A3).
3. **"Rendering `threshold` is withheld by D-101"** — the withholding is **D-103** (ledger `:503`); D-101 (`:501`) is the tri-state flag.
4. **"`decisionRecord.js` is the shared home now"** — true for `filedLabel` (`:390`), the filing lines (`:405-432`), `filesChip` (`:386`), `renderMotive` (`:295`); `receiptLine` (`battleViewCopy.js:708-714`), `replaced` / `expired` (`:464-468`) and `slotLabel` (`deriveTurnLine.js:68`) are still client-side.
5. **"The tick reads `battle.directive` once at its start"** (V2 hazard 3, the seed's A2) — refined: a risk-swap tick re-reads the whole doc at `:1773` before the prompt (`refreshBattleFromDoc :463-467`); the rendered directive is the last read before `:2002`, and no read follows until the record.
6. **"Five early returns"** — five confirmed; the degraded-quotes guard (`:728-735`) and the lock-contention return (`:587-591`) are two more exits that write no `scoreUpdate`.
7. **"7 positions"** — the tiered book (2 + 2 + 3, P4 snapshot); a flat6 book is six.
8. **"The arena lane"** — the Battle View's `ArenaHeader.jsx` carries no directive; the lane is the League arena's `VoiceLane.jsx` kind `directive`.
9. **"§5 item 2 of the build Phase 0"** — it is §5 item 2 of `20260907_VOICE_GROUNDING_BUILD_PHASE0_REPORT.md` (`:271`), the overspend-by-one; the seed's phrasing is right, the anchors inside it drifted (item 1).
10. **"`20260903_VOICE_CHAT_TIMEOUT_PHASE0` §10.1"** — the doc has §10 (the four options) with no 10.1; the inert-signal finding is `:143` (§3) and `:266` (§11 item 2).
11. **"`deriveReceipts.js` derives Filed / Replaced / Expired"** — verified; it is called from exactly one site (`AgentBattleScreen.jsx:1384`), which is the merge seam.
12. **The grounding discovery's B3 anchors re-verify at HEAD unchanged** (`:1122-1286`, `:1458`, `:1535`, `:1664`, `:1784`, `:1826`, `fundamentalsRender.js:105`) — recorded so the next reader need not repeat it.

---

## 7. Found outside the task — for separate tasking (BUILD_RULES §3)

1. **`useArenaEngine.js:95-97`** — "The server did NOT charge on either" is asserted for every non-ok response; a 5xx thrown after `chat.js:996` has the exchange persisted, and the League charge at `:1034` may have run. Same class as D-90 (the Battle View's clause was removed for this reason).
2. **`chat.js:828`** still passes the cleared controller's signal to the gate (timer cleared `:747`) — the timeout Phase 0's §11 item 2, unfixed at HEAD. Behaviour correct; the parameter misleads.
3. **`agent-evaluate.js:2057`** accepts any object with a truthy `symbol` as an anticipation candidate — no `direction` enum check before dispatch; the dedupe key tolerates `direction ?? null` (`voiceLayerAnticipation.js:67`).
4. **`Flat6BattleView.jsx:326-331`** renders `rationale` / `hypothesis` as raw bytes (known; `decisionRecord.js:270-276` records it; the flat6 branch is the fix).

---

## 8. STOP

Phase 0 complete. Read-only: no code changed, no fenced file edited, no prompt text touched, nothing written to the working tree except this report, which is the branch's first and only commit. The size numbers are fixture-derived (no Firestore access) and should be re-run against a real completed battle document before the spec fixes the evidence field set. The Phase B spec is not written here.

*Three facts on every check's record, and the arithmetic says the first is free, the second must be lean, and the third is a kilobyte a day. The stamp site is where D-52 said it was; the resolution just has to be computed there, after the decision, on the object the decider read.*
