# BaggerBomb Stage 1 measurement closeout

October 12, 2026, America/Chicago. **Tooling and evidence delivered; publication approval and D3 remain OPEN. No scoring integration or production activation.**

| Question | Verdict |
| --- | --- |
| Are the reported current calculations reproducible? | VERIFIED: all 229 complete October 12 windows match the independent reference |
| Which measurements satisfy the explicit proposed publication rule? | 228; PARA unresolved, seven missing windows, three configured exclusions |
| Are those approved scoring percentages? | No. Proposed-rule qualification is conditional; owner approval and final policy/model hash remain pending |
| Do missing future receipts invalidate measurement qualification? | No. All 236 persisted corrected-receipt comparisons are unavailable separately |
| D3 bounds evidence | A 1% floor changes BRK-B only; 15% cap changes none of the 228 qualified rows |
| Security exceptions | Primary issuer evidence explains the seven discontinued symbols and PARA reuse; dispositions proposed below |
| Live state | No database writes, catalog changes, runtime imports, scoring integration, activation or historical rescoring |

## Baseline and delivery boundary

**VERIFIED:** `git fetch origin main` preceded remote comparisons. Main is `433a19a4ef2fdc804c002f755ca2ef3686e18a18`, the merge of PR 955. GitHub read metadata confirms PR 955 merged with tooling head `6712ec8a219b60b276773236161e527dc2b921e5`; those tooling files match current main. The preceding branch was clean. This task uses dedicated branch `codex/baggerbomb-measurement-closeout` from that main, not a stacked unmerged dependency.

The founder's closeout brief explicitly authorizes isolated auditor classifications, read-only collection, tests and this proposal after Stage 1 review. It does not authorize calibration-fence edits. Existing application code and the measured calculator/reference are unchanged. The closeout supplement supersedes V1.1's old combined audit-bucket definition and publication qualification wording only; D1/D2/D4-D8 remain fixed, D3 remains open.

## Evidence package and provenance

The companion **baggerbomb-measurement-closeout-evidence.zip** contains the original `stage1-current-universe-export.final.json`, JSON/CSV/Markdown in `stage1-current-universe-audit.final`, original full/retry/priority exports, original provider-identity evidence, historical fixture and consumer-control results, plus the new identity capture, qualification sidecar, four repeated captures, schema-V2 audit, D3 package and handovers. `manifest.json` inventories byte lengths, SHA-256 hashes, semantic JSON hashes and source timestamps. The complete per-stock numerical data are present; this is not a reduced priority-stock sample.

**VERIFIED original export provenance:** rankings read `2026-10-12T21:54:56.068Z`; rankings update `20:01:17.590Z`; original provider collection started `21:54:55.701Z`; seven transient failures replaced with complete retry snapshots by `21:59:45.885Z`; original identity enrichment ended `22:07:59.787Z`. The final export's `exportedAt` is the enrichment time, not the Firestore comparison-read time. Original stored comparisons remain from the original read. Original full/retry export semantic hashes are retained in `collection.retry`; package manifest hashes are hashes of the actual delivered file bytes, a different concept.

Original final export SHA-256: `1b30de13f9203c30e03c20f5c54a28ea1cc04ac31165325893e2236ff301571f`. Original audit JSON SHA-256: `79fe4617313cd046e9b7343ca83e73d9d658791d019ece3e4f1b0844b626dda6`. Original CSV SHA-256: `74b116e4a3619043b88d27b53f53711bd55ecd956638a3362f0fcdcffb60f630`. Packaging verifies these before copying. No original capture or report was overwritten.

New provider General capture: `2026-10-12T23:59:36.300Z` through `23:59:43.382Z`; 241 responses (236 ranked identities plus five additional candidate identities; DVN already belongs to the ranked set). Six independent alias-window captures accompany them. These later identities are retrospective measurement qualification evidence, not original decision-time quote evidence. Four repeated full snapshots completed `2026-10-13T00:05:24.460Z` (still October 12 locally). Their input hashes and percentages match the original UNP/HUM/ACN/BRK-B windows; their observation/snapshot IDs differ. Neither observation asserts immutable history.

