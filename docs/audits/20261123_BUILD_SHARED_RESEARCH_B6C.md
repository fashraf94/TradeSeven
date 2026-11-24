# Shared Research "Work an idea" — B6c: the shelf and the agent for Explore Build 2 (build report)

**Date:** Mon Nov 23, 2026 · **Branch:** `claude/shared-research-b6c` (local, **not pushed**) · **Base:** `main` `56fd62d7` · **Code head:** `cd11eac1` · **Ships:** dark for players, except one line on the thesis saved screen.

> **STOPPED before the PR (§2.1).** The build is complete and committed locally. The full suite fails one row: Explore's own fixture guard, which pins the read's shape. Making it pass needs an edit under `src/components/Explore/`, which the prompt's STOP list forbids. The review also found two problems in the new saved-screen line that need rulings (§9, Q-3 and Q-4). Nothing is pushed and no PR is open.
**Build prompt:** "Shared Research 'Work an idea': B6c, the shelf and the agent for Explore Build 2" (Nov 23, 2026). Rulings X-8, X-9, X-10, Q-2 and the bound.

---

## 1. For the Explore chat

*Written to be read alone. Everything here is on `main` once this PR merges.*

### 1.1 The read's new fields

The read is the same: `GET /api/forge/shared-research?list=explore`, through `readExploreInvestigations()` in `src/services/sharedResearchService.js:74`. Same gate, auth, limiter and refusals as B6a §1.1. Every key it answered before keeps its value; three keys are new.

**The answer is now `{ quota, items, agent }`.**

**`items[].last` gains two keys** (X-8). `last` is now:

```
{ sessionId, ended: 'saved' | 'concluded', at,
  question,    // string | null
  statement }  // string | null
```

| Key | What it is | When it is `null` |
|---|---|---|
| `question` | The question the investigation was opened with: its research record's `question`. The session holds no question; the record does. | The record cannot be read: it is missing, or it is not the player's. |
| `statement` | For `ended: 'saved'`: the sentence the save recorded on the session (`adoption.statement`), exactly as saved. That is the player's edit when they edited it, else the composed sentence. | Always when `ended: 'concluded'`. And for a save that recorded none: an older-style idea save (the "ledger" sheet), or a thesis saved before B6a (Nov 21). |

**`agent` is new** (X-9):

```
agent: { id, name, equippedList: { id, name } | null } | null
```

| Key | What it is | When it is `null` |
|---|---|---|
| `agent` | The player's ranked agent: the same agent `open` uses. Never a training or casual clone, never another player's. | The player has no ranked agent. The read still answers 200 with `quota` and `items`. (An `open` without a ranked agent answers `503 attribution_unavailable`, as today.) |
| `agent.id` | The agent document's id: the one "Use it in my next game" equips. | never |
| `agent.name` | The agent's name, trimmed, at most 40 characters. | The name is blank. The sheet then says "your agent". |
| `agent.equippedList` | The BaggerBomb list the agent's next game carries: the stored BaggerBomb slot's list, or, while the slot is absent, the list from the League fields (the same rule every BaggerBomb deploy uses). | No list is equipped (no list id). |
| `agent.equippedList.id` | That list's watchlist id. | never (when `equippedList` is not null) |
| `agent.equippedList.name` | The name it was equipped with, trimmed. | The stored name is blank. |

