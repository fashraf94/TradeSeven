# BaggerBomb Thresholds Stage 1 Handover

October 12, 2026

| Deliverable | Result |
| --- | --- |
| Specification V1.1 | Complete. Accepted D1/D2/D4-D8 recorded; D3 open; future consumer dispositions and fence contacts explicit. |
| Isolated measured calculator and normalization | Complete. No runtime integration; all measurements remain separate from approved scoring percentages. |
| Independent numerical reference and auditor | Complete. Decimal-rational reference, per-symbol JSON/CSV/Markdown and reconciled classifications. |
| Current read-only export | Collected from tradeseven plus EODHD, with source session 2026-10-12. Production state unchanged. |
| Numerical verification | 229 complete provider windows agree with the independent implementation. Seven ranked symbols lack their required window. |
| Bounds recommendation | Keep D3 open. Of 228 series usable for provisional comparison, the candidate 1% floor changes BRK-B; a 15% cap changes none. |
| Certification | Blocked on publication/finality, unresolved identity/history and measured persisted receipts. No corrected production scoring or live game is certified. |

## Repository state and scope

VERIFIED: git fetch origin succeeded before remote comparison. Starting HEAD and fetched main were c05a5bf7697d12869f51f6bd7f4914f287e0f01f; the starting checkout was clean and detached. A dedicated codex/baggerbomb-threshold-stage1 branch was created from that baseline.

Only these eight new files are delivered:

- api/_utils/measuredStockThreshold.js
- scripts/threshold-audit.js
- scripts/threshold-audit-reference.js
- scripts/collect-threshold-export.js
- scripts/threshold-audit.verify.mjs
- scripts/threshold-audit-fixtures.json
- docs/specs/BAGGERBOMB_THRESHOLD_CORRECTION_SPEC_V1_1_20261012.md
- docs/audits/BAGGERBOMB_THRESHOLD_STAGE1_HANDOVER_20261012.md

Existing application code, calibrated tables, indicator mapper, feature flags, writers, scoring histories and live data were not modified. The new API helper has no production importer. The only source-calendar dependency is the existing Node-clean marketCalendar.js. An ignored node_modules junction reuses the primary checkout's installed dependencies; no packages were installed.

This task's founder brief explicitly authorizes Stage 1 writes following the already reviewed discovery. It does not authorize any proposed fenced runtime integration. The later contacts are in V1.1.

## What the tooling establishes

VERIFIED: measuredStockThreshold.js:34 resolves expected sessions independently of provider data; :48 normalizes one full raw snapshot; :73 calculates fourteen dollar true ranges; :83 validates consecutive-session completeness and produces an auditable measurement result. There is no percentile conversion or numerical default. A valid zero remains zero; scoringPct remains null.

The ordered input hash covers source symbol, basis and ordered raw values/factors, independently of capture ID. A full historical revision changes the hash; an identical refetch does not. Publication attestation, capture identity and session identity remain separate.

VERIFIED: threshold-audit-reference.js:27 implements adjustment and ATR independently using decimal-rational arithmetic and no production imports. threshold-audit.js:28 reconciles the exported universe, compares reference/receipt values, keeps legacy reproduction separate and produces candidate bounds/rounding outputs. :70 writes local JSON, CSV and Markdown.

VERIFIED: collect-threshold-export.js:15 projects stock data by side and legacy position context; :27 sends only provider GETs; :51 performs only Firestore reads and writes a local file. URLs containing credentials and credential values are never exported. Database mutation calls are absent.

An export attestation can qualify a measurement input, but a provider dated row does not prove finality. The collector emits final = null. The auditor preserves complete-window arithmetic as provisional while marking full measurement certification unavailable. Matching arithmetic alone is not a passed persisted-measurement comparison.

## Current export and per-stock results

The source export began at 2026-10-12T21:54:55.701Z. Rankings read time was 21:54:56.068Z; update time was 20:01:17.590Z. Seven initially unavailable EOD captures were retried as complete snapshots. Final provider collection time is 21:59:45.885Z, approximately 4:59 PM America/Chicago. The assembled export includes later identity qualification evidence and records exportedAt 22:07:59.787Z; each raw snapshot retains its actual capture time.

