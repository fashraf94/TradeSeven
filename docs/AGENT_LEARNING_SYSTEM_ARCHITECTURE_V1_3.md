# Agent Learning System — Architecture V1.3 (FROZEN)
**Date:** July 11, 2026
**Status:** ARCHITECTURE FROZEN. Supersedes V1.0–V1.2 in full. Survived three adversarial review rounds (R1: 11B/10S/1C · R2: 5B/6S · R3: 1B + 6 refinements). All flags dispositioned (§16–18). **No further broad architecture rounds** — remaining risk lives in the Detector Appendix, which is the next (and narrowly-scoped) adversarial target.
**Scope:** How agents learn from gameplay and conversation, how lessons become behavior through consented trials, how the platform measures what a learned control changed, and how hard authoring works as the promotion ceremony.
**Next:** Detector Appendix (first build-spec deliverable, Fable-reviewed) → L1 build spec → CC.
---
## 0. Founder rulings (cumulative)
**Standing (V1.1):**
1. **Fast-track-to-trial.** Taught lessons fast-track to a trial proposal, never an evidence tier. Authority ≠ evidence.
2. **Trial-first.** Default consent action is a bounded, reversible trial. Persistent equip unlocks only after a completed trial with no harm detected.
3. **Tier naming** is plain, descriptive, always paired with sample counts. (Third tier renamed in V1.3 ruling #7.)
4. **L1 scope growth accepted** — measurement infrastructure lives in L1's dark phase.
**V1.2:**
5. **Cron budget.** 36/40 slots used; learning may add ≤2 jobs; prefer piggybacking the generation-boundary aggregator.
6. **Narration scarcity.** Unsolicited live-voice Watching narration ≤ one new mention per three battles, no-repeat-without-new-evidence retained. Evolution feed + Film Room carry visibility generosity.
**V1.3 (new):**
7. **Third tier renamed `Confirmed in Trial` → `Confirmed in Evaluation`.** Confirming evidence largely accrues after the bounded trial ends (during persistent-equipped use), so "in Trial" overclaimed. Same honesty intent as ruling #3; describes the evidence process without implying a specific product state.
8. **Scope = gated-B.** Modulating and suppressive detectors are eligible for the launch family. They ship forming **descriptive** lessons at launch (no shadow required); their **performance** claims are gated per-detector on a numerical shadow-quality bar (§6.5). Additive-only launch (option A) was rejected: in a slot-constrained game almost nothing is purely additive, collapsing A to one thin low-frequency detector and excluding the interventions that read as genuine learning. Gated-B ships substantial *and* honest, and does not block any detector on shadow — only its performance claims wait.
---
## 1. Diagnosis — why the old learning never fit
The previous Film Room learning generated **free-form behavioral text** into a system with **no typed vocabulary to receive it**: unversioned, unclassified, ungated prose — no identity gate, no conflict model, no provenance, no measurement, no expiry.
That constraint is gone. The customization arc built the receiving structure:
| Existing structure | What it gives learning |
|---|---|
| 143-template rule library + WS1 per-archetype compatibility map | Typed behavior vocabulary + identity gate on every equip |
| 46-entry lean menu (versioned, conflict-grouped, core-reinforcing) | Identity-safe flavor adjustments |
| Tempo dial (banded, version-bound) | A bounded aggression axis |
| Watchlist equip (attention-not-obligation) | A safe attention target (deferred as a learning target — §7.4) |
| Directive gate + epoch semantics | The no-resurrection precedent |
| settingsRev, receipts provenance, generation-boundary aggregator | Attribution labels + an outcome-reading loop |
| Gap Intelligence design (queued) | Destination for repeated compilation misses |
| **Paper-trading simulator (EODHD fills, deterministic scoring)** | **A native counterfactual engine: factual and shadow branches run the identical fill/scoring path (§6)** |
These bound *authority*. The epistemic layer is new (§§4–6); its trust surfaces are named in §10.
## 2. The core principle (final)
> **Learning proposes; the control system disposes; the trial bounds exposure; the evidence ledger and shadow receipts measure — and at most one attribution window is ever open per agent.**
Four separated jobs plus one exclusivity invariant. Both the trial and the measurement layer exist because a trial is an **authority primitive, not a measurement primitive** — it hosts measurement windows, it does not produce verdicts, because nothing without a comparator produces verdicts.
Standing consequences:
1. A learned lesson never mints free-form behavioral text. It compiles into existing typed controls through the same doors a manual choice uses (WS1, conflict groups, cap of 2, settingsRev, battle-locks, receipts). Zero special equip authority.
2. `core_conflict` controls are never proposed; the agent narrates the tension. WS1 is the identity backstop at equip time.
3. Learning can never author hard; learning-sourced controls need Confirmed in Evaluation before hard promotion (§12).
4. Non-compiling lessons become observation-only knowledge or curated gap files — never invented templates.
5. Proposal generation is a governed persuasion surface (§10 T6): claims bounded by evidence class, sample-qualified, generated only from typed enum fields (§10 T12).
6. **One open attribution window per agent** (§5.9): trials *and* post-trial confirmation windows count. This is what keeps every evidence atom unambiguously attributable to a single learned treatment.
## 3. The lesson lifecycle
```
observe/teach → LESSON (dossier, private; watching)
   → discovery evidence accumulates (typed atoms, §4)
   → clears Ready-to-Test bar → FREEZE (full evaluationSpec, §4.6)
   → EMBARGO (detector max outcome horizon; discovery windows close, §4.7)
   → TRIAL PROPOSAL (maturity + authority labels, full config diff)
        ↳ requires the agent's single attribution window to be free (§5.9)
   → user consents → TRIAL (bounded, auto-expiring, inverse-patch reversible, §5)
   → outcome: "Early trial completed — no configured harm detected" | harm detected |
     cancelled | expired-insufficient-opportunities            ← never "passed" (§5.6)
   → no-harm completion → persistent equip unlocked (user's choice; no success framing)
        ↳ confirmation window stays OPEN and occupies the attribution slot
   → confirmation evidence accrues (post-embargo, clean-treatment battles only)
   → Confirmed in Evaluation when the full bar is met (§4.5)
        ↳ OR user ends measurement early → control becomes ordinary config, slot frees
   → Confirmed → eligible for hard-promotion ceremony (§12)
Parallel exits: decline (cooldown + tombstone) · contradicting receipts demote ·
staleness fades · archetype change partitions · manual param edit forks (§9.4)
```
### 3.1 Two input channels
**Taught (chat) — fast-track to trial.**
1. Compile → WS1 classify. `core_conflict` → honest archetype pushback; no proposal.
2. **Echo-back confirmation:** "You asked me to avoid chasing gap-ups. This maps to `tech-avoid-gap-chase` at params X — it reduces my gap-entry participation and replaces nothing equipped. Correct?" Compiler misreads die here. **The confirmed echo-back freezes the compilation + evaluationSpec** (§4.6); embargo = 0 when no historical observations are imported, normal embargo if prior observations are attached (§5.10).
3. Card labeled **User-requested · Untested** — an authority label, never a tier.
4. Default and only learning-surface action: **trial**. Persistent-without-testing = the manual Forge path, carrying zero learned framing.
5. **Sanity layer:** identity-compatible but strategically hazardous requests get a plain-language caution + second confirmation. Rung-3 platform bounds are not user-overridable.
6. **Suppressive taught lessons trial as compliance + harm screens:** "you traded 60% fewer gap setups; no configured harm threshold crossed" — descriptive, which is what the user asked. Performance claims follow the §6.5 shadow gate.
7. Doesn't compile → agent states what it can do instead; lesson stored observation-only; repeated deduplicated misses file a gap.
**Observed (gameplay) — evidence bar.** Sources: Film Room reviews, receipts/trade outcomes, epoch events, veto/override patterns (successor input model for Vision/Dossier Sprint 2). Observations accrete as typed atoms; a lesson proposes only after Ready-to-Test + freeze + embargo.
**The observed channel is an enumerated detector family — 4 detectors at launch** (prove the machinery before widening). Each detector is a versioned contract:
- `interventionClass: additive | modulating | suppressive | attention` (§3.3) — **new, load-bearing**
- one fixed compilation target
- one fixed parameter set (or a tiny reviewed menu)
- one outcome horizon
- one eligible-opportunity definition (trigger universe, denominator, cluster rule, exclusions)
- one regime policy
- a hard cap on simultaneous per-agent hypotheses
- a declared measurement path (§3.3) proving the detector is either additive, genuinely measurable modulation, or shadow-gated suppression
**V1 launch family (gated-B):** additive and modulating/suppressive detectors are all eligible. Suppressive/modulating detectors ship forming descriptive lessons at launch; performance claims gate on §6.5. **Watchlist (`attention`) detectors remain deferred** until the exposure-origin evaluation model is settled (post-V1). Candidate family — to be pinned and classified in the Detector Appendix:
| Candidate | Target | Likely interventionClass | Launch claim status |
|---|---|---|---|
| setup-freshness affinity | lean | modulating | descriptive at launch; performance via §6.5 or within-taken comparison if the Appendix proves it |
| churn-in-chop | tempo `measured` | suppressive | descriptive at launch; performance shadow-gated |
| hold-duration pattern | time-exit params | suppressive (forces/accelerates exits) | descriptive at launch; performance shadow-gated |
| entry-confirmation | lean | suppressive (prevents entries) | descriptive at launch; performance shadow-gated |
Adding or reclassifying a detector is a reviewed, versioned event.
### 3.2 The dossier
Per-agent store (`agentLessons`), private, **server-authoritative** (§11.1). Schema:
```
{ lessonId, agentId, archetypeAtCreation,
  fingerprint,                      // target+params+scope+condition+archetype (§9.5)
  hypothesis: { text, version },
  compilation: { kind: rule|lean|dial|observation_only|gap, ref, params,
                 interventionClass, version },
  detectorId | taughtRef,
  authority: observed | user_requested,
  versions: { detectorVersion, evaluationSpecVersion, ruleLibraryVersion,
              archetypeVersion, regimeModelVersion },
  frozen: null | evaluationSpec,                            // §4.6
  evidence: [atomId...],            // immutable, separate store
  maturity: { tier, independentClusters, opportunities, battles,
              regimeBreakdown, consistency, effectSize,
              confidenceModelVersion, lastUpdated },
  interestState: { declines, cooldownUntil, unequips,
                   userReportedConcerns, muted },
  attributionWindow: null | { status: trial|confirmation, openedAt, trialId? },  // §5.9
  status: watching | proposed | in_trial | trial_completed_no_harm | equipped |
          declined | retired | tombstoned,
  trials: [trialId...] }
```
**Bounds:** 32 active lessons/agent · 128 retired/tombstoned summaries · 128 raw atoms per active lesson · 2,048 raw atoms/agent · atoms >180 days compact into immutable aggregates. Never discarded: proposal snapshots, trial outcomes, hard-promotion evidence, tombstones.
**Shadow-receipt bounds (new, §6.6):** pinned separately because decision-site capture can far outpace lesson-atom generation.
**Auditability:** atoms immutable; maturity engine versioned; hypothesis/compilation versioned independently; every proposal stores the exact user-facing snapshot; threshold changes are versioned ledgered events.
### 3.3 interventionClass — classify by effect, not target type (new)
The target being a lean, dial, or param does **not** make an intervention additive. Behavior determines the measurement problem. Every detector declares:
- **additive** — adds behavior/attention without blocking, delaying, shortening exits, or displacing an otherwise-valid trade. Directly measurable.
- **modulating** — reweights selection without hard blocking. Measurable directly only if the Appendix proves a clean within-taken comparator exists; otherwise shadow-gated.
- **suppressive** — blocks, delays, shortens/forces an exit, or changes whether an otherwise-valid trade occurs. **Performance claims require mature per-detector shadow coverage** (§6.5).
- **attention** — creates exposure (watchlist). Deferred in V1 (needs the exposure-origin evaluation model).
**Suppressive is defined broadly:** any intervention that blocks, delays, shortens/forces exits, or changes whether a valid trade occurs. The Detector Appendix must prove each launch detector's class and its measurement path before build.
## 4. The evidence model
### 4.1 Authority ≠ evidence
`user_requested` vs `observed` governs speed-to-proposal and framing. Evidence governs maturity and all performance language. Repeated teaching never raises empirical maturity. The UI never renders intent in evidence vocabulary.
### 4.2 Typed evidence atoms
```
{ atomId, lessonId,
  partition: discovery | confirmation,
  opportunityKey,        // dedupe: battleId+symbol+setupInstance
  clusterKey,            // dependence: detector-specific (§4.4)
  eligibleCount,         // denominator in scope
  battleId | chatRef, regime, symbol,
  triggerStatus: triggered | eligible_untriggered,
  opportunityOrigin: organic | learned_watchlist | learned_attention,     // §4.3
  treatmentAssignment: baseline | active_trial | persistent_learned,      // §4.3
  direction: supports | contradicts,
  effectSize, outcomeWindow, comparator,
  shadowRef: null | shadowReceiptId,                                      // §6
  dataQuality, at }      // immutable
```
The **one-attribution-window invariant (§5.9) is what keeps `treatmentAssignment` a single field valid:** because only one learned control is ever under measurement at a time, an atom is never simultaneously `active_trial` for one control and `persistent_learned` for another-under-measurement. A non-measured persistent control is simply part of `baseline`.
### 4.3 Origin vs treatment
- **opportunityOrigin** — did learning create this opportunity's visibility? Self-created (`learned_watchlist`, `learned_attention`) opportunities cannot confirm the lesson that created them.
- **treatmentAssignment** — was the learned control active when this **organic** opportunity was evaluated? `active_trial`/`persistent_learned` atoms on organic opportunities are the confirmation evidence and are **never** excluded for treatment alone.
Watchlist lessons need a separate evaluation model — deferred with their detectors.
### 4.4 Independence: clusters, not just dedupe
`opportunityKey` prevents double-counting; `clusterKey` handles dependence (session, macro-event window, earnings event, sector event, battle-market episode — detector-specific). **Maturity computes effective sample size in independent clusters.**
### 4.5 Maturity tiers
| Tier | Bar (dark-calibration defaults; tuned on empirical false-positive rates, never engagement) |
|---|---|
| **Watching** | ≥2 independent supporting clusters across ≥2 battles. No recommendation, no equip affordance. |
| **Ready to Test** | ≥8 independent opportunities in ≥5 clusters across ≥5 battles · ≥70% directional consistency · pinned minimum practical effect · no harm-bound breach in discovery data. Triggers freeze. Means "qualifies a reversible trial," never "this works." |
| **Confirmed in Evaluation** | ≥20 independent confirmatory opportunities in ≥12 clusters across ≥10 battles, all post-embargo and independent of discovery · primary effect clears its practical threshold · harm bounds hold · **regime replication: for global lessons, ≥2 regime classes with ≥6 opportunities each and no single regime >70% of confirmatory weight.** "Global" means replicated, not present. |
Regime-scoped lessons (§4.8) confirm within scope and stay scoped. **Confirming evidence may accrue during the bounded trial and during subsequent persistent-equipped use** — hence "in Evaluation," not "in Trial."
### 4.6 The frozen evaluationSpec (complete contract)
Set at Ready-to-Test (observed) or at echo-back confirmation (taught); versioned; no downstream component may reinterpret it. Pins: target · params · scope/condition · eligible-opportunity definition · comparator · baseline window · primary metric **with direction** · aggregation method · minimum practical effect · harm bounds · outcome horizon · cluster method · missing-data treatment · censoring rules · evaluation window.
### 4.7 Freeze → embargo → confirmation, and the null harness
**Confirmation begins only after an embargo equal to the detector's maximum outcome horizon**, once all discovery outcome windows close. L1 dark data splits into a **calibration period** (thresholds tuned here) and an **untouched held-out evaluation period** (false-positive rates measured here, never tuned on).
**The empirical null harness (hardened) requires:**
- several **predeclared** shift distances beyond the max detector horizon;
- **both positive and negative** shifts;
- **regime-preserving block shifts** where autocorrelation/persistent regimes could survive a naive shift;
- a **sham-detector set**;
- a held-out evaluation period untouched by tuning;
- a **false-discovery report** showing how often each detector reaches Watching, Ready to Test, and false Confirmation under null data.
**Exit criterion is numerical, not descriptive:** L1 ships only when each detector's false-confirmation rate under null data sits below a **pinned ceiling** (value set in the L1 build spec). "Characterized" alone is insufficient — a characterized-but-unacceptable rate must not ship.
### 4.8 Regime scoping
Single-regime evidence → regime-scoped lesson → compiles only into a control carrying the same condition; if the vocabulary can't express it, observation-only or (repeated demand) gap. Claims never silently broaden. Global labels require §4.5 replication.
### 4.9 Pinned success objective
One primary metric from a small enumerated set + fixed harm bounds (drawdown, volatility, turnover, concentration, identity-integrity signal). Any material hard-harm breach fails the lesson regardless of the primary metric.
## 5. The trial primitive
```
{ trialId, lessonId, agentId,
  control: { kind, ref, params, interventionClass },
  scope: { minTriggeredOpportunities: 8, minEligibleOpportunities: 12,
           minBattles: 6, maxBattles: 20, maxCalendarDays: 30 },   // per-detector tunable
  inversePatch: { fields, expectedValues, settingsRevAtStart },    // §5.4
  consent: { at, proposalSnapshot },
  status: active | completed_no_harm | harm_detected | cancelled |
          expired_insufficient_opportunities,
  startedAt, endsAt, outcome }
```
1. **Consent card = the whole transaction:** control, params, WS1 classification, everything replaced/altered, expected trigger frequency, scope, authority + evidence labels. Consent authorizes the diff.
2. **Normal doors** + provenance `learned` + lessonId + trialId. The trial adds expiry + reversibility, no extra authority.
3. **Scope = opportunities, not battles.** Ends at minimum triggered + eligible opportunities or maximum duration. Max duration short of minimum opportunities → `expired_insufficient_opportunities` (a data outcome, not a verdict).
4. **Reversal = inverse patch, never snapshot restore.** Guarded by settingsRev + expected-current-values. User changed a **trial-owned** field → trial cancels, user wins. Unrelated fields → untouched. Full-config restore over a newer revision never happens.
5. **Rollback lands at the next battle boundary** (Invariant S — battle-locked fields can't change in-flight). Mid-battle cancel is recorded immediately; config reversal lands when the lock permits. UI copy says so.
6. **Outcome language:** favorable = **"Early trial completed — no configured harm detected"** (§5.6). Never passed/graduated/successful; lesson stays unconfirmed; continuation is uncoerced.
7. **Exclusivity + exclude-and-extend:** trial-owned change → cancel (user wins); unrelated change → exclude that battle from confirmation and extend to the clean sample or max duration.
8. **Not a directive** — separate typed object; no-resurrection via tombstones (§9.5).
### 5.6 "No configured harm detected" is an absolute screen
The early-trial harm check is an **absolute** screen: did any configured platform/harm-bound threshold get crossed during the observed triggers? It is **not** a comparative or statistical claim, because the early window has no valid comparator.
- **Correct:** "No configured harm threshold was crossed during 9 triggers; turnover −18%."
- **Prohibited:** "The trial did not harm performance." (implies attribution the window can't support.)
### 5.9 One open attribution window per agent (R3 blocker — architecture invariant)
**An agent has at most one open learning-attribution window at any time — counting both bounded trials and post-trial confirmation periods.**
A completed trial whose control stays equipped keeps its **confirmation window open**, and that window occupies the single slot. While it's open, **no new learning trial may start.** The user has three moves:
1. **Continue measuring** the first control (window stays open, slot occupied).
2. **End measurement, keep the control** as an ordinary user choice → window closes, control drops into `baseline`, slot frees. Confirmation freezes at its current tier; the control remains equipped as plain config.
3. **Remove the control** → window closes, slot frees.
Consequences: no battle is ever affected by two learned controls *under measurement*; the singular `treatmentAssignment` stays valid; and only one shadow-generating control is ever measured at once, simplifying shadow attribution. Mixed-treatment evaluation (`activeTreatmentSet`, interaction hypotheses, explicit exclusion rules) is explicitly **post-V1**.
### 5.10 Taught-lesson freeze path
Taught lessons skip discovery but still need a frozen evaluationSpec. Rule: **the confirmed echo-back freezes compilation + evaluationSpec.** Embargo = 0 when no historical observations are imported; if prior observations are attached to the taught lesson, the normal outcome-horizon embargo applies before their evidence counts.
## 6. Shadow receipts — the measurement layer
**Platform advantage:** FantasyTrades is paper. Factual and counterfactual run the **same deterministic simulator** — same fills, same scoring path.
1. **Shadow capture (L1):** when a learned control blocks or modifies a would-be action, log a shadow receipt *before* the gate applies: the action the agent would have taken, price + timestamp, planned sizing, the frozen deterministic exit policy, and the intervention reason. A logging point at the decision site.
2. **Shadow outcome computation (L2):** a generation-boundary batch (piggybacking the aggregator cron, ruling #5) replays each receipt through the standard fill/scoring path under the frozen exit policy. Shadow atoms link via `shadowRef`.
3. **Wording (tightened):** a shadow outcome is **a deterministic simulated counterfactual, scored through the same fill and scoring path as factual trades.** Not observed truth — a simulated counterfactual that happens to share the engine.
4. **Shadow eligibility (pinned):** a receipt is scorable only if the entry has a complete timestamp, price, size, and executable action, and the exit policy is deterministic and frozen at capture with **no dependence on later LLM discretion.** Missing prices, halts, delistings, or incomplete exit instructions produce **`unscorable`** — never a silent zero and never a silent drop (either would bias the distribution). Unscorable rate is itself a data-quality metric feeding §6.5.
5. **Per-detector shadow-quality gate (the gated-B mechanism):** a suppressive/modulating detector's **performance** claims unlock only when its shadow coverage clears a numerical bar for that detector's opportunity type — pinned in the Detector Appendix, minimally: shadow **coverage %** (interventions with a captured receipt), **scorable %** (receipts that produced a scorable outcome), and a **fidelity check** (shadow branch reconstructs the intended action faithfully). Below the gate, the detector still ships and forms **descriptive** lessons ("you traded fewer gap setups"); it simply cannot claim performance ("and it helped"). Descriptive value is never blocked on shadow.
6. **Shadow storage bounds (pinned in L1 build spec):** max pending shadows/agent · max age before an unresolved shadow expires · max storage/battle · retention for scored shadows · handling of shadows tied to tombstoned lessons.
7. **Permanent scope limit:** shadow receipts are **trade-level** truth. A blocked trade changes cash and slots, so long-horizon portfolio counterfactuals path-diverge. Claims stay scoped to the decision ("the 11 avoided gap entries would have scored −X on average"), never the season. Disclosed wherever shadow numbers surface.
## 7. Compilation targets (closed set)
1. **Rule template + params** — primary; WS1-classified pre-surface; `core_conflict` narrated, never proposed.
2. **Lean (menu entry)** — conflict groups + cap at consent.
3. **Dial position** — band positions only.
4. **Watchlist candidate — deferred as a learning target** (exposure-origin model unsettled). Users add manually as always.
5. **Gap file** — only after repeated deduplicated misses per fingerprint; rate-limited; typed summaries (never raw chat); aggregated.
6. **Observation-only lesson** — inert typed knowledge (regime dependencies, rule interactions, opportunity scarcity, data-quality issues, "helped returns / worsened drawdown," style-vs-results). Film Room + dossier visible; can never propose, equip, or alter decisions.
7. **Battle-scoped directive — excluded.** The user's authored channel. Revisit post-launch only with evidence.
## 8. Proposals & narration
### 8.1 Proposal discipline
Cards carry maturity + authority labels, full sample counts with denominators + cluster counts, discovery/confirmation split, effect + harm readouts, contradicting observations, and the complete config diff. No popularity framing. Proposal budget 1–2 simultaneous (interacts with the §5.9 single-window invariant; build spec pins the number, and note the window invariant already caps *trials* at one).
### 8.2 Narration rules
1. Watching mentions surface **post-battle only**.
2. **≤ one new Watching narration per three battles** (ruling #6).
3. No repetition without new independent evidence.
4. Observation language, never improvement language.
5. No equip affordance below Ready to Test.
6. Visibility control quiet / standard / detailed (default standard); per-lesson mute.
7. Film Room + Evolution feed are always-generous; live voice is scarce residue.
8. **Voice consumes a typed lesson-summary contract only** (§10 T12): facts + enums, mirroring Correlation Intelligence. Claim language template-generated from enums; Gemma never free-writes evidence.
## 9. Adoption, measurement, retirement
### 9.1 Adoption
Consent → trial → completed-no-harm → persistent equip offered (no success framing). Provenance `learned` + lessonId flows to receipts and the aggregator. The confirmation window opens and occupies the §5.9 slot.
### 9.2 Preference ≠ evidence
UI actions touch interest state only. Decline → cooldown. Unequip → optional reason tag; a performance-tagged reason stores as **`user_reported_performance_concern`** — affects resurfacing/interest state, displayed as the user's stated view, and **never writes an empirical atom.** Only receipt-derived outcomes move empirical maturity.
### 9.3 Archetype boundaries
Archetype change revalidates the dossier; incompatible lessons retire with a record. Surviving: taught intent carries; performance evidence partitions at the boundary (retained for audit, excluded from tiers). Default partition; any transfer rule predefined per detector.
### 9.4 Manual edits break attribution
Any user change to a learned control's target, params, scope, or condition: ends the old attribution window (frees the §5.9 slot) · mints a new fingerprint · resets confirmation · **drops Confirmed-in-Evaluation hard eligibility for the modified version.** Ships as a **param-edit transaction** (full diff), not a synthetic unequip/re-equip. The modified control is a new intervention.
### 9.5 Retirement, decay, no-resurrection
Contradicting confirmation evidence demotes. Stale lessons fade without deletion. Declined/retired lessons leave tombstones keyed by canonical fingerprint; reworded duplicates inherit the cooldown. Reactivation only via material new evidence + elapsed cooldown.
## 10. Trust surfaces & threat model
| # | Surface | Defense |
|---|---|---|
| T1 | Compiler fidelity | Echo-back on taught; fixed detector→target bindings; independent hypothesis/compilation versioning |
| T2 | Evidence integrity | Immutable typed atoms; dedupe; denominators; dataQuality; server-authoritative writes (T13) |
| T3 | Selection bias / winner's curse | Discovery/confirmation partition + freeze + embargo (§4.7) |
| T4 | Multiplicity | 4-detector fixed contracts + per-agent hypothesis caps + single-window invariant + bars tuned on an empirical null with a numerical ceiling (§4.7) |
| T5 | Attribution over-claiming | Origin/treatment split; single attribution window (§5.9); exclude-and-extend; regime scoping; trial-scoped language; shadow receipts for suppression (§6); trade-level scope disclosure |
| T6 | Persuasive framing | Narration rules; observation language; no-equip-below-Ready; full-diff consent; authority label always visible; no success language on trial outcomes |
| T7 | Self-confirming exposure | opportunityOrigin exclusion (§4.3); watchlist targets deferred |
| T8 | Preference-as-truth | Interest state vs evidence; `user_reported_performance_concern` never writes atoms |
| T9 | Gap spam / adversarial input | Rate limits; typed summaries; dedupe; repeated-demand threshold |
| T10 | Stale/zombie proposals | Fingerprints + tombstones + reactivation rules |
| T11 | Calibration drift | confidenceModelVersion stamped; threshold changes ledgered; calibration/evaluation split; numerical null ceiling |
| T12 | Voice confabulation | Typed lesson-summary contract (facts + enums); template-generated claim language; Gemma never free-writes evidence |
| T13 | Client-side evidence forgery (competitive integrity) | Server-authoritative lesson/atom/maturity/trial/shadow writes; `firestore.rules` denies client writes to `agentLessons`, atoms, trials, shadow store. Confirmed gates hard promotion, and hard rules play in tournaments — evidence is a competitive-integrity surface |
Residual honest statement: consent limits authority; these defenses limit but cannot eliminate epistemic error. The designed worst case is a bounded, reversible, honestly-labeled early trial — never a persistent silent behavior change, never a manufactured verdict.
## 11. Infrastructure constraints (bind all build specs)
1. **Server-authoritative evidence (T13).** Atom writes, maturity computation, trial state transitions, shadow receipts — serverless-side only. L1 spec pins the write path and `firestore.rules` denials before any writer ships.
2. **Cron budget (ruling #5).** ≤2 new jobs. Order: (a) piggyback evidence + maturity + shadow-outcome batches on the aggregator job; (b) one consolidated learning cron if (a) overloads; (c) the second slot only with demonstrated need.
3. **Fence discipline.** Shadow capture instruments the decision path adjacent to fenced files (decide.js, agentSwapExecution.js). Any hook touching a fenced file ships via fence-authorization, bundled, split PRs by concern. Discovery locates the least-invasive capture point (ideal: the non-fenced clamp-layer choke point).
4. **All flags dark:** L1 fully dark; L2/L3 surfaces behind own flags with the four-category release classification.
## 12. Hard authoring — the promotion ceremony
1. Only users promote, in the dark `FORGE_HARDSOFT_AUTHORING_ENABLED` surface.
2. **Learning-sourced controls require Confirmed in Evaluation** (full §4.5 bar) before promotion eligibility. Manual param edits drop eligibility (§9.4).
3. Direct user-authored hard remains a separate path with zero learned-confidence language: "you are ordering this."
4. The ceremony shows the full case: rule, params, WS1 classification, and for learned controls the complete evidence trail (clusters, opportunities/denominators, regimes, effect, harm metrics) plus what hard means.
5. Gates already armed: WS1 hard-promote block shipped/verified; category-hard vs override live; sector-slot blocked-promotion copy precedent.
6. Ledgered co-ship prerequisites: WS1 enforce + rules workbench; L2 Firestore hard-override freeze lifted same PR; `firestore.rules` field hardening; leanOverrides voice copy.
## 13. Supersedes / integrates
- **Supersedes:** V1.0–V1.2 of this document; the old Film-Room free-form learned-directive generation, fully.
- **Successor input model for:** Vision Program / Dossier Sprint 2.
- **Feeds:** Gap Intelligence (curated misses), Evolution feed, Film Room (lesson review, trial readouts, observation-only knowledge, shadow-derived readouts once gated), voice layer (via summary contract).
- **Consumes:** receipts + aggregator, WS1 map, lean menu + conflict groups, tempo bands, the simulator's fill/scoring path.
## 14. Phasing (final, gated-B)
- **L1 — Dossier + observation + measurement + shadow capture (fully dark).** Lesson store (bounds, fingerprints, versions, tombstones, attributionWindow); typed atoms (partitions, keys, origin/treatment, denominators); the 4-detector family with complete per-detector contracts incl. `interventionClass` and declared measurement path (**Detector Appendix = first deliverable, Fable-reviewed**); versioned maturity engine with §4.5 bars; embargo logic; calibration/held-out split + hardened null harness with numerical exit ceiling; observation-only class; archetype partitioning; **shadow capture at the decision site**; server-authoritative write path + firestore.rules denials. **Exit:** lessons form sensibly on real gameplay AND each detector's false-confirmation rate under null is below its pinned ceiling.
- **L2 — Taught channel + trials + proposals + shadow outcomes + descriptive suppressive lessons.** Echo-back compilation (+ taught freeze path) + sanity layer; trial primitive (inverse patch, opportunity scope, exclude-and-extend, battle-boundary rollback, absolute-harm outcome language, single-window enforcement); proposal cards; decline/cooldown; `user_reported_performance_concern`; narration §8.2 + visibility control; lesson-summary contract for voice; **shadow outcome batch on the aggregator boundary.** Suppressive/modulating detectors ship here forming **descriptive** lessons. Ships only after L1 exit.
- **L3 — Graduation, reporting, promotion, and per-detector performance unlock.** Persistent-equip flow; Film Room trial + measurement readouts; Confirmed-in-Evaluation surfacing; hard-promotion ceremony with the §12 gate. **Shadow-quality characterization → per-detector §6.5 gate opens → suppressive/modulating detectors' performance claims unlock** as each clears its bar (not a single blanket unlock). Watchlist/attention detectors and mixed-treatment evaluation remain post-V1.
Sequencing: L1 starts after Release 3 (equip UI) is specced; Release 3 ships first.
## 15. Round-1 & Round-2 disposition record
Carried intact from V1.2 §15–16 (all R1 11B/10S/1C and R2 5B/6S dispositioned). Section references updated to V1.3 numbering. R2-B1 "trial passed overclaims" is further tightened by §5.6's absolute-screen definition; R2-B2 suppression handling is superseded by the gated-B model (§0 ruling #8, §3.3, §6.5) which upgrades suppressive detectors from "excluded until L3" to "launch descriptive, performance shadow-gated per detector."
## 16. Round-3 disposition table
**Blocker**
| # | Flag | Disposition | Where |
|---|---|---|---|
| R3-B1 | Overlapping confirmation windows | **ADOPTED** — one open attribution window per agent (trials + confirmation); new trial blocked while another control accrues confirmation; escape hatch (continue / end-and-keep / remove); rescues singular treatmentAssignment; simplifies shadow attribution; mixed-treatment deferred post-V1 | §2.6, §5.9, §4.2 |
**Refinements**
| # | Flag | Disposition | Where |
|---|---|---|---|
| R3-1 | Rename "Confirmed in Trial" | **ADOPTED** — `Confirmed in Evaluation` (ruling #7) | §0, §4.5 |
| R3-2 | Classify by effect, not target | **ADOPTED** — `interventionClass` field, broad suppressive definition, per-detector measurement-path proof burden | §3.3, detector contract |
| R3-3 | Tighten shadow truth claim | **ADOPTED** — "deterministic simulated counterfactual"; `unscorable` state; eligibility conditions | §6.3–6.4 |
| R3-4 | Taught-lesson freeze path | **ADOPTED** — echo-back freezes evaluationSpec; embargo 0 unless prior observations attached | §5.10 |
| R3-5 | "No harm" as absolute screen | **ADOPTED** — configured-guardrail breach + descriptive deltas only; comparative language prohibited | §5.6 |
| R3-6 | Strengthen null harness | **ADOPTED** — multiple predeclared ± shifts, regime-preserving block shifts, sham detectors, held-out period, FDR report, **numerical exit ceiling** | §4.7 |
| R3-7 | Shadow storage bounds | **ADOPTED** — pending cap, expiry, per-battle cap, retention, tombstone handling (numbers in L1 spec) | §6.6 |
**Scope decision (R3 §15 fork):** **gated-B adopted** (ruling #8) — modulating/suppressive detectors launch forming descriptive lessons; performance claims gate per-detector on shadow quality (§6.5). Option A rejected as too thin for a slot-constrained game.
**R3 §15 answers adopted:** 4 launch detectors, proven additive-or-measurable in the Appendix · watchlist + broadly-suppressive-without-shadow deferred · per-detector opportunity definitions · trial scope 8 triggered / 12 eligible / 6 min battles / 20 max or 30 days · exclude-and-extend with trial-owned-touch cancel · regime-conditioned behavioral-distance vector (setup-class mix, turnover, median hold, concentration, sector breadth, direction mix, entry selectivity; normalized distribution distance vs pre-learning archetype baseline; regression = material drop persisting two generations; shared-regime convergence ≠ identity loss) · param-edit transaction · narration 1-per-3-battles · dossier + shadow bounds pinned · cross-agent learning out, version stamps preserve cohort analysis.
## 17. Homogenization defense (standing, from V1.1 §10)
Archetype differentiation is the product. Defenses against self-confirming convergence: opportunityOrigin exclusion of self-induced exposure from confirmation; within-archetype evaluation; between-archetype behavioral-distance as a health metric (feature vector per §16); no popularity ranking; single active experiment per agent (now the §5.9 window); repeated teaching never inflates empirical maturity; cross-regime replication before global labels.
## 18. Open items → Detector Appendix (next adversarial target) & L1 build spec
**Detector Appendix (first deliverable, Fable-reviewed before CC builds):**
1. The 4 launch detectors, each with: `interventionClass` + **proof** it's additive, genuinely measurable modulation, or shadow-gated suppression; target; params/menu; horizon; opportunity definition (trigger universe + denominator + cluster rule + exclusions); regime policy; hypothesis cap.
2. Per-detector §6.5 shadow-quality gate values (coverage %, scorable %, fidelity check) for any suppressive/modulating detector.
3. Per-detector comparator, baseline window, and minimum practical effect for the evaluationSpec.
**L1 build spec:**
4. Shadow capture point (least-invasive decision-site hook; fence-authorization if fenced files touched).
5. Cron placement (aggregator piggyback capacity; shadow outcomes sized for L2).
6. `firestore.rules` denial set for agentLessons, atoms, trials, shadow receipts.
7. Proposal budget (1 or 2), consistent with the single-window invariant.
8. Null-process harness: predeclared shift magnitudes, regime-block-shift method, cadence, sham-detector set, and the **numerical false-confirmation ceiling** defining L1's exit.
9. Shadow storage bound values (§6.6).
**Architecture is frozen. No further broad architecture rounds — the next review is the Detector Appendix only.**
