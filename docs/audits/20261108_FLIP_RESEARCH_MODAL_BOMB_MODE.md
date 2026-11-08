# Flip: Bomb mode → allowlist (PR A); → on held (BF-3 STOP)

**Date:** 2026-11-08. **Model:** Claude Opus 5.5, one local Claude Code session in the desktop app's worktree `.claude/worktrees/bomb-mode-allowlist-flip-e30aa5` (local branch `claude/bomb-mode-allowlist-flip-e30aa5`), pushed by refspec as **`claude/bomb-mode-allowlist`**. **Brief:** "Flip: Bomb mode → allowlist now, → on after one live session" (the founder's rulings BF-1 to BF-5, Nov 7, 2026).

**Preamble.** `git fetch origin` ran first. `origin/main` was `8d1c9452` (the merge of PR #1033), which contains PR #1031's merge (`6cdf09a3`, Build A, Bomb mode), so the brief's first STOP does not apply. The worktree was clean on `8d1c9452`. Read first, as the brief asks: `docs/BUILD_RULES.md`; the Build A report `docs/audits/20261107_BUILD_RESEARCH_MODAL_A_BOMB_MODE.md` (§0, §6, §13, §14); the spec `docs/specs/RESEARCH_MODAL_BUILD_A_BOMB_MODE_SPEC_V1.md` (§4.1 and the rulings of 2026-11-07); the last flip's report `docs/audits/20261107_BUILD_ARMORY_FLIP.md` (its red-row pattern, its §12 CI fixes, its WSL trees). Fenced files (BUILD_RULES §1): none edited, none called. No production read or write.

**The founder merges. Nothing reaches players until he does.**

---

## Executive verdict

| # | Item | Result |
|---|---|---|
| 1 | **PR A** (`'off'` → `'allowlist'`) | **Built, ready for the founder's merge (not a draft).** One flip commit, `c2c34534`: the literal `'off'` → `'allowlist'` (`src/config/researchModalFlags.js:58`) with its pin, the BF-2 rollback words in three places, and one pin row that holds them together. 3 files, +34 / −13. Then this report. Branch `claude/bomb-mode-allowlist`. |
| 2 | **PR B** (`'allowlist'` → `'on'`) | **Not built. BF-3 STOP.** The repo cannot show that measured scoring is on for every account: the switch is a production document, and the last committed record says it covered 2 owners (§2). |
| 3 | **BF-3** | **STOP before PR B.** The switch is the Firestore document `stockThresholdControl/admission`, not code. Its value is outside the repo. The commits that made "everyone" possible are `024a6e9f` (Oct 25, `{ mode: 'all' }`, merged in PR #995 at `7e15d5d5`, Oct 25). No commit turns it on. A battle runs one session at most, ending by 8:00 PM ET on its session day (§2). |
| 4 | **BF-4** | **The mechanism, from the code:** a server-only list, the Vercel environment variable `COCKPIT_ALLOWLIST_UIDS`, read per request. No claim, no client list, no other path admits anyone. **The count is not in the code.** The committed records name **2 accounts: the founder and FT_QA**. Nothing in the code admits anyone else, so no STOP (§3). |
| 5 | **Red rows, PR A** | **0 red rows in either suite** with `'allowlist'`: default 29,782 rows, emulator 666 rows, both exit 0. Only the pin moved. The two mode-off goldens stay as kill-switch rows (they already hold `'off'`). Why nothing went red: §4. |
| 6 | **Kill switch build** | Head with the literal back to `'off'` against `main`: **0 of 57 non-map files differ** (raw `diff -rq`, maps excluded, hashed names included). No docstring line shows up (§5). |
| 7 | **Value-only build** | Head against `main` with only the literal set to `'allowlist'`: **0 of 57 differ**. Against `main` unchanged, the one content difference is the entry chunk's `const RESEARCH_MODAL_BOMB_MODE = "off"` → `"allowlist"` (§5). |
| 8 | **Suites** | Linux, `TZ=UTC`: full suite **exit 0** (`Test Files 1348 passed | 8 skipped (1356)`, `Tests 29693 passed | 89 skipped (29782)`); `npm run test:rules` **exit 0** (35 files, 666 rows) with `'allowlist'` and again in the kill-switch state; `lint:gate` exit 0; minified build exit 0 (§5). |
| 9 | **Mutation** | **8 of 8 killed**, every file restored byte for byte (SHA-256): the literal changed (both ways) fails the pin row; `'allowlist'` on without the verdict fails 4 rows (gate) and 2 (hook); `'allowlist'` on for a mount with no agent battle fails rows at the gate, both bench mounts and the hook (§6). |
| 10 | **Review threshold** | **Under it.** The cumulative diff against `main` is **4 files, +235 / −13 = 248 lines** (the flip: 3 files, +34 / −13; this report: 201 lines). BUILD_RULES §2 asks for a review at 10 files or 1,500 lines, so none is required. |

---

## §0 The rulings (Nov 7, 2026)

| # | Ruling | Built |
|---|---|---|
| BF-1 | Two PRs, one flag: PR A moves `'off'` → `'allowlist'` with its pin in one commit; PR B moves `'allowlist'` → `'on'` with its pin on top of A, a draft, opening with "Contains PR A. Merge only after PR A, and after the founder's live session on the allowlist is clean." | PR A: one commit, `c2c34534` — the literal (`src/config/researchModalFlags.js:58`), its pin (`researchModalFlags.test.js:34-37`), the docstring (`researchModalFlags.js:41-53`), the guard's note (`flagPinGuard.test.js:284-294`) and the BF-2 row (`researchModalFlags.test.js:61-67`); 3 files, +34 / −13. **PR B is not built**: BF-3 did not pass (§2), and BF-3 says to build PR A only and STOP. |
| BF-2 | The flag stays a kill switch. Rollback is the literal and its pin, one step at a time. Every mode-off arm stays. The cleanup PR comes after `'on'` has run in production. The rollback story is written once, in the same words, in the docstring, the pin row's title and the guard's note. | The words: *"a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production"*. They appear in `src/config/researchModalFlags.js` (the `ROLLBACK:` line), the pin row's title in `researchModalFlags.test.js`, and the `RESEARCH_MODAL_BOMB_MODE` note in `flagPinGuard.test.js`. A new pin-file row asserts that all three carry them (comment wrapping read as spaces). The docstring names the cleanup's four items (the unreachable legacy ladder code, the dead `setMarkers` call, the mode-off arms, the spec's §8 smoke list). Nothing is deleted. |
| BF-3 | The measured-scoring gate, read-only, before PR B. | §2. **STOP before PR B.** |
| BF-4 | Who `'allowlist'` reaches. | §3. 2 accounts by the records: the founder and FT_QA. No uid here or in the PR. |
| BF-5 | What `'on'` changes beyond battles (the draft, acquire and watchlist modals lose the Bomb tab; the legacy Film Room loses 💣 and opens on Analysis and 1D). | For PR B's description. PR B is not opened (BF-3), so it is recorded here for when it is: §8. Under `'allowlist'` those mounts keep today's behaviour, because a mount with no agent battle resolves off (`bombModeGate.js:42-46`, rows in §5). |

---

## §2 BF-3: is measured scoring on for every account? (read-only)

**Finding: the code and the git history cannot show it, and the last committed record says no. STOP before PR B.** Everything below was read in this session (VERIFIED) unless marked.

**The switch, and its current value.**

- The code flag `STOCK_MEASURED_THRESHOLDS_ADMISSION_ENABLED = true` (`src/config/featureFlags.js:3413`) only lets the server look for a switch. Its own comment says the server control document `stockThresholdControl/admission` "is the only on-switch" (`:3404-3411`). VERIFIED.
- The switch is that Firestore document (`api/_utils/stockThresholdPolicyRegistry.js:13`). At each tiered creation, `prepareStockCreation` reads it (`api/_utils/stockThresholdAdmission.js:52`). A battle is measured only when `stockAdmissionSelects(control, ownerId)` holds (`:58`): a valid schema-2 control whose audience is exactly `{ mode: 'all' }` (`stockThresholdPolicyRegistry.js:20`) or an allowlist naming the owner (`:31-32`). Otherwise the battle is created on the legacy model. VERIFIED.
- **Its current value is a production fact, not a code fact.** The brief forbids production reads, so it is not read here. The last committed word is the cleanup report of Oct 28, read about 14:17 UTC: "measured thresholds are on for 2 allowlisted owners only; `enable --all` has not been run" (`docs/audits/BAGGERBOMB_THRESHOLDS_CLEANUP_BUILD_REPORT_20261028.md:4`). VERIFIED (the file).
- ASSUMED, not a repo record: a session note on this machine records `enable --all --apply` at **2026-10-28T19:23:58Z** (control epoch 2, audience all). No commit records it, and it may have changed since. The founder settles it with one read: `node scripts/stock-threshold-pilot-control.mjs show` (it should print `enabled: true`, `audience: { mode: 'all' }`).

**The commit that made "everyone" possible (not the turn-on).** `f3b01be6` (2026-10-15) moved the switch into the control document and set the flag `true`. `024a6e9f` (2026-10-25, "BR-4 audience all") taught the registry `{ mode: 'all' }`, and PR #995 merged it at `7e15d5d5` (2026-10-25 17:52 CT). The turn-on itself is a write to the document by `scripts/stock-threshold-pilot-control.mjs enable --all --apply`, which no commit can record. VERIFIED (`git log -S`).

**Where measured scoring never reaches, even at `{ mode: 'all' }`.**

- **Tournament (League) battles.** `prepareStockCreation` returns null unless `gameMode === 'baggerbomb_agent'` and `duration === 'fullday'` with an opponent (`stockThresholdAdmission.js:48`). League battles are `baggerbomb_tournament` (`src/constants/agentGameModes.js:37`) and have no opponent, so they are always legacy (`stockModelRoute` → `'legacy'`, `src/utils/stockThresholdModel.js:27`; Bomb mode then gives every held stock the held line, `selectBombRecord.js:164`, `:205`). **Reach:** with `LEAGUE_BATTLEVIEW_ROUTING_ENABLED = true` (`featureFlags.js:266`), a League battle opens in the League Arena (`src/screens/BattleViewScreen.jsx:30-40`), which mounts no research modal. So the main path never shows it. `AgentBattleScreen` still has League branches (`:1792`, `:2643`), and a League battle reaching it by another path would show the held line on every stock. That path is not proven here.
- **A control that cannot be read.** An unreadable control makes that one creation legacy, with a warning in the log (`stockThresholdAdmission.js:52-56`). Every other failure of a selected creation is a retriable refusal, never a legacy fallback (`:59-71`).

**The longest an agent battle runs.** One session. Every agent battle is a full-day battle (`AGENT_BATTLE_DURATION_MODE = 'fullday'`, `api/_utils/agentBattleService.js:41`; the multi-day branch at `:132-137` is unreachable). A tiered battle's expiry comes from `tieredFullDayTarget` (`src/utils/stockAdmissionWindow.js:66-74`, through `agentBattleService.js:128`). From 45 minutes before a trading day's close, or on a weekend or holiday, it plays the next session (`LATE_DAY_START_MINUTES = 45`, `:26`). It ends at that session's close, or at the Night Game close, **8:00 PM ET**, for a roster holding crypto on a regular day (`NIGHT_GAME_CLOSE`, `:22`). VERIFIED.

**So, the date after which no live tiered battle scores stocks the legacy way.** If the ASSUMED turn-on at 2026-10-28T19:23:58Z (3:23 PM ET, inside the late-day window) holds, the last legacy tiered battle played the next session, **Thu Oct 29, 2026**, and ended by 8:00 PM ET that night. Since then every new tiered battle is measured, except for a creation that could not read the control. **League battles never are.** The first date rests on a record outside the repo, so the gate is not settled from the code and the git history. By BF-3's letter, PR A is built and the session STOPS before PR B.

**What would let PR B proceed.** The founder runs `show` and confirms `enabled: true` with `audience: { mode: 'all' }`, and rules on League battles. A League battle reached in the Battle View would read the held line on every stock under `'on'`. The founder can accept that, since the main League path never shows the modal, or ask for a mount rule first.

**For the allowlist (PR A) this changes nothing.** The founder and FT_QA were the measured pilot's allowlist from Oct 16 (`docs/approvals/BAGGERBOMB_STOCK_THRESHOLDS_V2_PILOT_20261015.md:88`), so their new tiered battles are measured whether the audience is the pilot list or `all`. The live-session checklist (§9) still lists the held line on a League or older battle.

---

## §3 BF-4: who `'allowlist'` reaches (read-only)

**The mechanism (VERIFIED, from the code).**

1. Under `'allowlist'`, Bomb mode is on for an **agent battle** only (`bombModeOn`, `src/components/Research/BombMode/bombModeGate.js:42-46`), and only on a definite yes.
2. The yes is the battle owner's `allowlisted` answer from `GET /api/agent/cockpit-status` (`useBombModeForBattle.js:13-37`, through the Film Room gate's cached verdict, `src/utils/filmRoomGate.js:116-131`). It is asked once per owner per page life, and only once the battle names its owner. Anything but a 200 with `allowlisted: true` reads off (`filmRoomGate.js:76-91`).
3. The endpoint answers only for the caller's own battle (`api/agent/cockpit-status.js:94`, 403 otherwise), with `allowlisted: isCockpitOwnerAllowlisted(battle.ownerId)` (`:97`).
4. `isCockpitOwnerAllowlisted` (`api/_utils/callRecords/mode.js:64-71`) is true only when the owner's uid is in `readCockpitAllowlist()`. That reads the environment variable **`COCKPIT_ALLOWLIST_UIDS`** at call time (`api/_utils/callRecords/allowlist.js:28`, `:47-53`), comma-separated and trimmed (`:36-39`).

So the mechanism is **a list in the server's environment**: no claim, no client constant, no admin bypass. No `src/` module may import the list (`allowlist.js:23-25`, pinned by its test), and the client never sees a uid. Under `'allowlist'`, a player who is not admitted sends one extra `cockpit-status` GET per page life (when the Film Room has not already asked) and sees today's modal.

**The count and the labels.** The list lives in Vercel's production environment, which the code does not hold and this session did not read. `.env.local` on this machine does not define it (checked by name only). The committed records name **2 accounts, the founder and FT_QA**: the Film Room cards activation record (`docs/audits/20261029_ACTIVATION_FILM_ROOM_CARDS_ALLOWLIST.md:9`, "the founder and FT_QA") and the cockpit's week-1 read (`docs/audits/20261009_COCKPIT_LIVE_WEEK1_READ.md:4`, "the two allowlisted accounts"). ASSUMED for today's production value. **Nothing in the code admits anyone else**, so there is no STOP. The founder can confirm in Vercel → Settings → Environment Variables → Production → `COCKPIT_ALLOWLIST_UIDS` (two entries). No uid appears in this report or the PR.

---

## §4 The rows that went red (PR A)

**None, in either suite.** The sweep ran on the flip commit's exact tree (`6fe136ac`, the tree `39d507e0` that `c2c34534` carries unchanged), with the literal `'allowlist'` and its moved pin, on Linux (WSL, Node 20.20.2, `TZ=UTC`):

| Suite | Command | Result with `'allowlist'` | Red |
|---|---|---|---|
| Default | `vitest run --maxWorkers=8` under `flock /tmp/pd-suite.lock` (the `vitest (unit)` job's command, this machine's worker count) | **exit 0**, `Test Files 1348 passed \| 8 skipped (1356)`, `Tests 29693 passed \| 89 skipped (29782)`, 234 s | **0** |
| Emulator | `npm run test:rules` (the `firestore rules + emulator suites` job's command; Temurin JDK 21.0.13) | **exit 0**, `Test Files 35 passed (35)`, `Tests 666 passed (666)`, 144 s | **0** |

| Disposition | Rows |
|---|---|
| Kill-switch row (held `'off'` by mock) | 0 new. The two mode-off goldens already hold `'off'` in their own mocks (`AssetResearchModal.bombModeOff.golden.test.jsx:29-30`, `AgentBattleScreen.bombModeOff.golden.test.jsx:31-32`) and stay as kill-switch rows, unchanged and green (8 and 4 rows). |
| Rewrite | 0 |
| Delete | 0 |
| Pin moved | 1, the pin row (`researchModalFlags.test.js`), in the flip commit |

**Why nothing went red (checked, not assumed; an all-green sweep can mean the edit never landed).** The swept tree's literal read `'allowlist'` (`researchModalFlags.js:58` in the tree), the moved pin row ran and passed (it fails on any other value: mutant P1, §6), and the run covered every row (`numTotalTests` 29,782, 0 failed). Every suite that names the flag holds it in its own mock: a getter (`useBombModeForBattle.jsdom`, `bombModeMounts.jsdom`, `AgentBattleScreen.bombModeOn.jsdom`, `AssetResearchModal.bombModeOn.jsdom`, `bombModeGate.test.js`) or a fixed `'off'` (the two goldens). Build A wrote them that way (Build A spec §6). The suites that render the Battle View without naming the flag (`AgentBattleScreen.flagOff.golden`, `.controller`, `.controller.jsdom`, `.flagOff.tape.jsdom` and others) now take the allowlist path. That path asks the verdict once the battle names its owner and resolves off until a yes arrives (`useBombModeForBattle.js:20`, `:33-37`). None of those suites asserts the absence of that ask, so the extra request reddens nothing, and none of them is admitted, so their screens stay the mode-off screen.

**The one wire difference, for every owner.** Under `'allowlist'`, a Battle View sends one more `GET /api/agent/cockpit-status` per owner per page life, through the Film Room gate's verdict cache (`filmRoomGate.js:116-131`). This is separate from the cockpit's own status ask (`useCockpitStatus`, `AgentBattleScreen.jsx:1232`). Build A's call-count table already records it (Build A §7, the `'allowlist'` row). A player who is not admitted gets `allowlisted: false` and the modal as it is today. The endpoint is rate-limited per IP (60 a minute) and per user (30 a minute) and reads one document (`cockpit-status.js:47-50`). `'on'` removes the ask again.

## §5 Checks (PR A, on its final code tree)

All on Linux: WSL Ubuntu, Node 20.20.2, `TZ=UTC`, lockfile `40382e64edb6` on every tree (hashed inside WSL, equal to `~/pd-af0`'s install, whose `node_modules` each tree links). The code tree is `c2c34534`, the flip commit, equal to the swept `6fe136ac` (the same tree, `39d507e0`). `main` is `8d1c9452`, unmoved since the first fetch (re-checked just before the push; the last paragraph of this section). The report commit that follows changes only this file.

**Kill switch.** `c2c34534` with only the literal set back to `'off'` (scratch tree `~/pd-ci-bombflipk`), against `main`. Unminified builds (`vite build --minify false`):

| | Result |
|---|---|
| Non-map files | 57 and 57 (111 files each) |
| Raw `diff -rq`, source maps excluded, hashed names included | **0 entries: 0 of 57 non-map files differ** |
| Docstring lines in the build | none (the docstring and the test files' comments do not reach the bundle) |

**Value only.** `c2c34534` as pushed (`'allowlist'`) against `main` with only the literal set to `'allowlist'`: **0 of 57 non-map files differ** (raw `diff -rq`, maps excluded). So the flip ships nothing but the literal. For the record, against `main` unchanged the raw `diff -rq` lists 103 entries: every chunk that imports the entry is renamed, because the entry's content hash moves. Paired by masked name and masked content, 56 of 57 are twins, and the one left, the entry chunk (`index-Bwtc2qK-.js` → `index-Dvvbzou0.js`, 206,605 lines each), differs by exactly one line:

```diff
-const RESEARCH_MODAL_BOMB_MODE = "off";
+const RESEARCH_MODAL_BOMB_MODE = "allowlist";
```

The flag's `const` ships unfolded because it is read at call time (Build A §13.4, ruled Nov 7); that is unchanged by this PR.

**Both CI jobs' own commands, on Linux:**

| Check | Tree | Result |
|---|---|---|
| `npm run lint:gate` | `c2c34534` | **exit 0** (`--max-warnings 0`) |
| Full suite, `vitest run --maxWorkers=8`, `flock /tmp/pd-suite.lock`, `TZ=UTC` | the flip's tree | **exit 0**, `Test Files 1348 passed \| 8 skipped (1356)`, `Tests 29693 passed \| 89 skipped (29782)`, 234 s |
| `npm run test:rules` | the flip's tree | **exit 0**, `Test Files 35 passed (35)`, `Tests 666 passed (666)`, 144 s |
| `npm run test:rules`, **the kill-switch state** (literal `'off'`) | `c2c34534` + `'off'` | **exit 0**, `Test Files 35 passed (35)`, `Tests 666 passed (666)`, 154 s |
| Minified build (`vite build`) | `c2c34534` | **exit 0**, 111 files |

Exit codes are read from each run's own exit, with nothing piped. The `Test Files` lines are vitest's own.

**`main` did not move.** `git fetch origin` before the push still read `8d1c9452`, so there was nothing to merge (step 5), and every check above ran against the `main` this PR is cut from. The pushed head adds this report on top of `c2c34534`. Its minified build and `lint:gate` ran once more on the exact pushed commit, after this text was final; their results are in the PR description.

## §6 Mutation

On `~/pd-ci-bombflip` at `c2c34534`. Each mutant is one exact edit, checked to land exactly once. Each runs a control of the same files first, unmutated. Afterwards the file is restored from `git show HEAD:path` and its SHA-256 compared with the value before the edit; the tree was confirmed clean before each mutant and after the last. Killed means a non-zero exit with the named rows failing. `TZ=UTC`, 8 workers.

The pin files are `researchModalFlags.test.js` and `flagPinGuard.test.js` (12 rows). The gate files are `bombModeGate.test.js`, `useBombModeForBattle.jsdom.test.jsx`, `bombModeMounts.jsdom.test.jsx` and `AgentBattleScreen.bombModeOn.jsdom.test.jsx` (36 rows). Every control was exit 0 with 0 failed.

| # | Mutant (the brief's item) | Edit | Result | Rows that caught it | Restored (SHA-256) |
|---|---|---|---|---|---|
| P1 | **The literal changed** | `researchModalFlags.js:58` `'allowlist'` → `'on'` | **killed**, 2 of 12 | the pin row ("is 'allowlist' — a kill switch: …"); the BF-2 rollback-story row (its title check carries the value) | yes |
| P1b | The literal changed the other way (the flag moved, its pin not: the control a rollback must pass) | `'allowlist'` → `'off'` | **killed**, 2 of 12 | the same two rows, and nothing else | yes |
| A1 | **`'allowlist'` on without the cockpit-status verdict** (the gate) | `bombModeGate.js:44` `return agentBattle === true && verdict === true;` → `return agentBattle === true;` | **killed**, 4 of 36 | `bombModeGate`: "'allowlist' needs an agent battle AND a definite yes"; `useBombModeForBattle`: "off until the cached cockpit-status verdict says yes…", "'allowlist' and a no: stays off"; `AgentBattleScreen.bombModeOn`: "not allowlisted: nothing, and the selector is never called" | yes |
| A2 | `'allowlist'` on without the verdict (the hook takes any answer as a yes) | `useBombModeForBattle.js:28` `verdict: v === true` → `verdict: true` | **killed**, 2 of 36 | "'allowlist' and a no: stays off"; the screen's "not allowlisted" row | yes |
| N1 | **`'allowlist'` on for a mount with no agent battle** (the gate) | `bombModeGate.js:44` → `return agentBattle === true ? verdict === true : true;` | **killed**, 3 of 36 | `bombModeGate`: "resolves off for a mount with no agent battle, even on a yes"; `bombModeMounts`: the free agent bar's and the battle view's `'allowlist'` rows | yes |
| N2 | the same, at the free agent bar's mount | `FreeAgentBar.jsx:454` `bombModeOn(resolveBombMode())` → `resolveBombMode() !== 'off'` | **killed**, 1 of 36 | `bombModeMounts`: "'allowlist': no agent battle → off, no prop" | yes |
| N3 | the same, at the BaggerBomb battle view's mount | `BaggerBombBattleView.jsx:657`, the same edit | **killed**, 1 of 36 | `bombModeMounts`: "'allowlist' and 'off': no prop" | yes |
| N4 | the same, in the Battle View's hook when it has no battle id | `useBombModeForBattle.js:33` `mode === 'allowlist' ? false` → `? id === null` | **killed**, 1 of 36 | `useBombModeForBattle`: "'allowlist' with no agent battle id: off and nothing asked" | yes |

**8 of 8 killed.** The brief's fourth mutant (PR B: a browse mount showing the Bomb tab under `'on'`) is not run, because PR B is not built (BF-3). These rows mock the flag, so they guard the allowlist's logic at any shipped value. The live value is guarded by the pin (P1, P1b).

## §7 Rollback

The flag is a kill switch: roll back one step at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; every mode-off arm stays in the code until the cleanup PR, after 'on' has run in production.

1. **From `'allowlist'` to `'off'`** (PR A's own rollback): `src/config/researchModalFlags.js`, `export const RESEARCH_MODAL_BOMB_MODE = 'allowlist';` → `'off'`, and the first row of `src/config/researchModalFlags.test.js` (`toBe('allowlist')` → `toBe('off')`, its title's value with it), in one commit. The guard's note says which value is current; update it too. `RESEARCH_MODAL_BOMB_MODE` stays out of `DARK_BY_DESIGN`.
2. **From `'on'` to `'allowlist'`** (when PR B has merged): the same two lines, one step back.
3. **Run both suites** on the rollback, `npm run test:rules` as well as the default suite (the armory flip's lesson). §5 shows the kill-switch state's rules suite green, and the kill-switch build identical to `main`.

No data to undo: Bomb mode reads records the client already holds and writes nothing.

**The cleanup PR** (after `'on'` has run in production; not now): delete the unreachable legacy ladder code (`ladder.js legacyLadder` and its rows, Build A §0), the dead `setMarkers` call (`StockChart.jsx`, Build A §13.3), the mode-off arms and their kill-switch rows, and the spec's §8 smoke list.

---

## §8 For PR B's description, when it is opened (BF-5)

PR B is not built in this session (BF-3). When it is, its description opens with "Contains PR A. Merge only after PR A, and after the founder's live session on the allowlist is clean." and says, in plain words:

- **Under `'on'`, the draft, acquire and watchlist research modals lose the Bomb tab** (FQ-5, BA-5): the Snake Draft console and top performers, the asset picker, the draft room, the League draft board, the awaiting-open pod, free agency and the dashboard watchlist (Build A §6).
- **Under `'on'`, the legacy Film Room (`FilmRoomScreen.jsx:179`) loses 💣 and opens on Analysis and 1D** (ruled Nov 7).
- Under `'allowlist'` all of these keep today's behaviour, because a mount with no agent battle resolves off.

---

## §9 The founder's live-session checklist

For the first weekday session after PR A merges and deploys, on an iPhone, signed in as the founder. Times are Central (the market runs 8:30 AM – 3:00 PM CT); the app prints Eastern. **PR A's Vercel preview:** PREVIEW_LINK.

1. **Before the open:** in a live battle, tap 💣 on a stock the agent holds. You get the Fuse. The clock reads "next check Mon 9:30 AM" (Eastern, as `horizon.js` prints it). The scored chip, if it shows, names Friday's check.
2. **8:30–9:30 AM CT** (Build A §14.1): if a held stock sits within 0.5% of a rung, open its red zone. Write down the "1-MIN BARS TO" time and the clock's time. If no held stock is that close, write "no red zone this session".
3. **During the session:** watch a check land. The clock shows *checking…*, then rolls to the next check. If a rung banks while you're watching, the *+N banked* moment plays once.
4. **A held coin, a stock on an older battle, or a stock on a League battle opened in the Battle View:** shows "Held · rungs shown from yesterday's close ($X) · this position's live ladder isn't shown here", with nothing lit. (League battles are never measured, §2. From the League tab they open in the Arena, which has no research modal.)
5. **A search or draft modal:** unchanged from today (the allowlist doesn't reach it).
6. **After 3:00 PM CT:** a held stock inside the band shows "Market closed · last tick …". Otherwise it shows the Fuse.

Bring what you saw back to the planning chat. PR B is built and merges only after that, and after BF-3 is settled (§2).

---

## §10 What ran, where, and cleanup

- **Windows:** the worktree above, branch `claude/bomb-mode-allowlist-flip-e30aa5` (cut from `origin/main` @ `8d1c9452`), pushed by refspec to `claude/bomb-mode-allowlist`. The pin file, the guard and the gate rows ran there first (vitest from the parent checkout's `node_modules`: 3 files, 27 rows, exit 0).
- **WSL:** `~/pd-ci-bombflip` (the sweep, the head's builds, `lint:gate`, the mutants) and `~/pd-ci-bombflipk` (`main`'s builds, `main` with the literal set, the kill-switch build and its rules suite). Both are detached worktrees of `~/pd-ci` with `node_modules` linked to `~/pd-af0`. Runs went under `~/pd-bombflip-runs`. `~/pd-ci`, `~/pd-ci-af1`, `~/pd-af0` and other sessions' trees were not touched.
- **Cleanup:** after the last check on the pushed head, both trees and `~/pd-bombflip-runs` are removed under the suite lock (`unlink` each `node_modules` link, `git -C ~/pd-ci worktree remove --force`, `worktree prune`). The space freed is in the PR description.
- **Scripts** in the session scratchpad (not committed): setup, suite, rules, build, literal setter, compare, mutants.
