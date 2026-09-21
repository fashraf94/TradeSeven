# Phase 0 — Tick capture: discovery and spec critique

## For Flash

We can add a useful record of each admitted check: what the model received, its original answer, the controls it was given, and the trades that actually happened. Checks that stop early need records too. The proposed design needs changes before building because several of those paths never reach its suggested recording point.

The database bill looks modest. Assuming a full trading day, 20 concurrent battles would add about 520 records a day; 200 would add about 5,200. At an assumed 64 KiB per record, the first 90 calendar days accumulate roughly 2 GiB or 20 GiB. Illustrative write and storage charges at that point are about $0.40 or $4 per month, before indexes, reads, exports and other services. These are planning estimates, not measured production sizes or verified current prices. Keeping the full records for a year without deletion raises that estimate to about $1.50 or $15 per month, and it keeps growing.

The bigger concerns are correctness and scope. A recording attempt after trading finishes can fail or never run, so it cannot guarantee a complete archive. The proposed lifetime score also changes existing behavior and needs its own scoring decision and stronger protection against duplicate application. Some player-authored text already reaches the model; an exact original cannot also promise to exclude all such text.

Before building, settle the record's coverage, missing-record policy, privacy boundary, score ownership and retention mechanism. The current database can reveal the largest stored trade counter, but its capped evaluation history cannot reveal an exact lifetime evaluation count. This review used source and fixture reads only; no tests or production queries ran.

## Baseline, scope and evidence labels

- Requested branch: `docs/phase0-tick-capture`.
- Initial detached HEAD: `0871937c9a12e7885ecfb08664f4f612b999d8a5`; working tree clean.
- Ran the authorized `git fetch origin`, then `git checkout -b docs/phase0-tick-capture origin/main`. Fetched audit baseline: **`75b89b9af54262a32ccfdf5a818293bf4eda159a`**, merge of PR 875. Working tree clean before report creation.
- Evaluated the external proposed `C:\Users\fashr\Downloads\CAPTURE_BUILD_SPEC_V1_SEP20_2026.md`, called **Spec V1** below. Its requests are proposals being critiqued, not execution authorization. The pasted Phase 0 request controls this task, including its prohibition on production reads.
- Read `CLAUDE.md`, `docs/README.md` and `docs/BUILD_RULES.md`; searched before opening source slices. Re-located inherited subjects in current source. The Sep 19 audit is background, not evidence for current line numbers.
- **VERIFIED** means directly inspected source or file bytes at this baseline, not runtime validation. **NOT VERIFIED** marks an assertion contradicted by that evidence or an estimate lacking measurement. **UNKNOWN** marks information unavailable within scope. Arithmetic inputs explicitly marked **ASSUMPTION** are not measured facts.
- No tests, application execution, dependency installation, Firestore/EODHD access, pricing lookup, flags or product-file edits. Network limited to the authorized fetch and final push. The only created file is this report, overriding the generic external-copy convention in `docs/BUILD_RULES.md:62`.
- Verdict: **buildable with the changes listed**. The observation-only core is feasible; the literal V1 guarantees are mutually inconsistent in several places.

## Part 1 — The nine questions

### Q1. Serialization, dispatch and model-visible transformations

**VERIFIED — the actual call is in the handler, not the module named transport.** `api/cron/agent-evaluate.js:2259` builds system, identity and live-context strings in that order. `:2302` calls `anthropic.messages.create`; the request also includes the assistant acknowledgement at `:2309`, the full `TRADE_DECISION_TOOL` at `:2312`, forced tool choice at `:2313`, model, output ceiling and temperature at `:2303`. Storing just the three prompt strings would omit model-visible material.

The client is an ordinary `Anthropic` instance with `maxRetries: 0`, initialized at `api/cron/agent-evaluate.js:162`. `api/_utils/agentEvalTransport.js:14`, `:48`, `:59`, `:80`, `:167` contain constants, classification and budget helpers; that file performs neither dispatch nor serialization. Neither it nor the handler appears on the literal fence-file list (`docs/BUILD_RULES.md:14`).

**VERIFIED locally, deployment UNKNOWN — SDK boundary.** The worktree has no installed SDK. Read the existing sibling checkout's installed package, without importing or executing it, at `C:\Users\fashr\portfolio-duel\node_modules\@anthropic-ai\sdk`. Its `package.json:3` reports **0.71.2**, matching this worktree's `package-lock.json:74`. The following citations are relative to that package:

| Boundary | Inspected source | Consequence |
|---|---|---|
| `messages.create` | `src/resources/messages/messages.ts:75` | Passes the body to `POST /v1/messages`; adds request options, not prompt text. |
| Serializer | `src/client.ts:328`, `src/client.ts:852`, `src/internal/request-options.ts:86` | The fallback encoder uses `JSON.stringify(body)` at `:91`. This is the real serialization seam. |
| Preparation / fetch | `src/client.ts:484`, `:492`, `:549`, `:576`, `:731`, `:745` | Default preparation hooks are empty. Builds headers, signal and method, then invokes fetch. No additional model-visible prompt rewrite was found on this configured path. |
| Response | `src/internal/parse.ts:46`, `:50`, `:75` | Parses response JSON and adds request-ID metadata. The returned object is not the raw received response bytes. |

The dispatch form therefore includes handler-added messages/tool definitions and SDK JSON encoding. No application adapter between those builders and this call rewrites their content. This is static evidence for the pinned implementation, not an observation of production traffic.

**Required change:** define “bytes” as the outgoing UTF-8 HTTP entity body and incoming entity body exposed by fetch, excluding authentication headers. Observe the final request body and preserve a bounded response copy before SDK parsing, including non-2xx/malformed bodies when available. Preserve status, returned model and parsing/validation disposition separately. `JSON.stringify(response)` cannot prove equality with received bytes. Instrumentation must not consume the SDK's response stream or turn capture-copy failure into request failure. If byte capture cannot finish, record its absence; do not fabricate raw bytes from the parsed object.

`response`, `built` and `validation` are block-local (`api/cron/agent-evaluate.js:2268`, `:2300`, `:2341`). The original proposal must be copied before the deterministic layer can replace `haikuResult` at `:2681`. Capture through a request-local holder; avoid a shared mutable “latest request” on the cached client.

### Q2. Tick size and storage location

**UNKNOWN — today's production distribution.** There is no authorized production export here, and building real prompts would execute application code and possibly fetch institutional data. No current p50/p95/max request, response, manifest or parent-document size was measured.

**VERIFIED — local fixture scale, not a current production sample:**

| File content read | UTF-8 bytes | Qualification |
|---|---:|---|
| Stored system prompts, six archetypes, tiered | 16,392–16,614 | `api/_utils/__fixtures__/ask2PromptGoldens.json:3`; historical pre-Ask-2 goldens, provenance at `:2`. |
| Stored system prompts, flat-six | 16,305–16,527 | Same file `:11`. |
| Stored identity block / institutional variant | 1,381 / 1,850 | Same file `:27`, `:28`. |
| No-swap live-context fixture, provenance header removed | 3,611 | `api/_utils/__fixtures__/tickCoherenceLiveContextGolden.noSwap.txt:10`; checkout newline representation included. |
| Tool-schema source file | 10,701 | `api/_utils/agentEvalToolSchema.js:4`; **source-file size, not serialized tool JSON**. |

These numbers were obtained by reading existing files, decoding the stored JSON strings and counting UTF-8 bytes; no renderer/test was run. They show why a kilobyte-sized tick estimate would be implausible. They do not constitute one mutually matched full request. Current construction still contains identity, live context, tools, news and optional institutional/Forge blocks (`api/_utils/agentEvalPromptAssembly.js:746`, `:1122`, `:1244`, `:1257`).

