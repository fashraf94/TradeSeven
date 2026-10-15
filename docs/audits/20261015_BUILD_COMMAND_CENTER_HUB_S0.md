# Build report — Command Center hub, slice S0

Claude Code (Opus 5.5), October 15, 2026, for Flash. The build prompt was the founder's "implementation kickoff, S0 only (V2)" of October 15. This report covers S0 only: the governing documents, the dark flag, one mount picker at both dashboard sites, the lazy hub gate and its fallback, and a placeholder hub. Nothing is activated, merged or wired to deployment.

## Verdict

| Item | Result |
|---|---|
| Input hashes | Both pinned hashes match: spec V1.2 `174d1a9a…497c`, design `34741c53…9286` (1,518,641 bytes). The companion update has no pinned value ("supplied at its delivery"); measured `fd5ba322…1f7c`. |
| Starting check | Every S0 seam matches the spec and the prompt (§3 below). No S0 build exists on any branch or in the last 100 PRs. No conflict, so the build continued without stopping. |
| Governing documents | The first commit (`bbf1b7d3`) adds the spec, the integration update and the design mock-up, byte-identical: each committed blob hashes to its source value. README rows added in the same commit. |
| Flag | `COMMAND_CENTER_HUB_ENABLED = false`, accessor, docstring with the full flip map, pin file, `// Pinned by:` pointer, DARK_BY_DESIGN entry. No URL, environment or localStorage override. |
| Both dashboard sites | One pure picker decides at both sites. With the flag off, each site renders exactly what it rendered before S0: same shell, same props (frozen and checked), same wrapper, same boundary, same background. |
| Lazy gate | Skeleton while loading; the hub when loaded. If the hub's code fails to load, the dashboard the user would have had anyway appears, with a Retry / Reload / Dismiss notice, and the failure is logged once. Any other hub error still reaches the existing Dashboard error screen. |
| With the flag off | The hub's code is never downloaded. Nothing new reads data, sets a timer or listens to anything. |
| Tests | 90 new test rows (picker 28, gate 26, real chunk 2, App and flag-off guard 26, pin 8) plus 2 guard-directory rows. Mutation checks: round 1 killed 40 of 40; round 2 killed 22 of 23 (the survivor is equivalent, see §6.4); round 3 killed all 18 reproductions of the L3 lens's survivors. |
| `vite build` | Exit 0. The hub ships as its own 0.72 kB chunk (`CommandCenterHub-*.js`). The main bundle only references it through a dynamic import, and `index.html` does not preload it. |
| Full suite (Linux, CI-shaped) | Exit 0 at the code head `b62163cf` (WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `npm run test:run -- --maxWorkers=2`): `Test Files 983 passed \| 7 skipped (990)`, 20,972 tests passed, 88 skipped, 0 failed (392 s). `lint:gate` exit 0; build exit 0. |
| §2 review | 4 lenses, each with its own refuter: L1 flag-off parity, L2 gate lifecycle, L4 conventions and documents, then L3 test integrity (the mutating lens, last). 36 findings: 25 CONFIRMED, 8 PARTLY, 3 REFUTED. Every CONFIRMED or PARTLY finding that changes code or tests is fixed; four NITs are accepted with reasons (§7). No finding was a defect in what users see with the flag off. |
| Fenced files | None edited (BUILD_RULES §1). Nothing under `api/` is touched. |
| Preview (NEVER MERGE) | Branch `claude/command-center-hub-s0-smoke` (`61c4393e` = the code head plus one line flipping the flag to `true`). Preview: <https://trade-seven-nn4mnr08y-fais-projects-bc179554.vercel.app>. Open the dashboard on a phone and on a desktop: the placeholder hub replaces the dashboard, and the navigation and starfield stay (§8). |
| Blockers | None. |
| Next slice | **S1** — the approved shell, the larger Shadow still, tabs and defaults, the strip and the reserved copy (spec §11.2). |

## 1. Branch, HEAD and preamble

