# Compatibility Cells — Batch C1: RISK FAMILY (9 offerable rules × 5 archetypes = 45 cells) — V1.1

**Date:** July 29, 2026 · **Authority:** the six locked kernels · ADJUDICATION_RULINGS **V1.2** (binding; citable IDs **R-2…R-8, R-10, R-11, R-13, R-14**; R-1, R-9, R-12 remain excluded) · conventions C-13…C-18 · Signal Inventory V2 · `ruleSupportStatus.js` @ HEAD.
**Scope:** offerable risk rules only. Excluded: `risk-single-stock-limit` (deprecated), `risk-volatility-avoidance`, `r-10` (hidden_absent_substrate — cells author when substrate ships).
**Cell language rule (V1.1, cross-cutting):** guidance is advisory — "the agent is instructed to…"; never enforcement claims.
**V1.1 (post-review):** R1 REJECTED (3 blockers + 5 majors + 1 control breach, all accepted) — every fix applied below. **The Diversifier column is WITHDRAWN from the batch** (self-caught process violation: the guide holds DV cells out of authoring until `SECTOR_CAP_MODE='enforce'` is live and verified; C1 V1.0 authored them anyway and both reviewers graded them on merits — the reviewer's DV findings are preserved in the Annex as PRE-ADJUDICATED, NON-COUNTED inputs for the window's close). **New adjudication records minted this round: R-13 (r-12/contrarian, exact bound) and R-14 (r-09/degen core_conflict)** — adapted applications of case law are new rulings, never "copies" (the control breach corrected). Tally: **6 native · 1 core_conflict · 10 tension · 28 neutral = 45 cells.**

---

## C1-1 · risk-sector-diversification — "spread across ≥{n} sectors" (n: 2–6, d=3)
*Paths: draft board + battle-eval swap candidates + BB construction. Signals: sector (SIG-008-adjacent doc field), held book [B]. Emergency (C-17): the emergency replacement path ignores this screen; a forced swap may transiently breach the spread — the cell states, never guarantees.*
- **momentum_chaser: TENSION + narrowedParams: n ∈ {2, 3}** (R1-F5) — at n=4–6 a six-slot book cannot concentrate inside the top-three-sector aperture, and concentration-in-strength is constitutive for this kernel; at n∈{2,3} the spread floor coexists with a 4+1+1 or 3+2+1 strength book. Guidance (advisory): the agent is instructed the spread floor never outranks leading-sector selection within it.
- **contrarian: neutral** — dislocated names cluster by sector sometimes, but n≤6 on a 6-slot book never forbids concentration in any one washout zone below the cap.
- **degen: neutral** — volatility is sector-agnostic; breadth doesn't dilute ATR access at these bounds.
- **guardian: NATIVE (stored, corroborated)** — diversification as loss-containment is the CP identity's book-shape expression.
- **analyst: neutral** — quality names satisfy breadth without loosening any standard.

## C1-2 · risk-exit-atr-stop — "exit below {multiplier} ATR from entry" (mult ∈ {-1.5,-2,-2.5,-3})
*Paths: battle eval (held positions). Signals: ATR-14 [V, SIG-008], entry price [B]. Emergency: this rule's exits themselves ride the normal risk pass; the C-5 gap (no ATR-unit guardrail shape) means it is ADVISORY — the card's copy already reflects the honest class. Full domain: all four multipliers are loss-cut depths; no value changes the mechanism (R1-8 clean).*
- **momentum_chaser: neutral** — full-domain (R1-F3 discipline): all four depths (-1.5 to -3 ATR) are thesis-failure exits on an adverse move from entry; depth changes patience, not mechanism, and no setting forces exits from advancing trends.
- **contrarian: NATIVE — full-domain calibrated (R1-F3):** the falling-knife failure mode is the archetype's characteristic risk and a defined thesis-failure exit is kernel survival discipline; across the domain, -1.5 ATR is the disciplined scalpel line and even -3 ATR remains a bounded failed-recovery exit — every setting expresses the mechanism, none abandons it. Native across the domain, with the depth choice recorded as calibration.
- **degen: neutral — full-domain calibrated (R1-F3):** the kernel's own core refusal presumes a survival floor exists ("never widens the stop to stay in a loser"); an entry-stop at 1.5 ATR is materially looser than the trail-tightness R-7 narrowed against (0.1–0.2 ATR), and every domain setting sits inside wide-stop tolerance. Neutral across the domain.
- **guardian: NATIVE — full-domain calibrated (R1-F3):** deterministic protective exits are the kernel's own words, and the noise-zone concern from R-8 does not transfer — that bound governed trailing tightness (0.1–0.4 ATR from a peak); a 1.5-ATR adverse move from entry is outside ordinary noise for an entry stop, so the tightest setting stays inside CP patience. Native across the domain.
- **analyst: TENSION (R1-F3)** — the FI doctrine separates business deterioration from chart movement, and an ATR price stop can liquidate an intact quality thesis on price alone. Guidance (advisory): the agent is instructed the stop is capital protection, not a thesis verdict — an exited name whose quality case is intact remains a re-entry candidate.

