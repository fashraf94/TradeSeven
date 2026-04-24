# Forge Expansion Sprint v3 — Future Bookmarks

Consolidated list of items deferred during the sprint. Sources: mid-sprint audit (Turn 4), phase-end "Flags / items for later phases" sections, and inline `TODO`/future-sprint comments added during implementation.

Format: each item has a **reference** (which phase flagged it), a **description** of what's deferred, a **reason** it was deferred from the sprint, and where known, an **estimated effort** and **trigger** (what would prompt the work).

---

## Architectural cleanup

### B3 — One-time Firestore backfill for cached bundles
- **Reference:** Audit bookmark B3; Phase 4.5 deferral.
- **Description:** Backfill canonical field names from legacy names across `workshopTheses.compiledDimensionValues`, `bundles.dimensionValues`, `seasonEntries.dimensionValuesAtLaunch`. After this runs, all reads can drop the legacy fallback branch in `FIELD_REGISTRY`.
- **Reason deferred:** needs a production migration plan (batch size, idempotency window, rollback). Not urgent — the canonical reader handles legacy reads transparently at runtime.
- **Estimated effort:** 1-day cron + dry-run tooling. Plus a verification sweep.
- **Trigger:** before B4 can land. Alternatively, when a compaction pass becomes worthwhile.

### B4 — Remove legacy fields from `DIMENSION_DEFAULTS`
- **Reference:** Audit bookmark B4; explicit deferral in Phase 4.5 commit.
- **Description:** Delete the 17 legacy keys from `DIMENSION_DEFAULTS` (`stopLoss`, `rsiUpper`, `profitTarget`, etc.). Simplify `readField(oldName)` fallbacks to `obj?.[newName]`. Drop `legacy[]` arrays from `FIELD_REGISTRY` entries. ~200 LOC net deletion.
- **Reason deferred:** depends on B3 (cached bundles must be migrated first) and on confidence that no external consumer reads the legacy shape.
- **Estimated effort:** 2-3 hours once B3 is done.
- **Trigger:** after B3 ships and runs clean in production for N weeks.

### Vestigial `momentumSensitivity.momentumThresholdPct` duplicate
- **Reference:** Phase 4.5 discovery, flag 3.
- **Description:** Phase 2's Haiku prompt emits both `entryAggression.momentumThresholdPct` and `momentumSensitivity.momentumThresholdPct` (the latter is vestigial per spec §4.5). Registry only reads the former. Dead write that costs a few tokens per compile and a field in persisted bundles.
- **Reason deferred:** benign — not a correctness issue.
- **Estimated effort:** 5 minutes in the Haiku prompt.
- **Trigger:** any future Phase 2 revision.

---

## Scaling preparedness

### B1 — Solo-season ID 16-char expansion + collision guard
- **Reference:** Audit bookmark B1; Phase 3 discovery.
- **Description:** Current `solo-{sha256(userId|startDate|durationDays).slice(0, 12)}` is 48-bit. Adequate today; ~4% collision probability per year at 100k DAU. Expand to 16 hex chars (64-bit) and add ownership-verification guard at `create-entry.js:432` (`if (existing.exists && existing.data().ownerId !== user.uid) { regenerate with user-salted nonce }`).
- **Reason deferred:** current scale doesn't warrant it; no cross-user collisions observed.
- **Estimated effort:** 30 minutes.
- **Trigger:** before any marketing push or onboarding surge that takes DAU past ~50k.

### B5 — Orphan solo-season TTL cleanup cron
- **Reference:** Audit 3A; Phase 3 commit note.
- **Description:** Scheduled cron that deletes solo seasons with `entryCount === 0` after N days. Handles the case where a user opens the modal, triggers solo-season creation, but abandons before the entry-creation transaction completes.
- **Reason deferred:** orphans are inert (< 1 KB each, no cron work against them, no leaderboard impact). Grows monotonically but at negligible rate.
- **Estimated effort:** 1 hour (new cron file + schedule).
- **Trigger:** if monthly Firestore seasons doc count grows visibly faster than active-entries count.

---

## Product features

### B6 — End-of-tournament debrief
- **Reference:** Phase 3 commit note; Phase 5.5 implicit.
- **Description:** Tournament sessions have no end-of-session summary today. Solo sessions got one via the relaxed final-week pit-stop guard in Phase 3. When Season Mode tournament resume kicks off, extend the same pattern to tournaments (either reuse `isSoloFinalWeek` with a new flag, or introduce a dedicated endpoint).
- **Reason deferred:** tournament mode is out of sprint scope per spec §0.
- **Estimated effort:** ~1 day when tournament resume starts.
- **Trigger:** whenever the Season Mode tournament feature resumes development.

