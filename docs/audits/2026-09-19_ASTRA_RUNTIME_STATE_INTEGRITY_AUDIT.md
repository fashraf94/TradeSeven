# FANTASYTRADES RUNTIME STATE INTEGRITY AND CORRECTNESS AUDIT

Static defensive architecture review — 2026-09-19

> Publication note — 2026-09-20: Added to the repository at the owner's request. The findings and 13-section structure below are the original static audit of commit 6cd3699a220aacd5c8669ac2aade6d91216da5b1. Source links now point to that immutable revision. Statements about read-only work, no network access, and unchanged repository state describe the audit phase; this later documentation-only commit and push are separately authorized. The findings have not been re-audited against subsequent commits.

- Repository: fashraf94/TradeSeven
- Branch: audit/astra-state-integrity
- HEAD: 6cd3699a220aacd5c8669ac2aade6d91216da5b1

Audit-phase initial and final working tree: clean. HEAD and branch remained unchanged. No repository files, branches, commits, or remote state changed during the audit.

## SECTION 1: EXECUTIVE VERDICT

| Question | Verdict |
|---|---|
| Does the reviewed code establish reliable authority for all live state transitions? | **No. Eight High and seven Moderate static findings survive source review.** |
| Highest-priority boundary | Stored agent identity can replace the document identity and reach another agent's authoritative record and learning writes (F01). |
| Other direct authority defects | Owner-editable battle controls reach swap execution (F02); the legacy opponent initializer can rewrite fresh League scoring inputs (F03). |
| Most consequential ordinary correctness defects | Cached intraday scores become final (F04); session-unscoped canonical opens affect later legs (F05); incomplete quotes can become final League scores (F06). |
| Concurrency verdict | Deploy admission, evaluation state, daily reset, and reflection acknowledgment do not share sufficiently strong commit-time invariants (F07–F09, F13). |
| Production impact established? | **UNKNOWN.** This review establishes repository paths, not deployed configuration, affected records, incident frequency, or dynamic exploitability. |
| Critical findings | None assigned. High priority does not depend on demonstrating an attack. |

**VERIFIED** in this report means the cited implementation was read during this review and the stated source-to-consumer path is statically complete. It does not mean reproduced, tested against a running service, or observed in production. Severity reflects the potential correctness consequence and breadth of the path. OBSERVATION identifies a verified local property whose wider defect path or intended contract is incomplete; UNKNOWN identifies evidence unavailable under the static-only scope.

