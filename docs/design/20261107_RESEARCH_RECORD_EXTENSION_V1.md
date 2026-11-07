# The Research Record Extension — contract V1

**Date:** 7 November 2026 · **Built by:** Claude Code, from the build prompt "The Research Record Extension (for Shared Research's first slice)" (Fable, framework chat, 7 Nov 2026) · **Base:** `main` `d503dd07` · **Build report:** `docs/audits/20261107_BUILD_RESEARCH_RECORD_EXTENSION.md`

This note gives the exact shapes the Shared Research slice ("work an idea") specs against. It records what was built, not a proposal. Where the build prompt left a choice open, the choice made is marked **(build choice)** and is listed again in §7 as a question.

## 0. In plain terms

A research record (`researchWork/{id}`) can now hold a **question**, a list of **findings** (each fact with where it came from and how sure it is), and a short **summary** that can be revised. It also gets a list of **symbol keys** so a reader can find every record about one stock. An idea version can now cite a single item of evidence or a single exchange of a conversation, not only a whole research record. And every new chat exchange gets its own id, so an idea can point at it.

Nothing writes the record's new fields yet, except tests. The Shared Research route that will write them is the Command Center arc's next build. The exchange id is the one exception: the three Forge host routes write it on every new exchange from this build on.

Every new field is written by the server. No route accepts a question, finding, summary, symbol key, origin or evidence ref from a client.

## 1. Where the code is

| What | Where |
|---|---|
| The record's vocabulary (origins, stages) | `src/constants/researchRecords.js` |
| The record's model: shapes, closed lists, caps, patches | `api/_utils/researchRecords/model.js` (the finding source list lives in the data-only `findingRecordKinds.js`, re-exported by the model) |
| The record's store: the two extension writes | `api/_utils/researchRecords/store.js` (`appendFinding`, `reviseSummary`) |
| Evidence refs, origins, the content hash | `api/_utils/hypothesisRecords/model.js` |
| The version store's server-ref parameter | `api/_utils/hypothesisRecords/store.js` (`createPlayerVersion`) |
| Exchange ids | `api/forge/watchlist-dialogue.js`, `api/forge/watchlist-analysis.js`, `api/screener/chat.js` |
| The index | `firestore.indexes.json` |

Each closed list below is defined once in the model. It grows only with a new `RECORD_SCHEMA_VERSION`. `api/_utils/researchRecords/extension.test.js` pins every list against the schema version (version 1 is this note).

## 2. The research record (`researchWork/{id}`)

### 2.1 `question`

| Rule | Value |
|---|---|
| Type | string, at most 500 characters (`QUESTION_MAX_LEN`); outer whitespace dropped; never empty |
| When written | once, **in the same write as the record's subject** (`watchlistId`, `hypothesisVersion`): at mint (`buildRecord({ …, watchlistId, question })`) or in the patch that sets the subject (`subjectPatch(record, { watchlistId, hypothesisVersion, question })`, also through `closePatch`'s `subject`) |
| Never | without a subject (`question_without_subject`); after the subject is set (`question_after_subject`); twice (`question_already_set`). Each is a typed refusal, never a silent no-op. |
| On existing records | absent: a record written without a question has no `question` key at all |
| `symbolKeys` | a write that sets a question is an extension write, so it also writes `symbolKeys` (§2.3) |

A different question is a different investigation, so it is a different record.

### 2.2 `findings[]`

Append-only. At most 100 (`FINDINGS_MAX`). Each item is exactly these keys, in this order:

```
{ findingId, kind, fact, source: { recordKind, recordId, label, url? }, at, asOf, status, statusReason, pin, supersedes }
```

