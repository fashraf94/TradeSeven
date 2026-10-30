# Activation record — Film Room cards, on for the allowlist

Claude Code (Sonnet 5.5), October 29, 2026, for Flash. The prompt: "Flip prompt — FILM_ROOM_CARDS_MODE: 'off' → 'allowlist'" (the Film Room chat, October 29, 2026). It authorizes the flip only: `FILM_ROOM_CARDS_MODE` from `'off'` to `'allowlist'`, the pins that move in the same commit, and this record with its README row. No other source change, no merge, deploy, production read or write, refresh or backfill.

## 1. Verdict

| | |
|---|---|
| **What changed** | `FILM_ROOM_CARDS_MODE = 'allowlist'` (`src/config/featureFlags.js:3506`). The Film Room's take-home cards turn on for the owners the cockpit's server-side allowlist admits: the founder and FT_QA. Every other owner stays exactly at `'off'`. |
| **The flip commit** | `a3e74f621ad4d116244d54cc1b57bfe4e4c8dace`, five files, +30 / −13, one commit (§4). |
| **Rollback** | One line: `FILM_ROOM_CARDS_MODE` back to `'off'`, with its pin row. `git revert a3e74f62` does it, with the two suite pins (§6). |
| **Checks** | Full Linux suite on the merged tree: **0 failing** (`1239` files, `27,119` rows passed, `89` skipped, exit 0). Rules suite 28 files / 448 rows, exit 0. `lint:gate` exit 0. `vite build` exit 0. The control (the flag moved, its pin not) reddens exactly the pin row. The cards-off goldens, the card regions for an admitted owner and the 404s for a non-admitted owner are confirmed (§5.4). The first run, on the flip's three files alone, found two more live-value readers; they are fixed in the same commit (§4, §5.1). |
| **Base** | `main` at `a5c35ba6`, which contains #1003's merge `74d3078f` (Film Room B2.1, the screen pass). `git fetch origin` ran first. |
| **PR** | #1013, `claude/film-room-cards-allowlist` (pushed by refspec; the app's local worktree branch is `claude/film-room-cards-allowlist-0c12a5`). Ready for review; the founder merges. |
| **Not yet done** | The tester pass on FT_QA, and then `'on'` as its own founder PR (§7). Nothing is deployed by this PR until the founder merges it. |

## 2. Who sees what

The mode resolves per battle owner. The client reads the existing `GET /api/agent/cockpit-status` `allowlisted` verdict for the caller's own battle and holds no uid; the server reads the allowlist at call time (`api/_utils/callRecords/mode.js`, `isCockpitOwnerAllowlisted`, from `COCKPIT_ALLOWLIST_UIDS`). The source of both gates is `src/utils/filmRoomGate.js:178–210` and `api/_utils/filmRoom/cardsGate.js:32–95`.

| Who | The Film Room screen | `POST /api/film-room/card` and `GET /api/film-room/counter` |
|---|---|---|
| An owner the `allowlisted` verdict admits (the founder, FT_QA) | The v2 screen with its four reserved regions filled: the header's Since last time and Prepared case, the tag line on a tapped check, the footer's your-call form, receipt and My cards. | Answer. |
| Everyone else: not admitted, a verdict that fails (500, a malformed body, no user), or no battle id | The v2 screen exactly as `main` has it today: the four reserved regions empty, byte for byte (the cards-off goldens, `FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx`). | `404 { error: 'disabled' }` after auth and before any read. |
| An owner with an untaped battle | The legacy Film Room screen, in every mode (RB-5). | Refused by the card endpoint. |
| The trading agent | Nothing. No model path imports the ledger or reads `plays` (`api/_utils/filmRoom/oneDoor.census.test.js`), and the assembled trading prompt is byte-identical with and without a ledger. | — |

`FILM_ROOM_V2_MODE` is `'on'` (`src/config/featureFlags.js:3051`): everyone with a taped battle already has the v2 screen. This flip adds the cards to it for the allowlist and nothing to anyone else.

**One difference on the wire, for every owner.** Under `'allowlist'` the screen asks `cockpit-status` once per owner per page life; the shipped v2 `'on'` never sent it (B2 report §6, review L5-6). A non-admitted owner sends that one GET, gets `allowlisted: false`, and sees the same screen as before. The endpoint is rate-limited per IP (60 a minute) and per user (30 a minute), answers for the caller's own battle only, and reads one document.

## 3. The preconditions