The universe identity is 9366ee1be95bf2a3f8415404163e923fc6a7eee018d0e400aa1002dc0b398f95. The retry verified unchanged universe/session identity and retained original stored-value read provenance. No adjusted bar fragments were merged. The export contains 239 union entries, with 236 ranked members and three configured exclusions: HES, IPG and WBA. This count was observed, not hardcoded.

Counts reconcile exactly:

| Total | Ranked eligible for this export | Passed | Failed | Unavailable | Excluded |
| --- | --- | --- | --- | --- | --- |
| 239 | 236 | 0 | 0 | 236 | 3 |

Passed requires valid attested measurement, independent agreement and a matching exported measured receipt. Current finality is unproven and measured production receipts do not exist in the collected legacy contexts. Thus all ranked rows remain unavailable for full certification, even though 229 windows reproduce numerically. Zero failed means no invalid arithmetic/input or numerical-reference mismatches in the supplied complete windows; it is not blanket stock accuracy.

The three priority rows, at source session 2026-10-12:

| Symbol | ATR14 unbounded percentage | Exported held-agent percentage | Absolute difference in percentage points | Relative difference from measurement |
| --- | --- | --- | --- | --- |
| UNP | 1.3613716964571096 | 0.16 | 1.2013716964571097 | 88.24714804807603% |
| HUM | 4.529210743120777 | 7.52 | 2.9907892568792223 | 66.03334281633512% |
| ACN | 4.623061120012764 | 7.52 | 2.8969388799872355 | 62.662785647515676% |

These compare current measured arithmetic with legacy frozen values. They do not establish a new approved scoring percentage or authorize reinterpretation of previously earned rewards. The source deployment SHA is unverified; the export records null. Two active agent documents were read. CPU/other-mode measured receipt qualification was not established by this dataset.

Seven ranked symbols lack the required window: AVB, CTRA, EA, EQR, K, MMC and WBD. The first six miss all fifteen expected sessions; WBD misses October 6, 7, 8, 9 and 12. EODHD General reports IsDelisted = true for all seven. This is provider evidence to investigate, not a unilateral change to eligibility or ticker mapping.

## Provider identity and bounds

The raw PARA series calculates 25.307362229400702%. A follow-up read of EODHD General at 22:07:58.659Z reports Name = Banzai International, Inc.; the repo assigns PARA to Communication Services/Media at rankingConfig.js:80 and :347. Security continuity is unresolved. PARA remains visible in the per-symbol arithmetic and universe counts but is explicitly excluded from calibration/bounds statistics.

Of the 229 reference-matched provider windows, 228 have no explicit identity-continuity exclusion. Their unbounded range is 0.9581309339810106%-7.825987494280925%; median approximately 2.3356%; nearest-rank p95 4.623061120012764%. BE is the maximum. Other identities and publication remain uncertified.

The candidate 1% floor changes BRK-B from 0.9581309339810106% to 1%. The candidate 15% cap changes none of the 228 usable series. The unresolved PARA series would be capped, but should not drive policy selection. Per-symbol raw, bounded and candidate half-even outputs remain in the audit files.

Recommendation: retain the unbounded method and keep D3 open. Complete provider identity/publication qualification and resolve missing ranked rows before selecting final bounds or scoring precision. The player endpoint's floor/cap is not an approved agent rule.

## Historical real fixtures and controls

VERIFIED: the archived AAPL source file hash is b84fcf7c2b73ee915a6ac79196f683f571b5de0baf4aa3dee57284281e1546df. fixtures/README.md:3-15 records untouched EODHD capture provenance and July 10 capture date. The independently enumerated fifteen-session windows are in threshold-audit-fixtures.json.

