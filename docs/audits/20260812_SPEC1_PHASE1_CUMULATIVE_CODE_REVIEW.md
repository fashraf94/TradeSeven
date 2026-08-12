# SPEC1 Mandate Substrate — Phase 1 — Cumulative Code Review (BUILD_RULES §2)

**Date:** 2026-08-12
**Branch:** `claude/mandate-substrate-phase-1-fwgdbt`
**Diff reviewed:** 21 files / ~2000 insertions vs `origin/main` (`a17da59b`) — over both §2 thresholds (≥10 files / ≥1500 lines), so a multi-lens adversarial review is mandatory.
**Spec:** `docs/SPEC1_MANDATE_SUBSTRATE_SPEC_V1_4.md` · **Charter:** `docs/QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_2.md`

---

## Executive verdict

| | Result |
|---|---|
| **Overall** | **PASS** — 1 real defect found and fixed on-branch; all other lenses clean. |
| Pass 1 — 6-lens adversarial review | 6 dimensions, deep engagement (32–64 tool events/lens over every changed file), **0 findings**. |
| Pass 2 — 5-target adversarial bug-hunt | 4/5 targets clean; **1 CONFIRMED medium** (idempotent-replay response) → **FIXED**. |
| Adversarial refutation | Pass-1 surfaced no findings to refute; Pass-2's finding was reproduced concretely (repro below) → CONFIRMED, then fixed and mutation-guarded. |
| `vite build` | ✓ passed (BUILD_RULES §2 — the only check that catches a syntax error in a client-bundled file). |
| Unit tests | 71 pass (`mandate*.test.js`, `create.test.js`, `mandateFlags.test.js`); `archetypeRegistry.test.js` (ratchet + extensionless guard) passes; emulator rules suite added (runs in `test:rules`). |
| Zero fenced edits | ✓ none of the 11 §1 fenced files touched (verified `git diff --stat`). |
| Import-boundary ratchet | ✓ vintage reads via `archetypeRegistry` (O-12); `archetypeImportBoundaryBaseline.json` unchanged. |

---

## Method

Two background workflows on Opus, each finding structured, then independently verified:

1. **Pass 1 — 6 review lenses** (parallel): domain-correctness, firestore-wiring, dark-merge/flag-off, security/auth, test-integrity/mutation, fence/ratchet/scope. Each finder was instructed to report only real defects with a concrete repro, and to return empty if its lens was clean. Verify phase (refute-with-repro) stood ready; 0 findings surfaced, so 0 were verified.
2. **Pass 2 — 5 adversarial bug-hunters** (parallel): each told to *assume a defect exists* in one high-risk mechanism (calendar/DST, transactional claim, vintage hash, rules/auth, dark-merge/scope) and construct a concrete failing input. Sharper framing than Pass 1; it surfaced the one real defect.

Engagement was substantive, not vacuous: Pass 1 = 137 tool calls across 6 agents; Pass 2 = 90 across 5. Every changed file was read/grepped; the hunters also probed for the out-of-scope P2 files (`mandateModelCall.js`, `mandateSectorCap.js`, …) and confirmed they are correctly **absent** (nothing built ahead).

---

## Findings

### F-1 — CONFIRMED (medium) — idempotent-replay response reports retry-clock timestamps → FIXED

- **Where:** `api/_utils/mandateCreationService.js` (replay branch + outer return).
- **Repro:** Create book A at `T0=2026-08-12T12:00Z` with `requestKey='K1'` → stored `escapeHatchEligibleUntil=T0+14d`, `nextRolloverAt≈2026-11-12`. Retry the same request at `T1=2026-08-20T09:00Z` (the founder endpoint never passes `now`, so it defaults to the retry clock). The replay branch returned only `{ mandateId, idempotentReplay:true }`; the outer return then filled `createdAt`/`nextRolloverAt`/`escapeHatchEligibleUntil` from the **request-scoped (T1) variables**, not the stored book.
- **Wrong behavior:** the replay envelope reported `escapeHatchEligibleUntil = T1+14d` (a **later** escape-hatch deadline than reality — charter-significant per §2.1/§5.4) and a T1-derived rollover date. §7's contract ("a same-key retry returns the book it already created") was violated for the timestamp fields. The **persisted** book was always correct — one active book, correct stored data; only the replayed *response* lied. (Secondary: a same-key retry with a *different* archetype — a client contract violation — would also echo the wrong archetype's `managerAgentId`/`vintageRef` and publish a stray, inert vintage.)
- **Fix:** the replay branch now `tx.get`s the stored mandate doc (read-only on that branch — read-before-write holds) and the outer return echoes the persisted book's `createdAt`/`nextRolloverAt`/`escapeHatchEligibleUntil`/`vintageRef`/`managerAgentId`/`cadenceTier`/`quarterKey`, normalizing Firestore Timestamps back to Dates for envelope-shape parity with the fresh-create path. `vintagePublished:false` on replay.
- **Mutation guard added:** `mandateCreationService.test.js` — "idempotent replay echoes the STORED book values, not the retry clock": creates at T0, replays at T1, asserts the envelope's timestamps equal the T0 book's and specifically **not** `T1+14d`. Fails under the pre-fix code; passes after.

### Clean lenses (no defect after genuine effort)

- **Transactional claim uniqueness/atomicity (Pass 2):** explicitly probed and upheld — read-before-write ordering correct; the write-write conflict rests on the single `userMeta/{uid}` doc both concurrent creators touch (Firestore locks even non-existent-doc reads), so no double active book; `mandateId` stable across txn retries (pre-allocated ref); the book write and the claim are one atomic commit; `publishVintage` before the claim txn is harmless (content-addressed, immutable create-if-absent) even if the claim then fails.
- **Calendar/DST:** session-close instants correct across EDT/EST and early-close days; `computeNextRolloverAt` returns the first true session close ≥ createdAt+3mo; month-end clamping correct.
- **Vintage hash:** complete-payload content-addressing; `calibrationBundleVersion` is in the hash (unlike `computeIdentityHash`); rider-2 identityVersion assertion fires; publish is immutable and dedup-safe; `publishedAt` is outside the hashed payload.
- **Rules/auth:** owner-read only; all client writes denied; founder gate requires flag **and** allowlist; uid from token never body; no secret/uid in the repo; 403 does not leak which condition failed.
- **Dark-merge/scope:** nothing runs with flags off; no cron added (`vercel.json` unchanged); no out-of-scope behavior implemented; no fenced edit; no new legacy-table importer.

---

## Notes carried out of review (not defects in this diff)

- **Pre-existing CI red on `main`:** `src/config/flagPinGuard.test.js` + `api/_utils/wireFlags.test.js` are red at `a17da59b` because `WIRE_METRICS_ENABLED` was flipped `true` (`featureFlags.js:1159`) without reconciling its `DARK_BY_DESIGN` entry + false pin. Verified pre-existing (identical failures with this diff stashed). Reported for separate tasking per BUILD_RULES §3 — a WIRE-arc flip-reconciliation, not this PR's to fix. This PR's mandate flag additions pass the guard cleanly.
- Spec §9 acceptance rows 5/10 say the escape hatch "resets to $100K"; O-3/D-43 ratify **$10,000,000** (`MANDATE_STARTING_CAPITAL`). Built to $10M; the stale rows are flagged in the PR for founder confirmation.

---

## Disposition

1 CONFIRMED / 0 REFUTED. The one CONFIRMED finding is fixed on-branch with a mutation-guarding test; all tests green; `vite build` clean. Cited from the PR.
