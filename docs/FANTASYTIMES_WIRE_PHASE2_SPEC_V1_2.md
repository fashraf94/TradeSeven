# FANTASYTIMES WIRE — PHASE 2 SPEC V1.2
## The Consumption & Quality Arc

**Date:** July 25, 2026
**Author:** Claude (spec author) — for CC (Opus 5) execution
**Status:** LOCK-READY pending founder confirmation → discovery (read-only, HARD STOP) → threshold calibration → build
**Supersedes:** Phase 2 V1.1, V1.0
**Governing context:** V1.5 + V1.6-r2 govern Phase 1 (merged, flags FALSE). This document governs Phase 2.
**Review trail:** ChatGPT (V1.0→V1.1, 4 blockers) · Fable (V1.1→V1.2, 2 blockers). Dual review standing for this arc.
**Fence posture:** zero fenced files. **Phase 2 modifies Phase 1 machinery** at two seams now (write-through *and* the envelope contract + replay, per F-B1) — not purely additive.

---

## 0. V1.2 changelog (Fable adversarial round, Jul 25)

| # | Finding | Resolution |
|---|---|---|
| **F-B1** | **The N0 stamp doesn't survive replay.** Two paths produce entries — inline and sweep replay from envelope — and the V1.5 §4.5 envelope carries no `generationConfig`. Replay lag (≤12h15m) spans prompt bumps and the continuity flip, so replayed entries would carry false stamps that P2-14 trusts | **`generationConfig` becomes envelope-borne** (§3 N0): captured at generation time, stored once, replayed from the envelope — same contract as `payloadHash`, never re-derived. Added **additively without a `schemaVersion` bump** (a bump would trip N1.4's fail-closed for a purely additive field; allowlist consumers ignore unknowns by construction). Discovery item 13 expands to both seams; new matrix row P2-22 (kill after batch → bump `promptVersion` → sweep → replayed entry carries the OLD version) |
| **F-B2** | **P9/P10 collision: Sonnet can originate a gate-failing verdict with zero tolerance and no appeal.** Semantic dimensions are LLM-judged; N3.4 made critical contradictions period-fatal; P10 bars the founder from adjudicating after results. One hallucination fails a period unappealably | **Gate-bearing / advisory split** (§3 N3.3): "zero critical contradictions" is evaluated over **deterministically checkable dimensions only**. Semantic dimensions (causality, level-interaction) report as **advisory flags** — visible in every memo, never period-fatal on the judge's word. Plus a **mechanical hallucination check**: cited excerpt must be a verbatim substring of the story and the cited typed field must exist with the stated value, or the flag is discarded as judge error and counted. D-P2-6's philosophy applied to the judge |
| F-M1 | Producer model id and generation params are outside the epoch entirely — and V1.5 demonstrably changes `max_tokens` under flag | `promptVersion` **semantics widened** (§3 N0): bumps on any change to prompt files, tool schemas, model id, or sampling params. Respects D-P2-7 (no new stamp fields) |
| F-M2 | P2-15's watched set ("prompt files") misses snapshot builders, cloned tool schemas, model config | **`GENERATION_SURFACE` path manifest** declared in discovery; P2-15 fails on any diff inside the manifest without a `promptVersion` bump. Closes the hole class permanently rather than per-instance |
| F-M3 | The two qualifying periods aren't required to share an epoch — reproduces B1 one level up | N3.4: **both qualifying periods must share a single unchanged `gateEpoch`** (and therefore judge model id / `reviewVersion`) |
| F-M4 | Adapter tolerances are verdict-determining knobs; tuning them after first failures is post-hoc adjudication via side door | Initial tolerances **fixed at lock** alongside thresholds; changing one bumps `adapterVersion` and resets the window (P10 clause extended) |
| F-M5 | Unknown snapshot shape at runtime unspecified (shapes evolve after discovery maps them) | Unrecognized shape → **NOT_VERIFIABLE, reason `unknown_shape`**, counted in the unverifiable rate; never a throw, never a silent skip. Matrix row P2-23 |
| F-M6 | DTO is discipline, not structure, in JS; and `storyId` is a foreign key to a public doc carrying `headline`/`sentiment` — the projection is only as closed as the joins it permits | **Import-graph dependency test** (§3 N1.1), reusing the repo's existing api/ import-policy pattern: only `agentSafeWireEntry.js` may import the raw Wire reader; consumers are dependency-tested against **both** the Wire reader and story-collection readers. `storyId` retained for logging; the join is statically forbidden |
| F-M7 | P2-3 tests known prohibited fields only — a blocklist passes every written case and fails open on the first new field | Projection **must be explicit field copy** (never spread-then-delete); new row P2-24: inject a **novel** field → absent from the DTO with zero code changes. Distinguishes allowlist from blocklist |
| F-M8 | P2-9 conflicts with correct Phase 1 behavior — a Friday-evening failure replayed Monday grows the isoWeek frame, so a same-seed rerun legitimately yields a different sample | **Rerun ≡ manifest reuse** (§3 N3.2): a rerun replays the persisted manifest and never re-derives from the frame; a fresh-frame derivation is a **new review with a new `runId`**, not a rerun. P2-9 now asserts manifest reuse, which fails under the real defect (re-derivation) |
| F-M9 | N1.2 contradicts itself — exact 240 ceiling, then an escape hatch emitting over-ceiling with a marker (the soft ceiling M11 closed) | **Never emit over ceiling** (§3 N1.2): the recency prefix is bounded so any single unit ≤ 240 by construction; the over-ceiling branch **fails closed** (emit nothing + log). Boundary fixtures added to P2-2 |
| F-M10 | P2-14's faults are only injectable for stamped dimensions — un-injectable inputs *are* the remaining holes | P2-14 requires a fault **per epoch input**; any input whose fault cannot be constructed is recorded as a known hole in the spec, not left implicit |
| F-M11 | Threshold calibration will incidentally observe real error rates — anchoring on them is post-hoc adjudication in embryo | **Calibration firewall** (§7): calibration consumes **coverage and shape statistics only**; thresholds are recorded with written rationale **before the first flag-on review executes**; any error-rate observed during discovery is quarantined from the setting |
| F-M12 | N2.1 "replay/reconstruct" doesn't say who authors the typed-facts companion for pre-Wire prose | **Stated decision** (§3 N2.1): the companion is **model-generated** from the historical prose, then held to full validation + deterministic rendering + agreement before the exemplar qualifies |
| F-M13 | N0 has no acceptance row — an A6 violation in the document that adopted A6 | Row P2-25 (entries actually carry `generationConfig`) added |

