Practice Field V5 review
Date: 12 November 2026

Verdict: REVISE. Keep the virtual portfolio and reuse selected Mandate components. Revise the experiment contract and first-release boundary before implementation.
Founder summary
V5 preserves several priorities from our discussion: a visible virtual portfolio, an agent’s recorded explanations, private archetype experience, and a deliberate decision before applying a change. Those parts deserve to stay.

The main drift is the question the first release answers. V5 starts with “let a manager trade these stocks against SPY.” Our goal is “let my agent propose a specific improvement, test it against its existing approach, and retain an honest record of what happened.” A portfolio against SPY supplies market observations. It does not, by itself, establish whether a proposed change improved the agent. V5 postpones both agent-originated proposals and the agent baseline. [V5:31, V5:33, V5:140]
Keep	Change before the first learning experiment
A virtual portfolio tied to market observations	Give every experiment a question, proposed change, baseline, objective, and fixed evaluation window
Mandate’s accounting and execution components	Add a distinct test lifecycle, matched price rules, and test-specific evidence records
One active experiment per player	Count the experiment once even when it contains two books and a benchmark
Private ownership and explicit adoption	Bind records to the user and originating agent instance. Player agreement does not establish effectiveness


The current Mandate manager is a separate, frozen archetype manager. It does not receive the player’s equipped ideas, leans, or private learning. Its candidate list supplies price and sector, without the technical evidence or experiment condition needed to test our pullback idea. Calling its output “your agent learning” would overstate the implementation. [api/_utils/mandateGenerationConfig.js:11, api/_utils/mandatePromptAssembly.js:41, api/_utils/mandatePromptAssembly.js:94]

The first milestone should therefore demonstrate one complete, small learning experiment. The agent proposes a question from retained evidence. The experiment freezes one proposed change. The runner verifies the change affects the intended decisions. A baseline comparison follows. A paper portfolio becomes the forward-observation stage once sizing, exits, risk limits, and price timing are specified. Film Room reviews the evidence. Forge presents the proposal and later adoption choice. These are roles around shared records, not separate learning engines.

The full KB does not need to finish first. The first experiment needs a small approved set of method definitions, explicit versions, source references, and a strict boundary around private experience. Adding more documents alone will not teach the existing manager to execute a new indicator or rule.

The engineering review also found concrete work beyond V5’s “medium” P1: the confirmed sector-cap units bug, incomplete end-of-test behavior, missing benchmark provenance, missing initial-value treatment in derived metrics, and an unproven assumption about official closing prices. P0’s three fixes remain useful as separate bounded tasks. P1 needs several smaller packages.

Recommendation: send this review back for a V5.1 revision. Keep the portfolio vision. Bring the experiment and ownership contracts forward. Treat the first watchable Mandate book as an engineering pilot until it tests an identifiable change.
Review basis and limits
The review followed git fetch origin, then used a fresh detached worktree at origin/main, commit f79b481a791aa17cad5c0445bd31edddeda60071. The source tree stayed unchanged. The report sits outside the repository.

The audit branch was fetched explicitly. Its HEAD is a59601c5b643223cacd620e1ac10c3bb6bbe5ac3. Its audit reviewed 1e041a022126f48b0d2a2cc9dfc02dd20b465198. References to the audit describe its report, not a new production inspection. No Firestore access occurred during this review. No model, EODHD, or other market-data requests occurred. Public Anthropic documentation was consulted for pricing and batch timing. No PR action occurred.

Citation convention: repository file:line references point to the reviewed main commit. V5:n refers to line n of the attached 20261112_PRACTICE_FIELD_CONCEPT_V5.md. Audit citations explicitly name the audit branch. Design recommendations are proposals, not descriptions of existing code.

This is the requested dependency review. It is not a new acceptance audit of all Mandate behavior, Season Mode, or the Trend Follower evaluator.
Findings and exact changes
C5-01. Restore the experiment as the first-release unit
Severity: blocks P1.

V5 postpones agent proposals, the unchanged-agent comparison, and research-only evaluation. It equates sending a card with proposal review. A subject list alone specifies neither the proposed behavior nor its comparator. [V5:31, V5:33, V5:36, V5:130]

Replace §0’s first two bullets and §2’s Item row with:
The Practice Field runs private, versioned experiments. A virtual portfolio is its first forward-observation surface. Each experiment records a question, proposed change, baseline, objective, evidence requirements, risk boundaries, and fixed window. Film Room supplies observations. The agent drafts proposals for review in Forge. Practice Field executes the approved test contract. Results return to Film Room and Forge. Observation, testing, and adoption remain separate states.

V1 accepts an agent-drafted proposal from a Film Room observation or an existing idea version. A founder-entered proposal uses the same contract. A stock or list without a testable question is a portfolio observation, not a strategy-improvement experiment.

Move one narrow agent-proposal path and baseline support into the first complete vertical slice. A passive benchmark does not require a second model call. An unchanged-agent baseline does require separate book state and decision evidence.
C5-02. Name the manager honestly and freeze the inputs
Severity: blocks P1.

The existing manager has its own identity and pinned vintage. The assembler’s six inputs exclude user learning, equipped controls, and a typed experiment. The visible candidate slate contains only ticker, price, and sector. [api/_utils/mandateSchema.js:48, api/_utils/mandateGenerationConfig.js:11, api/_utils/mandatePromptAssembly.js:41, api/_utils/mandatePromptAssembly.js:94]

Replace the Manager and Backstory rows with:
The engineering pilot uses an experimental manager based on a frozen archetype profile. It is separate from the player’s deployed agent. A test of the player’s agent requires a verified snapshot of its applicable configuration and private context. Both comparison branches receive the same permitted evidence, except for the declared experimental change.

Every supplied indicator, method, idea, and rule carries its source, version, information time, and availability state. Evidence displayed only to the player is labelled separately from evidence supplied to the manager.

P1 needs an input manifest, an executed-change receipt, and a record of what each branch received. A KB paragraph describing a rule does not establish runtime enforcement.
C5-03. Distinguish the baseline from market benchmarks
Severity: blocks P1.

Starting with identical money does not equalize exposure, costs, timing, or decisions. New books start in cash. Entries pay friction and respect concentration limits. [api/_utils/mandateSchema.js:73, api/_utils/mandateGate.js:119, api/_utils/mandateExecution.js:180]

Replace §2’s Twin row and §4’s “twin keeps it honest” bullet with:
A baseline answers the experiment’s question. A benchmark supplies market context. A timing test uses a frozen passive holding of its subject at a declared exposure budget. A proposed agent change uses the unchanged agent as its primary baseline. SPY or a sector reference appears separately. Every comparison pins its starting mark, exposure policy, cost model, corporate-action treatment, and ending mark. Sharing a snapshot is necessary but does not establish a fair comparison on its own.

See A1–A3 for subject-specific choices.
C5-04. Correct the closing-price and missing-data promises
Severity: blocks P1.

The close sweep’s comment promises an official close, but it invokes the same quote-snapshot builder used intraday. The builder accepts a finite positive raw q.close. It does not verify an official regular-session closing print. A missing quote timestamp falls back to fetch time. New-entry eligibility checks presence and completeness, without an age check. Held positions have a separate freshness check. [api/cron/mandate-evaluate.js:658, api/_utils/mandateUniverseSnapshot.js:145, api/_utils/mandateUniverseSnapshot.js:150, api/_utils/mandateUniverseSnapshot.js:575, api/_utils/mandateUniverseSnapshot.js:593]

