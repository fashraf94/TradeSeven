# P10b — Phase Report: The Lobby Surface — Endpoints · Client Service · The Front Door

**Phase:** P10b (the surface on P10a's proven engine — the authed `lobby-*` endpoints, the client lobby mutation service + `subscribeMyLobby`, and the `LeagueScreen` front door that replaces the dead "no active tournament group yet" poster).
**Branch:** `claude/zealous-pasteur-g93l8s` · **HEAD at start:** `c17f2cf` · **tree:** clean at start.
**Date:** 2026-06-13. **Repo:** shallow clone; no history deepening.
**Stage-0′ founder ruling (locked):** the join-code share path adds a small **reads-only** `findLobbyByJoinCode` resolver (the 6-char code is the beta share token; a 20-char doc id is not). Honest no-match (clean 404, never a 500); only OPEN lobbies resolve. S2/S4/S5 defaults confirmed. Two items to the watch ledger (W8 `memberIds` follow-up, W9 dup-report housekeeping).

---

## 0. Executive verdict

| Item | Outcome |
|---|---|
| **The front door** | **Built.** Quick Play (solo → instant CPU-padded group), Create a group (private lobby + shareable 6-char code), Join a game (typed code or FIFO matchmake), the open-lobby waiting room (who's waiting · seats N/4 · the CPU-fill honesty · "Start now"), and the automatic waiting→formed handoff. Replaces the `!group` poster **only when the flag is on**. |
| **The two UX musts** | **Woven in honestly.** "Your game starts Monday" stated plainly (the mid-week-join lifecycle) and the CPU fill explained ("empty seats become CPU opponents — you can start anytime") at Quick Play and in the waiting room. |
| **Endpoints** | **5 thin, authed, flag-gated handlers** over the P10a service: `lobby-quickplay/create/join/matchmake/form`. Each `requireAuth → flag-gate → service call → error-map`. `isDev` never set. |
| **Synchronous formation, ZERO cron** | Quick Play, "Start now", and the join/matchmake that seats the **4th human** form the group **in-request**. `vercel.json` unchanged at **38/40**. |
| **Client-honest / server-authoritative** | Mutations in the new `tournamentLobbyActions.js` (throw-on-`!ok`, never a success the server didn't grant); `subscribeMyLobby` is a **read** in the reads-only service. |
| **Join-code resolver** | `findLobbyByJoinCode` added (reads-only, OPEN-only, honest null). The typed 6-char code is the share path (no deep-link shipped — an un-routed link would be decorative, per the option-B ruling). |
| **Flag** | **`LEAGUE_LOBBY_ENABLED` stays `false`** (dark). Flag-off renders today's poster **byte-unchanged** (one added `if (FLAG && …)` before the unchanged poster return). |
| **Rules** | **None new.** Every P10b read rides P10a's `tournamentLobby` block (still deploy-pending in the Console — not new here). |
| **Fence** | **Zero fence contact.** No fenced file read or edited. |
| **Tests** | **+45 P10b tests** (engine resolver 3, endpoints 14, client service 11, schema selection 4, plus the existing battery). **2300 tournament-suite tests green** (99 files). Lint clean. |

---

## 1. What was built (by file)

### 1.1 The engine (one reads-only addition)
- `api/_utils/tournamentLobbyService.js` — **`findLobbyByJoinCode(db, code)`**: a single-field `where('joinCode','==',code)` lookup, case-normalized, returning the **OPEN** match's `{ id, lobby }` or **null** (honest no-match — a typo'd/closed code is a clean 404 at the endpoint, never a 500; FORMING/FORMED/CANCELLED never resolve). The only engine change; reads-only, non-fence, non-rule, non-cron.

### 1.2 The endpoints (A) — `api/tournament/lobby-*.js` + the shared wrapper
- `api/_utils/lobbyEndpoint.js` — `runLobbyEndpoint(req,res,fn)`: the shared transport every route uses — **POST guard → THE FLAG GATE (404 `lobby_disabled` when `LEAGUE_LOBBY_ENABLED` is false) → Bearer auth → service-error→HTTP map**. One home for the gate (it can never drift between routes) and the error map (the flip.js sentinel idiom). `universe_unavailable → 503` with honest copy (S5); unmapped throws are a logged 500 (never swallowed). Imports the zero-import flag module (BUILD_RULES §4).
- `lobby-quickplay.js` → `quickPlay` — **forms** a solo CPU-padded group.
- `lobby-create.js` → `createLobby` (PRIVATE by default → shareable join code); does not form.
- `lobby-join.js` → resolve by `lobbyId` **or** typed `joinCode` (`findLobbyByJoinCode`) → `joinLobby` → **forms when the join seats the 4th human**.
- `lobby-matchmake.js` → `matchmakeJoin` (FIFO) → **forms when it seats the 4th human**.
- `lobby-form.js` → "Start now", **owner-only** (server asserts `createdBy === uid`) → `formGroupFromLobby`.

### 1.3 The client service + the read (B)
- `src/services/tournamentLobbyActions.js` (the sibling of `tournamentActions.js`) — `quickPlay / createLobby / joinLobby / matchmakeJoin / formLobby`, each a POST that **rejects on `!res.ok`** (reaches success only after a 2xx), plus `mapLobbyError` (known codes → friendly copy, **server message fallback** — never swallowed). **Mutations live here, not in the reads-only service.**
- `src/services/tournamentGroupService.js` — **`subscribeMyLobby(uid, cb)`** (a read, beside `subscribeMyGroup`): `status in [open,forming]` (single-field, no composite index) + client-side membership via the pure `selectActiveLobby`.
- `src/constants/leagueTournament.js` — **`selectActiveLobby(docs, uid)`** (pure, zero-import): the open/forming + membership + most-recent selection. Encodes the **handoff** — a FORMED lobby is excluded → null, so the group subscription takes over.

### 1.4 The front door (C)
- `src/components/Tournament/LeagueLobby.jsx` — owns `subscribeMyLobby`; renders the three choices when no lobby, the waiting room when in one, and the honest "your group is forming…" transition on a formation success (the parent then swaps to the board flow). Tokens-native; reduced-motion-aware (no JS motion; the global `prefers-reduced-motion` rule neuters CSS animation). The action machine + an in-flight ref enforce one client-honest action at a time.
- `src/screens/LeagueScreen.jsx` — the **only** screen edit: a flag-gated `if (LEAGUE_LOBBY_ENABLED && uid && loaded && !group) return <LeagueLobby/>` **before** the unchanged poster return. Flag-off and the signed-out / loading states are byte-unchanged.

### 1.5 Tests
- `tournamentLobbyService.test.js` (+3): code resolves (case-insensitive) · honest null on typo/empty/null · FORMED code does not resolve.
- `lobby-endpoints.test.js` (14): the flag gate refuses **all five** endpoints when off · auth 401 · method 405 · quick-play solo formation (production, no `isDev`) · `universe_unavailable → 503` · create returns a join code · join-by-id waits · **join seats the 4th → forms** · join-by-code resolves / unknown code → 404 · missing target → 400 · matchmake fresh / **matchmake seals the 4th → forms** · form owner-only (403 non-owner) · creator starts now / missing lobby 404. *(Real integration over the P10a service + in-memory Firestore; the dependency-surface guard for the endpoint graph.)*
- `tournamentLobbyActions.test.js` (11): request shapes · **throws (never resolves) on each error** · HTTP fallback on non-JSON · `mapLobbyError` mapped/fallback/null.
- `leagueTournament.test.js` (+4): `selectActiveLobby` membership/most-recent + **the FORMED→null handoff**.

---

## 2. Guardrails honored (house shape)
- **Cron:** none added — **38/40**. Synchronous formation (Quick Play / "Start now" / the 4th-seat join/matchmake form in-request).
- **Rules:** **zero new.** All P10b reads ride P10a's `tournamentLobby` block — **still NOT deployed** (founder Console action; deploy before the flip or the client lobby read 403s). The endpoint flag-gate also refuses while off, so nothing is reachable pre-flip.
- **Flag:** `LEAGUE_LOBBY_ENABLED = false` (dark). **Flag-off = today's poster** (regression-safe — one added conditional, the poster return untouched).
- **Fence:** zero contact. **`isDev`** never set (the service never sets it; the endpoints never add it).
- **Mutations** in the client lobby service, never the reads-only `tournamentGroupService.js` (only the `subscribeMyLobby` **read** was added there).
- **One branch.** `/code-review` mandatory (≥10 files) — run at max effort on this surface.

---

## 3. Rollout / the flip (the only remaining gate after smoke)
1. **Merge P10b** (flag stays false — nothing changes for anyone).
2. **Deploy** P10a's `tournamentLobby` rules block in the Console (it is in `firestore.rules`, inert until deployed).
3. **Verify** a lobby read succeeds on the dev surface (would 403 without the rules).
4. **Preview smoke** (flag on): register → Quick Play → solo CPU-padded group lands in the board-commit flow; Create → share code → second identity joins by code (or "Start now") → it forms; both **production** (non-dev) groups; confirm **flag-off still shows the poster**. *(Founder note: run the smoke after the day's rankings are fresh so `universe_unavailable` doesn't fire — S5.)*
5. **Flip `LEAGUE_LOBBY_ENABLED → true`** (one-line follow-up PR). The endpoints and the surface read the **same const** — after the smoke + the rules deploy, **the flip is the only remaining gate.**
6. Invite beta users (NOT into a holiday-short week — the O1 caveat).

---

## 3a. `/code-review` (max effort) — findings & resolution
Nine finder angles (5 correctness + 3 cleanup + 1 altitude) over the staged diff, three independent reviewers + a sweep, then verify. The API-side reviewer returned **clean** (form-trigger idempotency, ownership, the flag gate, error parsing, and `findLobbyByJoinCode` all verified sound). Acted on:

| Finding | Severity | Resolution |
|---|---|---|
| `LeagueLobby` compared `lobby.status === 'forming'` (string literal) instead of `LOBBY_STATUS.FORMING` | drift footgun | **Fixed** — imports + uses the constant (the rest of the surface keys off it). |
| Handoff race: when *another* player fills the lobby, `subscribeMyLobby`→null can beat `subscribeMyGroup`→group, briefly flashing the front door | real (transient UX) | **Fixed** — a `sawLobby` ref holds the "Your group is forming…" transition screen once our lobby leaves the open/forming set (FORMED is its only exit), so the front door never re-flashes during the handoff. |
| Forming screen could stick if `subscribeMyGroup` errors (e.g., rules undeployed) | degraded-infra | **Accepted (rollout-gated):** the launch sequence deploys + verifies the rules **before** the flip (steps 2–3); the worst case is a refresh. Documented, not over-engineered. |
| `postLobbyAction` / `mapLobbyError` / the in-memory test DB mirror `tournamentActions.js` / the P10a test | reuse (intentional) | **No change:** deliberate mirroring of the established one-service-per-concern pattern; extracting would touch stable P7 code and the proven P10a battery for ~15–90 lines of low-risk duplication. |

## 4. Watch-ledger additions (this PR)
- **W8** — `subscribeMyLobby` reads all open/forming lobbies (no membership index); fix is a denormalized `memberIds` array + `array-contains` when open-lobby volume grows. Launch-safe at FIFO V1 scale.
- **W9** — duplicate P10a phase-report file in `docs/audits/` (`2026-06-13_…` vs `20260613_…`, byte-identical); keep the dated form, remove the duplicate in a housekeeping pass (left untouched here to keep the surface PR clean).

---

## 5. Out of scope (untouched)
The live engine/scoring/fence; base-layer **recomposition** of completed players (re-register model); **auto-close** of lingering lobbies (an orchestrator branch if ever wanted — none added); matchmaking tuning (FIFO is V1); the X1 training-game short fix; post-launch arcs. No Snake Draft engine modification.

---

*Prepared at the close of P10b. The surface is built dark on a green battery; flag-off is regression-safe. After the rules deploy + the preview smoke, one flag flip opens the front door for beta.*
