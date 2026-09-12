# FantasyTrades — Backing Beta: Design Spec (V1.3)

**Date:** September 12, 2026
**Status:** Design spec. Founder-blessed rulings D-a through D-z (§15; D-c, D-m, D-o amended Sept 12). Supersedes V1.2. Discovery complete (Phase 0 + addendum). Next: docs-only commit → PR 0 → PR 1.
**Scope:** points-only backing layer on base-layer League group-weeks — lobby pods and Wed/Sat/Sun live-draft slot pods. No money, no crypto, no tokens, no purchasable or redeemable points, no rake, no carry, no public ranking. One feature flag plus one platform-primitive flag, both dark by default.
**Relationship to prior docs:** V1, V1.1, V1.2 of this spec; CC Phase 0 report (`docs/PHASE0_BACKING_BETA_DISCOVERY_20260910.md`, `main` @ `65237e47`); CC addendum report (`docs/audits/2026-09-12_BACKING_BETA_PHASE0_ADDENDUM_DISCOVERY.md`, `main` @ `701859c6`); Sol blind review of V1 and confirmation pass on V1.1; `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`; `docs/BUILD_RULES.md`. Governing contract: `FANTASYTRADES_PRELAUNCH_SEQUENCE.md`.

**What changed since V1.2** (addendum discovery, Sept 12):
1. **Settlement is a predicate, not a lock.** Base-layer completion writes only `status: 'complete'`; the composite of record stays in `dailyScores.day5`. The hook sits after the status transition with its own counter (D-o amended).
2. **Slot pods are in scope with their own close** (D-x). Live-draft slot pods complete their human draft at the slot and their seats are mutable until fire, so their pools close at the fire instant, stakes on departed seats are voided at close, and a deleted doc refunds. The Mon 08:45 slot is excluded.
3. **The team key is `(groupId, odUserId)`** (D-y). A human seat carries no agent id before Monday; `agentId` and the config hash are recorded at settlement from the agent-draft stream.
4. **Eligibility attestation is a build** (D-z). No age, terms, or consent state exists anywhere on the platform, and `users/{uid}` is owner-writable. PR 0 adds a server-written attestation doc as a platform primitive.
5. **Mechanical corrections to the code:** no `active` status exists; the week field is `baseLayerWeek`; the pod list reuses the existing `(baseLayerWeek, updatedAt)` query keyed to the next battle Monday; `closesAt` derives from a Monday date, never from the week label; pools open no earlier than their backing week; refund paths add `expired`, deleted docs, and lingering pods; net BP attributes to the month of the first banked day; settle-on-read and the admin endpoint check the freeze flag themselves; the battle-doc belt also checks `gameMode`.

---

## How to use this document

1. The build session reads this, both discovery reports, and the seed set (§12). Discovery is complete; no further Phase 0 pass is needed unless a PR's own read contradicts a cited line — then STOP and report.
2. Phased build per §12, one task = one branch. PR 0 behind `ELIGIBILITY_ATTESTATION_ENABLED = false`; PR 1–5 behind `BACKING_BETA_ENABLED = false`. Separate flip PR, gated by §11.

---

## 0. What this is

A spectator allocates a weekly allowance of **Backing Points** across the League pods they are not seated in, before those pods' drafts are visible. Each pod's stakes form one sealed pot. When the week resolves, backers of the pod's winning team split the pot pro-rata; every other stake is gone. Points are a weekly allowance for the game: they cannot be bought, transferred, or redeemed, and have no cash value. Nothing carries week to week except your own record — net BP — which is private in the beta.

**The beta exists to answer three questions**, read off a funnel (§10): do spectators back teams; does backing make them read the tape; do backers come back. All three are segmented by how many humans sit in the pod.

**Why base layer:** it is the production product — four-seat pods formed by the lobby (fourth join, "Start now", or Quick Play with three CPUs) or by live-draft slot claims (humans-only until fire), Mon–Fri battles, day-5 banking, placements, RP, and the monthly ladder. "Back the pods you're not in this week." Slot pods matter to the beta: a slot pod with two claims is a two-human pool, which is the population the headline metrics need.

---

## 1. Unit of backing — LOCKED (D-i, D-m, D-y, D-b)