Existing degraded marking also carries prior marks forward. It does not simply pause all marking. Exits have an intentional carry-over lane. [api/_utils/mandateClosePass.js:323, api/_utils/mandateExecution.js:130, api/_utils/mandateExecution.js:222]

Replace §4’s pricing and unknown bullets with:
V1 uses regular-session evidence. Every decision and valuation records vendor observation time, receipt time, session, price basis, and quality. Delayed snapshot fills are labelled simulated. They are not claimed as obtainable trades. Final comparisons require matched, verified session prices. Until a close source meets this contract, the screen says “post-close snapshot value.” Missing or carried-forward marks remain visible and prevent a full-quality result. A later quote never silently replaces the scheduled endpoint.

P1 must define quote-age admission, finalization, and degraded-exit handling. Preserve existing Mandate exit behavior unless a separately scoped change approves a different test policy.
C5-05. Fix sector units at the frozen-config boundary
Severity: blocks P0.

The audit’s bug is confirmed. buildVintagePayload copies the registry’s pick count into a field consumed as a dollar fraction. A count of 2 passes a 70% sector exposure in the current pure checker. [api/_utils/mandateVintage.js:88, api/_utils/mandateSectorCap.js:51, api/_utils/agentGuardrails.js:69]

Change P0’s cap package:
Normalize the source slot count once when constructing the Mandate’s frozen gate config. Record the source count, six-slot denominator, resulting dollar fraction, and conversion version. Map 2 to 1/3, 3 to 1/2, and 4 to 2/3. Validate fractional units at the consumer. Mint a new immutable vintage. Do not edit existing vintage content or silently change an active book’s rules.

This is an explicit translation from an equal-slot policy into a dollar policy. It is not mathematical equivalence for unequal-sized holdings. Founder approval of the translation belongs in the cap task. See B5 for tests and old-vintage handling.
C5-06. Keep experiment scope compatible with archetype identity
Severity: blocks P1.

A default book does not authorize a 100% single-stock position. It limits new exposure to 35%, with a tighter sector cap possible after the bug fix. The 2% cash floor also rules out literal 100% investment. The prompt asks for at least five positions. [api/_utils/mandateConfig.js:51, api/_utils/mandateGate.js:138, api/_utils/mandateContextBlock.js:62]

Add to §2:
Subject selection does not override archetype risk boundaries. A single-stock timing experiment uses a declared research allocation and a matched passive baseline. An intentionally concentrated research profile is a different experiment profile, not a learned change to a Diversifier. Profile, allowable actions, holding count, cash floor, and concentration limits are frozen before the start.

Do not disable a Diversifier’s identity to make the chart more active. Retain the option of testing a proposed signal on a restricted allocation.
C5-07. Add a test lifecycle before live paper runs
Severity: blocks P1.

Creation claims one active Mandate per user, seeds a quarter, and resolves a registry vintage. Evaluation and closing query active books. Rollover additionally selects due quarters. Nothing here implements a 10/30/60-session experiment end. [api/_utils/mandateCreationService.js:47, api/_utils/mandateCreationService.js:95, api/cron/mandate-evaluate.js:362, api/cron/mandate-evaluate.js:699, api/cron/mandate-rollover.js:94]

Change P1:
Add a discriminated test book and experiment lifecycle. One active experiment consumes the player’s limit, regardless of its comparison-book count. Freeze a start session and end session. Block new actions after the cutoff, even if the close worker fails. Finalize from the scheduled endpoint or record an incomplete result. Record abandonment without deleting the run. Exclude test books from quarterly replacement and the Mandate escape hatch. Every completion, cancellation, retry, and late model result must be idempotent.

A closing failure must not grant extra trading days. Details are in B2–B4.
C5-08. Add inception, holdings, and evidence retention to results
Severity: blocks P1.

Daily rows carry total value and cumulative friction, but not a dated cash-and-holdings snapshot. Return and drawdown helpers start from supplied rows. Without a starting row, they omit the opening-to-first-close move. Snapshot cleanup removes evidence after 120 days. [api/_utils/mandateSchema.js:228, api/_utils/mandateRiskMetrics.js:114, api/_utils/mandateRiskMetrics.js:145, api/_utils/mandateClosePass.js:599]

Change P1:
Persist the pre-action starting value, matched dated valuation rows, cash, positions, costs, corporate-action receipts, evidence references, quality states, and the frozen experiment contract. Compute result fields over the test window. Preserve the bounded evidence packet required to reproduce a result beyond operational snapshot retention. Retain raw values and derive displayed labels from the displayed rounded values.

Do not ship the existing composite score as experiment confidence. Ten sessions support a description of the observed path, not calibrated confidence in a strategy.
C5-09. Make the idle-data fix narrow and restartable
Severity: blocks P0.

The first eval and close builds fetch data even when the active-book scan returns empty. Daily and tick documents are then reused, including for newly created books. Batch harvest also reads tick snapshots. [api/cron/mandate-evaluate.js:284, api/cron/mandate-evaluate.js:661, api/_utils/mandateUniverseSnapshot.js:369, api/_utils/mandateUniverseSnapshot.js:489, api/_utils/mandateBatchTransport.js:619]

Change P0:
Skip new Mandate market-data acquisition when there are no active books and no outstanding submission duty requiring it. Preserve cleanup and required batch disposition. Do not create an empty success snapshot. Recheck on later fires so the first book starts normally. Leave shared caches and other data jobs intact.

This removes idle acquisition. It does not promise exactly 1,700 saved units each day. P1 separately adds queued subject and benchmark membership before activation.
C5-10. Persist explanations without turning them into evidence
Severity: blocks P0.

The decision tool asks for a rationale and optional conviction. Normalization preserves them, but decision-record construction drops both. It does not enforce a rationale length or sentence count. Existing decision documents are owner-readable. [api/_utils/mandateDecisionTool.js:36, api/_utils/mandateDecisionTool.js:114, api/_utils/mandateSchema.js:271, api/_utils/mandateExecution.js:453, firestore.rules:1457]

Change P0:
Store bounded model-written rationale with model/config identity, evidence references, decision status, and timestamps. Record absence explicitly. Preserve the original attributed text. Render it as unverified quoted explanation, never as a verified causal account. Treat stored text as untrusted input in any later model call. Store self-reported conviction only as a diagnostic. Do not present it as a success probability or calibrated confidence.

Add direct and batch paths to the coverage. A fresh closing narrative needs its own generation and cost specification. It is not already supplied by the last action rationale.
C5-11. Preserve the adoption boundary and update conflicting contracts
Severity: blocks P1.

V5 narrows development/confirmation discipline to coded rules and replaces the older proof gate with a single-test result plus player choice. The current Charter and shared contract impose stronger requirements. The Charter also excludes per-user market-alpha promotion and reserves “strategy” for composed proven lessons. [V5:122, V5:125, V5:130, docs/AGENT_LEARNING_CHARTER_V1.md:22, docs/AGENT_LEARNING_CHARTER_V1.md:48, docs/AGENT_LEARNING_CHARTER_V1.md:84, docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:107]

