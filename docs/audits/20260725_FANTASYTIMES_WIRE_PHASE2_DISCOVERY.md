# FANTASYTIMES WIRE — PHASE 2 DISCOVERY REPORT
## Read-only discovery per Spec V1.2 §5 · BUILD_RULES §3 HARD STOP

**Date:** July 25, 2026
**Session branch:** `claude/fantasytimes-phase-2-v1-2-u4rss9`
**HEAD at discovery:** `e7d541cce39c8f21a4c0bd619b06d37b420320a7`
**`origin/main` at report time:** `a16a076699c4bfa230c65d3ed68613b855f4cca9` — **moved 5 commits during this session**
**Working tree:** clean (0 modified files) throughout; **zero writes to the repository**
**Governing:** Phase 2 Spec V1.2 §5 (16 items) · BUILD_RULES.md §1/§3/§6/§9 · Wire Spec V1.5 + V1.6
**Status:** **HARD STOP — founder review required before any build**

---

## 0. Preamble — discovery protocol compliance

| BUILD_RULES §3 requirement | Status |
|---|---|
| `git fetch origin` as FIRST step, recorded | ✅ Done at session open (showed `0 0` vs `origin/main`); **re-fetched at report time — main had advanced 5 commits mid-session** |
| Read-only with respect to project state | ✅ No file written, no branch/commit/stash operation, tree clean |
| Every claim carries `file.js:line` + VERIFIED/ASSUMED | ✅ See marker convention below |
| Report written as a file outside the repo tree | ✅ This file, in the session scratchpad |
| Bugs found outside scope reported, not fixed | ✅ §8 register — 40 items, none touched |

**Marker convention used throughout:**

- **VERIFIED (session)** — I personally opened the file and read that line in this session.
- **VERIFIED (dual)** — a discovery agent read it and an *independent adversarial verifier* re-opened the cited line and confirmed it.
- **CONTESTED** — the verifier corrected the original claim; the corrected version is what appears here.
- **ASSUMED** — inference, or inherited from a prior document and not re-read.

**Method.** 11 read-only discovery briefs covering §5 items 1–16, each followed by an independent adversarial verifier instructed to *refute* the brief's load-bearing claims by re-opening every cited line. 22 agents, 966 tool calls. Nine of eleven verifiers returned PARTIAL or REFUTED — the numbers below are the **post-correction** ones. I then personally re-verified the highest-stakes anchors before writing.

**Calibration firewall (§7 / F-M11) honoured.** Discovery consumed coverage and shape statistics only. No error rate, accuracy figure, or observed-correctness statistic was computed or is reported. Nothing here can anchor a threshold to an outcome.

---

## 1. Executive verdict

**Phase 2 cannot be locked as written.** The build items are sound in intent, but four of them name inputs, fields, or files that do not exist at HEAD, and one names a file whose behaviour is not what the spec assumes. None of this is fatal to the arc — every gap has a proposed resolution — but each needs a founder decision before code.

### §5 checklist verdicts

| # | Checklist item | Verdict |
|---|---|---|
| 1 | Verifiability coverage per snapshot shape (**blocking calibration**) | 🔴 **STOP** |
| 2 | `voice-layer-cache.js` sole writer; assembly seam | 🟢 CLEAR |
| 3 | Walker supports today + prior session | 🟢 CLEAR (2027 horizon confirmed) |
| 4 | `bySymbol` excludes quarantined / off-universe | 🟢 CLEAR (guarded twice) |
| 5 | Every persisted entry has a valid digest | 🟡 AMEND (240-char premise false) |
| 6 | Visual seam + ordering vs Wire transaction | 🔴 **STOP** |
| 7 | `vercel.json` 37/40; Sunday slot | 🟡 AMEND (count right, budget contested) |
| 8 | `seedConsensus` fix landed | 🔴 **STOP — not landed** |
| 9 | Rules, cleanup paths, `wireEditorial` deny-block | 🟡 AMEND (retention shape breaks an invariant) |
| 10 | `voiceLayerPrompt.js` seam | 🟡 AMEND (not fenced; must pin the seam) |
| 11 | Prompt constants, `promptVersion` home, headroom | 🔴 **STOP — `promptVersion` does not exist** |
| 12 | Schema/renderer versions; consumers fail closed | 🔴 **STOP — two fields missing, one consumer unknown to spec** |
| 13 | N0 seams (envelope writer + replay) | 🟡 AMEND (design fits; capture point wrong on one seam) |
| 14 | Editorial cost/latency vs serverless deadline | 🟡 AMEND (fits; `activeReporters` undefined) |
| 15 | `GENERATION_SURFACE` manifest | 🟡 AMEND (buildable; CI cannot run the test) |
| 16 | Import-graph test feasibility | 🟡 AMEND (harness exists; nothing to name yet) |