- `git fetch origin` ran first. `origin/main` = `495ee07b` (the merge of PR #962), which is the branch's base. Divergence at start: 0 / 0. The tree was clean.
- Local branch `claude/command-center-hub-s0-fb9ba3`. The desktop app adds the `-fb9ba3` suffix to worktree branches; the branch is pushed under the prompt's name, `claude/command-center-hub-s0`.
- Commits on the branch, in order:

| Commit | What |
|---|---|
| `bbf1b7d3` | The governing documents and their README rows (first commit, parent `495ee07b`) |
| `8b72aaf4` | S0: flag, picker, App sites, gate, scaffold, tests, guard registration |
| `9d3010f8` | The flag block moved to the end of `featureFlags.js`, so every spec §4 anchor there still holds (a pure move) |
| `f4de3224` | §2 review fix round |
| `0a57d295` | Comment correction from the L1 refuter (a suite does render App.jsx) |
| `7b6a8794` | The house module-scope row restored (L4-7 refuted) and the consumer row widened |
| `b62163cf` | The L3 fix round: rows tightened so all 14 L3 survivors are killed |
| (the report commit) | This report and its README row; documentation only |

- The earlier spec worktree (`claude/command-center-core-spec-f15e40`, with its uncommitted `docs/README.md` change and V1 / V1.1 files) and the detached Sol worktree were not touched.

## 2. Inputs and committed blobs

| Input | Source | Bytes | Source SHA-256 | Repository path | Committed blob SHA-256 |
|---|---|---|---|---|---|
| Spec V1.2 | `Documents/FantasyTrades/CommandCenter/CommandCenter_Core_Implementation_Spec_V1_2.md` | 90,033 | `174d1a9a7f111a2c9cfc482456a4ea06f05123eb6f6415192ce991b6a831497c` | `docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md` | same |
| Integration update | `Documents/FantasyTrades/CommandCenter/CommandCenter_Integration_Update_20261012.md` | 33,745 | `fd5ba3223dc07d488ec8764c6e3040edab392f0c908193a6a4ecf52a97bd1f7c` (measured; no pinned value was supplied) | `docs/audits/20261012_COMMAND_CENTER_INTEGRATION_UPDATE.md` | same |
| Design | `Downloads/Command Center - Flowing Filament (standalone) (2).html` | 1,518,641 | `34741c53822d08021fc685fe87c7dc06796429ad7272270290f62925738d9286` | `docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html` | same |

All three originals are LF with no CR byte, so no line-ending normalization was involved: each blob is the original's bytes. A Windows checkout with `core.autocrlf=true` writes CRLF to disk, so the files hash differently there (spec `65643c11…`, update `b9c72199…`, design `af75c1a1…`, measured by the L4 refuter with `git cat-file --filters`). The README now says "blob SHA-256" and explains this. The same property holds for the earlier byte-identical rows (the Practice Field documents).

The README rows say where the approval comes from: this build prompt, October 15, 2026 ("Approved spec … passed its final focused review"). The spec's own header ("Proposed, for founder review") and the update's approval-pending lines (§6, §7) predate that approval and are kept byte-exact. V1 and V1.1 were not copied in.

## 3. Starting check (BUILD_RULES §3)

Every anchor below was read in this session at `495ee07b` (VERIFIED).

| Seam | At `495ee07b` | Status |
|---|---|---|
| Mobile mount site | `src/App.jsx:8763–8810`: `const DashboardComponent = COMMAND_DASHBOARD_ENABLED ? CommandDashboard : DashboardLoop;` (:8766) inside `<ErrorBoundary name="Dashboard">` (:8768); sibling background `isStarfieldMobileOn() ? <StarfieldBackground mode="mobile" …/> : <DesktopBackground …/>` (:8774–8776) | VERIFIED; matches the prompt and spec §2 (`:8766`) |
| Desktop mount site | `src/App.jsx:8815–8872`: `COMMAND_DASHBOARD_DESKTOP_ENABLED ?` (:8826) `CommandDashboardDesktop` inside `<div style={{ marginLeft: sidebarCollapsed ? '64px' : '220px', transition: 'margin-left 0.2s ease' }}>` (:8829), else `DashboardDesktop … sidebarCollapsed={sidebarCollapsed}` (:8845, :8866); background `isStarfieldOn()` (:8822–8824) | VERIFIED; matches (the spec cites `:8830`) |
| Width split | `const isMobile = rawIsMobile \|\| isTablet;` (`src/App.jsx:2209–2210`): ≤ 768 px is the mobile site; an 834 px tablet goes to the desktop site | VERIFIED |
| Navigation | `DesktopSidebar` rendered by App for `!isMobile` (`src/App.jsx:10142`); `BottomNav` for `isMobile` (`:12419`); `sidebarCollapsed` defaults to `true` (`:2423`) | VERIFIED; a hub at either site keeps the app's navigation |
| Lazy loading | Plain `React.lazy` at module scope (`src/App.jsx:45–65`) with `Suspense` per screen. No chunk-retry or chunk-error helper exists anywhere in `src/`. The closest precedent is the Film Room v2 route (`src/screens/filmRoomV2/FilmRoomRoute.jsx:37`): lazy + Suspense, no error fallback | VERIFIED |
| Error boundary | `src/components/ErrorBoundary.jsx:87–263`: class boundary with a `fallback` node/function and `onRetry`; `logErrorToFirebase` (:11) writes `errorLogs` | VERIFIED |
| Flag conventions | Dashboard flags `featureFlags.js:23`, `:35`; render-scope accessor precedent `isCharacterPaneOn()` (`:2213`); `DARK_BY_DESIGN` (`src/config/flagPinGuard.test.js:58`); `// Pinned by:` pointers kept honest by the guard's docstring-window row | VERIFIED |
| Spec §4 flag anchors | `featureFlags.js` `:1017, :1503, :1718, :1765, :1856, :2026, :2951, :2991, :3118, :3150, :3194` all hold. The 62 lines added since `c05a5bf7` are appended after `:3195` | VERIFIED. S0 appends its flag at the end too, so the anchors still hold at the head |
| Existing S0 build | None. No local or remote ref and no commit message mentions `COMMAND_CENTER_HUB` / `CommandCenterHub`; there is no such code on `origin/main`; the 100 most recent PRs (#869–#968) contain no hub build | VERIFIED |

**Drift the prompt listed, confirmed:** `src/App.jsx` is unchanged since `c05a5bf7`. `FILM_ROOM_ROUTE` is at `src/constants/filmTape.js:138`. `src/data/situationRegistry.js` exists. `flagPinGuard.test.js` gained entries (22 DARK_BY_DESIGN keys at `c05a5bf7`, 23 at `495ee07b`; S0 adds the 24th). None of this affects S0.

**A premise corrected during review:** the prompt and BUILD_RULES §2 (`docs/BUILD_RULES.md:46`) say no test imports `App.jsx`. One does: `src/App.xpModal.jsdom.test.jsx:171` (since `1c4bf1b3`, Sep 15) renders App at desktop width for the XP modal. It does not exercise the mobile site or check the shells' props or placement, so the build is still the only check that catches a syntax error at the mobile site. BUILD_RULES is founder-governed and was not edited; the stale line is flagged here for separate tasking.

## 4. What S0 built, by `file:line` (at `b62163cf`; the source files are unchanged since `f4de3224`, only tests moved after)

**Flag** — `src/config/featureFlags.js:3262–3311`, appended at the end of the file.
- `COMMAND_CENTER_HUB_ENABLED = false` is at `:3306`, with its `// Pinned by:` pointer at `:3305`.
- `isCommandCenterHubOn()` (`:3309`) returns the flag and nothing else.
- The docstring states the off and on behaviour, the render-scope rule and that no override exists. Its RUNWAY carries **THE FLIP MAP** (`:3296`), which lists every move a flip makes in one commit: the constant; the pin row, the accessor row's title and the registration row in the pin file; the DARK_BY_DESIGN entry; the docstring's state lines.
- `src/config/flagPinGuard.test.js:138` registers the DARK_BY_DESIGN entry, with a runway note that names the flip map.

**Pin** — `src/config/commandCenterHubFlags.test.js` (8 rows), and it pins only this flag. The rows check:
- the dark value, and that the accessor returns it;
- the accessor's exact body (no override);
- the house module-scope row;
- that no src module reads the constant or derives the accessor at module scope;
- the plain boolean shape;
- the docstring, including every flip-map step;
- the DARK_BY_DESIGN registration, with a remedy message for the person flipping.

**Picker** — `src/components/CommandCenter/pickDashboardShell.js:50`, a pure function that imports nothing. `pickDashboardShell({ hubOn, isMobile, mobileDashboardOn, desktopDashboardOn })` returns a frozen `{ shell, legacyShell }`:
- `legacyShell` is the pre-S0 pick for that site: CommandDashboard or DashboardLoop on mobile, CommandDashboardDesktop or DashboardDesktop on desktop.
- `shell` is `'hub'` only when `hubOn === true`, so anything else fails closed.
- The legacy inputs keep App's own truthiness.

**App** — `src/App.jsx`:
- Imports at `:126–127` and `:129`.
- One pick, made at render inside the dashboard block (`:8767`).
- Mobile site:
  - the legacy element is chosen from the pick (`:8780–8812`);
  - the site renders `dashboardPick.shell === DASHBOARD_SHELLS.HUB ? <CommandCenterHubGate legacy={legacyDashboard} /> : legacyDashboard` (`:8823–8825`), beside the unchanged starfield ternary.
- Desktop site:
  - `sidebarOffsetStyle` (`:8837`) holds exactly the old inline values;
  - the legacy element is chosen from the pick, and CommandDashboardDesktop keeps its offset wrapper (`:8838–8881`);
  - the gate gets the same element and the offset as its `frame` (`:8893–8901`).
- The props of the three moved elements are unchanged. A whitespace-insensitive diff against `495ee07b` shows only structural lines: +58 / −26.

**Gate** — `src/components/CommandCenter/CommandCenterHubGate.jsx`:
- `HubLoadError` (`:59`) carries the cause's name, message and stack.
- `reportHubLoadFailure` (`:72`) writes to the console and to the house `logErrorToFirebase`.
- `createHubLoader` (`:84`): each import attempt that rejects is tagged and reported once, at rejection. `retry()` runs a fresh import and swaps in a new `lazy()` only when it loads, and it shares one in-flight import.
- `HubLoadBoundary` (`:107`) falls back only for a `HubLoadError` and rethrows everything else to App's Dashboard boundary (`:120`).
- Skeleton (`:127`).
- Notice (`:151`): `position: fixed`, with Retry (aria-disabled and "Retrying…" while in flight, keeping focus), Reload and Dismiss.
- `reloadPage` (`:190`).
- `createCommandCenterHubGate` (`:198`): `frame` wraps the skeleton and the hub; `legacy` is never framed, so DashboardDesktop is not offset twice.
- The default export binds `() => import('./CommandCenterHub')` (`:248`).
- No read, timer, listener, subscription or effect.

**Scaffold** — `src/components/CommandCenter/CommandCenterHub.jsx:17`: one labelled `<section aria-label="Command Center">` with a heading and one line. It takes no props and has no data and no effects. Its strings are in `src/components/CommandCenter/hub/hubCopy.js`.

**Copy** — the gate's strings live in `src/components/CommandCenter/hubGateCopy.js`. This is a deliberate second table beside spec §2's `hub/hubCopy.js`: the gate ships in the main chunk and the hub's table travels in the lazy chunk (L4-6, §7). Every user-visible string is in one of the two tables.

**Guards** — the five new source files are registered in `src/theme/tokens.guard.test.js:132–136` and `motion.guard.test.js:135–139`, with baselines. A new directory row in each (`tokens.guard.test.js:248`, `motion.guard.test.js:203`) fails if any file under `src/components/CommandCenter/` is left off the list, so later slices cannot add an unguarded file.

**Not built (out of S0 scope):** the visual redesign, the Research reader, the attempt provider (the spec's no-op provider wrapper included), the R1/R2 repairs, deployment wiring, growth or preference stores, trading policy and activation.

## 5. Checks

| Check | Command / place | Result |
|---|---|---|
| Picker, all 16 combinations | `pickDashboardShell.test.js` | 28 / 28 |
| Gate (jsdom) | `CommandCenterHubGate.jsdom.test.jsx`. A rejected import at each width and flag state renders the hub-off shell (checked against the picker with the hub off). Also covered: skeleton and hub framing, report once per attempt (no repeat per mount; still reported when the fallback throws), Retry (dashboard stays and focus is kept; a failed retry changes nothing), double-click, Reload, Dismiss, a hub render error reaching the Dashboard boundary, the loader | 26 / 26 |
| The real gate over the real chunk | `CommandCenterHubGate.chunk.jsdom.test.jsx`: importing the gate evaluates no hub module; rendering it loads the placeholder | 2 / 2 |
| App source guard, flag-off graph guard | `commandCenterHub.mount.guard.test.js`. Covers: one pick from the four named inputs; each site's whole tree; the three elements' props frozen from `495ee07b`; one shell mount each; one way into the hub chunk; no read, timer, listener or effect on the hub side | 22 / 22 |
| Flag pin | `commandCenterHubFlags.test.js` | 8 / 8 |
| Mutation, round 1 (`8b72aaf4`) | 40 mutants, each applied to an LF snapshot and restored byte-for-byte | 40 killed |
| Mutation, round 2 (`f4de3224`) | 23 mutants on the review-fix rows | 22 killed, 1 equivalent (§6.4) |
| Mutation, round 3 (`b62163cf`) | The 14 L3 survivors, reproduced as 18 mutants | 18 killed |
| The flip, dry run | The smoke commit's one line, run against the S0 suites, `src/config/` and the App-reading suites (114 files) | Exactly the 3 pin rows go red, as designed: the pin, and the flag-pin guard's contradiction and integrity rows. `App.xpModal.jsdom`, which renders App at desktop width and so meets the hub, stays green. One unrelated row (`backingBetaFlags` "EVERY importer…") timed out at 7.8 s under that parallel load; it passes alone |
| `vite build` | LF snapshot of `8b72aaf4`; Linux at `9d3010f8` and `b62163cf` | Exit 0 each time. The hub is its own 0.72 kB chunk (`CommandCenterHub-BUYC_7vQ.js` at `b62163cf`). The entry references it only through `import()` and `index.html` does not preload it. The build is run once more on the exact pushed report head before the push; that result is in the PR description. |
| `lint:gate` | WSL clone (Linux) at `b62163cf` | Exit 0 |
| Full suite, Linux CI shape | WSL Ubuntu, private clone, Node 20.20.2, `TZ=UTC`, `npm run test:run -- --maxWorkers=2` | Exit 0 at the code head `b62163cf`: `Test Files 983 passed \| 7 skipped (990)`, 20,972 tests passed, 88 skipped, 0 failed (392 s). |

An earlier Linux run, at `9d3010f8` before the review fixes, was green: `Test Files 983 passed | 7 skipped (990)`, 20,957 tests passed with 0 failed, suite exit 0, `lint:gate` exit 0, build exit 0.

**Windows note.** In this CRLF working tree one pre-existing row fails: `shadowCpuQuoteIntegrityFlags.test.js`, "the guard registers it as dark by design". It reads `flagPinGuard.test.js` without normalizing line endings and passes on the LF snapshot. The `agentReadCensus.guard` path-separator rows are known Windows-only failures too. Neither is caused by this branch.

## 6. The BUILD_RULES §2 review record

The review threshold is met on both measures: the cumulative diff is 21 files and about 2,750 lines (the docs commit counts).

### 6.1 How it ran

- Every reviewer worked on its own `git -c core.autocrlf=false archive` extraction, with paths distinct and `node_modules` junctioned. Reviewers were read-only on git and on the working tree and returned text only.
- **L1** flag-off parity and the mount sites, **L2** gate lifecycle and React semantics, and **L4** conventions, spec conformance, documents and fence ran in parallel on `9d3010f8`.
- Each lens's findings then went to a separate **refuter**, on a fresh snapshot, told to disprove them with a concrete repro.
- The fixes landed in `f4de3224` / `0a57d295` / `7b6a8794`.
- **L3**, the mutating test-integrity lens, ran last on its own tree at `7b6a8794`. Its refuter checked its survivors on another fresh tree, and the fixes landed in `b62163cf`.

### 6.2 Findings and dispositions

| ID | Finding (short) | Lens severity | Refuter verdict | Disposition |
|---|---|---|---|---|
| L1-1 | The mount guard matched the pick ternary anywhere in the block: a shell moved outside the Dashboard boundary or the container (mutants C, D) stayed green, xpModal included | MAJOR | CONFIRMED (core on C/D; mutant A alone, a reorder plus a boundary rename, is cosmetic) | FIXED: each site's whole tree is now pinned as normalized text (`mount.guard` "each site's whole tree"); killed by A10–A12 |
| L1-2 | A cached failed import was written to `errorLogs` again on every later dashboard mount | MINOR | CONFIRMED (1 import, 4 mounts, 4 writes; with or without StrictMode) | FIXED: reported by the loader, once per import attempt; row pinned |
| L1-3 | Comments said a bare `vi.mock` factory yields `undefined`; under vitest 4 a missing export throws | NIT | CONFIRMED (vitest's proxy throws; `undefined` comes from an automock) | FIXED: wording in the flag docstring, the picker and its test |
| L2-1 | If the fallback throws in the same pass, the chunk failure went unreported (componentDidCatch's capture update is discarded) | MINOR | CONFIRMED (double fault only) | FIXED: the report moved to the loader; row "still reported when the fallback shell itself throws" |
| L2-2 | Same defect as L1-2; a report per Retry is a genuine new attempt | MINOR | CONFIRMED (per-mount half is the defect, per-Retry half intended) | FIXED with L1-2 |
| L2-3 | Retry unmounted the working dashboard during the retry, remounted it from scratch on failure (state reset, its reads rerun), and focus fell to `<body>` | MINOR | CONFIRMED (jsdom and real Edge) | FIXED: retry preloads and swaps only on success; the dashboard stays; focus kept (`aria-disabled`); rows pinned |
| L2-4 | At ≥ 1200 px the in-flow notice pushed CommandDashboardDesktop (`height: 100vh; overflow: hidden`) down: bottom 61 px below the fold | MINOR | CONFIRMED (headless Edge, 1440×900 / 1280×820 / 1200×800) | FIXED: the notice floats (`position: fixed`) with a Dismiss; row pinned |
| L2-5 | The skeleton's `role="status"` arrives holding its text; the framed notice was a new node after a width change | NIT | CONFIRMED (DOM facts only) | Notice half resolved by the fix (the notice is no longer framed, so it is the same node at both widths). Skeleton half ACCEPTED: the hub's live region is S1's (spec §10, phases only) |
| L2-6 | The gate survives a width change, but the framed subtree remounts (no frame on mobile, a div on desktop) | NIT | CONFIRMED | ACCEPTED as a forward note for S1: spec §1 gives the two widths different defaults (Overview vs Loadout), so a breakpoint remount may be wanted. S1 decides |
| L2-7 | The `componentDidCatch` guard could never run | NIT | CONFIRMED | Moot: `componentDidCatch` was removed with the L2-1 fix |
| L2-8 | The default reload binding was untested | NIT | **REFUTED**: the mount guard's source row pinned it | No defect. `reloadPage` is now also exported with a behavioural row |
| L2-9 | The error record lacked the cause's name and stack; an evaluation-time hub error is labelled a load failure, so the header overclaimed | NIT | CONFIRMED | FIXED: the message names the cause, the stack is the cause's, and the header is reworded |
| L2-10 | An import that never settles leaves the skeleton up with no way out | NIT | CONFIRMED | ACCEPTED: S0 adds no timer to the gate (prompt §4). The browser's own reload remains, and S1 can revisit |
| L2-11 | Full `eslint .` reports 3 `react-refresh/only-export-components` errors on the gate | NIT | CONFIRMED (CI `lint:gate` clean; 119 such errors exist across 40 files) | ACCEPTED: development hot-reload only, and the house norm |
| L4-1 | The runway named two of three flip moves; a literal two-step flip reds the registration row with a bare regex; the default-state prose was unlisted | MAJOR | PARTLY: MINOR (house precedent is split; the red lands in the flip PR's own CI, not `main`) | FIXED: THE FLIP MAP lists every move, the registration row has a remedy message, and a row pins the map |
| L4-2 | "Approved by the founder" cited no source while the documents say "proposed" | MINOR | PARTLY: NIT (the claim is grounded in the build prompt) | FIXED: the README row names the instrument and date and explains the documents' own wording |
| L4-3 | On a CRLF checkout the recorded hashes do not reproduce | MINOR | PARTLY: NIT (house-wide; the Practice Field rows share it) | FIXED: "blob SHA-256" wording and an explanation in the README section |
| L4-4 | Nothing pinned the moved elements' props | MINOR | PARTLY: MINOR (1 of 61 props was pinned; all verbatim today; the gap predates S0) | FIXED: the props are frozen from `495ee07b`; killed by A13–A15 |
| L4-5 | The docstring cited a report and a smoke branch not yet in the tree; the pin required the S0 branch name forever | NIT | PARTLY (the report half is a timing artifact; the branch-pin half CONFIRMED) | FIXED: the docstring and pin describe smoke branches generically; this report lands at the cited path |
| L4-6 | The gate's copy sits outside `hub/hubCopy.js` | NIT | CONFIRMED (deliberate, documented, load-bearing) | Recorded as a deliberate deviation (§4 "Copy") |
| L4-7 | The "no module-scope derivation" row could not fail | NIT | **REFUTED**: a plant in the flag module reds it; it matches the cockpitUiFlags precedent | No defect. The row is kept, and a consumer row was added that also catches a load-time derivation in any src module (mutation-checked) |
| L4-8 | The motion-baseline authority called colourless files "token-only" | NIT | **REFUTED**: vacuously true; the Film Room A2 precedent | No defect; the text was made more precise anyway |

Tally for L1, L2 and L4: 14 CONFIRMED, 5 PARTLY, 3 REFUTED. Two of the refuted findings had been acted on before their verdicts arrived (L2-8, L4-8); those edits are harmless and are kept.

### 6.3 The mutating lens (L3) and its refuter

L3 ran last, on its own tree at `7b6a8794`. It tried to make the S0 rows pass over a broken contract. It found **14 surviving mutants**. In every case the shipped code was right and a test row was not tight enough to catch the defect. The L3 refuter, on a fresh tree, re-ran each survivor against 35 test files, including every suite that reads `App.jsx` or walks `src/`, plus `lint:gate`. It refuted none: 11 CONFIRMED and 3 PARTLY. `b62163cf` tightens the rows, and round 3 (§6.4) kills all 18 reproductions.

| ID | Surviving mutant (short) | L3 severity | Refuter | Fix in `b62163cf` (round-3 kill) |
|---|---|---|---|---|
| L3-1 | An early `return legacyDashboard;` (or the desktop equivalent) before a site's `return (`, which drops the boundary, the container and the background with the flag off | MAJOR | CONFIRMED | The dashboard block from the pick to its end is pinned whole (killed) |
| L3-2 | A sibling element inside CommandDashboardDesktop's offset wrapper | MINOR | CONFIRMED | Whole-block row (killed) |
| L3-3 | App aliases the accessor and defines a same-name wrapper with a `?hub` URL override | MAJOR | CONFIRMED (a deliberate evasion shape) | The accessor must be featureFlags' own: un-aliased import, name count 2 (killed) |
| L3-4 | A `?hub=1` URL override inside the picker | MAJOR | CONFIRMED | The picker may touch no global (`window`, `location`, `Date` …) (killed) |
| L3-5 | A shadowing `const dashboardPick` in the mobile block, which puts the hub on every phone with the flag off | MINOR | PARTLY: raised to MAJOR | Whole-block row (killed) |
| L3-6 | App references the hub chunk with a backtick path, a `.jsx` extension or `import.meta.glob` | MAJOR | CONFIRMED | Every string literal naming the hub module, in any form, is found; only the gate's `import()` may exist; planted self-check (killed ×3) |
| L3-7 | The gate rendered through `React.createElement` on another screen | MINOR | CONFIRMED | `CommandCenterHubGate` may appear only in its import and the two tags (killed) |
| L3-8 | A hook re-exported through `hub/hubCopy.js` (`export … from`), so a subscription reaches the hub unseen | MINOR | PARTLY (one variant was killed only by accident, through the firestore mock's surface) | The module walk follows `export … from`; planted self-check (killed) |
| L3-9 | The hub imports `firebase/auth` dynamically and subscribes | MINOR | PARTLY (without a `.catch` it fails the suite by accident; with one it survives) | No `import()` / `require()` anywhere on the hub side; `onAuthStateChanged` added to the activity list (killed) |
| L3-10 | `window.onfocus =` and `matchMedia(…).addListener` at hub module scope; the activity list also missed `queueMicrotask`, BroadcastChannel, WebSocket, EventSource, XHR, `sendBeacon`, `getDocFromServer`, `subscribeTo…` | MINOR | CONFIRMED (13 of 13 planted lines missed) | Activity list widened, with each planted line in a self-check (killed ×2) |
| L3-11 | `onReload={reload}`: the click event reaches `reloadPage` as a "location", so production Reload throws | MAJOR | CONFIRMED (the refuter reproduced the throw) | The Reload row asserts `reload` is called with no argument (killed) |
| L3-12 | The notice's `zIndex` dropped, so it paints and hit-tests under the shells (whose roots are `relative`, z 1) | MINOR | CONFIRMED (by citation) | The row asserts z-index > 1 (killed) |
| L3-13 | The flip map's step 3 names the wrong file | NIT | CONFIRMED | Each step is checked by file name (killed) |
| L3-14 | A `.mjs` file under `src/components/CommandCenter/` escapes the colour and motion directory rows | MINOR | CONFIRMED (no `.mjs` exists in src today) | The directory rows walk `.mjs` / `.cjs` too (killed) |

L3 also reported two non-findings:
- **G4** (drop `HubLoadError`'s `name`) is equivalent: classification uses `instanceof`, and the report's stack is the cause's.
- **P1** (the picker also tests the window width) is near-equivalent to App's own `isMobile`.

L3 also dry-ran the whole flip map (four steps): all 19 files it touches stayed green. So the map is complete for the files it names.

**Review totals across all four lenses: 36 findings. 25 CONFIRMED, 8 PARTLY, 3 REFUTED.** Every CONFIRMED or PARTLY finding that changes code or tests is fixed. Four NITs are accepted with reasons (§7).

### 6.4 Mutation records

**Round 1, at `8b72aaf4`: 40 of 40 killed.** Every mutant is listed with the first row that failed in the session scratchpad record (`mutation-results.json`). They cover the flag (4), the picker (6), the gate (15), the App sites (9), the hub-side activity scan (4) and guard registration (2).

**Round 2, at `f4de3224`: 22 of 23 killed.** The rows killed:
- the gate's new behaviour: per-mount re-report, reporting moved back into the boundary, retry swapping immediately, the retrying label, loader dedupe, Dismiss, notice in flow, `reloadPage`, the cause's stack and name, a throwing report, a failed retry swapping, an unhandled retry failure, `aria-disabled`;
- site trees: the pick before the starfield, the boundary renamed, the shell moved outside the boundary;
- frozen props: one dropped or renamed per element;
- the flip map;
- a consumer reading the constant.

**The one survivor is N5, and it is equivalent.** N5 removes the gate's own `if (retrying) return` double-click guard. The loader already shares the in-flight import, and N6 (removing that sharing) is killed. So a second click cannot start a second import, and N5 changes nothing a user or the network can observe. It stays as cheap defence.

**By hand, at `7b6a8794`:** a load-time `const HUB_AT_LOAD = isCommandCenterHubOn()` planted in `CommandDashboard.jsx` reds the widened consumer row.

**Round 3, at `b62163cf`: 18 of 18 killed.** These are the 14 L3 survivors as 18 mutants, with the multi-variant ones split, each named by the row that now kills it (§6.3). Baseline and after-run: 367 / 367 green across the 9 files.

## 7. Accepted items and notes for later slices

- **L2-5 (skeleton live region), L2-6 (breakpoint remount), L2-10 (never-settling import), L2-11 (dev-only lint rule):** accepted for the reasons in §6.2. L2-6 and L2-10 are S1's to revisit.
- **L4-6:** the gate's copy table is deliberately separate from `hub/hubCopy.js`. When a later slice adds the §11.3 copy guard, it should cover both tables.
- **For separate tasking (not fixed here):** `docs/BUILD_RULES.md:46` says no test imports `App.jsx`. `src/App.xpModal.jsdom.test.jsx:171` does.
- **For S1:** the gate's `frame` wraps only the skeleton and the hub. A hub that needs the same element across a breakpoint crossing should give both sites the same wrapper type.

## 8. The preview branch — NEVER MERGE

**NEVER MERGE.** No PR is opened for this branch. Delete it once the smoke is done.

- **Branch:** `claude/command-center-hub-s0-smoke` at `61c4393e`. That is the build branch's code head `b62163cf` plus one commit that changes one line: `src/config/featureFlags.js:3306`, `COMMAND_CENTER_HUB_ENABLED = false` → `true`.
- **Pins on the build branch:** the `false` value and its pins are untouched there.
- **Docs-only gap:** the build branch's only later commit is this report and its README row, documentation only. So the preview shows the build branch's app with the flag on.
- **Preview URL:** <https://trade-seven-nn4mnr08y-fais-projects-bc179554.vercel.app> (Vercel deployment `7104415556`, ready at 21:09 UTC, Oct 15, 2026).
- **Checked on the served preview:**
  - `index.html` answers 200;
  - the main bundle's picker is folded to the hub (`shell: HUB`);
  - the hub chunk `CommandCenterHub-CrH8N4C0.js` serves the placeholder text;
  - `index.html` does not preload that chunk.

**What to look for**, signed in, on a phone and on a desktop:
- **The dashboard screen** shows the placeholder: the heading "Command Center" and one line saying it is a placeholder. It replaces the dashboard.
- **Around it, unchanged:**
  - the starfield behind it;
  - the bottom navigation on the phone;
  - the sidebar on the desktop, with the placeholder sitting to its right, as the Command dashboard does.
- **The first time**, a short "Loading the Command Center…" line may show while the chunk downloads.
- **Every other screen** is unchanged.
- **What the placeholder does not do:** it reads nothing and changes nothing.

**Red by design on this branch:** the pin row, and the flag-pin guard's contradiction and integrity rows (§5, the flip dry run). A real flip runs THE FLIP MAP in one commit instead.

## 9. Next slice

**S1**: the approved shell, the larger Shadow still, tabs and defaults (mobile opens on Overview, desktop and tablet on Loadout), the persistent strip and the reserved copy, at the four widths. It builds behind the same flag, inside `CommandCenterHub.jsx` and under `src/components/CommandCenter/`. It reads the spec and the design of record from `docs/`, as committed here.
