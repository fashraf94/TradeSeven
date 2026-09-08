The two V1 blockers are resolved. I would not send V1.1 back for another broad redesign. The remaining issues are narrower contract defects, plus one founder decision I think the prior ledger already points toward.

The biggest improvement is §5. You fixed the anticipation problem correctly. “At the 12:45 check my trading process flagged NVDA as a potential entry” reports a historical event. It no longer republishes the decider’s action conditional. Removing both `threshold` and unverified `signalSummary` is the clean version of R4.

The deterministic filing route also fixes my second blocker in principle. `Files:` is now backed by a proposed mechanism instead of hopeful UI copy.

I still see five material corrections before I would call this build-ready.

1. Raw rationale is still a safety hole

This is the biggest remaining issue.

Your new governing sentence says:

“attribution proves authorship, not safety”

I agree. But §3.2 then hands Gemma the entire stored `rationale`, verbatim.

The discovery already proved this field is contaminated by the fenced hypothesis contradiction. The schema says not to put the hypothesis in rationale, while the prompt explicitly tells the decider to end the rationale with a hypothesis.

So V1.1 currently applies the correct rule to `threshold`, but not fully to `rationale`.

A historical rationale might contain:

“Held NVDA because momentum remains intact. Hypothesis: if it clears $145 I expect continuation.”

Or potentially stronger forward language.

Calling this historical does not make the forward clause safe.

Minimum correction:

Add an explicit rule beside YOUR RECORD:

“Rationale is historical decider text. It may contain forward-looking language produced by the decision prompt. When explaining a completed decision, quote only the part describing the completed decision and its observed reason. Never repeat a hypothesis, future action, action condition, intended trade, or plan from inside rationale.”

Then add a hostile harness fixture where the rationale itself contains `Hypothesis:`, “I’ll rotate,” “if X then I would swap,” or equivalent.

I would also make this one of the paired-harness scoring dimensions.

This does not require reopening the fence.

2. The hypothesis dedupe rule will miss the known duplicate

You currently say:

“exact match after whitespace normalization”

The discovery shows the two forms are structurally different. The dedicated field starts with `Hypothesis:` while the inline form is produced as something like `**Hypothesis: …**`.

Whitespace normalization alone does not make those strings equal.

I would define one deterministic comparison normalizer:

strip Markdown emphasis wrappers  
 collapse whitespace  
 trim  
 remove one leading `Hypothesis:` from each side  
 compare the remaining text exactly

Do not modify the stored or displayed bytes. Use this normalization only for duplicate detection.

Then your “never render twice” contract becomes executable.

3. `groundingVersion` is in two different places

§3.4 says the history window admits agent-initiated exchanges where the exchange carries:

`groundingVersion ≥ 1`

But §5 writes anticipation as:

`anticipationContext { symbol, direction, evaluationId, slot, groundingVersion }`

That means the exchange does not have the top-level field the history filter is looking for.

As written, the new grounded anticipation note still disappears from the narrator’s memory.

I would make this boring and universal:

Every exchange produced under the grounding contract gets top-level:

`groundingVersion: 1`

Keep `anticipationContext` for anticipation-specific provenance.

Apply the same top-level marker to generated openers, template openers, grounded chat exchanges, code-composed anticipation, and any other proactive exchange you want eligible for history.

Then §3.4 has one rule instead of message-type exceptions.

4. `file-directive` needs a stronger transaction contract

The new route is directionally right. Its current body is too weak:

`{ agentId, battleId, adjustmentId }`

You say the route implements a compare-and-set guard and returns `conflict`, but there is no expected prior state in the request.

If the objective is stale-client protection, the server needs something to compare against. For example:

`expectedDirectiveThreadId`  
 or  
 `expectedDirectiveVersion`

including `null` when the client believes no directive exists.

Inside one transaction, the route should re-read and verify:

the authenticated owner  
 the battle is active  
 the supplied agent belongs to this battle  
 the expected current directive still matches  
 the adjustment id is permitted for the server-derived archetype  
 the canonical text comes from the server  
 the grounding/directive feature is enabled  
 the new directive and its audit entry share the same canonical thread id

The earlier framework’s P-1 already requires the directive write to become a transaction specifically to close the dual-surface race and post-close race.

One more thing: the route should not become callable merely because the endpoint exists. Gate the mutating route itself, not only the client rendering the chip.

5. §6.4 is larger than a config constant

This is the one place I think V1.1 understates the decision.

The Controller record says Direct has “cost before tap,” tied to D-31, and its actual designed control says:

`File it · 1 message`

So the “no charge” lean appears to reopen an existing influence-budget decision.

More importantly, charge versus free changes the backend contract.

If charged:

the route must check remaining budget  
 the charge and directive write should commit atomically  
 the response must return updated remaining budget  
 concurrent taps must not overspend

If free:

you have created a free influence channel beside a paid conversational influence channel

That is not merely:

`DIRECTIVE_CHIP_COST = 0/1`

My recommendation is to preserve the existing one-message cost for Direct.

The reason is clean. The scarce resource is influence, not inference cost. A deterministic write is cheaper computationally, but it still changes what sits in front of the trading process. Making the strongest bounded influence action free because it skipped Gemma would invert the budget’s purpose.

Scouting assignments are different. The character initiated the ask. Making the answer free has a coherent product rationale.

There are three smaller cleanups I would make too.

First, §6.1 says `file-directive` is “the same write the structured Direct control and the assignment answer need.” That conflicts with your own D-100 text in §11, where Assignments V2 is research/equip and enters through the ruled equip path. Delete assignments as a consumer of `file-directive`. Otherwise you quietly reconnect two authority channels you just separated.

Second, CURRENT CONTEXT says it comes from “daily and 15-minute data,” but you now include weekly fundamentals. The discovery confirms those fundamentals come from the weekly estimates mirror. I would say:

“CURRENT CONTEXT — prepared for this conversation from cached sources at their labelled vintages; not the evidence the trading process necessarily saw at its check.”

That is more durable anyway.

Third, §8 is now stale when it says “Same endpoint, same prompt, same gate.” Ordinary League chat still shares the chat endpoint. Directive chips now deliberately use `file-directive`. State that distinction.

There is also one governance wording issue.

§11 calls these:

“Side rulings (Sol, Sep 7)”

and then creates D-99 and D-100.

I would not leave that wording in the ledger.

My pass was advisory. Under the governance model you gave me, I do not create founder rulings. If you accepted those recommendations when you and Claude incorporated them, write:

“Founder adoption of Sol recommendations, Sep 7”

Then D-99/D-100 have the correct authority provenance.

That is a documentation correction rather than a design defect.

My confirm-pass severity would therefore be:

0 BLOCKER on the original architecture  
 5 MAJOR  
 3 MINOR/governance cleanups

Spec verdict: PROCEED WITH CORRECTIONS.

I would not order another full Phase 0\. The one targeted `signalSummary` read in §9 is appropriate. I would add one small read of the existing directive persistence/write shape while implementing §6.1 so the new deterministic route copies the exact existing `directiveThreadId`, expiry, battle/agent binding, and budget semantics rather than creating a parallel directive schema.

Once those items are folded in, I think this is ready for the build seed.

The important part is what changed between V1 and V1.1. V1 was trying to make unsafe claims sound more carefully attributed. V1.1 mostly changes the mechanisms so the claims themselves become true. That is the right correction.