Replace §4’s adoption rule and §9’s final paragraph with:
Private experimental proposals are allowed before adoption. Their use is confined to the named isolated test. They do not enter deployed-agent prompts, memory, consolidation, or another archetype’s context. A result records what happened under the frozen setup. An ordinary user control change remains an ordinary preference change. It does not become a validated learned adjustment merely because the player confirms it.

Development and confirmation remain separate whenever results support a claim of improvement, including prompt changes, lists, dials, and composite ideas. Market observations, game outcomes, and evidence quality remain separate. Applicable maturity and adoption rules govern promotion. New market-alpha claim types require an explicit Charter revision rather than an implied exception.

V5.1 and shared contract V2 must name their exact supersessions. Include a narrow experimental-prompt exception to the existing “no prompt before installed” rule. Preserve the deployed-agent prohibition.
C5-12. Bring operational limits into the pilot
Severity: blocks P1.

Fifty books per slot and 175 closes per day are theoretical upper counts, not tested safe capacities. Spend alerts do not stop requests. The calendar stops issuing sessions beyond 2027. [api/cron/mandate-evaluate.js:366, api/cron/mandate-evaluate.js:389, vercel.json:198, api/_utils/mandateClosePass.js:575, api/_utils/mandateSessionSlots.js:85]

Change P1 and P5:
P1 includes one transactional active-experiment limit, a small founder capacity cap, per-run spend bounds, expected-versus-observed slot records, and a start-time calendar-horizon check. P5 expands measured capacity and maintains the calendar. P5 does not supply the pilot’s first correctness controls.

Use direct transport for the timed founder pilot. Treat batch as a separately evaluated latency/cost option. See D1–D3.
C5-13. Version the ledger and separate run status from evidence status
Severity: blocks P1 for the shared contract, implemented with the Film Room handoff.

Current server and UI readers recognize card, nominated, and retired. Unknown stages enter an “other” group. The five-card count excludes unknown stages. Shelving is computed from the archetype, not an execution stop. [api/_utils/filmRoom/cardStore.js:63, api/_utils/filmRoom/cardStore.js:157, src/screens/filmRoomV2/filmRoomCards.js:157, src/data/cardSlots.js:24]

Replace §5’s stage paragraph with:
A play entry links to versioned experiment runs. testing means a run is active. tested means a run ended and carries a result state, including incomplete or inconclusive. Neither state grants installation. The record also carries an independent adoption state and a complete run history. testing counts as an open item. Tested items awaiting a decision count until parked or retired. Queueing is an explicit state or field, not a fake running test.

Update server transitions, counters, shelving projections, UI grouping/copy, and legacy-reader tests together. Do not rewrite historical stage history.
C5-14. Correct authority and deployment language
Severity: text edit.

V5 describes the engine as complete, uses unverified current production counts, claims the twin comes free, and says “Approved unless you object.” The brief authorizes a read-only review, not adoption. Source flags prove configured values, not deployed runtime or current collection counts. [V5:12, V5:81, V5:82, V5:148, src/config/featureFlags.js:1930, src/config/featureFlags.js:1954, docs/BUILD_RULES.md:38]

Replacement text:
Existing Mandate components and their prior acceptance evidence provide a starting point. The Phase 0 audit reported zero books at its observation time. This review did not recheck production. Shared quote infrastructure exists. Experiment pairing, fair baselines, test lifecycle, result evidence, and player-agent identity remain build work.

The decisions below are proposals awaiting explicit founder rulings. Adoption of this concept does not authorize implementation, deployment, PR closure, model spending, or production changes.

Remove §12’s implication that daily movement makes an experiment worthwhile. A quiet, rejected, or inconclusive experiment is useful when it answers its question honestly.
Answers to the question sheet
A1. Cash start, friction, and a fair start
Cash exposure pushes the comparison against the active book during a rising market and in its favor during a falling market. The direction over a particular ten-session path is unknown beforehand. Friction consistently reduces the active book relative to an otherwise identical frictionless path. The 2% floor introduces a persistent exposure difference. A gradual ramp adds another difference. [api/_utils/mandateSchema.js:73, api/_utils/mandateGate.js:119, api/_utils/mandateFrictionModel.js:20]

The first buy uses execSizeUsd / executedPrice, floors shares, charges cash, and records friction. It does not create free benchmark exposure. [api/_utils/mandateExecution.js:180]

Recommended contract:
1. Schedule a common start at an eligible regular-session slot, preferably the next session. Record pre-action cash and initial value.
2. The passive comparison buys at the declared start mark under its stated exposure and friction rules. Do not wait for the agent’s first buy. A decision to wait is part of a timing test.
3. For an in-or-out single-stock allocation, use the same fixed maximum research allocation in the passive baseline, with the balance in cash. Record cash interest as zero in V1 or supply one shared explicit rule.
4. For a full manager-versus-passive-portfolio comparison, disclose the different allocation policy. It measures the complete management choice, including cash, rather than stock selection alone.
5. Apply dividends, splits, and terminal valuation consistently. State whether the result is marked-to-market or includes simulated liquidation costs. Do not mix those endpoints.
Use “same cost policy,” not “identical costs.” Different assets and turnover incur different costs. An ETF needs an explicit friction classification rather than an unexplained fallback to the stock market-cap tiers. [api/_utils/mandateFrictionModel.js:29]
A2. Official close and benchmark clocks
Neither existing latest record is a verified official-close series suitable for immediate reuse.

The Mandate close snapshot uses the raw quote builder. The index job fetches dated EOD bars, maps adjusted-preferred and raw closes, and writes a latest marketContext record. Its premarket/intraday schedules do not establish a same-session official close. The context record carries price/change and update time, not a complete benchmark-bar provenance contract. Sector context contains percentage changes rather than a complete price series. Intraday snapshots publish to latest. [api/cron/mandate-evaluate.js:658, api/_utils/mandateUniverseSnapshot.js:145, api/cron/compute-index-intelligence.js:144, api/cron/compute-index-intelligence.js:791, api/cron/compute-index-intelligence.js:1216, vercel.json:149, api/_utils/intraday/intradayStore.js:24]

Add benchmark symbols to the same valuation build as the portfolio. For the final daily series, either verify raw regular-session EOD closes for all symbols or retain the honest label “post-close snapshot.” Adding SPY to today’s builder alone does not upgrade the source to an official close.

Timing drift has no fixed ten-session bound. If the benchmark’s terminal mark is 1% higher solely because it came from a later observation, a $100,000 fully invested benchmark is roughly $1,000 higher, reducing the displayed portfolio gap by the same amount. An inconsistent start mark also changes every later normalized value. This is an illustration, not a measured drift. Preserve matched endpoint timestamps and reject an unsupported comparison.

