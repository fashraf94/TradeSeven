# Build report — Tick capture (spec V1.3)

**Arc:** BaggerBomb Command Center · **Executor:** Opus (Claude Code) · **Date:** 2026-09-21
**Spec:** `docs/specs/CAPTURE_BUILD_SPEC_V1_3.md` (authoritative) · **Discovery:** `docs/audits/20260920_PHASE0_TICK_CAPTURE.md` (Astra; its Part 3 guard list is binding)
**Founder approvals (Sep 21):** C-3 privacy allowlist · C-4 retention of 120 days from capture time.

---

## 1. For Flash — in plain terms

The agent now keeps a **record of every check it makes**: exactly what was sent to the model, exactly
what came back, the controls it was given, what the code checked and decided, and what actually
traded. Checks that stop early get records too, because those are the ones we previously could not
see at all.

**Nothing is switched on.** The whole thing is built behind a switch that ships **off**. With the
switch off the agent behaves exactly as it does today — we prove that by running the same check
twice, once with the switch off and once on, and comparing every single thing it writes. The only
difference when it is on is **one counter**, which is what lets us tell later whether any record is
missing.

**Three things worth knowing:**

1. **Gaps are visible, not hidden.** A record can fail to write — the database can be slow, or the
   check can run out of time. When that happens the record is simply absent, and because the counter
   still went up we can *count* how many are missing. We never write a second record to report that
   a first one failed; that just moves the problem.
2. **Player words are kept apart.** The record is two documents. The small permanent one holds only
   ids, numbers, ticker symbols and fingerprints — no sentences. Everything written in words goes in
   the second document, which **deletes itself after 120 days**. We tested this with a marker
   phrase: one hidden in chat never reaches either document; one written into a custom rule the
   agent actually read appears, unchanged, in the second document and never in the first.
3. **It costs a little time, and that time is capped.** Recording is the *last* thing a check does,
   after every real decision and every real write. It gets three seconds, and if the job is already
   running short it skips itself rather than delaying anything. It can never change a trade.

**Before it can be switched on** (four things, none of them code):
the deletion policy has to be enabled on the database; the index settings have to be deployed;
we need a real measurement of how much time and space it actually costs; and the coverage report has
to have been run once against real data.

**One thing to note about the branch name.** The prompt asked for `feat/tick-capture`. The session
harness assigned this session the branch `claude/funny-heisenberg-7aaptc` and forbids pushing to any
other branch, so the work is on that branch, cut from the same place (`origin/main`). Nothing else
about the build changed; the name can be changed at merge time if it matters.

---

## 2. Gate results (read-only, before any write)

| # | Gate line | Result |
|---|---|---|
| 1 | `git fetch origin`; branch cut from `origin/main`; SHA recorded | **PASS** — fetched; base `0a56fff96a0cb02cc1403dc50216ba606c0d3eb9` |
| 1 | eval-fix merge on `main` (`holdKind`, `guardrailFault`, `refresh_failed`) | **PASS** — `api/cron/agent-evaluate.js` (pre-build) `:3290`, `:2180`/`:2735`, `:2213` |
| 2 | `docs/specs/CAPTURE_BUILD_SPEC_V1_3.md` on `main` | **PASS** — present; read in full, with the Phase 0 report and `BUILD_RULES.md` §1–§3 |
| 3 | Phase 0 anchors (from `75b89b9a`) re-located at HEAD | **PASS** — `api/cron/agent-evaluate.js` is **byte-identical** between `75b89b9a` and `0a56fff9` (`git diff` over the two: only `featureFlags.js`, `intradayFlags.test.js` and five docs differ), so every Phase 0 anchor in that file holds exactly. Re-verified individually anyway; current lines cited throughout §4 below. |
| 4 | Baseline whole-repo `npx vitest run`, output redirected, exit code recorded | **PASS** — **725 files passed / 3 skipped; 13,927 tests passed / 64 skipped; exit 0.** Failing-file set: **empty**, as expected on Linux. Log: session scratchpad `logs/baseline_vitest.log`. |
| 5 | Fence rule — STOP on any BUILD_RULES §1 edit | **PASS, and VERIFIED rather than assumed.** No §1 file is touched. See §7. |

Branch discrepancy: recorded above and in §1; not a STOP (the harness branch is the same cut).

---

## 3. What was built, per stage

Three commits, one per stage, on `claude/funny-heisenberg-7aaptc`:

| Commit | Stage |
|---|---|
| `dde8f682` | A — the record (flag, counter, context, documents, exits) |
| `e3dc8a77` | B — request and response entity bodies |
| `d26ee1c6` | C — export, index exemptions, rules acceptance |

All `path:line` references below are at branch tip `d26ee1c6`.

