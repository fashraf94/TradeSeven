# Build: the crash class from the lint findings (A1 · A4), and the interim gate

**Date:** September 15, 2026
**Branch:** `claude/fix-crash-class-a1-a4`
**Base:** `origin/main` @ `fd470b16d57fd09d8c3b2290af851adf5580d951` (`Merge pull request #843 from fashraf94/backing/pr0-eligibility-attestation`)
**Discovery:** `docs/audits/20260913_LINT_NODE_GLOBALS.md` §7, groups A1 and A4 (and D1 for the gate)
**Fence (BUILD_RULES §1):** **none of the files in this diff is on the §1 fence list** — confirmed at this HEAD; every fenced path is under `api/`, and this diff is entirely `src/`. No fenced file was read for modification, edited, or had an exported function called.

---

## 1. Executive verdict

| # | Question | Answer |
|---|---|---|
| 1 | Is the XP modal's crash fixed? | **Yes.** Four out-of-scope identifiers lifted into the scope that renders the modal. Mounted test, shown failing first. |
| 2 | Are the 19 conditional hooks fixed? | **Yes.** `react-hooks/rules-of-hooks` is **0 across `src/`** and repo-wide (was 19). |
| 3 | Any visual or behavioural change? | **None on any render path that works today.** Proven on both gold-standard surfaces by byte-identical mounted before/after renders. One deliberate change on a path that *crashed* today — §4.3. |
| 4 | Did the interim gate land? | **NO — STOPPED, as the task prescribed.** `no-undef` is **2, not 0**, after A and B. Both are pre-existing `process` reads, outside A1/A4. §6. |
| 5 | Full suite? | **3 runs, exit 0 each.** 665 files / 12,479 tests passed, 64 skipped, **0 failed**. Identical counts across all three. |
| 6 | `vite build`? | **Exit 0.** |
| 7 | Was the §2 review required, and run? | **Yes to both** — 13 files crosses the ≥10-file threshold. Four lenses, isolated extractions, mutating lens last. It found **a second live crash in the same modal** (C-1), now fixed. §7. |
| 7b | Are the new tests real guards? | **Yes, mutation-proven.** 10 of 17 mutants killed; the 7 survivors are each judged in §7.4. One survivor was a weak assertion in the test itself, now fixed. |
| 8 | Anything the founder must decide? | **Two things** — the gate (§6) and a confirmed display defect the fix makes visible (§8 F1). |

**The headline the review surfaced:** fixing A1 makes the XP modal render for the first time — and the modal carries its own six-rung rank ladder (`Rookie / Apprentice / Trader / Expert / Master / Legend`) that **disagrees with the only rank ladder the app actually assigns** (`Beginner / Veteran / Expert / Master`, `src/services/battleTimer.js:265-270`). This build does not change that ladder — it is a BUILD_RULES §9 display-agreement fix with a product decision inside it — but the founder should know before merging that the modal now *shows* numbers, and for most accounts the "next rank" label is wrong. Detail and repro in §8 F1.

---

## 2. Preamble (BUILD_RULES §2 / §3 compliance)

- **`git fetch origin` ran as the first git operation of this session** (§3). `origin/main` resolved to `fd470b16`; the container's ref was already current, no phantom gap.
- **Branch** cut fresh from `origin/main` at `fd470b16`, clean tree, zero commits ahead at cut (§2, one task = one branch).
  - *Deviation noted for the record:* the harness pre-created and checked out its own session-default branch (`claude/cool-babbage-5ppbp7`). The task names `claude/fix-crash-class-a1-a4` explicitly and says "never the session default name", so that branch was cut from `origin/main` at the same SHA. Nothing was committed to the session-default branch.
- **Working tree:** clean at cut; clean at report time apart from the intended files.
- **Review threshold (§2):** 13 files / 836 lines — **over** the ≥10-file trigger. The adversarial review was run as part of the task (§7), as the prompt directed, rather than stopping.
- **`vite build` run explicitly** (§2) — no test imports `App.jsx` for syntax, and this diff's largest file is `App.jsx`.
- **Report also written outside the repo tree** (§3) and offered for download.

---

## 3. The diff

```
 src/A4.conditionalHooks.jsdom.test.jsx          | 170 ++++++++++++++
 src/App.jsx                                     |  71 ++++--
 src/App.xpModal.jsdom.test.jsx                  | 292 ++++++++++++++++++++++++
 src/components/Agent/InlineTradingGradeCard.jsx |  22 +-
 src/components/BaggerBomb/TacticalRow.jsx       | 120 +++++-----
 src/components/DesktopBackground.jsx            |  14 +-
 src/components/FantasyTimes/EditorialStory.jsx  |   9 +-
 src/components/FantasyTimes/ReporterDesk.jsx    |  21 +-
 src/components/Forge/CollectionDetailSheet.jsx  |  36 +--
 src/components/StonkOptionsPosition.jsx         |  42 ++--
 src/components/draft/CompeteTab.jsx             |   8 +-
 src/screens/DraftBattleScreenV2.jsx             |  14 +-
 src/screens/SnakeDraft/DraftCompleteScreen.jsx  |  17 +-
 13 files changed, 712 insertions(+), 124 deletions(-)
```

Five commits:

| SHA | What |
|---|---|
| `04b34662` | **A** — A1, the XP modal's four out-of-scope identifiers |
| `cfd06129` | **B** — A4, all nineteen conditional hooks |
| `cf85b8e5` | Review response 1 — six CONFIRMED findings from lenses A and B |
| `7ae08748` | Review response 2 — C-1 (a live crash in the same modal) and five smaller findings from lens C |
| `edc97670` | Review response 3 — the one mutation survivor that was a defect in the guard itself |

**No Commit C.** The interim gate was not added; the task's STOP condition fired (§6).

No fenced file. No `featureFlags.js`. No `DARK_BY_DESIGN`. No manifest change. Two of the 13 are the new tests; production code is 11 files.

---

## 4. Commit A — A1: the XP modal's four out-of-scope identifiers

`04b34662` · `src/App.jsx`, `src/App.xpModal.jsdom.test.jsx`

### 4.1 What was wrong, and where the four were actually defined

