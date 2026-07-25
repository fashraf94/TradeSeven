# FantasyTimes Wire — V1.6 Remediation-Pass Report

**Date:** July 25, 2026
**Branch:** `claude/fantasytimes-wire-news-spec-m5side` (single dark merge pending — A7)
**Governing documents:** Spec V1.5 (FINAL LOCK) + Spec V1.6 (POINT AMENDMENT, r2) — `docs/FANTASYTIMES_WIRE_SPEC_V1_6_POINT_AMENDMENT.md`
**Diff basis for the m6 map (§8):** pre-review `9d1c11d7` → branch head, in two audited lanes:
- **Lane R** = `96d52cfd` (code-review remediation, 27 findings) — `git show 96d52cfd`
- **Lane A** = the V1.6 remediation commit this report ships in — `git diff 96d52cfd..HEAD`

**Flag posture: unchanged.** All three flags (`WIRE_WRITES_ENABLED`, `WIRE_METRICS_ENABLED`, `WIRE_CONTINUITY_ENABLED`) ship **FALSE**. Nothing in this pass changes flag-off behavior; the M8 warm-container byte-identity suite still passes (§10).

---

## 1. Executive summary

All five A5 deliverables are complete on-branch:

| Deliverable | Status |
|---|---|
| A1 — D9 superseded-attempt semantics, unified inline+sweep | **Done** — mismatch conflict classes retired; `wireSuperseded` stamp; derived exactly-once counting; all named tests |
| A2 — `subjectRef` (server-stamped Neta / model-required `index_move` + ETF→index remap) | **Done** — all named tests incl. the SPY+NDX→SPX fixture and the `technical_break` salvage-drop |
| A3 — narrow `figures[]` sign rule via per-row `directionBases` | **Done** — reversal narratives legal; same-basis contradiction rejects; null-direction exempt |
| A4 — per-seam eventType pinning (4 seams) | **Done** — pinned enums + exact vocabularies; pinned previews exclude `direction`; Neta pinned schemas exclude `subjectRef` |
| A5-1 — rules-suite first execution | **EXECUTED IN-HARNESS: 111/111 passed** incl. all 12 Wire denials (§6). No fallback needed |
| A5-2 — host-integration + wireMetrics + cleanup + sweep-failure tests | **Done** — 3 new suites, 17 tests (§7) |
| A5-3 (m6) — hunk→finding-ID map | **Delivered as the table in §8** — zero unmapped hunks |
| A5-4 — A1–A4 with all named tests | **Done** — acceptance tables §§2–5, every row cites a test that fails under the defect (A6) |
| A5-5 — lookback-snapshot threading | **NONTRIVIAL → named post-merge follow-up** (§9) — with a correctness caveat on the spec's premise |

**Test state at head:** 176 Wire vitest tests across 14 suites, all green; full repo suite 327 files / 5,824 tests green; 111 emulator rules tests green. Lint: Wire modules and all Wire test files clean (§10).

