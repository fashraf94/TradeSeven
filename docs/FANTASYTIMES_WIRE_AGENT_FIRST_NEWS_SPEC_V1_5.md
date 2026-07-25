# FANTASYTIMES WIRE — AGENT-FIRST NEWS ARC
## Specification V1.5 (Final-Lock Candidate)

**Date:** July 24, 2026
**Author:** Claude (spec author) — for CC (Opus 4.8) execution
**Status:** ALL REVIEW ROUNDS COMPLETE — Fable pre-assessed "lockable" conditional on the fixes below, now applied. **FINAL LOCK on founder confirmation → CC builds Phase 1.**
**Supersedes:** V1.4, V1.3, V1.2, V1.1, V1.0
**Review trail:** Fable (V1.0→V1.1) · ChatGPT (V1.1→V1.2) · Phase 0 discovery @ `dd28eedf` + founder rulings D6–D8 (→V1.3) · ChatGPT diff-scoped (→V1.4) · Fable diff-scoped (→V1.5, this document).

---

## 0. V1.5 Changelog (Fable diff-scoped review, Jul 24)

| # | Finding | Resolution |
|---|---------|------------|
| F2-1 **BLOCKER** | REJECT envelope carve-out loses rejection counts under Wire-write failure, biasing the §6.1 gate optimistic; `envelopeMissing` conflates benign reject noise with passed-story data loss | **Uniform envelopes:** every outcome writes an envelope carrying `outcome`; the sweep replays what the outcome requires. Carve-out deleted; `envelopeMissing` becomes an unambiguous alarm with acceptance expectation **zero** (§4.5, §4.7, §9) |
| F2-2 | `payloadHash` had no canonicalization contract — false conflicts by construction (key-order-sensitive serialization) | Hash = canonical serialization (recursively sorted keys) of normalized `ModelAgentFacts`, computed **once at envelope creation**; the sweep compares the stored hash and never re-derives. Stability test added (§4.5, §9) |
| F2-3 | `wireValidation` reason strings on the public story doc leak model output around the whitelist via the error channel | Public story doc carries **class codes only** (e.g. `R1`, `R4_CONTRACT`, `SALVAGE_KEYLEVEL`); full reason strings live in the envelope and receipt, server-side. Pipeline-state visibility (`wirePending`, `wireConflict` class) accepted and documented. Negative content test added (§4.3, §9) |
| F2-4 | All-must-fail rules suite can pass vacuously (misloaded ruleset → everything fails → green) | **Positive controls** added: the public story read (`firestore.rules:548-551`) must succeed and one known-allowed privileged op must succeed in the same run (§9, §12) |
| F2-5 | Metrics have no named sink — CC would improvise | Server-only **`wireMetrics/{date}`** doc: bounded per-seam samples (cap 500/seam/day) + counts; percentiles computed at review; same rules tests, same 30-day cleanup ride (§4.8) |
| F2-6 | Sweep cadence vs Phase 3's pre-market reader — deferred/replayed entries can land after the 00:45→13:00 UTC sweep gap | Recorded as a **named Phase 3 input** (§6) with the three options. Factual correction folded in: Doug **recaps** are inline-by-default (unaffected except on failure); the collision applies to always-deferred **previews** and any failure-replay path |
| F2-7 | P3's wording predates the atomic story+envelope batch coupling | Explicit trade statement added to P3/§4.5: atomicity bought with an infrastructure-failure coupling whose correlation with a standalone story-write failure is ~1; *validation* outcomes still never block publication |
| F2-8 | Replay-order chain fragmentation on failure days | Accepted as a documented limitation (§4.6); no repair machinery — cosmetic, confined to failure days |
| F2-9 | Adding `NYSE_HOLIDAYS_2027` to one of nine copies widens known drift | Noted on the platform-hygiene backlog entry: consolidation task informed the divergence grew (§14) |
| F2-10 | DST/double-fire receipt check tested sweep-side only | Inline-path variant made explicit: a pre-existing receipt encountered at §4.5 step 4 → inline Wire-path no-op (§9) |

Fable confirmed untouched-and-correct: receipt conflict rules terminate every path; "receipt hit IS success"; the P8(d) effects table and "cannot weaken any block"; R2-M6's two-outcome wake-predicate commitment; metrics-first flip ordering; bidirectional orphan drain.

