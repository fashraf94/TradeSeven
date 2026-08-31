# Backlog — `baseLayerWeek` stamps the FORMATION week on the legacy lobby path

**Filed:** 2026-08-28 · **Status:** backlog, not scheduled · **Severity:** medium-high (cohort membership, not cosmetics)
**Found during:** pre-open phase routing, Phase 4 pre-work. Out of scope there; filed per BUILD_RULES §3 (report, don't fix).
**Own task, own branch, own Phase 0.** Nothing in this file has been changed.

---

## The defect

Two formation paths stamp `baseLayerWeek`, and they disagree about what the field means.

| Path | Site | Stamps | Correct? |
|---|---|---|---|
| Competitive live-draft slot | `api/_utils/liveDraftFormation.js:301` | `deriveBaseLayerWeek(battleStartWeek)` — the **battle** week | ✅ |
| Legacy lobby formation | `api/_utils/tournamentLobbyService.js:109` and `:349` | `isoWeekString(now)` — the **formation** week | ❌ |

The slot path's own docstring (`liveDraftFormation.js:210-219`) documents this exact bug class as already fixed on its side, and says why it matters — VERIFIED, quoted:

> *"A pod claimed on a Wed/Sat/Sun plays the FOLLOWING ISO week, so keying `baseLayerWeek` on the claim instant (`isoWeekString(now)`) filed it a week early in the base-layer cohort / leaderboard / advancement (all `baseLayerWeek ==` scoped)."*

The legacy lobby path was never brought along.

## Why it is worse than the label it was noticed for

`baseLayerWeek` is an equality-scoped key, so a mis-stamp does not degrade a value — it moves the pod into the wrong cohort entirely:

- **THE FIELD** — `subscribeBaseLayerGroups` queries `where('baseLayerWeek','==', currentWeek)` (`src/services/tournamentGroupService.js:320-324`), with `currentWeek = isoWeekString(new Date())` (`src/hooks/useRealLeagueState.js:52-54`). A lobby formed on a Saturday or Sunday is filed under the **outgoing** ISO week, so on Monday — the week it actually plays — **it does not appear in the field at all**.
- The same `baseLayerWeek ==` scoping governs the **leaderboard** and **advancement** paths named in the docstring above.

A weekend-formed pod silently missing Monday's field is a materially larger problem than any status label.

## What a Phase 0 must answer before code

1. **Blast radius of a corrected stamp.** Every `baseLayerWeek ==` consumer — field query, leaderboard aggregation, advancement, the one-competitive-group-per-battle-week guard (`liveDraftFormation.js:279-288`, `tournamentLobbyService.js:74-82`). Does moving a pod's cohort change any of those beyond making it correct?
2. **Existing documents.** Groups already stamped with a formation week are live data. Is a migration needed, or does the fix apply only to newly formed groups? A mixed population must not double-count in the leaderboard.
3. **Does the lobby path even know its battle week at formation time?** The slot path derives it from `battleStartWeek`, which is stamped at claim. The lobby path has no equivalent — so the fix may require deriving a battle Monday first, which is its own decision.
4. **Weekend formation frequency.** How often does the defect actually fire? A Mon–Fri formation stamps the same week either way and is unaffected.

## Explicitly NOT the fix

Do not derive the pre-open display phase from `baseLayerWeek` as a substitute for a missing `startAnchor` — that was considered and **rejected** in the pre-open routing arc precisely because this field carries a known stamping bug. Correctness must not be built on it.

## Citations (all VERIFIED 2026-08-28, at `6684f3e0`)

- `api/_utils/tournamentLobbyService.js:109`, `:349` — `baseLayerWeek: isoWeekString(now)`
- `api/_utils/liveDraftFormation.js:301` — `deriveBaseLayerWeek(battleStartWeek)`
- `api/_utils/liveDraftFormation.js:210-219` — the docstring naming this bug class
- `src/services/tournamentGroupService.js:320-324` — the `baseLayerWeek ==` field query
- `src/hooks/useRealLeagueState.js:52-54` — `currentWeek` from the wall clock
