# Phase 0 — Practice Field discovery (read-only)

**Date:** 10 Oct 2026 · **Session:** Claude Code desktop, local Windows · **Prompt:** Fable, "Phase 0 — Practice Field discovery (read-only)", 10 Oct 2026 · **Concept under read:** `docs/design/20261010_PRACTICE_FIELD_CONCEPT_V2.md` (committed byte-identical with this report; SHA-256 `af519f3f34a411b812e927665dda7a86ebe878e31c7152392a0acc9aeff0868e`) · **Builds nothing.**

## 0. Gate facts (BUILD_RULES §2 / §3)

- `git fetch origin` ran first. Worktree clean. HEAD `93953d6248d1713f08ba21626ca67bc5e9fd2c89` = `origin/main` (the #950 merge, `FILM_ROOM_V2_MODE` off → allowlist). The local branch is the app-suffixed `claude/practice-field-phase0-589288`, pushed as `claude/practice-field-phase0`.
- **Writes:** three docs paths only — the concept, this report, two rows in `docs/README.md`. No edits under `api/`, `src/`, `scripts/`, rules, indexes or flags. No Firestore writes. No model calls.
- **Markers.** VERIFIED = read at that line at this HEAD in this session. CENSUS = a read-only Firestore count made in this session (§0.2). LOCAL = read from the growth replay's run folder outside git (`%USERPROFILE%/growth-replay-runs/gr-20261008T181724/`), which holds agent-generated text, never committed. INFERRED is labelled where used. ASSUMED is not used: every claim is one of the three.
- **Fenced files read, never edited:** `api/_utils/agentEvalPromptAssembly.js`, `api/_utils/agentRiskManager.js`, `api/_utils/agentArchetypeConfig.js`, `api/_utils/agentBattleService.js`, `api/agent/decide.js`, `api/_utils/agentPromptAssembly.js`. Fenced functions called: none.

### 0.1 Anchors in the prompt that were stale

- **"The Phase 0C loop discovery and the Film Room build A specs in `docs/README.md`."** `docs/README.md` has no Film Room row at all (`grep -ci film docs/README.md` → 0, VERIFIED), and no document anywhere in the tree is named or titled "Phase 0C" (`grep -rl -i "phase 0c|phase0c|0C loop" docs` → none, VERIFIED). What was used instead, found by `git ls-files`: `docs/audits/20260915_PHASE0B_FILM_ROOM_DISCOVERY.md`, `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_3_20260915.md`, `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md` with Amendments A–E, `docs/audits/20261008_BUILD_FILM_ROOM_A2.md`, and `docs/2026-09-22_CC_ARC_ANSWERS_TO_FILM_ROOM.md`. The README's own maintenance rule says it tracks current state (`docs/README.md:120-124` after this branch's two rows, VERIFIED); the Film Room documents were never indexed there. Reported, not fixed.
- **The growth replay's code anchors** (`7631c9e6`) have drifted by a few lines where cited below; each was re-read at this HEAD.
- **`casualClone.js:58`** (the replay's second clone-copy anchor for `consolidatedInsight`): the file exists at HEAD, but `grep -rn consolidatedInsight api src` finds the string only in `api/_utils/trainingClone.js:73` and the header comment of `api/agent/ensure-casual-clone.js:12` (VERIFIED). Recorded in §6.

### 0.2 Firestore read access and the read-only proof

The prompt allows Firestore reads only with the same read-only access the growth replay used. The replay reads `FIREBASE_ADMIN_CREDENTIALS` from the environment, then this tree's `.env.local`, then the primary checkout's `.env.local` (`scripts/experiments/growth-replay/growthReplay.js:194-205`, `:240-265` VERIFIED). This tree has no `.env.local`; the primary checkout's has the variable (name presence checked, value never printed). So the same path exists, and a census script was run on it:

- `pf-census.cjs`, written and run from the session scratchpad (never inside the tree), the Admin SDK used for `.collection / .doc / .get / .getAll / .select / .where / .limit` only.
- The replay report's §7 proof grep, run on the script before each run: `grep -nE "\.(set|update|delete|add|create)[[:space:]]*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete"` → **no matches (exit 1)**. The run is gated on that grep inside the same shell command; two earlier drafts were refused by the gate for JavaScript `Map.set` / `Object.create` names and were rewritten before anything ran.
- Run window 2026-10-10T19:47:17Z – 19:47:43Z; a second run at 20:05Z added one joint count (game mode × opponent present) under the same gate and reproduced every other number. No uid, agent id or battle id was printed; owners are labelled by order of first appearance.
- `COCKPIT_ALLOWLIST_UIDS` is not in either `.env.local` (0 lines, VERIFIED), so "allowlisted" cannot be resolved from code here. An INFERRED marker is used instead (§Q1).

---

## 1. In plain terms

**What the concept can stand on today.**

- **Every moment is already recorded, twice.** For each of the agent's checks the platform keeps a permanent fact record and, for 120 days, the exact bytes it sent to the model. The growth replay already proved those bytes can be re-sent and the brain re-asked. Two other scripts in the tree do the same kind of replay. So "ask the brain about this stored moment" is a solved mechanic, not a new one.
- **"What happened next" is on the tape.** The Film Room's nightly tape stores, per battle day, the score at every check, every swap with a rebuilt "if we had held" and "after the swap" path in game points, and the 10-minute price series of every name involved. The screen that shows it is live for allowlisted players and has four empty, named slots reserved for later cards.
- **The blind call already has a shape.** The cockpit's call records give a declaration a symbol, a direction, a level, a horizon with a real market-time expiry, a default action, a "hit / expired" outcome and a player answer that either agrees for free or files an instruction. Most of that is reusable as the drill's call shape.
- **Ideas already have versioned records.** The pilot's hypothesis versions are the right template for a play record: write-once content, a separate lifecycle, server-only writes.

**What is missing.**

- There is no drill screen, no play record, no pattern counter, no take-home card, no "send to camp" button, no holdout-and-score proof, and no "ask me first" route (the two answers that would carry it are explicitly deferred).
- The pilot's qualification harness (isolated store, frozen clock) is specified and not built.
- Nothing picks hard moments. The tape groups check states into runs, and that is the only counting code in the Film Room.

**The biggest surprise: the brain cannot know whether it is down or ahead.** The live state the deciding model sees carries the day, the time remaining, the phase and the agent's own score, and nothing about the opponent — the string "opponent" does not appear in the evaluator prompt assembler at all. On top of that, the only opponent score the platform writes is the sum of a CPU portfolio; tournament battles are created with no opponent by a founder ruling (D4), so their stored opponent score is zero by construction. Two of the concept's three fixed situations ("we are down", "we have a good lead") are therefore not situations the agent can currently recognise, live or from its own record; the player can see them on the scoreboard, the agent cannot.

**Two smaller surprises the founder should hear.**

- **The learning the replay measured is, mostly, the system narrating its own failure.** 72 of the 87 reflection entries on the agents are the literal fallback line written when the reflection model call fails, and the consolidation prompt feeds those entries straight into the "wisdom" paragraph. The paragraphs saying "most reflections failed" are that mechanism, not a model being candid.
- **The Contrarian in the replay really does carry a Diversifier's paragraph.** Confirmed from the live agent document. Archetype change never touches the learned paragraph, and clones copy it, so paragraphs cross archetypes two ways today. A Capital Preserver pair also carries the same Diversifier text, and a Trend Follower carries a Speculator's.

**Cost.** One re-ask is about two cents on the production model (a quarter of a cent on Haiku 5.5, which almost never trades). The concept's "ten asks per moment" proof is about twenty cents a moment. The org-level API usage limit that refused ten live checks on 8 Oct would sit over a camp too.

**Smallest playable camp.** A drill screen over the tape where only the player makes the blind call and the reveal comes from data already stored: no model spend, no fenced file, and it generates the first drill records. The agent's re-ask comes second. Installing a play is cheap for plays that compile to an existing control (a lean, a rule setting, a dial) and is fenced work for plays that are prompt text.

---

## 2. Answers Q1–Q12

### Q1. Replayable moments

**What is stored per moment.**

| Record | Where | Lifetime | Anchor |
|---|---|---|---|
| Permanent tick (no free text): ids, `capturedAt`, `day`, `battlePhase`, `stageReached`, `exitReason`, `model.{outcome, failureClass…}`, `guardrail.*`, `checks.*`, `risk.verdicts`, `decision.{original, final, holdKind…}`, `actions[]`, `controls.*`, `scores.{active, banked, total, opponent, bankedBadgePoints}` | `agentBattles/{id}/ticks/{tickId}` | no TTL, no cap | `api/_utils/tickCapture/captureWriter.js:6-9`, `:217-225`, `:324-328` VERIFIED |
| Tick body (all text): `request.{body, bytes, sha256, truncated}`, `response.*`, `originalToolResult`, `finalToolResult`, `controlsAsRendered`, `expireAt` | `agentBattles/{id}/tickBodies/{tickId}` | **120 days** from capture | `captureConfig.js:99-100` (`TICK_CAPTURE_BODY_RETENTION_DAYS = 120`), `captureWriter.js:170` (`expireAt = now + 120 d`), `:180-188`; TTL policy `firestore.indexes.json:726-729` VERIFIED |
| Both written in one atomic batch | — | — | `captureWriter.js:541-544` VERIFIED |
| The outgoing body is the exact string the SDK dispatched | the fetch observer copies `init.body` | — | `captureBodyObserver.js:80-100` VERIFIED |
| The nightly tape (facts per battle day; never reads bodies) | `agentBattles/{id}/tape/{etDate}` + `…/series/{symbol}` | battle lifecycle | `api/cron/film-tape-close.js` (`vercel.json:209`), `film-tape-candles.js` (`:213`); `writeTapeDay.js:7`, `tapeSources.js:7` ("never `tickBodies`") VERIFIED; spec BA-1/BA-2 `docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md:48-49` VERIFIED |

The request the brain receives is the production literal: `model: EVAL_MODEL_ID`, `max_tokens: EVAL_MAX_OUTPUT_TOKENS`, `system`, `messages`, `tools`, forced `tool_choice: { type: 'tool', name: 'submit_trade_decision' }`, 20 s timeout (`api/cron/agent-evaluate.js:2886-2902` VERIFIED); the client is built from `CLAUDE_API_KEY` only (`:228-229`); `EVAL_MODEL_ID = 'claude-haiku-4-5-20251001'`, `EVAL_MAX_OUTPUT_TOKENS = 3072` (`api/_utils/agentEvalTransport.js:48`, `:64` VERIFIED).

**Does anything other than `growthReplay.js` re-ask the brain about a stored moment?** Yes, two scripts; one more reads bodies without asking.

- `scripts/declarations-wording-experiment.mjs` replays `tickBodies.request.body` verbatim with only the `tools` array swapped between arms, through the Anthropic SDK (`:1-15`, `:33`, `:268-272` VERIFIED). Read-only on Firestore by construction (`:11-13`).
- `scripts/paired-eval-harness.js` replays captured live contexts through candidate prompts (`:1-8`, `replay()` at `:110-112` VERIFIED) — but its corpus is the frozen `shadowDiffs` collection, not `tickBodies` (`:18-24`).
- `scripts/measure-eval-request-tokens.mjs` sends `countTokens` only, no inference (`:5-21` VERIFIED).
- `scripts/export-tick-capture.js` reads bodies for the founder read-out and has no Anthropic import (grep, VERIFIED).

**What a server-side "ask the brain about this stored moment" needs** (all of it exists in pieces; none of it is a route today):

1. An Admin-SDK read of `tickBodies.request.body` — clients are denied both subcollections (no `match` block exists for `ticks` or `tickBodies`; `firestore.rules:485-523` has `declarations`, `calls`, `tape`, `series` only, VERIFIED), so this is server work.
2. The SHA-256 check against `request.sha256` (the body's `request: { body, bytes, sha256, truncated }` shape at `captureWriter.js:89`; `sha256Hex` / `sha256Bytes` at `:37-52` VERIFIED).
3. A send that keeps every byte outside the edited span identical — the replay's `applyVariant` and `assertOnlySpansMoved` do this for the LEARNED and EQUIPPED spans (`growthReplay.js:374-404`, `:411-420` VERIFIED); a drill that inserts a play needs a fourth variant (§Q8).
4. Production's validator and the declarations-off schema for the decision key: `validateTradeToolResult` (`api/_utils/agentEvalToolResultValidation.js:92` VERIFIED), the per-check tool builder (`api/_utils/agentEvalToolSchema.js:198-210`, `:349-362` VERIFIED), first `tool_use` block (`agent-evaluate.js:2927`). The replay re-derived these; a server route may import them.
5. A spend cap and a stop-on-usage-limit rule (§Q10), and no product handler on the path (so no capture record, cron state or battle write).

**Fenced files it would call without editing:** none are required for a verbatim re-ask — neither the tool schema nor the validator is on the §1 list (`docs/BUILD_RULES.md:14-24` VERIFIED). Scoring the reveal in points calls `calculateAssetScoreServer` from the fenced `agentScoring.js`, which the tape already imports (`api/_utils/filmTape/tapeReplay.js:70` VERIFIED; BUILD_RULES §4 forbids a local copy). Editing a stored prompt to insert a play reads the fenced assembler's section literals (`agentEvalPromptAssembly.js:776` "YOUR STRATEGIC WISDOM", `:779` the fresh-agent line, `:835` "YOUR FORGE RULES", `:1281` "YOUR LAST 3 DECISIONS" VERIFIED) — reading is permitted.

**How many replayable moments exist today (CENSUS, 2026-10-10T19:47Z).** "Replayable" here = permanent tick with `model.outcome === 'ok'` and a body present, not incomplete, not truncated. This is an upper bound on the replay's stricter eligibility (SHA verified, sections parse and agree with the snapshot), which passed 441 of 441 on 8 Oct.

| Count | n |
|---|---|
| Battles in `agentBattles` | 582 |
| Alive on or after 2026-09-01 (the replay's walk rule, `growthReplay.js:272-276`) | 162 |
| … with tick records | 110 |
| Ticks | 2,793 |
| Ticks that dispatched a model call | 594 |
| `model.outcome = ok` | 508 |
| Body present and complete | 508 |
| **Replayable** | **508** |

| Breakdown | |
|---|---|
| By owner | owner-1: 399 · owner-14: 89 · owner-24: 20 |
| By archetype | Trend Follower (`momentum_chaser`) 399 · Contrarian 89 · Diversifier 20 |
| By game mode | `baggerbomb_tournament` 389 · `baggerbomb_agent` 119 |
| By month | Sep 162 · Oct 346 |
| Oldest body | captured 2026-09-22T14:46Z → **expires 2027-01-20T14:46Z** (the earliest `expireAt` in the corpus) |
| Newest body | 2026-10-09T19:46Z |

**Per allowlisted player:** the allowlist cannot be read here (§0.2). INFERRED: with the global mode at `'on'` since 6 Oct, calls mint only for allowlisted owners (`api/_utils/callRecords/mode.js:80-85` VERIFIED: non-allowlisted owners resolve to `'off'`), so an owner whose battle created on or after 6 Oct holds a `calls` document is allowlisted. Of 53 such battles, 13 hold calls, belonging to **owner-1 and owner-24** — consistent with the two allowlisted accounts the week-1 read labels "founder" and "FT_QA" (`scripts/cockpit-week1-read.mjs:19-23` VERIFIED; which label is which owner here is not known). Under that inference the allowlisted supply is **419 moments (399 + 20)**; owner-14's 89 Contrarian moments are not inferred allowlisted.

### Q2. The three situations

**Live, what the brain is told** (fenced assembler, read-only):

- `━━━ LIVE BATTLE STATE ━━━` renders `Day n of N | <time remaining> remaining | Phase: <phase>`, then `Current Score` with its Active / BankedTrades / badge parts, then trade and evaluation counts (`api/_utils/agentEvalPromptAssembly.js:1127-1136` VERIFIED). `computeTimeRemaining` (`:1331`) and `computeBattlePhase` (`:1293`, phases `EARLY` < 40 %, `MID` < 70 %, `LATE`, `FINAL_HOUR` within 60 minutes of the last day's close) derive from `battle.timing.tradingDays`, `localOpen`, `localClose` (`:1293-1345` VERIFIED).
- **No opponent score anywhere in the assembler.** `grep -n -i opponent api/_utils/agentEvalPromptAssembly.js` matches nothing in the prompt text (the only hits are the standing-leans snapshot comments and the bench "Composite:" line, `:1213-1235`, `:1719-1725` VERIFIED). The survival paragraph is the agent's own bust floor, not a scoreboard (`:187-197` VERIFIED).
- Movement the brain sees per held name: the intraday momentum snapshot (`:1861`) and, per check, the evidence stamp `{px, chg, atrX, vwapDev, bbPct, nr7, regime, risk}` that the tape copies (`FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md:98` VERIFIED).

**Stored, per check and per day:**

- Tick `scores.{active, banked, total, opponent, bankedBadgePoints}` exactly as the tick wrote them (`captureWriter.js:324-328`; `agent-evaluate.js:1283-1290` VERIFIED), plus `day`, `battlePhase`, `capturedAt` (`captureWriter.js:223-225`).
- Battle `scoreState.{activeScore, bankedScore, currentScore, opponentScore, lastScoredAt, peakScore}` (`agent-evaluate.js:1270-1274`, `:1294-1295` VERIFIED).
- Tape `score.lastCheck {at, tickSeq, active, banked, total, opponent, bankedBadgePoints}`, `score.firstCheck`, `score.dayChange {value, basis}`, `checks[].scores`, `checks[].evidence`, `evidenceAt`, `actions[]` (spec `:87-111` VERIFIED).

**The opponent score, and battles with none.** The only writer of `opponentScore` sums a CPU portfolio: `cpuPortfolioFlat = flattenPortfolioServer(battle.opponent?.portfolio)` (`agent-evaluate.js:1067` VERIFIED) → `opponentScore = cpuAssetScores.reduce(…)` (`:1256`). `battle.opponent` is set at creation from `options.opponent || null` (`api/_utils/agentBattleService.js:167` VERIFIED), and the two creation callers differ by design: the self-select deploy passes the generated CPU portfolio (`api/agent/decide.js:1003` VERIFIED), while the prescribed tournament deploy passes `opponent: null` — "founder ruling D4: no embedded CPU opponent in tournament battles" (`decide.js:1493` VERIFIED). So a tournament battle's stored opponent score is **0 by construction**, indistinguishable from a tie. CENSUS (joint count, second run 2026-10-10T20:05Z): all 389 replayable `baggerbomb_tournament` moments sit on battles with `opponent == null`, and all 119 `baggerbomb_agent` moments on battles with an opponent portfolio. Completion compares `currentScore` to `opponentScore` and labels the message "vs CPU" (`:6590-6599` VERIFIED). The tournament standing the player sees is the group composite (`agentScore + 1.5 × userScore`, `docs/BUILD_RULES.md:90` VERIFIED), which no evaluator or tape field carries. The CPU's own battles (`isCpu: true`, 102 alive battles, CENSUS) run passive with no model call (`captureConfig.js:114` VERIFIED) and supply no moments.

**"Our stocks are not moving."** Live, the platform's own definition is the forced-rotation stagnation counter: `stagnationTicks ≥ fr.ticksThreshold` with per-tick moves under `fr.pctThreshold` and the position below `winnerThreshold` (`api/_utils/agentRiskManager.js:181-192` VERIFIED), thresholds per archetype (`agentArchetypeConfig.js:49`, `:80`, `:109`, `:136`, `:165` — e.g. 5 ticks / 0.15 % and 6 ticks / 0.30 % VERIFIED). That counter lives in `cronMemory` and is **not persisted** (`agent-evaluate.js:1681` VERIFIED); only its firing reaches the record as `exitReason: 'stagnation'`. After the fact, flatness has to be rebuilt from `checks[].evidence.chg` per check and the 10-minute series bars (`bars.js:128 aggregate10m`, `:141 pctChange` VERIFIED).

**Proposed fields per situation (every threshold a founder slot):**

| Situation | Live (prompt) | After the fact (tape) | Founder slots |
|---|---|---|---|
| We are down | needs a new line: `scores.total − opponent` and `timeRemaining` — **the opponent term does not exist in the prompt today** (fence contact to add) | `checks[t].scores.total − score.lastCheck.opponent` (vs-CPU only); tournament needs the group composite stored per check (new tape field) | down by ≥ X points · with ≤ Y of `timeRemaining` (or phase ∈ {LATE, FINAL_HOUR}) |
| We have a good lead | same line, positive | same, positive | ahead by ≥ X · optionally after `Day ≥ d` |
| Our stocks are not moving | `evidence.chg` and the momentum snapshot already shown; the stagnation counter if persisted | max `|chg|` across held names over the last K checks < C; or series close-to-close range over M bars < m·ATR; and no `actions[]` in the window | K checks · C % · M bars · m × ATR · "flat" tied to the archetype's `pctThreshold` or not |

### Q3. Overlap with the Film Room

**Specified.** Takeaways and tomorrow's card are designed, not built: the address rule (a takeaway must point at a menu move or an equipped rule's setting, `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_3_20260915.md:280-284` VERIFIED), the three shelves (`:286-294`), nominations and caps ("computation nominates… nothing is agent-originated", `:300-304`), statuses (`:306-308`), tomorrow's card (`:310-324`), and rulings R2 (player files takeaways; computation supplies evidence) and R3 (takeaways live in the Forge Record Ledger, not a Film Room store) (`:50-51` VERIFIED). Build A puts takeaways, statuses, nominations and the Ledger in **Build C** after Forge Record step 0, and tomorrow's card in **Build B** (`FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md:219-234` VERIFIED). Amendment E names **take-home cards and the pattern counter** only to put them out of A2's scope: "They belong to the cards build and its contract, or later" (`docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_E_20261008.md:42-43` VERIFIED). No "cards build" contract document exists in the tree (§6).

**Built.** The v2 screen reserves named, empty regions for the later cards: header slots `since-last-time`, `prepared-case`; footer slots `your-call`, `receipt` (`src/screens/filmRoomV2/filmRoomCopy.js:240-241`; rendered by `Reserved` at `FilmRoomScreenV2.jsx:140-144`, placed at `:225` and `:257-259` VERIFIED; BA-47 `AMENDMENT_E:33-34`). Every swap card is addressable as `#swap-n` (`docs/audits/20261008_BUILD_FILM_ROOM_A2.md:181` VERIFIED). The screen is live for allowlisted owners (`FILM_ROOM_V2_MODE = 'allowlist'`, `src/config/featureFlags.js:2989`; gate `src/utils/filmRoomGate.js:40-43`; route `FilmRoomRoute.jsx:36-52` VERIFIED).

**Neither (no code, no contract):** the pattern counter and the take-home card. `grep -rn -i "pattern counter|take-home|takehome" src api` → nothing (VERIFIED). The only counting code is the tape model's run grouping: `checkRuns` groups `checks[]` by state (`src/screens/filmRoomV2/filmRoomModel.js:287`), `checkCounts` (`:91`), with the one screen-computed number declared in `SCREEN_AGGREGATE_CLASSES` (`:62`) VERIFIED.

**Could one code-counted tagger serve both?** Yes, and it should be one pure function over the tape: input `checks[]` (states, `scores`, `evidence`), `actions[]` (with `replay`), `series/*`; output a list of typed tags per check (`down`, `good_lead`, `flat`, plus the game-mechanics the design note already names — stagnation fire, guardrail fire, swap-cost). The pattern counter is a count of tags per week; the Practice Field's hard-moment picker is a filter on the same tags plus a ranking rule. Two honesty constraints bind it: every number it produces is a `derived` class declared where the screen declares its aggregates (BA-21 `:68`, R4(a) in `AMENDMENT_E:53-54` VERIFIED), and a tag is a fact, never a verdict — the tape's invariant 9 forbids arranging facts so a conclusion becomes the obvious reading (`spec:180` VERIFIED). "Hard" must therefore be defined by numbers (size of the swing, closeness to a threshold), not by outcome words.

**Where "send this moment to camp" attaches.** Three candidates, all non-fenced: (1) a fifth reserved slot on the footer beside `your-call` / `receipt` — one copy line plus a row in the reserved-slot suite (`FilmRoomScreenV2.reserved.jsdom.test.jsx` exists, VERIFIED); (2) the check-detail panel of a tagged check (BA-44, `AMENDMENT_E:24-25`); (3) the `#swap-n` card for a swap moment. The take-home card itself, when built, is the natural host: the design note's address rule means a card already points at "a move on its archetype's adjustment menu or a setting on an equipped rule" (`:282`), which is exactly what an enforced play compiles to (§Q6).

### Q4. The blind call

**Reusable outside a live battle** (the contract `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md`, all VERIFIED):

- The typed declaration shape — `calledShots[{symbol, direction, slot, counterpart, condition{side, level}, horizonPhrase, expiresAtMs?, defaultAction, said}]`, `watching[]`, `playerAsk`, `fork` (`:24-31`); "typed fields govern; `said` is presentation" (`:33`).
- The validation rules: wrong type → malformed, not born; non-finite level, symbol outside the encounter observation, or level implausible against the checked quote (> 25 %) → minted `invalidated` (`:33`).
- The identity rule `callId = ${battleId}:${evalId}:call:${n}` (`:45`) — the camp needs its own id family, same discipline.
- The horizon vocabulary `next_check | this_session | this_battle | explicit` (`:73-78`) and the pure helpers that compute it: `EVALUATOR_SCHEDULE` mirrors `vercel.json` (`api/_utils/callRecords/horizon.js:24-30`), `nextEligibleSlot` (`:92`), `sessionCloseAfter` (`:118`), `resolveHorizon` (`:143`) VERIFIED.
- The state machine `open → hit | invalidated | expired_unresolved | ended_with_battle` and "above/below is `>` / `<` against the checked quote" (`:84-88`).
- The answer-legality table, node- and browser-clean: `ANSWERS_1A = go, hold, go_now, pick, agree, disagree`; `classifyAnswer` (pick → directive; agree/disagree → ack; act-default: go = ack, hold = directive; hold-default: hold = ack, go_now = directive) (`api/_utils/callRecords/answers.js:26-57` VERIFIED).
- The call-directive plan builder (`buildCallDirectivePlan`, family `'call'`, expiry `'until_ms'`, `api/_utils/callRecords/callActions.js:36-42`, `:149-175` VERIFIED) and the tile copy (`copy.js`).

**Battle-scoped, would block reuse:**

| Blocker | Anchor |
|---|---|
| Calls are minted only from a durably committed evaluation, after the evaluation commit, by the evaluation cron | contract `:17`, `:46`; `agent-evaluate.js:2977` binds the horizon with `battleExpiresAtMs` |
| `expiresAt` for `next_check` is the next live cron slot; `this_battle` is the battle's expiry | contract `:75-77`; `horizon.js:92`, `:166` |
| `hit` requires an encounter observation at a check with a finite quote from a named source | contract `:86` |
| The answer endpoint's transaction: owner (`call-response.js:184`), `resolveCallRecordsMode(parent) === 'on'` — allowlisted owner (`:186`; `mode.js:80-85`), parent `status === 'active'` (`:227`), the client's directive belief (`:229`), the battle's agent and an effective archetype (`:233-239`), no other call-family directive pending (`:241-245`), the chat budget (`:247-265`: 10 per game-day `agentChatBudget.js:36`; 10 per battle `directiveFiling.js:97`) | all VERIFIED |
| A divergent answer files a directive into `battle.directive`, the single latest-wins slot | contract `:94-96`; `call-response.js:36-46` |
| `ask` and `keep` are deferred — "ask me first" has no live route | `answers.js:27` VERIFIED |
| Rules: `calls` and `declarations` are owner-read subcollections of the battle; retention = battle lifecycle | contract `:16-18`; `firestore.rules:485-490` |
| The tape copies calls as observed snapshots, never judged | BA-16 `spec:63` |

A drill call therefore keeps the shape, the validation and the legality table, and replaces the minting path (the player and the re-asked brain declare), the horizon basis (a drill horizon is the stored day's close or a check count against the tape), the encounter rule (a reveal reads the series, not a live quote) and the answer side effects (nothing files a directive).

### Q5. The reveal

**BaggerBomb points.** Only a recorded swap has a replay: hold path = the sold name scored from its entry as if never sold; swap path = `lockedPoints` banked + the bought name scored from the swap; `gapPoints = (lockedPoints + bought.atClose) − ghost.atClose`; `closedLegDelta = rebuilt ghost at the swap − lockedPoints` (`api/_utils/filmTape/tapeReplay.js:7-18`, `:106-113` VERIFIED; BA-11 `spec:58`). Both legs are sampled at the battle's own check times from prior-session 1-minute bars with extremes empty, through the fenced scorer (`tapeReplay.js:70`, `:134`; price at an instant = the last completed minute, `:158-167`; `bars.js:83 priceAt`, `:97 sampleAt` VERIFIED). `subsequentTradesInSlot` marks both continued lines hypothetical. **A HOLD moment has no replay**: what happened next in points is only `checks[].scores.total` from that check to the day's close — the whole book, not the moment's alternative. A "what if we had swapped" for a hold needs the same arithmetic run on a hypothetical swap; the inputs (the held name's entry, ATR, tier, threshold history; the candidate's bars) are the replay's `replayInputs` and the series.

**Plain price movement.** `series/{symbol}` holds 10-minute bars for the regular session (≤ 39), `sessionOpen`, and `atChecks[{tickSeq, at, price, barClosedAt}]` with `numberClasses` (`candlePass.js:215-219`, written at `:613`; `bars.js:128 aggregate10m`, `:41` 10-minute buckets VERIFIED), for every held, sold, bought and planned name plus `SPY`, `RSP` and the sector ETF (`spec:153`, BA-13 `:60`). `marketChangeAfter` / `sectorChangeAfter` are stored per action (`tapeReplay.js:331`). Change over a window is `pctChange` (`bars.js:141`).

**The delayed-quote limit and the other honesty limits on a per-call score:**

1. The evidence `px` the agent was given is "the platform's quote", which runs about 15–20 minutes behind the bars; the screen states the gap and never smooths it (`src/screens/filmRoomV2/filmRoomCopy.js:235`; BA-43 `AMENDMENT_E:22` VERIFIED). A call made against `px` must be scored from `px` at the call and the bar close at the horizon, with the delay stated, or the score credits the player with a price the agent never saw.
2. Every number carries one of four classes — recorded, derived, rebuilt, market — and the replay is rebuilt, one-step, through the day's close (BA-21 `:68`; BA-11 `:58`). A drill score built on the replay inherits "rebuilt".
3. A plan or a call "gets prices, never a verdict" and the tape "never selects a decisive action, ranks outcomes, or arranges facts" (invariants 4 and 9, `spec:175`, `:180`). A drill's "who was right" is a verdict the tape may not render; it must be a camp-owned derived number with its horizon and basis declared, on a camp surface, not written into the tape.
4. `hit` for a live call is judged at a check's own observation (contract `:86`); a drill judged at the close is a different basis and must say so.
5. Crypto legs have no replay (BA-3 `spec:50`); the candle pass retries up to three attempts within ten trading days (`:152`); a missing symbol is `missingInputs`, never guessed (`:154-155`).
6. For next-day drills ("today's market"), nothing on the tape is available until the candle pass the next morning (`vercel.json:213`, 11:00 UTC).

### Q6. The play record and its road to the agent

**Where it would sit.** Beside the idea records, as their twin: `watchlists/{id}/hypothesisVersions/v{n}` are server-written, write-once content with a separate lifecycle envelope (`api/_utils/hypothesisRecords/model.js:51-66` VERIFIED; pilot spec `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md:31-33`), minted in the same transaction as the list's commit (`api/forge/watchlists.js:534-550` VERIFIED), gated by `HYPOTHESIS_RECORDS_ENABLED` plus the cockpit allowlist (`featureFlags.js:3116`; `carriage.js:28-31`). A play's five parts (concept §7) map onto that shape: `situation` as typed conditions like the hypothesis `{symbol, side, level, basis}` (`model.js:56-57`), `call`, `whoseCall ∈ {agent, ask_first, player}`, `wrongIf` as a typed condition, `record` as episode-grained counts (Charter M1, `docs/AGENT_LEARNING_CHARTER_V1.md:31`). Because the concept binds a play to an archetype (decision 2), the natural parent is the agent (`agents/{agentId}/plays/{playId}`), with the archetype stamped on the record, not the player's profile. Forge rules, standing leans and (when built) Film Room cards are all *compile targets* a play can point at, not homes for it (design note address rule `:282`; Charter §4 T1 "compiles into an existing control — a lean, a dial position, a rule paramValue", `:39` VERIFIED).

**Every route that changes what the agent's prompt says today** (writer → stored field → frozen copy → prompt line; fenced files marked **F**):

| # | Route | Writer | Field | Frozen at battle creation (**F** `agentBattleService.js`) | Prompt line (**F** `agentEvalPromptAssembly.js`) |
|---|---|---|---|---|---|
| 1 | Consolidation | `api/_utils/agentConsolidationApply.js:271-273`, `:302-304` (also the only writer of `disciplines`, `:3`) | `agent.consolidatedInsight` | `:232` | `:776` "YOUR STRATEGIC WISDOM" / `:779` fresh line; also the draft prompt **F** `agentPromptAssembly.js:84-86` |
| 2 | Forge rules | `api/agent/equip-bundle.js`, `reforge-bundle.js`, `unequip-bundle.js`; re-projected at deploy **F** `decide.js:235-242` | `agent.activeRules` | `:186` | `:835` "YOUR FORGE RULES" |
| 3 | Standing leans | `api/agent/equip-lean.js`, `unequip-lean.js`; the change-archetype invalidation rider `change-archetype.js:363-370` | `agent.standingLeans` | `:223-224` | `:1213-1235` via `renderLeansBlock` (`api/_utils/controlPromptRenderer.js:231`) |
| 4 | Directive | `api/agent/file-directive.js` (gate `:227`), `chat.js`, `call-response.js` | `battle.directive` | n/a (per battle) | `:1213-1235` via `renderDirectiveBlock` (`controlPromptRenderer.js:213`) |
| 5 | Watchlist | `api/agent/equip-watchlist.js` | `agent.equippedWatchlistId` | `:198-199` | bench membership only; no section of its own |
| 6 | Archetype | `api/agent/change-archetype.js:253-262` | `agent.archetype`, `equippedTraits` | archetype in context | the system prompt's identity block |
| 7 | The draft call | **F** `decide.js:693` and siblings | `agent.lastDecision.strategyBrief` | `:184` | `:759-761` "YOUR STRATEGIC BRIEF", `:767` rationale |
| 8 | News ranked against rules | `api/_utils/agentNewsContext.js:228`, `:273` | — | — | the FANTASYTIMES INTELLIGENCE block quotes equipped rules |
| 9 | Hypothesis deploy carriage (P1b) | **F** `decide.js:379-396`, `:943` → `carriage.js` | `equippedHypothesis` sibling | `:207-219` | **none** — "nothing the agent reads consumes the carried copy" (pilot spec Amendment D `:144`; `carriage.js:1-30` VERIFIED) |
| 10 | Reflection memory | `api/agent/reflect.js:274-281` | `agent.memory[]` | — | **not in the trading prompt**; consolidation input only (`agentConsolidationPrompt.js:136-137`, `:194-195`) |
| 11 | Dossier `disciplines` | `agentConsolidationApply.js` | `agent.disciplines` | — | **read by no prompt**: `grep -rln disciplines api src` → the three consolidation files and `reflect.js` only (VERIFIED) |

All anchors VERIFIED. Routes 2, 3, 5, 6 are the non-fenced writers an *enforced* play can use today; routes 1 and 7 are model-written text; route 4 is live-battle only.

**"Deployment brief" at this HEAD:** not found under that name (`grep -rli "deployment brief|deploy brief|deploymentBrief" api src docs` finds the voice layer and the Why panel only). Two things are near it, neither claimed as "the" brief: the draft call's `strategyBrief` (route 7 above), and the voice layer's "plan at deploy" block, "the persisted deploy brief behind the pane's C1 gates" (`api/_utils/voiceLayerPrompt.js:3509-3511`; `voiceLayerGrounding.js:658`; shown in `src/screens/battleView/WhyPanel.jsx:183` VERIFIED). Neither is a play.

**The road, by play family (concept §7):** game-dynamic and allocation plays that can be expressed as a lean, a rule paramValue or a dial travel routes 2/3 (non-fenced writers) and take effect at the next battle creation because contexts freeze there — which is the concept's "next week's open" by construction. Technical plays with a chart condition could compile to a Forge rule the same way. **Signature plays as prompt text** need a new section in the identity block: the DR-13 flag-split (a dark non-fenced render module plus a one-import/one-call fenced splice) with the module registered in `PROMPT_CONTRIBUTING_MODULES` in the same commit (`docs/BUILD_RULES.md:30` VERIFIED) — §7-class fence contact.

### Q7. Whose call

**Acts alone today.** Six swap paths execute without a player turn (BUILD_RULES §7 `:88` VERIFIED); the launch execution mode forces autopilot (`agent-evaluate.js:4966`; the mode branch `:3519`, `:3597` VERIFIED); the risk manager's exits (`agentRiskManager.js:103-192`); the guardrail pass at the main site (`agent-evaluate.js:3330`) and on the gameplan suppression paths (`:5601`, R11 comment `:5517-5535` VERIFIED), ruled always-run by R3 (`docs/README.md:98` VERIFIED). The survival paragraph grants explicit permission to override a directive on a −1.0× ATR breach (`agentEvalPromptAssembly.js:192` VERIFIED).

**Asks before acting.** Confirmation calls: the model declares a call with `defaultAction: act | hold` (contract `:26`, `:58`; `api/_utils/callRecords/candidate.js:216-238` VERIFIED — an `entry` on a name already held is an "upside call" that accepts no answer at all, `candidate.js:30`, `:230`; `answers.js:9-13`); the player's agreeing answer is a free ack and the overriding one files a directive (`answers.js:34-57`). Pick calls: the model offers `options[]` and the player's pick files a symbol-bound directive (`answers.js:38-41`; `callActions.js:149-175`). **"Ask me first" is not live:** `ask` and `keep` are `DEFERRED_ANSWERS` (`answers.js:27` VERIFIED); the contract's hold-and-re-ask (`:97`) has no route. Gameplan meetings exist as `gameplan_pending` / `proposal_pending` exits (`agent-evaluate.js:2410-2422`, `:2453-2461` VERIFIED) and a `GameplanMeetingCard` component imported by `AgentActivityFeed.jsx` (VERIFIED by grep); the design note records the approval card as unmounted at its HEAD (`:152`, `:176`) — not re-verified here.

**The player's call.** A directive through the deterministic gate (`isValidAdjustmentId`, `file-directive.js:227`; `ARCHETYPE_INTEGRITY_MODE = 'enforce'`, `featureFlags.js:770` VERIFIED), one line in the prompt (route 4 above), which only the model path reads (Command Center foundation `COMMAND_CENTER_ARC_FOUNDATION.md:38-41` VERIFIED).

**Exit dials.** Out of cockpit v1 (`docs/design/COCKPIT_SPEC_V1_3.md:18`); their controls hidden, not disabled, in Build 2a (`docs/COCKPIT_BUILD2A_SPEC_V1_0.md:39`, `:60`); the only dial in code is tempo (`api/agent/set-tempo-dial.js:1-18`; `TEMPO_DIAL_ENABLED`, `featureFlags.js:723` VERIFIED).

**What a "whose call" play could bind to without new authority:**

- **Player's call** → a standing lean (route 3), the existing "player's standing instruction" channel; prompt text, honoured by the model path only.
- **Ask first** → `defaultAction: hold` on a confirmation call. The vocabulary, the legality table and the directive plan exist; but calls are born from the model's declaration (contract `:20-22`), so making the agent *declare* in a situation is prompt text (weak, as concept §11 says) and *forcing* a hold-plus-call when it would have swapped is a deterministic gate in the evaluator — fence-class, like the guardrail pass.
- **Agent alone** → the default today; a play that says so binds to nothing new.

### Q8. The proof test

**What the growth replay provides in code** (`scripts/experiments/growth-replay/growthReplay.js`, VERIFIED): the corpus walk and eligibility gate (`plan`, `:921`; the reader `:269-290`), seeded sampling with a per-battle cap, the identity-block parser and the leans finder (`parseIdentity :296`, `findLeans :321`), span-safe edits for `strip | swap | loadout` with a byte-identity assertion outside the span (`applyVariant :374-404`, `assertOnlySpansMoved :411-420`), production's decision key (`decisionKey :506-515`, `originalKey :517-525`), batch submit/collect with caps, reconciliation and deletion, the permutation test with frozen bars, and a mutation-checked selftest (report `docs/audits/20261008_GROWTH_REPLAY_EXPERIMENT.md:427-449`, `:525-538` VERIFIED). It measures whether decisions change, not whether they improve (`:43`, `:457`).

**What the pilot's harness provides in code: nothing yet.** P7 — the advisory harness with an isolated store, injected clock and data seams, and the real executor — is specified (`PILOT_SPEC_V1_4.md:115-123` VERIFIED) and has no build report in `docs/audits/` (ls, VERIFIED); `PILOT_JOURNEY_MODE = 'off'` (`featureFlags.js:3148`). What exists are vitest doubles: the deploy harness drives the real deploy endpoint over an in-memory store with the clock pinned (`api/_utils/__fixtures__/deployHarness.js:1-9`, `:31-33` VERIFIED), the tick-capture harness proves the atomic batch (`tickCaptureHarness.js:1-20`), and P6's verification seam runs at `SWAP_IDENTITY_MODE = 'shadow'` (`featureFlags.js:3192`). None makes a model call.

**Missing to replay unseen moments with and without a play and score what happened next:**

1. A `play` variant that *inserts* a span (after the wisdom part, or as its own part) and extends the byte-identity assertion to an insertion — the replay only removes or replaces.
2. A holdout: a seeded split of moments by battle-day into seen (the ten drills) and unseen, recorded in the manifest.
3. A join from each moment to its tape: `checks[tickSeq]` → `scores`, `actions[]` → `replay`, `series/*` (§Q5).
4. A scorer for both measures per moment and per decision: points (the replay arithmetic for a swap; a hypothetical swap for a hold, which does not exist today) and price (`pctChange` over the series), each with class, horizon and the delay caveat.
5. The Charter's bar: policies not trades (M3, `AGENT_LEARNING_CHARTER_V1.md:33`), honest denominators, discovery/confirmation partition (P2, `:84`), and the T2 asymmetry for any play that touches protective exits (`:42`) — the replay's "moves decisions" labels are not "did better" labels.
6. A spend plan: about ten asks per moment at ~$0.02 standard / ~$0.01 batch.

### Q9. Learning today

**Writers and failure handling (all VERIFIED):**

- **Reflection** (`api/agent/reflect.js`): one Sonnet call per completed battle (`callSonnetReflection`, model `'claude-sonnet-4-6'` at `:216`); on any error the fallback `{ lesson: 'Reflection generation failed.', adjustment: 'N/A', … }` is written as the reflection (`:100-111`); the entry goes into a rolling five-game `agent.memory[]` window (`:274-281`; transactional forward to the parent of a casual clone `:287-296`); game-design feedback is written separately (`:143-151`). Because the error is caught inside the function, the battle's `pendingReflection` is cleared with the fallback in place; nothing retries. The queue is drained by `api/cron/process-pending-reflections.js` (`:12-15`, `:50-58`), which leaves `pendingReflection: true` only when the whole reflection throws (`:101-106`). `completeBattle` sets the flag for non-CPU battles (`agent-evaluate.js:6586`).
- **Consolidation** (`api/_utils/agentConsolidationApply.js`): every five games (`reflect.js:153-178`), one Sonnet call (`:325-340`, model `'claude-sonnet-4-6'` at `:16`); a failed call is logged and nothing is written (`:356-357`); on success `consolidatedInsight` and `disciplines` are applied (`:271-273`, `:302-304`). Its prompt reads the previous insight ("Previous consolidated insight", `agentConsolidationPrompt.js:125`) and the memory window (`:136-137`, formatted at `:194-195`).

**The mechanism behind "most reflections failed to generate".** The fallback entries are ordinary memory entries; the consolidation prompt formats all of them in. A paragraph that says most reflections failed is the model summarising five fallback lines. It is not candour about learning; it is the failure path becoming the wisdom.

**Counts (CENSUS).** 99 agents; 25 carry a memory window; **87 memory entries, 72 of them the literal fallback line (83 %)**, 15 real. By archetype (failed / ok): Trend Follower 21 / 1 · Capital Preserver 14 / 4 · Contrarian 12 / 4 · Diversifier 12 / 4 · Fundamental 9 / 1 · Speculator 4 / 1. Battles with `pendingReflection: true`: 0 (nothing is stuck; failures are "done"). Agents with a `consolidatedInsight`: 14, holding **7 distinct texts** — one of them is the two-character string `""` (a serialised empty string stored as text, on a `strategist` agent). 15 agents are clones (`rankedAgentId` set). Games played: 89 agents at 0, 8 at 1–4, 2 at 20+. Alive battles that froze a non-empty insight: 57 of 162. **Limit:** the memory window keeps five entries per agent, so failure history beyond the last five games is not recoverable from Firestore; the GCS shadow stream (`logReflection`, `reflect.js:114-130`) is outside this session's scope.

**What happens to a learned paragraph when the archetype changes: nothing.** The change transaction writes `archetype`, the re-seeded `equippedTraits`, the dial reset and the birth provenance (`api/agent/change-archetype.js:177`, `:253-262` VERIFIED), invalidates leans in a rider (`:363-370`), and never references `consolidatedInsight` or `memory` (`grep -n "consolidatedInsight|memory" api/agent/change-archetype.js` → none, VERIFIED). The next consolidation is then seeded with the old archetype's paragraph (`agentConsolidationPrompt.js:125`). Clones copy the paragraph at creation (`api/_utils/trainingClone.js:73`; `ensure-casual-clone.js:12`).

**The Contrarian claim: CONFIRMED.** LOCAL: the replay's donor text with hash `3c0b446b` opens by naming itself a diversifier eight cycles in, with five failed reflections in the cycle and no usable evidence; the run manifest maps that hash to 41 moments of the Contrarian agent `XtuHDmqXgu…` and 8 of a casual clone, all `archetype: contrarian`. CENSUS: the agent whose id has that prefix is `contrarian` today, is not a clone, and its live `consolidatedInsight` (hash `5ebd5208` of the raw text) opens with the same self-description; the same text sits on two Contrarian clones **and on two Capital Preserver (`guardian`) agents**; separately, a Trend Follower carries a paragraph in which the agent names itself a degen trader seven cycles in. (The paragraphs are agent-generated text; as in the replay report they are described here, not quoted.) The concept's decision 2 ("nothing crosses archetypes") is violated by two existing mechanisms, not one.

### Q10. Cost and limits

| Item | Value | Anchor |
|---|---|---|
| Production decision model | `claude-haiku-4-5-20251001`, `max_tokens` 3072, temperature 0.4 | `agentEvalTransport.js:48`, `:64`; `agent-evaluate.js:2886-2902` VERIFIED |
| Cost per ask (standard prices) | **$0.0206** at ~14,215 input / 1,285 output tokens; Haiku 5.5 **$0.0024** (and trades 2 % of the time) | replay report `:315-316` VERIFIED |
| Cost per ask (batch prices, as the replay ran) | ≈ $0.009 ($116.23 for 12,900 calls) | `:389`, `:357` |
| Reflection and consolidation model | `claude-sonnet-4-6` (not costed here) | `reflect.js:216`; `agentConsolidationApply.js:16` |
| Org-level usage limit | "You have reached your specified API usage limits" refused ten live checks on 8 Oct 14:45–15:46 ET and the replay's first batch at 19:48Z | week-1 read `:36`, `:286`, `:326`; replay `:575` VERIFIED |
| Spend caps in code | none platform-wide; the replay enforced its own ($150 / $185; the batch check $50 / $68) at plan and submit | `growth-replay/README.md:24`, `:42` |
| Per-route rate limit | in-memory 60 requests / minute per IP, reset on cold start | `api/_utils/rateLimit.js:1-20` |
| Player budgets | 10 chat messages per game-day (`agentChatBudget.js:36`), 10 per battle (`directiveFiling.js:97`), 5 review (`chat.js:380-383`), research cap 3 (`src/data/researchCap.js:36`) | VERIFIED |
| Evaluator budget | 290 s per cron run (`agent-evaluate.js:206`); 22 s call ceiling (`agentEvalTransport.js:14`); 20 s call timeout (`:2902`) | VERIFIED |
| Cron budget | **43 / 100** entries; prefer riding an existing handler | `vercel.json` (43 entries counted); `docs/BUILD_RULES.md:78` VERIFIED |

A camp that re-asks runs under the same key and the same org limit as production ticks; the week-1 read already asks the founder whether the limit is known and sized (`:326`). The concept's own arithmetic (one to two cents an ask, ten asks per proof moment) holds at standard prices.

### Q11. Watchlist creation

**On screen.** Watchlists are created from the Forge: the list panel's create button (`src/components/Forge/Watchlist/WatchlistListPanel.jsx:88-96` → `createWatchlist`), the workshop's watchlists area (`src/components/Forge/workshop/WatchlistsArea.jsx:66`, `:108`), and the agent-creation flow (`src/components/Agent/AgentCreationFlow.jsx:289`) VERIFIED. The Forge mounts as an overlay (`src/App.jsx:8625-8627`, `showForge`) and the editor is its own route `'watchlistEditor'` whose close returns to the Forge's `'watchlists'` view (`App.jsx:9858-9881` VERIFIED). The dashboard's scouting board is read-only — it ranks names and reads the equipped list, creates nothing (`api/agent/scouting-board.js:1-13`; `src/components/Dashboard/ScoutingBoardSheet.jsx:86` VERIFIED).

**In data.** `POST /api/forge/watchlists` creates the draft document (`api/forge/watchlists.js:87`, `:182-199`: `status: 'draft'`, `thesis`, `activationConditions`, `invalidationConditions`, `tickers`) and, under the record gate, mints the P2 research record for a manual list in the same commit (`:203-215`); commit mints hypothesis version 1 (`:534-550`) VERIFIED. Client service `src/services/forgeWatchlistService.js:100`. The equip side is documented in `docs/WATCHLIST_EQUIP_SYSTEM_REFERENCE.md:311-356` (card equip/unequip, the dashboard card, the battle indicator).

**What a move out of the Forge would touch** (no recommendation): the three create callers above; the editor route and its return path (`App.jsx:9858-9881`); the Forge landing's `watchlists` view and `forgeInitialView` state (`App.jsx:2490-2500`); the dashboard equip surfaces that list committed watchlists (`EquipStation.jsx`, `EquipSheet.jsx`, `DeployStation.jsx`, `desktop/EquipBench.jsx` — found by grep, not read); the Signal Drop → watchlist dialogue (`api/forge/watchlist-dialogue.js`, found by grep). Nothing in data moves: the records just built stay where they are, as the concept's decision 5 says. The Command Center core spec the move would be decided inside is not on `main` (§6).

### Q12. Where a camp would live

- **Routes.** Screens are string states in an `if` chain in `src/App.jsx` (`:8657` … `:9987` VERIFIED); the Film Room is `screen === 'filmRoom'` rendering `FilmRoomRoute` (`:9469-9474`; `FILM_ROOM_ROUTE`, `src/constants/filmTape.js:129`), entered from the in-battle banner (`:9450`), Battle History (`:9738`) and the dashboards' ReviewStation ("05 · Review", `src/components/Dashboard/ReviewStation.jsx:1-20`; mounted at `CommandDashboard.jsx:595` and `CommandDashboardDesktop.jsx:331` VERIFIED). A camp is a new screen state plus an entry on the same three surfaces, with the Film Room's "send to camp" as the fourth.
- **The Film Room v2 reserved header and footer.** Header `since-last-time`, `prepared-case`; footer `your-call`, `receipt` (`filmRoomCopy.js:240-241`; `FilmRoomScreenV2.jsx:225`, `:257-259`). All four are promised to the cards build (BA-47); a camp hook is a fifth name, not a tenant of these.
- **The Command Center hub.** The live dashboard is `COMMAND_DASHBOARD_ENABLED = true` (`featureFlags.js:23`); the Command Center Sync pass is dark (`COMMAND_CENTER_SYNC_ENABLED = false`, `:2026`); the cockpit screen is on (`COCKPIT_UI_ENABLED = true`, `:2898`). The hub helper `getReviewAvailability` still has no production caller (grep → `featureFlags.js` and the util only, VERIFIED; A2 report `:329`). The founder's ruling that the cockpit carries no verb in phase one (`COMMAND_CENTER_ARC_FOUNDATION.md:133` VERIFIED) bears on whether a camp entry may sit on the cockpit at all.
- **The flag pattern a new dark surface should follow.** A string tri-state pinned directly with a `// Pinned by:` pointer and its own allowed-values suite, named in the `DARK_BY_DESIGN` block (the `FILM_ROOM_V2_MODE` docstring and definition, `featureFlags.js:2960-2992`; `src/config/flagPinGuard.test.js:58-64`, `:183-197` VERIFIED) — or a boolean `*_ENABLED` registered in `DARK_BY_DESIGN`; the flip is its own PR that moves the pin in the same commit (BUILD_RULES §2 `:53`). Per-owner admission reuses the cockpit-status verdict's `allowlisted` field (`api/agent/cockpit-status.js:92` VERIFIED), as the Film Room does, with no uid in the client. A camp that writes drill records needs its own owner-read subcollection and rules rows (the `tape` / `series` block at `firestore.rules:519-523` is the model) and a rules-suite row.

---

## 3. Reuse table (concept §5–§9)

| Concept part | Status | What exists / what is missing | Anchor |
|---|---|---|---|
| §5 Five slots, carry limit | **Missing** | no play record, no slot count | §Q6 |
| §5 Counting limit (one camp a week, ten drills, one play) | **Missing** | no drill record to count | §Q8 |
| §6 We are down / good lead | **Partly** | own score, day, time remaining, phase live and stored; **opponent score absent from the prompt** and 0 for tournament battles | §Q2 |
| §6 Our stocks are not moving | **Partly** | stagnation counter live but not persisted; `evidence.chg` per check and 10-minute series stored | §Q2 |
| §7 Situation (checkable) | **Partly** | typed condition shape in hypothesis versions (`model.js:56-57`); no situation evaluator | §Q6 |
| §7 Call | **Partly** | the call record's typed declaration (`contract:24-31`) | §Q4 |
| §7 Whose call | **Partly** | `defaultAction act/hold`, directive gate; "ask first" deferred | §Q7 |
| §7 Wrong if | **Partly** | `condition {side, level}`, `invalidation[]` conditions | §Q4, §Q6 |
| §7 Record | **Missing** | no per-play ledger; Charter M1 episode grain is the rule | Charter `:31` |
| §7 Families: technical / allocation / game-dynamic | **Partly** | Forge rules and leans are the compile targets for the first two; game-dynamic needs the opponent term | §Q6 |
| §8.1 The film (Film Room picks hard moments) | **Partly** | tape + v2 screen exist; no picker, no tagger | §Q3 |
| §8.2 The drill (two blind calls, reveal, record) | **Partly** | call shape and legality table; re-ask proven in scripts; no drill screen, no server re-ask route, no drill record | §Q1, §Q4 |
| §8.3 The play (agent proposes, player accepts/edits/rejects) | **Missing** | no proposal call; design-note R2/R5 say v1 takeaways and cards are player-authored | §Q3 |
| §8.4 The proof (unseen moments, with/without, Charter bar) | **Partly** | replay script (edits, key, stats); no insertion variant, holdout or scorer | §Q8 |
| §8.5 The install at next week's open | **Partly** | enforced plays via equip endpoints freeze at battle creation; prompt-text plays need a fenced splice | §Q6 |
| §9 Your own film | **Exists** | tape per battle-day since 2026-09-21; 508 replayable bodies to 2027-01-20 | §Q1, §Q5 |
| §9 League film (market situation only) | **Partly** | tapes exist for every tiered battle; reads are owner-only (`firestore.rules:519-523`) — needs a server projection that strips rules and text | §Q12 |
| §9 Today's market (one blind call a day) | **Missing** | calls exist only inside a battle (`contract:17`); no daily route | §Q4 |
| §9 Public research (ideas) | **Partly** | research records P2 (`watchlists.js:203-215`), the research route (`research.js`) | §Q11 |
| §9 Setups already in the Forge | **Exists** | equipped rules on every arm-2 tick of the replay (`:100`) | §Q6 |
| §9 Past market days | **Partly** | 1-minute bars fetchable (`candlePass.js:44`); the model-knowledge caveat is the concept's own | §Q5 |
| §9 No TradingView scraping | n/a | nothing in the tree scrapes it | — |

---

## 4. Founder decisions the discovery surfaced

1. **The agent cannot see the score difference.** Add an opponent term to the live state (fence contact, one line) or keep "down / good lead" as player-side situations only. *For the player:* today the agent plays the same whether it is losing or winning; a "catch-up" play can only be enforced, not understood.
2. **Tournament battles record an opponent score of zero.** Define "down" for tournament play from the group composite (a new tape field) or confine the two game situations to vs-CPU scrimmages. *For the player:* without this, a tournament drill would tell them they were "tied" all week.
3. **Drill on the bytes or on the tape.** Bodies expire 120 days after capture (the first on 2027-01-20); the tape does not. A re-ask needs the bytes; a player-only drill needs only the tape. *For the player:* decides whether last season's moments can still be drilled with the agent next year.
4. **Fix reflection failure before building learning on it.** 72 of 87 reflections are the failure line, and consolidation turns them into "wisdom". *For the player:* until this is fixed, "what my agent learned" is the agent describing an outage.
5. **Archetype carry-over.** Clear or archive `consolidatedInsight` and `memory` on an archetype change and on clone creation, or accept cross-archetype text. *For the player:* a Contrarian today reasons from a Diversifier's paragraph.
6. **Build "ask me first" before "whose call" plays.** The `ask` / `keep` answers are deferred. *For the player:* "ask me first" would be a promise the game cannot keep.
7. **League film and privacy.** Tapes are owner-read; the pilot's privacy projection hides hypotheses from non-owners. A league-film source needs a sanctioned server projection. *For the player:* decides whether a new pair gets other players' moments at all.
8. **A drill verdict on a screen that forbids verdicts.** The tape's invariants forbid "who was right"; a camp screen must own that word under its own ruling (as R4 did for aggregates). *For the player:* whether the camp says "you were right" or only shows the two paths.
9. **Which model drills.** The production Haiku 4.5 at two cents, or Haiku 5.5 at a quarter of a cent that almost never trades. *For the player:* a cheaper camp whose agent never swaps teaches nothing about swaps.
10. **Where the play record lives.** On the agent (archetype-scoped, as decision 2 implies) or on the player; hypothesis-version-shaped or not. *For the player:* whether a play survives an archetype switch.
11. **The numbers in concept §6** (down by how much, with how long left; ahead by how much; flat for how long) and the "hard moment" ranking rule — all founder slots in §Q2 and §Q3.

---

## 5. Proposed build packages (smallest playable camp first)

| # | Package | Size | Fenced files | Depends on |
|---|---|---|---|---|
| P0 | **Player-only drill over the tape.** A dark route (`screen` state + tri-state flag, per-owner allowlist via cockpit-status), a pure tagger over `checks[] / actions[] / series`, a picker by tag, the blind-call form in the call record's shape, the reveal from `series`, `checks[].scores` and `actions[].replay`, and a server-written owner-read drill record with rules rows. No model spend. | Medium | **None** | tapes (live), decisions 2, 3, 8, 11 |
| P1 | **The agent's blind call.** A server route or cron rider that re-sends a stored body verbatim with a drill envelope under a spend cap and a usage-limit stop; validates with the production validator; stores the agent's call beside the player's. | Medium | **None** (reads bodies; imports the schema and validator, which are not on the §1 list) | P0; decision 9; the 120-day window |
| P2 | **Play record and proposal.** A hypothesis-version-shaped record on the agent; after N drills one proposal call; accept / edit / reject. | Medium | None for the record; the proposal prompt is a new, non-fenced prompt | P0, P1; decision 10 |
| P3 | **The proof.** The replay script gains an insertion variant, a holdout, the tape join and the two-measure scorer; labels and the Charter bar. Script-class, run by a human, ~10 asks per unseen moment. | Large | None (script; calls the fenced scorer) | P2; Charter M3/P2 |
| P4 | **Install, enforced plays.** Compile a kept play to a lean, a rule paramValue or a dial through the existing equip endpoints; effect at next battle creation. | Small–Medium | **None** | P3; the address rule |
| P5 | **Install, prompt-text plays and enforced "ask first".** A dark render module + one-import/one-call splice + `PROMPT_CONTRIBUTING_MODULES`; a deterministic hold-plus-call gate in the evaluator. | Medium | **Yes** — §7-class fence contact, founder-gated | P4; decision 6 |
| P6 | **Pattern counter and "send to camp" in Film Room v2.** The same tagger as P0, a count per week, a fifth reserved slot or a check-detail action. | Small–Medium | None | P0; the cards build's contract (not written) |
| P7 | **Prerequisites.** (a) Reflection failure root cause; (b) archetype-change and clone handling of learned text; (c) the opponent term on the tape and, if ruled, in the live state. | Small each; (c) part fenced | (c) only | decisions 1, 4, 5 |

---

## 6. Not found

- A Film Room row of any kind in `docs/README.md`; any document named "Phase 0C".
- A "cards build" contract; take-home card code; pattern-counter code.
- The P7 advisory harness (isolated store, frozen clock) as built code.
- Exit-dial code (only the tempo dial exists); the `ask` / `keep` answer routes.
- `COCKPIT_ALLOWLIST_UIDS` in either `.env.local` (so no VERIFIED per-allowlisted-player count).
- The Command Center core spec on `main` (`git ls-files docs | grep -i COMMAND_CENTER` lists the foundation, the sync framework, Pass 1 and two design briefs only).
- "Deployment brief" under that name in docs or code.
- A persisted stagnation counter; an opponent score in the evaluator prompt; a group-composite standing on any tick or tape field.
- A per-hold counterfactual on the tape (replays exist for recorded swaps only).
- A cross-owner (league film) read path for tapes.
- `consolidatedInsight` in `api/_utils/casualClone.js` (the replay's `casualClone.js:58` anchor; the string is in `trainingClone.js:73` and `ensure-casual-clone.js:12` at this HEAD).
- Any scraping of TradingView.

---

**End of discovery. Branch `claude/practice-field-phase0` · HEAD `93953d6248d1713f08ba21626ca67bc5e9fd2c89` · this report at `docs/audits/20261010_PHASE0_PRACTICE_FIELD_DISCOVERY.md`. Hard STOP: no PR, no merge, no CI watch.**


---

## Addendum A — the Film Room handover's six questions (10 Oct 2026)

**Prompt:** Fable, "Phase 0 follow-up — Practice Field discovery, Addendum A (read-only)", 10 Oct 2026 · **Attached:** `docs/design/20261010_FILM_ROOM_TO_PRACTICE_FIELD_HANDOVER.md`, committed byte-identical with this addendum (SHA-256 `e077e58d0c033ae242451053cd2d8712c3a399fb8045be7eb83ad34e98d0d637`) · **Tree:** the same session, `git fetch origin` re-run; product code unchanged since `93953d62` (this branch holds docs commits only), so every VERIFIED anchor below was re-read at the same code. Read-only on product code; no Firestore reads were needed for these answers; no model calls. The earlier sections of this report are untouched; where an answer here corrects one, it says so.

### A1. The opponent's score at each check

**Where it is stored.**

| Record | Opponent score? | Anchor |
|---|---|---|
| Permanent tick `scores.{active, banked, total, opponent, bankedBadgePoints}` — **yes, per check** | the values the tick wrote | `api/_utils/tickCapture/captureWriter.js:324-328`; written from the same numbers as the battle document, `api/cron/agent-evaluate.js:1283-1290` VERIFIED |
| Battle document `scoreState.opponentScore` | latest only | `agent-evaluate.js:1273` VERIFIED |
| `evaluations[]` entry `scores: { active, banked, total }` | **no** | `agent-evaluate.js:4140-4144` VERIFIED |
| Status-feed entries | **no** score fields (the only score-adjacent line is a trade-id counter) | `agent-evaluate.js:1985`; grep over every `statusFeedEntries.push` VERIFIED |
| Cockpit call records | **no** — the contract's fields carry symbol, direction, condition, horizon, evidence, states; no score | `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md:52-67` VERIFIED; the tape's copy has none, `api/_utils/filmTape/tapeAssemble.js:681-712` |
| The tape today | once per day in `score.lastCheck.opponent` and in `battle.final.opponent`; **not** per check — `checks[].scores` keeps active/banked/total only | `tapeAssemble.js:730-732`, `:791`; `scoresOf` at `:158-160`; declaration `src/constants/filmTape.js:167`, `:174`, `:177-179` VERIFIED |

**Could the tape writer copy it as a recorded field?** Yes. The source is a platform write on every admitted tick, so it meets BA-21's `recorded` class. It would touch, all non-fenced: `scoresOf` in `api/_utils/filmTape/tapeAssemble.js:158-160` (add `opponent`); the declaration `src/constants/filmTape.js:177-179` (add `checks[].scores.opponent: 'recorded'`); the declaration golden `api/_utils/filmTape/tapeExport.test.js:193` and the committed screen fixtures that must equal the passes' output (`screenFixtures.test.js`, build report §2.2); the screen only if it is to render it. Checks rebuilt from an `evaluations[]` entry when capture missed (`tapeAssemble.js:208`) would carry `null`, since entries never had it. Tapes already written keep their stored declaration and are labelled by it (BA-48 `AMENDMENT_E:36-37`); the close pass is backfillable (BA-15, spec `:62`) and merge-monotone (BA-19), so a re-run that re-reads the ticks gains the field.

**By opponent kind.**

- **Against the CPU** (`baggerbomb_agent`): the self-select deploy embeds the CPU portfolio (`api/agent/decide.js:1003`), the evaluator scores it every tick (`agent-evaluate.js:1067`, `:1256`), and the tick records the result. Copyable as-is.
- **Against a player** (`baggerbomb_tournament`): the tournament deploy passes `opponent: null` by founder ruling D4 (`decide.js:1493`), so the tick's `scores.opponent` is 0 — the sum over an empty portfolio — on every check. The real standing is the group composite, `agent + K × user`, whose one home is `computeComposite` (`src/constants/leagueTournament.js:905-911` VERIFIED); it is computed live on request by `GET /api/tournament/live-composites` from each rival's `scoreState.currentScore` plus this-request user quotes (`api/tournament/live-composites.js:1-20` VERIFIED) and banked nightly through the snake-draft daily-scores handler (`api/tournament/bank-daily-scores.js:1-9` VERIFIED). **Nothing stores a per-check rival composite.** The tape writer can copy the day's banked standings (one per day, from the group document) but not a per-check one; that needs the evaluator to write it on the tick (a capture-allowlist change in `api/_utils/tickCapture/captureSerializer.js`, non-fenced, but a new field on the permanent record and a read of the group during every tick).
- **With no opponent:** the CPU's own battles (`isCpu: true`) run passive with no checks (`captureConfig.js:114`). For a tournament battle "no opponent" is the stored truth, and a reader cannot tell its 0 from a tie: the tape's `resolveResult` treats a *missing* opponent as `unavailable` (`tapeAssemble.js:751-767`), but 0 is a number. A copied field should therefore carry a basis — `cpu_portfolio` when `battle.opponent` is set, `none` when it is null (the close pass already reads the battle document) — or the counter will find "tied all week" on every tournament day.

### A2. Declined and expired proposals

**Two families exist, and neither has a "declined" record today.**

1. **Swap proposals (`pendingProposal`).** The server creates one only in co-pilot or manual mode (`agent-evaluate.js:3944-3975`: `proposalId, evalId, symbolOut, symbolIn, tier, slotIndex, conviction, rationale, hypothesis`, a technical snapshot per leg, a 10- or 15-minute TTL). The launch guard forces autopilot and clears any proposal it meets, and "no server path has created a proposal since this guard landed (84254065, merged in PR #421 on 2026-05-20)" (`agent-evaluate.js:4947-4980` VERIFIED). So every proposal that exists is a **client-written** record: `resolveProposal` in `src/services/agentService.js:583-597` writes `pendingProposal` with `resolution: 'vetoed' | 'approved'`, `resolvedBy: 'coach'`, `userReason` (owner update of that key is allowed, `firestore.rules:455-458`), from `ProposalBanner.jsx:267` / `ProposalCard.jsx:95`, mounted in `AgentChat.jsx` and `AgentBattleScreen.jsx` (grep VERIFIED). The guard then files a history row that keeps **only what the record named**, as capped tokens — `proposalId, symbolOut, symbolIn, mode, createdAt, expiresAt` — plus `resolvedAt`, `resolution: 'launch_guard_cleared'`, `resolvedBy: 'system'`, `systemNote`, `scoreAtResolution` (`api/_utils/historyRows.js:72-85`; `agent-evaluate.js:4969-4978` VERIFIED). The veto branch with veto-time prices (`:5245-5268`) and the expiry branch with `resolution: 'lapsed' | 'auto_executed' | …` (`:5488-5507`) are unreachable while the guard holds. **Retention:** `proposalHistory[]` on the battle document, last 50 rows (`:4976`, `:5264`, `:5506`), battle lifetime.
2. **Gameplan meetings (`gameplanMeeting`).** The trigger writes the meeting (owner-writable) and a server copy `cronState.gameplanMeeting` in the same update (`agent-evaluate.js:2520-2527`); its legs are `suggestedSwaps[{ symbolOut, symbolIn, rationale }]` (`:6534-6538`) with an end-of-day expiry at 16:00 ET (`:6542-6545`). Resolution is approve (the client sets `status: 'approved'`, `src/services/agentService.js:625-630`; the server executes and files the row, `:6352-6360`) or expire (`{ …meetingHistoryBase(meeting), status: 'expired', resolvedAt, resolvedBy: 'system' }`, `:6398`). Rows go to `gameplanMeetingHistory[]`, **uncapped** (`historyListOf` returns the array whole, `api/_utils/playerFieldReaders.js:63-65`; `resolutionWrite` `:6041-6045`), battle lifetime. There is no decline path: the code knows approved and expired only. The approval card (`GameplanMeetingCard`) renders from `AgentActivityFeed.jsx:762` when a meeting is pending; whether that feed is mounted on the live battle screen was not re-verified (Phase 0 handback G-2 recorded it as unmounted).

**On the tape:** nothing of either family is copied — `proposal_pending` and `gameplan_pending` are check states only (`src/constants/filmTape.js:49-55`; BA-8), and the tape code has no reader of `proposalHistory` or `gameplanMeetingHistory` (grep over `api/_utils/filmTape/*.js` and `api/cron/film-tape-close.js` → none, VERIFIED).

### A3. The stagnation rule

**Where it is defined: four files, one importable arithmetic, three sources of numbers.**

| Piece | Where | Fenced? |
|---|---|---|
| The thresholds per archetype, `hftConfig.forcedRotation { enabled, pctThreshold, ticksThreshold, maxTickAgeMinutes, winnerThreshold }` — e.g. Trend Follower 5 ticks at 0.15 %, Contrarian 6 at 0.30 %; Capital Preserver disabled | `api/_utils/agentArchetypeConfig.js:49`, `:80`, `:109`, `:136`, `:165`, `:197-199` VERIFIED | yes |
| The tempo dial's scaling of `ticksThreshold` (`round(ticks ÷ mult)`, ≥ 1); every other forced-rotation field untouched | `api/_utils/tempoDialClamp.js:33-38` VERIFIED | no |
| The counter: per tick per symbol, `|Δprice| / price < pctThreshold` → increment, else reset; paused when the tick age exceeds `maxTickAgeMinutes`; `withinAge` transient | `updateStagnationCounter`, `api/_utils/agentRiskManager.js:200-232` VERIFIED | yes (exported; importing is permitted) |
| The fire: inside `evaluateRisk`, `SWAP_OUT`, `reason: 'stagnation'`, `source: 'archetype'` when `fr.enabled ∧ cronMemory.withinAge ∧ stagnationTicks ≥ fr.ticksThreshold ∧ dailyPct finite ∧ dailyPct < fr.winnerThreshold`; priority 5 of 5, after bust, VWAP failure, LOCK and TRAIL | `agentRiskManager.js:181-192`, order at `:103`, `:174` VERIFIED | yes (exported) |
| The loop that threads it, and the resets on replacement | `agent-evaluate.js:1777-1803`, `:2148`, `:3888` VERIFIED | no |

**Persistence — a correction to §Q2 above.** §Q2 said the counter "is not persisted". That is wrong: the per-symbol counter **is** persisted on the battle document. It is seeded from `battle.cronState.stagnationTicks`, `lastTickPrice`, `lastTickTimestamp` (`agent-evaluate.js:1682-1684` VERIFIED) and written back at every flush by `finalizeCronState` (`api/_utils/agentCronState.js:35-45` VERIFIED). Only `withinAge` is transient (`agent-evaluate.js:1681`; `agentRiskManager.js:216-221`). What stays true: it is on neither the permanent tick (no `cronState` path in `captureSerializer.js`, grep VERIFIED) nor the tape (`tapeAssemble.js:847` reads only `cronState.tickSeq`), so an after-the-fact reader still rebuilds flatness from `evidence.chg` and the series; a **live** counter can read `cronState.stagnationTicks[symbol]` straight off the battle document.

**Importability.** The arithmetic is one import (`updateStagnationCounter`, plus `evaluateRisk` for the fire). The numbers are not: a new direct importer of `agentArchetypeConfig.js` trips the §2.3 import-boundary ratchet (`docs/BUILD_RULES.md:28`; `api/_utils/archetypeImportBoundaryBaseline.json` — "new consumers go through archetypeRegistry" VERIFIED). The registry adapter exposes `physics.hftConfig` (`api/_utils/archetypeRegistry.js:147`, `:276` VERIFIED), so a counter should take `forcedRotation` from `getArchetypeDefinition(codeId).physics.hftConfig`, apply `tempoDialClamp` for the battle's dial, and read the battle's own `cronState` counters — three sources, no table import. A counter that replays the tape at 15-minute checks must also mirror the 20-minute tick-age guard, or it will count ticks the live rule paused on.

### A4. League film

**An existing server-side pattern — projection at the read boundary, not a copy.** The spectator path: `GET /api/tournament/battle-view` reads owner-only battle documents through the Admin SDK and returns each one projected for the requester; no write, no cron, no rule change (`api/tournament/battle-view.js:1-17` VERIFIED). The projector is built from **allowlists**, so a field added later cannot leak by default (`api/_utils/tournamentBattleView.js:25-30`); owner or completed → unchanged, minus the frozen hypothesis for non-owners; active non-owner → WHAT-only (`:97-112` VERIFIED). `live-composites.js` does the same for scalars ("never rival holdings/positions/reasoning", `:4-7`). **A "write a de-identified copy elsewhere" pattern does not exist.** Server-written derived records exist — `agentEvalRuns` (`agent-evaluate.js:595`), `battlePatterns` under the agent (`api/_utils/battlePatternLogger.js:1-4`; owner-read, `firestore.rules:442-446`) — but they stay under the owner's own documents, and the GCS shadow stream carries uids (`api/_utils/shadowLogger.js:1-14`). So league film has two honest shapes: an allowlisted projection endpoint over the tape (the battle-view pattern), or a new server-written extract collection modelled on the tape writer itself (reads owner-only sources, writes only its own collection, BA-1 style). Either leaves `firestore.rules:519-526` untouched.

**Tape fields that hold a person's or the agent's words** (the drop list, from the assembler):

| Field | Whose words | Anchor |
|---|---|---|
| `directives[].playerText` | the player | `tapeAssemble.js:605` |
| `directives[].canonicalText`, `retainedDirectiveText` | the stored directive | `:606`, `:612` |
| `directives[].agentReply` | the agent | `:613` |
| `plans[].signalSummary`, `plans[].threshold` | the agent's plan prose | `:642-643` |
| `rationale[].rationale`, `rationale[].hypothesis` | the agent | `:656-668` |
| `battle.completionMessage` | platform-composed, may embed names | `:777`, `:802` |

Platform-written text an extract should treat as text, never as a number: `coverage.*.note` (composed from reasons, `:983-1069`), `passes.close.lastError` (`:1106`), `actions[].replay.label` and `lockedBasisNote` (`api/_utils/filmTape/tapeReplay.js:342-346`), `plans[].price.note` and the candle pass's coverage notes (`candlePass.js:184-193`, `:233`, `:252`, `:359`). The copied `calls[]` already drop `said` (`tapeAssemble.js:681-712`). To be unjoinable, also drop the identities: `battleId, ownerId, agentId` (spec `:77`), `directives[].threadId`, and the `evalId` / `tickId` keys on checks, plans and rationale. **The screen's one list** is the `Quotation` binding: every recorded-words path renders through `<Quotation doc path by at>` and nothing else may (`src/screens/filmRoomV2/FilmRoomKit.jsx:16-18`, `:236`), with call sites at `FilmRoomStudy.jsx:344` (directive row keys), `:427`, `:431` (plan prose), `:455` (rationale entries) and `completionMessage` (`FilmRoomQuotation.writer.jsdom.test.jsx:183`); the writer test enumerates the planted strings per tape path (`:48-52` VERIFIED). An extract's drop list can be pinned equal to that set of paths.

### A5. Hosts

**(a) One shared registry of system-checkable situation definitions.**

| Candidate | Fit | Cost / what it touches |
|---|---|---|
| **A versioned code module** — the `archetypeAdjustments.js` precedent: zero-import, Node-clean, entries `{ id, canonical, canonicalTextVersion, policy }`, validated by the directive gate | Best fit: shared, deterministic, importable by the tape writer, the counter, the screen and the camp; thresholds are founder slots changed by PR, like the archetype table | `src/data/archetypeAdjustments.js:1-8`, `:91-96`; gate `api/agent/file-directive.js:227` VERIFIED. One module + tests; nothing stored changes; every tag written anywhere carries `situationId + version`, as leans pin `adjustmentId + canonicalTextVersion` (design note `:284`) |
| Hypothesis records (`watchlists/{id}/hypothesisVersions`) | Wrong scope: per idea, per player; its typed conditions are symbol-level `{ symbol, side, level, basis }` | `api/_utils/hypothesisRecords/model.js:51-66`; rules `firestore.rules:1192-1196` |
| A new collection (`situationDefinitions/{id}`) | Only if definitions must change without a deploy | rules block + `test/rules` row, a fail-closed reader with defaults, the same class discipline as the tape |

**(b) One ledger where a Film Room card and a Practice Field play are stages of the same entry.**

| Candidate | Fit | Cost / what it touches |
|---|---|---|
| Idea records (`hypothesisVersions`) | The **write discipline** is the model (server-only writers with `opId` idempotency and expected-version checks, `api/_utils/hypothesisRecords/store.js:152`, `:210`, `:261`; lifecycle envelope); the **scope** is not — a card is a moment, not an idea | — |
| "The agent's record ledger" (the Forge Record Ledger) | Not built: the Forge Record Phase 0 found no promotion path and no canonical manifest (`docs/audits/2026-09-12_FORGE_RECORD_PHASE0_DISCOVERY.md:14-34` VERIFIED); design note R3 names it as the home (`:51`). What exists under the agent today: `rules`, `bundles` (protected stores, `api/_utils/compositionProtectedStoresScan.js:72-77`), and `battlePatterns` — server-only writes, owner read, one record per completed battle (`firestore.rules:442-446`; `battlePatternLogger.js:1-4`) — the closest existing shape | Building the Ledger is the Forge Record stream's own arc |
| **A new `agents/{agentId}/plays/{playId}` subcollection** (or `cards`): server-only writes, owner read through the agents `get()` pattern, stages as a lifecycle envelope `card → nominated → drilled → proposed → proven → installed → retired`, each stage stamped with the situation id + version and the tape path it came from | Fits both the card and the play; survives an archetype switch only by decision (§4 item 10) | Rules block + `test/rules` row; a write helper modelled on `hypothesisRecords/store.js`; a flag; no index until a cross-agent query exists. `agents` is a protected store, so any write to `agents/{id}` itself must be allowlisted in `compositionProtectedStoresAllowlist.json` (its `_comment` VERIFIED); a subcollection under a new name is outside `PROTECTED_COLLECTIONS` and unscanned. Writers: the Film Room (the card) and the camp (the play), both non-fenced; the install step's compile targets are the existing equip endpoints (§Q6) |

### A6. What the player has already seen

**Nothing per tape day or per moment.** The only "seen" record in the Film Room is the v2 first-open notice, kept once per viewer in `localStorage`, written when shown, with no server write (`src/screens/filmRoomV2/filmRoomSeen.js:1-17`, `:37-47` VERIFIED). The legacy screen writes nothing on open (grep for document writes and shadow-log calls in `src/screens/FilmRoomScreen.jsx` → none, VERIFIED). `dailyReviews[]` is the batch-review cron's own output, not an open (`api/cron/agent-batch-review.js:341-360`); `reviewBudgetUsed` counts review-chat messages (`api/agent/chat.js:380-383`), a weak proxy for attention, not a record of what was studied. A drill therefore needs a new owner-read record of opened days and moments — server-written through an endpoint, since the tape's rules block forbids client writes (`firestore.rules:519-526`).

### The handover's three "not on the tape" statements (§1)

1. **"The opponent's score at each check … appears only in the final result." — PARTLY REFUTED.** On the tape it appears once per day (`score.lastCheck.opponent`) and in the final; per check it is on the permanent tick, which the writer can copy (A1). For tournament battles it is 0 by construction wherever it appears.
2. **"Proposals the player declined or let expire, with their symbols … may not keep what was declined." — CONFIRMED for the tape, with a correction about the record.** The tape copies nothing of either family. The battle document keeps guard-cleared proposals (symbols, created and expiry instants, as capped tokens, last 50) and gameplan meetings (legs with symbols, expiry, approved or expired, uncapped). No record of a player *declining* exists today, because no decline path exists (A2).
3. **"Structured predictions … hypotheses are prose, with no separate fields for the call, the window and the 'wrong if' line." — PARTLY REFUTED.** Rationale and hypothesis are prose on the tape (`tapeAssemble.js:656-668`). But the cockpit's call records are structured predictions — symbol, direction, `condition { side, level }`, a horizon with a market-time `expiresAt`, a `defaultAction` (contract `:24-31`, `:52-67`) — minted for allowlisted owners since the 6 Oct flip, and the tape copies their typed fields into `calls[]` (`tapeAssemble.js:681-712`; BA-16), unrendered. What is missing is the "wrong if" line and any structure on the free-text hypothesis; the pilot's `structuredClaim` (P4) is not built (`PILOT_JOURNEY_MODE = 'off'`, `featureFlags.js:3148`). One nuance on the handover's §3 item 3: the evaluator is `api/cron/agent-evaluate.js`, which is not on the §1 fence list, but extending the model's output schema is fenced-class review regardless of path (contract `:35`), so the handover's conclusion — a framework-arc item — stands.

**Contradictions with the sections above:** one, stated in A3 — §Q2's "not persisted" for the stagnation counter is corrected; the counter lives on `battle.cronState`. §Q2's conclusion that the tape must rebuild flatness from evidence and series is unchanged.

**End of Addendum A. Branch `claude/practice-field-phase0` · base `93953d62` · no PR, no merge, no CI watch.**
