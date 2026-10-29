# Build report — Film Room B2.1: the screen pass

**Date:** 22–28 Oct 2026 · **Executor:** Claude Code (desktop, local Windows + WSL Ubuntu; Opus 5.5) · **Prompt:** the Film Room chat, "Build prompt — Film Room B2.1: the screen pass" · **Governing:** Build B spec V1.0 with Amendments A–J (J = RJ-1 … RJ-10, committed verbatim by this build), spec V1.2 with Amendments A–E (R1–R15), BUILD_RULES

## Verdict

| Question | Answer |
|---|---|
| Built | B0; Part C (C1, C2; C3 discovered and STOPPED); Part A (A1–A7, A8's five leftovers); Part B (B3, B1, B2), one commit per item with its tests; one B1 fix commit; the §2 review-round commit and the mutating lens's rows; the B1 area fix the final suite called for; the golden-label commits. Draft PR, no merge, no production write, no backfill, no refresh, no deploy, no flip. |
| `FILM_ROOM_CARDS_MODE` | `'off'`, untouched (`src/config/featureFlags.js:3490`). |
| Exit criterion (only these block) | **All ten hold** (§4). Criterion 9's movements are the declared ones (§5). |
| Acceptance | H passes (A1); FR-02 … FR-05 each a test row (A2, A3, A4, A5); Astra's B3 race refused (B3). |
| The prompt's ten named mutants | **All killed** (§2, the Mutants column; the mutating lens re-planted every one on the reviewed head, §9). |
| Goldens (RJ-9) | Re-captured at the code head (twice, identical); every byte difference from B2's goldens maps to A1, A2, A3, A6 or A7 — none unmapped (§3). |
| C3 (X3-5) | STOPPED, not fixed: the cause found with `file:line`; a complete fix drops a caveat the merge keeps by design, so it needs a ruling (§6). |
| The map | Committed: `docs/design/20261023_GROWTH_LOOP_MAP_V1_1.md`, SHA-256 `578ee7ad005f373700c7297e472362e276ab617ae44375a0482ab6286d0dfcb3` on the committed blob; the path was absent on `main`. |
| `refresh=1` after merge | Needed for A3 and C1 to reach past days — named, not run (§5). C2's field reaches past days only through a candle re-run. |
| The §2 review | §9 — five lenses, a refuter each, then the mutating lens last on its own tree. One BLOCKER (SPR-S-1), fixed; three MAJORs: SPR-S-2 (refuted to MINOR, fixed), SPR-C-1 (a test gap, rowed), SPR-L-1 (a ruling, before any flip); the rest MINOR, NIT or a question. Lens T: 164 mutants, 139 killed, 2 equivalent, 23 survived; every MINOR survivor and six NITs now killed by a row. |
| Final checks | §10 — on the branch merged with `origin/main` `62380f14`: the Linux suite's first run found one red row (the hub's mount guard, B1's import), fixed in `07dc3d58`; the second run **0 failing files** (1,206 passed, 8 skipped; 26,229 rows passed, 89 skipped); rules suite 27 files / 440 rows; `lint:gate` exit 0; `vite build` built. |
| Rulings asked | §8 — eleven questions, item 12 declared only; one (SPR-L-1, Set's link and the casual clone) must be ruled before any cards flip. |
| The founder's rulings (28 Oct) | §13 — Amendment K (RK-1 … RK-13) built: seven fixes, the goldens re-captured (two moved, both RK-11), the §2 review (one MAJOR, fixed), the final checks on `main` `9bbe2b1b`, four new questions. |

## 1. Preamble

- `git fetch origin` ran first. Base: `origin/main` at `24495eba` (the #998 merge); `main` holds #988 (`ff6248d1`) — checked before anything was written. `main` moved once during the build: #999 (the BaggerBomb cleanup) merged as `62380f14`. It merges clean with the branch: one shared file, `api/_utils/filmTape/tapeAssemble.js`, in disjoint hunks (#999's tiered-battle ghost baseline beside C1's and A3's lines). The branch carries no merge commit; the final checks ran on the branch merged with `62380f14` in a git clone (§10).
- Branch: the session's worktree branch `claude/film-room-screen-pass-99969e`, pushed by refspec to `claude/film-room-screen-pass` (the prompt's name). Code head `07dc3d58`; the goldens' label `7d7d5452` after it; this report and its README row are the commit after that (the PR's head).
- Every prompt anchor was re-verified before use. Drifted: `tapeMerge.js:523–535` (the gaps/unattributed block sat at 531–535 at the base; at the code head it is 533–538); `App.jsx:2565–2592` (P1c's listener; unchanged at the base); the rest as the prompt names them.

## 2. One row per item

| # | Item | Commit | Tests (rows) | Mutants (rows red / rows run) |
|---|---|---|---|---|
| B0 | Amendment J verbatim (`docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_AMENDMENT_J_20261022.md`); the Growth Loop Map V1.1 byte-identical (`docs/design/20261023_GROWTH_LOOP_MAP_V1_1.md`, SHA-256 `578ee7ad…dfcb3` verified on the committed blob; the path was absent on `main`, so it is committed); one README row each | `41942e52` | — | — |
| C1 | RE-3: `coverage.meetings` describes the rows the tape STORES. `buildMeetings` returns the read beside its rows; `meetingsCoverageOf` (one function, used by the first write and by the merge) counts what the stored section holds and what it left out, spans the stored rows, and calls a failed read beside stored rows partial; a refused rewrite (RD-6) leaves the note where it was; `meetingsRead` never reaches the document | `250b29d1` | `tapeMeetings.test.js` +8 (every row part round-trips; a refused rewrite adding omissions; a shortened diagnosis keeps its note; an appended meeting adds count and span; an emptied history keeps the span; the cap, 2 past 26; a failed read beside rows → partial; `meetingsRead` stripped) | the merge describing the read → 5 / 44; the stored rows' counts ignored → 2 / 44 |
| C2 | W5 (RB-4): the candle pass writes `coverage.series.notCharted` — each held, traded or planned symbol it did not chart, `{ symbol, reason }`, reasons `crypto_not_supported` / `no_bars` (`SERIES_NOT_CHARTED_REASONS`), sorted. No bar or price moves; no new provider request | `5c46b648` | `candlePassNotCharted.test.js` 11 (new); the screen fixtures regenerated by their own writer (`sep23`: `[BTC crypto_not_supported]`; `empty`: `[]`; the series JSON unchanged) | crypto not listed → 4 / 20 |
| C3 | X3-5: discovery first — **STOP**, not fixed (§6) | — | the repro, in the report | — |
| A1 | Study's **Meetings** (spec §3, acceptance H, RJ-1): one card per stored meeting — created, deadline (`expiresAt`, as recorded) and resolved instants, outcome (approved / rejected / expired), `resolvedBy` as stored, its legs; the diagnosis an R7 quotation credited "— the platform" at its `createdAt`; one line when none (the review made it "No gameplan meeting was recorded this day.", and only under a complete section — SPR-S-1, SPR-RS-3); the coverage line by R1; the strip's "awaiting approval" run links to its meeting when the instants match (the run's first check inside the meeting's created–resolved window) | `d32c9058` | `FilmRoomMeetings.writer.jsdom.test.jsx` 10 (new) over days the real close pass wrote; the B1 writer and R15 replay suites updated; inventory | the link by date alone → 3 / 48; the diagnosis outside a quotation → 5 / 48 |
| A2 | FR-02 / RJ-2: Deep dive for a symbol with no series shows that symbol's own state — "No chart for BTC: crypto is not charted." from `coverage.series.notCharted`, else "No chart was recorded for this symbol." — never the section's "complete" beside it; the recorded prices at each check still show; the marker instructions only where markers can be drawn | `ab45b656` | `FilmRoomDeepDive.noChart.writer.jsdom.test.jsx` 8 (new; one a real-pass day with DE's bars withheld → `no_bars`); `FilmRoomDeepDive.jsdom`, `FilmRoomScreenV2.review.jsdom` updated | "complete" beside a no-series symbol → 4 / 37; marker instructions with no chart → 1 / 37 |
| A3 | FR-03 / RJ-3: the writer's result note names exactly the missing scores, and reads "no check ran this day, so no score was recorded" when no check ran (`NO_CHECK_RAN_NOTE`, `noCheckRan`); the close pass's completion test uses the same rule; the platform's completion message stays quoted. Declared wording change | `ca49e770` | `tapeResultNote.test.js` 10 (new); `tapeAmendmentD.test.js` (4 Q2 rows), `screenFixtures.test.js`, `FilmRoomGlance.jsdom` updated; the `empty` fixture's note | `noCheck` ignored → 6 / 19; the completion test blind to the checks → 1 / 19 |
| A4 | FR-04 / RJ-4: on the bought symbol a swap reads "Entry · {time} · in for {sold} · {maker}" (`entryMakerOf`; "by the agent" / "by platform rule · {reason}"); the sold symbol keeps "Exit · {time} · {maker}" | `f0c2dd3f` | `FilmRoomDeepDive.jsdom` +1 over every swap, the swap-label row rewritten (PLTR in, CRWD out) | "Exit by" on the bought name → 2 / 30 |
| A5 | FR-05 / RJ-5: a symbol the directory lacks reads "Company name not on file"; no name guessed (`companyNameOnFile`: any non-empty directory name counts, so AMD, whose directory name is "AMD", is on file) | `f0d5c1c4` | `FilmRoomDeepDive.jsdom` +2 | the sentence never shown → 1 / 37; "on file" read as a name differing from the symbol → 4 / 37 |
| A6 | RJ-6: `evidenceOverlayNote` is RJ-6's sentence word for word | `65375aab` | `FilmRoomDeepDive.jsdom` (the sentence pinned) | the old sentence → 3 / 37 |
| A7 | RJ-7: one Glance line — "Coverage · complete for every section", or "Coverage · complete except: {section} ({status} — {reason})", each count derived (D), the stored reasons named; the repeated per-section "complete" lines folded into it | `2cb3ee94` | `FilmRoomGlance.jsdom` (the A2L4-10 block rewritten, RJ-7 rows added); the harness's aggregate pin for `count(coverage.series.notCharted[])` | a count without its class → 6 / 34; W5 ignored (series "complete") → 1 / 34 |
| A8 | A2F3-7: `ROLE_WORDS`, `HOLDINGS_NOTES`, `RISK_WORDS` (+ `riskText`), `DIRECTIVE_CARD_WORDS` exported and pinned by the inventory | `15fa0d13` | inventory +key pins | a number word in `ROLE_WORDS.series` → 1 / 6; an added `RISK_WORDS` key → 1 / 6 |
| A8 | A2F1-7: the fixed-digit exemption bound by copy key (`SPEC_FIXED_DIGIT_COPY`, 11 entries incl. RJ-6's sentence): a text node or attribute is exempt only when its WHOLE text is the copy at that key; the inventory proves text-at-key and closure | `4b6db095` | `FilmRoomSweeps.guards` +rows (the phrase inside other text fails), inventory | a substring match → 1 / 45 |
| A8 | A2F2-5: a door that changes the day or the depth focuses the new panel (or the place it opens) once rendered | `f09db6c3` | `FilmRoomScreenV2.focus.jsdom.test.jsx` 4 (new), the meetings row | no focus → 4 / 14 |
| A8 | A2F2-4 + B6: swap labels (lane / inline by measured width) and the wide last-close label clamped inside the chart | `92124aef` | `FilmRoomDeepDive.clamp.jsdom.test.jsx` 11 (new); headless Edge before / after (§7) | no swap clamp → 4 / 11; no last-close clamp → 3 / 11 |
| B3 | RH-6 + RI-3: the counter's mask adds `coverage.tags.status`; an unavailable day is neither counted nor listed; `unavailableDays[agentId]`; the screen line in RJ-7's style; the endpoint refuses 409 `tags_unavailable`; `createCard` re-reads the tape day inside its transaction and checks its coverage and the exact moment again (`verifySource`) | `3d86a667` | `cardCounter.test.js` +3, `card.test.js` +6 (Astra's race on an unavailable day and on a moved moment, both refused; an unchanged day files), `FilmRoomCards.jsdom` +2; aggregate `count(tape days with situations unavailable)` pinned | the counter counting an unavailable day → 3 / 104; the create transaction trusting the endpoint's read → 2 / 104; the endpoint accepting an unavailable day → 3 / 104 |
| B1 | RH-1 / RJ-8: Set links "Tempo dial · Forge workshop" through App's `onOpenForge({ area })`, the area hub S5's `FORGE_AREAS.CHARACTER` (since the B1 area fix, held as its value, `'traits'`), when the day's `tags.inputs.forcedRotation.enabled` is true; RJ-8's no-link sentence when false; RG-5's sentence alone when the tape stores no such input | `a6846a73` | `FilmRoomCards.jsdom` +4, `App.filmRoomForge.source.test.js` 5 (new), the route's props pin | Set linking with the rule off → 1 / 44; the wrong area → 1 / 44 |
| B1 fix | B1's source row read `RELEASE3_CHARACTER_TAB_ENABLED` by a pin, which `flagPinGuard` would have required a docstring pointer for in `featureFlags.js` (a file this build does not touch): it now reads the flag through the workshop's own `characterOn` gate | `20f7f457` | `App.filmRoomForge.source.test.js` (the row rewritten); `flagPinGuard.test.js` green | — |
| B2 | RH-2 / RJ-10: a recurrence in another battle is a button: one read of that battle's document (`firestoreReaders.readBattle`), then P1c's `requestOpenBattleReview(battle, { etDate, moment })` — the event's new optional `detail.at`, checked by `battleReviewAtOf`; P1c's own call sends exactly what it did. App's listener keeps P1c's statements and adds one (`filmRoomOpenAt`, for the battle it opens; cleared when the Film Room is left); the route keys v2 by battle; v2 opens on that day and marks and focuses the moment once the prepared case lists it. A battle that cannot be read is said beside the row; nothing opens. Back keeps its destination (the listener never records `filmRoomFromRef`) | `d22f8029` | `ideaNavigation.at.jsdom.test.js` 5 (new); `FilmRoomCards.jsdom` +6 (the open; the opened screen: day, moment marked, focused, scrolled to; P1c's event without the field; unreadable ×5; a late cards gate; one tap at a time); `App.filmRoomForge.source` +5 (the listener, the route prop, the clear, back's destination); `FilmRoomRoute.untaped` +1 (keyed remount) and the props pin; `filmRoomData.jsdom` +1 | **the prompt's "a recurrence in another battle with no open"** (the row opens nothing) → 4 / 86; `openAt` ignored → 1 / 86; the jump not waiting for the moment's row → survived, then 1 / 49 after the late-gate row; the listener dropping `at` → 1 / 86; the route not keyed → 1 / 86; a malformed `at` sent raw → 3 / 86; another battle's id accepted → 1 / 86; the listener recording the back destination → 2 / 86. App.jsx is pinned by its source (one suite renders App, desktop only) |
| §2 review | The fixes the refuters confirmed (§9): SPR-S-1, RS-3, S-2, S-4, S-5, C-2, C-3, RC-1, L-2, L-3, L-6, W-2, W-3, G-1 (prose), and the rows for C-1, C-4, W-4 | `a6888e05` | the rows named in §9, one or more per finding | 17 planted, 17 killed |
| §2 lens T | A killing row for each MINOR survivor of the mutating lens (SPR-T-1 … T-8) and six NITs (T-9); tests only | `46a29b51` | ten suites (§9) | 18 re-planted, 18 killed — each by its new row alone |
| B1 area fix | The final Linux suite's first run (§10) found the hub's mount guard red: B1's `import { FORGE_AREAS } from '…/CommandCenter/hubChrome'` was a tenth edge from `src/` into the hub's directory, which the guard forbids (S1 review L2-1). The guard, and App's pinned `hubChrome` import, are hub code (fenced), so the Film Room holds the area's id as a value; the B1 card row pins it to the hub's own constant through `forgeAreaOf`. Nothing on screen moves | `07dc3d58` | `commandCenterHub.mount.guard.test.js` 61 / 61, `FilmRoomCards.jsdom` 54 / 54 | the wrong area → 1 / 54; the hub import put back → 1 / 61 |
| Goldens' label | `GOLDEN_SOURCE_COMMIT` names the code head the goldens were captured from: `46a29b51` (`c264b102`), then, after the B1 area fix, `07dc3d58` (`7d7d5452`) — each capture run twice from a git archive, byte-identical to each other and to the committed goldens | `c264b102`, `7d7d5452` | the golden suite 6 / 6 | — |

Reading the Mutants column: "3 / 48" = three rows red of forty-eight in the suites run against that mutant; the file was restored from a byte copy after each. The ten mutants the prompt names, where each is: (1) the link by date alone — A1; (2) the diagnosis outside a quotation — A1; (3) "complete" for a symbol with no series — A2; (4) the old delay sentence — A6; (5) "Exit by" on the bought name — A4; (6) the counter counting an unavailable day — B3; (7) the create transaction trusting the endpoint's read — B3 (and the review's SPR-C-1 row, which kills the subtler form: a plain read inside the transaction); (8) a recurrence in another battle with no open — B2; (9) Set linking with the rule off — B1; (10) `coverage.meetings` describing the read — C1.

## 3. The golden difference map (RJ-9)

The twelve cards-off goldens were re-captured at the code head `07dc3d58` from a `git archive` of it (LF), by the capture harness run twice: byte-identical to each other and to the committed goldens, 12 of 12. The comparison suite's `GOLDEN_SOURCE_COMMIT` names that commit (`7d7d5452`). Every file was then compared with B2's goldens (`origin/main` `24495eba`) by a mapper that removes from the NEW html, or maps in the OLD html, exactly the parts a named Part A rule names, and then requires old = new byte for byte (scratch `golddiff.js`; rules `rules-a1/a2/a3/a6/a7.js`):

| Golden | Result | Mapped to |
|---|---|---|
| `filmRoomV2.empty.deep.desktop.html`, `.empty.deep.phone.html` | unchanged | — |
| `filmRoomV2.empty.glance.desktop.html`, `.empty.glance.phone.html` | mapped | **A3** the stored result note ("opponent score never recorded" → "no check ran this day, so no score was recorded", rendered verbatim, R1/R9); **A7** the one coverage line in place of the checks section's line |
| `filmRoomV2.empty.study.desktop.html`, `.sep23.study.desktop.html` | mapped | **A1** the Meetings section (heading, "Coverage · complete", "No gameplan meeting was recorded this day.") |
| `filmRoomV2.empty.study.phone.html`, `.sep23.study.phone.html` | mapped | **A1** the Meetings section and its jump chip |
| `filmRoomV2.sep23.deep.desktop.html` | mapped | **A2** the grid's series "complete" line withheld, BTC's tile "No chart for BTC: crypto is not charted."; **A6** the delay sentence |
| `filmRoomV2.sep23.deep.phone.html` | mapped | **A6** the delay sentence |
| `filmRoomV2.sep23.glance.desktop.html`, `.sep23.glance.phone.html` | mapped | **A7** the one coverage line ("complete except: checks (partial — …); series (partial — 1 symbol not charted)") |

No difference maps to nothing. Two cards-off movements are not in the goldens and are declared here (RJ-9: changes for cards-off players are declared):
- **The last close's label at a measured plot** (A8, B6): in a real browser only a label its anchor would put out of the plot moves (the four wide-number cases at 280/320 px); every other case sits where B2 put it (headless Edge, 29 of 33 cases byte-for-byte the base's box — §7). jsdom lays nothing out, so the goldens keep the CSS anchors.
- **The route's battle key** (B2; review SPR-RG-1): `FilmRoomRoute` now mounts v2 afresh when the battle under it changes. With cards off that happens only when a late P1c event (`IdeaPanel`'s carrying-battle read) lands while the Film Room shows; before, the old battle's day, depth and selection carried over onto the new battle (a stale-state defect at the base). Not in the goldens (one battle per photograph).

## 4. The exit criterion

| # | Criterion | Holds? |
|---|---|---|
| 1 | A rendered number with the wrong class or none | Holds: every new number is a `TapeNum` by its path or an `AggNum` by a declared aggregate; the two new aggregates (`count(coverage.series.notCharted[])`, `count(tape days with situations unavailable)`) are declared derived in `SCREEN_AGGREGATE_CLASSES` and pinned in the harness with sites and recomputing oracles; the sweeps run on every new state. |
| 2 | A verdict, ranking or forbidden word in the screen's voice | Holds: every new copy key is in the closed inventory (360 keys / 507 entries) and passes the own-voice sweep; RJ-1 … RJ-8's words are byte-exact; the meetings section holds no verdict word and no number (RE-5). |
| 3 | A stated fact contradicts the tape | Holds after the review round: the empty-meetings sentence speaks only under a complete section (SPR-S-1, the BLOCKER); Glance's line never calls a tape that lacks a section complete for every one (SPR-S-2); "no leg recorded" (SPR-S-5); a minted check with no record is a check that ran (SPR-W-3). |
| 4 | A non-owner reads a tape, series or ledger entry; a client writes one | Holds: no rules change; the other battle's document is read through the owner-only `agentBattles` rule (`firestore.rules:470`). |
| 5 | Cards off / not admitted: a card region renders or an endpoint answers; an untaped battle's legacy screen changes | Holds: the twelve goldens at `'off'`, `'allowlist'` not admitted and a failed verdict; both endpoints 404 `disabled` before auth (`cardsGate.js`, unchanged); `FilmRoomScreen.jsx` and the legacy goldens untouched (the route's legacy branch unchanged; `FilmRoomRoute.golden` 12/12). |
| 6 | The hub helper returns anything but its three keys | Untouched (`reviewAvailability.js` not in the diff). |
| 7 | A ledger entry changes the assembled prompt or is read by a model path | Untouched: the census and acceptance C suites green; no new importer of the card modules outside the two routes. |
| 8 | A card for a moment absent from the stored tags, on an unavailable day, under a race that moves the moment, or for another owner's battle or agent | Holds: the route and the create transaction apply one rule (`sourceOfDay`); the transaction re-reads the tape through ITSELF (review SPR-C-1's row: a rewrite landing after the re-read retries and is refused); a re-tag or archetype change mid-flight refuses with its own code (SPR-C-2). |
| 9 | An existing tape field changes value, except A3's note, C1's `coverage.meetings` and C3 if fixed; W5 the only new field | Holds: lens W ran the real writer at the base and at the head over 23 scenarios — only `battle.result.note`, `coverage.meetings.*` and the new `coverage.series.notCharted` moved (§5 lists the details: SPR-W-5's `sources`, SPR-W-3's narrowing of A3). C3 not fixed. |
| 10 | A cards-off screen change the prompt does not name | Holds: §3 — every golden difference maps to A1/A2/A3/A6/A7; the two unphotographed movements are declared. |