| Field | Rule |
|---|---|
| `findingId` | minted by the store: `f_` + `crypto.randomUUID()` (a v4 UUID, lower case). A caller-sent `findingId` is refused (`invalid_finding`). |
| `kind` | one of `earnings_fact`, `release`, `coverage`, `check_receipt`, `setup`, `idea`, `observation`, `product`, `relationship`, `inference`, `next_action` |
| `fact` | string, 1–500 characters (`FINDING_FACT_MAX_LEN`), outer whitespace dropped |
| `source.recordKind` | one of `symbolDayEvidence`, `fantasyTimesWire`, `fantasyTimesStories`, `ingestedClaims`, `stockBriefs`, `estimatesCache`, `setupEvidence`, `activationPointer`, `call`, `hypothesisVersion`, `exchange`, `kb`, `retrieval` |
| `source.recordId` | printable string, 1–256 characters (`RECORD_ID_MAX_LEN`). For `symbolDayEvidence` it must be `{etDate}_{SYMBOL}` on a real date (`SYMBOL_DAY_EVIDENCE_ID_RE`; the symbol may use `.` or `-`). |
| `source.label` | string, 1–120 characters (`SOURCE_LABEL_MAX_LEN`), outer whitespace dropped |
| `source.url` | an `http(s)` URL of at most 2,048 characters. **Required** for `retrieval` (`retrieval_needs_url`). Optional otherwise; **absent (no key)** when not given, never `null` in storage. |
| `at` | the fact's own instant, exactly as `Date.prototype.toISOString()` writes it (`YYYY-MM-DDTHH:MM:SS.mmmZ`, milliseconds always) and a real calendar instant (it must round-trip: `2026-02-30…` and `24:00` are refused). One spelling, so stored instants sort as text in time order. It may be ahead of the write (a scheduled release). |
| `asOf` | when the source knew it, in the same instant form, or `null`. Absent → `null`, **never the write time**. An `asOf` equal to or later than the write time is refused (`as_of_not_before_write`) **(build choice: later is refused too)**. |
| `status` | `verified`, `unverified` or `unavailable` |
| `statusReason` | `null` when `verified`; otherwise a typed word, `^[a-z][a-z0-9_]{0,63}$` (for example `single_source`, `provider_unavailable`) |
| `pin` | `null`, or exactly `{ type: 'price', value }` with a positive finite number, or `{ type: 'time', value }` with an instant (the `at` form) |
| `supersedes` | `null`, or the `findingId` of an earlier finding **on the same record** that no other finding already supersedes **(build choice: a correction chain never forks; correct the correction instead)** |

A correction is a new finding whose `supersedes` names the earlier one. Nothing is edited or removed. `currentFindingsOf(record)` gives the findings no later finding supersedes, in record order.

### 2.3 `symbolKeys[]`

Derived on the server, never supplied: the record's `symbols[]` (each entry's `symbol`) first, then the symbol each finding's source record names, as keys — upper case, hyphen form (`BRK.B` → `BRK-B`, the `symbolNormalize.js` convention), each once, first-seen order, at most `SYMBOLS_MAX` (100). A value that is not a symbol (`^[A-Z0-9][A-Z0-9-]{0,11}$` after the hyphen form) is dropped.

Which findings name a symbol: only a `symbolDayEvidence` source, whose id carries it. No other record kind's id names a symbol **(build choice; see §7 Q3)**.

When it is written:

| Write | `symbolKeys` |
|---|---|
| a `shared_research` mint, or any mint that sets a question (`buildRecord`) | written |
| a subject set with its question (`subjectPatch`, `closePatch` with `subject.question`) | written, from the cohort that same write leaves |
| a finding append, a summary revision | written |
| a host write (`turnPatch`, `closePatch`, `recordTurnOutcome`) on a record **without** `symbolKeys` | not written — a host never adds the field |
| a host write on a record **with** `symbolKeys` | recomputed in the same patch, so it never goes stale |
| any host mint (`signaldrop`, `theme`, `screener`, `analysis`, `manual`) without a question | not written |

The symbols of a record's cohort fill the keys first; at a full 100-symbol cohort a finding's symbol is the one left out (§7 Q3).

Existing records keep no `symbolKeys` until an extension write reaches them **(build choice; see §7 Q2)**. A backfill is a separate task if a reader needs old records.

**Index:** `researchWork` (collection scope) `userId ASC, symbolKeys CONTAINS, createdAt DESC`. The query it serves: `where('userId','==',uid).where('symbolKeys','array-contains',KEY).orderBy('createdAt','desc')`. The founder deploys it after merge.

### 2.4 `summary` and `summaryRevisions[]`

```
summary = { rev, text, at, basedOn: [findingId] }
```

