I now have the Charter, so the deferred conformance check is resolvable. The most important new result is this: the Forge spec is broadly aligned with the Charter’s control philosophy, but its claim that all three step-0 counters are T1 does not survive the Charter text. RF-03 is outside the defined T1 model as written.

PART 1\. CHARTER CONFORMANCE

§1.2

Charter §8 P1. HOLD. “Nothing learned gets special authority” matches P1: learning proposes and the existing control system disposes. S-1 remains a maturity defect, not a P1 defect.

Charter §8, engagement tuning. HOLD. The three-card display cap and ten-battle suppression window are explicitly UX budgets, not maturity thresholds. The Charter prohibits engagement-tuned promotion gates, not UX suppression.

Charter §6, two tracks. HOLD. The spec keeps XP/levels outside the Forge lesson record and does not use XP to advance lesson maturity.

§8 H1 through H10

H1. HOLD against Charter P1. Ledger state itself has no trading authority. Accepted items obtain authority only after compilation into the existing control system. The visibility half of H1 is a Forge invariant rather than a Charter requirement.

H2. HOLD against Charter §7 R3. Rendering unknown provenance as unknown rather than inventing “You” is consistent with the prohibition on laundering provenance.

H3. Counter-origin portion HOLDS against Charter §3 and §5. Arithmetic produces the observation and typed fields render the claim. The chat-origin wording remains internally overbroad for the reason already identified in S-9. That is not a new Charter finding.

H4. Tier vocabulary HOLDS against Charter §5. Hunch, Testable, and Trial-proven are the Charter tiers. The pre-miner claim sequencing problem remains S-12 because Charter §9 puts the miner before claims/maturity machinery.

H5. HOLD. Withholding points-since-adoption until it reconciles with visible scoring directly matches Charter §5’s ledger-honesty requirement.

S-19. MAJOR

(a) Sections: Forge §4.5 RF-03, §8 H6/H10, §14. Charter §2, §3 M2, §4 T1.

(b) The spec calls RF-03 “T1 game-craft,” but the Charter’s bench-utilization T1 territory is specifically eligible-but-rejected episodes. RF-03 instead counts watchlist names × battles and never identifies a decision with a deterministic one-step counterfactual.

(c) A name can be branded “dead weight” because it lacked an opportunity, was ineligible, or was never considered. The system could recommend removal without measuring regret at all.

(d) Smallest fix: cut RF-03 from step 0 unless Phase B recasts it around eligible-but-rejected episodes with a valid one-step counterfactual.

H6. PARTIAL. The prohibition on T2 counters conforms to Charter §4-T2. The claim that step 0 contains T1 only does not, because RF-03 fails T1 as written. See S-19.

H7. HOLD. Charter §4 says T1 compiles into existing controls, and §5 requires visible behavioral effect as part of the lesson-to-action chain.

H8. HOLD. Keeping Hunches and untested reflections away from “learned,” “improved,” or equivalent evidence language is consistent with Charter §5 and P2.

H9. No Charter conflict. The Charter does not require or prohibit revealing engine text.

H10. HOLD as a presentation rule against M3. RF-01 and RF-02 are stated over episode sets rather than single trades. RF-03 still fails the deeper M2/T1 test in S-19.

§14

“Charter §4-T2 untouched.” CONDITIONAL HOLD. RF-01 is canonical threshold-discipline territory. RF-02 originates from `profit_take`, which fits the Charter’s harvest-abandoned/swap-timing T1 family. One Phase 0 question remains decisive: does the proposed “hold longer” target ever weaken or delay protective exits? If yes, this becomes a T2 violation and requires the dual ledger.

Charter §7 R1:

S-20. MAJOR

(a) Sections: Forge §4.5, §4.7, §14. Charter §7 R1.

(b) §14 says R1 is preserved and §4.7 says market-native behavior fields exist “from birth,” but the same sentence says step 0 populates only `domain`. RF-01 is defined in bonus-threshold proximity and RF-03 in watchlist-names × battles, rather than the market-native behavior vocabulary R1 requires for claim behavior fields.

(c) The claim corpus would begin life without the portable behavior representation the Charter deliberately requires at schema v1. Adding it later is exactly the migration R1 was meant to avoid.

(d) Smallest fix: no step-0 counter becomes a Charter claim until its typed behavior fields satisfy R1 from creation.

