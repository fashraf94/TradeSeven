# FantasyTrades — Backing Beta: Design Spec (V1)

**Date:** September 9, 2026
**Status:** Design spec — for founder review → Sol blind review → CC Phase 0 discovery. Not an implementation spec.
**Scope:** points-only, bracket-only backing layer on the League Tournament. No money, no crypto, no tokens, no purchasable points. One flag, dark by default.
**Relationship to prior docs:** builds on `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md` (atomic unit §1, round flow §3/§9, transparency amendment §9, leaderboard/rank §6–7, retention §4). Governing contract: `FANTASYTRADES_PRELAUNCH_SEQUENCE.md`. Fence and flag rules: `BUILD_RULES.md`.

---

## How to use this document

1. Implementation chat reads this, then runs its **own read-only discovery audit** scoped to §11 (cite `file:line`, report branch/HEAD).
2. **Hard STOP** after discovery for founder rulings (§14).
3. Phased build per §12 — one task = one branch, all behind `BACKING_BETA` at `false`, separate flip PR.

---

## 0. What this is

A spectator stakes **Backing Points** on a team's finish in a tournament round. Each group's stakes form one pot (parimutuel). A rake comes off; backers of the group winner split the rest pro-rata. Points are earned in play, cannot be bought, transfer to nothing, and have no cash value.

**The beta exists to answer three questions:** do regular people want to back teams; which teams attract backing; does backing make spectators read the tape. Nothing else is in scope.

**Why it fits the tournament as designed:** 8 of 16 are eliminated after week one and 15 of 16 never win (V2.1 §4). Backing gives the eliminated majority a reason to stay in the bracket. "Spectate + train" becomes "spectate + back + train."

---

## 1. Unit of backing — LOCKED

- **The team** = one player's parallel-layer battle: user layer + agent layer, scored as the existing composite (agent + 1.5 × user). Backers back the composite. Never a single layer.
- **Team identity on a stake** = `(tournamentId, roundId, groupId, playerId, agentId, equippedConfigHash at stake time)`.
- **One pool per group per round** (4 teams). R1 = 4 pools, R2 = 2, R3 = 1 (the showcase).
- **Resolution** = the group's round winner by the weekly composite that already decides advancement. **No new scoring, no fenced files touched.** The backing layer only reads results.
- **CPU teams are backable** (recommendation — D-b). In a small beta most groups are CPU-padded; unbackable CPUs would mean pools that never form. CPU carry is burned.
- **Bracket only in V1.** Base-layer groups deferred (§13).

---

## 2. Points economy — LOCKED

| Rule | Value (tuning, not architecture) |
|---|---|
| Currency | **Backing Points (BP)** — name is D-a |
| Grant | **Floor top-up:** at each round boundary, any balance below 1,000 BP is raised to 1,000. Winnings above the floor carry. Nobody hoards unspent allowance; winners keep what they won. |
| Min stake | 50 BP |
| Per-pool cap | 500 BP per backer per pool (forces at least two pools per week — the slate instinct without slate mechanics) |
| Multi-team in one pool | Allowed (hedging is a real scouting decision), within the per-pool cap |
| Debt | None. Balance never negative. Matches the RP "no debt" rule. |
| Transfer / gift / purchase / redemption | None of the four. This sentence is a product invariant and appears in UI fine print. |

Two numbers per user, kept distinct: **balance** (spendable) and **season net / career net** (backer leaderboard). Trainer **carry earned** is a third, separate stat — it is a trainer stat, not backer P/L.

---

## 3. Pool mechanics — LOCKED