### B7 — Duration-aware Haiku recompile on duration change
- **Reference:** Spec §7.7 "Does not re-trigger Haiku compile on change — that's a future enhancement."
- **Description:** Today when the user bumps the duration picker in Step 2 (e.g., 20 → 5 days), the compiled `dimensionValues` doesn't reshape. A 20-day strategy suddenly running for 5 days keeps its long SMAs and patient profit targets — potentially suboptimal. Enhancement: detect duration change, trigger re-compile with new `userSelectedDurationDays`.
- **Reason deferred:** scope creep risk in Phase 4; also Phase 2's Haiku cost for re-compile on every change would need rate-limiting.
- **Estimated effort:** ~half-day (client-side change + rate limit + UX confirmation dialog).
- **Trigger:** if user testing shows duration-change abandonment or visible complaints about "my 1-week test still has 100-day SMAs."

### B8 — Tournament mode entry UI path
- **Reference:** Phase 4 commit note.
- **Description:** Phase 4's UI always sends `mode: 'solo'`. When tournament resume lands, there needs to be either a separate "join tournament" UI surface or an intra-modal mode toggle.
- **Reason deferred:** no current user path reaches tournament launch.
- **Estimated effort:** depends on product decision — toggle (1 day) vs separate entry point (2-3 days).
- **Trigger:** tournament resume.

### 3M sector-momentum timeframe
- **Reference:** Phase 1.5 discovery.
- **Description:** SE-09's timeframe enum is currently `['1D', '1W', '1M']`. Spec mentioned 3M; deferred because `compute-index-intelligence.js:275–291` doesn't emit `quarterChange` in `sectorSnapshot`.
- **Reason deferred:** cross-sprint dependency on the cron change. Also the least-used timeframe for 1-4 week backtests.
- **Estimated effort:** ~15 minutes total (cron line change + enum update + UI chip).
- **Trigger:** when any future sprint touches `compute-index-intelligence.js`, bundle the 3M addition in.

---

## Operations / monitoring

### `mappingNotes` override-rate monitoring
- **Reference:** Phase 5.5 flag.
- **Description:** `applyDurationAuthority` pushes a `"Preserved Workshop duration recommendation"` note into `mappingNotes` when Haiku disagrees with Gemma's duration. These notes get persisted to `workshopTheses` and shadow-logged. If the rate is high, the Phase 5.5 prompt-level deference instruction isn't sticking and needs revision.
- **Reason deferred:** not visible until real production traffic accumulates.
- **Estimated effort:** ~30 minutes to set up a dashboard query or alert.
- **Trigger:** N weeks after Sprint merge — ideally first post-launch review.

### Live Gemma smoke pass
- **Reference:** Phase 5 + 5.5 flags.
- **Description:** The Workshop prompt's three conversation patterns (inference, ask, ask-followup) are validated structurally by the Phase 5 test but not with live Gemma calls. A real OpenRouter call for each scenario would confirm the patterns work as designed. Manual smoke tests in `PHASE_6_MANUAL_SMOKE_TESTS.md` cover this partially.
- **Reason deferred:** cost-bounded + nondeterministic tests don't fit CI gate.
- **Estimated effort:** ~30 minutes manual; ~2 hours for a scripted reproducer bank with seeded prompts.
- **Trigger:** post-merge verification.

### Post-deploy guardrail spot-check
- **Reference:** Phase 4.5 M2 fix + Phase 6 Test 6.
- **Description:** The M2 regression is locked by unit tests, but production confirmation needs one real deploy-to-agent cycle with a custom stop-loss value, then Firestore inspection to confirm the guardrail matches the user's slider value. Currently covered by Phase 6 Test 6 in the manual smoke doc.
- **Reason deferred:** manual step, not automatable without a full e2e harness.
- **Trigger:** first real Deploy-to-Agent post-merge. Record the observation.

---

## Manual verification needed post-merge

| Item | Where |
|---|---|
| Live Gemma Workshop conversation smokes (6 scenarios) | `PHASE_6_MANUAL_SMOKE_TESTS.md` |
| M2 fix Deploy-to-Agent guardrail check | Test 6 in same doc |
| First real compile inspection (workshopTheses doc) | Post-merge |
| Firestore storage impact on `workshopTheses` | 1 week post-merge; check average doc size + growth rate |
| OpenRouter token usage shift (Phase 5 prompt ~800 tokens longer) | 1 week post-merge; check `tokenUsage` shadow log averages |

---

## Consolidation recommendation

Create one GitHub issue per category heading (5 issues total). Tag each with the relevant bookmark codes (B1–B8) and link back to this document. Items within a category can share an issue if they'll likely be picked up together (e.g., B3+B4 as "canonical-only migration pair").
