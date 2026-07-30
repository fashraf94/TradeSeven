# FANTASYTIMES WIRE — PHASE 2 P3 CHECKPOINT: N3 (EDITORIAL REVIEW)

**Date:** July 30, 2026 · **Branch:** `claude/fantasytimes-phase2-p3` · **Commits:** `6972bb55` (D — sampling) · `e4195b19` (E — adapters) · `09e5f49e` (F — run/judge/host) · **Status:** pushed, NOT deployed. All five Wire flags FALSE (`EDITORIAL_REVIEW_ENABLED` joins the set, false).

---

## EXECUTIVE VERDICT

**N3 — the largest Phase 2 item — is built, dark, and green.** Three commits, 85 new editorial tests, 6,327-test sweep clean, the rules suite executed under the emulator with the new `wireEditorial` denials. Eighteen A6 fault-injection experiments across the three commits, each driving exactly its rows red.

**Everything the FINAL LOCK recorded is now executable code:** the 5% threshold over VERIFIED, the ≥5-VERIFIED/≥2-shapes floor, all eight §6 tolerance rows (encoded verbatim, byte-tested at their boundaries), the shape→adapter map, the R4-M1 typed-only binding rule, and the writers'-expression UTC consensus join. A tolerance change now mechanically means an `adapterVersion` bump.

**TWO INTERPRETATION CALLS NEED YOUR RATIFICATION** (both implemented conservatively, both flagged in the module headers — vetoing either is a contained change):

