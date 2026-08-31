# Phase 0 Discovery — Command Center Sync, Pass 1

**Date:** August 31, 2026
**Spec:** `docs/audits/PASS1_SPEC_COMMAND_CENTER_SYNC_V1.md` §4 (six checks)
**Framework:** `docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md`
**Status:** READ-ONLY. Hard STOP. No build phase started.

---

## Preamble (BUILD_RULES §3)

- `git fetch origin` — **run**, first action of the session.
- **origin/main** = `fa6dfed75520e57585125b3bb260e4c439ba0832`
- **Branch** = `claude/cc-sync-pass1-5lz5sb` (see Deviation D-1)
- **HEAD at discovery** = `fa6dfed7…` → now `9026d4d5` (one docs-only commit added mid-discovery: the two relay `.md` files, 696 insertions, `src/` and `api/` untouched). Some cited counts below are noted where the two differ.
- **Working tree:** clean.
- `node_modules` was absent at session start; `npm ci` was run (gitignored, `.gitignore:10` — not project state). **Full-suite baseline at HEAD: exit code 0, `Test Files 509 passed | 1 skipped (510)`, `Tests 8403 passed | 62 skipped (8465)`.** Green before any of my changes.

Every claim below carries a `file:line` I read in this session. Each was produced by one agent and then independently re-read by a second agent instructed to refute it; the load-bearing facts (every STOP condition) I then verified personally a third time.

---

## Executive verdict

| # | Check | Verdict |
|---|---|---|
| §4.1 | D-16 — chat mode in LIVE_CLOSED | **Premise refuted.** Mode is not derived from battle status at all. |
| §4.2 | `voiceLayerCache` shape + `ownerId` | Shape **confirmed exactly**. `ownerId` **NOT FOUND** → **P-4 blocked**. |
| §4.3 | `pendingReflection` writer/reader | **Expectation refuted.** It *is* read — by a cron that drains it. |
| §4.4 | The 120 s poll | Confirmed with corrections. **Two shells, not one** → Phase B doubles. |
| §4.5 | `getMarketState()` | States confirmed. **No injectable `now`** → Phase A acceptance untestable. |
| §4.6 | Rename blast radius | `PvpCommandCenter` **confirmed dead — no STOP.** Framework's numbers are wrong on scale. |
| sup. | P-5 `BREAKTHROUGH_MAP` | Confirmed — but **not a pure deletion** (`:179` fallback). |
| sup. | Flag mechanics | Three edits confirmed. Suite is runnable. |
| sup. | Dashboard/tokens/tests | **Three spec premises false** (RTL, `__fixtures__`, snapshots). |

**Bottom line: six STOP conditions need your ruling before Phase A0.** Two (P-4, P-6) are hard blockers where the spec asks for something the code cannot currently do. I have resolved none of them.

---

## The six checks

### §4.1 — D-16: chat mode during LIVE_CLOSED — **PREMISE REFUTED**

`detectMode()` does **not** compose battle status with market state.

```
api/agent/chat.js:125-133
125  function detectMode(battle) {
126    const marketState = getMarketState();
127    const isMarketClosed = CLOSED_STATES.has(marketState.state);
128    if (!isMarketClosed) return 'battle';
129
130    const reviews = Array.isArray(battle?.dailyReviews) ? battle.dailyReviews : [];
131    const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
132    return isReviewForToday(latestReview) ? 'review' : 'battle';
133  }
```

It composes **market state × "has today's daily review landed."** `battle.status` is read only later, at `chat.js:216`, as an allow/deny gate (`battle.status !== 'active' && mode !== 'review'` → 400).

- `CLOSED_STATES` (`chat.js:102`) = `{CLOSED_AFTERHOURS, CLOSED_WEEKEND, CLOSED_HOLIDAY}` — **`PRE_MARKET` is deliberately excluded** (comment `:99-101`: "not pre-market"). PRE_MARKET returns `'battle'` at `:128`.
- `MODE_BUDGET` (`chat.js:135-138`): `battle → {chatBudgetUsed, 10}`, `review → {reviewBudgetUsed, 5}`. Matches framework §6/D-4.
- Directives gate on **mode only**, never market state: `chat.js:465-467` forces `null`/`false` in review mode; the write is then structurally impossible (`:569` mints the threadId only if both are truthy).