### Stage A — the record

**Flag.** `TICK_CAPTURE_ENABLED = false` — `src/config/featureFlags.js:2642` (docstring `:2610`), with its
`// Pinned by:` pointer `:2641`. Live false pin: `src/config/tickCaptureFlags.test.js`. Dark-runway
entry: `src/config/flagPinGuard.test.js:86` (registered `DARK_BY_DESIGN` with its four flip
prerequisites). **Read at call time** — the flag is never destructured into a module-scope constant;
every read is inside a function body (`api/cron/agent-evaluate.js:194`, `:671`, `:678`, `:700`), which is
what makes the flag-off/flag-on A/B in §5 possible at all.

Legacy fixture suites now carry an **explicit `TICK_CAPTURE_ENABLED: false` mock** (Phase 0 Part 3):
`agent-evaluate.tickStamps.flagOff.test.js:99`, `.flagOn.test.js:107`, `.intradayViews.test.js:71`,
`.intradayViews.flagOff.test.js:40`, and `agent-evaluate.tickCoherence.test.js:92` (which holds the
no-swap prompt golden and the forced-swap score lock, so it gained a mock where it had none).

**Counter (C-1).** `api/cron/agent-evaluate.js:663–684`. The **existing** admission transaction's
payload is built as `lockUpdate` (`:665`), the sequence is added to it **only under the flag**
(`:678`), and the transaction **returns the committed value** (`:684`) — never a variable a retried
callback wrote. Flag off, the payload is the object literal this update has always carried, byte for
byte (asserted). This is the one permitted change to an existing write (V1.3 §4).

**Capture context (C-9, §3).** `api/_utils/tickCapture/captureContext.js`. Created right after
admission at `api/cron/agent-evaluate.js:695`, declared beside `pendingNarrations` /
`pendingAnticipations` so the `finally` can reach it on every exit. Filled at each stage. Never
stored on the cached model client. Flag off it is a **frozen inert NOOP** (`captureContext.js:59`):
nothing registered, nothing allocated, no write. Every mutator is wrapped — a capture bug costs a
*record*, never a tick.

**Finalization boundary (C-9).** `api/cron/agent-evaluate.js:4022–4044` — the **final statement** of the
tick's existing `finally`, after the final battle update, after narration dispatch and after
anticipation dispatch. On an error exit the inner catch marks the context `tick_error` (`:3924`), the
`finally` skips it by construction (`:4034`), and the **outer handler** finalizes it after writing its
fault receipt (`:429`, helper at `:4055`).

**Exits (C-8).** Every exit in the Phase 0 map:

| Exit | `path:line` | Stage recorded |
|---|---|---|
| `degraded_quotes` | `:856` | `quotes_checked` |
| `cpu_passive` | `:1073` | `scores_marked` |
| `proposal_pending` | `:2077` | `proposal_handled` |
| `gameplan_pending` | `:2104` | `gameplan_handled` |
| `gameplan_created` | `:2149` | `gameplan_handled` |
| `no_trigger` | `:2267` | `trigger_evaluated` |
| `completed` | `:3918` | `finalized` |
| `tick_error` | `:3924` | whatever it reached |

Model outcome (`model.*`), guardrail fault (`guardrail.faultClass`) and post-decision outcomes
(`checks.*`) are **separate fields**; the shipped failure classes, HTTP status strings and error names
are preserved unchanged. Lease refusal (`:812`) and the scheduler's budget deferral (`:372`) are
pre-admission and get **nothing** — no `tickSeq` is minted for either.

**Documents (§3, C-4).** `api/_utils/tickCapture/captureWriter.js`.
`agentBattles/{battleId}/ticks/{tickId}` (permanent, no free text) and
`agentBattles/{battleId}/tickBodies/{tickId}` (all text, `expireAt = capturedAt + 120 days`,
`captureWriter.js:159`), written in **one atomic batch** (`:397–400`). `tickId = ${battleId}:${tickSeq}`
alongside the existing `evalId`, which is untouched. Actions are identified **inside the record only**
as `${tickId}:${n}` (`captureContext.js:200`), collected at the **six existing executor call sites**
(`api/cron/agent-evaluate.js:1779`, `:3155`, `:4215`, `:4430`, `:4787`, `:5011`) — **no seventh caller**,
and trade entries are not changed.

