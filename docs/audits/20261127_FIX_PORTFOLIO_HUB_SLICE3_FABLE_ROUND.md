# Portfolio hub, slice 3 — the Fable round (fix report)

**Date:** 27 Nov 2026 · **Branch:** `claude/portfolio-hub-s3-tabs-and-overview` (draft PR #1124; worked in the session worktree, switched to the PR's own branch) · **Prompt:** "Fix prompt: Portfolio hub slice 3, the Fable round" · **Review answered:** `docs/audits/20261127_FABLE_REVIEW_PORTFOLIO_HUB_SLICE3.md` (S3F-1 to S3F-15), committed here unchanged. · **The switch stays off on this branch.** Draft; not merged; not marked ready; CI not watched.

**Step 0.** `git fetch origin` ran first. PR #1124 was an open draft at `4062518a`, as the prompt said (ST-1 did not fire). `main` was `a037e022`; it moved to `4550a13e` (PR #1125, Explore Build 2) during the run and was merged again before the final checks.

**Stops.** None fired.
- ST-2: the first merge of `main` conflicted in `docs/README.md` only; the second merged clean.
- ST-3: the first full Linux suite on the merged tree had one red row, in a file neither side touched: `api/_utils/gemmaClient.test.js` "abort DURING BODY READ" (its own anti-vacuity check, which fails when the loopback server's headers arrive after the abort timer under load). Run alone three times on the same commit: 24 of 24 each time. A timing flake, not a failure of the merged tree; the final suite is the record (§3).
- ST-4: no fix changed a non-map file of the switch-off build (§3).
- ST-5: no hub guard forbade the pressed state.

| Question | Answer |
|---|---|
| Is the PR mergeable now? | **Yes, by its content.** `main` is merged in (twice: `a037e022`, then `4550a13e` when it moved during the run), and GitHub reports no conflict. It stays a draft on Hold for the direction chat; CI was running when last read and was not watched. |
| What changed for a player with the switch on? | Two things a player would notice: the first deployment's "Needs you" button now says **"Hold to deploy"**, and **pressing a desk row, an idea's header or a name's row shows at once** (the row lightens while held). Nothing changes with the switch off. |
| The five fixes | All done, each with a row that fails without it (§2). |
| The checks | All at the code head `478fd4b4` on the merged tree: **full Linux suite exit 0, 39,743 passed, 0 failed** (1,716 files); `lint:gate` exit 0; `test:rules` exit 0, 889 of 889; **switch-off build: every non-map file of its 125 byte-identical to `main`'s**; a switch-on build carries the book layout; every new or changed row shown failing without its fix; one refuter pass (26 mutants); a real browser at 320 and 390. |
| Why didn't the founder's preview show the book? | **The preview environment has no player list.** The book's allowlist (`PRACTICE_FIELD_PLAYER_UIDS`) and the cockpit allowlist (`COCKPIT_ALLOWLIST_UIDS`) are set in Vercel for **Production only**. On a preview every account reads as "not admitted", so the book's read answers the app's own 404 and the hub falls back to today's layout. Not a missing function, not a different account (§4). |
| The smoke preview | https://trade-seven-3h2y7znha-fais-projects-bc179554.vercel.app (smoke `f2a81983`) |
| Anything for you? | One decision: whether to add the two lists to Vercel's Preview environment (§4.5). Two questions (§6). |

## 1. In plain terms: what changed for a player with the switch on

- **"Needs you" for a brand-new player.** The strip that offers the first BaggerBomb game against a CPU used to show a button reading "Deploy". It is a hold button, so a tap did nothing. It now reads **"Hold to deploy"**, the same words as the card it replaces. A screen reader still hears "Hold to deploy. Press and hold, or press Enter or Space to deploy now." While the hold locks in, the button still says "Locked in". At 320 and 390 the button and "Later" sit side by side inside the strip (§3.3).
- **Pressing a row shows.** In the hub, the Idea book's desk rows, its ideas' headers and its names' rows used to show nothing on a phone press, because the Idea book turns off the browser's own tap flash and its own press style is not loaded in the hub. Now the row lightens at once while it is pressed, and goes back when released. No animation, no movement. Only in the book layout's Overview (and in Setups, which has no tappable row yet).
- **Everything else is as slice 3 left it.** The words of every "Needs you" kind are now pinned by a test, word for word, and none says "Shadow" or a barred word.
- **For a Practice Field builder:** if they add a function to the Idea book's screen file, the Command Center test that fails now says what to do.

## 2. The five findings

| Finding | What was done | The row that pins it | Shown failing without it |
|---|---|---|---|
| **S3F-1** the conflict with `main` | `origin/main` merged twice, as `BUILD_RULES` and the merged-tree rule say: `a037e022` (B6 #1121, company names #1123) in `8ac8b252`, then `4550a13e` (Explore Build 2 #1125) in `8baeca12`. The only conflict was `docs/README.md`: every row from both sides kept (checked line by line: none missing, none added). **"Shadow" after B6:** the builder's server-side scan (every one of the 21 scenes, built with the hub's agent "Atlas", every shown string but the desk ids) found none; the slice's "Shadow" pinning rows pass on the merged tree (§3). B6's own replacement in a desk's own words (`bookView.js` `deskOwnWords`, `OLD_DESK_NAME`) closes the last source the review named. | The bookLayout suite's §7 rows (unchanged) | — |
| **S3F-2** the guard explains itself | Every check in the row "slice 3: the Idea book parts the hub draws…" carries one message: the Command Center draws parts of this file; add a new function to DRAWN if `BookLine`, `Strip`, `PosTable` or `DesksTab`, or anything they call, uses it, otherwise to PAGE_ONLY; a DRAWN function may hold no effect, timer, listener, observer or read; and for "Part -> function" (e.g. `PosTable -> Quiet`): move the callee to DRAWN if it holds none of those, otherwise the drawn part must not call it (take what it needs as a prop, or ask the Command Center's owner). One comment line at the top of `IdeaBookScreen.jsx` points at the guard. The bundle row's site count now says "If you added or removed a switch site on purpose, update this count (SLICE3_FILES)". | `commandCenterHub.mount.guard.test.js` (the row named above); `portfolioHub.flagOffBundle.test.js` (the per-file row) | A planted function and a planted `PosTable -> Quiet`: with the fix, the failure prints the guide; with the guard as it was, a bare list (§3.4, R4a to R4d). The count message prints (R5). |
| **S3F-3** "Hold to deploy" | `sections/BookOverview.jsx`: the strip's hold takes `COPY.deploy.hold`, the card's own entry. No new string. The selector's candidate (`hub/nextAction.js`, whose short "Deploy" today's card never draws) is untouched, so nothing in today's hub changes. HubHold already names a control that offers the hold by `COPY.deploy.holdLabel`, so the screen-reader name is unchanged, and "Locked in" comes from HubHold too. | The S3F-5 row below (label, name and "Locked in") | The label put back to `candidate.cta`: the row fails on `[ 'Deploy', 'Later' ]` (R1). |
| **S3F-4** a pressed state | `BookLayout.jsx`: `BookPanel` draws one `<style data-hub-book-press>` beside the tab panel: `[data-hub-book-overview] .ib-tap:active, [data-hub-book-setups] .ib-tap:active { background-image: linear-gradient(rgba(var(--ft-scrim-rgb), 0.08), rgba(var(--ft-scrim-rgb), 0.08)) !important; }`. The token's scrim is laid over the row's own background, so an idea's header (which has a card colour of its own) lightens as much as a bare row. `!important` beats the rows' inline `background`. No transition, animation or transform. A plain string in one of the slice's new modules, never the hub's shared style string, so with the switch off nothing of it ships. | `CommandCenterHub.bookLayout.jsdom.test.jsx` "a press on the Idea book's rows shows at once in the hub" (two rows at both sites): the exact rule, its two scopes, a token, `!important`, nothing that moves, outside the panel and outside `HUB_SCOPED_CSS`, reaching both desk rows, every slot header and every name row; and none of it in today's hub | Rule removed (R2), `!important` dropped (R2b), a `transition` added (R2c, also caught by the mount guard's motion scan), the scope dropped (R2d), moved into the shared string (R2e), drawn in today's hub (R2f): each fails. |
| **S3F-5** every kind's real words | One row builds every next action through the hub's own selector (`deriveNextAction`, with `liveGameRows` and `huddleCandidateOf`) and the real copy, draws the strip and pins, word for word: the title, the visible labels and the screen-reader names, as the review's C.1 lists them with S3F-3's label. It checks that nothing else is drawn, and scans every word and label for "Shadow" and for spec §5's barred words ("stop", "target", "progress mark", "plan", "setup", "strategy", "tests", and "remembers" from §5's table). | `CommandCenterHub.bookLayout.jsdom.test.jsx` "every kind, from the real selector and the real copy…" | "Shadow" planted in the Huddle's title (R3a) and a barred word in "Open game" (R3b): each fails. |

**The words the S3F-5 row pins** (C.1, with S3F-3):

| Kind | Title | Button | Its screen-reader name |
|---|---|---|---|
| A live game, open | "Open your live game" | "Open game" | "Open game" |
| A game deployed, waiting for the open | "Your game is deployed" | "Open game" | "Open game" |
| A review | "Review your Nov 26 game in the Film Room" | "Open Film Room" | "Open Film Room" |
| A review whose day can't be read | "Review your game in the Film Room" | "Open Film Room" | "Open Film Room" |
| The Huddle | "Huddle ready" | "Open huddle" | "Open huddle" |
| The first deployment | "Play your first BaggerBomb game against a CPU" | **"Hold to deploy"** (then "Locked in") | "Hold to deploy. Press and hold, or press Enter or Space to deploy now." |
| Every kind | — | "Later" | "Later" |

## 3. The checks

Everything below ran at the code head **`478fd4b4`**, which contains `origin/main` `4550a13e` (fetched again just before; it had not moved). The commits after it hold only this report, its pictures and its index row.

| Check | Where | Result |
|---|---|---|
| **Full Linux suite** | WSL Ubuntu, Node 20.20.2, `TZ=UTC`, 8 workers, under `flock`, nothing else running | **exit 0: 1,716 files, 39,743 passed, 0 failed, 202 skipped** (535 s) |
| The same, at the first merge `8ac8b252` (the ST-3 check, before any fix) | the same | exit 1: 39,596 passed, **1 failed**: `api/_utils/gemmaClient.test.js` "abort DURING BODY READ" (its anti-vacuity check: the abort landed before the headers). Alone, three times on that commit: 24 of 24 each. Neither side touched the file since the base. A timing flake; the run above is the record. |
| `npm run lint:gate` | WSL | **exit 0** |
| `npm run test:rules` | WSL, JDK 21, the Firestore emulator | **exit 0: 48 files, 889 of 889** |
| **The switch-off build against `main`** | `vite build` of `main` `4550a13e` and of the head, one after the other in ONE tree (so paths match) | **125 files each; 0 non-map files differ; none only on one side.** The hub chunk is `CommandCenterHub-Cou6ReS3.js` in both. One source map differs, the hub chunk's (`vite.config.js` sets `sourcemap: true`, and its sources carry the changed files' text). No fix changed a non-map file (ST-4). |
| A switch-on build | the same tree, the literal set true there, then restored | Builds; the hub chunk `CommandCenterHub-DUS7OnNP.js` carries "Needs you", the Overview (`data-hub-book-overview`) and the pressed state (`data-hub-book-press`, its `:active` rule). The switch-off build has neither of the last two. |
| The slice's own files, the hub's guards, the theme guards, the Practice Field directory | Windows, the worktree | 15 files, 1,063 rows, all pass (after the refuter's round: the 8 touched, 1,022 rows) |

### 3.1 Each new or changed row, failing without its fix (an LF snapshot; never the worktree)

| # | What was undone or planted | The row | Result |
|---|---|---|---|
| R1 | The strip's label back to `candidate.cta` (S3F-3 undone) | S3F-5 | **fails**: "the first deployment: the visible labels: expected [ 'Deploy', 'Later' ]" |
| R2 | The press style removed (S3F-4 undone) | S3F-4, both sites | **fails**: no style element |
| R2b | `!important` dropped | S3F-4 | **fails** (the exact rule) |
| R2c | A `transition` added | S3F-4, and the mount guard's motion scan | **fails** in both |
| R2d | The scope dropped (`.ib-tap:active` for the whole app) | S3F-4 | **fails** |
| R2e | The rule put in the hub's shared style string | S3F-4 | **fails**: the shared string matches `ib-tap` |
| R2f | Today's hub draws the style element | S3F-4, "today's hub carries none of it", both sites | **fails** |
| R3a | "Shadow" in the Huddle's title | S3F-5 | **fails** |
| R3b | A barred word in "Open game" ("Open game plan") | S3F-5 | **fails** |
| R4a / R4b | A new function in `IdeaBookScreen.jsx`, with the guide / with the guard as it was | the guard row | **fails both ways**: with the fix the failure starts "IdeaBookScreen.jsx gained or lost a top-level function." and prints the guide; before it, a bare `expected [ 'BookLine', 'DeskSection', …(15) ] to deeply equal [ …(14) ]` |
| R4c / R4d | `PosTable` calls `Quiet`, with the guide / as it was | the guard row | **fails both ways**: "A part the Command Center draws now calls a page-only function of IdeaBookScreen.jsx." and the guide, then `[ 'PosTable -> Quiet' ]`; before it, the bare list |
| R5 | The hub file's site count bumped | the bundle row | **fails** with "If you added or removed a switch site on purpose, update this count (SLICE3_FILES)" |
| M03, M12 | After the refuter: an `aria-roledescription` with "Shadow" on the strip; `media="print"` on the style | S3F-5; S3F-4 | **fail** (both survived before the refuter's round) |
| M20a / M20c | An arrow-function helper with an effect; the same written as a function declaration and listed in PAGE_ONLY | the guard row | M20a **fails** with the corrected guide; M20c **passes** (the guide's advice works) |
| C0, C1 | No change | all of the above | pass |

### 3.2 The refuter pass

One independent agent, on its own snapshot, read-only on git, told to refute each fix and plant a bug per new row. **26 mutants.** Unmutated, 303 rows across the book layout, the switch parity, the test-integrity, the hub and the Idea book screen suites passed, as did the guards (806), the bundle rows (20) and seven source-scanning censuses (154).

| Fix | Verdict | Findings and what happened |
|---|---|---|
| S3F-3 | **REFUTED** (holds) | The card uses the same entry; "Deploy" and "Hold to deploy" are both in `OFFERS_HOLD`, so the screen-reader name is the same before and after; "Locked in" ignores the label; nothing ships with the switch off. |
| S3F-4 | Cascade **REFUTED** (holds); two minor **CONFIRMED** | It forced `:active` over CDP in Edge: the gradient paints over an inline `background` and the pixels change. **(a)** The Setups scope reaches no row today (the Desks content draws no button). **Fixed:** the docblock says so and that the scope is for slice 5's; the row asserts only that the scope is there. **(b)** `media="print"` on the style survived. **Fixed:** the row pins the element's attributes (M12). Recorded: only the jsdom row, not the mount guard, keeps the rule out of `HUB_SCOPED_CSS`. |
| S3F-2 | One **CONFIRMED** | The guide said every top-level function is listed, but the row lists function **declarations** only; a page-only arrow helper holding an effect was a dead end (listing it fails the row again). **Fixed:** the guide and the header line say "declaration", and tell the builder to write such a helper as a function declaration (M20a, M20c). The "PosTable -> Quiet" advice was right (moving `Quiet` to DRAWN passes). |
| S3F-5 | **REFUTED** (holds) | Real selector, real copy, literal expected words, every kind the selector can return; a why or a detail drawn into the strip is caught. One minor survivor: an `aria-roledescription` was not scanned. **Fixed** (M03). |
| Other | Note | The whole-page "Shadow" rows walk every text node, including a `<style>`'s, so a `box-shadow` added to the press rule would turn them red with the CSS as the hit. **Not changed** (it would alter slice 3's pinning rows); the S3F-4 row pins the exact rule, so a change to it fails there first with a plain diff. For slice 4 or the flip. |

### 3.3 The real browser (S3F-3's fit and S3F-4's press)

Headless Edge over the slice's harness: the real `CommandCenterHub`, the switch on in an LF copy of `48078e8c` only (the code since then changes comments and tests), readers stubbed at the jsdom suites' seams, the book read answering server-built views, the app's three style sheets. Pictures: `docs/audits/20261127_PORTFOLIO_HUB_SLICE3_FABLE_ROUND_PICTURES/` (14).

**The first-deployment strip:**

| Width | Strip | Title | "Hold to deploy" | "Later" | Overflow |
|---|---|---|---|---|---|
| 320 | 292 × 92 px | two lines | 151 × 44 px, inside, not clipped | 56 × 44 px, inside, same line | none (page, strip, buttons) |
| 390 | 362 × 75 px | one line | 151 × 44 px, inside, not clipped | 56 × 44 px, inside, same line | none |

The screen-reader name read in the browser: "Hold to deploy. Press and hold, or press Enter or Space to deploy now." No page error.

**The pressed state** (a mouse held down on the row: a forced `:active`):

| Row | Width | While held | Mean colour of the row, before → held |
|---|---|---|---|
| A desk row | 320 / 390 | the scrim gradient; transition 0 s; no transform, no animation; gone on release | 31,35,42 → 47,51,57 / 27,31,37 → 43,47,53 |
| An idea's header (card colour of its own) | 320 / 390 | the same, over its own `rgb(21, 23, 30)` | 26,28,35 → 43,45,52 / 25,27,34 → 42,44,50 |
| A name's row | 320 / 390 | the same | 20,24,30 → 38,42,47 / 19,23,29 → 37,41,46 |

**By touch: checked by reading.** The harness could not press by touch at all: neither raw CDP touch events nor Chromium's own synthesized tap set `:active`, even on a plain control button outside the hub. A phone press relies on what the Idea book's own screen relies on: iOS Safari applies `:active` on touch only where a touch listener is registered, and React 19 registers a passive `touchstart` on the root. The founder's walk before the flip is where it is seen (PH-34).

## 4. The founder's preview: why it showed today's hub

### 4.1 Which deployment that URL is

`https://trade-seven-1z0x9lw31-fais-projects-bc179554.vercel.app` is **the smoke branch's preview**, commit `15e5bdce` (slice 3's head `4062518a` with the switch on). Vercel: deployment `dpl_7ehmsPb4T56G25VNu6v5cFCv1B6e`, target preview, ready; GitHub's deployment record for `15e5bdce` names this URL. Its hub chunk carries the book layout ("Needs you", the Overview, the tab list's name). So the code was there; the book's read did not let it show.

