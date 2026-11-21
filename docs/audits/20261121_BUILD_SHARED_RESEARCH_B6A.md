# Shared Research "Work an idea" — B6a: what Explore needs first (build report)

**Date:** Sat Nov 21, 2026 · **Branch:** `claude/shared-research-b6a` · **Base:** `main` `cf35151b` · **Code head:** `7f46415e` · **Ships:** dark — nothing changes for any player when it merges.
**Build prompt:** "Shared Research 'Work an idea': B6a, what Explore needs first" (Nov 20, 2026), with the Explore chat's spec `EXPLORE_BUILD_1_SPEC_V1_NOV20_2026.md` §5.1 attached. **Founder ruling during the build (Nov 21):** the research record's schema version 2 (§3.2).

---

## 1. For the Explore chat

*Written to be read alone. Everything here is on `main` once this PR merges; nothing in the app calls any of it yet.*

### 1.1 The read: `GET /api/forge/shared-research?list=explore`

- **Through:** the route's existing gate, auth and per-uid limiter (`api/forge/shared-research.js:162`). The limiter is per uid and per method, so this read shares the sheet's **30 GETs a minute**.
- **The client call:** `readExploreInvestigations()` in `src/services/sharedResearchService.js:73`. It resolves, never throws, in the service's usual shape `{ ok, status, body, retryAfterS, gated, network }`.
- **Refusals:** a player without access gets `404 { error: 'disabled' }` (the service sets `gated: true`); signed out, `401`; over the limit, `429` with `Retry-After`. Nothing else: the read refuses nothing of its own.
- **No write.** One call reads **at most 191 documents** (`EXPLORE_DOCS_MAX`, `api/_utils/sharedResearch/explore.js`). It needs no new index (§4.1). The documents are:
  - the quota;
  - at most 30 open and 30 completed Explore sessions;
  - the newest 50 research records, and up to 50 sessions found through them;
  - at most 30 records of open investigations.

**The answer:** `{ quota, items }`. `quota` is the same object every Work an idea answer carries. `items` has one entry per Explore story the player has investigated, newest activity first:

```
{ itemRef: { recordKind: 'exploreStories', recordId },
  itemVersion,            // the story version the newest of open / last was opened on; null if it cannot be read
  open: { sessionId, question, lastTurnAt, filled, parts, stepsLeft, findingsCount } | null,
  last: { sessionId, ended: 'saved' | 'concluded', at } | null }
```

- **`open`:** the story's open investigation — the same one `open` would answer as `existing`.
  - `question`: the question it was opened with (never changes).
  - `lastTurnAt`: the time of its last model turn, or null.
  - `filled`: the number of card parts the sheet shows as set. It comes from the thesis view itself, so a part gone stale is not counted. It is `null` for an investigation that is not a thesis builder.
  - `parts`: always 6.
  - `stepsLeft`: the steps the sheet shows as left.
  - `findingsCount`: every finding on the record, the number the sheet's Continue row shows.
- **`last`:** the story's newest investigation that ended as a saved thesis (or saved idea) — `ended: 'saved'` — or was concluded — `'concluded'`. `at` is when it ended. **A discarded investigation is never reported**, and a story whose investigations were all discarded has no item.

**One real example** (the route on the test double; one story, an earlier investigation concluded and a second one open with one part set and two steps used):

```json
{
  "quota": { "investigationsToday": 2, "perDay": 3, "framingsToday": 0, "framingsPerDay": 10, "stepsToday": 0, "stepsPerDay": 30 },
  "items": [
    {
      "itemRef": { "recordKind": "exploreStories", "recordId": "ai-power-1" },
      "itemVersion": 3,
      "open": { "sessionId": "c392c53d-0d0a-4da8-9199-11a074921141", "question": "Which suppliers are short of transformers?", "lastTurnAt": null, "filled": 1, "parts": 6, "stepsLeft": 8, "findingsCount": 1 },
      "last": { "sessionId": "f3d34c4c-5eda-4d75-b7b3-ddead6436a2a", "ended": "concluded", "at": "2026-11-21T07:01:53.730Z" }
    }
  ]
}
```

**What the read can miss, and what to do.** It holds the player's newest investigations first; nothing recent is ever missed.
- **Anything recent:** an Explore investigation among the player's newest 50 research records is always read. That is the same window the hub's "Continue your research" reads, and it counts records of every kind.
- **An open investigation** is also found by an exact query. It is missed only when it is older than that window *and* more than 30 Explore investigations are open at once.
- **An ended investigation** is also found by an exact query for up to 30 completed Explore investigations, in no order. So only a player with more than 30 completed Explore investigations can lose, for a story outside the window, its `last`, or get the older of two.
- **The server still holds the rule:** a second open of a story that has an open investigation answers `existing: true` and counts nothing.
- **Continue an `open` item with `mode: 'session'` and `open.sessionId`, never with a new open.** If a story is unpublished after an investigation opened, the read still lists it as open, but a new `open` of that story answers `404 item_not_found` (review HB-3).

### 1.2 Explore stories as their own starting kind

- **Record kind and collection:** `exploreStories` (`EXPLORE_RECORD_KIND`, `src/constants/sharedResearch.js:21`). The server reads the collection with its own credentials, so no Firestore rule is needed for `open`. Explore's own client read of the stories still needs the rules block its spec §5.2 names.
- **The request:** `POST { action: 'open', requestId, entry: { kind: 'item', itemRef: { recordKind: 'exploreStories', recordId }, question } }`.
  - `requestId`: a fresh id per attempt; a retry re-sends the same one.
  - `question`: 1–500 characters after trim.
  - `direction` is accepted, as for any story; the spec drops the field (N-2).
- **The answer:** exactly a story's answer today: `{ session, record, companies, opening, quota, previous, existing? }`, plus `thesis` for a thesis builder. The builder mode is on, so a new investigation opens as a builder.

**Exactly what `open` reads from the story** (`readExploreStory`, `api/_utils/sharedResearch/store.js:177`), field by field against spec §5.1:

