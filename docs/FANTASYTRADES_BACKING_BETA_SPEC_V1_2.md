# FantasyTrades — Backing Beta: Design Spec (V1.2)

**Date:** September 12, 2026
**Status:** Design spec. Founder-blessed rulings D-a through D-w (§15). Supersedes V1.1 (Sept 10). Next: addendum discovery (§13) → PR 1.
**Scope:** points-only backing layer on base-layer League group-weeks. No money, no crypto, no tokens, no purchasable or redeemable points, no rake, no carry, no public ranking. One flag, dark by default.
**Relationship to prior docs:** V1 and V1.1 of this spec; CC Phase 0 report (2026-09-10, `main` @ `65237e47`); Sol blind review of V1 (Sept 10) and confirmation pass on V1.1 (Sept 12); `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`; `docs/BUILD_RULES.md`. Governing contract: `FANTASYTRADES_PRELAUNCH_SEQUENCE.md`.

**What changed since V1.1** (Sol confirmation pass; all five V1 fixes confirmed holding):
1. **No public ranked backer leaderboard in the beta** (Sol A-1, A-5). Net BP is transferable between controlled identities through the pool itself — coordinated accounts can donate losses to whichever account backed the winner. Net BP and accuracy are private personal stats until a Sybil-resistant score and identity confidence exist.
2. **Trainer backing stats are private to the trainer and labeled research data** (Sol A-3). No ranking, rewards, or matchmaking consequences attach to them.
3. **§8 rewritten honestly.** The wallet is non-transferable; the score is not. The own-pod rule is an account-level boundary, not person-level (Sol A-2). The validity threshold protects pool quality, not integrity (Sol A-4). Fingerprint and admin exclusion are detective controls.
4. **Two sealed-pool honesty rules** (Sol S-1, S-2): the backer is told the payout is unknown until close and moves as others back; every stake is conditional on the pool meeting its minimum, and the strip shows progress toward validity, never a pre-close verdict.

**What changed since V1** (for readers arriving here directly): scope moved from bracket rounds to base-layer group-weeks (`poolId = groupId`); the economy was rebuilt around a weekly expiring allowance with no rake and no carry; the team, not a config hash, is the backed object; plumbing was corrected to the code; the V1 sentence claiming vocabulary keeps the beta outside sweepstakes framing was deleted and pre-flip gates were added.

---

## How to use this document

1. The implementation chat reads this, the Phase 0 report, and the seed set (§12), then runs the **§13 addendum discovery** — read-only, `file:line`, hard STOP.
2. Founder review of the addendum.
3. Phased build per §12, one task = one branch, behind `BACKING_BETA_ENABLED = false`. Separate flip PR, gated by §11.

---

## 0. What this is

A spectator allocates a weekly allowance of **Backing Points** across the League pods they are not seated in, before the week's battles begin. Each pod's stakes form one sealed pot. When the week resolves, backers of the pod's winning team split the pot pro-rata; every other stake is gone. Points are a weekly allowance for the game: they cannot be bought, transferred, or redeemed, and have no cash value. Nothing carries week to week except your own record — net BP — which is private in the beta.

**The beta exists to answer three questions**, read off a funnel (§10): do spectators back teams; does backing make them read the tape; do backers come back. All three are segmented by how many humans sit in the pod.

**Why base layer:** it is the production product — four-seat pods formed by the lobby, Mon–Fri battles, day-5 banking, placements, RP, and the monthly ladder. "Back the pods you're not in this week." The bracket's "eliminated players back the survivors" beat returns for free when brackets go live.

---

## 1. Unit of backing — LOCKED (D-i, D-m, D-b)

