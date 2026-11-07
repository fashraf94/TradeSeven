# Build report — The Research Record Extension (for Shared Research's first slice)

**Date:** 7 November 2026 · **Built by:** Claude Code (Opus 5.5), fresh session in its own worktree, from Fable's build prompt of 7 Nov 2026 · **Base:** `origin/main` `d503dd07` (fetched first; unchanged when the final checks ran) · **Branch:** pushed as `claude/research-record-extension` (the app's local worktree branch carries a suffix, `claude/research-record-extension-ba93d4`) · **Code head:** `0b5c12dc` · **Contract note:** `docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md`

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