Fable confirmed carried intact: the B3 adapter core, the DTO concept, sequencing, P10/B2 machinery, M8's rows-render-the-memo, D-P2-6's visible unverifiable rate, and dual review as standing process.

---

## 1. Purpose

Phase 1 built the typed channel; nothing consumes it and nothing maintains prose quality. Phase 2 adds the first consumer (Gemma's newsLine), the quality system (exemplar curation + weekly editorial review), gate-epoch versioning so Phase 3's evidence is interpretable, and two deferred fixes.

## 2. Principles

- **P7 (sourcing) — structural.** Agent-facing surfaces consume `AgentSafeWireEntry`, enforced by an import-graph dependency test (§3 N1.1).
- **A6 (evidence rule, verbatim):** *Every acceptance-matrix row must cite a test that fails under the defect it guards. A row evidenced by code inspection is an unfinished row.*
- **P9 (oracle discipline, amended):** a deterministic check is the verdict. An LLM may explain a verdict, and may raise **advisory** flags where no deterministic check exists — but **no LLM-originated verdict is gate-bearing**. Absent a deterministic check the result is NOT_VERIFIABLE or advisory, never a silent pass and never an unappealable fail.
- **P10 (gate integrity, extended):** thresholds **and adapter tolerances** are fixed before results are seen. Founder judgment approves *changes*; it never adjudicates *periods* post hoc. Calibration inputs are structural, never outcome-derived (§7 firewall).
- **Display-agreement analog:** every memo aggregate recomputable from its own audit rows.
- **P3 analog:** newsLine and editorial failures never degrade their hosts.

## 3. Work items

### N0 — Gate-epoch versioning (B1 + F-B1 + F-M1/F-M2)

- **Stamp:** `generationConfig: { promptVersion, continuityEnabled }` on Wire entries (D-P2-7 narrowing).
- **Envelope-borne (F-B1):** `generationConfig` is captured at **generation time** and written into the envelope alongside `payloadHash`; the inline transaction and the replay sweep **both** read it from there. Stored once, never re-derived. Added additively to the envelope schema **without a `schemaVersion` bump** — allowlist consumers ignore unknown fields by construction, and a bump would trip N1.4's fail-closed for a purely additive change. Both seams (envelope writer + `§4.7` replay) are in scope.
- **`promptVersion` semantics (F-M1):** bumps on any change to prompt files, tool schemas, **model id, or sampling params** (`max_tokens` included — V1.5 raises it under flag).
- **`GENERATION_SURFACE` manifest (F-M2):** a declared path list (prompt constants, snapshot builders, tool-schema modules, model config) enumerated in discovery. P2-15 fails on any diff inside the manifest without a version bump.
- **Memo fingerprint:** `{ promptVersion, validatorVersion, digestRendererVersion, schemaVersion, continuityEnabled, adapterVersion, reviewVersion, judgeModelId, gateEpoch }`.
- **`gateEpoch`** = latest of: final exemplar deployment · `WIRE_WRITES_ENABLED` activation · `CONTINUITY_MEMORY_ENABLED` activation · any `GENERATION_SURFACE` change · any validator / renderer / schema / adapter change.
- **`gateEligible: true`** iff every sampled story shares one unchanged `gateEpoch` **and** the run is complete (M13).

### N1 — voiceLayerCache `newsLine`

**N1.1 — `AgentSafeWireEntry` boundary (B4 + F-M6/F-M7).**

```
AgentSafeWireEntry { storyId, publishedAt, digest, eventType, primaryTicker,
                     direction, magnitude, keyLevel, figures, qualifiers, subjectRef }
```

- Built by **explicit field copy** — never spread-then-delete (F-M7). No `headline`, `reporter` prose, `sentiment`, `recommended_action`, or raw story fields.
- **Import-graph dependency test (F-M6),** reusing the repo's api/ import-policy pattern: only `agentSafeWireEntry.js` may import the raw Wire reader; consumers (`voiceLayerPrompt.js`, the newsLine renderer, and Phase 3's prompt assemblies when they arrive) are dependency-tested against **both** the Wire reader **and story-collection readers** — `storyId` is a foreign key to a public doc carrying `headline` and `sentiment`, so the join is statically forbidden. `storyId` is retained for logging only.
- Selection and ordering derive from DTO fields only. Phase 3 reuses this DTO for sites A–D.

