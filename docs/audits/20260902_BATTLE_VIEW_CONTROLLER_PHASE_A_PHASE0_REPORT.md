# Phase 0 — The Battle View controller, Phase A (V1)

**Date:** September 2, 2026
**Status:** READ-ONLY verification. Hard STOP at the end. No code written, no test run, no build.
**Seed:** "Phase A seed — the Battle View controller, first shipping phase (V1)" (Flash, with Fable)
**Prepared by:** Claude Code, under `docs/BUILD_RULES.md`
**Predecessor:** `docs/audits/PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md` (`main` @ `bd608373`) — its hazards 1–16 are build constraints here.

Every `file:line` below was read in this session at the HEAD named in §0 and is **VERIFIED** unless marked **ASSUMED** (inherited from the V2 discovery and not re-read).

---

## 0. Preamble — git verification (BUILD_RULES §3)

| Item | Value |
|---|---|
| Branch | `claude/battle-view-controller-phase-a-i51j5l` (assigned by the session harness; the seed names it `feat/battle-view-controller-phase-a` — see §5 item 1) |
| HEAD SHA | `aca8bf7a86dbcba023b62756595f505c6485d937` |
| Working tree | **Clean** (`git status --porcelain` empty) |
| `git fetch origin main` | Run **twice**: at session start (HEAD `db2f2fa0` = `origin/main`) and again after the founder merged PR #803 mid-session. The branch was then fast-forwarded (`git merge --ff-only origin/main`) at the founder's request — no merge commit, no conflict possible (the branch carried no commits of its own). |
| `origin/main` | `aca8bf7a` — **identical to HEAD** (`git rev-list --left-right --count` = `0 0`) |
| Also fetched | `origin/claude/cc-sync-flip` (`dee30fde`, one commit) — for item 8 |
| Remote branch | Absent before this session; created by the push of this report |

**What the mid-session merge changed.** PR #803 (Archetype Rank V2 Job 1) — 32 files, 8 commits `8e151ff..aca8bf7`. It touches **none** of the Battle View files (`AgentBattleScreen.jsx`, `AgentChat.jsx`, `TacticalRow.jsx`, `ProximityLabel.jsx`, `baggerbombAdapter.js`, `agentBattleTabs.js`, `agent-evaluate.js`, `chat.js`). It appended one flag (`ARCHETYPE_VECTORS_V2_ENABLED`) at the end of `src/config/featureFlags.js` (+28 lines) and one `DARK_BY_DESIGN` entry to `src/config/flagPinGuard.test.js` (+2). Every citation into those two files below was re-verified **after** the fast-forward. The two preflight merges the seed names — #806 `5521cf7` (D-56) and #805 `f8ecfb7` — are ancestors of HEAD.

**The D-58 docs commit has NOT landed.** At `aca8bf7`:
- `docs/audits/COMMAND_CENTER_ARC_FOUNDATION.md` — **absent** from the tree and from history.
- `docs/design/` — **the directory does not exist**; neither brief is in the repo.
- The in-repo ledger's last ruling row is **D-21** (`docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md:421`); D-52 → D-58 appear nowhere in `docs/`, `src/` or `api/` except as citations inside the V2 discovery.
- `docs/BUILD_RULES.md:78` still reads **37/40** cron entries; `vercel.json` carries **39** (parsed).
- The uploaded V2 discovery is byte-identical to the in-repo copy (added by `be43ab7`, "Add files via upload").

So this report verifies the seed against **code and the attached uploads**; the ledger addendum (D-52 → D-58) and the two briefs are treated as attached claims, not in-repo rulings, exactly as V2 §0.2 did.

**Why this report is a commit.** The build branch that just merged opened with a docs-only seed commit carrying its Phase 0 report (`8e151ff docs: seed Job 1 documents (spec V1.3, Phase 0 report)` — the first commit on `claude/archetype-rank-v2-job1-62tk4h`). D-58 says Phase 0 reports live under `docs/audits`. This report follows that pattern: one docs-only commit, no code, no flag, no test. The seed's "flag + pin + `DARK_BY_DESIGN` in the first commit" therefore reads as *the first build commit (A1)*. If the founder wants a code-free branch until A1, drop this commit and re-upload the file.

---

## 1. Executive verdict

| # | Phase 0 item | Verdict | Build implication |
|---|---|---|---|
| 1 | `useAgentBattle` subscribes; doc shape | **FOUND** — `onSnapshot`, whole doc; every listed field present | **CONSTRAINED elsewhere:** the Matchups rows read a *frozen prop*, not this doc (§2.1) |
| 2 | `baggerbombAdapter` phase / lastCheckedAt / nextDecisionAt | **FOUND**, callable on the same doc with null cache | **CONSTRAINED** twice: `next` = last + 15 min, not the cron grid; no late-state value (§2.2) |
| 3 | Matchups row and `% to Bust / Bagger` | **FOUND** — `calculateNextThreshold` already exported | **CONSTRAINED:** the dollar-distance branch and the rendered string are inline in the leaf component; no lock tag exists on the row (§2.3) |
| 4 | `AgentChat` receipt lines | **FOUND** at `:117` and `:925` exactly | **CONSTRAINED:** `expiry` is an enum, not a time; the message shape drops it; a shipped promise string sits where the receipts go (§2.4) |
| 5 | Tabs, unread-dot clear, mobile sub-tab | **FOUND** at `:449-451` exactly | The seed's "alerts already interleave in the chat" is **NOT FOUND** (§2.5) |
| 6 | Strings fixture + copy guard | **FOUND** (`deskCopy.js` + `deskHonesty.test.js`) | Battle View strings are **NOT under the guard**; three of the five turn-line strings already exist verbatim in `DESK_COPY` (§2.6) |
| 7 | Flag pattern | **FOUND** — Pass 1 template intact after the merge (`:1886-1887`) | Straightforward (§2.7) |
| 8 | Smoke pattern | **FOUND** — two house patterns | **Providing:** the `?battleViewController=1` accessor idiom (§2.8, §7) |
| 9 | `evaluations[]` fields; directive shapes | **FOUND** — all fields at `:2628-2668` | **CONSTRAINED:** `lastScoredAt` and the entry's `timestamp` are two different instants — the join is `>=`, never `===` (§2.9) |
| 10 | Fence and ratchet | **CONFIRMED** — `src/` + flag + tests only; no `api/` contact | No STOP condition found (§2.10) |

