Practice Field V6 review
Date: 12 November 2026

Verdict: REVISE the implementation contract. Keep the product direction.
Founder explanation
V6 supports the original vision. It gives your agent a continuing place to originate ideas, put paper capital behind them, observe results, and propose follow-ups. The three horizons remove the pressure to judge every idea through a short game. Your user participates without having to design every experiment.

Keep these decisions: one visible book, three horizon slots, agent-originated proposals, private experience for the originating archetype, transparent decisions, and explicit adoption through the Forge. An empty slot is an acceptable result. The system should never invent a trade to keep the screen busy. These features follow V6 lines 30–51, 79–85 and 120–137.

The important distinction is between an ongoing product and a controlled experiment. The book supplies experience. Each idea supplies a bounded observation. A separate comparison of a changed rule against its unchanged baseline supplies evidence about an improvement. V6 retains branch books in release 2. Keep the offline workspace too. They serve different purposes, and should share versioned records rather than replace one another. This follows the Charter's policy-level evidence requirement and its development/confirmation split, not a requirement to build several separate applications (docs/AGENT_LEARNING_CHARTER_V1.md:33, :55, V6:137).

The largest problem is the proposed verdict. Beating a sector fund does not establish the reason a stock rose. Exiting at a risk limit does not establish a bad decision. A profitable idea, a correct explanation, a well-managed position, and a repeatable strategy deserve separate records. Otherwise the agent learns from misleading labels.

The second problem is the hedge rule. Buying an inverse fund does not mathematically reduce the sum of losses to the individual stock lines. Cash reduces exposure when the system allocates less or trims positions. Existing idle cash does not cancel those losses. Start with explicit exposure and price-line limits. Treat inverse-fund hedging as its own later experiment with a specified comparison and risk model.

The third problem is scope. Sleeve accounting, scheduled verdicts, shared cash, agent drafting and automatic entry are substantial new behavior. The existing Mandate supplies valuable execution and valuation components. It does not already supply the idea-book contract.

The learning architecture remains sound if the first release records the whole chain: source evidence → proposal → executable conditions → decisions → outcomes → follow-up question. Retrieving private experience changes future proposals. Describe this as experience-informed adaptation. It is neither model-weight training nor established improvement.

The full KB need not finish first. The first book needs a small approved methods packet, definitions for supported measurements, and explicit missing-data behavior. A novel indicator or unsupported event condition remains a proposal until its calculation and evaluator exist. Creativity should exceed the current executor's capabilities without silently expanding its authority.

I recommend revising V6 in place. Do not return to a user-operated collection of drills. Resolve the contracts below, then build a narrow version of the full loop.
Review basis and limits
I fetched origin and inspected a fresh detached worktree at origin/main, HEAD c37baa0d1cad220d37a41dae312e3d212ff27d4c. This advanced beyond the prior review's f79b481a. The current source, rather than the prior report, governs the findings.

No source edits, model calls, EODHD requests, Firestore requests, PR actions or deployments occurred. No test suite ran. This is a source and design review, not acceptance evidence. Production activation and the claim “no book ever created” were not independently verified.

Evidence notation: V6:n refers to line n of the attached 20261112_PRACTICE_FIELD_CONCEPT_V6.md. Other path:line references are relative to the reviewed worktree. Recommendations and numerical examples are proposed design choices or arithmetic deductions, not observations from live books.
C6-01. Separate the shared book from each idea's accounting
Severity: blocks T1. Answers A and part of F.

Evidence: api/_utils/mandateSchema.js:73 stores positions by ticker. api/_utils/mandateExecution.js:191 combines additions into the existing ticker holding and :198 constructs a fresh position object. :241 treats SELL as a sale of the ticker's holding. api/_utils/mandateSchema.js:228 constructs a book-level daily row. It does not preserve per-idea shares, cash or comparison holdings. V6:142 correctly proposes new idea valuation rows, but T1a must implement them rather than derive them from the existing daily row.

Adding an ideaId label to the current position map is insufficient. If two ideas own the same stock, an aggregate SELL has no idea-specific meaning. Dividends, trims, average cost and risk must reach the correct sleeve.

Recommended contract:
The book is the cash and execution authority. Each idea owns a separate subledger of reserved cash, shares, basis, costs, corporate-action receipts and external transfers. Every fill carries its idea identity and contract version. Sleeve totals reconcile to the aggregate book after every mutation. Shared tickers use explicit sleeve quantities. Until this allocation path passes acceptance, the pilot refuses a ticker already owned by another idea.