## C1-3 · risk-avoid-declining-trend — "avoid sustained downtrends until confirmed reversal vs {period}SMA" (period ∈ {50, 200})
*Paths: draft board + swap-in eligibility. Signals: SMA 50/200 [V, SIG-008]. Emergency: emergency replacements ignore this screen (C-17).*
- **momentum_chaser: NATIVE (stored, corroborated)** — refusing downtrends is the kernel's core refusal stated as a rule.
- **contrarian: TENSION + narrowedParams: period ∈ {50}** (R1-F2 — the mixed domain RESOLVED rather than deferred; the referral could not coexist with a counted CC cell). At period=200, trend restoration removes the washout class wholesale — that setting is not offered. At period=50, an early reclaim is one admissible form of the kernel's own stabilization-and-turn entry requirement. Guidance (advisory): the agent is instructed the rule narrows entries to reclaim-confirmed turns; dislocation and recovery evidence still govern selection among them, and the kernel's broader turn evidence (divergence, basing) remains valid analysis even where this rule withholds entry.
- **degen: neutral (stored)** — trend direction is orthogonal to volatility hunting.
- **guardian: neutral (stored)** — compatible caution, but CP's identity is exit discipline, not entry trend screens.
- **analyst: TENSION (R1-F4)** — a mandatory above-SMA condition makes technical state a co-qualifier at admission, rubbing against the FI gate→trigger order (quality qualifies; technicals time). Not core_conflict: the quality gate is not replaced or demoted — a second gate is added. Guidance (advisory): the agent is instructed quality admission remains the primary standard; the trend condition is timing discipline applied to qualified names.

