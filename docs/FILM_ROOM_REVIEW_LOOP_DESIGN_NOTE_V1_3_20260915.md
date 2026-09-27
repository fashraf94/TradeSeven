# Film Room Review Loop — Design Note V1.3

**Date:** 2026-09-15
**Supersedes:** V1.2 (same date)
**Origin:** Film Room parallel chat (the Film Room is Phase 4 of the Command Center / Battle View arc)
**Status:** Design note. **Not a spec and not build-governing.** Phase 0 is complete (0A and 0B, HEAD `a007a2b5`). The handback to the Command Center chat ships with this version; the spec waits on that chat's replies.

**Changes from V1.2**
- Phase 0 facts replace document claims throughout. Live-behavior statements cite a Phase 0 section, and the reports carry the `file:line` evidence.
- Founder rulings: R11 resolved; R14 (captures), R15 (called shots, provisional) and R16 (character, provisional) added.
- Corrections:
  - the identity block is live;
  - stops are archetype-blind;
  - the industry layer is built;
  - the directive defect is a rendering gap, not a missing record;
  - the "155" score candidate double counts;
  - `gameplan_proposal` has no writer, while `gameplan_rotation` and `guardrail_profitTarget` are real exit reasons.
- The armed-state verdict can't be computed from stored data. It becomes capture request C-1, with four states.
- Called-shot verdicts are deferred (R15), and character is judged on the pick only (R16).
- The review chat is never grounded as built, so v1 has no agent narration.
- New §11 (tape sources and hosting) and §12 (asks). V1.2's Phase 0 question list is retired; its remaining probes are in §13.

**Inputs:** V1.2's inputs, plus:
- `docs/audits/20260915_PHASE0A_ARCHETYPE_IDENTITY_INVENTORY.md` (branch `claude/phase0a-archetype-identity` @ `4f1efeb3`);
- `docs/audits/20260915_PHASE0B_FILM_ROOM_DISCOVERY.md` (branch `claude/epic-bell-stwcxu` @ `d75c35bd`);
- `FILM_ROOM_PHASE0_HANDBACK_TO_COMMAND_CENTER_20260915.md`.

References like "0A Q6.5" or "0B §3-C1" point into those reports.

---

## 1. The problem

The Film Room renders narration without arithmetic. Phase 0 confirmed each part of the diagnosis:

- **The score is built from the wrong ingredients.** The Film Room total is the day's sale ledger plus that day's badge figure. It omits every held position, and on a stocks-only battle's final day the badge figure is never written (0B §3-A1). Sep 14 showed −176 where the outcome-deciding score was 125.
- **Trade rows can't judge a swap.** Every number on a row is the sold stock's; the bought stock contributes only its ticker (0B §3-F1). The debrief built on that record graded the BE→PANW swap on BE's loss before the sale.
- **The lesson attacked a platform safety exit** (`bust_avoidance`) and asked a Speculator for out-of-character entries.
- **Plans go unchecked**, and at HEAD they can't be checked, because a plan's condition is stored as a sentence (0B §3-D3).
- **The directive was recorded but not shown.** It is on the battle document and was heard on the next check, but no Film Room component reads it (handover brief §4; 0B §3-F1).
- **Agent-authored rules are written with no player turn and wired to nothing** (0B §3-B5).

The page answers "what did the agent think of itself?" A player's questions are different: did the moves work, was it skill or luck, what did my call do, and what do I carry forward?

## 2. Rulings (founder, Sep 15)

