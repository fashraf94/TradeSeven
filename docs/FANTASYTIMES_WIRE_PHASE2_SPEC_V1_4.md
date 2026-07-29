# FANTASYTIMES WIRE — PHASE 2 SPEC V1.4

**Date:** July 25, 2026
**Author:** Claude (spec author) — for CC (Opus 5) execution
**Status:** ROUND-3 AMENDMENTS COMPLETE — to Fable for diff-scoped review (§0 of this version is the diff map) → FINAL LOCK (= commit spec + matrix to `docs/`, record thresholds/tolerances) → build
**Supersedes:** Phase 2 V1.3, V1.2, V1.1, V1.0. **V1.3 governs everything not amended below.**
**Review trail:** ChatGPT (V1.0→V1.1) · Fable (V1.1→V1.2) · discovery @ `e7d541cc` + rulings D-P2-8…16 (→V1.3) · ChatGPT diff-scoped (→V1.4, this document).

---

## 0. V1.4 changelog (ChatGPT diff-scoped review R3, Jul 25)

| # | Finding | Resolution |
|---|---|---|
| **R3-B1** | Same facts, different provenance tuple on a delayed envelope — replay outcome undefined | **Diagnosis accepted as a documentation gap; remedy rejected.** Replay identity keys on **`storyId`** (V1.6-r2 A1), not `payloadHash`: a delayed envelope with different provenance is necessarily a different story → **superseded path** (no entry written, `wireSuperseded` stamped, counted once); the stored entry's provenance is never overwritten or regressed. Adding provenance to replay equality would reintroduce the hash-based classification F-B2/M1 retired and would misfire on every DST regeneration. **Interaction stated explicitly in §3 N0; fixture added (P2-44)** |
| **R3-B2** | Legacy sentinel read literally makes a *partially* stamped envelope legacy → fail-open on a malformed modern envelope | **All-or-none state machine (§3 N1.4):** **Legacy** = every epoch field absent → renderable. **Stamped** = every required field present and recognized → normal guards. **Malformed** = mixed presence, null, or incomplete tuple → **fail closed**, never legacy. P2-30 parameterized over every mixed-presence permutation |
| **R3-B3** | The `GENERATION_SURFACE` hash does not enforce P11 — it detects file change, not stamp↔request divergence; and `WIRE_DIGEST_RENDERER_VERSION` has no content binding at all | **Frozen execution object (§3 N0):** one object is constructed, the envelope stamp derives from it, and **its own fields are what is passed to `messages.create`**. Every seam is spied in test with **deep-equality assertion between actual request arguments and the recorded tuple** (P2-45). Renderer: **version-keyed golden vectors** — a renderer change that alters output without a version bump fails CI (P2-46) |
| **R3-B4** | "Exactly one in-universe ticker" is necessary but not sufficient — AAPL + Bitcoin binds a BTC figure to AAPL | **Binding requires all three (§3 N3):** exactly one unique **normalized ticker-like entity across the entire row** (not merely one in-universe ticker; duplicates collapse) **AND** `primaryTicker` exists and equals it **AND** the figure's `basis` is **ticker-scoped**. `basis` is a closed enum, so each value is statically classified `ticker_scoped` / `market_scoped` in `wireContracts.js`. Otherwise NOT_VERIFIABLE(`unbindable`) |
| R3-M5 | Doug's delayed seam carries only `generationConfig`; the other three provenance values have no defined clock | **All four captured at submit** (§3 N0): `generationConfig`, `schemaVersion`, `digestRendererVersion`, and the **rendered digest** ride the batch doc exactly as `wireMarketDate` does, identically flag-gated. Poll-time validates against the **stored** contract or records a declared migration. **The "digest may fall back to separate tasking" escape is withdrawn** — generation-time digest carriage is mandatory; without it Doug's seam is structurally mixed-epoch |
| R3-M6 | P2-29 injects only through continuity; three consumers can stay fail-open | Parameterized across **all four** consumers × both version classes, each asserting its own correct behavior (prompt omission · chain-read rejection · index exclusion · newsLine omission) |
| R3-M7 | P2-34 names no durable source for the original scheduled date; P2-36's try/catch doesn't cover hangs or budget exhaustion | **`{scheduledSlotDate, isoWeek}` persisted before editorial work begins**, and P2-34 tests a **second, fresh invocation** after the week boundary. Editorial runs **after** primary host duties under a **hard remaining-budget deadline**; P2-36 adds never-resolving and over-budget fixtures, not only a throw |
| R3-M8 | P2-37 covers two of four D-P2-15 rules | Cap-5, prune-priority (failed/insufficient first), dangling-canonical, and **concurrent-write** fixtures added; the no-overwrite rule is enforced **transactionally**, not by sequential check |
| R3-M9 | Literal source-text tripwire bypassable by quote style, template literal, aliased client, or collection constant | Replaced with **structural enforcement**: an AST/lint rule plus consumer-level Firestore **read accounting** (the `masteryMockDb` pattern) permitting story reads only via the extracted raw-reader module. String scanning retained as a secondary net across all literal forms and imported constants |
| R3-matrix | 13 rows could pass with their defect present | All tightenings adopted verbatim in §6, incl.: P2-33 gains an **ISO-year boundary** week; P2-39 parameterized over **both** preview shapes; P2-40 asserts the exact generating-day path **with generating day ≠ current day**; P2-42 tests **240/241 boundary** (the 363 fixture alone can pass while the real 250-char case fails) and **defines length as UTF-16 code units**; P2-43's "completes" defined as *batch exits processing and expected entries are produced* |
| **Spec-author addition** | `fantasyTimesConsensus` is now an adapter operand source **because** nothing deletes it — while §8 lists its unbounded growth as a priority retention task. A future retention fix would silently break derivation verification | **Binding constraint (§8):** any retention applied to `fantasyTimesConsensus` must exceed the editorial window + memo retention (**≥90 days**, recommend 120). The dependency is recorded in the register entry itself so the task can't be picked up blind |