- **The team** = one seat in a pod: the player's parallel-layer battle (user layer + agent layer, scored as the existing composite, agent + 1.5 × user). Backers back the composite, never a single layer.
- **Team identity:** `(groupId, odUserId)`. The group doc carries `players[].odUserId` and no agent id for human seats until Monday's board production, so the agent is not part of the key. At settlement the pool records each team's `agentId` and `equippedConfigHash` from the agent-draft stream, as telemetry and for the loadout marker. The Team Card shows the owner's current agent (owner lookup, clones excluded) as display.
- **CPU seats** are `cpu-{n}`; ids recur across pods, so identity is the full tuple; all CPUs share one hash, so the loadout marker is suppressed for them. On slot pods, CPUs are added at fire and are **not** in the pool (they did not exist during the window).
- **One pool per pod per week.** `poolId = groupId`.
- **Pool teams** are derived from the group's `players[]` at every read while the pool is open (slot-pod seats are mutable until fire) and frozen at close.
- **Resolution** = the pod's week winner by the weekly composite the tournament already computes (the day-5 banked snapshot, read through `getWeeklyComposite`). No new scoring, no fenced file touched.
- **CPU teams are backable** where they are in the pool (lobby pods). Metrics segment by human count (§10); CPU seats carry no trainer stats and no history.
- **Brackets:** out of scope until a production round-1 writer exists; when it does, bracket pools are the same doc shape keyed by the bracket game id.

---

## 2. Points economy — LOCKED (D-a, D-f, D-h, D-v)

| Rule | Value |
|---|---|
| Currency | **Backing Points (BP)** — a weekly allowance, not a bankroll |
| Allowance | **1,000 BP per eligible account per backing week**, granted lazily on first wallet touch in that week (`lastAllowanceWeek ≠ current` → grant + ledger entry). No enumeration, no fan-out write. |
| Backing week | **Monday 00:00 ET through Sunday 23:59 ET, the seven days before a battle Monday.** Every pool belongs to exactly one backing week: the week before its derived battle Monday. Pools open no earlier than their backing week (§4), so every stake on a pool is drawn from the same allowance. |
| Expiry | Unspent allowance expires at the week's close. Nothing carries. **Payouts are score, not spendable balance.** |
| Per-team cap | 500 BP per backer per team |
| Min stake | 50 BP |
| Multi-team | Allowed, including two teams in one pod — a hedge is a scouting decision |
| Score | **Net BP = Σ payouts + Σ refunds − Σ stakes.** Allowance grants and expiries are excluded. Attributed to the ET month of the pod's **first banked day** — the ladder's own key (`monthKeyForGroup`). Negative kept. **Private to the user in the beta** — no public ranking (§8). |
| Value invariants | No purchase. No transfer of spendable BP, direct or mediated. No redemption. No cash value. |

Voided stakes (§3) are score-neutral: the stake and its refund cancel. The BP does not return as spendable because the week has closed.

---

## 3. Pool mechanics — LOCKED (D-d, D-e, D-j, D-n, D-q)

- **Parimutuel, no rake, no counterparty.** `pays × = pot ÷ winning stakes`. Per stake: `payout = floor(stake × pot ÷ winningStakes)`; integer BP; the rounding remainder is burned.

| Team | Staked | Pays × if this team wins (pot 1,200) |
|---|---|---|
| A | 600 | 2.0× |
| B | 300 | 4.0× |
| C | 200 | 6.0× |
| D | 100 | 12.0× |

- **Close is one transaction, in this order:** (1) freeze `teams[]` to the seats present in `players[]` at close (humans only on slot pods); (2) void every stake whose seat is no longer present — score-neutral; (3) evaluate validity on what remains; (4) reveal.
- **Validity is decided at close, never by the result.** A pool is valid if it has **≥3 unique eligible backers** and **≥2 distinct teams backed** after step 2. Otherwise status `insufficient`: every stake is voided. **The threshold protects pool quality — it prevents accidental thin pools. It is not an abuse control** (§8).
- **Every stake is conditional** and the backer is told so at confirmation: *"Your stake becomes final only if this pool meets its participation minimum at close. Otherwise it is void."* Before close the pool strip shows **progress toward validity** ("backers 2 of 3 · teams 1 of 2"), never a pre-close verdict.
- **A valid pool resolves regardless of winner.** An unbacked winner means every stake is lost. There is no outcome-dependent refund.
- **Ties:** two seats are tied iff `getWeeklyComposite(group, a) === getWeeklyComposite(group, b)` — strict equality on the stored `round2` values, no epsilon, no re-rounding, exactly the tournament's own comparator. Every seat in `groupMembers` whose value equals the maximum forms **one winning set**; the pot distributes pro-rata across every stake in that set. Advancement's seat-order tiebreak may still name a single advancer; backing does not follow it. Guard with `Number.isFinite`; never read `dailyScores.day5` raw.
- **Sealed pools.** While open, visible = pot total, unique backer count, progress toward validity, and your own stakes. Per-team shares and pays × are hidden until close, then revealed.
- **The sealed commitment is stated above Confirm:** *"Your payout isn't known until the pool closes, and it will change as other people back teams."*
- **Social proof** is **unique backers per team**, shown only after close. BP share is labeled exactly — "62% of BP in this pool backed them" — never as a crowd probability.
- **No rake, no carry.** Trainers get private, non-spendable stats (§5).