All four were declared together at `src/App.jsx:8736-8741` (at the base SHA), inside `getScreenContent`'s `screen === 'dashboard'` branch, under the comment `// XP calculation for modal`. `getScreenContent` spans `:8607-9991`. The modal that reads them renders at `:10436-10580` — **after** that function closes, in `PortfolioDuel`'s own body. A sibling scope, ~1,800 lines away. VERIFIED at this HEAD; the record's line numbers had not drifted.

Nothing inside `getScreenContent` read any of the six declarations. That is why ESLint reported three of them as **both** `no-undef` (at the modal) **and** `no-unused-vars` (at the declaration) — the same variables were simultaneously undefined where used and unused where defined. That double signal is the clearest possible evidence the declarations had been orphaned by a move.

### 4.2 How a player reaches that modal today

Live path, not a dev route:

1. Log in → an effect routes a loaded user to the dashboard (`src/App.jsx:3368-3372`).
2. On desktop, the bottom stats bar renders, gated `user && screen === 'dashboard'` (`:12218`).
3. The player clicks the **Rank chip** in that bar (`:12259-12260`), which calls `setShowXPModal(true)`.
4. The modal's JSX evaluates → `ReferenceError` → the React tree unmounts. In production `main.jsx:26` wraps the app in an `ErrorBoundary`, so what the player actually sees is the whole app replaced by the error screen.

### 4.3 The scope route chosen, and why

**Chosen: lift the six declarations to the scope that renders the modal.** Not props, not state-lifting.

The reason props and state-lifting were both unnecessary: `showXPModal` **already lives at app level** (`:2405`) and `user` is **already destructured** at app level (`:2203`). The only thing in the wrong scope was six lines of arithmetic over values that were already in scope at the destination. Lifting them is a pure move; passing them as props would have meant inventing a component boundary that does not exist, and lifting state would have meant moving state that was never below.

They are declared **above** the `const screenContent = getScreenContent();` call, not below it. Below the call would work today, but the next edit that reads `nextRank` from inside the dashboard branch — the natural place, since the dashboard renders the rank chip — would hit a temporal-dead-zone `ReferenceError` instead of a value. Above the call costs nothing and removes the trap. (This placement came out of the §7 review, finding A-4.)

**The one deliberate difference.** The new scope runs on every render, including while `user` is still `null` (`src/contexts/UserContext.jsx:60`), so the three reads that dereference `user` are guarded. For every `user`-truthy input the results are **identical** to the originals — verified across `xp` = undefined / null / NaN / string, `rank` = unknown / '' / null / 'Legend' / absent, and `user = {}`. Where they differ is `user === null`: the originals **threw** `TypeError: Cannot read properties of null`, and the guarded versions return unused fallbacks.

That is a behaviour change, and it is disclosed rather than glossed: it is on a path that *crashed*, not a path that worked, so it does not touch the "no change on any path that works today" invariant — but the founder should know the direction. `user` can go null mid-session with `screen` still `'dashboard'` (a failed `getUserData` read is delivered as a sign-out: `src/firebase/authService.js:265-268` → `src/contexts/UserContext.jsx:75`). In that state the dashboard branch previously threw at `user.xp` and the app showed the error screen; it now renders the dashboard with a null user, which `DashboardLoop` already handles with `user?.` throughout. Crash → degraded render. Surfaced by review lens A (A-1).

### 4.4 Test, shown failing first

`src/App.xpModal.jsdom.test.jsx` — **the first test in the repo to import `App.jsx`.** BUILD_RULES §2 records that nothing did ("a syntax error there passes the entire suite"), which is precisely why a `ReferenceError` on a live path could sit in `main` unnoticed.

It mounts the real `PortfolioDuel` behind the real `ThemeProvider` / `FantasyTimesProvider` stack from `src/main.jsx:25-33`, with only the app's I/O edges mocked (Firebase, the price API, the WebSocket bridge, the agent subscription, `fetch`). Nothing about the modal, its state, or its arithmetic is mocked. The outer `ErrorBoundary` is deliberately omitted so the error surfaces as a failure with its own stack instead of being absorbed into a passing render of the fallback.

**Before (pre-fix tree), both rows fail:**

```
FAIL  src/App.xpModal.jsdom.test.jsx > A1 — the app-level XP progress modal >
      renders the four computed values when the player clicks the Rank chip
ReferenceError: xpForNextLevel is not defined
 ❯ PortfolioDuel src/App.jsx:10544:86
    10544|  <span style={{ color: colors.cyan, fontWeight: '600' }}>{user.xp} / {xpForNextLevel} XP</span>
       |                                                                        ^
 ❯ renderWithHooks node_modules/react-dom/cjs/react-dom-client.development.js:7662:22
```

Thrown from `PortfolioDuel` itself — the scope defect, not a mock artefact.

**After: 2 passed.** The modal renders `6000 / 10000 XP`, `4000 XP to next rank`, `Expert`, and a bar at `60%` width.

**Mutation-checked** (BUILD_RULES §2): changing `xpProgress`'s `* 100` to `* 90` reddens the bar-width row and leaves the content row green — the two rows guard independently, and neither is vacuous.

---

## 5. Commit B — A4: nineteen conditionally-called hooks in eleven files

`cfd06129` · eleven production files + `src/A4.conditionalHooks.jsdom.test.jsx`

Every site: the hook moves above the condition or early return so it runs on every render, and the condition moves into the effect body or is guarded inside the memo. `react-hooks/rules-of-hooks` is **0 across `src/`** and repo-wide.

### 5.1 The classification, and what it turned out to mean

The task asked for two buckets — flip-able (the crash class) or static. Testing produced a **third**, and it is worth stating because it changes what "flip-able" is worth:

> **A flip-able condition is not sufficient to crash.** React chooses its hook dispatcher on `current.memoizedState !== null`. A render that called **zero** hooks leaves `memoizedState` null, so the *next* render is put back on the MOUNT path and no order check runs at all. So a component whose early return precedes its **only** hook can flip 0 ↔ 1 hooks forever without React noticing. The crash needs at least one hook to run *before* the early return, so that the dispatcher is on the update path and the count can disagree.

