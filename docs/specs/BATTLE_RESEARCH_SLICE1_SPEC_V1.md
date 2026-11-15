# Battle Research — Slice 1 — spec of record (V1.1)

**Status:** the spec of record for Battle Research Slice 1, committed with the surface build (PR B). It is the build prompt of Nov 13, 2026 at revision V1.1 (Nov 14), whose nine NEW rulings ChatGPT confirmed on Nov 14 with six adjustments, all written in (Appendix B). Readings the build made where this text is silent are in the build report, `docs/audits/20261114_BUILD_BATTLE_RESEARCH_SLICE1.md`.
**Basis:** ChatGPT's confirmation of Nov 13 and its decisions of Nov 14; the field inventory `docs/audits/20261112_BATTLE_RESEARCH_FIELD_INVENTORY.md` (PR #1044); the founder's rulings Q1–Q5 (Nov 12).
**Checked against:** `main` at `c85f7b41`; built on `origin/main` at `5a8c3620`.

---

## 0. In plain terms

Today the battle's **Research** pill opens the bench sheet: a flat list of names. Slice 1 replaces it with **Battle Research**, where the player's agent proposes a question and the player works through it by tapping.

**What the player sees:**
1. **The agent proposes.** *"CEG is our weakest holding at the 1:45 check, 0.6 rungs below entry. I can line up the bench and my watchlist against it."* Four starting questions sit under it. The first is **Find alternatives to our weakest holding**.
2. **The result.** The title names the holding: **Compare alternatives to CEG.** Every name from the bench and the agent's watchlist is ranked by technical rank, with today's move beside it and the time of each reading. CEG sits in the list as a dashed reference line, not ranked. Names above the line out-rank it.
3. **The agent explains,** in its own name, from the numbers on screen: which names out-rank CEG, which can come in now, and how today's moves compare. It always says that keeping CEG is a fair answer, and that none of this predicts points.
4. **Refine by tapping:** order by today's move, keep only names that can come in now, keep only names up today, or one sector. Each tap is a step with Undo, and a banner says what moved and why. Nothing is re-read, so nothing reorders on its own.
5. **Open a name.** The research modal opens with the question still attached at the top. It shows where the name placed, one line for it and one against, and a side-by-side comparison with CEG. The 💣 view shows the same rung size and time as the row. **‹ Back to ranking** returns to the same list.
6. **Draft it for the agent.** The chat opens with a short draft typed in. It holds the question, the refinements, the order, both names and their readings with times, then *Should ANET replace CEG?* Anything the player had already typed stays. **Nothing is sent.** Sending is the player's choice, and it costs one message, like any chat.

**What it never does:** trade, file an instruction, spend a message on a tap, predict points, or show a number without its time. It makes no provider call and no model call. It writes nothing; the investigation lives in memory until the page reloads (Slice 2 stores it).

**Three PRs:** **A** — the server read of today's moves, and the ranking logic, with no screen. **B** — the screen and the modal's research state. **C** — the one-line switch that turns it on for the allowlist.

---

## 1. The basis

**Design of record:** the Nov 11 prototype `Battle Research - Evidence sequence (standalone).html`, for interaction and visual reference only. The blocks followed: `Br2Opening`; `Br2Board`; `BrRankRow` / `BrRefRow`; the agent column (`BrExplain`, `Br2Next`, `BrTrail`); `Br2Context`; the phone layout (explanation clamped in the bottom bar, *Read more · history* opening a sheet).

**Excluded from the prototype:** its invented entry rules (*fits our approach*), the standalone momentum score, the fundamentals score, the blended score, price compression, the SPY comparison, overlap with holdings, the free-text composer, drag, and the *design note* about other archetypes. Its sample data (*Shadow*, *Trend Follower*, *CPU*) is never hardcoded.

**Integration target:** the modal as built — the two-view shell (`docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md`, Amendment C R-23–R-35); the questions that follow the row (§11) and the Battle chart (§12); state 2 as recorded (Amendment C §6; the shell spec §9); R-34's block list (`AnalysisSheet.jsx`: `battleBlocks`, `AnalysisBlocks`; *"the later build prepends its blocks"*); R-23 (the voice label is *{Agent} · {Archetype}*); R-26 (tap first).

