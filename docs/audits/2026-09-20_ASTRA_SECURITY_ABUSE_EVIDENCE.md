# Security and abuse audit — frozen evidence ledger

This is a documentation snapshot of the original September 20, 2026 audit at `0871937c9a12e7885ecfb08664f4f612b999d8a5`. No audit test was rerun for publication. See the [report](2026-09-20_ASTRA_SECURITY_ABUSE_AUDIT.md) for severity, prerequisites, interpretation and limitations, and the [census](2026-09-20_ASTRA_SECURITY_ABUSE_ENTRY_POINTS.md) for HTTP route candidates.

**PASS means the fixture observed its expected assertion, which can demonstrate a vulnerability. It is not a security approval.** The 21 emulator assertions and 15 VM/mock assertions are distinct evidence types. The frozen results below contain synthetic values only.

## Firestore rules assertions

Original `rules-results.json`: 2026-09-20T17:10:50.675Z. Node v22.20.0; demo project `demo-ft-security-audit`; socket/fetch policy `loopback:18880 only`; blocked off-emulator attempts: 0. Exact checked-in rules were loaded into the local Firestore emulator. No real authentication provider or production datastore was used.

| Assertion | Expected result observed | Synthetic detail |
|---|---|---|
| control guest cannot read battles | PASS | `{"code":"permission-denied","name":"FirebaseError"}` |
| F01 player A modifies B in battles | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in trainingBattles | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in drafts | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in snakeDraftBattles | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in snakeDraftLobbies | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in challenges | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in earningsTournaments | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in optionsTournaments | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F01 player A modifies B in draftAnalytics | PASS | `{"before":{"ownerId":"audit-player-b","userId":"audit-player-b","status":"active","score":0},"after":{"userId":"audit-player-b","score":99999,"ownerId":"audit-player-a","status":"completed"}}` |
| F02 player A reads B email | PASS | `{"fields":["auth","profile","stats"]}` |
| F02 player A reads B private agent memory | PASS | `{"fields":["ownerId","memory","directives"]}` |
| F02 player A lists users | PASS | `{"count":1}` |
| F03 forged persisted agent id allowed at birth | PASS | Expected assertion completed. |
| F01 self profile protected fields unrestricted | PASS | Expected assertion completed. |
| F02 player A reads B draft board | PASS | `{"type":"firestore/documentSnapshot/1.0","bundle":"136{\"metadata\":{\"id\":\"WIZy2hbaW7m8oRLmcsAJ\",\"createTime\":\"2026-09-20T17:10:50.509653000Z\",\"version\":1,\"totalDocuments\":1,\"totalBytes\":527}}202{\"documentMetadata\":{\"name\":\"projects/demo-ft-security-audit/databases/(default)/documents/tournamentGroups/audit-group/boards/audit-player-b\",\"readTime\":\"2026-09-20T17:10:50.509653000Z\",\"exists\":true}}319{\"document\":{\"name\":\"projects/demo-ft-security-audit/databases/(default)/documents/tournamentGroups/audit-group/boards/audit-player-b\",\"fields\":{\"rankedCandidates\":{\"arrayValue\":{\"values\":[{\"stringValue\":\"SYNTHETIC_PICK\"}]}}},\"updateTime\":\"2026-09-20T17:10:49.120652000Z\",\"createTime\":\"2026-09-20T17:10:49.120652000Z\"}}","bundleSource":"DocumentSnapshot","bundleName":"tournamentGroups/audit-group/boards/audit-player-b"}` |
| control A cannot read B agent battle | PASS | `{"code":"permission-denied","name":"FirebaseError"}` |
| control A cannot edit B agent | PASS | `{"code":"permission-denied","name":"FirebaseError"}` |
| control A cannot read B signal drop | PASS | `{"code":"permission-denied","name":"FirebaseError"}` |
| control sealed totals cannot be read | PASS | `{"code":"permission-denied","name":"FirebaseError"}` |
| control foreign agent namespace cannot be born | PASS | `{"code":"permission-denied","name":"FirebaseError"}` |

## Isolated application path assertions

Original `path-results.json`: 2026-09-20T17:21:45.044Z. Node v22.20.0; Acorn 8.15.0. All provider calls mocked; VM has no native imports or real process/environment. Database adapters/model responses/provider results were synthetic. Source extraction ranges follow below.