**Tally: 3 CLEAR · 8 AMEND · 5 STOP.**

### The one-paragraph version

The Wire's typed channel is well built and the Phase 2 *design* is a good fit for it — the envelope-borne `generationConfig` idea in particular slots into the existing architecture almost perfectly. But Phase 2 assumes three things that are not true at HEAD: that the market-data snapshot a reporter saw is saved somewhere (it is not), that a `promptVersion` exists to stamp (it does not), and that nothing reads the Wire yet (something does, and it feeds model prompts). Separately, the Phase 2 spec itself is not in the repository, so the 28-row acceptance matrix that is supposed to govern the build cannot be enforced by anyone. Each of these is fixable and none requires redesigning the arc — but they are prerequisites, not build-time discoveries, and the sequencing in §4 does not currently contain them.

---

## 2. STOPs — blocking lock

### 🔴 STOP-1 — The adapters' stated input does not exist

**§5 item 1 · N3.3 · the blocking calibration item**

N3.3 specifies deterministic adapters that recompute a reporter's declared numbers "from the market-data snapshot that was in the generating request." **That snapshot is never persisted.** It is a transient local in all seven seams. Specifically:

- The prompt text is never written anywhere. *VERIFIED (dual)*
- The Wire envelope carries no market data and is **deleted** the moment the transaction succeeds — `batch.delete(envelopeRef)` at `api/_utils/wireWriteThrough.js:391`. *VERIFIED (session)*
- The Wire entry carries only the model's own declared facts plus server chain/digest fields — `wireWriteThrough.js:316-338`. *VERIFIED (session)*
- `wireMetrics` carries stopwatch timings only. *VERIFIED (dual)*
- `indexIntelligence/marketContext` and `sectorRankings/latest` are **overwritten singletons** — a review-time reader gets *today's* market, silently, not the generating day's. *VERIFIED (dual)*

What survives is `dataSnapshot`, a small hand-built field on the public story doc, built to drive the front-end visual.

**Coverage, corrected.** The discovery agent reported 3 of 48 declared-basis slots recomputable with three reporters at strict zero. **The adversarial verifier REFUTED the numerator** and I confirmed the correction myself: `api/fantasytimes/generate-econ.js:345-347` stores `actual` / `estimate` / `previous` — both operands of Neta's `print_vs_expected`. *VERIFIED (session)*. Kim's server-fetched sector `changePercent` and Kai's server-fetched index quotes are likewise stored.

> **Corrected figure: roughly 7–8 of 48 slots strictly recomputable. No reporter is at strict zero.** The denominator of 48 reproduces exactly and is not in dispute.
> Two shapes remain genuinely zero and are worse than merely uncovered — `doug_earnings_preview` and `neta_econ_preview` persist the **model's own restated numbers**. An adapter comparing a declared `consensus_estimate` to `dataSnapshot.epsEstimate` asks the model to agree with itself.

**A second blocker the brief missed, surfaced by the verifier and confirmed by me.** The validator projects each figure down to `{value, unit, basis}` with **no ticker field** — `api/_utils/wireValidator.js:297`, `kept.push({ value: f.value, unit: f.unit, basis: f.basis })`. *VERIFIED (session)*. On every multi-ticker row — `earnings_recap` (1–10 tickers), `sector_rotation` (0–5), `leadership_shift` (1–5) — an adapter **cannot bind a declared figure to a symbol even when the operand is in storage**. Kim's `primaryTicker` is hard-null, so that seam has no fallback binding at all. This is a *contract* defect, not a persistence defect, and re-sourcing snapshots does not fix it.

**Also missed and worth knowing:** `fantasyTimesConsensus/{YYYY-MM-DD}` is date-bucketed, written by five awaited in-request call sites, and **has no delete path anywhere in the repo**. It already carries `revenueActual`/`revenueEstimate`, econ `actual`/`expected`, and per-ticker `percentChange`/`atrMultiple`. It is the obvious re-source for adapter operands and the report the founder was going to get would not have mentioned it.