| # | Ruling |
|---|---|
| R1 | Kill letter grades. Computed verdicts replace them. |
| R2 | Retire agent-written proposed rules at the writer, not only on the screen. The player files takeaways; computation supplies evidence. Both live writers — the review's `proposedRules` and the auto-debrief's `forgeSuggestions[]` — are retired or quarantined (handback C-8, with the Forge Record stream under amended D-i). |
| R3 | Takeaways live in the agent's record (the Forge Record Ledger), not a Film Room store. |
| R4 | The player's own directive is replayed on its merits, never as a claim that the agent obeyed or ignored it. |
| R5 | Tomorrow's card is player-authored for v1, starting from the archetype's computed scouting board; the agent's own plans stay in its called shots. This is conscious v1 scoping: Addendum B's default is agent-proposed and user-confirmed, the founder's instinct aligns with that default, and Assignments V2 does not inherit R5. |
| R6 | The Film Room opts out of the XP track: no XP, no streaks, nothing that rewards volume or agreement. Closure is the hook. |
| R7 | Archetype judgment is formalized with the Regime Taxonomy method: founder judgment, formalized in session, frozen and dated, with provenance tags. The constitutions are the starting point — all six are current and CI-locked to the live identity block (0A Q1–Q2). |
| R8 | v1 technical windows are 10-minute and daily. The 10-minute window is built from 5-minute candles (two make one). When a session's candles are retrievable after the close is still open (0B Probe 3). Hourly and 4-hour are deferred. |
| R9 | The 10-minute window looks at moving averages, price shapes, volume anomalies, and relative strength against the leading index, the sector ETF and, later, the industry or group leader. RSI, MACD and the other indicators stay daily. |
| R10 | Levels before patterns; point-in-time computation. |
| R11 | **Resolved.** The headline is the outcome-deciding score: the cumulative score at the day's close (on the final day, the battle's final score), with the day's change beside it. The outcome counts badge points (0B §3-A1). |
| R12 | Three depths; nothing beyond Glance is required. |
| R13 | The tape is built for every battle, at day grain. |
| R14 | Capture going forward what an honest review needs: armed state, bench at swap time, risk boundaries, post-sale prices, and a per-day score source (handback C-1 to C-5). |
| R15 | Called shots in v1 show each plan beside what the price did, with no verdict, until the condition is stored in checkable form (handback C-6). **Provisional.** |
| R16 | Character in v1 judges the pick, not the hold (§5). **Provisional.** |

**Founder note on R15 and R16.** The founder agrees to a sound premise and settles direction after using the product, and expects both rulings to move after hands-on use. The build therefore keeps them separable: each verdict layer sits behind its own flag and can change without reworking the tape, and the build order puts a usable v1 in the founder's hands early.

**Approved by default (the founder may object):**
- game vocabulary, never "research";
- one status vocabulary (§7.5);
- routing by exit mechanism (§4.3);
- close basis per window (§6.3);
- two battle shapes for tomorrow's card (§8);
- facts-only case wording (§5);
- a two-sided hold record with horizon labels (§6.3);
- the archetype shelf gated on the directive-gate discovery (§7.2);
- "rebuilt" and "estimated" labels (§4.2);
- no agent narration in v1 (§10);
- the tape reads learning receipts and tick stamps rather than widening fenced trade records (§11).

**Still open**
- The settings fingerprint's meaning (handback H-7). This chat recommends "the configuration that governed this battle."
- The data probes and queries (§13).
- The R7 session's inputs (§6.6).
- The Learning Charter's ratification status.

## 3. Principles

1. **Arithmetic decides; language describes** (Charter §3). Player-facing verdicts render from typed fields.
2. **Facts are shared. Questions are shared. Behavior is earned locally.** (Sol)
3. **The daily artifact is a closed loop between a prior claim and new evidence, not a lesson.** (Sol)
4. **A takeaway reaches the agent only through something its archetype can change:** a move on its adjustment menu, or a setting on an equipped rule.
5. **Grade only what reached the trading brain, as both instruction and data.** A rule the brain was told but given no data for is not gradable. Mechanisms are judged on whether they fired as designed.
6. **The player influences; the agent decides.** Heard/saw vocabulary only.
7. **The tape is built for every battle at day grain; the casebook renders when someone looks.** Otherwise archetype-wide evidence would come only from battles players chose to open.
8. **Case pages state facts; lessons are counts** (Charter M3).
9. **A guard not known to be armed is never shown as a guard that held.**
10. **Never imply the agent received what it could not:** an unequipped card, an off-universe name, a player's level or condition, or an indicator it wasn't given.
11. **Two kinds of "saw."** Tick stamps are the only record guaranteed to equal what the model was shown, and they cover held positions (0B §3-D1). Swap snapshots are "recorded at decision time," never "what the agent saw."