Cash originates in a single book treasury. Reserve capital atomically before entry, including costs and the cash floor. Two drafts must not both spend the same available balance. Recheck book revision, idea version and available capital at execution. Freeze a deterministic priority rule for simultaneous requests. Mandatory risk reductions and due exits should precede optional entries. A proposal losing the reservation remains queued or refused with a reason.

Keep an inception row before costs, then per-sleeve rows with cash, quantities, marks, price quality, accumulated costs, flows, comparison holdings and comparison value. Costs already charged through execution cash must not be subtracted again (api/_utils/mandateFrictionModel.js:20).

V6:64 says fixed shares once bought, while V6:34 permits adds and trims. Replace it with:
The contract freezes the management rules and comparison policy. Actual idea holdings change only through recorded actions. The passive comparison starts with the same effective initial capital and specified exposure, then keeps its initial quantities except for corporate actions. Unused capital remains cash. Later active decisions do not rewrite the passive comparison.

For release 1, reserve a fixed initial capital amount per idea and keep proceeds inside its sleeve until resolution. This avoids ambiguous mid-run transfers. If later funding is allowed, specify matched comparison cash flows and return calculations before enabling it.
C6-02. Express the rails as executable book and sleeve limits
Severity: blocks T1. Answers B.

Evidence: api/_utils/mandateVintage.js:89 freezes a gate configuration with book cash, position and sector limits. It has no horizon or idea limits. api/_utils/mandateGate.js:59 receives no sleeve identity. Cash sizing occurs at :119, sector checking at :133, single-stock checking at :138, and count checking at :145.

The interface accepts a configuration object, but its current implementation does not enforce all V6 rails. Extend the Mandate-specific configuration and gate. Do not mutate the fenced battle table to obtain these semantics.

After V6's proposed sector-count translation, the limits for an otherwise empty book would be:
Archetype	Source count	Proposed book-sector cap	One-stock short / medium / long ceiling
Trend Follower, momentum_chaser	3	50%	20% / 30% / 35%
Fundamental Investor, analyst	3	50%	20% / 30% / 35%
Diversifier	2	33⅓%	20% / 30% / 33⅓%
Contrarian	3	50%	20% / 30% / 35%
Speculator, degen	4	66⅔%	20% / 30% / 35%
Capital Preserver, guardian	2	33⅓%	20% / 30% / 33⅓%


Sources: api/_utils/agentArchetypeConfig.js:66, :95, :122, :151, :182, :214, the shared 35% position limit in api/_utils/mandateConfig.js:57, and V6:240. This is proposed arithmetic, not current corrected behavior. The existing Mandate single-stock cap is universal, not six distinct archetype-specific caps.

For a multi-stock sector idea, the long-slot limit is 40% except where the 33⅓% sector cap binds. Existing exposure in other slots reduces all remaining headroom. No archetype has a permanently fixed “first binding limit.” The binding limit depends on the whole book at the decision time. Return all binding constraints and the permitted maximum size, rather than implying the first gate failure is the only reason.

Other conflicts:
- Three ideas of eight different stocks require 24 positions. The current maximum is 15 (api/_utils/mandateConfig.js:53).
- The prompt asks the manager to build toward five holdings, even while slots sit empty by design (api/_utils/mandatePromptAssembly.js:84).
- The existing cadence varies by archetype, while V6 specifies two checks for everyone (api/_utils/mandateGenerationConfig.js:47, api/_utils/mandateSessionSlots.js:43).
Replacement clause:
Every entry and add satisfies the remaining sleeve allowance, aggregate ticker and sector limits, book cash floor, position-count limit and price-line risk limit. Caps use the named valuation basis and include costs and reservations. The manager sees effective headroom, remaining slot time and all applicable constraints. Cash is a valid allocation. The idea-book cadence is pinned explicitly.

Define whether price appreciation above a cap causes a trim or merely blocks further purchases. “Tight,” “moderate” and “wide” are not executable widths. Define versioned numeric constraints or remove those labels from enforcement. No width should follow from horizon alone without an explicit archetype policy.
C6-03. Replace the hedge arithmetic before implementing it
Severity: blocks T1. Answers C.

