# FANTASYTIMES WIRE — N2 EXEMPLAR QUALIFICATION & EMBED RECORD

**Date:** July 31, 2026 · **Branch:** `claude/fantasytimes-phase2-n2-exemplars` (rebased onto `main` after #695 merged) · **Slate:** 2026-07-30 export (20/20 clean) · **Merge posture:** dark — all five Wire flags stay FALSE; founder merges.

**What this is.** N2 few-shot exemplar curation (Spec V1.2 §3 N2 / N2.1 + the July 29 partial-exemplar ruling): qualify model-generated typed-facts companions for the historical slate through the deterministic gate, embed the ones that pass, record provenance, bump the epoch, and file the seam findings the gate surfaced. The qualification report this record builds on is `scratchpad/N2_QUALIFICATION_REPORT.md` (agent record); the numbers below were **re-verified against the shipping code** on this branch.

---

## EXECUTIVE VERDICT

**11 exemplars embedded, `WIRE_EXEMPLAR_VERSION = 1`, `WIRE_GENERATION_VERSION` 10 → 11.** The set is deliberately **partial**, exactly as the July 29 ruling and the N2.1 gate directed:

| Reporter × type | Embedded | Source storyIds | Why not more |
|---|---|---|---|
| **alex** × market_mover | **4** | sZx9…(AMD) · f9Bn…(TSLA) · mgFS…(UNH) · fzp4…(RTX) | gold standard — every dimension operand-grounded; 3 carry keyLevels |
| **kai** × index_move | **3** | GYLp3…(SPX) · oNN…(NDX) · ubvi…(SPX) | 4th slot **intentionally empty** — see Defect D-3 (the seam forces SPX) |
| **doug** × earnings_preview | **4** | 6kcO…(AAPL) · J6cL…(META) · xvXd…(V) · ZwIf…(MSFT, alt) | head-only by necessity — preview snapshots carry null estimates |
| **kim** × sector_rotation | **0** | — | **deferred** — see Defect D-4 (no SPY operand at the seam; honesty rule) |
| **neta** × econ_*, **doug** × earnings_recap | **0** | — | deferred post-gate (July 29 zero-groups ruling) |

**How they're embedded.** A new module `api/_utils/wireExemplars.js` (a GENERATION_SURFACE member) holds the set; `buildAgentFactsInstruction` appends a **writes-gated** few-shot block per seam. So the exemplars reach the model **only under `WIRE_WRITES_ENABLED`** — flag-off / metrics-only the prompt is byte-identical (M8 intact, re-asserted green). The block respects the V1.6 A4 pin (Doug's preview seam shows only its four; the deferred recap seam shows nothing).

**Two named defects + one register item filed** (below and in `docs/DRIFT_LEDGER.md` D-3/D-4). Defect D-3 is **pre-runway, own branch, must merge before `WIRE_WRITES` flips**: until it lands the seam would remap Kai's NDX teaching back to SPX in production — harmless while writes are off, fatal to the lesson once they're on.

**Nothing merged; nothing flipped.** Suite 6,637 green + 114 rules-emulator green.

---

## THE EMBED

`WIRE_EXEMPLARS` records, per entry, the **source `storyId`** and the source `primaryTicker` (provenance + reproducibility); `WIRE_EXEMPLAR_VERSION = 1` identifies the set. The rendered `agentFacts` is the **minimal faithful payload** — every field the source data can't ground is omitted, so the exemplar itself models the "omit what you can't ground" rule.

- **alex** teaches: signed `price_vs_prior_close` magnitude matching the data exactly; `keyLevel` only when the prose cites a typed level (TSLA support 295, UNH support 425, RTX resistance 219.63), omitted when it doesn't (AMD).
- **kai** teaches subjectRef **selection**, not a default: SPX when the S&P leads (GYLp3, ubvi), **NDX when the Nasdaq is the story** (oNN — tech fell while small caps rallied). `tickers: []` (cardinality-0). This is the lesson Defect D-3 must protect.
- **doug** teaches **head-only** previews: `{eventType, tickers}` with **no direction** (forbidden on previews) and **no invented numbers** when the snapshot's EPS/revenue estimates are null.

### Preview-generation check (completed set)

The N2.1 requirement "preview generations with the completed set before production" has two layers here:

1. **Deterministic dual-output re-validation (done, and made permanent).** All 11 embedded companions were re-run through the shipping `validateAgentFacts → renderWireDigest`, reproducing `wireWriteThrough`'s `persistedFacts` construction: **11/11 PASSED**, every digest clean. This is now a **CI regression** (`wireExemplars.test.js`) — an edit that breaks an exemplar, or a validator/renderer change that would, fails the build. "A candidate that cannot produce a clean dual output is not an exemplar" is thereby enforced, not asserted.
2. **Live LLM round-trip (belongs to the deployed baseline).** A real generation preview needs the Anthropic + Firebase credentials the container does not hold (the same credential wall that put the export on the founder's machine). The live "preview generation with the completed set" **is** step 3 of §4 — the ≥3-day `WIRE_METRICS` baseline under the final (v11) prompts, in production. This record does not claim a live round-trip was run here; the deterministic layer is what the container can honestly verify.

---

## N2.1 QUALIFICATION — the seam findings behind the partial set

The gate was the verdict (P9); targeted subagents carried only the semantic layer where the gate goes quiet. Full table in the qualification report. The load-bearing results:

- **alex 4/4** clean, no caveats.
- **kai 3/4 + escalation.** SPX/NDX/SPX is a real spread. The 4th slot fired the escalation trigger: **aW5 (Dow) and its alternate YJy2 (Nasdaq) both failed identically** — the pulse seam sets `primaryTicker=SPY` and the A2 remap forces `subjectRef→SPX`, so a non-S&P-led pulse cannot headline its true index. Per the rule, **no third pick was pulled**. Sharper: the surviving NDX (oNN) passed **only because its `primaryTicker` was null** — the spread's diversity is real but the seam's tendency is monotone-SPX. → **Defect D-3.**
- **doug 4/4 but thin.** BX was genuinely off-universe → MSFT alternate rescued the slot. Every preview snapshot carries null estimates, so all four are head-only. They pass and teach the honest shape, but the thin-ness is a **register item** (below).
- **kim deterministic 4/4, semantic 3/4 + a systemic basis flaw.** The gate is silent (`sector_vs_spy` → NOT_VERIFIABLE, no SPY operand at the seam). One companion (8X3O) is outright misattributed, and **all four label a raw sector move as `sector_vs_spy`** — a basis that can't be truthfully populated here. → **Defect D-4, and kim embeds nothing.**

---

## FILED DEFECT D-3 — A2 remap overwrites correct subjectRefs at Kai's seam

**PRE-RUNWAY · OWN BRANCH · MUST MERGE BEFORE `WIRE_WRITES_ENABLED` FLIPS.** *(Also in DRIFT_LEDGER as D-3.)*

**What.** `index_move` is cardinality-0 (`tickers: []`, no primary ticker; the subject is the index via `subjectRef`). But the Kai pulse seam sets `storyDoc.primaryTicker` from the model's `storyData.primaryTicker` — typically **SPY, meaning "the market,"** not "the S&P is the subject" (`generate-pulse.js:354,391`). That value is passed as `primaryTickerRaw` to the validator (`wireWriteThrough.js:115`), where the A2 internal-consistency remap (`wireValidator.js:214-224`) reads `ETF_TO_INDEX['SPY'] = 'SPX'` and, finding it disagrees with a correctly model-emitted `subjectRef` (e.g. `NDX` on a tech-led pulse), **overwrites it to SPX** (`S1_SUBJECT_REMAPPED`, salvage). The consistency check is checking against a meaningless operand: an index_move has no primary ticker to be consistent with.

**Impact.** Any non-S&P-led pulse (Nasdaq-led, Dow-led, Russell-led) is silently relabeled SPX in the persisted facts and the digest. Harmless while `WIRE_WRITES` is off (nothing persists). **Fatal once writes flip:** it (a) contradicts the very lesson the embedded oNN/NDX exemplar teaches, and (b) writes false subjects into the Phase-3 gate evidence, where "wrong-subject `index_move`" is a period-fatal criterion (N3.4).

**Fix direction (founder ruling).** Honor the contract's **cardinality-0 rule: `primaryTicker` is null on `index_move`.** With no primary ticker the A2 remap has no operand and the model's `subjectRef` stands. Two candidate sites (the own-branch work chooses and tests one):
- **Seam:** pass `primaryTicker = null` to `publishStoryWithWire` when the emitted `eventType` is `index_move` (the cleanest expression of "an index move has no primary ticker").
- **Validator:** skip the A2 `ETF_TO_INDEX` remap for cardinality-0 eventTypes (the remap fires only for `model_required` subjectRef, i.e. `index_move` — so it is *always* operating where the premise is broken).

**Why its own branch/review.** A2 was a deliberate V1.6 amendment; changing it touches validation behavior and may bump `WIRE_VALIDATOR_VERSION` (or `WIRE_GENERATION_VERSION` if fixed at the seam) — an epoch input that must settle **before** the baseline window opens, not during it. Regression must include: a Nasdaq-led pulse keeps `NDX`; a Dow-led pulse keeps `DJI`; a genuinely S&P-led pulse still renders `SPX`.

---

## FILED DEFECT D-4 — Kim's `sector_vs_spy` has no SPY operand at S7 (decision memo)

**PRIORITY BELOW D-3 · A DECISION FOR THE FOUNDER, NOT A FIX DIRECTION.** *(Also in DRIFT_LEDGER as D-4.)*

**What.** Kim's `sector_rotation` magnitude basis is `sector_vs_spy` — a sector's move **relative to SPY**. At the S7 shape (the sector-column snapshot) there is **no SPY operand at rest**, so the deterministic adapter returns NOT_VERIFIABLE and the "value" the reporter would populate is the sector's **raw daily change**, not a vs-SPY figure. Every qualifying Kim companion mislabels a raw move as `sector_vs_spy`; the gate can't catch it because it can't compute the true figure. This is why **kim embeds zero** — teaching a false basis at a gate-silent seam violates the honesty rule.

**The decision (two options, founder picks; each has an epoch cost).**
- **(A) Seam-fix — thread a SPY operand into the S7 snapshot** so `sector_vs_spy` can be computed and verified. The basis becomes real and Kim becomes exemplifiable. Cost: a snapshot-shape change (an adapter/shape addition → `WIRE_EDITORIAL_ADAPTER_VERSION` consideration) + a generation-surface touch; post-gate work.
- **(B) Contract-basis change — retire `sector_vs_spy` for Kim in favor of an operand the seam actually has** (e.g. a raw `sector_change` basis, honestly labeled). Cost: a contract vocabulary change (`wireContracts.js`, `WIRE_GENERATION_VERSION`) and a re-think of what Kim's typed facts assert.

**Recommendation (advisory only).** (A) preserves the intended semantic (relative strength is the point of a rotation column) at the cost of a snapshot enrichment; (B) is cheaper but demotes Kim's facts to raw moves. Either way Kim's exemplars wait for the chosen fix — this is a post-gate iteration, below D-3 in priority.

---

## REGISTER — Doug preview estimate persistence (post-gate)

Doug's `earnings_preview` snapshots carry **null EPS/revenue estimates** (the CIRCULAR seam, P2-39, does not persist forward consensus), so the qualified previews are head-only. They are honest and embeddable as-is, but they teach only `eventType + ticker + "don't fabricate."` **Register (post-gate):** persist the forward consensus estimate into the preview snapshot so a future exemplar set can teach a `consensus_estimate` magnitude. Not a defect — a thin-ness to enrich when the deferred types come back for their v2 embed. No action before the gate.

---

## ACCEPTANCE EVIDENCE

- **New:** `api/_utils/wireExemplars.js` (set + `renderExemplarBlock`), `api/_utils/wireExemplars.test.js` (21 tests: set shape, provenance, and the 11-companion N2.1 re-validation regression).
- **Changed:** `wireSchemaExtension.js` (appends the writes-gated block; +4 tests), `wireGenerationSurface.js` (new manifest member), `wireContracts.js` (`WIRE_GENERATION_VERSION` 10 → 11), `wireGenerationBaseline.json` (regenerated through the P2-15 gate — **never hand-edited**; the lock refused until the version moved forward, then accepted).
- **Invariants held:** M8 flag-off byte-identity **6/6 green** (exemplars appear only under `WIRE_WRITES`); the surface lock refused the change at v10 and passed at v11.
- **Suite:** `vitest run` **6,637 passed / 53 skipped**; `npm run test:rules` **114 passed** (rules untouched by this change).

*20260731_WIRE_N2_EXEMPLAR_QUALIFICATION_AND_EMBED.md — July 31, 2026. Dark; founder merges.*