That is not a deduction left on paper — it is why two rows written for `DesktopBackground` **passed against the pre-fix tree** and were deleted rather than kept (BUILD_RULES §2: a row that cannot fail under the defect it names is not a guard). The contrast that proves the mechanism is `StonkOptionsPosition`, which has one hook *before* its early return and one after: the same shape of flip moves it 1 ↔ 2 and crashes in **both** directions, with React naming each one differently ("Rendered more hooks than during the previous render" going up, "Rendered fewer hooks than expected" coming back down).

### 5.2 The nineteen sites

Line numbers are at the base SHA. "Evidence" is how the verdict was established.

| # | Site | Hook | Condition | Class | Evidence / guard |
|---|---|---|---|---|---|
| 1-3 | `src/App.jsx:8299,8300,8301` | `useState` ×3 | `!showSpotlightTour` | **static** | `SpotlightTour` is defined *inside* `PortfolioDuel`'s body, so it is a new function identity on every parent render; React unmounts and remounts it whenever the condition could change, and the condition is fixed for each instance's life. Its own state updates cannot change it (closure capture). Lint at zero is the guard. |
| 4-5 | `src/App.jsx:8305, 8376` | `useEffect` ×2 | `!showSpotlightTour` | **static** | Same instance argument. **Both conditions moved INTO the bodies** — see §5.3. Lint at zero is the guard. |
| 6 | `src/components/Agent/InlineTradingGradeCard.jsx:161` | `useEffect` | `!trade` | **static** | Caller maps a non-null `trades` array (`src/components/Agent/AgentChat.jsx:1489`); `trade` is never falsy for a mounted card. Lint at zero is the guard. |
| 7 | `src/components/BaggerBomb/TacticalRow.jsx:179` | `useMemo` | `!asset` / `asset.isCash` | **CRASH-CLASS** | Mounted flip test, ×3 rows. Pre-fix: "Rendered more/fewer hooks". |
| 8 | `src/components/BaggerBomb/TacticalRow.jsx:211` | `useMemo` | same | **CRASH-CLASS** | Same rows (both memos sit below the same two returns). |
| 9 | `src/components/DesktopBackground.jsx:14` | `React.useMemo` | `!isDesktop` | **flip-able, not crash-class** | Condition genuinely flips (`isDesktop` tracks `useIsMobile`'s resize listener, `src/hooks/useIsMobile.js:62-70`). But this memo is the component's **only** hook and the return preceded it → 0 ↔ 1 hooks → no crash, empirically (rows passed pre-fix and were removed). Fixed anyway: the rule must reach zero, and one added hook would make it crash. Lint at zero is the guard. |
| 10-12 | `src/components/FantasyTimes/EditorialStory.jsx:530, 537, 552` | `useRef`, `useEffect` ×2 | `!story` | **static** | Every call site guards; `ReporterDesk` returns `<EmptyDesk/>` when `stories` is empty (`:100`) before deriving `lead = stories[0]` (`:102`). Lint at zero is the guard. |
| 13 | `src/components/FantasyTimes/ReporterDesk.jsx:545` | `useMemo` | `!reporter \|\| !REPORTER_COLORS[reporter]` | **static** | `FantasyTimesFeed` wraps it in `<AnimatePresence mode="wait">` keyed on `activeSection` (`:179-181`), so a section change **remounts**; `activeSection === 'frontPage'` renders a different component entirely. Lint at zero is the guard. |
| 14-15 | `src/components/Forge/CollectionDetailSheet.jsx:176, 188` | `useMemo` ×2 | `!collection` | **static** | `ForgeScreen` renders it only when `selectedCollection` is truthy (`:692`, `:1136`), inside `<AnimatePresence>`, which exits with the last props rather than re-rendering with null. Lint at zero is the guard. |
| 16 | `src/components/StonkOptionsPosition.jsx:48` | `useMemo` | `!contract \|\| !valuation` | **CRASH-CLASS** | `valuation` is null until `currentPrice` arrives, and the arena streams prices live (`currentPrice={prices[contract.symbol]}`, `src/components/optionsArena/StonkOptionsArenaV2.jsx:1194`). Mounted flip test, ×2 rows, crashes both directions pre-fix. |
| 17 | `src/components/draft/CompeteTab.jsx:506` | `useMemo` | `!leaderboard?.length` | **static** | The parent already guards with the **same expression** (`data.leaderboard?.length > 0`, `:1301`) and swaps to a fallback `<div>`, so the child's early return is unreachable while mounted. Lint at zero is the guard. |
| 18 | `src/screens/DraftBattleScreenV2.jsx:1006` | `useMemo` | `!currentDraft` | **static** | Every navigation path batches `setCurrentDraft(draft)` with `setScreen(...)`; the only `setCurrentDraft(null)` in the repo is `src/App.jsx:9328`, batched with `setScreen('dashboard')`. Nothing inside the screen ever passes null. Lint at zero is the guard. |
| 19 | `src/screens/SnakeDraft/DraftCompleteScreen.jsx:468` | `useMemo` | `!currentDraft` | **static** | Same `:9328` handler — both setters batch into one commit, so the component unmounts rather than re-rendering into its early return. Lint at zero is the guard. |

**Totals: 3 crash-class · 1 flip-able-but-not-crash-class · 15 static.**

### 5.3 Semantics preserved, per site — the four that needed more than a move

Moving a hook up is only safe if nothing it does starts happening earlier. Four sites needed real care:

1. **`App.jsx` SpotlightTour, both effects.** These are the only two in the nineteen with side effects on the *window*: one calls `window.scrollTo`, the other binds a global `keydown` handler that calls `setShowSpotlightTour(false)` / `setTourStep(0)`. Running either with the tour shut would scroll the page and hijack Escape app-wide. Both therefore take `if (!showSpotlightTour) return;` **into the body**, and both dep arrays are unchanged.
2. **`InlineTradingGradeCard.jsx:161`.** The `!trade` bail went into the body and deliberately **not** into the deps. Adding `trade` would re-run the grade sync whenever the parent rebuilds its trades array, which would overwrite an optimistic grade with the not-yet-round-tripped `currentGrade` and visibly revert the player's pick. Deps unchanged, with an `eslint-disable-next-line react-hooks/exhaustive-deps` and the reason written at the site.
3. **`TacticalRow.jsx` (AssetSide).** The destructure moved up with the memos and now reads `asset ?? {}` rather than `asset`. That preserves `= default` semantics exactly — a default applies only for `undefined` — so a **null** `baseATR` still falls through to `baseATR > 0 === false` as before, rather than picking up `2.5`. This file already had the precedent: `ownProximity` (`:84`) was placed above the early returns for exactly this reason by an earlier task.
4. **`CollectionDetailSheet.jsx`.** `rules` and `hasProgression` are now derived above the return through `collection?.` and removed from the destructure below it, so there is no duplicate declaration and every later use sees the same value.

`StonkOptionsPosition` also dropped `isCall` from its dep array and derives it in the body instead; `isCall` is a pure function of `contract`, which is still a dep, so the memo invalidates identically.

### 5.4 Test, shown failing first

`src/A4.conditionalHooks.jsdom.test.jsx`, 5 rows over the 3 crash-class sites. Each renders one way and re-renders the **same root** the other way.

**Before (pre-fix tree): 5 failed | 2 passed** — the 5 with React's own errors:

```
Error: Rendered more hooks than during the previous render.
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

(The 2 that passed were the DesktopBackground rows — the finding in §5.1. They were deleted.)

**After: 5 passed.**

### 5.5 The gold-standard surfaces: proof that nothing else moved

`TacticalRow` and `DraftBattleScreenV2` are the Snake Draft gold-standard references (`marketclash-components`). Both were proven by **mounted before/after render comparison**, not by reading the diff:

- Rendered each surface on the pre-fix tree and the post-fix tree and compared `innerHTML`.
- The raw comparison is not deterministic — framer-motion samples `opacity`/`transform` mid-flight, and two `box-shadow`/`text-shadow` glows breathe on a rAF loop that never settles. **That was established by a control**, not assumed: capturing the *same* tree twice also differed.
- So the comparison normalizes exactly those continuously-sampled values, and **the normalizer was validated against the control first** — same tree captured twice is identical under it. Everything else (element structure, every other style, colours, text nodes) compares verbatim.

| Surface | Cases | Result |
|---|---|---|
| `TacticalRow` / `AssetSide` | 9 — full row, empty left slot, cash left slot, plain side, right side, null asset, cash asset, plus `DesktopBackground` desktop/mobile | **identical, all 9** |
| `DraftBattleScreenV2` | 2 — no-draft path (1,786 chars), with-draft path (25,144 chars) | **identical, both** |

---

## 6. Commit C — the interim gate: **STOPPED, not landed**

The task's condition was explicit:

> Both must be at zero on this branch before the step is added, so the gate is green the day it lands. If either is not at zero after Commits A and B, **STOP and report** — do not add a gate that starts red.

**After Commits A and B, repo-wide:**

| Gate rule | Base `fd470b16` | This branch | At zero? |
|---|---:|---:|---|
| `react-hooks/rules-of-hooks` | 19 | **0** | **yes** |
| `no-undef` | 6 | **2** | **no** |

So the condition fired. **No `lint:gate` script was added and no workflow step was added.** A gate landing today would be red on arrival, which is the one outcome the instruction rules out.

### 6.1 What the two remaining `no-undef` are

```
src/App.jsx:10063:8              'process' is not defined.
src/components/ErrorBoundary.jsx:227:14  'process' is not defined.
```

Both are `{process.env.NODE_ENV === 'development' && …}` — a dev-only diagnostic banner and a dev-only error-detail block. Neither is in A1 or A4, and neither is a crash: **verified** that Vite statically substitutes the expression, so the shipped bundle contains **zero** occurrences of `process.env` and the dev banner's markup is eliminated entirely (`grep` over `dist/assets/index-*.js` after a clean `vite build`: 0 and 0). They are lint-only — genuine under a browser-globals config, harmless at runtime.

This was foreseeable from the discovery record's own arithmetic, and is not a surprise: D1 sized the interim gate at "**25 errors**" = 6 `no-undef` + 19 `rules-of-hooks`. A1 accounts for 4 of the 6 and A4 for all 19, which leaves exactly 2. The record's §1 called all 6 "genuine", which they are — but only 4 of them belong to this task.

### 6.2 The founder's options — the gate is one small decision away

Ordered cheapest-first. Each lands the gate green; none is in this branch, because each is a decision rather than a fix.

1. **Gate on `react-hooks/rules-of-hooks` only, now.** It is at zero and stays at zero. Catches the whole A4 crash class, costs nothing, and can be widened later. This is the option that needs no other change.
2. **Convert the two sites to `import.meta.env.DEV`** — Vite's idiomatic equivalent, two lines, then gate on both rules. It is a real (if tiny) code change to files outside A1/A4, which is why it is not here.
3. **Declare `process` a readonly global for `src/`** in `eslint.config.js`, then gate on both. Cheapest in lines, but it makes the config assert something false about the browser and would mask a genuinely wrong `process` use later. The discovery record already flags the browser-entry scoping as its own decision (§7(c) C7).

Recommendation: **option 1 now, option 2 as its own one-line task.** That gets the crash-class gate live immediately without either waiting on a decision or writing a false global into the config.

---

## 7. The §2 adversarial review

The diff reached 13 files, over the ≥10-file threshold, so the review ran **as part of this task** rather than as a stop (the prompt's instruction).

**Method, against each §2 requirement:**

| Requirement | How it was met |
|---|---|
| Multi-lens | Four independent dimensions: **A** scope & semantics of A1 · **B** hook lifecycle & semantic preservation across all 19 · **C** test integrity & the flip-able/static classification · **D** mutation. |
| Adversarial | Every lens was instructed to **refute**, with a concrete repro, and to record findings it tried and could not break as `REFUTED-MY-OWN-FINDING`. All four did so. |
| Reviewer isolation | One `git archive` extraction per lens, **path-distinct** (`review/lensA` … `lensD`), `node_modules` symlinked, read-only on git and on the working tree. The **mutating lens ran last, on its own tree**, re-extracted from the final commit. |
| Mutation-checked | Lens C independently mutation-checked all seven then-existing rows against pre-fix sources; lens D ran a mutation campaign against the final code (§7.3). Every row added in this build has been shown failing under the defect it names. |
| Explicit `vite build` | Run. Exit 0. |
| Written down | This section, with the CONFIRMED / REFUTED split. |

### 7.1 CONFIRMED findings — all fixed, in two review-response commits

| id | Lens | Sev | Finding | Disposition |
|---|---|---|---|---|
| A-4 | A | LOW | The lifted XP block sat *after* the `getScreenContent()` call, so the next edit reading one of the six from inside that function would hit a TDZ `ReferenceError`. | Moved above the call. `cf85b8e5` |
| A-1 / A-10 | A | MED | The block comment claimed the guarded results are identical "for every reachable case". False for `user === null`, where the originals **threw**. | Comment corrected to state the change and its trigger. `cf85b8e5` |
| B-1 | B | MED | `ReporterDesk`'s memo was the **one** of the nineteen whose body had no guard of its own, so lifting it made it run where it never ran — and it is not total over its input. Repro: `<ReporterDesk reporter="nope" stories={[null, STORY]} />` → PRE `""`, POST `TypeError`. | Bail moved into the body with the hook. `cf85b8e5` |
| B-3 / B-4 | B | MED / NIT | `SpotlightTour`'s `[]` dep array was safe only because the component is redefined every parent render. Hoisting it — the natural cleanup — would have **silently** killed Escape-to-close, where pre-fix the same refactor crashed loudly. Also left an unused `eslint-disable` that ESLint reported on every run. | `showSpotlightTour` added to both effects' deps; directive retired. `cf85b8e5` |
| B-5 | B | LOW | `isCall` was derived separately inside and outside the memo — the §9 two-source shape; the bar could disagree with the arrow beside it. | One binding, restored to the dep array. `cf85b8e5` |
| B-6 | B | NIT | Blank-line residue in `DraftCompleteScreen`. | Removed. `cf85b8e5` |
| **C-1** | **C** (and A-3) | **MED** | **The XP modal still crashed the tree.** Gated on `showXPModal` alone while reading `user.rank` / `.level` / `.xp` unguarded, and nothing resets `showXPModal` on sign-out — so a user going null *while the modal is open* threw `TypeError: Cannot read properties of null (reading 'rank')`. Reproduced against **this branch**, not the base. | Gated on `user` too, plus a new mutation-checked guard row. `7ae08748` |
| C-9 | C | LOW | Hoisting the destructure made `history`'s fresh-object-literal default reachable on every empty/cash-slot render, invalidating `thresholdHeat` every render. | Points at the module-level `DEFAULT_HISTORY`. `7ae08748` |
| C-2 | C | MED | The A4 test file claimed "the lint rule at zero is their guard" for 15 sites — but **CI does not run lint**, so it is a guard a human must run. | Header corrected to say so, pointing at §6. `7ae08748` |
| C-6 / C-7 / C-8 | C | LOW | Fixture erroring on `getPopularCrypto`; an empty-container sentinel as the weakest assertion; a missing chip null-check in row 2. | All three fixed. `7ae08748` |

**C-1 is the one that matters most.** It is the same crash class this build exists to remove, in the same modal, one input away from the case A1's own guards already handle — and it was invisible until the modal was made to render. Two lenses found it independently.

### 7.2 REFUTED — findings the lenses raised against themselves and could not sustain

Recorded because a review that never refutes itself has not been run adversarially.

- **A-6 / A-7 / A-8 / A-9** — no identifier collision or shadowing for any of the six (exhaustive `grep -nw`, clean `no-redeclare`); claim 1 holds for **every** `user`-truthy input (table across `xp` = undefined/null/NaN/string, `rank` = unknown/''/null/'Legend'/absent, `user = {}`); the added per-render cost and `ranks`' referential churn are not observable (they feed no dep array); the block is not dead behind any early return.
- **B — `asset ?? {}`** — attacked and found airtight, not lucky: `??` catches exactly the two values that make destructuring throw, and for any truthy `asset` it *is* `asset`. Verified across **17 asset shapes × 6 prop variants = 102/102 byte-identical renders**, including `baseATR: null`, `baseATR: 0`, `priceChange: NaN`, `history: null`, missing `symbol`.
- **B — the `InlineTradingGradeCard` dep decision** — the reviewer built the counterfactual and it stomps exactly as the author claimed: with `trade` added to the deps, a trades-array rebuild reverts an optimistic grade (`["A"]` → `[]`). Leaving it out is correct.
- **B — CollectionDetailSheet, CompeteTab, DesktopBackground, EditorialStory, both draft screens** — each attacked for a newly-reachable throw or a changed value; all clean, with byte-identical renders across 5 / 3 / 2 configurations respectively.
- **C — "`renderThenRerender` remounts, so the rows prove nothing"** — refuted empirically: pre-fix the rows produce React **hook-order** errors, which only an update of an existing fiber can produce. A remount would have passed silently.
- **C — "row 2's 1400 ms wait is a flake"** (the §8-F1 hazard class) — refuted by measurement: the bar reaches exactly `60%` at **t≈810 ms** and holds, leaving ~590 ms of slack; **9/9 green** (5 serial, 4 concurrent on 4 cores); and no other div carries `width: 60%` before the click, so the assertion is not trivially satisfiable.
- **C — "the selector or the 'Expert' assertion is trivially satisfiable"** — refuted: the selector matches exactly one button, and none of `Expert`, `6000 / 10000 XP`, `4000 XP to next rank` appears in the DOM before the click.
- **C — "a site is mis-classified"** — attacked all 19 independently from the real parents and call sites: **0 disagreements on the bottom line.**

### 7.3 What the review changed about the classification

Lens C's sharpest contribution is a refinement, not a correction. Applying the dispatcher rule from §5.1 consistently: **10 of the 19 sites had zero hooks before their early return**, so they are structurally incapable of the crash whatever their condition does. Only **5** have the crash-class *shape* and are safe merely because a parent invariant holds — `CollectionDetailSheet` ×2, `InlineTradingGradeCard`, `SectorLeaderboard`, `DraftBattleScreenV2`. Those five, plus the 3 genuinely crash-class sites, are where a future parent change could reintroduce the bug; the other 11 cannot.

Two of those five rest on a duplicated condition rather than on structure — `SectorLeaderboard`'s guard is a copy of its parent's expression 770 lines away (C-4), and `InlineTradingGradeCard`'s cards are keyed by array **index**, so its safety is "no falsy element at a stable index" rather than anything the type system or the code shape enforces (C-5). Both are recorded rather than changed.

---

## 8. Found outside the task — recorded, not fixed (BUILD_RULES §3)

### F1 · HIGH · The XP modal's rank ladder disagrees with the only ladder the app assigns — and this build is what makes it visible

**This is the one the founder should read before merging.** Surfaced by review lens A, independently re-verified here.

The app assigns ranks in exactly one place, `src/services/battleTimer.js:265-270`:

```js
if (xp >= 5000) return 'Master';
if (xp >= 2000) return 'Expert';
if (xp >= 500)  return 'Veteran';
return 'Beginner';
```

New accounts start `'Beginner'` (`src/firebase/authService.js:72`), and `src/screens/ProfileScreen.jsx:29` carries a second copy of the same four rungs. The modal carries a **third, different** ladder — `['Rookie','Apprentice','Trader','Expert','Master','Legend']` — which shares only `Expert` and `Master` and adds four rungs no code path can assign. So `indexOf(user.rank)` returns **-1** for the two most common production ranks, and `ranks[-1 + 1]` is `'Rookie'`.

Verified table (each row a real `(xp, determineRank(xp))` pair through the shipped expressions):

| xp | real rank | modal's "next rank" | "XP to next rank" | bar width |
|---:|---|---|---:|---:|
| 0 | Beginner | **Rookie** | 10000 | 0% |
| 500 | Veteran | **Rookie** | 9500 | 5% |
| 1999 | Veteran | **Rookie** | 8001 | 19.99% |
| 2000 | Expert | Master ✓ | 8000 | 20% |
| 5000 | Master | **Legend** | 5000 | 50% |
| 12000 | Master | **Legend** | **-2000** | **120%** |

The last row is reachable: a win pays 100-200 XP and a loss 25 (`src/services/battleTimer.js:21-23, 248-257`), so ~50-100 wins crosses 10,000, and `determineRank` caps at Master at 5,000 — every long-lived account ends up in the band where "XP to next rank" is **negative** and the bar animates past 100%.

**This build did not introduce it.** The arithmetic and the ladder are byte-identical to the pre-fix originals; A1 only moved them into scope. But pre-fix the modal threw before painting, so nobody ever saw a number — **Commit A is what makes the wrong data reachable for the first time**, and the founder should own that trade knowingly: the modal goes from *always crashes the app* to *renders, with a wrong next-rank label for every account outside the 2000-4999 band*.

Not fixed here, deliberately. It is a BUILD_RULES §9 display-agreement fix (bind the label and the number to one source) with a product decision inside it: what the rungs are, what "XP to next" means once `determineRank` caps at Master, and whether `xpForNextLevel = 10000` is a level or a rank threshold. That is a task, not a patch. The new test carries a comment at its fixture saying exactly this, so it is not read as endorsing the ladder.

### F2 · MED · A failed Firestore read is delivered as a sign-out

`src/firebase/authService.js:265-268` converts a failed `getUserData` read into `callback(null)`, which `src/contexts/UserContext.jsx:75` turns into `setUser(null)` while the Firebase session is still live — despite the comment there saying it only clears on true sign-out. This is the mechanism that makes "`user` null while `screen === 'dashboard'`" reachable (§4.3). Untouched by this build.

### F3 · MED · `ReporterDesk`'s memo and `InlineTradingGradeCard`'s effect are total only because their callers are

Both are now guarded (see §5.3 and the review response), so neither is a live defect. Recorded because both depend on a caller-side invariant that nothing asserts: `FantasyTimesFeed` must never pass a malformed `stories`, and `AgentChat` must never pass a falsy `trade`.

### F4 · LOW · Three copies of the rank ladder

`src/services/battleTimer.js:265-270`, `src/screens/ProfileScreen.jsx:29`, and the literal in `src/App.jsx`. The third has drifted completely (F1). A §9 consolidation task.

### F5 · NIT · `SpotlightTour` is redefined on every `PortfolioDuel` render

It is a ~300-line component declared inside the component body (`src/App.jsx:8295`), so React deletes and recreates its fiber on every parent render and its three `useState` values reset each time. That is what makes its conditional hooks harmless (§5.2), but it is a real inefficiency and a trap: hoisting it is the natural cleanup and would change behaviour. The review response made both its effects correct under either shape so the trap is defused, but the redefinition itself is untouched.

---

## 9. Verification

### 9.1 Full suite — three runs at the CI worker count, exit code asserted

Run unpiped with output redirected to a file (redirection is not a pipe, so `$?` is the command's own status), never through `tail` or `head`. `--maxWorkers=2` is the flag `tests.yml` uses.

| # | Command | Exit | Test files | Tests |
|---|---|---:|---|---|
| 1 | `npm run test:run -- --maxWorkers=2` | **0** | 665 passed, 3 skipped (668) | 12,479 passed, 64 skipped, **0 failed** |
| 2 | same | **0** | 665 passed, 3 skipped (668) | 12,479 passed, 64 skipped, **0 failed** |
| 3 | same | **0** | 665 passed, 3 skipped (668) | 12,479 passed, 64 skipped, **0 failed** |

Durations 198.91s / 190.77s / 193.72s. Run at the final HEAD `edc97670`, after every review-response commit.

**All three runs produced identical counts and identical exit codes.** That matters here: the discovery record's §8 F1 documented a nondeterministic teardown flake in this suite that reddened one of its three runs at random on a byte-identical tree. That flake is gone — lens C confirmed the root cause has since been fixed (`src/components/shared/AnimatedScore.jsx:40-43` now clears its timer and rAF on unmount) — and three clean runs at the CI flag is the evidence.

The count is 12,479 rather than the base's 12,478 + 7 because the base figure moved with merged work; what matters is that all three runs agree and none fails. The 8 new rows are: 3 in `App.xpModal.jsdom.test.jsx`, 5 in `A4.conditionalHooks.jsdom.test.jsx`.

### 9.2 Lint — before and after

Measured directly at both ends, not inferred: the base number comes from a `git archive fd470b16` extraction linted with the same config, not from the discovery record.

| | Base `fd470b16` | This branch | Δ |
|---|---:|---:|---:|
| **Repo-wide errors** (`npx eslint .`) | 901 | **875** | −26 |
| Repo-wide warnings | 119 | **119** | 0 |
| `no-undef` | 6 | **2** | −4 |
| `react-hooks/rules-of-hooks` | 19 | **0** | −19 |
| `src/` errors | 757 | **731** | −26 |

The base figure of 901 errors / 119 warnings / 6 `no-undef` / 19 `rules-of-hooks` reproduces the discovery record's numbers exactly.

**Every one of the 26 is accounted for, and nothing was added.** A set-difference of the two JSON reports:

- 4 × `no-undef` (the A1 identifiers)
- 19 × `react-hooks/rules-of-hooks` (all of A4)
- 3 × `no-unused-vars` — `xpProgress`, `xpNeeded`, `nextRank` were *also* reported unused at their old declaration site, because nothing in that scope read them. Fixing A1 retired both reports at once.
- **0 errors added.**

Warnings are unchanged repo-wide. The review response retired an unused `eslint-disable` directive that ESLint was reporting on every run (B-4) and resolved an `exhaustive-deps` warning by adding `showSpotlightTour` to the deps; the `ReporterDesk` bail added for B-1 needs one directive of its own, so the three net to zero.

All figures re-measured at the final HEAD `edc97670`, after every review-response commit.

### 9.3 Build

`npx vite build` → **exit 0**, built in 29.80s at the final HEAD. Only the pre-existing "chunks larger than 500 kB" advisory. `dist/` removed afterwards; it is gitignored and the tree is clean.

The build also supplied the evidence for §6.1: after a clean build, `dist/assets/index-*.js` contains **zero** occurrences of `process.env` and zero of the dev banner's markup, which is how the two remaining `no-undef` were established as lint-only rather than live.

### 9.4 Fence and flags

`git diff --name-only origin/main` touches **no** `api/` path, so no §1 fenced file is in the diff — verified mechanically against the fence list at this HEAD, not by eye. No `featureFlags.js`. No `DARK_BY_DESIGN`. No manifest change. Nothing dark was flipped and nothing new was added to flip: these are fixes to code that crashes.

---
### 7.4 Lens D — the mutation pass

17 mutants against the production code the two new test files cover, each applied to a clean tree, run against both files, then restored and the tree verified clean before the next. **Final score: 10 KILLED / 7 SURVIVED.**

*Disclosure on how this lens was run.* It was commissioned as a subagent on its own `git archive` extraction, and got 21 mutants in before **the container restarted and killed it mid-run**. Its logs survived (11 killed / 10 survived) but its write-up did not, so the campaign was re-run here from a scripted, fully described mutant set against the final commit. The numbers below are from that re-run, which is the one whose mutants are individually described and reproducible; the subagent's logs are retained in the scratchpad. The re-run was performed by the coordinator on the working tree rather than by an isolated reviewer — a deviation from §2 reviewer isolation forced by the restart, and mitigated by the script backing up and restoring each file and by `git status` being verified clean after every mutant and at the end.

**The harness is proven to discriminate: it reported 7 survivors, and one of them was a real defect in the test.**

| id | Mutation | Verdict | Evidence |
|---|---|---|---|
| M1 | Re-introduce A1 (the modal's `xpForNextLevel` no longer declared) | **KILLED** | `ReferenceError: xpForNextLevel is not defined` — 3 xpModal rows red, 5 A4 rows green |
| M2 | `xpForNextLevel` 10000 → 12000 | **KILLED** | 3 rows red |
| M3 | `xpProgress` `* 100` → `* 50` | **KILLED** | bar-width row red |
| M4 | `xpNeeded` subtraction flipped | **KILLED** (after fix) | **survived first** — see below |
| M5 | `ranks` ladder reordered (Expert ↔ Master) | **KILLED** | next-rank row red |
| M6 | Re-introduce C-1 (drop `user &&` from the modal gate) | **KILLED** | `TypeError: Cannot read properties of null (reading 'rank')` |
| M7 | Drop the `user ?` guard from `xpProgress` | **KILLED** | `TypeError: … (reading 'xp')` |
| M8 | Re-introduce A4 in `TacticalRow` (early return back above both memos) | **KILLED** | `Rendered more hooks than during the previous render.` |
| M9 | `asset ?? {}` back to `asset` | **KILLED** | destructure of null throws |
| M10 | Re-introduce C-9 (`history` default back to a fresh literal) | SURVIVED | Correct: identical values, only memo-invalidation frequency changes. Not a correctness defect and no test should claim otherwise. |
| M11 | Re-introduce A4 in `StonkOptionsPosition` | **KILLED** | `Rendered more hooks than during the previous render.` |
| M12 | Re-introduce B-5 (drop `isCall` from the deps) | SURVIVED | Correct: divergence needs in-place mutation of `contract.direction`, which no in-repo caller does (lens B established this independently). |
| M13 | `if (!contract) return 0;` → `return 100;` | SURVIVED | Correct: the guarded path's value is never read. |
| M14 | Re-introduce B-1 (drop `ReporterDesk`'s memo bail) | SURVIVED | **Real coverage gap, correctly out of scope.** No test mounts `ReporterDesk`; the defect it guards is unreachable through the shipped caller. |
| M15 | Drop `if (!showSpotlightTour) return;` from the Escape effect | SURVIVED | **Real coverage gap.** Nothing mounts `SpotlightTour`. |
| M16 | Re-introduce B-3 (drop `showSpotlightTour` from the Escape deps) | SURVIVED | Same gap; and today the remount masks it, which is the point of B-3. |
| M17 | Drop `SpotlightTour`'s early return (the tour renders always) | SURVIVED | Same gap — and the most visible of the three, since it would paint the tour over every screen. |

**M4 is why this pass was worth running.** The row asserted `expect(container.textContent).toContain('4000 XP to next rank')`, and the mutant renders `-4000 XP to next rank` — which still *contains* that string. A substring match over the whole container is blind to a sign flip. Both value assertions now compare the exact trimmed text of the modal's own `<p>` elements, and the mutant dies (`edc97670`). That is a defect in the guard, found by the guard's own adversary, and it is exactly the failure mode BUILD_RULES §2's mutation requirement exists to catch.

**The surviving cluster worth naming: `SpotlightTour` (M15-M17) and `ReporterDesk` (M14).** Four of the seven survivors are in code this build *touched* but no test *mounts*. That is honest scope — both are static sites whose guard is the lint rule — but it means the review response's own fixes to them (B-1, B-3) are unguarded by the suite. Ranked as coverage to close: **(1)** mount `SpotlightTour` and assert Escape-to-close plus "no scroll while shut"; **(2)** mount `ReporterDesk` with a malformed `stories`; **(3)** nothing else — M10, M12 and M13 are correctly unguarded.

---

## 10. Deviations from the prescribed build

Enumerated with reasons, per the task's standing instruction. Nothing was improvised silently.

| # | Deviation | Reason |
|---|---|---|
| 1 | **Commit C was not made.** | The task's own STOP condition fired: `no-undef` is 2, not 0, after A and B. §6. This is compliance with the prescription, recorded here as a deviation from the three-commit shape because the deliverable list named three commits. |
| 2 | **A fourth commit exists** (`cf85b8e5`, the review response). | The §2 review ran *inside* the task, as the prompt directed, and produced five CONFIRMED findings in the code it reviewed. Folding them into A and B would have required rewriting pushed-shape history; a separate, clearly-labelled commit keeps A's and B's messages accurate and makes the review's effect auditable. |
| 3 | **Branch name.** | The harness pre-created and checked out its session-default branch (`claude/cool-babbage-5ppbp7`). The task names `claude/fix-crash-class-a1-a4` and says never the session default, so that branch was cut from `origin/main` at the same SHA. Nothing was committed to the default-named branch. |
| 4 | **A third classification bucket** was introduced for A4 ("flip-able but not crash-class"). | The prescribed binary did not survive contact with React: a flip-able condition does not crash when the early return precedes the component's only hook. Reporting `DesktopBackground` as either "crash-class" or "static" would have been false. §5.1. |
| 5 | **Two test rows were written, run, and deleted.** | The `DesktopBackground` flip rows passed against the pre-fix tree. BUILD_RULES §2: a row that cannot fail under the defect it names is not a guard. They are recorded here rather than kept green in the suite. |
| 6 | **The mutating lens was re-run by the coordinator, not by an isolated reviewer.** | The subagent running it on its own extraction was killed mid-campaign by a container restart (21 mutants logged, write-up lost). The pass was re-run here from a scripted, individually-described mutant set, with each file backed up and restored and `git status` verified clean after every mutant. §7.4 states this in place. |
| 7 | **The preview smoke was not executed.** | Vercel preview only exists after the push, and clicking through it is a human action on a deployed surface. The smoke list is in §12 for the founder; this report does not claim it was run. |

---

## 11. Disclosure for the PR body

> Fixes two crash-class defects the lint cleanup made visible: the XP modal referenced four values outside their scope and unmounted the app the moment it rendered; nineteen React hooks across eleven files were called conditionally, which crashes the component whenever the condition changes between renders. No visual change on any path that worked. CI now gates on the two lint rules that catch these classes.

**The last sentence is not true of this branch and must be struck or amended before the PR is opened.** The gate was NOT added — the task's own STOP condition fired, because `no-undef` is at 2 rather than 0 after A and B (§6). Suggested replacement for that sentence:

> The interim CI gate is not in this PR: of the two rules it would gate on, `react-hooks/rules-of-hooks` is now at zero but `no-undef` still has two pre-existing `process` reads outside this task's scope, and the instruction was not to land a gate that starts red. §6 of the record lists the three ways to close it.

One further sentence is worth adding, because it changes what a player sees:

> The XP modal now renders. Its rank ladder disagrees with the one the app actually assigns, so for most accounts the "next rank" label is wrong — a pre-existing defect this fix makes visible for the first time, recorded as F1 for separate tasking.

---

## 12. Handover — the preview smoke

**Preview URL:** _Vercel builds the preview from the pushed branch; the URL appears on the branch/PR in the Vercel dashboard. This session pushed but did not open a preview — BUILD_RULES §2, pushed ≠ deployed, and clicking through a deployed surface is not something this session can do. **The list below was not executed; it is for the founder.**_

Branch: `claude/fix-crash-class-a1-a4`

**1 — The XP modal (the A1 fix, and the finding it exposes).**
Log in → dashboard → desktop bottom stats bar → click the **Rank chip**.
- It should open instead of blanking the app. That is the fix.
- **Expect the "next rank" label to be wrong** — for most accounts it will say `Rookie`. That is finding **F1** (§8), a pre-existing ladder mismatch this fix makes visible. It is not a regression from this build; it is the thing to decide about.

**2 — Snake Draft, the two gold-standard surfaces, through a pick.**
Open a Snake Draft → watch `TacticalRow` rows and `DraftBattleScreenV2` render **through a pick landing** (an empty slot filling is the exact flip that used to crash) → let it run to `DraftCompleteScreen`.
- Rows, altitude map and console should look exactly as they do on `main`. Mounted before/after renders say they are byte-identical (§5.5); this is the human confirmation.

**3 — Each other affected screen, once.**

| Screen | What changed there | What to look for |
|---|---|---|
| Options Arena | `StonkOptionsPosition` — the second genuinely crash-class site | Open a position card **before prices load**, then let a price land. Used to crash on exactly that transition. |
| Agent Battle → chat → "Grade Today's Trades" | `InlineTradingGradeCard` | Tap a grade; it should stick, not revert. |
| FantasyTimes feed | `EditorialStory`, `ReporterDesk` | Switch reporter tabs; stories render and sort as before. |
| Forge → a collection | `CollectionDetailSheet` | Open and close the sheet; progression hints unchanged. |
| Compete tab → a sector | `SectorLeaderboard` | The leaderboard renders and the show-all toggle works. |
| Any screen, resized across the tablet breakpoint | `DesktopBackground` | The particle/gradient backdrop appears and disappears cleanly. |
| The onboarding Spotlight Tour | `SpotlightTour`'s two effects | Open the tour, step through it, press **Escape** — Escape-to-close must still work, and the page must not scroll when the tour is shut. |

**If anything in 2 or 3 looks different from `main`, that is a regression this build's evidence missed — the invariant was no visual change on any path that works today.**

---

