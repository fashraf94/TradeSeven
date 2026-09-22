<!-- Provenance: Markdown rendering of FantasyTrades_Framework_Fable_Review_Handover.docx (Astra, 22 September 2026), extracted verbatim for repository commit alongside the Fable review and reconciliation set. On any discrepancy, the original .docx governs. -->

FantasyTrades Agent Framework

Partnership learning and existing capability reuse

Prepared for Fable | 22 September 2026 | Proposed framework for adversarial review

Review the proposed framework for differentiated, personalized trading agents in a virtual competition. Challenge its assumptions, learning claims, ownership boundaries, user experience, and implementation scope. Identify existing functionality worth preserving before recommending new components. This handover includes a review assignment for Fable and a separate, ready-to-use expanded codebase audit brief.

The recommended direction is incremental: preserve the application’s useful ranking, research, identity, execution, interaction, and recording systems. Establish a continuous experience from a user idea through research, discussion, monitoring, competition, and review. Qualify changes to trading behavior against evidence.

# 1 SignalDrop corrects the starting inventory

The founder identifies SignalDrop as an existing, built and tested feature. It lets a user bring an article or tweet to an agent, discuss the idea, and debate whether it supports a trade. Treat SignalDrop as an existing capability and a priority reuse candidate. Do not propose a replacement intake or debate system without tracing its current implementation. [S1]

The earlier audit mentions signal-drop horizon parsing, but it does not establish a complete trace of this user journey. Our earlier synthesis consequently understated existing interaction support. Missing audit coverage does not establish missing functionality. [S2, section E]

The expansion audit must establish SignalDrop’s entry points, content handling, discussion behavior, persistence, tests, mode connections, and limits. Its research-to-trade and research-to-learning connections remain questions for inspection. The founder’s statement of built and tested functionality does not by itself specify deployment configuration or the scope of every test.

## How to use this handover

Fable should review the design using sections 1 through 8 and return the output specified in section 9. The repository auditor should use section 10 after incorporating accepted review corrections. The two assignments produce separate artifacts: a design critique and an evidence-based capability report. Neither assignment authorizes implementation, deletion, migration, or deployment.

# 2 Product objective and responsibility boundaries

FantasyTrades should help a user experience capable research and a distinctive trading partner through fun competition. The user supplies interests, observations, articles, questions, and judgment. The agent undertakes research, evaluates alternatives, monitors conditions, and acts within game authority. The experience should reward useful participation without promising perfect trades or treating engagement as proof of trading skill. [S1, S3]

| **Responsibility** | **Owns** | **Boundary** |
| --- | --- | --- |
| Partnership | Intent, shared hypotheses, discussion, disagreement, preferences, explanations, and visible follow-through. | User enthusiasm influences research attention. Evidence and declared authority govern trading decisions. |
| Trading Brain | Opportunity search, archetype policy, evidence interpretation, setups, portfolio judgment, proposals, waiting, and invalidation. | Proposes actions and evidence-linked reasons. Does not grant itself additional authority. |
| Harness responsibilities | Authorized inputs and tools, execution limits, deterministic verification, records, replay, and qualification. | Existing application code enforces live actions. External Harness Lab work tests and qualifies behavior through defined interfaces. |
| Learning across all three | Proposes, evaluates, versions, retrieves, and retires permitted changes using recorded experience. | Personal memory, temporary context, and trading-policy updates require different acceptance rules. |

These are responsibility boundaries. A separate service or model for each boundary is not assumed. Prefer extensions to existing modules and contracts. The external Harness Controller should run Hermes and Pi as independent peer engines through adapters. Their current external implementation and application connection were outside the inspected audit scope. [S2, section F]

JEV remains a candidate research and judgment component. The audited experiments concern narrow directive interpretation. Any broader role in trading reasoning, evidence review, or learning needs its own comparison against simpler alternatives. Keep hard action authority in verified application controls.

Record the decision’s supporting evidence and declared rationale when the agent proposes the action. Later explanations should use this record and include any rejection, override, or changed state. A fluent retrospective explanation is insufficient evidence of what informed the original decision.

# 3 What the audit supports and what remains open

The audit inspected application commit 1740996d43100a94fa97f9e9958b48c297d2017f. It did not run tests, verify deployed configuration, or establish remote freshness. Its findings are source-scoped leads for adjudication. Newer work with Claude needs an explicit comparison against this baseline. [S2]