## 4. The model: tape, casebook, notebook

Sol's three models are three layers of one product. Each layer covers another's failure mode.

| Layer | Source | What it is | Failure mode, and what covers it |
|---|---|---|---|
| Tape | Sol Model 1 | The computed record: replays, mechanisms, plans beside prices, the player's calls, the score bridge. Facts only. | Emotionally flat → the casebook is the face. |
| Casebook | Sol Model 2 | What the player studies: up to three cases a day, a lens flip to see another archetype's judgment, "you've seen this before" precedents. | Stories overpower statistics → cases never promote anything; only the notebook's counts can. |
| Notebook | Sol Model 3 | The claims: the sealed tomorrow card, open questions, trials, statuses. Runs underneath, in game language. | Feels like homework → the casebook is the face; game vocabulary; hard caps. |

**Daily flow**

1. **Build.** After each completed trading day, a flag-gated rider on an existing cron builds the tape for every battle (§11): score snapshot, replays, mechanism facts, and plans beside prices. Anything needing candles that aren't retrievable yet completes on a later pass.
2. **Resolve** the previous sealed card and any open question the day touched.
3. **Study** up to three cases: the biggest computed swing, any out-of-character pick (§5), and the play that adds evidence to an open question.
4. **Update** the notebook within its caps.
5. **Scout** the next session and seal the card.

The Film Room is reachable from day 2 of a live multi-day battle, because its banner gates on a filed review rather than on completion (0B §3-F1). The day grain supports that.

### 4.1 Three depths (R12)

| Depth | Time | What the player sees |
|---|---|---|
| Glance | About 30 seconds | The previous card resolved; the day's biggest computed swing in one line |
| Study | A few minutes | The day's cases: the fork chart, who made each exit, the facts of the pick against its archetype |
| Deep dive | As long as wanted | The 10-minute chart with moving averages, the session open, volume anomalies, relative-strength lines and confluence zones |

Every depth renders computed facts in templated copy; there is no agent narration in v1 (§10). Held positions and bench candidates render in two different layouts, because the eval prompt gave them different data (§6.4).

### 4.2 Swap replay

- **Fork in the road.** From the swap onward, the sold stock runs as a ghost line beside the bought stock. The gap at the close is the swap's value in game points, through the battle's own scorer.
- **The scorer is reused as-is.** `calculateAssetScoreServer` is pure and already runs server-side (0B §3-B4). BUILD_RULES §4 forbids a local copy.
- **Sample at the battle's checks, not from OHLC.** Agent scoring samples threshold touches once per 15-minute check, with empty extremes, on every agent path (0B §3-B4). A replay built from candle highs and lows would disagree with the points the battle banked (§9 display agreement).
- **Exact or rebuilt.** Sold stocks are quoted every check while on the bench, but nothing is stored (0B §3-B4). Until handback C-4 lands, the replay reads 5-minute candle prices at check times and is labeled "rebuilt."
- **The bought stock's basis** is on the portfolio slot, not the trade. The tape needs a trade-to-slot join that no surface has today (0B §3-F1).
- **Holding period** comes from the learning receipt, because the trade record loses the outgoing position's entry time (0B §3-B2).
- **Two decisions per swap.** The exit and the pick each get a read. The pick is compared with the bench as captured at swap time (handback C-2). Until then, the comparison is labeled "against the bench as rebuilt," or omitted.
- **Protective exits show both sides** in a protection record, only on checks known to be armed (§4.3).
- **One step; the v1 horizon is the day's close.** The words are "saved" and "cost," never "mistake."

### 4.3 Who made the exit

Nine exit reasons exist at HEAD, produced by six call sites (0B §3-B1). Every trade also carries a `source` (`risk_manager`, `archetype`, `haiku`, `guardrail`, `gameplan_meeting`).