- **The team** = one seat in a pod: the player's parallel-layer battle (user layer + agent layer, scored as the existing composite, agent + 1.5 × user). Backers back the composite, never a single layer.
- **Team identity:** `(groupId, playerId, agentId)`. `equippedConfigHash` at stake time is recorded on the stake as **telemetry only** — it is not part of the contract. CPU seats are `cpu-{n}` / `cpu-agent-{n}`; ids recur across pods, so identity is the full tuple, and all CPUs share one hash, so the loadout marker is suppressed for them.
- **One pool per pod per week.** `poolId = groupId`.
- **Resolution** = the pod's week winner by the weekly composite the tournament already computes (the day-5 banked snapshot). No new scoring, no fenced file touched; settlement reads results.
- **CPU teams are backable.** Metrics segment by human count (§10); CPU seats carry no trainer stats and no history.
- **Brackets:** out of scope until a production round-1 writer exists; when it does, bracket pools are the same doc shape keyed by the bracket game id. No spec change expected (§14).

---

## 2. Points economy — LOCKED (D-a, D-f, D-h, D-v)

| Rule | Value |
|---|---|
| Currency | **Backing Points (BP)** — a weekly allowance, not a bankroll |
| Allowance | **1,000 BP per eligible account per backing week**, granted lazily on first wallet touch in that week (`lastAllowanceWeek ≠ current` → grant + ledger entry). No enumeration, no fan-out write. |
| Backing week | The seven days ending **Sunday 23:59 ET**; stakes placed in it target pods whose battles begin the following Monday (assumption confirmed by §13 Q2) |
| Expiry | Unspent allowance expires at the week's close. Nothing carries. **Payouts are score, not spendable balance.** |
| Per-team cap | 500 BP per backer per team |
| Min stake | 50 BP |
| Multi-team | Allowed, including two teams in one pod — a hedge is a scouting decision |
| Score | **Net BP = Σ payouts + Σ refunds − Σ stakes.** Allowance grants and expiries are excluded. Attributed to the ET month of the pod's week, the monthly ladder's key. Negative kept. **Private to the user in the beta** — no public ranking (§8). |
| Value invariants | No purchase. No transfer of spendable BP, direct or mediated. No redemption. No cash value. |

Voided stakes (§3 validity) are score-neutral: the stake and its refund cancel. The BP does not return as spendable because the week has closed.

---

## 3. Pool mechanics — LOCKED (D-d, D-e, D-j, D-n, D-q)

- **Parimutuel, no rake, no counterparty.** `pays × = pot ÷ winning stakes`. Per stake: `payout = floor(stake × pot ÷ winningStakes)`; integer BP; the rounding remainder is burned.

| Team | Staked | Pays × if this team wins (pot 1,200) |
|---|---|---|
| A | 600 | 2.0× |
| B | 300 | 4.0× |
| C | 200 | 6.0× |
| D | 100 | 12.0× |

- **Validity is decided at close, never by the result.** A pool is valid if it has **≥3 unique eligible backers** and **≥2 distinct teams backed**. Otherwise status `insufficient`: every stake is voided. Validity is evaluated before any battle exists and cannot depend on who wins. **The threshold protects pool quality — it prevents accidental thin pools. It is not an abuse control** (§8).
- **Every stake is conditional** and the backer is told so at confirmation: *"Your stake becomes final only if this pool meets its participation minimum at close. Otherwise it is void."* Before close the pool strip shows **progress toward validity** ("backers 2 of 3 · teams 1 of 2"), never a pre-close verdict.
- **A valid pool resolves regardless of winner.** An unbacked winner means every stake is lost. There is no outcome-dependent refund.
- **Ties:** every seat whose stored weekly composite equals the maximum forms **one winning set**; the pot distributes pro-rata across every stake in that set. Advancement's seat-order tiebreak may still name a single advancer; backing does not follow it.
- **Sealed pools.** While the window is open, visible = pot total, unique backer count, progress toward validity, and your own stakes. Per-team shares and pays × are hidden until close, then revealed. No live market to follow, stuff, or snipe.
- **The sealed commitment is stated above Confirm:** *"Your payout isn't known until the pool closes, and it will change as other people back teams."* Dilution after your stake is legitimate parimutuel math; the design owes the backer that sentence.
- **Social proof** is **unique backers per team**, shown only after close. BP share is labeled exactly — "62% of BP in this pool backed them" — never as a crowd probability.
- **No rake, no carry.** Trainers get private, non-spendable stats (§5). Carry returns, if ever, with the real-stakes design.

---