Evidence: V6:65 and :89 define risk as allocation times distance to a line and claim cash or one inverse fund brings it below 8%. Existing position records lack the line and its semantics (api/_utils/mandateSchema.js:76). The Charter explicitly requires protection-value accounting and evaluation of tails for risk rules (docs/AGENT_LEARNING_CHARTER_V1.md:41).

First define the units. One useful descriptive measure for long positions is:

remaining marked loss to lines = Σ shares × max(current mark − price line, 0)

Divide by current marked book equity to obtain a fraction. This differs from loss relative to original entry. Preserve both if the product needs both. Add the specified exit-cost estimate separately. A line already breached requires its own state, not a reassuring zero-risk display.

This sum assumes exits at the named lines. It is not a maximum loss. V6 defines some conditions on completed closes, so recognition and the next eligible fill occur later. A price gap or missing observation changes the realized loss. The risk label must state this assumption.

An event-based condition with no price line contributes unquantified, never zero. For the first release, require an additional executable price-risk boundary for every admitted position. Keep event interpretation observational until a typed event source and adjudicator exist. For baskets, specify a line for each holding or an explicit sleeve-value condition with its own arithmetic.

An inverse fund has no defined negative contribution to this sum. A broad index hedge does not necessarily offset a sector or stock-specific decline. Buying it consumes cash and introduces a separate exposure. Most inverse ETFs target daily performance, so their multi-session behavior is not a fixed negative copy of the index. Source: SEC investor bulletin on leveraged and inverse ETFs.

Recommended replacement:
Release 1 enforces the configured gross price-line risk budget by limiting new exposure and reducing existing exposure under a frozen policy. Cash is the unallocated balance, not a credit against risk. No inverse-fund position reduces this budget. A later offset experiment defines its instrument, scenarios, sizing, reset policy, comparison and evaluation before activation.

An ETF also needs explicit asset-class handling. The current friction model uses issuer market-cap tiers and treats unknown market cap conservatively (api/_utils/mandateFrictionModel.js:29). The sector gate refuses unclassified entries (api/_utils/mandateSectorCap.js:54). Split and dividend machinery is reusable, including reverse splits, but ticker-change and delisting feeds are incomplete (api/_utils/mandateCorporateActions.js:8, :66). None proves ETF qualification. Include fund prices, asset classification and corporate actions in the same completeness checks as holdings and comparisons.

Delete the automatic three-month scrap rule in V6:93. A quiet period often makes protection look expensive. Pre-register a matched no-offset comparison and report net return, drawdown, tail losses, exposure and offset costs. Distinguish protection from favorable timing. Keep the result inconclusive when risk events are absent. An automatic removal rule based on net cost alone conflicts with the Charter's protection-value requirement.
C6-04. Automatic entry needs more than a shape check
Severity: blocks T1. Answers D.

Evidence: V6:82 and :221 call the shape test the only gate. The existing execution gate also checks data, corporate-action state, cash, concentration and position count (api/_utils/mandateGate.js:96). The Charter reserves outcome arithmetic for deterministic code (docs/AGENT_LEARNING_CHARTER_V1.md:27).

The model should originate the proposal and explain the mechanism. Code should validate the contract and enforce execution. A second model's agreement does not substitute for evidence.
Proposed check	Deterministic part	What remains judgment or unsupported
Thesis	Present, bounded text, author and source references	Plausibility and causal explanation
Horizon	Supported enum, trading calendar, fixed start and due session	Whether the mechanism fits the horizon
Names	Normalized symbols, approved membership, data completeness	Whether the names express the proposed exposure
Comparison	Supported type, exact identifier, weights, prices and cost policy	Subject suitability unless chosen from a reviewed mapping
Wrong-if condition	Typed operator, threshold, observation basis, due time	Freeform thesis/event adjudication
Allocation	Atomic reservations and all executable limits	Model's preferred sizing within those limits


Replace “shape test is the only gate” with:
No per-idea player approval is required. Automatic entry requires a supported typed contract, authorized sources, resolved comparison, sufficient data, reserved capital and all execution gates. Unsupported conditions remain considered proposals. An agent explanation never authorizes an unimplemented evaluator or writes its own outcome.

Keep source text as evidence, not executable instructions. Store the model's suggestion, deterministic acceptance/refusal, missing fields and version separately. A malformed or unsupported draft remains visible with its reason. Bound retries and failed-refill spending.