## C1-4 · r-06 — "max {max} stocks per sector" (max: 1–3, d=2)
*Paths: draft + swap eligibility + BB construction. Signals: sector, held book [B]. Emergency: ignored by the emergency path (C-17). Note: this is the honest sibling of the enforced dimension-bridge sector cap — the CARD is advisory; the strategy-lab dimension is the deterministic one.*
- **momentum_chaser: TENSION + narrowedParams: max ∈ {2, 3}** (R1-F5 — the V1.0 reasoning missed the identity issue: max=1 doesn't forbid *buying* strength, it forbids *concentrating* in it, and concentration in leading sectors is constitutive). At max∈{2,3} the cap coexists with the top-sector aperture. Guidance as C1-1.
- **contrarian: neutral** — caps concentration in a single washout sector at max=1; friction exists but every dislocated name remains individually admissible. Below tension: the constraint is shape-level and mild across the domain.
- **degen: neutral** — vol names span sectors.
- **guardian: NATIVE (stored, corroborated)** — sector-level loss containment.
- **analyst: neutral** — standards operate name-level.

## C1-5 · r-07 — "max {max} per sub-industry" (max: 1–2, d=1)
*Paths: draft + swap eligibility. Signals: industryName — VERIFIED AND RENDERED post-wire (SIG-030 class; the un-hide rode the fundamental-wire arc). Emergency: ignored (C-17).*
- **momentum_chaser / contrarian / degen / analyst: neutral (stored ×4)** — hidden-correlation control at sub-industry granularity doesn't interact with any selection identity; max∈{1,2} on one sub-industry never constrains sector-level concentration, so the C1-4 TF concern does not transfer.
- **guardian: neutral (stored)** — correlation control is CP-*compatible*, but the stored map correctly reserved native for the coarser, more identity-expressive sector cap.

## C1-6 · r-08 — "≥{anchors} large-cap anchors + ≤{sails} small-caps" (anchors 1–4, sails 1–3)
*Paths: draft + BB construction. Signals: marketCapClass — rendered post-wire (SIG-028 RESOLVED). Emergency: ignored (C-17).*
- **momentum_chaser: neutral** — strength exists across cap classes; the barbell reorders composition, not trend evidence.
- **contrarian: neutral** — dislocation is cap-agnostic; anchors=4 narrows small-cap washout access but never to zero at these bounds.
- **degen: TENSION + narrowedParams: anchors ∈ {1, 2}** (R1-F6 — the V1.0 domain reasoning was faulty: `sails` is a *ceiling*, so ≤1 permits zero small-caps, and anchors=3–4 makes capitalization outrank volatility for most of a six-slot book). At anchors∈{1,2} the cap-class shaping coexists with vol-first selection in the majority of slots. Guidance (advisory): the agent is instructed volatility selection governs within the barbell's shape.
- **guardian: neutral (R1-F6 — DOWNGRADED from stored native):** capitalization is not a CP kernel element — the kernel names fundamentals, volatility, durability, and protective spread; "large-cap = stability" is adjacency, not corroboration, and adjacency cannot make a rule default-equippable. The native-corroboration standard this sets is recorded in the conventions: **a native requires a named kernel element, not a plausible story.**
- **analyst: neutral** — quality spans cap classes.

## C1-7 · r-09 — "defensive mode at {pct}% drawdown: new swaps low-ATR only" (pct: 5–20, d=10)
*Paths: battle eval (swap-in eligibility, conditional). Signals: portfolio drawdown [B], ATR-14 [V, SIG-008]. secondaryEffects: posture_shift (Batch-1 record). Emergency: the emergency path ignores the low-ATR restriction (C-17) — stated in-cell because this rule's entire mechanism is a restriction the emergency path bypasses.*
- **momentum_chaser: TENSION (R1-F1)** — while active, low-ATR-only reverses the kernel's live preference for moving strength over quiet strength. Guidance (advisory): the agent is instructed the defensive window is temporary and strength-ranking resumes on recovery.
- **contrarian: TENSION (R1-F1)** — bounce energy is a live evidence priority this gate suppresses while active; low-ATR washouts remain admissible but the energetic-recovery class is excluded. Guidance as above (temporary window, advisory).
- **degen: CORE_CONFLICT (R-14 — the reviewer's ruling, minted as a new adjudication record):** "new swaps low-ATR only" is an eligibility gate requiring low-volatility candidates, and the SP rubric expressly makes low-volatility-as-selection-criterion a core conflict. Temporary activation does not change the mechanism — once active, volatility-first selection is suspended entirely, and no trigger depth reconciles it (a deeper trigger delays the violation, it does not remove it). Guidance cannot rescue a rule whose eligible set excludes the archetype's hunting ground before the model chooses. *(V1.0's tension override is superseded; the R1 rejection of that override is the ratification record.)*
- **guardian: NATIVE (stored, corroborated)** — drawdown-triggered de-risking is the kernel verbatim.
- **analyst: TENSION (R1-F1)** — the gate adds a volatility criterion ahead of quality-led selection while active, drifting the identity toward CP. Guidance (advisory): quality admission remains primary within the restricted set; the window is temporary.

## C1-8 · r-11 — "restrict mandatory crypto to {tier}; majors-only in drawdown" (tier ∈ {Support, Core, Any}) — clash only
*Paths: battle eval (crypto slot management). Signals: tier [B], drawdown [B]. Emergency: ignored (C-17).*
- **All five authored columns: neutral (stored, confirmed)** — the mandatory-crypto slot is a mode mechanic; tier placement and drawdown majors-only touch no selection identity. Uniform verdicts, uniform reason (audit item 8 symmetry).

## C1-9 · r-12 — "exclude sectors with FantasyTimes sentiment ≤ {sentiment}" (sentiment ∈ {bearish, neutral})
*Paths: draft + swap-in eligibility. Signals: FantasyTimes sector sentiment [U — SIG-035 caps apply; coverage-dependent; ignore_rule fallback is load-bearing and the cell says so]. Emergency: ignored (C-17).*
- **momentum_chaser: neutral** — avoiding negative-news sectors is compatible with strength-buying (mildly agreeable, below native: news is not the kernel's evidence class).
- **contrarian: TENSION + narrowedParams: sentiment ∈ {bearish} — per R-13 (NEW adjudication record, ratified this round):** the substance was ratified and the citation treatment corrected — r-12's inverse threshold semantics mean R-11's exact bound could not be "copied"; adapted applications of case law are minted as their own records with their own exact bounds. R-11 is cited as reasoning ancestry (gate-vs-preference, breadth-preserving setting mandatory); **R-13's binding bound is `sentiment ∈ {bearish}`** — neutral and bullish sectors remain eligible; the restrictive `neutral` setting is not offered. Guidance (advisory): recently-washed sectors whose sentiment recovered to neutral are prime hunting grounds this rule still admits; the excluded freshest-washout zone is the honest cost, stated.
- **degen: neutral** — news pressure is orthogonal to volatility (if anything agreeable-adjacent, but the kernel excludes news as evidence — neutral).
- **guardian: neutral** — avoiding news-pressured sectors is CP-compatible caution; not identity-expressive (the kernel's protection is mechanical, not sentiment-driven).
- **analyst: neutral** — sentiment screens neither serve nor lower the quality standard.

---

## Batch findings (V1.1)
1. **45 cells: 6 native · 1 core_conflict (r-09/degen, R-14) · 10 tension (5 with narrowedParams) · 28 neutral.** Every native cites a named kernel element (the R1-F6 standard); every tension carries advisory guidance; every narrowing states its excluded settings.
2. **Two new adjudication records minted:** R-13 (r-12/contrarian, bound `sentiment ∈ {bearish}`) and R-14 (r-09/degen core_conflict — the review rejected V1.0's tension override in the harsher direction, the first reviewer-initiated CC of the cell program). The control is restated: **adapted applications of case law are new rulings with their own exact bounds — never "copies."**
3. **The mixed domain on risk-avoid-declining-trend/contrarian is RESOLVED, not deferred:** tension + `period ∈ {50}`; the 200-day setting is excluded for this archetype.
4. **C-17 earned its keep immediately** (r-09's whole mechanism is emergency-bypassed), and R1-F6 set a durable standard: **native requires a named kernel element, not adjacency.**
5. **Diversifier column withdrawn** (process violation self-caught post-review): the guide holds DV cells out of authoring until sector-cap enforce is live and verified. Gate math: **45 authored / denominator 570 offerable minus the DV column's 95 held cells = 45/475 authorable now**, DV's 95 rejoin when the window closes.

## Annex — Diversifier column: PRE-ADJUDICATED INPUTS, NOT COUNTED
Preserved from the R1 review for the window's close (each re-ratifies then): risk-sector-diversification NATIVE (stored, corroborated — the thesis itself) · risk-exit-atr-stop **CORE_CONFLICT** (book-shape-driven exits; position-level loss exits firing independently of concentration shape are expressly rejected) · risk-avoid-declining-trend TENSION (name screens capable of starving sectors) · r-06 NATIVE (stored, corroborated) · r-07 NATIVE (stored, corroborated) · r-08 neutral · r-09 **CORE_CONFLICT** (volatility ceiling as entry gate — express rubric clause) · r-11 neutral · r-12 TENSION (sentiment gating can starve breadth; at `neutral` only bullish sectors survive and the ignore_rule fallback resolves absent data, not an observed narrow market — guidance: breadth remains primary, the filter yields advisorily when it would collapse the sector set).