Eight founder decisions are needed before A1 (§3). None is a fence STOP.

---

## 2. Findings

### 2.1 `useAgentBattle` — FOUND (subscribes, returns the whole doc); the rows do not read it

**The hook.** `src/hooks/useAgentBattle.js:28-44` — `onSnapshot(doc(db, 'agentBattles', agentBattleId), …)`; `:32` `setBattle({ id: snapshot.id, ...snapshot.data() })` — the **entire** document, no projection. Convenience extracts at `:49-56` (`statusFeed`, `executionMode`, `pendingProposal`, `strategyPreset`, `gameplanMeeting`, `chatExchanges`, `chatBudgetUsed`, `feedBookmarks`); return `:58`. The screen destructures it at `AgentBattleScreen.jsx:436-444`. The owner reads the whole doc by rule: `firestore.rules:429-431` (`resource.data.ownerId == request.auth.uid`).

**Every field the seed lists is on `battle.*`:** `scoreState.lastScoredAt` (written `agent-evaluate.js:881`), `evaluations[]` (`:2710`, `:2719`), `trades[]` (built `agentSwapExecution.js:255-273`; appended `:354` / written `:367` — ASSUMED from V2), `chatExchanges[]` (`chat.js:618`), `directive` (`chat.js:626-637`), `statusFeed[]` (`agent-evaluate.js:2717-2718`), `portfolio` (the adapter reads `battle.portfolio` at `baggerbombAdapter.js:151`), `watchlist.hotBench` (`agent-evaluate.js:447`, `:1017`, `:1036`). **None absent.**

> **CONSTRAINED — the board does not read this doc.** The Matchups rows are built from the **`battle` prop**, not from the subscription: `AgentBattleScreen.jsx:681-689` (`enrichedPlayerPortfolio` from `battle?.creator?.portfolio`), `:691-699` (opponent), `:455` (`startingPrices` from `battle?.state?.startingPrices`). Only `thresholds` (`:456`) and `thresholdHistory` (`:637`) come from `agentBattle`. That prop is a **client-built snapshot** of the 120 s-polled `agentBattles` doc: `src/components/Dashboard/DashboardDesktop.jsx:79-93` (`creator: { portfolio: b.portfolio }`, `state: { startingPrices: b.portfolio?.startingPrices }`), `DashboardLoop.jsx:87` (same), `App.jsx:6795-6845` (`handleOpenAgentBattle` → `setCurrentBattle(currentBattleObj)` at `:6845`), routed at `BattleViewScreen.jsx:43-53`. All eight `setCurrentBattle` call sites (`App.jsx:6612, 6845, 8999, 9051, 9108, 9426, 9474, 9714`) are event handlers; no effect refreshes `currentBattle` from `activeAgentBattles`. **Consequence:** after an agent swap, the rows keep the pre-swap symbol until the battle is re-opened, while `agentBattle.portfolio`, `trades[]` and `evaluations[]` are live. Pre-existing and outside Phase A's scope (§6 bug 1) — but A1's "rows update top to bottom when `lastScoredAt` changes" cannot be true of a swapped symbol, and A2's Why? could open on a row the book no longer holds. **Decision needed (§3 #3):** under the flag, source the player's rows from `agentBattle.portfolio` (the same doc as the turn line — BUILD_RULES §9), leaving the flag-off render untouched.

Minor: `useAgentBattle.js:13` logs on every render (§6 bug 3).

### 2.2 `baggerbombAdapter.js` — FOUND; callable on the same doc; two CONSTRAINTS

**Pure by contract:** `src/adapters/baggerbombAdapter.js:12-18` — no fetch, no clock; `now` and `marketState` are injected. Entry `buildBaggerbombAdapter(battle, voiceLayerCacheDoc, agent, now, marketState)` at `:365`.

| Field | Derivation | Lines |
|---|---|---|
| `phase` | `derivePhase(battle, marketState)`: `status === 'completed'` → `POST_CLOSE`; `marketState.state === 'OPEN'` → `LIVE`; else `LIVE_CLOSED` if `scoreState.evaluationCount` or `lastScoredAt` exists, else `PRE_OPEN`. `PHASE` enum `:28-33`. | `:130-138` |
| `lastCheckedAt` | `toIso(battle.scoreState.lastScoredAt)` — "the scoring stamp, written on every eval cycle … not a statusFeed timestamp" | `:371-374` |
| `nextDecisionAt` | `deriveNextDecisionAt(phase, lastCheckedAt, marketState, now)`: `LIVE` only; **`lastMs + 15 min`** (`EVAL_INTERVAL_MS`, `:36`); **`null` when `candidate <= now`** (`:304`); `null` when the candidate's ET minutes ≥ the session close (`:310-314`, Intl `America/New_York` via `etMinutesOfInstant` `:110-118`) | `:296-316` |
| `nextOpenEt` | ET wall-clock **fields** (`etWallClock`, `:98-101`) — never an epoch (`:73-95` explains the double-conversion defect) | `:426` |

