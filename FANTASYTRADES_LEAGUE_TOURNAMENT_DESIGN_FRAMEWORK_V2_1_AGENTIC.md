# FantasyTrades — League Tournament: Design Framework (V2.1, Agentic)

**Date:** June 10, 2026
**Status:** **Design-complete for V1, end to end.** Supersedes V2.0 (same day) — the only substantive change is §2, rewritten from a single shared group pool to the confirmed **dual-market ownership model**, with knock-on edits in §§1, 3, 5, 8, 9, 12, 13. V2.0's relationship to V1.2 carries: the **atomic unit, draft, and in-week mechanics** replace old §§1–2, 5; the V1.2 **meta layer** (bracket, round flow, retention, leaderboard, rank, spectator hierarchy) carries forward with the deltas in §9.
**Audit grounding:** validated against the read-only discovery audit of `fashraf94/TradeSeven` @ `e3b4011` (June 10, 2026).

---

## How to use this document

Design/framework, **not an implementation spec**. The implementation chat:

1. Reads this + the June 10 audit findings, then runs its **own read-only discovery** (cite `file:line`, report branch/HEAD) scoped to the follow-up questions in §12.
2. **Hard STOPs** after discovery for founder review.
3. Phased implementation — one branch per task, explicit `git checkout` + branch-confirmation guard in every prompt.

**Governing contract:** `FANTASYTRADES_PRELAUNCH_SEQUENCE.md`. This work activates only after current pre-launch work resolves. The code is parallel/non-competing with the pre-launch critical path **except** the engine parameterization (§7), which touches fenced files and carries its own re-validation cycle — sequence it deliberately.

---

## 1. The atomic unit — parallel-layer battle — LOCKED

One tournament battle per player per trading day, composed of **two layers running in parallel systems**, scored together:

- **User layer (3 stocks):** lives in a drafts-shaped **group document** (4 players), moved only by the player via overnight claims and in-battle direction flips. The agent can never touch it.
- **Agent layer (6 stocks):** a standard `agentBattles` document running the existing engine in a new **flat-6 mode** (§7), managed autonomously by the agent. The player can never directly move it — influence flows through Forge rules, presets, debates, and (eventually) Voice Layer.
- **Battle score** = agent-battle score + (user-layer score × **k**), where k is an aggregation-level weighting scalar (tuning ledger, §13). **Weekly score** = sum of the round's daily battle scores (the snake draft's daily-close aggregation pattern).
- **Scoring is flat (1x) in both layers.** No tiers in tournament mode. Threshold events (Bagger badges) remain — they are tier-independent ATR mechanics.
- **The double-down:** the same symbol may be held in a player's user layer AND their own agent layer simultaneously. Because the layers are separate documents in separate markets with separate scoring pipelines, this requires **zero** duplicate-state handling — the audit's P1 NO-GO applied only to duplicates inside one portfolio document, which this architecture never creates. The double-down is the game's only leverage mechanic: conviction earns 2x exposure through alignment, not slot assignment.
- **Within-agent duplicates remain forbidden** (audit P1: symbol-keyed threshold/risk state inside one battle doc). An agent doubling itself on one name is a post-launch unlock priced at the P1 surgery bill.
- **Overlap bound:** under the dual-market model (§2), any symbol has at most **two holders per group** — one user, one agent. Same player = double-down; different players = cross-layer overlap (head-to-heads, rival shadowing). In-group convergence is bounded, not eliminated.

