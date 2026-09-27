# Film Room Review Loop — Design Note V1.2

**Date:** 2026-09-15
**Supersedes:** V1.1 (same date)
**Origin:** Film Room parallel chat (the Film Room is Phase 4 of the Command Center / Battle View arc)
**Status:** Design note. **Not a spec and not build-governing.** Incorporates Fable's honesty review of V1.1 (Sep 15) and the founder's Sep 15 rulings. The spec follows, goes to Sol blind, and returns to the arc chat before any build (handover brief §6).

**Changes from V1.1**
- Founder rulings added: R11 (the headline score is the score that decides the outcome), R12 (three depths), R13 (the tape is built for every battle).
- Fable's four headline findings applied: disarmed mechanisms get their own verdict state (B1); R8 no longer claims the data position is solved (B2); the tape's grain is the completed trading day (B3); tomorrow's card names two battle shapes (B4).
- Fable's corrections applied: tiers cited to both sources; the watchlist thesis reaches the deploy-time Sonnet prompt; the Capital Preserver definition is an R7 precondition; gameplan swap reasons added; the leading-index precedent cited; §11 item 12 relabeled; schema-owner succession stated; R2 retires the writer, not just the display.
- Fable's further findings applied: clause classification (B5), a two-sided hold record with horizon labels (B6), facts-only case wording (B7), the archetype shelf gated on the directive-gate discovery (B8), a bench reconstruction label (B9), no agent narration before grounding (B10), provenance tags (B11), R5 and R6 recorded precisely (B12, B13), trading-brain versus safety-net copy (B14).
- Refinements beyond the review (see §15): gameplan swaps attributed as confirmed proposals; the timing question extended to the swap replay and called shots; narration off rather than labeled; player levels never reach the agent; patient holds also shown as restraint (taxonomy §1.9.2).
- Phase 0 questions 15 and 16 added; items 1–5, 9, 10, 12 and 13 extended or relabeled.

**Inputs:** Film Room handover brief (Sep 15) · Sep 14 BaggerBomb battle and Film Room screenshots · `FANTASYTRADES_PHASE_4_FILM_ROOM_TECHNICAL_REFERENCE.md` · `AGENT_LEARNING_CHARTER_V1.md` · `ARCHETYPE_IDENTITY_CONTRACT_V1.md` and the five `ARCHETYPE_DEF_*` files (2026-06-24) · `HARNESS_TRADING_ORACLES_V1_SECTION_1_R4_FROZEN.md` · `STRATEGY_LAYER_AND_ARCHETYPE_V2_BOOKMARK.md` · `SIGNAL_INVENTORY_V2.md` · `FORGE_ENFORCEMENT_KEYSTONE_QUICK_REFERENCE.md` · `WATCHLIST_EQUIP_SYSTEM_REFERENCE.md` · `SCOUTING_FOCUS_FOUNDATION_DESIGN_V1_1.md` · `FANTASYTRADES_LAYER1_FOUNDATION_REFERENCE.md` · `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1_ADDENDUM_B.md` · `FANTASYTRADES_SESSION_SUMMARY_JUN11-12_2026_VWAP_FLOOR_HAIKU_RELIABILITY.md` · Forge Record design V1.1 and its Sep 12 Phase 0 · Sol's blind ideation response (Sep 15) · Fable's honesty review of V1.1 (Sep 15) · the founder's daily review routine and micro-window description (Sep 15).

Every claim about live behavior below comes from documents, not code. Plan-said ≠ code-did: the Phase 0 in §11 confirms or refutes each one.

---

## 1. The problem

The Film Room renders narration without arithmetic. An LLM self-grade, a free-text lesson and free-text proposed rules sit on top of a trade list that cannot support them, and nothing proposed has anywhere to live. The Sep 14 page shows the cost:

- **It graded a swap on points lost before the swap.** Trade rows carry the sold leg's numbers, so BE→PANW's −147 banked was BE's loss up to the sale. The debrief attributed it to PANW and graded the swap D.
- **Its lesson aimed at the safety net.** The lesson and the first proposed rule told the agent to stop trading on defensive triggers, naming `bust_avoidance` (an emergency protective exit), and asked a Speculator for "conviction-based thesis trades" — out of character for an archetype whose discipline lives at its exit floor.
- **Its plans went unchecked.** Eight anticipation entries; QCOM named as the swap candidate in four and never taken; at least one plan cited the daily VWAP, which the arc has found the agent cannot observe.
- **The brief's three defects.** Three score arithmetics (−176 / +125 / an implied 155), no record of the filed directive, and no post-sale path for sold names.

