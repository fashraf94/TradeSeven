> **TRANSCRIPTION NOTE (added at the P0 lock commit, July 25, 2026).** This document reached
> the build session as a **verbatim founder paste**, not as an uploaded file. The body below is
> a transcription of that paste, committed so the governing FINAL-LOCK candidate is in the
> record alongside V1.2–V1.4 (which are byte-exact uploads). It is **not** byte-verified against
> a founder original: a diff of a transcribed V1.2 against its later-uploaded original showed
> content identical but **15 blank lines silently lost**, so treat this file's whitespace — not
> its content — as unverified. If a byte-exact original exists in the founder's workspace,
> upload it directly to replace this file and the transcription note goes with it.
> Per `docs/README.md`, this is the sanctioned transcription-of-a-paste mechanism, not a
> regeneration from model memory, which remains forbidden.

# FANTASYTIMES WIRE — PHASE 2 SPEC V1.5

**Date:** July 25, 2026
**Author:** Claude (spec author) — for CC (Opus 5) execution
**Status:** FINAL-LOCK CANDIDATE — all review rounds complete. Lock = founder confirmation + commit of spec & matrix to `docs/` + recorded thresholds/tolerances (D-P2-11, D-P2-16).
**Supersedes:** V1.4, V1.3, V1.2, V1.1, V1.0. **V1.3 governs everything not amended in V1.4 or here.**
**Review trail:** ChatGPT (→V1.1) · Fable (→V1.2) · discovery @ `e7d541cc` + rulings D-P2-8…16 (→V1.3) · ChatGPT diff-scoped (→V1.4) · Fable diff-scoped (→V1.5).

---

## 0. V1.5 changelog (Fable diff-scoped review R4, Jul 25)