**Rationale trail:** the merged 9-stock single-doc design was killed by audit P1 (duplicate-unsafe subsystems), P4 (three removal paths bypass the swap validator, so position locks can't be enforced at one chokepoint), and the deploy validator's explicit duplicate rejection. The parallel architecture dissolves all three problems instead of fixing them.

## 2. Ownership & exclusivity — dual markets — LOCKED

The two layers shop **two independent markets**. There are no cross-market checks, ever, and the drafts do not subtract from each other's boards.

**The user market.**
- 4 users × 3 picks = 12 names, **exclusive among the users**.
- **User pool** = the user draftable universe minus user-held names. Drops (via claims) return here.
- Moved only by claims: placed while the market is closed, executed ~5 minutes before open, contested claims resolved by the existing waiver-priority machinery, pending-claim cap inherited (tuning).
- **Self-contained in the group document** — structurally the existing snake draft model (picks + pool + claims + priority), reconfigured to 3 picks with the category system simplified out. Claim validation never reads agent state.
- **The user draftable universe is sized independently** of the agent's — a contention dial. Full universe ≈ 218 available names means snipes are rare; a curated 60–80-name board makes the wire contested. Launch value is a tuning decision (§13).

**The agent market.**
- 4 agents × 6 picks = 24 names, **exclusive among the agents**.
- **Agent pool** = the agent universe (the ranked ~230) minus agent-held names. Drops (swaps, risk exits, rotations) return here.
- Agents acquire **intraday, immediately**, through normal swap behavior. Enforcement rides the codebase's own uniqueness pattern: **candidate pools, not executors** — hotBench/bench/replacement-candidate construction (non-fenced eval-cron code) filters to pool-available names, plus a transactional check-and-claim on the **agent held-set ledger** wrapping execution. The enabling audit fact: **all `executeSwapServer` call sites live in non-fenced `agent-evaluate.js`**, so acquisition and release bookkeeping wraps every path — including risk exits and gameplan rotations — without fence contact. Agent candidate filtering never reads user state.

**Properties of the split.**
- **The slow clock is protected:** users compete only with users. A claim target can only be sniped by another human on the same overnight clock — never by an agent at 2:15pm. (This is the decisive flaw of the rejected shared-pool model: agents would perpetually front-run the user wire.)
- **Max two holders per symbol per group** (one user + one agent). Within-player = double-down; cross-player = a live cross-layer overlap — and with V1 user shorts, a **human-vs-rival-agent directional duel** is possible at launch.
- **No special-casing for the double-down:** your agent can draft or swap into your user pick because the markets are independent, not via exception logic.
- **Two trivial single-layer ledgers** replace the V2.0 cross-layer registry: the user market's state is the group doc itself; the agent market needs only a lightweight transactional held-set.

## 3. User layer — draft, claims, flips, shorts — LOCKED

**Draft.** 4-player lobby, snake order, 3 picks each = 12 user-market-exclusive names. **All picks start long.** Pre-committed draft boards handle absentees (V1.2 §2 mechanics carry: watchlist-creation assembly bones, ranking/tiering step, minimum-depth rule). The draft is the human-skill ritual of the week — "most users know at least 3 stocks" is the casual-depth thesis.

**Claims (identity changes — slow).** Per §2's user market: overnight placement, pre-open execution, waiver priority, capped. A successful claim drops the outgoing pick to the user pool.

**Flips (stance changes — fast).** A button in the battle view flips a held user pick long↔short, anytime.
- **Leg model (non-negotiable):** a flip banks the current leg's score at the flip price and opens a new leg scoring from that price. Score = closed legs + live leg. Retroactive inversion is forbidden — it converts losses to gains.
- **Thresholds per leg**, reset at flip (a flip is economically a new position).
- **Baseline rule:** current price if market open; next open otherwise.
- **Cap:** ~5 flips/day placeholder (tuning ledger). Launch capped — loosening later is a gift, tightening later is a nerf.
- **Flips are public feed events** (open-cards transparency) — the public mid-week reversal is a designed spectator beat and a Voice Layer conversation trigger.

**Shorts — staged.** V1: **user layer only.** Agents are long-only at launch. Every new schema (picks, legs, claims, pool entries, aggregation rows) carries `direction` from day one. The short-scoring math precedent exists (March 2026: `calculateAssetScoreV3` direction negation, threshold-path inversion, SHORT badge); the server scorer's direction handling is verified/extended during the §7 engine work while those files are open. **Agent shorting is the designed post-launch unlock** (§11) — expressed through the existing six archetypes (the Archetype Identity Contract stays at six; no short-heavy seventh at V1).

**Design principle (spec language):** *identity changes are slow, stance changes are fast.* What you hold moves overnight through claims; what you believe about it moves at a button press.

## 4. Agent layer — standing deployment over daily-chained battles — LOCKED

- **Daily-chained battles (Fork B1):** a tournament "week" = five single-day agent battles — the format that exists, is calibrated, and runs today. No multi-day engine mode is enabled (audit: `fullday` is hardwired; the legacy multi-day path is fenced and carries the baseline-reset hazards).
- **Standing deployment:** the user deploys once at registration; a **Tournament Orchestrator** (new, non-fenced cron) invokes the deploy endpoint each morning for every registered player with their current loadout. The user never sees a deploy button after registration. *The agent reports for duty every morning with the loadout you've equipped.*
- **Incumbent seeding:** Tue–Fri morning deploys re-instantiate the prior day's closing six. **No rotation at deploy** — all agent changes happen intraday via market-enforced swaps. (Lean-locked: rotation-at-deploy would force pool filtering into the fenced deploy pipeline for a behavior the agent can express at open anyway. Revisit post-launch.)
- **Nightly management window:** while the market is closed, the player manages both layers in one surface — claims for their three, loadout edits (archetype/traits/watchlist/rules) for their agent. **The loadout window is nightly, not weekly** — a deliberate unlock of V1.2 §3's round-boundary lock. Trade accepted: nightly archetype-hopping is a watch-not-prevent behavior. Strategy presets and debates remain live in-battle as today.
- **Thresholds/badges reset daily** with each fresh battle: daily threshold races, weekly sums.
- **Agent context:** the deploy prompt carries a **USER PICKS block** (own player's symbols + current direction) via the precedented Phase 5B1 injection pattern, so the agent can knowingly double down, abstain, or narrate disagreement. (V1 conviction flow is "the agent sees your picks"; the Voice-Layer-derived conviction pipeline is the bookmarked voiceLayerCache integration — a deepening, not a launch dependency.)
- **Mid-week human levers (V1, mechanically real):** Forge rules (nightly window), strategy presets (live), debates (live), flips and claims (own layer). Spec must not promise Voice Layer→Trading Brain coupling beyond these.

## 5. The Monday draft show — agent board draft — LOCKED

Runs **immediately after the user draft completes**, lasts **under 5 minutes**, watched in **spectator mode**, fully **async-replayable** (VOD-native — a player arriving later watches the identical draft).

- **Sequencing:** user draft → agents deploy **with their own player's picks in context** → agent draft resolves → playback. The agent visibly reacting to its human's draft is real adaptation, not scripted.
- **Pre-committed agent boards:** at deploy, each agent produces a **ranked board** of ~15–20 candidates (the Sonnet strategy pass already emits a 20–40 ticker shortlist — the board is a ranking ask, not new machinery). One model call per agent, the existing single-pass shape.
- **Deterministic resolution:** snake order across the 4 agents, 6 rounds; each turn takes that agent's highest-ranked still-available name. Per-agent availability = the agent pool minus prior agent picks. **User-drafted names are not subtracted** — an agent drafting its own player's pick is the draft-night double-down beat; a rival agent taking your name is the shadow storyline. Resolution computes server-side in milliseconds — nothing can time out or fail mid-show.
- **Playback:** the spectator surface replays resolution on a **~5-second-per-pick clock** (tuning). Sniped agents visibly shift to their next-ranked name — real, watchable adaptation at zero marginal cost.
- **Board exhaustion fallback:** next name by archetype ranking (the deterministic deploy fallback pattern).
- **Symmetry (spec language):** *humans pre-commit boards because they can't always be online; agents pre-commit boards because model calls can't run on five-second clocks.*
- **Post-launch upgrade path (designed, not built):** live per-pick calls with the board as fallback — the agentic roadmap's own Phase 4 shape. Drama mechanics (selection constraints fed to deploy context vs. pure presentation staging; round restrictions; self-duplication pending P1 surgery) are post-launch levers; V1 ships functionality and smoothness.

**Tue–Fri lineup cards:** the daily small-format beat — the morning card shows incumbents; the day's story is the live diff (swaps, flips, double-downs) as it happens. One big show, four daily pulses.

## 6. Scoring & aggregation — LOCKED

- **Per-battle composite:** agent-battle score (flat-6 mode) + k × user-layer score. The user-layer scorer is **new, non-fenced code**: leg-based, direction-aware, flat 1x, per-leg ATR thresholds — built to the same math contract as the engine scorer (the byte-identical-port discipline applies; it may *call* fenced scoring functions read-only rather than re-deriving them — discovery item).
- **Weekly/round score:** sum of the five daily composites.
- **All V1.2 aggregation properties carry:** signed cumulative seasonal leaderboard (negative scores kept, monthly reset, CPUs inline and marked, bottom-of-board as learning surface), career rank (RP from total scoring + placement bonuses 100/66/33, CPU-farm guard, tier-floor ratchet, no debt), all battles feed the leaderboard, bracket and base layer identical format. **One format everywhere** — bracket and base-layer weekly battles are this same parallel-layer battle, so the leaderboard sums one point economy.

## 7. Engine work — A2 as parameterization — LOCKED

The agent engine gains a **mode config**; it is not rewritten.

- **Two modes:** `tiered` (existing 2/2/3 + crypto, multipliers 2/1.5/1 — the live BaggerBomb agent game, untouched in behavior) and `flat6` (tournament: 6 stocks, no crypto, all 1x).
- **Governing invariant:** **tiered-mode behavior is byte-identical before and after the change.** The existing game's calibration remains valid by construction (consistency test proves it); only `flat6` requires fresh Gate-1 archetype-differentiation calibration.
- **Scope (from the audit's fence-contact register):** `validatePortfolio` / `enrichPortfolio` / `buildFallbackPortfolio` (decide.js), `createAgentBattle` shape + the resurrection of the dead `scoring.tierMultipliers/pointValues` doc config as the live mode config, scoring constants/`flattenPortfolioServer`/`calculateAssetScoreServer` (agentScoring.js), prompt text (GAME/TIER RULES blocks), `PORTFOLIO_TOOL` schema counts, eval-prompt tier framing, hftConfig mode-awareness, client mirrors and UI tier assumptions.
- **Riders while the hood is open:** collapse the three multiplier copies (server / client mirror / v4 daily-scores cron) to one source; verify/extend the server scorer's `direction` handling against the March 2026 client precedent.
- **Crypto:** tournament mode is stocks-only. The mandatory crypto slots are a tiered-mode property, not carried into `flat6`.
- This is fenced work with full re-validation: the heaviest single line in the build, and the reason this program sequences after the pre-launch contract resolves.

## 8. New infrastructure inventory (all non-fenced unless noted)

1. **Market ledgers (§2)** — the user market is self-contained in the group doc (the existing drafts model, reconfigured); the agent market needs a lightweight **transactional agent held-set ledger** written by draft resolution and every swap (both directions), read by candidate filtering and the draft boards.
2. **Tournament Orchestrator** — morning deploy fan-out (batched/staggered; 16 sequential 60s deploys exceed one invocation), Monday draft resolution, round advancement, champion conclusion. Needs a cron home.
3. **User-layer service** — group doc (3-pick variant of the drafts shape), pick/leg/flip model, flip endpoint + cap, leg-based direction-aware scorer, claim adaptation (user-pool-sourced validation replacing category pools; category system simplified out).
4. **Aggregation layer** — daily composite, weekly totals, seasonal leaderboard, RP/rank writes, learning-feed jobs (consensus population-level, contrarian cut).
5. **Draft playback surface** — resolution-event stream + 5s-clock spectator replay, VOD-native.
6. **Two-layer battle view composition** — user strip (with direction/flip affordance + SHORT badging per existing precedent) + agent battle view + composite score header; double-down visual moment; cross-layer duel surfacing; flip feed events.
7. **Claim-execution adaptation** — user-pool-sourced, group-doc-targeted variant of the claims cron (the existing cron is hard-bound to the legacy drafts shape).

## 9. Meta layer — carried from V1.2 with deltas

Carried intact: §1 skeleton (16 slots, three knockout rounds, final four, monthly cadence, CPU padding), §3 round-boundary flow (results-and-review → bracket reveal → loadout window → draft), §4 retention (spectate+train, cumulative leaderboard, always-on base layer), §5 base grouping (human-density packing, weekly reshuffle), §6 leaderboard metric, §7 career rank, §8 spectator hierarchy/view-mode/feeds/boards.

**Deltas:**
- The atomic unit everywhere is the parallel-layer battle (§1 here).
- §3's loadout window moves from round-boundary to **nightly** (§4 here); round boundaries retain the bigger beats (review, bracket reveal, fresh user draft).
- §8 transparency amendment (composing V1.2 open-cards with the agent-PvP asymmetry decision): **WHAT** (positions, trades, flips, scores) is visible live to opponents and spectators; **WHY** (reasoning, Forge citations, hypotheses) is owner-only while live; **full WHY unlocks at completion**, where view-mode is the Film Room. Competitive edge preserved, learning layer preserved.
- §8 feeds: in-group overlap exists but is bounded at two holders per symbol (§2), so the consensus cut aggregates **across groups at the population level**; **cross-layer duels** (a user's direction vs. a rival agent's position on the same name) are a new spectator storyline class, live at V1 via user shorts.
- "Snake Draft engine unchanged" is replaced by the §7 invariant: **tiered-mode behavior unchanged; flat6 is new and freshly calibrated.**

## 10. Known constraints & launch-shaped risks (from audit)

- **Eval-tick scaling:** the eval cron is one sequential invocation with a ~50s self-budget; 16+ concurrent tournament battles plus organic load sits in the systematic-deferral zone, degrading evaluation cadence. Architecture-shaping; mitigations (budget raise, deliberate sharding/staggering) belong to discovery + implementation design, not afterthought.
- **Cron budget:** 37 scheduled entries counted (≈3 free against the assumed Pro ceiling of 40). New needs: orchestrator, claim-execution variant, aggregation/feeds. A cron-consolidation pass may be forced; treat headroom as a design input.
- **One-active-battle-per-agent** is enforced at deploy and assumed by the hooks. Verify completed prior-day battles don't block morning creation; resolve the design conflict with "spectate + train" (an eliminated player's training battle vs. their base-layer battle) — open item, §12.
- **DST claim-execution defect (standalone pre-launch blocker, independent of this program):** the claims cron is pinned UTC; in daylight time it fires ~10:25 AM ET — nearly an hour into the session — against a window that closed at 9:24 AM ET. The shipping snake draft game is affected **today**. Goes on the pre-launch blocker list beside the DRB shadow logger.

## 11. Post-launch program (designed direction, not V1 scope)

- **Agent shorting:** regime router rerouting (distressed/downtrend → short candidates instead of exit/avoid), risk-engine directionality (stops/trails/VWAP/peak semantics inverted per position), tool-schema + prompt semantics, squeeze/crash calibration probes; expressed through the existing six archetypes. Direction-ready schemas (§3) make this an unlock, not a re-plumb.
- **Live agent draft:** per-pick calls with the V1 board as fallback; selection-constraint drama levers (round restrictions as deploy-context rules); self-duplication pending P1 surgery.
- **Within-agent double-down** (P1 surgery bill).
- Per-swap efficiency RP input; rank-as-matchmaking/MMR; training-mode evolution (parked, V1.2 §9 guardrail language carries); morning-rotation-at-deploy revisit; flip-cap/claim-cap/user-board-size retuning from live data.

## 12. Open items — tuning + discovery (not design)

**Tuning ledger (set raw, ship, watch, adjust):** user-layer weight **k**; flip cap (placeholder 5/day); claim pending-cap; **user draftable universe size** (the contention dial — full universe vs. curated board); board depth (15–20); playback pacing (~5s/pick); rank tier count/names/thresholds; score→RP scaling; CPU-farm fraction; CPU difficulty; optional per-position short floor.

**Spec-level decisions deferred to the spec pass:** pre-committed user-board prefill source under autopilot-only launch; exact nightly-window UI composition (claims + loadout as one surface); flip-event presentation; champion-recap content.

**Discovery follow-ups for the implementation chat:**
1. Agent held-set ledger transactional design: confirm Firestore transaction shape around the swap call sites in `agent-evaluate.js`; confirm hotBench/bench/replacement candidate construction can be fed pool-filtered inputs entirely from non-fenced code (incl. `pickEmergencyReplacement`, which the audit flagged as having no held-symbol exclusion). Single-layer checks only — no cross-market reads.
2. Current waiver-priority rule as built; claim-execution timing fix (DST) and its correct timezone-safe scheduling.
3. Whether the user-layer scorer can invoke fenced scoring functions read-only (preferred) vs. re-deriving math under a port-contract test.
4. Orchestrator fan-out shape vs. function limits; one-battle-per-agent interaction with morning creation; completed-battle non-blocking.
5. Eval-cron scaling mitigation options (maxDuration headroom on Pro, sharding strategy) with measured per-battle costs.
6. Mode-config plumbing: exact parameterization seam for `flat6` per the §7 scope, with the byte-identical tiered invariant test plan.

## 13. Guardrails (binding)

- **Calibration fence:** unchanged list. §7 is a deliberate, founder-gated fence entry with the byte-identical tiered invariant and fresh flat6 calibration as its re-validation contract. Nothing else in this program touches fenced files except the precedented USER PICKS prompt block and the §7 rider work.
- Discovery → hard STOP → founder review → phased implementation; one task = one branch; pushed ≠ deployed (Vercel preview smoke tests); `/code-review` at ≥10 files or ≥1500 lines.
- Sequencing: after the pre-launch sequence resolves; the DST defect (§10) jumps the queue as a standalone blocker.
- Out of scope: entry fees/payments/crypto; the Gauntlet execution layer; rank-as-matchmaking.

---

*V2.1 prepared June 10, 2026 from the June 8–10 design arc + the June 10 read-only audit @ `e3b4011`. Design-complete end to end; ready for implementation-chat discovery once sequencing permits.*
