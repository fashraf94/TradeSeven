# P10a — Phase Report: The Self-Serve Lobby — Data Layer + CPU-Padded Formation (THE SEAM)

**Phase:** P10a (the load-bearing half of P10 — lobby collection + service + FIFO matchmaking + CPU-padded base-layer formation + the proven seam). The surface (P10b) builds on this.
**Branch:** `claude/festive-hamilton-4vu6y0` · **HEAD at start:** `eb8d913` · **tree:** clean at start.
**Date:** 2026-06-13. **Repo:** shallow clone; no history deepening.
**Founder rulings (locked at the Stage 0 STOP):** (1) FIFO fill-to-4; (2) zero new cron — synchronous formation, any auto-close rides an orchestrator branch not a new slot; (3) flag `LEAGUE_LOBBY_ENABLED`; (4) split P10a (seam) / P10b (surface); (5) base-layer recomposition stays out of V1 (re-register model). **P10a built test-first: the base-layer-+-CPU battery (formation → Monday → banking → COMPLETE) is GREEN before any P10b surface.**

---

## 0. Executive verdict

| Item | Outcome |
|---|---|
| The CPU-padding seam (finding #2) | **PROVEN, not assumed.** A new `tournamentLobbyService` invokes the existing padding primitives to form a **base-layer** group with CPU seats — a combination that had never run. The seam battery walks a formation-produced solo group through **Monday → banking → base-layer COMPLETE**, all green. |
| CPU-number uniqueness across concurrent groups | **Closed with a transactional global allocator** (`tournamentLobby/__cpuSequence`). The per-round `startN` scheme does not apply to independently-formed groups; without this, two solo registrations would seat the same `cpu-agent` in two active battles. |
| Matchmaking | **FIFO fill-to-4** (ruling 1): `matchmakeJoin` seats into the oldest open lobby or opens a fresh one. |
| Formation trigger / cron | **Synchronous, ZERO new cron** (ruling 2). `vercel.json` unchanged at **38/40**. No auto-close built (would be an orchestrator branch if ever wanted). |
| Flag | **`LEAGUE_LOBBY_ENABLED = false`** (dark). Flag-off = today's empty state unchanged (no regression). |
| Rules | **New `firestore.rules` block `tournamentLobby`** (auth read, server-only write) — **inert until the manual Firebase Console deploy**, like the other five tournament blocks. |
| Production scope | Self-serve groups are **production** (`isDev` **never** set) — the orchestrator runs them; dev seeders keep `isDev:true`. |
| Fence | **Zero fence contact.** Fenced exports reached transitively via `tournamentCpu` (`agentArchetypeConfig`) are called read-only, never edited. |
| Tests | **535 tournament tests green** (33 files), incl. the seam battery (4) + lobby service (19) + schema (95). Lint clean. |
| `/code-review` | Run at **max effort** (9 finder angles + verify + sweep); findings triaged, 6 fixes applied (below). |

---

## 1. What was built

### 1.1 Schema (`src/constants/leagueTournament.js`, zero-import)
- `TOURNAMENT_LOBBY_COLLECTION`, `LOBBY_STATUS` (open/forming/formed/cancelled), `LOBBY_MODE` (matchmaking/private), `LOBBY_MAX_HUMANS` (= `GROUP_SIZE`), `LOBBY_JOIN_CODE_LEN`, `LOBBY_DISPLAY_NAME_MAX`.
- Pure factories/helpers: `createLobbyDoc`, `createLobbyMember`, `lobbyHumanIds`, `lobbyOpenSeatCount`, `lobbyHasMember`.
- **`isoWeekString` relocated here** from the dev seeder (BUILD_RULES §4 one-home rule) — pure, date-arg-required (the module never reads a clock). The seeder now imports it; behavior is byte-equivalent (the only contract change is the now-required valid-Date argument). Zero-import invariant preserved (verified).

### 1.2 Service (`api/_utils/tournamentLobbyService.js`, Admin SDK)
- `createLobby` (open; private carries a shareable join code) · `joinLobby` (transactional, FIFO append, double-join idempotent, capacity-guarded) · `matchmakeJoin` (FIFO into the oldest open lobby, fresh-lobby fallback) · `formGroupFromLobby` (**the seam**) · `quickPlay` (solo create+form).
- **`formGroupFromLobby`** mirrors the bracket-seeder's 4-call sequence for ONE base-layer group: `padGamesWithCpus` → `ensureCpuAgents` → `createTournamentGroupDoc` (get-or-create at a **deterministic id == the lobby id**; `isDev` never set) → `commitCpuUserBoards`. Crash-safe and idempotent (claim → FORMING with the reserved CPU base + groupId stored → resume reuses them → FORMED).
- **The transactional CPU allocator** (`__cpuSequence`): formation reserves `[next, next+cpuCount)` inside the claim transaction, so concurrent formations get disjoint CPU numbers (Firestore optimistic concurrency on the counter read+write).

### 1.3 Flag + rules
- `src/config/featureFlags.js`: `LEAGUE_LOBBY_ENABLED = false`.
- `firestore.rules`: the `tournamentLobby` block (covers the `__cpuSequence` allocator doc too).

### 1.4 Tests (test-first)
- `src/constants/leagueTournament.test.js`: lobby factories/helpers + `isoWeekString` (incl. the now-required-Date contract).
- `api/_utils/tournamentLobbyService.test.js` (19): create, join (FIFO/idempotent/capacity), matchmaking (FIFO/fallback/skip-full-and-private/never-match-`__cpuSequence`), formation (solo→3 CPU, 2→2, 4→0, **disjoint allocator**, double-form idempotent, **resume reuses the reserved base**, **resume doesn't re-validate the pool**, **next-0 guard**, **formed-without-group guard**, universe-floor), quickPlay.
- `api/_utils/tournamentLobbyFormation.seam.test.js` (4): **THE SEAM** — a formation-produced solo base-layer group → real `runMondayPipeline` (battle + 24 held + 4 deploys; human=model board, CPUs=fallback, 0 synthetic) → real `bankGroup` (all four seats banked) → real `runFridayAdvancement` (base-layer **COMPLETE**, rank applied to four, the **CPU-farm guard** `cpuOpponents===3` for the solo human, leaderboard final in the **production** namespace). Only model bypass: a tool-forced `submit_board` stub for the one human's agent board.

---

## 2. The seam — the load-bearing fact, resolved

P10 discovery flagged this as the careful seam: CPU padding had only ever run on **bracket** groups. Two facts the lobby wiring had to own that the bracket path got for free, both now closed and tested:

1. **CPU-number uniqueness across concurrent groups.** Independently-formed base-layer groups have no "round," so the per-round `startN` offset doesn't protect them. Two solo registrations would both grab `cpu-1..3` → the same `cpu-agent-1` in two active battles (the one-active-battle-per-agent constraint, tripped at deploy). **Fix:** a transactional global allocator hands out disjoint, monotonic CPU ranges per formation.
2. **Production scope.** A self-serve group is a production group — `isDev` is never set, so the orchestrator runs it; the dev seeders keep stamping `isDev:true`.

The downstream duties (Monday pipeline, banking, base-layer COMPLETE/rank/leaderboard) are `isCpu`-keyed and bracket-agnostic by construction — and the seam battery proves the formation-produced group flows through all of them end to end.

---

## 3. `/code-review` (max effort) — findings & resolution

Nine finder angles + verify + sweep. The allocator, idempotency, reads-before-writes ordering, the 4-human (no-pad) case, and resume were all verified sound. Acted on:

| Finding | Severity | Resolution |
|---|---|---|
| Resume re-fetched/validated `userPool` even when the group already exists → a later rankings shortfall could strand an already-created group | real (recovery) | **Fixed:** the pool fetch + floor check now run **only when creating**; a resume reuses the group's frozen pool. Regression test added. |
| `cpuStartN ?? 1` didn't catch a `0` counter (`cpuUserId(0)` throws) | latent footgun | **Fixed:** the allocator guard now requires `next >= 1`. Regression test added. |
| Idempotent re-entry could report a `FORMED`-without-`groupId` as success | defensive | **Fixed:** throws `lobby_formed_without_group` on that corrupt state. Regression test added. |
| Header overstated that the *service* auto-forms at 4 humans | doc accuracy | **Fixed:** clarified the caller forms on `full` (the P10b endpoints wire join→form). |
| `cpuNs` semantics on idempotent re-entry | doc accuracy | **Clarified:** `cpuNs` = CPU seats created by THIS formation (empty on re-entry). |
| The allocator test name claimed "concurrent" (the in-memory tx has no conflict detection) | test overclaim | **Reworded** to "monotonic disjoint allocation across formations," noting the transactional basis. |
| Group doc set (FORMING+full seats) before CPU boards land — a crash window leaves the group briefly orchestrator-eligible with boards pending | accepted-by-design | **No change:** mirrors the established advancement composition order; the Monday auto-commit deadline is the existing safety net. |
| FIFO tie-break nondeterministic for identical `createdAt` | low / out of scope | **No change:** within the "matchmaking tuning needs a real population" out-of-scope note; benign at V1 scale. |

---

## 4. Guardrails honored
- **Zero fence contact** (fenced exports called read-only, never edited).
- **Zero new cron** — `vercel.json` unchanged (38/40). Synchronous formation.
- **New collection → new rules block + the manual Console-deploy caveat** (inert until deployed).
- **The new flag gates everything; flag-off = today's empty state** (dark-merge safe; the live tournament does not regress).
- **One branch** (`claude/festive-hamilton-4vu6y0`). `/code-review` at max effort. Reports are file artifacts.

---

## 5. Deploy / rollout status (state explicitly, per house shape)
- **Cron:** none added (38/40).
- **Rules:** `firestore.rules` `tournamentLobby` block added — **NOT deployed** (founder Console action, like the other five blocks). Deploy it before flipping `LEAGUE_LOBBY_ENABLED`, else the P10b client lobby read 403s.
- **Console deploy caveat:** applies to the new rules block.
- **Flag:** `LEAGUE_LOBBY_ENABLED = false` (dark). Flip is a later one-line founder act, after P10b + a preview smoke + the rules deploy.
- **Pushed ≠ deployed.** Crons don't run on preview; the seam is verified by the unit/integration battery + (P10b) the founder smoke.

---

## 6. Handoff to P10b (the surface)
On this proven engine, P10b builds: the authed `lobby-*` endpoints (`fetchWithAuth` Bearer ID token — the place-claim/flip pattern; gate on `LEAGUE_LOBBY_ENABLED`; wire join→form-at-4), the client lobby service + a `subscribeMyLobby` read, and the `LeagueScreen` front door replacing the `!group` poster (Quick Play, Create-a-group + shareable join path, Join/matchmake, the open-lobby "who's waiting / N-of-4 / empty seats become CPUs" view, the waiting→formed transition). **Two UX musts (founder):** state **"your game starts Monday"** plainly, and explain the **CPU fill** so a solo joiner expects bots. Then the founder smoke (the real beta dry-run) + the flip.

---

## 7. Out of scope (untouched)
The live engine/scoring/fence; base-layer **recomposition** of completed players (re-register model, ruled); the HTTP endpoints + UI (P10b); auto-close of lingering lobbies (an orchestrator branch if ever wanted); the X1 training-game short fix; post-launch arcs.

---

*Prepared at the close of P10a. The seam is proven; the data layer is dark-merge-safe. P10b builds the surface on a green battery.*