Use raw prices plus separately accounted distributions, or a consistently adjusted return series. Do not add dividends to an already total-return-adjusted series.
A3. Default comparison per subject
These are recommended defaults, not current engine behavior.
Subject and question	Primary comparison	What its gap measures
Single-stock timing	Buy-and-hold of the same stock at a fixed matched allocation	Timing and position-management choices, including costs
Single-stock selection thesis	SPY or an explicitly chosen sector reference	Performance relative to the chosen reference. It does not isolate timing skill
Sector selection/management	Relevant sector fund	Selection and management within that sector, plus any remaining exposure differences
Industry	Suitable industry fund if coverage and constituent fit are adequate. Otherwise a frozen basket	Industry-relative results. A broad sector fund is labelled a proxy
Theme	Versioned basket of the original theme constituents with frozen weights	Choices relative to the submitted theme. No survivor substitution
Proposed change to an agent	Unchanged agent snapshot with identical allowed evidence and execution rules	Difference associated with the declared change in this run


SPY remains a useful secondary context line. An LLM comparison is still one stochastic observation. Freeze the model and generation settings, then record repeated runs without treating overlapping windows as independent evidence. Current Mandate cadence varies by archetype, so it must be pinned explicitly for a comparison. [api/_utils/mandateGenerationConfig.js:25, api/_utils/mandateGenerationConfig.js:47]
A4. Stored values, costs, and drawdown
dailyRows stores total value, returns, drawdown, quality fields, model cost telemetry, daily friction, cumulative friction, dividends, and decision counters. It does not store the day’s cash and positions. Those live on the mutable book. [api/_utils/mandateSchema.js:228, api/_utils/mandateClosePass.js:405, api/_utils/mandateClosePass.js:442]

Trading friction already reduces cash. Do not subtract it again from total value. Model API spend is operational cost and must remain separate from simulated trading costs. [api/_utils/mandateFrictionModel.js:20, api/_utils/mandateClosePass.js:397]

The existing risk module computes maximum drawdown from row total values, with a five-row minimum. Its return function measures first row to last row. If a $100,000 book first closes at $99,000 and later finishes at $100,000, row-only return reads approximately +1.01% and row-only drawdown misses the first loss. The test itself finished flat from inception. Add the pre-action starting observation. [api/_utils/mandateRiskMetrics.js:114, api/_utils/mandateRiskMetrics.js:145, api/_utils/mandateConfig.js:221]

Show “largest decline between recorded session-close values during this test,” not total intraday worst loss or general safety. Ten sessions support this descriptive statistic. Display coverage and degraded marks. Keep Sharpe and composite confidence out of the headline. A cash-only run with zero drawdown does not establish useful protection. [api/_utils/mandateRiskMetrics.js:53, api/_utils/mandateRiskMetrics.js:92, api/_utils/mandateRiskMetrics.js:175]

Store cents and share precision. Derive the visible dollar gap from visible portfolio values. Label percentage-point return differences explicitly. Use one displayed series for chart, drawdown, and result labels, while retaining raw analytical values for reproducibility. [api/_utils/mandateConfig.js:41, docs/BUILD_RULES.md:100]
B1. Gate overrides and a single-stock subject
evaluateGate accepts a passed gateConfig. The production caller supplies it from the pinned vintage. A different valid config needs no rewrite of the comparison math, but creation, vintage resolution, prompt, validation, and callers must carry the new profile. [api/_utils/mandateGate.js:59, api/cron/mandate-evaluate.js:206]

With defaults, the book cannot deliberately buy 100% of its value in one stock. Its entry test uses 35% maximum single-position weight and a 2% cash floor. After the cap correction, a Diversifier’s sector limit further constrains the single-stock allocation to about one third. Market appreciation might later take a holding above its entry cap. The gate is not a continuous rebalancer. [api/_utils/mandateGate.js:119, api/_utils/mandateGate.js:133, api/_utils/mandateGate.js:138]

For an explicitly separate 100% research profile, the required settings would include maxSinglePositionWeightPct: 1, sectorConcentrationCap: 1, cashFloorPct: 0, and maxPositions: 1 for a stock. The construction target also needs to become 1. Fees and fractional-share rounding still leave a small residual. A one-sector portfolio needs a sector limit of 1 while retaining its declared per-stock constraints. These are design alternatives, not recommended silent overrides.

My recommendation is a matched allocation timing test for an archetype-bound experiment. If the purpose is to examine a concentrated research thesis, name it as a separate research profile and never adopt its concentration policy into the Diversifier automatically.
B2. Couplings beyond the slate, universe check, and end date
Dependency verified at reviewed HEAD	Required test treatment
Creation accepts a registry archetype, publishes its vintage, and seeds fixed starting capital. api/_utils/mandateCreationService.js:47, api/_utils/mandateCreationService.js:57, api/_utils/mandateCreationService.js:84	Separate authenticated test creation with validated experiment profile and requested fixed starting value
One active book is claimed through userMeta.activeMandateId. api/_utils/mandateCreationService.js:95	A separate transactional active-experiment claim. Do not overwrite the Mandate pointer
Manager ID is stable per user and archetype, not per originating arena agent. api/_utils/mandateSchema.js:48	Keep runner identity separate from experience owner. Persist originating agent instance, archetype/loadout, experiment, branch, and config version
Model seat and cadence come from the six-archetype registry. api/_utils/mandateGenerationConfig.js:47, api/_utils/mandateVintage.js:78	Pin a test runner profile. Do not inherit three daily checks while advertising two
Prompt narrates a quarter and five-position construction target. api/_utils/mandateContextBlock.js:54, api/_utils/mandateContextBlock.js:62	Use test-window and subject-appropriate language
Submission validity binds quarter key, vintage, book status, and revision. api/cron/mandate-evaluate.js:166, api/_utils/mandateExecution.js:110	Preserve equivalent experiment-generation and end-time guards
Close computes quarter/lifetime lenses and writes a Mandate scoring stream. api/_utils/mandateClosePass.js:434, api/_utils/mandateClosePass.js:468	Add test-scoped metrics and discriminate stream records. Never blend test evidence with Mandate tenure evidence
Rollover selects active, due books. api/cron/mandate-rollover.js:94	Explicitly exclude test books from rollover. Do not rely on a convenient null date alone
Escape acts on activeMandateId, uses a once-ever allowance, and creates a replacement. api/_utils/mandateEscape.js:57, api/_utils/mandateEscape.js:99, api/_utils/mandateEscape.js:176	A test abandonment operation, with no reset or escape privilege
Monthly $1 band only logs an alert. api/_utils/mandateClosePass.js:575	Aggregate spend across experiment branches and enforce the chosen budget at admission and before new calls
Retention deletes daily/tick snapshots after 120 days and terminal batch bookkeeping after 30 days. It does not delete books or their decision/daily-row families. api/_utils/mandateConfig.js:294, api/_utils/mandateClosePass.js:590, api/_utils/mandateClosePass.js:616	Preserve a bounded reproducible experiment packet and retain unfinished finalization work
Existing book and decision client reads use the parent user ID. firestore.rules:1446	Define access for new test/result records and enforce archetype-scoped retrieval server-side


A frozen config does not inherently require an archetypeVintages document. The current engine does require a resolvable vintageRef, including in batch harvest. An embedded test config is not a drop-in replacement. Prefer a versioned resolver discriminant which preserves existing Mandate behavior and loads an immutable experiment config for tests. [api/cron/mandate-evaluate.js:414, api/_utils/mandateBatchTransport.js:637]
B3. Ending a test and handling a missed final close
Finalization belongs beside the final valuation transaction. It should record the terminal value, coverage, result status, and active-limit release once. Execution must independently reject actions after the frozen cutoff. The scheduled end session is not “the tenth successful row.” Otherwise outages extend the test and introduce selection bias.