| **Existing asset** | **Evidence status** | **Question for expansion audit** |
| --- | --- | --- |
| SignalDrop article and tweet discussion | Founder reports built and tested. Earlier audit covers only a limited aspect. | What survives discussion and reaches watchlists, monitoring, execution, and lessons? |
| Rankings and stock screening | Audit identifies rank engines, screenStocks, scouting, and technical evidence. | Which workflows support broader research and explicit investigation coverage? |
| Forge and saved watchlists | Audit identifies research, themes, thesis fields, commit and equip paths. | Which current records should carry a durable hypothesis across modes? |
| Chat and bounded directives | Audit identifies core-conflict handling, controls, expiry, and explanations. | How do SignalDrop, ordinary chat, and research-only requests share state and authority? |
| Archetypes and mode rules | Audit identifies real differences in weights, turnover, and protective behavior. | Which declarations affect execution, and which still describe intended behavior? |
| Tick capture and learning receipts | Audit identifies substantial evidence and action recording. | Which records reflect decision-visible evidence and which contain later observations? |
| Reflection and consolidation | Audit identifies automated persistent influence on future prompts. | Which lessons are proposed, accepted, scoped, reversible, and evaluated? |
| Managed Mandate | Audit identifies snapshot, vintage, accounting, and execution contracts. | Which research, interaction, and learning contracts transfer without changing mode semantics? |

Preserve the prior findings as a register. G01 concerns alternate approval paths, G02 guardrail scheduling, G03 Mandate sector-cap units, and G04 decision-time evidence. G06, G09, and G10 concern hypothesis continuity, joined decision records, and learning qualification. Verify the narrow ADD candidate-slate conflict in G11 separately from broader Mandate enrichment. [S2]

Distinguish an absent capability from an incomplete connection, a disabled feature, stale documentation, a mode limitation, or incomplete evidence. Existing test coverage is valuable, but its exact target and current execution result need separate labels.

# 4 First complete user experience

The proposed first product milestone joins SignalDrop or another existing idea entry point to bounded research, a small shortlist, discussion, persistent monitoring, and review. Start with one archetype and one supported game mode. The earlier flat-six advisory Trend Follower pilot remains a candidate qualification setting, subject to review and the expanded audit.

1. Receive the idea. Reuse SignalDrop for the article or tweet journey where its implementation fits. Preserve the user’s observation, original source, publication time, and intended horizon. Keep quoted source claims distinct from verified evidence.

2. Frame the research. The agent translates the interest into a testable hypothesis. It identifies relevant instruments, the archetype’s decision criteria, the available evidence, and an agreed research scope. Ask a short question only when the missing answer changes the work.

3. Research broadly and investigate selectively. An illustrative run screens 50 eligible stocks, examines a smaller set in depth, and returns up to three supported choices. The counts are a product example, not an existing capability claim or a requirement to fill three slots.

4. Discuss the shortlist. Explain archetype fit, supporting evidence, the strongest objection, missing information, and conditions for further attention or rejection. Let the user compare, challenge, or deepen a thesis. Independent user research remains optional.

5. Track the same idea. Preserve its identity through watchlist, monitoring, deployment, and later discussions. Show a meaningful state such as investigating, awaiting confirmation, rejected, expired, or linked to an authorized action. Follow the actual mode’s allowed actions.

6. Review the result. Reconstruct what the agent knew, what the user contributed, what changed, and what happened. Separate outcome reporting from the decision to change future behavior.

The experience should communicate real work: how many stocks were screened, which received deeper research, which lacked data, and why the selected ideas survived. Favor batch screening, shared evidence, caching with explicit freshness, and bounded deeper research before proposing one model call per stock.

Discussion remains useful even when no trade follows. A rejected thesis, a well-supported wait, or a clearer comparison should feel complete. Do not pressure the agent to manufacture a trade to demonstrate activity.

# 5 Shared state personalization and user influence

The central proposal is durable continuity across existing features. Reuse current records wherever they support the needed meaning. The following are conceptual contracts for audit and review, not instructions to create new database collections.

