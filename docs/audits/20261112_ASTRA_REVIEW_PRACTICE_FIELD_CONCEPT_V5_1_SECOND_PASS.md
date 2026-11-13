V5.1 is much closer to your vision. I support the direction with a few targeted changes. It does not need another redesign.

Starting with a watchable paper portfolio is reasonable. Release 1 gives users a place to observe an investment idea over time. Release 2 adds controlled comparisons of changes to their agents. The distinction is useful, provided both releases share the experiment records and ownership rules.

The remaining concerns are below.

Keep agent-generated ideas in release 1.

Section 12 postpones “the agent’s own proposals” until T4. This delays one of your strongest product goals: helping users participate without expecting them to invent every research question.

An agent proposing “Does this healthcare rebound thesis hold up over 30 sessions?” belongs in release 1. An agent proposing “Should I change my pullback admission rule?” belongs in release 2.

I would bring one narrow proposal path forward. Film Room supplies an observation. The agent drafts a question and explains the evidence. The player reviews the proposed test. This does not require building the full rule-change system early.

Define how agents review their own results.

Sections 6 and 7 protect private experience, which fits your vision. They need an explicit permission for the originating agent’s Film Room reviewer to read its completed experiments and propose follow-up questions.

Otherwise, the design preserves results but leaves their interpretation and next steps with the user.

Allow private review and proposal generation without automatically changing deployed behavior. Keep each record bound to the user, agent instance, archetype, and configuration version. Another archetype should not inherit the resulting strategy.

Strengthen the KB connection and the meaning of “your agent.”

The settings snapshot is a useful improvement. Passing settings into a prompt does not establish whether the manager follows their original meaning.

T1b should verify which settings influence decisions, which rules the runner enforces, and which capabilities remain unsupported. A technical rule needs its required indicator data and calculations. Its name or description alone is insufficient.

Add a small, versioned KB input contract here. It should identify the approved methods and evidence supplied to the agent. The full KB does not need to finish first.

Until behavior matches the declared scope, I prefer “Test version of your Trend Follower” over implying an identical copy of the deployed agent.

Finish matching exposure between the portfolio and its comparison.

Section 2 uses the archetype’s single-position cap for a single-stock test. Its sector cap might impose a lower limit.

For example, a 35% position limit combined with a one-third sector limit permits less than 35%. The passive comparison should start with the same effective permitted allocation.

Apply this treatment to sector and theme tests too. Comparing a partially invested sector portfolio with a fully invested sector fund measures different exposure alongside the management choices.

Also clarify “same allocation throughout.” Buy-and-hold normally fixes the initial shares. Maintaining a fixed portfolio weight requires rebalancing, which introduces another policy and additional costs.

Add a timing rule for simulated fills.

Section 5 labels delayed prices honestly, but labelling alone does not prevent an unfair simulation.

A decision made at 10:20 using news from 10:15 should not receive a 10:00 execution price. The experiment needs an explicit relationship between its information cutoff, decision time, and eligible fill observation.

This belongs in T1a/T1c. Use an eligible subsequent observation or record the action as unfilled under the declared policy. Keep both comparison branches consistent.

A few document inconsistencies also remain.

Section 13 still says “Approved unless you object.” Replace it with “Proposed rulings awaiting explicit approval.”

Section 14 says capacity is about 50 concurrent tests. Elsewhere, the document correctly describes 50 book visits per slot as a theoretical ceiling and sets a four-test founder cap. Keep those separate.

Section 9 moves a card immediately to “testing,” while other sections permit queued and scheduled runs. Mark it “testing” only when execution starts.

The minimum result record belongs with the first runnable experiment. T3 should add the Forge offer and adoption flow rather than introduce the first durable result.

My recommendation is to accept the release sequence and make these focused edits before writing build tasks. The biggest product correction is bringing agent-generated research questions and private result review into release 1. Those features give users an active research partner while the more demanding strategy-improvement experiments develop in parallel.