The historical NYSE holiday/early-close table confirms no exception within either selected window. Apple confirms split-adjusted trading began August 31, 2020 and the August 2020 dividend declaration. [NYSE historical calendar](https://ir.theice.com/press/news-details/2019/NYSE-Group-Announces-2020-2021-and-2022-Holiday-and-Early-Closings-Calendar/default.aspx), [Apple corporate action announcement](https://www.apple.com/newsroom/2020/07/apple-reports-third-quarter-results/).

| Archived case | Last session | ATR14 adjusted dollars | Unbounded percentage |
| --- | --- | --- | --- |
| Four-for-one split window | 2020-09-04 | 5.185889544274764 | 4.4199931340129925% |
| Dividend adjustment window | 2020-08-14 | 3.4522902714313184 | 3.097413420964566% |

Both match independent rational arithmetic. Fixture capture time is known only to the date; these qualify archived normalization/arithmetic, not original decision-time publication or current-market thresholds. The source bytes are retained, not rewritten.

## Verification performed

VERIFIED: 20 new Node verification tests passed, including required numerical independence, measured-vs-percentile controls, fifteen/fourteen bars, zero range, synthetic and real corporate actions, revised snapshots, mixed-basis 102% negative control versus corrected 2%, sorting, duplicates, gaps, malformed numbers, forming sessions, normal/early closes, weekend/holiday/DST, candidate half-even cases, fragments, dynamic counts, identity exclusions and read-only collection.

VERIFIED: 72 existing focused Vitest regressions passed: agentScoring.consistency (26), baselineValidation (39) and marketSchedule.sessions (7). ESLint on new JavaScript/MJS passed. The tested runtime is Node 24.19.0 on Windows.

The new tests call unchanged fenced pure scorer/risk functions and exactly extracted trailing-guardrail helpers. They demonstrate preserved operands for emergency/stepped-trail/hurdle/legacy peak reconstruction and explicitly changing reward LOCK/wake/score inputs. No full integrated trading-preservation result is claimed.

Initial collection encountered gRPC error 14 and REST certificate trust failure. The authorized retry with Node's system certificate store and configured proxy succeeded. TLS verification stayed enabled. Vite's temporary-cache permissions also needed authorized execution for the focused regressions. These were environmental access issues, not calculation failures.

No full application build was required: existing application imports and runtime routes did not change. Hosted CI, deployment and runtime activation were not verified or driven.

## Reproduce and collect

~~~powershell
node --test scripts/threshold-audit.verify.mjs
node scripts/threshold-audit.js --input exported-snapshot.json --out C:/path/to/external-audit
node --use-system-ca --use-env-proxy scripts/collect-threshold-export.js --project tradeseven --env-file C:/path/to/authorized/.env.local --dependencies C:/path/to/node_modules --out C:/path/to/external/snapshot.json
~~~

The V1.1 export-schema section specifies all required fields, receipt comparison shape and exclusion rules. The collector supports --symbols for explicit subsets; those outputs label their scope. It checks configured and service-account project identity before reading. Secrets must remain in the authorized environment.

The complete numerical audit and raw export are external task artifacts. Raw live/provider data and credential files are not committed to the repository.

## Remaining blockers and concrete next actions

| Blocker | Missing evidence or decision | Next action |
| --- | --- | --- |
| Provider finalization | Explicit qualifying publication/finality signal or authorized documented attestation; no final flag in current EOD responses. | Qualify the provider update/revision rule and attestation authority; enrich exported finalization evidence and rerun the auditor. |
| Seven stale/missing ranked symbols | Fifteen expected complete sessions and verified current symbol/security identity. | Check corporate status/alias mapping using read-only provider/exchange evidence; reconcile catalog membership in a separately authorized task. |
| PARA continuity | Provider security identifiers/name continuity versus the catalog's intended instrument. | Resolve identity and corporate history; do not select a gameplay cap from this series meanwhile. |
| D3 | Approved floor/cap, scoring quantization and zero-volatility eligibility. | Review the qualified distribution and candidate effects, then record the founder ruling. |
| OHLC tolerance | Evidence supporting any nonzero provider precision allowance. | Retain strict zero tolerance until concrete provider examples justify an approved rule. |
| Persisted measurement comparisons | Approved versioned receipts and complete CPU/other-mode context where relevant. | Supply their exports after the appropriate dormant integration is authorized; missing values remain unavailable. |
| Deployed SHA | Verified production deployment identity. | Obtain a read-only deployment receipt; never substitute the fetched source SHA. |
| Trading effects | Approved LOCK split/priority/deferral and corrected score-driven wake/prompt/banking/result effects. | Review V1.1's consumer inventory and replay evidence before authorizing the exact fenced adapters. |

The first later build must name the deploy/enrichment, battle-shape, swap, evaluator/history, risk LOCK, guardrail and prompt seams listed in V1.1. Stage 1 does not proceed into that integration, activation, merge or historical repair.

The final delivery commit and push state are recorded in the chat handover and external delivery copy, avoiding a self-referential commit SHA in this tracked document.
