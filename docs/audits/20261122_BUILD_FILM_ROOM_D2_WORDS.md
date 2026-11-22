# Build report — Film Room D2: the agent's words

**Executor:** Claude Code (Opus 5.5), Nov 21, 2026.
**Branch:** `claude/film-room-d2-words`, cut from `origin/main` `56220130`. That commit holds D1 (PR #1102) and `src/screens/filmRoomV2/filmRoomFlow.js`.
**PR:** [fashraf94/TradeSeven#1107](https://github.com/fashraf94/TradeSeven/pull/1107).
**Code head:** `41011ad0`, the sources frozen for the battery.
**Merged tree:** `821fdb25`, which merges `origin/main` `4037df59` (PRs #1098 and #1101) into the branch. Only `docs/README.md` was touched on both sides, and it merged without a conflict.
**Final checks:** `a1a3fc6b`, the merged tree plus one test row. That row kills the battery's one survivor (§11).
**Head:** the commit adding this report. Before the final checks and before the push, `git fetch origin` confirmed that `origin/main` is still `4037df59`, already merged.
**Governing documents:**
- the D2 spec, `docs/specs/FILM_ROOM_BUILD_D2_WORDS_SPEC_V1_20261121.md`, rulings DW-1 to DW-12;
- Build D Amendment C (DC-1, DC-4, DC-8) and Amendment D (DD-2, DD-3, DD-4);
- Astra's D1 confirmation, `docs/audits/20261121_ASTRA_CONFIRMATION_FILM_ROOM_D1.md` (N2 to N5);
- BUILD_RULES §2, §4, §6 and §8.

## Verdict

| | |
|---|---|
| **One open item: R1** | **Two runs of the job at once both ask the model for the same battle day.** Run as the record lens and the refuter both ran it: 2 calls, 1 record, and the second call's $0.0036 lands on no record. The record stays create-only, so nothing is overwritten, but the second call is an ask the spec does not allow. **It blocks criteria 4 ("one ask per battle day") and 8 ("one call per battle day with a swap") as they are written, unless the founder rules overlapping runs out of scope.** Vercel runs the cron once; an overlap needs a manual run (`Bearer $CRON_SECRET`) during the nightly one. Closing it needs a claim stored before the call: a new Firestore path, or a new field on the battle or tape document. That is past the build's items, so it was not built (BUILD_RULES §8). Q-1 asks for the ruling. |
| **The build** | B0 and all fifteen items are built, one commit each, with their tests in the same commit. The §2 review produced two commits, the refuter's round one more, then the merge of current `origin/main` (§1). |
| **Off is off (criterion 1)** | Under `'off'`, the handler returns `{ skipped: true, reason: 'off' }` before it opens the database. The pass reads, calls and writes nothing: rows count zero reads, zero calls and zero writes, with the mode handed in and with it read at call time. On the front, the words `'off'` give D1's reads exactly, the tape alone (`FilmRoomFlow.words.reads.jsdom`). The front with the words off is byte-identical to the front with the words on and nothing to show. D1's own suites pass with a `FILM_ROOM_DEBRIEF_MODE` `'off'` pin. One difference stands as a question: with the flow `'on'` and the words `'allowlist'`, the screen asks the owner's verdict where D1 would not (P9, Q-9). That cannot happen at the merged values, where the flow is `'allowlist'`. |
| **Only admitted owners (criterion 2)** | Server: `filmRoomDebriefOnFor` (`api/_utils/filmRoom/debriefGate.js`) admits only `'on'`, or the cockpit allowlist under `'allowlist'`. Client: `filmRoomDebriefOn` with the owner's cached verdict. Another owner's battle day is never read, called for or written (rows). |
| **The model sees only the digest (criterion 3)** | The digest is labels, times, makers, symbols, the sold price, and the agent's recorded words, with no id of any kind. A quotation holding an id, the agent's own display name (in any case, joined by any spaces or dashes), or an invisible or direction character is left out whole. There are no directives, plans, meetings, cards, ledger, excerpt or old review. The archetype is named only from the display table, so an unknown code is no name (M1, Q-3). The Sep 23 digest is pinned by SHA-256 (§4). |
| **Every stored line passed every check (criterion 4)** | The seven checks of §5 run in order; a line that fails is dropped with its reason, never rewritten. The model is asked once per battle day, with one transport retry for a network error or a 529, and never after an answer arrives. The exception is R1, overlapping runs. Where the checks go past §5's letter, it is listed in §7 and asked in Q-4. |
| **The words are the agent's (criterion 5)** | The kit's `Quotation` is bound to `lines[i].text`, attributed to "the agent" at `writtenAt`, with the record's ET date under it (B4, Q-12). It sits only under its own swap pin's fact, matched by the tape row's key. Nowhere else shows it: in Chromium the tape view holds 0 debrief quotations. The whole line is shown, never clamped (the review's P2 and B1, checked in Chromium at 320 to 1440). |
| **Nothing reaches another model path (criterion 6)** | The census gains the `debrief` path, which reaches the call, the digest, the checks, the pass and the record's collection. A rule says no module reachable from any other path names `debriefs`. The debrief path fails closed on `eval`, `Function` (called or taken as a value), `node:vm`, `node:worker_threads`, `node:child_process`, `node:inspector` and `node:repl`. |
| **The record (criterion 7)** | `agentBattles/{id}/debriefs/{etDate}`: a read only for the battle's owner, and no client write (the rules block and its emulator suite). The server writes it with `create` only; a second run's `create` is refused, never overwritten. |
| **Bounded cost (criterion 8)** | One call per battle day with a swap, and none without one. At most 4 at once and 200 per run, with a 30 s floor before each battle day and each call, and a per-call deadline never past the run's. The output cap is 800 tokens. `usage`, `costUsd` and `attempts` are on every record that made a call, and the run's summary carries its total. Exceptions: R1, and a call aborted at its deadline, which records null usage (Q-6). |
| **One read (criterion 9)** | The front adds exactly one read, `agentBattles/{id}/debriefs/{etDate}`, cached per battle, owner and day, and only where the words are on for that owner (`FilmRoomFlow.words.reads.jsdom`, with the real readers). |
| **Part 2 (criterion 10)** | DC-1, DC-4, DC-8, DD-2, DD-3 and DD-4 are built. Each reproduction was written first and failed at `56220130`. N2 and N5 were also reproduced in Chromium against the base and the head (§3). |
| **Fences (criterion 11)** | Held. No BUILD_RULES §1 file and no fenced file is in the diff. What the diff touches outside the new modules is declared in §8. No secret appears in any output, log or file. |
| **Merged tree (criterion 12)** | Green on Linux at `a1a3fc6b`, the tree merged with current `origin/main` `4037df59`:<br>• the full suite: **1,641 test files passed, 0 failing; 37,474 tests passed, 179 skipped, 0 failed**;<br>• `lint:gate`: exit 0;<br>• the rules suite: **47 files, 854 / 854**;<br>• the flow's and the debrief's suites under `TZ=America/Chicago`: 75 files, 1,852 / 1,852;<br>• `vite build`: exit 0.<br>The same full suite and `lint:gate` passed at the merge commit `821fdb25` (37,473 tests). |
| **Review** | Five lenses and one refuter. Thirty-eight items were reported, findings and questions together, and 35 of them are distinct. The refuter REFUTED none. The refuter's check of the fixes found three partial fixes and six new items (N1 to N6). Every confirmed defect the spec's words decide is fixed, each with a row that fails on the code before it and a revert mutant. The rest are questions (§14). |
| **Mutants** | **78 / 78 killed**, judged by exit code and a fresh JSON report. 77 were killed on the first pass. The one survivor, Y-R3own (the clone-owner check dropped, which the new parent check masked), is not equivalent: the row `a1a3fc6b` adds kills it. They ran in four LF `git archive` trees of the frozen code `41011ad0`, after a clean baseline of the 16 test files the spec names (517 rows). Every tree's mutated files were byte-identical to the commit afterwards (§11). |
| **Questions** | 14, numbered in §14. Q-1 (R1) blocks as written; the rest do not. |

## 1. The items

| # | Item | Commit | Tests | Mutants (killed / run) |
|---|---|---|---|---|
| B0 | The D2 spec, Astra's D1 confirmation and Amendments C and D, committed verbatim, with one README row each | `ea75d6ca` | — | — |
| 10 | **DC-1:** a final day also needs a completed battle (`filmRoomFlow.js`) | `6720284a` | `filmRoomFlow.d2carried.test.js`, `filmRoomFlow.fixround.test.js` (one row moved) | 1 / 1 (R1) |
| 11 | **DC-4:** a click is a fourth trigger (`FilmRoomScreenV2.jsx` `onClickCapture`) | `cb175062` | `FilmRoomFlow.d2carried.jsdom.test.jsx` | 1 / 1 (R2) |
| 12 | **DC-8:** ties at the low are compared on displayed hundredths (`filmRoomFlow.js` `lowOf`, and the harness's oracle) | `fdcf42ef` | `filmRoomFlow.d2carried.test.js`, `FilmRoomFlow.d2carried.jsdom.test.jsx` | 1 / 1 (R3) |
| 13 | **DD-2:** a wheel or trackpad scroll counts as interaction (a window `wheel` listener, active while the tape can still be held) | `afaa56d6` | `FilmRoomFlow.d2carried.jsdom.test.jsx` | 1 / 1 (R4) |
| 14 | **DD-3:** one identity record (battle id, nullable owner) for the verdict, the front-seen marker and "Game flow" (`filmRoomGate.js` `filmRoomIdentityOf`, `sameFilmRoomIdentity`) | `1c615404` | `filmRoomGate.identity.test.js`, `FilmRoomFlow.d2carried.jsdom.test.jsx`, `FilmRoomFlow.screen.fixround.jsdom.test.jsx` (FRC-2's line) | 3 / 3 (R5a N4, R5b N3, R5c the verdict) |
| 15 | **DD-4:** exact grouping by integer cross-products (`choosePins` `dt` and `span`, `groupPins` `closer`) | `31b3c918` | `filmRoomFlow.d2carried.test.js`, `FilmRoomFlow.fixround.jsdom.test.jsx` (a 1e-9 tolerance on one D1 float row) | 1 / 1 (R6) |
| 1 | **The gate:** `FILM_ROOM_DEBRIEF_MODE = 'allowlist'` and `FILM_ROOM_DEBRIEF_MODES` (`featureFlags.js`); the server's `filmRoomDebriefMode` and `filmRoomDebriefOnFor` (`debriefGate.js`); the client's `resolveFilmRoomDebriefMode`, `filmRoomDebriefOn` and `filmRoomFrontVerdictAsked` (`filmRoomGate.js`) | `775da1ae` | `filmRoomDebriefFlags.test.js`, `debriefGate.test.js`, `filmRoomGate.debrief.test.js` | 4 / 4 (G1s, G1c, G2, G3) |
| 2 | **The day digest,** `api/_utils/filmRoom/dayDigest.js`, with the Sep 23 golden pinned through the real close-pass writer. Also: `allPinsOf` and the pin comparators exported from `filmRoomFlow.js`; `filmRoomCopy.js` `debrief.makers`; `.js` specifiers in `filmRoomModel.js` | `65c05996` | `dayDigest.test.js` (unmocked import, BUILD_RULES §4), `filmRoomCopy.inventory.jsdom.test.jsx`, `filmRoomFlow.test.js` | 6 / 6 (D1–D6) |
| 3 | **The prompt and the call:** `debriefPrompt.js` and `debriefModelCall.js` | `01b67660` | `debriefPrompt.test.js`, `debriefModelCall.test.js` (a fake client throughout) | 2 / 2 (K1, K2) |
| 4 | **The checks:** `debriefChecks.js` | `7473ae83` | `debriefChecks.test.js` | 8 / 8 (C1–C7, one per check; C8 a repair instead of a drop) |
| 5 | **The pass and its cron:** `debriefPass.js`, `api/cron/film-room-debrief.js`, `src/utils/debriefSchedule.js`, the `vercel.json` entry, and BUILD_RULES §6 46 → 47 | `134a66ab` | `debriefPass.test.js`, `film-room-debrief.test.js`, `debriefSchedule.test.js`; the three api/ cron-count pins moved (§8) | 4 / 4 (P1–P4) |
| 6 | **The rules block** for `agentBattles/{id}/debriefs/{etDate}` | `fb46aaf3` | `test/rules/filmRoomDebriefs.rules.mjs` (emulator), `debriefRules.test.js` | — (the emulator suite) |
| 7 | **The front:** `readDebrief` and `useDebriefDay` (`filmRoomData.js`); the swap panel's three states (`FilmRoomFlow.jsx` `wordsOfPin`, `AgentWords`); `FilmRoomScreenV2.jsx` `wordsOn`; the harness's debrief channel | `32835ef7` | `FilmRoomFlow.words.jsdom.test.jsx`, `FilmRoomFlow.words.reads.jsdom.test.jsx`; a debrief `'off'` pin in three D1 suites (§8) | 3 / 3 (F1–F3) |
| 8 | **The census:** the `debrief` model path (10 paths, 22 roots), the `debriefs` rule, and the fail-closed loads | `60675b1e` | `oneDoor.census.test.js` | 2 / 2 (X1, E1) |
| 9 | **The sample pack,** `scripts/film-room-debrief-sample.mjs`, written and tested on fakes and never run | `3820182d` | `scripts/film-room-debrief-sample.test.js` | — |
| — | The digest's `rationaleAt` helper renamed (`rationaleRowOf`): the T0b census reads the old name as a decision field | `d2fcfc7c` | the full suite | — |
| — | The review round, part 1: the model and record lenses' findings | `d996b683` | rows in each suite above | 12 / 12 (Y-M1 … Y-R6; Y-R3own by the row `a1a3fc6b` adds) |
| — | The review round, part 2: the player, census and browser lenses' findings | `b6f800bb` | rows in each suite above | 22 / 22 (V1a–V15, X2–X4) |
| — | The refuter's round: three partial fixes completed, and N2 to N5 | `41011ad0` | rows in each suite above | 7 / 7 (W1–W7) |
| — | Merge of `origin/main` `4037df59` | `821fdb25` | the checks (§9) | — |
| — | The battery's one survivor killed by a row: another owner's clone document naming the owner's own agent is refused | `a1a3fc6b` | `debriefPass.test.js` | Y-R3own killed |

## 2. The rulings DW-1 to DW-12

| # | Ruling | Where it is built | Proved by |
|---|---|---|---|
| DW-1 | The words are the agent's, a dated quotation; the fact line above them is the Film Room's | `FilmRoomFlow.jsx` `AgentWords`: the kit's `Quotation` (`preview`, `docLabel="debrief"`, no clamp) bound to `lines[i].text`. The attribution "the agent" at `writtenAt` is kept for assistive technology, and the record's ET date sits under the line | `FilmRoomFlow.words.jsdom.test.jsx` (`quoteDefects`, `debriefWordsDefects`); Chromium (§7 item 6) |
| DW-2 | At most one line per swap, none for directives; at most eight swaps, by the front's pin priority | `dayDigest.js` (`DIGEST_SWAP_LIMIT` 8; the front's `allPinsOf` and `comparePinsByPriority`, then time order); check 1 (a label once); `wordsOfPin` (swap pins only) | `dayDigest.test.js` (nine becomes eight); `debriefChecks.test.js` (label); the words suite (directive pins) |
| DW-3 | The model reads the digest only: labels, never ids; no player text, the display name included | `dayDigest.js`: no id field; quotations through `promptQuoteText` and left out whole when they hold an id, the display name or an invisible character; no directives; the archetype only from the display table. `debriefPrompt.js`: the archetype's display name, or "the agent" | `dayDigest.test.js` |
| DW-4 | No numbers in the words | Check 3 (`\p{N}`) and check 4 (§5's words with their forms, §7) | `debriefChecks.test.js` |
| DW-5 | Checks drop and never repair; one ask per battle day | `checkDebriefLines` (nothing rewritten, only trimmed); `runDebriefCall` (one transport retry, never after an answer; `maxRetries: 0`) | `debriefChecks.test.js`, `debriefModelCall.test.js`; mutants C8, K1, K2. Overlapping runs: R1 / Q-1 |
| DW-6 | One record per battle day, server-written, owner-read, created once | `debriefPass.js` (`create`); the `firestore.rules` `debriefs` block | `debriefPass.test.js`; `test/rules/filmRoomDebriefs.rules.mjs`; mutant P1 |
| DW-7 | One nightly job after the close pass; one call per battle day; none without a swap | `api/cron/film-room-debrief.js`; `vercel.json` `45 3 * * 2-6`; `debriefPass.js` | `debriefPass.test.js`, `film-room-debrief.test.js`, `debriefSchedule.test.js` (the schedule read off its own string and set against the close pass's schedule and `maxDuration`); mutants P2, V15 |
| DW-8 | Claude Sonnet 5.5 in one place; Haiku 5.5 a one-line switch; usage and cost recorded | `debriefModelCall.js` `DEBRIEF_MODEL`, `MODEL_PRICES`, `PRICES_AS_OF` | `debriefModelCall.test.js` |
| DW-9 | `FILM_ROOM_DEBRIEF_MODE`, merged at `'allowlist'`, server and client | `featureFlags.js`; `debriefGate.js`; `filmRoomGate.js` | `filmRoomDebriefFlags.test.js`, `debriefGate.test.js`, `filmRoomGate.debrief.test.js`; mutants G1s–G3 |
| DW-10 | The front adds exactly one read, only where the words are on | `filmRoomData.js` `readDebrief` and `useDebriefDay` (keyed by battle, owner and day); `FilmRoomScreenV2.jsx` `wordsOn` | `FilmRoomFlow.words.reads.jsdom.test.jsx`; mutants F1, V11 |
| DW-11 | The census gains the `debrief` path and the `debriefs` rule | `oneDoor.census.test.js` | the census's D2 rows; mutants X1–X4, W6, W7 |
| DW-12 | A founder-run sample pack: both models, a $2 cap, local files only | `scripts/film-room-debrief-sample.mjs` (no Firestore write; battles named "battle N"; no id, key or token in its output) | `scripts/film-room-debrief-sample.test.js` (fakes only; never run) |

## 3. D1's six carried fixes: the reproductions first

Every reproduction row was written before its fix and run at `56220130`, in an LF `git archive` tree:
- **jsdom and the model:** 14 rows failed by assertion, and the 15 controls passed.
- **Chromium,** headless through playwright-core on a fixture page served by vite, base and head:
  - **N2:** on the base, a wheel over the pending tape let the admission replace it with the front, and leaving left no mark, so the notice showed again on remount. On the head, the tape is kept and marked, and the notice shows 0 times.
  - **N5:** at a 370 px viewport the base drew one "1–2" group with a stepper. The head draws two groups.

The browser lens repeated both on the review head:
- a wheel, a trackpad-style wheel and a wheel over the 1440 margin all hold on the head and not on the base;
- a resize sweep over 3,483 widths found 0 grouping mismatches on the head, against 5 on the base, all at exact boundaries.

The census lens swapped the eight changed sources back to their base versions under the head's tests: every reproduction row failed by assertion and every control passed.

| Fix | What changed | Row that proves it |
|---|---|---|
| DC-1 | `isFinalDay: true` is final only with `battle.status === 'completed'` | `filmRoomFlow.d2carried.test.js` (DC-1) |
| DC-4 | `onClickCapture={holdTape}` on the screen: a click with no pointer-down, key-down or focus before it holds the tape | `FilmRoomFlow.d2carried.jsdom.test.jsx` (DC-4: `element.click()`, an `aria-pressed` toggle) |
| DC-8 | `lowOf` compares each check, and the earliest on a tie, on `hundredthsOfShown(fmtPoints(v))` | `filmRoomFlow.d2carried.test.js` (−92.001 at 1:30 and −92.004 at 1:45 give "Low −92 · 1:30 PM") |
| DD-2 | A window `wheel` listener (capture, passive) calls the hold while it is possible | `FilmRoomFlow.d2carried.jsdom.test.jsx` (N2) |
| DD-3 | `{ battleId, ownerId }` compared strictly for the verdict, `seenFrontFor` and `fromFrontFor` | `filmRoomGate.identity.test.js`; `FilmRoomFlow.d2carried.jsdom.test.jsx` (N3, N4) |
| DD-4 | Pins carry `dt` (the clamped elapsed ms) and `span`; two pins merge when `|dt₁ − dt₂| · drawable < 44 · span` | `filmRoomFlow.d2carried.test.js` (N5 at 329, 330 and 331 px) |

## 4. The Sep 23 digest (the golden)

The digest is built from `sep23Day` (`api/_utils/filmTape/__fixtures__/screenFixtures.js`) through the real close-pass writer (`writeTapeDay`, at the fixture's night). That is the tape the job reads at 03:45 UTC.

The canonical JSON has sorted keys and no whitespace. It is **1,943 bytes**, and its **SHA-256 is `0e345ebfb269150e2bebb91aa88c6925590664cd0292593a2bdbe5a7f52ccf05`**. The hash is the same under `TZ=UTC` and under `TZ=America/Chicago`, and under plain Node outside vitest, which also proves the digest's import graph loads in Node's own ESM loader. It is pinned in `api/_utils/filmRoom/dayDigest.test.js`.

The canonical bytes, which are the call's user text:

```json
{"archetype":null,"day":{"final":true,"finals":{"cpu":"−93","you":"−47"},"result":"win"},"swaps":[{"after":{"at":"12:45 PM","hypothesis":"With MSFT gone by rule, CRWD is now a holding; PLTR remains the entry being waited on.","rationale":"The platform rule exited MSFT before this check ran and placed CRWD in the slot. PLTR tagged 158 and pulled back again; a 15-minute close above it comes before rotating DE out.","saidBy":"the agent, in its own recorded words at the time"},"before":{"at":"12:30 PM","hypothesis":"A hold above 158 at the next check is the trigger for PLTR; MSFT stays the exit candidate.","rationale":"Nothing in the book has crossed a threshold since the last check. PLTR pulled back from 158 and is holding the pullback on lighter volume.","saidBy":"the agent, in its own recorded words at the time"},"bought":"CRWD","label":"s1","maker":"the stall rule","sold":"MSFT","soldAt":"498.79","time":"12:45 PM"},{"after":{"at":"2:00 PM","hypothesis":"PLTR took the slot; PANW is next in line if it holds over 386.","rationale":"PLTR held into the check, so DE goes out and PLTR comes in, on the plan carried since noon. PANW sits at 385.","saidBy":"the agent, in its own recorded words at the time"},"before":{"at":"1:45 PM","hypothesis":"A hold above 159 at 2:00 is the trigger: DE out, PLTR in.","rationale":"PLTR is pressing 159 with volume building into the hour, and DE has still not moved.","saidBy":"the agent, in its own recorded words at the time"},"bought":"PLTR","label":"s2","maker":"your agent","sold":"DE","soldAt":"468.43","time":"2:00 PM"},{"before":{"at":"2:45 PM","hypothesis":"If PANW holds 386 at 3:00, ETN goes out for it.","rationale":"PANW held 386 into this check and ETN is still flat, so the plan for 3:00 is ETN out and PANW in.","saidBy":"the agent, in its own recorded words at the time"},"bought":"PANW","label":"s3","maker":"the stall rule","sold":"ETN","soldAt":"385.77","time":"3:00 PM"}]}
```

The same, indented:

```json
{
  "day": {
    "final": true,
    "result": "win",
    "finals": {
      "you": "−47",
      "cpu": "−93"
    }
  },
  "archetype": null,
  "swaps": [
    {
      "label": "s1",
      "time": "12:45 PM",
      "maker": "the stall rule",
      "sold": "MSFT",
      "bought": "CRWD",
      "soldAt": "498.79",
      "before": {
        "saidBy": "the agent, in its own recorded words at the time",
        "at": "12:30 PM",
        "rationale": "Nothing in the book has crossed a threshold since the last check. PLTR pulled back from 158 and is holding the pullback on lighter volume.",
        "hypothesis": "A hold above 158 at the next check is the trigger for PLTR; MSFT stays the exit candidate."
      },
      "after": {
        "saidBy": "the agent, in its own recorded words at the time",
        "at": "12:45 PM",
        "rationale": "The platform rule exited MSFT before this check ran and placed CRWD in the slot. PLTR tagged 158 and pulled back again; a 15-minute close above it comes before rotating DE out.",
        "hypothesis": "With MSFT gone by rule, CRWD is now a holding; PLTR remains the entry being waited on."
      }
    },
    {
      "label": "s2",
      "time": "2:00 PM",
      "maker": "your agent",
      "sold": "DE",
      "bought": "PLTR",
      "soldAt": "468.43",
      "before": {
        "saidBy": "the agent, in its own recorded words at the time",
        "at": "1:45 PM",
        "rationale": "PLTR is pressing 159 with volume building into the hour, and DE has still not moved.",
        "hypothesis": "A hold above 159 at 2:00 is the trigger: DE out, PLTR in."
      },
      "after": {
        "saidBy": "the agent, in its own recorded words at the time",
        "at": "2:00 PM",
        "rationale": "PLTR held into the check, so DE goes out and PLTR comes in, on the plan carried since noon. PANW sits at 385.",
        "hypothesis": "PLTR took the slot; PANW is next in line if it holds over 386."
      }
    },
    {
      "label": "s3",
      "time": "3:00 PM",
      "maker": "the stall rule",
      "sold": "ETN",
      "bought": "PANW",
      "soldAt": "385.77",
      "before": {
        "saidBy": "the agent, in its own recorded words at the time",
        "at": "2:45 PM",
        "rationale": "PANW held 386 into this check and ETN is still flat, so the plan for 3:00 is ETN out and PANW in.",
        "hypothesis": "If PANW holds 386 at 3:00, ETN goes out for it."
      }
    }
  ]
}
```

`refs` are never in the prompt:
- `s1` → `swap:2026-09-23T16:45:08.000Z|MSFT|CRWD`
- `s2` → `swap:2026-09-23T18:00:05.000Z|DE|PLTR`
- `s3` → `swap:2026-09-23T19:00:10.000Z|ETN|PANW`

`s3` has no `after`: the first check after 3:00:10 PM records no words. `archetype` is null because the fixture's agent carries the legacy code `momentum`, which is not in the display table (M1; see Q-3). The golden's hash moved once during the build, from `2cc5d560…c481` to `0e345ebf…f05`, when the M1 fix replaced the humanized "Momentum" with null.

## 5. The system text, as built

For the Sep 23 digest. The first line names the archetype's display name when the digest has one ("You are the Contrarian agent: …"), and otherwise reads "You are the agent: …". It never names the agent's own name (DW-3).

```
You are the agent: a trading agent that runs one stock portfolio in a game, for one player. Tonight you write a few words to your own player about today's swaps — one short note per swap, in your own voice.

You get today's digest as JSON. Each swap has a label (s1, s2, and so on), its time, who made it, the symbol it sold and the symbol it bought, and — where you recorded them — your own words at the check before the swap and at the check after it.

Rules:
- At most one line per swap, about that swap only. Write in the first person, as yourself, to your own player.
- At most two short sentences, in plain words, under 160 characters.
- Say what happened and why, from your own recorded words in the digest. For a swap you did not make, say plainly who made it.
- No numbers of any kind: no digits, no number words, no ordinals. Your player sees the numbers beside your words already.
- Name no symbol except the swap's own and those in its recorded words.
- No verdict: never say whether the swap was good or bad, give no grade, draw no lesson, and never claim that anything was proven.
- Never use these words or phrases: biggest, best, worst, mistake, should have, missed, good trade, bad trade, lesson, grade, validated, proven, supported.
- Use only what the digest says. When there is nothing true to add about a swap, write no line for it.

Answer with JSON only: {"lines": [{"swap": "<the swap's label>", "text": "<your line>"}]}.
```

The user text is the digest's canonical JSON (the bytes in §4). The output schema is `{ lines: [{ swap: <an enum of the day's labels>, text: <string> }] }`, with every object closed. Structured outputs accept no array-count constraint, so "at most one item per swap" is enforced by check 1.

## 6. Planning cost per battle day

These figures use the Sep 23 prompt's measured size: system 1,451 bytes, user 1,943 and schema 278, which is 3,672 in all. They are given at 4 bytes per token and at 3 bytes per token. The list prices are Sonnet 5.5 at $2 / $10 per million tokens and Haiku 5.5 at $0.10 / $0.50, from `MODEL_PRICES`, as of 2026-11-21.

| Model | Input tokens (est.) | Typical (≈ 120 output tokens) | Worst (800 output tokens, the cap) |
|---|---:|---:|---:|
| Claude Sonnet 5.5 (`DEBRIEF_MODEL`) | 918–1,224 | $0.0030–$0.0036 | $0.0098–$0.0104 |
| Claude Haiku 5.5 | 918–1,224 | $0.00015–$0.00018 | $0.00049–$0.00052 |

**The upper bound of any day:** eight swaps, every quotation at 500 code points (20,513 bytes), at 3 bytes per token and 800 output tokens. That comes to Sonnet $0.022 and Haiku $0.0011.
- **Under `'allowlist'`** (two owners, a handful of battle days a night), the job costs cents a night.
- **At the run cap** (200 calls), the worst case is about $4.34 on Sonnet.

Every record that made a call carries its `usage` and `costUsd`, and the run's summary carries its total.

## 7. Where the build went past the letter, or chose within it

1. **The checks go past §5's letter in these ways** (the review's P1, P3 to P8, and the refuter's N1 and N2). Each is an addition, and each drops more lines than the letter would; none keeps a line the letter drops. Q-4 asks for the ruling.
   - **Check 2, `shape`,** also drops these lines:
     - a line holding an invisible, format or direction-control character (a right-to-left override rendered "It was a bad trade" in Chromium);
     - a line with no letter;
     - a line with a letter outside the Latin script (Cyrillic and Greek look-alikes).
   - **Sentence ends** are counted over every form of terminal punctuation (full-width, ideographic, doubled). Two marks are no end: the period of a listed abbreviation (vs., U.S.), and an inner ellipsis when the sentence goes on in lower case.
   - **Check 4, `number_word`,** reads each word's plurals (including "-ies", as in twenties and forties), its ordinal forms ("-th", "-ieth", twelfth), "-fold", "-ly" and "fourty". It does not read a bare "-d" that makes another word ("tend" passes).
   - **Check 5, `symbol`,** reads a class suffix (BRK-B, BRK.B) and a plural or possessive "s" (NVDAs, NVDA's).
   - **Check 7, `forbidden`,** reads plurals, "-ed" and "-ing", and listed forms: mistaken, prove(d), validate(s), supports, should've, shoulda. A phrase's space also matches a hyphen or a dash. "support" alone passes.
   - **Checks 3 to 7** read the text both as written and with its disguises taken off (NFKC, invisible characters removed). This is item 4's own design, not §5's words; its full-width rows came with the review's C1.
2. **The archetype is named only from the display table** (the review's M1). Any other string, including a legacy code, is no name, because `getArchetypeDisplayName`'s humanizing fallback would otherwise carry any string a client stored into the system text. Sep 23's legacy `momentum` therefore reads "You are the agent:" (Q-3).
3. **The quotations' extra exclusions** (DW-3; the review's M2 and P1, the refuter's N4). A quotation holding the agent's display name is left out whole. The name matches as a whole word, in any case, with its words joined by any run of spaces, hyphens or dashes, as written or unmasked. A quotation with an invisible or direction character is also left out. The platform's own default name, `'Agent'` (`agentBattleService.js`'s snapshot default), is not treated as a name (Q-5).
4. **The attribution** (§6 "as the cards stamp them"; the review's R3, the refuter's N3).
   - For a casual clone: the clone document is read, and accepted only if it is the owner's. Its parent is then read, and accepted only if it exists and is the owner's.
   - Otherwise the field is `null`, never the clone and never another owner's agent.
   - It prints nothing. The platform's async resolver logs ids on its degraded paths, which is the review's R2.
5. **The not-yet line** shows only while a run will still process this day: until the next run after the tape was written, plus 30 minutes, and only if that run's ET date is the tape's (the review's R6). A tape first written after its own night's run (a backfill) never promises words, since §12 builds no catch-up.
6. **The words' line is never clamped** (the review's P2 and the browser lens's B1). §1's `preview` hides the "Read more" disclosure, and §1 says the words appear nowhere else, so a three-line clamp hid the end of a 160-code-point line for good. In Chromium, the whole line shows at 320, 360, 390, 768 and 1440 px (5, 5, 5, 2 and 5 lines), with no overflow. A single 160-letter word wraps, through the app's global `overflow-wrap: break-word`.
7. **The words' read is keyed by battle, owner and day** (the review's Q2, DD-3's identity). An owner refreshed on the same battle reads its own record once.
8. **No key, no call:** `runDebriefCall` with no `CLAUDE_API_KEY` returns `model_error_no_key` with 0 attempts. It never falls back to the SDK's `ANTHROPIC_API_KEY` (the review's R5).
9. **A failed `create`** after a paid call (other than ALREADY_EXISTS) leaves no record. The day is named in the run's `writeFailed`, and the call's cost stays in the run's total (the review's R4).
10. **The record's reasons:**
    - a refusal is `model_error_refusal`;
    - an answer cut off at the cap is `model_error_max_tokens`;
    - the deadline is `deadline`;
    - an unparseable answer, or one of the wrong shape, is `parse`;
    - every line dropped is `nothing` / `no_lines`;
    - a day with no swap is `nothing` / `no_swaps`, with no call.

## 8. Fences

- **Not in the diff,** verified on `git diff --name-only 56220130...41011ad0`, 57 files:
  - every BUILD_RULES §1 file;
  - `api/_utils/filmTape/**` and `api/cron/film-tape-*.js`;
  - `api/cron/agent-batch-review.js`, `api/cron/agent-evaluate.js` and `api/agent/decide.js`;
  - `api/_utils/filmRoom/momentExcerpt.js`, `cardStore.js`, `cardCounter.js` and `cardRequest.js`;
  - `api/film-room/*.js` and `api/_utils/sharedResearch/**`;
  - `firestore.indexes.json`, `package.json` and `package-lock.json`;
  - `FilmRoomGlance.jsx`, `FilmRoomStudy.jsx`, `FilmRoomDeepDive.jsx`, `FilmRoomCheckDetail.jsx`, `FilmRoomRoute.jsx`, `filmRoomCards.js`, `FilmRoomCardRegions.jsx` and `FilmRoomKit.jsx`;
  - the hub and the Practice Field;
  - every golden (`__golden__/*.html`) and every JSON fixture.
- **In the diff, as the items require:**
  - `firestore.rules` (the `debriefs` block);
  - `vercel.json` (one cron entry);
  - `docs/BUILD_RULES.md` §6 (46 → 47, with its reason);
  - `src/config/featureFlags.js` (the flag);
  - `src/utils/filmRoomGate.js`;
  - `src/screens/filmRoomV2/{filmRoomFlow.js, FilmRoomFlow.jsx, FilmRoomScreenV2.jsx, filmRoomCopy.js, filmRoomData.js}`;
  - `docs/README.md` (five rows).
- **Declared, outside the items' own modules:**
  - **`src/screens/filmRoomV2/filmRoomModel.js`:** four import specifiers gained `.js`, and nothing else changed. This lets the digest's api/ graph load in Node's ESM loader, as `archetypeRegistry.test.js`'s extensionless guard requires. Q-11.
  - **`api/_utils/archetypeImportBoundaryBaseline.json`:** one line, `api/_utils/filmRoom/dayDigest.js`. It imports `getArchetypeDisplayName`, which the spec names. BUILD_RULES §1's separate gate says to record it in the same commit (Q-11).
  - **The harness, `src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx`,** gained:
    - the debrief quotation channel;
    - `debriefWordsDefects`;
    - `SPEC_DEBRIEF_NOT_YET` and the not-yet line in `SPEC_FLOW_COPY`;
    - the low oracle on displayed hundredths (DC-8).

    Its self-test's count line moved from 41 to 42. The harness is a test-support module, not a golden or a JSON fixture; D1 treated it as allowed, but D2's prompt fences "every existing … fixture" (Q-12).
  - **The cron-count pins moved from 46 to 47** in three api/ tests: `api/agent/research.dark.test.js`, `api/cron/agent-evaluate.measuredFollowup.test.js` and `api/cron/compute-index-intelligence.axes.test.js`.
  - **Three D1 suites gained a `FILM_ROOM_DEBRIEF_MODE` `'off'` pin** in their flag mock and nothing else: `FilmRoomFlow.screen.jsdom`, `FilmRoomFlow.reads.jsdom` and `FilmRoomFlow.screen.fixround.jsdom`.
  - **D1 rows moved by part 2:**
    - `filmRoomFlow.fixround.test.js`: DC-1's row;
    - `FilmRoomFlow.screen.fixround.jsdom`: FRC-2's line, for DD-3;
    - `FilmRoomFlow.fixround.jsdom`: a 1e-9 tolerance on one float row that DD-4's exact grouping meets at 616 px;
    - `filmRoomFlow.test.js`: the import list's `.js`;
    - `filmRoomCopy.inventory`: 464 keys, 614 entries.
- **The merge with `origin/main`** brought only Practice Field files, docs, and main's own `compositionProtectedStores*` changes. None was edited here.
- **Nothing else:** no new dependency, no model call (every test uses a fake client), and the sample pack was never run. There was no deploy, rules deploy, flip, or production read or write. The code reads `CLAUDE_API_KEY` from the environment only; no key or token was read, copied or printed.

## 9. The checks

| Check | Where | Result |
|---|---|---|
| Full suite at `a1a3fc6b`, the merged tree plus one test row | WSL Ubuntu: a worktree of the `~/pd-ci` clone at the exact commit, `node_modules` linked to an install whose `package-lock.json` hash is `e457c10d0317`, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock` | **1,641 test files passed, 0 failing; 37,474 tests passed, 179 skipped, 0 failed** (331 s). At the merge commit `821fdb25`: the same, with 37,473 passed (320 s) |
| `npm run lint:gate` | the same tree | **exit 0**, at both commits |
| Rules suite (`npm run test:rules`) | `a1a3fc6b`, the Firestore emulator on Temurin 21 | **47 files, 854 / 854** |
| The flow's and the debrief's suites under `TZ=America/Chicago` (`src/screens/filmRoomV2`, `api/_utils/filmRoom`, the schedule, the gate's suites, the flags, the cron, the sample pack) | the full-suite tree at `a1a3fc6b` | **75 files, 1,852 / 1,852**. At `821fdb25`: 75 files, 1,851 / 1,851 |
| `vite build` | an LF `git archive` of `a1a3fc6b`, `package.json` byte-identical to the commit | **exit 0** (26 s; the usual chunk-size and CSS warnings). The pushed head (this report's commit, docs only) is recorded in the PR's description, since this commit cannot hold its own run |
| The mutant battery | four LF `git archive` trees of `41011ad0` | **78 / 78 killed** (§11) |
| The words in Chromium | headless Chromium 147 (playwright-core) on a fixture page served by vite, at 320, 360, 390, 768 and 1440, with requests to any other host aborted | the whole line, with no overflow; the date inside the panel; the link clear; 0 debrief quotations on the tape view; one debrief read (§7 item 6) |
| The fences | `git diff --name-only 56220130...41011ad0` | none fenced (§8) |

## 10. The review (BUILD_RULES §2)

**How it ran.**
- **The five lenses.** Each was a subagent on its own LF `git archive` of the code head `3820182d`, with `node_modules` linked, read-only on git and on the shared checkout:
  - **model:** what the model sees, including an independent recomputation of the Sep 23 digest;
  - **player:** what the player sees, and the off path as a base-versus-head differential;
  - **record:** the record and the job;
  - **census:** the census and the tests' integrity, with mutants of its own, D2's suites run under UTC and America/Chicago, and the part 2 reproductions swapped to their base sources;
  - **browser:** part 2 and the words in headless Chromium, base against head.
- **An explicit `vite build`** ran on LF `git archive` trees of the review head `3820182d` and the refuter's head `b6f800bb`, both exit 0, and again on `a1a3fc6b` (§9). The lenses themselves served the browser fixture through vite's dev server, not a build.
- **The fixes** landed at `d996b683` and `b6f800bb`. The browser lens re-checked B1 on the fixed head in Chromium.
- **One refuter** then took the old head and the fixed head. Its instructions were to refute every finding with a reproduction and to test every fix. It ran 38 mutants of its own.
- **The refuter's findings** were fixed at `41011ad0`.

**Result.**
- Thirty-eight items were reported, findings and questions together. Thirty-five are distinct: B1 repeats P2, C7 repeats R2, and the player's Q1 repeats R6.
- The refuter REFUTED none.
- It marked three fixes PARTIAL: M2, R3 and P5. It also found three fixes that had lost an old guarantee (N1 to N3, all fixed) and three new questions (N4 to N6).
- Every defect whose fix the spec decides is fixed, with a row that fails on the code before it and a revert mutant.

| id | finding (short) | sev. | verdict | disposition |
|---|---|---|---|---|
| R1 | two overlapping runs both ask the model for one battle day; the second call's cost is on no record | blocker as written | CONFIRMED (both trees) | **OPEN, Q-1:** past the items (§8) |
| M1 | any string in `agentContext.archetype` reached the system text through the humanizing fallback | blocker as written (needs a crafted client) | CONFIRMED | FIXED `d996b683`: the display table only (§7 item 2, Q-3) |
| M2 | the agent's display name reached the model inside a quotation | major | CONFIRMED | FIXED `d996b683`; PARTIAL per the refuter (extra spaces, a hyphen), completed `41011ad0` |
| M3 | a combining mark or a Cyrillic look-alike hides an id from `unmaskedText` | minor, inherited (Build C) | CONFIRMED | not fixed: `promptBoundText.js` is unchanged here. P7 now drops a Cyrillic look-alike from the words, but a combining mark passes the checks' id test too; Q-13 |
| M4 | the evalId fallback took a row whose own tickSeq names another check | minor | CONFIRMED | FIXED `d996b683` |
| M5 | two checks at one instant ordered by array place; a loose instant dated words | minor | CONFIRMED | FIXED `d996b683` (the writer's order; an unsure neighbour leaves the words out, N6 / Q-14) |
| M6 | a blank quotation carried | minor | CONFIRMED | FIXED `d996b683` |
| Q1 (model) | the swap's own check is its `after` (the writer stamps `capturedAt` after dispatch) | question | QUESTION | §2's letter, pinned; Q-10 |
| R2 | an imported helper printed ids during the pass and the sample pack | major | CONFIRMED | FIXED `d996b683`: `attributionOf` prints nothing |
| R3 | a degraded attribution stamped the clone silently | minor | CONFIRMED | FIXED `d996b683`; PARTIAL per the refuter (an unverified parent), completed `41011ad0` (N3) |
| R4 | a `create` that fails after a paid call vanished from the summary | minor | CONFIRMED | FIXED `d996b683` (`writeFailed`, the cost kept) |
| R5 | the key silently fell back to `ANTHROPIC_API_KEY` | minor | CONFIRMED | FIXED `d996b683` (`model_error_no_key`) |
| R6 / player Q1 | the not-yet line promised words a backfilled tape never gets | question, real | CONFIRMED | FIXED `d996b683` (§7 item 5) |
| R-Q | a call aborted at its deadline records null usage and cost | question | QUESTION | Q-6 |
| P1 | a direction override or an invisible character passed every check; it rendered "It was a bad trade" | major | CONFIRMED | FIXED `b6f800bb` (`shape`; the digest too) |
| P2 / B1 | a 160-code-point line clamped at three lines, with no way to read the end | major | CONFIRMED (Chromium) | FIXED `b6f800bb`: no clamp (§7 item 6) |
| P3 | "-ies" plurals, "-fold", "-ly" and other ordinals passed check 4 | major | CONFIRMED | FIXED `b6f800bb` |
| P4 | should've, hyphen and dash joins, and other verdict forms passed check 7 | major | CONFIRMED | FIXED `b6f800bb`; the refuter's N2 (a lost "-ed"/"-ing") FIXED `41011ad0` |
| P5 | allowed lines wrongly dropped ("tend"; "vs."; an inner ellipsis) | minor | CONFIRMED | FIXED `b6f800bb`; the refuter's N1 (every inner ellipsis skipped) FIXED `41011ad0`. "NOW." as a ticker, and §0's own example: Q-4, Q-7 |
| P6 | non-ASCII terminal punctuation not counted | minor | CONFIRMED | FIXED `b6f800bb` |
| P7 | Cyrillic and Greek look-alike letters passed | minor | CONFIRMED | FIXED `b6f800bb` |
| P8 | BRK-B, BRK.B, NVDAs and NVDA's passed check 5 | minor | CONFIRMED | FIXED `b6f800bb` |
| P9 | the flow `'on'` with the words `'allowlist'` asks a verdict D1 never asked | minor | CONFIRMED | not reachable at the merged values; Q-9 |
| Q2 (player) | the words' read was keyed by battle and day, not owner | low | CONFIRMED | FIXED `b6f800bb` |
| C1 | no row pinned the full-width disguises (the `both` read) | major (tests) | CONFIRMED | FIXED `b6f800bb` (rows; mutant V9) |
| C2 | `DEBRIEFS_READ` missed a path that starts the string (`'debriefs/' + d`); `PLAYS_READ`, inherited, likewise | minor (guard gap; no reader today) | CONFIRMED | FIXED `b6f800bb` for `debriefs`; `plays` FIXED `41011ad0` |
| C3 | the fail-closed scan missed `Function` as a value, a template-literal key, `Reflect.construct` | minor | CONFIRMED | FIXED `b6f800bb` |
| C4 | three pass mutants survived (the per-battle floor, the run-bounded deadline, `>=` at the day's start) | minor (tests) | CONFIRMED | FIXED `b6f800bb` (rows; V12–V14) |
| C5 | the "after the close pass" row read no code | minor (tests) | CONFIRMED | FIXED `b6f800bb` (read off both schedules and `maxDuration`; V15) |
| C6 | the off-path row's title claimed a comparison with D1 | minor | CONFIRMED | FIXED `b6f800bb` (title) |
| C7 | every pass row injected a fake attribution resolver | minor | CONFIRMED (= R2) | FIXED with R2 |
| Q1 (census) | `node:child_process` not failed closed | — | CONFIRMED | FIXED `b6f800bb` |
| Q2 (census) | the sample pack is not a census root | question | QUESTION | Q-8 |
| B2 | a keyboard scroll or a scrollbar drag doesn't hold the tape | minor, inherited (head = base) | CONFIRMED | DD-2's letter ("wheel or trackpad") holds; Q-2 |
| B3 | a wheel that scrolls nothing still holds | question | QUESTION | the conservative side; Q-2 |
| B4 | the date sits under the words, not "beside" them | question | QUESTION | Q-12 |
| N1–N3 (refuter) | fixes that lost an old guarantee: every inner ellipsis skipped; "-ed"/"-ing" lost; the parent's owner unchecked | minor | CONFIRMED | FIXED `41011ad0` |
| N4 (refuter) | the default name `'Agent'` dropped every quotation saying "agent" | question | CONFIRMED | FIXED `41011ad0` (§7 item 3, Q-5) |
| N5 (refuter) | `node:inspector` not failed closed | question | CONFIRMED | FIXED `41011ad0` (with `node:repl`) |
| N6 (refuter) | one check with neither a strict instant nor a tickSeq makes every swap "unsure" | question | QUESTION | over-drops, never a wrong word; Q-14 |

## 11. The mutants

The battery ran in four LF `git archive` trees of the frozen code `41011ad0`, one shard each, at 2 workers per tree (8 in all). For each mutant:
- the anchor must occur exactly once, or the mutant is BROKEN;
- its test files run with a fresh JSON report;
- it is KILLED only on a non-zero exit with at least one failed row;
- the file is restored from its pristine copy.

A clean baseline of the 16 named test files (517 rows) ran first. Afterwards every tree's mutated files were byte-identical to the commit.

**Result: 78 / 78 killed.**
- **First pass, 77 of 78:** the battery's 66 in 64 s, then the first review round's 12, which are the refuter's reverts re-anchored at `41011ad0`.
- **The one survivor, Y-R3own,** drops the check that the clone document is the owner's. The parent-owner check added at `41011ad0` masked it in every row. It is not equivalent: another owner's clone document naming the owner's own agent as its parent is refused by the platform resolver, which compares the parent with the clone's owner, but the mutant would stamp that agent.
- **The row `a1a3fc6b` adds** pins that case (null, and the parent never read), and it kills the survivor. It ran on the frozen sources, clean first (36 / 36).

| Group | Mutants | Killed |
|---|---|---|
| The gate (item 1) | G1s an unknown mode on (server); G1c the same (client); G2 a non-admitted owner's record written; G3 a non-admitted owner's record read | 4 / 4 |
| The digest (item 2) | D1 an id (the row key); D2 a directive's text; D3 the display name; D4 a quotation holding an id cut instead of left out; D5 a ninth swap; D6 a swap with no strict instant | 6 / 6 |
| The call (item 3) | K1 a second call after a bad answer; K2 `maxRetries` above 0 | 2 / 2 |
| The checks (item 4) | C1–C7 each check removed (C2: the sentence-end count); C8 a failing line repaired instead of dropped | 8 / 8 |
| The pass (item 5) | P1 `set` for `create`; P2 a call for a day with no swap; P3 the `'off'` gate after the first read; P4 words or an id in the log | 4 / 4 |
| The front (item 7) | F1 the record read with the words off; F2 a line shown for a key the tape doesn't hold; F3 the not-yet line after the next run | 3 / 3 |
| The census (item 8) | X1 the evaluator's path made to read `debriefs`; E1 an extensionless specifier back in the digest's graph | 2 / 2 |
| Part 2 (items 10–15) | R1 DC-1; R2 DC-4; R3 DC-8; R4 DD-2; R5a DD-3 for N4; R5b DD-3 for N3; R5c DD-3 for the verdict; R6 DD-4 | 8 / 8 |
| Review, part 1 (`d996b683`) | Y-M1, Y-M2, Y-M2u (the name only as written), Y-M4, Y-M5a, Y-M5b, Y-M6, Y-R3, Y-R3own, Y-R4, Y-R5, Y-R6: the refuter's reverts, re-anchored at `41011ad0` | 12 / 12 (Y-R3own by the row `a1a3fc6b` adds) |
| Review, part 2 (`b6f800bb`) | V1a–V1c, V2 (P1, P7); V3, V4 (P3, P5); V5a, V5b (P4); V6, V7 (P5, P6); V8a, V8b (P8); V9 (C1); V10 (P2); V11 (Q2); V12–V14 (C4); V15 (C5); X2–X4 (C3, C2, census Q1) | 22 / 22 |
| The refuter's round (`41011ad0`) | W1 N1; W2 N2; W3 N3; W4 M2's spacing; W5 N4; W6 N5; W7 C2's `plays` | 7 / 7 |

Every review mutant was killed by the row written for its finding.

## 12. The push and the Tests run

The branch was first pushed at `821fdb25`, when the draft PR opened; CI ran on it and was not watched. The final push is this report's commit. Its `vite build` and its one read of the Tests run are recorded in the PR's description, because this commit cannot hold them. CI was not watched, polled or fixed (BUILD_RULES §2).

## 13. The founder's steps after the merge

1. **Deploy the rules** (`firebase deploy --only firestore:rules`). Until then a client read of `debriefs` is denied and the front treats it as no record, so the words never show. The job writes with the Admin SDK and does not wait on the rules.
2. **The first night.** At 03:45 UTC (10:45 PM EST) after the merge's first deploy, the job runs for the allowlisted owners' tiered battle days. Then:
   - Read the run's one log line `[film-room-debrief]`. It holds counts only: selected, written, nothing, failed, not reached, skipped, errors, write failures, unresolved attributions, calls and total cost.
   - Read the records at `agentBattles/{id}/debriefs/{etDate}`. For each, check its `lines`, its `dropped` reasons, `usage`, `costUsd` and `status`.
3. **The sample pack** is optional and founder-run: `node scripts/film-room-debrief-sample.mjs --owner <uid> [--days 3]`. Set the Firebase Admin variables and `CLAUDE_API_KEY` through a hidden prompt first. It is read-only against production, makes both models' calls within the $2 cap, and writes JSON and Markdown under `scripts/output/` only.
4. **The flag** stays `'allowlist'`. Opening it to everyone (`'on'`) is a later one-line PR.

## 14. Questions for a ruling

1. **R1: overlapping runs (blocks criteria 4 and 8 as written).** Two runs at once each ask the model for the same battle day; one record is created, and the second call's cost is on no record. Are overlapping runs in scope?
   - **If not:** declare it. A manual run must not overlap the nightly one, which the handler cannot enforce.
   - **If so:** a claim must be stored before the call. One option is a server-only claim document, for example `debriefClaims/{battleId}_{etDate}`, created with `create` before the call, so that a run finding it skips. A claim left by a run that died leaves that day without words. Another option is a lease field on an existing document. Either is past D2's items.
2. **DD-2's scope (B2, B3).** The hold counts a wheel or trackpad scroll, which is DD-2's letter: wheel events, at the window, while a hold is possible.
   - A keyboard scroll with the focus on the page, or a scrollbar drag, scrolls the pending tape without holding it. This is the same at base and head; DC-5's "a scroll counts" is wider.
   - A wheel that scrolls nothing still holds, which errs on the conservative side.
   - Should the keyboard and the scrollbar hold too?
3. **The archetype's name (M1).** Only a code in the display table is named. Sep 23's legacy `momentum` is therefore no name, and the system text reads "You are the agent:". Is that right, or should the legacy codes be mapped through a fixed table?
4. **The checks beyond §5's letter (§7 item 1).** Every addition drops more lines than the letter would; none keeps a line the letter drops. Keep them all? Also, "so I moved NOW." is dropped as `symbol`, because NOW is a directory ticker: §5's letter.
5. **The default name (N4).** `'Agent'`, `agentBattleService.js`'s snapshot default, is not treated as player text. A chosen name holding the word ("Agent Smith") still is. Is that right?
6. **A deadline abort's cost (R-Q).** A call aborted at its deadline records null `usage` and `costUsd`, because the SDK returns no usage for an aborted request, though tokens may have been billed. Should the record estimate the input?
7. **§0's own example is dropped.** "This one wasn't my call. MSFT had stopped moving." holds "one", a cardinal on §5's list. The build follows the letter, and a row pins it.
8. **The sample pack and the census (census Q2).** `scripts/film-room-debrief-sample.mjs` makes model calls but is no census root, because the census walks api/ and src/ only. Add `scripts/` roots?
9. **P9.** With the flow `'on'` and the words `'allowlist'`, the screen asks the owner's verdict where D1 would not. Under the merged values (flow `'allowlist'`, cards `'allowlist'`), the same cached verdict is asked anyway, so no request is new. Declare it?
10. **The deciding check is `after` (model Q1).** The writer stamps a check's instant as `capturedAt`, after the swap is dispatched. So the agent's own swap has its deciding check's words in `after`, which the system text presents as words "at the check after it". This is §2's letter. Should the digest use `actions[].tickSeq`, the swap's own check, instead?
11. **Two declared edits outside the items (§8).** `filmRoomModel.js` (four `.js` specifiers) and the archetype baseline's one line. Approve as built?
12. **Two layout and fence questions.**
    - **B4:** the record's date sits under the words, not "beside" them, as §1 says.
    - **The harness:** `__fixtures__/filmRoomHarness.jsx` and its self-test changed, as D1's did. Is that within "every existing fixture"?
13. **M3 (inherited from Build C).** `unmaskedText` keeps combining marks, so an id split by U+0336 or U+0301 passes the digest's id test, and the checks' too. P7's rule drops only the Cyrillic look-alike case from the words. A quotation can still carry such an id to the model, and a line can still carry one to the record. Fix it in `promptBoundText.js`, in Build C's scope?
14. **N6.** One check on the day with neither a strict instant nor a tickSeq makes every swap's neighbouring checks "unsure", so that day carries no quotations at all. This over-drops and never shows a wrong word. Keep it?