**N1.2 — the line (F-M9).** Inside `voice-layer-cache.js`. Per portfolio + bench symbol: read `bySymbol` for today + prior session (one fetch per tick), project to DTOs, pack **whole digests only** under an exact ceiling of **240 chars** (JS string length over the fully assembled line including per-item recency prefixes). Recency prefixes are bounded such that any single digest unit fits within the ceiling by construction; **the over-ceiling branch fails closed — emit nothing and log.** Never emit over ceiling, never slice a unit. Newest first; two units if both fit whole, else one. No coverage → no line.

**N1.3 — Gemma side.** One rendering rule in `voiceLayerPrompt.js`: referenceable context, not an instruction.

**N1.4 — versions fail closed.** Unknown `schemaVersion`/`digestRendererVersion` → skipped + logged, never rendered on trust. (Purely additive fields do not bump versions — see N0.)

**Flag:** `WIRE_NEWSLINE_ENABLED` (default false). Flag-off: byte-identical cache doc **and zero Wire reads** (mock-asserted call count).

### N2 — Few-shot exemplar curation

**N2.1 — qualification gate (M10 + F-M12).** Pre-Wire candidates have no typed facts, so the **companion is model-generated** from the historical prose, then held to the full contract: current tool schema → validation → deterministic rendering → prose↔facts agreement on gate-bearing dimensions. Record `exemplarVersion` + source `storyId`. Preview generations with the completed set before production. A candidate that cannot produce a clean dual output is not an exemplar, however good the prose.

