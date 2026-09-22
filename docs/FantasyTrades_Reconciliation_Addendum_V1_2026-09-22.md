# FantasyTrades framework reconciliation addendum

Version: 1.0  
Date: 22 September 2026  
Prepared by: Astra  
Status: Implements the founder's accepted reconciliation instructions. Prepared for Fable Review V1.1 and the subsequent docs-only PR. Not a repository commit, implementation approval, or runtime qualification.

## Executive verdict

| Question | Disposition |
|---|---|
| Framework direction | Retain Harness, Trading Brain, and Partnership as responsibilities. Anchor learning and existing components to the governing project record. |
| G04 and G09 | **OPEN. Capture is partial mitigation.** Extend and join the existing capture contract. Adjudicate both findings against code. |
| Capture flag discrepancy | **Resolved at source/history level.** Current inspected `main` has `TICK_CAPTURE_ENABLED = true`. Separate flip PR #884 merged before S2's baseline and reconciled its pins in the same commit. |
| Missing pin-update ceremony | Not substantiated by this check. The flag, true-value assertion, and dark-registry removal changed together. Deployment and rollout-prerequisite evidence remain unverified. |
| Product pilot | **BaggerBomb-embedded, qualified through an offline/advisory stage.** Flat-six remains a qualification setting, not a separate product. |
| Learning | Conformance to the locked Charter, including M1–M4 across eligible episodes with explicit denominators. No qualification from a single trade. |
| In-match influence | Directives remain the one sanctioned in-match user-influence channel. Enumerate and freeze other routes into trading prompts and policy. Conversation does not itself grant influence. |
| Harness | Pi has recorded functional and positive-control results. Unauthorized-read negative control remains pending. Neutral controller and Hermes adapter integration are not established as complete. |
| Next sequence | Deliver S2 → Fable Review V1.1 → founder-merged docs-only PR with the full prerequisite set → expanded read-only audit from a shared on-main baseline. |

## 1. Authority, evidence, and delivery package

This addendum amends `FantasyTrades_Framework_Fable_Review_Handover.docx`. Section 10 below replaces that document's Section 10 in full. It incorporates Fable Review V1.0 as corrected by Astra's response and the founder's accepted condensed response on 22 September. Fable's retracted FR-2 claim is not carried forward. The historical handover, S2 audit, and V1.0 review remain records of what was known and proposed at their respective times.

Evidence labels used here:

- **ADOPTED:** the founder's accepted instruction or decision in this conversation. This does not assert implementation.
- **VERIFIED SOURCE/HISTORY:** repository content or GitHub history read during this check, at the stated commit. This does not establish production behavior.
- **RECORD:** a supplied audit, review, lab artifact, or founder-relayed incident. Its underlying execution was not rerun here.
- **UNVERIFIED:** current deployment, data, test execution, or integration not established by this task.

The three delivery files are:

1. This addendum, including the complete revised audit brief.
2. [FantasyTrades_S2_Architecture_Audit_2026-09-21.md](FantasyTrades_S2_Architecture_Audit_2026-09-21.md), the **complete, byte-identical S2 report**, including G01–G12 and all original citations.
3. [FantasyTrades_Pi_Harness_Identity_V1_2026-09-22.md](FantasyTrades_Pi_Harness_Identity_V1_2026-09-22.md), the committed-quality identity and boundary record.

S2 preservation check: 82,547 bytes, SHA-256 `3cda3071b7349b962f8617b645d907de3596d8ea21cc711ffe231c604e0c435c`. Its original absolute Windows citation targets are intentionally preserved. For repository review, resolve their repository-relative suffixes at S2 commit `1740996d43100a94fa97f9e9958b48c297d2017f`, then re-verify current line anchors. Do not silently rewrite historical evidence or treat old line numbers as current.

## 2. Accepted reconciliation and component anchoring

### 2.1 Learning is governed by the existing Charter

**ADOPTED:** `AGENT_LEARNING_CHARTER_V1.md` governs Phase B learning. The handover's learning lifecycle is an explanatory outline subordinate to that Charter, not a replacement charter or an independent promotion policy.

Use the Charter's exact M1–M4 definitions, maturity gates, eligible-episode rules, and denominators. This task does not reconstruct those definitions from the review. Claims concern behaviors across eligible episodes, never one winning or losing trade. Preserve the discovery/confirmation partition, false-positive calibration, provenance, trial semantics, and rollback. Apply the Charter's T1/T2/T3 distinctions, including the T2 protection ledgers and limits on per-user market-alpha claims, as specified in the governing artifact.

