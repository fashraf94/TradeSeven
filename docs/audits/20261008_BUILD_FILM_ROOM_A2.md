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
| Polish pass (2026-10-08) | The addendum's eight restorations, one commit each. Then the BUILD_RULES §2 review of the pass: 28 findings, 2 confirmed blocking, both fixed. One §2.3 baseline line was added. 150 mutants, all killed. Full suite 0 failing at `74259c60`. See §6; §4 now shows each restored element as matching. |

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
- **Re-run for the polish pass (§6)** at `74259c60`: the same 12 shots, in the polish session's scratchpad under `shots/polish-final/`, plus the header at 1024 and the swap card and strip legend at both widths. Horizontal overflow: 0 px in all 12. Console: the same preview-only 404 (390, Glance), not from the screen.

**Expected deviations (F1–F6, BA rules):**
1. **F1:** the swap card's "Split by cause" is the sold leg's sale (recorded exit vs bar, rescore, inputs part, price part), and the fill is its own group. The mock-up has four other rows ("Scoring inputs", "Platform's delayed quote").
2. **F3:** a held-by-default check reads "no usable model result · the system held by default" (ruling R2 adopts it). The mock-up's rationale shows the platform's placeholder sentence, which the tape does not store.
3. **F5:** Glance has the score path above the check strip and the runs list. The mock-up's Glance A has the strip only.
4. **BA-43:** the Deep dive draws evidence markers, with an evidence coverage line and the delay sentence.

**The elements the build left out, after the polish pass** (status at `74259c60`):

| # | Element | Mock-up | Screen now | Status |
|---|---|---|---|---|
| 5 | Section counts | "Holdings 7 slots", "Swaps 3", "Checks 23 of 23", "Rationale 10", chip counts | "Holdings · 7 slots", "Swaps · 3", "Checks · 23 of 23" (Glance and Study), "Rationale · 10", each plan chip's count; every count marked `derived` | **matches** (§6 item 1) |
| 6a | Day change reference | "from the battle start (0)" | "from the battle start (0 R)" — the stored reference with its own marker | **matches** (item 3) |
| 6b | Score card coverage line | "Coverage · complete · the last recorded check · 23 of 23" | none | deviation, kept: the tape has no score coverage section, and the prompt does not restore it |
| 7a | "Change · open to close", "Volume · session" | both | both, computed from the symbol's own bars, marked `market` | **matches** (item 4) |
| 7b | Session high and low | not in the mock-up's facts | none | unchanged (A2L1-4: hindsight) |
| 8a | Chart axes | price gridlines, a price axis, a % axis, time ticks 9:30 … 3:30, close | gridlines at round % steps, the price at each (left), the % (right), ticks 9:30, 11:00, 12:30, 2:00, close; each axis captioned once with its class | **matches** (item 4). The 3:30 tick is left out: at 390 px it would print over "close". |
| 8b | Company name | "Microsoft" | the app's directory name ("Microsoft") beside the symbol and on the chart; none for a symbol the directory does not name, or names only by its symbol (AMD) | **matches** (item 4) |
| 9 | Holdings coverage | "recorded at the start and the end" | "partial · derived from recorded values …" | deviation, kept: no stored field (BA-45) |
| 10 | Header | the agent's mark, "Battles", "archetype · BaggerBomb · one-day battle · date" | the cockpit's still avatar (neutral), "‹ Battles", "Trend Follower · BaggerBomb · one-day battle · Wed, Sep 23, 2026" | **matches** (item 5). On desktop the subtitle wraps between its parts instead of truncating (the mock-up cuts its year at 1440; at 1024 the cut would hide the length and the date). |
| 11 | Number-kinds legend | short labels | the tape's own class labels, spelled out | deviation, kept; its box narrows to 340 px on desktop so the subtitle has room |
| 12 | Check-strip legend | six state swatches, then the carets | the six swatches with the screen's words (the default hold in R2's wording), then the carets; a state outside the six that the day shows adds its own | **matches** (item 8) |
| 13 | Rationale entries | clamped first lines, "Read more" | the hypothesis, two clamped lines, "Read more" / "Show less" | **matches** (item 6) |
| 14 | Study jump chips | start at Swaps | include Holdings and Checks | deviation, kept |
| 15a | Swap card title | "Swap 1 · 12:45 PM" | "Swap 1 D · 12:45 PM" — the ordinal marked `derived`; `#swap-n` carries the same n | **matches** (item 2) |
| 15b | Path end values | beside the fork | beside the fork at desktop width, each at its end point's height; under it on the phone | **matches** (item 7) |
| 16 | Empty day | — | unchanged | deviation, kept (as before) |

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

---

## §6 Polish pass (Amendment E addendum, 2026-10-08)

**Prompt:** "Build prompt — Film Room A2: polish pass on the draft PR (Amendment E addendum)" (Fable, 2026-10-08).
**Branch:** `git fetch origin` first. PR #944 was open and still a draft at `d31e09cf`. The session's worktree branch (`claude/film-room-a2-polish-a24b09`, the app's name for it) was reset to `origin/claude/film-room-a2-screen` and pushed back to `claude/film-room-a2-screen` by refspec, a fast-forward. `origin/main` was still `7631c9e6`, so there was nothing to merge.
**Fence and flags:**
- Zero BUILD_RULES §1 edits.
- `FILM_ROOM_V2_MODE` stays `'off'`.
- The pass changed files only under `src/screens/filmRoomV2/`, plus one new test (`api/_utils/filmTape/screenCheckCounts.test.js`), one line in the §2.3 import baseline (`api/_utils/archetypeImportBoundaryBaseline.json`, 6.6), the Amendment E spec and this report.
- The route, the gate, the data layer, the hub helper and the legacy screen are untouched, so the off path is still the legacy screen byte for byte. The golden suite re-ran green.

### 6.1 Executive verdict