**Why this blocks lock.** Thresholds, the verifiable-denominator floor, and initial adapter tolerances are all supposed to be calibrated from this item and fixed before results are seen (P10). They cannot be calibrated against a denominator this thin without the resulting numbers being about two reporters and presented as if about the newsroom.

**Founder decision:** persist a typed, versioned, server-sourced snapshot **before** adapter work (proposal: a server-only `fantasyTimesWireSnapshots/{storyId}` written into the *existing* atomic batch at `wireWriteThrough.js:162-173`, riding the existing 30-day cleanup) — or accept thin coverage and set the floor per-shape with the two circular shapes named UNVERIFIABLE in the spec text rather than discovered empirically.

---

### 🔴 STOP-2 — `promptVersion` does not exist

**§5 item 11 · N0 · verified personally**

N0 specifies `generationConfig: { promptVersion, continuityEnabled }` captured at generation time. `continuityEnabled` exists and is resolved three lines above the envelope literal. **`promptVersion` does not exist anywhere in the FantasyTimes or Wire surface.**

A repo-wide grep returns exactly 3 hits, all in the unrelated Correlation Lab (`api/research/correlation-narrate.js:76,82`, `api/research/narrationPhrasebook.js:26`). *VERIFIED (session)*. The Wire declares only `WIRE_SCHEMA_VERSION` and `WIRE_VALIDATOR_VERSION` (`api/_utils/wireContracts.js:14-15`); `fantasyTimesPrompts.js` has no version constant at all.

Writing `promptVersion: undefined` into every envelope would satisfy the letter of N0 and deliver nothing — and **P2-22 would be untestable, because there is no version to bump.** Four decisions must be locked before build: its home, its granularity (one global number vs one per reporter seam — the seams already diverge structurally per V1.6 A4), its scope (system prompt only, or also the tool-schema instruction and model id), and its shape (a resolver function rather than a bare constant, so P2-22 can bump it with the mutable-mock pattern the suite already uses).

**A trap in the obvious implementation.** F-M1 widens `promptVersion` to cover the model id. But two of the nine prompts run a model that **contradicts** their own profile: `fantasyTimesPrompts.js:35` declares Neta as Haiku while `generate-econ.js:527` runs `claude-sonnet-4-6`; same for Doug at `:44` vs `submit-earnings-batch.js:238`. *VERIFIED (dual)*. Any stamp read from `REPORTER_PROFILES` would be a lie for those two — the BUILD_RULES §9 display-agreement failure mode applied to provenance metadata. The stamp must bind to the **same expression passed to `messages.create`**, never to a parallel table.

---

### 🔴 STOP-3 — "Nothing consumes the Wire" is false

**§5 item 12 · verified personally**

Phase 2's opening premise is that nothing consumes the typed channel. `buildContinuityContext` (`api/_utils/wireContinuity.js:29`) reads Wire day docs, iterates `entries`, and pushes `facts.digest` into a **live model system prompt** at `wireContinuity.js:53`. It is imported and called at **seven sites across all six reporter seams** — `generate-pulse.js:291`, `generate-mover.js:232`, `generate-econ.js:295` and `:515`, `generate-recap.js:260`, `generate-column.js:299`, `submit-earnings-batch.js:190`. *VERIFIED (session, all anchors)*.

It is dark today (requires both `CONTINUITY_MEMORY_ENABLED` and `WIRE_WRITES_ENABLED`), but it is **merged code sitting behind the final flip in the documented rollout order** — §4 step 6. Two further read paths exist over persisted entries: the prior-day reads feeding `resolveChainId`, and `rebuildIndexes`. **None of the three checks any version field.** All three fail *open*, rendering on trust — exactly what N1.4 forbids.

This is the highest-consequence read path in the system: an unknown-version digest reaching a model prompt gets echoed into published prose. N1.4's scope must be widened to name these three consumers, and the continuity guard should land **before** the continuity flip, not after.

---

### 🔴 STOP-4 — `digestRendererVersion` has never been written

**§5 item 12 · N1.4 · verified personally**

N1.4 requires consumers to fail closed on an unknown `digestRendererVersion`. A repo-wide grep for `digestRendererVersion|rendererVersion|DIGEST_RENDERER` returns **zero matches**. *VERIFIED (session)*. The field has never existed. The digest is rendered from unversioned module-level tables and persisted with no provenance stamp at `wireWriteThrough.js:325`.

