# League Battleview Redesign — Phase 0 Discovery Audit — Findings

**Date:** 2026-08-21
**Branch:** `claude/league-battleview-phase0-audit-y1byx5`
**HEAD:** `4a6a6b747ede46ea18460f505077d9036ab8e502` (short `4a6a6b74`) — "Merge pull request #787"
**Status:** READ-ONLY discovery. No code changed. No build plan, no spec, no PR. HARD STOP after this document.

**Method.** Every factual claim carries a `path/file.js:line` citation and a marker: **VERIFIED** = a line
read this session; **ASSUMED** = inferred. Citations were produced by a 7-lane discovery pass (Q1–Q5, Free
Agency, Supporting Inventory), each lane's claims then handed to an independent agent instructed to **refute**
them by re-opening the cited lines (14 agents, 0 errors). The three verdict-changing findings (conviction
inert in the League; the live ×1.5 leak; the two-phase waiver) were additionally re-opened by the lead. Per
BUILD_RULES §3, a byte-identical copy of this report lives outside the repo tree.

**Branch-name note (for the founder):** the audit brief §0.3 asks for a branch named
`audit/league-battleview-phase0`. This session's binding git-branch instruction designates
`claude/league-battleview-phase0-audit-y1byx5` and forbids pushing elsewhere without explicit permission, so
the work landed on the designated branch. Flagging the discrepancy rather than improvising a second branch.

**Fetch:** `git fetch origin` was the first action (BUILD_RULES §3). HEAD **is** merged to `origin/main`
(HEAD == `origin/main`, 0 ahead / 0 behind). Working tree clean at open.

---

## 0. The single fact that reframes this whole audit

**The League battleview is already on its V2 "Arena" rewrite — live in production, flag ON.**

`LEAGUE_BATTLE_VIEW_V2_ENABLED = true` (src/config/featureFlags.js:211) → `ARENA_LIVE_ON` true
(src/components/League/battleArena/arenaLiveGate.js:20) → the League host screens mount `LeagueBattleArenaLive`
→ `ArenaDesktop` / `ArenaMobile`, **not** the classic `Flat6BattleView` (src/screens/leagueBattleViewRender.jsx:20-33;
`Flat6BattleView` is now the dark fallback when the gate is off). `LEAGUE_BATTLEVIEW_ROUTING_ENABLED = true`
(featureFlags.js:257) and `LEAGUE_LIVE_ORB_ENABLED = true` (featureFlags.js:282) are also on. *(VERIFIED.)*

