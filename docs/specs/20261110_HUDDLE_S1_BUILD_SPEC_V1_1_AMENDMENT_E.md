# Huddle S1 — Build Spec V1.1 — Amendment E (smoke and review follow-ups; cohort flip)

**Date:** Nov 10, 2026 · **Precedence:** E > C V1.2 > B > A > V1.1
**Destination when committed:** `docs/specs/20261110_HUDDLE_S1_BUILD_SPEC_V1_1_AMENDMENT_E.md`
**Closes:** the founder smoke of Nov 9–10 on `claude/huddle-s1-smoke`; Fable's review rulings R-16–R-25 (`docs/audits/20261107_HUDDLE_S1_FABLE_REVIEW.md`, committed with this amendment); the Command Center chat's L3-11 ruling (handback of Nov 8); the two hub items found when PR #1032 merged with main.
**Not Amendment D:** that letter belongs to the hub spec (`COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2_AMENDMENT_D_20261101.md`).

---

## E1. One confirm covers every archetype in play — replaces C15's confirm, reconfirm and hub bullets; supersedes R-18

The smoke's first real confirm was refused: the founder's equipped archetype was Contrarian and his live BaggerBomb ran Diversifier, so the game read "Confirmed under a different approach · Reconfirm", and Reconfirm could not help because the equipped archetype had not changed. A player's games commonly run an archetype other than the equipped one (casual clones, training overrides, games deployed before a switch), so C15's one-archetype confirm fails in ordinary use.

- **Archetypes in play** for a player on `etDate`: the equipped archetype (the read `confirmPlan.js:50-57` uses today) together with the frozen `agentContext.archetype` of every battle the apply module would consider for that player and session.
- **Confirm** validates the submitted plan once per archetype in play, each with that archetype's dissent row, and appends one confirmation per archetype to `plan.confirmations[]` (`{ current, revision, archetype, renderedText, renderedTextHash, confirmedAt }`), all in one transaction. An archetype with no dissent row gets no confirmation; its battles keep `archetype_unsupported`.
- **Preview.** If any archetype's dissent row changes any item, the first confirm returns 422 with each affected archetype's rendered plan and the changed items (shown on the plan card as, for example, "For your Diversifier game: Fade CCI becomes Watch CCI"). The second confirm, carrying the acknowledged revisions, commits every confirmation. A §A1's baseRevision rule applies per archetype.
- **Reconfirm** is accepted only when an archetype in play has no confirmation (a game deployed after confirming under another archetype; an archetype switch). It appends confirmations for the missing archetypes only. Otherwise it returns the confirmed state unchanged.
- **Apply is unchanged:** the newest confirmation whose `archetype` equals the battle's frozen archetype; none → `stale_approach` (retryable).
- **Hub.** The "Reconfirm" door, on the Deploy card line and on a game's line, shows only when an archetype in play lacks a confirmation — that is, only when pressing it would file. No door that does nothing.
- **Tests:** the founder's Nov 9 case (equipped Contrarian, live game Diversifier) files into the game on one confirm; a game deployed after confirming, under a new archetype, reads `stale_approach` with the door, and a reconfirm files it; two live games under A and B each receive only their own confirmation; a dissent change under one archetype only returns a 422 naming that archetype; a reconfirm with nothing missing is idempotent and shows no door.

## E2. Earnings never freeze the book — amends V1.1 §4.3

The smoke's plan carried "No adds before RKLB's report after the close", which blocks every add for the whole session.

- `NO_ADDS_BEFORE` is eligible only for an event whose time falls inside today's regular session (an intraday macro print such as a 10:00 AM ET release). Earnings, before the open or after the close, are never eligible; drop reason `event_outside_session`.
- **New line template, additive to `plan.v1`:** `NO_ADDS_TO_BEFORE_REPORT t`, rendered "No adds to {t} before its report". Eligible only when `t` is in the session universe and has an earnings event after today's close or before tomorrow's open (event date by `report_date`, C §C11; untimed rows are ineligible). Existing templates and their rendering are unchanged; the 500-character cap holds; unit tests first.

## E3. Script rules — extends `docs/design/SHADOW_VOICE_RULES_V1.md`, the validator and the forbidden-terms tests

| # | Rule | Evidence |
|---|---|---|
| a | (R-22) A source the job **skipped** produces no pack item and no sentence. Only a source it **tried and could not reach** yields a `source_status` item, fact "couldn't reach {source} this morning". Forbidden of a source: *down*, *unavailable*, *outage*, *not checked*. | Nov 9: "Newsfilter was not checked this morning"; build Run B: "news sources down" |
| b | (R-23) The armor beat speaks of the archetype in the third person: "your Contrarian", "the Contrarian". Shadow is "I", the player "you", never the archetype. Forbidden: `/\bAs an? [A-Z]\w*(?: \w+)?, (?:I|you)\b/`. | Nov 9: "As a Contrarian, you look for…"; build Run A: "As a Diversifier, I…" |
| c | (R-24) The first ticker in the names beat is the largest exposure among the gathered holdings; a miss regenerates. | Held on Nov 9; keep the check |
| d | Dates are spoken as a weekday or month and day ("Friday", "November 6"), never ISO; cards render "Nov 6". Forbidden in scripts and card text: `/\b\d{4}-\d{2}-\d{2}\b/`. | Nov 9: "The prior session, 2026-11-06" |
| e | Publications by name, not host: a small map in the evidence layer (`finance.yahoo.com` → Yahoo Finance, `seekingalpha.com` → Seeking Alpha, plus the hosts the `/news` capture shows); an unknown host renders without `www.`. Applied to `source.label`, so the model only ever sees the name. | Nov 9: "finance.yahoo.com reported" |
| f | No calendar mechanics: never a count of total reports or of the cap ("Eight of 256"). Say whether and when the player's names report. | Nov 9 |
| g | (R-25) A `tape` pack kind: one item per index from `marketContext`, `{ symbol, close, changePct, asOf }`, `verified` with its `asOf`. Tape sentences cite tape items (A §A7). C §C10's kind list gains `tape`. | Build RF-16 |

