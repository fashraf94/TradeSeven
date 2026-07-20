# Battle View Scoring Display — Phase 0 Discovery (read-only)

**Arc:** Battle View Scoring Display — Design Spec V1 (founder rulings 2026-07-20: R1 points-first cells, R2 click-through breakdowns reusing the BaggerBomb pattern, R3 ticker-tap → AssetResearchModal)
**Report type:** Phase 0 read-only discovery (spec §4). **Hard STOP after this report — no build.**
**Date:** 2026-07-20

---

## Session preamble (BUILD_RULES §2 / §3)

- **Branch:** `claude/battle-view-scoring-display-eq1hfk` (matches the designated branch).
- **HEAD SHA:** `6802670cb8aafc28b9fc976d9bf678fb56efd0be`.
- **Working tree:** clean (no uncommitted changes at session open).
- **`git fetch origin`:** run as the first step (BUILD_RULES §3). HEAD is even with `origin/main` (0 ahead / 0 behind) — no stale-ref gap.
- **Read-only attestation:** No project state (working tree, branches, commits, remote) was modified during discovery. The only write is this report (a discovery artifact), authored outside the repo tree and offered for the record — no product code, tests, or fenced files were touched.
- **Provenance note:** The spec's requirement labels (R1–R3, §2, §3, §9 orb identity, "render −0 as 0") are **lead/founder-supplied out of band** — they are *not* a committed repo doc (grep of `docs/` for "banked+live", "score-tap", "ticker-tap", "leads with the leg" returns nothing). This report treats the pasted spec as the task input, and cites repo code for everything it asserts about the codebase.
- **Verification method:** Findings were produced by a fan-out of six per-area finders, each anchor then re-read by an independent adversarial verifier; the load-bearing anchors were additionally read by the lead this session. `VERIFIED` = read at that line this session; `ASSUMED` = inferred, not line-confirmed.

---

## Executive verdict (for the founder)