status == active is not the only selection condition. Eval and close also order by health fields and page-limit results. Rollover requires a due rollover timestamp. Batch harvesting follows its own open-batch records. Execution rechecks revision, quarter/status, and session. [api/cron/mandate-evaluate.js:362, api/cron/mandate-evaluate.js:699, api/cron/mandate-rollover.js:94, api/_utils/mandateBatchTransport.js:627, api/_utils/mandateExecution.js:110]

If the final close fails today, the current engine leaves no daily row for that date and accounts for the gap at a later successful close. It has no test cutoff to prevent another evaluation. [api/_utils/mandateClosePass.js:344, api/cron/mandate-evaluate.js:739]

Proposed states: scheduled, running, awaiting-final-valuation, completed, incomplete, abandoned. Keep a separate evidence/adoption status. A recovery worker uses the original scheduled session’s prices and positions. If recovery is impossible, finalize incomplete. Do not trade through the gap or silently extend the horizon. Preserve bookkeeping for late paid results even after the run ends.
B4. Subject symbols and creation during a session
The slow and fast snapshot builders accept candidateUniverse. The current cron only adds held symbols to the default universe, so a fresh test with empty holdings contributes none of its new subject symbols. Build the union of eligible test subjects, benchmark symbols, and held symbols before creating the snapshot. Filter each manager’s slate to its own scope, then enforce the same membership at the gate. A global snapshot is not a per-test permission list. [api/_utils/mandateUniverseSnapshot.js:80, api/_utils/mandateUniverseSnapshot.js:352, api/_utils/mandateUniverseSnapshot.js:470, api/cron/mandate-evaluate.js:287, api/_utils/mandatePromptAssembly.js:94, api/_utils/mandateGate.js:111]

There are two reuse races: an existing daily doc omits a newly added symbol’s metadata, and an existing tick snapshot omits its price. Both builders return the existing record. Rebuilding one layer alone is insufficient. [api/_utils/mandateUniverseSnapshot.js:369, api/_utils/mandateUniverseSnapshot.js:489]

For V1, schedule starts only after subject membership is prepared for a new eligible snapshot, preferably the next session. Do not overwrite an existing shared snapshot used by other books. Recheck readiness at activation. If later supporting intraday starts, add a versioned supplemental-membership design rather than a hidden overwrite.

Also review the minimum 100-candidate health expectation and the 300-symbol build limit. A small test universe must not automatically look degraded, and union growth must not silently drop required test evidence. [api/_utils/mandateConfig.js:78, api/_utils/mandateConfig.js:89, api/_utils/mandateUniverseSnapshot.js:536]
B5. Sector-cap correction and tests
The source values are counts: analyst 3, guardian 2, contrarian 3, diversifier 2, Trend Follower 3, Speculator 4. The vintage copies them unchanged. The checker divides dollars by book value and compares the resulting fraction directly. [api/_utils/agentArchetypeConfig.js:66, api/_utils/agentArchetypeConfig.js:95, api/_utils/agentArchetypeConfig.js:122, api/_utils/agentArchetypeConfig.js:151, api/_utils/agentArchetypeConfig.js:182, api/_utils/agentArchetypeConfig.js:214, api/_utils/mandateVintage.js:88, api/_utils/mandateSectorCap.js:65]

Normalize at vintage construction, using an explicitly named six-slot source policy. Preserve null only when “no sector cap” is an intentional profile choice. Reject malformed, negative, or above-one dollar fractions. Add unit metadata or a clearer field name. Do not repair this by modifying the fenced archetype table or altering its existing game meaning. [api/_utils/agentGuardrails.js:69, docs/BUILD_RULES.md:18]

Required tests:
- All six archetypes produce the expected fractions and a changed content hash.
- Exposure exactly at the limit passes. Exposure above it fails. Existing sector exposure and proposed spend both count.
- Unequal positions, absent sector classification, zero book value, malformed cap, and null-policy behavior are explicit.
- The prompt prints approximately 33.3/50/66.7%, never 200/300/400%.
- Existing published vintages remain immutable. New-book admission rejects an uncorrected profile. Existing affected books require an explicit migration or stop policy before trading, based on a fresh authorized inventory.
The previous audit’s zero-book observation does not justify assuming no affected book exists at deployment time.
B6. Reader census and the idle build
The following source-level census covered repository production call sites and aliases at the reviewed HEAD. It is not a Firestore inventory or proof about external tools.
Store or key	Readers found	Consequence of skipping idle acquisition
mandateUniverseDaily	Its builder reads the existing daily doc. Eval and close load it for the fast builder. Cleanup queries old docs. api/_utils/mandateUniverseSnapshot.js:367, api/cron/mandate-evaluate.js:289, api/cron/mandate-evaluate.js:669, api/_utils/mandateClosePass.js:603	No independent product reader found. Preserve normal first-book preparation
mandateUniverseSnapshots	Eval and close load a tick. Its builder adopts an existing tick. Batch harvest reloads the submission tick. Cleanup queries old docs. api/cron/mandate-evaluate.js:284, api/cron/mandate-evaluate.js:661, api/_utils/mandateUniverseSnapshot.js:487, api/_utils/mandateBatchTransport.js:619, api/_utils/mandateClosePass.js:603	Outstanding batch duties are the important exception to a blanket early return
mandateUpstreamCalls	bumpUpstreamCounter reads its previous count and writes an increment. No separate product consumer found. api/_utils/mandateUniverseSnapshot.js:257	It records fewer requests. It is not a weighted billing-unit ledger
marketDataCache/{SYMBOL}_fundamentals, with memory key mdc_{SYMBOL}_fundamentals	The generic cache helper. Production requests for this field were found in the Mandate builder and seasonEvalContext. api/_utils/marketDataCache.js:127, api/_utils/marketDataCache.js:618, api/_utils/mandateUniverseSnapshot.js:358, api/_utils/seasonEvalContext.js:41	The remaining requester fetches on a miss. Less incidental warming changes latency and where cost lands, rather than removing its data source


The other inspected getStockAnalysisData consumers request daily bars and/or prices rather than this fundamentals key. The institutional job’s direct shared-cache reads use {SYMBOL}_daily. The separate stocks fundamentals endpoint uses a different memory key, fundamentals_{SYMBOL}. Do not conflate these caches. [api/agent/research.js:171, api/agent/debate.js:235, api/cron/agent-daily-scores.js:279, api/cron/compute-institutional-intelligence.js:213, api/stocks/fundamentals.js:21]

The narrow skip is sound with the safeguards in C5-09. A new book appearing after one fire is considered on a later fire. If its needed daily membership is already frozen elsewhere, it waits for the next prepared session. Do not write an empty snapshot as the idle marker.
B7. Rationale, permissions, and conviction
The audit correctly identifies dropped fields. The tool’s “2–5 sentences” is an instruction, not a validator. The normalizer even accepts a missing rationale as an empty string. No rationale-specific persisted size bound exists in these paths. [api/_utils/mandateDecisionTool.js:59, api/_utils/mandateDecisionTool.js:115, api/_utils/mandateSchema.js:271]