**(e) Answer:** "Talk It Over during closed hours" is a different product **only when the mode actually flips** — i.e. only after the daily-review cron has written today's review. Between the close and that write, an active battle stays in `battle` mode with the full 10-message budget and directives fully live. **Mode during closed hours is not deterministic from market state.**

> Pass 1 renders no chat, so this changes no Pass 1 code. It matters for the **LIVE_CLOSED action-row copy** (spec §7): a row that implies a review-room conversation would be wrong for the several hours between close and review.

**Incidental — a framework gate cleared:** D-17 asked whether `directiveGate` is live. It is: `src/config/featureFlags.js:712` `export const ARCHETYPE_INTEGRITY_MODE = 'enforce';`, consumed at `api/agent/chat.js:18`. **Enforce, not observe.** That is a hard Pass 2 gate answered early, at no cost.

### §4.2 — `voiceLayerCache` shape + `ownerId` — **SHAPE CONFIRMED / `ownerId` NOT FOUND**

**Shape confirmed exactly as the spec expects**, both anchors holding (builder `:262-272`, writer `:800-817`). Three corrections a builder needs:

- `swapLock` is **an object, not a boolean**: `{locked, direction, distancePercent, message}` from `isSwapLocked` (`api/_utils/agentScoring.js:174/192/201/205`), and it is always present when `thresholdProximity` exists.
- `direction` exists at **two paths with different domains**: `redZone.direction` is `'positive'|'negative'`, never null; `swapLock.direction` is `'positive'|'negative'|null`.
- `thresholdProximity` is **not guaranteed** — omitted entirely when `baseATR <= 0` (`voice-layer-cache.js:238`) or the threshold change is non-finite (`:253`); `redZone` inside it can be `null` (`:270`). `zoneProgressPercent` is an integer 0–100 (`agentScoring.js:133,152`).

**The blocker.** The written doc has **no owner identifier of any kind**:

```
api/cron/voice-layer-cache.js:801-817  — writeBatch.set(cacheRef, { … })
  battleId, agentId, portfolioBriefs, benchBriefs, scoutAlerts,
  marketContext, dataFreshness, forgeSeeds, [newsLines], updatedAt
```

`grep -icE 'ownerid|odUserId|userId|uid'` across all 839 lines → **0**. Current rule:

```
firestore.rules:693-696
  match /voiceLayerCache/{battleId} {
    allow read: if request.auth != null;      // ANY authenticated user
    allow write: if false;
  }
```

versus the pattern P-4 wants to copy, `firestore.rules:430-431` (`resource.data.ownerId == request.auth.uid`).

**Copying that rule today would deny every read, including the owner's.** → STOP-1.

### §4.3 — `pendingReflection` — **EXPECTATION REFUTED**

The spec (§4.3) and framework D-19 both expect "nobody reads it." **It is read, and drained.**

```
api/cron/process-pending-reflections.js:47-53
  .where('status', '==', 'completed')
  .where('pendingReflection', '==', true)
  .orderBy('completedAt', 'asc').limit(BATCH_LIMIT)
…:88  pendingReflection: false,      // cleared in the same tick
```

Schedule (`vercel.json`): `process-pending-reflections` = `*/15 13..23,0 * * *` (every 15 min, 12 h) vs `agent-batch-review` = `25 20,21 * * 1-5`. **The flag is almost always already false by the time batch-review looks.** It is a live work queue, not a free hook — D-19's lean does not survive.

It also carries **three** distinct read semantics: `== true` (queue membership) and `=== undefined` / `!== undefined` at `agent-evaluate.js:4172, 4510` (a schema-presence discriminator whose soundness `:4142` says depends on every cron completion writing the field). Repurposing it risks that invariant.

