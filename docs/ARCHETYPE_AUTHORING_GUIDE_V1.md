# Archetype Authoring Guide — V1.1

**Date:** July 23, 2026 (V1.0 Jul 23; V1.1 same day — incorporates Phase 3 Review R1 findings 1–13 and the Jul 23 wire verification)
**Governs:** authoring of the 702-cell compatibility matrix (117 equippable rules × 6 archetypes; 350 cells currently missing), the 143-template base metadata (`intendedMode`, `copyClass`, `receiptTag` + deterministic-path fields), baseline rulebooks, and the six Partner Contracts.
**Authorities:** Spec V1.3 (V1.1 + Sheets A/B) · the six constitutions — **content founder-approved, lock-state pending the registry hash** (R1-5: "locked" was inaccurate) · the code zone-encoding + registry snapshot as canonical archetype source (the markdown DEF docs are frozen June-24 companions — Jul 23 verification) · founder rulings Jul 23, including `SECTOR_CAP_MODE = 'observe'` (time-boxed) with `sectorConcentrationCap` wired as the cap's single source.
**Standing rule:** every verdict, mode assignment, and bound must cite its authority — a rubric step, a kernel element, or a spec section. An uncited verdict is an opinion, and opinions do not enter the matrix.

---

## §1. The verdict procedure

Each constitution carries a four-step rubric; all six share one skeleton, applied **first-hit-wins, in order**:

1. **core_conflict** — the rule reverses the kernel: violates a coreRefusal, inverts the evidencePriority (including its order-of-operations, e.g. FI's gate→trigger), or breaks the archetype's constitutive mechanism.
2. **tension** — the rule pushes against errorPreference, timeDoctrine, or riskDoctrine without reversing them, or drifts the identity toward a named neighboring archetype. Requires an authored treatment (§4).
3. **native** — the rule expresses the kernel; the archetype's own allowlist family (TF-01…, CN-01…, etc.) is the calibration reference for what native looks like.
4. **compatible** — orthogonal to the kernel: liquidity hygiene, process rules, generic caps that touch no identity axis.

**Verdicts are archetype-relative — this is the point, not a bug.** Canonical worked example: *"rotate out of positions that haven't moved in N sessions"* → **native** for Trend Follower (timeDoctrine: stalls rotate briskly) · **core_conflict** for Capital Preserver (coreRefusal: never shaken out by noise; `forcedRotation` OFF is identity). Same rule, opposite verdicts, both citable. When a verdict feels uncomfortable, check whether the discomfort is the rubric working.

**Citation format per cell (EXTENDED per R1-5):** `{ruleId, archetypeId, verdict, rubricStep, kernelElement(s) cited, treatment?, paramBounds?, note?, kernelIdentityVersion, kernelIdentityHash, status: provisional|locked}`. The last three are mandatory: a cell authored against one kernel must not silently satisfy the activation gate after that kernel changes. **The activation gate counts only `status:'locked'` cells whose `kernelIdentityHash` matches the current registry hash** — the Spec §3.3 exact-parent-compile discipline applied to authored content. A kernel `identityVersion` bump invalidates its entire column and forces re-verdict.

**Absence discipline (Spec A-4):** absence is not a verdict. Intentionally universal rules receive an explicit `compatible` per archetype. The activation gate counts explicit cells only.

## §2. Evidence-relationship types (FOUR — one ratified here)

How an archetype relates to an evidence category determines the core_conflict test for rules touching that category:

| Type | Definition | Exemplar | core_conflict test for a rule |
|---|---|---|---|
| **deprioritized** | admitted, low weight, tie-break only | TF fundamentals 0.05 | making it *outrank* higher priorities (a fundamental gate on TF = tension; a fundamental *override of trend evidence* = conflict) |
| **counter-indicative** | actively negative signal | Contrarian **name-level** momentum | making it a *positive* signal at any weight |
| **excluded** | weight zero — not evidence at all | Speculator fundamentals 0.00 | admitting it as *any* entry condition (a quality screen is conflict for SP where it is only tension for TF — sharper line, same category) |
| **noise_discounted** *(RATIFIED HERE as type 4)* | admitted only above a threshold; below it, it does not register | CP short-term price action ("noise is not evidence") | any rule that lets sub-threshold evidence trigger action (noise-reactive stops, wobble-triggered exits) |

**Plus one axis, not a type:** an archetype's top priority may be a **portfolio state rather than a name property** (Diversifier: book shape outranks selection). For such archetypes, "reverses the evidencePriority" includes elevating name-merit above portfolio state — a rule can be core_conflict without mentioning the portfolio at all.

**Operational requirement for `noise_discounted` (R1-7).** The type is unusable without a stated threshold — "is 3% a wobble or a breach?" must not be an author's judgment call. Every `noise_discounted` use MUST name an **executable threshold source**: a deterministic risk line or a named predicate family. For Capital Preserver the sources are its own deterministic lines — the patient stop, the stepped trail (+1.0×ATR on a short-MA break), and the VWAP-failure line; price action breaching none of them is noise. **Interim rule, binding until a threshold is cited: rules touching short-term price movement are `tension`, never `core_conflict`.** This interlocks with §4 — "fires on noise" is decided by `paramBounds` against the cited line, not by adjectives.

## §3. Gating vs. ranking (founder-ruled, Diversifier session)

A **gate** excludes candidates; a **ranking** preference orders them. The distinction is load-bearing wherever an archetype's identity depends on what it does *not* filter: a quality gate on Diversifier collapses it into Capital Preserver (core_conflict); a quality *ranking among shape-equivalent candidates* is native rulebook material.

**⚠ CORRECTED (R1-1) — mode is immutable per ruleId.** The prior text permitted one rule to act as a gate for one archetype and a ranking for another. That contradicts Spec §5.1: a template carries ONE global `intendedMode`, and the cell schema has no archetype-specific mode override — the compiler cannot represent it. The rules that hold instead:
- `intendedMode` is fixed per `ruleId` and never varies by archetype.
- Where two archetypes genuinely need different semantics of the same condition, author **two ruleIds in the same `family`** (e.g. `require_fundamental_floor` as an eligibility constraint vs. `prefer_fundamental_strength` as a scoring modifier).
- The ONLY archetype-relative modulation is the ratified tension treatment **`advisoryDowngrade`** (§4), which forces `prompt_advisory` + `required_consideration` regardless of `intendedMode`.
- Therefore, when a gate-shaped rule threatens an archetype that must not filter on that axis, the verdict is **core_conflict** (refuse it) or **tension + advisoryDowngrade** (demote it) — never a silent reinterpretation as ranking.

## §4. Tension treatments

Every `tension` cell carries one authored treatment:
- **narrowedParams** — the rule is admitted with archetype-`paramBounds` overriding the template bounds. Choose when the rule's *mechanism* is acceptable and only its *magnitude* threatens identity. Reference pair: CN-03 (Contrarian stop: tight default, scalpel bounds) vs. SP-01 (Speculator stop: wide default, small tightening range) — same template, opposite bounds; author such pairs together.
- **advisoryDowngrade** — forced `prompt_advisory` + `required_consideration` regardless of intendedMode (Spec §5.4 legality). Choose when the mechanism itself pulls against identity but the *consideration* is legitimate.

**Neighbor-bounded tension (structural, per the Genome finding):** the conservative cluster (FI, CP, Diversifier) defines tension by *drift direction toward a named neighbor* — FI drifts toward CP (unclocked patience) or TF (technical-led entry); CP drifts toward FI (clock-aware rotation) or Diversifier (breadth-primary). Cells in this cluster must name the neighbor in the citation; the three extreme archetypes (TF, Speculator, Contrarian) rarely need this.

## §5. Category→computed-signal mapping

Kernels name evidence **categories**, never indicator names (founder-ruled): identity survives data-supply changes; hash-locking an indicator would force identity bumps on cron changes. This table binds categories to computed signals; **every row verified against the real cron/ranking output at Phase 3 build before any cell citing it is authored** — entries below are seeded from the definition docs and remain UNVERIFIED until then:

| verificationId | Kernel category | Verified binding | Status @ HEAD `5c04de2` |
|---|---|---|---|
| SIG-001 | realized volatility | `atrPercentile` — persisted (`compute-index-intelligence.js:916-925,1009`) | VERIFIED |
| SIG-002 | band fit / extension | `baggerBombFit` — persisted (`:1008`); **`bbFit` is NOT a field**, only a CSV alias in prompt assembly | VERIFIED (alias corrected) |
| SIG-003 | business quality | `fundamentalScore` — persisted (`:1000`); the FI floor text is SOFT draft-time prompt, not a gate | VERIFIED (enforcement class corrected) |
| SIG-004 | momentum / strength | `momentumScore` (distinct from technicalScore), `arch_scores.*` (6 keys, 0–100, persisted), `return1M` (21-bar, persisted) | VERIFIED |
| SIG-005 | dislocation / inversion | `inverseComposite` — rank-time derived, NOT persisted | VERIFIED (derived) |
| SIG-006 | spread / shape | `sectorDiversity` — rank-time derived, NOT persisted; + held-book distribution | VERIFIED (derived) |
| SIG-007 | turn / stabilization | **DO NOT CITE — no such signals exist** (zero code hits). Bind turn-language to what is real: RSI-14 zones ("oversold" exists only as an RSI zone label), swing S/R (`levels.nearestResistance` real), RSI-divergence, multi-TF trend, candle pattern | VERIFIED (refuted as named) |
| SIG-008 | full cron indicator set | SMA 20/50/200 · RSI-14 · MACD 12/26/9 · ATR-14 · NR7 · Bollinger 20/2 · RVOL · pivots · multi-TF trend · swing S/R · RSI-divergence · candle pattern · RS-vs-SPY · momentum ranks · returns 1W–12M (`compute-index-intelligence.js:661-758`) | VERIFIED |

**Binding rule (R1-11/R2-5):** every compat cell or metadata entry citing a signal category MUST carry the row's `verificationId`; the id pins `{category, binding, verified HEAD, status}`. A re-verification at a new HEAD mints new ids (`SIG-0xx@<head>`); cells citing a superseded id are flagged for re-review, not silently retained. Status enum: `VERIFIED | REFUTED | SUPERSEDED`.

Detector-authoring note: **persisted vs. rank-time-derived matters** — a rule's `detectorSource`/`requiredSignals` may cite persisted fields freely; derived-only values (`inverseComposite`, `sectorDiversity`) are available at ranking but are not queryable stored signals.

User-specified indicator conditions live in the **rules layer** with §5.1 `detectorSource`/`requiredSignals` declared — never in kernels.

## §6. Kernel content requirements (for archetype #7+ and any identityVersion bump)

Six elements, nothing more (DR-11). Mandatory within them: **two-sided exit disposition** stated explicitly in timeDoctrine/errorPreference — profit side and loss side — with deliberate asymmetry allowed only as an explicit statement (CP: no *eager* profit-taking disposition by design, while deterministic protective exits still fire in profit; Diversifier: both sides book-level). Evidence stated as categories per §5. Every element traceable to a fired wire — dead-field authoring is the trap (Contrarian's `rsWeight`; the CP provisional's spread error); where a wire is inert (Diversifier's cap) the kernel does not lock until it fires — **as amended by ratified Sheet C item C-1:** Diversifier's lock dependency closes when the flat6 cap is in enforce mode and verified; tiered mode remains constitutionally enforced pending the weight-aware-cap arc and does not independently block V1 lock. The golden render is CI-tested per archetype; cap **175 tokens** (bloat guard — the per-archetype golden test is the real control; uniform length was never a goal).

## §7. Base metadata authoring (143 templates)

Per Spec §5.1/§5.3/§5.4 + Amendment B-1. Required 143/143: **`intendedMode`** (eligibility_constraint / execution_constraint / scoring_modifier / required_consideration / tie_breaker — assign from what the rule *does* to the candidate flow, not from its tone; tie_breaker is lean-class content and should be rare in the corpus), optional `secondaryEffects[]` for compound rules (one primary mode; clause decomposition is post-launch), **`copyClass`** (deterministic only where a real substrate will enforce; everything else advisory — §9 display-agreement applies to metadata), **`receiptTag`** (stable, never reused). Required only where compilation would yield `effectiveEnforcement:'deterministic'`: **`detectorSource`** (honest: `deterministic:<fieldPath>` only for fields that exist; `llm_prompt` is a legitimate answer), **`requiredSignals[]`** + freshness class, **`missingDataFallback`** (legality: deterministic constraints may only abstain/block/fail-compile; `ignore_rule` is advisory-only), **`guardrailBinding`** — all nine fields including `valueParamKey` (B-1: pointer into frozen `paramValues`; unresolvable = loud authoring error). Known substrate facts: three supported guardrail shapes (`stopLoss`, `trailingStop`, `maxSectorWeight`); `maxPosition`/`profitTarget` deliberately unsupported. **⚠ CORRECTED (R1-10 + Jul 23 verification): there is NO deterministic shortlist/admission substrate at HEAD.** FI's quality floor is soft prompt text injected at draft assembly only; the eval/swap assembler never imports `ARCHETYPE_CONSTRAINTS`; zero deterministic `fundamentalScore` gates exist in the guardrail, decide, eval, or scoring paths. Consequences: (a) the "exact-live-gate" branch R1-10 proposed is **empty** — no gate-shaped rule can claim deterministic provenance, so **all** of them author `prompt_advisory` with `detectorSource:'llm_prompt'`, which is honest rather than under-promising; (b) the Amendment C item is **rescoped** from "ratify an existing substrate" to "**a deterministic admission gate is a future build arc**"; (c) until that arc ships, the DR-13 identity block is the only carrier of quality-floor language into swap decisions, which raises its priority. **Never invent a binding for a substrate that does not exist.**

## §8. Authoring workflow

Order: (1) verify §5 table + all §10 wire checks — **strictly first; no provisional-meanwhile authoring (R1-11)** → (2) base metadata, all 143, batched by category → (3) compat cells **rule-major** (one rule across all six archetypes at a time — forces the archetype-relative contrast that catches bad verdicts; the rotate-on-stall example emerged exactly this way) → (4) baseline rulebooks per archetype (~10 rules each, drawn from native cells; the rulebook is the kernel executable, not a greatest-hits list).

**Atomic authoring for parameterized rules (R1-8).** A rule whose template domain spans both identity-safe and identity-breaking values has **no determinate first-hit verdict until its bounds exist**. Therefore cell + treatment + `paramBounds` are authored **in one atomic unit** (paramBounds is no longer a later step). Decision basis, stated so authors cannot diverge: **judge the full template domain first**; if the mechanism is acceptable only within a subset, assign **tension + narrowedParams** and record the admitted domain in the cell. Stop-family rules are authored as archetype sets in one sitting (Contrarian scalpel · Speculator wide-low-reactivity · CP wide-patient bidirectional), since their bounds are defined against each other.

Review: each batch gets the standard adversarial pass (ChatGPT) before entering the gate count; the activation gate (Spec §5.6 + A-4) is the completion scoreboard — 143/143 base, 702/702 explicit `locked` cells at current hash.

## §9. Partner Contract shared vocabulary (banked for the cross-archetype session)

**The corrected hand-off model** (originates in the CP definition; stated once for all six): (1) the agent adjusting its **own** book through conversation — real in every mode; the core conversation road. (2) Pointing at the **user's** actions — mode-dependent lever inventory: *standard* = NO trade lever (coach-a-directive, equip-watchlist pre-deploy only; "do that trade yourself" is dishonest here); *tournament* = flip (≤5/day), claim (≤3/cycle), board ranking. (3) **Screener-coaching** — real in every mode; name real fields/operators; frame as "go explore," never "bring results back" (round-trip is future-build). Honesty rules: never name specific tickers outside the archetype's competence; never promise chat reasoning over screen results. **Zone-4 direction is per-archetype** (most hand off defense; CP hands off offense). **`hold_line` — defined as a shared interaction kind (R1-12).** The controlling authority is the Contrarian definition's own exception: **explicit conversation grants authority.** So `hold_line` is advice-then-bounded-compliance, never open-ended resistance:
- **Trigger:** a user request that contradicts a standing risk line the archetype owns (Contrarian's pre-stop capitulation; CP's protection layers; Speculator's survival floor).
- **Allowed action:** exactly one in-character pushback naming the line and the reason — then, on explicit confirmation, **compliance through the directive gate** (whose bounds GameModePolicy intervention tiers already govern: training pods gated+logged, ranked gated+receipted, vehicles none).
- **Not allowed:** silent compliance (the pushback is owed), repeated resistance after confirmation, or acting on silence.
- **Receipt:** the directive is logged with the pushback noted, so declared-vs-observed behavior stays auditable.
The kernels are already consistent with this; the earlier "neither hand-off nor compliance" phrasing was the defect. The session instantiates the seven partner fields per archetype against this vocabulary, and carries the integrity fix inside disagreementBehavior (TF coreRefusal 4 is the constitutional anchor).

## §10. Verification state (updated Jul 23, HEAD 5c04de2)

Founder-approved ≠ technically locked; formal lock is the registry hash. Status after the CC wire verification:
- **(a) Contrarian — ✅ FULLY RESOLVED.** Constraint conflict cleared (both clauses are soft shortlist-level prompt bias — ~5 of a 25–35-name pool, no top-sector filter exists, nothing binds the final 6-pick book; the name-level kernel is wire-compatible, no calibration change needed) AND the weight vector is HEAD-verified complete per (f), adding the bounce-energy priority.
- **(b) Diversifier — weights ✅ RESOLVED; cap ⚠ BLOCKED THROUGH THE OBSERVE WINDOW.** Founder ruling accepted (`'observe'` time-boxed → `'enforce'`; `sectorConcentrationCap` single-sourced), but observe mode records rather than blocks, so the kernel's deterministic cap promise is unbacked until `'enforce'` is live and verified. Lock blocked **through flat6 enforce-verification only (ratified C-1)** — tiered-mode substrate absence does not independently block; Diversifier cells stay out of authoring; per the R1 reviewer call they author LAST regardless.
- **(c) Canonicality — ⚠ FINDING INVERTED.** The markdown DEF docs are **frozen June-24 extracts** (byte-identical across their git history); the **code zone-encoding (`archetypeAdjustments.js`) + registry snapshot are the corrected, canonical pair** (byte-identical to each other, hand-verified across all 4 zones × 6 archetypes). Constitutions' "incorporated by reference" pointers resolve to the code encoding via the registry; the markdown DEFs are narrative companions, and their overclaims ("real exclusion," "winners held") are flagged for a separate resync tasking.
- **(d) FI floor — enforcement class corrected.** Soft, draft-time only (see the FI constitution's corrected provenance). No deterministic shortlist substrate exists at HEAD; all gate-shaped rules author `prompt_advisory` until such a substrate is built and ratified.
- **(e) Guardian — wires complete**; six dead config fields confirmed; profit-exit inventory enumerated (trail-stop, discretionary swap, equippable trailing stop, VWAP edge) — the CP kernel's exit disposition is authored against this verified inventory.
- **(f) ✅ RESOLVED (R3): the six-vector `ARCHETYPE_WEIGHTS` read landed** (`archetypeScoring.js:14-63`, HEAD `5c04de2`). All six vectors complete, sum 1.00, uniform key order, `baggerBombFit` canonical, every key consumed for every archetype (0.00 weights are consumed-at-zero, never unread — the excluded evidence-type semantics are genuine), and **mode-invariant** (no resolveWeights/weightsByMode exists; archetype identity is not mode-scoped). No value drift on any DEF-quoted term. Substantive fallout: TF gained band-fit (.30) + volatility (.25) evidence priorities; Contrarian gained a bounce-energy priority (atr .20 + bandFit .15). Both additions: Founder re-approved July 23, 2026, following the complete HEAD weight-vector verification. **Hash composition is no longer weight-gated for any archetype** — Diversifier's cap remains the only outstanding lock blocker.

**Authoring precondition (R1-11, strict direction):** cell authoring begins only against verified rows and cleared kernels — no provisional-meanwhile authoring. Every cell stamps `{kernelIdentityVersion, kernelIdentityHash, status}` (R1-5); the activation gate counts `locked` + current-hash cells only.