| **Record or state** | **Minimum meaning** | **Change rule** |
| --- | --- | --- |
| Archetype core | Versioned philosophy, setup rules, evidence priorities, risk limits, and permitted adaptation. | Controlled release or qualified policy change. Preserve identity across user interactions. |
| Personal preferences | User interests, explanation choices, research priorities, and permitted horizon preferences. | Inspectable, correctable, and removable by the user. Keep ownership and scope explicit. |
| Hypothesis | Origin, source claim, horizon, evidence, contradictions, conditions, status, and expiry. | Update when evidence or explicit user intent changes. Preserve prior state and provenance. |
| Research record | Universe, screening criteria, coverage, missing evidence, comparisons, and selection reasons. | Bounded work with clear completion and failure states. Link to the same hypothesis. |
| Decision episode | Evidence available at decision time, policy and state versions, proposal, verification, action or rejection. | Append a traceable result. Distinguish later observations from original inputs. |
| Candidate lesson | Proposed future behavior, supporting episodes, applicability, counterevidence, and evaluation result. | Promote, revise, reject, or retire under the appropriate learning policy. |

Give a user idea explicit consideration and greater research priority within declared budgets. Verified user observations influence factual assessment. Enthusiasm, repeated requests, or positive feedback do not automatically increase evidence strength. A change in execution authority requires a separate product rule.

User-visible memory should distinguish an expressed preference from an inferred preference. Define correction, deletion, expiry, retrieval relevance, and conflict handling. Do not silently promote one user’s conversation into another user’s memory or into a shared archetype update.

For rated competition, specify which policy and accepted-learning versions remain fixed during a match and which user inputs remain permitted. Personalization, fairness, and reproducible comparison need compatible rules. This is an open design decision.

# 6 Realistic learning and the moving baseline

The audited application saves reflections and lessons which influence future prompts. This establishes a mechanism for adaptation. It does not establish improved trading skill or continuous training of model weights. [S2, sections E and G10]

| **Learning objective** | **Realistic outcome** | **Evidence required** |
| --- | --- | --- |
| User familiarity | Accurate recall of relevant interests and unresolved discussions. | Fewer repeated instructions, correct scope, and successful user correction. |
| Research discipline | More complete evidence, fewer unsupported claims, and better contradiction checks. | Comparable tasks, fixed budgets, unseen cases, and quality checks independent of user approval. |
| Archetype execution | More consistent setup, waiting, and invalidation behavior. | Versioned policy cases, correct exceptions, and retained performance on earlier capabilities. |
| Competitive performance | Better game results within declared constraints. | Repeated baseline comparisons, uncertainty, risk and turnover measures, and prospective evidence. |
| Capability expansion | A new setup, data source, or interaction becomes available. | Qualification of the added capability. Do not label expanded scope as improvement on an unchanged task. |

A single profitable trade does not validate a method. A losing trade does not establish a process failure. Examine the original evidence, decision policy, permitted alternatives, and actual execution. Avoid outcome-driven rules such as abandoning a setup after one loss.

Version the archetype definition, model, evidence tools, accepted memory, game rules, and evaluator. Keep a fixed comparison set for retained capabilities and add separate cases for new capabilities. Compare proposed lessons with a frozen baseline under equivalent information and budgets. Separate model upgrades, new data, new policy, and memory effects.

Reserve cases from lesson generation and tuning. Keep future outcomes out of decision inputs and decision-quality review. Use prospective testing to address hindsight and historical contamination. Repeated use of the same benchmark creates a further overfitting risk, so qualification needs held-out and later cases.

Track user value, process quality, archetype consistency, game outcomes, and operating cost separately. Fun competition remains a product goal. Conversation satisfaction, trading volume, and an agent’s self-reported confidence are insufficient measures of learning.

Research on reflective memory demonstrates gains on some benchmark tasks without weight updates. It does not establish market prediction skill or validate this application’s learning loop. [S4]

# 7 Proposed learning lifecycle and judge role

1. Capture. Save the decision-visible evidence, policy, user contribution, action proposal, checks, and final result. Label later evidence and later outcomes separately.

2. Classify the update. Distinguish a personal preference, temporary market observation, operational defect, candidate trading lesson, or proposed core-policy revision. Use the simplest valid treatment.

3. Propose a bounded lesson. State the specific future behavior, conditions of use, supporting cases, counterexamples, expected benefit, and expiry or review trigger. Preserve the source records.

