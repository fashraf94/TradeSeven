# FantasyTrades BaggerBomb Threshold Correction Spec V1.1

October 12, 2026
Status: Stage 1 measurement tooling; future integration remains proposed

| Area | Direction |
| --- | --- |
| Measurement | Accepted: SMA of fourteen dollar true ranges, divided by the last completed close on one fully adjusted basis. |
| Position rules | Accepted for later integration: entry freeze, validated entry/swap anchor, fresh identity and history on re-entry. |
| Missing evidence | Accepted: no silent numerical default; new positions are ineligible when measurements are unavailable or stale. |
| Trading units | Accepted direction: separate scoring from calibrated risk/hurdle units; every remaining behavioral effect needs explicit acceptance. |
| Bounds and quantization | D3 OPEN. Stage 1 preserves unbounded binary64 measurements; 1%-15% and two-decimal half-even are candidate comparisons only. |
| Scope | Stage 1 adds isolated calculation, offline verification/audit and read-only collection. No scoring integration or production writes. |

This revision supersedes Sol's external Draft V1. The founder's October 12 Stage 1 brief accepts D1, D2 and D4-D8; D3 remains open. The accepted measurement method is not yet a production scoring contract.

## Baseline and authorization

VERIFIED: fetched main and source baseline are c05a5bf7697d12869f51f6bd7f4914f287e0f01f. The dedicated branch is codex/baggerbomb-threshold-stage1. Existing application source, calibrated tables, indicator mapper, flags and database mutation paths remain unchanged.

The isolated helper, auditor, independent reference, fixture verification, read-only collector and this revision are authorized. Future contacts with the scoring engine or battle document shape require a later explicit build authorization. Those concepts and the named files are fenced by docs/BUILD_RULES.md:10-24. Reading and calling their pure functions for verification is permitted.

## Accepted direction and remaining decisions

D1 selects a simple average of fourteen daily dollar true ranges divided by the last completed normalized close. Percentile conversion, 14/5 blending, Wilder smoothing and extra multipliers are excluded.

D2 selects complete-window fully adjusted OHLC: each row's positive finite adjusted_close/raw_close factor is applied to all four prices. Raw rows and factors are retained. Real archived split/dividend verification is required before measurement qualification; it is included in Stage 1.

D4 freezes the intended scoring percentage at each admitted position's entry. Initial and swap targets use their validated fills. Re-entry creates a fresh position identity and reward history. D5 makes unavailable/stale measurements ineligible for new admissions and preserves an admitted position's valid frozen receipt.

D6 prepares separation from calibrated risk/hurdle divisors and matching histories. This does not imply unchanged decisions: corrected rewards, proximity, locks, wake conditions, prompt inputs and result comparisons can change.

D7 limits the intended first integration to new fullday agent-versus-CPU stock positions and their held-position displays. D8 preserves existing games and results. League, tournament agents, player V4, crypto, hurdle recalibration and historical rescoring require separate qualification.

D3 includes final gameplay bounds, scoring quantization and zero-volatility eligibility. No agent floor/cap is adopted. Stage 1's candidate 1%-15% clamp and half-even two-decimal comparison are explicitly provisional. Final target currency formatting is also proposed, not an adopted gameplay boundary.

## Stage 1 measurement contract

The supported complete measurement entry point is measureStock in api/_utils/measuredStockThreshold.js. normalizeRawSnapshot and calculateMeasuredATR are isolated normalization/arithmetic primitives; calling them alone does not establish session eligibility, publication finality or production admission.

For the fifteen selected oldest-first bars:

~~~text
TR[i] = max(H[i] - L[i], abs(H[i] - C[i-1]), abs(L[i] - C[i-1]))
ATR14 dollars = sum(last fourteen TR values) / 14
measuredPct = 100 * ATR14 dollars / last normalized close
~~~

Measurements retain full JavaScript binary64 precision. There is no intermediate decimal rounding. ATR dollars are on the fully adjusted price scale. A valid zero-range window returns measuredPct = 0, zeroVolatility = true and scoringPct = null. Its eventual scoring eligibility remains a D3 decision.