Specific standing-text amendments:
- Shared contract V1 §7.1–2 currently excludes every pre-install ledger entry from every model prompt (docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:107). V2 must name a narrow exception for the owner-scoped Practice Field drafting/manager paths. Deployed battle, draft, memory and consolidation paths remain excluded.
- V1 §5 menus-only authorship at :91 becomes typed agent proposals plus deterministic validation. Free text describes a proposal but does not define executable behavior.
- The founder's 10 October “player picks the moment” ruling becomes optional nomination of a source, not mandatory approval of every book idea (docs/design/20261010_FOUNDER_RULING_SHEET_PRACTICE_FIELD_V1_1.md:43).
- Amendment A's principle about agreement not constituting evidence still stands. The removal of player entry approval changes workflow, not the evidence standard.
C6-05. Source access needs provenance, bounded retrieval and a prompt contract
Severity: blocks T1. Answers E.

The stores exist. A safe drafting reader does not yet follow merely from those stores. Server Admin SDK access bypasses client rules. The new reader must enforce owner, attribution agent, source-time archetype and allowed fields itself.
Source	Verified location and ownership evidence	Drafting and retention treatment
SignalDrop	users/{uid}/signalDrops/{dropId}. Writer: api/forge/parse-signal.js:210, :342. Owner-read rule: firestore.rules:141.	The record contains user identity but no creation-time archetype binding. Do not assign old drops to the current archetype by inference. Require an explicit source-to-instance assignment or a verified downstream association. The six-hour expiry applies to the global cache at parse-signal.js:329, not to the user's drop record.
Game moments	agentBattles/{battleId} and …/tape/{etDate}/series/{symbol}. Owner rules: firestore.rules:470, :538. Tape path: src/constants/filmTape.js:15.	Use bounded recorded facts and source-time archetype/game identity. Preserve score domain and observation time. Do not send an entire battle document, opponent material or unrelated player identifiers. Tape support is not universal across game modes.
Agent conversations	Battle chatExchanges, written from api/agent/chat.js:1098, with owner and battle-agent checks at :479, :499. Workshop sessions at api/forge/workshop-chat.js:278, owned at :290.	Select bounded user/agent text and evidence. Exclude scratchpads, provider metadata, unrelated directives and identifiers. Workshop session creation records userId and agentId, but no archetype snapshot at :302. Historical attribution must be verified rather than inferred from the agent's current state.
Film Room cards	agents/{agentId}/plays/{entryId}. Card writer stores owner, agent, archetype and source at api/_utils/filmRoom/cardStore.js:175. Read rule: firestore.rules:462.	Preserve attribution through the existing casual-clone resolver. Read under the new, explicit pre-install Practice Field exception. Keep shelving distinct from a running idea's settlement.
Completed book ideas	Proposed by V6:142. The existing Mandate schema has no idea subledger.	New owner-and-instance-scoped store. Retain frozen verdict evidence, including losses, refusals and inconclusive attempts. No shared-KB publication.


No end-to-end retention guarantee for all these sources was found in the inspected writers. The old 120-day fresh-drill limit is an eligibility window, not a deletion promise (docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:96). Mandate snapshots expire after 120 days while its core records are retained indefinitely (api/_utils/mandateConfig.js:295).

V6:142 says the idea duplicates none of its sources, while :145 requires reproducibility beyond source retention. Preserve references plus a bounded immutable evidence packet used for the decision and verdict. This is a reproducibility snapshot, not another mutable source of truth. Define access, deletion behavior and retention explicitly. A hash alone does not recreate expired content.

Proposed drafting envelope, to measure before activation: roughly 1,500–2,000 tokens of identity/schema/methods, up to 3,000 of selected sources, up to 1,500 of prior outcomes, and 1,000–1,500 output tokens for up to three structured drafts. These are design budgets, not measured usage. No full chat histories, screenshots or raw account identifiers by default. Use opaque local source labels and resolve them server-side.

Cost should follow measured token counts and the pinned seat's rates: input cost + output cost + cache charges + retries. V6's $0.10 at eight refills allows $0.0125 per refill. Producing three drafts in one call is not three separately billed calls. The existing manager seat has a 600-token output ceiling (api/_utils/mandateGenerationConfig.js:25), so drafting needs its own reviewed envelope.

Add the drafting assembler and its contributors to the Mandate honesty registry and extend its sweep to cover that assembler. The current registry only names manager assembly, context and decision tool (api/_utils/__fixtures__/mandatePromptRegistry.js:18). Its closed input list at :47 must explicitly gain the bounded source, experience and KB packet inputs. Do not add Practice Field prose to a battle prompt under this task.
C6-06. Separate economic results, thesis evidence and process quality
Severity: blocks T1. Answers F and the central vision question.

