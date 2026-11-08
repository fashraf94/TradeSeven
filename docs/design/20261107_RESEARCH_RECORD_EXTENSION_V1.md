# The Research Record Extension — contract V1

**Date:** 7 November 2026 · **Built by:** Claude Code, from the build prompt "The Research Record Extension (for Shared Research's first slice)" and its follow-up V2 "the four clarifications and the eleven questions" (Fable, framework chat, both 7 Nov 2026) · **Base:** `main` `d503dd07`, then `main` `d09603b2` merged before the follow-up · **Build report:** `docs/audits/20261107_BUILD_RESEARCH_RECORD_EXTENSION.md`

This note gives the exact shapes Shared Research's first slice ("work an idea"; concept `SHARED_RESEARCH_WORK_AN_IDEA_CONCEPT_V1`) specs against. It records what was built, not a proposal. It is still version 1 and unmerged: the follow-up amended it in place, and §9 lists every change the follow-up made.

## 0. In plain terms

A **Shared Research** investigation is a research record (`researchWork/{id}`, origin `shared_research`). It starts from a **question**, collects **findings** (each fact with where it came from, which stock it is about, and how sure it is), and keeps a short **summary** that can be revised. It carries **symbol keys** so a reader can find every investigation about one stock. When the player adopts the investigation, a pure builder makes the idea's first version, already `researched`, citing the investigation, the findings the player kept and the exchange where they confirmed. An idea version can now cite a single item of evidence or a single exchange of a conversation. Every new chat exchange gets its own id.

These fields belong to Shared Research records only. No other research record ever carries them, and nothing writes them yet except tests: the Shared Research route that will is the Command Center arc's next build (B1). The exchange id is the one live change: the three Forge host routes write it on every new exchange.

Every new field is written by the server. No route accepts a question, finding, summary, symbol, symbol key, origin or evidence ref from a client.

## 1. Where the code is

| What | Where |
|---|---|
| The record's vocabulary (origins, stages) | `src/constants/researchRecords.js` |
| The record's model: shapes, closed lists, caps, patches | `api/_utils/researchRecords/model.js` (the finding source list lives in the data-only `findingRecordKinds.js`, re-exported by the model) |
| The record's store: the two extension writes | `api/_utils/researchRecords/store.js` (`appendFinding`, `reviseSummary`) |
| Evidence refs, origins, the content hash, the adoption builder | `api/_utils/hypothesisRecords/model.js` |
| The idea's state reasons | `src/constants/hypothesisRecords.js` (`STATE_REASONS.sharedResearchCompleted`) |
| The version store's server-ref parameter | `api/_utils/hypothesisRecords/store.js` (`createPlayerVersion`) |
| Exchange ids | `api/forge/watchlist-dialogue.js`, `api/forge/watchlist-analysis.js`, `api/screener/chat.js` |
| The index | `firestore.indexes.json` |

Each closed list below is defined once in the model and, once records are stored, grows only with a new `RECORD_SCHEMA_VERSION`. `api/_utils/researchRecords/extension.test.js` pins every list against the schema version (version 1 is this note; the follow-up amended version 1 in place because nothing had been stored).

## 2. The research record (`researchWork/{id}`)

### 2.0 Which records carry the extension fields

`question`, `findings`, `summary`, `summaryRevisions` and `symbolKeys` belong to **`shared_research` records only**. `appendFinding`, `reviseSummary`, `questionPatch` and a mint with a question refuse any other origin (`wrong_origin`). Every write to a host-origin record (`signaldrop`, `theme`, `screener`, `analysis`, `manual`) is exactly what it was on `main`.

### 2.1 `question`

| Rule | Value |
|---|---|
| Type | string, at most 500 characters (`QUESTION_MAX_LEN`); outer whitespace dropped; never empty (`invalid_question`) |
| When written | at mint (`buildRecord({ origin: 'shared_research', question, … })`) — **no subject needed**: an investigation starts from a question, and the subject comes later, at adoption — or **once later** through `questionPatch(record, { question, atIso })` |
| Never | changed after it is set (`question_already_set`); on a closed record (`record_closed`); on any other origin (`wrong_origin`) |
| Completing | a `shared_research` record cannot close `completed` without its question (`question_missing`); closing `abandoned` or `failed` needs none. The same holds for a record minted already closed (`buildRecord` with a terminal `state`). |
| The subject | `subjectPatch` is exactly `main`'s for every origin and never carries a question |
| On other records | absent: a record written without a question has no `question` key at all |

