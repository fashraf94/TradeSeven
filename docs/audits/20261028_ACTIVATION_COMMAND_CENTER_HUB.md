# Activation record — the Command Center hub, on for every player

Claude Code (Opus 5.5), October 28, 2026, for Flash. The prompt: "FantasyTrades Command Center — the flip: switching the hub on for every player" (prepared October 28, 2026). It authorizes the flip only: `COMMAND_CENTER_HUB_ENABLED` from `false` to `true`, the pins that move in the same commit, and this record. No other code change.

## 1. Verdict

| | |
|---|---|
| **What changed** | `COMMAND_CENTER_HUB_ENABLED = true` (`src/config/featureFlags.js:3455`). Every player who opens the dashboard on the phone or the desktop gets the Command Center hub instead of the legacy dashboards. |
| **The flip commit** | `985bc981f04a7458ac86ccca853f763fe823f762`, five files, one commit, the flag's own flip map (§4). |
| **Rollback** | Revert that one commit (or promote the previous deployment in Vercel). Checked on a scratch copy: the revert applies cleanly, the reverted tree equals `main`'s tree, and the full suite is green there (§5). The legacy dashboards are still in the code and return as soon as the flag is false. |
| **Checks** | Full Linux suite with the flag true: **0 red rows** (`Test Files 1210 passed \| 8 skipped (1218)`). lint:gate exit 0. `vite build` exit 0; the entry chunk differs from `main`'s only by the flag's literal and the one ternary Rollup folds from it (§5.3). The gate's fallback works on a production build at a phone and a desktop width (§6). |
| **Base** | `main` at `9bbe2b1b` (PR #1005), which contains the S8 fix build's merge `65b8632f` (PR #1000). `git fetch origin` ran first. |
| **Branch** | `claude/command-center-hub-flip` (pushed by refspec; the app's local worktree branch is `claude/command-center-hub-flip-a1e8a6`). |
| **Not yet done** | The production deployment and the founder's post-flip checks (§8), and the named device's 60 s readout line (§3, pending the founder's paste). |

## 2. The arc

Spec of record: `docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md`. Every slice was built behind the dark flag and merged with it false.

| Slice | PR | Merge on `main` | Report |
|---|---|---|---|
| S0 — the flag, the picker, the lazy gate and its fallback | #969 | `2ebf1bff` (Oct 15) | `docs/audits/20261015_BUILD_COMMAND_CENTER_HUB_S0.md` |
| S1 — the shell, compositions, Shadow still, area controls | #974 | `1d6d5d4a` (Oct 15) | `docs/audits/20261015_BUILD_COMMAND_CENTER_HUB_S1.md` |
| S2a — the deploy selectors | #978 | `078fe895` (Oct 16) | `docs/audits/20261016_BUILD_COMMAND_CENTER_HUB_S2A.md` |
| R1 — deploy repair: typed outcomes | #979 | `39053aed` (Oct 16) | `docs/audits/20261016_BUILD_DEPLOY_R1_TYPED_OUTCOMES.md` |
| R2 — deploy repair: the hold claim | #985 | `7818a1b3` (Oct 21) | `docs/audits/20261021_BUILD_DEPLOY_R2_HOLD_CLAIM.md` |
| S5 — the Loadout panel | #991 | `eceb58e4` (Oct 22) | `docs/audits/20261022_BUILD_COMMAND_CENTER_HUB_S5.md` |
| S3 — one identity source, the owner-aware poll | #992 | `82ea84bb` (Oct 23) | `docs/audits/20261022_BUILD_COMMAND_CENTER_HUB_S3.md` |
| S2b — the deploy-attempt provider, the hold, the real deploy | #993 | `7d0daf10` (Oct 24) | `docs/audits/20261023_BUILD_COMMAND_CENTER_HUB_S2B.md` |
| S4 — Recent activity | #994 | `27514b1a` (Oct 24) | `docs/audits/20261023_BUILD_COMMAND_CENTER_HUB_S4.md` |
| S6 — the idea reader, "Deploying with" | #996 | `05b73287` (Oct 25) | `docs/audits/20261025_BUILD_COMMAND_CENTER_HUB_S6.md` |
| S7 — Shadow's canvas | #997 | `17b614e8` (Oct 25) | `docs/audits/20261025_BUILD_COMMAND_CENTER_HUB_S7.md` |
| S8 — the independent cumulative review (Claude Fable 5.1, head `05b73287`) | — (committed by the fix build) | — | `docs/audits/20261026_FABLE_REVIEW_S8_CUMULATIVE.md`: **ACTIVATE AFTER FIXES** |
| S8 fix build — every "before activation" item of the review | #1000 | `65b8632f` (Oct 28) | `docs/audits/20261028_BUILD_COMMAND_CENTER_HUB_S8_FIXES.md` |

## 3. Against spec V1.2 §12 and the S8 review's §5 checklist

Spec §12, "Public activation core": *reviewed implementation, cumulative review/build, fidelity/accessibility/device/rollback evidence, deployed build confirmation.* "Public activation useful Research": *intended cohort admitted by current server gate; owned equipped-list records and recorded research observable; gate/error/empty/Forge-return cases pass; payload/read costs accepted.*

| Item | Record |
|---|---|
| Reviewed implementation and cumulative review/build (§12 core; review §5 item 9) | The S8 review's verdict was ACTIVATE AFTER FIXES. Every item it graded "before activation" (S8-11, S8-12, S8-13, S8-14, S8-1, S8-2, S8-3, S8-8, S8-4, S8-9, K-1, K-7 and the focus-return item) is built in the S8 fix build, PR #1000, merged as `65b8632f` before this flip. |
| **The named device** (S7 §12; review §5 item 1; §12 device evidence) | iPhone 16. The founder's check on the S7 smoke preview, October 28, 2026: **pass**. The corner readout's 60 s line, verbatim: **pending — the founder pastes it into this session and it is recorded here in a follow-up commit.** `PHONE_SHADOW` stays `'canvas'` (`src/components/CommandCenter/hub/hubFlags.js:49`). |
| **The entry-point click-through** (S5 §5; review §5 item 5) | The founder, on the S8 fix build's smoke preview, October 28, 2026: **pass**. |
| **The S6 and S8 smoke checklists** (review §5 item 3, in part) | The founder, October 25–28, 2026: **pass**, except the live look at "Deploying with", which needs the founder's Deploy card in a ready state. It is checked on production after the flip (§8, item 3). |
| **The Research cohort** (spec §12 "useful Research"; review §5 item 2) | Idea records stay gated by `HYPOTHESIS_RECORDS_ENABLED` and the server's cockpit allowlist, which the pilot arc owns. At activation the admitted cohort is the founder and the FT_QA tester. Every other account sees the panel's honest "Research records aren't available on this account" state, with no idea rows and the neutral loadout label. The founder accepted this state for the public hub on October 28, 2026. Widening the cohort is the pilot arc's decision and needs no hub change. The tester's view is checked on production (§8, item 2). |
| **Q-S5-3, the backing entries** (review §5 item 6) | `BACKING_BETA_ENABLED` is false: no action. If backing switches on before the hub carries its two entries (ScoutingLine, BackingStatsEntry), that flip carries them. |
| **Q-S4-5, the trait slot** (review §5 item 7) | `TRAIT_SLOT_ENABLED` is false. Its Activity rows ("Adjustment equipped") are reconciled with the Loadout card when that flag flips. |
| **The flip's pin reconciliation** (review §5 item 8) | Done in the flip commit, in the five files the review named (§4). |
| **Rollback evidence** (§12 core) | The revert of the flip commit, checked on a scratch copy (§5.2). |
| **The gate's fallback on a forced chunk failure** (review §5 item 4, in part) | Checked on a local production build at 390 and 1440 px (§6). On the deployed build it is the founder's (§8). |
| **Deployed build confirmation** (§12 core; review §5 item 4) | Left for the founder (§8). |

## 4. The flip commit

`985bc981f04a7458ac86ccca853f763fe823f762` — "flip: COMMAND_CENTER_HUB_ENABLED false → true (the Command Center hub for every player)". Five files, +269 / −63. Nothing under `api/`, no fenced file (BUILD_RULES §1), no `firestore.rules`, `vercel.json` or package file; the one product file is `featureFlags.js`.

| File | Change |
|---|---|
| `src/config/featureFlags.js` | `:3455` the constant → `true`. The docstring's state lines read the live state: `:3403` "LIVE — the shipped state is TRUE", `:3418` "When FALSE (the rollback state)". `:3434` the RUNWAY paragraph records the activation on this date; `:3440` the rollback instruction; `:3445` the flip map, unchanged, which a rollback runs in reverse. |
| `src/config/commandCenterHubFlags.test.js` | `:51` the pin row asserts `true` ("LIT by the founder's flip PR"); `:54` the accessor row's title ("reads the live value"); `:117` the registration row turned around: the `DARK_BY_DESIGN` entry is gone. The file's header reworded to the live state. |
| `src/config/flagPinGuard.test.js` | The flag's `DARK_BY_DESIGN` entry and its note dropped; `:140` an "intentionally ABSENT" comment in their place, as every earlier deliberate flip left. |
| `src/App.bootOrder.jsdom.test.jsx` | Branched on the flag (§7): `:90–91` the accessor mocked per state; `:119` a probe of the hub gate beside the legacy shell's; `:214` both rows run with the hub off (the rollback state) and on. |
| `src/App.activeBattlesPoll.owner.jsdom.test.jsx` | Branched on the flag (§7): `:127–128` the accessor mocked, false unless a describe turns it on; `:169` the hub gate's probe; `:292`, `:341`, `:377` the nine rows as S3 wrote them, the hub off; `:434`, `:486`, `:510` a sibling for each, the hub on. |

**Rollback:** `git revert 985bc981` — one commit. It restores the flag, both pins, the `DARK_BY_DESIGN` entry and the two App suites to `main`'s bytes.

## 5. Checks

Linux in a worktree of `~/pd-ci` (`~/pd-ci-hubflip`, Node 20.20.2, lockfile `22fa2b71904c`), `TZ=UTC`, `--maxWorkers=8`, each full suite alone under `flock /tmp/pd-suite.lock`. The worktrees are removed at the end.

### 5.1 The flip head, `985bc981`

| Check | Result |
|---|---|
| Full suite, flag true | Exit 0. **`Test Files  1210 passed \| 8 skipped (1218)`**; `Tests  26689 passed \| 89 skipped (26778)`; 262 s. 0 red rows. |
| The two App suites in that run | `App.bootOrder.jsdom` 4 of 4 passed (2 hub off, 2 hub on); `App.activeBattlesPoll.owner.jsdom` 18 of 18 (9 hub off, 9 hub on). Every row ran; none skipped. |
| `npm run lint:gate` | Exit 0, no output (`--max-warnings 0`). |
| `vite build` | Exit 0. Entry `index-BC7SU5O7.js` **4,830,278 B**; hub chunk `CommandCenterHub-2Kt9wYVU.js` 151,505 B. |
| `DeployAttemptContext.flagOff.jsdom` | 7 of 7. Its first row reads the shipped flag and, as S2b wrote it, returns early once the flag is true; its injected-false row still pins the pass-through. |

### 5.2 Rollback

On the scratch worktree at the flip head: `git revert --no-commit 985bc981` exited 0 with no conflict; 5 files, +63 / −269; the flag reads `false` at `:3444`; the reverted index equals the tree of `9bbe2b1b` (`git diff --cached --quiet 9bbe2b1b` true). Full suite there, exit 0: **`Test Files  1210 passed \| 8 skipped (1218)`**; `Tests  26678 passed \| 89 skipped (26767)` — the 11 fewer rows are the hub-on siblings the revert removes. The scratch worktree was then reset to the flip head and discarded.

### 5.3 The entry chunk against `main`

| Build | Entry chunk | Raw | gzip -9 | Hub chunk |
|---|---|---|---|---|
| `main` `9bbe2b1b` (flag false) | `index-B-0lVStm.js` | 4,830,273 B | 1,296,000 B | `CommandCenterHub-B8Hqh7kk.js` 151,505 B |
| Flip `985bc981` (flag true) | `index-BC7SU5O7.js` | **4,830,278 B (+5)** | 1,295,976 B (−24) | `CommandCenterHub-2Kt9wYVU.js` 151,505 B |

The flag is a constant, so the code differs only where the constant reaches it. Unminified builds of both (`vite build --minify false`), compared with every chunk-name hash masked, differ in exactly **two lines**:

1. `const COMMAND_CENTER_HUB_ENABLED = false;` → `true;` (the literal);
2. in `pickDashboardShell`, `shell: legacyShell` → `shell: DASHBOARD_SHELLS.HUB`. Rollup carries the constant through the picker's one call site (`hubOn: isCommandCenterHubOn()`) and folds `hubOn === true ? HUB : legacyShell`. The `legacyShell` field the gate falls back to is still computed, and the legacy elements are still decided from their own constants (S8-1).

The minified chunks also differ at 1,804 places, all renamed identifiers: every lazy chunk's file-name hash changed (they import the entry, whose hash moved), and esbuild assigns short names by character frequency, so names reshuffle. The +5 B is that renaming plus line 2.

## 6. The gate's fallback on a production build

A production `vite build` of the flip commit's own `index.html` and `src/main.jsx` (flag true as committed), served by `vite preview`, signed in through the S8 harness's stubs (`firebase/*`, `firebase/config`, `UserContext`, `useAgent` with `hasAgent`, `fetchWithAuth`, `agentDeploy`, `dueIdeaCheck`, `ownedBattleRead`, `agentBattleVerify`, `useDeployTargetProgress`, `useHubCompletedBattles`, `marketSchedule`). Headless Edge 156.0.4314.50 through `playwright-core`; every non-localhost request aborted. The request for the hub chunk (`/assets/CommandCenterHub-*.js`) was aborted, then the block lifted and Retry pressed. This is the one check of the gate with the flag true in a production build; it is not a review lens.

| | Phone, 390 × 844 | Desktop, 1440 × 900 |
|---|---|---|
| Hub chunk blocked | 1 request, aborted | 1 request, aborted |
| On screen | The legacy phone shell (`CommandDashboard`: "GOOD EVENING, FLASH · Command", the 01 READ card, "Open agent record") under the notice | The legacy desktop shell (`CommandDashboardDesktop`: "GOOD EVENING, FLASH · Command Center · 01 READ 02 EQUIP 03 DEPLOY 04 MANAGE 05 REVIEW") under the notice |
| The notice | `role="alert"`, `position: fixed`: "Couldn't load the Command Center, so this is your current dashboard." with **Retry**, **Reload page**, **Dismiss** (×) | The same |
| Logged | `[CommandCenterHubGate] the hub chunk failed to load; rendering the legacy dashboard: HubLoadError …` (once); no page error | The same |
| Block lifted, Retry | 1 request, served; the hub on screen (`data-hub-site="mobile"`, width 390, composition `phone`); the notice gone | 1 request, served; the hub on screen (`data-hub-site="desktop"`, width 1376 inside the sidebar offset, composition `desktop`); the notice gone |

Screenshots of all four states were inspected; they and the run's JSON stay in the session scratchpad.

## 7. The two App suites, row by row

The flag-on dry runs since S3 named these 11 rows. None is deleted. Each row that pinned the hub-off App keeps pinning it with the accessor `isCommandCenterHubOn` mocked false — the rollback state, which stays tested — and a sibling pins the same behaviour with the hub on. The mock is the accessor, the one seam every reader calls (App's pick, the hub chrome predicates, the deploy provider), so the hub-off rows see the whole rollback state: the legacy shell, the pass-through deploy provider, and the floating ClashBot button and season banner no longer withheld. With the hub on, the gate is a probe that records the hub object App hands it.

### `src/App.bootOrder.jsdom.test.jsx` — 2 rows → 4

| Row | Hub off (rollback state) | Hub on (sibling) |
|---|---|---|
| a restored session, Firebase still initialising at mount | The legacy desktop shell's first render sees `{ resolved: true, uid: 'uid-A', authEpoch: 1 }`; the poll runs once | The hub gate's first render sees the same identity; the poll runs once |
| a form login from a signed-out start | The legacy shell's first render sees `authEpoch: 2`; the poll runs once | The hub gate's first render sees `authEpoch: 2`; the poll runs once |

Each row also asserts which shell the flag picked.

### `src/App.activeBattlesPoll.owner.jsdom.test.jsx` — 9 rows → 18

The hub has no `onCreateAgentBattle` of its own (its deploy reaches App's through the deploy provider), so a sibling that needs a list seeds it with the poll's own answer.

| Row (hub off, unchanged body) | Hub-on sibling |
|---|---|
| the poll runs once at mount and once per 120 s, and nothing else starts it | Same schedule with the hub gate on screen: 1 → 2 at 120 s → 4 at 360 s, 4 failed runs |
| a deploy's entry stays through a failed run: the list is never blanked on an error | A list the poll answered (`bb_1`) stays, the same array, through a failed run |
| the hub off, App holds exactly one auth listener | The hub on, App still holds exactly one (the live deploy provider subscribes to the identity source, not to Firebase) |
| the same owner's identity answering again changes nothing | The same, on a poll-seeded list: no clear, no extra run |
| an account switch clears the former owner's games at once, and the poll runs at once for the new owner | The same, through the hub object's list |
| a sign-out clears the former owner's games at once | The same, through the hub object's list |
| A→B while A's query is out: its answer never lands; B's does | The same, through the hub object's list |
| A→B→A while the first A query is out: the A@1 answer is dropped, the A@3 answer lands | The same, through the hub object's list |
| a sign-out while A's query is out: its answer never lands | The same, through the hub object's list |

### Mutants

Each mutant was planted alone in an LF `git archive` snapshot of the flip commit, its suites run, and the file restored byte-exact (sha256 compared). The unmutated snapshot passed the same four files first (36 of 36).

**13 planted, 13 killed, none broken.** Each killed exactly the rows it names.

| Mutant | The defect | Rows that failed |
|---|---|---|
| MP1 | The flag literal back to `false` | The pin row (`commandCenterHubFlags`); the guard's "every pinned flag matches its live value" |
| MP2 | The `DARK_BY_DESIGN` entry re-added while the flag ships true | The turned-around registration row; the guard's `DARK_BY_DESIGN` integrity row |
| MB1 | bootOrder: the accessor mock always true | Both hub-off rows (2 of 4) |
| MB2 | bootOrder: the accessor mock always false | Both hub-on rows (2 of 4) |
| MB3 | App: the dashboard before Firebase's first answer (`screen` starts `'dashboard'`) | All 4: both states |
| MO1 | owner: the accessor mock always true | All 9 hub-off rows |
| MO2 | owner: the accessor mock always false | All 9 hub-on rows |
| MO3 | App: the hub object's `activeBattles` is not App's list | The 6 hub-on rows that read a list (the schedule and listener rows read none, and the sign-out-while-out row expects an empty list) |
| MO4 | App: an identity change no longer clears the former owner's list | The account-switch and sign-out rows, both states (4) |
| MO5 | App: the capture check before the list is set removed (a stale completion lands) | The three stale-completion rows, both states (6) |
| MO6 | App: the poll every 60 s instead of 120 s | The schedule row and the failed-run row, both states (4) |
| MO7 | App: a failed run blanks the list | The failed-run row, both states (2) |
| MO8 | The live deploy provider adds its own Firebase auth listener | The hub-on one-listener row only (with the hub off the provider is a pass-through, so the hub-off row rightly stays green) |

## 8. Deployment and the post-flip checks

Left for the founder.

| | |
|---|---|
| Production deployment's sha | |
| Deployed at | |
| 1. The hub on the phone and on the desktop, on the founder's account and on the tester's | |
| 2. The tester's account shows "Research records aren't available on this account" and the neutral loadout label | |
| 3. "Deploying with: {statement} · N names" on the founder's Deploy card once it reads "Ready to deploy"; N matches the Loadout card | |
| 4. One real deploy from the hub, when a game is affordable: the ceremony, the game appearing with his games, Shadow's processing look while it submits | |
| 5. "Report a bug" opens | |

If anything is wrong on production: revert the flip PR (one commit) or promote the previous deployment in Vercel. After production is confirmed: delete the never-merge smoke branches (`claude/command-center-hub-*-smoke`, and `claude/deploy-r2-*-smoke` if any) on the remote, and fill this section in a docs-only follow-up commit.

## 9. Notes

- `src/App.activeBattlesPoll.hub.jsdom.test.jsx:13–15` still says the flag "stays false and its dark pin … is not touched". That suite forces the hub on through the picker and passes with the flag true; the comment is now stale. It is outside the flip's five files, so it is left for a later tidy.
- The flip touches no file the review or the prompt fenced, and adds no new import into `src/components/CommandCenter/` (the mount guard, 62 of 62).