Other facts:
- **`completeBattle` is NOT in the fenced file.** It is `api/cron/agent-evaluate.js:4159` (`grep -c completeBattle api/_utils/agentBattleService.js` → **0**). The spec's expectation about its location is wrong — but harmlessly, since `agent-evaluate.js` is not fenced.
- **The battle selector IS fenced.** `agent-batch-review.js:14` imports `findActiveAgentBattles` from `api/_utils/agentBattleService.js`; `:380` `const battles = await findActiveAgentBattles(db);` is its only selector. That function (`agentBattleService.js:43-50`) is `where('status','==','active')` — active-only, no orderBy, no limit — and its file is **fence-listed at `docs/BUILD_RULES.md:19`**. → STOP-2.
- **`vercel.json` holds 39 cron entries, not the 37** `BUILD_RULES.md:76` asserts. The documented "+2" tournament allowance is already spent.
- `completedAt` is an ISO string, so a completed-since-last-run predicate is *expressible* — but no composite index serves `status=='completed' + completedAt>=X` (the six `agentBattles` indexes in `firestore.indexes.json` all carry an unconstrained middle field).
- **`agent-batch-review.js` has zero test coverage** (411 lines, no test file). Spec §12 requires a fixture-timestamp test of the new predicate — it would be the first test this handler has ever had.
- **The "review doc" is `battle.dailyReviews[]`** (`agent-batch-review.js:223, 250-260`, deduped `:76`) — an array already on the battle doc the poll carries. So `debrief_pending` needs no new read. It is also the exact field `chat.js:130-131` keys on, so P-6 and D-16 share one data structure.

### §4.4 — the 120 s poll — **CONFIRMED, with two corrections**

`src/App.jsx:3892-3967`. `getDocs`, no `onSnapshot`. Interval `120_000` at `:3965` (**numeric separator — a grep for `120000` finds nothing**).

Two corrections to the framework's description:

- **It does not "span both agentIds."** There is no `agentId` clause. The query (`:3913-3917`) is `where('ownerId','==',uid) + where('status','==','active')`. Both battles arrive only because `api/_utils/casualClone.js:64` stamps the clone with the player's `ownerId`. Anything expecting a two-agentId query will not find one.
- **It is screen- and visibility-gated:** `:3893` `if (screen !== 'dashboard' || !isPageVisible) return;`. It does not run off-dashboard or on a backgrounded tab.

Per battle it stores raw `{id, ...doc.data()}`, so every battle field is already available — including `dailyReviews`, `scoreState`, `statusFeed`, `completedAt`.

**The consequential finding: there are two dashboard shells, and they are structurally unrelated.** `CommandDashboardDesktop.jsx` is a 100vh flex column + 3-column CSS grid; `CommandDashboard.jsx` (mobile) is one scrolling flex column. They share only leaf components (`ManageStation`, `ReviewStation`, the sheets, `DeployCeremony`), the `commandUI` primitives, and `deriveDeployGate`. **There is no shared slot scaffold — Phase B wires two components, and Phase D's copy test must cover both** (`'Talk it over'`, `'Soon'`, `'Deploy on this read'` each exist twice — `CommandDashboard.jsx:383-468` and `desktop/ReadColumn.jsx:125-210`).

Also: the codebase's slot vocabulary is **numbered stations** (01 Read / 02 Equip / 03 Deploy / 04 Manage / 05 Review), not the spec's "primary card / action row / bench / manage rail." Only 04 Manage is genuinely parallel across the two shells. The "action row" exists **only on mobile** (`CommandDashboard.jsx:383-444`); desktop's CTAs live inside `ReadColumn`. Phase B will have to create the anchors it wants to address.

`voiceLayerCache` is read from the client at exactly **one** place today, nowhere near the dashboard: `src/services/tournamentGroupService.js:499` (board prefill, `scoutAlerts` only) — and that reader resolves its agent by `where('ownerId','==',uid)` at `:471-474`, so **it is the owner** and an owner-scoped rule would not break it.

`src/App.agentBattlesPoll.test.js` is a **source-text regex guard**, not a behavioural test: `:76-78` asserts exactly one `setActiveAgentBattles(` call. **A `voiceLayerCache` getDoc must therefore land in a separate state setter, not be merged into `activeAgentBattles`.** `:89` already requires `/getDoc\(/`, so adding one passes; `:101` forbids `setDoc/updateDoc/addDoc`.