---

## 1. Purpose (per D6)

At HEAD, FantasyTimes prose and sentiment already reach two models at three live render sites, plus a standing directive:

| | Site | Carries | Model |
|---|------|---------|-------|
| A | `agentTriggerGate.js:170-173` → `agentEvalPromptAssembly.js:914-917` | `[reporter, time-ago, sentiment] "headline"` under "TRIGGER (why you were woken up)" | Haiku eval |
| B | `agentNewsContext.js:265` → `agentEvalPromptAssembly.js:988` | headline + SENTIMENT + per-reporter weighting prose | Haiku eval |
| C | `agentNewsContext.js:296-301` → `agentEvalPromptAssembly.js:997` | headline + sentiment fallback (B/C mutually exclusive) | Haiku eval |
| D | `decide.js:359-374` → `agentPromptAssembly.js:239-251` | reporter/beat/headline/time-ago in the system prompt | Sonnet strategy |
| E | `agentEvalPromptAssembly.js:154-159, 376-380` | **S5 "News-Catalyst Momentum"** — standing directive: enter on positive-sentiment stories, exit on negative | Haiku eval, every call, both game modes |

Only the ≤120-char headline renders. **The arc replaces this unstructured, sentiment-carrying channel with a typed, validated, non-directive one, and retires the standing directive.** Phase 1 builds the typed channel; Phase 3 performs the migration. P1/P7 are rollback targets with addresses.

---

## 2. Design Principles

**P1 — Facts, not directives** *(rollback target; realized at Phase 3)*. `recommended_action`/`sentiment` never appear in any Wire field or Wire-sourced render. Enforced by strict allowlist projection.

**P2 — Fact-agreement by construction.** Digest rendered server-side from validated typed fields by deterministic per-eventType templates. Derivation correctness and prose↔facts agreement are editorial-review jobs.

**P3 — Human path never blocked by validation; publication coupled to the envelope by design (F2-7).** No *validation* outcome ever blocks a story — REJECT, SALVAGE, QUARANTINE, and truncation all publish. Story publication IS atomically coupled to the envelope write (one batch, §4.5): an envelope-write failure kills the story too. This is a deliberate trade — same service, same commit, failure correlation with a standalone story write is ~1 — buying the guarantee that a published story always has replayable Wire state. Wire *transaction* failures never block anything; they defer to the sweep.

**P4 — Fence posture.** Phases 1–2: zero fenced files. Phase 3: §7 arc.

**P5 — Reflexivity exclusion.** Agent Beat stories never Wire-written, never agent-visible.

**P6 — Cron discipline.** 37/40; zero new slots Phases 1–2 except the weekly editorial cron (D4). Sweep rides `process-pending-reflections.js`.

**P7 — Agent renders consume Wire typed fields and rendered digests only** *(rollback target; realized at Phase 3)*. Headlines excluded from all agent renders and all upstream generation context.

**P8 — Influence yes, compulsion no (D5).** (a) Wire content enters only through existing informational render sites A–D as digest payloads; no directive rule references Wire content; S5-class rules retired, not migrated. (b) The trigger gate is a wake gate (`agentTriggerGate.js:180`); Wire may wake, never name an action; Phase 3 resolves the wake predicate's own inputs (§6). (c) Hard token caps at every injection point (Phase 3 sets numbers). (d) Effects table:

| Component | Runs | Input source | Effect class |
|---|---|---|---|
| Risk manager (`agent-evaluate.js:1313, 1334-1335`) | **Upstream of the model**, unconditional | Price/ATR/portfolio thresholds — executes before news is fetched at `:1800`; cannot see any prompt | **Force** exit/swap (no model involved) |
| `applyGuardrails` (`:2025`) | Conditional (`agentGuardrails.js:225-227`) | Price/portfolio + deployed guardrail params | **Force** exit |
| Risk-LOCK enforcement (`:2071-2135` stack) | Unconditional post-model | Risk state | **Block** |
| Distressed-regime block | Unconditional post-model | Regime state | **Block** |
| `validateTradeDecision` | Unconditional post-model | Decision shape + portfolio | **Validate/reject** → HOLD |
| Knob B hurdle floor | Unconditional post-model | Score thresholds | **Block** marginal entries |
| Knob C circuit breaker | Unconditional post-model | Loss thresholds | **Block/clamp** |