| Assertion | Expected result observed | Synthetic detail and scope |
|---|---|---|
| F04 unauthenticated POST reaches rankings fan-out; GET control denies | PASS | `{"getStatus":401,"postStatus":500,"mockedFundamentalsCalls":239,"reason":"synthetic provider failures stop route after complete fundamentals fan-out"}` |
| F04 unauthenticated POST enters estimates privileged boundary | PASS | `{"status":500,"privilegedBoundaryCalls":1}` |
| F04 spoofed cron header and undefined secret guards (source statements) | PASS | `{"guardOnly":true,"accepted":["agent-batch-review.js","agent-daily-scores.js","agent-evaluate.js","baggerbomb-v4-daily-scores.js","compute-briefs.js","compute-daily-baggerbomb-levels.js","compute-daily-regime-brief.js","compute-estimates.js","compute-rankings.js","intraday-poll.js","intraday-validate.js","live-draft-fire.js","mandate-evaluate.js","mandate-rollover.js","process-draft-claims.js","process-pending-reflections.js","season-daily-evaluate.js","season-pit-stop-manage.js","snake-draft-daily-scores.js","tournament-orchestrator.js","voice-layer-cache.js"],"edgeHeaderHandling":"not tested"}` |
| F08 legacy set-opponent changes live League baseline; foreign-owner control denies | PASS | `{"before":{"ownerId":"audit-player-a","status":"active","gameMode":"baggerbomb_tournament","createdAt":"2026-09-20T17:21:44.821Z","portfolio":{"star":[{"symbol":"AAPL"}],"startingPrices":{"AAPL":100}},"scoring":{"thresholds":{"AAPL":{"threshold":2.5}}},"opponent":null},"after":{"ownerId":"audit-player-a","status":"active","gameMode":"baggerbomb_tournament","createdAt":"2026-09-20T17:21:44.821Z","portfolio":{"star":[{"symbol":"AAPL"}],"startingPrices":{"AAPL":1}},"scoring":{"thresholds":{"AAPL":{"threshold":0.01,"rallyThreshold":0.015,"moonshotThreshold":0.02}}},"opponent":{"portfolio":{"star":[{"symbol":"AAPL","baseATR":0.01}]},"bench":null,"username":"CPU Opponent","odUserId":"cpu"},"updatedAt":"2026-09-20T17:21:44.825Z"},"foreignOwnerStatus":403}` |
| F05 parse-signal passes private address to fetch and fetched text to model | PASS | `{"mockedRequests":[{"url":"http://127.0.0.1:9/synthetic-only","redirect":"follow"}],"modelReceivedSyntheticInternalText":true,"status":500,"actualNetworkCalls":0}` |
| F06 guest repeated forceRefresh amplifies model calls despite cache failure | PASS | `{"requests":2,"quartersPerRequest":3,"mockedModelCalls":6,"mockedInternalFetches":2,"dbFailureMode":"dynamic SDK imports denied -> cache unavailable"}` |
| F06 advisor caller controls output ceiling; guest control denies | PASS | `{"guestStatus":401,"authenticatedStatus":200,"forwardedMaxTokens":32000}` |
| F03 stored id survives deploy construction and corrupts B stats on completion | PASS | `{"before":{"gamesPlayed":0,"losses":0},"after":{"wins":0,"losses":1,"draws":0,"gamesPlayed":1,"totalScore":-100,"avgScore":-100,"currentStreak":-1,"bestStreak":1},"attackerOwner":"audit-player-a","persistedBattleAgentId":"audit-agent-b","victimOwner":"audit-player-b","scope":"actual identity initializer, battle builder and completion; model decision and DB transport mocked, full deploy handler not run"}` |
| F07 same-snapshot daily reset doubles badge increment | PASS | `{"before":{"bankedBadgePoints":{"total":0},"dailyScores":{}},"after":{"bankedBadgePoints":{"total":30,"breakdown":{"day1":{"points":15,"badges":{"AAPL":["synthetic-bagger"]},"recordedAt":"2026-09-20T17:21:44.999Z"}}},"dailyScores":{"day1":{"badgePoints":15,"recorded":true,"recordedAt":"2026-09-20T17:21:44.999Z","recordedBy":"cron"}}},"serialReplay":{"status":"skipped","reason":"already_recorded"},"scope":"actual daily writer; in-memory Admin adapter applies increment semantics; scoring mocked to fixed 15"}` |
| F09 middleware does not request revocation or disabled-user check | PASS | `{"verifyIdTokenArgumentCount":1,"revocationParameterAbsent":true,"realRevokedTokenNotTested":true}` |
| control instance rate limiter blocks third request; fresh worker starts over | PASS | `{"singleWorkerEnforces":true,"freshWorkerResets":true}` |
| F10 global parse cache returns another user context-dependent result | PASS | `{"sameCacheKey":true,"responseToPlayerB":{"extractedText":"SYNTHETIC_A_PRIVATE_NOTE"},"scope":"synthetic cache seeded with note-bearing model output; no real model tested; note disclosure conditional on generated output"}` |
| control sealed small pod exposes accepted threshold signal only | PASS | `{"snapshots":[{"backerProgress":{"count":1,"floor":3,"met":false},"teamSpread":{"met":false}},{"backerProgress":{"count":2,"floor":3,"met":false},"teamSpread":{"met":true}},{"backerProgress":{"count":3,"floor":3,"met":true},"teamSpread":{"met":true}},{"backerProgress":{"count":3,"floor":3,"met":true},"teamSpread":{"met":true}}],"inference":"Observer knows own stake is on A; before qualification a spread flip shows at least one other stake on B, no amount or identity. Accepted by Amendment B D-ac; after qualification no further public change."}` |
| control hostile model swap cannot name arbitrary symbols | PASS | `{"invalidErrors":["symbolOut \"VICTIM\" not found in active portfolio","symbolIn \"ARBITRARY\" not found in bench or watchlist"],"permittedControl":true,"scope":"deterministic validator, no model prompt compliance or full trade execution tested"}` |
| control story renderer escapes hostile body and pullquote HTML | PASS | `{"rawHtmlEscaped":true,"scope":"body and explicit pullquote strings; not every UI sink"}` |