Keep user familiarity, research-process quality, game-craft conformance, and market-alpha claims distinct. A computable one-step alternative score is an evaluation input, not proof of a durable strategy. Evaluator versioning and separation of model, data, policy, and memory effects belong with the Harness/Oracle evaluation work. A ratified Charter does not by itself prove the current reflection and consolidation writers conform to it. G10 remains subject to source adjudication.

### 2.2 Existing components are the starting inventory

The following documents are required anchors for the expanded audit. Unless explicitly covered by the narrow source check in Section 3, their descriptions come from Fable's record and the founder's accepted direction. The auditor must resolve their exact paths, adopted versions, and current code consumers before asserting implementation.

| Responsibility or component | Required anchor and audit treatment |
|---|---|
| Learning law | `AGENT_LEARNING_CHARTER_V1.md`. Evaluate conformance, including M1–M4, rather than design a parallel lifecycle. |
| SignalDrop intake and debate | `SIGNAL_DROP_V2_SPEC.md` and `FANTASYTRADES_SIGNAL_DROP_HANDOVER_APR28_2026.md`. Verify parser, content hash, injection guard, ticker validation, dialogue phases, cache, sessions, and watchlists. |
| Watchlist equip and provenance | `WATCHLIST_EQUIP_SYSTEM_REFERENCE.md`. Trace `sourceDropId`, `sourceSessionId`, `agentId`, thesis, equip snapshot, and hash through actual writers and readers. |
| Decision capture | `docs/specs/CAPTURE_BUILD_SPEC_V1_4.md`, `CAPTURE_BUILD_SCOPE_AMENDMENT_A_V1_1_SEP19_2026.md`, and `docs/audits/20260921_BUILD_TICK_CAPTURE.md`. Preserve existing records and evaluate remaining joins and evidence-timing gaps. |
| Review and durable learning record | `FORGE_RECORD_DESIGN_V1_1.md`, the Forge Record Phase 0 report, and current Film Room direction. Resolve the Phase 0 report's exact filename and merge state in the docs PR. |
| User-influence controls | Directive gate, fit check, cautious register, grounding walk, and directive-judge shadow specification. Trace actual enforcement modes and consumers. |
| Research surfaces | Rankings, screening, scouting, FantasyTimes/consensus, DRB, and Vera deepdives. Inventory reachability, data, constraints, and reuse without assuming every surface is enabled. |
| Monitoring data | `INTRADAY_DATA_BUILD_1_SPEC_V3.md`, Amendment A, and subsequent adopted build/qualification records. Separate collection, diagnostics, agent use, price-source adoption, and risk activation. |
| Evaluation ownership | Regime Taxonomy §1, `metricSnapshots`, and the Harness/Oracle record. Clarify the interface to the external lab without claiming an existing connection. |
| JEV | `20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md` and `JEV_EVALUATION_LAYER_ROADMAP_BOOKMARK.md`. Preserve D-24 and the adopted ordering. |
| Unified remediation record | `20260920_INTEGRITY_FINDINGS_REGISTER_V1.md`. Fold G01–G12 into this register with their identifiers and source provenance retained. |

### 2.3 Lifecycle, freeze, and pilot corrections

**ADOPTED lifecycle correction:** publication time, intended horizon, and lifecycle status are candidate gaps to verify. A lifecycle is a state machine. Before sizing, specify allowed transitions, transition owner, evidence or user event required, expiry, rejection, cancellation, terminal states, and behavior after equip. Editing a saved thesis must not silently rewrite the version frozen into an active battle. Verify whether missing values are absent, stored elsewhere, or lost between existing stores. Do not assume three new fields complete the work.

**ADOPTED freeze correction:** enumerate every route capable of influencing the trading prompt or policy. Include standing leans, preferences, reflections, consolidated insight, lesson retrieval, suggestion acceptance, automatic debrief cron output, watchlist/equip state, model and prompt versions, and any indirect reader of mutable agent state. The founder reports the auto-debrief cron produces suggestions without a user turn. Generation, persistence, acceptance, retrieval, and application are separate transitions to trace. Directives remain the one sanctioned in-match user-influence channel and still pass the existing authority gates. Normal authorized market inputs and deterministic game/risk controls continue under the fixed policy. Discussion may continue, but it must not become a second path around the frozen trading configuration.

The audit must identify rated/backed match or week boundaries, which versions are pinned, when queued changes take effect, and how the sanctioned directive route is logged. It must not claim the freeze exists merely because the policy requires it.

**ADOPTED pilot correction:** the product journey is BaggerBomb-embedded. Its qualification begins offline/advisory. The flat-six advisory proposal originates in **S2 Section I**, not a separately adopted product decision in S3. It uses one Trend Follower, the existing flat-six training policy, one versioned setup, no additional live execution authority, recorded verification, and frozen automatic learning for comparison. Flat-six success does not qualify untested tiered-mode behavior. The broader audit sizes the SignalDrop → research → discussion → watchlist → equip → battle → Film Room journey using existing components.