The attached orientation was useful navigation, not proof. Two relevant corrections emerged: current casual deploys generate their CPU opponent on the server ([api/agent/decide.js:892–928](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L892-L928)), and manifest advisory fields do have a reader expression in the evaluator prompt assembler, although the composition path is gated ([api/_utils/agentEvalPromptAssembly.js:790–797](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentEvalPromptAssembly.js#L790-L797)). The report does not repeat the memo's broader claims about those paths.

The supplied Sections 1–13 are preserved exactly. The original audit artifact was saved outside the repository, as required by [docs/BUILD_RULES.md:62](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/docs/BUILD_RULES.md#L62). The user's no-network instruction took precedence over the usual fetch instruction; no remote comparison or claim of current-main parity was made.

## SECTION 2: TRUST BOUNDARY MAP

All rows below are VERIFIED implementation boundaries; findings and limits are identified separately.

| Source state | Writer / admission | Authority transition | Live consumer | Principal concern |
|---|---|---|---|---|
| Client-created agent document | Firestore agents create rules | Stored object becomes hydrated agent identity and battle.agentId | Completion and reflection write target | F01; [firestore.rules:248–309](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L248-L309); [api/agent/decide.js:158](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L158); [api/_utils/agentBattleService.js:130](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L130) |
| Owner-editable battle controls | Firestore battle update allowlist | Pending proposal / meeting becomes an executable swap | Admin-SDK swap transaction | F02; [firestore.rules:434–437](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L434-L437); [api/cron/agent-evaluate.js:3337–3433](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L3337-L3433) |
| Client opponent and baseline data | Authenticated set-opponent handler | Inputs overwrite battle scoring maps | Evaluator and locked trade scorer | F03; [api/agent/set-opponent.js:29–104](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/set-opponent.js#L29-L104) |
| Mutable agent configuration | Settings endpoint and deploy projection | Frozen agentContext | Evaluation prompt and guardrails | Snapshot is useful, but cannot establish input validity; [api/_utils/agentBattleService.js:181–229](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L181-L229) |
| Quotes and portfolio state | Evaluation tick | scoreState becomes outcome / cumulative agent score | Completion, League banking, learning | F04/F08; [api/cron/agent-evaluate.js:805–940](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L805-L940); [api/_utils/tournamentBanking.js:61–85](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L61-L85) |
| Canonical opening quote | Snapshot writer | Symbol-only round snapshot becomes later leg baseline and exit value | User-layer scorer | F05; [api/_utils/canonicalOpen.js:107–136](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/canonicalOpen.js#L107-L136) |
| Partial market quote set | Nightly banking | Numeric zero becomes recorded daily score | Waiver priority, ranking, advancement | F06/F10; [api/_utils/tournamentBanking.js:313–410](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L313-L410) |
| Proposed portfolio swap | Model/risk/control handlers | Transaction rewrites portfolio, bench and trades | Later guards, scores and prompts | F08/F11/F12; [api/_utils/agentSwapExecution.js:152–367](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L152-L367) |
| Completed battle | Reflection queue | Model result becomes persistent memory | Deploy and consolidation prompts | F13–F15; [api/agent/reflect.js:132–203](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L132-L203) |
| Tournament claim | Token-derived user + placement validation | Transaction resolves ownership/pool changes | Banking of current and dropped picks | Placement and resolution have useful checks; settlement defects remain F05/F10; [api/_utils/tournamentClaims.js:117–143](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentClaims.js#L117-L143); [api/_utils/tournamentClaims.js:219–240](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentClaims.js#L219-L240) |
| Request metadata | Cron handler's admission check | Handler receives Admin-SDK authority | Evaluation, banking, orchestration | O01: infrastructure provenance cannot be established locally |

Cross-user ownership checks and object-identity checks are distinct. A correct token check on the document initially requested does not validate every later document reference derived from its contents.

## SECTION 3: CRITICAL AND HIGH FINDINGS

### F01 — High — Stored agent identity overrides document identity and crosses the owner boundary

**Status: VERIFIED static path.**

- **Source state and writer:** Client-created agents are admitted by [firestore.rules:248–309](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L248-L309). The rule constrains several sensitive fields and the path namespace, but neither prohibits a stored id field nor requires it to equal the agent document path. The epoch and birth-provenance functions constrain different fields ([firestore.rules:38–60](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L38-L60)).
- **Validation:** Deploy authenticates the caller and checks the requested document's owner ([api/agent/decide.js:147–174](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L147-L174)). That is a valid ownership check on the initial document.
- **Authority transition:** Hydration puts stored data after the trusted id, so stored id wins ([api/agent/decide.js:158](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L158)). The battle input repeats the same ordering ([api/agent/decide.js:879–889](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L879-L889)); creation persists agentData.id as battle.agentId ([api/_utils/agentBattleService.js:129–132](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L129-L132)).
- **Authoritative consumer:** Completion reads agents/{fresh.agentId} without comparing that agent's owner to fresh.ownerId ([api/cron/agent-evaluate.js:4603–4607](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4603-L4607)). Its base stats target is that agent; the same-owner guard applies only to a subsequent clone-parent redirect ([api/cron/agent-evaluate.js:4623–4638](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4623-L4638)). Stats are written at [api/cron/agent-evaluate.js:4819–4833](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4819-L4833). Reflection likewise reads battleDoc.agentId and writes its memory ([api/agent/reflect.js:65–72](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L65-L72); [api/agent/reflect.js:132–141](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L132-L141); [api/agent/reflect.js:274–280](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L274-L280)).
- **High-level failure condition and consequence:** A stored identity inconsistent with its document path can become the authoritative target for another user's stats or persistent learning. Subsequent deploy prompts consume that memory ([api/_utils/agentPromptAssembly.js:94–96](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentPromptAssembly.js#L94-L96)).
- **Defensive boundary:** Derive identity exclusively from DocumentReference/DocumentSnapshot IDs; prohibit or disregard stored identity aliases; enforce battle.ownerId-to-agent.ownerId agreement at every authoritative consumer. Review existing mismatched references through a separately authorized data investigation.

This is a static cross-user integrity finding. No unauthorized record was created and no cross-user operation was attempted.

### F02 — High — Owner-editable control records retain execution authority

**Status: VERIFIED static path.**

- **Untrusted state and writer:** An owner may replace executionMode, pendingProposal, gameplanMeeting and related fields. The rules validate the changed top-level keys and ownership, without a nested schema or server-issued proposal binding ([firestore.rules:434–437](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L434-L437)).
- **Validation and transition:** The evaluator invokes proposal and meeting handlers before its later model-execution mode clamp ([api/cron/agent-evaluate.js:1839–1853](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L1839-L1853); [api/cron/agent-evaluate.js:2408–2416](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L2408-L2416)). The proposal guard only short-circuits when the stored mode is autopilot; other stored modes reach the approved-proposal branch ([api/cron/agent-evaluate.js:3337–3368](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L3337-L3368)).
- **Authoritative consumer:** The approved proposal checks bench presence and reserves the incoming symbol, then forwards persisted slot, metadata and snapshot to executeSwapServer ([api/cron/agent-evaluate.js:3372–3433](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L3372-L3433)). The approved-meeting branch similarly executes stored suggested swaps ([api/cron/agent-evaluate.js:4134–4202](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4134-L4202)). The transaction checks slot existence and duplicate symbols, but does not bind the request to a server-issued decision or rerun the ordinary model/guardrail validation ([api/_utils/agentSwapExecution.js:152–178](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L152-L178)).
- **Accounting boundary:** Proposal evaluationMetadata is forwarded from stored control state ([api/cron/agent-evaluate.js:3425–3430](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L3425-L3430)) and spread after computed closed-trade fields ([api/_utils/agentSwapExecution.js:254–272](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L254-L272)). Those fields subsequently feed banked-score summation ([api/cron/agent-evaluate.js:908–915](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L908-L915)).
- **High-level failure condition and consequence:** A control record not bound to a validated server decision can cause authoritative portfolio changes or contaminate trade accounting. The local autopilot clamp does not govern these earlier handlers.
- **Defensive boundary:** Keep execution proposals and accounting metadata server-owned. Accept only narrowly validated acknowledgments against an immutable server proposal identifier/version, and enforce execution mode, lifecycle, expected outgoing position and guardrails at the final transaction.

No control-record construction, request example, or operational bypass procedure is included.

### F03 — High — Legacy opponent initialization can overwrite League scoring inputs

**Status: VERIFIED static path; current casual scope explicitly narrowed.**

- **Source state and writer:** set-opponent accepts a client opponent portfolio and startingPrices ([api/agent/set-opponent.js:29–32](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/set-opponent.js#L29-L32)).
- **Validation:** Token ownership, active status, age under five minutes, and absence of an existing opponent are checked ([api/agent/set-opponent.js:45–67](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/set-opponent.js#L45-L67)). There is no game-mode restriction, authoritative quote reconstruction, or full portfolio/ATR schema validation.
- **Reachable state:** New League battles intentionally have opponent:null ([api/agent/decide.js:1458–1467](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L1458-L1467)). Current casual deploys already populate the opponent and normally hit the initializer's already-set guard ([api/agent/decide.js:892–928](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L892-L928)).
- **Authority transition:** Client prices are spread over the entire existing starting-price map; client-derived CPU thresholds are spread over existing thresholds; both maps are written through Admin SDK ([api/agent/set-opponent.js:69–104](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/set-opponent.js#L69-L104)).
- **Live consumer:** Agent evaluation uses startingPrices as entry values ([api/cron/agent-evaluate.js:807–852](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L807-L852)). Swap accounting also reads the shared threshold map ([api/_utils/agentSwapExecution.js:191–205](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L191-L205)). League banking sums the resulting currentScore ([api/_utils/tournamentBanking.js:61–85](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L61-L85)).
- **High-level failure condition and consequence:** In the fresh League initialization window, insufficiently validated owner-supplied initialization state can replace server-established scoring inputs, affecting that seat's score and group standings.
- **Defensive boundary:** Retire or restrict the legacy initializer to its intended mode and lifecycle, keep baseline maps server-derived and immutable, and make initialization a transactional one-time operation. No production exposure or usage rate was measured.

### F04 — High — Completion promotes an intraday cache to a final result without a closing valuation

**Status: VERIFIED static path.**

**Path:** Live prices → evaluator writes scoreState → expiry processing skips further evaluation → completion trusts cached currentScore/opponentScore → career result, learning and League composite.

The evaluator writes scores during regular market hours ([api/cron/agent-evaluate.js:805–922](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L805-L922)). Expired battles are completed before the market-open gate ([api/cron/agent-evaluate.js:238–273](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L238-L273); [api/cron/agent-evaluate.js:311–315](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L311-L315)). isMarketOpen excludes the closing instant and all later times ([api/_utils/marketSchedule.js:253–269](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/marketSchedule.js#L253-L269)). Completion uses the stored scores without a final quote, final-session marker, or maximum-age check ([api/cron/agent-evaluate.js:4505–4527](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4505-L4527); [api/cron/agent-evaluate.js:4609–4611](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4609-L4611)), and writes outcome stats ([api/cron/agent-evaluate.js:4798–4828](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4798-L4828)). League banking expressly reads the same cached score ([api/_utils/tournamentBanking.js:53–85](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L53-L85)).

The cadence is every 15 minutes ([vercel.json:157–158](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/vercel.json#L157-L158)), so an ordinary closing move can be omitted. Budget deferral or quote degradation can make the cached valuation older still; the quote guard deliberately preserves the previous score ([api/cron/agent-evaluate.js:755–772](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L755-L772)).

The same mismatch is larger for crypto-containing battles: their expiry can be 20:00 ET ([api/_utils/agentBattleService.js:377–391](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L377-L391); [api/_utils/marketSchedule.js:350–380](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/marketSchedule.js#L350-L380)), while evaluation remains behind the stock-market gate. No evening crypto valuation is performed by this evaluator.

**Consequence:** Final wins/losses, League agent points and reflection inputs can omit price movement inside the declared battle interval.

**Defensive boundary:** Separate “last observed score” from “settled score.” Require a session-bound final valuation or an explicit unsettled/degraded status before recording results or banking a final League composite. Define the valuation and completion cadence for crypto explicitly.

### F05 — High — A symbol-only canonical-open snapshot is reused across later leg sessions

**Status: VERIFIED static path; governing session semantics require explicit remediation design.**

**Source/writer:** Canonical snapshots are immutable per group and symbol, not per session ([api/_utils/canonicalOpen.js:107–136](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/canonicalOpen.js#L107-L136)). This policy is live ([src/config/featureFlags.js:375](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L375)). Overnight flips create a new null-baseline leg with its own openedAt ([api/tournament/flip.js:176–187](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/tournament/flip.js#L176-L187)); claims similarly create new legs and close dropped ones ([api/_utils/tournamentClaims.js:219–240](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentClaims.js#L219-L240)).

**Validation/transition:** The sweep settles any eligible null-baseline leg from the existing symbol snapshot without checking whether that snapshot's session matches the leg's intended opening session ([api/_utils/canonicalOpenSweep.js:75–92](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/canonicalOpenSweep.js#L75-L92)). It avoids refetching symbols already captured ([api/_utils/canonicalOpenSweep.js:153–180](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/canonicalOpenSweep.js#L153-L180)). Banking repeats that choice and also uses the same round snapshot as the exit price for bank-pending closed legs ([api/_utils/tournamentBanking.js:243–306](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L243-L306)).

**Consumer/consequence:** scoreLeg measures return from the assigned baseline; scorePick combines closed and live legs ([api/_utils/tournamentUserScoring.js:115–163](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentUserScoring.js#L115-L163)). Later overnight legs can therefore inherit a price from before their exposure began, and later closes can settle at an earlier round open. The resulting totals are banked into the final composite and advancement ([api/_utils/tournamentBanking.js:367–410](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L367-L410); [api/_utils/tournamentAdvancement.js:696–703](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAdvancement.js#L696-L703)).

**Counter-evidence considered:** Existing tests intentionally enforce same-snapshot stability against vendor drift, including a captured dropped leg closing at its snapshot ([api/_utils/tournamentBanking.test.js:404–415](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.test.js#L404-L415); [api/_utils/tournamentBanking.test.js:505–512](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.test.js#L505-L512)). That proves the current behavior is encoded; it does not distinguish a same-session refetch from a later trading session. The leg contract states that a flip starts new exposure at its execution price ([docs/FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md:64](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/docs/FANTASYTRADES_LEAGUE_TOURNAMENT_DESIGN_FRAMEWORK_V2_1_AGENTIC.md#L64)), and the banking implementation itself describes overnight close-out as the next session's open ([api/_utils/tournamentBanking.js:284–290](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L284-L290)).

**Defensive boundary:** Preserve canonical immutability within a session, while keying acquisition and close settlement to an explicit intended session. Have the product owner resolve the round-open-versus-leg-open contract before changing frozen historical scores.

### F06 — High — Partial quote failure becomes a finalizable numeric League result

**Status: VERIFIED static path.**

**Path:** Partial quote response → absent live-leg result → zero contribution → recorded daily composite and waiver order → finalization without a user-quote degradation gate.

The nightly collector only aborts when the entire quote map is empty ([api/_utils/tournamentBanking.js:484–504](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L484-L504)). A missing or unusable quote causes scoreLeg to return null and scorePick to use zero live points ([api/_utils/tournamentUserScoring.js:115–121](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentUserScoring.js#L115-L121); [api/_utils/tournamentUserScoring.js:155–163](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentUserScoring.js#L155-L163)). Banking emits a warning but still totals and persists the result ([api/_utils/tournamentBanking.js:313–338](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L313-L338); [api/_utils/tournamentBanking.js:367–414](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L367-L414); [api/_utils/tournamentBanking.js:430–447](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L430-L447)).

The warning is returned to the caller, not included as a blocking completeness marker in dayEntry. Final degradation checks cover agent-score carry and all-week agent absence, not missing user quotes ([src/constants/leagueTournament.js:1378–1392](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/constants/leagueTournament.js#L1378-L1392)). The daily date guard prevents same-day rebanking; day five closes the automatic banking window ([api/_utils/tournamentBanking.js:136–165](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L136-L165)). The result can then be locked as advancers/finalScores or applied to ranks ([api/_utils/tournamentAdvancement.js:691–703](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAdvancement.js#L691-L703); [api/_utils/tournamentAdvancement.js:518–531](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAdvancement.js#L518-L531)).

**Consequence:** A provider's partial outage can alter claims priority, final rankings or advancement. Correcting the quote later is insufficient under the ordinary same-day/final-day guards.

**Defensive boundary:** Validate the complete required quote set per group and persist user-layer completeness/provenance. Finalization must refuse incomplete valuations; define a repair path that preserves the intended scoring session.

### F07 — High — Deploy admission and battle creation do not enforce one active battle atomically

**Status: VERIFIED static concurrency path.**

**Source/writer:** Two overlapping legitimate deploy invocations can read the same unlocked agent state.

**Validation:** The deployingAt and cooldown checks follow a plain get; setting deployingAt is a separate update ([api/agent/decide.js:151–212](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L151-L212)). These operations do not form a compare-and-set.

**Authority transition:** The decision write releases the lock before querying for an active battle ([api/agent/decide.js:666–715](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L666-L715)). The prescribed path has the same structure ([api/agent/decide.js:1350–1368](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L1350-L1368)). Creation uses a new document ID. The composition transaction validates the activation descriptor, not per-agent active-battle uniqueness ([api/_utils/compositionGenerationFence.js:149–164](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/compositionGenerationFence.js#L149-L164)). Writing activeBattleId is yet another operation ([api/agent/decide.js:930–931](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L930-L931); [api/agent/decide.js:1482](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L1482)).

**Live consumer/consequence:** Duplicate active battle documents are all selected for evaluation ([api/_utils/agentBattleService.js:43–49](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L43-L49)). League banking sums all matching battle scores, without per-seat/day deduplication ([api/_utils/tournamentBanking.js:61–85](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L61-L85)). Each distinct casual battle can separately complete and update career/learning state. One activeBattleId pointer cannot represent both.

**Defensive boundary:** Acquire a transactional deploy claim and enforce a durable per-agent/per-session battle identity at creation, with the pointer update in the same authority boundary. Retries must recover the same battle rather than allocate another.

### F08 — High — Evaluation ownership is not a state-version or terminal-state fence

**Status: VERIFIED static concurrency/lifecycle path.**

The handler first takes an all-active-battles snapshot ([api/cron/agent-evaluate.js:238–273](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L238-L273)). The later lock transaction reads the current document, but refreshes only controlEpochLog and regimeAtStart onto the old battle object, then proceeds with its stale portfolio, control and score data ([api/cron/agent-evaluate.js:589–622](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L589-L622)). It does not reject a now-completed battle or record an already-processed tick.

The lease is 120 seconds while the handler permits 300 seconds and a 290-second work budget ([api/cron/agent-evaluate.js:154–158](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L154-L158)). Lease expiry admits another evaluator without fencing the earlier worker's subsequent writes. The swap transaction reads the latest slot but checks only that a position exists, not that it is the outgoing position on which the decision was based, and does not reject terminal battle status ([api/_utils/agentSwapExecution.js:152–178](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L152-L178)). Final evaluation writes and lock clearing do not compare a lease token/version ([api/cron/agent-evaluate.js:3113–3205](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L3113-L3205)).

**Full path:** Older query state → later lock acquisition without full refresh → decision based on old portfolio/control state → swap at current slot or stale final update → persisted portfolio/accounting and later completion/banking.

**Consequence:** Overlap, delayed workers or completion interleaving can cause a swap against a changed position, writes after completion, or stale score/history replacement. A transaction around the swap does not protect a decision whose preconditions are not checked inside it.

**Defensive boundary:** Bind each tick to a unique lease generation and portfolio revision; acquire from a fresh authoritative snapshot; check active status, lease ownership and expected outgoing identity at every final write. Completion must fence outstanding evaluators.

## SECTION 4: MODERATE AND LOW FINDINGS

### F09 — Moderate — Nightly badge reset has a non-atomic idempotency check and rewrites the whole portfolio

**VERIFIED.** The writer receives an earlier active-battle query snapshot through a DocumentSnapshot-shaped adapter ([api/cron/agent-daily-scores.js:230](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L230); [api/cron/agent-daily-scores.js:276–288](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L276-L288)). It checks dailyScores[dayKey].recorded in that snapshot ([api/cron/agent-daily-scores.js:45–56](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L45-L56)), computes a reset, then performs an unconditional update that increments the banked total and replaces portfolio and thresholdHistory ([api/cron/agent-daily-scores.js:153–194](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L153-L194)).

**Path/consequence:** Concurrent resets can both pass the marker and increment the same day's badges. An intervening portfolio write can be replaced by the stale whole portfolio. Later evaluation adds bankedBadgePoints.total to currentScore ([api/cron/agent-evaluate.js:908–920](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L908-L920)). Missing individual prices also skip badge contribution while all tracked history is reset ([api/cron/agent-daily-scores.js:84–92](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L84-L92); [api/cron/agent-daily-scores.js:136–149](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L136-L149)).

The scheduled job runs after ordinary stock expiry, reducing its relevance to already-completed stock-only fullday battles. Active crypto, legacy, delayed-completion and overlapping reset states remain within its query; no affected population was measured.

**Boundary:** Transactionally check and seal each battle/day; coordinate with evaluation/completion; validate quote completeness before consuming history; preserve position revisions and cost basis explicitly.

### F10 — Moderate — Quote collection omits dropped positions that still require settlement

**VERIFIED.** Claim execution closes a position without banking its exit value and moves it to droppedPicks ([api/_utils/tournamentClaims.js:219–239](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentClaims.js#L219-L239)). Banking scores droppedPicks ([api/_utils/tournamentBanking.js:224–233](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L224-L233)), but both nightly and manual quote collectors enumerate only current picks ([api/_utils/tournamentBanking.js:484–495](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L484-L495); [api/tournament/bank-daily-scores.js:75–84](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/tournament/bank-daily-scores.js#L75-L84)).

**Path/consequence:** A dropped symbol not otherwise present in the collector's union has no fresh open quote. A legacy bank-pending close, or the current canonical policy's documented no-snapshot/real-baseline fallback, remains unsettled ([api/_utils/tournamentBanking.js:278–308](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L278-L308)). scorePick excludes unbanked closed legs ([api/_utils/tournamentUserScoring.js:146–163](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentUserScoring.js#L146-L163)); their points therefore disappear from the standing. A later incidental fetch can settle at a later day's price.

**Counter-evidence:** Canonical closes with an existing snapshot need no fresh quote; this finding does not cover those. The unit test supplies the dropped symbol's quote directly, so it does not exercise the collector gap ([api/_utils/tournamentBanking.test.js:237–270](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.test.js#L237-L270)).

**Boundary:** Include all unsettled dropped legs in required market data and bind settlement to their intended exit session.

### F11 — Moderate — Swaps discard sector identity that later sector guards trust

**VERIFIED.** Battle creation attaches sectors to held and bench assets ([api/_utils/agentBattleService.js:154–162](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L154-L162); [api/_utils/agentBattleService.js:399–405](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L399-L405)). The swap writer rebuilds both the incoming holding and outgoing bench entry without sector ([api/_utils/agentSwapExecution.js:281–299](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L281-L299); [api/_utils/agentSwapExecution.js:314–321](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L314-L321)).

**Path/consequence:** Valid sector state → first swap drops the field → later cap checks replace it with “Unknown” → cap decision uses incorrect counts ([api/_utils/agentGuardrails.js:773–803](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentGuardrails.js#L773-L803)). Distinct sectors can be grouped together, or a real sector can be undercounted, changing allowed swaps and prompt context.

The automatic Diversifier cap is currently observe-only, but explicitly deployed maxSectorWeight guards execute independently ([src/config/featureFlags.js:939](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L939); [api/_utils/agentGuardrails.js:355–373](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentGuardrails.js#L355-L373)). The snapshot writer accepts configured guardrails ([api/_utils/agentBattleService.js:190–192](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L190-L192)).

**Boundary:** Preserve or authoritatively rederive instrument sector metadata on every portfolio/bench transition; distinguish genuinely unknown classifications from metadata loss.

### F12 — Moderate — A display-sized trade history is also the realized-score ledger

**VERIFIED.** The executor explicitly allows unlimited swaps but caps stored trades at the latest 50 ([api/_utils/agentSwapExecution.js:81](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L81); [api/_utils/agentSwapExecution.js:353–367](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L353-L367)). Evaluation reconstructs all banked trade points by summing only that retained array ([api/cron/agent-evaluate.js:908–915](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L908-L915)).

**Path/consequence:** A battle with more than 50 executed swaps → oldest closed trades removed → next evaluation omits their realized points → currentScore and downstream settlement change. No independent lifetime accumulator is updated by the swap transaction. Actual incidence, particularly under current fullday pacing, is UNKNOWN.

**Boundary:** Maintain an authoritative cumulative realized ledger/total independently of bounded presentation history, with transactionally idempotent trade identities.

### F13 — Moderate — Reflection acknowledgment can lose or duplicate persistent learning

**VERIFIED.** The queue reads pendingReflection documents and clears the flag after generateReflection resolves ([api/cron/process-pending-reflections.js:46–53](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/process-pending-reflections.js#L46-L53); [api/cron/process-pending-reflections.js:78–90](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/process-pending-reflections.js#L78-L90)). generateReflection catches the authoritative memory-write error and still returns normally ([api/agent/reflect.js:132–142](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L132-L142)).

**Loss path:** Completed battle → failed memory write swallowed → queue acknowledges success → future deploy/consolidation receives no reflection for that battle ([api/_utils/agentPromptAssembly.js:94–96](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentPromptAssembly.js#L94-L96); [api/_utils/agentConsolidationApply.js:328–334](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentConsolidationApply.js#L328-L334)).

**Retry/overlap path:** A memory write succeeds before the queue acknowledgment; retry or concurrent workers append again. Neither append checks gameId uniqueness. The ordinary branch also replaces memory from a pre-model-call snapshot; the casual branch transaction merges current memory but still does not deduplicate ([api/agent/reflect.js:65–72](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L65-L72); [api/agent/reflect.js:274–294](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L274-L294)). The rolling five-entry window can lose another battle's evidence or contain repeated evidence.

**Boundary:** Use a per-battle reflection identity and commit memory plus acknowledgment atomically, or use a durable idempotent result record with a retryable apply phase. Propagate authoritative write failure.

### F14 — Moderate — League reflection invents an opponent result; deploy rendering also turns draws into losses

**VERIFIED.** League creation has no CPU opponent ([api/agent/decide.js:1463](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L1463)), and completion intentionally reports no win/loss result while still queueing human reflection ([api/cron/agent-evaluate.js:4508–4515](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4508-L4515)).

The reflection prompt and memory writer independently compare currentScore to opponentScore defaulting to zero ([api/_utils/agentReflectionUtils.js:270–291](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentReflectionUtils.js#L270-L291); [api/agent/reflect.js:255–270](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L255-L270)). Memory is persisted and reused in the next deploy prompt ([api/agent/reflect.js:274–280](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L274-L280); [api/_utils/agentPromptAssembly.js:94–96](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentPromptAssembly.js#L94-L96)). Its renderer calls every non-win a Loss, including a real draw ([api/_utils/agentPromptAssembly.js:277–286](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentPromptAssembly.js#L277-L286)).

**Path/consequence:** Legitimate opponent-free League day → fabricated W/L-versus-zero narrative and stored result → future model memory/consolidation. This is cognition/learning contamination, not a claim that the career W/L branch updates for League completion.

**Boundary:** Make reflection outcomes mode-aware and consume an authoritative result contract; preserve draw and non-applicable outcomes in all renderers.

### F15 — Moderate — A failed consolidation has no durable retry path for its claimed milestone

**VERIFIED.** The live concurrency flag enables a transactional lastConsolidatedGamesPlayed claim ([src/config/featureFlags.js:237](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L237); [api/agent/reflect.js:169–182](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L169-L182); [api/agent/reflect.js:305–311](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L305-L311)). The claim precedes setting pendingConsolidation and the model/apply work.

Consolidation can return success:false on model or validation failure ([api/_utils/agentConsolidationApply.js:356–365](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentConsolidationApply.js#L356-L365); [api/_utils/agentConsolidationApply.js:387–393](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentConsolidationApply.js#L387-L393)). The caller does not inspect this result; reflection finishes and its queue flag is cleared ([api/agent/reflect.js:185–203](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L185-L203); [api/cron/process-pending-reflections.js:79–90](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/process-pending-reflections.js#L79-L90)). A repeated same-milestone attempt is excluded by the claimed counter. The reviewed runtime references to pendingConsolidation write/reset it rather than drain it; the next consolidation gate is a later positive multiple of five games ([api/agent/reflect.js:167–182](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L167-L182)).

**Path/consequence:** Valid accumulated learning → claimed milestone → failed consolidation → completion acknowledgment with stale consolidatedInsight → later deploy continues using stale strategic wisdom ([api/_utils/agentPromptAssembly.js:83–96](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentPromptAssembly.js#L83-L96)). A crash between claiming and setting pending can leave even the pending marker absent.

**Boundary:** Separate “claimed/in progress” from “successfully consolidated,” retain retryable milestone work, and acknowledge only successful application. Reconcile stale claims without incrementing evolution twice.

No Low-severity findings are listed solely to increase coverage.

## SECTION 5: LEGACY / DARK / SHADOW LEAKAGE

| Surface | Current static disposition |
|---|---|
| Co-pilot/manual proposal lifecycle | **VERIFIED live reachability through mutable stored controls**, despite dormant comments and the later autopilot clamp: F02. Legacy missing executionMode is also migrated to copilot ([api/cron/agent-evaluate.js:648–666](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L648-L666)). |
| Legacy opponent initializer | **VERIFIED cross-mode leakage** into fresh opponent-free League battles: F03. Current casual creation already supplies its opponent. |
| Legacy/delayed daily reset state | **VERIFIED conditional correctness risk**, F09; population UNKNOWN. |
| Legacy user-layer settlement | **VERIFIED collector gap**, F10; canonical snapshot availability narrows the affected branch. |
| Legacy agent.directives prompt path | **Counter-evidence:** renderer returns no legacy directives whenever archetype integrity is not off; current mode is enforce ([api/_utils/legacyDirectiveSanitize.js:36–40](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/legacyDirectiveSanitize.js#L36-L40); [src/config/featureFlags.js:770](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L770)). No live decision-poisoning finding assigned from that array alone. |
| Compiler / manifest / composition | Compiler disabled, manifest writing enabled, composition enforcement off, epoch fence enabled ([src/config/featureFlags.js:1421–1443](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L1421-L1443); [api/_utils/compositionConfig.js:26](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/compositionConfig.js#L26); [api/_utils/compositionConfig.js:43](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/compositionConfig.js#L43)). Do not treat these as one flag. The advisory reader expression exists; no current composition-to-decision defect established. |
| New intraday infrastructure | Collect, diagnostic, agent-use and risk-activation flags are false; source remains legacy ([src/config/featureFlags.js:2586–2641](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L2586-L2641)). No dark-data activation finding. |
| Live-price beacon | **OBSERVATION O02:** swap code still prefers a sufficiently recent stored beacon ([api/_utils/agentSwapExecution.js:180–187](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L180-L187)), but the client writer was removed and current battle rules exclude that field ([src/screens/AgentBattleScreen.jsx:780–797](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/screens/AgentBattleScreen.jsx#L780-L797); [firestore.rules:434–437](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L434-L437)). A present-day untrusted writer was not established. |
| Shadow telemetry | Not promoted to decision authority merely because it is written. Shadow assembly is off ([src/config/featureFlags.js:1482](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L1482)). No completed shadow-to-authoritative finding. |

## SECTION 6: DUPLICATED AUTHORITY

| Competing authorities | Correctness consequence |
|---|---|
| Document path ID vs stored object id | Identity can change during hydration, F01. |
| Server-built battle baselines vs legacy opponent initialization | Frozen scoring maps can be replaced, F03. |
| Initial-query battle state vs transaction-time battle state | Lock ownership does not make old decisions current, F08. |
| Per-agent activeBattleId vs active-battle query vs new battle creation | No atomic one-active-battle invariant, F07. |
| Cached scoreState vs actual closing-session valuation | Cache is treated as settlement, F04. |
| Round canonical open vs each leg's exposure session | Immutable old data is authoritative for a new interval, F05. |
| Full realized history vs retained trades array | Retention changes accounting, F12. |
| Completion's mode-aware result vs reflection's W/L calculation | Persistent learning disagrees with the official outcome model, F14. |

**OBSERVATION O03 — Ledger recovery is not an atomic portfolio reconciliation.** reserveSymbol has a valuable stale-reservation hardening read that checks whether the original battle actually acquired the symbol ([api/_utils/tournamentAgentLedger.js:384–408](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAgentLedger.js#L384-L408)). That refutes a blanket claim that every timed-out reservation permits duplicate acquisition. However, confirmation can overwrite a rival held entry, and nightly reconciliation derives portfolios before its ledger transaction ([api/_utils/tournamentAgentLedger.js:446–474](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAgentLedger.js#L446-L474); [api/_utils/tournamentAgentLedger.js:599–603](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAgentLedger.js#L599-L603); [api/_utils/tournamentAgentLedger.js:648–694](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAgentLedger.js#L648-L694)). The reviewed code logs conflicting holdings rather than repairing both portfolios. This is a recovery-boundary concern, not a separate confirmed live duplicate-holding incident or an independently established ordinary triggering path.

## SECTION 7: CONCURRENCY AND IDEMPOTENCY

| Operation | Existing protection | Remaining gap |
|---|---|---|
| Deploy | Timestamp lock and cooldown | Plain read then update; independent battle allocation/pointer writes, F07. |
| Evaluation | Transactional timestamp lease | Partial refresh, shorter lease than maximum work duration, no worker-generation fence, F08. |
| Swap | Transactional current-slot read and duplicate-symbol check | Expected outgoing identity, terminal state and lease generation not checked, F08. |
| Completion | Transactional terminal check, stats update, guarded pointer clear | Useful protection against duplicate completion of one document; does not solve duplicate battle creation or final valuation, F04/F07. |
| Agent daily reset | Per-day recorded flag | Flag checked outside the increment/whole-state update, F09. |
| League banking | Fresh group transaction and date marker | Correctly prevents duplicate group banking; can seal incomplete input and prevent ordinary correction, F06. |
| Claim resolution | Fresh group and pending-query reads in one transaction | Good ownership/pool/idempotency structure; later valuation still depends on F05/F10. |
| Reflection | Pending flag plus awaited work | No atomic memory/ack commit, no per-battle dedupe, swallowed write errors, F13. |
| Consolidation | Claimed game-count milestone | Claim is not a success receipt or retryable work item, F15. |

Positive evidence: completion's terminal guard is at [api/cron/agent-evaluate.js:4581–4590](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4581-L4590) and pointer comparison at [api/cron/agent-evaluate.js:4786–4795](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4786-L4795); claim outcome, roster and processing marker land together at [api/_utils/tournamentClaims.js:286–314](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentClaims.js#L286-L314). Those protections were considered when narrowing the findings.

## SECTION 8: FAIL-OPEN INVENTORY

| Condition | Current behavior | Disposition |
|---|---|---|
| Owner control record is structurally admitted | Earlier proposal/meeting handlers may execute it | F02, High |
| Partial user-layer quotes | Missing live score becomes zero; day still recorded | F06, High |
| Guardrail implementation error | Outer evaluator catch continues with original model decision | **OBSERVATION O04**; [api/cron/agent-evaluate.js:2334–2379](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L2334-L2379) |
| Individual sector-cap error | Logs and returns without a sector block | O04; [api/_utils/agentGuardrails.js:355–374](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentGuardrails.js#L355-L374) |
| Weak deployedStrategy shape | Validates object/null and size, not guardrail semantics; creation snapshots arrays | **OBSERVATION O05**; [api/agent/update-agent-settings.js:85–94](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/update-agent-settings.js#L85-L94); [api/_utils/agentBattleService.js:188–192](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L188-L192) |
| Watchlist missing/read failure | Deploy proceeds with no equipped snapshot | **VERIFIED intentional degradation**, not assigned a defect without a contrary contract; [api/agent/decide.js:348–374](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L348-L374) |
| Required evaluator quotes unusable | Skips tick and preserves prior score | **Fail-closed for new decisions**, but completion later lacks freshness enforcement, F04; [api/cron/agent-evaluate.js:755–772](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L755-L772) |
| Agent-score read failure in League banking | Carries prior agent score, marks degraded | **Protected at finalization**; [api/_utils/tournamentBanking.js:343–355](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L343-L355); [src/constants/leagueTournament.js:1378–1392](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/constants/leagueTournament.js#L1378-L1392) |
| Reflection memory write fails | Logs, returns, queue acknowledges | F13, Moderate |
| Consolidation returns failure | Caller ignores result; milestone remains claimed | F15, Moderate |

O04/O05 establish permissive validation and error-handling policies. They are not expanded into a demonstrated malformed-input attack or a new independent confirmed guardrail failure path. F11 separately establishes a concrete normal-writer metadata-loss path.

## SECTION 9: SCORING / RANKING / ADVANCEMENT INTEGRITY

The ranking chain is VERIFIED: per-owner agent score sum ([api/_utils/tournamentBanking.js:61–85](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L61-L85)) plus user-leg score ([api/_utils/tournamentBanking.js:313–374](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L313-L374)) becomes daily closeScores; getWeeklyComposite consumes the latest in-week banked composite ([src/constants/leagueTournament.js:1340–1344](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/constants/leagueTournament.js#L1340-L1344)); lockTopTwo ranks that value ([api/_utils/tournamentAdvancement.js:106–115](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAdvancement.js#L106-L115)); finalization stores advancers and finalScores and applies ranks ([api/_utils/tournamentAdvancement.js:696–703](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAdvancement.js#L696-L703); [api/_utils/tournamentAdvancement.js:518–531](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentAdvancement.js#L518-L531)). Advancement is not currently frozen ([src/config/featureFlags.js:1260](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/src/config/featureFlags.js#L1260)).

| Integrity requirement | Finding |
|---|---|
| One authoritative contribution per seat/session | Duplicate deployment can create multiple counted battles, F07. |
| Score covers the declared battle interval | Completion seals an earlier cached score, F04. |
| Correct exposure interval for every user leg | Later legs/close-outs can use an earlier canonical open, F05. |
| Every required instrument is valued | Partial user quotes become zero; dropped unsettled picks can be omitted from collection, F06/F10. |
| Realized score survives history retention | Trade-array cap removes accounting inputs, F12. |
| Daily banking happens exactly once | Agent daily reset marker is not transactional, F09. |
| Score inputs are server-authoritative | Legacy initializer and proposal metadata cross the boundary, F02/F03. |
| Rankings distinguish missing inputs from real zero | Existing final gate covers agent carry/all-week absence, but not incomplete user quotes, F06. |

The final-day clamp and manual-review refusal for known degraded agent scores are useful. They also mean ordinary later retries cannot automatically repair a bad day-five snapshot. Historical score repair should be a separate, scoped decision with preserved original inputs; this audit made no data changes.

## SECTION 10: DEFENSIVE TRUST-BOUNDARY FINDINGS

This section deliberately reports source evidence and defensive consequences only.

| Finding | Trusted / untrusted state | Missing validation / authority transition | Authoritative consumer and potential consequence | Defensive boundary |
|---|---|---|---|---|
| **F01 — High, VERIFIED** | Trusted document identity and battle owner / client-stored identity field | Stored data overrides snapshot ID; later agent reference not matched to battle owner | Completion/reflection can write another agent's record or learning | Reserved identity fields; reference-derived IDs; owner-reference binding |
| **F02 — High, VERIFIED** | Server decision/accounting / owner-editable control object and metadata | Top-level field allowlist lacks proposal provenance/schema; earlier lifecycle branches precede mode clamp | Swaps and retained closed-trade accounting can be affected | Server-owned proposal, narrow acknowledgment, commit-time invariants |
| **F03 — High, VERIFIED** | Server scoring baseline / client initializer inputs | No League exclusion or authoritative reconstruction; map overwrite | Agent scores and League composite can change | Retire/restrict initializer; immutable validated price/threshold source |
| **O01 — OBSERVATION; deployment provenance UNKNOWN** | Scheduler identity / request headers | Cron handlers accept scheduler metadata as an alternative to a secret comparison | Admission grants access to Admin-SDK evaluation, completion and orchestration | Establish the ingress provenance contract; require verifiable scheduler authentication and fail closed when secrets are unavailable |

**Exact locations:** F01: [firestore.rules:248–309](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L248-L309); [api/agent/decide.js:158](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L158); [api/_utils/agentBattleService.js:130](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentBattleService.js#L130); [api/cron/agent-evaluate.js:4603–4638](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L4603-L4638); [api/agent/reflect.js:65–72](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/reflect.js#L65-L72). F02: [firestore.rules:434–437](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/firestore.rules#L434-L437); [api/cron/agent-evaluate.js:1839–1853](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L1839-L1853); [api/cron/agent-evaluate.js:3337–3433](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L3337-L3433); [api/_utils/agentSwapExecution.js:254–272](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L254-L272). F03: [api/agent/set-opponent.js:29–104](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/set-opponent.js#L29-L104); [api/agent/decide.js:1463](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/agent/decide.js#L1463); [api/cron/agent-evaluate.js:807–852](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L807-L852). O01: [api/cron/agent-evaluate.js:192–200](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-evaluate.js#L192-L200); [api/cron/agent-daily-scores.js:208–229](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/agent-daily-scores.js#L208-L229); [api/cron/tournament-orchestrator.js:40–43](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/cron/tournament-orchestrator.js#L40-L43).

For O01, the repository alone does not establish whether infrastructure strips, authenticates, or independently rejects externally supplied scheduler metadata. No external-access or exploitability conclusion is made. No requests were sent.

## SECTION 11: HIDDEN CALIBRATION

These are VERIFIED numerical/behavioral authorities or OBSERVATIONS requiring a product decision, not automatic recommendations to change calibrated constants.

| Calibration point | Source and significance |
|---|---|
| Scoring observation window | Regular-hours gate plus 15-minute cadence silently define the last score that completion uses, F04; [api/_utils/marketSchedule.js:253–269](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/marketSchedule.js#L253-L269); [vercel.json:157–158](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/vercel.json#L157-L158). |
| User-layer ATR is resolved anew | Banking reloads rankings and computes ATR from percentile; a missing symbol in an available map resolves to 4.0, while missing rankings allow downstream stock/crypto defaults of 2.5/5.0 ([api/_utils/tournamentUserScoring.js:64–75](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentUserScoring.js#L64-L75); [api/_utils/tournamentUserScoring.js:99–101](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentUserScoring.js#L99-L101); [api/_utils/tournamentBanking.js:233–236](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/tournamentBanking.js#L233-L236)). **OBSERVATION O06:** a provider/read-state change can change scoring sensitivity; frozen-versus-recomputed user-leg ATR intent was not conclusively adjudicated. |
| Sector identity | “Unknown” participates as a sector in slot counts; loss of metadata changes enforcement, F11 ([api/_utils/agentGuardrails.js:779–793](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentGuardrails.js#L779-L793)). |
| Swap history length | Fifty records becomes a numerical scoring horizon, F12. |
| Missing live quote | Zero is a scoring choice, not merely a display placeholder, F06. |
| Swap price fallback | Missing outgoing live price can fall back to entry price; incoming nonpositive price rejects ([api/_utils/agentSwapExecution.js:190–194](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L190-L194); [api/_utils/agentSwapExecution.js:275–278](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentSwapExecution.js#L275-L278)). **OBSERVATION:** ordinary evaluator quote checks reduce exposure; no separate complete normal-path finding assigned. |
| Risk defaults and exemptions | Missing price/basis/ATR holds; default bust buffer is -0.85, VWAP ticks 2, trail ATR 1.5; designated emergency and user-directive reasons clear hurdle checks ([api/_utils/agentRiskManager.js:115–145](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentRiskManager.js#L115-L145); [api/_utils/agentRiskManager.js:337–355](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/api/_utils/agentRiskManager.js#L337-L355)). These are explicit policy choices, not defects by themselves. |
| Learning window and cadence | Five memory entries and five-game milestone consolidation shape persistent evidence; lost/duplicate entries and skipped milestones change that effective weighting, F13/F15. |
| Mode-dependent result semantics | Treating League points against zero or draws as losses creates an unintended learning label, F14. |

Changes touching the scorer, swap executor, guardrail engine, prompt assemblers or battle shape require the repository's fenced-change process ([docs/BUILD_RULES.md:9–24](https://github.com/fashraf94/TradeSeven/blob/6cd3699a220aacd5c8669ac2aade6d91216da5b1/docs/BUILD_RULES.md#L9-L24)). This review makes no such edits and proposes no replacement tuning values.

## SECTION 12: AUDIT COVERAGE

| Area | Static work completed | Limit |
|---|---|---|
| Repository authority | Read BUILD_RULES, governing index, attached memo; verified local branch/SHA/tree | No fetch; no claim about current remote or deployed revision |
| Agent identity and configuration | Read create/update rule boundaries, deploy hydration/admission, settings validation and battle snapshot shape | Not an exhaustive audit of every Forge rule schema or every settings endpoint |
| Battle lifecycle | Traced creation, tick locking, scoring, swap transaction, proposal/meeting consumption and completion/stats | No runtime scheduling or concurrency execution |
| League scoring | Traced canonical capture, leg settlement, quote collection, daily banking, weekly composite and finalization consumers | No historical group records inspected |
| Claims/flips | Read admission/membership, placement transaction, resolution and downstream dropped-leg settlement | No endpoints invoked or claims placed |
| Learning | Traced completion queue through reflection, memory, consolidation and future prompt consumers | No model calls; output quality and real corpus contents UNKNOWN |
| Trust boundaries | Read relevant Firestore rules and token/cron admission paths; established F01–F03 | Deployed rules, edge middleware, credentials and production access UNKNOWN |
| Dark/legacy/shadow | Checked relevant flags and specific surviving legacy consumers | Not a certification of every disabled mode or telemetry stream |
| Existing tests | Read swap transaction tests, evaluator source-contract tests, canonical lifecycle and banking fixtures as counter-evidence | No tests executed; no pass/fail or coverage percentage claimed |
| Other product domains | Not deeply audited | Mandate, Earnings, Options, old PvP/Snake Draft, entire App routing, the full API inventory and all third-party ingestion paths remain outside this completed pass |

The report covers the highest-consequence paths traced here. It is not a proof that no additional defect exists elsewhere. Repository searches narrowed the review; absence of a search hit was not used as proof of safety.

**Specific unknowns:** deployed Firestore rules and activation records; actual malformed/legacy documents; concurrent invocation frequency; how many battles exceed 50 swaps; production quote freshness; whether affected League results already exist; external ingress authentication; operational retention and manual-repair procedures.

**Verification method:** Read-only local source inspection and repository metadata reads. No application code, test fixture, emulator, endpoint, database client or model/provider integration was executed. Report creation is the only file-writing work, outside the repository.

## SECTION 13: FINAL SAFETY CHECK

| Constraint | Result |
|---|---|
| Static repository analysis only | Met |
| No penetration testing or unauthorized-access simulation | Met |
| No exploit payload, harness, script, crafted request or new offensive test | Met |
| No network request, production API or external service contact | Met |
| No credential/authentication/authorization bypass attempt | Met |
| No Firestore or application-state modification | Met |
| No production-source, dependency, branch, commit, push or merge change | Met |
| Findings require a complete static source-to-consumer path | F01–F15 have explicit paths; incomplete concerns remain OBSERVATION/UNKNOWN |
| Defensive trust findings stop at evidence, consequence and remediation boundary | Met |
| Required report artifact | Saved outside the repository |

**Remediation order:** First restore identity and execution authority (F01–F03). Then separate settlement from cached scoring and make League input completeness/session identity explicit (F04–F06). Next enforce deploy/evaluation commit invariants (F07–F09), preserve settlement/accounting metadata (F10–F12), and make learning delivery and result labels reliable (F13–F15). Changes and historical-data adjudication require separate authorized work; none were performed during this audit.