Owner reads of decision documents already exist. Storing conviction on that document makes it owner-readable, even if the primary screen hides it. Keep it labelled diagnostic, not secret or calibrated. [firestore.rules:1457]

Add an explicit bounded text policy and document-size check, with a visible truncation/absence flag if relevant. Persist only the model’s outward explanation, not a claim to expose internal reasoning. Use escaped text rendering. Quote it under the manager’s identity and original timestamp. Shadow presents it without taking authorship. The Film Room already says “the agent’s words at the time · not verified.” [src/screens/filmRoomV2/filmRoomCopy.js:220]

A3 explicitly rejects turning repeated answer agreement into calibrated confidence or probability. It does not literally ban every diagnostic number in every storage record. Still, showing self-reported conviction as “confidence this works” would violate the intended distinction. Keep it out of the success headline. [docs/design/20261021_PRACTICE_FIELD_CONCEPT_V3_AMENDMENT_A.md:35]

Prompt renderers use the Mandate-specific honesty registry. A new renderer feeding its assembler belongs there. A future battle-prompt renderer also triggers the separate fenced registry and review rules. Pure UI quotation does not itself require registration as a prompt renderer. [api/_utils/fixtures/mandatePromptRegistry.js:8, docs/BUILD_RULES.md:30]
C1. Whose agent, and the later agent baseline
The honest pilot label is “Experimental Trend Follower manager” or the matching archetype name, followed by “Frozen archetype profile. Separate from your deployed agent.” [api/_utils/mandateGenerationConfig.js:11]

A player-agent experiment needs a frozen, versioned input contract containing the applicable identity, compiled rules/control versions, equipped idea/list version, leans and tempo, permitted private experience, runtime/model settings, objective, and experiment change. Add only fields consumed by the selected agent path. Treat game state and scoring as explicit optional inputs for game experiments. Preserve the distinction between private memory available before the run and observations generated during it.

Pin KB method versions and evidence packets. If a new method enters midway, start a new version or classify the run as adaptive exploration. Do not let a growing KB silently alter only one branch.

mandatePromptAssembly.js is outside the listed fence. Changing it for an isolated runner still requires its source-contract and honesty tests. Wiring new content into the battle assemblers or changing fenced behavior through another call site remains fence contact. V5’s P4 also needs a distinct name because Growth Loop Map already uses P4 for the framework’s brain splice. [docs/BUILD_RULES.md:12, docs/BUILD_RULES.md:26, api/_utils/mandatePromptAssembly.js:41, docs/design/20261028_GROWTH_LOOP_MAP_V1_2.md:56]

A frozen configuration is compatible with private ownership. Record both separately: who owns the experience and exactly which configuration produced it. The existing mgr_ identity is not enough to identify the player’s originating arena-agent instance. [api/_utils/mandateSchema.js:48]
C2. Leak paths and Forge writers
No current direct read path from Mandate book/decision/row records into battle prompts, draft prompts, or consolidation was found in the inspected source census. Identified book readers are creation/idempotency, evaluation, close, batch handling, rollover, escape, and the accelerated test utility. Decisions and rows support their accounting and archival paths. Close also appends to the mandate_scoring stream, so “nothing leaves the book” would be false. No learning consumer of that stream was found. [api/_utils/mandateCreationService.js:102, api/cron/mandate-evaluate.js:408, api/_utils/mandateClosePass.js:177, api/_utils/mandateBatchTransport.js:632, api/_utils/mandateRollover.js:135, api/_utils/mandateEscape.js:74, api/_utils/mandateAcceleratedClock.js:49, api/_utils/shadowLogger.js:167]

This is not a guarantee about future test records or arbitrary Admin SDK code. New results do not exist yet. Freeze a read/write allowlist and add negative tests for prompts, memory writes, consolidation, other users, and other archetypes before connecting the experiment.

There is already a separate legacy learning route. Reflection reads completed battles and writes agent memory. Draft assembly reads agent.memory. The ownership map explicitly says the “installed only” rule is a target rather than a complete current-system guarantee. Do not claim the new Practice Field fixes that route automatically. [api/agent/reflect.js:112, api/_utils/agentPromptAssembly.js:94, docs/design/20261028_GROWTH_LOOP_MAP_V1_2.md:47]

The named equip endpoints exist and are outside the enumerated fence. They do not constitute a generic installer for every experiment idea. Existing checks remain binding. Leans, tempo, and bundles reject active-battle mutation. Watchlist equip has both the legacy battle lock and a per-game loadout path which stages a future book while leaving the current battle’s snapshot intact. [api/agent/equip-lean.js:133, api/agent/set-tempo-dial.js:104, api/agent/equip-bundle.js:127, api/agent/equip-watchlist.js:82, api/agent/equip-watchlist.js:193]

A Watch card must not become an idea merely to bypass adoption. Existing hypothesis content has its own writer and immutable version semantics. A new rule or prompt behavior needs its own approved route. “No fenced-file contact” is defensible only for reuse within existing supported semantics, after the exact offer payload and receiving path are reviewed. [docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:111, docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md:31, docs/BUILD_RULES.md:26]
C3. Stages, capacity, and shelving
Required reader changes include server CARD_STAGES/`OPEN_STAGES`, isOpen, retirement transitions, read-time shelving, frontend grouping, local open-stage controls, and stage labels. testing would currently fall out of the open count and into the unknown-stage UI group. [api/_utils/filmRoom/cardStore.js:63, api/_utils/filmRoom/cardStore.js:159, api/_utils/filmRoom/cardStore.js:310, api/_utils/filmRoom/cardStore.js:330, src/screens/filmRoomV2/filmRoomCards.js:157, src/screens/filmRoomV2/FilmRoomCardRegions.jsx:80, src/screens/filmRoomV2/filmRoomCopy.js:372]

Yes, a running testing card should count against the open-card capacity. Tested cards awaiting a disposition should also count or be explicitly parked under a separate limit. This is a proposed contract change, requiring a slot-version update and tests. The numeric cap is currently five. [src/data/cardSlots.js:16]

An archetype switch should not retarget the manager, transfer experience, restart the window, or erase the record. Recommended default: finish the already frozen run under its original owner, show it in that archetype’s archive, and prevent the new archetype’s retrieval or adoption. It still consumes the player’s active-experiment limit until it ends or is abandoned. Shelving is presentation and retrieval behavior, not an engine lifecycle.
D1. Model cost, batch timing, and throughput
The configured manager seat is claude-haiku-4-5-20251001, with a 600-token output maximum. It is not the Sonnet/Haiku 5.5 setup used in the earlier chart-reading exercises. Those results do not establish this manager’s behavior. [api/_utils/mandateGenerationConfig.js:25]

The repository price table charges $1 per million input tokens and $5 per million output tokens. The arithmetic for 12,000 uncached input plus 600 output tokens is $0.015. Two daily calls over 21 sessions equal $0.63 per book. A model-driven baseline doubles the decision-call component. The result excludes additional proposal/review calls, retries, database costs, and market data. [api/_utils/modelPriceTable.js:32, api/_utils/modelPriceTable.js:77]

