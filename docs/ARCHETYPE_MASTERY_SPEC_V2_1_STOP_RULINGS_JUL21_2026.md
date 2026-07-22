# Archetype Mastery — Phase 0 STOP Rulings & P1 Greenlight

> **Transcription note (P1 session, July 21, 2026):** this document is the verbatim transcription of the founder's Phase 0 ruling memo, relayed in-chat to the P1 build session (the "verbatim founder paste" precedent — `FANTASYTRADES_PRELAUNCH_SEQUENCE_AMENDMENT_A_JUN10_2026.md`). Content is the founder's; only markdown structure was normalized in transcription. It self-describes as the **V2.1 delta** to `ARCHETYPE_MASTERY_SPEC_V2_LOCKED.md` and wins conflicts with it. Immutable once added (docs maintenance rules).

---

**Date:** July 21, 2026
**Re:** `ARCHETYPE_MASTERY_PHASE0_DISCOVERY_20260720.md` — both STOPs ruled; remaining deliverables ruled. This memo is a V2.1 delta to `ARCHETYPE_MASTERY_SPEC_V2_LOCKED.md`; where they conflict, this memo wins. Commit the Phase 0 report to `docs/audits/` as proposed. Answer to your closing question: no separate build-plan draft needed — this memo is the resolution; build per spec §12 with the deltas below.

## STOP-A — RULED: convert the settlement write; scope the fence out

1. `completeBattle` → guarded `runTransaction` (regimeAtStart pattern, `agent-evaluate.js` — non-fence): **APPROVED** as part of P1 Phase 1. The transaction commits `status: completed` + `masteryEligibility` stamp atomically, write-once guarded, per spec §5.1.
2. The two fenced `decide.js` expiry-completions (`:588`, `:1115`): **option (a) — structurally outside mastery.** No fence contact. They receive no stamp; the sweep (stamps-only) correctly never touches them; they earn nothing. They still occupy slot ranks (creation-time fact, spec §3).
3. §5.1 invariant restated (V2.1): "Every battle completed via the settlement path carries an eligibility stamp atomic with its completion. Fence-path expiry completions are structurally outside the mastery system and never earn."
4. The unsettled expiry double-completion bug remains separately tasked as you filed it — do not touch in P1.

## STOP-B — RULED: option (a); the contradiction was a spec wording error (spec-author's miss, good catch)

Two asset classes were conflated under "bundles":

- **Customization bundles** (standing leans, tempo dial): **per-archetype** — behaviorally verified by your own anchors (lean invalidation on switch at `change-archetype.js:229`; kernel in non-fence `leanRevalidation.js`). The §6 cross-archetype STOP condition applied to THESE, and it is satisfied.
- **Forge rule bundles:** **account-scoped by design** — `forgeService.js:334` agent-keyed with no archetype field is §6.1 working as intended; capacity (not content) keys to highest archetype level. Not a STOP.

**V2.1 replacement text for spec §6 (line 97 region):** "Cross-archetype semantics: customization bundles (standing leans, tempo dial) are per-archetype — each validates against that archetype's level; switching archetypes switches/invalidates them. Forge rule bundles are account-scoped assets by design (§6.1); only their capacity is mastery-gated."

Stale cross-archetype forged bundles on switch: stays on the separate-tasking list, independent of mastery.

## Remaining Phase 0 deliverables — RULED

**§8 eligibility matrix** (collapse to real dispositions): `completed` (settlement path) → all components per formula · fence-path `expired` → outside mastery (STOP-A.2) · `quarantined` → terminal zero receipt. Any future terminal status requires a V2.x matrix row before it can earn — absence of a row means quarantine, fail-closed.

**§9 constants** (data-starved — provisional plan):

1. Run the existing score-export tool (read-only) over all settled battles as P1 input; include the idle-multi-day COMPLETION tension analysis in the constants proposal.
2. Constants ship provisional at `formulaVersion: 1`: design-intent targets + the acceptance-matrix checks evaluable on available data, founder-approved. Matrix items requiring distribution data are marked EVALUATED-ON-ASSUMPTIONS in the proposal — honestly, not silently.
3. Scheduled recalibration checkpoint: ≥100 post-Jul-18 settled battles → full matrix re-run → constants v2 at `formulaVersion: 2`, never retroactive (spec discipline already covers this).

**§10 concurrency finding:** confirmed as load-bearing constraint — the design's write-once guards (award create-guard, stamp guard, backfill stream markers) are the defense, and the §12 concurrent-retry tests are their proof. The cron lock-steal bug stays separately tasked (it touches the locked eval-budget architecture — §7-gated, not yours).

**Write-host census:** P1 report must pin every net-new write host (award txn, slot-stamp tick, repair sweep, quarantine ledger, epoch registry) with file:line for the follow-up fence check. Standing requirement.

## Greenlight & sequencing

P1 is **GREENLIT** on relay of this memo — same branch, phases per spec §12, with STOP-A.1's transaction conversion folded into Phase 1. Standard gates unchanged (fence gate, `/code-review` high, pre-merge adversarial diff review pointed at §3/§5 transaction code, founder merges).

Founder-ratified sequence around it: the preflight task and the training-pod status-transition P0 fix are the next two tasks ahead of or alongside P1 (founder will task them separately; the P0 is now understood as the data-supply unblock — 22 battles total is starving calibration and the learning corpus alike). Do not fold either into the P1 branch.