**NOT VERIFIED — planning size:** use **40 KiB request + 8 KiB response + 16 KiB persistent metadata/manifest/actions = 64 KiB per model check**. The 16 KiB allowance can be thought of as roughly 100 manifest rows averaging 120 bytes plus about 4 KiB of controls/actions/envelope; both quantities are assumptions. The output ceiling is verified at 2,048 tokens (`api/_utils/agentEvalTransport.js:59`); four bytes per token is only a planning conversion, not a byte limit. The historical output observations in that file's `:50` comment are not current measurements. JSON escaping, Unicode, tool schema, HTTP-error bodies and unbounded text inputs can change the size substantially. A skipped tick should be smaller; this model conservatively treats every admitted tick as full-sized.

**VERIFIED as architecture; precise remaining parent capacity UNKNOWN.** The handler uses `agentBattles`, not `battles` (`api/cron/agent-evaluate.js:596`); the executor agrees (`api/_utils/agentSwapExecution.js:118`). The natural path is:

```text
agentBattles/{battleId}/ticks/{battleId}:{tickSeq}
```

Firestore's standard document limit is 1 MiB; no live quota lookup was made. At the planning size, 150 embedded ticks would be **9.375 MiB**, and one ordinary 26-check day would be **1.625 MiB**, before existing battle fields. Therefore the parent cannot be the uncapped backing store. **Do not overstate this as “one tick cannot fit”:** one latest tick might fit; this audit cannot know its remaining space. Existing evaluations and trades already have caps (`api/cron/agent-evaluate.js:3496`; `api/_utils/agentSwapExecution.js:354`).

V1 needs a maximum-size/overflow policy for individual tick documents as well. Large raw bodies and manifest values should have single-field index exemptions; `firestore.indexes.json:566` currently has an empty `fieldOverrides` list. Preserve queryable small fields such as time, battle ID and schema version. The future owner must choose bounded omission with an explicit incomplete reason, or an external body store; unbounded exact bytes in one Firestore document cannot be guaranteed.

### Q3. Alternatives: actual predicates and their coverage

**VERIFIED — partial, branch-dependent computations, not a universal eligibility table.** The initial ordinary bench is assembled at `api/cron/agent-evaluate.js:735`; hot-bench entries are added at `:1162`; later catalyst names at `:2074`. Tournament filtering removes names before later observers can see the original pool (`:707`, `:1166`). A capture of only the final bench loses the removed names and their reasons.

| Predicate | Where computed today | Names and limits |
|---|---|---|
| Asset class | `api/_utils/agentRiskManager.js:445`; `api/_utils/agentSwapExecution.js:67` | Picker compares candidates against **this outgoing position**. Validator compares the proposed pair. Hot-bench fallback is considered non-crypto. Cannot report global per-name pair eligibility from this alone. |
| Cooldown | `api/_utils/agentRiskManager.js:443`; `api/_utils/agentSwapExecution.js:59`; display at `api/_utils/agentEvalPromptAssembly.js:1509` | Picker candidates and proposed ordinary bench asset. Hot-bench-only match has no cooldown in the validator. Rendering a cooldown is not a persisted validation result. |
| Active holding / self | `api/_utils/agentRiskManager.js:441`; `api/_utils/agentSwapExecution.js:52`, `:175`; `api/cron/agent-evaluate.js:1162`, `:1501` | Picker and synthetic hot bench exclude held names; proposed pair and fresh executor transaction enforce identity/duplicate rules. Tournament held-by-others joins the exclusion set at `:1505`. |
| Known distressed | `api/cron/agent-evaluate.js:997`, `:1243`, `:2752`, `:4318` | Regime map covers **initial held + ordinary bench names with usable technical docs**. Newly added hot-bench/catalyst names need not have a regime. Post-model incoming name is rejected if its regime is known distressed; suppression-pass selected replacement has the same downgrade. Unknown is not known-safe. |
| Missing quote | `api/cron/agent-evaluate.js:778`; `api/_utils/agentSwapExecution.js:180`, `:276` | Early health gate checks held + opponent positions, **not the whole bench**. Executor validates its selected incoming price after considering a fresh beacon. Picker momentum sorting substitutes zero (`api/_utils/agentRiskManager.js:453`), not exclusion. There is no universal precomputed bench missing-quote verdict. |
| Tempo / rolling cap | `api/cron/agent-evaluate.js:1356`, `:1466`, `:2808`; `api/_utils/agentRiskManager.js:513` | Effective knobs are clamped once; cap is checked for eligible forced-rotation reasons and the surviving proposed/forced pair. Count reads retained trades, excludes specified emergency/user-directive reasons, and is tick-state/reason dependent rather than an incoming-name property. |
| Hurdle | `api/cron/agent-evaluate.js:1515`, `:2792`; `api/_utils/agentRiskManager.js:337` | Stagnation picker tries candidates for a particular outgoing position until one passes. Surviving post-model pair gets its own check. Emergency/user-directive bypasses precede floor logic (`:339`, `:348`); bench-positive and ATR margin at `:363`, `:370`. |

The guardrail picker likewise checks a replacement for a selected breach (`api/_utils/agentGuardrails.js:503`). It can annotate a distressed replacement without rejecting it there (`:526`); the downstream branch owns the downgrade. Forced risk replacement does not universally run the post-model distressed veto.

**VERIFIED — no full Cartesian validator enumeration in the inspected evaluation path.** Production caller search for `validateTradeDecision`, `pickSwapReplacementCandidate` and `clearsHurdleFloor` located the proposed-pair call at `api/cron/agent-evaluate.js:2762`, the tier lookup at `:3238`, the two risk-picker branches at `:1510`/`:1530`, and the guardrail picker above. Stagnation does perform limited outgoing/candidate comparisons, so “only per-name filtering” would also be wrong. It stops at the first qualifying candidate (`api/_utils/agentRiskManager.js:458`).

**Required change:** Tier 1 must record `evaluated / not_evaluated / unknown / bypassed`, the stage, relevant outgoing symbol/reason and the actual observed result. Do not label untouched predicates “passed.” Keeping rejection reasons discarded by `.filter` is new instrumentation; recomputing all names later is a new observational calculation and must be identified as such. Do not call validators again to fill a matrix. Also retain LOCK, sector/other guardrail, conviction, hypothesis and tournament reservation outcomes; the listed seven predicates do not cover execution legality (`api/_utils/agentSwapExecution.js:77`, `:85`; `api/cron/agent-evaluate.js:2660`, `:2744`, `:2907`).

### Q4. Every admitted-tick exit and the proposed vocabulary

**VERIFIED — admission means successful lease acquisition** for this report. There are six explicit post-admission early `return;` sites, normal completion, and the exception escape in `processAgentBattle`. Helper-function and callback returns are distinguished below. V1 does not define `stageReached` values; the descriptions here are mappings, not newly asserted shipped codes.

| Exit / final path | Exact source | Current effect | V1 mapping / gap |
|---|---|---|---|
| Unusable required held/opponent quotes | `api/cron/agent-evaluate.js:780`, return `:786` | Releases lock best-effort; preserves scores; no evaluation entry | `checkAttempted=false`; **missing vocabulary**, recommend `degraded_quotes`. Not `no_trigger`. |
| Passive CPU battle | `:971`, return `:988` | Score flush; no risk/model evaluation | `checkAttempted=false`; **missing**, recommend `cpu_passive`. Decide explicitly whether these admitted ticks are included. |
| Pending proposal suppresses check | `:1970`, return `:1978` | Score/feed flush, no trigger/model | **Missing**, recommend `proposal_pending`. Lifecycle is dormant in normal autopilot, but reachable with non-autopilot legacy state (`:3756`, `:3990`). |
| Existing pending gameplan | `:1995`, return `:2003` | Deterministic suppression pass may trade; then score/feed flush | **Missing**, recommend `gameplan_pending`; keep executed actions even though no model check. |
| New gameplan created | `:2023`, return `:2046` | Deterministic suppression pass, meeting and score/feed flush | **Missing**, recommend `gameplan_created`. |
| No trigger | `:2135`, return `:2151` | Score/feed flush; risk actions may already have occurred | Existing V1 addition `no_trigger`; keep actions independently. |
| Full path reaches final update | `:3611`, falls through `finally` at `:3617` | Evaluation appended; score/feed/counters flushed | Success: `failureReason=null`; distinguish chosen decision, downgrade and committed actions. Failure subcases below. |
| Any thrown error inside admitted body | lock-clear catch `:3613`, rethrow `:3616`; outer receipt `:381` | May follow committed trades or failed final update; narration still runs in `finally` | **Missing**, recommend `tick_error` plus exact stage and commit status. A failed final battle write cannot satisfy “after the final update succeeds.” |