Provider response objects were parsed and serialized by the collector; preserved file bytes are the captured local artifacts, not an assertion of byte-identical HTTP payloads. `deployedCommit` remains null. No credentials or authenticated URLs are included. No CPU stored corrected receipt or other-mode numerical export was established by the original collection.

## Explicit publication acceptance proposal

**VERIFIED provider documentation:** EODHD describes raw OHLC and split/dividend-adjusted close, NYSE/NASDAQ publication within 15 minutes after market close, and whole-history adjusted-close recomputation after dividends. The documentation instructs complete-series refetching. The response does not supply an explicit final flag. [EODHD historical API](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes).

**PROPOSED rule:** `eodhd_us_completed_session_observation_v1_proposed`, implemented solely for offline classification in `scripts/threshold-publication-qualification.js:3`. Owner approval remains pending. Accept a completed-session measurement only when all of these hold:

1. Resolve the latest closed session independently using the pinned exchange calendar; require the full fifteen consecutive sessions and fully adjusted basis with strict zero OHLC tolerance.
2. Verify the requested stock identity against captured provider General code/type/country/current listing and known catalog conflicts. Limit this publication schedule to NYSE/NASDAQ common stocks. Primary security continuity is reviewed separately for known exceptions; routine provider identity qualification is not a claim of issuer-by-issuer legal certification.
3. Observe a successful complete EODHD `eod` response after the scheduled session close plus the documented 15-minute publication window. Bind its requested range/through-session, provider/symbol, capture time, source and ordered input hash. A dated last row, elapsed time, arbitrary `final=true`, or free-text attestation alone is insufficient.
4. Use an owner-approved server collector with a versioned rule/hash, immutable input receipt and recorded observation time as the future attestation authority. This closeout analyst and local sidecar do not supply production authority. The offline tool hardcodes approved measurements to zero and admission authorization to false.
5. Record every later complete capture with its own observation/snapshot receipt. Changed ordered raw inputs or factors create a new input hash and measurement revision. Re-fetch a whole window, never patch adjusted tails. Under accepted D4/D5, admitted positions retain their frozen receipt; later admissions use their current qualified receipt. This lifecycle behavior is proposed for later integration, not implemented here.

The 15-minute threshold comes from the provider's published schedule; it is not an invented grace interval or accuracy guarantee. The complete observed response, independent input checks and identity evidence are also required. On an absent/invalid row, retry or remain unavailable. After the latest closed session changes, the old receipt cannot authorize a new admission. No undocumented immutable-history promise or missing provider final flag blocks evaluation indefinitely. If approved, distinguish **accepted completed-session observation** from **immutable final history** in runtime labels.

**VERIFIED tolerance:** all 229 complete current windows pass strict coherent-OHLC checks; the real archived AAPL split/dividend controls also pass. There is no observed need for a nonzero tolerance. July archived data qualifies historical normalization only and is not used to certify current percentages. Calendar/fixture hashes and true-range policy remain pinned in `api/_utils/measuredStockThreshold.js:9` and `scripts/threshold-audit-fixtures.json:5`.

## Identity and window dispositions

All eight entries remain visible in the full original universe. **VERIFIED provider evidence:** the new General records confirm delisting flags for AVB, CTRA, EA, EQR, K, MMC and WBD, and Technology-sector Banzai for PARA. Alias snapshots are separate evidence; they do not supply missing original-symbol bars. Primary announcement dates take precedence over a provider administrative delisting date when describing corporate actions.

