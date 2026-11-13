# Shared Research B1/B2 Build Spec V1.2 — Amendment A: the KB method

**Date:** 2026-11-13 · **Owner:** the Command Center chat · **Status:** the founder's rulings of Nov 12–13 are applied (§A1).
**Amends, by addition:** spec V1.2 (`docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md`, with its §15) at §5.1, §6.1, §6.3, §6.4, §6.8, §6.9, §6.11, §10 and §11. Where this amendment and those sections disagree about the method, this amendment wins. Nothing else in the spec changes.
**Source:** `KB_FIRST_APP_INTEGRATION_PLAN_V1_1_NOV13_2026.md`, reviewed by the KB chat (four points, all resolved there), plus the founder's rulings below.
**Destination:** this file, byte-identical, at `docs/specs/20261113_SHARED_RESEARCH_SPEC_V1_2_AMENDMENT_A_KB_METHOD.md`, as the first commit of the KB-0 build (no docs-only PR), with a `docs/README.md` row.
**Grounded on:** `main` @ `9ca96ff2`; `claude/shared-research-b1` @ `5afea5f6` (code head `6af8196a`; B1 is built and not yet merged, and the line numbers in §A4 are at that head); the accepted release `KB-CONTENT-001-accepted-release.zip`.

Two parts, two builds:

| Part | What | Build | Needs first |
|---|---|---|---|
| **1** (§A3) | The KB loader, the authorization list (empty), the audience check, the imported package | **KB-0**, branch `claude/kb-loader` | nothing |
| **2** (§A4) | Shared Research selects, uses and records the method | **KB-1**, branch `claude/shared-research-kb1` | B1 and KB-0 reviewed and merged |

---

## A0. In plain terms

- The knowledge base's first accepted method, "Evaluating an Idea", becomes guidance for the research partner in one kind of investigation: the one a player starts from their own words.
- The method's file is committed to the app and checked against its recorded hashes every time it loads. Nothing reads from the founder's PC or the Hermes queue.
- Accepting a method's content and allowing the app to use it are two separate acts. The second is one line the founder merges. KB-0 ships with that list empty, so nothing changes for anyone.
- Every turn records which method it ran on. Every step keeps the source text the partner was shown, when it was read, and which findings came from it.
- Facts keep citing sources. The method is cited only by the suggested next step.

---

## A1. Rulings

| # | Ruling | From |
|---|---|---|
| **R-KB-1** | The first consumer is the investigation started from the player's own words. Story and SignalDrop investigations stay on `baseline@v0`. | founder, Nov 12 |
| **R-KB-2** | The first pilot's audience is the existing named test list. The method's audience check is separate from `SHARED_RESEARCH_MODE`: widening who may investigate never widens who gets the method. | founder, Nov 12 |
| **R-KB-3** | Accepted v0.1 is imported byte for byte. Its provenance (source, review and acceptance paths; the exporter) stays server-only. | founder, Nov 12 |
| **R-KB-4** | A hash identifies text; it does not preserve it. Each step retains the bounded title and highlights the partner was shown. A hash-only record is never described as sufficient for replay. | founder, Nov 12 |
| **R-KB-5** | KB-0 ships with an empty authorization list. KB-1 follows after B1 and KB-0 pass review and merge. Production activation is a separate founder act (§A6). | founder, Nov 12 |
| **R-KB-6** | The compact-card format (`package/2`) is a proposal. It does not block the first `package/1` integration. | founder, Nov 12 |
| **R-KB-7** | One method per investigation. A session keeps the method it started with; a later change is recorded, never silent; an investigation on baseline is never upgraded mid-way. | plan V1.1 |

---

## A2. The release and its pins

`KB-CONTENT-001-accepted-release.zip`: SHA-256 `2323b7999a9d7f2aae505b1072344d480ca474cb0facad695ca79396a0fbd8a5`, 126 files.

| Part (path in the release) | SHA-256 | Bytes |
|---|---|---|
| `exports/KB-IDEA-EVALUATION-001-v0.1.json` (the file) | `6287e493ef919402f942ee0e60544b32069f7ff7bb15c9374088a073006b79ac` | 11,160 |
| its `method_text` (UTF-8) | `b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e` | — |
| `methods/KB-IDEA-EVALUATION-001/v0.1/ACCEPTANCE.json` | `ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee` | 5,376 |
| `methods/KB-IDEA-EVALUATION-001/v0.1/SOURCE-REGISTER.txt` | `64c9d29e349401b4c597b854a46c74da0701cfea577a2a4810214d609d386fc6` | 23,958 |