| # | Finding | Resolution |
|---|---|---|
| **R4-B1** | **R3-M5 specifies an impossible artifact.** "Rendered digest captured at submit" — the digest renders from validated facts, which are the model's output; on a batch seam that output doesn't exist until poll. Unimplementable text at a provenance seam is where interpretation kills P11 | **Clocks separated by what each value governs (§3 N0):** `generationConfig` + `schemaVersion` govern the **request** → captured at **submit**, carried on the batch doc. `digestRendererVersion` governs **render execution** → stamped **at poll, truthfully**. **"Rendered digest" is deleted from the submit-time tuple.** A renderer deploy landing mid-batch correctly places those entries in a different epoch, surfaced via the declared-migration path. P2-32 rewritten accordingly (three submit-time values + render-time renderer version + a mid-batch-deploy fixture) |
| **R4-B2** | **Frozen object + spy is not sufficient for P11.** A spy proves the *tested path*; conditional divergence (retry branch, fallback, error-path rebuild) passes every happy-path assertion. Subset comparison is also blind to generation-relevant fields outside the tuple | **Single-constructor wrapper (§3 N0):** `wireModelCall(executionObject, messages)` is the **only module permitted to import the Anthropic client** (enforced by the R3-M9 AST/dependency machinery). It builds the request from the frozen object and stamps the envelope from the same object in the same function — divergence requires editing one reviewed, golden-covered module. **Two-direction assertion:** every tuple field matches the request **and** the request's generation-parameter surface contains nothing beyond the tuple (deny-unknown). **Both call shapes covered explicitly** — `messages.create` and Doug's `batches.create`, where params nest inside `requests[]` and a subset assertion would otherwise compare the wrong level. P2-45 stays as belt (it catches the wrapper regressing). Deep-freeze not pursued: reconstruction, not mutation, was the threat |
| **R4-M1** | R3-B4's "ticker-like entity" has no source definition; prose scanning would be a heuristic originating a verdict (P9 violation), and the motivating AAPL+BTC case fails if the detector misses "Bitcoin" | **Entity set is typed-only:** `tickers[] ∪ offUniverseTickers[] ∪ subjectRef`, normalized and deduped. No prose scanning. BTC lands in `offUniverseTickers` by construction, so the motivating case is caught. Prose-mentioned-but-untyped entities are upstream validation's failure; NOT_VERIFIABLE(`unbindable`) absorbs the ambiguity conservatively |
| **R4-M2** | R3-B2's state machine has no evaluation order or versioned field set — checking completeness against the consumer's *current* set makes every valid vN entry "malformed" the day vN+1 ships | **Ordered evaluation (§3 N1.4):** (1) all epoch fields absent → **legacy**; (2) `schemaVersion` present **and recognized** → completeness checked against **that version's** required set → **stamped**; (3) otherwise → **malformed**, fail closed. Unknown-but-present versions fail closed at the version guard before the field-set check runs. New P2-30 permutation: complete vN entry read by a vN+1 consumer → stamped-vN or version-skip, **never malformed** |
| **R4-M3** | P2-44 can pass through a nearby path | **Three pins:** same `idempotencyKey` (different keys = two independent stories, assertion passes vacuously) · envelope 1 **fully settled** (entry + receipt) before envelope 2 replays · stored provenance asserted **byte-equal to envelope 1's tuple** (not merely "unchanged", which asserts against itself) · **straggler run required** for "counted once" (superseded stamp lands, envelope delete fails, sweep re-runs → `supersededAttempts[]` membership makes it a no-op, count stays 1). Same-facts retained deliberately and annotated in-fixture: it is the discriminating input that distinguishes storyId-identity from any hash-shortcut implementation |
| **R4-M4** | R3-B1's rationale of record argues the wrong misfire case | **Corrected:** DST regeneration under unchanged config has *equal* provenance; the case where provenance-in-equality misfires is the **deploy-spanning legitimate retry** (same story slot, different tuple). Conclusion unchanged. **Load-bearing premise now cited:** "different provenance ⇒ different story" holds *only because* provenance is **stored at batch time and never re-derived at replay** — the Phase-2 round-1 rule. Both sub-cases stated: two-envelope collision → superseded path; single-envelope delayed replay → stored-tuple replay rule + its fidelity row |
| **R4-M5** | R3-M7's "after primary host duties" references a host topology Fable couldn't reconcile | **Factual correction:** the host *does* run Sundays — `process-pending-reflections.js` is `*/15 13-23,0 * * *` (every day), which is exactly why V1.5 §4.7 chose it over `cleanup.js` (Mon+Thu). The text is not vestigial. **But the finding lands:** D-P2-12 created a **three-tenant budget hierarchy** never stated. **Pinned (§3 N3):** execution order reflections → Wire sweep → editorial; editorial runs **last, lowest priority**, under a hard remaining-budget deadline, and **may never consume the sweep's reserved floor**. Rationale: editorial starving the sweep delays the very settlements it samples — a self-poisoning loop. New row P2-47 |

Fable confirmed carried intact: the R3-B1 remedy rejection (defending the identity rule against a well-meaning regression), the R3-B2 tri-state shape, R3-M9's structural enforcement ("the strongest version of the boundary this arc has produced"), and the consensus-retention binding constraint.

---

## 1–2. Purpose / Principles

Unchanged from V1.3/V1.4. **P11 sharpened again:** provenance binds to execution *by construction* — a single constructor is the only path from config to model call. Content hashes and spies are supporting controls, never the binding.

## 3. Work items (amendments to V1.4)

### N0 — Provenance
- **`wireModelCall(executionObject, messages)`** — sole importer of the Anthropic client; builds the request and stamps the envelope from one frozen object in one function. Dependency-enforced. Covers `messages.create` and `batches.create` (nested `requests[]` shape asserted at the correct level).
- **Two-direction parameter assertion:** all tuple fields present in the request, **and** no generation-relevant field in the request outside the tuple.
- **Doug's clocks (R4-B1):** submit → `generationConfig`, `schemaVersion` on the batch doc (flag-gated as `wireMarketDate`). Poll → `digestRendererVersion` stamped at render execution. **No digest is carried from submit.** Mid-batch renderer deploy → different epoch, declared migration recorded.
- **Replay identity (R4-M4):** keys on `storyId` (V1.6-r2 A1). Premise cited: provenance is stored at batch time, never re-derived at replay. Two-envelope collision → superseded (no entry, no overwrite, membership-counted once). Single-envelope delayed replay → stored tuple replayed verbatim.

