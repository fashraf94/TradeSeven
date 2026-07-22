# Training-Pod P0 — Phase 0 Rulings & Re-Scope (supersedes Fix Spec V1)

> **Transcription note (build session, July 22, 2026):** this document is the verbatim transcription of the founder's Phase 0 rulings memo, relayed in-chat to the build session (the "verbatim founder paste" precedent — `ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md`). Content is the founder's; only markdown structure was normalized. It **supersedes `TRAINING_POD_STATUS_P0_FIX_SPEC_V1`** (which never lived in the repo) and governs the re-scoped build. Immutable once added (docs maintenance rules). Its companion is the discovery record `audits/20260722_TRAINING_POD_STATUS_P0_PHASE0_DISCOVERY.md`.

---

**Date:** July 22, 2026
**Re:** `TRAINING_POD_STATUS_P0_PHASE0_DISCOVERY_20260722.md` — premise reversal accepted; all four decisions ruled. **Status:** `TRAINING_POD_STATUS_P0_FIX_SPEC_V1.md` is SUPERSEDED — do not build against it. This memo defines the re-scoped task on the same branch. Commit the Phase 0 report to `docs/audits/` as usual.

## Accepted verdict

The transition machinery is built, wired, flag-on, and test-locked at HEAD; no test encodes non-advancement; the E2 "status half" headline was stale (its sub-claim 4 was the current truth). No transition code will be written, and no flag will be wrapped around the working path — a default-false flag on live behavior is a flags-off behavior change, the inverse of the dark discipline.

Open question the re-scoped task exists to answer: the ~22-battle corpus starvation is unexplained. Candidates: orchestrator cron not registered/firing in prod, low genuine usage, FORMING orphans, or recency of the fix. Verification discriminates before anything is built.

## Re-scoped task (in order)

### R1 — Verification (before any code)

- CC, now, repo-side: confirm the orchestrator tick is registered in `vercel.json` (file:line; note the cron-slot count impact against the ~31/40 budget). If it is NOT registered, report immediately — that alone likely explains the starvation and changes R2's urgency.
- Founder-side (authorized): Vercel dashboard check that the orchestrator cron is executing in prod; run the delivered read-only census query for the stuck-pod population and ages. Both results return to CC before R3 scoping.

### R2 — Unified terminal-disposition mechanism (the only new machinery)

- New terminal status `EXPIRED` with legal edges from `FORMING`, `DRAFTING`, `AWAITING_OPEN` in `LEGAL_TRANSITIONS`; marker fields `{expiredAt, expiredReason, expiredBy}`. Never hard-delete — the `releaseSlotSeat` precedent is not adopted for pods; audit trail survives.
- Mandatory pre-ship consumer census on the pod-status enum: every exhaustive switch/read of status, file:line, verified tolerant of the new value or amended. A new enum value without a consumer census is how EXPIRED pods break a dashboard three weeks from now.
- Battle docs already created under an expired pod route to the existing battle-expiry disposition (fenced `decide.js` GC path — untouched, structurally outside Mastery, earns nothing; consistent by construction).
- Transitions to EXPIRED are transactional with a state+version precondition (the expire-vs-advance race from the adversarial brief is closed by construction, not by timing).

### R3 — Two callers of R2

- One-time cleanup of the census population: founder-gated script, mandatory dry-run count, cutoff timestamp, training-only classification predicate, retry-safe (idempotent under crash-retry — re-expiring an EXPIRED pod is a no-op).
- Rolling FORMING/stale backstop: sweep expiring training pods stalled pre-BATTLE beyond a threshold (default proposal: 48h with no state progress — founder tunes). Behind `POD_EXPIRY_SWEEP_ENABLED`, default false, flip after smoke. Rides an existing cron cadence — zero new cron slots.

### R4 — Regression lock

- The §4.3 integration test from Spec V1 survives the supersession: one test drives a training pod draft → advance → evaluate → `completeBattle`, asserting the eligibility stamp, `MODE_MULT 0.6`, and the canonical chain — so the now-working behavior can never silently regress to the state the stale diagnosis described.

## Gates

Standard: `/code-review` high; fence gate (zero fence files — R2/R3 touch lifecycle services only); flags-off byte-identity for the sweep flag; scoped adversarial diff review before merge using the existing prompt amended by one line — the attack surface drops "illegal transitions" (no transition code in scope) and elevates: the EXPIRED edge's consumer safety, the expire-vs-advance transactional precondition, cleanup predicate precision (can it touch a ranked or live pod), and sweep threshold edges (a legitimately slow multi-day pod must never qualify). HOLD before PR; founder merges.

## Out of scope (unchanged + new)

Eval-budget-starvation P0 (separate; remains the real prerequisite for the Rules-Integration program's shadow evaluation — carry this correction to that chat); any transition-machinery change; any gate change; any fence file; retro-advancing any stuck pod (D1 ruling: expire only, founder may name specific rescues).