Anthropic’s public documentation checked during this review agrees with those Haiku 4.5 rates and the 50% batch discount. Its batch completion allowance is up to 24 hours, not a 30-minute service guarantee. Official Haiku 4.5 pricing, official batch API timing.

The 12,000 input figure is a planning assumption, not an observed prompt size. The assembler estimates characters/4 for system and user text, trims a price/sector slate, and omits tool-schema size from that estimator. Its configured budget is 14,000 and it logs, then proceeds, if the remaining scaffold exceeds the target. [api/_utils/mandatePromptAssembly.js:47, api/_utils/mandatePromptAssembly.js:174, api/_utils/mandatePromptAssembly.js:192, api/_utils/mandateConfig.js:152]

A local no-network prompt assembly probe failed at import because this fresh worktree lacks firebase-admin. No dependencies were installed and no prompt-size result is claimed. Before a live pilot, measure the exact frozen prompt including tool overhead and the subject-specific evidence packet. The present sparse slate is not a cost estimate for the future research-capable runner.

Batch transport exists, but late results face a four-hour expiry, same-session restriction, and price-drift checks. The final slot does not submit a new batch. These protections do not guarantee useful execution latency. Use direct calls for V1’s scheduled checks and assess batch separately using actual latency/discard rates. [api/_utils/mandateConfig.js:134, api/_utils/mandateExecution.js:120, api/cron/mandate-evaluate.js:331]

The upper-count arithmetic holds: one page of 25 per fire, two 15-minute fires in a 30-minute slot, yields at most 50 book visits. Seven fires within the close window yield at most 175. Time budgets, leases, retries, and other work reduce effective capacity. Two active comparison books consume two visits. [api/cron/mandate-evaluate.js:366, api/cron/mandate-evaluate.js:389, api/cron/mandate-evaluate.js:703, api/_utils/mandateSessionSlots.js:39, api/_utils/mandateConfig.js:215, vercel.json:198]

“Silently miss” needs qualification. Daily rows record eval counts and agencyState, including skipped:not_evaluated. Failures have health fields. There is no complete durable per-slot expected-versus-observed ledger. A day with one successful check and one missed check still reads full under the current derivation. Add a slot ledger before player promises about twice-daily activity. [api/_utils/mandateClosePass.js:108, api/_utils/mandateSchema.js:228]
D2. Data units and fundamentals
Current source verifies 136 default candidate symbols. The daily builder requests fundamentals and corporate actions. The fast builder fetches quotes at three possible eval slots plus close, regardless of one manager’s slower cadence. [api/_utils/mandateCandidateUniverse.js:31, api/_utils/mandateUniverseSnapshot.js:392, api/_utils/mandateUniverseSnapshot.js:403, api/_utils/mandateUniverseSnapshot.js:502, api/_utils/mandateSessionSlots.js:41]

Using the Phase 0 audit’s vendor-billing assumptions, a fully collected symbol costs about four quote units plus two corporate-action units per session, plus ten units when fundamentals miss the cache. That yields 6–16 units per symbol per full session. For 136 symbols the range is 816–2,176 units. About 1,700 is plausible for a particular cache-miss mix, not a fixed daily cost or independently verified current bill. The audit reported its live counter observations at its earlier HEAD. This review did not access those records or vendor billing. [Audit branch: docs/audits/20261112_PHASE0_TEST_PORTFOLIO_AUDIT.md:261, api/_utils/mandateUniverseSnapshot.js:394]

The current counter measures requests. A batched quote request increments once, while the audit’s billing model charges per symbol. It also increments a fresh fundamentals request once rather than ten weighted units. Do not use this counter directly as a billing-unit total. [api/_utils/mandateUniverseSnapshot.js:257, api/_utils/mandateUniverseSnapshot.js:394, api/_utils/mandateUniverseSnapshot.js:502]

The book needs sector classification for its gate, market cap for the current friction tiers, and corporate-action evidence for correct holdings. It does not need the entire fundamentals payload merely to perform paper accounting. The current builder extracts only sector, industry, and market cap from fundamentals. A cheaper versioned metadata source is possible as a future implementation choice, provided it retains provenance, freshness, and unknown behavior. Removing fundamentals today without a replacement changes entry eligibility and cost treatment. [api/_utils/mandateUniverseSnapshot.js:395, api/_utils/mandateGate.js:132, api/_utils/mandateFrictionModel.js:52]

“In the shared list” means no additional marginal quote acquisition for another book using an already collected symbol. It does not mean zero platform data cost. Enlarging the union, overlapping jobs, first-day partial collection, failures, and retries alter the estimate. Bound costs per experiment and per shared universe separately.
D3. Calendar horizon
The maintained calendar contains 2026 and 2027. Mandate slot resolution refuses later years. A 60-session test crossing into 2028 would lose eval and close ticks after the horizon. It would not finish correctly under the current code. The close worker’s 30-day warning helps only while that worker still runs. [src/utils/marketCalendar.js:69, api/_utils/mandateSessionSlots.js:79, api/cron/mandate-evaluate.js:772]

Validate the entire requested session window at creation. Refuse an unsupported window with a clear reason. Extend the calendar through the longest accepted horizon before admitting such runs. This belongs in P1 correctness, even if calendar maintenance remains an operational P5 task.
E1. Contract conflicts and exact replacement clauses
Contract	Finding	Text for V5.1/shared contract V2
BUILD_RULES	The new isolated manager is outside the file fence, but indirect changes to protected behavior still count. Rounded display agreement remains binding. docs/BUILD_RULES.md:26, docs/BUILD_RULES.md:100	“This build changes only the isolated experiment path. Existing fenced behavior and battle snapshots stay unchanged. Any later agent-channel integration receives its own reviewed scope.”
Charter M2	M2 limits the historical game counterfactual miner. A forward paper run is a separate observational path, not an M2 one-step replay and not a proof of market alpha. docs/AGENT_LEARNING_CHARTER_V1.md:22, docs/AGENT_LEARNING_CHARTER_V1.md:32	“Forward portfolio observations are explicitly typed. They do not masquerade as historical one-step counterfactuals or inherit game-learning proof. Branching retrospective simulations remain outside M2.”
Charter proposals and promotion	The present Charter reserves strategy composition for proven lessons and bars per-user market-alpha promotion. V5’s exploratory proposals need an explicit definition without weaker adoption. docs/AGENT_LEARNING_CHARTER_V1.md:48, docs/AGENT_LEARNING_CHARTER_V1.md:83	“An experimental proposal is an unadopted hypothesis, including a new combination of factors. A qualified learned strategy remains a separately governed artifact. Experimental success does not bypass qualification.”
Charter aggregation	Its T3 platform-aggregation language conflicts with the founder’s private-experience boundary if used to export private learned rules. docs/AGENT_LEARNING_CHARTER_V1.md:45	“Private user and archetype-instance experience does not enter another instance’s retrieval, strategies, or learning, including through anonymized aggregation. Shared KB methods require independently approved shared sources.”
Growth Loop ownership	Plays, idea versions, and rule versions have separate owners. A Film Room card is not an idea. docs/design/20261028_GROWTH_LOOP_MAP_V1_2.md:23	“The experiment links the existing card and any existing hypothesis version. It does not duplicate or rewrite either source. Forge reviews the proposal and adoption offer. The framework retains idea-record ownership. The archetype arc retains rule-version ownership.”
Pilot freeze rules	Hypothesis content and battle snapshots are immutable and versioned. docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md:31, docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md:37	“An offer names the exact version and intended future deployment. It never modifies a historical hypothesis, active battle, stake, or vintage.”
Shared contract one door	It forbids every preinstalled ledger read by any prompt. Experimental-agent use needs a narrow explicit exception. docs/design/20261010_PRACTICE_FIELD_FILM_ROOM_SHARED_CONTRACT_V1.md:107	“A frozen proposal is readable by its isolated experimental runner before installation. That exception grants no deployed-agent, memory, consolidation, cross-user, or cross-archetype access.”
Amendment A	Its development/confirmation separation must survive beyond coded-rule cases. docs/design/20261021_PRACTICE_FIELD_CONCEPT_V3_AMENDMENT_A.md:46	“A run used to invent or revise a candidate is development evidence. Any claim of improvement requires new confirmation evidence under the frozen candidate and declared criteria.”