### N1 — newsLine
- **N1.4 ordered state machine (R4-M2):** absent-all → legacy · recognized `schemaVersion` → completeness against that version's set → stamped · else → malformed/fail-closed. Applies to all four consumers.
- Structural dependency enforcement (AST/lint + read accounting); 240 UTF-16 code-unit fail-closed ceiling.

### N3 — Editorial review
- **Binding entity set (R4-M1):** `tickers[] ∪ offUniverseTickers[] ∪ subjectRef`, normalized, deduped, typed-only. Binding requires: exactly one unique entity **AND** `primaryTicker` equals it **AND** the figure's `basis` is statically classified `ticker_scoped`. Else NOT_VERIFIABLE(`unbindable`).
- **Host hierarchy (R4-M5):** reflections → sweep → editorial; editorial last, lowest priority, hard remaining-budget deadline, **sweep floor reserved and inviolable**.
- `{scheduledSlotDate, isoWeek}` persisted before work begins; runs map transactional (cap 5, prune failed/insufficient first, canonical protected); adapters read `dataSnapshot` + generating-day `fantasyTimesConsensus`; both preview shapes UNVERIFIABLE(`circular`).

### N4 / N5 / N6
Unchanged (N4 last, splits if `seedConsensus` hasn't landed · N5 `getDefaultVisual` label-only · N6 build-enabling fixes incl. the authorized `poll-batch` TDZ fix + adjudicating test).

## 4. Prerequisite ladder

Unchanged from V1.3 (P0 spec commit + rebase onto `a16a0766` · P1 version constants + resolver + **`wireModelCall` wrapper** + manifest/baseline hash + founder's `seedConsensus` · P2 raw-reader extraction + calibration addendum · P3 §4 sequence with N1.4 guards landing **before** the continuity flip).

## 5. Discovery status

Complete; five STOPs resolved. Remaining pre-lock: the P2 calibration addendum (coverage/shape statistics only — firewall intact).

## 6. Acceptance matrix (amendments + additions)

Rows P2-1…P2-46 as V1.4, amended:

- **P2-30** + vN-entry-read-by-vN+1-consumer permutation → stamped-vN or version-skip, never malformed.
- **P2-32** rewritten: three submit-time values + render-time `digestRendererVersion`; **mid-batch renderer deploy fixture** → entry lands in the new renderer epoch, migration recorded; no digest carried from submit.
- **P2-38** entity set is typed-only; fixtures include AAPL + BTC (off-universe), mismatched `primaryTicker`, duplicate mentions, ticker + macro-scoped basis.
- **P2-44** three pins per R4-M3 (same key · envelope 1 fully settled · byte-equal to envelope 1's tuple · straggler run for membership-counted once); same-facts annotated as the discriminating input.
- **P2-45** two-direction assertion (deny-unknown on generation params) across **both** call shapes, batch nesting asserted at the correct level.

**New rows:**

| ID | Requirement | Injected fault → expected failure |
|---|---|---|
| **P2-47** | Sweep floor inviolable (R4-M5) | Long-running editorial task → sweep throughput unchanged that tick; editorial deferred, never the sweep |
| **P2-48** | `wireModelCall` sole client importer (R4-B2) | Any seam importing the Anthropic client directly → dependency test fails |
| **P2-49** | Wrapper construction integrity (R4-B2) | Wrapper mutated to rebuild the request from anything but the frozen object → golden vectors + two-direction assertion fail |

## 7. Decisions

All resolved (D-P2-1…16 + companion). Thresholds/tolerances recorded at lock via the P2 calibration addendum.

## 8. Out of scope / separate tasking

As V1.4, including the binding constraint: **any retention applied to `fantasyTimesConsensus` must exceed the editorial window + memo retention (≥90 days; recommend 120)** — recorded in the register entry itself.

## 9. Process

**FINAL LOCK on founder confirmation** — no further review round recommended (the V1.5 diff is exactly Fable's prescription: one impossibility repaired, one mechanism strengthened, four pins). Lock = commit spec + matrix to `docs/` + record thresholds and tolerances → build on the rebased branch → `/code-review`-equivalent → dark merge → flips per V1.3 §4/P3. Pushed ≠ deployed.

---

*FANTASYTIMES_WIRE_PHASE2_SPEC_V1_5.md — V1.5 — July 25, 2026*