The method identity is stock_atr14_sma_fully_adjusted_candidate_v1. Its policy/hash records fourteen observations, fully adjusted basis, raw OHLC tolerance zero, binary64 precision, explicit export attestation, calendar version, unresolved bounds and unresolved scoring quantization. A future policy change gets a new identity; this candidate identity must not be stamped as an approved production model.

The result includes status/reason, source and expected session, provider symbol, source as-of, snapshot identity/capture time, basis, usable/dropped/excluded counts, ordered raw/normalized bars, adjustment factors, inputHash, policyHash, ATR14 dollars and measuredPct. scoringPct stays null.

### Session eligibility and finalization

expectedSessionAt independently computes the most recent exchange session whose scheduled close has occurred at the caller's explicit asOf. It never reads the last provider row. The supplied expectedSourceSession must match that result. Fifteen consecutive exchange sessions ending there must all be present; duplicates, gaps and non-exchange dates inside the selected window are rejected.

The default calendar is the unmodified, Node-clean src/utils/marketCalendar.js at c05a5bf, maintained for 2026-2027. Its canonical UTF-8 SHA-256 with LF line endings is f03b061c7241fdc8b004c7fd616811457b488f29feb8bf618fa476c7b3ff14de. It uses America/New_York, normal 16:00 and declared early 13:00 closes with Intl DST resolution. Dates outside the maintained horizon return calendar_missing; there is no weekday guess. VERIFIED sources: src/utils/marketCalendar.js:69, :117, :151.

After a scheduled close, a dated provider row alone does not prove final publication. Stage 1's qualifying exported attestation must identify the source session, declare final = true, name its evidence source, and provide observedAt after the scheduled close and no later than snapshot capture. Captures later than the audit asOf are invalid.

The read-only collector has no provider final marker and therefore emits provider_response_observation with final = null. A complete window may still produce independently verified arithmetic while the full result is unavailable/finalization_unproven. These provisional arithmetic rows are labeled separately and cannot be admitted or certified.

EODHD documents US updates within fifteen minutes after close. That publication statement is evidence to qualify a later rule, not an immutable-finality flag. Stage 1 does not invent a grace interval or automatically convert elapsed time into final = true. Remaining evidence: qualify the exact publication/finalization signal, revision behavior and permitted attestation authority before dormant integration. [EODHD update timing](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes).

### Raw inputs, basis and precision

Require a single snapshot identity, provider symbol, explicit capture instant and raw_ohlc_adjusted_close basis. Reject fragments, contradictory per-row snapshot identity, duplicate/malformed dates, null/non-finite/non-positive prices, incomplete numeric strings and incoherent OHLC.

A numeric string must match a complete decimal/scientific representation; whitespace, booleans and parseFloat-style trailing text are rejected. Sort valid rows explicitly by date. Forming/future rows are excluded before price normalization, after date/duplicate/fragment checks. Invalid historical rows invalidate the supplied historical snapshot; they are not silently repaired.

Apply each row's adjusted_close/raw_close factor consistently to open, high, low and close. No raw-close fallback is used when adjusted_close is unavailable. Do not concatenate differently revised historical fragments. Re-fetch whole snapshots. Retain raw values/factors and an ordered input hash covering provider symbol, basis and ordered raw values/factors. Snapshot capture identity is retained separately; re-fetching identical inputs does not change their input hash.

Raw OHLC precision tolerance is exactly zero in Stage 1. Prices must satisfy low <= open/close <= high. This is a conservative verification rule, not a claim that provider rounding errors never occur. Any relaxation needs provider decimal/tick evidence and explicit examples; there is no invented cent or percentage allowance. Applying the identical factor to equal raw endpoints avoids introducing a false range failure through mismatched normalization arithmetic.

Provider documentation distinguishes raw OHLC from split/dividend-adjusted close and describes later history rescaling. [EODHD price bases](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes).

### Independent reference and candidate rounding

scripts/threshold-audit-reference.js uses separate exact decimal-rational adjustment and true-range arithmetic. It has no import of the calculator or scoring code. Agreement tolerance is absolute 1e-10 plus relative 1e-12 times the larger compared magnitude, separately for dollars and percentage. This accommodates binary64 numerical error; it is not gameplay rounding or an OHLC tolerance.