4. Evaluate. Compare the baseline and proposed change on reserved cases. Check rule adherence, evidence support, archetype consistency, preserved capabilities, latency, and cost. Assess game outcomes separately.

5. Promote under authority. Define which low-impact preferences update directly, which policy changes need review, and who owns promotion. Record the accepted version and its scope. Do not make an unqualified reflection persistent trading authority.

6. Monitor and reverse. Retain the previous accepted state, identify regressions, and provide withdrawal or rollback. A historical lesson remains a historical record even after retirement.

A missing-data bug or bypassed safety check belongs in application remediation. A memory note should not compensate for defective deterministic controls. Similarly, current market state should expire or roll forward under explicit rules instead of becoming permanent trading advice.

## Where JEV belongs initially

Potential roles include evidence-support review, archetype consistency, lesson classification, and failure triage. Start with an offline, labeled evaluation only if it addresses a measured need. Judge agreement, false acceptance, false rejection, and cost against simpler checks and independent review.

Keep the judge separate from hard action authority and final lesson-promotion policy. Model judges have documented biases, including sensitivity to ordering and verbosity. Their outputs require their own qualification. A judge’s positive assessment is not proof of a profitable strategy. [S5]

## Required observable outcomes

Personalization improves relevance while preserving the archetype’s declared constraints.

An unsupported lesson fails promotion even when its explanation sounds persuasive.

A lesson which improves one scenario but breaks an existing rule fails qualification.

Retired memory stops influencing new decisions within its declared removal semantics.

The same original episode remains reconstructable after policies and memories change.

# 8 Proposed sequence and preservation rules

Accept the broad product direction while leaving implementation choices open to challenge. The broader audit should precede final data-contract design and component replacement. Verification of the earlier control findings remains a separate, bounded work item. Designing a research experience does not require waiting for every live trading change.

1. Fable reviews this framework and the proposed audit scope. Resolve overclaims, unclear learning objectives, conflicting ownership, and unnecessary infrastructure.

2. Run the expanded capability audit in section 10. Inventory reusable features and complete user journeys across research, partnership, competition, and learning. Preserve the prior findings and identify baseline changes.

3. Adjudicate the evidence. Decide reuse, extend, connect, consolidate, defer, or build. Resolve product questions before assigning implementation tasks.

4. Write a small architecture amendment and pilot scope. Select the existing intake and state contracts, one archetype, one mode, one research journey, and one setup. Make acceptance and rollback explicit.

5. Build the bounded advisory experience and qualify it. Use existing components where justified, freeze trading-policy learning for comparison, and keep permitted personal preferences distinct.

6. Extend into authorized game execution after relevant control and evidence issues pass verification. Add qualified learning progressively. Broader archetype coverage and JEV integration follow demonstrated need.

No deletion follows merely from a component looking old, complex, duplicated, or absent from the previous report. Before removing or replacing anything, require its callers and users, data ownership, test coverage, intended replacement, migration impact, and rollback path. Keep original evidence and historical records intact.

This document authorizes review preparation only. Later implementation tasks need explicit scope and their own branches. Only the owner merges to main or master. Existing guardrails and approved repository instructions remain in force.

## Decisions to leave open for review

Which existing SignalDrop, Forge, watchlist, or Vision record should own the shared hypothesis?

Which interactions belong in the first complete journey and which remain available but outside pilot qualification?

What does each archetype improve at within a fixed version, and which changes count as a new version?

Which learning updates are personal, archetype-wide, temporary, or prohibited from automatic promotion?

How do long-horizon ideas relate to short games, and what happens at game completion?

Which user inputs and learned-state changes remain permitted during rated competition?

What evidence, latency, cost, retention, and monitoring limits define an acceptable first experience?

# 9 Fable adversarial review assignment

Review this framework adversarially. Find contradictions, unsupported claims, responsibility gaps, unnecessary complexity, and unsafe transitions. Rank by consequence. Do not implement changes or assume codebase access.

Distinguish founder statements, prior audit observations, and proposals. SignalDrop is founder-reported as built and tested. Challenge its integration assumptions without treating uninspected functionality as absent.

## Questions to attack

1. Does the first journey demonstrate agent capability and preserve creativity without burdening the user with research?

2. Does it duplicate SignalDrop, Forge, watchlists, research tools, Vision, receipts, or existing learning?