A different question is a different investigation, so it is a different record.

### 2.2 `findings[]`

Append-only. At most 100 (`FINDINGS_MAX`). Each item is exactly these keys, in this order:

```
{ findingId, kind, symbol, fact, source: { recordKind, recordId, label, url? }, at, asOf, status, statusReason, pin, supersedes }
```

| Field | Rule |
|---|---|
| `findingId` | minted by the store: `f_` + `crypto.randomUUID()` (a v4 UUID, lower case). A caller-sent `findingId` is refused (`invalid_finding`). |
| `kind` | one of `earnings_fact`, `release`, `coverage`, `check_receipt`, `setup`, `idea`, `observation`, `product`, `relationship`, `inference`, `next_action` |
| `symbol` | `null`, or one symbol in key form (upper case, hyphen: `BRK-B`), set by the server's writer (`invalid_symbol` otherwise). A `symbolDayEvidence` finding with a `null` symbol takes its id's symbol (in key form); one naming a different symbol is refused (`invalid_symbol`). |
| `fact` | string, 1–500 characters (`FINDING_FACT_MAX_LEN`), outer whitespace dropped |
| `source.recordKind` | one of `symbolDayEvidence`, `fantasyTimesWire`, `fantasyTimesStories`, `ingestedClaims`, `stockBriefs`, `estimatesCache`, `setupEvidence`, `activationPointer`, `call`, `hypothesisVersion`, `exchange`, `kb`, `retrieval`, `stockRankings`, `peerRankings`, `researchWork` |
| `source.recordId` | printable string, 1–256 characters (`RECORD_ID_MAX_LEN`). Three kinds have their own shape: `symbolDayEvidence` — `{etDate}_{SYMBOL}` on a real date (the symbol may use `.` or `-`; both spellings give one key); `researchWork` — a research record id (`isResearchWorkId`), citing an **earlier** investigation, never the record itself (`invalid_source`); `exchange` — the exchange's own `exchangeId`, a v4 UUID, of the record's own host session (the model checks the shape; the route checks the exchange exists). |
| `source.label` | string, 1–120 characters (`SOURCE_LABEL_MAX_LEN`), outer whitespace dropped |
| `source.url` | an `http(s)` URL of at most **1,024** characters (`SOURCE_URL_MAX_LEN`, cut from 2,048 by the size rule, §2.7). **Required** for `retrieval` (`retrieval_needs_url`). Optional otherwise; **absent (no key)** when not given, never `null` in storage. |
| `at` | the fact's own instant, exactly as `Date.prototype.toISOString()` writes it (`YYYY-MM-DDTHH:MM:SS.mmmZ`, milliseconds always) and a real calendar instant (it must round-trip). It may be ahead of the write (a scheduled release). |
| `asOf` | when the source knew it, in the same instant form, or `null`. Absent → `null`, **never the write time**. An `asOf` equal to or later than the write time is refused (`as_of_not_before_write`). |
| `status` | `verified`, `unverified` or `unavailable` |
| `statusReason` | `null` when `verified`; otherwise a typed word, `^[a-z][a-z0-9_]{0,63}$` (for example `single_source`). The route owns the reasons it writes; the screen shows each with a generic fallback. |
| `pin` | `null`, or exactly `{ type: 'price', value }` with a positive finite number, or `{ type: 'time', value }` with an instant (the `at` form) |
| `supersedes` | `null`, or the `findingId` of an earlier finding **on the same record** that no other finding already supersedes (a correction chain never forks; correct the correction instead) |

A correction is a new finding whose `supersedes` names the earlier one. Nothing is edited or removed. `currentFindingsOf(record)` gives the findings no later finding supersedes, in record order. A closed record refuses findings (`record_closed`): a finished investigation is read-only, and refreshing one starts a new investigation that cites the old one as a `researchWork` finding.

### 2.3 `symbolKeys[]`

