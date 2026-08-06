# Compatibility Cells — Batch C2: TECHNICAL FAMILY (21 offerable rules × 5 archetypes = 105 cells) — V1.1

**Date:** July 29, 2026 · **Authority:** the six locked kernels · ADJUDICATION_RULINGS **V1.4** (citable: R-2…R-8, R-10, R-11, R-13, R-14, and the **C2 mints R-15…R-22** below; excluded: R-1, R-9, R-12) · conventions C-13…C-18 · Signal Inventory V2 · the Reverse-Direction Map Audit (this batch **adjudicates every audit flag on this family** per Disposition D3 — 15 flags accepted, refuted candidates honored as confirmations).
**Excluded (hidden):** t-09, t-10, tv-04, tv-07 (intraday/VWAP substrate). Diversifier column held (annex inputs only, from the audit's item-5 flags).
**Standards in force from C1:** natives cite a named kernel element · every verdict is full-domain · adapted case law mints new rulings with exact bounds · guidance is advisory ("the agent is instructed…").
*Shared paths (C-16): all rules below act on draft board + battle-eval swap candidates unless noted; signals are SIG-008-class [V] throughout (RSI/SMA/MACD/Bollinger/RVOL/RS/NR7) except technicalScore [U] where noted. Emergency (C-17, family-wide): the emergency replacement path ignores every screen and preference in this family.*

## C2 mints (recorded in ADJUDICATION_RULINGS V1.3; exact bounds live there)
**R-15** t-14/contrarian: stored CC → **TENSION** (a withholding gate — "only act on breakouts when volume confirms" — makes chasing *harder*, never prefers breakouts; the audit's forward flag, accepted). · **R-16** t-12/degen: stored native → **TENSION** (the 5–25th-percentile BBW domain selects *inside* compression on every value — anti-volatility until the break; the rubric's lower-vol-band push fires before the breakout story). · **R-17/R-18** tech-rsi-overbought TF & degen: → **TENSION + narrowedParams {strictMode: false; threshold ∈ [70,85]}** (the "Hard exclusion mode" toggle converts a chase-avoidance tilt into an eligibility gate that, at 60, excludes exactly the extended live movers both kernels prize; the preference arm at high thresholds coexists). · **R-19** tech-macd-bullish/contrarian: → **TENSION + narrowedParams {macdDirection ∈ {bullish crossover}; rsiFloor ∈ [40,50]}** (only the crossover option is turn evidence; "above zero line" + floor 65 is established momentum, and the 55+ hint filters the very bounces the kernel buys). · **R-20** tv-05/contrarian: → **TENSION + narrowedParams {direction ∈ {turning positive}}** (all three options gate on non-negative MACD; only the turn option is kernel-admissible evidence). · **R-21** tv-02/analyst: → **TENSION + narrowedParams {action ∈ {reduce tier, hold but monitor}}** (reduce-tier as bounded reallocation; flag-for-swap barred under deterioration-vs-chart). **R-22 (AS AMENDED)** tv-02/guardian: → **TENSION + narrowedParams {action ∈ {hold but monitor}}** (reduce-tier is an affirmative exposure change on sub-threshold signal — an action, not monitoring; barred with flag-for-swap under the noise refusal). **V1.1 mints R-23…R-33** (review round): R-23 MA-trend/contrarian {period ∈ {20,50}; requireAlignment:false} · R-24 avoid-declining/contrarian {period ∈ {50}} · R-25 t-16/contrarian {count ∈ {2of3}} · R-26…R-29 squeeze-family/guardian → TENSION (flag-not-mandate: tech-bollinger-squeeze, t-12, t-15, tv-05) · R-30/R-31(CONTESTED-resolved)/R-32 squeeze-family/degen → TENSION (compression ≠ realized movement) · R-33 tv-01/momentum_chaser {stretched ∈ [75,85]}.

---

## C2-1 · tech-rsi-oversold — prioritize RSI<{threshold} (15–45) reversal candidates, optional volume confirm
- **momentum_chaser: CORE_CONFLICT (stored, corroborated)** — prioritizing sub-threshold RSI is weakness-buying, the kernel's core refusal; full domain (even 45 targets the weak half).
- **contrarian: NATIVE (stored, corroborated — kernel element: washed-out entry)** — the oversold zone is the hunting ground; the optional volume confirm reads as capitulation evidence.
- **degen: neutral** — oversold names may or may not carry volatility; orthogonal across the domain.
- **guardian: neutral** — an entry preference; protection mechanics untouched.
- **analyst: TENSION (audit item-10 flag, accepted)** — buying the oversold with *no quality pre-filter in the product* assumes an admission gate that does not exist. Guidance (advisory): the agent is instructed quality admission precedes the reversal preference; oversold status never substitutes for the standard.

## C2-2 · tech-rsi-overbought — skip/deprioritize RSI>{threshold} (60–85; strictMode toggle = hard exclusion)
- **momentum_chaser: TENSION + narrowedParams: {strictMode: false; threshold ∈ [70,85]} (R-17)** — the strict arm at low thresholds excludes extended strength, TF's own evidence class. Guidance (advisory): the agent is instructed that chart extension is assessed through band-fit ranking, never excluded by an RSI ceiling.
- **contrarian: NATIVE (stored, corroborated — kernel element: inverse-crowd avoidance of the loved/extended)** — full domain: both arms express the identity; the strict arm merely mechanizes it.
- **degen: TENSION + narrowedParams: {strictMode: false; threshold ∈ [70,85]} (R-18)** — stretched live movers are evidence priority for this kernel; the strict-gate arm at 60 removes them. Guidance (advisory): the agent is instructed the deprioritization is a late-extension caution, never an exclusion of live movers.
- **guardian: neutral** — chase-avoidance is compatible caution, not a CP kernel element (capitalization-lesson standard: adjacency ≠ corroboration).
- **analyst: neutral** — extension screens neither serve nor lower the quality standard.

## C2-3 · tech-bollinger-squeeze — flag squeezes (bandwidth <{pct}th percentile, 5–40) for breakout, volume confirm
- **momentum_chaser: neutral** — pre-breakout flagging is early for a confirmation-driven kernel; a watchlist tilt, not a strength claim.
- **contrarian: neutral** — compression is direction-agnostic; neither dislocation nor chase.
- **degen: TENSION (R-30 — stored native NOT SUSTAINED; R1-F3):** compression is not realized movement, and the kernel says movement itself is the opportunity — a squeeze flag positions in the quiet before an expansion that may not arrive, R-16's own mechanism one rule over. Guidance (advisory): the agent is instructed to pair the flag with realized expansion or volume evidence before entry weight.
- **guardian: TENSION (R-26 — stored core_conflict NOT SUSTAINED; R1-F3):** a compression *flag* mandates no entry and overrides no protection — anticipated expansion is adjacency to volatility, not a mechanism forcing unsafe exposure. Guidance (advisory): the agent is instructed the flag never outranks the volatility and downside screens.
- **analyst: TENSION (audit flag, accepted)** — band compression as the whole selection basis puts momentum/volatility evidence ahead of quality in the ordering. Guidance (advisory): the agent is instructed that quality admission precedes the squeeze preference; compression status never substitutes for the standard.

## C2-4 · tech-moving-average-trend — filter out below-{period}MA ({20,50,200}; requireAlignment toggle)
- **momentum_chaser: NATIVE (stored, corroborated — kernel element: refuses downtrends; trend filter is the identity's gate)** — full domain; alignment toggle only strengthens confirmation.
- **contrarian: TENSION + narrowedParams: {period ∈ {20, 50}; requireAlignment: false} (R-23 — stored core_conflict NOT SUSTAINED; R1-F1):** the V1.0 asymmetry defense was wrong — for a washed-out name, being above the 20/50 MA is satisfied precisely at reclaim, mechanically the SAME predicate as C1-3's confirmed-reversal clause; the kernel requires stabilization/turn evidence and an early-MA reclaim is one form of it. The 200-day setting and full alignment (trend fully restored — hunting ground gone) are not offered. Guidance (advisory): the agent is instructed the reclaim is turn confirmation, never a substitute for dislocation and the recovery thesis.
- **degen: neutral (stored)** — trend direction orthogonal to volatility.
- **guardian: neutral (stored)** — compatible caution; the kernel's protection is exit-side, not entry trend screens.
- **analyst: TENSION (C1-3 analyst precedent applied — same mechanism, same verdict)** — a technical co-qualifier at admission rubs the gate→trigger order. Guidance (advisory): the agent is instructed quality admission remains the primary standard; the technical condition is timing discipline applied to qualified names.

## C2-5 · tech-macd-bullish — boost conviction on {macdDirection} with RSI≥{rsiFloor} (40–65)
- **momentum_chaser: NATIVE (stored; audit's refutation of the demotion candidate is the corroboration — kernel element: strengthens the momentum trigger)** — all three direction options are realized bullish states; observed confirmation, not turn-prediction.
- **contrarian: TENSION + narrowedParams: {macdDirection ∈ {bullish crossover}; rsiFloor ∈ [40,50]} (R-19)** — only the crossover-at-low-floor corner is turn evidence. Guidance (advisory): the agent is instructed to treat the crossover as the kernel's own turn confirmation, subordinate to dislocation and recovery.
- **degen: neutral** — momentum conviction tilts don't touch volatility selection.
- **guardian: neutral** — a conviction boost on entries; protection untouched.
- **analyst: neutral** — conviction modulation within qualified names; the standard is not lowered.

## C2-6 · tech-volume-surge — weight volume-confirmed moves ({1.5,2,3}x)
- **momentum_chaser: NATIVE (stored, corroborated — volume confirmation is a listed definition-derived TF clause)**.
- **contrarian: neutral (stored — the audit itself endorses the capitulation/accumulation reading: surge volume is direction-agnostic evidence)**.
- **degen: neutral** — volume weight ≠ volatility selection; mild adjacency, below native by the C1-6 standard.
- **guardian: neutral** · **analyst: neutral** — a weighting tilt; no gate, no standard touched.

## C2-7 · tech-relative-strength — favor {rank} vs sector peers (top quartile / above median), avoid laggards
- **momentum_chaser: NATIVE (stored, corroborated — relative strength is the kernel's ranking spine)**; full domain (both ranks are strength-preferences).
- **contrarian: CORE_CONFLICT (stored, corroborated)** — a name-level RS requirement with an avoid-laggards clause inverts counter-indicative selection; laggards ARE the universe. Both domain values fire it.
- **degen: neutral (stored)** · **guardian: neutral (stored)** · **analyst: neutral (stored)** — RS tilts don't touch vol, protection, or quality standards. *(Analyst note: distinct from t-11 — no absolute floor clause here, so no veto mechanism; preference only.)*

## C2-8 · tech-avoid-declining — exclude below-{period}MA ({50,200}) long-term decliners
- **momentum_chaser: NATIVE (stored, corroborated)** — third member of the no-downtrend family; same kernel gate.
- **contrarian: TENSION + narrowedParams: {period ∈ {50}} (R-24 — stored core_conflict NOT SUSTAINED; same R1-F1 mechanism as C2-4):** the 50-day reclaim is early-turn evidence; the 200-day setting is excluded as trend-restored. Now exactly consistent with C1-3's tension + {50} — one predicate, one verdict, three rules.
- **degen: neutral (stored)** · **guardian: neutral (stored)** · **analyst: TENSION (C1-3/C2-4 precedent — technical admission co-qualifier).** Guidance (advisory): the agent is instructed quality admission remains the primary standard; the technical condition is timing discipline applied to qualified names.

## C2-9 · t-11 — prefer RS≥{score}/22 (10–22), avoid below {floor}/22 (0–15)
- **momentum_chaser: NATIVE (stored, corroborated — strength floor + preference is the kernel mechanized)**; full domain.
- **contrarian: CORE_CONFLICT (stored, corroborated)** — the floor clause excludes the weak-RS class wholesale; at floor=0 the gate vanishes but the preference still inverts selection — and R1-8 narrowing to {floor: 0} would leave a pure strength preference that remains the chase; conflict across the meaningful domain.
- **degen: neutral (stored)** · **guardian: neutral (stored)**.
- **analyst: TENSION (audit flag, accepted)** — the floor clause is a technical *veto* on names whose quality thesis is intact; the kernel's conflict rule says weak technicals may not veto quality. Guidance (advisory): the floor is instructed as a timing caution, never an admission verdict; **paramBounds lean (non-binding): floor ≤ 8** keeps the veto shallow.

## C2-10 · t-12 — prioritize lowest-{pct}th percentile BB Width (5–25) + volume {vol}x (1–2.5)
- **momentum_chaser: neutral (stored)** — compression-hunting is pre-strength; a watchlist tilt.
- **contrarian: neutral (stored)** — direction-agnostic compression.
- **degen: TENSION per R-16 (stored native NOT SUSTAINED)** — every domain value selects inside the compression band; the position is anti-volatility until the break arrives. Guidance (advisory): the agent is instructed the setup is a *volatility-expansion bet* whose holding period inside compression contradicts live-vol selection — pair with expansion confirmation.
- **guardian: TENSION (R-27 — stored core_conflict NOT SUSTAINED; R1-F3):** prioritization inside compression forces no entry and overrides no protection; adjacency, not mechanism. Guidance (advisory): the agent is instructed the prioritization never outranks the volatility and downside screens.
- **analyst: TENSION (audit flag, accepted)** — compression as the selection reason with no quality precondition; TF-drift class. Guidance (advisory): the agent is instructed quality admission precedes the compression preference; band width never substitutes for the standard.

## C2-11 · t-13 — adjust conviction {conviction} on RSI divergence (light/moderate/strong)
- **momentum_chaser: neutral** — divergence-reactive conviction is deterioration monitoring on holdings; compatible, not a kernel element.
- **contrarian: NATIVE (kernel element: stabilization-and-turn evidence — bullish RSI divergence is named turn material in the kernel's own entry requirements)**; full domain (conviction depth is magnitude).
- **degen: neutral** · **guardian: neutral** · **analyst: neutral** — conviction tilts, no gates.

## C2-12 · t-14 — act on breakouts only when volume >{mult}x 20-day avg (1.2–3)
- **momentum_chaser: NATIVE (stored; the tv-13-refutation logic corroborates — raising the confirmation bar on strength entries is rubric step 3)**.
- **contrarian: TENSION per R-15 (stored CC NOT SUSTAINED — the audit's forward flag accepted)** — a withholding gate that makes chasing strictly harder never instructs preferring breakouts; the same volume signal is correctly neutral at C2-6 on the capitulation reading. Guidance (advisory): the rule constrains *if* the agent ever acts on a breakout; it creates no pressure to seek them.
- **degen: neutral (stored)** · **guardian: neutral (stored)** · **analyst: neutral** — an action-withholding condition; no selection pressure, no standard touched.

## C2-13 · t-15 — prioritize NR7 flags with technical score >{score} (50–90)
- **momentum_chaser: neutral (stored)** — pre-breakout compression tilt; below the strength bar.
- **contrarian: neutral (stored)** — direction-agnostic.
- **degen: TENSION (R-31 — stored native NOT SUSTAINED; **CONTESTED and resolved**: the map audit refuted this very demotion, the batch review re-raised it, and the review's mechanism argument prevails — NR7 is compression, not realized movement, and a score floor does not transform quiet into motion; the contest is recorded in the mint, not erased).** Guidance (advisory): the agent is instructed the flag is an expansion *bet* — pair with realized movement before entry weight.
- **guardian: TENSION (R-28 — stored core_conflict NOT SUSTAINED; R1-F3):** same flag-not-mandate reasoning as C2-3/C2-10. Guidance (advisory): the agent is instructed the NR7 flag never outranks the volatility and downside screens.
- **analyst: TENSION (audit flag, accepted)** — range compression + technical score is the entire selection rule; at score=50 the bar is weak and quality absent across the domain. Guidance (advisory): the agent is instructed quality admission precedes the compression preference; a technical score never substitutes for the standard. **paramBounds lean (non-binding): score ≥ 70.**

## C2-14 · t-16 — select only when {count} of [SMA-uptrend, RSI 50–70, above VWAP] bullish (2of3 / 3of3)
- **momentum_chaser: NATIVE (kernel element: confirmation stacking strengthens the momentum trigger — the tv-13-refutation logic)**; full domain.
- **contrarian: TENSION + narrowedParams: {count ∈ {2of3}} (R-25 — the audit flag's full-domain core_conflict REJECTED at review under R1-8):** the 2-of-3 arm can describe an early turn (RSI recovered into 50–70 + VWAP reclaimed, long MA still flat) — stabilization, which the kernel gives a positive role; the 3-of-3 arm (trend fully confirmed) is not offered. Guidance (advisory): the agent is instructed the confluence confirms an early turn and never substitutes for dislocation or the recovery thesis.
- **degen: neutral** — daily-signal confluence orthogonal to volatility.
- **guardian: neutral** — an entry-confirmation gate; protection untouched.
- **analyst: TENSION (audit item-3 class + C1-3 precedent)** — a conjunctive technical admission gate ahead of quality. Guidance (advisory): the agent is instructed quality admission remains the primary standard; the technical condition is timing discipline applied to qualified names. The 3-of-3 arm is the sharper rub.

## C2-15 · tv-01 — prioritize RSI {low}–{high} zone; deprioritize <{weak} or >{stretched}
- **momentum_chaser: TENSION + narrowedParams: {stretched ∈ [75,85]} (R-33 — stored native NOT SUSTAINED; R1-F5, resolved WITH the source domain):** `stretched` spans 65–85, and deprioritizing RSI>65 cuts ordinary live strength — the extended winners the kernel prizes. At stretched ≥75 only terminal blow-off territory is faded. An audit's rejected demotion is not a kernel element; the domain is. Guidance (advisory): the agent is instructed the band is a late-extension caution inside a strength preference.
- **contrarian: CORE_CONFLICT (stored, corroborated)** — the weak-leg deprioritization inverts washout selection at every setting.
- **degen: neutral (stored)** · **guardian: neutral (stored)**.
- **analyst: TENSION (audit flag, accepted)** — the corpus's own gloss ("seeks stocks already moving") makes an RSI band the selection reason rather than a timing filter on qualified names. Guidance (advisory): the agent is instructed quality admission precedes the momentum-zone preference; an RSI band never substitutes for the standard.

## C2-16 · tv-02 — favor growing MACD histogram; on deceleration take {action} (reduce tier / flag for swap / hold-monitor)
- **momentum_chaser: NATIVE (stored, corroborated — momentum-health monitoring on holdings is trend-following's exit-side discipline)**.
- **contrarian: CORE_CONFLICT (stored, corroborated)** — favor-growing-histogram is name-level momentum preference; the deceleration response then exits on fading strength — chase in, chase out.
- **degen: neutral (stored)** — histogram health orthogonal to vol.
- **guardian: TENSION + narrowedParams: {action ∈ {hold but monitor}} (R-22 AS AMENDED at review)** — flag-for-swap exits on sub-threshold price action (the noise refusal's named case), and *reduce tier* is an affirmative exposure change on the same sub-threshold signal — an action, not monitoring; only the monitoring arm survives for this kernel. Guidance (advisory): the agent is instructed that histogram deceleration informs observation; the protective exits alone decide action.
- **analyst: TENSION + narrowedParams: {action ∈ {reduce tier, hold but monitor}} (R-21)** — reduce-tier is retained here as a *bounded reallocation* response to a weakening setup (an opportunity-cost judgment the FI doctrine permits), while flag-for-swap remains excluded under deterioration-vs-chart. Guidance (advisory): the agent is instructed chart deceleration is never a thesis verdict.

## C2-17 · tv-03 (clash) — hold through MACD zero-line pauses when score ≥{score} (45–80), +{minutes} patience (60–240)
*technicalScore [U] — the mint pends; the cell binds the score clause to the composite the prompt actually renders and says so.*
- **momentum_chaser: NATIVE (kernel element: two-leg holding — patience through pauses in confirmed strength is the second leg verbatim)**.
- **contrarian: CORE_CONFLICT (audit flag, accepted)** — "the pullback in a confirmed uptrend is a buying opportunity" is chase doctrine stated outright; stronger than C2-4's gate, which at least only filters.
- **degen: TENSION (audit flag, accepted)** — 60–240 minutes of instructed stall-patience inverts the kernel's grace-period refusal (its named tension case: reclassifying a stalled move as opportunity). Guidance (advisory): patience is instructed to yield to the vol-decay exit discipline; **paramBounds lean (non-binding): minutes ≤ 120**.
- **guardian: neutral** — hold patience under a score floor doesn't touch protective exits, which still govern.
- **analyst: neutral** — patience on qualified holdings; no standard interaction.

## C2-18 · tv-05 — select squeezes only with MACD {direction} confirmation (bw 2–8)
- **momentum_chaser: neutral (stored)** — confirmation-gated squeeze entries; pre-strength watchlisting.
- **contrarian: TENSION + narrowedParams: {direction ∈ {turning positive}} (R-20)** — the turn arm only. Guidance (advisory): the agent is instructed to treat "turning positive" as the kernel's own stabilization evidence.
- **degen: TENSION (R-32 — stored native NOT SUSTAINED; R1-F3):** all three direction options gate on MACD state, none on realized expansion — confirmation of *direction* is not confirmation of *movement*. Guidance (advisory): the agent is instructed to require realized expansion or volume evidence before entry weight; direction confirmation alone is not movement.
- **guardian: TENSION (R-29 — stored core_conflict NOT SUSTAINED; R1-F3):** flag-not-mandate.
- **analyst: TENSION (C2-3 reasoning — compression-basis selection)**. Guidance (advisory): the agent is instructed quality admission precedes the squeeze preference; compression status never substitutes for the standard.

## C2-19 · tv-06 — target near/below lower band ({percentB} 0–0.3) as mean-reversion, {tierRule}
- **momentum_chaser: CORE_CONFLICT (stored, corroborated)** — bottom-fishing at the lower band is weakness-buying across the domain.
- **contrarian: NATIVE (stored, corroborated — kernel element: dislocation entry; the lower band is the washout localized)**; tierRule is scope, all values admitted.
- **degen: neutral (stored)** · **guardian: neutral (stored)** — reversion targeting is neither vol-hunting nor vol-refusal (the band position, unlike the squeeze, implies no expansion bet).
- **analyst: TENSION (C2-1 reasoning — reversion preference with no quality pre-filter).** Guidance (advisory): the agent is instructed quality admission precedes the reversion preference; band position never substitutes for the standard.

## C2-20 · tv-11 — prefer near-52-week-high (highProximity ≥{score} 6–12, within {pct}% 2–15)
*highProximity [U] — inventory-read pending; the cell notes the availability status per C-10.*
- **momentum_chaser: NATIVE (stored, corroborated — proximity-to-highs is strength-preference in the kernel's own evidence ladder)**.
- **contrarian: CORE_CONFLICT (stored, corroborated)** — preferring names at their highs is the inverse of the universe.
- **degen: neutral (stored)** · **guardian: neutral (stored)**.
- **analyst: TENSION (audit flag, accepted)** — a pure price-level momentum criterion promoted to selection reason, justified in the corpus by the buyers it attracts, not the business. Guidance (advisory): the agent is instructed quality admission precedes the proximity preference; price-level momentum never substitutes for the standard.

## C2-21 · tv-13 (clash) — prioritize bench volume-spike names ({mult} 1.5–3), assign minimum {tier} (Star/Core)
- **momentum_chaser: NATIVE (stored; audit refutation is the corroboration — requires positive price action alongside the spike; reorders inside priority 1, lets nothing outrank strength)**.
- **contrarian: CORE_CONFLICT (stored, corroborated)** — spike-chasing the leading movers.
- **degen: neutral (stored)** — spikes correlate with vol but the mechanism is momentum-promotion; below native per the C1-6 standard.
- **guardian: CORE_CONFLICT (audit flag, accepted — stored neutral NOT SUSTAINED)** — the template's "overrides other technical signals" plus a Star-minimum lets tape outrank the quality and volatility layers and set the book's core; override language is the CP conflict rule's named trigger. Full domain (the Core arm still installs the override).
- **analyst: CORE_CONFLICT (audit flag, accepted)** — same override mechanism against the FI ordering: tape sets the core with zero quality input. *(Symmetry per audit item 8: two CCs, one mechanism, two kernels' distinct clauses — cited separately.)*

---

## Batch findings
1. **105 cells (V1.1, computed from the reviewer's verified V1.0 recount + the amendment delta): 16 native · 11 core_conflict · 32 tension — **10 with binding narrowedParams (exact inline bounds)** and **3 with non-binding paramBounds leans** (t-11/analyst floor ≤8 · t-15/analyst score ≥70 · tv-03/degen minutes ≤120) · 46 neutral.** The V1.0 tally was hand-counted and wrong (the recurring lesson, again); this one is arithmetic on a verified base. Audit-refutation-as-corroboration is DEMOTED as a standard: a rejected demotion is not a kernel element (tv-01 and t-15 fell exactly there); tv-13/TF survives because its corroboration is the mechanism, not the refutation.
2. **Every audit flag on this family is dispositioned, in three honest categories:** ACCEPTED AS FLAGGED (the analyst-column set, tv-03/contrarian CC, tv-13 guardian+analyst CCs, the rsi-overbought gate flags, the two forward softenings R-15/R-16) · AMENDED BEYOND THE FLAG (tv-02/guardian — R-22 narrowed harder at closure than the flag asked) · **OVERTURNED AT CLOSURE** (t-16/contrarian — the audit's full-domain core_conflict rejected under R1-8, replaced by tension + {2of3}, R-25; and **R-31, the contested case: the audit's own refutation table cleared t-15/degen native, the batch review re-raised the demotion and prevailed** — both positions preserved in the mint). Nineteen mints across the batch (R-15…R-33, R-22 amended) — every stored-verdict override carries a mint, never silence.
3. **The squeeze family re-resolves under one honest mechanism line** (R1-F3): compression is not realized movement (degen: tension ×4, R-16/R-30/R-31/R-32) and a flag is not a mandate (guardian: tension ×4, R-26…R-29) — the V1.0 grid applied R-16's logic selectively and graded guardian on adjacency; both errors corrected rule-by-rule, verdicts now per-mechanism rather than per-family.
4. **The analyst column carries this batch's weight:** 13 tensions from two doctrine clauses (gate→trigger order; deterioration-vs-chart) — exactly what the audit's "thinnest conflict column" finding predicted the kernels would say once someone asked.
5. Gate math: **45 + 105 = 150 / 475 authorable** (Diversifier's technical rows join its held column).

## Review directives (in lieu of a separate package)
CLOSURE ROUND: verify R1 findings 1–7 closed as prescribed — the MA/confluence contrarian cells narrowed per your smallest fixes (R-23/R-24/R-25), the squeeze family re-resolved rule-by-rule (R-26…R-32, with R-31's contest recorded), R-22 amended and separated from R-21 with the reduce-tier rationale corrected, tv-01/mc resolved WITH its source domain (R-33), every narrowed cell carrying exact inline bounds, advisory wording swept, and the tally recomputed from your verified base. ADJUDICATION_RULINGS (V1.4) is attached this round for the bounds cross-check. Verdict: BATCH ACCEPTED (150/475) or the residual.
