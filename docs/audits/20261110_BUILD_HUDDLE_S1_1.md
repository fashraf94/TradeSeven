# Build report — Huddle S1.1 (smoke follow-ups, on for the cohort)

**Smoke preview (flag on in code, cohort from the Preview's `HUDDLE_PLAYER_UIDS`):** given in the PR and the handover (the branch `claude/huddle-s1-smoke` is force-pushed to this PR's head; its preview URL exists only after that push, so it cannot sit inside the commit it deploys).

| | |
|---|---|
| Build prompt | "BUILD — Huddle S1.1 (smoke follow-ups, on for the cohort)", issued Nov 10, 2026 |
| Specs | Amendment E (precedence E > C V1.2 > B > A > V1.1) and Fable's review of the S1 report, both committed byte-identical in this PR (SHA-256 in `docs/README.md`) |
| Branch | `claude/huddle-s1-1`, cut from `main` after `git fetch origin` · draft PR into `main` |
| Base | `main` @ `7f883c9c` (contains the PR #1032 merge; re-fetched before the final checks, unchanged) |
| Code head | `2846c6ca` (every check in §9 ran on it); the report and README rows are one docs-only commit on top |
| Review record | `docs/audits/20261110_HUDDLE_S1_1_BUILD_REVIEW.md` |
| Built by | Claude Code (Opus 5.5), Nov 10–11, 2026 |

## 1. In plain terms

- One confirm now covers every approach in play: your plan files into each live game under that game's own approach, and if an approach would change an item you see it first ("For your Trend Follower game: Fade BBB above 48.00 becomes Watch BBB").
- An earnings report no longer freezes the book: "no adds before" applies only to a print inside the session; a name reporting after the close gets its own line, "No adds to RKLB before its report".
- Shadow's script follows the seven new rules: spoken dates, publications by name, no word about a source it skipped, no calendar counts, your largest holding first, index figures cited, your approach in the third person.
- The voice reader was checked against one real ElevenLabs answer; a rate limit or server error now gets one retry inside the job.
- "In session" on the hub means the market is open, so "Huddle ready" no longer gives way to a game that hasn't started.
- The Huddle is on in code for the players listed in HUDDLE_PLAYER_UIDS only; unset or empty means no one, and everyone else sees the hub exactly as before.
- The review found 35 issues (none refuted outright); 26 are fixed, the rest are accepted, documented or put to you as the 5 questions at the end.
- Before merging: set Vercel Production HUDDLE_PLAYER_UIDS (your uid and FT_QA) and HUDDLE_SHADOW_VOICE_ID, after checking HUDDLE_PLAYER_UIDS isn't already set to something else. A cohort change takes effect on the next deployment, and is best made after the close.
- Smoke the preview on a weekday between 8:30 and 9:30 AM ET (earlier, the worker waits for 8:30): call the brief handler, then the worker. Check: one confirm files into your game running a different approach; "Huddle ready" leads; no earnings line freezes the book; the script fixes are audible; a non-cohort account sees the hub unchanged. After 4 PM ET call the worker once more on the preview, since crons don't run there and nothing else retires the plan.
- After merge, production makes the cohort's huddles every weekday at 8:30 AM ET: about 2 Sonnet calls and 1 voice call per player per day.
- Send this report to the Huddle chat and the Command Center chat before merging.

## 2. Verdict by section of Amendment E

| Section | Verdict | Where / note |
|---|---|---|
| E1 One confirm covers every archetype in play | Built | `confirmPlan.js` (one transaction, one confirmation per archetype in play; a per-archetype preview carrying each archetype's plan and rendered text, acknowledged by the second confirm; reconfirm files only the missing ones); `applyRules.js` `archetypesInPlayOf`; the status answer carries the missing list (empty where a reconfirm would be refused) and the hub's door reads it. Emulator rows incl. the founder's Nov 9 case from a read-only fixture. A spec gap is founder question 2 |
| E2 Earnings never freeze the book | Built, tests first | `events.js`, `planTemplates.js`: `NO_ADDS_BEFORE` only for a print inside the session's own window (`event_outside_session` otherwise, also on records frozen before E2 — two backstops, both pinned); the new line `NO_ADDS_TO_BEFORE_REPORT t` |
| E3 Seven script rules (a–g) | Built | at the input first (spoken dates, event ids without their date, publication names, no skipped source, no counts, tape items), then checked (four new forbidden patterns, narrowed by the review so honest sentences pass; the exposure order; tape citations); `SHADOW_VOICE_RULES_V1.md` updated |
| E4 Voice: the capture, one retry | Built | one real call (HTTP 200) committed key-stripped; the reader tested against it; `synthesizeWithRetry` |
| E5 The Wire's boundary row | Built in its own role (moved under a reading) | registered as an ATTRIBUTED READER: listing it in the consumer set literally fails that set's P2-41 row by design (it reads the collection itself) |
| E6 "In session" means the market is open | Built exactly as specified | `gamesDisplay.js` `inSession`, `nextAction.js:152`; five pins, row 2 failed on the old code |
| E7 The cohort; the flag on in code | Built | `gate.js` (fail closed), every server entry point (the worker returns before any read with no cohort), the hub's membership from its two readers (the history read only after a 200); byte-identical outside the cohort (jsdom pin, both layouts, incl. a member removed mid-session); the flip in one commit |
| E8 Hub items from the merge | Built | full-hub rows through the live layout, both arms, positive and negative; the flag-on harness at 360 px and desktop on main's layout (measured at `87c5df3b`, §8) |
| E9 The two A §A10 items | Built on the Huddle's path (a reading) | no enqueue and no claim before 8:30 AM ET in either DST state; no huddle on a holiday; the brief's own cron entry and handler untouched (hard rule 2) — the wider reading is founder question 4 |
| E10 Recorded, not built | Not built | — |

## 3. Files changed, and why

79 files against `main` at `2846c6ca` (+4,032 / −453; 13 added). No fenced file (BUILD_RULES §1) is in the diff; nor `api/cron/agent-evaluate.js`, `vercel.json`, `firestore.rules` or `firestore.indexes.json`.

**E7 — the cohort, the flag**
- `src/config/huddleFlags.js`, `huddleFlags.test.js`, `src/config/flagPinGuard.test.js` — the flag on in code, its pin and its guard entry in one commit; the docblock names the two reads every player still makes and the rollback's timing.
- `api/_utils/huddle/gate.js` (+ new `gate.test.js`) — `huddleCohortOf`, `isHuddleLive`, `huddleAdmits`; unset, blank or comma-only is the empty cohort, which means no one.
- `api/_utils/huddle/routeKit.js` — no cohort → the flag-off 404 before any middleware, header or read; a signed-in uid outside the cohort → the 404 body after auth, before any read.
- `api/huddle/audio/[token].js`, `api/_utils/huddle/playback.js` — the token's owner is checked against the cohort right after the index read (an expired token of a non-member is a 404 too).
- `api/cron/huddle-worker.js` (+ new `huddle-worker.test.js`), `api/_utils/huddle/worker.js`, `players.js`, `sweep.js`, `api/cron/compute-daily-regime-brief.js` — the worker, enqueue, reconcile pass, drain and sweep act only for cohort uids and read nothing with an empty cohort; no active member, no shared layer; the brief's huddle stage runs only with a live cohort (its marker still written).
- `src/hooks/useHuddleToday.js`, `src/components/CommandCenter/hub/huddleView.js`, `CommandCenterHub.jsx` — the Huddle only on positive evidence from the two readers; a 404 is "outside"; the history read waits for a 200; the sheet slot is freed when membership lapses.
- `api/huddle/status.js`, `skip.js`, `playback-token.js`, `event.js`, `api/_utils/__fixtures__/promptHonestyRegistry.js`, `.env.example` — comments and descriptions that named only the flag.

**E1 — one confirm per archetype in play**
- `api/_utils/huddle/applyRules.js` — `archetypesInPlayOf`, `battleInPlay` (decideApplication's checks, the agent check included), `missingArchetypesOf`; receipts read per archetype.
- `api/_utils/huddle/confirmPlan.js` — rewritten: one transaction appends one confirmation per supported archetype in play; previews; reconfirm files only the missing ones and refuses an edit (409); `plan.confirmed` is the equipped archetype's newest; `reconfirmStateOf` for the status answer.
- `api/_utils/huddle/archetypeWords.js` (new) — archetype names through `archetypeRegistry` (no §2.3 importer).
- `api/huddle/confirm.js`, `api/huddle/status.js`, `api/_utils/huddle/applyPlan.js` — the acknowledgement in; the missing list out; the reconcile looks up each archetype's confirmation.
- `src/components/CommandCenter/hub/hubCopy.js`, `HuddleSheet.jsx`, `src/components/Huddle/HuddleSheetBody.jsx`, `sections/DeploySection.jsx`, `src/services/huddleService.js` (+ new `huddleService.test.js`) — the reconfirm line, the preview lines (with the card's level; kept through a failure, dropped on an edit or a Skip), the acknowledgement sent, the door only while a reconfirm would file, the same door on Partnership's game line.

**E2 — earnings never freeze the book**
- `api/_utils/huddle/events.js`, `planTemplates.js`, `planRecord.js`, `records.js`, `sharedLayer.js`, `gather.js`, `job.js` — `NO_ADDS_BEFORE` only for a timed macro print inside the session window; earnings refused by id; the window checked on the id's own time; `NO_ADDS_TO_BEFORE_REPORT t`; the window and report tickers frozen into the plan's context; the earnings read spans today to the next session.

**E3 — the seven script rules**
- `api/_utils/huddle/spoken.js` (new), `api/_utils/evidence/publicationNames.js` (new), `api/_utils/evidence/packItem.js`, `api/_utils/huddle/gather.js` — spoken dates, publication names, no skipped source in the input, no calendar counts, tape items with their figures; the per-symbol evidence fetch injectable for its rows.
- `api/_utils/huddle/scriptPrompt.js` — the prompt rewritten; event ids shown without their date and mapped back; four new forbidden patterns (archetype names anchor the widened person rule); `exposure_order`, `tape_uncited`; publication names never read as tickers; per-failure regeneration hints; effort `medium`.
- `api/_utils/huddle/job.js` — the new inputs; the first answer's failures kept on a regeneration.
- `docs/design/SHADOW_VOICE_RULES_V1.md` — E3 a–g and the enforcement table.

**E4, E5, E6, E8, E9**
- `api/_utils/__fixtures__/elevenLabsTimestampsCapture.js` (new); `api/_utils/huddle/speech.js`, `job.js` — the capture; `synthesizeWithRetry`.
- `api/_utils/agentSafeWireEntry.boundary.test.js` — the Wire's reader in its own attributed role.
- `src/components/CommandCenter/hub/gamesDisplay.js`, `nextAction.js` — `inSession` from the market phase.
- `CommandCenterHub.huddle.jsdom.test.jsx` — the Reconfirm line through the live layout.
- `api/_utils/huddle/worker.js` — `startReached` (8:30 AM ET) on enqueue and drain.

**Docs (first commit)** — Amendment E and Fable's review byte-identical; `docs/README.md` rows and the precedence line. **Last commit:** this report, the review record's row, this report's row.

**Tests** — new: `gate.test.js`, `scriptRules.e3.test.js` (replaying Run A, Run B and the Nov 9 script, plus the review's look-alike rows), `CommandCenterHub.huddleCohort.jsdom.test.jsx`, `api/cron/huddle-worker.test.js`, `src/services/huddleService.test.js`, `test/rules/__fixtures__/huddleFounderNov9.js`; changed: the rows in §4.

## 4. Every pin, golden, guard and allowlist entry touched — and the test that required it

| Entry | File | Required by | What changed |
|---|---|---|---|
| The flag's value pin | `src/config/huddleFlags.test.js` | `src/config/flagPinGuard.test.js` (a flag and its pin move together, BUILD_RULES §2) | pinned `true`; the registration row turned around (no longer dark by design; the "intentionally ABSENT" note present) |
| Dark-by-design entry | `src/config/flagPinGuard.test.js` `DARK_BY_DESIGN` | the guard's own "drop the entry in the same commit" | removed; an "intentionally ABSENT" comment in its place (the ACTIVATION_EVIDENCE precedent) |
| The flag's docblock | `src/config/huddleFlags.js` | BUILD_RULES §2 (text calling the old value the default moves with the flip) | "DARK" → "ON IN CODE, FOR A NAMED COHORT ONLY", with the reads that remain and the rollback |
| Protected-store write count | `api/_utils/compositionProtectedStoresAllowlist.json` | `compositionProtectedStores.scan.test.js` (the Linux full suite at `b8f6759a`) | `confirmPlan.js::confirmPlan::update::unresolved` 3 → 4, note `_notes_huddle_s1_1` (E1's preview keeps the player's edit, inside the confirm transaction, on the huddle record only) |
| Receipt words, the copy guard | `src/components/CommandCenter/hubCopy.huddle.guard.test.js` | the guard pins the receipt words | `staleApproach` lost its built-in " · Reconfirm" (the door is added only while a reconfirm would file); the new line pinned; the applicable patterns gain `iso_date`, `calendar_count`, `archetype_person`, `source_outage`; the preview line sampled in every branch (review HU-8) |
| The rows E6 moves | `hub/huddleView.test.js`, `CommandCenterHub.huddle.jsdom.test.jsx` (L3-1 with the market open) | C §C6 ("every row the new order moves is re-pinned in the same commit") | re-pinned; a new L3-11 row |
| A preview row's text | `Huddle.jsdom.test.jsx` (the E1 preview row) | review HU-6, HU-10 | "Fade BBB" → "Fade BBB above 48.00"; the fixture's archetype is the Trend Follower (whose row really changes a FADE) |
| Brief handler marker rows | `api/cron/compute-daily-regime-brief.test.js` | its rows ran on the real flag, now true | the flag held by a getter; three fail-closed states and one live row |
| Dark-route rows | `api/huddle/routes.dark.test.js` | the same | flag off; flag on with no cohort (touches nothing, no headers); an outsider (404 after auth, no read); a control |
| Sweep, audio, worker, queue rows | `sweep.test.js`, `audio.test.js`, `worker.test.js`, `test/rules/huddleQueue.rules.mjs` | E7's fail-closed default | each passes its cohort; cohort rows added; the E9 enqueue rows count players before the shared layer (review HC-7) |
| Event-window seeds | `huddleConfirm.rules.mjs`, `huddleQueue.rules.mjs`, `planTemplates.test.js` | E2 (no window, no eligible event) | the seeds pass the session's window |
| The preview's exact shape | `huddleConfirm.rules.mjs` | review HD-11 | each preview carries `current` and `renderedText` |
| Script prompt pins | `scriptPrompt.test.js`, `gather.test.js`, `evidence.test.js` | E3 | effort `medium`; the regeneration hints; no count or ISO date in the input; skipped sources silent; a headline's publication name; `PACK_KINDS` gains `tape` |
| Job timings | `huddleQueue.rules.mjs` | E4 | `speechAttempts` pinned |
| The Wire boundary | `agentSafeWireEntry.boundary.test.js` | E5 (R-20) | a new ATTRIBUTED_READERS role with four rows; the consumer set unchanged |
| The prompt-honesty registry's note | `api/_utils/__fixtures__/promptHonestyRegistry.js` | review HC-9 (its "dark" note was stale) | the note only; the registry's lists unchanged |

**Not touched:** no golden file; no fenced file; `vercel.json` (45/100 crons stands); `firestore.rules`, `firestore.indexes.json` (the status route's new reads are the existing agents and active-battles query shapes); the mount guard and the activity guard (no new reader, listener, effect, timer or import edge — the sheet close is a render-time state change of the layout's own sheet slot); `archetypeImportBoundaryBaseline.json` (archetype names come through `archetypeRegistry`; `scriptPrompt.js` imports the zero-import `dissentTable.js` and `archetypeWords.js`).

## 5. The voice capture (E4, R-17)

One with-timestamps call — the build's only ElevenLabs call (rule 5) — at 2026-11-10 20:27:31 UTC through the real helper, the key from `.env.local` read by name (it travels in a header only; the saved body holds no byte of it). Voice: the academy voice `pNInz6obpgDQGcFmaJgB` (R-17 allows it while Shadow's is not chosen; `HUDDLE_SHADOW_VOICE_ID` is not set locally). Text: `joinBeats()` of two short beats, one with numerals — 136 characters, the "\n\n" between beats included. The raw body was written to disk before the helper parsed it. Committed, key-stripped, as `api/_utils/__fixtures__/elevenLabsTimestampsCapture.js`.

| Finding | Observed |
|---|---|
| Status, time | HTTP 200, `application/json`, 1,600 ms |
| Top-level keys | exactly 4: `alignment`, `audio_base64`, `normalized_alignment`, `quality_check` (null) |
| `alignment` | 3 arrays (`characters`, `character_start_times_seconds`, `character_end_times_seconds`), each 136 long — equal to the text: the characters joined are the text exactly, the beat separator included. The reader's length check holds and the beat bounds compute: tape 0–5,793 ms, plan 6,177–14,768 ms; duration 14,768 ms. Seconds with three decimals |
| `normalized_alignment` | not the text (a leading and a trailing space, the separator collapsed to one space: 137 characters). The reader never reads it; a row proves bounds read from it would be refused, never wrong |
| Audio | an MP3 of 237,443 bytes (base64 316,592 characters; truncated to 64 in the fixture) |
| The reader | reads `audio_base64` and the three alignment arrays only — a source-scan row pins it to the keys the capture has |

The key the S1 build had was the key's ID; the key now in `.env.local` is a real key (`sk_` form, checked without printing). The founder's Nov 9 huddle was voiced (80.9 s, timed), so the Preview's key and voice worked on the smoke too.

**The retry (R-19).** `synthesizeWithRetry`: on a 429, a 5xx or an attempt that outlives its own 30 s timeout, one retry after a 2 s wait, only with at least 15 s of the job's deadline left after the wait; no model call; each attempt's controller chained to the job's signal; the job's own deadline never retried (three guards, each with its own row). A second failure publishes the day text-only, as before. The job records `timings.speechAttempts` and, after a retry, `speech_retried:{first failure}`.

## 6. The founder's Nov 9 and Nov 10 huddle records (read-only, rule 6)

Admin SDK `get` only, no write; the uid is `FOUNDER_UID` in every saved file (asserted: none left).

**Nov 10: no record** (the Preview's cohort ran only on Nov 9's smoke).

**Nov 9 — generation fields**

| Field | Value |
|---|---|
| status | `ready` |
| claimGeneration | 1 |
| regenerated | `true` — the first answer failed a check; S1 did not keep which (S1.1 records it: `regeneratedFor`) |
| model | `claude-sonnet-5-5` |
| tokens (in/out) | first 5,976 / 951; second 6,021 / 1,025 |
| sourceFailures | `["newsfilter:skipped"]` (why the script said "Newsfilter was not checked" — E3 a) |
| drops | `[]` |
| timings (ms) | gather 4,265 · script 17,520 · speech 5,968 · store 632 · total 29,153 |
| audio | 80,852 ms voiced, timed, `eleven_multilingual_v2` |
| plan | generated under `contrarian`; HOLD CCI · WATCH RKLB · `NO_ADDS_BEFORE earn:RKLB:2026-11-09:amc` (the line E2 removes) |
| confirmations | `contrarian` 18:34:45 UTC; `diversifier` 18:51:37 UTC — the same revision confirmed twice (the smoke's E1 finding) |
| application | one, written by the confirm, to the Nov 9 game (diversifier) |
| measurement | listened 18:33:26 UTC; confirmed 18:34:45 UTC; 0 edits |
| evidence | 7 holdings, 1 opener, 8 closes, 11 headlines, 1 source status, 8 events (8 of 256 calendar rows listed — the "256" E3 f removes) |

**Agents and battles (for the E1 fixture).** The ranked agent switched from Contrarian to Diversifier on Nov 9; the casual clone is a Contrarian (the Nov 10 game); seven training clones. Of 118 battles, two matter: Nov 9 (Diversifier, completed) and Nov 10 (Contrarian, active). `test/rules/__fixtures__/huddleFounderNov9.js` rebuilds the Nov 9 case: equipped Diversifier, a game frozen Contrarian → one confirm files both.

## 7. The verification scripts, verbatim (rule 5: 4 Sonnet calls)

Generated at the E3 commit's prompt (before the review's pattern changes). N9: the founder's Nov 9 inputs replayed under the Contrarian, 1 call (5,905/1,145 tokens, 11.1 s), clean first answer. B2: S1's Run B inputs (Nov 2) under the Diversifier, 1 call (5,062/845, 6.8 s), clean. C2: the same inputs under the Trend Follower, 2 calls (5,070/809; 5,116/903) — the first regenerated for `armor: forbidden:confirmation` on "it wants to see price confirm before leaning in" (§11). All three published scripts pass every final pattern (replayed offline at `2846c6ca`).

**N9**
> **The tape** — The prior session's picture, Friday, November 6, was a correction regime with thinning breadth and normal volatility. Technology led and Consumer Staples lagged. Your name RKLB reports after the close today. [EODHD earnings calendar]
>
> **Your names** — Start with CCI, your largest holding: it closed at 88.60 on Friday, November 6, and Yahoo Finance reported on Friday that Crown Castle will present at a Morgan Stanley conference. [EODHD daily bars; Yahoo Finance via EODHD] I read that as routine, nothing to act on. [Yahoo Finance via EODHD] RKLB closed at 53.07 on Friday and reports after the close today. [EODHD daily bars; EODHD earnings calendar] Yahoo Finance reported on Sunday that billionaires are loading up on space stocks, and Seeking Alpha listed RKLB in its earnings week ahead. [Yahoo Finance via EODHD; Seeking Alpha via EODHD] My read: hold, and don't add into the print. [EODHD earnings calendar] On MDT, which closed at 101.80 Friday, Yahoo Finance reported on the SPYRAL AFFIRM results and a blood pressure trial. [EODHD daily bars; Yahoo Finance via EODHD] Those are reports, not verdicts, and I'd keep it as is. [Yahoo Finance via EODHD]
>
> **The armor's take** — Your Contrarian thinks the Sunday space-stock enthusiasm is crowding into RKLB, so it would not chase before the report. [Yahoo Finance via EODHD] It likes the quiet defensive names the market is shrugging at.
>
> **The game plan** — Here's what I'd carry in today: hold CCI; watch RKLB; hold MDT. One line: no adds to RKLB before its report.
>
> *Names:* CCI — Largest holding. Yahoo Finance reported a conference presentation notice on Friday; nothing that changes the picture. · RKLB — Reports after the close today; the name to be careful with. · MDT — Several Yahoo Finance headlines on a blood pressure trial; a mild positive read, not a catalyst.

**B2**
> **The tape** — Happy Monday. The ISM manufacturing data is scheduled for 10:00 AM ET today. [macro calendar]
>
> **Your names** — CCI is your largest holding, and all I found is its Friday, October 30 close of 88.69, with nothing else found in the sources we checked. [EODHD daily bars; your game] LLY is also marked as a largest holding, and it closed at 1417.54 on Friday, October 30, with nothing else found on it. [EODHD daily bars; your game] On CVX, FantasyTimes reported on Friday at 4:00 PM ET: Chevron Crushes with 10.5% EPS Surprise; Oil Giant Keeps Streak Alive. The Friday close was 235.52, and my read is that it supports the ballast role your agent gave it. [FantasyTimes; EODHD daily bars]
>
> **The armor's take** — Your Diversifier likes that the book spans real estate, healthcare and energy, so no single headline can sink it. The Diversifier would keep spreading the weight and not lean harder on one name. [your game]
>
> **The game plan** — Here's what I'd carry in today: hold CCI; hold LLY; hold CVX. One line: no adds before the 10:00 AM ET ISM manufacturing data.
>
> *Names:* CCI — Largest holding; only the Friday close turned up, nothing else found in the sources we checked. · LLY — Also marked largest; only the Friday close turned up. · CVX — FantasyTimes reported a Chevron earnings surprise on Friday.

**C2** (the published, second answer)
> **The tape** — None of your names are down to report today in what we checked. [macro calendar] The 10:00 AM ET ISM manufacturing data is scheduled today. [macro calendar]
>
> **Your names** — Starting with CCI, your largest holding: nothing found on it in the sources we checked, and it closed at 88.69 on Friday, October 30. [your game; EODHD daily bars] LLY, also a star holding, had nothing found either, and it closed at 1417.54 on Friday. [your game; EODHD daily bars] On CVX, FantasyTimes reported on Friday at 4:00 PM ET that Chevron crushed with a 10.5% EPS surprise; that is their claim, and it closed at 235.52 that day. My read is it is worth watching, not chasing. [FantasyTimes; EODHD daily bars]
>
> **The armor's take** — Your Trend Follower wants momentum to show itself first, so with nothing found on CCI or LLY, it would stay patient and wait for the ISM data at 10:00 AM ET before pressing anything. [macro calendar]
>
> **The game plan** — Here's what I'd carry in today: hold CCI; hold LLY; watch CVX. One line: no adds before the 10:00 AM ET ISM manufacturing data.
>
> *Names:* CCI — Nothing found on it in the sources we checked; it is held as a star position and closed at 88.69 on Friday. · LLY — Nothing found on it either; it closed at 1417.54 on Friday. · CVX — FantasyTimes reported a 10.5% EPS surprise on Friday at 4:00 PM ET; I read that as a report, not a fact.

Observations: B2's "also marked as a largest holding" leaks the prompt's NAMES marker wording; C2's armor names a clock time for the archetype, which `agent_clock` does not catch (it looks for "agent"); headline titles reach the model with HTML entities (`&amp;`).

## 8. Hub contract (C §C7's section) for E6–E8, and the entry chunk

| Rule | Held / moved | How it is pinned |
|---|---|---|
| C6's ordering input "a game in session" | **Moved under E6's ruling** (L3-11): `inSession` is the market phase LIVE; the next-action rule reads `row.inSession === true` (`nextAction.js:152`). `preOpen`, the clock, the strip and the title unchanged | five E6 rows in `nextAction.test.js` (row 2 failed on the old predicate: `openGame:bb_multi` above `huddle`); the L3-1 hub row re-pinned with the market open; a new L3-11 hub row; mutants HM-25a/b, HM-26 killed |
| C7 one reader per record, no read per tab switch, no poll; refresh on sheet open, confirm/skip, visibilitychange | **Held.** No new reader, listener, effect or timer (the mount and activity guards unchanged). One change of *when*: the history reader runs only after today's status read has answered 200 (review HC-5) | the guards; cohort rows "the history query is never made" (both layouts) |
| C7 nothing the root deploy provider imports reaches the Huddle service | **Held** | the mount guard's provider row; the entry chunk below |
| C4 the chip; C8 the sheet, Partnership, activity; C14 | **Held**, shown only to a member (E7) — outside the cohort the hub is its flag-off self, byte for byte | `CommandCenterHub.huddleCohort.jsdom.test.jsx`: six outside states × two layouts byte-identical to the flag-off render; a member removed mid-session byte-identical; the sheet closes and stays closed (HU-4) |
| C15's Deploy card line | **Moved under E1's hub bullet**: shown only while an archetype in play lacks a confirmation — the status answer's `plan.reconfirm.missing`, the server's own acceptance predicate (empty where a reconfirm would be refused, HD-12); as fresh as the last status read (HU-1, reported) | E8 rows; `huddleView.test.js`; Partnership's game line carries the same door (HU-5) |
| E8 (a) the Reconfirm line through the live layout | **Built** — full-hub rows, desktop and phone, positive and negative | `CommandCenterHub.huddle.jsdom.test.jsx` E8 block; mutants on the flags-on arm and `PhoneTabs.jsx` killed (HM-31a/b/d); the flag-off loadout arm is never rendered under the shipped flags (HM-31c) |
| E8 (b) the flag-on harness at 360 px and desktop on main's layout | **Measured at `87c5df3b`** (headless Edge): the chip 87×44 px at both widths, no horizontal overflow, the sheet's focus on Close and Escape closing it, the Reconfirm line visible (360: 298×62; desktop: 326×39), its door opening the sheet focused on Reconfirm, the game line "BaggerBomb game · Confirmed under a different approach · Reconfirm"; outside the cohort no chip, no "Huddle", the reserved Partnership text. The hub changes since are covered by jsdom rows (§12) | — |

**Entry chunk (sourcemap attribution, `vite build --sourcemap`, Linux), `main` `7f883c9c` → code head `2846c6ca`:**

| | `main` | head |
|---|---|---|
| Entry chunk | `index-CbUjkGfv.js`, 4,948,812 bytes | `index-BCChOS0I.js`, 4,948,812 bytes |
| `src/` sources in it | 713 | 713 (no Huddle source; the CommandCenter sources are the gate, the chrome and the selectors, as on `main`) |
| Hash-masked content | `4af0c7990e652249` | `4af0c7990e652249` — identical (only the lazy chunks' hashed names differ) |
| Exported locals | 592 | 592, the same set |
| Hub chunk (`CommandCenterHub-*.js`, lazy) | 175,239 bytes | 192,884 bytes (+17,645: the Huddle surfaces it already carried dark, now live, and E1's preview and door) |

## 9. Tests and the review

All on Linux (WSL, Node 20.20.2, `TZ=UTC`, `--maxWorkers=8`, under `flock`), at the code head `2846c6ca`, each exit code asserted and the summary lines read from the log:

| Run | Exit | Summary |
|---|---|---|
| Full suite, flag on (as shipped) | 0 | `Test Files  1392 passed \| 9 skipped (1401)` · `Tests  30492 passed \| 107 skipped (30599)` |
| Full suite, flag and pin off (the rollback) | 0 | `Test Files  1392 passed \| 9 skipped (1401)` · `Tests  30492 passed \| 107 skipped (30599)` — on a quiet machine. The first attempt, run while the machine was loaded, failed one row on a 5,000 ms timeout (`backingBetaFlags.test.js`, a tree-scan importer ratchet that does not read the Huddle flag); that file then passed 3 of 3 alone with the flag off |
| Control: the flag alone off, the pin left on | 1, as designed | the two flag files: `Test Files  2 failed (2)` · `Tests  2 failed \| 8 passed (10)` — exactly the pin row and `flagPinGuard`'s contradiction row |
| Firestore rules emulator suite, flag on | 0 | `Test Files  40 passed (40)` · `Tests  734 passed (734)` |
| Firestore rules emulator suite, flag and pin off | 0 | `Test Files  40 passed (40)` · `Tests  734 passed (734)` |
| `npm run lint:gate` | 0 | — |
| `vite build` | 0 | entry `index-BCChOS0I.js` 4,948.81 kB |

The default lint config over the PR's changed files reports 5 errors, all present on `main` unchanged (four `react-refresh/only-export-components` in `CommandCenterHub.jsx`, one unused `opener` in `gather.js`); none is new.

**The review** (record: `docs/audits/20261110_HUDDLE_S1_1_BUILD_REVIEW.md`). Three lenses on a snapshot of `87c5df3b` — HC (the cohort, fail closed, and the R-6 trace), HD (the server domain), HU (the hub) — then a refuter for every finding, then the mutation lens on the fixed head. **35 findings: 29 CONFIRMED, 6 PARTLY, none refuted outright** (three sub-claims refuted). **26 fixed**, each with a row that fails on the reviewed code or with the fix reverted; 3 accepted and documented; 4 reported without change (three are founder questions 2, 3 and 5); 2 comment-only. One lens blocker (HD-1: "CNBC" and "PR Newswire" read as tickers) — fixed. **Mutation lens: 73 mutants, 69 killed;** of the 4 survivors, 2 were real gaps, killed by rows added after it; 1 is equivalent; 1 sits in a branch the shipped flags never render.

## 10. Questions for the founder (with recommendations)

1. **R-6: does the cohort flip need a fenced-file review?** The flip turns on, for the cohort, the path from a confirmed plan into the battle's directive slot and from there, verbatim, into the fenced evaluation prompt (`buildLiveContextBlock`, while `ARCHETYPE_INTEGRITY_MODE` is `enforce`). The HC lens traced it read-only: no model-written free text reaches it, only fixed templates carrying values from closed sets (universe tickers, five stance kinds, numeric levels, server-labelled macro events); the thread id carries the player's uid into the prompt. BUILD_RULES §1's EXA precedent calls a flip that changes what reaches the fenced assemblers fence contact needing review. *Recommendation:* treat it as that review's subject before merge — the trace (review record, "R-6 trace") is its input; the reviewer signs it or asks for the uid to leave the thread id (S1's id format, used by the receipts).
2. **HD-2: the equipped approach's change rides into every other approach's game.** The plan card is validated at generation under the equipped approach; E1 then files that already-changed plan into every approach in play. Equipped Trend Follower with an Analyst game: the Analyst game gets "Watch AAA" though the Analyst would keep "Fade AAA", with no preview; the reverse pairing previews correctly. Every row only moves a stance toward Watch, so the bend only ever lowers risk. *Recommendation:* accept for the cohort; in S1.2 keep an approach-neutral plan from generation and derive each approach's version from it (each change then shows as an E1 preview).
3. **Removing a player, emptying the cohort or rolling back mid-session leaves that day's filed plans in their games** until each battle completes (the close-time retirement keeps to the cohort, as the flag off does; battles are single-day and evaluations stop at the close; chat, voice and research read the slot until then). A cohort change also needs a redeploy. *Recommendation:* change the cohort or roll back after the close (now in the flag's rollback text); in S2 let the close-time retirement run for any uid holding a filed plan.
4. **E9's wider reading.** Built: no enqueue and no job claim before 8:30 AM ET in either DST state, and no huddle on a market holiday (that skip already existed). Not built: the brief's own cron still runs at 7:30 AM ET in EST and on weekday holidays (one Sonnet call each), because A §A10 moves "the DST pin and the trading-day skip for the brief" to the flip PR with the brief-card removal, and hard rule 2 keeps the handler untouched. *Recommendation:* keep it for that PR.
5. **What a player outside the cohort pays, and a member's failed first read.** Every signed-in player's hub makes one status request on mount and on each return to the tab (a 404 before any database read for a non-member); the plan history query runs only after a 200. A member whose first status read fails (a 5xx, a network error) sees the hub as it was before the Huddle — a 401 or a network error reaches non-members too, so the hub cannot tell the two apart without showing the Huddle to an outsider. *Recommendation:* accept both; revisit if a member reports the Huddle missing on a bad connection.

## 11. Out of scope, and noticed

- **E10** (recorded, not built): unchanged.
- **The build prompt's exclusions:** the newsroom phantom-key readers, the bench RVOL stamp, `fetchRecentNews`'s missing composite — not touched.
- **Noticed, not fixed:**
  - The S1 forbidden pattern `confirmation` (`/\bconfirm/i`) refused an ordinary trading sentence in the verification run ("it wants to see price confirm before leaning in"), costing a regeneration. Narrowing it is a voice-rules change outside E3.
  - The Trend Follower run (C2) gave the archetype a clock time ("wait for the ISM data at 10:00 AM ET"), which `agent_clock` does not catch.
  - Headline titles reach the model with HTML entities (`&amp;`).
  - The status route reads the day's record twice per request (review HR-HU-11).
  - The Wire's evidence module is reachable transitively from `agent-evaluate.js` through the sweep (functionally inert), and `decide.js` reads the stories collection directly (review HR-HD-14): E5's "the trading brain never reads the text" holds for the Huddle reader's output only.
  - On Windows, a few src/config scan rows timed out once under a loaded parallel run and passed alone; the Linux suite is the authority (§9).

## 12. What was not verified

- **No production run.** Crons do not run on Vercel previews; the cohort's first worker and brief runs happen in production after merge. The founder's preview smoke (§1) is the first real end-to-end run of S1.1.
- **The E3 changes made after the four Sonnet calls** (the review's pattern narrowing, the publication-name scrub, the event-id aliases) were checked offline only — against the three saved answers, the Nov 9 script and the replay rows — never against a fresh model answer (the spend cap was reached).
- **The voice retry** was exercised with stubs; the one real call succeeded first time.
- **Vercel's environment behaviour** (a cohort change needs a redeploy) is from Vercel's documented model, not observed.
- **The flag-on harness** at 360 px and desktop was measured at `87c5df3b`; the hub changes since (the history read's gate, the sheet closing on a lapse, the Partnership door, the preview line's level) are covered by jsdom rows, not re-measured in a browser.
- **Whether EODHD links CNBC or PR Newswire stories at all** (HD-1): the committed `/news` capture shows only Yahoo Finance and Seeking Alpha.
- **A real ranked battle's `timing.tradingDays`** (the re-pinned L3-1 fixture): not checked against production data.