**N2.2 — selection.** CC shortlists per reporter → founder picks → CC qualifies and embeds. Founder taste governs selection; the qualification gate governs eligibility.

**⚠️ Sequencing (locked):** exemplars land **before baseline capture and before `WIRE_WRITES_ENABLED`**. Bumps `promptVersion`.

### N3 — Weekly editorial review cron

**N3.1 — shape.** One Sonnet call (chunked if headroom demands), weekly Sunday. **1 cron slot: 37/40 → 38/40.**

**N3.2 — deterministic sampling (M6 + F-M8).** `minimumSize = max(3 × activeReporters, |producedEventTypesRequiringCoverage|)`; ceiling **20**; above ceiling → `insufficient`, never silent stratum-dropping. `index_move` always included when produced. Seed = `isoWeek + reviewVersion`; **manifest persisted before the model call.** **A rerun replays the persisted manifest and never re-derives from the frame** — the frame legitimately grows when a late replay lands in a past `marketDate` (correct Phase 1 behavior). A fresh-frame derivation is a **new review with a new `runId`**, not a rerun.

**N3.3 — verdict machinery (B3 + F-B2 + F-M4/F-M5, D-P2-6).**

- **Deterministic adapters**, keyed by **actual snapshot shape** (discovery maps shapes → adapters). Each: identify source fields → normalize units → recompute every supported declared basis → compare with explicit tolerance → return **VERIFIED_CORRECT / VERIFIED_WRONG / NOT_VERIFIABLE**, recording operands, formula, expected, declared, reason. **Tolerances fixed at lock** (F-M4); changing one bumps `adapterVersion` and resets the window. **Unrecognized shape → NOT_VERIFIABLE, reason `unknown_shape`** (F-M5), counted in the unverifiable rate.
- **Prose↔facts, partitioned (F-B2):**
  - **Gate-bearing (deterministic):** ticker · numeric value · unit · direction · actual-vs-expected status · time period *where snapshot-supported*. These carry the gate.
  - **Advisory (semantic, Sonnet-judged):** causality · level-interaction (reached / approached / broken) · any dimension lacking a deterministic check. Reported in every memo with mandatory prose excerpt + typed-field citation. **Never period-fatal.**
  - **Mechanical hallucination check:** a cited excerpt must be a **verbatim substring** of the story and the cited typed field must exist with the stated value; otherwise the flag is **discarded as judge error and counted** as such.
- **Derivation criterion scope (D-P2-6):** evaluated over VERIFIED stories only. **Every memo reports the unverifiable rate per reporter**; a period below the calibrated verifiable-denominator floor is `gateEligible: false`.

**N3.4 — pass rule, fixed before implementation (B2 + F-M3).** A period passes iff: **zero critical gate-bearing contradictions** · zero wrong-subject `index_move` stories · derivation error over VERIFIED stories below threshold · verifiable denominator ≥ floor · no active reporter or produced eventType omitted · judge output complete · every aggregate recomputed from audit rows · `gateEligible: true`. **Both qualifying periods must share one unchanged `gateEpoch`** (F-M3), which also fixes `judgeModelId` and `reviewVersion` across them. Advisory flags are reported and reviewed, never period-fatal. Thresholds calibrated per §7's firewall.

**N3.5 — evidence (M7, M8).** Immutable `wireEditorial/{isoWeek}/runs/{runId}` + `canonicalRunId`. Each run records manifest, source hashes, full fingerprint, `gateEpoch`, adapter version, status, and a **structured audit row per sampled story** (source fields, calculation, typed values, bounded prose excerpts, dimension verdicts incl. advisory, failure codes). The memo is rendered from rows. **Retention 90 days**; audit rows **copy** cited evidence (Wire retention is 30 days — a memo must outlive its sources).

**N3.6 — completeness (M13).** Structured output keyed to every sample ID; unknown/duplicate/missing rejected; stop reason + tokens recorded; incomplete ⇒ `gateEligible: false`. Wall-clock headroom asserted; deterministic chunking + aggregation if one call lacks safe headroom.