| §5.1 field | Read? | Used as |
|---|---|---|
| `id` (the document id) | the path | `itemRef.recordId`, the opening finding's source id. It must match `^[A-Za-z0-9_-]{1,200}$` (the route's id rule), or the open answers `400 invalid_entry`. |
| `status` | yes | only `'published'` opens; anything else answers `404 item_not_found` |
| `title` | yes | the opening finding's fact, as a FantasyTimes headline is today. A blank title answers `404 item_not_found`. |
| `reporter.name`, `reporter.beat` | yes | the finding's label: `FantasyTimes · {name} · {beat}` (a missing name reads "reporter") |
| `publishedAt` | yes | the finding's date. A time later than the open, or none, dates it by the open, and its label says "undated". |
| `tickers[]` | yes | the names in scope, by today's rule: those in the game's list, each once, at most 10. Each gets the stored facts a story's names get. |
| `version` | yes | must be a whole number ≥ 0, else `404 item_not_found`. Stamped on the session as `entry.itemVersion` and shown in the session view (`session.entry.itemVersion`). |
| `lead`, `productName`, `deck`, `evidenceSpan`, `body`, `parts`, `openQuestion`, `connections`, `sources`, `questions`, `topics`, `sample` | **never** | — (a row proves no other field is touched) |

**Differences from the spec's §5.1, for the Explore chat to note:**
1. **No `primaryTicker` in §5.1:** a FantasyTimes story's opening finding names its primary ticker; an Explore story's names none (`symbol: null`). The names in scope still come from `tickers`.
2. **The opening finding is labelled as FantasyTimes content:** the sheet draws it "From FantasyTimes", with the label `FantasyTimes · {reporter} · {beat}`, as the ruling said.
3. **`sample` is not read:** a sample story that reached the collection with `status: 'published'` would open like any other. Keep samples out of the collection (FQ-1).
4. **Ids follow the route's id rule** above, so a slug like `ai-power-1` is fine.

**What the server does after the read:**
- The opening finding cites the story as `source: { recordKind: 'exploreStories', recordId }`. For that, the research record's schema version became 2 (§3.2). Records minted from now on carry `schemaVersion: 2`; records already stored keep 1, and nothing reads the number.
- One open investigation per player per story, as today: the second open answers the first, with `existing: true` and its original question.
- The method is the baseline, as for any story. Everything after the open is today's story path, unchanged.

### 1.3 The sheet body's two new props (`SharedResearchSheetBody.jsx`)

**`startNow`** (boolean, default `false`). It applies with `mode: 'item'` and an `item` whose `question` is not blank:

| What happens | What the sheet shows |
|---|---|
| on mount | the open is sent at once with `item.question` (trimmed) and `item.itemRef`, plus `direction` when one is given; the story preview is never drawn first |
| while it runs | "Opening the investigation…" |
| a new investigation opens | its work view |
| an investigation already open on this story (`existing`) | the existing "Continue" state |
| the daily limit (`429 daily_limit`), any other refusal, no answer, or the gate from the server (`404 disabled`) | the story preview, with the question kept and the server's line. Try again re-sends the same request id. |
| `gated` passed in | the preview in its gated state; nothing is sent |
| a blank question | the preview; nothing is sent |
| `startNow` absent or `false` | today's sheet |

Opening "on mount" holds under React's development StrictMode too: one open, never two. After the open, any later story preview (New investigation, the story list) is a normal preview (review HB-1).

**`words`** (string, default `''`). With `mode: 'start'`, the "your own words" box opens holding them. **Nothing is sent until the player continues:**
- with the builder mode on, the tap is "Start the thesis", which opens own words with them;
- with it off, the tap frames them.

In any other mode `words` is ignored.

### 1.4 The two Explore files the boundary allows (`sharedResearch.boundary.test.js`)

- **`src/components/Explore/loadSharedResearch.js`** — the sheet's second door. It may contain **exactly one** load-time `import('../SharedResearch/SharedResearchSheetBody.jsx')` and nothing else from the directory, in the pattern of `CommandCenter/hub/loadSharedResearch.js`.
- **`src/components/Explore/useExploreResearch.js`** — the service's one reader outside the sheet. It must import **exactly** `import { readExploreInvestigations } from '../../services/sharedResearchService'`: no namespace import, no second name, no dynamic import.

The rows hold with these files absent and when they appear (tested on stand-ins). **Any third file** that loads the body, imports anything from `src/components/SharedResearch/`, names the directory in a string, or imports the service **fails the suite.**

### 1.5 Q-1: does `mode: 'session'` show a closed investigation by id?

**Yes.** `mode: 'session'` with a `sessionId` shows a closed thesis-builder investigation read-only:
- a saved one: the saved screen;
- a concluded one: its card and conversation with the Concluded line.

No choices are drawn and nothing is sent but the one read. Two jsdom rows pin it. So the "View it" in the spec's form C can open `last.sessionId` with `mode: 'session'`.

### 1.6 What is not here (B6b)

- the chosen angle as the research scope;
- the story's sources and company leads carried into the investigation;
- any use of a starting direction.

`open` reads none of the story's questions, sources or connections, and nothing about the investigation changes with them. Explore's panel should say only what the "What starts with it" table in spec §4 allows; the company-leads line may stay, because `open` reads the story's tickers.

---

## 2. Verdict