### 2.4 Findings and incident evidence

**G04 and G09 enter the unified register OPEN, with capture as partial mitigation.** Fable retracts “closed on paper.” G04 concerns decision-visible evidence versus later observation. G09 concerns a joined lifecycle and the state used for final disposition. Preserve their distinct scopes even where they share evidence.

The founder-relayed ledger adds two named trace cases: a forced-exit score reading the pre-exit snapshot, and a Film Room header showing −176 while the deciding score read +125 with no directive record. These are **RECORD** evidence supplied for code adjudication, not incidents independently reproduced by this task. Map them to the applicable register entries without replacing the original G04/G09 definitions or assuming every symptom has one root cause.

Retain the 14 September Speculator incident as a separate personalization/authority trace case: requested Core-to-Support protection, gate classification `in_archetype`, recorded SP-05, and a reply describing a different adjustment. Verify the current gate, grounding, persistence, and rendering paths against that record.

## 3. Narrow read-only capture check

### 3.1 Method and baseline

There is no application Git checkout in this conversation workspace. `git rev-parse --show-toplevel` returned “not a git repository.” The equivalent source/history check used read-only GitHub access to `fashraf94/TradeSeven`. No branch, repository file, commit, PR, flag, deployment, or database was changed. No tests were run. This is not a claim of a local worktree inspection or a production check.

The GitHub `main` branch resolved to **`463a375fc4192c51dfa1cce669ff8a5a13305c6a`**, whose recorded commit time is 22 September 2026, 03:36:24 UTC. File checks were pinned to that SHA. The check was completed on 22 September 2026. Future sessions must resolve current `main` again.

`CLAUDE.md` and `docs/BUILD_RULES.md` were read. Root `AGENTS.md` returned 404 at the inspected `main`; this does not assert absence on other branches. BUILD_RULES §2 specifies same-commit pin reconciliation. Its §3 covers discovery, source citations, and file delivery. The additional requirement to land the entire prerequisite set on `main` before opening this expanded audit is also an explicit founder instruction in the present reconciliation. Do not misquote that additional requirement as verbatim text in the inspected §3.

### 3.2 Verified results

