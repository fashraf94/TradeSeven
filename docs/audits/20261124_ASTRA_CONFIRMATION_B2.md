# Practice Field B2 · Founder’s paper-book agent

24 November 2026 | PR #1109 | Fix-round confirmation V2

## A01 · Which prices the desk can use

The original failure reproduced on the base. On Monday 16 November, Shadow saw Friday’s 16:00 ET MSFT print at $420 and admitted the long draft. Unreserved cash fell from $70,000.00 to $35,020.96. On the fix, the same request omitted MSFT, the draft recorded `name_not_a_candidate`, and the treasury, open ideas and long slot stayed unchanged. Monday’s 16:00 print was offered and admitted in the positive control. (`docs/audits/20261123_ASTRA_REVIEW_B2.md:18`, `agentRun.test.js:34`, `agentFixRound.test.js:71`, `agentFixRound.test.js:87`.)

Three further full-desk runs each refused MSFT and preserved the portfolio, treasury, slots and ideas. The inputs were a Monday close print explicitly flagged as carried forward, a Monday 09:29 ET print, and a positive price with a receipt time but no vendor time. The classifier returned `carried_forward`, `pre_open_print` and `receipt_time_fallback` respectively. (`__testsupport__/fixtures.js:63`, `marks.js:123`, `agentSources.js:79`, `agentFixRound.test.js:45`, `agentFixRound.test.js:59`.)

I gave the snapshot named by the close row and the default snapshot opposite MSFT timestamps. A stale named snapshot excluded MSFT from both the prompt and drafting. A fresh named snapshot offered it, left the draft waiting under a deliberately late clock, then admitted it on replay with one fake call overall. All three paths share the same snapshot key and eligibility check. The already-deferred B-5 case concerns prompt-size trimming. (`agentRun.js:277`, `agentRun.js:344`, `agentRun.js:495`, `agentRun.js:528`, `agentRun.js:534`, `agentRun.js:545`, `agentRun.test.js:557`, `docs/audits/20261123_BUILD_B2_THE_AGENT.md:197`.)

## A02 · Optional fields under R-18

| Answer beside a valid exit | Observed result |
|---|---|
| Explicit `null` on either optional field | `comparison.symbols` and `source.thesisRef` normalized identically to omission. The `same_stock_held` draft with null symbols admitted alongside the exit. A `price_list` draft with a null label also admitted in its control. (`agentTool.js:202`, `agentFixRound.test.js:122`, `agentFixRound.test.js:176`, `agentFixRound.test.js:183`.) |
| Wrong JSON type | Ten combined-answer runs covered every incompatible JSON type across the two fields, including mixed symbol arrays. Each made one fake call, settled $0.03, recorded a field-specific `invalid_answer`, and produced zero exits and zero admissions. Portfolio and treasury matched their pre-call values. (`agentTool.js:229`, `agentTool.js:242`, `agentRun.js:451`, `agentRun.js:475`, `agentFixRound.test.js:140`.) |
| Omission leaves the draft incomplete | A sector-fund draft without a fund recorded `comparison_fund_unknown`. A saved-thesis draft without a label recorded `thesis_source_unknown`. In each case the considered list recorded the refused draft and the valid manager exit settled. (`agentFixRound.test.js:154`, `agentFixRound.test.js:167`.) |

## A03 · What the close row records

All five desk-write sites update the desk and window summary in the same transaction. The summary counts attempts from both desks. A reservation is recorded before transport, so a paid attempt keeps the window’s `modelCalled` true. The close creates the row once, and receipt reconciliation leaves close rows alone. (`agentRun.js:130`, `agentRun.js:150`, `agentRun.js:263`, `agentRun.js:319`, `agentRun.js:419`, `agentRun.js:423`, `agentRun.js:437`, `agentRun.js:469`, `close.js:1460`, `windowLedger.js:166`.)

| Observed close | Final row |
|---|---|
| Paid invalid answer, valid hold, paused book | Respectively `model_fallback` with one call, `model_no_change` with one call, and `no_model_action` with zero calls. (`agentFixRound.test.js:245`, `agentFixRound.test.js:252`, `agentFixRound.test.js:259`.) |
| Shadow admitted, then archetype finished | The first admission survived both a second desk with no work and a second paid answer. Replaying each pass preserved the row byte for byte. (`agentFixRound.test.js:204`, `agentFixRound.test.js:232`.) |
| Shadow exited and admitted, then archetype had a paid fallback | `model_action`, one call per desk, one exit, one admission, and `paidFallbacks: ["archetype"]`. Replay made zero calls and preserved the row bytes. (`agentRun.js:133`, `agentRun.js:141`, `agentRun.js:267`, `agentFixRound.test.js:272`.) |

**B2-C01 · Nonblocking.** A paid $0.1625 archetype attempt timed out in the fixture, its retry was deferred, and the next fire lacked the frozen identity. The nested desk wrote `calledModel: false`. The window retained `modelCalled: true`, one call and `model_fallback` through replay. Likelihood is low on the founder’s book because the identity must become unavailable between a paid failure and its deferred retry. (`agentPrompt.js:54`, `agentRun.js:132`, `agentRun.js:343`, `agentRun.js:389`, `agentRun.test.js:303`, `docs/audits/20261123_BUILD_B2_THE_AGENT.md:476`.)