| Check | Result |
|---|---|
| The rulings | X-1, X-2, X-5, X-5b, X-6, X-7 built, each with its rows; Q-1 answered **yes** and pinned (§4) |
| The STOP, and the founder's ruling | X-2 needed `exploreStories` on the research record's closed source list. The founder ruled (Nov 21) **schema version 2**, within the limits given; nothing reads the number (§3) |
| Nothing changes for any player | dark: no Explore story exists, nothing in the app calls the new read or options; the bundle's only change is the lazy Shared Research chunk (+504 B) |
| FantasyTimes investigations unchanged | the opens and a ledger idea saved compared against a golden made on `main`: every answer and document equal but the record's schema number (§4.2) |
| Full suite (Linux, `TZ=UTC`, 8 workers) at `7f46415e` | **exit 0** · 1,587 files · **36,442 passed, 0 failed**, 179 skipped |
| `lint:gate` · `test:rules` · minified build | **exit 0** · **exit 0** (46 files, 839) · **exit 0** |
| The sheet's existing test files | the four `SharedResearchSheetBody.*.jsdom` files and `useSharedResearch.uncertain` **unedited**, at their baseline counts (156 · 37 · 34 · 38 · 2) |
| Mutants | **43 / 43** killed (§5) |
| Review | two lenses and one refuter. 21 findings: 11 fixed, 9 kept with reasons, 1 settled by the Linux suite (A-7). One fix regressed (RF-2); the refuter found it, and it was fixed (§6) |
| For the founder | both questions ruled Nov 21, as built: Q-A **thesis saves only**; Q-B **leave "already saved" as it is** (§9). Nothing is open |

---

## 3. Base, preamble and the STOP

### 3.1 The preamble