One pre-existing repo finding surfaced by the A5-1 work (root-level emulator suite's bundles-block drift — **predates this branch**, verified against the merge base) is recorded in §6 for separate tasking.

---

## 2. A1 — D9 superseded-attempt semantics (unified)

### What changed

`api/_utils/wireWriteThrough.js` — the receipt branch of the shared Wire transaction now implements D9 on **both** paths (the transaction IS the shared path; inline and sweep both run it):

- `receipt.storyId === attempt.storyId` → `{status:'completed'}` — the post-commit race. The hash is **not consulted**: one hash per story, computed once, and same-key/different-hash carries no classification because retries regenerate (M1).
- Different `storyId` → **superseded attempt**: append to `receipt.supersededAttempts[]` if absent, **inside the transaction**; `validationStats.superseded += 1` only on first append (the membership check *is* the counter guard — exactly-once by construction). Straggler revisit (already in list) → `firstAppend:false`, no write, no count.
- Caller-side (`finalizeWireSuperseded`, new export): story stamped `wireSuperseded: true` (own field, m4 — never `wireConflict`), `wirePending` cleared, envelope deleted. Inline caller and sweep both route `status:'superseded'` through it.

`api/_utils/wireContracts.js`: `WIRE_CONFLICTS` now contains **only** `ENVELOPE_MISSING` and `REPLAY_EXHAUSTED` — `hash_mismatch`/`story_mismatch` retired from code, stats, and gate. `WIRE_STORY_STATE_FIELDS` gains `wireSuperseded` (stripped from both public readers like the rest).

`api/_utils/wireReplaySweep.js`: summary reports `superseded` / `supersededStragglers` (replacing `conflicts`); the replay branch finalizes superseded attempts identically to inline.

**Interpretation note (for the record):** the `wireConflict` *field* survives — it now carries only the two structural-anomaly classes (`envelope_missing`, `replay_exhausted`), which are not same-key receipt events and were not retired by D9. §6.1 stats: `superseded` replaces `idempotencyConflicts`; `envelopeMissing` and `replayExhausted` are unchanged. Gate line per A1: *superseded reviewed; nonzero on DST transition days expected; nonzero otherwise requires explanation.*

### Acceptance (A6: each row's test fails under the defect it guards)

| Requirement (V1.6 A1) | Test | Fails under |
|---|---|---|
| Inline regenerated mismatch → superseded: list append, own stamp, count once | `wireWriteThrough.test.js` · *"a DST double-fire arriving INLINE → superseded attempt: list append, own stamp, counted once"* | Old F2-10 inline no-op (nothing counted) or any conflict-class labeling |
| Sweep replay of a failed regenerated retry → superseded, **not** conflict (the M1 case) | `wireReplaySweep.test.js` · *"sweep replay of a regenerated same-key retry → SUPERSEDED attempt, never a conflict (the M1 case)"* — second fire's payload genuinely regenerated (different magnitude → different hash) | V1.5 tri-state (`story_mismatch` conflict + `idempotencyConflicts`) |
| Straggler revisit → no-op, count unchanged | `wireReplaySweep.test.js` · *"straggler revisit of an already-superseded attempt → no-op: nothing recounted, list unchanged"* (restores pending+envelope after superseded handling, re-sweeps; asserts `supersededStragglers===1`, `stats.superseded` still 1, list still length 1) | The V1.5 double-count on cleanup-death |
| Derived-count exactness under the matrix | `wireWriteThrough.test.js` · *"derived-count exactness: N distinct surplus attempts → N appends, N counts, one entry"* | Any counting not derived from list membership |
| Same storyId + different hash = completed no-op, nothing counted, **no class** | `wireWriteThrough.test.js` · *"post-commit race (same storyId) stays a completed no-op — nothing counted"* and `wireReplaySweep.test.js` · *"same storyId with a DIFFERENT hash is still a completed no-op — the hash carries no classification (D9)"* (envelope hash doctored to `'regenerated-would-differ'`) | V1.5 `hash_mismatch` termination |
| Receipt core never overwritten (B5); first receipt wins | Same M1-case test — asserts `receipt.storyId` still the first story's, entry count 1, `attempted` 1 | Receipt overwrite / second entry |
| `wireSuperseded` stripped from public surfaces | `wireContracts.test.js` · strip fixture now carries `wireSuperseded: true` + *"no wire\* key survives"* | Field added to stamp but not to `WIRE_STORY_STATE_FIELDS` |

---

## 3. A2 — `subjectRef`

### What changed

- **Contracts** (`wireContracts.js`): `INDEX_SUBJECTS` (`SPX NDX DJI RUT VIX`), `ETF_TO_INDEX` (`SPY→SPX, QQQ→NDX, DIA→DJI, IWM→RUT`), `ECON_SUBJECT_REFS` (closed slug→subject map for the 10 Tier-1 slugs) + `econSubjectRefForSlug()`. Row modes: `index_move.subjectRef='model_required'`; `econ_print`/`econ_preview` `='server'`; every other row unset. New codes `SALVAGE_SUBJECTREF`, `S1_SUBJECT_REMAPPED`.
- **Validator** (`wireValidator.js`): signature gains `primaryTickerRaw` (the server passes the same value it stamps on the story). `index_move`: missing → `R4_MISSING` REJECT; out-of-enum → `R4_ENUM` REJECT. ETF cross-check: mapped `primaryTicker` disagreeing with `subjectRef` → remap + `S1_SUBJECT_REMAPPED` (salvage); agreeing or unmappable → stands. `subjectRef` on any non-index row → `SALVAGE_SUBJECTREF` drop. Validated value rides in `facts.subjectRef`.
- **Write-through** (`wireWriteThrough.js`): `publishStoryWithWire` accepts `serverSubjectRef` (Neta seams stamp it pre-call from `econSubjectRefForSlug(canonicalizeEconEvent(event))` in `generate-econ.js`); the envelope carries it (replay-safe). Persisted resolution by row ownership: `'server'` rows ← envelope stamp; else ← validated model value; resolved **once** and fed to both `persistedFacts.subjectRef` and the digest render, so the head and the field can never disagree.
- **Digest** (`wireDigest.js`): subject resolution `subjectRef ‖ primaryTicker ‖ tickers[0] ‖ zeroTickerSubject ‖ 'Market'` — `"CPI print: +0.2pp vs expected."`, `"NDX move: -1.2% vs prior close."`; null renders the pre-A2 generic form.
- **Schema/prompt** (`wireSchemaExtension.js`): the `subjectRef` property (enum `INDEX_SUBJECTS`) and its instruction line appear **only** when the schema's eventType set includes `index_move` (Kai). Neta's pinned schemas exclude the field entirely — server-owned (A4 tie).

m7 stands as spec'd: enum-valid-but-wrong with no mappable cross-check is structurally uncatchable at the validator; `index_move` joins Phase 2 editorial stratified sampling for subject correctness.

### Acceptance

| Requirement (V1.6 A2) | Test | Fails under |
|---|---|---|
| Server stamp, known alias → persisted facts + digest head | `wireWriteThrough.test.js` · *"Neta server stamp: known slug reaches persisted facts + digest head"* (`'CPI print: +0.2pp vs expected.'`) | Stamp not plumbed, or digest rendered before resolution (caught live in this pass — the digest was rendering the pre-resolution facts; fixed by resolving once) |
| Unknown alias → null stamp → generic form | `wireWriteThrough.test.js` · *"Neta unknown alias: null stamp renders the generic form"* | Unknown slug inventing a subject |
| Neta pinned schemas omit the field | `wireSchemaExtension.test.js` · pinned-seam loop asserts `properties.subjectRef` undefined on all four pinned seams | Model shown a server-owned field |
| `index_move` missing → R4; out-of-enum → R4 | `wireValidator.test.js` · *"missing subjectRef → R4 REJECT (required)"* / *"out-of-enum subjectRef → R4 REJECT"* (`'SPY'`) | Subject-less/ETF-named index events passing |
| `S1_SUBJECT_REMAPPED` fixture: SPY + NDX → SPX | `wireValidator.test.js` · *"primaryTicker SPY + subjectRef NDX → SPX (the A2 fixture)"*; end-to-end persistence in `wireWriteThrough.test.js` · *"index_move remap flows through…"* (persists SPX with `primaryTicker` null — SPY is off-universe) | Internal inconsistency passing unremapped |
| Agreeing/unmappable primary → stands | `wireValidator.test.js` · *"agreeing or unmappable primaryTicker leaves subjectRef as emitted"* | Over-eager remap |
| `subjectRef` on `technical_break` → SALVAGE-drop | `wireValidator.test.js` · *"subjectRef on a non-index row → SALVAGE-drop"* | Field leaking onto rows that don't own it |
| Template fixtures ×3 incl. null | `wireDigest.test.js` · A2 describe (CPI print / NFP preview / NDX move / SPX-over-SPY precedence / null generic) | Templates not leading with the subject |
| Kai's schema offers the closed enum; model-required instruction line present | `wireSchemaExtension.test.js` · *"subjectRef appears ONLY when the schema offers index_move"* + instruction test | Free-text subject channel |

---

## 4. A3 — narrow `figures[]` sign rule

### What changed

Every `EVENT_CONTRACTS` row declares `directionBases` — the bases sharing the row's direction **subject** (e.g. `earnings_recap: ['price_vs_prior_close']` — deliberately **not** `eps_vs_consensus`/`revenue_vs_consensus`: "up despite an EPS miss" is a legal narrative; `gap_event: ['gap_vs_prior_close','price_vs_prior_close']`; preview rows: `[]`). The validator applies sign-consistency to `magnitude` **and** every `figures[]` entry **iff** the entry's basis ∈ `directionBases` and `direction ∈ {up,down}`. Null direction is exempt (this schema has no `mixed`/`flat`; the m5 exemption is honored by construction and locked as table truth — a forbidden-direction row must declare `[]`, an optional-direction row must declare non-empty, or `wireContracts.test.js` fails).

### Acceptance

| Requirement (V1.6 A3) | Test | Fails under |
|---|---|---|
| Same-basis figure contradicting direction → R4 | `wireValidator.test.js` · *"figures[]: same-basis sign contradiction → R4 REJECT"* | The review-era gap (figures never sign-checked) |
| Differing-basis counter-directional figure passes (reversal) | `wireValidator.test.js` · *"reversal narrative: counter-directional figure on a NON-direction basis passes"* | The broad rule (all bases sign-locked) |
| "Up despite EPS miss" legal on `earnings_recap` | `wireValidator.test.js` · *"direction 'up' with negative eps_vs_consensus magnitude passes (narrow rule)"* | `magnitudeBases`-wide sign checking |
| Direction-subject magnitude contradiction still rejects | `wireValidator.test.js` · R4 sign test (rewritten to `price_vs_prior_close`) | Sign rule lost entirely |
| Null direction exempt | `wireValidator.test.js` · *"null direction: no sign constraint on any basis"* | Sign-matching applied vacuously |
| Table truth: every row declares `directionBases` ⊆ row-legal bases; forbidden rows empty, optional rows non-empty | `wireContracts.test.js` · *"directionBases (V1.6 A3)…"* | A row silently losing the rule (empty list on an optional row) |

---

## 5. A4 — per-seam eventType pinning

### What changed

`extendToolWithAgentFacts(baseTool, reporter, { pinEventType })` + `buildAgentFactsInstruction(reporter, { pinEventType })`. Pinned: eventType enum collapses to the pin; magnitude/figure/qualifier enums are that **row's exact vocabularies**; `direction` is offered only if some row in the set allows it (pinned previews therefore exclude it); `subjectRef` only if the set includes `index_move` (never on a pinned seam). Pin outside the reporter's allowlist throws. Call sites: `generate-recap.js` → `earnings_recap`; `submit-earnings-batch.js` → `earnings_preview`; `generate-econ.js` recap site → `econ_print` (+ `serverSubjectRef` stamp), preview site → `econ_preview`. Kai/Alex/Kim keep the per-reporter union (multi-eventType seams); residual salvage noise on those seams remains the documented §6.1 gate note.

### Acceptance

| Requirement (V1.6 A4) | Test | Fails under |
|---|---|---|
| Pinned seams offer only the row's vocabularies (foreign qualifiers unrepresentable) | `wireSchemaExtension.test.js` · pinned-seam loop (exact enum equality for eventType/magnitude/figures/qualifiers, all four seams) | Union schema inviting cross-row vocabulary |
| Pinned previews exclude `direction`; pinned recaps keep it | `wireSchemaExtension.test.js` · *"pinned PREVIEW schemas exclude the direction property entirely…"* | Schema inviting a guaranteed R4 |
| The union really had the defect (regression contrast) | `wireSchemaExtension.test.js` · *"the pin removes cross-row vocabulary the union schema invited"* (union offers `eps_vs_consensus` to a preview; pinned does not) | Pin silently dropped — the contrast assertion fails |
| Previously-salvaging Doug-preview payload round-trips clean | `wireSchemaExtension.test.js` · *"a payload inside the pinned preview vocabulary round-trips CLEAN through the validator"* (`passed`, `codes: []`; companion asserts the direction reject class is still enforced server-side) | Schema-conformant ⇏ validator-clean on a pinned seam |
| Instruction mirrors the pin; no subjectRef line off-Kai | `wireSchemaExtension.test.js` · instruction tests | Prompt/schema divergence |
| Pin outside allowlist throws | `wireSchemaExtension.test.js` · *"a pin outside the reporter allowlist throws"* | Misconfigured call site shipping silently |
| M8 clone-never-mutate still holds under pinning | `wireSchemaExtension.test.js` M8 describe (unchanged, still green) + `wirePayloadEquality.test.js` (6/6) | Pin mutating the shared singleton |

---

## 6. A5-1 — rules-suite first execution

**Result: EXECUTED, in this harness. No fallback required.**

```
npx -y firebase-tools emulators:exec --only firestore --project demo-tradeseven-rules \
  "npx vitest run --config vitest.rules.config.mjs"
→ Test Files  3 passed (3)     [learningDenials, masteryDenials, wireDenials]
→ Tests       111 passed (111)
→ ✔ Script exited successfully (code 0)
```

- `test/rules/wireDenials.rules.mjs`: **12/12 passed** against a live Firestore emulator loading the repo's `firestore.rules` — every verb denied for every client identity (anon, authed, privileged claims) on `fantasyTimesWire`, `fantasyTimesWireEnvelopes`, `wireMetrics`, plus the agentFacts-stays-server-side checks and the public-story-read positive control. The suite loads, runs, and its denials are real emulator `PERMISSION_DENIED`s, not vacuous passes — A6 satisfied for the rules rows.
- Environment note: `firebase-tools` is **not** a repo devDependency; this run used `npx firebase-tools@15.24.0` with the pre-installed OpenJDK 21. `npm run test:rules` invokes bare `firebase` and therefore needs either a global install or the npx form above. Optional follow-up: pin `firebase-tools` as a devDependency so the script is self-contained.
- **The pre-FLIP founder action is unchanged:** re-run against the *deployed* ruleset per V1.5 §12.

**Pre-existing finding (recorded, not fixed — out of scope):** the *other*, root-level emulator suite `firestore.rules.emulator.test.js` (not part of `npm run test:rules`; self-skips without an emulator) was also executed opportunistically: 18 passed / 33 skipped / **1 suite-level failure** — its `CURRENT_BUNDLES_BLOCK_RE` finds 0 bundles blocks to patch and throws "firestore.rules has drifted". Verified against the merge base (`d8ea0e9c`): the regex finds 0 matches on the **pre-Wire** `firestore.rules` too, so the drift **predates this branch** and is unrelated to the three Wire deny blocks. Per that suite's own instruction the fix is updating its regex, not editing `firestore.rules`. Filed here for separate tasking.

---

## 7. A5-2 — host-integration + dedicated rider tests

Three new suites, 17 tests, each targeting a specific host defect class (the C1 lesson: unit-green ≠ host-wired):

**`api/cron/process-pending-reflections.test.js` (7)** — the real handler, real sweep (mock boundary: flags, firebaseAdmin, `generateReflection`, and a passthrough sweep hook that defaults to the real implementation):
- *Empty reflection queue still reaches the sweep* — a deferred Wire story is actually replayed on an empty-queue tick; `wireSweep.replayed === 1` in the response. **Fails under C1 restored** (the early return).
- *Non-empty queue: reflections AND sweep in one tick* — both jobs' effects asserted.
- *Sweep throw contained* / *sweep rejection contained* — reflections land, 200, `wireSweep: null`. Fails if the isolating try/catch is removed.
- *Budget floor* — fake timers; a 46s reflection leaves 4s < 5s floor → sweep not started, deferred story untouched. Fails if the floor stops being honored.
- *Flag gate* — writes OFF → the sweep machinery is never invoked (spy) — pre-flip its composite index may not exist.
- *Auth* — non-cron caller without the bearer → 401.

**`api/_utils/wireMetrics.test.js` (7)** — recording lockstep (count/totalMs/samples/sampledCount), per-seam/per-metric isolation, per-day docs, **cap behavior at and past `METRIC_SAMPLE_CAP`** (count/totalMs keep growing, samples and sampledCount freeze — the §9 display-agreement), transaction-failure containment (resolves, logs, never throws to the caller), garbage-input guards (no write at all).

**`api/fantasytimes/cleanup.test.js` (3)** — Steps 1–2 story expiry intact; the Step-3 Wire retention ride drains old day/metrics/envelope docs while **keeping a pending story's envelope** (the only replayable copy — deleting it would manufacture the envelope_missing alarm) and keeping fresh docs; a Wire retention failure is isolated (200, Steps 1–2 results preserved, `wireCleanupError` surfaced). The sweep-failure path itself is additionally covered by the sweep suite's *"a failing replay records an attempt so the cap can eventually bind"*.

---

## 8. A5-3 (m6) — hunk→finding-ID map

**The artifact, not an attestation.** Every hunk in `9d1c11d7..HEAD`, mapped. Anchors are new-file `@@`-header start lines; reproduce with `git show 96d52cfd -- <file>` (Lane R) / `git diff 96d52cfd..HEAD -- <file>` (Lane A). **Unmapped hunks: none.**

**Lane R finding key** (review report §3 rows, in order): `C1` sweep unreachable · `C2` fake false-pass · `C3` primaryTicker unvalidated · `H1` quarantine keyed on contract min · `H2` counters not exactly-once · `H3` TOCTOU false alarm · `H4` no attempt cap · `H5` lookback throw poisoned queue · `H6` Sunday-orphan bucketing (snap-forward) · `H7` M8 `wireMarketDate` persisted flag-off · `H8` flags untested · `M1` payloadHash `sha256("null")` · `M2` ISM alias shadowing · `M3` batch flag-straddle · `M4` retention could delete pending envelope · `M5` qualifier cap before dedupe · `M6` day-doc size guard · `M7` retention failure not isolated · `M8` metrics txn inside measured window · `M9` sampledCount · `M10` `batch_submit` rename · `M11` circular hash test · `M12` report count correction · `L1` `R4_TICKER_EMPTY` · `L2` `+0%` sign · `L3` `stripWireState` · `T1` contract-table test. **Lane A key:** V1.6 `A1`–`A4`, `A5-2` (new suites), `DOC` (docs/records), `VER` (schema/validator version bump `wire-1.6`/`1.6.0`).

### Lane R — `9d1c11d7..96d52cfd`

| File | Hunks (@ new-file line) | Finding(s) |
|---|---|---|
| `api/_utils/__fixtures__/wireFirestoreFake.js` | @12, @58, @169 | C2 — per-document read-set versions, reads-before-writes enforcement, optimistic retry |
| `api/_utils/wireCalendar.js` | @41 (`resolveWireMarketDate`), @152 (`nextCalendarDay`) | H6 |
| `api/_utils/wireContracts.js` | @59 (`R4_TICKER_EMPTY`, `F1_PRIMARY_DROPPED`) | L1, C3 |
| | @69 (`REPLAY_EXHAUSTED`; `WIRE_STORY_STATE_FIELDS` + `stripWireState`) | H4, L3 |
| `api/_utils/wireContracts.test.js` | @1 (new file) | T1, L3 |
| `api/_utils/wireDigest.js` | @107 (zero-magnitude sign) | L2 |
| `api/_utils/wireFlags.test.js` | @1 (new file) | H8 |
| `api/_utils/wireIdentity.js` | @40 (`ism_svc` before `ism_mfg`) | M2 |
| `api/_utils/wireMetrics.js` | @36 (`sampledCount`) | M9 |
| `api/_utils/wireReplaySweep.js` | @12, @36, @44 (header + import swap to `terminate` model) | H2 |
| | @58 (`maxAttempts` default) | H4 |
| | @94 (main loop: transactional terminal actions, `applied/alreadyTerminal`, cap check, failure attempt-bump) | H2, H3, H4 |
| | @206 (`terminate()` + `toDate`) | H2, H3 |
| `api/_utils/wireReplaySweep.test.js` | @18 (independent `normalizedGoodFacts` hash) | M11 |
| | @143, @205, @294 (exactly-once / TOCTOU / cap / attempt-record tests) | H2, H3, H4 |
| `api/_utils/wireValidator.js` | @169 (empty-vs-oversize split) | L1 |
| | @270 (dedupe before cap) | M5 |
| | @306 (quarantine keys on emitted tickers) | H1 |
| `api/_utils/wireWriteThrough.js` | @28 (imports), @95 (primary F1/D8 battery), @138/@158/@166 (`codes` carrier) | C3 |
| | @39 (metrics import drop), @184 (`wire.wireMs` return, no metrics I/O in window) | M8 |
| | @49 (`DAY_DOC_WARN_BYTES`), @319+@327 (size warn) | M6 |
| | @120 (`payloadHash` of normalized-else-raw) | M1 |
| | @214 (lookback degrade try/catch) | H5 |
| | @356 (remove `markWireConflict` — superseded by `terminate()`) | H2 |
| | @395 (`normalizeStats` + `envelopeMissing`/`replayExhausted`) | H2, H4 |
| `api/_utils/wireWriteThrough.test.js` | @132 (single 82-line hunk: the `primaryTicker` D8/F1 describe — model-string/off-universe/oversize repros — plus the post-commit-race hash computed independently of the doc under test) | C3, M11 |
| `api/cron/process-pending-reflections.js` | @51 (no early return; fall-through log), @123 (response fields) | C1 |
| `api/fantasytimes/cleanup.js` | @72 (isolated Step 3 + pending-envelope keep), @126 (response) | M4, M7 |
| `api/fantasytimes/feed.js` · `story/[id].js` | 2 hunks each (`stripWireState`) | L3 |
| `api/fantasytimes/generate-pulse.js` / `generate-mover.js` / `generate-column.js` | 5/5/4 hunks each: import swap + `resolveWireMarketDate` | H6 |
| | window close (`genPublishMs`) + `wire_path` emit after window | M8 |
| `api/fantasytimes/generate-econ.js` | 7 hunks: import + 2× `resolveWireMarketDate` (recap/preview) | H6 |
| | 2× window close + 2× sample emit | M8 |
| `api/fantasytimes/generate-recap.js` | 5 hunks: same pattern | H6, M8 |
| `api/fantasytimes/poll-batch.js` | @9 (imports) + @170 (`submittedUnderWire` guard; `resolveWireMarketDate(submittedAt)` fallback; `generate_publish` emitted at the true publish site) | M3, H6, H7, M10 |
| `api/fantasytimes/submit-earnings-batch.js` | 3 hunks: import + resolve | H6 |
| | conditional `wireMarketDate` spread | H7 |
| | `batch_submit` metric + comment | M10 |
| `docs/audits/20260724_WIRE_PHASE1_BUILD_REPORT.md` | 3 hunks (count + claim corrections) | M12 |
| `docs/audits/20260725_WIRE_PHASE1_CODE_REVIEW.md` + `docs/README.md` | new file + 1 row | the review record itself (BUILD_RULES §2) |

### Lane A — `96d52cfd..HEAD` (this commit)

| File | Hunks (@ new-file line) | Finding(s) |
|---|---|---|
| `api/_utils/wireContracts.js` | @11 (header) | VER |
| | @56 (version bumps; `SALVAGE_SUBJECTREF`/`S1_SUBJECT_REMAPPED`; `WIRE_CONFLICTS` mismatch classes retired) | VER, A2, A1 |
| | @84 (`wireSuperseded` in `WIRE_STORY_STATE_FIELDS`) | A1 |
| | @110 (`INDEX_SUBJECTS`, `ETF_TO_INDEX`, `ECON_SUBJECT_REFS`, `econSubjectRefForSlug`) | A2 |
| | @157, @221 (`directionBases` on every row; `subjectRef` row modes) | A3, A2 |
| `api/_utils/wireContracts.test.js` | @1, @9 (imports), @59 (directionBases/subjectRef-mode/ETF-map/econ-map tests), @122 (strip fixture + `wireSuperseded`) | A3, A2, A1 |
| `api/_utils/wireDigest.js` | @61 (subjectRef-first subject resolution) | A2 |
| `api/_utils/wireDigest.test.js` | @87 (A2 template describe) | A2 |
| `api/_utils/wireReplaySweep.js` | @19 (header), @39 (import `finalizeWireSuperseded`), @73 (summary fields), @145 (superseded replay branch) | A1 |
| `api/_utils/wireReplaySweep.test.js` | @1 (header), @29 (`subjectRef:null` in the independent hash fixture) | A1, A2 |
| | @147, @172 (D9 rewrite: hash-no-classification, M1 case, straggler revisit) | A1 |
| `api/_utils/wireSchemaExtension.js` | @1, @8, @31, @40, @77, @156 (pin plumbing; exact row vocabularies; `anyDirectionAllowed` gate; `includeSubjectRef` gate; instruction mirror) | A4, A2 |
| `api/_utils/wireSchemaExtension.test.js` | @14 (imports), @80 (pinning describe), @197 (instruction pin/subjectRef tests) | A4, A2 |
| `api/_utils/wireValidator.js` | @28, @37 (imports), @66/@79 (`primaryTickerRaw` in signature+doc), @193 (subjectRef block), @384 (facts + `S1_` salvage predicate) | A2 |
| | @333 (narrow sign rule: `directionBases` on magnitude + figures) | A3 |
| `api/_utils/wireValidator.test.js` | @123 (sign-rule battery: narrow-rule rewrite + figures cases) | A3 |
| | @249 (subjectRef describe) | A2 |
| `api/_utils/wireWriteThrough.js` | @64 (header), @178 (inline superseded routing), @253 (D9 receipt branch), @384 (tx return), @392 (`finalizeWireSuperseded`), @441 (`normalizeStats.superseded`) | A1 |
| | @81/@96 (`serverSubjectRef` param+doc), @149 (envelope field), @305 (resolve-once + persistedFacts + digest feed) | A2 |
| `api/_utils/wireWriteThrough.test.js` | @140/@155/@168/@176 (index_move fixtures now carry required `subjectRef`) | A2 |
| | @288 (D9 inline describe) | A1 |
| | @433 (subjectRef end-to-end describe) | A2 |
| `api/fantasytimes/generate-econ.js` | @21 (import `econSubjectRefForSlug`), @278/@307 (recap: `wireEconSlug` pre-call + pin + `serverSubjectRef`), @367/@377 (publish args), @498/@532 (preview: pin) | A2, A4 |
| `api/fantasytimes/generate-recap.js` | @251, @272 (pin `earnings_recap` on instruction + tool) | A4 |
| `api/fantasytimes/submit-earnings-batch.js` | @181, @243 (pin `earnings_preview` on instruction + tool) | A4 |
| `api/cron/process-pending-reflections.test.js` | new file | A5-2 |
| `api/_utils/wireMetrics.test.js` | new file | A5-2 |
| `api/fantasytimes/cleanup.test.js` | new file | A5-2 |
| `docs/FANTASYTIMES_WIRE_SPEC_V1_6_POINT_AMENDMENT.md` | new file (verbatim founder paste; byte-verified by sha256 against the session transcript) | DOC |
| `docs/README.md` | rows for V1.6 + this report; D9 pointer on the review row | DOC |
| `docs/audits/20260725_WIRE_V16_REMEDIATION_REPORT.md` | new file (this report) | DOC |

**Process rule honored (A5-3):** no mutation testing touched the working tree in this pass. The one prior violation (a worker-restart leftover caught and reverted before the review commit) is what motivated the rule; the repo was swept for stray mutation markers then and the sweep is clean at head.

---

## 9. A5-5 — lookback-snapshot threading: NONTRIVIAL → post-merge follow-up

Assessed against the include-only-if-trivial bar; it misses on two counts:

1. **Surface:** the five lookback reads happen inside `runWireTransactionFromEnvelope` (chain resolution) and `buildContinuityContext` (prompt block) — threading a shared snapshot cache requires signature changes across ~6 call sites spanning both the inline and sweep paths.
2. **Correctness caveat on the spec's premise:** the review's follow-up note said "the prior-day docs are immutable, so sharing is provably safe." That is true for *closed* days in steady state, but **not strictly true under replay**: a sweep replay (or a straggler from a killed batch) can land an entry on a *prior* market-date's doc after a later day has already read it — F2-8 territory. A naive cross-request cache keyed only by date could therefore serve a stale prior-day snapshot to chain resolution. The correct design (per-request/per-story scope, or an invalidation tied to the day-doc's `updatedAt`) is a real design decision, not a mechanical thread-through.