Every force/block/clamp component reads exclusively deterministic price/portfolio/threshold state; none reads prompt context. Wire content can influence what is proposed, can never force, and cannot weaken any block. Exact per-check semantics re-verified in Phase 3 discovery.

### 2.1 Rationale of record

The Regime Revamp's S5 dissolution was decided but never built; S5 ships at HEAD. This arc's Phase 3 builds it. D5 stands (two-pass freeze rejected; DRB/rankings/render-site precedent). Interim discrepancy in DRIFT_LEDGER (§13).

---

## 3. Arc Overview

| Phase | Content | Fence contact | Gate |
|-------|---------|---------------|------|
| **1** | Typed channel: model contract + validator + renderer + Wire doc + receipts + uniform envelope/replay + walker + `deriveMarketDate` + continuity + metrics | None | **FINAL LOCK (founder) → build** |
| **2** | voiceLayerCache newsLine + few-shot curation + editorial cron + orphaned-reader cleanup | None | Phase 1 merged + gate data |
| **3** | The migration: payload swap A–D + S5 retirement + wake-predicate resolution + golden regeneration + sweep-cadence resolution (F2-6) | `agentEvalPromptAssembly.js`, `decide.js` (§7) | Dedicated spec + §6.1 gate |
| **4** | Agent Beat desk (user-only) | None | Dedicated spec; P5/P7 pre-locked |

---

## 4. Phase 1 — Detailed Design

### 4.1 Schema split (unchanged)

`ModelAgentFacts`: `eventType, tickers[], direction, magnitude, keyLevel, figures[] (cap 4), qualifiers[] (cap 3)` — closed enums per §4.4. `PersistedAgentFacts` adds: `schemaVersion: 'wire-1.5'`, server-canonical `primaryTicker`, `offUniverseTickers[]`, rendered `digest`, `chainId`, `observedAt`, `validatorVersion`. Vera excluded v1. Story `type` and `eventType` coexist.

### 4.2 Validator (unchanged)

Strict allowlist projection (unknown keys → REJECT); R1–R4 + R5 truncation (`stop_reason === 'max_tokens'` → outcome `truncated`; `max_tokens` raised under flag only); SALVAGE for invalid optional fields; QUARANTINE for zero-in-universe-ticker company events (entry written flagged, excluded from indexes); F1 normalization (uppercase + dot→hyphen) → membership in `TICKER_TO_SECTOR` (D8). Derived-not-literal enum contract test.

### 4.3 Wire document + public-surface hygiene (F2-3)

Daily doc: append-only `entries[]`; `bySymbol`/`macroEntries` as storyId indexes rebuilt from entries in every transaction; `receipts` map — `{ storyId, outcome, payloadHash, validatorVersion, createdAt }`; `validationStats` incl. `idempotencyConflicts`, `envelopeMissing`. Sizing per corrected volumes; ~350KB worst case; shard escape hatch recorded. Server-only; `masteryCorrections` precedent.

**Public story doc carries pipeline state, never pipeline content:** `wirePending` (boolean — sweep query), `wireConflict` (class code, conflict path only), and `wireValidation` as **class codes only** (`{ outcome, codes: ['R4_CONTRACT', …], validatorVersion }`). **Full reason strings — which may echo model-emitted content — live exclusively in the envelope and receipt, server-side.** The story doc is public-unauthenticated (`firestore.rules:548-551`; `feed.js:34-36` spreads whole docs); pipeline-state visibility is accepted and documented; content leakage through the error channel is negative-tested (§9). `agentFacts` never appears on the story doc at any depth.

### 4.4 Contract table (unchanged from V1.3/V1.4)

Kai/`market_pulse` → technical_break, volume_surge, volatility_event, index_move · Alex/`market_mover` (in-process scan path) → market_mover, gap_event · `macro_alert` producer-dead, inert · Neta → econ_print, econ_preview (direction null) · Doug → earnings_recap; earnings_preview (direction null, deferred path) · Kim/`sector_column` → sector_rotation, leadership_shift · Vera excluded. Per-eventType required fields, closed basis enums, subjects, sign convention, cardinality, families, macro eligibility (allowlist + pre-strip intent): per V1.2 §4.4 as re-grounded in V1.3.

