# Build report — Shared Research "Work an idea" B4, the thesis builder's screen (dark)

**Smoke preview:** SMOKE_URL — `?srFixture=index` lists every scenario; **`?srFixture=walk`** plays the founder's walk.

**Date:** Nov 17, 2026 · **Session:** local Claude Code (Opus 5.5), own worktree · **Branch:** `claude/shared-research-b4` · **PR:** PR_NUMBER (draft) · **Pushed head:** PUSHED_HEAD

**Spec of record:**
- the B3 report's contract, `docs/audits/20261116_BUILD_SHARED_RESEARCH_B3.md` §4 (with §12 and §15);
- `docs/specs/20261116_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER.md` §B1, §B3, §B4, §B7, §B8, §B10–§B12;
- the design rounds `SHARED_RESEARCH_THESIS_BUILDER_R3.html` and `…_R3B.html` (R3b where they differ);
- the build prompt's K-1 to K-18 and SQ-1 to SQ-4 (defaults applied).

## Verdict

| Check | Result |
|---|---|
| Base | #1083 merged; branch from `4feb6b8e`; `origin/main` `a6b7baa0` merged (re-fetched before the checks) |
| STOP conditions | **none hit** — no `api/`, rule, index, flag value or `CommandCenter/` edit; no hub prop or wrapper change; no ledger row edited; nothing the server returns computed on the client; no `T6b`/`P1`; no network, model or provider call |
| Full suite (WSL, `TZ=UTC`, 8 workers, lock) at `20d776e5` | **exit 0** · 1,571 files · 35,520 tests: 35,364 passed, **0 failed**, 156 skipped |
| `lint:gate` · `test:rules` · minified build | **exit 0** · **exit 0** (46 files, 839 passed) · **exit 0** |
| The ledger | 37 · 34 · 38 · 19 · 2, the five files unedited |
| Bundle vs `main` | only the lazy Shared Research chunk changes (77.8 → 141.8 KB); the entry's export aliases re-lettered (same locals, body identical), so its importers differ only in alias letters; CSS byte-identical |
| Mutants | **58 / 58 killed** (55 jsdom on `20d776e5`, 3 real-browser), each by the row it names |
| Review (K-18) | 4 lenses + 2 refuter rounds: **22 findings at should-fix or above, 22 fixed**; the refuters found 6 + 4 defects in the fixes, all fixed; 2 rulings asked |
| Dark | the flag literal stays `'off'`; the ledger differential (base vs branch, 28 scenarios × 5 flag values) **142 / 142** on the final code |
| Real browser · the walk · renders | 32 / 32 rows · 22 / 22 checklist checks · 25 states × 390×844, 320×700, 1280×800 |

## 1. Base and the preamble

**Base.** `git fetch origin main` first. #1083 (B3) is merged: `origin/main` was `4feb6b8efff739afd5dbc63403323c9023a98156`, the merge of #1083. The branch was cut there. `main` then moved once, by a docs-only PR (#1084, `a6b7baa0a20e28c412afbae5fd88819c12e94fd6`), merged in at `6f4432d7`; it touches no file of this branch.

**The ledger baseline (preamble step 2),** on the fresh branch (Windows, the parent install): `SharedResearchSheetBody.flows.jsdom.test.jsx` **37**, `.review.` **34**, `.states.` **38**, `sharedResearchView.test.js` **19** — **128 passing**. (`useSharedResearch.uncertain.jsdom.test.jsx`, 2, is untouched too.)

**§4 re-verified against the merged code (preamble step 3).** Every shape is as §4 says; none differs. Read at `4feb6b8e`:

| Item | Where (VERIFIED) | What it is |
|---|---|---|
| `open`, own words | `api/forge/shared-research.js` `handleOpen` → `openBuilderOwnWords` → `openAnswer` | `{ action:'open', requestId, entry:{ kind:'observation', observation } }` only while `sharedResearchBuilderMode() === 'on'`; else `400 invalid_entry`. Answer `{ session, record, companies, thesis, opening:{ storedRows }, quota, previous }`. A retried requestId answers the session it made (`store.js` `openOwnWords`). |
| `step`, `intent:'build'` | `handleBuildStep` | `{ sessionId, stepId (uuid), intent:'build', goal, part?, direction? }`; success `{ session, record, companies, thesis, changed:{ findings, card }, quota }`; replay adds `replay:true`; failure `{ error:'step_failed', reason, session, thesis, quota }`. |
| `card` | `handleCard`, `store.js` `applyCard`, `thesis.js` `applyCardOp` / `cardOpOf` | `{ sessionId, opId (uuid), rev, op, part, value? }` → `{ session, thesis, applied }`; `409 card_stale` `{ error, message, thesis }`; `400 invalid_card` `{ reason }`; `409 step_in_flight`. Values per op and part as §4.3. |
| `adopt`, a builder | `handleAdopt` (a body with `rev` and no `previewRev`) → `handleAdoptThesis` | `{ sessionId, rev, statement? }` → `{ watchlistId, version:1, researchWorkId, idempotent, thesis }`; refusals as §4.4. |
| both GETs | `handleGet` | `?sessionId=` on a builder: `{ session, record, companies, thesis, storedRows, previous, quota }`, no `adoptPreview`. `?list=open`: an open builder session is an ordinary row `{ sessionId, question:"Build a thesis on: …", state, lastTurnAt, findingsCount }` — no shape; the GET it opens decides the view. |
| `close` | `handleClose` | B1's body; a builder's answer adds `thesis`. |
| the `thesis` view | `thesis.js` `thesisViewOf` | key by key as §4.6: `parts` (six, with `state`, `by`, values, `findingIds`, `map`, `blocked`, `proposal` with `incomplete`, `options`, `priceLines`, `label`, `suggestion`), `pick` (with `asked`, `basis`, `reasons[].basis`), `filled`, `saveIssue`, `ready`, `blockers`, `sentence`, `dependents`, `choices.research`, `choices.free` (with `input`, `options`, `min`, `max`, `reason`, `clears`, `revised`). |
| exchanges | `session.js` `sessionViewOf`; `store.js` `beginStep`, `recordStep`, `applyCard` | The partner exchange carries `goal` and `part`; a free tap appends `{ who:'player', kind:'card', text, at, card:{ op, part } }`. **The server stores no player line for a research tap — only a `direction` step has one** (kind `direction`, with its stepId). Not a difference from §4, which promises none; the screen draws the player's tap from the partner exchange's `goal` (routine choice 4). |
| steps left | `sessionViewOf` | `stepBudget − stepsUsed` (`STEP_BUDGET` 10). |
| `saveIssue.code` | `thesis.js` `saveIssueOf`; `adoptPreview.js` `AssertionError` | `too_many_evidence_refs` (detail: the count), `unsupported_assertion` (detail: the number), `names_not_supported` (detail `{ missing }` or `{ deselected }`). |
| `lastStep` | `store.js` `beginStep` | `{ stepId, intent, status, startedAt, endedAt, error }` — **no goal or part.** A failed research step can be re-sent with its own id only while this page holds the attempt; a reopened sheet can re-send only a direction (routine choice 12). |