| Rule | Value |
|---|---|
| `text` | 1–600 characters (`SUMMARY_TEXT_MAX_LEN`), outer whitespace dropped |
| `at` | the write time (the revision's own instant) |
| `basedOn` | findingIds the record holds, each once; may be empty **(build choice; see §7 Q5)** |
| `rev` | the number of revisions before it + 1 (the first is 1). The stored `summary` must equal the last stored revision (key order aside) — or be absent when there is none — or the write is refused (`summary_unreadable`). |
| One write | the revision is appended to `summaryRevisions[]` **and** becomes `summary`, in one transaction |
| Cap | 20 revisions (`SUMMARY_REVISIONS_MAX`); the 21st is refused (`summary_revisions_full`) |
| Concurrency | two concurrent revisions land as rev n+1 and n+2. A caller that passes `expectedRev` (the rev it saw, 0 for none) gets `summary_conflict` if another revision landed first. Never a lost revision. |

Nothing is overwritten: every revision stays in `summaryRevisions[]`.

### 2.5 The Shared Research origin

| Item | Value |
|---|---|
| `RESEARCH_ORIGINS` | gains `shared_research` |
| `HOST_COLLECTIONS.shared_research` | `sharedResearchSessions` |
| Record id | `sr_<host id>` (`researchWorkIdFor({ collection: 'sharedResearchSessions', id })`); `isResearchWorkId` accepts `sr_…`; the old prefixes `ws_`, `rs_`, `as_`, `wl_` are unchanged |
| `STAGES_BY_ORIGIN.shared_research` | `[]` — every funnel stage is `null` on such a record in V1 |
| Rules for `sharedResearchSessions` | none in this build: they come with the collection's first writer, the Shared Research route |

The Forge's research line (`src/components/Forge/Watchlist/ideaCopy.js` `LINE_STAGES`) lists `shared_research: []`, which is what an unlisted origin already got: a Shared Research record shows no stage line. In the summaries the Forge is given (`researchSummariesOf`), a Shared Research record attached to a list comes **last**, after the list's own research and its analysis sessions, so however many there are they never push those past the cap of 20. With no such record (every list today) the order is unchanged. What the Idea panel should say for one is the slice's decision (§7 Q6).

### 2.6 The store writes (server only)

```js
appendFinding(db, { researchWorkId, uid, finding, nowIso })
  → { finding, count }            // the stored finding (with its minted id) and the new length
reviseSummary(db, { researchWorkId, uid, text, basedOn = [], expectedRev = null, nowIso })
  → { summary }
```

Each is one Firestore transaction: a fresh read of the record, the owner check (`isOwnedRecord(record, uid)`), the state check, the cap and shape checks, then one `update` of `findings` / `summary` + `summaryRevisions`, `symbolKeys` and `updatedAt`. A finding's shape is checked **before** any read. A refusal throws `ResearchRecordError` with a `code` (§6) and writes nothing. A closed record (`state` not `open`) is refused (`record_closed`) **(build choice; see §7 Q4)**. A stored `findings` or `summaryRevisions` that is not a list is refused (`record_unreadable`), never overwritten. Both functions accept any origin's record the caller owns (§7 Q8). Nothing calls either function yet.

**Size.** At every cap at once, with 3-byte UTF-8 text throughout and a full 100-symbol cohort, a record measures about 1,045,000 of Firestore's 1,048,576-byte document limit (review A12, by Firestore's documented size rules). It fits, with little room: a larger cap or a new field would make the 100th append fail with Firestore's own `INVALID_ARGUMENT` instead of `findings_full`.

## 3. The idea version (`watchlists/{id}/hypothesisVersions/v{n}`)

### 3.1 Evidence refs

Three kinds. Each ref is exactly its kind's keys:

| Kind | Shape | Rules |
|---|---|---|
| `researchWork` | `{ kind: 'researchWork', id }` | `id` a research record id (P2, unchanged) |
| `evidenceItem` | `{ kind: 'evidenceItem', recordKind, recordId, itemId }` | `recordKind` from the finding source list (§2.2); `recordId` as §2.2 (for a `symbolDayEvidence` news item, `{etDate}_{SYMBOL}`); `itemId` the item's id (for that news item, its `newsId`), a printable string of 1–256 characters, or **`null` for the whole record** — the key is always present |
| `exchange` | `{ kind: 'exchange', hostCollection, hostId, exchangeId }` | `hostCollection` one of `watchlistSessions`, `researchSessions`, `analysisSessions`, `sharedResearchSessions`; `hostId` a host document id; `exchangeId` a v4 UUID (§4) |