### 4.5 Write choreography (F2-1 uniform envelopes; F2-2 hash contract)

At the story-write boundary (post-suppression), under `WIRE_WRITES_ENABLED`:

1. **Extract + validate + render in memory.** `agentFacts` pulled from tool input into a private local; never placed on the story object.
2. **Pre-allocate story doc ref.**
3. **Atomic batch:** story doc (whitelisted fields + `wireValidation` class codes + `wirePending: true`; NO `agentFacts`) + **envelope** `fantasyTimesWireEnvelopes/{storyId}`:
   `{ storyId, idempotencyKey, payloadHash, marketDate, outcome, modelAgentFacts (normalized; null for REJECT/truncated where projection failed), validatorResult (full reasons), headline, publishedAt }`.
   **Every outcome writes an envelope** — PASS, SALVAGE, QUARANTINE, REJECT, truncated. No carve-outs: one code path, and a missing envelope is always an anomaly.
   **`payloadHash` contract:** hash over a canonical serialization (recursively key-sorted) of normalized `ModelAgentFacts` (or of the raw projected input for REJECT), computed **once here**; replay compares the stored hash and never re-derives from a re-serialized object.
4. **Wire transaction:** reread today's doc → receipt check (**a pre-existing matching receipt here → inline Wire-path no-op**, F2-10) → per outcome: PASS/SALVAGE → entry + receipt + stats + chainId; QUARANTINE → flagged entry + receipt + stats; REJECT/truncated → receipt + stats only.
5. **Cleanup batch:** clear `wirePending` + delete envelope.

Failure at 4/5 → sweep. Failure inside 3 → atomic, no partial state (the P3 coupling, stated there). `deriveMarketDate(instant)` stamps the immutable bucket at key creation, pre-model-call. Per-seam `triggerRef` table, Neta canonicalization, DST double-fire, Doug `custom_id` caveats: as V1.3.

### 4.6 Chains, walker, continuity (F2-8 noted)

Walker: new; single `marketSchedule.js` holiday source (+ `NYSE_HOLIDAYS_2027`, published); injected instant; window = 5 completed sessions strictly prior + current; coverage guard fires beyond the maintained horizon (2028+). Transactional chain resolution, self-rooting, inheritance, family keys, headline-free continuity block: unchanged. **Documented limitation (F2-8):** an entry landing via replay may post-date same-day entries that would otherwise have inherited its chain, fragmenting that family for that day. Cosmetic, confined to failure days; no repair machinery by design.

### 4.7 Reconciliation sweep (F2-1 uniform replay)

Host: `process-pending-reflections.js` via exported `runWireReplaySweep(db, opts)`, isolating try/catch, host's budget-deferral shape. Query: `wirePending == true` orderBy `publishedAt`; composite index declared.

Per pending story:
1. Fetch envelope by storyId. **Missing → unambiguous alarm:** `wireConflict: 'envelope_missing'`, clear flag, increment `envelopeMissing`, log loudly. Acceptance expectation for this counter is **zero** — there is no benign population (F2-1).
2. Receipt lookup by `idempotencyKey` in the envelope's `marketDate` doc:
   - No receipt → run the Wire transaction **from the envelope, per its `outcome`** (PASS/SALVAGE → full entry; QUARANTINE → flagged entry; REJECT/truncated → receipt + stats only) → cleanup.
   - Receipt, same `payloadHash` + same `storyId` → completed (post-commit race); clear flag, delete envelope. **Receipt hit IS success.**
   - Receipt, same key, different `storyId` or different hash → idempotency conflict: `wireConflict` with mismatch class, clear flag, delete envelope, increment `idempotencyConflicts`. Terminates; surplus story is story-side, out of scope.
3. Orphaned envelopes (no matching pending story) older than one sweep interval → delete + log.

Doug's `poll-batch.js` (10s) stamps stories + envelopes + `wirePending` via batch, never transacts inline; sweep completes ≤15 min typical, 12h15m worst. Any 60s endpoint may defer on budget exhaustion.