Candidate decimal quantization rounds the shortest decimal representation of a Number using exact integer arithmetic, with ties to even. Examples: 1.005 -> 1.00, 1.015 -> 1.02, 2.675 -> 2.68, 2.685 -> 2.68. Candidate clamping precedes candidate quantization. The unbounded measurement remains unchanged. Neither the two-decimal rule nor the clamp is approved for scoring.

For later dollar targets, the proposed display rule is nearest cent with decimal half-even, while the crossing decision uses the approved underlying percentage and unrounded target. Rounded display must never define a second crossing boundary. This rule needs D3 approval and rendered boundary qualification.

## Consumer inventory for the later integration

Every row has one disposition:

M: Reads the measured scoring contract.
R: Retains existing calibrated units/divisor and matching history.
C: Changes because corrected scoring/proximity changes its input; requires explicit behavioral acceptance.
O: Remains outside the first integration.

All references below were re-read at the pinned baseline. These are proposed dispositions, not implemented adapters.

| Consumer and current source | Intended units and input | Disposition |
| --- | --- | --- |
| Agent reward detection, api/_utils/agentScoring.js:224-300; api/cron/agent-evaluate.js:1191-1202 | Return from this position's fill / approved frozen scoring percentage; canonical reward constants retained. | M |
| Badge peak/trough retention, api/_utils/agentScoring.js:273-300; api/cron/agent-evaluate.js:1304-1308 | Measured reward multiples with matching position/side/lifetime and post-entry observations. | M |
| CPU reward scoring, api/cron/agent-evaluate.js:1208-1253; api/_utils/cpuOpponentGenerator.js:8-15 | Same measured receipt and source rule as agent stocks, separate side identity. | M |
| Tactical row and six target prices, src/screens/AgentBattleScreen.jsx:195-309; src/screens/battleView/selectWhyState.js:419 | Approved scoring percentage and validated position fill; no mutable symbol override. | M |
| Research modal, src/utils/researchAssetBuilder.js:79-119; src/components/draft/ResearchTabs/BaggerBombTab.jsx:31-74, :157-175 | Same receipt anchor, frozen percentage and retained earned-tier evidence. | M |
| Reward progress/red-zone helpers, api/_utils/agentScoring.js:108-158; canonical baggerBombUtils.js | Corrected reward multiples and corrected earned badges. | M |
| Reward distance in prompts, api/_utils/agentEvalPromptAssembly.js:1424-1431 | Distance to next genuinely unearned corrected tier, in percentage points. | M |
| Generic reward swap-lock helper, api/_utils/agentScoring.js:172-210 | Corrected reward multiple and percentage; distance-to-reward in percentage points. | M |
| Risk manager LOCK clause, api/_utils/agentRiskManager.js:149-160; evaluator lockedPositions at :1812 | Measured reward proximity must match displayed rewards. LOCK outcomes and downstream permission change. | C |
| Emergency exits, api/_utils/agentRiskManager.js:115-135; evaluator :1797-1803 | Legacy calibrated return/divisor; do not pass adapted scorer.baseATR. | R |
| Stepped trail, api/_utils/agentRiskManager.js:164-170 | Legacy calibrated return/divisor and existing SMA/preset thresholds. | R |
| Trailing-drawdown guardrail, api/_utils/agentGuardrails.js:712-726 | Legacy calibrated divisor and matching legacy peak/reference; never a measured peak times a legacy divisor. | R |
| Hard stop/profit arithmetic, api/_utils/agentGuardrails.js:250-275, :636-660 | Existing entry P&L percentage and directive thresholds; no ATR-unit substitution. | R |
| Guardrail LOCK deferral, api/_utils/agentGuardrails.js:451-474 | Measured reward locks alter which guardrail actions defer. | C |
| Hurdle fresh/frozen divisors, api/_utils/hurdleAtr.js:26-55; evaluator :1895-1896 and :3535-3548 | Existing fresh rank-based unit or existing frozen calibrated fallback. No substitution from measured scorer output. | R |
| Activation/prior-close validation, api/_utils/baselineValidation.js:40-48, :82, :179 | Existing calibrated ATR units for quote-error tolerance; measurement eligibility is a separate check. | R |
| Bench performance wake, api/_utils/agentTriggerGate.js:109-131 | Existing bench daily return / legacy bench unit, existing weak-active test. | R |
| Held price-drop/proximity wake, api/_utils/agentTriggerGate.js:61-103 | Corrected score.multiplier and corrected badges change wake timing/frequency. | C |
| Held score tables/next reward narrative, api/_utils/agentEvalPromptAssembly.js:1124-1136, :1470-1482 | Corrected totals/bonuses and measured multiples change model-visible facts. | C |
| Bench trading-unit/prompt values, api/_utils/agentEvalPromptAssembly.js:1502; api/agent/decide.js:523 | Retained calibrated units with honest labeling; do not call a proxy measured ATR. | R |
| Swap banking and aggregate/result scores, api/_utils/agentSwapExecution.js:338-385; api/cron/agent-evaluate.js:1264-1296, :6591-6599 | Corrected rewards alter locked points, aggregate/peak scores, win/loss and downstream result inputs. | C |
| Existing capture entryATR/outgoingBaseATR/history, api/_utils/learning/captureReceipt.js:166-181; evaluator :2190-2231, :3801-3851 and other swap routes | Preserve recorded legacy meanings. Add distinct receipt/unit fields rather than silently renaming their values. | R |
| New scoring capture fields | Position receipt/hash, source session, effective scoring percentage, fill quote time, lifetime and matching measured peak. | M |
| League, prescribed tournament agents, player V4, crypto and hurdle recalibration | Their own rules, direction/banking and provenance contracts. | O |
| Existing games and absent model version | Retain legacy interpretation and results. No automatic historical repair. | O |