Derived on the server, never supplied: the **current findings' `symbol`s in record order** (a superseded finding's symbol no longer counts), then the record's `symbols[]` (each entry's `symbol`), as keys — upper case, hyphen form (`BRK.B` → `BRK-B`, the `symbolNormalize.js` convention), each once, at most `SYMBOLS_MAX` (100). A value that is not a symbol (`^[A-Z0-9][A-Z0-9-]{0,11}$` after the hyphen form) is dropped. No record id is parsed: a finding names its symbol explicitly. At 100, a finding's symbol is kept before the cohort's.

Every write to a `shared_research` record writes them fresh from the record as that write leaves it: the mint, `questionPatch`, `turnPatch` (and `recordTurnOutcome`), `closePatch` (with its subject), a finding append, a summary revision. A subject set alone (`subjectPatch`) changes neither the findings nor the cohort, so the keys it leaves are the keys already stored. **No other origin's record ever gets the field**: no host mint or patch adds it (pinned by a behavioural sweep over every host origin and a census: no non-test file but the research model names `symbolKeys`). The symbol query therefore finds Shared Research investigations only; indexing host research is a separate task if a reader ever needs it.

**Index:** `researchWork` (collection scope) `userId ASC, symbolKeys CONTAINS, createdAt DESC`. The query it serves: `where('userId','==',uid).where('symbolKeys','array-contains',KEY).orderBy('createdAt','desc')`. The founder deploys it after merge.

### 2.4 `summary` and `summaryRevisions[]`

```
summary = { rev, text, at, basedOn: [findingId] }
```

| Rule | Value |
|---|---|
| `text` | 1–1,000 characters (`SUMMARY_TEXT_MAX_LEN`), outer whitespace dropped |
| `at` | the write time (the revision's own instant) |
| `basedOn` | 1–25 (`BASED_ON_MAX`) **current** findings of the record, each once. Empty, more than 25, a repeat or a malformed id → `invalid_based_on`; an id the record does not hold → `based_on_unknown`; a superseded one → `based_on_superseded`. |
| `rev` | the number of revisions before it + 1 (the first is 1). The stored `summary` must equal the last stored revision (key order aside) — or be absent when there is none — or the write is refused (`summary_unreadable`). |
| One write | the revision is appended to `summaryRevisions[]` **and** becomes `summary`, in one transaction |
| Cap | **10** revisions (`SUMMARY_REVISIONS_MAX`, cut from 20 by the size rule, §2.7); the 11th is refused (`summary_revisions_full`) |
| Concurrency | two concurrent revisions land as rev n+1 and n+2. A caller that passes `expectedRev` (the rev it saw, 0 for none) gets `summary_conflict` if another revision landed first. Never a lost revision. |

Nothing is overwritten: every revision stays in `summaryRevisions[]`. A closed record refuses revisions (`record_closed`).

### 2.5 The Shared Research origin and its close

| Item | Value |
|---|---|
| `RESEARCH_ORIGINS` | gains `shared_research` |
| `HOST_COLLECTIONS.shared_research` | `sharedResearchSessions` |
| Record id | `sr_<host id>` (`researchWorkIdFor({ collection: 'sharedResearchSessions', id })`); `isResearchWorkId` accepts `sr_…`; the old prefixes `ws_`, `rs_`, `as_`, `wl_` are unchanged |
| `STAGES_BY_ORIGIN.shared_research` | `[]` — every funnel stage is `null` on such a record in V1 |
| `TERMINAL_REASONS.concluded` | `concluded` — an investigation completed without an idea. `closePatch` (and `buildRecord`, for a record minted closed) accepts it only on a `shared_research` record closing `completed`; anywhere else it is `invalid_terminal_reason`. `saved_to_list` and `player_authored` are unchanged. |
| Rules for `sharedResearchSessions` | none in this build: they come with the collection's first writer, the Shared Research route |

The Forge's research line (`src/components/Forge/Watchlist/ideaCopy.js` `LINE_STAGES`) lists `shared_research: []`, which is what an unlisted origin already got: a Shared Research record shows no stage line. In the summaries the Forge is given (`researchSummariesOf`), a Shared Research record attached to a list comes **last**, after the list's own research and its analysis sessions, so however many there are they never push those past the cap of 20. With no such record (every list today) the order is unchanged. What the Idea panel says for a Shared Research record is the Command Center chat's decision.

### 2.6 The store writes (server only)

```js
appendFinding(db, { researchWorkId, uid, finding, nowIso })
  → { finding, count }            // the stored finding (with its minted id) and the new length
reviseSummary(db, { researchWorkId, uid, text, basedOn, expectedRev = null, nowIso })
  → { summary }
```

Each is one Firestore transaction: a fresh read of the record, the owner check (`isOwnedRecord(record, uid)`), the origin (`wrong_origin`) and state (`record_closed`) checks, the cap and shape checks, then one `update` of `findings` / `summary` + `summaryRevisions`, `symbolKeys` and `updatedAt`. A finding's shape is checked **before** any read. A refusal throws `ResearchRecordError` with a `code` (§6) and writes nothing. A stored `findings` or `summaryRevisions` that is not a list is refused (`record_unreadable`), never overwritten. `questionPatch` is a pure patch for the route's own transaction, like `subjectPatch` and `closePatch`. Nothing calls any of them yet.

### 2.7 Size

`api/_utils/researchRecords/size.test.js` builds the largest `shared_research` record the caps allow, through the model's own writers: every cap full — 100 findings (25 current, then 75 corrections each superseding the last), each with a 12-character symbol, the most-bytes url at the cap, a time pin and a 64-character status reason; 10 revisions of 1,000 characters with 25 `basedOn` ids each; a 500-character question; a 100-symbol cohort with both entry flags and 100 keys; 40 telemetry screens of 40 symbols (a turn may carry screens); 3-byte UTF-8 text wherever text is allowed; a 128-character 3-byte uid; ids at their schemes' maxima (`watchlistId`, `userId` and `terminalReason` are bounded by their writers, not by this model). It measures by Firestore's documented storage-size rules, read literally: a map is "calculated the same way as document size", so it counts its own 32 bytes. The rule is **at most 1,000,000 bytes** (Firestore's limit is 1,048,576), leaving room for the session's budget and telemetry.

