# Build report — Integrity Follow-up 2 (Meetings, Score Freeze, Honest Labels, Retry-Safe Records)

**Prompt:** "Build Prompt: Integrity Follow-up 2 (Meetings, Score Freeze, Honest Labels, Retry-Safe Records)", Fable, 8 October 2026. **Session:** Claude Code, 8 October 2026, in its own worktree. **Branch:** `claude/integrity-followup-2`, cut from `origin/main` at **`c1822e39`** after `git fetch origin main` (PR #942 merged; `docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md` present, so no STOP). The desktop app named the local branch `claude/integrity-followup-2-fe4c21`; it is pushed under the prompt's name. **Fence:** none — no fenced file is edited (§0). **Decisions in force (8 Oct):** Q1 meetings → M1 plus the deadline · Q2 relabel · Q3 retry-safe records, then the meeting failure record · Q4 stamp the governing mode · the score freeze fixed here · points past 50 trades parked.

---

## Executive verdict

| Question | Answer |
|---|---|
| Can a planted meeting still trade, or make the agent wait? | **No** (§1). In the same update that writes a meeting, the cron now writes its own copy (`cronState.gameplanMeeting`), a field no player can write. A leg runs only when the meeting's id matches the copy **and** its pair matches a stored leg; each stored leg runs at most once, with the copy's symbols, and P6's belief comes from the copy. Every other leg is held and recorded on the history row (`heldLegs`, `heldLegCount`, `leg_not_proposed`), with no trade and no feed beat. A forged id, or a meeting with no copy (including any created before this deploy), never runs and never makes the agent wait. The agent waits only until the copy's deadline. The integrity build's **+497 eviction probe now fails**: 50 planted legs give no trade. **A server meeting a player approves runs byte-identical to base**: an 11-scenario base-versus-head differential, where the only differences are the copy key and Part D's marker on a refused leg (§7). |
| Can a player-written value still crash a check? | **Not through its shape** (§2). Every owner-writable field the cron, the batch review or the chat route reads now goes through a type-checking reader. Each shape — null, number, string, map, huge, inherited keys, and an object whose `toString` throws — lets the check complete and save its score, at off, shadow and enforce: 100 rows; 26 of the first commit's 99 crash on base. Batch review and chat: 33 + 2 rows; 14 of the first commit's 29 crash on base. Well-formed values behave byte-identically, apart from new caps on review lines and grade text (§9 row 6). **Still open, and out of scope by the prompt:** padding the document toward Firestore's 1 MiB limit still makes the score write fail (attacker lens K1-5). That stays with the rules overhaul and is filed as a separate task. |
| Labels | **Done** (§4). New launch-guard rows write `resolution: 'launch_guard_cleared'` and keep `systemNote`. Both census scripts accept the old and new values. `detectTradeProvenance` no longer relabels a same-pair trade; a test proves it without editing that prompt module. Every trade row's `entryMode` is `LAUNCH_EXECUTION_MODE`, at all six executor calls. The migration writes nothing. `battlePatternLogger` logs the governing mode. `entryMode` has no reader outside the two census scripts and the metadata allowlist (§4.2). |
| Records after an executor throw | **Retry-safe at all six callers and on every meeting leg, at every mode** (§5). The executor call itself sits in its own try; on a throw, the cron re-reads the battle for the row this call would have written. **Found:** the success path finishes, with no refusal, no failure marker, no table F line and no release. **Not found:** recorded as before. **Re-read failed:** `executionOutcome: 'unknown'`, with no line either way and no release. **The meeting failure record is built:** a leg whose re-read confirms no trade gets `executionFailed: true` and the table F V1.3 line. **One success-path gap**, in the rare partial case only: the price and ATR values read from the incoming position (§5.4). |
| What changes at `off`? | **For server meetings, only the new copy key** (§9). Everything else applies only to planted or malformed records, or follows from the founder's decisions: the labels (Q2, Q4), the retry-safe records (Q3), the V1.3 line, and caps on review text. Every existing golden is byte-identical apart from the intended changes, each with its own row (§7 row 6). |
| Is P6 enforce now safe to flip? | **Records: yes, with one STOP item** (§10). A landed trade is never filed as a refusal, and a reservation is never released after one. The meeting's belief is the server's. **Not yet:** the client renders a model-route swap whose outcome is unknown as "held by a guardrail" — a fix needs new player wording, which this prompt forbids (**STOP**, §8 row 4, founder question 3). Also open: two workers on one battle can share a trade (§10). |
| Tests | **The Linux suite of record** (CI-shaped: `--maxWorkers=2`, `TZ=UTC`) at the code head `86855eca`: **19,309 passed, 0 failed** (19,396 rows including 87 skipped; exit 0).<br>**Both flips dry-run green:** `'enforce'` and `'off'`, each with its pin row, 19,309 / 0. The control — the flag moved without its pin — fails exactly the pin row.<br>The new suites fail 131 rows on base. `lint:gate` and `vite build`: **green** on an LF archive of the pushed head (§12.1). |
| Review (BUILD_RULES §2) | Mandatory. **4 lenses** (one of them the attacker), **4 refuting verifiers** and **a mutation lens** (§12). **28 findings: 18 CONFIRMED, 8 PARTIAL, 2 REFUTED.**<br>• **Defects this build caused, all fixed:** a test the change had made vacuous (K2-1); a stricter check after a flip (K2-2); a stale trade id after an unknown leg (K3-4); unpinned behaviour (K4-1 to K4-3).<br>• **Pre-existing:** two fixed (K1-3, K3-3); the size freeze filed separately.<br>• **The verifiers overturned one fix of mine:** the approval deadline (§3.2).<br>• **Mutation:** 222 mutants, 183 killed, 20 equivalent; **19 gaps (test gaps only), all killed by 18 new rows** (§12.3). |
| Things for you | §11: six questions. The first three are the approval window, the noon deadline and the unknown-outcome label. |

---

## 0. Preamble

- **Session open (BUILD_RULES §2/§3).** I ran `git fetch origin main` first: `origin/main` is `c1822e39` ("Merge pull request #942"). The worktree branch `claude/integrity-followup-2-fe4c21` was cut at `c1822e39` with a clean tree. Every commit staged explicit paths, after re-checking the branch in the same command.
- **Commits** (`c1822e39..`):
  - `79b00b42`: Parts A–D, with tests.
  - `952cac62`: Part E, the census record.
  - `6d1cef0b`: §2 lens fixes K1–K4.
  - `5b832f6d`: verifier fixes from KV2 and KV3.
  - `86855eca`: rows that kill the K5 mutation lens's survivors, plus two comment corrections from KV4.
  - this report.
- **Boundaries.** I edited none of the following:
  - a fenced file (BUILD_RULES §1);
  - `firestore.rules` or `test/rules/`;
  - the capture schema or serializer (`api/_utils/tickCapture/captureConfig.js`, `captureSerializer.js`);
  - the cockpit matcher (`api/_utils/callRecords/flip.js`, `heard.js`);
  - any prompt module or tool schema, including `voiceLayerPrompt.js`.

  Other boundaries:
  - `SWAP_IDENTITY_MODE` is still `'shadow'` (`src/config/featureFlags.js:3151`).
  - The proposal paths are neither revived nor removed.
  - The only new player-facing line is table F V1.3.

  **Fenced code called but not edited:** `executeSwapServer` (`api/_utils/agentSwapExecution.js`) at its six existing sites, `buildSwapReceiptSource` (`agentRiskManager.js`) and `getCurrentTradingDayServer` (`agentEvalPromptAssembly.js`). The prompt module `voiceLayerPrompt.js` (`detectTradeProvenance`, `buildReviewContext`) is read and called by tests.
- **Linux runs** used a private WSL clone (`~/pd-fu2`); the shared `~/pd-amendd` was not touched. Neither census script was run against production, and no credentials were loaded.
- **Citations.** `path:line` refers to the code head `86855eca` unless marked *base* (`c1822e39`). Its product code is `5b832f6d`'s; the last code commit adds test rows only. **VERIFIED** means read in this session; **ASSUMED** means not re-read here.

---

## 1. Part A — the meeting copy (M1 plus the deadline)

**The module:** `api/_utils/meetingCopy.js` (new; one product import, the capping helper).
- `serverMeetingCopy` (`:69`): what is stored.
- `meetingCopyOf` (`:81`): the stored copy, if well formed.
- `meetingMatchesCopy` (`:88`).
- `planApprovedLegs` (`:101`): which legs run.
- `heldLegRecord` (`:119`).
- `meetingWaitUntilMs` (`:129`): the wait.
- Constants: `LEG_NOT_PROPOSED`, `LEG_NOT_RUN` (§5.5) and `HELD_LEG_RECORD_MAX = 20`.

**Creation** (`api/cron/agent-evaluate.js:2517`). `scoreUpdate['cronState.gameplanMeeting'] = serverMeetingCopy(gameplanTrigger)` goes into the same `scoreUpdate` that writes `gameplanMeeting`, so the meeting and its copy land together or not at all. The copy is `{meetingId, createdAt, expiresAt, legs: [{symbolOut, symbolIn, swappedInAt?}]}`, all server values. A leg carries `swappedInAt` exactly when the meeting's own leg does: P6 stamps it at mode ≠ off. So a meeting created at off and approved after a flip is checked by symbol only, as before (review K2-2; rows "a meeting created at off and approved after a flip…").

**The check** (`handleGameplanMeeting`, `:6003`). The meeting is read through `meetingOf` (Part B) and the copy through `meetingCopyOf`.

| The battle's meeting | What runs | Does the model wait? | What is recorded |
|---|---|---|---|
| Approved; its id matches the copy | Each leg whose pair strictly equals a stored leg not yet used (`planApprovedLegs`), with the copy's symbols (`run.symbolOut` / `run.symbolIn`) and P6's belief from the copy's `swappedInAt` (`expectedOutOfStored(run.symbolOut, run, 'swappedInAt')`) | — | The history row; any other leg is held: `heldLegs` (at most 20, capped symbols and the reason) and `heldLegCount` (the total). No beat for a held leg |
| Approved; forged id, or no copy | Nothing | — | Every leg held, `leg_not_proposed`; no beat |
| Pending; its id matches | — | Until the **copy's** `expiresAt` (`:6369`) | At the deadline: the expiry beat, as today |
| Pending; no match | — | **Never** (returns `'continue'`, with a warning log) | Filed as expired once its own string deadline passes; no beat |
| Rejected | — | — | The rejection beat only when it matches the copy (review K1-3) |
| Gone while a copy is stored (null, not an object, renamed) | — | — | The copy is **retired** in one write (`:6011-6016`; review K1-1 / K3-1), so re-planting the meeting later cannot bring the server's legs back at a time the player picks |

Every resolution clears the copy with the meeting (`resolutionWrite`, `:6021-6025`). The creation gate (`:2466`) reads the meeting through `meetingOf`.

**Not carried by the copy:** the leg's `rationale`. A matched leg's rationale still rides from the meeting as a capped string (`clientText`, integrity F2). The attacker lens noted it (K1-2); it is founder question 4.

**Rows:**
- `api/cron/agent-evaluate.meetingCopy.test.js` (54 rows): the copy written with the meeting; which legs run (planted, extra, duplicate, swapped pair, forged id, no copy, 5,000 legs); the belief from the copy; the deadline; the +497 probe; retirement; no beats for meetings the copy does not name; the cross-flip; no deadline on approval.
- `agent-evaluate.meetingCopy.baseline.test.js` (15 rows): the base differential (§7).

---

## 2. Part B — no player-writable value can make a server job throw

**The readers:** `api/_utils/playerFieldReaders.js` (new). Each type-checks its field and treats a malformed value as absent or default.

| Reader | Field | Malformed → | Call sites |
|---|---|---|---|
| `presetKeyOf` (`:37`) | `strategyPreset` | anything not an **own** key of `PRESET_CONFIGS` → `'balanced'` (so `'constructor'`, `'__proto__'`, `'toString'`, `'hasOwnProperty'`, `'valueOf'` all resolve to balanced) | `agent-evaluate.js:1043` |
| `meetingOf` (`:42`) | `gameplanMeeting` | not a plain object → none | `agent-evaluate.js:2466`, `:6004` |
| `meetingLegsOf` (`:53`) | `suggestedSwaps` | not an array → none; non-object legs skipped (indices kept) | `agent-evaluate.js:6044` |
| `historyListOf` (`:63`) | `gameplanMeetingHistory` | not an array → the append starts a fresh list | `agent-evaluate.js:6023` |
| `battleLedgerOf` (`:74`) | `battleLedger` | not an array → `[]`; non-object entries dropped | `battlePatternLogger.js:108,125,136`, `agent-batch-review.js:215` |
| `dailyGradesOf` (`:108`) | `dailyGrades` | a map as is; a list → its object entries (last 50, strings ≤ 1000, nested objects dropped); else the caller's fallback | `api/agent/chat.js:732`, `agent-batch-review.js:398` |
| `dailyGradeEntryOf` / `gradedTradesOf` (`:120`, `:127`) | one day's grades | own key only; a non-list → `[]` | `agent-batch-review.js:227-228` |

**Text that could throw.** A player can write an object whose `toString` is not a function, and a template or `String()` call on it throws. These sites now cap or guard that value:
- the meeting's own deadline is parsed only when it is a string (`:6372`);
- the launch-guard warning log (`:3511`);
- batch review's `promptText`, which wraps `String()` in try/catch and caps at 1000; `isToday` is typed;
- the pattern logger, which parses a timestamp only when it is a string, caps the preset and every change value, and keeps the last 50 changes (`battlePatternLogger.js:104-118`). A planted ledger entry without a timestamp no longer makes the Admin SDK reject the whole record (K1-4).

**Rows:**
- `agent-evaluate.playerFieldShapes.test.js` (100 rows): every owner-writable field × every shape, at off / shadow / enforce. Each check completes and saves its score. Of the first commit's 99, 26 crash on base; the other 73 are regression guards for fields the tick reads only to migrate (review K4-4).
- `agent-batch-review.playerFields.test.js` (33 rows; 14 of the first commit's 29 crash on base).
- `api/agent/chat.test.js` "follow-up 2" (2 rows).
- `api/_utils/playerFieldReaders.test.js` (12 rows, including the real `buildReviewContext` on a `[null]` list, which throws without the reader).

**Out of scope (the prompt):** filling a document toward its size limit. The attacker lens showed that padding any owner-writable field (e.g. `feedBookmarks`) to within a few hundred bytes of 1 MiB makes the score write fail every check (K1-5). It belongs to the rules overhaul and is filed as a separate task. It is not this build's regression.

---

## 3. The meeting-wait finding (from the code — no production read), and why approvals have no deadline

### 3.1 How long a server-created meeting makes the agent wait

The detector builds the deadline in three steps (`agent-evaluate.js:6520-6524`, VERIFIED): `new Date(nowET)` → `setHours(16, 0, 0, 0)` → `toISOString()`.
- `nowET` is the Eastern wall-clock *string*. `new Date(...)` reads it back in the **server's** zone, and `setHours(16)` sets 16:00 in that zone.
- No code or config sets a zone for the functions (VERIFIED): nothing under `api/` assigns `process.env.TZ`, and `vercel.json` sets none.
- So on Vercel's default UTC (ASSUMED), the deadline is **16:00 UTC on the ET date: 12:00 noon EDT (11:00 EST)**. The comment says 4:00 PM ET.

The cron runs every 15 minutes, 13:00–21:45 UTC on weekdays (`vercel.json`, the `/api/cron/agent-evaluate` entry, VERIFIED).

| Meeting created at | What the agent does | For how long |
|---|---|---|
| Before noon EDT (before 11:00 EST from 1 Nov) | Every check returns early through `skip_haiku` (`:2434`, `:6396`): no model call, no evaluation entry. The risk loop still runs first, and the R11 suppression pass runs the deterministic stops and the profit target (`:2430-2437`) | Until noon EDT: at most about **2 h 30 min (10 checks)** from the 9:30 open; 1 h 30 min under EST |
| At or after noon EDT | The deadline has already passed when the meeting is written. The **next** check expires it ("Gameplan meeting expired. Continuing with current strategy.", `:6380`) and runs the model | Only the creation check skips the model (it always does: "gameplan IS the evaluation", `:2519`). One check, 15 minutes |

Other facts from the code:
- At most one meeting is created per ET day (`cronState.lastGameplanDate`, `:2518`, `:6410`).
- The trigger is three straight losing trades, or one sector carrying more than 60 % of the negative P&L (`:6407-6460`).
- After this build the wait is set by the copy's `expiresAt`, which is the same server value. A server meeting waits exactly as long as before (the differential, §7), and nothing a player writes lengthens or shortens it.

**What the player sees while no live screen can answer.** No live surface mounts the approve / reject card. `GameplanMeetingCard` renders only from `AgentActivityFeed` when it is passed a `gameplanMeeting` prop, and neither live mount passes one (integrity build §1 row 3, VERIFIED there; here I re-read only `src/components/Agent/AgentActivityFeed.jsx:758-760`). What the player can see, from the code:
- **The creation beat:** "Gameplan Meeting: ⟨diagnosis⟩ Proposing rotation to ⟨sectors⟩." (`:2507`).
  - In the activity feeds it is labelled "Gameplan" / "PLAN" (`AgentActivityFeed.jsx:126-127`, `LiveActivityPanel.jsx:50`, VERIFIED).
  - For up to an hour it also shows as a breakthrough alert on the Dashboard desk (`src/adapters/baggerbombAdapter.js:280-300`, `AgentDesk.jsx:168-170`; VERIFIED as code, rendering ASSUMED).
- **Each waiting check:** nothing from the meeting. Those checks write no evaluation entry, so the decision surfaces keep showing the last one (ASSUMED from the early return that writes no entry). Only deterministic exits can trade.
- **At the deadline:** "Gameplan meeting expired. Continuing with current strategy." (`:6380`).

The redesign decides whether to bring the card back or stop creating meetings. If meetings stay, the deadline arithmetic is worth fixing on its own: it is a noon deadline, not a close-of-day one (founder question 2).

### 3.2 Why an approval has no deadline (review K1-1 → KV1 → KV3)

The attacker lens found that a copy could outlive its meeting: delete or rename the meeting, then re-plant it as approved days later, and the server's legs ran at a time the player chose (K1-1, K2-3, K3-1). Two fixes were proposed:
- **(a) Retire the copy once the battle's meeting no longer names it.** Built (§1).
- **(b) Run approved legs only before the copy's deadline plus one check.** Verifier KV1 recommended it. I built it, then **removed it** on verifier KV3's evidence.

The reason for removing (b) is the noon deadline in §3.1: any meeting created after noon ET is **born past its deadline**. On base and here, a player who approves before the next check gets the trade. So does an approval made after the day's last check and reached by the next morning's check. A deadline on approval would hold both, and both are the founder's "approved server meeting runs byte-identical to today". The row "no deadline on approval … (review KV3)" pins today's window. A reintroduced deadline fails it: mutant run, 1 row fails.

**With (a) alone, the approval window is exactly base's:** up to the first check that sees the pending meeting past its deadline. The remaining lever is a player who keeps checks from running altogether, so that an approval lands later. The only such lever found is the document-size freeze, which is out of scope (§2). Founder question 1 has the options.

---

## 4. Part C — honest labels

### 4.1 Q2 — the launch-guard row, and every reader of `resolution`

**The change.** The launch-guard branch (`handlePendingProposal`, `agent-evaluate.js:4952`) now writes `resolution: 'launch_guard_cleared'`, and keeps `systemNote: 'launch_guard_clear'` and `resolvedBy: 'system'`. Its log reads "Clearing it without execution." Existing rows keep `'auto_executed'`.

**The readers of a proposal row's `resolution`** (VERIFIED, every match under `src/`, `api/` and `scripts/`):

| Reader | Reads | After this build |
|---|---|---|
| `api/_utils/voiceLayerPrompt.js:1835` `detectTradeProvenance` (prompt module, not edited) | `'approved'`, `'auto_executed'` | A new clear no longer matches, so **no relabel**. Proved by `agent-evaluate.labels.test.js` "Q2" (it calls the real function on the cron's own row) |
| `scripts/census-planted-proposals.mjs:103-114` | executed rows; launch-guard clears | Accepts **both** values (`LAUNCH_GUARD_RESOLUTIONS`); a row claiming a clear is examined like an executed one |
| `scripts/census-swap-identity.mjs:131` | the belief join | Excludes both forms of the clear |
| `api/cron/agent-evaluate.js:4983-4984`, `:5226` | the player's `'approved'` / `'vetoed'` | Unchanged; the launch guard runs first |
| `api/cron/agent-batch-review.js:213`, `voiceLayerPrompt.js:1678` | `'vetoed'` | Unaffected |
| `src/components/Agent/AgentChat.jsx:36` | `'lapsed'` | Unaffected |

No client history view counts clears.

### 4.2 Q4 — the governing mode, and every reader of `entryMode`

**The changes:**
- **Trade rows.** All six executor calls stamp `entryMode: LAUNCH_EXECUTION_MODE` (`agent-evaluate.js:2004`, `:3614`, `:5059`, `:5330`, `:5725`, `:6139`).
- **The migration** (`:971`) no longer writes `'copilot'` for a missing `executionMode`. It writes nothing.
- **The metadata allowlist.** `proposalDescriptiveMetadata` no longer re-reads the stored proposal's `entryMode` (`api/_utils/executorMetadata.js:143`).
- **`battlePatternLogger.extractExecutionMode`** returns `{start: LAUNCH_EXECUTION_MODE, changes: []}` (`battlePatternLogger.js:95-101`).
- **The dormant proposal-creation path** (`:3992`) also stamps the governing mode: its `mode` is `LAUNCH_EXECUTION_MODE` (`:4035`).

**Every reader of `entryMode`** (VERIFIED, every match under `src/`, `api/` and `scripts/`, tests excluded):

| Reader | What it does with it |
|---|---|
| `scripts/census-swap-identity.mjs:116` | The caller fallback: a row whose belief cannot be joined is filed as a proposal trade when `entryMode` is `'copilot'`. New rows carry `'autopilot'`, so a migrated battle's aged-out model trades are no longer misfiled (row "the caller fallback reads the stamped mode") |
| `scripts/census-planted-proposals.mjs:151` | Displays it in the report's trade listing |
| `api/_utils/executorMetadata.js:36` | The allowlist entry: the key a trade row may carry |

**Receipts, Film Room and the client** read no `entryMode`: no match under `src/`. The L1 receipt (`captureSwapReceipt`) is not passed it. The trade-narration and review prompts read other trade fields.

**Rows:**
- `agent-evaluate.labels.test.js` (9 rows).
- The guard's behavioural half (`agent-evaluate.executorMetadata.guard.test.js`), which plants a **string** mode (`` `${SYM}_MODE` ``), so a revert at any caller fails it (review K4-1).
- `api/_utils/executionAuthority.test.js`, which counts the six stamps statically.
- The census tests.

---

## 5. Part D — retry-safe records

### 5.1 The mechanism

`api/_utils/landedTrade.js` (new; zero product imports):
- **`executorCallOf` (`:54`)** takes the call's identity immediately before the call: `evaluationId`, `tier`, `slotIndex`, the incoming `symbolIn`, and `startedAtMs`.
- **The six callers wrap the executor call itself** in their own try. Each catch calls `swapResultAfterThrow` (`:106`), which re-reads the battle:
  - **Landed:** a trade row matches all of the call's `evaluationId`, `tier`, `slotIndex` and `symbolIn`, with `swappedOutAt ≥ startedAtMs` (`isRowOfCall`, `:59`). The executor's result is rebuilt from that row and from the incoming position in the slot, and the caller's success path runs. When the slot no longer holds that position, the result is marked partial (§5.4).
  - **Not found:** the original error is rethrown, tagged `'not_landed'`, and the caller records as before.
  - **The read fails:** the original error is rethrown, tagged `'unknown'`, and the caller records `executionOutcome: 'unknown'`. It writes no line that claims either way, and no release.

The flag the prompt asks for ("a flag around the call, as `passExecutorInFlight` does") is the try around the executor call itself. A throw from anything else — a reserve, a post-commit refresh — never reaches the read-back.

### 5.2 The six callers

| # | Caller | Call | On "unknown" | When the re-read finds the row |
|---|---|---|---|---|
| C1 | Risk loop | `:2059`, catch `:2074` | The beat has `message: null` and the marker; no release. The tick stops discretionary trading (`refreshFailure` + break, `:2314`): a stale book could re-pick the same stock and release its reservation | Success path, F1 price, confirm |
| C2 | Model route | `:3701`, catch `:3713` | The entry keeps HOLD + downgraded with `executionOutcome: 'unknown'`. There is **no "Swap execution failed" line** and no release (`:3887-3928`) | SWAP entry, narration, receipt; `executionLanded` only when partial (`:4333`) |
| C3 | Approved proposal (dormant) | `:5041`, catch `:5073` | The history row carries `executionOutcome: 'unknown'`; no failure line, no release | Success row (`executionLanded` when partial) |
| C4 | Expired co-pilot proposal (dormant) | `:5315`, catch `:5344` | `resolution: 'auto_execution_unknown'` (`:5477`); no failure line, no release | `'auto_executed'` |
| C5 | R11 suppression pass | `:5772`, catch `:5784` | The beat has `message: null` and the marker; no release | The success beat stands. `passLanded` (`:5563`, `:5787`) also suppresses the "Guardrail exit failed" beat and the release when only the post-commit refresh threw (review K3-3, a base defect) |
| C6 | Approved meeting leg | `:6130`, catch `:6158` | The leg carries `executionOutcome: 'unknown'` with no line. The book is re-read before the next leg (§5.5) | The leg's success beat; `executionLanded` on the leg when partial |

**A real refusal** (nothing committed) records exactly as before at every caller, with P6's table F line at enforce. **Rows:** `agent-evaluate.retrySafe.test.js` (72 rows) uses an executor double that follows the Admin SDK's rule — attempt 1 commits, the reply is lost, attempt 2 re-reads and throws. It runs for each caller and the meeting leg at off, shadow and enforce, plus a real refusal, a failed re-read (`failReadAfterThrow`), a partial result, and a static check that each call sits in its own try. Unit rows: `api/_utils/landedTrade.test.js` (25 rows; review K4-3).

### 5.3 Is `evaluationId` unique per call? (the prompt: "where it isn't, add the pair and a time bound, and report it")

| Site | `evaluationId` | Unique per call? | Identity used |
|---|---|---|---|
| C1 | `risk_${reason}_${symbol}_${Date.now()}` (`:1998`) | Yes, except for two calls in the same millisecond | id + slot + incoming + time bound |
| C2 | `eval_${evalSeq}` (`:3159`) | Per check, yes. **No** when two workers run one battle on one snapshot (a stolen 120 s lock): both mint the same id | id + slot + incoming + time bound |
| C3 / C4 | `serverProposalEvaluationId` — the deciding entry's id, or `null` (`executorMetadata.js:93`) | **No**: shared by repeated runs of one proposal, or `null` | id + slot + incoming + **time bound** |
| C5 | `${exitReason}_${symbolOut}_${Date.now()}` (`:5719`) | As C1 | as C1 |
| C6 | `gameplan_${out}_${in}_${Date.now()}` (`:6114`) | As C1 | as C1 |

The pair and the time bound are therefore applied at **every** site, not only where the id is shared. The time bound is `swappedOutAt ≥` the call's start; the executor stamps `swappedOutAt` from its own clock. **Residual (reviews K3-2, K4-2, KV4):**
- **The overlap:** when a second worker's call starts no later than the first worker's commit, nothing on the row tells the two calls apart, so the second worker adopts the landed trade as its own. It files a success with no failure marker and no release, and there is still one trade.
- **Reachability:** this needs a duplicate or manual invocation while a check is more than 2 minutes into one battle.
- **Base did worse:** it filed "failed" and released the reservation of a stock the battle held.
- **Pinned** by the A9 "overlap" rows (`agent-evaluate.swapIdentity.test.js`).
- **A *sequential* stale replay** — the call starts after the first commit — is still filed as a failure over the landed trade, exactly as on base (KV4). The time bound deliberately leaves that call outside "this call's trade". Founder question 5.

A wall-clock step backwards between the two clock readings would miss a landed trade. The result falls back to the pre-build record, never worse. A tolerance would add false adoption (KV3 probe), so none is applied (K3-6).

### 5.4 Success-path gaps (the partial case)

When the row is found but the slot no longer holds the incoming position — another writer moved it between the commit and the read — the result carries `incomingAsset: null`. The success record then carries `executionLanded: 'confirmed_after_error'`. **The records that lose a value in that case:**
- the capture action's `entryPrice`;
- the L1 receipt's `entryMark`, `entryATR` and its ATR source;
- at C1, the F1 entry price for the rest of the tick (`forcedEntryPrices`, `:2270`), so the tick carries the fetched quote forward, as before F1.

Every other success-path record is built from the row and is complete: the trade, the score, the confirm, the narration, the beats and the history. **No gap exists when the slot still holds the position**, which is the normal ambiguous commit.

### 5.5 The meeting failure record (table F V1.3) and a leg whose outcome is unknown

**A leg whose re-read confirms no trade** gets `executionFailed: true` on its history-row leg. It also gets a hold beat with the table F V1.3 line: "The swap of [SYM] for [SYM2] you approved did not go through. No trade was made." (`api/_utils/swapIdentity.js` `MEETING_LEG_FAILED_LINE`; `agent-evaluate.js:6317`; the copy's symbols; every mode). The line is never written beside a P6 refusal of the same leg: a P6-refused leg keeps P6's own table F line, and its leg carries `refusalReason` (review K3-8). Never when the read finds the trade or fails. The spec gains the V1.3 row and a dated note (`docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md`). The spec-versus-constants byte test and the §E sweep cover it (`api/_utils/swapIdentity.test.js`).

**A leg whose outcome is unknown** (review K3-4, then KV3):
- The leg is marked, and the book is re-read through the chokepoint (`refreshBattleFromDoc`) before the next leg. The next leg then mints its trade id and resolves its slot from the book as it stands. (Before the fix, two rows could share `trade_001`.)
- When that read fails too, no later leg runs. Each later stored leg is marked `executionOutcome: 'not_run'` (`LEG_NOT_RUN`), and held legs are still recorded. Stopping outright, my first fix, dropped the approved legs after it with no record.
- Rows: the two "C6 (review K3-4 / KV3)" rows in `agent-evaluate.retrySafe.test.js`. Mutants — break, no refresh, no marking — are each caught.

**Census.** `scripts/census-swap-identity.mjs` §3b counts each new marker per channel (`executionOutcome: 'unknown'`, `executionLanded`, `auto_execution_unknown`, a meeting leg's `executionFailed` and `not_run`, and held legs), so the shadow period can measure executor throws before the enforce flip (review K3-9).

---

## 6. Part E — the census record

`docs/audits/20261008_PLANTED_PROPOSAL_CENSUS.md` is copied byte-identical from the founder's main checkout (SHA-256 `4fc71cf8…`, compared before and after the copy). Its verdict was nothing found, exit 0. `planted-census.json` is not copied.

---

## 7. Acceptance results

| # | Row (the prompt) | Result | Proof |
|---|---|---|---|
| 1 | Meetings: a server meeting approved runs as today; planted / extra / duplicate legs, a forged id and no copy are held and recorded; the belief from the copy; the wait ends at the server's deadline; a planted far deadline does not wait; the +497 probe fails | **Met** | `agent-evaluate.meetingCopy.baseline.test.js` (15 rows): 11 scenarios run through the real cron at base and at head. Each is byte-identical once the copy key is lifted, and so is Part D's `executionFailed` on the one P6-refused leg at enforce (companion rows pin both lifts exactly). The fixture is captured on an LF archive of `c1822e39`; reviewers K2 and KV2 re-captured it SHA-identical. `agent-evaluate.meetingCopy.test.js` (54 rows), including "the integrity build's +497 eviction probe … now fails". |
| 2 | Score freeze: each malformed shape in each field lets the check complete and save the score; batch review and chat tolerate; well-formed byte-identical | **Met** (the size limit stays out of scope) | §2: `playerFieldShapes` 100 rows (26 of the first 99 crash on base), batch review 33 (14 of the first 29), chat 2, readers 12. Well-formed: the existing goldens (row 6), plus the review's own rows; the new review caps are listed in §9 |
| 3 | Labels: new value written; readers accept both; no provenance relabel; the governing mode on rows; the migration writes nothing | **Met** | `agent-evaluate.labels.test.js` (9), the census tests, the guard's behavioural half (string mode), `executionAuthority.test.js` |
| 4 | Retry: the SDK-rule double at each of the six callers and the meeting leg, at off / shadow / enforce. No refusal or failure record, no "No trade was made", no release; the landed trade recorded. A real refusal records as today; a failed re-read gives the marker | **Met** | `agent-evaluate.retrySafe.test.js` (72 rows), `landedTrade.test.js` (25) |
| 5 | The V1.3 line only when the re-read confirms no trade; the spec-versus-constants byte test and the §E sweep | **Met** | `retrySafe` "table F V1.3" (5 rows), `swapIdentity.test.js` (spec parse, byte comparison, §E sweep) |
| 6 | Off: every existing golden byte-identical except the intended changes, each with its own row; flips green at shadow and enforce; the control fails only the pin row | **Met** | Unchanged and green: the executor off golden, `tickStamps.flagOff`, `tickCoherence`, `guardrailErrorFailClosed`. The call-records off golden and the tick-capture rows: their only changes are the lifts for the copy key, the pending meeting given a copy, and the label, and each has its own row (`agent-evaluate.callRecords.offGolden.test.js` "INTENDED_CHANGES" plus companions). Flips (§12.1): as committed (`'shadow'`), at `'enforce'` and at `'off'`, each 19,309 / 0 on Linux. The control fails exactly the pin row |
| 7 | Full suite, `lint:gate`, `vite build` | **Met** | §12.1: the Linux suite of record is 19,309 passed, 0 failed |

**Base proof.** The new suites, run against the base cron (with the head's harness and the new modules copied in), fail 131 rows at the first code commit: meetingCopy 36, retrySafe 48, playerFieldShapes 26, batch review 14, labels 7.

---

## 8. Where the build departs from, or reads, the prompt

| # | The prompt said | The build does | Why |
|---|---|---|---|
| 1 | Q1 "plus the deadline" | The deadline governs the **wait** only. An approval of the server's own meeting runs whenever the cron reaches it, as today | §3.2: most meetings are born past their noon deadline, so a deadline on approval would break "runs byte-identical to today" |
| 2 | The copy holds `legs: [{symbolOut, symbolIn, swappedInAt}]` | `swappedInAt` is stored exactly when the meeting's own leg has it, which is at mode ≠ off | Otherwise a meeting created at off and approved after a flip would be checked by entry instead of by symbol: a stricter check than today's (review K2-2) |
| 3 | Held legs are recorded on the history row | At most 20 recorded, with `heldLegCount` the total | A planted meeting can carry thousands of legs; one record each would grow the document toward its limit (the very freeze Part B closes) |
| 4 | Part D, unknown: "no line that claims either way" | The cron writes none. **But the client** renders a C2 entry whose outcome is unknown (HOLD + downgraded, without the "Swap execution failed" prefix) as **"Argued for a swap · held by a guardrail"** (`src/screens/battleView/selectWhyState.js:194-199`, `src/data/decisionRecord.js:88`). A guardrail-forced C2 swap renders "A guardrail called for a swap · it did not go through" (`:173-183`). Neither is true of an unknown outcome. **STOPPED on this item** | A correct label is new player-facing wording, which this prompt forbids. Founder question 3 |
| 5 | Part D, found and clean: "finish the caller's success path" | The success path also runs at C5 when only the post-commit refresh threw (`passLanded`) | The build's own rule — never a failure for a trade that landed. A base defect, found by review K3-3 |
| 6 | (unstated) A leg whose outcome is unknown | The book is re-read and the meeting goes on; when that read fails, later stored legs are marked `not_run` | §5.5 |
| 7 | Part B: "well-formed values behave byte-identically" | Byte-identical within new caps: review prompt lines ≤ 50 debates and ≤ 50 graded trades, grade text ≤ 1000. The review's "Debates: N" header still counts all of them | A heavy real user can exceed 50 debates in a day (review K2-4). Changing the header is a prompt change; noted |

---

## 9. What changes at `off`

| # | Change | Before (base) | After | Rows |
|---|---|---|---|---|
| 1 | **The copy** (`cronState.gameplanMeeting`), server meetings only | — | Written in the meeting's creation update, and cleared with every resolution | baseline differential (the lifted key), `meetingCopy` "the copy is written…" |
| 2 | **Planted / copy-less meetings** | An approved meeting executed any legs it named. A pending one muted the model until its own deadline. Rejected or expired ones wrote a beat | Legs are held and recorded, no trade. Never a wait. No beat | `meetingCopy` (54) |
| 3 | **A meeting the player removes or renames** | Its legs could be re-planted later | The copy is retired in one write | `meetingCopy` "retired" rows |
| 4 | **Labels** | Launch-guard rows: `'auto_executed'`. `entryMode`: the battle's own mode, capped (a migrated `'copilot'` battle stamped `'copilot'`). The migration wrote `'copilot'`. The pattern logger logged the battle's own mode and the ledger's mode changes | `'launch_guard_cleared'`; `entryMode: 'autopilot'` (the governing mode) on every row; the migration writes nothing; the logger logs the governing mode | `labels` (9) |
| 5 | **After an executor throw** | Every throw filed a failure (or, at mode ≠ off, a refusal) and released the reservation | Landed → the success path; unknown → the marker; not landed → as before. A meeting leg that did not land gets `executionFailed` and the V1.3 line (before: nothing) | `retrySafe` (72) |
| 6 | **Malformed owner-written values** | 40 shapes crashed the check (or the review) | Read as absent or default; review lines and grade text capped | §2 |
| 7 | **History rows** | — | May carry `heldLegs`, `heldLegCount`, and per-leg `executionFailed` / `executionOutcome` / `executionLanded` / `refusalReason` (`HISTORY_OUTCOME_KEYS`, `api/_utils/historyRows.js`) | `historyRows.test.js` |

Everything else at `off` is byte-identical (§7 row 6).

---

## 10. The P6 enforce flip — what is now safe, and what still isn't

**Now safe:**
- **No refusal over a landed trade.** At all six callers and on meeting legs, an executor throw after a commit — the SDK's retry re-reads the committed slot and P6 refuses it — is read back. The trade is filed as the success it was: no table F refusal line, no "No trade was made.", no reservation release. Acceptance 4 covers this at enforce.
- **Real refusals still record exactly as before**, with their table F line.
- **A failed read-back is marked, not guessed.**
- **The meeting's belief is the server's.** The integrity build's caveat that "the P6 shadow read's meeting rows are player-influenceable" (its §10 Q6) is closed.
- **The pre-enforce census counts every new marker** (§5.5), so the shadow period shows how often executor throws happen.

**Not yet:**
1. **The client label for an unknown outcome on the model route** (§8 row 4, STOP): "held by a guardrail" or "it did not go through". The cron's record is neutral; the client's words are not.
2. **Two workers on one battle** (§5.3): the overlap adopts the landed trade, which is better than base but still files two successes for one trade. A sequential stale replay still files a failure over the landed trade, as on base.
3. **`battle_not_active` does not stop the tick.** A refusal for an ended battle is recorded per call; the check goes on to the next stage (unchanged here).
4. **The rules overhaul** (`firestore.rules`, the integrity build's §4): every owner-writable field above is still writable. This build makes the server ignore or tolerate the values; it does not stop the writes.
5. **The size freeze** (§2): padding the document still blocks the score write.

---

## 11. Founder questions

1. **The approval window (§3.2).** Today and after this build, an approval of the server's own meeting runs whenever the cron reaches it. Copy retirement removes the delete / rename deferral; what remains needs a way to keep checks from running (the size freeze). Options:
   - **(a)** Leave it as is. Recommended until question 2 is settled.
   - **(b)** Once the deadline is a real close-of-day time, bound approvals by it plus one check, with an overnight rule.
2. **The noon deadline (§3.1).** `setHours(16)` runs in the server's zone, so meetings expire at noon ET and most are born expired. Should it be a true 4:00 PM ET deadline? That would lengthen the model's silence by up to about 4 h per meeting, unless the redesign stops creating meetings.
3. **The unknown-outcome label (§8 row 4, STOP).** Choose one:
   - **(a)** New wording, for example "Argued for a swap · its outcome could not be confirmed", plus a guardrail-forced variant. It is one client state keyed on `executionOutcome === 'unknown'`.
   - **(b)** Restore base's "it did not go through". It is wrong only when the trade landed.
   - **(c)** Leave it.
4. **The meeting leg's rationale and the preset label (review K1-2).** A matched leg's `rationale` still rides from the meeting (capped, F2), and `entryPreset` stamps the owner's capped preset string even when `balanced` governs. Options:
   - store the rationale in the copy and pass the copy's;
   - stamp `presetKeyOf(...)` (a Q4-style change to off rows).
5. **Two workers on one battle (§5.3).** Adopting a concurrent worker's trade is better than base's false failure, but it still files two successes. A per-call nonce on the row would separate the calls; it needs an allowlist key and golden updates. The sequential stale replay's false failure is base behaviour; it is named here because enforce will meet it too.
6. **A leg after an unreadable one (§5.5).** When both reads fail, later legs are marked `not_run` and the meeting is cleared. The alternative is to leave the meeting in place, so that the next check resumes it. The legs are naturally idempotent: a leg already swapped in finds no bench asset.

---

## 12. Test runs and the BUILD_RULES §2 review

### 12.1 Test runs

| Run | Where | Result |
|---|---|---|
| **Full suite, CI-shaped** (`--maxWorkers=2`, `TZ=UTC`), as committed (`SWAP_IDENTITY_MODE = 'shadow'`) — **the suite of record** | WSL Ubuntu (private clone `~/pd-fu2`), code head `86855eca` | **19,309 passed, 0 failed** (19,396 rows including 87 skipped; 253 s; exit 0) |
| **Flip dry run → `'enforce'`**: the flag line plus its pin row | same, `86855eca` | **19,309 passed, 0 failed** (249 s) |
| **Flip dry run → `'off'`**: the flag line plus its pin row (main may hold either value) | same, `86855eca` | **19,309 passed, 0 failed** (249 s) |
| **Control**: the flag moved to `'enforce'` **without** its pin | same | The module exports `'enforce'`, and **exactly the pin row fails** (1 of 17), so the dry runs ran the flipped flag |
| Earlier head | `952cac62`, as committed | 19,249 passed, 0 failed (87 skipped) |
| The build's 23 test files | Windows, `86855eca` | 959 / 959 |
| Mutation re-check | Windows, fresh LF tree of `86855eca` | 23 of 23 gap mutants killed in place (§12.3) |
| `npm run lint:gate` | LF archive of the pushed head | **green** (exit 0) |
| `vite build` | LF archive of the pushed head | **green** (exit 0); the pushed commit is the commit that was built |
| Emulator rules suite | — | **Not run:** `firestore.rules` and `test/rules/` are untouched |
| Windows note | CRLF worktree, targeted suites | The platform-only rows known on `main` here (`evalRun` "exactly ONE block", `tickStamps.pins` anti-vacuous, `tickCoherence` T1, `shadowCpuQuoteIntegrityFlags`, the film-tape e2e parse). None is this build's, and all pass on Linux |

### 12.2 The review

**The review was mandatory** (40 files). It was run as a multi-lens adversarial review with subagents, each on **its own** LF `git archive` snapshot tree under the session scratchpad, with `node_modules` linked by junction. Every reviewer was read-only on git and on every other tree.
- **4 lenses at `952cac62`:**
  - **K1, the attacker:** make a planted value execute a trade, make the agent wait, crash a check, or falsify a record.
  - **K2:** the off guarantee, boundaries and flips, with its own base-versus-head runs.
  - **K3:** domain correctness: meeting semantics, Part D, the labels.
  - **K4:** test integrity, scripts and docs, with its own mutation runner.
- **4 refuting verifiers (KV1–KV4)**, one per lens, each on a fresh tree with its own base tree, told to refute every finding with a probe.
- **A mutation lens (K5)**, run last on its own tree of the fix head (§12.3).

Ids are this build's own (K·, KV·), distinct from the integrity build's I· and P6's S·.

**28 findings: 18 CONFIRMED, 8 PARTIAL, 2 REFUTED.**

| Id | Sev. | Finding | Verifier | Disposition |
|---|---|---|---|---|
| K1-1 (= K2-3, K3-1) | medium | The copy outlived a deleted or renamed meeting; re-planting it as approved ran the server's legs days later | PARTIAL (not a regression: base allowed any legs) | **Fixed:** the copy is retired once the meeting no longer names it (`6d1cef0b`). A deadline on approval (KV1's proposal) was built, then **removed** on KV3's evidence (§3.2, `5b832f6d`) |
| K1-2 | low | A matched leg's rationale and the preset label are still owner strings (capped) | REFUTED as this build's defect | Founder question 4 |
| K1-3 | low | Copy-less meetings still wrote rejection / expiry beats | PARTIAL (pre-existing) | **Fixed:** no beat unless the copy names the meeting |
| K1-4 | low | A planted ledger entry with no timestamp lost the whole pattern record | CONFIRMED, pre-existing | **Fixed:** string-only timestamp, capped values, the last 50 changes |
| K1-5 | high, pre-existing | Padding the document blocks the score write | CONFIRMED, out of scope | Separate task (§13) |
| K2-1 | medium | astraFindings E1(a) had become vacuous: its copy-less meeting no longer waits | CONFIRMED | **Fixed:** the fixture has an id and a copy; the guard mutant fails it again |
| K2-2 (≈ K3-5) | low | The copy stored `swappedInAt` at every mode, so an off-created meeting was checked more strictly after a flip | CONFIRMED | **Fixed:** the copy mirrors the leg |
| K2-4 | nit | Review lines and grade text capped; the "Debates: N" header still counts all | CONFIRMED | Accepted, noted (§8 row 7) |
| K2-5 | nit | The baseline header named one lift; there are two | CONFIRMED | **Fixed** |
| K2-6 | nit | Shadow-log labels still read the battle's mode | PARTIAL (not this build's) | Carried forward (§13) |
| K3-2 | low | C2 can adopt a concurrent worker's trade | PARTIAL (nit; better than base's record) | Documented (§5.3); pinned with K4-2 |
| K3-3 | low, pre-existing | C5 wrote "Guardrail exit failed" beside a landed trade when the post-commit refresh threw | CONFIRMED | **Fixed** (`passLanded`) |
| K3-4 | low | After an unknown leg, the next leg reused the stale trade id | CONFIRMED | **Fixed:** first by stopping (`6d1cef0b`); then, on KV3's evidence that stopping dropped legs unrecorded, by re-reading and continuing, with `not_run` when the read fails (`5b832f6d`) |
| K3-6 | nit | A backward clock step misses a landed trade | PARTIAL (the proposed tolerance adds false adoption) | Declined; documented (§5.3) |
| K3-7 | nit | C2 unknown records HOLD | REFUTED (the safer record) | Kept |
| K3-8 | nit | A P6-refused leg's `executionFailed` needed a join to tell it from V1.3 | PARTIAL | **Fixed:** the leg carries `refusalReason` |
| K3-9 | nit | The pre-enforce census ignored the new markers | CONFIRMED | **Fixed** (§3b; `not_run` added at `5b832f6d`) |
| K4-1 | medium | Reverting `entryMode` at C1 / C5 / C6 passed the behavioural rows | PARTIAL (low; the static pin catches it) | **Fixed:** the guard plants a string mode; header corrected |
| K4-2 | medium | A9's +60 s hid the truly overlapping replay | PARTIAL (low; wider: C2 too) | **Fixed:** overlap rows at enforce and off; comment corrected |
| K4-3 | low | No test imported `landedTrade.js` | CONFIRMED | **Fixed:** `landedTrade.test.js` (25 rows) |
| K4-4 | nit | `playerFieldShapes` overclaimed defect rows | CONFIRMED | **Fixed:** labelled as regression guards |
| K4-5 | nit | The chat rows mock the prompt builder | CONFIRMED | **Fixed:** wording; the real builder is pinned in `playerFieldReaders.test.js` |
| K4-6 | nit | The 'partial' double's comment | CONFIRMED | **Fixed** |
| K4-7 | nit | This report was missing | CONFIRMED | This report |
| K4-8 | nit | `countEngagement`'s reader was unpinned | CONFIRMED | **Fixed:** a row over malformed ledgers |

**Verifier-level outcomes beyond the lens findings:**
- **KV3:** the approval deadline would hold real approvals, so it was removed. Fixed.
- **KV2:** the batch review's debate fields do not match what the client writes (pre-existing). Separate task.
- **KV4:**
  - a sequential stale replay still files a failure over a landed trade (base behaviour); founder question 5;
  - two comment corrections. Fixed.

**Found by the build itself, before the review:**
- An owner-written object whose `toString` is not a function crashed five sites: the meeting's deadline parse, the launch-guard log, the review's `String()`, the grade renders and the pattern logger's `Date`.
- At C1, an unknown outcome on a stale book could re-pick the same stock and release its reservation. Fixed by stopping.

### 12.3 Mutation lens (K5)

**How it ran.** Last, on its own LF tree of the fix head `5b832f6d`, read-only on git.
- **222 single mutants** across the four areas the prompt names:
  - the copy check (M5-1–57, 201, 211);
  - the readers (M5-148–189, 200, 206–214);
  - the re-read (M5-58–111, 202–205, 215–222);
  - the labels (M5-112–147).
- Each mutant is one literal replacement, asserted to match exactly once.
- Each runs against the build's 23 test files (941 rows). The file is then restored and SHA-checked: 263 restore checks, all OK.

**Results:**
- **183 killed.**
  - Each of the six catch wrappers around the executor calls (M5-217–222) is killed by the static row and by 6–17 behavioural rows.
  - Each of the six `entryMode` stamps (M5-113–118) is killed by the guard's behavioural half.
  - One kill is static only: M5-205, by the wiring count. Its static-preserving twin, M5-215, survived and is listed below.
- **20 equivalent survivors.** Each has a concrete reason:
  - **The copy cannot be malformed** (M5-1, 2, 4, 10, 25): `cronState` is not owner-writable, and `serverMeetingCopy` always writes a string id and object legs.
  - **Redundant inner checks:**
    - The retirement branch nulls a non-matching copy before planning and waiting (M5-5, 12, 15, 27, 28).
    - The plan matched both strings strictly, so the meeting leg's symbols equal the copy's (M5-33–35); the P6-belief mutant M5-32 is killed.
    - The executor never writes a `null` incoming symbol, and no reachable state has two rows for one call (M5-62, 66).
    - At C5, the release guard and the reservation reset each cover the other (M5-104, 216).
    - An inherited plain-object grade entry is reachable only through a `__proto__` key, on a field the owner can write directly anyway (M5-163, 182).
    - A non-object meeting reaches the same `'continue'` with no write either way (M5-172).
  - **A dark flag:** the intraday diagnostic `presetId` (`INTRADAY_DIAGNOSTIC_ENABLED = false`) (M5-170).
- **19 real gaps: test gaps, no product defect.** 1 medium, 10 low, 8 nit. All are killed by 14 rows K5 wrote (18 tests), folded into the build's suites at `86855eca`. **Re-checked in place** on a fresh tree of `86855eca`, against all 23 build files: **23 of 23 killed**, each by its folded-in row (23 restore checks, all OK).

| Mutant(s) | Sev. | What survived | Killing row (suite) |
|---|---|---|---|
| M5-174 | medium | The copy-less meeting's "not waiting" warning with the raw `meeting.id`. An owner-written id no template can convert throws before the score saves (the score-freeze class); no row planted one | `playerFieldShapes` "K5 — the meeting's own id is owner-writable too" |
| M5-8 / 9 | low | The plan compared only half the pair: a leg sharing just the incoming (or outgoing) stock ran as the stored leg and was never recorded as held. Trades stayed bounded to the copy's own pairs | `meetingCopy` "K5 — the PAIR must match" (each mode) |
| M5-152 | low | `meetingLegsOf` accepting an array-like `{length, 0: leg}` | `meetingCopy` "K5 — a suggestedSwaps that is not a list" |
| M5-92 / 100 / 109 | low | The partial-landing marker dropped at C3, C4 (dormant) and on the C5 beat | `retrySafe` "K5 — every caller files the partial-landing marker" |
| M5-108 | low | C5 unknown at enforce filed by capture as a refusal verdict | `retrySafe` "C5 unknown at enforce … files no verdict" |
| M5-202 | low | The read-back reading the occupant from slot 0; every row used slot 0 | `landedTrade` "K5 — the read-back looks at THIS call's slot" |
| M5-207 / 208 | low | A debate stance or a grade's incoming symbol rendered raw (an unconvertible value throws the day's review) | batch review "K5 — every owner-written value … goes through promptText" |
| M5-179 / 213 / 214 / 186 | low / nit | Which lines the 50-line caps keep, and the cap itself | batch review "K5 — which lines the caps keep" |
| M5-212 | nit | The pattern record keeping the first 50 preset changes instead of the last 50 | `labels` "K5 — … the LAST 50 preset changes" |
| M5-144 | nit | The census adding a planted `Infinity` / `NaN` / negative `heldLegCount` | `census-swap-identity` "K5 — the census counts only a positive, finite heldLegCount" |
| M5-215 | nit | C6 counting a refresh that returns no document as a read | `retrySafe` "K5 — C6: a refresh that comes back with NO document is no read" |
| (M5-5, 10, 12, 15, 163) | nit pins | Equivalent in place; pinned on the pure modules so each layer stands alone | `meetingCopy`, `playerFieldReaders` |

---

## 13. Out of scope — noted, not fixed (BUILD_RULES §3)

- **The size freeze** (K1-5): filed as a separate task ("Stop document padding from freezing a battle's score").
- **The ledger key mismatches:**
  - The batch review reads a debate's `targetSymbol` / `userStance` / `outcome` at the top level, but `DebateModal.jsx:72-83` writes them under `details`, so every real debate line renders `undefined` (KV2).
  - The pattern logger reads preset-change keys the client does not write (KV1).
  - Both are pre-existing, and filed as one separate task.
- **Shadow-log labels** (K2-6). `voiceLayerAnticipation.js:147,394`, `voiceLayerTradeNarration.js:289`, `ensure-opener.js:256` and the fenced `decide.js:1581,1674` still log the battle's own `executionMode`. These are analytics labels only, and the integrity build's §1 already records them. Not this build's to change: Q4 named the pattern logger, and `decide.js` is fenced.
- **Points past 50 trades:** parked by the founder.
- **The review header** "Debates: N" counts more debates than the prompt shows past 50 (§8 row 7).

---

## 14. Branch and PR

The local branch is `claude/integrity-followup-2-fe4c21` (the app's suffix), pushed as `claude/integrity-followup-2`. The commits are listed in §0, and this report is the last commit. **Pushed, PR opened, and stopped:** the founder reads CI, answers §11 (including the STOP item, question 3) and merges.

Other notes:
- Nothing here runs on a schedule, and no cron entry is added.
- A byte-exact copy of this report is in the session scratchpad (BUILD_RULES §3).
- Two pre-existing issues are filed as separate tasks (§13).

*Build report — Integrity Follow-up 2, Claude Code, 8 October 2026, base `c1822e39`.*