### §4.5 — `getMarketState()` — **STATES CONFIRMED / NO INJECTABLE `now`**

**The spec's anchor points at the wrong file.** `marketSchedule.js:180-213` resolves to `api/_utils/marketSchedule.js` — the **server** copy. In `src/utils/marketSchedule.js`, the copy a Dashboard component must use, `getMarketState()` is at **`:135-169`**. The two files are divergent, not re-exports: `api/` is self-contained with 2026+2027 holidays; `src/` imports a **2026-only** list from `src/utils/marketHolidays.js`.

State vocabulary is **exactly as expected** — `OPEN` / `PRE_MARKET` / `CLOSED_AFTERHOURS` / `CLOSED_WEEKEND` / `CLOSED_HOLIDAY`, five literals, no extras, identical in both copies.

**The blocker:** `src/utils/marketSchedule.js:135` `export function getMarketState() {` is **zero-arity**, and its clock source `getETDate()` (`:76-78`) is non-exported and hard-calls `new Date()`. **None of the ten exports takes an injectable `now`.** → STOP-3.

Also: no exported next-close helper in `src/` (`getNextMarketClose` exists only at `api/_utils/marketSchedule.js:258`); **zero test coverage** for `src/utils/marketSchedule.js`; and `src/` holiday/early-close data **expires at end of 2026** (`:12` carries an overdue "update for 2027 by December 2026" TODO). Today is 2026-08-31 — that is live within four months, and it is outside this task (reporting per BUILD_RULES §3, not fixing).

### §4.6 — rename blast radius — **NO STOP; `PvpCommandCenter` is dead**

**`PvpCommandCenter.jsx` has no import and no render site anywhere in the repo.** The only references are its own file (`:1`, `:292`, `:294`) and one comment in `PvpWatchlistSection.jsx:11`. The barrel is safe too — `src/components/Dashboard/index.js:20` re-exports `PvpWatchlistSection`, never `PvpCommandCenter`. **Deletion is clean.**

Tab identity confirmed at the spec's exact anchors:

```
src/screens/AgentBattleScreen.jsx:77  const TAB_KEYS = ['matchups', 'command', 'gametape'];
src/screens/AgentBattleScreen.jsx:78  const TAB_LABELS = { matchups: 'Matchups', command: 'Command Center', gametape: 'Game Tape' };
```

Note these are **two disjoint constants**, not one array of objects. The key `'command'` is **not persisted** — no localStorage, no Firestore, no analytics, and the app has **no router at all** (no react-router dependency; navigation is pure React state). The spec's decision to leave the key unchanged is well-founded.

**The framework's blast-radius numbers are wrong on scale.** Real `src`+`api` count is **40 lines / 41 occurrences / 19 files**, not 115 / 41. The "41 files" figure looks like a transposition of the occurrence count. The three zeros (**0 persisted, 0 analytics, 0 routes**) are **correct**. "5 user-visible strings" is right only if you pre-exclude `PvpCommandCenter.jsx:504` as dead — which is circular, since deadness was what the check had to establish; there are 6 rendered strings, 5 in live components.

**The framework's greps undercount by 21 lines** — they miss hyphenated `Command-Center` and, critically, the camelCase module `commandCenterLiveBattles` (lowercase leading `c`, so `CommandCenter` never matches it), which is a real module with a real import graph (`App.jsx:121`, `CommandDashboard.jsx:49`, `CommandDashboardDesktop.jsx:42`, `ManageStation.jsx:16`). Not a Pass 1 problem — Phase E scope is the tab label only — but any future full rename built on that grep would silently skip these.

---

## Supplementary checks (read-only; A0 needs these anchors)

### P-5 — `BREAKTHROUGH_MAP` — confirmed, **but not a pure deletion**

`LiveActivityPanel.jsx:42-48` confirmed verbatim, 5 keys. Only `gameplan_meeting` has a live writer (`api/cron/agent-evaluate.js:1851`); the other four are NOT FOUND as written action/type values anywhere in `src/` or `api/`.

