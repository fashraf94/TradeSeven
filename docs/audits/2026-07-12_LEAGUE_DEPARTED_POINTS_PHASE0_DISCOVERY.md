# Phase 0 Discovery — Departed-Position Points → Accurate Orb → Live-Page Retirement

**Read-only discovery. HARD STOP for founder review before Phase 1.**

- **Branch:** `claude/arena-departed-points-arc-8qdljm` (cut fresh from `main`; tip == `origin/main`).
- **HEAD SHA:** `8aeb377f924ad9f2cb3ed10b6c9fc9f8645d31c0` (Merge PR #601). Clean working tree.
- **`git fetch origin` run first** (BUILD_RULES §3): `4a0f43e6..8aeb377f main` — remote-tracking now current.
- **Prereq confirmed:** PR #572 merged (`42d6d3e0`, orb work `436cda1e`). This branch is based on it.
- **Fence contact:** NONE. Fenced files (`agentSwapExecution.js`, `agentScoring.js`, `agentBattleService.js`) were **read only**, never edited. All citations below marked VERIFIED = read this session.

---

## Executive verdict table (for the founder)

| Question | Verdict | Anchor |
|---|---|---|
| **Agent swap** — are subbed-out points stored & client-readable? | **YES** — `battle.trades[i].lockedPoints` (+ `symbolOut`, `swapDay`). The `battle` prop is already in the arena. | `agentSwapExecution.js:246-264`; `buildArenaModel.js:164` |
| Agent swap — are those points in the live orb today? | **NO — dropped.** `readAgentStars` reads only the current 6 holdings (`activeScore`); the orb misses `bankedScore`. | `leagueStarMeter.js:95-115`; `flat6BattleEnrichment.js:191-202` |
| Agent swap — double-count risk if added? | **NO** (daily-chained battle doc → `trades[]` is today-only; no overlap with `priorBankedAgent`). Re-confirm on live in P2. | `leagueTournament.js:626-637`; `buildArenaModel.js:194-205` |
| Swap **chip** null? | **YES, confirmed.** `agentMove: null`. | `buildArenaModel.js:291` |
| Swap **beat** carries no number? | **PARTLY FALSE — plan≠code.** The beat DOES carry `pts: lockedPoints`; it can flash transiently as a fly-token. No *persistent* readout exists. | `leagueBeats.js:190-198`; `ClimbArena.jsx:227,238-244` |
| **User drop** — where do dropped picks + points live? | `player.droppedPicks[]` (whole pick moved there on claim-approve; live leg closed bank-pending). Client-readable (on the group doc). | `tournamentClaims.js:219-242`; `tournamentBanking.js:169,181-182` |
| User drop — are those points in the live orb today? | **NO — dropped.** `readUserStars` reads only `player.picks`; `droppedPicks` never make a star row. | `leagueStarMeter.js:174-183` |
| User drop — counted at the banked close? | **YES.** Banking sums `picks` + `droppedPicks` into `totalPoints`/`compositePoints`. This IS the settle-step-up source. | `tournamentBanking.js:180-184,284-292` |
| User drop — double-count risk if added? | **NO** — `droppedPicks` are disjoint from `player.picks`; `Σ(held)` never contains them. | `leagueStarMeter.js:174-183`; `tournamentClaims.js:231,235` |
| **Flat6 render delta** (page shows, arena doesn't) | Per-holding **$ price**, **% change**, **integer total points**. Everything else has an arena home. | `Flat6BattleView.jsx:71-79`; `StarCell.jsx:255-279` |
| **Retirement** — deletion or route-removal? | **ROUTE-REMOVAL-ONLY.** Flat6BattleView is the flag-off rollback + pre-deploy + "back-to-classic" branch in training AND ranked, AND serves spectator + dev. Deletion is OUT. | see §5 |
| **P2 RISK** — does `liveAgentScore` match the banked close exactly? | **MAYBE NOT** — close uses `currentScore = liveAgentScore + bankedBadgePoints`. Resolve in P2 (headline no-step test). | `agent-evaluate.js:674-678`; `flat6BattleEnrichment.js:202` |

---

## 1. Agent subbed-out (swap) departed positions

**Storage (VERIFIED).** A swap writes a closed-trade record onto the agent battle doc's `trades[]`:
`agentSwapExecution.js:246-264` — `{ symbolOut, symbolIn, entryPrice, exitPrice, lockedPoints: round(...), lockedGainPct, swapDay, swappedOutAt, direction, ... }`. `lockedPoints` is the realized/banked points of the position that left the board (`= calculateAssetScoreServer(...).totalPoints`, line 239-254).

**Client-readable in the arena? YES.** The `battle` doc (carrying `trades[]`) is passed straight into the arena (`buildArenaModel({ battle })` → `readAgentStars(battle, priceCtx)` at `buildArenaModel.js:164`; `buildFlat6BattleModel` reads `battle.trades` at `flat6BattleEnrichment.js:192`). No new read/projection needed.

**Already counted in the live orb? NO — this is the bug.**
- `buildFlat6BattleModel` computes two disjoint sums: `activeScore = Σ current-6-holding points` (`flat6BattleEnrichment.js:191`) and `bankedScore = Σ trades[].lockedPoints` (`:192-195`), then `liveAgentScore = round(activeScore + bankedScore)` (`:202`).
- The arena's agent term is `sumPoints(agentStars)` where `readAgentStars` iterates **only `model.slots`** (the current 6) — i.e. it equals `activeScore` and **excludes `bankedScore`** (`leagueStarMeter.js:108-115`; `buildArenaModel.js:200,204`).
- So the orb's agent half drops the swap-realized points. The Flat6 page's `liveAgentScore` includes them. **This is the §9-blocked settle-step (PR #572 Item B).**

**Double-count risk if surfaced + added: NO.** `bankedScore` (today's `trades[]`) is disjoint from `activeScore` (current holdings) and from `priorBankedAgent` (prior *days'* `closeScores.agentPoints`, `buildArenaModel.js:201-202`), because agent battle docs are **daily-chained** — `pickCurrentTournamentBattle` selects today's active/most-recent doc (`leagueTournament.js:626-637`), and the live-add is gated on `isFlat6ActivationDay(battle, now)` so a stale prior-day doc can't re-add (`buildArenaModel.js:194-199`). *Caveat to re-confirm in P2 on live data: this rests on `trades[]` being today-only, which is true iff each day gets a fresh battle doc.*

**Swap chip / beat status (plan ≠ code — flagging per spec close-out rule):**
- Swap **chip** is confirmed **null**: `buildArenaModel.js:291` `agentMove: null` ("derived from trades in a fast-follow"). The CommandDock slot for the agent's recent move is therefore empty (`CommandDock.jsx:32-34`).
- Swap **beat** DOES carry the number: `deriveBeats` emits `{ kind:'swap', text:'swapped X → Y', pts: numOrNull(t.lockedPoints), tone: toneOf(t.lockedPoints) }` (`leagueBeats.js:190-198`). If that beat is selected as the live "surge", its `pts` flashes as a transient fly-up token (`ClimbArena.jsx:227,238-244`) — one-shot, suppressed under reduced motion, **not a persistent readout**.
- **Net:** the spec's *essence* ("no readable, persistent departed-points display") holds, but "swap beats carry no number" is imprecise — the number is already in-hand at the beat layer. **This shortens the Phase 1 seam:** fill the null `agentMove` chip (CommandDock) or persist the swap beat — both already have `symbolOut` + `lockedPoints`.

## 2. User dropped picks

**Drop representation (VERIFIED).** A drop happens on claim approval (`tournamentClaims.js:219-242`): the dropped pick's live leg is closed bank-pending (`closedAt = nowIso`), then **the whole pick moves to `player.droppedPicks`** (`:231`) and its slot in `player.picks` is overwritten by the claimed-in symbol (`:235`). So after a drop the pick is **no longer in `player.picks`**; its realized value is deliberately PRESERVED in `droppedPicks` (comment `:219-225`, founder ruling #1).

**Client-readable in the arena? YES (data), NO (currently read).** `player.droppedPicks` lives on the group doc's `players[]` — the arena already receives `group`. But `readUserStars` iterates **only `player.picks`** (`leagueStarMeter.js:174-183`), so a dropped pick never produces a star row and never enters `sumPoints(userStars)`.

**Already counted at the close? YES → the settle-step source.** Banking scores `player.picks` (dropped:false) **plus** `player.droppedPicks` (dropped:true) into `playerTotal`/`totalPoints`/`compositePoints` (`tournamentBanking.js:180-184,284-292`). So the banked close counts dropped picks; the live orb (only held picks) does not. The user layer jumps up at close by `1.5 × Σ(dropped banked)`.

**Double-count risk if surfaced + added: NO.** `droppedPicks` and `picks` are disjoint arrays (the pick is *moved*, not copied — `tournamentClaims.js:231,235`), so `Σ(held live)` never contains a dropped pick. *P2 detail:* score dropped picks via `scorePick` (their `bankedScore` is set at the session-open banking pass; a just-dropped, not-yet-banked leg scores 0 until then — `tournamentUserScoring.js:150-153`).

## 3. liveAgentScore / chaining / k (feeds Phase 2)

- `liveAgentScore = round(activeScore + bankedScore)` — today's current-holdings live points **+** today's swap-realized points (`flat6BattleEnrichment.js:191-202`). Today-only (agent layer daily-chained).
- Live agent week-to-date = `priorBankedAgent + liveAgentScore_today`; `priorBankedAgent = closeScores[uid].agentPoints` (`buildArenaModel.js:201-202`).
- **Phase 2 agent-half delta:** current orb uses `activeScore` only; target uses `liveAgentScore = activeScore + bankedScore`. The delta is exactly the swap-banked points (Phase 1 makes them visible → §9 satisfied).
- `computeComposite(a, u) = a + USER_LAYER_K·u`, `USER_LAYER_K = 1.5` (`leagueTournament.js:645-647, 877`).
- Banked close is cumulative: `getWeeklyComposite` = last day's `closeScores[uid].compositePoints` (never a sum) (`leagueTournament.js:1062-1067`); `totalPoints` is the cumulative user standing incl. dropped.

## 4. Flat6 information delta

**Flat6BattleView renders** (`Flat6BattleView.jsx`): header agent name/archetype/Live-Final badge (215-231); big `displayScore` = `liveAgentScore` (235); composite-context line "week composite … user × 1.5 + agent" (243-264); double-down chip (272-277); **per-holding `HoldingRow`** (53-102) = symbol (72) · **$ price** (73) · **% change** (74-76) · **integer total points** `fmtPts(asset.points)` (77-79) · threshold progress bar (82-88) · badges (90-100); live narration feed (295-307); WHY panel — innerMonologue + eval rationale, owner-only until completion (309-337).

**Arena renders the same holdings** via `StarCell` (`StarCell.jsx:237-303`): symbol (250) · dir (251) · tier (252) · **ATR multiplier `+N.N×`** as default headline (269-274) · meter riding thresholds (281) · state caption/badge ("Hit +N", "N× to Rally") (284-294) · JUST-IN + settle tags (265,276). Orb/climb carry the composite; VoiceLane carries the feed; ask-chips carry the two-way WHY seam.

**Delta (Flat6 shows, arena does NOT):**
| Element | Flat6 | Arena | Home in arena? |
|---|---|---|---|
| Per-holding **$ current price** | `HoldingRow:73` | — (shows ×ATR) | YES — StarCell head/headline |
| Per-holding **% price change** | `HoldingRow:74-76` | — (shows ×ATR) | YES — StarCell |
| Per-holding **integer total points** | `HoldingRow:77-79` (`asset.points`) | shows `mult`; star row *carries* `points` but doesn't render it | YES — alongside multiplier (star row already has `points`) |

Everything else (agent score, composite, feed, badges, threshold progress, double-down, WHY) has an arena equivalent. *One item to confirm in P3: the WHY / "agent's read" panel — the arena's seam is the flag-gated two-way ask, not a passive reasoning panel; flag if no passive home.*

## 5. Retirement blocker — every route to Flat6BattleView

**Four call sites (VERIFIED):**
1. `LeagueTrainingBattleView.jsx:152` — **training flow**, but as the **fallback branch**: rendered when `ARENA_LIVE_ON` is false (flag-off **rollback**), OR `!myBattle` (pre-deploy/awaiting_open), OR `classic===true` (desktop "back-to-classic" via arena `onBack`, `:121`). Comments `:106-111` confirm "flag is the rollback."
2. `SpectatorView.jsx:152-158` — **spectator** surface (any owner's battle, read-only). Non-training.
3. `LeagueParticipantView.jsx:222-228` — **ranked participant** surface (battle week/bracket). Non-training.
4. `TournamentDevScreen.jsx:874-880` — **dev** screen (dev user's own battle).

**Flag-off fallback? YES.** `ARENA_LIVE_ON = LEAGUE_BATTLE_VIEW_V2_ENABLED || ?battleArenaLive=1` (`arenaLiveGate.js:20`; flag currently `true`, `featureFlags.js:190`). If the flag flips false, the training flow renders Flat6BattleView. **Deleting it destroys the rollback path.**

**Verdict: ROUTE-REMOVAL-ONLY.** Phase 3 can remove the training *entry* to Flat6 — the "back-to-classic" affordance (`LeagueTrainingBattleView.jsx:121`) — but the component MUST stay for (a) the flag-off rollback, (b) pre-deploy, (c) spectator, (d) ranked participant, (e) dev. **Deletion is ruled out** and is a separate founder call, exactly as the spec anticipates.

---

## Consolidated: departed-point sources table

| Source | file:line | Client-readable in arena? | Already in live orb? | In banked close? | Double-count if added? |
|---|---|---|---|---|---|
| Agent subbed-out `lockedPoints` | `agentSwapExecution.js:246-264` → `battle.trades[]` | **YES** (battle prop) | **NO** (readAgentStars = current 6 only) | YES (agent daily bank) | **NO** (daily doc; disjoint from priorBankedAgent) |
| Agent subbed-out symbol/day | `trades[].symbolOut / swapDay` | YES | n/a (label) | n/a | n/a |
| User dropped pick + banked | `player.droppedPicks[]` (`tournamentClaims.js:231`) | **YES** (group prop) | **NO** (readUserStars = player.picks only) | YES (`tournamentBanking.js:181-182`) | **NO** (disjoint from held) |

## Adversarial cross-check (8-agent workflow, 0 errors) — all verdicts CONFIRMED
An independent fan-out re-derived the three load-bearing conclusions and tried to refute them:
- **User-drop double-count = NO — CONFIRMED.** `readUserStars`/`buildArenaModel` read only `player.picks`; `droppedPicks` has no client live-sum consumer (grep-verified). Banking folds `picks ++ droppedPicks` into `closeScores.totalPoints` (`tournamentBanking.js:180-183,284`).
- **Agent-swap dropped-not-double-counted = CONFIRMED.** Today's `trades[].lockedPoints` are absent from `sumPoints(agentStars)` and not yet in `priorBankedAgent` (gate requires `!dayBanked`, `buildArenaModel.js:196`); they reappear as `priorBankedAgent` only the next day. Adding them to the live term fills an intraday under-count. (Caveat re-affirmed: they ARE already inside `liveAgentScore` and inside `priorBankedAgent` — so P2 must switch the *today* term, never double-add.)
- **Retirement = route-removal-only — CONFIRMED.** Adversary could not find a safe deletion.

**New routing precision from the cross-check (folds into §5):**
- The **ranked** host `LeagueParticipantView` *also* has the arena gate — `if (ARENA_LIVE_ON && myBattle && !classic)` (`:188`) — and falls through to `Flat6BattleView` at `:223`. So the arena serves ranked too, and Flat6 is its flag-off/"back-to-classic" fallback there as well (desktop toggle `:197`). Deleting Flat6 breaks the ranked rollback path, not just training's.
- The training entry route is the App `'trainingBattle'` screen: `App.jsx:9051-9061`, mounted via `onOpenTrainingPod` (`App.jsx:2262-2271`) / `?trainingBattle` deep-link (`:2248-2254`), whose back button is `onBack: setScreen('league')` (`:9057`) — **this is the "LEAGUE back-button path" the spec names.** Phase 3 must confirm the exact seam to remove (the desktop back-to-classic affordance at `LeagueTrainingBattleView.jsx:121` vs the App route) with the founder.

## ⚠ NEW Phase-2 RISK — `bankedBadgePoints` (plan-said ≠ code-did; flag per close-out rule)
The spec's target sets the agent term to `liveAgentScore`, asserting it "matches the Flat6 number and the banked close **exactly**." The Flat6 number it does match. **The banked close it may NOT**, because of a third addend the client omits:
- Persisted server score: `currentScore = activeScore + bankedScore + bankedBadgePoints` (`agent-evaluate.js:674-678`). The nightly banking reads `scoreState.currentScore` → `closeScores[uid].agentPoints` (`tournamentBanking.js:66`).
- Client `liveAgentScore = round(activeScore + bankedScore)` — **no `bankedBadgePoints`** (`flat6BattleEnrichment.js:191-202`).
- `agent-daily-scores.js` banks held-position `bonusPoints` into `scoreState.bankedBadgePoints.total` and zeroes `thresholdHistory` for **every `status=='active'` agentBattle** (`findActiveAgentBattles`, `agentBattleService.js:31-38`; bank at `agent-daily-scores.js:176`; advances `timing.currentTradingDay` `:188`) — tournament docs included.

**Consequence:** if a tournament battle ever carries non-zero `bankedBadgePoints` during live hours, then BOTH today's orb and the post-arc orb sit below the banked close by `bankedBadgePoints`, and Phase 2 acceptance test #3 ("orb → `compositePoints` with no step") would fail for the agent half unless `bankedBadgePoints` is included in the live agent term.
**Open (Phase 2 must resolve, do NOT assume):** whether tournament fullday docs are fresh-per-day (→ `bankedBadgePoints` stays 0 during that day's live hours → `liveAgentScore == currentScore`, spec holds) or persist multi-day (→ non-zero → residual step). Note the *current* Flat6 page has this same latent live-vs-final gap, so it is not introduced by the arc — but the arc's headline "no settle-step" test forces it to be resolved. Recommended P2 target if non-zero: `priorBankedAgent + activeScore + bankedScore + bankedBadgePoints` (i.e. use `scoreState.currentScore` for today's agent term, not `liveAgentScore`).

## What Phase 1 must surface (the §9 precondition)
1. Agent: subbed-out symbol + its `lockedPoints`, past-tense/settled framing (fill the null `agentMove` chip or persist the swap beat — data already in hand).
2. User: each dropped pick + its banked points (read `player.droppedPicks`, score via `scorePick`).
Both must be visible before Phase 2 adds them to the orb.