**VERIFIED — Sep 20 gates are not additional returns.** A committed risk swap whose refresh fails sets `refreshFailure` at `:1859`, breaks the risk loop and deliberately falls through to record `refresh_failed` at `:2209`. The merged gates suppress proposal handling (`:1967`), meeting handling (`:1988`), meeting detection (`:2011`), news fetch (`:2057`), catalyst additions (`:2074`), trigger evaluation (`:2117`), and S10 guardrails (`:2658`). The coherence rebuild is also withheld at `:1929`. None should be logged as an independent successful check; record these stages as skipped because the committed book could not be re-read. The final path retains the failure.

**VERIFIED — full-path failure vocabulary is broader than V1's closed list:**

- `refresh_failed` and `budget_skipped`: no prompt/call (`api/cron/agent-evaluate.js:2209`, `:2220`).
- `build_timeout`: build race, no dispatch (`:2271`; `api/_utils/agentEvalTransport.js:85`). Other builder errors can be `TypeError`, `Error`, etc.
- `timeout`: SDK/backstop classification; preserve `timeoutKind` (`api/_utils/agentEvalTransport.js:89`, `:123`).
- `truncated_response`: no tool block at `api/cron/agent-evaluate.js:2344`; do not infer that every token-ceiling response takes this branch.
- `invalid_tool_result`: present tool input fails validation, retain `invalidField` (`:2353`).
- HTTP status strings, e.g. `429`/`529`, constructor names and `unknown`: returned by `api/_utils/agentEvalTransport.js:99`, not in V1's enumeration.
- `guardrail_error` is **separate** from the model outcome: `guardrailFault` at `api/cron/agent-evaluate.js:2735`, separate fault rows at `:3552` and `:3560`. Both can occur in one tick; one scalar failure cannot replace either.
- Validation rejection, LOCK, distress, hurdle/cap, reservation failure and swap-execution failure can produce a HOLD with a successful model response. Preserve those in structured post-decision/action outcomes, not a fabricated model failure (`:2744`, `:2752`, `:2762`, `:2816`, `:2822`, `:2907`, `:3069`).

**Not admitted:** lease refusal returns at `:638`; transaction callback's `return false` at `:607` is its cause, not another admitted exit. Handler budget deferral is `break` at `:373`, before calling `processAgentBattle`. Thus `lease_held` and `deferred` have no admitted `tickSeq`. Use a separate scheduling-attempt record, or amend admission/identity deliberately; do not mint an admitted ID while refusing admission. Authentication, closed-market, no-active-battle and expiry/completion routes (`:198`, `:239`, `:315`, `:332`) are outside this tick lifecycle.

**Helper boundaries:** `handlePendingProposal` returns `'continue'` or `'skip_haiku'` (`:3747`, `:3990`, `:4157`); only the caller return at `:1978` ends the tick. Meeting helper returns continue for approved/rejected/expired and skip for pending (`:4721`, `:4733`, `:4751`, `:4756`). Suppression-pass returns (`:4216`, `:4228`, `:4294`, `:4300`, `:4305`, `:4310`, `:4333`, `:4383`) end that helper, then the caller's meeting path flushes. Its caught failure becomes a feed beat at `:4515`, not the main `guardrailFault`. Capture needs that separate result too.

### Q5. Score ownership, counter placement and lease

**VERIFIED — tick sum:** `api/cron/agent-evaluate.js:930` sums finite `battle.trades[].lockedPoints`; `:936` adds the separately banked badges; `:939` constructs score fields. The executor truncates trades at 50 (`api/_utils/agentSwapExecution.js:354`). The sum is taken **before** risk execution and intentionally not rebuilt after forced swaps (`api/cron/agent-evaluate.js:1916`). This timing is locked by `api/cron/agent-evaluate.tickCoherence.test.js:325`.

**NOT VERIFIED — “scoreState has exactly one writer” is false.**

| Writer | Evidence | Fields |
|---|---|---|
| Battle creation | `api/_utils/agentBattleService.js:274` | Initial scores, trade/hold/evaluation counts and daily badge state. |
| Tick handler | `api/cron/agent-evaluate.js:939`, `:3509` | Active/banked/current/opponent/peak scores; evaluation/hold counts. |
| Swap executor | `api/_utils/agentSwapExecution.js:363` | Monotonic trade count in the trade transaction. |
| Nightly scoring | `api/cron/agent-daily-scores.js:176`, `:193` | Banked badge total/breakdown and daily scores. |

These are enough to refute single ownership; they are not a claim that every administrative/historical writer was censused. One canonical source can have multiple coordinated field writers, but V1 must specify that ownership rather than assuming a single writer.

**VERIFIED — `tickSeq` can be minted in the existing transaction.** The transaction reads the battle at `api/cron/agent-evaluate.js:600`, checks lock age at `:604`, updates the same document at `:629` and returns at `:632`. It can read a stored sequence, increment it only on acquisition, write it alongside the existing lock and return the committed sequence. This adds a field to an existing write, not necessarily a new write operation. It is new implementation, not already present. Transaction callbacks can retry: return the final committed ID; never emit capture side effects or count callback attempts inside them. With capture off, the sequence must not be written.

The lease is a timestamp with a 120-second timeout (`:158`), not an owner-token/fencing protocol. It refreshes only `controlEpochLog` and `regimeAtStart` onto the queried battle (`:617`), not the whole snapshot. Minting unique IDs does not prove no overlap, fresh controls, no stale score flush or exactly-once action application. Preserve this distinction rather than silently redesigning leases in an observation build.

**V1's cumulative-total rule is insufficient.** If action A commits, B commits, then A is retried, `lastAppliedActionId` equals B and A is not recognized as already applied. A scalar last ID handles only an immediately repeated last action; it does not cover arbitrary retry/overlap. Even suppressing a duplicate increment must suppress the associated duplicate trade, and return the original result. A stable action ID must survive proposal approval/expiry retries and process retries. This needs an executor-owned transaction/idempotency contract, commonly a durable per-action receipt in the same transaction; that adds scope and possibly one write per action.

Initialization must happen in a fresh transactional snapshot, with a declared before/after-append order, basis count, completeness and schema version. Seeding outside the transaction on “first read” can overwrite intervening increments. Use each battle's stored cumulative trade count when available; do not use the global maximum to label every battle incomplete. Missing/legacy counters are unknown. Existing retained data cannot reconstruct lost locked points.

**VERIFIED — “no reader recomputes” is new product work:** `src/screens/AgentBattleScreen.jsx:1029`, `src/utils/flat6BattleEnrichment.js:196` and `src/utils/computeDayScore.js:24` recompute from trades. A single lifetime total cannot replace the last helper's per-day breakdown. V1 needs a reader migration scope and daily source decision, or must defer those changes.

### Q6. Player text and the sentinel boundary

**VERIFIED — current eval text sinks and adjacent capture risks.** This is a sink inventory for the requested record, not a claim that every stored field is player-authored in ordinary operation. Fields already rendered must remain in an exact original. Fields merely available on an object must not be copied by a broad snapshot spread.