Preserve the Charter’s stronger risk-exit protection rule. A small lower drawdown does not authorize removing stops. Risk proposals need both avoided-loss and forgone-upside evidence, including tails. [docs/AGENT_LEARNING_CHARTER_V1.md:42]
E2. Result words and repeats
Use result wording which names the comparator and measurement:
Finished $1,240 ahead of the SPY reference after modelled trading costs over 10 scheduled sessions. This is one simulated market observation under the recorded setup.

For a genuine candidate/baseline experiment, name the unchanged baseline instead. Add coverage, invested exposure, drawdown basis, costs, and whether the result includes terminal liquidation. Avoid presenting an operational model-spend estimate as a portfolio trading cost.

Recommended states: observed ahead, observed behind, no displayed difference, incomplete, abandoned, and inconclusive. “Tested” means executed, not successful. Do not use a model’s conviction as evidence strength. [V5:52, docs/design/20261021_PRACTICE_FIELD_CONCEPT_V3_AMENDMENT_A.md:38]

A factual history begins with run one. Recommend displaying an aggregate repeat line after at least two comparable completed runs, while showing all attempts, incomplete runs, and abandonments from the start. Two is a UI threshold, not a statistical threshold. “Ahead in 3 of 4 completed runs, 1 incomplete, 0 abandoned” is more honest than an unexplained win rate. Group only compatible candidate versions, comparators, objectives, horizons, and cost/data policies. Mark overlapping windows and repeated market conditions.

“Supported” belongs only to a narrow preregistered hypothesis after its stated confirmation requirements are met and the governing claim policy permits it. No universal repeat count establishes that status. In V1, omit it from portfolio-performance labels. Under the current Charter, do not promote a private market-alpha claim to a proven strategy. [docs/AGENT_LEARNING_CHARTER_V1.md:22, docs/AGENT_LEARNING_CHARTER_V1.md:55, docs/AGENT_LEARNING_CHARTER_V1.md:84]
E3. Build order and honest size
P0 before a founder paper pilot is sensible. P1 as written is not one medium task. P3’s result record and P5’s correctness controls arrive too late. Proposed order:
Package	Deliverable and exit condition
Design lock	V5.1, shared contract V2, and explicit Charter boundaries. Freeze experiment ownership, baseline, prices, risk profile, statuses, adoption, and KB inputs
P0a	Sector-unit normalization, vintage versioning, and boundary tests
P0b	Bounded attributed rationale persistence across direct and batch outcomes
P0c	Idle-data skip with first-book restart and outstanding-submission coverage
P1a	A private agent proposal plus frozen experiment record. One existing case and one proposed change. No live portfolio required
P1b	Offline comparison using synthetic and saved evidence. Prove the runner applies the exact change, preserves the baseline, and records unknowns
P1c	Test lifecycle, one-experiment reservation, immutable runner config, subject membership, cutoff/recovery, final result record, owner access, and evidence retention
P1d	Matched passive comparison and price/CA/cost rules. Founder-only screen and one end-to-end paper run. Mark it as a feasibility observation
P1e	Unchanged-agent comparison where the claim is agent improvement. Hold other inputs fixed and capture actual behavior. This precedes a learning-effectiveness claim
P2	Film Room send-to-test, queue, stages, shelving projections, and return-to-review links
P3	Typed Forge offers, supported existing controls, explicit adoption/rollback records, and proof of no active-battle mutation
Later	Additional game objectives, research-only tests, subjects, capacity, and larger entitlement limits


The full KB is not a prerequisite for these foundations. Before a connected agent test, provide a small reviewed method/evidence packet with stable versions and permission checks. Start with the definitions needed by the first question. Store generated thresholds and results privately. The shared KB must not become a collection of unqualified private lessons.

For the pullback proposal from our Hermes arc, keep the distinction between an entry filter and a complete strategy. Main currently registers only breakout-only-v1 and baseline-control-v1 in this offline runner. It records outcomes as not_observed. The local uncommitted pullback work reported in the conversation is not present at this reviewed main HEAD. Verify that branch separately before reuse. Do not silently assume sizing, exits, or market performance from its logic tests. [scripts/experiments/agent-workspace/experiment.mjs:9, scripts/experiments/agent-workspace/experiment.mjs:96]

The next work in this chat should remain the existing private experiment/KB contract and offline candidate validation. Practice Field implementation belongs with its owner after this design revision. A later integration consumes the same experiment record rather than creating a parallel learning system.
Verification record
- Fetched origin and the specified audit branch. Created and read a fresh detached main worktree. Final status checks were clean in both the review worktree and the original checkout.
- Read V5, the review brief, the Phase 0 audit, the relevant contract documents, and the scoped source dependencies cited above.
- Searched production readers of the named stores, stage enums, snapshot aliases, shared fundamentals key, Mandate scoring stream, and relevant prompt/equip paths.
- Executed pure local probes only. Confirmed 136 candidate symbols. Confirmed copied sector values 3, 2, 3, 2, 3, 4 for analyst, guardian, contrarian, diversifier, Trend Follower, and Speculator. Confirmed a raw cap of 2 incorrectly admits 70% in the sector checker. Confirmed repository pricing arithmetic of $0.015. Confirmed the 2028 calendar rejection. Confirmed row-only metrics omit inception unless supplied.
- The optional prompt-size probe failed before assembly on missing firebase-admin. No model call, market request, Firestore access, dependency install, or source change resulted. Actual prompt-token size remains unmeasured.
- No full test suite or new Mandate acceptance run was performed. This report does not recertify the engine or production deployment.
Reviewed ref: origin/main, fresh detached worktree.

Reviewed HEAD: f79b481a791aa17cad5c0445bd31edddeda60071.

Audit branch: claude/practice-field-test-portfolio-phase0, HEAD a59601c5b643223cacd620e1ac10c3bb6bbe5ac3, audit source base 1e041a022126f48b0d2a2cc9dfc02dd20b465198.

Report path: /workspace/scratch/5401326c5241/practice-field-v5-review/20261112_ASTRA_REVIEW_PRACTICE_FIELD_CONCEPT_V5.md.