## E4. Voice

- **(R-17) Capture first.** One with-timestamps call on the real key, committed with the key stripped as `api/_utils/__fixtures__/elevenLabsTimestampsCapture.js` (observed keys, alignment shape, character and timing arrays truncated to a sample). The alignment reader and its tests are written against it; no key the fixture lacks is read.
- **(R-19) One retry inside the job.** On 429, 5xx or timeout, wait briefly and retry once within the job's 120 s budget; no new model call. A second failure publishes text-only, as now. A §A2's immutability stands.

## E5. The Wire's voice-layer boundary — (R-20)

Register `api/_utils/evidence/fantasyTimesStories.js` in the Wire's voice-layer consumer set (`api/_utils/agentSafeWireEntry.boundary.test.js`) as a reader that speaks headlines only as attributions ("FantasyTimes reported: …"), with a boundary test row. The trading brain never reads the text.

## E6. "In session" means the market session is open — adds to C §C6 (Command Center ruling L3-11)

**Definition:** a game is *in session* only while its market session is open (`derivePhase(…) === PHASE.LIVE`). A multi-day game between sessions (`LIVE_CLOSED`) is *deployed and waiting*, ranked with a `PRE_OPEN` game. The C6 order reads: a game in session → Huddle ready → a game waiting (`PRE_OPEN` or `LIVE_CLOSED`, in `sortLiveBattles` order) → a review → the first deployment.

**Implementation, exactly as the Command Center chat specified:**
1. `hub/gamesDisplay.js liveGameRows`: call `derivePhase` once per row, keep the result, expose `inSession: phase === PHASE.LIVE` beside `preOpen`. `clock`, `ending`, `startsOn` and `detail` do not change.
2. `hub/nextAction.js:149` (re-cite at HEAD): `row.inSession === true` replaces `row.preOpen !== true`. Nothing else in the function moves; the non-Huddle live rule and the `liveResolved === false` wait stand.
3. `hub/huddleView.js` is unchanged.
4. Pins in the `nextAction` tests:

| # | Market | Game | Huddle | Expected card |
|---|---|---|---|---|
| 1 | open | scored multi-day (`LIVE`) | ready | the game |
| 2 | closed, before open | scored multi-day (`LIVE_CLOSED`) | ready | **the Huddle**; the game is next |
| 3 | closed, before open | unscored (`PRE_OPEN`) | ready | the Huddle; the game is next |
| 4 | closed, before open | `LIVE_CLOSED` | none, or Later'd (`huddle:{etDate}`) | the game |
| 5 | closed, before open | `LIVE_CLOSED` | ready, `liveResolved === false` | loading |

Row 2 is the regression pin and must fail on the old code.

## E7. The cohort — amends R-21; the flag turns on in code

- `HUDDLE_PLAYER_UIDS` is the Huddle's own cohort, separate from `COCKPIT_ALLOWLIST_UIDS`. **Unset or empty means no one** (fail closed), replacing S1's "unset means everyone". How "everyone" is expressed is ruled at the public flip, which still waits for S2–S4 (R-10).
- **Server:** for a uid outside the cohort, every `/api/huddle/*` route answers exactly as with the flag off (404), and the enqueue skips it.
- **Hub:** a player outside the cohort sees the hub byte-identical to the flag-off hub: the reserved Partnership text and summary, no chip, no Huddle next-action rule, no Reconfirm line. Preferred: derive membership from the readers the hub already has (no huddle record today and none in the history reader = outside). If that cannot keep the reserved state exact, STOP and report; no new hub reader without a ruling. The two reads `useHuddleToday` and `useHuddleHistory` make per hub session, now for every player, go in the report.
- `DRB_HUDDLE_ENABLED` turns on in `src/config/huddleFlags.js`; its pin and `DARK_BY_DESIGN` entry are updated in the same commit.

## E8. Hub items from the merge with main

- A full-hub test renders the Deploy card's Reconfirm line through the **live** layout (main's per-game loadout and armory copies at `CommandCenterHub.jsx:612` and `:816-817`, re-cited at HEAD). Today, removing that prop fails nothing.
- The flag-on harness check (360 px and desktop) runs again on main's current layout, since the S1 smoke saw only the pre-merge one.

## E9. The two A §A10 items deferred to the flip

As A §A10 states them: the brief's trading-day skip (no huddle on a market holiday) and the ET pin for the enqueue (no job claims before 8:30 AM ET in either DST state). Re-read A §A10 at HEAD; quote it in the report beside what was built.

## E10. Recorded, not built here

- **R-16:** the dissent table in `api/_utils/huddle/dissentTable.js` is ratified as built.
- **For the Huddle S2 concept, not this PR:** the old Daily Regime Brief as the Huddle's market layer (typed facts beside its prose; its opinions stay out of the plan); plan items that carry their reason, a condition and how firmly they are meant, with the archetype answering the plan in its own voice; a speaking visual for Shadow (a design pass first); the newsroom and "Work an idea" inputs.
- **No code:** a different voice is a new `HUDDLE_SHADOW_VOICE_ID`.
- **Stays off:** newsfilter (needs its own capture first).