| Measured | Bytes |
|---|---|
| First measurement (a narrower record, maps without their 32 bytes): 20 revisions, 2,048-character urls | 1,010,671 — over the rule → the first named cut: **revisions 20 → 10** |
| Every cap full, maps with their 32 bytes (review V2A-1): 10 revisions, 2,048-character urls | 1,013,417 — still over → the second named cut: **urls 2,048 → 1,024** |
| **Both cuts** | **706,217 — within it (pinned)** |

No other cut was made. (With the second cut in place, 20 revisions would also fit: 746,827 bytes — §10 Q6.)

## 3. The idea version (`watchlists/{id}/hypothesisVersions/v{n}`)

### 3.1 Evidence refs

Three kinds. Each ref is exactly its kind's keys:

| Kind | Shape | Rules |
|---|---|---|
| `researchWork` | `{ kind: 'researchWork', id }` | `id` a research record id (P2, unchanged) |
| `evidenceItem` | `{ kind: 'evidenceItem', recordKind, recordId, itemId }` | `recordKind` from `EVIDENCE_ITEM_RECORD_KINDS` — the finding source list **minus `exchange`** (it has its own ref kind) **and `retrieval`** (cite the finding that holds its url instead); `recordId` as §2.2; `itemId` the item's id — for a `symbolDayEvidence` news item its `newsId`; **for a finding, `recordKind: 'researchWork'`, the record's id and the `findingId`** — a printable string of 1–256 characters (a `findingId` for `researchWork`), or **`null` for the whole record**; the key is always present |
| `exchange` | `{ kind: 'exchange', hostCollection, hostId, exchangeId }` | `hostCollection` one of `watchlistSessions`, `researchSessions`, `analysisSessions`, `sharedResearchSessions`; `hostId` a host document id; `exchangeId` a v4 UUID (§4) |

**The content hash covers the new kinds canonically.** `buildContent` stores each ref as a fresh object with exactly its kind's keys in the table's order (`canonicalEvidenceRef`); `canonicalContentHash` sorts keys anyway, so a ref's key order never moves the hash. The array's order does. A `researchWork` ref is exactly what it always was, so **every existing version's hash is unchanged**: `api/_utils/hypothesisRecords/contentHash.golden.test.js` re-hashes every stored version in the fixtures and pins nine cases to hashes captured by running the same case file on main's `model.js`.

