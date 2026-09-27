# Film Room Build A — The Tape · Spec V1.2

**Date:** 2026-09-27 · **Author:** Fable (Film Room chat) · **Executor:** Opus (Claude Code) · **Supersedes:** V1.1 (2026-09-26)
**Status:** build-governing once committed to `docs/specs/`. Folds every finding of the Sep 27 Astra review (`docs/audits/20260927_ASTRA_REVIEW_FILM_ROOM_SPEC_V1_1.md`); no further spec round. The A1 branch review verifies the folds in code.
**Slot:** A1 builds Sep 28–Oct 2 and merges before the hub build. A2 builds in its own later slot ahead of the Film Room screen flip. Nothing player-visible from this spec lands before the Sep 30 beta.

**Governing inputs (all on `main` before the build gate):**
- `docs/2026-09-22_CC_ARC_ANSWERS_TO_FILM_ROOM.md` — the HEAD pass at `463a375f`. Every `file:line` below is that document's, at that SHA; the build re-locates each one.
- `docs/FILM_ROOM_REVIEW_LOOP_DESIGN_NOTE_V1_3_20260915.md` — the design; founder rulings R1–R16.
- `docs/audits/20260915_PHASE0B_FILM_ROOM_DISCOVERY.md`, `docs/audits/20260915_PHASE0A_ARCHETYPE_IDENTITY_INVENTORY.md`.
- `docs/specs/CAPTURE_BUILD_SPEC_V1_4.md`, `docs/audits/20260921_BUILD_TICK_CAPTURE.md`.
- `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` (read-only; the cockpit arc owns it).
- PR #896 (deferred beat) — `agentEvalRuns/{runId}` and `tickMs`.
- `docs/audits/20260927_ASTRA_REVIEW_FILM_ROOM_SPEC_V1_1.md` — the review this version answers.
- `docs/BUILD_RULES.md` §1–§9.

**Changes from V1.1 (review disposition in §14):** replay arithmetic corrected (BA-11); merge-monotone writer (BA-19); coverage statements on every section (BA-20); provenance classes on every number (BA-21); "biggest swing" and plan highs/lows removed; risk-row and directive-card wording fixed (BA-7, BA-9); attributed historical quotation replaces the "no agent voice" contradiction (BA-22); price-at-check defined as the last completed minute (BA-11); hub helper narrowed (BA-17); call-record provenance (BA-16); candle retry path (§6); ghost-leg gate softened to degrade-not-guess (§9).

---

## 1. What Build A is

Build A is the **tape**: a server-written, per-battle-day record of what happened, and a screen that reads it. It replaces the current Film Room's arithmetic (a day score that omits held positions), its trade rows (the sold stock's numbers only), its LLM self-grade, lesson and proposed rules, and its ungrounded chat, with computed facts.

It is facts only. No character verdict, no lesson, no takeaway, no tomorrow's card, no new agent narration. Those are Builds B and C (design note §4, §7, §8) and wait on the formalization session and the Forge Record stream.