1. **Declared-value referent.** The locked tolerances say *what* slack each basis gets but not *what number* the model is declaring. I bound every `X_vs_Y` basis to the **signed deviation** (actual − expected) — not my preference but a structural forcing: the validator's own R4_SIGN rule rejects `direction` contradicting `magnitude.value`'s sign, which is only coherent for deviations (a jobless-claims *level* of 212,000 with direction "down" would trip it; the −8,000 deviation doesn't). One recorded exception: a revenue value that fails the deviation referent but matches the **level** within the same tolerance is `NOT_VERIFIABLE(ambiguous_referent)` — refused, counted, never adjudicated WRONG (the addendum's own S5 declared-referent precedent).
2. **What "critical gate-bearing contradiction" means.** N3.4 has three separate clauses — zero critical contradictions · zero wrong-subject index_move · derivation error <5% — so criticals cannot simply equal derivation errors (that would make the 5% budget vacuous). I partitioned: **categorical inversions are critical, zero tolerance** (a beat declared as a miss; declared direction contradicting the recomputed sign; the story doc's primaryTicker disagreeing with the typed facts; an index_move whose declared value fails its own index's leg while matching a different index's); **same-sign beyond-tolerance misses are ordinary derivation errors** carried by the 5% budget. All deterministic, all operand-grounded, no judge in the loop.

One smaller recorded posture: `EDITORIAL_REVIEW_ENABLED` is **independent of writes** — the V1.2 flag table states no dependency, so I didn't invent one. Flipped before writes it would produce harmless-but-noisy `insufficient` runs weekly; your §4 flip order (editorial after writes, step 5) is what prevents that.

**Remaining P3:** N5 (keyLevel label — small), then **N4 last**, still gated on your confirmation that the Step-0 fix is *deployed*. N2 awaits your shortlist picks. Then the code-review-equivalent at high effort over the full P3 diff before the PR.

---

## What landed, by commit

### D — contracts + deterministic sampling (`6972bb55`)
- `BASIS_SCOPE` in wireContracts (the FINAL-LOCK ticker/market classification, verbatim) + editorial version constants (`reviewVersion`/`adapterVersion` '1.0.0') + `WIRE_ACTIVE_REPORTERS` **derived** from the allowlist keys, pinned at 5 by the P2-35 CI assertion (a sixth reporter fails CI, never silently resizes the mandate). WIRE_GENERATION_VERSION 7→8 (manifest-module edit; lock red → licensed regen → green).
- `wireEditorialSampling.js`: ISO-8601 week math (a Sunday reviews its own Mon–Fri; year boundary by the Thursday rule) · sessions = the explicit ISO week filtered by `isTradingSession` — the July-4th week reviews exactly its own 4 sessions, no spill (P2-33) · frame admits only guard-renderable, non-quarantined entries (N1.4 applies to the editorial too) · seeded **hash-rank** sampling (sha256 over `isoWeek:reviewVersion` + storyId — frame-order-independent, reseeds on either input) · every produced (reporter × eventType) stratum covered, index_move whenever produced · an unsatisfiable mandate is `insufficient`, never a dropped stratum (P2-10) · the F-M8 manifest records seed + order-independent frame fingerprint + the verbatim sample.

### E — verdict adapters (`e4195b19`)
- `wireEditorialAdapters.js` (pure, P9-disciplined): shape detection keyed on the ACTUAL snapshot (S1–S7); recomputation from admitted operands only (dataSnapshot + generating-day bucket); §6 tolerances encoded and boundary-tested (3.15-passes/3.16-fails class precision); closed unit dispatch; VIX = `no_proxy_instrument`; Sonar strings through the strict K/M/B parse or `unparseable_operand` — never eyeballed.
- R4-M1 binding: `tickers ∪ offUniverseTickers ∪ subjectRef`, deduped, typed-only; binds iff exactly one entity AND primaryTicker equals it AND the basis is statically ticker_scoped. All four V1.5 fixtures tested (AAPL+BTC → unbindable; duplicates dedupe and bind; mismatched primary; market-scoped basis).
- The wrong-subject index_move probe: own-leg fail + other-leg match within the same proxy tolerance → `wrong_subject_index_move` (deterministic; N3.4's own clause).
- P2-39: both preview shapes CIRCULAR **even when the declared value equals the bucket's** — proven by fault (an echo-adapter injection went red).
- P2-40: the consensus join uses the writers' `toISOString().split('T')[0]` — the after-hours ET discriminator is the test (an ET-calendar join fault went red).

### F — run, judge, evidence store, host (`09e5f49e`)
- **Judge** (advisory-only; never gate-bearing): rides `wireModelCall` with a frozen execution literal (judgeModelId recorded from the object that built the request — P11; the P2-48 scan auto-covers the file). Deterministic 10-story chunks; M13 completeness (missing/unknown/duplicate ids reject; truncation never trusted); the mechanical hallucination check (non-verbatim excerpt or wrong cited field/value → flag discarded as judge error, counted).
- **Store** (D-P2-15): flat `runs` map in `wireEditorial/{isoWeek}`, transactional, terminal runs immutable, cap 5, prune failed/insufficient first (complete runs never prune; canonical ⊆ complete), first `complete` run is canonical forever.
- **Lifecycle:** manifest persisted before any model call; budget exhaustion mid-judge leaves the run **pending and resumable** (the resume replays the persisted manifest verbatim across frame growth — P2-9 proven with a late-replay fixture); a judge failure terminates `failed` with **no partial memo** (P2-17); the retry is a new runId with the prior run byte-intact (P2-13).
- **Amendment F both directions** (P2-34): every write keys off the captured `{scheduledSlotDate, isoWeek}`; a pending run found from the NEXT week's Sunday resumes under its ORIGINAL week (the stranded-pending case is covered — W32's slot finds and completes W31's run; nothing files under W32).
- **Epoch homogeneity** (P2-14): the five entry-borne axes (generationVersion · continuityEnabled · schemaVersion · digestRendererVersion · validatorVersion) each fault-tested to `gateEligible:false`. **Known holes, recorded:** adapterVersion, reviewVersion, judgeModelId are run-level constants — un-injectable as within-run mixes; F-M3 carries their discipline across the two qualifying periods instead.
- **Aggregates** recomputed from audit rows and verified before the run writes (P2-12 — a tampered row is detected); the **N3.4 verdict** clause table tested at the pure level (floor count, floor shapes, 20%-rate fail, critical fail at 0% rate, wrong-subject clause); the memo renders from rows + aggregates only.
- **Host tenancy** (R4-M5): editorial is the LAST tenant in process-pending-reflections — reflections → sweep → editorial — Sunday-gated, isolated (a thrown editorial leaves the sweep's result intact, P2-36), hard 20s remaining-budget floor (a 47s sweep defers the editorial without invoking it, P2-47; the converse is structurally impossible by order).
- **Rules + retention:** `wireEditorial` deny-block in firestore.rules; the P2-21 denial suite extended and **executed under the emulator** (all verbs denied for unauth/auth/privileged, positive controls green). cleanup.js gains the 90-day `wireEditorial` retention row (memos must outlive the Wire's 30-day sources; flat-surface invariant intact).

## Matrix rows discharged this checkpoint

P2-7 · P2-8 · P2-9 · P2-10 · P2-11 · P2-12 · P2-13 · P2-14 (with recorded holes) · P2-17 · P2-21 (extended + executed) · P2-23 · P2-33 · P2-34 · P2-35 · P2-36 · P2-37 · P2-38 · P2-39 · P2-40 · P2-47.

**N3 rows not in this build, by design:** P2-16 (exemplar qualification — N2, awaiting your picks). Nothing else from the N3 family remains open.

## A6 experiment ledger (18 faults, commits D–F)

| Fault injected | Red rows |
|---|---|
| backward-walk session fill | P2-33 |
| drop-strata-to-fit | P2-10 ×2 |
| arrival-order ranking | determinism ×3 |
| sixth allowlist reporter | P2-35 + sizing ×2 |
| trust-the-model tolerance band | P2-7 ×3 |
| missing-operand silent pass | P2-8 ×5 |
| unknown-shape silent skip | P2-23 ×2 |
| binding rule bypassed | P2-38 ×3 |
| previews adapted on value agreement | P2-39 |
| ET-calendar consensus join | P2-40 |
| resume re-derivation | P2-9 |
| terminal-run overwrite | P2-13/37 |
| epoch axis dropped | P2-14 |
| partial memo on failure | P2-17 |
| captured week ignored | P2-34 |
| missing judge ids accepted | P2-11 ×2 |
| host isolation removed | P2-36 |
| budget floor removed | P2-47 |

## Disclosures & register additions

- **Ratification items 1–2** (above): referent rule + critical partition. Both documented in `wireEditorialAdapters.js`'s header as interpretations of record.
- **Editorial flag independence** (above): per the V1.2 letter; the §4 flip order is the guard.
- Register: the judge's Sonnet model id (`claude-sonnet-4-6`) is a literal in `wireEditorialJudge.js` — when the seams migrate models, the judge migrates by its own edit (F-M3 makes this visible: a mid-window judge change breaks period homogeneity by design) · `insufficient` runs count against the cap-5 the same as `failed` (pruned first, so a healthy retry always has room) · the editorial reads `fantasyTimesStories` directly by necessity (prose↔facts needs prose) — it is review machinery, deliberately NOT in the N1.1 consumer set; the boundary test's scope is unchanged.

## What remains in P3

| Item | State |
|---|---|
| **N5** keyLevel label via `getDefaultVisual` | Next |
| **N4** Neta cleanup | LAST — needs your "Step-0 deployed" confirmation |
| **N2** exemplars | Awaiting your shortlist picks |
| Pre-PR | Code-review-equivalent (high effort) over the full P3 diff → dark merge → you merge |

*20260730_WIRE_P3_N3_CHECKPOINT.md — July 30, 2026*