---

## 4. Window — LOCKED (D-c amended, D-x)

- **Battle Monday** is derived from a date, never from the week label (`baseLayerWeek` is a one-way, re-stampable label with no inverse): `battleStartWeek.mondayEtDate` on slot pods; `deriveBattleStartWeek(createdAt)` — the writers' own exported helper — on lobby pods. A holiday Monday moves the first battle to Tuesday; the label and the close do not move.
- **Opens** at the later of pod formation and the backing week's start (Monday 00:00 ET before the battle Monday), **only while the group is `forming`**, and only if at least 24 hours remain before close. Pods that fail the 24-hour test get no pool. Pools are **materialized lazily** — by the pod-list endpoint or the stake endpoint — with deterministic id `groupId` under a transaction guard; formation code is not modified.
- **Closes** at the earlier of:
  - **Sunday 23:59 ET** before the battle Monday (lobby pods), on the server clock; and
  - **the slot's fire instant** (`scheduledDraftAt`) for Wed 19:00, Sat 12:00, and Sun 19:00 slot pods — the moment seats freeze and before any pick is written. The **Mon 08:45 slot is excluded** from V1: its fire is after the Sunday close, and the addendum's N1 note suggests a pod on that slot can play with an empty agent layer (a separate tournament-arc task).
- **Belt:** the stake endpoint refuses the moment any `agentBattles` doc with this `groupId` and `gameMode === 'baggerbomb_tournament'` exists. The clock is the legible deadline; the battle doc is the truth.
- **Drafts are never visible during an open window.** Lobby pods resolve both drafts at Monday's first tick (~07:00 ET), after close; slot pods write their human picks after fire, after close. A post-draft window is a later experiment, not a V1 option.
- **No in-week backing.**
- **Loadouts may change nightly during the battle week.** Pre-confirm disclosure line: *"Loadouts can change nightly during the week."* Results show a **loadout-changed** marker when the hash at settlement differs from the hash recorded when the backer staked (`currentEquippedConfigHash(agentId)` on the owner's current agent, built on the non-fenced `buildResolvedAgentManifest`; fall back to the latest battle's persisted hash if the customization kernel proves heavy, labeled "as of last deploy"). Disclosure, not contract.
- **The Confirm step carries three lines**, one source each: loadouts can change; payout unknown until close; stake conditional on validity.

---

## 5. Surfaces — the MVP cut (D-l, D-q, D-r, D-t, D-v, D-w, D-z)

Build one list, one card, one control, one live card, one results card. Backing is the reason the spectator surface exists; do not polish spectate mode broadly.

- **Eligibility attestation** (PR 0) at the backing entry: a one-time step — 18+ confirmation and beta-terms acceptance — written server-side to `eligibility/{uid}`. The pod list is viewable without it; Confirm requires it. Copy is counsel's (§11 gate 1); the build ships placeholder strings marked for replacement.
- **Upcoming pods.** A server pod-list endpoint keyed to the **next battle Monday's** `baseLayerWeek` (`deriveBaseLayerWeek(deriveBattleStartWeek(now))`; on a Monday before 09:30 ET this names the week whose pools closed last night, which the list shows as closed), reusing the existing `(baseLayerWeek, updatedAt)` query with Admin SDK and in-memory filters: `status === 'forming'` for open pools plus pools already `closed`/`insufficient`/`resolved`; `isDev !== true`; `isTraining !== true`; not `voided`/`expired`. The viewer's own pod shows but is not backable. "Backing open" chip on pod cards and the lobby desk — pointed at the upcoming week, not the field in progress. Slot pods list their current claimants.
- **Team Card** (per seat, mounted on `PodRow` and as the Spectate focus panel):
  - Identity — display name (`users/{uid}`), current agent name and archetype via owner lookup through the server projection, career tier/RP from `tournamentRanks/{odUserId}` (authed-read, no WHY).
  - Record — prior weeks' placements and composites from the rank history (capped 20 events).
  - Loadout summary — archetype, **trait count, rule count**. Counts only.
  - Tape — the prior week's completed battles via `GET /api/tournament/battle-view`; link into Spectate/Film Room.
  - **"First week — no tape yet"** when no history exists. CPU seats: archetype only, "CPU — no history."
  - Agent-derived fields come from `api/tournament/team-card.js`. **No client read of the `agents` doc.**
