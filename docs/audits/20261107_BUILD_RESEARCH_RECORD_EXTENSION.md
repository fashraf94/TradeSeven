# Build report — The Research Record Extension (for Shared Research's first slice)

**Date:** 7 November 2026 · **Built by:** Claude Code (Opus 5.5), fresh session in its own worktree, from Fable's build prompt of 7 Nov 2026 · **Base:** `origin/main` `d503dd07` (fetched first; unchanged when the final checks ran) · **Branch:** pushed as `claude/research-record-extension` (the app's local worktree branch carries a suffix, `claude/research-record-extension-ba93d4`) · **Code head:** `0b5c12dc` · **Contract note:** `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md`

> **Follow-up V2 (same day, same PR):** the four clarifications and the eleven rulings were applied after this report's §1–§11, on `main` `d09603b2` (merged in), code head `ded8808d`. **§12 records it** — what changed, the size cuts, its own review and its runs. Where §1–§11 and §12 differ (the question's rule, `symbolKeys` on host records, the summary and url caps, the eleven questions), §12 and the amended contract note govern. **The closing-rules fix** (same day, code head `e5980324`) is §12.8: 20 revisions again (746,827 bytes), adoption from an open record only, and on a Shared Research close the reason agrees with the subject.

## 0. Verdict

| What the prompt asked | What was built | State |
|---|---|---|
| `question` on the research record, set once with the subject | Built; offered anywhere else it is a typed refusal | Done |
| `findings[]`, append-only, ≤ 100, closed lists, one transaction per write | Built: `appendFinding` (store) over `buildFinding` / `findingAppendPatch` (model) | Done |
| `symbolKeys`, derived, and the `(userId, symbolKeys CONTAINS, createdAt DESC)` index | Built; host writes never add the field (a reading; question Q2) | Done; the founder deploys the index |
| Origin `shared_research`, `sharedResearchSessions`, `sr_` ids, no funnel | Built | Done |
| `summary` + `summaryRevisions[]`, ≤ 20, rev n+1 in one transaction | Built: `reviseSummary` | Done |
| Two more evidence-ref kinds, hashed canonically, server-merged only | Built; every existing version's hash unchanged (golden captured on main) | Done |
| Origin `shared_research` from the list marker, checked first | Built; every existing `originOf` case unchanged | Done |
| `exchangeId` on every newly written exchange (dialogue, analysis, screener) | Built; no reader, hash or schema check rejects it (goldens checked) | Done |
| STOP conditions (§0 of the prompt) | None hit: no fenced file edited, no fenced function called, no hash moved, no client-supplied field, no reader changed, no route/flag/rule, no production read | Clear |
| Review, runs, docs, delivery | Two lenses + a refuting verifier each; 59 planted mutants all killed; Linux full suite, `test:rules`, `lint:gate`, `vite build`, the golden guard (§9) | Done; PR opened, not merged |

**In plain terms.** A research record can now hold a question, a list of sourced facts ("findings"), and a short revisable answer. It also carries symbol keys, so a reader can find every record about one stock. An idea can now cite one item of evidence or one exchange of a conversation. Every new chat exchange in the three Forge research chats gets its own id. Nothing writes the new research-record fields yet, apart from the tests; the Shared Research route that will write them is the next Command Center build. Nothing a player sees changes.

## 1. Preamble

- `git fetch origin main` → `origin/main` = `d503dd07df76ddfb1931935111d158c944f720ae`; the worktree's HEAD was the same commit; the tree was clean. It was fetched again before the final checks and before the push: unchanged, so the branch is its own merge with `main`.
- Reading done first: `docs/BUILD_RULES.md`; `api/_utils/researchRecords/` (model, store and tests); `api/_utils/hypothesisRecords/model.js`, `store.js`, `http.js`, `carriage.js`; the three host routes; `firestore.indexes.json`; `firestore.rules`.
- **No fenced file is touched.** None of the edited files is in BUILD_RULES §1. No fenced function is called by new code (the fenced `agentBattleService.js` is read in §6 only).

### 1.1 The review's anchors, re-verified at `d503dd07` (all VERIFIED: read in this session)

| Anchor | At base |
|---|---|
| `ID_PREFIX`, `RESEARCH_WORK_ID_RE` | `api/_utils/researchRecords/model.js:65`, `:67` — `ws`, `rs`, `as`, `wl` |
| `HOST_COLLECTIONS` | `model.js:59-63` — `dialogue`, `screener`, `analysis` |
| `STAGES_BY_ORIGIN` | `src/constants/researchRecords.js:31-37` |
| `SYMBOLS_MAX` | `model.js:50` = 100 |
| `isEvidenceRef` | `api/_utils/hypothesisRecords/model.js:132-133` — only `{ kind: 'researchWork', id }`, exactly two keys |
| `ORIGINS`, `originOf` | `hypothesisRecords/model.js:54`; `:240-245` — derived from the list (and a dialogue session), never sent by a caller |
| What the content hash covers | `CONTENT_FIELDS` `:59-61` (eight fields), `contentHashOf` `:178` → `canonicalContentHash` (sorted keys) |
| Writers of a host session's `exchanges[]` | dialogue `watchlist-dialogue.js:1439` (new session) and `:1497` (`arrayUnion`); analysis `watchlist-analysis.js:598`, `:616`; screener `api/screener/chat.js:404`, `:450`. Sessions are created with `exchanges: []` (dialogue `:958`, `:1051`; analysis `:392`; screener `:199`). `workshop-chat.js` writes `workshopSessions`, which is not a research host. No other writer. |