| Catalog symbol | Primary evidence and observed window | PROPOSED disposition |
| --- | --- | --- |
| AVB | [Issuer merger completion](https://investors.avalonbay.com/sec-filings/all-sec-filings/content/0001104659-26-097833/tm2623381d1_ex99-1.htm): August 17, 2026 combination with EQR; VMRK starts August 18. Original EOD ends August 14; provider records an August 17 ratio of 2.793 and administrative delisting August 24. | Retire AVB for new admissions. Consider VMRK as a separately reviewed successor catalog instrument; do not treat merger exchange ratio as an ordinary split or invent an AVB continuation. |
| EQR | Same issuer completion; combined issuer is Vivmark. Original EOD lacks all fifteen required September/October sessions; provider delisted August 17. VMRK capture has a complete October 12 window. | Retire EQR label; review VMRK once, with deduplication against AVB's successor. Corporate-action successor, not two interchangeable aliases. |
| CTRA | [Devon merger completion](https://www.devonenergy.com/news/2026/Devon-Energy-and-Coterra-Energy-Complete-Merger): May 7, 2026; combined company trades DVN. Provider CTRA delisted May 7 and has no required current bars. DVN is already in the exported universe. | Retire CTRA; do not map a duplicate CTRA scoring slot to existing DVN. Evaluate catalog membership separately. |
| EA | [EA completed acquisition](https://www.ea.com/amp/news/ea-announces-completion-of-acquisition): August 4, 2026; common stock ceased trading, cash consideration. Provider delisted August 4, no current window. | Retire EA for new stock admissions; no listed successor alias is established. |
| K | [Mars completed Kellanova acquisition](https://www.mars.com/en-dk/news-and-stories/press-releases-statements/mars-completes-acquisition-of-kellanova): December 11, 2025; provider K delisted that date and lacks a current window. | Retire K; do not substitute a different Kellogg security or privately held Mars. |
| MMC | [Issuer ticker change](https://www.marsh.com/en/corp/about/news/marsh-mclennan-to-change-nyse-symbol-to-mrsh.html): January 14, 2026 to MRSH; legal name/CUSIP unchanged. Provider MMC delisted January 13; MRSH General and all fifteen current bars captured. | Review a dated MMC-to-MRSH alias for the same security. This is the strongest same-security alias case, distinct from mergers. No mapping changed here. |
| WBD | [SEC completed acquisition](https://www.sec.gov/Archives/edgar/data/1437107/000119312526415055/d200872d8k.htm): October 6, 2026, WBD becomes SKYD subsidiary. [Issuer filing](https://ir.paramount.com/node/73401/html) describes PSKY-to-SKYD ticker/exchange change. WBD and PSKY EOD end October 5; SKYD has a complete October 12 capture. | Retire WBD; SKYD is a separate combined-company candidate. Review post-merger window continuity before catalog admission; do not splice WBD/PSKY bars. |
| PARA | [Paramount completed merger](https://ir.paramount.com/news-releases/news-release-details/skydance-media-and-paramount-global-complete-merger-creating): August 7, 2025 to PSKY. [Banzai issuer announcement](https://banzai.gcs-web.com/news-releases/news-release-details/banzai-international-inc-unveils-agentic-platform-strategy-plans): August 7, 2026 ticker reuse as PARA. Current provider code/name is Banzai/Parabolic. | Do not admit current PARA as the catalog Media security. Intended legacy Paramount identity is a strong source/history inference, not a newly discovered explicit founder ruling. Review successor SKYD as a separate candidate; PSKY is itself discontinued. |

**VERIFIED catalog chronology:** `api/_utils/rankingConfig.js:80` includes PARA in Communication Services; `:347` assigns Media. Git object `0f5f2f806f6cf99dced1b42ae090bfefe1163339` (March 3, 2026) already includes PARA there, and `e13a82ac4cfbd8c2db7ddc8f8c0f4be393898160` (May 15) already assigns Media. Both predate Banzai's August ticker adoption. **INFERENCE:** this is a stale legacy Paramount catalog identity, supported by primary ticker history; a naked ticker/code match is insufficient. The current PARA reading of 25.307362229400702% belongs to a different security and remains excluded from D3. Do not certify successor continuity merely because an alias endpoint serves backfilled history.

Missing required dates: AVB/CTRA/EA/EQR/K/MMC each lack all fifteen sessions from September 22 through October 12; WBD lacks October 6, 7, 8, 9 and 12. HES, IPG and WBA remain the three original configured-but-unranked exclusions; their broader catalog disposition was not investigated in this bounded task. No catalog or production mapping was changed.

## Separate auditor milestones

**VERIFIED implementation:** `scripts/threshold-audit.js:30` accepts an optional hash-bound qualification sidecar. The V2 report exposes separate `arithmetic`, `inputs`, `publication`, `persisted` and `measurementQualification` fields in JSON/CSV/Markdown. The calculator remains unchanged, including its `attested_only_provider_rule_unqualified` label (`api/_utils/measuredStockThreshold.js:109`).

| Milestone over the full 239-entry universe | Result |
| --- | --- |
| Arithmetic | 229 matched, seven unavailable, three excluded |
| Input/session/basis/identity qualification | 228 qualified, eight unqualified, three excluded |
| Publication observation under proposed rule | 229 qualified, seven unqualified, three excluded; includes PARA's response timing, not its security qualification |
| Combined measurement under proposed rule | 228 qualified; eight unqualified; three excluded |
| Approved publication rule / production admissions | Zero; approval pending |
| Persisted corrected-receipt comparison | 236 unavailable, three excluded; no failures in this capture |
| Production scoring certification | false |

Compatibility buckets reconcile as 239 = 228 passed-under-proposed-rule + 0 failed + 8 unavailable + 3 excluded, and 236 eligible = 228 + 0 + 8. **Semantic change:** V1 passed meant attestation plus corrected receipt; V2 passed means measurement qualified under the documented proposed rule, unless any arithmetic/stored failure takes precedence. Always read milestone fields, not the compatibility bucket, for certification. A row can have qualified measurement and a failed persisted comparison simultaneously; tests exercise that case and unavailable-input/stored-failure overlap. Missing future receipts do not suppress measurement qualification. Arbitrary final attestations remain unqualified even with a matching persisted receipt.

Current comparison measurements: UNP 1.3613716964571096%; HUM 4.529210743120777%; ACN 4.623061120012764%. Their legacy frozen values are different contracts; later completed-session readings do not prove the correct earlier entry measurement. Original raw measurements, independent differences, source sessions and stored comparisons are in both audit packages.

## D3 decision package

**OPEN recommendation:** adopt no gameplay floor/cap unless qualified gameplay evidence supports one. The evidence is one completed-session cross-section, not a longitudinal gameplay experiment or a bound on future volatility. The qualified set is exactly the 228 symbols enumerated by the new audit, conditional on adoption of the proposed publication rule. Eight provisional/unavailable symbols and three configured exclusions remain reconciled in every report. Approved-rule distribution is not available until the owner adopts the rule.

| Qualified unbounded statistic | Percent |
| --- | --- |
| Minimum, BRK-B | 0.9581309339810106 |
| Median (middle-pair mean) | 2.3356234754480862 |
| P95 (nearest rank) | 4.623061120012764 |
| Maximum, BE | 7.825987494280925 |

| Bounds option | Changed symbols/raw values | Frequency |
| --- | --- | --- |
| None | None | 0/228 |
| Candidate 1%-15% | Floor: BRK-B 0.9581309339810106% to 1%; increase 0.0418690660189894 percentage points, approximately 4.37% relative. Cap: none. | Floor 1/228 (0.438596%); cap 0/228 |

PARA's 25.31% is not cap evidence. No player-mode bounds are inherited. The floor changes measured magnitude without demonstrated gameplay need; this cross-section supplies no support for a cap.

**PROPOSED final quantization:** retain unrounded binary64 `measuredPct` and independent decimal-rational audit. Quantize the effective gameplay percentage once to six decimal percentage points using exact decimal half-even over the shortest round-trippable representation of that measured Number, as implemented by `candidateRoundHalfEven`. Half cases: 1.2345665 -> 1.234566; 1.2345675 -> 1.234568. Record precision/rounding in the final approved model hash. Maximum absolute quantization change in the qualified cross-section is 0.000000499478349347271 percentage points. Six decimals limits changes while providing a stable serializable gameplay value; this remains a policy recommendation, not a change to the calculator.

**PROPOSED zero eligibility:** a genuine zero ATR is a valid measurement but ineligible as a reward divisor. Positive measurements quantized to zero are also ineligible; no epsilon, invented volatility or 1% substitution. No qualified current row is zero or quantizes to zero, so this is a boundary rule requiring owner approval, not observed gameplay calibration.

**PROPOSED display:** threshold percentage summary at two decimals, with the six-decimal effective value and full receipt available in detail. For USD stock targets, round theoretical fill-anchored tier prices to cents with half-even and have tier crossing, reward proximity, LOCK and displayed targets consume the same target array. Multiples/progress still use the effective percentage. Cent-rounding changes rare crossing boundaries and must be explicitly approved/replayed at one tick below/at/above each target; do not silently claim canonical unrounded tier detection is identical. Preserve canonical tier/reward constants and evaluate the minimal scorer contact in the later review. No target array or detector was integrated here. The JSON D3 package lists every qualified row's raw, unbounded-quantized, bounded-quantized and summary-display values.

## Later integration proposal and exact limitations

The companion `docs/specs/BAGGERBOMB_FIRST_SLICE_INTEGRATION_PROPOSAL_20261012.md` names admission/writer adapters, both-side position lifetimes, swap routes, evaluator and daily banking seams, risk/hurdle units, changed LOCK/wakes/prompts/results/capture and replay expectations. It includes the newly verified daily-banking seam, which reads all active battles and resets histories. No broad `baseATR` replacement is proposed. Full integrated trading preservation remains unverified until these adapters exist and their replays run.

Required later decisions: publication rule/attestation authority approval; D3 bounds/quantization/zero/display acceptance; separately authorized catalog/alias dispositions; exact fenced integration scope and final model hash. Required post-implementation evidence: fresh corrected position receipts/projections, decision-time validated fills, lifecycle/race replays, runtime scoring/display/capture and accepted score-dependent trading changes. There is no missing current export or split/dividend fixture blocking this closeout; the seven discontinued-symbol windows cannot be legitimately fabricated.

## Reproduce without production writes

The package manifest includes exact collection and audit tool hashes. From the authorized project checkout, use its existing local environment; never put credentials in arguments. Choose a fresh output directory rather than overwriting original evidence:

~~~powershell
$thresholdNode = 'C:\Users\fashr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$measurementOutRoot = 'C:\Users\fashr\.codex\visualizations\2026\10\12\01a131ef-f52d-7340-b38d-0e11fedd8d19\new-collection'
& $thresholdNode --use-system-ca --use-env-proxy scripts/collect-threshold-export.js --project tradeseven --env-file 'C:\Users\fashr\portfolio-duel\.env.local' --dependencies 'C:\Users\fashr\portfolio-duel\node_modules' --out "$measurementOutRoot\export.json"
& $thresholdNode --use-system-ca --use-env-proxy scripts/collect-threshold-identities.js --input "$measurementOutRoot\export.json" --env-file 'C:\Users\fashr\portfolio-duel\.env.local' --aliases MRSH,VMRK,DVN,PSKY,SKYD,BNZI --out "$measurementOutRoot\identities.json" --qualification-out "$measurementOutRoot\qualification.json"
& $thresholdNode scripts/threshold-audit.js --input "$measurementOutRoot\export.json" --out "$measurementOutRoot\audit" --qualification "$measurementOutRoot\qualification.json"
~~~

The identity qualification must retain the explicit PARA conflict until a separately reviewed catalog disposition. For the original-byte replay, use the delivered `closeout-qualification.json`, not a fabricated `final=true`; it binds the exact original export's semantic hash and the known proposed rule hash. No export supplies an unverified deployed SHA. New collection times yield new evidence and must not be mislabeled as the original comparison read.

## Validation and stop

**EXECUTED:** 27 Node tests pass (20 existing Stage 1 controls plus seven classification/collection tests); 72 existing focused regressions pass; ESLint passes on the five changed/new JavaScript test/tool files. Tests preserve measured calculations, independent reference, real archived AAPL split/dividend provenance, calibrated risk/trailing/hurdle controls, strict inputs and read-only GET behavior. New tests cover missing future receipts, arbitrary final attestations, stored-failure visibility, exact export/rule binding, timing boundary, unsupported exchange, incomplete capture and qualified-set distribution.

The companion artifact QA verifies original byte hashes, every package hash, universe reconciliation, 229 independent matches, 228 qualified rows, eight explicit exceptions, no corrected receipts, no credentials, and code citation ranges. This is an isolated tooling diff below the repository's mandatory large-change review threshold; it has no application/UI edits and no Vite build claim. No CI subscription, merge, activation or runtime scoring test was performed. Delivery stops at the pushed draft closeout PR; the owner controls the next review and merge.