**The content hash covers the new kinds canonically.** `buildContent` stores each ref as a fresh object with exactly its kind's keys in the table's order (`canonicalEvidenceRef`); `canonicalContentHash` sorts keys anyway, so a ref's key order never moves the hash. The array's order does. A `researchWork` ref is exactly what it always was, so **every existing version's hash is unchanged**: `api/_utils/hypothesisRecords/contentHash.golden.test.js` re-hashes every stored version in the fixtures and pins nine cases to hashes captured by running the same case file on main's `model.js`.

**Refs stay server-merged.** No route reads refs from a request (`parseContentPayload` in `api/_utils/hypothesisRecords/http.js` never did). The helpers for the Shared Research route:

| Helper | What it does |
|---|---|
| `evidenceItemRefOf({ recordKind, recordId, itemId = null })` | the canonical ref; throws `invalid_evidence_refs` if malformed |
| `exchangeRefOf({ hostCollection, hostId, exchangeId })` | the canonical ref; throws if malformed |
| `serverEvidenceRefsOf(refs)` | validates a whole list; **one malformed ref refuses the list** (a citation is never silently dropped) |
| `mergeEvidenceRefs(...lists)` | union, first-seen order, each ref once by its canonical form (a malformed entry is dropped, as in P2) |
| `createPlayerVersion(db, { …, serverEvidenceRefs = [] })` | validates the server's refs before any read, then merges them **after** the list's research refs |

### 3.2 The origin `shared_research`

| Item | Value |
|---|---|
| `ORIGINS` | `signaldrop`, `theme`, `screener`, `manual`, `shared_research` |
| Derivation | `originOf(list)` returns `shared_research` when the list carries a non-empty string `sourceSharedResearchSessionId` (`SHARED_RESEARCH_LIST_MARKER`). The check runs **first**, before the dialogue, screener and manual branches. Without the marker every existing case is unchanged. |
| Who writes the marker | the Shared Research route, server side, when it saves a list. No route writes it today, and none copies it from a request (pinned by `api/forge/researchRecordExtension.routes.test.js`). |
| Not added | `huddle`, `reporter`: each comes with the first build that creates a list from that source. Until then their influence on a version is recorded through `evidenceRefs`. |

## 4. Host sessions: `exchangeId`

Every exchange **newly** written to a host session's `exchanges[]` carries `exchangeId: crypto.randomUUID()` — the dialogue (`watchlistSessions`, two per turn: the user's and the agent's), the screener (`researchSessions`) and the analysis (`analysisSessions`) routes, whatever the research-record gate. The Shared Research route will do the same for `sharedResearchSessions`.

- The id is minted when the exchange object is built, before the write, so a retried transaction sends the same object and `arrayUnion` stores it once.
- It is stored only; no response carries it.
- Exchanges written before this build have no id. Readers treat a missing id as legacy. No reader reads the field: the prompt builders and history windows pick their own keys (`role`, `content`, `phase`; `userMessage`, `message`).
- An `exchange` evidence ref can only name an exchange that has an id.

## 5. What a client can never supply

| Field | Why it cannot |
|---|---|
| `question`, `findings[]`, `summary`, `summaryRevisions[]`, `symbolKeys` | `researchWork` has no client write in the rules (`allow write: if false`), and no route writes these fields |
| a finding's `findingId` | minted in `appendFinding`; a sent one is refused |
| an evidence ref | no route reads refs from a request; `serverEvidenceRefs` is a server parameter no route passes |
| an origin | always derived (`originOf`, `buildSaveVersion`); `parseContentPayload` reads no origin |
| the list marker | no route writes it or copies it from a request |
| an `exchangeId` | minted by the host route |

## 6. Refusal codes

`ResearchRecordError.code` (research record):

