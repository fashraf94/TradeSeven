# Build report — Shared Research "Work an idea" B2, the client (dark)

**Smoke preview:** https://trade-seven-hobprw3dz-fais-projects-bc179554.vercel.app
- `?srFixture=index` lists every scenario.
- Branch `claude/shared-research-b2-smoke`, cut from the final tree `7c80e99f` (the code head plus `main`, with the report's first commit; its follow-up commit is not on it). It is never merged.
- Every answer comes from the committed fixtures, with no production read and no model call.

**Date:** Nov 13, 2026 · **Session:** local Claude Code (Opus 5.5), own worktree · **Branch:** `claude/shared-research-b2` · **PR:** #1059 (draft)

**Design of record:** `docs/design/shared-research/SHARED_RESEARCH_WORK_AN_IDEA_V2.html`, the first commit `140b8ebfe80ba1c72e2336ed3e853466c2464340` (byte-identical to the attachment, plus its `docs/README.md` row).

**Base:**
- Cut from `origin/main` @ `d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6` (#1048, B1, merged as `0027a9ba`, is an ancestor).
- `origin/main` was merged in three times:
  - `050123cf` (#1057: `previousSessionOf` counts a same-millisecond earlier session), at `bb34515e`;
  - `c3ed2cfd` (#1054 the KB-0 loader, #1055 and #1056 the research modal), at `b0a20018`;
  - `979b030c` (#1060, the research modal sheet's follow-up), at `7c80e99f550b35da6bfeacfd50f315d7b0d31a51`.
- Only `docs/README.md` overlapped: both sides add rows to the Shared Research table, and all are kept.
- The fixtures, composed by the server's own functions, still match under #1057 (`srAnswers.test.js`).
- #1054–#1056 and #1060 touch none of the sheet's files or dependencies: HubSheet, the overlay stack, SignalDrop and the server's Shared Research modules are all unchanged.

**Code head:** `7ac8367be1a9adb73baf2ff970ccaf4e3f85e1ea`. The final tree is `7c80e99f`: the code head plus `main` at `979b030c` (#1054–#1057, #1060). None of main's changes touches a file of this branch except the README's table. Every final check ran on it. The report's first commit (`15949d67`) sits under the last merge, and its follow-up commit is on top: the review rows' mutants, the browser rerun at the pushed head, and checklist item 7 as written. Both are docs only, and each was built before its push.

**Spec:** `docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md` §7 and §15–§17; the build prompt's K-1 to K-11; the founder's preamble rulings P-1 to P-5 (Nov 13).

## Verdict

| | |
|---|---|
| What was built | The sheet's body, `src/components/SharedResearch/SharedResearchSheetBody.jsx` (default export), with its hook, service, screens, parts, view, copy and style. It covers every state of spec §7.2 and K-6, plus the states the review added. `SignalDropEntry` gets two additive props: `ctaLabel` (K-4) and `zIndex` (P-1). |
| Is it dark? | Yes. Nothing in the app imports the body (the boundary test's dark rows). In the minified client bundle only the entry chunk that holds `SignalDropEntry` differs from `main`'s (5,010,440 → 5,010,490 bytes, +50); the CSS is byte-identical. |
| Founder rulings | P-1 to P-5 built as ruled (§1). The non-blocking notes approved; the parse's uncounted model call is Watch 1. |
| Tests (final, on `7c80e99f`) | Full Linux suite: **exit 0**. Test Files 1,455 passed, 11 skipped (1,466); Tests 32,464 passed, 131 skipped (32,595). This branch's 10 files: 203 rows passed, and the 11 browser rows skipped by design. Rules suite: **exit 0**, 42 files, 784 tests. `lint:gate`: **exit 0**. |
| Real browser | 11 rows in headless Edge, all passed on the harness and 11 of 11 on the smoke preview: the modal over the sheet at 320, 390 and 1280 (P-1); focus at 390 and 1280 (c1, c2); the question box at 320. |
| Mutations | **jsdom: 62 of 62 killed**: the brief's 1–10, plus one for every row the review added. Every file was restored byte for byte (SHA-256 checked). **Browser: 5 of 5 killed** at the pushed head (L1, R8, R8b, R9, Q1). |
| Review (K-11) | Four lenses, each with a refuter, one round. 43 distinct finding lines: **30 CONFIRMED, 9 PARTLY, 2 REFUTED**, 2 new. 3 must-fix and 16 should-fix, all fixed. Every behavioural fix has a row and a mutant; the six style-only fixes were checked by measurement, render or inspection (§8). The diff is 30 files and 13,469 lines (13,466 added, 3 removed), measured on the cumulative branch diff with this report included, above BUILD_RULES §2's threshold. |
| Open for the founder | **No questions.** The phone checklist is §12; what to watch once the allowlist is on is §9. |
| STOP list | Nothing on it was done:<br>- nothing under `src/components/CommandCenter/` edited;<br>- no `api/` file, rule, index or flag value changed;<br>- `SignalDropEntry` unchanged with the props absent;<br>- support, status and the carried set never computed on the client;<br>- no "running" without a request in flight, no confidence number, no composed percentage, no "Shadow";<br>- no network call in a test, no model or provider call anywhere. |

## 1. Base, preamble and the STOP

- **`git fetch origin main` first.** #1048 (B1) is merged on `origin/main` as `0027a9ba`. The branch `claude/shared-research-b2` was cut from `origin/main` @ `d9b4e3c1c8183cf1917ef8d0bd5ad6f4110e7ab6` (upstream unset; the worktree branch `claude/shared-research-b2-5ae6f9` was left as it was). `main` had not moved when re-fetched after the rulings.
- **The design of record**, commit `140b8ebf`: the attachment byte for byte at `docs/design/shared-research/SHARED_RESEARCH_WORK_AN_IDEA_V2.html`. The blob's SHA-256 `bdb72025c861fc977050351f64565ad2847034bef8dcac988f7f735256ab86e3` equals the attachment's (LF only, 0 CR). The commit also adds its `docs/README.md` row, and nothing else.
- **The preamble STOP** (Nov 13; report `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B2/20261113_SHARED_RESEARCH_B2_PREAMBLE_STOP.md`). Preamble 3 found that the SignalDrop modal (z-index 250) paints under the hub sheet (`HUB_LAYERS.sheet` 1000). Registering it `within` the stack makes the sheet inert but cannot change paint order. Four smaller items changed how a ruling reads. The founder ruled the same day:

| # | Ruling | Built |
|---|---|---|
| **P-1** | Option (a): `SignalDropEntry` gets a second additive prop `zIndex` (default 250). The body passes a named constant above `HUB_LAYERS.sheet` and below the ceremony (1001), pinned by test, plus a real-browser row and a viewed render. | `SignalDropEntry.jsx` (`zIndex` prop); `sharedResearchStyle.js` `SR_DROP_LAYER = 1001`; `sharedResearch.boundary.test.js` (pinned against `hubStyle.js` and `DeployCeremony.jsx`'s `Z_INDEX`); `sheetLayer.browser.test.js` at 320, 390 and 1280; render `04-drop-modal` |
| **P-2** | The `previous` line shows on the new investigation's work view; phone check 2 reworded. Watch item: starting the new one spends a daily investigation. | `screens/Work.jsx` (the `data-sr-previous` line, Open → read-only, Back); the checklist item 2; Watch 2 |
| **P-3** | The modal stays unchanged; no bailout drop preview. A drop's `existing` uses the story's Continue state. | `screens/Previews.jsx` `ExistingContinue` for both kinds; no bailout branch anywhere |
| **P-4** | The body takes `agentId` (string \| null) from the hub; `null` → *Use it in my next game* not offered. | `screens/Adopt.jsx` `SavedIdea` (`canEquip`); the hub's needs |
| **P-5** | The defaults: typed refusals and the IP limiter show their `message`; `disabled` gates; `step_failed`, `frame_failed` and `findings_full`-as-reason show `copy.js`'s lines, pinned; mutation 8 is scoped to typed refusals. | `useSharedResearch.js` `failureOf`; `SR_COPY.server` pinned in `sharedResearchCopy.guard.test.js` |
| Notes | The non-blocking notes approved as listed; the parse's uncounted model call added to the watch list. | Watch 1 |

**The shapes, re-verified against the merged server** (preamble 2): every request body and answer shape matches, as tabled in the STOP report. In brief:
- `frame`, `open` ×3, `step` ×4, `close`, `adopt`, `GET ?sessionId=`, `GET ?list=open`;
- `previous`, `previewRev` (`pr1.` + 32 hex), `answerStale`, `changed.summaryWithheld`;
- `429 rate_limited` + `Retry-After`, and the IP limiter's 429;
- the replaced reply, and the refusal codes (B1 report §5).

The four answers without a `message` are P-5's. `SignalDropEntry` had no test file (preamble 4; K-4's pin is new).

**What the build found that the preamble did not:** a lead's `status` from the server can be `verified` (routine choice 2). Chromium leaves inert elements out of hit-testing, which shaped the layer row (§6).

## 2. Routine choices made here (K-1)

1. **Files.** The spec's `SharedResearchSheet.jsx` is `SharedResearchSheetBody.jsx` (K-2: the Huddle body's name and boundary). The spec's `parts/*.jsx` are one `parts.jsx`; both previews and the Continue state share `screens/Previews.jsx`; the tokens and the layer constant live in `sharedResearchStyle.js`.
2. **A lead's label.** The server gives a lead the status of its best finding, and that can be `verified`: Northfield Thermal's best finding is a sourced fact that it is privately held. Shown on the name, that would read "Source-backed" beside a company that is not supported (review a5). So a lead wears no status of its own: its name, a plain "Lead" tag, its symbol or `ELIGIBILITY_LABELS.unresolved` ("Symbol · not in the app's records"), and below them its best finding whole, with that finding's own label, source and date (`parts.jsx` `Lead`). Spec §4.4 says leads list their Inferred or Unresolved label, §6.7 gives the server's field; the finding keeps it. *Server vs spec, listed.*
3. **What blocks Save on the client.** Only what both sides agree on: no company picked, no time frame, over 1,000 characters (`STATEMENT_MAX`, pinned to the record model's `STATEMENT_MAX_LEN`), and a deselected supported company still named. That last check is `namesCompanyView`, the server's `namesCompany` mirrored and parity-pinned on a table, with the generic-word list pinned to the server's text. Numbers are the server's check alone (`unsupported_assertion`, shown with its message). A looser client copy of `strayNumberOf` could block a statement the server accepts.
4. **The carried evidence** is shown per company, from the server's per-company `carried` lists. No total is composed for a partial pick: the STOP list forbids a carried set computed on the client. "What Save creates" says "the evidence above and your confirmation".
5. **Dates.** A fact's day (`at`, `asOf`: midnight UTC on the server) is shown in UTC, so it is the day the server stored (review a1). Clock instants (a read time, an update, a story's time) are Eastern (`America/New_York`) with "ET". "Nov 12, 2026"; "Nov 12, 3:00 PM ET". "published {day}" shows only for a retrieved source whose date is its publication (review a2 and its refuter).
6. **Motion: none of the body's own.** The running line is a still dot and its words; disclosures open at once. So reduced motion is instant by construction (§11). The sheet's entrance is HubSheet's, through `motionToken`.
7. **One request in flight at a time**, across the hook: stricter than "per session". The list of open work loads beside it and blocks nothing.
8. **The uncertain save.** No answer arrived (the network, or the client's 35 s timeout, above the route's 30 s), or the answer was a 5xx. A typed 4xx is a refusal: nothing was created, and the server's line says so.
9. **The adoption preview is read fresh** when the adoption view opens (`GET ?sessionId=`). Only the GET carries `adoptPreview`, and a step answer leaves the held one out of date, so it is dropped.
10. **Retries re-send the same id.** That covers a step's `stepId`, an open's `requestId` and a framing's `requestId`. A direction's words come back from its exchange. An examine target is kept for the page's life. After a reload an examine step cannot be retried by id: Try again is hidden, and the card's Examine starts a new step.
11. **"What the records already hold"** shows each stored row's name, symbol, sector, the ranking score and its date. Percentile and tier are not shown: no composed percentage, and "tier" is on the banned list.
12. **The drop preview names no type** (review a15: the parse's `contentType` before the open and the record's type after it could differ). It shows "Your drop · {time}", what the drop is about (the parse's `topic`) and the names it mentions (the parse's validated symbols). Its question is composed from the topic ("What is behind {topic}, and which company earns from it?"), with `DEFAULT_BEAT_QUESTION` when there is no topic.
13. **The gated line** is `HUB_COPY.research.disabled` (the spec's `hubCopy.js:145` at `ba22a52f`), pinned equal. The design's companion line is added: "You can read the stories; starting an investigation needs research access."
14. **Focus.** The modal's result moves focus to the drop preview's question field, because the button it came from is leaving. Escape or Close returns focus to "Use a SignalDrop" through the stack, and HubSheet returns focus to its own opener. Focus never falls to `<body>` inside the sheet (review c1). The body's root takes it after a render that leaves it there (a control unmounted), and on a `focusout` that goes nowhere (a control Chromium blurred after disabling it). Both are proven in a real browser.
15. **The fixtures are the server's.** `answers.json` is composed by B1's own functions over B1's fixture records and the recorded probe (`srAnswers.test.js`, regenerable with `GENERATE_SR_FIXTURES=1`), and drift-pinned. Five rows render a variant of a fixture answer to reach a state no server fixture holds; each is named in its row.
16. **The smoke page** is a query parameter, `?srFixture=`, on any path (the shell smoke's `?sheetFixture=` precedent), not a `/smoke/` path.
17. **The agent's name** in the partner's reply and the exchanges is the prop; "your agent" otherwise. The honest line capitalizes it where it opens the sentence.
18. **The question box grows to its question** (found in the renders). Two fixed rows cut a beat's question off mid-line at 320 px. `QuestionBox` (`parts.jsx`) sizes its textarea to the content after each change, and the player can still resize it. It is proven at 320×700 in a real browser (mutant Q1).

## 3. Every state, as built (spec §7.2 + K-6, and the review's)

Each row names the `data-screen-label` or marker it renders, the server field or answer it reads, and the jsdom row that shows it (`S` = `SharedResearchSheetBody.states.jsdom.test.jsx`, `F` = `.flows.`, `H` = `useSharedResearch.uncertain.jsdom.test.jsx`, `R` = `SharedResearchSheetBody.review.jsdom.test.jsx`, the review's rows). The smoke scenario (`?srFixture=`) is in brackets.

| Screen | State | From | Row |
|---|---|---|---|
| Start | no open work | `GET ?list=open` → `open: []` | S "no open work" [start-empty] |
| Start | open work | `open[]` rows → Continue → `GET ?sessionId=` | S "open work" [start] |
| Start | open work did not load | the list GET failed → "Couldn't load your open research." as an alert | R "c3: the open-research list that did not load is an alert" |
| Start | a Continue read in flight or failed | rows held and "Opening…" while it runs; a failure → an alert with the server's line, or "Couldn't load…" (review b5) | R "no answer: the load line", "a refusal: the server's own line" |
| Start | stories, 3 of 5, Show more | the `stories` prop | S "stories" [start] |
| Start | no stories | `stories: []` | S "no stories" [start-empty] |
| Start | stale stories | every `publishedAt` older than 48 h → "Stories last updated {date} · newer items may exist" | S "stale stories" [start-stale] |
| Start | gated | the `gated` prop, or any `404 disabled` | S "gated (the prop)", "gated (a server 404 disabled)" [start-gated] |
| Start | daily limit | `quota.investigationsToday >= perDay` → copy.js `daily_limit` | S "daily limit" [start-daily-limit] |
| Start | framing limit | `quota.framingsToday >= framingsPerDay` → copy.js `framing_limit` | S "framing limit" [start-framing-limit] |
| Start | budget paused | `503 budget_paused`'s `message` | S "budget paused" |
| Framing | running | the frame request in flight only | S "running only while the call is in flight" [own-words] |
| Framing | still framing | a repeated frame answered while the first runs → "Your question is still being framed. Try again in a moment." (review a12) | R "a repeated frame answered \"still framing\"…" |
| Framing | failed | `frame_failed` (no message) → copy.js line; Try again re-sends the requestId | S "failed" [own-words-failed] |
| Framing | framed | `frame { question, check, notEstablished }` → Investigate → `open { sessionId, question }` | S "running only…" |
| Item preview | fresh | the story; nothing sent until Investigate → `open { entry: { kind: 'item', itemRef, question, direction? }, requestId }` | S "fresh" [story] |
| Item preview | existing | `existing: true` → Continue (also a drop's, ruling P-3) | S "existing" [story-existing] |
| Drop | modal | `SignalDropEntry` with "Investigate this" at layer 1001, registered `within` | F "Use a SignalDrop opens the modal…", the real-browser row [drop] |
| Drop | drop preview | the modal's `{ parseResult, dropId }` → topic, validated names, the composed question → `open { entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: dropId } } }` | F "the modal's CTA reads 'Investigate this'…" [drop] |
| Work | opening (no summary) | `record.summary: null`; `storedRows`; the story as "From FantasyTimes", never Source-backed | S "the opening" [story] |
| Work | answer | `record.summary`; companies; the four lines; the next step; steps left | S "an answer" [work] |
| Work | running step | the step request in flight only (`role="status"`) | F "a step shows running while its request is pending" [work-running] |
| Work | reopened while a step was running | `lastStep.status: 'running'`, no request → "A step was in progress · Try again" | F "a reopened sheet never shows running" [was-running] |
| Work | failed step | `lastStep.status: 'failed'`, or a `step_failed` answer → copy.js `step_failed`; Try again with the same stepId; `findings_full` as the reason → its own line, no Try again | S two "a failed step" rows [step-failed] |
| Work | budget spent | `stepsUsed >= stepBudget` → copy.js `budget_spent`; reading, adoption and close stay | S "budget spent" [spent] |
| Work | step limit | `quota.stepsToday >= stepsPerDay` → copy.js `step_limit` | S "step limit" |
| Work | no next step | `nextAction.statusReason: 'no_next_step'` → "No next step is proposed…" | S "no next step" [no-next] |
| Work | concluded | `record.state: 'completed'`, `concluded` | S "concluded" [concluded] |
| Work | saved | `terminalReason: 'saved_to_list'` | S "saved" |
| Work | age + Refresh | `record.age > AGE_DAYS` → "{n} days old" · Refresh = `step { intent: 'refresh' }` | S "age + Refresh" [aged] |
| Companies | supported | `companies.supported[]` as received; each card's own target | S "supported", F "Correction B" [work, companies] |
| Companies | leads | `companies.leads[]`; never a card, never a pick | S "leads" [work] |
| Companies | none yet | `supported: []` with an answer → "No public company has a supported connection yet…" | S "none yet" |
| Companies | none (concluded) | → "No supported public company in this chain…" | S "none (concluded)" |
| Adopt | idle | `adoptPreview` (read fresh); the draft = the picked fragments | F "the draft is the picked fragments" [adopt] |
| Adopt | stray name | a deselected supported company still named → Save held | F "a deselected company still named blocks Save" |
| Adopt | over 1,000 | the count says so; Save held | F "over 1,000 characters" |
| Adopt | saving | the adopt request in flight | the uncertain rows (status `saving` between) |
| Adopt | failed | a typed 4xx → its `message` | F "a typed refusal shows the answer's message" |
| Adopt | stale | `409 preview_stale` → the new preview, edits kept, confirm again with the new rev | F two "preview_stale" rows [adopt-stale] |
| Adopt | uncertain | no answer, or a 5xx → only "Check the record" | F "no answer: Check the record only", "a 5xx is uncertain too" [adopt-uncertain] |
| Adopt | recovered | the check finds `saved_to_list` → "Found it…" | F "Check the record → saved_to_list" [adopt-uncertain] |
| Adopt | not saved | the check finds the record open → "Checked: nothing was created…" → Save again | F "Check the record → still open", H [adopt-notsaved] |
| Adopt | already saved | an idempotent answer (`idempotent: true`) → the "already saved" line, not this screen's words (review a6) | R "saved before elsewhere…" |
| Adopt | no preview | running · an unconfirmed save (only Check) · the read failed (the load line and Try again) · closed or saved elsewhere · else "no supported company" (review b7) | R "its read failed…", "closed elsewhere: the closed line", "the re-entry read fails…" |
| Any | gated mid-flow | a step, a read or a save answered `404 disabled` → the gated line, no Try again (review a3) | R the three "answered disabled" rows |
| Adopt | saved | `{ watchlistId, version: 1 }` → the saved view, the honest line | F "the saved view carries REVIEW_HONEST_LINE…" [adopt] |
| Equip | none / declined / running / done / failed | ready → equip on `agentId`; `status_conflict` proceeds; a failure → "Saved, not equipped."; no `agentId` → not offered | F five equip rows [adopt, equip-failed] |
| K-6 (a) | previous | `previous` on the open answer or the GET → the line on the new investigation; Open reads it read-only | S "(a) previous" [story-previous] |
| K-6 (b) | answer out of date | `record.answerStale: true` | S "(b) answerStale", "(b) no stale flag" [stale] |
| K-6 (c) | answer withheld | `changed.summaryWithheld` (or the stored `lastStep.summaryWithheld`) | S "(c) summaryWithheld" [withheld] |
| K-6 (d) | replaced reply | the partner exchange's text, plain | S "(d) the replaced reply" [replaced] |
| K-6 (e) | 429 | `rate_limited` or the IP limiter's → its line; held until `Retry-After` | F two "a 429 holds the action" rows [rate-limited] |
| K-6 (f) | previewRev | echoed byte for byte | F "Save sends … previewRev EXACTLY as received" |
| K-6 (g) | dates | a fact's day in UTC (the day the server stored; review a1); "{date} · published {asOf}" only for a retrieved source dated by its publication (a2 and its refuter); " · undated" → "Undated · read {date}" (the read time, Eastern, ET) | S "(g) dates"; R "the stored-claims fact … shows its date alone" |
| K-6 (h) | drop labels | "Your drop", "From your drop" | S "(h) drop labels" |
| K-6 (i) | quota states | each code's state | S "(i)" rows and the quota rows |

## 4. The corrections, the layer and focus

### The three corrections, on the client (K-7, spec §9)

| | What the client does | Rows |
|---|---|---|
| **A** (support is the server's) | Companies render from `companies.supported[]` and `companies.leads[]` as received, in the server's order. Nothing on the client reads `stepsUsed`, a count or a status to promote a company. A lead is never a card and never a pick. | S "supported", "leads"; F "a refresh answer with unchanged companies renders the same cards and leads"; mutation 1 |
| **B** (each card its own target) | Each card's *Examine this connection* sends that card's own `target { symbol, relationshipFindingId, openFindingId }` from the server's projection. | F "two cards send two different targets { symbol, relationshipFindingId, openFindingId }"; mutation 2 |
| **C** (adoption from the server's preview) | The adoption view reads `adoptPreview` fresh (`GET ?sessionId=`). Deselecting a company rebuilds the draft from the preview's per-company fragments, with no request. A deselected supported company still named blocks Save (`namesCompanyView`, parity-pinned to the server's `namesCompany`). `409 preview_stale` re-reads the record and keeps the player's edits where the named companies still exist. The server's checks are final. | F "the draft is the picked fragments; dropping a name regenerates it with no request", "a deselected company still named blocks Save", the two "preview_stale" rows; mutation 5, R3 |

### The layer and focus, in a real browser (ruling P-1, review c1 and c2)

jsdom paints nothing, and it lets an inert element take focus, so these are measured in headless Edge (`playwright-core`, channel `msedge`) on the smoke page. The page is the body inside a real `HubSheet` under `HubOverlayProvider`, with every request answered from fixtures. The file is `src/components/SharedResearch/sheetLayer.browser.test.js`, gated on `SR_LAYER_URL` (CI skips it: it has neither the page nor a browser).

| Row | Viewports | What it proves |
|---|---|---|
| The drop modal is on top | 320×700, 390×844, 1280×800 | The modal's textarea, *Read this signal* and *Investigate this* are each the element **painted** on top at their centre (asked with every `inert` mark lifted for that instant) and the element a **tap** reaches (asked as the page is). The modal's z-index is above the sheet's, the sheet is inert while it is up, and after *Investigate this* the sheet is live again with no sideways scroll. |
| c2: the modal opened at once | 390×844, 1280×800 | In mode `signaldrop` the modal opens on mount. Escape leaves focus inside the sheet, not on `<body>`, and a second Escape closes the sheet. |
| c1: focus through Investigate | 390×844, 1280×800 | After *Investigate this* (the button disables while the open runs), focus is in the sheet, both while the request is in flight and after the Opening screen replaces the preview. Escape still closes the sheet. |
| c1: focus through the next step | 390×844, 1280×800 | The step runs on the same screen (the view never changes; the refuter's case for why a `[view]` effect is not enough). The next-step button leaves while it runs, and focus stays in the sheet. Escape closes it. |
| The question shown whole | 320×700 | On a story preview and on the framing, the proposed question's box shows all of its text (`scrollHeight ≤ clientHeight`), also after more is typed. |

**What the c1 rows found.** The first fix failed in a real browser, in two ways.
- **A control that disables.** Chromium moves focus off it on a timer of its own, after React's render, and then fires `focusout` with `relatedTarget: null`. A probe (Nov 13, Edge) found `activeElement` still on the button at the microtask, the frame and `setTimeout(0)`, and on `<body>` with that event by 50 ms. The refuter timed the same. The render-time keeper never sees it. So the body's root also takes focus on a `focusout` that goes nowhere: a React `onBlur` on the root, checked after a microtask. A window losing focus leaves `activeElement` in place, so it is left alone.
- **A control that unmounts.** Chromium fires `focusout` synchronously as it removes the node, but by then React has let go of the element, so no React handler sees the event. The render-time keeper is the one that covers removal.

Each keeper has its own browser rows. The browser mutants (L1, R8, R8b, R9, Q1) are §7; the runs against the smoke preview are §5.

## 5. Tests and checks (on the final tree `7c80e99f`)

Every final check ran on the merged tree `7c80e99f`, the code head `7ac8367b` plus `main` `979b030c`. The WSL trees were `~/pd-ci-srb2` (the branch) and `~/pd-ci-srb2m` (`main`, for the bundle), with runs under `~/pd-srb2-runs`. The exit codes and the `Test Files` lines were read directly, never through a pipe.

| Check | Result |
|---|---|
| Full Linux suite (`flock /tmp/pd-suite.lock`, `TZ=UTC`, `--maxWorkers=8`) | **exit 0**: Test Files 1,455 passed, 11 skipped (1,466); Tests 32,464 passed, 131 skipped (32,595); 310 s. The same run was also exit 0 on the two earlier merges: `bb34515e` (1,445 files, 32,072 tests) and `b0a20018` (1,455 files, 32,460 tests). The rules suite, `lint:gate` and the bundle diff matched on each. |
| This branch's rows in that run | 10 files: 203 rows passed, 0 failed; the 11 real-browser rows skipped by design (no `SR_LAYER_URL` in CI) |
| `npm run test:rules` (emulator, Java 21) | **exit 0**: 42 files, 784 tests |
| `npm run lint:gate` (`eslint . --config eslint.gate.config.js --max-warnings 0`) | **exit 0** |
| `vite build`, minified and unminified (branch and `main`) | **exit 0** each; 111 files each side (§6) |
| `vite build` of each pushed docs-only head before its push, in a WSL tree | **exit 0** each. With hashed names masked, the report's first commit `15949d67` equals `b0a20018` file for file, and the follow-up commit equals `7c80e99f` (111 files, 0 differ). Windows could not build either commit, because the main checkout's `node_modules` lacks `three` (an install gap there, left untouched). |
| Real browser, the local harness (`SR_LAYER_URL=http://127.0.0.1:5200`, headless Edge) | **11 of 11 passed**, at the code head and again at the pushed head `15949d67`: 3 layer rows, 2 c2, 2 c1 Investigate, 2 c1 next step, 2 question box |
| Real browser, the smoke preview (`SR_LAYER_URL=https://trade-seven-hobprw3dz-fais-projects-bc179554.vercel.app`) | **11 of 11 passed**; the checklist script there too, 14 of 14. Item 7 was also done exactly as written: Apple unticked, a time frame picked, Save. The saved view names Shopify Inc. alone ("Shopify Inc. · positional · about 30 sessions · no conditions"). |
| The founder's checklist, by script on the harness at 390×844 | **14 of 14**: every quoted string present at the state its item names (§12) |
| Windows, the directory's own files (`src/components/SharedResearch`, `src/components/SignalDrop`) | 10 files passed and 1 skipped; 229 rows passed and 11 skipped. This run includes SignalDrop's other test files. |

**The census guards.** The new non-test file `__fixtures__/sourceText.js`, and the new strings in the test files, red nothing in the full suite. That includes the census guards, which fail only in a full run.

## 6. The bundle diff (K-3)

**How it was compared.** The minified `vite build` of the merged tree `7c80e99f` was compared with that of `main` `979b030c`, every hashed asset name masked (`name-HASH.ext` → `name-H.ext`, in file names and inside every file). Files sharing a masked name were compared as a group.

| | Files | Differ | What differs |
|---|---|---|---|
| Minified, masked | 111 each side | **2** | `assets/index-*.js` (5,010,440 → 5,010,490 bytes, +50) and its `.map` (17,925,395 → 17,926,092) |
| Unminified, masked | 57 each side | **1** | `assets/index-*.js`: 5 windows, exactly `SignalDropEntry`'s additive hunks |
| CSS | 1 each side | **0** | `index-Bt3Ms9P_.css`, 36,828 bytes, byte-identical |

**Why only the entry chunk.** `SignalDropEntry` lives in the entry chunk (Discover imports it). Its five hunks are:
1. The signature takes `ctaLabel = "Start dialogue"` and `zIndex = 250`.
2. The overlay's `zIndex: 250` becomes `zIndex`.
3. The confirm footer receives `ctaLabel`.
4. `ModalFooter` takes `ctaLabel`.
5. The footer's literal "Start dialogue" becomes `ctaLabel`.

With both props absent, Discover's modal renders the same values; K-4's pin proves it in jsdom.

**What else changed.** Every other chunk's name changed only because the entry's hash did; masked, they are identical. "Investigate this" occurs 0 times in either bundle: nothing in the app imports the body, so it is dark. The CSS is unchanged, so Tailwind minted no new rule from the branch's strings: Tailwind v4 scans the whole project outside docs/, and a bracketed string such as `[name:thing]` can become a CSS rule.

## 7. The mutation tables

**How each mutant ran.**
- The jsdom battery ran in the WSL tree `~/pd-ci-srb2`, at the code head `7ac8367b`. That is the code the final tree carries; main's #1054–#1057 and #1060 touched none of it.
- For each mutant, the runner (`run.mjs`) checks that the `from` text occurs exactly once (an anchor that drifted reads BROKEN and is never skipped silently). It then writes the mutant and runs the named test files with `TZ=UTC`, deleting the JSON report first so a crashed worker cannot read as a pass.
- The file is then restored from `git show HEAD:<file>` and its SHA-256 compared with the original; a mismatch aborts the battery.
- KILLED means a non-zero exit **and** at least one failed row.
- A dry run checked every anchor against HEAD's bytes before the battery (44 of 44 anchored).

**Retired and moved.**
- R9+ is retired: its second anchor sat on the keeper's old one-line form.
- R9, the at-once modal registering first (c2), is in the browser table only. jsdom lets an inert element take focus, so no jsdom row can see it.

**A second battery for the review's rows.** The first battery did not reach 18 rows of the review file (a7, a9, a12, a13, the second b3 row, b5, the second b6 row, b7, b9, b10, N1, c3, c5, c7, c9 and two c10 rows). Each got a one-line reversion mutant, and all 18 ran at the pushed head `15949d67` in a fresh WSL tree. That is the same code and tests as `7ac8367b`.

**Totals.** **62 of 62 killed**: 44 at `7ac8367b` (after 44 of 44 at `0b1ea575`, before the question-box change) and 18 at `15949d67`.

### jsdom

| Id | The defect planted | File | Result | Rows failed |
|---|---|---|---|---|
| M1 (brief 1) | the client marks a lead as supported | `screens/Work.jsx` | KILLED | 2 of 72 |
| M2 (brief 2) | two cards send the same target | `screens/Work.jsx` | KILLED | 1 of 37 |
| M3 (brief 3) | running shows on a reopened sheet with no request | `useSharedResearch.js` | KILLED | 1 of 71 |
| M4 (brief 4) | the uncertain save retries before checking | `screens/Adopt.jsx` | KILLED | 4 of 71 |
| M4b | the hook sends a save while it is uncertain | `useSharedResearch.js` | KILLED | 1 of 36 |
| M5 (brief 5) | previewRev re-serialized instead of echoed | `useSharedResearch.js` | KILLED | 2 of 71 |
| M6 (brief 6) | an undated finding shows its read date as the fact's date | `sharedResearchView.js` | KILLED | 3 of 91 |
| M7 (brief 7) | SignalDropEntry renders 'Investigate this' with the prop absent | `src/components/SignalDrop/SignalDropEntry.jsx` | KILLED | 2 of 14 |
| M7b | SignalDropEntry's overlay layer moves with the prop absent | `src/components/SignalDrop/SignalDropEntry.jsx` | KILLED | 4 of 14 |
| M8 (brief 8) | a refusal shows a client string instead of the server's message | `useSharedResearch.js` | KILLED | 9 of 109 |
| M9 (brief 9) | the body imports from src/components/CommandCenter/ | `SharedResearchSheetBody.jsx` | KILLED | 2 of 38 |
| M10 (brief 10) | answerStale is ignored | `screens/Work.jsx` | KILLED | 1 of 72 |
| M11 | the drop modal's layer is not above the sheet (P-1) | `sharedResearchStyle.js` | KILLED | 2 of 109 |
| M12 | the modal is registered without `within` (it marks itself inert) | `SharedResearchSheetBody.jsx` | KILLED | 1 of 71 |
| M13 | the modal is never registered with the stack | `SharedResearchSheetBody.jsx` | KILLED | 3 of 71 |
| M14 | the body mounts the modal without 'Investigate this' | `SharedResearchSheetBody.jsx` | KILLED | 2 of 109 |
| M15 | the stray-name check is dropped | `screens/Adopt.jsx` | KILLED | 1 of 71 |
| M16 | deselecting does not regenerate the draft | `screens/Adopt.jsx` | KILLED | 2 of 71 |
| M17 | two requests can be in flight (a double tap sends two steps) | `useSharedResearch.js` | KILLED | 1 of 73 |
| M18 | a 429 does not hold the action | `useSharedResearch.js` | KILLED | 3 of 71 |
| M19 | a server 404 disabled does not gate | `useSharedResearch.js` | KILLED | 1 of 72 |
| M20 | a ready that already happened stops equip | `src/services/sharedResearchService.js` | KILLED | 1 of 37 |
| M21 | a step retry mints a new stepId | `useSharedResearch.js` | KILLED | 3 of 75 |
| M22 | the step_failed answer shows a client line instead of the server's (P-5) | `useSharedResearch.js` | KILLED | 1 of 38 |
| M23 | the gated line drifts from the hub's | `sharedResearchCopy.js` | KILLED | 1 of 19 |
| M24 | a banned word enters the copy | `sharedResearchCopy.js` | KILLED | 1 of 19 |
| M25 | a screen writes its own literal words | `screens/Discard.jsx` | KILLED | 1 of 19 |
| M26 | the withheld note is ignored (K-6 c) | `screens/Work.jsx` | KILLED | 1 of 38 |
| M27 | previous is not offered (K-6 a) | `screens/Work.jsx` | KILLED | 1 of 38 |
| M28 | a lead wears a status of its own (its best finding's, Source-backed) | `parts.jsx` | KILLED | 2 of 72 |
| M29 | no agentId still offers equip | `screens/Adopt.jsx` | KILLED | 1 of 37 |
| R1 | a fact's day shown in Eastern time (one day early) — a1 | `sharedResearchView.js` | KILLED | 5 of 91 |
| R2 | a 404 disabled mid-flow reads as "did not complete" — a3/b4 | `useSharedResearch.js` | KILLED | 3 of 34 |
| R3 | preview_stale keeps the old record (no re-read) — a4/b2 | `useSharedResearch.js` | KILLED | 3 of 71 |
| R4 | a read forgets an unconfirmed save — b1 | `useSharedResearch.js` | KILLED | 1 of 36 |
| R5 | Next hidden behind any failure — b3 | `screens/Work.jsx` | KILLED | 2 of 34 |
| R6 | the earlier one is marked before its read answers — b6 | `SharedResearchSheetBody.jsx` | KILLED | 1 of 34 |
| R7 | StrictMode's effect replay leaves the hook deaf — b8 | `useSharedResearch.js` | KILLED | 1 of 34 |
| R8 | no render keeper: focus may fall to <body> when a control unmounts (jsdom, like Firefox, fires no focusout on removal) — c1 | `SharedResearchSheetBody.jsx` | KILLED | 1 of 34 |
| R10 | an idempotent answer shows this screen's words as the saved idea — a6 | `screens/Adopt.jsx` | KILLED | 1 of 34 |
| R11 | "published" for any same-day at/asOf (a cache, a count) — refuter on a2 | `sharedResearchView.js` | KILLED | 1 of 53 |
| R12 | a refused check hides the server's words — a10/b11 | `useSharedResearch.js` | KILLED | 1 of 34 |
| D3 | the comment strip back to the plain regex (a '/*' in a string swallows code) — d3 | `__fixtures__/sourceText.js` | KILLED | 2 of 57 |
| C10b | going over the limit is not announced (no live region) — c10, refuter | `screens/Adopt.jsx` | KILLED | 1 of 34 |

**44 of 44 killed.**
Run at `7ac8367be1a9adb73baf2ff970ccaf4e3f85e1ea`; the tree clean after the battery (0 changed files).

### jsdom, the review's rows (the second battery)

| Id | The defect planted | File | Result | Rows failed |
|---|---|---|---|---|
| V-a7 | the work view counts only current findings (two counts for one investigation) — a7 | `screens/Work.jsx` | KILLED | 1 of 34 |
| V-a9 | the unchecked "no finding here carries a price" claim is back on the preview — a9 | `screens/Adopt.jsx` | KILLED | 1 of 34 |
| V-a12 | a framing still running reads as failed — a12 | `useSharedResearch.js` | KILLED | 1 of 34 |
| V-a13 | a Continue row with no step yet says "last update " with nothing after — a13 | `sharedResearchCopy.js` | KILLED | 1 of 34 |
| V-b3b | a stored failed examine with no target hides Next behind a Try again it cannot offer — b3 | `screens/Work.jsx` | KILLED | 1 of 34 |
| V-b5 | a Continue read that fails shows nothing on Start — b5 | `screens/Start.jsx` | KILLED | 2 of 34 |
| V-b6b | "Back to your new investigation" unmarks the screen before its read answers — b6 | `SharedResearchSheetBody.jsx` | KILLED | 1 of 34 |
| V-b7a | a failed adoption read says "no supported company" — b7 | `screens/Adopt.jsx` | KILLED | 1 of 34 |
| V-b7b | an investigation closed elsewhere says "no supported company" — b7 | `screens/Adopt.jsx` | KILLED | 1 of 34 |
| V-b9 | the card's "Turn this into an idea" is held once the steps are spent — b9 | `screens/Work.jsx` | KILLED | 1 of 34 |
| V-b10 | a direction step that lands leaves its words in the box — b10 | `screens/Work.jsx` | KILLED | 1 of 34 |
| V-N1 | a story with no reporter reads "From FantasyTimes ·" without the server's word — refuter N1 | `sharedResearchCopy.js` | KILLED | 1 of 34 |
| V-c3 | the open-research list that did not load is not announced — c3 | `screens/Start.jsx` | KILLED | 1 of 34 |
| V-c5 | a condition input's name hides what the screen shows beside it (WCAG 2.5.3) — c5 | `sharedResearchCopy.js` | KILLED | 1 of 34 |
| V-c7 | the time frame is radios with no arrow keys again — c7 | `screens/Adopt.jsx` | KILLED | 1 of 34 |
| V-c9 | a story card's aria-label hides what the card shows — c9 | `screens/Start.jsx` | KILLED | 1 of 34 |
| V-c10a | the statement is not described by its count — c10 | `screens/Adopt.jsx` | KILLED | 1 of 34 |
| V-c10c | a field's help is not tied to its input — c10 | `parts.jsx` | KILLED | 1 of 34 |

**18 of 18 killed.**
Run at `15949d67d7188c3ef04ccf26b986717db97552a0`; the tree clean after the battery (0 changed files).

### Real browser

These ran on the local harness at the pushed head `15949d67`: vite dev on its LF archive, plus the smoke commit's two files, byte-checked against the smoke branch. Before them, all 11 rows ran clean on the same harness. Each mutant was applied to the harness tree, then `sheetLayer.browser.test.js` ran against it (`SR_LAYER_URL=http://127.0.0.1:5200`), and the file was restored from the worktree's bytes and SHA-256 checked. Vite serves the file fresh on each page load.

| Id | The defect planted | File | Result | Rows failed |
|---|---|---|---|---|
| L1 | `SR_DROP_LAYER` back at the modal's default 250 (P-1) | `sharedResearchStyle.js` | KILLED | 3: the three layer rows, `painted: false, tapped: true` |
| R9 | the at-once modal registers before the sheet's own effect (c2) | `SharedResearchSheetBody.jsx` | KILLED | 2: the c2 rows, focus on `<body>` after Escape |
| R8b | no `focusout` keeper (c1) | `SharedResearchSheetBody.jsx` | KILLED | 2: the Investigate rows, `<body>` while the open runs |
| R8 | no render-time keeper (c1) | `SharedResearchSheetBody.jsx` | KILLED | 2: the next-step rows, `<body>` once the button leaves (also R8 in jsdom) |
| Q1 | the question box does not grow (two fixed rows) | `parts.jsx` | KILLED | 2: the two 320 px question rows |

**5 of 5 killed.**

## 8. The review (K-11, BUILD_RULES §2)

**The threshold.** The cumulative diff against `main` is 30 files and 13,469 lines (13,466 added, 3 removed), measured on the cumulative branch diff with this report included, past BUILD_RULES §2's threshold (10 files or 1,500 lines).

**The four lenses.** Each lens ran on its own read-only `git archive` tree under the scratchpad (`node_modules` junctioned):
- (a) display honesty;
- (b) state and wiring;
- (c) accessibility and phone layout;
- (d) compatibility.

**The refuters.** Each lens's findings went to a refuter on a separate tree, told to refute each one with a concrete repro: one refuter for (a), one for (b), and one for (c) and (d) together. The refuter for (c) and (d) also drove the harness in headless Edge. One round (K-11): what a reviewer noted that is not a defect is in Watch (§9), not a founder question.

**The fixes.**
- Every fix that changes behaviour has a row in `SharedResearchSheetBody.review.jsdom.test.jsx` (or a browser row), and every such row has a mutant that fails it (§7).
- The six style-only fixes have no row; each was checked by measurement, render or inspection instead:
  - c6: every text link measured 44 px tall at 390 and at 1280, in headless Edge at the final code.
  - c4: the contrast ratios were computed by the refuter.
  - c8: the superseded finding was viewed in an element shot.
  - c11, c12 and c13: checked by inspection of the code and the renders.

### Lens (a): display honesty, and its refuter

| id | Finding (short) | Refuter | Severity | Fixed (where) |
|---|---|---|---|---|
| a1 | A fact's day (midnight UTC on the server) shown in Eastern time, one day early. This also turned a quoted date into an `unsupported_assertion`. | CONFIRMED | must-fix | `sharedResearchView.js` `formatFactDay` (UTC) in `dateLineOf`; clock times stay Eastern with "ET" |
| a2 | "published" hidden when the fact was dated by its publication | PARTLY (at = asOf is also normal for the estimates and the stored-claims facts) | nit | `dateLineOf`: "published {day}" for a **retrieved** source only; a cache's or a count's date stands alone |
| a3 | 404 disabled mid-flow read as "did not complete" | CONFIRMED | should-fix | `failureOf` → the gated line, code `disabled`, no Try again |
| a4 | `preview_stale`: the new carried ids resolved against the old record; a new finding silently dropped | CONFIRMED | must-fix | `adopt()` re-reads the record (`reread`); the body's preview is only the fallback |
| a5 | An identified lead wore "Source-backed" as its own label | PARTLY (§4.4 vs §6.7 in the spec; reachable through the server's own functions) | should-fix | `parts.jsx` `Lead`: no status of its own ("Lead"); its best finding keeps its label below |
| a6 | An idempotent answer showed this screen's words as the saved idea | CONFIRMED | nit | `SavedIdea`: "already saved" line, not the typed statement |
| a7 | Three findings counts for one investigation | CONFIRMED | nit | `Work.jsx`: the record's total, equal to the Continue row's `findingsCount`; Evidence splits it into current · Earlier |
| a8 | `REVIEW_HONEST_LINE` on the pre-save preview | **REFUTED** (R7: "on every idea surface") | — | kept; wording to Watch |
| a9 | "No finding here carries a price" was an unchecked claim, false when a carried fact names a price | CONFIRMED | should-fix | the line is removed |
| a10 | A refused check showed "Couldn't reach the record"; Check was live during a 429 | CONFIRMED | should-fix | the server's line is kept; Check is held while waiting |
| a11 | The literal-word guard was blind to `{'…'}`, templates, ternaries and `label=` props | CONFIRMED | nit | no live case; the guard is unchanged in this round (Watch) |
| a12 | A framing still running read as failed | CONFIRMED | nit | "Your question is still being framed. Try again in a moment." |
| a13 | "Open · last update  · 4 findings" | PARTLY (the Continue row holds; the Work part is dead) | should-fix | `continueRow` drops "last update" without a time |
| a14 | "Still open · " and "Doubt · " are client words | **REFUTED** (the design's own prefixes, not labels) | — | — |
| a15 | The drop's type before and after the open differed | PARTLY | nit | the preview names no type |
| a16 | The lead card's fact had no source and no date; times lacked "ET" | PARTLY | nit | the lead shows its best finding whole; `formatWhen` adds "ET" |
| N1 | (refuter) "From FantasyTimes · null · …" | NEW | nit | `fromFantasyTimes` falls back to "reporter", as the server does, and drops a missing time |

### Lens (b): state and wiring, and its refuter

| id | Finding (short) | Refuter | Severity | Fixed (where) |
|---|---|---|---|---|
| b1 | Leaving an uncertain save and coming back let a second adopt go out before the check (harmless to data: `savedAs` is idempotent; against K-8's letter) | CONFIRMED | should-fix | `useSharedResearch.js` `uncertainRef`: the save stays unconfirmed for that investigation through any read or navigation until `checkSave` answers; `adopt()` refuses meanwhile |
| b2 | = a4 | CONFIRMED | must-fix | as a4 |
| b3 | After a 429, Next never came back; a stored failed examine offered neither Try again nor Next | CONFIRMED | must-fix | `Work.jsx`: Next is hidden only while a Try again is offered (`retryOffered`) |
| b4 | = a3 | PARTLY (the Start view did gate) | should-fix | as a3, and Save is held while gated |
| b5 | A Continue read that failed showed nothing | CONFIRMED | should-fix | `Start.jsx`: the read's failure as an alert (the server's line, or "Couldn't load…"); "Opening…" while it runs; rows held |
| b6 | "Open the earlier one" relabelled the current investigation before its read answered | CONFIRMED | should-fix | `SharedResearchSheetBody.jsx`: `earlier` is set or cleared only after the read succeeds; the link is held while a request runs; `Work.jsx` shows a read failure |
| b7 | The adoption view said "no supported company" for a failed read, a close elsewhere and a save | CONFIRMED | should-fix | `Adopt.jsx` `!preview`: running, unconfirmed save (`SaveStates`), read failed (with Try again), closed or saved, else no supported company |
| b8 | Under the app's root `<StrictMode>`, the dev effect replay left the hook deaf: running with no request in flight (dev only) | CONFIRMED | should-fix | `live.current = true` in the effect body |
| b9 | The card's "Turn this into an idea" was held with the steps spent | CONFIRMED | nit | `CompanyCard` `adoptDisabled` (running or pending only) |
| b10 | A direction retried and landed left its words in the box | CONFIRMED | nit | `runStep` empties the box on any landed direction step |
| b11 | = a10 | CONFIRMED | nit | as a10 |
| fixture | Five opened-record fixtures had `question: null` | CONFIRMED | nit | `srAnswers.test.js`; a row pins every opened record's question |
| NEW-1…4 | (refuter) the Continue row's running cue; the earlier link during a step; a stored failed examine's "Try again" with no control; StrictMode running | joined b5, b6, b3 and b8 | — | fixed with them |

### Lens (c): accessibility and phone layout; lens (d): compatibility, and their refuter

The refuter worked from `84a12983` in headless Edge against the harness, and with targeted runs in its own read-only tree. Each fix below is at the final code. Rows marked † changed after the refuter's report.

| id | Finding (short) | Refuter | Severity | Fixed (where) |
|---|---|---|---|---|
| c1 | After an action in the sheet, focus fell to `<body>`, and Escape no longer closed the sheet. This held for Investigate, Next step, Send, Turn this into an idea, Discard, Save and a 429 retry. | CONFIRMED (repro on six actions; the hub's own HuddleSheet does the same) | should-fix | † `SharedResearchSheetBody.jsx` `keepFocus`: after any render that leaves focus on `<body>`, **and** on a `focusout` with no `relatedTarget` (a microtask later), the body's root takes focus. The refuter timed what the second keeper is for: Edge blurs a disabled control only at its next rendering update. Real-browser rows c1 (390, 1280); R8 and R8b (§ the layer and focus). |
| c2 | In mode `signaldrop`, the at-once modal registered before the sheet. Its close then sent focus to `<body>`. | CONFIRMED (latent: no V1 door passes the mode) | nit for V1 | The mount open waits a microtask, after HubSheet's own effect (HuddleSheetBody's pattern). Real-browser rows c2; R9. |
| c3 | "Couldn't load your open research." was not announced | CONFIRMED | should-fix (low impact) | `Start.jsx`: `role="alert"` (`data-sr-list-failed`) |
| c4 | Purple small text on its own purple wash measured 3.93–4.34:1 | CONFIRMED (composited pixels: 3.96–4.37) | should-fix | `parts.jsx` `textOn`: a purple eyebrow's words in ink-2 (6.2–6.9:1), a purple tag's in ink. The wash, the border and the dot stay purple. This departs from the design's purple words (Watch 10). |
| c5 | A condition input's `aria-label` replaced its visible label (WCAG 2.5.3) | CONFIRMED | should-fix | `SR_COPY.conditionLabel`: the name starts with the visible words ("SHOP · Live above $ — Shopify Inc., on a daily close") |
| c6 | Text links measured 33 px tall against a "44 px targets" claim | PARTLY (the hub's own desktop link is inline) | should-fix on the phone | `sharedResearchStyle.js` `linkStyle`: `minHeight: 44`, inline-flex, at every width (the claim is now true) |
| c7 | Time-frame radios with no arrow keys | CONFIRMED | nit | `Adopt.jsx`: `aria-pressed` buttons in a group, like Start's prompts |
| c8 | Superseded findings at opacity 0.8 put small text at 3.5:1 | CONFIRMED | nit | `parts.jsx` `Finding`: no opacity; a dashed border, the dim tag and ink-2 mark it |
| c9 | A story card's and a Continue row's `aria-label` hid what they show | CONFIRMED | nit | `Start.jsx`: no `aria-label`; the name is the visible content |
| c10 | Help and the count were not tied to their inputs; going over the limit was silent | CONFIRMED | nit | `parts.jsx` `Field` ties help (`aria-describedby`); the statement is described by its help and its count; † over the limit is announced in a polite live region that exists before it fills (`data-sr-over`; C10b) |
| c11 | An unbroken 60-character name scrolled the adoption sideways | PARTLY (a real case is unlikely) | nit | `Adopt.jsx`: `overflowWrap: 'anywhere'` on the three name spans |
| c12 | Two greens: the wash on emerald, the ✓ on `--ft-pos` | PARTLY (cosmetic at that alpha) | nit | `sharedResearchStyle.js`: `T.pos` is emerald, so the mark matches its wash |
| c13 | `S.meta` paragraphs kept the browser's 12.5 px margins | CONFIRMED | nit | `S.meta`: `margin: 0` |
| d1 | The pin hashed only the card's innerHTML at one width, so it missed 20 of 20 Discover-visible mutants | PARTLY (K-4's letter is met: the five hunks are inert, with defaults equal to the literals they replace; the defect is the header's claim) | nit | `SignalDropEntry.jsdom.test.jsx` block 3: the whole overlay's outerHTML (framer's animated opacity and transform masked) at desktop, at 390 px and while submitting; the phone back arrow; Escape, the overlay click and Close; the error copy. Hashed identically on `main`'s file and the branch's. The header now says what is pinned and what is not. |
| d2 | The boundary's specifier scan missed backtick, unspaced, root-absolute and glob forms, and the dark row was blind to three of them | CONFIRMED (planted in DiscoverPanel.jsx) | should-fix | `sharedResearch.boundary.test.js`: `specifiersOf` reads every form, and `namesInStrings` adds a literal scan (any string naming the directory). The planted rows cover every form. |
| d3 | The comment strip let a `/*` inside a string (or a line comment) delete code up to a later `*/`, which hid d2's glob form | CONFIRMED (four live src files lost import lines; none in a scan today) | nit | † `__fixtures__/sourceText.js` `stripComments`: comments out; strings, templates and regex literals kept whole. Shared by the boundary test and the copy guard. Over 3,479 src and api files it loses none of the old strip's specifiers and recovers 13 files' worth the old one deleted. Planted rows and a strip row; D3. |
| NEW-1 | (refuter) "…how directly?. Open the preview" | NEW | nit | gone with c9: the card has no composed label (`storyLabel` removed) |
| — | (refuter) HuddleSheet has c1's defect too | hub-side, not B2 | — | in the hub amendment's needs (a HubSheet-level focus rescue would cover both sheets) |
| — | (refuter) lens c's G5 timeout | not a defect: a fixture artifact (`getStory.previous` is null in the fixture; the real GET computes it) | — | — |

**The four lenses together: 43 distinct finding lines.**
- Counting: b2, b4 and b11 are a4, a3 and a10, counted once; the refuters' NEW lines that joined a finding are counted with it.
- Breakdown: a 17 (with N1), b 9, c 13, d 3, NEW-1.
- Verdicts: **30 CONFIRMED, 9 PARTLY, 2 REFUTED** (a8, a14), and 2 NEW (N1, NEW-1).
- By severity: **3 must-fix** (a1, a4, b3), **16 should-fix** (a3, a5, a9, a10, a13, b1, b5, b6, b7, b8, c1, c3, c4, c5, c6, d2), 22 nits.
- Every CONFIRMED, PARTLY and NEW in-scope line is fixed with a row, except a11 (no live case; Watch). The two hub-side notes go to the Command Center chat.

## 9. Watch on the allowlist

These are not founder questions (K-11: one review round). They are signals to read once real answers flow.

1. **The parse's model call is uncounted** (the founder's note). The SignalDrop parse (`/api/forge/parse-signal`, Haiku 4.5) does not touch `sharedResearchQuota`. Spec §4.1 says it counts against the framing ceiling, but nothing counts it. A player can parse drops without limit (cached 6 h by content hash) and spends a framing or an investigation only at Investigate. Watch parse volume from the sheet against framings.
2. **Starting the new investigation spends a daily one** (ruling P-2). "Open the earlier one" shows only after Investigate, so reading an earlier investigation of a story costs an investigation that day. A read before Investigate is a later server change.
3. **A lead's own label.** The server's lead `status` is its best finding's, which can be `verified`. The sheet shows a lead with a plain "Lead" tag and its best finding whole below, with that finding's label (routine choice 2), so no name ever wears Source-backed for itself. Watch whether players read a Source-backed finding under a lead as support for the lead; a lead-level label would be a server field.
4. **Role prefixes in the four lines and the evidence.** Relationship facts are stored "{Role} · {fact}", and the sheet shows them as stored there ("Supplier · Eaton sells…"). It strips the prefix only on the card's open question and the adoption's "Doubt" line, which sit beside the role tag.
5. **"Last update" needs `telemetry.lastTurnAt`.** The fixtures' records were built without turn telemetry, so the state line reads "Open · 11 findings". Real records carry it after the first step. An opened record before any step has none, and the line shows the count alone.
6. **An examine step after a reload cannot be retried by id.** Its target is not on `lastStep`, so Try again is hidden and the card's *Examine* starts a new step. Watch for `step_in_flight` answers from impatient retries in the first 35 s.
7. **The client's timeout (35 s) against the route's 30 s.** A save that times out on the client is uncertain and checked, never retried. Watch how often "Check the record" finds `saved_to_list`: that is a save that landed but whose answer was lost.
8. **No client number check on the statement.** Save is refused by the server (`unsupported_assertion`, its line shown). Watch how often that refusal fires; a client hint could come later.
9. **The smoke dates are fixture dates.** Every investigation on the smoke reads Nov 9–12; the stories are dated relative to now.
10. **The purple tone's words** (review c4). The design writes the eyebrow and the tag of the player's own words in purple, which measures 3.9–4.4:1 on its wash. The sheet keeps the purple wash, border and dot and writes the words in ink-2 (the eyebrow) and ink (the tag), at 6.2:1 and above. If the design wants purple words, it needs a lighter purple token; the token set has none.
11. **The literal-word guard's reach** (review a11). It reads JSX text and four name attributes written as plain strings. A `{'…'}` expression, a template, a ternary of literals or a `label=` prop passes it. There is no live case: every such string in the screens comes from `SR_COPY`.
12. **The honest line before the save** (review a8, refuted). `REVIEW_HONEST_LINE` shows on the pre-save preview as well as the saved view (ruling R7: "on every idea surface"). Its "Atlas doesn't act on your ideas yet" reads before an idea exists; watch whether players read it as a refusal.
13. **The focus keeper is measured in Edge only** (review c1). The rows that prove it run headless Edge (Chromium). The phone check is iPhone Safari, where a disabled control's blur and an unmount's focus may move differently. Escape is a keyboard key, but the same lost focus would send VoiceOver to the page's top. On the phone, after *Investigate this* and *Next step* with VoiceOver on, check that the cursor stays in the sheet.
14. **A lead's fact can read its name twice.** The server takes a lead's name from its fact's "{name}:" prefix (`companies.js`), and the sheet shows the fact as stored under the name, e.g. "Northfield Thermal / Northfield Thermal: Northfield Thermal, a coolant distribution unit maker…". Stripping the prefix would be the client rewriting the server's fact; a server-side `factWithoutName` would be cleaner.

## 10. The hub amendment's needs (for the Command Center chat)

The sheet's body is built; the door, the wrapper, `HUB_SHEETS.RESEARCH` and the mount guard's rows are the hub amendment's (R1, K-2). Everything here is paste-ready.

**The body.** `src/components/SharedResearch/SharedResearchSheetBody.jsx`, **default export**. It imports nothing from `src/components/CommandCenter/` (guarded by `sharedResearch.boundary.test.js`).

**Its props.**

| Prop | Type | What the hub passes |
|---|---|---|
| `open` | boolean (default `true`) | `false` renders nothing |
| `mode` | `'start'` \| `'item'` \| `'signaldrop'` \| `'session'` | the door: the Research panel's "Work an idea" → `'start'`; For-you's "Explore this" → `'item'`; a later "Drop a signal" shortcut → `'signaldrop'`; a Continue row or an activity row → `'session'` |
| `item` | story \| null | with `mode: 'item'`: `{ itemRef: { recordKind: 'fantasyTimesStories', recordId }, headline, reporterName, beat, publishedAt (ISO), context, question, reason \| null }` — `question` from `BEAT_QUESTIONS` (`src/constants/sharedResearch.js`) |
| `direction` | string \| null | onboarding's typed explore text, prefilled |
| `sessionId` | string \| null | with `mode: 'session'` |
| `stories` | story[] (≤ 5) | the selector's answer (onboarding H2), same shape as `item` |
| `agentName` | string \| null | the agent's given name; the body says "your agent" without it |
| `agentId` | string \| null | **ruling P-4:** the ranked agent the Loadout card reads (the one the server stamps). `null` → "Use it in my next game" is not offered |
| `equippedListLabel` | string \| null | the current BaggerBomb book's name, for "Replaces {list} as your equipped list." |
| `gated` | boolean | the hub's verdict: `SHARED_RESEARCH_MODE` through `hub/hubFlags.js`; at `'allowlist'`, the cached cockpit-status verdict. A server `404 disabled` gates the body too |
| `phone` | boolean | the phone composition (single column, full-width buttons) |
| `onClose` | `() => void` | "Continue later", "Return to Command Center" |
| `overlayStack` | the stack \| null | `useHubOverlays()` in the wrapper (below) |

**`overlayStack`'s use.** Only the SignalDrop modal. When the player opens it, the body calls `overlayStack.open(id, { opener, within: <the body's root element> })`; on close it calls `overlayStack.close(id, { fallback, focus: true })`; on unmount `close(id, { focus: false })`. So the sheet's own root goes inert while the modal is up, and focus returns to the "Use a SignalDrop" button. The modal portals into `<body>` at `SR_DROP_LAYER` 1001 (above `HUB_LAYERS.sheet`, below the ceremony's 1010; ruling P-1), proven in a real browser by `sheetLayer.browser.test.js`.

**The wrapper** (the Huddle precedent, `CommandCenter/HuddleSheet.jsx`), at `src/components/CommandCenter/SharedResearchSheet.jsx`:

```jsx
import React from 'react';
import HubSheet from './HubSheet';
import SharedResearchSheetBody from '../SharedResearch/SharedResearchSheetBody';
import { useHubOverlays } from './hub/HubOverlays';
import { HUB_COPY as COPY } from './hub/hubCopy';

export default function SharedResearchSheet({ phone, onClose, opener, fallbackFocus, reducedMotion, ...props }) {
  const stack = useHubOverlays();
  return (
    <HubSheet title={COPY.research.workTitle} eyebrow={COPY.research.workEyebrow} label={COPY.research.workLabel}
      phone={phone} width={720} onClose={onClose} opener={opener} fallbackFocus={fallbackFocus} reducedMotion={reducedMotion}>
      <SharedResearchSheetBody {...props} phone={phone} onClose={onClose} overlayStack={stack} />
    </HubSheet>
  );
}
```

The three strings are the hub's to add (the body's own are `SR_COPY.title` "Work an idea", `SR_COPY.eyebrow` "Shared Research", `SR_COPY.label` "Shared Research · work an idea"). A HubSheet registers itself, so `HUB_SHEETS.RESEARCH` is **not** in `useHubSheets.js`'s `LEGACY` set.

**The mount guard's rows** (`src/components/CommandCenter/commandCenterHub.mount.guard.test.js`), in the Huddle body's pattern:
- `PERMITTED_TERMINALS` (`:561`): `'src/components/SharedResearch/SharedResearchSheetBody.jsx': 'the Shared Research sheet body: the investigation screens, the SignalDrop modal (registered within), one service (spec V1.2 §7; B2)'`.
- The named-import pin (the block at `:1321`): `'/SharedResearch/SharedResearchSheetBody': ['default']`.
- A row like `:958`'s: the body's directory makes ONE import of `src/services/sharedResearchService.js` (in `useSharedResearch.js`), and no hub file imports that service.
- The activity guard (`commandCenterHub.activity.guard.test.js`): the walk stops at the terminal, so the body's effects stay its own. For the record, they are:
  - the hook: one read on mount (`GET ?list=open`, or `?sessionId=` in mode `session`); a `setTimeout` for a 429's wait; the service's 35 s abort timer per request;
  - the body: a focus keeper (after a render that leaves focus on `<body>`, and on a `focusout` that goes nowhere — a React `onBlur` on its root, checked after a microtask — the body's root takes it); the drop preview's focus; each question box's layout effect (it sizes its own textarea); a microtask that opens the modal in mode `signaldrop`; the modal's registration and release on the stack;
  - `SignalDropEntry` (mounted closed whenever the sheet is not gated): `useIsMobile`'s resize listener, its 250 ms reset `setTimeout` (on mount too), and, while open, a document `keydown` listener, the body scroll lock and `useModalFocus`'s frame.
- **The boundary test's dark rows will red by design** when the wrapper imports the body (`sharedResearch.boundary.test.js`, "no src/ file outside this directory imports it" and its literal scan). The amendment updates them in the same commit, with the wrapper as the one expected importer.
- The service imports a writer (`transitionHypothesis`, for equip, K-9). The hub's terminal note for `hypothesisVersionService` (ruling R-S6-2, "no writer is imported") covers the hub's own imports; it is worth one line in the amendment that the sheet's service imports the writer outside the hub directory.

**One observation for the hub (review c1's refuter; not B2's code).** `HuddleSheet` has c1's defect. Its Confirm disables while it runs, and Edge then moves focus to `<body>`, so Escape no longer closes the sheet. After a successful confirm the buttons unmount and even Tab cannot bring focus back. The Shared Research body keeps focus itself: its root takes focus after a render that leaves it on `<body>`, and on a `focusout` that goes nowhere. A HubSheet-level rescue of the same kind would cover every sheet.

## 11. The renders

**How they were made.** Headless Edge (`playwright-core`, channel `msedge`) at device scale 2 with reduced motion, against the smoke page on the local harness (vite dev on an LF archive of the code head `7ac8367b`, placeholder Firebase values, every answer from fixtures). That is the same client code as the final tree.

**Coverage.** 19 states × 3 viewports = **57 renders**, each with a viewport shot and, except the modal, a full-height shot. Two element shots cover what a state render does not open: the lead card (`20-lead-card-390.png`) and a superseded finding under Evidence → Earlier (`21-superseded-finding-390.png`).

**Copies.** All are in `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B2/renders/`, with `measures.json`.

| # | State | # | State |
|---|---|---|---|
| 01 | Start: stories, open work | 11 | Work: answer out of date |
| 02 | Start: gated | 12 | Work: answer withheld |
| 03 | Start: no stories, no open work | 13 | Companies: supported (the Shopify chain) |
| 04 | The drop modal over the sheet (P-1's viewed render) | 14 | The earlier investigation's line (P-2) |
| 05 | Drop preview | 15 | Adopt: preview |
| 06 | Framing | 16 | Adopt: stray name blocks Save |
| 07 | Story preview | 17 | Adopt: uncertain (only "Check the record") |
| 08 | Work: the opening | 18 | Adopt: recovered |
| 09 | Work: an answer, with the lead | 19 | Saved and equipped |
| 10 | Work: running step | | |

**Measured on every render.** The page never scrolls sideways (`scrollWidth` equals the viewport), no element of the body passes the dialog's right edge, and no button is under 32 px tall. **57 of 57 clean.**

**Looked at, at the final code** (these renders):
- the story preview and the framing at 320, each now showing its whole question;
- the uncertain save's foot ("Check the record" and Cancel only);
- the companies view's foot (390) and the stray name (390);
- the lead card and a superseded finding.

**Looked at before the question-box fix**, on states the fix does not change:
- the drop modal (390), Start (320) and companies (320);
- the drop preview (390), whose question already fit its box;
- the adoption preview (390, full), and saved and equipped (1280).

**What the looking found.** At 320 px the proposed question was cut off mid-line by its two fixed rows. Fixed with `QuestionBox`, proven by two real-browser rows and mutant Q1 (routine choice 18). The yellow SMOKE ONLY mark sits over the bottom-left of the page; it is smoke-only.

## 12. The founder's phone checklist (on the smoke preview, iPhone)

Open `<smoke URL>/?srFixture=index` for the list; each item names its scenario. Every answer comes from the committed fixtures, so the dates are fixture dates (Nov 9–12). The yellow "SMOKE ONLY" mark sits bottom-left. Small section headings ("Your drop", "Names it mentions", "Continue your research") show in capitals on screen. Every quoted string below was checked on the page by script at 390×844 (14 of 14, on the harness and on this preview). Item 7 was also done exactly as written, Apple left unticked: the saved view names Shopify Inc. alone.

1. **Start** (`?srFixture=start`). Three stories with "Show more stories · 2", "Bring your own starting point" with its three prompts, and "Use a SignalDrop" at the bottom. At the top, "Continue your research" with one row: "Faster checkout is spreading…".
2. **A story** (`?srFixture=story`). The preview shows the headline and "From FantasyTimes · Doug · {time}", the beat's question (editable) and a direction box. **Reworded by ruling P-2:** on `?srFixture=story-previous`, tap *Investigate this*. The new investigation shows "You investigated this on Nov 9, 2026 · Open the earlier one". *Open the earlier one* shows the earlier, concluded investigation, with "← Back to your new investigation".
3. **A drop** (`?srFixture=drop`). Tap *Use a SignalDrop* and the modal covers the sheet. Paste any text and tap *Read this signal*. The modal's button reads **"Investigate this"**. Tap it. The drop preview shows "Your drop · {time}", then "What your drop is about" with "Gas turbines for data centers", then "Names it mentions" with ETN, and the question "What is behind Gas turbines for data centers, and which company earns from it?". The parse is canned (SMOKE ONLY).
4. **Work** (`?srFixture=story`, then *Investigate this*). The opening says "No answer yet…" and "What the records already hold". The story is tagged **From FantasyTimes**, never Source-backed.
   - On `?srFixture=work-running`, tap the green next-step button. The line "Taking the next step…" shows for the 20 s the answer takes, and only then.
   - On `?srFixture=work`, open *Evidence*. You see **Source-backed**, **Inferred** and **Unresolved · …** tags; the coolant-units source reads **"Undated · read Nov 12, 2026"**.
   - On `?srFixture=drop`, after *Investigate this*: **Your drop** and **From your drop**.
5. **Companies** (`?srFixture=work`). One supported card, **Eaton Corporation plc · Supplier · ETN**, with *Examine this connection* and *Turn this into an idea*. Below it is the lead **Northfield Thermal**, tagged "Lead" and "Symbol · not in the app's records", with its sourced fact below it under that fact's own label. It has no buttons, and it is not pickable when you save.
6. **Out-of-date and withheld.**
   - `?srFixture=stale`: "This answer relies on a fact that was corrected. The next step revises it." under the answer.
   - `?srFixture=withheld`: tap the next step; the reply ends with "The answer was not updated this step: a figure in it had no source."
7. **Save** (`?srFixture=adopt`). Tap *Turn this into an idea*. The preview names Shopify Inc. and Apple Inc. Untick Apple and the claim redraws to Shopify's alone. Pick a time frame and tap *Save idea*. The saved view shows "Idea saved", the honest line "Atlas doesn't act on your ideas yet…" and *Use it in my next game*. Tap that: "Equipped for your next game".
8. **Interrupted save** (`?srFixture=adopt-uncertain`). Save, and the connection drops on purpose. "I couldn't confirm whether your idea was saved…" appears with only **Check the record**; there is no Save button. Tap it: "Found it: your idea was saved on the first attempt." Nothing is saved twice. (`?srFixture=adopt-notsaved` shows "Checked: nothing was created. You can try again.")
9. **Live app, flag off** (the production app, not the smoke). Nothing has changed anywhere. Discover → Drop a Signal → paste → the button still says **"Start dialogue"**.

## 13. Cleanup

- **WSL.** This session's trees and runs were removed under `flock /tmp/pd-suite.lock`, `node_modules` unlinked first. The removal ran twice, because `main` moved after the first round of final checks (§5):
  - First: `~/pd-ci-srb2` (184 MiB), `~/pd-ci-srb2m` (180 MiB) and `~/pd-srb2-runs` (232 MiB), **595 MiB** freed.
  - Second, after re-checking on `b0a20018`: 185, 180 and 114 MiB, **479 MiB** freed.
  - **1,074 MiB freed by those two removals.** Both trees were recreated afterwards, for the review's second mutant battery, the third merge's checks and the pushed heads' builds, and were removed the same way. None of the three remains, and `~/pd-ci`'s worktree list holds no `srb2` entry. The shared install the trees linked to (`~/pd-af0/node_modules`) is untouched. No other session's tree was touched.
- **Windows scratch.** Both vite harnesses (ports 5199 and 5200) are stopped. Nine `node_modules` junctions were removed as junctions before their trees were deleted: the two harness trees, the four lens trees and the three refuter trees. The trees held no other link, and 1,234 MiB of scratch went with them.
- **Kept.** The smoke branch `claude/shared-research-b2-smoke` stays on the remote for the phone check; delete it after the merge. The renders and this report are in `C:/Users/fashr/Documents/FantasyTrades/SharedResearch/B2/`.

## 14. The PR description

This is the sheet the player will see. You start from a FantasyTimes story, a SignalDrop or your own words, then watch the evidence come in with honest labels. You see which companies are connected and how well. You can stop, leave, discard or save the idea, and optionally *Use it in my next game*.

**Nothing in the app opens it yet.** The door and the wrapper are the Command Center chat's hub amendment. With this merged, players see nothing new.

**Smoke preview:** https://trade-seven-hobprw3dz-fais-projects-bc179554.vercel.app
- `?srFixture=index` lists the scenarios.
- It runs on the branch `claude/shared-research-b2-smoke`, which is cut from the final tree `7c80e99f` (this PR's head minus the docs-only follow-up commit) and never merged.

**Report:** `docs/audits/20261113_BUILD_SHARED_RESEARCH_B2.md`. It holds every state, the review, the mutation tables, the hub's needs and the founder's phone checklist.

### Changes (`file:line`, at the code head `7ac8367b`)

**The design of record**
- `docs/design/shared-research/SHARED_RESEARCH_WORK_AN_IDEA_V2.html` is byte-identical to the attachment (SHA-256 `bdb72025…6e3`). Its `docs/README.md` row comes with it.

**`SignalDropEntry` gets two additive props**
- `src/components/SignalDrop/SignalDropEntry.jsx:148`:
  - `ctaLabel`, default `'Start dialogue'` (K-4), rendered at `:496`.
  - `zIndex`, default 250 (founder ruling P-1), used at `:402`.
- With both props absent the modal is today's.
- The pin, `SignalDropEntry.jsdom.test.jsx`, was committed before the edit and passes unchanged. Block 3 (review d1) also pins the whole overlay: at desktop, at 390 px, while submitting, and through the dismiss paths. Its hashes are identical on `main`'s file and this branch's.
- `DiscoverPanel.jsx` is not touched.

**The body: `src/components/SharedResearch/SharedResearchSheetBody.jsx:54`** (default export)
- It imports nothing from `src/components/CommandCenter/`.
- The SignalDrop modal renders with "Investigate this" at `SR_DROP_LAYER` 1001 (`:211`), registered `within` the hub's stack while open (`:78`).
- In mode `signaldrop` the modal opens a microtask after mount (`:105`, review c2).
- The focus keeper is at `:122` and `:127` (review c1).

**The hook: `src/components/SharedResearch/useSharedResearch.js`**
- The server's words for refusals: `failureOf`, `:32`.
- One request in flight at a time: `run`, `:107`.
- The uncertain save: `uncertainRef`, `:81`; `adopt`, `:289`; `checkSave`, `:326`.
- `preview_stale` re-reads the record: `reread`, `:282`.
- "Running" only while a step is pending.

**The screens: `src/components/SharedResearch/screens/`**
- `Start.jsx:33`
- `Previews.jsx:60`, `:81` and `:105`
- `Framing.jsx:15`
- `Work.jsx:102` (the running line `:222`, Try again or Next `:145`)
- `Adopt.jsx:79` (`SavedIdea` `:29`, `SaveStates` `:271`)
- `Discard.jsx:12`

Together they cover every state of spec §7.2 and K-6.

**The parts: `src/components/SharedResearch/parts.jsx`**
- `Finding`, `:126`.
- `CompanyCard`, `:148`.
- `Lead`, `:182`.
- `QuestionBox`, `:105`, grows to its question.

**The view, the copy and the style**
- `src/components/SharedResearch/sharedResearchView.js` formats the server's answer:
  - `dateLineOf`, `:83`.
  - `STATEMENT_MAX`, `:208`.
  - `namesCompanyView`, `:242`, mirrors the server's `namesCompany` and is parity-pinned.
- `src/components/SharedResearch/sharedResearchCopy.js:31` holds every client string (`SR_COPY`). The lines for answers that carry no `message` are pinned equal to `copy.js` (`:41`).
- `src/components/SharedResearch/sharedResearchStyle.js:17` holds `SR_DROP_LAYER`, pinned against `HUB_LAYERS.sheet` and the ceremony's `Z_INDEX`; colours are `--ft-*` tokens only.

**The service: `src/services/sharedResearchService.js`**
- `call`, `:38`, uses `fetchWithAuth` to `/api/forge/shared-research`, with a 35 s client timeout.
- `equipIdea`, `:86`, uses the existing `transitionHypothesis` and `equipLoadoutBook`.

**Tests**
- Every state, from fixtures composed by the server's own functions.
- The flows inside a real `HubSheet` under `HubOverlayProvider`.
- The copy guard.
- The boundary and dark rows, with a string-aware comment strip.
- The layer pin and the hook's guards.
- One row per review finding.
- Real-browser rows (env-gated, skipped in CI): the modal over the sheet at 320, 390 and 1280; focus at 390 and 1280; the question box at 320.

### Fenced functions
None called, none edited. No `api/` file, Firestore rule, index or flag value changed.

### Bundle (K-3)
The minified build of the final tree `7c80e99f` was compared with `main` `979b030c`, every hashed name masked, 111 files each side. **2 files differ: the entry chunk `assets/index-*.js` (5,010,440 → 5,010,490 bytes, +50) and its source map.** That is the chunk holding `SignalDropEntry`. An unminified build shows its five additive hunks and nothing else (57 files, 1 differs). The CSS (`index-Bt3Ms9P_.css`, 36,828 bytes) is byte-identical. "Investigate this" is not in the bundle, because nothing imports the body.

### Checks (on the tree merged with `origin/main`)
- Full Linux suite (WSL, `flock /tmp/pd-suite.lock`, `TZ=UTC`, 8 workers): **exit 0**. Test Files 1,455 passed, 11 skipped (1,466); Tests 32,464 passed, 131 skipped (32,595). This branch's 10 files: 203 rows passed; the 11 browser rows skipped by design.
- `npm run test:rules`: **exit 0**, 42 files, 784 tests.
- `npm run lint:gate`: **exit 0**.
- `vite build`: **exit 0**; the pushed head is built too (docs-only on top of `7c80e99f`).
- Real browser (headless Edge): 11 of 11 on the local harness and 11 of 11 on the smoke preview. The founder's checklist strings, by script: 14 of 14 on both.

### Review (BUILD_RULES §2)
- The cumulative diff is 30 files and 13,469 lines (13,466 added, 3 removed), measured on the cumulative branch diff with this report included, above the threshold.
- Four lenses (display honesty, state and wiring, accessibility and phone layout, compatibility), each with a refuter, one round.
- 43 distinct finding lines: **30 CONFIRMED, 9 PARTLY, 2 REFUTED**, 2 new.
- 3 must-fix and 16 should-fix, all fixed. Every behavioural fix has a row and a mutant; the six style-only fixes were checked by measurement, render or inspection.
- Mutations: 62 of 62 killed in jsdom (the brief's 1–10, plus one for every review row) and 5 of 5 in a real browser, with every file restored byte for byte.

### The founder's phone checklist
It is in the report, under "The founder's phone checklist". Every quoted string was checked on the page by script.

Ready for the founder's merge · dark · the hub amendment (door and wrapper) is the Command Center chat's · the allowlist flip is a separate founder PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
