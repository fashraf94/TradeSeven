# Phase 0 — ID-1 and the shared setup-evidence contract (read-only)

Date: 30 October 2026 · Executor: Claude Code (Fable 5.1), fresh session in its own worktree · Prompt author: Fable (28 Oct 2026\) · Contract under test: ID1\_ACTIVATION\_EVIDENCE\_SHAPE\_NOTE\_V1\_2\_OCT28\_2026.md (project copy; not in the repo). Mode: read-only. No code changed; nothing committed, pushed or opened. One marked production read (A3) through the Admin SDK (.select() \+ .get() only), with the main checkout's .env.local loaded in place by scripts/loadLocalEnv.js, never copied. No EODHD call. One external web search for E2 (labelled REPORTED).

## 0\. Preamble

* git fetch origin main ran first. origin/main \= 0de404e1ca1209244f548a877117771cc2e650bc (the \#1016 merge). The worktree HEAD is the same commit, so every working-tree read below is a read of origin/main. Every citation is file:line at that SHA.  
* Guard: .github/workflows/tests.yml:72-78 at origin/main runs node scripts/ci/tf-setup-golden-guard.mjs (step "Golden baseline guard (tf-setup, cross-revision)"); scripts/ci/tf-setup-golden-guard.mjs and scripts/experiments/tf-setup-golden-baseline-check.mjs exist. Guard passed. VERIFIED.  
* docs/BUILD\_RULES.md read in full (§1 fence list, §3 discovery protocol, §6 cron constraints, §8 deliverables). Fenced files agentSwapExecution.js, agentBattleService.js, agentArchetypeConfig.js, decide.js were read only.  
* Labels: VERIFIED \= read at this SHA in this session. REPORTED \= taken from a repo document or an external page, not re-derived. UNKNOWN \= not determinable read-only.  
* Working files (session scratchpad): scripts/prod-trades-census.mjs (the A3 read), scripts/snapshot-size-55.mjs (F4). Neither touches the repo.

## 1\. Executive verdict

| Question | Answer |
| ----- | ----- |
| Can the observer be built from committed state with no fenced edit? | Yes. Every input §2–§6 needs is already committed: the battle document (creation roster, activatedAt), trades\[\], the live portfolio, the permanent ticks records, the clone resolver, the calendar, the evaluator. No fenced file is touched (§H). |
| Does the shape note survive Phase 0 unchanged? | Mostly. Thirteen findings (§2); four change wording in §4.2 (activatingTick, tradeRef, activatedAtSource, the key), one changes a time (the tape pass is 21:15 ET in winter), one is a scope question (tournament battles are 81% of production battles), and the rest are build decisions. |
| Where does the executing tick live? | On the permanent tick record (agentBattles/{id}/ticks/{tickId}: tickSeq, evalId, actions\[\] with swappedOutAt), joined to the trade row by the tape's own key (swappedOutAt, symbolOut, symbolIn). The row's evaluationId names the executing check only on the model path; 20 of 23 sampled production rows carry a synthetic risk\_\* id. |
| Can the snapshot come from the daily cache? | Only without the split heuristic. marketDataCache/{SYM}\_daily has ≥ 55 raw rows but no adjusted-close provenance (the mapper folds adjusted\_close into close). A dedicated /eod/ date-range read (1 call per symbol per session) gives the full adapter result. Cost is negligible against the call budget. |
| Retention risk today? | Dormant. 218 battles since 1 Sep 2026: the highest tradeCount is 5 (cap 50), the highest evalSeq is 26 (cap 150). No battle reached either cap. The gap detector is still needed, and scoreState.tradeCount \> trades.length is its exact test. |
| Host and timing? | process-pending-reflections (48 ticks a day, every day, non-fenced; its tenants' 50 s budget is fully allotted — a sixth tenant needs a budget decision). Its last tick is 00:45 UTC, 90 minutes before the tape's close pass at 02:15 UTC in both DST states. |
| Build split | Build 1: the snapshot store, acquisition helper and activation-to-session wrapper (framework, no host). Build 2: the observer, the battle-end sweep and the sixth tenant. The tape's pointer read is the Film Room's later task. |

## 2\. Findings that change or sharpen the shape note

F-1 — activatingTick must come from the tick record, not the trade row's evaluationId. The six executor callers and the corrected route spread the caller's metadata onto the row (agentSwapExecution.js:413; stockThresholdAdmission.js:269; allowlist executorMetadata.js:34-38). The evaluationId they pass is: model path evalId \= eval\_\${evalSeq} (agent-evaluate.js:3440-3441, :3890); risk manager risk\_\${reason}\_\${symbol}\_\${Date.now()} (:2191); deterministic pass \${reason}\_\${symbolOut}\_\${Date.now()} (:6061); gameplan gameplan\_\${out}\_\${in}\_\${Date.now()} (:6494); approved and expired proposals serverProposalEvaluationId \= the proposing entry's evalId, or null when it aged out (:5383, :5655; executorMetadata.js:93-110). So the row names the executing check only on the model path; the proposal paths name an earlier check; the other three name nothing in evaluations\[\]. The executing tick is committed elsewhere: agentBattles/{id}/ticks/{tickId} (permanent, no free text, uncapped; captureWriter.js:6-9, :581-584; TICK\_CAPTURE\_ENABLED \= true, featureFlags.js:2737) carries tickSeq, tickId, evalId (captureContext.js:133, :198-199; captureSerializer.js:71-72) and one actions\[\] entry per committed executor result with swappedOutAt, symbolOut, symbolIn, source, exitReason, committed (captureContext.js:256-269). The tape already joins rows to ticks on (swappedOutAt, symbolOut, symbolIn) (tapeAssemble.js:392-393, :496-511). Change: activatingTick: { tickSeq, evalId, evaluationId, source: 'tick\_action' \| 'row\_eval\_id' \| 'unavailable' } — the tick join first, the row's eval\_NNN second (parse evalSeq from it only then), else unavailable. Production sample (five highest-trade battles, 23 rows): 20 risk\_\*, 3 eval\_NNN. VERIFIED.

F-2 — tradeRef.verificationId exists on the legacy route only. verificationId \= $battleId:${evaluationId}:verify is built by buildVerification (agentSwapExecution.js:160-166) and lands as trades\[i\].verification (:417) at identity mode ≠ off (SWAP\_IDENTITY\_MODE \= 'enforce', featureFlags.js:3334). The corrected route (stockThresholdAdmission.js:235-297) builds no verification; its row carries outgoingPositionId, incomingPositionId, outgoingReceipt, incomingReceipt (:269-273). Change: tradeRef: { evaluationId, verificationId \| null, incomingPositionId \| null }. VERIFIED.

F-3 — The tape's close pass is 21:15 ET in winter. vercel.json schedules film-tape-close at 15 2 \* \* 2-6 UTC \= 22:15 EDT / 21:15 EST (api/cron/film-tape-close.js:5-7 says so). US DST ends 1 Nov 2026, so from the first November session the pointer deadline is 21:15 ET. State the deadline as "the 02:15 UTC close pass". VERIFIED.

F-4 — Starting-position identity and entry instant differ by route. Legacy creation (createAgentBattle, agentBattleService.js:73-290): positions are the deployer's asset objects copied verbatim (:113, :164-174); no positionId, no swappedInAt (grep: neither key is written in decide.js or agentBattleService.js); the battle's instants are createdAt \= activatedAt \= now (:75, :149-150). Corrected creation (stockCreationDb → qualify, stockThresholdAdmission.js:88-114): every position gets positionId \|\|= randomUUID() and slotVersion \= 1 (:95-96); stock positions also get stockThresholdReceipt, swapPrice \= fill and swappedInAt \= at (:99-102), at being the creation transaction's clock (milliseconds after createdAt); crypto starting positions get a positionId but no swappedInAt (observations are stock-only, :64). Legacy swap-ins: swappedInAt: now, no positionId (agentSwapExecution.js:426-433); corrected swap-ins: positionId: incomingId, swappedInAt: at, slotVersion \+ 1 (stockThresholdAdmission.js:241, :268). Change: activatedAtSource: 'position.swappedInAt' \| 'battle.activatedAt'; activationId \= positionId on the corrected route, else $tier:${slot}:\${entryInstant} for creation and legacy swap-ins. The frozen roster agentContext.initialPortfolio (:256-260) is deep-copied before qualify stamps ids, so it never carries positionId/swappedInAt even on corrected battles: join roster ↔ live slot by (tier, slot, symbol). It is never rewritten (only readers: team-card.js:362, tapeAssemble.js:1263). VERIFIED.  
F-5 — Durability: the slot chain recovers a starting position swapped out early, and tradeCount is the gap test. Both routes cap trades\[\] at 50 (agentSwapExecution.js:499; stockThresholdAdmission.js:283) and both increment scoreState.tradeCount on every swap (:499-506 region, :283). So scoreState.tradeCount \> trades.length is the exact "rows evicted" test (sharper than the tape's evictionPossible, tapeAssemble.js:118-124). Within retained history a slot's chain is reconstructable: the row with symbolIn \= X in (tier, slotIndex) has swappedOutAt equal to X's swappedInAt (one clock reading per attempt — landedTrade.js:91-94); the row with symbolOut \= Y and no earlier row in that slot is a starting position when initialPortfolio\[tier\]\[slot\].symbol \=== Y. The outgoing position's own entry instant is on the row only as verification.found.swappedInAt (legacy, agentSwapExecution.js:143; null means creation-time) or outgoingReceipt.enteredAt (corrected stocks, stockThresholdAdmission.js:25-31). Production: no battle since 1 Sep has tradeCount \> 5 (§A3), so the gap case is real but dormant. VERIFIED (production figures from the A3 read).

F-6 — Scope: tournament battles are the majority of production. Of 218 battles created since 1 Sep 2026, 176 are baggerbomb\_tournament and 42 tiered (baggerbomb\_agent); 42 are casual-clone battles, 17 training-clone battles, 8 on the corrected stock route; 60 carry agentContext.archetype \= 'momentum\_chaser' (19 casual, 4 corrected). The shape note's "Who" (§3) does not say whether flat6 tournament battles (prescribed portfolios, decide.js:1353-1430), CPU sides (isCpu) or training clones (training-agent- ids) are in scope; the tape skips tournament battles (closePass.js:12-13, skipped\_mode). → Q1. VERIFIED (production read).

F-7 — The daily cache cannot carry adjusted-close provenance. mapDailyRows stores close \= adjusted\_close \|\| close and rawClose \= close with no presence flag (marketDataCache.js:313-342, :318, :337); the adapter's provenance enters only through attachAdjustedClose(rows, payload) from the raw payload (dailyBarsAdapter.js:109-122) and "a ratio of 1 proves nothing" (:45-46). A cache-fed snapshot therefore records adjustment.metadata: 'absent', checks.splitCheck: 'not\_available' on every row — honest, but the split heuristic is permanently off. A dedicated /eod/ read with from/to (the review card's fetchWindowDaily, hypothesisRecords/review.js:213-228, writes no cache) gives the full result at one call per (symbol, session). → recommendation in §E1. VERIFIED.

F-8 — The key can be the requested session, and the helper can assert it. Under the wrapper (§D) the adapter's asOf always equals the requested session on an ok result: buildDailyEvidence refuses unless bars\[0\].date \=== expected (:185-186), and expected \=== asOf whenever the request is not "today before the close" (:102-106); the wrapper never produces that case (proof in §D). So the canonical key is (requested session, symbol, rule key), asOf/requestedAsOf are stored verbatim, and the helper treats asOf \!== requestedAsOf on an ok result as a programming error. The rule-set triple contains / (semanticsId \= 'tf-setup-v1/sem-1', thresholds.js:62) so the document id needs a derived rule key (§F1). VERIFIED.

F-9 — A write-once final document cannot host its own claim. The P1c precedent writes reviewEvidenceClaim on the same mutable version document it later fills (review.js:380-403, :408-416). A snapshot that is "write-once, never replaced" (§4.1) needs its claim in a sibling collection (setupEvidenceClaims/{key}, lease 120 s as REVIEW\_CLAIM\_LEASE\_MS, review.js:87) with tx.create of the final document as the only authority (§F2). VERIFIED (precedent read).

F-10 — Most pointers can be final on the tick that sees them; only after-close activations wait on a bar. An intraday swap-in's asOf is the previous session, whose bar is long published; a creation after the close (or a BR-2 late-day creation, F-11) has asOf \= today's session, whose bar arrives after 16:00 ET. The retry path (§E2, §F3) is for that case. VERIFIED (calendar logic) / REPORTED (publication time).

F-11 — BR-2 late-day creations. A tiered battle created at or after 15:15 ET plays the next session (src/utils/stockAdmissionWindow.js:24-27; tieredFirstTradingDay.js:3-8, firstTradingDayOf :37-41), but its positions are committed at creation and activatedAt is the creation instant (agentBattleService.js:150). Under §4.2's rule the evidence asOf is the previous session, one session older than the one about to close. Readers may expect the session just closed. → Q3. VERIFIED.

F-12 — Use the calendar module's previous-session walker, not getPreviousTradingDay. marketSchedule.js:102-114 walks ten calendar days with no maintained-year check and falls back to a non-session date; the adapter guards its use with MAINTAINED\_HOLIDAY\_YEARS (dailyBarsAdapter.js:214-216). The wrapper should use getSessionForDate(...).previousEtDate / getPreviousSessionDate (marketCalendar.js:142, :151-166), which return null outside the maintained years. VERIFIED.

F-13 — Documents. The growth map in the repo is V1.1 (docs/design/20261023\_GROWTH\_LOOP\_MAP\_V1\_1.md; ID-1 row :55, FD-1/FD-2 :66-67); the shape note cites V1.2, which is not in the repo, and the shape note itself is not in the repo. Both ride the first build (shape note §0: no docs-only PR). docs/design/ exists. VERIFIED.

## 3\. A — Discovery and durability

### A1. Identity and entry instant per route

|  | Legacy route (stockModelRoute → legacy, src/utils/stockThresholdModel.js:26-32) | Corrected route (corrected: scoring.stockThresholdModel present \+ tiered \+ fullday \+ opponent) |
| ----- | ----- | ----- |
| Starting position identity | (tier, slot, symbol) only; no positionId, no swappedInAt (agentBattleService.js:113, :164-174) | positionId, slotVersion: 1 on every position (stockThresholdAdmission.js:95-96); stocks also swappedInAt \= at, swapPrice \= fill, stockThresholdReceipt (:99-102) |
| Starting position entry instant | battle.activatedAt (= createdAt, :75, :149-150) | stocks: swappedInAt (ms after createdAt); crypto: battle.activatedAt |
| Swap-in identity | none minted; swappedInAt: now, swappedInDay (agentSwapExecution.js:426-433) | positionId: incomingId (:241), swappedInAt: at, slotVersion \+ 1 (:268) |
| Creation roster | agentContext.initialPortfolio (:256-260), frozen, never rewritten | same, and without ids (copied before qualify) |
| Battle activation fields | createdAt, activatedAt, expiresAt, timing.tradingDays\[0\] (next session under BR-2), completedAt: null (:149-156) | same |
| Which route | stockModelRoute(battle).status; the executor dispatches on it (agentSwapExecution.js:227-229) |  |

All VERIFIED. Every creation goes through createAgentBattle's two callers in decide.js (:964 user deploy, :1554 tournament prescribed deploy).

### A2. What trades\[\] rows record about the outgoing position

Legacy row (agentSwapExecution.js:398-418): symbolOut, symbolIn, name, tier, slotIndex, entryPrice, exitPrice, lockedPoints, lockedGainPct, swappedOutAt, swapDay, isCrypto, direction, the allowlisted metadata (id, action, trigger, rationale, hypothesis, evaluationId, tradingDay, entryRegime, entryMarketPosture, entryConviction, entryPreset, entryMode, exitReason, swapMotive, source, archetype, hftKnobsSource, swapProvenance, trade\_reasoning — executorMetadata.js:34-38), snapshot, and verification when identity mode ≠ off (verification.found.swappedInAt \= the outgoing position's own entry instant, null for a creation-time position — :143, :219-220). Corrected row (stockThresholdAdmission.js:269-273): the same computed keys plus stockThresholdModel, outgoingPositionId, incomingPositionId, outgoingReceipt (its enteredAt is the outgoing position's entry instant), incomingReceipt, rewardContext, outgoingRiskHistory; no verification. The outgoing position's own entry instant is therefore recoverable directly (verification.found.swappedInAt, outgoingReceipt.enteredAt) or by the slot chain (F-5). Production sample: every sampled row carried swappedOutAt, evaluationId, exitReason; rows written since the identity flag carry verification (15 of 23). VERIFIED.

### A3. Retention caps and the production distribution

| Array | Cap | Where |
| ----- | ----- | ----- |
| trades\[\] | 50 | agentSwapExecution.js:499; stockThresholdAdmission.js:283 |
| evaluations\[\] | 150 | agent-evaluate.js:4738 (monotonic cronState.evalSeq beside it, :3440-3441, :4786) |
| proposalHistory\[\] | 50 | agent-evaluate.js:5276, :5540, :5565, :5807 |
| statusFeed\[\] | 100 (agent battles) / 50 | agent-evaluate.js:1141 |
| ticks/{tickId} (permanent) | uncapped; tickBodies TTL 120 days | captureWriter.js:6-9 |

Production read (30 Oct 2026, agentBattles where createdAt \>= '2026-09-01', .select() of ten scalar fields; aggregates only):

| Measure | Value |
| ----- | ----- |
| Battles since 1 Sep 2026 | 218 (213 completed, 5 active; all duration: 'fullday') |
| By mode | baggerbomb\_tournament 176 · baggerbomb\_agent 42 |
| By archetype | momentum\_chaser 60 · diversifier 42 · contrarian 34 · degen 32 · analyst 27 · guardian 23 |
| Casual-clone battles / training-clone battles / corrected route | 42 / 17 / 8 |
| tradeCount histogram (all) | 0: 150 · 1–5: 68 · 6+: 0 — max 5, p50 0, p90 3 |
| Tiered battles (42) | 0: 15 · 1–5: 27 — max 4, p50 1 |
| Trend Follower battles (60) | 0: 31 · 1–5: 29 — max 4, p50 0; 19 casual, 4 corrected |
| Battles at the trades\[\] cap (tradeCount ≥ 50) | 0 |
| Battles past the evaluations\[\] cap (evalSeq \> 150) | 0 (max evalSeq 26\) |
| Trend Follower battles per ET creation day | 31 days with any; min 1, p50 1, max 4 |
| Verification sample (5 highest tradeCount) | trades.length \=== tradeCount in all 5; evaluations.length \=== evalSeq where evalSeq exists (2 of 5 pre-date the field) |

So no battle since 1 Sep reached either cap. The observer's gap detection (tradeCount \> trades.length) is still required by §2; today it would report zero gaps. VERIFIED.

### A4. Can one symbol occupy two of the agent's slots at creation?

No creation path can. Both createAgentBattle callers validate first: validatePortfolio rejects duplicates across star, core, support stocks, bench stocks, support crypto and bench crypto (decide.js:1178-1199); validatePrescribedPortfolio rejects a repeated symbol (:1324-1327). The corrected route's qualify adds no second guard and relies on these. Swaps refuse (agentSwapExecution.js:316-321; stockThresholdAdmission.js:248). VERIFIED. (The swap-route anchors the prompt gave, :61-62 and :248, have drifted: the fenced guard is now :316-321; the corrected guard is still :248.)

## 4\. B — The executing tick

| Caller (executeSwapServer site) | evaluationId on the row | Names the executing check? |
| ----- | ----- | ----- |
| Risk manager, agent-evaluate.js:2255 | risk\_\${reason}\_\${symbol}\_\${Date.now()} (:2191) | No — synthetic; the tick's own entry is eval\_NNN |
| Model path, :3986 | evalId \= eval\_\${evalSeq} (:3440-3441, :3890) | Yes |
| Approved proposal, :5363 | the proposing entry's evalId or null (:5383; executorMetadata.js:93-110) | No — the deciding check, ticks earlier |
| Expired proposal, :5638 | same (:5655) | No |
| Deterministic pass (R11), :6118 | \${reason}\_\${symbolOut}\_\${Date.now()} (:6061) | No — synthetic |
| Gameplan leg, :6478 | gameplan\_\${out}\_\${in}\_\${Date.now()} (:6494) | No — synthetic |
| Corrected route (any caller) | the same metadata, spread first (stockThresholdAdmission.js:269) | as above |

Committed state that does name the executing tick: the permanent tick record (tickSeq, tickId \= $battleId:${tickSeq}, evalId; captureContext.js:133, :198-199) with actions\[\] { actionId, n, kind, source, exitReason, symbolOut, symbolIn, swappedOutAt, lockedPoints, entryPrice, committed } (:256-269), written in one batch with its body (captureWriter.js:581-584). How the tape maps it: buildActions keys every source on swapKey(swappedOutAt, symbolOut, symbolIn) (tapeAssemble.js:392-393, :496-511) and reads tick rows by tickSeq/evalId (:259-261, :1208-1210); the row's evaluationId is not its key. The P6 verificationId ($battleId:${evaluationId}:verify, agentSwapExecution.js:160-166) is legacy-route only. → F-1, F-2. VERIFIED.

## 5\. C — Attribution and the battle stream

resolveAttributionAgentId(db, battle) (api/\_utils/casualClone.js:286-314) returns the clone's own id (= battle.agentId) on: not a casual clone (:288, the expected ranked case), null db (:289), clone agent doc missing (:292), clone doc without a string rankedAgentId (:297), parent doc missing or ownerId ≠ the clone's owner (:308), any read error (:313); it returns the parent only at :310. The pure twin resolveRecordTargetId (:329-335) has the first two paths only. Detection: attributionStatus \= isCasualCloneId(battle.agentId) && resolved \=== battle.agentId ? 'unresolved' : 'resolved' (isCasualCloneId, src/constants/leagueTournament.js:417-419). Callers today: agent-evaluate.js:1138, :7054; agent-batch-review.js:480; reflect.js:135; filmRoom/cardStore.js:105, :131.

Ranked vs casual: there is no battle field. The battle's only clone marker is its agentId prefix — casual-agent- (leagueTournament.js:409) or training-agent- — as the module's own comment states (:423-432). Tournament battles carry gameMode \+ groupId (+ isCpu) (agentBattleService.js:143-147). So the shape note §5 "battle stream" \= (attributionAgentId, isCasualCloneId(battle.agentId) ? 'casual' : 'ranked', gameMode). Archetype gate: agentContext.archetype (agentBattleService.js:193); the casual clone inherits archetype from the ranked agent (trainingClone.js:59-60 INHERITED\_LOADOUT\_FIELDS\[0\]; casualClone.js:57-60), so the battle's own field is the parent's archetype, as §3 says. momentum\_chaser is the Trend Follower (agentArchetypeConfig.js:37-38). VERIFIED.

## 6\. D — The activation-to-session wrapper

Contract lastCompletedSessionAt(instantMs) → { ok: true, session: 'YYYY-MM-DD', etDate, relation } \| { ok: false, reason: 'calendar\_missing', detail }:

1. etDate \= etDateOf(instantMs) (tieredFirstTradingDay.js:59-65; or toEtParts, marketDataCache.js:1064-1082).  
2. s \= getSessionForDate(etDate) (marketCalendar.js:117-144). null → calendar\_missing (malformed, or the year is outside MAINTAINED\_HOLIDAY\_YEARS \= \[2026, 2027\], :69, :120).  
3. \!s.isTradingDay (weekend or holiday, :126-128) → session \= s.previousEtDate (:127), relation: 'non\_session'; null → calendar\_missing (walk left the maintained years, :151-166).  
4. s.isTradingDay && instantMs \< s.closeMs (pre-market or in session; closeMs is 13:00 ET on an early close, :129-133) → session \= s.previousEtDate, relation: 'before\_close'; null → calendar\_missing.  
5. instantMs \>= s.closeMs → session \= etDate, relation: 'after\_close'.

Composition with the adapter: call buildDailyEvidence({ asOf: session, now: observerNow, minBars: MIN\_COMPLETED\_BARS, … }). expectedCompletedSession (dailyBarsAdapter.js:91-107) can return current\_session\_incomplete only when asOf \=== today(now) && now \< closeMs (:102-105). The wrapper yields session \=== etDate(activatedAt) only in step 5, where activatedAt ≥ closeMs, and observerNow ≥ activatedAt, so that branch is unreachable; every ok result has expected \=== asOf and asOf \=== requestedAsOf (F-8). The helper asserts it. Early closes, weekends, holidays (2026 and 2027 tables, :24-62) and DST (via etWallClockToMs, :87-101) are the calendar's; the wrapper adds nothing.

Test matrix (the wrapper's own suite): Monday 08:00 ET → Friday; 10:00 ET → previous session; 16:00:00 ET exactly → that date (\>= closeMs); 15:59:59 → previous; Saturday/Sunday → Friday; Thanksgiving 2026-11-26 → 11-25; Friday 2026-11-27 (early close) at 12:59 → 11-25, at 13:00 → 11-27; 2026-11-01 (DST end) at 01:30 ET both offsets → 2026-10-30; 2026-01-02 → previous session is 2025-12-31 → calendar\_missing (year unmaintained); 2028-01-03 → calendar\_missing; a BR-2 late-day creation 2026-10-29 15:30 ET → 2026-10-28 (F-11). VERIFIED (calendar read; the matrix is proposed).

## 7\. E — Acquisition

### E1. Cache or own read?

marketDataCache/{SYM}\_daily holds mapDailyRows output for DAILY\_WINDOW\_CALENDAR\_DAYS \= 90 calendar days (marketDataCache.js:257, :352-354), ≥ 55 trading rows by the module's own guarantee (:290-292), newest first, each { date, open, high, low, close, rawClose, volume } (:331-339). Raw OHLCV is there (rawClose, high, low, volume); the adapter reads exactly those (dailyBarsAdapter.js:172-179). What is missing is adjusted-close provenance (F-7). The cache is also a TTL cache (4 h, frozen to the next open while closed, :30-31, :131-132), written fire-and-forget (:658) and bypassed on read by every forceRefresh caller (:622), so a document's presence and freshness are incidental. Recommendation: the helper makes its own /eod/ read with explicit from/to (period=d, order=a; the review card's fetchWindowDaily, review.js:213-228), maps with mapDailyRows, attaches adjusted\_close from the raw payload (attachAdjustedClose, dailyBarsAdapter.js:116-122), sets source: 'eodhd\_eod', sourceMeta: { fetchedAt, from, to } (the scalar allowlist of §4.1), barsClass: 'contemporaneous' when fetchedAt is before the next session's open and 'later\_reconstruction' otherwise. from should reach back ≥ 90 calendar days (or walk 55 sessions \+ a margin with the calendar) so insufficient\_history is a property of the symbol, not the request (§F3). VERIFIED.

### E2. When EODHD publishes a session's daily bar

In the repo: the collector's publication rule is close \+ 15 minutes (STOCK\_PUBLICATION\_DELAY\_MINUTES \= 15, src/utils/stockAdmissionWindow.js:13-16; refusal publication\_window\_not\_open, stockThresholdMeasurementProvider.js:37, :83), derived from the thresholds Phase 0 live-feed observation "the 16:00 closing bar arrived at 16:15" — a quote-feed measurement, not an /eod/ one (docs/audits/BAGGERBOMB\_THRESHOLDS\_PHASE0\_REPORT\_20261015.md:25). REPORTED. No in-repo measurement of /eod/ daily-bar arrival exists. UNKNOWN in-repo. Externally (REPORTED, one web search): EODHD staff forum replies conflict — one says NYSE/NASDAQ end-of-day data updates about 15 minutes after the close and other exchanges 2–3 hours after, another reverses the exception; EODHD's intraday page says intraday data is finalised 2–3 hours after the close; a user notes dividends (hence adjusted prices) lag longer ([EOD update time](https://forum.eodhd.com/t/eod-update-time/283), [most economical EOD calls](https://forum.eodhd.com/t/what-are-the-most-economical-api-calls-to-download-the-last-known-eod-data/974), [intraday API page](https://eodhd.com/financial-apis/intraday-historical-data-api)). Consequence: missing\_bar whose detail.expected is the most recent session is retryable from the close until a cutoff; the first production evenings measure the real arrival (log fetchedAt against session.closeMs). The reflections host's post-close ticks run at 16:15, 16:30 … 20:45 EDT (15:15 … 19:45 EST), so the first attempt lands exactly at the collector's 15-minute mark.

### E3. Calls per session

Per battle-day: 5 starting stocks (support\[2\] is crypto, excluded by class) plus swap-ins; observed tradeCount max 5, cap 6 per 60-minute window for the Trend Follower (agentArchetypeConfig.js:59). So ≤ \~10 distinct (symbol, session) pairs per battle-day, typically 5–8; the store dedups across battles and agents. Allowlist (two owners — the founder and FT\_QA per featureFlags.js:3499; each owner ≤ 1 active battle per agent, ranked \+ casual): ≤ 4 battles → ≤ \~40 calls per session, typically 10–20. Every Trend Follower agent: observed 1–4 TF battles per creation day since 1 Sep → the same order, ≤ \~40 calls per session. Against the census (REPORTED, at 8c9ea5ef, docs/audits/20261007\_EODHD\_CALL\_CENSUS.md:14-17): ≈ 86,000 calls per trading day today against a 100,000 budget, ≈ 14,000 headroom; agent-evaluate alone re-fetches every held symbol's /eod/ series on every tick with the cache bypassed (:86). The snapshot store adds \< 0.3% of the headroom and, unlike the evaluator, one call per symbol per session.

## 8\. F — Store semantics

### F1. Canonical key and request convention

* Collection setupEvidence (top level, server-only). Document id \${session}\_\_\${symbol}\_\_\${ruleKey}, with ruleKey \= $setupVersion.${thresholdsHash}.\${semanticsId.slice(semanticsId.lastIndexOf('/') \+ 1)} → today tf-setup-v1.26f3f411b566.sem-1 (thresholds.js:44, :56, :62, describeRuleSet :87-89; the hash value computed in this session). / cannot appear in a document id; . and \- can.  
* Fields: schemaVersion, key: { session, symbol, ruleSet } (the full triple verbatim), status: 'ok' \| 'refused', evidence (the adapter result as returned, bars included), entry (evaluateTfEntry(evidence)), asOf, requestedAsOf, refusal (from the entry record, refusals only), source, sourceMeta { fetchedAt, from, to }, evidenceClass.bars, capturedAt, writer (host \+ build sha).  
* Request convention: the caller supplies requestedSession from the wrapper (always a session), the observer's clock as now, and the symbol; the helper runs the adapter, asserts asOf \=== requestedSession on ok (F-8), keys on requestedSession, and stores asOf/requestedAsOf/refusal.expected exactly as the evaluator emitted them (C2's two-dates rule, tfSetupV1.js:53-60).

### F2. Create-once and the claim

One read transaction: tx.get(final) → exists → return it. Else tx.get(claim); a live claim (age \< 120 s) → { pending: 'computing' }; else tx.set(claim, { claimedAt, host }). Fetch outside the transaction. Second transaction: tx.get(final) → exists → return it (another writer won; discard ours); else tx.create(final) and tx.delete(claim). A final write-once document is never updated; tx.create fails ALREADY\_EXISTS on a race, so correctness never depends on the lease (shape note §4.1). A retryable outcome deletes the claim and writes nothing final. Precedent: claimEvidence/storeEvidence (review.js:380-416) with the claim moved to a sibling collection (F-9); tx.create for versions (hypothesisRecords/store.js:6-8).

### F3. Adapter outcomes: final or retryable

| Outcome (ADAPTER\_REFUSALS, dailyBarsAdapter.js:65-68) | Class | Why |
| ----- | ----- | ----- |
| ok evidence | final | an evaluable window |
| unsupported\_symbol\_class (:152) | final | crypto is refused by class under this rule set; counted as excluded (§3) |
| calendar\_missing, why: 'malformed\_date' (:96-97) | programming error | the wrapper never emits one; throw, write nothing |
| calendar\_missing, unmaintained year / previous session outside maintained years (:97, :103) | retryable | resolved by maintaining the calendar; nothing to freeze |
| asOf\_not\_a\_session (:99) | programming error | the wrapper only emits sessions |
| asOf\_in\_future (:101) | retryable | clock skew; never final |
| missing\_bar with detail.expected \= the requested session and no after (:185-186) | retryable | the bar is not yet published (E2); cutoff per Q4 |
| missing\_bar inside the window (detail.after present, :216) | final | the provider's series has no bar for a session (halt, listing gap) — a typed data refusal |
| unordered\_bars, why: 'malformed\_date' or out-of-order (:165, :191) | retryable | a malformed payload is an acquisition failure |
| unordered\_bars, why: 'non\_session\_date' (:202) | final | the series carries a bar on a non-session: a data property (C2 Q-TE-9) |
| insufficient\_history (:195) | final when the request window reaches ≥ 55 sessions back (E1); else retryable | a short-history symbol stays short |
| missing\_fact (:204) | final | a non-positive price in the window: a typed data refusal |
| basis\_discontinuity (:253) | final | the genuine typed refusal of §4.1 |
| fetch timeout, non-200, non-array body, call budget | retryable | acquisition failures; write nothing final |

### F4. Size of one snapshot

Computed in this session on the synthetic fixture at the adapter's exact 55-bar window with adjustment metadata present (scratchpad/scripts/snapshot-size-55.mjs): adapter evidence 8,817 bytes JSON (bars 8,366), entry record 3,095 bytes, snapshot (evidence \+ entry) 11,934 bytes; a pointer with the frozen entry copy ≈ 3,973 bytes. Firestore's 1 MiB document limit is nowhere near. At ≤ 40 snapshots per session and ≤ \~40 pointers per session the store grows by well under 1 MB a day.

### F5. Rules, protected stores, indexes

* Rules: setupEvidence/{id} → allow read, write: if false (the hypothesisReviewQueue posture, firestore.rules:1241-1246); agentBattles/{battleId}/activations/{activationId} → allow read, write: if false in V1 (shape note §6: no client reads; a parent rule never reaches a subcollection — :481-487; the owner-read tape posture at :538-547 is the precedent if a later reader needs it). Default deny covers nothing else (:1440-1442). Source tripwire as hypothesisRecords/rulesIndex.test.js:1-9, behaviour in test/rules/\*.rules.mjs.  
* Protected stores: PROTECTED\_COLLECTIONS is agents, rules, bundles, compiledBuilds, composition\* (compositionProtectedStoresScan.js:72-76); neither agentBattles nor setupEvidence is protected, so writes whose chain carries the literal .collection('…') need no allowlist entry; a write through a ref variable passed to a transaction helper reads unresolved and must be listed (:31-35; the mandate precedent in the allowlist's \_notes).  
* Indexes: the observer's reads are single-field — active battles by status \==, ended battles by completedAt \>= with status filtered in code (the close pass's own selection, closePass.js:7-9, :275-276) — and per-battle subcollection listings. No composite index in V1. A census across agents (collection group activations by attributionAgentId, asOf) would need a COLLECTION\_GROUP index like tape (ownerId, etDate) in firestore.indexes.json; defer until a reader needs it.

## 9\. G — Host and timing

| Candidate | Schedule (UTC → EDT / EST) | Fit |
| ----- | ----- | ----- |
| /api/cron/process-pending-reflections (non-fenced) | \*/15 13-23,0 \* \* \* → 09:00–20:45 EDT / 08:00–19:45 EST, every 15 min, every day (no trading-day guard in the handler) | Five isolated tenants already: reflections (40 s phase), Wire sweep, editorial, call sweep (deadline min(now+20 s, start+45 s)), review pass (min(now+8 s, start+50 s)) (process-pending-reflections.js:65-79, :232-290); maxDuration 120 s, tenants' TIME\_BUDGET\_MS 50 s, pinned by tests. A sixth tenant needs its own slice → Q2. Last tick 00:45 UTC \= 90 min before the tape pass in both seasons. |
| /api/cron/agent-evaluate?mode=settle | 0 2 \* \* 2-6 → 22:00 EDT / 21:00 EST | The weekday expiry sweep (agent-evaluate.js:7, :291, :398-404), 15 min before the tape pass in both seasons; the natural battle-end moment, but inside the executor's 7,000-line host. Fallback. |
| /api/cron/film-tape-close | 15 2 \* \* 2-6 → 22:15 EDT / 21:15 EST | The consumer; running the observer first would meet the deadline trivially but couples ID-1 to FILM\_TAPE\_WRITE\_ENABLED. Not recommended. |
| A new entry | 44 → 45 of 100 (vercel.json; BUILD\_RULES §6) | Allowed, but §6 prefers branching inside existing handlers. |

Recommendation: the sixth tenant of the reflections cron, with the review pass's shape (own deadline, cursor-paged, bounded transactions, skipped before any read when the gate is off — reviewPass.js:389-392, :447, :327-328). Per tick: (1) active tiered battles in scope → discover activations (roster, slot chain, live portfolio) → write pointers whose snapshot is final; (2) battles ended since the cursor (completedAt \>= or battleIsOver, reviewPass.js:159-177) → the battle-end sweep writes the remaining pointers with missing named; (3) retry the retryable snapshots of the last two sessions. Every pointer for a session is written by 00:45 UTC at the latest; the 02:15 UTC tape pass then reads a complete day.

## 10\. H — Fence

Nothing in shape note §2–§6 needs a fenced edit. Fenced files are read (permitted): agentBattleService.js (the document shape), agentSwapExecution.js (the row shape), agentArchetypeConfig.js (the archetype id), decide.js (the creation callers). Fenced functions called: none (the observer reads documents; resolveAttributionAgentId, the calendar, the evaluator and the gate are non-fenced).

Existing files a build would touch: firestore.rules; firestore.indexes.json (only if a census index is wanted); api/cron/process-pending-reflections.js and its tests process-pending-reflections.\*.test.js (the new tenant mocked as the review pass is, :25, :36); the flag — either a line at the end of src/config/featureFlags.js or a module of its own registered in src/config/flagPinGuard.test.js FLAG\_SOURCE\_MODULES (:45-50; the agentFormFlags.js:1-10 precedent keeps the entry chunk byte-identical); docs/specs/TREND\_FOLLOWER\_SETUP\_DEFINITION\_V1.md (C4 appended after C3); docs/README.md (rows); docs/design/ (the shape note copy); api/\_utils/compositionProtectedStoresAllowlist.json only if a write site resolves unresolved. New files: api/\_utils/setupEvidence/\* (store, helper, wrapper, tests), api/\_utils/activationEvidence/\* (observer, sweep, tests), test/rules/setupEvidenceDenials.rules.mjs, test/rules/activationsDenials.rules.mjs. The Film Room's pointer read (§6) is a later Film Room task in api/\_utils/filmTape/\*.

## 11\. Open founder questions

* Q-ID1-1 (scope). Record tournament (flat6) battles, CPU sides and training-clone battles, or tiered BaggerBomb agent battles only (gameMode absent or baggerbomb\_agent, the agent side, casual-agent- included, training-agent- and isCpu excluded)? Production since 1 Sep: 176 tournament vs 42 tiered. Recommendation: tiered only in V1, counted exclusions in the census.  
* Q-ID1-2 (host budget). Seat the observer as the sixth tenant by raising the reflections cron's pinned tenant budget (50 s → 58 s, still far under the 120 s ceiling), or host it in the settle run? Recommendation: the sixth tenant.  
* Q-ID1-3 (evening and late-day activations). For a creation after the close or a BR-2 late-day creation, the evidence asOf at activatedAt is the previous session (F-11). Keep §4.2's rule as written (recommended; add firstTradingDay to the pointer so readers see the gap), or date starting positions to the session before timing.tradingDays\[0\]?  
* Q-ID1-4 (the missing\_bar cutoff). How long is a newest-session missing\_bar retried before the battle-end sweep writes missing: 'snapshot\_unavailable' on the pointer? Recommendation: the store never finalises it; the sweep writes missing at battle end, and the first week's log of fetchedAt − closeMs sets a cutoff.  
* Q-ID1-5 (finality table). Confirm §F3, in particular interior missing\_bar and non\_session\_date as final and insufficient\_history as final only when the request reaches ≥ 55 sessions back.  
* Q-ID1-6 (acquisition path). Own /eod/ read with full provenance (recommended), or the cache with the split heuristic permanently not\_available?  
* Q-ID1-7 (rules posture). activations fully server-only in V1 (recommended, per §6), or owner-read like the tape from the start?  
* Q-ID1-8 (activatingTick shape). Accept F-1's { tickSeq, evalId, evaluationId, source } in place of { evalSeq, evaluationId, source }?

## 12\. Proposed split

1. Build 1 — the framework's store and helper (no host, no cron, dark). api/\_utils/setupEvidence/: sessionAt.js (the wrapper, §D, with the test matrix), key.js (§F1), acquire.js (the /eod/ date-range read, mapDailyRows \+ attachAdjustedClose, the adapter, evaluateTfEntry, the §F3 table), store.js (claim \+ tx.create, §F2), index.js (getOrAcquireSnapshot({ session, symbol, now })). Rules for setupEvidence \+ the denials suite \+ the source tripwire. C4 appended to the definition. The shape note copy, this report and the growth map V1.2 committed under docs/. Unit tests on synthetic bars; one Admin-SDK integration test behind the emulator. Slice 2 and the Practice Field build against this.  
2. Build 2 — the ID-1 observer. api/\_utils/activationEvidence/: discover.js (roster \+ slot chain \+ live portfolio \+ tick join, §A/§B), pointer.js (§4.2 with F-1/F-2/F-4), sweep.js (battle-end), tenant.js (the sixth tenant), the gate (ACTIVATION\_EVIDENCE\_ENABLED \+ readCockpitAllowlist, the gate.js shape), the census script (scripts/census-activation-evidence.mjs: pointers written, gaps detected, unresolved attributions, excluded crypto, retryable snapshots outstanding). Rules for activations. Wiring in process-pending-reflections.js. Review at the §2 threshold (it will be ≥ 10 files).  
3. Later, the Film Room's: the tape's tick-ordered pointer read (§6) and the continuation policy (§5) before "Chase or hold".

---

*Read-only. Nothing committed, pushed or opened. Scripts and this report live in the session scratchpad; the first build carries the report into docs/audits/.*  