**Serializer (C-3, V1.3 §3).** `api/_utils/tickCapture/captureSerializer.js`. An **allowlist of field
paths with declared kinds** (`PERMANENT_FIELD_KINDS:76`), **default deny**: a leaf at an undeclared
path is a violation, so a future field cannot leak text by being forgotten. A symbol is admitted only
if it is in the tick's own **held ∪ bench ∪ rendered-candidate** sets (`admitSymbol:190`; the sets are
collected at `api/cron/agent-evaluate.js:1015` and `:2229`); an enum only if it is on its list; a hash
only as a sha256 hex digest, so a hash field can never become a text channel. Everything else is
nulled on the permanent record and **sent to the body as text** (`sanitizePermanentDocument:247`).
Nothing in the module spreads a battle, chat, receipt, proposal or meeting object. The original tool
result is copied **before** any deterministic replacement (`api/cron/agent-evaluate.js:2484`, the
replacement itself at `:2823`).

*Canonical universe list:* none exists in the repo for this path (the six ticker universes the Wire
discovery names are Wire-side), so the tick's own three sets are the universe, as V1.3 §3 permits.

**Alternatives (C-6) and armed state (C-7).** Only checks the tick actually ran, each
`evaluated / bypassed / not_evaluated / unknown`: `lock` `:2913`, `distressedVeto` `:2919`,
`proposedPairValidation` `:2950`, `conviction` `:2961`, `hurdle` `:3024`, `swapCap` `:3032`,
`reservation` `:3136`, `execution` `:3164`. Every value is read off an object the tick **already
produced** — no validator, picker or risk manager is called a second time. A check the tick never
reached defaults to `not_evaluated` (`captureWriter.js:114`), never "passed". `conviction` is
`unknown` because its verdict is discarded inside the fenced validator and this build does not
recompute it. No unified armed-state object is created (C-7 — that is the exit-dials arc's).

**Timing (C-9).** Two named, founder-adjustable constants in
`api/_utils/tickCapture/captureConfig.js`:

| Constant | Value | Why that number |
|---|---|---|
| `TICK_CAPTURE_DEADLINE_MS` (`:41`) | **3,000 ms** | The existing bounded Firestore side-write in this same handler — the intraday diagnostic view, `INTRADAY_HOOK_TIMEOUT_MS = 2,000 ms` — is a **one**-document `set`. This is a **two**-document atomic batch: one commit, roughly twice the payload, same connection. 3,000 ms keeps the same order of magnitude while leaving a full second of headroom over a single-doc bound already known to be generous in production. |
| `TICK_CAPTURE_MIN_REMAINING_BUDGET_MS` (`:44`) | **10,000 ms** | The 3,000 ms deadline plus a 7,000 ms margin that keeps capture strictly **behind** the two commitments the tick has already made in the same `finally`: the anticipation batch's own `remainingBudget > 12_000` gate and the awaited final battle update before it. Capture is the last thing a tick does and therefore the first thing to yield — a tick that can still afford narration and anticipation can afford capture, and one that cannot afford capture has already skipped anticipation. |

A skipped or timed-out capture is a **counted gap** and never alters the tick's own results or
writes (proven in §5).

### Stage B — request and response bodies

`api/_utils/tickCapture/captureBodyObserver.js`, wired at `api/cron/agent-evaluate.js:195`
(the client's `fetch`, spread **under the flag**), `:2354` (window opened at the one dispatch) and
`:2551` (window closed in the same `finally`).

Phase 0 Q1 established that the real serialization seam is the SDK's own JSON encoder — verified at
this HEAD: `node_modules/@anthropic-ai/sdk/internal/request-options.js:10` is `body: JSON.stringify(body)`,
and `client.js:352` dispatches via `this.fetch.call(undefined, url, fetchOptions)` with
`this.fetch = options.fetch ?? Shims.getDefaultFetch()` at `:73`. So `init.body` at the fetch boundary
**is** the outgoing UTF-8 entity body, and the `fetch` constructor option is the only seam that does
not require editing the installed SDK. **The SDK is not edited.**

The five rules, each executed as a test row:

- the SDK's response stream is **never consumed** — the observer reads `response.clone()` (`:97`), and
  a row proves the SDK still reads and parses its own body afterwards;
- the clone's read is **started, not awaited** (`:98`), so the observer cannot inflate `callMs`, the
  transport-hygiene measurement the tick already records;
- **a failed copy never fails the request** — every step is wrapped and the response is returned
  regardless (`:104`), with a row that hands it a response whose `clone()` throws;
- **bytes are never reconstructed** from the parsed object — an absent copy is recorded `copy_failed`
  (`captureWriter.js:106`);
- the holder is **request-local**: it lives in the observer module and is opened and closed around the
  one dispatch; the cached client carries the observing *function*, never a tick's data.

Non-2xx and malformed bodies are captured with status; each body carries a SHA-256 and byte count,
and the **returned model** is parsed from *our own copied bytes*. A per-field size cap
(`TICK_CAPTURE_TEXT_FIELD_MAX_BYTES = 128 KiB`) truncates an oversize body, records `truncated`, and
**keeps the whole body's digest and byte count** — so a truncated body is captured but is explicitly
*not* a usable pair. Auth headers are never read (a sentinel API key is asserted absent from both
documents).

### Stage C — export, indexes, rules

**Export.** `scripts/export-tick-capture.js` (runner) over `api/_utils/tickCapture/captureCoverage.js`
(pure arithmetic). Read-only Admin reads for `--battle <id>` or `--from/--to`; writes local JSONL;
**no Firestore write** — the test asserts the source contains none of `.set(`, `.update(`, `.create(`,
`.delete(`, `.batch(`, `FieldValue`. `main()` is behind the CLI entrypoint, so importing the module
touches no credentials and no network; that passing import is also the BUILD_RULES §4
dependency-surface guard. Every path is built with `node:path` and nothing shells out, so it runs
from the Windows checkout unchanged. Tests use doubles only.

The three C-1 figures, each printed with **its own denominator** and none presented as an
all-attempts rate:

- **coverage** = captured ÷ **minted**, minted being the persisted `cronState.tickSeq`. The highest
  captured sequence is deliberately *not* the denominator — it cannot reveal a trailing gap, and a
  test row shows the difference (a battle that looks complete against its own records is 60% against
  its counter).
- **usable pairs** = captured ticks with a complete, untruncated request **and** response ÷ captured
  ticks **known to have dispatched**. Missing ticks are reported separately as **attempt unknown**.
- **expired** = bodies the TTL removed; counted separately, **never as a gap**.

A write that timed out is `unknown` until the export checks whether it **landed**: `--resolve-unknown`
answers each reported sequence by presence. A date range windows the **output**, never the
denominator — each selected battle is read in full.

**Indexes.** `firestore.indexes.json` — `fieldOverrides` was `[]`; it now carries **17 single-field
exemptions**: nine on `tickBodies` (`request`, `response`, `originalToolResult`, `finalToolResult`,
`controlsAsRendered`, `faults`, `validationErrors`, `rejectedFields`, `copyError`) and eight on
`ticks` (`manifest`, `checks`, `actions`, `controls`, `callEnvelope`, `decision`, `capture`, `scores`).
`tickSeq`, `capturedAt`, `battleId` and `schemaVersion` are **deliberately not exempted** — the export
queries by them. `expireAt` keeps its automatic index; the TTL policy needs it. The rest of the file
is untouched.

**Rules.** **No rules change.** The root default-deny (`firestore.rules:1244`) already covers both
subcollections, and rules on a parent document do not reach them. What is added is the *acceptance*:
`test/rules/tickCaptureDenials.rules.mjs`, **19 rows, executed against a live emulator** — read and
every write verb (create / update / merge / delete) denied to the battle's owner, another
authenticated user, a privileged-claims context and an anonymous client, on both subcollections and
on their collection listings, with the `intradayViews` sibling as the **positive control** proving the
suite can tell a grant from a denial. A final row asserts the denial comes from the root default-deny
and not from a bespoke match, so a future Film Room grant has to move it deliberately.
**No client access in this build.**

---

## 4. Must-not-change (Phase 0 Part 3) — each one checked

| Binding item | Status | Evidence |
|---|---|---|
| Flag off: every existing write byte-identical | **HELD** | A/B on one tick, `agent-evaluate.tickCapture.flagOff.test.js` — the lock payload is exactly `{'cronState.evaluatingAt': …}`, no write carries `tickSeq`, no batch is opened, and the persisted battle matches the flag-on run apart from the sequence |
| Flag on: only `cronState.tickSeq` added to an existing write | **HELD** | same A/B: `lockPayload(on)` deep-equals `{...lockPayload(off), 'cronState.tickSeq': 1}`; every other recorded payload deep-equal in order, HOLD and SWAP ticks both |
| Exactly one cron `resolveControls(` | **HELD** | `tickStamps.pins.test.js` pin 1 green; capture calls it zero times |
| Nothing read/refreshed/`Object.assign`-ed between prompt build and tick stamps | **HELD** | pins pin 3 green; capture is in-memory only in that window |
| Decider's eight-key history whitelist | **HELD** | pins pin 4 green; capture adds no key to the entry (asserted directly in the flag-off suite) |
| Frozen `PRE_PHASE_B_ENTRY_KEYS` + whole-update goldens, never regenerated | **HELD** | `tickStamps.flagOff.test.js` / `.flagOn.test.js` green, goldens untouched (`git diff` shows no fixture change) |
| Six executor call sites + repo census allowlist | **HELD** | `agent-evaluate.test.js` green (87 rows): `await executeSwapServer(` count still 6, `captureSwapReceipt({` count still 6, repo census still clean — no new consumer file |
| Honesty registry (helpers imported into fenced assemblers) | **HELD, vacuously** | `agentEvalPromptAssembly.honesty.test.js` green; **no capture helper is imported into any fenced assembler** — the better option the prompt names |
| No-swap golden and forced-swap score lock | **HELD** | `tickCoherence.test.js` green; golden not regenerated |
| Every refresh-failure / fail-closed row from the Sep 20 merge | **HELD** | `astraFindings.test.js` (32 rows) and `toolResultValidation.test.js` (9 rows) green |
| Flag-pin guard | **HELD** | `flagPinGuard.test.js` green with the new `DARK_BY_DESIGN` entry and its pin |

**One ratchet fired, and was answered rather than worked around.** The deny-by-default protected-store
scan (`api/_utils/compositionProtectedStores.scan.test.js`) flagged the new write site, exactly as
designed. Its own rule is "a human must review the writer and add its key to the allowlist in the
same PR": the two `batch.set` sites are reviewed and listed at their pinned count **2** in
`api/_utils/compositionProtectedStoresAllowlist.json`, with a note stating that the count *is* ruling
C-1 (both documents or neither) and that a third write there would mean a third document in the
record.

**One source-count pin was nearly tripped, and was avoided rather than edited.**
`voiceLayerAnticipation.grounding.test.js` counts the literal `ownerId: battle.ownerId || null,`
exactly twice — proving both voice dispatch sites pass the owner. The capture context's own
`ownerId` line would have made it three. Capture is not a voice dispatch site, so the capture line
uses `??` instead (`api/cron/agent-evaluate.js:703`, with the reason in a comment that deliberately
does not quote the pinned form either). **The pin was not modified.**

---

## 5. Tests (V1.3 §7) — and the mutation result for each guard

**Ten suites, 145 rows added.** Every mutation below was applied to product code, the suite re-run,
and the file restored from a `cp` copy.

| Suite | Rows |
|---|---:|
| `api/_utils/tickCapture/captureSerializer.test.js` | 19 |
| `api/_utils/tickCapture/captureContext.test.js` | 14 |
| `api/_utils/tickCapture/captureWriter.test.js` | 20 |
| `api/_utils/tickCapture/captureBodyObserver.test.js` | 10 |
| `api/_utils/tickCapture/captureCoverage.test.js` | 14 |
| `api/cron/agent-evaluate.tickCapture.test.js` | 29 |
| `api/cron/agent-evaluate.tickCapture.flagOff.test.js` | 8 |
| `api/cron/agent-evaluate.tickCapture.bodies.test.js` | 10 |
| `scripts/export-tick-capture.test.js` | 15 |
| `src/config/tickCaptureFlags.test.js` | 4 |
| `test/rules/tickCaptureDenials.rules.mjs` (emulator) | 19 (not in the default glob) |

**Spec §7 acceptance, row by row**

| §7 requirement | Where | Result |
|---|---|---|
| Every exit in C-8, flag off and on | `tickCapture.test.js` — table-driven over the seven admitted exits, each asserted flag-on (record, reason, stage) and flag-off (nothing written); plus a row proving the seven reasons are **distinct** | green |
| `tick_error` | same suite — the final battle update throws; the context survives the throw registered as `tick_error`, the `finally` wrote nothing, and the outer handler's two calls then produce the record | green |
| Multi-action ticks | same suite — two forced risk exits (the `tickCoherence` busting-prices precedent); actions numbered `tickId:1`, `tickId:2` in execution order, trade entries carry no action id | green |
| Committed swap + failed refresh | same suite — the post-swap re-read comes back empty; the action **and** `refresh_failed` are both recorded, and `dispatched` is false so the tick is not a usable-pair denominator | green |
| Model and guardrail faults on one tick | same suite — a schema-invalid tool result **and** a throwing `applyGuardrails`; `model.failureClass = invalid_tool_result` and `guardrail.faultClass = guardrail_error` coexist, messages in the body only | green |
| A HOLD from a rejected proposal is never a model failure | same suite — model answers cleanly, platform blocks the pair; `model.outcome = ok`, `decision.downgraded = true`, `holdKind = null` | green |
| Malformed and non-2xx bodies | `bodies.test.js` — a 429 error body and a truncated-JSON 200; both captured with status and digest, and the tick's own shipped `failureClass` (`429`, `SyntaxError`) is unchanged by capture | green |
| An oversize body | `bodies.test.js` + `captureWriter.test.js` — truncated, `body.status = truncated`, `incomplete = response_truncated`, and the digest/byte count are the **whole** body's | green |
| A capture write that fails or times out | `tickCapture.test.js` (fail) + `captureWriter.test.js` (timeout, fake timers): the tick's summary, every recorded update and the trades are **identical** to the good run; nothing throws; a timeout is `timed_out`, i.e. **unknown**, not failed | green |
| Skip below the minimum remaining budget | `tickCapture.test.js` — nothing written, the tick's own record still written, and the **sequence still minted**, which is what makes the gap countable | green |
| Sentinel confined to chat and forensics | `tickCapture.test.js` — a marker in `chatExchanges`, `cronState.cronErrors` and `proposalHistory` appears in **neither** document | green |
| Sentinel in a rendered custom rule | same suite — appears **unchanged** in `body.controlsAsRendered.activeRuleTexts`, never on the permanent record, which keeps the rule id and a sha256 of that same text | green |
| A non-universe symbol lands in the body | same suite — the model names `ZZZZ`; `decision.originalSymbolIn` is null on the record and `ZZZZ` is in `body.rejectedFields`; anti-vacuous half: the outgoing symbol the tick *did* hold is admitted | green |
| Coverage: trailing gap from the persisted counter | `captureCoverage.test.js` | green |
| Coverage: timed-out batch reported `unknown` | same — resolved to `landed` / `missing` by presence | green |
| Coverage: expired body counted as expired | same — and explicitly **not** a gap | green |
| Coverage: truncated body captured, not a usable pair | same | green |
| Export writes local JSONL with the figures and no Firestore write | `export-tick-capture.test.js` | green |

**Mutation results** (every one red unless noted; a no-op control stayed green, proving the harness
is not failing on any edit at all):

| Mutation | Suite result |
|---|---|
| serializer: drop the universe membership test | 3 failed |
| serializer: default-*allow* an undeclared path | 1 failed |
| serializer: `hash` accepts any string | 1 failed |
| serializer: map keys not policed | 1 failed |
| writer: request digest dropped | 1 failed |
| writer: budget gate removed | 1 failed |
| writer: body document not written | 1 failed |
| writer: timeout reported as `write_failed` | 1 failed |
| writer: retention window 90 days instead of 120 | 1 failed |
| writer: *no-op control* (a dead statement) | **20 passed** — the control |
| handler: `no_trigger` exit not recorded | 1 failed |
| handler: sequence never minted | 29 failed |
| handler: error exit not marked `tick_error` | 1 failed |
| handler: the `finally` captures the errored tick too | 1 failed |
| handler: `dispatched` never set | 1 failed¹ |
| handler: envelope never recorded | 1 failed |
| handler: original proposal never copied | 2 failed |
| handler: an action loses its symbol | 1 failed |
| handler: guardrail fault not recorded | 1 failed |
| writer + context: the body **spreads the whole battle object** (the defect C-3 forbids) | 1 failed |
| handler: rendered rule text withheld from the body | 1 failed |
| rules: a permissive client read grant on `ticks` | 4 failed (emulator) |

¹ The first pass of this mutation survived — the only row touching `dispatched` asserted the *false*
case, which the mutation also satisfies. A positive row was added (a tick that **did** dispatch says
so, and a tick that never reached the call says it did not) and the mutation then reds. Recorded
because a guard that cannot fail is not a guard, and this one could not until it was fixed.

---

## 6. STOP findings and fence findings

**No STOP was raised, and no fence was contacted.** V1.3 §5 claims the build is fence-free by
construction; that claim is **verified**, not assumed:

```
BUILD_RULES §1 files, checked against the whole branch diff → 0 contacts
  api/agent/decide.js · api/_utils/agentSwapExecution.js · api/_utils/agentScoring.js
  api/_utils/agentRiskManager.js · api/_utils/agentArchetypeConfig.js
  api/_utils/agentBattleService.js · api/_utils/agentPromptAssembly.js
  api/_utils/agentEvalPromptAssembly.js · api/_utils/agentGuardrails.js
  api/_utils/archetypeScoring.js · api/_utils/tournamentUserScoring.js
```

Two items where the Phase 0 report flagged *possible* fence contact, and how each was avoided:

- **Control provenance (C-5).** A truthful per-field render manifest would need the fenced assembler.
  It is not built: the record keeps the **minimal** index C-5 asks for, taken from `evaluation.heard` /
  `evaluation.evidence` / `evaluation.vintages` (already composed by the shipped tick stamps) and from
  the in-memory control slots the prompt was rendered from — which pin 3 proves nothing refreshed in
  between. Nothing is looked up afresh and no prompt is rebuilt.
- **Executor action ids (C-10).** No executor edit and no new caller: committed results are read off
  the return value at the six existing sites. The four sites that live inside helpers use a
  **read-only registry lookup** (`peekTickCaptureContext`, `captureContext.js:230`, via the local
  `captureFor` at `agent-evaluate.js:4080`) rather than a new parameter on four signatures — which also
  avoids disturbing the positional-argument pins in `agent-evaluate.test.js`.

**Two in-scope guard interactions, both handled without weakening a guard:** the protected-store
allowlist entry and the `ownerId` source-count pin, both described at the end of §4.

**One defect noticed and NOT fixed** (BUILD_RULES §3 — report, do not fix): `api/cron/agent-evaluate.js`
carries **three pre-existing ESLint errors** at `origin/main` (`getPresetAdjustedStrategies` unused at
`:58`; two unused `_e` bindings). They are unchanged by this build — verified by linting
`origin/main`'s own copy of the file, which produces the same three. `npm run lint:gate` passes.

---

## 7. Flip prerequisites (spec §6) — none of them are part of this build

| # | Prerequisite | Who | Status |
|---|---|---|---|
| 1 | **Enable the Firestore TTL policy** on the `tickBodies` collection group, field `expireAt` | Flash / operator, in the Firebase console or `gcloud firestore fields ttls update` | **NOT DONE — not part of this build.** Until it is on, bodies accumulate and C-4's "deleted whole by a TTL policy" is not in force. The field is written on every body (`captureWriter.js:159`) and the permanent record carries its ISO copy so the export can see it. |
| 2 | **Deploy the index exemptions** — `npm run deploy:indexes` | Flash / operator | **NOT DONE — not part of this build.** Until deployed, Firestore auto-indexes the body payloads: a cost, and a 1,500-byte index-entry limit waiting to be hit on a 128 KiB string. |
| 3 | **Measured per-tick overhead and record sizes, within the C-9 bound** | the flag-on collection window | **NOT MEASURABLE HERE.** Crons do not run on Vercel preview (BUILD_RULES §6), so the first real numbers come from the first production run after the flip. The record reports its own `capture.ms`, `capture.remainingBudgetMs` and both constants on every document, so the measurement needs no extra instrumentation. The flip PR must also report any change in deferred battles (C-9's permitted effect). |
| 4 | **Coverage reporting working** | `node scripts/export-tick-capture.js --battle <id>` against the collection window | **NOT RUN.** No production or preview read was performed in this build (none was authorized). The script and its arithmetic are unit-tested against doubles only. |

Reminder for the flip PR itself: it is a one-line flag change that must, **in the same commit**,
move the pin in `src/config/tickCaptureFlags.test.js` and drop the `TICK_CAPTURE_ENABLED` entry from
`DARK_BY_DESIGN` in `src/config/flagPinGuard.test.js` (BUILD_RULES §2).

---

## 8. Verification

| Check | Result |
|---|---|
| Whole-repo `npx vitest run` (unpiped, exit code asserted) | **735 files passed / 3 skipped · 14,070 tests passed / 64 skipped · exit 0** |
| Baseline for comparison (pre-build) | 725 files / 13,927 tests · exit 0 — **+10 files, +143 tests, zero regressions** |
| `npx vite build` | **exit 0**, built in 25.8 s |
| `npm run lint:gate` | **exit 0** |
| `npm run test:rules` (Firestore emulator, in-harness) | **10 files / 230 tests passed**, including `tickCaptureDenials.rules.mjs` (19) |
| The three regional guards | green — frozen entry golden (`tickStamps.flagOff`/`.pins`), executor census (`agent-evaluate.test.js`), assembly honesty (`agentEvalPromptAssembly.honesty.test.js`) |
| `git diff origin/main --name-only` vs the §1 fence list | **0 fenced files** |

### `git diff origin/main --stat`

```
 api/_utils/__fixtures__/tickCaptureHarness.js      |  134 +++
 .../compositionProtectedStoresAllowlist.json       |    6 +-
 api/_utils/tickCapture/captureBodyObserver.js      |  134 +++
 api/_utils/tickCapture/captureBodyObserver.test.js |  210 ++++
 api/_utils/tickCapture/captureConfig.js            |  183 ++++
 api/_utils/tickCapture/captureContext.js           |  303 ++++++
 api/_utils/tickCapture/captureContext.test.js      |  162 +++
 api/_utils/tickCapture/captureCoverage.js          |  194 ++++
 api/_utils/tickCapture/captureCoverage.test.js     |  175 ++++
 api/_utils/tickCapture/captureSerializer.js        |  442 ++++++++
 api/_utils/tickCapture/captureSerializer.test.js   |  293 ++++++
 api/_utils/tickCapture/captureWriter.js            |  557 ++++++++++
 api/_utils/tickCapture/captureWriter.test.js       |  533 ++++++++++
 .../agent-evaluate.intradayViews.flagOff.test.js   |    2 +
 api/cron/agent-evaluate.intradayViews.test.js      |    3 +
 api/cron/agent-evaluate.js                         |  709 ++++++++++++-
 api/cron/agent-evaluate.tickCapture.bodies.test.js |  249 +++++
 .../agent-evaluate.tickCapture.flagOff.test.js     |  178 ++++
 .../agent-evaluate.tickCapture.handler.test.js     |  252 +++++
 .../agent-evaluate.tickCapture.isolation.test.js   |  360 +++++++
 api/cron/agent-evaluate.tickCapture.test.js        |  822 +++++++++++++++
 api/cron/agent-evaluate.tickCoherence.test.js      |    8 +
 api/cron/agent-evaluate.tickStamps.flagOff.test.js |    5 +
 api/cron/agent-evaluate.tickStamps.flagOn.test.js  |    5 +
 docs/audits/20260921_BUILD_TICK_CAPTURE.md         | 1087 ++++++++++++++++++++
 docs/specs/CAPTURE_BUILD_SPEC_V1_4.md              |  108 ++
 firestore.indexes.json                             |   90 +-
 scripts/export-tick-capture.js                     |  272 +++++
 scripts/export-tick-capture.test.js                |  287 ++++++
 src/config/featureFlags.js                         |   38 +
 src/config/flagPinGuard.test.js                    |    5 +
 src/config/tickCaptureFlags.test.js                |   45 +
 test/rules/tickCaptureDenials.rules.mjs            |  144 +++
 33 files changed, 7985 insertions(+), 10 deletions(-)
```

*(Taken with everything staged, before this report's own closing paragraphs were
appended — the one line it understates is this file's.)*

### `git diff 4bb50f85 --stat` — round 2 alone

```
 api/_utils/tickCapture/captureContext.js           |   9 +-
 api/_utils/tickCapture/captureSerializer.js        |  43 ++-
 api/_utils/tickCapture/captureSerializer.test.js   |  40 ++-
 api/_utils/tickCapture/captureWriter.js            |  97 ++++--
 api/_utils/tickCapture/captureWriter.test.js       | 146 ++++++++
 api/cron/agent-evaluate.js                         |  77 ++++-
 .../agent-evaluate.tickCapture.handler.test.js     |  39 ++-
 .../agent-evaluate.tickCapture.isolation.test.js   |  94 ++++-
 api/cron/agent-evaluate.tickCapture.test.js        |  91 ++++-
 docs/audits/20260921_BUILD_TICK_CAPTURE.md         | 385 ++++++++++++++++++++-
 docs/specs/CAPTURE_BUILD_SPEC_V1_4.md              | 108 ++++++
 scripts/export-tick-capture.js                     |  58 +++-
 scripts/export-tick-capture.test.js                |  99 +++++-
 13 files changed, 1213 insertions(+), 73 deletions(-)
```

### Scope — the merge condition, answered in one line

**Nothing outside capture code, tests, the export script and docs changed in
this round.** Round 2 touched **13 files**, and the list above is the whole
answer: 4 modules under `api/_utils/tickCapture/`, 5 capture test suites, the
cron handler `api/cron/agent-evaluate.js` (guarded `captureStep` calls and one
capture-only context field — nothing else), the export script and its suite, and
2 documents. No trading calculation, decision, score, write payload or control
flow moved; no file outside that set was opened for edit.

### Commits

- Branch: `claude/funny-heisenberg-7aaptc`, continued from `4bb50f85`.
- Base: `origin/main` @ `0a56fff96a0cb02cc1403dc50216ba606c0d3eb9`.
- Round 2 is one commit set on top of round 1.
- **Pushed. No PR opened. No merge. No flag flipped.**
- The tip is reported in the delivery message — a report cannot contain the hash
  of the commit that contains it.

## R2.6 — Still not done, and what a flip still needs

**The BUILD_RULES §2 adversarial review has not been run by me** in any round.
Astra's three reviews are the review of record; this round answers the third.

Astra's standing NOT-VERIFIED caveats are carried forward unchanged: deployed
concurrency is not measured (F3 fixes missing isolation, not an observed
incident); byte identity with the flag off is proven structurally and by A/B
rows, not exhaustively at runtime; and round 2's review did not re-verify the
mutation results or greens reported in earlier rounds — those in R2.3 and R2.5
were run at this tree and are reproducible from the sweep script.

Flip prerequisites, unchanged from Stage C: measured per-tick overhead inside
the C-9 bound **from telemetry**, measured record sizes, the TTL policy enabled
on `tickBodies`, the single-field index exemptions deployed, and coverage
reporting working against real data.
