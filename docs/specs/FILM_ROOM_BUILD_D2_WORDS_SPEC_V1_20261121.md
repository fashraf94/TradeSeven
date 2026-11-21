# Film Room Build D spec V1 — Part 2: the agent's words (D2) (2026-11-21)

**Status:** the Film Room chat's spec for D2. It carries the founder's Nov 20 rulings for the beta debrief (FD-1, FD-2, FD-4, FD-5 and FD-6), as Build D reshaped them. The founder approves the rest by sending the D2 build prompt.
**Builds on:** Build D spec V1 (`docs/specs/FILM_ROOM_BUILD_D_FLOW_SPEC_V1_20261120.md`) and its Amendments A to D. D2 is that spec's §13 "the agent's overnight words".
**Destination:** `docs/specs/FILM_ROOM_BUILD_D2_WORDS_SPEC_V1_20261121.md`, with one `docs/README.md` row. No docs-only PR.

## 0. In short

- **What the player gets:** under a swap pin's fact line on the front, one short line in the agent's own voice about that swap. It is written overnight, quoted and dated. For example: "This one wasn't my call. MSFT had stopped moving."
- **How it is made:**
  1. A nightly job reads each admitted battle day's tape after the close pass.
  2. It builds a bounded **day digest** of the day's swaps and the agent's own recorded reasons around each one.
  3. It makes **one model call** per battle day.
  4. Code checks every line. A line that fails a check is dropped, never repaired or asked again.
  5. The surviving lines are stored in one record per battle day, beside the tape.
- **What it doesn't do:**
  - **no idea** (Build D FL-11);
  - **no words for directive pins** (the player's words and the agent's reply are already there);
  - **no words anywhere but the front;**
  - **no change to the old nightly review** (FD-6);
  - **nothing that reaches a trading prompt.**

**The rulings:**

| # | Ruling |
|---|---|
| DW-1 | **The words are the agent's,** shown as a dated quotation. The fact line above them is the Film Room's (FD-1, BC-1). |
| DW-2 | **One line per swap, at most, and none for directives.** At most eight swaps a day get a line, chosen by the front's pin priority (Build D FL-5). |
| DW-3 | **The model reads the day digest only** (FD-2): labels, never ids. No player-written text of any kind, the agent's display name included. |
| DW-4 | **No numbers in the words.** No digit, no number word, no ordinal. The fact line carries the numbers. |
| DW-5 | **Checks drop, never repair.** A line that fails any check in §5 is dropped. The model is asked once per battle day. |
| DW-6 | **One record per battle day,** `agentBattles/{battleId}/debriefs/{etDate}`. Server-written, owner-read, created once (FD-5). |
| DW-7 | **One nightly job,** a new cron entry, after the close pass. One model call per battle day; a day with no swap makes none (FD-4). |
| DW-8 | **Claude Sonnet 5.5,** named in one place. Haiku 5.5 is a one-line switch. Every call's usage and cost are recorded. |
| DW-9 | **The gate is `FILM_ROOM_DEBRIEF_MODE`,** a tri-state merged at `'allowlist'`, server and client. |
| DW-10 | **The front adds exactly one read,** the day's debrief record, and only where the words are on for the owner. |
| DW-11 | **The one-door census gains the `debrief` model path,** and a rule that no other model path reads `debriefs`. |
| DW-12 | **A founder-run sample pack** writes real lines to a local file only, for both models, within a $2 cap. |

## 1. Where the words appear

