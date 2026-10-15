# Build: the mid-battle model call gets 40 seconds, not 20

15 October 2026. Founder-requested fix ("extend the agent's thinking time from 20 seconds to 30 or 40"), built on the Build 2b discovery's timing read. STOP at handback for founder review and merge (after the close).

## Verdict

| Question | Answer |
|---|---|
| What was wrong? | The agent's check is one model call with a hard 20-second clock. How long the call takes is set almost entirely by how much the agent writes (correlation 0.99, about 9–10 ms per output token on Haiku 4.5). Any answer longer than roughly 1,900 tokens hit the clock and was thrown away: no decision, no bench note, no calls, nothing for the cockpit. That is the "No decision recorded at this check · the evaluation timed out" line. |
| How often? | Founder: 30.4% of model calls in week 2 (7 of 23), 46% on Oct 12; QA Diversifier: 41% overall, 57% on Oct 14. Every one was the SDK's own 20-second limit, never the backstop. Midday (12:00–13:00 ET) is worst. Source: `docs/audits/20261014_PHASE0_BUILD2B_COCKPIT.md` §A1–A4 (branch `claude/phase0-build2b-cockpit`). |
| What changed? | One named constant, `HAIKU_SDK_TIMEOUT_MS = 40_000` (`api/_utils/agentEvalTransport.js:21`), now passed to the call (`api/cron/agent-evaluate.js:2999`, was the literal `20_000`). The backstop is derived from it, 2 s above (`agentEvalTransport.js:29-30`, 22 s → 42 s). Comments and test pins updated. |
| Why 40 and not 30? | The agent's answer is capped at 3,072 tokens (`agentEvalTransport.js:80`). At the measured rate a full-length answer takes about 31–32 s, before any midday slowdown. 30 s would still cut off the longest answers; 40 s clears the cap with room, so the token cap, not the clock, is again what bounds an answer. |
| What does it cost? | Fewer worst-case checks fit in one cron run. A check is admitted only when 68 s remain (was 48 s) of the 290 s run budget, so the gate stops admitting new model calls about 20 s earlier in each run. Real checks take about 26 s at the median, so a run still fits roughly 8 battles; the existing fair rotation (`agent-evaluate.js:454`) puts any deferred battle first next run. The per-battle lock (120 s) still exceeds the worst-case check (about 90 s). Model cost: the long answers now complete and are billed; negligible against the monthly credit. |
| Fenced files? | None edited, none called in a new way. `agentEvalTransport.js` and `agent-evaluate.js` are not on the BUILD_RULES §1 fence list. |
| Tests | 2 new rows, the SDK-timeout row strengthened, 8 rows re-based, and one frozen fixture reconciled value-only (three strings, §2). Mutation check: 4 of 4 mutants killed (§3). Full Linux suite and `lint:gate`: §4. |
| What it does not fix | Whether checks that DO complete are minting calls. Not changed here; see §5. |

## 1. The contract

- The SDK per-request timeout on the one mid-battle `messages.create` is `HAIKU_SDK_TIMEOUT_MS` (40,000 ms). One exported source; the cron passes it as `{ timeout }`.
- The AbortController backstop is `HAIKU_CALL_CEILING_MS = HAIKU_SDK_TIMEOUT_MS + HAIKU_BACKSTOP_MARGIN_MS` (42,000 ms). Derived, so the backstop always stays behind the SDK's own timeout.
- The pre-call admission requirement stays the sum of the named constants (`shouldStartHaikuCall`, unchanged code): 10,000 build + 42,000 call + 12,000 post-call = 64,000 ms at `off`, plus the 4,000 ms calls reserve = 68,000 ms at `shadow`/`on`.
- `maxRetries: 0`, `TIME_BUDGET_MS` (290 s), `maxDuration` (300 s), the 120 s lock, the 3,072-token output cap, the model and every prompt are unchanged.

## 2. The diff

