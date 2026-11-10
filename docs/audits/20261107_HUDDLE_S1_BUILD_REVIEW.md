# Huddle S1 — BUILD_RULES §2 review record

Branch `claude/huddle-s1` (from `main` @ `d503dd07`). Reviewed tree: `6a5cd38c` (100 files, +8,371 / −47 at the time). Fixes on top of it through `563e0550`. Build report: `docs/audits/20261107_BUILD_HUDDLE_S1.md`.

## How it was run

- **Snapshots.** One `git -c core.autocrlf=false archive` extraction per reviewer, path-distinct, in the build session's scratchpad, `node_modules` linked; reviewers read-only on git and on the working tree (refuters and the mutation lens wrote only inside their own snapshot).
- **Unprimed.** Each lens got the specs, the build prompt's hard rules and its lens; not the builder's conclusions, and it was told not to read the build report. (L1 disclosed seeing the report's running findings inside the branch diff; see L1 below.)
- **Lenses.** L1: the flag-off guarantee, the fence and the safety rules. L2: server domain correctness. L3: the hub and client contract.
- **Refute pass.** Every finding went to a separate verifier on its own snapshot, told to refute it with a concrete repro (throwaway tests inside that snapshot): 10 (L1) + 13 (L2) + 15 (L3) = 38 findings, 36 CONFIRMED or PARTLY, 2 REFUTED.
- **Fixes.** Each fix carries a row that fails with the fix reverted (checked by the builder, mutant by mutant, before each commit).
- **Mutation lens.** Last, on its own snapshot of the fixed head `b7573512`, with its own emulator: see the end.
- **`vite build`** on the final head: see the build report §8.

### Lens L1 — the flag-off guarantee, the fence, the build's safety rules

| Id | Lens severity | Refute verdict | Disposition |
|---|---|---|---|
| L1-1 | major | CONFIRMED (refuter: minor in behaviour — fails safe, keys match the vendor's documented shape) | **Not fixable here — founder question.** The speech helper reads ElevenLabs keys (`audio_base64`, `alignment.characters`, `character_*_times_seconds`, error `detail.status`) that no committed capture shows: rule 8 is broken for this one payload. The build's three allowed speech calls all came back HTTP 400 (`api_key_id_used_as_api_key`: the local key value is the key's id), so no capture exists. A missing key fails safe (transcript-only, reason recorded). Needed before the flip: one captured with-timestamps response, committed with the key stripped, and the reader checked against it. |
| L1-2 | minor | CONFIRMED (repro on the real job: absent end times → `storage:error` after both uploads, orphaned objects; empty → `durationMs: 0`) | **Fixed `730a3597`**: `alignmentDurationMs` (speech.js) — null, never 0, computed before storage. |
| L1-3 | minor | CONFIRMED (repro: 40 rows, 400 ms each → every tick visited the same 26; flag never cleared) | **Fixed `35269909`**: least recently reconciled first, every visit stamped, a settled day leaves the set. |
| L1-4 | minor | CONFIRMED (nit, on precedent) | **Fixed `1eefda58`**: `huddle/planTemplates.js` in `PROMPT_CONTRIBUTING_MODULES`. |
| L1-5 | minor | CONFIRMED (nit; positive controls counted, markRun not a site) | **Fixed `2e8cdc8f`**: the marker write names its collection; key `worker.js::markRun::set::huddleRuns`. |
| L1-6 | minor | PARTLY (code never logs the token; platform logs unverifiable; the path token is spec-mandated, V1.1 §6) | Reported, not changed. |
| L1-7 | nit | CONFIRMED (cite corrected to `huddleService.js:69`; no usable exposure) | Reported, not changed (Firestore rules cannot hide fields; owner-only). |
| L1-8 | nit | CONFIRMED (marginal; the brief's own writes have the same exposure) | Reported, not changed. |
| L1-9 | nit | **REFUTED** — B §B1 promises no NEW dispatch and no late memory mutation, not the retraction of an in-flight commit; an SDK retry is the same dispatch, and nothing mutates memory late | No change. |
| L1-10 | nit | CONFIRMED (spec gap: C15 implemented to the letter) | **Founder question** (with L2-2): a battle under an archetype the player no longer has equipped reads "· Reconfirm", but Reconfirm is idempotent while the equipped archetype equals the newest confirmation's. |

L1 disclosed that while paging `branch.diff` it printed the builder's running-findings section of this report (RF-1..RF-20); it states every finding was checked in code. Recorded as a partial loss of independence for L1.


### Lens L2 — server-side domain correctness

| Id | Lens severity | Refute verdict | Disposition |
|---|---|---|---|
| L2-1 | major | PARTLY (behaviour confirmed: one 429 / 5xx / abort / storage throw publishes a permanent transcript-only huddle; "should fail the attempt" is not in the spec, and the concept requires the transcript fallback) | **Founder question.** Not changed: a retry reruns gather and two Sonnet calls (no checkpoint), and `storage_unavailable` / a bad key would burn all three attempts. |
| L2-2 | major (spec gap) | CONFIRMED (a training clone formed with an archetype override — live via `trainingLoadoutSpec.js` / `trainingClone.js` — freezes that archetype; confirm records the ranked agent's; `stale_approach` forever; Reconfirm answers `already_confirmed`) | **Founder question** (with L1-10). The code follows C15 to the letter. Casual clones are unaffected. |
| L2-3 | major | CONFIRMED (a read with "guaranteed", "will buy at 9:30", "I learn", RVOL and an outside ticker reached `record.names[]` and the card) | **Fixed `730a3597`**: a name's read passes the beat checks or the name is dropped and recorded. |
| L2-4 | minor | CONFIRMED (repro: written + heard under rA, then a `retry_error` keyed rB → "Expired at the close") | **Fixed `44244968`**: `statusReceiptOf`. |
| L2-5 | minor | CONFIRMED (a vendor error is final for the symbol for the day; `fetchLastClose` takes no signal and can hang a lane) | **Fixed in part `b7573512`**: a 15 s deadline on the daily-bar read. The "final for the day" half is reported as a design point (A §A2 "cache ready / failed"), not changed. |
| L2-6 | minor | CONFIRMED (the worker never expires an unanswered plan) | **Fixed `35269909`**: the publish marks the row for reconcile; the pass expires it at the close. |
| L2-7 | minor (refuter: major-ish) | CONFIRMED (a claim rejection rejected the drain with lanes running; a reconcile query throw stopped the invocation) | **Fixed `e5b44312`**. |
| L2-8 | minor | PARTLY (A §A10 moves the BRIEF's trading-day skip to the flip PR; the enqueue stage is Huddle code and V1.1 §5.1 says it skips non-trading days) | **Fixed `e5b44312`**: no enqueue on a non-trading day; no job after the close. The brief's own skip stays a flip-PR checklist line. |
| L2-9 | minor | CONFIRMED (`AI`, `A` matched words) | **Fixed `b7573512`**: one- and two-letter tickers only in ticker form. |
| L2-10 | nit | PARTLY (a UTC-day bucket is one reading of "24 h window"; `eventId` has no consumer in S1) | Reported, not changed. |
| L2-11 | nit | **REFUTED** — `call-response.js` gates on the resolved mode before its literal `'on'`; inputs are identical whenever both run | No change (the header comment's wording is loose). |
| L2-12 | nit | CONFIRMED (self-healing) | **Fixed `e5b44312`**: a committed confirm answers 200. |
| L2-13 | nit | CONFIRMED | **Fixed `3e313e56`**: `closedAt` for a slot that no longer held the plan. |

### Lens L3 — the hub and client contract

| Id | Lens severity | Refute verdict | Disposition |
|---|---|---|---|
| L3-1 | major | CONFIRMED (flag-on repro: card names the BaggerBomb game, Open opens the ranked game; the first Later spends the ranked game's key) | **Fixed `d9688e6f`**: the card's Open and Later act on the candidate it shows; flag-on suite row `227d2baa`. |
| L3-2 | major | CONFIRMED | **Fixed `d9688e6f`**: a record still being made or failed shows its state, no plan card. |
| L3-3 | major | CONFIRMED | **Fixed `d9688e6f`**: Partnership is loading / error until today's read answers. |
| L3-4 | major (a) / test integrity (b) | CONFIRMED (a: play on a detached element, in a hidden tab, under the ceremony; b: React 19 clears the ref before a useEffect cleanup — the pinned stop never ran) | **Fixed `d9688e6f`**: the element's own ref cleanup; a play generation abandons an in-flight Play on any stop; the guard's text match replaced by behaviour rows. Unverified: iOS Safari's gesture rule for a `play()` after an awaited fetch. |
| L3-5 | major | CONFIRMED (scoped: the reset is right for 409 / 422 preview, wrong otherwise) | **Fixed `d9688e6f`**: try/catch; edits kept unless the plan they were made on is gone. |
| L3-6 | major (tests) | CONFIRMED | **Fixed `227d2baa`**: `CommandCenterHub.huddle.jsdom.test.jsx`, the flag mocked on. |
| L3-7 | minor | CONFIRMED | **Fixed `8ce2ed90`**: "Huddle · plan confirmed / skipped / expired". |
| L3-8 | minor | CONFIRMED (refuter: higher — every quiet morning) | **Fixed `d9688e6f`**: an empty proposed plan is no candidate. |
| L3-9 | minor | CONFIRMED (a, b); (c) true but not a defect | **Fixed `d9688e6f`**: Reconfirm landing after the sheet's focus (one microtask), only from the Reconfirm door; the hidden-tab effect no longer re-runs on `focusPlan`. |
| L3-10 | minor | CONFIRMED | **Fixed `d9688e6f`**: Pause then Play resumes. |
| L3-11 | minor | CONFIRMED as code fact | **Ruling (Command Center chat)**: before the open, a multi-day game already scored reads as "in session" and outranks "Huddle ready" (D1's "has opened" vs C6's "before the open"). Not changed. |
| L3-12 | minor | PARTLY (sequence guard and knowledge join confirmed; the missing visibility re-read refuted — stated design) | **Fixed in part `8ce2ed90`**: the sequence guard. The Activity knowledge join (a loading history can read as "nothing recorded yet") is reported, not changed: it is the S4 runtime's join. |
| L3-13 | minor (tests) | CONFIRMED | **Fixed `d9688e6f`**. |
| L3-14 | nit | CONFIRMED | **Fixed in part `8ce2ed90`**: no raw beat id. Reported: the copy guard's walk does not read `src/components/Huddle/`; dissent reasons are server data rendered in the body; the `<audio>` handlers are React props, not manifest rows. |
| L3-15 | nit | PARTLY | Reported, not changed (the history read downloads whole records; the client SDK has no field mask). |

## Mutation lens (fixed head `b7573512`)

Run on its own `git archive` snapshot of `b7573512` with its own emulator (port 8191), one test at a time, every mutated file restored byte-identical (sha256 checked). Unmutated baselines: every target file passed. **37 mutants: 30 killed, 7 survived.** Two kills came only from the sweep's behavioural twin in `agent-evaluate.tickStamps.pins.test.js` (the sweep's own suite mocks the flag on), one only from the emulator.

| # | Code mutated | Mutation | Verdict | After `563e0550` |
|---|---|---|---|---|
| 1a, 1b | `routeKit.js` | the flag check moved after middleware / method / auth | KILLED | — |
| 2a, 2c | `sweep.js` | one read before the flag check (sweep; settle) | KILLED by the pins twin | — |
| 3 | `compute-daily-regime-brief.js` | the `!isHuddleOn()` gate dropped | **SURVIVED** (the enqueue threw on the stub db, swallowed) | KILLED: the brief suite spies the enqueue and drain stages |
| 4 | `agent-evaluate.js` | the sweep call moved later | KILLED | — |
| 5a | `planTemplates.js` | `RENDERED_MAX_CHARS` 500 → 600 | **SURVIVED** (the row read the constant back) | KILLED: pinned to 500 with literal strings |
| 5b, 5c | `planTemplates.js` | `>` → `>=`; the level band 0.25 → 0.30 | KILLED | — |
| 6 | `dissentTable.js` | a default row for an unknown archetype | KILLED | — |
| 7a, 7b | `applyRules.js` | fall back to the newest confirmation; no newer-instruction check | KILLED | — |
| 8a–8c | `scriptPrompt.js` | forbidden loop, name-read checks, outside-ticker check removed | KILLED | — |
| 8d | `scriptPrompt.js` | only the name read's learning-claim check removed | **SURVIVED** | KILLED: learning and unverified-unsaid reads added |
| 9 | `earnings.js` | a null `actual` coerced to 0 | KILLED | — |
| 10a, 10b | `playback.js` | an out-of-range start clamped; expiry skipped | KILLED | — |
| 11 | `worker.js` | the claim's try/catch removed | KILLED | — |
| 12a | `applyPlan.js` | the receipt in a second transaction after the filing | **SURVIVED** 2/2 (the contention row catches it only by a race) | KILLED: an emulator row counts one transaction and its two documents |
| 12b | `applyPlan.js` | the same with a 400 ms gap | KILLED | — |
| 13 | `queue.js` | `ownsClaim` without the generation check | KILLED (emulator) | — |
| 14a, 14b | `confirmPlan.js` | no base-revision check; a same-archetype reconfirm accepted | KILLED (emulator) | — |
| 15 | `firestore.rules` | owner write on the record | KILLED (emulator) | — |
| 16 | `nextAction.js` | the Huddle above a game in session | KILLED | — |
| 17 | `HuddleSheetBody.jsx` | no `stillWanted()` after the token | KILLED | — |
| 18 | `hubCopy.js` | a planted learning / clock / numeral string | KILLED (5 rows) | — |
| 19 | `huddleView.js` | imports the Huddle service | KILLED | — |
| 20 | `useHuddleToday.js` | a 60 s `setInterval` | KILLED | — |
| 21 | `CommandCenterHub.jsx` | actions replaced only for the Huddle candidate | KILLED (flag-on suite) | — |
| 22 | `huddleFlags.js` | the flag set true | KILLED | — |
| O1 | `eodhdNews.js` | a key the capture lacks, read by destructuring | **SURVIVED** (the scan sees dotted reads only) | KILLED: the scans forbid bracket access, destructuring, spreading, enumerating |
| O2 | `queue.js` | `markReconciled` no longer stamps a visit | KILLED (emulator only) | — |
| O3 | `routeKit.js` | `clientViewOf` adds the playback hash and storage path | **SURVIVED** | KILLED: a client-view row |
| O4 | `DeployAttemptContext.jsx` | a lazy `import()` of the Huddle service | **SURVIVED** (static edges only) | KILLED: the walk follows lazy edges |

Every survivor's mutant was re-planted by the builder after the fix and fails its guard. Noted by the lens, not a mutation finding: B4, the 409, C15's reconfirm, the client-write denials and the reconcile stamp are pinned only by the emulator suites (`npm run test:rules`), outside the default `vitest run`. And a cold import pushed one `routes.dark` row to 5,020 ms in a parallel batch (the routes are now loaded in a `beforeAll`).

## Tally

| | Findings | Refuted | Confirmed / partly | Fixed | To a ruling | Reported |
|---|---|---|---|---|---|---|
| L1 | 10 | 1 (L1-9) | 9 | 4 | 2 (L1-1, L1-10) | 3 |
| L2 | 13 | 1 (L2-11) | 12 | 9 | 2 (L2-1, L2-2) | 1 |
| L3 | 15 | 0 | 15 | 13 | 1 (L3-11) | 1 |
| **All** | **38** | **2** | **36** | **26** | **5** | **5** |

Mutation lens: 37 mutants, 30 killed, 7 survived; all 7 guards fixed in `563e0550` and re-killed. No blocker at any stage: every flag-off guarantee held.