**Can the Battle View call it on the same doc? Yes.** The hook's `{ id, ...data }` (`useAgentBattle.js:32`) is the shape the adapter documents (`:358`; `useCommandCenterSync.js:33`). `voiceLayerCacheDoc` and `agent` may be `null` (`:369`, `:441-448`) — so **no cache read, no `voiceLayerCache` rule contact, no P-4**. `marketState` comes from `getMarketState()` (`src/utils/marketSchedule.js:135-169`; the Desk hook calls it once per render, `useCommandCenterSync.js:44-53`). Nothing in the adapter assumes a dashboard input: `classifyBattleType` reads `battle.groupId` only (`src/utils/commandCenterLiveBattles.js:64-66`). The adapter is on the copy guard's `GUARDED` list (`deskHonesty.test.js:47`), so any string added there is guarded for free.

> **CONSTRAINED (a) — two definitions of `next`.** The seed defines `next` as *the next cron slot on the `*/15 13-21 UTC` grid* (`vercel.json:157-158`). The adapter derives **`lastScoredAt + 15 min`**. These differ by the tick's write latency: a 16:45 UTC slot that writes `lastScoredAt` at 16:47:xx yields `~1:02 PM` from the adapter and `1:00 PM` from the grid. The Desk ships the adapter's arithmetic (`AgentDesk.jsx:86`; golden `AgentDesk.render.test.jsx:70-73` renders `Checked 12:47 PM · next ~1:02 PM`) — and the seed's own example string is that arithmetic. **Recommendation:** use the adapter (one source, BUILD_RULES §9); the tilde absorbs the difference. Founder to confirm (§3 #1).

> **CONSTRAINED (b) — no late-state value.** `nextDecisionAt` goes `null` the instant it is past (`:304`): there is no grace window and no retained "was due" time for `Last check 12:47 PM · next was due ~1:02 PM`. `deriveNextDecisionAt` is **module-private** (not exported). A1 needs the un-nulled candidate. **Recommendation:** add an exported, tested `deriveDueAt(lastCheckedAt, marketState)` beside it in the adapter and have `deriveNextDecisionAt` consume it (adapter output unchanged, so the Desk goldens stand), rather than re-deriving `+15 min` in `deriveTurnLine` (a second derivation of the same number). The late test in the seed (`now === next + grace`) then targets one function.

**Clock note for the build.** `derivePhase` transitions (`PRE_OPEN → LIVE`, `LIVE → LIVE_CLOSED`) and the late state are functions of `now`, not of a snapshot. The Desk gets a fresh `now` from its 120 s poll re-render. `deriveTurnLine(battleDoc, now)` will need a coarse `now` refresh (once a minute, or on `visibilitychange`) — the rendered text changes only at state transitions, so this is compatible with "no live-ticking clock"; a per-second countdown is not needed and must not be added.

### 2.3 The Matchups row — FOUND; the lift is possible; CONSTRAINED on the string

**The row.** `TacticalRow` (`src/components/BaggerBomb/TacticalRow.jsx:432`), rendered per tier slot at `AgentBattleScreen.jsx:1000-1008` with `leftAsset={enrichedPlayerPortfolio[tier.key]?.[i]}` (`:1002`, the player) and `rightAsset={enrichedOpponentPortfolio…}` (`:1003`, the CPU). Sides are `AssetSide` (`:17`), left at `:462-470` (`isRight={false}`), right at `:480-486` (`isRight={true}`). `ClosedTradesSection` follows at `:1015-1018` (renders `agentBattle.trades` — symbol, points, `swappedOutAt`; no engine text, `ClosedTradesSection.jsx:41-49`, `:129-131`).

**The enrichment (client math, per V2 Q7b).** `AgentBattleScreen.jsx:556-678` `enrichAsset`: `openPrice` `:570`, `curPrice` `:571`, `baseATR = threshold.threshold || DEFAULT_THRESHOLD` `:573`, `priceChange` `:575-577`, `thresholdBaseline` `:621-624`, `thresholdPriceChange` `:625-627`, `multiplier` `:631`, `history` merged with `agentBattle.thresholdHistory` `:637-641`, score via `calculateAssetScoreV3` `:658-664`; returns `{ …asset, priceChange, thresholdPriceChange, baseATR, points, badges, history, currentPrice }` `:666-674`.

**Where `% to Bust / Bagger` is computed.** `src/components/BaggerBomb/ProximityLabel.jsx`:
- `calculateNextThreshold(priceChange, baseATR, history)` `:37-158` — Bagger branch `:61-72`, Bust branch `:110-121`; `distance = targetPercent − priceChange` in ATR-percent terms.
- Called in a `useMemo` at `:176-179`.
- The **dollar branch** `dollarInfo` `:182-194`: when `asset.dailyLevels` and `currentPrice` exist, `pctDistance = |targetPrice − currentPrice| / currentPrice × 100` — the number the row *actually* renders on a battle with cron levels.
- `formatText()` `:229-242` assembles the string: `${icon} ${dollarInfo.pctDistance.toFixed(1)}% to ${label}` (`:239`) or `${icon} ${distance.toFixed(1)}% to ${label}` (`:241`).
- Props from `TacticalRow.jsx:343-353`: `priceChange={thresholdPriceChange ?? priceChange}`, `baseATR`, `history`, `dailyLevels={asset.dailyLevels}`, `currentPrice={asset.currentPrice}`.

**Can the values be lifted (hazard 15)?** Partly today: `calculateNextThreshold` and `THRESHOLDS` are **already exported** (`ProximityLabel.jsx:311`; the barrel re-exports `THRESHOLDS`, `index.js:8`). But the dollar branch and the string assembly are inline in the component, so a Why? panel calling the exported function would render the ATR distance beside a row showing the dollar distance — precisely the hazard. **Build shape:** extract one pure `computeProximity({ priceChange, baseATR, history, dailyLevels, currentPrice }) → { text, label, distance, direction, achievement }` from `:176-242`, call it once in `AssetSide`, pass the result to `ProximityLabel` (new optional prop; the component keeps its own path when the prop is absent, so the user-side BaggerBomb views are untouched) and to the Why? panel. Flag-off byte-identity is provable by a test comparing the extracted function's `text` with the current `formatText` over a fixture matrix. All in `src/`, non-fenced.

