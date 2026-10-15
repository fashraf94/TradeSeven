# Astra — Review: Film Room B1

**DO NOT MERGE**

**Date:** 2026-10-14 · **Mode:** read-only review with local tests · **PR:** [#962](https://github.com/fashraf94/TradeSeven/pull/962), `claude/film-room-b1-tape` (draft as supplied).

Five cases breach the requested exit criteria. The ordinary fixtures and the existing screen sweeps pass; those checks do not cover the failing boundaries below. No implementation fix was made.

| Finding | Consequence | Criterion |
|---|---|---|
| F1 | A completed day with basis `none` can still store and display **Draw**. | 2 |
| F2 | Recovering missing volume on a retry also replaces saved open, high, low and close prices. | 1 |
| F3 | Bounded meeting data can push a near-limit tape over Firestore's document limit and fail the whole write. | 4 |
| F4 | An injected failure in the new T1 per-check projection aborts the day instead of isolating T1. | 4 |
| F5 | W2 moves `score.dayChange` as well as the disclosed `dayNumber`. | 1 |

**Evidence labels:** VERIFIED means read or executed at this review's pinned head. SYNTHETIC identifies a deliberately constructed boundary or injected failure. REPORTED means a claim in the executor's record, not independently observed production evidence. All production prevalence is unknown in this review. The prompt's seven criteria alone determine the verdict; no additional acceptance gate is imposed.

**Provenance and isolation.** Reviewed head `1fcefa5658186c2ea42f5080fd8271b07dd54081`; code head `963d392e`; their only difference is `docs/audits/20261012_BUILD_FILM_ROOM_B1.md`. Both the remote branch and `refs/pull/962/head` matched the reviewed head at the start and at delivery. After fetching `main` and the branch, the merge base was `6d75a324f8390a6f351a48d0da716da8dc5661f4`; fetched main was `a35c7db0058c5055a172f81e32cd058467a62379`. An initial local-ref comparison was provisional until that fetch confirmed the merge base.

The supplied checkout remained detached at `6d75a324f8390a6f351a48d0da716da8dc5661f4`, clean at start and finish. Tests ran in external archives made with `git -c core.autocrlf=false -c core.eol=lf archive`. All 3,833 head blobs and 3,814 base blobs matched Git before and after testing (`evidence/final-blob-verification.json`). Archive SHA-256:

- Head: `296db4a6564ca5f2f5bdcc378a90fe51e87ddd320adcd57fa7b5e52c501b7e2e`
- Base: `681c5476f3296e472de6fd0fc1b77684663f3078d392bc705628cb78b91ae3ad`

Line references below are to the head archive unless explicitly labelled base. The governing inputs were the shared contract, Build B spec §§1–3 and §9, V1.2 and Amendments A–E through R15, and the user's accepted dispositions. The executor's report was treated as claims. No census main, production database, production API, EODHD endpoint, deploy, merge, commit or push was used. Local Firestore writes used only synthetic data at `127.0.0.1:8686`, project `demo-film-room-b1-size`; that emulator was stopped after the probe.

## 1. Findings

### F1 — `none` still permits a stored draw, including after refresh

**Criterion 2. VERIFIED by writer and mounted v2 screen; SYNTHETIC no-opponent completion.**

`battleResultOf` returns a stored result before testing `noOpponent` (`api/_utils/filmTape/tapeAssemble.js:920–924`). The assembly supplies both the recorded `battle.result` and the new no-opponent fact (`api/_utils/filmTape/tapeAssemble.js:948–962`). The merge repeats the same precedence, including a kept completion block (`api/_utils/filmTape/tapeMerge.js:465–482`). Nulling the opponent number therefore does not make the result unavailable.

**Repro.** Use the capture-composed `stalledDay` fixture with `opponent: null`, `status: 'completed'`, `result: 'draw'` and final scores `0 / 0`. A real B1 close write produces:

```json
{
  "score.opponentBasis": "none",
  "battle.final": { "total": 0, "opponent": null },
  "battle.result": { "value": "draw", "basis": "stored" }
}
```

Write the same fixture with the real base writer, then refresh it with B1: the draw still survives. A separate Sep-23 fixture passed through both real B1 passes and mounted in `FilmRoomScreenV2` displays `data-result="draw"` with text **Draw**. The screen takes the stored result directly (`src/screens/filmRoomV2/FilmRoomGlance.jsx:219–234`). Its number, word, sign, quotation and stored-note sweeps all pass: they do not enforce the new no-opponent invariant.

**Refutation/control.** Without a stored `result`, the same no-opponent completion becomes unavailable, and the branch's derived-draw/kept-unit cases pass. This isolates the stored-result precedence. The executor already names this as B-7 backlog and calls it unreachable (`docs/audits/20261012_BUILD_FILM_ROOM_B1.md:205`); its reported zero production cases do not establish the unconditional criterion, and this was not one of the user's accepted dispositions. This review does not claim an affected production day.

**Fix proposed, not made.** Enforce the no-opponent result before accepting a stored win/loss/draw for this tape result, in the shared resolver used by assembly and merge. Cover a fresh write, a pre-T1 refresh and a kept completed block with a stored draw. Preserve the separate attributed platform completion record according to its contract; do not use it as the tape's competitive result.

**Repro artifacts:** `head/_astra/core.test.js` (stored draw), `head/_astra/screen.jsdom.test.jsx`; `evidence/core-results.json`, `evidence/screen-results.json`, `evidence/none-stored-draw.html`.

### F2 — W3's volume recovery also rewrites saved OHLC prices

**Criterion 1. VERIFIED through two real candle passes and a base control.**

On an equal-minute tie, the new `keepSeries` branch returns the entire fresh bar when the saved volume is null and the fresh volume is numeric (`api/_utils/filmTape/candlePass.js:318–324`). That replaces `o`, `h`, `l` and `c`, not only the permitted missing volume. The result reaches the existing series write (`api/_utils/filmTape/candlePass.js:602–609`).

**Repro.** Write a normal captured day, then give the first candle pass a partial ACN response whose first ten-minute bucket has ten minutes and one missing minute volume. Let the next response recover the volume and the missing later bars, while correcting those first prices from 100 to 101. Both the initial and retry buckets have `m = n = 10`.

| First bucket | Stored after first B1 pass | Same retry with base merge | Same retry with B1 |
|---|---:|---:|---:|
| Open / close | 100 / 100 | 100 / 100 | **101 / 101** |
| High / low | 100.01 / 99.99 | 100.01 / 99.99 | **101.01 / 100.99** |
| Volume | null | null | 10,000 |

Both retry passes finish `written`. Recovering volume is authorized; the additional price changes are not among the named movements. This can occur after B1's first live candle run, on a retry; it is not a claim that pre-B1 tapes already contain null volume.

**Refutation/control.** The base candle pass receives the exact same saved series and fresh response and keeps the saved prices. With unchanged prices the branch's W3 tests pass, which is why they miss this distinction. BA-34's equal-minute tie preservation remains the relevant pre-existing behavior.

**Fix proposed, not made.** On the volume-recovery tie, merge only the permitted volume value into the saved bar and retain the saved price fields and appropriate preservation metadata. Test a retry with changed OHLC explicitly. Treat price correction as a separate authorized change if desired.

**Repro artifacts:** `head/_astra/retry.test.js`, `head/_astra/core.test.js`; `evidence/real-candle-retry.json`, `evidence/core-results.json`.

### F3 — Per-field meeting caps do not isolate a document-size failure

**Criterion 4. VERIFIED with the real writer and local Firestore emulator; SYNTHETIC near-limit core tape.**

The meeting builder caps individual strings, two legs and 26 rows (`api/_utils/filmTape/tapeAssemble.js:813–835`), and the merge re-applies the row cap (`api/_utils/filmTape/tapeMerge.js:562–566`). Those caps do not account for the rest of the tape. The meeting catch surrounds only assembly (`api/_utils/filmTape/tapeAssemble.js:862–866`); the full document is later sent to one `tx.set` without a byte-budget fallback (`api/_utils/filmTape/writeTapeDay.js:148–149`).

**Repro.** Use 26 meetings, each within the limits: a unique id at most 64 UTF-16 code units, valid instants, two roster-bound legs, 500 characters of diagnosis and 40 of resolver text. Use multibyte characters to exercise byte size. A normal fixture with these meetings is accepted. For the capacity boundary, enlarge one existing evaluation rationale to 970,000 ASCII characters. This is an intentionally extreme core record, not a claim about model output or production occupancy.

The local emulator accepts the complete source battle and the pre-B1 tape, accepts B1 without meetings, and rejects B1 with the bounded meetings:

| Object | UTF-8 JSON bytes, for comparison | Actual emulator result |
|---|---:|---|
| Source battle, including meetings | 1,047,670 | Accepted |
| Base tape | 1,008,360 | Accepted |
| B1 tape without meetings | 1,013,859 | Accepted |
| B1 tape with meetings | 1,068,043 | **Rejected: `3 INVALID_ARGUMENT: maximum entity size is 1048576 bytes`** |

These are JSON lengths, not a substituted calculation of Firestore document size; acceptance/rejection came from the emulator. The real base `writeTapeDay` then succeeded against the emulator. The real B1 refresh failed with the same size error. The old tape remained `written` with neither tags nor meetings: the failure was atomic, but the entire requested write failed instead of only T2 becoming unavailable.

**Refutation/control.** The ordinary maximum-string meeting fixture is only 98,068 JSON bytes and writes successfully. An over-limit control is rejected. Removing meetings from the near-limit B1 output restores success. Thus this is a whole-document capacity seam, not an uncapped meeting string or a claim that 26 normal meetings alone exceed 1 MiB. Production reachability/frequency beyond the accepted Firestore document shapes was not established.

**Fix proposed, not made.** Budget B1 additions against the complete merged document before `tx.set`, allowing a bounded unavailable/partial meeting section when it cannot fit while preserving the other sections. Apply the same envelope protection to optional tag payloads. Keep a real-emulator regression with an accepted source battle and accepted core tape.

**Repro artifacts:** `head/_astra/size.test.js`; `evidence/document-size.json`, `evidence/size-tests.json`, `evidence/emulator.log`.

### F4 — A T1 failure aborts the day

**Criterion 4. VERIFIED fault injection requested by the prompt; no ordinary Firestore-data trigger asserted.**

The new opponent read occurs inside the existing score object construction (`api/_utils/filmTape/tapeAssemble.js:177–178`), called while mapping checks (`api/_utils/filmTape/tapeAssemble.js:1023`). It has no section-level failure boundary. `writeTapeDay` calls that assembly before the tape transaction (`api/_utils/filmTape/writeTapeDay.js:103–116`).

**Repro.** Wrap only `readDayTicks`; return the real tick records except that the first, non-final tick's `scores.opponent` access throws a `TypeError`. All active/banked/total fields and every other source remain intact. The control writes normally. The injected case rejects from `scoresOf` and performs zero day-content writes. Through `runClosePass`, the outer catch marks the whole day failed (`api/_utils/filmTape/closePass.js:145–150`), leaving a failure stub without checks/actions, with candles `skipped / close_pass_failed`.

**Refutation/control.** Equivalent counter and meeting-reader throws produce written days with only their own sections unavailable; every other serialized section matches the control. A separate throw in the tagger failure path's coverage access is also contained. A throwing accessor is test instrumentation, not a value Firestore stores. This finding demonstrates the explicitly requested T1 fault-containment contract; it does not claim malformed scalar values normally throw.

**Fix proposed, not made.** Isolate the added opponent projection from the pre-existing score projection and return null/unavailable T1 evidence on failure, with a bounded diagnostic, while letting the original fields write unchanged. Cover the first check, final check and refresh paths.

**Repro artifacts:** `head/_astra/isolation.test.js`; `evidence/isolation-results.json`.

### F5 — W2 changes the day-change value and basis beyond its disclosed exception

**Criterion 1. VERIFIED base/head write and pre-B1 refresh; SYNTHETIC malformed timeline.**

The validated timeline now also decides whether the day uses the battle-start reference or a previous day's tape (`api/_utils/filmTape/tapeAssemble.js:891–900`). The merge accepts the resulting day-change unit (`api/_utils/filmTape/tapeMerge.js:448`). This is broader than the prompt's stated W2 `dayNumber` movement.

**Repro.** Use `completedDay` with timeline `['2026-09-20', '2026-09-24']`: a valid Sunday date followed by the actual session. Both versions successfully write; this avoids the old invalid-date exception. The base stores day 2 with `score.dayChange = { value: null, basis: 'unavailable', reference: null }`. B1 stores day 1 with `{ value: 46, basis: 'battle_start', reference: 0 }`. Refreshing the base-written tape through B1 makes the same change. All other non-additive, non-W4 differences in this probe are those four leaves.

**Refutation/control.** The eight ordinary fixture families have no unapproved close/candle value differences. The new value may be more sensible for the corrected timeline; the finding is that the existing-field preservation criterion allows only the disclosed movements. A reported census of zero affected production timelines does not make these the only possible movements.

**Fix proposed, not made.** Keep the malformed-date safety fix, but preserve the existing score/reference behavior within the currently authorized delta. If changing those semantics is intended, explicitly enumerate and obtain acceptance for the additional field movements before claiming criterion 1 holds; recheck directive-window and first/final-day effects as part of that enumeration.

**Repro artifacts:** `head/_astra/core.test.js`; `evidence/core-results.json` → `timeline`.

## 2. The skipped-mode answers

**(a) Tournament battles, including their CPU participants.** The close writer checks `resolveModeConfig(battle.gameMode).label === 'tiered'`; it does not test `isCpu` (`api/_utils/filmTape/writeTapeDay.js:48`, `:84–85`). `baggerbomb_agent` is tiered; `baggerbomb_tournament` is flat6; an ordinary unknown/absent mode defaults to tiered (`src/constants/agentGameModes.js:36–42`, `:56–58`, `:81–83`). The unsupported branch writes `skipped_mode / mode_not_supported` (`api/_utils/filmTape/tapeAssemble.js:1305–1320`).

Tournament deployment uses the tournament mode for both human and CPU participants, adding `isCpu` for the latter (`api/_utils/tournamentOrchestrator.js:311–329`; `api/agent/decide.js:1495–1497`). Thus both human tournament battles and passive CPU tournament battles are skipped. An embedded CPU opponent in a player's ordinary tiered battle is a different case: that player's battle is taped. A hypothetical tiered battle with `isCpu: true` would still pass this writer's mode test. The reported 100/16 census split was not queried or independently re-counted.

**(b) The v2 skipped state.** The reviewed tree pins `FILM_ROOM_V2_MODE = 'on'` (`src/config/featureFlags.js:2991`). The route chooses v2 from the mode/admission gate without a tournament fallback (`src/screens/filmRoomV2/FilmRoomRoute.jsx:43–60`; `src/utils/filmRoomGate.js:145–147`). On a loaded `skipped_mode` tape, it renders **“This battle mode is not taped.”** (`src/screens/filmRoomV2/FilmRoomScreenV2.jsx:240`; `src/screens/filmRoomV2/filmRoomCopy.js:55`). If there is no tape yet, it shows v2's missing/pending/unavailable state instead; it does not switch to legacy because the battle is a tournament. This is source behavior, not a statement about a deployed build observed here.

## 3. Backlog and accepted dispositions

1. **Census output is not literally id-free.** VERIFIED: its write-grep gate runs before credentials/read setup, and the Firestore handle is local to `main()` (`scripts/census-film-room-b1.mjs:373–390`). Only plain copied data is passed to the computation (`:393–416`). Its normal result JSON/rendering uses ordinal battle labels, and all 11 fixture census tests pass, including owner/battle/agent-id absence. However, the CLI prints the configured **project id** at `:391`; its outer error handler prints error messages with only PEM text redacted at `:422`. Remove that project-id line and use bounded sanitized errors if “no ids” covers all CLI output. No production census was run. This does not meet any of the seven blocking criteria.
2. **Windows import-ratchet portability.** The stock §2.3 test fails at both head and base because `path.relative` produces backslashes while the exemption/baseline strings use slashes (`api/_utils/archetypeRegistry.test.js:237–263`). A separate read-only scan using the same table names and exemption list with slash normalization reports **87 importers, zero added, zero removed**. This is not a new legacy-table importer. Do not describe the unmodified Windows guard as green.
3. **Accepted, not refiled:** the known no-price-pause acceptance-B mismatches; no bars for meeting-only symbols on already-completed past candle passes; the S1 floor; S2 and the extra input keys; D−1 re-merge and live count/daily-change capture deferred to B1.1; W5/crypto coverage deferred to B2; the noon-ET expiry bug routed elsewhere. No new production mismatch class was established. The executor's 7 exits / 4 preceded / 3 not-preceded counts remain REPORTED.

## 4. Checks, platform and limits

### Executed checks

| Check | Result |
|---|---|
| Scoped branch suite: tape modules, v2 screen, registry, gate/helper/flag and census fixtures | **1,097 passed, 0 failed**, 48 files |
| v2 portion of that suite | **398 passed**, 21 files, including B1-written tapes, `none`, meeting picker series, quotation/number/sign/note sweeps, off/non-admitted legacy goldens and hub tests |
| Independent final core probes | **13 passed**: eight fixture-family comparisons, fresh/refresh draw, W2 delta, round-trip tags, size/timing/caps, volume merge |
| Independent isolation and mounted-screen probes | **4 passed**; these assert and preserve the observed failing behaviors above, not acceptance of the product |
| Independent real candle retry | **1 passed**, reproducing F2 with a base control |
| Independent shared-fetcher and normalized-ratchet probes | **2 passed** |
| Local Firestore size/writer probe | **1 passed**, including under/over controls and real-writer F3 reproduction |
| Stock import/store/flag guards | **34 passed, 1 failed**; the failure is the import-ratchet path issue reproduced on base (**19 passed, 1 failed** there) |
| Lint gate | **Passed**, zero problems; only external `_astra/**` probe files excluded |
| `vite build` | **Passed**, 3,962 modules, 44.83 seconds; existing CSS/chunk warnings |
| PR CI | **Unavailable**: the CI reader returned “Can't connect to GitHub. Try again.” on both attempts. No hosted/Linux result independently verified. |

**Platform:** Windows, PowerShell, Node `v22.20.0`, npm `11.7.0`, Vitest `4.0.17`; existing dependencies linked into the external snapshots. Java 21 and cached Firestore emulator `v1.21.0` were used for the local size test. Initial harness mistakes (multi-day date selection, a return-shape assertion and a syntax typo) were corrected in the external probes; their final results are listed separately from product findings. No tracked source was patched or mutated to obtain these results.

### Attack coverage and evidence

- **Shared module:** VERIFIED default `keepMissingVolume = false` and literal old `volume || 0` projection (`api/_utils/marketDataCache.js:796`, `:874`). Direct evaluator candles and `fetchIntradayBatch` do not opt in (`api/cron/agent-evaluate.js:780`, `:1357`; `api/_utils/marketDataCache.js:886–894`). Only the tape pass sets the option (`api/_utils/filmTape/candlePass.js:165`). Independent base/head tests covered absent/null/zero/nonfinite/negative/string/boolean volumes, normal options and the batch caller with network fetch mocked. **No changed non-tape caller output found.**
- **Tag reproducibility and rule:** VERIFIED import/call of `updateStagnationCounter`, registry-adapter thresholds, dial inputs and age arguments (`api/_utils/filmTape/tapeTags.js:57–62`, `:145–182`, `:254–273`). JSON-round-tripped inputs/checks/actions reproduce stored items and exits. A swapped `perCheck` pair throws the mismatch error; entry-only checks join by time with null sequence; the forced-swap check does not prematurely count its incoming holding. Existing reset/re-entry/fired-run tests pass. No missing recorded `actions[].exitReason === 'stagnation'` exit was found; unknown tagging remains explicitly unknown (`:87–91`, `:287–302`, `:333–355`).
- **Timing:** the largest multi-day fixture's selected day contains 40 checks, with 200 evaluations in the untruncated source battle. Across 100 calls, tagging averaged **1.022 ms**, maximum **3.314 ms**, far below the close pass's 30-second remaining-time floor / 300-second handler budget (`api/_utils/filmTape/closePass.js:51`, `:106`, `:125`). This is local fixture timing, not a hosted latency guarantee.
- **T2 hostile values:** oversized ids, instants, diagnoses and resolvers are omitted/bounded; 100 rows × 100 legs reduce to 26 rows × 2 legs; the merged-day cap also holds. Planted `BEST`/`GRADE`/`ONE` symbols outside the server roster do not reach the candle set, series, export or mounted picker in the exercised cases. The roster check is at `api/_utils/filmTape/tapeAssemble.js:768–774`, `:805–807`; client updates exclude portfolio but include meeting history (`firestore.rules:459`). The remaining capacity seam is F3.
- **Meeting candle behavior:** VERIFIED exclusion from the input fingerprint, four-symbol bound, crypto exclusion and deduplication (`api/_utils/filmTape/candleInputs.js:93–119`, `:169–172`). Core pass status excludes meeting-only missing/incomplete series (`api/_utils/filmTape/candlePass.js:622–638`). Existing inside/outside-window meeting-refresh tests pass. Independent base-written fixture refreshes made **zero candle requests** and preserved candle-owned fields exactly. No real EODHD request occurred.
- **Field diffs:** identical inputs were sent through the actual base and head close/candle passes for captured, no-trigger, budget, completed, multi-day (Sep 22), early-close, skipped-mode and pre-capture fixtures. After excluding only declared additions and exact `modernNotes` replacements, no ordinary-fixture delta remained. Series documents matched. A pre-B1 written tape from each was refreshed through the B1 merge; only the additions, wording and normal write bookkeeping moved, with no candle movement or request. Full leaf diffs are in `evidence/core-results.json`. F2 and F5 are the additional adversarial movements.
- **W1/W4:** both close-out paths and preserved legacy-note/caveat cases pass. The allowlist changes exactly the descriptions of the two existing close-out sites and names only `coverage.replay.note` / `coverage.series.note`; no site key is added. The seven-site census and protected-store scanner pass. Relevant implementations: `api/_utils/filmTape/tapeMerge.js:681–698`, `api/_utils/filmTape/candlePass.js:504`, `:829`; wording normalization at `api/_utils/filmTape/tapeMerge.js:314–321` and `api/_utils/filmTape/tapeNotes.js:86–91`. No duplicated legacy/new counted note was found in the exercised refreshes.
- **A2 boundaries:** all five sweeps were also independently run at Glance, Study, Deep dive on INTC and Deep dive on the meeting-only ORCL series, using a B1-written `none` tape. They pass, including hostile unrendered meeting text. F1 still visibly reads Draw and is counted under B1 criterion 2. Rules remain owner-read/client-write-denied at `firestore.rules:519–525`; the rules file and indexes are byte-unchanged. The full security-rules suite and a visual browser-layout pass were not rerun in this review; mounted DOM tests and source inspection are the evidence claimed.
- **Prohibited delta:** VERIFIED no diff to Firestore rules, indexes, `src/config`, `vercel.json`, or any of the eleven BUILD_RULES §1 paths. The fenced counter and flatteners are called, not edited. The supplied checkout's branch/HEAD/status remain unchanged. Git fetch updated remote-tracking metadata only.

**Limits.** This is a pinned local review, not production qualification. No claimed census figure, deployed flag state, production data distribution, Linux CI result or builder mutation count is independently certified. The T1 throw is deliberate instrumentation; the document-size repro is deliberately near capacity; F1/F5 use explicit edge-case records. Their conditions and controls are recorded above so they can be assessed without mistaking them for observed production incidents.

**Evidence bundle location:** this report lives at `docs/audits/20261014_ASTRA_REVIEW_FILM_ROOM_B1.md` under the external `film-room-b1-review` directory. Its sibling `evidence/` contains JSON results, leaf diffs, logs and the mounted draw HTML; `head/_astra/` contains the independent probes. `head-lf.tar` and `base-lf.tar` are the immutable reviewed archives. No report was placed in or committed to the supplied checkout.
