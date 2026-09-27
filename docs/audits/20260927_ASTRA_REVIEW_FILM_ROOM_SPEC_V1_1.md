# Astra (Codex) Review — Film Room Build A Spec V1.1

**Date:** 2026-09-27 · **Reviewer:** Astra (OpenAI Codex), one-shot, spec-only (no repository access) · **Reviewed:** `FILM_ROOM_BUILD_A_TAPE_SPEC_V1_1_20260926.md` · **Requested by:** Flash · **Prompt:** `SOL_FILM_ROOM_BUILD_A_SPEC_V1_1_REVIEW_PROMPT.md` (written for Sol; run through Codex instead)
**Verdict:** Revise before build.
**Disposition:** every finding folded into spec V1.2 (`docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_20260927.md`, §14). No second spec round; the A1 branch review verifies the folds in code.
**Provenance:** the text below is the reviewer's output as delivered in chat, verbatim; the header above is the Film Room chat's.

---

Revise before build. The design can support an honest tape, but the replay comparison, preservation rules and several display choices need correction. This review accepts the spec's live-code findings as given.

1. Does the replay need a different visual treatment?
   Yes. Use distinct rebuilt lines, visible labels and gaps where inputs are missing. A stored reconciliation delta does nothing for a player unless the screen exposes it. Agreement at the sale also does not establish accuracy afterward.
   More fundamentally, §6's gap compares scores with different starting points: the sold stock's score starts at its original entry; the bought stock's score starts at the swap. It omits the points banked by selling. Suppose the sale banks 10 points, reconstruction agrees exactly, and neither stock subsequently moves. The displayed gap is −10, although both paths retain 10 points.
   Correct that comparison before drawing the fork. Also label continued holding of either leg as hypothetical when subsequent trades occurred. This is not the actual effect of the swap on the whole battle.
2. Can the interim headline ship?
   Yes: "Recorded score at 3:45 PM ET" is honest when that score and timestamp exist. Glance need not wait for C-5.
   The result needs a separate rule: show a final win/loss/draw only for a completed battle, calculated from the completion scores. "Derived" does not make a provisional result final. On earlier-day views, clearly separate the eventual battle result from that day's score.
   If the preceding day's score is unavailable, show the day's change as unavailable. Do not silently substitute the battle's starting score except on its first day.
3. Is "Risk pass: no exit triggered" safe wording?
   It can still sound like a completed safety inspection. Prefer: "Risk decision recorded: HOLD." Explain once: "This does not show which protections were armed or checked."
   A missing risk record must have different wording. Neither HOLD nor an absent exit proves that every mechanism ran successfully.
4. What does the directive card owe the player?
   An unambiguous account of what was said, what was filed and when it reached the agent's inputs.
   Use "You asked" and "Directive filed." For an unsuccessful filing, say "No new directive filed"; do not put proposed text under "Filed as." For "no change," identify the retained directive only if its historical text is available.
   If the reply is shown, label it "Chat reply at the time" and make the filing status authoritative. A heard stamp establishes recorded receipt, not agreement, understanding or obedience. A missing stamp means receipt is unconfirmed.
   The spec must also resolve its contradictory prohibition on model paraphrases before displaying that reply.
5. Does the one-day horizon still create a disguised verdict?
   Yes. "Biggest swing," a signed swap gap, and a plan placed beside its subsequent high or low invite conclusions about good decisions, bad decisions and missed opportunities.
   A daily cutoff is acceptable for navigation. It is not necessarily the plan's intended horizon. State that distinction next to plan prices, show plans consistently, and avoid success colors, rankings or highlighting whichever later price makes the plan look most prescient or foolish.
   Even correct arithmetic cannot establish whether a patient plan was good from one afternoon's outcome.
6. What else should be copied before eviction?
   The clearest omission is the relevant evaluations[].evidence stamp. Section 2 says it is not on the permanent tick record; §6 later needs it for boughtVsEvidence; §4 does not preserve it. Copy the necessary structured values with their evaluation identity and observation time that night.
   Also preserve the required scoring inputs for both replay legs while their source snapshots remain available. Section 9 gates missing inputs for the ghost leg, but the incoming leg also needs the scorer's required fields; its specified inBasis contains only price and time. Any unavailable input is a dependency, not permission to guess.
   Separately, §6's fetch list omits plan-only symbols. A stock considered but never held or traded still needs bars to fulfill the promised price-beside-plan display.
7. What should the screen say once when the headline changes?
   "Film Room now includes held positions in its recorded score. Earlier Film Room summaries left them out, so the same battle may show a different number here. Check the timestamp: this score may be from the last recorded check rather than market close."

   Show this once when opening the new screen. Avoid suggesting that the battle was replayed or its official result changed.