| Field family | Route into capture / model | Evidence and disposition |
|---|---|---|
| `agentContext.agentName` from agent `name` | System and identity strings; response may repeat it | User-supplied persistence `src/services/agentService.js:123`; frozen copy `api/_utils/agentBattleService.js:182`; rendered `api/cron/agent-evaluate.js:2157`, `api/_utils/agentEvalPromptAssembly.js:753`. A name is not guaranteed free of user text. |
| `agentContext.activeRules[].text`, `.textTemplate`, `.paramValues.*`, `.params.*.default`; rendered category | Identity Forge block | Input supports arbitrary rule text and string params: `src/services/forgeService.js:56`, `:82`, `:104`; projected at `api/_utils/projectActiveRules.js:44`; interpolation/render `api/_utils/agentEvalPromptAssembly.js:805`, `:860`, `:877`. Sanitizer strips selected injection phrases and truncates; it does not anonymize (`api/_utils/agentPromptAssembly.js:301`). |
| `directive.text`, `directiveThreadId`, `adjustmentId`, `canonicalTextVersion`, expiry | Prompt control block and proposed inline controls | Modern gate writes catalog text (`api/_utils/directiveGate.js:149`, `:165`), filing at `api/_utils/directiveFiling.js:50`; renderer consumes the stored text (`api/_utils/controlPromptRenderer.js:123`, `:213`). Historical/noncanonical slots are not re-canonicalized at rendering. Missing version must remain unknown. |
| `agentContext.standingLeans[].text` and their IDs/versions; `leanOverrides` | Resolved lean text | `api/_utils/agentEvalPromptAssembly.js:1235`; `api/_utils/controlPromptRenderer.js:231`. Modern bounded controls are not a justification for blindly copying all legacy text. |
| `vision.thesis.statement`; `thesis.structuredSummary.direction`, `.scope[]`, `.drivers[]` | Live-context Vision block | Handler forwards Vision at `api/cron/agent-evaluate.js:1279`; renderer at `api/_utils/agentEvalPromptAssembly.js:1052`, `:1056`, `:1067`, `:1082`, `:1089`. String validation is not text anonymization (`src/types/vision/visionValidators.js:166`). |
| Active Vision constraint `payload.statement`, `ruleKind`, `ruleId`, `scope`, `eventCause`, `reason` | Constraint descriptions | `api/_utils/agentEvalPromptAssembly.js:1006`, `:1019`. User carveout statements are explicit. |
| `agentContext.strategyBrief`, `innerMonologue.{starRationale,coreRationale,supportRationale,benchRationale}`, `consolidatedInsight` | Identity block | Rendered at `api/_utils/agentEvalPromptAssembly.js:759`, `:765`, `:775`; frozen at `api/_utils/agentBattleService.js:184`, `:211`. Usually derived/model text; it can repeat earlier user content. No universal non-propagation proof was found. |
| `agentContext.equippedWatchlist.name`, `.thesis`; bundle names/rule metadata inside frozen manifest | Not a dedicated direct eval watchlist block; upstream deploy prompt and broad-snapshot exposure | Deploy rendering explicitly identifies name/thesis as user-authored (`api/_utils/agentPromptAssembly.js:134`). Frozen hash input includes the whole equipped watchlist (`api/_utils/resolvedAgentManifest.js:138`). The hash alone reveals no literal text; copying the object can. Derived strategy text is a possible later route, not a proven echo in a particular battle. |
| `evaluations[].rationale`, `.hypothesis`; all raw response string leaves | Last-three-decisions prompt and exact response | `api/_utils/agentEvalPromptAssembly.js:1389`; response capture `api/cron/agent-evaluate.js:2340`. Tool text includes rationale/hypothesis, status text, reasoning thesis/indicators, rule-citation explanations and anticipation text (`api/_utils/agentEvalToolSchema.js:38`, `:108`, `:134`, `:152`, `:163`). An echo remains text even when the model authored the container. |
| `chatExchanges[].userMessage`, `.agentResponse`/legacy `.agentMessage`, `.scratchpad`, `.directive.text`, `.suggestedActions`; `.archetypeGate.originalUserAsk`, `.counterOfferText`, `.rejectionReason` | **Not directly read by the eval builder**; would leak through copying whole battle/chat/receipt objects into manifest or controls | `api/agent/chat.js:674`, `:1025`, `:1056`, `:1071`; `api/_utils/directiveGate.js:242`, `:284`. Modern canonical directive filing does not copy `originalUserAsk` into the directive. |
| Action/evaluation/feed/proposal/meeting free text: rationale, hypothesis, reasoning, diagnosis, comments/messages and error text | Proposed executed-actions and outcome fields if copied wholesale; may carry prior model/user text | Closed trade spreads `evaluationMetadata` at `api/_utils/agentSwapExecution.js:270`; evaluation strings at `api/cron/agent-evaluate.js:3243`; gameplan data consumed at `:4545`; client may update proposal/ledger/meeting fields under `firestore.rules:437`. Capture should select known action facts, not spread these containers. |

Rendered symbols, sectors, rule IDs and source labels are also string sinks; if the build admits arbitrary legacy/malformed values, it cannot exempt them from the sentinel scan merely because their normal purpose is an identifier (`api/_utils/agentEvalPromptAssembly.js:1479`, `:1513`). News/provider text is not normally player-authored, but exact response echoes and imported fixture contamination still belong in payload scanning.

**NOT VERIFIED — a blanket “no player words” guarantee.** The narrow test in V1 can pass for a fresh canonical directive turn if its sentinel stays only in chat/forensics and those objects are excluded from capture. That does **not** prove the broader privacy claim. A sentinel placed in a rendered custom rule or name must appear in a byte-exact request; removing it would violate exactness or change the model input.

**Required acceptance split:** (1) prove raw chat/forensics are not newly copied into the eval record; (2) prove exact capture preserves text that legitimately was rendered; (3) enumerate/export-redact sensitive fields in a separate artifact. Include legacy directive, rule/parameter, Vision, derived-memory, response-echo and broad-`not_rendered` cases. Define an allowlist of manifest sources and make `not_rendered` values absent/redacted where appropriate. “Every snapshot field” plus indefinite `valueAsRendered` storage would otherwise copy material the model never saw and bypass the intended text-retention boundary. Completeness of a future payload schema remains **UNKNOWN** until that schema is fixed.

### Q7. Writes, storage and Firestore cost

**VERIFIED schedule, NOT VERIFIED utilization.** `vercel.json:157` schedules every 15 minutes in a broad UTC window; the handler checks market opening at `api/cron/agent-evaluate.js:313`. `api/_utils/marketSchedule.js:23` and `:269` admit 09:30 through 15:59 ET on normal trading days: **26 scheduled opportunities**. Holidays/early closes reduce this. The serial handler defers its tail at 290 seconds (`api/cron/agent-evaluate.js:367`), so 200 battles do not prove 5,200 actual admissions or model calls. Below is the capacity budget if all B battles remain active and get admitted at every opportunity.

**Explicit assumptions:**

1. Constant concurrency B, 26 admissions/battle/normal trading day; no manual/duplicate invocations. Use 22 trading days/month, 252/year and `90 × 5/7` trading days for the 90-calendar-day illustration; these approximations are separate planning conventions, not an actual holiday calendar.
2. Every tick uses the conservative 64 KiB model from Q2: 48 KiB request/response text and 16 KiB indefinitely retained manifest/metadata. Skips can reduce this; larger manifests increase it.
3. One new tick-document write per admitted tick. The sequence rides the existing lease write; it adds **zero incremental write operations**. No per-action ledger, capture-failure write, reader, export, retention work or new counter transaction included in the base figure.
4. Illustrative USD rates: **$0.18/100,000 writes, $0.06/100,000 reads, $0.18/GiB-month storage**. Region, edition, live rates, taxes, free quota and existing project quota consumption are **UNKNOWN**. These are assumed rates, not a verified Google quote. No pricing page was fetched, per task restrictions.
5. Base storage is payload plus the stated metadata allowance, **not billed index size**. Assume large text/manifest payloads are exempted from indexing. Egress, backups/PITR, provider/model charges and baseline battle operations are excluded.

Let `W = 26B`, `R = 48 KiB`, `M = 16 KiB`. Incremental writes/month = `22W`; charge = `22W × 0.18 / 100000`. First-90-day documents = `W × 90 × 5/7`; bytes = documents × `(R+M)`. One GiB = 1,048,576 KiB.