Charter §7 R2. PARTIAL. The `domain` field itself conforms. RF-01=`arena` is defensible. RF-02=`general` remains unsupported for the reasons in S-13 and S-15, so the blanket §7 conformance claim does not yet hold.

Charter §7 R3. HOLD at the document-contract level. Arena provenance remains arena provenance and unknown origin is not silently rewritten. Export implementation still has to carry the provenance verbatim.

Charter §7 R4. HOLD. The Forge spec introduces no executor export path and makes no enforcement claim about an external runtime.

Charter §8 P1. HOLD. Same conclusion as §1.2.

Charter §8 P2. HOLD. Chat declarations carry no evidence tier. Reflections are explicitly labeled not evidence-tested. Counter claims are supposed to rest on arithmetic rather than narrative.

Charter §8 engagement gates. HOLD. No maturity promotion is tied to visits, clicks, acceptance, battle count alone, or other engagement pressure.

Charter §8 calibration fence. DOCUMENT-LEVEL HOLD, NEEDS PHASE 0 for implementation. Exact question: does the Accept endpoint travel through the identical canonical caps, conflict, archetype, and enforcement path used by human-authored controls, with no learning-only bypass?

Charter §8 market-alpha exclusion. NOT YET FULLY ESTABLISHED. RF-02 presently uses subsequent ≥1 ATR movement rather than a demonstrated scoring counterfactual and calls itself `general`. That is already S-13/S-15. RF-03 fails the game-regret definition under S-19. No additional finding.

So the Charter does not overturn the architecture. It does narrow the acceptable learning surface more than V1.0.1 acknowledges. The clean Charter-native starting set is substantially closer to RF-01 alone than to RF-01/RF-02/RF-03 as peers.

PART 2

B1. Labels

As written, the five labels map like this:

| Label | Lesson maturity required | Defensible? |
| ----- | ----- | ----- |
| You | None | Yes. It describes authorship, not evidence. |
| Default | None | Yes. It describes seeded origin, not evidence. |
| Proposed | Hunch | The word is defensible as provenance. The defect is that the Hunch is already equipped on a live bench. See S-1. |
| On trial | Testable plus an active trial | Yes. This matches the Charter distinction between enough evidence to test and enough evidence to believe. |
| Learned | Trial-proven | Yes at the tier level. This is the strongest label and must remain exclusive to Trial-proven. |

I do not find a new tier-to-word defect. “Learned” is the word most capable of being overread, but Trial-proven is the Charter’s highest maturity state. The important honesty condition is scope. An arena-proven lesson must remain identifiable as arena-proven under R3. “Learned” must never silently become “market-proven.”

The more immediate problem is the inverse one. “Proposed” appears on an item that is already influencing the agent because the user accepted and equipped it. That is provenance, not current state, so it survives linguistically, but S-1 makes the underlying lifecycle wrong.

B2. H1’s reach

H1 obligates the record to expose every agent-specific trading input, which on this spec means:

1. Archetype identity.  
2. Watchlist/focus entries that feed the agent’s hunting universe.  
3. Equipped rule bundles, their operative rules, and relevant parameters.  
4. Standing leans.  
5. `disciplines`.  
6. `consolidatedInsight`.  
7. Any future directed or assigned item once it becomes persistent agent-specific input.  
8. Any other per-agent field Phase 0 finds in the evaluation or execution path. That final category is S-16.

The line is drawable in practice, but the test must be state-based, not component-based: if two agents can carry different persisted values and the runtime reads those values when deciding, the value belongs on the record. If the mechanism is invariant platform machinery, the mechanism itself does not.

The dangerous boundary cases are Risk Manager configuration, DRB state, guardrail parameters, mode-specific enforcement values, or other “platform” mechanisms that turn out to contain per-agent state. Calling the enclosing system platform machinery does not exempt an agent-specific parameter inside it. That is exactly why S-16 needs Phase 0\.

What H1 intentionally lets the record omit is also what a user might reasonably expect under the phrase “how it decides”: Risk Manager behavior, DRB intervention, guardrails, and other hard platform constraints. The Thesis deliberately separates those, so I do not call this a new defect. But the record is not a complete causal diagram of every decision. It is a record of the agent-specific part of the decision system.

B3. Chat origin

No. Endorsement is necessary, but not sufficient. This is S-9.

Failure modes include:

1. The model resolves “send that one” to the wrong earlier suggestion.  
2. The user says “sure” or “sounds good” conversationally and the endorsement detector treats it as durable intent.  
3. The model proposes three changes, the user endorses one, and extraction records all three.  
4. The user says “yes, except the stop change,” and extraction loses the exception.  
5. The user agrees to “try this next battle,” while the recorded item becomes a standing rule.  
6. The model paraphrases the user’s idea into a stronger or broader directive.  
7. Cross-turn coreference points to the wrong stock, threshold, archetype, or rule.  
8. The user later reverses the instruction but the earlier Ledger item remains pending.  
9. The model correctly hears the intent but compiles it into the wrong primitive.

The Accept preview addresses only the last mile. It lets the user catch a wrong compiled control before the item trades. It does not make the original Ledger statement truthful, erase a casually endorsed false item, or repair the provenance claim “You · from chat.”

So the preview is a strong trading gate. It is not a sufficient authorship gate.

B4. Counters

RF-01 Threshold abandonment

Counterfactual: potentially well-defined, but not yet defined. The Charter explicitly names threshold abandonment as T1. The system still needs the exact V4 scorer semantics from Q-05b. If the alternate policy is “hold this position instead of taking this exit through settlement,” the frozen scoring function must recompute the resulting game outcome. “It crossed the threshold by close” is not itself the counterfactual result.

Market judgment: no, if the claim is expressed as game-score regret. Yes, if “crossed the threshold” substitutes for the actual point consequence.

T2: no.

Status: valid family, incomplete counterfactual. S-15.

RF-02 Early harvest

Counterfactual: not well-defined as written. “Moved another ≥1 ATR by close” describes subsequent price movement. It does not prove that holding would have produced a superior result under the deterministic FantasyTrades scorer.

The Charter expressly allows harvest-abandoned and swap-timing regret as T1, so the family belongs. The implementation presently measures the wrong terminal quantity.

Market judgment: yes, in its present form it edges across the line. “After we take profit, names often travel another ATR” is a behavioral statement about market continuation. A game-craft version must ask what the frozen game score would have been under the one-step alternate policy.

T2: the evidence family is T1 because it starts with `profit_take`. The compile target needs Phase 0\. Exact question: does CN-08/mb-08 or the equivalent “hold longer” control affect only profit-taking behavior, or can it delay protective/risk exits too? If the latter, H6 fails and the target belongs behind the T2 dual-ledger fence.

Status: S-13 and S-15.

RF-03 Dead weight

Counterfactual: no. A watchlist name existing for N battles without being entered is not an eligible decision with a one-step alternative.

Market judgment: potentially yes. “Never selected, therefore remove it” can become a disguised claim that the symbol or focus is poor rather than a statement about game regret.

T2: no. It simply does not qualify as the specified T1 family.

Status: S-19.

Which would I cut? RF-03. RF-01 is almost exactly the Charter’s flagship T1 example. RF-02 maps to an explicitly named Charter regret family once the outcome and compile scope are corrected. RF-03 is bookkeeping being dressed as regret.

B5. The empty record

Battle 0

The user sees the archetype and seeded/default bench contents. The Ledger is empty. No chat items exist. No lessons exist. The empty-state line says play will cause what the pair builds together to appear.

This is clean as a static agent record. It becomes premature if it ships before Phase B. That is S-18.

Battle 3

The benches remain mostly defaults unless the user manually changed something. Step-0 counters might begin producing Hunch proposals if their display floors are met. There may also be nothing.

This is where the record can feel dead. Three battles do not guarantee any visible growth. That is acceptable under evidence gating. The system must resist manufacturing progress to solve the feeling.

If a Hunch appears and offers Equip, the record flips from dead to overactive. It asks a casual user to configure the agent from evidence the system itself calls only a Hunch. That is S-1/S-17.

Battle 10

Under the pre-Phase-B sequence in §11, nothing has machinery to mature past Hunch yet. The user might see superseded Hunch proposals, accepted Hunch-origin controls, or no proposals.

If Phase B has shipped, episode-grained evidence could now produce Testable lessons and trials. The Charter says a handful of battles may be enough because each battle supplies many episodes. But the Forge spec does not itself define trial initiation. That belongs to Phase B.

This is the first point where “learned with you” becomes especially conspicuous if the miner has not shipped.

Battle 30

In the full intended system, a sufficiently evidenced lesson might be Trial-proven and appear as Learned.

For a User 1 who never chats, rarely opens Forge, and never chooses Equip, the spec has a deeper problem: the record can accumulate evidence while the agent itself never changes. Every learned behavioral change still requires an explicit Accept action in §4.6.

S-21. MAJOR

