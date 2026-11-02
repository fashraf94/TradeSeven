# Build report: the casual clone carries the Character settings

**Date:** November 1, 2026 · **Executor:** Claude Code (desktop, Windows + WSL Ubuntu; Opus 5.5) · **Prompt:** "FantasyTrades — the casual clone carries the Character settings", prepared October 29, 2026 · **Branch:** `claude/casual-clone-character-settings` (local worktree `claude/casual-clone-character-settings-a749e7`, the app's suffix) · **Base:** `5b32cea5` (`main`; `be52068c` and `65b8632f` are both its ancestors) · **Code head:** `3757f4a7` as first delivered, `85ca004a` with the founder's rulings (§14) · `git fetch origin` ran first; the tree was clean. The prompt's setup says no advisor; none was used.

## 1. Verdict

| | |
|---|---|
| **Built** | Standing leans, the tempo dial and the settings revision join the one list a clone copies. Casual clones take them at every deploy, training clones at creation. A new guard fails if a future manifest field is on neither list. |
| **Starting check** | No STOP. A running game reads leans and tempo only from its frozen battle document (§2.2). No fenced file changed. |
| **Takes effect** | At the first deploy after this reaches production, on a clone with no game running. No running game changes; no backfill (§6). |
| **Founder rulings** | Given on the draft PR: every battle links (FQ-1), and FQ-2 approved as a separate PR. Applied in §14. |
| **Signature** | The founder signed §3 as written. `createAgentBattle` and every other fenced file are byte-identical. |
| **Checks** | At the rulings' code head `85ca004a`: full Linux suite exit 0, `Test Files 1263 passed \| 8 skipped (1271)`. `lint:gate` exit 0. Film Room suite exit 0. `vite build` exit 0 at `3757f4a7`; the pushed head's is in the PR description. |
| **Review** | Focused at 9 files (§10). The hub record took the diff to 10 files, so the multi-lens review ran at `85ca004a` (§10.1). No defect in the code; it corrected the records and the check in §13. Mutation: 20 of 20 at `3757f4a7`, 8 of 8 at `85ca004a` (§11). |
| **Not done** | Not merged. FQ-2 waits for this PR to merge. **The founder's check after merge has changed: see §13.** |

## 2. The starting check

### 2.1 (a) Every field the manifest reads

`buildResolvedAgentManifest` (`api/_utils/resolvedAgentManifest.js:101`), `buildGuardrailsLayer` (`:50`) and `buildCustomizationSnapshot` (`api/_utils/leanRevalidation.js:289`). All VERIFIED by reading, and by a recording proxy in the guard.

| Agent field | Read at | On the list before | Now |
|---|---|---|---|
| `archetype` | `leanRevalidation.js:292`, `resolvedAgentManifest.js:168` | yes | yes |
| `name` | `resolvedAgentManifest.js:169` | yes | yes |
| `config` (`.risk`) | `:178` | yes | yes |
| `activeRules` | `:130` | yes | yes |
| `equippedBundleIds` | `:131` | yes | yes |
| `deployedStrategy` (`.guardrails`) | `:51–52`, `:135–136` | yes | yes |
| `standingLeans` | `leanRevalidation.js:291` | **no** | added |
| `dials` (`.tempo`) | `leanRevalidation.js:314–315` | **no** | added |
| `settingsRev` | `leanRevalidation.js:317` | **no** | added; this is the "what else" field the manifest pairs with the leans (`resolvedAgentManifest.js:115–120`, `:179`, `:185`) |
| `id` | `resolvedAgentManifest.js:205`, `leanRevalidation.js:299` | no | `RANKED_ONLY_FIELDS`: it names the manifest, and a clone keeps its own |

Nothing else is read from the agent. The manifest's other inputs are `compiledBuild` (dark, `COMPILER_ENABLED = false`, `src/config/featureFlags.js:1429`), `equippedWatchlist` (resolved from `equippedWatchlistId`, already on the list), `gameMode`, `now` and `generationStamp`.

**`standingLeansInvalidated` is not an agent field.** Nothing stores it. Each snapshot derives it (`leanRevalidation.js:290`, `:307`). It is on the list as R-CC-1 rules, with a comment saying so (`api/_utils/trainingClone.js:80–83`). Today that entry copies nothing.

### 2.2 (b) Where a running game reads them

**No read of the clone's document during a game. No STOP.** VERIFIED:

| Reader | Source |
|---|---|
| Tempo in the evaluation cron | `desiredTempoOf(battle)` at `api/cron/agent-evaluate.js:1896`, `:6493`; the function reads `battle.agentContext.dials.tempo` (`api/_utils/tempoDialClamp.js:73–74`) |
| Leans in the evaluation cron and prompt | `battle.agentContext.standingLeans` at `agent-evaluate.js:4556`, `api/_utils/agentEvalPromptAssembly.js:1241` |
| Control suppression telemetry | `battle.agentContext.standingLeans` at `api/_utils/controlSuppressionTelemetry.js:205`, `:215` |
| Film tape | `desiredTempoOf(battle)` at `api/_utils/filmTape/tapeTags.js:217` |
| `masteryEnforcement.js`, `masteryConfig.js` | No agent document read; the module's one collection read is the mastery profile (`masteryEnforcement.js:35`). `revalidateTempoDial` is called by `change-archetype` and the maintenance script, never in a game |
| `leanRevalidation.js` | Called at battle creation, at the deploy prompt and by `change-archetype`, with the values passed in; never during a game |

The cron reads an agent document only at completion (`agent-evaluate.js:7029`, `:7056`), for the record, not for settings.

Two reads of the live clone document exist, and both run at deploy, before a battle exists: the deploy strategy prompt (`api/_utils/agentPromptAssembly.js:174`, fenced, reached only from `decide.js`) and the compiled-build gate (`api/_utils/deployBuildValidation.js:156`, dark). The resync itself skips a clone with an `activeBattleId`, twice: before the lease (`api/_utils/casualClone.js:148`) and on a fresh read under it (`:205`).

### 2.3 (c) Lean validity after an archetype change

Consistent by construction, and stronger than the question assumed. Because `standingLeansInvalidated` is derived, there is no stored pair to fall out of step. `archetype` and `standingLeans` ride in the same resync update (`casualClone.js:212`). `createAgentBattle` then revalidates the leans against the archetype it snapshots, so a clone and its ranked agent reach the same valid and invalidated sets. Row: `cloneManifestParity.guard.test.js:181`.

A ranked archetype change keeps lean data (`api/agent/change-archetype.js:352–362`), so the clone keeps it too; switching back revalidates the leans back in.

### 2.4 (d) Writes of `dials` or `standingLeans` onto a clone

**None in any product path.** VERIFIED:

- The Forge writes through `equip-lean`, `unequip-lean` and `set-tempo-dial`, and the Forge's agent excludes clones (`src/services/agentService.js:29`). Those endpoints check ownership, not clone status (`api/agent/set-tempo-dial.js:103`, `api/agent/equip-lean.js:132`), so a hand-made request naming the player's own clone would land. The next resync overwrites it.
- The client SDK cannot write them: the update rule allows four other fields only (`firestore.rules:332–335`).
- `agentSettingsTx.js` is the shared increment helper; it targets whatever agent its caller names.
- **Two maintenance scripts reach clones.** `scripts/rule-compat-cleanup.js:186`, `:203` increments `settingsRev` and scans training clones too (`:18`). `scripts/mastery-preflip-normalize.js:189`, `:219` writes `dials.tempo` and `standingLeans` on whatever the census lists, and the census scans every agent (`scripts/mastery-preflip-census.js:126`). No clone holds those two fields today, so nothing has been written. See the note in §12.

The resync cannot clear a field: it copies only what the parent holds (`casualClone.js:93–95`). That is safe here because no writer deletes any of the four fields (the only agent `FieldValue.delete()` in `api/` is on a bundle, `api/agent/set-rule-hardness.js:185`).

### 2.5 STOP conditions

| Condition | Result |
|---|---|
| 3b, a live read during a game | No |
| A fenced file needs editing | No; `git diff 5b32cea5 HEAD` on all 11 fenced files is empty |
| Anything under `api/` beyond the clone files, their tests and the guard | `api/_utils/backingStake.js`, one comment, as R-CC-4 rules |
| A pre-existing behaviour test changes beyond the rows the ruling moves | No. All moved rows are R-CC-5's, listed in §5 |

## 3. Fence contact, for the founder's signature

From the first deploy after this build reaches production, every casual game, and every training game whose clone is created from then on, snapshots what it did not before: the player's standing leans after revalidation, the invalidation record, the desired tempo, and the ranked agent's settings revision. Before, those four carried empty defaults (`[]`, `[]`, `null`, `0`). They reach `agentContext`, which evaluation reads, and `resolvedAgentManifest`, whose `equippedConfigHash` covers leans, invalidations and tempo but not the revision. Leans also reach the casual deploy's strategy prompt, which reads the clone at deploy, and tempo changes how a game runs through the clamp, so this is a live behaviour change for every player who has set either one. A player with no leans who never moved the dial sees no change in behaviour or hash. `createAgentBattle` is unchanged because it already writes those four keys on every battle and reads them from the agent it is handed; what changes is that the clone it receives now holds them. An existing training clone keeps what it was created with, since training clones are never re-synced.

Fenced functions called, none edited: `createAgentBattle` (the guard's rows run the real function).

## 4. The config hash (R-CC-4)

**Copied as a record, never compared. No change.** VERIFIED: the tape (`api/_utils/filmTape/tapeAssemble.js:770`), call records (`api/_utils/callRecords/candidate.js:200`, `:216`), capture (`api/_utils/tickCapture/captureWriter.js:326`, `captureSerializer.js:160`, `agent-evaluate.js:4653`, `:5107`).

**Compared: Backing.** `resolveHashAtStake` takes the owner's latest completed game of any type (`api/_utils/backingStake.js:223–233`). Settlement takes the tournament game's (`api/_utils/backingSettlement.js:539`). The results card marks a difference as "Loadout changed during the week" (`api/_utils/backingResults.js:107–114`, `src/components/League/backing/backingCopy.js:588`). Backing beta is off and the field is telemetry, so no code changed. One comment at `resolveHashAtStake` points here (`backingStake.js:219–221`).

**Known cause of a hash change:** this build. **Merge date:** the date PR #1019 merges (see git log). From that date, a casual or training game for a player with leans or a set tempo hashes differently from one before it, with no change by the player.

**What the code shows beyond the ruling.** The false mark the ruling worries about already exists, and this build shrinks it. For a player with leans or a set dial, a casual game's hash today lacks them while the tournament game's hash has them, so a stake read from a casual game already differs at settlement. This build leaves the tournament hash alone. After it, a casual game played with the same Forge settings matches the tournament game. A stake placed before the merge keeps its old hash, so it can still show the mark; it would have shown it without this build too.

## 5. The Film Room's Set link (R-CC-5)

*The founder's ruling FQ-1 replaced this: every battle links (§14). This section records the build as first delivered.*

**RL-1's condition was on `main`** (`src/screens/filmRoomV2/FilmRoomCardRegions.jsx:109` at the base). Removed in the same commit that adds `dials` (`45d36523`). The link is now gated by the tape alone: `if (!recorded)` at `FilmRoomCardRegions.jsx:107`.

- `setStateOf` no longer takes an agent, so the `agentId` prop on `YourCall` and `Receipt` went too (`FilmRoomCardRegions.jsx:183`, `:296`; `FilmRoomScreenV2.jsx:404`, `:406`). The screen keeps `agentId` for the cards hook.
- Set's wording is untouched, RL-5's sentence included (`filmRoomCopy.js:329`, `:332`). Only the comment above `setNoTempo` changed.

**Rows moved in `FilmRoomCards.jsdom.test.jsx`, all by this ruling:**

| Row | Change |
|---|---|
| `:997` `setStateOf` | Rewritten. A second argument, ranked or clone, moves nothing |
| `:1042` ranked battle, no tempo | Flipped: RK-2's sentence, no link |
| `:1106` ranked battle, no tempo, a Forge flag off | Flipped: RK-2's sentence, not RG-5's alone |
| `:1082` RL-5, a battle still running | Its assertions are unchanged; its day now records a tempo, because the old day's link came from RL-1's ranked arm |
| `:1055`, `:1072` casual clone rows | Retitled; behaviour unchanged |

This moves more rows than "flip its test row", and it takes the link from ranked battles. That is **FQ-1 (§12)**.

## 6. Timing and loose ends

**R-CC-3.** The change takes effect at the next deploy's resync. No running game changes; there is no backfill. Casual games already played keep their recorded inputs: `tempoDesired: null` stays true for them. A clone mid-game skips the resync, so the player's first game with the settings is the first deploy after the running game ends.

**R-CC-6.**
- `src/App.activeBattlesPoll.hub.jsdom.test.jsx:13–15`: reworded to the live flag (`COMMAND_CENTER_HUB_ENABLED = true`, `src/config/featureFlags.js:3463`). Comment only.
- `docs/audits/20261028_ACTIVATION_COMMAND_CENTER_HUB.md`: filled from the founder's rulings (§14).

## 7. Files

| File | Change |
|---|---|
| `api/_utils/trainingClone.js:52–94` | The list: `standingLeans`, `standingLeansInvalidated`, `dials`, `settingsRev` at `:84–87`, and its comment |
| `api/_utils/trainingClone.js:96–103` | `RANKED_ONLY_FIELDS`, one entry (`id`) with its reason |
| `api/_utils/cloneManifestParity.guard.test.js` | New: R-CC-1, R-CC-2, R-CC-3 rows (20) |
| `api/_utils/backingStake.js:219–221` | R-CC-4's comment |
| `src/screens/filmRoomV2/FilmRoomCardRegions.jsx:92–109`, `:183–187`, `:296`, `:314–318`, `:330` | R-CC-5 |
| `src/screens/filmRoomV2/FilmRoomScreenV2.jsx:404`, `:406` | The dead prop |
| `src/screens/filmRoomV2/filmRoomCopy.js:328` | The comment above `setNoTempo` |
| `src/screens/filmRoomV2/FilmRoomCards.jsdom.test.jsx` | §5's rows |
| `src/App.activeBattlesPoll.hub.jsdom.test.jsx:13–15` | R-CC-6's comment |
| `docs/audits/20261101_BUILD_CASUAL_CLONE_CHARACTER_SETTINGS.md` | This report |
| `docs/audits/20261028_ACTIVATION_COMMAND_CENTER_HUB.md` | R-CC-6, from the founder's rulings (§14) |

Line numbers in this table are the first delivery's; §14 gives the Film Room's after the rulings. Nine files at first delivery. The hub record makes ten, which reaches the BUILD_RULES §2 threshold (§14).

## 8. Rows, red then green

| Stage | Result |
|---|---|
| Guard at the untouched base | 18 of 20 red |
| Guard with `RANKED_ONLY_FIELDS` only, list unchanged | 14 of 20 red, for the right reason: the runtime row names exactly `dials`, `settingsRev`, `standingLeans` |
| Film Room rows against the old `setStateOf` | The ranked no-tempo rows red. The `setStateOf` row then gained the second-argument check, and M18 proves it red against RL-1's arm |
| After the change | Guard 20 of 20 green; Film Room file green |

**Two guard rows are green in every stage by design.** They check the fixture itself (`:218`, `:222`), so no source change can redden them. M9 proves `:218` fails on what it names.

**The four rows that stayed green at the second stage** bite through mutants: `:214` (M11), `:245` (M9), `:267` and `:276` (M20, M6).

R-CC-3's row (`:294`) is red before the change and under M3 and M4.

## 9. Checks

All in a private WSL worktree of `~/pd-ci`, removed at the end, at `3757f4a7`, `TZ=UTC`, Node 20.20.2, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`.

| Check | Result |
|---|---|
| Full suite | Exit 0. `Test Files 1263 passed \| 8 skipped (1271)`. `Tests 28103 passed \| 89 skipped (28192)`. 240 s |
| `lint:gate` | Exit 0 |
| `vite build` | Exit 0 at the code head; re-run at the pushed head (§13) |
| Fenced files | `git diff 5b32cea5 HEAD` on all 11: empty |

The emulator rules suite was not run: no rules file changed and the prompt does not list it. No flag changed, so no flag-on dry run.

## 10. Review record

Focused review, below the threshold: one Sonnet lens on a `git archive` snapshot of `3757f4a7`, given the code and the two questions and not this report's answers; then one Sonnet refuter on its own snapshot. Both were read-only on git and on the working tree. The lens ran the guard once (20 of 20). The refuter read source only. I re-checked the citations used below.

**The two questions, answered:**

- **Does any decision-shaping field still differ between a ranked agent's manifest and its clone's?** In the manifest, no: the guard proves it for all three clones. Across the whole deploy path, one difference remains, older than this build: `memory` on a clone's first game (RV-1).
- **Does any running game's behaviour change before its next deploy?** No (RV-5).

| ID | Claim | Refuter | Disposition |
|---|---|---|---|
| RV-1 | A casual clone is created with `memory: []` (`api/_utils/casualClone.js:69`), only the resync copies memory (`:97`), and the strategy prompt renders `agent.memory` (`api/_utils/agentPromptAssembly.js:95–96`, reached from `decide.js:431`). So a player's first casual game deploys without the ranked agent's memory. | **CONFIRMED.** Older than this build. One game only, and only if the ranked agent has memory | Not fixed: outside this task (BUILD_RULES §3), and `api/_utils/casualClone.test.js:175` pins the empty start. **FQ-2** |
| RV-2 | The resync checks `activeBattleId` and not `deployingAt` (`casualClone.js:148`, `:205`). A second tab's deploy can resync the clone during a first deploy still running. That deploy holds leans and tempo from its earlier read (`decide.js:163`) and reads the rules later (`:255–256`), so the battle it creates can mix old settings with new rules. | **CONFIRMED, narrowed.** Older than this build; these four fields join the same race. It needs a second tab deploying and a Forge change between the two. It cannot alter a battle that exists | No change. Recorded |
| RV-3 | Chat and voice read `partnerProfile`, `convictions`, `lessons`, `forgeSuggestions` and `stats.gamesPlayed` from the clone, which holds fresh or no values. | **CONFIRMED, narrowed.** None reaches a trading prompt or scoring. One weak indirect link: a chat turn picks its question from `partnerProfile`, and chat can file a battle directive | No change. The guard covers the manifest, as R-CC-2 asks, not the voice layer. Recorded |
| RV-4 | No other field on the deploy path that shapes a trade decision is missing from a clone. | **CONFIRMED.** No new field. `memory` is the one exception | None |
| RV-5 | Nothing changes a running game before its next deploy. | **CONFIRMED.** The other readers of an agent document during a game (chat, debate, call response, opener, batch review, reflection) read none of the fields | None |

Findings: 2 older behaviours confirmed (RV-1, RV-2), 1 recorded limit (RV-3), 2 no-finding claims upheld (RV-4, RV-5). None was refuted outright; two were narrowed. None is a defect in this diff, and none changed it.

### 10.1 The multi-lens review at 10 files

The hub record took the branch to 10 files, the BUILD_RULES §2 threshold. Three Sonnet lenses each worked on their own `git archive` snapshot of `85ca004a`, given the code and not this report's conclusions: Film Room behaviour, end-to-end wiring, and test integrity with the written records. One Sonnet refuter then took every finding on its own snapshot. All were read-only.

**Result: no defect in the code.** Lens A found nothing in any state of Set's words and link. Lens B traced the path from the Forge to the tape and found no step that drops the tempo. The findings below are about the records and about what the founder's check can show.

| ID | Claim | Refuter | Disposition |
|---|---|---|---|
| RC-1 | The hub record's §9 bullet called the App test comment stale, which this branch fixed | **CONFIRMED** | Fixed: the bullet now says PR #1019 reworded it |
| RC-2 | This report's §1 "Review" and "Not done" rows still described the pre-ruling state | **CONFIRMED** | Fixed |
| RC-3 | The guard's blind spot: a read behind a branch no fixture takes, written as a destructure, a bracket read or in a helper in another file, escapes both the runtime proxy and the source scan | **CONFIRMED.** No read escapes it today | Recorded limit. The guard catches a plain dotted read anywhere in the two scanned sources, and any read that runs. Mutants M6 and M8 show each half |
| RC-4 | The Film Room never names the tempo: nothing in `src/` reads `tempoDesired` | **NARROWED.** The one visible effect is the threshold on a tapped check (`FilmRoomCardRegions.jsx:162`) | §13's check corrected |
| RC-5 | Set's link needs the day's stagnation rule on | **CONFIRMED.** Off only for `guardian` (`api/_utils/agentArchetypeConfig.js:199`); the dial doesn't change it | §13's check corrected |
| RC-6 | With the compiler on, a clone carrying the ranked `settingsRev` recompiles and does not refuse | **NARROWED.** No refusal comes from the carried rev. `writeCompiledBuildsInTx` itself was not traced for a clone | Recorded. `COMPILER_ENABLED` is false |

None was refuted outright; two were narrowed. One cosmetic note stays open on purpose: a long comment line in `FilmRoomCardRegions.jsx`, left so the suite's tested code is the code pushed.

## 11. Mutation record

20 mutants, at the limit, on a `git archive` snapshot of `3757f4a7`. All killed. A run that collected no tests would count as broken; none did. Every file restored and compared against a second snapshot.

| # | Mutant | Rows red | Killed by |
|---|---|---|---|
| M1 | `standingLeans` off the list | 14/20 | carry, runtime, parity rows |
| M2 | `standingLeansInvalidated` off the list | 4/20 | carry rows, archetype row |
| M3 | `dials` off the list | 14/20 | carry, runtime, parity rows, R-CC-3 |
| M4 | `settingsRev` off the list | 14/20 | carry, runtime, parity rows, R-CC-3 |
| M5 | A manifest read on neither list | 5/20 | runtime, source |
| M6 | The same read behind a branch no fixture takes | 2/20 | source (the runtime row cannot see it) |
| M7 | A read in the customization kernel | 4/20 | runtime, source |
| M8 | A read by destructure | 3/20 | runtime (the source scan cannot see it) |
| M9 | A read of a listed field the fixture omits | 2/20 | fixture row |
| M10 | `RANKED_ONLY_FIELDS` emptied | 5/20 | runtime, source |
| M11 | `id` on both lists | 4/20 | no-overlap row |
| M12 | The resync drops `dials` | 4/20 | resync rows |
| M13 | Casual creation drops `settingsRev` | 3/20 | creation rows |
| M14 | Training creation drops `standingLeans` | 3/20 | training rows |
| M15 | The resync drops `archetype` | 3/20 | archetype row, resync parity |
| M16 | `agentContext` drops the dial (fenced file, snapshot only) | 4/20 | `createAgentBattle` rows |
| M17 | The mid-battle resync guards removed | 3/27 | `casualClone.test.js`'s existing rows |
| M18 | RL-1's arm left in `setStateOf` | 1/72 | `setStateOf` row |
| M19 | The link shown with no tempo recorded | 4/72 | R-CC-5 rows |
| M20 | The guard's own check emptied | 3/20 | planted-field rows |

M18 and M19 were run against the first delivery's R-CC-5 code.

**The rulings round.** 8 more on `setStateOf` and what it feeds, on a snapshot of `85ca004a`, against `FilmRoomCards.jsdom.test.jsx`. All killed, and the file restored clean.

| # | Mutant | Rows red |
|---|---|---|
| F1 | The recorded-tempo condition back in | 4/72 |
| F2 | RL-1's clone condition back in | 1/72 |
| F3 | The link with the rule off | 4/72 |
| F4 | The link with the rule unknown | 3/72 |
| F5 | The Character tab flag dropped | 3/72 |
| F6 | The tempo dial flag dropped | 3/72 |
| F7 | `cards.setNoTempo` read again | 11/72 |
| F8 | RL-5's sentence dropped where Set links | 6/72 |

## 12. Founder questions

**FQ-1: Set's link on a ranked battle with no recorded tempo. Ruled: every battle links (§14).**

- R-CC-5 says the link is "gated by RK-2's tape condition alone (a recorded `tempoDesired`)". Amendment L RL-1's "Later" says this build "removes the clone condition in the same diff, so every battle links". Both are yours; they give different results.
- RL-1's condition was "not a casual clone, **or** the tape records a tempo". Taking out the first half leaves the recorded tempo alone. So the ranked battles RL-1 gave the link to lose it: a player who never moved the dial sees "No tempo setting was recorded for this battle." and no link. Those are the players review KR2-1 named, the ones who have not found the dial.
- **Built:** R-CC-5's letter, because this prompt authorizes the build and shows less. Film Room cards are on `allowlist` (`src/config/featureFlags.js:3514`), so only allowlisted players see either result.
- **Recommendation: "every battle links".** After this build the dial reaches every battle, which is RL-1's stated test. RL-5's sentence is true on every battle, old casual days included.
- **The change:** delete `FilmRoomCardRegions.jsx:107`, flip rows `:997`, `:1042`, `:1055`, `:1106`. `cards.setNoTempo` then has no reader; removing that key is a wording change for you to rule on. Mutant M19 is this exact change, and it reddens those four rows and no others.

**FQ-2: a player's first casual game runs without the agent's memory (RV-1). Ruled: approved as a separate small PR after this one merges: copy memory at creation, training clones unchanged.**

- This predates the build and did not change with it. Every later casual deploy copies memory through the resync, so the gap is one game per player, and only for a player whose ranked agent has memory when their clone is first created.
- The clone's empty start is deliberate in the code (`casualClone.js:67–69`, "fresh history") and pinned by a row, so changing it needs your ruling.
- **Recommendation: copy memory at creation,** to match what the resync already does. A separate small PR: one line at `casualClone.js:69` and one row at `casualClone.test.js:175`. Training clones stay as they are: they start empty on purpose, for isolation.

**Note, no decision needed now.** Before any mastery enforcement flip: the pre-flip census will now list casual and training clones holding an aggressive dial or extra leans as well as the ranked agents they copied (`scripts/mastery-preflip-census.js:126`). A training clone given a different archetype by a loadout override keeps the inherited dial without the per-archetype check `change-archetype` runs (`api/agent/change-archetype.js:197–209`). `MASTERY_ENFORCEMENT_ENABLED` is false, so neither matters today.

## 13. Delivery

- Draft PR from `claude/casual-clone-character-settings`, citing changes by `file:line`. Pushed, reported, stopped: no merge, no CI watching, no smoke branch.
- The pushed head adds only this report to the last code commit. `vite build` at that exact head is reported in the PR description.
- Copy of this report: `C:\Users\fashr\Documents\FantasyTrades\20261101_BUILD_CASUAL_CLONE_CHARACTER_SETTINGS.md`.
- The private WSL worktree is removed.

**The founder's check after merge, corrected by the review (§10.1).** The prompt's wording can't be met as written: the Film Room never names the tempo, and since FQ-1 Set's link appears on every battle where the rule is on, so the link alone no longer proves the tempo reached the game. The proof is a number:

1. Use an allowlisted account (Film Room cards are on `allowlist`) and an agent that is not `guardian`. For `guardian` the stagnation rule is off, so Set says "No setting changes this situation for this archetype." and shows no link, by design.
2. Set the tempo to Measured in the Forge's Character area and deploy one BaggerBomb game.
3. When its first day's tape exists, open a day with a stalled tag and tap a check. The tag line reads "count N against a threshold of M". On Measured, M is 7 instead of 5 for `momentum_chaser`, 9 instead of 6 for `analyst`, `diversifier` and `contrarian`, and 4 instead of 3 for `degen`.
4. File a Set card on that day. Its receipt holds the dial link.

If the game has no stalled tag, the screen shows no difference. The tape's `tags.inputs.tempoDesired` still records `measured`.

## 14. The founder's rulings

| Ruling | Applied |
|---|---|
| **FQ-1: every battle links** | `setStateOf` loses the `if (!recorded)` line, and the two variables only that line read (`FilmRoomCardRegions.jsx:100–105`). Set now links wherever the day's rule is on and both Forge flags are on. `setSayOf` no longer reads `cards.setNoTempo` (`:108`); the key stays in `filmRoomCopy.js:330`, unread, for the Film Room chat. RL-5's sentence stays |
| **Rows** | The four flipped: `FilmRoomCards.jsdom.test.jsx:998`, `:1038`, `:1054`, `:1104`. RL-5's running-battle row (`:1082`) went back to its form on `main`, since its day no longer needs a recorded tempo. Red against the old code (5 rows), green after |
| **Signature** | §3 signed as written |
| **R-CC-4** | §4's merge date reads as ruled |
| **R-CC-6** | Hub record §3 and §8 item 1's phone half written as ruled; §8's other items stay pending. Beyond the ruling's two lines, so the record doesn't contradict itself: the `PHONE_SHADOW` sentence stays in the §3 row as a separate fact, its §1 "Not yet done" line lost the readout clause, and its §9 bullet now says this PR fixed the App test comment |
| **FQ-2** | Approved as a separate PR after this one merges. Not in this PR |

**Checks at `85ca004a`,** on Linux under the local machine rules: Film Room suite exit 0, 28 files, 581 rows; `lint:gate` exit 0; full suite exit 0, `Test Files 1263 passed | 8 skipped (1271)`, `Tests 28103 passed | 89 skipped (28192)`, 274 s. The totals match §9's because rows were flipped, not added. Everything after `85ca004a` is docs only.

**Review.** The diff reached 10 files, so the multi-lens review ran (§10.1). No defect in the code. It changed §13: **the founder's check after merge is a threshold number now, not the link.**

**Mutation.** 8 of 8 on `setStateOf` killed (§11). The clone code and the guard did not change this round, so the first 20 stand.
