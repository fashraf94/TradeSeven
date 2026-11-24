# Shared Research "Work an idea" — B6c: the shelf and the agent for Explore Build 2 (build report)

**Date:** Mon Nov 23, 2026 · **Branch:** `claude/shared-research-b6c` · **Base:** `main` `56fd62d7`, with `main` `190b5e63` (#1108) merged in before the final checks · **Code head:** `6d1ec099` · **Ships:** dark for players, except the thesis saved screen's line about equipping.
**Build prompt:** "Shared Research 'Work an idea': B6c, the shelf and the agent for Explore Build 2" (Nov 23, 2026): rulings X-8, X-9, X-10, Q-2 and the bound. **The founder's rulings on the STOP (Nov 23):** Q-6 (regenerate Explore's read fixture), Q-3 (the list follows the per-game loadout switch), Q-4 (the saved-session read carries `equippedList`), Q-5 (keep the stored name), and the three routine review fixes. All built (§4.5–§4.8).

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
| `agent` | The player's ranked agent: the same agent `open` uses and stamps on an investigation. Never a training or casual clone, never another player's. | The player has no ranked agent. The read still answers 200 with `quota` and `items`. (An `open` without a ranked agent answers `503 attribution_unavailable`, as today.) |
| `agent.id` | The agent document's id: the one "Use it in my next game" equips. | never |
| `agent.name` | The agent's name, trimmed, at most 40 characters. | The name is blank. The sheet then says "your agent". |
| `agent.equippedList` | The list "Use it in my next game" would replace. While per-game loadouts are on (as today): the BaggerBomb loadout's list, from the stored BaggerBomb slot or, while the slot is absent, from the League fields. If the per-game loadout switch is turned off (its kill switch): the League list, the ranked record's own fields, since that is then what equip replaces (the founder's Q-3). | No list is equipped (no list id). |
| `agent.equippedList.id` | That list's watchlist id. | never (when `equippedList` is not null) |
| `agent.equippedList.name` | The name stored on the agent when the list was equipped, trimmed. A list renamed later keeps its old name here (the founder's Q-5: kept so). | The stored name is blank. Shared Research's own lists are stored without a name, so a saved thesis that is equipped reads `name: null`. |

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

**Your fixture moved (the founder's Q-6).** `src/components/Explore/__fixtures__/exploreReads.json` was regenerated with its own command (`GENERATE_EXPLORE_FIXTURES=1 npx vitest run src/components/Explore/__fixtures__/exploreReads.test.js`). Its guard composes the fixture with the server's own shaping and failed once `last` gained its two keys.
- The only change: each `last` (in `saved`, `concluded` and `both`) gains `"question": null, "statement": null`.
- They are null because the fixture's `readOf` passes only the open investigations' records, and its saved adoption carries no statement. Explore Build 2 may want its `readOf` to pass the last-ended records as well, so the fixture carries real questions.
- **Nothing else under `src/components/Explore/` changed.** `agent` is not in the fixture: `readOf` composes only `{ quota, items }`.

### 1.2 The new document bound

- **`EXPLORE_DOCS_MAX` is 221** (was 191), `api/_utils/sharedResearch/explore.js:62`. The 30 added are the records of last-ended investigations that the read's window does not hold, read by id. Those can only be sessions the completed query returned (at most `EXPLORE_ENDED_READ` = 30); a session found through the window has its record in the window.
- **Plus the agents query**, the one `open` already runs: every agent document the player owns, where `ownerId ==` the player. That is the ranked agent and any training or casual clones. **It has no limit, by owner, exactly as at `open`:** a limit could drop the ranked agent. A typical player has one to a few agent documents.
- No new index: the record reads are by id; the agents query is a single equality filter that `open` already runs in production.
- No write. A failing agents query fails the whole read (500), as any of its reads would.

### 1.3 Q-2: what to pass from `agent`

**The hold is lifted.** Once this merges, Explore may pass, from the read's `agent`:

| Prop | Value |
|---|---|
| `agentId` | `agent?.id ?? null` |
| `agentName` | `agent?.name ?? null` |
| `equippedListLabel` | optional: `agent?.equippedList?.name ?? null`. The saved screen no longer depends on it (below), but it is a harmless fallback. |

**What the thesis saved screen says** (X-10, with the founder's Q-4). When the sheet opens a saved thesis, its own read (`GET ?sessionId=`) now carries the list equipping would replace, and the screen uses that first. It is the same rule as `agent.equippedList`, read at that moment. The line sits just above "Use it in my next game":

| What the server says | The screen |
|---|---|
| the equipped list is this thesis's own list | "Equipped for your next game", and no button |
| another list, with a name, e.g. "Grid builders" | "Replaces Grid builders as your equipped list." |
| another list, with no name | "Replaces your equipped list." |
| none equipped (`null`) | "This becomes your equipped list for your next game." |
| `agentId` not passed (null) | no line, no button, and no "Equipped" line; the name reads "your agent" |

Only when the sheet's answer carries no `equippedList` key does the `equippedListLabel` prop decide, as X-10 built it. That happens only for a moment right after a save, before the read that follows the save returns. After the player taps the button, the screen says "Equipped for your next game" and the line goes.

**The new key on the session read**, for anyone reading it directly: `GET /api/forge/shared-research?sessionId=` on a **saved thesis-builder** session adds `equippedList: { id, name } | null` as its last key. It costs one agents query, run only in that case. Every other answer (an open or concluded thesis, any idea-ledger investigation) is unchanged, with no agents query.

---

## 2. Verdict

| Check | Result |
|---|---|
| The rulings | X-8, X-9, X-10 built, each with its rows; Q-2 answered and the hold lifted (§1.3); the bound is 221 plus the agents query (§1.2) |
| The founder's rulings (Nov 23) | Q-6 fixture regenerated, nothing else under Explore; Q-3 and Q-4 built with rows from both doors; Q-5 kept; the three routine review fixes applied (§4.5–§4.8) |
| What players see when it merges | the thesis builder's saved screen says what "Use it in my next game" does, or that the thesis is already equipped (§4.3, §4.6). Explore stays off; only the allowlist sees Work an idea |
| Additive only | every key answered before keeps its value; the B6a route rows hold with only the new keys added (§4.4). The session read adds its key only on a saved thesis |
| The five sheet test files | **unedited**, at their baseline counts (b6a 27 · builder 156 · flows 37 · review 34 · states 38) |
| Full suite (Linux, `TZ=UTC`, 8 workers) at `6d1ec099` | **exit 0** · 1,663 files · **38,067 passed, 0 failed**, 197 skipped · 462 s |
| `lint:gate` · `test:rules` · minified build | **exit 0** · **exit 0** (48 files, 889 passed) · **exit 0** |
| Mutants | **41 / 41** killed at the final code, each by its own row (§5) |
| Review | one honesty lens and one refuter, 6 findings: 4 confirmed, 2 partly, 0 refuted. The three needing rulings are built as ruled; the three routine ones are fixed (§6) |
| Bundle | only the lazy Shared Research chunk changes, **148,414 → 149,209 B (+795)** (§8) |

### 2.1 The STOP, and how it closed

**The STOP** (first suite run, at `cd11eac1`).
- **What failed:** one row, `src/components/Explore/__fixtures__/exploreReads.test.js` "matches the server's own shaping of its planted investigations". It composes Explore's read fixtures with the server's shaping and compares them with the committed JSON.
- **Why:** X-8's two new keys were missing from the JSON.
- **Why it was a STOP:** the fix is an edit under `src/components/Explore/`. I stopped before pushing, with the review's three questions.

**The founder's ruling (Nov 23), Q-6:** regenerate the fixture with its own command, and nothing else under Explore. Done in `a174d75c`: three `last` objects gain the two keys, and nothing else moves (§1.1).

---

## 3. Base and preamble

1. **Branch.** `git fetch origin main`; `origin/main` was `56fd62d71a64f439598e3788e5dac77f05666a45` (the merge of #1107), which contains `e505f3b` (the merge of #1106, Explore Build 1). The session's worktree branch `claude/shared-research-b6c-shelf-agent-b2f7b4` was cut there and is pushed as `claude/shared-research-b6c`. Before the final checks, `main` had moved to `190b5e63` (#1108, Practice Field B2). It touches none of this build's files and no lockfile, and it was merged in (`6d1ec099`), so the checks ran on the tree CI tests.
2. **Confirmed in the code** (all VERIFIED):
   - **A session's `adoption.statement` is written only by a thesis save.** The one non-test writer of a session's `adoption` is `commitAdoption` (`api/_utils/sharedResearch/store.js:721`, the write at `:774`). It adds `adoptionExtra` only when given, and only `adoptThesis` (`:869`) gives one (`:894`); `adoptIdea` (`:795`) calls it without (`:818`). A repo-wide search for `adoption:` outside tests finds no other writer of the session's. *(Lines as at `cd11eac1`.)*
   - **The session holds no question.** `openSessionOf` (`session.js:217`) writes none; the record does (`buildRecord`'s `question`). The one question-shaped field on a session is `frame.question`, on an own-words session while it is framed (`session.js:369`); an Explore session never has a frame.
   - **`readRankedAgent` (`store.js:104`) is the rule `open` uses.** `attributionIn` runs the same `rankedAgentOfDocs` over the same query (`agentsQueryOf`, `ownerId ==`) inside its transaction and adds the owner check `agent.ownerId !== uid`. The read's shaping keeps that check (`store.js:259`). A parity row in `store.test.js` pins `rankedAgentOfDocs` to `resolveRankedAgent`, and a new row (§4.8) pins the read's agent to the one `open` stamps.
   - **`baggerbombLoadoutOf(agent).book`** (`src/constants/perGameLoadout.js:83`) gives the stored slot's book or, while the slot is absent, the default from the League fields (`:59`, `:67`). `bookIdOf(book)` (`:56`) is its list id or null.
3. **Baseline:** 47 Shared Research test files, **1,506 rows, all passing** (Windows, targeted). Per-file counts are in §7. The two `*.browser.test.js` files need a real browser and are not in that run.
4. **No new index.** The new reads are documents by id (`researchWork/{id}`) and the agents query `open` already runs (`agents` where `ownerId ==`). `firestore.indexes.json` is unchanged.

**No STOP line is crossed in the final diff:**
- only additive keys;
- nothing that `open`, `step`, `card`, `adopt` or `close` sends, stores or answers changed;
- `Adopt.jsx` and the five sheet test files are unedited;
- no rule, index or flag value changed;
- nothing under `src/components/CommandCenter/` changed;
- under `src/components/Explore/`, only the fixture the founder's Q-6 allowed;
- no read makes a write, and none makes a model or provider call.

---

## 4. The rulings, as built

### 4.1 X-8 — `last.question` and `last.statement`

**Built:**
- `api/_utils/sharedResearch/explore.js:147` `exploreLastOf(session, record)`: `question` is `record?.question ?? null` (the same read `open.question` uses); `statement` is the adoption's statement for a saved session when it is a non-empty string, else null.
- `explore.js:179`: each item's `last` gets its record from the same map as `open`.
- `store.js:225`: that map now holds the records of the last-ended sessions too, taken from the window when there, else read by id, owner-checked (`isOwnedRecord`), exactly as the open ones'.
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
| the bound counted exactly: 221 documents with the quota, plus 1 agent document; 60 record reads by id (30 open, 30 last-ended); every `last`'s question is its own session's record's; no write |
| pure: `exploreLastOf` with no record, and a concluded session |

### 4.2 X-9 — `agent`

**Built:**
- `store.js:242` `equippedListOf(agent)`, pure: the book's list id and trimmed name, or null with no id (switch-aware since Q-3, §4.5).
- `store.js:258` `exploreAgentOf(agent, uid)`, pure: null without an agent or when it is not the caller's; else `{ id, name: partnerNameOf(agent), equippedList: equippedListOf(agent) }`.
- `store.js:268` `readExploreAgent`: `exploreAgentOf(await readRankedAgent(db, uid), uid)`. One query.
- `api/forge/shared-research.js:167`: the two reads in parallel; the answer is `{ quota, items, agent }`.

| Rows (`shared-research.b6c.route.test.js`) |
|---|
| a stored BaggerBomb slot holding a list: `{ id: 'agent-1', name: 'Atlas', equippedList: { id: 'wl-bb', name: 'Grid builders' } }` (the name trimmed), never the League fields' list while the switch is on; equal to `bookIdOf(baggerbombLoadoutOf(agent).book)` |
| the default slot: the list from the League fields |
| no list: a slot with no book, a default with no list, a book whose id is blank → `equippedList: null` |
| a list with an id and a blank name → `{ id, name: null }` |
| a blank agent name → `name: null` |
| training and casual clones are never chosen; with clones only, `null` |
| no ranked agent: `agent: null`, still 200 with the quota and the items |
| another player's agent is never returned; the owner check is in the shaping itself |
| it is `rankedAgentOfDocs`'s choice over the same documents |
| it is the agent `open` stamps: an investigation opened through the route carries the read's agent id (review H-3 i) |
| one agents query per read; no by-id agent read; no list read |
| no access: `404 disabled` before anything is read |

### 4.3 X-10 — the thesis saved screen says what equipping does

**Built:**
- `src/components/SharedResearch/SharedResearchSheetBody.jsx:221`: the body passes `equippedListLabel` to `Builder`.
- `screens/Builder.jsx:397`, `:423`: `Builder` takes it and passes it to `ThesisSaved`.
- `screens/ThesisSaved.jsx:59`: the label, trimmed; a blank one is no label.
- `screens/ThesisSaved.jsx:85`: where "Use it in my next game" is offered (`canEquip && eq.status === 'none'`), a line directly above it (its text from Q-4's order, §4.6).
- `sharedResearchCopy.js:424`: `becomesList: 'This becomes your equipped list for your next game.'`. It passes the copy guard's banned lists.
- **`screens/Adopt.jsx` is unchanged.** The older idea screen keeps "You have no equipped list; this would become it for your next game."

**Routine choice:** the line shows only while the offer does (`eq.status === 'none'`), as on the idea screen. Once equipping runs, is done or has failed, the screen shows its own line ("Equipping…", "Equipped for your next game", "Saved, not equipped."). After a failed equip, the Retry carries no line (review H-4; the idea screen's pattern).

| Rows (`src/components/SharedResearch/SharedResearchSheetBody.b6c.jsdom.test.jsx`) |
|---|
| with a label: "Replaces Grid builders as your equipped list.", the button's sibling directly above it |
| with none (null, absent, `''`, blank): "This becomes your equipped list for your next game."; nothing says there is no list |
| no `agentId` (null, absent, `''`): neither the line nor the button |
| once equipped: "Equipped for your next game", no line; the equip calls are the existing ones, unchanged |
| right after a save on this page (one adopt sent), not only on a reopened thesis |
| in the hub's prop shape: the label `equippedListLabelOf` computes (the BaggerBomb card's book) is the one named; before the agent is read, the plain line |
| in Explore's prop shape (Q-2), built from the server's own `exploreAgentOf`: a named list → the replaces line, and equip targets the read's agent; no list or a blank name → the plain line; `agent: null` → no line, no button, "your agent" |
| the older idea screen: with a label, the replaces line; with none, its own "no equipped list" line, never the thesis screen's |

The equip flow's existing rows (`SharedResearchSheetBody.builder.jsdom.test.jsx`, `.flows.jsdom.test.jsx`) pass unedited.

### 4.4 The B6a route rows: only the new keys added

`api/forge/shared-research.b6a.route.test.js` pinned `last` and the answer's keys exactly, so 11 of its 29 rows failed against the new answer, each only for the new keys or the new count. They were edited **only** to add those; every value they pinned before is unchanged.

| Row | Edit |
|---|---|
| no investigations | the keys `['quota', 'items']` → `['quota', 'items', 'agent']` |
| one concluded · one saved (ledger) · an open one and an earlier closed one (2 assertions) · two ended on one story · newest first past the bounds · an Explore save pushed out of the window · an open one the query left out · a session saved before B6a | `last` gains `question` and `statement` |
| the document bound | 191 → 221; documents counted = `EXPLORE_DOCS_MAX + 1` (the seed's one agent); the title names the agents query |
| FantasyTimes and own-words not listed | documents counted `1 + 3` → `1 + 3 + 1` (the agent) |

B6a's FantasyTimes parity test (`shared-research.b6a.ftParity.test.js`) is unedited and green. It drives `open`, `step`, the preview and `adopt`, none of which changed. Its GET reads are of a ledger, which carries no new key.

### 4.5 Q-3 — the list follows the per-game loadout switch

**The ruling:** `equippedList` follows `PER_GAME_LOADOUT_ENABLED`, read at call time. On, the BaggerBomb slot's book; off, the League book (the ranked record's own fields), since that is what the equip step then replaces.

**Built:**
- `store.js:244`, inside `equippedListOf`: `(PER_GAME_LOADOUT_ENABLED ? baggerbombLoadoutOf(agent) : leagueLoadoutOf(agent))?.book`. This is the same choice the equip writer makes (`api/agent/equip-watchlist.js:160`). The flag is imported (`store.js:38`) and read inside the function on every call; its value is not changed.
- `src/config/perGameLoadoutFlags.test.js:124`: the flag's reader census ("every read, exact" / "nothing else under api/ or src/ reads it") records the new read, in the same commit. This is a pin, not a flag value.

| Rows (`shared-research.b6c.route.test.js`, the flag mocked with a getter) |
|---|
| on: the slot's book; off: the League book; flipped between two reads in one row |
| off with no League list: `null`, though a stale slot holds one |
| pure: `equippedListOf` reads the switch on each call |
| on the session read (Q-4): with the switch off, the League book |

### 4.6 Q-4 — the saved-session read carries `equippedList`; the saved screen asks it first

**The ruling:** not the hub prop, and no edit under `src/components/CommandCenter/`. `GET ?sessionId=` on a SAVED thesis-builder session gains `equippedList: { id, name } | null`, from the same helper as X-9 (with Q-3), with one agents query, read only for that case. Every other answer is unchanged. ThesisSaved uses the server's value first; the `equippedListLabel` prop is the fallback only when the answer has no `equippedList` key.

**Built:**
- `api/forge/shared-research.js:71` `isSavedSession`: `completed`, with the adoption's list id. That is written in the same transaction as the record's `saved_to_list`, which is how the screen tells a saved thesis.
- `shared-research.js:188`: the builder answer appends `equippedList` only then, from `store.js:277` `readEquippedList`. That is `exploreAgentOf(await readRankedAgent(db, uid), uid)?.equippedList ?? null`: one agents query, `open`'s agent, Q-3's book.
- `src/components/SharedResearch/useSharedResearch.js:71`: the sheet keeps the key when an answer carries it, and leaves it absent otherwise.
- `screens/ThesisSaved.jsx:55-62`: the server's value first.
  - **This thesis's own list** (`equippedList.id` equals the saved `watchlistId`): "Equipped for your next game" (`:84`, `data-sr-equipped-already`), and no button and no line.
  - **Another list:** `COPY.replaces(name)`, or the new `COPY.replacesUnnamed` ("Replaces your equipped list.", `sharedResearchCopy.js:426`) when its name is null.
  - **`null`:** `COPY.becomesList`.
  - **No key:** the label prop decides, as in §4.3.

**Routine choice:** with no `agentId`, nothing is drawn, not even "Equipped". "No `agentId` → no button and no line, as today" holds for the whole block.

| Rows |
|---|
| **route:** another list equipped → `{ id, name }`, appended after every key the answer had; one agents query, no by-id agent read |
| **route:** this thesis's own list equipped → its id, equal to the saved `watchlistId` |
| **route:** another list with no name → `{ id, name: null }` |
| **route:** no list, or no ranked agent → `null`, with the key present |
| **route:** never a clone's list, with a clone seeded first |
| **route:** every other answer unchanged, keys exact, no agents query: an open builder, a concluded builder, an open ledger, a saved ledger idea |
| **jsdom, from both doors** (the hub's props with its own different label; Explore's Q-2 props), the answer's `equippedList` from the server's own `equippedListOf`: the own list → "Equipped", no button, no line · another named → "Replaces {its name}…", never the hub's label · another unnamed → "Replaces your equipped list." · `null` → the plain line, even with the hub's label passed |
| **jsdom:** no key → the label decides · no `agentId` → nothing, whatever the server says · right after a save on this page, the read after the save carries the key and it decides |

### 4.7 Q-5 — the stored name, kept

`equippedList.name` stays the name stored on the agent's book when the list was equipped, as X-9 ruled. It is on the founder's watch list. The doc comment says so (`store.js:236-241`).

### 4.8 The three routine review fixes

| Finding | Fix |
|---|---|
| H-3 (i): the "readRankedAgent's choice" row was weak | a new route row opens an investigation through the route, with training and casual clones and a second ranked agent seeded, and checks the read's `agent.id` equals the agent `open` stamped (`session.attribution.agentId`) |
| H-3 (iii): the bound row paired question to statement only for the saved sessions | every one of the 80 `last`s is checked against its own session: `question === 'Question n'` for the planted session `n` |
| H-3 (iv): the jsdom header over-claimed "from Explore's props" | it now says the rows use the two doors' prop shapes, built by a local helper, and that Explore does not pass them yet |
| H-6: "Never refuses" could be misread | `readExploreAgent`, `readEquippedList` and the route's comment say a failing agents query still fails the read, as any of its reads would |

H-3 (ii), no row for H-1 or H-2, is closed by the Q-3 and Q-4 rows above.

---

## 5. The mutation table

Each mutant was applied to the final code (`6d1ec099`'s files) in the worktree, its test file run with a JSON report, and the file restored byte for byte (checked after every run). **41 / 41 killed**; each fails the row named for it, plus, where the count is higher, others.

The prompt's named mutants:

| Id | Mutant | Row that kills it | Rows failed |
|---|---|---|---|
| M1 | `statement` taken from the composed sentence (the card) | a saved thesis on an Explore story (the edit) | 6 |
| M2 | `statement` taken from the list's saved card (`thesisCard.statement`) | a thesis saved before B6a | 5 |
| M3 | a concluded `last` carries a statement (the `saved` guard dropped) | a concluded one never carries a statement | 1 |
| M4a | `question` taken from the session (its frame, a session field) before the record | the question is the record's | 1 |
| M4b | `question` taken from the story (the record's opening finding, the title) | a saved thesis on an Explore story | 10 |
| M5 | a clone chosen as the agent (the query's first document) | training and casual clones are never chosen | 3 |
| M6 | `equippedList` built when the book has no id | no list: `equippedList` null | 4 |
| M7 | the new line (no label, no server key) says there is no list | with none | 3 |
| M8 | the replaces line shown without a label | with none | 3 |
| M9a | the line and the button shown without an `agentId` (`canEquip` drops the agent) | no `agentId` | 3 |
| M9b | the line shown without an `agentId` (its own guard dropped) | no `agentId` | 2 |
| M10 | the older idea screen changed (its `noList` swapped for the new line) | the older idea screen | 1 |

The founder's rulings (Q-3, Q-4), a mutant each:

| Id | Mutant | Row that kills it | Rows failed |
|---|---|---|---|
| Q3a | always the BaggerBomb book (the switch ignored when off) | on: the slot's book; off: the League book | 4 |
| Q3b | the switch inverted | pure: `equippedListOf` reads the switch each call | 14 |
| M14 | always the League book (the switch ignored when on) | a stored BaggerBomb slot holding a list | 12 |
| Q4a | the key on every builder GET, not only a saved one | every other answer is unchanged | 1 |
| Q4b | "saved" read from the status alone (a concluded builder gets the key) | every other answer is unchanged | 1 |
| Q4c | the saved read picks a clone | never a clone's list | 1 |
| Q4d | the saved read ignores Q-3 (always the BaggerBomb book) | Q-3 holds here too | 5 |
| Q4e | two agents queries for the saved read | another list equipped (one agents query) | 1 |
| C1 | the own-list check dropped (the offer shown for the equipped thesis) | this thesis's own list is the equipped one | 1 |
| C2 | the button kept beside "Equipped" | this thesis's own list is the equipped one | 1 |
| C3 | an unnamed other list read as none (the plain line) | another list with no name | 1 |
| C4 | the server's `null` overridden by the label | none equipped (null) | 1 |
| C5 | the label first (the server's name used only without a label) | another list, named | 4 |
| C6 | an absent key read as `null` (the label never decides) | no `equippedList` key in the answer | 5 |
| C7 | the hook drops the answer's `equippedList` | this thesis's own list is the equipped one | 5 |
| C8 | "Equipped" shown without an `agentId` | no `agentId`: nothing | 1 |

This build's own:

| Id | Mutant | Row that kills it | Rows failed |
|---|---|---|---|
| M4c | each `last`'s question taken from another session's record | the bound counted exactly (every question paired) | 1 |
| M5b | the read's agent is the last non-clone, not `open`'s first | it is the agent `open` stamps | 2 |
| M11 | the owner check dropped from the agent's shaping | another player's agent is never returned | 1 |
| M12 | the agent's raw name instead of `partnerNameOf` | a blank name | 1 |
| M13 | the list's name not trimmed | a stored BaggerBomb slot holding a list | 8 |
| M15 | a last-ended record taken from the window only, never read by id | the record in the window / read by id | 2 |
| M16 | the bound not grown (191) | the bound counted exactly | 1 |
| M17 | `Builder` does not pass the label to the saved screen | with a label | 5 |
| M18 | the body does not pass the label to `Builder` | with a label | 5 |
| M19 | the line drawn below the button | with a label (the line directly above the button) | 7 |
| M20 | the Explore answer without `agent` | no ranked agent (the answer's keys) | 12 |
| M21 | a blank label taken as a label | with none (`'   '`) | 1 |
| M22 | a blank recorded statement reported | a blank recorded statement is no statement | 1 |

The first battery, at `cd11eac1` before the rulings, was 24 / 24.

---

## 6. The review (BUILD_RULES §2)

### 6.1 How it ran

The cumulative diff passes the 10-file threshold, so §2 applies.
- **The lens:** one honesty lens, on what the read and the saved screen claim and whether each claim holds in every state.
- **The refuter:** one, handed every finding and told to refute it with a trace.
- **Isolation:** each reviewer read its own LF `git archive` extraction of `cd11eac1` under the session scratchpad, read-only. Neither wrote a file or ran git.
- **One round**, as the prompt set. The founder's rulings followed.
- **The explicit `vite build`** is in §7.

### 6.2 Findings, verdicts and what was done

| Id | Finding | Refuter | Done |
|---|---|---|---|
| **H-1** | With per-game loadouts switched off (`PER_GAME_LOADOUT_ENABLED`, a kill switch with a written rollback), equip writes the League fields (`api/agent/equip-watchlist.js:160`) and a deploy carries them (`api/_utils/casualClone.js:83`, `:120`). A stale BaggerBomb slot would still win in `baggerbombLoadoutOf`, so the read would name the wrong list. | **CONFIRMED**, introduced by the diff; latent while the flag is on | **Ruled Q-3, built** (§4.5) |
| **H-2** | Shared Research lists are stored with `name: ''` (`store.js:752` at `cd11eac1`), and reopening resets equip to `'none'` (`useSharedResearch.js:172`). So a reopened thesis that is already the equipped list got the line, which from the hub read "Replaces Watchlist as your equipped list.". That is false: the thesis would replace itself. | **CONFIRMED**, introduced by the diff (the words; the offer is older) | **Ruled Q-4, built** (§4.6): the server now says when the thesis is already equipped |
| H-3 | Rows that could pass with a claim false: (i) the agent-choice row was weak; (ii) no row for H-1 or H-2; (iii) the bound row's question pairing; (iv) the jsdom header's wording | **PARTLY**: (i) weak, not a tautology; (ii)–(iv) hold | **Fixed** (§4.8); (ii) by the Q-3 and Q-4 rows |
| H-4 | After a failed equip, the Retry carries no line | **CONFIRMED**, a nit; the idea screen's pattern | **Kept as built** |
| **H-5** | `equippedList.name` is the name stored at equip time; a list returned to draft, renamed and recommitted while equipped keeps its old name | **CONFIRMED** as a divergence | **Ruled Q-5: kept**, on the watch list |
| H-6 | A failing agents query now fails the whole Explore read | **PARTLY**: real, but the words were not false | **Fixed** (the doc comments say so) |

**Split:** 4 CONFIRMED (H-1, H-2, H-4, H-5) · 2 PARTLY (H-3, H-6) · 0 REFUTED.

The refuter also noted that the owner check in `exploreAgentOf` is redundant with the `ownerId ==` query (kept, as `attributionIn` keeps it), and that the `try` around the loadout read cannot fire (kept, as `attributionOf` has it).

**The rulings' code was not re-reviewed by subagents.** The prompt allowed one round, and the founder's rulings specified the fix. It is pinned instead by the 17 Q-3/Q-4 mutants (§5) and the rows from both doors.

---

## 7. The checks

Run on Linux (WSL) in a private worktree of `~/pd-ci` at the final code head `6d1ec099`, which is the branch with `main` `190b5e63` merged in. `node_modules` is linked to an install of the same lockfile (`e457c10d0317`, checked inside WSL); Node 20.20.2. I read every exit code myself.

| Check | Result |
|---|---|
| Full suite (`TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`) | **exit 0** · Test Files **1,663 passed** (1,663) · Tests **38,067 passed, 0 failed**, 197 skipped · 462 s |
| `lint:gate` | **exit 0** |
| `test:rules` (Firestore emulator, JDK 21) | **exit 0** · 48 files · **889 passed** |
| Minified `vite build`, head and `main` `190b5e63` | **exit 0** both |
| The pushed head (code head + this report) | built again; its `dist` is byte-identical to the code head's (§8) |

**The first suite run**, at `cd11eac1`, exited 1 on Explore's fixture alone (37,947 passed, 1 failed): the STOP of §2.1. The run above is after the founder's Q-6.

**The flag census on Windows.** In a 51-file targeted Windows run, `src/config/perGameLoadoutFlags.test.js` "nothing else under api/ or src/ reads it" timed out while walking `api/` and `src/` under load. Alone it passes 29 / 29, and it passes in the Linux suite above, which is the record.

**The Shared Research files** (Linux suite, against the preamble's Windows baseline). Every file existing before passes at its baseline count.

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
| `sharedResearchCopy.guard.test.js` (the two new lines pass it) | 28 | 28 |
| every other Shared Research file (38) | 1,153 | 1,153 |
| **New:** `shared-research.b6c.route.test.js` · `SharedResearchSheetBody.b6c.jsdom.test.jsx` | — | 35 · 17 |
| Outside the directory: `src/config/perGameLoadoutFlags.test.js` (one entry added, §4.5) · `src/components/Explore/__fixtures__/exploreReads.test.js` (its JSON regenerated, §2.1) | 29 · 2 | 29 · 2 |

**Byte-identical to `main`:**
- `screens/Adopt.jsx`, the five sheet test files and their fixtures;
- everything under `src/components/CommandCenter/`;
- everything under `src/components/Explore/` except `__fixtures__/exploreReads.json`;
- `firestore.rules`, `firestore.indexes.json`, and every flag value in `src/config/`.

---

## 8. The bundle diff

Minified `vite build` of the code head `6d1ec099` and of `main` `190b5e63`, each in its own WSL worktree of `~/pd-ci` on the same install (lockfile `e457c10d0317`, Node 20.20.2), compared file by file with the 8-character content hashes masked.

- **The one content change:** the lazy Shared Research chunk, `SharedResearchSheetBody-*.js`, **148,414 → 149,209 B (+795)**. It holds the prop threaded through `Builder` to `ThesisSaved`, the server-first line with its three cases and "Equipped", the hook keeping `equippedList`, and the two new copy strings.
- **The entry chunk** (`index-*.js`, 5,094,925 B) is equal once the lazy chunk's hashed name inside it is masked. The second `index-*.js` (615,045 B) has the same name and the same bytes. 108 files differ only in the hashed names they import; 10 are byte-identical. `index.html` is equal masked.
- **CSS:** `index-DXxojBT9.css` is the same file on both.
- **`sharedResearchService-*.js`** (1,833 B) differs only in its hashed name: the service's change is a doc comment.
- The server files (`api/`) and the flag census test are not in the client bundle.

---

## 9. Questions for the founder

**None open.** Rulings of Nov 23, all as built:
- **Q-6:** Explore's read fixture regenerated with its own command; nothing else under Explore (§2.1, §1.1).
- **Q-3:** `equippedList` follows `PER_GAME_LOADOUT_ENABLED`, read at call time (§4.5).
- **Q-4:** the saved-session read carries `equippedList`; ThesisSaved uses it first; no hub edit (§4.6).
- **Q-5:** the stored name is kept; on the watch list (§4.7).
- **The routine fixes:** H-3 and H-6 applied (§4.8); H-4 kept as built.

**For Explore Build 2** (not a question): Explore may pass `agent.id` and `agent.name` once this merges (§1.3).

---

## 10. The PR description

### Shared Research "Work an idea": B6c, the shelf and the agent for Explore Build 2

**What players see when this merges:** one change. On the thesis builder's saved screen, "Use it in my next game" now says what it does:
- "Replaces {list} as your equipped list.";
- "Replaces your equipped list.";
- "This becomes your equipped list for your next game.";
- or, when the thesis already is the equipped list, "Equipped for your next game" with no button.

Before this, it replaced the agent's equipped list without saying so. Explore stays off, and only the allowlist sees Work an idea. The report is `docs/audits/20261123_BUILD_SHARED_RESEARCH_B6C.md`; its §1 is written for the Explore chat to read alone.

**What it adds:**
- **X-8:** Explore's read (`GET ?list=explore`): each `last` gains `question` (the investigation's research-record question) and `statement` (the sentence a thesis save recorded; null when concluded or when none was recorded). `EXPLORE_DOCS_MAX` 191 → 221, plus the agents query `open` already runs. (`api/_utils/sharedResearch/explore.js:62`, `:147`, `:179`; `store.js:225`)
- **X-9 and the founder's Q-3:** the read gains `agent: { id, name, equippedList } | null`: `open`'s ranked agent, never a clone; the list "Use it in my next game" replaces follows `PER_GAME_LOADOUT_ENABLED` (on: the BaggerBomb loadout's book; off: the League book). (`store.js:242`, `:258`, `:268`; `api/forge/shared-research.js:167`; the flag's reader census, `src/config/perGameLoadoutFlags.test.js:124`)
- **X-10 and the founder's Q-4:** `GET ?sessionId=` on a saved thesis-builder session gains `equippedList`, with one agents query, read for that case only. Every other answer is unchanged. The saved screen uses it first, and falls back to the `equippedListLabel` prop only without it. (`shared-research.js:71`, `:188`; `store.js:277`; `useSharedResearch.js:71`; `screens/ThesisSaved.jsx:55-62`, `:84-85`; `screens/Builder.jsx:397`, `:423`; `SharedResearchSheetBody.jsx:221`; `sharedResearchCopy.js:424`, `:426`)
- **The founder's Q-6:** `src/components/Explore/__fixtures__/exploreReads.json` regenerated with its own command; three `last` objects gain the two keys. Nothing else under Explore.

**Fences:**
- No fenced file was called or edited.
- Not touched: `src/components/CommandCenter/`, `firestore.rules`, `firestore.indexes.json`, any flag value, `screens/Adopt.jsx`, and the five sheet test files.
- Under `src/components/Explore/`, only the ruled fixture.
- Additive keys only; `open`, `step`, `card`, `adopt` and `close` are unchanged.

**Checks (Linux, `6d1ec099`, `main` merged in):**
- full suite **exit 0, 38,067 passed, 0 failed (1,663 files)**;
- `lint:gate` exit 0;
- `test:rules` exit 0, 48 files, 889 passed;
- minified build exit 0;
- mutants **41 / 41**;
- review: one honesty lens and one refuter, 4 confirmed, 2 partly, 0 refuted, each ruled or fixed (report §6).

**Bundle:** only the lazy Shared Research chunk changes, 148,414 → 149,209 B. The entry is identical apart from that chunk's hashed name, and the CSS is the same file.

**Founder rulings (Nov 23), all as built:** Q-3, Q-4, Q-5 (kept), Q-6, and the routine review fixes. No question is open.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
