# Build B5 — the book's view for the hub, and one consistent read

**Date:** 26 Nov 2026 · **Branch:** `claude/practice-field-b5-view-for-hub` · **Base:** `origin/main` `22b01810` (fetched first, unchanged at the end) · **Code head:** `793091cc` · **Rulings:** B5-1 to B5-5 (the build prompt) · **Note of record:** `docs/design/20261126_NOTE_TO_PRACTICE_FIELD_BOOK_VIEW_FOR_THE_HUB.md` (committed byte-identical first, `5602d953`, SHA-256 `c1d16a8df5eeab7b392a3361f380235cc7cf5e33b4064836905a508c18b33fe8`) · **Not merged; CI not watched.**

| Question | Answer |
|---|---|
| Does the view carry what the hub asked for? | **Yes.** `archetype { codeId, name }`; `split` with three parts, each with its finished name, its share as text and a number, and each desk's use as finished text plus a bar number; and the desks by their names everywhere. View version 3 on both sides. |
| Does any figure move on an ordinary day? | **No.** On the 13-session run, the 596 leaf fields that differ from `main` are all the version, the two new fields or a desk's name, including the failed check's line (§5.4). |
| Is the page one consistent book? | **Yes.** Astra's B3-C01 and R5 both fail against the B3 reader and pass here, on the real engine with a close committed mid-read. Two passes that both disagree answer "try again" (503). |
| Does "Shadow" reach a player in this module's words? | **No.** A test scans every fixed word (the server's and the client's) and every scene's view. The agent's *own* notes can still say it, because its prompt does (Q-1). |
| Anything for you to rule? | **Four questions (§4.2).** The prompt still says "Shadow" (Q-1). An all-caps or very wide 20-character name overflows the Desks heading at 320 (Q-2). The two others concern readings. |
| Blockers | **None.** Two review lenses, one refuter and a 49-mutant battery (§6). |

## 1. In plain terms

The Command Center's new design turns the hub into your portfolio for a player with an idea book. It needed three things the book's view did not carry. This build adds them and changes nothing else on the Idea book screen except the desks' names.

- **The archetype the book runs under**, by its catalogue id and name, so the hub can draw its figure. It comes from the book's epoch, never from the agent's battle loadout.
- **The split.** How much of the book each desk may use, and how much it uses, under your PH-2 ruling:
  - A desk's share is the sum of its slots' caps in the epoch: 70% for the agent's desk, 20% for the archetype's desk, 10% cash.
  - A desk's use is what its positions were worth at the last close, out of its share of the book's value at that close.
  - The server writes every figure as finished text. The hub gets one plain number per part, only to size the bar.
  - An idea still entering counts as nothing. A book line waiting on data shows the shares and no use.
- **The desks' names.** No player sees "Shadow" in this module's words.
  - The agent's desk is "Atlas’s desk", from your agent's own name. The archetype's desk is "Trend Follower’s desk".
  - With no usable name, they read "Your agent’s desk" and "Your archetype’s desk".
  - The names appear in the strip, the open slots, the calls, the Desks tab, History, the thesis bylines, the failed-check line and every screen-reader label.

It also closes Astra's two recorded cases (B3-13) before any other player sees the screen. The page now reads the book first and last and checks that nothing changed in between. Reading the close's own row first and last also catches the agent's own run after a close. If something changed, the page reads once more. If it changes again, the page says "try again", and the Idea book shows its existing error state.

The review found no blocker. It found nine smaller things; six are fixed, and three are recorded or put to you (§6). Your note's 25 Nov example used reserved amounts. The build follows your PH-2 ruling instead (§2).

## 2. The view's new fields — for the hub's builder

`GET /api/practice-field/book` answers `{ book }` with `book.version === 3`. Two fields are new, and every desk's name is new. Nothing else in the answer changed: on the 13-session run, every one of the 596 leaf fields that differ from `main` is the version, a field below, or a desk's name (§5.4). All money is finished text; the only plain numbers are the share and the bar, for widths.

### `archetype` — B5-1

```json
"archetype": { "codeId": "momentum_chaser", "name": "Trend Follower" }
```

- `codeId`: the archetype the book **runs under**: its epoch's `archetypeCodeId`. It is never the agent's battle archetype; a test gives the agent `degen` and the view still says `momentum_chaser`. The id is a catalogue key, the same for every player with that archetype. It is not a user's id.
- `name`: the registry's display name (`getArchetypeDefinition(codeId).displayName`). If the registry no longer knows the code, the view keeps the id and the name is `null`, for example `{ "codeId": "retired_archetype", "name": null }`. It never throws.
- `archetype` is `null` only when the epoch document can't be read. The split is then `null` too.

### `split` — B5-2

