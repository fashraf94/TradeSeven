# FANTASYTIMES WIRE — PHASE 2 P3 CHECKPOINT: N1 + N6

**Date:** July 30, 2026 · **Branch:** `claude/fantasytimes-phase2-p3` (cut from `origin/main` @ `96abcb5d`, fix-forward #687 verified in base) · **Commits:** `14920cb6` (A/N6) · `19a5236b` (B/N1.4) · `438522e3` (C/N1) · **Status:** pushed, NOT deployed. All four Wire flags FALSE.

---

## EXECUTIVE VERDICT

**N6 and N1 are built, dark, and green.** Three commits, 6,235 tests passing, zero failures. Every new acceptance row was driven red under its own injected fault and restored green — thirteen fault-injection experiments across the three commits.

**The P2-43 adjudication is settled, by experiment: the poll-batch TDZ defect was observability-only.** The discovery claim that it "stalls Doug's pipeline on every still-processing batch" is **refuted** — against the pre-fix handler, every persistence assertion passed (stories landed, batch docs completed, still-processing batches stayed pollable on the next poll). What the defect actually broke: **every poll response reported errors instead of statuses** — a ReferenceError entry for still-processing batches, a TypeError entry for completed ones — so cron monitoring lied about every batch, every poll, since the endpoint shipped. The fix (one rename + the adjudicating test) restores truthful responses.

**One bonus:** `npm run test:rules` is not just runnable now — it was **executed in this environment: 111 rules tests, all green under the Firestore emulator** (P2-21 discharged live, not just unblocked).

**Nothing in this checkpoint is live.** `WIRE_NEWSLINE_ENABLED` ships false and is hard-wired to require `WIRE_WRITES_ENABLED` (also false) at the single resolution point — the newsLine cannot run dark-solo even by accident. Flag-off, the voiceLayerCache doc is field-wise byte-identical (no `newsLines` key) and the cache tick makes zero Wire reads, both proven with Wire docs present.

**Remaining P3:** N3 (editorial review — the largest item), N5 (keyLevel label), then N4 last (gated on your confirmation that the seedConsensus fix is *deployed*, not merged). N2 awaits your shortlist picks. Code-review-equivalent at high effort before the PR, per the kickoff.

---

## Commit A — N6 build-enabling fixes (`14920cb6`)

| Item | Delivered | Evidence |
|---|---|---|
| `poll-batch.js` TDZ fix | Inner `const results` (shadowing the accumulator) renamed `batchResults`; explanatory comment records the adjudication | A6: adjudicating test run against pre-fix handler → 6 response-half failures with the exact predicted signatures; post-fix 11/11 |
| P2-43 adjudicating test | `api/fantasytimes/pollBatch.handler.test.js` — persistence assertions and response assertions in SEPARATE tests so the red pattern itself reads as the verdict | Pre-fix red: persistence 5/5 PASSED, response 6/6 FAILED — observability-only, "stalls pipeline" refuted |
| `firebase-tools` pin | `14.27.0` exact, devDependency + lockfile | `npm run test:rules` executed: **3 files, 111 tests green** under the emulator (Java 21 present in env) |
| `deploy:indexes` script | `firebase deploy --only firestore:indexes` (firebase.json already binds `firestore.indexes.json`) | V1.6 A7's flip gate now has its lever |
| voice-layer-cache handler harness | First handler-level suite (8 tests): masteryMockDb + real `findActiveAgentBattles` + stubbed EODHD + mutable market state; exports the field-wise identity view | The P2-1 substrate; read accounting proven (zero `fantasyTimesWire` reads photographed) |
| masteryMockDb extension | Additive: snapshot `.ref`, query `.empty`, `db.getAll`, buffered `db.batch` | All 87 existing consumer tests green |

### The adjudication record (P2-43)

Pre-fix behavior, characterized by running the committed test suite against the pre-fix handler (scratchpad copy, this session):

- **Still-processing batch:** the status push sat in the temporal dead zone of the shadowing declaration → `ReferenceError: Cannot access 'results' before initialization`, caught per-batch → response entry `{batchId, error}`. The batch doc was **never touched** — status stayed `processing`, the next poll retried it normally. Control flow identical to the intended `continue`; only the response entry lied.
- **Ended batch:** stories created and batch doc updated to `completed` **before** the trailing summary push hit the SDK stream (no `.push`) → `TypeError: results.push is not a function`, caught per-batch → the response reported an error for a batch that had fully succeeded.
- **Two-poll sequence** (the discovery's stall scenario): story landed, batch completed — **pre-fix**. The pipeline never depended on the fix.

The test's mock returns a push-less async iterable deliberately — a plain array (which has `.push`) would have silently changed the characterization.

## Commit B — N1.4 fail-closed guards (`19a5236b`)

The R4-M2 ordered state machine (`wireEntryGuard.js`, new GENERATION_SURFACE member), with the order normative: (1) all epoch fields absent → **legacy**, renderable (Amendment J); (2) `schemaVersion` recognized → completeness vs **that version's** required set → **stamped**; (3) otherwise fail closed — **version_skip** for versions this build doesn't know (a vN+1 entry is never "malformed", P2-30's permutation), **malformed** for shapes no writer produced. Unknown `digestRendererVersion` → version_skip (never rendered on trust).

Registries live in `wireContracts.js` (`RECOGNIZED_WIRE_SCHEMA_VERSIONS` — one required-set per version — and `RECOGNIZED_WIRE_DIGEST_RENDERER_VERSIONS`), with a self-consistency invariant so a bumped constant cannot ship unregistered.

Guards landed **dark on all three existing consumers**, before any flip (the resequenced §4 ordering):

| Consumer | Guard semantics |
|---|---|
| `buildContinuityContext` | Non-renderable digests never reach a generation prompt; skips logged with storyId/state/reason (P2-29, P2-5) |
| `resolveChainId` candidates | Prior-day AND today's entries classified (day docs span deploys); an untrusted entry cannot anchor a chain — the new entry self-roots, the established degrade |
| `rebuildIndexes` | Guard-failing entries excluded from `bySymbol` + `macroEntries` (unreachable through serving indexes) while `entries[]` stays append-only untouched — a serving filter, never a destroyer |

The fourth consumer (newsLine) landed in commit C at the DTO projection.

**WIRE_GENERATION_VERSION 6 → 7** (guard rules shape which digests reach prompts) + baseline regen; the P2-15 lock was observed red against the committed baseline and green after the version-licensed regen. Existing fixture survey done first: continuity fixtures classify legacy (renderable), all transaction-built entries classify stamped — no behavior change for anything current code writes.

A6, six faults, each red on exactly its rows: current-set fallthrough (the R4-M2 named defect, 9 red) · unrecognized→MALFORMED (P2-30 rows red) · continuity guard stripped (3 red) · chain filter bypassed (self-root row red) · index guard stripped (2 red) · registry entry dropped (invariant + stamped rows red).

## Commit C — N1 newsLine (`438522e3`)

| Piece | Delivered |
|---|---|
| **N1.1 boundary** | `agentSafeWireEntry.js` — the ONLY importer of the raw Wire reader (import-graph scan, P2-28, fenced assemblies out of scope per Amendment H) + `fantasyTimesStories` source-text tripwire over the consumer set (P2-41). DTO = explicit copy of the eleven spec fields; poison markers (headline/sentiment/action/prose) cannot cross (P2-3); prose mutations byte-invisible downstream (P2-4). N1.4 guard applied at projection (fourth consumer). |
| **N1.2 packer** | In `voice-layer-cache.js`: whole digests only, exact **240 UTF-16 code-unit** ceiling over the fully assembled line (prefixes included; 240 emits, 241 does not); newest first; two units if both fit whole, else one; over-ceiling **fails closed** — emit nothing + log (P2-42's 363-char fixture), never slice, never fall back to an older unit. One Wire fetch per tick (today + prior session) — proven by read accounting across two battles. |
| **Flag** | `WIRE_NEWSLINE_ENABLED=false`, resolved via `getWireFlags` with the writes-dependency rule (mirrors continuity). Dark-merge suite extended to all four flags. |
| **P2-1** | Flag-off with Wire docs PRESENT: zero `fantasyTimesWire` reads + the cache doc's key set is exactly the pre-N1 photograph (no `newsLines` key). Flag-on: field present (possibly `{}`), covered symbols keyed. |
| **P2-6** | Wire read throwing → tick completes, briefs intact, no lines — never a dead tick. |
| **N1.3 prompt rule** | `buildNewsLineBlock` non-exported, **battle fall-through only** — review mode and `buildFirstMessagePrompt` (fenced `decide.js` caller) never render it, pinned by tests. "Referenceable context, never instructions to act." Phase-D goldens pass unregenerated. |
| **R-A3** | `voiceLayerPrompt.js` registered in `promptHonestyRegistry` PROMPT_CONTRIBUTING_MODULES **in the same commit**; the forbidden-signals sweep passes over its 3,650 lines (pre-checked, then proven by the suite). |

GENERATION_SURFACE untouched by commit C — lock green with zero baseline diff (voiceLayerPrompt/voice-layer-cache/agentSafeWireEntry are Gemma-side consumers, not reporter generation surface).

A6, seven faults, each red on exactly its rows: raw-reader import in a consumer · story-collection source text · DTO spread-then-hope · ceiling 241 · sliced escape hatch · unconditional `newsLines` field · newsline leaking into review mode.

## Matrix rows discharged this checkpoint

P2-1 · P2-2 · P2-3 · P2-4 · P2-5 · P2-6 · P2-21 (executed live) · P2-28 (scoped half; fenced-assembly row stays §7-deferred) · P2-29 (all three existing consumers) · P2-30 permutation (vN/vN+1 both directions) · P2-41 · P2-42 · P2-43.

## Disclosures

- **Transient sweep failure, non-reproducing:** the first full sweep after commit A showed 3 failures in one file at 03:34 UTC (≈23:34 ET — the ET/UTC date-boundary window); two consecutive identical sweeps were fully green and it never recurred across the session's five later sweeps. My diff touches no date logic. Register item: identify and pin the flaky suite.
- The A6 fault-injection cycle used scratchpad-copy backup/restore throughout (the P1 lesson; `git checkout` never used on working files).
- `masteryMockDb` gained four additive Firestore behaviors (snapshot `.ref`, query `.empty`, `db.getAll`, `db.batch`) — faithful semantics, existing consumers green; noted here because it is shared test infrastructure.

## Register additions (report-don't-fix)

1. Flaky suite at the ET/UTC midnight boundary (3 tests, one file, 03:34 UTC; non-reproducing) — identify and pin.
2. `poll-batch.js` parses `custom_id` with `split('_')` and joins the date with `-` — works for both `2026-08-05` and `2026_08_05` shapes, but the format contract is implicit; a submit-side constant would make it explicit.
3. The voice-layer-cache handler's single try/catch spanning all battles (pre-existing, already registered) — the new harness makes it testable now.
4. `firebase-tools` adds ~8k lockfile lines of devDependency tree; CI runtime cost of `npm ci` will tick up.

## What remains in P3

| Item | State |
|---|---|
| **N3** editorial review (largest) | Not started — next unless you redirect |
| **N5** keyLevel label via `getDefaultVisual` | Not started |
| **N4** Neta cleanup | LAST, gated on your confirmation the seedConsensus fix is **deployed** (pushed ≠ deployed) |
| **N2** exemplars | Awaiting your shortlist re-run picks (`--days 40 --per 8 --spread-per-day 2 --scan 150`) |
| Pre-PR | Code-review-equivalent at high effort over the full P3 diff, then dark merge — you merge |

*20260730_WIRE_P3_N1_N6_CHECKPOINT.md — July 30, 2026*