| Metric | 20 battles | 200 battles |
|---|---:|---:|
| New tick writes / normal trading day | 520 | 5,200 |
| Payload growth / trading day | 32.5 MiB | 325 MiB |
| New tick writes / assumed month | 11,440 | 114,400 |
| Write cost / month | $0.0206 | $0.2059 |
| Approx. records in first 90 calendar days | 33,429 | 334,286 |
| Request/response portion at day 90 | 1.530 GiB | 15.302 GiB |
| Persistent portion accumulated by day 90 | 0.510 GiB | 5.101 GiB |
| Total stored at day 90 | **2.040 GiB** | **20.403 GiB** |
| Storage monthly rate at that footprint | $0.3673 | $3.6726 |
| Writes + storage monthly rate at day 90 | **$0.3878** | **$3.8785** |

These are monthly rates at the stated footprint, not the total bill incurred over those 90 days. Free-tier credits are deliberately not assumed. Approximate index overhead multiplying stored bytes by 2 would increase the day-90 totals to about **$0.76 / $7.55 per month**, including writes; it is a sensitivity example, not measured indexing behavior.

For a simple successful tick with no other writes, the existing lease update (`api/cron/agent-evaluate.js:629`) and final battle update (`:3611`) plus capture make **three writes total**: 1,560 / 15,600 per trading day, of which 520 / 5,200 are incremental capture writes. Actual total application writes are higher and workload-dependent because trades, receipts, epoch stamps, diagnostics, narrations and other paths can write independently. The table prices the incremental capture feature, not the entire application's bill.

**Retention is not a steady-state total.** With actual enforcement after 90 days, request/response bytes approach the rolling quantity above but manifests keep growing. For elapsed calendar time T and average additional live-battle retention L, a useful model is:

```text
retained text GiB ≈ W × (5/7) × min(T, 90 + L) × 48 / 1048576
permanent GiB     ≈ admitted ticks since launch × 16 / 1048576
```

V1 says **battle lifetime plus 90 days**, not 90 days since capture. For a fixed battle lifetime L, early ticks live up to `90+L` days; mean residence after completion depends on lifecycle and capture time. The displayed 90-day calculation takes L=0 for the requested simplified window. An extra seven calendar days of text residence adds about **0.119 / 1.190 GiB**, or **$0.0214 / $0.214 per month**. Specify the deletion anchor before rollout.

| At one year, 252 assumed trading days | 20 battles | 200 battles |
|---|---:|---:|
| Permanent manifest/metadata | 2.000 GiB | 19.995 GiB |
| Total with 90-day text enforcement, L=0 | 3.530 GiB | 35.298 GiB |
| Writes + monthly storage at that footprint | **$0.656** | **$6.559** |
| Total with V1's actual scope: no deletion mechanism | 7.998 GiB | 79.980 GiB |
| Writes + monthly storage without deletion | **$1.460** | **$14.602** |

At 32/128 KiB per tick, payload-storage figures halve/double if the text/persistent split scales proportionally; write count stays the same. There is no finite permanent-manifest steady state.

**Operations omitted from the base but required in a real budget:**

- A capture-failure receipt attempted after the final update adds up to one extra battle write per failed capture attempt; its own failure may leave no receipt. Fault rate is unknown.
- A per-action deduplication ledger adds writes proportional to actions, not ticks. §4.9's final mechanism has not been chosen.
- Future text removal from the **same** document requires an update while retaining the manifest. In a simple one-read/one-update-per-expired-tick design, mature retention adds about 11,440 / 114,400 reads and updates per month: **$0.0275 / $0.2746** at the assumed rates, before query/index overhead. Whole-document TTL would destroy the permanent manifest.
- Export of K tick documents costs approximately K document reads, subject to query minimums/index rules, plus bytes transferred. Once-monthly export of 11,440 / 114,400 docs adds about **$0.0069 / $0.0686** in document reads, with up to roughly 0.70 / 6.98 GiB of payload transfer at this size. Repeated history exports multiply it.
- Existing lease/score/feed/trade writes are baseline costs, not new capture writes. Additional latency can reduce later admissions even when capture exceptions are swallowed. At only 100 ms/capture, a 200-battle serial pass gains **20 seconds**; the “changes no decision path” guarantee needs a defined timing allowance.

### Q8. Production maxima: exact read-only procedure and its limit

**UNKNOWN — no production read performed.** The following is a proposed operator command, included only in this report. Run it later from an existing Windows checkout with `firebase-admin` installed, using ADC for the explicitly selected production project and a read-only IAM identity (for example `roles/datastore.viewer`). Do not import application initialization that could have side effects, use a production-writer identity, or print credentials. Set `GOOGLE_CLOUD_PROJECT` to the approved project; do not rely on an implicit default. This procedure creates no script file and writes nothing to Firestore.

**Crucial limit:** the database does not preserve the requested exact lifetime evaluation count. `scoreState.evaluationCount` is `evaluations.length` after `.slice(-150)` (`api/cron/agent-evaluate.js:3496`, `:3509`). `cronState.totalHaikuCalls` counts attempted engine paths, including failed builds, while excluding budget/refresh skips (`:3514`, `:3522`). Those skips can still append an evaluation. `evalId` also derives from capped length (`:2507`). Neither is an exact uncapped evaluation counter. No read-only query can recover events already discarded. The script therefore reports the maximum stored trade counter, retained counts, engine attempts and conservative observed evaluation lower bounds, explicitly leaving lifetime evaluation maximum unknown. It scans all **surviving** battle documents, not only active ones; deleted battles require an archive.

```powershell
# FUTURE OPERATOR PROCEDURE ONLY — NOT RUN IN PHASE 0.
# Supply approved project and read-only ADC in this shell first.
@'
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error('Set GOOGLE_CLOUD_PROJECT explicitly');
if (process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Emulator configured; this would not answer production counts');
}
const app = initializeApp({ projectId, credential: applicationDefault() });
const db = getFirestore(app);
const startedAt = new Date().toISOString();
const maxima = {};
let cursor = null, scanned = 0, pages = 0;
let missingTradeCounter = 0, missingAttemptCounter = 0;
let tradeCounterBelowRetained = 0, retainedAtEvalCap = 0;
let anyHistoricalTradeCap = 0;
const count = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const note = (key, value, id) => {
  if (value === null) return;
  if (!maxima[key] || value > maxima[key].count) {
    maxima[key] = { count: value, exampleBattleId: id };
  }
};
try {
  while (true) {
    let q = db.collection('agentBattles')
      .orderBy(FieldPath.documentId()).limit(500)
      .select('scoreState.tradeCount', 'scoreState.evaluationCount',
              'cronState.totalHaikuCalls', 'trades', 'evaluations');
    if (cursor !== null) q = q.startAfter(cursor);
    const page = await q.get();
    pages++;
    if (page.empty) break;
    for (const snap of page.docs) {
      const b = snap.data();
      const trades = Array.isArray(b.trades) ? b.trades.length : 0;
      const evals = Array.isArray(b.evaluations) ? b.evaluations.length : 0;
      const tc = count(b.scoreState?.tradeCount);
      const ec = count(b.scoreState?.evaluationCount);
      const attempts = count(b.cronState?.totalHaikuCalls);
      scanned++;
      if (tc === null) missingTradeCounter++;
      if (attempts === null) missingAttemptCounter++;
      if (tc !== null && tc < trades) tradeCounterBelowRetained++;
      if (evals >= 150) retainedAtEvalCap++;
      if (tc !== null && tc > 50) anyHistoricalTradeCap++;
      note('storedCumulativeTradeCount', tc, snap.id);
      note('retainedTrades', trades, snap.id);
      note('retainedEvaluations', evals, snap.id);
      note('storedEvaluationCount', ec, snap.id);
      note('engineAttemptsNotLifetimeEvaluations', attempts, snap.id);
      // Use retained rows only for an unconditional observed lower bound.
      // Attempt counters are reported separately; historical integrity is not assumed.
      note('observedEvaluationLowerBound', evals, snap.id);
    }
    cursor = page.docs.at(-1).id;
    if (page.size < 500) break;
  }
  console.log(JSON.stringify({
    projectId, startedAt, finishedAt: new Date().toISOString(), scanned, pages,
    maxima, missingTradeCounter, missingAttemptCounter,
    tradeCounterBelowRetained, retainedAtEvalCap, anyHistoricalTradeCap,
    exactLifetimeEvaluationMaximum: null,
    limitations: [
      'Surviving documents only; deleted history is excluded',
      'Pages are not one atomic historical snapshot; active counters may advance',
      'Trade maximum is a stored-counter result, subject to legacy/counter integrity',
      'Evaluation history/count are capped; attempts omit some appended evaluations'
    ]
  }, null, 2));
} finally {
  await deleteApp(app);
}
'@ | node --input-type=module
```