The two swap-lock rows are intentionally distinct: the pure reward helper reads the measured contract, while the executable LOCK branch changes trade permissions and needs acceptance. Its higher priority than stepped trail/stagnation and its guardrail deferral effects must be reviewed. Passing one calibrated divisor to the entire existing evaluateRisk function cannot both preserve emergency/trail thresholds and correct LOCK proximity.

## Proposed preservation strategy and demonstrated limits

The later adapter must keep an explicit calibrated risk unit and its legacy peak history, and a separate immutable scoring receipt/history keyed by position identity. Do not reuse the scorer's returned baseATR as a risk or frozen-hurdle input. Preserve the existing priority order; supply the measured reward context only to the approved reward-lock branch.

Stage 1 verification calls unchanged pure production functions. At -2% entry return, calibrated unit 7.52 returns HOLD; substituting measured unit 2 returns EMERGENCY_SWAP. Keeping 7.52 preserves that action even when the separately computed reward score changes from -20 to -30. At +7.9%, retaining 7.52 preserves HOLD while direct measured substitution triggers a stepped trail. Matching legacy divisor/history also reproduces the actual trailing-guardrail function; replacing only its history does not.

A reward-proximity example changes HOLD to LOCK when the divisor moves from 4 to 2. A corrected negative reward multiple adds the price_drop wake where the legacy score did not. These are demonstrated effects requiring acceptance, not regressions that can be hidden by claiming unchanged trading.

Unresolved effects for the later review: LOCK priority/deferral, wake cadence, prompt-driven decisions, banked and aggregate rewards, peak-score/proposal/capture values, result comparisons and downstream awards/learning inputs. Exact unchanged risk operands are demonstrated; a full integrated policy-preservation result remains unqualified until the authorized adapters and representative replays exist.

## Position identity and compatibility maps

The authoritative key is battle ID plus side plus positionId. positionId identifies a slot lifetime and changes on every entry/re-entry. Receipt/history joins also verify symbol, entryAt and current slot version.

When both agent and CPU hold the same ticker, they retain separate fills, percentage freezes and histories. Their measured source policy is the same; their position receipts can differ by entry time or approved source session. One symbol-keyed scoring.thresholds entry cannot represent both positions.

For the new model, readers never use a symbol projection over a valid position receipt. A missing/ambiguous receipt means unavailable, not map/default fallback. A projection may remain for legacy readers but carries a side/position binding or an explicit ambiguous/not-applicable state. If multiple current receipts disagree, omit the scalar projection rather than choosing one side.