**Tap surface.** `AssetSide`'s `onClick={handleAssetClick}` (`:171`) acts only in `swapTargetMode` (`:163-167`). The symbol tap (`:204-206`) opens the research modal (`onSymbolClick` → `handleSymbolClick` `AgentBattleScreen.jsx:784-790`); the points tap (`:277-279`) opens the breakdown popover (`:792-794`). A Why? tap is a new handler on the **left** `AssetSide` only (`isRight === false`), with the existing symbol/points taps stopping propagation as they already do. The row is a `motion.div` flex row, `minHeight: 120` (`:449-459`); the in-place expansion renders beneath it inside the tier map (`AgentBattleScreen.jsx:996-1010`).

> **NOT FOUND — a lock tag on the row.** `TacticalRow.jsx`, `ChamberFuse.jsx` and `BadgeRow.jsx` render no lock (case-insensitive grep: one false hit, `display: 'inline-block'` at `TacticalRow.jsx:213`). The swap lock exists only on the Desk (`baggerbombAdapter.js:223-238`, from the cache) and the user-side BaggerBomb views. The seed's "the row's lock tag as it already displays" has nothing to echo; the facts block shows **no lock line** and computes none (hazards 6, 16).

**Held since / entry.** The enriched asset carries `currentPrice` (`:672`) and the position's raw `swapPrice` / `swappedInAt` ride `…asset`; `openPrice` (`:570`) is the entry the row's `%` is computed from. The adapter's `buildBook` derives `entry` and `heldSince` a second way (`baggerbombAdapter.js:150-178`, from `portfolio.startingPrices` / `activatedAt`). **Take entry from the row's enriched asset**, never from the adapter's `book` — one source beside one number.

**Note, not a blocker:** `TacticalRow.jsx:115-144` computes a *second* multiplier for the radiance glow from `priceChange` (`:116`), while the label is fed `thresholdPriceChange ?? priceChange` (`:344`). On day 2+ the glow and the label key off different numbers (§6 bug 4). Phase A must not add a third derivation.

### 2.4 `AgentChat.jsx` receipt lines — FOUND; per-exchange states render inside `ExecutionCard`; CONSTRAINED on data

**`DIRECTIVE LOCKED IN` — `:117`.** Inside `ExecutionCard({ directive })` (`:89`), which reads `directive.text` (`:125`) and `directive.directiveThreadId` (`:90`). Rendered by `MessageBubble` (`:163`) at `:244-245` when `message.hasDirective && message.directive`. Messages come from `serverMessages` (`:421-469`): per exchange, `hasDirective: ex.hasDirective || false` (`:457`) and **`directive: { text, directiveThreadId }` only** (`:458-460`). The exchange's `directive.expiry` is **dropped** at that boundary; the message keeps `timestamp: ts` (`:465`, from `ex.timestamp`, `:426-428`).

**`↳ from directive` — `:925`.** Reads `item.directiveThreadId` (`:910`) on a `_type: 'trade'` timeline item. Those items are built in `tradeEvents` (`:717-769`) from **`statusFeed`** entries with `action ∈ {swap, emergency_swap, trade_executed}` (`:719`, `:737`), carrying `directiveThreadId: entry.directiveThreadId || null` (`:756`) — the statusFeed swap entry's field, stamped from the model's own echo (`agent-evaluate.js:2603`, `haikuResult?.directiveThreadId`). `trades[]` is joined only for P&L (`:722-731`, `:758-763`). **`Acted` is keyed to the statusFeed entry, not to `trades[]`** — shipped behaviour, unchanged by Phase A.

**Where `Replaced` / `Expired` render.** Inside `ExecutionCard`, beneath the text, where today sit three **infinitely pulsing dots** (`:128-142`, `repeat: Infinity`) and the line **`Executing on next evaluation window`** (`:143-146`). Inputs the card does not have today: `battle.directive` (not a prop of `AgentChat` — props `:353-370`; the screen passes `chatExchanges`, `statusFeed`, `trades`, budgets and `proposalHistory` at `AgentBattleScreen.jsx:1037-1058`), each exchange's `directive.expiry` / `directiveThreadId` (present on the record, `chat.js:575-592`, but stripped at `:458-460`), and the later exchanges' timestamps. **Build shape:** a pure `deriveReceipts(chatExchanges, directive, now)` → `{ [directiveThreadId]: { state: 'filed'|'replaced'|'expired', at } }`, computed in the screen and passed down `AgentChat → MessageBubble → ExecutionCard`.

> **CONSTRAINED — the shipped promise string.** `Executing on next evaluation window` (`:145`) is a claim the system cannot prove (honesty rule 4; D-51's *Filed is not heard*), and it renders on **every** historical directive card, with a permanent pulse (the seed's standing lock: no motion between checks). Phase A's receipts land exactly there; `Replaced 12:58 PM` beside `Executing on next evaluation window` contradicts itself. **Decision needed (§3 #4):** under the flag, replace that line and stop the pulse (current directive → `Filed {t}`; others → `Replaced {t}` / `Expired`); flag-off unchanged.