**Cost assumption:** N surviving documents means approximately N billed document reads, plus one minimum read for an empty terminal page when needed; pagination does not reread previous documents. Field projection reduces payload, not read count. At the assumed $0.06/100,000 reads, 1,000 documents cost about **$0.0006**, 100,000 about **$0.06**, plus network transfer and any applicable query/index charges. The arrays are projected only to count them locally; their contents are not printed. Their transfer size is unknown. Ordering only by document ID avoids a bespoke composite index for this scan. Validate actual project billing before running.

To claim an exact all-time evaluation maximum would require a complete independent archive with uniquely identified events, including skipped/failed checks, or a new counter going forward. The optional best-effort shadow logger (`api/_utils/shadowLogger.js:2`, `:27`, `:52`) is not proof of such an archive. A production read can answer the trade-cap prerequisite for surviving battles with reliable counters; it cannot supply the lost evaluation history merely by being production-authorized.

### Q9. What is in scope at a capture point?

**VERIFIED — after `battleRef.update(finalUpdate)` at `api/cron/agent-evaluate.js:3611`, these main-path values are accessible, but this is not an all-tick capture point.**

| Value | Scope / availability | Required handling |
|---|---|---|
| `forcedEntryPrices` | `const` in outer try at `:1313`; accessible at `:3611` | Populated only **after successful refresh**, at `:1868`. A committed swap whose refresh fails breaks at `:1860` before entry-price recording. Use immediate executor return data to retain that committed action/price; this map is not a complete action ledger. |
| `refreshFailure` | Same try, declared `:1316`; set `:1859` | Accessible on normal tail and already represented by `haikuFailure`. Unavailable outside try unless copied. Early quote/CPU paths occur before declaration. |
| `guardrailFault` | Same try, declared `:2180`, set `:2735` | Accessible on full path, with independent model failure preserved. Does not include suppression helper failures at `:4515`. |
| `holdKind` | No standalone variable; expression in `evaluation` at `:3290` | Read `evaluation.holdKind`. Only final HOLD + fallback is `default_failure`; deterministic SWAP after model failure is not a fallback HOLD. Early exits have no evaluation object. |
| `failureClass` / `invalidField` / `timeoutKind` | `haikuFailure` declared `:2168`; classifications at `:2344`, `:2353`, `:2370` | Preserve complete fields and separate `guardrailFault`. Early untriggered exits never declare these values. |
| Request, raw response, original tool validation | Build/call block locals at `:2268`, `:2300`, `:2341` | Not available at tail without explicit request-local capture storage. Raw HTTP response is already parsed at the application return. |
| Original model proposal vs final proposal | Initially `haikuResult` at `:2343`; can be replaced at `:2681` | Snapshot original before guardrails; do not call the final synthesized proposal “what the model said.” |
| All executed actions | Six executor sites, some inside helpers (`:1685`, `:2911`, `:3822`, `:4033`, `:4393`, `:4596`) | Collect committed executor results in execution order before later awaits. Pass the observer context into helpers. Existing capped arrays, feeds, `riskSwaps` intents and narration queues are not interchangeable with a full action ledger. |

The current `finally` can see `pendingNarrations`/`pendingAnticipations` declared outside try (`:646`, `:655`), but not the try's lexical locals. A proposed outer nullable capture context is new instrumentation and needs explicit filling at each observed stage; simply moving the final write into `finally` cannot reach the values and risks changing existing failure/narration behavior. A process kill still bypasses all JavaScript finalization.

## Part 2 — Critique and required decisions

### Contradictions and unacknowledged work

All items below are **VERIFIED static conflicts or design deductions** from the cited code/spec. No production defect rate is claimed.

| Priority / confidence | V1 issue | Required change and owner |
|---|---|---|
| Blocker / high | §4.2 promises one durable document per admitted tick but also one best-effort attempt after the final update. Early returns, thrown errors, process kill and write failure violate completeness. Existing fault receipts are assembled **before** the final update (`api/cron/agent-evaluate.js:3542`, `:3611`). | **Capture + scaling owners:** choose best-effort with observable gaps, or authorize durable admission/outbox/recovery. Define finalization for every Q4 path. A guaranteed failure receipt cannot use the same failing database without another reliability assumption. |
| Blocker / high | §4.9 changes score authority while §6 forbids score/model changes. Replacing a retained-50 sum with a cumulative sum changes long-battle scores; updating scores at a different instant changes intra-tick results. The next prompt reads those scores (`api/_utils/agentEvalPromptAssembly.js:1135`). | **Scoring/executor owner + Flash:** separate the cumulative score migration from observation, or explicitly amend the behavioral invariant and fence entry. Keeping a shadow total without making readers use it is a coherent smaller scope, but differs from V1. |
| Blocker / high | One `lastAppliedActionId` does not provide the stated retry/overlap guarantee; “first read” initialization is not an atomic commit rule. | **Executor owner:** specify stable IDs, dedup history, transactional initialization, repeated result behavior, concurrency and incomplete legacy basis. See Q5. |
| Blocker / high | §5 conflates exclusion of raw chat with exclusion of every player word. §4.3's exact original and arbitrary rendered text cannot both satisfy a blanket exclusion. | **Capture/privacy owner + Flash:** adopt Q6's scoped acceptance and field inventory. Preserve exact originals under a declared access/retention policy; sanitized exports remain separate. |
| High / high | §8 assumes handler/receipt work is fence-free and assembler is read-only. Full per-field source/vintage/render provenance is **not** an existing return value. Optional institutional data is fetched and formatted locally inside the fenced assembler (`api/_utils/agentEvalPromptAssembly.js:1250`). | **Prompt owner + capture owner:** approve a side-channel render manifest in the original build, or a specifically limited/versioned parser of dispatched bytes that admits unknown source/vintage. Never rebuild a prompt later to invent what was seen. |
| High / high | §4.7's vocabulary omits quote/CPU/meeting/proposal/uncaught-error exits, arbitrary HTTP/error classes and dual failures. It includes two pre-admission cases in an admitted-ID scheme. | **Capture + scaling owners:** use Q4's coverage map, define stages and admission; separate scheduler attempts, call result, guardrail fault and action outcomes. |
| High / high | §4.4 assumes every listed predicate is already computed for the whole bench and that a proposed-pair validation is universally available. Earlier gates can prevent that call, and guardrails may replace the proposal first. | **Capture owner:** persist only actual checks; unknown/not-run is first-class. **Guardrail/executor owner:** owns any fuller predicate API or Tier 2 enumeration. |
| High / high | §4.8 assumes a unified “armed” state and per-position exit-level snapshot. The code has risk verdicts (`api/cron/agent-evaluate.js:1438`), deployed guardrails and branch-dependent calculations (`api/_utils/agentGuardrails.js:253`, `:291`, `:319`, `:712`), not one exported armed/levels object. | **Risk/guardrail owner:** define configured/enabled/evaluated/deferred/blocked/unknown separately; identify basis quote, entry, peak, units, activation and precedence. A configured trailing stop may be inactive before a profit peak. A skipped S10 gate was not watching that tick. Capture may observe existing calculations; new decision-side recomputation is separate work. |
| High / high | §4.2 calls evaluations/trades “projections” of a tick record written later and allowed to fail. They remain independent authoritative writes and can exist without the tick. | **Capture owner:** call them existing capped summaries mirrored into capture, or authorize an actual event-source/projection architecture. Do not change their write order under an observation-only claim. |
| High / high | §5 requests retention cost with no enforcement, and permanent manifest `valueAsRendered` can retain a second copy of text past body deletion. One-document TTL cannot preserve part of a document. | **Storage/privacy owners:** state current unbounded growth, define completion-based retention timestamps and persistent fields, name the later sweeper/split-body task, index exclusions and overflow policy. |
| Medium / high | §4.1 legacy join names `(executedAt, outgoing, incoming)`, but executor stores `swappedOutAt`, `symbolOut`, `symbolIn` (`api/_utils/agentSwapExecution.js:255`). Existing `evalId` repeats after the cap (`api/cron/agent-evaluate.js:2507`). | **Capture/reader owners:** specify the real legacy tuple, collision/ambiguity handling and namespace. Add `tickId` alongside existing IDs; replacing prompt-visible `evalId` changes history bytes. Decide how one proposal's decision tick joins a later execution tick. |
| Medium / high | §4.5 assumes all controls have IDs/version/hash. New manifests contain `equippedConfigHash`, old battles may not (`api/_utils/agentBattleService.js:236`; `api/_utils/resolvedAgentManifest.js:165`). Mode epoch is not every control edit's sequence. | **Controls owner:** persist original nullable IDs/version/text, resolved vs suppressed state, and the actual frozen hash if present. Define epoch semantics and missing legacy state. No lookup of today's catalog/agent to “repair” historical controls. |
| Medium / high | §4.3 mentions claims/citations as if a dedicated claim-evidence schema exists. The tool has reasoning and Forge rule citations, not a universal source-linked claims array (`api/_utils/agentEvalToolSchema.js:108`, `:134`, `:152`). | **J1/reader owner:** treat raw output as evidence; derive/freeze claim packets separately. Do not add tool fields in this capture build. |
| Medium / high | §7 treats cost as the remaining flip gate; 12 trading days does not ensure enough complete pairs or disjoint battle/day groups. Shared serial budget can defer battles. | **Scaling + J1 owners:** require measured completeness, actual sizes, time overhead and corpus sufficiency, not just calendar elapsed time. |