| File | Change |
|---|---|
| `api/_utils/agentEvalTransport.js` | `HAIKU_SDK_TIMEOUT_MS` and `HAIKU_BACKSTOP_MARGIN_MS` added (`:21`, `:29`); `HAIKU_CALL_CEILING_MS` derived (`:30`); comments re-stated (the 64 s / 68 s requirement, the timeout kinds). |
| `api/cron/agent-evaluate.js` | Imports the constant (`:181`) and passes it at the call (`:2999`); four comments that named 20 s / 22 s / 44 s / 48 s re-stated (`:222-224`, `:2824-2839`, `:2958-2970`, the timeout-kind comment). No logic change. The `budget_skipped` message now reads "…, 64s required" because it prints the computed requirement. |
| `api/_utils/agentEvalTransport.test.js` | New block: the timeout is 40 s and the backstop is derived 2 s above it; the timeout clears a full 3,072-token answer at ≤ 10 ms per token. The 44 s pin becomes 64 s. |
| `api/_utils/callRecords/publish.test.js` | The admission pins move 44,000 / 48,000 → 64,000 / 68,000; the "admits at off, not at shadow" boundary moves 46 s → 66 s. |
| `api/cron/agent-evaluate.timing.test.js` | `REAL_CALL_CEILING_MS` 22,000 → 42,000; the §4.1 build is re-based to the ceiling minus 0.5 s so the June 11 defect row still bites; the SDK-timeout row's double now honors the `timeout` it is handed and asserts it is `HAIKU_SDK_TIMEOUT_MS` (40,000). |
| `api/cron/agent-evaluate.tickStamps.callsOn.test.js` | The admission boundary row moves 46 s → 66 s left (64,000 off / 68,000 shadow); the skipped-phase row keeps its arithmetic (15 s left at the phase) with 68 s left and a 53 s model call. One comment re-stated. |
| `api/_utils/__fixtures__/callRecordsOffGolden.json` + its pin in `agent-evaluate.callRecords.offGolden.test.js` | **Value-only reconciliation, not a regeneration** — the Sep 25, 2026 precedent (the 2048 → 3072 token ceiling). The `budget_skipped` exit's message states the requirement, so exactly three strings change: "40s remaining, 44s required" → "40s remaining, 64s required". Nothing else in the fixture moves (`git diff --word-diff`: 3 × `44s` → `64s`). The SHA-256 pin moves in the same commit, the prior value recorded beside it. **Founder sign-off is the merge.** |

## 3. Mutation check

Each mutant applied in place, the affected files run, the file restored and compared byte-for-byte (`cmp`) afterwards.

| Mutant | What it does | Result |
|---|---|---|
| M1 | the call site goes back to the literal `timeout: 20_000` | **killed** — the timing suite's SDK-timeout row |
| M2 | `HAIKU_SDK_TIMEOUT_MS = 20_000` | **killed** — 6 rows across the three files |
| M3 | `HAIKU_SDK_TIMEOUT_MS = 30_000` | **killed** — 3 rows, incl. "clears a full-length answer" |
| M4 | the backstop left at a literal 22 s (not derived) | **killed** — 4 rows |

## 4. Required checks

Linux (the session's container), Node 22.22.0 / npm 10.9.4, `TZ=UTC`.

- The directly affected files: all pass.
- `npm run lint:gate`: exit 0.
- **First full run** (`--maxWorkers=4` on a 2-CPU container): 5 failures. Three were this change's own pins not yet re-based (the two `tickStamps.callsOn` admission rows and the off-golden `budget_skipped` message), fixed in the next commit. Two were 5-second test timeouts under CPU contention in untouched files (`api/cron/film-tape-backfill.e2e.test.js`, `src/components/League/leagueRawIds.guard.test.jsx`); both pass in isolation on this branch.
- **Final full run** (`--maxWorkers=2`, CI-shaped, at the pin-re-base commit `e777855`): 981 files passed, 4 skipped; **20,885 tests passed, 0 failed**, 65 skipped (858 s).
- `vite build`: not run — no client file changed and the diff is under the BUILD_RULES §2 review threshold (9 files including this record, about 260 lines).

## 5. Out of scope, reported for separate tasking

- **Calls on checks that complete.** On the founder's Oct 15 battle (screenshot, 12:39 ET) the cockpit showed Monitoring from the 12:15 check but no calls at all for the battle, and the 12:15 bench notes named two clear conditional plans (ACN above $228, MPC below $470) that did not appear as calls. Across weeks 1–2 the two accounts minted 156 calls over 256 checks, about 0.6 per check (2b discovery, executive table), so a few completed checks with none is possible but worth a read. Not diagnosable from this session (no production credentials). If the first battles after this merge still show only Monitoring after several completed checks, that read is the next task.
- **The crypto slot prompt** (flipped on by PR #967 on the night of Oct 14) adds prompt text to every check. Its effect on answer length is unmeasured; with this change, length no longer turns into lost checks.

## 6. Production validation (after merge and confirmed deploy)

Crons do not run on preview (BUILD_RULES §6), so the first production session is the test.

1. **Next trading day, one battle.** Expect no "the evaluation timed out" lines through the midday hours. Some checks will now take 20–35 s; that is the point.
2. **Record (read-only).** Over the first full day, `evaluations[].haikuError.timeoutKind === 'sdk'` should be near zero, and `callMs` above 20,000 should appear on completed checks.
3. **Run health.** No `budget_skipped` or deferred battles beyond what the day's battle count explains (`agentEvalRuns`, `deferredBattleIds`).