| Code | When |
|---|---|
| `record_not_found` | the record is missing, not the caller's, or the id is malformed |
| `record_unreadable` | the stored record has no known state, or a stored list field is not a list |
| `record_closed` | the record is not `open` |
| `question_without_subject` | a question offered without a `watchlistId` in the same write |
| `question_after_subject` | a question offered for a record whose subject is already set |
| `question_already_set` | a question offered for a record that has one |
| `invalid_question` | not 1–500 characters |
| `invalid_finding` | not an object, or a field outside the finding's own (including `findingId`) |
| `invalid_finding_kind`, `invalid_fact`, `invalid_source`, `retrieval_needs_url`, `invalid_at`, `invalid_as_of`, `as_of_not_before_write`, `invalid_status`, `invalid_status_reason`, `invalid_pin`, `invalid_supersedes` | the field named |
| `findings_full` | the record already holds 100 findings |
| `finding_id_taken` | the id is already on the record |
| `supersedes_unknown` | `supersedes` names no finding on the record |
| `finding_already_superseded` | another finding already supersedes it |
| `invalid_summary_text`, `invalid_based_on`, `based_on_unknown` | the field named |
| `summary_revisions_full` | the record already holds 20 revisions |
| `summary_conflict` | `expectedRev` is not the stored rev |
| `summary_unreadable` | the stored `summary` is not the last of `summaryRevisions[]` (or is present with none) |

`HypothesisInputError.code` (idea version): `invalid_evidence_refs` (a malformed ref, in content or in the server's list), `invalid_origin` (an origin outside `ORIGINS`).

## 7. Questions for the Shared Research slice

1. **`evidenceItem.recordKind`** uses the full finding source list, including `exchange` (which has its own ref kind) and `retrieval` (whose ref carries no url). Should those two be excluded from `evidenceItem`?
2. **`symbolKeys` on host records.** The prompt says both "derived server-side on every write … existing records keep no symbolKeys until they are next written" and "nothing writes the new fields yet except tests and the exchange id". The build follows the second: a host write never adds the field, so a dialogue, screener or analysis record gets keys only if an extension write reaches it, and the symbol query finds only those. If it should find every record, the change is to derive keys in `buildRecord`, `turnPatch` and `closePatch` for every origin (open records only: a closed record is never written again) — and the gate-off goldens then move by that field.
3. **Symbols from findings** come only from `symbolDayEvidence` ids. Two other source kinds carry a symbol in their id at HEAD: `stockBriefs/{SYMBOL}` and `setupEvidence/{session}__{SYMBOL}__{rule}`. Should a finding carry its symbol explicitly (a schema version 2 field), or should each record kind's id be parsed by its own key module? And should a finding's symbol outrank the cohort when the 100 keys are full?
4. **Closed records** refuse findings and summary revisions, like every other record write. Should a correction be allowed after the record closes?
5. **An empty `basedOn`** is accepted. Should a summary have to rest on at least one finding?
6. **The Idea panel** shows no research line for a `shared_research` record (no stages). What should it say for one?
7. **`statusReason`** is a typed word, not a closed list. Should it be a closed list (like `kind`)?
8. **Which records take findings.** `appendFinding` and `reviseSummary` accept any record the caller owns, host records included (then that record gains `symbolKeys`). Should they accept only `shared_research` records?
9. **The `symbolDayEvidence` id's symbol spelling.** The collection does not exist yet; both `…_BRK.B` and `…_BRK-B` are accepted (they give one key). Which spelling will its writer use?
10. **Carrying a version into a battle (fence).** A version whose content holds an `evidenceItem` or `exchange` ref, or origin `shared_research`, flows unchanged through the carriage's `siblingOf` into the fenced battle document's `equippedHypothesis` (`api/_utils/agentBattleService.js`). This build creates no such version, so nothing reaching the fence changes now. The Shared Research route will create them: is a new element shape in that pass-through array fence contact under BUILD_RULES §1?
11. **Replays with server refs.** `createPlayerVersion`'s request fingerprint covers the caller's payload, not `serverEvidenceRefs`, so a replayed `opId` whose server refs differ returns the earlier version. Should the route fold its refs into the fingerprint?

## 8. After merge

The founder deploys the new `researchWork` index (`firebase deploy --only firestore:indexes`). No rules change ships in this build.