The requirement points at nothing. Either add `WIRE_DIGEST_RENDERER_VERSION` (additive, safe — see §3), or amend N1.4 to gate on `schemaVersion` alone and state that renderer changes are invisible. Also needed: a ruling on `undefined` — every pre-stamp entry will have it, and strict fail-closed would blank the entire historical corpus.

---

### 🔴 STOP-5 — The Phase 2 spec is not in the repository

**Process · A6 has nothing to bind to**

V1.6 rule A6 is a **standing** rule: *"Every acceptance-matrix row must cite a test that fails under the defect it guards. A row evidenced by code inspection is an unfinished row."* The 28-row matrix it governs (P2-1…P2-28) **does not exist in `docs/` or anywhere in the tree.** The governing spec's entire Phase 2 content is a three-line paragraph at `FANTASYTIMES_WIRE_AGENT_FIRST_NEWS_SPEC_V1_5.md:159-161`.

Per `docs/README.md:58`, a missing record must be reported, never reconstructed — so neither I nor the builder can supply the rows. **The V1.2 spec must be committed to `docs/` as a versioned record before lock**, the same way V1.5 and V1.6 were added. Until then the build has no enforceable test contract.

---

## 3. The good news — what holds

Worth stating plainly, because the STOP list is long.

**N0's envelope-borne design is an excellent fit.** I read both seams personally. There is genuinely **one** shared transaction — `runWireTransactionFromEnvelope` at `wireWriteThrough.js:221`, called inline at `:180` and by the sweep at `wireReplaySweep.js:156` — and it reads *only* from the envelope plus `now`. An envelope-borne `generationConfig` reaches both seams with no branching and no carve-out. *VERIFIED (session)*

**The additive field is provably safe.** `payloadHash` is computed at `wireWriteThrough.js:130` — one line *before* the envelope literal is built — and hashes the validator's facts, not the envelope. *VERIFIED (session)*. So an added envelope field cannot perturb the hash, idempotency, or the D9 superseded-attempt semantics V1.6 just settled. Three further confirmations: the envelope's Firestore rules deny wholesale rather than listing allowed fields (no `hasOnly()` rejection risk), no test asserts an exact envelope shape, and the idempotency key is built entirely from pre-model-call values.

> **One hard boundary.** Safe *on the envelope* or *server-stamped into the entry*. **Fatal inside model-emitted `agentFacts`** — the validator is a strict allowlist and an unknown key hard-rejects every story. This must be pinned in the spec text before build.

**The ≤12h15m replay-lag figure is exactly right** and stated in-code at `api/cron/process-pending-reflections.js:105`. I re-derived it from the live cron entry. *VERIFIED (session)*