---

## 1–2. Purpose / Principles

Unchanged from V1.3, with P11 sharpened: **provenance binds to execution** means the stamp is *derived from the same frozen object whose fields are passed to `messages.create`* — a content hash over source files is a supporting control, never the binding itself (R3-B3).

## 3. Work items (amendments to V1.3)

### N0 — Provenance
- **Frozen execution object (R3-B3):** `getGenerationConfig(seam, flags)` returns one frozen object; the envelope stamp derives from it; its fields are what the seam passes to `messages.create`. No cloning, overriding, or parallel construction between stamp and call.
- **Replay identity (R3-B1), stated:** replay keys on `storyId` per V1.6-r2 A1. Same storyId → completed (provenance untouched). Different storyId → **superseded attempt**: no entry written, no provenance overwritten, `wireSuperseded` stamped, counted once via `supersededAttempts[]`. Same facts with a different provenance tuple is therefore *already* the superseded path — **not** a new conflict class, and hash-based classification is not reintroduced.
- **Doug's seam (R3-M5):** all four provenance values (`generationConfig`, `schemaVersion`, `digestRendererVersion`, rendered digest) captured at **submit**, carried on the batch doc, flag-gated identically to `wireMarketDate`. Generation-time digest carriage is **mandatory** on this seam.
- Envelope additions remain additive-only and hash-safe; **nothing new ever enters model-emitted `agentFacts`**.

### N1 — newsLine
- **N1.4 state machine (R3-B2):** Legacy (all epoch fields absent) → renderable · Stamped (all present, recognized) → normal guards · **Malformed (mixed/null/incomplete) → fail closed.** Applies to all four consumers.
- **Dependency enforcement (R3-M9):** AST/lint rule + read accounting, string scan secondary.
- Ceiling: explicit fail-closed at **240 UTF-16 code units** on the final emitted line.