**Refs stay server-merged.** No route reads refs from a request (`parseContentPayload` in `api/_utils/hypothesisRecords/http.js` never did). The helpers:

| Helper | What it does |
|---|---|
| `evidenceItemRefOf({ recordKind, recordId, itemId = null })` | the canonical ref; throws `invalid_evidence_refs` if malformed |
| `exchangeRefOf({ hostCollection, hostId, exchangeId })` | the canonical ref; throws if malformed |
| `serverEvidenceRefsOf(refs)` | validates a whole list; **one malformed ref refuses the list** (a citation is never silently dropped); **more than 30 refs in one batch is `too_many_evidence_refs`** (`SERVER_EVIDENCE_REFS_MAX`). It caps the server's batch — every ref of an adopted first version — not a version's total: `createPlayerVersion` also merges the list's research refs, uncapped as before (§10 Q4). |
| `mergeEvidenceRefs(...lists)` | union, first-seen order, each ref once by its canonical form (a malformed entry is dropped, as in P2) |
| `createPlayerVersion(db, { …, serverEvidenceRefs = [] })` | validates the server's refs before any read, then merges them **after** the list's research refs. Its request fingerprint covers the caller's payload, not the server's refs: a replayed `opId` is the same operation and returns the first version, even if the server's refs changed since. |

### 3.2 The origin `shared_research`

| Item | Value |
|---|---|
| `ORIGINS` | `signaldrop`, `theme`, `screener`, `manual`, `shared_research` |
| Derivation | `originOf(list)` returns `shared_research` when the list carries a non-empty string `sourceSharedResearchSessionId` (`SHARED_RESEARCH_LIST_MARKER`). The check runs **first**, before the dialogue, screener and manual branches. Without the marker every existing case is unchanged. |
| Who writes the marker | the Shared Research route, server side, when it saves a list. No route writes it today, and none copies it from a request (pinned by `api/forge/researchRecordExtension.routes.test.js`). |
| Not added | `huddle`, `reporter`: each comes with the first build that creates a list from that source. Until then their influence on a version is recorded through `evidenceRefs`. |

### 3.3 The adoption's first version

`buildSharedResearchVersion({ list, watchlistId, record, userId, sessionId, statement, horizonEnum, activation = [], invalidation = [], keptFindingIds, confirmExchangeId, nowIso })` — pure, beside `buildSaveVersion`. Like the dialogue's automatic v1 it is born `researched`; "use it in my next game" is the existing `ready` action (`researched → ready`) and the existing equip route. There is no draft → ready and no new transition. The route that calls the builder is the Command Center arc's B1.

| Part | Value |
|---|---|
| Refusals (`HypothesisInputError.code`) | `list_not_from_session` — the list is not this owner's, is not the list `watchlistId` names (the version is written under it), is not `shared_research` by `originOf`, or its `sourceSharedResearchSessionId` is not `sessionId`; `record_not_from_session` — the record is not this owner's `shared_research` record for this session (`sr_<sessionId>`); `question_missing` — the record has no question; `invalid_kept_findings` — `keptFindingIds` empty, repeated, or naming anything that is not a current finding on the record; plus `buildContent`'s (`invalid_statement` — over the cap is refused, never cut; `invalid_horizon`; `invalid_condition`) and `serverEvidenceRefsOf`'s (`invalid_evidence_refs`; `too_many_evidence_refs` past 30 refs, i.e. 28 kept findings) |
| Content | the statement as given; `horizonEnum` with `horizonSource: 'player'`; the conditions through `normalizeConditions`; `publishedAt: null`; the origin from `originOf(list)` |
| `evidenceRefs`, in order | 1. the research record `{ kind: 'researchWork', id: 'sr_<sessionId>' }`; 2. each kept finding `{ kind: 'evidenceItem', recordKind: 'researchWork', recordId: 'sr_<sessionId>', itemId: <findingId> }`; 3. the confirming exchange `{ kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: <sessionId>, exchangeId }` |
| The version | `version: 1`; `status: 'researched'`, `stateSource: 'research'`, `stateReason: 'shared_research_completed'` (`STATE_REASONS.sharedResearchCompleted`); `opId: adopt_<sessionId>`; `opFingerprint` over `{ kind: 'adopt', payload: { sessionId, statement, horizonEnum, activation, invalidation, keptFindingIds, confirmExchangeId } }` — everything the player previewed |