**A1 — the record** (this week's build, one flag, zero fenced files):
1. **The close pass** — a cron that writes `agentBattles/{id}/tape/{etDate}` for every tiered battle active on the trading day, the same night.
2. **The candle pass** — a cron the next morning that fetches prior-session bars and fills the swap replay, plan prices and the deep-dive series.
3. **The hub helper and the founder read-out** — `getReviewAvailability` (§11) and a read-only export script that prints a tape day as markdown.

**A2 — the screen** (its own later slot, one flag): Film Room v2 reading one tape document per day (§7). Specified here so the whole was reviewed once.

Everything the tape says is traceable to a field the platform already writes, or is labeled by its provenance class (BA-21). Where the platform doesn't write a fact, the tape says so rather than inferring it (§8).

## 2. Why the tape must be its own record

- `ticks` and `tickBodies` are **denied to every client** (§F2). A screen cannot read capture; a server-side pass can.
- `evaluations[]` is **capped at 150** (`agent-evaluate.js:3938`) — about four days at `*/15` over nine UTC hours. On a multi-day battle, early days' plans (`candidates[]`), heard stamps, evidence stamps and rationale fall off the battle document, and none is on the permanent tick record (§F2). The tape copied the same night keeps them — and, per BA-19, keeps them across later runs.
- `trades[]` is capped at 50 (DCR-012); `ticks.actions[]` is not.
- The Film Room subscribes to the whole battle document today (PLC-008). One `getDoc` on a small per-day document is the `intradayViews` pattern (§D5).
- The hub needs a readiness signal that is not a new field on the battle document (§11).

## 3. Rulings (BA-1 … BA-22; approve-by-default for Flash)

| # | Ruling |
|---|---|
| BA-1 | **The tape writes only its own subcollections** — `agentBattles/{id}/tape/{etDate}` and `…/tape/{etDate}/series/{symbol}` — never a field on the battle document, never `ticks`, never `calls`, never any other collection. |
| BA-2 | **Reads are server-side.** The close pass reads `agentBattles/{id}`, its `ticks`, `calls` and `declarations` subcollections (Admin SDK, as `scripts/export-tick-capture.js` does), `learningReceipts/{id}/receipts`, and the day's `agentEvalRuns`. Bodies (`tickBodies`) are never read. |
| BA-3 | **Scope: tiered BaggerBomb battles, stocks.** flat6/tournament battles get a tape document with `passes.close.status: 'skipped_mode'` and nothing else; crypto legs get `replay: null, reason: 'crypto_not_supported'`. |
| BA-4 | **Headline until C-5 lands:** "Recorded score at 3:45 PM ET" — the score at the day's last admitted check with its time, never called "close." **Day change** is last-check minus the prior day's tape last-check (`basis: 'prior_day_tape'`); on the battle's first day, minus the battle's starting score (`basis: 'battle_start'`); otherwise `null` with `basis: 'unavailable'` — never a silent substitution. **Battle result** is stored separately from any day's score: only for a completed battle, from the completion scores, with the same comparison completion uses (`agent-evaluate.js:5637`), `basis: 'derived'`; when a stored `result` exists on the battle document the tape reads it with `basis: 'stored'`. On earlier-day views the screen shows the eventual battle result apart from that day's score, never as that day's outcome. |
| BA-5 | **Actions come from `ticks.actions[]`** (permanent, uncapped), joined to `trades[]` on `(swappedOutAt, symbolOut, symbolIn)` and to the learning receipt on `(symbolOut, symbolIn, timestamp)`. An action with no matching trade is still an action; `tradeMatched: false`. |
| BA-6 | **Mechanism, not level.** Each action shows who made the exit from `source` and `exitReason` (design note §4.3) and the line that fired by name. Exit levels are not stored (§F1 C-3); the tape never states a level it did not read. A platform-forced exit is always shown with its source before its result; the screen never emphasizes a profitable row over who made it. |
| BA-7 | **Per-check risk verdicts are shown as recorded decisions, never as inspections.** `ticks.risk.verdicts.{sym}.{action, reason}` renders as "Risk decision recorded: HOLD" or the mechanism name for a fire/LOCK, with one note per screen: "This does not show which protections were armed or checked." A check with **no risk record** renders "No risk decision recorded" — distinct wording, never HOLD, never blank. No protection record accrues in Build A. |
| BA-8 | **Check states** (§A3, PR #896): `no_trigger` → *no check woke*; `budget_skipped` (entry `haikuError.failureClass` or tick `model.failureClass`) → *check skipped · budget*; a battle id listed as deferred in `agentEvalRuns/{runId}` for the day → *check deferred · budget* at that run's time (`tickSeq: null, runId`); `gameplan_pending`, `proposal_pending`, `degraded_quotes`, `cpu_passive`, `tick_error` by name; a `tickSeq` in range with no document → *no record for this check*; a day with zero tick records for an active battle → *capture absent* with facts from `evaluations[]` only. A run record's truncated deferred list is recorded as `deferralsTruncated: true` and **displayed** at the checks section, never as "no deferrals." Present ticks never imply complete plans, evidence, directives or trades — each section's coverage (BA-20) says what it has. |
| BA-9 | **The directive card reads `chatExchanges[]`**, one card per `directiveThreadId`. Labels: **"You asked"** = `userMessage`; **"Directive filed"** = the exchange's `directive.text` (canonical) with `filedAt`; status from `archetypeGate`: *committed* (`status: 'committed'`) · *no change* (`status ∈ {no_change, no_proposal, invalid_id}` — the card says "No new directive filed" and names the retained directive only from the previous committed exchange's `directive.text` when one exists, else "none in force") · *not filed* (`status: 'fit_mismatch'` — "No new directive filed"; proposed text is never shown under "Directive filed"). `originalUserAsk`, `counterOfferText`, `rejectionReason` are never rendered. **Heard** = the first entry after the filing whose `evaluations[i].heard.directiveThreadId` matches with `suppressed === null`, or the first `ticks.controls.directiveThreadId` match with `directiveSuppressed === null` when the entry has been evicted (§B1) — rendered as "Reached the agent's inputs at HH:MM" (recorded receipt, never agreement, understanding or obedience); no stamp → "Receipt unconfirmed." The chat reply, when shown, is labeled **"Chat reply at the time"** and the filing status is authoritative over anything the reply claims (BA-22). The card states the gap and never explains or excuses it. The aftermath (`after: { checks, holds, swaps }`) is stored as counts of what followed and rendered as sequence only — "7 checks followed: 7 holds" — never as compliance or defiance. |
| BA-10 | **Plans are copied verbatim** from `evaluations[].candidates[]` with the entry's `evalId`, `tickSeq` and time; the candle pass adds **only** the symbol's price at the plan's time and at the day's close, each with its provenance, and the note "prices shown to the day's close, which is not the plan's horizon." No highs or lows after the plan, no success colors, no ranking. **No verdict** (R15). |
| BA-11 | **The replay is rebuilt, corrected, and says so.** Two paths, both through the day's close, both from prior-session 1-minute bars sampled at the battle's check times and scored with `calculateAssetScoreServer` imported from `api/_utils/agentScoring.js` (BUILD_RULES §4), extremes empty: **hold path** = the sold name scored from its original entry as if never sold (`ghost.atClose`, rebuilt); **swap path** = the recorded `lockedPoints` banked by the sale **plus** the bought name scored from the swap (`bought.atClose`, rebuilt). `gapPoints = (lockedPoints + bought.atClose) − ghost.atClose`, labeled "one-step hypothetical through the day's close; later trades in this slot are not replayed; not the effect of the swap on the battle," and `subsequentTradesInSlot` is stored so the screen marks both continued lines hypothetical when it is > 0. **Price at a check** = the close of the last 1-minute bar that completed at or before the check's `capturedAt` ("last completed minute before the check"), never the bar containing the check. `reconciliation.closedLegDelta` (rebuilt ghost value at the swap time − `lockedPoints`) is stored **and shown** beside the fork; agreement at the sale is stated as agreement at the sale, not as accuracy afterward. Rebuilt lines are drawn in a distinct style with visible labels and visible gaps where inputs are missing. |
| BA-12 | **Deep-dive series are stored as 10-minute bars** aggregated from 1-minute bars, in `series/{symbol}`, provenance `market`. The level engine is **not** in Build A (R7, R9, R10). |
| BA-13 | **Comparables:** market = `SPY` (with `RSP` stored, taxonomy §1.3.1); sector = `TICKER_TO_SECTOR[symbol]` from `api/_utils/rankingConfig.js`, never the stored sector string. |
| BA-14 | **Intraday diagnostics:** when `agentBattles/{id}/intradayViews/{evalId}` exists, the tape records `diagnostics.intradayViews: 'present'` and the screen links to it from its own **Diagnostics** area — never inside or under any section titled "Why?" — with the header *Diagnostic · recorded at the check · not seen by the agent*. |
| BA-15 | **The writer is per battle-day and backfillable.** `writeTapeDay(battleId, etDate)` is called by the close pass for today and by an admin-invoked backfill for a date range. The writer-flip PR backfills every tiered battle-day since the capture flip (2026-09-21). Days before Sep 21 are not backfilled by default. |
| BA-16 | **Call records are copied as observed snapshots.** When `agentBattles/{id}/calls/*` exists, the tape copies each call minted or resolved on the day — typed fields only (`callId, kind, origin, horizon, mintedAt, expiresAt, state, resolvedAt, evidence.tickId, evidence.priceAsOf, hypothesisRef`, symbol and direction when present) — with `copiedAt`, `contractVersion: 'V1.4'`, `tapeWriteMode` (the `CALL_RECORDS_MODE` value when this tape run wrote), and `recordMode` only if the call record itself carries its minting mode (else `null`, never inferred). `state` is the state **observed at `copiedAt`**, not a reconstruction of that day; a backfilled tape says so by its `copiedAt`. "Copied" means the source recorded this, not that it is correct. No text is copied; nothing is rendered in A1; nothing is written back. |
| BA-17 | **The hub reads readiness through one helper** (§11) that returns exactly `{ ready, target, availability }` where `availability ∈ 'ready' | 'pending' | 'unavailable'` — the one piece of metadata invariant 8 permits. No stage, no reason, no score, no content. |
| BA-18 | **A founder read-out ships with A1:** `scripts/export-film-tape.js --battle <id> --date <etDate>` (and `--recent <n>`) prints a tape document, its coverage and its series summary as markdown, Admin SDK, read-only, no network. |
| BA-19 | **The writer is merge-monotone; a later run never loses information.** `writeTapeDay` reads the existing tape document first. A section is replaced only when its source is present and at least as complete as the stored copy (by count and span); a section whose source has since been evicted or is unavailable is **preserved** and its coverage marked `preservedFrom: <earlier writtenAt>`. The close pass never writes `replay`, `plans[].price`, or `series`; when the action or plan set changed since the last candle pass it sets `passes.candles.status: 'pending'` with `reason: 'sources_changed'`. Idempotence is "same inputs, same document"; monotonicity is "more inputs, never fewer facts." |
| BA-20 | **Every section carries a coverage statement**, stored and displayed at the section: `{ status: 'complete' | 'partial' | 'unavailable', span: { from, to } | null, sources: [...], preservedFrom: writtenAt | null, note }`. `complete` requires every source for the day present and under its cap at read time; any `evaluations[]`-sourced section is at most `partial` when the array was at its cap (150) or the day's first entry is absent; `unavailable` names why. Coverage bounds from surviving sequence numbers never claim completeness beyond them. Missing history is never rendered as inactivity. |
| BA-21 | **Every number has a provenance class and the screen labels by class:** `recorded` (a platform write, shown plain with its source), `derived` (arithmetic on recorded values — day change, holding duration, aftermath counts — labeled "derived from recorded values"), `rebuilt` (scored from bars — labeled "rebuilt from 1-minute bars at the battle's check times"), `market` (fetched or aggregated bars — labeled "market data · EODHD 1-minute bars, aggregated"). There is no fifth class; a number with no class is a bug. |
| BA-22 | **No new agent voice; recorded agent text only as attributed historical quotation.** The tape stores `rationale`, `hypothesis` and the chat reply as recorded text. The screen renders them only under a fixed label — "Recorded rationale at HH:MM · the agent's words at the time · not verified" / "Chat reply at the time · not verified" — never as the player's words, never as an explanation of why anything happened, never under a "Why?" heading. `originalUserAsk` remains excluded: it is the model's paraphrase of the player, and the player's words are on record. |

## 4. The tape document

`agentBattles/{battleId}/tape/{etDate}` — `etDate` is the ET trading date `YYYY-MM-DD`.

```
tapeVersion: 2
battleId, ownerId, agentId, archetype, gameMode
etDate, dayNumber, isFinalDay, battleStatusAtWrite ('active' | 'completed')
writtenAt (latest run), firstWrittenAt, runCount
passes:
  close:   { status: 'written' | 'skipped_mode' | 'failed', writtenAt, capture: 'present' | 'partial' | 'absent',
             tickSeqRange: [min, max] | null, gaps: [tickSeq, …], deferralsTruncated,
             sources: { ticks, evaluations, receipts, trades, calls, runs } (counts) }
  candles: { status: 'pending' | 'written' | 'partial' | 'failed' | 'skipped', writtenAt, attempts, reason | null,
             source: 'eodhd_1m' | 'shared_cache', symbolsRequested: [], symbolsMissing: [] }
coverage: { checks, actions, directives, plans, calls, rationale, evidence, replay, series }   (BA-20, one object each)
score:
  lastCheck: { at, tickSeq, active, banked, total, opponent, bankedBadgePoints }          (recorded)
  firstCheck: { at, tickSeq, total }                                                      (recorded)
  dayChange: { value | null, basis: 'prior_day_tape' | 'battle_start' | 'unavailable' }  (derived)
battle:
  status, completedAt | null
  final: { total, opponent, at } | null                                                   (recorded; completed only)
  result: { value: 'win' | 'loss' | 'draw' | null, basis: 'stored' | 'derived' | 'not_completed' }
checks: [ { tickSeq | null, tickId | null, evalId | null, runId | null, at, state (BA-8), exitReason, stageReached,
            risk: { sym: { action, reason } } | null, guardrail: { evaluated, deployedCount } | null,
            decision: { original, final, holdKind } | null, scores: { active, banked, total } | null, tickMs | null,
            evidence: { sym: { atrX, vwapDev, px, chg, bbPct, nr7, regime, risk } } | null,   (recorded; copied from evaluations[].evidence)
            evidenceAt } ]
actions: [ { actionId, tickSeq, at, source, exitReason, mechanism, symbolOut, symbolIn, tier,
             entryPrice, exitPrice | null, lockedPoints, lockedGainPct | null,
             inBasis: { price, at } | null, holdingMs | null (derived), tradeMatched, receiptMatched,
             subsequentTradesInSlot,
             replayInputs: { ghost: { entryPrice, atr, tier, thresholdHistory, sources: {…} } | null,
                             bought: { entryPrice, atr, tier, thresholdHistory, sources: {…} } | null },
             replay: null | { basis: 'rebuilt_1m_at_checks', horizon: 'close', hypothetical: true,
                              ghost: { atClose, series: [{ tickSeq, at, points }] } | null,
                              bought: { atClose, series } | null,
                              holdPath | null, swapPath | null, gapPoints | null,
                              reconciliation: { closedLegDelta | null, boughtVsEvidence | null },
                              marketChangeAfter, sectorChangeAfter, missingInputs: [] } } ]
directives: [ { threadId, filedAt, expiry, playerText, canonicalText | null, adjustmentId, canonicalTextVersion,
                gateStatus, classification, cardState ('committed' | 'no_change' | 'not_filed'),
                retainedDirectiveText | null, agentReply, agentReplyDiffers,
                heard: { at, tickSeq, source: 'entry' | 'tick' } | null,
                after: { checks, holds, swaps } (derived) } ]
plans: [ { evalId, tickSeq, at, symbol, direction, signalSummary, threshold, signalSource,
           price: null | { atPlan: { value, at, basis }, atClose: { value, at, basis } } } ]     (market)
calls: [ { callId, kind, origin, horizon, mintedAt, expiresAt, state, resolvedAt | null,
           evidence: { tickId | null, priceAsOf | null }, hypothesisRef | null, symbol | null, direction | null,
           copiedAt, contractVersion, tapeWriteMode, recordMode | null } ]
rationale: [ { evalId, tickSeq, at, rationale, hypothesis, holdKind } ]                        (recorded text)
comparables: { market: ['SPY', 'RSP'], sectors: { symbol: etf } }
diagnostics: { intradayViews: 'present' | 'absent' }
```

`agentBattles/{battleId}/tape/{etDate}/series/{symbol}`:
```
symbol, ownerId, role: 'held' | 'sold' | 'plan' | 'market' | 'sector', interval: '10m', sessionOpen, provenance: 'market',
bars: [ { t, o, h, l, c, v } ],                       (regular session only; ≤ 39 bars)
atChecks: [ { tickSeq, at, price, barClosedAt } ]     (last completed minute before each check)
```

**Size.** Still well under 200 KB with `evidence` per check (~36 × 6 small objects). Series documents are ~39 bars each.

**Field homes** (§F2): score and checks from `ticks.*`, `evaluations[].{haikuError, tickMs, evidence}`, `agentEvalRuns`; actions from `ticks.actions[]`, `trades[]`, receipts; directives from `chatExchanges[]`, `evaluations[].heard`, `ticks.controls`; plans and rationale from `evaluations[]`; calls from `calls/*`; replay and series from fetched bars.

## 5. The close pass — `api/cron/film-tape-close.js`

- **Schedule:** `15 2 * * 2-6` UTC (22:15 ET during EDT), after `agent-daily-scores` (`45 1 * * 2-6`, `vercel.json:65-66`). New entry (count at the gate). `maxDuration: 300`.
- **Guard:** the platform's cron guard, as every other cron.
- **Flag:** `FILM_TAPE_WRITE_ENABLED = false`, read at call time, pinned false with a `Pinned by:` pointer, in `DARK_BY_DESIGN`.
- **Battle selection:** tiered `agentBattles` with `status == 'active'`, plus `status == 'completed'` with `completedAt` on the ET date (the build reports the index).
- **Per battle:** `writeTapeDay(battleId, etDate)` per BA-15 and BA-19 — read the existing tape; read the battle document; query `ticks` for the ET date (fallback: the `tickSeq` range from the day's first and last `evaluations[]` entries); read the day's receipts, `calls`, `declarations`; read the day's `agentEvalRuns` once per pass; assemble §4 with coverage per section; merge-monotone write; write nothing else.
- **Budget:** a remaining-time floor (30 s), an isolating try/catch per battle; a failed battle writes `passes.close.status: 'failed'` with a reason when the document can be written, else a console line; the next battle proceeds.
- **Backfill (BA-15):** an admin-only entry (`?backfill=YYYY-MM-DD..YYYY-MM-DD`, cron-guarded, flag-gated), same budget, resumable.
- **Rules:** `match /agentBattles/{battleId}/tape/{etDate}` and `…/series/{symbol}`: `allow read: if request.auth != null && resource.data.ownerId == request.auth.uid`; `allow write: if false`. Rules tests in `test/rules/`.

## 6. The candle pass — `api/cron/film-tape-candles.js`

- **Schedule:** `0 11 * * 2-6` UTC (7:00 AM EDT), after the intraday validator's first attempt (§D1). Same flag. `maxDuration: 300`.
- **Selection and retry:** collection-group query on `tape` for `passes.candles.status ∈ {pending, partial, failed}` with `attempts < 3`, up to 10 trading days old, oldest first, bounded by budget; each run increments `attempts`; after three, `failed` with `reason`. There is no other retry path, and the screen never promises one that isn't scheduled (§7).
- **Symbols per tape:** held at any check ∪ `actions[].symbolOut` ∪ `actions[].symbolIn` ∪ **`plans[].symbol`** ∪ `SPY`, `RSP` ∪ `TICKER_TO_SECTOR` of each held, sold or planned name.
- **Fetch:** prior-session 1-minute bars with an explicit date window through the generic fetcher (`fetchIntradayCandles`, `marketDataCache.js:792`; interval `'1m'`), regular session via the existing clamp; the shared bar cache first when it exists. A failing symbol goes to `symbolsMissing`; its dependents are marked `missingInputs`, never guessed.
- **Replay per action (BA-11):** requires `replayInputs` for a leg; a leg with any missing input is `null` with the input named in `missingInputs` — a dependency, not permission to guess. Both legs sampled at each later check's last-completed-minute price and at the close; `holdPath`, `swapPath`, `gapPoints`, `reconciliation`, `marketChangeAfter`, `sectorChangeAfter` as ruled.
- **Plans:** `price.atPlan` (last completed minute before the plan's check) and `price.atClose`, each with `basis`.
- **Series:** 1-minute → 10-minute aggregation, regular session, for every symbol in the set; `atChecks` filled.
- **Write:** a targeted update of `actions[].replay`, `plans[].price`, `passes.candles`, `coverage.replay`, `coverage.series` only.

## 7. The screen — Film Room v2 (A2)

- **Flag:** `FILM_ROOM_V2_ENABLED = false`, pinned, `DARK_BY_DESIGN`. Off → the current `FilmRoomScreen` renders byte-identical (golden from the pre-build commit). On → `FilmRoomScreenV2` at the same route, same three entry points, routing unchanged.
- **Reads:** one `getDoc` of `tape/{etDate}` per selected day; `series/*` only when the deep dive opens; never a subscription to the battle document. No tape document → "No tape for this day" plus, only when a pass is actually scheduled for it, when it runs; otherwise "not available."
- **First open, once:** "Film Room now includes held positions in its recorded score. Earlier Film Room summaries left them out, so the same battle may show a different number here. Check the timestamp: this score may be from the last recorded check rather than market close." Never a suggestion that the battle was replayed or its official result changed.
- **Three depths (R12):** *Glance* — the recorded score with its time and the day change with its basis; the battle result shown apart, only for completed battles; a check strip (woke / no wake / skipped / deferred / no record) with the checks coverage. *Study* — the action rows with both legs (recorded `lockedPoints` plain; the rebuilt fork labeled and styled as rebuilt, with the reconciliation delta shown and hypothetical lines marked), who made the exit before its result; the directive cards per BA-9; the plans beside their two prices per BA-10; recorded rationale per BA-22; every section under its coverage line. *Deep dive* — the 10-minute chart per symbol with session open, volume, and the market and sector lines from `series`, labeled `market`; the Diagnostics area per BA-14. No "biggest swing," no rankings, no success colors, no call outcomes.
- **Retired behind the flag:** `ScoreSummaryCard`, `AutoDebriefHero`, `DaySummaryCard`, `TradeHistorySection`, `AnticipationLogSection`, `FilmRoomChat` — kept in the tree for the flag-off path.
- **Copy rules:** BA-7, BA-9, BA-10, BA-11, BA-21, BA-22 wording verbatim; the directive gap stated, never explained; no letter grades, lessons, verdicts, or new agent voice.
- **Tests:** mounted behavioural tests from a fixture tape: each depth renders; three card states from four gate statuses; every check state; the deferral-truncation line; every provenance label by class; the reconciliation delta visible; hypothetical marking when `subsequentTradesInSlot > 0`; each coverage status renders at its section; the first-open notice once; a missing tape renders the honest empty state; flag off renders the golden. No source greps for surface behaviour.

## 8. Honesty invariants

1. Every number carries one of four provenance classes (BA-21) and is labeled by it; there is no fifth kind.
2. Nothing implies a mechanism was armed, a guard held, or the agent saw a datum it was not given — including a price from a minute that had not completed at the check.
3. The player's words and the filed text are always two fields; the model's paraphrase of the player never appears; recorded agent text appears only as attributed, unverified historical quotation.
4. A plan gets prices, never a verdict; a call is copied, never judged here.
5. The tape never writes outside its subcollections and never reads a body.
6. `FILM_TAPE_WRITE_ENABLED` off: no cron writes, byte-identical. `FILM_ROOM_V2_ENABLED` off: the old screen, byte-identical. Stage 2 (writer on, screen off) is intentional and changes nothing a player sees.
7. A gap in capture renders as a gap; a truncated list renders as truncated; a later run never loses a fact an earlier run saved; every section states its coverage.
8. The hub learns three things from the Film Room: ready or not, one availability word, and where.
9. Nothing on the tape or screen selects a decisive action, ranks outcomes, or arranges facts so a conclusion the record doesn't support becomes the obvious reading.

## 9. Build gate (step 0, read-only, STOP on failure unless marked degrade)

1. `git fetch origin`; branch from `origin/main`; record SHA; clean tree.
2. **STOP unless on `main`:** this spec at `docs/specs/`, the answers document, design note V1.3, the 0A/0B reports, `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md`, and the Sep 27 review at `docs/audits/`.
3. Re-locate every anchor cited from the answers document; cite current lines in the build report.
4. Confirm `TICK_CAPTURE_ENABLED === true` and that `ticks` documents exist for at least one battle-day; pull fixtures for `evaluations[].{candidates, heard, evidence}`, `chatExchanges[].archetypeGate`, `ticks.actions[]`, `agentEvalRuns/{runId}` (deferred ids, truncation flag, run time; PR #896), `calls/{callId}` (contract V1.4; whether the record carries a minting mode).
5. Confirm the scorer import and signature (`api/_utils/agentScoring.js:224`), its required `asset` fields, and the persistent source of each for **both** legs (entry price, ATR, tier, threshold history: receipt schema `learningSchemas.js:96-200`, trade `snapshot.symbolOut` / `snapshot.symbolIn`, the portfolio slot). **Degrade, don't STOP:** a leg with no persistent source for an input ships `null` with `missingInputs` named, and the build report lists it as a dependency.
6. Confirm `fetchIntradayCandles` accepts `interval: '1m'` and a date window (`marketDataCache.js:792-804`) and the regular-session clamp's export.
7. Confirm the existing Film Room route id and entry points (for §11's `target`), and whether the legacy review is only `dailyReviews[]` on the battle document.
8. Fence check: `agentScoring.js`, `agentSwapExecution.js`, `agentBattleService.js`, `agentRiskManager.js`, `agentEvalPromptAssembly.js` read, never edited; verify fence-free, don't assume.
9. Count `vercel.json` entries before and after.
10. Baseline suite on Linux; record the failing set.

## 10. Build shape and sequence

- **A1 branch:** one, from `main`. Stages: A (close pass, `writeTapeDay` with merge-monotone and coverage, rules, fixtures, tests, the hub helper), B (candle pass, replay, series, retry), C (backfill entry, export script). `DARK_BY_DESIGN` in the first commit. No PR, no merge, no flag flip by the executor.
- **Review:** no further spec round. Astra on the A1 branch after stage C, claim sheet = §8 plus §14's disposition table (each review finding named with the code that closes it). The §2 adversarial review applies.
- **Merge:** in the shadow week, before the hub build.
- **Flips, each its own PR:** (1) `FILM_TAPE_WRITE_ENABLED` with the BA-15 backfill from 2026-09-21; smoke on the first taped day: `score.lastCheck.total` equals the Command Center's number at that time; `actions[]` count equals the day's swaps; every check state is one of BA-8's; every section has a coverage object; `closedLegDelta` small and reported; after the first candle morning, `symbolsMissing` empty on a normal day and every plan symbol present in `series`. (2) `FILM_ROOM_V2_ENABLED` after A2 builds and Flash has read five real tape days through the export, in the sequence's screen-flip slot. The hub's Stage 3 (§11) follows flip (2).
- **A2 branch:** its own, later; Astra on the branch.

## 11. Hub contract (Film Room → Command Center hub)

The Command Center hub has exactly one interface with the Film Room. The Film Room owns it.

**Mechanism.** A read-only helper in a shared util (expected `src/utils/reviewAvailability.js`, fence-free, name confirmed at the gate) exporting `getReviewAvailability(battle) → Promise<{ ready: boolean, target: route | null, availability: 'ready' | 'pending' | 'unavailable' }>`. Nothing else is returned. The hub imports it, never computes readiness itself, and never reads `dailyReviews`, the tape, or any Film Room record directly.

**Stage 1 — before A2's flag flips** (`FILM_ROOM_V2_ENABLED` off, regardless of the writer flag). `ready` = `status === 'completed'` (`agent-evaluate.js:5813`) AND the legacy review entry exists (`dailyReviews[]` non-empty; written by `api/cron/agent-batch-review.js`; the gate confirms whether a separate document also exists). Presence only, never content. `target` = the existing Film Room route. `availability` = `'ready'` when ready; `'pending'` when completed and the review has not yet been written (the batch-review cron is scheduled for it); `'unavailable'` otherwise. Resolves synchronously from the battle document. Stated honestly: the legacy review arrives on its cron's schedule and dates a final-day review the day after (H-2); the helper does not fix H-2.

**Stage 2 — writer flipped, screen dark.** No change for the hub.

**Stage 3 — A2's flag on.** `ready` = `status === 'completed'` AND the final-day tape exists with `passes.close.status === 'written'` — one bounded read of `tape/{finalEtDate}` inside the helper, `finalEtDate` from `timing.tradingDays`. `target` = the same route. `availability` = `'ready'`; `'pending'` only when the battle completed today and tonight's close pass is scheduled for it; `'unavailable'` for a completed battle with no tape and no scheduled pass (pre-backfill battles) — never `'pending'` for work nothing will do. Stage 3 guarantees a written close pass, not candles; the hub's copy is **"Open battle tape"**, never "review ready," "analysis ready," or any promise about content.

**Rules.** No new Firestore field or writer for the hub. A completed battle not yet ready renders "Review pending" or "Review unavailable" by `availability`, never a score, a verdict, or an icon that implies one. The tape's derived battle result is labeled on the Film Room and never surfaced through the helper.

**Acceptance.** One fixture per state per stage (Stage 1: ready / pending / unavailable / active; Stage 3: ready / pending / unavailable / active); the hub's review tile and its "Open battle tape" action render from helper output only, proven by a mounted test that stubs the helper.

## 12. Out of scope for Build A (and where each lives)

| Item | Where |
|---|---|
| Character verdicts on picks (R16), the lens, precedents, cases | Build B, after the formalization session |
| Tomorrow's card | Build B |
| Moving averages, volume baselines, anomalies, confluence, the exit-timing fact | Build B (R7) |
| Takeaways, statuses, nominations, the Ledger | Build C, after Forge Record step 0 |
| Agent narration or a review chat | Not until a review-mode grounding path exists (C-7) |
| Rendering call outcomes | After the shadow read, under the call-record contract; A2 at the earliest |
| Per-mechanism armed state, exit levels, the protection record | Exit-dials arc with G-1 |
| Per-day close snapshot and stored `result` | Command Center arc (C-5; the `result` split asked Sep 22) |
| Multi-step or multi-day replay | Later; the one-step hypothetical is labeled as such |
| Flat6/tournament tapes, crypto replay | Build A v2 |
| H-2 | A one-line hygiene PR, separate |
| Removing the retired components | After the v2 flag is retired |

## 13. Considered and not adopted

"Biggest swing" (an editorial selection); plan highs and lows after the plan (hindsight); `stage` and `reason` on the hub helper (exceeded invariant 8); the whole-document rewrite (lost preserved history); the bar containing a check as its price (a minute that hadn't completed); a second spec-review round (the branch review verifies the folds in code).

## 14. Disposition of the Sep 27 review

| Finding | Disposition | Where |
|---|---|---|
| 1 Replay visual treatment; gap omits banked points; hypothetical when later trades | Applied: corrected arithmetic, distinct rebuilt style, delta shown, `subsequentTradesInSlot` | BA-11, §4, §6, §7 |
| 2 Headline wording; result only on completed; day change unavailable rather than substituted | Applied | BA-4, §4 |
| 3 Risk wording; missing risk record | Applied | BA-7 |
| 4 Directive card labels; no proposed text under "Filed"; retained directive; reply labeled; receipt vocabulary | Applied | BA-9 |
| 5 One-day horizon verdicts; plan highs/lows; horizon note; no success colors | Applied: cut and labeled | BA-10, §7 |
| 6 Copy `evidence`; both legs' scoring inputs; plan-only symbols in the fetch | Applied | §4 `checks[].evidence`, `replayInputs`; §6 |
| 7 Flip-day notice | Applied verbatim | §7 |
| 8 Ways to mislead | Applied via cuts and labels; invariant 9 added | §8 |
| 9 Hub copy; unavailable vs pending; interface narrowed | Applied | BA-17, §11 |
| 10 Call provenance; observed-state semantics; owner readability acknowledged | Applied | BA-16 |
| Inv 1 provenance for every number | Applied | BA-21 |
| Inv 2 HOLD as assurance; diagnostics under Why?; minute-close after the check | Applied | BA-7, BA-14, BA-11 |
| Inv 3 reply/rationale contradiction | Applied: attributed historical quotation | BA-22 |
| Inv 7 preservation; missingness; truncation display | Applied | BA-19, BA-20, BA-8 |
| Inv 8 helper surface | Applied | BA-17 |
| Inv 6 wording per flag | Applied | §8 item 6 |
| Retry path; "next pass" promise | Applied | §6, §7 |
| Cut "biggest swing" | Applied | §7, §13 |
| Add per-section coverage | Applied | BA-20 |