| # | Question | Verdict |
|---|---|---|
| 1 | Is there a BaggerBomb scoring breakdown to reuse for R2? | **Yes** — `ScoreBreakdownPopover.jsx`. Reusable as a *visual pattern*, but its data contract is one asset / one day and it **re-derives math + live-fetches prices** — both forbidden by §2. It must be **extended**, not reused as-is. |
| 2 | Can the R2 breakdown be rendered from persisted state today? | **No.** Today's *live* legs carry full attribution, but **prior days collapse to a single number** (agent) or a scalar per leg (user). §2's per-day/per-leg breakdown is **not renderable without the §7 fix persisting new fields.** |
| 3 | Is R1 (points-first) a simple flip? | **Almost.** A `headline='pts'` cell mode already exists but is **dead and shows the wrong number** (`star.banked`, not the `banked+live` total `star.points`). R1 = flip the model to `pts` **and** fix the hero to `star.points` (also fixes §9 orb identity). Pure display, no fence. |
| 4 | Is R3 (ticker → AssetResearchModal) feasible in the battle view? | **Yes, cleanly.** The modal is self-contained (self-portals, self-fetches, needs no provider). A cell has the symbol (`star.tk`); wiring is a new tap handler threaded to the arena host. No fence contact. |
| 5 | Can all four seat orbs be made equally fresh (§3 parity)? | **Only one way without new reads: all-banked** (drop the own-seat live score). Making rivals *live* is impossible under owner-only sealing — it needs a **founder policy change** to unseal rival books. Founder decision required. |
| 6 | Does the display build touch any fenced (protected) code? | **No** — every R1/R2/R3 display edit is non-fenced. **But** the §2 attribution the breakdown needs **can only be persisted by touching the agent scoring/doc-shape fence** → that work **belongs in §7**, not here. |
| 7 | Can we build now? | **No.** Blocked on the §7 scoring-model fix (which must carry §2's attribution as acceptance criteria) + voiding the two poisoned pods. This report is the design-lock input. |

**One-line summary:** R1 and R3 are clean, non-fenced display wiring. R2's breakdown is blocked by data, not UI — the numbers to explain a multi-day score are not persisted today, and persisting them is fenced §7 work. The rival-orb parity fix reduces to one founder decision.

---

## §4.1 — The BaggerBomb breakdown component & its data contract

**The component is `src/components/draft/ScoreBreakdownPopover.jsx`** — the canonical "tap a score → see the terms that sum to it" surface. (`DailyScoresModal.jsx` is a per-day *leaderboard*; `BaggerBombScoreboard.jsx`/`SessionScoreCard.jsx` show session totals — none is a per-asset term breakdown.) — VERIFIED `ScoreBreakdownPopover.jsx:7` (JSDoc "Shows detailed score breakdown when user taps points"), `:343` (TOTAL row), `DailyScoresModal.jsx:118` (`standings.map(player => …)`).

**Data contract (VERIFIED `ScoreBreakdownPopover.jsx:29-45`):** one flat `asset` object destructured into `{ symbol, gain, threshold, tierMultiplier, baggerBombs, busts, basePoints, baggerBombPoints, bustPoints, totalScore, startingPrice, currentPrice, lockedPrice, baselinePrice }` (+ `asset.direction`, `asset.dailyLevels.baseline`), plus loose props `{ events, onClose, entryPrice, battleCreatedAt, priceHistory, bankedBadgePoints }`. Rows rendered:
- **Base** `({gain}% × 10 [× tierMultiplier]) → basePoints` — VERIFIED `:221-243`.
- **BaggerBomb ×N → +baggerBombPoints** — VERIFIED `:245-275`.
- **Busts ×N → bustPoints** — VERIFIED `:277-307`.
- **Previous Days: Badges → bankedBadgePoints** (one lump scalar, only when ≠ 0) — VERIFIED `:310-334`.
- **TOTAL → totalScore** — VERIFIED `:343-373`.
- Header "Entry / Current / Today", optional "Today's Baseline" (`asset.dailyLevels.baseline`), a sparkline, and a threshold footer.

**Consumers / invocation:** 4 JSX render sites — `AssetTile.jsx:342` (asset+onClose only), `BaggerBombBattleView.jsx:661` (asset built inline), `AgentBattleScreen.jsx:1077` (inline, tiers from `CONVICTION_MULTIPLIERS`), `TopPerformersModal.jsx:389` — plus a barrel re-export `draft/index.js:34`. It is always a **centered full-screen portal modal** (`ReactDOM.createPortal(..., document.body)`, `translate(-50%,-50%)`) — VERIFIED `:76`, `:96-99`. Trigger is a tap on the points chip (VERIFIED `AssetTile.jsx:221`).

**Reusability verdict: reuse the *pattern*, extend the *contract*.** The component is a pure presentational portal with **only soft couplings** — imports are `HOLO_COLORS` (theme constants) and `fetchHistoricalOHLCV` (network, sparkline only); **no React context, no provider, no required hook** (VERIFIED `:3-4`). Wiring cost is ~zero. **But two properties conflict with §2's "renderable from persisted state alone, no client re-derivation":**
1. It **re-derives P&L client-side** — `rawChangeFromEntry = ((currentPrice − battleEntry) / battleEntry) × 100` (VERIFIED `:71`).
2. It **live-fetches OHLCV** for the sparkline (VERIFIED `:58`, `services/eodhdAPI`).

Both must be dropped or fed from persisted values if reused in the §9 enforcement surface. **And structurally it models one asset / one day** — one aggregate base row, one bagger row, one bust row, one *lumped* prior-badges scalar. It has **no per-day rows, no per-leg/departed rows, no threshold-tier row (the multiplier appears only as inline label text), and no layer subtotals (agent / user / ×1.5 / composite)** — VERIFIED `:233`, `:310`, `:323`. §2's breakdown therefore needs the component **extended** to accept an ordered list of `{label, value}` term rows plus subtotal/window sections; it does **not** exist today.

> Reuse caveat (verifier-surfaced, load-bearing for any consolidation): the component does **no summation and no validation** — it trusts the caller's numbers. The two inline callers already **diverge on the scoring constants** (`AgentBattleScreen.jsx` sources `tierMultiplier`/badge points from `CONVICTION_MULTIPLIERS`/`THRESHOLD_POINTS`; `BaggerBombBattleView.jsx:674-685` hardcodes the same values as literals). R2's "terms MUST sum exactly" (§9) obligation lands on **the caller**, so the battle view must feed persisted, pre-summed attribution — it cannot hand-derive it. *(The constant divergence is a latent drift risk in the existing BaggerBomb game — flagged for separate tasking below.)*

---

## §4.2 + §2 — Battle-view cells, the arena feed, and the attribution gap

### The cells
Both the agent **six** and user **three** render through the **same presentational `StarCell`** over flat "star rows"; `DockAgentSix` maps `D.agentStars`, `DockYourThree` maps `D.userStars` (VERIFIED `CommandDock.jsx:128`, `:195`; `ArenaDesktop.jsx:79`; mobile `ArenaMobile.jsx:228`). **`StarCell` has no tap/click/press handler of any kind** (VERIFIED `StarCell.jsx:186` + empty grep for `onClick|onTap|onPress|role=|cursor:pointer`). *(It does expose a `footer` render-prop, currently used to inject the flip button on user cells — a candidate host for a breakdown trigger.)*

The **star row contract** is `{ tk, tier, dir, mult, banked, points, badge, state, justIn }` (user rows also carry `settleState`). Field origins (VERIFIED `leagueStarMeter.js:76-86`, `:139-160`):
- **Agent:** `readAgentStars → buildFlat6BattleModel → enrichFlat6Asset → calculateAssetScoreV3`. `banked = enriched.bonusPoints` (**badge bonus only**), `points = enriched.points` (**base+bonus total**), `mult = enriched.multiplier`.
- **User:** `readUserStars → scorePick`. `banked = result.bankedPoints` (**closed legs only**), `points = result.totalPoints` (**banked+live**), `mult = result.liveLegResult.multiplier`.

The richer per-asset fields the scorers compute (`basePoints`, `tierMultiplier`, `baseATR`, `priceChange`, `openPrice`/baseline, `badges[]`) are **dropped at the star-row map boundary** — but only for the *live* leg, and they are recoverable by widening the map (non-fenced) — VERIFIED `flat6BattleEnrichment.js:121-135`, `baggerBombUtils.js:615-629`.

### The feed
`buildArenaModel ← useArenaModel ← useArenaPriceContext` (VERIFIED `useArenaModel.js:67`, `useArenaPriceContext.js:30`). The only persisted scoring state reaching the client is (1) the group doc's `dailyScores` snapshots and (2) **your single flat6 battle doc**. `priceCtx` carries live prices + previousClose + activation gate only — **no persisted breakdown**. Rivals' battle docs are never fetched (owner-only; `battle=null` for non-you seats — VERIFIED `buildArenaModel.js:140`).

### The §2 gap — for each required breakdown dimension

| §2 requirement | Persisted / reachable today? | Gap |
|---|---|---|
| **(a) per-leg, per-day base points (pct×10×tier)** | **Live leg only.** Agent per-day snapshot persists **badge points + badge keys only** (`scoreState.bankedBadgePoints.breakdown[dayKey] = {points, badges}`, VERIFIED `agent-daily-scores.js:177`); **agent per-day base points are never persisted.** User per-day snapshot persists cumulative `{totalPoints, bankedPoints, livePoints}` per pick — **no base/badge split** (VERIFIED `tournamentBanking.js:285-291`). | §7 must persist **per-day, per-leg base points** for both layers. |
| **(a) threshold badge points if fired — which tier, at what multiplier** | Live leg: yes (via `badges[]` + `BAGGER_TIERS`/`BUST_TIERS`). Agent prior days: badge *keys* per asset persisted, points lumped. User prior days: **badge not stored on the pick entry**; closed legs *do* persist `thresholdHistory` (so badges are recomputable) but not the fired-tier point value. | §7 must persist **which badge tier fired and its points, per day, per leg** (or a stable projection). |
| **(a) the baseline used (price + source)** | **User legs: yes** — `leg.baselinePrice`, `leg.baselineSource`, `leg.baselineCapturedAt` persisted, non-fenced (VERIFIED `tournamentBanking.js:219-224`). **Agent: no** per-asset baseline persisted (only aggregate `scoreState` + `thresholdHistory {max,minMultiplier}`, VERIFIED `agent-evaluate.js:731-732`). | §7 must persist **agent per-asset baseline price+source** (fence-sensitive — see §4.5). |
| **(b) departed legs itemized (symbol, entry→exit, locked total)** | **Partial + gated.** `agentDeparted` = Σ `battle.trades[].lockedPoints` with per-item `{out, in, pts}`; `userDeparted` = `readDroppedPickLedger` with per-item `{tk, banked, pending}`. Both **gated behind `youOrbLive`** (training-only, activation-day, pre-bank) and carry **symbol+total only — no entry→exit prices**. Prior-day agent swaps are folded into the single `priorBankedAgent` number. — VERIFIED `buildArenaModel.js:257-276`, `leagueStarMeter.js:207-219`. | §7/display must **ungate** departed items and persist **entry & exit price** per departed leg. |
| **(c) layer weighting shown (agent subtotal, user subtotal, ×1.5, composite)** | **Values exist, not plumbed to the cell.** `computeComposite(agent, user) = agent + 1.5×user` (k=`USER_LAYER_K=1.5`) — VERIFIED `leagueTournament.js:662`, `:894`. Per-day `closeScores[uid]` persists `{agentPoints, totalPoints, compositePoints}` (VERIFIED `tournamentBanking.js:311-318`), but the model exposes only a single scalar `youLiveScore` — the halves and the ×1.5 line are **never passed as displayable fields**. | Display/§7 must **pass agent subtotal, user subtotal, k, and composite** to the orb breakdown. Least-blocked dimension. |
| **(d) window statement ("Day 1–3 of 5 · dates")** | **Derivable.** `pod.day` from `getLatestDayEntry(group).dayN`, `days = WEEK_DAYS_REQUIRED (5)`, and each day snapshot carries `recordedDate` (ET) — VERIFIED `buildArenaModel.js:356`, `tournamentBanking.js:332`. | Assemble client-side — **no new persistence**. This line is the §2 window tripwire. |

### Feasibility of a multi-day breakdown from *current* state
- **Agent layer: impossible.** Flat6 docs are fullday (replaced daily); only the scalar `closeScores[uid].agentPoints` survives prior days. The agent per-day badge breakdown lives on the owner's *current* doc and holds **badge points only, no base** — VERIFIED `buildArenaModel.js:238`, `agent-daily-scores.js:182`.
- **User layer: partial.** `group.dailyScores.day{N}.closeScores[uid].picks[]` per-pick cumulative totals are already on the client, but `buildArenaModel` never reads them, and they lack the base/badge/baseline split. — VERIFIED `tournamentBanking.js:311`.

**→ The §7 scoring fix must persist, as its acceptance criteria (spec §2 binding):**
- **User layer (non-fenced — `tournamentBanking.js` `pickEntries` + `scorePick` return):** per pick, per day — `basePoints` and `bonusPoints` (the split of `totalPoints`), the fired badge tier key(s) + their points + the multiplier at firing, and a per-day **delta** (today's contribution, since current values are cumulative-at-close). Baseline price+source already persist per leg.
- **Agent layer (fence-sensitive — see §4.5):** per asset, per day — base points, bonus/badge points + tier + firing multiplier, `baseATR`, and `openPrice`/baseline. Today only badge points + badge keys persist.
- **Layer-weighting plumbing (non-fenced):** surface `agentSubtotal`, `userSubtotal`, `k` (1.5), `composite` on the arena model (values already in `closeScores`).
- **Departed-leg detail (mixed):** persist entry & exit price on each swap/dropped leg; expose the departed items **ungated** (not only under `youOrbLive`).

---

## §4.3 — AssetResearchModal invocation (R3)

`AssetResearchModal` (`src/components/draft/AssetResearchModal.jsx`) is **fully self-contained** — standard usage in the battle view is unobstructed:
- **Signature (VERIFIED `:82-106`):** only `asset` and `onClose` are structurally required; everything else (`sector`, `showActionButton`, `version`, `defaultTab`, `isGameContext`, `onAcquire`, …) is optional with safe defaults. Documented `asset` shape: `{ symbol, name, price?, percentChange?, change?, sector? }` (VERIFIED `:41`).
- **Self-portals** to `document.body` at zIndex 1100 — the caller supplies no portal/root/container (VERIFIED `:358`, `:1331`).
- **No React context/provider** — zero `useContext`/`useTheme`/`Provider` (VERIFIED — empty grep); deps are service calls (`getCompanyProfile`, `getStockPrice`) + `useIsMobile`.
- **A bare `{ symbol, name }` is enough** — when `!(asset.price > 0)` the modal self-fetches price via `getStockPrice` on mount (VERIFIED `:117`). A cell has `star.tk` (the symbol), so `{ symbol: tk, name: tk }` suffices.
- **Canonical in-battle pattern:** `researchAsset` state → tap handler sets it → conditional `<AssetResearchModal asset={…} onClose={…} showActionButton={false} isGameContext version={2} />`. **The research-only precedents are `BaggerBombBattleView.jsx:646` and `AgentBattleScreen.jsx:1057`** (both `showActionButton={false}`, no acquire CTA). *(`DraftBoardRoom.jsx:246` is a draft-context caller that wires `onAcquire` — not the template to copy here.)*

**Nothing in the arena's data situation blocks standard usage.** R3 is **new wiring, not present today** (VERIFIED — no `AssetResearchModal`/`onSymbolClick` anywhere under `src/components/League/battleArena`): add a ticker tap target to `StarCell`, thread a callback up through `ArenaMobile`/`ArenaDesktop` to `LeagueBattleArenaLive` (the arena host), which owns the `researchAsset` state + modal render. Two notes: the ticker tap must be a **distinct** target from the score tap (spec §4.3); and the asset object should be **memoized** (`stableResearchAsset` precedent) so a WS price tick doesn't re-render the modal/chart. Optional enrichment via `buildResearchAsset` (`src/utils/researchAssetBuilder.js`, non-fenced) using `useArenaPriceContext` data already in the tree.

---

## §4.4 — Rival-orb freshness & the cheapest unification

**Current split (VERIFIED `buildArenaModel.js:390`, `ClimbArena.jsx:64`):** a single conditional — your seat reads `youLiveScore` (a live intraday composite); every rival reads `climb[id][lastIdx]` (the last banked daily-close snapshot). The orb, altitude, rank, crown, and cut line all read one `at(s)` accessor, so they can't disagree with each other.

**But the live path is narrower than "own live vs rivals banked":** `youLiveScore` is **training-only and activation-day gated** (`youOrbLive = mode==='training' && status BATTLE && !dayBanked && battle && now && isFlat6ActivationDay` — VERIFIED `:231-236`). True freshness matrix:

| Seat | Ranked | Training (activation window) | Training (else) |
|---|---|---|---|
| You | banked | **live** | banked |
| Rivals | banked | banked | banked |

So the parity gap **only exists inside the narrow training/activation window**; everywhere else all four seats are already banked-at-parity.

**Why all-live is infeasible:** a rival composite needs both halves of `computeComposite`. The rival **user** half could in principle be re-scored from their `players[].picks` + prices, but the rival **agent** half needs their six-stock book, which **owner-only sealing never fetches** (`battle=null` for rivals — VERIFIED `:11-13`, `:140`). A partial "live user half + banked agent half" would be a new mixed-freshness metric no surface computes. Making rivals live = a **founder policy change to unseal rival books** + new per-tick reads.

**Cheapest unification without new reads = all-banked** (force `youLiveScore = null` / ignore it in `at()`). Every seat then reads `climb[id][lastIdx]` at one freshness. **Cost:** you lose the own-seat intraday movement in training — the one cheap live signal the system has — and it **breaks pinned tests** (`buildArenaModel.test.js:200-282` asserts the exact `youLiveScore` gating; `ClimbArena.jsx:141` trail-dot, `:96` cut, `:390` ranking override are all coupled to `youLiveScore != null`). *(A third surface, `TrainingClimbPreview.jsx:88`, already renders all-banked because it passes `battle=null`.)*

**→ Founder decision (design-review, not code-only):** parity-cheapest (**all-banked** — drop `youLiveScore`, update the pinned tests) vs parity-at-fidelity (**unseal rivals** — policy change + new reads). The data layer supports *only* all-banked without new reads, which is the §3 constraint's own test.

---

## §4.5 — Fence-contact register (BUILD_RULES §1 / §4)

**All display-layer edit targets are NON-fenced** (all under `src/`; the fence is the 8 `api/` files at `BUILD_RULES.md:14-21`): `StarCell.jsx`, `CommandDock.jsx`, `ArenaMobile.jsx`, `ArenaDesktop.jsx`, `ClimbArena.jsx`, `buildArenaModel.js`, `useArenaModel.js`, `leagueStarMeter.js`, `flat6BattleEnrichment.js`, `leagueFormat.js`, `ScoreBreakdownPopover.jsx`, `AssetResearchModal.jsx`, `researchAssetBuilder.js`, and any new component under `src/`. R1/R2/R3 wiring touches **no fenced file**. — VERIFIED `BUILD_RULES.md:13-23`.

**The scorers are only READ.** `calculateAssetScoreV3` (`baggerBombUtils.js:535`, in `src/`) already returns the full §2 attribution and needs **no edit** — surfacing existing fields is not fence contact. It is fenced **as a concept** (§1/§4), so *editing* it would be. `scorePick` (`api/_utils/tournamentUserScoring.js`) is **non-fenced** and already exposes the full live-leg result (`liveLegResult`).

**Fence contact begins where §2 attribution must be PERSISTED onto banked/agent positions — this is §7 work, not this build:**
- **User layer — NON-fenced.** Widening `tournamentBanking.js` `pickEntries` and the `scorePick` return to carry per-day base/badge split + firing tier is editable without fence contact.
- **Agent layer — FENCE-SENSITIVE (STOP).** Persisting per-asset agent base points / baseline / badge tier means writing new shape into the agent battle doc. The `scoreState` / `createAgentBattle` doc shape is fenced (`agentBattleService.js:234`, `BUILD_RULES.md:19`); swap-realized breakdown lives in fenced `agentSwapExecution.js` (`lockedPoints` at `:241/:254/:353`). The *compute* functions are reachable, but extending the persisted agent doc shape is fence contact — **it must fold into the §7 pass under founder gate, not proceed here.**
- **Do not "unify" the scorers.** `calculateAssetScoreServer` (`api/_utils/agentScoring.js:224`, **FENCED**) is a byte-parallel copy of `calculateAssetScoreV3`. Editing/merging it is both fence contact and the documented local-copy bug class (BUILD_RULES §4). — VERIFIED.

**§9 / `AGENT_BATTLE_DURATION_MODE` interaction:** the plan to show live per-star `bonusPoints` assumes `scoreState.bankedBadgePoints.total` is 0 on the live fullday doc (VERIFIED tripwire `buildArenaModel.js:288-295`). If the mode ever reverts to multi-day, badges bank into a *live* doc (`agent-daily-scores.js:176`) and both the per-star display and the orb must surface it as a "third departed source" before summing, or the agent half under-counts. Any badge-attribution display must preserve this invariant.

---

## §3 / R1 — Display rules & cross-cutting bugs

1. **Points-hero wiring (R1) — the `pts` mode exists but shows the wrong number.** `StarCell` has a `headline='pts'` branch, but it is **dead** (every host defaults `headline='mult'`; the live hosts `LeagueBattleArenaLive.jsx:61/77` pass **no `headline` at all**, so `'mult'` is the only value that ever renders — VERIFIED) **and it renders `fmtPoints(star.banked)`** (VERIFIED `StarCell.jsx:258-259`) — which is `bonusPoints` (agent) or `bankedPoints` (user), i.e. **not** the `banked+live` total R1 demands. R1's hero is **`star.points`**. Fix = flip the model/hosts to `'pts'` **and** change the hero expression (and its sign/color/textShadow conditionals) from `star.banked` to `star.points`.
2. **§9 orb identity requires the same fix.** The orb sums `s.points` (`sumPoints`, VERIFIED `buildArenaModel.js:237`), so `orb == Σ(agent cell points) + Σ(agent departed) + 1.5×[Σ(user cell points) + Σ(user departed)]` holds **by construction only if the cell hero is `star.points`.** The current `pts` branch (`star.banked`) would break the identity a Phase-2 test asserts against rendered values. Departed chips already render (`DepartedChip` prints `fmtPoints(total)`, mounted in both docks + mobile — VERIFIED `CommandDock.jsx:125/172`), so the render inputs for the identity test exist.
3. **Negative-zero bug (spec §3 "render −0 as 0").** The multiplier is printed **raw**: `{star.mult >= 0 ? '+' : ''}{star.mult.toFixed(1)}×` in both the mult headline and the pts-branch corner chip (VERIFIED `StarCell.jsx:273`, `:262`). A small negative that rounds to −0.0 (e.g. −0.04) fails `>= 0`, gets no `+`, and `toFixed` emits **`-0.0×`**. There is **no `fmtMult` guard** — `leagueFormat.js` exports only `fmtPoints`/`fmtScore`, which already collapse −0 but are not applied to the multiplier. Fix = a `fmtMult` (or reuse the collapse logic) at these two sites. *(Flipping the hero to `fmtPoints(star.points)` is separately safe — integer, already collapses −0.)*
4. **Banked-vs-live legibility (§3, "Phase 0 proposes").** There is **no** per-cell banked-vs-live visual split today; a live cell shows one hero + one caption. The nearest existing precedent is the orthogonal **`settleState` axis** (`estimated` dashed "est" / `official` solid "banked" / `pending`·`void` muted em-dash — VERIFIED `StarCell.jsx:107-131`, `:220-223`) — a "provisional vs official" treatment, not a banked-portion-vs-live-portion split. A proposal (e.g. subdued banked figure + live delta) is a net-new cell treatment; `settleState` is the structural pattern to mirror. *(Note: `settleState` is user-only and drives no-number muted cells — any breakdown must handle those states.)*

---

## R1/R2/R3 edit-site checklist (discovery only — DO NOT BUILD)

All non-fenced; recorded so the §5.3 display build (post-§7) starts anchored. Lines drift — re-verify at that HEAD.

- **R1 points hero:** `buildArenaModel.js:418` (`headline:'mult'` → `'pts'`; or per-panel at the `StarCell` call sites if only one seat should change — the prop is not per-seat) + `StarCell.jsx:258-259` (`star.banked` → `star.points` in hero + sign/color/textShadow). One `StarCell` edit covers desktop and mobile (shared branch). **Do not** blanket-swap `star.banked` — `captionFor` (`:170-179`) uses it intentionally for badge text.
- **R1 neg-zero:** new `fmtMult` applied at `StarCell.jsx:262` and `:273`.
- **R2 score tap → breakdown:** add a score-hero tap region in `StarCell` (distinct from the ticker) → thread `onOpenBreakdown(star)` up `CommandDock`(`DockAgentSix`/`DockYourThree`)/`ArenaMobile` → `LeagueBattleArenaLive` owns modal state + renders the **extended** breakdown component. Breakdown data must come from persisted §7 attribution (blocked).
- **R3 ticker tap → research:** add a ticker (`{star.tk}`, `StarCell.jsx:250`) tap region → thread `onOpenResearch(tk)` up to `LeagueBattleArenaLive` → `researchAsset` state + `<AssetResearchModal asset={{symbol,name}} onClose showActionButton={false} isGameContext version={2}/>` (memoize the asset).

---

## Decisions the founder must make at design-lock

1. **Rival-orb parity (§4.4):** all-banked (cheapest, no new reads, breaks pinned tests, loses own-seat training-live signal) **vs** unseal rivals (policy change + new reads). *The data layer supports only all-banked without new reads.*
2. **Banked-vs-live cell treatment (§3):** subdued-banked + live-delta vs single hero. Phase 0 proposes mirroring the `settleState` visual axis.
3. **R2 breakdown shape (§2):** confirm the extended term-row + subtotal + window layout, and that the "terms sum exactly" guarantee is owned by the persisted §7 attribution, not caller-side math.

---

## Blockers & sequencing (hard STOP)

Per spec §5 this build is gated, in order: **(1)** the §7 scoring-model fix merges (carrying §2's attribution list above as acceptance criteria) → **(2)** the two poisoned pods are voided and a fresh validation pod runs on the fixed model → **(3)** this display build ships flag-gated dark → preview smoke on the validation pod → flip. This report is the design-lock input; it joins the §7 adversarial-review packet so the breakdown contract and the scoring fix are reviewed as one design. **No build proceeds from this session.**

---

## Found outside task scope → separate tasking (BUILD_RULES §3, do not fix here)

- **BaggerBomb breakdown constant drift:** `AgentBattleScreen.jsx` feeds `ScoreBreakdownPopover` from `CONVICTION_MULTIPLIERS`/`THRESHOLD_POINTS` while `BaggerBombBattleView.jsx:674-685` hardcodes the same values as literals. A latent display-vs-scoring drift in the existing BaggerBomb game (§9 family). Triage separately.
- **Test coupling to `youLiveScore`:** any parity unification will require updating `buildArenaModel.test.js:200-282` and `ClimbArena` position tests — scope into whichever arc executes the parity decision.

---

## Appendix — anchor confidence

All `file:line` anchors above marked VERIFIED were read this session (lead + adversarial verifier). The discovery ran six per-area finders (785k subagent tokens, 206 tool uses) each cross-checked by an independent verifier that re-opened the cited lines; every load-bearing claim returned CONFIRMED (a few anchor line-numbers corrected in-text, e.g. `scorePick` return at `:166`, `lockedPoints` at `agentSwapExecution.js:241`). No claim rests on an ASSUMED anchor. Re-verify before relying at a later HEAD.