| Exit reason | Mechanism | Judged on character? | Where a takeaway lands |
|---|---|---|---|
| `bust_avoidance`, `vwap_failure`, `stepped_trail` | Platform risk manager on an archetype-blind preset — every battle runs `balanced` (0A Q3.5) | No — fired as designed, plus the protection record | Platform |
| `stagnation` | Forced rotation, an archetype knob, disabled only for the Capital Preserver (0A Q3.1) | No — a mechanical dial | Archetype tuning |
| `guardrail_stopLoss`, `guardrail_trailingStop`, `guardrail_profitTarget` | Guardrails frozen on the battle at deploy (user or agent configuration) | No — they did what was set | The configuration that set them |
| `gameplan_rotation` | An approved gameplan meeting | Not on character alone — agent proposal plus player approval | Replayed on its merits (R4). Unproduced at HEAD, because the approval card is unmounted (handback G-2) |
| `haiku_decision` | The model's own swap | The pick only (R16) | That agent, through a menu move |

**The pick on forced exits isn't the agent's.** One picker serves every path. It filters held symbols, cooldowns and asset type, then ranks by today's percent change. The stagnation path adds the archetype's hurdle floor; emergency and guardrail exits pass no quality check (0B §3-B3). Only `haiku_decision` picks are graded as selection.

**Armed state (R14, handback C-1).** For none of the six mechanisms can "was this armed at 11:35?" be answered from stored data (0B §3-C1). Two facts shape the verdicts:
- The VWAP-failure line and the stepped trail disarm when the day's intraday session isn't usable, and the VWAP streak is zeroed rather than paused. Bust avoidance, stagnation and the guardrails don't read intraday data.
- Guardrails are evaluated only on checks where the trigger gate opens; on a quiet check they aren't evaluated at all (handback G-1, pending confirmation of the R11 pass).

Once C-1 lands, a mechanism verdict is one of four states: **fired · evaluated and held · not evaluated · disarmed**. The protection record accrues only on "evaluated and held." Until then, the Film Room reports fired exits as facts, makes no "held" or "protected" claim, and says that armed state wasn't recorded.

**Leans cannot move mechanical exits** (Forge Record Phase 0). A patience trial measured against stall rotations would falsely read "contradicted." **The tautology trap** (taxonomy §1.12.3) rules out crediting an archetype when a guard fires.

**Copy.** Say "your agent's trading brain doesn't read 10-minute charts yet," never "the platform can't see intraday." The risk manager reads 5-minute data whenever the session is usable.

### 4.4 Called shots (R15, provisional)

At HEAD a plan stores a structured `symbol` and `direction` and a free-text `threshold` sentence, with no operator, value or expiry (0B §3-D3). v1 shows each plan beside the price path of its symbol, with no verdict.

The source is the tick-stamp copy of anticipation entries (`tickStamps.js:275-289`), which doesn't depend on grounding mode. The chat record is not used, because its grounded path drops the threshold. Verdicts wait on handback C-6.

### 4.5 The player's call

- **The directive card** renders `battle.directive` — canonical text, adjustment id, canonical-text version and thread — with its heard stamp and what followed ("heard on the next check, then seven holds"). Per R4, the requested action is replayed on its merits. The Command Center chat confirms field meanings before the spec, and the card also waits on the directive-gate discovery (what was asked versus what was filed).
- **Gameplan meetings** would render approvals and expiries, but no meeting can be approved at HEAD (handback G-2).
- **Co-pilot proposals** auto-execute on expiry by design, but the autopilot launch guard blocks that today (handback G-5). The Film Room must never render an auto-executed proposal as the player's call.

### 4.6 One score, shown as a bridge (R11)

- **Headline:** the cumulative score at the day's close, `currentScore = activeScore + bankedScore + bankedBadgePoints`, with the day's change beside it.
- **Bridge terms:** held positions (including badges earned that day on held names), sales banked, and badges carried from earlier days. The day's `dailyScores` badge figure is already inside the held-positions term, so it never appears as a separate addend. Sep 14, day 1: 331 − 206 + 0 = 125. The "155" candidate double counts (0B §3-A1; handback §2).
- **Outcome:** decided by `resolveCompletionDisposition`, badges included, and not persisted today. The per-day snapshot and a stored result are handback C-5.
- **Battles before the snapshot exists** have only their final score stored. Their earlier days show sale facts, labeled, with no day-close headline.