3. Are Partnership, Brain, operational enforcement, external Harness Lab, and learning responsibilities clear and complete?

4. Does user influence preserve independent judgment? Where might research priority become belief, permission, or an order?

5. Are hypotheses, preferences, accepted lessons, and archetype core distinct in lifetime, ownership, retrieval, and deletion?

6. Is learning measurable against a fixed baseline? What falsifies improvement? What counts as capability expansion?

7. Do lessons, evaluator feedback, or historical cases leak outcomes into qualification or mistake correlation for causal improvement?

8. What happens when evidence is missing, research fails, discussion changes state, or a proposed action becomes stale?

9. Does ingestion preserve provenance and treat article instructions as untrusted content? How are failed access and partial sources handled?

10. Do game duration, fixed-slot actions, user horizons, and rated-competition rules conflict with the experience?

11. Would JEV add qualified value? Where is deterministic code required, and where would a judge introduce circular evaluation?

12. Will the audit discover capabilities outside the trading path while remaining bounded enough to conclude?

## Required output

Open with one verdict: ready for expanded audit, ready after specified revisions, or not ready. Give each finding an ID, severity, document section, evidence status, plausible failure example, consequence, smallest correction, and proposed owner. Separate design defects, factual corrections, audit questions, and founder decisions. Identify valuable existing work to preserve. Finish with necessary changes to the audit brief and the smallest defensible pilot after audit. Do not demand perfect trading performance as an acceptance condition.

Name missing evidence and affected claims. Do not invent code behavior, test results, deployment status, or delivery estimates. Design review does not qualify the running application.

# 10 Expanded capability and reuse audit prompt

Copy this entire section into a new repository audit task after incorporating accepted Fable corrections. The prompt is self-contained. The prior architecture report and this framework provide comparison material, not permission to change application behavior.

## Mission and authority

Perform a broad, discovery-only capability and reuse audit of FantasyTrades. Establish which existing features and structures support a continuous personalized agent experience from user idea through research, debate, monitoring, virtual competition, explanation, and qualified learning. Identify the smallest justified additions and connections. Stop after the report. Do not remediate findings or implement the framework.

The founder reports SignalDrop is built and tested and already accepts an article or tweet for discussion and debate with an agent. Include it in the starting inventory. Verify its implementation, test coverage, and integration boundaries. Do not classify it as missing because an earlier trade-path audit did not fully trace it.

Read applicable AGENTS.md, discovery instructions, approved scope rules, documentation indexes, and status markers first. Use a dedicated task branch under repository rules, preferably codex/partnership-learning-reuse-audit. Preserve all existing work. Branch setup is the only permitted Git mutation. Do not edit repository files, install dependencies, change flags, migrate data, regenerate indexes, commit, push, merge, create a PR, deploy, or delete anything. Only the owner merges to main or master.

Return the report in your response or an artifact outside the repository. Inspect tests as source. Run only existing, isolated offline tests after verifying they require no external credentials, paid calls, live writes, installation, or repository changes. Direct optional caches and artifacts outside the repository. If those conditions are not established, report test source evidence and leave execution unverified. Do not add tests or production patches during this audit.

Do not read secrets, private conversations, production user records, or private runtime data. Use source, schemas, fixtures, approved documentation, and safe local evidence. If access is blocked, complete permitted inspection and record the precise limitation. Do not bypass an approval rejection or modify instructions to obtain access.

## Target experience and constraints

The product is a virtual trading competition with differentiated archetypes: Trend Follower, Contrarian, Speculator, Fundamental Investor, Diversifier, and Capital Preserver. Users contribute observations, articles, themes, questions, and judgment. Agents research, compare, explain, monitor, and propose or execute actions within declared game authority.

A candidate first experience lets a user bring an idea, receive broad screening and deeper research, discuss up to three supported opportunities, track a hypothesis, and review the eventual decision and outcome. Screening 50 names and presenting three is illustrative. Report actual coverage and permit fewer supported ideas. User ideas receive consideration without becoming mandatory trades.

Preserve ranks as useful evidence. Keep archetype core, personal preferences, temporary context, and accepted trading lessons distinct. Define Partnership, Brain, and Harness as responsibilities without assuming new services or models. Existing application controls own live enforcement. External Harness Lab, Hermes, Pi, and JEV interfaces require independent evidence. Keep Hermes and Pi as peer engines.