(a) Sections: §1 thesis, §1.2 Users 1+2, §2 empty state, §4.6 lifecycle. Charter §5 and §8 P1.

(b) The design lens says User 1 does not build and rarely visits Forge, yet every counter-derived behavioral change requires that user to visit the Ledger and Accept it.

(c) A passive user can play 30 battles and accumulate an increasingly rich observation record without ever entering the lesson → visible behavior → citation → points loop the Charter identifies as the actual learning experience. The product says play compounds the agent, while the specified interaction model makes configuration work a prerequisite for compounding.

(d) Smallest fix: Phase B must explicitly resolve how a User 1 enters the trial/compiled-control loop without turning Forge into a builder workflow, or the “as you play, we learn together” promise must be narrowed.

B6. Parallel coupling

If PR 1 merges after another arc’s writer, the concrete failure is lost origin.

For an Assignment-seeded watchlist entry, the old `source` field might rescue it. For a new standing lean, rule write, or Direct-origin write with no independently recoverable source field, the provenance backfill sees only an already-existing item. It cannot reconstruct who or what put it there. The item becomes unknown or gets mislabeled. That is S-3.

There is also S-2: even after PR 1 merges, the current flag design leaves stamping disabled by default, so merge order alone does not establish the invariant.

If the citation loop starts before C3’s gate, the more serious failure is semantic, not Git-level. PR 7 modifies the evaluation-prompt assembly while the grounding arc is still defining what the model receives and what it is allowed to claim. The lesson citation can be built against a prompt contract still in motion, then either disappear during the grounding merge or survive in a location whose grounding rules never reviewed it. The result is exactly the kind of “agent says a grounded-sounding thing from an ungrounded path” this arc is trying to prevent.

Merge order is not sufficient for provenance. “Provenance exists before every writer” needs a hard prerequisite.

C3 is conceptually a hard gate, but it should be expressed with the same precision as §6’s front-door gate. PR 7 should not begin until the named grounding conditions are true. “Later in the merge order” is weaker than “not eligible to start.”

No new S-number beyond S-2/S-3 emerges here.

B7. Disguises

Fourth pipeline: yes. The step-0 counters are functionally a miniature learning pipeline.

They run after settlement, inspect persisted receipts, classify episode families, maintain denominators, produce user-facing claims, write Ledger records, supersede prior claims, and compile accepted results into controls. Calling them “counters” does not change the fact that this is a pre-Phase-B regret pipeline. That is S-12.

Second source of truth: the Ledger is intended not to be one for active controls, but one lifecycle hole turns it into one.

S-22. MAJOR

(a) Sections: §4.4, §4.6, §5.1, §7.

(b) The Ledger persists `compiledRef` and the bench item persists `lessonId`, but the spec defines no reconciliation when the control is later unequipped, a bundle is reforged, the archetype changes, a lean is retired, or the lesson is superseded.

(c) The Ledger can say a lesson compiled into the agent while the active record no longer contains that control. The two surfaces then disagree about what the agent has learned and what currently affects trading.

(d) Smallest fix: the active bench must remain authoritative, with Ledger “compiled/equipped” state derived or reconciled whenever the target leaves the active configuration.

New bench under another name: no. The Ledger is not a fourth bench if it remains an evidence/proposal surface and every operative control must appear on one of the three existing benches.

Is the Ledger genuinely non-trading? By the written contract, yes. There is no authorized path from a Ledger item directly to trading. Accept must validate, compile, and equip through a workshop bench first.

One Phase 0 question remains: confirm `forgeSuggestions[]` is truly a dark write today and is not currently read by any evaluation or prompt path. If it already affects runtime, then the read-through migration would inherit a hidden Ledger-to-trading path the design presently denies.

As a background stream, the spec fits beside the concurrent prompt-side arc only after its learning ambitions are reduced. Provenance, the bench honesty fixes, the record framing, and a tightly bounded chat-origin Ledger are compatible background work because they stay off the fenced prompt surface and produce small review packets. The step-0 counters are where the stream stops being background work. They force founder judgments about regret taxonomy, counterfactual semantics, portability, maturity, trial behavior, and user-facing evidence before the Phase B document exists. I would drop RF-01/RF-02/RF-03 cards and their user-facing lifecycle from this arc. At most, keep a report-only corpus probe after Phase 0\. That leaves the founder reviewing the Forge’s record contract now and the learning science once, in Phase B, instead of adjudicating it twice.

&nbsp;