`api/_utils/hypothesisRecords/sharedResearchVersion.test.js` pins its exact output for a fixed input (`__fixtures__/sharedResearchAdoption.js`), key order included, with its content hash and fingerprint.

### 3.4 Carrying such a version into a battle (founder ruling Q10: not fence contact)

A version carrying the new ref kinds or origin `shared_research` flows unchanged through the carriage's `siblingOf` into the battle document's frozen `equippedHypothesis`, which the fenced `api/_utils/agentBattleService.js:217-229` copies verbatim. `siblingOf`'s keys don't change. The sibling's readers read only `watchlistId`, `hypothesisVersion` and `contentHash` (`callRecords/candidate.js` `resolveProvenance`, `hypothesisRecords/review.js` `carryingBattleOf`, `activationEvidence/pointer.js` `ideaOf`) — with one more, found by the follow-up's review (V2B-2): at battle creation the carriage re-hashes the frozen sibling (`carriage.js` `contentHashOf(sibling) === sibling.contentHash`), which reads every content field, `evidenceRefs` and `origin` included, to refuse a sibling that does not match its own hash. That check does not depend on the values, so new values hash consistently and the ruling holds. `tournamentBattleView.js` deletes the sibling; `finishedRivalRead.js` leaves it out; neither fenced prompt assembler reads it. New values inside two pass-through fields, which nothing that trades or scores reads, don't change the battle document's shape.

