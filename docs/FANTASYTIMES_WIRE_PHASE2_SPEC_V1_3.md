# FANTASYTIMES WIRE — PHASE 2 SPEC V1.3
## The Consumption & Quality Arc (Discovery Amendment Pass)

**Date:** July 25, 2026
**Author:** Claude (spec author) — for CC (Opus 5) execution
**Status:** AMENDMENT PASS COMPLETE — dual diff-scoped review (Fable + ChatGPT, §0 is the diff map) → FINAL LOCK (which includes committing this spec to `docs/`) → build
**Supersedes:** Phase 2 V1.2, V1.1, V1.0
**Grounding:** Phase 2 discovery `20260725_FANTASYTIMES_WIRE_PHASE2_DISCOVERY.md` @ HEAD `e7d541cc` (rebase target `a16a0766`). Where V1.2 asserted something discovery refuted, this version states the corrected fact.
**Fence posture:** zero fenced files — **confirmed at HEAD by dual verification**, including that the newsLine cannot alter fenced `decide.js` prompt bytes (block builders are strict key allowlists). No founder fence gate needed.

---

## 0. V1.3 changelog — discovery amendments + founder rulings (Jul 25, all nine accepted)

**Corrected premises (spec-author errors owned):**
- **§1 premise was false (STOP-3, mine):** "nothing consumes the Wire" ignored the Phase 1 continuity reader I specified myself. `buildContinuityContext` (`wireContinuity.js:29`) pushes digests into live model prompts at seven sites across all six seams, dark behind the continuity flip, **failing open**. Phase 2's job is now stated correctly: guard the existing consumers, then add the first new one.
- **`digestRendererVersion` was an armchair field (STOP-4, mine):** required by N1.4, written by nothing. V1.3 creates it.
- **The spec wasn't in the repo (STOP-5, process):** A6 had nothing to bind to. Fixed by P0 + a standing rule (D-P2-11).

**Founder rulings:**