**Reused, never copied (BUILD_RULES §4):**

| Need | Reuse |
|---|---|
| The weakest holding | `src/components/Research/Sheet/book.js`: `bookOf`, `weakestOf`, `unscoredOf`, `offLadderOf`, `bookCheckMs`, `lockNowOf` |
| The groups | `src/data/battleUniverse.js` (`selectBenchRoster`, `selectBattleUniverse`, `universePlace`) — extended, not re-derived (BRS-3) |
| Eligibility | `api/_utils/callRecords/swappable.js` `canComeIn` |
| The rankings read | `useSheetView.js` `readRankings` — moved to one shared function both use |
| The ATR reading | `src/components/Research/BombMode/atrReading.js` `atrReadingOf`; `bombCopy.js` `atrReadingText` (one decimal) |
| The day % text | `src/screens/battleView/cockpit2bModel.js` `pctText` |
| Clock and dates | `src/components/Research/BombMode/checkClock.js` (`etDate`, `etClockAmPm`, `etWeekday`, `sessionOpenAt`); `src/utils/marketSchedule.js` `getMarketState` |
| The agent's name | `src/screens/battleView/agentName.js` `agentNameOf`; `src/data/archetypeDisplay.js` `getArchetypeDisplayName` |
| The modal's incumbent | `sheetContext.incumbent` — the bench door's path |
| The modal's rankings | `sheetContext.rankings` |
| The prefilled chat | `AgentBattleScreen.jsx` `composerPrefill` / `setComposerPrefill` and `handleAskFollowUp` |
| A route's shape | `api/agent/cockpit-bench.js` |
| The gate | `src/components/Research/Sheet/sheetGate.js` `useSheetModeForBattle`; server side `api/_utils/callRecords/mode.js` `isCockpitOwnerAllowlisted` |

---

## 2. Phase 0 (inside the build)

Nine points, confirmed in PR A's description; stop only on a contradiction with a ruling: (1) the entry; (2) the snapshot's fields and units (one Admin SDK `.get()`); (3) company names and their coverage; (4) the session clock; (5) the phone path to the chat; (6) the research incumbent's wording in the modal (only strings naming the cockpit or a call change, keyed off `sheetContext.research`); (7) H3 fixed; (8) the composer's prefill against unsent text (an append mode if it replaces); (9) the chat's message length limit.

---

## 3. The rulings

### Scope, entry, gate

- **BRS-1 — Where it runs.** Only on an **agent battle** that is **active**, **not a League battle** (`isLeagueBattle`), has cockpit 2b on, and whose shell resolves on (`useSheetModeForBattle`). Everywhere else, nothing changes.
- **BRS-2 — The entry (NEW).** While Battle Research resolves on, the Research pill opens **Battle Research** in place of the bench sheet's browse mode. The bench sheet stays exactly as it is for **Browse the bench →** from a card, including its research door on each row. Only one of the two is open at a time. Reopening Research restores the current investigation at its result, step and scroll position. With the mode off, the pill opens the bench sheet byte for byte as today (a golden holds it).
- **BRS-3 — The flag.** `BATTLE_RESEARCH_MODE`, a string tri-state `'off' | 'allowlist' | 'on'` in `src/config/researchModalFlags.js` with its own pin test, resolved at call time by `resolveBattleResearchMode()`; any other value is `'off'`. `'allowlist'` uses the same cached cockpit-status verdict as the shell. The server route admits an owner only when it resolves on for that owner (`isCockpitOwnerAllowlisted` at call time for `'allowlist'`). `'off'` in PR A; PR C moves it to `'allowlist'`; `'on'` is a later one-line founder PR.

### The groups