**The chain** (each link recomputed, never read from a file's own claim):
1. the export's `acceptance.evidence_sha256` equals the acceptance record's hash;
2. the acceptance record's `content_sha256` equals the export's `content_hash.value` and the hash of `method_text`;
3. the acceptance record's `source_register.sha256` equals the register's hash.

The export names no register hash, so the register is bound only through the acceptance record. All three files are UTF-8, LF, with no byte-order mark. The export, the acceptance record and the register each contain local file paths; R-KB-3 governs them.

---

## A3. Part 1 — KB-0: the loader

### A3.1 Files

```
api/_utils/kb/packages/KB-IDEA-EVALUATION-001-v0.1.export.json       the release's export, byte for byte
api/_utils/kb/packages/KB-IDEA-EVALUATION-001-v0.1.acceptance.json   { path, text }: ACCEPTANCE.json's exact text
api/_utils/kb/packages/KB-CONTENT-001.source-register.json           { path, text }: SOURCE-REGISTER.txt's exact text
api/_utils/kb/packages/index.js                                      KB_PACKAGES: static JSON imports, one row per package
api/_utils/kb/authorizations.js                                      KB_APP_USE = Object.freeze([])
api/_utils/kb/loader.js                                              the checks and the two entry points
api/_utils/kb/audience.js                                            inAudienceFor(uid)
scripts/kb/import-release.mjs                                        builds the three package files from an extracted release
.gitattributes                                                       the package files are LF on every platform
```

- The two wrappers carry no hash of their own. Each is `JSON.stringify({ path, text }, null, 2)` plus one newline, where `path` is the file's path inside the release.
- `index.js` uses static `import … with { type: 'json' }` (the precedent: `api/_utils/stockThresholdPolicyRegistry.js`), so the function bundle carries the files.

### A3.2 The checks

In this order; the first failure is the answer.

| # | Check | Refusal |
|---|---|---|
| 1 | A package with this id and version is in `KB_PACKAGES`, with its export, acceptance wrapper and register wrapper | `missing` |
| 2 | The export's `schema` is `fantasytrades.kb-method-package/1` | `schema` |
| 3 | The export's `id` and `version` equal the request | `identity` |
| 4 | The export's `status` is `accepted`, its `acceptance.decision` is `accept`, and it carries no `test_only: true` | `not_accepted` |
| 5 | `content_hash.algorithm` is `sha256`, and SHA-256 of `method_text` equals `content_hash.value` and `acceptance.content_sha256` | `corrupt` |
| 6 | SHA-256 of the acceptance text equals the export's `acceptance.evidence_sha256`; parsed, the record's `id`, `version`, `decision: 'accept'` and `content_sha256` agree with the export | `acceptance_mismatch` |
| 7 | SHA-256 of the register text equals the verified acceptance record's `source_register.sha256` | `register_mismatch` |
| 8 | A well-formed authorization entry exists for this id and version, whose `sha256` equals the method hash and whose `acceptanceSha256` equals the acceptance record's hash | `not_authorized` |
| 9 | The entry's `consumers` include the caller's consumer | `scope` |
| 10 | The entry's `audience` is a known value and `inAudience(audience) === true` | `audience` |

### A3.3 The interface

```
verifyParts({ id, version, exportJson, acceptanceText, registerText })      checks 2–7 on given parts (the import script uses it)
verifyPackage({ id, version }, deps?)                                       checks 1–7
loadAuthorizedMethod({ id, version, consumer, inAudience }, deps?)          checks 1–10, for a method a session already holds
authorizedMethodFor({ consumer, inAudience }, deps?)                        the one entry for this consumer that takes new sessions, then checks 1–10
isAuthorizationEntry(entry)                                                 the entry's shape

answer:  { ok: true, method: { id, version, sha256, title, text, acceptedAt, consumer, audience } }
      |  { ok: false, reason }                                              reason is one of the ten refusals
deps:    { packages = KB_PACKAGES, authorizations = KB_APP_USE }            for tests
```

- **Never throws.** An unexpected exception is a refusal: `corrupt` in checks 1–7, and in checks 8–10 the refusal of the check that raised it (a throwing audience function is `audience`). The caller falls back to `baseline@v0` and records the reason.
- **Pure.** `loader.js` imports only `node:crypto`, `./packages/index.js` and `./authorizations.js`. No file read, no network, no database, no environment read.
- **Provenance stays behind** (R-KB-3). The two authorized entry points answer exactly the eight fields above; `verifyPackage` answers `id`, `version`, `sha256`, `acceptanceSha256`, `title`, `text` and `acceptedAt`. The export's `source`, `review`, `acceptance` and `exporter` blocks, the acceptance record and the register never leave the module, and nothing under `src/` imports `api/_utils/kb/`.
- **The release's own `production_app_use_authorized: false`** is content status. It is neither permission nor refusal; app use is the authorization entry.

### A3.4 The authorization entry

```
{ id, version,
  sha256,               the method hash (64 hex)
  acceptanceSha256,     the acceptance record's hash (64 hex)
  consumers: [ … ],     e.g. 'shared_research.observation'
  audience,             'allowlist' | 'all'
  newSessions?: false,  a superseded version: sessions holding it keep it, new ones don't get it
  authorizedAt, authorizedBy, evidenceRef }     evidenceRef: the record under docs/approvals/
```

- A malformed entry is ignored at run time. A test fails the build if the shipped list holds one, if an entry names a package that is not committed or whose hashes differ, or if two entries taking new sessions share a consumer.
- **KB-0 ships `KB_APP_USE` empty** (R-KB-5), pinned by a test that moves in the same commit as the first entry.

### A3.5 The audience

`inAudienceFor(uid)` returns the function a caller hands the loader. `uid` comes from verified sign-in only.

| Audience | True when |
|---|---|
| `'allowlist'` | `isCockpitOwnerAllowlisted(uid)` (`api/_utils/callRecords/mode.js`): the founder's named test list |
| `'all'` | `uid` is a non-empty string |
| anything else | never |

`audience.js` imports that one predicate and nothing else. It reads no Shared Research flag or gate (R-KB-2), and a test pins its imports.

---

## A4. Part 2 — KB-1: the consumer

Server files only. It builds after B1 and KB-0 merge, and can run alongside B2.

### A4.1 Selection and the effective method

- **Selection, once.** Own words, at `frame`: `authorizedMethodFor({ consumer: 'shared_research.observation', inAudience: inAudienceFor(uid) })`; a refusal means `baseline@v0` with the reason. Story and SignalDrop, at `open`: `baseline@v0`.
- **Every turn re-resolves.** A session stamped with a KB method calls `loadAuthorizedMethod` with its stamped id and version and the current player's audience function. A refusal runs that turn on `baseline@v0`.
- **No upgrade.** A session stamped `baseline` stays on baseline (R-KB-7).
- **The audience is checked at `frame` and at every `step`** (R-KB-2), whatever `SHARED_RESEARCH_MODE` is.

### A4.2 Where B1 changes (B1 as built at `6af8196a` → KB-1)

| B1 as built | KB-1 |
|---|---|
| `method.js`: `METHOD`, `METHOD_SOURCE` | Both stay, for baseline. Adds `selectMethod({ entryKind, uid })` and `effectiveMethodFor(session, uid)`, each answering `{ id, version, sha256, source, text, sourceRef }`. |
| `session.js:100,122`: `method: { id, version }` | The stamp `{ id, version, sha256, source: 'kb' \| 'baseline', consumer, selectedAt, fallbackReason? }`. Never rewritten. A stored session without `source` reads as baseline. |
| `session.js` `exchangeOf` (writes only the keys given) | Accepts `method`, `methodChange`, `findingIds`, `retrieval`, `methodsUsed` |
| Route `handleFrame` (`:150`) | Selects; stamps at `beginFraming`; builds the frame prompt from the effective method |
| Route `handleOpen` (`:228`) | Story and drop: the baseline stamp. Own words: no new selection; the opening's next step cites the session's method. |
| Route `handleStep` (`:290`) | Resolves the effective method before the prompt is built |
| `stepPrompt.js:52,79`: `METHOD.text` in both system prompts | The effective method's block: the baseline text as is, or the §A4.6 wrapper around a KB method's bytes |
| `stepSchema.js:562`, `opening.js:28`: the next action cites `METHOD_SOURCE` | Cites the effective method's `sourceRef`: `{ recordKind: 'kb', recordId: 'KB-IDEA-EVALUATION-001@0.1', label: 'Method · Evaluating an Idea v0.1' }`, or `baseline@v0` |
| Route `modelCallRecord` (`:91–98`): logs `METHOD.id`, `METHOD.version` | Logs the effective `methodId`, `methodVersion`, `methodSha256`, `methodSource` |
| `promptBudget.js`: counts the system prompt, never trims it | Unchanged. A test pins the largest system prompt under a stated size. |
| `prompt.honesty.test.js`: pins `METHOD.text` to rulebook §5 | Unchanged; it covers baseline. A KB method's bytes are pinned by hash. |
| Validator rule 7 | Adds `method_as_source`, `method_example_as_fact`, `service_promise` (§A4.6) |

### A4.3 The method on every turn

On each **partner** exchange of kind `frame` or `step`:

```
method:        { id, version, sha256, source }     the method THIS turn ran on, baseline included
methodChange?: { from, to, reason }                only when it differs from the previous partner turn's
findingIds?:   [ … ]                               step only: the findings this step appended, in order
```

- A finding's method is the `method` of the exchange whose `findingIds` holds it. Findings written at `open` are written by code, with no model turn, and have none.
- At adoption, the confirming exchange (`adoptIdea`, `store.js:599`) gains `methodsUsed`: the distinct methods behind the kept findings, built on the server. The idea version is unchanged; its evidence refs already name that exchange.
- No new store.

### A4.4 What each step retains (R-KB-4)

On each `step` partner exchange whose step retrieved:

```
retrieval: {
  readAt,                          when the retrieval answered
  items: [ {                       EVERY item the partner was shown this step, in the order shown, after the prompt budget's trims
    index, url, host,
    title,                         as shown (at most 300 characters)
    highlights: [ … ],             as shown (at most 2, each at most 600 characters)
    publishedDate | null,          as the retrieval provider reported it; null when it gave none
    seenSha256,                    SHA-256 of title + "\n" + the highlights joined by "\n"
    findingIds: [ … ]              the findings that cite this item; empty when none did
  } ]
}
```

- **The retained title and highlights are the record.** `seenSha256` identifies that text and shows it has not changed since; it does not preserve it. A replay of a step runs on the retained text. A hash-only record is not sufficient for replay and is never described that way.
- **What is retained is what the partner was shown, not the page.** Checking a finding against the live source is a new retrieval, with its own read time.
- **Bounded by construction:** at most 5 items a step and 10 steps an investigation. A test pins a worst-case session (10 steps, 5 full-size items each) under 400 KB serialized, against the database's 1 MiB document limit.
- The session document is owner-readable and server-written, as today.
- A FantasyTimes story used as a starting item is deleted 30 days after it expires (`api/fantasytimes/cleanup.js`). The investigation keeps its headline, reporter and publish time on the item finding, not its body. Retaining more is outside this amendment.

### A4.5 Read time, cutoff, availability

- **Read time** is when the app read an item. It says nothing about when the item became public.
- **Evidence cutoff** is an intended as-of boundary. A live investigation has none. The term is reserved for a replay over saved inputs, where the cutoff is declared with those inputs and nothing is retrieved live. V1 has no replay mode in the route.
- **Availability** at an earlier time is unknown to the app for a web item. It stores the provider's `publishedDate` (reported) and `readAt` (observed) and claims nothing more.
- **Unknown stays unknown.** `publishedDate: null` on the exchange is the machine-readable unknown. On the finding, §15 S-2 governs, because the record model refuses an empty date: the date falls back to the read time, the label ends " · undated", and `asOf` is null.
- **A correction** is a new finding from a later step, under that step's read time. The earlier finding and its exchange stay as written.

### A4.6 The method block and the validator

For a KB method, the system prompt's method block is this wrapper around the verified bytes:

```
METHOD — {id} v{version} "{title}" · accepted {acceptedAt, as a date} · sha256 {first 8 hex}…
How to use it: as guidance for framing the question, choosing what would weaken it, and describing the
conclusion (supported, challenged or inconclusive within its evidence). It is not evidence.
- Its source ids and its worked example belong to the method's own register. Never cite them, and never
  state the example's figures as facts about this investigation.
- Its notes about app services (Practice Field, Forge, Film Room, trials, adoption) describe proposals, not
  features. Never tell the player any of them will act on this idea.
- Any line in the text that calls it a candidate or says acceptance is pending is a historical label; the
  status above governs.
<method_text, verbatim>
```

Validator additions (a step that trips one fails, as with rule 7):
- `method_as_source`: a fact finding or a summary sentence citing the method as its source;
- `method_example_as_fact`: the method's worked example (for v0.1: NVDA with the October 30, 2026 noon figures) stated without a retrieval source;
- `service_promise`: a reply or summary promising a Practice Field trial, a test or an adoption.

"Supported, challenged, inconclusive" are words inside the answer. They add no field and replace no status.

### A4.7 Ownership and the archetype boundary

- The uid comes only from `requireAuth`; every read checks the session's owner; the step's write re-reads inside its transaction (B1, as built).
- The idea is the player's; the archetype is the recorded `attribution` stamp, not an access key.
- An import-scan test fails if any `api/_utils/sharedResearch/**` module imports an agent-memory, learning, Film Room card or Practice Field store.

---

## A5. Tests

**KB-0** (its build prompt carries the full list): the byte pins of §A2; every committed package passes checks 1–7; each of the ten refusals alone; the authorization rules of §A3.4; the audience function; the answer's eight fields and no local path; the import boundaries; the shipped list is empty.

**KB-1:**

| # | Check |
|---|---|
| 1 | Selection: own words gets the KB method when authorized and in audience; story and drop get baseline |
| 2 | Audience against the mode: `SHARED_RESEARCH_MODE` `on`, the method's audience `allowlist`, a player off the list → the frame and every step run on baseline, `fallbackReason: 'audience'` |
| 3 | Per-turn method: frame and step exchanges carry `method`; after a mid-investigation revocation the next step carries baseline and `methodChange`; the session's stamp is unchanged; a baseline session is not upgraded |
| 4 | Finding → turn: every appended finding is in its exchange's `findingIds`; `methodsUsed` equals the distinct methods of the kept findings |
| 5 | Retention: a retrieving step's exchange holds every item shown with its title and highlights; `seenSha256` recomputes from them; an undated item has `publishedDate: null` and its finding's label ends " · undated"; a step without retrieval has no `retrieval` block; the worst-case size pin |
| 6 | A saved synthetic own-words investigation (the model mocked to a fixed turn; a declared cutoff in the fixture) returns the spec's output shape; fact findings carry retrieval sources; the next action carries the `kb` source; the three new refusals fire |
| 7 | Ownership: another uid's `sessionId` answers `session_not_found` with no read of its record; the archetype-boundary scan |
| 8 | Provenance: no route answer, session field or log record carries a package's `source`, `review`, `acceptance` or `exporter` block |

---

## A6. Order, gates and activation

| Step | What | Who |
|---|---|---|
| 1 | B1 reviewed and merged, dark | founder |
| 2 | KB-0 built, reviewed and merged (any time; no dependency) | a build session; founder merges |
| 3 | KB-1 built, reviewed and merged (after 1 and 2) | a build session; founder merges |
| 4 | Rules and index deployed; `SHARED_RESEARCH_MODE` to `allowlist` | founder (B1's own steps) |
| 5 | **Activation (FD-1):** one entry in `KB_APP_USE`, its pin and its `docs/approvals/` record, in one founder-merged PR | founder |

The first entry:

```
{ id: 'KB-IDEA-EVALUATION-001', version: '0.1',
  sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e',
  acceptanceSha256: 'ec709781b80d2deeb325702faccb7a90abaa0c244c96103f0e956f81d26a08ee',
  consumers: ['shared_research.observation'], audience: 'allowlist',
  authorizedAt, authorizedBy: 'founder', evidenceRef: 'docs/approvals/…' }
```

Widening the audience to `'all'` is a second, separate entry change. Rollback is removing the entry: sessions fall back to baseline on their next turn and record the change.

---

## A7. Not in this amendment

- **The compact card** (IDEA-EVALUATION v0.2, `package/2`): a candidate. It needs its own acceptance, a loader update for the new schema, and its own entry.
- **KB-NEWS-CATALYST-001:** reviewed, pending founder acceptance. Its consumer is the story entry, in a later amendment.
- **KB-APP-EVIDENCE-001:** its first consumer is the research modal's Analysis view or Battle Research; same loader, its own consumer id and entry.
- **The six-case news comparison:** after B1 merges, the Command Center chat hands the KB chat the pinned baseline (`baseline@v0`, rulebook §5, with its hash at the merge commit), both system prompts and the output contract (the step and frame schemas and the validator's rules). The saved real-story evidence packets are still to be produced.
- No Practice Field, no trading rule, no scheduled work, no background steps, no vector database, no Hermes at run time.