**Flag:** `EDITORIAL_REVIEW_ENABLED` (default false).

### N4 — Neta hygiene cleanup

Remove the orphaned `economicCalendar` reader and the stale rules comment. **Dependency:** verify the founder's `seedConsensus` fix landed at current HEAD; re-scope if surroundings changed.

### N5 — Art Director keyLevel uplift (M12)

Validated facts passed **in-request** into the visual builder; never dependent on Wire settlement. Falls back to current behavior absent a keyLevel. If discovery finds visual generation runs post-settlement, document the ordering and add a deferred-transaction fault-injection test.

## 4. Sequencing

1. Build → dark merge (all Phase 2 flags false).
2. **N2 exemplar PR** (qualified per N2.1) — bumps `promptVersion`.
3. Deploy index + rules → **`WIRE_METRICS_ENABLED`** → **≥3-day baseline under final prompts**.
4. Deployed-ruleset run → **`WIRE_WRITES_ENABLED`**.
5. **`EDITORIAL_REVIEW_ENABLED`** (first Sunday after writes).
6. ≥2 trading days solo → **`CONTINUITY_MEMORY_ENABLED`** → **`gateEpoch` resets**; the two-period window opens after this flip.
7. `WIRE_NEWSLINE_ENABLED` at founder discretion once dark-solo health is clean.
8. Two `gateEligible` passing periods **sharing one epoch** + §6.1 numbers → Phase 3 gate review.

Exemplars freeze from step 2 through step 8.

## 5. Discovery checklist (read-only, HARD STOP)

**Calibration (blocking):**
1. **Verifiability coverage per snapshot shape** — for each shape, which declared bases are deterministically recomputable from stored fields? Report per reporter as *(verifiable / produced)* with a sample doc per shape, plus the true shape→adapter mapping. **Thresholds and the denominator floor are calibrated from this** (see §7 firewall).

**Assumption re-verification (each a hard STOP, current HEAD):**
2. `voice-layer-cache.js` sole full-overwrite writer; assembly seam. 3. Walker API supports today + prior session. 4. `bySymbol` excludes quarantined/off-universe. 5. Every persisted entry has a valid digest. 6. `fantasyTimesVisuals.js` level-line seam **and when visual generation runs relative to the Wire transaction**. 7. `vercel.json` 37/40; Sunday slot. 8. `seedConsensus` fix landed. 9. Deployed rules + cleanup paths; `wireEditorial` deny-block pattern. 10. `voiceLayerPrompt.js` seam. 11. Reporter prompt constants; `promptVersion` home; exemplar token headroom.
12. Wire schema/renderer versions; consumers can fail closed on unknown values.
13. **N0 seams — BOTH: the envelope writer (`wireWriteThrough.js`) and the replay path (`wireReplaySweep.js`); confirm neither is fenced and that the envelope schema accepts an additive field without consumer breakage.**
14. Editorial cost/latency at N3.2 sizing vs the serverless deadline.
15. **`GENERATION_SURFACE` path manifest** — enumerate every path whose change alters generation (prompt constants, snapshot builders, tool-schema modules, model config).
16. **Import-graph test feasibility** — confirm the repo's existing api/ dependency-test harness can express the N1.1 constraints (Wire reader + story-collection readers).

## 6. Acceptance matrix (A6 format: ID · requirement · defect · injected fault → expected failure)

