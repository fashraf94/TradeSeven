# Build report — Shared Research "Work an idea" B5, the round before the switch (dark)

**Smoke preview:** https://trade-seven-l6196i977-fais-projects-bc179554.vercel.app — **`?srFixture=walk`** plays the walk, now with the theme point; `?srFixture=index` lists every scenario. It opens with no Vercel login (a cookieless request answers 200 with no redirect, and a fresh headless 393×852 context with no cookies walks to "Thesis saved", §8). Branch `claude/shared-research-b4-smoke` (never merged), commit `e490f592` = the code head `8d7a3a0f` + B4's three smoke files, byte for byte (B4's loader, unchanged).

**Date:** Nov 18, 2026 (build prompt dated Nov 17) · **Session:** local Claude Code (Opus 5.5), own worktree · **Branch:** `claude/shared-research-b5` · **PR:** draft, dark (its number is in the PR and in the session's closing message) · **Pushed head:** the commit that adds this report (docs only; the code is `8d7a3a0f`)

**Spec of record:** `docs/specs/20261116_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_B_THESIS_BUILDER.md` §B13 (this branch's first commit, `2cc7fc48`: the founder's T-1 to T-8 as written), over §B1, §B3, §B4 and §B10–§B12; B3's report §4, §6, §8, §15; B4's report §10, §12, §15.

## Verdict

| Check | Result |
|---|---|
| Base | `origin/main` `2e069d42` (the merge of #1086, B4); re-fetched before the checks and before the push: unmoved, so the checks ran on the branch as merged |
| STOP conditions | **none hit.** No ledger session's send, store or answer changed (the differential, §5). No step or model output sets a part. No answer, `thesis` view or `thesisCard` changed shape (lens C, §7). `modelTurn.js`, `method.js`, the KB loader and packages, Firestore rules and indexes, flag values and `src/components/CommandCenter/` are untouched. No compiled schema's structure or description changed (`BUILD_SCHEMAS` deep-equal to `main`'s). No production read or write. Provider calls: T-7's three only |
| The rulings | T-1 to T-8 built, each with its rows (§2) and mutants (§6) |
| The probes (T-7) | 3 calls, **$0.068052** of $0.10; theme suggestion "AI data-center buildout" (3 words); model replies 209 · 327 (kept 263) · 267 characters (§4) |
| Full suite (WSL, `TZ=UTC`, 8 workers, `flock`) at `8d7a3a0f` | **exit 0** · 1,575 files · 35,762 tests: **35,589 passed, 0 failed**, 173 skipped (341 s) |
| `lint:gate` · `test:rules` · minified build | **exit 0** · **exit 0** (46 files, 839 passed) · **exit 0** |
| The ledger differential (B3 §8) at `8d7a3a0f` | **4 / 4 byte-identical**; the planted control fails 4 / 4 |
| Mutants | **36 / 36 killed** on `8d7a3a0f`, each by the row it names |
| Review (BUILD_RULES §2) | 3 lenses + 1 refuter: **13 findings, 13 CONFIRMED / 0 REFUTED**; 8 fixed with rows and mutants; 4 go to the founder as questions (§11); 1 on the watch list |
| Bundle vs `main` | only the lazy Shared Research chunk changes (146,384 → 148,308 B); every other chunk and `index.html` identical but for hashed file names; CSS byte-identical |
| Real browser (on the smoke preview) | B4's and B2's rows **49 / 49**; the founder's checklist scripted **12 / 12** |
| Dark | `SHARED_RESEARCH_BUILDER_MODE` stays `'off'` |

## 1. Base and the preamble

**Base.** `git fetch origin main` first: `origin/main` = `2e069d4285f68138eae4676de1fd63c05e12e453`, the merge of #1086 (B4). #1086 is merged. The branch was cut there. `main` did not move during the build (re-fetched before the checks and before the push).

**Preamble step 2 — each place reads as the prompt says (VERIFIED at `2e069d42`):**

| Prompt's claim | Where (main) | Read |
|---|---|---|
| `openingCardOf` sets the theme from own words of 80 characters or fewer | `api/_utils/sharedResearch/thesis.js:85-91` | yes: `observation.length <= THESIS_LIMITS.theme` → `{ state: 'set', value: observation, by: 'player_wrote' }` |
| `offeredGoalsOf` gates `map_segments` on `themeReady` and `find_names` on a set theme | `thesis.js:252-254` | yes: `themeReady = theme set \|\| (observation && no suggestion)`; `find_names` needs `card.theme.state === SET` |
| The reply is cut at 600 (`THESIS_LIMITS.reply`) | `thesisSchema.js:246` | yes: `cutAtSentence(clean(output.reply), L.reply)` |
| `adoptThesis` has no running-step check | `store.js:774-793` | yes: only `applyCard` (`store.js:845`) refuses `step_in_flight` |
| The time-frame confirm prefers the suggestion over an asked pick | `thesis.js:321-322`, `:567` | yes: `suggestion?.value ?? (pick.part === 'timeFrame' ? pick.value : null)` |

**Preamble step 3 — every reader of a set theme on a builder card, and what T-1 / T-2 change in each (VERIFIED at `2e069d42`; head lines are at `8d7a3a0f`).** No reader's SHAPE changes; values do. No STOP.

| Reader | Where | What T-1 / T-2 change |
|---|---|---|
| The sentence | `thesis.js` `sentenceOf` (`:207-217`) | T-2: with no theme it opens "Built on {names}[, through {segment}], because …" (was "Through …, built on …"). A suggested theme never enters it. Same string; the null rule is unchanged. |
| The save | `store.js` `thesisAdoptionOf` → `sentenceOf`, `saveIssueOf`; `thesis.js` `ownTextsOf` (`:658`) | T-1: a card saved with no theme carries no theme text, so `ownTextsOf` is `[]`. A number in an edited statement can then sit only in a carried Source-backed fact (B1's rule), or in the wrong-if text or the time frame's label where each appears (W-2a). A confirmed or typed theme still licenses its own numbers (watch list). |
| `thesisCard` | `thesis.js` `savedCardOf` (`:696`) | `theme: { value: null, by: null }` when no theme is set: the same keys as before (already possible for words over 80). Pinned by `thesisB5.test.js` "a ready card with no theme saves…" and lens C. |
| The prompt | `stepPrompt.js` `cardLinesOf` (`:287`), `goalLineOf` (`:254-266`) | The card line reads "Theme: not set" (or "not set; you suggested …"). T-1: with no theme and no suggestion, the map's line asks for "a short noun phrase of two to six words, never a sentence". T-2: `find_names` with no segment value and no theme works on "the idea behind the question above" (was "the theme", a word with nothing behind it). |
| The search text | `api/forge/shared-research.js` `buildFocusOf` (`:593-615`) | Not named in the prompt; found here. With no theme and no suggestion, the first map's search fell back to the record's question. It now names the player's own words (the observation finding; a SignalDrop's opening is one too). For words of 80 characters or fewer that is exactly what the first map searched on before T-1. With neither a segment nor a theme, `find_names` and `build_why` have no subject; they now search the record's question (review B2). Builder steps only. |
| Ready, blockers | `thesis.js` `readinessOf` | none: the theme was never one of ready's parts. |
| The offers | `thesis.js` `offeredGoalsOf` (`:242`) | T-2: `map_segments` while the segment and the names are unset; `find_names` while the segment is set, the names are unset and no dead end holds. |
| The free choices | `thesis.js` `freeChoicesOf` (`:267`) | none: the theme's confirm (with a suggestion) and its text box stay on offer until it is set. |
| The validator | `thesisSchema.js` theme suggestion (`:312-319`) | A suggestion lands only while the theme is unset, as before. After the review it also needs no suggestion already waiting, and must not be the player's own words. |
| The client's front part | `src/components/SharedResearch/thesisView.js` `frontPartOf` (`:39`) | T-6: a `suggested` theme is skipped; an unset theme with no suggestion stays in front. |
| The client's sentence runs | `thesisView.js` `sentenceRunsOf` (`:229`) | Not named in the prompt; found here. It scanned the parts in a fixed order (theme, segment, names, …) with a moving cursor. In "Built on NVDA, through Accelerator chips, …" it found the segment and then never found NVDA, so the names stopped being tappable. It now scans in the order the sentence holds the parts. |
| The client's slots, strip, panel | `thesisView.js` `slotOf`; `builderParts.jsx` `Strip`, `PartPanel` | none: a suggested theme already showed "suggested"; the strip shows set parts only; the panel says "you wrote · Your words · no sources" only for a theme the player set. |

## 2. The rulings, as built

| Ruling | Built | Rows | Mutants |
|---|---|---|---|
| **T-1** own words never become the theme | `openingCardOf` returns the empty card for every entry (`thesis.js:87`). The words stay the player's observation: record finding and `observation` exchange, unchanged. The map's no-theme line and the output contract's `themeSuggestion` line ask for a two-to-six-word noun phrase in the agent's own words (`stepPrompt.js:239`, `:263-265`). The first map's search keeps the player's words (`shared-research.js:598`). Confirm (`partner_suggested_confirmed`) and write-your-own (`player_wrote`) are today's free choices. A suggestion that repeats the player's words is dropped, and so is a second one while one is waiting (review A1, A5). "Two to six words, never a sentence" is asked, not enforced (§10, question Q-5). | `thesisB5.test.js` T-1 ×10, review A1 ×4, review A5 ×3; route "T-1: the first map lands the theme suggestion…", "T-1/T-2: find_names runs with the theme unset…"; moved rows (§3) | T1a–d, RA1, RA5a–c |
| **T-2** the theme gates nothing | `offeredGoalsOf` (`thesis.js:249-250`). `sentenceOf` opens at the names with no theme (`:207-217`). `find_names`'s line with no theme (`stepPrompt.js:266`). No subject means no search focus (`shared-research.js:603-608`). | `thesisB5.test.js`: the offers table ×18; "the offers are the same whatever the theme's state"; "find_names with the segment set and the theme unset…"; "no builder card reaches the bare `direction` shape…"; the sentence ×6 + the group; "a ready card with no theme saves…". `thesisView.test.js`: sentence runs ×7 (the four shapes) + review B3 ×2. jsdom "T-2: the server's 'Built on …, through …' sentence…". Route "review B2…" | T2a–f, RB2a–b |
| **T-3** two short sentences | Rulebook §6's reply line replaced, one line (`docs/design/SHADOW_VOICE_RULES_V1.md`); `THESIS_BUILDER_RULES` matches it byte for byte (`stepPrompt.js:205`, pinned by `prompt.builder.test.js`). The output contract's reply line (`stepPrompt.js:246`). The model's reply is cut at a sentence's end at `MODEL_REPLY_MAX = 320` (`thesisSchema.js:56`, `:260`) before B1's number check. A reply whose first sentence alone runs past 320 is replaced by the plain line (review A2). The server's own lines are still bounded by `THESIS_LIMITS.reply` (600). Schema description text unchanged (no recompile). | `thesisB5.test.js` T-3 ×6, review A2 ×2; `thesisSchema.recorded.test.js` (moved); `thesisSchema.recorded.b5.test.js` | T3a–d, RA2 |
| **T-4** no save while a step runs | `adoptThesis`'s in-transaction `recheck` refuses `409 step_in_flight` first: after the shape check, before `thesisAdoptionOf`'s rev check, before any write. It uses `applyCard`'s exact predicate and the request's `nowIso` (`store.js:790`). The save's first read names a running step the same way, so a stale rev answers as the card route does (`:782`, review B4). `adoptIdea` untouched. | Route: "T-4: a save sent while a step is in flight…" (a real step held mid-flight); "T-4: checked inside the transaction, before the rev…" (`hooks.atTxStart`); "T-4: a stale running step… does not block"; "review B4…"; "T-4: a running step found at once… and the card route agrees" | T4a–c, RB4 |
| **T-5** the newer time-frame answer wins | An asked time-frame pick that lands clears the suggestion (`thesis.js:618`). The confirm carries the pick, else the suggestion (`timeFrameConfirmOf`, `:342`, used by `freeChoicesOf` and `applyCardOp`): a pick on the card is always the latest step's, since every step replaces the pick. The asked pick's confirm says "{agent}'s pick" (`builderParts.jsx:245`); the suggestion's already said "{agent} suggested". | `thesisB5.test.js` T-5 ×4; fixture `getTimeFramePicked`; jsdom "T-5: the time frame's confirm says whose answer it carries…" | T5a–c |
| **T-6** a suggested theme does not hold the front | `frontPartOf` skips a `suggested` theme (`thesisView.js:39-45`). `themeLineOf` (`:52`) passes the server's confirm and text box to `ThemeLine` (`builderParts.jsx:256`), drawn first in the choices (`Builder.jsx:297-300`): "Use “…” as the theme · FREE" and "Write your own". "Write your own" opens the theme's part with its text box: a disclosure that returns focus on close (review B6). | `thesisView.test.js` T-6 ×12 and the moved K-4 rows; jsdom T-6 ×8, review B6 | T6a–d, RB6a–b |
| **T-7** three recorded probes | §4 | `thesisSchema.recorded.b5.test.js` 17 | — |
| **T-8** two closings | (a) Q-1 and Q-2 recorded closed in §B13; no change. (b) `ThesisReady.jsx:146`: "in your words" only for `player_wrote`, else "in words" (copy `inWords`). | jsdom "the wrong-if the player did not write reads 'in words'…" (moved), "T-8 (b): a wrong-if the player wrote reads 'in your words'" | T8a–b |

**Row counts at `8d7a3a0f`** (from the record suite's JSON; all passing):

| File | Rows |
|---|---|
| `thesisB5.test.js` (new) | 58 |
| `thesisSchema.recorded.b5.test.js` (new) | 17 |
| `shared-research.builder.route.test.js` | 44, including the B5 block: 8 rows |
| `thesis.test.js` | 74 |
| `thesisSchema.recorded.test.js` | 46 |
| `prompt.builder.test.js` | 12 |
| `thesisView.test.js` | 161 |
| `SharedResearchSheetBody.builder.jsdom.test.jsx` | 150 |
| `__fixtures__/thesisAnswers.test.js` | 13 |

## 3. Rows that moved, each with its reason

Every moved row carries a one-line `§B13 T-n (moved …)` comment where it stands.

| File | Row | Was | Now, and why |
|---|---|---|---|
| `thesis.test.js` | the card at open ×2 | own words ≤ 80 → theme set, `player_wrote` | unset (T-1) |
| `thesis.test.js` | "own words, theme set: map…" | map, strengthen:theme, direction | the open offers map and direction; a hand-set theme adds its strengthen (T-1) |
| `thesis.test.js` | "own words over 80 (SQ-2)…" | a suggestion held the map back | the map is offered with and without a suggestion (T-2) |
| `thesis.test.js` | a story after its check | `['direction']` | `['map_segments', 'direction']` (T-2) |
| `shared-research.builder.route.test.js` | own words open | theme = the words; research incl. strengthen | theme unset, the words in the `observation` exchange; research map + direction (T-1) |
| route | map_segments lands a map | `filled` 1 | 0 (T-1) |
| route | each step is asked in its own schema | strengthen:theme on the open's theme | a `set theme` tap first (T-1) |
| route | "with nothing else on offer, direction…" | asked bare `direction` | asked as `map_segments` (T-2); no card reaches bare `direction` now |
| route | an invalid card op | `set theme` refused `theme_fixed` | the first phrase sets it; a second is refused (T-1) |
| route | the path's sentence | "My theme is I want to play AI, through …" | "Built on NVDA, through …" (T-1/T-2) |
| `thesisSchema.recorded.test.js` | strengthen:names / :timeFrame reply stands | verbatim | the reply stands cut at 320 at a sentence's end; the recordings are 414 and 365 characters (T-3) |
| `thesisSchema.recorded.test.js` | direction with nothing else on offer | asked as recorded | replayed in its recorded shape (the fixture pins it with `recordedShape`); today its card asks it as `map_segments` (T-2) |
| `__fixtures__/thesisAnswers.test.js` | walk rows | theme set, `filled` 1, 6 at ready | theme unset at open, suggested after the map, `filled` 0, 5 at ready (T-1) |
| `thesisView.test.js` | K-4 table: walkOpen, storyVerified | segment, theme | theme (unset, no suggestion), segment (T-6) |
| `thesisView.test.js` | the open card's foot | the segment's skip, no text box | the theme's text box, no skip yet (T-1) |
| `thesisView.test.js` | the map's labels | B3's map | the B5 recorded map (T-7) |
| `thesisView.test.js` | ready: Keep researching | incl. strengthen:theme | without it (T-1) |
| `thesisView.test.js` | the story after its check | the confirm in the foot | the theme's line; the segment in front (T-6) |
| `thesisView.test.js` | `hasSuggestedPart(walkTimeFrame)` | false | true; with the theme confirmed, false (T-1) |
| `thesisView.test.js` | sentence runs | one order, theme first | the sentence's own order, four shapes (T-2) |
| `thesisB5.test.js` | the cut's last-space fallback | through the validator | `cutAtSentence` itself; the validator now replaces a run-on reply (review A2) |
| jsdom builder | THE WALK | "1 of 6", the theme reads the words | "0 of 6", the theme blank, the words in the conversation; the theme's line first in the choices after the map (T-1, T-6) |
| jsdom builder | filled ×8 | n | n − 1 (T-1) |
| jsdom builder | a suggested part; a pick on a free choice | 3 of 6; 1 of 6 | 2 of 6; 0 of 6 (T-1) |
| jsdom builder | the story after its check | a marked confirm button | the theme's line (T-6) |
| jsdom builder | the theme: "you wrote" | walkGetConfirmWhy | walkGetThemeOwn, the player's typed phrase (T-1) |
| jsdom builder | K-13 the wrong-if tag | "in your words" | "in words" on the agent's confirmed pick (T-8 b) |
| jsdom builder | 5C-7 the lead's group | the first group in the choices | the group named by `aria-labelledby`: the theme's line is a group too (T-6) |

**The fixtures** (`src/components/SharedResearch/__fixtures__/`) are regenerated by the server's own functions (`thesisAnswers.test.js`):
- `thesisAnswers.json` changed as expected: the open no longer sets the theme.
- The walk's map is T-7's recorded `map_segments` answer (`test/fixtures/sharedResearch/build.b5.map_segments.recorded.json`), so the walk shows a real suggestion, "AI data-center buildout". Its segments are Accelerator chips, Networking, Power and grid, and Cloud spenders, so the dead end now sits on "Power and grid".
- New states, all composed by the server's functions:
  - `walkThemeConfirm` / `walkThemeOwn` and their reads;
  - the sentence's shapes: `getReadyThemed`, `getReadySkipped`, `getReadyThemedSkipped`;
  - an asked time-frame pick: `getTimeFramePicked`.
- The walk tree (`thesisWalk.json`) gains a theme point after the map: confirm the suggestion; your own phrase, one sample, "AI chips and data centers", matched loosely; or the segment first. Each carries the whole walk after it: 198 saved leaves, 21 wrong-if points.
- The review's fixes changed no fixture: regenerated, both files byte-identical.

## 4. The three probes (T-7)

On `claude-sonnet-5-5` (`MODELS.step`), with the real builder system prompt (Atlas, the baseline method) as built in `ccd6b846`, and the real user turn and schema for each goal. The probe script (`scripts/sharedResearch/probeBuilder.mjs --b5`) chains the cards:
1. the T-1 card;
2. that card after the map's answer lands, its pick confirmed: the segment set, the theme only suggested;
3. that card after `find_names`, with one name set.

Each card is derived from the recorded answer before it by B3's own `validateBuildTurn`, `applyProposals` and `applyCardOp` (`b5Probes` in `api/_utils/sharedResearch/__fixtures__/probeBuilder.js`).

`CLAUDE_API_KEY` was loaded from the parent checkout's `.env.local` into the probe process only (`node --env-file=…`). It was never printed and never copied; `.env.local` was not copied into the worktree. The fixtures hold the response, usage and cost; a row checks they hold no key, header or request.

The round's own ledger is `test/fixtures/sharedResearch/build.b5.probes.ledger.json`, capped at 3 calls and $0.10 (the script checks spent plus this call's worst case before each call). B3's 16-call ledger is untouched.

| Probe | Tokens in / out | Cost | Elapsed | Output vs 2,500 cap | Model reply | Kept | Validator kept | Notes |
|---|---|---|---|---|---|---|---|---|
| (1) `map_segments`, the T-1 card | 6,127 / 830 | $0.020554 | 7.9 s | 33% | 209 chars, 2 sentences | whole | theme suggestion **"AI data-center buildout"** (3 words, a noun phrase, the agent's own); a map of 4; pick "Accelerator chips"; 4 findings | none |
| (2) `find_names`, segment set, theme unset (T-2) | 6,270 / 970 | $0.022240 | 7.7 s | 39% | 327 chars, 3 sentences | 263 (2 sentences) | NVDA, AMD and AVGO supported; pick NVDA, AMD, AVGO; 5 findings | none |
| (3) `build_why` on NVDA | 7,584 / 1,009 | $0.025258 | 9.1 s | 40% | 267 chars, 2 sentences | whole | a complete why (1 reason, the point against); 3 wrong-if options; pick the first; time frame positional; 4 findings | none |
| **Total** | | **$0.068052** | | | | | | 3 calls |

**What they say:**
- (1) "The idea splits into four parts, from the chips themselves to the power that runs them. I'd stand on accelerator chips, since cloud spending is aimed mostly at them, though no listed company is tied to it yet."
- (2) ends after its second sentence. The 320 cut dropped the third: "I would build on Nvidia and AMD, with Broadcom as a third name." (question Q-3)
- (3) "Nvidia's own results show data centers are most of its revenue, and the cloud spenders that drive that demand plan to keep raising spending. The main risk is that big buyers also design their own chips; I propose a business-condition exit and a positional time frame."

No reply says "your observation", "the retrieved items" or "the record" (pinned).

## 5. The ledger is unchanged

1. **The differential (B3 §8), re-run on the final tree.** B3's lens-D harness runs the same ledger traffic through `main`'s route and modules and through this branch's:
   - about 60 requests on one seeded double, with fixed uuids and a frozen clock;
   - the scripts: story and drop, framed own words, and every refusal branch;
   - at the builder flag absent, `'off'`, and `'on'` (framing only);
   - compared as JSON strings: every answer, every stored document, the read and write logs, the shadow-log records, the model prompts and the retrieval arguments.

   The base is `main` `2e069d42`'s Shared Research modules, copied byte for byte as `sharedResearchBase/`, and its route, copied with only its import paths rewritten. The harness's three RD repro rows pinned base `88d34457`'s defects, which B3 fixed, so they are dropped. **On `8d7a3a0f`: 4 of 4 rows pass; every value is byte-identical.** (On `c13cb86e`, before the review's fixes, also 4 of 4.)

   **The control:** a one-character change to the ledger's `STEP_SCHEMA` ("at most 120 characters" → "121"), planted in the head copy, **failed all 4 rows**. The file was restored and checked with `cmp` against `git show`, and the clean re-run passed 4 of 4.
2. **Lens C, statically** (§7): every changed hunk sits in a builder-only function. `buildStepSystemPrompt`, `buildFrameSystemPrompt`, `renderStepUser`, `STEP_SCHEMA` and `FRAME_SCHEMA` give the same output as on `main` in every variant tried. `adoptIdea` and `commitAdoption` are untouched. B2's ledger fixture `answers.json` is unchanged.
3. **B1's recorded probe** (`stepSchema.recorded.test.js`) still validates, and the ledger's client files are unedited and pass in the suite.

## 6. The mutation table

36 mutants on a `git archive` of `8d7a3a0f` (`mutate.mjs`, B3's runner). Each anchor must match exactly once, or the mutant is reported BROKEN and not run. The verdict is read from the exit code and the failed rows (JSON reporter, the report deleted first). Each file is restored to its exact bytes, SHA-256 checked, and `cmp`'d against the commit afterwards. Defined 36, logged 36, none missing.

| Id | Defect | Killed by (first failing row) | Failed / run |
|---|---|---|---|
| T1a | the theme set from own words again | route "own words open … the theme unset" | 23 / 176 |
| T1b | the first map's search loses the player's words | route "T-1: the first map lands the theme suggestion…" | 1 / 44 |
| T1c | the no-theme map line no longer asks for a 2–6 word noun phrase | route "T-1: …" | 2 / 102 |
| T1d | the output contract's `themeSuggestion` line reverted | `thesisB5` "the prompt: with no theme the map asks…" | 1 / 58 |
| T2a | `find_names` gated on the theme again | route "the dead end…" | 24 / 102 |
| T2b | `map_segments` held back by a suggestion again | route "a suggested theme holds nothing back…" | 7 / 176 |
| T2c | with no theme the sentence opens "Through …" again | route "RA-1 with §B11 W-1…" | 6 / 102 |
| T2d | sentence runs in the theme-first order whatever the sentence (re-cut after B3) | jsdom "K-8 … Keep it sends nothing" | 8 / 311 |
| T2e | `find_names` with no theme told "the theme" | `thesisB5` "find_names with the segment set and the theme unset…" | 1 / 58 |
| T2f | the no-theme order used for a themed sentence | `thesisView` "getReadyThemed: the sentence runs…" | 3 / 311 |
| T3a | the model's reply cut back at 600 (the call site) | `thesisB5` "…cut at a sentence's end at 320" | 5 / 121 |
| T3b | `MODEL_REPLY_MAX` back at 600 | `thesisB5` same | 5 / 121 |
| T3c | §6's reply line reverted in the prompt | `prompt.builder` "§6 equals THESIS_BUILDER_RULES byte for byte" | 2 / 70 |
| T3d | the output contract's reply line reverted | `thesisB5` "…the schema's description text is unchanged" | 1 / 58 |
| T4a | the save without the in-transaction running-step check | route "T-4: checked inside the transaction, before the rev…" | 1 / 44 |
| T4b | a stale running step blocks the save | route "T-4: a stale running step… does not block" | 1 / 44 |
| T4c | the check made after the rev | route "T-4: checked inside the transaction, before the rev…" | 1 / 44 |
| T5a | the suggestion wins over a newer asked pick | `thesisB5` "a card that holds both…" | 1 / 58 |
| T5b | an asked pick no longer clears the suggestion | `thesisB5` "an asked pick after a suggestion…" | 3 / 71 |
| T5c | the asked pick's confirm loses "{agent}'s pick" | jsdom "T-5: the time frame's confirm says whose answer it carries…" | 1 / 150 |
| T6a | a suggested theme holds the front again | jsdom THE WALK | 64 / 311 |
| T6b | the theme's line not drawn | jsdom THE WALK | 10 / 150 |
| T6c | "Write your own" dropped (re-cut after B6) | jsdom "T-6: Write your own opens the theme's part…" | 2 / 150 |
| T6d | an unset theme with no suggestion skipped too | jsdom "the story start (T8a)…" | 8 / 311 |
| T8a | "in your words" on a wrong-if the agent wrote | jsdom "the wrong-if the player did not write reads 'in words'…" | 1 / 150 |
| T8b | "in words" even when the player wrote it | jsdom "T-8 (b): a wrong-if the player wrote…" | 1 / 150 |
| RA1 | the player's words land as the agent's suggestion | `thesisB5` "review A1…" | 3 / 58 |
| RA5a | the validator takes a second suggestion while one waits | `thesisB5` "…dropped (theme_suggested)" | 1 / 58 |
| RA5b | `applyProposals` replaces a waiting suggestion | `thesisB5` "applyProposals itself never replaces…" | 1 / 58 |
| RA5c | the map asks for a theme while a suggestion waits | `thesisB5` "a story after its check…" | 1 / 58 |
| RA2 | a run-on first sentence cut mid-sentence again | `thesisB5` "the first sentence alone runs past 320…" | 1 / 58 |
| RB2a | `find_names` searches an empty subject again | route "review B2…" | 1 / 44 |
| RB2b | `build_why` searches "… revenue exposure to" again | route "review B2…" | 1 / 44 |
| RB4 | the save's first read no longer names a running step | route "review B4…" | 1 / 44 |
| RB6a | "Write your own" loses `aria-expanded` / `aria-controls` | jsdom "review B6…" | 1 / 150 |
| RB6b | closing the theme's part sends focus to its slot, not the opener | jsdom "review B6…" | 1 / 150 |

The first battery, on `c13cb86e` before the review, killed 25 of 25. Three of those were re-cut where a fix moved their anchor: T1c, T2d and T6c. With B4's outer check in place, T4a is now killed only by the in-transaction race row, which is the row it names. The tables are kept as JSON beside the runner (`C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B5/review-evidence/`).

## 7. The review (BUILD_RULES §2)

The branch diff is 28 files and +20,941 / −14,882 lines (22 files and +1,383 / −153 without the generated JSON), so the review is mandatory.

**How it ran.** Three lenses, each on its own `git archive` snapshot, read-only:
- **A**, honesty: what is said and what is set;
- **B**, state: T-4, T-5 and the client's state;
- **C**, compatibility: the ledger, the shapes and the fences.

**One refuter** then got every finding and tried to break each with a concrete repro, on a fourth snapshot. **13 CONFIRMED / 0 REFUTED.** The refuter's scripts and report are in that snapshot's `_ref/`, copied to the evidence folder.

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| A1 | A map's theme suggestion that repeats the player's words ("I want to play AI") lands, and confirming it reads "Atlas suggested · you confirmed" — T-1 undone | CONFIRMED, in scope | **Fixed:** dropped as `player_words` (case, spacing and closing punctuation aside). Rows ×4, RA1. Server enforcement of "two to six words, never a sentence": question Q-5 |
| A2 | When the first sentence alone is longer than 320, the cut falls back to the last space, so the reply ends mid-sentence | CONFIRMED, in scope (the fallback is old; 320 makes it reachable) | **Fixed:** that reply cannot be cut at a sentence's end, so the server's plain line replaces it (`reply_replaced:too_long`; T-3 counts "the replaced reply" among the server's own lines). `cutAtSentence` is unchanged; the unsourced-line path still uses its fallback. No recording has a first sentence over 320. Rows ×2, RA2 |
| A3 = B1 | After an asked time-frame pick clears the suggestion, the next step of any kind replaces the pick, leaving no time-frame answer | CONFIRMED, built to T-5's letter | **Question Q-1** (low: the three free sets and a fresh "You pick" stay) |
| A4 | §4 rule (1), still in the builder prompt, calls the player's words "your observation", which the new §6 line forbids | CONFIRMED (the conflict is new; both texts are pinned) | **Question Q-2** |
| A5 = B7 | On a story, T-2 now offers the map while verify_source's suggestion waits; the map was asked for a theme, and its suggestion replaced the story's | CONFIRMED, in scope | **Fixed:** a suggestion lands only on a card with none; the map asks for one only then (T-1: "the first map", stories keep verify_source's). Rows ×3, RA5a–c |
| A6 | The draft sentence still frames "My theme is [your theme]" while the theme is optional | CONFIRMED, older copy | **Watch list** |
| B2 | `find_names` (and `build_why`) with neither a segment nor a theme searched "listed companies that earn from" | CONFIRMED, in scope (reachable through T-2) | **Fixed:** no subject → no focus → the record's question. Route row, RB2a–b |
| B3 | `sentenceRunsOf`'s earliest-found scan could tag a segment named like a name, or "theme" inside "My theme is" | CONFIRMED, in scope (contrived inputs) | **Fixed:** an ordered scan in the sentence's own order. Rows ×2, T2d (re-cut), T2f |
| B4 | The save's pre-transaction plan answered `card_stale` / `not_ready` while a step runs, where the card route answers `step_in_flight` | CONFIRMED, in scope | **Fixed:** the same check on the save's first read too; the in-transaction one stays. Route row, RB4 |
| B5 | A ready card whose theme is only suggested shows no way to confirm it on the ready view (only via Keep researching) | CONFIRMED, in scope | **Question Q-4** (nothing in §B13 rules it; it is one component call if wanted) |
| B6 | "Write your own" had no `aria-expanded` / `aria-controls`, and closing the part lost focus when the server's sentence (no theme slot) was drawn | CONFIRMED, in scope | **Fixed:** a disclosure; the close returns focus to whatever opened the part. jsdom row, RB6a–b |
| C2 | The 320 cut keeps whole sentences from the start: B3's old `strengthen:timeFrame` recording keeps 59 of 365 characters, and B5's `find_names` loses its proposal sentence | CONFIRMED, built to T-3's letter | **Question Q-3** |
| C4 | `buildFocusOf`'s comment claimed the old search text for all own words; true only for ≤ 80, and drops share the path | CONFIRMED, comment only | **Fixed:** the comment says both |

**Lens C's constraint table (all PASS):**
- the ledger exports give identical output;
- every changed hunk is builder-only;
- `BUILD_SCHEMAS` is deep-equal to `main`'s;
- no shape change in `thesisViewOf`, the free and research entries, the answers or `thesisCard`;
- the fences are untouched;
- `src/constants/sharedResearch.js` is untouched;
- B3's ledger and recordings are untouched;
- the B5 ledger is within its cap;
- the probes ran on the final prompt;
- §6 is pinned;
- the walk JSON is not in the production bundle.

The review was one round, as the prompt says; every check after it (suite, battery, differential, build, browser rows) was re-run on the final code.

## 8. The checks

| Check | Where, on what | Result |
|---|---|---|
| Full suite | WSL `~/pd-ci-srb5` (a worktree of `~/pd-ci`, `node_modules` linked to the install matching the lockfile `e457c10d0317`), Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, `flock /tmp/pd-suite.lock`, JSON report read, at `8d7a3a0f` | **exit 0** · Test Files 1,562 passed, 13 skipped (1,575) · Tests **35,589 passed, 0 failed**, 173 skipped (35,762) · 341 s. Earlier, at `c13cb86e`: exit 0, 35,575 passed, 0 failed |
| `npm run lint:gate` | the same tree | **exit 0** |
| `npm run test:rules` | WSL, JDK 21, the emulator | **exit 0** · 46 files · 839 passed |
| `vite build` (minified) | the same tree; `main` built in its own worktree | **exit 0** both |
| The ledger differential + control | §5 | 4 / 4 byte-identical; control 4 / 4 red |
| Mutants | §6 | 36 / 36 |
| Real browser | headless Edge against the smoke preview (`SR_LAYER_URL`): `thesisBuilder.browser.test.js` + `sheetLayer.browser.test.js` | **49 / 49** (38 + 11): the fold, focus through a step, a free tap, a Change and a save, the tapped part at 320/390/1280, every choice reachable and under its own tap, the pinned foot, one column at 393 |
| The founder's checklist, scripted | a fresh 393×852 context with no cookies on the preview (`walk/checklist.json`) | **12 / 12**: the preview opens with no login; the theme blank and the words in the conversation; the suggestion first in the choices with the segments under it; the reply in two sentences; the theme confirmed; the segment set; the ready sentence "My theme is AI data-center buildout, through Accelerator chips, built on NVDA, because …"; the wrong-if tagged "in words"; saved |
| Renders | 393×852, `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B5/walk/` | `walk-1-opened`, `walk-2-map`, `walk-3-theme-confirmed`, `walk-4-segment-set` (the first four screens), plus `walk-5-ready`, `walk-6-saved` |

**On Windows, during the build:** three hub jsdom rows (`CommandCenterHub.s5`, `.s6`, `.testIntegrity`) timed out once under load and passed on a re-run. They pass in the WSL suite, and none touches a file of this branch.

## 9. The bundle diff

Minified `vite build` of `8d7a3a0f` against `main` `2e069d42`, each in its own WSL worktree on the same install. To compare, each chunk's hashed file name is stripped, and so is every hashed file name inside the chunk's content.

| Chunk | `main` | branch | Why |
|---|---|---|---|
| `SharedResearchSheetBody-*.js` (lazy) | 146,384 B | **148,308 B** | the theme line, `themeLineOf`, the ordered runs, the "in words" tag, the time frame's mark, two copy lines |
| every other `.js` (54 stems) and `index.html` | | identical but for hashed file names (3 byte-identical) | the entry imports the Shared Research chunk by its hashed name |
| `index-*.css` | `aae6553465c34901…` | the same file | — |

`src/constants/sharedResearch.js` is untouched, and so is every module the hub chunk takes from it. `thesisWalk.json` and `thesisAnswers.json` have no production importer; only the smoke page and the tests read them.

## 10. Routine choices made here

1. **T-1's "two to six words, never a sentence" is asked, not enforced.** The map's no-theme line and the output contract ask for it. A validator rule would also bind `verify_source`'s suggestion, which T-1 keeps unchanged. The server does drop the one case T-1 rules out in so many words: the player's own words handed back (review A1). Probe 1 returned 3 words. A rule is one line if wanted (Q-5).
2. **The cut constant lives in `thesisSchema.js` (`MODEL_REPLY_MAX`), not in `THESIS_LIMITS`.** `src/constants/sharedResearch.js` ships in the hub chunk; leaving it alone keeps the hub's bytes.
3. **T-4 is held inside the transaction, as ruled.** The save's first read names a running step too (review B4), so a stale rev or an unready card answers `step_in_flight`, as the card route does. The in-transaction check is the one that holds against a step that starts meanwhile; `hooks.atTxStart` pins it.
4. **T-5's preference.** Clearing alone makes "one answer on the card" true for every card written from now on. The confirm also prefers the pick, because a pick on the card is always the latest step's. That covers a card written before B5 that holds both.
5. **The B3 `direction` probe replays in its recorded shape.** Under T-2 its card would be asked as `map_segments`. The fixture pins `recordedShape`, and a new row shows no builder card reaches the bare `direction` shape. Its schema stays compiled, unchanged.
6. **The walk tree's theme point** (after the map) has three ways on: the suggestion confirmed, the player's own phrase ("AI chips and data centers", matched loosely), or the segment first. Each carries the whole walk after it.
   - The tree is 5.55 MB raw: 183 KB gzipped, 24 KB brotli. B4's was 1.87 MB, 62 KB gzipped.
   - Only the smoke page loads it, and only for `?srFixture=walk`.
7. **"Write your own" opens the theme's part,** which holds its text box (B4's panel), rather than adding a second text box to the choices.
8. **A run-on reply is replaced, not kept long** (review A2): T-3's cap holds, and nothing of the model's ends mid-sentence.
9. **The smoke page is B4's, byte for byte,** as the prompt says ("the same loader"). Some scenario labels written for B4 now read one higher than the card: "mid-way, 4 of 6" shows 3 of 6, since the open no longer sets the theme.

## 11. Questions for the founder, and the watch list

**Questions (each built to the letter today; each is a one- or two-line change):**
- **Q-1 (T-5's gap; review A3/B1).** After "You pick, and tell me why" on the time frame, the pick clears the older suggestion. The next step of any kind replaces the pick, and the card is left with no time-frame answer: the three free choices and a fresh "You pick" remain.
  - **(a)** As built.
  - **(b)** The asked pick also lands as the suggestion. The newest answer survives: it reads "{agent}'s pick" while the pick stands and "{agent} suggested" after.
  - **(c)** Drop the clearing. The pick-first confirm then lets the older suggestion come back after the next step.
  - Recommended: **(b)**.
- **Q-2 (§4 rule (1) against §6; review A4).** The builder prompt still carries §4 (1), "The player's words are 'your observation'…", which tells the model to quote the player's words that way. The new §6 line forbids "your observation" in a reply. The three B5 probes wrote neither; B3's map recording opened "Your observation is…".
  - **(a)** Leave both.
  - **(b)** Drop §4 (1) from the builder prompt, as line (7) already is. Its "never restate them as true" would need a §6 home.
  - **(c)** Let §6 say how a reply names the player's words ("what you wrote").
- **Q-3 (the cut keeps the first sentences; review C2).** When three sentences don't fit in 320, the third goes, and that is where the proposal often sits. B5's `find_names` lost "I would build on Nvidia and AMD, with Broadcom as a third name." The B3 recordings, made before the T-3 prompt, lose more (`strengthen:timeFrame` keeps 59 of 365 characters).
  - **(a)** As built. The T-3 prompt brought 2 of 3 replies to two sentences.
  - **(b)** Keep the last sentence (the proposal) over a middle one.
- **Q-4 (the ready view; review B5).** A ready card whose theme is only suggested shows no theme line on the ready view; Keep researching shows it. Draw the theme's line on the ready view too?
- **Q-5 (T-1's phrase rule on the server; review A1).** Should the server also drop a suggestion of one word, or of more than six, or one that reads as a sentence? Today the prompt asks, and the server drops only the player's own words handed back.

**Watch on the allowlist:**
1. The draft sentence still reads "My theme is [your theme], …" while the theme is optional; the finished sentence drops it (review A6).
2. A theme the player confirmed is the agent's words. `ownTextsOf` still lets its numbers stand anywhere in an edited statement; the suggestion's numbers already had to sit in a verified finding to land.
3. The schemas' `reply` description still says "Two or three plain sentences … 600" (unchanged, as ruled), while the prompt says two and about 280. `find_names` wrote 327.
4. The bare `direction` schema is now unreachable by any builder card, but compiled.
5. A drop's first map now searches the drop's text, and long own words search the words rather than the question.
6. A save refused `step_in_flight` shows the server's line, "A step is already running for this investigation."; Save works once the step lands.
7. `build_why`'s reply in probe 3 says "a business-condition exit": plain enough, not a forbidden phrase, but jargon.
8. The walk JSON is 5.55 MB raw (183 KB gzipped), smoke only.
9. B4's smoke scenario labels read one higher than the card (routine choice 9).

## 12. The PR description

### Shared Research "Work an idea": B5, the round before the switch (dark)

**What it does** (Amendment B §B13, T-1 to T-8, the founder's Nov 17 rulings):
- **T-1** Own words never become the theme (`api/_utils/sharedResearch/thesis.js:87`). The first map suggests one in the agent's words: a two-to-six-word noun phrase, asked in `stepPrompt.js:239`, `:263-265`. The player confirms it or writes their own, for free. A suggestion that repeats the player's words, or arrives while one waits, is dropped (`thesisSchema.js:312-319`).
- **T-2** The theme gates nothing (`thesis.js:249-250`). With no theme the sentence opens "Built on {names}[, through {segment}], because …" (`thesis.js:207-217`).
- **T-3** Rulebook §6 and the builder prompt ask for two short sentences. The model's reply is cut at a sentence's end at 320 (`thesisSchema.js:56`, `:260`); a run-on first sentence is replaced by the plain line. Schemas are not recompiled.
- **T-4** The builder save refuses `409 step_in_flight` inside its transaction, before the rev and any write, by `applyCard`'s rule; it also checks on its first read (`store.js:782`, `:790`). A stale step does not block. `adoptIdea` is untouched.
- **T-5** An asked time-frame pick clears the older suggestion, and the confirm carries the newer answer (`thesis.js:342`, `:618`); its label says "{agent}'s pick" (`builderParts.jsx:245`).
- **T-6** A suggested theme does not hold the front (`thesisView.js:39-45`). Its confirm and "Write your own" sit as one line at the top of the choices (`builderParts.jsx:256` `ThemeLine`, `Builder.jsx:297-300`).
- **T-7** Three recorded probes, 3 calls, $0.068052: the theme "AI data-center buildout"; replies 209, 327 (kept 263) and 267 characters.
- **T-8** B4's Q-1 and Q-2 recorded closed. The wrong-if tag reads "in your words" only for `player_wrote`, else "in words" (`ThesisReady.jsx:146`).

Also: the client's sentence runs follow the new order (`thesisView.js:229`), and the builder's search text keeps the player's words (`api/forge/shared-research.js:593-615`). The fixtures are regenerated by the server's functions; the walk tree gains a theme point.

**Fenced functions:** none called, none edited. **Dark:** `SHARED_RESEARCH_BUILDER_MODE` stays `'off'`. No rule, index, flag, `modelTurn.js`, `method.js`, KB or `CommandCenter/` edit.

**Checks** on `8d7a3a0f`, with `main` unmoved:
- suite (WSL, `TZ=UTC`, 8 workers) exit 0, 35,589 passed, 0 failed;
- `lint:gate` exit 0;
- `test:rules` 839 passed;
- minified build exit 0; the bundle changes only the lazy Shared Research chunk; CSS identical;
- the ledger differential 4 / 4 byte-identical, with the control red;
- mutants 36 / 36;
- review: 3 lenses + 1 refuter, 13 confirmed, 8 fixed, 5 to the founder or the watch list;
- real browser on the smoke preview 49 / 49; the phone checklist scripted 12 / 12.

**Report:** `docs/audits/20261118_BUILD_SHARED_RESEARCH_B5.md`. **Smoke:** https://trade-seven-l6196i977-fais-projects-bc179554.vercel.app (`?srFixture=walk`).

**For the founder:** five questions (report §11), then the merge, then the one-line switch.

## 13. The founder's phone checklist

On the smoke preview, iPhone, `?srFixture=walk`:

1. Type "I want to play AI": the card opens with the theme blank and your words in the conversation.
2. *Map the segments*: a short theme suggestion sits above the segment choices; Atlas's reply is two short sentences.
3. Confirm the theme or type your own; then pick a segment.
4. Walk on to *Save thesis*: the sentence opens with your confirmed theme, and a wrong-if Atlas wrote reads "in words".

**Notes on the walk:**
- **Typing your own theme:** at step 3 the sample is "AI chips and data centers" (loosely matched). Tap *Write your own*, type it, *Send · free*. Any other phrase answers a line naming the sample.
- **Picking the segment first** also works; the theme then stays suggested, and the saved sentence opens "Built on …".
- **The rest of the walk** after the segment is B4's tree (names, why, wrong-if, time frame), on every theme branch.