- **BRS-4 — Two groups (Q1).** **Bench**: the persisted bench stocks plus the bench crypto. **Agent watchlist**: the hot bench plus the equipped-list snapshot (`agentContext.equippedWatchlist.tickers`) — the label on screen, never "Watchlist" alone. Held names are left out of both and listed as *held*. Not in Slice 1: the monitoring list, the owner's saved lists, the device's dashboard list. One pure function, `researchGroupsOf(battle)`, in `battleUniverse.js`, walks the same lists in the same order as `selectBenchRoster` and returns `{ bench, agentWatchlist, held, membership }`; a name on both lists carries both tags.

### The opening and the weakest-holding question

- **BRS-5 — The proposal.** On open the agent proposes, under *{Agent} · {Archetype}*: the weakest holding, its check time and its rungs from entry (through `book.js`). Four starters (**NEW**): **Find alternatives to our weakest holding** (primary); **Rank my bench**; **Rank my agent watchlist**; **What's moving today on my bench and watchlist?** — the fourth on only once **at least one usable regular-session stock quote** (§4 *ok*) has arrived; until then disabled with the calendar's line: before the open *Today's session opens at 9:30 AM ET*; open with no usable quote *Waiting for today's quotes*; a weekend or a holiday *Market closed · next session {Mon, Nov 16} · 9:30 AM ET*. The move ordering and the move conditions follow the same rule and lines. A collapsed *Your bench and watchlist as they stand · {n} names by technical rank* lists the union from the evidence fetched on open.
- **BRS-6 — Find alternatives to our weakest holding.** The tap fixes the incumbent as `weakestOf(bookOf(battle))` at that moment (symbol, `positionId`, tier, slot, `rungsShown`, `checkAtMs`, the receipt's `scoringPct`, `lockNowOf(entry)`). Titled **Compare alternatives to {SYM}**. Fixed until **Refresh**. Candidates: the deduplicated union of Bench and Agent watchlist, each with its tags and its eligibility against the incumbent — one question across both groups, never a third group. Order: universe technical rank by default; today's move beside each row and a switch to order by it; no blended score. The incumbent is an **unranked reference line**, placed where its own value falls in the active order, never numbered. The explanation always says keeping the incumbent is a fair answer. **No weakest holding** — two cases that never share wording: **awaiting the first check** (*Our holdings are ranked at the next check ({time})*); **not measured this way** (legacy-scored, or no measured stock: *This battle doesn't score holdings in rungs, so there's no weakest holding to compare against*, or *Our book holds no stock on the measured ladder.*) — never a promise of a ranking at the next check. Both offer **Rank my bench** and **Rank my agent watchlist**; neither picks a holding some other way.
- **BRS-7 — The group questions.** **Rank my bench** / **Rank my agent watchlist** rank one group by universe technical rank; a **Same question on my {other group}** step switches the group. **What's moving today…** orders the union by today's move, biggest gain first. With no incumbent, rows carry no comparison; the modal offers **Compare with a holding** (BRS-18).

### Readings

- **BRS-8 — Every number carries its time; nothing is called live.** Rank: *Rank 12 of 228 · 1:01 PM ET* (`stockRankings` `technicalRank` of `totalTechStocks`, the doc's `computedAt`; past the doc's `expiresAt`, *older than usual*). Today's move: `pctText` of the snapshot's `changePercent` with **that quote's own** `priceAsOf` — never a fixed assumed delay. Note line: *Ranks as of 1:01 PM ET · moves as of 1:42–1:44 PM ET*. Rung: a candidate *Estimated rung size ≈4.1% · ATR reading · 1:01 PM ET* (`atrReadingOf` on the row's `techRaw.atrPercent` with the doc's time; `atrReadingText`); a holding *One rung is 3.2% · fixed at entry*; a legacy-scored battle, no rung. Sector: the rankings row's `sectorName`, else the static map.
- **BRS-9 — The reading states.** One pure classifier (§4). Only an **ok** move takes part in move ordering and move conditions. Every other state is **not assessed** — its own words, set apart, never flat, never removed by a condition. A missing move blocks only move-based assessment. Crypto: no rank, no rung, no move (*crypto · not compared here*), under *Not ranked*.
- **BRS-10 — The row and the modal never disagree (LA-3, H3).** Opening a candidate hands the modal the **result's own readings**: the frozen rankings as `sheetContext.rankings`, and the row's ATR reading seeded into the modal's `atrReads` for that symbol — so 💣 prints the row's number and time and makes no second read.

### Order, conditions, steps

- **BRS-11 — Ordering.** Technical rank best first (absent from the rankings → *Not ranked*). Today's move biggest gain first, **Biggest drop first** toggle; ties to technical rank, then the symbol. Universe rank across mixed sectors; with a sector condition, rows print the sector rank first (*3rd of 21 in Technology*) then the universe rank — a label, not a second sort.
- **BRS-12 — Conditions** (prepared taps, no message): **Only names that can come in now**; **Only names up today**; **Only names down today**; **Only {sector}** (one at a time). Up and down are exclusive: adding one replaces the other, as its own step (*then: down today, in place of up today*). **Zero belongs to neither** (a fail, not *not assessed*). Until a usable regular-session quote has arrived, the move conditions and the move order are disabled with BRS-5's lines. A name a condition can't assess sits under *Left out · not assessed*, never *removed*. Every condition and order applies to the result's **whole frozen group** with the other active conditions — so replacing *up today* with *down today* brings back the falling names.
- **BRS-13 — Steps.** Every question, ordering change, condition added or removed, group switch and refresh is a **step** with its own wording. A trail with **Previous step**, **Undo** (the last step), **Start a different question**; earlier questions stay in this session's history. After a refinement, a banner says what changed (the condition or order, how many names left, which names moved and why — *ANET is now #1, was #2, because a name above it was removed. Its rank is unchanged.*), ending *Readings are the same 1:44 PM result. Nothing was refreshed.* Rows that moved carry a neutral *was #3*.

### Freezing and refresh

- **BRS-14 — One result, frozen** at `takenAt`: membership, readings, eligibility, the incumbent, the rankings subset, the quote states. Refinements re-run the order over the same evidence and read nothing. Nothing reorders a result (the modal, the chat, the cockpit, a newer snapshot, a new check, the hot bench's rebuild, the incumbent swapped out, a new rankings run); each the screen can see raises **one quiet notice** with **Refresh** (*A newer check at 2:15 PM: EQIX is now our weakest. This result still compares with CEG.* · *CEG left the book at 2:10 PM.* · *My watchlist changed at 2:01 PM (3 in, 2 out).*). **Refresh** makes a **new result** with an identity on screen (*Result 2 · 2:05 PM*), keeps the question and its refinements, states what changed; the old result stays in the trail. The weakest is re-selected **only on the weakest-holding question**. **Once a minute, one at a time** (*Refresh in 0:42*; a second tap in flight does nothing). **A failed refresh changes nothing** (*Couldn't refresh: the price read didn't answer. Your 1:44 PM result is unchanged.*, **Try again** when the cooldown allows). **A failed first fetch** shows the same kind of line with **Try again** and no result.
- **BRS-15 — Eligibility.** `canComeIn` at `takenAt` (`out` the incumbent on the weakest question, none on group questions). Labels: *Can come in now*; *Locked until 2:15 PM*; *Can't come in · on the equipped list only*; *Can't come in · a crypto can't replace a stock*. The caveat, always under the list: *"Can come in now" means it can be picked now. A swap still checks the sector limit, tournament rules, a fresh quote and your commands left.* A lock passed since `takenAt`: *Locked until 2:15 PM at this result · since passed*.

### The explanation

- **BRS-16 — The agent explains.** Deterministic templates (§9) in the agent's voice, from the frozen result alone. It names specific differences, the leader, whether the leader can come in now, the counts, what is missing. It never predicts, projects points, calls a stock good or bad, mentions fit, overlap, momentum or SPY, or turns movement before entry into points. Directly under the question; on the phone, the first paragraph in the bottom bar clamped to two lines with *Read more · history*. **Candidate lines never contain the word "points"**; the only points figure is the incumbent's `lockNowOf` line in the comparison.

### The modal, opened from a result (state 2)

- **BRS-17 — The research context.** `sheetContext.research` (§8) plus `incumbent` and `rankings`. The modal **prepends** to `battleBlocks` (R-34): (1) the **context strip** — sticky under the pills; the question; each refinement; the group and count; the conditions as chips; the readings' times; **‹ Back to ranking**; the *{Agent} · {Archetype}* label; (2) **For this question** — place and measure, one line for, one against; (3) **the finding** — today's move with its basis and time, and **Use across this result** when up/down isn't already active; (4) **Compare with {incumbent}** (or **Compare with a holding**). Then state 1's blocks, unchanged. In state 2 the **Ranks** tab carries *All stocks · technical rank · {time}*. The modal still opens on Analysis for a non-held stock (FQ-9 unchanged); the Chart and 💣 views are the shipped ones, except the ATR seed. **Back to ranking** closes the modal onto the same result, step and scroll.
- **BRS-18 — The comparison.** Columns: the candidate and the incumbent (no incumbent: a picker of held measured stocks, weakest first). Rows: the question's own measure with its time; technical rank; today's move; one rung (estimate vs fixed at entry); where each stands (the candidate's eligibility; the holding's *{r} rungs from entry at the {t} check*); sector; for the holding only, *Swapping CEG out at the {t} check's price locks {total} pts* (`lockNowOf`). Under the table: one tradeoff sentence and one *What the evidence supports* sentence, then **Draft it for {Agent}** with *Nothing is sent*. Overlap and entry fit are absent, not placeholders.
- **BRS-18a — Use across this result.** Only *up today* / *down today*; the finding offers the condition its own move matches, replacing the other and saying so. The confirm shows three counts against the whole frozen group (*Keep names up today (in place of down today) · 6 would remain · 3 fail · 2 not assessed · Apply · Cancel*). Applying adds the step without leaving the modal; the strip gains the chip; *6 remain · View updated ranking · Undo*. If the open stock leaves the result, the modal stays open and says why, with **Undo**.

### Handoff, Ask, messages

- **BRS-19 — Draft it for {Agent}.** The existing prefill-not-sent path (`setComposerPrefill({ text, nonce })`, the chat opened as `handleAskFollowUp` opens it). The draft carries the question, the conditions and the order, the candidate and the comparison holding with their frozen readings and times, the closing question; a missing reading is left out, never zero; it fits the chat's limit (trim: the sector line, then the rung line). **Unsent text is kept** (the draft is added after it with a blank line). Research and the modal close, the investigation is kept. **Nothing is sent.** Doors: state 2's action row shows **Draft it for {Agent} →** in place of **→ Cockpit**; the comparison carries the same door. Reopening the pill returns to the same investigation, result, step and scroll.
- **BRS-20 — Ask (no free-text box).** **Ask {Agent} about this result** is the same contextual draft, marked *1 msg when sent*; its top names are the first three **placed** names of the current refined result. The modal's own Ask is unchanged. Every tap on the surface and in the research blocks is marked *no message cost*.

### Memory

- **BRS-21 — In memory only.** `useBattleResearch(battleId)` at the battle screen; survives the modal, cockpit, chat and phone sub-screens; clears on reload or a change of battle. Writes nothing. Caps: 10 investigations a battle session, 40 steps an investigation (the oldest goes, with a line in the history). The shape is §6's (Appendix A's).

### Out of scope

- **BRS-22:** overlap; entry fit; momentum, fundamentals and SPY measures; the monitoring list, saved lists and League battles; reload persistence, the research record and the Film Room; drag; free-text parsing; a battle-to-date move; widening the 60-second poll; any change to the bench sheet's scoped flow, to `researchAsk`'s vocabulary, or to a fenced file.

---

## 4. The reading states (one classifier: `readings.js`)

Classified once at `takenAt`, frozen with the result; refining never re-classifies; only a refresh classifies again. **The median** is computed once per result, before any condition, over the result's **valid regular-session stock quotes** (membership plus the incumbent, minus crypto, fallback, missing, earlier-session, pre-market and after-hours); fewer than three — the relative rule is skipped.

`classifyMove({ quote, isCrypto, session, medianAsOf, snapshot, takenAt })` → `{ state, cause, words }`, first match wins:

| State | When | Shown as |
|---|---|---|
| `unsupported` | a crypto | *crypto · not compared here* |
| `fallback` | `isFallback: true` | *No real quote yet* |
| `missing` | no snapshot; no entry; `price.value` or `previousClose` null or ≤ 0; `changePercent` null (never derived) | *No price yet* |
| `missing` · `no_time` | `priceAsOf` missing, not finite, or after `takenAt` | *No quote time* |
| `earlier_session` | `sessionEtDate` is not the current session's date | *Fri's move · close* |
| `pre_market` | today's date, `priceAsOf` before the open | *Pre-market · 9:12 AM* |
| `after_hours` | `priceAsOf` after the calendar close (early closes included) | *After hours · 4:21 PM* |
| `stale` · `collector_stalled` | the symbol's `collectionStalled` | *Price collection stalled for this name* |
| `stale` · `old_sweep` | during regular trading, `sweepAt` more than 10 minutes before `takenAt` | *Last price sweep at 11:02 AM* |
| `stale` · `old_quote` | during regular trading, `priceAsOf` more than **45 minutes** before `takenAt` | *Quote from 12:30 PM · over 45 minutes old* |
| `stale` · `behind_rest` | `priceAsOf` more than **15 minutes** before the median | *Quote from 12:58 PM · older than the rest* |
| `ok` | otherwise | *+1.24% · 1:44 PM* |

Only `ok` is assessed. *During regular trading*: `takenAt` between the open and the close on a trading day, by the calendar. **Delayed** is not a state — every quote is delayed, shown by its own time, never called live. When every quote is stale, the board says so once, naming the cause.

---

## 5. The route (PR A)

`GET /api/agent/battle-research-quotes?battleId=…` (`api/agent/battle-research-quotes.js`). Order: (1) the security middleware and the per-IP limiter; (2) GET only → 405; (3) auth → 401; (4) a `battleId` → 400; (5) the per-user limiter before any read → 429; (6) the battle; missing → 404; (7) not the owner → 403; (8) not active, or League → 404 `battle_research_unavailable`; (9) the flag not on for this owner → 404 `battle_research_unavailable`; (10) `intradaySnapshots/latest`: one Admin SDK `.get()` through a per-instance memory cache of at most 30 seconds keyed by `sweepId`, **never a provider call**, a missing doc → `snapshot: null` and every quote `null`; (11) 200 with `Cache-Control: private, no-store`. The symbols are `selectBattleUniverse(battle)` — **never a list from the client**. Body: `{ servedAt, snapshot: { sweepId, sweepAt, lastSuccessfulSweepAt } | null, quotes: { [sym]: { price, previousClose, changePercent, priceAsOf, sessionEtDate, collectionStalled } | null } }` — copied, never derived; times in ms; nothing else leaves the server. **No Firestore rule changes.**

---

## 6. The result shape (in memory; Appendix A's schema)

```
investigation {
  investigationId, battleId, agentId, agentName, archetype, scoringModel, createdAt,
  question: { id, text, incumbent: null | { symbol, positionId, tier, slot, rungsShown, checkAtMs, scoringPct, lockNow } },
  steps: [ { stepId, parentStepId, kind, wording, at, resultId,
             view: { group, order: { measure, direction }, conditions: [ { id, value? } ] },
             outcome: { placed, reference, removed, notAssessed, unranked } } ],
  cursor,
  results: { [resultId]: { resultId, label, takenAt, membership, excluded, rankings, quotes, incumbent } }
}
```
The rankings subset covers every name the modal's packs read (Phase 0); if packs read rows outside it, the current result keeps the whole doc and older results keep the subset. Positions are within the result only; the universe rank is a separate number with its own label.

---

## 7. The surface

**Container (NEW):** phone (390 × 844 first; 320 with no sideways scroll) a full-height layer; desktop a centred panel up to ~1,100 px, the board left and the agent column right. Focus trapped; Escape closes and focus returns to the Research pill; the research modal stacks above and the surface is then inert and takes no keys (CB4-9); **Escape closes only the top layer** (with the modal open, the modal; focus returns to the row that opened it). Tokens only (§10); the shipped motion, instant under reduced motion (§11); every label sizes an inner `<span>` (hazard 48).

**Top strip:** *Research*, *{Agent} · {Archetype}*, the score pair as the battle header shows it, Close. The opponent's label from the header, never "CPU".

**Opening:** the proposal card (*{Agent} proposes*, the proposal, the honesty line *A ranking doesn't predict how the battle ends*); the four starters, ≥44 px; the collapsed *as they stand* list.

**Board:** the question as title with *then: …* under it; the note line; the explanation (the lead); the banner; the toolbar (order switch with *Biggest drop first*; the group switch for group questions; **Undo**, **Previous step**, **Start a different question**; **Refresh** with the result's label); the conditions (active chips, then *Refine this result · no message cost*); the list (the dashed reference line with its hairline label; the placed rows, top 5 phone / 6 desktop, then *Show all {n}*; **Left out**; **Not ranked**); the footer (the caveat; **Ask {Agent} about this result · 1 msg when sent**).

**A row** is one tap target: line 1 the position, the company name and the ticker, the group tags, the eligibility pill; line 2 (mono, small) the rank and its time, today's move and its time or its state words, the rung estimate, the sector; line 3 (weakest question only) at most two neutral difference chips from the evidence.

**History:** desktop in the agent column; phone in the *Read more · history* sheet; each step with its wording and time, tappable.

---

## 8. The modal's research context (PR B)

`sheetContext.research = { investigationId, resultId, stepId, question: { text }, refinements, group: { label, count }, conditions, order, times, row: { symbol, position, placed, measureText, support, against, finding }, incumbent, holdingsForCompare, atrReading, onBack(), onUseAcross(id), onApplyUseAcross(id), onUndo(), onDraft(sym) }`. Blocks render only when present; state 1 is byte-identical without it. `useSheetView` keys a research opening by `stepId` too.

---

## 9. Copy

One file, `battleResearchCopy.js`, in the founder's plain-terms style.

| Key | Text |
|---|---|
| Proposal, with a weakest | *{INC} is our weakest holding at the {t} check, {r} rungs from entry. I can line up the bench and my watchlist against it by technical rank, with today's move beside each name.* |
| Proposal, awaiting the first check | *Our holdings are ranked at the next check ({time}). Until then I can rank the bench or my watchlist.* |
| Proposal, not measured | *This battle doesn't score holdings in rungs, so there's no weakest holding to compare against. I can rank the bench or my watchlist instead.* · or *Our book holds no stock on the measured ladder. I can rank the bench or my watchlist instead.* |
| Honesty line | *A ranking doesn't predict how the battle ends.* |
| Weakest result, by rank | *{k} of {n} names out-rank {INC} (rank {ri} of {N}). {L} leads at rank {rL}{, and it can come in now \| , but it's locked until {t} \| , but it can't come in: {why}}.* |
| … moves | *Today {L} is {up \| down} {mL} and {INC} is {up \| down} {mi} (as of {t}).* · or *I don't have today's move for {X} yet.* |
| … none out-rank | *Nothing on the bench or my watchlist out-ranks {INC} on technical rank.* |
| … always | *None of this says how either would score from here. Keeping {INC} is a fair answer.* |
| Group result | *{n} names on {group}. {L} leads at rank {rL} of {N}{eligibility}. {u} are up today, {d} down, {x} without a reading yet (as of {t}).* |
| Before the open (trading day) | *Today's session opens at 9:30 AM ET. I'm showing {Day}'s moves for reference and don't rank by them.* |
| Open, no usable quote yet | *Waiting for today's quotes. I'll rank by today's move once they arrive.* |
| Weekend or holiday | *Market closed. The next session is {Mon, Nov 16} at 9:30 AM ET. I'm showing {Day}'s moves for reference.* |
| Refinement banner end | *Readings are the same {label} result. Nothing was refreshed.* |
| Tradeoff (compare) | *{CAND} out-ranks {INC} {and is up more today}; {INC} {is up more today \| …}.* Built only from rows where both have a reading. |
| Evidence supports | *On {measures}, {CAND} is ahead of {INC}{. It can come in now \| . It can't come in now: {why}}. None of this says how many points it would score.* |
| Draft, with incumbent | The block below |
| Draft, no incumbent | The same block with no holding column; it ends *What do you make of {CAND}?* |
| Ask about the result | The same header lines, then one line per top name (*ANET · rank 12 · +1.24% · can come in now*), ending *What do you make of these?* |
| Caveat | *"Can come in now" means it can be picked now. A swap still checks the sector limit, tournament rules, a fresh quote and your commands left.* |

The draft (BRS-19) — each reading carries its time, and a reading the result doesn't have is left out:

```
Research: "Compare alternatives to CEG" (result 1:44 PM ET)
Then: only names that can come in now · ordered by today's move
ANET vs CEG:
• Rank: ANET 12 of 228, CEG 140 (ranks 1:01 PM ET)
• Today: ANET +1.24%, CEG −0.81% (quotes 1:42–1:44 PM ET)
• Rung: ANET ≈4.1% (estimate), CEG 3.2% (fixed at entry)
• ANET can come in now. CEG is −0.6 rungs from entry at the 1:45 check.
Should ANET replace CEG?
```

The honesty tests hold all of it: no *will*, *should buy* or *likely*; no points in a candidate line; no *live*; no *fit*, *overlap*, *momentum* or *SPY*; every number has its time.

---

## 10. Files · 11. Tests · 12. Review · 13. PRs · 14. Report · 15. Dependencies · 16. Session rules

As in the build prompt of Nov 13 (V1.1). PRs: **A** `claude/battle-research-s1-engine` (route, pure modules, `researchGroupsOf`, the shared rankings read, flag and gate, tests; `'off'`); **B** `claude/battle-research-s1-surface` on A (surface, store, state 2's blocks, handoff, screen wiring, this spec, the report; `'off'`); **C** `claude/battle-research-s1-allowlist` on B (`'allowlist'` and its pin). The founder merges A, then B, then C. The build crosses BUILD_RULES §2's threshold: four lenses (readings and freezing; honesty and display agreement; the route's security and cost; the phone UI), each with a refuter; every confirmed finding gets a test that fails before the fix. Dependencies: the proposed trader-game direction is not adopted (BB-3, BB-7/8, BB-9, BB-15, BB-18 each land in one place); the calendar of record holds 2026–2027; Slice 2 needs the research record at schema v2 (Appendix A).

---

## Appendix A — the result shape, for the research-record framework

Schema v2 of `researchWork`, so a battle investigation is stored as it stands in §6, unchanged: origin `battle_research`, host `agentBattles`; fields for the question, the steps (wording, kind, view, time), the membership with tags and eligibility, the exclusions, the frozen evidence per result (rankings subset with `computedAt`, quotes with `priceAsOf` and state), the incumbent with its check time and `lockNow`, the order, the conditions and the outcome lists; new source record kinds `agentBattles`, `intradaySnapshots`, `voiceLayerCache`; a Film Room reader.

## Appendix B — ChatGPT's decisions (Nov 14), as applied

1. BRS-2 confirmed (reopening restores the investigation). 2. BRS-5 confirmed with availability rules (the first usable regular-session quote, not 9:30; *Waiting for today's quotes*; *next session …*; *awaiting the first check* split from *not measured*). 3. §4 adjusted (pre-market joins after-hours; crypto has no move; the 45-minute cutoff; the median once, before conditions; a missing or invalid time is not assessed; stale labels name their cause). 4. BRS-12 confirmed (the replacement in history; zero belongs to neither). 5. BRS-14 confirmed with detail (one in flight, a visible cooldown, a failed refresh keeps the result, the weakest re-selected on the weakest question only). 6. BRS-18a confirmed with replacement behaviour. 7. BRS-19 confirmed with a fuller draft; unsent text kept. 8. BRS-20 confirmed (top names from the placed names). 9. §7 confirmed (390 and 320 in a real browser; Escape closes only the top layer).

**Still deferred:** overlap, entry fit, drag, persistence, the Film Room, broader free-text research.