The page answers "what did the agent think of itself?" A player's questions are: did the moves work, was it skill or luck, what did my call do, and what do I carry forward?

## 2. Rulings (founder, Sep 15)

| # | Ruling |
|---|---|
| R1 | Kill letter grades. Computed verdicts replace them. |
| R2 | Retire agent-written proposed rules — at the writer, not only on the screen. The player files takeaways and computation supplies evidence. The batch review's `proposedRules` and the auto-debrief cron's `forgeSuggestions[]` (minted with no user turn, per the Forge Record Phase 0 D-i contingency) are retired or quarantined under amended D-i, pending in the Forge Record stream. The tape does not ship beside a live agent-authored rule writer. |
| R3 | Takeaways live in the agent's record (the Forge Record Ledger), not a Film Room store. |
| R4 | The player's own directive is replayed on its merits — what the requested action would have been worth — never as a claim that the agent obeyed or ignored it. |
| R5 | Tomorrow's card is player-authored for v1, starting from the archetype's computed scouting board. The agent may comment once narration is permitted (§10); its own plans stay in its called shots. This is conscious v1 scoping, not a stance: Addendum B's default User Vision mechanism is agent-proposed and user-confirmed, the founder's instinct aligns with that default, and Assignments V2 does not inherit R5. |
| R6 | The Film Room opts out of the XP track: no XP and no streaks for reviewing. Closure is the hook, and nothing rewards volume or agreement with the agent. The track itself (Charter §6) is unchanged. |
| R7 | The archetype judgment standard is authored with the Regime Taxonomy method: founder trading judgment, formalized in session, frozen and dated, with provenance tags (taxonomy §1.11). First job: locate or author the Capital Preserver definition (§5). |
| R8 | v1 technical windows are 10-minute and daily. No new feed is needed: the platform already fetches 5-minute candles, and two make one 10-minute candle; the founder prefers 10-minute for its lower noise. Whether a session's candles are retrievable in time after the close is open (§11 item 6) — the same feed has read a day behind during sessions. Hourly and 4-hour are deferred. |
| R9 | The 10-minute window looks at moving averages, price shapes (for example, a breakout above the session's opening price, or a sharp reversal), volume anomalies (which mark where a shape starts and ends), and relative strength against the leading index, the sector ETF and, later, the industry/group leader. RSI, MACD and the other indicators stay on the daily window. |
| R10 | Levels before patterns: v1 computes levels and a small set of measures, and a named shape enters only with a mechanical definition. Point-in-time: every level or measure used to judge a decision is computed only from candles closed before that decision. |
| R11 | The day's headline score is the score that decides the outcome. Phase 0 reports what the scorer counts toward the outcome today, including badge points; the founder confirms that is the intended definition. Every surface reads that one source. |
| R12 | Three depths (§4.1). No player is required to go past the first. |
| R13 | The tape is built for every battle, not only reviewed ones. (Grain: the completed trading day — approved by default, B3.) |

**Approved by default (the founder may object):**
- *From V1.1:* game vocabulary on player surfaces, never "research"; one status vocabulary (§7.5); takeaways routed by the mechanism that made the exit (§4.3); the settings fingerprint fixed before any trial result is trusted; close basis per window (§6.3).
- *New in V1.2:* day grain for the tape (§4); armed-state verdicts with an armed-only protection record (§4.3); gameplan swaps attributed as confirmed proposals (§4.3); "estimated" and "as rebuilt" labels (§4.2); clause-by-clause classification (§5); facts-only case wording (§5); a two-sided hold record with horizon labels and a restraint view (§6.3); the archetype shelf gated on the directive-gate discovery (§7.2); two battle shapes for tomorrow's card (§8); no agent narration in v1 (§10).

**Still open**
- The founder's confirmation of the outcome definition once Phase 0 reports it (R11).
- The Capital Preserver definition (R7).
- The R7 session's other inputs (§6.6).
- The Learning Charter's ratification status (the project copy shows its ratification line blank).

## 3. Principles

1. **Arithmetic decides; language describes** (Charter §3). Player-facing verdicts are rendered from typed fields, never authored as prose (Charter §5).
2. **Facts are shared. Questions are shared. Behavior is earned locally.** (Sol)
3. **The daily artifact is a closed loop between a prior claim and new evidence, not a lesson.** (Sol)
4. **A takeaway reaches the agent only through something its archetype can change:** a move on its adjustment menu or a setting on a rule it has equipped. Anything else stays the player's note or becomes an archetype or platform finding.
5. **Grade only what the trading brain was given. Judge mechanisms on whether they were armed and whether they fired as designed.**
6. **The player influences; the agent decides.** Review vocabulary obeys the arc's heard/saw rule — never considered, used, decided because, or caused.
7. **The tape is built for every battle, per completed trading day; the casebook renders when someone looks.** If evidence were built only for reviewed battles, archetype-wide evidence would come from the battles players chose to open, which skew toward big wins and painful losses. This follows the Charter's batch miner (M4) at the day grain `dailyReviews[]` already uses (B3).
8. **Case pages state facts; lessons are counts** (Charter M3). No single case is called a mistake or a miss.
9. **A guard that could not arm is shown as disarmed, never as a guard that held** (B1).
10. **Never imply the agent received what it could not:** an unequipped card, an off-universe name, a player's level or condition, or 10-minute data.

## 4. The model: tape, casebook, notebook

Sol's three models are three layers of one product. Each layer covers another's failure mode.

| Layer | Source | What it is | Failure mode, and what covers it |
|---|---|---|---|
| Tape | Sol Model 1 | The computed record: replays, mechanisms, called shots, the player's calls, the score bridge. Facts only. | Emotionally flat → the casebook is the face. |
| Casebook | Sol Model 2 | What the player studies: up to three cases a day, a lens flip to see how another archetype would judge a case, "you've seen this before" precedents. | Stories overpower statistics → cases never promote anything; only the notebook's counts can. |
| Notebook | Sol Model 3 | The claims: the sealed tomorrow card, open questions, trials, statuses. Runs underneath, in game language. | Feels like homework → the casebook is the face; game vocabulary; hard caps. |

**Daily flow**

1. **Build.** After each completed trading day, the tape is built for every battle. A close pass runs with the batch review; a candle pass completes anything that needs intraday candles once they are retrievable (§11 items 6, 13). In a multi-day battle each completed day has its own tape, and the battle-level score bridge assembles at completion.
2. **Resolve** the previous sealed card and any open question the day touched.
3. **Study** up to three cases: the biggest computed swing, any out-of-character call on a prompt-supplied clause (§5), and the play that adds evidence to an open question.
4. **Update** the notebook: record an observation, open or close a question within the cap, check any active trial.
5. **Scout** the next session from the board and seal the card.

### 4.1 Three depths (R12)

The engine follows an expert trader's routine; the surface must stay easy for players who are still learning, as the founder's original brief asked.

| Depth | Time | What the player sees |
|---|---|---|
| Glance | About 30 seconds | The previous card resolved; the day's biggest computed swing in one line |
| Study | A few minutes | The day's cases: the fork chart, who made each exit, the facts of each case against its archetype |
| Deep dive | As long as wanted | The 10-minute chart with moving averages, the session open, volume anomalies, relative-strength lines and confluence zones |

Every depth renders computed facts in templated copy; there is no agent narration in v1 (§10). Hold verdicts carry their horizon label at every depth (§6.3). Headline-first throughout (Addendum B, Principle 3).

### 4.2 Swap replay (the tape's centerpiece)

- **Fork in the road.** From the swap onward, the sold name runs as a ghost line beside the bought name. The gap at the close is the swap's value, in game points, through the battle's own scorer.
- **Exact or estimated.** The scorer banks thresholds on touch at 15-minute ticks, so an exact replay needs the sold name's prices at those tick times after the sale. The platform fetches intraday candles only for held names, so these come from the candle pass. Where only the close is available, the replay is labeled "estimated" (§11 item 2).
- **Two decisions per swap.** The exit and the pick each get a read. The pick is compared with the bench as persisted at swap time. Where bench composition or cooldown state was not persisted — synthetic hot-bench candidates live in memory only and are wiped after a tick's first successful swap (Jun 11–12) — the comparison is labeled "against the bench as rebuilt" (B9).
- **Protective exits show both sides.** Cost when the name rebounded, savings when it kept falling, accumulating into a protection record on armed ticks only (§4.3). Never judged on average regret (Charter T2).
- **One step; v1 horizon is the day's close.** Hold versus this swap, never chained what-ifs.
- **Words.** "Saved" and "cost," never "mistake." A faint market or sector line shows whether the name moved alone or with everything.

### 4.3 Who made the exit

A swap comes from one of several mechanisms, and only one of them is the agent's judgment alone. Routing follows the keystone's swap-reason taxonomy:

| Mechanism (swap reason) | Judged on character? | Where its takeaway lands |
|---|---|---|
| Platform protection (`bust_avoidance`, `vwap_failure`, `stepped_trail`) | No — armed state, whether it fired as designed, and the protection record | Platform (founder's safety design) |
| Deployed guardrail (`guardrail_stopLoss`, `guardrail_trailingStop`) | No — it did what the player set | The player's own settings |
| Stall rotation (`stagnation`; forced rotation, an archetype-locked HFT knob) | No — a mechanical dial | Archetype tuning, never a personal adjustment |
| Confirmed proposal (`gameplan_proposal`, `gameplan_meeting`) | Not on character alone — a joint decision; the agent's proposal and the player's confirmation are both on record | Replayed on its merits (R4) |
| The agent's own call (`haiku_decision`) | Yes, only on prompt-supplied clauses (§5) | That agent, through a menu move |

- **Armed state (B1).** Every mechanism verdict is one of: armed and fired · armed and held · disarmed. The Jun 12 build made `vwap_failure` and `stepped_trail` fail closed per symbol when the intraday session is stale; `bust_avoidance` and deployed guardrails stay armed unless that symbol's quote fetch fails. Sep 10 and Sep 14 read stale. A disarmed guard renders as disarmed, and the protection record accrues only on armed ticks (§11 item 15).
- **Confirmed proposals.** A gameplan swap starts with the agent and needs the player. Silence never counts as the player's call; if any path lets a proposal execute without explicit confirmation, the swap is attributed to that path (§11 item 4).
- **Leans cannot move mechanical exits.** The Forge Record Phase 0 found hold-longer leans are prompt-only and cannot delay deterministic exits. A patience trial measured against stall rotations would always read "contradicted" — a false negative produced by the measurement, not the market.
- **The tautology trap** (taxonomy §1.12.3). Crediting an archetype when a protection threshold fires measures the guardrail, not the archetype.
- **The emergency pick is not the agent's.** As of July (Signal Inventory V2, finding D), the emergency replacement was filtered on cooldown and asset type and sorted by daily change alone. A pick made on that path is not graded as agent selection (§11 item 16 confirms the picker at HEAD).
- **Copy (B14).** "Your agent's trading brain doesn't read 10-minute charts yet" — never "the platform can't see intraday." The safety net reads 5-minute data whenever the feed is fresh.

### 4.4 Called shots

Each anticipation plan is checked: called it and took it · called it and passed · never triggered · can't be checked (the plan names a signal the agent doesn't receive). Plans on names the agent didn't hold need candles the platform doesn't fetch live, so they resolve in the candle pass. Honest checking needs the condition captured in structured form when the plan is written — the voice layer's side, owned by the arc chat.

### 4.5 The player's call

The directive card shows what was asked and what was filed — both, until the directive-gate discovery lands — when it was heard, and what followed ("heard on the next check, then seven holds"). Per R4, the requested action is replayed on its own merits.

### 4.6 One score, shown as a bridge (R11)

The header shows the outcome-deciding score built from its parts (open positions, banked, and badges as the scorer counts them). Any other number on screen is labeled and reconciles with the bridge. The May reference describes the current header as a helper added for the Film Room that sums locked trade points and badge points and omits open positions — the source of −176 against +125. One definition, one source, every surface; the fix goes through the arc chat.

## 5. Judgment by archetype

Every gradable play gets three questions: **Was it in character? Which leg broke, and on which close? What did it cost or save?** Whether a pattern of such plays is the style's known price or a real miss is a notebook count, never a case label (Charter M3, B7). A case may name the archetype's stated tradeoff as context.

**Sources, all existing:** the identity contract's stated tradeoffs; the archetype definitions (four zones, two legs, adjustment menus); the taxonomy's shine/struggle table by regime; and the taxonomy's kinetics-versus-position precedent (§1.10), where the same melt-up is in character for one archetype and out of character for another.

**Preconditions**
- **The Capital Preserver definition.** Five definitions are on file. The Speculator, Diversifier and Fundamental Investor files cite a "Capital Preserver doc" for the hand-off model, and the Speculator's file calls the Capital Preserver's identity "to be defined." Taxonomy §1.11 records that its shine/struggle rows were drafted from definition documents, not from the founder. R7 locates or authors it first.
- **Formalization.** Sol's own example scored a Trend Follower's split-leg sale as "aligned," while the definition says split legs mean hold and surface. Prose is not a grading standard.

**Clause classification (B5).** Every clause, per archetype, is one of:
- **Config-enforced** → a disqualification set, judged only on whether it fired as designed (the tautology trap).
- **Prompt-supplied** → gradable.
- **Absent from the trading brain's context** → a platform finding, routed to the Harness/spine thread.

Classification runs clause by clause. Zone 1's backing mixes mechanical config (weights, fit-sorts) and instruction text (constraint strings), so no zone is assumed to be one class. The June definitions say the four zones feed the voice layer and the directive gate, and the Harness work found decider prompts largely identical across archetypes, so the honest v1 expectation is that the casebook's out-of-character case is often empty. Its copy says so plainly rather than rendering nothing.

## 6. The two windows and the leg record

### 6.1 Daily window

Indicators (RSI, MACD, moving averages and others) and daily levels. Most of these already exist in the platform's daily technical snapshot (Layer 1). The open question is which of them reach the trading brain (§11 item 5).

### 6.2 10-minute window

Built from 5-minute candles. A 10-minute candle counts as closed only when its second 5-minute candle has closed.

| Job | What it covers | In v1 | Needs |
|---|---|---|---|
| Levels | Moving averages; the session's opening price | Yes | Earlier sessions' candles, so averages are warm at the open |
| Participation | Volume anomalies | Yes | A same-time-of-day baseline from earlier sessions. Volume is always heavy at the open and close, so a whole-day average would flag every opening candle |
| Comparison | Relative strength vs. the leading index and the sector ETF | Yes | 10-minute candles for those ETFs |
| Comparison | Relative strength vs. the industry/group leader | Later | The industry layer (Universe Intelligence) and intra-industry leadership |
| Shapes | Breakout above the session's opening price | Yes | Nothing new — a level plus a close through it |
| Shapes | Sharp reversal and other named shapes | One at a time, once defined | Founder definitions. Volume anomalies anchor where a shape starts and ends, turning a visual judgment into a timestamped event |

### 6.3 Rules for both windows

- **Close basis per window.** Extends taxonomy §1.1.5 ("a close below a key level matters; a mid-day break does not"): a 10-minute level breaks on a 10-minute close, and a daily level breaks on the daily close. Extending the rule to intraday windows is proposed for the R7 session.
- **Levels before patterns** and **point-in-time** (R10), on one price basis.
- **Confluence.** Key levels on both windows that coincide mark the range or price to monitor (the founder's method).
- **The exit-timing fact.** Sold before a level broke on a close · sold after a confirmed break · held through a confirmed break.
- **Holds get a two-sided record (B6).** Cost when a held name kept falling; saved when it recovered. Every hold verdict carries its horizon ("judged through today's close"). A one-day window is structurally biased against patient archetypes (taxonomy §1.9.2), so holds are also shown as restraint relative to other archetypes — "didn't exit where a Speculator would have" — the short-window signature of patience that §1.9.2 names. Multi-day resolution stays deferred; the label does not.

### 6.4 Who each window can grade

- **Daily:** the agent, wherever a clause is prompt-supplied (§5).
- **10-minute:** in v1, the player's layer plus platform evidence. As of July, 5-minute candles were fetched for held names only; beyond VWAP, the only intraday indicator was a 5-minute SMA20 used by the stepped trail; no intraday RSI or MACD existed, while eval prompt prose mentioned "5min RSI" seven times; and Sep 14's intraday VWAP path read empty. Copy distinguishes the trading brain from the safety net (§4.3). Over time the layer accumulates evidence on whether the agent should receive intraday data.

### 6.5 One engine and the tallies

**One level engine** serves both the exit-timing verdict (Part 1) and tomorrow's card (Part 2).

**Tallies.** Per player, the leg record is a journal: personal and non-binding. Pooled across all agents of an archetype, with the player's influence separated out, it becomes archetype evidence — once the directive-gate discovery allows that separation (§7.2). Each added window, measure or regime multiplies the tallies that must fill (for example, 2 windows × 5 measures × 4 regimes = 40 per archetype), which is why v1 stays narrow.

### 6.6 For the R7 session

- **The Capital Preserver definition — first.**
- **Explicit founder calibration for the Capital Preserver and the Diversifier**, the two archetypes taxonomy §1.11 records as never calibrated from the founder's own reasoning.
- **Provenance.** R7 output carries `[flash_authored]` / `[formalized]` tags (taxonomy §1.11). The 10-minute vocabulary is a momentum swing trader's; how each archetype weighs each window is where that lean gets checked (B11).
- Which daily levels count toward confluence.
- Which moving averages on the 10-minute window (type and periods).
- The index for the micro comparison line, starting from taxonomy §1.3.1 (RSP for breadth and structure; SPY for the leaders' health). That ruling was made for regime structure, so the session confirms how it applies to a comparison line.
- The reference point for micro relative strength (the session open, the prior close, or the decision moment), and whether it adjusts for how much the stock normally moves with the market.
- What counts as a volume anomaly against the time-of-day baseline.
- Confluence tolerance (ATR-relative, per Charter R1).
- What counts as a break on each window.
- Named shapes, starting with the sharp reversal.
- Regular trading hours only, or extended hours as well.
- How each archetype weighs each window (the Capital Preserver holds through noise; the Speculator trades in it).
- The archetype judgment clauses (§5).

## 7. Where takeaways attach

### 7.1 The address rule

A takeaway must point at a move on its archetype's adjustment menu or a setting on an equipped rule. With an address, it attaches to that archetype on the player's agent and stays with the archetype across switches. Without one, it never reaches the agent.

### 7.2 Shelves

| Shelf | Applies to | Holds | Can change | Bar |
|---|---|---|---|---|
| The agent's archetype | One agent, in one archetype | Lessons on its own menu moves (exit patience, sizing, stops, churn) | That archetype's settings on that agent | Its own episodes, then a trial with one-tap rollback |
| The archetype | Every agent of that archetype | Which legs tell the truth; handling by regime | Calibration only, never identity | Cross-player, regime-robust evidence; public patch notes |
| The platform | All six | Guardrails, the emergency pick, signals the agent can't observe, data defects | Platform fixes | Founder |

The player's journal sits beside the shelves: personal observations that never bind the agent.

**The archetype shelf is gated on the directive-gate discovery (B8).** Pooled evidence must separate the player's influence, and Sep 14 showed that what the player tapped, what the record holds and what the character said can be three different things. Until that discovery lands and the confirmed-proposal attribution (§4.3) is settled, the shelf does not fill. Personal journals are unaffected.

### 7.3 Across archetypes

Facts and questions cross; behavior never does. A destination archetype runs its own test before any matching move changes. The menus show where a question is worth carrying: identical moves ("Reduce position size on new entries" is on all five menus on file), family moves ("require a stronger signal before entering," on four, each defined by its own legs), and unique moves, which stay home. The Strategy Layer bookmark's convergence warning governs.

### 7.4 Nominations and caps

Computation nominates a move when the evidence clears the bar. The player consents, or has opted into automatic trials (off by default). Nothing is agent-originated, consistent with the Sep 12 step-0 stance; the amended D-i remains pending. Caps: one or two open questions per archetype, and one trial per archetype at a time.

### 7.5 Statuses

One vocabulary: the Charter's three tiers (Hunch · Testable · Trial-proven, Charter §5), with Forge Record V1.1's "On trial" (Accept enters a trial at Testable) and Sol's Contradicted and Retired. Evidence accrues at episode grain (Charter M1). A disproven idea counts as progress.

## 8. Tomorrow's card

- **Authored by the player (R5)** from the archetype's computed scouting board, with computed confluence zones offered as facts. The player picks the names, the levels, the reason chain and what kills the idea.
- **Two paths, one resolution.** A casual player picks names from the board and accepts a computed zone; an experienced player sets their own levels. Both are sealed and resolved the same way. Skipping costs nothing (R6).
- **Two battle shapes (B4).**
  - *Before a new deploy:* card → optional equip → the next battle starts with the card frozen in (the watchlist freeze) → resolved on the levels, and on what the agent did with the names it received.
  - *Inside a running multi-day battle:* equip and unequip are blocked while the agent is in an active battle (409), so the card never reaches the agent. It resolves on the levels only, and says so.
- **What reaches the agent when equipped.** The deploy-time Sonnet strategy prompt receives the watchlist name, tickers and thesis; the deploy-time Haiku prompt and the mid-battle cron receive tickers only; activation and invalidation conditions reach nothing; off-universe tickers are inert as mid-battle swap-in candidates. The agent line therefore says only whether a name was on the agent's list and what the agent did — never "the agent passed" on a name it could not reach, and never that it saw the player's level (§11 item 10 confirms at HEAD).
- **Resolved before the next review opens:** did the level trigger, did it hold on 10-minute closes, where the day closed, and the agent line where one applies.
- **Overlaps Scouting Assignments V2.** The two designs should meet; R5 is not inherited as a stance.
- **The group step** of the founder's scan needs the industry layer (Universe Intelligence).

## 9. Return

Closure is the hook: the previous sealed card resolves before anything else. Precedents ("you've seen this before") give the review a history. The session has a finish line: three cases, one update, one card. Per R6: no XP, no streaks, no rewards for volume or agreement.

## 10. Honesty constraints carried forward

- Heard/saw vocabulary only; the agent decides and the player influences.
- No market-alpha claim promoted from personal history (Charter §2); protective exits never judged on average regret (Charter T2); replay points reconcile with the scoring surfaces (Charter §5 display agreement).
- **No agent narration in v1 (B10).** The Film Room's chat runs on the same `/api/agent/chat` path, and `VOICE_GROUNDING_MODE` is at `'shadow'`. Until grounding is `'on'`, the new Film Room renders computed facts in templated copy and shows no agent commentary and no review chat. A label would not undo a misattribution like Sep 14's "the PANW leg was a disaster." The spec's build order inherits the grounding walk.
- Disarmed guards shown as disarmed (§4.3); estimated replays and rebuilt benches labeled (§4.2); the 10-minute layer labeled as data the trading brain does not receive, distinguished from the safety net (§4.3, §6.4); nothing implies the agent received a card, name, level or condition it could not (§8).

## 11. Phase 0 questions (read-only, `file:line`, hard STOP)

1. Where each Film Room header number comes from; the single source the Command Center and the day summary read (brief §7); and what the scorer counts toward the outcome today, including badge points (R11).
2. Post-sale prices for sold names at the scorer's own tick times, not just the close (thresholds bank on touch at 15-minute ticks); whether a sold name stays on the bench and keeps being quoted per tick. The same-day close is not persisted (Forge Record Phase 0; the close-capture rider D-q is pending).
3. Whether swap records carry an exit-time technical snapshot or only entry snapshots (one-way door: every battle without it is lost to the leg record); and whether bench composition and cooldown state are persisted at swap time (B9).
4. The swap reason and risk boundary recorded per exit; the reason-to-mechanism mapping in §4.3; for `gameplan_proposal` and `gameplan_meeting`, who proposed, who confirmed, and whether any path executes a proposal without explicit confirmation.
5. Per archetype, per clause: config-enforced, prompt-supplied, or absent from the trading brain's context; and which daily indicators reach it (B5).
6. **Intraday candles.** Which symbols get 5-minute candles today (held names only, as of July); whether sold names, bench names, and index and sector ETFs can be fetched for the review; how many earlier sessions are retrievable (for warm moving averages and time-of-day volume baselines); whether the feed includes extended hours; when a session's candles become retrievable after the close; call-budget cost. Shared with taxonomy §1.8 item 4 — one discovery serves both.
7. The settings-fingerprint divergence across write paths (Forge Record Phase 0 cross-arc item).
8. Status of the industry/group data layer.
9. What, if anything, writes `dailyReviews[].counterfactuals` (empty on Sep 14); and whether the batch review still writes `proposedRules` and the auto-debrief cron still writes `forgeSuggestions[]` at HEAD (R2).
10. Which watchlist fields reach which prompt at HEAD (§8), and freeze behavior in multi-day battles.
11. Whether anticipation entries can carry structured conditions at write time.
12. Completed-battle routing into the Film Room. (Separate from the arc's unrun tick-stamps client-half smoke, which needs a live battle with a directive filed in its first hour.)
13. **Where the two passes run.** The close pass with the existing batch review cron, and a candle pass once intraday candles are retrievable, given that cron slots are nearly full.
14. **Comparables.** The sector-to-ETF mapping (sector relative strength is already computed daily) and whether any index or sector ETF series is already stored.
15. **Armed state.** Whether armed or disarmed state per symbol per tick is derivable from persisted data for `vwap_failure`, `stepped_trail` and the other mechanisms (`cronState.intradayMomentum` is written; the gate result may not be); and any `vwap_failure` exits recorded since Jun 12 (B1).
16. **The picker at HEAD.** Which replacement picker serves emergency and guardrail exits (`pickEmergencyReplacement` or the June replacement route) and which signals each reads.

## 12. Ownership and coordination

- **Command Center arc chat:** the outcome score fix across surfaces (R11); decider prompt, eval cron, tick stamps, directive transaction; voice grounding and anticipation writing. The spec returns there before build.
- **Forge Record stream:** the Ledger, nominations, statuses, auto-trial consent, amended D-i (R2), and Learning Charter Phase B. This note is an input to Phase B, not a substitute. **Schema-owner succession:** the Phase 4 reference routes review-related schema through the Dossier Roadmap (Dossier Sprint 2). The Forge Record arc has since taken the Ledger and Dossier Sprint 2 is post-launch, so consultation goes to the Forge Record stream — the rule is followed, not skipped.
- **Harness/spine thread:** archetype identity in decider prompts and the §5 clause-classification findings; intraday bar coverage; the close-basis rule and regime labels.
- **Universe Intelligence and Leadership Intelligence:** the industry layer and intra-industry leaders behind the group-leader comparison and the group step of the scan.
- **Scouting Focus / Assignments V2:** the scouting board behind tomorrow's card; R5 is not inherited as a stance.

## 13. Next steps

1. **Founder:** the Capital Preserver definition — locate the document the other definitions cite, or author it in R7.
2. **R7 formalization session** (§6.6), Capital Preserver first.
3. **Film Room Phase 0** against §11.
4. **Founder confirms the outcome definition** from Phase 0's report (R11).
5. **Spec V1** → Sol blind review → arc chat → build, dark behind a flag, with any agent narration sequenced behind the grounding walk.

## 14. Considered and not adopted

- Agent-authored tomorrow card — Addendum B's default; deferred for v1 scope (R5).
- XP and streaks for reviewing — the Film Room opts out; the track remains (R6).
- Agent-originated tuning proposals.
- Hourly and 4-hour windows in v1.
- 5-minute as the player's micro window (the 10-minute window is built from the same candles).
- RSI and MACD on the micro window.
- Computing the tape only for battles a player reviews.
- Labeled agent narration before grounding is on.
- Per-case "miss" or "mistake" labels.
- Crediting a disarmed guard with a hold.
- Research vocabulary on player surfaces.
- Letter grades.
- Cross-archetype behavior transfer.
- Grading the agent against data it does not receive.

## 15. Disposition of Fable's review

| Finding | Disposition | Where |
|---|---|---|
| A.2.1 Tiers | Applied | §7.5 |
| A.2.2 Watchlist fields | Applied | §8 |
| A.2.3 Capital Preserver definition | Applied | R7, §5, §6.6 |
| A.2.4 Gameplan reasons | Applied with refinement: attributed as confirmed proposals (the agent proposes, the player confirms), not solely the player's call; silence never counts | §4.3, §11 item 4 |
| A.2.5 Leading index | Applied with softening: the session starts from §1.3.1 and confirms how a regime-structure ruling applies to a comparison line | §6.6 |
| A.2.6 Item 12 label | Applied | §11 item 12 |
| A.2.7 Schema owner | Applied | §12 |
| A.2.8 Writer still running | Applied | R2, §11 item 9 |
| B1 Disarmed | Applied | §3 principle 9, §4.3, §11 item 15 |
| B2 Data position | Applied and extended: the timing question also gates the swap replay's exactness and called shots on unheld names | R8, §4.2, §4.4, §11 items 2, 6 |
| B3 Day grain | Applied, with a close pass and a candle pass where candles arrive later | R13, §3 principle 7, §4 |
| B4 Card shapes | Applied and extended: player levels and conditions never reach the agent, even when equipped | §8 |
| B5 Clause classification | Applied clause by clause; no zone assumed config-enforced | §5, §11 item 5 |
| B6 Horizon bias | Applied and extended with taxonomy §1.9.2's restraint signature | §6.3 |
| B7 Charter M3 wording | Applied | §3 principle 8, §5 |
| B8 Directive record | Applied | §6.5, §7.2 |
| B9 Bench reconstruction | Applied | §4.2, §11 item 3 |
| B10 Grounding | Applied and tightened: no narration rather than labeled narration | §4.1, §10 |
| B11 Provenance | Applied | R7, §6.6 |
| B12 R5 vs. Addendum B | Recorded | R5, §8, §14 |
| B13 XP opt-out | Recorded | R6, §14 |
| B14 Trading brain vs. safety net | Applied | §4.3, §6.4 |