Evidence: V6:74–76 makes relative performance sufficient for validation and underperformance sufficient for invalidation. V6:11 also says the agent judges. The Charter instead distinguishes policy-level evidence from individual trades and makes outcomes deterministic (docs/AGENT_LEARNING_CHARTER_V1.md:27, :33).

Example: a utilities basket beats its fund while the stated data-center demand event never occurs. The financial result is positive. The proposed mechanism remains unverified. A different idea hits its protective line, exits correctly and avoids a larger decline. Its price condition failed, but its risk process worked.

Recommended record:
Dimension	Example states
Contract condition	met / breached / unobserved
Relative economic result	ahead / behind / within band / unmeasurable
Process quality	followed plan / deviated / blocked by data or execution
Evidence scope	single forward observation / repeated comparable observations / controlled experiment
Adoption	no offer / offered / accepted / expired / retired


Prefer “ahead,” “behind” and “inconclusive” as the main result labels. If the founder keeps “validated,” render the narrower “contract conditions met in this run” and never apply it to the causal explanation or strategy as a whole. Do not automatically classify a small negative gap inside the no-difference band as invalidated. A line breach and an incomplete economic result should coexist rather than overwrite one another.

Define the band against each idea's frozen initial capital, not the book's starting $100,000 or current fluctuating value. Example: a $20,000 sleeve has a $50 band at 0.25%. A book-based $250 band would represent 1.25% of this sleeve but 0.625% of a $40,000 sleeve. That changes the standard by horizon. Freeze the band version before entry.

A passive comparison needs its own quantities, residual cash, execution costs, cash distributions, split treatment, marks and quality receipts. Existing friction and corporate-action functions supply reusable calculations, not an existing passive-sleeve service (api/_utils/mandateFrictionModel.js:44, api/_utils/mandateCorporateActions.js:16). Fixed shares change for splits. Apply distributions once. Do not subtract a fund expense a second time if already embedded in observed prices.

For a single stock, identical entry quantities and no active changes should tie its passive comparator under the same cost treatment. This comparison tests management, not whether selecting the stock was insightful. Label the comparison's question. Sector or broad-market context answers a different question.

Define the evaluation clock, completed-session basis, missing-data precedence and post-breach mark explicitly. V6's first-eligible-observation rule remains correct. The current exit path permits carry-over marks (api/_utils/mandateGate.js:71), and the snapshot builder substitutes receipt time when the upstream timestamp is absent (api/_utils/mandateUniverseSnapshot.js:150). Those fallbacks must not qualify as fresh, post-decision fills for a full-quality verdict. T1c needs code and acceptance cases for this already-agreed rule.
C6-07. Retiring the quarterly product requires a versioned lifecycle
Severity: blocks T1. Answers G.

The engine already carries capital across quarterly boundaries. V6 does not need a new portfolio solely to make capital continuous. It does need a new manager-lifecycle policy.

Evidence: api/_utils/mandateRollover.js:175 conserves capital, but :181 advances the quarter and :187 repins the current manager vintage. Submission validity uses the quarter key (api/_utils/mandateExecution.js:117). The prompt includes days into quarter and quarter drawdown (api/_utils/mandatePromptAssembly.js:145). The escape path creates a fresh-capital replacement (api/_utils/mandateEscape.js:136). These behaviors are not equivalent to a never-ending book with frozen active ideas.

Replacement clause:
The idea book is a new versioned Mandate product kind. Existing capital, money arithmetic, ownership and idempotency components remain reusable. Quarterly repinning and fresh-capital escape do not apply to this kind. A manager epoch preserves stale-submission protection. Active ideas retain their manager and contract versions through settlement. Reporting windows do not reset capital, rewrite evidence or repin an active manager.

Define the manager-upgrade policy. “Frozen forever” leaves model retirement and fixes unresolved. Pin each idea to an epoch, drain active ideas or use an explicit migration policy before adopting a new epoch, and preserve lineage. The 60-session horizon starting in November also makes maintained trading-calendar coverage a first-release requirement (api/_utils/mandateSessionSlots.js:79).