Two guards keep it so. `api/_utils/hypothesisRecords/equippedHypothesisRefs.census.test.js` lists every non-test file (fixtures and mocks included) naming `equippedHypothesis` or `carriedSiblingOf`, and fails when any reads `evidenceRefs` or `origin` from the sibling or exposes it whole (stringified, spread, iterated, re-hashed) — through any alias, destructuring rename, nested pattern or the carriage accessor — bar the two allowed reads (the fenced copy; the carriage's value-blind re-hash). Its limits are stated in its header (a helper in another module reading a parameter; a computed key in a variable). And the 30-ref cap above.

## 4. Host sessions: `exchangeId`

Every exchange **newly** written to a host session's `exchanges[]` carries `exchangeId: crypto.randomUUID()` — the dialogue (`watchlistSessions`, two per turn: the user's and the agent's), the screener (`researchSessions`) and the analysis (`analysisSessions`) routes, whatever the research-record gate. The Shared Research route will do the same for `sharedResearchSessions`.

- The id is minted when the exchange object is built, before the write, so a retried transaction sends the same object and `arrayUnion` stores it once.
- It is stored only; no response carries it.
- Exchanges written before this build have no id. Readers treat a missing id as legacy. No reader reads the field: the prompt builders and history windows pick their own keys (`role`, `content`, `phase`; `userMessage`, `message`).
- An `exchange` evidence ref (and an `exchange` finding source) can only name an exchange that has an id.

## 5. What a client can never supply

| Field | Why it cannot |
|---|---|
| `question`, `findings[]` (and each `symbol`), `summary`, `summaryRevisions[]`, `symbolKeys` | `researchWork` has no client write in the rules (`allow write: if false`), and no route writes these fields |
| a finding's `findingId` | minted in `appendFinding`; a sent one is refused |
| an evidence ref | no route reads refs from a request; `serverEvidenceRefs` is a server parameter no route passes |
| an origin | always derived (`originOf`, `buildSaveVersion`, `buildSharedResearchVersion`); `parseContentPayload` reads no origin |
| the list marker | no route writes it or copies it from a request |
| an `exchangeId` | minted by the host route |

## 6. Refusal codes

`ResearchRecordError.code` (research record):

| Code | When |
|---|---|
| `record_not_found` | the record is missing, not the caller's, or the id is malformed |
| `record_unreadable` | the stored record has no known state, or a stored list field is not a list |
| `wrong_origin` | an extension write (a finding, a summary revision, a question, a mint with a question) on a record that is not `shared_research` |
| `record_closed` | the record is not `open` |
| `question_already_set` | a question offered for a record that has one |
| `invalid_question` | not 1–500 characters |
| `question_missing` | a `shared_research` record closing `completed` without a question |
| `invalid_terminal_reason` | `concluded` anywhere but a `shared_research` record closing `completed` |
| `invalid_finding` | not an object, or a field outside the finding's own (including `findingId`) |
| `invalid_finding_kind`, `invalid_symbol`, `invalid_fact`, `invalid_source`, `retrieval_needs_url`, `invalid_at`, `invalid_as_of`, `as_of_not_before_write`, `invalid_status`, `invalid_status_reason`, `invalid_pin`, `invalid_supersedes` | the field named (`invalid_source` also: a `researchWork` source naming the record itself) |
| `findings_full` | the record already holds 100 findings |
| `finding_id_taken` | the id is already on the record |
| `supersedes_unknown` | `supersedes` names no finding on the record |
| `finding_already_superseded` | another finding already supersedes it |
| `invalid_summary_text`, `invalid_based_on`, `based_on_unknown`, `based_on_superseded` | the field named |
| `summary_revisions_full` | the record already holds 10 revisions |
| `summary_conflict` | `expectedRev` is not the stored rev |
| `summary_unreadable` | the stored `summary` is not the last of `summaryRevisions[]` (or is present with none) |

`HypothesisInputError.code` (idea version): `invalid_evidence_refs` (a malformed ref, in content or in the server's list), `too_many_evidence_refs` (more than 30 server refs), `invalid_origin` (an origin outside `ORIGINS`), and the builder's `list_not_from_session`, `record_not_from_session`, `question_missing`, `invalid_kept_findings` (§3.3).

## 7. The contract's questions, as ruled (follow-up V2 §2)

| Q | Ruling | Where it is built |
|---|---|---|
| Q1 | An `evidenceItem` never names an `exchange` or a `retrieval`. | §3.1 `EVIDENCE_ITEM_RECORD_KINDS` |
| Q2, Q8 | The extension fields belong to `shared_research` records only; every write to one writes `symbolKeys` fresh; no other origin ever gets them. | §2.0, §2.3 |
| Q3 | A finding names its symbol explicitly; symbol keys come from the current findings, then the cohort. | §2.2 `symbol`, §2.3 |
| Q4 | Kept: a closed record refuses findings and revisions. | §2.2, §2.4 |
| Q5 | A summary rests on 1–25 current findings. | §2.4 |
| Q6 | What the Idea panel says for a Shared Research record is the Command Center chat's decision. `LINE_STAGES.shared_research` stays `[]`. | §2.5 |
| Q7 | Kept: `statusReason` stays a typed word. | §2.2 |
| Q9 | Kept: both id spellings accepted, one key. A writer cites an id exactly as stored. | §2.2 |
| Q10 | Founder ruling: not fence contact. Two guards. | §3.4 |
| Q11 | Kept: the fingerprint covers the caller's payload; a replay returns the first version. The adoption builder's fingerprint covers everything the player previewed. | §3.1, §3.3 |

## 8. After merge

The founder deploys the new `researchWork` index (`firebase deploy --only firestore:indexes`). No rules change ships in this build.

## 9. Changed by the follow-up (V2, 7 Nov 2026)

The build at `693ee59a` was amended before merge, in place (still version 1: nothing had been stored).

1. **`question`** no longer depends on the subject: set at a `shared_research` mint or once later by the new `questionPatch`; never changed. Removed from `subjectPatch` (now exactly `main`'s) and from `closePatch`'s subject; the codes `question_without_subject` and `question_after_subject` are gone. A `shared_research` record cannot close `completed` without one (`question_missing`).
2. **Source kinds**: `stockRankings`, `peerRankings` and `researchWork` added; a `researchWork` source names an earlier record, never its own; an `exchange` source's id is the exchange's v4 UUID.
3. **Summary text**: 600 → 1,000 characters.
4. **`concluded`** terminal reason, only on a `shared_research` record closing `completed`.
5. **Q1**: `EVIDENCE_ITEM_RECORD_KINDS` excludes `exchange` and `retrieval`; a finding is cited as a `researchWork` evidence item with its `findingId`.
6. **Q2/Q8**: the extension fields and `symbolKeys` belong to `shared_research` records only (`wrong_origin` elsewhere); the host "keep fresh" path is gone — a host record never gets `symbolKeys`, and every `shared_research` write refreshes them.
7. **Q3**: findings carry `symbol` (after `kind`); `symbolKeys` = the current findings' symbols, then `symbols[]`; no id is parsed.
8. **Q5**: `basedOn` holds 1–25 current findings (`based_on_superseded` new).
9. **Q10**: the `equippedHypothesis` census and the 30-ref cap (`too_many_evidence_refs`).
10. **Q11**: documented (§3.1).
11. **Size**: the §2.7 test; both named cuts — `SUMMARY_REVISIONS_MAX` 20 → 10 and `SOURCE_URL_MAX_LEN` 2,048 → 1,024 — now 706,217 bytes. No other cut.
12. **The adoption builder** `buildSharedResearchVersion` and `STATE_REASONS.sharedResearchCompleted` (§3.3).
13. **From the follow-up's review**: the close rules hold for a record minted closed; the builder refuses a `watchlistId` its list does not carry; the census widened (every read form the review found, fixtures scanned) and lists the carriage's re-hash as an allowed whole read.

Unchanged by the follow-up: every existing idea version's content hash, the gate-off and dialogue goldens, every write to a host-origin record a host makes, `carriage.js` and `buildSaveVersion`. (Two refusals are new on host-origin records — `concluded`, and a mint with a question — but no host writes either.)

## 10. Open for the Shared Research route (B1)

1. **The subject's symbol keys.** The follow-up lists "subject" among the Shared Research writes that write `symbolKeys` fresh, and also says `subjectPatch` behaves exactly as on `main`. The build keeps `subjectPatch` as on `main`: a subject set through `closePatch` writes the keys; a subject set alone writes none — it cannot leave them stale, since the keys depend only on findings and the cohort. If the route sets the subject alone and wants the field rewritten too, it adds `symbolKeysOf(record)` to that write.
2. **Normalize before building.** The adoption fingerprint covers the request as sent, while the content is normalized (the statement trimmed, condition symbols upper-cased). A retry that differs only in whitespace or case conflicts on `adopt_<sessionId>`; the route should normalize what it previewed before calling the builder.
3. **Which record states adopt.** The builder accepts the session's record in any state (open, completed, abandoned). Should adoption require an open or a completed record?
4. **A version's total refs.** The 30-ref cap is per server batch; a version made by `createPlayerVersion` with server refs also carries every research record attached to its list (up to 200, as before). If the battle copy must stay bounded, the cap belongs on the merged total.
5. **`concluded` with a subject.** `closePatch` accepts `concluded` together with a subject (a list and version) — "completed without an idea" while naming one. Should that be refused?
6. **Twenty revisions again?** The letter's cuts are sequential: 20 → 10 revisions came first (on the narrower measure), then urls 2,048 → 1,024 (on the full measure). With the url cut in place, 20 revisions would also fit (measured: 746,827 bytes). Restoring 20 is a founder call.
7. **The Idea panel.** `noResearchRecorded` treats only `dialogue_completed` as "researched by its source": a `shared_research_completed` version on a list with no research attached would read "No research recorded for this idea yet." It cannot happen while the route sets the investigation's subject at adoption.
8. **The list document carries its own `watchlistId`.** The builder checks `list.watchlistId === watchlistId`. Every list-creating path at this head writes that field (`api/forge/watchlists.js`); the Shared Research route's list save must too, and pass the stored document as `list`.
9. **Fields this model does not bound.** `terminalReason`, `userId` and `watchlistId` (and the length of a cohort or screen symbol) are bounded by their writers, not by the model — the size measure uses the longest each writer produces. A route that wrote a much longer value would eat the size margin (about 294,000 bytes at the caps).
10. **A corrupt stored record at adoption.** A stored `findings` that is not a list makes the builder answer `invalid_kept_findings` (no kept finding is current), not a corrupt-record code.