> **CONSTRAINED — `expiry` is an enum, not a time.** `api/_utils/directiveUtils.js:8-22`: `'end_of_battle' | '3_games' | 'permanent'` (defaults at `chat.js:579` and `:628`). `end_of_battle` and `permanent` never expire during a live battle (`:45-46`); only `3_games` does, computed against `battle.timing.tradingDays` and the current trading day (`:48-70`: created day N → active N, N+1, N+2). The client **cannot import** `directiveUtils.js` cleanly — it imports the fenced `agentEvalPromptAssembly.js` (`:33`), a Node-only graph — and the seed forbids `api/` contact anyway. **Recommendation (§3 #6):** Phase A's `Expired` = `battle.status === 'completed'`, or `expiry === '3_games'` with ≥ 3 trading days elapsed, ported as a small pure client function over `tradingDays` + the screen's own ET-date idiom (`AgentBattleScreen.jsx:606-611`); never a wall-clock deadline. `battle.directive.createdAt` exists for that math (`chat.js:630`).

**Shapes at HEAD.** `battle.directive` = `{ text, expiry, directiveThreadId, createdAt, adjustmentId?, canonicalTextVersion? }` (`chat.js:626-637`); exchange `directive` = `{ text, expiry, directiveThreadId, adjustmentId?, canonicalTextVersion? }` (`:575-591`), sibling `directiveThreadId` (`:592`), `timestamp` (`:595`); appended by `arrayUnion` (`:618`) in the same `update` that sets `directive` (`:617-639`). `createdAt` (`:630`) and the exchange `timestamp` (`:595`) are two `new Date()` calls in one handler (same second). **Use the exchange timestamp for `Filed {t}`**, since `Replaced` / `Expired` also key off exchanges (§9, one source). `chatExchanges` is bounded by the message budgets (`:621-623`), never sliced.

### 2.5 Tabs and the unread-dot clear — FOUND; "alerts interleave in the chat" NOT FOUND

**Tabs.** `src/screens/agentBattleTabs.js:14` `TAB_KEYS`; `:29-35` `tabLabels()` (label follows `COMMAND_CENTER_SYNC_ENABLED`, `:32` — dark at HEAD, so the tab reads "Command Center"). `AgentBattleScreen.jsx:408` `activeTab`; `TabBar` `:331-381`, rendered `:962-969`; tab bodies `:973-1085` — matchups `:988-1019`, command `:1023-1059` (→ `AgentChat` `:1037-1058`), gametape `:1061-1083` (→ `GameTapeView` `:1075-1082`). Effects in the screen: `:108` (`useIsDesktop`, matchMedia ≥ 768 px, `:104-115`) and `:527` (price poll) — neither depends on `activeTab`.

**The clear.** `:449-451` — `if (activeTab === 'command') lastSeenFeedLengthRef.current = statusFeed.length;` during render; ref `:427`; the dot at `:757-762` (`hasNewFeedEntries = statusFeed.length > lastSeenFeedLengthRef.current` `:759`; `hasCommandDot`; amber `commandDotColor` for a pending proposal). **Rehome:** an effect keyed on `[statusFeed.length, chatVisible]` where `chatVisible` = the desktop chat column is mounted, or the mobile sheet detent is `half`/`full`; the flag-off path keeps `:449-451` byte-for-byte. On desktop under the flag the chat is always visible, so the dot has nowhere to show; on mobile it belongs on the sheet's peek handle.

**Mobile "Live Activity" sub-tab.** It lives **inside `AgentChat`**, not the screen: `activeSubTab` `AgentChat.jsx:380`; desktop = side-by-side (`:1083-1135`: chat left, a 380 px "Live Activity" column right rendering `activityContent` `:1073-1079` = `LiveActivityPanel`); mobile = a `['chat', 'activity']` sub-tab bar (`:1137-1172`, label `:1166`). `LiveActivityPanel` (`src/components/Agent/LiveActivityPanel.jsx:385-528`) renders four things: `AgentStatusIndicator` (`:97-130`: the latest statusFeed message with a pulsing dot; idle string "Your agent will start analyzing when the market opens." `:101`), `BreakthroughAlerts` (`:441`, defined `:318`), a collapsible "Agent Reasoning" list of scratchpads (`:444-500`), and "View full activity log →" (`:503-523`, `onSwitchToGameTape`).

> **NOT FOUND — "its alerts already interleave in the chat."** `BreakthroughAlerts` renders only inside `LiveActivityPanel` (`:441`) and on the Desk (`AgentDesk.jsx:31`); `AgentChat.jsx` has no reference to it. The chat timeline interleaves **trade events only** (`:772-782`). Not rendering `LiveActivityPanel` under the flag removes the breakthrough alerts and the scratchpad "Agent Reasoning" list, which have no other home in the controller layout. **Decision needed (§3 #5).** The status line is A1's turn line (agreed); "View full activity log" is Game Tape (reachable from the `···` menu).

**The `···` menu — NOT FOUND today.** The header chrome is Back + the equipped-watchlist chip + the status dot (`AgentBattleScreen.jsx:865-939`); a new control. `FilmRoomBanner` sits between the header and the tabs (`:952-959`) and needs a slot in the controller layout.

**`ensure-opener`.** `AgentChat.jsx:502-534`, guarded by the module-scoped Set `attemptedOpenerBattleIds` (`:349`, checked `:506`, marked `:517`) — so a remount never re-POSTs, but A4 must still render **one** `AgentChat` per layout (never a desktop column *and* a mobile sheet at once).

### 2.6 Strings fixture and copy guard — FOUND; Battle View strings NOT under the guard

**The "fixture" is a copy module:** `src/components/Dashboard/desk/deskCopy.js` — `DESK_COPY` (`:89-206`), with formatters `etTime` (`:38-47`, Intl `America/New_York`, DST-safe), `etWallClockLabel` (`:72-79`, wall-clock fields), `etStamp` (`:82-87`).

**The guard:** `src/components/Dashboard/desk/deskHonesty.test.js` — `GUARDED` files `:43-49` (`deskCopy.js`, `AgentDesk.jsx`, `ManageStation.jsx`, `baggerbombAdapter.js`, `useCommandCenterSync.js`); `FORBIDDEN` `:51-62`; comment-stripped, word-boundary, case-insensitive matching `:70-93`; the scoped `analyzing` exemption `:99-113` (asserts `LiveActivityPanel.jsx:101` still carries the idle string — Phase A keeps the file, so it holds); the no-inline-JSX-copy rule for the desk directory only `:116-135`; the tilde tests `:137-151`. **Registration = listing the file in `GUARDED`.** Nothing under `src/screens/`, `src/components/Agent/` or `src/components/BaggerBomb/` is guarded today.

**Three of the five turn-line strings already exist verbatim in `DESK_COPY`:** `postureLive` (`:105-110`, `Checked {t} · next ~{t}`), `posturePreOpen` (`:120`, `First check at 9:30 AM ET`), `postureComplete` (`:130`, `Battle complete`); the Desk selects them by phase at `AgentDesk.jsx:86-91`. **Recommendation:** the turn line consumes those three from `DESK_COPY` (so the Desk and the Battle View cannot disagree — §9) and adds the two it lacks (late; closed-with-last-check) there; the Battle-View-only strings (Why?, receipts, doors, menu) go in a new guarded module (e.g. `src/screens/battleView/battleViewCopy.js`) appended to `GUARDED` — together with the new Battle View components — in the same commit.

> **CONSTRAINED — two closed-state strings.** The seed's `Market closed · last check {t}` differs from the Desk's shipped `postureClosed` `Market closed · next check Tue 9:30 AM ET` (`deskCopy.js:124-127`). One phase, two surfaces, two sentences. **Decision needed (§3 #2).**

**Mechanical check.** All 19 §4 strings pass the guard's exact regex (0 hits; `About {sym} — ` does not match `about\s+to`). Script left in the session scratchpad, not the repo.

### 2.7 Flag pattern — FOUND (template intact after the merge)

- **Definition template:** `src/config/featureFlags.js:1862-1887` — docstring naming DARK/default FALSE, the render-scope rule (`:1877-1881`: read the flag **inside render**, never `const ON = FLAG` at module scope — 15 of 56 `vi.mock` sites use bare factories), the flip-is-its-own-PR rule (`:1883-1885`); `// Pinned by: commandCenterSyncFlags.test.js …` (`:1886`); `export const COMMAND_CENTER_SYNC_ENABLED = false;` (`:1887`). The newest sibling, `ARCHETYPE_VECTORS_V2_ENABLED` (end of file, landed in #803), has the identical shape.
- **Pin guard:** `src/config/flagPinGuard.test.js` — `FLAG_SOURCE_MODULES` `:45-49` (`featureFlags.js` is registered; a new `export const <NAME>_ENABLED = false;` is auto-discovered by the regex at `:128`); `DARK_BY_DESIGN` `:58-120` (Pass 1 entry `:105-106`); pin regex `:161`; the intent-aware contradiction message `:246-264`; **registry integrity** `:275-286` (every listed flag must exist and be `false`, with a note); the `Pinned by:` docstring check `:288+`.
- **Pin test template:** `src/config/commandCenterSyncFlags.test.js:19-26` — one flag per file, `expect(FLAG).toBe(false)`, with the two-direction tripwire prose.
- **Flag-on/off test template using the real module:** `src/screens/agentBattleScreenHuddle.test.js:56-64` (`vi.resetModules()` + `vi.doMock('../config/featureFlags', importOriginal spread)`).
- **Byte-identity template:** the repo has **no snapshot idiom** (`toMatchSnapshot` appears nowhere under `src/`); the precedent is golden-HTML string equality — `ManageStation.sync.render.test.jsx:9-15`, `:36-44` against `desk/__golden__/manageStation.dark.html` (earlier: `AgentRecordSheet.render.test.jsx:74`). `AgentBattleScreen.restFallback.test.jsx:8-19`, `:34-55` shows the screen `renderToString`s with the hooks and the two accessor flags mocked. A4's "flag off → tabbed screen unchanged" should be a golden of the tabbed render captured at the pre-build commit, not a snapshot.
- `BATTLE_VIEW_CONTROLLER_ENABLED` satisfies the `_ENABLED` naming the guard requires.

### 2.8 Smoke pattern — FOUND (two house patterns); the one I will provide

- **Pattern A — the flip branch.** `origin/claude/cc-sync-flip` (`dee30fde`): one commit, three files — the literal + docstring, the pin moved to `toBe(true)`, the `DARK_BY_DESIGN` entry dropped. Its Vercel preview is the smoke surface (BUILD_RULES §2). Cost: a second branch to smoke; the founder smokes with the flag lit.
- **Pattern B — the URL-override accessor.** `isMatchupsBackdropOn()` at `featureFlags.js:1247-1255` (`MATCHUPS_BACKDROP_ENABLED || ?matchupsBackdrop=1`, SSR-safe, malformed URL → flag alone), the `isAgentPresenceOn` idiom (`:1227`). Already used by this screen (`AgentBattleScreen.jsx:17`, `:126`, `:849`) and mocked to `false` in its test (`restFallback.test.jsx:51-55`). The override is deleted in the flip commit (the `?fuseHero=1` precedent, `:304-306`: "flip, pin and override travel together"). The pin guard scans only the `export const` line, so the accessor is invisible to it.

**I will provide Pattern B:** `isBattleViewControllerOn()` = `BATTLE_VIEW_CONTROLLER_ENABLED || ?battleViewController=1`, read at render time. The founder smokes on the build branch's own Vercel preview by opening a live battle with `?battleViewController=1` on the URL (this app has no router — the query string survives in-app navigation). The flag stays dark; no flip commit is needed for the smoke; the flip PR removes the override.

**The preview battle.** No in-repo preview path reaches `AgentBattleScreen` (`?preview=baggerbomb` mounts `BaggerBombBattleViewRedesign` against an inline fixture — `App.jsx:2218-2223`, `:9944-9956`, `__previewBattle.js`). Firestore is shared with the preview deployment, so the founder smokes against **a real live battle**. Smoke item 3 (a tick the guardrail held) cannot be manufactured from the client: CC will locate one by reading the live battle's `evaluations[]` for `downgraded === true`, and ships a fixture-driven render test of that state as the guaranteed fallback.

### 2.9 `evaluations[]` and the directive — FOUND; the "decided" join is CONSTRAINED

**The record** — `api/cron/agent-evaluate.js:2628-2668`: `evalId` `:2629` (minted `:2042` as `eval_NNN` from `evaluations.length + 1`), `timestamp: now` `:2630`, `decision` `:2633`, `symbolOut` / `symbolIn` `:2634-2635` (**null unless SWAP/PROPOSAL** — so nulled on every downgraded tick, per V2 §5 bug 1), `rationale` `:2637-2640`, `validationErrors` `:2657` (declared `:2064`, appended `:2162`), `downgraded` `:2658` (declared `:2063`; set at **`:2130, :2145, :2153, :2164, :2218, :2224, :2466`** — the seven sites, each one line below V2's numbers), `haikuError` `:2667`. Appended with `.slice(-150)` (`:2710`), written in `finalUpdate` (`:2719`) by the tick's single `battleRef.update` (`:2796`, ASSUMED from V2). The client receives it as `battle.evaluations` (§2.1).

> **CONSTRAINED — two instants, not one.** `scoreState.lastScoredAt` is its own `new Date().toISOString()` at `:881` (inside `scoreUpdate`, `:876-882`), while the entry's `timestamp` is `now` from `:2059`, taken later in the same `processAgentBattle` call (`:544`). **They are never equal.** Within one tick, `entry.timestamp ≥ lastScoredAt`; on the five early-return ticks (V2 Q3a) `lastScoredAt` advances with no new entry, so the latest entry is then **older** than `lastScoredAt`. The honest join: `decided = toMillis(latest.timestamp) >= toMillis(scoreState.lastScoredAt)`. The seed's test row "absence when the entry's `timestamp` is older than `lastScoredAt`" is exactly this rule; "matches the latest tick" must be read as `>=`, never `===`. (An equivalent cheaper key exists — `cronState.lastTriggeredAt` is the same `now` and is written only on the full path, `:2726` — but keying to the entry itself is what the seed asks and what Why? needs anyway.)

**Directive shapes** — verified in §2.4: `battle.directive` `chat.js:626-637`; exchange `directive` + `directiveThreadId` + `timestamp` `:575-595`; write `:617-639`.

### 2.10 Fence and ratchet — CONFIRMED: `src/` + flag + tests, nothing else

**Files Phase A touches:** `src/screens/AgentBattleScreen.jsx`; new `src/screens/battleView/*` (turn line, Why? panel, This turn strip, mobile sheet, receipts, copy, pure derivers); `src/components/Agent/AgentChat.jsx` (receipt props through `MessageBubble` → `ExecutionCard`); `src/components/BaggerBomb/ProximityLabel.jsx` (+ `TacticalRow.jsx` for the left-side tap); `src/adapters/baggerbombAdapter.js` (one exported due-at helper); `src/config/featureFlags.js`; `src/config/flagPinGuard.test.js`; a pin test; `deskHonesty.test.js` (`GUARDED` list); tests and one golden. **Nothing in `api/`.** No archetype-table import (`archetypeImportBoundaryBaseline.json` untouched — #803 just added its own entry there, unrelated). No new Firestore read (the adapter takes a null cache) → no `firestore.rules` contact, no P-4. No battle-doc write of any kind (hazard 9).

**Guards that will run:** `src/theme/tokens.guard.test.js` guards four files (`:52-57`), none of them Battle View files — but BUILD_RULES §10 still binds: new colours via `cssVar()` from `src/theme/cssTokens.js`, no new raw core-palette hex (the existing `#5eead4` literals in these files are grandfathered, not a licence). `src/theme/motion.guard.test.js` guards only `ParamToggle.jsx` (`:57`) — BUILD_RULES §11 still binds: the landing sequence and the sheet consume `src/theme/motion.js` tokens (`:103-127`) via `motionToken(name, { reducedMotion })` (`:155`); the house reduced-motion pattern is framer's `useReducedMotion` (12 non-test files, e.g. `BaggerBombBackground.jsx`).

**Review threshold:** Phase A will exceed 10 files → BUILD_RULES §2 adversarial review with a written `docs/audits/` record, `vite build`, and reviewer isolation (snapshot tree, read-only on git).

---

## 3. Founder decisions needed before A1 (none is a fence STOP)

1. **`next` definition.** Adapter (`lastScoredAt + 15 min`, what the Desk ships) vs the cron grid slot. *Recommend the adapter — one source.* (§2.2a)
2. **Closed-state string.** Seed `Market closed · last check {t}` vs Desk `Market closed · next check Tue 9:30 AM ET`. *Recommend one string on both surfaces, or both facts in one line.* (§2.6)
3. **Row source under the flag.** Keep the frozen prop (rows go stale after a swap) or read the player's rows from `agentBattle.portfolio`, the doc the turn line and Why? read. *Recommend the live doc under the flag; flag-off untouched.* (§2.1)
4. **`ExecutionCard` under the flag.** Replace `Executing on next evaluation window` + the infinite pulse with the Filed / Replaced / Expired line. *Recommend yes — the receipts cannot sit beside a promise.* (§2.4)
5. **Breakthrough alerts and "Agent Reasoning".** They leave with `LiveActivityPanel`. Drop for Phase A, or reach them from the `···` menu. *Recommend drop for A, note in the handover.* (§2.5)
6. **`Expired` scope.** Battle-complete plus a client port of the `3_games` day math, or battle-complete only until Phase B. *Recommend the port (pure, tested, ~20 lines).* (§2.4)
7. **Commit order.** This report is the branch's first (docs-only) commit, per `8e151ff`; the flag + pin + `DARK_BY_DESIGN` land in the first *build* commit (A1). Confirm, or drop this commit.
8. **Smoke pattern.** B (`?battleViewController=1`, no flip commit) as proposed, or A (a flip branch). (§2.8)

---

## 4. Hazards — the V2 sixteen, plus seven found here, restated for the build

V2 §3 hazards 1–16 stand verbatim. Verified touchpoints this session: 2 (`downgraded` at `:2658`, seven sites), 3 (`Replaced` shows text + time only), 4 (`lastScoredAt` at `:881` is not a decision), 6 (no lock on the row — nothing to echo), 12 (`source` / `triggeredBy` are on the swap feed entries `:2578-2579`, `:2599-2600`; Phase A renders neither anywhere new), 14 (`:449-451`), 15 (§2.3), 16 (`isSwapLocked` untouched).

17. **DO NOT** promise a row update on a swap while the rows read the frozen prop (`AgentBattleScreen.jsx:681`, `DashboardDesktop.jsx:79-93`). Decide §3 #3 first.
18. **DO NOT** leave `Executing on next evaluation window` (`AgentChat.jsx:145`) beside a receipt.
19. **DO NOT** derive `next` twice (grid in the turn line, `+15` on the Desk). One function.
20. **DO NOT** treat `expiry` as a timestamp; it is `end_of_battle | 3_games | permanent` (`directiveUtils.js:8-22`).
21. **DO NOT** join "decided" with `===`; `entry.timestamp` and `lastScoredAt` are different `new Date()` calls (`:2059` vs `:881`).
22. **DO NOT** import `api/_utils/directiveUtils.js` from the client; it pulls the fenced assembler (`:33`).
23. **DO NOT** add a third proximity derivation beside `TacticalRow.jsx:116` and `ProximityLabel.jsx:176`; lift, don't recompute.

---

## 5. Memory discrepancy log — attached claims the repo contradicts

| # | Claim (seed / addendum) | Repo at `aca8bf7` |
|---|---|---|
| 1 | Branch `feat/battle-view-controller-phase-a` | The harness assigned `claude/battle-view-controller-phase-a-i51j5l`; all work is on that branch. |
| 2 | "cut … after … the D-58 docs commit" | No such commit on `main`: foundation doc and both briefs absent, `docs/design/` does not exist, ledger ends at D-21, BUILD_RULES §6 still says 37/40. |
| 3 | `next` = the next cron slot | The adapter and the Desk derive `lastScoredAt + 15 min` (`baggerbombAdapter.js:302`). |
| 4 | "an `evaluations[]` entry whose `timestamp` matches the latest tick" | Never an exact match (`:881` vs `:2059`); `>=` is the rule. |
| 5 | "Expired — … `expiry` has passed" | `expiry` is an enum; only `3_games` can expire mid-battle, by trading-day count. |
| 6 | "its alerts already interleave in the chat" (A4) | `BreakthroughAlerts` renders only in `LiveActivityPanel` and `AgentDesk`; the chat timeline interleaves trades only. |
| 7 | "the row's lock tag as it already displays" | No lock tag on the Matchups row. |
| 8 | "the strings fixture" | A copy module (`deskCopy.js`) plus an explicit `GUARDED` list; Battle View files are not guarded. |
| 9 | "snapshot the tabbed render with the flag off" | No snapshot idiom in the repo; the precedent is golden-HTML string equality. |
| 10 | `AgentBattleScreen.jsx:444`, `:449-451`; `AgentChat.jsx:117`, `:925`; `agent-evaluate.js:2628-2668`; `chat.js:571-618` | **All confirmed at the same lines.** `downgraded` sites are each +1 from V2 (`:2130` …). |
| 11 | `ledger addendum` "Foundation §1.4 … DebateModal entry point is not wired" | Confirmed: `DebateModal` is mounted (`AgentBattleScreen.jsx:1089`) but `handleChallenge` (`:770`) has no caller. |

---

## 6. Bugs found outside this task — for separate tasking (BUILD_RULES §3; not fixed)

1. **Matchups rows freeze at open.** The rows read a client-built snapshot of the polled `agentBattles` doc (`DashboardDesktop.jsx:79-93`, `App.jsx:6795-6845`) and no path refreshes `currentBattle`; after an agent swap the row keeps the old symbol while `agentBattle.portfolio` moves. A §9 display-agreement gap on the flagship screen.
2. **`ExecutionCard` promises execution.** `Executing on next evaluation window` + an infinite pulse on every historical directive card (`AgentChat.jsx:128-146`) — a D-51 / honesty-rule-4 break in shipped copy.
3. **`useAgentBattle.js:13`** logs `Subscribing to:` on every render, not on subscribe.
4. **Glow vs label.** `TacticalRow.jsx:116` keys the radiance to `priceChange`; the label gets `thresholdPriceChange ?? priceChange` (`:344`). On day 2+ they can disagree (§9).
5. **`AgentStatusIndicator`** falls back to `Agent is active.` with a pulsing dot (`LiveActivityPanel.jsx:99-101`, `:118-124`) — continuous-cognition framing beyond the grandfathered `analyzing` string.

---

## 7. The smoke pattern (item 8, restated as the deliverable)

`isBattleViewControllerOn()` in `featureFlags.js` beside `BATTLE_VIEW_CONTROLLER_ENABLED = false` — flag OR `?battleViewController=1`, SSR-safe, read at render time. Founder: open the Vercel preview of this branch after A3, open a live battle, append `?battleViewController=1`, run §6 of the seed. Flag-off check: remove the query string — the tabbed screen. The flip PR deletes the override.

---

## 8. STOP

The report is written and committed as this branch's docs-only first commit. **No code was modified; no flag, pin or `DARK_BY_DESIGN` entry was added; no test suite or build was run.** The build starts in a fresh session on this branch after the founder has read §3.

*Prepared September 2, 2026 against `aca8bf7` (= `origin/main` after the founder's mid-session merge of #803). Every line number was read in this session; two inherited anchors are marked ASSUMED.*
