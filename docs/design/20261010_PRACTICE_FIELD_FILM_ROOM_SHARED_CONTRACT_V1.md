# Practice Field ↔ Film Room shared contract V1

**Date:** 10 Oct 2026 · **Author:** the Practice Field chat (Fable), per ruling 19 · **Status:** draft for founder blessing
**Governs:** the Film Room's card build and the Practice Field's camp build
**Rests on:** ruling sheet V1.1 (adopted 10 Oct 2026), the Practice Field discovery with Addendum A, the Film Room handover, concept V2
**Anchors:** from the discovery at `93953d62`. Builders re-verify every path with `git ls-tree` before relying on it.

## 0. In plain terms

- **One chain.** Tape → situation tags → a list of moments → a card (the player's pick) → camp drills → a play → proof → install → a game-day record.
- **One list of situations.** Every screen and every count reads the same definitions, so the Film Room and the camp can never disagree about what "stocks not moving" means.
- **One ledger.** A card and a play are the same entry at different stages. A play's history starts with the film that nominated it.
- **One door.** Nothing in the ledger reaches the agent until it is a play that passed the proof and was installed.
- **Two builds.** The Film Room builds the situation list, the counter, the card and two small tape additions. The Practice Field builds the drill, the agent's fresh call, the reveal and the play menu on top.
- **First situation:** "our stocks are not moving". "Down" and "good lead" have their names reserved now and get built later.

## 1. The chain and who builds each link

| Link | Built by | Writes |
|---|---|---|
| Situation registry | Film Room card build | one code module |
| Tape additions T1, T2 | Film Room card build | the tape |
| Tagger, counter, list | Film Room card build | nothing stored beyond the tape's declared fields |
| Card (stages `card`, `nominated`) | Film Room card build | the ledger |
| Drill, agent's fresh call, reveal | Practice Field camp build | drill records |
| Play menu and walkthrough (stages `drilled`, `drafted`) | Practice Field camp build | the ledger |
| Proof, install, game-day record (stages `proven`, `installed`, `retired`) | later Practice Field builds | the ledger |

## 2. The situation registry

**Shape.** One zero-import, Node-clean module, following the precedent of `src/data/archetypeAdjustments.js`. Proposed path `src/data/situationRegistry.js`. Each entry: `{ id, version, title, definition, slots, playerCallable }`.

**Rules.**
- Every tag, card, drill and play carries `situationId` and `version`.
- A definition changes only by a PR that bumps `version`. Records written under an old version keep it.
- A tag is a fact, never a verdict (tape invariant 9). Its number class is `derived`.

**V1 entries.**

| id | State in V1 | playerCallable |
|---|---|---|
| `stalled` | defined below | no |
| `down` | id reserved, definition pending | yes (ruling 3: a cockpit button) |
| `good_lead` | id reserved, definition pending | yes |

**`stalled`, per holding, per check.**
- Recompute the platform's stagnation count from the tape, using the platform's own arithmetic (`updateStagnationCounter`, exported from `api/_utils/agentRiskManager.js`) over the price the agent was shown at each check (`checks[].evidence.px`).
- Take the thresholds from the registry adapter (`getArchetypeDefinition(codeId).physics.hftConfig.forcedRotation`, `api/_utils/archetypeRegistry.js`), never by importing the archetype table. Apply the battle's tempo dial (`api/_utils/tempoDialClamp.js`). Mirror the rule's tick-age guard.
- The situation is live when the count is at or above `ticksThreshold − S1`, the rule has not fired for that holding, and the holding is below the rule's winner threshold.
- For an archetype with forced rotation switched off, use slot S2.

**`down` and `good_lead` (reserved).**
- Against the CPU: `checks[].scores.total − checks[].scores.opponent`, after T1, with basis `cpu_portfolio`.
- In tournaments: the group standing at each day's close (T3), with basis `group_close`.
- When the player calls the situation from the cockpit, that call is itself a recorded fact and tags the check.
- Thresholds are slots S6–S8, unset.

## 3. Tape additions

| # | Addition | Class | Built |
|---|---|---|---|
| T1 | `checks[].scores.opponent`, with `opponentBasis ∈ cpu_portfolio \| none`. A tournament battle reads `none`, never a tie. Checks rebuilt from an evaluations entry carry null. | recorded | card build |
| T2 | Gameplan meeting outcomes, copied from the battle's meeting history as typed facts: the legs' symbols, `approved \| rejected \| expired`, and the instants. Any words follow the screen's Quotation rule. | recorded | card build |
| T3 | The owner's own group standing at each day's close in a tournament, copied from the banked daily scores. Scalars only, never a rival's holdings. | recorded | later, with `down` and `good_lead` |

Touch points for T1 are in Addendum A1 (`tapeAssemble.js` `scoresOf`, the declaration in `src/constants/filmTape.js`, the declaration golden and the screen fixtures). All are non-fenced. Tapes already written keep their stored declaration.

An opened-days record is **not** part of V1. On the player's own film only the agent's call counts (ruling 4), so it is not needed yet.

## 4. Tagger, counter and list

- **One pure function** over a tape day. Input: `checks[]`, `actions[]`, `series/*`. Output: tags `{ situationId, version, symbol, tickSeq, at }`.
- **Counter:** tags per situation per week. It is the Film Room's pattern counter and the camp's supply count.
- **List:** consecutive tagged checks form one moment. Moments are ordered by time spent in the situation, longest first (ruling 15). The list never says "hard" and is never ordered by outcome.
- **Hindsight rule:** the list and the drill show nothing that was only known afterwards.
- **Coverage rule:** a day with missing bars or partial coverage is listed as unavailable with its reason, and a drill refuses it.

## 5. The ledger

**Home.** A new subcollection, `agents/{agentId}/plays/{entryId}`. Server-only writes, owner read, dark behind its own flag with the cockpit allowlist. The write helper follows `api/_utils/hypothesisRecords/store.js`: idempotent operations and expected-version checks.

**Written once, at creation:** the archetype it was created under, `situationId` and `version`, the source moment (battle, day, checks), the player's question as a menu id, and the player's note in their own words.

**Stage (the only part that changes):**

`card → nominated → drilled → drafted → proven → installed → retired`

- **Shelved.** An entry whose archetype is not the agent's current archetype is shelved: kept, not shown as active, never installed. It is restored when the archetype returns (ruling 5).
- **A card's three routes.** *Watch:* the counter reports when the situation recurs, and the card can be shown to the player in the next game. *Drill:* nominate it for camp. *Set:* the player changes an existing setting themselves.
- **Play parts, added at `drafted`:** `situation`, `call`, `whoseCall ∈ agent | ask_first | player`, `wrongIf`, and `record` (counts, each with its number class).
- **Menus, not blank pages (ruling 4).** Every part is chosen from a versioned menu the camp builds from the drills. Each choice either maps to an existing control (an archetype menu move, a rule setting, a dial) or is marked `text_only`. `ask_first` is not offered until the cockpit can honour it (ruling 17).

## 6. The drill record (Practice Field)

- **Home:** `agents/{agentId}/drills/{drillId}`, server-written, owner read.
- **The agent's fresh call:** the stored request for that check, re-sent unchanged to the production model, validated with production's own validator (`api/_utils/agentEvalToolResultValidation.js`). It runs on its own key and limit and stops on a usage-limit error (rulings 9, 10). Only checks from the last 120 days can be asked.
- **The player's call:** recorded in the same shape. On the player's own film it carries `livedDay: true` and is not counted.
- **The reveal:** hold against swap, in points and in price, each number with its class, basis and time window.
  - A recorded swap uses the tape's replay as it stands (`api/_utils/filmTape/tapeReplay.js`).
  - A hold needs a what-if-we-had-swapped score, built with the same arithmetic. Candidates are limited to names whose bars the tape holds. Anything else reads `not_scored`.
  - The fenced scorer is imported, never copied.
  - Scores run from the price the agent was shown to the bar close at the horizon, and the screen states the quote delay.
- **Who was closer:** `agent | player | same | not_scored`. This is the camp's own derived number on the camp's own screen (ruling 8). It is never written to the tape.

## 7. One door

1. No ledger entry is read by any model prompt before stage `installed`.
2. Stages before `installed` are shown to the player only.
3. In V1 a play installs only through existing equip endpoints (a lean, a rule setting, a dial) and takes effect at the next battle's creation.
4. Plays that need prompt text, and enforced `ask_first`, wait for a later founder-gated build that touches protected files.
5. The Film Room's earlier route, where a Watch card entered the next deployment through the idea records, is closed. A player can still create an idea themselves.
6. The Agent Learning Charter sets the proof bar. This contract adds no weaker path.

## 8. Founder slots

| Slot | Meaning | Proposed |
|---|---|---|
| S1 | How many checks before the stagnation rule fires that `stalled` goes live | 2 |
| S2 | `stalled` thresholds for an archetype with the rule switched off | 6 checks at 0.30% |
| S3 | Drills in a counting camp | 10 |
| S4 | Counting camps per week | 1 |
| S5 | Playbook slots | 5 (3 fixed, 2 open) |
| S6–S8 | `down` and `good_lead` thresholds | unset |

## 9. Acceptance cases

- **A.** On the 9 Oct tape day, the weak holding is tagged `stalled` before the platform's stagnation exit at 15:01.
- **B.** Every recorded stagnation exit on a taped day is preceded by a `stalled` tag for that holding. Mismatches are counted and reported, never hidden.
- **C.** With entries at every stage before `installed`, the assembled trading prompt is byte-identical to one with an empty ledger.
- **D.** An archetype change shelves the entries. Changing back restores them.
- **E.** A tournament day shows `opponentBasis: none` and is never tagged `down`, `good_lead` or tied from a zero.
- **F.** A drill on a day with missing bars is refused with the reason shown.
- **G.** With the new flags off, tape output is unchanged except for the declared new fields.

## 10. Not decided here

- Moving watchlist creation out of the Forge (the Command Center redesign decides it).
- Whether archetypes can ever share plays or learning.
- A spending budget for the proof.
- An opened-days record, and the player's calls counting on their own film.
- League film and the daily call.
