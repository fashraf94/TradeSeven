# Build report — Film Room A2: the screen (dark, allowlist-ready)

**Date:** 2026-10-08 · **Executor:** Claude Code (Opus 5.5) · **Prompt:** "Build prompt — Film Room A2: the screen (dark, allowlist-ready)" (Fable, 2026-10-08)
**Governing:** Build A spec V1.2 §7 / §8 / §11 with Amendments A–D, and **Amendment E** (`docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_E_20261008.md`). **Design of record:** `docs/design/20261008_FILM_ROOM_A2_MOCKUP.html` (BA-41).
**Branch:** `claude/film-room-a2-screen`, cut from `origin/main` at `c1822e39` (#942). `origin/main` (#943, `7631c9e6`) was merged in at `3a89aeba`. The merge touched none of this build's files.
**Fence:** zero edits to BUILD_RULES §1 files. `git diff --name-only c1822e39..HEAD` over the eleven fenced paths is empty.
**End state:** a draft PR, nothing flipped. `FILM_ROOM_V2_MODE` ships `'off'`, so every viewer gets the legacy Film Room, byte for byte.

## Executive verdict

| Question | Answer |
|---|---|
| What ships | A dark build. The `'filmRoom'` route now renders through `FilmRoomRoute`. Under `'off'` (the pinned value) that route is the legacy `FilmRoomScreen`, with App's own props, and equals the goldens captured at the pre-build commit. V2 is a lazy chunk that no viewer reaches until the founder flips to `'allowlist'`. |
| Build items 1–10 | All committed: one commit per item, with the tests in that commit (§2). |
| Exit-criterion findings | **Confirmed blocking, all fixed with rows that fail at the pre-fix code:** <br>• A2L1-1: exit maker shown as "platform rule" <br>• A2L1-2: "No checks ran" <br>• A2L3-1: version-1 replay split <br>• A2L3-2: series read error and offline cache <br>• A2V1-11 edge: a pre-risk-record entry read as "held" <br>• A2L4-1, -3, -4, -5: test-integrity blockers, sweeps or rows that could not fail (refuter 4 downgraded A2L4-2 to backlog; it is fixed too) <br>**None open.** |
| Mutants | **BA rules:** 32 run. 31 were killed outright. M40h survived; a row was added (`d4d51791`) and it is now killed. <br>**Lens 4's set, rerun on the fixed tree:** 75 distinct mutants, 74 killed. The one survivor is L2, a verdict word ("takeaway") outside the prompt's list. At `1930a834` this set had 35 survivors (§2.2, §3.5). |
| Full suite (Linux, `TZ=UTC`, CI-shaped) | **`144828b0` (final code head):** 927 test files, **0 failing**; 19,626 tests (19,538 passed, 0 failed, 88 skipped). <br>**Earlier runs:** 905 files at the baseline `ccf96de6`; 918 files and 0 failing at `1930a834`, before review. <br>Private WSL clone, `--maxWorkers=2`. |
| Rules suite | **Pre-build `c1822e39`:** 23 files, 403 tests, all passing. <br>**Head `d4d51791`:** 23 files, 404 tests, all passing. The one added row is the series-list row (A2L3-7). |
| `lint:gate` / `vite build` | **`lint:gate`:** exit 0 on LF snapshots of `e54b8309` and `144828b0`. It failed once, at `d4d51791`; the cause and fix are in §3.7. <br>**`vite build`:** exit 0 on `144828b0`. `FilmRoomScreenV2` is its own lazy chunk (58.6 kB, 15.9 kB gzip). The pushed head (this report's docs-only commit) is rebuilt from its LF archive before the PR is opened. |
| Visual check | 12 screenshots plus 11 of the mock-up, saved outside the repo; no horizontal overflow at 390 or 1440. Deviations are listed in §4; none is a correctness defect. |
| Rulings requested | Three. Each is recorded, and none blocks: <br>• **R1 (A2L1-5):** digits inside stored notes <br>• **R2 (F3 wording):** the tape records that the system held by default, not that the model call failed <br>• **R3 (A2L2-12):** `FILM_ROOM_V2_MODE` cannot be a `DARK_BY_DESIGN` key |

---

## §1 Gate (read-only, at `ccf96de6`; anchors re-checked at the final head)

### 1.1 Tape fields the screen reads, and their classes

- **The document and its writers.** The document is `agentBattles/{battleId}/tape/{etDate}`, `TAPE_VERSION = 2` (`src/constants/filmTape.js:13`). It is written by the close pass (`api/_utils/filmTape/tapeAssemble.js:1129`, `:1156`) and the candle pass (`api/_utils/filmTape/candlePass.js:617`). Each writer stamps the document's own `numberClasses`, which is `TAPE_NUMBER_CLASSES` (`filmTape.js:145`).
- **What the declaration covers.** In the Sep-23 fixture it declares 98 paths: 62 recorded, 14 derived, 15 rebuilt and 7 market.
- **How classes are read.** Readers take a class only from the document's own declaration:
  - `classOfNumber` (`filmTape.js:302`)
  - `numbersWithClasses` (`:328`)
  - `formatNumberPath` (`:348`)
- **Top-level fields the screen reads:**
  - `score`
  - `battle` (`result`, `completionMessage`, `final.*`)
  - `checks[]`: `state`, `decision` (incl. `holdKind`), `risk` verdicts, `evidence` with `evidenceAt`, `scores`
  - `actions[]`: `source`, `mechanism`, `exitReason`, `slotIndex`, `lockedPoints`, `subsequentTradesInSlot`, and `replay` (`holdPath`, `swapPath`, `gapPoints`, `lockedBasisNote`, `reconciliation.soldAtSale` / `boughtAtSale`, `note`, `builtFrom`)
  - `directives[]`, `plans[]` (with `price`), `rationale[]`, `comparables`, `diagnostics`
  - `coverage.{checks, actions, directives, plans, rationale, evidence, calls, replay, series}`
  - `passes.{close, candles}`
  - `calls` is never rendered.
- **Every numeric path the screen renders has a class in its document's own declaration.** The screen computes exactly one number itself: the run count, `count(checks[] in a run)`. It is declared once, in `SCREEN_AGGREGATE_CLASSES` (`src/screens/filmRoomV2/filmRoomModel.js:57`), as `derived`. The sweeps fail any digit outside a marked number.
- **Gap found at the gate (AD4-10).** `soldAtSale.rescoredAtRecordedPx` and `.inputsDelta` were declared `rebuilt` although every operand is recorded. BA-48 reclassed both to `derived` (`filmTape.js:246–247`; item 1).

### 1.2 Series documents

- **The document.** `…/tape/{etDate}/series/{symbol}` is written by `candlePass.js:219` with `SERIES_NUMBER_CLASSES` (`filmTape.js:275`, 11 declared paths).
- **Fields:** `symbol`, `ownerId`, `role` / `roles`, `interval: '10m'`, `sessionOpen {at, value}`, `bars[] {t,o,h,l,c,v,m}`, `atChecks[]`, `provenance: 'market'`, `builtFrom`.
- **The rule.** `firestore.rules:523` allows a read only when `resource.data.ownerId == request.auth.uid`, and no client may write.
- **The read.** The screen reads all of a day's series with one owner-constrained list query (`filmRoomData.js`). A list is allowed only when it carries that constraint. The rules suite now pins this row (A2L3-7).

### 1.3 Holdings at the day's start and end (BA-45)

- **No stored field.** No field carries the held set: the tape has no holdings key (the top-level keys are listed in 1.1).
- **Derived instead.** BA-45's fallback applies. `deriveHoldings` (`filmRoomModel.js:262–273`) takes:
  - **the start:** the risk-verdict keys of the first check that recorded a risk decision;
  - **each change:** every recorded swap after that check moves one slot (`actions[]`: `symbolOut` → `symbolIn`, with `slotIndex`);
  - **the end:** the start after every swap. It is checked against the last risk-recording check's keys plus the swaps made at or after that check.
- **When it is drawn.** The grid is labelled derived. When the two ends disagree, or no check recorded a risk decision, the grid is omitted behind a coverage line that gives the reason. The empty day shows that state.

### 1.4 The allowlist verdict (BA-40)

- **The allowlist.** The cockpit's allowlist is server-side: env `COCKPIT_ALLOWLIST_UIDS` (`api/_utils/callRecords/allowlist.js:28`, read at `:47–49`), checked by `isCockpitOwnerAllowlisted` (`api/_utils/callRecords/mode.js:64`).
- **Why a new field was needed.** `GET /api/agent/cockpit-status` answered only `{ on }`. That is `resolveCallRecordsMode(battle) === 'on'`, which folds the calls mode together with the allowlist, so it could not answer "this owner is allowlisted" alone.
- **The verdict.** One added field: `allowlisted: isCockpitOwnerAllowlisted(battle?.ownerId)` (`api/agent/cockpit-status.js:92`).
  - It is computed after the ownership check, so a caller learns only their own membership. The 403, 404 and 500 bodies carry no `allowlisted`.
  - There is no new endpoint, and `vercel.json` is unchanged.
  - No uid reaches the client: `allowlist.test.js`'s import walk passes, and no `src/` chain reaches `allowlist.js` or `mode.js`.

### 1.5 Every reader of `FILM_ROOM_V2_ENABLED` (at `ccf96de6`) — all retired

- **Definition:** `src/config/featureFlags.js:2969`, with its docstring at `:2953–2968` and a mention at `:2944`.
- **The only behaviour branch:** `src/utils/reviewAvailability.js:128` (Stage 1 / Stage 3), imported at `:51`.
- **Pins:** `src/config/filmTapeFlags.test.js:77`, `:81–95`.
- **`DARK_BY_DESIGN` entry:** `src/config/flagPinGuard.test.js:194–195`.
- **The real-flag behaviour row:** `api/cron/film-tape-flip.live.test.js:125–142`.
- **Test mocks:**
  - `src/utils/reviewAvailability.test.js:16`
  - `api/_utils/filmTape/tapeAstraReview.test.js:24`
  - `api/_utils/filmTape/tapeAstraDelta.test.js:30`
- **At the final head no code reads `FILM_ROOM_V2_ENABLED`.**
  - `FILM_ROOM_V2_MODE` (`featureFlags.js:2989`; `FILM_ROOM_V2_MODES` `:2992`) has exactly one runtime reader: `resolveFilmRoomV2Mode` (`src/utils/filmRoomGate.js:42–43`). The route and the hub helper both go through it.
  - The mocks now spread a `FILM_ROOM_V2_MODE` getter.
  - The live row is kept as that file's deliberate tripwire for a screen flip.

### 1.6 The legacy screen

- **The route.** Route id `'filmRoom'` (`FILM_ROOM_ROUTE`, `filmTape.js:129`). App selects it by `screen` state: `src/App.jsx:9469–9474` at HEAD, inside the unchanged Film Room `ErrorBoundary`.
- **Entry points (all unchanged):**
  - the in-battle banner (`App.jsx:9450` → `AgentBattleScreen` → `FilmRoomBanner`)
  - Battle History (`App.jsx:9738`)
  - the mobile and desktop dashboards' `ReviewStation` (`CommandDashboard.jsx:284`, `CommandDashboardDesktop.jsx:192`)
- **What the off path keeps.** `src/screens/FilmRoomScreen.jsx:33`, its `useAgentBattle` battle-document subscription (`src/hooks/useAgentBattle.js:69–71`), and its `src/components/FilmRoom/*` children. All are untouched (`git diff c1822e39` is empty for them).
- **The golden.** No golden or snapshot of the legacy screen existed, so item 10 created one from the pre-build commit (§2, BA-40).

### 1.7 Theme guards

- **What was added.** Eleven new files under `src/screens/filmRoomV2/` were appended to both guards' `GUARDED_FILES`, each with a zero-violation entry in the existing schemas:
  - `src/theme/tokens.guard.test.js:112–127` and `tokenGuardBaseline.json` (`{}` entries);
  - `src/theme/motion.guard.test.js:115–130` and `motionGuardBaseline.json` (`count: 0` with an authority line).
- **Nothing else changed in a guard.** The diff is additive; the one "deletion" is the JSON comma on the previous last entry.
- **No allowance was granted.** Every v2 file is token-only and motion-token-only.

### 1.8 The design system

- **Tokens.** The shipped cockpit (`src/screens/battleView/`) takes its colours from `cssVar()` (`src/theme/cssTokens.js:168`), and v2 does the same:
  - colours through `FilmRoomKit`'s `C` (`cssVar`), with alpha through `rgba(var(--ft-*-rgb), a)`;
  - sign colours `--ft-success` / `--ft-danger` (`src/theme/tokens.css:207–209`);
  - teal, gold and copper from the same palette.
- **Hexes not adopted.** The mock-up's `#3DDC97` / `#FF4D5E` appear nowhere in `src/`, so they were not adopted.
- **Charts.** No existing chart component draws a 10-minute price line with comparables, volume and an overlay. The Deep dive and the score path are plain SVG in the kit's tokens.
- **Global CSS hazards, handled:**
  - `button{font-size:16px !important}`: hand-reset buttons with text in child spans;
  - `svg{height:auto}`: explicit chart heights.

### 1.9 Baseline

- **Linux, `TZ=UTC`, CI-shaped (`--maxWorkers=2`), private WSL clone, at `ccf96de6`:** 905 test files and 19,056 tests (18,969 passed, 0 failed, 87 skipped). **0 failing files.**
- **`lint:gate` and `vite build`** on the pre-build LF snapshot: both exit 0.
- **Rules suite** (Firestore emulator, Windows, Java 21): not run at the gate. It was run on the pre-build LF snapshot (`c1822e39`) during verification: 23 files, 403 tests, all passing, exit 0.
- **Degrade, don't stop.** Two things are not on the tape, so the screen omits them behind a coverage line or states them as derived:
  - the held set (1.3);
  - whether a held-by-default check's model call failed or returned something unusable (`decision.holdKind: 'default_failure'` only). See R2.

---

## §2 One row per rule

### 2.1 Commits

| # | Item | Commit |
|---|---|---|
| 0 | Amendment E and the mock-up of record (docs only; mock-up byte-identical, SHA-256 matched) | `ccf96de6` |
| 1 | BA-48 reclass | `41dd8edf` |
| 2 | BA-40: mode tri-state, per-owner verdict, Stage 3 per owner | `ed9a17f9` |
| 3 | Data layer | `e0081563` |
| 6 | Check detail (with the shared model, copy and kit it stands on) | `6724e21e` |
| 5 | Glance | `eb3516e0` |
| 7 | Study | `0dcbdcd9` |
| 8 | Deep dive with the evidence overlay | `5b32729b` |
| 4 | Shell | `746f19a9` |
| 9 | Reserved slots and `#swap-n` | `8a005b7e` |
| 10 | Route gate and the legacy goldens | `1930a834` |
| — | Review fixes, lenses 1–3 | `c10e6d38` |
| — | Review fixes, lens 4 (test integrity) | `40fcd168` |
| — | Merge `origin/main` (#943) | `3a89aeba` |
| — | Mutant follow-up (M40h props row) | `d4d51791` |
| — | `lint:gate` fix: the golden suite's mocked hook named as a hook | `e54b8309` |
| — | Whole-screen suites get their siblings' 30 s timeout (refuter A2V4-14) | `144828b0` |

Items 6, 5 and 4 landed out of the prompt's numeric order. Each commit's suites pass on their own: the check detail carries the shared kit that Glance and Study use, and the shell mounts the three depths.

### 2.2 Rules, tests and mutants

**How the mutants were run.** Each mutant is one exact-string source edit applied to an LF snapshot of the head. The runner applies it, runs the claiming files, expects a failure, and restores the file byte for byte.
- **BA set:** 32 mutants, run on `40fcd168`. The targeted baseline was green first (16 files).
- **Lens 4's set:** re-run on `40fcd168` across three snapshot copies: 75 distinct mutants (A1 is the same edit as M41F2).
  - Seven were **re-aimed** at the same defect in moved code: D4, M1, M2, N1, P1, P2 and H3. The BA set's M7b was re-aimed the same way as H3.
  - **P4** targeted the "Session high" row, which A2L1-4 removed. It was re-aimed as P4′, the "Session open" fact reading the first bar's open.
- `origin/main` was merged after the run (`3a89aeba`). The merge touches none of the mutated files or their suites.

| Rule | Commit(s) | Tests (mounted unless noted) | Mutant(s) → result |
|---|---|---|---|
| **BA-48** inputs part and rescore are `derived` | `41dd8edf` | `tapeAmendmentD.test.js` BA-48 rows: the new declaration; an older tape keeps its stored declaration and is labelled by it. Declaration pins in `tapeExport.test.js`. | M48 inputsDelta→rebuilt: **killed** (5) · DC1: **killed** · MD1 (screen labels by the code's table, not the document's): **killed** |
| **BA-40** the gate | `ed9a17f9`, `1930a834`, `c10e6d38` | <br>• `filmTapeFlags.test.js`: pin `'off'`, allowed values, literal plus pointer, never a `DARK_BY_DESIGN` key but named there <br>• `filmRoomGate.test.js`: the mode is read at call time and fails closed; a verdict is cached per owner and only when definite; the bound covers the whole ask <br>• `reviewAvailability.test.js`: Stage 1 under `'off'` with no read; Stage 3 only for an admitted owner; exactly three keys and no undefined value in every branch <br>• `cockpit-status.test.js`: `allowlisted` is the allowlist alone; a 403 leaks nothing <br>• `FilmRoomRoute.golden.jsdom.test.jsx`: `'off'` and non-admitted equal the goldens at first paint and settled; one mount; App's props themselves | **killed:** M40a pin, M40b unknown mode, M40c pending→on, M40d allowlisted from calls mode, M40e Stage 3 under `'allowlist'` without verdict, M40f a fourth key, M40g wrapper element, I0, I1, I2g, I2u, I3u, I4, I5, I5c, I5b, I6, I7, CS1, CS2 <br>**M40h** (a rebuilt `battle` prop the mocked hook ignores): **survived** at `40fcd168`. The props row added at `d4d51791` kills it (proven by applying M40h to the route). <br>I2bg and I3g fail the golden file alone: **killed**. Both survived at `1930a834`, as did I2g, I5, I5c and I6. |
| **BA-41 F1** the sold leg's sale; the fill apart | `0dcbdcd9`, `40fcd168` | Study swap-card rows: every card's sale group (recorded exit vs bar, rescore, inputs part, price part) and fill group; a swap whose fill and sale differ in sign; split headings | M41F1 sale→fill: **killed** · C1: **killed** · C2 headings swapped: **killed** (survived at `1930a834`) |
| **BA-41 F2 / BA-42** every number, its own class's marker | `6724e21e` onward | `sweepNumbers` on every depth and both days, everything opened: each `data-num` has the class `classOfNumber(doc.numberClasses, path)` and the stored value; any digit outside a marked number fails, including in `aria-label` / `title` | M41F2, M42, A2, A3, A4, A5c, A6, A7: **killed** · A5 (bare `data-num-text`), A8 (aria-label): **killed** (both survived at `1930a834`) |
| **BA-41 F3** no invented failure; a default hold is a state | `6724e21e`, `0dcbdcd9` | Model and check-detail rows (the `holdKind` state); rationale rows (a state entry, the platform's record, never agent words) | M41F3: **killed** · M46b: **killed** · G1, G4: **killed** |
| **BA-41 F4** Diagnostic only when present, never a failure under it | `0dcbdcd9`, `40fcd168` | Study: absent→no area; present→exactly its label and the presence line | M41F4: **killed** · G2 (survived at `1930a834`), G3: **killed** |
| **BA-41 F5** score path plus grouped runs | `eb3516e0` | Glance: the path's points are each check's recorded total; runs carry state, span and count (declared aggregate) | M41F5: **killed** |
| **BA-41 F6** explainer fixtures labelled | `0dcbdcd9` | Study: the explainer says "a fixture, not this battle"; the examples state their gap line | M41F6: **killed** |
| **BA-41** sign colours on recorded scores only | `6724e21e` onward | `sweepSigns`: any element whose style carries the success or danger token, in any form, must be a recorded score's own number | M41sign, B1, B5, B6: **killed** · B2, B3, B4: **killed** (all three survived at `1930a834`) |
| **BA-41** vocabulary | all | `sweepWords` over every text node, `aria-label` and `title` (inflections included), plus any heading starting "Why"; the oracle list is pinned in the harness and production's list is pinned equal to it | MV, L6b, L7: **killed** · L1, L3, L4, L5, L6, L8, L9: **killed** (all seven survived at `1930a834`) · L2 (**survived**): "takeaway" is a verdict word that is not on the prompt's list and not in the screen's copy. A broader verdict lexicon would be a ruling. |
| **BA-43** the evidence overlay | `5b32729b`, `40fcd168` | Deep dive: each marker drawn at the stamp's `px` on the chart's own price scale and at `evidenceAt` on its time scale; the delay shown, not smoothed; the opened panel lists only that check's stamp paths | M43: **killed** · M3: **killed** · M1, M2 (re-aimed), M4: **killed** (all three survived at `1930a834`) |
| **BA-44** check detail; risk wording; the protections note once | `6724e21e`, `40fcd168` | Check-detail rows; per-depth note count of exactly 1 where risk rows render | M44, M44b, F1, F2, F3: **killed** |
| **BA-45** holdings | `0dcbdcd9`, `40fcd168` | Model derivation rows; Study slot-by-slot maker and time; the grid omitted behind its coverage line when the ends disagree | M45: **killed** · P1, P2 (re-aimed): **killed** (both survived at `1930a834`) |
| **BA-46** rationale | `0dcbdcd9` | Collapsed by default; state entries in time order; the platform-written count kept | M46, M46b: **killed** |
| **BA-47** reserved slots, `#swap-n` | `8a005b7e` | Named, empty header and footer regions; one `#swap-n` per card, in time order | M47, M47b: **killed** |
| **BA-49** first open | `746f19a9` | Shown once per viewer (keyed by viewer); leaving without dismissing still counts | M49, J1, J2: **killed** |
| **§7 reads** | `e0081563`, `746f19a9` | Reads suite: one `getDoc` per tape day; `series/*` only on the Deep dive; no `onSnapshot`; no battle-document read | M7a, M7b (re-aimed), M7c, H1, H2, H2t, H3 (re-aimed), H4: **killed** |
| **BA-6** the exit maker precedes the result | `0dcbdcd9`, `40fcd168` | Every result row and every result number on the card comes after the maker label | M6: **killed** · E1: **killed** (survived at `1930a834`) |
| **BA-11** replay sentence, basis note, rebuilt style, hypothetical | `0dcbdcd9`, `40fcd168` | Every card; a real dash pattern; each count on its own | M11, D2: **killed** · D1, D4 (re-aimed): **killed** (both survived at `1930a834`) |
| **BA-20** coverage lines in all three states | all depths | Study and Deep dive `it.each`; Glance in all three states; the empty day | K2: **killed** · K1: **killed** (survived at `1930a834`) |
| Fixtures through A1's assembler and candle code | `e0081563` | `screenFixtures.test.js`: the committed JSON equals the passes' output | O1 (hand-edited px): **killed** |
| Every depth renders on both days | `746f19a9`, `40fcd168` | Each depth's own region on the empty day; component-level empty-day rows | N1 (re-aimed): **killed** (survived at `1930a834`) |
| Slot binding (stated facts) | `40fcd168` | Each check row's own score; the Deep dive facts bound to their paths; the swap path's end point | P3, P5, P6, P4′ (re-aimed): **killed** (all survived at `1930a834`) |

---

## §3 The review record (BUILD_RULES §2)

### 3.1 Setup

- **Four lenses ran in parallel,** each on its own LF `git archive` snapshot of `1930a834` with a `node_modules` junction. All were read-only, with targeted vitest files only.
- **Each lens had a refuter** on a fresh snapshot of its own.
- **Finding ids:** A2L*n*-*k* for lenses, and A2V*n*-*k* for refuters (which reuse the lens's *k*).
- **The criterion.** Severity follows Amendment E's exit criterion. A finding blocks only if:
  - a rendered number shows the wrong class or none;
  - a verdict, ranking or forbidden word appears;
  - a stated fact contradicts the tape;
  - a non-owner can read a tape or series document;
  - the off or non-allowlisted path is not byte-identical;
  - or the hub helper returns anything but its three keys.

### 3.2 Lens 1: domain honesty and fidelity of what the screen says. 2 blocking, 15 backlog.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2L1-1 | An `'unrecorded'` exit maker, or the gameplan meeting, was called "a platform rule" in the holdings grid, the role line and the Glance caret | CONFIRMED for `unrecorded`, which the tape produces by design (latent at HEAD); gameplan unreachable at HEAD | **BLOCKING, fixed** `c10e6d38`: `exitMakerOf` has four makers (agent, platform, gameplan, unrecorded), and each surface names its own |
| A2L1-2 | "No checks ran this day." under a capture-absent day (missing history read as inactivity) | CONFIRMED | **BLOCKING, fixed**: "No checks were recorded this day." |
| A2V1-11 edge | A name bought before the first risk record read "held at the first and the last check" | CONFIRMED (new edge, latent) | **BLOCKING by the letter, fixed**: an entry or exit is stated before "held"; the line says "risk record" |
| A2L1-3 | An earlier day of a completed battle read "battle in progress", and the eventual result was missing (BA-4) | PARTLY | Fixed: "battle complete", with a pointer to the last day's result |
| A2L1-4 | Session high and low on the Deep dive (hindsight, §13) | CONFIRMED | Fixed: removed; the axis carries the open and the last close |
| A2L1-5 | Digits inside stored notes ("2 entr(y/ies) …") carry no marker | PARTLY, needs a ruling | **Ruling R1 requested** (§3.6) |
| A2L1-6 | `coverage.evidence` never shown | CONFIRMED | Fixed: an evidence coverage line on the overlay |
| A2L1-7 | The stamp's risk shown as a bare "HOLD" | CONFIRMED | Fixed: "Risk decision recorded: …" |
| A2L1-8 | A marker fell back to the check's time without `evidenceAt` | PARTLY (no HEAD writer) | Fixed: markers only at a recorded `evidenceAt` |
| A2L1-9 | Legend markers hard-coded | CONFIRMED | Fixed: read from the series documents' declarations |
| A2L1-10 | "banked vs rebuilt" ran opposite to its arithmetic | CONFIRMED | Fixed: "rebuilt minus banked" |
| A2L1-12 | "entered by …" was taken from who made the exit | CONFIRMED (unsupported, not contradicted) | Fixed: worded as who made the swap's exit, as recorded |
| A2L1-13 | The not-filed example omitted its gap line | PARTLY (fixture replies allowed by F6) | Fixed: examples state their gap |
| A2L1-14 | An early filing showed a time with no date | CONFIRMED | Fixed: dated |
| A2L1-15 | A swap after the last check sat on the last pip | CONFIRMED | Fixed: placed past the strip |
| A2L1-16 | Small copy: "No series for .", "unavailable" twice, "1 swaps", the undeclared marker in the danger colour | PARTLY (`#swap-n` and "plan created/pending" refuted: they are the mock-up's) | Copy fixed. **Open (backlog):** the undeclared-class "?" marker is drawn in the danger colour. It appears only on a defect, and the sweeps fail that defect first. |
| A2L1-17 | Comments said the notice is marked on dismissal | CONFIRMED (comment only) | Fixed |

### 3.3 Lens 2: the gate, the flag-off guarantee, the hub contract. 0 blocking, 12 backlog.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2L2-1 | An out-of-range numeric `completedAt` made Stage 3 reject instead of answering three keys | PARTLY (real data cannot produce it) | Fixed: Stage 3 is wrapped, and it falls back to `'unavailable'` with three keys |
| A2L2-2 | The golden fail-loop only exercised its first case | CONFIRMED | Fixed: a remount and one ask per case |
| A2L2-3 | "Legacy mounted once" was not pinned | CONFIRMED | Fixed: a mount-count row |
| A2L2-4 | The golden fixture's chat used a mode the legacy chat filters out | PARTLY | Fixed: the fixture renders the review chat. Goldens were recaptured at `c1822e39` in a Linux clone, twice, identical: first paint `ab0eca98…3947` (unchanged), mounted `35c9508e…f60b`. |
| A2L2-5 | The hub's default verdict reader was not pinned to the shared cache | CONFIRMED | Fixed and pinned |
| A2L2-6 | One cached verdict per battle, though the answer is per owner (30/min window) | PARTLY | Fixed: one verdict per **owner** |
| A2L2-7 | The hub keys the verdict on `agentBattleId \|\| id` and reads the tape on `id` | REFUTED as reachable | **Open (hardening nit):** agentBattles documents carry no `agentBattleId` |
| A2L2-8 | Verdict state not keyed by battle | REFUTED as reachable | Fixed anyway, with a row |
| A2L2-9 | Under `'allowlist'`, an admitted owner's first open shows the legacy screen until the verdict lands (≤ 8 s, then cached) | PARTLY (forced by the non-admitted first-paint golden) | **Disclosed, by design.** The route cannot tell admitted from not-admitted before the answer, and byte-identity for the not-admitted path requires the legacy first paint. A second open is cached. |
| A2L2-10 | The 8 s bound started before `getIdToken` | PARTLY | Fixed: the bound covers the whole ask |
| A2L2-11 | Runway comments stale at `'allowlist'`; the step to `'on'` also reds the live tripwire row | CONFIRMED | Fixed: value-neutral comments; the runway names the tripwire |
| A2L2-12 | BA-40 says "in `DARK_BY_DESIGN`" but the guard only accepts `*_ENABLED` booleans | CONFIRMED as a deviation | **Ruling R3 requested** (§3.6) |

### 3.4 Lens 3: reads, security, lifecycle, wiring. 2 blocking, 9 backlog.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2L3-1 | A version-1 replay (no Amendment D split) said "No replay for this swap." beside its own drawn fork | CONFIRMED (2026-09-21/22 keep v1 replays permanently) | **BLOCKING, fixed**: both split groups carry the replay's note or `REPLAY_VERSION_NOTE` |
| A2L3-2 | A failed series read showed "No series for X"; the refuter added that an offline `getDocs` resolves from cache as empty | CONFIRMED, with the stronger offline case | **BLOCKING, fixed**: an error branch; `fromCache` counts as an error |
| A2L3-3 / -4 | Depth state (a check index, a plan filter, rationale open) carried across a switch to a cached day; one path crashed | CONFIRMED | Fixed: depth content keyed by day |
| A2L3-5 | Same as A2L2-9 | CONFIRMED | Disclosed (see A2L2-9) |
| A2L3-6 | A failed read was cached for the screen's life | CONFIRMED | Fixed: failures are re-read on return |
| A2L3-7 | No rules row for the series list query | CONFIRMED as a test gap (refuter ran it on the emulator: passes) | Fixed: `filmTapeDenials.rules.mjs` series-list row |
| A2L3-8 | Seen-once comments | CONFIRMED | Fixed |
| A2L3-9 | Tap targets under 24 px; `Segmented` tabs had no tabpanel or keys | CONFIRMED | Fixed: 24 px hit areas and a `tabpanel`. **Open (backlog):** arrow-key handling and `aria-controls` on `Segmented`. |
| A2L3-10 | "A dark build costs the main chunk nothing" overstated | CONFIRMED | Fixed: the comment says what the eager bundle holds (route, kit, copy) |
| A2L3-11 | A replay path with every instant null would throw | CONFIRMED (writer cannot produce it) | Fixed: no fork without instants |

**Lens 3, checked clean:**
- one `getDoc` per day;
- series only on the Deep dive, once per day;
- no `onSnapshot` and no battle-document read in v2;
- StrictMode double effects give exactly `['tape','series']`;
- series `ownerId` equals the tape's;
- cockpit-status refuses a non-owner before the new field;
- no uid in `src`.

### 3.5 Lens 4: test integrity. 5 blocking, 9 backlog. 71 mutants at `1930a834`: 36 killed, 35 survived.

| id | Finding | Disposition (`40fcd168`) |
|---|---|---|
| A2L4-1 | `sweepWords` read `textContent`, where adjacent elements join with no separator ("the best" + "Coverage"); inflections were missed | **BLOCKING, fixed:** <br>• every text node, `aria-label` and `title` swept separately <br>• inflections matched <br>• any heading starting "Why" flagged |
| A2L4-2 | Overlay rows asserted self-reported attributes | **BLOCKING per the lens (its refuter: backlog), fixed:** <br>• y is bound to the stamp's `px` on the chart's own price scale (two of its axis labels) <br>• x is bound to `evidenceAt` <br>• markers seen off the bar line <br>• the opened panel holds only that check's stamp paths |
| A2L4-3 | The holdings row was satisfied by the legend | **BLOCKING, fixed:** slot-by-slot maker, tone and time |
| A2L4-4 | Deep dive facts not bound to their paths | **BLOCKING, fixed:** each label is bound to its path |
| A2L4-5 | "Three keys in every branch" skipped two Stage 3 branches | **BLOCKING, fixed:** exactly three keys and no undefined value across every mode × tape outcome |
| A2L4-6 / -8 | Bare `data-num-text` exempt; attributes unswept; sign colours recognised in one form only | Fixed in the harness |
| A2L4-7 | The word oracle was production's own list | Fixed: the prompt's list is pinned in the harness; production's is pinned equal to it |
| A2L4-9 / -10 / -11 | Partial assertions: the dash pattern, maker before every result number, split headings, each hypothetical count, the Diagnostic area's exact text, Glance coverage in three states, the empty day per depth, the protections count, check-row and swap-end binding | Fixed. One code change came with it: the hypothetical mark now holds when either stored count is above zero. |
| A2L4-12 / -13 | The golden fail-loop was vacuous; the hub's cached reader was not exercised | Fixed in `c10e6d38` |
| A2L4-14 | A fixed flush count in the reads suite; a scaffolding comment | Fixed: bounded polling |

**Refuter 4** (a fresh snapshot of `1930a834`; its own mutant runs, restore-checked byte for byte) gave these verdicts:

- **CONFIRMED:**
  - A2V4-1 (BLOCKING);
  - A2V4-3 (BLOCKING);
  - A2V4-4: BLOCKING, with a caveat. The facts come from the series document; if "contradicts the tape" is read as the tape document only, it is backlog.
  - A2V4-6 … A2V4-13 (backlog).
- **PARTLY:**
  - **A2V4-2, downgraded to backlog.** Its own mutant M5, a real tape replay value listed as "price behind this check", is killed by the original row. Only M4, which takes the price from the series sample, escapes.
  - **A2V4-5, BLOCKING but narrow.** I5 is refuted: `tapeAstraReview.test.js:810–825` kills it. I5c and a realistic variant are confirmed. The variant, I5r, forwards `passes.close.lastError` as a fourth key; that key is undefined in every fixture but a string in production.
  - **A2V4-14.** The `flush(8)` flake did not reproduce in about 43 runs. A new observation replaced it: three reserved-slot rows failed once under load and passed on rerun. That suite ran on vitest's default 5 s timeout.
- **It flagged** that B4 (a rebuilt line stroked in a sign colour by the gap) is arguably a colour verdict. The current code does not do this, and `sweepSigns` now fails it.

**Disposition:**
- Every confirmed item was already fixed in `40fcd168`, including the downgraded A2V4-2.
- **I5r**, run against the head, is killed by the A2L4-5 every-branch rows (2 rows fail).
- **A2V4-14:** `144828b0` gives the reserved and reads suites, which mount the whole screen, their siblings' 30 s timeout.

**Mutant rerun on the fixed tree (`40fcd168`):** 75 distinct mutants, 74 killed. All 34 of the original survivors that lie inside the requirements are now killed; only L2 survives. Results by mutant are in §2.2.

### 3.6 Rulings requested (none blocks; each is recorded)

- **R1 (A2L1-5): digits inside stored text.** Stored coverage notes and missing-input lists are rendered verbatim as the tape's words, and some contain digits ("2 entr(y/ies) carried platform-written text …").
  - BA-42 says a rendered number without a declared class is a defect.
  - The build treats stored text as quotation, as the mock-up does. The sweep exempts only text marked as a record, and nothing composed.
  - **Recommendation:** A1 stores such counts as classed numbers, and the screen renders them by path.
- **R2 (F3 wording): what the tape records about a held-by-default check.** F3's example label is "model call failed · the system held by default". The tape records `decision.holdKind: 'default_failure'` but not the failure's class, so "failed" cannot be told apart from "returned nothing usable".
  - The screen says "no usable model result · the system held by default" and labels it as the platform's record of the check.
  - If the founder wants F3's exact words, the tape needs the failure class first.
- **R3 (A2L2-12): `FILM_ROOM_V2_MODE` and `DARK_BY_DESIGN`.** BA-40 says the mode is "pinned 'off' and in `DARK_BY_DESIGN`".
  - The guard can only hold `*_ENABLED` booleans: a string key fails its integrity row.
  - The build follows the `PILOT_JOURNEY_MODE` / `CALL_RECORDS_MODE` / `ANTICIPATION_THRESHOLD_LINT_MODE` precedent: pinned directly (pin, allowed values, literal plus pointer) and named in the `DARK_BY_DESIGN` block. `filmTapeFlags.test.js` asserts both halves.
  - The guard file itself is outside this build's pre-authorization.

### 3.7 Found by the final verification

- **The `lint:gate` failure.** `react-hooks/rules-of-hooks` rejected the golden suite's mocked `useAgentBattle`. It was an anonymous default export that calls `useRef`, added for the A2L2-3 mount counter in `c10e6d38`. No targeted run catches this; only the gate does.
- **The fix.** `e54b8309` names the mock `useAgentBattle`. Nothing else changed.
- **What was re-run.** The gate was re-run on LF snapshots of `e54b8309` and `144828b0`, exiting 0 both times. The full Linux suite was re-run on the final code head, `144828b0`.

### 3.8 Outside Amendment E (reported, not changed)

- **The first open of an admitted owner shows the legacy screen until the verdict lands.** This is A2L2-9 / A2L3-5; it is inherent in the byte-identity requirement.
- **No production caller of `getReviewAvailability` exists yet.** The hub build will wire it.

---

## §4 Visual check (non-blocking)

**Method:**
- Playwright (`playwright-core` driving the installed Edge, headless) against a local preview that renders `FilmRoomScreenV2` from the committed Sep-23 and empty-day fixtures.
- 390×844 and 1440×900; Glance, Study and Deep dive; both days. 12 shots, plus 11 of the mock-up itself (its mobile frame and its desktop frame).
- Saved outside the repo, in the session scratchpad under `shots/final/` and `shots/mock/`.
- Horizontal overflow: 0 px in all 12.
- Console: one 404 for a preview-only static asset (390, Glance). It is not from the screen.

**Expected deviations (F1–F6, BA rules):**
1. **F1:** the swap card's "Split by cause" is the sold leg's sale (recorded exit vs bar, rescore, inputs part, price part), and the fill is its own group. The mock-up has four other rows ("Scoring inputs", "Platform's delayed quote").
2. **F3:** a held-by-default check reads "no usable model result · the system held by default" (see R2). The mock-up's rationale shows the platform's placeholder sentence, which the tape does not store.
3. **F5:** Glance has the score path above the check strip and the runs list. The mock-up's Glance A has the strip only.
4. **BA-43:** the Deep dive draws evidence markers, with an evidence coverage line and the delay sentence.

**Deviations from data the tape does not carry, or numbers with no declared class (BA-42):**

5. **No section counts** in headings ("Holdings 7 slots", "Swaps 3", "Checks 23 of 23", "Rationale 10"). These are screen-computed counts with no declared class. The tape's coverage notes carry what it records.
6. **Glance score card:** no "Coverage · complete · the last recorded check · 23 of 23" line. The tape has no score coverage section. "Day change · from the battle start" omits the "(0)".
7. **Deep dive facts:** "Change · open to close" and "Volume · session" are omitted (computed, no class), and so are session high and low (A2L1-4). The facts are: on the day, Session open, Close · the last 10-minute bar, Sector line.
8. **Deep dive axes:** no intermediate price gridlines, no percent axis, and no intermediate time ticks (computed values). The axis labels are the series' session open and last close, and the time labels are 9:30 AM and close. The mock-up's company name ("Microsoft") is absent; the series carries no name.
9. **Holdings coverage** reads "partial · derived from recorded values: the first and last checks' risk decisions …". The mock-up says "recorded at the start and the end". There is no stored field (BA-45).

**Other deviations:**

10. **Header:**
    - no avatar;
    - "Back" for "Battles";
    - the subtitle is archetype and date, and omits the mock-up's "BaggerBomb · one-day battle";
    - at 1440 the subtitle truncates ("WED, SEP 23, 20…"). The mock-up truncates its longer subtitle the same way.
11. **The number-kinds legend** spells out the rebuilt and market sources ("rebuilt from 1-minute bars at the battle's check times", "market data · EODHD 1-minute bars, aggregated").
12. **Check-strip legend:** the strip's legend holds the swap carets and "tap a check". The state swatches are in the runs list beneath it, one per run. The mock-up lists the six states under the strip.
13. **Rationale entries** are fully collapsed to their label and a "Show the recorded words" control (BA-46, collapsed by default). The mock-up shows a clamped first lines plus "Read more".
14. **Study jump chips** include Holdings and Checks. The mock-up's set starts at Swaps.
15. **Swap cards:**
    - "Swap · 12:45 PM" with `#swap-n` on the right; the mock-up reads "Swap 1 · 12:45 PM";
    - the hold and swap path end values sit under the fork, not beside it;
    - the "Deep dive · SYMBOL" links match.
16. **Empty day:**
    - the Study holdings reason appears both in its coverage line and in the empty card;
    - the Glance result reads "unavailable · opponent score never recorded" above the platform's "Result: Draw." message, as the prompt asks.

---

## §5 Founder actions for the flip

**Nothing here is done by this build. No merge, no flip, no rules deploy.**

1. **Review and merge the draft PR** after the one review named in Amendment E's exit criterion. Rule on R1–R3 (§3.6) whenever convenient; none blocks.
2. **Publish the Firestore rules.** This makes the tape's owner-read block (`firestore.rules:519–526`, unchanged by this build) live. The rules suite proves it, including the series list row added here.
3. **Confirm the allowlist.** The founder's and the QA tester's uids must be in the server env `COCKPIT_ALLOWLIST_UIDS`, the same list the cockpit uses. No uid goes in the client.
4. **Open a two-line flip PR** that sets `FILM_ROOM_V2_MODE = 'allowlist'` (`src/config/featureFlags.js`) and moves its pin row in `src/config/filmTapeFlags.test.js` in the same commit.
   - A dry run at `'allowlist'` showed only the pin row going red (refuter A2V2-11).
   - Expect each admitted owner's **first** open in a page life to show the legacy screen for up to 8 s until the verdict lands. After that it is cached.
5. **The founder and the QA tester open five real battle days** in v2, across Glance, Study and Deep dive, including an earlier day of a multi-day battle and a day whose replays predate Amendment D (2026-09-21/22). Note anything that reads wrong against the tape.
6. **`'on'` is a later founder decision,** its own PR. That step also turns around the hub-helper tripwire row in `api/cron/film-tape-flip.live.test.js:125`.
7. **Rollback** at any step is the same one line back to `'off'` with its pin. The legacy screen is untouched.