| Check | Result and evidence |
|---|---|
| Current-main flag | **VERIFIED SOURCE: true**, `src/config/featureFlags.js:2692`. [Pinned source](https://github.com/fashraf94/TradeSeven/blob/463a375fc4192c51dfa1cce669ff8a5a13305c6a/src/config/featureFlags.js#L2692). |
| Live value pin | **VERIFIED SOURCE: pins true**, `src/config/tickCaptureFlags.test.js:30–35`. The test remains a tripwire. [Pinned test](https://github.com/fashraf94/TradeSeven/blob/463a375fc4192c51dfa1cce669ff8a5a13305c6a/src/config/tickCaptureFlags.test.js#L30-L35). |
| Dark registry | **VERIFIED SOURCE: TICK_CAPTURE_ENABLED is absent from DARK_BY_DESIGN**, with the removal explained at `src/config/flagPinGuard.test.js:83–92`. The test asserts absence at `tickCaptureFlags.test.js:45–55`. [Registry](https://github.com/fashraf94/TradeSeven/blob/463a375fc4192c51dfa1cce669ff8a5a13305c6a/src/config/flagPinGuard.test.js#L83-L92), [assertions](https://github.com/fashraf94/TradeSeven/blob/463a375fc4192c51dfa1cce669ff8a5a13305c6a/src/config/tickCaptureFlags.test.js#L45-L55). |
| Guard remains applicable | `featureFlags.js` remains in `FLAG_SOURCE_MODULES` at `flagPinGuard.test.js:45–49`; the contradiction and dark-registry checks remain at `:321` and `:349`. [Guard source](https://github.com/fashraf94/TradeSeven/blob/463a375fc4192c51dfa1cce669ff8a5a13305c6a/src/config/flagPinGuard.test.js#L321-L365). |
| Separate flip PR | **VERIFIED HISTORY: PR #884**, merged to `main` on **21 September 2026 at 20:58:08 UTC**, merge commit `3753af78f1649a2243253f2918f0b65e80bac047`. [PR #884](https://github.com/fashraf94/TradeSeven/pull/884). |
| Same-commit ceremony | PR #884 has one change commit, `ed16c3f374e05bc01deca7a7a328cb0b97d2b1c8`. Its diff changes the flag, true pin, and dark-registry entry together, with corresponding documentation. [Change commit](https://github.com/fashraf94/TradeSeven/commit/ed16c3f374e05bc01deca7a7a328cb0b97d2b1c8). |
| Build versus flip | The capture build PR #882 merged earlier on 21 September at 18:53:35 UTC. “Built dark” describes the build stage. It does not describe the source default after the later flip. [PR #882](https://github.com/fashraf94/TradeSeven/pull/882). |
| S2 relationship | The flip merge is an ancestor of S2 `1740996d`. The S2 flag was re-read and is true. The flag file's blob SHA is identical at S2 and inspected current `main`: `1ca84884a72488678352020ac4ecef98d87b90c0`. [Ancestry comparison](https://github.com/fashraf94/TradeSeven/compare/3753af78f1649a2243253f2918f0b65e80bac047...1740996d43100a94fa97f9e9958b48c297d2017f), [S2 source](https://github.com/fashraf94/TradeSeven/blob/1740996d43100a94fa97f9e9958b48c297d2017f/src/config/featureFlags.js#L2692). |

**Disposition:** no missing same-commit pin-update process finding is supported by this check. The “flip pending” ledger statement needs reconciliation to PR #884. Do not open a second flip PR or change the flag under this task. Historical dark-build specifications should be read with the subsequent activation record.

**Remaining limits:** the flag and PR do not prove deployed configuration, active collection, corpus size, first successful capture date, TTL enforcement, index deployment, measured overhead, record sizes, or coverage reporting. PR #884 reports test results, but those were not independently executed here. The source comments state prerequisites were met; comments are not the underlying operational evidence. Obtain approved deployment/rollout records for those claims. Do not retain “zero corpus” or claim JEV readiness solely from the source flag.

### 3.3 Nearby baseline correction relevant to the brief

The already-read flag file also shows `INTRADAY_COLLECT_ENABLED = true` at line 2587, diagnostics false at 2605, agent use false at 2616, price source `legacy` at 2628, and risk activation false at 2642. [Pinned intraday flags](https://github.com/fashraf94/TradeSeven/blob/463a375fc4192c51dfa1cce669ff8a5a13305c6a/src/config/featureFlags.js#L2587-L2642). GitHub shows inspected `main` nine commits ahead of S2, including Intraday work merged through PRs #886/#887. [Comparison](https://github.com/fashraf94/TradeSeven/compare/1740996d43100a94fa97f9e9958b48c297d2017f...463a375fc4192c51dfa1cce669ff8a5a13305c6a).

Therefore the revised brief does not repeat Fable V1.0's blanket “spec'd, not built” description as a current fact. Collection, usable evidence, and qualified trading use are distinct. This task did not audit Intraday implementation or deployment. Monitoring vocabulary remains limited to verified available cadence and signals, with no intraday-agent promise before the applicable gates pass.

## 4. Harness status and unresolved boundaries

The companion identity file answers A1–A4 with explicit limits. Pi is an independent runtime, not a Hermes child agent. Its positive-control artifact records Pi 0.85.1, provider `openai-codex`, model `gpt-5.6-sol`, thinking off, and independent verification pass for one named run. That is a positive-control result, not completion of all Stage 2C qualification. The unauthorized-read negative control remains pending under the accepted status. The neutral controller remains subsequent work.

The long-term architecture keeps Hermes and Pi as independent peer execution engines behind a neutral Harness Controller. Hermes Desktop as a future control surface is an architectural direction, not an established connection. No superseding decision changes the 13 September firewall. The VPS operations agent, its machine, credentials, and peer route are out of scope. **Which Hermes instance or role a future execution adapter targets: UNDECIDED.** Naming Hermes in a target architecture does not resolve that decision.

Harness/Oracle evaluation definitions and application `metricSnapshots` are distinct from the lab's runner/controller/verifier implementation responsibilities. Their precise shared contract and ownership map remain to be documented. Independent verification supplies evidence; the Founder retains acceptance/promotion authority. The application retains deterministic live-action authority. No application adapter or completed cross-system integration is certified by this addendum.

## 5. JEV adoption and document landing

**ADOPTED:** the JEV adjudication receives an **“adopted by founder, 19 Sep 2026”** stamp in the docs PR. Conversation-blessed rulings must be stamped on the committed artifact with the adoption date and version. This resolves the discrepancy between the prior file's “proposed” label and the accepted decision without rewriting S2's historical observation.

Preserve D-24: JEV has no decision-seat, trigger-gate, or risk-engine authority. Preserve the adopted ordering: J1 log-only explanation/evidence-support audit via the specified offline comparison, J2 archetype-preference comparison later, J3 battle-wide review parked. Use the adjudication's exact experiment and corpus gates. Do not infer readiness or a calendar start from a merged capture flag. Preserve the existing-model restructure comparison before adding a vendor where required by the bookmark.

The docs-only PR should land the unified Integrity Findings Register, the complete S2 report, the framework handover, this addendum, the Pi identity record, Fable Review V1.1, the Forge Record Phase 0 report, and the stamped JEV adjudication. Resolve exact paths and update the canonical documentation index. Existing governing specifications should be referenced at their adopted versions, not copied into competing variants. Fable owns Review V1.1 and the commit checklist. The Founder alone merges. No such PR, commit, or merge was performed by this task.

## 6. Fable redline disposition map

| Fable Section 7 redline | Incorporated correction |
|---|---|
| 1. Unified register | G01–G12 join the unified register with original IDs, citations, and separate dispositions. No second live findings ledger. |
| 2. Baselines | Resolve fresh `main`; compare S2 `1740996d` and DCR `0871937c` where relevant. This check pins `463a375f`, not a timeless current-main claim. |
| 3. Capture contract | Name V1.4, Amendment A, retention, flag, and **merged flip #884**. G04/G09 stay open with partial mitigation. |
| 4. Learning/Forge | Charter governs; exact M1–M4 and Forge records are required references. |
| 5. SignalDrop | Seed the three existing specifications; verify provenance, trust controls, candidate field gaps, and id carriage. |
| 6. Intraday | Preserve the staged gates and historical VWAP census. Refresh implementation status rather than repeat “not built.” |
| 7. Authority incident | Include the 14 September Speculator incident as a named trace case. |
| 8. JEV | Adopted 19 September, stamped in docs PR; D-24 and ordering retained. |
| 9. External harness | Identity recorded; controller/adapter completion unverified; future Hermes target undecided; firewall retained. |
| 10. Session prerequisites | Read BUILD_RULES and fresh-main documents. The founder's explicit on-main prerequisite gate applies before opening the expanded audit. |

## 10. Revised expanded capability and reuse audit brief

**Use this entire section as the replacement for Section 10 of the framework handover. It is a discovery task, not an implementation task.**

### Mission, authority, and opening gate

Audit FantasyTrades for the smallest justified extension of its existing components into a BaggerBomb-embedded personalized agent journey: SignalDrop or another supported idea input → bounded research → discussion → watchlist → equip → battle → evidence-grounded review. Qualify proposed behavior offline/advisory first. Preserve the three responsibilities: Partnership owns user intent and continuity, Trading Brain owns evidence-based proposals and archetype behavior, and Harness responsibilities own authorized execution, controls, evidence, and qualification. These responsibilities do not mandate new services or models.

Before this audit session opens, the founder-merged docs-only PR must put the full prerequisite set on `main`: the unified Integrity Findings Register, complete S2 audit, framework handover, reconciliation addendum, Pi/harness identity, Fable Review V1.1, Forge Record Phase 0 report, and JEV adjudication stamped “adopted by founder, 19 Sep 2026.” Confirm the governing Charter and component specifications are available through the canonical index. Resolve the Phase 0 report's exact filename and approved version. A chat transcript alone does not satisfy this gate.

Read applicable `AGENTS.md`, `CLAUDE.md`, `docs/BUILD_RULES.md` (especially §2 and §3), discovery instructions, canonical indexes, and approved scope rules. The founder prepares a fresh task branch from current `main`, preferably `codex/partnership-learning-reuse-audit`. Report branch, HEAD, and clean-tree status. Follow the repository's opening gate for any mismatch. Fetch `origin` before comparing remote-tracking refs and record the result. Fetch/deepening is permitted for investigation under BUILD_RULES §3. Do not switch or create branches mid-audit.

Project-state authority is read-only. Do not edit repository files, change flags, install dependencies, migrate data, regenerate indexes, add tests, commit, push, open a PR, merge, deploy, or delete anything. Return a report file outside the repository and a concise summary. Only the Founder merges to main/master. Do not read secrets, production user records, private conversations, or private runtime data. Use source, schemas, fixtures, approved documentation, and already-approved operational evidence. Record access limits without bypassing them.

Inspect tests as source. Run an existing test only after establishing isolated offline operation without credentials, paid calls, live writes, installation, or project-state mutation. Direct optional artifacts outside the repository. Otherwise label execution unverified. Do not claim a passing isolated test proves the whole user journey.

### Baseline and evidence discipline

Record repository, branch, exact commit, local changes, verified remote relationship, and any separately established deployment relationship. Compare current `main` against S2 `1740996d43100a94fa97f9e9958b48c297d2017f` and DCR baseline `0871937c` where a register entry uses it. Resolve short SHAs rather than guessing their full value. The reconciliation's narrow check inspected `main` at `463a375fc4192c51dfa1cce669ff8a5a13305c6a`; this is a historical anchor, not permission to skip a fresh fetch.

At that checked main, `TICK_CAPTURE_ENABLED` was true, pinned true, and absent from the dark registry. Separate PR #884 merged on 21 September and reconciled all three in commit `ed16c3f374e05bc01deca7a7a328cb0b97d2b1c8`, before S2. Verify subsequent changes. Do not describe capture as still dark, flip pending, or zero corpus without current evidence. A flag is not proof of deployed capture or corpus sufficiency.

Label each material claim as verified source, executed test, inspected test source, adopted specification, founder/incident record, inference, or unverified runtime fact. Cite current `path:symbol:line`, caller conditions, relevant schema fields, flags, and tests. Record commands and scope for any executed test. Distinguish missing capability, incomplete connection, disabled feature, stale documentation, intended mode restriction, and incomplete inspection. Missing audit coverage does not establish missing functionality.

Search by behavior and feature aliases. Trace UI routes, endpoints, jobs, writers, readers, prompts, schemas, permissions, fixtures, flags, and consumers. Do not assume declared fields are used. Bound all absence claims. Prefer extending existing records to creating parallel schemas.

### 10.1 SignalDrop

Start from `SIGNAL_DROP_V2_SPEC.md`, `FANTASYTRADES_SIGNAL_DROP_HANDOVER_APR28_2026.md`, and `WATCHLIST_EQUIP_SYSTEM_REFERENCE.md`. The Founder identifies SignalDrop as built and tested. Verify supported article/tweet/link/pasted-content intake, parsing, injection guard, content hash, ticker validation, partial-source handling, and explore/propose/refine/finalize dialogue. Treat article instructions as untrusted content. Inspect the guard's implementation and safe test evidence; do not certify runtime behavior from a specification alone.

Trace `origin`, `contentSnippet`, `sourceUrl`, `parseId`, `sessionId`, `signalDropCache`, `watchlistSessions`, per-ticker reasoning/category/addedAt, `sourceDropId`, `sourceSessionId`, write-once `agentId`, thesis, and equip hashes wherever those fields exist. Verify their actual schema and consumers. Test the reported absence or loss of publication time, intended horizon, and lifecycle status. Determine whether original hypothesis identifiers reach capture directly or only through reconstruction from frozen equip state.

Treat lifecycle as a state machine: transitions, expiry, ownership, authority, rejection, cancellation, post-equip changes, and terminal states must be specified before sizing. Do not recommend a new intake/debate system without evidence against reuse.

### 10.2 Other interaction and research surfaces

Inventory ordinary agent chat, Forge conversation/analysis, watchlist creation/equip, scouting, natural-language screening, theme research, rankings, FantasyTimes/consensus, DRB, Vera deepdives, directives, settings, explanations, receipts, Film Room, and post-game review. Include alternate names and omitted capabilities. Inspect disabled assets for reuse while retaining their disabled status. Identify what is reachable, gated, experimental, superseded, orphaned, or externally owned.

### 10.3 Complete user journeys

Trace idea → discussion, conversation → hypothesis, theme → shortlist, shortlist → deeper research, hypothesis → watchlist, watchlist → equip/battle, condition → monitoring, proposal → execution/rejection, and outcome → review/candidate memory. For each transition identify the owner, stored identity/version, evidence cutoff, what is dropped, mode restrictions, failure behavior, and user-visible result. A rejected idea or supported wait must complete a useful journey without a manufactured trade.

The product pilot is BaggerBomb-embedded and qualifies offline/advisory first. S2 Section I's flat-six Trend Follower setting is an initial qualification simplification. It does not replace BaggerBomb or qualify untested tiered-mode behavior.

### 10.4 State, provenance, and reusable contracts

Inspect existing SignalDrop records, saved theses, watchlists, Vision variants, chat/preferences, `agentContext`, resolved manifests, decision tools, capture bodies, learning receipts, lesson stores, and Mandate vintages/envelopes. Trace writers and readers rather than equating similar field names. Identify the current source of truth, ownership, lifetime, versions, expiry, deletion rules, and permitted mutation for each record. Distinguish archetype core, personal preferences, temporary hypotheses, research records, decisions, and accepted lessons. Recommend extension points only after this map.

### 10.5 Research orchestration and monitoring honesty

Determine support for screening a bounded universe, deeper investigation of selected candidates, alternative comparison, missing-evidence reporting, and stopping under a budget. Screening 50 names and presenting up to three opportunities is illustrative, not a requirement to fill three slots. Report actual screened, investigated, excluded, and data-missing counts. Inspect batching, caching/freshness, retry, cancellation, concurrency, and latency/cost instrumentation without inventing savings.

Read `INTRADAY_DATA_BUILD_1_SPEC_V3.md`, Amendment A, and subsequent adopted build/qualification records. Preserve stage boundaries: collect → diagnostics → agent use → price source → risk activation. The narrow reconciliation check found collection enabled, diagnostics/agent use/risk activation disabled, and price source `legacy`; implementation and deployment beyond that check require fresh evidence. Do not repeat the old blanket “spec'd, not built” description.

Report monitoring at its true observable cadence. Restrict initial vocabulary to supported daily conditions unless intraday use is independently qualified. Preserve the closed historical VWAP census as a dated ledger fact rather than rerunning it. Inspect current data consumers for the pilot and distinguish new evidence from that historical census. Document whether qualified intraday monitoring is a pilot prerequisite or deferred product scope; do not invent an adopted answer.

### 10.6 Personalization, authority, and in-match freeze

Trace attention, factual belief, permission, and executable action as separate transitions. Verify explicit/inferred preferences, source claims, temporary hypotheses, correction, deletion, scope, expiry, precedence, and disagreement. Use the 14 September Speculator incident as a named test/trace case: requested Core-to-Support protection, `in_archetype` classification, SP-05 record, and inconsistent narrative. Establish what the current gate and grounding walk actually enforce.

Produce a complete prompt-influence map. Include leans, preferences, reflections, consolidated insight, lessons, auto-debrief cron suggestions, their acceptance paths, watchlist/equip changes, retrieval, model/prompt versions, and mutable state read during a match. Distinguish generating a suggestion from applying it. **Directives are the one sanctioned in-match user-influence channel**, bounded by existing gates. Other conversations must not silently update the active trading configuration. Normal authorized market evidence and fixed deterministic controls continue.

Specify pinned versions, activation boundaries, queued-change behavior, and logging for rated/backed play against the Backing beta specs V1.3 and Amendments A/B. Test for bypass through background writers as well as user turns. Report missing freeze enforcement as a gap, not as an implemented guarantee.

### 10.7 Learning and evaluation conformance

Read `AGENT_LEARNING_CHARTER_V1.md` as governing, together with `FORGE_RECORD_DESIGN_V1_1.md` and the merged Forge Record Phase 0 report. Evaluate conformance to the Charter's exact M1–M4, maturity stages, false-positive gates, P1/P2, and territory rules. Claims concern behavior across eligible episodes with explicit denominators, never individual trades. Keep per-user market-alpha claims within the Charter's limits and preserve T2's dual ledger.

Trace reflection, consolidation, detector outputs, confidence changes, candidate lessons, accepted lessons, promotion, trial, retirement, rollback, and downstream prompt use. Separate current code from intended Phase B policy. Track discovery/confirmation separation, outcome leakage, eligibility, missingness, sample sufficiency, and evaluator independence. Version evaluator, policy, model, tools/data, game rules, and accepted memory. Separate platform upgrades from learned changes. Route evaluation-contract recommendations to Harness/Oracle ownership rather than invent a competing evaluator.

JEV ordering is adopted on 19 September and must be stamped in the committed adjudication. Read `20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md` and `JEV_EVALUATION_LAYER_ROADMAP_BOOKMARK.md`. D-24 stands. J1 is the log-only explanation/evidence-support auditor through its specified offline comparison and exact-packet corpus gate; J2 follows; J3 remains parked. Preserve the required comparison to the existing-model restructure. No live trading authority or vendor hop follows from this audit. Corpus readiness requires evidence, not a calendar estimate or source flag.

### 10.8 Capture, evidence, and explanation

**Evaluate the merged capture contract, extend and join it, and adjudicate G04/G09 against code. Both stay OPEN with capture as partial mitigation.**

Read `docs/specs/CAPTURE_BUILD_SPEC_V1_4.md`, `CAPTURE_BUILD_SCOPE_AMENDMENT_A_V1_1_SEP19_2026.md`, the tick-capture build report, and flip PR #884. Distinguish build-dark history from the later true default. Verify current flag/pin/registry state and subsequent changes. Preserve the existing primitive/text separation, permanent allowlist, and 120-day text retention contract. Do not infer deployed TTL enforcement from an `expireAt` field.

Trace the original model request/response, per-tick identifiers, shown evidence, eligible alternatives, skip/failure reasons, frozen controls, original proposal, overrides, verifier result, final action/rejection, and relevant state revision. Determine which facts were available before the decision and which were refetched later. A fluent retrospective explanation is insufficient evidence of what informed the decision.

Evaluate hypothesis/watchlist/SignalDrop id carriage and setup/evidence-cutoff joins against the existing records. Do not create a second episode schema by default. Carry the founder-relayed forced-exit pre-exit snapshot and Film Room −176 versus deciding +125/no-directive-record cases into source adjudication. Preserve incident provenance and separate symptoms until the causal trace is established.

Require evidence specific to each G finding before closure. A merge, specification, HTTP transcript, pin-consistency check, or shared incident resemblance does not resolve evidence-timing and full-lifecycle gaps by itself.

### 10.9 Modes and external harness boundaries

Compare fixed-slot BaggerBomb, tiered behavior, tournament constraints, training qualification, and Managed Mandate cash/share semantics. Preserve exit/wait/horizon differences and frozen equip behavior. Define idea continuity after a game ends and after saved-state edits.

Read the committed Pi/harness identity. Pi and Hermes are independent peers in the target architecture. Pi's current proof is bounded to the recorded functional and positive-control scope; the unauthorized-read negative control remains pending unless newer qualified evidence is supplied. The neutral controller is later work. The boundary is tool-enforced, not an operating-system sandbox. The future Hermes adapter target is **undecided**. No superseding decision alters the VPS ops firewall. Its machine, credentials, and peer route remain outside this audit.

Inspect only application-side contracts and supplied external evidence. Do not access external lab machines or claim an adapter is absent globally because it is not in this repository. Clarify the relationship to Regime Taxonomy §1 and `metricSnapshots`: evaluation definitions and platform measurements are not proof of completed lab integration. The Founder retains acceptance authority, independent verification supplies qualification evidence, and application controls retain live execution authority.

### 10.10 Unified findings register and reuse risks

Use `20260920_INTEGRITY_FINDINGS_REGISTER_V1.md` as the sole live findings register. Fold in G01–G12 with existing prefixes, original S2 citations, baseline, current evidence, owner, and disposition. This read-only task proposes register updates in its external report; it does not edit the register. Cross-reference SI/SEC/DCR/PLC and other existing entries rather than renumbering or silently collapsing findings.

G04 and G09 enter OPEN with capture as partial mitigation. Reassess other findings where scope overlaps or baseline changed. Keep G01–G04, G06, G09, G10, and G11's narrow ADD-slate conflict visible. Separate control remediation, missing connections, intended mode limits, and new product choices. A memory note should not compensate for defective deterministic controls. Preserve justified separation between mode enforcers, client/server boundaries, and permanent/retained records.

### 10.11 Inventory gaps and preservation

After the named journeys, inspect adjacent menus, routes, services, schemas, tests, and approved indexes for omitted capabilities. List relevant existing components absent from this brief. State search bounds and uninspected areas. Do not claim an exhaustive census if coverage is incomplete.

For each proposed component choose reuse unchanged, extend, connect, consolidate, defer, or build new, with evidence. Any later removal/replacement requires caller/dependency coverage, data ownership, historical preservation, migration impact, replacement behavior, and rollback. This audit authorizes none of those mutations.

### Required report and stopping point

Return a Markdown report file outside the repository. Lead with an executive verdict table understandable to the Founder. Include:

1. Exact baseline, opening-gate verification, inspected areas, exclusions, and evidence labels.
2. Capability inventory with aliases, user purpose, entry points, active conditions, owners, stored state, consumers, citations, test-source evidence, and separately identified executed tests.
3. SignalDrop-to-review journey map, provenance/id-carriage map, and candidate field-gap adjudication.
4. Lifecycle state-machine requirements and post-equip semantics before effort sizing.
5. State/authority and prompt-influence maps, including cron-generated suggestions, sanctioned directives, and rated/backed freeze gaps.
6. Charter conformance assessment using exact M1–M4, eligible-episode denominators, promotion controls, and evaluator ownership.
7. Capture conformance/delta assessment and separate code dispositions for G04/G09, initially open with partial mitigation.
8. Proposed updates to the unified register, preserving every G identifier and linking overlapping findings. Use open, narrowed, expanded, resolved-with-evidence, or unverified-on-baseline with justification. Do not maintain a competing live ledger.
9. Ranked findings with consequence, source/incident evidence, limiting conditions, test/reproduction status, affected journey, owner, and smallest next action.
10. Reuse dispositions and a minimum-change BaggerBomb pilot qualified offline/advisory first. State prerequisites, acceptance cases, rollback, work-category estimates with uncertainty, and remaining founder decisions. Do not invent delivery dates, completion percentages, or a three-field effort estimate.
11. Coverage matrix for all eleven inspection areas and an explicit list of runtime/external evidence still needed.

Stop after the report. Do not remediate findings, activate flags, implement the framework, or alter the existing controls.
