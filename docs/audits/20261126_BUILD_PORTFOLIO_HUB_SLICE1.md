# Portfolio hub, slice 1 — the switch and the one read (build report)

**Date:** 26 Nov 2026 · **Branch:** `claude/portfolio-hub-s1-switch-and-read` · **Base:** `origin/main` `a88c204a`. `git fetch origin` was the first step, and the base was unchanged at the end. · **Code frozen at:** `a4bb8673` · **Spec:** `docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md` (§3, §4 slice 1; ruling PH-20), committed byte-identical in this branch · **The switch ships off.** Not merged; CI not watched.

| Question | Answer |
|---|---|
| Does a player see anything new? | **No.** With the switch off, as shipped, the app is `main`'s. All 64 non-map files of the production build are byte-identical to `main`'s, hashed names included (§4.3). With the switch on, slice 1 still draws nothing new. The hub draws exactly what it draws with the switch off, for every case of spec §3 and for a book owner (§4.1). |
| Is the switch there? | **Yes.** `COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = false` sits in a zero-import module of its own. It is pinned, and registered in the flag pin guard as dark by design. A dry run of the whole suite shows the flip is four edits and nothing else (§4.4). |
| Is the decision made? | **Yes, with the switch on.** A pure function returns `'book'` only when the switch is on, the read is ready and it carries a book. Every other case is `'today'`. The decision is exposed only as `data-hub-layout` on an invisible wrapper. |
| One read? | **Yes, with the switch on.** The hub's connected shell reads the book once and hands the same read to the entry card, which makes no read of its own. With the switch off, the card reads for itself, as on `main`. |
| Review | Three lenses and a refuter (BUILD_RULES §2). **11 findings:** 10 confirmed, 1 confirmed in part, none refuted outright, 3 re-graded. All 11 are fixed in tests, guards and notes; no source behaviour changed. The battery ran 33 mutants (§5.3). |
| Anything for you? | One question, with a recommendation (§6.2). Everything else stands as built. |

## 1. In plain terms

This slice adds the portfolio hub's switch and nothing a player can see. The switch, `COMMAND_CENTER_PORTFOLIO_HUB_ENABLED`, ships off. With it off, every file players load is identical to `main`'s; only the hub chunk's source map differs, because it carries the edited source text.

With it on, the Command Center reads the player's idea book once, at its connected shell, and decides the layout from that one read. A player whose read came back with a book gets the book layout; every other case gets today's hub. The hub then hands the same read to the Idea book's entry card. The card no longer reads for itself, so the card and the layout can never disagree.

In this slice the decision is drawn nowhere. With the switch on, the hub still looks exactly as it does today, whether or not the player has a book. The decision lives in one invisible place, for tests, and slices 2 to 5 will draw from it.

## 2. Step 0 — the four anchors, against `main` at `a88c204a`

All four still match the Phase 0 report. None forced a stop. Every citation below was read in this session (VERIFIED).