### N3 — Editorial review
- **Figure binding (R3-B4):** three-part rule above; `basis` values statically classified ticker-scoped vs market-scoped in `wireContracts.js`.
- **Host discipline (R3-M7):** editorial runs after primary host duties, under a hard remaining-budget deadline; `{scheduledSlotDate, isoWeek}` persisted before work begins.
- **Runs map (R3-M8):** transactional no-overwrite; cap 5; prune failed/insufficient first; canonical never pruned and never dangling.
- Adapters read `dataSnapshot` + the **generating-day** `fantasyTimesConsensus` bucket; both preview shapes UNVERIFIABLE(`circular`).

### N4 / N5 / N6
Unchanged from V1.3 (N4 last, splits if `seedConsensus` hasn't landed · N5 `getDefaultVisual` label-only · N6 build-enabling fixes incl. the founder-authorized `poll-batch` TDZ fix with its adjudicating test).

## 4. Prerequisite ladder

Unchanged from V1.3 (P0 spec commit + rebase onto `a16a0766` · P1 version constants + resolver + manifest/baseline hash + founder's `seedConsensus` · P2 raw-reader extraction + calibration addendum · P3 the §4 sequence with N1.4 guards landing **before** the continuity flip).

## 5. Discovery status

Complete; all five STOPs resolved. Remaining pre-lock: the P2 calibration addendum (coverage/shape statistics only — firewall intact).

## 6. Acceptance matrix (V1.3 rows as amended + additions)

Tightenings adopted per §0: **P2-29** all four consumers × both version classes · **P2-30** every mixed-presence permutation → fail closed · **P2-31** exact version-pair assertions · **P2-32** full four-value submit-time tuple · **P2-33** + ISO-year boundary week · **P2-34** fresh second invocation using persisted slot provenance · **P2-36** + hang and over-budget fixtures · **P2-37** + cap, prune-order, dangling-canonical, concurrency · **P2-38** + mismatched `primaryTicker`, duplicate mentions, one in-universe + one out-of-universe, ticker+macro figures · **P2-39** both preview shapes · **P2-40** generating day ≠ current day, exact path · **P2-41** structural enforcement · **P2-42** 240/241 boundary, UTF-16 code units · **P2-43** "completes" = batch exits processing and entries are produced.

**New rows:**

| ID | Requirement | Injected fault → expected failure |
|---|---|---|
| **P2-44** | Provenance-divergent replay (R3-B1) | Two envelopes, same facts, different version tuples → superseded path taken; stored entry's provenance unchanged; no overwrite; counted once |
| **P2-45** | Stamp binds to execution (R3-B3, P11) | Spy every seam; mutate the request after stamping → deep-equality assertion between request arguments and recorded tuple fails |
| **P2-46** | Renderer content binding (R3-B3) | Change renderer output without bumping `WIRE_DIGEST_RENDERER_VERSION` → version-keyed golden vectors fail |

## 7. Decisions

All resolved (D-P2-1…16 + companion). Thresholds/tolerances land via the P2 calibration addendum before lock finalizes.

## 8. Out of scope / separate tasking (amended)

As V1.3, with one binding constraint added: **`fantasyTimesConsensus` retention — if implemented, the window must exceed the editorial review window + memo retention (≥90 days; recommend 120). Phase 2 derivation verification reads historical buckets from this store; shortening it silently breaks the Phase 3 gate evidence.** Recorded in the register entry itself.

## 9. Process

**Fable diff-scoped review (§0 is the diff map)** → triage → **FINAL LOCK** (commit spec + matrix to `docs/`; record thresholds and tolerances) → build on the rebased branch → `/code-review`-equivalent → dark merge → flips per V1.3 §4/P3. Pushed ≠ deployed.

---

*FANTASYTIMES_WIRE_PHASE2_SPEC_V1_4.md — V1.4 — July 25, 2026*