Add a dated supersession appendix to Spec 1's runbook and acceptance report. Keep previous evidence intact. The acceptance report is still marked accumulating and distinguishes harness tests from pending live acceptance (docs/audits/MANDATE_ACCEPTANCE_REPORT_V1.md:3). Its $10M, rollover and escape tests do not certify the new $100K, multi-idea behavior. Define a new acceptance matrix and operating procedure rather than saying the old harness stays unchanged. The old runbook also directs a live direct/batch exercise (docs/MANDATE_RUNBOOK.md:21), while this pilot selects direct transport.
C6-08. Pin the Practice Field manager independently of game loadouts
Severity: blocks T1 for ownership and handover. Answers H.

A pinned manager differing from the current game archetype is structurally compatible with the Mandate assembler, which receives its vintage as data (api/_utils/mandatePromptAssembly.js:60). The new transition still needs implementation. Automatic quarterly repinning must not replace the manager during draining.

There is also no universally singular “current archetype” in the supported app design. With per-game loadouts enabled, the card store treats either game's archetype as active (api/_utils/filmRoom/cardStore.js:50). V6:133 must specify which explicit Practice Field manager assignment changes the book. Switching a game loadout should not implicitly move the book's ownership.

Replacement clause:
A book has an explicit owner uid, attribution agent instance, archetype identity/version and manager epoch. Game loadout changes do not implicitly transfer it. On a Practice Field manager switch, the old book stops refilling. It continues required management and settlement under its original pin. Once all ideas and exit receipts settle, one atomic handover transfers remaining cash and opens the new epoch. Old experience remains readable to the player and its originating archetype only.

Clarify whether “no new entries” also forbids adds to existing positions during drain. Recommended pilot rule: no new risk, with reductions and settlement still permitted. Transfer cash only after positions and pending fills resolve. Do not reset it to $100,000.

Card shelving currently excludes cards from active counts and blocks stage transitions (api/_utils/filmRoom/cardStore.js:157, :309). A running old-archetype idea must still settle and append its tested receipt. Add a narrow server transition bound to the original run and owner, even if the card is shelved. This exception does not permit adoption by the new archetype. Separate “active card count” from actual running-book capacity.
C6-09. Reserve symbol capacity before entry, and describe the existing cap accurately
Severity: blocks T1. Answers I.

Evidence: V6:173 calls 300 a hard shared-list cap. api/_utils/mandateUniverseSnapshot.js:71 deliberately includes every held ticker even beyond the cap. Candidates fill remaining capacity at :91. A held position is not silently dropped, but candidate coverage shrinks and total acquisition exceeds the nominal cap.

There is no fixed player count for exhaustion. At V6's proposed maximum, 13 players with 24 disjoint stock holdings already require 312 stocks before comparison funds. If several comparison funds are unique, the boundary arrives earlier. If players use the same names, it arrives later. The current 15-position gate would stop the proposed 24-name book first, which is a separate inconsistency, not a capacity solution.

Replacement clause:
The pilot reserves data coverage for all held names, active and pending idea names, passive comparisons and any offset. New admissions use the authoritative membership version and a transactionally reserved budget. Held coverage remains protected. If the reserved universe or candidate-coverage floor would breach budget, new admission fails visibly. Mandatory valuation and settlement are not silently excluded.

The draft's shape test does not currently know a live, authoritative reserved-list size. Add this input and recheck at reservation and execution. Same-session racing refills need one capacity authority. Existing health checks require a minimum candidate population (api/_utils/mandateConfig.js:89). Raising the symbol count alone is not the complete solution.

T5 retains large-scale expansion. T1 needs accurate membership and reservation from its first book, including the session-before-entry rule. A founder cap of four books is useful but does not replace coverage accounting.
C6-10. Distinguish an offered source from an accepted experiment
Severity: blocks T1 for the run contract. Reader and nomination integration belong to T2. Answers J.

V6:150 changes “send to test” into “offer to the agent.” Good direction. The agent must remain free to refuse a weak idea without making the user think it ran.

Use a nomination record separate from the card's lifecycle:

queued → considered → accepted | deferred | declined | expired

Store the reason and proposal/run reference. A queued nomination is not testing. A selected draft awaiting capital or data is not testing. Set testing at the first executed fill, with the run-start definition frozen. Set tested at a terminal result, including an inconclusive result. A failed draft never becomes tested. Use a separate adoption state for a later Forge offer.