## 5. Declared tape movements, and what reaches past days

| Movement | Item | What moves | On a fresh write | On a day already written |
|---|---|---|---|---|
| The result note's wording | A3 (RJ-3) | `battle.result.note` (the writer's own note): names exactly the missing scores; "no check ran this day, so no score was recorded" when no check ran. The platform's completion message stays quoted as its words | from the next close pass on | only by a `refresh=1` re-merge: the merge recomputes the note (`tapeMerge.js`, `noCheckRan(merged.checks)`), the whole-document comparison (`sameContent`, `tapeMerge.js:771`) sees the new text, and the day is written (`refreshed`) |
| `coverage.meetings`' meaning | C1 (RE-3) | describes the STORED rows: span over them, notes counting what the stored section holds and what it left out; a refused rewrite (RD-6) leaves it where it was; a failed read beside stored rows is `partial` | from the next close pass on | only by a `refresh=1` re-merge (the merge recomputes it from the stored rows and the new read) |
| `coverage.series.notCharted` (new field, the only one) | C2 (W5) | `[{ symbol, reason }]` for each held, traded or planned symbol not charted | written by the candle pass when it next runs on a tape | **not** by `refresh=1`: the refresh "reopens no candle work outside the candle window" (`api/cron/film-tape-close.js:36–40`); a past day keeps no `notCharted`. On such a day Deep dive says RJ-2's plain sentence ("No chart was recorded for this symbol.") for a symbol with no series, and Glance's line (A7) reads the stored series status as it is |
| A3, as the review narrowed it (SPR-W-3) | A3 | a day whose rows are only minted checks with no record (admitted, nothing recorded) keeps the missing-score note: such a check RAN; "no check ran" is written only when every row is a deferral, or there is none | from the next close pass on | as A3 |
| `coverage.meetings.sources` (SPR-W-5) | C1 | the first write of a history that is not a list names both sources (`gameplanMeetingHistory`, `gameplanMeeting`), as every merge and the base's own catch branch already did; nothing reads `sources` | — | — |
| One re-write of an old completed day (SPR-RW-1) | A3 | a completed final day written before this build, its note the old one, no longer matches `completionRecorded`; the next close pass on its completion night, or a backfill, re-writes it ONCE (listed `written`, not `alreadyDone`) and it matches after | — | once |
| C1's fresh-write difference | C1 | the row parts (omissions) now count only the rows KEPT under the 26-row cap; B1 counted rows past the cap too | reachable only with more than 26 meetings in a day carrying omissions | — |
| A pre-C1 note, kept (SPR-W-1, accepted) | C1 | C1 reads a stored note as the stored rows' own counts; a note written before this build described the latest read, so the first head merge keeps whatever counts it held. Untampered histories never make them differ (the history is append-only, legs ≤ 2, ids `gpm_<ms>`); reaching it takes an owner's edit before the deploy and a base re-merge in between | — | frozen |