## 5. Judgment by archetype (R16, provisional)

**What reaches the trading brain at HEAD (0A Q5):**

| Identity content | Reaches | Status for grading |
|---|---|---|
| Rotation, entry floor, swap cap, candidate sorting, model temperature | Deterministic config | Config-enforced → fired as designed only |
| Edge, evidence priority, error preference, the "Never" list, holding philosophy | The eval identity block, in every swap decision | Prompt-supplied |
| Shortlist constraint sentences | Deploy-time prompts only | Relevant to deploy-time picks only |
| The four zones and the hand-off model | Chat only | Absent from decisions |
| Stop width, cut speed, trail | Archetype-blind (`balanced` for all six) | Not archetype-specific |
| The selected directive | The eval prompt, as canonical text | Player influence (§4.5) |

**Why holds and exits are out of scope for v1:**
- Held positions receive no trend, relative strength, RSI, MACD or volume in the eval prompt, while holding rules reference exactly those (0B §3-D1).
- Stops are identical across archetypes.
- Every identity block carries a precedence clause that the code documents as false while equipped-rule precedence is dark (0A Q4.3).
- The DR-13 harness compared decisions and symbols only, so it cannot evidence in-character behavior (0A §5).

**The pick, which is in scope.** For `haiku_decision` swap-ins, check identity clauses that name data present in the bought stock's recorded snapshot — for example, the Capital Preserver's volatility clause or the Trend Follower's strength clause. These facts are labeled "recorded at decision time," and the spec confirms data presence clause by clause. Case copy states "in or out of character on [clause]." "Miss" exists only as a notebook count (Charter M3).

**Exclusions:**
- A decision shaped by an equipped rule that displaced an archetype default is attributed to the equipped rule, not to character.
- v1 covers mid-battle swaps. Deploy-time picks are judged against constraint sentences only if a later spec adds a deploy tape.
- A clause that names data no decision path supplies — for example "low-beta required" — is never graded; it is a platform finding (handback §6).

**Holding and exit character** stays a platform-findings stream until held positions receive the data their holding rules reference.

**Formalization (R7).**
- Formalization starts from the constitutions, which are current. The June definitions are not a reliable description of what any model is told (0A §5).
- `noise_discounted` is ratified and unbuilt, so the Capital Preserver's noise-versus-damage line has no machine-readable threshold yet (0A Q8.5).
- Sol's split-leg misreading still shows why prose is not a grading standard.

## 6. The two windows and the leg record

### 6.1 Daily window

Indicators and daily levels, from the daily technical documents and rankings. In the eval prompt, held positions receive only a subset; bench candidates receive the full stack (0B §3-D1).

### 6.2 10-minute window

Built from 5-minute candles. A 10-minute candle counts as closed only once its second 5-minute candle has closed.

| Job | What it covers | In v1 | Needs |
|---|---|---|---|
| Levels | Moving averages; the session's opening price | Yes | Earlier sessions' candles, so averages are warm at the open |
| Participation | Volume anomalies | Yes | A same-time-of-day baseline from earlier sessions |
| Comparison | Relative strength vs. the leading index and the sector ETF | Yes | Candles for those ETFs, fetched at review time |
| Comparison | Relative strength vs. the industry/group leader | Later | The industry layer is implemented (0B §3-F3); whether it identifies a leader for a comparison line is a spec question |
| Shapes | Breakout above the session's opening price | Yes | Nothing new — a level plus a close through it |
| Shapes | Sharp reversal and other named shapes | One at a time, once defined | Founder definitions, with volume anomalies anchoring where a shape starts and ends |