The flag's own docstring names them: the `plays` rules and the `tape (ownerId, etDate)` collection-group index deployed (Amendment G RG-7). Each is recorded here.

| Precondition | Record |
|---|---|
| **Rules and index** | The `plays` Firestore rules and the `tape (ownerId, etDate)` collection-group index were deployed after B2 (`docs/audits/20261021_BUILD_FILM_ROOM_B2_CARD.md` §6). The founder confirmed it on 2026-10-22. B2.1 changed neither: checked in this session, `git diff ff6248d1 74d3078f -- firestore.rules firestore.indexes.json` (B2's merge to #1003's merge) is empty. |
| **The refresh** | Run after #1003 deployed, on 2026-10-29, over `2026-09-21..2026-10-28`. Result: complete, refreshed 20, unchanged 8, alreadyDone 132, written 0, failed 0. (As the prompt records it; this session did no production read.) |
| **The reviews** | Astra's verdict on #1003 was **MERGE** (`docs/audits/20261029_ASTRA_REVIEW_FILM_ROOM_B2_1_SCREEN_PASS.md`, reviewed head `dfcbd20c`), and the Amendment L round followed (`docs/audits/20261022_BUILD_FILM_ROOM_B2_1_SCREEN_PASS.md` §14: code head `b9631c46`, PR head `37b3c7ec`, merged as `74d3078f`). |
| **The ruling to be made before a cards flip** | B2.1 report §13.10 item 1 (review KR2-1) was the one question marked "should be ruled before the cards flip": whether Set's link shows on a ranked battle whose owner never set the dial. Amendment L RL-1 ruled it (Set links wherever the dial reaches the battle's own agent), built in `03c94dc6` (§14.2). The Forge-flag checklist item (review SPR-C-5) was Amendment K RK-2: the link requires `RELEASE3_CHARACTER_TAB_ENABLED` and `TEMPO_DIAL_ENABLED`, both `true` at this base (`src/config/featureFlags.js:103`, `:723`). |
| **The builds** | B2 (the card), PR #988, merged `ff6248d1` on 2026-10-22; B2.1 (the screen pass), PR #1003, merged `74d3078f` on 2026-10-29. The mode was `'off'` through both. |

## 4. The flip commit

`a3e74f621ad4d116244d54cc1b57bfe4e4c8dace` — "flip: FILM_ROOM_CARDS_MODE off → allowlist (Film Room cards for the allowlist)". Five files, +30 / −13. Nothing under `api/`, no fenced file (BUILD_RULES §1), no `firestore.rules`, `firestore.indexes.json` or `vercel.json`, no hub code.

| File | Change |
|---|---|
| `src/config/featureFlags.js` | `:3506` the constant → `'allowlist'`. The docstring's status line (formerly "DARK — pinned 'off'") reads `CURRENT: 'allowlist'` with the date and this PR (`:3489`); the runway, the rollback (now naming `'allowlist'` → `'off'`) and the pointer to this record are kept (`:3494–3500`). |
| `src/config/filmRoomCardsFlags.test.js` | `:32–34` the pin row asserts `'allowlist'` and is renamed to match. The other four rows are value-neutral and unchanged. |
| `src/config/flagPinGuard.test.js` | `:244–253` the `FILM_ROOM_CARDS_MODE` runway note reads `'allowlist'` as current. The flag stays intentionally ABSENT from the map (`:238`), as the note and `filmRoomCardsFlags.test.js` require. |
| `src/screens/filmRoomV2/FilmRoomRoute.golden.jsdom.test.jsx` | `:41` the suite's `featureFlags` mock pins `FILM_ROOM_CARDS_MODE` to `'off'`, with a comment saying why (below). |
| `src/screens/filmRoomV2/FilmRoomRoute.untaped.jsdom.test.jsx` | `:38` the same pin, the same comment. |

**The live-value readers (BUILD_RULES §2), found by running the suite, not by grep alone.** The two source readers are `src/utils/filmRoomGate.js:178–186` and `api/_utils/filmRoom/cardsGate.js:32–40`. Every test that names the flag already mocks it with a getter (`filmRoomGate.test.js`, `cardsGate.test.js`, `card.test.js`, `counter.test.js`, `FilmRoomCards.jsdom.test.jsx`, `FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx`, `captureFilmRoomV2Golden.jsdom.test.jsx`, `test/rules/filmRoomCardAttribution.rules.mjs`), so none of those moves. The full Linux suite on the flip's first cut (the first three files above only; §5.1) found two more, in suites that never name the flag and render the Film Room route under the real value:

| Row | Why it went red | The fix |
|---|---|---|
| `FilmRoomRoute.golden.jsdom.test.jsx:214` "'on': v2 for every owner, with no verdict asked" | At `FILM_ROOM_V2_MODE` `'on'` the route sends no `cockpit-status` ask. With the cards gate live, the screen's card hook asks the verdict once per owner (`expect(fetches).toEqual([])` saw one request). | The suite's mock pins the cards mode `'off'`. The suite is about which screen the route opens, not about cards. |
| `FilmRoomRoute.untaped.jsdom.test.jsx:251` "RB-5 … keeps v2 exactly as before 'on'" (the `absent` case) | The same extra ask, in the same `fetches` assertion. | The same pin. |

Neither row asserts that the screen changes for a non-admitted owner; both assert the premise "v2 `'on'` sends no request". That premise is no longer true of the shipped build for any owner, which is why it moves with the flip rather than being a regression. Under V2 `'allowlist'` the cards ask shares v2's cached verdict, and those suites' one-ask rows still pass unchanged. The cards' own gate stays pinned where it is tested.

## 5. Checks

Linux in a private worktree of `~/pd-ci` (`~/pd-ci-cardsflip`, Node 20.20.2, npm 10.8.2), `TZ=UTC`, `--maxWorkers=8`, each full suite alone under `flock /tmp/pd-suite.lock`. The worktree has its own `node_modules` from `npm ci` (lockfile `40382e64edb6`): `main` gained `three@0.184.0` after the shared clone was installed, so the shared modules were stale for this tree. `main` was `a5c35ba6` at every fetch (before each run and before the push), so the branch is `main` plus this PR's commits and no merge was needed. The rules suite ran on Windows, because WSL has no Java.

### 5.1 The full suite

The runs below were made on earlier cuts of this branch's two commits. The PR number written into the flag's docstring, the guard note and this record was first guessed as #1012; another PR took that number first, so the PR opened as #1013 and the two commits were re-cut with the number corrected. The final cut differs from the last tested cut (`861a11c4`) only in comment and record text: the PR number in the flag docstring and the guard note, and the PR number, the flip commit's SHA and these cut notes in this record and its README row. No executable line differs. The full suite, `lint:gate` and `vite build` were then run again on the final head; those results are in the PR description, which can state a head's results without changing the head.

| Run | Cut | Result |
|---|---|---|
| The flip's first three files alone | `abfd5207` | `Test Files 1239`; `Tests 27,208` (27,116 passed, 89 skipped, **3 failed**). The three: the two Route rows of §4 (`FilmRoomRoute.golden.jsdom.test.jsx:214`, `FilmRoomRoute.untaped.jsdom.test.jsx:251`), and `api/_utils/gemmaClient.test.js` "abort DURING BODY READ" (`:227`, `expectBodyReadWindow`), a real-time window in a file this PR does not touch. The gemma row passed 24 of 24 on three further runs alone on the next cut, and in the final runs below; see §8. |
| The flip with the two Route-suite pins, targeted | `201c67db` | The two Route suites, the pin and the guard: 4 files / 33 rows, 0 red. |
| The branch with the record (the checks text was added after this run; no code differs) | `e138ffb5` | **Exit 0.** 1239 files, 27,208 rows: **27,119 passed, 89 skipped, 0 failed**; 277 s; 0 unhandled errors. |

### 5.2 The control