### Application source exercised

Each row identifies an original fixture source-extraction boundary, not proof that every branch in that file executed. F03 also extracts the exact `agent` initializer from `api/agent/decide.js`; the report distinguishes that component chain from a full deploy test. Story rendering uses the named renderer slice.

| Source | Extracted lines |
|---|---|
| [api/_utils/rateLimit.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/rateLimit.js#L1-L114) | 1–114 |
| [api/_utils/security.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/security.js#L1-L243) | 1–243 |
| [api/_utils/authMiddleware.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/authMiddleware.js#L1-L63) | 1–63 |
| [api/_utils/rankingConfig.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/rankingConfig.js#L1-L839) | 1–839 |
| [api/cron/compute-rankings.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/compute-rankings.js#L114-L114) | 114–114 |
| [api/cron/compute-rankings.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/compute-rankings.js#L116-L137) | 116–137 |
| [api/cron/compute-rankings.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/compute-rankings.js#L139-L175) | 139–175 |
| [api/cron/compute-rankings.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/compute-rankings.js#L1438-L1678) | 1438–1678 |
| [api/cron/compute-estimates.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/compute-estimates.js#L388-L484) | 388–484 |
| [api/agent/set-opponent.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/agent/set-opponent.js#L1-L112) | 1–112 |
| [api/forge/parse-signal.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/forge/parse-signal.js#L1-L405) | 1–405 |
| [api/earnings/verify-stock.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/earnings/verify-stock.js#L1-L403) | 1–403 |
| [api/ai-advisor.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/ai-advisor.js#L1-L1272) | 1–1272 |
| [src/constants/agentGameModes.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/src/constants/agentGameModes.js#L1-L84) | 1–84 |
| [api/_utils/agentBattleService.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/agentBattleService.js#L67-L304) | 67–304 |
| [src/constants/leagueTournament.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/src/constants/leagueTournament.js#L409-L409) | 409–409 |
| [src/constants/leagueTournament.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/src/constants/leagueTournament.js#L417-L419) | 417–419 |
| [api/_utils/casualClone.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/casualClone.js#L329-L335) | 329–335 |
| [api/cron/agent-evaluate.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/agent-evaluate.js#L4505-L4529) | 4505–4529 |
| [api/cron/agent-evaluate.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/agent-evaluate.js#L4574-L4907) | 4574–4907 |
| [api/cron/agent-daily-scores.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/cron/agent-daily-scores.js#L45-L203) | 45–203 |
| [api/_utils/authMiddleware.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/authMiddleware.js#L1-L63) | 1–63 |
| [api/_utils/rateLimit.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/rateLimit.js#L1-L114) | 1–114 |
| [api/_utils/rateLimit.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/rateLimit.js#L1-L114) | 1–114 |
| [api/_utils/contentHash.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/contentHash.js#L1-L46) | 1–46 |
| [api/_utils/signalDropPrompt.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/signalDropPrompt.js#L1-L351) | 1–351 |
| [api/forge/parse-signal.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/forge/parse-signal.js#L1-L405) | 1–405 |
| [api/_utils/backingPools.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/backingPools.js#L417-L428) | 417–428 |
| [api/_utils/backingPools.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/backingPools.js#L446-L453) | 446–453 |
| [api/_utils/backingPools.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/backingPools.js#L761-L789) | 761–789 |
| [api/_utils/agentSwapExecution.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/agentSwapExecution.js#L28-L90) | 28–90 |
| [api/_utils/agentSwapExecution.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/agentSwapExecution.js#L379-L392) | 379–392 |
| [api/_utils/agentSwapExecution.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/agentSwapExecution.js#L397-L406) | 397–406 |
| [api/_utils/agentSwapExecution.js](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/_utils/agentSwapExecution.js#L411-L413) | 411–413 |

## Local scan results

Original `scan-results.json`: 2026-09-20T17:18:00.110Z. git version 2.51.1.windows.1; Node v22.20.0; Acorn 8.15.0. 3175 tracked files; 3159 text files under 4 MB inspected; 509 API JavaScript files parsed; 0 parse failures. This is bounded signature/syntax analysis, not a clean security verdict.

| Candidate location | Signature family | Audit disposition |
|---|---|---|
| [.env.example:42](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/.env.example#L42) | private-key | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [api/scripts/wire-exemplar-shortlist.js:8](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/api/scripts/wire-exemplar-shortlist.js#L8) | private-key | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/loadLocalEnv.js:120](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/loadLocalEnv.js#L120) | private-key | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/loadLocalEnv.js:124](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/loadLocalEnv.js#L124) | private-key | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/loadLocalEnv.js:129](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/loadLocalEnv.js#L129) | private-key | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/ws1-observe-walk.test.js:122](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/ws1-observe-walk.test.js#L122) | service-account-json | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/ws1-observe-walk.test.js:134](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/ws1-observe-walk.test.js#L134) | service-account-json | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/ws1-observe-walk.test.js:148](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/ws1-observe-walk.test.js#L148) | service-account-json | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |
| [scripts/ws1-observe-walk.test.js:166](https://github.com/fashraf94/TradeSeven/blob/0871937c9a12e7885ecfb08664f4f612b999d8a5/scripts/ws1-observe-walk.test.js#L166) | service-account-json | Placeholder, parser string or synthetic fixture; no live credential confirmed; value omitted. |

History scope: all locally available reachable commits; regex diff pickaxe, filenames only; not deleted unreachable objects or entropy scanning. Reachable local commits examined: 4266. Matching commit/path inventory:

```text
COMMIT 3a21680341f2ddb477782d75376b81fffcd0d26d
scripts/loadLocalEnv.js
COMMIT 8845ae777b67226fa0813f1f82847a94e4b01bb6
api/scripts/wire-exemplar-shortlist.js
COMMIT 8f45165db4f10c32fd8729f7fce5fcbf3fd9267d
.env.example
```

The bulk npm advisory escalation was rejected by automatic approval review because dependency-name/version egress lacked specific authorization. It was not bypassed. The report records the narrower official-advisory comparisons. gitleaks and semgrep were unavailable.

## Original delivery state

Original audit branch: `codex/security-abuse-audit-2026-09-20`; HEAD and then-fetched origin/main: `0871937c9a12e7885ecfb08664f4f612b999d8a5`. At 2026-09-20T17:49:56.773Z, working tree clean: true; application files changed: false; deployment changes: false; commits created: false; pushed: false; paid/provider calls: 0. These statements describe the audit phase before the separately authorized documentation publication.

At 2026-09-20T17:48:58.2014057Z, emulator stopped: true; checked ports 18880, 61006 had 0 remaining listeners. Synthetic records were cleared and SDK clients cleaned up.

## External archive provenance

The original local archive is named `fantasytrades-security-audit-2026-09-20-94ef.zip` and contains 14 files. Its SHA-256 is `127e7264865b31b729a92620e806ff8d6b4e6104f307daee94401b95ec197e0b`. It was delivered in the audit task; it is not hosted by this PR. The original executable fixtures and raw JSON remain external. No binary archive or executable reproduction is added to the repository.

| Original evidence file | SHA-256 |
|---|---|
| REPORT.md | `7be1d5dfafc9997215704317695d52592154febba6e4f4e6f21692f1d794edcc` |
| ENTRY_POINTS.md | `7fdba630c2dea00eb711b6d34586a3d87d2a42a59033fb5566e7fb4d1d150bd9` |
| rules-results.json | `f99745a1ea33d5186dbce1da071a6a56f35ff2aec7f8ec913fd24ab35ca1db0e` |
| path-results.json | `a466001ff6c28d7aa3f2d77b2ee2c8a2f968d6b9b9a4208045b138064bf6e583` |
| scan-results.json | `bf2e233811f525369c8a7ff2305286d31e2c9e8dc61fc96a7c691504a113aa35` |
| delivery-state.json | `84e69f5117f68856fe26926ee7ceb1449e7964d792f1704320ebee0b1bf601b3` |
| cleanup-check.json | `caddc39aab6ea2277bf0e9ddfd574a78c3ade7300cb10b19791aa44c37413c5e` |
| local-rules.cjs | `fd60b5f0609cfee7eaa339e95e6850116fa29b13ef0202d1119e9f8b02166047` |
| local-paths.cjs | `d55816474d41967b32776dc2013217a4ee081bc84d80d88c8146902a96c45a55` |
