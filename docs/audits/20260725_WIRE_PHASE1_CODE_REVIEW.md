# FantasyTimes Wire — Phase 1 Code Review

**Scope:** `git diff 2fd8dc66..9d1c11d7` on `claude/fantasytimes-wire-news-spec-m5side` — the Wire Phase 1 build (39 files, +4,317/−33).
**Date:** July 25, 2026
**Standard:** BUILD_RULES §2 (`/code-review` mandatory at ≥10 files OR ≥1500 lines).
**Method:** the packaged `/code-review` skill is not present in this harness, so the equivalent was run at high effort: **seven independent adversarial reviewers**, one per dimension, each instructed to find defects rather than confirm correctness, each permitted to execute repros and mutation tests in a scratch tree. **309 tool calls, 41 executed repros.** The two most severe findings were then re-verified personally by the session lead before any fix was written.

**Result: 53 findings — 3 critical, 16 high, 23 medium, 11 low.** 27 fixed on this branch; 26 reported below with a disposition.

---

## 1. Executive summary

| | |
|---|---|
| **Would the feature have worked as merged?** | **No.** The reconciliation sweep was unreachable on the common cron tick, so Doug's entire earnings-preview seam — which never transacts inline by design — would have left stories permanently `wirePending` with their Wire facts never landing. |
| **Was the safety thesis intact?** | **No.** Model free text could reach the agent-facing digest through an unvalidated `primaryTicker`, defeating P2's core promise that "the model does not write the digest". |
| **Did the tests prove what the report claimed?** | **Partly.** One load-bearing concurrency test was structurally incapable of failing, and the shipped flag values had zero coverage. Both now fail against the defects they exist to catch. |
| **Was the merge actually dark?** | **Almost.** One field was persisted to a production collection with all flags off. Fixed. |
| **State now** | Full suite **324 files / 5,772 tests / 0 failures**; Wire-only **124 tests** (measured). All three flags still ship FALSE. |

The build's structural choices held up: fence posture, cron budget, rules posture, index shape, the queue-flag pattern, the receipts-as-map retention design, and F2-3's class-code discipline in the validator were all probed hard and confirmed correct (§5).

---

## 2. The three criticals

### C1 — The replay sweep was dead code on almost every tick
`api/cron/process-pending-reflections.js:54` · found by two independent dimensions · **verified personally**

The sweep was placed after an early `return` that fires whenever the reflection queue is empty:

```js
if (snapshot.empty) {
  return res.status(200).json({ ...summary, message: 'No pending reflections' });
}
…                       // reflection loop
// ---- 4. Wire sweep ----   ← never reached
```

An empty reflection queue is the **steady state** — this very cron clears the flag in the same tick it processes it, and no battles complete on weekends. So on the large majority of ~48 daily ticks the sweep never ran.

Blast radius: `poll-batch.js` stamps Doug's previews with `deferTransaction: true` and depends **100%** on the sweep. Those stories would sit `wirePending: true` indefinitely, their envelopes never drained, their facts never entering the Wire — while the §6.1 gate's "unreconciled = 0" criterion silently failed.

**Fixed:** the empty case no longer returns; it logs and falls through, with the `message` field preserved in the response.

### C2 — The concurrency test could not fail
`api/_utils/__fixtures__/wireFirestoreFake.js:182`

The fake detected transaction contention with a single **global** write counter rather than per-document read tracking. A transaction that performed *no* transactional read still got conflict protection — so the B6 serialization test passed against an implementation that would lose updates on real Firestore.

The reviewer proved it by mutation: replacing the in-transaction `t.get(dayRef)` with a non-transactional `dayRef.get()` left all tests green.