**One real example** (the route on the test double: on one story a thesis was saved with the player's own edit; on a second story an investigation is open):

```json
{
  "quota": { "investigationsToday": 2, "perDay": 3, "framingsToday": 0, "framingsPerDay": 10, "stepsToday": 4, "stepsPerDay": 30 },
  "items": [
    {
      "itemRef": { "recordKind": "exploreStories", "recordId": "ai-power-2" },
      "itemVersion": 1,
      "open": { "sessionId": "bc887105-e4f3-4028-ab5d-9050e4a040b5", "question": "Which suppliers are short of transformers?", "lastTurnAt": null, "filled": 0, "parts": 6, "stepsLeft": 10, "findingsCount": 1 },
      "last": null
    },
    {
      "itemRef": { "recordKind": "exploreStories", "recordId": "ai-power-1" },
      "itemVersion": 3,
      "open": null,
      "last": {
        "sessionId": "dad1ce23-cbe4-47db-bf50-14fd711d420b",
        "ended": "saved",
        "at": "2026-11-24T00:36:27.197Z",
        "question": "Who earns when data centers wait on power gear?",
        "statement": "NVDA earns from GPUs and accelerators because it sells them to AI data centers. It's wrong if big buyers cut accelerator spending for two quarters. Positional · about 30 sessions."
      }
    }
  ],
  "agent": { "id": "agent-1", "name": "Atlas", "equippedList": { "id": "wl-bb", "name": "Grid builders" } }
}
```

**For the shelf ("Your theses"):** a finished investigation can now say its question and, when saved with a sentence, the sentence. When `statement` is `null` on a saved one, the shelf has only the date to show ("Thesis saved · {date}"), as before.

### 1.2 The new document bound

- **`EXPLORE_DOCS_MAX` is 221** (was 191), `api/_utils/sharedResearch/explore.js:62`. The 30 added are the records of last-ended investigations that the read's window does not hold, read by id. Those can only be sessions the completed query returned (at most `EXPLORE_ENDED_READ` = 30); a session found through the window has its record in the window.
- **Plus the agents query**, the one `open` already runs: every agent document the player owns, where `ownerId ==` the player. That is the ranked agent and any training or casual clones. **It has no limit, by owner, exactly as at `open`:** a limit could drop the ranked agent. A typical player has one to a few agent documents.
- No new index: the record reads are by id; the agents query is a single equality filter that `open` already runs in production.
- No write.

### 1.3 Q-2: what to pass from `agent`

Pass these three props to the sheet body, from the read's `agent`:

| Prop | Value |
|---|---|
| `agentId` | `agent?.id ?? null` |
| `agentName` | `agent?.name ?? null` |
| `equippedListLabel` | `agent?.equippedList?.name ?? null` |

**What the thesis saved screen then says** (X-10). The line sits just above "Use it in my next game":

| What Explore passes | The line |
|---|---|
| an agent whose list has a name, e.g. "Grid builders" | "Replaces Grid builders as your equipped list." |
| an agent with no list, or a list with a blank name | "This becomes your equipped list for your next game." |
| `agent: null` (so `agentId` is null) | no line and no button; the name reads "your agent" |

The second line is true whether or not a list is equipped, so it never claims there is none. After the player taps it, the screen says "Equipped for your next game" and the line goes.

**Two cases are open, pending rulings (§9):**
- **Q-3:** with per-game loadouts switched off (the kill switch), `equippedList` can name a stale BaggerBomb slot rather than the list that is actually replaced.
- **Q-4:** a reopened thesis that is already the equipped list still gets the line. From the hub it reads "Replaces Watchlist…", which is false.

Do not wire Q-2 in Explore until both are ruled.

---

## 2. Verdict

| Check | Result |
|---|---|
| The rulings | X-8, X-9 and X-10 built, each with its rows; Q-2 answered (§1.3); the bound is 221 plus the agents query (§1.2) |
| What players see when it merges | one line on the thesis builder's saved screen, above "Use it in my next game" (§4.3). Explore stays off; only the allowlist sees Work an idea |
| Additive only | every key answered before keeps its value; the B6a route rows hold with only the new keys added (§4.4) |
| The five sheet test files | **unedited**, at their baseline counts (156 · 37 · 34 · 38 · 27) |
| Full suite (Linux, `TZ=UTC`, 8 workers) at `cd11eac1` | **exit 1** · 1,656 files (1,655 passed, 1 failed) · **37,947 passed, 1 failed**, 197 skipped · 396 s. The one failure is the STOP (§2.1) |
| `lint:gate` · `test:rules` · minified build | **exit 0** · **exit 0** · **exit 0** |
| Mutants | **24 / 24** killed, each by its own row (§5) |
| Review | one honesty lens and one refuter; 6 findings. **2 important, confirmed, need rulings** (H-1 → Q-3, H-2 → Q-4); one confirmed divergence that needs a ruling (H-5 → Q-5); 3 routine, not yet applied while stopped (§6) |
| Bundle | only the lazy Shared Research chunk changes, **148,414 → 148,737 B (+323)** (§8) |

### 2.1 The STOP

**What fails.** `src/components/Explore/__fixtures__/exploreReads.test.js:121`, the row "matches the server's own shaping of its planted investigations".
- That file composes Explore's read fixtures with the server's own shaping (`exploreItemsOf`).
- It compares them with the committed `src/components/Explore/__fixtures__/exploreReads.json`. Its header says: "a server change that moves a shape reds this row".
- X-8 moved the shape, as ruled. The composed answer's three `last` objects (`saved`, `concluded`, `both`) gain `"question": null, "statement": null`, and nothing else differs (checked on Windows; the Linux run fails the same row).
- They are null there because the fixture's `readOf` passes only the open investigations' records, and its saved adoption carries no statement.

**Why it is a STOP.** The fix is to regenerate that JSON (`GENERATE_EXPLORE_FIXTURES=1 npx vitest run src/components/Explore/__fixtures__/exploreReads.test.js`), and that is a file under `src/components/Explore/`. Left as it is, this PR would turn `main` red. **Q-6** asks for the waiver (§9).

---

## 3. Base and preamble

1. **Branch.** `git fetch origin main`; `origin/main` was `56fd62d71a64f439598e3788e5dac77f05666a45` (the merge of #1107), which contains `e505f3b` (the merge of #1106, Explore Build 1). The session's worktree branch `claude/shared-research-b6c-shelf-agent-b2f7b4` was cut there; it is pushed as `claude/shared-research-b6c`.
2. **Confirmed in the code:**
   - A session's `adoption.statement` is written only by a thesis save. The one non-test writer of a session's `adoption` is `commitAdoption` (`api/_utils/sharedResearch/store.js:721`; the write at `:774`), which adds `adoptionExtra` only when given; only `adoptThesis` (`:869`) gives one (`:894`); `adoptIdea` (`:795`) calls it without (`:818`). VERIFIED (a repo-wide search for `adoption:` outside tests finds no other writer of the session's).
   - The session holds no question. `openSessionOf` (`session.js:217`) writes none; the record does (`buildRecord`'s `question`). The one question-shaped field on a session is `frame.question`, on an own-words session while it is framed (`session.js:369`); an Explore session never has a frame. VERIFIED.
   - `readRankedAgent` (`store.js:104`) is the rule `open` uses: `attributionIn` (`store.js:391`) runs the same `rankedAgentOfDocs` over the same query (`agentsQueryOf`, `store.js:102`, `ownerId ==`) inside its transaction and adds the owner check `agent.ownerId !== uid`. The read's shaping keeps that owner check (`store.js:243`). A parity row in `store.test.js` already pins `rankedAgentOfDocs` to `resolveRankedAgent`. VERIFIED.
   - `baggerbombLoadoutOf(agent).book` (`src/constants/perGameLoadout.js:83`) gives the stored slot's book, or, while the slot is absent, the default book from the League fields `equippedWatchlistId` / `equippedWatchlistName` (`:59`, `:67`). `bookIdOf(book)` (`:56`) is its list id, or null. VERIFIED.
3. **Baseline:** 47 Shared Research test files, **1,506 rows, all passing** (Windows, targeted). Per-file counts in §7. The two `*.browser.test.js` files need a real browser and are not in that run.
4. **No new index.** The new reads are documents by id (`researchWork/{id}`) and the agents query `open` already runs (`agents` where `ownerId ==`). VERIFIED against `firestore.indexes.json` (no change) and `store.js:102`.

No STOP condition was met: only additive keys; nothing that `open`, `step`, `card`, `adopt` or `close` sends, stores or answers changed; `Adopt.jsx` and the five sheet test files are unedited; no rule, index, flag, or file under `src/components/CommandCenter/` or `src/components/Explore/` changed; the read makes no write and no model or provider call.

---

## 4. The rulings, as built

### 4.1 X-8 — `last.question` and `last.statement`

**Built:**
- `api/_utils/sharedResearch/explore.js:147` `exploreLastOf(session, record)`: `question` is `record?.question ?? null` (`:153`, the same read `open.question` uses at `:125`); `statement` is the adoption's statement for a saved session when it is a non-empty string, else null (`:154`).
- `explore.js:179`: each item's `last` gets its record from the same map as `open`.
- `store.js:223`: that map now holds the records of the last-ended sessions too, taken from the window when there, else read by id, owner-checked (`isOwnedRecord`), exactly as the open ones'.
- `explore.js:62`: `EXPLORE_DOCS_MAX` = 221, with the reason in its doc comment.

| Rows (`api/forge/shared-research.b6c.route.test.js`) |
|---|
| a saved thesis on an Explore story, through the route (open, verify, map, names, why, wrong-if, time frame, adopt with the player's edit): `last` = `{ sessionId, ended: 'saved', at, question: Q1, statement: the edit }`; the session document holds no copy of the question |
| a saved thesis as composed: `statement` is the composed sentence the save recorded |
| the statement is the adoption's, never the card's sentence or the list's card: a recorded statement that differs from both is the one reported |
| the record in the window is taken from it (no by-id read); one pushed out of the window by 50 newer records is read by id, once, with the same answer |
| a concluded one (a real close): the question, `statement: null` |
| a concluded one never carries a statement, even beside a stray adoption field that is not a save |
| an older-style idea save (a real ledger save): the question, `statement: null`; the idea version holds its statement |
| a thesis saved before B6a (adoption without a statement; its list and version hold one): `statement: null` |
| a blank recorded statement: `null` |
| an unreadable record, missing and another player's: `question: null`; the session is still reported, with its statement |
| the question is the record's, never a session field or a frame question |
| the bound counted exactly: 221 documents with the quota, plus 1 agent document; 60 record reads by id (30 open, 30 last-ended); no write |
| pure: `exploreLastOf` with no record, and a concluded session |

### 4.2 X-9 — `agent`

**Built:**
- `store.js:242` `exploreAgentOf(agent, uid)`, pure: null without an agent or when it is not the caller's; else `{ id, name: partnerNameOf(agent), equippedList }`, the list from `baggerbombLoadoutOf(agent).book` (inside a `try`, as `attributionOf` reads it), `null` when `bookIdOf(book)` is null.
- `store.js:252` `readExploreAgent`: `exploreAgentOf(await readRankedAgent(db, uid), uid)`. One query.
- `api/forge/shared-research.js:164`: the two reads in parallel; the answer `{ quota, items, agent }`.

| Rows (`shared-research.b6c.route.test.js`) |
|---|
| a stored BaggerBomb slot holding a list: `{ id: 'agent-1', name: 'Atlas', equippedList: { id: 'wl-bb', name: 'Grid builders' } }` (the name trimmed), never the League fields' list; equal to `bookIdOf(baggerbombLoadoutOf(agent).book)` |
| the default slot: the list from the League fields |
| no list: a slot with no book, a default with no list, a book whose id is blank → `equippedList: null` |
| a list with an id and a blank name → `{ id, name: null }` |
| a blank agent name → `name: null` |
| training and casual clones are never chosen; with clones only, `null` |
| no ranked agent: `agent: null`, still 200 with the quota and the items |
| another player's agent never returned; the owner check in the shaping itself |
| it is `rankedAgentOfDocs`'s choice over the same documents |
| one agents query per read; no by-id agent read; no list read |
| no access: `404 disabled` before anything is read |

### 4.3 X-10 — the thesis saved screen says what equipping does

**Built:**
- `src/components/SharedResearch/SharedResearchSheetBody.jsx:221`: the body passes `equippedListLabel` to `Builder`.
- `screens/Builder.jsx:397`, `:423`: `Builder` takes it and passes it to `ThesisSaved`.
- `screens/ThesisSaved.jsx:48`: the label, trimmed; a blank one is no label.
- `screens/ThesisSaved.jsx:70`: where "Use it in my next game" is offered (`canEquip && eq.status === 'none'`), a line directly above it: `COPY.replaces(label)` with a label, else `COPY.becomesList`.
- `sharedResearchCopy.js:424`: `becomesList: 'This becomes your equipped list for your next game.'` It passes the copy guard's banned lists.
- **`screens/Adopt.jsx` is unchanged** (the older idea screen keeps "You have no equipped list; this would become it for your next game.").

**Routine choice:** the line shows only while the offer does (`eq.status === 'none'`), as on the idea screen. Once equipping runs, is done or has failed, the screen shows its own line ("Equipping…", "Equipped for your next game", "Saved, not equipped.").

| Rows (`src/components/SharedResearch/SharedResearchSheetBody.b6c.jsdom.test.jsx`) |
|---|
| with a label: "Replaces Grid builders as your equipped list.", the button's sibling directly above it |
| with none (null, absent, `''`, blank): "This becomes your equipped list for your next game."; nothing says there is no list |
| no `agentId` (null, absent, `''`): neither the line nor the button |
| once equipped: "Equipped for your next game", no line; the equip calls are the existing ones, unchanged |
| right after a save on this page (one adopt sent), not only on a reopened thesis |
| from the hub's props: the label `equippedListLabelOf` computes (the BaggerBomb card's book) is the one named; before the agent is read, the plain line |
| from Explore's props (Q-2), built from the server's own `exploreAgentOf`: a named list → the replaces line, and equip targets the read's agent; no list or a blank name → the plain line; `agent: null` → no line, no button, "your agent" |
| the older idea screen: with a label, the replaces line; with none, its own "no equipped list" line, never the thesis screen's |

The equip flow's existing rows (`SharedResearchSheetBody.builder.jsdom.test.jsx`, `.flows.jsdom.test.jsx`) pass unedited.

### 4.4 The B6a route rows: only the new keys added

`api/forge/shared-research.b6a.route.test.js` pinned `last` and the answer's keys exactly, so 11 of its 29 rows failed against the new answer, each only for the new keys or the new count. They were edited **only** to add those (every value they pinned before is unchanged):

| Row | Edit |
|---|---|
| no investigations | the keys `['quota', 'items']` → `['quota', 'items', 'agent']` |
| one concluded · one saved (ledger) · an open one and an earlier closed one (2 assertions) · two ended on one story · newest first past the bounds · an Explore save pushed out of the window · an open one the query left out · a session saved before B6a | `last` gains `question` and `statement` |
| the document bound | 191 → 221; documents counted = `EXPLORE_DOCS_MAX + 1` (the seed's one agent); the title names the agents query |
| FantasyTimes and own-words not listed | documents counted `1 + 3` → `1 + 3 + 1` (the agent) |

B6a's FantasyTimes parity test (`shared-research.b6a.ftParity.test.js`) is unedited and green: it drives `open`, `step`, the preview and `adopt`, none of which changed.

---

## 5. The mutation table

Each mutant was applied to the code head in the worktree, its test file run with a JSON report, and the file restored byte for byte (checked after every run). **24 / 24 killed**; each fails the row named for it (plus, where listed, others).

| Id | Mutant | Row that kills it | Rows failed |
|---|---|---|---|
| M1 | `statement` taken from the composed sentence (the card) | a saved thesis on an Explore story (the edit) | 6 |
| M2 | `statement` taken from the list's saved card (`thesisCard.statement`) | a thesis saved before B6a | 5 |
| M3 | a concluded `last` carries a statement (the `saved` guard dropped) | a concluded one never carries a statement | 1 |
| M4a | `question` taken from the session (its frame, a session field) before the record | the question is the record's | 1 |
| M4b | `question` taken from the story (the record's opening finding, the title) | a saved thesis on an Explore story | 10 |
| M5 | a clone chosen as the agent (the query's first document) | training and casual clones are never chosen | 2 |
| M6 | `equippedList` built when the book has no id | no list: `equippedList` null | 1 |
| M7 | the new line says there is no list (`COPY.noList`) | with none | 3 |
| M8 | the replaces line shown without a label | with none | 3 |
| M9a | the line and button shown without an `agentId` (`canEquip` drops the agent) | no `agentId` | 2 |
| M9b | the line shown without an `agentId` (its own guard dropped) | no `agentId` | 2 |
| M10 | the older idea screen changed (its `noList` swapped for the new line) | the older idea screen | 1 |
| M11 | the owner check dropped from the agent's shaping | another player's agent is never returned | 1 |
| M12 | the agent's raw name instead of `partnerNameOf` | a blank name | 1 |
| M13 | the list's name not trimmed | a stored BaggerBomb slot holding a list | 4 |
| M14 | the League fields' list instead of the BaggerBomb loadout's | a stored BaggerBomb slot holding a list | 5 |
| M15 | a last-ended record taken from the window only, never read by id | the record in the window / read by id | 2 |
| M16 | the bound not grown (191) | the bound counted exactly | 1 |
| M17 | `Builder` does not pass the label to the saved screen | with a label | 4 |
| M18 | the body does not pass the label to `Builder` | with a label | 4 |
| M19 | the line drawn below the button | with a label (the line directly above the button) | 4 |
| M20 | the answer without `agent` | no ranked agent (the answer's keys) | 9 |
| M21 | a blank label taken as a label | with none (`'   '`) | 1 |
| M22 | a blank recorded statement reported | a blank recorded statement is no statement | 1 |

The battery ran at `cd11eac1` against the two new test files, on Windows. It covers every mutant the prompt named:
- the statement from the composed sentence (M1) or from the list's card (M2);
- a concluded `last` carrying a statement (M3);
- the question from the session (M4a) or the story (M4b);
- a clone chosen (M5);
- `equippedList` built with no id (M6);
- the new line saying there is no list (M7);
- the replaces line shown without a label (M8);
- the line or the button shown without an `agentId` (M9a, M9b);
- the older idea screen changed (M10).

M11–M22 are this build's own.

---

## 6. The review (BUILD_RULES §2)

### 6.1 How it ran

The cumulative diff is **11 files, +759 / −39** (12 with this report). That passes the 10-file threshold, so §2 applies.
- **The honesty lens:** what the read and the saved screen claim, and whether each claim holds in every state.
- **One refuter:** handed every finding and told to refute it with a trace.
- **Isolation:** each reviewer read its own LF `git archive` extraction of `cd11eac1` under the session scratchpad, read-only. Neither wrote a file or ran git.
- **One round**, as the prompt set. The explicit `vite build` is in §7.

### 6.2 Findings and verdicts

| Id | Finding | Refuter | Disposition |
|---|---|---|---|
| **H-1** | **With per-game loadouts switched off, `equippedList` can name the wrong list.** `PER_GAME_LOADOUT_ENABLED` (`src/config/perGameLoadoutFlags.js:39`) is a kill switch with a written rollback. With it off, equip writes the League fields (`api/agent/equip-watchlist.js:160`), and a deploy carries them (`api/_utils/casualClone.js:83`, `:120`). A stored `loadouts.baggerbomb` slot left from flag-on time still wins in `baggerbombLoadoutOf`, so the read would report the stale slot's list, and the screen would say "Replaces {that list}". The list actually replaced is the League one. The hub's label switches by scope and is right. | **CONFIRMED**, introduced by this diff. Latent today: Explore passes `agentId={null}` (`ExploreSheetHost.jsx:244-246`), the flag is on, and the hub is unaffected. | **Ruling needed (Q-3):** the build follows X-9's explicit source, `baggerbombLoadoutOf(agent).book`. |
| **H-2** | **A reopened thesis that is already the equipped list still gets the line.** Shared Research lists are written with `name: ''` (`api/_utils/sharedResearch/store.js:752`). Reopening resets equip to `'none'` (`src/components/SharedResearch/useSharedResearch.js:172`). So after saving thesis T, equipping it, and reopening T, the line shows again: from the hub "Replaces Watchlist as your equipped list." (the `'Watchlist'` fallback, `hubCopy.js:363`), which is **false**, since T would replace itself; from Explore "This becomes your equipped list…", which is misleading. The button was offered in that state before this diff (re-equip is a harmless no-op); the claim is new. | **CONFIRMED**, introduced by this diff (the words; the offer is older). | **Ruling needed (Q-4):** detecting the case needs a new prop (the equipped list's id). |
| H-3 | **Test rows that could pass with a claim false.** (i) The "readRankedAgent's choice" row is weak, not tautological: its seed order catches a different choice at the route, but not a fault inside `rankedAgentOfDocs`, which the clone rows cover. (ii) No row covers H-1 or H-2. (iii) The bound row pairs question to statement only for the 30 saved sessions, not the 50 window ones. (iv) The jsdom header says the label comes "from Explore's props", though Explore passes null today and the rows use a local helper. | **PARTLY**: (i) weak, not a tautology; (ii)–(iv) hold. | Routine. Not applied while stopped; folded into the fix round with the rulings. |
| H-4 | The Retry offer after a failed equip has no line above it. | **CONFIRMED**, a nit. The older idea screen has the same pattern, and the player saw the line before the first attempt. | Kept as built unless you rule otherwise. |
| **H-5** | **`equippedList.name` is the name stored at equip time.** A list returned to draft (`uncommit` has no equipped guard), renamed and recommitted keeps its old name in the agent's book, so Explore would say "Replaces {old name}". The hub prefers the committed list's current name. For Shared Research lists the stored name is `''`, so the plain line shows. | **CONFIRMED** as a divergence, introduced by this diff. | **Ruling needed (Q-5):** fixing it means reading the list, which breaks X-9's "nothing else is read for it" and the bound. |
| H-6 | **A failing agents query now fails the whole Explore read.** The two reads run under `Promise.all` (`api/forge/shared-research.js:164`), so an agents-query error answers 500 where the read answered before. The doc's "Never refuses" means no refusal and no agent → null, which is true. | **PARTLY**: the new failure point is real, the words are not false, and the read's other queries could already fail it. | Routine: the doc comment will say an I/O error still fails the read. Catching the error into null would hide equip, so it is not proposed. |

The refuter also noticed that the owner check in `exploreAgentOf` is redundant with the `ownerId ==` query (kept, as `attributionIn` keeps it), and that the `try` around `baggerbombLoadoutOf` cannot fire (kept, as `attributionOf` has it).

**Split:** 4 CONFIRMED (H-1, H-2, H-4, H-5) · 2 PARTLY (H-3, H-6) · 0 REFUTED.

---

## 7. The checks

Run on Linux (WSL) in a private worktree of `~/pd-ci` at `cd11eac1` (`/home/flashash/pd-ci-b6c`). `node_modules` is linked to an install of the same lockfile (`e457c10d0317`, checked inside WSL); Node 20.20.2. I read every exit code myself.

| Check | Result |
|---|---|
| Full suite (`TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`) | **exit 1** · Test Files 1,655 passed, 1 failed (1,656) · Tests **37,947 passed, 1 failed**, 197 skipped · 396 s. The failure is §2.1, and nothing else failed |
| `lint:gate` | **exit 0** |
| `test:rules` (Firestore emulator, JDK 21) | **exit 0** · 246 s |
| Minified `vite build`, head and `main` `56fd62d7` | **exit 0** both |

**The Shared Research files** (Windows, targeted, against the preamble's baseline). Every file existing before passes at its baseline count; 47 files, 1,506 → 1,506.

| File | Baseline | Now |
|---|---|---|
| `SharedResearchSheetBody.b6a.jsdom.test.jsx` (**unedited**) | 27 | 27 |
| `SharedResearchSheetBody.builder.jsdom.test.jsx` (**unedited**) | 156 | 156 |
| `SharedResearchSheetBody.flows.jsdom.test.jsx` (**unedited**) | 37 | 37 |
| `SharedResearchSheetBody.review.jsdom.test.jsx` (**unedited**) | 34 | 34 |
| `SharedResearchSheetBody.states.jsdom.test.jsx` (**unedited**) | 38 | 38 |
| `useSharedResearch.uncertain.jsdom.test.jsx` (**unedited**) | 2 | 2 |
| `shared-research.b6a.route.test.js` (additive keys only, §4.4) | 29 | 29 |
| `shared-research.b6a.ftParity.test.js` (**unedited**) | 2 | 2 |
| `sharedResearchCopy.guard.test.js` (the new line passes it) | 28 | 28 |
| every other Shared Research file (38) | 1,153 | 1,153 |
| **New:** `shared-research.b6c.route.test.js` · `SharedResearchSheetBody.b6c.jsdom.test.jsx` | — | 24 · 10 |

The Linux suite gives the same counts for each of these files.

**Byte-identical to `main`:** `screens/Adopt.jsx`, the five sheet test files and their fixtures, everything under `src/components/CommandCenter/` and `src/components/Explore/`, `firestore.rules`, `firestore.indexes.json` and `src/config/`.

---

## 8. The bundle diff

Minified `vite build` of the code head and of `main` `56fd62d7`, each in its own WSL worktree of `~/pd-ci` on the same install (lockfile `e457c10d0317`, Node 20.20.2), compared file by file with the 8-character content hashes masked.

- **The one content change:** the lazy Shared Research chunk, `SharedResearchSheetBody-*.js`, **148,414 → 148,737 B (+323)**: the new prop threaded through `Builder` to `ThesisSaved`, the line, and the new copy string.
- **The entry chunk** (`index-*.js`, 5,094,925 B) is equal once the lazy chunk's hashed name inside it is masked. The second `index-*.js` (615,045 B) has the same name and the same bytes. 108 files differ only in the hashed names they import; 10 are byte-identical. `index.html` is equal masked.
- **CSS:** `index-DXxojBT9.css` is the same file on both.
- **`sharedResearchService-*.js`** (1,833 B) differs only in its hashed name: the service's change is a doc comment. Its source map grows by the comment.
- The server files (`api/`) are not in the client bundle.

If the rulings below change client code, the bundle diff will be re-run on the final head.

---

## 9. Questions for the founder

**Q-6 (the STOP). May this PR regenerate Explore's read fixture?**
- **The change:** only `src/components/Explore/__fixtures__/exploreReads.json`, regenerated by its own command. Three `last` objects gain `"question": null, "statement": null`. No Explore code and no Explore test file change.
- **Recommendation: yes.** The file is generated, not hand-written, and its own header asks for regeneration after a deliberate server change. Without it this PR turns `main` red.
- **Alternative:** Explore Build 2 regenerates it. It would then have to merge before or together with this PR.

**Q-3 (H-1). Should `agent.equippedList` follow the per-game loadout switch?**
- **As built:** `baggerbombLoadoutOf(agent).book`, as X-9 rules. That is right while `PER_GAME_LOADOUT_ENABLED` is true, as it is today.
- **The problem:** if the switch is turned off (its written rollback), a stale BaggerBomb slot would be reported while the list actually replaced is the League one.
- **Recommendation:** read the switch, as every other loadout caller does: `PER_GAME_LOADOUT_ENABLED ? baggerbombLoadoutOf(agent).book : leagueLoadoutOf(agent).book`. That is a one-line change and a flag-off row; the flag itself is not changed. The hub's label already switches the same way.

**Q-4 (H-2). What should the saved screen say when the thesis is already the equipped list?**
- **The problem:** today the line shows and, from the hub, says "Replaces Watchlist as your equipped list.", which is false.
- **Recommendation:** add an optional prop `equippedListId` beside `equippedListLabel`. When it equals the saved thesis's list, show "Equipped for your next game" with no offer and no line.
  - The hub would pass `cards.baggerbomb.book.id`. **That is an edit under `src/components/CommandCenter/`**, so it needs your waiver too.
  - Explore would pass `agent.equippedList?.id ?? null`, which the read already carries.
- **Without the hub edit:** the sheet half could land now, inert for the hub until a hub PR passes the id. The hub's "Replaces Watchlist" would stay false meanwhile.
- **Alternative:** drop the line for the hub (no label → the plain line), which avoids the false sentence but loses the list name.

**Q-5 (H-5). Should `equippedList.name` be the list's current name?**
- **As built:** the name stored on the agent's book when the list was equipped, as X-9 rules.
- **The problem:** a list returned to draft, renamed and recommitted while equipped keeps its old name there. The hub shows the current name.
- **Recommendation: keep it as ruled.** Reading the list would add a read per call, break "nothing else is read for it", and grow the bound. The case needs an uncommit and a rename of an equipped list. Shared Research's own lists have no name, so they show the plain line either way.

**Routine, to fold into the fix round with the rulings:**
- the H-3 test gaps: a route row comparing the read's agent with the one `open` stamps; question-to-session pairing for every `last` in the bound row; the jsdom header's wording; rows for Q-3 and Q-4 as ruled;
- the H-6 doc wording.

H-4 is kept as built unless you rule otherwise.

---

## 10. The PR description

Not opened: the build stopped before the PR (§2.1). The description will be written on the final head after the rulings.
