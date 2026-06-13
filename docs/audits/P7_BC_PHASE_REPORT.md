# P7 (B+C) — Claim/Flip Window · Round-Boundary Flow: Phase Report

**Phase:** P7, the B+C half of the founder split (A merged; this is the second branch).
**Branch:** `claude/lucid-hopper-p7bc` · fresh off `origin/main` `a1b5e27` (A/PR #498 merged) · tip `ca77e73`.
**Date:** June 13, 2026.
**Stage 0′ artifact:** `P7_BC_STAGE0_REPORT.md` (this session) — proposals ratified; the one decision (claim-window mirror) resolved as **client display-only mirror + parity test**, zero edit to `tournamentTime.js`.

---

## 1. Executive verdict table

| # | Question | Verdict |
|---|---|---|
| 1 | Claim/flip window over the existing endpoints? | **YES** — `ClaimFlipWindow`, two tabs, mutations via the new `tournamentActions` module. |
| 2 | Client-honest / server-authoritative? | **YES** — success only after the server's 200 (the action machine reaches `confirmed` only via `confirm`); the window mirror is display-only (never gates a submit; server's 403 is sole authority); every error surfaced via `mapTournamentActionError` (mapped copy, server-message fallback — never swallowed). |
| 3 | Mutations in a NEW module (not the reads-only one)? | **YES** — `src/services/tournamentActions.js` (POST/Bearer); `tournamentGroupService` untouched. |
| 4 | Caps mirrored (claim 3, flip 5-per-pick)? | **YES** — pending count + per-pick `flipCountDate`-keyed counter (the server-matching ET-date mirror); double-submit blocked by a synchronous in-flight guard. |
| 5 | Round-boundary flow (advancer / eliminated / champion)? | **YES** — `RoundBoundaryView` + the new LeagueScreen `COMPLETE`/boundary branch; read-composition over bracket/rank; advancer hands off to `BoardCommitFlow`. |
| 6 | Zero fence / zero cron / zero new rules? | **YES** (38/40 cron; no `firestore.rules` change; no fenced file edited). |
| 7 | Tokens-native, reduced-motion-aware, flag-gated? | **YES** — `useTheme().tokens`, `useReducedMotion`, behind `TOURNAMENT_TAB_ENABLED` (false). |
| 8 | `/code-review` at max effort (the first client mutations)? | **RUN** — 5 findings fixed; dispositions in §4. |
| 9 | Tests | **2,726 passing** (2,691 prior + 35 net new across six P7-B/C batteries); client build clean. |
| 10 | Lint | Delta = the one baseline-class `motion` JSX-member flag (`RoundBoundaryView`, identical to the siblings). |

---

## 2. What shipped (file:line at tip `ca77e73`)

**B — nightly claim/flip window**
- `src/services/tournamentActions.js` — `placeClaim` / `flipPick` (POST via `fetchWithAuth`); reject on any non-2xx; `mapTournamentActionError` (known codes → copy, server-message fallback).
- `src/utils/tournamentActionMachine.js` — the optimistic reducer (idle→pending→confirmed|error; `confirmed` only via `confirm`; `reject` rolls back).
- `src/utils/tournamentSurfaces.js` — `getClaimWindowDisplay` (display-only window mirror + countdown; parity-locked).
- `src/components/Tournament/ClaimFlipWindow.jsx` — the two-tab surface; in-flight guard; confirmed-flip direction held until the subscription reconciles; double-down outcome.

**C — weekend round-boundary flow**
- `src/utils/roundBoundary.js` — `findLatestCompletedGameForUser` + `resolveRoundBoundary` (branch, composite placement, honest null placement, champion-terminal).
- `src/utils/roundBoundaryAck.js` — client-only localStorage ack + last-bracket pointer, safe-degrading.
- `src/components/Tournament/RoundBoundaryView.jsx` — the interstitial (result → bracket reveal → branch).
- `src/screens/LeagueScreen.jsx` — the boundary branch (before the no-group poster, so the eliminated still see it) + the `ClaimFlipWindow` mount.
- `src/screens/TournamentDevScreen.jsx` — both cards + a live dev rank doc for the smoke.

**Tests (35 new):** `tournamentActions.test.js` (10), `tournamentActionMachine.test.js` (7), `claimWindowMirror.test.js` (4 — server-parity sweeps incl. both DST transitions), `roundBoundary.test.js` (10), `roundBoundaryAck.test.js` (4).

