# Cockpit Build 2b — spotlight, commands and "Who comes in?", built behind its flag

**Smoke preview (NEVER MERGE, never "Create PR"):** https://trade-seven-ifegqs33n-fais-projects-bc179554.vercel.app
— branch `claude/cockpit-build2b-smoke` at `e3656fc7` = build head `d7b0566f` + one smoke commit. Open a live battle and add `?cockpitFixtures=<variant>` (§9 lists the variants; `?cockpitFixtures=1` is the main one).

**Base:** `origin/main` `0fc78b025eeabe70ed8ac6fb35249cd0bf2d6ba7` (after `git fetch origin`). PR #968 (the 40-second model timeout) is merged there. `docs/audits/20261014_PHASE0_BUILD2B_COCKPIT.md` and `docs/design/COCKPIT_DESIGN_PASS_V1.md` are both present. I proceeded.
**Branch:** `claude/cockpit-build2b` (pushed from the app's worktree branch `claude/brave-pascal-9b8d26` by refspec) · **code head:** `d7b0566f` · this report is the next commit (docs only).
**Spec:** `docs/COCKPIT_BUILD2B_SPEC_V1_0.md` · **Contract:** `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_D.md` (revision 4) · **Visual reference:** `docs/design/COCKPIT_V5_MOCKUP.html` · **Rules:** `docs/BUILD_RULES.md` (binding)
**Date:** 2026-10-21

---

## 0. In short

Everything in spec §3–§11 is built.

- **Behind the flag.** `COCKPIT_2B_ENABLED` ships `false` (`src/config/featureFlags.js:2958`). Everything new sits behind it except the items spec §2 lists as "from merge":
  - the mint fields;
  - the swappable test;
  - retire on exit;
  - the one expiry label;
  - "Following your call";
  - one card per stock plan;
  - Acted wins;
  - the replaced-by wording;
  - the retired and dropped tags;
  - "Filed · no check left today";
  - the server's clock.
- **Endpoint, flag off.** It behaves as at HEAD for budget, pending and answers. Its one change is D-7's `counterpart_unavailable`, and no existing endpoint test moved because of it (§5).
- **No other switches moved.** No environment value, allowlist or calls-mode changed. No fenced file is in the diff. The `createAgentBattle` shape is untouched. No STOP condition was met (§4).
- **The review.** It ran lenses L1–L6 on isolated snapshots, then six refuting verifiers, then a three-part mutation battery (§8).
  - It found 1 BLOCKER, which was resolved before the verifiers ran.
  - Ten findings were MAJOR as reported. The verifiers refuted one (CB6-5), confirmed CB4-2 only in part (as MINOR) and confirmed the other eight. They also raised CB5-5 from MINOR to MAJOR, so nine MAJORs stood, and all nine are fixed.
  - Every confirmed finding inside the build's scope is fixed.
  - The mutation battery ran 97 mutants: 79 were killed on the first run. Every one of the 18 survivors now has a killing row. The battery also found one accessibility defect, CB7-1, which is fixed (§8.3).
  - Two model-visible findings are left for a ruling because a fix would need a fifth model-visible string (§11).
- **The Linux full suite** on the code head `d7b0566f` (merged with main `0fc78b02`) reads `Test Files 1066 passed | 7 skipped (1073)` and `Tests 23131 passed | 88 skipped (23219)`, exit 0. `lint:gate` and `vite build` exit 0 (§7).

---

## 1. Setup and pins

| Check | Result |
|---|---|
| PR #968 on `origin/main` | merged (the 40 s SDK timeout: `agentEvalTransport.js:21` `HAIKU_SDK_TIMEOUT_MS = 40_000`) |
| Discovery PR files on `origin/main` | `docs/audits/20261014_PHASE0_BUILD2B_COCKPIT.md` and `docs/design/COCKPIT_DESIGN_PASS_V1.md` present |
| First commit (spec S-1) | `a60a8c6b`: Amendment D rev 4, the spec and the mockup, each byte for byte, plus D-11's two edits to Amendment C, and nothing else (4 files, +1,304 / −1) |

**SHA-256 (committed blob = attachment):**

| File | SHA-256 | Bytes |
|---|---|---|
| `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_D.md` (rev 4) | `c2ec85bedf57e7830a7a4ed3b4e2fd93b14474eafdbee93f7284da772d76b0ec` | 29,824 |
| `docs/COCKPIT_BUILD2B_SPEC_V1_0.md` | `6b9387f0f2ed8ce576fe6f0716979924f0f223422d75caf42394bda9fc5d11e6` | 43,479 |
| `docs/design/COCKPIT_V5_MOCKUP.html` | `31d98ca533c1e454fe593f59c295ecb7040d9122cd8c4c2425f933ea9959906a` | 1,609,859 |
| `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md` after D-11 (before: `1bc733ca…312f`) | `e27f99bc53a4e34beb943619ac0a7f2745cabdf7a97526b106bf8824f2f03b7f` | 19,253 |

None of the four S-1 files changes after `a60a8c6b`.

**D-11's two edits to Amendment C** are exactly these:
- the status line: blessed; C-7 superseded by D-3; C-8's writer in D-4/D-5;
- one pointer line under each of C-7 and C-8.

**Commits:**

| SHA | What |
|---|---|
| `a60a8c6b` | S-1: docs, byte for byte |
| `51d7c926` | server: D-7 swappable test, the mint fields, `callActions.v2`, retire on exit, one expiry label, the endpoint, the bench read, the flag |
| `510dc36c` | server tests: D-1…D-9, S-10, retire end to end |
| `98c98814` | from merge on the shipped 2a screen: one card per stock plan, Following your call, Acted wins, the new tags, the server's clock |
| `87cb65ff` | the V5 screen behind the flag, plus the S-13 read script |
| `f1e3d7d2` | reduced motion on the V5 card, the chip and the bench sheet |
| `02ca81e4` | the agent's list label names the record (deskHonesty C1); the census rules on the two new `evaluations` readers |
| `5af1dc1a` | the review's fix round (CB1–CB6) |
| `d7b0566f` | the mutation battery (L7): a killing row for every survivor; the bench Pick keeps its symbol (CB7-1) |

Branch diff vs `0fc78b02` at `5af1dc1a`: 84 files, +10,554 / −436. At the code head `d7b0566f`: 86 files, +10,768 / −437.

**Advisor consults** (the instructions' four points, with Fable 5.1 as advisor):
- before settling S-5's order of checks;
- before placing S-7's retire step;
- before freezing S-12's texts;
- before declaring the build complete.

There was one more consult, on the "eyeing" conflict (§4, §11 Q1).

---

## 2. What changed, in plain terms

### 2.1 Server: records, the endpoint, the cron

- **D-7: one swappable test** (`api/_utils/callRecords/swappable.js:88` `canComeIn`, `:134` `freezeSwapBook`).
  - It restates the fenced executor's `validateTradeDecision` line by line, as a restatement, not an import.
  - A parity table runs both on the same rows (`swappable.test.js` imports the exported validator; this is the one fenced function called, read-only).
  - It is used at mint: exit counterparts are tested on the book frozen at the model seam, and entry counterparts only in the call's own slot tier.
  - It is used again at filing: `counterpart_unavailable`, `callActions.js:185`, from merge.
- **D-3 and D-9: mint fields** (`candidate.js`).
  - `replacementOptions` (`:260`, `:323`): up to four names, from the agent's lists first, then the bench by `technicalRank`. Unranked names go last. A name the observation does not admit is skipped. The field is `null` on calls that don't qualify.
  - `invalidatedReason` (`:335`).
  - The cron hands in the linted anticipation candidates and the rank map. There is no new I/O.
- **D-4: `callActions.v2`.**
  - `call_replace`, which reads: "If you exit OUT by …, bring in IN."
  - The named `call_go`, through v1's own template.
  - With the flag off, v1's templates and `textVersion` are byte-identical.
  - `answers.js` gains the v2 rows, `answerTakesPick` and `replacementStepFor`.
- **D-1: 7 commands per battle**, derived from the battle's own cockpit filings (`api/_utils/callRecords/commands.js:32`).
  - With the flag on, the endpoint no longer charges `chatBudgetUsed`.
  - The league branch is unchanged.
- **D-2: one live command, replaced after confirmation** (`api/agent/call-response.js:131` and the ordered table at `:52-80`).
  - With the flag on, a live slot without `confirmReplace` gets 409 `replace_unconfirmed` with the current command's text and ids.
  - That refusal is never persisted.
  - Once confirmed, the shared writer stamps the replacement and writes `superseded`.
  - With the flag off, `directive_pending` works exactly as at HEAD.
- **D-4 on the endpoint.** `replace` after the `go` acknowledgment is the one sanctioned rewrite of `playerResponse`. The acknowledgment is kept in `after`, and both `answered` events stand. A pin (`call-response.2b.test.js`) scans every `api/` source for any other path that writes `playerResponse`: the key in any position of a write (review CB1-4), and, outside the endpoint, a hoisted patch, a computed key or an assignment (L7). Only two reviewed lines in `candidate.js` may name it (the mint's `playerResponse: null` and the mutable-fields list).
- **D-5: receipts.** `flip.js` and `heard.js` treat a chosen name as binding the exit match.
  - Only OUT→IN counts as acted.
  - OUT→anything else is a loud no-match and retires the command.
  - v1 is unchanged.
- **D-6: retire on exit** (`api/_utils/callRecords/retire.js:158` `retireLeftBook`; `retired` is the ninth event kind, `events.js:36`).
  - The cron step `retireCommandIfLeft` (`api/cron/agent-evaluate.js:5743`, exported for one behavioral row) runs before every reader of the prompt's directive:
    - at the main pre-prompt point (`:2604`);
    - after the R11 pass on a meeting-pending tick (`:2562`) and on a meeting-created tick (`:2684`) (review CB1-1).
  - It is bounded by the tick's remaining budget (CB1-12).
  - It compares and clears against a newer slot.
  - It never throws.
  - A late commit is settled inside a reserve, followed by one bounded event read (CB1-2).
- **D-8: one expiry label** (`sweep.js:173` `decideTerminalParentExpiry`): the deadline is compared with the battle's end before the state is.
- **S-9: the server's clock.** `serverNowMs` is in the status endpoint's 200 body (`api/agent/cockpit-status.js:28`), from merge.
- **S-10: the bench read** (`api/agent/cockpit-bench.js:198`).
  - The full gate, then scoped rows (a call's exit) or browse rows.
  - Held names are omitted.
  - There is no write and no model call.
  - A scoped sheet whose OUT has already left the book shows every row `not_swappable` (CB1-8).
- **S-11: the flag.** `COCKPIT_2B_ENABLED = false` plus its pins (`src/config/cockpit2bFlags.test.js`, `flagPinGuard`).
- **S-13: the read script.** `scripts/cockpit-2b-read.mjs` gives per-battle-day tallies from the records. Facts the records don't hold print as "unknown — not recorded".

### 2.2 The model-visible text (S-12, reviewed through the fenced-class lens L2)

Exactly four strings are new to any prompt:

1. the `call_replace` directive text;
2. the named `call_go` text, equal to v1's counterpart form by construction;
3. the calls block's `answered: Bring in {IN}` line;
4. the calls block's `answered: Go now, bring in {IN}` line (`callsBlock.js:93`, `copy.js:194`).

All four are pinned by frozen literals in `build2b.answers.test.js`. Events never reach a prompt. L2 found two issues next to this text, CB2-1 and CB2-2. Each fix would need a fifth model-visible string, so both are left for a ruling (§11 Q4, Q5).

### 2.3 From merge on the shipped 2a screen (not behind the 2b flag)

- **One card per stock plan** (D-12, `cockpitModel.js:229` `foldThreads`).
  - Calls on one plan fold at any level.
  - The headline is the newest open line, with "Line moved $A → $B" and the earlier levels on expand.
  - A call more than 1% from the answered level is a new ask, with its own buttons.
- **"Following your call"** (D-10, `cockpitModel.js:192` `isFollowing`).
  - It goes only on a restatement whose minting check's `declared` event names the live command's thread.
  - It holds while the command's SLOT is live, even after the answered call itself resolves (CB3-1).
- **Acted wins** on every terminal state.
- **New tags:**
  - "Dropped · {reason}" (D-9);
  - "Command retired" (D-6, naming the check of the recorded trade, CB3-2);
  - "Replaced by your later command · {t}" / "Replaced by a chat instruction · {t}", from the battle's own exchange;
  - "Filed · no check left today".
- **Server-clock deadlines:** one timer at the next open deadline, on server time (`useServerClock.js`, `useCockpitStatus` `clockOffsetMs`).
- **Long tags wrap** inside the 2a tile at 390/375/360 px. They used to overflow and empty the eyebrow (CB5-5; a markup change in `CockpitFeed.jsx`).

### 2.4 The V5 screen (flag on)

- **`Cockpit2b.jsx`** (`:491`) renders `cockpit2bModel.js`'s view (`:412` `buildCockpit2bView`) in the 2a feed's place on both shells. It shows:
  - the commands meter;
  - the Now card by §5.2's priority, with spotlight and the hold after Confirm exit;
  - the §6.2 buttons, each override with one bullet;
  - "Who comes in?" on the card and after "Exit instead";
  - the Also-live strip;
  - the day line;
  - Monitoring;
  - a collapsed Earlier with "Show all".
- **The replace confirmation** (`useCockpit2bAnswer.js`).
  - It is raised on the card, in 2a's details sheet (which, with the flag on, answers with the card's §6.2 buttons) and in the bench sheet.
  - It shows only on the surface and card it was raised on, and drops when that surface closes.
  - A chat directive raises it from the 409.
- **The bench sheet** (V5 6A, `CockpitBenchSheet.jsx`).
  - It sits on 2a's modal layer, now shared from `CockpitSheet.jsx`, where 2a's markup is unchanged.
  - It sorts.
  - It shows row statuses: available, locked, not swappable, no price.
  - It carries the agent's note, only from the selector and never engine-authored text.
  - It reads a refused pick aloud, and every Pick names its symbol, waiting or in flight (CB7-1).
  - It defers to the research modal, going inert and dropping its trap.
- **Smaller pieces**, all flag-on only:
  - **board-row dots:** `TacticalRow.jsx:100` `callMark`, with the mark's words in the row's name;
  - **the composer line:** `AgentChat.jsx:656`;
  - **the Research pill:** `ThisTurnStrip.jsx:29` `onResearch`;
  - **the peek allowance:** `useChatSheet.js:48`.
- **Wiring:** `src/screens/AgentBattleScreen.jsx:2538` onward.
- **Guards:** tokens and motion only, with the four new files registered in both guards and both baselines. Reduced motion is honored. Focus never falls to `<body>` on an in-place swap.

---

## 3. Anchors re-verified at HEAD

The discovery's anchors are at `d5d8fa9b`; HEAD is `0fc78b02`. I re-verified all 333 distinct code anchors (method and full table: Appendix A).

| Status | Rows |
|---|---|
| SAME | 210 |
| MOVED (same text, new lines) | 113 |
| CHANGED | 6 |
| GONE | 0 |
| INVALID AT SOURCE (past the end of an unchanged file) | 4 |

The design pass and the spec carry no `file:line` anchors.

**What the build followed at HEAD:**

1. **A4 timing.** The timeout is 40 s and the ceiling 42 s, so `on` needs 68,000 ms where the discovery said 48 s (`agentEvalTransport.js:21`, `:29-30`; `agent-evaluate.js:2900-2902`). R2B-8 already records #968. The build touches no timing.
2. **`AgentBattleScreen.jsx` `boardRows`** is now `:2830-2841` (at base) and renders `<StockDispatchRow>` (a wrapper at `:197`), not `<TacticalRow>` directly. The board dots ride through the wrapper to `TacticalRow`'s new `callMark` prop.
3. **`voiceLayerPrompt.js`** scores now come from `displayedStockScores` (`:1148`). B9 is not touched by the build.
4. **`directiveWriter.js:192-297` (discovery L212) are past the end of the 145-line file**, which is unchanged. The code they meant is:
   - the `supersedes` stamp `:89-90`;
   - the in-transaction `superseded` event `:111`;
   - the plain path's re-read at commit `:117-145`.

   The build uses those as they are.
5. **Three cites were off at the source:**
   - `battleViewCopy.js:1111` → the replaced tag is `:1113`;
   - `:1101-1102` → `:1102-1103`;
   - `agent-evaluate.js:446-447` → `:466`.

Spec L16 lists 7 moved files. In fact 15 cited files changed between the two commits (Appendix A).

**Where HEAD differed from the spec's own wording** (the build followed HEAD; each place carries a `HEAD DIFFERS` comment):
- **The bench sheet's prices** (`api/agent/cockpit-bench.js:42`). The spec names the rankings document for price and change, but that document carries neither (235 rows, no price key). The build reads `voiceLayerCache/{battleId}.benchBriefs`, the 15-minute quote the chat agent reads. Two consequences follow (§11 Q2).
- **"No check left today"** (`cockpitModel.js:385`). The turn line also withholds `nextDecisionAt` while a check runs late, so "absent" alone would falsely claim no check is left. The build reads the registered evaluator schedule instead.
- **The call-family pending predicate** (`cockpitModel.js:457`). Hearing consumes nothing: a heard call directive keeps blocking while live (Amendment C rev 3). The line never claims "not heard".
- **The retire step's placement** (S-7). At HEAD the last pre-prompt route that moves the book is `handleGameplanMeeting`. The review found that its pending and created branches return early (CB1-1), so the step runs on those branches too.

---

## 4. STOP conditions

| Condition | Met? |
|---|---|
| PR #968 or the discovery files missing on `origin/main` | no: all present |
| A change would need a fenced file (BUILD_RULES §1) | no: no fenced file in `git diff --name-only 0fc78b02 d7b0566f`. One fenced function is called read-only, in a test: `validateTradeDecision` (`agentSwapExecution.js`), in `swappable.test.js`'s parity table. |
| A change would alter the `createAgentBattle` document shape | no: `agentBattleService.js` untouched, and no new battle field. The new state is on call records (`replacementOptions`, `invalidatedReason`, `playerResponse.after`) and one event kind. |
| S-7: a retired directive could still reach the prompt | no: the step drops it before every prompt reader, and a late commit is settled (CB1-2). A `[ControlEpoch]` console line can say "rendered" for a later-dropped directive; the durable log is unaffected (CB1-11, NIT). |
| A uid in a committed file or `.env.local` | no: accounts are labelled founder / FT_QA. The one read that needed the allowlist passed it inline for that run. |
| `firebase deploy` of any kind | never run |

**A conflict that was not a STOP: "eyeing".**
- Spec R2B-5 words the label "{Agent} is eyeing".
- `deskHonesty.test.js` C1 bans "eyeing" by name, and spec §11 forbids loosening a guard. The build kept the guard.
- The labels read "From {Agent}'s lists" (the strip group) and "On {Agent}'s list" (the sheet's marker).
- Both are true record facts. This is a founder question (§11 Q1).

---

## 5. Flag off: what moved, and every existing test that moved

**The answer endpoint, flag off.** It behaves as at HEAD for budget, pending and answers. Its one change is D-7's `counterpart_unavailable` at the eligibility step. **No existing test moved because of it:**
- `api/agent/call-response.test.js` is unchanged;
- `api/_utils/callRecords/callActions.test.js` is unchanged.

The new rows are in `call-response.2b.test.js` and `build2b.answers.test.js`.

**The flag-off goldens.** These show only the from-merge rows below. The off-mode prompt golden is byte-identical. No pinned flag-off render hash moved.

**Existing tests whose expectations moved (all from-merge):**

| Test file | What moved | Why |
|---|---|---|
| `src/screens/battleView/cockpitModel.test.js` | (a) the 1% membership becomes coverage: plans fold at any level (`toHaveLength(2)` → `1` at `:597`, `:737`); (b) "Restated at the 10:45 AM check" → "Latest line · the 10:45 AM check" with "Line moved $161.00 → $162.00" on a moved line, and "Restated at" kept for a same-level restatement; (c) the replaced tag gains its time and its source ("Replaced by your later command / a chat instruction / a later instruction · {t}"), which supersedes the Oct 4 source-free ruling (spec §7.1); (d) the last-instant "Filed · not yet heard" → "Filed · no check left today" after the day's last slot; (e) the coverage table's known set (two derived rows) | D-12, §7.1 |
| `api/agent/cockpit-status.test.js` | `{ on, allowlisted }` → `{ on, allowlisted, serverNowMs }`; BA-40's "exactly two keys" row names the third | S-9 |
| `api/_utils/callRecords/sweep.test.js` | a completed parent carries `completedAt` | D-8: the battle's end is read before the state |
| `api/_utils/callRecords/amendmentC.test.js` | C-3's cooldown row reads the lock from the frozen book (D-7), not a `locked` list; `counterpartUsable` takes `{ book, atMs }`; C-2's null-held row nulls the book too | D-7 |
| `api/_utils/callRecords/candidate.test.js` | the call key list gains `replacementOptions` and `invalidatedReason` | D-3, D-9 |
| `api/_utils/callRecords/copy.test.js` | `ANSWER_WORDS` keys gain `replace` | D-4 |
| `api/_utils/callRecords/events.test.js` | `CALL_EVENT_KINDS` gains `retired` (plus its id rows) | D-6 |
| `heard.test.js`, `publish.test.js`, `amendmentC.test.js` (call sites) | signature only: the mint takes `book`, `anticipationCandidates`, `rankMap` | D-3, D-7 |

**Rows only added to existing files, no expectation changed:**
- `agent-evaluate.tickStamps.callsOn.test.js` (retire end to end, the meeting-pending row, and L7's S7x and S9 rows);
- `CockpitFeed.jsdom` (L7 F17: the tag and tile-head wrap styles);
- `useCockpitStatus.jsdom` (L7 F19: the clock offset);
- `flagPinGuard.test.js`;
- `unconfirmedOutcome.census.test.js`;
- `useCockpitAnswer.jsdom`;
- `CockpitSheet.jsdom`;
- `ThisTurnStrip.render`;
- `useChatSheet.test`;
- `tokens.guard`;
- `motion.guard`.

`COCKPIT_UI_ENABLED` false: nothing renders and no request is sent (2a's rows, unchanged and green).

---

## 6. No flag flips

`COCKPIT_2B_ENABLED` ships `false`. Unchanged:
- `CALL_RECORDS_MODE`;
- `COCKPIT_UI_ENABLED`;
- the allowlist;
- grounding;
- the fit check;
- Ask 2.

The flip is §13 step 5's separate PR.

---

## 7. Tests and builds

Every run asserted its exit code and read the `Test Files` line. The Linux runs are the record (WSL Ubuntu, a private clone, Node 20.20.2, `TZ=UTC`, `--maxWorkers=2`, the LF tree of the exact commit merged with `origin/main`).

| Run | Tree | Result |
|---|---|---|
| Full suite, Linux | `5af1dc1a` (∪ main `0fc78b02`, a clean merge) | exit 0 · `Test Files 1066 passed \| 7 skipped (1073)` · `Tests 23117 passed \| 88 skipped (23205)` |
| **Full suite, Linux (the record)** | **`d7b0566f` (∪ main `0fc78b02`, a clean merge)** | **exit 0 · `Test Files 1066 passed \| 7 skipped (1073)` · `Tests 23131 passed \| 88 skipped (23219)`** — the 14 added rows are L7's; 593 s |
| `lint:gate` | `d7b0566f` ∪ main, Linux | exit 0, `--max-warnings 0` |
| `vite build` | `d7b0566f` ∪ main, Linux; the smoke head `e3656fc7`, Windows | exit 0 both (the CSS-syntax and dynamic-import warnings are long-standing) |
| `test:rules` (Windows, Java, the Firestore emulator) | an LF snapshot whose `firestore.rules`, `firebase.json`, `vitest.rules.config.mjs` and all 26 `test/rules` files match `d7b0566f` byte for byte | exit 0 · `Test Files 25 passed (25)` · `Tests 424 passed (424)`. On the CRLF worktree one source-text row fails (`agentEvalRunsDenials` reads `firestore.rules` and its comment strip misses on CRLF), as its twin in `agent-evaluate.evalRun.test.js` does; this build changes neither `firestore.rules` nor `test/rules` |

**Windows.** The CRLF worktree fails only rows that compare file bytes or line-anchored source text, the known platform-only kind:
- `tickStamps.pins` (anti-vacuous);
- `tickCoherence` (the byte-identical prompt golden and its anti-vacuous row);
- `evalRun` (the `firestore.rules` source tripwire);
- `decisionRecord`;
- `ruleSupportStatus`;
- `traitLibraryCandidate`;
- `shadowCpuQuoteIntegrityFlags`;
- `AgentBattleScreen.controller` "seen mark".

Each passes in the Linux run above.

**Guards.** These pass with the additions, none loosened:
- honesty (deskHonesty C1);
- tokens;
- motion;
- cssTokens;
- flagPinGuard;
- the `unconfirmedOutcome` census, with two new readers ruled in at `02ca81e4`.

---

## 8. The §12 review (BUILD_RULES §2)

### 8.1 How it ran

- **Snapshots.** Each lens read its own LF `git archive` snapshot of `f1e3d7d2`, read-only on git.
  - L4 and L5 also ran repro tests and a headless-Edge harness on the real `BoardCockpitTrack` at 390 and 1440 px.
- **Verifiers.** Every finding went to a refuting verifier (V1–V6, one per lens), each on its own snapshot.
- **Ids.** Review ids are `CB1-…` to `CB7-`. `V5-n` are the spec's rulings, not findings.
- **The fix round** is `5af1dc1a`.
- **The mutation battery** (L7) ran last, on snapshots of the fixed head.

### 8.2 Verdicts and dispositions

Severity as reported, then the verifier's verdict.

**L1 — server and Amendment D fidelity** (4 MINOR · 3 DOCUMENTED · 5 NIT)

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| CB1-1 | retire never ran on meeting-pending / -created checks | PARTLY (MINOR); the proposal-pending half is unreachable in production | fixed: the step after the R11 pass on both meeting branches; row in `callsOn` |
| CB1-2 | a late retire commit could clear the stored slot while the in-memory slot stayed | CONFIRMED | fixed: a re-read reserve; on unconfirmed, one bounded event read settles it |
| CB1-3 | a hot-bench name can never be chosen; with no cache doc, every stock shows no price | PARTLY: the mint half is refuted on ordinary ticks; the sheet half is confirmed | HEAD-DIFFERS note extended; pin comment corrected; founder question (§11 Q2) |
| CB1-4 | the one-rewrite pin caught `playerResponse` only as the first key | CONFIRMED | fixed: any key position, spreads, create |
| CB1-5/6/7 | documented: retired evidence null by placement; bench price source; D-8 end ≤ now | accurate | recorded (§11 Q8–Q10) |
| CB1-8 | a scoped sheet whose OUT left the book showed Pick enabled | CONFIRMED (NIT) | fixed: every row `not_swappable` |
| CB1-9 | stray `pickSymbol`: S-5 says `invalid_request`, D-4 says `illegal_answer` | CONFIRMED (NIT) | founder ruling (§11 Q6) |
| CB1-10 | stale citations | CONFIRMED | fixed |
| CB1-11 | console telemetry can say "rendered" for a later-dropped directive | CONFIRMED (NIT) | recorded; durable log unaffected |
| CB1-12 | the retire deadline ignored the tick's tail budget | CONFIRMED (NIT) | fixed |

**L2 — model-visible text** (2 MINOR · 1 NIT)

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| CB2-1 | the chat calls block shows a replaced or retired cockpit command as a standing "answered: …" row | CONFIRMED (MINOR). Retirement is from merge, so this reaches the chat block now. Spec S-7 lists `callsBlock.js` among readers that "handle `retired`", but it reads no events. | **not fixed**: a fix is a fifth model-visible string. Follow-up (the 1a V2-G7 events merge) plus founder/Fable ruling (§11 Q4) |
| CB2-2 | a read race can render a bare "answered: Bring in" | CONFIRMED (MINOR, low likelihood) | documented; founder question (§11 Q5) |
| CB2-3 | "Go now, bring in DHR" reads immediate | REFUTED: D-4 fixes the string verbatim | none |

**L3 — records and receipts** (1 MAJOR · 3 MINOR · 1 NIT)

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| CB3-1 | "Following your call" lost when the answered call resolves while the command is live | CONFIRMED (MAJOR, from merge) | fixed: D-10 keyed to the live slot |
| CB3-2 | the retired tag named the retiring check, not the check where the stock left | PARTLY | fixed client-side: `{t}` = the recorded trade's check; stored text unchanged |
| CB3-3 | after replace-after-go, two "Filed" receipts and the agreement lost | CONFIRMED | fixed: "You agreed · {t}" from `after` |
| CB3-4 | the strip word of a retired command's call fell back to the default | PARTLY (wider) | fixed: retired / replaced / you answered |
| CB3-5 | "no check left today" while the last check still runs | PARTLY: transient; the spec's literal rule gives the same | not changed; founder note (§11 Q7) |

**L4 — desktop UI vs V5** (2 MAJOR · 9 MINOR · 3 NIT)

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| CB4-1 | a replace confirmation outlived its surface and could fire another call's answer | CONFIRMED (MAJOR) | fixed |
| CB4-2 | 2a's details sheet as a 2b answer surface (exit+hold "Go instead" with no step) | PARTLY → MINOR | fixed with CB4-3 |
| CB4-3 | the sheet's 2a labels ("· 1 message", "Go instead") under the flag | CONFIRMED (= CB6-3) | fixed: `sheetButtonsOf` |
| CB4-4 … CB4-14 | in-flight state; step gates; stale spotlight and step; command mode swallowing an ask; Earlier "Show all"; Escape under research; refused pick in the sheet; orphan sheet; sort reset; "Sending…" | CB4-5 PARTLY; the rest CONFIRMED | all fixed |

**L5 — phone, accessibility, reduced motion** (4 MAJOR · 3 MINOR · 3 NIT)

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| CB5-1 | the bench sheet kept its modal contract under the research modal | CONFIRMED (MAJOR on keyboard) | fixed: suspended (inert, not modal); Escape closes the research modal |
| CB5-2 | focus fell to `<body>` on every in-place swap | CONFIRMED (MAJOR phone) | fixed |
| CB5-3 | an expanded chip overflowed the phone (444 px at 390) | CONFIRMED | fixed as measured (minWidth 0 + wrap + StateTag) |
| CB5-4 | a confirmation off-screen in a scrolled bench sheet | CONFIRMED | fixed: Replace takes focus |
| CB5-5 | from merge: the retired tag overflowed the shipped 2a tile | CONFIRMED, raised to MAJOR | fixed (2a tile head and StateTag wrap) |
| CB5-6 … CB5-10 | dot label not in the row's name; contrast 3.77:1 / 2.19:1; note spacing; peek comment; accessible-name drift | CONFIRMED | all fixed |

**L6 — copy and honesty** (1 BLOCKER · 3 MAJOR · 4 MINOR · 2 NIT)

| Id | Finding | Verdict | Disposition |
|---|---|---|---|
| CB6-1 | "eyeing" trips deskHonesty C1 | BLOCKER, CONFIRMED | resolved `02ca81e4` (guard untouched); the V6 verifier ran the guard logic at `02ca81e4`: 26 terms × 51 files, 0 failing; founder question (§11 Q1) |
| CB6-2 | the bench note quoted engine- and guardrail-authored sentences as the agent's | CONFIRMED (wider) | fixed |
| CB6-3 | 2a sheet labels under the flag | CONFIRMED | fixed |
| CB6-4 | "You said go instead" after "Bring it in" / "Exit instead" | CONFIRMED | fixed |
| CB6-5 | the day line counts a multi-day battle | **REFUTED**: every battle is one trading day | the interim filter reverted |
| CB6-6 | league battles say "commands" | CONFIRMED | fixed: "messages" |
| CB6-7 | a refused pick shows no line on the sheet | CONFIRMED (spec gap) | fixed |
| CB6-8 | pre-open "as of" times; "locked until {t}" reads past | PARTLY | fixed: a time on another ET day carries its weekday |
| CB6-9 | double space in an Earlier row | CONFIRMED | fixed |
| CB6-10 | stored retired text uses the step's wall clock | PARTLY (by design, not shown) | not changed |

**Totals.**
- **Reported:** 1 BLOCKER, 10 MAJOR, 25 MINOR, 3 DOCUMENTED and 15 NIT, across L1–L6 (54 findings), plus CB7-1 from L7 (§8.3).
- **Verified:**
  - 2 refuted: CB2-3 and CB6-5.
  - 8 confirmed in part: CB1-1, CB1-3, CB3-2, CB3-4, CB3-5, CB4-2, CB4-5 and CB6-8.
  - CB6-10 was confirmed in part as by design.
  - The rest were confirmed.

### 8.3 Mutation battery (L7)

Three agents ran the battery, each on its own snapshot of `5af1dc1a`, each mutant an exact find/replace that must occur exactly once. Every file was restored from a binary copy and checked against its pre-run SHA-256; every restore was byte-identical, and each part's named tests were green again after the last restore. No kill depended on a timeout, and no mutant was broken (each run collected its full test count).

| Part | Mutants | Killed on the first run | Survived |
|---|---|---|---|
| 1 · server (S-ids) | 18 named + 9 extra = 27 | 20 | 7: S5, S6b, S7x, S9, S13b, S15c, S15d |
| 2 · from-merge client (F-ids) | 20 named + 1 variant = 21 | 17 (F10 and F10b by `cockpitModel.test.js`, outside the named file) | 4: F1, F7, F17, F19 |
| 3 · flag-on client (C-ids) | 37 named + 12 variants = 49 | 42 | 7: C3, C18, C19b, C20, C21, C32b, C35b |
| **Total** | **97** | **79** | **18** |

S13 (the D-3 cap of four) was killed only by its constant pin; its behavioral twin S13b survived, so it counts above as a survivor.

**Every survivor now has a killing row** (`d7b0566f`). Each row was run on the real code (green) and under its own mutant (red), with a byte-checked restore after each run — 22 proof runs, 22 kills:

| Survivor | Why it lived | The killing row |
|---|---|---|
| S5 | the non-book row covered `pick_locked` and `counterpart_unavailable`, never `pick_not_on_bench` | `retire.test.js` "a non-book failure…": a chosen name gone from the bench stands |
| S6b | no row reached the event-read settle | `retire.test.js` "review L7 S6b": a deadline-aborted transaction, event landed → retired; missing → unconfirmed |
| S7x | the meeting-CREATED call site had no row | `callsOn` "review L7 S7x" — a **source pin** (three call sites; both R11 return branches retire after the pass), in the R11 suites' own static-source posture; a behavioral meeting-created tick with a guardrail exit would need new fixtures |
| S9 | the tail clip only bites ~277 s into a tick | `callsOn` "review L7 S9": `retireCommandIfLeft` exported for the row; inside the tail → `not_started`, early → retired. The helper also moved back out from between the R11 pass's doc block and its function (a placement slip from the build) |
| S13b | no row offered five passing names | `build2b.mint` "review L7 S13b": five passing names → four options, agent-filled and bench-only |
| S15c, S15d (+ S15e, a new plant) | the write pin read only `update(`/`set(`/`create(` statements | `call-response.2b` widened pin: outside the endpoint `playerResponse` may be a key, listed name or assignment target only on two reviewed lines in `candidate.js`; a hoisted patch, a computed key and an assignment each fail it (source pin, by design) |
| F1 | restatements share their plan key, so the command key never showed | `cockpitModel.2b` "review L7 F1": an unanswered call on the command's plan stays its own card, with its answers |
| F7 | no row put the next decision exactly at the close | the "no check left today" row: `nextDecisionAt` = 4:00:00 PM → true |
| F17 (+ F17b) | no jsdom row read the wrap styles; the overflow is real (headless Edge at 360 px: the tag 3.9 px off-screen left, over the kind label) | `CockpitFeed.jsdom` "review CB5-5 / L7 F17": the tag `white-space: normal`, the tile head `flex-wrap: wrap` |
| F19 | no client row supplied `serverNowMs` | `useCockpitStatus.jsdom` "review L7 F19": offset 1,500 ms |
| C3 | the tie-break row restated the NEWER card only | `cockpit2bModel` tie-break row: the older card restated later still leads |
| C18 | the key check mattered only when the bench is re-pointed to browse | screen "review L7 C18": the Research pill over a scoped prompt shows "The bench" with no prompt |
| C19b | only the orphan path (pane leaves Cockpit) needs the bench half | screen "review L7 C19b": the prompt is dropped, not revived on the next opening |
| C20 | no fixture brought a stale spotlight's card back to Needs you | `Cockpit2b.jsdom` "review L7 C20" |
| C21 | every fixture card had one call (card key = step call id) | `Cockpit2b.jsdom` "review L7 C21": a two-call card keeps its step open |
| C32b | CB4-13 opened the bench only through the pill | screen "review L7 C32b": Rank from the card's door |
| C35b | only a late resolve was covered | `useCockpitBench.jsdom` "review L7 C35b": a late rejection is dropped (low severity: the default request never rejects) |

**A defect the battery found (CB7-1, MINOR, accessibility), fixed in `d7b0566f`.** A waiting or sending Pick on the bench sheet announced "Pick" without its symbol: `CockpitBenchSheet.jsx` rendered `aria-label={action.disabled ? action.label : action.aria}`, discarding the model's name. The sheet now renders the model's name in every state, and the model names a Pick in flight as the card's chips do: "Pick XOM" waiting, "XOM · Sending…" in flight, "Pick XOM · 1 command" otherwise. Row: `CockpitBenchSheet.jsdom` "review L7 (C15 at the sheet)"; both the sheet and the model half were mutated back and killed.

The allowlist's HUMAN REVIEW note for the retire write (`compositionProtectedStoresAllowlist.json`, `_notes_cockpit_build2b`) now states the fix round's budget (the 200 ms reserve and the event read) and its three call sites; the key and its count are unchanged.

---

## 9. The smoke branch

`claude/cockpit-build2b-smoke` at `e3656fc7` is `d7b0566f` plus one commit. That commit:
- sets `COCKPIT_2B_ENABLED = true`;
- adds `src/screens/cockpitSmokeFixtures.js` with its self-test, 6/6 green;
- wires it in `AgentBattleScreen.jsx`.

It is never merged, and no PR is opened for it.

**How it works.** With `?cockpitFixtures=<variant>` on a live battle:
- an in-memory store stands in for the cockpit's records and the battle's slot, exchanges and bench;
- answers go to a scripted endpoint that moves the store as the listener would;
- nothing is written to Firestore;
- the status endpoint is not called.

| Variant | Shows |
|---|---|
| `1` | Now: "Who comes in?" on an exit with no counterpart (priority 1), with the step on the card. The strip holds: an entry (2), a hold-default exit, an entry + hold, an upside call, a moved line and an agreement. Earlier holds every §7.1 row. Four answered calls carry the receipts (retired · replaced by your command · by chat · no match), and their four filings leave the meter at 3. |
| `fresh` | `1` without those four filings: the meter at 7 |
| `p2` | the entry leads (priority 2) |
| `p3` | the hold-default exit leads, with its "Exit instead" step |
| `p4` | the command card leads (priority 4), with a restatement under it ("Following your call"), the composer line and the teal board dot |
| `heard` | `p4`, heard at a check |
| `quiet` | the quiet line (only an upside call open) |
| `meter1` / `meter0` | 1 command left / none left (overrides read "No commands left") |
| `command` | `1` with a live cockpit command on another call: every override asks the replace confirmation |
| `chat` | `1` with a live chat directive: an override returns 409 `replace_unconfirmed`, and the prompt opens from its text |
| `filed` | the priority-1 exit already answered with a pick: the command card with "✓ XOM comes in if NVDA exits · filed" |

**The bench sheet** (any variant, via "Browse the bench →" or the step) answers from fixture rows in both modes:
- XOM and CVX available;
- PSX locked;
- MPC with no price;
- ETH.CC not swappable (scoped).

Board dots ride on the battle's own held symbols, on both shells.

**Builds.** The smoke tree passes `vite build` with exit 0. Vercel's preview deployment of the pushed smoke head: success (GitHub deployment 7235836426, environment Preview); the served bundle carries the fixture code (`cockpitFixtures`, the `smoke2b:call:` ids).

---

## 10. §13: the deployment checklist (none of it is done here)

1. **Amendment D.** It was blessed with conditions: D-1 to D-11 on 2026-10-15 and D-12 on 2026-10-16. Revision 4 folds in every condition.
   - The committed file is revision 4: SHA-256 `c2ec85be…b0ec` (§1), and it is unchanged after `a60a8c6b`.
   - Nothing further on the contract side gates the merge.
2. **Founder smoke** on the preview above, on both shells, starting with `?cockpitFixtures=1` on desktop, then the other variants in §9.
3. **Astra review** of the PR.
4. **Merge after 6 PM ET** (cron and endpoint changes), with CI green. The from-merge fixes go live for the allowlisted owners at this step. Retire on exit runs at `'on'` for any call-family slot, flag or not.
5. **The flip PR** (§10.2), merged after 6 PM ET. It contains three things:
   - `COCKPIT_2B_ENABLED = true`;
   - its pin update in `src/config/cockpit2bFlags.test.js`;
   - the `DARK_BY_DESIGN` removal in `flagPinGuard.test.js`.

   There is no environment change; the allowlist already holds founder and FT_QA.
6. **The next trading day.**
   - The founder plays one battle and answers at least one exit with a pick, and FT_QA answers calls too.
   - Then run `node scripts/cockpit-2b-read.mjs` (S-13).
   - Run the existing `--rollback-check` after each of the first five sessions.
7. **The round-4 replay** (R2B-8) runs as its own task. It does not gate the flip.

**Rollback** is the flag back to `false`: one line. Records stay. Commands filed under 2b stay valid directives until they expire, retire or are replaced.

---

## 11. For the founder (and Fable where the contract is involved)

1. **"eyeing" (R2B-5, Amendment D:90 / D:323).** The spec's label trips the standing C1 honesty guard, so the build shows "From {Agent}'s lists" / "On {Agent}'s list" instead.
   - Keep these labels (and add a contract line), or rule an exception to C1?
   - The product already ships "See what it's eyeing" outside the guard's scope: `CommandDashboard.jsx:464` and `ScoutingBoardSheet.jsx:120`.
2. **The bench sheet's price source** is `voiceLayerCache.benchBriefs`, since the rankings document has no prices. This has two consequences:
   - A hot-bench name always reads "no price" on the sheet, though the executor accepts it and the card's chip may offer it.
   - Before a battle's first voice-layer run, every stock row reads "no price".

   Widening `benchBriefs` is model-visible to the chat. Rule the source.
3. **CB1-3's mint half.** After `refreshBattleFromDoc` drops the hot-bench augmentation, a hot-bench name cannot be an option. Re-augmenting changes what the fenced prompt reads. Leave it as it is, or task it?
4. **CB2-1.** The chat calls block shows a replaced or retired command as a standing "answered: …" row, and spec S-7 says `callsBlock.js` handles `retired`. A fix is a fifth model-visible string, so it needs a fenced-class review and a ruling. The recommended follow-up is the 1a V2-G7 events merge.
5. **CB2-2.** There is a rare read race in which the calls block can show a bare "answered: Bring in". There are two ways to fix it:
   - re-read the battle after the calls read (a read-order change in `chat.js`, which needs the owner's nod);
   - drop the segment (model-visible).
6. **CB1-9.** A stray `pickSymbol` is refused `invalid_request` (spec S-5), but Amendment D-4 says `illegal_answer`. Which one?
7. **CB3-5.** "Filed · no check left today" can show for a few seconds while the day's last check is still running. The spec's literal rule gives the same result. Changing it flips a pin. Keep it?
8. **D-6 evidence.** The `retired` event carries `{ evalId: null, promptBuiltAt: null }` by placement, because the step runs before the check's prompt exists. Is that acceptable as the contract's reading?
9. **D-8.** The battle's end is taken as `min(end, now)`. Confirm.
10. **Server event labels** use 24 h text (CB1-5), which is not shown to the player. Fine?
11. **§5.2 "unchanged except for the new tags"** vs V5-2, V5-4 and §6.2. Under the flag, 2a's details sheet now answers with the card's §6.2 buttons (CB4-2/3, CB6-3). Confirm.
12. **§6.1 "under the card"** vs the modal bench sheet. A refused pick in the sheet is said in the sheet itself (CB4-11, CB6-7). Confirm.
13. **"Hold call"** is the eyebrow for entry + hold (a hold default of either direction). Confirm.
14. **The phone top row** shows the meter only. Confirm.
15. **The Oct 4 "replaced" ruling** (source-free) is superseded by spec §7.1's sourced wording, from merge. Confirm.
16. **The protected-store allowlist** (`api/_utils/compositionProtectedStoresAllowlist.json`) gains one key: `retire.js::retireLeftBook::call:retireCallDirective#1::unresolved` (count 1), the retire step's one compare-and-clear of `agentBattles/{battleId}.directive`, never a composition-protected store. Its `_notes_cockpit_build2b` HUMAN REVIEW note asks for your sign-off.

**For separate tasking (found, not fixed — BUILD_RULES §3):**
- `api/cron/agent-evaluate.js:6787-6790` (at `d7b0566f`): the gameplan meeting's expiry uses `setHours(16)` in host time, which is noon ET on a UTC host. This is a hand-rolled ET bug (BUILD_RULES §6).
- `AssetResearchModal` has no focus or Escape handling. The bench sheet now defers to it, but the modal itself traps nothing.

---

## 12. Where things are

- **Branch:** `claude/cockpit-build2b`; its PR opens with the Hold line.
- **Smoke:** `claude/cockpit-build2b-smoke` (never merged).
- **This report's out-of-repo copy:** `C:\Users\fashr\Documents\FantasyTrades\Cockpit\20261021_BUILD2B_COCKPIT.md`.
- **The review's working record** (lens texts and verifier verdicts) and the anchor tables were session scratch files. Their content is folded into §3, §8 and Appendix A.

---

## Appendix A — every anchor that differed (d5d8fa9b → 0fc78b02)

Method:
- I compared each anchor's lines at both commits, ignoring whitespace.
- Where they differed, I located the text two independent ways, an exact text search and a line mapping through the `git diff -U0` hunks. The two agree on every row.
- Bare continuations (`:N`) take the file named just before them.
- Comma lists are split.
- `chat.js:137/:324/:332` are `api/screener/chat.js`.
- `flip.js:234` is `api/tournament/flip.js`.

**How far lines moved, per file:** `agent-evaluate.js` +15 to +209 · `AgentBattleScreen.jsx` +2 to +42 · `App.jsx` +57 · `agentEvalTransport.js` +16 to +18 · `agentEvalPromptAssembly.js` +6 to +18 · `TacticalRow.jsx` +3 to +19 · `featureFlags.js` +12 · `voiceLayerPrompt.js` +3 to +11 · `agentSwapExecution.js` +6 · `agent-daily-scores.js` +5 · `api/agent/chat.js` 0 to +4 · `agentRiskManager.js` 0 to +3 · `tickStamps.js` +3 · `agentBattleService.js` +2. Every other cited file is byte-identical at the cited lines.

| Anchor (as cited) | Cited in | At d5d8fa9b (short quote) | At 0fc78b02 | Status |
|---|---|---|---|---|
| `api/_utils/agentBattleService.js:284` | L201 | `chatBudgetUsed: 0, // Chat exchanges used this battle` | same text :286 (+2) | MOVED → :286 |
| `api/_utils/agentEvalPromptAssembly.js:1234-1242` | L253 | `directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : ...` | same text :1240-1248 (+6) | MOVED → :1240-1248 |
| `api/_utils/agentEvalPromptAssembly.js:1459-1466` (bare) | L244 | `// P4: flat6 battles drop the Tier column — the eval model must never be` | same text :1469-1476 (+10) | MOVED → :1469-1476 |
| `api/_utils/agentEvalPromptAssembly.js:1495` | L244 | `const header = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,AT...` | same text :1513 (+18) | MOVED → :1513 |
| `api/_utils/agentEvalPromptAssembly.js:1505-1510` (bare) | L244 | `let status = 'available';` | same text :1523-1528 (+18) | MOVED → :1523-1528 |
| `api/_utils/agentEvalPromptAssembly.js:1535-1586` (bare) | L244 | `export function buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap) {` | same text :1553-1604 (+18) | MOVED → :1553-1604 |
| `api/_utils/agentEvalTransport.js:14` | L147 | `export const HAIKU_CALL_CEILING_MS = 22_000;` | :30 'HAIKU_CALL_CEILING_MS = HAIKU_SDK_TIMEOUT_MS + HAIKU_BACKSTOP_MARGIN_MS;' | CHANGED → :30 (now derived = 42,000 ms (:21 SDK 40_000, :29 margin 2_000)) |
| `api/_utils/agentEvalTransport.js:15` | L149 | `export const HAIKU_POST_CALL_ALLOWANCE_MS = 12_000;` | same text :31 (+16) | MOVED → :31 |
| `api/_utils/agentEvalTransport.js:36` | L148 | `export const PROMPT_BUILD_CEILING_MS = 10_000;` | same text :52 (+16) | MOVED → :52 |
| `api/_utils/agentEvalTransport.js:178-189` | L151 | `export function shouldStartHaikuCall({` | same text :196-207 (+18) | MOVED → :196-207 (text same; sum now 10,000+42,000+12,000+4,000 = 68,000 ms at on) |
| `api/_utils/agentRiskManager.js:168` (list) | L223 | `reason: 'stepped_trail',` | same text :171 (+3) | MOVED → :171 |
| `api/_utils/agentRiskManager.js:189` (list) | L223 | `reason: 'stagnation',` | same text :192 (+3) | MOVED → :192 |
| `api/_utils/agentSwapExecution.js:403` (bare) | L218 | `...evaluationMetadata,` | same text :409 (+6) | MOVED → :409 |
| `api/_utils/agentSwapExecution.js:489` (bare) | L218 | `const trades = [...(liveData.trades \|\| []), closedTrade].slice(-50);` | same text :495 (+6) | MOVED → :495 |
| `api/_utils/agentSwapExecution.js:493` | L218 | `['portfolio.${resolvedTier}']: newTier,` | same text :499 (+6) | MOVED → :499 |
| `api/_utils/agentSwapExecution.js:497` (bare) | L218 | `trades,` | same text :503 (+6) | MOVED → :503 |
| `api/_utils/agentSwapExecution.js:502` (bare) | L218 | `transaction.update(battleRef, updates);` | same text :508 (+6) | MOVED → :508 |
| `api/_utils/directiveWriter.js:192-197` | L212 | (no such line; the file has 145 lines) | past EOF (same file, unchanged) | INVALID AT SOURCE (the supersedes stamp is :89-90) |
| `api/_utils/directiveWriter.js:239-241` (bare) | L212 | (no such line; the file has 145 lines) | past EOF (same file, unchanged) | INVALID AT SOURCE (stamp :89-90 / fresh stamp :123-124) |
| `api/_utils/directiveWriter.js:261` (bare) | L212 | (no such line; the file has 145 lines) | past EOF (same file, unchanged) | INVALID AT SOURCE (the in-tx superseded event is :111) |
| `api/_utils/directiveWriter.js:268-295` | L212 | (no such line; the file has 145 lines) | past EOF (same file, unchanged) | INVALID AT SOURCE (the tx-null re-read at commit is :117-145) |
| `api/_utils/tickStamps.js:366-367` | L246 | `const candidates = composeCandidatesStamp(anticipationCandidates);` | same text :369-370 (+3) | MOVED → :369-370 |
| `api/_utils/voiceLayerPrompt.js:1121` | L276 | `export function buildBattleState(battle, { grounded = false } = {}) {` | same text :1124 (+3) | MOVED → :1124 |
| `api/_utils/voiceLayerPrompt.js:1142-1143` (bare) | L276 | `const currentScore = battle.scoreState?.currentScore ?? 0;` | :1150-1151 'const currentScore = shownScores.currentScore ?? 0;' | CHANGED → :1150-1151 (scores now from displayedStockScores(battle) (:1148), not scoreState) |
| `api/_utils/voiceLayerPrompt.js:1156` (bare) | L276 | `- Score: You ${currentScore} — Opponent ${opponentScore} (${currentScore > op...` | :1164 '- Score: ${scoresUnavailable ? 'unavailable — …' : 'You ${currentScore} …'}' | CHANGED → :1164 (Score line gains a scoresUnavailable branch) |
| `api/_utils/voiceLayerPrompt.js:3249` (bare) | L276 | `const battleState = buildBattleState(battle, { grounded });` | same text :3260 (+11) | MOVED → :3260 |
| `api/_utils/voiceLayerPrompt.js:3326` (bare) | L276 | `blocks.push(battleState); // Block 5 (BOTTOM)` | same text :3337 (+11) | MOVED → :3337 |
| `api/_utils/voiceLayerPrompt.js:3708` (bare) | L253 | `if (!isDirectiveActive(directive, battle)) return null;` | same text :3719 (+11) | MOVED → :3719 |
| `api/_utils/voiceLayerPrompt.js:3735` (bare) | L253 | `directive, // battle.directive — surfaced into a MIDDLE block when active (ex...` | same text :3746 (+11) | MOVED → :3746 |
| `api/agent/chat.js:794` (bare) | L275 | `rawResponse = await callGemmaVoice({` | same text :798 (+4) | MOVED → :798 |
| `api/agent/chat.js:1108` | L212 | `await fileDirectiveTransactional(null, battleRef, {` | same text :1112 (+4) | MOVED → :1112 |
| `api/agent/chat.js:1121` (bare) | L205, L277 | `...(!isLeagueAsk ? { [budgetField]: FieldValue.increment(1) } : {}),` | same text :1125 (+4) | MOVED → :1125 |
| `api/cron/agent-daily-scores.js:175` | L229 | `portfolio: updatedPortfolio,` | same text :180 (+5) | MOVED → :180 |
| `api/cron/agent-daily-scores.js:194` (bare) | L229 | `await battleRef.update(updates);` | same text :199 (+5) | MOVED → :199 |
| `api/cron/agent-evaluate.js:202` (bare) | L153 | `export const config = { maxDuration: 300 };` | same text :217 (+15) | MOVED → :217 |
| `api/cron/agent-evaluate.js:205` (bare) | L155 | `const EVALUATING_LOCK_TIMEOUT_MS = 120_000; // 2 minutes` | same text :220 (+15) | MOVED → :220 |
| `api/cron/agent-evaluate.js:206` | L152, L161 | `const TIME_BUDGET_MS = 290_000; // 290s — leave 10s buffer under the 300s max...` | same text :221 (+15) | MOVED → :221 |
| `api/cron/agent-evaluate.js:211-219` (bare) | L156 | `// maxRetries: 0 — deliberate deviation from the codebase's maxRetries: 2` | :226-234 same comment, now '(HAIKU_SDK_TIMEOUT_MS, 40s) ≈ 120s per battle' | CHANGED → :226-234 (maxRetries: 0 itself unchanged (:245)) |
| `api/cron/agent-evaluate.js:446-447` (bare) | L154 | `const elapsed = Date.now() - startTime;` | same text :467-468 (+21) | MOVED → :467-468 (the `for` line is :445 → :466) |
| `api/cron/agent-evaluate.js:550` (bare) | L153 | `const HARD_CEILING_MS = config.maxDuration * 1000;` | same text :571 (+21) | MOVED → :571 |
| `api/cron/agent-evaluate.js:745-746` (bare) | L218 | `// P2: phase 1 of the two-phase swap protocol, shared by all five` | same text :766-767 (+21) | MOVED → :766-767 |
| `api/cron/agent-evaluate.js:893` | L162 | `// The tick's wall time starts HERE, at admission: the lock is held and the` | same text :930 (+37) | MOVED → :930 |
| `api/cron/agent-evaluate.js:983` | L201 | `if (battle.chatBudgetUsed === undefined) migrationFields.chatBudgetUsed = 0;` | same text :1020 (+37) | MOVED → :1020 |
| `api/cron/agent-evaluate.js:1748` | L253 | `directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : ...` | same text :1845 (+97) | MOVED → :1845 |
| `api/cron/agent-evaluate.js:1989` (bare) | L223 | `const swapSource = riskResult.reason === 'stagnation' ? 'archetype' : 'risk_m...` | same text :2091 (+102) | MOVED → :2091 |
| `api/cron/agent-evaluate.js:1998` (bare) | L223 | `trigger: riskResult.reason,` | same text :2100 (+102) | MOVED → :2100 |
| `api/cron/agent-evaluate.js:2007` (bare) | L223 | `evaluationId: 'risk_${riskResult.reason}_${score.symbol}_${Date.now()}',` | same text :2109 (+102) | MOVED → :2109 |
| `api/cron/agent-evaluate.js:2014` (bare) | L223 | `exitReason: riskResult.reason,` | same text :2116 (+102) | MOVED → :2116 |
| `api/cron/agent-evaluate.js:2071` (bare) | L223 | `riskSwapResult = await executeSwapServer(` | same text :2173 (+102) | MOVED → :2173 |
| `api/cron/agent-evaluate.js:2264` (bare) | L231 | `refreshed = await refreshBattleFromDoc(battleRef, battle, tournamentCtx);` | same text :2367 (+103) | MOVED → :2367 |
| `api/cron/agent-evaluate.js:2464` (bare) | L225 | `if (callsActive(callsCtx.mode)) await callsStepAsync(callsCtx, () => runExitC...` | same text :2573 (+109) | MOVED → :2573 |
| `api/cron/agent-evaluate.js:2546` (bare) | L225 | `if (callsActive(callsCtx.mode)) await callsStepAsync(callsCtx, () => runExitC...` | same text :2692 (+146) | MOVED → :2692 |
| `api/cron/agent-evaluate.js:2744` | L151 | `const budget = shouldStartHaikuCall({ elapsedMs: Date.now() - cronStartTime, ...` | same text :2903 (+159) | MOVED → :2903 (requirement now 68,000 ms at shadow/on (comment :2900-2902)) |
| `api/cron/agent-evaluate.js:2759-2782` (bare) | L151 | `} else if (!budget.proceed) {` | same text :2918-2941 (+159) | MOVED → :2918-2941 |
| `api/cron/agent-evaluate.js:2831-2840` | L148 | `const built = await Promise.race([` | same text :2991-3000 (+160) | MOVED → :2991-3000 |
| `api/cron/agent-evaluate.js:2853` | L248 | `heldSymbols: assetScores.map((s) => s.symbol),` | same text :3013 (+160) | MOVED → :3013 |
| `api/cron/agent-evaluate.js:2856` (bare) | L223 | `replacedSymbols: Object.keys(forcedEntryPrices),` | same text :3016 (+160) | MOVED → :3016 |
| `api/cron/agent-evaluate.js:2866` (bare) | L161 | `// AbortController is a defense-in-depth backstop 2s above it.` | same text :3027 (+161) | MOVED → :3027 |
| `api/cron/agent-evaluate.js:2876` | L147 | `hardAbort = setTimeout(() => abortCtrl.abort(), HAIKU_CALL_CEILING_MS);` | same text :3037 (+161) | MOVED → :3037 (HAIKU_CALL_CEILING_MS now 42,000) |
| `api/cron/agent-evaluate.js:2902` | L146 | `}, { timeout: 20_000, signal: abortCtrl.signal });` | :3063 '}, { timeout: HAIKU_SDK_TIMEOUT_MS, signal: abortCtrl.signal });' | CHANGED → :3063 (literal 20_000 replaced by the import; HAIKU_SDK_TIMEOUT_MS = 40_000 at agentEvalTransport.js:21) |
| `api/cron/agent-evaluate.js:3608` (bare) | L222 | `const swapSource = haikuSwapReason === 'haiku_decision' ? 'haiku' : 'guardrail';` | same text :3769 (+161) | MOVED → :3769 |
| `api/cron/agent-evaluate.js:3614` (bare) | L222 | `trigger: triggers.map(t => t.type).join(', '),` | same text :3775 (+161) | MOVED → :3775 |
| `api/cron/agent-evaluate.js:3617` (bare) | L222 | `evaluationId: evalId,` | same text :3778 (+161) | MOVED → :3778 |
| `api/cron/agent-evaluate.js:3627` (bare) | L222 | `exitReason: haikuSwapReason,` | same text :3788 (+161) | MOVED → :3788 |
| `api/cron/agent-evaluate.js:3713` (bare) | L222 | `swapResult = await executeSwapServer(` | same text :3874 (+161) | MOVED → :3874 |
| `api/cron/agent-evaluate.js:3726` (bare) | L222 | `callsStep(callsCtx, () => carryExecutorResult(callsCtx, swapResult));` | same text :3887 (+161) | MOVED → :3887 |
| `api/cron/agent-evaluate.js:4162` (bare) | L162 | `// tickMs — admission (the lock) → the authoritative final update.` | same text :4325 (+163) | MOVED → :4325 |
| `api/cron/agent-evaluate.js:4280` (bare) | L253 | `directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : ...` | same text :4443 (+163) | MOVED → :4443 |
| `api/cron/agent-evaluate.js:4309` | L246 | `anticipationCandidates: lintedAnticipationCandidates,` | same text :4472 (+163) | MOVED → :4472 |
| `api/cron/agent-evaluate.js:4605-4606` (bare) | L222 | `const callsPhase = !callsActive(callsCtx.mode) ? undefined : await callsStepA...` | same text :4777-4778 (+172) | MOVED → :4777-4778 |
| `api/cron/agent-evaluate.js:4966` (bare) | L227 | `if (LAUNCH_EXECUTION_MODE === 'autopilot') {` | same text :5146 (+180) | MOVED → :5146 |
| `api/cron/agent-evaluate.js:5063` (bare) | L227 | `approvedSwapResult = await executeSwapServer(` | same text :5243 (+180) | MOVED → :5243 |
| `api/cron/agent-evaluate.js:5337` (bare) | L227 | `expiredSwapResult = await executeSwapServer(` | same text :5518 (+181) | MOVED → :5518 |
| `api/cron/agent-evaluate.js:5736-5748` (bare) | L225 | `trigger: deterministicExitReason,` | same text :5918-5930 (+182) | MOVED → :5918-5930 |
| `api/cron/agent-evaluate.js:5796` (bare) | L225 | `passSwapResult = await executeSwapServer(` | same text :5978 (+182) | MOVED → :5978 |
| `api/cron/agent-evaluate.js:5937` (bare) | L231 | `await refreshBattleFromDoc(battleRef, battle, tournamentCtx);` | same text :6120 (+183) | MOVED → :6120 |
| `api/cron/agent-evaluate.js:6064` (bare) | L226 | `for (const { index: legIndex, leg: swap, run } of planApprovedLegs(meeting, m...` | same text :6247 (+183) | MOVED → :6247 |
| `api/cron/agent-evaluate.js:6155` (bare) | L226 | `gameplanSwapResult = await executeSwapServer(` | same text :6338 (+183) | MOVED → :6338 |
| `api/cron/agent-evaluate.js:6159-6166` (bare) | L226 | `executorMetadata({ id: tradeId, action: 'SWAP', trigger: 'gameplan_rotation',...` | same text :6342-6349 (+183) | MOVED → :6342-6349 |
| `api/cron/agent-evaluate.js:6292` (bare) | L231 | `await refreshBattleFromDoc(battleRef, battle, tournamentCtx);` | same text :6476 (+184) | MOVED → :6476 |
| `api/cron/agent-evaluate.js:6767` (bare) | L229 | `status: 'completed',` | same text :6976 (+209) | MOVED → :6976 |
| `src/App.jsx:9777` | L261 | `if (screen === 'search') {` | same text :9834 (+57) | MOVED → :9834 |
| `src/App.jsx:10141` (bare) | L261 | `{user && !isMobile && !GAMEPLAY_SCREENS.includes(screen) && screen !== 'home'...` | same text :10198 (+57) | MOVED → :10198 |
| `src/App.jsx:12418` (bare) | L261 | `{user && isMobile && screen !== 'home' && !GAMEPLAY_SCREENS.includes(screen) ...` | same text :12475 (+57) | MOVED → :12475 |
| `src/components/BaggerBomb/TacticalRow.jsx:64` | L269 | `function AssetSide({` | same text :67 (+3) | MOVED → :67 |
| `src/components/BaggerBomb/TacticalRow.jsx:418` (bare) | L269 | `&lt;div` | same text :436 (+18) | MOVED → :436 |
| `src/components/BaggerBomb/TacticalRow.jsx:441` (bare) | L269 | `{symbol}` | same text :459 (+18) | MOVED → :459 |
| `src/components/BaggerBomb/TacticalRow.jsx:699` | L269 | `export default function TacticalRow({` | same text :718 (+19) | MOVED → :718 |
| `src/components/BaggerBomb/TacticalRow.jsx:792` (bare) | L269 | `&lt;AssetSide` | same text :811 (+19) | MOVED → :811 |
| `src/components/BaggerBomb/TacticalRow.jsx:818` (bare) | L269 | `&lt;AssetSide` | same text :837 (+19) | MOVED → :837 |
| `src/config/featureFlags.js:2420` | L264 | `export const SHOW_IT_ENABLED = false;` | same text :2432 (+12) | MOVED → :2432 |
| `src/config/featureFlags.js:2435-2436` (bare) | L264 | `export function isShowItOn() {` | same text :2447-2448 (+12) | MOVED → :2447-2448 |
| `src/screens/AgentBattleScreen.jsx:90` | L205 | `import { BATTLE_CHAT_BUDGET } from '../../api/_utils/directiveFiling.js';` | same text :92 (+2) | MOVED → :92 |
| `src/screens/AgentBattleScreen.jsx:975` | L264 | `const showItOn = isShowItOn();` | same text :1003 (+28) | MOVED → :1003 |
| `src/screens/AgentBattleScreen.jsx:984` (bare) | L239 | `const now = useCoarseNow(controllerOn);` | same text :1012 (+28) | MOVED → :1012 |
| `src/screens/AgentBattleScreen.jsx:1169` (bare) | L270 | `const cockpitUiOn = isCockpitUiOn();` | same text :1197 (+28) | MOVED → :1197 |
| `src/screens/AgentBattleScreen.jsx:1170` (bare) | L270 | `const cockpitStatus = useCockpitStatus(agentBattleId, {` | same text :1198 (+28) | MOVED → :1198 |
| `src/screens/AgentBattleScreen.jsx:1176` (bare) | L270 | `const cockpitOn = cockpitUiOn && cockpitStatus.on;` | same text :1204 (+28) | MOVED → :1204 |
| `src/screens/AgentBattleScreen.jsx:1180` (bare) | L270 | `const cockpitCallsRead = useCalls(agentBattleId, cockpitOn);` | same text :1208 (+28) | MOVED → :1208 |
| `src/screens/AgentBattleScreen.jsx:1181` (bare) | L270 | `const cockpitMonitoringRead = useMonitoring(agentBattleId, cockpitOn);` | same text :1209 (+28) | MOVED → :1209 |
| `src/screens/AgentBattleScreen.jsx:1182` (bare) | L270 | `const cockpitEventsRead = useCallEvents(agentBattleId, cockpitOn);` | same text :1210 (+28) | MOVED → :1210 |
| `src/screens/AgentBattleScreen.jsx:1750-1756` | L259 | `const handleSymbolClick = useCallback((payload) => {` | same text :1781-1787 (+31) | MOVED → :1781-1787 |
| `src/screens/AgentBattleScreen.jsx:2007` (bare) | L264 | `const handleShowIt = useCallback(async (symbol) => {` | same text :2038 (+31) | MOVED → :2038 |
| `src/screens/AgentBattleScreen.jsx:2020` (bare) | L264 | `const res = await fetch('/api/agent/research', {` | same text :2051 (+31) | MOVED → :2051 |
| `src/screens/AgentBattleScreen.jsx:2481-2489` | L214, L270 | `const thisTurnDirective = agentBattle?.directive?.family !== 'call'` | same text :2512-2520 (+31) | MOVED → :2512-2520 |
| `src/screens/AgentBattleScreen.jsx:2520` | L239 | `const cockpitNowMs = now instanceof Date ? now.getTime() : Date.now();` | same text :2551 (+31) | MOVED → :2551 |
| `src/screens/AgentBattleScreen.jsx:2525-2526` (bare) | L270 | `const cockpitFeed = useMemo(() => (cockpitOn ? buildCockpitFeed({` | same text :2556-2557 (+31) | MOVED → :2556-2557 |
| `src/screens/AgentBattleScreen.jsx:2625` (bare) | L203 | `topRow={isDesktop ? {` | same text :2656 (+31) | MOVED → :2656 |
| `src/screens/AgentBattleScreen.jsx:2625-2633` | L203 | `topRow={isDesktop ? {` | same text :2656-2664 (+31) | MOVED → :2656-2664 |
| `src/screens/AgentBattleScreen.jsx:2788` (bare) | L270 | `const boardRows = (` | same text :2830 (+42) | MOVED → :2830 |
| `src/screens/AgentBattleScreen.jsx:2788-2799` | L269 | `const boardRows = (` | :2830-2841 'const boardRows = (' … '&lt;StockDispatchRow' | CHANGED → :2830-2841 (rows now created as StockDispatchRow (wrapper at :197 that renders TacticalRow)) |
| `src/screens/AgentBattleScreen.jsx:2803` (bare) | L269 | `tier={tier.key}` | same text :2845 (+42) | MOVED → :2845 |
| `src/screens/AgentBattleScreen.jsx:2806` (bare) | L269 | `onSymbolClick={gatedPath ? handleGatedSymbolClick : handleSymbolClick}` | same text :2848 (+42) | MOVED → :2848 |
| `src/screens/AgentBattleScreen.jsx:2810` (bare) | L270 | `{...(gatedPath ? { reportClickSide: true } : {})}` | same text :2852 (+42) | MOVED → :2852 |
| `src/screens/AgentBattleScreen.jsx:2818` (bare) | L270 | `{...(controllerOn ? { showCurrentPrice: true } : {})}` | same text :2860 (+42) | MOVED → :2860 |
| `src/screens/AgentBattleScreen.jsx:2826` (bare) | L270 | `{...(paneOn ? {` | same text :2868 (+42) | MOVED → :2868 |
| `src/screens/AgentBattleScreen.jsx:2917` | L214 | `&lt;AgentChat` | same text :2959 (+42) | MOVED → :2959 |
| `src/screens/AgentBattleScreen.jsx:2937` | L214 | `currentDirectiveThreadId={agentBattle?.directive?.directiveThreadId ?? null}` | same text :2979 (+42) | MOVED → :2979 |
| `src/screens/AgentBattleScreen.jsx:3466` (bare) | L269 | `board={&lt;div data-phone-board="1" style={{ paddingBottom: AVATAR_CLEARANCE_PX ...` | same text :3508 (+42) | MOVED → :3508 |
| `src/screens/AgentBattleScreen.jsx:3485` (bare) | L269 | `{boardRows}` | same text :3527 (+42) | MOVED → :3527 |
| `src/screens/AgentBattleScreen.jsx:3643` (bare) | L269 | `{boardRows}` | same text :3685 (+42) | MOVED → :3685 |
| `src/screens/AgentBattleScreen.jsx:3665` (bare) | L214 | `&lt;AgentChat` | same text :3707 (+42) | MOVED → :3707 |
| `src/screens/AgentBattleScreen.jsx:3849-3850` (bare) | L259 | `) : stableResearchAsset && (` | same text :3891-3892 (+42) | MOVED → :3891-3892 |
| `src/screens/battleView/battleViewCopy.js:1101-1102` | L238 | `// is (ruling R2A-5: filed, heard, agreed).` | same lines | SAME (off by one at source: the two tags are :1102-1103) |
| `src/screens/battleView/battleViewCopy.js:1111` | L212 | `'event:ended_with_battle': Object.freeze({ tone: 'muted', text: () => 'Battle...` | same lines | SAME (wrong at source: 'Replaced by a later instruction' is :1113) |

125 rows: 113 MOVED · 6 CHANGED · 4 INVALID AT SOURCE · 2 SAME but cited wrong at the source. The other 208 anchors are SAME and match their cited lines.