- **Parimutuel.** The platform is never a counterparty and never owes a payout the pot can't cover. No fixed odds, ever.
- **Rake:** 10% of the pot. 5% burned; 5% **trainer carry**, split among the group's players by placement in the same proportion as the RP placement bonuses (100 / 66 / 33 → 1st / 2nd / 3rd, 4th gets nothing). Rewards consistent finishes rather than a jackpot. (D-d, D-e)
- **Payout:** winning team's backers split (pot − rake) pro-rata to stake. Integer BP; rounding remainder burned.
- **Displayed numbers, live during the window:** *crowd share* (team's share of pot, shown as a percent) and *pays ×* ((pot × 0.9) ÷ team stake). The stake control shows the **post-stake** pays × — your own stake dilutes the multiple, and the UI says so.
- **Winner had zero backing:** full refund of all stakes, no rake, pool status `refunded`.
- **Ties:** the tournament's own advancement tiebreak applies first (discovery item). If still tied, the winner share splits equally between tied teams, then pro-rata within each.
- **Trainer carry is paid in BP** into the player's balance — a backed trainer can turn around and back others. That loop is the whole economy.

---

## 4. Window placement in the round flow — LOCKED

Round flow (V2.1): Fri close → scoring resolves → results-and-review → **bracket reveal** → nightly loadout → draft → Mon–Fri battles.

- **Opens at bracket reveal.** Groups are known and the prior round's Film Room has unlocked, so full WHY is visible for scouting — this respects the transparency amendment (WHY is owner-only while live, public at completion) without touching it.
- **Closes at the group's first battle open (Monday pre-open).** Draft results are visible during the window — they are WHAT, already public — so a backer may scout the picks. Every stake records `stakedAfterDraft` so we can see whether people back records or lineups. (D-c; the alternative is closing at draft resolution.)
- **No in-week backing in V1.** Live scores are public; letting people back at Wednesday's leader is a score bet, not a team bet.
- **Loadout changes after a stake are allowed and disclosed, not voided.** Nightly loadout is a designed tournament feature; voiding stakes would punish trainers for using it. The stake stores hash-at-stake; the pool stores hash-at-open; the Team Card shows a "loadout changed" marker fed by Signal Capture Rider event #8. Post-beta lever if churn hurts trust: freeze loadout on backed teams.

---

## 5. Surfaces — the MVP cut

Do not polish spectate mode broadly. Build one card and one control; backing becomes the reason the spectator group view exists.

**Team Card** (one per team, in the group view while the window is open):
- Identity: player + agent name, archetype, career tier/RP.
- Record: season placements, last round's composite, placement bonuses banked.
- Loadout summary: archetype and equipped trait names. **Rule contents are not shown** — they are Forge citations, owner-only under the transparency amendment.
- Last round's Film Room highlights (best/worst pick, decisive moment) — reuse what results-and-review already renders; link out for full tape.
- Pool strip: crowd share, pays ×, your stake, loadout-changed marker.

**Stake control:** presets 100 / 250 / 500, custom amount, post-stake pays ×, confirm. Client never asserts a stake exists until the server ledger entry is read back (client-honest / server-authoritative).

**Pool ticker** at group level: pot total, backer count, most-backed team. **"Backing open" chip** on the bracket during the window. Entry hierarchy per handover decision #7: your game first, then other games.

**Backing results card** in results-and-review: what you backed, who won, payout, and the calibration moment — "the crowd had them at 62%." This is the learning beat; it must exist.

**Backer leaderboard:** seasonal (monthly reset, like the MVP board) and career, by net BP. **Trainer carry display** on the player's own profile: "Backing earned this season."

Vocabulary is fixed (§9): *back, backer, backing, pool, pot, crowd share, pays ×.*

---

## 6. Data model — proposal, discovery confirms shapes

| Collection | Key fields | Writes |
|---|---|---|
| `backingPools/{poolId}` — `${tournamentId}_${roundId}_${groupId}` | `status` (open \| closed \| resolving \| resolved \| refunded), `opensAt`, `closesAt`, `teams[]` {playerId, agentId, archetypeId, isCpu, configHashAtOpen, stakeTotal, backerCount}, `potTotal`, `rakeBps`, `carryBps`, `winnerPlayerIds[]`, `payoutMultiple`, `resolutionRef` | server only |
| `backingStakes/{stakeId}` | `userId`, `poolId`, `teamPlayerId`, `amount`, `configHashAtStake`, `placedAt`, `stakedAfterDraft`, `status` (live \| won \| lost \| refunded), `payout`, `resolvedAt` | server only; user reads own |
| `backingWallets/{userId}` + `entries/{entryId}` ledger | `balance` (cached, derived), `seasonNet`, `careerNet`, `carrySeason`, `carryCareer`, `lastFloorRound`; ledger entry: `type` (floor \| stake \| payout \| refund \| carry), `delta`, `ref`, `at` | server only; user reads own |

- **Ledger-first.** Balance is derived from entries and cached; any mismatch resolves in the ledger's favor.
- The stake action is an **Admin SDK endpoint**, never a client Firestore write. Pools are publicly readable.
- **Reuses, does not modify:** `tournamentGroups` (membership, results), `tournamentLeaderboards` (placements), `masteryProfiles/{userId}` (tier/RP), `agents` (archetype, traits, `equippedConfigHash`).

---

## 7. Jobs — and the cron ceiling

Cron slots sit at ~38–40 of 40. **This feature adds zero cron entries.**

- **Pool open + floor top-up:** co-tenant with whichever job writes the new round's `tournamentGroups` (bracket reveal). Discovery names it.
- **Pool close:** not a job. `closesAt` is data; the stake endpoint rejects late stakes on server clock and additionally refuses once the group's first battle is active.
- **Resolution + payout:** co-tenant with the Friday scoring/advancement job, after placements are final. Idempotent by design: pool status guard, per-stake status guard, one transaction per pool. `resolving` is a real phase that re-reads placements before committing to `resolved` (terminal-state honesty). Use the Sprint 1 queue-flag pattern if the write must survive lambda termination. Ship an admin re-run endpoint for recovery.
- None of these writes may block or destabilize the tournament job they ride on.

---

## 8. Integrity rules — LOCKED

- **No backing inside your own group** — not your team, not your rivals (blocks throw-to-hedge). Enforced server-side.
- **Eligibility = one completed battle on the account** (any mode). Ties backing to play and starves fresh alts. (D-g)
- **One wallet per Firebase Auth identity.** Reuse the CPU-farm guard's group-composition signals as the alt-detection starting point; expand only if abuse appears.
- **Window enforced on the server**, never trusted from the client.
- **No opt-out from being backable** in V1. A backed team's WHAT stays public exactly as the transparency amendment already requires; nothing new is exposed.
- **Burns go nowhere.** There is no platform account that accumulates rake.

---

## 9. Honesty and copy

- **Single fine-print string, one source:** "Backing Points are earned in play, can't be bought, and have no cash value."
- **Extend the forbidden-terms test:** `bet, wager, odds, cash out, win money, gamble` are build failures in backing UI strings. The lexicon is *back / backing / pool / pot / crowd share / pays ×.* This is not cosmetic — it keeps the points beta outside sweepstakes framing, which is the regulatory heat of the moment.
- The results card reads the ledger; nothing in the UI claims a payout the server hasn't written.

---

## 10. Telemetry and the decision rule

**Events:** `backing_window_viewed`, `team_card_opened` (sections expanded, dwell), `stake_placed` (amount, team, crowdShareAtStake, stakedAfterDraft, viewedFilmRoom), `stake_resolved`, `carry_paid`, `floor_granted`.

**Questions the first full tournament must answer:**
1. **Participation** — share of eliminated players who stake at least once in R2/R3. Signal threshold: ≥30%.
2. **Concentration** — share of pot on the favorite. Healthy is under 60%; above it, the crowd is just picking the leaderboard.
3. **Scouting depth** — share of stakes preceded by a Team Card open ≥30s or a Film Room view.
4. **Retention** — eliminated players who back return next round at a higher rate than those who don't.
5. **Trainer effect** — do backed trainers open the carry display; does loadout churn differ for backed teams.

**Decision rule:** 1 and 3 clear → proceed to slate mode + base-layer pools. 1 fails → the surface is the problem before the mechanic is; iterate the Team Card once, re-run one tournament, then decide.

---

## 11. Discovery questions (CC Phase 0, read-only)

1. Which job writes new-round `tournamentGroups`, and which locks top two on Friday? `file:line` for both co-tenant hosts.
2. Where is the advancement tiebreak defined?
3. Is `equippedConfigHash` readable server-side per agent at any time? Does Signal Capture Rider event #8 (nightly loadout edits) already persist?
4. Do CPU teams carry a `playerId`-shaped identity compatible with §1?
5. Exact current cron count against the ceiling.
6. Does the spectator group view exist as a component that can host a Team Card, or is it a flat list?
7. Existing Firestore rules pattern for server-only collections, to reuse verbatim.
8. Where a completed round's Film Room highlights are stored (render on the card without recomputation).
9. Location of the forbidden-terms test.
10. How the round-boundary floor top-up should behave for users who registered mid-month (base-layer newcomers).

---

## 12. Build sequence — one flag, staged PRs

Flag `BACKING_BETA` at `false` in `featureFlags.js`, `DARK_BY_DESIGN` registry entry, `flagPinGuard.test.js` pin. No module-scope flag reads.

| PR | Contents | Sessions |
|---|---|---|
| 1 | Wallet + ledger + floor top-up (server), Firestore rules, ledger math tests | 1 |
| 2 | Pools + stake endpoint + integrity rules (§8) + pool-open co-tenant | 1–2 |
| 3 | Resolution + payout co-tenant, idempotency, admin re-run; fixtures for zero-winner-backing, ties, rounding, mid-resolution retry | 1–2 |
| 4 | Team Card + stake control + pool ticker + bracket chip | 2–3 |
| 5 | Results card + backer leaderboard + trainer carry display + telemetry | 1 |
| Flip | Separate PR, after founder smoke on a preview URL | — |

≈ 7–9 sessions. `/code-review` at 10+ files or 1500+ lines. Sol blind review of this spec before Phase 0; Fable invariant review after discovery. Then **run one full tournament** before touching anything in §13.

**Prerequisite:** the tournament must resolve cleanly every week first. If the eval-tick deferral risk from the June audit is still live at 16 concurrent battles, that hardening comes before PR 3.

---

## 13. Explicitly out of scope (V1)

Money, crypto, tokens, purchasable or redeemable points, base-layer pools, slate/DFS mode, backing a single layer, fixed odds, in-week backing, secondary trading of stakes, opt-out from being backed, loadout freeze on backed teams, external/BYOA agents, anything that touches the calibration fence.

---

## 14. Rulings needed

| # | Question | Recommendation |
|---|---|---|
| D-a | Currency name | Backing Points (BP) |
| D-b | CPU teams backable | Yes; CPU carry burned |
| D-c | Window close | First battle open, drafts visible; record `stakedAfterDraft` |
| D-d | Rake | 10% — 5% burned, 5% carry |
| D-e | Carry split | By placement, 100/66/33 proportions, 4th gets nothing |
| D-f | Per-pool cap | 500 BP (half the floor) |
| D-g | Eligibility | One completed battle on the account |
| D-h | Floor top-up amount | 1,000 BP per round boundary |

---

*Prepared September 9, 2026 from the backing/predictions design conversation. Supersedes nothing; the League Tournament V2.1 framework remains authoritative for everything it covers.*