**K-3 (preamble step 4).** The body reads the mode with no new prop: `builderMode.js` imports the flag module (`src/config/sharedResearchFlags.js`, Node-clean, already read by the server's gate).

## 2. Routine choices made here (K-1)

Each follows B2's precedent in the same directory where one exists. Each is listed for the founder.

1. **The switch's reader** is `builderMode.js`: read at call time, never at module scope; `'on'` only for the exact literal `'on'`; any other value (or none) reads `'off'` (the server's own rule). It has **no `try`** (review 4D-1): the import is a static binding that cannot throw, and without a `try` Rollup folds the literal, so the hub chunk gains nothing. It is the one file in the directory that imports the flag module (boundary row). On the PR head nothing a URL or a stored value can reach flips it.
2. **Start with the mode on.** The button reads "Start my thesis" (not "Frame my question", which would be untrue). The framing ceiling does not hold it back (own words spend no framing); the day's investigation ceiling does. While the open runs, "Opening the investigation…". A refusal shows on Start, with the words kept. The same words tried again re-send the same `requestId` (the server answers the session it made); new words get a new one. With the mode off, Start renders exactly as before (the ledger rows, unedited, prove it).
3. **The `invalid_entry` fallback (W-4)** sends today's framing request at once with the same words, and the Framing screen shows them: the player's tap was "start from these words", and with the mode rolled back today's answer to that tap is to frame. *The alternative — returning the words to the box with the framing button — is one line, if preferred.*
4. **The player's research tap in the conversation** is drawn from the partner exchange's `goal` and `part` (the server stores no player line for one), labelled from the copy table and tagged "1 step used" — true, since a partner exchange exists only for a completed step. A direction step's own player line (stored) is drawn once, with no second tap line.
5. **The card while it fills in** draws the card's frame words (`SR_COPY.builder.frame`) with a blank per unset part. **Once the server composes the sentence** (`thesis.sentence` not null), that string is drawn as received: each part's own text is *found* in it (`sentenceRunsOf`) so it can be tapped and, when stale, marked where it stands; the runs join back to the server's sentence exactly (table row). Nothing is reworded.
6. **A suggested part's text** is what the server holds for it: the theme's suggestion, the why proposal's shared reason, the time-frame suggestion's label, or the asked pick's value. It reads "suggested" and is never drawn as filled.
7. **One button per value.** A marked confirm (the agent's pick, a suggestion) stands in the place of the `set` choice for the same value; tapping it sends the server's `confirm` entry, so the card reads "{agent} suggested · you confirmed". A confirm no `set` holds (the names pick, an asked pick, the theme suggestion) stands first.
8. **A stale part in front** also brings its Change and its strengthen into the foot (K-7: it names what to do).
9. **The ready view** is drawn while `thesis.ready` is true on an open investigation. "Keep researching" shows the work view with "← Back to the thesis"; with no part in front, the foot lists every research choice but direction (K-4).
10. **The saved screen shows no count of carried findings.** No answer carries it: the adopt answer is `{ watchlistId, version, researchWorkId, idempotent, thesis }`, and the view has no carried list. Counting it here would mirror the server's `carriedIdsOf` — the STOP class. Under K-1 the server wins; it is on the watch list.
11. **"Thesis saved" takes its time from `session.adoption.at`** on the read that follows the save (the server's clock), never the device's.
12. **A failed step on a reopened sheet.** `lastStep` holds no goal or part, so *Try again* with the same id is offered only while this page holds the attempt — or for a direction, whose words are stored with its stepId. Otherwise the failure line shows beside the server's current choices (each a fresh id). Nothing is guessed.
13. **The foot** is pinned to the sheet's bottom. The whole foot keeps within 48 % of the sheet's own scroll box, measured (review 4C-4 and the refuter: a `vh` share ignores the sheet's header and a phone's toolbars, and a cap on the choices alone let the composer push it past half): its choices scroll inside it in a one-column grid; the composer stays under them; a band of the page colour covers the sheet's bottom padding beneath it. While another part's panel is open, the foot folds its choices (the composer stays). The scroll box gets scroll padding for the foot and the strip, so a focused control is never under them. A new turn scrolls into view just above the foot; a tapped part's panel scrolls into view clear of it. (Found in the renders: a tall foot covered the card, a capped flex column shrank its buttons over each other.)
14. **The desktop frame** is two columns inside the hub's 720 px sheet (its width is the wrapper's, which does not change): card left (sticky), conversation and foot right, in a 5 : 6 split. D1's 520 px card column cannot fit in the ~672 px the sheet leaves.
15. **The sentence's parts** are `span role="button"` with Enter and Space, `aria-expanded` and `aria-controls`: Chromium lays a `<button>` out as an inline block, which broke the sentence's lines at every part (found in the renders).
16. **"Continue later" and "Discard"** (B2's) stay at the end of an open builder's conversation; a closed builder shows today's closed actions.
17. **The names pick's button** reads "Build it on the names you tick" (disabled) until a name is ticked, then "Build it on one stock" / "Build it on N names".
18. **The dead end on the card:** the names blank reads "no listed company" in copper, and its rail bar is copper — from `parts.names.blocked`, as the server sends it. *Try another segment* is the server's `clear segment` choice; it carries `clears: ['names','why']`, so K-8 asks first (on the watch list).
19. **"You investigated this on … · Open the earlier one"** (B2's P-2) shows on a builder too.
20. **A time-frame suggestion's reason** is tagged "{agent}'s reasoning": it rests on no finding (B3 W-2 (c)).
21. **"All evidence"** is a sub-view with "← Back to the thesis", drawing today's finding rows (V2-6).
22. **Steps left** sit under each research choice's "1 step" tag (K-5) and in the card's head.
23. **The composer** sends on Enter too; its words clear only after an answer that succeeded.
24. **`SaveStates`** (B2's uncertain-save block) is exported from `Adopt.jsx` — one keyword — so the thesis Save shows the very same states.

**SQ-1..SQ-4** are built as their defaults: the composer's two modes and the switch's wording as K-6; the saved line as K-14; no duration on the working line; the goal labels as K-5.

## 3. What was built

| Layer | Where | What |
|---|---|---|
| The switch's reader | `src/components/SharedResearch/builderMode.js` | `sharedResearchBuilderMode()`, call time, never throws |
| The display rules, pure | `thesisView.js` | `frontPartOf` (K-4), `footOf`, `panelOf`, `valueChoicesOf`, `confirmMarkOf`, `slotOf`, `sentenceRunsOf`, `partFindingIdsOf`, `conversationOf`, `isBuilderSession` — each only orders or labels what the server sent |
| The parts | `builderParts.jsx` | the card's head, rail, sentence (slots, or the server's sentence found in runs), why block, why proposal, strip; `ResearchButton` and `FreeButton` (K-5); `NamesPick` (K-10b); `KeepReasons`; `PriceLines` (K-13); `ClearConfirm` (K-8); `Composer` (K-6); `PartPanel` (K-7); the conversation's lines; the foot's styles |
| The views | `screens/Builder.jsx`, `screens/ThesisReady.jsx`, `screens/ThesisSaved.jsx` | the work view, the ready view (T5, T5G), the saved view (T6a only) |
| The body | `SharedResearchSheetBody.jsx` | a builder SESSION gets `Builder`, every other session today's `Work` (K-2); Start's own words through `startOwnWords` when the mode is on, with the `invalid_entry` fallback (K-3) |
| Start | `screens/Start.jsx` | the `builder` prop: the button, the ceilings, the opening line (K-3); exactly as before at off |
| The hook | `useSharedResearch.js` | `openOwnWords`, `buildStep`, `cardOp`, `adoptThesis`, and the re-read `readInRun` — each through the one `run`; `investigationOf` keeps `thesis`; a lost request's id kept per request (a lost tap re-sent with the card's current rev; a lost step that has landed is done); a Save refusal names its card (`atRev`) |
| The service | `src/services/sharedResearchService.js` | `applyCardOp` (`action: 'card'`) |
| The words | `sharedResearchCopy.js` | `SR_COPY.builder`: every label, line and tag the builder writes |
| Fixtures | `__fixtures__/thesisAnswers.test.js` → `thesisAnswers.json` | every builder answer composed by B3's own functions (below) |

## 4. The fixtures, made by the server

`src/components/SharedResearch/__fixtures__/thesisAnswers.test.js` composes every builder answer the rows and the smoke page use, in the order the route runs them, with B3's and B1's own functions: `openingCardOf`, `openingFindingsOf`, `offeredGoalsOf` (each step's goal must be on offer, or the build throws), `turnShapeOf`, **`validateBuildTurn` (must answer ok)**, `applyProposals`, `cardOpOf` (each tap must apply), `thesisViewOf`, `cardContextOf`, `companiesOf`, `projectionOf`, `sessionViewOf`, `exchangeOf`, `closePatch`, `copyFor`. The result is committed as `thesisAnswers.json` and compared on every run, so a server change that moves a shape reds the row. No `thesis` object is typed anywhere.

The model turns:
- **recorded probes**, used as recorded: `map_segments`, `build_why` (the walk), `verify_source` (the story), `pick` (the asked pick), `strengthen:why` (the revised why);
- **authored outputs**, each passed through `validateBuildTurn`, where no recording fits the walk's card: the walk's `find_names` (Nvidia, AMD, Broadcom, and a privately held packaging supplier that stays a lead), the dead end's `find_names` (no listed company), the group's `build_why` (one sourced reason per name), and the incomplete why (one of two names sourced). Authored texts are fixture text, not market facts.

**The walk** (the founder's example): own words "I want to play AI" → `map_segments` → confirm the agent's pick (*Accelerator chips*) → `find_names` → `set names ['NVDA']` → `build_why` → confirm the why → confirm the wrong-if pick → confirm the time-frame suggestion (*positional*) → ready → save → the read after it. Around it: a direction step, a failed step, a stale card, out of steps, the price line, a wrong-if in the player's words that names a company the card does not hold (`saveIssue: names_not_supported`), a stale segment (a correction supersedes its finding), the dead end and its Conclude and *Try another segment*, the group of three, the incomplete why and its drop, the asked pick, the revised why, the story start and its check, and the refusals (`card_stale`, `step_in_flight`, `invalid_card`, `not_ready`, `unsupported_assertion`, `invalid_entry`, `server_error`, `rate_limited`), each with the server's own line.

**One server behaviour the fixtures surfaced:** at a dead end the server always replaces the model's reply (the goal's own pick is missing → `goal_proposal_dropped`), so T9 shows "This step added 1 finding. No listed company has a sourced connection yet; nothing is picked to finish the card." It is honest; it is on the watch list.

## 5. Every state, as built

`B` = `SharedResearchSheetBody.builder.jsdom.test.jsx`; `V` = `thesisView.test.js`; `W` = `thesisBuilder.browser.test.js` (real browser). The smoke scenario is in brackets.

| State | Drawn from | Rows |
|---|---|---|
| Start, mode on: own words open at once | the `open` answer; Start's `builder` prop | B "THE WALK", K-3 rows [walk] |
| Each card count, 0–6 | `thesis.filled`, `stepBudget − stepsUsed` | B "every state … filled (n of 6)" ×9 |
| A suggested part | `parts[p].state === 'suggested'`, the suggestion it holds | B "a suggested part reads suggested"; V K-7 [builder-why] |
| A stale part | `parts[p].state === 'stale'`, `blockers` | B "a stale part is marked…"; V "a stale part stays findable" [builder-stale-part] |
| The tapped part, its evidence | `parts[p].by`, the part's finding ids on `record` | B K-7 rows; W "a tapped part's panel" ×3 |
| The pick on a choice | `thesis.pick` without `asked`, `pick.basis` | B K-10 [builder-map] |
| The asked pick, both bases | `thesis.pick.asked`, `pick.reasons[].basis` | B K-10 [builder-pick-asked] |
| The names (T3) | the `set names` choice's `options/min/max`, `companies.supported/leads`, the names pick | B K-10b [builder-names] |
| The why proposal | `parts.why.proposal`, the `confirm why` choice | B K-11 [builder-why] |
| The incomplete why and the drop | `proposal.incomplete`, the `drop_unsourced` choice | B K-11 [builder-incomplete-why] |
| The revised why | the `{ confirm, why, revised }` choice, `parts.why.proposal` | B K-11 ×2 [builder-revised-why] |
| Ready (T5), the group (T5G) | `thesis.ready`, `thesis.sentence`, the parts | B K-12 [builder-ready, builder-group] |
| The price lines | the `{ input: 'priceLines' }` choice, `parts.wrongIf.priceLines` | B K-13 [builder-ready] |
| `saveIssue` | `thesis.saveIssue.code` (`names_not_supported`; `too_many_evidence_refs` on a server-made card of 32 carried findings) | B K-12, "4A-6", "R2" ×2, "4C-7" [builder-save-issue] |
| A Save refused (`not_ready`, `card_stale`) | the answer's `message` and `blockers`; shown only while the card it judged (`atRev`) is on screen | B K-12 ×3, "4B-3" ×2, "R3" ×3 |
| A read that failed | the read's refusal or no answer (`[data-sr-read-failed]`); the next card answer reads again | B "R4 (refuter 2)", "4B-7" |
| Saved (T6a) | the adopt answer, `session.adoption.at` on the read after | B THE WALK [builder-saved] |
| The uncertain save | no answer → `Check the record` (B2's) | B K-12 [builder-uncertain] |
| Waiting (T7) | the hook's pending step only | B K-15 [builder-waiting] |
| A failed step (T10b) | `{ error: 'step_failed' }` | B K-15 [builder-step-failed] |
| The dead end (T9) | `parts.names.blocked` | B K-15 ×2 [builder-dead-end] |
| Out of steps (T10a) | `choices.research` empty on an open record, `stepBudget` | B K-15 [builder-out-of-steps] |
| A stale card | `409 card_stale` with its `thesis` | B K-15 [builder-stale-card] |
| A story entry (T8a, T8b) | `verify_source` on offer; the theme suggestion | B "the story start", "after its check" [builder-story] |
| Desktop (D1) | `phone` false | B "desktop (D1)"; renders at 1280 |
| A ledger investigation | no `shape` | B K-2 ×3 [work, and every B2 scenario] |

## 6. Tests

| File | Rows | What |
|---|---|---|
| `__fixtures__/thesisAnswers.test.js` | 3 | the fixtures equal what B3's functions compose today; each scenario holds what its rows rely on, the refuter rounds' sequences included (revs only grow; `not_ready` keeps the rev) |
| `thesisView.test.js` | 127 | K-4's table (the part in front, 16 states); every foot and panel entry is one the server offered (every fixture); the foot per state; the marks (K-10, 4A-5); the slots (DR-3); the server's sentence found in runs and joined back exactly; part sources; the conversation (K-9); the restated parts pinned (4D-1); `proposalReasonHolds` (4A-4) ×9 |
| `SharedResearchSheetBody.builder.jsdom.test.jsx` | 107 | THE WALK (every body); K-2 ×3; K-3 ×5; every state; K-5, K-6, K-7, K-8, K-10, K-10b, K-11, K-12, K-13, K-15, K-16; the review's fixes (4A, 4B, 4C) and both refuter rounds (R1–R4, K-16 on the saved view) |
| `thesisBuilder.browser.test.js` (real browser) | 21 | the fold at 390×844 on T4 and T5; the strip; focus through a step, a free tap, a Change confirm and a save; the tapped part at 320/390/1280; 4C-1 to 4C-6; the strip's unfold by keyboard and the whole foot within half the sheet at 320×568 and 390×844 (the refuter) |
| `sharedResearchCopy.guard.test.js` | +5 | K-13's banned words (planted); the save-issue lines pinned to the server's; the honest and idea-book lines; the goal labels and marks; no agent name in any source file. The scanned file list gained the four new `.jsx` files. |
| `sharedResearch.boundary.test.js` | +3 | the new files are in the walk (boundary, hub-path and network rows); the switch is read in one place, at call time, with no `try` (4D-1); the body reads it only for Start and chooses the view by the session |

**The ledger is unchanged:** `SharedResearchSheetBody.flows.jsdom.test.jsx`, `.review.`, `.states.`, `sharedResearchView.test.js` and `useSharedResearch.uncertain.jsdom.test.jsx` are unedited (`git diff --stat 4feb6b8e 20d776e5` over the five is empty) and pass at the preamble's counts: 37 · 34 · 38 · 19 · 2. B2's 11 real-browser rows (`sheetLayer.browser.test.js`) pass on the B4 harness too.

**The fixtures added in the review rounds** are composed the same way: `getTooManyRefs` (thirty Source-backed notes appended as the record holds findings — the corrections' precedent, since a step adds at most `STEP_FINDINGS_MAX` = 12 — then a `build_why` that passes `validateBuildTurn` and the walk's taps); and nine sequences in the order a server answers them (`notReadyStaleWhy` + `getStaleWhy` at the same rev, `clearStaleWhy`; `adoptStalePriced`, `getPriced`, `walkPriceLineAgain`; `timeFrameLanded`, `clearTimeFrameAgain`, `swingAgain`; `namesTimeFrame`, `namesTimeFrameCleared`, `getNamesTimeFrameCleared`; `oneStockTimeFrame`). Each was appended at the end of the build, so no earlier scenario's minted ids moved (checked: only the new keys differ).

## 7. The suite, the ledger, lint, rules (on the final code, merged with `origin/main`)

`origin/main` is `a6b7baa0` (re-fetched before the checks; already merged into the branch). Every check below ran on **`20d776e5`**, the last code commit; the pushed head after it adds only this report (docs). WSL trees `~/pd-ci-srb4` (the branch) and `~/pd-ci-srb4m` (main), git worktrees of `~/pd-ci`, `node_modules` linked to an install with the same lockfile hash.

| Check | Where | Result |
|---|---|---|
| Full suite | WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, `--maxWorkers=8`, JSON report read directly | **exit 0** · 1,571 files, 0 failed · 35,520 tests: **35,364 passed, 0 failed**, 156 skipped |
| `lint:gate` | WSL (`eslint . --config eslint.gate.config.js --max-warnings 0`) | **exit 0** |
| `test:rules` | WSL, Firestore emulator, under the suite lock | **exit 0** · 46 files · 839 passed |
| Minified build | WSL `vite build` | **exit 0** |
| Real browser | headless Edge on the smoke page (the harness, on the final code) | **32 / 32**: `thesisBuilder.browser.test.js` 21, B2's `sheetLayer.browser.test.js` 11 |
| The walk (founder's checklist, scripted) | `?srFixture=walk` + the hard states, 390×844 | **22 / 22** |

**The ledger is unchanged.** The five ledger files are unedited (`git diff --stat 4feb6b8e 20d776e5` over them is empty) and pass in the Linux suite at the preamble's counts: `SharedResearchSheetBody.flows.jsdom.test.jsx` **37** · `.review.` **34** · `.states.` **38** · `sharedResearchView.test.js` **19** · `useSharedResearch.uncertain.jsdom.test.jsx` **2**.

**This build's own files in the suite:** `SharedResearchSheetBody.builder.jsdom.test.jsx` 107 · `thesisView.test.js` 127 · `__fixtures__/thesisAnswers.test.js` 3 · `sharedResearchCopy.guard.test.js` 28 · `sharedResearch.boundary.test.js` 53 · `thesisBuilder.browser.test.js` 21 (skipped without the page, as `sheetLayer` is) — all passing. The hub's `SharedResearchSheet.jsdom.test.jsx` (15) and `loadSharedResearch.test.js` (2) pass unchanged.

## 8. The bundle diff (minified, the branch against `main`)

Both trees built in WSL with the same install; every file compared by bytes, hashed names matched by stem, then compared again with hash names masked, then with the entry's export aliases normalised to their locals.

| File | Differs? | Why |
|---|---|---|
| `SharedResearchSheetBody-*.js` (the lazy chunk) | **yes** — 77,753 → 141,781 bytes (masked) | the builder: this PR |
| `index-*.js` (the entry) | byte for byte only in its export list | the entry's body before its export list is identical once hashes are masked (5,029,512 bytes each); the export list holds **the same set of locals** — no export added or removed — with some mangled names reassigned (`f0`–`f3`, `e$`, `dk`…): Rollup hands out export names from one counter in the order the chunks use them, and the lazy chunk's imports changed |
| every chunk that imports from the entry (`CommandCenterHub`, `FilmRoomScreenV2`, `AgentBattleScreen`, … 53 in all) | only in alias letters | identical after normalising each `x as Y` import to its local |
| `index-*.css` | **no** — byte-identical | Tailwind minted nothing from the new files (4D's scan: 0 of 379 new candidates mint) |
| `index.html` | only in hash names | same size |
| every `.map` | follows its chunk | — |

**No chunk but the lazy one changes in what it does.** The hub chunk gains no export (review 4D-1: the reader has no `try`, so the flag's literal folds; the six parts are restated in `thesisView.js` and pinned equal by a row).

**Real-browser rows and the renders** ran on a vite harness of this code (`?srFixture=` loader, the smoke page's own files): 25 states at 390×844, 320×700 and 1280×800, copied to `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B4/renders/`.

## 9. The review (K-18)

Four lenses read the built head `6f4432d7`, each on its own read-only snapshot tree (BUILD_RULES: no git write by a reviewer), each proving its findings with scratch rows or measurements, then deleting them. A fifth agent, the **refuter**, then read every finding against the server and the fixes at `206fd8dc` and tried to knock each one down. **None was refuted.** The refuter found that four fixes regressed or fell short, and two more were incomplete; that round is fixed here too (§9.5). A second, narrow refuter then read that round and found four more gaps (one present since the first fix); fixed too (§9.6).

**Threshold count: 22 findings at should-fix or above** (8 must-fix, 14 should-fix) — **22 fixed**, each with its own row; plus 4B-7 (filed as a nit, fixed with a row) and the smaller nits. 1 nit left as is (4D-2). The refuter's round added 6 defects in the fixes themselves — all 6 fixed (§9.5); the second refuter 4 more plus a nit — all fixed (§9.6). 2 rulings asked (§10).

### 9.1 Lens A — display honesty

| Id | Sev. | Finding (where) | Refuter | Fix · row |
|---|---|---|---|---|
| 4A-1 | must | The point against was always tagged "Source-backed"; the server accepts an against resting on any current finding (`builderParts.jsx` AgainstLine) | CONFIRMED (thesis.js `againstNow`) | the tag dropped; the count stays · "4A-1: the point against carries its count" |
| 4A-2 | must | A step started from the ready view ran with no working line, and failed with no word (`ThesisReady.jsx`) | CONFIRMED | the step takes the player to the work view, where its working line and its failure show · "4A-2", "4B-4" ×2 |
| 4A-3 | must | Reopened, the saved screen showed the composed sentence as the saved one; no answer carries the statement (`ThesisSaved.jsx`) | CONFIRMED | the statement shows only when this page made the save · "4A-3" |
| 4A-4 | should | Reasons the server no longer holds were tagged "Source-backed" (a stale why; a proposal name in `incomplete`) | CONFIRMED · **fix incomplete**: a name with two reasons, one superseded, is not `incomplete`, and both wore the tag | a set why tags only while `why.state === 'set'`; a proposal reason only when its name is not `incomplete` **and it is that name's only reason** (`proposalReasonHolds`) · "4A-4" ×3, the `proposalReasonHolds` table ×9 · **ruling asked (Q-1)** |
| 4A-5 | should | The asked pick's mark sat on a confirm whose value was not the pick's (`thesisView.js` `confirmMarkOf`) | CONFIRMED (thesis.js:316–318) | a mark only when the values are the same; AskedPick prints the horizon label · "4A-5" · server question on the watch list |
| 4A-6 | should | `saveIssue` held Save for an edit the server would accept (`ThesisReady.jsx`) | CONFIRMED · **fix regressed**: the gate read the edit box, so the composed sentence typed back (or with a space) released Save, and `too_many_evidence_refs` was released by any edit | the gate reads the **statement that would be sent**: held while it is the server's sentence; always held for `too_many_evidence_refs` (the server checks it before the statement) · "4A-6", "R2" ×2 · **ruling asked (Q-2)** |
| nits | — | AskedPick's reason untagged; its raw `swing` | — | both fixed (tag from `pick.basis`; `horizonLabelOf`) |
| nit | — | "in your words" on a wrong-if the agent wrote and the player confirmed | — | W-2 rules the literal; on the watch list |

### 9.2 Lens B — state and wiring

| Id | Sev. | Finding (where) | Refuter | Fix · row |
|---|---|---|---|---|
| 4B-1 | must | One shared lost-request slot: any other answer cleared it, so a lost step lost its stepId (`useSharedResearch.js`) | CONFIRMED · **fix regressed**: kept entries outlived the card — a lost tap re-sent its old `rev` and was refused `card_stale` | a Map keyed per request; **a lost tap is re-sent as it was only while the card is still at its rev, else it is a new tap** (§9.6); **a lost step whose exchange is now on screen is done — a new tap is a new step** · "4B-1", "R1" ×3 |
| 4B-2 | must | `step_in_flight` offered no Try again and dropped the stepId (B2 keeps both) | CONFIRMED | in RETRYABLE; the id kept · "4B-2" |
| 4B-3 | must | A Save refused `card_stale` with a no-longer-ready card lost the edit and drew the line nowhere; `not_ready` kept a stale card | CONFIRMED · **fix incomplete**: the refusal's lines outlived the card ("Still to set" on a ready card) | the edit lifted above the ready view; the work view draws the refusal; `not_ready` reads the card again; **a refusal names the rev the server judged (`atRev`) and shows only while that card is on screen** · "4B-3" ×2, "R3" ×3 |
| 4B-4 | should | The same silent step (4A-2); the ready view ignored a 429 wait | CONFIRMED | as 4A-2; `sr.waiting` in its busy · "4B-4" ×2 |
| 4B-5 | should | A Change confirm survived "Open the earlier one" and could send X's choice to Y | CONFIRMED | the builder keyed by session · "4B-5" |
| 4B-6 | should | Own words shared the previews' requestId | CONFIRMED | their own id, keyed by the words · "4B-6" |
| 4B-7 | nit→fixed | A card answer showing a landed step kept stale evidence | CONFIRMED · **fix regressed**: the re-read ran outside the one-request rule (two requests in flight; an older read could land over a newer card); the `not_ready` read the same | re-read **through `run`** (`readInRun`) in both places · "4B-7", "R4" ×2 |
| nit | — | A reopened `running` step offered nothing | — | "Check again" (a read; nothing re-sent) · "a step left running on a reopened sheet" |

### 9.3 Lens C — accessibility and phone (measured in headless Edge)

| Id | Sev. | Finding (where) | Refuter | Fix · row |
|---|---|---|---|---|
| 4C-1 | must | After a screen-only action (panel ×, strip, Keep it, Edit, Keep researching, All evidence) focus fell to `<body>` and Escape stopped closing the sheet | CONFIRMED · **fix incomplete**: the strip's unfold still dropped focus (it unmounts on the scroll after the rescue) | `useFocusKept` on the builder's views; focus moved on purpose (× → its part, Keep it → Change, Edit → the box); **the strip's unfold focuses the card** · W "4C-1" ×2, W "refuter: the strip opened by keyboard"; B "4C-1" |
| 4C-2 | must | The foot's Change opened its confirm off-screen, unfocused | CONFIRMED | the confirm opens beside its control; "Keep it" takes focus · W "4C-2"; B "4C-2" |
| 4C-3 | should | Focused controls hid under the sticky foot (WCAG 2.4.11) | CONFIRMED | scroll padding on the sheet's scroll box (foot + strip) · W "4C-3" |
| 4C-4 | should | The foot took 52–63 % of the sheet; at 320 a panel's choices sat under it | CONFIRMED · **fix incomplete on size**: the cap counted the choices only (57 % at 320×568) | the foot folds its choices while another part's panel is open; **the whole foot keeps within 48 % of the scroll box** (the cap subtracts the composer and its lines); the padding is released when the foot goes · W "4C-4", W "refuter: the whole foot" ×5; B "4C-4" |
| 4C-5 | should | `overscroll-behavior: contain` made the foot a dead zone for scrolling | CONFIRMED | removed · W "4C-5" |
| 4C-6 | should | A long unbroken token pushed the cost marks off-screen | CONFIRMED | `minmax(0,1fr)` grid; `overflowWrap: anywhere` · W "4C-6" |
| 4C-7 | should | Save disabled with its reason off-screen and undescribed | CONFIRMED | the issue line in the foot, `aria-describedby` · B "4C-7" |
| 4C-8 | should | The panel × was 19×44 and named like the sheet's Close | CONFIRMED | 44×44, "Close {part}" · B "4C-8" |
| 4C-9 | should | New replies arrived outside any live region | CONFIRMED | the conversation is `role="log"` · B "4C-9" |
| nits | — | part names without the part; the strip's label; a duplicate composer id; focus after Send | — | all fixed · B "4C nits" |

### 9.4 Lens D — compatibility and the dark guarantee

| Id | Sev. | Finding (where) | Refuter | Fix · row |
|---|---|---|---|---|
| 4D-1 | should | The lazy chunk imported three new bindings from the hub chunk (the flag read inside a `try` could not fold; `THESIS_PARTS`; `STATUS_LABELS`) — the hub chunk would gain exports | CONFIRMED | the reader has no `try` (the literal folds); the six parts restated and pinned equal by a row; "Source-backed" through `findingLabelOf` (already imported) · boundary "read in ONE place … no try", V "restated, pinned equal"; the build (§8) |
| 4D-2 | nit | `Adopt.jsx` gains a JSDoc sentence besides `export` | — | left: comments are stripped |

**The dark guarantee, re-checked on the final code.** 4D's differential renders `a6b7baa0`'s body, hook and Start (verbatim copies; only their two import lines redirected) beside the branch's, behind one fake server, and compares every snapshot (`useId` renumbered) and every request body across 28 ledger scenarios (7 list states × type/frame, 6 frame failures, a pending frame, gated, and every ledger `get*` answer in session mode). At 4D's read (`6f4432d7`) it was 170/170 over six flag values. **Re-run on `6d308d96` (the refuter round's code): 142/142** over five values — `'off'`, `'ON'`, `' on'`, `true`, `undefined` — plus the control (at exactly `'on'`, Start differs, so the differential can see a change). The sixth value, a getter that throws, was dropped: 4D-1 took the reader's `try` out, and a module's `const` binding cannot throw. 4D's Tailwind scan (byte-identical CSS, 0 of 379 new candidates mint) was read at `6f4432d7`; the final build's CSS identity is in §8.

### 9.5 The refuter's round

The refuter's six defects are each fixed and each has a row that fails without its fix:

| # | Defect the first fixes made | Fix | Rows | Mutant |
|---|---|---|---|---|
| R1 | a lost tap re-sent with a stale `rev` → a false `card_stale`; a landed lost step re-sent under its old id → a replay, no new step | first `{ ...lost.body, rev }` (superseded in §9.6: past its rev a lost tap is a new tap); a lost step whose partner exchange is held gets a new id | "R1" ×3 | RF1a, RF1b, RF1c |
| R2 | Save released by the composed sentence typed back; `too_many_evidence_refs` released by any edit | `issueHolds` reads the statement; that code always holds | "R2" ×2 | RF2a, RF2b |
| R3 | a refusal's lines outlived its card | `atRev` on every refusal (the move onto the read card taken out in §9.6) | "R3" ×3 | RF3a, RF3b, RF3c |
| R4 | re-reads outside `run` | `readInRun` (it says so when it fails, §9.6) | "R4" ×3, "K-16 on the saved view" | RF4a–RF4f |
| 4C-1 | the strip's unfold dropped focus | `unfold` focuses the card | W "refuter: the strip…" | BF1 |
| 4C-4 | the foot over half the sheet | the cap counts the whole foot | W "refuter: the whole foot…" ×5 | BF2, BF2b |
| 7 | the scroll padding kept after the foot goes | the effect runs only while the foot is drawn (`active`) | — (by reading; no fixture closes a builder under a held foot) | — |
| 4A-4 | two reasons for one name | `proposalReasonHolds` | V table ×9 | RF4A4 |

### 9.6 The refuter's second round (`206fd8dc..6d308d96`)

A second, narrow refuter read the round above against the server (`store.js`, `session.js`, `thesis.js`, `shared-research.js`) and ran its own scratch rows. **Held:** R1 for steps (every builder partner exchange carries its `stepId`; a failed step writes none; exchanges are never trimmed), R2 (the statement checked is exactly the one sent; only `too_many_evidence_refs` comes before the text), R3's gate, 4A-4 (`reasonHolds` needs every finding current and verified, so a name not `incomplete` with one reason holds that reason), and the foot (the cap settles in one measure; the padding is released). **Broken, and fixed in `20d776e5`:**

| # | What it found | Fix | Row | Mutant |
|---|---|---|---|---|
| R1 cards | A lost tap the server **did** apply, tapped again after the part changed, re-sent the landed opId: `applied: false`, the tap swallowed, nothing said (present since the first fix) | re-send the lost body only while the card on screen is still at its rev; past it, the tap is new (a fresh opId, the rev now) — the server checks an applied opId before the rev, and revs only grow | "R1 (refuter 2): a lost tap that DID land"; "R1: a lost tap that never landed" now expects a fresh opId | RF1a, RF1c |
| R3 hand-off | Moving `atRev` to the card the read finds drew the old blockers on a card the server never judged (another writer between the adopt and the read); and the row leaned on a rev no server returns | the refusal stays on the rev the server judged; not_ready's read holds that same rev (the server checks the rev first) | "R3: not_ready on the card the screen holds"; "R3 (refuter 2): … never drawn on a later card"; the R3 rows now read answers in the order a server gives them | RF3a, RF3b, RF3c |
| R4 (a) | A re-read that failed said nothing, and no later card answer read again (stale evidence stayed) | a failed read shows the work view's read-failure line; the investigation stays marked until a read answers | "R4 (refuter 2): the read after a landed step fails" | RF4c, RF4d |
| R4 (b) | K-16 on the saved view: the read after the save ran outside `run`, and equip went out beside it | that read goes through `run`; equip is disabled while it is out | "K-16 on the saved view (refuter 2)" | RF4e, RF4f |
| nit | `over` measured the untrimmed edit | measured trimmed, as the server measures | "an edit is measured as the server measures it" | RF5 |

The refuter's one server question goes on the watch list: **adopt has no running-step guard** (only the card route has one), so a Save during a lost but still-running step saves the card that step is about to change.

## 10. Rulings asked

Both are built one way, the safer reading, and are a one-line change either way.

- **Q-1 (4A-4) — "Source-backed" on a why proposal's reason.** The server says per **name** whether a sourced reason holds (`proposal.incomplete`), not per **reason**. A name may carry up to three reasons (`reasonsPerName`), and a later step can supersede the finding under one of them without the name becoming incomplete. **Built:** a reason is tagged only when its name is not incomplete **and** it is that name's only reason (then the holding reason is this one); a name with two or more reasons shows none tagged. *Alternatives:* (a) B3 adds a per-reason `holds` (or `basis`) to `proposal.reasons[]`, and the screen reads it; (b) no tag on proposal reasons at all.
- **Q-2 (4A-6) — Save and `too_many_evidence_refs`.** The server checks that code before it looks at the statement (`thesis.js` `saveIssueOf`), so no wording of the sentence changes it. **Built:** Save stays held for that code whatever the player writes; for `unsupported_assertion` and `names_not_supported`, Save is held while the statement that would be sent is the server's own sentence, and released for the player's own sentence (the server then judges it, and a refusal keeps the edit). *Alternative:* hold Save for every `saveIssue` whatever the edit (K-12's letter), and let the issue line say what to change.

## 11. The mutation table

| Id | Mutation | File | Row that must fail | Verdict |
|---|---|---|---|---|
| M01 | a button the choices do not hold: Save while ready is false | `screens/Builder.jsx` | Save is drawn only on a ready card | KILLED (57 rows red) |
| M02 | the client composes the sentence | `builderParts.jsx` | ready (T5): the server's sentence | KILLED (3 rows red) |
| M03 | a suggested part is drawn as set | `builderParts.jsx` | a suggested part reads "suggested" | KILLED (1 rows red) |
| M04 | a card op is sent without the rev seen | `useSharedResearch.js` | own words → Map → a segment | KILLED (9 rows red) |
| M05 | a retried tap makes a new opId | `useSharedResearch.js` | a retried tap after a lost answer re-sends the same opId and rev | KILLED (2 rows red) |
| M06 | the view is chosen by the flag instead of the session | `SharedResearchSheetBody.jsx` | a builder investigation renders the builder with the mode off | KILLED (96 rows red) |
| M07 | own words open as a builder with the mode off | `SharedResearchSheetBody.jsx` | off: today's Frame my question, a frame request, no open | KILLED (1 rows red) |
| M08 | a pick without `asked` is drawn as confirmed | `builderParts.jsx` | a pick on a free choice: marked, its reason tagged | KILLED (3 rows red) |
| M09 | a research goal's pick is tagged Source-backed | `builderParts.jsx` | a pick on a free choice: marked, its reason tagged | KILLED (1 rows red) |
| M10 | the wrong-if tag reads "Watched" | `sharedResearchCopy.js` | the wrong-if reads "in your words" | KILLED (3 rows red) |
| M11a | a Change that clears parts sends without the confirm (ready view) | `screens/ThesisReady.jsx` | Changing Segment also clears Names and Why | KILLED (2 rows red) |
| M11b | a Change that clears parts sends without the confirm (work view) | `screens/Builder.jsx` | the dead end (T9): the reply, Conclude | KILLED (3 rows red) |
| M12 | a stale card re-sends on its own | `useSharedResearch.js` | a stale card (409 card_stale) | KILLED (2 rows red) |
| M13 | the revised-why button shows without the `revised` choice | `thesisView.js` | without the server's `revised` choice there is no revised button | KILLED (22 rows red) |
| M14 | the uncertain save retries before the check | `screens/ThesisReady.jsx` | the uncertain save: only Check the record | KILLED (1 rows red) |
| M15 | a research choice is labelled "free" | `builderParts.jsx` | every research choice costs "1 step" | KILLED (4 rows red) |
| M16 | the working line shows with no request in flight | `screens/Builder.jsx` | waiting (T7): the working line only while the request is in flight | KILLED (1 rows red) |
| M17 | the composer sends a direction in free mode | `builderParts.jsx` | free mode on the wrong-if | KILLED (1 rows red) |
| M18 | K-4: a stale part does not come first | `thesisView.js` | a stale part comes first, in blockers order | KILLED (1 rows red) |
| M19 | K-3: the reader takes any truthy value as on | `builderMode.js` | the mock reaches the reader | KILLED (3 rows red) |
| R4A1 | the point against tagged Source-backed again | `builderParts.jsx` | 4A-1: the point against carries its count | KILLED (1 rows red) |
| R4A2 | a step from the ready view stays on the ready view | `screens/ThesisReady.jsx` | 4A-2: a step started from the ready view | KILLED (2 rows red) |
| R4A3 | a reopened saved thesis shows the composed sentence as the saved one | `screens/ThesisSaved.jsx` | 4A-3: a saved thesis reopened | KILLED (1 rows red) |
| R4A4a | a stale why's reasons tagged Source-backed | `builderParts.jsx` | 4A-4: a reason the server no longer holds | KILLED (1 rows red) |
| R4A4b | an incomplete name's proposal reason tagged Source-backed | `builderParts.jsx` | 4A-4: a waiting proposal whose reason a correction superseded | KILLED (1 rows red) |
| R4A5 | a pick marks a confirm whose value is not the pick's | `thesisView.js` | 4A-5: a pick marks only the confirm | KILLED (1 rows red) |
| R4A6 | saveIssue holds Save even for the player's edit | `screens/ThesisReady.jsx` | 4A-6: saveIssue holds Save for the composed sentence only | KILLED (1 rows red) |
| R4B1 | one refusal drops every lost tap's id | `useSharedResearch.js` | 4B-1: a lost step keeps its stepId | KILLED (1 rows red) |
| R4B2a | step_in_flight does not keep the stepId | `useSharedResearch.js` | 4B-2: a step answered 409 step_in_flight | KILLED (1 rows red) |
| R4B2b | step_in_flight offers no Try again | `screens/Builder.jsx` | 4B-2: a step answered 409 step_in_flight | KILLED (1 rows red) |
| R4B3a | the edit lives in the ready view again (lost when it unmounts) | `screens/Builder.jsx` | 4B-3: a stale card on Save that is no longer ready | KILLED (4 rows red) |
| R4B3b | the save's refusal is drawn nowhere on the work view | `screens/Builder.jsx` | 4B-3: a stale card on Save that is no longer ready | KILLED (2 rows red) |
| R4B3c | not_ready keeps the card on screen unread | `useSharedResearch.js` | 4B-3: not_ready carries no card | KILLED (4 rows red) |
| R4B4 | the ready view ignores a 429 wait | `screens/ThesisReady.jsx` | 4B-4: a 429 on the ready view | KILLED (1 rows red) |
| R4B5 | the builder not keyed by its session | `SharedResearchSheetBody.jsx` | 4B-5: a Change confirm belongs to its investigation | KILLED (1 rows red) |
| R4B6 | own words share the previews' requestId | `useSharedResearch.js` | 4B-6: own words keep their own requestId | KILLED (1 rows red) |
| R4B7 | a card answer showing a landed step is not re-read | `useSharedResearch.js` | 4B-7: a card answer that shows a step landed | KILLED (4 rows red) |
| R4B8 | a step left running offers no read | `screens/Builder.jsx` | a step left running on a reopened sheet | KILLED (1 rows red) |
| R4D1 | the reader wrapped in a try (no fold; the hub chunk gains an export) | `builderMode.js` | the switch is read in ONE place | KILLED (1 rows red) |
| RF1a | a lost tap re-sent as it was after the card moved on | `useSharedResearch.js` | R1: a lost tap that never landed | KILLED (2 rows red) |
| RF1b | a lost step that landed is re-sent under its old stepId | `useSharedResearch.js` | R1: a lost step that has since landed | KILLED (1 rows red) |
| RF1c | a lost tap that landed re-sends its opId with the rev now (swallowed: applied false) | `useSharedResearch.js` | R1 (refuter 2): a lost tap that DID land | KILLED (2 rows red) |
| RF2a | too_many_evidence_refs released by an edit | `screens/ThesisReady.jsx` | R2: too_many_evidence_refs holds Save | KILLED (1 rows red) |
| RF2b | the server's own sentence typed back releases Save | `screens/ThesisReady.jsx` | R2: saveIssue holds Save while the sentence is the server | KILLED (1 rows red) |
| RF3a | a refusal on the ready view outlives its card | `screens/ThesisReady.jsx` | R3 (refuter 2): a not_ready refusal is never drawn on a later card | KILLED (2 rows red) |
| RF3b | a refusal on the work view outlives its card | `screens/Builder.jsx` | R3: not_ready on the card the screen holds | KILLED (1 rows red) |
| RF3c | not_ready's refusal moved onto whatever card the read finds | `useSharedResearch.js` | R3 (refuter 2): a not_ready refusal is never drawn on a later card | KILLED (1 rows red) |
| RF4a | the read after a card answer goes outside the one-request rule | `useSharedResearch.js` | R4: the read after a card answer | KILLED (2 rows red) |
| RF4b | the read after not_ready goes outside the one-request rule | `useSharedResearch.js` | R4: the read after not_ready | KILLED (1 rows red) |
| RF4c | a failed re-read is not tried again on the next card answer | `useSharedResearch.js` | R4 (refuter 2): the read after a landed step fails | KILLED (1 rows red) |
| RF4d | a failed re-read says nothing | `useSharedResearch.js` | R4 (refuter 2): the read after a landed step fails | KILLED (1 rows red) |
| RF4e | the saved view's read goes outside the one-request rule | `useSharedResearch.js` | K-16 on the saved view | KILLED (1 rows red) |
| RF4f | equip live while the read after the save is out | `screens/ThesisSaved.jsx` | K-16 on the saved view | KILLED (1 rows red) |
| RF4A4 | a name's reason tagged though the name has two | `thesisView.js` | a name with two reasons: the first | KILLED (4 rows red) |
| RF5 | an edit measured untrimmed | `screens/ThesisReady.jsx` | an edit is measured as the server measures it | KILLED (1 rows red) |
| BF1 | the strip's unfold leaves focus on the strip | `screens/Builder.jsx` | W refuter: the strip opened by keyboard puts focus on the card | KILLED (1/1 rows) |
| BF2 | the foot's cap counts its choices only | `builderParts.jsx` | W refuter: the whole foot keeps within about half the sheet (×5) | KILLED (4/5 rows) |
| BF2b | the foot's cap as before the refuter (0.36 of the box, choices only) | `builderParts.jsx` | W refuter: the whole foot keeps within about half the sheet (×5) | KILLED (2/5 rows) |

**58 of 58 killed**, each by the row it names; every mutated file restored from its bytes and checked by SHA-256.

## 12. Watch on the allowlist

What the screen shows honestly but the founder may want changed — each is a server composition or a contract gap, not a client choice:

1. **The dead end's reply is always the server's.** At a dead end the server replaces the model's reply (the goal's own pick is missing → `goal_proposal_dropped`), so T9 reads "This step added 1 finding. No listed company has a sourced connection yet; nothing is picked to finish the card." True; plain.
2. **"Try another segment" asks first.** It is the server's `clear segment` choice, which carries `clears: ['names', 'why']`, so K-8's confirm shows — though at a dead end both are empty.
3. **The theme is the player's whole words.** "My theme is I want to play AI, through …" — the server's sentence, drawn as received.
4. **"Skip the segment · free" is offered at the open** beside *Map the segments · 1 step* (checklist item 1 expects one choice): the server offers it.
5. **No count of carried findings on the saved screen** — no answer carries it (routine choice 10).
6. **A failed research step on a reopened sheet** cannot be retried under its own id: `lastStep` holds no goal or part (routine choice 12).
7. **"in your words"** also sits on a wrong-if the agent wrote and the player confirmed (W-2 rules the literal).
8. **An asked time-frame pick cannot be confirmed while an earlier suggestion stands**: the server offers the confirm with the suggestion's value (`thesis.js:316–321`, `:567`). The screen marks only the matching confirm (4A-5). A B3 question.
9. **The foot's choices scroll inside the pinned foot** when they overflow; on iOS a nested scroll can feel sticky — checklist items 3 and 9 cover it.
10. **The scroll padding is released when the foot goes** (the refuter's item 7): fixed by reading; no fixture closes a builder under a held foot, so no row.
11. **Save has no running-step guard on the server** (the second refuter): only the card route refuses `step_in_flight`, so a Save sent while a lost step is still running saves the card that step is about to change. A B3 question; the screen cannot see a step it never heard back from.
12. **A refusal drawn after `not_ready` shows the blockers the answer carried**, on the card the server judged (the same rev). If the record moved between the refusal and the read (a step landed), the card's own `thesis.blockers` would be fresher; they are the same in every sequence the fixtures hold.

## 13. The PR description

**Shared Research "Work an idea" B4 — the thesis builder's screen. Dark: `SHARED_RESEARCH_BUILDER_MODE` stays `'off'`.**

Smoke preview (committed fixtures only; never merge the smoke branch): SMOKE_URL — `?srFixture=index` lists the scenarios, `?srFixture=walk` plays the founder's walk.

Report: [`docs/audits/20261117_BUILD_SHARED_RESEARCH_B4.md`](docs/audits/20261117_BUILD_SHARED_RESEARCH_B4.md) — every state with its server field and row, the review, the mutation table, the watch list, and the phone checklist.

### What it does
The client screen for B3's merged thesis-builder server. The **session** chooses the view (`shape: 'builder'`), never the flag; the flag is read in one place, for Start only.

| Piece | Where |
|---|---|
| The switch's reader — call time, no `try`, `'on'` only for `'on'` | `src/components/SharedResearch/builderMode.js:22` |
| Start: own words open at once when on; `invalid_entry` falls back to framing with the words kept | `SharedResearchSheetBody.jsx:146`, `screens/Start.jsx:37` |
| The view by session (K-2) | `SharedResearchSheetBody.jsx:191` |
| The display rules, pure (K-4 part in front, the foot, marks, the server's sentence found in runs) | `thesisView.js:37`, `:67`, `:117`, `:205`, `:277` |
| The work view, the ready view, the saved view (T6a only) | `screens/Builder.jsx:100`, `:361`; `screens/ThesisReady.jsx:40`; `screens/ThesisSaved.jsx:24` |
| The parts (card, sentence, panel, names pick, composer, foot) | `builderParts.jsx:58`, `:88`, `:328`, `:468`, `:539`, `:592` |
| The hook: own words, a step, a card op, Save, the re-read — each through the one `run` | `useSharedResearch.js:387`, `:400`, `:414`, `:452`, `:497` |
| The service | `src/services/sharedResearchService.js:81` (`applyCardOp`) |
| The words | `sharedResearchCopy.js:39` (`SR_COPY.builder`) |
| B2's save states, exported for reuse | `screens/Adopt.jsx:272` |

```
Functions called: none.
No api/ file, Firestore rule or index, flag value, or anything under src/components/CommandCenter/ is changed.
No network call in any test; no model or provider call anywhere.
```

### Checks (on the final tree, merged with `origin/main` `a6b7baa0`)
- Full suite (WSL, `TZ=UTC`, 8 workers, under the suite lock): exit 0 · 1,571 files · 35,520 tests: 35,364 passed, 0 failed, 156 skipped (at `20d776e5`)
- `lint:gate`: exit 0 · `test:rules`: exit 0 · 46 files · 839 passed · minified build: exit 0
- The ledger: `flows` 37 · `review` 34 · `states` 38 · `sharedResearchView` 19 · `uncertain` 2 — the five files unedited.
- Bundle vs main: only the lazy Shared Research chunk changes (77.8 → 141.8 KB minified); the entry's export aliases are re-lettered (the same locals; the body identical once hashes are masked), so its importers differ only in alias letters; CSS byte-identical
- Mutants: 58 / 58 killed (55 jsdom, 3 real-browser), each by the row it names; every file restored and checked by SHA-256
- Review: four lenses and two refuter rounds — 22 findings at should-fix or above, 22 fixed; two refuter rounds found 6 + 4 defects in the fixes, all fixed; 2 rulings asked

### For the founder
- Two rulings asked (report §10): Q-1 the per-reason "Source-backed" tag on a why proposal; Q-2 Save held for `too_many_evidence_refs` whatever the edit.
- The phone checklist (items 1–11) is in the report.
- Ready for the founder's merge · dark · the switch to `'on'` is a separate one-line founder PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## 14. The founder's phone checklist

On the smoke preview, iPhone, `?srFixture=walk` unless named:

1. **Start:** type "I want to play AI" under *Bring your own starting point*. It opens straight into the builder: the sentence card with the theme filled, one choice, *Map the segments · 1 step*.
2. **Segments:** four choices marked "free", one marked as your agent's pick with a one-line reason. Tap one. The card line says who set it.
3. **Names:** *Find the listed companies · 1 step*, then tick one company and confirm ("free"). A lead that can't be picked is shown as a lead.
4. **Why:** *Find the reasons · 1 step*; the reasons with their sources and the point against; *Confirm these reasons · free*.
5. **Wrong if and time frame:** tap an option or write your own in the composer, which says "free". Pick a time frame.
6. **The card:** tap a filled part. It shows who set it, its sources and *Change*. *Change* on the segment warns that it also clears the names and the why.
7. **Ready:** the finished sentence, *Edit the sentence*, "How it will be judged" with "in your words" and "optional · add your own". *Save thesis*.
8. **Saved:** "Thesis saved", the sentence, the honest line about the idea book, *Done* and *Use it in my next game*.
9. **The hard states** (from `?srFixture=index`): the dead end, out of steps, a failed step with *Try again*, a stale card, the revised why, the group.
10. **An old investigation** (`?srFixture=index`, a ledger one): it looks exactly as it does today.
11. **Live app:** nothing has changed anywhere.

*Note on item 1:* the server also offers "Skip the segment · free" at the open, so the screen shows it beside *Map the segments · 1 step* (watch item 4).
