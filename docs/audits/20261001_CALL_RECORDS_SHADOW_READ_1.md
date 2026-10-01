# Shadow read #1: call records (`CALL_RECORDS_MODE = 'shadow'`)

**Date:** 2026-10-01 · **Builder:** Claude Code · **Branch:** `claude/shadow-read-1` · **Script:** `scripts/shadow-read-call-records.mjs`
**Plan of record:** `docs/design/COCKPIT_SPEC_V1_3.md` §3.13, `docs/design/COCKPIT_SPEC_V1_3_AMENDMENT_A.md`, and `docs/audits/20260924_BUILD0_CALL_RECORDS.md` §10 (the read's sources and the proposed rollback triggers).
**Scope:** every battle with a check since PR #913 merged (`403dfb03`, 2026-09-25 22:34:07 −05:00 = 2026-09-26T03:34:07Z). The baseline is the five sessions before it, Sep 21–25.

**Session preamble (BUILD_RULES §2, §3).**
- `git fetch origin` ran first (exit 0). Then `git checkout main && git pull` ("Already up to date") and `git checkout -b claude/shadow-read-1`.
- HEAD at the start was `84b6dbcf4889ab5c7fe28b0eaf9f04eee322f4d3` (Merge PR #915), equal to `origin/main`.
- The tree had three untracked files at the start, none from this task: `docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json` and `vwap-exit-dating-census-report.json`. They are not committed here.
- **Production access was read-only.** The script uses only Admin SDK `.get()`, `.count().get()`, `.select()` and `getAll()` calls. A grep finds no `set`, `update`, `delete`, `create`, `runTransaction`, `batch` or `bulkWriter` call on Firestore; the only `.set(` hits are local `Map`s. No flag was changed.
- Credentials came from the existing loaders: `scripts/loadLocalEnv.js` (`.env.local`) and `api/_utils/firebaseAdmin.js`.
- The read ran at **2026-10-01 15:32 ET**, so **Oct 1 is a session still in progress** and its numbers are partial.
- **Fence (BUILD_RULES §1):** no fenced file was edited and no fenced function was called. The script imports only `loadLocalEnv.js` and `firebaseAdmin.js`.

## Executive verdict

| Question | Answer |
|---|---|
| **Are the records sound?** | **Yes. There are 0 integrity violations across all 9 calls and 9 tick references.** Every terminal call has its receipt and the right `receiptRef`. The one hit was observed after its mint, and its price meets its condition (BE 293 > 285). No transition landed on the check that minted the call. No open call sits under a completed battle. Every `calls[]` reference in a tick capture resolves to a call. |
| **`call_conflict`?** | **0** (expected 0). This comes from the latest `callsDiag` of each of the 34 scanned battles. Per-check conflicts are visible only in the Vercel logs, which this session cannot read (§3). |
| **How much did the model declare?** | **Very little.** 4 of 166 shadow checks (2.4 %) had `declarationsPhase = 'expected'`, and each wrote its `declarations/` record (4 of 4). That produced **9 calls**: 6 `called_shot`, 3 `confirmation` and 0 `pick`. There were no removed rows and no `invalidated` calls. |
| **What happened to the calls?** | **All 9 resolved and none is open.** Every call used the `next_check` horizon, and every one was judged once, by the next check, at the slot boundary (ruling E-3). The results were **1 hit and 8 `expired_unresolved`**, with no pre-slot hits. **0 `actedEvalId`.** By kind and state: `called_shot` 6 (1 hit, 5 expired), `confirmation` 3 (all expired), and no `pick`. |
| **Coverage** | **34 of 34 scanned battles have a complete latest flip scan** (cursor `null`, no deadline stops). This includes the 24 passive/CPU battles, which run flips but write no evaluation entry. The calls phase wall time (latest check per battle, n=34) is **p50 69 ms and p95 172 ms**, against a non-model budget of 2,000 ms. |
| **Backlog** | **4 `callSweepQueue` documents, all stale**: each points at a battle with 0 open calls. Flips do not clear the queue and nothing drains it until Build 1. This is the "known backlog" in spec §3.13, and it holds **no unresolved call**. |
| **Rollback triggers (report §10)** | **4 PASS, 1 TRIPPED.** Anticipation candidates per check fell **from 1.72 to 1.20 (−30.4 %)** against a ±25 % limit. Timeout rate (+0.50 pts), truncated+invalid (+0.82 pts), p95 `callMs` (+1 ms) and SWAP share (+1.2 %) are inside their limits. Read §2 before deciding. The baseline is small (4 battles), and the p95 `callMs` trigger cannot detect anything at the current timeout rate. |
| **Anything needed from you?** | **Yes: a decision on the tripped trigger.** The §10 triggers are labeled "proposed, for the founder to confirm". The rule says roll back. The evidence in §2 is consistent with a real effect of the declarations schema, but the baseline is too thin to be conclusive. The options are in §2.3. **This PR changes no flag.** |

## 1. What the read found, beyond the tables

1. **Every call so far is a `next_check` call, and all 9 come from `momentum_chaser` battles.** This is two archetypes short of a varied sample. The only contrarian battle in the shadow window (`NScUWgRy…`) declared nothing. There are only 9 calls in production, so §G lists **all 9** rather than ten.
2. **Each judgment came 72–139 s after its slot boundary.** That is the time from the slot instant to the next check's prompt build (`observedAtMs`). Every receipt's `source` is `model_prompt`. All 4 judging checks were model-path checks with `evalId` = minting `evalId` + 1, so the "never on the minting check" rule held with one check of separation.
3. **`declarationsPhase` is on every shadow entry** (166/166; 0 entries lack the key). So the flip was deployed before the first post-flip session (Sep 28). `expected`/record agreement is exact in both directions.
4. **Three `said` texts state a condition the record does not store.** This is a presentation fact for Build 1/2, not an integrity violation:
   - **§G 3 (TXN):** says "closes below $280 on the day", but the record is a `next_check` call judged at the next slot.
   - **§G 5 (NVDA):** says "trades above $232.65 … and holds through next eval", which the single-observation judgment does not test.
   - **§G 1 (MU):** says "on the next check", which matches.

   Record-derived chat lines in Build 1 should read from `condition`/`horizon`, not from `said`. That is already the contract's rule, and the samples show why.
5. **§G 2 is the one hit: an entry `called_shot` with `defaultAction: 'act'`** and a counterpart (BE in for TXN). It **hit**: BE was 293 against 285. **No trade followed**, so `actedEvalId` is absent. This is correct in shadow: the record schedules nothing (BR-3).

## 2. The tripped trigger: anticipation candidates per check

### 2.1 The numbers
- **Baseline:** 1.72 candidates per model-ok check (98/57). Four single-day battles, one per day (Sep 21, 22, 23, 25). Their per-battle rates are 1.86, 1.83, 1.80 and 1.40.
- **Shadow:** 1.20 (177/148). Ten single-day battles, 2–4 per day. Their per-battle rates run from 0.63 to 1.89.
- **8 of 10 shadow battles are below the lowest baseline battle (1.40).** The only exceptions are `lk1CmAN4…` (1.89) and contrarian `NScUWgRy…` (1.75).
- So the drop is spread across most battles, not one outlier. That makes it hard to dismiss as a change in which battles ran.

### 2.2 Why it is not conclusive
- **The baseline is small:** 4 battles, 57 checks, and 3 of the 4 battles are `momentum_chaser`.
- **Sep 24 had no battles at all.** Its 26 runs are empty, so the "five sessions" give four days of data.
- **The candidates count is a model-output behavior.** It can move with the market regime, and these are different days with different universes.
- **No paired run (same battle, same inputs, schema on and off) exists to separate the schema's effect from day-to-day variance.**
- **A plausible mechanism, stated as a hypothesis only:** the `declarations` block adds +4,627 serialized characters of tool schema (Amendment A, §3.13 row) and offers the model another place for forward-looking conditions. It may displace `anticipationCandidates` even on checks that declare nothing; 162 of 166 checks declared nothing, and the rate fell anyway.

### 2.3 Options for you
- **(a) Apply the rule: roll back to `'off'`.** This is one line plus its pin row, in one commit (`featureFlags.js` `CALL_RECORDS_MODE`, `callRecordsFlags.test.js:44,47`; flip report §6). At `'off'`, existing records are neither read nor written.
- **(b) Keep shadow and extend the read.** Run this script again after five full shadow sessions (through Oct 2), and/or run a paired off/shadow evaluation on recorded inputs (`scripts/PAIRED_EVAL_HARNESS_README.md`) to isolate the schema's effect.
- **(c) Restate the trigger,** for example as a per-archetype limit or one that needs a minimum number of baseline battles.

The other four triggers pass. Two caveats apply to them:
- **p95 `callMs` cannot detect a move right now.** Both windows sit at the SDK's 20 s per-request ceiling (20,004 vs 20,005 ms; `agentEvalTransport.js:9`), because timeouts are 7.9 % and 8.4 % of calls, above 5 %. While that holds, a p95 trigger cannot trip. p50 moved from 16,359 to 15,437 ms.
- **Deferred battles per run have no threshold in §10.** They are 0 in both windows.
- **Run wall time rose for a reason other than the flip.** Run p95 `wallMs` went from 52.2 s to 125.3 s, but battles per run doubled (4.00 → 8.23). Per-battle wall time is flat (p50 7,957 → 7,820 ms), so the rise is load, not the calls phase.

## 3. Method and sources (VERIFIED = read at HEAD `84b6dbcf` in this session)

| Read | Source | Marker |
|---|---|---|
| Battles in scope | `agentBattles` field-masked index (511 docs), then a full read of every battle that is `active` or expires on/after 2026-09-21 (42 battles) | VERIFIED |
| Entries | `evaluations[]`: `timestamp`, `declarationsPhase` (`api/cron/agent-evaluate.js:4145`), `callMs`, `haikuError.failureClass` (`:3958-3974`), `decision`, `candidates` (`api/_utils/tickStamps.js:366-367`) | VERIFIED |
| Windows | Baseline = ET days 2026-09-21..25. Shadow = `timestamp ≥ 2026-09-26T03:34:07Z` | VERIFIED |
| Runs | `agentEvalRuns/*` (`composeEvalRunRecord`, `agent-evaluate.js:538-555`). Runs with `battlesTotal = 0` are excluded from load metrics and counted separately | VERIFIED |
| Calls, declarations, receipts | `collectionGroup('calls' / 'declarations' / 'callObservations')`, restricted to parents under `agentBattles` | VERIFIED |
| Hit/expiry rule | `decideFlip` / `conditionMet` (`api/_utils/callRecords/flip.js:114`, `:90`). The script's `conditionSatisfied` mirrors `conditionMet` | VERIFIED |
| Receipt shape | `buildReceipt` (`api/_utils/callRecords/receipt.js:35`) | VERIFIED |
| Tick references | `agentBattles/{id}/ticks/*` `.calls[]` (`api/_utils/tickCapture/captureWriter.js:279`), for every shadow battle and every battle with a call | VERIFIED |
| Phase wall time | `cronState.callsDiag.ms` / `.flips.ms` (`flip.js:382`, `publish.js:235`) | VERIFIED |
| Rates | Timeout and truncated+invalid rates are **per model call** (entries with a finite `callMs`). SWAP share is per entry. Candidates per check are per **model-ok** check (finite `callMs`, no `haikuError`) | Definition |

**What this read could not see, stated plainly:**
- **Vercel logs.** These hold the per-check `[calls] phase … removed=` lines, `[calls] call_conflict`, `[calls] truncation_event` and `[calls] flips skipped …` lines (report §10 step 7).
- **What stands in for them:**
  - Removed rows come from the `declarations/` records. Those exist only for checks whose block survived, so a fully removed or malformed block on a `none` check is invisible here.
  - `call_conflict` and the phase wall time come from `cronState.callsDiag`, which only holds the latest check of each battle (review B-4).
  - `cronState.declarationsPhase` and `cronState.callFlips` are also latest-check-only.
- **Truncation:** the `truncated_response` count comes from `haikuError.failureClass`. It is 0 in both windows, and all four shadow failures in that bucket are `invalid_tool_result`.

**Re-running:** `node scripts/shadow-read-call-records.mjs --out <file.md> [--json <raw.json>]`. The tables below are the script's verbatim output from the run at 15:32 ET. A later run will differ, because Oct 1 was still in session.

## 4. Generated tables (script output, verbatim)

Read at 2026-10-01T19:32:33.975Z (2026-10-01 15:32 ET). Flip merge instant: 2026-09-26T03:34:07Z. Battles read in full: 42 of 511. Shadow entries: 166 across 10 battles on 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01 (2026-10-01 is a session still in progress at read time).

### A. Executive tallies

| Item | Value |
|---|---|
| Call records (all time, collection group) | 9 |
| Declarations records | 4 |
| Receipts (`callObservations`) | 9 |
| Open `callSweepQueue` documents | 4 |
| Integrity violations | 0 |
| `call_conflict` (latest `callsDiag` per battle) | 0 |
| Rollback triggers tripped | 1 of 5 |

### B. Declarations, per ET day

| ET day | Entries | phase 'none' | phase 'expected' | phase key absent | declarations/ written |
|---|---|---|---|---|---|
| 2026-09-28 | 31 | 31 | 0 | 0 | 0 |
| 2026-09-29 | 57 | 55 | 2 | 0 | 2 |
| 2026-09-30 | 45 | 44 | 1 | 0 | 1 |
| 2026-10-01 | 33 | 32 | 1 | 0 | 1 |

- `expected` entries with no `declarations/{evalId}` record: none.
- Records whose entry is not `expected`: none.
- Removed rows by reason (from records that exist): none. Per day: none.
- `cronState.declarationsPhase` (latest check per battle only): written 4, failed 0.
  - 2yNCARN1NkOcJlsKgVP0: `eval_013` → `written`
  - d3T2JZcGAX7u1aiqFTMm: `eval_014` → `written`
  - lk1CmAN46sdJAk7VHz8G: `eval_004` → `written`
  - lwXrd9405FlQG6zc3M23: `eval_009` → `written`

### C. Calls

| ET day (mint) | kind | state | Count |
|---|---|---|
| 2026-09-29 | called_shot|expired_unresolved | 1 |
| 2026-09-29 | confirmation|expired_unresolved | 2 |
| 2026-09-29 | called_shot|hit | 1 |
| 2026-09-30 | called_shot|expired_unresolved | 1 |
| 2026-09-30 | confirmation|expired_unresolved | 1 |
| 2026-10-01 | called_shot|expired_unresolved | 3 |

- Invalidated reasons: none.
- Terminal: hit 1, expired_unresolved 8.
- `next_check` judgments: judged at the boundary → hit 1, expired_unresolved 8; pre-slot hits 0; still open 0 (past their boundary at read time: none).
- `outcome.actedEvalId` set: 0.
- `call_conflict` in `cronState.callsDiag`: 0. Expect 0.
- `callsDiag.phaseResult` (latest per battle): `none` ×34; truncated flags: 0; faults: 0.

### D. Integrity

| Check | Subjects checked | Violations |
|---|---|---|
| terminal_has_receipt | 9 | 0 |
| hit_after_mint_and_px_satisfies | 1 | 0 |
| no_hit_on_minting_eval | 9 | 0 |
| no_open_call_under_completed_battle | 9 | 0 |
| tick_call_ref_resolves | 9 | 0 |

- Receipts with no call: none.
- Tick captures carrying `calls[]`: 230 (4 non-empty, 9 references).

### E. Coverage

- `cronState.callFlips`: 34 battles carry it; complete 34/34 (100.00%). Every battle the cron scanned carries it, including passive (CPU) battles, which write no evaluation entry. This is the latest scan only, because each check overwrites it.

| Battle | Status | Last check (ET day) | Latest exit | evalId | scanned | total | complete | cursor |
|---|---|---|---|---|---|---|---|---|
| 1gETTr9L80e3gSPrKZYg | completed | 2026-09-28 | passive | null | 0 | 0 | true | null |
| dZYtJZznAgpQSr14L8SQ | completed | 2026-09-28 | model_result | eval_015 | 0 | 0 | true | null |
| fmE4RNW1qOe6Hunzylo1 | completed | 2026-09-28 | passive | null | 0 | 0 | true | null |
| JzQtjsFdwP9wrSVHpW4d | completed | 2026-09-28 | passive | null | 0 | 0 | true | null |
| k6VobQOiB69hB3kKCFMp | completed | 2026-09-28 | passive | null | 0 | 0 | true | null |
| NTNj46p7dAmAZ4ObPZGi | completed | 2026-09-28 | model_result | eval_016 | 0 | 0 | true | null |
| swW3OcpsBjnc7ltSNAiQ | completed | 2026-09-28 | passive | null | 0 | 0 | true | null |
| syhIaeVZwDaOazgKnsLv | completed | 2026-09-28 | passive | null | 0 | 0 | true | null |
| bGrOGvGx0s2Nn75QoKVu | completed | 2026-09-29 | passive | null | 0 | 0 | true | null |
| d3T2JZcGAX7u1aiqFTMm | completed | 2026-09-29 | model_result | eval_018 | 0 | 0 | true | null |
| FUQFR1ILqAs2XI860OwL | completed | 2026-09-29 | passive | null | 0 | 0 | true | null |
| haxyDA3lDmlmSL0PMeJ7 | completed | 2026-09-29 | passive | null | 0 | 0 | true | null |
| jR12Be56QNCKfVQi1vUs | completed | 2026-09-29 | model_result | eval_017 | 0 | 0 | true | null |
| lk1CmAN46sdJAk7VHz8G | completed | 2026-09-29 | model_result | eval_011 | 0 | 0 | true | null |
| mu1dmbEXeASnRpv8c9qz | completed | 2026-09-29 | passive | null | 0 | 0 | true | null |
| NScUWgRyhGH9wSs9g6jv | completed | 2026-09-29 | transport_failed_after_prompt | eval_011 | 0 | 0 | true | null |
| vIgGqNJsBMNmChEJaMYt | completed | 2026-09-29 | passive | null | 0 | 0 | true | null |
| y56QOXNmwPY905Srfwx4 | completed | 2026-09-29 | passive | null | 0 | 0 | true | null |
| 2yNCARN1NkOcJlsKgVP0 | completed | 2026-09-30 | model_result | eval_020 | 0 | 0 | true | null |
| 4kAkM0ASpksVelTXcP2r | completed | 2026-09-30 | passive | null | 0 | 0 | true | null |
| 9epZcCuM72kOmGqSPXs3 | completed | 2026-09-30 | passive | null | 0 | 0 | true | null |
| bzfCEJYCyK0I9wLKMYse | completed | 2026-09-30 | model_result | eval_025 | 0 | 0 | true | null |
| GHYVS4XBDqHBkrkOpNni | completed | 2026-09-30 | passive | null | 0 | 0 | true | null |
| niUeYxIKMx3HSkQwc8pv | completed | 2026-09-30 | passive | null | 0 | 0 | true | null |
| NofBU0nBAc64WWrJ5qg1 | completed | 2026-09-30 | passive | null | 0 | 0 | true | null |
| NzQi8dWsb88MU9GbuESL | completed | 2026-09-30 | passive | null | 0 | 0 | true | null |
| d3GNkrizM0zeBx4G9cKV | active | 2026-10-01 | model_result | eval_016 | 0 | 0 | true | null |
| IgZ2ZVyrMtvDAtCXDiGL | active | 2026-10-01 | passive | null | 0 | 0 | true | null |
| lwXrd9405FlQG6zc3M23 | active | 2026-10-01 | model_result | eval_017 | 0 | 0 | true | null |
| MpEUys8S6sNIIVX2RLFp | active | 2026-10-01 | passive | null | 0 | 0 | true | null |
| vBfhBhEWBgAaCIbuPvdc | active | 2026-10-01 | passive | null | 0 | 0 | true | null |
| x4HRCBq9jPtry6XwBMvW | active | 2026-10-01 | passive | null | 0 | 0 | true | null |
| y7EX2fFgTEuJfJVHvJ55 | active | 2026-10-01 | passive | null | 0 | 0 | true | null |
| zRPTO5nimsUXhQtPv8YE | active | 2026-10-01 | passive | null | 0 | 0 | true | null |

- Open `callSweepQueue` documents (nothing drains them until Build 1): 4.

| Battle | nextExpiresAt | Battle status | Open calls |
|---|---|---|---|
| 2yNCARN1NkOcJlsKgVP0 | 1790792100000 (2026-09-30 14:15 ET) | completed | 0 |
| d3T2JZcGAX7u1aiqFTMm | 1790708400000 (2026-09-29 15:00 ET) | completed | 0 |
| lk1CmAN46sdJAk7VHz8G | 1790705700000 (2026-09-29 14:15 ET) | completed | 0 |
| lwXrd9405FlQG6zc3M23 | 1790876700000 (2026-10-01 13:45 ET) | active | 0 |

- Calls phase wall time, `callsDiag.ms` (latest check per battle, n=34): p50 69 ms, p95 172 ms. Flip scan `callsDiag.flips.ms` (n=34): p50 69 ms, p95 172 ms. The two are equal in 32 of 34 battles. `callsDiag.ms` is composed as soon as the scan returns (flip.js `runExitCallsHook`), before the status write, so in practice it is the same measurement.
- `callsDiag.exit` mix (latest per battle): `passive` ×24, `model_result` ×9, `transport_failed_after_prompt` ×1; flip stops: `none` ×34.

### F. Rollback triggers (report §10), baseline Sep 21–25 vs shadow

| Window | Days with entries | Entries | Model calls | Timeouts | Trunc+invalid | p50 callMs | p95 callMs | SWAPs | Model-ok checks | Candidates |
|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 2026-09-21, 2026-09-22, 2026-09-23, 2026-09-25 | 63 | 63 | 5 | 1 | 16359 | 20004 | 3 | 57 | 98 |
| shadow | 2026-09-28, 2026-09-29, 2026-09-30, 2026-10-01 | 166 | 166 | 14 | 4 | 15437 | 20005 | 8 | 148 | 177 |

| Window | Runs with battles | Empty runs | Battles per run | Deferred battles | Run p95 wallMs | p50 wallMs per battle |
|---|---|---|---|---|---|---|
| baseline | 26 | 26 | 4.00 | 0 | 52217 | 7957 |
| shadow | 103 | 0 | 8.23 | 0 | 125305 | 7820 |

Per ET day:

| ET day | Window | Battles | Entries | Model calls | Timeout rate | Trunc+invalid rate | p95 callMs | SWAP share | Candidates / model-ok check |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-21 | baseline | 1 | 15 | 15 | 6.67% | 0.00% | 20007 | 6.67% | 1.86 |
| 2026-09-22 | baseline | 1 | 19 | 19 | 0.00% | 5.26% | 18691 | 5.26% | 1.83 |
| 2026-09-23 | baseline | 1 | 12 | 12 | 16.67% | 0.00% | 20004 | 8.33% | 1.80 |
| 2026-09-25 | baseline | 1 | 17 | 17 | 11.76% | 0.00% | 20004 | 0.00% | 1.40 |
| 2026-09-28 | shadow | 2 | 31 | 31 | 3.23% | 0.00% | 19820 | 6.45% | 0.77 |
| 2026-09-29 | shadow | 4 | 57 | 57 | 10.53% | 3.51% | 20005 | 5.26% | 1.29 |
| 2026-09-30 | shadow | 2 | 45 | 45 | 8.89% | 2.22% | 20004 | 4.44% | 1.40 |
| 2026-10-01 | shadow | 2 | 33 | 33 | 9.09% | 3.03% | 20004 | 3.03% | 1.21 |

| Trigger | Rule | Baseline | Shadow | Move | Verdict |
|---|---|---|---|---|---|
| Model timeout rate (per model call) | ≥ +2 pts | 0.0794 | 0.0843 | +0.50 pts | **PASS** |
| truncated_response + invalid_tool_result (per model call) | ≥ +1 pt | 0.0159 | 0.0241 | +0.82 pts | **PASS** |
| p95 callMs | ≥ +2,000 ms | 20004 | 20005 | +1 ms | **PASS** |
| SWAP share (per entry) | > 25 % relative | 0.0476 | 0.0482 | +1.2% | **PASS** |
| Anticipation candidates per check (model-ok checks) | > 25 % relative | 1.7193 | 1.1959 | -30.4% | **TRIPPED** |

Per battle (model-ok checks only), to show whether a move is the same battles changing or a different mix of battles:

| Window | Battle | Archetype | ET days | Model-ok checks | Candidates / check | SWAPs |
|---|---|---|---|---|---|---|
| baseline | SNZ9qdXQFMRj9Trr2nSK | contrarian | 2026-09-21 | 14 | 1.86 | 1 |
| baseline | DRgA4vrEIZ0kN574vexk | momentum_chaser | 2026-09-22 | 18 | 1.83 | 1 |
| baseline | jR53kNbElhXSAL0LSwo8 | momentum_chaser | 2026-09-23 | 10 | 1.80 | 1 |
| baseline | xKLKthncJhPcYzloF42M | momentum_chaser | 2026-09-25 | 15 | 1.40 | 0 |
| shadow | NTNj46p7dAmAZ4ObPZGi | momentum_chaser | 2026-09-28 | 16 | 0.63 | 0 |
| shadow | dZYtJZznAgpQSr14L8SQ | momentum_chaser | 2026-09-28 | 14 | 0.93 | 2 |
| shadow | NScUWgRyhGH9wSs9g6jv | contrarian | 2026-09-29 | 8 | 1.75 | 2 |
| shadow | d3T2JZcGAX7u1aiqFTMm | momentum_chaser | 2026-09-29 | 16 | 1.00 | 1 |
| shadow | jR12Be56QNCKfVQi1vUs | momentum_chaser | 2026-09-29 | 16 | 1.00 | 0 |
| shadow | lk1CmAN46sdJAk7VHz8G | momentum_chaser | 2026-09-29 | 9 | 1.89 | 0 |
| shadow | 2yNCARN1NkOcJlsKgVP0 | momentum_chaser | 2026-09-30 | 17 | 1.35 | 1 |
| shadow | bzfCEJYCyK0I9wLKMYse | momentum_chaser | 2026-09-30 | 23 | 1.43 | 1 |
| shadow | d3GNkrizM0zeBx4G9cKV | momentum_chaser | 2026-10-01 | 15 | 1.27 | 1 |
| shadow | lwXrd9405FlQG6zc3M23 | momentum_chaser | 2026-10-01 | 14 | 1.14 | 0 |

- Deferred battles per run (no §10 threshold — reported, not judged): baseline 0, shadow 0.
- Failure classes, baseline: `invalid_tool_result` ×1, `timeout` ×5; shadow: `timeout` ×14, `invalid_tool_result` ×4.

### G. Sample calls (9 — every call in production)

**1. `lk1CmAN46sdJAk7VHz8G:eval_004:call:0`** — kind `confirmation`, archetype `momentum_chaser`, minted 2026-09-29 14:01 ET

```json
{
  "said": "If MU breaks below $1,055 on the next check, I'll rotate to NVDA to lock in Star tier stability.",
  "symbol": "MU",
  "direction": "exit",
  "slot": "star",
  "counterpart": "NVDA",
  "condition": {
    "side": "below",
    "level": 1055
  },
  "defaultAction": "act",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790705700000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790705781418,
  "origin": "equipped",
  "outcome": {
    "receiptRef": "agentBattles/lk1CmAN46sdJAk7VHz8G/callObservations/lk1CmAN46sdJAk7VHz8G:eval_004:call:0"
  },
  "receipt": {
    "callId": "lk1CmAN46sdJAk7VHz8G:eval_004:call:0",
    "evalId": "eval_005",
    "observedAtMs": 1790705781418,
    "px": 1071.17,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**2. `lk1CmAN46sdJAk7VHz8G:eval_004:call:1`** — kind `called_shot`, archetype `momentum_chaser`, minted 2026-09-29 14:01 ET

```json
{
  "said": "If BE holds above $285 through the next check, I'll swap TXN for BE to capture the momentum tail in Support.",
  "symbol": "BE",
  "direction": "entry",
  "slot": "support",
  "counterpart": "TXN",
  "condition": {
    "side": "above",
    "level": 285
  },
  "defaultAction": "act",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790705700000,
    "basis": "next_check"
  },
  "state": "hit",
  "stateSource": "check",
  "stateChangedAt": 1790705781418,
  "origin": "equipped",
  "outcome": {
    "receiptRef": "agentBattles/lk1CmAN46sdJAk7VHz8G/callObservations/lk1CmAN46sdJAk7VHz8G:eval_004:call:1"
  },
  "receipt": {
    "callId": "lk1CmAN46sdJAk7VHz8G:eval_004:call:1",
    "evalId": "eval_005",
    "observedAtMs": 1790705781418,
    "px": 293,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**3. `lk1CmAN46sdJAk7VHz8G:eval_004:call:2`** — kind `confirmation`, archetype `momentum_chaser`, minted 2026-09-29 14:01 ET

```json
{
  "said": "If TXN closes below $280 on the day, I'll swap it for AMAT to escape the quiet setup and upgrade to higher ATR.",
  "symbol": "TXN",
  "direction": "exit",
  "slot": "support",
  "counterpart": "AMAT",
  "condition": {
    "side": "below",
    "level": 280
  },
  "defaultAction": "act",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790705700000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790705781418,
  "origin": "equipped",
  "outcome": {
    "receiptRef": "agentBattles/lk1CmAN46sdJAk7VHz8G/callObservations/lk1CmAN46sdJAk7VHz8G:eval_004:call:2"
  },
  "receipt": {
    "callId": "lk1CmAN46sdJAk7VHz8G:eval_004:call:2",
    "evalId": "eval_005",
    "observedAtMs": 1790705781418,
    "px": 281.445,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**4. `d3T2JZcGAX7u1aiqFTMm:eval_014:call:0`** — kind `called_shot`, archetype `momentum_chaser`, minted 2026-09-29 14:47 ET

```json
{
  "said": "If MU breaks below $1,065 on the next eval, I would consider rotating to KLAC (higher technical rank, +3.31% intraday momentum).",
  "symbol": "MU",
  "direction": "exit",
  "slot": "star",
  "counterpart": "KLAC",
  "condition": {
    "side": "below",
    "level": 1065
  },
  "defaultAction": "hold",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790708400000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790708539391,
  "origin": "agent_initiative",
  "outcome": {
    "receiptRef": "agentBattles/d3T2JZcGAX7u1aiqFTMm/callObservations/d3T2JZcGAX7u1aiqFTMm:eval_014:call:0"
  },
  "receipt": {
    "callId": "d3T2JZcGAX7u1aiqFTMm:eval_014:call:0",
    "evalId": "eval_015",
    "observedAtMs": 1790708539391,
    "px": 1071.24,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**5. `2yNCARN1NkOcJlsKgVP0:eval_013:call:0`** — kind `called_shot`, archetype `momentum_chaser`, minted 2026-09-30 14:01 ET

```json
{
  "said": "If NVDA trades above $232.65 (+1.0x ATR bonus level) and holds through next eval, would consider taking the bonus and rotating to bench strength (MSFT or INTC).",
  "symbol": "NVDA",
  "direction": "exit",
  "slot": "core",
  "counterpart": "MSFT",
  "condition": {
    "side": "above",
    "level": 232.65
  },
  "defaultAction": "hold",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790792100000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790792172241,
  "origin": "agent_initiative",
  "outcome": {
    "receiptRef": "agentBattles/2yNCARN1NkOcJlsKgVP0/callObservations/2yNCARN1NkOcJlsKgVP0:eval_013:call:0"
  },
  "receipt": {
    "callId": "2yNCARN1NkOcJlsKgVP0:eval_013:call:0",
    "evalId": "eval_014",
    "observedAtMs": 1790792172241,
    "px": 230.31,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**6. `2yNCARN1NkOcJlsKgVP0:eval_013:call:1`** — kind `confirmation`, archetype `momentum_chaser`, minted 2026-09-30 14:01 ET

```json
{
  "said": "If GME breaks below $24.00 (entering -0.97x ATR territory), would exit to INTC or MSFT to stop the bleed and capture bench momentum.",
  "symbol": "GME",
  "direction": "exit",
  "slot": "star",
  "counterpart": "INTC",
  "condition": {
    "side": "below",
    "level": 24
  },
  "defaultAction": "act",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790792100000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790792172241,
  "origin": "agent_initiative",
  "outcome": {
    "receiptRef": "agentBattles/2yNCARN1NkOcJlsKgVP0/callObservations/2yNCARN1NkOcJlsKgVP0:eval_013:call:1"
  },
  "receipt": {
    "callId": "2yNCARN1NkOcJlsKgVP0:eval_013:call:1",
    "evalId": "eval_014",
    "observedAtMs": 1790792172241,
    "px": 24.6775,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**7. `lwXrd9405FlQG6zc3M23:eval_009:call:0`** — kind `called_shot`, archetype `momentum_chaser`, minted 2026-10-01 13:31 ET

```json
{
  "said": "If GME trades above $25.12 (upper BB breakout) by next check, I hold and watch for +1.0x ATR confirmation.",
  "symbol": "GME",
  "direction": "entry",
  "slot": "star",
  "counterpart": null,
  "condition": {
    "side": "above",
    "level": 25.12
  },
  "defaultAction": "hold",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790876700000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790876774952,
  "origin": "agent_initiative",
  "outcome": {
    "receiptRef": "agentBattles/lwXrd9405FlQG6zc3M23/callObservations/lwXrd9405FlQG6zc3M23:eval_009:call:0"
  },
  "receipt": {
    "callId": "lwXrd9405FlQG6zc3M23:eval_009:call:0",
    "evalId": "eval_010",
    "observedAtMs": 1790876774952,
    "px": 24.395,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**8. `lwXrd9405FlQG6zc3M23:eval_009:call:1`** — kind `called_shot`, archetype `momentum_chaser`, minted 2026-10-01 13:31 ET

```json
{
  "said": "If NVDA breaks above $232.65 (resistance) by next check, I hold for the directional move.",
  "symbol": "NVDA",
  "direction": "entry",
  "slot": "core",
  "counterpart": null,
  "condition": {
    "side": "above",
    "level": 232.65
  },
  "defaultAction": "hold",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790876700000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790876774952,
  "origin": "agent_initiative",
  "outcome": {
    "receiptRef": "agentBattles/lwXrd9405FlQG6zc3M23/callObservations/lwXrd9405FlQG6zc3M23:eval_009:call:1"
  },
  "receipt": {
    "callId": "lwXrd9405FlQG6zc3M23:eval_009:call:1",
    "evalId": "eval_010",
    "observedAtMs": 1790876774952,
    "px": 231.21,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```

**9. `lwXrd9405FlQG6zc3M23:eval_009:call:2`** — kind `called_shot`, archetype `momentum_chaser`, minted 2026-10-01 13:31 ET

```json
{
  "said": "If SNOW breaks above $344.91 (resistance) by next check, I hold to capture the NR7 breakout.",
  "symbol": "SNOW",
  "direction": "entry",
  "slot": "core",
  "counterpart": null,
  "condition": {
    "side": "above",
    "level": 344.91
  },
  "defaultAction": "hold",
  "horizon": {
    "phrase": "next_check",
    "expiresAt": 1790876700000,
    "basis": "next_check"
  },
  "state": "expired_unresolved",
  "stateSource": "check",
  "stateChangedAt": 1790876774952,
  "origin": "agent_initiative",
  "outcome": {
    "receiptRef": "agentBattles/lwXrd9405FlQG6zc3M23/callObservations/lwXrd9405FlQG6zc3M23:eval_009:call:2"
  },
  "receipt": {
    "callId": "lwXrd9405FlQG6zc3M23:eval_009:call:2",
    "evalId": "eval_010",
    "observedAtMs": 1790876774952,
    "px": 340.915,
    "source": "model_prompt",
    "replacedInPrompt": false
  }
}
```


## 5. Decision

**Founder decision, 2026-10-01: roll back.** The §10 trigger is accepted as written. Anticipation candidates per check moved **−30.4 %** (1.72 → 1.20) against the 25 % relative limit (§2), so `CALL_RECORDS_MODE` returns to `'off'`.

**The rollback commit, on this branch.** It is the exact reverse of the flip, `64ecd855` + `a59fa85b`. Both files are now byte-identical to their pre-flip state at `9f39875d`.

| File | Change |
|---|---|
| `src/config/featureFlags.js` | `CALL_RECORDS_MODE = 'shadow'` → `'off'` |
| `src/config/featureFlags.js` (docstring) | the "(shipped)" label moves from `'shadow'` back to `'off'` |
| `src/config/callRecordsFlags.test.js` | the pin row goes back to `walk step 0: 'off' — no schema property, no reserve, no record read or written`, with `expect(CALL_RECORDS_MODE).toBe('off')` |

**The records are frozen in place.** At `'off'` the cron neither reads nor writes `declarations/`, `calls/`, `callObservations/` or `callSweepQueue/` (`featureFlags.js` docstring; spec §2).

The documents this read counted stay exactly as listed in §4:
- 4 declarations records;
- 9 calls, all terminal, none open;
- 9 receipts;
- 4 stale queue documents.

**Nothing is deleted.** The `cronState.declarationsPhase` / `callFlips` / `callsDiag` keys already on battle documents also stay, and nothing reads them at `'off'`.

**What comes next.** Shadow resumes with **revised declarations wording**, after a **paired experiment** isolates the schema's effect on anticipation candidates: the same recorded inputs, run with the schema off and with it at shadow. Those are separate tasks, and nothing in this branch starts them.

**Pushed ≠ deployed.** The rollback takes effect only when you merge and deploy. Until then, production stays at `'shadow'`.

**Verification of the rollback commit, on Windows (`C:\Users\fashr\portfolio-duel`).** Output was redirected to files, never piped, and each exit code was asserted with `test $rc -eq 0`.

| Check | Result |
|---|---|
| Full suite, `npx vitest run` | **exit 1 (assert failed).** 42 files / 90 tests failed; 757 files / 15,603 tests passed. **None of the failures comes from the rollback:** |
| … the same 42 files at the pre-rollback commit `11482c9d` (a clean `git worktree`) | **35 of the 42 fail there too**, so they predate this change. They are environment-dependent on this checkout (for example `intradayPromptExclusions.test.js`, which the Amendment A follow-ups already list as CRLF-sensitive). The prior flip's green run was in a Linux container. |
| … the other 7, re-run alone on the rollback tree | **6 pass**: the `backing*`, `leagueDevPods` and `AgentBattleScreen.*.jsdom` suites, which are load-sensitive under the full parallel run. **3 tests fail** in `p4Equivalence.battery.test.js`, the `decide.js` source tripwires. Cause: in this working copy the three `__p4_snapshots__/decide.*.source.snap.txt` files have LF endings (last modified 2026-08-12), while `decide.js` has CRLF. `decide.js` is byte-identical in both trees (SHA-256 `c0dd397b…`), and a fresh checkout passes. This is local line-ending drift, not fixed here. |
| The flag's own suites: `callRecordsFlags`, `flagPinGuard`, `api/_utils/callRecords/`, `callsOn`, `offGolden`, `m7e2eBudget`, and the seven exact-key cron suites | **20 files / 398 tests passed; exit 0** |
| `npm run lint:gate` | **exit 1.** All 1,379 errors (565 report lines) are in `.vercel/output/`, a local, git-ignored build artifact. The pre-rollback worktree, which has no `.vercel/`, passes. **Re-run as `npx eslint . --config eslint.gate.config.js --max-warnings 0 --ignore-pattern ".vercel/**"`: exit 0.** |
| Fence (BUILD_RULES §1) | No fenced file was edited and no fenced function was called |