## Baseline and evidence discipline

Record repository, branch, commit, local changes, inspected areas, and any verified remote or deployment relationship. Compare with prior audit commit 1740996d43100a94fa97f9e9958b48c297d2017f when available. Identify relevant newer changes and unresolved findings. Never label an unverified checkout current main or deployed production.

For each material claim, cite files, symbols, callers, schema fields, flags, and relevant tests. Separate observed source behavior, executed tests, inspected test source, approved documentation, founder statements, inference, and unverified runtime facts. Record test command, environment, scope, and result if executed. A passing isolated test does not establish end-to-end operation.

Search by user behavior as well as feature name. Trace UI routes, commands, API endpoints, jobs, schemas, writers, readers, permissions, prompts, fixtures, feature flags, and documentation. Follow aliases and mode variants. Classify each capability as reachable in inspected conditions, gated, experimental, superseded, orphaned, externally owned, or unverified. State search bounds for absence claims.

## Required inspection coverage

1. SignalDrop. Trace article, tweet, link, and pasted-content intake wherever supported. Inspect retrieval or extraction, failure and partial-content handling, source snapshots and dates, claim attribution, conversation and debate, horizon handling, persistence, and tests. Identify every downstream consumer. Verify whether ideas reach watchlists, directives, monitoring, decisions, game deployment, review, and learning. Inspect ingestion trust boundaries without fetching live private content.

2. Other interaction and research surfaces. Trace ordinary agent chat, Forge conversation and analysis, watchlist creation and equip, scouting boards, natural-language screening, theme research, news or catalyst ingestion, directives, settings, explanations, receipts, and post-game review. Include alternative names and surfaces omitted from the previous report. Inspect disabled research features as potential reuse assets without treating them as launched or activating them.

3. Complete user journeys. Trace article-to-discussion, conversation-to-hypothesis, theme-to-shortlist, shortlist-to-deeper-research, hypothesis-to-watchlist, watchlist-to-deployment, condition-to-monitoring, proposal-to-execution-or-rejection, and outcome-to-review-or-memory. Identify mode-specific paths. For each, show what persists, what is dropped, who owns transitions, and how the user sees the result.

4. State and reusable contracts. Inspect SignalDrop records, saved theses, watchlists, Vision variants, chat state, preferences, agentContext, resolved manifests, decision tools, tick bodies, learning receipts, lesson stores, and Mandate vintages or envelopes where present. Do not infer equivalent behavior from similar field names. Trace actual writers and readers and nominate existing extension points.

5. Research orchestration. Determine support for screening a bounded universe, qualifying evidence, selecting deeper investigations, comparing alternatives, stopping under a budget, and reporting coverage. Inspect batching, caching, freshness, task status, retry and cancellation behavior, concurrency ownership, and data availability. Do not invent latency or token savings.

6. Personalization and authority. Trace explicit and inferred preferences, user ideas, article claims, temporary hypotheses, and permitted adjustments. Establish whose data influences whose agent, correction and deletion behavior, precedence, expiry, and the boundary between attention, belief, and execution authority. Inspect how the agent disagrees and how user influence is evidenced.

7. Learning and evaluation. Trace reflection, consolidation, detector outputs, persistent lessons, confidence updates, promotion, retirement, and downstream use. Identify accepted versus proposed learning, scope, versions, rollback, outcome timing, and evaluator access. Check whether memory accumulation, policy releases, and model upgrades are separately measurable. Inspect fairness rules and learning changes during rated games.

8. Evidence and explanation. Trace evidence visible before reasoning, late reads, post-action refetches, source timestamps, missingness, original proposals, overrides, execution results, and user-facing explanations. Determine whether existing records support a joined episode without duplicating capture or retaining prohibited text.

9. Modes and external boundaries. Compare fixed-slot BaggerBomb, tournament restrictions, training modes, and Managed Mandate cash/share semantics. Inspect horizon translation, watchlist changes during games, and idea continuity across completion. Identify application-side Harness interfaces without claiming access to external Harness Lab, Hermes, or Pi implementations.

10. Prior findings and reuse risks. Carry forward G01 through G12 from the earlier audit. Reassess only where scope overlaps or the baseline changed. Give special attention to G01 through G04, G06, G09, G10, and the narrow ADD-slate conflict in G11. Separate remediation from new capability work. Distinguish justified enforcement duplication from accidental drift.