## A04 · Usage charging

A valid fake reply with `usage: {}` kept its answer. The attempt recorded `usageUnreadable: true`, `unpriced: true` and a $0.1625 charge. Book spend settled the entire reservation. (`agentRun.js:217`, `agentRun.js:442`, `agentRun.js:458`, `agentFixRound.test.js:328`.)

## A06 · Text retained on the row

A price-list draft carrying the label `proven` admitted with a null label in both the stored answer and the considered draft. The word was absent from the whole row. A valid saved-thesis label was retained. Result words in a draft’s `slot` or `comparison.type` refused the whole answer. (`agentTool.js:220`, `agentTool.js:228`, `agentTool.js:245`, `agentFixRound.test.js:348`, `agentFixRound.test.js:367`, `agentFixRound.test.js:374`.)

## Both agent switches off

| Base-to-fix comparison | Direct byte comparison |
|---|---|
| 92-fire trace | **92/92 identical.** Twenty quarterly scenarios across two registry states and two Practice Field modes gave 80 fires. Hold, cash close and held-position close across two book populations and both modes gave 12 more. Compared the response, stored documents, ordered database operations, logs and fake upstream/model calls. The labeled JSON was 10,572,094 bytes on each tree, SHA-256 `8fad4359e49ef1e6490244edbfb14ca7252351e83c05436a16f4c131ca7aaccf`. No normalization. (`api/cron/practiceFieldNoBook.trace.test.js:159`, `api/cron/practiceFieldNoBook.trace.test.js:189`, `api/cron/practiceFieldNoBook.trace.test.js:201`, `api/cron/practiceFieldNoBook.trace.test.js:277`, `docs/audits/20261123_BUILD_B2_THE_AGENT.md:174`.) |
| End-to-end dump | **443,533 bytes identical**, SHA-256 `f5ed5c964c84d28bf0dd47524e0760a7dcff22012c8bed7e760600889e235c08`. Each dump contained 191 documents. The fixture separately checked 28 daily parse reports before excluding them from its pinned serialization. (`endToEnd.test.js:101`, `endToEnd.test.js:341`, `endToEnd.test.js:347`, `endToEnd.test.js:350`.) |

## Revisions and activation decision

| Revision read | Full commit |
|---|---|
| Detached base | `190b5e63deec0ae923226619b58e2a14c522fe53` (`.git/worktrees/astra-b2-confirm-190b/HEAD:1`) |
| Detached fix | `597b64ca0b5b6556300625405003e8e4cca3d121`. Only the build report changed after its code parent `bb224b405f85bc0234b773081738b817ee9cb0ed`. (`.git/worktrees/astra-b2-confirm-597b/HEAD:1`, `docs/audits/20261123_BUILD_B2_THE_AGENT.md:374`.) |
| Fetched `origin/main` | `fc8a66d009ac3d4f1808cf9740736e64408ad033` (`.git/refs/remotes/origin/main:1`) |

The scoped Git diff from fix to fetched main was empty for the four fix files, the agent modules, their fixtures and tests, and the agent flags. The shared `mode.js` gained B3’s screen switch. Both agent-switch readers retain their fix-head bodies. Both agent flags are false at the fix and on fetched main. Short source references in this report resolve under `api/_utils/practiceField/` at the fix unless a revision or longer path is given. (`mode.js:61`, `mode.js:71`, `origin/main api/_utils/practiceField/mode.js:65`, `origin/main api/_utils/practiceField/mode.js:75`, `origin/main api/_utils/practiceField/mode.js:88`, `src/config/practiceFieldFlags.js:55`, `src/config/practiceFieldFlags.js:64`.)

**Results.** The offline run passed 165/165 checks in six files on the fix and 92/92 in three files on the base. These totals include the independent scenario and trace assertions above. All replays used synthetic data and the in-memory store. The agent used fake transport. Live answer quality remains for the founder’s first live closes. (`__testsupport__/agentFixtures.js:107`, `agentFixRound.test.js:14`, `agentRun.test.js:34`, `agentPrompt.test.js:112`, `agentEndToEnd.test.js:242`, `api/cron/practiceFieldNoBook.trace.test.js:24`, `endToEnd.test.js:350`, `docs/audits/20261123_BUILD_B2_THE_AGENT.md:205`.)

**Founder’s own paper-book agent switch — READY.** The stale reservation is closed, invalid answers preserve the book, the window records paid calls through replay, and both switches-off comparisons match the base. (`agentFixRound.test.js:71`, `agentFixRound.test.js:140`, `agentFixRound.test.js:204`, `api/cron/practiceFieldNoBook.trace.test.js:189`, `endToEnd.test.js:350`.)

Report path: `C:\Users\fashr\Documents\20261124_ASTRA_CONFIRMATION_B2.md`