**`refresh=1` after merge — named, not run.** For A3's note and C1's coverage to reach days written before the merge,
the founder runs the close pass's refresh over the taped range after the deploy, e.g.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" -H "x-admin-secret: $ADMIN_SECRET" "https://<host>/api/cron/film-tape-close?backfill=<first taped day>..<last closed day>&refresh=1"
```

(the shape is `api/cron/film-tape-close.js:42–43`'s; the range must be closed sessions on the maintained calendar). A
day whose sources and derived fields are unchanged writes nothing (`unchanged`). This build runs no refresh, no
backfill and no deploy. W5's field reaches only tapes the candle pass works on from the deploy on; there is no
repair path for past days' `notCharted` short of a candle re-run, which this build does not name a command for.

## 6. C3 — X3-5, discovery: the cause, and why this build STOPPED it

**Repro** (the real writer over in-memory Firestore, the multi-day fixture; the scratch test `c3/x35.discovery.test.js`):
day 1's last tick (seq 40) is lost. The first write, at day 1's night, lists 40 as the day's gap (`passes.close.gaps
[40]`, `unattributedGaps []`, a `no_record` row for 40; the checks note "1 minted check of this day has no record
(tickSeq 40)"). After day 2's ticks exist (the next record is 41), a re-write of day 1 lists 40 BOTH ways: `gaps [40]`,
`unattributedGaps [40]`, and the note adds "1 minted check adjacent to this day has no record and its day cannot be
established (tickSeq 40)".

**Cause** (lines at the code head):
1. `api/_utils/filmTape/tapeAssemble.js:357–387` (`gapAnalysis`): a trailing seq is the day's own (`trailingOwned`,
   `:370`) only while there is no later record (`nextSeq`) and no later session has started. Once the next session's
   first tick exists, the same seq is UNATTRIBUTED — correctly, for a fresh read: its day can no longer be told.
2. The first write had already stored it as the day's `no_record` gap row (`tapeAssemble.js:309`), and the merge keeps
   a stored row the new read lacks (`tapeMerge.js:178`, `mergeRows`; monotone by design).
3. `tapeMerge.js:534–537` computes `gaps` from the MERGED `no_record` rows (plus the read's attributed gaps), while
   `:538` takes `unattributed` from the NEW read alone, filtered against recorded seqs only — never against `gaps`.
4. The coverage note: the stored caveat survives every merge (`tapeMerge.js:330–341`, caveats unioned, never dropped)
   and the new read's unattributed caveat is added beside it — so `coverage.checks.note` lists the seq both ways too.

**Why STOP — the review sharpened the reason (lens W, refuter W).** A fix inside `tapeMerge.js:533–538` alone (filter `unattributed` against `gaps`) corrects `passes.close.unattributedGaps` but leaves `coverage.checks.note` naming the seq both ways. A COMPLETE fix is still merge-only — that filter plus rewriting `coverage.checks`' unattributed caveat after the coverage merge, in `tapeMerge.js`, no assembly change (lens W prototyped it: the repro clean, the filmTape suite 808/808). But it DROPS a caveat that `mergeCoverage`'s union (`tapeMerge.js:306–342`, "caveats are unioned and never dropped") keeps by design, and it must also clean caveats already stored on existing tapes. Whether caveats stay merge-monotone is the founder's ruling (§8). **Reach:** a seq lost at a session's end on a battle with a later session — multi-day battles only; every battle today is one trading day, so it is dormant.

## 7. Real layout (A8's clamps)

jsdom lays nothing out, so A8's clamps were measured in headless Edge (playwright-core, `msedge.exe`) over a temporary probe page (never committed) at 320 / 360 / 390 / 1440 px, six symbols each, plus the wide-number cases at 280–390 and 1440 — 33 cases: before A8, every phone swap label and the wide last-close label left the chart; after A8, 33/33 inside. The review found the last close's label placed by an upper bound of its width — about 8 px off its line's end at every width (SPR-L-6); after the fix 29 of 33 cases are byte-for-byte the base's box, the four wide ones clamped, 33/33 clean (scratch `measure-before.json`, `measure-after.json`, `measure-after-l6.json`).

## 8. Rulings asked (built one way, stated)

1. **Set's link and the casual clone (review SPR-L-1, MAJOR — rule before any cards flip).** RH-1's premise is that the tempo dial is "the one setting a player can change that `stalled` reads". Since 2026-08-19 (`CASUAL_CLONE_CONCURRENCY_ENABLED = true`, `featureFlags.js:237`) every client deploy runs on the casual clone `casual-agent-{uid}` (`agentDeploy.js:188–237`; the ranked agent only when the ensure call fails), and every taped battle is a client deploy (the tournament path is flat6, untaped). The clone never receives `dials` — `dials` is not in `INHERITED_LOADOUT_FIELDS` (`api/_utils/trainingClone.js:59–84`) and `buildCasualCloneResync` copies only those fields plus `memory` — so the battle's `agentContext.dials` is null and the tape's rule reads no tempo (`tapeTags.js` → `desiredTempoOf`; the tape stores `tags.inputs.tempoDesired: null`). The Forge's dial writes the RANKED agent (`App.jsx:8843` mounts the Forge with `primaryAgent`, which `subscribeToUserAgent` takes clones out of; `CharacterArea.jsx:198`). So for essentially every battle the card form can show, "Tempo dial · Forge workshop" opens a dial that changes nothing for that battle's agent, and "You change the setting yourself" overstates it. **Built:** the letter of RH-1 / RJ-8 (the link on the day's rule). **Options:** (a) on a clone battle (`isCasualCloneId(battle.agentId)`, a zero-import helper, or the tape's `tags.inputs.tempoDesired === null`) Set says RG-5's sentence alone, or a new sentence, with no link; (b) carry `dials` to the clone (the clone builders; it changes what `createAgentBattle` snapshots for every casual battle — the §1 fence names that document's shape as a concept, and `INHERITED_LOADOUT_FIELDS` also feeds training clones). Related, outside this diff: the card counter and RH-5's `archetype_changed` key on `battle.agentId`, the clone, whose archetype re-syncs only at the next idle deploy.
2. **RJ-4's `{maker}` on the sold name (SPR-S-6).** The sold name renders "Exit · 12:45 PM · Exit by platform rule · stagnation" — unchanged from the base; RJ-4 says it "keeps 'Exit · {time} · {maker}'", and by the letter `{maker}` is "by platform rule · stagnation". The build read "keeps" as "unchanged". Also the build's own entry makers outside RJ-4's two: "by the gameplan meeting" and "maker not recorded" (declared in the A4 commit). Which words?
3. **A planted diagnosis credited "— the platform" (SPR-S-7).** RJ-1 credits the diagnosis to the platform; the history is owner-writable (`firestore.rules:478`), so a diagnosis the owner wrote renders as the platform's words — seen only by that owner (tapes are owner-read; the diagnosis is on the league-film drop list). Keep, or credit by provenance?
4. **"No check ran" on a day of minted checks with no record (SPR-W-3; built).** The evaluator numbers a check in the transaction that admits it, so a minted seq with no record is a check that RAN, outcome unknown. The review found "no check ran this day" beside "Checks · 0 of 3". **Built:** "no check ran" only when every row is a deferral or there is none; a minted-no-record day keeps the missing-score note. Confirm, or name other words ("no check of this day was recorded").
5. **No opponent before RJ-3 (SPR-W-6).** A no-opponent battle whose day ran no check reads the no-opponent note (contract E first, pinned), not RJ-3's. Confirm the order.
6. **X3-5: are caveats merge-monotone? (C3, §6).** A complete fix drops a stored caveat the union keeps by design, and must clean stored ones. Rule whether the union may drop a caveat a later read disproves; then it is one merge-only change (dormant until multi-day battles).
7. **Set's link and the Forge's flags (SPR-C-5; flip checklist).** The link does not check `RELEASE3_CHARACTER_TAB_ENABLED` (with it off, area `'traits'` is Traits, with no dial) nor `TEMPO_DIAL_ENABLED` (with it off, the dial renders with no effect). Both are on today; RH-1 / RJ-8 gate only on the rule. Add both to the cards flip's checklist, or gate the link on them?
8. **The unavailable-day count's scope (SPR-C-6).** "Recurrences · n days in this window could not be read" counts the counter's whole window (120 days by default, floored back to the oldest open Watch card), including days before every Watch card, and shows beside "No open Watch card." It meets RH-6's letter; narrow it to days a recurrence could come from?
9. **The Forge round trip drops the unfiled form (SPR-L-4, SPR-RC-2).** Set's link sits inside the form; the Forge replaces the screen, so the Film Room remounts and the typed note, question, route and op id are gone with no warning. Warn, keep the draft, or move the link to the receipt?
10. **A charted symbol's line on a day Glance reads partial (cross-lens; refuted as a contradiction).** On the Sep-23 day Glance reads "series (partial — 1 symbol not charted)" (RJ-7's own example) while Deep dive's chart section for AMD shows the stored "Coverage · complete". Both follow RJ-2 / RJ-7 to the letter; scope the chart section's line to the symbol?
11. **The prompt's question: do the day and the moment survive the Forge's return (B1)?** No for a Film Room opened any ordinary way: it remounts on its default day, depth Glance, no form, no selection (the back destination is kept). After a recurrence in another battle opened it (B2), App still holds that day and moment while the screen stays the Film Room, so the Film Room reopens on them and marks the moment again — even if the player had moved to another day before tapping Set.
12. **Declared, not asked:** C1 keeps a pre-C1 note's counts (SPR-W-1, §5); the route's battle key is a cards-off movement (SPR-RG-1, §3); one re-write of an old completed day (SPR-RW-1, §5); `coverage.meetings.sources` (SPR-W-5, §5); Deep dive's `charted` predicate is "a series document exists" — unreachable as a defect, since the writer never stores an empty series (SPR-S-3, not fixed); swap-label widths are measured once and a later font swap is not re-measured (SPR-L-7); under `'allowlist'` a cross-battle open paints the legacy screen once (SPR-L-5, the base's verdict logic, unreachable at `'on'`).

## 9. The §2 review

### Findings and dispositions

Verdicts are the refuters'. A "Fixed" or "Row added" finding was mutation-tested in the fix round: 17 mutants planted, 17 killed (§2, the §2 review row).

| Id | Sev. (after refuter) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| SPR-S-1 | BLOCKER | Study said "No gameplan meeting was created this day." from an empty list alone — beside a coverage line saying a meeting was created and not stored (the final day's unfiled pending meeting — live: every battle is one day; a history not a list; an unrecognised outcome; the size budget, SPR-RS-1) | CONFIRMED (+ RS-1) | **Fixed**: the sentence only when `coverage.meetings` is complete; otherwise "This day's tape stores no gameplan meeting." under the coverage line |
| SPR-RS-3 | NIT | the sentence asserted a world fact; the source is the owner's record (RE-5) | added by refuter | **Fixed**: "No gameplan meeting was recorded this day." (the four Study goldens move — A1) |
| SPR-S-2 | MAJOR → MINOR | Glance's one line skipped a section the tape does not store and could say "complete for every section" of a tape that lacks one | PARTLY | **Fixed**: an absent section is named, "meetings (not on this tape)", and the line is partial (the build's own pin of the old behaviour replaced) |
| SPR-RS-2 | — | a tape written before C2 carries no `notCharted`, so RJ-7's "n not charted" never fires on past days | added by refuter | Declared (§5): past days need the candle pass; no repair path named |
| SPR-S-3 | MINOR | Deep dive's `charted` is "a series document exists", not "a chart drawn" | CONFIRMED, not reachable through the writer | Not fixed: the writer never stores an empty series (`candlePass.js:172`); recorded |
| SPR-S-4 | MINOR | the no-chart price list dropped a check whose stamp instant was not recorded | CONFIRMED, not shown producible | **Fixed**: `recordedPricesOf` lists every check holding a price |
| SPR-S-5 | MINOR | "Legs · not recorded" over a meeting recorded with NO leg (every trigger-1 meeting) | CONFIRMED | **Fixed**: "no leg recorded" (true of an empty list and of a missing one) |
| SPR-S-6 | Q | the sold name reads "Exit · {time} · Exit by platform rule · …" — RJ-4's `{maker}` by the letter is "by platform rule · …"; the entry makers "by the gameplan meeting" / "maker not recorded" are the build's words | CONFIRMED (letter vs reading) | Ruling asked (§8.2) |
| SPR-S-7 | Q | a planted diagnosis renders credited "— the platform" (history owner-writable) | CONFIRMED, narrowed (only the planting owner sees it) | Ruling asked |
| SPR-S-8 | NIT | the fixed-digit exemption is whole-text equality anywhere | CONFIRMED | Recorded; no new number can pass |
| cross-lens | — | Glance "series (partial — 1 not charted)" vs Deep dive AMD "Coverage · complete" | REFUTED as a criterion-3 contradiction (both refuters) | Founder question only |
| SPR-C-1 | MAJOR (test gap) | no row failed if the transaction's tape re-read left its read set | CONFIRMED | **Row added** (the rewrite lands after the transaction's re-read; the mutant files a card for a moment the tape no longer holds) |
| SPR-C-2 | MINOR | the in-transaction version/archetype comparison unpinned, and answered `moment_not_found` | CONFIRMED | **Fixed**: archetype drift → 409 `archetype_changed`; version drift → 409 `source_changed` (new code, screen words); the dead from/to clauses removed |
| SPR-C-3 | MINOR | a lost answer re-tapped (L4-9) was refused once the day turned unavailable — new in B3 (base answered 200 idempotent) | CONFIRMED (base run) | **Fixed**: on a source refusal the route asks `replayCreate`; the filed card under that op id is replayed; other words stay `op_conflict`; a new op id is still refused |
| SPR-RC-1 | MINOR | the in-transaction re-read wrapped a gRPC ABORTED as 503, so the SDK never retried the contention RI-3 exists for | added by refuter | **Fixed**: ABORTED rethrown as it came |
| SPR-C-4 | MINOR (test gap) | the per-agent read of `unavailableDays` unpinned | CONFIRMED | **Row added** (another agent's two days) |
| SPR-C-5 | MINOR, latent | Set's link does not check `RELEASE3_CHARACTER_TAB_ENABLED` (or `TEMPO_DIAL_ENABLED`) | PARTLY (not required by RH-1/RJ-8) | Flip-checklist item + question |
| SPR-C-6 | NIT | the unavailable-day count covers the whole window, beside "No open Watch card." | CONFIRMED | Wording question |
| SPR-L-1 | MAJOR | Set's link opens the ranked agent's tempo dial; nearly every taped battle runs on the casual clone (since 2026-08-19), which never receives `dials` — the dial reaches neither the battle nor the tape's rule | CONFIRMED, wider than filed | **Ruling required before any flip** (built to the letter of RH-1/RJ-8) |
| SPR-L-2 | MINOR | a slow battle read opened the other battle after the player had left | CONFIRMED | **Fixed**: a mounted check before the dispatch |
| SPR-L-3 | MINOR | the deferred jump took the focus from where the player had since put it | CONFIRMED (impact smaller) | **Fixed**: the jump lands only while the focus is where the tap left it (or nowhere) |
| SPR-L-4 / RC-2 | Q | the Forge round trip discards the unfiled form, typed note included | PARTLY (disclosed; UX ruling) | Disclosed; question |
| SPR-L-5 | NIT | under 'allowlist' a cross-battle open paints the legacy screen once | PARTLY (base behaviour; unreachable at 'on') | Recorded |
| SPR-L-6 | NIT → MINOR | the last close's label sat ~9.7 px off its line's end at every width (the clamp placed every label by an upper bound) | CONFIRMED, larger | **Fixed**: the clamp moves only a label that would leave the plot; Edge: 29/33 back at base positions, the 4 wide cases clamped, 33/33 clean |
| SPR-L-7 | NIT | swap-label widths measured once; a font swap after is not re-measured | PARTLY | Recorded |
| SPR-G-1 | MINOR | the golden suite's and capture harness's provenance text named B2's base | CONFIRMED (+ the harness) | **Fixed**: the prose; the label set at the final capture |
| SPR-RG-1 | MINOR | the route's battle key is a cards-off change, reachable through a late P1c event | added by refuter | Declared under RJ-9 (it corrects a base stale-state bug) |
| SPR-W-1 | MINOR → NIT | C1 reads a pre-C1 stored note as the rows' own counts | PARTLY (the repro exact; no untampered path reaches it) | Declared, accepted (§5) |
| SPR-W-2 | MINOR → NIT/MINOR | an unrecognised outcome on a HELD meeting moved the note to "not copied" | CONFIRMED (owner tampering only; not a regression) | **Fixed**: counted only when not held |
| SPR-W-3 | Q | "no check ran" on a day whose rows are only minted-no-record | CONFIRMED (the words only) | **Built narrowed** ("no check ran" only for deferrals or no row); ruling asked (§8.4) |
| SPR-W-4 | NIT (test gap) | two A3 mutants survived | CONFIRMED | **Rows added** |
| SPR-W-5 | NIT | `coverage.meetings.sources` gains `gameplanMeeting` on a not-a-list first write | CONFIRMED (no reader) | Declared (§5) |
| SPR-W-6 | Q | no opponent vs RJ-3 precedence | REFUTED as a defect | Ruling asked (confirm the order, §8.5) |
| SPR-RW-1 | NIT | a completed final day written before this build is re-written ONCE (its note no longer matches `completionRecorded`) | added by refuter; checked, holds | Declared (§5) |
| SPR-RW-2 | note | the Windows-only load failures of `tapeWiring.test.js` and `film-tape-backfill.e2e.test.js` are the CR in `scripts/export-film-tape.js`'s shebang | added by refuter | Recorded; not this build's file; Linux (the record) loads both |

### The mutating lens (lens T), last, on its own tree of `a6888e05`

Lens T planted 164 valid mutants across every item's code, one at a time, each file restored byte for byte (the tree checked against `a6888e05` at the end: 0 differences): **139 killed, 2 equivalent, 23 survived** (each survivor also survived a broad re-run over its area's whole suite set). The prompt's **ten named mutants were all killed** on the reviewed head (N1 … N10: 3, 3, 6, 10, 2, 3, 4, 4, 1 and 6 red rows). The equivalents: `swapLabelLayout`'s width cap (`Math.min(l.w, regionW)` → `l.w` gives the same clamp, `lo`, once w ≥ regionW) and its lane test's `>` → `>=` (they differ only at w = regionW exactly).

None of the survivors is a defect today; each marks a regression the tests would have let through. Every MINOR survivor and six of the NITs now have a killing row (commit `46a29b51`, tests only), and each was re-planted against its row:

| Id | Sev. | Where | The survivor | The row | Re-planted |
|---|---|---|---|---|---|
| SPR-T-1 | MINOR | `card.js:125` | dropping `tape_not_found`, `archetype_unknown` or `question_not_on_menu` from the replay's refusals (three mutants) | `card.test.js`: the question's version moved on, the archetype gone, the tape gone — each re-tap a 200 idempotent replay of the one card (the menu doubled as a getter over the real one) | 3 of 3 killed (1 / 38 each) |
| SPR-T-2 | MINOR | `candleInputs.js:114/116/118` | dropping the evidence, sold-name or sectors source (three) | `candlePassNotCharted.test.js`: a name from each source on its own | 3 of 3 killed (1 / 12 each) |
| SPR-T-3 | MINOR | `filmRoomModel.js:705` | `recordedPricesOf` without its `isNum(px)` guard | the no-chart list without a check whose stored price is null | killed (1 / 10) |
| SPR-T-4 | MINOR | `tapeMerge.js:503` | the merge's note reading the STORED checks | a day stored with no check, re-written once its checks are read: the missing score named | killed (1 / 15) |
| SPR-T-5 | MINOR | `FilmRoomDeepDive.jsx:98` | `lastCloseTop`'s measured-box branch forced off | a 156 px plot, a marker under the clamped box but outside the anchor's columns: the label leaves its band (with the unclamped control) | killed (1 / 13) |
| SPR-T-6 | MINOR | `filmRoomModel.js:617` | `meetingOfRun` taking the first match, not the latest created | two meetings whose lives hold the run, in both orders | killed (1 / 14) |
| SPR-T-7 | MINOR | `FilmRoomStudy.jsx:509` | the resolver rendered without its record-text marker | the outcome's resolver is `[data-record-text]` | killed (1 / 14) |
| SPR-T-8 | MINOR (copy) | `filmRoomCopy.js:373` | RJ-7's plural never asserted | two of the agent's own days: "Recurrences · 2D days in this window could not be read" | killed (1 / 54) |
| SPR-T-9 | NIT | six sites | `(\d+)` → `(\d)` in the meetings note's parse; an unanchored ET date; createdAt exclusive; `setRuleOf` truthy; an unknown coverage status as partial; a stored note under complete shown | one row or line each | 6 of 6 killed (1 red row each) |

The other SPR-T-9 NITs are recorded, not rowed: an over-long raw id key in SPR-W-2's path (the ids are `gpm_<ms>`), the no-ready check of Deep dive's coverage line on an error read, a second tap closing the recorded-price stamp, the swap row's band in the lane case, and an unknown outcome's record marker (unreachable from the writer, which copies only the three statuses). Lens T's caveat on the counter: the fake Firestore's `select` ignores the projection (`tapeFirestore.js:170`), so the counter's field mask holds by its literal pin only.

## 10. Final checks

Every check ran on the branch merged with current `origin/main` (`62380f14`, re-fetched right before), never on the branch alone, each in a git clone or a git archive of that merge. The merge commit is a check-only object (`git merge-tree` + `git commit-tree`), never pushed.

| Check | Where | Result |
|---|---|---|
| Linux full suite, run 1 | a WSL worktree of the clone `~/pd-ci` at `afb17dc1` (`c264b102` merged with `62380f14`); `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`, alone | **1 failed file** of 1,214, one row of 26,318: `src/components/CommandCenter/commandCenterHub.mount.guard.test.js:832`, "the main graph reaches the hub directory only through App → the gate, the picker and the chrome predicates". The tenth edge was B1's `FilmRoomCardRegions.jsx -> hubChrome.js`. Fixed in `07dc3d58` (§2, the B1 area fix); both mutants of the fix killed |
| Linux full suite, run 2 (the record) | the same clone, at `7c92c31e` (`7d7d5452` merged with `62380f14`) | **0 failing files**: 1,206 passed, 8 skipped (1,214); rows 26,229 passed, 89 skipped (26,318); exit 0; 243 s |
| Rules suite (`npm run test:rules`, Firestore emulator) | Windows (WSL has no Java); an LF git archive of `7c92c31e` | 27 files, 440 rows, all passed (27 / 440 at `afb17dc1` too) |
| `npm run lint:gate` | the same archive | exit 0, no warning |
| `vite build` | the WSL clone at `7c92c31e`; then the same WSL clone checked out at this report's own commit (a Linux checkout, LF), the last check before the push | built at `7c92c31e` (the `FilmRoomScreenV2` chunk 100.69 kB). The pushed head's build is recorded in the PR description |
| Goldens (RJ-9) | git archives of `46a29b51` (a plain archive: CRLF sources on this machine), then of `07dc3d58` (LF, the record): the capture harness twice each | 12 / 12 byte-identical across the runs and to the committed goldens; the comparison suite 6 / 6; the map (§3) re-run at the head: 2 unchanged, 10 mapped, none unmapped |

Why the review did not catch the guard: its lenses ran each item's suites and the Film Room's, not every guard in the repo. The hub's mount guard walks every `src/` file, and only a full suite reaches it. Run 1 caught it before the push.

On Windows, the Film Room's suites pass except two known platform failures. `tapeWiring.test.js` and `film-tape-backfill.e2e.test.js` fail to load there because of the CR in `scripts/export-film-tape.js`'s shebang (SPR-RW-2). Linux is the record.

## 11. Fence statement

- Zero BUILD_RULES §1 edits: none of the 66 files in the branch diff is on the §1 list (checked by name; refuter G re-checked).
- `api/cron/agent-evaluate.js` untouched (read only, by reviewers).
- No change to `firestore.rules`, `firestore.indexes.json` or `src/config/featureFlags.js`; `FILM_ROOM_CARDS_MODE` stays `'off'`. B1's source row reads `RELEASE3_CHARACTER_TAB_ENABLED` through the workshop's own gate rather than pinning it (a pin would have required a docstring pointer in `featureFlags.js`).
- P1c changed additively only: `requestOpenBattleReview(battle, at = null)` sends exactly `{ battle }` without `at`; App's listener keeps its three statements and adds one after them; P1c's tests (`deployShells.p1c.guard.test.js`, `IdeaPanel.review.jsdom.test.jsx`) are not in the diff and pass.
- The hub's code (`src/components/CommandCenter/**`) is not in the diff, and nothing outside it imports a hub module anew: B1 calls App's existing `onOpenForge` with the Character area's id held as a value. B1 first imported `FORGE_AREAS` from `hubChrome`; the hub's own mount guard forbids that edge, and the final suite caught it (§10, fixed in `07dc3d58`).
- No merge, no production write, no backfill, no refresh, no deploy, no flip.

## 12. README

One row in `docs/README.md` for this report, with the audits.

## 13. The founder's rulings (Amendment K)

**Date:** 28–29 Oct 2026 · **Executor:** Claude Code (desktop, local Windows + WSL Ubuntu; Opus 5.5) · **Prompt:** the Film Room chat, "Fix prompt — Film Room B2.1: the founder's rulings" · **Governing:** Build B Amendment K (RK-1 … RK-13), committed verbatim by this round, over Amendments A–J and the spec.

### 13.0 Verdict

| Question | Answer |
|---|---|
| Built | B0 (Amendment K verbatim, its README row); the seven fixes, one commit each with its tests; the cards-off goldens re-captured at the code head; the §2 review's fix round and the mutating lens's rows; this section. Draft PR, no merge, no production write, no backfill, no refresh, no deploy, no flip. |
| `FILM_ROOM_CARDS_MODE` | `'off'`, untouched (`src/config/featureFlags.js` is not in the branch's diff). |
| The prompt's fourteen named mutants | **All killed** (§13.2, the Mutants column). |
| Exit criterion | B2.1's ten criteria hold, with Amendment K's three changes (§13.4). |
| Goldens (RK-13) | Re-captured at the code head `004f2c1f` from an LF archive, twice, byte-identical. Against this PR's committed goldens: 10 of 12 unchanged, 2 moved, both mapped to RK-11, none unmapped. RK-5 reaches no golden (§13.3). Nothing after `004f2c1f` changes the cards-off screen: the comparison suite passes at the final head. |
| `refresh=1` and RK-9 | The `refresh=1` named in §5 also carries RK-9. It re-merges every written day through the same merge, and a row proves a double-listed stored tape is cleaned once, then unchanged (§13.5). |
| The §2 review | §13.7: four lenses, a refuter each, then the mutating lens last on its own tree. One MAJOR (KR3-1: RK-9's rewrite could drop half of another caveat from the note), fixed. MINORs fixed or rowed. Three founder questions. The mutating lens: 99 mutants, 81 killed, 8 equivalent, 10 survived. Nine survivors now have a killing row, re-planted and killed; one is recorded. |
| Final checks | §13.8, on the branch merged with `origin/main` `9bbe2b1b`: Linux full suite 0 failing files; rules suite 28 files / 448 rows; `lint:gate` exit 0; `vite build` ok. |
| Rulings asked | §13.10: four questions, none blocking a merge; the cards flip waits on the first. |

### 13.1 Preamble

- `git fetch origin` ran first. The PR's head was `ea5c4a20` on `origin/claude/film-room-screen-pass`, as the prompt names it. The app cut the session's worktree branch `claude/film-room-b2-1-rulings-570ec0` at `main` `62380f14`. It was checked clean, moved to `ea5c4a20`, and is pushed back by refspec to `claude/film-room-screen-pass`.
- `main` moved twice during the round:
  - #1001 merged as `148a3fa1`.
  - #1000, #1004, #1002 and #1005 merged, the last as `9bbe2b1b`.
  - Both merge clean with the branch. The files both sides touch are `docs/README.md` (separate rows) and `src/App.jsx`. #1000's `03457c46` changes App.jsx outside the Film Room lines, and the App source pins pass on the merge.
  - `src/constants/leagueTournament.js`, which RK-1 now reaches through the resolver, changed on `main` since the branch's base only in a comment (#999).
  - The lockfile is unchanged on `main`.
- Anchors re-verified: `api/_utils/casualClone.js` lines 1–32 (the module's contract) and 270–336 (`resolveAttributionAgentId` at `:286`, `resolveRecordTargetId` at `:329`) are as the prompt names them, at `62380f14` and at this head. The file is not in the diff.

### 13.2 One row per fix

Reading the Mutants column: "5 / 45" = five rows red of forty-five in the suites run against that mutant. Each mutant was planted by a runner that saves the file's exact bytes, replaces one unique string, runs the named suites (the RK-1 rows on the real Firestore emulator too) and writes the bytes back, checked equal; the tree was clean after every batch. **N** marks the prompt's fourteen named mutants; **M** marks this round's own.

| # | Ruling | Commit | The change | Tests | Mutants (rows red / rows run) |
|---|---|---|---|---|---|
| B0 | Amendment K | `087ff04e` | `docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_AMENDMENT_K_20261028.md`, verbatim between the markers (13 rulings, LF); one README row | — | — |
| 1 | **RK-1**, the attribution agent | `ccf60654` | `cardStore.js`: `attributionAgentOf` (`:104`), the platform's async resolver; a casual-clone answer is refused 503 `attribution_unavailable`. `ownerAttributionOf` (`:120`), one read of `agents/casual-agent-{uid}`, then `resolveRecordTargetId`, applied only to the owner's own clone id. `card.js`: `resolveCreateBattle` (`:141`) checks the battle as before, then resolves the attribution agent before any tape read; the create (`:193`), SPR-C-3's replay and the retire (`:215`) all key on it. `cardCounter.js`: `buildCounter` (`:203`) answers for `attributionAgentId`, refuses the owner's unresolved clone (`:209`) and a missing or foreign parent the same way, and maps every tape day through the resolver (recurrences `:230`, unavailable days). Since last time reads the unavailable days under `attributionAgentId`. | `card.test.js` +7 (handler, in-memory): a clone battle files under the parent and naming the parent for it is 403; a ranked battle files under itself; three fallbacks → 503 before any tape read, nothing written; archetype drift both ways; the replay; the retire and an unresolvable retire; the cap across both kinds of battle. `cardCounter.test.js` +4. `FilmRoomCards.jsdom` +1 (the clone battle on screen). **`test/rules/filmRoomCardAttribution.rules.mjs`, 8 rows on the real Firestore emulator** (the rows the prompt lists). | **N** a clone battle's card filed under the clone → 9 / 53; **N** a fallen-back resolution filing under the clone → 3 / 53; **N** the counter leaving a clone day out → 3 / 44; **N** the counter counting another owner's clone → 2 / 43; **N** the archetype check reading the clone → 2 / 53; M the replay keyed on the clone → 2 / 53; M the retire keyed on the named agent → 2 / 53; M the counter reading the asked agent's ledger → 6 / 43; M unavailable days by each day's own agent → 3 / 44; M the screen reading the line under the asked agent → 1 / 1; M the counter answering an unresolved clone → 2 / 43; M a clone document another owner holds used → 1 / 35; M a foreign parent answered 403 instead of the fallback → 2 / 43 |
| 2 | **RK-2 + RK-3**, Set's link | `33e561a4` | `FilmRoomCardRegions.jsx` `setStateOf` (`:99`): the link only when the rule is on, `tags.inputs.tempoDesired` is a recorded tempo, and `RELEASE3_CHARACTER_TAB_ENABLED` and `TEMPO_DIAL_ENABLED` are on; RK-2's sentence when the rule is on and no tempo is recorded. The form shows Set's words and never the link. The receipt of an open Set card shows the words and the link, judged from the tape on screen only when that is the card's own source day. New copy key `cards.setNoTempo`. | `FilmRoomCards.jsdom`, B1's Set rows rewritten: `setStateOf`'s matrix (each condition alone turns the link off); all conditions hold → the form has no link, the receipt does and opens the Character area; the casual day (`tempoDesired` null) → RK-2's sentence, no link; each condition off alone, on the receipt; the rule off and no input, on the form; a receipt from another day; a retired Set card. A recorded-tempo day is written by the real writer (`dials: { tempo: 'standard' }`). | **N** Set linking with `tempoDesired` null → 2 / 10; **N** Set linking with either Forge flag off → 2 / 10 (Character tab) and 2 / 10 (tempo dial); **N** the link inside the form → 1 / 10; M Set linking with the rule off → 2 / 10; M the receipt judged from another day's tape → 1 / 10; M a retired Set card linking → 1 / 10; M the no-tempo sentence never said → 2 / 10 |
| 3 | **RK-4**, one-shot open | `0ad75d27` | `FilmRoomScreenV2.jsx` (`:224`): with `openAt` handed in, v2 calls `onOpenAtUsed` once at mount, after reading it into its state. `FilmRoomRoute.jsx` passes it through; `App.jsx` passes `onOpenAtUsed={() => setFilmRoomOpenAt(null)}` and still clears on leaving the Film Room. P1c's listener is unchanged. | `FilmRoomCards.jsdom` +1: an App-like holder opens the screen at the other battle's day and moment, the player moves to another day, a Forge stand-in replaces the screen and closes it: the default view (the last day, Glance), nothing marked, the clear called once. `App.filmRoomForge.source` (the clear on the route; three `setFilmRoomOpenAt` sites); `FilmRoomRoute.untaped` (the props pin) | **N** `at` applied on a second mount → 1 / 1; M App never clearing → 2 / 10; M the route dropping the clear → 1 / 10 |
| 4 | **RK-5**, the sold name's maker | `16aa4f69` | `FilmRoomDeepDive.jsx` (`:263`): the chart's sold-name annotation reads "Exit · {time} · {maker}" with `entryMakerOf`'s makers. `exitMakerOf`'s words stay everywhere else. | `FilmRoomDeepDive.jsdom`: the A4 row's sold names (a platform rule, the agent); a new row over the agent, a platform rule with and without its reason, the meeting and a maker not recorded; the FR-04 sweep extended to every sold name | **N** "Exit by" back on the sold name → 3 / 34 |
| 5 | **RK-9**, X3-5 | `6c3aa53b` | `tapeMerge.js`: `unattributed` filtered against the merged gaps; `attributedCaveats` rewrites or drops the checks section's unattributed-gap caveat for any seq a stored row attributes to the day, in `caveats` and in the note; `unattributedSeqsOf` parses a caveat only when composing it back gives the same text. Merge-only. (The review round, below, narrowed its dedup and widened its set to the recorded seqs.) | `tapeMergeX35.test.js` (6, new; the real writer, the multi-day fixture): the §6 repro (seq 40 listed once, as the day's gap, the note naming it once); a third re-write `unchanged`; an unattributed seq no stored row claims kept with its caveat; another seq's caveat and an unrelated caveat kept; a two-seq caveat rewritten to the one left; a stored double listing cleaned once, then `unchanged`. Red before the fix (4 of 6). | **N** the merge listing a stored gap's seq as unattributed → 2 / 6; **N** the merge dropping a caveat no stored row disproves → 2 / 6; M the caveat left as the union kept it → 4 / 6; M the note left naming the seq → 3 / 6; M any "(tickSeq …)" caveat read as unattributed → 2 / 6; M the rest renamed with the whole list → 1 / 6 |
| 6 | **RK-10**, the unavailable-day line | `004f2c1f` | `FilmRoomCardRegions.jsx` (`:420`): the line shows only when at least one open Watch card is listed | `FilmRoomCards.jsdom` +2: no open Watch card (none filed, a Practice card, a retired Watch card) → no line; one open Watch card → the line as built. SPR-C-4's and SPR-T-8's rows now hold an open Watch card | **N** the unavailable-day line with no open Watch card → 1 / 7 |
| 7 | **RK-11**, a charted symbol | `9a29c692` | `FilmRoomDeepDive.jsx` (`:481`): beside a charted symbol the chart section reads "Chart recorded for {symbol}", the symbol as record text, in the coverage line's place. A symbol with no series keeps RJ-2's behaviour; the all-symbols grid keeps the section's line; Glance is unchanged. New copy key `chartRecordedFor` | `FilmRoomDeepDive.jsdom`: the Sep-23 day (AMD charted, BTC not); a fully charted day and a day whose series section is partial; the A2 row that pinned the section's line beside the chart rewritten to RK-11's | **N** the section's status beside a charted symbol → 5 / 34; M the symbol not marked as record text → 1 / 34 |
| — | Goldens (RK-13) | `dd0f495d` | the two moved goldens and their SHA-256; `GOLDEN_SOURCE_COMMIT` `004f2c1f` | the comparison suite 12 / 12, `FilmRoomRoute.golden` 6 / 6 | — |
| — | §2 review round | `0bdcd054` | the fixes the refuters confirmed (§13.7): `tapeMerge.js` `attributedCaveats` deduplicates only rewritten caveats (KR3-1); one attributed set for the caveat and `unattributedGaps` (KR3-3); the counter refuses any answer for a casual clone (KR1-1) and names the agent on a failed clone read (KR1-7); neutral server copy; the screen's words for `attribution_unavailable` (KRV1-1); docstrings (KR2-4, KRV2-1, KRV3-2); the capture harness's header (KR4-4) | `tapeMergeX35.test.js` +5 (planted and natural shapes); `cardCounter.test.js` +2; `FilmRoomCards.jsdom` +3 and two row-name and step corrections; `FilmRoomDeepDive.jsdom` +2 makers with a reason | 9 planted, 9 killed: every note part deduplicated → 2 / 11; rewrites not deduplicated → 2 / 11; the caveat judged by the gaps alone → 1 / 11; only the owner's own clone id refused → 1 / 37; the read failure not naming the agent → 1 / 37; the receipt's day matched by date alone → 1 / 12; the link gated on the stage alone → 1 / 12; the reason dropped after the meeting maker → 1 / 34; the screen's words for `attribution_unavailable` gone → 1 / 1 |
| — | §2 mutating lens | `7336a20c` | tests only: a row for each survivor (§13.7) | `cardCounter.test.js` (KRT-1, KRT-6), `card.test.js` (KRT-4, -5, -10), `FilmRoomCards.jsdom` (KRT-2, -3, -8, -9) | 9 re-planted, 9 killed, each by its new row (1–2 rows red) |

The copy inventory grew by three keys (`cards.setNoTempo`, `chartRecordedFor`, `cards.refusals.attribution_unavailable`), to 363 keys and 510 entries. All three pass the own-voice sweep. RK-2's sentence is RG-5's sentence followed by `cards.setNoTempo`, and composed it is byte-for-byte the amendment's text.

### 13.3 The golden map (RK-13)

The twelve cards-off goldens were re-captured at the code head `004f2c1f`, from `git -c core.autocrlf=false archive` of it (one file checked equal to `git show`), by the capture harness run twice. Both runs were byte-identical, 12 of 12. Every file was then compared with this PR's committed goldens (`ea5c4a20`) by a mapper. The mapper puts back, in the NEW html, exactly what RK-11 or RK-5 changed, then requires old = new byte for byte (scratch `goldmap.mjs`).

| Golden | Result | Mapped to |
|---|---|---|
| `empty.*` (6), `sep23.glance.*` (2), `sep23.study.*` (2) | unchanged | — |
| `sep23.deep.desktop.html`, `sep23.deep.phone.html` | mapped | **RK-11**: AMD's chart section reads "Chart recorded for AMD" (AMD as record text) where the series section's "Coverage · complete" stood |

No difference maps to nothing. RK-5 is not in the goldens: the photographed chart is AMD's, which has no swap. Its change is pinned by `FilmRoomDeepDive.jsdom` instead. No other cards-off movement exists: RK-1's screen line, RK-2/RK-3, RK-4 and RK-10 render only under cards (RK-4's call happens only when an `openAt` is handed in, which only a cards recurrence does).

### 13.4 The exit criterion

B2.1's ten criteria (§4) stand. Amendment K changes three of them, and each holds:

| # | Change | Holds? |
|---|---|---|
| 8 | adds: a card filed under any agent but the battle's attribution agent | Holds: the create files under `attributionAgentOf(battle.agentId)` only; the request's agent must still be the battle's own (403 otherwise). The clone is never written: an unresolvable clone is refused 503 before any tape read, by the emulator rows and the handler rows. |
| 9 | the declared movements add RK-9's two fields, on a multi-day re-write only: `passes.close.unattributedGaps` and `coverage.checks.note` | Holds, with one declaration: `coverage.checks.caveats`, the array the note is composed from, moves with the note (§13.6). Single-day battles move nothing: the change applies only when a read lists an unattributed seq that the merged rows hold as a gap, which takes a later session. |
| 10 | this round's cards-off changes are RK-5 and RK-11 only | Holds (§13.3). |

### 13.5 `refresh=1` and RK-9

The `refresh=1` named in §5 also carries RK-9. The refresh runs `runBackfill` (`api/_utils/filmTape/closePass.js:292`), which re-merges every written day of its range through `writeTapeDay`. `writeTapeDay` merges with `mergeTape`, the function this fix changes. A stored tape carrying the double listing is therefore cleaned on its next refresh, and listed `refreshed`. The row "a tape stored with the double listing … is cleaned by the next re-merge" proves it: written once, then `unchanged` on the following write. No stored tape is known to carry the listing: every taped battle so far is one trading day, and X3-5 needs a later session.

### 13.6 Declared (built one way, stated)

1. **The weekly table** (`weekly` in the counter's answer) stays keyed by each tape day's own agent. RK-1 lists the cards, open count, cap, recurrences and unavailable days, but not the weekly table, and no screen reads it.
2. **The counter's refusals.** The counter answers 503 `attribution_unavailable`, as the create does, in three cases: an answer that would be for any casual clone (review KR1-1); the owner's own clone unresolved (no document, no `rankedAgentId`, a document another owner holds, or a parent that is missing or another owner's); and a clone read that fails. A request naming another owner's non-clone agent stays 403, as before. Clone days whose clone can't be resolved, asked by the ranked agent, are not that agent's: the resolver's fallback keeps them on the clone, and the counter answers for the ranked agent's own days only.
3. **The receipt's Set words** are judged from the tape on screen only when it is the card's own source day (battle and date). A Set card's receipt opened from My cards on another day says RG-5's sentence alone, with no link. That sentence is true of every day. Nothing is added to the card's document.
4. **`tempoDesired` absent** (a tape written before the tagger stored the field) is read as "no tempo recorded".
5. **RK-10's reading.** "At least one open Watch card lists recurrences" is read as "an open Watch card is listed, with its Recurrences list", including an empty one. The test row asks for exactly this: one open Watch card gives the line as built.
6. **`coverage.checks.caveats` moves with the note** on an RK-9 re-write (§13.4, criterion 9). The note is composed from that array, so the two can't disagree.
7. **RK-9's attributed set** (review KR3-3) is the seqs the tape's merged rows attribute to the day: recorded tick rows, plus its gap rows (`no_record`, or the entry standing for a gap). `passes.close.unattributedGaps` already excluded recorded seqs before this round. The caveat now judges by the same set, so a rewrite never says a recorded seq "has no record". The refuter would rather ask; confirmation is asked in §13.10.
8. **The create resolves the attribution agent outside its transaction** (the platform's async resolver, two reads). The transaction then checks the parent's owner and archetype on its own read. A clone re-pointed to another of the owner's ranked agents between the two would file under the agent the resolver named a moment before.

### 13.7 The §2 review

The round's diff (`ea5c4a20..dd0f495d`, 26 files, 1,252 lines added) is past BUILD_RULES §2's threshold. The review ran four lenses, each on its own `git archive` extraction, read-only on git. Each lens's findings went to a refuter on another extraction. The mutating lens ran last, on its own tree of the review round's head `0bdcd054`. The ids use the prefix KR (lenses KR1–KR4), KRV (refuters) and KRT (the mutating lens). None of these prefixes is in use elsewhere in the repo.

- **KR1**: the server (RK-1).
- **KR2**: the screen (RK-2, RK-3, RK-4, RK-10, RK-1's line).
- **KR3**: the merge (RK-9).
- **KR4**: the cards-off screen, copy, goldens and fences (RK-5, RK-11, RK-13).

**Findings and dispositions.** Verdicts are the refuters'. Every "Fixed" or "Row added" is in `0bdcd054` and was mutation-tested: 9 mutants planted, 9 killed.

| Id | Sev. (after refuter) | Finding | Verdict | Disposition |
|---|---|---|---|---|
| KR3-1 | MAJOR | RK-9's caveat rewrite deduplicated every note part. Two plural entry-only caveats hold the same tail after their own "; ", so one lost its tail from the note for good. Natural triggers: day 1 loses 5, 6, 39 and 40, then tick 6 is read late with day 2 (no cap needed), or the 150-entry cap evicts day 1's entries | CONFIRMED (and a cheaper trigger) | **Fixed**: only a rewritten caveat is deduplicated, against the parts left untouched and earlier rewrites; every other part stays as the union left it. Rows: planted, and the natural shape. Mutant killed 2 / 11 |
| KR3-2 | MINOR | No row killed a dedup mutant. Dropping the note's dedup also makes a rewrite re-append on every write (not idempotent) | CONFIRMED, stronger | **Rows added**, planted and natural (day 2 loses 41 and 80): kept once, next write `unchanged`. Mutant killed 2 / 11 |
| KR3-3 | MINOR (from Q) | Reverse direction: a stored caveat naming a seq the day now RECORDS was rewritten to claim that seq "has no record", while the passes' filter already excluded recorded seqs | PARTLY (the "looser" half refuted: the entry row stands for 39; the "stricter" half holds) | **Fixed**: the caveat and `passes.close.unattributedGaps` judge by one set, the seqs the merged rows attribute to the day (recorded, or held as its gaps). Row; mutant killed 1 / 11. The refuter would rather ask; confirmation asked in §13.10 |
| KR3-4 | NIT | `coverage.checks.caveats` moves with the note, outside RK-13's list | PARTLY (RK-9's own text rewrites "the caveat") | Declared (§13.6) |
| KRV3-1 | MINOR | the six rows covered neither KR3-1 nor a rewrite colliding with a kept caveat | added by refuter | the natural rows A and B taken in |
| KRV3-2, -3 | NIT | the docstring equated `gaps` with `no_record` rows; idempotence unpinned under a dedup change | added by refuter | Fixed (docstring); row B pins it |
| KR1-1 | MINOR | the counter refused only the owner's own clone id; a clone-named agent (a pre-rules squat, or a clone whose parent is a clone) was answered for, its empty ledger read | CONFIRMED | **Fixed**: any answer for a casual clone is 503, as the create refuses it. Row; mutant killed 1 / 37 |
| KR1-2 | NIT | with a foreign parent, the counter keys that clone's days under the parent's id | PARTLY (the screen never reads it; nothing counted) | Recorded |
| KR1-3 | NIT (from Q) | a clone document owned by another user → the create 403, the counter 503 | PARTLY (unreachable through the route: deploy needs ownership, `ownerId` cannot change) | Recorded |
| KR1-4 | NIT | a retire naming another owner's clone reads that clone before refusing | PARTLY (not a new oracle; the counter already answers 403/404) | Recorded |
| KR1-5 | Q | a `training-agent-*` parent would pass | CONFIRMED mechanics, unreachable | Recorded; follows the platform's resolver |
| KR1-6 | NIT | shelving by the parent on the counter's read pinned only on the emulator, which CI does not run | CONFIRMED, narrowed | **Row added** in `cardCounter.test.js` |
| KR1-7 | NIT | the clone-read failure's 503 copy said "This battle ran on your casual agent" on a ranked ask, with no agent named | PARTLY | **Fixed**: neutral copy; the agent asked named. Mutant killed 1 / 37 |
| KR1-8 | NIT | the resolver brings +44 modules into the counter route (+7 into the card route) | PARTLY (no import-time side effect) | Recorded (`casualClone.js` is fenced) |
| KRV1-1 | NIT | the screen had no words for `attribution_unavailable`, so its retry advice was lost | added by refuter | **Fixed**: `cards.refusals.attribution_unavailable`; row; mutant killed 1 / 1 |
| KR2-1 | Q | `tempoDesired: null` is also a RANKED battle whose dial was never set. Those players get the no-tempo sentence and never the link | CONFIRMED (facts hold; the sentence is not false) | **Ruling asked** (§13.10); built to RK-2's letter |
| KR2-2 | Q | RK-10's reading | CONFIRMED (the build's reading stands; pinned by 4 rows) | Declared (§13.6) |
| KR2-3 | MINOR | no row for a Set receipt beside the same date of another battle, or a shelved Set card; both mutants survived | CONFIRMED | **Rows added**; both mutants killed (1 / 12 each) |
| KR2-4 / KRV2-1 | NIT | row names and the `setStateOf` docstring equated a null tempo with a casual clone; the RK-4 row could not tell the default view from the player's; "back on its own day" untested | CONFIRMED | **Fixed** |
| KR4-1 | MINOR | the goldens' suite cited this section before it existed | CONFIRMED (a push condition) | This section |
| KR4-2 | MINOR | the reason after the meeting or an unrecorded maker was unpinned on the chart; every real meeting swap carries `gameplan_rotation` | CONFIRMED, stronger | **Rows added** (the real reason); mutant killed 1 / 34 |
| KR4-3 | Q | the one-symbol chart section shows the series status while it is loading, after a failed read, and beside an uncharted symbol on a partial day (no chart drawn); predates the round | CONFIRMED as a Q | **Ruling asked** (§13.10) |
| KR4-4 | NIT | RK-5 is not in a golden; the capture harness named old sources | CONFIRMED | Harness header fixed; RK-5 pinned by `FilmRoomDeepDive.jsdom` |
| KR4-5 | NIT/Q | RK-5's shorter labels vs A8's measured layout | REFUTED as a defect | Recorded (widths are measured inputs) |
| KR4-6 | NIT | plain eslint's `only-export-components` on `setStateOf` | PARTLY (the file already exported `setRuleOf`; `lint:gate` is clean) | Recorded |
| KRV4-1 | Q | the meeting maker always shows the raw code "· gameplan_rotation" (as it did before this round) | added by refuter | **Ruling asked** (§13.10) |
| KRV4-2 | NIT | "Chart recorded for X" over a series document with no bars (SPR-S-3) | added by refuter | Declared; the writer stores none (RK-12 accepted SPR-S-3) |

Tally of the lenses' 22 findings: 13 CONFIRMED, 8 PARTLY, 1 REFUTED. The refuters added 8 more. One MAJOR (KR3-1), fixed. No BLOCKER.

**The mutating lens (KRT), last, on its own tree of `0bdcd054`.**
- **Totals.** It planted 99 mutants: 34 in the server, 18 in the merge, 41 in the screen, copy and App, and 6 extra. 81 were killed, 8 equivalent, 10 survived.
- **Every kill came from a CI suite.** The emulator file killed no mutant the CI suites had left alive.
- **Equivalents.** Among the 8: the create resolving `req.agentId`, which equals `battle.agentId` after the check; the store's 503 on a failed clone read, re-wrapped by code; the parse's `$` anchor, which the compose-back check decides anyway; and two early returns that only save work.
- **One false kill corrected.** A `candlePass` row timed out under load.
- **Survivors.** Each now has a killing row (`7336a20c`, tests only), re-planted and killed:
  - MINOR:
    - KRT-1: a missing parent answered 404 instead of 503.
    - KRT-2: the no-tempo sentence judged before a rule that is off.
    - KRT-3: Set's words leaking onto Watch and Practice.
  - NIT:
    - KRT-4: the attribution read before the untaped check.
    - KRT-5: a clone-named parent filing.
    - KRT-6: the weekly table re-keyed.
    - KRT-8: an empty tempo counted as recorded.
    - KRT-9: the link without a Forge door.
    - KRT-10: the server's sentence unpinned.
  - **One recorded, not rowed.** KRT-7 (NIT): a checks note whose every part is rewritten away would be stored as `''` instead of null. No writer scenario run reached it: a stored gap row brings its own gap caveat into the same note, so the note keeps that part.
- **Tree check.** The lens's tree was byte-equal to the archive at the end.

### 13.8 Final checks

Every check ran on the branch merged with current `origin/main`, never on the branch alone, in a git worktree of the WSL clone `~/pd-ci` or in an LF `git archive`. Each merge commit is a check-only object (`git merge-tree` + `git commit-tree`, held by a local ref), never pushed.

| Check | Where | Result |
|---|---|---|
| Linux full suite, run 1 | `e3f049e4` (`dd0f495d`, the code and goldens, merged with `148a3fa1`); `TZ=UTC`, `--maxWorkers=8`, under `flock /tmp/pd-suite.lock`, alone | **0 failing files**: 1,214 passed, 8 skipped; 26,707 rows passed, 89 skipped; 211 s. The hub's mount guard, the census and `flagPinGuard` pass |
| Linux full suite, run 2 | `0055dc35` (`0bdcd054`, the review round, merged with `148a3fa1`) | **0 failing files**: 1,214 / 8; 26,717 rows passed, 89 skipped; 218 s |
| Linux full suite, run 3 (the record) | `8553125a` (`7336a20c`, the final code, merged with `9bbe2b1b`) | **0 failing files**: 1,219 passed, 8 skipped (1,227); 26,858 rows passed, 89 skipped (26,947); exit 0; 373 s. This run overlapped the rules suite on Windows and was slower for it |
| Rules suite (`firebase emulators:exec … vitest.rules.config.mjs`) | Windows (WSL has no Java), an LF archive of `8553125a` | 28 files, 448 rows, all passed. This round's `filmRoomCardAttribution.rules.mjs` adds 8 rows (27 / 440 before) |
| `npm run lint:gate` | WSL, `e3f049e4` and `8553125a` | exit 0, no warning, both |
| `vite build` | WSL, this report's own commit merged with `main` (the pushed head's tree), the last check before the push | built; recorded in the PR description |
| Goldens | §13.3 | captured twice from `004f2c1f`, byte-identical; the comparison suite passes at every later head |

On Windows the Film Room suites pass except the two known load failures (SPR-RW-2: `tapeWiring.test.js` and `film-tape-backfill.e2e.test.js`, a CR in a shebang). Heavy film-tape rows can also time out under parallel load there; each passed alone. Linux is the record.

### 13.9 Fence statement

- Zero BUILD_RULES §1 edits. None of the branch's files is on the §1 list (checked by name over `24495eba..HEAD`).
- Not in the branch's diff: `api/cron/agent-evaluate.js`, `api/_utils/casualClone.js` and `api/_utils/trainingClone.js` (imported, not changed; `INHERITED_LOADOUT_FIELDS` as it was), `firestore.rules`, `firestore.indexes.json`, the hub's code (`src/components/CommandCenter/**`), and `src/config/featureFlags.js`.
- **No flag value changed.** `FILM_ROOM_CARDS_MODE` stays `'off'`. RK-2's new reader of `RELEASE3_CHARACTER_TAB_ENABLED` and `TEMPO_DIAL_ENABLED` needed no `featureFlags.js` pointer: the tests read both flags through mocked getters, never a value pin, and `flagPinGuard` passes.
- **Nothing new reaches into the hub's directory.** The hub's mount guard passes on every full run.
- **The census holds.** No model path reaches a ledger module. The new imports run outward from the ledger to the platform's resolver.
- No merge, no production write, no backfill, no refresh, no deploy, no flip.

### 13.10 Rulings asked

None blocks a merge. The first should be ruled before the cards flip.

1. **A null tempo is not only a casual clone (review KR2-1, Q).** RK-2's reason holds: the clone inherits no dial, so its tape records `tempoDesired: null`. But a ranked battle whose owner never set the dial records null too. The battle runs at the default `standard`; the snapshot stores `dials: null` (`api/_utils/leanRevalidation.js:314–316`).
   - **Built to RK-2's letter.** Every such player sees "No tempo setting was recorded for this battle." and never the link: exactly the players who have not found the dial yet. The sentence is true.
   - RK-2's "Later" clause has the same consequence. Carrying the dial to the clone makes the link appear only for players who have set a tempo.
   - Option (not built): tell the two apart by the tape's own `agentId`, a casual clone or not. On a ranked battle with no recorded tempo, the link would stay, since the dial does reach that agent.
2. **RK-9's attributed set (review KR3-3; built, §13.6 item 7).** Confirm that a seq the day's tape RECORDS (its tick row) disproves an "adjacent, day cannot be established" caveat, the same as a stored gap row does. The alternative keeps the caveat filter to the gap rows alone, as the fix bullet's "merged gaps" could be read. That alternative writes "(tickSeq 40) has no record" while tick 40's row is on the tape. The trigger, a tick record read after a later session began, is rare.
3. **The chart section's line while it shows no chart (review KR4-3; predates this round).** RK-11 holds by its letter: beside a charted symbol, "Chart recorded for {symbol}". In three states nothing is drawn, and the one-symbol section still carries the series status:
   - while the series loads ("Coverage · complete" above "Loading the tape…");
   - after a failed read ("Coverage · complete" above "The series for this day could not be read.");
   - beside an uncharted symbol on a partial or unavailable day (RJ-2 as built).
   Does RK-11's "never" cover the section while it shows no chart?
4. **The meeting maker's raw code (review KRV4-1; predates this round).** Every real gameplan swap carries `exitReason: 'gameplan_rotation'`, the only code that maps to the meeting. So the chart reads "Exit · 12:45 PM · by the gameplan meeting · gameplan_rotation", and the bought name likewise. Before RK-5 it read "Exit by the gameplan meeting · gameplan_rotation". RK-5 names the maker as "by the gameplan meeting". Keep the code after it (now pinned), or drop it on both names?

**Declared, not asked:** §13.6 items 1–6 and 8, KR4-5 (RK-5's shorter labels and A8's measured layout, harmless by reading), and KRV4-2 ("Chart recorded" over a series document with no bars, which the writer never stores; SPR-S-3, accepted under RK-12).