| Anchor | The Phase 0 report | On `main` now |
|---|---|---|
| `src/components/PracticeField/IdeaBookEntry.jsx` | The card makes its own read of the book and draws only when a book comes back. | **Matches.** The read is `useIdeaBook({ enabled: PRACTICE_FIELD_SCREEN_ENABLED })` at `:82`. The card is drawn only for `read.status === 'ready'` with a book (`:106–115`). |
| `src/components/PracticeField/useIdeaBook.js` | One read, keyed by uid, no poll. | **Matches.** The read is keyed by uid and auth epoch (`:60–61`), with no poll. It reads on mount and on a key change (`:91–93`), on `refresh()`, and on the window's focus or visibility (`:94–98`, one read for both). The view version is now 3 (`:21`, from B5 / PR #1117), where Phase 0 had 2. The line moved, but the plan did not need to. |
| `src/components/CommandCenter/sections/ActivitySection.jsx` | The one place the card is drawn. | **Matches.** One import (`:19`) and one render site (`:90`). The section itself is mounted at `CommandCenterHub.jsx:691` (wide) and `PhoneTabs.jsx:132` (the phone's Overview). |
| `src/config/flagPinGuard.test.js` | The flag-source list and the dark-by-design list. | **Matches.** `FLAG_SOURCE_MODULES` is at `:45` (it lists `practiceFieldScreenFlags.js` at `:65`), and `DARK_BY_DESIGN` is at `:75`. |

**One premise of the prompt had moved: PR #1114 is merged.** The prompt asks for PR #1114's two files to be brought in, and for this PR to "supersede draft PR #1114". That PR merged into `main` on 26 Nov at 16:03 UTC (`22b01810`), before this build's base. Its two files are already on `main` with the same blobs (`e709717a`, `efa8130d`; the design file's SHA-256 is `d2e4c95a…e01d02`). So there was nothing to bring in, and this PR supersedes nothing. I added their missing `docs/README.md` rows instead.

## 3. What changed, by file

### 3.1 Source (6 files; every switch read is a literal ternary that folds away with the switch off)

| File | Change |
|---|---|
| `src/config/commandCenterPortfolioFlags.js:23` (new) | `COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = false`. No imports and one export, after `practiceFieldScreenFlags.js`'s shape. Its docstring names the flip's four edits. |
| `src/components/CommandCenter/hub/hubLayout.js:17`, `:25` (new) | The decision, pure: `hubLayoutOf({ read, switchOn = the switch })` returns `'book'` only for `switchOn === true`, `read.status === 'ready'` and a non-null book. `HUB_LAYOUTS` is frozen. It imports only the switch. |
| `src/components/CommandCenter/hub/hubBookRead.js:12` (new) | `HubBookReadContext`, marked `/* @__PURE__ */` so the switch-off build drops it. |
| `src/components/CommandCenter/HubBookScope.jsx:22–31` (new) | The connected shell's book scope. `useIdeaBook({ enabled: IDEA_BOOK_SCREEN_ON })` is called once (`:23`). It decides the layout from that read, provides `{ read, refresh, layout }` (memoised), and renders `<div data-hub-layout={layout} style="display: contents">` (`:28`). It has no effect, timer or listener of its own. |
| `src/components/CommandCenter/CommandCenterHub.jsx:187–188`, `:981–983` | In the connected arm, with the switch on: `<HubBookScope key={site}><ConnectedHub …/></HubBookScope>`. With it off, the arm folds to today's `<ConnectedHub key={site} …/>`. |
| `src/components/CommandCenter/sections/ActivitySection.jsx:20`, `:23–24`, `:79–82`, `:105` | At the card's one site, with the switch on, `HubIdeaBookEntry` reads the scope with React 19 `use()` and hands its read to `IdeaBookEntryView` as props. Outside a scope (a hub with no App object) it is today's `<IdeaBookEntry />`. With the switch off, the site folds to today's `<IdeaBookEntry />`. |
| `src/components/PracticeField/IdeaBookEntry.jsx:90–127`, `:134` | `IdeaBookEntryView({ read, refresh })` is the card's drawing part, handed the read. It is a deliberate second copy of the default export's body minus its one read line (§6.1 R2). The file also re-exports `useIdeaBook` for the scope. The default export (`:137`) is unchanged, byte for byte. |

**Fenced files:** none touched (BUILD_RULES §1). **Fenced functions called:** none. **No other flag changed.** **No player-facing string added.** **No Firestore read or write, no model call, no EODHD call.** The only read is the existing `GET /api/practice-field/book`. With the switch on it moves from the card to the shell.

### 3.2 Guard rows added or moved

| Guard | Row |
|---|---|
| `src/config/flagPinGuard.test.js:67`, `:135–137` | The module in `FLAG_SOURCE_MODULES`. The switch in `DARK_BY_DESIGN`, with its runway note (the flip's edits). |
| `src/components/CommandCenter/commandCenterHub.mount.guard.test.js:671–678` | The switch's module as a `PERMITTED_TERMINALS` entry. It is required: the hub's graph walk would otherwise enter `src/config/`. |
| `…mount.guard.test.js:1454–1457` | `NAMED` export rows. `/PracticeField/IdeaBookEntry` takes `IDEA_BOOK_SCREEN_ON`, `IdeaBookEntryView`, `default` and `useIdeaBook`; `/config/commandCenterPortfolioFlags` takes the switch. |
| `…mount.guard.test.js:1480–1494` | Review P1W-1. **One idea book read in the whole hub:** only `HubBookScope.jsx` takes `useIdeaBook`, and calls it once; only `ActivitySection.jsx` takes the card; nothing takes `useIdeaBook.js` directly. |
| `src/components/CommandCenter/hub/s4Modules.purity.guard.test.js:28–29`, `:90` | The decision module in the hub's purity guard. It may import its switch alone. |
| `src/theme/motion.guard.test.js:280–285`, `src/theme/tokens.guard.test.js:277–282`, both baselines | The three new hub files, registered as hazard 34 requires: every file under `CommandCenter/` is on both lists. The Linux suite caught the code commit without them (§5.2, P1G-1). |
| `src/components/CommandCenter/CommandCenterHub.s3.jsdom.test.jsx:27–29` | That suite pins the switch off, after the screen-on PR's precedent. Its one-agent-read rows count identity reads as renders, and the scope's read is one more (P1G-2). |

The activity guard needed no row: no hub file gained an effect, timer, listener or observer. The copy guards needed none either: no string was added.

### 3.3 Tests

| File | Rows | What they pin |
|---|---|---|
| `src/config/commandCenterPortfolioFlags.test.js` (new) | 4 | The value (its title names none). A plain literal with a `Pinned by:` pointer. No imports, and one export. The guard scans the module and holds it dark, judged from the guard's code, not its comments. |
| `src/components/CommandCenter/hub/hubLayout.test.js` (new) | 19 | The decision, row by row. Switch off with every read state gives `'today'`; on, a ready read with a book gives `'book'`; on, with no book, a 404, a failed first read, idle and loading, each gives `'today'`. A refresh that fails after a good read gives `'book'` (§6.1 R3), and a malformed read `'today'`. Only `true` is on. With no switch handed in, the row is value-neutral. |
| `src/components/CommandCenter/CommandCenterHub.portfolioSwitch.jsdom.test.jsx` (new) | 29 | The connected hub at both sites. **Switch off:** no decision drawn; the card reads for itself, and again on the Overview's return. **Every case of §3, and a book owner:** the hub's drawing inside the scope, and `<body>` outside the host, are what the switch-off render draws (useId renumbered, reduced motion). The same number of reads; the decision on the wrapper. **A book owner:** one read on mount; the card drawn from it; opening the card reads once more; Escape and focus return; the window's focus is one read, never two readers. Also: the card and the decision never disagree; a failed refresh keeps both; a site change starts afresh (R-S1-5); the phone's read triggers in both states (P1W-2); the no-App hub falls back. |
| `src/components/CommandCenter/portfolioHub.flagOffBundle.test.js` (new) | 8 | Switch off, in-memory Vite bundles. The three new modules, imported and unused, bundle to nothing. `ActivitySection.jsx`, `CommandCenterHub.jsx` and `IdeaBookEntry.jsx` (as the hub takes it) each bundle to exactly the code of their text without the slice. Planted leaks are seen (review P1G-4). |
| `src/components/PracticeField/IdeaBookEntry.twoCopies.test.js` (new) | 3 | From the parsed source: the drawing part's body is the default's after its read line, character for character. A change to either copy alone is seen. |
| `src/components/PracticeField/IdeaBookEntry.jsdom.test.jsx` (changed) | 37 (was 23) | The card suite's 14 switch-on rows that mount the card now run against both copies: the default, and the drawing part handed a read. Its six other rows run once (P1T-7). |

## 4. Tests and checks

All at the frozen code head `a4bb8673` unless noted. The full suites ran in WSL (`TZ=UTC`, `--maxWorkers=8`, `flock`), in a worktree of `~/pd-ci` whose `node_modules` lock hash matched (`6d01297094c2`).

| Check | Exit | Counts |
|---|---|---|
| Full Linux suite (`vitest run`), at `17308eb7` (the report's first commit; the commit after it changes only this report's text) | **0** | **1,683 files, 39,109 passed, 0 failed** (197 skipped), 353 s, nothing else running |
| Full Linux suite, at the frozen code head `a4bb8673` | 1 | **39,108 passed, 1 failed** (1,697 files). The red is a load timeout outside this slice: `leagueRawIds.guard.test.jsx`, "every League seat surface", 5,521 ms against its 5 s limit. That run took 777 s against the usual ~360 s, because the battery was running on Windows beside it. The same row passed in the whole-flip run on the same code, and alone (11 of 11, 958 ms). |
| `npm run lint:gate` (WSL) | **0** | at the frozen head `a4bb8673` (and at `aae049b1`) |
| `npm run test:rules` (WSL, Temurin 21, Firestore emulator) | **0** | **48 files, 889 of 889**, at `aae049b1`. The fix round touched no file the rules suite reads. |
| `vite build`, the switch off, against `main` (§4.3) | **0 / 0** | **125 files each; all 64 non-map files byte-identical, hashed names included**; one map differs |
| The flip dry run, whole suite (§4.4) | **0** | the flip's four edits: **39,109 passed, 0 failed** |
| The flip's control, whole suite (§4.4) | 1 | the literal alone: **exactly 3 rows red**, the pin's value row and the flag pin guard's two rows |
| The new and changed rows (Windows, targeted) | 1 | hub, card, config and theme directories: **4,298 passed, 1 failed**. The one red is Windows-only CRLF: `shadowCpuQuoteIntegrityFlags.test.js` (it reads the guard without normalising `\r\n`). It passes 10 of 10 in an LF tree, as CI checks out. |

### 4.1 The test rows, red first

The decision rows, the pin rows and the purity rows were written first and ran red: 4 files failed, because the modules did not exist. The hub suite ran 19 of 25 red before the shell's read existed. The 6 that passed are today's behaviour and the "never two readers" checks, which must pass on `main` too.

### 4.2 The full suite's two reds, found and fixed

The first full Linux suite, at `608803ce`, ran **2 failed of 39,286**: the motion and token guards' "every file under `src/components/CommandCenter/` is on this list (hazard 34)" rows. The three new hub files were not on either list. They are registered in `a2c13838`. The second full suite, at `aae049b1`, ran **39,103 passed, 0 failed** (1,682 files).

### 4.3 The switch-off build against `main` (the B3-9 method)

`main` (`a88c204a`) and the code head were built in **one** LF archive tree, so the source-map paths match. `vite build` on Windows, with `node_modules` as a junction.

- **125 files each, with the same names.** Every hash is the same, so no chunk's content changed.
- **All 64 non-map files are byte-identical.** `CommandCenterHub-3x1Zx0cH.js` is `f0240306…` in both; `index.html` is `25e8dbbc…` in both.
- **One file differs: `assets/CommandCenterHub-3x1Zx0cH.js.map`** (main `7351dff3…`, branch `2113f060…`). It embeds the source text of the three edited files, `IdeaBookEntry.jsx`, `ActivitySection.jsx` and `CommandCenterHub.jsx`. Its 87 sources are the same list; no new module enters the hub chunk. Under ruling B3-9 a source map is not the shipped app.
- **Positive control: the same tree with the switch flipped on.** The hub chunk changes (`CommandCenterHub-CL_kY6EY.js`) and carries `data-hub-layout`; `main`'s carries none. The hash then cascades through the chunks that import the entry. So the comparison can see the new path, and with the switch off it is folded away.
- **Built again at the report's commits**, in the same tree, before the push. At `17308eb7` and at the final head: 125 files with the same names, all 64 non-map files identical to `main`'s, and the hub chunk's map the one difference.

`portfolioHub.flagOffBundle.test.js` now keeps this in CI, module by module (§3.3).

### 4.4 The flip dry run

My notes on flips say "one line and its pin" must be proved, not assumed. So the WSL worktree at `a4bb8673` ran the whole suite twice more. A script applied the edits in place and `git checkout` restored them; the tree was clean after each.

- **The flip, four edits:**
  - the literal to `true`;
  - the pin's value row to `true`;
  - the pin's guard row turned around (`not.toMatch`);
  - the `DARK_BY_DESIGN` entry removed.

  Result: **1,683 files, 39,109 passed, 0 failed.** So the flip PR is those four edits plus the docstring's OFF.
- **The control, the literal alone:** **exactly 3 rows red**: the pin's value row, and the flag pin guard's "every pinned flag matches its live value" and "DARK_BY_DESIGN lists only real, currently-dark flags". So the pins bite, and nothing else depends on the shipped value.

Review P1G-2 had found two more rows that went red with the switch on (§5.2). Both were fixed before this run.

## 5. The review (BUILD_RULES §2)

### 5.1 How it ran

- **Three lenses, each on its own LF `git archive` of `8ec52d6d`, read-only on git:**
  - **P1W**, the switch-on wiring and lifecycle. It included a real-layout check of the wrapper in headless Edge, at 390, 320, 1440 and 834 px.
  - **P1G**, the switch-off guarantee, the guards, the flip and conformance. It ran a flip dry run in its tree.
  - **P1T**, test integrity: 35 mutants on every new row, in its own tree.
- **One refuter on a fourth tree** took all 11 findings and tried to break each with a repro.
- Every tree was restored byte for byte (`cmp` against `git show`), and no agent wrote to git.

### 5.2 Every finding, and what happened to it

| ID | Finding | Refuter | Disposition |
|---|---|---|---|
| P1G-1 | The motion and token guards' hazard-34 rows are red: the three new hub files are not registered. | CONFIRMED, blocker at `8ec52d6d` | **Fixed** in `a2c13838`, which the first full suite had already forced (§4.2). |
| P1G-2 | Flipping the switch reds two rows beyond its pins: s3's "useAgent is called once per render" counts the scope's identity read, and hubLayout's strict-switch row passes `undefined`, which falls back to the shipped literal. | CONFIRMED, re-graded major → minor (the reds would land in the flip PR's own CI) | **Fixed** in `a4bb8673`. s3 pins the switch off (the screen-on PR's precedent), and the strict row drops `undefined`. |
| P1T-1 | The same as P1G-2's second half: a hidden pin on the literal. | (with P1G-2) | **Fixed** (as above). |
| P1G-3 | The runway notes name three flip edits, but the pin test's third row must turn around too. The value row's title named the value. | CONFIRMED, re-graded minor → nit | **Fixed.** The docstring, the pin header and the dark-by-design note name all four edits, and the title names no value. |
| P1T-6 | The same as P1G-3's title. | (with P1G-3) | **Fixed.** |
| P1G-4 | The `@__PURE__` mark that keeps the switch-off build identical is unguarded. Removed, it leaves `createContext(null)` in the hub chunk (+22 B, and 56 renamed files). | CONFIRMED, minor | **Fixed:** `portfolioHub.flagOffBundle.test.js`, 8 rows with planted controls. |
| P1G-5 | The README row claimed "every shipped file is byte-identical", but source maps ship. It also names this report before it existed. | PARTLY, nit (the report arrives in this branch) | **Fixed:** "every non-map file … (ruling B3-9: one source map differs)". |
| P1W-1 | The one-read promise had no static guard. A second hub file taking `useIdeaBook` or the card passes the names row. A read planted on a path the hub suite never mounts passed every guard. | CONFIRMED, minor | **Fixed:** the mount guard's one-read row (§3.2). |
| P1W-2 | With the switch on, the phone's read triggers move. The window's focus reads while the card is off screen, and the Overview's return no longer re-reads. | CONFIRMED, nit: follows from spec §3, not a defect | **Stated** as reading R5 (§6.1) and **pinned** in both switch states. |
| P1T-2 | The scope's `key={site}` is unguarded. | (found while the fix was in flight) | **Fixed** in `aae049b1`: the site-change row, which kills that mutant alone. |
| P1T-3 | "Draws nothing new" was checked only inside the host, so a portal into `<body>` passed. | CONFIRMED, minor | **Fixed:** the parity rows compare `<body>` outside the host too. |
| P1T-4 | The parity rows' anti-vacuity anchor was the shell's opening tag only. | CONFIRMED, nit | **Fixed:** the rows also anchor on the activity section, and on the card for a book owner. |
| P1T-5 | The pin test matched the dark-by-design key as text, so a commented-out entry passed. | CONFIRMED, nit | **Fixed:** it reads the guard's code, with a value-neutral planted sample. |
| P1T-7 | Six card-suite rows ran per copy without ever mounting the card. | CONFIRMED, nit | **Fixed:** they run once, in a describe of their own. |

**Refuted: none outright.** The refuter's corrections are P1G-5, confirmed only in part (the missing report is not a defect), and three re-grades: P1G-2 from major to minor, P1G-3 from minor to nit, and P1W-2 as a stated change rather than a defect. The lenses also refuted claims of their own, recorded as "checked and sound":
- the wrapper changes no geometry, focus, tab order or hit-testing in a real browser at four sizes;
- StrictMode's double read is the hook's own effect, the same with the switch off;
- the context's presence cannot change during a mount;
- the activity sheet adds no reader;
- `hubLayout.js` needs no pure mark, because Rollup already treats `Object.freeze` as pure.

### 5.3 The battery, on the frozen code

The runner and its spec are in the session scratchpad: `battery.mjs` and `battery-spec.mjs` (33 mutants).
- Each mutant is an exact, unique edit to an LF archive of `a4bb8673` (one edit, or a pair). It is run against its rows with a JSON reporter.
- A mutant counts as **killed** only when vitest exits non-zero and named rows fail. A file that fails to load counts as BROKEN, never killed.
- The file is restored byte for byte after each mutant, and every file of the diff was compared with `git show` at the end.
- **Baseline:** 256 rows across the 10 row files, all green.
- **Result:** **32 of 32 killed, none broken or skipped.** M33 is a control and survives by design: s3 stays green with the switch on.

| Mutants | Killed by |
|---|---|
| M01 the card reads for itself under the scope (two readers) · M04 no scope with the switch on · M20 the drawing part ignores the read it is handed | the parity rows and the one-read rows (19, 21 and 17 rows) |
| M02 no fallback card without a scope · M05 the scope unkeyed · M09 no refresh handed down · M10 the scope reads with the screen switch off | the no-App row · the site-change row · the open row · the two screen-off parity rows |
| M03 the card dropped with the switch on · M06 the wrapper draws a box · M07 the wrapper gains an attribute · M27 the scope portals into `<body>` (P1T-3) | the parity rows (10–14 each) |
| M08 the decision from a second read | the mount guard's one-read row and 19 hub rows |
| M11 the scope gains an effect · M25 the switch's terminal lost · M31, M32 a second hub file takes the read, or the card (P1W-1) | the mount guard (activity, graph, one-read rows) |
| M12–M17 the decision: no book check, no status check, a truthy switch, defaults on, an undefined book, unfrozen names · M18 it reads the clock | `hubLayout.test.js` (and the parity rows for M12) · the purity guard |
| M19 the drawing part never refreshes · M21 the default copy drifts | the card suite's handed-read arm · `IdeaBookEntry.twoCopies.test.js` |
| M22 the switch ships on | **exactly** the pin's value row and the flag pin guard's two rows; nothing else moves (the flip's row-level control) |
| M23 the guard stops scanning the module · M24 the guard stops holding it dark · M26 the module gains an import | the pin test |
| M28 the switch-off card site renders the hub variant (runtime-equivalent, so only a bundle sees it) · M29 the context's pure mark off · M30 a module-level statement in the scope | `portfolioHub.flagOffBundle.test.js` |

The lens P1T ran its own 35 mutants on `8ec52d6d`. Its survivors were the unkeyed scope, the portal, the weak anchor, the block-commented entry and the runtime-equivalent site. Each is now killed above (M05, M27, the anchor rows, the pin test's code-only row, M28).

## 6. Readings and questions for the founder

### 6.1 Readings — what I decided where the brief was silent (each stands unless you object)

- **R1 — "at the shell" is a scope around the connected shell.** A hook in `ConnectedHub`'s body cannot fold away with the switch off. So the read sits in `HubBookScope`, rendered at `ConnectedHub`'s one site in the connected arm and keyed by site with it. The other choice was to duplicate `ConnectedHub`'s 20-line return. Later slices read the decision from the scope, inside `ConnectedHub` and the shells.
- **R2 — the card takes the read as props, from a second copy of its body.** Spec §3 says the card takes the read as a prop. The split the prompt suggested ("a reading part and a drawing part") would change the hub chunk with the switch off, so the default export stays byte for byte as it was. `IdeaBookEntryView` is today's body with the read handed in. The two copies are pinned equal from the parsed source, and the card suite runs its switch-on rows against both. See Q-1.
- **R3 — a refresh that fails after a good read stays `'book'`.** `useIdeaBook` keeps the last good answer (`ready`, with the book), and the card keeps drawing it. The spec's "a failed read" is read as the first read failing, which gives `'today'`. Both are pinned.
- **R4 — the "one inert place" is a wrapper, not the hub's section.** A new attribute on the section would change the hub's build with the switch off. `data-hub-layout` sits on a `display: contents` wrapper that exists only with the switch on. A real browser draws the hub inside it identically (P1W's check).
- **R5 — with the switch on, the read follows the shell, not the card.** It reads on the shell's mount and each site change, on the card's open, and on the window's focus or visibility. On the phone, the Overview coming back no longer re-reads, as the card did on each remount. A window focus reads even while the Overview is not shown. The app reads less often; the marks are still as of the last close. Pinned in both switch states.
- **R6 — a hub with no App object has no connected shell.** That is the S1 frames and fixtures. There the card reads for itself, as today.
- **R7 — tightenings.** A ready read whose book is `undefined`, and any switch value but `true`, are `'today'`.
- **R8 — the guard rows beyond the bare terminal.** The prompt said the mount guard should get "the row or rows the shell's new read needs … Add nothing else". Its one strictly required row is the switch module's `PERMITTED_TERMINALS` entry. Three more rows went in, and each only tightens:
  - the `NAMED` export rows for the card's module and the switch's, which spec §6 asks for;
  - the one-read row, from review P1W-1, which pins the read the prompt promises;
  - the s3 suite's switch pin, needed for the flip to stay clean (P1G-2).

  The token and motion guard registrations are hazard 34's own rule for any new hub file.

### 6.2 Questions for you

| # | Question | The fact that forces it | Recommendation |
|---|---|---|---|
| Q-1 | Keep the entry card as two copies until the flip, or split it now and accept a changed hub chunk with the switch off? | The prompt's suggested split, a reading part and a drawing part, changes the hub chunk's code even with the switch off. Measured, the two-copy shape keeps every non-map file byte-identical to `main`. The price is about 40 lines of the card's B3-reviewed open, close and focus logic in two places, held together by `IdeaBookEntry.twoCopies.test.js` and the card suite. | **Keep the two copies.** The flip PR, or a cleanup right after it, makes the default `<IdeaBookEntryView {...useIdeaBook(…)} />` and deletes the copy and its test. |

## 7. Found outside the task (for separate tasking; nothing fixed)

1. **The motion guard's baseline generator rewrites the whole file's escapes.** `GENERATE_MOTION_GUARD_BASELINE=1` re-serialises `motionGuardBaseline.json` with `JSON.stringify`, which writes every escaped em dash the file stores (the six-character backslash-u-2014 escape) as a literal dash: a 288-line diff for three new entries. I restored the file and added the three entries by hand. The token baseline's generator did not do this.
2. **`shadowCpuQuoteIntegrityFlags.test.js:65` fails on a Windows (CRLF) checkout.** It matches `flagPinGuard.test.js` raw, with `\n` in its regex. It passes on LF, as CI checks out. The same class as the CRLF rows already recorded.
3. **`s4Modules.purity.guard.test.js`'s non-vacuity helper sees only function declarations.** An `export const` (such as `HUB_LAYOUTS`) is invisible to it.

## 8. Commits

| Commit | What |
|---|---|
| `f0431c5d` | The spec, byte-identical (SHA-256 `8595d089…f99e582`; its blob `9cf1c7c4` equals `git hash-object --no-filters` of the attachment), and the README rows. |
| `608803ce` | The switch, the decision, the shell's read, the card's drawing part, the guards and the tests. |
| `8ec52d6d` | Test: each hub row starts from an empty idea book store. |
| `a2c13838` | Test: the three hub files registered with the token and motion guards (hazard 34). |
| `aae049b1` | Test: a site change starts the shell and its scope afresh (R-S1-5). |
| `a4bb8673` | The review's fix round, in tests, guards and notes only. |
| (this commit) | This report. |