**Drift from the review (4 Nov, `9d97b396`):** none that matters. The anchors above stand at `d503dd07`.

## 2. What was built

### 2.1 The research record (`api/_utils/researchRecords/`)

| Item | Where (head `0b5c12dc`) |
|---|---|
| `HOST_COLLECTIONS.shared_research = 'sharedResearchSessions'`; `ID_PREFIX.sharedResearchSessions = 'sr'`; `RESEARCH_WORK_ID_RE` accepts `sr_` | `model.js:92`, `:99`, `:101` |
| `RESEARCH_ORIGINS` gains `shared_research`; `STAGES_BY_ORIGIN.shared_research = []` | `src/constants/researchRecords.js:20`, `:43` |
| The closed lists: `FINDING_KINDS`, `FINDING_RECORD_KINDS` (data-only module `findingRecordKinds.js`, re-exported), `FINDING_STATUSES`, `PIN_TYPES`; the caps | `model.js:579`, `:589`; `findingRecordKinds.js` |
| `question` with the subject: `buildRecord`, `subjectPatch` (typed refusals otherwise) | `model.js:458`, `:501` |
| `buildFinding` (shape, the server's id, `asOf` rules), `findingAppendPatch` (cap, supersedes, append-only), `currentFindingsOf` | `model.js:723`, `:770`, `:784` |
| `summaryRevisionPatch` (rev n+1, cap 20, `expectedRev`, nothing overwritten) | `model.js:797` |
| `symbolKeysOf`; host writes keep existing keys fresh, never add them (`withFreshSymbolKeys`) | `model.js:677`, `:522` |
| `isInstant` (a real instant, `toISOString` spelling), `isRecordRef` | `model.js:613`, `:630` |
| `ResearchRecordError` (typed `code`) | `model.js:597` |
| `appendFinding`, `reviseSummary` — one transaction each | `store.js:148`, `:168` |
| `researchSummariesOf`: a Shared Research record comes after the list's own research and its analysis (unchanged order otherwise) | `store.js:227` |
| The index `researchWork (userId ASC, symbolKeys CONTAINS, createdAt DESC)` | `firestore.indexes.json:690-707` |

### 2.2 The idea version (`api/_utils/hypothesisRecords/`)

| Item | Where |
|---|---|
| `ORIGINS` gains `shared_research`; `SHARED_RESEARCH_LIST_MARKER = 'sourceSharedResearchSessionId'` | `model.js:68`, `:70` |
| `EVIDENCE_REF_KINDS`, `EVIDENCE_REF_KEYS`, `isEvidenceRef` (three kinds, exact keys), `canonicalEvidenceRef`, `evidenceItemRefOf`, `exchangeRefOf` | `model.js:147-182` |
| `mergeEvidenceRefs` by canonical form; `serverEvidenceRefsOf` (one malformed ref refuses the list) | `model.js:186`, `:205` |
| `buildContent` stores refs canonically | `model.js:227` |
| `originOf`: the marker first | `model.js:308` |
| `createPlayerVersion(…, serverEvidenceRefs = [])`: validated before any read, merged after the research refs | `store.js:160-161`, `:182` |

### 2.3 The host sessions

`exchangeId: randomUUID()` on each new exchange, minted when the exchange object is built (before the write): `watchlist-dialogue.js:1408`, `:1416`; `watchlist-analysis.js:597`; `api/screener/chat.js:374`, `:399`. Not gated. Stored only, never answered.

### 2.4 The Forge

`src/components/Forge/Watchlist/ideaCopy.js:265`: `LINE_STAGES.shared_research = []`. `researchLineOf` already fell back to `[]` for an unlisted origin, so this is behaviour-identical; `researchLine.test.js` requires one entry per origin.

## 3. The prompt's "must not" list, checked

| Must not | Check |
|---|---|
| Edit a fenced file / call a fenced function | `git diff --stat d503dd07..HEAD` lists no §1 file; no new call into one. |
| Change any existing version's content hash | `contentHash.golden.test.js`: every stored version and battle sibling in the fixture JSON re-hashes to its stored hash (12 found, two distinct hashes); nine cases pinned to hashes **captured by running the same case file on main's `model.js`** (LF archive of `d503dd07`); mutant M28 (a changed researchWork canonical form) turns it red. Lens B re-derived the nine on main independently: identical. |
| Let a client supply an origin, ref, finding or summary | `researchRecordExtension.routes.test.js`: each version and list route driven with an origin, refs of every kind, the list marker and the server parameter's own name in its body stores exactly what the clean request stores; a census pins that only the idea model names the marker and only the idea store names `serverEvidenceRefs`. `researchWork` stays `allow write: if false`. Mutant M37 (a route forwarding body refs) turns it red. |
| Change what any current reader shows | `recordSummaryOf` exposes none of the new fields; `LINE_STAGES` change is behaviour-identical; `researchSummariesOf` order is unchanged without a Shared Research record (pinned); prompts and history read their own keys (pinned per host: the model sees the same request with or without stored ids). |
| Add a route, a flag or a Firestore rule | None. `firestore.rules` has no diff. One index added (the prompt's). |
| Make a production read or provider call | None. All runs used doubles or the local emulator. |

## 4. Readings and build choices (each is a question in the contract note §7)

1. **Host writes never add `symbolKeys` (Q2).** The prompt says both "derived server-side on every write … existing records keep no symbolKeys until they are next written" and "nothing writes the new fields yet except tests and the exchange id". The build follows the second, the stricter: a host mint or write never adds the field; a host write recomputes it only on a record that already carries it (so it never goes stale); every extension write writes it. Consequence: the new index finds only records an extension write has reached. Lens A raised it (A1); its verifier confirmed the mechanics and called it a founder ruling. Not changed without one.
2. **Symbols from findings come only from `symbolDayEvidence` ids (Q3).** `stockBriefs/{SYMBOL}` and `setupEvidence/{session}__{SYMBOL}__{rule}` also carry one (lens A, A7).
3. **Tightenings, shipped (the letter permits them; each is a question):** findings and summary writes refuse a closed record (`record_closed`, Q4); an `asOf` later than the write time is refused as well as one equal to it; a correction chain never forks (`finding_already_superseded`); `statusReason` is a typed word, not a closed list (Q7); `basedOn` may be empty (Q5).
4. **`evidenceItem.recordKind`** uses the finding source list in full, including `exchange` and `retrieval` (Q1) — the letter names no narrower list.
5. **The store writes accept any record the caller owns (Q8)**, host records included.

## 5. Tests

| File | What it pins |
|---|---|
| `api/_utils/researchRecords/extension.test.js` (new) | Closed lists against the schema version; caps; `sr_` ids and old prefixes; the question (with the subject only, typed refusals); finding shape, the server's id, every closed list, `asOf`, `retrieval` url, real instants, pins, status reasons; append-only, supersedes, the 101st; symbol keys (derivation, cap, host behaviour); summary (rev, 21st, conflict, nothing overwritten, corrupt records refused); the Forge summary order; the data-only list module; no escaped quote in table E's files; the store's transactions on the optimistic double, including concurrent appends and revisions |
| `api/_utils/hypothesisRecords/evidenceRefs.test.js` (new) | The three ref kinds, canonical keys, every malformed shape refused; merge; `serverEvidenceRefsOf`; `createPlayerVersion` with and without server refs (refused before any read); `originOf` with the marker first and every existing case unchanged |
| `api/_utils/hypothesisRecords/contentHash.golden.test.js` (new) + `__fixtures__/contentHashCases.js` | §3 row 2 |
| `api/forge/exchangeId.test.js` (new) | Per host and gate state: new sessions' ids; legacy entries untouched; the model sees the same request with or without stored ids; a retried transaction re-sends the same objects (compared with the abandoned attempt's buffered write); ids distinct across turns |
| `api/forge/researchRecordExtension.routes.test.js` (new) | §3 row 3 |
| `test/rules/researchRecordExtension.rules.mjs` (new, emulator) | Two concurrent appends land; at 98 both land; at 99 one lands and one is `findings_full`; five at once all land; two concurrent revisions give rev 2 and 3; with `expectedRev` one lands and one is `summary_conflict`; `arrayUnion` of a re-sent exchange stores it once; the query the index serves |
| `api/_utils/researchRecords/rulesIndex.test.js` (changed) | Two `researchWork` composites, exactly |
| `api/_utils/researchRecords/model.test.js` (changed) | The per-origin stage table gains `shared_research: []` |

## 6. The goldens and the exchange id

The P2 gate-off golden (`api/forge/researchRecords.gateOff.test.js`) and the dialogue parse goldens (`watchlist-dialogue.parseBindingOffGolden.test.js`, `watchlist-dialogue.parseBinding.test.js`, via `api/_utils/__fixtures__/dialogueHarness.js`) hash every store write, captured on main before this build. The exchange id is written whatever the gate (the prompt's item 8), so those writes now differ by it. Rather than recapture, each trace goes through `api/_utils/__fixtures__/exchangeIds.js`: every exchange a write adds must carry a v4 UUID (distinct within the write), and only then is the id removed — so everything else must still equal main's capture byte for byte. The fixture files and `GOLDEN` digests are unchanged. The helper is self-contained, so a recapture on main still works.

That the strip hides nothing else was attacked by lens B (six plants: a dropped timestamp, two key-order swaps, a field written outside `exchanges[]`, ids back-filled onto legacy exchanges, a non-v4 id — every one turned the goldens red) and by mutants M40 and M41.

**The fence, for the record (lens B, B5).** A version carrying an `evidenceItem` or `exchange` ref or origin `shared_research` would flow unchanged through the carriage's `siblingOf` into the fenced battle document's `equippedHypothesis` (`agentBattleService.js:227`, `:229`). This build creates no such version (no production caller of the new helpers, no `shared_research` mint, `carriage.js` and `buildSaveVersion` byte-identical, 9/9 siblings identical main vs branch), so nothing reaching the fence changes now. The Shared Research route will: question Q10.

## 7. Guards touched

| Guard | Change | Why |
|---|---|---|
| `api/_utils/setupEvidence/setupEvidenceImportGuard.test.js` | Allowlist gains `api/_utils/researchRecords/findingRecordKinds.js` and `extension.test.js` | The prompt's closed list contains the collection name `setupEvidence`, which the guard counts. The list lives in a data-only module (review B1) so the listing covers no code; `extension.test.js` pins that the module holds the one frozen list and nothing else (mutant F09), and the model itself is not listed (mutant F10). |
| `api/_utils/compositionProtectedStoresAllowlist.json` | `researchRecords/store.js::appendFinding::update::unresolved` and `::reviseSummary::update::unresolved`, 1 each, with a human-review note | The deny-by-default scan reads the two new `tx.update` calls on `researchWork` as unresolved handle-form writes; `researchWork` is not a composition-protected store. The P1a and P2 precedent. Found by the first full Linux run. |

## 8. Review (BUILD_RULES §2: 25 files, ~2,060 lines at the code head)

Two lenses, each on its own LF `git archive` of `f122cfad` (read-only on git and the working tree), then one refuting verifier per lens on its own snapshot. Reviewers returned text; this coordinator applied every fix.

### Lens A — the record (findings A1–A12; A13 = tightenings)

| Id | Finding | Verifier | Disposition |
|---|---|---|---|
| A1 | Host writes never add `symbolKeys`, so the index cannot find host research | CONFIRMED (mechanics) — a ruling | Not changed; question Q2 |
| A2 | `isInstant` accepted 30 Feb, 31 Apr, 24:00 and a second spelling | PARTLY (both halves real; the spelling half latent) | **Fixed**: a real instant in the one `toISOString` spelling (F01, F02) |
| A3 | A question offered after the subject was silently dropped; `question_already_set` unreachable | PARTLY (the silence is the old `{}` contract) | **Fixed**: typed `question_after_subject` / `question_already_set` / `question_without_subject` (F03) |
| A4 | Shared Research records ranked as the list's own research and, at 19–20, pushed its own and its analysis past the cap | CONFIRMED (latent) | **Fixed**: they come last (F04) |
| A5 | Two escaped quotes opened a hole in table E's scan | CONFIRMED | **Fixed**: reworded; a row pins no escaped quote (F05) |
| A6 | A corrupt stored list was overwritten; a summary disagreeing with its revisions passed | CONFIRMED (note) | **Fixed**: `record_unreadable` / `summary_unreadable` (F06, F07) |
| A7 | `stockBriefs` and `setupEvidence` ids carry symbols too | not sent separately (same question as A1) | Question Q3 |
| A8 | A question mint on a host origin wrote no `symbolKeys`, a subject patch with a question did | CONFIRMED (note) | **Fixed**: any question mint carries them (F08) |
| A9 | The store writes accept host-origin records | CONFIRMED (note) | Question Q8 |
| A10 | At a full cohort a finding's symbol is left out of the keys | CONFIRMED (note) | Question Q3; recorded in the contract |
| A11 | `…_BRK.B` and `…_BRK-B` both accepted for one record | CONFIRMED (note) | Question Q9 |
| A12 | At every cap with 3-byte text the record nears Firestore's 1 MiB | CONFIRMED (fits: ~1,045,000 B) | Recorded in the contract (§2.6) |
| A13 | `record_closed`, `asOf` later refused, no forked corrections — beyond the letter | (not defects) | Questions Q4 and §4.3 |

Lens A's two "could not verify" items were scope gaps in its brief, not findings: the exchange id is the prompt's item 8, and the contract note was written but not yet committed.

### Lens B — compatibility (findings B1–B6)

| Id | Finding | Verifier | Disposition |
|---|---|---|---|
| B1 | The guard listing covered the whole model file: a real store import planted there passed | CONFIRMED | **Fixed**: data-only module listed instead; shape pinned (F09, F10) |
| B2 | Nothing pinned exchange-id uniqueness across turns: a constant id per host passed everything | CONFIRMED | **Fixed**: a two-turn row per host (F11–F13) |
| B3 | The retry row could not fail if the id were minted per attempt | CONFIRMED (low) | **Fixed**: compares the abandoned attempt's buffered write (F14, F15) |
| B4 | `sr_` refs main refused are now accepted | CONFIRMED (note; intended, not caller-reachable) | Recorded |
| B5 | New ref kinds / origin would reach the fenced battle doc once carried | CONFIRMED (note; not in this build) | Question Q10 (§6 above) |
| B6 | A replayed `opId` with different server refs returns the earlier version | CONFIRMED (note; unreachable today) | Question Q11 |

**Split:** 18 findings filed (A1–A12, B1–B6) plus A13's three tightenings. **None refuted.** 15 CONFIRMED, 2 PARTLY (A2, A3); A7 was not sent to the verifier on its own (it is the same question as A1/Q3, and its two id formats were read at `stockBriefService.js:49` and `setupEvidence/key.js` `snapshotIdOf`). Nine fixed (A2, A3, A4, A5, A6, A8, B1, B2, B3), each with its own mutant; the rest are notes or founder questions. Every claim the lenses attacked and that held is in their reports (concurrency on the double, nothing written on refusal, exact keys, no undefined reaching a write, the hash, the strip, every exchange reader, the marker's writers, the origin enumerators).

### Mutation lens (its own snapshots; judged by exit code and failed-test count, files restored and verified by SHA-256)

- **44 mutants** over the build at `f122cfad` — caps, append-only, supersedes, `asOf`, retrieval url, symbol keys (form, dedupe, cap, host add, staleness), summary (rev, overwrite, conflict), ids, the question, statuses, the server's finding id, closed records, the owner check, reads outside the transaction (appends and revisions), ref keys, canonical order, the new kinds' fields, the researchWork hash, null item ids, exchange collections and UUIDs, the marker's precedence and type, silent ref drops, validation order, ref merging, a route forwarding body refs, each host's exchange id, the strip hiding a changed field, the index, the Forge table, the stage table: **44 killed**. Re-run on the fixed head: 44 killed (M17 re-targeted at the line the fix rewrote).
- **15 mutants** for the fixes (F01–F15): **15 killed**.

## 9. Runs (Linux, CI-shaped: WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `npm ci` from the branch's lockfile, a private worktree of `~/pd-ci`)

`origin/main` did not move during the build (`d503dd07` at the start, before the final checks and before the push), so the code head is its own merge with `main` (BUILD_RULES §3; CI tests the merge ref).

| Run | Head | Result |
|---|---|---|
| Full suite, `npx vitest run --maxWorkers=8` (under the machine's suite lock) — first run, before review | `f122cfad` | 1 failed / 28,782 passed / 89 skipped (1,307 files). The one red row was the protected-store write census (§7): fixed in `2a79d0d7`. |
| **Full suite**, same command | **`0b5c12dc`** | **0 failed / 28,796 passed / 89 skipped** (1,299 files passed, 8 skipped; 277 s) |
| **`npm run test:rules`** (Firestore emulator, Temurin Java 21) | **`0b5c12dc`** | **33 files, 637 rows passed** (the new `researchRecordExtension.rules.mjs` among them; it also passed 8/8 alone on Windows) |
| **`npm run lint:gate`** | **`0b5c12dc`** | **exit 0** (also exit 0 at `f122cfad`) |
| **`vite build`** | **`0b5c12dc`** | **exit 0** (also at `f122cfad`) |
| **The golden guard** (`scripts/ci/tf-setup-golden-guard.mjs`, as the pull-request event: base `d503dd07`, head the commit) | **`0b5c12dc`** | **PASS**, mode compare: golden and semantics unchanged against the base |

The docs commit that follows changes only `docs/`; the same five checks were run again on that exact pushed head (the PR description records them).

## 10. Found outside the task (reported, not fixed — BUILD_RULES §3)

1. `api/_utils/__fixtures__/callsFirestore.js:75` applies `arrayUnion` without Firestore's dedupe of equal elements (lens B). Suites relying on the double cannot see a duplicated union; the emulator row covers the real behaviour for exchanges.
2. Table E's extractor (`api/_utils/researchRecords/model.test.js:333`) never scans double-quoted literals (lens A). Nothing in the scanned files uses one today.
3. `api/forge/researchRecords.gateOff.test.js:70` has an unused `during` (default `eslint`, not the gate; present on main at `:67`).
4. On Windows, `api/forge/parse-signal.test.js` failed three rows once under a 58-file parallel run and passed 34/34 twice alone; the Linux runs are the record.
5. `workshop-chat.js` exchanges (`workshopSessions`) carry no id; that collection is not a research host, so it is outside item 8.

## 11. Founder's steps

1. Read §4 and the contract note's §7 (eleven questions), especially Q2 (symbol keys on host records) and Q10 (the fence, before the Shared Research route carries a version into a battle).
2. Merge when satisfied (CI: `vitest (unit)` and `firestore rules + emulator suites`).
3. **After merge, deploy the new `researchWork` index** (`firebase deploy --only firestore:indexes`). No rules deploy is needed.
4. After deploy, the exchange id starts appearing on new exchanges in `watchlistSessions`, `researchSessions` and `analysisSessions`; old exchanges keep none. Nothing a player sees changes.

## 12. The follow-up V2 — the four clarifications and the eleven rulings (7 Nov 2026)

Fable's follow-up V2 ("the four clarifications and the eleven questions", same day) was run in this same session on the same branch and PR, before merge. It superseded an earlier follow-up that was never run. §1–§11 above describe the build at `693ee59a`; this section is what changed after it. The contract note was amended in place (it is still version 1 and unmerged; its §9 lists every change and its §10 the items left for the Shared Research route).

### 12.0 Verdict

| What V2 asked | Done | Where (head `ded8808d`) |
|---|---|---|
| §1.1 `question` independent of the subject; `questionPatch`; `subjectPatch` exactly `main`'s; `question_missing` on a completed Shared Research close | Done | `api/_utils/researchRecords/model.js:470` (`buildRecord`), `:509`, `:530`, `:569` |
| §1.2 `stockRankings`, `peerRankings`, `researchWork` sources; `researchWork` never the record itself; `exchange` ids are v4 UUIDs | Done | `findingRecordKinds.js:20`; `model.js:679`, `:843` |
| §1.3 summary text 1,000 characters | Done | `model.js:592` |
| §1.4 `concluded`, only a Shared Research record closing `completed` | Done (also at a closed mint, review V2A-2) | `model.js:117`, `:489`, `:574` |
| Q1 `EVIDENCE_ITEM_RECORD_KINDS` without `exchange` and `retrieval` | Done | `model.js:633`; `hypothesisRecords/model.js:176` |
| Q2/Q8 extension fields on `shared_research` only (`wrong_origin`); every Shared Research write writes `symbolKeys`; no host ever gets them | Done | `model.js:520`, `:825` |
| Q3 a finding's explicit `symbol`; keys = current findings, then the cohort | Done | `model.js:749`, `:727` |
| Q5 `basedOn` 1–25 current findings | Done | `model.js:601`, `:887` |
| Q10 the `equippedHypothesis` census; 30 server refs at most | Done (census widened by review V2B-1) | `hypothesisRecords/equippedHypothesisRefs.census.test.js`; `hypothesisRecords/model.js:164`, `:220` |
| Q11 document the fingerprint | Done | contract §3.1 |
| Q4, Q6, Q7, Q9 kept | No change | — |
| §3 size ≤ 1,000,000 bytes | **Both named cuts made**: revisions 20 → 10, urls 2,048 → 1,024; 706,217 bytes | `model.js:599`, `:610`; `size.test.js` |
| §4 `STATE_REASONS.sharedResearchCompleted` and `buildSharedResearchVersion` | Done | `src/constants/hypothesisRecords.js:81`; `hypothesisRecords/model.js:395` |
| Stays unchanged: existing content hashes, gate-off and dialogue goldens, every host write, `carriage.js`, `buildSaveVersion` | Held (§12.4) | — |
| STOP conditions | None hit | — |

### 12.1 Preamble

- PR #1030 was open but **CONFLICTING**: `main` had moved to `d09603b2` (PR #1029, Armory A2). It was brought up to date with the app's base-branch sync (a merge, never a force). One conflict: both sides had appended a notes block to `api/_utils/compositionProtectedStoresAllowlist.json`; both were kept (merge commit `34b211d3`). That allowlist was the only file both sides changed. `main` also gained an `array-contains` filter in the Firestore double (`callsFirestore.js`), which this build's rows don't depend on.
- `origin/main` was fetched again before the final runs and before the push: still `d09603b2`.
- The follow-up's own diff (`34b211d3..ded8808d`): 13 files, +1,079 / −237 lines, over the BUILD_RULES §2 threshold, so it had its own review (§12.5).

### 12.2 Readings

1. **"subject" in the symbol-key list vs `subjectPatch` as on `main`.** V2 lists "subject" among the Shared Research writes that write `symbolKeys` fresh, and also says `subjectPatch` behaves exactly as on `main` for every origin. The build keeps `subjectPatch` exactly `main`'s. A subject set through `closePatch` writes the keys; a subject set alone writes none. It cannot leave them stale, because the keys depend only on findings and the cohort. Outside tests, `subjectPatch` is called only from `closePatch` (verifier V2A). Contract §10 Q1.
2. **The size rule's map reading.** Firestore's page says a map's size is "calculated the same way as document size", and a document adds 32 bytes. The page has no worked example with a map. The test reads it literally: a map counts its own 32 bytes. This is the cautious reading, and it decided the second cut (§12.3).
3. **Fields the model does not bound.** `terminalReason`, `userId` and `watchlistId` have no cap in the model; their writers bound them. The size test uses the longest each writer produces (contract §10 Q9).

### 12.3 Size (V2 §3)

| Measured (Firestore's documented rules) | Bytes | Action |
|---|---|---|
| First test: 20 revisions, 2,048-character urls (a narrower record; maps without their 32) | 1,010,671 | over → first named cut, **revisions 20 → 10** |
| After review V2A-1 widened the test: every cap full (40 telemetry screens × 40 symbols, both cohort flags, 75 corrections, the most-bytes url, a 3-byte uid, the longest host reason), maps with their 32; 10 revisions | 1,013,417 | still over → second named cut, **urls 2,048 → 1,024** |
| **Both cuts** | **706,217** | within the rule; pinned |
| For the record: 20 revisions with 1,024-character urls | 746,827 | would also fit (contract §10 Q6, a founder call) |

No other cut was made. Verifier V2A reproduced 1,013,417 exactly with its own sizer.

### 12.4 What stayed unchanged (checked)

- **Every existing content hash.** `contentHash.golden.test.js` (main-captured) passes. Lens V2B also re-ran the nine cases on `main` `d09603b2`: all identical. Across 230 refs, none that `main` accepted is now rejected.
- **The gate-off and dialogue goldens.** Their files are untouched by the follow-up, and they pass.
- **Every host write.** Lens V2B compared `buildRecord`, `turnPatch`, `closePatch`, `subjectPatch`, `recordSummaryOf`, `isOwnedRecord` and `researchSummariesOf` with `main`'s research model over 123,146 comparisons. The only differences are two refusals no host reaches: `concluded` and a mint with a question. The abandon route closes only for `user_close`, `watchlists.js` passes `TERMINAL_REASONS` constants, and no host passes a question.
- **`carriage.js`, `buildSaveVersion` and every fenced file** are byte-identical to `main`.
- **The Q10 ruling's facts** were re-verified at this head: `agentBattleService.js:217-229` copies verbatim, and the three named readers read only the three provenance fields. The review found one more reader: the carriage's value-blind re-hash (V2B-2), now recorded as an allowed read.

### 12.5 The follow-up's review (ids V2A-n, V2B-n; fresh LF snapshots of `d0399c1d`; a refuting verifier per lens)

| Id | Finding | Verifier | Disposition |
|---|---|---|---|
| V2A-1 | The size test missed caps (telemetry screens and more) and took the map rule's less cautious reading | CONFIRMED (1,013,417 reproduced) | **Fixed**: widened test; second named cut; pinned (H04–H06) |
| V2A-2 | A record minted already closed skipped `question_missing` and `invalid_terminal_reason` | CONFIRMED | **Fixed** (H01, H02) |
| V2A-3 | The builder never tied `watchlistId` to the list | CONFIRMED | **Fixed**: `list_not_from_session` (H03) |
| V2A-4 | The fingerprint covers the raw request; content is normalized | CONFIRMED (note) | Contract §10 Q2 |
| V2A-5 | The builder adopts a record in any state | CONFIRMED (note) | Contract §10 Q3 |
| V2A-6 | `concluded` is accepted with a subject | CONFIRMED (note) | Contract §10 Q5 |
| V2A-7 | A corrupt `findings` is answered `invalid_kept_findings` | CONFIRMED (note) | Contract §10 Q10 |
| V2A-8 | Stale comments in the model | CONFIRMED (one more found) | **Fixed** |
| V2A-letter | "subject" vs `subjectPatch` as on `main` | Behaviour confirmed; cannot go stale | §12.2 reading 1 |
| V2B-1 | The census missed rename-destructures, multi-declarator aliases, nested patterns, the `carriedSiblingOf` accessor, whole-object exposure and fixtures | CONFIRMED (14 forms missed) | **Fixed**: widened detector, a planted row per form (H07–H12) |
| V2B-2 | The carriage's re-hash reads the sibling's every field; the census inventory did not record it | CONFIRMED | **Fixed**: listed as an allowed, value-blind whole read |
| V2B-3 | The 30-ref cap is per batch, not per version | CONFIRMED (note) | Comment fixed; contract §10 Q4 |
| V2B-4 | Two refusals are new on host records, but unreachable | CONFIRMED (note) | Recorded (§12.4) |
| V2B-5 | `noResearchRecorded` on a `shared_research_completed` version | CONFIRMED (note, future data) | Contract §10 Q7 |

**Split:** 13 findings plus one reading question. None refuted. Six fixed (V2A-1, V2A-2, V2A-3, V2A-8, V2B-1, V2B-2), plus the V2B-3 comment. The rest are notes or questions for B1.

**Mutation lens:**
- **36 mutants (G01–G36)** over the follow-up's rules, on their own snapshot of `d0399c1d`: all killed. Re-run on the fixed head: all killed (G06 re-targeted at `closePatch`'s line, because the same rule now also lives in `buildRecord`).
- **12 mutants (H01–H12)** for the review fixes, including each census form planted in the real files: all killed.
- Every mutated file was restored and checked against the commit.

### 12.6 Runs (Linux, WSL Ubuntu, Node 20.20.2, `TZ=UTC`, `npm ci`, a private worktree of `~/pd-ci`)

`origin/main` stayed at `d09603b2`, which the branch had merged at `34b211d3`, so the code head is its own merge with `main`.

| Run | Head | Result |
|---|---|---|
| **Full suite**, `npx vitest run --maxWorkers=8` (under the machine's suite lock, the host quiet) | **`ded8808d`** | **0 failed / 29,100 passed / 89 skipped** (1,314 files passed, 8 skipped; 351 s) |
| **`npm run test:rules`** (Firestore emulator, Temurin Java 21) | **`ded8808d`** | **33 files, 639 rows passed** (`researchRecordExtension.rules.mjs` among them, its summary revisions now resting on a finding) |
| **`npm run lint:gate`** | **`ded8808d`** | **exit 0** |
| **`vite build`** | **`ded8808d`** | **exit 0** |
| **The golden guard** (as the pull-request event: base `d09603b2`, head the commit) | **`ded8808d`** | **PASS**, mode compare: golden and semantics unchanged against the base |

The docs commit that follows changes only `docs/`; the same five checks were run again on that exact pushed head (the PR description records them).

An early full suite at `d0399c1d`, run while the reviewers and the mutants were loading the same host, had one red row: `src/components/League/leagueRawIds.guard.test.jsx`, a file this build does not touch, at 5.9 s against its 5 s timeout. That is the known host-load pattern; the quiet final run is the record.

### 12.7 Founder's steps (replacing §11's first step)

1. Read the contract note's §10 (ten items for B1), especially Q6 (20 revisions would fit now that urls are 1,024) and Q4 (the merged-total ref cap).
2. Merge when satisfied.
3. **After merge, deploy the new `researchWork` index** (`firebase deploy --only firestore:indexes`). No rules deploy is needed.

### 12.8 Addendum — the three closing rules before merge (7 Nov 2026)

Fable's fix "three closing rules before merge" was run in this session on the same branch and PR, on head `2026f1cd`. Code commit `e5980324`: 5 files, +100 / −11 lines, under the BUILD_RULES §2 threshold, so no review round; one planted mutant or more per rule. The contract note's §9.1 lists the changes; its §10 marks Q3, Q5 and Q6 settled and Q4 deferred.

| The fix asked | Done | Where |
|---|---|---|
| `SUMMARY_REVISIONS_MAX` back to 20; urls stay 1,024; the 21st refused; the size test pins the new figure and still asserts ≤ 1,000,000 | Done: **746,827 bytes**, pinned | `api/_utils/researchRecords/model.js:619`, `:897`; `size.test.js` |
| Adoption needs an open investigation (`record_not_open`) | Done | `api/_utils/hypothesisRecords/model.js:412` |
| On a `shared_research` record, in `closePatch` and in a mint already closed: `concluded` with a subject, and `saved_to_list` without one, are `invalid_terminal_reason`; host origins unchanged | Done | `model.js:516` (the rule), `:492` (the mint), `:595` (the close: the record's list, or the one this close sets) |
| Q4, a version's total refs | Not changed: deferred, trigger recorded (contract §10 Q4) | — |

**Tests.**
- The 20th revision lands and the 21st is refused.
- The builder refuses a completed, an abandoned and a failed record.
- Shared Research closes: `concluded` with a subject refused (set by the close, or already on the record); `saved_to_list` without one refused in each terminal state, including with a subject that sets no list. Both rules also hold for a mint already closed.
- The host sweep is extended: `main`'s `closePatch`, copied verbatim into the test, is compared with this one over 5 host origins × 2 records (with and without a list) × 3 terminal states × 5 reasons × 3 subjects. That is 450 comparisons, all equal. A host mint already closed `saved_to_list` without a list is still accepted.
- Targeted run: 24 files, 855 rows passed.

**Mutants (C01–C14)**, on a fresh LF snapshot of `e5980324`, after an unmutated control run (19 files, 534 passed). All 14 were killed, and each mutated file was restored and checked against the commit by SHA-256:
- the cap at 10, at 21, and off by one;
- each subject check removed;
- the mint-side call and the close-side call dropped;
- the close ignoring the subject it sets, or the list the record already names;
- the rule widened to host origins;
- the mint reading every record as having a subject;
- `record_not_open` dropped, narrowed to `completed` only, or answered with another code.

**Runs.** The five checks (full suite, `test:rules`, `lint:gate`, `vite build`, the golden guard) ran on Linux on the exact pushed head, which carries this addendum. The PR description records the results.

**Founder's steps** (replacing §12.7's first step):
1. Read the contract note's §10. Q3, Q5 and Q6 are settled. Q4 is deferred until the first route passes server refs to `createPlayerVersion`. Q1, Q2 and Q7–Q10 are for B1.
2. Merge when satisfied.
3. After merge, deploy the `researchWork` index (`firebase deploy --only firestore:indexes`).
