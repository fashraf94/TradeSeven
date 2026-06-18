# League Training — Slice 5a Phase Report: Battle-View Host + Claims/Flips

**Date:** 2026-06-18 · **Branch:** `claude/great-tesla-bejhye` (fresh off `main` `fe6d1ee`) · **Type:** build phase report + durable artifact (BUILD_RULES §3/§8).
**Scope:** client-only. Host = (iii) thin reuse view (founder-ruled). No `api/` changes. Stays dark (dev-param only).

---

## What shipped

A post-draft League training pod (`tournamentGroups`, `isTraining:true`) had **no destination** — the interactive draft dead-ended at a "Draft complete → dashboard" card. Slice 5a builds that destination: a thin, training-framed battle view that **reuses** the existing tournament battle-content components, with **no ranked chrome**.

### Files (6: 3 new, 3 modified)

| File | Change |
|---|---|
| `src/screens/leagueTrainingBattleFraming.js` | **NEW** — pure helpers `trainingStatusFraming(status)` + `deriveCompositeContext(pod, uid)`. Imports only the zero-import constants module (Node-clean → unit-testable without the view's client graph). |
| `src/screens/leagueTrainingBattleFraming.test.js` | **NEW** — 8 vitest unit tests (status framing + composite derivation incl. the `computeComposite` degrade and pre-banking zeros). |
| `src/screens/LeagueTrainingBattleView.jsx` | **NEW** — the host view. Reads pod via `subscribeGroup(podId)` (surfaces `AWAITING_OPEN`+`BATTLE`), agent battle via `useMyTournamentBattle(podId)`. Composes `Flat6BattleView` (agent, 6) + `ClaimFlipWindow` (user, 3, claims/flips) + `DraftPlaybackTheater` + `GroupFeed` under a practice banner + training header. |
| `src/screens/index.js` | export `LeagueTrainingBattleView`. |
| `src/App.jsx` | barrel import; `trainingBattlePodId` state + `?trainingBattle=<podId>` dev parse (mirrors `?trainingDraft`); `screen === 'trainingBattle'` block; **re-pointed the draft-complete `onExit`** to navigate into the battle view (carrying the pod id) instead of the dashboard. |
| `src/screens/TrainingDraftRoomScreen.jsx` | relabel the terminal card button "Done" → "View your pod" (1 line; the only edit). |

### Reuse (no new battle UI; no edits to shared content components)
`subscribeGroup` (`src/services/tournamentGroupService.js:43`), `useMyTournamentBattle` (`src/hooks/useMyTournamentBattle.js:22`), `getWeeklyComposite`/`getWeeklyScore`/`round2` (`src/constants/leagueTournament.js:874-890`), and `Flat6BattleView`/`ClaimFlipWindow`/`DraftPlaybackTheater`/`GroupFeed` (`src/components/Tournament/`). Composition mirrors `LeagueParticipantView.jsx:161-200`; nav idiom mirrors `App.jsx:2206-2213` + the `battle` screen analog `:9107-9130`.

---

## P0 verification (read-only, pre-build — all clear)

- **P0.1 playback → IN.** Training writes all three `DraftPlaybackTheater` inputs: `streams/userDraft` (`api/_utils/trainingLifecycle.js:473`); at activation `streams/agentDraft` via `resolveAgentDraftForGroup` (`api/_utils/tournamentOrchestrator.js:741`) + `agentBoards` via `produceGroupBoards` (`:729`). Panel included (real data, degrades gracefully if any absent).
- **P0.2 pod-by-id.** `subscribeGroup` is an unfiltered single-doc read → surfaces `AWAITING_OPEN`+`BATTLE` (VERIFIED `tournamentGroupService.js:43-54`).
- **P0.3 agent battle by (uid, podId).** Training battle stamped `ownerId=odUserId`, `groupId=podId`; `odUserId === auth uid` → `useMyTournamentBattle(podId)` matches (VERIFIED).

---

## Verification results

- **New unit tests:** `leagueTrainingBattleFraming.test.js` — **8/8 pass.**
- **Broad suite (`vitest run`):** **3023 passed, 5 failed.** The 5 reds are the **known-stale** set, all in `api/_utils/` (`p4Flips.test.js` ×2, `tournamentLobbyFormation.seam.test.js` ×3). Report-don't-fix (BUILD_RULES §3) — this slice is client-only and touches no `api/` module, so it cannot affect them.
- **Production build (`vite build`):** **✓ built in ~28s** — the new view + App.jsx wiring resolve and bundle (only the pre-existing chunk-size warning).
- **Fence — GO/CLEAN.** `git diff --name-only` shows **zero `api/` files**; the 8 §1 files are untouched (read/call-only; the one fence adjacency, `createAgentBattle`/`agentScoring`, lives in the Slice-3 activate path and is not touched here).

### Pre-existing item found (report, don't fix — BUILD_RULES §3)
`src/screens/TrainingDraftRoomScreen.jsx:49` destructures `onClockId` from `useTrainingDraft` but never uses it → `no-unused-vars` lint error. Present on `origin/main` (`fe6d1ee`), unchanged by this slice's one-line button relabel. Flagged for separate tasking.

---

## Smoke (Vercel preview — to observe on the preview deploy)

Crons don't run on preview (BUILD_RULES §6), so this is observed, not cron-tested:
1. `?trainingDraft=<groupId>` → form → complete the draft → land on the training battle view → agent layer (6), claims/flips (3), composite (`agent + 1.5× user`, practice-framed), feed, **draft playback**.
2. `?trainingBattle=<podId>` on an **`AWAITING_OPEN`** pod → renders (proves the pod-by-id read, not `subscribeMyGroup`).

---

## Carry-forwards to Slice 5b (flagged, not built)

- **★ MANDATORY with 5b — `subscribeMyGroup` ranked-vs-training exclusion.** Once 5b makes training live, a training pod in `BATTLE` can be picked up by `subscribeMyGroup` (no `isTraining` filter, most-recent-wins) and mis-rendered by the ranked `LeagueParticipantView`. Harmless in 5a (no live training pods; dev-only), but the ranked surface must exclude `isTraining` pods when 5b lands.
- **C1-gap** loadout-spec capture→persist→thread (`ensureTrainingClones` takes the param; no caller passes it).
- **Resume** subscription gap (`subscribeMyGroup` excludes `DRAFTING`).