On re-entry, create a fresh position ID/receipt/history. Prior peaks remain attached to the closed lifetime. Evaluator writes compare current side/slot/position identity transactionally; stale writers cannot credit a new lifetime or resurrect an exited one. This proposed shape is a future fenced battle-document contact, not Stage 1 code.

## Later targets, displays and capture

Keep measured ATR, approved bounded gameplay percentage and displayed rounded targets as separate fields. Only the approved gameplay percentage divides reward progress.

For a long position with fill A and approved percentage p, positive tiers are A times (1 + p/100), A times (1 + 1.5p/100), A times (1 + 2p/100); negative tiers use subtraction. Preserve +15/+30/+50 and -10/-20/-35 rewards and existing conviction weights. No fixed-dollar ATR distance is adopted.

Rows, reward proximity, locks and research use the same position receipt. Reward observations must fall after entry and within that lifetime; rebasing a whole-session high reached before a swap is insufficient. Valid recorded peaks retain rewards after retracement.

Historical sourceSession and snapshotCapturedAt describe measurement inputs. entryQuoteAsOf and entryAt describe the committed fill. A later refetch does not establish the fill. Legacy capture fields preserve calibrated meanings; measured receipt/history fields are additive and explicit.

## Export schema and audit classifications

scripts/collect-threshold-export.js reads indexIntelligence/stockRankings and selected fields from active agentBattles, plus EODHD eod/splits/div GETs. It writes only a local JSON export. It validates the service-account project against the explicit project argument and configured project; credentials and authenticated URLs are never serialized.

The required local schema is:

~~~json
{
  "schemaVersion": 1,
  "exportedAt": "ISO instant with timezone",
  "environment": "authorized project identifier",
  "deployedCommit": null,
  "universeId": "identity of the exported ranked source",
  "expectedSession": "YYYY-MM-DD independently resolved at exportedAt",
  "universe": [
    {
      "symbol": "UNP",
      "providerSymbol": "UNP.US",
      "eligible": true,
      "snapshot": {
        "id": "one whole snapshot identity",
        "capturedAt": "ISO instant",
        "providerSymbol": "UNP.US",
        "basis": "raw_ohlc_adjusted_close",
        "rows": [{ "date": "YYYY-MM-DD", "open": 1, "high": 1, "low": 1, "close": 1, "adjusted_close": 1 }]
      },
      "finalization": { "type": "export_attestation", "session": "YYYY-MM-DD", "final": true, "observedAt": "ISO instant", "source": "qualification evidence" },
      "corporateActionEvidence": { "splits": {}, "dividends": {} },
      "stored": [{ "mode": "agent_battle", "side": "agent", "positionId": null, "kind": "legacy_frozen_threshold", "valuePct": 1 }]
    }
  ]
}
~~~

The example row is schema illustration, not fifteen bars or valid market evidence. Excluded entries require eligible = false and exclusionReason. Missing snapshots, receipts or values remain unavailable. Imported measurement receipts require matching policyHash, inputHash, sourceSession, atr14Dollars and valuePct.

Universe identity comes from exported ranked membership, with configured but unranked symbols included as explicit exclusions. No current count is hardcoded. The collector's eligibility label means ranked membership, not proven production admission eligibility. Include deployed SHA only when verified; the collector currently records null. Other modes need separately supplied exports.

The auditor processes UNP/HUM/ACN first, then all entries. Counts are mutually exclusive: total = passed + failed + unavailable + excluded; eligible = passed + failed + unavailable. Passed requires valid attested measurement, independent reference agreement and a matching exported measured receipt. Failed means invalid inputs or a numerical/receipt mismatch. Unavailable includes gaps, unproven publication, absent receipts and incomparable legacy/other-method data.

Legacy-percentile reproduction is labeled legacy_reproduction_only and never passes measured certification. Other-mode and legacy fixed thresholds show absolute/relative differences as method comparisons, not automatic defects. Relative difference from a zero measurement is unavailable unless both values are zero.

