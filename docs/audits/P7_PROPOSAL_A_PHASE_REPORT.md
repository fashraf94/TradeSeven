# P7 — Proposal A (Tournament Battle View): Phase Report

**Phase:** P7, Proposal **A only** (the founder split: A / B+C — **build A first on this branch; B+C cut fresh after A merges**).
**Branch:** `claude/stoic-lovelace-injr62` · cut from `main` (origin/main `dd74246`, ancestor) · base HEAD `e5a5770` (post-P6b) · tip `cc57be1`.
**Date:** June 13, 2026.
**Stage 0 artifact:** `P7_STAGE0_REPORT.md` (this session) — proposals A–D + the split, ratified: split A / B+C; A enrichment = fresh node-clean util calling `calculateAssetScoreV3`; B/C/D confirmed (D deferred to P8); FLAT6_TIERS stopgap stays; per-pick flip-cap wording is a P8 spec fix.

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | The flat6 battle view exists, replacing P6b's degrade? | **YES** — `Flat6BattleView`, its own component; `SpectatorView`'s "full battle view arrives with…" degrade is gone. |
| 2 | Participant + spectator modes? | **YES** — participant reads own battle live (onSnapshot, owner-scoped rule); spectator reads any agent via the projecting endpoint. |
| 3 | Live WHY concealed SERVER-SIDE for non-owner active reads (founder ruling)? | **YES** — allowlist projection at the read boundary; full WHY at completion. **Zero firestore-rule change.** |
| 4 | Scorer reused, not copied (BUILD_RULES §4)? | **YES** — the enrichment util CALLS `calculateAssetScoreV3`; locked by a scorer-parity test. |
| 5 | Live tiered BaggerBomb screen untouched? | **YES** — `AgentBattleScreen` not edited; the FLAT6_TIERS stopgap left in place per founder. |
| 6 | Zero fence contact / zero new cron / zero new rules? | **YES** (38/40 cron; no `firestore.rules` change; no fenced file edited). |
| 7 | Tokens-native, reduced-motion-aware, flag-gated? | **YES** — `useTheme().tokens` only (12 valid keys); `useReducedMotion` gates every animation; all behind `TOURNAMENT_TAB_ENABLED` (still false). |
| 8 | `/code-review` (mandatory at 12 files) at max effort? | **RUN** — 2 WHY-leaks + 4 lower-severity findings fixed; dispositions in §5. |
| 9 | Tests | **2,691 passing** (2,688 prior + 3 added net; 29 new across the three P7 batteries); client build clean. |
| 10 | Lint | Delta = **one baseline-class flag** (`motion` JSX-member false positive, identical to `DraftPlaybackTheater`/`DataStrike`). |

---

## 2. What the founder should know in three sentences

The tournament battle view is real: your agent's six holdings render in the 2/2/2 lineup with live prices, an animated running score, the agent's live read, the double-down moment, and no phantom opponent — and at the day's end it says "banked for the composite," not win/loss, because the composite in the standings is the score of record. Spectating any agent works the same way, but the agent's live *reasoning* is concealed **on the server** (a spectator literally never receives it over the wire) until the battle completes, when it opens to everyone as the Film Room — the open-cards-at-completion contract, enforced where it can't be bypassed. It mounts on the dev screen now (participant card + the upgraded spectator drill) and is wired into the League home for P9's flag flip; B (claim/flip window) and C (round-boundary flow) are the next branch.

---

## 3. The Stage-A mechanism (surfaced as instructed)

The founder approved relaxing the read rule for tournament battles **with the requirement that live WHY be concealed server-side, not by client non-render.** Those two are only jointly satisfiable one way: a relaxed rule + a direct client Firestore read returns the *whole* doc (WHY included) over the wire — a client can read it in devtools regardless of what the component renders. So I chose the **thin read path**:

- `api/tournament/battle-view.js` (GET, authed) reads the group's battles via the **Admin SDK** (rule-exempt) and returns each one **projected for the requester**.
- `api/_utils/tournamentBattleView.js` `projectTournamentBattle(battle, {isOwner})`: owner OR completed → full doc; **non-owner + active → an ALLOWLIST projection** (only the public WHAT keys survive; everything else — reasoning, strategy surface, swap-candidate watchlist — is concealed by default), stamped `_whyConcealed`.
- The client never reads another player's battle doc directly → **the owner-private `agentBattles` rule is unchanged** (the P7 Stage-0 "zero new rules" erratum resolved the clean way; the rule relaxation became unnecessary and undesirable).

**Allowlist, not denylist (the code-review correction):** the first cut used a denylist and leaked the agent's `watchlist` (swap candidates) and `agentContext` strategy fields (`activeRules`, `deployedGuardrails`, `equippedWatchlist`, `riskTolerance`) the moment the doc shape exceeded the list. The allowlist makes new fields concealed by default — the right depth.

---

## 4. What shipped (file:line at tip `cc57be1`)

**Data layer (node-clean, the testable seam)**
- `src/utils/flat6BattleEnrichment.js` — `enrichFlat6Asset` (mirrors the live `enrichAsset` glue for the long path, byte-identical; CALLS `calculateAssetScoreV3`; agents long-only so the latent short double-negation the live screen carries is deliberately NOT reproduced), `buildFlat6BattleModel` (2/2/2 `Lineup 1–2/3–4/5–6` slots, active+banked running score, optional `isActivationDay` override), `resolveDisplayScore` (rounded), `flat6BattleSymbols`, `isFlat6ActivationDay`.

**Server projection (the WHY boundary)**
- `api/_utils/tournamentBattleView.js` — `projectTournamentBattle` (allowlist), `pickCurrentBattlesByOwner` (delegates to the shared selector).
- `api/tournament/battle-view.js` — the GET endpoint (auth, groupId validation, tournament-only scoping, per-viewer projection).
- `src/constants/leagueTournament.js` — `pickCurrentTournamentBattle` (ONE home for the active-else-latest selection).

**Component + hooks**
- `src/components/Tournament/Flat6BattleView.jsx` — the view (header + animated score via `DataStrike`, composite context link to standings, six holdings with per-asset price/Δ%/points/badges/threshold bar, live feed, WHY section gated owner/at-completion/concealed, double-down beat, completion state). Tokens-native, `useReducedMotion`, teal you-highlight.
- `src/hooks/useMyTournamentBattle.js` — participant (own battle onSnapshot).
- `src/hooks/useSpectatedTournamentBattles.js` — spectator (polls the endpoint, 60s, per-run race guard).

**Wiring**
- `src/components/Tournament/SpectatorView.jsx` — degrade (`:97-129`) replaced with a player selector + `Flat6BattleView` spectator mode.
- `src/screens/LeagueScreen.jsx` — participant battle view in the battle-week region; composite context from `getWeeklyComposite`/`getWeeklyScore`.
- `src/screens/TournamentDevScreen.jsx` — participant smoke card.

**Tests (29 new)** — `flat6BattleEnrichment.test.js` (12: slot labels, flat scoring, scorer-parity, no-double-negation, banked, activation-day, display-score), `tournamentBattleView.test.js` (11: owner/completion full, non-owner allowlist incl. watchlist + agentContext leaks closed, no-mutation, per-owner pick), `battle-view.test.js` (6: gates, scoping, per-viewer projection), + 3 in `leagueTournament.test.js` (the shared selector).

---

## 5. /code-review (max effort) — findings + dispositions