### 4.8 Flags, metrics sink, rollout (F2-5)

| Flag | Governs |
|------|---------|
| `WIRE_METRICS_ENABLED` | Timing instrumentation only; never touches the model request object or persisted story content. **Sink: server-only `wireMetrics/{date}`** — per-seam bounded samples (cap 500/seam/day) + counts; percentiles computed at review; same rules tests as the other server-only collections; 30-day retention on the cleanup ride |
| `WIRE_WRITES_ENABLED` | Cloned extended schema + prompt instructions + extraction + validation + rendering + batch/transaction/receipt/envelope machinery + chainId + raised `max_tokens` |
| `CONTINUITY_MEMORY_ENABLED` | Continuity prompt block only (requires `WIRE_WRITES_ENABLED`) |

Clone-never-mutate; byte-identical flag-off payload; private extraction (story whitelist never widened for `agentFacts`). Rollout: `WIRE_METRICS_ENABLED` → ≥3 trading days baseline → `WIRE_WRITES_ENABLED` → ≥2 trading days solo → `CONTINUITY_MEMORY_ENABLED`. Dark-solo seam reality (macro dead, mover HTTP dead) as V1.3.

---

## 5. Phase 2 — Outline (unchanged)

newsLine inside `voice-layer-cache.js`; editorial review with 8 per-reporter `dataSnapshot` readers joining source values + prose↔facts sampling; few-shot curation; weekly editorial cron (D4); `economicCalendar` orphaned-reader + rules-comment cleanup after the founder's `seedConsensus` fix; Art Director keyLevel uplift.

## 6. Phase 3 — The Migration (F2-6 added; dedicated §7 spec; DO NOT BUILD)

Scope: (1) payload swap at sites A–D; (2) S5 retirement (`agentEvalPromptAssembly.js:154-159, 376-380`, both variants); (3) golden regeneration as explicit deliverable; (4) P8(c) token caps; (5) wake-predicate resolution — audit every `shouldEvaluate` input + `news_catalyst` significance scoring; commit to sentiment-independence proof OR typed event-presence replacement; structural post-migration test that no `sentiment`/`headline` field reaches the wake decision or any rendered payload; (6) **sweep cadence vs pre-market readers (F2-6):** always-deferred entries (Doug previews) and failure-replays landing in the 00:45→13:00 UTC sweep gap will post-date a pre-market watchlist scan. Phase 3 must choose: pre-market sweep invocation on the host, OR the scan reads pending envelopes, OR the lag is accepted explicitly. Recorded now so Phase 3 doesn't rediscover it. (Doug **recaps** are inline-by-default and unaffected except on failure.) Before/after behavioral comparison required. Registry deferred (D7).

### 6.1 Entry gate (unchanged from V1.4)

≥40 non-quarantined entries OR ≥10 trading days (founder discretion); REJECT <10%; SALVAGE <20%; `wirePending` unreconciled = 0, failure <2%; `idempotencyConflicts` reviewed, zero unexplained; **`envelopeMissing` = 0**; editorial derivation-error <5% stratified; ≥2 passing editorial periods; p95 baseline captured via metrics flag.

## 7. Phase 4 — Outline (unchanged)

Agent Beat desk, user-only, P5/P7 pre-locked, own spec.

---

## 8. Review + discovery status

Phase 0 complete (Q1–Q15; STOPs ruled D6–D8; A1–A19 dispositioned in V1.3 §0). ChatGPT R2 dispositioned in V1.4 §0. Fable R2 dispositioned in §0 above. **Four adversarial rounds + one code-grounded discovery. No open findings.** Phase 3 opens with the wake-predicate audit and the F2-6 cadence decision.

---

## 9. Acceptance Criteria (Phase 1 — final; amendments to V1.4 §9)

All V1.4 criteria stand except as superseded. Added/changed:

- **Uniform-envelope replay (F2-1):** kill after batch on a REJECT story → sweep lands the reject receipt + stats increment from the envelope; kill after batch on PASS/SALVAGE/QUARANTINE stories → sweep lands the correct artifact class for each. `envelopeMissing` remains 0 across the entire test matrix.
- **Hash stability (F2-2):** identical normalized facts constructed with permuted key order → identical `payloadHash`; replay never recomputes (asserted by instrumentation or code inspection + a mutation test).
- **Error-channel content (F2-3):** for every REJECT/SALVAGE case in the validator test matrix, the public story doc's `wireValidation` contains only class codes — no model-emitted string, fragment, key name, or value appears anywhere on the public doc.
- **Rules suite positive controls (F2-4):** the same run asserts the public story read succeeds and one known-allowed privileged op succeeds; all Wire-doc, envelope, and `wireMetrics` reads/writes fail for unauth, ordinary auth, and each privileged role.
- **Inline receipt no-op (F2-10):** DST double-fire arriving **inline** (step 4 finds an existing receipt) → inline Wire-path no-op; sweep-side variant retained. Both asserted.
- **Metrics:** `wireMetrics/{date}` populated with bounded samples under the metrics flag; payload equality holds with metrics on, writes off.
- Envelope round-trip, private extraction per writer, receipt-hit clearing, idempotency conflict termination, walker 2026→2027 traversal + 2028 guard, warm-container M8, truncation, sweep isolation, Doug deferral, Neta alias degradation, `deriveMarketDate` determinism: as V1.4.

---

## 10. Decisions (cumulative)

D1 30-day retention · D2 5-session family-keyed chains, inheritance, window = 5 strictly prior + current · D3 REJECT/SALVAGE tiering · D4 editorial cron: spend · D5 influence/compulsion; two-pass freeze rejected · D6 arc-as-replacement; S5 retirement in Phase 3; DRIFT_LEDGER entry · D7 Phase 3 = migration; registry deferred · D8 universe = `TICKER_TO_SECTOR`. All decided by Flash, Jul 24.

## 11. Out of Scope / DO NOT MODIFY (Phase 1)

All calibration-fence files · `agent-evaluate.js` / `voice-layer-cache.js` read-only · V3 broadsheet · `seedConsensus` (founder fix in flight) · dead-path revival · repo-wide date/holiday consolidation · story-side dedup.

## 12. Process + founder pre-flip actions

**FINAL LOCK on founder confirmation of this document** — Fable's conditions are applied; no fifth review round is recommended (the V1.5 diff is exactly Fable's prescription). Build proceeds on `claude/fantasytimes-wire-news-spec-m5side`: phased, flag-gated, `/code-review` at high effort per threshold policy, preview smoke per §9, PR, manual merge by Flash. ONE TASK = ONE BRANCH. Pushed ≠ deployed.

**Founder pre-flip actions:** (1) export the deployed ruleset; run the committed rules suite — **including positive controls** — against it; review every wildcard match overlapping `fantasyTimesWire`, `fantasyTimesWireEnvelopes`, `wireMetrics` (OR-semantics); (2) confirm ≥3-day metrics baseline before `WIRE_WRITES_ENABLED`; (3) confirm the weekend `seedConsensus` fix landed.

## 13. DRIFT_LEDGER entry (paste-ready, unchanged)

> **S5 "News-Catalyst Momentum" — decided dissolved, still live.** Regime Revamp dissolved news-as-entry-signal; at HEAD `dd28eedf`, S5 ships in both game-mode variants of the eval system prompt (`agentEvalPromptAssembly.js:154-159, 376-380`), directing entries on positive-sentiment FantasyTimes stories and exits on negative. Retirement is scoped into FantasyTimes Wire Phase 3. Until then, live behavior contradicts locked design. Owner: Wire arc. Recorded Jul 24, 2026.

## 14. Separate tasking register (F2-9 noted)

5.2 `seedConsensus` wipe — founder-owned, weekend Jul 25 · 5.1 poll-batch TDZ shadowing — next up · 5.8 ticker casing — folded into F1 · 5.3–5.7 backlog · **Holiday-copy consolidation: note that this arc added `NYSE_HOLIDAYS_2027` to `marketSchedule.js` only — the eight sibling copies are now further divergent (F2-9)** · ET-date consolidation, `fantasyTimesTickers` reconciliation, `src/prompts` duplicate drift — platform-hygiene backlog.

---

*FANTASYTIMES_WIRE_AGENT_FIRST_NEWS_SPEC_V1_5.md — V1.5 — July 24, 2026*
