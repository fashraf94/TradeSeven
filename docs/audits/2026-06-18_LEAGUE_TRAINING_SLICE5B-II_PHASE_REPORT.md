# League Training — Slice 5b-ii Phase Report: Loadout Chooser

**Date:** 2026-06-18 · **Branch:** `claude/charming-darwin-sa3uxf` (off `main` `13be17c`, includes 5b-i) · **Type:** build phase report + durable artifact (BUILD_RULES §3/§8). **The last build of the training arc.**
**Scope:** Tier 1 (archetype + watchlist) · Interaction Option 2 (fast-start unchanged + additive "Customize" path) · built directly (no Design mockup). Both phases on ONE branch.

---

## What shipped

5b-i turned training on: the one-tap CTA forms a practice pod on a **pure-inherit clone** of the player's ranked agent. 5b-ii lets a player optionally pick a **different archetype + watchlist** for the practice agent — the no-stakes experimentation value — without ever touching their ranked agent.

The 5b discovery found the carrier plumbing was **not** grounded (the 5a "C1-gap": the clone-side sink accepts a `loadoutSpec`, but no caller captured/persisted/threaded one). So this slice built the full **capture → whitelist → persist → thread** chain plus the chooser UI.

### Files (14: 3 new, 11 modified)

| File | Change |
|---|---|
| `api/_utils/trainingLoadoutSpec.js` | **NEW** — the spec **whitelist** (`validateLoadoutSpecShape`): Tier-1 keys only (`archetype` required ∈ `VALID_ARCHETYPES`; `equippedWatchlistId` optional, null = "no watchlist"). The security boundary; rejects `config`/traits/bundles/identity keys. |
| `api/_utils/trainingLoadoutSpec.test.js` | **NEW** — 9 unit tests (accept/normalize, null-watchlist, reject bad archetype / Tier-2 keys / non-objects). |
| `src/components/League/LoadoutChooserSheet.jsx` | **NEW** — the **controlled** chooser: reuses `ArchetypeCard`/`ARCHETYPE_ORDER` atoms + the `listWatchlists()` committed-row pattern in the `EquipSheet` shell; writes only LOCAL draft state; emits `{archetype, equippedWatchlistId}`. Never calls `changeArchetype`/`equipWatchlist`. |
| `api/tournament/lobby-quickplay-training.js` | Validate `body.loadoutSpec` (shape + async **watchlist-ownership** read mirroring `equip-watchlist.js:83-99`; name **server-derived**), after the no_agent/already_active gates; pass to `formTrainingDraft`. |
| `api/_utils/trainingLifecycle.js` | `formTrainingDraft` accepts `loadoutSpec`; persists `loadoutSpecByUser:{[odUserId]:spec}` in the FORMING→DRAFTING tx (only when present). |
| `api/_utils/tournamentOrchestrator.js` | `:718` threads `group.loadoutSpecByUser` into `ensureTrainingClones` (~1 line). |
| `src/services/tournamentLobbyActions.js` | `quickPlayTraining` accepts `{loadoutSpec}` (omitted → body unchanged from 5b-i). |
| `src/components/Dashboard/ArchetypePicker.jsx` | Exported `ArchetypeCard` + `ARCHETYPE_ORDER` as reusable atoms (live picker unchanged). |
| `src/components/League/LeagueLobbyRedesign.jsx` | `TrainingShell`: factored `runTrainingForm(spec)` shared by fast-start (no spec) + chooser; added the secondary "Customize loadout" affordance + sheet; `LobbyTabbed` threads `agentLoadout`. |
| `src/App.jsx`, `src/screens/LeagueScreen.jsx`, `src/components/League/LeagueHome.jsx` | Thread the read-only `agentLoadout` prefill down the existing `hasAgent` chain. |
| `api/_utils/tournamentOrchestrator.test.js` | +1 full-chain test: a group carrier drives the provisioned clone's archetype/watchlist (not the ranked loadout). |
| `api/tournament/lobby-endpoints.test.js` | +7 tests: persist (named server-derived), null-watchlist, fast-start no-carrier, reject bad archetype / Tier-2 key / non-owned / uncommitted watchlist. |