**Fixed:**
1. **WHY leak — top-level `watchlist`** (the agent's swap-candidate universe) survived the denylist → **refactored to allowlist.** (Severe.)
2. **WHY leak — `agentContext` strategy fields** (`activeRules`/`deployedGuardrails`/`equippedWatchlist`/`riskTolerance`) survived → **allowlist** (+ statusFeed/trades sub-allowlist drops `trade_reasoning`/Forge citations). (Severe.)
3. **Spectator-poll stale-fetch race** — a shared `cancelledRef` reset to false on every effect run let an old-groupId fetch clobber the new group → **per-run `active` flag, fetch inlined in the effect; `refresh` (unused) dropped.**
4. **Headline-score precision** — a fractional persisted cron score rendered un-rounded next to rounded live points → **`Math.round` in `resolveDisplayScore`.**
5. **Activation-day memo staleness** — `Date.now()` captured inside a price-keyed memo → **stable per-render `isActivationDay` boolean passed in as a dep.**
6. **`effectivePrices` recompute churn** — unconditional spread recomputed on empty WS flushes → **return `currentPrices` unchanged when WS empty (live-screen parity).**

Also: converged the duplicated current-battle selection into `pickCurrentTournamentBattle`; bumped the spectator poll 30s→60s (matches cron cadence).

**Verified won't-fix (with mechanism):** the falsy-zero `||` chains in the enrichment (intentional parity with the live `enrichAsset` — 0 is not a valid price/threshold/swapPrice); the `expiresAt`-vs-`status` 'Live' badge (keys on the authoritative `status`, matching the live screen — a brief pre-completion window is acceptable); `odUserId`↔`ownerId` key coupling in the spectator selector (verified consistent for humans AND CPUs — `cpu-N` on both sides).

---

## 6. Guardrails / deploy status (house shape)

- **Cron:** none added — **38/40.**
- **Firestore rules:** **none added/changed** — spectator reads go through the projecting endpoint (Admin SDK), not a relaxed client rule. **No Console deploy required for this branch.**
- **Fence:** zero contact — the scorer `calculateAssetScoreV3` is *called*; no fenced file edited. Snake Draft engine untouched.
- **Flag:** `TOURNAMENT_TAB_ENABLED` stays **false** — League-home wiring is dormant until P9; smokable today on the dev screen.
- **Pushed ≠ deployed:** Vercel preview is the smoke surface; no PR created (awaiting founder direction).

---

## 7. Founder smoke (dev screen / preview)

1. **Participant** — attach your dev group; the participant battle-view card shows your agent's six holdings live (prices, Δ%, points, badges, running score), your live read, the composite-context line linking to standings; on a completed dev battle it shows "banked … for the composite" (no W/L).
2. **Spectator** — open the leaderboard row → SpectatorView → "Open battle view" → pick a CPU's seat: you see its positions/score/feed live, but "the agent's live reasoning unlocks at completion (Film Room)"; on a completed CPU battle, the reasoning appears.
3. **WHY concealment proof** — while a CPU battle is active, inspect the `/api/tournament/battle-view` response for that seat: `_whyConcealed: true`, no `evaluations`/`innerMonologue`/`watchlist`/`agentContext.activeRules`.

---

## 8. Hand-off — B + C (next branch, fresh off main after A merges)

- **B — nightly claim/flip window** over `place-claim`/`flip` (client-honest/server-authoritative; per-pick flip counter; honest 09:24 ET claim countdown; double-down `formed`/`broken`/`flipped` via `feedEventText`/`GroupFeed`). First client mutation callers — new service module (NOT the reads-only `tournamentGroupService`).
- **C — weekend round-boundary flow** (read-composition over bracket/rank docs; advancer → reopened board commit; eliminated → end-of-run; champion → recap). New `COMPLETE`-branch in `LeagueScreen`.
- **D — Catalog #9** deferred to P8 (Pattern-A field-spread on the awaited `api/agent/chat.js` review write; "re-cadence vs tag-only" to settle at the P8 walk).

*Out-of-task observation (BUILD_RULES §3, report-don't-fix): the live `AgentBattleScreen.enrichAsset` carries a dormant short double-negation (pre-negates priceChange AND passes `direction` to the scorer, which negates again) — unreachable for agents (long-only), but worth separate tasking if user-layer shorts ever route through that screen.*