- **Stake control.** Presets 100 / 250 / 500, custom amount, per-team cap and allowance shown; the three disclosure lines above Confirm; "Backed" appears only after the client reads back the ledger entry.
- **Pool strip.** Open: pot total, unique backers, progress toward validity, your stakes. Closed: shares and pays × revealed.
- **Your Backing** (from close through Friday). One card per backed pod: backed team(s), the pod's picks once written (WHAT — visible after close on both paths), current standing from banked days, day N of 5, one tap into the tape via `useSpectatedTournamentBattles(groupId)`. Reads existing data; no in-week stakes.
- **Results card** (after settlement), in the **Spectate final state**. Winner, your stakes, payout, "5 of 9 backers picked them," "62% of BP backed them," loadout-changed marker.
- **My Backing stats — private.** Net BP (season, career), pools backed, pools won, accuracy versus the naive baseline (§10), weeks played. **No public ranked leaderboard in the beta** (D-v).
- **Trainer stats — private to the trainer, labeled "beta stats."** Unique backers on you, BP backed on you, backers' net on you. Non-ranked, no consequences attach (D-w).
- **Fine print**, one source string: *"Backing Points are a weekly allowance for the game. They can't be bought, transferred, or redeemed, and have no cash value."*
- **Lexicon:** back / backing / backer / pool / pot / pays ×. Guarded by a sibling suite on the `deskHonesty` shape. Brand discipline; this spec makes no legal claim about it.

---

## 6. Data model — shapes confirmed by discovery