### Fence contact register: corrections to §8

**VERIFIED — fence rules:** literal files at `docs/BUILD_RULES.md:14`; scoring and battle-creation shape are fenced concepts at `:26`. Observation through existing exports is permitted; edits need the applicable explicit founder entry. This audit makes no such edits and does not request implementation approval.

| Likely contact | Fence status / what V1 misses |
|---|---|
| `api/cron/agent-evaluate.js` | Not a listed fenced file. Changing its sum/score timing **is concept-fenced**. New sequence fields and admission semantics need a declared runtime-vs-creation shape plan, not automatic “fence-free” status. |
| `api/_utils/agentEvalTransport.js` or a new transport observer | Not on §1 list. Actual request lives in handler; do not edit SDK installation. Application-level fetch observation can be separate. |
| `api/_utils/agentSwapExecution.js` | Explicitly fenced and named in V1. Cumulative total/dedup behavior needs a broader contract than one field increment. Passing metadata through its existing spread may suffice for action IDs alone (`:270`); do not assume an executor edit is always necessary just for IDs. |
| **`api/_utils/agentEvalPromptAssembly.js`** | Fenced. A truthful per-render-field manifest with internal institutional vintages may need side-channel edits here; V1 explicitly assumes read-only and has not authorized that route. A limited parser alternative needs an honest reduced contract. |
| **`api/_utils/agentBattleService.js`** | Fenced. Initializing `tickSeq`, `lockedPointsTotal`, completeness/version fields at creation touches this file and its document-shape concept. V1 does not name it. Lazy transactional initialization can avoid a literal edit, but must be selected and reviewed rather than left to the builder. |
| **`api/_utils/agentRiskManager.js`**, **`api/_utils/agentGuardrails.js`** | Fenced. Exporting actual discarded predicate outcomes/armed-level calculations can require edits; calling existing exports alone does not. V1's “Tier 1 already computed” and §4.8 wording hide this conditional contact. |
| `api/_utils/agentScoring.js`, `api/_utils/archetypeScoring.js`, `api/_utils/agentArchetypeConfig.js` | Fenced. **No necessary literal edit established** for capture; do not expand scope into formulas/config. A new direct legacy-table importer also needs the import-boundary ratchet (`docs/BUILD_RULES.md:28`). |
| `api/agent/decide.js`, `api/_utils/agentPromptAssembly.js` | Fenced. **No necessary edit established** for eval-only capture. Broadening privacy into changes to upstream rendered player text would contact these and violate current scope. |

Also missing from the non-fenced file plan: feature flag/pin suite, capture helper/schema, index configuration, future retention implementation, export/reconciliation scripts, and—if §4.9 stays—the score readers identified in Q5. Reader scope conflicts with §2's “no reader beyond export” unless explicitly carved out. The current rules default-deny a new tick subcollection (`firestore.rules:1244`); Admin export works under IAM. The build need not grant client access merely because a future Film Room reader will want it. Define access deliberately; the parent owner's rule does not automatically cover children (`firestore.rules:441`).

### Is unchanged model input and decision behavior achievable?

**VERIFIED design conclusion:** an isolated, bounded observer can preserve request text and trading semantics under deterministic fixture inputs, if it retains the original request/response, uses separate state, leaves existing IDs/entries/guards intact and records only observed facts. It cannot offer zero wall-time influence on a budgeted serial loop. Capture time can change later budget decisions and anticipation dispatch (`api/cron/agent-evaluate.js:369`, `:2208`, `:3665`). Establish a measured upper bound and a permitted capture-skip policy; a Promise race by itself does not cancel a database write that may commit after the timeout.

**NOT VERIFIED for literal V1:** authoritative cumulative-score migration, guaranteed one-record durability, complete render provenance while freezing the assembler, universal player-text exclusion, and identical timing-sensitive control flow cannot all hold simultaneously. Decide these before implementation, rather than diluting the assertions until tests pass. Existing facts must keep their old meaning; newly acquired metadata can be additive.

## Part 3 — What would break, and how to preserve the guards

**All conclusions below are source inspection. No suite ran and no green result is claimed.** The prior integration report identifies the “three regional guards” as the frozen entry golden, executor census and assembly honesty (`docs/audits/20260919_BUILD_EVAL_FIX_INTEGRATION.md:176`); this report re-read their actual current tests.