The live Arena V2 (`src/components/League/battleArena/`, ~40 modules) already ships, per its own header
(ArenaDesktop.jsx:3-6): a **competition climb HERO** (`ClimbArena` — the "points-axis scatter of orbs" the
redesign replaces), a **nine-star COMMAND DOCK** (agent's six · your three · state panel = the "metered
stars"), a **live beat engine** that flares stars, a **gold crown** leader mark (ArenaDesktop.jsx:98), a
**free-agency claim wire** in the dock, an **OpponentSnapshot**, and a **FilmRoomRecap** verdict.

**So the fuse-board redesign is an evolution of an already-shipped V2 arena, not a green-field build.** Many
primitives the brief frames as "new" (metered stars, crown, beats, wire, film room) already exist as live
code. Every verdict below is stated relative to the **live Arena V2**, not the classic view.

---

## Executive verdict table

| # | Question | Verdict | One-line for the founder |
|---|---|---|---|
| **Q1** | Intraday score history | **MISSING** (as a store) | No per-seat intraday composite series is sampled or persisted — only 5 daily closes + one on-demand live point. The fuse's TODAY (clock) axis has **no backing store**; building it is net-new persistence. |
| **Q2** | Scoring ladder (HIGHEST) | **EXISTS — ladder matches; tiers DIFFER in the League** | The +15/+30/+50 / −10/−20/−35 ladder at ATR-multiples 1.0/1.5/2.0 is byte-for-byte the prototype's. **But the Star ×2.0 / Core ×1.5 / Support ×1.0 conviction tiers are INERT in the live League game — every one of the nine picks scores at ×1.0.** The ladder is a UI workstream; the tier column is a BaggerBomb-mode concept the League does not use. **Not a §7 scoring change.** |
| **Q3** | Crossing events / beats | **MISSING** server-side / PARTIAL derived | No server emits a threshold-crossing event stream. The six beat states are DERIVED client-side (already shipped: `arenaBeatDiff`), from a lossy, **session-local** diff. Swap/claim/flip beats have real server feed sources. |
| **Q4** | Opponent book sealing | **PARTIAL / DIFFERS FROM DESIGN** | The reasoning (WHY) seal IS server-side at the read boundary. But the design's "no points" half DIFFERS: the founder-ruled V2.1 §9 contract ships rivals' points/positions as public-live WHAT. Honoring "tickers only" = tightening a server allowlist **and** reversing a founder ruling. |
| **Q5** | User's-three scoring path | **EXISTS — separate; flip already built** | User 3 picks score on a separate fenced path (`tournamentUserScoring`), not `decide.js`. The long⇄short **flip is already implemented** (`api/tournament/flip.js`) on a **clean** (non-fenced) surface that only *reads* the fenced scorer. |
| **§3** | Free Agency | **EXISTS — beyond the founder's read / DIFFERS** | Full claim backend **and** an in-battle claim surface already ship (the founder believed the in-battle surface missing). But the live model is a **two-phase overnight waiver** (place → resolve 9:25 AM ET), not the prototype's single atomic on-surface move, and there is **no drop/withdraw counterpart** in the tournament layer. |
| **§4** | Supporting inventory | Mostly **EXISTS**, three real gaps | Archetype rides YOUR seat but **not rival seats**; the live `DecompositionStrip` **leaks the ×1.5**; the arena uses a **duplicated archetype-label map**, not canonical `getArchetypeDisplayName()`. Mode divergence is minimal; concurrency clean; the auth-reactivity defect does **not** reach the League read path. |

**Does this split into one branch or three?** On scoring, one: the ladder is unchanged, so no §7 fenced
scoring edit is required to render the fuse. The findings that add backend work are Q4 (tighten the seal +
founder contract change), Q1 (net-new intraday persistence, IF the TODAY axis must replay history rather than
poll a live scalar), and Free Agency (atomic-move vs waiver is a product decision). None of those is a fenced
scoring change; each is a founder-adjudication item below.

---

## Q1 — Intraday score history — VERDICT: **MISSING** (no sampled/persisted series)

**No per-seat composite score series is sampled through a live session.** What exists is (a) per-seat **daily
closes** — one point per banked ET trading day — and (b) a single **on-demand live point** recomputed per
request, never accumulated.

- **Daily closes are the only cross-session per-seat series a client reads.** `buildClimbSeries` returns one
  element **per banked day** (metric `composite`), never intraday samples (src/components/League/leagueClimbAdapter.js:66-86;
  read path src/components/League/battleArena/buildScoreHistory.js:94-101). *(VERIFIED.)*
- **Writer:** the nightly banking pass — `computeBankingUpdate` builds
  `closeScores[odUserId] = { totalPoints, picks, agentPoints, compositePoints: round2(computeComposite(...)) }`
  and `bankGroup` persists it at `dailyScores.${dayKey}` on `tournamentGroups/{groupId}`
  (api/_utils/tournamentBanking.js:325-333, 380-385). Idempotent per ET day (:118-122) — a once-per-day close
  writer, not a sampler. Runs after the 4pm ET close (`snake-draft-daily-scores` cron `15 21 * * 1-5`,
  vercel.json:48-51). *(VERIFIED.)*
- **The "live" TODAY value is computed ON DEMAND, never persisted.** `GET /api/tournament/live-composites`
  reads the group + last ~15-min agent state + this-request cached quotes and returns
  `{ composites: {[odUserId]: scalar} }` — **zero writes, no cron, no accumulation** (api/tournament/live-composites.js:38-78;
  pure core api/_utils/tournamentLiveComposite.js:77-107). The client poll (~60s) holds only the **latest**
  value in React state and merges it as the **current/last index** of the daily series — an overlay on the
  last close, not a per-tick curve (src/components/League/battleArena/useLiveComposites.js:24,31-49;
  buildArenaModel.js:117,367-393,463,479-480). *(VERIFIED.)*
- **Agent side has no series either:** `scoreState.currentScore` is a single mutable field overwritten each
  ~15-min `agent-evaluate` pass (api/cron/agent-evaluate.js:860-873); `scoreState.dailyScores.${dayN}` is a
  per-day bank (api/cron/agent-daily-scores.js:182-190, cron `45 1 * * 2-6`). *(VERIFIED.)*
- **`METRIC_HISTORY_SNAPSHOT_ENABLED` (=true, featureFlags.js:282-adjacent / PR #776) is per-TICKER only.**
  `writeDailySnapshots` → `metricSnapshots/{ticker}/daily/{YYYY-MM-DD}`, one doc per ticker per day
  (api/_utils/metricSnapshots.js:113-128). The gated builder in `compute-rankings.js:1594-1642` assembles
  `metricsByTicker` purely from the ranked stock universe — **zero reference to groups, odUserId, agentBattles,
  or seats**. No per-seat aggregate rides along. Daily cadence, unbounded retention ("history is the product",
  metricSnapshots.js:29-34). A sibling `quarterlySeries` exists — also per-ticker. *(VERIFIED.)*

**Implication.** The prototype's `flSeries()` faked exactly this intraday curve (brief §6). Delivering a TODAY
fuse-line that traces the trading clock requires **net-new persistence** (a cron or client accumulator appending
per-seat composite ticks to a new store) — OR a product decision to render TODAY as a single live tip polled
off `live-composites`, with the five daily closes as the only historical spine.

**Doc-drift flagged (BUILD_RULES §8, live repo authoritative):** `live-composites.js:25` header still says
"DARK/INERT on merge: nothing consumes it yet." That is **stale** — `useLiveComposites`/`useArenaModel` consume
it and `LEAGUE_LIVE_ORB_ENABLED` is on. *(VERIFIED.)*

---

## Q2 — The scoring ladder — VERDICT: **EXISTS (ladder) / the conviction tiers DIFFER in the League**

### The ladder matches the prototype exactly (canonical, single source)

`src/constants/baggerBombScoring.js` (full file read, VERIFIED):
- `BAGGER_TIERS` (:14-18): BaggerBomb 1.0 / +15 · Double Bagger 1.5 / +30 · TenBagger 2.0 / +50.
- `BUST_TIERS` (:24-28): Bust −1.0 / −10 · Crash −1.5 / −20 · Meltdown −2.0 / −35.
- `THRESHOLD_MULTIPLIERS` (:43-50), `THRESHOLD_POINTS` (:33-40) mirror them.

Every rung and ATR-multiple **matches the prototype table.** The engine `calculateAssetScoreV3`
(src/utils/baggerBombUtils.js:535) consumes these constants, and the fenced server mirror
`calculateAssetScoreServer` (api/_utils/agentScoring.js:224) is arithmetically identical. This is **not** a
scoring change on the ladder → **it does not trigger the §7 dual-review on that basis.**

### The conviction tiers (Star ×2.0 / Core ×1.5 / Support ×1.0) are **INERT in the live League game**

The tier multipliers exist — `CONVICTION_MULTIPLIERS = {star:2.0, core:1.5, support:1.0}`
(baggerBombScoring.js:56-60) — but they apply only when a per-asset override is absent. **In the League
(flat6 / `baggerbomb_tournament`) they are overridden to ×1.0 for every pick:**

- `src/constants/agentGameModes.js`: the flat6 mode sets `flatMultiplier: 1.0` and
  `scoringSnapshotTierMultipliers: { star:1.0, core:1.0, support:1.0 }` (:70-71), with the comment
  "star/core/support are slot labels only, all 1x" (:59). The other mode (`baggerbomb_agent`) keeps
  `flatMultiplier: null` → tiers resolve to 2.0/1.5/1.0 (:50,53). *(VERIFIED.)*
- The scorer honors that override: `tierMultiplier = asset.tierMultiplier ?? CONVICTION_MULTIPLIERS[asset.tier]`
  (baggerBombUtils.js:584; agentScoring.js:267). A flat6 battle stamps `tierMultiplier = 1.0` per asset, so
  `basePoints = priceChange * 10 * 1.0`.
- **User picks carry no tier at all:** `tournamentUserScoring.js:19` — "asset = {symbol, baseATR, direction} —
  tier absent, so the scorer's [override resolves to] support" (×1.0). *(VERIFIED.)*

**Consequence:** in the live League, all nine picks (agent 6 flat6 + user 3 no-tier) score at conviction ×1.0.
The prototype's tier column is a **BaggerBomb-solo concept the League game does not use.** Rendering Star/Core/
Support multipliers on the fuse would misrepresent scoring — a §9 display-agreement violation. **Founder
decision:** does the fuse show tiers as **slot labels only** (no multiplier), or is re-activating tiered
scoring for the League an intended, separate (and then §7-gated) change?

### What the prototype's displayed "multiplier" actually is

The metered-star "performance multiplier" = `multiplier = effectiveThresholdChange / baseATR`
(baggerBombUtils.js:578; server agentScoring.js:262) — the price move in units of the asset's `baseATR`
(default 2.5), rebased to `previousClose` when available. That is an **existing computed quantity**; the fuse
can bind to it directly. The gauge's "fill toward the next threshold" is `detectRedZone().progress`
(api/_utils/agentScoring.js:108-159) — 0–100% inside the last 25% before the next uncrossed rung. *(VERIFIED.)*

### Two nuances the spec must honor (or the score display will lie)

1. **Conviction (where it applies) scales only the linear base, not the flat badges.**
   `basePoints = priceChange*10*tierMultiplier` (baggerBombUtils.js:587) is tier-scaled;
   `bonusPoints = calculatePoints(badges)` is flat ("NOT scaled by conviction", :612-613);
   `totalPoints = basePoints + bonusPoints` (:623). The prototype's adjacent ×column reads as "multiplies the
   +15/+30/+50" — it does not.
2. **A continuous linear term lives OUTSIDE the ladder.** The prototype shows only discrete rungs, but a seat's
   running value includes `priceChange*10*tier` between rungs. Decide whether the fuse's seat value shows
   `totalPoints` (includes the linear term) or only crossed rungs.

**Drift flagged:** `tournamentUserScoring.js`'s header cites a stale `decide.js:584-592` anchor (actual formula
now ~`1095-1096`) — documentation drift, not a behavior bug; separate doc-fix tasking. Two written-never-read
doc/snapshot files also duplicate the ladder **literally** (hand-maintained, not derived from canon) — drift
risk to watch, not a live-path fault.

**Fence contact (read only):** `agentScoring.js`, `tournamentUserScoring.js`, `archetypeScoring.js`, `decide.js`.

---

## Q3 — Crossing events — VERDICT: **MISSING server-side / PARTIAL (derived client-side)**

**No service emits a threshold-crossing event stream** (no ledger, shadow-logger stream, Firestore doc, or GCS
JSONL records "position crossed tier"). Totals are recomputed; the beats are derived.

- **The six beat states are DERIVED CLIENT-SIDE — and already shipped.** `arenaEngineCore.js:44` defines a beat
  as `{ kind:'edge'|'hit'|'swap'|'danger'|'claim'|'lead'|'flip', ... }`; in LIVE mode `deriveBeats` runs over
  real data, and "a real beat has no server id, so we key it by content" (arenaBeatDiff.js:3-9, `beatKey`).
  The heating/edge/hit/danger/busted/quiet states map to this client engine, plus `deriveStarState`
  (leagueStarState.js) which makes `hit`/`busted` **sticky** via persisted badges and gives `busted`
  precedence over `hit`. *(VERIFIED via engine + workflow.)*
- **The diffable server snapshot that makes derivation possible:** `thresholdHistory` on the battle doc, badges
  derived from persisted `history.maxMultiplier`/`minMultiplier` (badge "cemented once touched",
  baggerBombUtils.js:589-610), and `detectRedZone`/`isSwapLocked` proximity (agentScoring.js:108,172). All
  DERIVED from a scalar. **It is lossy:** `thresholdHistory` stores only monotonic extremes per tick — a diff
  can tell you the peak crossed a rung but cannot recover the crossing timestamp.
- **The beats WITH a real server source (the exceptions):** SWAP — `swapMotive`/`exitReason` stamped by
  `api/cron/agent-evaluate.js`, human label resolved in `leagueSwapLedger.swapReasonLabel` (leagueSwapLedger.js:85-102);
  CLAIM — the group-doc `feed` "placed" event (place-claim.js, Signal Capture Event #5); FLIP — the group-doc
  `feed` "flip" event `{symbol,from,to,flipPrice,bankedLegScore,legIndexClosed,legIndexOpened}`
  (api/tournament/flip.js:194-205, Event #4). *(VERIFIED.)*

**Two gaps the design must weigh:**
1. **Beats are session-local.** The client diff runs against an in-memory `prevRef` that initializes to `{}` on
   every mount (useArenaModel.js:72) — a crossing that happened while the tab was closed is **not replayed** as
   a beat. Persistent beats across a session would need a server-side event or a persisted "last-seen" cursor.
2. **The swap beat caption a user sees is hardcoded `swapped X → Y` (leagueBeats.js:194)** — the richer
   `swapMotive` label ("stop (bust avoidance)", "profit take", …) exists but is NOT surfaced in the beat text
   today. Surfacing it is a client change, no backend.

**Fence contact (read only):** `agentScoring.js`, `agentSwapExecution.js`.

---

## Q4 — Opponent book sealing — VERDICT: **PARTIAL / DIFFERS FROM DESIGN**

**The reasoning (WHY) seal IS enforced server-side at the read boundary — but the design's "no points" half is
a client convention the server deliberately overrides.**

- **Server-side WHY seal (exists, correct architecture).** Cross-owner/spectator reads go through
  `GET /api/tournament/battle-view` → `projectTournamentBattle(battle, {isOwner})` (api/tournament/battle-view.js:43-56).
  Non-owner + ACTIVE → WHAT-only allowlist; owner or `status==='completed'` → full doc (the Film Room unlock);
  `_whyConcealed:true` stamped (api/_utils/tournamentBattleView.js:76-93). Concealed: innerMonologue,
  strategyBrief, activeRules, guardrails, watchlists, per-trade rationale/hypothesis, gameplan, chat, Film Room
  ledger (founder-ruled V2.1 §9, tournamentBattleView.js:16-30). *(VERIFIED.)*
- **The "no points" half DIFFERS.** The WHAT allowlist ships rivals' points/positions **live**:
  `PUBLIC_TOP_LEVEL` passes `portfolio, scoring, scoreState, thresholdHistory` (tournamentBattleView.js:36-40);
  `PUBLIC_TRADE` passes `lockedPoints, lockedGainPct, entryPrice, exitPrice` (:51). The live rival composite is
  also intentionally exposed as a scalar ("no new information — the banked composite is already on the
  leaderboard", live-composites.js). So today, **rivals' points are public while live** — the design ("tickers
  only, no points") is STRICTER than the founder-ruled contract. *(VERIFIED.)*
- **Two refinements from the refute pass:**
  - The allowlist is **shallow** — it conceals-by-default only at the top level; `portfolio`/`scoreState`/
    `scoring`/`thresholdHistory` pass through **whole** (tournamentBattleView.js:36-40,83). A new nested field
    under those would leak. Per-position points are not shipped as a field, but are **derivable** client-side
    from positions + startingPrices + `thresholdHistory` + `calculateAssetScoreV3`.
  - **Today's arena never renders a rival's per-position book at all.** `buildArenaModel`'s `battle` param is
    always the viewer's OWN doc (every surface sources it from `useMyTournamentBattle`); rivals appear only as
    climb seats + an aggregate `OpponentSnapshot` composite (leagueAdapter.js:222 seat score =
    `getWeeklyComposite`, the banked composite — leagueTournament.js:1293-1298). The pod-overview book
    `battleToAgentBook` hardcodes `dir:'long'`, `c:0` for everyone (leagueAdapter.js:154-166). *(VERIFIED via workflow.)*

**Implication (real backend requirement + a founder decision).** The architecture (server-side allowlist) is
exactly right. To honor "rivals = tickers only, no points" while live, the allowlist must be **tightened**
(drop `scoring`/`scoreState`/`lockedPoints`/`lockedGainPct`; reduce `portfolio` to symbols; deep-project the
pass-through objects) **and** the founder-ruled V2.1 §9 transparency contract must be amended (it currently
declares points/positions public-live WHAT). This is not a UI filter. `tournamentBattleView.js` is **not**
fenced. Open: does the fuse intend to render rival **metered stars** (per-position multipliers) live? That data
is not in the rival response today.

---

## Q5 — Scoring path for the user's three — VERDICT: **EXISTS (separate path; flip already built, clean)**

**The two books take two separate scoring invocations; the per-pick flip is already implemented on a clean
surface.**

- **User's three** are scored by the fenced `api/_utils/tournamentUserScoring.js` (`scorePick`/`scoreLeg`),
  which calls the canonical `calculateAssetScoreV3` — a genuinely separate path from `decide.js`/`agentScoring`.
  Path: pick → `legs[]` → `scoreLeg` → `bankedScore`/composite; banked via `bank-daily-scores` +
  `tournamentBanking`. Shorts are handled (direction negation, mirroring the scorer). *(VERIFIED.)*
- **Agent's six** are scored on the agent path — `api/agent/decide.js` decisions +
  `calculateAssetScoreServer` (fenced agentScoring.js), written to `scoreState.currentScore`
  (agent-evaluate.js:862-865). The two books never share state (BUILD_RULES §7); the composite joins them at
  1.5× (§4-B). *(VERIFIED.)*
- **The flip control already exists and is CLEAN.** `api/tournament/flip.js` — `POST /api/tournament/flip`,
  owner-only long⇄short, capped `FLIP_CAP_PER_DAY`/ET day, market-open branch (closes the live leg AT
  `quote.close` via the fenced `scoreLeg`, flip.js:117-123,168) vs market-closed (bank-pending), Signal Capture
  Event #4 feed write, and a D-1 double-down rider (flip.js:214-232). **flip.js is NON-FENCED**
  (`api/tournament/*`) and only *imports+calls* the fenced `tournamentUserScoring` exports (flip.js:36) —
  calling fenced exports is BUILD_RULES §1-permitted. *(VERIFIED.)*

**Implication.** The per-pick flip the prototype proposes is a **clean change surface**: the mutation already
ships; the battleview needs only a UI doorway to `flip.js`. No fenced edit is required to expose it. Open:
whether the fuse reuses `flip.js` verbatim or adds a new mutation surface (reuse is the clean path).

**Fence contact (read only):** `decide.js`, `agentScoring.js`, `tournamentUserScoring.js`, `agentBattleService.js`.

---

## §3. Free Agency — findings (EXISTS, materially beyond the founder's read / DIFFERS on the atomic-move)

The founder's read — pool visible on the awaiting-game page; the **in-battle** claim surface missing or with no
UI access point — is corrected: the in-battle surface **does exist** in Arena V2. But the live model is a
**two-phase overnight waiver**, which DIFFERS from the prototype's single atomic on-surface move.

1. **Backend (full):** claim placement `api/tournament/place-claim.js` — `POST /api/tournament/place-claim`,
   user-authed, one awaited write carrying `{target, drop, rank, timestamp}` (Signal Capture Event #5); shared
   `validateClaimPlacement`/`commitClaimPlacement` core reused by the CPU path (`tournamentCpuClaims.js`).
   Resolution `api/tournament/process-claims.js` (admin/preview) + the production cron at **9:25 AM ET**
   (vercel.json:74), `processClaimsForTournamentGroup` (`tournamentClaims.js`). *(VERIFIED via workflow.)*
2. **Pool source / cadence:** a flat `group.userPool` (ranked universe minus the 12 drafted), seeded at draft
   resolution (resolve-user-draft.js:175) and kept across claim resolution (tournamentClaims.js:241-242,307).
   No timed mid-week rotation found. *(VERIFIED via workflow.)*
3. **Awaiting-game view:** `src/components/Tournament/awaitingOpen/` — `AwaitFreeAgentBrowser.jsx`,
   `FreeAgentsList.jsx`, `AwaitWire.jsx`, `AwaitSwapSheet.jsx`, `AwaitingOpenPodView.jsx` (claimWindow :151);
   plus `src/components/freeAgency/*` and `src/components/claims/ClaimsFreeAgencyScreen.jsx`. *(VERIFIED.)*
4. **In-battle claim surface (EXISTS — corrects the founder's read):** `CommandDock.jsx:194` /
   `ArenaMobile.jsx:315` render a "FREE AGENCY · used/total" button when live + wire.open →
   `FreeAgencyDoorway` → `ClaimSheet` (ArenaOverlays.jsx:56,62-63,89-146). Reachable in **ranked live battles
   too**, not only training (LeagueParticipantView.jsx:255 mounts the arena on `ARENA_LIVE_ON && myBattle`).
   *(VERIFIED via workflow.)*
5. **Claim mutation implemented?** YES (`place-claim.js`). Not a pool read only.
6. **Drop / atomic claim+drop?** The claim doc **carries its drop** (`{target, drop}`), and the add+drop are
   applied together at resolution — but resolution is the **overnight waiver**, not an on-surface finalization.
   Every surface's success copy says "resolves at the 9:24 AM ET processing pass"; claims are never applied
   optimistically (AwaitSwapSheet.jsx:165, ClaimFlipWindow.jsx:141). **There is no standalone drop-a-pick and
   no withdraw-a-pending-claim** in the tournament layer (a `cancelClaim` exists only in the separate legacy
   BaggerBomb `claimFreeAgencyService`; `AwaitWire` deliberately omits it). *(VERIFIED via workflow.)*
7. **Limits + wire window (modeled):** `claimsUsed`/`claimsTotal` with cap 3 —
   `CLAIM_PENDING_CAP_PER_CYCLE` (leagueTournament.js:1074); `buildArenaModel.js:435-440` sets
   `claimsUsed=myPending, claimsTotal=cap`; cap enforced ArenaOverlays.jsx:98. Wire-open window modeled —
   `getTournamentClaimWindow` (tournamentTime.js), `awaitTokens.js` `wireWindowLine`, `ClaimFlipWindow.jsx`
   ("opens Monday 4:00 PM ET"; "claims lock 9:24 AM ET"). *(VERIFIED.)*

**The "doorway."** The in-battle Arena V2 dock already renders a Free Agency doorway + claim sheet; the redesign
changes its chrome/placement, it does not build it from zero. **The design DIFFERENCE that needs a founder
ruling:** "claim + drop = one atomic move finalised on the Free Agency surface" vs the live **two-phase waiver**
(place now, resolve 9:25 AM). And whether a **drop/withdraw-pending** affordance should be added. *(Minor:
the wire closes 9:24 AM ET inclusive but the cron runs 9:25 — a one-minute window/label seam, tournamentSurfaces.js:33 vs vercel.json:74.)*

---

## §4. Supporting inventory

**A. Archetype on the seat payload — YOUR seat only; rival seats are the gap.** Archetype IS reachable and
public: `projectTournamentBattle` keeps `archetype` in `PUBLIC_AGENT_CONTEXT` (tournamentBattleView.js:45).
BUT the live arena passes `battle=null` for rivals, so the seat carries `arch: s.archName` for YOUR seat and
**undefined for rivals** (buildArenaModel.js:185). The fuse tips' per-archetype `MechSVG` therefore cannot
render for rival seats today. Fixable with existing wiring: a CPU rival's archetype is deterministically
recoverable client-side, and a human rival's archetype is already exposed by the spectator projection
(tournamentBattleView.js:45) via `useSpectatedTournamentBattles`. **Also:** the arena resolves the archetype
**label** via a duplicated map, not the canonical `getArchetypeDisplayName()` (src/data/archetypeDisplay.js);
and the seat carries the label, not the stable code-id a MechSVG selector keys off — a small re-plumb.
*(VERIFIED via workflow.)*

**B. Composite and split — computed server-side; and the ×1.5 is LEAKED today.** Composite of record =
`agentScore + k×userScore`, `k = USER_LAYER_K = 1.5` (api/_utils/tournamentLiveComposite.js:14; BUILD_RULES §7),
applied server-side; the endpoint returns only the scalar composite ("never rival holdings/positions/reasoning",
Ruling 1). The endpoint does not leak. **But the live client `DecompositionStrip` renders the weighting
explicitly:** `weight="×1"` on the Agent layer (:87) and `weight={kLabel}` = "×1.5" on the User layer (:98),
with a header comment "The ×1.5 weighting is shown EXPLICITLY on the user layer" (:5-11). It is gated on
`liveOrbOn` = `LEAGUE_LIVE_ORB_ENABLED` (buildArenaModel.js:116,381) = **true**, so it is **live**. This
**contradicts the design's "the internal multiplier must never be exposed"** and is a founder-accepted
disclosure today — a deliberate reversal the redesign proposes, and a founder ruling item. The split is
available as two contributions (agent side / user side) but **never** as a ratio. *(VERIFIED.)*

**C. Existing battleview components (the live V2 set).** `src/components/League/battleArena/` — hosts
`LeagueBattleArenaLive.jsx` (live) / `LeagueBattleArena.jsx` (fixtures) → `ArenaDesktop.jsx` / `ArenaMobile.jsx`;
top-half `ClimbArena.jsx` (+ `climbHeadLayout.js`, `seatAltitude.js`) — the scatter being replaced; dock
`CommandDock.jsx` + `StarCell.jsx` + `arenaMeter.js` (metered stars) + `DecompositionStrip.jsx`; engine
`useArenaEngine.js`/`arenaEngineCore.js`/`arenaBeatDiff.js`/`buildScoreHistory.js`; model
`buildArenaModel.js`/`useArenaModel.js`/`buildFixtureModel.js`; live data `useLiveComposites.js`/
`useArenaPriceContext.js`/`useArenaFlips.js`; overlays `ArenaOverlays.jsx`; `OpponentSnapshot` (in ArenaDesktop);
`FilmRoomRecap.jsx`; `VoiceLane.jsx`/`statusFeedToVoice.js`. Host wiring: `src/screens/leagueBattleViewRender.jsx`,
`LeagueBattleViewConnected.jsx`, `LeagueTrainingBattleView.jsx`, `LeagueParticipantView.jsx`,
`BattleViewScreen.jsx`; routing `battleViewRouting.js` (`isLeagueBattle` = gameMode `baggerbomb_tournament`).
**The whole arena renders BOTH training and ranked** — `mode` is a `'training'|'ranked'` prop
(buildArenaModel.js:95,102). *(VERIFIED.)*

**D. Mode divergence — minimal, matches the design's claim.** Branch points: accent color
(`md === 'ranked' ? gold : teal`, LeagueBattleArenaLive.jsx:60); live-orb gating
(`modeAllowsLive = mode==='training' || (liveOrbOn && mode==='ranked')`, buildArenaModel.js:262 — training
always live, ranked flag-gated); the verdict at complete (ArenaDesktop.jsx:6); and the ranked-only cut line
(design). No deeper fork observed — consistent with "only the cut line and the verdict diverge." *(VERIFIED;
cut-line compute site not located — see open questions.)*

**E. Concurrency — single battle-id read is clean.** The League battleview reads by `groupId` + `ownerId==uid`
and picks the current doc via `pickCurrentTournamentBattle` (src/hooks/useMyTournamentBattle.js:42-51) — one
resolved battle, per group. No global battle-id singleton in the League path; nothing assumes one-battle-per-
user that would break with concurrent battles. (BaggerBomb's `useAgentBattleId` is a different, agent-scoped
path.) *(VERIFIED.)*

**F. Auth reactivity — the League battleview does NOT inherit the defect.** `useMyTournamentBattle` lifts
`uid = auth.currentUser?.uid` to render scope (:32) and lists `uid` in its effect deps `[uid, groupId]` (:63),
so it re-subscribes when auth resolves. The known defect is real but confined to `useAgentBattleId` — it reads
`auth.currentUser` INSIDE the effect with deps `[agentId]` only (src/hooks/useAgentBattleId.js:20,29,53) — the
agent/BaggerBomb path, **not** the League battleview. `useActiveDeployments` is `.ARCHIVED`
(src/hooks/useActiveDeployments.ARCHIVED.js). *(VERIFIED.)*

---

## §5. Open questions (stated as questions — not resolved from the repo this pass)

1. **Conviction tiers in the League.** Should the fuse show Star/Core/Support as **slot labels only** (they
   score ×1.0 today), or is re-activating tiered scoring for the League an intended, separately §7-gated change?
2. **The ×1.5 disclosure.** The live `DecompositionStrip` shows "×1.5" (Inventory B). Is that a founder-accepted
   disclosure to preserve, or does the redesign's "never expose the multiplier" rule retire it?
3. **TODAY axis source.** With no persisted intraday series (Q1), does the fuse's TODAY line poll the live
   scalar (`live-composites`, ~60s) or does the founder want net-new intraday persistence to replay a real curve?
4. **Rival seals vs V2.1 §9.** "Rivals = tickers only, no points" contradicts the founder-ruled public-live WHAT
   contract (Q4). Is the design a deliberate contract change, or scoped to the fuse's rendering only?
5. **Rival metered stars.** Does the fuse render rivals' per-position multipliers live? That data is not in the
   rival response today (Q4) — surfacing it is a backend add on top of the seal decision.
6. **Free-agency model.** Does "one atomic move finalised on the surface" replace the overnight waiver, or keep
   waiver semantics with a nicer surface? And should a drop/withdraw-pending affordance be added? (Q§3-6.)
7. **Which free-agency subsystem is canonical** for the fuse — the League `placeClaim`, the legacy drafts
   `claimFreeAgencyService`, or battles `swapServiceV4`? Three parallel systems exist.
8. **Cut-line compute site** for the ranked "+N TODAY MAKES THE CUT" annotation — not located this pass.
9. **Beat persistence.** Client beats are session-local (Q3). Does the design require beats to survive a reload
   (→ a persisted last-seen cursor or a server event), or is session-local acceptable?
10. **`points` field provenance.** `readAgentStar` reads `enriched?.points` (leagueStarMeter.js:84) while the
    scorer returns `totalPoints`; confirm `flat6BattleEnrichment` aliases `totalPoints → points` (else a §9 gap).

---

## §6. Fence contact list (calibration-fence files READ this session — read only, ZERO edits)

Reading and calling fenced exports is BUILD_RULES §1-permitted; **no fenced file was edited.**

| File | Fenced | Read for |
|---|---|---|
| `api/agent/decide.js` | YES | Q2/Q5 — agent decision + scoring join, threshold-math source |
| `api/_utils/agentScoring.js` | YES | Q2 ladder/conviction math; Q3 `detectRedZone`/`isSwapLocked` derived states |
| `api/_utils/tournamentUserScoring.js` | YES | Q2/Q5 — user-book scorer (`scoreLeg`/`scorePick`), ported ladder |
| `api/_utils/archetypeScoring.js` | YES | Q2 — whether archetype reweights the ladder (it does not touch the flat6 tier override) |
| `api/_utils/agentSwapExecution.js` | YES | Q3 — swap execution / motive stamping shape |
| `api/_utils/agentBattleService.js` | YES | Q5 — `createAgentBattle` doc shape (the fenced concept), scoring-write host |

Non-fenced files central to the findings (blast-radius context, all read-only): `src/constants/baggerBombScoring.js`,
`src/utils/baggerBombUtils.js`, `src/constants/agentGameModes.js`, `api/tournament/battle-view.js`,
`api/_utils/tournamentBattleView.js`, `api/tournament/live-composites.js`, `api/_utils/tournamentLiveComposite.js`,
`api/_utils/tournamentBanking.js`, `api/tournament/flip.js`, `api/tournament/place-claim.js`,
`api/tournament/process-claims.js`, `api/_utils/tournamentClaims.js`, `api/cron/agent-daily-scores.js`,
`api/cron/agent-evaluate.js`, `api/_utils/metricSnapshots.js`, `api/cron/compute-rankings.js`, the whole
`src/components/League/battleArena/` set, `src/components/League/leagueAdapter.js`,
`src/components/League/leagueClimbAdapter.js`, `src/hooks/useMyTournamentBattle.js`,
`src/hooks/useAgentBattleId.js`, `src/config/featureFlags.js`.

---

**HARD STOP.** No build plan, no spec, no PR. Founder review comes next.