**Data facts (0B §3-E1, §3-E2):**
- **The fetcher.** There is one generic fetcher: one GET per symbol, no cache, concurrency 5, no retry. Today it serves held stocks only; sold stocks, bench stocks and ETFs need a new caller, not new code.
- **Sessions per request.** How many prior sessions one request returns is the provider's default: 82 sessions measured in May, unconfirmed at HEAD (Probe 3).
- **Extended hours.** Extended-hours bars are neither requested nor filtered at fetch; the regular-hours clamp is opt-in (Probe 5).
- **Nothing is stored.** No intraday series is stored for any symbol, so sector and index intraday lines are fetched at review time.
- **Sector ETFs.** Key off `TICKER_TO_SECTOR[symbol]`, never the stored sector string, which is free text that can come from the fundamentals provider.

### 6.3 Rules for both windows

- **Close basis per window.** This extends taxonomy §1.1.5 ("a close below a key level matters; a mid-day break does not"): a 10-minute level breaks on a 10-minute close, and a daily level on the daily close.
- **Levels before patterns** and **point-in-time** (R10), on one price basis.
- **Confluence.** Key levels on both windows that coincide mark the range or price to monitor.
- **The exit-timing fact.** One of: sold before a level broke on a close · sold after a confirmed break · held through a confirmed break.
- **Holds get a two-sided record.** Cost when a held name kept falling; saved when it recovered. Every hold verdict carries its horizon, and holds are also shown as restraint relative to other archetypes (taxonomy §1.9.2). Under R16, this is a fact layer, not a character verdict.

### 6.4 Who each window can grade

- **Daily:** picks, where a clause is prompt-supplied and its data was recorded (§5).
- **10-minute:** the player's layer plus platform evidence. Beyond session VWAP for held stocks, the trading brain receives no intraday indicator (0B §3-D1).
- **Two layouts:** a held-position card shows what the stamps prove was rendered; a bench-candidate card shows technicals recorded at decision time.

### 6.5 One engine and the tallies

**One level engine** serves both the exit-timing fact (Part 1) and tomorrow's card (Part 2).

**Tallies.** Per player, the leg record is a journal: personal and non-binding. Pooled across all agents of an archetype, with the player's influence separated out, it becomes archetype evidence once the directive-gate discovery allows that separation (§7.2). Each added window, measure or regime multiplies the tallies that must fill, which is why v1 stays narrow.

### 6.6 For the R7 session

- **Start from the constitutions**, which are current and locked to the live identity block.
- **A machine-readable threshold** for the Capital Preserver's noise-versus-damage line (`noise_discounted`).
- **Explicit founder calibration** for the Capital Preserver and the Diversifier.
- **Provenance tags** on every output; the 10-minute vocabulary is a momentum swing trader's.
- **Levels and averages:** which daily levels count toward confluence, and which moving averages apply on the 10-minute window.
- **Relative strength:** the index for the micro comparison line (starting from taxonomy §1.3.1), and its reference point.
- **Definitions:** what counts as a volume anomaly, confluence tolerance (ATR-relative), what counts as a break, and named shapes, starting with the sharp reversal.
- **Regular hours versus extended hours.**
- **How each archetype weighs each window.**
- **The pick clauses per archetype** (§5).

## 7. Where takeaways attach

### 7.1 The address rule

A takeaway must point at a move on its archetype's adjustment menu or at a setting on an equipped rule; without an address, it never reaches the agent.

A menu-move takeaway pins both `adjustmentId` and `canonicalTextVersion`, and a version bump invalidates it until re-confirmed (0A §5). With an address, it attaches to that archetype on the player's agent and stays with the archetype across switches.

### 7.2 Shelves

| Shelf | Applies to | Holds | Can change | Bar |
|---|---|---|---|---|
| The agent's archetype | One agent, in one archetype | Lessons on its own menu moves | That archetype's settings on that agent | Its own episodes, then a trial with one-tap rollback |
| The archetype | Every agent of that archetype | Which legs tell the truth; handling by regime | Calibration only, never identity | Cross-player, regime-robust evidence; public patch notes |
| The platform | All six | Guardrails, the replacement picker, signals the agent can't observe, data defects | Platform fixes | Founder |

The player's journal sits beside the shelves. **The archetype shelf is gated on the directive-gate discovery**, because pooled evidence must separate the player's influence.

### 7.3 Across archetypes

