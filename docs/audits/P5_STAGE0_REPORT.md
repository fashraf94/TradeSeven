# P5 — Stage 0 Verification + Three Proposals (HARD STOP)

**Phase:** P5 — Draft Systems: Playback Theater · Board-Commit Surface · Deadline Auto-Commit
**Branch:** `claude/dreamy-carson-nqrf2h` · HEAD `0e714dd686ad850948071f4119731780fc1d42a5` (= current `origin/main`, PR #491 merge) · working tree clean
**Date:** June 12, 2026
**Preamble (BUILD_RULES §3):** read-only session; one `git fetch origin main` performed to refresh a stale local remote ref (recorded here as required). No writes, no fence contact, no edits of any kind.

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | Stream shape parity (user vs agent draft streams)? | **HOLDS** — event-level fields identical; agent events carry one extra field (`agentId`). One parser works. No drift, no stop needed. |
| 2 | Board-commit service reusable by the new surface? | **YES** — `buildBoardCommit` is the one shared core by design; the endpoint is transport-only; re-commit-while-forming is already the contract. |
| 3 | Client prefill located; server twin feasible? | **YES** — with one wrinkle: the pool intersection lives in the *consumer* (BoardEditor), not the prefill function. The shared core must own it so the twins can't fork. |
| 4 | Monday defer point located? | **YES** — one catch block in the Monday pipeline; the auto-commit replaces exactly it. |
| 5 | Tab shell ready to receive the surfaces? | **YES** — flag-gated route + nav slots exist; the screen is a placeholder to be replaced. |
| 6 | Snake Draft components reusable? | **PATTERNS YES, IMPORTS MOSTLY NO** — motion language is extractable; the components themselves are styled in hardcoded `HOLO_COLORS`, which collides with this phase's tokens-native guardrail (see surprise S3). Zero protected-core contact either way. |
| 7 | Dev-group streams exist for first real playback data? | **YES (per P4 record)** — the P4 Stage A smoke ran the full Monday duty on the seeded dev bracket; both stream writers are verified at HEAD. Firestore itself is not readable from this session. |
| 8 | Any stop-and-report condition? | **NO.** Five surprises, all workable, listed in §3. |

---

## 2. Verification at HEAD (all items VERIFIED in this session unless marked)

### 2.1 The two draft event streams — shape parity, field by field

**User stream writer** — `api/tournament/resolve-user-draft.js`:
- Event assembly at `:116`: `{ pickNumber, round, odUserId, symbol, boardRank, fallback, passedOver }`.
- `passedOver` (`:93–99`): names ranked above the selection already taken **by others**; own earlier picks advance the pointer silently.
- `fallback` (`:108–111`): board exhausted → highest-ranked remaining `userPool` name (pool stored in ranked order, `:62`); `boardRank` stays `null` on fallback.
- Stream doc at `streams/userDraft` (`:173–177`): `{ events, roundNumber, resolvedAt }` — written in the **same transaction** as the group mutation (rider #3, user side).

**Agent stream writer** — `api/_utils/tournamentAgentDraft.js`:
- Event assembly at `:149`: `{ pickNumber, round, agentId, odUserId, symbol, boardRank, fallback, passedOver }`.
- Same passed-over semantics (`:126–138`, own-pick silent advance at `:130`); same fallback semantics (`:140–144`, archetype-ranking fallback, `boardRank` null).
- Stream doc at `streams/agentDraft` (`:274–283`): `{ events, picksByAgent, roundNumber, bracketGameId | baseLayerWeek, resolvedAt }`.

**Parity verdict: HOLDS at the event level.** All seven shared fields are identical in name, type, and semantics; the agent event is a strict superset adding `agentId`. Doc-level shapes differ (agent doc adds `picksByAgent` + round metadata; user doc has neither) — irrelevant to a single event parser, noted for the reader module. **Not a stop condition.**

Two adjacent facts the playback can use, verified:
- Agent board docs carry `rationale` (per-symbol one-liners, ≤200 chars) and `userPicksStance` (≤280 chars, explicitly authored as "model-authored playback copy" — `api/_utils/tournamentAgentBoards.js:58–60`), plus `userPicksAtBoardTime` so playback "never needs a cross-doc time join" (`:262–265`).
- A client subscription for the agent stream already exists: `subscribeAgentDraftStream` (`src/services/tournamentGroupService.js:88–96`). **No user-stream client read exists yet** (additive work).

### 2.2 Board-commit service path (P1a)

- `buildBoardCommit` — `api/_utils/tournamentBoards.js:68–102`: validates membership + `forming` status (`:69–71`), normalizes symbols, enforces depth `BOARD_DEPTH_MIN..MAX` (`:74–77`), dedupe (`:78–80`), in-pool (`:81–85`); assembles the rider-#1 doc with `prefillAsSuggested` snapshot + `delta`.
- `computeBoardDelta` — `tournamentBoards.js:43–62`: kept/reordered/removed/added, pure.
- Endpoint `api/tournament/commit-board.js:35–88`: auth + transaction + `tx.set(boards/{uid})`. **Re-commit while forming is the documented contract** — "Commits (or re-commits, while the group is still forming — last commit wins)" (`:3–5`); BoardEditor already renders a "Re-commit board" button (`src/components/Tournament/BoardEditor.jsx:202`). This answers proposal C's edit-window question affirmatively at the code level.
- The module header (`tournamentBoards.js:3–7`) names "the P3 orchestrator later" as an intended producer through this same core — the auto-commit caller was anticipated by design.

### 2.3 Client prefill derivation + what the server twin reuses

- `assembleBoardPrefill(uid)` — `src/services/tournamentGroupService.js:151–193`: (1) `agents` where `ownerId == uid` limit 1; (2) `watchlists/{agent.equippedWatchlistId}.tickers[].symbol`; (3) `voiceLayerCache/{agent.activeBattleId}.scoutAlerts[].symbol`; merged equipped-then-alerts via `cleanSymbols` (`:128–138` — trim/uppercase/dedupe), sliced to `BOARD_DEPTH_MAX`. Every source degrades silently to empty (`:148–149`).
- **The ∩ `userPool` step is NOT here** — it lives in the consumer: `BoardEditor.jsx:47` (`suggested.filter(s => pool.has(s))`), and the pool-filtered list is also what becomes the `prefillAsSuggested` snapshot (`:49–50`).
- Server-side building blocks that already exist for the twin: agent-by-owner Admin-SDK lookup (`api/_utils/tournamentAgentBoards.js:303–317`, explicitly citing `assembleBoardPrefill` as its precedent); equipped-watchlist Admin-SDK read via `resolveEquippedWatchlist` / `extractTickerSymbols` (`tournamentAgentBoards.js:454–468`, from `api/_utils/watchlistEquip.js`). Only the `voiceLayerCache` scout-alerts read has no server precedent — a three-line sibling of the watchlist read.

### 2.4 The Monday defer point

- `api/_utils/tournamentOrchestrator.js:464–472`: Step 1 of `runMondayPipeline` catches `__resolve_user_draft:boards_missing`, logs the loud "USER BOARDS NOT COMMITTED … auto-commit lands at P5" line, increments `summary.deferredBoards`, and `continue`s.
- `isDutySatisfied` (`:618–623`) refuses the Monday duty marker while `deferredBoards > 0` — so today the duty retries every tick all morning and the group's whole Monday stalls.
- The sentinel originates in `resolveSnakeDraft` (`resolve-user-draft.js:71–74`) when any member lacks a board doc or has an empty board.
- Cron reality (for the deadline definition): `vercel.json:170–172` — `*/10 11,12,13,14,21,22,23 UTC, Mon–Fri`. First Monday tick = 11:00 UTC = **7:00 AM ET during DST** (6:00 AM EST) — pre-market in both arms.

### 2.5 Tournament tab shell

- Flag: `TOURNAMENT_TAB_ENABLED = false` — `src/config/featureFlags.js:78`.
- Route: `src/App.jsx:9562–9567` — `'league'` screen renders `LeagueScreen` only when flagged; "the nav items are its only setters."
- Nav slots: `BottomNav.jsx:10–12` and `DesktopSidebar.jsx:14–16` (Trophy icon, retired Agent Hub's slot).
- `src/screens/LeagueScreen.jsx` is an intentionally minimal "Coming soon" placeholder (34 lines) — P5 replaces its content. Note: it currently styles with `CMD` constants from `commandUI`, not `useTheme().tokens`; the replacement goes tokens-native per the guardrail.

### 2.6 Snake Draft components — reuse inventory (read-only inspiration; engine untouched)

Inventoried via full reads (subagent, this session): `src/screens/DraftBattleScreenV2.jsx` (1369 ln), `src/components/draft/AltitudeMap.jsx` (634 ln), `src/components/draft/TacticalPod.jsx` (395 ln), plus the shared pieces they pull in.

| Piece | Verdict | Why |
|---|---|---|
| `DraftBattleScreenV2` | **REFERENCE-ONLY** | Live orchestrator: WebSocket prices, Firestore writes, API fetches. Its *staggered-reveal* pattern (`:811–820`, 200ms-stagger setTimeout loop) and shockwave trigger flow are the copyable ideas. |
| `TacticalPod` | **EXTRACTABLE-PATTERN** | Pure presentational hexagon pod — but styled entirely in hardcoded `HOLO_COLORS` (`src/constants/holoTheme.js`), so under this phase's tokens-native rule it's a pattern to restyle, not an import (surprise S3). Holo-foil sweep on score change (`:310–333`) is the signature move. |
| `AltitudeMap` | **REFERENCE-ONLY for P5** | Standings altitude visualization — built for live standings, not a pick sequence; its SVG pulse/glow idioms (`:462–479`, `:527–550`) are borrowable motifs. |
| `DataStrike` (`src/components/shared/DataStrike.jsx`) | **REUSABLE** | Self-contained value-flash animation, `useReducedMotion`-aware, no service coupling. |
| `animationTokens.js` (`HOLO_SWEEP`, `DATA_STRIKE` timings) | **REUSABLE** | Timing constants, color-free. |
| Gesture support | **NONE FOUND** | No drag/scrub handling anywhere in the lineage — pre-answering proposal A's scrub question (see A, controls). |

No protected-core imports anywhere in the planned reuse; the Snake Draft engine is untouched.

### 2.7 Dev group's real streams (first playback data)

- The P4 smoke (P4_PHASE_REPORT.md §8, founder-approved choreography) ran "seed dev bracket → Monday duty → 4 real stamped/prescribed/ledger-confirmed deploys" — the Monday duty path necessarily wrote both `streams/userDraft` and `streams/agentDraft` for the dev group (writers verified at §2.1; the pipeline order at `tournamentOrchestrator.js:456–518`). Firestore contents are not readable from this session — existence is **ASSUMED from the P4 record**, mechanism VERIFIED.
- Dev groups carry `isDev: true` and are excluded from production duty runs (`api/_utils/tournamentGroupService.js:96–110`); the dev screen drives duties with a simulated clock through `run-duty` (`src/screens/TournamentDevScreen.jsx:293–312`) and already embeds `BoardEditor` (`:911`) and the agent-stream subscription (`:189`). The dev screen remains the smoke driver, as scoped.

---

## 3. Surprises (none are stop conditions)

- **S1 — The playback pacing constant already exists.** `TOURNAMENT_TUNING.PLAYBACK_MS_PER_PICK: 5000` (`src/constants/leagueTournament.js:317`). P5 consumes it; no new constant. Founder tunes in one place.
- **S2 — P1a/P3a phase reports are absent from `docs/audits/`.** The prompt's reading list names them; they don't exist in the repo (only the three June-10 audits). This is the known D12 provenance gap recorded at P4 (P4_PHASE_REPORT.md §7.5): they remain founder-workspace originals awaiting founder upload. Stream shapes were verified directly from code, which is the binding source anyway.
- **S3 — Tokens vs HOLO collision.** The gold-standard Snake Draft components are styled in hardcoded `HOLO_COLORS`, but this phase's guardrail is tokens-native-only. Resolution proposed: **siblings in motion, not in palette** — extract the motion patterns (sweep, stagger, strike, pulse) and restyle them from `useTheme().tokens`. (BoardEditor itself carries a few hardcoded hex values — `#10b981`/`#ef4444`/`#f59e0b` at `BoardEditor.jsx:126,166,180,183,198–199` — cleaned to tokens while the file is open, surface-only.)
- **S4 — The prefill ∩ userPool seam.** `assembleBoardPrefill` does not intersect with the pool; `BoardEditor.jsx:47` does. A naive server twin of the service function alone would fork the semantics. The shared pure core must own merge + intersection + depth so neither side can drift (proposal B).
- **S5 — The floor is needed for *short* prefills, not just empty ones.** `buildBoardCommit` rejects boards under depth 15; a player with a 6-name in-pool prefill would fail auto-commit without padding. The no-watchlist floor generalizes to a pad-to-minimum rule (proposal B).
- Minor notes for the build: the user stream doc id is a string literal `'userDraft'` (`resolve-user-draft.js:173`; the SYNC WARNING at `leagueTournament.js:37–41` predates constants) — P5 adds a same-value constant for the client reader without touching the P1a literals. A "find my group" client query (`groupMembers array-contains uid`) doesn't exist yet and may need a Firestore index — flagged for the build, not Stage 0.

---

## 4. Proposal A — Playback composition

**Component.** One `DraftPlaybackTheater` (in `src/components/Tournament/`), two acts on one timeline:
- **Act 1 — The User Draft** (12 picks, `streams/userDraft`), **Act 2 — The Agent Draft** (24 picks, `streams/agentDraft`), with an intermission card between acts ("Your agents saw the boards — now they draft," carrying each agent's `userPicksStance` lines — the adaptation beat V2.1 §5 designed).
- Both streams flow through **one parser** (`parseDraftStream`, shared module, unit-tested): normalizes the seven shared fields, treats `agentId` as the optional actor discriminator, and accumulates a `takenBy` map (symbol → {actor, pickNumber}) so snipes can name the sniper. Total runtime at default pacing: 36 picks × 5s = 3 minutes — inside V2.1 §5's "under 5 minutes."

**Pacing & controls.** `TOURNAMENT_TUNING.PLAYBACK_MS_PER_PICK` (existing, S1) drives a small pure state machine `{ status: playing|paused|ended, index }` — play/pause, skip-to-end, and **scrub via a native range slider**, which is gesture-correct on mobile for free (drag = scrub) and honest about the inventory finding that no reusable gesture code exists (§2.6). No custom gesture engineering — the "no heroics" answer that still delivers gesture scrub.

**Pick presentation.** Tokens-native pick cards in the Snake Draft's motion language (restyled per S3): staggered reveal (the `:811–820` pattern), DataStrike-style value pop, holo-sweep on the landing pick. Agent picks show the board doc's `rationale[symbol]` one-liner; user picks show board provenance ("board #3").

**Snipes** (`passedOver` non-empty) are the drama: before the pick lands, each passed-over name renders struck-through with **who took it and when** ("NVDA — taken by Marcus, pick #4," from the `takenBy` map), amber flash on the loss, then the actual pick slides in with "slid to board #7." Act 2 adds the **double-down beat**: an agent drafting its own player's user pick gets the purple-glow DOUBLE-DOWN chip (derivable client-side: symbol ∈ own player's Act-1 picks; stance line attached when present).

**Fallbacks** (`fallback: true`) get the honest, muted treatment: "board exhausted — ranking auto-pick," `textMuted`, no drama.

**Entry & handoff.** Playback lives in the League tab's group view: a "Watch the draft" CTA whenever both streams exist, presented as the Monday headline per V2.1's weekly rhythm (one big show, four daily pulses). The end card shows the final rosters (12 user names by player; 24 agent names by agent, double-downs marked) and hands off to the group's standings/battle-week card — the full battle view is P7's; the CTA targets what exists.

**Data reads** (all client-legal under the recursive rules block): both stream docs (new `subscribeUserDraftStream` sibling of the existing agent one), `agentBoards` docs for rationale/stances, the group doc for names/CPU flags.

## 5. Proposal B — Auto-commit semantics

**Deadline definition (recommended): encountering an uncommitted board during the Monday pipeline IS the deadline.** First Monday tick is 11:00 UTC (7:00 AM EDT / 6:00 AM EST — pre-market in both DST arms, §2.4). No new timer, no new cron (guardrail honored). The stated alternative — a grace guard that only auto-commits after a threshold ET time (e.g., last morning tick) — is a one-line condition, but it stalls the *entire group's* Monday (draft, agent boards, agent draft, deploys) into the compressed end of the morning window to serve a player who had all weekend; I see no real value. It stays available as a tuning-ledger knob if the founder ever wants it.

**Mechanics.** In the `boards_missing` catch (`tournamentOrchestrator.js:464–472`), replace defer-and-continue with:
1. Read the `boards` subcollection; `missing = groupMembers` without docs (never parse the sentinel's detail string). On real Mondays only human seats can be missing — CPU boards are committed through `buildBoardCommit` at composition (`leagueTournament.js:289–291`).
2. Per missing member, **call the existing service**: derive the server prefill (twin, below) → `buildBoardCommit({ group, odUserId, board: prefill, prefillAsSuggested: prefill, now, autoCommitted: true })` — one new option on the shared core, stamping `autoCommitted: true` on the rider-#1 doc (the delta is all-`kept` by construction; the flag, not the delta, is what lets the signal corpus split chosen boards from defaulted ones). Board doc + feed entry write **in one transaction** (awaited, rider discipline).
3. **Feed entry** rides the proven rider-#4 mechanism (`group.feed`, capped 50, atomic with the mutation — `flip.js:181–198`): `{ type: 'board_auto_commit', odUserId, boardLength, floored, timestamp }`. The committed-state display (proposal C) renders the "auto-committed at the deadline" badge from the board doc. (No push-notification infra exists; the feed + badge are the player-facing record.)
4. Retry `resolveUserDraftForGroup` once in the same tick — the pipeline proceeds to boards → agent draft → deploys on the same Monday morning. If anything in auto-commit fails for a member, the loud defer remains as the fallback and the duty marker stays withheld (`isDutySatisfied` unchanged) — the next tick retries.

**Idempotency.** A committed board doc means `boards_missing` never re-fires for that member; the per-member transaction skips if the doc exists (so re-runs can't double-write the feed entry); the two-grain duty idempotency is untouched.

**Server prefill twin — shared pure core, no forks.** New zero-import core (e.g. `src/utils/boardPrefillCore.js`): `composeBoardPrefill({ equippedSymbols, scoutAlertSymbols, userPool, depthMax })` = clean/dedupe merge (equipped first) → **∩ userPool** (the intersection moves INTO the core, fixing S4) → slice. The client converges: `assembleBoardPrefill` + `BoardEditor.jsx:47` call the core with their SDK reads. The server twin (`api/_utils/`) mirrors the three reads with Admin SDK, reusing `resolveEquippedWatchlist`/`extractTickerSymbols` exactly as the agent-board producer already does (`tournamentAgentBoards.js:454–468`), plus the agent-by-owner lookup pattern (`:303–317`). Equivalence is test-locked on fixtures (server twin ≡ client derivation).

**The floor (generalized per S5).** Whenever the in-pool prefill is shorter than `BOARD_DEPTH_MIN` — including the empty no-watchlist/no-alerts case — pad to the minimum, loudly:
1. Player's agent-archetype ranking ∩ `userPool` (the agent-draft fallback pattern — `tournamentAgentDraft.js:251–264`; `'analyst'` default when the member has no agent, matching `resolveGroupAgents`),
2. then the ranked `userPool` in stored order if rankings are unavailable or still short (the pool is ranked — `resolve-user-draft.js:62`; precedent: `buildCpuUserBoard` is exactly a ranked-pool slice, `leagueTournament.js:293–305`).
Every floor use logs loudly and sets `floored` on the feed entry.

## 6. Proposal C — Board-commit surface flow

**Where.** The League tab home (replacing the placeholder content, behind `TOURNAMENT_TAB_ENABLED`): a "my group" card (new `groupMembers array-contains` query — index flagged) that, while the group is **forming**, leads to the board flow. The dev screen's embedded BoardEditor stays for smoke.

**Flow (watchlist-creation reuse, V2.1 §3, screen by screen).**
1. **Prefill load** — the converged core (proposal B) seeds the board; "suggested" provenance chips as today; the pool-filtered prefill is held as the `prefillAsSuggested` snapshot (current BoardEditor behavior, preserved).
2. **Curate** — reorder / remove / add via `TickerSearchAdd` restricted to the pool; live depth meter 15–20. Reorder stays on the existing up/down buttons — drag-reorder is the one place I recommend *against* heroics; the affordance works and the phase's motion budget belongs to the playback.
3. **Commit with lock-semantics confirmation** — a confirm sheet stating the binding rule honestly: *"Your board is binding at Monday's draft — your agent takes your highest-ranked available name each turn. You can revise and re-commit any time before the draft runs."* Then the existing `POST /api/tournament/commit-board`; rider #1 fires exactly as today, zero service changes for the human path.

**Pre-draft edit window — confirmed and surfaced.** Re-commit while forming is already the service contract (last commit wins, `commit-board.js:3–5`; `not_forming` guard at `tournamentBoards.js:71`), and `computeBoardDelta` exists precisely to record edits vs the suggestion. UX: the committed state renders the board read-only with "Committed {time}" + **Edit & re-commit**, which reopens the editor seeded from the *committed board* while carrying the *original prefill snapshot* forward — so the rider delta keeps measuring against what was suggested, not against the previous commit.

**Committed-state display.** Read-only ranked list; committed timestamp; the **auto-committed badge** when the board doc carries `autoCommitted: true` ("Auto-committed at the deadline — edit before next round's draft" when applicable); once the group leaves forming: "Boards locked — the draft has run," with the playback CTA when streams exist (the C→A handoff).

---

## 7. Build-scope confirmations (for the go)

- Zero fence contact found or needed anywhere in the three deliverables; the auto-commit, prefill twin, surface, and playback are all non-fenced territory. Zero new cron entries (auto-commit rides the Monday duty's existing tick). Rider #1 fires on auto-commits with the flag; all writes awaited. All new UI behind `TOURNAMENT_TAB_ENABLED`; tokens-native only (S3 resolution). The auto-commit closes the docketed pre-launch requirement — the PR will say so.
- Test plan as scoped: parity-reader tests (both streams, one parser), playback state-machine tests (pacing/skip/scrub boundaries), auto-commit unit + integration (flagged commit event → pipeline proceeds → defer gone → idempotent re-run), prefill-twin equivalence on fixtures, floor tests, dev-group surface smoke.

**HARD STOP — awaiting founder review of proposals A, B, C and the deadline-definition recommendation in B.**