**Removal blocker:** `LiveActivityPanel.jsx:179` `const cfg = BREAKTHROUGH_MAP[alert.key] || BREAKTHROUGH_MAP.risk_alert;` — deleting `risk_alert` makes `cfg` undefined for any unmapped key and the next reads (`:193 cfg.color`, `:202 cfg.Icon`) throw. **P-5 must rewrite `:179` as well.** → STOP-5.

Two more: the dead vocabulary is **not confined to this file** — `src/components/Agent/AgentActivityFeed.jsx:67-68` lists all four dead types with switch cases at `:115-121`, and `api/_utils/agentReflectionUtils.js:203` filters on three never-written values. Removing four map keys does not remove the dead vocabulary from the repo. Reporting only, per BUILD_RULES §3 — not fixing outside scope. And the file has **no test**, so the removal has no safety net.

### Flag mechanics — three edits confirmed

`COMMAND_CENTER_SYNC_ENABLED` exists **only in the spec**, nowhere in code. Idiom: `export const NAME_ENABLED = false;` at column 0 with a trailing semicolon (`flagPinGuard.test.js:120`'s regex requires exactly that), preceded by a JSDoc block and a `// Pinned by: <suite>` line. `DARK_BY_DESIGN` is an **object map** with a runway note (`flagPinGuard.test.js:58-110`), not a Set — `BUILD_RULES.md:51` calls it a "set" in prose, which is wrong about the structure.

There is **no canonical pin file** — half the dark flags are pinned in small dedicated `src/config/*Flags.test.js` suites, half inside the feature's own behaviour suite. Both precedented; I'd use a dedicated one to avoid `leagueBattleviewFlags.test.js:13-17`'s warning about coupling an unrelated flag's future flip to your suite.

**Hermetic-mock hazard is concrete:** 15 of 56 `featureFlags` `vi.mock` sites use a bare factory with no `importOriginal` spread, so a module-scope read in a module they transitively import resolves to `undefined`. Mitigation: read the flag at **render scope**, not module scope. Currently nil risk for the two shells (no test imports either as a module), but it goes live the moment a shared new module (the adapter) reads it at module scope.

### Dashboard / tokens / tests — **three spec premises are false**

- **React Testing Library is NOT installed.** Zero occurrences in `package.json` or anywhere. The repo's universal component-test idiom is `renderToString` from `react-dom/server` + `expect(html).toContain(...)`. A Phase D test written against RTL will not run.
- **There is no `__fixtures__` directory under `src/`.** All three live under `api/`. Spec §9's `src/components/Dashboard/desk/__fixtures__/deskCopy.js` invents a convention for `src/`.
- **`toMatchSnapshot`/`toMatchInlineSnapshot` are used nowhere**; no `.snap` files. The repo's actual "byte-identical" idiom is `expect(renderA).toBe(renderB)` on two `renderToString` outputs (`AgentRecordSheet.render.test.jsx:74`). Spec §9/§12's "flag-off snapshot byte-identical" is achievable — just not via snapshots.
- **Tokens:** the Dashboard is **not** on `--ft-*`. `CommandDashboardDesktop.jsx` has zero `cssVar`/`readToken` calls; everything is the legacy `CMD` object of raw hex from `commandUI.jsx:16-33`. But `CommandDashboardDesktop.jsx` **is** guarded by `tokens.guard.test.js` with a **hard-zero baseline** (`:52-57`, `:246-248`) — Phase B/C must introduce **no** core-palette hex literal there; it must go through `CMD.*`. It is **not** guarded by `motion.guard.test.js`.
- Neither `src/adapters/` nor `src/components/Dashboard/desk/` exists yet — both are new trees.

---

## STOP conditions — your ruling needed

**STOP-1 · P-4 is blocked, and it collides with spec §2.**
The doc carries no owner field, so the owner-scoped rule would deny all reads. Making it possible needs a `voiceLayerCache` write — which spec §2:20 forbids in this pass ("No writes to `agentBattles`, `agents`, `voiceLayerCache`… this pass **reads only**") while spec §3:31 anticipates exactly it ("if it does not, the cron adds it, and the rule lands after a backfill"). **The spec contradicts itself here**, and Phase 0 turned the dormant branch live. It also needs a backfill with no in-repo precedent, and it **breaks an existing deliberate positive control**: `test/rules/wireDenials.rules.mjs:66/108/116` seeds `voiceLayerCache/battle-1` with no `ownerId` and asserts an authed non-owner **can** read it (an F2-4 guard against a vacuously-denying ruleset). Spec §12's acceptance is in flat conflict with that test. Options as I see them: (a) authorise the cron write + backfill + amend that control, deferring the rule to a follow-up; (b) defer P-4 wholesale and build Pass 1 without it; (c) scope the rule differently (e.g. via `agentId`). **I have not chosen.**

**STOP-2 · P-6 has two independent blockers.**
(i) **Fence.** The only selector is the fenced `findActiveAgentBattles` (`BUILD_RULES.md:19`). Changing it in place is fence contact → spec §5 rule 2 says STOP. Adding a *second* query inside the non-fenced `agent-batch-review.js` avoids the fence, but the spec does not say so and I will not improvise it. (ii) **Index.** No composite index serves `status=='completed' + completedAt>=X`; that is a schema deploy the spec never budgets. Related: `pendingReflection` is not available as the hook (§4.3), and the cron budget is **39/40**, not the 37 `BUILD_RULES.md:76` claims.

**STOP-3 · Phase A's acceptance matrix is untestable at the stated signature.**
Spec §6 fixes the adapter as `(battle, voiceLayerCacheDoc, agent, now)` — no market-state parameter — while §6:83 demands "injectable `now` throughout" plus weekend/holiday/early-close fixtures. Phase must come from the zero-arity `getMarketState()`. Either the signature gains a `marketState` (or a `getMarketState` injection), or the tests must `vi.mock` the module — for which `src/` has zero precedent. **This is a one-line spec decision, but it is yours.** My lean: pass `marketState` in as a fifth argument and keep the adapter pure — it also matches the framework's §3.2 "phase: derived" row.

**STOP-4 · Phase C cannot import what §8.5 tells it to import.**
`LiveActivityPanel.jsx:520` `export default LiveActivityPanel;` is the file's **only** export. `BreakthroughAlerts` (`:310`), `BreakthroughAlertCard` (`:178`) and `useBreakthroughAlerts` (`:257`) are module-private. §8.5's "it is portable; import, don't fork" is false at HEAD. Either P-5's commit also adds a named export (a small scope expansion to a file it already edits — my lean), or Phase C forks the visual, which §8.5 forbids by name.

**STOP-5 · P-5 is not a four-line deletion.** `LiveActivityPanel.jsx:179` hard-codes `risk_alert` as the fallback config. The removal must rewrite that line or the alert card throws.

**STOP-6 · The staleness rule would blank the dormant Desk — a product decision.**
Spec §8 degrades to `Proximity updating…` when the cache doc is >30 min old. Actual cron windows: `voice-layer-cache` = `*/15 13-20 * * 1-5` vs `agent-evaluate` = `*/15 13-21 * * 1-5`. **The cache writer stops an hour before the eval window and never runs on weekends** — so from ~20:45 UTC Friday to 13:00 UTC Monday the doc is hours-to-days stale by construction. In EST its last tick is 15:45 ET, fifteen minutes *before* the close. **LIVE_CLOSED and POST_CLOSE would therefore show only a posture line and a feed line, always.** §7's "Desk, dormant" would be nearly empty every evening, every weekend, every holiday. Relax the rule for closed phases, or accept the empty dormant Desk — not mine to pick.

**Not a STOP, flagged per spec §3:36 · P-2 is not merged.** `api/_utils/voiceLayerPrompt.js:41` still reads `"expiry": "end_of_battle" or "3_games" or "permanent"`. The spec says flag and continue; flagging.

---

## Conflicts between framework, spec, and code — reported, not resolved

Per your instruction and the spec's closing line, I am reporting these rather than resolving them.

| # | Conflict | Evidence |
|---|---|---|
| C-1 | **Spec-internal.** §2:20 forbids `voiceLayerCache` writes; §3:31 (P-4) requires one. | STOP-1 |
| C-2 | **Framework vs code.** Framework `:126` says "`chat.js:125` already composes these two" (status × market state). It does not. Framework §3.2 `:101` leans on the same claim as precedent. | `chat.js:125-133`, `:216` |
| C-3 | **Spec vs code.** §6:81 makes the PRE_OPEN marker "first `statusFeed` eval entry." **There is no eval-sourced statusFeed entry** — the eight `source:` values in `agent-evaluate.js` are `proposal_system, guardrail, gameplan_meeting, haiku, risk_manager, tournament_ledger, system, archetype`, and a quiet HOLD tick writes no entry at all. Framework `:130` says only "no eval has run yet" — the spec narrowed it to a marker that does not exist. **Honest substitute: `scoreState.evaluationCount` (`agent-evaluate.js:2723`) or `scoreState.lastScoredAt` (`:881`), both written every cycle and already carried by the poll.** |
| C-4 | **Spec vs code.** §6 signature vs §6:83 injectable-`now`. | STOP-3 |
| C-5 | **Spec vs code.** §8.5 "import, don't fork." | STOP-4 |
| C-6 | **Framework + spec vs code.** `benchLocked` is presented as a shipped field (framework §3.2 `:111`; spec §6 `loadout.benchLocked`). It is a **local derivation in two components** — `desktop/EquipBench.jsx:88` and `EquipStation.jsx:110`, both `Boolean(agent?.activeBattleId)`. The adapter must derive it. |
| C-7 | **Framework D-19 vs code.** "If unconsumed, it is the natural debrief hook" — it is consumed and drained. | §4.3 |
| C-8 | **Spec §12 acceptance vs an existing test.** P-4's emulator assertion contradicts `wireDenials.rules.mjs:116`. | STOP-1 |

**Adapter fields with no source in the declared inputs** (spec §6), which I'd want settled before Phase A:
- `pnlPct` — needs a live price the pure adapter never receives. Entry price is `portfolio.startingPrices` (`agentBattleService.js:164`); the cache's `changePercent` is the feed's *daily* change, not P&L from entry.
- `heldSince` — the only held-since-shaped field is a per-position `swappedInAt`, **absent on positions never swapped**. Needs a documented fallback (`battle.activatedAt`).
- `lastCheckedAt` — §8's "latest eval-sourced statusFeed timestamp" is the weak signal (C-3). `scoreState.lastScoredAt` is the honest one.
- The cache's freshness field is a **Firestore Timestamp** (`voice-layer-cache.js:816`), while every other timestamp the adapter touches is an ISO string. A pure adapter must normalize the union; precedent at `chat.js:115-119`.

---

## Deviations

**D-1 · Branch name.** You asked for `claude/cc-sync-pass1`. This session's harness designates `claude/cc-sync-pass1-5lz5sb` and forbids pushing elsewhere. I am on the designated branch, cut from `fa6dfed7`, one branch for all phases per spec §11 and BUILD_RULES §2. Say the word and I'll get permission for the un-suffixed name.

**D-2 · Docs committed before the STOP.** The two relay files are committed (`9026d4d5`) and pushed, since you asked for the copy in the session-start sequence. Docs only — no code, no behaviour change.

**D-3 · `npm ci` was run.** `node_modules` was absent, so the suite could not run at all. It is gitignored (`.gitignore:10`) and not project state per BUILD_RULES §3. This is what let me give you the green baseline above.

**D-4 · Three supplementary read-only checks** beyond spec §4 (P-5 writers, flag mechanics, Dashboard/token/test idioms). A0 needs those anchors, and they surfaced STOP-4, STOP-5 and the three false test premises. All read-only.

---

## What I have NOT done

No build phase started. No branch beyond the designated one. No code file touched. No fenced file read beyond what §1 permits (reading is permitted; nothing edited). No PR opened, no CI watched.

**Awaiting your go, plus rulings on STOP-1 through STOP-6.**