**Disposition:** named post-merge follow-up — *"Thread the five shared lookback snapshots (per-request scope; account for replay-mutability of prior-day docs)"*. Cost today is bounded: ~5 redundant point reads per story with continuity ON (continuity ships OFF).

---

## 10. Suite, lint, and environment results

- **Wire suites:** 14 files / **176 tests green** — contracts 14, calendar 10, identity 6, validator 28, digest 23, continuity 5, flags 5, writeThrough 28, replaySweep 13, schemaExtension 21, payloadEquality (M8) 6, metrics 7, host-integration 7, cleanup 3.
- **Rules (emulator):** 3 files / **111 tests green**, incl. `wireDenials` 12/12 (§6).
- **Full repo suite:** `npx vitest run` → **327 files passed / 5,824 tests passed** (1 file skipped: the root emulator suite, by design without an emulator). One observed flake on an **untouched, pre-existing** suite: `api/forge/parse-signal.test.js` · *"records urlFetchSucceeded=true when fetch returns OK"* failed once (5.2s, timeout-shaped) and passed on the immediate rerun and on the final full run. Not Wire-related; noted for the repo's flaky ledger.
- **Lint:** every touched Wire module and every Wire test suite (the 6 edited + 3 new) clean. The only errors on touched files are the **pre-existing repo-wide** `no-undef 'process'` gap on `api/fantasytimes/*` endpoints (missing node env in the eslint config for that tree — fires on lines this branch never touched; documented in the Phase 1 build report; unchanged).
- **A5-1 environment:** OpenJDK 21 present; `firebase-tools` via `npx @15.24.0` (not a repo dependency — optional follow-up to pin it).