The flag at `'allowlist'`, the pin row left at `'off'` (the module's exported value printed as `allowlist`): `filmRoomCardsFlags.test.js` and `flagPinGuard.test.js`, 11 rows, **exactly one red: the pin row**. Restored; the tree was clean. The two Route suites' pins have their own control: without them the first run was red on those two rows, with them green.

### 5.3 Rules, lint and build

| Check | Result |
|---|---|
| `npm run test:rules` (`firebase emulators:exec --only firestore`) in an LF `git -c core.autocrlf=false archive` of the `e138ffb5` cut (no rule, index or rules test differs from the final head), Windows | Exit 0. `Test Files 28 passed (28)`, `Tests 448 passed (448)`, 203 s. The `PERMISSION_DENIED` lines in the log are the denial rows' expected answers. |
| `npm run lint:gate` | Exit 0, no output (`--max-warnings 0`). |
| `vite build` | Exit 0. Entry `index-C58GebDq.js` 4,836.32 kB (gzip 1,304.86 kB). The build on the pushed head is recorded in the PR description. |

### 5.4 The three confirmations

| Question | Answer |
|---|---|
| **The cards-off goldens still pass** (an owner who is not admitted; a failed verdict; both under `'allowlist'`) | `FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx` 6 of 6. Row `:145` ("'allowlist', an owner the server does not admit") and row `:173` ("'allowlist', a verdict that fails (500, a malformed body, no user)") match all the goldens; row `:137` is `'off'`. They mock the mode, so they test the code path under `'allowlist'`; the shipped value is probed separately (the last row). |
| **The card regions render for an admitted owner** | `FilmRoomCards.jsdom.test.jsx` 72 of 72 (its default mode is `'on'`). Under `'allowlist'`, `cardsOff.golden` row `:158` admits the owner (`allowlisted: true`) and asserts the screen is not the golden and carries `data-cards-region="since-last-time"`. And as a scratch check, never committed: the same 72 rows with the suite's default mode switched to `'allowlist'`, its default verdict admitted and `COCKPIT_ALLOWLIST_UIDS` holding the owner, so the real card and counter handlers admit the writes: **72 of 72 pass**. The control, with the verdict not admitted, is 10 of 72 (62 red). |
| **Both card endpoints answer 404 for an owner who is not admitted** | `card.test.js` row `:105` and `counter.test.js` row `:75` ("mode 'allowlist': an owner the list does not admit … 404"; 46 of 46 and 6 of 6), and `cardsGate.test.js` 16 of 16. Those mock the mode too, so a scratch probe never committed, with the flags module **not** mocked: the live value is `'allowlist'`; a caller the allowlist does not admit gets `404 { error: 'disabled' }` with `Cache-Control: no-store` from `POST` and `GET` on the card route and `GET` and `POST` on the counter route, with no Admin SDK handle taken; an empty or unset allowlist admits nobody; an admitted caller is past the gate (4 of 4). |

## 6. Rollback

`git revert a3e74f62` — one commit, five files: the constant back to `'off'`, the pin row back to `'off'`, the guard note back to "`'off'` is CURRENT", and the two Route suites' cards pins (§4) removed again (they are harmless to keep). Or by hand: the one line `export const FILM_ROOM_CARDS_MODE = 'off';` and its pin row in `src/config/filmRoomCardsFlags.test.js`, in the same commit (BUILD_RULES §2). No data to undo: a card already filed under `'allowlist'` stays in the `plays` ledger, unread, and returns when the mode does; the server answers `404 disabled` again before any read, with `Cache-Control: no-store` so the next ask reaches the new value.

## 7. What is next

1. **The tester pass on FT_QA** after this merges and deploys: the cards on the FT_QA account, the founder's account, and (for the other half of the gate) an account the allowlist does not admit, which must read the v2 screen it reads today.
2. **`'on'`, as its own founder PR.** It moves the same three places: the flag line, the pin row, the guard note (BUILD_RULES §2). It is not part of this PR and this record does not set its date.
3. **Open and not blocking** (B2.1 report §14.10, four rulings): the desktop grid's tiles while a series read is pending or failed; whether RL-4's gameplan-meeting wording reaches Glance and Study; an unknown agent read cautiously; a navigation day outside the battle's days. They become more visible to more owners at `'on'`.

## 8. Notes

- **A timing row, left alone.** `api/_utils/gemmaClient.test.js` "callGemmaVoice: abort DURING BODY READ" failed once in the first full run (`expectBodyReadWindow`, `:227`, a 174 ms row) and passed 24 of 24 in each of three runs alone and in the final full run. Nothing in this PR reaches it, and its cause was not established here. On this machine WSL's wall clock is known to step by 0.8–1.7 s every ~33 s, which shortens any real-time window; if the row recurs, it is a separate task, not part of this flip.
- **Prose left as it was.** The Build B spec (`docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md:159`, "pinned `'off'`") and the B2 report's §6 deploy order are records and are not edited. The flag's docstring still carries the `'off'` mode's own description (it describes the mode, which remains true).
- **The log's vite warning.** `api/agent/composition.fenceBehavior.test.js` prints a `vite:dynamic-import-vars` warning in the full run. It is in a file this PR does not touch.
- **No production access.** The refresh numbers in §3 are the prompt's. This session read and wrote nothing in production, ran no refresh or backfill, deployed nothing and merged nothing. Merging this PR deploys through Vercel as any `main` merge does; the founder merges.
- **Review.** Five files, +30 / −13 in the flip commit and the record's two files: below BUILD_RULES §2's review threshold (10 files or 1,500 lines).
