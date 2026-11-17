# The chart's evidence — spec of record V1: the daily sweep and the read route

**Status:** spec of record, as built (Claude Code, 16 Nov 2026). **Basis:** the build prompt *The chart's evidence: the daily sweep and the read route*, V1.1 of 16 Nov 2026, from the AssetResearch planning chat; the discovery `docs/audits/20261115_PHASE0_AGENTIC_CHART_EXPERIENCE.md` (draft PR #1072); the founder's rulings of 15 Nov 2026 ("Yes to all"). **Built on:** `main` at `71bc6bde` (#1073), rebased before the push onto `main` at `88d34457` (#1074, #1075, #1077). **Report:** `docs/audits/20261116_BUILD_CHART_EVIDENCE.md`.

**Three PRs, each with `main` as its base, merged in order A → B → C:**

| PR | Branch | Holds | Flag |
|---|---|---|---|
| A | `claude/chart-evidence-read-route` | the read route, `CHART_READ_MODE`, the client read, this spec and the report | `CHART_READ_MODE = 'off'` |
| B | `claude/chart-evidence-sweep` (contains A) | the sweep cron, its state, its flag, the census script | `SETUP_EVIDENCE_SWEEP_ENABLED = false` |
| C | `claude/chart-evidence-sweep-on` (contains B) | the one-line switch | `SETUP_EVIDENCE_SWEEP_ENABLED = true` |

Nothing in this build appears on screen. The vite build of PR B's head is byte-identical to `main`'s in every JS, CSS and HTML file.

---

## 1. Rulings adopted

### 1.1 The founder's rulings (15 Nov 2026)

| # | Ruling | In this build |
|---|---|---|
| ACX-1 | The first setup is the Trend Follower's pullback and resume, the setup the evaluator already measures. A 200-day reclaim is a later detector; nothing on screen says "reclaim" until one is measured. | The records the sweep makes and the route reads are the evaluator's `tf-setup-v1` records, nothing else. |
| ACX-2 | A daily sweep creates the evidence for all 228 ranked stocks. Nothing acquires on open. | §5. The route never acquires (RR-1). |
| ACX-3 | The daily chart draws unadjusted candles. | Later build (the Chart view's read). |
| ACX-4 | A conditional plan lives on a hypothesis version with three new fields. | Later build. |
| ACX-5 | The agent answers a plan in a checked shape and names a level by picking a numbered measured item. | Later build. |
| ACX-6 | The opening read is fixed wording from the stored record. No model call on open. | The route makes no model call; the projection (§4.4) is what that wording will read. |
| ACX-7 | The KB method reaches the app through the existing chain. | Later build. |

### 1.2 The build prompt's rulings

The route: RR-1 – RR-9 (§4). The sweep: SW-1 – SW-9 (§5). Those marked **NEW** in the prompt were approve-by-default and are built as written: RR-2 (any signed-in player), RR-4 (the server picks the session), SW-1 (a cron of its own), SW-3 (three runs per session), SW-4 (the allocation, for this job only), and the route's path.

### 1.3 Readings made where the prompt is silent, or where the code differs from it

Each is built and listed in the report for the founder's review. None reverses a ruling.

| # | Where | Reading |
|---|---|---|
| R-1 | RR-5's example "missing adjustment data" | `refused` is the record's own `status: 'refused'`: the daily-bars adapter refused the evidence (a split inside the window, a short or gapped history, a bad row). A record whose bars had **no adjusted close** is not refused in the store: after the 30-minute confirmation (`classify.js:23`) it is finalised with `status: 'ok'` and a verdict, its split check `not_available`. The route answers it `measured`, and the projection carries one field beyond RR-6's list, `adjustmentMetadata` (`'present' | 'absent'`, copied from the record), so the Chart view can say the split check could not run. An `ok` record whose verdict is `unknown` (a missing fact) is also `measured`. |
| R-2 | SW-4 "a day" | A day is one trading session, the key of the state document (SW-5). The cap is 400 per session. A UTC calendar day can touch two sessions' documents (the 12:30 run serves the session before; the 22:30 and 23:30 runs the new one), so the bound per UTC day is 800 in the worst case; the expected total per UTC day stays about 230–275. |
| R-3 | SW-2 step 5 | **The brake, one rule for three kinds.** "In a row" is in completion order across the four workers, so a provider failing three requests in four can trip it. Eight outcomes of ONE kind in a row, each from a request this run counted, close admission for the run, with the kind as the deferred reason: `unpublished` — `missing_bar` and no usable row for the session in the payload, read through the store's own mapper (the provider has not published it; without the brake a too-early run would spend ~228 requests for nothing); `shared_refusal` (R-17); `provider_failing` (R-14). Any other outcome of this run's own request breaks the streak; a record merely READ does not, so late names between finals still stop a too-early run before it spends the cap (review L1-2 and its refuter). |
| R-4 | SW-3 "a weekend or holiday run" | A run whose instant is not a trading day (`lastCompletedSessionAt(...).relation === 'non_session'`) reads nothing and requests nothing. The next trading morning's run catches the session up. |
| R-5 | SW-3 times | `30 12,22,23 * * 1-5` UTC (§5.1): the first post-close run 90 minutes after a winter close, so the session's bar is more likely published. |
| R-6 | RR-3 conversion | The symbol is trimmed, upper-cased, and "." is read as "-" (`BRK.B` → `BRK-B`, the store's form; `compute-index-intelligence.js:741` converts the same way for the provider). Crypto is checked first, so it is always `unsupported_symbol_class`, never a generic refusal. |
| R-7 | RR-8 limits | Per IP 60 a minute (the shared middleware); per player 30 a minute, in the instance's memory, before any read. |
| R-8 | RR-4 | If the calendar cannot name a session (outside the maintained years), the route answers 503 `calendar_missing` with no read. |
| R-9 | RR-1 "any provider client import" | The route imports no provider module and no fetching function directly; its one `marketDataCache.js` import is the pure `isCryptoSymbol`. The store's `index.js`, which the route must import for `readSnapshot`, imports its own acquisition module; the route never calls it, and its test fails on any `fetch`, any claims touch and any transaction. |
| R-10 | SW-8 "one health line per run that did work" | Every run past the flag gate logs one line, the deferred ones (weekend, calendar) included; a flag-off run logs nothing. The store's own warning lines (`acquire.js:102`, existing behaviour, which SW-7 keeps unedited) name the symbol and session — never a price — on each failed or refused fetch; the two brakes and closing admission at the cap bound how many a run can print (review L2-5). |
| R-11 | SW-2 "a programming error is surfaced" | A programming error is the store's `SetupEvidenceProgrammingError`, or any error that carries no numeric gRPC status code (every Firestore failure carries one; the provider's failures never reach the sweep): a `TypeError`, a plain `Error` thrown by code. Wherever it is thrown — the store path, the counter's transaction, the end-of-run record, the plain state read — it stops admission and reads, waits for the calls in flight, records the run, logs the line, and is thrown: the cron answers 500 `sweep_failed` with the error's name (review L1-3). A transient Firestore failure is counted by stage and code, and the run goes on. |
| R-12 | the cron's auth | The house pattern (the `x-vercel-cron` header or `Bearer CRON_SECRET`), with one tightening: an unset or empty secret never matches. |
| R-13 | Phase 0 point 6 | The new state collection is already denied by the rules' catch-all; the build adds an explicit server-only block, a default-suite tripwire and an emulator denial suite (the Slice 2 precedent). Publishing the rules changes no behaviour; it is listed as an optional founder step in PR C. |
| R-14 | SW-4 (review L2-1) | **`provider_failing`.** Transport failures (`fetch_failed`, `non_array_payload`, `malformed_payload` — a missing provider key included, which fails before the network) count toward the brake (R-3). Without it an outage would spend the session's whole 400 on failures and leave the morning's catch-up nothing. |
| R-15 | SW-2 "the next run picks up the rest" (review L1-4) | The 12:30 run is a session's last: what it defers, and a confirm-class name it observes for the first time, stay without a record for that session; the next run serves the next session. The route then answers `behind` with the session before, when that one has a record. |
| R-16 | SW-4 (review L1-5, L2-6) | A refusal at the counter comes after the store has taken its claim, so it adds an attempt (no request) to the claim document. The request that takes the cap's last place closes admission at once, and a transient failure of the counter's own transaction closes it too (`counter_failed`), so only units already in flight can be refused this way — at most three a run. |
| R-17 | SW-2, the store's confirm rule (review L1-1, the refuters of lenses 1 and 2) | **`shared_refusal`.** Some refusals the store makes permanent only by its confirm rule (a second sample 30 minutes on): a gap inside the 55-bar window (`missing_bar` whose payload HAS the session's row), a short history (`insufficient_history`), a bad date, a missing fact on the session's row. One stock's own is measured that way. Many in a row — first samples, or confirmations now created as refused records — mean one cause shared by every name (a closure the calendar lacks, a provider-wide hole, a truncated answer), and the brake bounds them to about eleven a run instead of 228 permanent refusals. The store's confirm rule cannot tell a shared cause from a stock's own (SW-7 keeps it unedited): **for the founder** — a store-level ruling, if a shared cause should never be confirmed. |

---

## 2. Phase 0 (the seven findings)

The findings, with their citations, are in the report §2. In short: the store's contract holds as the prompt describes it (point 1); the Slice 2 tenant supplied the counting wrapper, the admission deadline, the serialised state transactions and the counts-only line (point 2); a 46th cron entry is within the plan's limit of 100 (`BUILD_RULES.md` §6; point 3); all 228 ranked tickers are in the store's key form, one with a hyphen (`BRK-B`), none crypto (point 4); a session whose bar the provider has not published is `missing_bar` with no `after`, retryable, and nothing final is written (point 5); the catch-all deny covers a new server-only collection (point 6); the activation observer's 0 pointers are by design — both pre-flip Trend Follower battles had passed their 3-day catch-up horizon when the code first reached `main` (point 7).

---

## 3. Flags

| Flag | Where | Type | Ships | Read by | Pin |
|---|---|---|---|---|---|
| `CHART_READ_MODE` | `src/config/researchModalFlags.js` (beside the shell's and Battle Research's flags) | string tri-state `'off' \| 'allowlist' \| 'on'` | `'off'` | the route (and, later, the Chart view's read), at call time through `resolveChartReadMode()` (`src/components/Research/Sheet/chartReadMode.js`); a value outside the walked states is `'off'` | `src/config/chartReadFlag.test.js`; noted by name in `flagPinGuard.test.js`'s DARK_BY_DESIGN block |
| `SETUP_EVIDENCE_SWEEP_ENABLED` | `src/config/setupEvidenceSweepFlags.js` (a flag-source module of its own, registered in `FLAG_SOURCE_MODULES`) | boolean | `false` (PR B); `true` (PR C) | the cron, through `api/_utils/setupEvidenceSweep/gate.js`, at call time | `src/config/setupEvidenceSweepFlags.test.js`; a `DARK_BY_DESIGN` entry that PR C drops |

`'allowlist'` admits a signed-in player whom `isCockpitOwnerAllowlisted` names, read at call time (per player, not per battle: a record carries no owner). Each flip of `CHART_READ_MODE` is a one-line founder PR, never a build PR.

---

## 4. The read route (PR A)

### 4.1 `GET /api/research/setup-read?symbol=…` — `api/research/setup-read.js`

The order of checks (RR-8):

| Step | Check | Answer |
|---|---|---|
| 1 | the security middleware and the per-IP limiter (60 a minute) | the middleware's own |
| 2 | GET only | 405 |
| 3 | auth: the uid from the verified token | 401 |
| 4 | `CHART_READ_MODE` admits this player | 404 `chart_read_unavailable` |
| 5 | the symbol: crypto → 400 `unsupported_symbol_class`; not one of the 228 ranked stocks → 400 `invalid_symbol`; missing, empty, longer than 24 or not a string → 400 `invalid_request` | 400 |
| 6 | the per-player limiter (30 a minute), before any read | 429 `rate_limited` |
| 7 | the reads: at most two, through the cache | 503 `calendar_missing` if the calendar cannot name a session; 500 on a failed read or a record the projection cannot read |
| 8 | the answer | 200 |

`Cache-Control: private, no-store` on every answer from step 2 on. `maxDuration` 5 s.

### 4.2 The session (RR-4) and the three answers (RR-5)

The server picks the session; a client `session` (or any other query key) is ignored. It reads the last completed session (`lastCompletedSessionAt(now)`), and only if that has no record, the session before it. At most two reads, both `readSnapshot` under the current rule set.

| Answer | When | `read` |
|---|---|---|
| `measured` | a record with `status: 'ok'` — whatever its verdict, `unknown` included | the projection |
| `refused` | a record with `status: 'refused'` | the projection (every fact null, every check `unknown`, the reason the adapter's) |
| `absent` | no record for either session | `null` |

### 4.3 The body

```
{ answer: 'measured' | 'refused' | 'absent',
  symbol: 'BRK-B',                         // the store's form
  servedAt: <epoch ms>,
  sessionsTried: ['2026-11-16'] | ['2026-11-16', '2026-11-13'],
  read: <the projection> | null }
```

The keys are exactly `SETUP_READ_BODY_KEYS` (`src/components/Research/Sheet/setupReadContract.js`).

### 4.4 The projection (RR-6) — the contract for the Chart view's read

`api/_utils/setupRead/projection.js`, outside the store's library, names no collection. Every value is the record's own, copied; an array or object is rebuilt key by key; nothing is derived or re-computed. The keys are exactly `SETUP_READ_FIELDS`, in this order:

| Field | Copied from | Shape |
|---|---|---|
| `session` | `key.session` | `YYYY-MM-DD` |
| `asOf` | `entry.asOf` | `YYYY-MM-DD` (the session the verdict is dated to) |
| `capturedAt` | `capturedAt` | ISO instant the provider's response was received |
| `behind` | true when the record is the earlier session's | boolean |
| `ruleSet` | `key.ruleSet` | `{ setupVersion, thresholdsHash, semanticsId }` (today `tf-setup-v1`, `26f3f411b566`, `tf-setup-v1/sem-1`) |
| `basis` | `entry.basis` | `'raw'` |
| `verdict` | `entry.verdict` | `'valid' \| 'invalid' \| 'unknown'` |
| `reason` | `entry.reason` | `null` on valid; `regime \| extended \| no_setup` on invalid; `missing_fact \| insufficient_history \| …` or the adapter's refusal reason on unknown |
| `pattern` | `entry.pattern` | `'breakout' \| 'pullback_resume' \| null` (null unless valid) |
| `regime` | `entry.regime` | `'uptrend' \| 'downtrend' \| 'no_trend' \| 'unknown'` |
| `patternsSatisfied` | `entry.patternsSatisfied` | array; an `invalid · extended` record still names the satisfied pattern |
| `patterns` | `entry.patterns` | `{ breakout, pullback_resume }`, each `'satisfied' \| 'failed' \| 'untestable'` |
| `checks` | `entry.checks` | nine `{ id, lhs, op, rhs, result }` — the regime checks' sides are two-element arrays; `result` is `true \| false \| 'unknown'`; each check's `facts` list is dropped |
| `facts` | `entry.factsUsed[name].value` | `{ C, SMA_fast, SMA_slow, SMA_slow_5ago, swingHigh, swingLow, ATR, V, V_avg }`, each a number or null |
| `missing` | `entry.missing` | the facts that are null |
| `swingHigh`, `swingLow` | `entry.evidence.swingHigh` / `.swingLow` | `{ value, date }` (bars 1..20; the most recent bar wins a tie) |
| `pullbackLows` | `entry.evidence.pullbackLows` | three `{ date, low }`, bars 0..2 (empty on a refused record) |
| `adjustmentMetadata` | `entry.evidence.adjustment.metadata` | `'present' \| 'absent'` — reading R-1 |

**Never leaves the server:** the writer's commit and host, anything of the claims document, the 55 stored bars and the adapter's evidence block, `sourceMeta`, the refusal's `detail`, `requestedAsOf`, `evidenceClass`, the windows, each check's `facts` list, and any field this list does not name (a test plants an unknown field at every level of a record and shows none leaves). A record the projection cannot read — another schema version, a key other than the one asked for, an unknown status, no entry, a verdict off its list, or anything but the nine checks with their ids (review L2-4) — throws, and the route answers 500: never `absent`, never part of a record.

### 4.5 The cache

Per instance, in memory, keyed by `symbol|last completed session`, at most 60 seconds (an `absent` answer too). A new session is a new key.

### 4.6 The client read — `src/components/Research/Sheet/setupRead.js`

`fetchSetupRead(symbol)` calls the route through `fetchWithAuth`, resolves the body exactly as sent when it matches the contract, and rejects `{ status, error }` otherwise (the route's error code, `request_failed`, `network` with status 0, or `malformed_body` for a 200 outside the contract). No screen and no caller in this build; a test pins that nothing under `src/` imports it.

### 4.7 The import guard (RR-9)

The route, its test, the record fixture (`api/_utils/setupRead/__fixtures__/readRecords.js`) and the projection's test are listed in `setupEvidenceImportGuard.test.js` by exact filename. The projection, the contract, the resolver and the client read name neither the library nor its collections and are not listed (the guard fails on a listed file that does not name the store). The library stays its six modules.

---

## 5. The sweep (PR B)

### 5.1 The cron (SW-1, SW-3)

`api/cron/setup-evidence-sweep.js`, `maxDuration` 300 s, one `vercel.json` entry (45 → 46 of 100; the three test pins of the count and `BUILD_RULES.md` §6 move with it):

```
{ "path": "/api/cron/setup-evidence-sweep", "schedule": "30 12,22,23 * * 1-5" }
```

| UTC | Winter (EST) | Summer (EDT) | Serves |
|---|---|---|---|
| 22:30 Mon–Fri | 5:30 PM | 6:30 PM | that day's session, 90 / 150 minutes after the close |
| 23:30 Mon–Fri | 6:30 PM | 7:30 PM | the same session, an hour later: it makes the store's 30-minute confirming fetch and retries what was not ready |
| 12:30 Mon–Fri | 7:30 AM | 8:30 AM | the session before (before the 9:30 AM open): the catch-up |

Friday's session is caught up Monday morning. A weekday holiday's runs find a non-session day and do nothing (R-4); the morning after a holiday catches up. On an early-close day (1 PM ET) the post-close runs are later still.

### 5.2 One run (SW-2) — `api/_utils/setupEvidenceSweep/sweep.js`

1. The flag off → `{ skipped: true }` before the Firestore handle is taken.
2. The session is `lastCompletedSessionAt(now)`; the clock is the injected function the store requires. The calendar cannot say → deferred, no read. A non-session day → deferred, no read, no request.
3. The state (one plain read). Unreadable → deferred, no read, no request.
4. Each of the 228 ranked stocks, sorted, at most four at a time: `readSnapshot`. A final record is counted by its own status (measured or refused) and costs no provider request.
5. Otherwise, while admission holds, `getOrAcquireSnapshot` with a counting `fetchPayload` (5.3), each call awaited to its end. `final`, `pending`, `retryable` (by reason) and `excluded` are counted.
6. Admission closes on: the deadline (less than 12 s — one acquisition's reserve — before `handlerStart + 240 s`), the cap (the request that takes its last place closes it at once), the brake (R-3: `unpublished`, `shared_refusal` R-17, `provider_failing` R-14), a state the counter cannot read or a transient failure of its transaction (`counter_failed`, R-16), or a programming error (R-11). The deadline and a programming error also stop the reads. Names not attempted are counted under `deferred` by reason. The next run picks them up (R-15); every run is safe to repeat.
7. One transaction records the run on the state.
8. One health line, counts only: `[setupEvidenceSweep] {…}` — the session date, counts, and keys from closed lists (anything else is `other`). No symbol, no price, no account id.
9. A programming error (R-11) is thrown after the record and the line: the cron answers 500.

### 5.3 The allocation (SW-4) — this job only

The counting wrapper is what the store calls when, and only when, it makes its one provider request. Before the request, `reserveProviderRequest` reads `providerRequests` on `setupEvidenceSweepState/{session}` and writes it + 1 **in one transaction, with no increment sentinel**; at 400 it writes nothing and refuses, the wrapper throws, the store records a retryable `fetch_failed` with no request made, and the run stops admitting. So the count is the count of requests started, the 400th is the last whichever runs or instances overlap, it survives a run that dies after its request, and the next session's document starts at zero. Expected: 228 requests a session at the floor, about 275 with confirm-class names (the Slice 2 spec's assumed 20%). Slice 2's flag and its D-6 condition are untouched.

### 5.4 The state (SW-5) — `api/_utils/setupEvidenceSweep/state.js`

One server-only document per trading session, `setupEvidenceSweepState/{session}`. Counts and instants only; no per-symbol map, so no index exemption:

```
{ schemaVersion: 1, session: 'YYYY-MM-DD',
  providerRequests,                 // the cap's counter
  runs, firstRunAt, lastRunAt,      // runs recorded, and when
  completedAt,                      // the first run that found every name final; null until then
  runMs,                            // the recorded runs' time, summed
  latest: { startedAt, names, final: { measured, refused }, acquired, retryable: { <reason>: n },
            pending, excluded, deferred: { <reason>: n }, failures: { <stage:code>: n }, programmingErrors },
  updatedAt }
```

A document this code cannot read (another schema, another session, a counter that is not a whole number) is never read as zero and never written over: a reservation against it is refused and the run records nothing. Rules: an explicit `allow read, write: if false` block (R-13), its tripwire (`setupEvidenceSweepRulesTripwire.test.js`) and its emulator denial suite (`test/rules/setupEvidenceSweepDenials.rules.mjs`).

### 5.5 Nothing else changes (SW-7)

No store module, no evaluator file, threshold or golden, no activation-observer or Slice 2 module, the rankings cron, no fenced file (BUILD_RULES §1). No fenced function is called. Three lines move in one row of Slice 2's test file (a comment, the expected list and the title): its census row A1.1 (`api/_utils/setupMenuLabels/tenant.test.js`) pins the callers of `getOrAcquireSnapshot`, and now lists the sweep as the third, by design (review L3-4).

### 5.6 The import guard (SW-9)

Listed by exact filename because each names the store: `sweep.js`, `sweep.test.js`, `constants.test.js`, the census script and its test, and the emulator suite `test/rules/setupEvidenceSweep.rules.mjs`. The cron file, the gate, the constants, the state module, the in-memory db fixture and the state's tests do not name it and are not listed. The two state `tx.set` sites are in `compositionProtectedStoresAllowlist.json`.

### 5.7 The day-after check — `scripts/census-setup-evidence-sweep.mjs`

Read-only by construction: a restricted reader with two field-masked members (`get`, `getAll`), never the database handle; imports only the store's pure key and session modules, the rule set, the ranked list and the sweep's constants; a write-verb grep over its own text in its test. Aggregates only. Run the morning after the first full trading day:

```
node scripts/census-setup-evidence-sweep.mjs --session YYYY-MM-DD
```

It prints the records found of the 228 (measured, refused, absent, unreadable, read failed); valid by pattern, invalid by reason, unknown by reason and by missing fact, refused by reason; the provider requests counted; the runs, their time, and the minutes from the first run to the run that found every name final.

---

## 6. Cost

| Item | Figure |
|---|---|
| Provider requests per trading session | 228 at the floor; about 230–275 expected; hard stop 400 (R-2: ≤ 800 in one UTC day in the worst case) |
| Model calls | 0 |
| Firestore reads per sweep run | 1 state read + 228 record reads + 1 read in the end-of-run transaction; per acquisition the store's own (a claim transaction reading 2 documents, a final transaction reading 2) plus one counter transaction (1 read) |
| Firestore writes per session | ~228 records + ~456 claim writes (each claim is written when its lease is taken and again when it is cleared) + one counter write per request (~230) + one record per run (3) ≈ 915 (review L2-7) |
| The route's reads per call | 0 (a cache hit), 1, or at most 2 record reads; no provider request; no write |

---

## 7. Tests and guards

The route: each status in order; the flag off, `'allowlist'` and `'on'`; the symbol; the three answers and `behind`; the body's keys; the cache; read-only against the REAL `readSnapshot` over an in-memory db that throws on any claims touch, write, transaction or query, with `fetch` stubbed to throw. The projection: on real records made by the store's own acquisition. The sweep: the flag off; a full run (finals cost nothing, four at once, the deadline, a second and a third run); retryable, confirm, pending and programming-error dispositions; the cap (the 400th is the last; it survives a failed run; it resets the next session); the unpublished brake; a weekend and a holiday; counts only; the one provider path; zero model calls. The emulator: the cap on real transactions, two overlapping runs, a run that died, a 228-name run. Guards: `setupEvidenceImportGuard.test.js`, `flagPinGuard.test.js`, `compositionProtectedStores.scan.test.js`, `npm run test:rules`.