### 4.2 The three 404s: the app's own answer

Asked with no sign-in, the same deployment answers:

| Path | No sign-in | What it shows |
|---|---|---|
| `/api/practice-field/book` | **401** `{"error":"Authentication required",…}` (JSON, 87 bytes) | The function is there and the screen is on. A signed-in caller passes this step. |
| `/api/forge/watchlists/{id}/hypothesis-versions` | **401**, the same | The function is there and its switch is on. |
| `/api/agent/cockpit-status` (the research door's admission) | **401**, the same | The same. |
| `/api/huddle/status` | **404** `{"error":"not_found"}` (JSON, 21 bytes), before any sign-in check | The Huddle is off in this deployment for everyone (below). |
| A path that does not exist | **404** `text/plain`, header `X-Vercel-Error: NOT_FOUND`, "The page could not be found…" | What a missing function looks like. None of the three answered this way. |

So, telling the three causes apart:
- **A function missing from the preview:** no. A missing function answers Vercel's own plain-text 404 with `X-Vercel-Error`; these answer the app's JSON.
- **The app's own "not admitted" answer:** yes. The book's route answers 404 `{"error":"disabled"}` at step 5 of its gate (`api/practice-field/book.js:44`), which comes **after** the sign-in token is verified (step 4). The founder got 404, not 401, so the token was accepted and the uid then failed the player list. The hypothesis route does the same (`api/_utils/hypothesisRecords/http.js:38`, the cockpit allowlist). The research door's "Not on this account" is the cockpit-status answer `allowlisted: false` from the same list.
- **A different account from the one on the list:** no. On a preview **no** account can be admitted, because the lists are not there at all (4.3). The founder's account is the same one production knows: the preview's client uses the same Firebase project as production (the `projectId` in both client bundles is the same), and the preview's server accepted the founder's token.

The body sizes the browser showed (156 and 163 bytes) are larger than the bodies the code sends (`{"error":"disabled"}` is 20 bytes, `{"error":"not_found"}` 21); the browser's figure likely counts the response's headers too. The no-sign-in check above is what tells the causes apart.

### 4.3 How the book's route admits an account

- The rule is **code reading an environment variable** at call time: `PRACTICE_FIELD_MODE` is `'allowlist'` in code (`src/config/practiceFieldFlags.js:35`), and at `'allowlist'` `practiceFieldAdmits(uid)` admits a uid only if it is on `PRACTICE_FIELD_PLAYER_UIDS`, a comma-separated list read from the environment each time (`api/_utils/practiceField/mode.js`, `api/_utils/practiceField/playerList.js`). The screen's own switch is code too (`PRACTICE_FIELD_SCREEN_ENABLED = true`, `src/config/practiceFieldScreenFlags.js:25`). No Firestore document decides it.
- **Environment variables the book's read needs** (names only): `PRACTICE_FIELD_PLAYER_UIDS`; and for the sign-in check and the read, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. (`MANDATE_FOUNDER_UIDS` is the Film Room seam's narrower gate, not the book's read.)
- **The Shared Research admission needs** (names only): `COCKPIT_ALLOWLIST_UIDS` (the cockpit-status verdict the hub's research door asks for, and the research route's own gate through the hypothesis records' allowlist), and the same three `FIREBASE_*` for the sign-in check and the battle read. The Forge hypothesis route needs `COCKPIT_ALLOWLIST_UIDS` too.
- The Huddle: `HUDDLE_PLAYER_UIDS` (its cohort; empty means off for everyone, before any sign-in check).

### 4.4 What Vercel's environments hold (the CLI's listing: names and environments only)

The Vercel CLI was signed in. `vercel env ls` (no values read or printed):

| Name | Environments |
|---|---|
| `PRACTICE_FIELD_PLAYER_UIDS` | **Production only** |
| `COCKPIT_ALLOWLIST_UIDS` | **Production only** |
| `HUDDLE_PLAYER_UIDS` | **Preview, for the branch `claude/huddle-s1-smoke` only** (not Production) |
| `MANDATE_FOUNDER_UIDS` | Preview, Production |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Preview, Production |
| `VITE_FIREBASE_*` (the client's six) | Development, Preview, Production |

- **The preview admits nobody to the book, the Forge records or Shared Research**, because the two lists exist for Production only.
- **The Huddle is off on this preview and in production alike**: its cohort is set only for the old Huddle smoke branch's previews. That 404 is not part of this problem.
- **Firebase:** previews use the same Firebase project as production. The client's project id is identical in the preview's and production's bundles, and the preview's server verified the founder's production sign-in. So a preview reads production's documents (reads only, for the book).

### 4.5 The change that would make the preview walkable (not made)

**Add `PRACTICE_FIELD_PLAYER_UIDS` and `COCKPIT_ALLOWLIST_UIDS` to Vercel's Preview environment with the same values as Production (or only for the branch `claude/portfolio-hub-s3-smoke`), then redeploy the smoke preview, because a deployment keeps the variables it was built with.** Optionally add `HUDDLE_PLAYER_UIDS` to that branch's Preview too, if the walk should include the Huddle.

### 4.6 The smoke preview for this round

- **`claude/portfolio-hub-s3-smoke` @ `f2a81983`** = the code head `478fd4b4` plus the old smoke commit's exact three-file diff (`4062518a..15e5bdce`): the literal true, the pin's value row, the pin guard row turned around, the DARK_BY_DESIGN entry removed, and the docstring line. Composed by git plumbing on a temporary index; `git diff --stat 478fd4b4 f2a81983` is those 3 files (+4 −6). Force-pushed with a lease on `15e5bdce`. Never merged, no PR. The stale "ships off" comment (S3F-15) is left for the flip, as Amendment B carries it.
- On a snapshot of it: `commandCenterPortfolioFlags.test.js`, `flagPinGuard.test.js` and the switch parity suite, 40 of 40.
- **Preview:** https://trade-seven-3h2y7znha-fais-projects-bc179554.vercel.app (Vercel deployment `dpl_8ru2W1PkEJvpqvuWws9S4TVzcAA8`, ready; its hub chunk carries the book layout and this round's pressed state, `data-hub-book-press`; with no sign-in the book route answers 401 and the Huddle's 404, as in §4.2).
- This report's commit lands after the smoke; it holds docs only.
- **It will show the book only after §4.5's change**: until the Preview environment has the player list, it gives today's hub to every account, exactly as the founder saw.

## 5. What Practice Field B6 (PR #1121) changed in the fields the hub reads

For slice 2's prompt. Quoted from B6's own report, `docs/audits/20261126_BUILD_B6_BEFORE_THE_PLAYERS.md`.

**`archetype` and the view's shape: unchanged.** B6 §3.2, "Unchanged":
> - `bookViewRead.js`: no new read;
> - `BOOK_VIEW_VERSION` stays 3, because the view's shape did not change;
> - every client file.

**`split`: one guard tightened (B6-5).** B6 §1.3:
> | B6-5 (B5-A05) | An epoch missing a slot's cap could still pass the share total. | Every slot must have its own cap before the total is checked. Her row: short absent, medium 50%, long 40%, cash 10%: **no split**. |

And on the scenes, B6's review: "All 63 scene views (fallback, named, agent off) show the same SPY, split and book line as main's." So `split` is `null` in one more malformed case, and otherwise the same as B5's §2 (Appendix 1 of the Fable review).

**The desks' names: the fields are unchanged; a desk's own words now use them (B6-3).** B6 §1.2:
> Now the view replaces exactly two things in them:
> - **the old names.** "Shadow desk" and "archetype desk", in any letter case, with or without "the", become that desk's name. "The Shadow desk holds JPM" reads "Atlas’s desk holds JPM". Inside a sentence a fallback is lower-case: "I agree with your agent’s desk".
> - **the ideas' ids.** An id of your own book that the view holds, live or finished, becomes "the medium idea" ("The medium idea" at the start of a sentence). It is matched whole, never guessed. An id the view does not hold stays as written.

"A desk's words are its note, each call's reason, a draft's thesis, the thesis on an idea it wrote, and the same in History." The name fields themselves (`deskName` in groups, strip, desks, history, calls) are still B5's: "Atlas’s desk" / "Trend Follower’s desk", with "Your agent’s desk" / "Your archetype’s desk" as fallbacks. The engine's own ids stay: "The engine's own names for the desks stay (`shadow`, `archetype`, "The Shadow desk" on the close row, and your script's output). The model never reads them now." B6's summary: "A bare "Shadow" is not one of them" (R-6: only "Shadow desk" and "archetype desk", as whole words, are replaced). B6 Q-4 is open: "A desk may now write the words it is told: 'the player's own agent', 'the book's archetype', 'the other desk'. The view shows them as written."

For slice 2: a band that shows the agent's name and the archetype's name reads `archetype.name` and the desks' `deskName` exactly as B5 shipped them; `split.parts[].name` is the desk's name; the only new case is a `null` split for an epoch with a slot missing its cap.

## 6. Readings and questions

**Readings** (each stands unless you object):
- **F-R1 — Merge, not rebase.** The branch takes `main` by merge commits (`8ac8b252`, `8baeca12`): a rebase would need a force-push of the PR branch, which the prompt allows only on the smoke branch. `main` moved during the run (PR #1125), so it was merged a second time before the final checks.
- **F-R2 — ST-3 did not fire.** One row failed in the first merged-tree suite, in a file neither side touched, and passed alone three times; the final suite has none. A flake is not "a test failing for a reason outside the five fixes". If you read ST-3 more strictly, the run should have stopped there.
- **F-R3 — The pressed state lays the scrim over the row's colour** (`background-image`, 8%), instead of replacing `background`. An idea's header has a card colour of its own; a 6% scrim in place of it would have changed it by about 7 levels, against about 17 now (measured, §3.3). The Idea book screen's own hover is 3.5%; the strength is the founder's to tune on the walk.
- **F-R4 — One style element, beside the panel, in `BookPanel`** (one of the slice's new modules), not in the Overview: it covers the Overview and Setups at both sites, and keeps the panel's words the book's.
- **F-R5 — The Setups scope is kept although no row there is tappable today** (the prompt names it); the docblock says it is for slice 5's.
- **F-R6 — The barred words** are spec §5's line "Words this build never uses" plus "remembers" from §5's table, as whole words with plurals. PH-31's "game plan" and "Setups" are not in the strip, so nothing needed an exception.
- **F-R7 — Amendment B is committed with its quote markers**, as the prompt gives it and as Amendment A was. The review is byte-identical to the attachment (SHA-256 `477259ea…`, LF).
- **F-R8 — The preview diagnosis touched nothing.** It read code, the Vercel CLI's names-only listing and `vercel inspect`, GitHub's deployment records, and asked the deployment four GETs with no sign-in (each answers before any Firestore read). No value was printed, no variable changed.

**Questions for the founder:**
- **Q-1 — Make the preview walkable?** Add `PRACTICE_FIELD_PLAYER_UIDS` and `COCKPIT_ALLOWLIST_UIDS` to Vercel's Preview environment, then redeploy the smoke preview (§4.5). My suggestion: scope them to the branch `claude/portfolio-hub-s3-smoke` only, so other previews stay closed. Note that previews read production's Firebase project.
- **Q-2 — The Huddle's cohort (found outside the task, for separate tasking).** `HUDDLE_PLAYER_UIDS` exists only for the Preview of `claude/huddle-s1-smoke` and not in Production, so the Huddle is off for everyone in production. If that is intended, nothing to do; if not, it is its own change.

## Summary for the direction chat

> **Slice 3, Fable round: done. PR #1124 is a draft at `478fd4b4` plus this report, on Hold for you.**
> - **S3F-1:** `main` merged twice (`a037e022` with B6 and company names, then `4550a13e` with Explore Build 2). The only conflict was the docs index; every row kept. No "Shadow" in any scene's shown words after B6.
> - **S3F-2:** the mount guard's Idea book row now tells a Practice Field builder what to do (DRAWN or PAGE_ONLY, what a drawn function may not hold, what to do on "PosTable -> Quiet", and that a helper with an effect must be a function declaration). One pointer line in `IdeaBookScreen.jsx`; the bundle row's count says to update it.
> - **S3F-3:** the first-deployment strip reads "Hold to deploy" (the card's own entry). It fits at 320 and 390 beside "Later".
> - **S3F-4:** an instant pressed state for the desk rows, ideas' headers and names' rows in the hub: an 8% token scrim over the row while held, no motion, its own style beside the book panel. Seen in Edge by mouse; touch by reading.
> - **S3F-5:** one row pins every "Needs you" kind's title, label and screen-reader name from the real selector and copy; no "Shadow", no barred word.
> - Review and Amendment B committed (PH-29 to PH-34).
> - **Checks at `478fd4b4`:** Linux suite 39,743 passed, 0 failed; lint 0; rules 889/889; switch-off build byte-identical to `main` (non-map); switch-on build carries the layout. Every new row shown failing without its fix. Refuter: 26 mutants, two minor gaps and one guide dead end, all fixed in the round.
> - **Why the founder's preview showed today's hub:** that URL was the old smoke (`15e5bdce`, switch on). The book's route admitted nobody, because `PRACTICE_FIELD_PLAYER_UIDS` (and `COCKPIT_ALLOWLIST_UIDS`, for Research and the Forge records) are set in Vercel for **Production only**. The 404s were the app's own "not admitted", not missing functions and not a different account; same Firebase project.
> - **To walk it:** add those two variables to Preview (suggested: the smoke branch only), then redeploy the smoke: https://trade-seven-3h2y7znha-fais-projects-bc179554.vercel.app.
> - Open: Q-1 (that change), Q-2 (the Huddle's cohort is not in Production).