| Collection | Key fields | Access |
|---|---|---|
| `eligibility/{uid}` (PR 0) | `adultAttestedAt`, `termsVersion`, `acceptedAt`, `source` | owner-read, `write: if false` |
| `backingPools/{groupId}` | `status` (open \| closed \| insufficient \| resolving \| resolved \| refunded), `formationPath` (lobby \| slot), `slotId`, `battleMondayEtDate`, `backingWeekStart`, `opensAt`, `closesAt`, `closeReason` (clock \| fire), `baseLayerWeek` (copied at open; settlement reads the group's current value), `monthKey` (at settlement), `isDev`, `humanTeams` (at close), `potTotal`, `uniqueBackers`, `teamsBacked`; at close: `teams[]` {odUserId, isCpu, stakeTotal, backerCount}; at settlement: `teams[].agentId`, `teams[].hashAtSettlement`, `winnerOdUserIds[]`, `winningStakes`, `paysX`, `settledAt`, `settlementRef` | authed-read, `write: if false` |
| `backingPools/{groupId}/private/totals` | per-team stake totals and the backers map while sealed | no client read |
| `backingStakes/{stakeId}` | `userId`, `groupId`, `teamOdUserId`, `amount`, `hashAtStake`, `placedAt`, `weekKey` (backing week), `requestId`, `status` (live \| voided \| won \| lost), `voidReason` (seat_left \| insufficient \| group_voided \| group_expired \| group_deleted \| admin), `payout`, `settledAt`, `fingerprint` {ipHash, uaHash}, `excluded` | owner-read, `write: if false` |
| `backingWallets/{userId}` + `entries/{entryId}` | `lastAllowanceWeek`, `allowanceRemaining`, `careerNet`, `seasons.{monthKey}` {net, poolsBacked, poolsWon, weeksPlayed}, `trainerStats` {season, career}; entries: `type` (allowance \| stake \| payout \| refund \| expiry), `delta`, `ref`, `at` | owner-read, `write: if false` |
| `backingEvents/{eventId}` | `userId`, `groupId`, `event`, `at`, `props` | no client read |

- **Ledger-first.** Balances derive from entries and are cached; a mismatch resolves in the ledger's favor.
- **Idempotency keyed by source id**, the house pattern: allowance by backing week, settlement by `groupId`, per-stake status guard, `requestId` on stakes. Whole-doc transactional set.
- **Dev namespace:** `isDev` groups route to `dev-` pool ids and `dev-` wallet entries, as rank and leaderboard do; the pod list excludes dev groups from production viewers (the field does not — D-DEVFIELD).
- **Rules:** the `tournamentGroups` pattern verbatim for pools; the `tournamentRanks` pattern for owner-read server-written docs; `private` and `backingEvents` unreadable by clients. Rules and indexes deploy manually (Console) — a runbook step.
- **Indexes:** **zero new for the pod list** (reuses `(baseLayerWeek, updatedAt)`). Two new composites for stakes, Console-created with the dual-write note: `(userId, weekKey)`, `(groupId, status)`.
- **Reuses, does not modify:** `tournamentGroups`, `tournamentRanks`, `agents`, `agentBattles`, `users`.

---

## 7. Jobs — zero new crons (D-o amended)

Cron count is 39 of 40. This feature adds none.

- **Pool open:** lazy materialization (§4). Formation paths untouched.
- **Close, void, validity, reveal:** one transaction (§3 order), run lazily on the first read after `closesAt` or by settlement, whichever comes first. Idempotent on status. If the group doc is missing at close (last human left a slot pod), the pool is `refunded`.
- **Settlement predicate** — there is no lock record for base-layer groups; the one durable single-doc signal is the terminal status, qualified:

  ```
  group.status === 'complete'
    && group.isTraining !== true      // training pods complete with zero ladder effects
    && group.baseLayerWeek != null    // base layer, not a bracket game
    && isWeekBanked(group)            // day-5 snapshot present (clamped reader)
  ```

  Composites are read through `getWeeklyComposite(group, odUserId)` for every `groupMembers` id. Never key on `status === 'complete'` alone, never on banking, never on the leaderboard's `final` flag (a banking-time flag), never on `updatedAt`. Optional cross-check for the `resolving → resolved` re-read: `tournamentRanks/{rankDocId(seat)}.appliedGroups[groupId]` exists for each seat.
- **Settlement host:** the orchestrator's Friday duty, **after** `transitionStatus(group.id, 'complete')` in the base-group loop, inside the existing per-group try/catch, with **its own catch and its own counter** — never `summary.errors` (that withholds the Friday marker and re-ticks a duty that can no longer see the completed group), and never a third half of `runWeekSideEffects` (that would gate completion on payouts). Covered by the freeze early-return because it sits inside `runFridayAdvancement`. The Monday catch-up and `run-duty` run the same function, so settlement can also land Monday morning.
- **Retries:** the duty never revisits a completed pod, so **settle-on-read and the admin re-run are the only retries.** Both check `TOURNAMENT_ADVANCEMENT_FROZEN` themselves. Admin re-run: `POST /api/tournament/backing-settle` on the `run-duty` precedent (cron secret, `simulatedNow`, `sim:` namespace respected).
- **Refund paths** (`refunded`, all stakes voided, score-neutral): `insufficient` at close; seat left (per stake, at close); group `voided` (reachable only from `battle`, so an in-week event on a closed pool); group `expired` (from `forming`/`drafting`/`awaiting_open`); group doc deleted; a pod that lingers past its Monday (pool closed by clock, no battle doc by Tuesday's tick) — admin refund; degraded, holiday, or frozen weeks that never complete — admin refund. Pools may sit unresolved indefinitely; nothing sweeps them.
- **Expiry:** implicit. On the next allowance grant, an `expiry` entry records the prior week's unspent remainder so each week's ledger sums to zero.
- None of these writes may block or destabilize the job they ride on.

---

## 8. Integrity — what the rules do and do not do (D-g, D-v, D-w, D-z)

**What is protected.**
- **Spendable BP is non-transferable.** No purchase, no transfer, no redemption; allowances expire; payouts are score.
- **Eligibility attestation** is server-written and required at Confirm (PR 0). It is an attestation, not verification; counsel decides whether more is needed before flip.
- **Window** enforced server-side: `closesAt` on the server clock plus the battle-doc belt.
- **One transaction per stake:** read wallet + eligibility + this backer's existing stakes on the team + pool + group → check allowance, per-team cap, eligibility, own-pod membership, that the seat is currently in `players[]`, window → write stake, wallet, pool public counters, private totals. `requestId` makes duplicate submissions no-ops; simultaneous submissions serialize on the wallet doc.
- **Sealed pools** remove the live social signal.

**What is not protected, stated plainly.**
- **The score is transferable through the pool.** Coordinated accounts can back the losing teams so the account backing the winner records their losses as its gain. **This is why the beta has no public ranked backer leaderboard** (D-v). A public ranking requires a score other accounts' losses cannot inflate *and* identity confidence — both post-beta.
- **Own-pod is an account-level rule.** A user seated in a pod cannot stake on any team in it. It does not stop a person with a second account from backing their own team.
- **Validity is a quality floor, not an abuse control.**
- **Social-proof and trainer stats can be inflated** by a few controlled accounts — hence private, research-labeled, no consequences (D-w).

**Detective controls.**
- **Eligibility speed bump:** one completed battle on the account, via the existing `ownerId + status + completedAt` index.
- **Fingerprint:** stakes record a hashed IP/UA. An admin `excluded` flag removes a stake from stats and social counts without touching settlement math.
- **Sybil watch:** an admin-only weekly query (§10). A report, not a product surface.
- No linked-identity infrastructure exists in the platform, and none is built here.

---

## 9. Honesty and copy (D-t)

- One fine-print string, one source (§5). The lexicon guard is a build test and a brand rule; it establishes nothing about legal status.
- The Confirm step carries the three disclosure lines (§4). Results and pool copy state exact facts. Never "the crowd had them at 62%."
- The Team Card never claims to show an agent's rules. Counts live; WHY only from completed battle projections.
- The client never asserts a stake, a payout, or an attestation before reading the server-written doc.
- Nothing in the product describes any backing statistic as a ranking, reputation, or achievement.

---

## 10. Telemetry and decision rule (D-p)

- **Sink:** `POST /api/backing/event` — auth required, awaited write to `backingEvents`, fixed allowlist: `window_viewed`, `team_card_opened` (dwell ms), `stake_control_opened`, `your_backing_viewed`, `results_viewed`. `stake_confirmed` is written server-side by the stake endpoint.
- **Funnel:** window viewed → card opened → stake control opened → stake confirmed → return during week → return next week.
- **Three separate measures**, never merged: unique-backer share per team; BP share; backer accuracy versus a naive baseline (back last week's best placement). All are research data.
- **Segmentation:** every measure by human seats per pod (0–4) and by formation path (lobby / slot). **Headline numbers come only from pods with ≥2 human teams.**
- **Sybil watch** (§8) runs alongside the funnel; flagged pools and accounts are excluded from headline numbers.
- **Thresholds are provisional**, calibrated after the first two weeks.
- **Decision rule, after four weeks:** diagnose by funnel stage. No automatic Team Card iteration.

---

## 11. Pre-flip gates (D-s, D-z)

1. **Jurisdictional review of the actual points economy** (§2–§3) — allowance, no value path, no prize characteristics, age eligibility, promotional treatment, user flows — and **the attestation copy and terms version** PR 0 ships as placeholders. This spec describes the economy; it does not conclude anything about its legal status.
2. **Eligibility attestation built and deployed** (PR 0 merged, `eligibility` rules deployed, counsel's copy in place). No age, terms, or consent state existed on the platform before this; the same primitive is available to tournament entry later.
3. **Two unrelated honesty fixes landed first:** fixture `REASONING` text in the unlocked film room (`LeagueSpectate.jsx:109`); the `agents` read rule exposing live rules and traits to any signed-in user (`firestore.rules:224-225`).
4. **Founder smoke** on a preview URL with a dev pod through attest → open → close → settle → results, in the dev namespace (note D-SEEDWEEK: the dev seeder stamps the formation week, so the smoke's pod must be seeded for the upcoming week).
5. **Deferral watch:** read the `agent-evaluate` deferral log line during beta week one.

---

## 12. Build sequence — two flags, staged PRs

**Flags.** `ELIGIBILITY_ATTESTATION_ENABLED = false` (PR 0, platform primitive) and `BACKING_BETA_ENABLED = false` (PR 1–5), each in `featureFlags.js` with a FLIP MAP docstring and a `// Pinned by:` comment, a `DARK_BY_DESIGN` entry, a pin suite, call-time reads only; server routes 404 while dark, after auth (the `SHOW_IT_ENABLED` precedent). The flip PR flips both after every §11 gate.

**Seed set for build sessions** (all on `main`, BUILD_RULES §3): this spec; `docs/PHASE0_BACKING_BETA_DISCOVERY_20260910.md`; `docs/audits/2026-09-12_BACKING_BETA_PHASE0_ADDENDUM_DISCOVERY.md`; `FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md`; `docs/BUILD_RULES.md`.

| PR | Contents | Sessions |
|---|---|---|
| 0 | **Eligibility attestation.** `src/constants/eligibility.js` (`TERMS_VERSION`, attestation copy strings as placeholders marked `COUNSEL: replace before flip`); `api/_utils/eligibility.js` (`getEligibility`, `requireEligibility`); `api/eligibility/attest.js` (POST; `requireAuth`; 404 while dark after auth; body `{ adultAttested: true, termsVersion }` validated against `TERMS_VERSION`; server writes `eligibility/{uid}` `{ adultAttestedAt, termsVersion, acceptedAt, source }`; idempotent — an existing doc is returned unchanged); rules `match /eligibility/{userId}` owner-read, `write: if false`; `test/rules/eligibilityDenials.rules.mjs`; endpoint tests (auth, dark 404, validation, idempotency, write shape); flag + pin suite + registry. No UI in PR 0 — the attestation step lands in PR 4 at the backing entry. | ½–1 |
| 1 | `src/constants/backing.js` (+test: allowance, caps, min, lexicon, the fine-print and three disclosure strings); `api/_utils/backingWallet.js` (+test: lazy weekly allowance, ledger, idempotency, expiry, dev namespace); `api/_utils/backingWeek.js` (+test: backing-week bounds and `closesAt` from a Monday date via `deriveBattleStartWeek`/`battleStartWeek.mondayEtDate`; slot fire close; 24-hour rule; Mon 08:45 exclusion); rules for the four backing collections and `private`; the two stake indexes; flag + pin suite + registry; `test/rules/backingDenials.rules.mjs` | 1 |
| 2 | `api/_utils/backingPools.js` (+test: lazy open, live `teams[]` derivation, the close transaction in §3 order, deleted-doc refund); `api/_utils/backingEligibility.js` (+test: own-pod, seat-present, one-completed-battle, attestation via `requireEligibility`); `api/tournament/backing-stake.js` (+test, +dark test: auth, 404 dark, one transaction, cap/allowance, `requestId`, server-clock window, battle-doc belt with `gameMode`, fingerprint); `api/tournament/backing-pools.js` (pod list keyed to the next battle Monday, reusing the `(baseLayerWeek, updatedAt)` query with in-memory filters; sealed projection) | 1–2 |
| 3 | `api/_utils/backingSettlement.js` (+fixtures: the predicate, unbacked winner, tie set, rounding, retry mid-settlement, each refund path, `agentId`/hash from the draft stream); the co-tenant hook after the status transition in the base-group loop with its own counter; settle-on-read; `api/tournament/backing-settle.js` admin re-run with its own freeze check | 1–2 |
| 4 | `src/components/League/backing/` — `AttestationStep`, `PodList`, `TeamCard`, `StakeControl`, `PoolStrip`, `YourBacking`, `backingCopy.js` + guard suite; `src/services/backingService.js`; `src/hooks/useBackingPool.js`, `useMyBacking.js`, `useEligibility.js`; `api/tournament/team-card.js` (+test: projection only, owner lookup); mounts in `LeaguePod.jsx`, `LeagueSpectate.jsx` (focus panel), lobby and desk chip pointed at the upcoming week | 2–3 |
| 5 | `BackingResultsCard`, `MyBackingStats` (private), trainer beta-stats (private); `api/backing/event.js` + `api/_utils/backingEvents.js`; the Sybil-watch admin query, documented, no surface | 1 |
| Flip | Both flags, pin suites, and registry entries in one commit, after every §11 gate | — |

≈ 8–10 sessions. PR 2 and PR 4 exceed 10 files → BUILD_RULES §2 multi-lens review with a vite build. **Fence:** zero fenced files; archetype labels through existing helpers; a new importer of `agentArchetypeConfig.js` trips the §2.3 ratchet. Constants live in new zero-import modules, not `leagueTournament.js`. The Monday-date helper pair is imported from `api/_utils/liveDraftFormation.js`, not reimplemented.

---

## 13. Discovery status

Phase 0 (Sept 10) and the addendum (Sept 12) are complete; every §13 question of V1.2 is answered in the addendum report. **One item is founder-supplied and still open:** expected human seats per pod in the beta population, by formation path. It does not block the build; it sets expectations for §10's headline numbers.

---

## 14. Explicitly out of scope (V1)

Money, crypto, tokens, purchasable or redeemable points, rake, carry, a public ranked backer leaderboard, durable trainer reputation or any consequence tied to backing statistics, the Mon 08:45 slot, bracket pools (until an R1 production writer exists), live crowd shares, a post-draft window, in-week stakes, a single layer as the backed object, fixed odds, secondary trading of stakes, opt-out from being backed, loadout freeze, external/BYOA agents, linked-identity infrastructure, age verification beyond attestation, anything touching the calibration fence.

---

## 15. Rulings ledger

Blessed September 10; D-g amended and D-v, D-w added September 12 (Sol confirmation); D-x, D-y, D-z added and D-c, D-m, D-o amended September 12 (addendum).

| # | Question | Ruling |
|---|---|---|
| D-a | Currency | Backing Points — a weekly allowance, not a bankroll |
| D-b | CPU teams | Backable where in the pool (lobby pods); slot-pod CPUs added at fire are not; metrics segmented |
| D-c | Window | Opens at the later of formation and the backing week's start, only while `forming`, if ≥24h remain; closes at the earlier of Sunday 23:59 ET before the derived battle Monday and the slot fire instant; battle-doc belt with `gameMode`; sealed until close (amended Sept 12) |
| D-d | Rake | None; pays × = pot ÷ winning stakes |
| D-e | Carry | None; trainer stats instead — private, non-ranked (D-w) |
| D-f | Caps | 1,000 BP per week, unspent expires; 500 per team; multi-team allowed |
| D-g | Eligibility | One completed battle, a speed bump; fingerprint + admin exclusion are detective controls; no structural alt-resistance is claimed |
| D-h | Grant | Lazy 1,000 on first touch each backing week; nothing carries |
| D-i | Scope | Base-layer group-weeks; `poolId = groupId`; brackets ride it later |
| D-j | Ties | Strict equality on stored `round2` composites via `getWeeklyComposite`; equal seats form one winning set, pro-rata across it |
| D-k | Reads | Authed-read, house pattern |
| D-l | Team Card | Server projections only; "first week — no tape yet"; disclosure lines at Confirm |
| D-m | Backed object | The team `(groupId, odUserId)`; `agentId` and hash recorded at settlement from the draft stream; hash-at-stake is telemetry (amended Sept 12) |
| D-n | Validity | At close, after seat voids: ≥3 unique backers and ≥2 teams backed, else `insufficient`; valid pools resolve regardless of winner; a quality floor; stakes are conditional and say so |
| D-o | Settlement | Keyed on the four-part predicate; hook after the status transition in the base-group loop with its own catch and counter; settle-on-read and admin re-run are the only retries, each with its own freeze check (amended Sept 12) |
| D-p | Telemetry | One awaited `backingEvents` endpoint with a fixed allowlist; decide by funnel stage |
| D-q | Social proof | Unique backers, revealed at close; BP share labeled exactly; payout-unknown disclosure |
| D-r | Live loop | "Your Backing" from close through Friday; picks shown once written; no in-week stakes |
| D-s | Pre-flip gates | Jurisdictional review; attestation built and deployed; the two honesty fixes landed |
| D-t | Copy | Fine print rewritten around value; lexicon guard makes no legal claim |
| D-u | Deferral | Watch the deferral log line in beta week one |
| D-v | Ranking | No public ranked backer leaderboard in the beta; net BP and accuracy are private |
| D-w | Trainer stats | Private, labeled beta stats; no consequences |
| D-x | Slot pods | Wed/Sat/Sun slots in scope; pool closes at fire; stakes on departed seats voided at close; deleted doc → `refunded`; fire-time CPUs not in the pool; Mon 08:45 excluded (added Sept 12) |
| D-y | Team key | `(groupId, odUserId)`; `agentId` and hash at settlement; Team Card shows the current agent as display (added Sept 12) |
| D-z | Eligibility gate | Server-written `eligibility/{uid}` attestation, one endpoint, write-false rules; PR 0, fence-free, a platform primitive; copy from counsel (added Sept 12) |

---

## 16. Reviews — status

Sol blind review of V1 (Sept 10) and confirmation pass on V1.1 (Sept 12): all five V1 blocker fixes hold; A-1 closed by D-v. No Sol pass is scheduled for V1.3: its changes are plumbing and one scoping call, and the economy Sol confirmed is unchanged.

---

## 17. Review dispositions

| Finding | Disposition |
|---|---|
| Sol V1 — A1, G1, R5, G4, G8 | §2–§3: expiring allowance, no rake, no carry, net formula |
| Sol V1 — A2, G7 | §3 validity at close |
| Sol V1 — A3 | §1/§4: team is the backed object; disclosure; marker is telemetry |
| Sol V1 — A4, A6, R4 | §3 sealed pools; exact-fact copy |
| Sol V1 — A5 | §8 described accurately; fingerprint + admin exclusion |
| Sol V1 — S1 / S2 / S3, S4, G2 / G3 / G5, G9 / G6 / R1, R2, R3 | §5 Your Backing / §10 segmentation / moot on base layer / moot with no rake / §10 measures and funnel / §3 winning set / §9, §5, §11 |
| Sol V1.1 — S-1, S-2 | §3/§4 disclosures; validity progress |
| Sol V1.1 — A-1, A-5 / A-2 / A-3 / A-4 | D-v / §8 account-level / D-w / §3 quality floor |
| Phase 0 — V1–V14 | Folded into §1, §4, §6, §7, §12 |
| Addendum — A1, A2, A-C7, A-C13 | §7 predicate, hook placement, retries, freeze checks (D-o) |
| Addendum — A3, A-C1, A-C2, A-C8 | §1, §3, §4, §7: slot pods, close at fire, seat voids, refund paths (D-x) |
| Addendum — A4, A-C3 | §5/§7 real statuses; "backing open" = `forming` |
| Addendum — A5, A-C11, N5 | PR 0 eligibility attestation (D-z); §11 gates 1–2 |
| Addendum — A6 | §3 tie equality via `getWeeklyComposite` |
| Addendum — A7, A-C4, A-C10, N3 | §5/§6 pod list on the existing query, next-Monday key, dev exclusion, zero new indexes |
| Addendum — A8, A-C6, N4 | §2/§4 backing week bounds; `closesAt` from a Monday date; lingering-pod refund |
| Addendum — A9, A-C5 | §1 team key `(groupId, odUserId)`; `agentId` at settlement (D-y) |
| Addendum — A-C9 | §2 month attribution wording |
| Addendum — A-C12 | §4 belt checks `gameMode` |
| Addendum — A-C14 | §6 dev exclusion in the pod list |
| Addendum — N1 | Mon 08:45 slot excluded (D-x); separate tournament-arc discovery task |
| Addendum — N2 | §11 gate 4 smoke note (D-SEEDWEEK) |

---

*V1.3 prepared September 12, 2026 from the addendum discovery report and the founder's rulings of the same day. The League Tournament V2.1 framework remains authoritative for everything it covers.*