The sample day (the scenes' 27 Nov; book value $99,502.35):

```json
"split": { "parts": [
  { "key": "agent", "desk": "shadow", "name": "Atlas’s desk", "share": { "text": "70%", "number": 0.7 },
    "use": { "amount": { "text": "$24,774.85", "short": "$24,775" }, "of": { "text": "$69,651.64", "short": "$69,652" }, "pct": "35%", "bar": 0.3557 } },
  { "key": "archetype", "desk": "archetype", "name": "Trend Follower’s desk", "share": { "text": "20%", "number": 0.2 },
    "use": { "amount": { "text": "$24,856.65", "short": "$24,857" }, "of": { "text": "$19,900.47", "short": "$19,900" }, "pct": "124%", "bar": 1 } },
  { "key": "cash", "name": "Cash", "share": { "text": "10%", "number": 0.1 } }
] }
```

- **Order:** always the agent's desk, then the archetype's desk, then cash. `key` is `agent`, `archetype` or `cash`. `desk` is the engine's desk id, which the groups, strip and Desks tab also carry, so the hub can match a part to its rows. A desk id is never shown.
- **`share`:** the desk's share of the book, from the epoch the book runs under. A desk's share is the sum of its slots' caps (`rails.slotCapShare`: short 20%; medium 30% + long 40%). Cash's share is the cash floor (`gateConfig.cashFloorPct`, 10%). `text` is the percent as the epoch states it; `number` is the same share from 0 to 1.
  - The three shares sum to exactly 1 in millionths. As decimals they sum to 1 within 10⁻¹².
  - If an epoch's shares don't sum to 1, or a share can't be read, the split is `null` (§3, R-3).
- **`use`** (desks only): the founder's PH-2.
  - `amount`: the marked value at the last close of every position the desk's ideas held there.
  - `of`: the desk's share of the book's marked value at that close. That is the same equity the headline shows (`line.value`), times the share, rounded down to the cent.
  - `pct`: amount ÷ of, as a whole percent, cut rather than rounded up, so "100%" appears only with a full bar.
  - `bar`: the same ratio as a plain number from 0 to 1, stopping at 1.
  - `short`: the amount without cents at $10,000 or more (the table's fit rule).
  - The text shows the true figures, also above the share. The sample's energy idea has gained past its 20%, so it reads "$24,856.65 of $19,900.47 · 124%" with a full bar.
- **An entering idea counts zero.** A name bought after the last close counts zero, because it has no row there. A new book reads `$0.00` of `$70,000.00`, `0%`, bar `0`.
- **An idea finished since the last close still counts.** Say its last sale filled at this morning's window. It held its positions at the last close, so its row of that close counts.
- **A waiting book line** (B3-11) gives each part its share and `use: null`.

On the 13-session run's last close (27 Nov), the agent's desk read $70,872.37 of $70,710.19 (`100%`, bar `1`), and the archetype's $20,086.44 of $20,202.91 (`99%`, bar `0.994`).

**Your note's 25 Nov figures.** The note gives $19,981 for the archetype and $58,301 of $69,933 for the agent. Those are reserved amounts, from before the two new ideas bought. Under PH-2, that close reads $0 for the archetype (its idea was entering) and one held idea for the agent. The build follows the ruling, not the example.

### The desks' names — B5-3

| Where | Before | Now |
|---|---|---|
| `groups[].deskName`, `strip[].deskName`, `desks[].deskName`, `history.items[].deskName`, every `call.deskName` and `lastCall.deskName`, an agent-written thesis's `byline` | `Shadow desk` / `Archetype desk` | `Atlas’s desk` / `Trend Follower’s desk` |
| The failed-check line: a failed call's `text` (which now also carries `deskName`) and a desk's failed `note.text` | `The agent could not complete today's check; nothing changed.` | `Trend Follower’s desk could not complete today's check; nothing changed.` |
| The failed-check line in the strip, after the desk's name (`strip[].text`) | `The agent could not complete…` | `could not complete today's check; nothing changed.` (drawn as "Trend Follower’s desk · could not complete…") |
| An open slot's line (`groups[].text`) | `Long · open · the Shadow desk looks tonight.` | `Long · open · Atlas’s desk looks tonight.` |
| The Desks tab's open slot (`desks[].calls[].text`) | `Open. The Shadow desk looks for an idea at tonight’s close.` | `Open. Atlas’s desk looks for an idea at tonight’s close.` |
| No usable agent name | — | `Your agent’s desk`, and `your agent’s desk` mid-sentence (`Long · open · your agent’s desk looks tonight.`) |
| No archetype name | — | `Your archetype’s desk` / `your archetype’s desk` |

- The agent's name comes from the book's attribution agent (`agents/{attributionAgentId}`). It is used only when that agent's `ownerId` is the caller.
- It is plain text: trimmed, 1 to 20 code points (the agent creation form's own `maxLength`), with no control, line break, lone surrogate or format character (bidi overrides, zero-width spaces). The joiner inside an emoji sequence is allowed.
- Markup is kept as text, and the client draws it as text.
- Anything else falls back to "Your agent’s desk".
- The server finishes every name. The client completes nothing.
- The desk ids (`shadow`, `archetype`), the stored records and the founder script's output are unchanged.

## 3. What changed, by file and line

### 3.1 Server

| File | What | Where |
|---|---|---|
| `api/_utils/practiceField/bookView.js` | The header says how each new figure is derived (B5-1 to B5-3). | `:43` |
| | `BOOK_VIEW_VERSION = 3` (B5-5). | `:93` |
| | The desks' names: `AGENT_GIVEN_NAME_MAX = 20`, `plainGivenName` (plain text; must draw something), `deskNamesOf`, `deskLabel`. | `:114`, `:125`, `:135`, `:145`, `:149` |
| | The use percent is cut, never rounded up; `amountText` gives the text with and without cents. | `:162`, `:196` |
| | Names threaded through every sentence: `bylineOf`, `callOf` (its failed line by its desk), the group head and the open slot (`mid`), `settledTodayGroupOf`, `deriveStrip` (`FAILED_CHECK.strip`), `desksOf` (its failed note and its open line), `finishedView` and its `lastCall`. | `:466`, `:490`, `:507`, `:509`, `:562`, `:591`, `:632`, `:662`, `:667`, `:671`, `:734`, `:753` |
| | The split: `SPLIT_DESKS`, `epochSharesOf` (from the epoch, in millionths, summing to 1), `shareOf`, `deriveSplit` (with the view's one allotment per row). | `:770`, `:779`, `:793`, `:809` |
| | `buildBookView` takes `archetype`, `epoch` and `agentName`, and gives `archetype` and `split`. The strip reads an idea finished since the close by its row there (review A2). | `:858`, `:859`, `:931`, `:945`, `:946` |
| `api/_utils/practiceField/bookViewCopy.js` | `FAILED_CHECK` with its desk as subject (review B1; derived from the stored note). | `:20`, `:21` |
| | `DESK_NAMES` (no "Shadow"; fallbacks; `name`/`mid`), `DESK_LANES` and `SPLIT_CASH_NAME`. | `:60`, `:69`, `:71` |
| | `OPEN_SLOT` by name, with no "the". | `:132` |
| `api/_utils/practiceField/bookViewRead.js` | The header: how a close commits, the book's change marks, the close row's bracket (review A1), the writes that move no mark, and the restated bound. | `:11`, `:31` |
| | `BOOK_READ_PASSES = 2`; `FINISHED_SINCE_CLOSE_MAX`; `isDocId`. | `:73`, `:75`, `:80` |
| | `bookChangeMarks`, `closeRowMark` and `archetypeOf` (the epoch's; unknown → null name, never throws). | `:97`, `:106`, `:124` |
| | `readPass`: the close row read first; the epoch and agent reads; the agent's name only when `ownerId` is the caller; the row of each idea finished since the close; the book and the close row read again last. | `:136`, `:147`, `:165`, `:193`, `:213`, `:215` |
| | `readBookView`: two passes, then `{ tryAgain: true }`. | `:228`, `:235` |
| `api/practice-field/book.js` | 503 `{ error: 'try_again' }` (`TRY_AGAIN_BODY`). | `:17`, `:34`, `:50` |

### 3.2 Client: every line touched under `src/components/PracticeField/`

| File | Line | Before → after |
|---|---|---|
| `useIdeaBook.js` | `:20` | The comment: "2: B3-11's waiting line, B3-12's byline" → "3: B5's archetype, split and desk names" |
| `useIdeaBook.js` | `:21` | `IDEA_BOOK_VIEW_VERSION = 2` → `3` |

No component changed. No field the view already had was renamed. The rest are test files: `IdeaBookScreen.jsdom.test.jsx` (the named scenes, the pins of the new names, the markup row) and `IdeaBookEntry.jsdom.test.jsx` (the version row and the "try again" row).

### 3.3 Tests and test support

- `api/_utils/practiceField/__testsupport__/bookViewScenesHub.js` (new). The B3 scenes, which stay unchanged, with the engine's own epoch (`buildIdeaBookEpochDoc`) and the caller's agent "Atlas" (whose battle archetype is `degen`).
- `bookView.hub.test.js` (new): B5-1, B5-2, B5-3, the scan, privacy.
- `bookViewRead.consistent.test.js` (new): B3-C01, R5, a fill mid-read, an idea finished since the close, the agent's pass mid-read, the two-pass stop, and every scene through the reader.
- Moved with the change: `bookView.test.js` (named scenes and the new pins), `bookView.fixRound.test.js` (the names; the A04 count; the two-closes row turned around to the two-pass stop), `bookView.e2e.test.js` (the split, archetype and names at every close; the new bound), `bookViewCopy.test.js` (the failed-check row turned around: the stored note's sentence with its desk as subject) and `api/practice-field/book.test.js` (two new rows; the 15 existing rows untouched).

No fenced file, rule, index, store write, mode or switch changed. None of B4's files changed (`mode.js`, `founderControls.js`, `ideaBook.js`, `bookStore.js`, `admission.js`, `agentRun.js`, `src/data/practiceFieldSlots.js`, `scripts/`). No fenced function is called by the new code.

## 4. Readings and questions for the founder

### 4.1 Readings — what I decided where the brief was silent (each stands unless you object)

| # | Reading | Why |
|---|---|---|
| R-1 | **The agent's name limit is 20 code points.** A longer name falls back to "Your agent’s desk". It is not cut short. | 20 is the agent creation form's own `maxLength` (`src/components/Agent/AgentCreationFlow.jsx:639`) and the profile prompt's `sanitize(name, 20)` (`api/agent/create-profile.js:142`). The form counts UTF-16 units, so the server's code-point count is the looser of the two. A name cut short is a different name. The rules don't cap a client-written agent document, so the server checks the limit itself. |
| R-2 | **"Plain text" means a trimmed name with no control character, line break, lone surrogate or format character, and at least one character that draws something.** Format characters include bidi overrides and isolates, zero-width spaces, soft hyphens and tag characters. The two exceptions are the zero-width joiner, which emoji sequences use, and the non-joiner, which Persian is written with. Markup is kept as text. | Format characters can make a name look like something else or reorder its sentence. A name that draws nothing would read "’s desk" (review B2). React draws markup as text; a test shows it. |
| R-3 | **If an epoch's shares don't sum to exactly 1, the view carries no split.** The same holds when a share isn't a decimal with at most six places in (0, 1], or when a slot belongs to no desk. | A bar whose widths don't add up would misdraw the book, and scaling would show shares the epoch doesn't hold. Today's epoch sums to exactly 1: 200,000 + 700,000 + 100,000 millionths. |
| R-4 | **With no epoch, there is no archetype and no split.** | The ruling names the epoch's archetype. The book's own `archetypeCodeId` is a stand-in that would diverge at epoch 2. |
| R-5 | **An idea finished since the last close counts in its desk's use, by its row of that close.** | PH-2 says "the positions it holds at the last close", and an idea sold out at this morning's window held its positions at that close. This costs one more read per such idea, at most three (one per slot). The consequence: between a morning sale and the evening close, the split still shows that use while the table shows the slot open, as the table has done for window sales since B3. The strip reads the same row for that close (review A2). |
| R-6 | **The use percent is a whole number, cut and never rounded up** (review A4). So "100%" appears only with a full bar, and 99.6% reads "99%". Each amount has `text` with cents and `short` without them, from $10,000 up (the table's fit rule). | The hub's band draws whole figures. The true dollars always sit beside the percent. |
| R-7 | **The fallbacks are "Your agent’s desk" and "Your archetype’s desk", lower-cased inside a sentence.** A given name or an archetype's name is never re-cased. | "Long · open · Your agent’s desk looks tonight." reads wrong. A player's lower-case name is theirs. |
| R-8 | **The failed-check line names its desk:** "Trend Follower’s desk could not complete today's check; nothing changed." It is the stored note's own sentence with its desk as the subject. In the strip, the desk's name comes first and the verb follows: "Trend Follower’s desk · could not complete…". The note stored on the close row is unchanged. | B5-3 lists the failed-check line by name. Under the new names, "The agent" beside the archetype's desk would mean Atlas (review B1). B3's row pinning the words to the stored note is turned around to pin this derivation. |
| R-9 | **The Desks tab's lane under the archetype's desk still reads "Trend Follower · Short".** | B3 built it so. It now sits under "Trend Follower’s desk", so the name shows twice. |
| R-10 | **Each desk part of the split also carries `desk`, the engine's desk id.** | The hub can then match a part to its groups and strip lines. The id is a key and is never shown. |
| R-11 | **"Try again" is HTTP 503 `{ error: 'try_again' }`, never `{ book: null }` and never 404.** | `{ book: null }` would close an open page (A09/R4), and 404 is the client's settled "off". The hook's existing rule applies: no card on a first read, and an open page keeps its last answer with the error flagged. |
| R-12 | **The marks are the book's `revision`, `execState.lastCloseKey` and `currentEpochId`, plus the last close's window row as stored** (review A1). | Every close moves the first two, in one patch (`close.js:1475`, `:1478`). So does every money move between closes (admission, a fill, a sale). The third moves at epoch 2. The agent's pass after a close moves none of them: no money moves. It writes its calls on the close row, after any manager's exit on an idea. That row is read first and last, so an exit is never paired with a call from before it. |

### 4.2 Questions for you

| # | Question | My recommendation |
|---|---|---|
| Q-1 | **The agent's own words can still say "Shadow."** The model is told "You are the Shadow desk of this player's paper idea book" (`agentConfig.js:119`, `SHADOW_BRIEF`) and "You are the archetype desk…" (`agentPrompt.js:62`). Its notes, reasons and theses are shown as written, so a note can call itself "the Shadow desk"; the B2 run's scripted notes do. Should the prompt be renamed? | Yes, in its own prompt build, which this brief excluded. The prompt should name each desk the way the player sees it. Until then, this module's own words are clean and a test scans them. |
| Q-2 | **A wide 20-character name overflows one place: the Desks tab's 18 px heading.** This is the one place a desk's name can't wrap. "WARRENBUFFETTWANNABE" overflows it by 32 px at 320 (it fits at 390). "W" × 20 overflows by 154 px at 320 and 84 px at 390. Names with a space, and "Supercalifragilistic", fit everywhere (§5.3; pictures `320-b5-fit-desks-*.png`). The fix is one style on the heading in `IdeaBookScreen.jsx` (`overflowWrap: 'anywhere'`), which rule 7 keeps out of this build. | Allow that one line before any player other than you sees the screen: here as a follow-up commit, or in the hub's build, which changes these components next. |
| Q-3 | **R-5:** should an idea finished since the last close count in its desk's use? | Keep the letter of PH-2, as built. |
| Q-4 | **R-8:** the failed-check line now names its desk, and B3's word-for-word row is turned around. Keep it? | Keep it. |

## 5. Tests and checks

### 5.1 The rows

The book's rows are now **205 in 10 files**; B3 left 171 in 9. 37 rows are new, all passing.

| File | Rows | What B5 added or moved |
|---|---|---|
| `api/_utils/practiceField/bookView.hub.test.js` (new) | 22 | **B5-1:** each of the six archetypes, built and read back, with a test agent whose own archetype is a different one (`degen`); an unknown code (code id kept, null name, no throw); no epoch. **B5-2:** the sample day against the stored rows (the shares sum to 1 in millionths; use, of, pct and bar; the use equals the desk's shown position values, §9); a full book; a different epoch's caps; seven epoch shapes that give no split; a new book and a book with no close; entering, bought today, bought after the close; a desk above its share; three waiting lines; an idea finished since the close. **B5-3:** a named agent everywhere; five unnamed forms; the 20-code-point limit (also with emoji); markup as text; nine characters that aren't plain text; names that draw nothing; through the reader (own agent, another user's agent, no agent, too long); the scan for "Shadow" and "archetype desk" over every fixed word (server and client) and every scene, named, fallback and agent-off; every scene unchanged but for the names and the new fields. **Privacy:** every scene read back carries no uid, book, agent, idea or epoch id. |
| `api/_utils/practiceField/bookViewRead.consistent.test.js` (new) | 10 | Astra's B3-C01, with its control; the book's change marks; R5 on the B2 run; a fill mid-read (only the revision moves); an idea finished since the close through the reader (its use, and its strip line, review A2); the agent's pass mid-read at two moments (review A1); the two-pass stop and a one-pass recovery; every scene through the reader equals the view built directly. |
| `api/_utils/practiceField/bookView.e2e.test.js` | 1 | At each of the 13 closes it now also checks the archetype, the split against the stored epoch and rows (computed in the test), the use against the shown position values, the names, the "Shadow" scan beside the agent's own words, the new bound (55 + 3·I) and no agent id. |
| `api/_utils/practiceField/bookView.fixRound.test.js` | 20 | The names (fallbacks: this run has no agent document) and the A04 count (6 queries, ≤ 110 + 6·I). **Turned around:** "two closes during one read" is now the two-pass stop. |
| `api/_utils/practiceField/bookView.test.js` | 64 | On the named scenes: the new names in the states' pins, the failed-check line by its desk (review B1), and a 30 s timeout on the four rows that build every scene. |
| `api/_utils/practiceField/bookViewCopy.test.js` | 5 | **Turned around:** the failed-check sentence is the stored note's sentence with its desk as the subject. |
| `api/practice-field/book.test.js` | 17 | Two new rows: 503 `try_again` when both passes disagree, and 200 when only the first does. **The 15 existing rows are untouched and pass.** |
| `src/components/PracticeField/IdeaBookEntry.jsdom.test.jsx` | 23 | Two new rows: version 3 drawn and version 2 refused (`view_version`); `try_again` as the existing error state (no card, and an open page keeps its last answer). |
| `src/components/PracticeField/IdeaBookScreen.jsdom.test.jsx` | 41 | On the named scenes: the names, the failed strip line, and a new row that draws a name with markup as text in the strip, the headers' labels and the Desks tab. |
| `api/_utils/practiceField/bookViewRead.test.js` | 2 | Unchanged, and passing on the fallbacks. |

Each of the ten states still reads correctly: the state rows of `bookView.test.js` and both jsdom files pass on the named scenes, and §5.3 shows that every frame's words differ only by the names.

### 5.2 Astra's two cases, as she wrote them

- **B3-C01.** This is her two-name R2 fixture.
  - Monday: AAPL at 100 and MSFT at 200.
  - Tuesday: 99 and 202, with conflicting AAPL dividends of $1 and $1.50; the founder rules "none".
  - The read: the daily query captures Tuesday, the idea document's read is held, the real Wednesday close commits at 99 and 205, then the idea read finishes.
  - The answer is exactly the settled Wednesday page: MSFT 205.00, $10,246.93, +$246.93.
  - A control row builds the mixed answer from Tuesday's book and rows with Wednesday's idea. It shows MSFT at $10,096.97, +$96.97 and +$99.97 under "Waiting on data", her figures, so the row can fail.
  - Against B3's reader, copied into a scratch tree by review lens A, the row fails with exactly that answer.
- **R5.** On the B2 run, after 20 Nov's exit, the whole 23 Nov session (its window sale and its close) commits during the History query.
  - The answer equals the settled 23 Nov page, and no idea is both selling and finished.
  - Against B3's reader, the short slot is "selling" while History has XOM.

### 5.3 The fit test at 320 (and 390), and the pictures

**The fit test.** The harness is the real components drawing server-built views, with the app's CSS, in headless Edge; Inter is not installed here, so Segoe UI draws. It measured the longest archetype name ("Fundamental Investor’s desk") with four 20-character agent names, in six frames each at 320 and 390: the strip, the long idea open (its call and byline), the short idea open, both Desks sections and the History sheet.

| Agent name | Frames | Overflow |
|---|---|---|
| "Maximilian Alexander" | 12 | none |
| "Supercalifragilistic" | 12 | none |
| "WARRENBUFFETTWANNABE" | 12 | the Desks tab's heading at 320, by 32 px (2 frames); fits at 390 |
| "W" × 20 | 12 | the Desks tab's heading at 320 by 154 px and at 390 by 84 px (4 frames) |

Every other place a name is drawn wraps. The heading is the one place it can't, because it has no wrap rule; see Q-2 for the one-line fix, outside this build's lane. Three pictures are added beside B3's: `320-b5-fit-desks-20-letter-name.png`, `320-b5-fit-desks-capitals-name.png` and `320-b5-fit-desks-widest-name.png`.

**The pictures.** The harness collected every frame's visible text and screen-reader labels from B3's views and from these.

- 47 of the 390/320 frames changed words, all of them the names. They are re-shot in place in `docs/audits/20261123_B3_PICTURES/`. The two failed-check frames were shot again after the review fix (B1).
- With the names mapped back, no frame differs in any other word.
- The measures: 0 overflow in all 47.
- Unchanged and not re-shot: History's list, the entry cards, and the loading, empty and error pages.
- The desktop frames' words changed too. They were not re-shot, as the brief says.

### 5.4 The 13-session run against `main`

The B2 run's thirteen closes were read at `main` (`22b01810`) and at this build, with the caller's agent "Atlas" seeded beside it, and every leaf field diffed.

- **596 fields differ:** `version` 13; `archetype` 26; `split` 338; the desks' names 213 (every `deskName`, `lastCall.deskName` and agent byline, plus the failed call's new `deskName`); the failed check's words 6 (24 Nov: `strip[].text`, `groups[].call.text`, `desks[].note.text` and `desks[].calls[].call.text`).
- **No figure moved.** The list is in the session scratchpad (`dump13-diff.txt`).

### 5.5 The checks

(filled after the final run at the pushed head)

## 6. The review (BUILD_RULES §2)

### 6.1 How it ran

- **Two lenses**, in parallel, each on its own `git archive` snapshot of `59d7ae5b` (read-only on git and on the shared tree; targeted runs only):
  - **Lens A:** the new figures against the stored rows, and the consistent read.
  - **Lens B:** the names in every sentence and state, and privacy.
- **One refuter** on a fresh snapshot of `36e0702b`, given every finding and the reviewers' repro files, and told to refute each one with a concrete repro.
- **The fixes**, then the fast battery on the final code (§6.4).

### 6.2 What the lenses could not break

**Lens A** found no blocker.

- **The split's figures.** They were checked against an oracle built from the store, never from the view's helpers: for each desk, the sum of `toCents(markedHoldingsValue)` over every idea's row at the close; `of` = floor(equity × share); the two desks' uses summing to the daily row's positions value. The oracle and the view agreed to the cent on 62 full-quality reads across the whole B2 run: after every window, every close and every agent pass.
- **The states covered:** an idea finished since the close; names bought after the close or at the session's window; entering ideas; a settled idea held through a close; a line sale at the next window; a rename; a 2:1 split; a delisting with and without cash; a catch-up over an unobserved session. The waiting states all answered `use: null`.
- **Every write that does not move `revision`:** founder controls, a founder's ruling, entry attempts, the waiting path of exits, the sweep stamp, spend, the window-only catch-up and intraday window rows. Each changes no figure the read pairs. Only the agent's pass touches what the page shows (A1).
- **The read itself.** The book's second read is the last read of a pass. The read bound counted to the header. 503 comes only after two disagreeing passes. `{ book: null }` from a race happens only when a close completes a wind-down, which is correct.
- **Astra's rows against the B3 reader:** 5 of 6 consistent-read rows fail, B3-C01 with her exact mixed answer.

**Lens B** found no blocker.

- **"Shadow", `null`, `undefined`, `NaN`, empty labels or missing names:** none, in page text, dialogs or any `aria-label`. That covers 329 jsdom renders per name kind, at 320, 390 and 1280, with every group, name panel and History sheet opened.
- **The B2 run's 13 closes:** no fixed word says "Shadow", "archetype desk" or "the desk".
- **The sentences:** fallbacks are lower-case mid-sentence, no "the" before a name, and no name is re-cased.
- **Markup** creates no element.
- **Privacy:** the uid comes from the token only; the epoch is read inside the caller's book; the agent's name is used only when it is the caller's own; an `attributionAgentId` of `x/y` is not followed. No uid, book, agent, idea or epoch id appears in any player string.

### 6.3 Every finding and what happened to it

| # | Finding | Refuter | Disposition |
|---|---|---|---|
| A1 | The agent's pass after a close (a manager's exit + its call on the close row) can land inside one pass without moving the book's marks: an "Exit" call beside an idea still holding, a page equal to neither the state before nor after. | **CONFIRMED**, minor (state words only, no figure; a milliseconds window once a day). | **Fixed** (`bookViewRead.js:147`, `:213`, `:215`). The close row is read first and again last; the pass settles only when it is unchanged. Two rows race the agent's pass through the real engine; the one that races during the idea read fails without the fix. |
| A2 | After an idea finishes at a window following the close, the strip for that close is rebuilt from its later (empty) holdings, so "called Exit on XOM" disappears; and (refuter's extension) "held N" undercounts. | **CONFIRMED**, minor; the logic is older than B5. | **Fixed** (`bookView.js:931`, `:946`). The strip reads that idea's row of the close, as the split does. The row fails without the fix. |
| A3 | The share numbers sum to 0.9999999999999999 as decimals. | (note) | **Recorded** (§7). They sum to exactly 1 in millionths. |
| A4 | The whole percent can disagree with the bar: "100%" with a bar of 0.99998. | (note) | **Fixed** (`bookView.js:162`). The percent is cut: "100%" only with a full bar. A mutant (F03) is killed. |
| A5 | Zero or negative equity gives "of $0.00", a null percent and a bar of 0. | (note) | **Recorded.** The engine can't produce it. |
| A6 | An epoch with a zero slot cap has no split, even when its shares sum to 1. | (note) | **Reading R-3** (a cap must be in (0, 1]). |
| B1 | The failed-check line still says "The agent"; a failed call names no desk; B5-3 lists the line by name. | **CONFIRMED** as a miss against B5-3's wording ("names the wrong desk" overstated: it names none). Minor. | **Fixed** (`bookViewCopy.js:20`; `bookView.js:490`, `:632`, `:667`). The desk's name is the subject; the strip shows the verb alone after the name; B3's word-for-word row is turned around (R-8, Q-4). Mutants F04–F06 are killed. |
| B2 | A name that draws nothing is accepted (a bare joiner, Hangul fillers, the braille blank, lone marks), giving "’s desk". | **CONFIRMED**, minor. | **Fixed** (`bookView.js:125`, `:135`). A name must draw something; the joiner rule is stated as built. Mutants F07–F08 are killed. |
| B3 | Two desks can carry the same name (an agent named after the book's archetype); an agent named "Your agent" shows a capital mid-sentence. | **REFUTED** as a ruling breach (B5-3 asks for one name per desk, not different names; a given name is never re-cased). | **Recorded** (§7). |
| B4 | "Ideas the desk passed on" in the client; the fixed-word scan never walks the client's words. | **CONFIRMED** (the scan gap; the wording refers back to the desk and is not a second name). | **Fixed for the scan** (`bookView.hub.test.js`: `IDEA_BOOK_COPY` is scanned too). The client wording is unchanged (rule 7). |
| B5 | A wide 20-character name overflows the Desks tab heading at 320 ("WARRENBUFFETTWANNABE" by 32 px; "MOMENTUMMONSTER2026X" by 37 px; "W" × 20 by 154 px, and by 84 px at 390). | **CONFIRMED**, minor (a 320 px screen and a long unbroken name). | **Q-2.** The fix is one style in the component, outside rule 7. |
| B6 | Some real names are refused: an emoji flag's tag sequence, Persian's non-joiner, a soft hyphen. | **CONFIRMED**, minor (they fall back, the safe side). | **Partly fixed:** Persian's non-joiner is allowed (F09 is killed). Flags and soft hyphens are recorded (§7). |
| B7 | The group header's screen-reader label puts a fallback with a capital mid-label. | (note) | **Recorded** (§7). The client composes it. |

**One aside from the refuter:** the agent creation form's placeholder names (`AgentCreationFlow.jsx:70`) suggest "Shadow". A player who keeps it sees "Shadow’s desk". That is the player's own name, shown as written, not this module's words. It is recorded for whoever owns the form.

### 6.4 The fast battery

`scripts/practice-field/battery/run-battery.mjs`, tiered, `--prior`. The mutant manifests stay in the session scratchpad, because they belong to this PR's code.

| Run | Commit | Mutants | Killed | Survived | Time |
|---|---|---|---|---|---|
| The build (prior: B3's fix-round results) | `36e0702b` | 40 server | 39 | 1 (R03) | 15.3 min, 2 trees |
| After the review's fixes (prior: the first run) | `262c85e9` | 49 server (40 re-anchored, plus F01–F09, one or more per fix) | 48 | 1 (R03) | 12.6 min, 3 trees |
| **Final, at the code head** (prior: the second run) | **`793091cc`** | **49 server** | **48** | **1 (R03)** | **8.8 min, 4 trees** |
| Client (`--rows src/components/PracticeField`) | `793091cc` | 1 (K01: the client still asks for version 2) | 1 | 0 | 0.8 min |

- **The baselines were green:** 1,783 rows in 58 files at the code head. No mutant broke and none timed out, and every target file in every tree was the commit's bytes.
- **R03** (the close key dropped from the book's marks) **is equivalent.**
  - One writer sets `execState.lastCloseKey`: `close.js:1478`. It does so in the same patch that moves `revision` (`:1475`).
  - Creation sets both to their starting values in one document (`ideaBook.js`, `buildExecStateBlock`).
  - So no read can see the close key move without the revision.
  - It is reached on every read (`bookChangeMarks` runs twice a pass). It is kept as a mark so the reader states what a close changes, not what it happens to change today.
- **Each review fix was proved by its own mutant:**
  - F01 is killed only by the row that races the agent's pass during the idea read. The History-timing row passes without the bracket, because reading the close row first already pairs it with the ideas.
  - F02 to F09 are each killed by their rows.

## 7. Recorded for later, not built

- **Five of the 136 priced names can't be drafted from setups.** ADI, TGT and PYPL are outside the setup universe, EA is retired, and BRK.B is spelled BRK-B in the other list (`api/_utils/rankingConfig.js:35`). 131 can be drafted. Nothing in this build touches either list.
- **Two comments disagree on the house universe's size:**
  - `api/_utils/practiceField/agentSources.js:56` says "about 136 names";
  - `api/_utils/practiceField/symbols.js:6` says "228 names" (`rankingConfig.js ALL_TICKERS`).
  
  Neither file is edited by this build, so neither comment is fixed.
- **The record's counts over every finished idea** (the note's "later").
- **A letter under up to 19 stacked combining marks** is a 20-code-point name that draws something, and it is accepted. **An emoji flag's tag sequence** (England, Scotland) and **a soft hyphen** fall back to "Your agent’s desk" (review B2, B6).
- **Two desks can carry the same name** if a player names the agent after the book's archetype ("Trend Follower’s desk" twice), or names it "Your archetype" on an unknown archetype (review B3). It is the player's own choice and changes no figure.
- **The group header's screen-reader label** puts a fallback with a capital mid-label ("Medium idea, Your agent’s desk, Day 4…"). The client composes that label (review B7).
- **The share numbers are exact in millionths** (they sum to 1,000,000), but as decimals 0.7 + 0.2 + 0.1 = 0.9999999999999999 in JavaScript (review A3). A bar built from them as flex or percent widths fills to within 10⁻¹⁶.