**Fixed:** the fake now records a real **read set** (`t.get` stamps each document's version; commit re-checks only those documents) and enforces Firestore's all-reads-before-writes rule. Re-running the same mutation now **fails correctly**, with exactly the predicted symptom:

```
× two CONCURRENT same-chain stories serialize to one chain (no dual roots)
  AssertionError: expected [ { storyId: 'sB', …(6) } ] to have a length of 2 but got 1
```

One entry silently vanishing from an append-only array — the lost update the test exists to prevent. The test is now load-bearing.

### C3 — Model free text reached the agent-facing digest
`api/_utils/wireWriteThrough.js:92` / `api/_utils/wireDigest.js:66` · **verified personally**

`primaryTicker` was normalized but never validated: not against the D8 universe, not for length, not for shape. It becomes the **digest subject**, the persisted `agentFacts.primaryTicker`, and a **chain-key component**.

At the Kai seam that value is model output — `generate-pulse.js` takes `storyData.primaryTicker` verbatim, and that tool property is `{ type: 'string' }` with no enum. My repro:

```
normalized : "BUY NVDA NOW — 10X SETUP"
in universe: false
DIGEST     : BUY NVDA NOW — 10X SETUP move: -1.4% vs prior close.
```

That is the arc's central promise inverted. P2 says a digest "cannot assert an undeclared number or an unapproved claim because the model does not write the digest" — here the model writes the subject of every sentence, unvalidated, and forks the chain key per unique string. It is also a P1 boundary breach: a directive-shaped string on an agent-facing surface.

Related: SPY/QQQ/DIA/IWM are **not** keys of `TICKER_TO_SECTOR`, so Kai's index stories were emitting an off-universe symbol as the digest subject even in the well-behaved case.

**Fixed:** `primaryTicker` now runs the same F1/D8 battery as `tickers[]` — normalize, length-cap, universe-check; on failure it is dropped to `null` with an `F1_PRIMARY_DROPPED` class code, and the digest falls back to a validated ticker or the contract's own subject noun (`"Index move: -1.4% vs prior close."`). Three tests lock it.

---

## 3. Fixed on this branch (27)

**Correctness / data integrity**
| # | Finding | Fix |
|---|---|---|
| C1 | Sweep unreachable on the common tick | Host restructured; sweep always reached |
| C2 | Fake transaction model false-passes B6 | Per-document read set + reads-before-writes enforcement |
| C3 | Unvalidated `primaryTicker` → model text in digest & chain key | Full F1/D8 battery + `F1_PRIMARY_DROPPED` + fallback subject |
| H | Quarantine keyed on contract minimum, not emitted tickers | Keys on what the model actually emitted; `volatility_event`/`sector_rotation` company stories now quarantine correctly instead of passing with an empty, unindexable ticker set |
| H | `idempotencyConflicts` / `envelopeMissing` re-incremented on retry | Terminal action + counter now commit in **one transaction** (`terminate()`) — exactly-once |
| H | TOCTOU: false `envelope_missing` alarm on a healthy story | Same transaction re-reads `wirePending`; a story the inline path already finished is skipped, not alarmed |
| H | No attempt cap → poison story starves the queue | `wireReplayAttempts` + terminal `replay_exhausted` class + `replayExhausted` stat |
| H | Walker horizon throw poisoned the replay queue | Chain lookback now **degrades** (entry self-roots) instead of failing the Wire write — P3-aligned |
| H | `neta_econ_preview` bucketed to a Sunday orphan doc | New `resolveWireMarketDate()` snaps non-session dates forward to the next trading session; applied at all seams (also fixes poll-batch's Sunday-ET window) |
| M | `payloadHash` was `sha256("null")` for every post-projection REJECT | Hash the normalized facts when present, else the raw projected input (F2-2 as written) |
| M | ISM alias shadowing: "Non-Manufacturing PMI" canonicalized to `ism_mfg` | `ism_svc` row now precedes `ism_mfg`; a day carrying both ISM releases no longer drops the second as a receipt hit |
| M | Batch flag-straddle rejected every in-flight preview after the flip | `submittedUnderWire` guard — a batch submitted dark publishes without the Wire path |
| M | Retention purge could delete a still-pending story's envelope | Per-doc `wirePending` guard; the sweep keeps ownership |
| M | Over-cap qualifiers hard-REJECTed before dedupe | Dedupe first; the cap bounds the distinct set |
| M | Day doc had no size guard | Soft warn at ~600 KB naming the §4.3 shard escape hatch |
| L | Empty ticker reported as `R4_OVERSIZE` | New `R4_TICKER_EMPTY` code |
| L | `formatValue` emitted `+0%` / `-0%` | A magnitude rounding to zero carries no sign |

**Spec conformance / safety**
| # | Finding | Fix |
|---|---|---|
| H | **M8 broken** — `wireMarketDate` persisted with all flags off | Conditional spread; poll-batch's `resolveWireMarketDate(submittedAt)` fallback covers a mid-flight flip |
| L | Internal QA taxonomy served on every public feed response | `stripWireState()` in `wireContracts.js`, applied in `feed.js` and `story/[id].js` — one source of truth, 4 tests |
| M | Wire retention Step 3 could fail a successful cleanup run | Own isolating try/catch + `wireCleanupError` in the response |

**Measurement integrity**
| # | Finding | Fix |
|---|---|---|
| M | Metrics transaction sat **inside** the window it baselines | `publishStoryWithWire` returns `wireMs`; call sites close the measured window first, then emit both samples |
| M | `count`/`totalMs` diverged from `samples[]` past the 500 cap | `sampledCount` binds the percentile to its own population (§9 display-agreement) |
| M | `generate_publish` measured a Batch API enqueue | Renamed `batch_submit`; a real `generate_publish` sample now fires in `poll-batch` where the story is actually published |

**Test integrity**
| # | Finding | Fix |
|---|---|---|
| H | Shipped flag values + `getWireFlags` had zero coverage | `wireFlags.test.js` — asserts all three ship FALSE and the continuity-requires-writes rule |
| M | Post-commit-race test was circular (hash read back from the doc under test) | Hash computed independently from the facts |
| M | Report overstated Wire test count | Corrected to the **measured** 124 across 11 runnable suites |
| — | Contract-table integrity had no test | `wireContracts.test.js` — every allowlisted eventType has a row, every row has exactly one reporter, cardinality/family/basis well-formed |

---

## 4. Reported, not changed (26) — with disposition

**Needs a founder ruling (1)**

- **Inline receipt-hit silently discards a genuinely distinct story** (`wireWriteThrough.js:149`, high). The spec says two things: F2-10 speaks of a *"pre-existing **matching** receipt"* → inline no-op; B5 says *"first receipt wins"* and *"a changed payload on retry is a no-op, not a repair."* The build implements the B5 reading — **any** receipt for the key is an inline no-op. If two genuinely different stories ever collide on one idempotency key inline, the second's facts are dropped with no counter. The sweep path *does* classify that as a conflict. **Options:** (a) keep B5 semantics and accept it, (b) count inline no-ops where the hash differs so the gate can see them, (c) treat hash-mismatch as a conflict inline too. I did not choose unilaterally because the two spec sentences genuinely disagree.

**Spec-shape questions (2)**
- Tool schema is per-**reporter** while contracts are per-**eventType** (`wireSchemaExtension.js:31`, medium): a Doug preview is offered `earnings_recap`'s qualifier enum, so a schema-conformant payload can still salvage-drop. Noise, not unsafety — but it inflates SALVAGE against the §6.1 <20% threshold.
- `figures[]` signs are never checked against `direction` (`wireValidator.js:284`, medium): §4.4 mandates sign-consistency for `magnitude` only. Extending it is a spec change.

**Inherent / accepted (7)**
- `envelopeMissing` lands on a day doc re-derived from `publishedAt` (medium) — when the envelope is gone the original bucket is unknowable; the counter's contract is "non-zero anywhere is bad", which still holds.
- Rules suite cannot detect removal of the three Wire blocks (medium) — the deny-all catch-all makes them behaviorally redundant; they ship as documentation and regression intent.
- The `privileged claims` rules context exercises no privilege that exists (medium) — Admin SDK bypasses rules entirely; no client-side privilege escape exists to test.
- QUARANTINE index-exclusion guard is structurally unreachable (medium) — retained deliberately as defense against a future quarantine class that keeps in-universe tickers.
- `byRule` counts code occurrences, not stories (low) — definitional; documented.
- `canonicalSerialize` would collide `Date`/`NaN`/`Infinity` (low) — unreachable through the validator, which admits only finite numbers and closed enums.
- `MAINTAINED_HOLIDAY_YEARS` treated as a range (low) — the two maintained years are contiguous; a gap would need the set form.

**Follow-up work (5)** — worth doing, larger than a review fix
- Continuity and chain resolution each fetch the same 5 lookback docs per story (medium, perf): ~5 redundant reads and up to ~1.75 MB egress per story with all flags on. Fix is to thread the snapshots through; the prior-day docs are immutable, so sharing is provably safe.
- Sweep budget could consume the host's 10 s response buffer (medium): bounded today by the ≥5 s floor and budget pass-through; wants a production observation on the first flip.
- `wireMetrics.js`, `cleanup.js`'s retention ride, and the sweep-failure path still have no dedicated tests (medium).
- P6 host isolation is asserted by code inspection, not by a test (high) — **this is how C1 shipped.** A host-integration test is the single highest-value addition left.
- Fake vs Admin SDK residual divergences — JSON-clone mangles `Date`, `set()` ignores `{merge:true}`, no `undefined` rejection (low). Documented in the fake; each hides a production-only failure mode.

**Already true before this diff (11 low/medium)** — R1 depth scan array shapes (detection-only, no leak), stuck-pending envelopes vs orphan drain (now bounded by the attempt cap), and similar; listed in the raw register.

---

## 5. Probed hard and confirmed correct

Not padding — each was attacked with repros and survived:

- **Firestore rules**: all 86 match blocks read end-to-end hunting for an OR-semantics grant. The only recursive wildcards are `/tournamentGroups/{groupId}/{document=**}` and the terminal deny-all; neither can reach the three Wire collections.
- **F2-3 in the validator**: all 27 `codes.push` sites push a `WIRE_CODES.*` constant — no free-text reason, model string, or ticker can reach `codes` by any path.
- **Index shape**: `(wirePending ASC, publishedAt ASC)` is exactly right for the sweep query; the four range queries are single-field and auto-indexed (`fieldOverrides: []` means no exemptions).
- **Cron budget + fence**: `vercel.json` byte-untouched, still exactly 37 entries; zero fenced files in the diff; no fenced function imported or called; no fire-and-forget writes (§5).
- **Retention design**: receipts really are a map inside the day doc, not a subcollection — the flat deletes orphan nothing.
- **Metrics doc sizing**: worst case simulated at ~70 KB, far under both the 1 MiB and 40,000-index-entry ceilings.
- **Universe membership**: `hasOwnProperty.call` plus uppercase normalization makes prototype-key collisions (`CONSTRUCTOR`, `__PROTO__`) unreachable.
- **Validator purity**: does not mutate caller input.
- **NYSE 2027 holiday data**: all ten dates and the single early close independently recomputed and confirmed, including the three observed-date shifts.

---

## 6. What the founder should take from this

1. **The build report's headline number was wrong** and is corrected: 124 Wire tests measured, not 151. The full-suite figure (322→324 files, 5,751→5,772 tests) was accurate then and now.
2. **Two guarantees were asserted by inspection rather than by test, and both hid a defect** — the sweep host's isolation (C1) and the flag values. The pattern is the lesson: a §9 row whose evidence cell cites source code rather than a test is not covered.
3. **The remaining pre-flip checklist is unchanged** and still gates the merge: run `npm run test:rules` (incl. the F2-4 positive controls) against the *deployed* ruleset, deploy the composite index and rules **before** `WIRE_WRITES_ENABLED`, then flip in the §4.8 order.
4. One item needs your ruling before Phase 2: the inline receipt-hit semantics in §4 above.

---

*20260725_WIRE_PHASE1_CODE_REVIEW.md — 7-dimension adversarial review, 53 findings, 27 fixed — July 25, 2026*