11. Inventory gaps. After tracing these journeys, inspect adjacent menus, routes, services, schema collections, tests, and approved indexes for omitted capabilities. Explicitly list relevant existing features absent from this prompt. Bound the census and report uninspected areas rather than claiming exhaustive coverage.

## Required audit outputs

Executive assessment: what the expanded vision already has, which connections are incomplete, which additions are justified, and what remains unknown.

Capability inventory: name and aliases, user purpose, entry point, active conditions, owner, stored state, callers and consumers, evidence citations, inspected tests, executed test scope, and status.

SignalDrop end-to-end map: supported journey, persistence, debate behavior, authority boundary, downstream integrations, test evidence, limitations, and recommended reuse.

Journey matrix: each journey’s current support, missing transition, mode restrictions, dependencies, user-visible outcome, and evidence status.

State and authority map: current source of truth, writers, readers, lifecycle, scope, permission, expiration, deletion, and version behavior for each relevant record.

Learning assessment: what changes today, how it changes future behavior, what constitutes demonstrated improvement, missing qualification controls, and feasible extensions to existing mechanisms.

Reuse disposition: reuse unchanged, extend, connect, consolidate, defer, or build new. Justify every proposed new component against existing alternatives. Treat any future removal as a separate proposal with dependency and preservation evidence.

Prior-finding ledger: retain each G identifier and mark unchanged, narrowed, expanded, resolved with evidence, or unverified on this baseline. Do not close findings based only on documentation or a changed filename.

Ranked findings: consequence, evidence, limiting conditions, test or reproduction status, affected user journey, owner, and smallest next action. Separate defects, integration gaps, intended mode limits, and new product choices.

Minimum-change pilot and sequence: preserve existing functionality, select one complete experience, identify prerequisites and acceptance cases, estimate effort by work category with stated uncertainty, and list founder decisions. Do not invent calendar dates or a completion percentage.

Coverage ledger: map all eleven inspection areas to evidence, document explicit exclusions, and state which claims still require runtime or external-repository confirmation.

# 11 Sources and evidence register

Use the source labels below to distinguish reported implementation, founder context, proposed design, and general research. This handover is self-contained for design review. Provide the full prior audit alongside it when the reviewer needs the original code citations.

## S1 Founder direction and SignalDrop clarification

Current conversation, 22 September 2026. The founder prioritizes fun competition, capable research, discussion, personalization, and realistic learning. The founder identifies SignalDrop as built and tested and requests a broader audit for existing reusable components. This is the authoritative correction to our earlier incomplete interaction inventory.

## S2 Prior application architecture audit

FantasyTrades Trading Agent Architecture Audit, supplied as Pasted markdown(20260922-011733).md. Baseline: 1740996d43100a94fa97f9e9958b48c297d2017f, dated 21 September 2026. The report states no test execution, no runtime qualification, unverified remote freshness, and no repository remediation. Sections D through F and findings G01 through G12 support the current-state summaries in this handover.

## S3 Original vision handover

FantasyTrades_Trading_Agent_Vision_Handover_and_Codebase_Audit(1).docx and the corresponding Markdown file. The embedded audit prompt matches, while the Word version includes additional product context, JEV boundaries, and success criteria. The current proposal extends this direction with explicit partnership continuity and learning qualification. The founder’s SignalDrop correction takes precedence over any inference of missing interaction functionality.

## S4 Reflective memory research

Shinn and colleagues. Reflexion: Language Agents with Verbal Reinforcement Learning. 2023. Demonstrates benchmark gains through stored linguistic feedback without model weight updates. Supports a possible adaptation mechanism. Does not establish trading performance.

https://arxiv.org/abs/2303.11366

## S5 Model judge research

Zheng and colleagues. Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. 2023. Examines model judging and biases including ordering and verbosity. Supports qualification of a proposed judge. Does not qualify JEV or grant it trading authority.

https://arxiv.org/abs/2306.05685

## Status of proposed structures

Shared hypothesis contracts, research coverage records, learning-promotion rules, evaluation design, and the first complete journey remain proposals pending adversarial review and the expanded audit. They do not establish new implementation facts. No deletion, replacement, or broader autonomous authority follows from this handover.

FantasyTrades  |