Distribution statistics cover independently matched complete arithmetic windows, including explicitly unqualified publication rows. Explicit provider-identity/corporate-action continuity issues exclude a row from bounds comparison while preserving its arithmetic, universe membership and unavailable classification. Report arithmetic-valid, bounds-usable, attested-valid and passed denominators separately. List every floor/cap-affected symbol with its raw percentage and qualification.

## Current evidence and D3 recommendation

VERIFIED: the October 12 read-only source export contains 239 configured/ranked-union entries, of which 236 are ranked members and HES/IPG/WBA are excluded. After retrying seven unavailable provider captures as whole snapshots, 229 complete windows agree with the independent reference. AVB, CTRA, EA, EQR, K, MMC and WBD lack the required expected-session window.

For source session 2026-10-12, the unbounded readings are UNP 1.3613716964571096%, HUM 4.529210743120777% and ACN 4.623061120012764%. These are snapshot arithmetic, not approved scoring thresholds. Exported held-agent values include 0.16%, 7.52% and 7.52%, respectively; the method/session comparison does not authorize rescoring.

The PARA provider series calculates 25.307362229400702%, but EODHD General reports Banzai International, Inc. while the repo catalogs PARA in Communication Services/Media (api/_utils/rankingConfig.js:80, :347). Security continuity remains unresolved. The row is preserved and explicitly excluded from bounds comparison; this observation does not establish a replacement ticker or authorize a catalog change.

Across the remaining 228 arithmetic-valid series usable for provisional bounds comparison: minimum 0.9581309339810106%, median approximately 2.3356%, nearest-rank p95 4.623061120012764%, maximum 7.825987494280925% (BE). Median averages the two central readings for an even count; the audit JSON retains its full precision. A candidate 1% floor changes BRK-B only; a candidate 15% cap changes none. The excluded PARA series would hit the cap, but is not qualified bounds evidence. Other identities/publication remain uncertified.

Recommendation: keep D3 open and retain unbounded results. In the usable comparison set the floor affects one series and the cap none; seven ranked inputs, publication/finality and PARA identity remain unresolved. Use this distribution to compare candidate policies after those qualifications; do not select the player endpoint's bounds by inheritance. EODHD reports IsDelisted = true for all seven missing-window symbols; verify current identity/aliases and expected catalog membership separately rather than manufacturing fresh bars.

All 236 ranked entries remain unavailable for full certification because provider finality is unproven and measured production receipts are absent. There are zero passed and zero arithmetic-invalid/mismatched rows. This is not a failure of the 229 reproduced calculations, and it is not repaired-production-scoring certification.

## Reproducible commands

Run with the tested Node 24.19.0 runtime. No package or application integration is required for the isolated checks/auditor.

~~~powershell
node --test scripts/threshold-audit.verify.mjs
node scripts/threshold-audit.js --input snapshot.json --out C:/path/to/external-audit
node --use-system-ca --use-env-proxy scripts/collect-threshold-export.js --project tradeseven --env-file C:/path/to/authorized/.env.local --dependencies C:/path/to/node_modules --out C:/path/to/external/snapshot.json
~~~

The certificate/proxy flags were required in this desktop environment and preserve TLS verification. In another authorized environment, use its normal certificate configuration. Credentials stay in the authorized environment.

The collection file supports an explicit --symbols UNP,HUM,ACN subset and labels all other exported members excluded from that subset. Do not present a subset run as a full audit. Whole-snapshot retries must preserve exported universe/session identity, retain original stored-value read provenance and record replacement hashes/times; never merge adjusted bar fragments.

## Future integration seams and next review

The later build must explicitly authorize decide.js enrichment/deployment, agentBattleService.js document shape, agentSwapExecution.js atomic receipts/banking, agent-evaluate.js scoring/history writes and risk/hurdle adapters, agentRiskManager.js reward-LOCK split, agentGuardrails.js matching history/LOCK behavior, and agentEvalPromptAssembly.js truthful unit/context rendering. Canonical scorer math/constants should remain reusable and unchanged where an input adapter suffices. Client row/research/cache changes also touch the scoring concept and require the approved mode/version contract.

Next review must settle D3, provider finalization, any justified precision tolerance, missing/provider identity mappings and the explicitly changing lock/score-driven decisions. Then it may authorize a scoped dormant integration. Stage 1 ends at handover.