1. **Branch.** `git fetch origin main`; `claude/shared-research-b6a` cut from `origin/main` `cf35151b9528cbdf32a6452b7ffec29c7b058f2f`. `main` had not moved at the last fetch before the checks.
2. **The field map** (§1.2's table). §5.1 has a stable document id, a title and a version, so there was no STOP from the map itself.
3. **No new index for X-1** (§4.1).
4. **Baseline:** 49 Shared Research test files, 1,488 rows, all passing. The two `*.browser.test.js` files need a real browser and are not in that run. Per-file counts are in §7.

### 3.2 The STOP, and the founder's ruling

**The STOP.** X-2's opening finding cites its story. A finding's source must be on a closed list, and `exploreStories` was not on it:
- the list: `api/_utils/researchRecords/findingRecordKinds.js:17`;
- `buildFinding` refuses any other kind;
- "once records are stored, grows only with a new `RECORD_SCHEMA_VERSION`": `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md:28`.

Growing the list means raising the version, so every record minted afterwards, from every origin, stores 2. That hits the prompt's STOP line on what FantasyTimes, own-words and SignalDrop investigations store.

**The founder's ruling (Nov 21):** schema version 2 in this PR, with these limits:
- append `'exploreStories'` to the end of `FINDING_RECORD_KINDS`; the idea-evidence list derives from it, so the idea builder needs no edit;
- `extension.test.js` keeps version 1's lists exactly and adds version 2 = version 1 plus `'exploreStories'`; no other list changes;
- records already stored keep 1, and nothing rewrites them;
- a one-line entry in the design note;
- this report shows that nothing reads the number;
- "The waiver covers this one number only. Every other STOP line holds."

**As built:**
- `findingRecordKinds.js:23` appends the kind;
- `model.js:86` sets `RECORD_SCHEMA_VERSION = 2`;
- `extension.test.js` adds `LISTS_BY_SCHEMA[2]`, built from version 1 plus the appended kind, with a row that version 2 differs from 1 by exactly that;
- the design note gains its line (`:30`).

Three rows that pinned a freshly minted record's `schemaVersion: 1` move to 2 (§6.3). A row that seeds an already-stored record keeps its 1.

### 3.3 Nothing reads a research record's `schemaVersion`

| Where | Finding |
|---|---|
| Server and scripts | 134 non-test mentions of `schemaVersion` in `api/`, `src/`, `scripts/`. Every file that names it **and** touches research records is one of three: `researchRecords/model.js`, which *writes* it once at mint (`buildRecord`, `:499`); `sharedResearch/session.js`, the session's own `SESSION_SCHEMA_VERSION`; and `sharedResearch/thesis.js`, the card's and the saved card's own. `setupRead/projection.js` checks a different constant, for setup records. No file reads a research record's `schemaVersion`. |
| Firestore rules | `firestore.rules:1343-1347` (`researchWork`): owner read on `userId`, no client write. The number appears nowhere. |
| Indexes | `firestore.indexes.json`: the one index with a `schemaVersion` field is on `gameDesignFeedback`. The `researchWork` indexes are `(userId, createdAt desc)` and `(userId, symbolKeys, createdAt desc)`. |
| Client answers | Work an idea's answers project the record through `projectionOf` (`companies.js:199`), which carries no `schemaVersion`; summaries go through `recordSummaryOf` (`model.js:924`), which carries none either. The hub reads its research rows straight from Firestore (`src/services/sharedResearchRecords.js:39`), so the field arrives in those raw documents, but no client code reads it: the one `src/` file naming `schemaVersion` is `deployStrategyService.js`, about something else. |

Lens A of the review checked this independently and found the same.

---

## 4. The rulings, as built

### 4.1 X-1 — one read for Explore

- **Built:** `api/forge/shared-research.js:162` (the branch in `handleGet`, after the quota read every GET makes), `store.js:206 readExploreInvestigations`, `api/_utils/sharedResearch/explore.js` (the shaping, pure).
- **No new index.** Three queries, in parallel (`store.js readExploreInvestigations`):
  - **Open and completed Explore sessions:** `sharedResearchSessions` where `userId ==`, `entry.itemRef.recordKind == 'exploreStories'` and `status ==` `'open'` / `'completed'`, each `limit(30)`. Equality filters only: Firestore serves them by merging its automatic single-field indexes. `firestore.indexes.json` has no field override on that collection, and `open`'s own `userId ==`, `itemKey ==` query already relies on the same merge in production.
  - **The newest research records:** `researchWork` where `userId ==`, ordered by `createdAt` descending, `limit(50)`. This is the deployed index `listOpen` reads (`firestore.indexes.json`, researchWork `(userId, createdAt desc)`).
- **Then:**
  - the session of each open or completed Explore investigation in that window that the two queries did not return, read by id;
  - the record of each open investigation the window does not hold.
- **Identifying Explore records:** a record is from an Explore story when its first finding is the opening coverage finding citing `exploreStories` (`explore.js exploreStoryOfRecord`). The opening is appended at mint and findings are never removed.
- **`open` and `last`** both come from the sessions held:
  - `open` is the newest open session per story;
  - `last` is the newest-created `completed` session per story: saved when it carries its adoption (written in the save's one transaction with the record's `saved_to_list`), else concluded. `at` is the save's time or the close's.
- **A session held twice counts once**, ended if either read saw it ended.
- **The bound:** 1 + 30 + 30 + 50 + 50 + 30 = **191 documents** at most.

**Routine choices:**
- **The design** went through the review (HB-2, then the refuter's RF-2 and RF-3; §6): the window finds the newest investigations, newest first; the two exact queries keep older ones.
- **Items** are ordered by newest activity.
- **`parts`** is 6 for every open investigation, the ruling's value; `filled: null` says there is no card.

| Rows (`api/forge/shared-research.b6a.route.test.js`) |
|---|
| no investigations: `{ quota, items: [] }`, exact keys and quota |
| one open builder: every field equal to the sheet's own read of the same session (`filled` = `thesis.filled`, `stepsLeft`, `findingsCount`, `question`, `lastTurnAt`); the item's `itemVersion` |
| `filled` is the view's count: a part stored `set` but stale is not counted (1, not the stored 2) |
| a ledger: `filled: null`, `parts: 6` |
| one concluded (a real close): `last` with the close's `endedAt` |
| one discarded: no item |
| one saved (a real ledger save): `last.ended: 'saved'`, `at` = the save |
| an open one and an earlier concluded one on one story: both, each in place; a later discard does not hide the conclusion |
| two ended on one story: the newer is `last`, whichever way round |
| a FantasyTimes story and own words are not listed; two Explore stories are, newest activity first |
| no access: `404 disabled`, nothing read |
| another player's investigations never appear |
| the bound: 191 documents counted exactly; no write |
| newest first past the queries' bounds: a story's newer save, outside the completed query's 30, is found in the window and wins; a story in neither ages out |
| an Explore save is kept when 50 newer research records of other kinds push it out of the window (RF-2) |
| an open investigation the open query left out (31 open at once) is found through its record in the window (RF-3) |
| a session two reads saw differently counts once, as ended: never both `open` and `last` (RF-4) |
| FantasyTimes and own-words investigations, concluded and saved, are neither listed nor read: the documents counted exactly (RF-1) |
| a SignalDrop entry naming an Explore story answers `item_kind_unsupported`, as on main (A-3; in the X-2 block) |
| a read writes nothing; two reads answer the same |

### 4.2 X-2 — Explore stories as their own starting kind

**Built:**
- `src/constants/sharedResearch.js:19-23`: `ENTRY_ITEM_RECORD_KINDS` gains `exploreStories`; new `EXPLORE_RECORD_KIND` and `STORY_RECORD_KINDS`.
- `shared-research.js:312` (a SignalDrop entry naming an Explore story answers as on main, review A-3), `:313` (an `item` names either story kind), `:319` (`readExploreStory` for an Explore story), `:343` (`itemVersion` into the entry, only when the story has a version).
- `store.js:177 readExploreStory`.
- `session.js:227` (`openSessionOf` writes `entry.itemVersion` only when given, so every other entry is written as before).
- `opening.js:135`: the finding cites the story's own kind; a FantasyTimes story carries none and cites as before.

**Routine choice:** a blank title, or a version that is not a whole number ≥ 0, answers `404 item_not_found`, like a FantasyTimes story without a headline.

| Rows |
|---|
| opening an Explore story (ledger): the coverage finding (the title, `reporter_content`, "From FantasyTimes", the source `exploreStories`/id, the label), the entry (names `ETN`, `GEV` — `QZXW`, outside the game, dropped — and `itemVersion: 3`), the version in the session view, record schema 2 |
| as a builder: the story path's card, `verify_source` on offer |
| reads ONLY `status`, `title`, `reporter.name`, `reporter.beat`, `publishedAt`, `tickers`, `version` — a Proxy records every property touched; and no marker from the unread fields reaches the session, the record or the answer |
| missing, unpublished, version-less, untitled: `404 item_not_found`, nothing written |
| a SignalDrop entry naming an Explore story: `400 item_kind_unsupported`, as on main (review A-3); an item naming a drop: `400 invalid_entry`, as on main |
| the same story twice: `existing: true`, the original question, one investigation counted |
| **a FantasyTimes story opens exactly as on main** (`shared-research.b6a.ftParity.test.js`): the ledger and the builder (open, read, a second open, the list), and a FantasyTimes ledger idea saved (open, step, preview, save, read after) — every answer, the session, the list, the idea version, the quota and every write equal to a golden this same file wrote on a `main` snapshot; the record differs only by `schemaVersion` 1 → 2 |

### 4.3 X-5 and X-5b — `startNow` and `words`

- **Built:** `SharedResearchSheetBody.jsx`:
  - `:70` the props;
  - `:82` the words;
  - `:85` `starting`;
  - `:125-133` the open on mount;
  - `:166-167` navigation ends `starting` (review HB-1);
  - `:201` the opening line.
- **The rows** are in `SharedResearchSheetBody.b6a.jsdom.test.jsx`. "Never drawn first" is watched by a MutationObserver over the whole run, not by a last look.

| Rows |
|---|
| on mount: one open, the item's question and itemRef; the opening line; the preview never drawn; then the work view |
| a direction given: sent, trimmed |
| existing → Continue; no preview, nothing more sent |
| the daily limit → the preview, the server's line, the question kept |
| a refusal → the preview; Try again re-sends the same request id with the question as edited |
| no answer → the preview, the open's own line; Try again re-sends the same request id |
| the gate from the server → the gated preview, no Investigate; the gate passed in → nothing sent |
| a blank question → the preview, nothing sent |
| after the open, three routes back to a story (concluded, discarded, existing → continue) → the preview, nothing re-sent (HB-1) |
| under the app's root StrictMode: one open, no preview while it runs (opened, refused) |
| `startNow` absent / `false` → today's preview, only the list read; `startNow` with mode `start` → today's Start |
| `words`: the box holds them, only the list read; the player continues → sent then (framing; with the builder on, own words); absent → empty; mode `item` with no item → empty |

### 4.4 X-6 — the doors and the reader

- **Built:** `sharedResearch.boundary.test.js`.
  - `doorProblemsOf(files)` states the rule once.
  - It runs on the real `src/` tree and on stand-in files written to a temporary directory and mapped to their `src/` paths, never into `src/`, where another test running in parallel could meet them.
  - The old rows are all covered: lens A checked each against `main`'s file.
- **Routine choice:** Explore's reader may import exactly `{ readExploreInvestigations }` from the service (spec N-4: "only through its read").

| Rows |
|---|
| the real tree holds |
| with stand-ins for both Explore files, it holds |
| a third importer fails: of the body, of the directory, of the service with another call, and a second reader taking exactly the read |
| the doors stay doors: a static import, a second import, a namespace import, a second name, a dynamic import of the service — each fails |
| the hub's door is required |
| the service's importers today: the sheet's hook only |

### 4.5 X-7 — the saved statement on reopen

**Built:**
- `store.js:694`, `:747`: `commitAdoption` takes `adoptionExtra`.
- `store.js:867`: `adoptThesis` adds `{ statement }`, the statement saved, as the idea version holds it.
- **The ledger's save is written exactly as before (review A-1).** The session view carries `adoption` whole.
- `screens/ThesisSaved.jsx:36-37`: the saved screen shows `session.adoption.statement` when the session carries one; otherwise exactly what it showed before.

**Routine choice:** the recorded statement is preferred right after a save on this page too. It is the server's; it differs from the page's own copy only by the idea builder's trim.

| Rows |
|---|
| a thesis saved with the player's edit records the edit (not the composed sentence); the version holds the same; the view carries it |
| a thesis saved as composed records the composed sentence |
| a ledger idea's save: its adoption is `{ watchlistId, version, at }`, keys and order as before; the view the same |
| a session saved before B6a: the view unchanged, and Explore's read reports it saved |
| jsdom: a reopened saved thesis shows the recorded statement; one saved before B6a shows none (the existing 4A-3 row, unedited, still holds); right after a save, the recorded statement is shown |

### 4.6 Q-1 — the answer is yes

- jsdom, saved: `mode: 'session'` on a saved builder shows the saved screen.
- jsdom, concluded: on a concluded builder (the server's own close answer, `closeDeadEnd`, with the read's other keys), the Concluded line.
- Each with no `[data-sr-choices]`, research, free choice, Save, Conclude or composer, and exactly one request: the read.

---

## 5. The mutation table

**43 of 43 killed** on a `git archive` of the final code head `7f46415e`.

**How the battery ran:**
- Each mutant was applied alone in the snapshot, its own test files run, and the file restored byte for byte; every restore was checked.
- A mutant counts as killed only when vitest exits non-zero **and** the row it names is among the failures.
- An anchor that is missing or not unique is recorded as broken. There were none.

**Earlier rounds:**
1. On `ca92d836`, 28 mutants, 27 killed. The survivor was `X6-third-reader-allowed`: the "third importer" row planted only a file importing `takeStep`, which the reader-shape check also caught. A second reader taking exactly the read was added, and the mutant was then killed.
2. After the two lenses' fixes, on `9d67eb32`, 37 of 37 killed.
3. The refuter's round reworked X-1's read. Its mutants were re-cut on the new code, and five more were added for RF-1 to RF-4 and A-3.

| Id | Defect | Killed by (its own row) | Failed / run |
|---|---|---|---|
| X1-discarded-as-last | a discarded investigation reported as `last` (read and kept) | "one discarded: not reported" | 2 / 29 |
| X1-filled-stored-count | `filled` counted from the stored states, not the view's | "`filled` is the view's count…" | 1 / 29 |
| X1-fantasytimes-listed | FantasyTimes / own-words investigations listed (every guard dropped) | "…are not listed…" | 3 / 29 |
| RF1-other-records-read | a record citing another kind taken as an Explore record | "…neither listed nor read…" (the documents counted) | 1 / 29 |
| X1-open-unbounded | the open query without its limit | "the document bound" | 1 / 29 |
| X1-ended-unbounded | the completed query without its limit | "the document bound" | 2 / 29 |
| X1-window-unbounded | the records window without its limit | "the document bound" | 2 / 29 |
| HB2-window-oldest-first | the window oldest first | "newest first past the queries' bounds" | 2 / 29 |
| RF2-no-ended-query | no completed query (only the window) | "an Explore save is kept when 50 newer research records…" | 3 / 29 |
| RF3-window-open-ignored | an open investigation in the window not read | "…found through its record in the window" | 1 / 29 |
| RF4-open-wins | a session seen open and ended counted as open | "a session two reads saw differently counts once, as ended" | 1 / 29 |
| X1-oldest-as-last | the older of two ended investigations as `last` | "two ended on one story" | 2 / 29 |
| M1-last-at-creation | a concluded `last.at` is the creation, not the close | "one concluded (a real close)" | 3 / 29 |
| X1-saved-told-as-concluded | a save reported as concluded | "one saved (a real ledger save)" | 5 / 29 |
| X1-last-only-version-lost | `itemVersion` lost for a story only ended | "one concluded (a real close)" | 5 / 29 |
| X2-deck-read-into-headline | the deck read into the finding | "reads ONLY status, title…" | 2 / 29 |
| X2-sources-read-silently | `sources` read, used nowhere | "reads ONLY status, title…" | 1 / 29 |
| X2-question-leads-as-names | the questions' leads read as names in scope | "reads ONLY status, title…" | 2 / 29 |
| X2-itemVersion-not-stamped-route | the route drops `itemVersion` | "…the version is stamped and shown" | 6 / 29 |
| X2-itemVersion-not-written-session | `openSessionOf` drops it | same | 8 / 29 |
| X2-explore-read-as-fantasytimes | an Explore story read from `fantasyTimesStories` | same | 15 / 29 |
| X2-finding-cites-fantasytimes | the finding cites the wrong collection | same | 2 / 29 |
| X2-unpublished-accepted | a draft story opens | "…is not found (404 item_not_found)…" | 2 / 29 |
| A3-drop-naming-explore | a SignalDrop entry naming an Explore story answers `invalid_entry` | "…answers as on main (item_kind_unsupported…" | 1 / 29 |
| S2-kind-off-the-list | `exploreStories` off the source list | the X-2 row (+ `extension`) | 23 / 92 |
| S2-version-back-to-1 | the schema version back to 1 | `extension` "each list, exactly, for the current schema version" | 2 / 92 |
| X7-statement-from-composed | the saved statement from the composed sentence, not what was saved | "…records the edit…" | 1 / 29 |
| X7-statement-not-recorded | no statement recorded on a thesis save | "a thesis saved as composed…" | 2 / 29 |
| A1-ledger-records-statement | the ledger's save records a statement | "a ledger idea's save is written exactly as before…" (+ parity) | 2 / 31 |
| X7-client-shows-composed | the reopened screen shows the composed sentence | jsdom "a reopened saved thesis shows the statement…" | 2 / 27 |
| X7-client-ignores-recorded | the reopened screen ignores the recorded statement | same | 2 / 27 |
| X5-preview-first | `startNow` draws the preview first | jsdom "on mount: one open with the item's own question…" | 4 / 27 |
| X5-acts-when-absent | `startNow` acts when absent | jsdom "…the preview first, and no open until Investigate" | 2 / 27 |
| X5-ignores-gated-prop | `startNow` sends while gated | jsdom "the gate, passed in…" | 1 / 27 |
| X5-failure-stays-on-opening-line | a refusal leaves the opening line | jsdom "a refusal: the preview with the question kept…" | 4 / 27 |
| HB1-starting-never-ends | `starting` never ends (review HB-1) | jsdom "opened → Conclude → New investigation" | 3 / 27 |
| M3-null-answer-flips | a not-sent open (null) flips to the preview | jsdom "…root StrictMode…" | 2 / 27 |
| X5b-words-sent | `words` sends a request | jsdom "the box holds the words; the only request is the list read" | 2 / 27 |
| X5b-words-not-shown | `words` not shown | same | 3 / 27 |
| M2-words-any-mode | `words` used outside mode `start` | jsdom "words with another mode are not used: mode 'item' with no item…" | 1 / 27 |
| X6-third-door-allowed | a third file allowed to load the body | boundary "any third importer fails" | 1 / 59 |
| X6-third-reader-allowed | any Explore file allowed to import the service | same | 1 / 59 |
| X6-reader-takes-more | the reader allowed more than its read | boundary "the doors stay doors…" | 1 / 59 |

**Not cut, as equivalent (with the reason):**
- **The ownership re-checks on the read's documents** (review M4, RF-5). Every query asks for `userId ==` the caller, and every by-id read follows an id taken from the caller's own documents, so each check passes whatever it is given. They stay as guards.
- **`toStart`'s clear of `starting`** (the refuter). `pickStory` is the only way back to a story preview after mount, and `toStart` leaves for Start.

---

## 6. The review (BUILD_RULES §2)

### 6.1 How it ran

**Why it was required:** the branch is 21 files and about 4,900 lines, past the threshold. About 1,800 of those lines are the parity golden.

**Who ran it** — as the prompt set: two lenses and one refuter, one round. All three were subagents. Each worked on its own `git archive` snapshot, read-only on git and on the working tree.
- **Lens A, compatibility** (nothing existing moved), on the reviewed head `4d4b0e8a`.
- **Lens B, honesty** (what the read and the saved screen claim), on `4d4b0e8a`.
- **The refuter**, on `4d4b0e8a` and on the head with both lenses' fixes, `9d67eb32`. It was handed every finding with the builder's disposition, to refute each with a repro, to attack each fix, and to attack each "no change".

**What came out:**
- **The refuter refuted no finding outright:** every one reproduced. Three were confirmed as real but not defects: Q-b, HB-4 (a state no code path produces) and A-6 (latent).
- **It found the HB-2 fix had introduced a regression (RF-2),** and four more things (RF-1, RF-3 to RF-5). They were fixed in `7f46415e` after the round. As the prompt set one round, those fixes were not re-reviewed; each carries its own row and a killed mutant (§5), and the final checks ran on that head (§7).

**Process notes:**
- Lens A overwrote a scratch probe script of the builder's in the shared scratchpad. Nothing was lost that mattered.
- Lens A did not run Linux. Its note A-7 (Windows-only guard failures) is settled by the Linux suite (§7).

### 6.2 Findings, verdicts and what was done

| Id | Sev. | Finding | Refuter | Done |
|---|---|---|---|---|
| HB-1 / B-1 | should-fix | after a successful `startNow` open, `starting` never cleared: a later story preview (New investigation, the story list) showed "Opening the investigation…" forever, with nothing in flight | CONFIRMED | **Fixed** `82b36cbd`: any move to another screen ends it (`SharedResearchSheetBody.jsx:166-167`). Three rows, one per route back. Mutant HB1 killed. |
| HB-2 | should-fix | X-1's `limit(30)` equality queries return an arbitrary 30 (document-name order, random ids): past 30 completed, `last` could be the older one or missing | CONFIRMED | **Fixed**, in two steps: `82b36cbd` (the newest 50 records), then `7f46415e` after RF-2: the window *finds* sessions beside both exact queries. Rows: newest first past the bounds; RF-2; RF-3. |
| HB-3 | note | the read lists `open` for a story later unpublished, whose new `open` answers 404 | CONFIRMED | Note for the Explore chat (§1.1): continue with `mode: 'session'`. A FantasyTimes story behaves the same today. |
| HB-4 | note | a builder whose record cannot be read reports `filled: null` | CONFIRMED (no code path produces it) | Kept. |
| HB-5 | note | the saved screen shows "already saved", not the statement, on an idempotent save on this page; the ledger's `recovered` shows the page's input | CONFIRMED (also on main) | Kept: out of X-7's letter ("on a reopened investigation"). Founder question Q-B, ruled Nov 21: leave it. |
| A-1 / HB Q-a | blocker unless ruled | X-7 recorded the statement on **every** save, ledger included: a STOP-line area the waiver does not cover | CONFIRMED | **Fixed** `9d67eb32`: only the thesis builder's save records it (`store.js adoptionExtra`). The ledger's save is exactly main's: the parity golden now includes a FantasyTimes ledger save. Mutant A1 killed. The wider reading was founder question Q-A, ruled Nov 21: thesis saves only. |
| HB Q-b | note | a `sample` story would open "From FantasyTimes"; the server does not read `sample` | CONFIRMED (not a defect) | Note for the Explore chat (§1.2). |
| M1 | test gap | the `last.at` mutant survived some runs: the open and the close could share a millisecond | CONFIRMED | **Fixed:** a tick before each close. |
| M2 | test gap | `words` used outside mode `start` survived | CONFIRMED | **Fixed:** a row. |
| M3 | test gap | dropping the null-answer guard survived; no row ran under a root StrictMode | CONFIRMED | **Fixed:** two root-StrictMode rows. |
| M4 / RF-5 | test gap | the ownership re-checks on the read survive their removal | CONFIRMED, equivalent | Kept as guards (§5). |
| A-2 | note | `thesisAnswers.test.js`'s `save()` still models a save from before B6a (no statement) | CONFIRMED | Kept: those states stand for a save made before B6a, which the unedited 4A-3 row needs. The b6a rows carry the new shape. |
| A-3 | note | `signaldrop` + `exploreStories` answered `item_kind_unsupported` on main, `invalid_entry` here | CONFIRMED | **Fixed** `7f46415e`: answers as on main (`shared-research.js`). Row; mutant A3 killed. |
| A-4 | note | `?list=explore&sessionId=` now answers the list | CONFIRMED | Kept: `list=open` already took precedence on main; no client sends both. |
| A-5 | note | the read shares the sheet's 30-GETs-a-minute limiter | CONFIRMED | Note for the Explore chat (§1.1). |
| A-6 | note | "New investigation" matches a story by id only | CONFIRMED, latent | Kept: it needs an Explore id equal to a FantasyTimes auto-id. |
| A-7 | process | about 14 guard files fail on Windows on main and head alike | not testable without Linux | Settled: they pass in the Linux suite (§7). |
| RF-1 | test gap | the "cites `exploreStories`" check was pinned by no row | — | **Fixed:** a row with FantasyTimes and own-words investigations concluded and saved, documents counted. Mutant RF1 killed. |
| RF-2 | should-fix | **the HB-2 fix's regression:** an Explore save dropped off once 50 newer research records of other kinds arrived | — | **Fixed** `7f46415e`: the completed query keeps it. Row; mutant RF2 killed. |
| RF-3 | note | an open investigation missed by the open query (31 open) was not found though its record was in the window | — | **Fixed:** found through the window. Row; mutant RF3 killed. |
| RF-4 | note | a close between the reads could report one session as both `open` and `last` | — | **Fixed:** held once, ended wins. Row; mutant RF4 killed. |

---

## 7. The checks

Run on Linux (WSL), in a private worktree of `~/pd-ci` at the final code head `7f46415e` (`node_modules` linked to an install of the same lockfile, `e457c10d0317`), Node 20.20.2. I read every exit code myself.

| Check | Result |
|---|---|
| Full suite (`TZ=UTC`, `--maxWorkers=8`, under the shared suite lock) | **exit 0** · Test Files **1,587 passed**, 13 skipped (1,600) · Tests **36,442 passed, 0 failed**, 179 skipped (36,621) · 367 s |
| `lint:gate` | **exit 0** |
| `test:rules` (Firestore emulator, JDK 21) | **exit 0** · 46 files · **839 passed** |
| Minified `vite build`, head and `main` `cf35151b` | **exit 0** both |
| FantasyTimes parity against `main` | 2 / 2: the opens and a ledger save equal `main`'s in every answer and document; only the record's schema number differs (§4.2) |
| Mutants | **43 / 43** (§5) |

**The first suite run at `7f46415e` failed on a loaded host:**
- It exited 1 after 798 s, more than twice the 367 s above, with three failures in files that touch nothing of this build:
  - `api/_utils/gemmaClient.test.js`, a 146 ms body-read timing window;
  - `src/screens/BackingPreviewScreen.test.jsx`, a row that ran for 22.7 s;
  - `src/components/League/leagueRawIds.guard.test.jsx`, a 7.5 s row timeout.
- Re-run alone three times on the same head, the three files passed **3 / 3** (72 of 72 rows each time).
- The full suite, re-run on a quiet host, is the green run in the table.
- The suite at `9d67eb32` (before the refuter's round) was green the first time: 36,438 passed, 0 failed, 338 s.

**The Shared Research files, on Linux, against the preamble's baseline.** Every file existing before passes at its baseline count. The one file that grew is the boundary (X-6, 55 → 59). The record-schema files keep their counts except `extension.test.js`, which gains the version-2 row (62 → 63).

| File | Baseline | Now |
|---|---|---|
| `SharedResearchSheetBody.builder.jsdom.test.jsx` (**unedited**) | 156 | 156 |
| `SharedResearchSheetBody.flows.jsdom.test.jsx` (**unedited**) | 37 | 37 |
| `SharedResearchSheetBody.review.jsdom.test.jsx` (**unedited**) | 34 | 34 |
| `SharedResearchSheetBody.states.jsdom.test.jsx` (**unedited**) | 38 | 38 |
| `useSharedResearch.uncertain.jsdom.test.jsx` (**unedited**) | 2 | 2 |
| `sharedResearch.boundary.test.js` (X-6) | 55 | 59 |
| `src/constants/sharedResearch.test.js` (the kinds pin moved, §6.3) | 5 | 5 |
| every other Shared Research file (42) | 1,161 | 1,161 |
| **New:** `shared-research.b6a.route.test.js` · `shared-research.b6a.ftParity.test.js` · `SharedResearchSheetBody.b6a.jsdom.test.jsx` | — | 29 · 2 · 27 |

The five sheet test files, their fixtures, everything under `src/components/CommandCenter/` and `src/components/Explore/`, `firestore.rules`, `firestore.indexes.json` and `src/config/` are byte-identical to `main` (`git diff --stat cf35151b HEAD` on those paths is empty).

**On Windows,** about 14 guard files fail on `main` and on this head alike: they scan with Windows path separators. Lens A listed them; `agentReadCensus.guard` is one. They pass in the Linux run above, which is the record.

---

## 8. The bundle diff

Minified `vite build` of the final code head `7f46415e` against `main` `cf35151b`, both built in the same worktree from the same install, compared file by file with the 8-character content hashes masked. (`7f46415e`'s build is byte-identical to `9d67eb32`'s, hashed names included: the refuter's round changed server code only.)

- **The one content change:** the lazy Shared Research chunk, `SharedResearchSheetBody-*.js`, **149,453 → 149,957 B (+504)**. It holds the body's two props and `starting`, and the saved screen's recorded statement.
- **The entry chunk** (`index-*.js`, 5,084,552 B) is byte-identical once that lazy chunk's hashed name inside it is masked. The 50 chunks that import the entry differ only in the hashed names they import. The second `index-*.js` (615,043 B) has the same name and the same bytes. `index.html` is the same once masked.
- **CSS:** `index-Bt3Ms9P_.css` is the same file on both.
- **Not in any chunk:** the service's new `readExploreInvestigations` (the string `list=explore`), and the new constants (`exploreStories`). No client code calls them yet, so Rollup drops them. They appear once the Explore build imports them.

---

## 9. Questions for the founder

**Q-A. Should a ledger idea's save record its statement too?** — **Ruled by the founder (Nov 21): no, thesis saves only.** That is what is built; no change followed. The reasoning below is kept as the record.
- **As built:** X-7 is built for the **thesis builder's** save. Every thesis saved from now on records its statement on the session (own words, FantasyTimes, SignalDrop or Explore story), and the reopened saved screen shows it. The older "ledger" idea save is written exactly as on `main`.
- **Why not the ledger as well:** X-7's "A save now records…" could be read as every save. But the ledger's saved screen never shows the statement, and the waiver covers the schema number only (review A-1).
- **Recommendation: no.** The builder mode is on, so every new investigation is a thesis builder.
- **If yes:** a one-line change (`adoptIdea` passes the same `adoptionExtra`), plus flipping its row and the parity golden's ledger save.

**Q-B. On an "already saved" answer, should the saved screen also show the recorded statement?** — **Ruled by the founder (Nov 21): leave it.** That is what is built; no change followed.
- **The case:** a thesis saved twice on the same page — the second answer says it was already saved — shows "already saved" in place of the statement, as on `main`. A reopened sheet does show it (review HB-5).
- **Recommendation: leave it.** It is outside X-7's letter ("on a reopened investigation"), and it changes a screen that has its own rows.

---

## 10. The PR description

### Shared Research "Work an idea": B6a, what Explore needs first (dark)

**Nothing changes for any player when this merges.** No Explore story exists yet, and nothing in the app calls the new read or passes the new options. The report is `docs/audits/20261121_BUILD_SHARED_RESEARCH_B6A.md`; its §1 is written for the Explore chat to read alone.

**What it adds:**
- **X-1:** `GET /api/forge/shared-research?list=explore`. The day's quota, and per Explore story the player investigated, its open investigation (with the sheet's own counts) and its last saved or concluded one. No write, no new index, at most 191 documents a call. (`api/forge/shared-research.js:162`, `api/_utils/sharedResearch/store.js:206`, `api/_utils/sharedResearch/explore.js`)
- **X-2:** Explore stories (`exploreStories`) as their own starting kind. `open` reads only the title, reporter, published time, tickers and version, and stamps the version on the session. Everything after the open is today's story path. (`shared-research.js:312-343`, `store.js:177`, `session.js:227`, `opening.js:135`, `src/constants/sharedResearch.js:19-23`)
- **The research record's schema version 2** (the founder's ruling of Nov 21): `exploreStories` appended to the finding source list; records already stored keep 1; nothing reads the number. (`api/_utils/researchRecords/findingRecordKinds.js:23`, `model.js:86`, `extension.test.js`, `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md:30`)
- **X-5 / X-5b:** the sheet body's `startNow` (open at once, no preview first) and `words` (the own-words box prefilled; nothing sent until the player continues). (`SharedResearchSheetBody.jsx:70-133`, `:166-167`, `:201`)
- **X-6:** the boundary allows `src/components/Explore/loadSharedResearch.js` (one load-time import of the body) and `src/components/Explore/useExploreResearch.js` (imports only `readExploreInvestigations`). A third importer fails. (`sharedResearch.boundary.test.js`)
- **X-7:** a thesis save records the statement saved on the session's adoption; the saved screen shows it on a reopened investigation. A ledger save is unchanged. (`store.js:694`, `:747`, `:867`, `screens/ThesisSaved.jsx:36-37`)
- **Q-1:** yes — `mode: 'session'` shows a closed builder investigation read-only; two rows pin it.

**Fences:**
- No fenced file was called or edited.
- Not touched: `src/components/CommandCenter/`, `src/components/Explore/`, `firestore.rules`, `firestore.indexes.json`, `src/config/`. The four sheet test files are unedited.
- A FantasyTimes story opens, and a FantasyTimes ledger idea saves, exactly as on `main`: a golden made on `main` compares every answer and document; only the record's schema number differs.

**Checks (Linux, `7f46415e`):**
- full suite **exit 0, 36,442 passed, 0 failed (1,587 files)**;
- `lint:gate` exit 0;
- `test:rules` exit 0, 46 files, 839 passed;
- minified build exit 0;
- mutants **43 / 43**;
- review: two lenses and one refuter, every finding fixed or ruled (report §6).

**Bundle:** only the lazy Shared Research chunk changes, 149,453 → 149,957 B. The entry is identical apart from that chunk's hashed name, and the CSS is the same file.

**Founder rulings (Nov 21), both as built:**
- Q-A: the statement is recorded on thesis saves only.
- Q-B: an "already saved" answer keeps showing no statement.

No question is open. Report §9.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