**Phase 2 touches zero fenced files, and the fence edge the spec worried about is clear.** The §1 list is byte-identical at `e7d541cc` and `a16a0766`. `voiceLayerPrompt.js` is *not* fenced, and the newsLine provably cannot change the bytes of the prompt assembled inside fenced `decide.js`: all four relevant block builders are strict key allowlists, so an added `newsLine` key is invisible to them. **Phase 2 does not need a founder fence gate.** *VERIFIED (dual, with the verifier reversing the discovery agent's contrary claim)*

**Other confirmations:** `voice-layer-cache.js` is the sole writer of the cache doc; the session walker answers "today + prior trading session" holiday-correctly and the Phase 0 2026-only-holiday STOP is genuinely resolved through 2027; `bySymbol` cannot contain a quarantined or off-universe ticker (guarded twice); the import-graph harness N1.1 needs already exists in `archetypeRegistry.test.js`; and all eleven DTO fields the spec lists do exist on a persisted entry.

---

## 4. Amendments the spec must absorb

Condensed; each has full citations in the agent record.

**A. The 240-char ceiling is not bounded by construction (F-M9).** The clause *count* is bounded (≤9). The character count is not — the validator admits any finite double. Measured with the real renderer: **max 363 chars**; a fully-populated `earnings_recap` reaches **exactly 250** at ordinary values; the locked exemplar renders at 106. So the over-ceiling case is a genuine edge, not the norm — but it is reachable, and N1.2 must enforce the ceiling with an **explicit fail-closed check**, not a claim about the renderer.

**B. N5 is aimed at dead code, and the chart cannot honestly draw a level.** `callArtDirector` fires only when a story type is *absent* from a hardcoded table, and every scheduled generator emits a type that is present — so it is **unreachable on every scheduled seam** (operator-invokable via HTTP only). Separately, the dashed level line's position is a constant fraction of chart height (`PriceChart.jsx:69`) over a **synthetic sparkline**; there is no price→y mapping. Feeding it a real validated price renders a true number beside a fabricated position — precisely the display-disagreement class BUILD_RULES §9 exists to prevent. Re-target N5 to `getDefaultVisual`, and rule on label-only vs defer vs drop.
*Good news:* the ordering premise **holds** — validation runs in-request on all seams including the deferred one, so "in-request, never dependent on Wire settlement" is achievable.

**C. `activeReporters` is undefined and two of three readings break the gate forever.** `REPORTER_EVENT_ALLOWLIST` has 5 keys → `minimumSize` 15, under the ceiling. But the live generation *seams* number 7 → 21, and V1.5's own §5 text says "8 … readers" → 24. Under either seam reading **every week is `insufficient` forever** and the "≥2 passing editorial periods" gate can never be satisfied. Pin it to 5 in words, plus a derived-not-literal CI assertion so a future sixth Wire reporter fails CI instead of silently bricking the gate.

**D. The `wireEditorial/{isoWeek}/runs/{runId}` shape breaks the retention invariant.** `cleanup.js:70-74` states the invariant verbatim — all Wire surfaces are flat documents, "so plain deletes orphan nothing" — and deletion is a bare `delete(doc.ref)`. Firestore does not cascade into subcollections, so 90-day retention would **orphan every run record permanently** (~52 orphan sets/year). Flatten to a bounded map inside `wireEditorial/{isoWeek}` (the `receipts`-map precedent), or mandate recursive deletion *and* fix the now-false comment in the same commit.

**E. Deriving the week's sessions by walking back 5 from Sunday spills into the previous ISO week.** Structural, not sampling: `priorTradingSessions` is a fixed-count backward walker with no week boundary, so **every NYSE-holiday week spills** (~9–10/year). A spilled session is reviewed in two periods, double-counting against the entry gate. Derive the ISO week explicitly and filter by `isTradingSession()` instead.

**F. Sunday scheduling needs no DST machinery — but has an undocumented cliff.** A UTC Sunday and its ET date always fall in the same ISO week, because ET is always a negative offset and ISO weeks run Mon–Sun. Structural, not a sampled result. **But** the safe band ends at UTC Sunday 23:59:59: a run at UTC Monday 00:25 files under a week that is a **full week apart**. Any retry or dual-hour widening past midnight UTC files the review under the wrong week.

**G. CI cannot run a changed-path test (P2-15).** The test workflow checks out a single commit — no fetched base object, so `git diff origin/main` fails and a git-diff test would **silently pass on every PR**: the exact "evidenced by nothing" failure A6 exists to stop. Use the committed-baseline mechanism instead (the `identityHash` CI lock in `archetypeRegistry.test.js` is a working precedent whose test name is verbatim the P2-15 contract), or mandate `fetch-depth: 0` *plus* a self-check that fails when the base ref is unresolvable.
*Also:* the spec's stated blind spot is backwards — flags are literal `false` constants with no env override, so a flip **is** a file diff and is catchable. The real no-diff channel is Firestore state read back into prompts.

**H. N1.1 has nothing to name yet, and one target is fenced.** No raw Wire reader module exists — Phase 1 never built one — so the dependency test has no `Y` to forbid until Phase 2 extracts one; §5 does not list that work. Worse, `agentEvalPromptAssembly.js` is a Phase 3 assembly that is **calibration-fenced** and **already imports** the headline/sentiment renderer, so the test as written would be red on day one against a file we may not edit. Scope the Phase 2 test to the non-fenced consumers that exist now and defer the fenced assemblies to a §7-gated row.
*Sharpening F-M6:* `headline` is stored **directly on the Wire entry** (`wireWriteThrough.js:333`), so the explicit-field-copy rule is the *primary* guard and the join guard is secondary. And a static import test cannot stop an inline `db.collection('fantasyTimesStories').doc(dto.storyId).get()` — no import is involved. Pair it with a source-text tripwire.

**I. Doug's preview seam captures at the wrong time.** On six of seven seams the publish call *is* generation time. The seventh — `poll-batch.js:189`, the only `deferTransaction: true` in the repo — is a **result retriever**; the model ran hours earlier in a batch submitted at 05:00 UTC. Capturing `generationConfig` at the publish call would stamp poll-time config on it. Fix: carry it on the batch doc exactly as `wireMarketDate` already is — and gate it identically, or the merged-dark build changes persistence on a production collection (M8).

**J. Legacy envelopes must not be destroyed by an unguarded read.** Envelopes written before the N0 deploy carry no `generationConfig` and can sit unreplayed across the deploy boundary. An unguarded `envelope.generationConfig.promptVersion` throws; the sweep's catch treats it as a generic failure, and after the attempt cap the story is terminated as `replay_exhausted` with **the envelope deleted** — facts lost. Spec a mandatory optional read with an explicit legacy sentinel, and state that null means "generated before N0", not "continuity was off".

**K. The cron budget is contested.** `vercel.json` has exactly 37 entries — confirmed independently. But `origin/main`'s **new** BUILD_RULES §6 bullet allocates "at most 2" to the **tournament build**, not the Wire arc. 37 + 2 + 1 = **40/40, zero headroom**, against a ceiling BUILD_RULES itself labels "assumed". This is a founder allocation decision, not a rule that can be read off. A clean collision-free slot exists at `25 9 * * 0`.

**L. newsLine lands on a client-readable surface.** `firestore.rules:597` grants `allow read: if request.auth != null` on `voiceLayerCache/{battleId}` with no ownership predicate. *VERIFIED (session)*. This would be the first time Wire-rendered content reaches a client-readable doc. It is defensible — the digest is deterministically rendered from validated typed fields, never model prose — but it should be a **recorded decision**, not a default.

---

## 5. Sequencing implications

The §4 sequence needs prerequisites inserted before step 1:

| Order | Work | Why |
|---|---|---|
| **P0** | Commit the V1.2 spec + 28-row matrix to `docs/` | STOP-5 — A6 cannot bind to an absent document |
| **P0** | Re-cut the branch from `origin/main` @ `a16a0766` | Tree moved mid-session; all Phase 2 target files byte-identical, so this is a rebase |
| **P1** | Founder ruling on `seedConsensus` (land / split N4 / defer) | STOP — N4 is explicitly gated on it, and V1.6 A7 makes it a pre-flip gate today |
| **P1** | Define `promptVersion` (home, granularity, scope, shape) | STOP-2 — N0 and P2-15 both depend on it |
| **P2** | Decide the adapter input: persist snapshots, or narrow the criterion | STOP-1 — thresholds cannot be calibrated first |
| **P2** | Extract the raw Wire reader | N1.1 has nothing to forbid without it |
| **P3** | Then §4 as written |

Note that **N1.4's fail-closed guards should land before the continuity flip** (§4 step 6), not after — landing them later means shipping a known fail-open path to production.

---

## 6. Acceptance-matrix constructibility

Assessed against the harness as it exists. Two corrections from the verifier are load-bearing:

- **P2-1 ("zero Wire reads") is CONSTRUCTIBLE today.** The discovery agent said new infrastructure was needed; the verifier found `api/_utils/__fixtures__/masteryMockDb.js` already implements read accounting and is already used for exact read-count assertions on a cron handler. Struck.
- **Flag-off byte-identity needs care:** the cache write is a *batched* set and one field is a non-deterministic `serverTimestamp()` sentinel, so a naive object-equality assertion will not work.

**Known holes (F-M10 requires these be recorded, not left implicit):**

1. **P2-18** — its stated trigger does not fire: validation runs in-request even on the deferred path, so the deferred-transaction fault injection is not *forced* by the ordering. Keep as a regression lock or drop — founder call.
2. **P2-15** — not constructible as a git-diff test in this CI (Amendment G).
3. **P2-28** — not constructible as specified while a fenced file is in the target set (Amendment H).
4. **P2-22** — not constructible until `promptVersion` exists (STOP-2).

A full row-by-row pass is deferred until the matrix is actually in the repo (STOP-5).

---

## 7. Decisions required from the founder

**Blocking lock:**

1. **Adapter inputs** — persist a server-sourced snapshot first, or narrow the criterion and name the two circular shapes UNVERIFIABLE in spec text?
2. **`promptVersion`** — home, granularity (global vs per-seam), scope (prompt only, or + tool schema + model id), shape.
3. **`seedConsensus`** — land the fix, split N4, or defer N4 wholesale?
4. **Commit the V1.2 spec to `docs/`** — required before A6 can bind.
5. **Cron allocation** — does the Wire arc get entry #38 against a 40/40 projection on an assumed ceiling?
6. **newsLine's home** — accept the client-readable surface, tighten the rule, or re-home server-side?
7. **N5 scope** — re-target to `getDefaultVisual`; and label-only, defer, or drop the level line?
8. **`wireEditorial` shape** — flat map (recommended) or subcollection with mandated recursive deletion?
9. **Adapter tolerances** — must be fixed at lock per F-M4; cannot be set until decision 1 resolves.

**Also needs a ruling:** whether N0 additionally fixes the pre-existing re-derivation instances (below), or they go to separate tasking.

---

## 8. Separate-tasking register

BUILD_RULES §3: *found a bug outside your task? Report it; do not fix it.* **Nothing below was touched.** 40 items surfaced; the ones bearing directly on Phase 2:

**The F-B1 defect class is already live at HEAD** (I verified these personally). Inside the shared transaction, four values are re-derived at commit time instead of carried on the envelope:

| Field | Line | Consequence on replay |
|---|---|---|
| `schemaVersion` | `wireWriteThrough.js:318` | Replayed entry stamped with the **current** schema version while its sibling `validatorVersion` (`:328`) correctly reports the old one — the two fields openly contradict. **This is the field N1.4 tells consumers to trust.** |
| digest render | `:325` | A template change silently rewrites replayed history and the continuity block that reads it |
| `EVENT_CONTRACTS` row | `:298` | A contract amendment retroactively changes a replayed entry's `subjectRef` ownership and `macroEligible` |
| `observedAt` | `:327` | Sweep wall-clock (up to 12h15m late) while `publishedAt` on the same entry is envelope-borne — two time origins in one object |

None has test coverage. `schemaVersion` is the cheapest and most defensible companion fix to N0 — it becomes envelope-borne exactly like `promptVersion`, and its sibling already is.

**High severity, unrelated to Phase 2:**

- `poll-batch.js` — `const results` at `:99` shadows the outer accumulator at `:75`, producing a TDZ `ReferenceError` on every still-processing batch. Doug's preview pipeline stalls before any story is written.
- `seedConsensus` still wipes same-day economic events at HEAD (Phase 0 §5.2, re-confirmed).
- `src/prompts/fantasyTimesPrompts.js` — 567-line drifted duplicate of the server prompts whose only importer is an `.ARCHIVED.jsx` file; a prompt edit there is a silent no-op. Pins a deprecated model id.
- Neta-preview and Doug-preview run Sonnet while their profiles declare Haiku (BUILD_RULES §9 class).

**Medium, Phase-2-adjacent:** `voice-layer-cache.js` has **no handler-level test at all** (its 1186-line suite is pure-function only) — real unbudgeted work for P2-1; a single try/catch spans the whole handler so one battle's throw drops the cache write for **all** battles that tick; `npm run test:rules` invokes a `firebase` binary that is not installed, so P2-21 is unrunnable as written; no `deploy:indexes` script exists though V1.6 A7 gates the flip on it; four ticker symbols (TGT, BX, PNC, ALLY) are in producer universes but outside the Wire universe and will quarantine on flip; `voiceLayerCache` reads are not ownership-scoped.

The full 40-item register with citations is in the agent record.

---

## 9. What this discovery did NOT do

Stated plainly so the gaps are not mistaken for clearances:

- **No error rates, accuracy figures, or correctness statistics** were computed — §7 firewall.
- **No tests were executed.** `node_modules/` is empty in this container; `vitest` cannot start. Every "the suite passes" style claim was downgraded to ASSUMED.
- **No history archaeology is admissible.** This is a **shallow clone** (`.git/shallow` present, 236 commits reachable). `git blame` shows a graft-boundary marker, not authorship. Any "unchanged since" claim is ASSUMED — including the `seedConsensus` dating, whose *conclusion* survives on the HEAD read alone.
- **No live production data was read** — all shape claims are from code.
- **The 28-row matrix was not assessed row-by-row**, because it is not in the repository (STOP-5).
- **Five `voiceLayerCache` readers were not audited** — `voiceLayerAnticipation.js:81`, `voiceLayerTradeNarration.js:77`, `chat.js:297`, `ensure-opener.js:191`, `tournamentBoardAutoCommit.js:88` (the last confirmed newsLine-safe). These are exactly the surfaces a newsLine must be threaded through.

---

*Read-only discovery. No repository file was created, modified, or deleted. HARD STOP for founder review per BUILD_RULES §3 and Phase 2 Spec V1.2 §9.*
