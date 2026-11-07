# Phase 0: The armory and per-game loadouts. Read-only discovery

**Run date:** November 2, 2026 · **Model:** Claude Fable 5.1 (the prompt named Opus; this is the model that ran) · **Branch:** `claude/phase0-armory`, cut from `main` @ `40641486` (the merge of PR #1019), pushed by refspec from the worktree branch `claude/phase0-armory-discovery-d18751` · **Ends:** this report, in one commit, no PR.

**Preamble.** `git fetch origin` ran first; `origin/main` = `40641486` = HEAD = the branch base. The tree was clean at the start and no application code changed. Fenced files read, never edited: `api/agent/decide.js` (`:185`, `:370-396`, `:770-800`, `:930-1000`, `:1535-1580`), `api/_utils/agentBattleService.js` (`:60-120`, `:185-245`, `:290-310`), `api/_utils/agentPromptAssembly.js` (`:74-96`, `:175`), `api/_utils/agentEvalPromptAssembly.js` (`:83-85`, `:358-363`, `:750-776`). `api/_utils/agentArchetypeConfig.js` was not opened; its `VALID_ARCHETYPES` export is named here only as the list `trainingLoadoutSpec.js:27` imports. `api/_utils/agentGuardrails.js:134` was seen in a search hit only. Fenced functions called: none. Fenced files edited: none. For Q7 a helper built a scratch copy of this commit in a WSL worktree with an untracked harness page; nothing from it is committed (§7.5).

**Markers.** **V** = I read the line in this session. **V·h** = a helper read or measured it in this session and I did not re-read it. **ASSUMED** = stated, not read. Design-file lines cite the committed copies `docs/design/agent-identity-v2/*.txt`.

---

## Executive summary

**Plain words.** Today a player has one loadout: the archetype and the watchlist written on their one agent record. Every game copies from it. A casual BaggerBomb game runs on a copy of the agent (the "casual clone") that is refreshed from the record just before each deploy; a training pod runs on another copy, and that copy is the only place a player can already choose a different archetype and watchlist for one game. A League week reads the agent record itself every morning. So the pieces D1 needs mostly exist: the copies are the per-game slots, and the battle already freezes its archetype. What is missing is a place to write a different choice for each game, a home for each archetype's memory, and the armory itself. The hardest open question is not technical: it is whether a League loadout is frozen for the week or may change overnight, because today it can change overnight by accident.

| # | Question | Verdict |
|---|---|---|
| 1 | What a loadout is today | **One record, three identities.** The ranked agent document holds the archetype, the watchlist pointer, the Forge strategy, the traits and the Character settings. The casual clone copies all of it at every deploy; the training clone copies it once and may override archetype and watchlist (the one per-game loadout that exists); League ranked reads the record itself. The Phase 2 "per-battle loadout selection" of the August design lock was never built. **D3 confirmed:** under D1 training reads the League loadout (§1.4). |
| 2 | Live reads versus the snapshot | **The battle machinery is already snapshot-correct.** The evaluator, prompt assembly, guardrails, learning receipts, tape, Film Room and League arena read `agentContext.archetype`. Four things assume the live field: the plays ledger's shelving and card filing, the mobile adapter's read order, League board production, and every hub surface. The chat and voice read the battle's own agent document, which for a casual game is the clone, so they are right by identity (§2). The refusal exists for the directive gate; relaxed, it would break the ledger and the hub's lock line first (§2.3). |
| 3 | Concurrency | **A BaggerBomb and a League game already run on the same day.** The lock is per agent id, and the clone is another id. The Deploy card blocks only on a live BaggerBomb. Per-agent state that assumes one archetype: the memory window, the wisdom paragraph and its cycle counter, the lessons, the stats, the plays ledger's "current archetype", one Forge strategy, one trait set (§3). |
| 4 | Memory per archetype | **Nothing is keyed by archetype except the plays ledger's entries.** A per-archetype save can be a subcollection on the ranked agent, and the fence stays untouched if the save is written onto the deploying document before `decide` runs: the casual clone's resync is that seam already; League needs the "shelve on switch" write the 10 Oct ruling named (§4). |
| 5 | Growth inventory | **No XP, level or mastery track that is live and per archetype.** `agent.stats` is BaggerBomb-vs-CPU only and has no archetype. Per-archetype counts, record and first/last played are computable from `agentBattles` on an index that exists. The hub copy guard bans growth words and literal digits; a count passed as an argument passes its mechanics, so "12 battles as the Contrarian" needs a ruling against the spec's clause, not a guard rewrite (§5). |
| 6 | Surfaces that change | Two picker mounts live (the hub sheet and the training lobby's chooser, twice), two in the fallback shells, none in onboarding. The hub hero wears the ranked record's field; four signals exist to choose a game in focus (§6). |
| 7 | The armory from board 6 | The engine has the swap, many views on one renderer, the still, the unlit palette and the brainless set; the wrapper exposes neither of the last two. Not built: the seam flash, the ring burst, the 70 % idle sets, the hook return. The phone armory fits in the hero's box at 150–160 px with six 44–48 px sets on a ring (§7). Cost: §7.5. |
| 8 | The book slot | A reference to a `watchlists/{id}` document, with an optional pinned idea version, never the names. A Shadow-built list is another document in the same collection (§8). |
| 9 | Staging | A1 (UI only) and A4's read (counts) can run side by side; A2 before A3; A3 is the only stage that must touch the memory writers, and none of the four needs a fenced edit if the seams in §4 are used (§9). |

---

## 1. What a loadout is today

### 1.1 The fields, their writers and their readers at deploy

`agentLoadout` at `App.jsx:10203` (**V**) is a four-field projection of `primaryAgent`: `{ name, archetype, equippedWatchlistId, equippedWatchlistName }`, handed to `LeagueScreen` for the training chooser's prefill (`LeagueLobbyRedesign.jsx:482-484`, `LeagueDeskParts.jsx:603-605`, **V**) and for the lobby preview's own figure (`youArchetype`, `LeagueDeskParts.jsx:562`, `LeagueLobbyRedesign.jsx:425`, **V**). It is a view, not a record. The record is `agents/{agentId}`.

| Field on the agent document | Written by | Read at deploy | Frozen on the battle as |
|---|---|---|---|
| `archetype` | `api/agent/change-archetype.js:253-257` (with `equippedTraits`, one transaction, header `:3-11`, **V**); onboarding derives it from three answers (`AgentCreationFlow.jsx:331-334`, `create-profile.js:19-22`, **V**) | `decide.js:370-372` ranks the universe by it (fenced, read, **V**); `createAgentBattle` stamps it (`agentBattleService.js:193`, **V**) | `agentContext.archetype` |
| `equippedWatchlistId`, `equippedWatchlistName`, `equippedAt` | `api/agent/equip-watchlist.js:100-121` (lock `:89`), `unequip-watchlist.js` (**V**) | `decide.js:381-396` resolves and snapshots `{ watchlistId, name, tickers }` (**V**); the idea rides as a sibling (`agentBattleService.js:217-231`, **V**) | `agentContext.equippedWatchlist`, `agentContext.equippedHypothesis` |
| `deployedStrategy` | `api/agent/update-agent-settings.js:85-91`, called by `deployStrategyService.js` (header `:1-22`, **V**); `equippedBundleIds` / `activeRules` by the equip-bundle path | `createAgentBattle` snapshots `deployedStrategy.guardrails` (`:198-202`), `activeRules` (`:196`), `equippedBundleIds` (`:197`, **V**) | `agentContext.deployedGuardrails`, `activeRules`, `equippedBundleIds` |
| `equippedTraits` + the `rules` subcollection | `change-archetype.js` (the born-with set) and `update-agent-settings.js:66` (**V**) | projected into `activeRules` at deploy (`trainingClone.js:163-166` says so, **V**) | inside `activeRules` |
| `standingLeans`, `dials`, `settingsRev` (the Character settings) | `equip-lean.js`, `set-tempo-dial.js`, `update-agent-settings.js` (**V**, headers) | `buildCustomizationSnapshot` (`agentBattleService.js:240`, **V**) | the customization snapshot |
| `consolidatedInsight`, `memory[]`, `evolutionCycle`, `lessons[]` (the brain) | `reflect.js:518-541`, `agentConsolidationApply.js:291-295` (**V**) | `consolidatedInsight` is snapshotted (`agentBattleService.js:242`, **V**); the memory window reaches the draft prompt (`agentPromptAssembly.js:94-96`, fenced, read, **V**) | `agentContext.consolidatedInsight` |
| `config`, `personality`, `name`, colours | onboarding | `agentContext.agentName`, `riskTolerance` (`:192`, `:243`, **V**) | — |

Client writes to an agent document are limited to `directives`, `lastViewedEvolutionCycle`, `starterKitCompleted` and `updatedAt` (`firestore.rules:332-335`, **V**). Every loadout field is server-written. A per-game loadout record would be too.

### 1.2 Three identities carry the one loadout

| Identity | Document | How it gets the loadout | Can it differ from the ranked record? |
|---|---|---|---|
| **Ranked agent** | `agents/{id}` | It is the loadout | — |
| **Casual clone** (every Command Center BaggerBomb deploy) | `agents/casual-agent-{uid}`, one per player (`casualClone.js:5-9`, **V**) | `INHERITED_LOADOUT_FIELDS` copied at creation (`:57-60`) and **re-synced from the parent at every deploy** when the clone is not mid-battle (`:180-213`; GUARD 1 `:205`; the update `:212`, **V**). The client calls `ensure-casual-clone` before `decide` (`ensure-casual-clone.js:3-8`, **V**) | **No.** "PURE inherit — no loadout override in Phase 1; the per-battle loadout SELECTION surface is Phase 2" (`casualClone.js:50-52`, **V**). Phase 2 was never built: the design lock it names, `20260805_PER_BATTLE_LOADOUT_CONCURRENCY_DESIGN_LOCK_V1`, is not in `docs/`; the only citation is `docs/audits/20260806_CASUAL_CLONE_PHASE1_CODE_REVIEW.md:3` (**V**) |
| **Training clone** (one per pod) | `agents/training-agent-{groupId}-{uid}` (`trainingClone.js:14-16`, **V**) | The same field list at provisioning (`:134-139`), then a Tier-1 override of `archetype` and `equippedWatchlistId` from the chooser (`:140-142`; the whitelist `trainingLoadoutSpec.js:9`, `:30`; the route `lobby-quickplay-training.js:72-95`, **V**). An override archetype seeds that archetype's born-with traits (`trainingClone.js:297-299`, **V**) | **Yes.** This is the one per-game loadout in the app today |

The inherited list (`trainingClone.js:59-99`, **V**) is the whole brain: archetype, config, personality, colours, `equippedTraits`, `activeRules`, `equippedBundleIds`, the watchlist trio, `deployedStrategy`, `consolidatedInsight`, `disciplines`, `evolutionCycle`, `starterKitCompleted`, `name`, `standingLeans`, `standingLeansInvalidated`, `dials`, `settingsRev`. The resync also copies `memory` (`casualClone.js:97`, **V**). History and pointers are fresh per clone (`:67-75`).

### 1.3 The League path

- **Registration** (`lobby-create.js`, `lobby-join.js`, `lobby-quickplay.js`) reads nothing from the agent (a search for `agent` or `archetype` in the three routes finds no line at all, **V**). Only `lobby-quickplay-training.js` takes a loadout (§1.2).
- **Monday board production** resolves each human seat to the **live ranked document** by owner, excluding clones (`tournamentAgentBoards.js:307-345`; the exclusion `:337`, **V**), ranks the universe by `agent.archetype` (`:465-470`) and reads `agent.equippedWatchlistId` (`:473-490`). The board document records the archetype it was ranked under (`buildAgentBoardDoc`, `:270-278`, **V**): **the one per-pod loadout fact League stores**. The draft takes the six from that board (S2 report §2, **V·h**).
- **The daily deploy** (Tue–Fri, and every day for training): `fanOutDeploys` posts the prescribed six to `/api/agent/decide` per seat (`tournamentOrchestrator.js:312-330`, `:406-470`, **V**), by the agent id the latest battle carries (`buildIncumbentSeats`, `:797-825`, **V**). `decide.js` reads the agent document again and `createAgentBattle` stamps **today's** `archetype` (`decide.js:1554`, `agentBattleService.js:193`, **V**), with `equippedWatchlist: null` (`decide.js:1562`, **V**).
- **Training** mounts the same arena and the same clone machinery (`activateTrainingPod`, `:860`; header `:834-850`, **V**).
- **The "nightly management window."** No League surface in code manages the agent loadout (a search of the League components and screens for "management" or "window" finds only the user layer's `ClaimFlipWindow`, `LeagueParticipantView.jsx:22`, **V**). What exists is a gap: completion clears `activeBattleId` on the agent when the pointer still names that battle (`agent-evaluate.js:7226-7232`, **V**), the morning fan-out runs in the orchestrator's 11:00–14:00 UTC ticks (`tournament-orchestrator.js:10-13`, `vercel.json:189`, **V**), and `change-archetype` succeeds whenever the pointer is null (`:145`). So a change between the evening completion and the morning deploy puts a **new archetype on Tuesday's battle under Monday's board and draft** (the chain is **V**; that a player has done it is **ASSUMED**). Under D1 this is either the League's nightly window, by design, or the defect A2 closes. Founder decision FD-3.

### 1.4 Is there a per-game loadout today?

Not one global loadout, and not per game either: **one global source** (the ranked record) with two copies. The training copy may diverge for one pod (Tier 1). The casual copy mirrors the source at every deploy. League ranked has no copy. D1 therefore changes the *source* of each copy, not the copying.

**D3, confirmed.** Today training reads a copy of the ranked loadout plus an optional Tier-1 override from the lobby's chooser (`trainingClone.js:134-142`, `trainingLoadoutSpec.js:9`). Under D1 it reads the League loadout, and the chooser with its two mounts goes (§6, §9 A2). What that gives up: a player who wants to try an archetype in training first changes the League loadout; under a week lock (FD-3) that is possible only between weeks.

---

## 2. Live reads versus the snapshot

### 2.1 Readers, by file

"Snapshot" = `battle.agentContext.archetype`. "Live" = the agent document's `archetype`. The third column says what happens under D1 when a battle's archetype differs from the ranked record's.

| File | Reads | Under a per-game archetype |
|---|---|---|
| `api/cron/agent-evaluate.js:1575-1583` (the hot-bench refresh, `buildArchetypeCandidateMenu`), `:5453`, `:5716`, `:6489`, `:6580` | snapshot (`ctx.archetype`) | **Correct.** The menu is built for "the frozen archetype's candidate preferences" (`:1575`, **V**) |
| `api/_utils/agentEvalPromptAssembly.js:83-85`, `:750-753`, `:774-776` (fenced, read) | snapshot (`archetypeKey`; `ctx.consolidatedInsight`) | **Correct.** The paragraph comes from the battle's snapshot (`agentBattleService.js:242`) |
| `api/_utils/agentGuardrails.js:134` (fenced, seen in search) | snapshot | Correct (**V** for the doc line only) |
| `api/_utils/directiveIdentity.js:51` | snapshot first, live fallback | Correct; the resolver pattern A2 should reuse (`:11-19`, `:28`, **V**) |
| `api/_utils/agentReflectionUtils.js:203-204` | snapshot first | Correct |
| `api/_utils/learning/captureReceipt.js:284-287`, `learningSchemas.js:33`, `:114` | snapshot | Correct: receipts carry the battle's archetype |
| `api/_utils/filmTape/tapeAssemble.js:1441`, `tapeTags.js:200`; `src/screens/filmRoomV2/FilmRoomScreenV2.jsx:119` | snapshot | Correct |
| `api/_utils/masterySettlement.js:309`, `:474` | snapshot | Correct (and dark) |
| `api/cron/voice-layer-cache.js:960`, `voiceLayerAnticipation.js:146`, `openerTemplateFloor.js:61` | snapshot | Correct |
| `src/components/AgentPresence/useAgentPresence.js:43`, `screens/battleView/BattleAgentForm.jsx:44`, `CharacterPane.jsx:256-257` | snapshot first | Correct (R22) |
| `League/battleArena/buildArenaModel.js:176-178`, `finishedRivalRead.js:22`, `leagueAdapter.js:237`, `LeagueAgentForm.jsx:42` | snapshot; the lobby preview falls back to `youArchetype` = the ranked field | Correct in a game; **the lobby preview wears the ranked field**, which under D1 should be the League loadout |
| `api/agent/chat.js:516`, `:832`, `:926`, `:1012`; `debate.js:216`, `:252`; `voiceLayerPrompt.js:2908`, `:2969`, `:3029`, `:3203-3209`, `:3491-3496`, `:3758`, `:3984`; `reflect.js:257` | **live, on the battle's own agent document** (`agents/{battle.agentId}`; chat verifies the agent belongs to the battle, `:475`) | **Correct by identity for a casual game**: the battle's agent is the clone, which was not resynced mid-battle (GUARD 1). For a League game the document is the ranked record, which is what the battle was stamped from that morning. The chip menu is "the SERVER-DERIVED archetype's menu" (`chat.js:926`) |
| `api/_utils/filmRoom/cardStore.js:149`, `:216`, `:240-245` | **live, on the attribution agent** (the ranked parent for a casual clone, `:39-45`) | **Wrong.** A card from a day taped as the Contrarian while the ranked record says Trend Follower is refused `409 archetype_changed` (`:240-245`, **V**), and shelving (`:149`) compares against one "current" archetype that D1 no longer has |
| `src/adapters/baggerbombAdapter.js:594` | `agent?.archetype ?? battle?.agentContext?.archetype` | **Wrong order**: the live field wins when both are present. One-line reversal |
| `api/_utils/tournamentAgentBoards.js:465`, `:153-156` | live ranked document, before any battle exists | **Needs the League loadout**: the board and the draft must be ranked under the archetype the week's battles will wear |
| `api/agent/decide.js:370` (fenced, read) | live, at deploy | Correct if the deploying document already carries the game's archetype (the clone seam, §9 A2); otherwise fence contact |
| `api/_utils/agentPromptAssembly.js:74-75`, `:175` (fenced, read) | live, at deploy (the draft prompt) | As above |
| `equip-lean.js`, `set-rule-hardness.js`, `leanRevalidation.js:5-21`, `compileOnSettingsChange.js`, `resolvedAgentManifest.js`, `deployBuildValidation.js` | live, at settings time | Forge-time validation against one archetype; under D1 the settings belong to whichever loadout is being edited (§6.4) |
| Hub: `hub/useHubRuntime.js:107`, `HubAgentForm.jsx:53`, `hub/activityRows.js`; `Dashboard/AgentRecordSheet.jsx:186`, `:212`; the Forge (`ForgeOverview.jsx:253-276`, `CharacterArea.jsx`, `TraitsArea.jsx`, `StarterKit.jsx`); the fallback shells (`EquipStation.jsx`, `EquipBench.jsx`, `IdentityPanel.jsx`, `DeployCard.jsx`, `DeployStation.jsx`, `DeployCeremony.jsx`, `ScoutingBoardSheet.jsx`) | live | **Every hub and Forge surface shows the ranked record.** Under D1 each must say which loadout it shows (§6) |

Counted, not read line by line: 107 live-field lines in 56 files outside tests (a search, **V** for the count). The rows above cover every file that runs during or before a battle; the rest are UI.

### 2.2 What the snapshot already gives D1

Freezing is built. Every evaluator, prompt, guardrail, learning and review reader takes the battle's own archetype, and the design made the casual game run on a separate identity whose brain is never re-pointed mid-battle. The gaps are the ledger (§2.1), the mobile adapter's read order, League board production, and the hub.

### 2.3 The refusal at `change-archetype.js:138-145`

**Why it exists.** The tripwire comment (`:138-144`, **V**) and the integrity plan (`docs/audits/20260625_ARCHETYPE_INTEGRITY_BUILD_PLAN_V2.md:21`, `:76-77`, `:144`, **V**): the directive gate relied on `agent.archetype === battle.agentContext.archetype` throughout a battle, so a live `battle.directive` minted under the prior archetype would never be stale. The lock made that invariant hold without clearing or revalidating the directive (CF-1, "lean"). It also keeps the archetype ↔ born-with-traits invariant atomic (`:3-11`), and it mirrors the watchlist and bundle locks (`equip-watchlist.js:89`, `equip-bundle.js:127`, `equip-lean.js:133`, `set-tempo-dial.js:104`, **V**).

**What it does today, exactly.** It checks the **ranked** document's pointer. A casual battle sets the **clone's** pointer (`decide.js:991` on the clone's `agentRef`), so during a casual game the ranked archetype can already change (**V** by the two lines). The hub agrees: with the concurrency flag on, its lock line is `Boolean(agent.activeBattleId)` of the ranked document (`commandCenterLiveBattles.js:166`, `selectors/loadout.js:136`, **V**). The running game keeps its archetype because the clone is not resynced mid-battle. So the refusal already means "the ranked identity is in a League (or legacy) battle", not "any game is running".

**What would break if it were relaxed with no replacement.** The directive gate is now resolved snapshot-first (`directiveIdentity.js:51`), so CF-1's hole is closed by the resolver, not the lock. What still depends on the lock: the chat and voice identity of a **League** battle (they read the ranked document mid-battle, §2.1); the ledger's shelving and filing (§2.1); the Film Room card route's `archetype_changed` refusal; the trait seeding that rides the change (a mid-week trait swap changes the next morning's `activeRules`); the hub's "Locked in battle" line (`hubCopy.js:200`); and the sibling locks' assumption that one pointer means one game.

**What D1 needs instead.** (a) The archetype chosen on the way into a game and frozen on the battle: already true at `agentBattleService.js:193`. (b) The lock moves from "the agent has an active battle" to "**this loadout** is in a live game": the BaggerBomb loadout is locked while the casual clone has a battle; the League loadout while the player's group is in BATTLE (or for the registered week, FD-3). (c) The ranked record's field becomes the default a game without its own choice wears. (d) The ledger compares an entry with the **battle's** archetype, never "the agent's current one". (e) The hub's lock line and the Loadout cards say which loadout is locked.

---

## 3. Concurrency

### 3.1 Today

A casual BaggerBomb and a League pod (ranked or training) **can run on the same day**. The one-active-battle check is per agent id (`decide.js:774-800` for the tiered path, `:1473-1478` for the tournament path, **V**; `casualClone.js:10-12` says it in words, **V**), and each identity has its own `activeBattleId` (`decide.js:991`, `:1578`). "One at a time" per type is enforced on the client by the Deploy card: `deriveHubDeployState` (`hub/selectors/deployState.js:9-29`, **V**) takes the owner's live battles with training clones dropped and casual-clone games kept (`:74-80`), and `deriveDeployGate` blocks a deploy only on a live BaggerBomb when `CASUAL_CLONE_CONCURRENCY_ENABLED` is on (`commandCenterLiveBattles.js:152-166`; the flag `featureFlags.js:237` = `true`, **V**). The words: "A BaggerBomb battle is already running — one at a time." (`:136`) and the hub's `blockedBehindGame` (`hubCopy.js:431-433`, **V**). Ranked and BaggerBomb are told apart by `groupId` (`commandCenterLiveBattles.js:42-60`, **V**).

### 3.2 Per-agent state that assumes one archetype

With D1, two evaluations of one player's agent may run under different archetypes on one day (one casual, one League; or a training pod beside either). Everything below lives once per agent document and has no archetype key:

| State | Where | What assumes one archetype |
|---|---|---|
| The memory window `memory[]` (five entries) | written `reflect.js:518-524`; a casual game's entry is forwarded to the **parent** (`:528-541`); entry fields `:476-503` (**V**): `gameId, gameMode, result, score, opponentScore, lesson, adjustment, hypothesisGrades, confidenceCalibration, date` — **no archetype** | The draft prompt reads the whole window (`agentPromptAssembly.js:94-96`): a Contrarian's lesson feeds the Trend Follower's next deploy |
| The wisdom paragraph `consolidatedInsight`, `evolutionCycle`, `lessons[]`, `lastConsolidatedGamesPlayed` | `agentConsolidationApply.js:284-295`; the milestone claim `reflect.js:548-560` (**V**) | One paragraph, rewritten from a mixed window every fifth game; one cycle counter |
| `stats` | `agent-evaluate.js:7237-7262`, on the record target (the parent for a casual clone, `:7254`); **tournament battles never touch it** (`:7221-7224`, **V**) | One W-L-D for all archetypes, BaggerBomb only |
| The plays ledger's "current archetype" | `cardStore.js:149`, `:216`, `:240-245` (**V**) | Shelving and filing need one current archetype |
| The hot bench | per battle, frozen at `agent-evaluate.js:1575-1583` | **None** (already per battle) |
| The Forge strategy `deployedStrategy` | one per agent (`update-agent-settings.js:85-91`); frozen per battle as guardrails | One slot: a strategy deployed for the Contrarian's game rides into the Trend Follower's too |
| `equippedTraits` + trait rule docs | archetype-bound born-with set (`change-archetype.js:3-11`; the clone seeds the override's, `trainingClone.js:297-299`) | The ranked record can hold one archetype's set; a clone may already hold another's |
| Character settings `standingLeans`, `dials` | validated against the archetype at settings time and at the battle snapshot (`leanRevalidation.js:5-21`; `change-archetype.js:186-215` resets an aggressive dial under the new archetype) | Durable desired state that an archetype switch re-validates; two live archetypes mean two validations |
| `settingsRev` and the compiled manifest | per document | Fine per identity |
| `lastDeployedAt` cooldown, `deployingAt` | per document | Fine |
| The mastery profile | per **user** per archetype (`masteryEnforcement.js:33-34`, `masterySettlement.js:530`) | **None** (already per archetype; dark) |

---

## 4. Memory per archetype (D5)

### 4.1 What the legacy route stores

Named in §3.2: `memory[]` (`reflect.js:476-503`), `consolidatedInsight` + `evolutionCycle` + `lessons[]` (`agentConsolidationApply.js:291-295`), `stats` (`agent-evaluate.js:7237-7262`). None carries or is keyed by an archetype (**V**). A casual game's memory and consolidation land on the **parent** (`reflect.js:49`, `:128-145`); a training clone's stay on the clone and are never redirected (`trainingClone.js:152-153`; the header's "NEVER touches the ranked agent", `:9-11`, **V**). The route reaches the draft prompt (`agentPromptAssembly.js:84-96`) and the evaluator through the snapshot (`agentEvalPromptAssembly.js:774-776`); the growth loop map calls this the legacy learning route and leaves its retirement open (`docs/design/20261028_GROWTH_LOOP_MAP_V1_2.md:45-47`, **V**).

### 4.2 The plays ledger

`agents/{agentId}/plays/{entryId}`: each entry carries `archetypeCodeId` (`cardStore.js:175`, **V**), filed under the attribution agent (the ranked parent for a casual game, `:39-45`), stages `card | nominated | retired` only (`:57`). Shelving is computed at read against the agent's current `archetype` (`:30-33`, `:149`); a card whose tape day was taped under another archetype than the agent's current one is refused at birth (`:240-245`). **Archetype-scoped per entry; one-archetype in its predicate.**

### 4.3 The smallest honest per-archetype save

Under D1 "shelve on switch, restore on return" (the 10 Oct ruling, `docs/design/20261010_FOUNDER_RULING_SHEET_PRACTICE_FIELD_V1_1.md:25-27`, **V**) becomes "each battle reads its archetype's save". A shape, not a build:

```
agents/{rankedAgentId}/archetypeSaves/{archetypeCodeId}
  archetypeCodeId            'contrarian'
  memory[]                   the five-entry window, the same entry shape as today
  consolidatedInsight        the paragraph, '' until written
  evolutionCycle             0..n
  lastConsolidatedGamesPlayed
  lessons[]
  stats                      { gamesPlayed, wins, losses, draws, totalScore, avgScore, currentStreak, bestStreak }   (BaggerBomb vs CPU, as today)
  equippedTraits[]           the archetype's trait set (born-with plus the player's edits), if FD-5 says traits travel
  updatedAt
```

Saves live on the **ranked** agent (the attribution target), never on a clone: a casual game's writers already resolve the parent (`reflect.js:128-145`, `agent-evaluate.js:7254`, `cardStore.js:39-45`). The plays ledger stays where it is; only its predicate changes.

**Which readers change, and the fence.**

| Reader or writer | Today | Under the save | Fenced? |
|---|---|---|---|
| The casual deploy's brain | the clone resync copies the parent's `memory`, `consolidatedInsight`, `evolutionCycle` (`casualClone.js:91-98`) | the resync copies the **save** of the game's archetype onto the clone instead | No (`casualClone.js`) |
| The draft prompt | reads `agent.memory`, `agent.consolidatedInsight`, `agent.evolutionCycle` (`agentPromptAssembly.js:84-96`) | unchanged: the clone document already holds the save's fields when `decide` reads it | **Untouched** |
| The battle snapshot | `agentData.consolidatedInsight` (`agentBattleService.js:242`) | unchanged | **Untouched** |
| The evaluator | `ctx.consolidatedInsight` from the snapshot | unchanged | **Untouched** |
| A League deploy's brain | `decide.js` reads the ranked document | the ranked document's brain fields must hold the **League archetype's** save: `change-archetype.js` (or the League loadout write) stores the outgoing archetype's `memory`/`insight`/`cycle`/`lessons`/`stats` to its save and loads the incoming one's, in the same transaction that writes `archetype` (`:253-257`). This is the ruling's shelve/restore, made real | No (`change-archetype.js`) |
| The reflection writer | `reflect.js:518-541` writes the parent's `memory` | writes `archetypeSaves/{battle.agentContext.archetype}.memory`; and, while the ranked document mirrors one save, that document's `memory` too when the archetypes match | No |
| Consolidation | `agentConsolidationApply.js:291-295` | per save; its window is the save's; the "every fifth game" counter becomes the save's `gamesPlayed` | No |
| Stats | `agent-evaluate.js:7237-7262` | the save's `stats`, plus the ranked mirror as above | No (the cron, a large non-fenced file) |
| The plays ledger | `cardStore.js:149`, `:216`, `:240-245` | compare with the **battle's** archetype (the tape day's, which the card already carries) and cap per archetype | No |
| The record sheet and the hub's history | `agent.stats` | the save's `stats` for the archetype shown, or the sum | No |

**An example.** A battle played as the Contrarian ends. `reflect.js` writes its lesson into `archetypeSaves/contrarian.memory`; `agent-evaluate.js` adds the win to `archetypeSaves/contrarian.stats`; when that save's window holds three real lessons, consolidation rewrites `archetypeSaves/contrarian.consolidatedInsight` and bumps its cycle. The next morning the player deploys as the Trend Follower: the resync copies `archetypeSaves/momentum_chaser` onto the clone, so the draft prompt's "RECENT GAME MEMORY" and "STRATEGIC WISDOM" are the Trend Follower's own, and the Contrarian's lesson is never read. Nothing is deleted; the Contrarian's save waits.

**Beta players keep every save** (ruling 5's business note: all of them in the beta; a paid tier later limits how many, `:26`). The shape needs no cap field now; a later tier reads the saves' `updatedAt` to decide which to keep.

---

## 5. The growth inventory (D4)

| Number | Where | Per archetype from existing records? |
|---|---|---|
| `agent.stats` (`gamesPlayed`, `wins`, `losses`, `draws`, `totalScore`, `avgScore`, streaks) | written `agent-evaluate.js:7237-7262`; **League battles never touch it** (`:7221-7224`); casual games land on the parent (`:7254`) (**V**) | **No**: one counter, no archetype. The caption the hub already shows is honest about it: "career · BaggerBomb vs CPU · as recorded" (`hubCopy.js:346`, **V**) |
| `evolutionCycle`, `lastConsolidatedGamesPlayed` | `agentConsolidationApply.js:284`, `reflect.js:548-560` | No |
| **Battles with `agentContext.archetype`** | `agentBattles` where `ownerId == uid` and `agentContext.archetype == a`, ordered by `createdAt`: the index exists (`firestore.indexes.json:255-272`, **V**) | **Yes**: count, first and last played per archetype. `ownerId`-scoped, so casual-clone games count without resolving the clone. A W-L-D per archetype needs each battle's result: for a casual game `scoreState.currentScore` vs `opponentScore` (`reflect.js:476-489`); for a League battle the outcome is the group's verdict, not the day's. A `status == 'completed'` filter needs a new composite index (**ASSUMED**). Cost: six count queries per player per open, or a counter kept on the save (§4.3) |
| Learning receipts | `learningReceipts/{owner}/receipts` with the battle's archetype (`captureReceipt.js:284-287`, `:408-410`, **V**) | Yes, but they are evidence records, not a count |
| `masteryProfiles/{uid}.archetypes[a].{ xp, battlesCounted }` | `masterySettlement.js:530`, `:639` (**V**) | A per-archetype counter exists but its writer is dark (`MASTERY_XP_ENABLED = false`, `masteryConfig.js:41`, **V**) and it is XP |
| The Agent record screen | `AgentRecordSheet.jsx:182-193`: `stats.gamesPlayed`, a level label from `getAgentLevel` (Rookie < 5, Starter < 15, Partner, `agentProgression.js:52-56`, **V**), the archetype's name and disposition (`:186`, `:212`); mastery cards dark (`:287-331`). Opened from the hub (`LoadoutSheets.jsx:50-66`) and the Loadout panel (`LoadoutPanel.jsx:143-148`) | It shows the one record, labelled with the current archetype's name: honest only while one archetype plays |
| `getAgentGrowth` | `agentGrowth.js:8-13`: stage 1, no read (**V**) | — |
| XP, levels, mastery tracks | `agentProgression.js` (live, by games); `masteryProgression.js` (dark) | **No per-archetype level exists in code.** Say so plainly: there is none |

**The hub copy guard** (`hubCopy.guard.test.js`, **V**): (1) every user-visible string under `src/components/CommandCenter/` must live in `hub/hubCopy.js` or `hubGateCopy.js` (`:185-190`); (2) no copy-table string may match the banned list (`:372-376`): learn, improv-, intelligen-, smart(er), earned, tier, "getting better", evolv-, **grow / grows / growth / growing**, "since your last visit", level(s) up, unlock, "Sources · N", remember(s), Tester, simulat-, prototype, illustrative; (3) the only literal digits in copy are `1`, `1.3` and `10` (`:417-420`), and a count passed as a function argument is stripped before the check (`:418`). The policy behind it: "No intelligence, improvement, growth, or earned-render-tier claim is permitted" (`docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md:37`, **V**).

The S4 copy guard beside it (`hubCopy.s4.guard.test.js:12-18`, **V**) pins S4's strings literally with the same banned list plus "event", "history of" and "log", and itself accepts a count passed as an argument ("All activity · 21", `:30`).

What "12 battles as the Contrarian" needs: mechanically nothing: `battlesAs: (n, name) => \`${n} battles as ${name}\`` passes rows 2 and 3, and so would "Never worn" (the Phase 0 report's remark that item 3 would reject it overstated the guard). What it needs is a **ruling**: the spec's clause and the row's own name ("no copy carries a count the hub does not hold") treat counts as claims; a per-archetype battle count is a recorded fact of the same class as the game rows the hub already lists, so the ruling is "counts of recorded battles are facts, not growth". "Stage", "level", "growth" and the board's "24 battles · stage 2" stay banned, which is D4.

---

## 6. The surfaces that change

| Surface | `file:line` | Reads / writes | The armory or the per-game loadout replaces it with |
|---|---|---|---|
| **The hub's Change archetype sheet** | `LoadoutSheets.jsx:135` mounts `ArchetypePicker` (`ArchetypePicker.jsx:310`); confirm `:352-378` calls `changeArchetype` (`:358`), 409 mid-battle; copy "applies on your next deploy" (`:181`, `:390`) | reads `agent.archetype`; writes through `change-archetype.js` | The armory (A1). The copy is already wrong against the shipped behaviour (R10): the change is immediate |
| **League's `LoadoutChooserSheet`** = the training lobby's selector | `LoadoutChooserSheet.jsx:143-153` draws `ArchetypeCard` for `ARCHETYPE_ORDER`; local draft state only (`:7-14`); `onStart` hands `{ archetype, equippedWatchlistId }` to the caller (`:110-113`). Mounted at `LeagueLobbyRedesign.jsx:478-488` and `LeagueDeskParts.jsx:599-609`, opened by "Customize loadout" (`:469`, `:592`) → `runTrainingForm(spec)` (`LeagueLobbyRedesign.jsx:379`) → `lobby-quickplay-training` (`tournamentLobbyActions.js:69`) | reads the ranked prefill; writes the pod's `loadoutSpec` | **Removed (D3).** Training then reads the League loadout (§9 A2) |
| The fallback shells' pickers | `EquipStation.jsx:355`, `desktop/EquipBench.jsx:285` | same write | Fallback only (hub chunk failure). Left, or retired with the shells |
| Onboarding | `AgentCreationFlow.jsx:331-334`, `:380-383`; `create-profile.js:19-22` | derives the archetype from three answers; no picker | Unchanged; a natural later "first suiting up" |
| **The hub's Loadout tab: Archetype card** | `LoadoutPanel.jsx:155-170`; lock line `hubCopy.js:198-203` | `loadout.archetype` from `archetypeLines(agent.archetype)` (`useHubRuntime.js:107`) | Shows **one** loadout today. Under D1 it shows the BaggerBomb loadout (the hub deploys BaggerBomb), with the League loadout named where the League is |
| **Watchlist card** | `LoadoutPanel.jsx:171-182`; the sheet `LoadoutSheets.jsx:69-121` (`equipWatchlist` / `unequipWatchlist`) | `agent.equippedWatchlistId` | The BaggerBomb loadout's book slot (§8) |
| **Deploy card and strip** | `DeploySection.jsx:80` ("what the NEXT deploy carries"); `loadoutLine.js:1-14` ("Trend Follower · Tech Leaders") | the one loadout | The line names the BaggerBomb loadout; the Deploy card is where "the archetype chosen on the way into a game" lives |
| **Agent record** | `LoadoutSheets.jsx:50-66` → `AgentRecordSheet.jsx:182-212` | `stats.gamesPlayed`, level label, the current archetype's name | Per-archetype facts (A4) or the sum, labelled |
| **The League lobby's loadout surface** | the "Customize loadout" button and sheet above; the lobby preview wears `youArchetype` = the ranked field (`LeagueDeskParts.jsx:562`, `LeagueLobbyRedesign.jsx:425`) | — | A League loadout line and an "Open armory for League" door; the preview wears the League loadout |
| **The nightly window** | none in code (§1.3); the gap between completion (`agent-evaluate.js:7226-7232`) and the morning fan-out | — | Either a designed window (the League loadout may change for tomorrow) or a week lock (FD-3) |
| **The Forge's deployed strategy** | `update-agent-settings.js:85-91`; `deployStrategyService.js:1-22`; frozen per battle as `deployedGuardrails` (`agentBattleService.js:198-202`) | one per agent | Belongs to **the agent** today. Per loadout would mean a strategy slot per game kind; per archetype would mean it travels with the save (FD-5) |
| **Character settings** | `standingLeans`, `dials`, `settingsRev` (`trainingClone.js:80-88`); validated per archetype (`leanRevalidation.js:5-21`; `change-archetype.js:186-215`) | stored on the agent, valid for one archetype | Archetype-bound by validation, agent-bound by storage. The honest home is the archetype's save (FD-5); the alternative keeps them on the agent and re-validates per game |
| **The hub hero** | `HubAgentForm.jsx:50-54` reads `agent.archetype` from `HubAgentFormContext` (`CommandCenterHub.jsx:614`); label "Shadow wearing <name>" (`hubCopy.js:517-519`) | the ranked record | See §6.1 |

### 6.1 What the hub hero could wear under D1

Signals that exist on the hub today (**V**):

1. **The owner's live battles**, the 120 s poll (`App.jsx:4042-4049`: `agentBattles` where `ownerId == uid` and `status == 'active'`, training clones dropped). Each row is the whole document, so it carries `agentContext.archetype` and `groupId`; `classifyBattleType` tells ranked from BaggerBomb (`commandCenterLiveBattles.js:42-60`).
2. **The next action** (`hub/nextAction.js:8-18`): rule 1 is an owned live game in `sortLiveBattles` order; rule 3 the first deployment.
3. **The loadout read** (`useHubRuntime.js:107`): the ranked record's archetype, which under D1 is the default / the League loadout (FD-2).
4. **The selected area and the phone tab** (`ShadowStage.jsx:119`, `:189`).

Options, for the founder: (a) **the game in focus**: when a live game exists, the hero wears the next action's battle archetype (signal 1 through 2); otherwise the BaggerBomb loadout the Deploy card is about to send; (b) **a default "main" archetype**: the ranked record's field, whatever is running; (c) **the loadout of the surface**: the hub wears BaggerBomb's, the League lobby wears League's. (a) changes the hero when a League game is live and a different casual loadout is set; (b) never moves with the games; (c) is the simplest to explain. The suit-up plays on a change of the hero's archetype (`HubAgentForm.jsx:18-19`), so (a) would also suit up when a game opens.

---

## 7. The armory from board 6

### 7.1 What the board specifies (`agent-cc-v2.jsx.txt`, **V**)

- **Desktop:** a 1040 px dialog (`:70`). A 690 × 700 listbox (`:72`) with Shadow at 300 px in the centre, labelled "Your Shadow · fitted preview" (`:76-77`), wearing the **previewed** set (`sel`), and six `SetSlot`s on a dashed ring of radius 252 (`:69`, `:75`): each a 150 px card holding the set alone at 112 px, **no brain, pewter ("unlit") unless it is the equipped one** (`:61-63`: `brain={false}`, `pal={lit ? 'teal' : 'unlit'}`), its name, and a status line ("Equipped · 31 battles", "3 battles", "Never worn"; "Previewing · " prefix, `:56`, `:64`). An aside (`:79-88`): "Previewing", the name, the one-liner (`ONE`, `:53`), a long paragraph, two growth tiles ("This armor · 3 battles · stage 1", "Shadow's core · 24 battles · stage 2", `:81`), a motion note, and the button "Equip <name>" with the footnote "Applies on your next deploy. Partnership and shared research stay with Shadow." (`:87`). Header copy: "Choose the armor Shadow wears into battle. Select a set to see it fitted; a change applies on your next deploy." (`:73`).
- **Phone:** a 390 px bottom sheet (`:92`): the previewed Shadow at **190 px** beside a text column (name, one-liner, "<growth> · stage 1", `:95-96`), then a **3 × 2 grid of the six sets at 72 px** with name and status (`:97-98`), then the Equip button (`:99`).
- **Interaction and motion** (`:105-106`): unworn sets still at 70 % light, idle starting on hover; selecting a set plays board 2's equip (900 ms) on the centre Shadow while the previous set returns to its hook (700 ms); Equip confirms, closes, and the Command Center slot continues the same motion.
- **Against the rulings:** the battle counts and stages are fixture text and D4 forbids them (§5); "applies on your next deploy" is not the shipped behaviour (R10); "Partnership and shared research stay with Shadow" is a true statement of D5.

### 7.2 What the engine supports now, and what it lacks

Supports (**V**): the swap between forms with the size tweened (`engine.js:23-26`, `:465-485`; `AgentForm.jsx:100-106` with `equipOnChange`), the 700 ms unequip (`equip(false)`, `AgentForm.jsx:12`, `:109`), many views on one renderer with each view's own rate (`engine.js:3-5`, `:15-18`; `RATES` `:42`), batched plates (`batch.js`), the still (rate `'still'`, the cached still, `AgentFormStill`), the six moods (`agentFormSpec.js:31`), the response brighten (`respond`, R19), the **unlit palette** (`vocab.js:59`; its tokens `agentFormTokens.js:17`) and a **brainless form** (`form.js:29-33`). The wrapper exposes **neither** `unlit` nor `brain: false` (`agentFormSpec.js:54-68` sets `pal` to teal or copper only): the unworn set of board 6 is a small wrapper change, not an engine one. Hover-to-idle is a rate flip per view (`setOptions`, `AgentForm.jsx:107`).

Lacks (S0 report §5, `docs/audits/20261029_BUILD_AGENT_FORM_S0.md:190-198`, **V**): the seam flash, the ring burst, unworn sets at 70 % light with idle on hover, trailing streams at 40 px, and the bare → armored scale step. Also not an engine thing: "the previous set returns to its hook" is a layout animation of the slot, and the equip on the centre Shadow while a side slot unequips is two views' tweens on the same clock (supported, uncoordinated).

### 7.3 The phone: in place on the hero

The hub's phone hero is a 200 px box (196 under 375 px; `CommandCenterHub.jsx:156-157`, **V**) at the left of `PhoneStage`, with the name and status to its right (`ShadowStage.jsx:189-210`; padding `10px 14px 14px 6px`, `:197`). The stage is the hub's full width minus its gutters, about 340 px of inner width at 390 (**ASSUMED**: the hub's outer padding was not measured here). R12 draws any form under 40 px as a still (`agentFormSpec.js:76`, `:79-81`); the phone tap target is 44 (`hubStyle.js:63`).

Proposal, for the harness and the founder's eye: the armory opens **in the stage**, the text column folds away, the hero shrinks to **150–160 px live** and centres, and the six sets sit on a ring of radius 112–118 px at **44–48 px**, as stills (their 44 px tap areas are the ring). Diameter 272–284 px fits 340. The previewed set suits up on the centre (the swap already built); a set at 44–48 px is above R12's floor, so it may go live on touch (a rate flip) and return to its still on release. The alternative is the board's own phone sheet (190 + a 72 px grid), which leaves the hero in view only while the sheet is short. Sizes are a founder choice after the device test (FD-8).

### 7.4 Cost: seven live views against one live and six stills

S0 already measured the upper bound on this laptop (its §3.2, `:103-127`, **V**): one hero at 200 live and batched costs 2.62 ms a frame at 60 fps; the "armory" preset (one at 190 and seven at 72, all live, batched) costs 17.30 ms, 54 fps, 11 % late; at half rate it holds 30 fps. Those rows ran under the design's canvas-filter bloom; the hub draws the CSS bloom, but S0's own per-form matrix (§3.1, `:81-102`, **V**) found "the four blooms cost about the same", and it puts one batched Trend Follower at 1.45–1.66 ms, under the preset row's 2.62. Every view pays its own 2D copy of the shared renderer, so cost follows the number of live views more than their size.

### 7.5 This run's headless measurement

A helper measured this commit's engine in headless Edge 156 on this laptop (**V·h**): a scratch Vite page in a WSL worktree of `40641486` mounting `AgentForm` views (batched, CSS bloom, idle, player, stage 1, `clip`), driven by `playwright-core` 1.61.1 with `--use-angle=d3d11`. The renderer on all 24 runs was the real GPU, `ANGLE (Intel, Intel(R) Iris(R) Xe Graphics … Direct3D11)`, `WEBGL_multi_draw` present, never SwiftShader. Protocol per run: a fresh context, every view reporting `live`, 10 warm-up frames, then 3 s of the engine's own frame samples (`onFrame`), read with the lab's `readoutLine` (late = a gap over 25 ms). Phone cells at 390 × 844, dpr 3; desktop cells at 1440 × 900, dpr 2. Two protocol runs per cell, then three more passes to characterise the spread.

| Cell | Views | fps | avg ms (runs 1, 2) | p95 ms (runs 1, 2) | calls / frame | views drawn / frame |
|---|---|---|---|---|---|---|
| P1, the control (S0's hero200) | 1 live @200 | 60 | 1.85, 1.24 | 3.30, 2.30 | 13 | 1 |
| P7L, board 6's phone sheet | 1 live @190 + 6 live @72 | 59–60 | 4.94, 6.40 | 8.40, 13.30 | 94–100 | 7 |
| **P7S** | 1 live @190 + **6 stills** @72 | 60 | **2.11, 1.69** | **3.10, 3.10** | 13 | 1 |
| P7L48, the in-hero proposal | 1 live @160 + 6 live @48 | 60 | 4.96, 7.65 | 9.40, 14.70 | 94–98 | 7 |
| **P7S48** | 1 live @160 + **6 stills** @48 | 60 | **1.19, 1.80** | **2.00, 2.70** | 13 | 1 |
| D7L, board 6's desktop dialog | 1 live @300 + 6 live @112 | 56–60 | 3.17, 8.32 | 4.00, 15.00 | 94 | 7 |
| **D7S** | 1 live @300 + **6 stills** @112 | 59–60 | **1.20, 1.74** | **2.10, 2.70** | 13 | 1 |

Supplementary passes (**V·h**): the seven-live cells read 3.4–5 ms on a rested machine and 6.4–9.8 ms under back-to-back measurement, in either cell order, and fell back to 3.4 ms after two minutes idle; the control and every still cell stayed at 1.0–2.1 ms throughout. No context was lost and no view was dropped by the visibility gate.

**What it says.**
- **One live hero and six stills cost what the hero alone costs.** The stills draw once at mount; each frame draws one view at 13 calls, 1.2–2.1 ms. The loop stays on for the hero (`engine.js:349-352`).
- **Seven live views cost 3.4–10 ms on this laptop**, 94–100 draw calls (S0's per-form batched counts sum to 96), and the laptop still holds 60 fps. The spread is machine state, not the engine: it tracks per-frame work and clears with idling.
- **Size does not set the cost; the number of live views does.** 48 px sets (above R12's 40 px floor) cost the same as 72 px ones; the 300 + 6 × 112 desktop dialog costs the same as the phone sheet.
- **Open:** these seven-view numbers are about half of S0's eight-view "armory" row (17.3 ms, 54 fps) per view. Not the bloom: S0 §3.1 found the four blooms cost about the same. One fewer view and no bare Shadow do not explain it either. S0's preset rows (§3.2) already read higher than its own per-form cells for the same hero (2.62 against 1.45–1.66 ms), and this run's control (1.0–1.85 ms) matches the per-form cells, so the preset matrix carries an offset of its own; a shorter window (1.6 s) and the machine's state under sustained load, which this run measured at 2–3×, are the candidates. Not resolved here.
- **Laptop numbers are relative cost, never the phone's frame rate.** The phone decides.

For D2's in-place armory the honest reading is: six stills around a live hero costs the hub nothing it does not already pay; six live sets cost about five hero-frames more, which the laptop absorbs and the phone is unmeasured on.

**What the founder's phone should test.** The lab (`?agentFormLab=1`, flipped only on a smoke branch; `agentFormFlags.js:32`) has presets for one hero and for the eight-view armory, all at one rate (`AgentFormLab.jsx:26-33`, `:181`): there is no "one live, six stills" preset, so the phone's upper bound is the existing armory preset at 60 s and 5 min, and A1 adds a preset for the mixed case before the armory ships. The fallback rule stands (S0 §7, item 8): live at ≥ 55 fps over 60 s and p95 ≤ 8 ms, else half, else stills.

---

## 8. The book slot

**Today.** The watchlist is the equipped list on the agent (`equippedWatchlistId`, `equippedWatchlistName`, `equippedAt`; `equip-watchlist.js:100-121`), changed in the hub's watchlist sheet (`LoadoutSheets.jsx:69-121`) or the Forge (its Lists door), and resolved at deploy to a frozen `{ watchlistId, name, tickers, snapshotAt }` (`decide.js:381-396`; `agentBattleService.js:207-209`) with the idea version beside it (`:217-231`). League board production resolves the same pointer (`tournamentAgentBoards.js:473-490`) and the tournament battle carries `equippedWatchlist: null` (`decide.js:1562`). The list lives at `watchlists/{id}` with an owner, a status (committed), `tickers[]`, a thesis and the idea pointer `currentHypothesisVersion` to `hypothesisVersions/v{n}` (`hub/selectors/loadout.js:52-60`; `hypothesisRecords/store.js:1-20`, **V**). The idea-first note makes the list the idea's **universe** (`docs/design/20261016_DESIGN_NOTE_IDEA_FIRST_FORGE.md:7`, `:17-18`, `:38`, **V**).

`docs/design/COMMAND_CENTER_PURPOSE_V1.md` is **not on `main`** (a search of `docs/design/` finds no file by that name and no "Huddle" in `docs/`). The Huddle's own Phase 0 exists on the unmerged branch `origin/claude/huddle-phase0` (`52c3392c`, "Phase 0 Huddle report", **V** for the commit subject only; not read), so "Shadow may build the book from the Huddle later" is taken from the prompt alone here.

**Shape.** The per-game loadout holds a reference, never names:

```
book: {
  kind:   'watchlist' | 'universe' | 'none'    // 'universe' = a list that carries an idea; a display kind, derived at read
  ref:    { watchlistId }                       // the one pointer; the deploy resolver turns it into the frozen snapshot
  pin:    { hypothesisVersion } | null          // optional: hold the idea version the loadout was set with
}
```

A list Shadow builds later is another `watchlists/{id}` document with an `origin` of its own; it fills `ref` without a redesign. The resolver at deploy stays `resolveEquippedWatchlist` + `buildEquippedSnapshot` (`watchlistEquip.js`), reading the loadout's `ref` instead of the agent's field.

---

## 9. Staging

| Stage | What | Flag | Fenced-file contact | Founder-signed diff? | Size |
|---|---|---|---|---|---|
| **A1 The armory replaces the picker**, on today's global loadout | New `Armory.jsx` beside `LoadoutSheets.jsx`; the swap at `LoadoutSheets.jsx:135`; `ArchetypePicker.jsx` stays until A2 removes its last mount; the wrapper gains `pal: 'unlit'` and `brain: false`; a lab preset for one live + six stills; copy in `hubCopy.js` under the guard; the commit stays `changeArchetype` (immediate, 409 mid-battle), so the copy says so (R10). The §2.3 ratchet: names through `hub/archetypeLines.js` only (`archetypeImportBoundaryBaseline.json:44`; the mount guard's one-importer row `commandCenterHub.mount.guard.test.js:1280`) | `AGENT_FORM_ARMORY_ENABLED = false` in `agentFormFlags.js` | None | No | **M**: one sheet, one wrapper change, the lab preset, parity rows with the picker's sheet tests, flag-off byte identity |
| **A2 Per-game loadouts** | A server-written loadout record per game kind: `agents/{rankedId}.loadouts.{baggerbomb\|league}` = `{ archetype, book }` or a `loadouts/` subcollection; the ranked record's `archetype` / `equippedWatchlistId` stay as **the default** and, if FD-2 so rules, as the League loadout. **BaggerBomb:** the casual clone's resync (`casualClone.js:91-98`, `:180-213`) applies the BaggerBomb loadout over the inherited fields and seeds that archetype's traits as the training override does (`trainingClone.js:297-299`); `decide.js` and `createAgentBattle` then stamp it unchanged. **League:** the League loadout is written onto the ranked record at registration (or at the chooser), with the lock moved to "the group is in BATTLE" (or the week, FD-3); board production and the daily deploy read it as they do today. **Training:** reads the League loadout; `LoadoutChooserSheet` and its two mounts go; `lobby-quickplay-training.js`'s `loadoutSpec` becomes the League loadout. The refusal: `change-archetype.js:145` becomes per loadout; the hub's lock line (`selectors/loadout.js:136`) and the Deploy card's line name the loadout. The ledger's predicate (`cardStore.js:149`, `:216`, `:240-245`) and the adapter order (`baggerbombAdapter.js:594`) fixed here | `PER_GAME_LOADOUT_ENABLED` | **None if the clone seam is used.** Fence contact appears only if the League loadout must live apart from the ranked record (a read in `decide.js:1554` or a League clone) | Yes, for the League freeze semantics (FD-3) and the lock's new shape; a design note, not a fenced diff | **L**: the record, two write paths, the resync change, the League write, the lock, the ledger, five surfaces' copy, the chooser removal |
| **A3 Per-archetype saves** (server) | §4.3: the `archetypeSaves` subcollection; the resync copies the game archetype's save; `change-archetype.js` shelves and restores for the ranked record; `reflect.js`, `agentConsolidationApply.js`, `agent-evaluate.js:7237-7262` write the save; the ledger per archetype; a one-time migration that moves today's fields into the current archetype's save | `ARCHETYPE_SAVES_ENABLED` | **None**: every fenced reader takes the fields from the document it is handed (§4.3 table). A byte-identical trading-prompt row with and without saves proves it | Yes: which fields travel (FD-5), and the migration | **L**: four writers, the resync, the migration, the honesty rows the Film Room's census pattern already uses |
| **A4 Record facts in the armory** | The six count queries on the existing index, or the save's `stats` (after A3); "Equipped · 12 battles", "3 battles", "Never worn" as copy functions; the record sheet labelled per archetype; the spec clause amended for counts of recorded battles; W-L-D only where a result exists (BaggerBomb) | inside `AGENT_FORM_ARMORY_ENABLED` | None | Yes: the copy ruling (§5) | **S–M**: a reader, copy, guard rows; a new composite index if a status filter is used |

**Order.** A1 and A4's reader can run side by side (A4 reads battles, A1 draws). A2 before A3: the save is keyed by the game's archetype, which A2 introduces. A3 is the only stage that touches the memory writers; it should land after A2 has run for a week so the saves start from a known archetype. A1 can ship before A2 on today's global loadout; its copy then changes once in A2 (from "a change applies to every game" to the loadout's name). The lab preset in A1 is what makes the founder's phone test for the armory possible.

---

## Founder decisions

Every choice D1–D5 leaves open, with what each costs.

| Id | Decision | Options | Cost |
|---|---|---|---|
| **FD-1** | **When does an armory equip take effect?** The board says "applies on your next deploy"; today's change is immediate and battle-locked (`ArchetypePicker.jsx:12-16`). Phase 0 asked this as its question 5; it is still open | (a) Immediate, and the copy says so (R10, display agreement). (b) "Next deploy": under A2 this is natural: the loadout is read on the way into a game, so a change while a game runs applies to the next one, and the lock disappears | (a) is free. (b) is A2's shape; before A2 it is a wrong promise |
| **FD-2** | **Where does the League loadout live?** | (a) On the ranked record's own fields (it *is* the default and the League loadout; BaggerBomb has its own slot). (b) A separate League record, read by the League path | (a) no fence contact; the hub's "Archetype" card must then say "League and default". (b) a read in `decide.js:1554` or a League clone: fence contact or a new identity that banking, mastery and backing key on today |
| **FD-3** | **Is a League loadout frozen for the week?** Today it can change between the evening completion and the morning fan-out (§1.3) | (a) Frozen at registration until the group completes (the board, the draft and all five battles wear one archetype). (b) A designed nightly window: tomorrow's battle may wear tomorrow's choice. (c) Leave today's behaviour and only name it | (a) closes a defect and matches "the week is the game"; it needs a week lock in place of the per-battle 409. (b) is the smallest change (none) but the Monday board was ranked under another archetype. (c) is free and honest if the UI says it |
| **FD-4** | **D3, confirmed (not a decision).** Training reads the League loadout under D1 (§1.4) | — | The chooser and its two mounts go (`LoadoutChooserSheet.jsx`, `LeagueLobbyRedesign.jsx:478-488`, `LeagueDeskParts.jsx:599-609`). Trying an archetype in training first means changing the League loadout, which a week lock (FD-3) allows only between weeks |
| **FD-5** | **What travels with an archetype's save (D5)?** Ruling 5 names plays and the learned paragraph | (a) Memory, paragraph, cycle, lessons (the ruling). (b) Also stats. (c) Also the trait set and Character settings (they are archetype-validated today). (d) Also the Forge strategy | Each addition is a writer that changes in A3. (c) makes "each archetype is its own character" literal; without it a Contrarian's leans are re-validated against the Trend Follower every switch, as today |
| **FD-6** | **Which record facts may the armory show (D4)?** | (a) Count and first/last played per archetype. (b) Also W-L-D for BaggerBomb games. (c) Also "Never worn". (d) None until A3's saves exist | (a) and (c) need the copy ruling (§5); (b) needs the result per battle, which League battles do not have; (d) costs nothing and shows nothing |
| **FD-7** | **What does the hub hero wear?** (§6.1) | (a) The game in focus. (b) A "main" archetype (the ranked field). (c) The loadout of the surface it sits on | (a) one selector over signals that exist; the hero changes when games open. (b) never moves. (c) simplest words |
| **FD-8** | **The phone armory's home and sizes** | (a) In the hero's box: 150–160 live centre, six 44–48 stills on a ring. (b) The board's bottom sheet: 190 hero, a 72 px grid | (a) keeps the figure in view (D2); needs the device test of §7.5. (b) is the board as drawn; the hero leaves the hub's view |
| **FD-9** | **Unworn sets: live on hover or stills?** | (a) Stills, live on touch. (b) All live | (a) costs one live view. (b) is the S0 "armory" row: 54 fps batched on the laptop, the phone unknown |
| **FD-10** | **The Forge strategy's home** | (a) The agent (today). (b) The loadout. (c) The archetype's save | (a) free; one strategy rides into every game. (b) a slot per game kind. (c) FD-5(d) |
| **FD-11** | **The default archetype's meaning** | (a) The ranked field = what any game with no choice wears. (b) Last used | (a) is today's field; (b) needs a write at every deploy |

---

## Risks and side findings (for separate tasking, not fixed)

| # | Finding | Where | Note |
|---|---|---|---|
| R1 | A League week can change archetype overnight under its Monday board and draft | §1.3 | FD-3 decides whether this is a defect |
| R2 | The hub's picker promises "applies on your next deploy"; the change is immediate | `ArchetypePicker.jsx:181`, `:390` | R10 from Phase 0, still open |
| R3 | The mobile adapter prefers the live archetype over the battle's | `baggerbombAdapter.js:594` | one line; wrong today whenever a casual game's clone differs (it cannot yet, but A2 makes it possible) |
| R4 | The plays ledger refuses a card for a day taped under another archetype than the ranked record's current one | `cardStore.js:240-245` | correct for ruling 5 today; breaks under D1 |
| R5 | `agent.stats` excludes League and merges archetypes; the record sheet labels it with the current archetype's name | §5 | the caption in the hub is honest; the sheet's subtitle is not |
| R6 | The design lock for per-battle loadouts is cited but not in `docs/` | `casualClone.js:2`, the review `:3` | commit it with A2's docs if it still exists in the founder's files |
| R7 | The armory's unworn look needs a wrapper change (`unlit`, no brain) the engine already supports | §7.2 | small, A1 |
| R8 | Seven live views on the phone are unmeasured; the laptop says 54 fps batched for eight | §7.4–7.5 | the lab preset in A1 |

---

## This run's commits and artifacts

- This report, `docs/audits/20261102_PHASE0_ARMORY.md`, with a copy at `C:\Users\fashr\Documents\FantasyTrades\AgentForm\20261102_PHASE0_ARMORY.md` (BUILD_RULES §3).
- Not committed: the Q7 harness (a WSL worktree of this commit with an untracked page and a Windows Playwright driver in the session scratchpad; the worktree was removed after the run).
- No application code, test, flag or document other than this report changed.

**Checks run on this branch.** The 14 test files that walk the repository and name `docs/` (`hubCopy.guard`, `flagPinGuard`, `agentReadCensus.guard`, `archetypeRegistry`, `oneDoor.census`, `unconfirmedOutcome.census`, `compositionRunbookGates`, `callRecords/events`, `agent-evaluate`, `call-response.2b`, `TeamCard`, `cockpit2bFlags`, `commandCenterHubFlags`, `reset-failure-built-insight`), with this report present, on **Linux (WSL, `TZ=UTC`)**: **14 of 14 files, 381 of 381 rows pass.** On Windows the same files show the known four path-separator rows (`agentReadCensus.guard` × 3, the `archetypeRegistry` import ratchet), the class the agent identity Phase 0 recorded; none names a file under `docs/`. No lint or build was needed for a docs-only commit; the first build PR cut from this branch runs them.

**Review threshold (BUILD_RULES §2).** One file, this report. The first build PR cut from this branch carries it, and its review counts it.
