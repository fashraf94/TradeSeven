# Huddle S1.1 — BUILD_RULES §2 review record

Branch `claude/huddle-s1-1` (from `main` @ `7f883c9c`). Reviewed tree: `87c5df3b` (71 files, +3,356 / −419). Fixes on top of it: `8337e29e`, `14933af5`, `70983e18`, `52193be8`. Build report: `docs/audits/20261110_BUILD_HUDDLE_S1_1.md`. Review ids use the prefixes HC, HD, HU (lenses), HR (refuters) and HM (mutation lens); none was used by an earlier review.

## How it was run

- **Snapshots.** One `git archive` extraction of `87c5df3b` per lens (`scratchpad/review/{hc,hd,hu}`), `node_modules` linked; each reviewer wrote only inside its own snapshot (`_review\`, `_refute*\`, `_hm\`), never in the working tree or git. Emulator rows ran on private ports (8291, 8293, 8295, 8297).
- **Lenses.** HC: the cohort and the fail-closed guarantee (E7, build prompt hard rule 2), with a read-only trace of the confirmed plan → battle slot → fenced assembler path (R-6). HD: the server domain, E1–E5. HU: the hub, E1's hub bullet, E6, E7's hub bullet, E8.
- **Refute pass.** Every finding went to a refuter told to refute it with a concrete repro. The refuters were grouped by lens — one for HC, two for HD (1–5, 6–14), one for HU — each checking every finding on its own, with its own repro, on the lens's snapshot. (The precedent ran one refuter per finding; grouping kept the cost down and is disclosed here.) All four were interrupted once by an account rate limit and resumed from their saved state after the reset.
- **Result.** 35 findings: 29 CONFIRMED, 6 PARTLY CONFIRMED, none refuted outright. Three sub-claims were refuted: HC-8's first half, HD-2's "dissent lost on confirm is an E1 regression", HU-1's "regression against main".
- **Fixes.** Each fix carries a row that fails on the reviewed code or with the fix reverted, checked by the builder before each commit (the mutants are listed with each fix in its commit message and below).
- **Mutation lens.** Last, on its own snapshot of the fixed head `52193be8`, with its own emulator — see the end.

### Lens HC — the cohort, fail closed

| Id | Lens severity | Refute verdict | Disposition |
|---|---|---|---|
| HC-1 | note (ruling) | PARTLY — real: removing a uid or emptying the cohort strands that day's filed plans (all three close-time retirement paths keep to the cohort); the flag-false leg is older than S1.1 and emptying strands exactly as the flag off does; small impact (battles are single-day, evaluations stop at the close; chat, voice and research read the slot until the battle completes). HR-HC-1: the build went beyond E7 by filtering the reconcile pass by cohort | **Founder question 3.** The rollback and removal timing written into `huddleFlags.js` and `gate.js` (`14933af5`): change the cohort or roll back after the close. |
| HC-2 | should-fix | CONFIRMED — no test imports the cron handler; deleting its gate costs ~3 reads per tick (~900 per weekday), nothing fails | **Fixed `8337e29e`**: `api/cron/huddle-worker.test.js` (flag off; flag on with the cohort unset, empty, blank, commas; a control; 401); `runWorkerInvocation`, `runReconcilePass` and `drainQueue` return before any read with an empty cohort (each early return killed by its own row). |
| HC-3 | nit | CONFIRMED — with a non-empty cohort an outsider can get 405 / 200 (OPTIONS) / 401 / 429 and a 404 with security headers | **Accepted**, written into `routeKit.js`'s header (`14933af5`): the body is the flag-off body; the hub never sends those requests. |
| HC-4 | nit | CONFIRMED — an expired token of a non-member answered 410 after two reads | **Fixed `14933af5`**: the cohort is asked right after the index read (`resolvePlaybackToken({ admits })`); the expired non-member is the flag-off 404 and the record is never read. Row fails on `87c5df3b`. |
| HC-5 | note, cheap fix | CONFIRMED — every non-member paid a history query per hub mount for nothing | **Fixed `8337e29e`**: the history reader runs only once today's status read has answered 200. Rows: outside (404) and a failed read make no history query (both layouts). |
| HC-6 | nit | CONFIRMED — `reason: 'no_cohort'` where the flag off answers `'flag_off'`; no read | **Accepted** (the distinct reason tells the cron log why); pinned in the handler test. |
| HC-7 | nit | CONFIRMED (by reading) — an active cohort of no one still made the EODHD earnings call | **Fixed `14933af5`**: players are counted first; none, no shared layer. |
| HC-8 | nit (test gap) | PARTLY — first half REFUTED (`Huddle.jsdom.test.jsx` "E7: the status route's 404 …" already kills the order flip); second half (the sheet slot after a lapse) confirmed by reading = HU-4 | A hub-level ready → 404 row added anyway (`8337e29e`); the second half fixed with HU-4 (`52193be8`). |
| HC-9 | note | PARTLY — (a) the comment's "next invocation" ignores that Vercel applies an env change on the next deployment; (b) pre-merge: the S1 meaning of `HUDDLE_PLAYER_UIDS` was "unset = everyone"; (c) E9 holiday skip pre-existed, the 8:30 AM ET pin is the new part, the brief's own items stay unbuilt; (d) stale "404 while the flag is off" comments (+ `event.js`, found by the refuter) | (a), (d) **fixed `14933af5`** (also `promptHonestyRegistry.js`'s "dark" note). (b) is a founder step before merge (report §1). (c) is founder question 4. |

**R-6 trace (HC, read-only).** No model-written free text reaches the slot or the fenced assembler: `renderPlan` writes fixed templates; the values the model or the player chose reach it inside them (universe tickers, kinds, numeric levels, server-labelled macro events). The battle's `directive` is pushed verbatim by `controlPromptRenderer.renderDirectiveBlock` into the fenced `buildLiveContextBlock` while `ARCHETYPE_INTEGRITY_MODE === 'enforce'`, with the thread id `plan:{uid}:{etDate}:{revision}` — the player's uid reaches the evaluation prompt. BUILD_RULES §1's EXA precedent treats a flip that changes what reaches the fenced assemblers as fence contact needing fenced-file review: **founder question 1.**

### Lens HD — the server domain (E1–E5)

| Id | Lens severity | Refute verdict | Disposition |
|---|---|---|---|
| HD-1 | blocker | CONFIRMED (refuter: should-fix, blocker a judgment) — "CNBC" and "PR Newswire" said by name fail the ticker scan: the regeneration, then `ticker_outside_universe`; on a card, the name dropped | **Fixed `8337e29e`**: the scan takes the map's publication names out first (`tickerishOf`); a row per map value (beat and card), and a bare "PR" still refused. |
| HD-2 | should-fix (ruling) | PARTLY — the bend is real and new on the ordinary path (S1 filed nothing into the other game): the equipped archetype's dissent row, applied at generation, rides into every other archetype's confirmation, and the result depends on which one is equipped; every row moves a stance toward WATCH; a spec gap, not a deviation from E1's letter ("the submitted plan"). REFUTED: "the dissent is lost on confirm" — S1 behaves the same | **Founder question 2.** |
| HD-3 | should-fix | CONFIRMED, broader — a price's decimals, a clock, a spoken date ("On Tuesday, November 10, RKLB reports") or a year before "report(s)" all tripped `calendar_count` | **Fixed `8337e29e`, `14933af5`**: a count is a whole number before plural "reports" (one calendar word between) or before companies / names / stocks that "report"; never after a decimal point, a colon, a month name, nor a year. Rows both ways. |
| HD-4 | should-fix | CONFIRMED — "outage" anywhere refused market news ("a storm outage") | **Fixed `8337e29e`**: an outage only in a sentence that names a source. |
| HD-5 | should-fix (test) | CONFIRMED — the per-symbol error path never ran; mutant `set.add('skipped')` survived | **Fixed `14933af5`**: `ensureSymbolEvidence` injectable; an EODHD and a FantasyTimes error each said once; a skip silent. Mutant killed. |
| HD-6 | nit (test) | CONFIRMED — the row could not fail; the three guards mask each other | **Fixed `14933af5`**: three rows, one per guard (no wait spent, no second call after an abort in the wait, `aborted` never read as `timeout`); each guard's single mutant killed. |
| HD-7 | nit (test) | CONFIRMED — the E1 branch of `statusReceiptOf` differs only on an S1-era record (where it is right); the `applyPlan` lookup change is inert. HR-HD-7: the comment "receipts written before E1 carry no archetype" was false | The row is not cited as a guard; the comment corrected (`70983e18`). |
| HD-8 | nit | CONFIRMED — a reconfirm moved `plan.confirmed` (sheet time, activity time, tomorrow's prior plan) to the missing archetype | **Fixed `14933af5`**: the equipped archetype's newest confirmation across all of them. Emulator row fails on `87c5df3b`. |
| HD-9 | nit | CONFIRMED (not a spec violation: E3 d covers scripts and cards) — the EVENT IDS lines carried ISO dates | **Fixed `70983e18`**: each id is shown without its date; `proposalOf` maps the alias back. |
| HD-10 | nit | CONFIRMED (a spec question) — five misses; the lens's widening false-positives on "As the Fed meets, I would wait." | **Fixed `8337e29e`, `70983e18`**: E3 b's regex kept verbatim plus "as a/the/your {archetype display name}, I/you", anchored on the six names; "wasn't checked", "not available" said of a source. |
| HD-11 | nit | CONFIRMED — no rendered plan per preview | **Fixed `14933af5`**: each preview carries its archetype's `current` and `renderedText`. |
| HD-12 | note | CONFIRMED — an S1-era confirmed record with an earnings or pre-open line: the door showed, every press answered 409 | **Fixed `70983e18`**: the status answer's missing list is empty where the archetype-neutral validation would change the plan (the same predicate the reconfirm refuses by). Emulator row. |
| HD-13 | note | PARTLY — true, but no battle without an agent id can exist (rules forbid client creates; the one creator stamps it) | **Fixed `70983e18`** (the check added; the comment is now true). |
| HD-14 | note | CONFIRMED — the Wire reader registered in a new ATTRIBUTED_READERS role, not E5's consumer set (whose P2-41 row it would fail by design); the guards see static imports only. HR-HD-14: transitive chains reach the evidence module from `agent-evaluate` (functionally inert), and `decide.js` reads the stories collection directly | Recorded as E5's deviation (report §2); no change. |

### Lens HU — the hub

| Id | Lens severity | Refute verdict | Disposition |
|---|---|---|---|
| HU-1 | should-fix (ruling) | PARTLY (note) — the door is as fresh as the last status read; REFUTED: "a regression against main" (main's door never shipped and used the predicate E1 replaced); the new-game leg is narrow (the hub unmounts on entering a game); C7 lists the refresh triggers and the build matches them | Reported, not changed (a new trigger needs a C7 ruling). |
| HU-2 | should-fix (test) | CONFIRMED — dropping `acknowledged` in the hook or the service failed nothing (286 rows) | **Fixed `52193be8`**: a hook row and `src/services/huddleService.test.js`; both mutants killed. |
| HU-3 | note (ruling) | CONFIRMED, narrowed — a member whose FIRST status read is loading or failed sees the flag-off hub; a kept answer survives a 5xx; a 404 wipes it | Reported (the fail-closed reading kept: a 401 or a network error reaches non-members too). Founder question 5. |
| HU-4 | nit | CONFIRMED — after a lapse a later 200 reopened the sheet, modal, with no tap (also on an owner change) | **Fixed `52193be8`**: the sheet slot is freed when membership lapses (both layouts). Rows fail with either line removed. |
| HU-5 | nit (§9) | CONFIRMED | **Fixed `52193be8`**: Partnership's game line carries the same door. |
| HU-6 | nit (§9) | CONFIRMED — the preview dropped the card item's level | **Fixed `52193be8`** (the row that pinned the dropped level re-pinned). |
| HU-7 | nit | CONFIRMED (all three) | **Fixed `52193be8`**: previews survive a failed request, go with any edit and a successful Skip. |
| HU-8 | nit | CONFIRMED — two of the preview line's four branches were never voice-checked | **Fixed `52193be8`**: all branches sampled with real item words. |
| HU-9 | nit (test) | CONFIRMED, narrowed — an unconditional mutant was already killed; a member-dependent one survived | **Fixed `52193be8`**: the phone negative row. |
| HU-10 | note | CONFIRMED — the fixture previewed the Diversifier as FADE→WATCH (its row is CHASE→WATCH) | Fixture and copy comment corrected (`52193be8`). E1's own example is in the committed spec, a record, unchanged. |
| HU-11 | note | CONFIRMED, narrowed — the per-session reads; the agents and battles queries run only for a confirmed plan in an open session | Written into the flag's docblock (`14933af5`) and the report. HR-HU-11: `status.js` reads the day document twice — reported. |
| HU-12 | nit | CONFIRMED (+ `DeploySection.jsx`, a `CommandCenterHub.jsx` "while either read is out") | **Fixed `14933af5`, `52193be8`**. |

## Mutation lens (HM)

On its own snapshot of `52193be8` (`scratchpad/review/hm`, emulator on port 8297), every mutant planted by exact-string replacement checked to occur once, judged by vitest's exit code and JSON report (a timeout-only failure would count as BROKEN; none did); each touched file restored and compared byte for byte (equal to the blobs, CR bytes aside, from the archive's `autocrlf`). Controls: 25 files unmutated, all pass.

**73 mutants: 69 KILLED, 4 SURVIVED, 0 SKIPPED, 0 BROKEN** — across the cohort gate and every server entry point (HM-1–HM-12), the hub's membership, history gate and sheet close (HM-13–HM-16), confirm and apply (HM-17, HM-18), E2's validation (HM-19, HM-20), the script rules (HM-21–HM-23), the voice retry (HM-24), E6 (HM-25, HM-26) and the hub's door, Partnership line, acknowledgement and previews (HM-27–HM-31).

| Survivor | Verdict | Disposition |
|---|---|---|
| HM-12b — the audio route sends the generic answer for an `outside` token | Equivalent: `outside` always carries 404, so the generic branch sends the same `404 {error:'not_found'}` | No row can tell them apart; none added. |
| HM-19b — the session-window backstop in `validatePlan` deleted | Real gap: an S1-era record froze every timed print of the day as eligible, and only this line refuses a pre-open or after-the-close one | **Killed after the lens**: `planTemplates.test.js` "an S1 record that froze a macro print outside the session as eligible is still refused (the window backstop)" — fails with the line deleted. |
| HM-30c1 — no preview reset on a typed level | Real gap (a stale screen and one wasted round trip; the server's revision check files nothing wrongly) | **Killed after the lens**: `Huddle.jsdom.test.jsx` "E1: a typed level drops the previews, and the next Confirm acknowledges nothing" — fails with the reset removed. |
| HM-31c — the reconfirm prop in the hub's flag-off loadout arm made membership-only | Not rendered while `PER_GAME_LOADOUT_ENABLED` and `AGENT_FORM_ARMORY_ENABLED` are true (both are) | No row (it would need either flag mocked off; that arm's own rows are the armory build's). |

The two rows were added in the commit after `52193be8`; with them, every mutant that changes behaviour under the shipped flags is killed. Two notes from the lens: under HM-2, two "flag off" rows of the brief handler's suite also failed (collateral of shared mock state across its `describe.each`; the rows that name the defect are the gate and cohort rows); `confirm.test.js` passes under every HM-17 mutant — the emulator rows are what guard confirm.

## Tally

35 findings (HC 9, HD 14, HU 12): 29 CONFIRMED, 6 PARTLY, 0 REFUTED outright (3 sub-claims refuted). Fixed: 26. Accepted and documented: 3 (HC-3, HC-6, HD-14). Reported, not changed: 4 — HC-1 (founder question 3), HD-2 (question 2), HU-3 (question 5), HU-1 (a note: C7's trigger list held). Comment-only or not-a-guard: 2 (HD-7, HU-11). Mutation lens: 73 mutants, 69 killed by the reviewed rows, 2 more by rows added after it, 2 that no row can kill under the shipped flags.