### The governing correctness property
**The chooser never writes the live ranked agent.** The dashboard pickers commit-on-select (`changeArchetype`/`equipWatchlist`); reusing them would mutate the ranked agent pre-formation. The chooser composes only presentational **atoms** and writes to local draft state; the server persists the spec and the clone applies it. Smoke gate #3 below guards this.

### Reuse (no new battle/loadout logic)
`ArchetypeCard`/`ARCHETYPE_ORDER` + `getArchetypeDisplayName`/`getArchetypeIdentity` (atoms), `EquipSheet` shell, `listWatchlists()`/`filterWatchlistsByStatus(…,'committed')`, the existing `ensureTrainingClones`/`buildTrainingCloneDoc` sink (unedited), `VALID_ARCHETYPES` (`agentArchetypeConfig.js:232`), the `equip-watchlist.js:83-99` ownership pattern.

---

## Verification results

- **New/changed unit tests:** `trainingLoadoutSpec` 9/9 · `lobby-endpoints` 27/27 (incl. 7 new) · `tournamentOrchestrator` 44/44 (incl. the full-chain test) · `trainingClone` 12/12. All green.
- **Broad suite (`vitest run`):** **3048 passed, 5 failed.** The 5 reds are the **known-stale** set (`p4Flips.test.js` ×2, `tournamentLobbyFormation.seam.test.js` ×3) — **confirmed pre-existing** by `git stash` (same 5 fail at clean HEAD `13be17c` without this slice). Report-don't-fix (§3).
- **Production build (`vite build`):** ✓ built in ~30s (only the pre-existing chunk-size warning).
- **Fence — GO / CLEAN.** No §1 file edited (`git status` shows none of the 8). One **permitted fenced read**: `import { VALID_ARCHETYPES }` from `agentArchetypeConfig.js` (reading/calling a fenced export is allowed; avoids a §4 divergent copy). The spec only changes *which* loadout values the non-fenced `buildTrainingCloneDoc` writes; `decide.js` reads the clone like any agent; `createAgentBattle` shape untouched.
- **`/code-review` (high effort):** 8 finder angles → verify. **0 correctness findings** (server + client both clean). 3 cleanup candidates: one low-value style duplication kept by design (the two-section `children` body precludes `EquipSheet`'s `rows`), two refuted (JSX-memo anti-pattern; the inline ownership check is the correct pattern — `resolveEquippedWatchlist` does not check ownership).

---

## Smoke (Vercel preview — to observe; gated behind `LEAGUE_NEXT_ARC_ENABLED` / `?nextArc=1`)

1. **Default path (regression):** primary CTA → pod on the ranked loadout, no spec → clone pure-inherits. 5b-i unchanged.
2. **Customize path:** "Customize loadout" → sheet pre-filled with the ranked archetype/watchlist → change them → "Start practice" → pod forms → the agent-layer clone reflects the choice.
3. **★ Ranked-agent-unchanged (correctness gate):** after picking a *different* archetype and starting, the ranked agent still has its original archetype/watchlist.
4. **Re-entry:** a Customize-formed pod re-enters via the 5b-i re-entry bar.

---

## Carry-forward (flagged, not built — report-don't-fix)
- **Tier 2 (traits/bundles) remains deferred:** the whitelist rejects those keys precisely because the clone copies the *ranked* agent's rules/bundles **subcollections** (`trainingClone.js:118-126,167-168`); overriding the pointers needs the subcollection copy redirected — a separate task.
- The 5a-flagged `subscribeMyGroup` `isTraining` exclusion and the `TrainingDraftRoomScreen.jsx:49` unused-var lint are outside this slice's scope.