Existing readers need coordinated changes:
- api/_utils/filmRoom/cardStore.js:63 knows only card, nominated and retired. :65 counts card and nominated as open.
- src/screens/filmRoomV2/FilmRoomCardRegions.jsx:80 has its own open-stage list.
- src/screens/filmRoomV2/filmRoomCopy.js:372 has the existing labels.
- src/screens/filmRoomV2/filmRoomCards.js:162 routes other stages separately.
Adding database strings alone would produce inconsistent counts and presentation. Version the shared vocabulary and migrate readers without rewriting historical stage history. Preserve parked/shelved distinctions. Give never-selected nominations an explicit expiry or disposition. Waiting forever behind an apparently active card is not useful feedback.
C6-11. Preserve the learning architecture and close the policy wording gaps
Severity: text edit, with ownership, prompt and adoption enforcement in T1/T3. Answers K.

First, revise V6:135:
Release 1 uses the originating archetype's private observations to propose subsequent ideas. This is experience-informed adaptation. It does not change model weights, establish a repeatable advantage, or automatically install a deployed-agent policy. Economic outcomes and explanatory hypotheses remain separate.

Second, revise V6:11:
The agent proposes, manages within enforced limits, and explains. Deterministic evaluators settle supported conditions and economic results. Unsupported interpretations remain explicitly unverified.

Third, preserve the original strategy research path:
A portfolio idea and a strategy-change proposal are different artifact types. A completed idea or Film Room observation might motivate a new allocation rule, indicator, entry filter or risk policy. Such a proposal receives a candidate version, baseline, required inputs and test plan. Unsupported calculations go through offline implementation and validation before a Practice Field comparison. A branch book does not skip development/confirmation separation.

This keeps the shallow-pullback work relevant. The live idea book is not evidence that the proposed retracement filter improves outcomes. It supplies future observations and questions for that work.

Fourth, revise Forge eligibility. V6:152 sends only validated ideas to Forge. A winning historical stock list is not necessarily timely or appropriate for the next game's objective. Add current applicability, owner/archetype compatibility, intended horizon, expiry, exact version and supported install target. Label an adopted idea as a player instruction. A risk-management observation worth testing is not discarded solely because its portfolio lost money. Failures and inconclusive runs remain available for follow-up proposal generation, not automatic installation.

The user-facing offer should identify whether it changes a stock list, an idea instruction, a setting or a rule version. Retiring an offer does not erase its evidence. Current Growth Loop vocabulary reserves “idea” for the player's versioned thesis and separates the agent's recorded rationale (docs/design/20261028_GROWTH_LOOP_MAP_V1_2.md:87). V2 needs explicit author/origin and adoption fields so an agent-authored proposal never masquerades as a prior player belief. Reuse the existing next-battle freeze boundary, not a running-battle write.

Fifth, the Charter remains binding. Its prohibition on per-user market-alpha promotion stands (docs/AGENT_LEARNING_CHARTER_V1.md:22). Its older platform-level cross-user aggregation language at :45 does not authorize exporting this private experience. V2 should explicitly state the book's exclusion. The immediate build needs a reconciled scope addendum, not a broad loosening of the Charter.

Sixth, qualify code-state assertions. Replace V6:17, :25 and :181 claims about “switched on, never run/no book ever created” with “reported by the prior operational audit, not independently verified in this review.” The source proves an engine and a one-active-book reservation (api/_utils/mandateCreationService.js:91). It does not prove production history.

Finally, no trade buttons inside the book is consistent with the intended experience. Specify an account-level way to pause new drafting/spend and request a controlled wind-down, outside the book's trading controls. Pausing must preserve evidence and settlement obligations. It should not silently extend idea clocks.
C6-12. Reorder the first build around an end-to-end accounting test
Severity: blocks T0 for the idle-skip condition. blocks T1 for package dependencies. Answers L.

T0a and T0b remain appropriately narrow. T0c lost a necessary qualification: no active book is not sufficient reason to skip all duties if an outstanding provider submission or settlement task still needs disposition. Snapshot building currently scans active books before acquiring data (api/cron/mandate-evaluate.js:287, :664), while open submissions have separate expiration/disposition behavior (:111).

Replace T0c with:
Skip new market-data acquisition only when no active book and no outstanding execution or settlement duty requires it. Continue required cancellation, billing, terminal receipts and cleanup. Recheck each fire. Never create an empty snapshot to mark the slot complete.

T1a is several substantial packages, not one medium feature. T1c's fill semantics and passive comparison must work before any verdict is enabled. T1e's current inverse-offset claim is neither small nor ready.