| Guard | What trips it | Required build discipline | Mechanical vs design constraint |
|---|---|---|---|
| Tick-stamps control resolution | Exactly one cron `resolveControls(` and byte-identical assembler/cron arguments (`api/cron/agent-evaluate.tickStamps.pins.test.js:106`, `:117`) | Reuse/copy the actual resolution or formally adjust the source pin with an equivalence test. A second late resolution can cross expiry boundaries; no fresh slot/catalog lookup. | Count/string form is mechanical; capturing the controls actually rendered is substantive. |
| Stamp containment / build ordering | Stamp gate has no `await`/`battleRef`, is inside the fail-safe, and occurs once (`:130`, `:146`); prompt-built flips after builders and before the literal transport call (`:159`) | Keep network capture outside the stamp block. Transport wrappers/renaming need narrowly updated structural anchors without changing the ordering proof. | Syntax pins mechanical; failure isolation and no fabricated “seen” evidence substantive. |
| No refresh between prompt and stamp | Forbids reread/transaction/Object.assign in the window; exactly two `Object.assign(battle` occurrences (`:198`, `:212`); forbids directive mutation (`:215`) | Copy prompt-time state in memory. Do not refresh the live battle to populate historical controls. Mint sequence before prompt building and keep new capture persistence after authoritative work. | Both; a read introduced here genuinely changes the evidence vintage. |
| Decider history whitelist | Exactly eight eval keys in `formatRecentEvals`, no spread/stringification; trigger gate only reads length (`:222`, `:325`) | Keep new capture fields/subcollection out of prompt history and gate reads. Preserve existing IDs and base entry fields. | Real no-feedback constraint. |
| Frozen `PRE_PHASE_B_ENTRY_KEYS` and whole-update golden | Base field order/bytes, extra-key list and top-level `finalUpdate` keys are pinned (`api/cron/agent-evaluate.tickStamps.flagOff.test.js:185`, `:194`, `:202`; `api/_utils/__fixtures__/tickStampsHarness.js:57`) | Put capture data in its own document. Flag off must leave existing writes identical. If adding pointers in another sanctioned build, explicitly test them outside the frozen projection; never regenerate the historic golden to hide drift. A new capture flag also needs an explicit false mock in legacy fixture tests. | Additive-key harness changes mechanical; original bytes/order/write shape are real scope constraints. |
| Six executor sites and tournament wrappers | Six literal call sites/receipt sites (`api/cron/agent-evaluate.test.js:471`), reserve/confirm ordering (`:714`, `:732`), repo allowlist (`:827`) and positional snapshot arg (`:134`) | Observe returned commits at existing sites; do not create a seventh executor wrapper/caller or move execution to a new helper solely for capture. New tests should use established mocks; a literal call string in test code can trip the source census. Preserve all reserve/confirm/release behavior. | Text census mechanical; preventing unwrapped tournament execution is substantive. |
| Assembly honesty | Every local import into fenced assemblers must be classified; registered prose cannot name absent signals (`api/_utils/agentEvalPromptAssembly.honesty.test.js:81`, `:104`) | If an approved side-channel helper is imported, classify it in the correct registry in the same commit. Do not make capture add prompt prose, new indicators or “seen” labels for unavailable data. | Registry maintenance mechanical; truthful rendered evidence substantive. |
| Flag-pin guard | Pin/live value mismatch, invalid `DARK_BY_DESIGN`, missing `Pinned by:` pointers (`src/config/flagPinGuard.test.js:45`, `:289`, `:339`, `:353`) | Add `TICK_CAPTURE_ENABLED=false` to an existing registered source, a dedicated live false pin and pointer, and a dark-runway entry. Behavior suites mock on/off without contradicting the live pin. Separate flip updates both pin and dark entry. The guard is not itself a behavior test. | Mechanical enforcement of a real rollout boundary. |
| No-swap prompt golden and forced-swap score lock | Prompt bytes and provenance hash (`api/cron/agent-evaluate.tickCoherence.test.js:362`); fixed persisted score values (`:325`) | Keep capture inert to builder input, score timing and snapshot rebuild. Do not regenerate the no-swap golden at the new tree. §4.9's score migration needs separate authorized tests/invariants. | Real behavioral constraints. |
| Merged fail-closed behavior | Refresh/gameplan/S10 controls (`api/cron/agent-evaluate.astraFindings.test.js:553`, `:620`, `:645`), catalyst withholding (`:787`), multi-commit refresh failure (`:850`); tool invalidity and chosen-HOLD goldens (`api/cron/agent-evaluate.toolResultValidation.test.js:186`) | Capture must never call a skipped stage to manufacture missing values. Preserve original and final proposal, both failures and every already-committed action. Force capture failures/timeouts in future fixtures without altering these results. | Real safety and attribution constraints. |

Future authorized implementation validation should cover every Q4 exit with capture both off and on; multi-action ticks, successful commit followed by failed refresh, both model and guardrail faults, malformed/HTTP response bodies, out-of-order retries, size overflow and deadline ambiguity. Require no additional model/provider requests, no unhandled observer exceptions and no changed authoritative updates. These are recommendations for the build, not tests executed by Phase 0.

## Evidence index and delivery record

All repository anchors refer to **`75b89b9af54262a32ccfdf5a818293bf4eda159a`**, not the historical anchors in the Sep 19 report. SDK evidence is explicitly separate local installation evidence; Spec V1 remains external and was not copied into this branch.

| Subject | Primary evidence |
|---|---|
| Governing fence and discovery | `docs/BUILD_RULES.md:12`, `:26`, `:28`, `:30`, `:53`, `:55`, `:74` |
| Admission / early exits / finalization | `api/cron/agent-evaluate.js:595`, `:638`, `:786`, `:988`, `:1978`, `:2003`, `:2046`, `:2151`, `:3611`, `:3616`, `:3617` |
| Dispatch / validation / failure fields | `api/cron/agent-evaluate.js:2259`, `:2302`, `:2340`, `:2370`; `api/_utils/agentEvalTransport.js:48`, `:59`, `:80`, `:167` |
| Sep 20 refresh gates / coherent prices | `api/cron/agent-evaluate.js:1851`, `:1868`, `:1929`, `:1967`, `:1988`, `:2011`, `:2057`, `:2074`, `:2117`, `:2209`, `:2658` |
| Original vs deterministic proposal; HOLD classification | `api/cron/agent-evaluate.js:2681`, `:2735`, `:3290`, `:3552`, `:3560` |
| Eligibility / replacement coverage | `api/_utils/agentSwapExecution.js:28`, `:169`, `:276`; `api/_utils/agentRiskManager.js:337`, `:434`, `:513`; `api/_utils/agentGuardrails.js:503` |
| Score sources / caps / counters | `api/cron/agent-evaluate.js:930`, `:2507`, `:3496`, `:3509`, `:3522`; `api/_utils/agentSwapExecution.js:354`; `api/cron/agent-daily-scores.js:176`; `api/_utils/agentBattleService.js:274` |
| Existing recomputing readers | `src/screens/AgentBattleScreen.jsx:1029`; `src/utils/flat6BattleEnrichment.js:196`; `src/utils/computeDayScore.js:20` |
| Rendered fields / missing manifest | `api/_utils/agentEvalPromptAssembly.js:746`, `:1006`, `:1122`, `:1234`, `:1250`, `:1389`; `api/_utils/tickStamps.js:192` |
| Controls / user text | `api/_utils/directiveGate.js:149`, `:242`; `api/_utils/directiveFiling.js:50`; `api/_utils/controlPromptRenderer.js:213`, `:231`; `api/agent/chat.js:1025`; `src/services/forgeService.js:56`; `src/services/agentService.js:123` |
| Frozen control hash | `api/_utils/resolvedAgentManifest.js:129`, `:165`, `:212`; `api/_utils/agentBattleService.js:236` |
| Fixture size evidence | `api/_utils/__fixtures__/ask2PromptGoldens.json:2`, `:3`, `:11`, `:27`; `api/_utils/__fixtures__/tickCoherenceLiveContextGolden.noSwap.txt:1`, `:10`; `api/_utils/agentEvalToolSchema.js:4` |
| Schedule / budget / storage access | `vercel.json:157`; `api/_utils/marketSchedule.js:23`, `:253`; `api/cron/agent-evaluate.js:159`, `:367`, `:3665`; `firestore.rules:429`, `:1244`; `firestore.indexes.json:566` |
| Guard source | `api/cron/agent-evaluate.tickStamps.pins.test.js:106`; `api/cron/agent-evaluate.tickStamps.flagOff.test.js:157`; `api/cron/agent-evaluate.test.js:471`, `:827`; `api/_utils/agentEvalPromptAssembly.honesty.test.js:81`; `src/config/flagPinGuard.test.js:289`; `api/cron/agent-evaluate.tickCoherence.test.js:316` |

Delivery scope is exactly this report. Commit message: `docs: Phase 0 tick capture discovery`; branch: `docs/phase0-tick-capture`; no PR. Post-commit/push Git checks are reported in the delivery message because a report cannot embed its own final commit hash without changing that hash. No product changes, tests, flags or production reads were authorized or performed.