| ID | Requirement | Injected fault → expected failure |
|---|---|---|
| P2-1 | newsLine flag-off: zero Wire reads + byte-identical doc | Enable read path flag-off → call-count 0 assertion fails |
| P2-2 | Whole-unit packing, ≤240, **fail closed over ceiling** | Two max-length digests → one whole unit; unit exactly at ceiling → emitted; constructed over-ceiling unit → **no line** |
| P2-3 | DTO known-field exclusion | Poison markers in headline/sentiment/prose → absent from DTO, cache, prompt |
| P2-4 | Selection independence | Mutate headline/sentiment only → newsLine byte-identical |
| P2-5 | Unknown version fails closed | Unknown `schemaVersion` → skipped + logged |
| P2-6 | newsLine resilience | Wire read throws → cache tick completes without a line |
| P2-7 | Adapter verdict deterministic | Known-wrong declared value → VERIFIED_WRONG regardless of model text |
| P2-8 | NOT_VERIFIABLE never passes silently | Missing operands → NOT_VERIFIABLE, excluded from denominator, counted |
| P2-9 | **Rerun = manifest reuse** | Grow the frame (late replay), rerun → same manifest replayed; re-derivation path fails the test |
| P2-10 | Stratification or `insufficient` | Week over ceiling → `insufficient`, no dropped stratum |
| P2-11 | Judge completeness | Missing/unknown sample ID → `gateEligible:false` |
| P2-12 | Aggregates recomputable | Mutate an audit row → recomputation assertion fails |
| P2-13 | Immutable runs | Second run same isoWeek → new `runId`, prior intact |
| P2-14 | gateEligible homogeneity | **One fault per epoch input**; un-injectable inputs recorded as known holes |
| P2-15 | Version bump enforcement | Diff inside `GENERATION_SURFACE` without a bump → fails |
| P2-16 | Exemplar qualification | Candidate failing validation/rendering/agreement → rejected |
| P2-17 | Editorial failure isolation | Sonnet throws → logged skip, no partial memo |
| P2-18 | N5 in-request facts | Defer the Wire transaction → chart still renders the level |
| P2-19 | N4 removal complete | Grep-test asserts absence of reader + comment |
| P2-20 | Fence + budget | Changed-path test; `vercel.json` entries = 38 |
| P2-21 | `wireEditorial` denials | Rules suite (with positive controls) → all denied |
| **P2-22** | **Replay stamp fidelity (F-B1)** | Kill after batch → bump `promptVersion` → run sweep → replayed entry carries the **OLD** version |
| **P2-23** | **Unknown shape (F-M5)** | Novel snapshot shape → NOT_VERIFIABLE `unknown_shape`; not a throw, not a skip |
| **P2-24** | **Allowlist, not blocklist (F-M7)** | Inject a **novel** field onto a Wire entry → absent from DTO with zero code changes |
| **P2-25** | **`generationConfig` present (F-M13)** | Entry written without the stamp → fails |
| **P2-26** | **Advisory flags never period-fatal (F-B2)** | Inject a semantic "critical" flag → period still passes; flag appears in memo |
| **P2-27** | **Hallucination check (F-B2)** | Flag citing a non-verbatim excerpt or absent field → discarded as judge error and counted |
| **P2-28** | **DTO import-graph (F-M6)** | Consumer importing the raw Wire reader or a story-collection reader → dependency test fails |

## 7. Decisions + calibration firewall

**Resolved:** D-P2-1 portfolio+bench · D-P2-2 Sunday · D-P2-3 90-day retention · D-P2-4 exemplars before baseline · D-P2-5 computed size, ceiling 20 · D-P2-6 narrow-the-criterion, unverifiable rate per memo · D-P2-7 `generationConfig` stamp only.

**Open (post-discovery, blocking lock):** derivation-error threshold · verifiable-denominator floor · **initial adapter tolerances** (F-M4).

**Calibration firewall (F-M11):** calibration consumes **coverage and shape statistics only**. Thresholds and tolerances are recorded **with written rationale before the first flag-on review executes**. Any error rate incidentally observed during discovery is **quarantined** from threshold-setting. This makes P10 auditable rather than asserted.

## 8. Out of scope

Calibration-fence files · Phase 3 items · Phase 4 · snapshot-capture enrichment (D-P2-6; separate arc if the blind spot proves unacceptable) · lookback-snapshot threading · separate-tasking register.

## 9. Process

Founder confirmation → **discovery (read-only, HARD STOP)** → threshold + tolerance calibration under §7's firewall → founder review → **lock** → build on a **new branch** → `/code-review`-equivalent (adapters + N0's two seams likely cross the §2 threshold) → dark merge → flips per §4. Pushed ≠ deployed.

---

*FANTASYTIMES_WIRE_PHASE2_SPEC_V1_2.md — V1.2 — July 25, 2026*