| Ruling | Decision |
|---|---|
| **D-P2-8 (adapter inputs)** | Narrow per D-P2-6, **with `fantasyTimesConsensus/{YYYY-MM-DD}` admitted as an operand source** (existing, date-bucketed, server-written — not new capture). Both preview shapes named **UNVERIFIABLE(circular) in spec text** (they persist the model's restated numbers). **Figure binding rule:** figures bind to `primaryTicker` iff the row has exactly one in-universe ticker; otherwise NOT_VERIFIABLE(`unbindable`). `figures[].ticker` logged as a V2 model-contract candidate — ModelAgentFacts is NOT reopened in this phase |
| **D-P2-9 (`promptVersion`)** | Global constant `WIRE_GENERATION_VERSION` in `wireContracts.js`, read via resolver `getGenerationConfig(seam, flags)` (mutable-mock testable). Scope per F-M1: prompts, tool schemas, model id, sampling params. **Hard rule: the stamp binds to the same expression passed to `messages.create` — never to `REPORTER_PROFILES`**, which provably lies for two reporters. Enforced by the `GENERATION_SURFACE` **committed-baseline content hash** (the `archetypeRegistry` identityHash precedent), which also replaces the CI-impossible git-diff test |
| **D-P2-10 (`seedConsensus`)** | Founder lands the fix; **N4 builds last** and splits to separate tasking if the fix hasn't landed by build completion. V1.6 A7's pre-flip gate stands regardless. Stakes raised by D-P2-8: the wiper now corrupts adapter operands, not just stories |
| **D-P2-11 (spec commit)** | **P0.** V1.3 + full matrix committed to `docs/` at lock. Standing rule: a locked spec is committed as part of the lock |
| **D-P2-12 (cron)** | **Ride, don't rent:** the weekly editorial hosts inside `process-pending-reflections.js` as exported `runEditorialReview()` (day + flag gated, isolating try/catch, host budget-deferral, chunking per N3.6). Board stays 37 + 2 (tournament reservation) = **39/40 with headroom**. Fallback if measured latency doesn't fit the host: the clean slot `25 9 * * 0` |
| **D-P2-13 (newsLine surface)** | **Accepted and recorded:** Wire-rendered digests reach the auth-readable `voiceLayerCache` doc. Defensible — deterministic render, no model prose, and it is the content Gemma speaks to the user anyway. The missing ownership predicate on cache reads is pre-existing → register |
| **D-P2-14 (N5)** | **Re-targeted to `getDefaultVisual`, label-only** ("Key level: 148.50 — prior high" as text/badge). The chart has no price axis; a real price at a fabricated y-position is the §9 display-disagreement bug by construction. Positional rendering deferred to visual-arc work |
| **D-P2-15 (`wireEditorial` shape)** | **Flat:** `runs` map inside `wireEditorial/{isoWeek}` + `canonicalRunId` (receipts-map precedent; cleanup.js's flat-surface invariant honored). Cap 5 runs/week; prune failed/insufficient first; **never prune canonical; never overwrite an existing runId** |
| **D-P2-16 (tolerances)** | Fixed at lock from **shape statistics only** (coverage-side, firewall intact) after the consensus-source coverage addendum (§4 P2) |
| **Companion (F-B1 live class)** | **`schemaVersion` becomes envelope-borne** alongside `generationConfig` (replayed entries today contradict their own `validatorVersion` — on a seam that is 100% sweep-dependent). **Digest rendered at generation time and carried on the envelope** (intended; falls back to separate tasking if it entangles salvage semantics), which is also where `WIRE_DIGEST_RENDERER_VERSION` stamping becomes clean. `observedAt` + contract-row re-derivation → register |

**Discovery amendments folded (A–L):** A→ N1.2's ceiling is enforced by an **explicit fail-closed check** (the "bounded by construction" claim is dead — measured renderer max is 363 chars; a full `earnings_recap` hits 250). C→ **`activeReporters` := 5** (the `REPORTER_EVENT_ALLOWLIST` keys; seam-count readings of 7 or 8 brick the gate forever) + a derived CI assertion so a sixth reporter fails CI instead of silently making every week `insufficient`. E→ the editorial week is derived as the **explicit ISO week filtered by `isTradingSession()`** — never a fixed-count backward walk (every NYSE-holiday week would spill and double-count against the gate). F→ filing-week guard: the isoWeek derives from the scheduled slot's date, asserted at run start; a retry past UTC Sunday midnight files under the original week. G→ P2-15 uses the committed-baseline hash (see D-P2-9). H→ the N1.1 dependency test scopes to **existing non-fenced consumers**; fenced Phase 3 assemblies (`agentEvalPromptAssembly.js` already imports the headline renderer) defer to a §7-gated Phase 3 row; a **source-text tripwire** catches inline `db.collection('fantasyTimesStories')` reads that no import test can see; and **extracting the raw Wire reader module is named build work** — it doesn't exist yet to forbid. I→ Doug's `generationConfig` rides the **batch doc** exactly as `wireMarketDate` does, identically flag-gated (publish-time capture would stamp poll-time config on a model that ran hours earlier). J→ **legacy sentinel:** a missing/`undefined` version field means *pre-stamp legacy, renderable*; fail-closed applies to unknown **non-legacy** values only — otherwise the deploy boundary blanks the historical corpus and terminates unreplayed envelopes as `replay_exhausted` with facts deleted. K/L→ resolved by D-P2-12/-13.

**STOP-3 resolution:** N1.4 is widened to name and guard **all four** Wire consumers — `buildContinuityContext`, `resolveChainId`'s prior-day reads, `rebuildIndexes`, and the new newsLine — and the continuity guard **lands before the continuity flip** (resequenced in §4).

**Build-enabling fixes folded (from the register, required by this phase's own matrix):** pin `firebase-tools` as a devDependency (`npm run test:rules` currently invokes a binary that isn't installed — P2-21 is unrunnable without it); add a `deploy:indexes` script (V1.6 A7 gates the flip on it); build the first handler-level test harness for `voice-layer-cache.js` (P2-1 needs it; none exists — its 1186-line suite is pure-function only). Flag-off byte-identity is asserted **field-wise excluding the `serverTimestamp()` sentinel** (naive object equality cannot work).

**⚠️ Founder-authorized pending veto:** the `poll-batch.js` TDZ shadowing fix (one line, non-fenced) folds into this build **with an adjudicating test** — the Phase 1 review called it observability-only; this discovery says it stalls Doug's pipeline on every still-processing batch. The two claims contradict; the test settles it. Third deferral declined.

---

## 1. Purpose (corrected)

Phase 1 built the typed channel **and its first consumer** — the continuity reader, dark behind the final flip, currently fail-open. Phase 2: (a) guards every existing Wire read path with fail-closed version checks before that flip; (b) adds the first *new* consumer (Gemma's newsLine) behind a structural P7 boundary; (c) builds the quality system (exemplar curation + weekly editorial review with deterministic verdict machinery) whose memos are the Phase 3 gate evidence; (d) makes gate evidence interpretable (envelope-borne `generationConfig` + `schemaVersion`); (e) two deferred fixes, re-scoped per discovery.

## 2. Principles

Unchanged from V1.2 (P7-structural, A6 verbatim, P9 oracle discipline with advisory partition, P10 + calibration firewall, display-agreement analog, P3 analog) — with one addition:

- **P11 (provenance binds to execution):** any provenance stamp (`promptVersion`, model id, renderer version) derives from the values actually used at the execution site, never from a parallel declaration table. Discovery proved `REPORTER_PROFILES` lies for two reporters; a stamp read from it would be the display-disagreement failure applied to metadata.

## 3. Work items (amendments only; V1.2 text governs where not amended)

### N0 — Gate-epoch versioning
As V1.2, plus: **`schemaVersion` and the rendered digest join `generationConfig` on the envelope** (companion ruling) — the shared transaction (`runWireTransactionFromEnvelope`, reached inline and by sweep with no carve-out, per discovery §3) reads all three from storage, never re-derives. New constants: `WIRE_GENERATION_VERSION` (resolver-shaped per D-P2-9), `WIRE_DIGEST_RENDERER_VERSION`. **Envelope additions are additive-only and provably hash-safe** (`payloadHash` is computed before the envelope literal and hashes the facts) — and **nothing new ever enters model-emitted `agentFacts`**, where an unknown key hard-rejects every story (discovery's pinned boundary). Doug's seam: `generationConfig` rides the batch doc (Amendment I). Legacy envelopes: sentinel rule (Amendment J).

### N1 — newsLine
As V1.2, plus: **N1.0 (new, named build work):** extract the raw Wire reader into a single module — the thing the dependency test forbids. **N1.4 (widened):** the fail-closed version guard (`schemaVersion` + `WIRE_DIGEST_RENDERER_VERSION`, legacy sentinel honored) applies to **all four consumers** and the continuity/chain/index guards land **before the continuity flip**. **N1.2:** explicit fail-closed length check at 240 (Amendment A). Dependency test scope + tripwire per Amendment H.

### N2 — Exemplars
Unchanged from V1.2.

### N3 — Editorial review
As V1.2, plus: **hosted** per D-P2-12 (`runEditorialReview()` inside `process-pending-reflections.js`); `activeReporters` := 5 + derived assertion (Amendment C); explicit-ISO-week session derivation (Amendment E); filing-week guard (Amendment F); adapters read **`dataSnapshot` + the generating-day `fantasyTimesConsensus` bucket** (D-P2-8); both preview shapes **UNVERIFIABLE(circular) by spec text**; figure binding rule (D-P2-8); runs stored per D-P2-15 (flat map, cap 5, canonical protected).

### N4 — Neta cleanup
Unchanged in content; **builds last**, splits if `seedConsensus` hasn't landed (D-P2-10).

### N5 — keyLevel uplift
**Re-targeted:** `getDefaultVisual`, label-only badge from in-request validated facts (D-P2-14). No positional geometry.

### N6 — Build-enabling fixes (new)
`firebase-tools` devDependency pin · `deploy:indexes` script · `voice-layer-cache.js` handler-test harness · `poll-batch.js` TDZ fix + adjudicating test (pending founder veto).

## 4. Prerequisite ladder + sequencing

| Order | Work |
|---|---|
| **P0** | Commit V1.3 + matrix to `docs/` (D-P2-11) · rebase the branch onto `a16a0766` (target files byte-identical — a clean rebase) |
| **P1** | `WIRE_GENERATION_VERSION` + resolver + `GENERATION_SURFACE` manifest + baseline hash (D-P2-9) · founder lands `seedConsensus` (D-P2-10, parallel) |
| **P2** | Raw Wire reader extraction (N1.0) · **calibration addendum:** CC measures consensus-bucket coverage per basis (structural/firewall-safe), then thresholds + denominator floor + tolerances are recorded with rationale — **before any flag-on review** (D-P2-16) |
| **P3** | §4 sequence as in V1.2, amended: **N1.4's consumer guards land before step 6 (the continuity flip)**; editorial rides its host (no new slot) |

## 5. Discovery status

Complete (16 items; 3 CLEAR · 8 AMEND · 5 STOP — all five STOPs resolved by the rulings above). Remaining pre-lock work: the P2 calibration addendum. Known matrix holes recorded per F-M10: P2-18 kept as a regression lock (its stated trigger doesn't fire — validation runs in-request on all seams); any epoch input whose fault cannot be constructed is listed in the matrix as a hole, not left implicit.

## 6. Acceptance matrix (amendments + additions; P2-1…P2-28 as V1.2 except as noted)

| ID | Requirement | Injected fault → expected failure |
|---|---|---|
| P2-1* | Flag-off zero reads (constructible today via `masteryMockDb` read accounting) + **field-wise** byte-identity excluding the timestamp sentinel | Enable read path flag-off → call-count assertion fails |
| P2-15* | `GENERATION_SURFACE` baseline hash | Change a manifest file without bumping → committed-hash test fails (CI-runnable, no git diff) |
| P2-22* | Replay stamp fidelity (now constructible) | Kill after batch → bump via mutable mock → sweep → replayed entry carries the OLD version |
| P2-28* | Dependency test, scoped | Non-fenced consumer imports raw reader or story reader → fails; **fenced assemblies: deferred §7-gated row** |
| **P2-29** | Continuity fails closed **before its flip** | Unknown non-legacy version on an entry → digest never reaches a generation prompt; legacy `undefined` → renders |
| **P2-30** | Legacy sentinel | Pre-N0 envelope (no `generationConfig`) replayed → succeeds with legacy sentinel; never `replay_exhausted`, never deleted-with-facts-lost |
| **P2-31** | `schemaVersion` envelope-borne | Bump schema constant → replay → entry carries generation-time version consistent with its `validatorVersion` |
| **P2-32** | Doug batch-doc carry | Bump version between submit and poll → entry carries submit-time config |
| **P2-33** | ISO-week no-spill | NYSE-holiday week → no session reviewed in two periods |
| **P2-34** | Filing-week guard | Simulated run past UTC Sunday midnight → files under the original week |
| **P2-35** | `activeReporters` derived | Add a sixth allowlist key → CI assertion fails (gate never silently bricked) |
| **P2-36** | Editorial host isolation | `runEditorialReview` throws → reflections + sweep unaffected that tick |
| **P2-37** | Runs-map integrity | Write to an existing runId → rejected; prune with canonical present → canonical survives |
| **P2-38** | Figure binding rule | Multi-ticker row → figures NOT_VERIFIABLE(`unbindable`); single-ticker → bound to `primaryTicker` |
| **P2-39** | Circular shapes | Preview shape → UNVERIFIABLE(`circular`) regardless of value agreement |
| **P2-40** | Consensus operand source | Adapter reads the **generating-day** bucket; today's singleton contents never consulted |
| **P2-41** | Inline-read tripwire | `db.collection('fantasyTimesStories')` source text in a consumer → tripwire fails |
| **P2-42** | Length fail-closed | Constructed 363-char digest → no line emitted, logged |
| **P2-43** | TDZ adjudication | Still-processing batch fixture → pre-fix behavior characterized; post-fix, polling completes |

## 7. Decisions

**All resolved:** D-P2-1…7 (V1.2) · **D-P2-8…16 + companion ruling (this version, §0)**. Remaining open item: none blocking review; thresholds/tolerances land via the P2 calibration addendum before lock finalizes.

## 8. Out of scope / separate tasking (additions)

`fantasyTimesConsensus` unbounded growth (no delete path — retention task, raised in priority by D-P2-8) · `observedAt` + contract-row re-derivation on replay · `src/prompts` drifted duplicate (silent no-op edits, deprecated model id) · reporter profile↔model contradictions (P11 root cause; profile table fix) · `voiceLayerCache` read ownership scoping · TGT/BX/PNC/ALLY quarantine-on-flip (expected; dark-solo watch note) · single try/catch spanning all battles in the cache handler · full 40-item register per the discovery record.

## 9. Process

**Dual diff-scoped review (Fable + ChatGPT; §0 is the diff map)** → triage → **FINAL LOCK** (= commit spec + matrix to `docs/`, record thresholds/tolerances per the firewall) → build on the rebased branch → `/code-review`-equivalent (this diff will cross the threshold) → dark merge → flips per §4/P3. Pushed ≠ deployed.

---

*FANTASYTIMES_WIRE_PHASE2_SPEC_V1_3.md — V1.3 — July 25, 2026*