Facts and questions cross archetypes; behavior never does. There are 46 menu moves in all, counted 8/8/7/8/7/8 (0A Q3.4), and every one reinforces its archetype or is neutral by construction (0A Q7.2). The menus show where a question is worth carrying: identical moves, family moves, and unique moves that stay home.

### 7.4 Nominations and caps

- **Who nominates.** Computation nominates a move when the evidence clears the bar. The player consents, or has opted into automatic trials (off by default). Nothing is agent-originated.
- **Rule compatibility.** Rule-setting takeaways inherit the live legacy compatibility matrix at equip (`native` / `neutral` / `core_conflict`, in enforce mode). The candidate matrix, with `tension`, is dark and has no Diversifier cells (0A Q8). Leans are not compatibility-gated.
- **Caps.** One or two open questions per archetype, and one trial per archetype at a time.

### 7.5 Statuses

One vocabulary: the Charter's three tiers (Hunch · Testable · Trial-proven), plus Forge Record V1.1's "On trial" and Sol's Contradicted and Retired. Evidence accrues at episode grain (Charter M1).

## 8. Tomorrow's card

- **Authored by the player (R5)** from the archetype's computed scouting board, with computed confluence zones offered as facts.
- **Two paths, one resolution.** A casual player picks names and accepts a computed zone; an experienced player sets their own levels. Skipping costs nothing.
- **Two battle shapes (0B §3-D2).** Before a new deploy, the card can be equipped and frozen in. Inside a running battle, equip and unequip return 409, so the card resolves on its levels only.
- **What the agent receives when equipped.**
  - The deploy-time Sonnet prompt gets the watchlist name, tickers and thesis.
  - The deploy-time Haiku prompt gets tickers only.
  - Mid-battle, equipped tickers appear as ordinary bench rows with no marker.
  - The thesis is not snapshotted, and off-universe tickers can't be swapped in.

  So the agent line says only whether the name was on the agent's bench and what it did — never "your pick," and never that the agent saw a level.
- **Resolved before the next review opens.**
- **The group step is supported:** the industry layer is implemented (0B §3-F3).
- **Overlaps Scouting Assignments V2.**

## 9. Return

Closure is the hook: the previous sealed card resolves before anything else. Precedents give the review a history, and the session has a finish line. Per R6: no XP, no streaks, no rewards for volume or agreement.

## 10. Honesty constraints carried forward

- **Heard/saw vocabulary only.** The agent decides; the player influences.
- **No agent narration in v1.** The review chat is never grounded as built: grounding requires battle mode, and the Film Room sends review mode (0B §3-F1). The current debrief hero and review chat are both ungrounded, and the new Film Room omits them in v1. Any later narration needs a review-mode grounding path (handback C-7).
- **No overreach in verdicts.** No market-alpha claims from personal history; protective exits are never judged on average regret; replay points reconcile with banked points (§4.2).
- **Labels:** "rebuilt," "estimated," "against the bench as rebuilt," "armed state not recorded," "recorded at decision time."
- **Nothing implies the agent received** a card, name, level, condition or indicator it didn't.

## 11. Tape sources and hosting

**Sources**

| Need | Source |
|---|---|
| Swaps, exit reason, source, sold stock's numbers | `trades[]` |
| Holding period, entry ATR, threshold history, decision provenance | L1 learning receipts (live, create-only) |
| What the model was shown for held positions; anticipation structure | Tick stamps on evaluation entries |
| The bought stock's basis | Portfolio slot, via a trade-to-slot join |
| Score terms | `scoreState`; the per-day snapshot and outcome after C-5 |
| Prices after a sale; sector and index lines | Fetched candles (C-4 for an exact post-sale path) |
| Sector mapping; industry rollup | `TICKER_TO_SECTOR`; the industry layer |
| Scoring math | `calculateAssetScoreServer` |
| The directive | `battle.directive`, plus stamps |

**Retired as sources:** `dailyReviews[].counterfactuals`, which covers vetoed buys only and has no live reader, and `counterfactualPoints`, which is read but has no writer. The tape's replay replaces both, and every surface binds to it.