- **On the front's swap panel** (Build D §7), between the fact line and the link "Open this on the full tape".
- **The line:**
  - the agent's mark, as beside a directive's reply;
  - the words as a quotation (the kit's `Quotation` with `preview`), bound to the record's path, `lines[i].text`, in the document labelled `debrief`;
  - beside them, the record's date in the design's small treatment ("Sep 23"), from `etDateLabel` of the record's `writtenAt` in ET. The visually hidden attribution keeps "the agent" and the instant for assistive technology.
- **A line belongs to one swap** by the tape row's own key (`actions[].key`). A record line whose key the tape no longer holds isn't shown.
- **States, per swap pin:**

| State | The panel shows |
|---|---|
| The record holds a line for this swap | The line, as above |
| No record yet, before the next run (§7) | "Your agent's words arrive by the next morning." |
| No record after the next run, a record with no line for this swap, or a failed record | Nothing beyond the fact line |
| The words aren't on for this owner | Nothing beyond the fact line, and no read |

- **Nowhere else.** Not on the tape view, the hub, the cards, chat, or any prompt.

## 2. The day digest (FD-2)

A new pure, read-only module, `api/_utils/filmRoom/dayDigest.js`, with `DAY_DIGEST_VERSION = 1`. It turns one tape day and its battle into `{ digest, refs }`, or `null` when the day can't be read.

**What `digest` holds, and nothing else:**
- **The day:** whether it reads as the battle's final day, by the front's own predicate (`readsAsFinal`, `src/screens/filmRoomV2/filmRoomFlow.js`). If it does:
  - the result word (`win`, `loss` or `draw`);
  - the two finals, only where the front's key shows both.
- **The archetype's display name,** from `getArchetypeDisplayName`. Never the agent's own display name: the player chose that name, and DW-3 keeps player-written text out.
- **The swaps:** at most eight, chosen as the front chooses pins (the agent's swaps first, then the others, each group in time order), and listed in time order. Each holds:
  - **`label`:** `s1`, `s2`, … in time order;
  - **`time`:** the ET clock of its strict instant (`instantMs`). A swap with no strict instant isn't in the digest;
  - **`maker`:** the front's maker words for its recorded mechanism (`makerKeyOf` and the copy table: "your agent", "the stall rule", "the risk rule", "the guardrail", "the gameplan meeting", "a maker not recorded"). They are carried as facts, never as the agent's words;
  - **`sold` and `bought`:** the symbols, when the tape records them;
  - **`soldAt`:** the recorded exit price, formatted as the front's fact line formats it, when recorded;
  - **`before`:** the agent's recorded words at the latest check at or before the swap: its `rationale` and `hypothesis`, each at most 500 code points;
  - **`after`:** the same, at the first check after the swap.
- **Each quotation is the agent's,** and is marked as its own recorded words at the time. Under Build C CE-1, through `src/utils/promptBoundText.js`, a quotation that holds an identifier is left out whole. One over its bound is left out, never cut. The tape's writer already leaves platform-written rows out of `rationale[]`.

**What `refs` holds:** each label mapped to its tape row's `key`. The prompt never sees `refs`.

**Never in the digest:**
- any id;
- directives, or any player-written text;
- plans, meetings, cards, the ledger, the moment excerpt;
- the replay's hypothetical paths;
- the old nightly review's output.

**The digest doesn't import `momentExcerpt.js`.** Only the census's named exception may (Build C CC-1).

## 3. The prompt and the call (FD-4, DW-8)

- **`api/_utils/filmRoom/debriefPrompt.js`** builds:
  - the system text: the agent, by its archetype's display name, writes one short note per swap for its own player, under §4's rules;
  - the user text: the digest as JSON;
  - the output schema: `{ lines: [{ swap: <one of the digest's labels>, text: <string> }] }`, with at most one item per swap.
- **`api/_utils/filmRoom/debriefModelCall.js`** is the Film Room's one importer of the Anthropic SDK. It follows `api/_utils/sharedResearch/modelTurn.js`:
  - **one structured-output request** (`output_config.format`), effort low, thinking off in the model's own form, `maxRetries: 0`;
  - **one transport retry** on a network error or an overload, inside the deadline;
  - **one model id constant,** `DEBRIEF_MODEL = 'claude-sonnet-5-5'`, with `claude-haiku-5-5` priced beside it;
  - **at most 800 output tokens;**
  - **`usage` and `costUsd`** from the published prices, with `PRICES_AS_OF`;
  - **the key** is `CLAUDE_API_KEY`, never printed or logged.
- **The call is made once** per battle day with at least one swap in the digest. A day with no swap is recorded as `nothing`, with no call.

## 4. What the model is asked to write

The system text states these rules. §5's checks enforce the ones code can test.
- **One line per swap, at most.** It is about that swap only, in the first person, as the agent, to its own player.
- **At most two short sentences,** in plain words.
- **What happened and why,** from the agent's own recorded words. For a swap the agent didn't make, say plainly who made it.
- **No numbers of any kind.** The fact line beside the words shows them.
- **No symbol** but the swap's own and those in its recorded words.
- **No verdict.** Not whether the swap was good or bad, no grade, no lesson, no claim that anything was proven.
- **No line** when there is nothing true to add.

## 5. The checks (DW-4, DW-5)

A pure module, `api/_utils/filmRoom/debriefChecks.js`, runs on the model's output against the digest. Each line either passes every check or is dropped, with a reason code.

| # | Check | Reason code |
|---|---|---|
| 1 | The item names a label in the digest, and no earlier item named it | `label` |
| 2 | The text is a string of 1 to 160 code points after trimming, with no line break and at most two sentence ends | `shape` |
| 3 | No digit | `digit` |
| 4 | No number word: cardinals and their tens, `hundred`, `thousand`, `million`, `billion`, `dozen`, `single`, `half`, `double`, `triple`, `twice`, and the ordinals `first` to `tenth` | `number_word` |
| 5 | Every token of two to five capitals that is a symbol in the app's directory is that swap's sold or bought symbol, or appears in its quotations | `symbol` |
| 6 | No identifier: the exact ids the pass knows (battle, owner, agent) and every shape in `ID_SHAPES` (`promptBoundText.js`) | `identifier` |
| 7 | No word or phrase on the Film Room's forbidden list, matched whole and case-insensitively: biggest, best, worst, mistake, should have, missed, good trade, bad trade, lesson, grade, validated, proven, supported | `forbidden` |

- **A response that doesn't parse,** or matches no schema, has no lines: the record is `failed`, with the reason.
- **If no line survives,** the record is `nothing`.
- **The forbidden list** is one production constant, and a test pins it equal to the harness's `SPEC_FORBIDDEN_WORDS`.
- **Nothing is rewritten:** a stored line is the model's text exactly, trimmed.

## 6. The record (FD-5, DW-6)

`agentBattles/{battleId}/debriefs/{etDate}` is created once with the Admin SDK (`create`, so a second run can't overwrite it):

| Field | Value |
|---|---|
| `version` | 1 |
| `battleId`, `etDate`, `ownerId`, `attributionAgentId`, `archetype` | stamped at write, as the tape and the cards stamp them |
| `status` | `written`, `nothing` or `failed` |
| `reason` | for `nothing` or `failed`: `no_swaps`, `no_lines`, `model_error_*`, `parse`, `deadline` |
| `writtenAt` | the instant of the write |
| `digestVersion`, `digestHash` | `DAY_DIGEST_VERSION` and the SHA-256 of the digest's canonical JSON |
| `tapeWrittenAt` | the tape's own `writtenAt` when read |
| `model`, `usage`, `costUsd`, `attempts` | from the call, or null without one |
| `lines` | `[{ key, label, text }]`: the tape row's key, the digest's label, the words |
| `dropped` | `[{ label, reason }]` |

- **The rules block** sits inside `match /agentBattles/{battleId}`, beside `tape`:

  ```
  match /debriefs/{etDate} {
    allow read: if request.auth != null && resource.data.ownerId == request.auth.uid;
    allow write: if false;
  }
  ```

- **The founder deploys it.** Until then, a client read is denied and the screen treats it as no record.

## 7. The nightly job (FD-4, DW-7)

- **New cron entry:** `/api/cron/film-room-debrief` at `45 3 * * 2-6` UTC. That is 10:45 PM EST or 11:45 PM EDT, after the close pass (`15 2 * * 2-6`) has finished.
  - The count goes from 46 to 47, recorded in BUILD_RULES §6 in the same commit.
  - **Why a new entry, not a branch inside the close pass:** model calls must never share the tape writer's 300-second budget, and a failure here must never touch the tape.
- **The handler:**
  - cron auth;
  - `FILM_ROOM_DEBRIEF_MODE` read at call time: `'off'` answers `{ skipped: true }` before any read;
  - then the pass, in `api/_utils/filmRoom/debriefPass.js`.
- **The day it processes:** the ET date of the run, when the calendar knows it as a session. One date per run, with no catch-up. A missed night is a day with no record.
- **The battles it reads:**
  - the close pass's two candidate queries on `agentBattles` (`status == 'active'`, and `completedAt` on or after the day's start), written again in the pass, never imported from the writer;
  - kept where the battle is tiered (`resolveModeConfig(gameMode).label === 'tiered'`, as `FilmRoomRoute.jsx` tests it) and `isBattleDay` (`src/utils/tapeSchedule.js`);
  - under `'allowlist'`, only owners `isCockpitOwnerAllowlisted` admits;
  - then one `get` of `tape/{etDate}` and one of `debriefs/{etDate}` per battle.

  No collection-group query, and no new index.
- **Per battle day:**
  - skip when the tape is missing, or isn't written, or a record exists;
  - otherwise build the digest; call when it has a swap; check; create the record.
- **Bounds:** at most 4 calls at once, at most 200 calls per run, `maxDuration` 300 with a time floor. A day not reached is left with no record and named in the run's summary.
- **The log:** counts only (selected, written, nothing, failed, not reached, total cost). Never words, ids or keys.
- **Not-yet timing:** `src/utils/debriefSchedule.js` exports:
  - the schedule string (a test pins it equal to `vercel.json`'s entry);
  - `nextDebriefRunMs(tapeWrittenAt)`, the first run after the tape was written.

  The front shows the not-yet line only while now is before that run plus 30 minutes.

## 8. The gate (DW-9)

- **`FILM_ROOM_DEBRIEF_MODE`** in `src/config/featureFlags.js`, with `FILM_ROOM_DEBRIEF_MODES = ['off', 'allowlist', 'on']`. It merges at `'allowlist'`. An unknown value is `'off'`.
- **Server:** as `cardsGate.js` reads its mode: per owner, `isCockpitOwnerAllowlisted` under `'allowlist'`, read at call time.
- **Client:**
  - `resolveFilmRoomDebriefMode` and `filmRoomDebriefOn(mode, verdict)` in `src/utils/filmRoomGate.js`;
  - the same verdict the flow already holds, keyed by battle and owner (Amendment D DD-3), with no new request;
  - the words show only where the flow and the debrief both resolve on.

## 9. The front's read (DW-10)

- **`filmRoomData.js`** gains one reader: one `getDoc` of `agentBattles/{id}/debriefs/{etDate}` per selected day, kept for the screen's life. Permission-denied and not-found both read as no record; any other failure as an error that shows nothing.
- **It is read only when** the front shows for that day and the words are on for the owner. Never on the tape view, never under `'off'`, never for a non-admitted owner.
- **With the words off,** the screen, its reads and its storage are D1's, byte for byte.

## 10. The census (DW-11)

`api/_utils/filmRoom/oneDoor.census.test.js` gains:
- **the `debrief` model path,** roots `api/cron/film-room-debrief.js` and `api/_utils/filmRoom/debriefPrompt.js`. Its known reach is `debriefModelCall.js`, `dayDigest.js` and `debriefChecks.js`. It reaches neither the ledger, `plays`, the moment excerpt nor its named importer;
- **a rule:** no module reachable from any other model path reads a `debriefs` collection or path. It is proved on a synthetic graph, as the `plays` rule is;
- **for the `debrief` path:** `eval`, `new Function`, `node:vm` and `node:worker_threads` as fail-closed loads (Build C CF-11's cheap step, taken here first).

## 11. The sample pack (DW-12)

`scripts/film-room-debrief-sample.mjs` is founder-run, read-only against production, and local-output only:
- it takes an owner uid and a number of recent tape days;
- it reads those battle days the way the pass does;
- it runs the digest, the call and the checks for **both** models;
- it writes one JSON file and one Markdown file under `scripts/output/` (already git-ignored), with each swap's fact, each model's line or drop reason, and each call's cost;
- it stops before the estimated total passes **$2**;
- it never writes Firestore, and never prints a key, a token or an id;
- credentials come from the environment, which the founder sets with a hidden prompt.

Claude Code writes it and tests it on fakes, and never runs it against production.

## 12. What D2 doesn't build

- The idea and "Test this".
- The habits across games.
- Any change to the old nightly review (FD-6). "One debrief, not two" is the launch board's question after launch.
- Words on directive pins, on the tape view, or anywhere but the front.
- A catch-up or backfill mode.
- Anything for trader v1.