---

## 3. The claim-window mirror (the Stage-0′ decision, as built)

`getClaimWindowDisplay` reproduces the server window logic (16:00→09:24 ET, weekend + Friday-evening closed) for the **countdown DISPLAY ONLY** — it never gates a submit; the server's `403 window_closed` is the sole authority on every claim. `tournamentTime.js` is untouched. A parity test (`claimWindowMirror.test.js`) sweeps UTC instants every 17 minutes across a normal week, the DST spring-forward (2026-03-08), and the DST fall-back (2026-11-01), asserting the mirror's `{isOpen, etTime, reason}` matches the server's `getTournamentClaimWindow` at every step — the drift-lock the founder specified.

---

## 4. /code-review (max effort) — findings + dispositions

**Fixed:**
1. **Double-submit race** (both tabs) — a `disabled` prop can't stop a same-tick double-click (state not committed) → two POSTs / two real flips. **Synchronous `useRef` in-flight guard.**
2. **Transient flip banner/row contradiction** — after confirm, the row briefly showed the stale leg while the banner said "flipped". **Hold the confirmed direction until the subscription reconciles.**
3. **Placement fabricated from seat order** when `finalScores` is missing → **placement is now null (never fabricated).**
4. **`isTerminal` false for a champion** at a round/totalRounds mismatch → **a champion is always terminal.**
5. **Dev smoke incomplete** — the eliminated rank line wasn't exercised → **dev screen now subscribes a live dev rank doc.**

**Verified won't-fix (with mechanism):**
- The window mirror gating a submit — it does NOT (parity-locked, display-only; server 403 is authority).
- `ClaimFlipWindow` on a COMPLETED group — **cannot happen in LeagueScreen** (`subscribeMyGroup` filters to forming|battle); the dev screen gates explicitly on `BATTLE`.
- The claim cap-3 count under-counting via `subscribeClaims` `limit(20)` — **bounded at V1's 4-player scale** (≤12 pending, all within the newest 20) and **server-authoritative** (a stale count still yields the honest `409`); docketed to the **P8 claim/flip read-budget watch**.
- The flip-cap counter going stale across an idle ET-midnight — display-only, **self-heals on the next snapshot**, server resets/enforces.

---

## 5. Guardrails / deploy status (house shape)

- **Cron:** none added — **38/40.**
- **Firestore rules:** **none added/changed — no Console deploy required.** Mutations ride the existing authed `place-claim`/`flip` endpoints; reads are the already-covered subscriptions.
- **Fence:** zero contact; Snake Draft engine untouched.
- **Flag:** `TOURNAMENT_TAB_ENABLED` stays **false** (smokable on the dev screen; League-home wiring dormant until P9).
- **Pushed ≠ deployed:** Vercel preview is the smoke surface.

---

## 6. Known limitations / notes (report, don't fix)

- **Eliminated interstitial is best-effort** by the zero-server-write design: the bracketId is recovered from a localStorage pointer written while the player was in the battle. A fresh load after elimination with cleared storage / a new device / no visit during the battle shows no interstitial (the player still sees their result on the leaderboard/rank surfaces). A server-side "last bracket" pointer would close this but is a new writer (out of P7 scope).
- **P8 hand-off items reaffirmed:** the claim/flip transaction read-budget watch (incl. the cap-count `limit(20)` scale), the ET-today helper convergence (a client copy exists here, matching the dev-screen precedent), Catalog #9 as a Pattern-A slice on the chat write, the AgentBattleScreen latent short double-negation (from A).

---

## 7. Founder smoke (dev screen / preview)

1. **Claim** — battle group: place a drop→add claim (watch the cap `n/3`, the banked-points copy, pending then resolved via subscribeClaims); attempt one against a closed window → the honest `403` surfaces (the countdown shows closed but never blocks the button).
2. **Flip** — flip a pick (watch the per-pick `n/5`, the "now at $X / banked Y" vs "at next open" branch by market state, a `formed`/`flipped` double-down outcome + the group feed); double-click → only one flip fires.
3. **Round boundary** — advance a dev bracket round → the interstitial resolves: advancer (CTA → reopened board commit), eliminated (end-of-run + rank line), champion (recap). Re-walk after each advancement (the dev card bypasses the localStorage ack).

---

## 8. Status
P7 is complete after this merges (A live; B+C here). Remaining: **P8** (integration sweep + hygiene ledger) and **P9** (flag flip + launch).
