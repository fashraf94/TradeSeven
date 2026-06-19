# Training Draft Board — Phase 1 Code Review

**Date:** 2026-06-19 · **Branch:** `claude/laughing-wozniak-ox1xhu`
**Scope reviewed:** the Phase 1 diff (14 files, +1401/−1 at commit `053ff6c`) — the redesigned Training Draft Board behind `TRAINING_BOARD_REDESIGN_ENABLED`.
**Method:** `/code-review` at high effort — 3 independent finder agents (line-by-line correctness on the room+hook; correctness on the atoms; cross-file/removed-behavior + reuse + conventions), candidates verified, deduped, triaged.
**Outcome:** no fence contact, no contract breakage. 7 issues fixed; 7 noted as decisions. Build green, lint clean (1 pre-existing warning), `boardModel` unit tests 20/20, legacy training tests 132/132.

---

## Verdict table

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | Board renders every name at fit 0 / "Reach" if `draft` arrives before `universe` loads | Med (UX) | **Fixed** — loading gate now waits on `universe` too (`DraftBoardRoom.jsx`) |
| 2 | `ClockRing` renders a red, pulsing "0" for the `null` (loading) clock — looks expired | Low (UX) | **Fixed** — `null` now reads neutral ("—", ink3, no pulse) (`draftPrimitives.jsx`) |
| 3 | `reasonFor` emits "… — — volatility" for degen/guardian when `atrPercentile` is null | Low (UX) | **Fixed** — phrasing guarded on `volKnown` (`boardModel.js`) |
| 4 | `momRank` truthiness drops a legitimate rank of 0 (inconsistent with `StockCard`'s `!= null`) | Low | **Fixed** — `momRank != null` (`boardModel.js`) |
| 5 | `alpha()` returns opaque black `rgba(0,0,0,a)` on a bad/undefined hex (NaN) | Low (robustness) | **Fixed** — `Number.isNaN` guard → transparent (`draftTokens.js`) |
| 6 | `doConfirm` submitted the raw selected string without checking it's still on the live board | Low | **Fixed** — gates on `selectedRow`, submits `selectedRow.symbol` (`DraftBoardRoom.jsx`) |
| 7 | File header comment on `TrainingDraftRoomScreen.jsx` was stale (described Slice 2, not the switch) | Doc | **Fixed** — header rewritten |
| 8 | `alpha()` duplicates `alpha`/`hexToRgba` utils elsewhere in the repo | Reuse | **Decision: keep** — see below |
| 9 | `Orb` overlaps the shared `AgentOrb` component | Reuse | **Decision: keep** — see below |
| 10 | Tuning constants (`DIVERSIFY_SECTOR_PENALTY`, tier bands) live in the component dir | Convention | **Decision: keep, documented** — see below |
| 11 | `useNarrow` keys off `window.innerWidth`, not container width | Low | **Decision: acceptable** — full-screen mount |
| 12 | CPU seat labels (`CPU {seatIndex}`) | Cosmetic | **No change** — human is verified seat 0, so CPUs read 1/2/3; matches legacy |
| 13 | `ownedSectorCounts` could miss a pick not in `pool` | Low | **Refuted** — the human's picks are always drawn from `pool`, so they're in `poolRows` |
| 14 | `members` `react-hooks/exhaustive-deps` warning | Lint | **No change** — pre-existing on the legacy `seats` memo, not introduced here |

---

## Fixes (detail)

1. **Universe-load flash.** `useTrainingDraft` reads the draft state and the universe doc in two independent effects; the state can resolve first. The loading guard now requires both: `if ((!draft || universe == null) && !isComplete)`. Prevents a sub-second render of every name at fit 0 in the "Reach" tier.
2. **Idle clock.** `ClockRing` treated `seconds == null` as `0`, which tripped the `≤5s` red+pulse "expiring" styling on the "Forming the board…" screen. `null` now renders neutral (ink3, "—", no pulse); a real `0` still reads red.
3. **Reason copy.** `volTextFromAtr(null)` returns `'—'`; the degen (≥82) and guardian (≥68) lines interpolated it as "… — — volatility". Guarded on `volKnown` with a clean fallback.
4. **Falsy-zero rank.** Momentum reason used `momRank ? …`; switched to `momRank != null` to match how `StockCard` renders the rank.
5. **`alpha()` robustness.** A non-hex input made `parseInt → NaN → rgba(0,0,0,a)` (silent opaque black). Now returns transparent on NaN. (No current caller hits this; all tints are defined constants — a latent guard.)
6. **`doConfirm` hardening.** Both layouts already gate the Confirm control on `selectedRow`, but `doConfirm` guarded on the raw `selected` string; it now gates on `selectedRow` and submits `selectedRow.symbol`.
7. **Header doc.** Rewrote the file header to describe the flag switch + the preserved legacy body.

## Decisions (noted, not changed)

- **#8 `alpha` / #9 `Orb` duplication.** Spec §5 explicitly calls for a **self-contained, reusable League draft atom library** (`StockCard`, `TierHeader`, `SnakeStrip`, `SeatCard`, `PickPanel`, the advisor **Orb**) so the ranked tournament draft can inherit it (§7). The existing `alpha` lives in feature modules (`Forge/workshop/forgeKit`, `Dashboard/commandUI`) and `AgentOrb` is a framer-motion component with a different API; importing either would couple the draft library to unrelated surfaces and risk drift from the design's CSS-only Orb. Keeping them local is the intentional, portable choice — the design's own pattern. If a shared `src/utils` color util is later established, the draft library can adopt it in one place.
- **#10 tuning constants.** `DIVERSIFY_SECTOR_PENALTY` (26) and the tier bands (≥82/≥68/≥50) are **display-overlay tuning on a precomputed read**, not scoring-engine math (the calibration fence is untouched — these are not in BUILD_RULES §1). They carry explicit "founder-tunable / re-tune against live arch_scores" comments so the next tuning pass can find them. Recommend the founder eyeball the live tier distribution on preview and adjust if "Top tier" comes out too large.
- **#11 `useNarrow`.** Keys off `window.innerWidth` with a resize listener; the training draft mounts full-screen, so container-vs-window divergence isn't a real case here.

---

## Fence & contract confirmation

- **No calibration-fence file touched** (BUILD_RULES §1). `boardModel.js` does a **direct read** of precomputed `arch_scores` — it does not recompute or copy scoring math (§4). `archetypeScoring.js` (the non-fenced engine) is neither edited nor re-implemented.
- **`useTrainingDraft` widening is purely additive** — no existing return field changed or removed; `members`/`currentUserId`/`onClockSeatIdx` were already local computations. The legacy `boardBySector`/`highlightSet` path is intact, so flag-off renders byte-identically.
- **Default export contract preserved** — `TrainingDraftRoomScreen({ user, groupId, onComplete, onExit })` unchanged; both call sites (`src/App.jsx:9011`, `src/screens/index.js`) work via prop spread.
- **★ Prime directive** — the redesign writes only local draft state through `applyTrainingPick`; it never writes the ranked agent. To be re-verified on the Vercel preview smoke (customize → enter → draft a pod, confirm the ranked agent is unchanged).

---

## Phase 2 addendum — the opponent reveal

**Scope:** `RevealRow.jsx` + `SnipeCallout`, `useDraftReveal.js` (the controller), `PickPanel.jsx` (revealing state), `DraftBoardRoom.jsx` (wiring). New tests in `useDraftReveal.test.js` (6). Build green, lint clean, tests 26/26.

**What it does:** the server resolves the CPU run-up in one transaction, so the client gets all the new picks in a single snapshot. `useDraftReveal` detects the newly-arrived CPU picks since the last consumed point and replays them pick-by-pick (~0.52s first, ~1.18s each), marking a **snipe** when a CPU took a name that sat in the human's pre-pick top tier (#1–6). It never replays history on mount; honors `prefers-reduced-motion` (instant step, no flash); and offers a **skip/fast-forward**. The reveal phase wins over `your-turn`/`done` so the run-up plays before the board unlocks / the lineup locks.

**Self-review finding fixed during the build (the load-bearing race):** snipe detection must compare CPU picks to the **pre-pick** board, but capturing those ranks in an effect keyed on `isMyTurn` was overwritten by the **post-run-up** board on the same snapshot commit (effects run before the reveal's `setRev`). Fixed by capturing synchronously in `doConfirm`, tagged with the pick index (`{ atIndex, ranks }`), and only trusting the capture for the run-up whose triggering human pick matches `atIndex`. As a bonus this makes clock-autopick-triggered run-ups show **no false snipes** (no capture → index mismatch → empty ranks) rather than wrong ones.

**Known V1 behavior:** the real 20s pick clock keeps running during the reveal (max run-up ≈ 7.4s ≪ 20s, so it cannot expire mid-reveal); the skip button reclaims the time. A clock pause during reveal was considered and deferred as unnecessary for V1.