Recommended order:
1. Adopt the revised contract and explicit rulings. Preserve three horizon slots as the product direction. Settle ownership, verdict dimensions, risk meaning, source permissions and lifecycle before schema implementation.
2. T0a–c. Correct the frozen sector translation, preserve bounded rationale/conviction, and stop truly idle acquisition. No fenced battle-table edit. Version the new Mandate configuration and admission check.
3. T1a-1 plus T1c core. Build book/idea identities, reservations, per-sleeve accounting, inception, post-decision fills, costs, corporate actions and the passive comparison. Use synthetic fixtures first.
4. T1a-2. Build the lifecycle, cutoff recovery, private owner access, retained evidence and deterministic results. Exercise one, then two, then three overlapping ideas. Include same-symbol refusal, simultaneous reservations, drain, gaps, late jobs and restart.
5. T1b plus T1d. Add the frozen agent settings and small KB packet, bounded drafting sources, supported-contract validator, considered queue and refill budget. Record exact model, methods, source versions and effective constraints. Measure which settings affect decisions with controlled input changes. Similar wording alone does not establish behavior parity.
6. Revised T1e. Enforce exposure and quantified price-line limits through sizing and cash. Defer inverse-offset credit to a separately specified experiment.
7. T1f. Open the founder-only three-slot view after an end-to-end synthetic run reconciles. Start with a smaller per-idea name limit if the one-action scheduler has not qualified eight-name sleeves. Keep the target extensible rather than promising 24 active names immediately.
8. T2 and T3. Connect nomination receipts, settlement returns and explicit Forge offers. The core run/result/adoption records exist before these UI links.
9. T4. Compare a candidate against an unchanged baseline in isolated branch books. Common evidence cutoffs, starting capital, opportunity sets, cost policy and evaluation schedule are required. Record all proposals and attempts. Treat shared-date outcomes as correlated evidence.
Two checks with one ticker action each permit only two fills per session. Filling 24 distinct names takes at least 12 sessions before any exits, trims, refusals or offsets. This exceeds a short idea's 10-session horizon. Specify partial entry, entry timeout, review anchoring and priority before promising eight-name ideas in every slot. Automatic risk exits and due settlement also need a deterministic service path. They should not wait indefinitely behind the next discretionary model action.

V6's review cutoff should freeze the evaluated endpoint. A liquidation occurring at the next eligible observation has its own receipt and later price. Retire/refill only after the cash is settled under the specified paper-execution rules. Keep post-cutoff liquidation separate from the performance endpoint rather than fabricating a fill at the close.

Cost controls belong in the first runnable book. The existing prompt budget trims candidates but allows an over-budget scaffold (api/_utils/mandatePromptAssembly.js:169). V6's $3 monthly cap needs a hard admission/spend reservation, retries and unpriced-call handling, plus an honest exhausted-budget state. Mandatory valuation and settlement continue without a new model call.

With full-horizon occupancy, three slots turn over approximately 21/10 + 21/30 + 21/60 = 3.15 times per 21-session month, before startup and early exits. Eight refills is a workload assumption, not a consequence of the three horizons. Empty-slot retries and early line hits need bounds. Measure the real prompt and source-fetch costs before treating $75 for 100 players as an operating forecast.

The first watchable book also needs: a supported calendar through every due date, price/session labels, incomplete-data states, operational pause/wind-down, current-capacity visibility, idempotent restart, source-access tests and a visible distinction between a running observation and a qualified strategy change.
Suggested replacement for the concept's central promise
Your agent develops ideas from your shared activity and its own private experience. The Practice Field follows those ideas in a paper portfolio across several horizons. It records what the agent expected, what it did, what happened, and what remains uncertain. Completed observations inform new proposals. Separate controlled tests evaluate changes to the agent's methods. The Forge presents specific, current changes for your approval before they reach your deployed agent.

This preserves the founder's vision without claiming every portfolio outcome is learning evidence or every historical winner deserves adoption.
Review completion
Reviewed ref: origin/main, detached worktree.

Reviewed HEAD: c37baa0d1cad220d37a41dae312e3d212ff27d4c.

Review worktree: /workspace/scratch/5401326c5241/practice-field-v6-main.

Report path: /workspace/scratch/5401326c5241/practice-field-v6-review/20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V6.md.

Both the review worktree and the original workspace checkout remained clean. The immediate next task is a focused V6 contract revision incorporating C6-01 through C6-12, followed by T0 and the first accounting/comparison package.