| Question | Answer |
|---|---|
| What changed | The eight elements you asked back, under the addendum's narrowed BA-42 (R4): section counts, swap ordinals, the day change's reference, the Deep dive's computed facts, axes and company name, the header, the rationale preview, the fork's end values beside it, and the strip's six-state legend. Nothing else changed, apart from fixes to these elements that the review asked for (6.5). |
| The rule that governs them | Every restored number is a marked number. Its class comes from its document's declaration (the day change's reference, the fork's end values) or from `SCREEN_AGGREGATE_CLASSES` (the counts, the ordinal, the change, the volume, the % axis). Chart ticks are scaffolding: no marker on the tick, and each axis names its class once, in its caption. |
| Mutants | **150 run, 150 killed.** <br>• At `47190681` (before review): 58, one per defect class per item (6.2). Two malformed mutants (a syntax error, not a survivor) were rewritten and rerun. <br>• At `505596a7` (after the review fixes): 92 — the 57 still applicable, 13 for the review fixes, lens 2's 21 (M6 re-aimed after the column fix) and lens 1's time-tick mutant. None killed by a timeout. |
| Review (BUILD_RULES §2; the pass alone is 15 files) | 3 lenses and 3 refuters: 28 findings. **2 confirmed BLOCKING, both fixed:** A2P1-1 ("Checks · n of m" could overstate on a day-2 tape) and A2P1-2 ("Best Buy" brought a forbidden word into reach). Refuters downgraded the two other blocking claims to backlog (A2P2-1, A2P2-2: guard gaps that predate the pass, with no wrong number shipping). **None open:** all 28 are fixed or recorded with a reason (6.5). |
| Full suite (Linux, `TZ=UTC`, CI-shaped) | **`74259c60`:** 928 test files, **0 failing**; 19,683 tests (19,595 passed, 0 failed, 88 skipped). Private WSL clone, `--maxWorkers=2`. <br>The run before it, at `c70769a0`, failed 1 row: the §2.3 import ratchet, fixed in `74259c60` (6.6). |
| Rules suite | **`74259c60`:** 23 files, 404 tests, all passing (Windows, Java 21, LF snapshot; WSL has no Java). No rules file changed in the pass. |
| `lint:gate` / `vite build` | exit 0 on an LF snapshot of `74259c60` / exit 0 on `74259c60`. The lazy v2 chunk is 65.31 kB (18.09 kB gzip), up from 58.57 kB. The pushed head (this report's docs-only commit) is rebuilt from its LF archive before the push |
| Visual check | §4 re-run: 12 shots at `74259c60`, 0 px horizontal overflow; each restored element moves from "deviation" to "matches" |
| CI | Runs on the pushed head; its result is reported with the head SHA |

### 6.2 One row per item

| # | Item | Commit | Tests (rows) | Mutants |
|---|---|---|---|---|
| 0 | The addendum, verbatim, at the end of Amendment E (`cmp`-identical to the prompt's text) | `099adf9f` | — | — |
| 1 | Section counts. Holdings: "· 7 slots". Swaps: "· 3". Checks: "· 23 of 23" on Glance and Study, or "n recorded". Rationale: "· 10". Each plan chip carries its count. | `60a415ea` (review fix `1bcdcf3f`, row `c70769a0`) | The model's `checkCounts` rows (writer shapes included). Glance "n of m" rows: n before m, the empty day's "0 recorded", the evaluation-entry case. Study rows: each count bound to its own list, plus a variant tape where the lists differ in length. The production table is pinned equal to the harness oracle. **Writer-built rows:** `screenCheckCounts.test.js` (5 cases). | 20 at `47190681`, all killed. These are wrong class, missing marker and wrong list for each of the six aggregates, plus the gaps rule and the guard. Re-run at `505596a7`: see 6.6. |
| 2 | "Swap 1 · 12:45 PM": the ordinal is marked `derived` and is time order. `#swap-n` reads the same sequence. | `50e993e2` | Model: `swapOrdinals`, with time order taken over tape order and an action with no time last. Study: the ordinal and the anchor on every card; a reversed tape; the slot index stays the tape's recorded number. | 4, all killed: class, marker, tape-order list, and the anchor reading another sequence. |
| 3 | "Day change · from the battle start (0 R)" | `e5c17264` | Glance: the reference's path, value and marker; a prior-day basis with a non-default declaration; none when the basis is unavailable. | 3, all killed: marker, path, and a class taken from a constant. |
| 4 | Deep dive. Facts: "Change · open to close" and "Volume · session" (`market`). Axes: gridlines at round % steps, the price on the left, the % on the right, ticks 9:30 / 11:00 / 12:30 / 2:00 / close, one caption per axis. The company name from `COMPANY_NAMES`. | `bee45f5e` (review fixes `1bcdcf3f`, `505596a7`) | Model: `seriesFacts`, `pctTicks`, `fmtPercent`. Deep dive: each fact from its own series document; incomplete symbols and missing volumes; each tick at its price on the chart's own scale, each gridline at its label; each time tick at its instant; the captions' classes from their sources; the name, or the symbol alone (including "Best Buy" → BBY); the desktop minis. Screen: the sweeps' exemptions bite. | 16, all killed: the facts' class, marker and list; incomplete or missing data; the % axis class; caption missing or a constant; a tick off its gridline; the time step; the name's source; both harness exemptions widened. |
| 5 | Header. The agent's mark is the cockpit's still `AgentPresenceMount` with no score passed, so its standing is neutral. Back label "‹ Battles". Subtitle "Trend Follower · BaggerBomb · one-day battle · Wed, Sep 23, 2026". | `b33eb0f7`, `47190681` (review fix `1bcdcf3f`; §2.3 baseline line `74259c60`) | Screen: the subtitle, separators that travel with the part after them, the mark (static, environment off, duel with no scores), the back button; `headerParts` (length source, never the one-day fallback, the 'unknown' sentinel, BaggerBomb for both agent modes). | 6 at `47190681`, all killed: back label, scores passed, reactive face, the one-day fallback, archetype precedence, the game word. The last is retired in the re-run, because the word is now constant. |
| 6 | Rationale: the hypothesis, then a two-line clamped preview with "Read more" / "Show less", collapsed by default. | `a315b1cc` (review fix `1bcdcf3f`) | Study: every entry starts collapsed with its own words, one "Read more", opening and closing alone; words that fit get no button; the clamp style; a preview that comes to overflow after a resize gains its button, which is a disclosure (`aria-expanded`, `aria-controls`). | 2, all killed: open by default, no clamp. Review mutants: no re-measure, no `aria`. |
| 7 | At desktop width, the hold and swap paths' end values sit beside the fork, each at its end point's height; on the phone they stay under it. | `7cdf1b53` (review fix `1bcdcf3f`) | Study at desktop: path, class and label of each end value; its height against the fork's last drawn point; the overlap spread, its order and its midpoint; a fork that can't be drawn keeps its values under it; the column is sized by its tags; the desktop Study passes all sweeps. | 4, all killed: never beside, wrong height, wrong path, no spread. |
| 8 | The six check-state swatches under the strip, then the carets. A state outside the six adds its own swatch. | `522df7a3` | Glance: the six in order, with words and looks pinned; every pip has its swatch with the same look and words; extra states; the empty day. | 3, all killed: a constant look, extras dropped, the default hold missing. |

### 6.3 The addendum's rulings, and how this pass applies them

- **R1 (digits in stored notes):** unchanged. Stored notes and missing-input lists stay quotation (`Rec`) with no marker. Backlog for the cards build.
- **R2 (held by default):** the wording stands. The new strip legend uses it for the default hold's swatch.
- **R3 (the mode and `DARK_BY_DESIGN`):** adopted as built; nothing changed.
- **R4(a):** `SCREEN_AGGREGATE_CLASSES` now declares eleven computed numbers; it declared one before the pass. The harness pins the addendum's classes as its own oracle, `SPEC_AGGREGATE_CLASSES`. The number sweep checks every aggregate four ways:
  - its class and marker against that oracle;
  - that it sits in its own site;
  - that its text equals its computed value;
  - that its value matches one recomputed from the documents by an independent oracle.
  The model test pins production's table equal to the oracle.
- **R4(b):** the sweep exempts a tick label only when both hold:
  - it is marked `data-axis-scaffolding` inside the price chart;
  - its axis has exactly one caption, carrying one marker of the class the axis's source declares (the series document's own declaration for the price axis; the screen's for the % axis).
  Anything else is a stray digit. Tick labels are `aria-hidden`.
- **R4(c):** the reference is a `TapeNum` by its path, `score.dayChange.reference`, so its marker is the tape's declaration (recorded in every written tape).
- **R4(d):** the directory is `COMPANY_NAMES` (`src/config/stockData.js`, 140 names), the app's lookup table for company names.
  - A name is shown only when it differs from the symbol.
  - A name holding a forbidden word ("Best Buy") is shown as the symbol alone. This is R4(d)'s own fallback; R5's list stands.
  - The number sweep exempts a name's digits ("Phillips 66") only as that symbol's own entry, letter for letter.
- **R5 ("takeaway"):** no change. The word sweep's list is the prompt's, with no exemptions.
- **R6 (rationale preview):** the clamped preview is the design of record's `Collapsible`, and it is collapsed by default.
- **The admitted owner's first open:** accepted; nothing changed.

### 6.4 Choices the prompt left open (stated, not silent)

1. **"n of m".**
   - n is the rows with a record. That is every row except deferrals and missing records: the tape's own `NON_CHECK_STATES`, the writer's "known checks".
   - m is the minted range `passes.close` records: its `tickSeqRange` widened by the gaps it attributes to the day.
   - The screen says "n recorded" when:
     - there is no range;
     - m would be smaller than n;
     - or any row with a record has no tickSeq, i.e. a check known only by its evaluation entry, whose number may lie outside the range (review A2P1-1).
   - Writer-built cases show the count is honest in every one (6.5).
2. **Ordinals.** "Swap n" is time order. The `#swap-n` anchor reads the same sequence, so label and anchor cannot disagree. For every writer-written tape the anchor is unchanged, because the writer stores actions in time order.
3. **Battle length.** It is spelled as a word ("one-day battle"), as the design of record writes it, for one to ten days, and it carries no marker.
   - Its source is the battle's `timing.tradingDays`, or else the tape's `dayNumber` on its final day.
   - It is never `battleDays`' one-day fallback.
   - Refuter A2PV1-6 confirms it matches the prompt's wording. **For your ruling if you want it marked.**
4. **The subtitle's first part is the archetype, not the agent's name**, as the prompt's subtitle reads. The agent's own name is no longer shown in v2 (A2P1-11 e). The archetype comes from `getArchetypeDisplayName` for the battle's archetype, else the tape's; the writer's `'unknown'` sentinel is omitted.
5. **"BaggerBomb"** is shown for every battle: both agent game modes are BaggerBomb modes (`src/constants/agentGameModes.js`).
6. **The agent's mark** is `AgentPresenceMount` at `'static'` with no scores, as ArenaHeader and CharacterAvatar mount it. Its standing is neutral, so the face carries no mood about the day. With presence off, it is CharacterAvatar's still disc.
7. **Header layout.**
   - On desktop the subtitle wraps between its parts rather than truncating. The design of record truncates; at 1024 that would hide the length and the date.
   - The depth control gives way first, from 400 px down to a 280 px floor.
   - The legend's box is 340 px.
8. **Axes.**
   - Gridlines at round steps of the % move from the session open, at most five across the chart.
   - Time ticks every 90 minutes from the open, stopping 45 minutes before the close. The design of record's 3:30 tick would print over "close" at 390 px.
   - Tick clocks drop AM/PM, as the design of record writes them, including the session open's "9:30".
   - The 0 step's price is the record's own marked session open, placed on the axis, so it has no unmarked twin. The price gutter is 64 px.
9. **The computed facts** show only when the series document carries them whole. A bar without a volume drops the volume; a symbol the candle pass lists as incomplete shows neither fact.
10. **Count pills** appear where the mock-up has them:
    - Swaps and Rationale show no "0";
    - Holdings shows a count only when its grid is drawn;
    - Checks always shows one.
11. **The rationale preview** shows the hypothesis whole (the design of record's bold line) and clamps the words to two lines.
12. **The fork's end-value column** is sized by its own tags. The fork gives way, so a long symbol or value never runs into the split.

### 6.5 Review record (BUILD_RULES §2)

**Setup.**
- Three lenses ran on separate LF `git archive` snapshots of `47190681`, with node_modules linked. They were read-only on git and the shared tree, ran targeted vitest files only, and restored every mutation byte for byte (checked with `cmp`).
  - lens 1: domain honesty;
  - lens 2: test integrity;
  - lens 3: wiring and layout.
- Each lens's findings went to a refuter on a fresh snapshot, told to refute them with a concrete repro.
- **Ids:** A2P*n*-*k* for lens findings; A2PV*n*-*k* for refuter verdicts, which reuse the lens's *k*. They never collide with the build's A2L / A2V ids.
- **Severity** follows Amendment E's exit criterion.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2P1-1 | "Checks · n of m" counted a check known only by its evaluation entry in n but not in m. A day-2 tape read "39 of 39" beside a no-record row; another read "38 of 39" against 37 records. | **CONFIRMED BLOCKING** (16 writer cases; reachable when a check's capture is skipped or times out on day 2+) | **Fixed** `1bcdcf3f`: "n recorded" whenever such a row exists. Rows: `screenCheckCounts.test.js` (case A and refuter case I), the model and the Glance. |
| A2P1-2 | "Best Buy" (BBY) brings "best" into reach, and the harness exempted display names from the word sweep without a ruling. | **CONFIRMED** (blocking under a literal reading). BBY is outside the battle universe but reachable by a model-named plan symbol or an equipped watchlist. | **Fixed** `1bcdcf3f`: such a name shows the symbol alone, and the word-sweep exemption is gone. |
| A2P1-3 | The strip legend's extra states share swatches with listed ones (e.g. "decision not recorded" looks like HOLD). | CONFIRMED, BACKLOG (the tones predate the pass) | Open, backlog: every such state is listed by its own words, so nothing is false. |
| A2P1-4 | Time-tick positions unguarded. | CONFIRMED, BACKLOG | **Fixed:** a row binds each tick to its instant. |
| A2P1-5 | "‹ Battles" goes to the dashboard. | CONFIRMED, BACKLOG | Open: the label is the mock-up's and the prompt's. **For your ruling.** |
| A2P1-6 | (a) The length is an unmarked word. (b) The writer's `'unknown'` archetype was stated as "Unknown". | CONFIRMED, BACKLOG | (a) Recorded in 6.4 #3. (b) **Fixed** `1bcdcf3f`. |
| A2P1-7 | The writer stores `v: 0` for a missing volume, so "Volume · session" can undercount. | CONFIRMED, BACKLOG | Open, writer backlog. The screen is faithful to the document. |
| A2P1-8 | Some directory names are dated or are brands (RTX "Raytheon", TJX "TJ Maxx"). | CONFIRMED, BACKLOG | Open. This is the app's directory, which R4(d) names. |
| A2P1-9 | "BaggerBomb" depended on the tape's load state. | CONFIRMED, BACKLOG | **Fixed** `1bcdcf3f`: constant for every agent battle. |
| A2P1-10 | The phone subtitle truncates its date. | PARTLY, BACKLOG: the mock-up truncates the same way | Open; it matches the design of record. The date also shows in the pill. |
| A2P1-11 | Behaviour changes beyond the eight items (anchor order; "not recorded" for an untimed swap; tick clocks; gutters; the agent's name; legend width; desktop wrap; the rationale toggle; chip text; `data-agg-value`; fork width; the empty-day legend; Section DOM). | CONFIRMED (spot-checked), BACKLOG | Recorded here and in 6.4. Each follows from an item or its review fix. |
| A2P2-1 | The sweep accepted any declared aggregate name anywhere: a recorded number shown under a computed class passed. | PARTLY: the mutants reproduce. BLOCKING refuted: no shipped number has a wrong class, and the gap predates the pass (BASE-M10 survives at `d31e09cf`). | **Fixed** `1bcdcf3f`: each aggregate is checked for its site, its text against its value, and its value against an independent oracle. |
| A2P2-2 | The "desktop … same sweeps" row swept only the Deep dive's numbers. | PARTLY: BLOCKING refuted. The row predates the pass (`746f19a9`), and the desktop depths are clean. | **Fixed** `1bcdcf3f`: every depth, all three sweeps, everything opened. |
| A2P2-3 | The desktop Study (the fork's end tags) was never word-swept. | CONFIRMED, BACKLOG | **Fixed**: desktop Study sweeps on both days. |
| A2P2-4 | Nothing bound "n" before "m". | CONFIRMED, BACKLOG | **Fixed**: a text row on a variant tape. |
| A2P2-5 | A count's text was never compared with its value. | CONFIRMED, BACKLOG | **Fixed** in the sweep. |
| A2P2-6 | Three wrong-list mutants the fixture could not tell apart. | CONFIRMED (M17 only barely live) | **Fixed**: one variant tape parts all three lists. |
| A2P2-7 | The clamp itself was never asserted. | CONFIRMED, BACKLOG | **Fixed**: the clamp-style row. |
| A2P2-8 | Time-tick and gridline positions unbound. | CONFIRMED, BACKLOG | **Fixed**: both rows. |
| A2P2-9 | Desktop fork paths (no-instant replay; spread midpoint). | CONFIRMED, BACKLOG | **Fixed**: both rows. |
| A2P2-10 | The harness's new branches had no bite rows. | CONFIRMED, BACKLOG | **Fixed**: bite rows for the site, value, text, two-marker caption, scaffolding wrapping a record, and another symbol's name. |
| A2P3-1 | The rationale preview did not re-measure after a resize. A phone turned from landscape to portrait showed clipped words with no "Read more". | CONFIRMED, BACKLOG | **Fixed** `1bcdcf3f`: `ResizeObserver`, with a row. |
| A2P3-2 | The fork's end column was a fixed 150 px; a long symbol or value overflowed into the split. | CONFIRMED (every desktop width), BACKLOG | **Fixed**: the column is sized by its tags. |
| A2P3-3 | The header at 1024 squeezed the subtitle to 4 lines, with a dangling " · ". | CONFIRMED, BACKLOG | **Fixed**: the depth control gives way first, and separators travel with the part after them (2 lines at 1024). |
| A2P3-4 | "BaggerBomb" appeared, then disappeared. | CONFIRMED, BACKLOG | **Fixed** (= A2P1-9). |
| A2P3-5 | "Read more" carried no disclosure state. | CONFIRMED, BACKLOG | **Fixed**: `aria-expanded` and `aria-controls`. |
| A2P3-6 | Tick labels were read aloud as a bare run. | CONFIRMED, BACKLOG | **Fixed**: `aria-hidden`. (KindMark's role-less `aria-label` predates the build's screen; backlog.) |
| A2P3-7 | The session-open label sat on the lines. This existed at `d31e09cf`; the pass's gutter left a gap at the 0 step. | CONFIRMED, BACKLOG | **Fixed** `1bcdcf3f`: the record's open sits on the price axis at its 0 step. |

**Refuted outright:** none. **Downgraded** from BLOCKING to backlog by the refuters: A2P2-1 and A2P2-2 (both fixed anyway).

**Outside the pass (reported, not changed):** writer case C. When `cronState.tickSeq` is absent, the stored checks note says "their sequence numbers are among the gaps" for a number listed in neither `gaps` nor `unattributedGaps`. Per R1 the screen quotes that note verbatim. This is writer backlog.

### 6.6 Verification

- **Full suite** (Linux, `TZ=UTC`, CI-shaped `--maxWorkers=2`, in a private WSL clone `~/pd-a2p` used only by this pass):
  - **`c70769a0` (the first full run): 928 test files, 1 failing row.** It was the §2.3 import-boundary ratchet (`api/_utils/archetypeRegistry.test.js`).
    - Item 5 (`b33eb0f7`) imports `getArchetypeDisplayName` from `src/data/archetypeDisplay`, a legacy archetype table, and did not record the new importer.
    - Every targeted run had been scoped to the screen's own suites. That is the trap the CharacterPane precedent (`0705c073`) describes.
  - **The fix is `74259c60`:** the baseline line, per BUILD_RULES §1 (the ratchet is a separate gate; a new direct importer is recorded in the same change). The test's "import through archetypeRegistry" route serves `api/` consumers; that registry is node-only and a React screen cannot load it.
  - **`74259c60`: 928 test files, 0 failing;** 19,683 tests (19,595 passed, 0 failed, 88 skipped). The off-path goldens (`FilmRoomRoute.golden.jsdom.test.jsx`) pass, so the off path is still byte-identical to legacy.
- **Rules suite:** `74259c60`, 23 files, 404 tests, all passing. This is the Firestore emulator on Windows (Java 21, LF `git archive` snapshot); WSL has no Java. `firestore.rules` and `test/rules/` are unchanged by the pass.
- **`lint:gate`:** exit 0 on an LF snapshot of `74259c60`.
- **`vite build`:** exit 0 on `74259c60`.
  - `FilmRoomScreenV2` is still its own lazy chunk: 65.31 kB (18.09 kB gzip), up from 58.57 kB (15.88 kB).
  - The main chunk grew by 3.99 kB: the kit, model and copy that the route's fallback imports.
  - AgentPresence, `archetypeDisplay` and `stockData` were already in the main chunk (lens 3 checked this).
  - The pushed head, this report's docs-only commit, is rebuilt from its own LF archive before the push.
- **Mutants:** 58 run at `47190681` and 92 at `505596a7`, all killed (6.1). Each ran in its own LF snapshot and was restored byte for byte (`cmp`).
- **Visual check:** §4, re-run at `74259c60`. Also checked: the header at 1024 and 1440 (subtitle on 2 lines; no overflow), the swap card and the strip legend at both widths, and the rationale preview opening and closing.
- **CI:** runs on the pushed head. Its result is reported with the head SHA. The PR stays a draft.

---

## §7 Astra round 1 (Amendment E addendum 2, 2026-10-09)

**Prompt:** "Fix prompt — Film Room A2: Astra's three findings (round 1)" (Fable, 2026-10-09). Astra's review is committed verbatim as `docs/audits/20261008_ASTRA_REVIEW_FILM_ROOM_A2_SCREEN.md`; the founder's rulings on it (Addendum 2: R7, R8, the F2 note) are appended verbatim to Amendment E.
**Branch:** `git fetch origin` first. PR #944 was open and still a draft at `819b5fb5`, the prompt's head. The session's worktree branch (`claude/film-room-a2-screen-08aad5`, the app's name for it) was reset to `origin/claude/film-room-a2-screen` and is pushed back to `claude/film-room-a2-screen` by refspec, a fast-forward.
**Fence and flags:**
- Zero BUILD_RULES §1 edits.
- No writer source changed: nothing under `api/` is in the round's diff. The new writer-to-screen tests import the writer's fixtures and passes; they never edit them. The tape keeps every stored string as written.
- `FILM_ROOM_V2_MODE` stays `'off'`. The route, the gate, the data layer, the hub helper and the legacy screen are untouched, so the off path is still the legacy screen byte for byte (the golden suite re-ran green).
- Synthetic fixtures only.

### 7.1 Executive verdict

| Question | Answer |
|---|---|
| What changed | Astra's three findings, fixed as the prompt and the rulings direct, plus what the round's review asked for (7.6). The round changed files only under `src/screens/filmRoomV2/`, Amendment E, Astra's review file and this report. |
| F1 | Every recorded word reaches the screen only as an attributed quotation, bound to its tape path. On writer output carrying each forbidden phrase in every channel, the screen's own voice sweeps clean on the whole screen. |
| F2 | The Deep dive's time axis is the trading session from the writers' calendar. "close" sits at the calendar's close, an early close included; an incomplete series ends where its bars end. |
| F3 | "one-day battle" is a marked number (`derived`). ~~The sweep now fails on any spelled-out number in the screen's own voice.~~ **Corrected 2026-10-10 (Astra B3, §9):** the sweep failed on its pinned vocabulary only — zero to twenty, "single" and "dozen" — so "ninety", "a hundred" and "a thousand" passed. The follow-up pass closes the list (zero to ninety, hundred, thousand, million, billion, dozen, single, half, double, triple, twice) and adds a copy inventory. Three lines of copy were reworded (7.4). |
| Mutants | **102 runs; every mutant killed in the end, none by a timeout.** <br>• As each fix landed: F1 15 at `caf07475`; F2 9 at `f35f2311`, run twice (F2-M3c survived the first run; row (a′) was added for it); F3 14 at `c84ee640`. <br>• All re-run at `ef41df56` with the review fixes: 50 — the 38 above (four re-aimed at code that moved) and 12 for the review fixes, including each lens's surviving mutants. 49 killed; F1-H2 survived (after A2A1-4 its bite row no longer isolated the root check) and is killed at `7dee5dc6`. <br>• At `7dee5dc6`: 5 for the refuter round, all killed. |
| Review (BUILD_RULES §2; the cumulative branch diff is far past the threshold) | 3 lenses and 3 refuters, on separate LF snapshots: 17 lens findings and 1 refuter finding. **None blocking, none refuted outright.** 12 fixed (`ef41df56`, `7dee5dc6`); 6 recorded with a reason — A2A1-2 kept as built, 2 for your ruling or attention (A2A3-5, A2A3-6), 3 backlog that predate the round (A2A2-3, A2A2-4, A2A3-7). See 7.6. |
| Full suite (Linux, `TZ=UTC`, CI-shaped) | **`7dee5dc6`:** 930 test files, **0 failing**; 19,735 tests (19,647 passed, 0 failed, 88 skipped). Private WSL clone, `--maxWorkers=2`. |
| Rules suite | **`7dee5dc6`:** 23 files, 404 tests, all passing (Windows, Java 21, LF snapshot; WSL has no Java). No rules file changed. |
| `lint:gate` / `vite build` | exit 0 / exit 0, both on an LF snapshot of `7dee5dc6`. The lazy v2 chunk is 64.97 kB (17.74 kB gzip), from 65.31 kB. The pushed head (this report's docs-only commit) is rebuilt from its LF archive before the push. |
| Visual check | Headless Edge, 390×844 and 1440×900, on writer-built days: the quoted rationale with "best" collapsed and expanded, the incomplete INTC chart, the early-close chart, the subtitle (7.7). 0 px horizontal overflow. |
| CI | Runs on the pushed head; its result is reported with the head SHA. |

### 7.2 One row per finding

| Finding | Commit | Tests | Mutants |
|---|---|---|---|
| **F1** — recorded words render as attributed quotation (R7) | `caf07475` (review fixes `ef41df56`) | `FilmRoomQuotation.writer.jsdom.test.jsx`. For each of the ten forbidden phrases, `sep23Day()` gets the phrase in every recorded-words channel of its SOURCE records (each non-failed evaluation's rationale and hypothesis; every plan candidate's signal and threshold; every chat exchange's message and reply; the filed directive, so the retained one too; the platform's completion message). The real `writeTapeDay` and `runCandlePass` run through `buildTapeDay`. Then: (c) every planted string is byte-identical on the tape; Study is mounted collapsed (every long quotation a CSS-clamped preview of the full value), expanded and at desktop width, and the result card; (a) every planted path renders verbatim inside a bound quotation with its attribution, and nowhere else (no other text node, `aria-label` or `title`); (b) the screen's own-voice sweep returns `[]`, while the same sweep with no documents (nothing bound) does see the phrase. **Review fix A2A1-1:** a second pass mounts the whole screen on the same writer days — every depth at phone and desktop width, everything opened — plus every check's record and every Deep dive symbol. Guard rows: a forged path, screen copy inside a quotation, no quotation root, no attribution, a path outside the channels, attribute copies, a wrong author, a wrong time, a missing date. Updated rows in the Study, Glance and screen suites. | 15 at `caf07475`, all killed: recorded text outside a quotation (hypothesis, plan signal, reply, completion words); no attribution; one author for every quotation; a time not the record's; screen copy inside a quotation; a forged `data-quote-path`; recorded text copied into a `title` and into an `aria-label`; a forbidden word in a heading and in an attribution; the guard without its text check and without its root check. |
| **F2** — "close" only at the session close | `f35f2311` (review fixes `ef41df56`) | `FilmRoomDeepDive.session.writer.jsdom.test.jsx`, each on the real candle pass's output: (a) Astra's repro, only INTC's first 30 one-minute rows — the axis runs 9:30 to the 4:00 PM close, INTC's line ends at 10:00 AM, the tail is blank, its last close sits at its line's end, and the only "close" is at 4:00 PM; (a′) a missing head (INTC from 10:00 AM) — the axis still opens at 9:30; (b) the 2026-11-27 early close — "close" at 1:00 PM ET, one tick (11:00), none past it; (b′) **review fix A2A2-1:** an incomplete series on that early-close day — "close" still at 1:00 PM; (c) the full-session control, three symbols — unchanged; a date the calendar does not know as a session names no close. | 9 at `f35f2311`, all killed after one fix: the label at the last bar's end; a hard-coded 16:00 close (in the session reader and in the chart); the domain's end, the whole domain, and the domain's start taken from the bars; ticks past the close; the last close's label out at the right edge; "close" on a non-session date. **F2-M3c (the domain's start from the first bar) survived its first run;** the missing-head row (a′) was added for it, and it is killed. |
| **F3** — the battle length is a marked number (R8) | `c84ee640` (review fixes `ef41df56`) | Screen suite: Astra's setup (the complete Sep-23 tape, `timing.tradingDays` holding its one session) — the subtitle's length is the `count(timing.tradingDays)` aggregate, class `derived`, marker D, value 1, text "one", "one-day battleD"; a two-day timeline reads "two" whatever the tape's `dayNumber` says, and the harness oracle recounts it from the battle; the fallback to the final tape's `dayNumber` carries that document's declaration (`derived`, then `recorded`); neither source omits it; **review fixes:** words up to "ten", eleven omitted (A2A3-2); a missing-tape header still marked and recounted (A2A3-4); a timeline counted as the day picker reads it (A2A3-8). The number-word sweep: every word on the list bites, singular and plural (A2A3-3); a marked number's own text is exempt and the words beside it are not; a second number text is not exempt (A2A3-1); the directory's own "Capital One" is exempt, the same words elsewhere are not (R4(d)); the tape's stored text rendered verbatim is exempt, screen words around it are not (R1); the rewordings, each pinned by a sweep. | 14 at `c84ee640`, all killed: missing marker (both sources); wrong class; counted from the tape's `dayNumber`, and from `battleDays`' one-day fallback; the fallback marked by the screen's aggregate; a number word added to the legend; each of the three rewordings reverted; the guard without attributes, with R1 widened, with a marked number's whole element exempt, with any display name exempt. |

**All mutants re-run at `ef41df56`:** 50, 49 killed; the survivor (F1-H2) is killed at `7dee5dc6` (7.1).

### 7.3 The rulings, and how this round applies them

- **R7 — recorded words are quotation.** One component, `Quotation` (`FilmRoomKit.jsx`), for every recorded-words channel: the rationale and hypothesis; the player's message; the filed directive text and the retained one; the agent's reply; the plan's signal and threshold; the platform's completion words. It takes a document and a path, never a string. The element carrying `data-quote-path` holds the stored value and nothing else. Beside it: "— who · when". Who is as the tape records it: the agent, the player, the platform, or "the stored plan" / "the stored directive" where the tape records no author. When is the record's own instant, marked as an instant, with its date when it fell before the tape's day. The clamped preview clamps the full value with CSS (R6). The sweep exempts an element only when it is the quotation component, carries `data-quote-path`, its text equals the tape value at that path, its path is one of R7's channels, and it carries an attribution. Everything else stays under the boundary: headings, labels, notices, attributes, company names, and the tape's own notes.
- **R8 — a spelled-out quantity is a number.** The length is declared in `SCREEN_AGGREGATE_CLASSES` as `'count(timing.tradingDays)': 'derived'` and renders through the marked-number widgets; the fallback takes the tape's own declaration for `dayNumber`. The word styling stays: "ONE-DAY BATTLE [D]". The build report's proposed duration exception (§6.4 #3) is withdrawn.
- **F2 (no ruling needed).** "close" names the calendar's session-close instant.
- **Two answers the founder gave in this session (asked because the rulings did not settle them; recorded here, not yet in Amendment E):**
  1. *Spelled-out numbers inside the tape's stored text.* The writer stores BA-11's sentence, "one-step hypothetical …", as each replay's `label` and in the replay coverage note; the writer may not change, and the prompt allowed only marking or rewording. **Answer: R1 covers words too.** Stored text rendered verbatim is exempt from the number-word check as its digits are from the digit check; only the screen's own fallback sentence is reworded (7.4).
  2. *The directive card's other recorded text.* **Answer:** `canonicalText` and `retainedDirectiveText` are quotations too, credited "the stored directive" (the tape records no author for them).

### 7.4 Copy reworded for R8 (every hit in the screen's own copy)

| Where | Before | After |
|---|---|---|
| `filmRoomCopy.js` `explainerNote` | "Example cards · a fixture, not this battle · the three states a card can take." | "… · each state a card can take." |
| `filmRoomModel.js` `deriveHoldings` (the holdings coverage note when the record does not reconcile) | "… do not reconcile into one held set, so the grid is not drawn" | "… do not reconcile into a held set, so the grid is not drawn" |
| `filmRoomCopy.js` `REPLAY_SENTENCE` (the screen's own BA-11 sentence) | "one-step hypothetical through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle" | "a hypothetical of this swap alone, through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle" |

**For your attention (review A2A3-5):** the reworded sentence shows more often than "where a replay stores no label" suggests. The close pass writes `replay: null` (`api/_utils/filmTape/tapeAssemble.js:475`), so every swap card shows the screen's sentence from the close pass until the candle pass runs the next morning, and permanently for a crypto leg or a tape outside the candle window. A card whose replay is written shows the stored label, verbatim. This departs from V1.2 §7's "BA-11 … wording verbatim" for the screen's own sentence; the prompt's R8 instruction (mark or reword) is what directs it. Unchanged copy that the list does not cover: "shown once", and the ordinals "first" / "last" (A2A3-6) — **for your ruling if R8's class should include them.**

### 7.5 Choices the prompt left open (stated, not silent)

1. **The attribution's form.** "— the agent · 12:00 PM" under the words; no curly quotation marks (composed marks inside the bound element would make its text differ from the stored value). The rationale entry keeps BA-46's label line above its two quotations.
2. **The explainer's example cards** are fixture text, the screen's own copy, laid out like a quotation (words, then "— the player") but never a `Quotation`: they hold no tape path.
3. **A directive row with no player message** shows "not recorded" where it showed empty quotation marks. The writer never produces one (it requires the message).
4. **The retained directive's "when"** is its own row's filing time, the only instant the tape records for it (A2A1-2).
5. **The calendar.** `src/utils/marketCalendar.js`, the zero-import module the writers read through `api/_utils/marketSchedule.js` and `tapeTime.js`; the screen already loaded it through `tapeSchedule.js`. No calendar data is copied and no 16:00 is hard-coded. A date it does not know as a session (a holiday, a weekend, a year outside its horizon) falls back to the bars' extent and labels its right end with the last bar's end time, never "close".
6. **The last close's own label** now sits at its line's end: just before it when the line ends right of the chart's middle (every full session: unchanged), just after it otherwise (review A2A2-2), never in the blank tail beside "close" and never over the price axis.
7. **Company names with a number word** ("Capital One", COF): exempt as the directory's own entry, as R4(d) already exempts "Phillips 66"'s digits; the same words anywhere else are swept.
8. **Lengths of eleven or more days** are still omitted (words run "one" … "ten", as before).

### 7.6 Review record (BUILD_RULES §2)

**Setup.**
- Three lenses ran on separate LF `git archive` snapshots of `c84ee640` (the three fixes), with node_modules linked. They were read-only on git and the shared tree, ran targeted vitest files, `lint:gate` and `vite build`, and restored every mutation byte for byte (checked with `cmp` or blob hashes):
  - lens 1 (A2A1): R7 / F1, recorded words;
  - lens 2 (A2A2): F2, the session close;
  - lens 3 (A2A3): R8 / F3, the class closure, and the round's integrity (fences, flags, goldens, lint, build).
- Each lens's findings went to a refuter on a fresh LF snapshot of `ef41df56` (the review fixes), told to refute each finding with a concrete repro and to check its fix by re-applying the lens's surviving mutants.
- **Ids:** A2A*n*-*k* for lens findings; A2AV*n*-*k* for refuter verdicts, which reuse the lens's *k*. They never collide with the build's A2L / A2V or the polish pass's A2P / A2PV ids.
- **Severity** follows the exit criterion as Addendum 2 restates it.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2A1-1 | The R7 writer test mounted only Study and the result card: a recorded-words leak anywhere else (check detail, Deep dive facts) survived every test (two survivors). | CONFIRMED, BACKLOG (a test gap; no live leak) | **Fixed** `ef41df56`: the whole-screen pass (7.2). Both survivors killed (10/10 rows each). |
| A2A1-2 | The retained directive is attributed to its own no-change row's time, not the original filing's. | PARTLY: accurate, but "the wrong time" is overstated. The writer copies the text from the battle's earlier filings and stores no instant for it; on a day-2 tape the filing may not be on the tape at all; "No new directive filed" rules out reading 2:20 PM as a filing time. | Kept (7.5 #4). If wanted, a later wording is "in force at …". |
| A2A1-3 | A card filed before the tape's day dated its header but not its quotations' attributions (undoing A2L1-14 inside the quotation). | CONFIRMED, BACKLOG — reachable through the real writer | **Fixed** `ef41df56`: `etWhen`, one helper for the header and the attribution; the oracle dates it independently. |
| A2A1-4 | The sweeps exempted a bound quotation with no attribution, or of a path that holds no one's words; only `quoteDefects` caught it, and some sweeps run without it. | CONFIRMED, BACKLOG | **Fixed** `ef41df56`: the exemption needs binding, an R7 channel and an attribution. Re-run as F1-H2 (7.7): its bite row needed an attribution of its own, added in ``7dee5dc6``. |
| A2A1-5 | `directiveCardOf` still composed "Retained: …" from recorded words (unused). | CONFIRMED (latent) | **Fixed** `ef41df56`: screen words only. |
| A2AV1-N1 (new, refuter) | The sweeps and the leak scan read only `aria-label` and `title`; recorded words copied into `aria-description` (or any other text-bearing attribute) escaped. | — (found by the refuter; latent: no such attribute in the screen) | **Fixed** ``7dee5dc6``: every text-bearing attribute is swept and scanned; the refuter's survivor is killed. |
| A2A2-1 | An incomplete series on an early-close day was untested; "close" at the bars' end there survived. | CONFIRMED, BACKLOG (the code was right) | **Fixed** `ef41df56`: row (b′); the survivor is killed. |
| A2A2-2 | The relocated last-close label ran into the price axis's gutter on phones for a short series. | CONFIRMED, BACKLOG, **measured in headless Edge**: 19.5–43.2 px into the gutter at 280–414 px, over a tick or the marked session open. | **Fixed** `ef41df56`: the label takes its line's inner side; zero intrusion and zero overlap at every width, full sessions byte-identical. The refuter's threshold survivors (`> 150`, `> 990`) are killed by row (a″), ``7dee5dc6``. |
| A2A2-3 | A gap inside a series is bridged by a straight line. | CONFIRMED, not criterion 3: no number, time or word is stated in the gap; the chart's coverage line says "partial · … 36 of 39 ten-minute bars"; the line code predates the build. | Open, backlog (outside the three findings). |
| A2A2-4 | The desktop "All symbols" sparklines space points by index, not time. | CONFIRMED, BACKLOG (predates the build; nothing stated contradicts the tape) | Open, backlog. |
| A2A3-1 | A second number text inside a marked number escaped both sweeps (digits as well as words, the refuter adds). | CONFIRMED, BACKLOG | **Fixed** `ef41df56`: exactly one number text per marked number. |
| A2A3-2 | The length's upper bound was untested. | CONFIRMED | **Fixed** `ef41df56`. |
| A2A3-3 | Not every pinned word was exercised by a row (the matcher was already built from the list — the refuter's correction). | CONFIRMED | **Fixed** `ef41df56`: every word, singular and plural. |
| A2A3-4 | The length's oracle never ran without a tape. | CONFIRMED | **Fixed** `ef41df56`. |
| A2A3-5 | (a) The reworded BA-11 sentence shows every night between the close and candle passes and permanently on a crypto leg or out-of-window tape; it departs from V1.2 §7's "wording verbatim". (b) The number-word exemption for stored text rests on an in-session answer not yet in Amendment E. | CONFIRMED as disclosures, not defects. The refuter measured (a): close-pass-only tape, all three cards show the screen's sentence; a crypto card shows the caveat twice in two wordings (the stored coverage note and the screen's sentence). | Recorded for you in 7.3 and 7.4. |
| A2A3-6 | "shown once" and the ordinals "first"/"last" are outside the pinned list. | CONFIRMED observation | **For your ruling** (7.4). |
| A2A3-7 | The missing-tape "scheduled at 10:15 PM ET." line renders its clock without the instant mark; no sweep mounts that state. | CONFIRMED, not criterion 1 (instants are text) | Open, backlog (predates the round). |
| A2A3-8 | The length counted the raw timeline; the day picker drops non-dates (a §9 split; the writer only stores dates). | CONFIRMED, low | **Fixed** `ef41df56`. |

**Refuted outright:** none. **Blocking:** none — no lens or refuter found a rendered number without its class, a forbidden word in the screen's own voice, a stated fact against the tape, or any fence contact.

**Also observed by the refuters (backlog, unchanged):** an evidence marker can sit over the last-close label (full sessions too, both placements); the R7 writer file now takes about 3 minutes on Windows (each whole-screen row 10–13 s against a 90 s limit).

### 7.7 Verification

- **Full suite** (Linux, `TZ=UTC`, CI-shaped `--maxWorkers=2`, in a private WSL clone `~/pd-a2astra` used only by this round): **`7dee5dc6`: 930 test files, 0 failing;** 19,735 tests (19,647 passed, 0 failed, 88 skipped), 307 s. The two new files are the round's writer-to-screen suites. The off-path goldens (`FilmRoomRoute.golden.jsdom.test.jsx`) pass, so the off path is still byte-identical to legacy.
- **Rules suite:** `7dee5dc6`, 23 files, 404 tests, all passing. This is the Firestore emulator on Windows (Java 21, LF `git archive` snapshot); WSL has no Java. `firestore.rules` and `test/rules/` are unchanged by the round.
- **`lint:gate`:** exit 0 on an LF snapshot of `7dee5dc6`.
- **`vite build`:** exit 0 on `7dee5dc6`. `FilmRoomScreenV2` is still its own lazy chunk: 64.97 kB (17.74 kB gzip), from 65.31 kB (`Quote` and `Collapsible` gave way to one `Quotation`). The pushed head, this report's docs-only commit, is rebuilt from its own LF archive before the push.
- **Mutants:** 102 runs, each in its own LF snapshot, restored byte for byte (7.1).
- **Visual check** (non-blocking; §4's method): headless Edge through `playwright-core`, at 390×844 and 1440×900, on `ef41df56` (`7dee5dc6` changes tests only). The days were built through the real close and candle passes in a scratch snapshot, never committed: the Sep-23 day with "This is the best entry." leading one rationale and "Sell the worst name right now — that was a mistake." as a player's message; Astra's INTC repro; the 2026-11-27 early close. Shots in the session scratchpad under `shots/astra-r1/`.
  - **The quoted rationale:** collapsed, the two-line clamp shows "This is the best entry. The plan from the open is still waiting …" with "Read more", then "— the agent · 12:00 PM"; expanded, the whole stored value, "Show less", the same attribution. The directive card quotes the player's words verbatim with "— the player · 2:20 PM".
  - **The incomplete INTC chart:** the axis reads 9:30 · 11:00 · 12:30 · 2:00 · close, "close" at 4:00 PM; INTC's line ends at 10:00 with the tail blank; its last close "31.30 M" sits just after the line's end and overlaps no axis label (measured: 0 overlaps at both widths).
  - **The early-close chart:** 9:30 · 11:00 · close, "close" at 1:00 PM; the whole early session drawn. (That fixture's evidence stamps are the writer fixture's own synthetic quotes, far below its synthetic bars, so its price scale is stretched; a fixture artifact, not the screen.)
  - **The subtitle:** "TREND FOLLOWER · BAGGERBOMB · ONE-DAY BATTLE [D] · WED, SEP 23, 2026" at 1440; at 390 the line truncates its date, as before (A2P1-10), and the marked length stays whole.
  - Horizontal overflow: 0 px everywhere. Console: one preview-only 404 at 390, as in §4, not from the screen.
- **What this round supersedes in earlier sections:** §6.4 #3 (the unmarked length, "for your ruling") is answered by R8: the length is now marked. §4's header row (#10) now reads "ONE-DAY BATTLE [D]".
- **Outside the round (reported, not changed):** A2A2-3 (a gap inside a series is bridged by a line), A2A2-4 (the desktop sparklines space points by index), A2A3-7 (the scheduled-pass clock has no instant mark and the no-tape states are not swept), an evidence marker that can sit over the last-close label. All four predate the round.
- **CI:** runs on the pushed head. Its result is reported with the head SHA. The PR stays a draft.

---

## §8 Merge prep (2026-10-10)

**Prompt:** "Merge-prep prompt — Film Room A2: the CI census failure, and the docs for the merge" (Fable, 2026-10-10).
**Branch:** `git fetch origin` first. PR #944 was open and still a draft at `39422435`, the prompt's head, and `origin/claude/film-room-a2-screen` was that SHA. The session's worktree branch (`claude/film-room-a2-census-ci-78256f`) sat at `main`. The session's permission guard refused `git reset --hard` onto the PR head, so a new local branch, `claude/film-room-a2-screen-78256f`, was cut from `origin/claude/film-room-a2-screen` with `git switch -c`. The tree was clean, and the old branch has no commits of its own. The work is pushed to `claude/film-room-a2-screen` by refspec, a fast-forward.
**Fence and flags:**
- Zero BUILD_RULES §1 edits by this pass. `git diff --name-only origin/main HEAD` names none of the eleven fenced paths. The merge does carry #947's own edits to `api/agent/decide.js` and `api/_utils/agentBattleService.js`, which are already on `main`.
- No writer source changed: nothing under `api/` is in this pass's commits other than what the merge brings from `main`.
- `FILM_ROOM_V2_MODE` is `'off'` at both merge parents and at every commit of this pass, with its pin row unchanged (`src/config/filmTapeFlags.test.js:79`).
- The census is untouched: `git diff origin/main HEAD -- src/data/unconfirmedOutcome.census.test.js` is empty. No reader was added, and nothing was ruled.
- The PR stays a draft. No merge, no flip, no rules deploy.

### 8.1 Executive verdict

| Question | Answer |
|---|---|
| Docs | `2ec10854`. Addendum 3 (R9–R12) is appended verbatim to Amendment E, and Astra's confirmation review is committed verbatim as `docs/audits/20261009_ASTRA_CONFIRMATION_FILM_ROOM_A2_SCREEN.md`. |
| Merge | `origin/main` at **`9850851c`** (#947) merged at **`60b4a8db`**. **No conflicts.** Two files changed on both sides, and git merged both without overlap (8.2). |
| The CI failure | Reproduced on the merged tree exactly as in CI: 25 readers against the census's 24, with `src/screens/filmRoomV2/FilmRoomScreenV2.jsx` the only extra one. |
| Cause | `FilmRoomScreenV2.jsx:133` passed `duel={{ statusFeed: null }}` to the agent's avatar. That is a key holding `null`, **not a read of the feed**. The census scans source text, so the name alone counts. |
| Fix | `9ddb6831`: the prop is dropped. The avatar's inputs are unchanged (standing 0, no events), shown by an equivalence probe; both mutants are killed. The census stays at 24 readers, untouched. |
| Full suite (Linux, `TZ=UTC`, CI-shaped) | **`9ddb6831`** (the merged head with the fix): 938 test files, **0 failing** (931 passed, 7 skipped); 20,003 tests (19,915 passed, 0 failed, 88 skipped). Private WSL clone, `--maxWorkers=2`. The five files more than CI's 933 are #947's new tests. |
| Rules suite | **`9ddb6831`:** 24 files, 417 tests, all passing (Windows, Java 21, LF snapshot; WSL has no Java). #947 added one rules file. |
| `lint:gate` / `vite build` | exit 0 / exit 0, both on an LF snapshot of `9ddb6831`. The lazy v2 chunk is 64.95 kB (17.73 kB gzip), from 64.97 kB. The pushed head (this report's docs-only commit) gets the full Linux suite, `lint:gate` and `vite build` again from its own LF archive before the push. |
| CI | Runs on the pushed head. One read after the push; its state is reported with the head SHA. Nothing watches it (BUILD_RULES §2). |

### 8.2 The merge

- **Merged:** `origin/main` at `9850851cf21fd3eebe9352a0a0db899dff832693`, after a fresh fetch. The merge base was `7631c9e6` (#943), where the branch last took `main`. `main` had gained three PRs since: #945 (growth replay), #946 (enforce readiness, which added the census) and #947 (Pilot P1b, deploy carriage).
- **Merge commit:** `60b4a8db`, made by git's `ort` strategy with **no conflicts**. No conflicted path existed, so neither STOP condition (a §1 path or the legacy Film Room; a changed flag value or meaning) arose.
- **Files changed on both sides** (`comm -12` of the two sides' file lists): two. git merged each without a conflict, and the hunks don't touch:

| File | This branch | `main` | Merged |
|---|---|---|---|
| `src/config/featureFlags.js` | `FILM_ROOM_V2_ENABLED` replaced by `FILM_ROOM_V2_MODE = 'off'` and `FILM_ROOM_V2_MODES` (lines 2941–2992) | #947: `HYPOTHESIS_RECORDS_ENABLED`'s and `PILOT_JOURNEY_MODE`'s docstrings (P1b's deploy carriage, the four-edit flip, D3 amended by B1); no value changed | both: `FILM_ROOM_V2_MODE = 'off'` (`:2989`), `HYPOTHESIS_RECORDS_ENABLED = false` (`:3116`), `PILOT_JOURNEY_MODE = 'off'` (`:3148`), each the value it had on its own side |
| `src/config/flagPinGuard.test.js` | the `FILM_ROOM_V2_ENABLED` `DARK_BY_DESIGN` entry replaced by the `FILM_ROOM_V2_MODE` "intentionally ABSENT" note | #947: the `HYPOTHESIS_RECORDS_ENABLED` entry's text (the four-edit flip) | both |

- **The flag after the merge:** `FILM_ROOM_V2_MODE` is `'off'` at the branch parent, `main` has no such flag (it still had the boolean this branch retired), and the merge has `'off'`. Its pin row (`filmTapeFlags.test.js:79`) and the "the boolean it replaced is gone" row (`:102`) are unchanged. No file from `main` reads `FILM_ROOM_V2_ENABLED`.

### 8.3 What the census protects, and why v2 tripped it

**What it protects.** #946 marks a beat whose execution could not be confirmed (`executionOutcome: 'unknown'` and its kin), so that no surface shows a false label for it. `src/data/unconfirmedOutcome.census.test.js` pins every client file that can see such a record (the `statusFeed`, `evaluations`, `proposalHistory`, the marker fields, the decision fields), each with its ruled disposition. It scans `src/` with comments stripped, so a new reader fails CI until someone rules it. Source: `a9e2184c`, `4362d035`, `f8af644d`; `docs/audits/20261008_BUILD_ENFORCE_READINESS.md` §2.

**The classes a feed reader can be ruled into** (`FEED_READERS`): **FIXED** (changed by #946 so that a marked beat renders nothing); **pass-through**; **DEAD** (no importer, or never rendered); **test data**; **passes `statusFeed: null` — not a reader** (`ArenaHeader`, `CharacterAvatar`, `CharacterPane`; `shadowCpuQuoteIntegrity` returns it); and **renders something true or nothing without a change** (swap actions only, a line only when the beat has a message, joins by id).

**Why v2 tripped it.** The polish pass's header (`b33eb0f7`, 2026-10-08) mounted the agent's still avatar the way `CharacterAvatar` mounts it on its "comparison unavailable" path, `duel={{ statusFeed: null }}`. That source line contains the identifier, and the census matches `\bstatusFeed\b` in the code. #946 merged at 02:45 UTC on 2026-10-09; this branch had last taken `main` at `7631c9e6` (#943). So the branch-alone Linux run at `7dee5dc6` never had the census, and GitHub's run on the merge ref did.

**What this pass did not do.** v2's line has the same shape as the "passes `statusFeed: null` — not a reader" class, but adding it to that class is a ruling. The fence rules that out here, and the pass doesn't need it: the line goes, and the census is unchanged.

### 8.4 Every `statusFeed` under `src/screens/filmRoomV2/` (at `60b4a8db`)

| Site | What it does | Census |
|---|---|---|
| `FilmRoomScreenV2.jsx:133` | `AgentMark` passes `duel={{ statusFeed: null }}` to `AgentPresenceMount`. The value is a literal `null`; nothing reads the battle's feed. | scanned: the failure |
| `FilmRoomScreenV2.jsdom.test.jsx:89` | the header row pins the props the mark passes: `expect(seen[0].duel).toEqual({ statusFeed: null })` | not scanned (`.test.` files are excluded) |
| `FilmRoomQuotation.writer.jsdom.test.jsx:79` | the R7 writer test finds the `battle_complete` beat in the writer fixture's SOURCE battle, to plant a phrase in it before the real close pass copies it to the tape's `battle.completionMessage`. The screen reads that tape path, never the feed. | not scanned |

**Decision: the "no runtime read" branch.** The screen's only use is a prop key holding `null`. It is removed. The census stays at 24.

### 8.5 The fix: `9ddb6831`, complete diff

```diff
diff --git a/src/screens/filmRoomV2/FilmRoomScreenV2.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomScreenV2.jsdom.test.jsx
index cb9d7f13..536f3c94 100644
--- a/src/screens/filmRoomV2/FilmRoomScreenV2.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomScreenV2.jsdom.test.jsx
@@ -86,7 +86,7 @@ describe('the header (BA-41, BA-42)', () => {
       expect(seen).toHaveLength(1);
       expect(seen[0]).toMatchObject({ surface: 'duel', reactivityLevel: 'static', enableEnvironment: false });
       expect(seen[0].agent).toBe(battle);
-      expect(seen[0].duel).toEqual({ statusFeed: null });   // no playerScore / opponentScore
+      expect(seen[0].duel).toBeUndefined();   // no duel record at all: no playerScore / opponentScore, no feed
     } finally {
       vi.doUnmock('../../components/AgentPresence/AgentPresenceMount');
       vi.resetModules();
diff --git a/src/screens/filmRoomV2/FilmRoomScreenV2.jsx b/src/screens/filmRoomV2/FilmRoomScreenV2.jsx
index e3cb599e..82ffd126 100644
--- a/src/screens/filmRoomV2/FilmRoomScreenV2.jsx
+++ b/src/screens/filmRoomV2/FilmRoomScreenV2.jsx
@@ -122,15 +122,16 @@ function BattleLength({ length, tape }) {
 /**
  * The agent's mark: the cockpit's own avatar — AgentPresenceMount at 'static',
  * as ArenaHeader and CharacterAvatar mount it: one painted frame, no motion,
- * its events withheld. NO SCORE IS PASSED, so its standing is neutral (the
- * CharacterAvatar "comparison unavailable" path): the face carries no mood
+ * its events withheld. NO DUEL RECORD IS PASSED — no score and no feed; the
+ * screen reads only the tape — so its standing is neutral (as on
+ * CharacterAvatar's "comparison unavailable" path): the face carries no mood
  * about the day. Presence off → CharacterAvatar's still disc.
  */
 function AgentMark({ battle, size }) {
   return (
     <div data-agent-mark="" aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden', background: C.surface, boxShadow: `0 0 0 1px ${tint('teal', 0.35)}` }}>
       {isAgentPresenceOn() && battle
-        ? <AgentPresenceMount surface="duel" agent={battle} duel={{ statusFeed: null }} size={Math.round(size * 0.9)} enableEnvironment={false} reactivityLevel="static" />
+        ? <AgentPresenceMount surface="duel" agent={battle} size={Math.round(size * 0.9)} enableEnvironment={false} reactivityLevel="static" />
         : <span data-agent-mark-still="" style={{ width: size, height: size, borderRadius: '50%', background: tint('teal', 0.16), border: `1px solid ${tint('teal', 0.45)}`, boxSizing: 'border-box' }} />}
     </div>
   );
```

**Why the face is unchanged:**
- `AgentPresenceMount` defaults `duel = null` (`src/components/AgentPresence/AgentPresenceMount.jsx:38`).
- Standing is `standingFromDuel(duel?.playerScore, duel?.opponentScore)` (`useAgentPresence.js:42`). With either form both scores are `undefined`, and a non-finite score returns 0 (`presenceBinding.js:93`).
- The duel events are `statusFeedToEvents(duel?.statusFeed)` (`useAgentPresence.js:59`, `:62`). `undefined` and `null` both return `[]` (`presenceBinding.js:160`).
- At `'static'` the mount passes `events={null}` whatever the events are (`AgentPresenceMount.jsx:49`, `:55`).

**The test row.** The header row pinned the removed prop's exact value. It now pins that no duel object is passed at all, which still fails if a score is passed (the polish pass's "scores passed" mutant). It is a v2 suite row, not the census or a guard, and it moves because the prop it pinned is gone. It is named here so the founder's chat sees it.

**Evidence** (LF snapshot of `9ddb6831`, Windows, `TZ=UTC`):
- **Equivalence probe** (a scratch file, never committed), 5/5: `useAgentPresence` returns the same four inputs without `duel`, with `duel: null` and with `duel: { statusFeed: null }` (standing 0, events `[]`); `renderToString` of the mount is byte-identical both ways; the mounted, painted face (effects run, `<svg>` present) is identical once React's per-mount `useId` suffix (`_r_0_`, `_r_1_` …) is normalised. That suffix differs between two mounts of identical props too. Control: a passed score does change the standing.
- **Mutants,** each restored byte for byte (`cmp` against the `9ddb6831` blob):

| Mutant | Census file | v2 header row |
|---|---|---|
| M1: `duel={{ statusFeed: null }}` put back | **fails** (1 failed, 9 passed) | **fails**: "expected { statusFeed: null } to be undefined" |
| M2: `duel={{ playerScore: 1, opponentScore: 0 }}` | passes (10/10; no feed named) | **fails**: "expected { playerScore: 1, opponentScore: +0 } to be undefined" |
| none (control) | passes 10/10 | passes |

### 8.6 Results, on the merged head

- **Census on the merged tree, before the fix** (`60b4a8db`, Windows LF snapshot): 1 failed, 9 passed. The failing row is the feed row, 25 readers against 24, `FilmRoomScreenV2.jsx` the only extra: CI's failure exactly. **After the fix** (`9ddb6831`): 10/10.
- **Full suite** (Linux, `TZ=UTC`, CI-shaped `--maxWorkers=2`, in a private WSL clone `~/pd-a2merge` used only by this pass, `npm ci` from the merged lockfile): **`9ddb6831`: 938 test files, 0 failing** (931 passed, 7 skipped); 20,003 tests (19,915 passed, 0 failed, 88 skipped), 333 s. GitHub's failing run on `39422435` had 933 files. The five more are #947's new test files (`carriage.test.js`, `decide.carriage.test.js`, `decide.carriageOffGolden.test.js`, `IdeaPanel.carriage.jsdom.test.jsx`, `agentDeploy.refusal.test.js`).
  - In that run: the census 10/10. The v2 suites, 13 files, all pass. Among them are the off-path goldens (`FilmRoomRoute.golden.jsdom.test.jsx` 9/9), the screen 38/38, the writer-to-screen sweeps (`FilmRoomQuotation.writer` 29/29, `FilmRoomDeepDive.session.writer` 7/7), Study 49/49, Glance 28/28 and Deep dive 29/29. Also passing: the gate 19/19, the hub helper 38/38, `filmTapeFlags` 9/9, `flagPinGuard` 6/6 and `film-tape-flip.live` 4/4.
- **Rules suite:** `9ddb6831`, 24 files, 417 tests, all passing. #947 added `test/rules/agentBattlesHypothesisCarriage.rules.mjs`; `7dee5dc6` had 23 files and 404 tests. This ran on the Firestore emulator on Windows (Java 21, LF `git archive` snapshot), because WSL has no Java.
- **`lint:gate`:** exit 0 on an LF snapshot of `9ddb6831`.
- **`vite build`:** exit 0 on `9ddb6831`. `FilmRoomScreenV2` is still its own lazy chunk: 64.95 kB (17.73 kB gzip), from 64.97 kB.
- **The pushed head** (this report's commit, docs only): the full Linux suite, `lint:gate` and `vite build` are re-run on its own LF archive before the push, and their results go with the head SHA in the hand-off.
- **CI:** runs on the pushed head. This session reads it once after the push and reports it with the head SHA. Nothing watches it (BUILD_RULES §2).

### 8.7 The follow-up list: the pass before `'on'`

The report had no list under this name; this one gathers what is scheduled for the pass before `'on'`. **None of it is fixed here.** Astra's B1–B4 are test-guard and hardening items, not pre-allowlist requirements (confirmation §3).

| id | Item | Source |
|---|---|---|
| **B1** | The quotation exemption survives nesting in a heading: a bound `Quotation` inside an `<h2>` passes `sweepWords` and `quoteDefects`. No shipped heading holds one. Fix: reject heading ancestry in the exemption and the validator, with a guard row. | Astra confirmation §3 (`__fixtures__/filmRoomHarness.jsx:390`, `:487`) |
| **B2** | The stored-note number exemption has no path binding: screen copy rendered as a record (`Rec`) whose text equals any string stored anywhere in the document passes both number sweeps. No shipped screen quantity uses it. Fix: bind the exempt text to an allowed stored-note path and value, or to its renderer; keep the forbidden-word scan. | Astra confirmation §3 (`filmRoomHarness.jsx:100`, `:329`, `:465`) |
| **B3** | The cardinal guard's vocabulary is finite: zero to twenty, "single" and "dozen" (`filmRoomHarness.jsx:88`). "ninety", "a hundred" and "a thousand" pass. None is in shipped copy. Fix: wider quantity detection, or a complete copy inventory with a guard for additions. **Correction:** §7.1's F3 row says the sweep "fails on any spelled-out number". It fails on the pinned vocabulary. | Astra confirmation §3 |
| **B4** | The timeline filter is type-only: `['not-a-date', '2026-09-23']` reads "two-day battle". The picker (`FilmRoomScreenV2.jsx:52`), the count (`:97`) and the oracle (`filmRoomHarness.jsx:184`) accept any string. Fix: one validated-date timeline shared by all three. | Astra confirmation §3 |
| R11 | A swap card shows the screen's replay sentence only beside a drawn replay; a card without one shows its replay coverage line alone (no duplicated crypto caveat). | Amendment E Addendum 3, R11: "The follow-up pass does this." |
| A2A2-3 | A gap inside a series is bridged by a straight line. | §7.6 |
| A2A2-4 | The desktop "All symbols" sparklines space points by index, not time. | §7.6 |
| A2A3-7 | The missing-tape "scheduled at 10:15 PM ET." clock has no instant mark, and no sweep mounts that state. | §7.6 |
| — | An evidence marker can sit over the last-close label. | §7.6 refuters |

### 8.8 State

PR #944 stays a **draft**. Head: this report's commit; its SHA is posted with the hand-off (a commit cannot name its own SHA). Nothing is merged, flipped or deployed.

---

## §9 Follow-up pass before `'on'` (2026-10-10)

**Prompt:** "Build prompt — Film Room A2: the follow-up pass before `'on'`" (Fable, 2026-10-10). It clears what the A2 reports scheduled for the pass before `'on'` (§8.7, Astra's confirmation §3, Addendum 3's R11) and adds two founder items: the back button and the agent's name. No new features.
**Branch:** `git fetch origin` first. `origin/main` was `a06c2a75` (#951). It contains #944 (`ab53f610`) and #950 (`93953d62`), with `FILM_ROOM_V2_MODE = 'allowlist'` (`src/config/featureFlags.js:2989`). The session's worktree branch is `claude/film-room-a2-followups-322f79` (the app's name for it), cut at `a06c2a75`, and is pushed to `claude/film-room-a2-followups` by refspec.
**Fence and flags:**
- Zero BUILD_RULES §1 edits: `git diff --name-only origin/main...HEAD` names none of the eleven fenced paths.
- No writer source: nothing under `api/` is in the diff, the writer's own test fixtures included. The writer-to-screen tests run the real close and candle passes and never edit them.
- `FILM_ROOM_V2_MODE` stays `'allowlist'`. `src/config/featureFlags.js`, `firestore.rules` and the goldens (`src/screens/__golden__/`) are not in the diff.
- The PR is a draft. No merge, no flip, no rules deploy.

### 9.1 Executive verdict

| Question | Answer |
|---|---|
| What changed | The twelve items, each its own commit with its tests (9.2), plus Addendum 4 and the Film Room index (`36477560`). Two fixes found by the real-layout check (`66aef1e6`, `5738cccf`) and four review commits (`6cbc1c29`, `b5889b3c`, `b22ee39d`, `cb6c3178`) follow. 25 files: `src/screens/filmRoomV2/` (screen, kit, copy, model, harness, tests), `src/App.jsx` (the back origin), Amendment E, `docs/README.md` and this report. |
| The exit criterion's six classes | None found. No lens or refuter found a rendered number without its class, a forbidden word in the screen's own voice, a stated fact against the tape, a non-owner read, a change to the off or non-allowlisted path, or a fourth hub key (9.5). |
| The off and non-allowlisted paths | Byte-identical to legacy. The goldens' original rows pass unchanged, and new rows show that the legacy screen still receives exactly App's `{ battle, onBack }` when App passes an origin. |
| Addendum 4 (R13) | Appended verbatim to Amendment E. The subtitle starts with the agent's name, exactly as stored and bound to `agentContext.agentName`. |
| Copy inventory | **237 keys** of `FILM_ROOM_COPY`, plus the model's word tables (`EXIT_MAKER_WORDS` 13 keys, `PLAN_DIRECTIONS` 2, `CHECK_STATE_WORDS` 15) and `filmRoomCopy`'s 8 exports, all pinned; **345 entries** swept (every copy string, every copy function called with sample arguments, the model's composed words on every branch, and the two externals the screen prints in its own voice). |
| Mutants | **112 of the builder's, all killed in the end, none by a timeout.** Two survived their first run and were killed once their rows were made non-vacuous (TABS-M7, RF2-M1). The reviewers ran 47 of their own: 17 survived; 12 of those are now killed by new rows or the pinned tables; 5 remain as recorded limits (9.5); 2 more were equivalent. |
| Review (BUILD_RULES §2; 25 files, +2.4k lines) | 3 lenses and 3 refuters on separate LF snapshots. 20 lens findings, 6 more from the refuters. **None blocking, none refuted.** 19 fixed (one in part); 7 recorded as backlog, for separate tasking or for your call (9.5, 9.7). |
| Real layout | Headless Edge at 280, 320, 390 and 1440 px. The last-close label: **0 overlaps in 600 measurements** (five days, every symbol, volume and comparables on and off). The measurement found two defects jsdom cannot see, now fixed (`66aef1e6`, `5738cccf`). |
| Full suite (Linux, `TZ=UTC`, CI-shaped) | **`cb6c3178`** (the code head; `origin/main` re-fetched, still `a06c2a75`, an ancestor of the branch): **945 test files, 0 failing** (938 passed, 7 skipped); 20,100 tests (20,012 passed, 0 failed, 88 skipped). Private WSL clone, `--maxWorkers=2`, 332 s. The seven files more than #950's 938 are this pass's new suites. |
| Rules suite | **`cb6c3178`:** 24 files, 417 tests, all passing (Windows, Java 21, LF snapshot; WSL has no Java). No rules file changed. |
| `lint:gate` / `vite build` | exit 0 / exit 0, both on an LF snapshot of `cb6c3178`. The lazy v2 chunk is 67.95 kB (18.85 kB gzip), from 64.95 kB (17.73 kB gzip) at §8. The pushed head (this report's docs-only commit) is checked again from its own LF archive before the push. |
| CI | Runs on the pushed head. Its result is reported with the head SHA; nothing watches it (BUILD_RULES §2). |

### 9.2 One row per item

| # | Item | Commits | What the tests prove | Mutants (all killed) |
|---|---|---|---|---|
| 1 | **R11: no replay, no replay sentence** | `9ad7eb18`; review `6cbc1c29`, `b22ee39d`, `cb6c3178` | `FilmRoomStudy.replay.writer.jsdom.test.jsx` runs the real close and candle passes. **(a)** Close pass only: every card shows "No replay for this swap. · awaiting the candle pass" (the day's note, bound) and no sentence; the split groups say "No replay" too. **(b)** Outside the candle window: the same, its "10-trading-day" digits the tape's own. **(c)** A crypto leg after the candle pass: "… · crypto legs are not replayed", the caveat once on the card, the day's note once at the section head. **(c′)** The same leg on the close pass's night. **(d)** Candle-written replays: each drawn, its stored label verbatim and bound. **(e)** A replay written with no point that has a value: "No replay drawn for this swap · missing: bars:MSFT, bars:CRWD", each name bound; no fork, path labels or gap rows. **(e′)** Values on either leg alone: values shown. **(f)** A slot traded twice: the "hypothetical" tag only beside values. **(g)** A day re-merged by the close pass after its candle pass, in and outside the window: the card points to the coverage line ("the replay coverage line above says why"), never copying the note that opens with the one-step sentence. A written replay without a stored label shows the R9 sentence (Study suite). | R11-M1–M6; RF1-M1–M4; ROW-A3M16–18; V3-V2a, V3-V4a (15) |
| 2 | **A2A2-3: no line across a gap** | `f2891860`; caps `b5889b3c` | `FilmRoomDeepDive.gaps.writer.jsdom.test.jsx`, real passes with interior runs of minute rows missing (INTC three buckets, SPY two, INTC's sector ETF one). The candle pass leaves those buckets out; the price, market and sector lines break at their own gaps; no segment spans more than one bucket; no volume bar in a missing bucket; the full session is one unbroken run (its path byte-identical to before). Model rows pin `lineRuns` / `linePath`. | GAP-M1–M6; RF2-M4 (7) |
| 3 | **A2A2-4: sparklines on time** | `55eb4bec` | `FilmRoomDeepDive.sparklines.writer.jsdom.test.jsx`. Astra's INTC repro (three bars) fills the first tenth of its sparkline, not all of it. Every sparkline's domain is the chart's (`seriesDomain`, the shared calendar) and each point sits where the chart puts it. A gap breaks it. The full session runs 9:40 → the 4:00 close. A non-session date takes the chart's fallback too. | SPARK-M1–M5 (5) |
| 4 | **A2A3-7: the no-tape states** | `80d5c4f1` | The scheduled clock renders in `When` ("…scheduled at 10:15 PM ET."). A row mounts every no-tape state at phone and desktop width, at every depth, through every sweep: numbers, words and number words, signs, quotations, stored notes. The states: missing (a pass scheduled; the pass not run yet; not available), error, loading, skipped mode, not written (a stored status bound; none recorded), no id. | NOTAPE-M1–M5 (5) |
| 5 | **The last-close label against the markers** | `b5bffe80`; real-layout fix `66aef1e6`; review `b5889b3c`, `b22ee39d` | `FilmRoomDeepDive.lastClose.writer.jsdom.test.jsx`, on a writer-built day with INTC's 2:45 PM quote planted at its own last close. At the 390 and 1440 plot widths (226 and 712 px, measured), the label's box meets no marker's box, where its old place met the planted one at 390. Every Sep-23 symbol at both widths; the label's box is the box the chooser places (flex, 13 px); volume hidden with a ladder of near stamps (the floor strip); the measured width reaches the placement (a 116 px plot); `lastCloseTop`'s bands. **Measured** in headless Edge: 0 overlaps in 600 measurements (9.6). | LABEL-M1–M7; VIS-M1; RF2-M1–M3; ROW-FV2N1 (12) |
| 6 | **B1: no quotation inside a heading** | `cea572e9` | `FilmRoomSweeps.guards.jsdom.test.jsx`. Astra's repro `<h2><Quotation …/></h2>` on a valid rationale reading "best one 73": every sweep sees the words, and `quoteDefects` names the heading. Every heading level and `role="heading"` are covered; the same quotation outside a heading stays exempt and valid. | B1-M1–M4 (4) |
| 7 | **B2: stored notes bound by path** | `1db91ccd`; path `6cbc1c29`; rows `b22ee39d`, `cb6c3178` | Astra's bypass first: `coverage.checks.note = 'one 73'` and an unbound `Rec` reading "one 73" are caught by both number sweeps. The rows also cover: the same words bound and exempt; screen words inside a note; a forged path; a path R1/R9 does not name; no document; padding, a part of the value, another case or nothing (byte for byte); a forbidden word in a bound note still swept; attributes never exempt; the kit rendering notes by path. The whole-screen sweeps run `storedNoteDefects`. | B2-M1–M9; RF1-M8; ROW-A3M8; V3-V5a, V3-V5b (13) |
| 8 | **B3: quantity words, closed** | `406400f6`; tables `cb6c3178` | Astra's bypass ("ninety checks", "a hundred checks", "a thousand checks") bites. Every new word bites in text and attributes and inflected ("hundreds", "halves", "sixes"); "shown once" is exempt. The copy inventory, `filmRoomCopy.inventory.jsdom.test.jsx`: 237 copy keys pinned by hand, the model's word tables pinned too (`CHECK_STATE_WORDS`, `EXIT_MAKER_WORDS`, `PLAN_DIRECTIONS`), 345 entries swept; a new key, a new export, or a state with a tone and no words fails. §7.1's claim is corrected in place (struck through, dated). | B3-M1–M7; V3-V7a–V7d (11) |
| 9 | **B4: one validated timeline** | `df81eb23`; de-dup `6cbc1c29` | `tradingTimeline` (`filmRoomModel.js`) is shared by the picker, the count and the oracle. `['not-a-date', '2026-09-23']` reads "one-day battle" with no picker. A weekend, a holiday and an impossible date leave both; a day named twice counts once; a real date beyond the calendar's horizon is kept. | B4-M1–M6; RF1-M7 (7) |
| 10 | **Tabs** | `a3ea0001`; row `b22ee39d` | Each tab's `aria-controls` names its own tabpanel's id and the panel's `aria-labelledby` names its tab; only the selected tab is in the tab order; the other panels are hidden and empty. ← / → (wrapping), Home and End select, and focus follows; each key is `preventDefault`ed and any other key left to the page. Checked in a real browser too (9.6). | TABS-M1–M7; ROW-A3M9 (8) |
| 11 | **Back goes back** | `11aa4aab`; label `5738cccf`; row `b22ee39d` | `filmRoomBack.test.js`: the mapping (the in-battle banner → "Battle", Battle History → "Battle History", the Review station → "Dashboard", unknown → "Dashboard"), and App's wiring pinned by its source (no test mounts App). Through the route at `'on'`: each origin's label and its return, never App's legacy back. The legacy screen's props and the goldens are unchanged with an origin given (new rows appended to `FilmRoomRoute.golden.jsdom.test.jsx`). The label never wraps. | BACK-M1–M10; VIS-M3; ROW-A3M1 (12) |
| 12 | **The agent's name (R13)** | `7a594739`; wrap `5738cccf`; guard `6cbc1c29`; row `b22ee39d` | The prompt's subtitle, "Cipher · Trend Follower · BaggerBomb · one-day battle · Fri, Oct 9, 2026", with the name bound to `agentContext.agentName` and not case-transformed. No stored name → the archetype first. Names with a forbidden word ("Best Buddy"), number words ("One Eyed Twelve") and digits ("R2-D2 47") sweep clean at every depth. The binding bites (another stored name, no battle document, a forged path, the words unbound, a heading, twice). Short real names ("Agent", "Check") give no false defect. A distinctive name sits in exactly one text node and no attribute, at phone and desktop width. The subtitle wraps between whole parts. | R13-M1–M9; VIS-M2; RF1-M5–M6; ROW-FV1N2 (13) |

### 9.3 Addendum 4 (R13)

Appended verbatim to the end of Amendment E (`36477560`). Item 12 applies it; 9.4 #7 states how.

### 9.4 Choices the prompt left open (stated, not silent)

1. **"The two Oct 8 loop documents in `docs/design/`."** There are none. The only Film Room loop documents are `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_2_20260915.md` and `…V1_3_20260915.md`. The index lists them under their real path and date. The Practice Field handover already had a Contents row, so the Film Room section points to it rather than repeating it.
2. **R11 — "its replay coverage line alone".** A card with no written replay shows "No replay for this swap." followed by one reason:
   - for a crypto leg, the screen's caveat from the row's own stored `replayReason`, once;
   - before any candle pass has written (`passes.candles.writtenAt` unset), the day's stored replay coverage note ("awaiting the candle pass", or the outside-window note), bound;
   - after one has, a pointer: "the replay coverage line above says why". That note now opens with the replay's one-step sentence, and copying it would put the sentence beside no replay.

   The day's note always shows once, at the swaps section's head. The split groups keep "No replay for this swap." (F1: the split is always shown). A replay written with no point that has a value shows "No replay drawn for this swap" and its own stored missing inputs. ~~A replay whose points have values but no instants keeps its values (A2P2-9) and gets no sentence.~~ **Corrected 2026-10-11 (Astra F1, §10):** a replay that emits no visible geometry, values with no recorded instant included, gets "No replay drawn for this swap" (10.4 #5).
3. **B2's allowed paths** (`SPEC_STORED_NOTE_PATHS`, pinned in the harness from R1 and R9):
   - exempt: `coverage.*.note`, each missing-input name by index (the sale's, the fill's, a plan price's, a replay's), and `actions[].replay.label`;
   - bound but not exempt: the other stored notes (`replay.note`, `lockedBasisNote`, `price.note`, `result.note`, `passes.close.status`);
   - no exemption at all: `Rec` (identifiers), and attributes.
4. **B3.** Inflected forms bite. A compound ("twenty-one") is two listed words. The check states' words and the exit makers' labels became exported tables the inventory pins (`cb6c3178`, A2F3-7); every label is byte-identical. The other composing functions (`roleOf`, `deriveHoldings`' notes, `riskLines`, `directiveCardOf`) are enumerated on every branch, their literals not key-pinned (9.7).
5. **B4.**
   - A real date beyond the maintained calendar's years is kept, since nothing can say it was not a session.
   - A recorded timeline with no valid day yields no day, as before (no fallback to an instant).
   - The oracle shares the production helper, as the prompt directs; this departs from the harness's "never read production" rule, so the helper has its own rows.
   - The A2A3-2 row's "ten-day" timeline had counted two weekends; it now names ten real sessions.
6. **Item 5.** The chooser treats a marker as "near" if the label's box and the marker's 24 px button could share columns at the plot's measured width, or at 150 px before measurement. Heights are exact px, so a band clear of every near marker is clear. The label's width is bounded by `ceil(len × 6.2) + 20` px (measured: at most 93% of it). With volume hidden, a strip under the price area stays free. A lone bar between two gaps is a short tick with round caps.
7. **R13.**
   - The name is exempt from the digit sweep too, on the same binding ("as a bound quotation is under R7").
   - It carries `textTransform: 'none'`, because the subtitle's capitals would alter it.
   - The subtitle now wraps between whole parts on phones as well (no ellipsis), because with the name in front the phone's one line cut the marked length.
8. **Back.**
   - App records the screen the Film Room is opened from, and from the battle view its battle, in a ref updated whenever another screen shows.
   - No dashboard file changed: the Review station's own `setScreen('filmRoom')` is seen as origin `'dashboard'`.
   - The in-battle label reads "Battle".

### 9.5 Review record (BUILD_RULES §2)

**Setup.**
- **Snapshots:** each lens and refuter worked on its own LF `git archive` snapshot with `node_modules` linked, read-only on git and on the shared tree. Every mutation and probe was restored byte for byte, checked by hash.
- **Lenses** (at `5738cccf`): A2F1, domain honesty; A2F2, geometry, layout and a11y. A2F3, integrity and mutation, ran last at `b5889b3c`.
- **Refuters:** A2FV1 and A2FV2 at `b5889b3c`; A2FV3 at `b22ee39d`.
- **Before the review:** the real-layout measurement ran first, so a code fix it found would be reviewed.
- **Ids:** `A2F*n*-*k*`, `A2FV*n*-*k*`. They never collide with A2L, A2V, A2P, A2PV, A2A or A2AV.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2F1-1 | The "hypothetical" tag showed beside "No replay" (a slot traded twice, close pass only). | CONFIRMED, BACKLOG | **Fixed** `6cbc1c29`; row (f). |
| A2F1-2 | After a candle pass, a no-replay card copied the day's note, which opens with the stored one-step sentence (a day re-merged in and outside the window). | CONFIRMED, BACKLOG. The signal **over-approximates**: an expired-unprocessed or failed run sets `writtenAt` while the note is still "awaiting…", and the card then points to the line that carries it. The refuter calls this harmless. | **Fixed** `6cbc1c29`; row (g). The `writtenAt` signal is kept on purpose. The tighter `inputFingerprint` signal would copy the stale "awaiting the candle pass" onto every card of an expired tape (A2FV1-N1). |
| A2F1-3 | A replay written with nothing to draw showed a legend for lines that were not there. | CONFIRMED, BACKLOG | **Fixed** `6cbc1c29`; row (e). |
| A2F1-4 | `agentNameDefects`' substring scan matched the screen's own words for short real names ("Check": 46). | CONFIRMED (harness only) | **Fixed** `6cbc1c29`. |
| A2F1-5 | The name's exemption had no heading exclusion and no once-only check. | CONFIRMED (guard only) | **Fixed** `6cbc1c29`. |
| A2F1-6 | `tradingTimeline` kept duplicates (`[D, D]` read "two-day"). | CONFIRMED as code; unreachable from the battle writer | **Fixed** `6cbc1c29`. `['not-a-date', D]` crashes the fenced writer at `tapeAssemble.js:548`; reported (9.7). |
| A2F1-7 | `FIXED_DIGIT_COPY` is a string-match exemption. | CONFIRMED; predates the pass (`6724e21e`); B2 does not cover it | Backlog (9.7). |
| A2F1 (B3 note) | Zero-count wording ("No swaps were recorded") is outside the closed list. | CONFIRMED; no criterion | For your call (9.7). |
| A2F2-1 | With volume hidden, the label's fallback fell onto a marker. | CONFIRMED; the fix is checked in real layout | **Fixed** `b5889b3c`. |
| A2F2-2 | "Near" judged at 150 px failed on narrow phones (the refuter puts the cliff between 280 and 300 px). | CONFIRMED | **Fixed** `b5889b3c` (the measured width). The refuter's test gap (A2FV2-N1) is **fixed** `b22ee39d`. |
| A2F2-3 | A lone bar's tick was invisible on phones. | CONFIRMED (0 ink pixels at 280–320 before, 4 after) | **Fixed** `b5889b3c`. |
| A2F2-4 | Swap labels run off the viewport on phones, clipped by `overflow-x: hidden`. | CONFIRMED; predates the pass; misreadable, not false | Backlog (9.7). |
| A2F2-5 | Focus is lost when a door inside the panel changes the day. | CONFIRMED; predates the pass; not item 10's | Backlog (9.7). |
| A2F3-1 | App's back wiring: the ref read at render was unpinned (mutant survived 0/603). | CONFIRMED, BACKLOG. Its variant V1a (a reset inserted above the read) survives: the pin proves the line, not the ref's content — a source pin's limit, recorded. | **Row** `b22ee39d`; the mutant is killed. |
| A2F3-2 | The split groups on a no-replay card were unguarded. | CONFIRMED, BACKLOG; under the mutant a no-replay card would state a replay the tape does not have. Variant V2a (the version note only after a candle pass) survived row (a). | **Rows** (a), (c), (g) `b22ee39d`, `cb6c3178`; V2a killed too. |
| A2F3-3 | A crypto card before the candle pass was unguarded. | CONFIRMED, BACKLOG. Variant V3a (the day's note winning on an outside-window day only, keyed by a regex on the note) survives — contrived; recorded. | **Row** (c′); killed. |
| A2F3-4 | A replay valued on one leg was unguarded. | CONFIRMED, BACKLOG. Variant V4a (the swap leg only, the mirror) survived row (e′). | **Row** (e′), both legs `cb6c3178`; V4a killed too. |
| A2F3-5 | The stored-note binding accepted padded text. | PARTLY: trimming cannot let a number through, but the harness's byte-for-byte contract was untested; variants V5a (a substring binds — any part of a note, even empty) and V5b (case-insensitive) survived. | **Rows** `b22ee39d`, `cb6c3178` (padding, "73", "one", another case, nothing); V5a and V5b killed too. |
| A2F3-6 | The tab keys' `preventDefault` was unasserted. | CONFIRMED, BACKLOG. Variant V6a (prevent only when the selection moves) survives — contrived; recorded. | **Row**; killed. |
| A2F3-7 | The copy inventory cannot see a new model branch (the enumerated outputs are hand-kept). | PARTLY: BACKLOG, but only half structural — `checkStateOf`'s table is a keyed copy table (variant V7a, a new state "the best stop · a hundred checks", survived) and `exitMakerOf`'s labels could be one (V7b, a new inline branch, survived). | **Fixed in part** `cb6c3178`: `CHECK_STATE_WORDS` and `EXIT_MAKER_WORDS`' labels are exported tables the inventory pins (a new key, a tone without words, or a quantity word in a label fails). A new branch written as an inline literal is still invisible until a fixture renders it; the other composers (`roleOf`, `deriveHoldings`' notes, `riskLines`, `directiveCardOf`) are enumerated on every branch, not key-pinned. Backlog: structural (9.7). |
| A2FV1-N1 | An expired tape keeps the close pass's "awaiting the candle pass" note (`markRetryWindowElapsed` changes only the pass fields). | — (found by the refuter; writer-side, predates the pass) | Reported for the writer (9.7). |
| A2FV1-N2 | Dropping the substring scan left "never in an attribute" tested on the phone only. | — | **Fixed** `b22ee39d` (desktop too). |
| A2FV2-N1 | No row checked that the measured width reaches the placement (that mutant survived). | — | **Fixed** `b22ee39d`. |
| A2FV2-N2 | The Study's "Deep dive · SYM" doors drop focus. | — (predates the pass) | Backlog (9.7). |
| A2FV2-N3 | Below 280 px a mid-session last close can leave the plot (a 240 px build). | — (the anchor rule predates the pass) | Backlog (9.7). |
| A2FV3-N1 | Nothing pinned that a part of a stored note is unbound (`value.includes(text)` survived all 340 rows; an empty note bound too). | — | **Fixed** `cb6c3178` (row). |

**Refuted outright:** none. **Blocking:** none. Each finding is either outside the six criteria or a test gap.

### 9.6 Verification

- **Full suite** (Linux, `TZ=UTC`, CI-shaped `--maxWorkers=2`, in a private WSL clone `~/pd-a2fu` used only by this pass): **`cb6c3178`: 945 test files, 0 failing** (938 passed, 7 skipped); 20,100 tests (20,012 passed, 0 failed, 88 skipped), 332 s. Before the run `origin/main` was re-fetched: still `a06c2a75`, an ancestor of the branch, so the branch is the merged tree. In that run: the off-path goldens (`FilmRoomRoute.golden.jsdom.test.jsx`), the census, the theme guards, the flag-pin guard, the gate and the hub helper all pass.
- **Rules suite:** `cb6c3178`, 24 files, 417 tests, all passing (Firestore emulator on Windows, Java 21, LF `git archive` snapshot; WSL has no Java). `firestore.rules` and `test/rules/` are unchanged.
- **`lint:gate`:** exit 0 on an LF snapshot of `cb6c3178` (and on `11aa4aab`, right after the App change).
- **`vite build`:** exit 0 on `cb6c3178`. `FilmRoomScreenV2` is still its own lazy chunk: 67.95 kB (18.85 kB gzip).
- **The pushed head** (this report's commit, docs only): `lint:gate` and `vite build` are re-run on its own LF archive before the push; the results go with the head SHA in the hand-off.
- **Mutants:** 112 runs, each in its own LF snapshot of the commit it tests, every file restored byte for byte (sha256), none killed by a timeout.
- **The writer-to-screen suites' cost** (lens A2F3, two workers): Study.replay 8.8 s, gaps 4.7 s, lastClose 5.2 s, sparklines 4.6 s, session 6.0 s, against 60–90 s limits; the A2 Quotation suite (71 s) predates this pass.
- **Visual check** (headless Edge through `playwright-core`; a scratch preview page in an LF snapshot of the code, never committed, rendering `FilmRoomScreenV2` from the committed fixtures and from scenario days the real close and candle passes built: a planted marker, close pass only, outside the candle window, a crypto leg, a replay with nothing to draw, a gapped series, a partial series, a ladder of stamps). Shots and reports are in the session scratchpad (`shots/fu/`, `measure-report.json`, `measure2-report.json`).
  - **390×844 and 1440×900, at the code head:**
    - A swap card in each R11 state: close pass only → "No replay for this swap. · awaiting the candle pass" on all three cards; outside the window → the window note; a crypto leg → "… · crypto legs are not replayed", "crypto" once on the card; nothing to draw → "No replay drawn for this swap · missing: bars:MSFT, bars:CRWD"; the Sep-23 day → each drawn, its stored label beside it.
    - A gapped series: INTC's line breaks at 11:00–11:40, SPY's at 1:00–1:30, no volume bars in the gap.
    - The desktop sparklines on the session's time.
    - Every no-tape state's words, the scheduled clock as "10:15 PM".
    - The header: "Cipher · TREND FOLLOWER · BAGGERBOMB · ONE-DAY BATTLE [D] · WED, SEP 23, 2026", the name as stored; "‹ Battle" / "‹ Battle History" / "‹ Dashboard" by origin, on one line; at 390 the subtitle wraps after "BAGGERBOMB", the length whole with its marker.
    - The tabs by keyboard: → → → End Home ← select Study, Deep dive, Glance, Deep dive, Glance, Deep dive, each focused, its panel shown.
  - **The last-close label (item 5):** 80 measurements at 390 and 1440 (every symbol of four days), then 600 at 280, 320, 390 and 1440 with volume and comparables on and off on five days: **0** meets an evidence marker, a swap label or an axis label, or leaves the plot. Plot widths 116 / 156 / 226 / 712 px, each equal to the chart's `data-plot-px`. Every label within its width bound (at most 93%). JetBrains Mono loaded.
  - **Found by the measurement, fixed:** the label's inline box (21 px, its figures 8 px down) met AMD's and ETN's 2:30 PM markers at 390 (`66aef1e6`); at 390 "‹ Battle History" broke onto two lines and the phone's one-line subtitle cut the marked length (`5738cccf`).
  - Horizontal overflow: 0 px everywhere. Console: one 404 for a preview-only static asset, as in §4; not from the screen.
- **What this pass supersedes:** §8.7's list is cleared (B1–B4, R11, A2A2-3, A2A2-4, A2A3-7, the marker over the last-close label). §4's header row (#10) now leads with the agent's name, and the back label names the origin.

### 9.7 Reported, not fixed (for separate tasking or your call)

- **A2F1-7:** `FIXED_DIGIT_COPY` exempts its four phrases anywhere, by string match. It predates this pass. Fix: bind the exemption to copy keys.
- **B3 zero-count wording:** "No swaps were recorded this day.", "no checks recorded", "Retained: none in force" sit outside the closed list. None is a quantity claim the six criteria catch, and "none in force" is BA-9's own wording. Your call.
- **A2F2-4:** on phones, right-anchored swap labels lose their leading "Exit ·" / "Entry ·" and clock off the screen's left edge. At 360 px, PANW reads "3:00 PM · Exit by platform rule · stagnation". It predates this pass. Fix: clamp the label inside the chart.
- **A2F2-5 / A2FV2-N2:** a door inside the panel that changes the day or the depth drops keyboard focus to the page. Fix: focus the new panel. It predates this pass.
- **A2FV2-N3:** below 280 px a last close that ends mid-session can sit outside the plot. The anchor rule predates this pass, and 320 is the narrowest phone the code names.
- **A2F3-7 (the rest):** a model branch written as an inline literal, and the words of `roleOf`, `deriveHoldings`' notes, `riskLines` and `directiveCardOf`, are enumerated by the inventory but not key-pinned. Fix: move them into exported tables, as `CHECK_STATE_WORDS` now is.
- **Accepted limits of the review's mutants** (each recorded, none a defect at head): App is pinned by its source text, so a reset inserted above the pinned read survives (A2FV3-1); a regex-keyed outside-window crypto variant (A2FV3-3) and "prevent only when the selection moves" (A2FV3-6) are contrived.
- **Writer (fenced; for the writer's owner):**
  - `['not-a-date', D]` throws at `tapeAssemble.js:548` (`etDayBounds(null)`). The production battle writer never produces such a timeline.
  - An expired tape keeps "awaiting the candle pass" in its replay and series coverage notes (A2FV1-N1).
- **Carried from earlier sections, unchanged:** A2A1-2 (the retained directive's time), and the census class for `statusFeed: null` (§8.2).

### 9.8 State

The PR is a **draft**, titled "Film Room A2: follow-up pass before 'on'". Head: this report's commit; its SHA is posted with the hand-off. Nothing is merged, flipped or deployed. The flip to `'on'` is its own PR after this one. It still turns around the hub-helper row in `api/cron/film-tape-flip.live.test.js` and reconciles the stale prose PR #950 flagged.

## §10 Astra follow-up round (2026-10-11)

**Prompt:** "Fix prompt — Film Room A2 follow-up pass: Astra's F1 (and B5)" (Fable, 2026-10-11). Astra's review of the follow-up pass (`docs/audits/20261011_ASTRA_REVIEW_FILM_ROOM_A2_FOLLOWUPS.md`, PR #952 at `f931f339`) returned DO NOT MERGE on one finding, F1. This round fixes F1 and B5, a test-only guard gap. B6 (the wide last-close label) and the earlier backlog wait for the card build.
**Branch:** `git fetch origin` first. `origin/claude/film-room-a2-followups` was `f931f339`, as the prompt expected. The session's worktree branch is `claude/film-room-a2-followups-218894` (the app's name for it); it was moved to `f931f339` and is pushed back to `claude/film-room-a2-followups` by refspec. PR #952 was open and a draft at setup and again before the push.
**`main` moved during the round.** `origin/main` went from `a06c2a75` to `434fab64` (#953, the reflection outage fix), and was merged in at `ebfa5dc8` with the app's merge tool. The only file both sides touched is `docs/README.md`, in different rows, so the merge was clean. The final checks ran on the merged tree, and `origin/main` was re-fetched before the push.
**Fences:**
- Zero BUILD_RULES §1 edits, and nothing under `api/`. This round's own commits (10.2) change only `docs/` (4 files) and `src/screens/filmRoomV2/` (9 files). Against `main` (`git diff --name-only origin/main...HEAD`), the PR adds `src/App.jsx` from §9 and nothing else outside those two directories.
- `FILM_ROOM_V2_MODE` stays `'allowlist'` (`src/config/featureFlags.js:2989`). `src/config/`, `firestore.rules` and the goldens are not in the diff.
- The goldens' original rows pass unchanged (`FilmRoomRoute.golden.jsdom.test.jsx`, 12/12).
- The PR stays a draft. No merge, no flip.

### 10.1 Executive verdict

| Question | Answer |
|---|---|
| F1 (blocking, criterion 3 under R11) | **Fixed** `418bfb08`. A replay is drawn only when its fork emits visible geometry: a dashed segment, or a ring at an isolated sample. Astra's repro now draws three rings (the hold path's close, the swap path's sale and close), joins none of them, and its legend reads "points · rebuilt from 1-minute bars". The sentence, each path's label and the legend all follow the same geometry, path by path. A card that emits nothing gets "No replay drawn for this swap" with its stored missing inputs. The new rows fail at `f931f339`; the controls pass there. |
| B5 (test-only) | **Fixed** `8ad2950a`, hardened `ad6fbded`. A heading anywhere on an exempt text's ancestry, around the bound element or inside it, removes the quotation, stored-note and agent-name exemptions. A heading is h1–h6, or any `role` that names `heading`. |
| The full-candle day | **Unchanged, byte for byte.** The whole Study's HTML at phone and desktop width is identical to `f931f339`'s, on the committed fixture and on the writer-built day. A row pins the fork paths' SHA-256. |
| **Founder question** (review A2G1-1) | **Does the swap path's opening sample, on its own, make a drawn replay?** The writer opens every swap path at the sale with the points the sale banked (`api/_utils/filmTape/tapeReplay.js:107–108`). When both legs have only stale bars after the sale, that sample is the replay's one placeable value. Your F1 rule reads "a value with a finite instant … renders as a visible point glyph", so the card draws one ring at the sale and shows the swap path's label, the points legend and the stored sentence. Its twin with the bars *deleted* gets "No replay drawn". The stricter alternative is: drawn requires a placeable sample after the sale, on either path. The rule as built is pinned by a row (10.2, F1) and laid out in 10.5. The refuter's facts: every number and stored sentence on the card matches the tape. The legend's "rebuilt from 1-minute bars" matches the tape's declared class, but no bar went into the value drawn. Before F1 this card was already "drawn", with an invisible `M`. |
| The exit criterion's six classes | None found. Two lenses and a refuter found no rendered number without its class, no forbidden word in the screen's own voice, no stated fact against the tape, no non-owner read, no change to the off or non-allowlisted path, and no fourth hub key. The one open question is A2G1-1 above. |
| Mutants | **60 of the builder's (74 runs), every one killed in the end, none by a timeout** (10.2). Two survived their first run (F1-M4c, F1-M4d, the desktop end tags) until their rows were added. The lenses ran 17 of their own on the reviewed head; 12 survived, and all 12 are killed by `ad6fbded`'s rows. The refuter ran 28 on `ad6fbded`; 4 survived, and all 4 are killed by `f126fde4`'s rows. |
| Review (BUILD_RULES §2) | Two lenses (A2G1 for F1's domain and geometry, A2G2 for B5's guard boundary and the round's integrity) and one refuter (A2GV), each on its own LF snapshot. 10 lens findings and 3 from the refuter. **None blocking, none refuted;** 3 PARTLY. 10 are fixed or closed (rows, the harness, this section); 3 are recorded (10.4, 10.5, 10.9). |
| Real browser (headless Edge, 390 and 1440) | 36 swap cards on six writer-built days. **14 rings, each 7 × 7 px with ink** (96 of its 256 device pixels at scale 2), and 56 dashed paths, each with length. **No replay wording on a card without geometry, and every label, swatch and end tag matches what its path drew** (10.6). No horizontal overflow; JetBrains Mono loaded. |
| Full suite (Linux, `TZ=UTC`, CI-shaped) | **`f126fde4`** (the code head, merged with `origin/main` `434fab64`; re-fetched before the push, unmoved): **949 test files, 0 failing** (942 passed, 7 skipped); 20,214 tests (20,126 passed, 0 failed, 88 skipped). Private WSL clone `~/pd-a2g`, `--maxWorkers=2`, 347 s. In that run, all of these pass: the Film Room folder (20 files, 374 tests), the goldens (12/12), the census (`unconfirmedOutcome.census`), the flag-pin guard, the theme and motion guards, the gate (19) and the hub helper (38). #953's new suites pass too. |
| Rules suite | **`f126fde4`:** 24 files, 417 tests, all passing (Firestore emulator on Windows, Java 21, LF `git archive` snapshot; WSL has no Java). `firestore.rules` and `test/rules/` are unchanged. |
| `lint:gate` / `vite build` | Run from the LF archive of the pushed head, this report's commit, before the push. Results are posted with the head SHA. |
| CI | Runs on the pushed head. It is read once and reported with the head SHA; nothing watches it (BUILD_RULES §2). For the record: at `f931f339`, the head Astra reviewed, `vitest (unit)` passed (01:05:57–01:16:59 UTC, Oct 11), as did both Socket checks and the Vercel preview. Astra could not read that result. |

### 10.2 One row per fix

| Fix | Commits | What the tests prove | Mutants (all killed) |
|---|---|---|---|
| **§0 Docs** | `37906b05` | Astra's review is committed verbatim. Addendum 5 (R14) is appended verbatim to Amendment E, after Addendum 4. The trailing whitespace at this report's former line 879 is gone. The Film Room index (`docs/README.md`) has the review's row, and its Amendment E and A2 build-report rows name Addendum 5 and §10. | — |
| **F1: "drawn" means visible geometry** | `418bfb08`; rows `ad6fbded`, `f126fde4` | `FilmRoomStudy.replay.writer.jsdom.test.jsx`, the real close and candle passes.<br>**Astra's repro** (MSFT and CRWD cut to the minute starting `2026-09-23T19:59:00Z`, `buildTapeDay` at `SEP23_NIGHT` / `SEP23_MORNING`), at phone and desktop width:<br>• a ring at each isolated sample, placed where an independent oracle puts it (x to 0.02 %, y to 0.06 px), 7 px with a solid stroke of real width;<br>• no `<path>` at all, so nothing is joined across a gap;<br>• both labels, each with a ring swatch and never a dashed one;<br>• the legend "points · rebuilt from 1-minute bars", and "dashed" nowhere on the card;<br>• the stored sentence;<br>• at desktop, both end tags.<br>**A path that emits nothing** has no label, swatch, line, ring or end tag, path by path. Cases: the sold leg without bars, or with stale bars only (a list of nulls); the bought leg without bars; a planted swap path of nulls.<br>**A mixed path** (a segment and a ring) has both swatches, and its legend reads "dashed lines and points · rebuilt from 1-minute bars".<br>**Each path keeps its own colour** for its ring, swatches and line.<br>**A slot traded twice** keeps its hypothetical tag beside points only, and beside the hold path alone.<br>**Planted:** a run whose samples coincide is a ring. A replay with values but none placeable gets the no-drawn treatment, with no sentence, label, legend or tag.<br>**The anchor-only card** (A2G1-1) is pinned as the rule reads.<br>**Controls:** the full-candle day's fork paths match the SHA-256 of `f931f339`'s, and the no-value day keeps "No replay drawn".<br>`filmRoomModel.test.js` pins `forkRuns`. `FilmRoomStudy.jsdom.test.jsx`'s A2P2-9 desktop row now expects the no-drawn line (10.4 #5). The copy inventory holds 239 keys and 347 entries.<br>**At `f931f339`** the four F1 rows fail and the two controls pass. | F1-M1–M9 (14: the old gate; the ring omitted; the legend always "dashed", or never naming both; a label or end tag for a path that drew nothing, ×4; joined across a gap; a dashed swatch for points; no ring swatch; the ring misplaced; the tag beside an undrawn replay; a lone sample as a segment); R-G1-M1–M8 (8); V-F1a, V-F1b (2) |
| **B5: a heading inside bound text** | `8ad2950a`; predicate and rows `ad6fbded`; rows `f126fde4` | `FilmRoomSweeps.guards.jsdom.test.jsx`.<br>**Astra's repro first:** at `f931f339`'s harness, "best one 73" in an `h2` nested inside the element carrying `data-quote-path` returns `[]` from all three sweeps and the validator, and the same holds inside `data-agent-name` and for a stored note. Now every sweep sees the words, and each validator says "a heading inside it".<br>**Rows for each of the three exemptions:**<br>• every heading form inside (h1–h6, `role="heading"`) and around;<br>• a stored note under a heading (B1's rule, now for notes);<br>• a heading deeper than the first child;<br>• the bound element itself a heading;<br>• a heading over part of the text (the whole element loses its exemption);<br>• `role="heading"` with no level;<br>• role spellings a browser reads as a heading ("Heading", " heading", "heading presentation", "heading\tnone", "foo heading");<br>• an empty heading, or an aria-hidden one.<br>**Controls:** a span, an emphasis or `role="note"` keeps each exemption. | B5-M1–M5 (11, on `8ad2950a`); R-B5 (23, on `ad6fbded`: ancestor-only and inside-only per site and per validator; the role ignored, matched by case, by exact value or split on spaces, or needing a level; direct children only; the element itself skipped; the text node's path only; any descendant); V-B5a, V-B5b (2) |

Each mutant ran in an LF snapshot of the commit it tests: `d8646d79` (F1's first form, before its end-tag rows were folded in), `418bfb08`, `8ad2950a`, `ad6fbded` and `f126fde4`. Every file was restored byte for byte (sha256). Specs and results are in the session scratchpad (`mut-*.json`, `res-*.json`).

### 10.3 Addendum 5 (R14)

Appended verbatim to the end of Amendment E (`37906b05`). It settles §9.7's "B3 zero-count wording" question: "No swaps were recorded this day.", "no checks recorded" and "Retained: none in force" state absence, take no marker, and must match their section's coverage. No copy changed for it.

### 10.4 Choices the prompt left open (stated, not silent)

1. **The glyph.** It is a ring 7 px across, with a 1.6 px stroke in its path's colour (hold ink, swap teal) and the card's surface as its fill. It is an HTML element over the fork, placed at the sample's own x and y. The fork's SVG stretches its x (`preserveAspectRatio="none"`), so a circle inside it would not stay round. A short tick on the dashed path can be swallowed by the dash pattern (A2F2-3's lesson). The ring is `aria-hidden` and carries no text attribute and no sign colour.
2. **"Isolated".** `forkRuns` splits a path only where a sample has no value or no recorded instant, never by a time step: the fork's samples are the checks'. A run of one is a ring. A run whose points render at one place (two samples at one instant, planted) is a ring too, never a zero-length segment.
3. **The legend's words.** There are three keys:
   - "dashed · rebuilt from 1-minute bars" (unchanged) beside segments only;
   - "points · rebuilt from 1-minute bars" beside rings only;
   - "dashed lines and points · rebuilt from 1-minute bars" beside both.

   "points" is the prompt's word. A2G1-3 notes that on the same card the stored basis note uses "points" for score ("Banked points …"). The screen's own copy never does, so "rings" or "dots" would remove the overlap. Your call.
4. **Path by path.** A path that emits nothing has no label, no swatch and no end tag, so its end value is not shown. Each label's swatch shows what its path drew: a dash, a ring, or both. The hypothetical tag, the gap row and the closed-leg row stand only beside a drawn replay.
5. **"Nothing drawn" includes values with no recorded instant.** Review A2P2-9 (§6) kept such a replay's end values beside no fork. The prompt's rule gives it the no-drawn treatment, so that row now expects "No replay drawn for this swap". §9.4 #2 is corrected in place, struck through and dated. The writer always stamps an instant (`tapeReplay.js:86`), so only a planted tape reaches this case.
6. **B5's reach.**
   - The stored-note exemption had no heading check at all, and now has both halves.
   - The validators name "a heading inside it" beside "inside a heading".
   - A role names a heading when any of its tokens is `heading`, in any case or spacing. "presentation heading", which a browser does not read as a heading, is counted too: stricter, never laxer.
7. **Docs.** Astra's file runs from "DO NOT MERGE" to its last sentence and ends in one newline: the paste's trailing blank lines are dropped, so `git diff --check` stays clean. The Film Room index gained the review's row; the prompt did not ask for it.
8. **The diffs in 10.8** are the four code commits of the round: F1, B5 and the two review commits, all of the code the round changed. A blank context line is written empty rather than as a single space, so this report carries no trailing whitespace; `git apply` reads an empty line as an empty context line.

### 10.5 The founder question, laid out (A2G1-1)

**Repro, through the real passes:** `sparseBars({ MSFT: ['2026-09-23T13:30:00Z'], CRWD: ['2026-09-23T13:30:00Z'] })`, the session's first minute only, then `buildTapeDay` at `SEP23_NIGHT` / `SEP23_MORNING`. Row: `review A2G1-1` in `FilmRoomStudy.replay.writer.jsdom.test.jsx`.

**What the tape stores for swap 1 (MSFT → CRWD).** These are the refuter's facts, read from the stored document:
- `holdPath` has 14 samples, all null, each with its stale `barClosedAt` of 9:31 AM.
- `swapPath[0]` is `{ tickSeq 11, at 12:45:08 PM, points −13 }`; the other 13 samples are null.
- `gapPoints` and `closedLegDelta` are null.
- `missingInputs` names 28 prices, every MSFT and CRWD sample, the two at the swap included.
- `actions[0].lockedPoints` is −13, declared `recorded`.
- `actions[].replay.swapPath[].points` is declared `rebuilt` (`src/constants/filmTape.js:223`).

**What the card shows** (headless Edge, 390 and 1440):
- one teal ring at the fork's left edge, the sale;
- "Swap path · CRWD bought —", with a ring swatch;
- no hold label;
- "points · rebuilt from 1-minute bars";
- "Gap —" and "At the sale · rebuilt minus banked —";
- the stored sentence;
- at desktop, the swap path's end tag "—".

**Against the tape.** Every number and stored sentence on the card is bound to its path, or is "—" where the tape stores null. The one statement in the screen's own voice that makes a provenance claim is the legend:
- (a) It matches the tape's declared class for that path.
- (b) The value drawn is `composeLegs`' copy of the banked points, which the tape declares `recorded` at `lockedPoints`. No bar went into it, and the tape names both swap-instant prices missing.
- (c) The same labelling predates F1: on the full-candle day `swapPath[0]` is the same −13, the first vertex of the line under "dashed · rebuilt from 1-minute bars". F1 only made it the sole thing drawn.

**The twin.** With the bars deleted, the writer builds no swap path (`legOf` returns null, `tapeReplay.js:239`), and the card says "No replay drawn for this swap · missing: bars:MSFT, bars:CRWD".

**The ruling asked:**
- **(i) As built:** the opening sample is a value at a recorded instant, so it is drawn.
- **(ii) The alternative:** a replay is drawn only with a placeable sample after the sale. The anchor-only card would then get the no-drawn line. A screen-side change, with no writer change, would do it.

Either way the tape's stored class for the opening sample is a writer question for the card build.

### 10.6 Real-browser measurements

Headless Edge 155 (`playwright-core`, device scale 2), on a scratch preview page in an LF snapshot of the code, never committed. It renders the real `FilmRoomScreenV2` at the Study depth from six days built by the real close and candle passes:

| Day (swap 1's bars) | 390 px | 1440 px |
|---|---|---|
| Astra's repro (MSFT, CRWD: the 3:59 PM minute) | 3 rings (hold 1, swap 2), each 7 × 7, 96 ink pixels; no path; labels hold [ring], swap [ring]; the points legend; the sentence | the same, fork 239 px wide; end tags hold, swap |
| Sold leg deleted, bought leg the 3:59 PM minute | 2 swap rings; no hold label; the points legend | the same; end tag swap only |
| Bought leg before two checks and the close | swap: one dashed segment (51.8 × 8.2 px) and a ring; hold: a dashed line; "dashed lines and points" | the same (37.1 × 8.2 px segment) |
| Both legs the 9:31 AM minute only (A2G1-1) | 1 swap ring at the sale; the swap label alone; the points legend; the sentence | the same; end tag swap only |
| Both legs deleted | no fork, no ring, no label; "No replay drawn for this swap · missing: bars:MSFT, bars:CRWD" | the same |
| The full session | dashed lines only; legend "dashed · rebuilt from 1-minute bars" | the same |

Across the 36 cards (six days × three swaps × two widths):
- **Violations: 0.** There are no replay words without geometry, no label for a path that drew nothing, no swatch unlike its path's drawing, no "dashed" without a dashed path, no ring outside its fork, and no ring without a box or ink.
- **Horizontal overflow:** 0 px everywhere.
- **Console:** one 404, which no page response carried: the browser's own request, not the screen.
- Shots and the report are in the session scratchpad (`edge/shots/`, `edge/edge-f1.json`).

### 10.7 Review record (BUILD_RULES §2)

**Setup.**
- Lens A2G1 (F1: domain honesty and geometry) and lens A2G2 (B5's guard boundary, and the round's integrity) worked on separate LF snapshots of `8ad2950a`.
- The refuter A2GV worked on a fresh snapshot of `ad6fbded`. It was told to refute each finding with a repro, re-apply the lenses' surviving mutants, and test the anchor-only card against the tape.
- All three were read-only on git and the shared tree, and restored every mutation byte for byte.
- **Ids:** `A2G1-n`, `A2G2-n`, `A2GV-n`. They never collide with A2L, A2V, A2P, A2PV, A2A, A2AV, A2F or A2FV.
- A2G1 checked 78 card renders over 13 days (real-pass and planted) against an independent oracle and found 0 mismatches. It also found the full day's whole Study HTML identical to `f931f339`'s.

| id | Finding | Refuter | Disposition |
|---|---|---|---|
| A2G1-1 | A replay whose only placeable sample is the swap path's opening sample (the banked points) is drawn, while its bars-deleted twin is not. | CONFIRMED; facts in 10.5 | **Founder question** (10.1, 10.5). The rule as built is pinned by a row. |
| A2G1-2 | The end value is the path's last element even when null: "—" beside a drawn path whose close is null (writer-reachable; matches the tape under R14). A planted undrawn last sample shows its number. | CONFIRMED | Recorded (10.9); predates the round. |
| A2G1-3 | "points" in the legend can read as the score. | PARTLY: the screen's own copy never uses "points" for score; the stored basis note does | Recorded (10.4 #3); your call. |
| A2G1-4 | Five rules unpinned: the legend on a swap-only line; the hypothetical tag beside points; three colours. | CONFIRMED (all five survive at `8ad2950a`) | **Rows** `ad6fbded`; all killed. |
| A2G1-5 | A coinciding run as a zero-length segment (planted). | CONFIRMED | **Row** `ad6fbded`; killed. |
| A2G2-1 | `[role="heading"]` matched the exact value only; "heading presentation", " heading" and "Heading" kept the exemptions. | PARTLY: 42 of 48 cases kept it (jsdom matched the case variants inside) | **Fixed** `ad6fbded`: the `isHeading` predicate; rows for eight spellings. |
| A2G2-2 | No row pinned "inside the bound element" as distinct from the text node's own path. | CONFIRMED (rows only; the guard was right) | **Rows** `ad6fbded` (split text); killed. |
| A2G2-3 | No row for a heading below the first child, the element itself a heading, or `role="heading"` with no level. | CONFIRMED (rows only) | **Rows** `ad6fbded`; killed. |
| A2G2-4 | The README cites §10, and the inventory row cites 239 / 347, before this report states them. | CONFIRMED | **Closed** by this section. |
| A2G2-5 | The harness docstrings named only the heading "around". | PARTLY closed at `ad6fbded` | **Fixed** `f126fde4`. |
| A2GV-1 | The ring's stroke width was unpinned. With the card's own surface as its fill, a zero-width border would paint nothing (F1's defect class). | — (found by the refuter) | **Row** `f126fde4`; killed. |
| A2GV-2 | No row for a hypothetical slot drawn on the hold path alone. | — | **Row** `f126fde4`; killed. |
| A2GV-3 | No row for an empty or aria-hidden heading inside the bound element. | — | **Rows** `f126fde4`; killed. |

**Refuted outright:** none. **Blocking:** none.

The refuter also found that the review commit touches only test files and the harness, and that the folder runs 20 files and 371 tests, all passing, at `ad6fbded`.

### 10.8 The complete diffs of the round's code commits

`git -c core.autocrlf=false show --format= <sha>`; blank context lines written empty (10.4 #8). Checked: each block, applied with `git apply --cached` to its commit's parent, reproduces that commit's tree exactly.

#### `418bfb08` — F1 — "drawn" means visible geometry

```diff
diff --git a/src/screens/filmRoomV2/FilmRoomStudy.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomStudy.jsdom.test.jsx
index d5a7b2d7..2964b7ab 100644
--- a/src/screens/filmRoomV2/FilmRoomStudy.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomStudy.jsdom.test.jsx
@@ -319,14 +319,15 @@ describe('the swap card at desktop width — each path\'s end value beside the f
     expect(Math.abs((top('hold') + top('swap')) / 2 - (lastY(row, 'hold') + lastY(row, 'swap')) / 2)).toBeLessThan(0.06);
   });

-  it('review A2P2-9: at desktop, a replay with no fork drawn (no instants) keeps its end values, under where the fork would be', () => {
+  it('review A2P2-9, under Astra F1: at desktop, a replay whose values carry no instant draws nothing — the no-drawn line, never a path label, an end value or a legend for lines that are not there', () => {
     const t = clone(sep23Tape);
     for (const p of [...t.actions[0].replay.holdPath, ...t.actions[0].replay.swapPath]) p.at = null;
     m.render(<Desk tape={t} />);
-    const r = t.actions[0].replay;
     expect(card(0).querySelector('[data-fork-row]')).toBeNull();
-    expect(card(0).querySelector(`[data-path-label="hold"] [data-num="actions[0].replay.holdPath[${r.holdPath.length - 1}].points"]`)).toBeTruthy();
-    expect(card(0).querySelector(`[data-path-label="swap"] [data-num="actions[0].replay.swapPath[${r.swapPath.length - 1}].points"]`)).toBeTruthy();
+    expect(card(0).querySelector('[data-replay-none="not-drawn"]').textContent).toBe('No replay drawn for this swap');
+    expect(card(0).querySelector('[data-path-label], [data-fork-end], [data-replay-sentence]')).toBeNull();
+    expect(card(0).textContent).not.toContain('rebuilt from 1-minute bars');
+    expect(card(1).querySelector('[data-path-label="hold"]')).toBeTruthy();   // the other cards draw theirs
   });

   it.each([['Sep-23', sep23Tape], ['empty', emptyTape]])('%s at desktop width, everything opened (review A2P2-3): every number marked, no sign colour astray, no forbidden word', (_l, tape) => {
diff --git a/src/screens/filmRoomV2/FilmRoomStudy.jsx b/src/screens/filmRoomV2/FilmRoomStudy.jsx
index a2cdbefa..4bb5f8d7 100644
--- a/src/screens/filmRoomV2/FilmRoomStudy.jsx
+++ b/src/screens/filmRoomV2/FilmRoomStudy.jsx
@@ -12,7 +12,9 @@
 //               — always the SOLD leg's sale — and the fill as its own group
 //               (F1, BA-38); the basis note on every card, and the replay
 //               sentence only beside a drawn replay — a card with no written
-//               replay says why, alone (Amendment E addendum 3, R11)
+//               replay says why, alone (Amendment E addendum 3, R11). Drawn
+//               means visible geometry: a dashed segment, or a ring at an
+//               isolated sample; the labels and legend say which (Astra F1)
 //   Directives  the card per BA-9, its three states from the tape's rows (F6)
 //   Plans       verbatim, with the two market prices and the horizon note (BA-10)
 //   Rationale   recorded words, collapsed, beside the checks that carry no agent
@@ -26,7 +28,7 @@
 import React, { useState } from 'react';
 import {
   valueAt, etClock, checkStateOf, riskSummary, exitMakerOf, swapAnchor, swapOrdinals, lastPointPath, deriveHoldings,
-  directiveCardOf, rationaleTimeline, planGroups, PLAN_DIRECTIONS, EXIT_MAKER_WORDS, fmtPrice, fmtPriceDelta, fmtCount, isNum, toMs, etWhen,
+  directiveCardOf, rationaleTimeline, planGroups, PLAN_DIRECTIONS, EXIT_MAKER_WORDS, fmtPrice, fmtPriceDelta, fmtCount, isNum, toMs, etWhen, forkRuns,
 } from './filmRoomModel';
 // The replay's own coverage line sits under the swaps' (BA-20: every section its coverage).
 import { FILM_ROOM_COPY as COPY, REPLAY_SENTENCE, LOCKED_BASIS_NOTE, REPLAY_VERSION_NOTE, DIRECTIVE_EXPLAINER } from './filmRoomCopy';
@@ -88,8 +90,13 @@ function HoldingsSection({ tape, onDeep }) {

 /** The fork: the hold path and the swap path from the swap to the close, both rebuilt and dashed; a null point is a visible gap. */
 const FORK_HEIGHT = 112;
+/** An isolated sample's glyph: a ring this many px across, centred on the sample (Astra F1). */
+const POINT_GLYPH_PX = 7;

-/** The fork's scale — null when it has no point to draw, or no recorded instant to place one at (review A2L3-11). */
+/**
+ * The fork's scale — null when it has no value to scale, or no recorded instant to place one at (review A2L3-11).
+ * A scale is not a drawing: what is drawn is forkGeometry's.
+ */
 function forkScale(tape, index, height = FORK_HEIGHT) {
   const r = valueAt(tape, ['actions', index, 'replay']);
   const hold = Array.isArray(r?.holdPath) ? r.holdPath : [];
@@ -109,6 +116,34 @@ function forkScale(tape, index, height = FORK_HEIGHT) {
   };
 }

+/**
+ * The fork's GEOMETRY — exactly what the chart emits, path by path (Astra F1): each run of samples with a value at a
+ * recorded instant (forkRuns) is a dashed SEGMENT when its points sit at two places or more, else a POINT glyph (an
+ * isolated sample, drawn as itself — never joined across the gap to fabricate a line). A path is drawn when it emits
+ * a segment or a glyph, and the fork when either path is. The chart draws from this object and the card's every
+ * replay word — the sentence, each path's label, the legend — reads it, so none can describe what is not drawn
+ * (BUILD_RULES §9). null when the fork has no scale.
+ */
+function forkGeometry(tape, index, height = FORK_HEIGHT) {
+  const scale = forkScale(tape, index, height);
+  if (!scale) return null;
+  const pathOf = (list) => {
+    const segments = []; const points = [];
+    for (const run of forkRuns(list)) {
+      const at = run.map((p) => [scale.x(p.at).toFixed(1), scale.y(p.points).toFixed(1)]);
+      if (new Set(at.map(([x, y]) => `${x} ${y}`)).size > 1) segments.push(at.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '));
+      else points.push({ x: Number(at[0][0]), y: Number(at[0][1]) });
+    }
+    return { d: segments.join(' '), segments: segments.length, points, drawn: segments.length > 0 || points.length > 0 };
+  };
+  const hold = pathOf(scale.hold);
+  const swap = pathOf(scale.swap);
+  return { scale, hold, swap, drawn: hold.drawn || swap.drawn, dashed: hold.segments + swap.segments > 0, dotted: hold.points.length + swap.points.length > 0 };
+}
+
+/** A point glyph's ring, in a path's colour — on the fork at its sample, and as that path's legend swatch. */
+const ring = (color) => ({ width: POINT_GLYPH_PX, height: POINT_GLYPH_PX, boxSizing: 'border-box', borderRadius: '50%', border: `1.6px solid ${color}`, background: C.surface, flexShrink: 0 });
+
 /**
  * The paths' end values beside the fork, each at its own height on the fork's
  * scale (the design of record's desktop card); two that would overlap are
@@ -134,28 +169,23 @@ function ForkEnds({ tape, scale, ends, height }) {
   );
 }

-function ForkChart({ tape, index, height = FORK_HEIGHT, ends = null }) {
-  const scale = forkScale(tape, index, height);
-  if (!scale) return null;
-  const { hold, swap, t0, x, y } = scale;
-  const d = (list) => {
-    let s = ''; let pen = false;
-    for (const p of list) {
-      if (!isNum(p?.points) || toMs(p.at) === null) { pen = false; continue; }
-      s += `${pen ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.points).toFixed(1)} `;
-      pen = true;
-    }
-    return s.trim();
-  };
+/** The fork as forkGeometry states it: each path's dashed segments, and a ring at each isolated sample. */
+function ForkChart({ tape, index, geo, height = FORK_HEIGHT, ends = null }) {
+  if (!geo?.drawn) return null;
+  const { scale } = geo;
+  const paths = [['hold', geo.hold, C.ink2], ['swap', geo.swap, C.teal]];
   return (
     <div data-fork-row={index} style={{ display: 'flex', alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
       <div data-region={`fork-${index}`} style={{ position: 'relative', flex: 1, minWidth: 0, height }}>
         <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-label={COPY.fork} style={{ display: 'block', overflow: 'visible', width: '100%', height }}>
-          <path data-line="hold" data-rebuilt="" d={d(hold)} style={{ fill: 'none', stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" />
-          <path data-line="swap" data-rebuilt="" d={d(swap)} style={{ fill: 'none', stroke: C.teal, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" />
+          {paths.map(([k, g, color]) => (g.segments ? <path key={k} data-line={k} data-rebuilt="" d={g.d} style={{ fill: 'none', stroke: color, strokeWidth: 1.6, strokeDasharray: '5 4' }} vectorEffect="non-scaling-stroke" /> : null))}
         </svg>
+        {/* an isolated sample: a ring at its own place — the svg stretches its x, so a circle inside it would not stay round */}
+        {paths.flatMap(([k, g, color]) => g.points.map((p, j) => (
+          <span key={`${k}${j}`} data-fork-point={k} data-rebuilt="" aria-hidden="true" style={{ position: 'absolute', left: `calc(${(p.x / 10).toFixed(2)}% - ${POINT_GLYPH_PX / 2}px)`, top: p.y - POINT_GLYPH_PX / 2, ...ring(color) }} />
+        )))}
         <div style={{ position: 'absolute', left: 0, right: 0, bottom: -14, display: 'flex', justifyContent: 'space-between', ...mono(9, C.ink3) }}>
-          <When>{etClock(new Date(t0).toISOString())}</When>
+          <When>{etClock(new Date(scale.t0).toISOString())}</When>
           <span>{COPY.close10}</span>
         </div>
       </div>
@@ -229,11 +259,12 @@ function SwapCard({ tape, index, ordinal, desktop, onDeep }) {
   const holdEnd = lastPointPath(tape, index, 'holdPath');
   const swapEnd = lastPointPath(tape, index, 'swapPath');
   // The design of record's desktop card puts each path's end value beside the fork, at its height; the phone keeps them under it.
-  // R11: a replay is DRAWN when it is written and its fork has a point to draw at a recorded instant (forkScale).
-  const drawn = Boolean(r) && forkScale(tape, index) !== null;
-  // A written replay with a point that has a value shows its values (its end values, the gap — review A2P2-9), drawn
-  // or not; one with no such point has nothing to state but its reasons (review A2F1-3).
-  const valued = Boolean(r) && [...(Array.isArray(r.holdPath) ? r.holdPath : []), ...(Array.isArray(r.swapPath) ? r.swapPath : [])].some((p) => isNum(p?.points));
+  // R11, Astra F1: a replay is DRAWN when its fork emits visible geometry — a dashed segment or a point glyph — on
+  // either path (forkGeometry, the one object the chart draws from). The sentence, the hypothetical tag, the legend,
+  // the values (the end values, the gap — review A2P2-9) and each path's label all follow it, the label path by path;
+  // a written replay that draws nothing states only its reasons (review A2F1-3).
+  const geo = r ? forkGeometry(tape, index) : null;
+  const drawn = Boolean(geo?.drawn);
   // A card with no written replay says why: a crypto leg by its own stored reason, once (the day's coverage note,
   // which also names crypto legs after the candle pass, stays at the section's head — R11's "caveat once"); any other
   // by the day's replay coverage note (the close pass's "awaiting the candle pass", or outside the candle window).
@@ -243,7 +274,16 @@ function SwapCard({ tape, index, ordinal, desktop, onDeep }) {
   // replay's own one-step sentence (review A2F1-2) — so the card points to the coverage line above instead.
   const dayNote = !tape.passes?.candles?.writtenAt && typeof tape.coverage?.replay?.note === 'string' && Boolean(tape.coverage.replay.note);
   const beside = Boolean(desktop && drawn);
-  const ends = beside ? { hold: { path: holdEnd, label: COPY.holdPath, symbol: a.symbolOut }, swap: { path: swapEnd, label: COPY.swapPath, symbol: a.symbolIn } } : null;
+  // an end value beside the fork only for a path that drew something — never a label for a path that emitted nothing
+  const ends = beside ? { hold: { path: geo.hold.drawn ? holdEnd : null, label: COPY.holdPath, symbol: a.symbolOut }, swap: { path: geo.swap.drawn ? swapEnd : null, label: COPY.swapPath, symbol: a.symbolIn } } : null;
+  // the legend says what the fork shows: dashed only beside a drawn segment, points beside a point glyph
+  const legend = geo?.dashed ? (geo.dotted ? COPY.rebuiltDashedPoints : COPY.rebuiltDashed) : COPY.rebuiltPoints;
+  const swatch = (g, color) => (
+    <>
+      {g.segments ? <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: color, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg> : null}
+      {g.points.length ? <span data-swatch="point" aria-hidden="true" style={ring(color)} /> : null}
+    </>
+  );
   // "Swap n" and #swap-n read one sequence: the swap's place in time order (addendum R4(a); BA-47).
   const anchor = swapAnchor(ordinal - 1);
   return (
@@ -271,23 +311,27 @@ function SwapCard({ tape, index, ordinal, desktop, onDeep }) {
         <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
             <span style={{ ...eyebrow, color: C.ink2 }}>{COPY.fork}</span>
-            {valued && hypothetical ? <span data-hypothetical="" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><StateTag color={C.gold}>{COPY.hypothetical}</StateTag><TapeNum doc={tape} path={later} fmt={fmtCount} size={10.5} weight={600} /><span style={mono(9.5, C.ink3)}>{COPY.laterTrades}</span></span> : null}
+            {drawn && hypothetical ? <span data-hypothetical="" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><StateTag color={C.gold}>{COPY.hypothetical}</StateTag><TapeNum doc={tape} path={later} fmt={fmtCount} size={10.5} weight={600} /><span style={mono(9.5, C.ink3)}>{COPY.laterTrades}</span></span> : null}
           </div>
-          {valued ? (
+          {drawn ? (
             <>
-              <div style={{ paddingBottom: 14 }}><ForkChart tape={tape} index={index} ends={ends} /></div>
+              <div style={{ paddingBottom: 14 }}><ForkChart tape={tape} index={index} geo={geo} ends={ends} /></div>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
-                <span data-path-label="hold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
-                  <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: C.ink2, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg>
-                  <span style={mono(9.5, C.ink2)}>{COPY.holdPath} · <Rec>{COPY.heldLine(a.symbolOut)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
-                  {holdEnd && !beside ? <TapeNum doc={tape} path={holdEnd} size={12} /> : null}
-                </span>
-                <span data-path-label="swap" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
-                  <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" style={{ stroke: C.teal, strokeWidth: 1.6, strokeDasharray: '5 3' }} /></svg>
-                  <span style={mono(9.5, C.ink2)}>{COPY.swapPath} · <Rec>{COPY.boughtLine(a.symbolIn)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
-                  {swapEnd && !beside ? <TapeNum doc={tape} path={swapEnd} size={12} /> : null}
-                </span>
-                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={mono(9.5, C.ink3)}>{COPY.rebuiltDashed}</span><KindMark cls="rebuilt" /></span>
+                {geo.hold.drawn ? (
+                  <span data-path-label="hold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
+                    {swatch(geo.hold, C.ink2)}
+                    <span style={mono(9.5, C.ink2)}>{COPY.holdPath} · <Rec>{COPY.heldLine(a.symbolOut)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
+                    {holdEnd && !beside ? <TapeNum doc={tape} path={holdEnd} size={12} /> : null}
+                  </span>
+                ) : null}
+                {geo.swap.drawn ? (
+                  <span data-path-label="swap" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
+                    {swatch(geo.swap, C.teal)}
+                    <span style={mono(9.5, C.ink2)}>{COPY.swapPath} · <Rec>{COPY.boughtLine(a.symbolIn)}</Rec>{hypothetical ? ` · ${COPY.hypothetical}` : ''}</span>
+                    {swapEnd && !beside ? <TapeNum doc={tape} path={swapEnd} size={12} /> : null}
+                  </span>
+                ) : null}
+                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={mono(9.5, C.ink3)}>{legend}</span><KindMark cls="rebuilt" /></span>
               </div>
               <div data-result-row="gap" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                 <span style={mono(10.5, C.ink2)}>{COPY.gap}</span>
@@ -302,7 +346,8 @@ function SwapCard({ tape, index, ordinal, desktop, onDeep }) {
               {r.note ? <span style={foot}><StoredNote doc={tape} path={['actions', index, 'replay', 'note']} /></span> : null}
             </>
           ) : r ? (
-            // written, with no point that has a value: its own stored reasons — the missing inputs, a version note — and no fork, lines or sentence
+            // written, and drawing nothing (no value, or none at a recorded instant): its own stored reasons — the missing
+            // inputs, a version note — and no fork, labels, legend, values or sentence (Astra F1)
             <span data-replay-none="not-drawn" style={foot}>
               {COPY.replayNotDrawn}
               {Array.isArray(r.missingInputs) && r.missingInputs.length ? <> · <MissingInputs doc={tape} path={['actions', index, 'replay', 'missingInputs']} /></> : null}
@@ -313,9 +358,9 @@ function SwapCard({ tape, index, ordinal, desktop, onDeep }) {
               {COPY.replayNone}{crypto ? <> · {COPY.replayCrypto}</> : dayNote ? <> · <StoredNote doc={tape} path={['coverage', 'replay', 'note']} /></> : <> · {COPY.replayNoneSeeCoverage}</>}
             </span>
           )}
-          {/* R11: the sentence only BESIDE A DRAWN REPLAY — the replay's own stored label, verbatim and bound by its path
-              (R1, R9, Astra B2), else the screen's own R9 sentence. A card with no written replay says why in its line
-              above, alone; a replay that draws nothing carries no sentence either. */}
+          {/* R11: the sentence only BESIDE A DRAWN REPLAY — visible geometry, a segment or a point (Astra F1) — the replay's
+              own stored label, verbatim and bound by its path (R1, R9, Astra B2), else the screen's own R9 sentence. A card
+              with no written replay says why in its line above, alone; a replay that draws nothing carries no sentence either. */}
           {drawn ? <span data-replay-sentence="" style={foot}>{r.label ? <StoredNote doc={tape} path={['actions', index, 'replay', 'label']} /> : REPLAY_SENTENCE}</span> : null}
         </div>
         <SplitRows tape={tape} index={index} a={a} />
diff --git a/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
index 9565d572..86c411f5 100644
--- a/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
@@ -19,6 +19,10 @@
 //       no sentence beside it.
 // A written replay without a stored label shows the screen's R9 sentence
 // (FilmRoomStudy.jsdom.test.jsx; the writer always stores one).
+// Astra F1 (the last block): DRAWN means visible geometry. Sparse bars leave
+// isolated samples — each drawn as a ring at its own place, never joined
+// across the gap — and the sentence, each path's label and the legend follow
+// what was emitted, path by path; a path that emits nothing has no label.
 //
 // DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
 // only the writer flag is mocked on (spreading the real module).
@@ -31,6 +35,7 @@ vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
   get FILM_TAPE_WRITE_ENABLED() { return true; },
 }));

+import { createHash } from 'node:crypto';
 import FilmRoomStudy from './FilmRoomStudy';
 import { REPLAY_SENTENCE } from './filmRoomCopy';
 import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
@@ -95,6 +100,14 @@ async function grownDay(secondNight) {
   return t.store.get(`agentBattles/${full.battleId}/tape/${full.etDate}`);
 }

+/** The Sep-23 bars with the named symbols' 1-minute bars cut to the minutes STARTING at the given instants. */
+const LAST_MINUTE = '2026-09-23T19:59:00Z';   // the session's last minute: its bar is the close's sample
+function sparseBars(keep) {
+  const bars = sep23Bars();
+  for (const [sym, starts] of Object.entries(keep)) bars[sym] = bars[sym].filter((row) => starts.some((s) => row.timestamp * 1000 === Date.parse(s)));
+  return bars;
+}
+
 const OUTSIDE_NIGHT = Date.parse('2026-10-20T02:15:30.000Z');   // four weeks on: the Sep-23 day is outside the candle window
 const days = {};
 beforeAll(async () => {
@@ -117,6 +130,16 @@ beforeAll(async () => {
   delete bars.MSFT;
   delete bars.CRWD;   // swap 1's two legs: the candle pass writes their replay with nothing to draw
   days.undrawn = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars })).tape;
+  // Astra F1's repro: swap 1's two legs keep only the minute that starts at 3:59 PM ET — isolated samples, no segment
+  days.points = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [LAST_MINUTE], CRWD: [LAST_MINUTE] }) })).tape;
+  // the sold leg without bars, the bought leg sparse: the hold path emits nothing, the swap path only points
+  const pointsOneLeg = sparseBars({ CRWD: [LAST_MINUTE] });
+  delete pointsOneLeg.MSFT;
+  days.pointsOneLeg = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: pointsOneLeg })).tape;
+  // the sold leg's only bar the session's first minute: every sample after the swap is stale — a hold path of nulls
+  days.holdStale = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: ['2026-09-23T13:30:00Z'] }) })).tape;
+  // the bought leg's bars before the two checks after the swap, and the close's: a segment and an isolated point on one path
+  days.mixed = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ CRWD: ['2026-09-23T16:59:00Z', '2026-09-23T17:14:00Z', LAST_MINUTE] }) })).tape;
 });

 const mount = (tape, desktop = false) => m.render(<FilmRoomStudy tape={tape} desktop={desktop} selected={null} onSelect={() => {}} onDeep={() => {}} jump={() => {}} />);
@@ -269,3 +292,173 @@ describe('R11 — the replay sentence only beside a drawn replay (writer to scre
     }
   });
 });
+
+// ── Astra F1: drawn means visible geometry ──────────────────────────────────
+
+/**
+ * The oracle, from the STORED paths alone (never the screen's helpers): a sample is placeable when it has a value at a
+ * recorded instant; a run of placeable samples with two or more is a segment, a run of one an isolated sample. Its
+ * place on the fork: the fork's documented scale (the swap to the close across 0–100 %, the values padded by 15 %).
+ */
+const placeable = (p) => Number.isFinite(p?.points) && Number.isFinite(Date.parse(p?.at));
+function runsOf(list) {
+  const out = []; let run = null;
+  for (const p of Array.isArray(list) ? list : []) { if (!placeable(p)) { run = null; continue; } if (!run) { run = []; out.push(run); } run.push(p); }
+  return out;
+}
+const isolatedOf = (list) => runsOf(list).filter((r) => r.length === 1).map((r) => r[0]);
+const segmentsOf = (list) => runsOf(list).filter((r) => r.length > 1);
+function placeOf(replay) {
+  const all = [...(replay.holdPath || []), ...(replay.swapPath || [])];
+  const ts = all.map((p) => Date.parse(p.at)).filter(Number.isFinite);
+  const vs = all.map((p) => p.points).filter(Number.isFinite);
+  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
+  const span = Math.max(2, Math.max(...vs) - Math.min(...vs));
+  const [lo, hi] = [Math.min(...vs) - span * 0.15, Math.max(...vs) + span * 0.15];
+  return { xPct: (at) => ((Date.parse(at) - t0) / Math.max(1, t1 - t0)) * 100, y: (v) => 8 + ((hi - v) / (hi - lo)) * (112 - 16) };
+}
+/** A glyph's centre as the page places it: `left: calc(X% - r px)`, `top: y - r`. */
+const glyphAt = (g) => ({ xPct: Number(g.style.left.match(/^calc\(([\d.]+)% - 3\.5px\)$/)[1]), y: parseFloat(g.style.top) + 3.5 });
+const LEGENDS = ['dashed · rebuilt from 1-minute bars', 'points · rebuilt from 1-minute bars', 'dashed lines and points · rebuilt from 1-minute bars'];
+/** The card's legend line: the words beside the fork's own rebuilt marker (the one outside every marked number). */
+const legendOf = (c) => { const k = [...c.querySelectorAll('[data-kind-mark="rebuilt"]')].filter((x) => !x.closest('[data-num]')); return k.length === 1 ? k[0].previousElementSibling.textContent : `${k.length} legends`; };
+/** Every replay word a card can carry — none may stand where nothing is drawn. */
+const REPLAY_WORDS = ['Hold path', 'Swap path', 'dashed', 'points · rebuilt', 'hypothetical through the day', REPLAY_SENTENCE];
+
+describe('Astra F1 — a replay is drawn only when it emits visible geometry: a dashed segment, or a ring at an isolated sample', () => {
+  it('Astra\'s repro (swap 1\'s legs cut to the 3:59 PM minute, the real passes): a ring at every isolated sample, where it lies; nothing joined; the sentence, both labels and a points legend', () => {
+    const tape = days.points;
+    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
+    const r = tape.actions[k].replay;
+    // the stored replay: isolated samples only — the hold path's close, the swap path's sale and close
+    expect([isolatedOf(r.holdPath).length, isolatedOf(r.swapPath).length, segmentsOf(r.holdPath).length, segmentsOf(r.swapPath).length]).toEqual([1, 2, 0, 0]);
+    const place = placeOf(r);
+    for (const desktop of [false, true]) {
+      const w = desktop ? 'desktop' : 'phone';
+      mount(tape, desktop);
+      const c = card(k);
+      // no segment is emitted, and none is fabricated across the gaps
+      expect(c.querySelector('[data-line]'), w).toBeNull();
+      for (const [leg, list] of [['hold', r.holdPath], ['swap', r.swapPath]]) {
+        const glyphs = [...c.querySelectorAll(`[data-fork-point="${leg}"]`)];
+        const want = isolatedOf(list);
+        expect(glyphs, `${w} ${leg}`).toHaveLength(want.length);
+        glyphs.forEach((g, j) => {
+          const at = glyphAt(g);
+          expect(Math.abs(at.xPct - place.xPct(want[j].at)), `${w} ${leg} ${j} x`).toBeLessThan(0.02);
+          expect(Math.abs(at.y - place.y(want[j].points)), `${w} ${leg} ${j} y`).toBeLessThan(0.06);
+          // a visible mark: a 7 px ring with a solid stroke, inside the fork's own region
+          expect([g.style.width, g.style.height, g.style.borderStyle || g.style.border.split(' ')[1]], `${w} ${leg} ${j}`).toEqual(['7px', '7px', 'solid']);
+          expect(g.closest(`[data-region="fork-${k}"]`)).toBeTruthy();
+          expect(g.getAttribute('aria-hidden')).toBe('true');
+        });
+      }
+      // one condition for everything: both paths drew, so both labels — each with a ring swatch, never a dashed one
+      for (const leg of ['hold', 'swap']) {
+        const label = c.querySelector(`[data-path-label="${leg}"]`);
+        expect(label, `${w} ${leg}`).toBeTruthy();
+        expect(label.querySelector('[data-swatch="point"]'), `${w} ${leg}`).toBeTruthy();
+        expect(label.querySelector('svg line'), `${w} ${leg}`).toBeNull();
+      }
+      expect(legendOf(c), w).toBe('points · rebuilt from 1-minute bars');
+      expect(c.textContent, w).not.toMatch(/dashed/);
+      expect(c.querySelector('[data-replay-sentence] [data-stored-note]').textContent, w).toBe(r.label);
+      expect(c.querySelector('[data-replay-none]'), w).toBeNull();
+      if (desktop) expect([...c.querySelectorAll('[data-fork-end]')].map((e) => e.getAttribute('data-fork-end'))).toEqual(['hold', 'swap']);
+      expect(swept(tape), w).toEqual(CLEAN);
+    }
+  });
+
+  it('a path that emits nothing has no label, no end value and no swatch — path by path (a sold leg without bars or with only stale ones, a bought leg without bars; and a swap path of nulls)', () => {
+    // The writer's swap path, when it exists, always opens at the sale with the points the sale banked — so a swap
+    // path that is a LIST and draws nothing is planted: every point of the full day's swap 1 nulled.
+    const swapNulls = JSON.parse(JSON.stringify(days.full));
+    for (const p of swapNulls.actions[0].replay.swapPath) p.points = null;
+    for (const [name, tape, silent] of [['pointsOneLeg', days.pointsOneLeg, 'hold'], ['oneLeg', days.oneLeg, 'hold'], ['holdStale', days.holdStale, 'hold'], ['otherLeg', days.otherLeg, 'swap'], ['swapNulls', swapNulls, 'swap']]) {
+      const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
+      const r = tape.actions[k].replay;
+      const live = silent === 'hold' ? 'swap' : 'hold';
+      if (['holdStale', 'swapNulls'].includes(name)) expect(r[`${silent}Path`].length, name).toBeGreaterThan(1);   // a list of samples…
+      expect(runsOf(r[`${silent}Path`]), name).toEqual([]);   // …none placeable: the silent path has no placeable sample
+      expect(runsOf(r[`${live}Path`]).length, name).toBeGreaterThan(0);
+      for (const desktop of [false, true]) {
+        const w = `${name} ${desktop ? 'desktop' : 'phone'}`;
+        mount(tape, desktop);
+        const c = card(k);
+        expect(c.querySelector(`[data-path-label="${silent}"]`), w).toBeNull();
+        expect(c.querySelector(`[data-line="${silent}"], [data-fork-point="${silent}"], [data-fork-end="${silent}"]`), w).toBeNull();
+        expect(c.textContent, w).not.toContain(silent === 'hold' ? 'Hold path' : 'Swap path');
+        expect(c.querySelector(`[data-path-label="${live}"]`) || c.querySelector(`[data-fork-end="${live}"]`), w).toBeTruthy();
+        expect(c.querySelector('[data-replay-sentence]'), w).toBeTruthy();
+        expect(swept(tape), w).toEqual(CLEAN);
+      }
+    }
+    // the sparse leg drew points only: its legend says so
+    mount(days.pointsOneLeg);
+    expect(legendOf(card(0))).toBe('points · rebuilt from 1-minute bars');
+  });
+
+  it('a path with a segment and an isolated sample: the dashed segment, the ring, both swatches, and a legend naming both', () => {
+    const tape = days.mixed;
+    const r = tape.actions[0].replay;
+    expect([segmentsOf(r.swapPath).length, isolatedOf(r.swapPath).length]).toEqual([1, 1]);   // the case is truly mixed
+    expect([segmentsOf(r.holdPath).length, isolatedOf(r.holdPath).length]).toEqual([1, 0]);
+    for (const desktop of [false, true]) {
+      mount(tape, desktop);
+      const c = card(0);
+      const d = c.querySelector('[data-line="swap"]').getAttribute('d');
+      expect(d.split('M')).toHaveLength(2);   // one subpath: the segment, never joined to the isolated close
+      expect(d.split('L')).toHaveLength(segmentsOf(r.swapPath)[0].length);
+      expect(c.querySelectorAll('[data-fork-point="swap"]')).toHaveLength(1);
+      expect(c.querySelectorAll('[data-fork-point="hold"]')).toHaveLength(0);
+      const swap = c.querySelector('[data-path-label="swap"]');
+      expect([Boolean(swap.querySelector('svg line')), Boolean(swap.querySelector('[data-swatch="point"]'))]).toEqual([true, true]);
+      const hold = c.querySelector('[data-path-label="hold"]');
+      expect([Boolean(hold.querySelector('svg line')), Boolean(hold.querySelector('[data-swatch="point"]'))]).toEqual([true, false]);
+      expect(legendOf(c)).toBe('dashed lines and points · rebuilt from 1-minute bars');
+      expect(swept(tape)).toEqual(CLEAN);
+    }
+  });
+
+  it('control: the full-candle day is unchanged — every fork path one dashed subpath, byte-identical to the renderer before the fix; no ring; the dashed legend', () => {
+    for (const desktop of [false, true]) {
+      mount(days.full, desktop);
+      const ds = cards().map((c) => `${c.querySelector('[data-line="hold"]').getAttribute('d')}|${c.querySelector('[data-line="swap"]').getAttribute('d')}`).join('\n');
+      for (const d of ds.split(/[\n|]/)) expect(d).toMatch(/^M[\d.]+ [\d.]+( L[\d.]+ [\d.]+)+$/);
+      // the SHA-256 of the three cards' paths as f931f339's renderer drew them (captured from that commit, both widths)
+      expect(createHash('sha256').update(ds).digest('hex')).toBe('e96b5f384aa0690b1dc44fe2fa47d581f5528facf002ec106ea189bf65099d94');
+      expect(m.q('[data-fork-point], [data-swatch]')).toBeNull();
+      for (const c of cards()) expect(legendOf(c)).toBe('dashed · rebuilt from 1-minute bars');
+    }
+  });
+
+  it('control: a replay with no value keeps the no-drawn treatment — no ring, no legend, no label', () => {
+    const tape = days.undrawn;
+    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
+    for (const desktop of [false, true]) {
+      mount(tape, desktop);
+      const c = card(k);
+      expect(c.querySelector('[data-replay-none="not-drawn"]').textContent.startsWith('No replay drawn for this swap')).toBe(true);
+      expect(c.querySelector('[data-fork-point], [data-swatch], [data-line], [data-path-label], [data-fork-end]')).toBeNull();
+      for (const words of [...REPLAY_WORDS, ...LEGENDS]) expect(c.textContent).not.toContain(words);
+    }
+  });
+
+  it('a replay with values whose scale exists but which emits nothing (each value\'s own instant unrecorded, its neighbours\' recorded): the no-drawn treatment — never the sentence, a label, the legend or the hypothetical tag', () => {
+    const tape = JSON.parse(JSON.stringify(days.full));
+    const a = tape.actions[0];
+    a.subsequentTradesInSlot = 1;   // a hypothetical replay — its tag, too, only beside a drawn one
+    for (const list of [a.replay.holdPath, a.replay.swapPath]) list.forEach((p, j) => { if (j === 1) p.at = null; else p.points = null; });
+    expect([...a.replay.holdPath, ...a.replay.swapPath].filter((p) => Number.isFinite(p.points))).toHaveLength(2);   // values remain…
+    expect(runsOf(a.replay.holdPath).concat(runsOf(a.replay.swapPath))).toEqual([]);   // …none placeable
+    for (const desktop of [false, true]) {
+      mount(tape, desktop);
+      const c = card(0);
+      expect(c.querySelector('[data-replay-none="not-drawn"]').textContent).toBe('No replay drawn for this swap');
+      expect(c.querySelector('[data-replay-sentence], [data-hypothetical], [data-fork-row], [data-path-label], [data-result-row="gap"]')).toBeNull();
+      for (const words of [...REPLAY_WORDS, ...LEGENDS]) expect(c.textContent).not.toContain(words);
+      expect(card(1).querySelector('[data-replay-sentence]')).toBeTruthy();   // the other cards keep theirs
+      expect(swept(tape)).toEqual(CLEAN);
+    }
+  });
+});
diff --git a/src/screens/filmRoomV2/filmRoomCopy.inventory.jsdom.test.jsx b/src/screens/filmRoomV2/filmRoomCopy.inventory.jsdom.test.jsx
index 6a8adb82..737ca852 100644
--- a/src/screens/filmRoomV2/filmRoomCopy.inventory.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/filmRoomCopy.inventory.jsdom.test.jsx
@@ -58,7 +58,7 @@ const COPY_KEYS = [
   'yes', 'no', 'notRecorded', 'close',
   'jumps[0][0]', 'jumps[0][1]', 'jumps[1][0]', 'jumps[1][1]', 'jumps[2][0]', 'jumps[2][1]', 'jumps[3][0]', 'jumps[3][1]', 'jumps[4][0]', 'jumps[4][1]', 'jumps[5][0]', 'jumps[5][1]',
   'holdings', 'holdingsStart', 'holdingsEnd', 'holdingsAt()', 'swapByMaker.agent', 'swapByMaker.platform', 'swapByMaker.other', 'swapMakerNote', 'tapForDeep',
-  'swaps', 'swapsNone', 'swapWord', 'slot', 'banked', 'platformQuote', 'fork', 'holdPath', 'swapPath', 'heldLine()', 'boughtLine()', 'rebuiltDashed', 'hypothetical', 'laterTrades',
+  'swaps', 'swapsNone', 'swapWord', 'slot', 'banked', 'platformQuote', 'fork', 'holdPath', 'swapPath', 'heldLine()', 'boughtLine()', 'rebuiltDashed', 'rebuiltPoints', 'rebuiltDashedPoints', 'hypothetical', 'laterTrades',
   'gap', 'gapNote', 'closedLeg', 'closedLegNote', 'replayNone', 'replayNotDrawn', 'replayNoneSeeCoverage', 'replayCrypto', 'split',
   'splitRows.recordedExit()', 'splitRows.barAtSwap', 'splitRows.barMinusExit', 'splitRows.rescored', 'splitRows.inputsPart', 'splitRows.pricePart', 'barClosedAt()',
   'fill', 'fillRows.recordedFill()', 'fillRows.barAtSwap', 'fillRows.barMinusFill', 'missingLabel', 'deepDoor()',
@@ -183,9 +183,9 @@ describe('Astra B3 — the copy inventory: every key of the screen\'s own copy,
     }
   });

-  it('the inventory\'s size is pinned (the build report states it): 237 copy keys, 345 swept entries', () => {
-    expect(COPY_KEYS).toHaveLength(237);
-    expect(inventory()).toHaveLength(345);
+  it('the inventory\'s size is pinned (the build report states it): 239 copy keys, 347 swept entries', () => {
+    expect(COPY_KEYS).toHaveLength(239);   // Astra F1: the two point legends (237 before)
+    expect(inventory()).toHaveLength(347);
   });

   it('the inventory bites: an added key is seen, and a quantity word in an entry is caught', () => {
diff --git a/src/screens/filmRoomV2/filmRoomCopy.js b/src/screens/filmRoomV2/filmRoomCopy.js
index 6cacdb6e..09c09142 100644
--- a/src/screens/filmRoomV2/filmRoomCopy.js
+++ b/src/screens/filmRoomV2/filmRoomCopy.js
@@ -143,7 +143,9 @@ export const FILM_ROOM_COPY = Object.freeze({
   swapPath: 'Swap path',
   heldLine: (sym) => `${sym} held`,
   boughtLine: (sym) => `${sym} bought`,
-  rebuiltDashed: 'dashed · rebuilt from 1-minute bars',
+  rebuiltDashed: 'dashed · rebuilt from 1-minute bars',   // the legend beside drawn segments only (Astra F1)
+  rebuiltPoints: 'points · rebuilt from 1-minute bars',   // beside isolated points only: no segment is drawn
+  rebuiltDashedPoints: 'dashed lines and points · rebuilt from 1-minute bars',   // beside both
   hypothetical: 'hypothetical',
   laterTrades: 'later trades in this slot, not replayed',
   gap: 'Gap',
diff --git a/src/screens/filmRoomV2/filmRoomModel.js b/src/screens/filmRoomV2/filmRoomModel.js
index ab588dc9..aab69126 100644
--- a/src/screens/filmRoomV2/filmRoomModel.js
+++ b/src/screens/filmRoomV2/filmRoomModel.js
@@ -417,6 +417,23 @@ export function lastPointPath(tape, actionIndex, pathKey) {
   return ['actions', actionIndex, 'replay', pathKey, list.length - 1, 'points'];
 }

+/**
+ * A replay path's RUNS (Astra F1): its samples in order, split wherever a sample has no value or no recorded
+ * instant — the only gaps a check-by-check path has (its samples are the checks', never a fixed bar step, so
+ * lineRuns' bucket rule does not apply). A run of one is an ISOLATED sample: no valid neighbour on either side.
+ * Nothing is joined across a gap.
+ */
+export function forkRuns(list) {
+  const runs = [];
+  let run = null;
+  for (const p of Array.isArray(list) ? list : []) {
+    if (!isNum(p?.points) || toMs(p?.at) === null) { run = null; continue; }
+    if (!run) { run = []; runs.push(run); }
+    run.push(p);
+  }
+  return runs;
+}
+
 // ── holdings at the day's start and end (BA-45) ─────────────────────────────

 /**
diff --git a/src/screens/filmRoomV2/filmRoomModel.test.js b/src/screens/filmRoomV2/filmRoomModel.test.js
index 2eaeacbd..f85004bd 100644
--- a/src/screens/filmRoomV2/filmRoomModel.test.js
+++ b/src/screens/filmRoomV2/filmRoomModel.test.js
@@ -11,7 +11,7 @@ import {
   valueAt, classAt, numberAt, checkStateOf, checkRuns, riskLines, riskSummary, exitMakerOf, swapAnchor, swapOrdinals, deriveHoldings,
   directiveCardOf, rationaleTimeline, planGroups, evidenceMarkers, roleOf, deepSymbols, extremeBars, lastPointPath,
   fmtPoints, fmtPrice, fmtPriceDelta, etClock, etDateLabel, isRecordedScore, SCREEN_AGGREGATE_CLASSES, checkCounts,
-  fmtPercent, seriesFacts, pctTicks, tradingTimeline, lineRuns, linePath,
+  fmtPercent, seriesFacts, pctTicks, tradingTimeline, lineRuns, linePath, forkRuns,
 } from './filmRoomModel';
 import sep23Series from './__fixtures__/sep23.series.json';
 import { SPEC_AGGREGATE_CLASSES } from './__fixtures__/filmRoomHarness';
@@ -294,6 +294,16 @@ describe('A2A2-3 — a line\'s runs break at a missing bucket', () => {
   });
 });

+describe('Astra F1 — a replay path\'s runs break only where a sample has no value or no instant', () => {
+  const at = (min) => new Date(Date.parse('2026-09-23T16:45:00.000Z') + min * 60_000).toISOString();
+  it('consecutive placeable samples are one run, however far apart in time; a null value or an unrecorded instant starts another', () => {
+    expect(forkRuns([{ at: at(0), points: -13 }, { at: at(15), points: -12 }, { at: at(90), points: -9 }]).map((r) => r.length)).toEqual([3]);
+    expect(forkRuns([{ at: at(0), points: -13 }, { at: at(15), points: null }, { at: at(30), points: -9 }, { at: null, points: -8 }, { at: at(60), points: -7 }, { at: at(75), points: -6 }]).map((r) => r.map((p) => p.points))).toEqual([[-13], [-9], [-7, -6]]);
+    expect(forkRuns([{ at: 'not a time', points: 1 }, { at: at(0), points: Number.NaN }])).toEqual([]);
+    expect([forkRuns([]), forkRuns(null), forkRuns(undefined)]).toEqual([[], [], []]);
+  });
+});
+
 describe('formats (display only; the value is the tape\'s)', () => {
   it('points, prices, deltas, ET clock and dates', () => {
     expect([fmtPoints(9), fmtPoints(-13), fmtPoints(0), fmtPoints(1.5), fmtPoints(null)]).toEqual(['+9', '−13', '0', '+1.5', '—']);
```

#### `8ad2950a` — B5 — a heading inside bound text leaves no exemption

```diff
diff --git a/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
index fbb11d49..4627581a 100644
--- a/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
@@ -14,6 +14,10 @@
 //       bound to an R1 / R9 path whose text is the value stored there — never
 //       a string found anywhere in the document; the forbidden-word scan stays
 //       on stored notes
+//   B5  (Astra's follow-up review §3) a heading anywhere on an exempt text's
+//       ancestry — around the bound element or inside it — leaves no
+//       exemption: the quotation's (R7), the stored note's (R1 / R9) and the
+//       agent's name's (R13)
 // A guard that cannot fail guards nothing: every exemption row has its bite.

 import { describe, it, expect, beforeEach, afterEach } from 'vitest';
@@ -210,3 +214,87 @@ describe('Astra B1 — a quotation inside a heading is the screen\'s voice: neit
     expect(quoteDefects(m.container, docs)).toEqual([]);
   });
 });
+
+describe('Astra B5 — a heading INSIDE the bound element is the screen\'s voice too: no exemption stands, for a quotation, a stored note or the agent\'s name', () => {
+  const said = (words) => { const t = clone(sep23Tape); t.rationale[0].rationale = words; return t; };
+  const noted = (note) => { const t = clone(sep23Tape); t.coverage.checks.note = note; return t; };
+  const named = { battle: { agentContext: { agentName: 'best one 73' } } };
+  // every heading form, as a wrapper placed INSIDE the bound element, around its text
+  const INSIDE = [...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => [h, (s) => `<${h}>${s}</${h}>`]), ['role="heading"', (s) => `<span role="heading" aria-level="2">${s}</span>`]];
+  /** A rendered quotation of the stored words, its quoted text then wrapped from the inside (the DOM the guard must see through). */
+  const quotedWith = (tape, wrap) => {
+    m.render(<Quotation doc={tape} path={['rationale', 0, 'rationale']} by="agent" at={['rationale', 0, 'at']} />);
+    const q = m.q('[data-quote-path]');
+    q.innerHTML = wrap(q.textContent);
+    return q;
+  };
+
+  it('Astra\'s repro: "best one 73" in an h2 nested inside the element carrying data-quote-path — every sweep sees the words, the validator names the heading', () => {
+    const tape = said('best one 73');
+    const q = quotedWith(tape, (s) => `<h2>${s}</h2>`);
+    const docs = { tape };
+    expect(q.textContent).toBe('best one 73');   // the text still equals the stored value, byte for byte
+    expect(sweepWords(m.container, docs)).toEqual(['best', 'number word “one”: best one 73']);
+    expect(sweepNumbers(m.container, docs)).toEqual(['stray digit: “best one 73”']);
+    expect(quoteDefects(m.container, docs)).toEqual(['rationale[0].rationale: a heading inside it']);
+    expect(boundQuotationOf(q.querySelector('h2').firstChild, docs)).toBeNull();
+  });
+
+  it('Astra\'s repro: the same inside data-agent-name — swept, and a defect', () => {
+    const el = box('<div><span data-agent-name="agentContext.agentName" data-agent-name-doc="battle"><h2>best one 73</h2></span></div>');
+    expect(el.querySelector('[data-agent-name]').textContent).toBe('best one 73');
+    expect(sweepWords(el, named)).toEqual(['best', 'number word “one”: best one 73']);
+    expect(sweepNumbers(el, named)).toEqual(['stray digit: “best one 73”']);
+    expect(agentNameDefects(el, named)).toEqual(['agent name “best one 73”: a heading inside it']);
+    expect(boundAgentNameOf(el.querySelector('h2').firstChild, named)).toBeNull();
+  });
+
+  it('every heading form inside each bound element (h1–h6, role="heading"): the quotation, the stored note and the name all lose their exemption', () => {
+    for (const [form, wrap] of INSIDE) {
+      const tape = said('best one 73');
+      quotedWith(tape, wrap);
+      expect(quoteDefects(m.container, { tape }), `quotation ${form}`).toEqual(['rationale[0].rationale: a heading inside it']);
+      expect(sweepNumbers(m.container, { tape }), `quotation ${form}`).toEqual(['stray digit: “best one 73”']);
+      expect(sweepWords(m.container, { tape }), `quotation ${form}`).toEqual(['best', 'number word “one”: best one 73']);
+
+      const noteTape = noted('one 73');
+      const note = box(`<div><span data-stored-note="coverage.checks.note">${wrap('one 73')}</span></div>`);
+      expect(storedNoteDefects(note, { tape: noteTape }), `stored note ${form}`).toEqual(['coverage.checks.note: a heading inside it']);
+      expect(sweepNumbers(note, { tape: noteTape }), `stored note ${form}`).toEqual(['stray digit: “one 73”']);
+      expect(sweepWords(note, { tape: noteTape }), `stored note ${form}`).toEqual(['number word “one”: one 73']);
+      expect(boundStoredNoteOf(note.querySelector('[data-stored-note]').firstChild.firstChild, { tape: noteTape }), `stored note ${form}`).toBeNull();
+
+      const name = box(`<div><span data-agent-name="agentContext.agentName" data-agent-name-doc="battle">${wrap('best one 73')}</span></div>`);
+      expect(agentNameDefects(name, named), `name ${form}`).toEqual(['agent name “best one 73”: a heading inside it']);
+      expect(sweepNumbers(name, named), `name ${form}`).toEqual(['stray digit: “best one 73”']);
+      expect(sweepWords(name, named), `name ${form}`).toEqual(['best', 'number word “one”: best one 73']);
+    }
+  });
+
+  it('a stored note under a heading (B1\'s rule, now for stored notes too): every heading form around it is the screen\'s voice', () => {
+    const tape = noted('one 73');
+    for (const [form, wrap] of INSIDE) {
+      const el = box(`<div>${wrap('<span data-stored-note="coverage.checks.note">one 73</span>')}</div>`);
+      expect(storedNoteDefects(el, { tape }), form).toEqual(['coverage.checks.note: inside a heading']);
+      expect(sweepNumbers(el, { tape }), form).toEqual(['stray digit: “one 73”']);
+      expect(sweepWords(el, { tape }), form).toEqual(['number word “one”: one 73']);
+    }
+  });
+
+  it('the controls: an element inside the bound text that is NOT a heading (a span, an emphasis, a role other than heading) keeps each exemption — exempt and valid', () => {
+    const plain = [['span', (s) => `<span>${s}</span>`], ['em', (s) => `<em>${s}</em>`], ['role="note"', (s) => `<span role="note">${s}</span>`]];
+    for (const [form, wrap] of plain) {
+      const tape = said('one 73');
+      quotedWith(tape, wrap);
+      expect([quoteDefects(m.container, { tape }), sweepNumbers(m.container, { tape }), sweepWords(m.container, { tape })], `quotation ${form}`).toEqual([[], [], []]);
+
+      const noteTape = noted('one 73');
+      const note = box(`<div><span data-stored-note="coverage.checks.note">${wrap('one 73')}</span></div>`);
+      expect([storedNoteDefects(note, { tape: noteTape }), sweepNumbers(note, { tape: noteTape }), sweepWords(note, { tape: noteTape })], `stored note ${form}`).toEqual([[], [], []]);
+
+      const docs = { battle: { agentContext: { agentName: 'Twelve 47' } } };
+      const name = box(`<div><span data-agent-name="agentContext.agentName" data-agent-name-doc="battle">${wrap('Twelve 47')}</span></div>`);
+      expect([agentNameDefects(name, docs), sweepNumbers(name, docs), sweepWords(name, docs)], `name ${form}`).toEqual([[], [], []]);
+    }
+  });
+});
diff --git a/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx b/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
index c6290abf..54976751 100644
--- a/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
+++ b/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
@@ -137,14 +137,14 @@ function storedNoteTextOf(node, docs) {
  * Amendment E addendum 4, R13 — the agent's name, PINNED HERE from the ruling: the stored display name at
  * agentContext.agentName on the battle document. It is exempt from the sweeps — forbidden words and number words, and
  * (as a bound quotation is, R7) digits — on its BINDING alone: an element carrying `data-agent-name` at exactly that
- * path whose text equals, byte for byte, the value the battle document stores there — and never inside a heading (the
- * screen's own voice; as B1 rules for a quotation — review A2F1-5).
+ * path whose text equals, byte for byte, the value the battle document stores there — and never inside a heading or
+ * holding one (the screen's own voice; as B1 rules for a quotation — review A2F1-5, Astra B5).
  */
 export const SPEC_AGENT_NAME_PATH = 'agentContext.agentName';
 export function boundAgentNameOf(node, docs = {}) {
   const el = node?.nodeType === 1 ? node : node?.parentElement;
   const n = el?.closest('[data-agent-name]');
-  if (!n || n.getAttribute('data-agent-name') !== SPEC_AGENT_NAME_PATH || n.closest(HEADINGS)) return null;
+  if (!n || n.getAttribute('data-agent-name') !== SPEC_AGENT_NAME_PATH || headingAt(n)) return null;
   const doc = docs[n.getAttribute('data-agent-name-doc') || 'battle'];
   const value = doc ? valueAt(doc, parsePath(SPEC_AGENT_NAME_PATH)) : undefined;
   return typeof value === 'string' && value !== '' && n.textContent === value ? n : null;
@@ -160,23 +160,30 @@ export function agentNameDefects(container, docs = {}) {
   const names = [...container.querySelectorAll('[data-agent-name]')];
   if (names.length > 1) bad.push(`agent name shown ${names.length} times`);
   for (const n of names) {
-    if (n.closest(HEADINGS)) bad.push(`agent name “${n.textContent}”: inside a heading`);
+    const heading = headingAt(n);
+    if (heading) bad.push(`agent name “${n.textContent}”: ${HEADING_DEFECT[heading]}`);
     else if (!boundAgentNameOf(n, docs)) bad.push(`agent name “${n.textContent}”: not bound to ${SPEC_AGENT_NAME_PATH}`);
   }
   return bad;
 }

-/** B2 — the numbers of a stored note are exempt only when it is bound (above) AND its path is one R1 / R9 names. */
+/**
+ * B2 — the numbers of a stored note are exempt only when it is bound (above) AND its path is one R1 / R9 names, and
+ * no heading sits around it or inside it (Astra B5: a heading is the screen's voice, as for a quotation).
+ */
 export function boundStoredNoteOf(node, docs = {}) {
   const s = storedNoteTextOf(node, docs);
-  return s && SPEC_STORED_NOTE_PATHS.some((re) => re.test(s.getAttribute('data-stored-note'))) ? s : null;
+  return s && SPEC_STORED_NOTE_PATHS.some((re) => re.test(s.getAttribute('data-stored-note'))) && !headingAt(s) ? s : null;
 }

-/** Every stored note whose text is not the value at its path — screen words inside it, or a forged path. */
+/** Every stored note whose text is not the value at its path — screen words inside it, or a forged path — or that a heading holds or sits in. */
 export function storedNoteDefects(container, docs = {}) {
   const bad = [];
   for (const s of container.querySelectorAll('[data-stored-note]')) {
-    if (!storedNoteTextOf(s, docs)) bad.push(`${s.getAttribute('data-stored-note')}: not bound — its text is not the stored value`);
+    const where = s.getAttribute('data-stored-note');
+    if (!storedNoteTextOf(s, docs)) bad.push(`${where}: not bound — its text is not the stored value`);
+    const heading = headingAt(s);
+    if (heading) bad.push(`${where}: ${HEADING_DEFECT[heading]}`);
   }
   return bad;
 }
@@ -466,10 +473,20 @@ function boundTextOf(node, docs) {
  * names the right author and time is quoteDefects' check.
  */
 const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
+/**
+ * Astra B1, B5 — where a heading sits on an exempt text's ancestry: 'around' the bound element (it or an ancestor
+ * is one), 'inside' it (a heading in its subtree, between the element and its text), or null. Either way the words
+ * are the screen's voice, so no exemption stands: the quotation's (R7), the stored note's (R1 / R9), the name's (R13).
+ */
+function headingAt(el) {
+  if (el.closest(HEADINGS)) return 'around';
+  return el.querySelector(HEADINGS) ? 'inside' : null;
+}
+const HEADING_DEFECT = { around: 'inside a heading', inside: 'a heading inside it' };
 export function boundQuotationOf(node, docs = {}) {
   const q = boundTextOf(node, docs);
   if (!q || !SPEC_QUOTE_CHANNELS.some((c) => c.re.test(q.getAttribute('data-quote-path')))) return null;
-  if (q.closest(HEADINGS)) return null;
+  if (headingAt(q)) return null;
   return [...q.parentElement.children].some((c) => c.hasAttribute('data-quote-attribution')) ? q : null;
 }

@@ -498,8 +515,9 @@ export function quoteDefects(container, docs = {}) {
     const texts = [...root.children].filter((c) => c.hasAttribute('data-quote-path'));
     if (texts.length !== 1) { bad.push(`a quotation with ${texts.length} quoted texts`); continue; }
     const where = texts[0].getAttribute('data-quote-path');
-    // Astra B1: a quotation never sits inside a heading — the heading is the screen's voice
-    if (root.closest(HEADINGS)) { bad.push(`${where}: inside a heading`); continue; }
+    // Astra B1, B5: a quotation never sits inside a heading, nor holds one — the heading is the screen's voice
+    const heading = headingAt(texts[0]);
+    if (heading) { bad.push(`${where}: ${HEADING_DEFECT[heading]}`); continue; }
     const channel = SPEC_QUOTE_CHANNELS.find((c) => c.re.test(where));
     if (!channel) { bad.push(`${where}: not a recorded-words channel`); continue; }
     const attr = [...root.children].find((c) => c.hasAttribute('data-quote-attribution'));
```

#### `ad6fbded` — review lenses A2G1 / A2G2 — rows for F1 and B5; a heading read by its role's tokens

```diff
diff --git a/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
index 86c411f5..50df98ad 100644
--- a/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
@@ -37,6 +37,7 @@ vi.mock('../../config/featureFlags.js', async (importOriginal) => ({

 import { createHash } from 'node:crypto';
 import FilmRoomStudy from './FilmRoomStudy';
+import { C } from './FilmRoomKit';
 import { REPLAY_SENTENCE } from './filmRoomCopy';
 import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
 import { seedDay, OWNER } from '../../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
@@ -138,6 +139,11 @@ beforeAll(async () => {
   days.pointsOneLeg = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: pointsOneLeg })).tape;
   // the sold leg's only bar the session's first minute: every sample after the swap is stale — a hold path of nulls
   days.holdStale = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: ['2026-09-23T13:30:00Z'] }) })).tape;
+  // both legs' only bar the session's first minute: no sample after the sale is fresh — the swap path's opening sample
+  // (the banked points at the sale, tapeReplay.js composeLegs) is the replay's one placeable value (review A2G1-1)
+  days.saleOnly = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: ['2026-09-23T13:30:00Z'], CRWD: ['2026-09-23T13:30:00Z'] }) })).tape;
+  // a slot traded twice, its swap 1 cut to the 3:59 PM minute: a hypothetical replay drawn as points only (review A2G1-4)
+  days.twicePoints = (await buildTapeDay(await slotTwiceDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [LAST_MINUTE], CRWD: [LAST_MINUTE] }) })).tape;
   // the bought leg's bars before the two checks after the swap, and the close's: a segment and an isolated point on one path
   days.mixed = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ CRWD: ['2026-09-23T16:59:00Z', '2026-09-23T17:14:00Z', LAST_MINUTE] }) })).tape;
 });
@@ -393,9 +399,79 @@ describe('Astra F1 — a replay is drawn only when it emits visible geometry: a
         expect(swept(tape), w).toEqual(CLEAN);
       }
     }
-    // the sparse leg drew points only: its legend says so
-    mount(days.pointsOneLeg);
-    expect(legendOf(card(0))).toBe('points · rebuilt from 1-minute bars');
+    // the legend reads what the drawn path drew, whichever path it is (review A2G1-4): the sparse leg's points; a full
+    // leg's dashed line — the swap path's alone, or the hold path's alone
+    for (const [tape, want] of [[days.pointsOneLeg, 'points · rebuilt from 1-minute bars'], [days.oneLeg, 'dashed · rebuilt from 1-minute bars'], [days.otherLeg, 'dashed · rebuilt from 1-minute bars']]) {
+      mount(tape);
+      expect(legendOf(card(0))).toBe(want);
+    }
+  });
+
+  it('review A2G1-4: each path in its own colour — its ring, its ring swatch and its dashed swatch (hold ink, swap teal)', () => {
+    const colour = { hold: C.ink2, swap: C.teal };
+    for (const tape of [days.points, days.mixed, days.full]) {
+      mount(tape);
+      const c = card(0);
+      for (const leg of ['hold', 'swap']) {
+        for (const g of c.querySelectorAll(`[data-fork-point="${leg}"]`)) expect(g.style.border, `${leg} ring`).toContain(colour[leg]);
+        const label = c.querySelector(`[data-path-label="${leg}"]`);
+        const ringSwatch = label.querySelector('[data-swatch="point"]');
+        if (ringSwatch) expect(ringSwatch.style.border, `${leg} ring swatch`).toContain(colour[leg]);
+        const dashSwatch = label.querySelector('svg line');
+        if (dashSwatch) expect(dashSwatch.style.stroke, `${leg} dashed swatch`).toBe(colour[leg]);
+        const line = c.querySelector(`[data-line="${leg}"]`);
+        if (line) expect(line.style.stroke, `${leg} line`).toBe(colour[leg]);
+      }
+    }
+  });
+
+  it('review A2G1-4: a slot traded twice whose replay is drawn as points only — the hypothetical tag and its count stand beside it', () => {
+    const tape = days.twicePoints;
+    const r = tape.actions[0].replay;
+    expect(tape.actions[0].subsequentTradesInSlot).toBe(1);
+    expect([segmentsOf(r.holdPath).length + segmentsOf(r.swapPath).length, isolatedOf(r.holdPath).length + isolatedOf(r.swapPath).length]).toEqual([0, 3]);
+    mount(tape);
+    expect(card(0).querySelectorAll('[data-fork-point]')).toHaveLength(3);
+    expect(card(0).querySelector('[data-hypothetical] [data-num]').getAttribute('data-num')).toBe('actions[0].subsequentTradesInSlot');
+    expect(swept(tape)).toEqual(CLEAN);
+  });
+
+  it('review A2G1-1: the swap path\'s opening sample alone (both legs stale after the sale) — as the founder\'s rule reads, a value at a recorded instant: one ring at the sale, the swap path\'s label alone, the points legend, the sentence (an open founder question, build report §10)', () => {
+    const tape = days.saleOnly;
+    const k = tape.actions.findIndex((a) => a.symbolOut === 'MSFT');
+    const r = tape.actions[k].replay;
+    expect(r.holdPath.length).toBeGreaterThan(1);
+    expect(runsOf(r.holdPath)).toEqual([]);   // the hold path: samples, none with a value
+    expect(runsOf(r.swapPath)).toEqual([[r.swapPath[0]]]);   // the swap path: its opening sample only…
+    expect([r.swapPath[0].at, r.swapPath[0].points]).toEqual([tape.actions[k].at, tape.actions[k].lockedPoints]);   // …the banked points at the sale
+    for (const desktop of [false, true]) {
+      const w = desktop ? 'desktop' : 'phone';
+      mount(tape, desktop);
+      const c = card(k);
+      expect(c.querySelector('[data-line]'), w).toBeNull();
+      const rings = [...c.querySelectorAll('[data-fork-point]')];
+      expect(rings.map((g) => [g.getAttribute('data-fork-point'), glyphAt(g).xPct]), w).toEqual([['swap', 0]]);   // at the sale: the fork's left edge
+      expect([Boolean(c.querySelector('[data-path-label="hold"]')), Boolean(c.querySelector('[data-path-label="swap"] [data-swatch="point"]'))], w).toEqual([false, true]);
+      expect(legendOf(c), w).toBe('points · rebuilt from 1-minute bars');
+      expect(c.querySelector('[data-replay-sentence] [data-stored-note]').textContent, w).toBe(r.label);
+      if (desktop) expect([...c.querySelectorAll('[data-fork-end]')].map((e) => e.getAttribute('data-fork-end'))).toEqual(['swap']);
+      expect(swept(tape), w).toEqual(CLEAN);
+    }
+  });
+
+  it('review A2G1-5: a run whose samples coincide (two at one instant, one value) is a ring, never a zero-length dashed segment', () => {
+    const tape = JSON.parse(JSON.stringify(days.full));
+    const hold = tape.actions[0].replay.holdPath;
+    hold.forEach((p, j) => { if (j !== 3 && j !== 4) p.points = null; });
+    hold[4].at = hold[3].at;
+    hold[4].points = hold[3].points;   // planted: the writer stamps each sample at its own check
+    expect(runsOf(hold).map((run) => run.length)).toEqual([2]);
+    mount(tape);
+    const c = card(0);
+    expect(c.querySelector('[data-line="hold"]')).toBeNull();
+    expect(c.querySelectorAll('[data-fork-point="hold"]')).toHaveLength(1);
+    expect(c.querySelector('[data-path-label="hold"] svg line')).toBeNull();
+    expect(legendOf(c)).toBe('dashed lines and points · rebuilt from 1-minute bars');   // the swap path's full line, and the hold ring
   });

   it('a path with a segment and an isolated sample: the dashed segment, the ring, both swatches, and a legend naming both', () => {
diff --git a/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
index 4627581a..7faaa269 100644
--- a/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
@@ -281,6 +281,54 @@ describe('Astra B5 — a heading INSIDE the bound element is the screen\'s voice
     }
   });

+  describe('review A2G2-1 / -2 / -3 — every structure that puts a heading on the text\'s path, for each of the three exemptions', () => {
+    const T = 'best one 73';
+    const docs = (() => { const t = clone(sep23Tape); t.rationale[0].rationale = T; t.coverage.checks.note = T; return { tape: t, battle: { agentContext: { agentName: T } } }; })();
+    // each bound element as a string (a div for the quotation's text: the HTML parser closes a <p> at an <h2>)
+    const QUOTE = (inner, tag = 'div') => `<div data-quotation="agent"><${tag} data-quote-path="rationale[0].rationale">${inner}</${tag}><span data-quote-attribution="">— the agent</span></div>`;
+    const NOTE = (inner, tag = 'span') => `<${tag} data-stored-note="coverage.checks.note">${inner}</${tag}>`;
+    const NAME = (inner, tag = 'span') => `<${tag} data-agent-name="agentContext.agentName" data-agent-name-doc="battle">${inner}</${tag}>`;
+    const KINDS = [['quotation', QUOTE, quoteDefects, 'rationale[0].rationale: '], ['stored note', NOTE, storedNoteDefects, 'coverage.checks.note: '], ['name', NAME, agentNameDefects, `agent name “${T}”: `]];
+    const ALL = ['best', 'number word “one”: best one 73'];
+
+    it.each(KINDS)('%s: a heading deeper than the first child (em > h2) — swept, and a defect', (_k, B, validator, prefix) => {
+      const el = box(`<div>${B(`<em><h2>${T}</h2></em>`)}</div>`);
+      expect(sweepNumbers(el, docs)).toEqual([`stray digit: “${T}”`]);
+      expect(validator(el, docs)).toEqual([`${prefix}a heading inside it`]);
+    });
+
+    it.each(KINDS)('%s: the bound element is itself the heading — swept, and a defect', (_k, B, validator, prefix) => {
+      const el = box(`<div>${B(T, 'h2')}</div>`);
+      expect(sweepNumbers(el, docs)).toEqual([`stray digit: “${T}”`]);
+      expect(sweepWords(el, docs)).toEqual(ALL);
+      expect(validator(el, docs)).toEqual([`${prefix}inside a heading`]);
+    });
+
+    it.each(KINDS)('%s: a heading over PART of the bound text costs the whole element its exemption — the words outside the heading are swept too', (_k, B, validator, prefix) => {
+      const el = box(`<div>${B('best <h2>one</h2> 73')}</div>`);
+      expect(el.querySelector('[data-quote-path], [data-stored-note], [data-agent-name]').textContent).toBe(T);   // still bound, byte for byte
+      expect(sweepNumbers(el, docs)).toEqual(['stray digit: “73”']);
+      expect(sweepWords(el, docs)).toEqual(['best', 'number word “one”: one']);   // the forbidden word too — no exemption covers it in a note either
+      expect(validator(el, docs)).toEqual([`${prefix}a heading inside it`]);
+    });
+
+    it.each(KINDS)('%s: role="heading" with no aria-level, inside and around', (_k, B, validator, prefix) => {
+      const inside = box(`<div>${B(`<span role="heading">${T}</span>`)}</div>`);
+      expect([sweepNumbers(inside, docs), validator(inside, docs)]).toEqual([[`stray digit: “${T}”`], [`${prefix}a heading inside it`]]);
+      const around = box(`<div role="heading">${B(T)}</div>`);
+      expect([sweepNumbers(around, docs), validator(around, docs)]).toEqual([[`stray digit: “${T}”`], [`${prefix}inside a heading`]]);
+    });
+
+    it.each(KINDS)('%s: role spelled as a browser still reads a heading — another case, spaces, a second token — inside and around', (_k, B, validator, prefix) => {
+      for (const role of ['Heading', 'HEADING', ' heading', 'heading ', 'heading presentation', 'heading\tnone', 'foo heading', 'presentation heading']) {
+        const inside = box(`<div>${B(`<span role="${role}" aria-level="2">${T}</span>`)}</div>`);
+        expect([sweepNumbers(inside, docs), validator(inside, docs)], `inside ${JSON.stringify(role)}`).toEqual([[`stray digit: “${T}”`], [`${prefix}a heading inside it`]]);
+        const around = box(`<div role="${role}" aria-level="2">${B(T)}</div>`);
+        expect([sweepNumbers(around, docs), validator(around, docs)], `around ${JSON.stringify(role)}`).toEqual([[`stray digit: “${T}”`], [`${prefix}inside a heading`]]);
+      }
+    });
+  });
+
   it('the controls: an element inside the bound text that is NOT a heading (a span, an emphasis, a role other than heading) keeps each exemption — exempt and valid', () => {
     const plain = [['span', (s) => `<span>${s}</span>`], ['em', (s) => `<em>${s}</em>`], ['role="note"', (s) => `<span role="note">${s}</span>`]];
     for (const [form, wrap] of plain) {
diff --git a/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx b/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
index 54976751..0b9c3bde 100644
--- a/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
+++ b/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
@@ -8,14 +8,17 @@
 //                  and no digit appears outside a marked number, an instant, an
 //                  #swap-n anchor or a stored note BOUND to an R1 / R9 path
 //                  (Astra B2: by binding, never by a string match)
-//   storedNoteDefects  every stored note's text is the value at its path
+//   storedNoteDefects  every stored note's text is the value at its path, and
+//                  no heading around it or inside it (Astra B5)
 //   sweepWords     the screen's own voice — everything outside a bound
 //                  quotation (Amendment E addendum 2, R7): no verdict, ranking
 //                  or forbidden word; no "Why?" heading; no number spelled
 //                  as a word outside a marked number (R8)
 //   quoteDefects   R7's guard: every quotation bound to its tape path (text =
 //                  the stored value), attributed as the record says, and never
-//                  inside a heading (Astra B1)
+//                  inside a heading nor holding one (Astra B1, B5)
+// Every exemption — a bound quotation's, a stored note's, the agent's name's —
+// is lost to a heading anywhere on its text's ancestry (headingAt).
 //   sweepSigns     sign colours on recorded scores only
 // The fixtures are the A1 passes' own output (screenFixtures.test.js).

@@ -151,7 +154,8 @@ export function boundAgentNameOf(node, docs = {}) {
 }

 /**
- * R13's guard: the screen shows the name ONCE, bound to the stored name, outside any heading. (That it sits in no
+ * R13's guard: the screen shows the name ONCE, bound to the stored name, with no heading around it or inside it (Astra
+ * B5; headingAt). (That it sits in no
  * attribute and in no other text is proved with a distinctive name in the screen suite — a substring scan for a real
  * name would match the screen's own words: "Check", "Hold", "Deep" — review A2F1-4.)
  */
@@ -466,22 +470,31 @@ function boundTextOf(node, docs) {
 }

 /**
- * R7's guard — what the sweeps exempt: an ATTRIBUTED quotation bound to a tape path. All of: bound (above), a path
- * in the recorded-words channels, an attribution beside it (review A2A1-4: a bound quotation with no attribution,
- * or of a path that holds no one's words, stays under the sweeps), and NO heading around it (Astra B1: a heading is
- * the screen's own voice — recorded words inside one would read as the screen's title). Whether the attribution
- * names the right author and time is quoteDefects' check.
+ * A heading, as a browser reads one: h1–h6, or an element whose role names `heading` among its tokens — in any case,
+ * with any spacing (review A2G2-1: `role="heading presentation"`, `" heading"` and `"Heading"` are headings in the
+ * accessibility tree). A token after another role (`"presentation heading"`) is counted too: stricter than a browser,
+ * never laxer, so the guard can only over-reject.
  */
-const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
+const isHeading = (el) => /^H[1-6]$/.test(el.tagName) || String(el.getAttribute('role') || '').trim().split(/\s+/).some((t) => t.toLowerCase() === 'heading');
 /**
- * Astra B1, B5 — where a heading sits on an exempt text's ancestry: 'around' the bound element (it or an ancestor
- * is one), 'inside' it (a heading in its subtree, between the element and its text), or null. Either way the words
- * are the screen's voice, so no exemption stands: the quotation's (R7), the stored note's (R1 / R9), the name's (R13).
+ * Astra B1, B5 — where a heading sits on an exempt text's ancestry: 'around' the bound element (it, or any ancestor,
+ * is one), 'inside' it (ANY heading in its subtree — between the element and its text, over part of the text, or an
+ * empty one beside it), or null. Either way the words are the screen's voice, so no exemption stands: the
+ * quotation's (R7), the stored note's (R1 / R9), the name's (R13). Decided for the bound element as a whole, never
+ * for one text node of it (review A2G2-2: a heading over one word costs the whole element its exemption).
  */
 function headingAt(el) {
-  if (el.closest(HEADINGS)) return 'around';
-  return el.querySelector(HEADINGS) ? 'inside' : null;
+  for (let e = el; e; e = e.parentElement) if (isHeading(e)) return 'around';
+  return [...el.querySelectorAll('*')].some(isHeading) ? 'inside' : null;
 }
+
+/**
+ * R7's guard — what the sweeps exempt: an ATTRIBUTED quotation bound to a tape path. All of: bound (above), a path
+ * in the recorded-words channels, an attribution beside it (review A2A1-4: a bound quotation with no attribution,
+ * or of a path that holds no one's words, stays under the sweeps), and NO heading around it or inside it (Astra B1,
+ * B5: a heading is the screen's own voice — recorded words inside one would read as the screen's title; headingAt
+ * above). Whether the attribution names the right author and time is quoteDefects' check.
+ */
 const HEADING_DEFECT = { around: 'inside a heading', inside: 'a heading inside it' };
 export function boundQuotationOf(node, docs = {}) {
   const q = boundTextOf(node, docs);
```

#### `f126fde4` — refuter A2GV — rows for the ring's stroke, a hold-only hypothetical slot, empty and hidden headings

```diff
diff --git a/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
index 50df98ad..45bda7ec 100644
--- a/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomStudy.replay.writer.jsdom.test.jsx
@@ -142,6 +142,10 @@ beforeAll(async () => {
   // both legs' only bar the session's first minute: no sample after the sale is fresh — the swap path's opening sample
   // (the banked points at the sale, tapeReplay.js composeLegs) is the replay's one placeable value (review A2G1-1)
   days.saleOnly = (await buildTapeDay(await sep23Day(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: ['2026-09-23T13:30:00Z'], CRWD: ['2026-09-23T13:30:00Z'] }) })).tape;
+  // a slot traded twice, the bought leg's bars deleted: a hypothetical replay drawn on the hold path alone (review A2GV-2)
+  const holdOnly = sep23Bars();
+  delete holdOnly.CRWD;
+  days.twiceHoldOnly = (await buildTapeDay(await slotTwiceDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: holdOnly })).tape;
   // a slot traded twice, its swap 1 cut to the 3:59 PM minute: a hypothetical replay drawn as points only (review A2G1-4)
   days.twicePoints = (await buildTapeDay(await slotTwiceDay(), { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sparseBars({ MSFT: [LAST_MINUTE], CRWD: [LAST_MINUTE] }) })).tape;
   // the bought leg's bars before the two checks after the swap, and the close's: a segment and an isolated point on one path
@@ -353,8 +357,10 @@ describe('Astra F1 — a replay is drawn only when it emits visible geometry: a
           const at = glyphAt(g);
           expect(Math.abs(at.xPct - place.xPct(want[j].at)), `${w} ${leg} ${j} x`).toBeLessThan(0.02);
           expect(Math.abs(at.y - place.y(want[j].points)), `${w} ${leg} ${j} y`).toBeLessThan(0.06);
-          // a visible mark: a 7 px ring with a solid stroke, inside the fork's own region
+          // a visible mark: a 7 px ring with a solid stroke of real width (its fill is the card's own surface, so the stroke
+          // is all that shows — review A2GV-1), inside the fork's own region
           expect([g.style.width, g.style.height, g.style.borderStyle || g.style.border.split(' ')[1]], `${w} ${leg} ${j}`).toEqual(['7px', '7px', 'solid']);
+          expect(parseFloat(g.style.borderWidth || g.style.border), `${w} ${leg} ${j} stroke`).toBeGreaterThanOrEqual(1);
           expect(g.closest(`[data-region="fork-${k}"]`)).toBeTruthy();
           expect(g.getAttribute('aria-hidden')).toBe('true');
         });
@@ -434,6 +440,13 @@ describe('Astra F1 — a replay is drawn only when it emits visible geometry: a
     expect(card(0).querySelectorAll('[data-fork-point]')).toHaveLength(3);
     expect(card(0).querySelector('[data-hypothetical] [data-num]').getAttribute('data-num')).toBe('actions[0].subsequentTradesInSlot');
     expect(swept(tape)).toEqual(CLEAN);
+    // review A2GV-2: the same slot with only its hold path drawn (the bought leg's bars deleted) keeps the tag too
+    const hold = days.twiceHoldOnly;
+    expect([runsOf(hold.actions[0].replay.holdPath).length > 0, hold.actions[0].replay.swapPath]).toEqual([true, null]);
+    mount(hold);
+    expect(card(0).querySelector('[data-path-label="swap"]')).toBeNull();
+    expect(card(0).querySelector('[data-hypothetical] [data-num]').getAttribute('data-num')).toBe('actions[0].subsequentTradesInSlot');
+    expect(swept(hold)).toEqual(CLEAN);
   });

   it('review A2G1-1: the swap path\'s opening sample alone (both legs stale after the sale) — as the founder\'s rule reads, a value at a recorded instant: one ring at the sale, the swap path\'s label alone, the points legend, the sentence (an open founder question, build report §10)', () => {
diff --git a/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx b/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
index 7faaa269..aed0ed86 100644
--- a/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
+++ b/src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
@@ -312,6 +312,14 @@ describe('Astra B5 — a heading INSIDE the bound element is the screen\'s voice
       expect(validator(el, docs)).toEqual([`${prefix}a heading inside it`]);
     });

+    it.each(KINDS)('%s: review A2GV-3 — an EMPTY heading beside the text, or an aria-hidden one, inside the bound element still costs it the exemption', (_k, B, validator, prefix) => {
+      for (const inner of [`<h2></h2>${T}`, `${T}<span role="heading" aria-level="2"></span>`, `<h2 aria-hidden="true">${T}</h2>`]) {
+        const el = box(`<div>${B(inner)}</div>`);
+        expect(el.querySelector('[data-quote-path], [data-stored-note], [data-agent-name]').textContent).toBe(T);
+        expect([sweepNumbers(el, docs), validator(el, docs)], inner).toEqual([[`stray digit: “${T}”`], [`${prefix}a heading inside it`]]);
+      }
+    });
+
     it.each(KINDS)('%s: role="heading" with no aria-level, inside and around', (_k, B, validator, prefix) => {
       const inside = box(`<div>${B(`<span role="heading">${T}</span>`)}</div>`);
       expect([sweepNumbers(inside, docs), validator(inside, docs)]).toEqual([[`stray digit: “${T}”`], [`${prefix}a heading inside it`]]);
diff --git a/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx b/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
index 0b9c3bde..cc98fb30 100644
--- a/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
+++ b/src/screens/filmRoomV2/__fixtures__/filmRoomHarness.jsx
@@ -17,9 +17,10 @@
 //   quoteDefects   R7's guard: every quotation bound to its tape path (text =
 //                  the stored value), attributed as the record says, and never
 //                  inside a heading nor holding one (Astra B1, B5)
-// Every exemption — a bound quotation's, a stored note's, the agent's name's —
-// is lost to a heading anywhere on its text's ancestry (headingAt).
 //   sweepSigns     sign colours on recorded scores only
+// Every exemption — a bound quotation's, a stored note's, the agent's name's —
+// is lost to a heading around its bound element or anywhere inside it
+// (headingAt; Astra B1, B5).
 // The fixtures are the A1 passes' own output (screenFixtures.test.js).

 import React, { act } from 'react';
@@ -155,9 +156,8 @@ export function boundAgentNameOf(node, docs = {}) {

 /**
  * R13's guard: the screen shows the name ONCE, bound to the stored name, with no heading around it or inside it (Astra
- * B5; headingAt). (That it sits in no
- * attribute and in no other text is proved with a distinctive name in the screen suite — a substring scan for a real
- * name would match the screen's own words: "Check", "Hold", "Deep" — review A2F1-4.)
+ * B5; headingAt). That it sits in no attribute and in no other text is proved with a distinctive name in the screen
+ * suite — a substring scan for a real name would match the screen's own words: "Check", "Hold", "Deep" (review A2F1-4).
  */
 export function agentNameDefects(container, docs = {}) {
   const bad = [];
```

### 10.9 Reported, not fixed (for separate tasking or your call)

- **A2G1-1:** the founder question (10.5).
- **A2G1-2:** a fork's end value is its path's last element. It shows "—" (the tape's null) beside a drawn path whose close sample is null; at desktop that tag floats at mid-height. It predates the round. Fix: place a null end tag at the last drawn sample, or omit it.
- **A2G1-3:** the legend's "points" (10.4 #3).
- **The drawn card does not list the replay's own missing inputs;** only the no-drawn line does. They do appear on the section's replay coverage line. This predates the round.
- **`sweepWords`' "Why" heading scan reads h1–h6 only, not `role="heading"`.** This predates the round. No shipped role is a heading.
- **Unchanged from the prompt:** B6 (the wide last-close label at 320 px) and §9.7's list wait for the card build. R14 settles §9.7's zero-count wording.

### 10.10 State

The PR is a **draft**. Head: this report's commit; its SHA is posted with the hand-off. Nothing is merged, flipped or deployed. The flip to `'on'` is its own PR after this one. R14 is already committed here (10.3), so that PR need not carry it; it still reconciles the checks §9.8 names.