**Hosting (0B §3-E3).** Cron slots are at 39 of 40, so the tape rides an existing cron:
- **`agent-batch-review` is too tight.** It is the semantically right host, but its budget is too small: a 60-second ceiling with a 45-second soft deadline, which covers about one or two battles per firing.
- **Recommended: a rider on `agent-daily-scores` (20:45 ET).** It already loops battles and market data, and it is the job whose active-only query causes the final-day hole. It declares no `maxDuration`, so its wall time is measured first (Probe 6).
- **Fallback for late candles.** If candles aren't retrievable by 20:45 ET (Probe 3), candle-dependent work drains on a later rider; `process-pending-reflections` is the documented pattern.
- **Rider ingredients:** a flag gate, an ET-hour guard, a remaining-budget floor, an isolating try/catch, and a queue flag so work drains across runs.

## 12. Asks of other chats

Every ask, bug and identity finding is in `FILM_ROOM_PHASE0_HANDBACK_TO_COMMAND_CENTER_20260915.md`:
- **Captures and changes:** C-1 armed state; C-2 bench at swap time; C-3 risk boundaries; C-4 post-sale prices; C-5 score source; C-6 structured plan conditions; C-8 writer retirement. C-7 (review-mode grounding) is noted, not requested.
- **Bugs:** gameplay G-1 to G-7; display and honesty H-1 to H-7; hygiene Y-1 to Y-7.
- **Identity findings** for Ask 2 and the spine thread.

**Ownership** is unchanged from V1.2 §12:
- the Command Center arc owns the fence, the eval cron, tick stamps, the directive transaction and grounding;
- the Forge Record stream owns the Ledger, nominations and D-i;
- the Harness/spine thread owns identity in decision prompts;
- Scouting Assignments V2 shares the scouting board.

## 13. Open probes and queries (founder)

| Item | Purpose |
|---|---|
| 0B Query 1 | Confirm the Sep 14 arithmetic |
| 0B Query 2 | How often the final-day hole fires |
| 0B Probe 3 | When a session's candles become retrievable after the close (decides replay timing); also answers Probe 5 |
| 0B Probe 4 | Whether explicit windows retrieve past sessions |
| 0B Probe 6 | `agent-daily-scores` wall time |
| 0A Q-A, Q-B, Q-C | Active identity version; battles by preset; guardian exit mix |

## 14. Next steps

1. Commit V1.2 (as history), V1.3 and the handback note to `docs/`.
2. Send the handback note and both Phase 0 reports to the Command Center chat.
3. Run the §13 probes and queries.
4. Run the R7 formalization session, starting from the constitutions. It can start now.
5. After the Command Center chat replies: spec V1 → Sol blind review → Command Center chat → build, dark behind flags. The build order gets a usable v1 to the founder early, with R15 and R16 as separable layers.

## 15. Considered and not adopted

- Agent-authored tomorrow card — deferred for v1 scope (R5).
- XP and streaks for reviewing (R6).
- Agent-originated tuning proposals.
- Hourly and 4-hour windows in v1.
- 5-minute candles as the player's micro window.
- RSI and MACD on the micro window.
- Computing the tape only for reviewed battles.
- Agent narration in v1, labeled or not.
- Per-case "miss" or "mistake" labels.
- Letter grades.
- Cross-archetype behavior transfer.
- The "155" score definition, which double counts.
- Called-shot verdicts from free-text thresholds.
- Character verdicts on holds and exits in v1.
- "Held" or "protected" claims without recorded armed state.
- Replays or threshold touches from candle highs and lows.
- Widening the fenced trade record when receipts suffice.
- Grading the agent against data it does not receive.

## 16. Fable review

Dispositions are recorded in V1.2 §15 and still hold, with these Phase 0 updates:
- B1's three-state verdict becomes four states, pending C-1.
- B10's grounding condition is replaced by "no narration," because review mode is never grounded as built.
- A.2.4's gameplan row now uses `gameplan_rotation`.
- B9's bench label is superseded by C-2 once it lands.
- B5's clause classification is now answered by 0A Q5 (§5).