## 11. Unchanged invariants (verified at head)

- **Calibration fence:** zero fenced files in either lane's diff; no fenced function newly imported or called.
- **Cron budget:** `vercel.json` byte-untouched — 37/40.
- **BUILD_RULES §5:** no fire-and-forget catalog writes; the sweep remains the blessed queue-flag pattern; metrics failures are contained-and-logged (now test-locked).
- **M8:** flags off ⇒ byte-identical outbound payloads and persistence — `wirePayloadEquality.test.js` 6/6 green after the A4 schema changes (pins only exist on the writes-enabled path).
- **Firestore artifacts:** `firestore.rules` (3 Wire deny blocks) and `firestore.indexes.json` (the `wirePending+publishedAt` composite) unchanged in this pass — now emulator-verified (§6).

## 12. For the founder — before the single dark merge (A7)

1. **Review this report**, especially: the D9 interpretation note (§2 — `wireConflict` field survives for the two structural classes), the m6 map (§8), and the A5-5 caveat (§9 — the "provably safe" premise from the review's follow-up list needed a correction).
2. §6.1 gate sheet: replace the `idempotencyConflicts` line with the A1 superseded line; add the pinned-seam note that residual salvage noise now applies to **multi-eventType seams only**.
3. Pre-flip checklist is unchanged from V1.5 §12 + review report §6.3 — with one item **upgraded**: the rules suite has now had its first execution (repo ruleset, in-harness); the deployed-ruleset run remains yours pre-FLIP.
4. Two optional follow-ups filed: pin `firebase-tools` as a devDependency (§6); root emulator suite's pre-existing bundles-regex drift (§6). One named post-merge follow-up: lookback threading (§9).

---

*20260725_WIRE_V16_REMEDIATION_REPORT.md — V1.6 (r2) remediation pass, July 25, 2026. Branch `claude/fantasytimes-wire-news-spec-m5side`; no merge performed; flags FALSE.*