## 4. Window — LOCKED (D-c)

- **Opens** when the pod forms (`forming`), provided at least 24 hours remain before close. Pods formed later get no pool that week. Pools are **materialized lazily** — by the pod-list endpoint or the stake endpoint — with deterministic id `groupId` under a transaction guard, so formation code is not modified. Hash-at-open is captured at materialization.
- **Closes** at **Sunday 23:59 ET** on the server clock, and, as the authoritative belt, the stake endpoint refuses the moment any `agentBattles` doc exists for the pod (`activatedAt`). The clock is the legible deadline; the battle doc is the truth.
- **Drafts are not visible during the window** — close precedes the Monday tick that resolves them. A post-draft window is a later experiment, not a V1 option.
- **No in-week backing.** Live scores are public; backing at Wednesday's leader is a score bet, not a team bet.
- **Loadouts may change nightly during the battle week** (a tournament feature). Pre-confirm disclosure line: *"Loadouts can change nightly during the week."* Results show a **loadout-changed** marker when the hash at settlement differs from hash-at-stake, computed by `currentEquippedConfigHash(agentId)` (built on the non-fenced `buildResolvedAgentManifest`; if its customization kernel proves heavy, fall back to the latest battle's persisted hash and label the marker "as of last deploy"). Disclosure, not contract.
- **The Confirm step carries three lines**, one source each: loadouts can change; payout unknown until close; stake conditional on validity.

---

## 5. Surfaces — the MVP cut (D-l, D-q, D-r, D-t, D-v, D-w)

Build one list, one card, one control, one live card, one results card. Backing is the reason the spectator surface exists; do not polish spectate mode broadly.

- **This week's pods.** A pod source **independent of the viewer's own group** (Phase 0 R6): `tournamentGroups` where status ∈ {forming, active} for the week, via a server pod-list endpoint. The viewer's own pod shows but is not backable. "Backing open" chip on pod cards and the lobby desk.
- **Team Card** (per seat, mounted on `PodRow` and as the Spectate focus panel):
  - Identity — display name (`users/{uid}`), agent name, archetype label via existing helpers, career tier/RP from `tournamentRanks/{odUserId}` (authed-read, no WHY).
  - Record — prior weeks' placements and composites from the rank history (capped 20 events).
  - Loadout summary — archetype, **trait count, rule count**. Counts only: names are concealed on live battles by the P7 allowlist.
  - Tape — the prior week's completed battles via `GET /api/tournament/battle-view` (full WHY unlocks at completion); link into Spectate/Film Room.
  - **"First week — no tape yet"** state when no history exists. CPU seats: archetype only, "CPU — no history."
  - Agent-derived fields come from `api/tournament/team-card.js`, a server projection. **No client read of the `agents` doc.**
- **Stake control.** Presets 100 / 250 / 500, custom amount, per-team cap and allowance shown; the three disclosure lines above Confirm (§4); "Backed" appears only after the client reads back the ledger entry (client-honest, server-authoritative).
- **Pool strip.** Open: pot total, unique backers, progress toward validity, your stakes. Closed: shares and pays × revealed.
- **Your Backing** (Mon–Fri). One card per backed pod: backed team(s), current pod standing from banked days, day N of 5, one tap into the tape via `useSpectatedTournamentBattles(groupId)` for backed pods. Reads existing data; no new scoring path; no in-week stakes.
- **Results card** (after settlement), in the **Spectate final state** — participant `RoundBoundaryView` is not the home. Winner, your stakes, payout, "5 of 9 backers picked them," "62% of BP backed them," loadout-changed marker.
- **My Backing stats — private.** Net BP (season, career), pools backed, pools won, accuracy versus the naive baseline (§10), weeks played. Visible only to the user. **No public ranked leaderboard in the beta** (D-v; rationale in §8).
- **Trainer stats — private to the trainer, labeled "beta stats."** Unique backers on you, BP backed on you, backers' net on you — season and career. Non-spendable, non-ranked, no consequences attach (D-w).
- **Fine print**, one source string: *"Backing Points are a weekly allowance for the game. They can't be bought, transferred, or redeemed, and have no cash value."*
- **Lexicon:** back / backing / backer / pool / pot / pays ×. Guarded by a sibling suite on the `deskHonesty` shape (Phase 0 Q9). Brand discipline; this spec makes no legal claim about it.

---

## 6. Data model — discovery confirms shapes

| Collection | Key fields | Access |
|---|---|---|
| `backingPools/{groupId}` | `status` (open \| closed \| insufficient \| resolving \| resolved \| refunded), `opensAt`, `closesAt`, `weekKey`, `monthKey`, `isDev`, `humanTeams`, `potTotal`, `uniqueBackers`, `teamsBacked` (count, for validity progress), `teams[]` {playerId, agentId, archetypeId, isCpu, hashAtOpen}; revealed at close: `teams[].stakeTotal`, `teams[].backerCount`; at settlement: `winnerPlayerIds[]`, `winningStakes`, `paysX`, `settledAt`, `settlementRef` | authed-read, `write: if false` |
| `backingPools/{groupId}/private/totals` | per-team stake totals and the backers map while sealed | no client read |
| `backingStakes/{stakeId}` | `userId`, `groupId`, `teamPlayerId`, `agentId`, `amount`, `hashAtStake`, `placedAt`, `weekKey`, `requestId`, `status` (live \| voided \| won \| lost), `payout`, `settledAt`, `fingerprint` {ipHash, uaHash}, `excluded` | owner-read, `write: if false` |
| `backingWallets/{userId}` + `entries/{entryId}` | `lastAllowanceWeek`, `allowanceRemaining`, `careerNet`, `seasons.{monthKey}` {net, poolsBacked, poolsWon, weeksPlayed}, `trainerStats` {season, career}; entries: `type` (allowance \| stake \| payout \| refund \| expiry), `delta`, `ref`, `at` | owner-read, `write: if false` |
| `backingEvents/{eventId}` | `userId`, `groupId`, `event`, `at`, `props` | no client read |

- **Ledger-first.** Balances derive from entries and are cached; a mismatch resolves in the ledger's favor.
- **Idempotency keyed by source id**, the house pattern: allowance by `weekKey`, settlement by `groupId`, per-stake status guard, `requestId` on stakes. Whole-doc transactional set.
- **Dev namespace:** `isDev` groups route to `dev-` pool ids and `dev-` wallet entries, exactly as rank and leaderboard do. A dev smoke never touches production net.
- **Rules:** the `tournamentGroups` pattern verbatim; `private` and `backingEvents` unreadable by clients. Rules and indexes deploy manually (Console) — a runbook step, and PR 1's rules are inert until deployed.
- **Indexes** (Console-created, dual-write note per precedent): stakes `(userId, weekKey)`, `(groupId, status)`; groups `(status, weekKey)` for the pod list. No leaderboard index in the beta.
- **Reuses, does not modify:** `tournamentGroups`, `tournamentRanks`, `agents`, `agentBattles`, `users`.

---

## 7. Jobs — zero new crons (D-o)

Cron count is 39 of 40. This feature adds none.

- **Pool open:** lazy materialization (§4). Formation paths untouched.
- **Close, validity, reveal:** one transaction, run lazily on the first read after `closesAt` or by settlement, whichever comes first: `open → closed | insufficient`, copying private totals into the public doc. Idempotent on status.
- **Settlement:** best-effort **co-tenant in the orchestrator's Friday duty**, in the base-group completion path, inside its own per-group try/catch, covered by the `TOURNAMENT_ADVANCEMENT_FROZEN` belt, and **never gating group completion** or any existing side-effect's return value. Keyed on the base-group finality signal named by §13 Q1 — never on `status == complete` alone (training groups complete without a lock) and never on banking. One transaction per pool; per-stake status guard; `resolving` re-reads finality before committing `resolved`.
- **Fallbacks:** lazy settle-on-read (a viewer opens a finalized pod's pool → settle if finality is present), and an admin re-run `POST /api/tournament/backing-settle` on the `run-duty` precedent (cron secret, `simulatedNow`, `sim:` namespace respected).
- **Refund paths:** `insufficient` at close; group `VOIDED` → `refunded`; admin refund for degraded, holiday, or frozen weeks that never lock. Pools may sit unresolved indefinitely; nothing sweeps them — settle-on-read and the admin endpoint are the recovery.
- **Expiry:** implicit. On the next allowance grant, an `expiry` entry records the prior week's unspent remainder so each week's ledger sums to zero.
- None of these writes may block or destabilize the job they ride on.

---

## 8. Integrity — what the rules do and do not do (D-g, D-v, D-w)

**What is protected.**
- **Spendable BP is non-transferable.** No purchase, no transfer, no redemption; allowances expire; payouts are score. The V1 floor-and-carry farming loop no longer exists.
- **Window** enforced server-side: `closesAt` on the server clock plus the battle-doc refusal.
- **One transaction per stake:** read wallet + this backer's existing stakes on the team + pool → check allowance, per-team cap, eligibility, membership, window → write stake, wallet, pool public counters, private totals. `requestId` makes duplicate submissions no-ops; simultaneous submissions serialize on the wallet doc.
- **Sealed pools** remove the live social signal, so there is nothing to stuff or snipe during the window.

**What is not protected, stated plainly.**
- **The score is transferable through the pool.** Coordinated accounts can back the losing teams so that the account backing the winner records their losses as its gain, and with one account per team one of them always wins. Nothing spendable moves; net BP does. **This is why the beta has no public ranked backer leaderboard** (D-v) and why net BP and accuracy are private personal stats. A public ranking requires a score that cannot be inflated by other accounts' losses *and* enough identity confidence to make account-per-person plausible — both post-beta.
- **Own-pod is an account-level rule.** A user seated in a pod cannot stake on any team in it — theirs or their rivals' — checked against the group's `players[]`. It does not stop a person with a second account from backing their own team. It is a sensible boundary, described as one.
- **Validity is a quality floor, not an abuse control.** Three controlled accounts satisfy it immediately, and multi-team backing lets one of them satisfy the two-team condition alone.
- **Social-proof and trainer stats can be inflated** by a few controlled accounts. That is why trainer stats are private and labeled beta stats, why no reward, prestige, or matchmaking consequence attaches to any backing statistic (D-w), and why pool-level counts are treated as research data (§10).

**Detective controls.**
- **Eligibility:** one completed battle on the account, via the existing `ownerId + status + completedAt` index. A speed bump.
- **Fingerprint:** stakes record a hashed IP/UA. An admin `excluded` flag removes a stake from stats and social counts without touching settlement math.
- **Sybil watch:** an admin-only weekly query — pools whose validity depended on fingerprint-sharing accounts, and accounts whose net came predominantly from pools where fingerprint-sharing accounts lost. A report, not a product surface (§10).
- No linked-identity infrastructure exists in the platform (the CPU-farm guard is a rank guard), and none is built here. It is a prerequisite for any public ranking or reward and belongs to a later arc.

---

## 9. Honesty and copy (D-t)

- One fine-print string, one source (§5). The lexicon guard is a build test and a brand rule; it establishes nothing about legal status.
- The Confirm step carries the three disclosure lines (§4). Results and pool copy state exact facts: "62% of BP in this pool backed them," "5 of 9 backers picked them." Never "the crowd had them at 62%."
- The Team Card never claims to show an agent's rules. Counts live; WHY only from completed battle projections.
- The client never asserts a stake or payout before reading the ledger entry.
- Nothing in the product describes any backing statistic as a ranking, reputation, or achievement.

---

## 10. Telemetry and decision rule (D-p)

- **Sink:** `POST /api/backing/event` — auth required, awaited write to `backingEvents`, fixed allowlist: `window_viewed`, `team_card_opened` (dwell ms), `stake_control_opened`, `your_backing_viewed`, `results_viewed`. `stake_confirmed` is written server-side by the stake endpoint, never by the client. No front-end signal seam is reused (the existing one does not persist).
- **Funnel:** window viewed → card opened → stake control opened → stake confirmed → return during week → return next week.
- **Three separate measures**, never merged: unique-backer share per team; BP share; backer accuracy versus a naive baseline (back last week's best placement). All are research data, not reputation.
- **Segmentation:** every measure by human seats per pod (0–4). **Headline numbers come only from pods with ≥2 human teams.**
- **Sybil watch** (§8) runs alongside the funnel; pools and accounts it flags are excluded from headline numbers.
- **Thresholds are provisional**, calibrated after the first two weeks: participation (share of eligible spectators confirming ≥1 stake per week), scouting depth (share of stakes preceded by a card open ≥30s or a battle-view open), retention (weekly return of backers vs non-backers).
- **Decision rule, after four weeks (one monthly ladder):** diagnose by funnel stage. Low participation with healthy card opens points at the stake control or the economy; low card opens point at discovery and the surface; a healthy funnel with weak return points at the Mon–Fri loop. Blame the stage the funnel indicates. No automatic Team Card iteration.

---

## 11. Pre-flip gates (D-s)

1. **Jurisdictional review of the actual points economy** as specified in §2–§3 — allowance, no value path, no prize characteristics, age eligibility, promotional treatment, user flows. This spec describes the economy; it does not conclude anything about its legal status.
2. **18+ enforcement.** §13 Q3 locates the authoritative age/eligibility state; if none exists, the backing feature boundary gets one before flip.
3. **Two unrelated honesty fixes landed first:** fixture `REASONING` text rendering in the unlocked film room on real data (`LeagueSpectate.jsx:109`); the `agents` read rule exposing live rules and traits to any signed-in user (`firestore.rules:224-225`). Separate small tasks, not this arc.
4. **Founder smoke** on a preview URL with a dev pod through open → close → settle → results, in the dev namespace.
5. **Deferral watch:** read the `agent-evaluate` deferral log line during beta week one, per the launch-readiness watch ledger.

---

## 12. Build sequence — one flag, staged PRs

Flag `BACKING_BETA_ENABLED = false` in `featureFlags.js` with a FLIP MAP docstring and `// Pinned by: backingBetaFlags.test.js`; `DARK_BY_DESIGN` entry; call-time reads only; server routes 404 while dark, after auth (the `SHOW_IT_ENABLED` precedent).

**Seed set for the build session** (committed to `main` first, BUILD_RULES §3): this spec; the Phase 0 report; the §13 addendum report; `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`; `docs/BUILD_RULES.md`.

| PR | Contents | Sessions |
|---|---|---|
| 1 | `src/constants/backing.js` (+test: allowance, caps, min, lexicon, the fine-print and three disclosure strings); `api/_utils/backingWallet.js` (+test: lazy weekly allowance, ledger, idempotency, expiry, dev namespace); rules for all four collections and the `private` subcollection; indexes; flag + pin suite + registry; `test/rules/backingDenials.rules.mjs` | 1 |
| 2 | `api/_utils/backingPools.js` (+test: lazy open with hash-at-open, close/validity/reveal transaction, validity progress counters); `api/_utils/backingEligibility.js` (+test: own-pod, one-completed-battle); `api/tournament/backing-stake.js` (+test, +dark test: auth, 404 dark, one transaction, cap/allowance, `requestId`, server-clock window, battle-doc refusal, fingerprint); `api/tournament/backing-pools.js` (pod list + sealed projection) | 1–2 |
| 3 | `api/_utils/backingSettlement.js` (+fixtures: validity, unbacked winner, tie set, rounding, retry mid-settlement, void refund, private stats update); co-tenant hook in the Friday duty's base-group completion path; settle-on-read; `api/tournament/backing-settle.js` admin re-run | 1–2 |
| 4 | `src/components/League/backing/` — `PodList`, `TeamCard`, `StakeControl`, `PoolStrip`, `YourBacking`, `backingCopy.js` + guard suite; `src/services/backingService.js`; `src/hooks/useBackingPool.js`, `useMyBacking.js`; `api/tournament/team-card.js` (+test: projection only); mounts in `LeaguePod.jsx` (PodRow/PodCard/PodSheet), `LeagueSpectate.jsx` (focus panel), lobby and desk chip | 2–3 |
| 5 | `BackingResultsCard`, `MyBackingStats` (private), trainer beta-stats on the player's own rank card or wallet card (private); `api/backing/event.js` + `api/_utils/backingEvents.js`; the Sybil-watch admin query, documented, no surface | 1 |
| Flip | `featureFlags.js` + pin suite + registry in one commit, after every §11 gate | — |

≈ 7–9 sessions. PR 2 and PR 4 exceed 10 files → BUILD_RULES §2 multi-lens review with a vite build. **Fence:** zero fenced files; archetype labels through existing helpers (`leagueAdapter.js` `archetypeLabel`, `tournamentCpu.js` `cpuAgentName`) — a new importer of `agentArchetypeConfig.js` trips the §2.3 import-boundary ratchet. Constants live in a new zero-import module, not `leagueTournament.js` (test-locked shape).

---

## 13. Addendum discovery — read-only, before PR 1

1. **Base-layer finality.** What the Friday duty writes when a base-layer group completes (`tournamentAdvancement.js` :307–361): placements, per-seat weekly composite, timestamps. Is it permanent? Can a completed base group be re-scored? Name the exact signal settlement keys on.
2. **Base-layer pod lifecycle**, for both the lobby path and the live-draft slot path: formation → user draft → agent draft → first battle, with timing relative to the ET week. Does a pod formed mid-week battle that week or the next? This fixes `closesAt`, the 24-hour rule, and the §2 backing-week assumption. Confirm `createdAt` and any `weekKey`/`baseLayerWeek` on group docs.
3. **18+ / eligibility.** Where age or adult eligibility is enforced — signup, terms acceptance, tournament entry — and the authoritative field, if any.
4. **Composite storage.** Where the day-5 banked composite per seat lives on the group doc, and its rounding, for tie equality and settlement reads.
5. **Pod-list query.** Any existing query or index for "this week's forming/active base groups."
6. **Founder-supplied, not code:** expected human seats per pod in the beta population. Sol S2 turns on this number.

---

## 14. Explicitly out of scope (V1)

Money, crypto, tokens, purchasable or redeemable points, rake, carry, **a public ranked backer leaderboard**, **durable trainer reputation or any reward, prestige, or matchmaking consequence tied to backing statistics**, bracket pools (until an R1 production writer exists — then they ride `groupId` with no spec change), live crowd shares, a post-draft window, in-week stakes, a single layer as the backed object, fixed odds, secondary trading of stakes, opt-out from being backed, loadout freeze, external/BYOA agents, linked-identity infrastructure, anything touching the calibration fence.

---

## 15. Rulings ledger — blessed September 10, 2026; D-g amended and D-v, D-w added September 12

| # | Question | Ruling |
|---|---|---|
| D-a | Currency | Backing Points — a weekly allowance, not a bankroll |
| D-b | CPU teams | Backable; metrics segmented; headline only from pods with ≥2 human teams |
| D-c | Window | Opens at formation if ≥24h remain; closes Sun 23:59 ET; hard refusal once any battle doc exists; sealed until close |
| D-d | Rake | None; pays × = pot ÷ winning stakes |
| D-e | Carry | None; trainer stats instead — private, non-ranked (see D-w) |
| D-f | Caps | 1,000 BP per week, unspent expires; 500 per team; multi-team allowed |
| D-g | Eligibility | One completed battle, a speed bump; fingerprint + admin exclusion are detective controls; **no structural alt-resistance is claimed** — the wallet is non-transferable, the score is not (amended Sept 12) |
| D-h | Grant | Lazy 1,000 on first touch each backing week; nothing carries |
| D-i | Scope | Base-layer group-weeks; `poolId = groupId`; brackets ride it later |
| D-j | Ties | Equal-composite seats form one winning set, pro-rata across it |
| D-k | Reads | Authed-read, house pattern |
| D-l | Team Card | Server projections only; "first week — no tape yet" state; disclosure lines at Confirm |
| D-m | Backed object | The team `(groupId, playerId, agentId)`; hash-at-stake is telemetry, not identity |
| D-n | Validity | At close: ≥3 unique backers and ≥2 teams backed, else `insufficient` (stakes voided, zero net); valid pools resolve regardless of winner; a quality floor, not an abuse control; stakes are conditional and say so |
| D-o | Settlement | Best-effort in the Friday duty, own try/catch, never gates completion; settle-on-read + admin re-run |
| D-p | Telemetry | One awaited `backingEvents` endpoint with a fixed allowlist; decide by funnel stage |
| D-q | Social proof | Unique backers is the number, revealed at close; BP share labeled "X% of BP in this pool"; payout-unknown disclosure at Confirm |
| D-r | Live loop | "Your Backing" card Mon–Fri from existing standings and the battle-view poll; no in-week stakes |
| D-s | Pre-flip gates | Jurisdictional review of the actual economy; 18+ gate confirmed or built; the two honesty fixes landed |
| D-t | Copy | Fine print rewritten around value; lexicon guard makes no legal claim |
| D-u | Deferral | Unchanged — watch the deferral log line in beta week one |
| D-v | Ranking | **No public ranked backer leaderboard in the beta.** Net BP and accuracy are private personal stats. A public ranking requires a score other accounts' losses cannot inflate and identity confidence — post-beta (added Sept 12) |
| D-w | Trainer stats | Private to the trainer, labeled beta stats; no ranking, reward, or matchmaking consequence (added Sept 12) |

---

## 16. Sol confirmation pass — result

Received September 12. All five V1 blocker fixes confirmed holding: expiring allowance, validity at close, team as backed object, no rake/no carry, no legal claim. Sealed pools hold, subject to the two disclosure rules now in §3–§4. One new blocker, A-1 (score transferable through the pool), closed by removing the public ranking (D-v) rather than by redesign; A-2 through A-5 closed by the honest rewrite of §8 and D-w. No further Sol pass is scheduled; §8 alone may be re-read if the founder wants strict process.

---

## 17. Review dispositions

| Finding | Disposition |
|---|---|
| Sol V1 — A1, G1, R5, G4, G8 | Closed by §2–§3: expiring allowance, no rake, no carry, net formula defined |
| Sol V1 — A2, G7 | Closed by §3 validity at close |
| Sol V1 — A3 | Closed by §1/§4: team is the backed object; disclosure line; marker is telemetry |
| Sol V1 — A4, A6, R4 | Closed by §3 sealed pools and exact-fact copy |
| Sol V1 — A5 | §8: no cluster exists; described accurately; fingerprint + admin exclusion |
| Sol V1 — S1 | §5 Your Backing |
| Sol V1 — S2 | §10 segmentation |
| Sol V1 — S3, S4, G2 | Moot on base-layer scope; §5 first-week state covers new teams |
| Sol V1 — G3 | Moot with no rake |
| Sol V1 — G5, G9 | §10 three measures, funnel diagnosis |
| Sol V1 — G6 | §3 combined winning set |
| Sol V1 — R1, R2, R3 | §9 legal claim deleted; §5 fine print rewritten; §11 gates |
| Sol V1.1 — S-1 | §3/§4 payout-unknown disclosure |
| Sol V1.1 — S-2 | §3 conditional stakes; validity progress, no pre-close verdict |
| Sol V1.1 — A-1, A-5 | §5/§8 no public ranking; private stats; D-v |
| Sol V1.1 — A-2 | §8 own-pod described as account-level |
| Sol V1.1 — A-3 | §5/§8 trainer stats private, research-labeled; D-w |
| Sol V1.1 — A-4 | §3/§8 validity described as a quality floor |
| Phase 0 — V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V13, V14 | Folded into §1, §4, §6, §7, §12; base-layer scope; `tournamentRanks`; hash marker; flag name; authed-read; projection-only card |
| Phase 0 — V12 | §11 gate 5 |
| Phase 0 — R14 (a)(d) | §11 gate 3, separate tasks |

---

*V1.2 prepared September 12, 2026 from Sol's confirmation pass on V1.1, the Phase 0 report, and the founder's rulings. The League Tournament V2.1 framework remains authoritative for everything it covers.*