8. How could someone make the agent look better or worse than the record supports?
   They could:
   - Present the unadjusted swap gap as points the agent gained or threw away.
   - Credit the agent for a platform-forced exit by emphasizing the profitable row over its source.
   - Highlight a plan's later high as foresight, or its later low as failure, without respecting its horizon.
   - Place holds after a directive and imply defiance, although sequence does not establish causation.
   - Present recorded rationale as an independently verified explanation.
   - Put an unseen diagnostic under "Why?" and imply it informed the decision.
   - Treat an empty, partially recovered history as evidence that nothing happened.
   These are possible with authentic individual fields. Selection, placement and labels supply the unsupported conclusion.
9. Can the hub still imply an outcome or review content?
   Yes. "Your analysis is ready," a celebratory icon, or a promise to explain the loss all exceed readiness and destination.
   Stage 3 guarantees only a completed battle and a written final-day close pass. Candles may still be pending, and capture may be partial. "Open battle tape" fits that guarantee better than "Complete review ready."
   There is also a false promise in "review pending" for older, unbackfilled battles: no specified scheduled process necessarily makes those tapes appear. Use an unavailable state unless work is actually scheduled.
   Finally, the literal interface exceeds invariant 8: it returns stage and reason as well as readiness and destination. Either narrow the interface or explicitly permit limited availability metadata.
10. Is copying shadow call records clean?
   Preserving them is reasonable; the proposed provenance is insufficient.
   BA-16 assigns mode from configuration when the tape is written. A later backfill could therefore attach a different mode to a call originally created in shadow mode. Label that value as the tape-write mode. Historical call mode requires a persistent source; otherwise it is unknown.
   Mutable call state creates another distinction: a backfill may copy today's resolved state into the day the call was minted. Define whether this is a snapshot observed at copying time or a reconstruction of that day. The latter requires historical state the spec does not establish.
   "Copied" must mean "the source recorded this," not "validated as correct." Keep source identity, copying time and the governing contract version clear.
   Also, "not rendered" does not mean private: §5 allows the owner to read the tape, including its call fields.

The written invariant problems are these. Some are direct contradictions; others permit an implementation that breaks the promise.
- Invariant 1 — incomplete number provenance (§4, §6, §7). Replay and result receive explicit provenance labels, but day change, holding duration, directive aftermath counts, plan prices and aggregated chart bars have no equivalent required treatment. Define provenance for every displayed number, including fetched and aggregated market data.
- Invariant 2 — implied knowledge or protection (BA-7, BA-14, §4, §7). HOLD can read as a safety assurance; an unseen diagnostic under "Why?" can read as decision evidence. The minute close containing a check can also occur after that check. It must not be presented as the price available to the agent at that instant.
- Invariant 3 — the reply exception defeats the paraphrase ban (BA-9, §7). An unrestricted agent reply can contain the very paraphrase the invariant forbids. The rationale timeline also contradicts §1's exclusion of narration and §7's "no agent voice anywhere." Either allow explicitly attributed historical quotations or remove them; the current promises cannot all hold.
- Invariant 7 — preserved history can disappear (§2, BA-15, §5–§6). The close pass replaces the whole tape. A later run after evaluation eviction can erase plans, rationale or heard stamps saved by the first run. It can also erase candle enrichment. Targeted candle updates do not prevent races with a whole-document replacement.
- Invariant 7 — missingness is too narrowly specified (BA-8, §4, §7). Present ticks do not prove complete plans, evidence, directives or trade details. Surviving sequence bounds cannot establish whether records are missing before or after them. The screen also lacks an explicit requirement to display deferral truncation. Unknown coverage must remain visible at the affected section.
- Invariant 8 — the helper returns more than promised (§11). stage and reason exceed the literal "ready or not" and "where" boundary.

Invariant 5's write/body boundary is consistent on paper. Invariant 6 needs wording that distinguishes the two flags: Stage 2 intentionally permits tape writes while the screen flag is off. Its actual equivalence still requires implementation verification.

Two operational omissions worsen the missingness problem: §6 selects only the prior trading date's pending candle work, so older backfills and partial or failed runs have no specified retry path; §7 nevertheless promises the next pass for an absent tape. A durable retry path is a dependency.

The verdicts in disguise to prohibit explicitly are:
- "Biggest swing": selects a supposed decisive action, and even switches between banked points and a hypothetical gap.
- "Points gained/lost by swapping": claims an action's effect from an incomplete counterfactual.
- Plan highs and lows presented as opportunities: turns later prices into hindsight judgments.
- Directive aftermath presented as compliance: turns chronological proximity into obedience or defiance.
- Rationale or diagnostics presented as "why": turns recorded language or unseen information into verified causation.

Cut: Remove "biggest swing" from Build A; its selection and changing measurement turn the tape into an editorial judgment.

Add: Require a visible coverage statement for each section—complete, partial or unavailable, with the known time span—so missing history can never masquerade as inactivity.
