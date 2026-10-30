# Build — Reset of the failure-built wisdom paragraphs (package P-RESET)

**Date:** 30 Oct 2026 · **Base:** `main` `f7be7f1b` (#1014) · **Branch:** `claude/insight-reset` (the app's worktree branch `claude/reset-wisdom-paragraphs-ca1d5f`, pushed by refspec) · **Status:** built, **not run**. Draft PR, STOP.
**Rulings:** R1 (reset at a week boundary), R2 (lessons and history stay), R3 (the dossier goes with the paragraph), all 14 Oct 2026.
**Nothing was written to Firestore.** The only production access was read-only (§12).

---

## 1. In plain terms

| Question | Answer |
|---|---|
| Is the script built? | **Yes.** `scripts/reset-failure-built-insight.mjs`: `census`, `plan`, `apply`, `restore`. |
| Has the reset run? | **No.** You run it from the main checkout on the first Saturday or Sunday after this PR is merged. |
| Is it tested? | **Yes.** 84 test rows, 155 of 155 mutants killed, the full Linux suite green, and the whole cycle run on the real database software in a local emulator. Independent review: no blocker. |
| Is the census what the brief expected? | **No.** 13 agents are in the set, not 14, and 3 hold a paragraph outside it. See below. |
| Does anything in the brief not hold at HEAD? | **Yes, one statement:** the record sheet's discipline count does **not** drop to zero. See below. |
| What do you need to do? | Sign off the allowlist entries (§7), merge, then follow the weekend run below. |

### What the reset changes

For every agent in the set, in one write per agent:

- **The paragraph goes.** `consolidatedInsight` becomes empty, which is what a new agent has.
- **The dossier goes with it.** `disciplines` is removed, because a new agent has no such field at all (§5).
- **The "consolidation pending" flag clears.** `pendingConsolidation` becomes false.
- **Two stamps go on.** `consolidatedInsightResetAt` (the run's time) and `consolidatedInsightResetReason: 'failure_built'`, so the run can be undone and is visible later.

### What it leaves

Lessons on the record sheet, the memory window, the evolution timeline, the cycle count, `lastConsolidatedGamesPlayed`, stats, and every other field. Copies frozen on past battles are history and stay. An agent whose paragraph does not match the rule is never touched.

### The census at build time

Read 30 Oct 2026, 15:26 UTC, a Friday during the trading day. Counts only.

| | Now | Brief (10 Oct census) |
|---|---|---|
| Agents | 104 | 99 |
| Holding a paragraph | **16** | 14 |
| In the set | **13** | 14 |
| By rule (a), the `""` string | 1 | 1 |
| By rule (b), names the failure | **12** | 13 |
| Outside the set | **3** | 0 |
| Clones / non-clones in the set | 11 / 2 | |
| `pendingConsolidation: true` in the set | 1 | 2 in all |
| Holding a dossier in the set | 12 | |
| With an active battle in the set | 1 | |
| `gamesPlayed` in the set | 12 agents at 0, 1 agent at 35 | |

**What the ranked parent of each of the 11 clones holds:** 5 a paragraph in the set, 6 a paragraph outside the set, none empty or missing. 3 of the 11 hold the same paragraph as their parent.

**Why the numbers moved** (a second counts-only read, §12). The rewrite has run twice since the fix of 14 Oct, on two non-clone agents, 15 and 8 days ago. Each now holds a new paragraph that does not name the failure, so the rule leaves it alone. The third outside the set is a clone copying one of those two. The agent rewritten 8 days ago is at cycle 9, one past the 8 recorded on 10 Oct, so by that count it is one of the two agents that held a failure paragraph then, which would make the set one smaller. The agent rewritten 15 days ago is at cycle 1, a new holder. The 6 clones above are clones of those two agents, still carrying older copies: 5 training clones and 1 casual clone. The reset empties them. The casual one takes its parent's new paragraph at its next deploy; training clones do not re-sync, so those 5 stay empty.

**One thing to know about those 3.** The rewrite reads the agent's previous paragraph and dossier as its starting point (`agentConsolidationPrompt.js:128-136`). So those two new paragraphs were built from real lessons, but on top of the failure-built text. The rule you ruled on leaves them. If you want them gone too, that is a new ruling (FQ-3).

**Live battles today.** 5 battles were active, all created today and all ending today, and no agent's pointer was stale. So `apply` would have refused today, for 6 agents: one family with one active battle. Nothing is stuck. Your first command on the weekend shows this count.

A second `census`, 50 minutes later on the final code, gave the same numbers.

### What differs from the brief

| # | Brief | What I built or found | Why |
|---|---|---|---|
| 1 | "14 of 14 holders" | 13 of 16 (above) | The rewrite ran after the census |
| 2 | "The record sheet's discipline count drops to zero" | **It does not.** The only discipline numbers on the sheet are the "N sel / N exec" badges on timeline rows. They are a record of each past rewrite, stored in the timeline, which R2 keeps. No screen reads `agent.disciplines`. | `AgentRecordSheet.jsx:141-145`; nothing in `src/` reads the field (grep) |
| 3 | `disciplines`: "the creation-time empty value" | The field is **removed**, not set to an empty object | Neither creation site writes it (§5) |
| 4 | `apply --plan <file> --go` | `apply` also needs **`--plan-sha256 <hash>`** | A hash stored beside the file would prove nothing. You carry it from `plan`'s output. |
| 5 | Battle guard: an active battle or `activeBattleId` | Also a deploy within two minutes (`deployingAt` or `lastDeployedAt`), and a re-check inside each write | A deploy in flight is a battle about to start. Stricter than the brief, never looser. |
| 6 | Restore: paragraph still `''`, stamp equals the run's | Also skips an agent holding a dossier again | A rewrite can land an empty paragraph with a new dossier (review IR-7). Stricter than the brief. |
| 7 | Per-agent compare: the paragraph's hash | Also the rule, and every backed-up field | So what `restore` writes back is what was really there. Stricter than the brief. |
| 8 | The two documents "attached" | They were not in the message. I took them from `Downloads` by their exact names. | Their SHA-256 values are in `docs/README.md`. If those are not the files you meant, tell me. |

### The weekend run

From the main checkout, on `main`, after this PR is merged. Each command prints counts only, never an id or an agent's words, so everything below is safe to paste back.

**The best time is Sunday, before 8 AM Eastern.** Any weekend time works, but the reflection cron is off then and Friday's queue has drained, so no rewrite can cross the reset (§11, IR-1). Run step 1 on Saturday morning to see what is holding.

**1. Look first.**

```bash
node scripts/reset-failure-built-insight.mjs census
```

Check two lines. `In the set` should be near 13. `apply would refuse for:` must read **0**. If it does not, a battle or a deploy is live: wait and run this again. A deploy made late on Friday or over the weekend stays active until Monday's close, so if the count does not fall, the run moves to the next weekend. Nothing is harmed by waiting.

**2. Make the plan.**

```bash
node scripts/reset-failure-built-insight.mjs plan
```

It writes one file on your machine, outside the repo, and prints three lines.
**Bring back:** the `In the set` line and the `Plan SHA-256` line. Keep the `Plan written:` path for step 3.

**3. Run the reset.** Paste the path and the hash from step 2. The quotes stay.

```bash
node scripts/reset-failure-built-insight.mjs apply --plan "<the path>" --plan-sha256 <the hash> --go
```

It refuses, and changes nothing, if: the plan file changed; it is not a Saturday or Sunday in New York; a battle is live on an agent in the plan, its ranked parent, or a clone of it; or the composition write epoch is closed. Otherwise it writes the backup, confirms it, prints the backup's path, then resets each agent.
**Bring back:** everything it prints. A clean run says `Clean run.` and shows `skipped=0 ... errors=0 not attempted=0`. **Keep the `Backup:` path.** It is the only way back.

**4. Confirm.** Do this straight away.

```bash
node scripts/reset-failure-built-insight.mjs census
```

**Bring back:** three numbers. `In the set` should read **0**. `already reset` should equal `written` from step 3. `Reset, then given a paragraph again` should read **0**. A clean `apply` cannot see a rewrite or a clone that lands after it; this step can.

**If `apply` was not clean, or step 4 is off,** stop and bring back what it printed. Skipped agents are unchanged. You can run `plan` and `apply` again: agents already reset drop out of the plan.

**To undo.** Paste the `Backup:` path from step 3.

```bash
node scripts/reset-failure-built-insight.mjs restore --backup "<the backup path>" --go
```

It restores only agents still empty and still carrying that run's stamp, and reports the rest as skipped. An agent that has earned a new paragraph since keeps it. If you ran `apply` twice, each run has its own backup, and each is restored on its own.

---

## 2. Gate facts (BUILD_RULES §2, §3)

- **Session open:** branch `claude/reset-wisdom-paragraphs-ca1d5f`, HEAD `f7be7f1b`, clean tree. `git fetch origin` first; `origin/main` = `f7be7f1b`. The prompt's `claude/insight-reset` is pushed by refspec: the app suffixes its worktree branch.
- **Fence:** no fenced file is edited or called.
- **Product code:** none changed. The diff is the script, its tests, three JSON registries, one line in `docs/composition/EXTERNAL_ADMIN_WRITE_PATHS.md`, two founder documents, this report and `docs/README.md`.
- **Documents:** copied from `C:/Users/fashr/Downloads`, committed byte-identical. `git show HEAD:<path> | sha256sum` gives `24540426…1eca` (concept V3) and `fe4dd57b…73e5` (Amendment A), the same as the source files. A third copy of the amendment found on this machine has the same hash.
- **`settingsRev`:** not bumped, and rightly. `consolidatedInsight` is on the client's guarded list (`agentService.js:203`), but the one existing writer of the field, the consolidation apply, does not bump it either (`agentConsolidationApply.js:291-299`, `:322-330`).
- **`updatedAt`:** not written. The brief lists the write as five fields "and nothing else".

## 3. The selection rule (VERIFIED at `scripts/reset-failure-built-insight.mjs`)

Pre-declared in the script's header and here. An agent is in the set when `consolidatedInsight` is a non-empty string and either (a) it is exactly the two characters `""`, or (b) it matches both `/reflection/i` and `/fail/i`. A paragraph matching neither is listed and never touched: counted by `census`, and listed with its id in `plan.local.json` under `outsideSet`, which `apply` never reads.

## 4. How the script is built

Anchors are lines of `scripts/reset-failure-built-insight.mjs`, VERIFIED at the code head.

| Piece | What it does | Anchor |
|---|---|---|
| The rule | `selectionRule`: returns `a`, `b` or nothing | `:99` |
| The reads | The whole `agents` collection by `select`, and the active battles | `:157`, `:162` |
| `census` | Counts only. Also previews a refusal (`apply would refuse for`) and shows a stamp under a paragraph. | `:170`, `:241` |
| `plan` | Writes `plan.local.json` in a new `insight-reset-<time>/` folder, prints the counts and the hash | `:274` |
| The refusals, in order | `--go`; the plan hash, its form and its contents; the weekend; the family battle guard; the write epoch | `:383` onward, `:303` |
| The backup | Written exclusively, forced to disk, read back and hash-compared, before any write. The path prints before the first write. | `:358`, `:404` |
| One agent's write | `resetOneAgent`, one transaction | `:324-356` |
| `restore` | `restoreOneAgent`, one transaction per backed-up agent | `:435-453`, `:470` |
| The command line | Refuses a typo or a missing value rather than guessing | `:511` |
| Credentials | Only inside `main()`, through `loadLocalEnv.js`, with its one-line message | `:532` onward |

**Inside each write, in order.** The agent is missing: skip. It carries this run's own stamp: count it as written (the commit landed and the transaction ran again). It is already reset by an earlier run: no-op. The paragraph's hash is not the plan's: skip. The paragraph no longer meets the rule: skip. Any backed-up field differs from the backup: skip. A battle pointer, a deploy inside its window, or an active battle has appeared: skip, counted separately. Only then the five-field write. The caller counts each outcome after the transaction settles, because a contended transaction runs again.

**A run folder is never shared.** Each `plan` and each `apply` makes its own folder, created exclusively, and files open exclusive-create. So a re-run can never overwrite a backup.

**Exit code.** Anything but a clean run exits 1.

## 5. The creation-time value of `disciplines` (VERIFIED at `f7be7f1b`)

| Site | What it writes | Anchor |
|---|---|---|
| `createAgent` | `consolidatedInsight: ''`, and no `disciplines` key | `src/services/agentService.js:138-177` (`:150`) |
| `buildCpuAgentDoc` | `consolidatedInsight: ''`, and no `disciplines` key | `api/_utils/tournamentCpu.js:66-92` (`:81`) |
| `buildTrainingCloneDoc` | copies `disciplines` only when the parent's is defined | `api/_utils/trainingClone.js:118`, list `:74` |
| `buildCasualCloneDoc` | the same | `api/_utils/casualClone.js:59` |

So the creation-time value is **no field at all**, and that is what the reset writes. Every reader tolerates it: `formatDisciplines` takes a non-array as empty, reached through `agent?.disciplines?.selection` (`agentConsolidationPrompt.js:194-195`, `:240-243`). No reader in `src/` exists (grep).

## 6. What you see afterwards (checked, nothing changed)

| Surface | After the reset | Anchor |
|---|---|---|
| Record sheet, "Strategic insight", agent with 5+ games | **"Consolidating your agent's first strategic insight… It lands after the next evolution cycle completes."** The agent with 35 games shows this. See follow-up 2. | `AgentRecordSheet.jsx:259-267` |
| Record sheet, agent under 5 games | "0/5 games until first strategic insight" and the bar. The other non-clone in the set shows this. | `:269-283` |
| Record sheet, discipline badges | **Unchanged** ("N sel / N exec" on past timeline rows). This corrects R3's "drops to zero". | `:141-145` |
| Chat voice | "YOUR ACCUMULATED WISDOM" is left out for those agents | `voiceLayerPrompt.js:1096-1100` |
| Tournament agent boards | "STRATEGIC WISDOM" is left out | `tournamentAgentBoards.js:161-162` |
| Trading brain | The next battle freezes no paragraph; the block is left out | **F** `agentBattleService.js:242`, **F** `agentEvalPromptAssembly.js:774-776` |
| Fenced draft prompt | **"This is your first deployment. No prior game experience yet."** for an agent with an empty paragraph, even one with 35 games. Fenced, out of scope: follow-up 1. | **F** `agentPromptAssembly.js:84-92` |
| The next paragraph | None until an agent holds 3 real lessons (`memoryLessons.js:25`) and reaches a fifth game that moved the count, which a tournament battle never does (`reflect.js:296-326`). Until then the agent has no paragraph. | |

The rewrite starts clean: an empty paragraph renders "(no prior consolidation — this is the first cycle)" (`agentConsolidationPrompt.js:178`, `:203`).

## 7. Protected-store scanner, writer census, runbook gate — FOUNDER SIGN-OFF REQUESTED

`agents` is a protected store, so these need your eye.

| Registry | Added | Why |
|---|---|---|
| `compositionProtectedStoresAllowlist.json` | `scripts/reset-failure-built-insight.mjs::resetOneAgent::update::unresolved: 1`, `...::restoreOneAgent::update::unresolved: 1`, and the note `_notes_insight_reset` | Listed directly from `scanProtectedStoreWrites`, not inferred. Each is ONE `tx.update` on `agents/{id}`. |
| `compositionWriterCensus.json` | an `adminCliScripts` row | The census test then proves the script carries `assertWriteEpochOpen`. Its walker reads `.js` only, so without the row nothing would check a `.mjs`. |
| `compositionDerivedWritesCensus.json` | an `excluded` row, with its reason | A row in the writer census must be classified here, or the completeness test fails. |
| `docs/composition/EXTERNAL_ADMIN_WRITE_PATHS.md` | the script's name in row E3 | E3 lists what not to run during a composition window. |

**The runbook gate needs no runbook here.** `compositionRunbookGates.test.js` checks the rules deploy record, the preflight report, and that nothing writes the epoch document outside `transitionWriteEpoch`. It says nothing about one-off scripts, and the script does not touch the epoch document. The weekend run in §1 is the runbook.

**`firestore.rules`** is unchanged. The two new fields cannot break a client write: the agent update rule tests the changed keys only (`firestore.rules:332-335`).

## 8. The §7 write-call grep

The grep (`\.(set|update|delete|add|create)\s*\(|runTransaction|\.batch\(|bulkWriter|writeBatch|FieldValue|recursiveDelete`) finds exactly these nine lines:

| Line | In | Text |
|---|---|---|
| `:61` | the module | `import { FieldValue } from 'firebase-admin/firestore';` |
| `:330` | `resetOneAgent` | `return db.runTransaction(async (tx) => {` |
| `:347` | `resetOneAgent` | `tx.update(ref, {` |
| `:349` | `resetOneAgent` | `disciplines: FieldValue.delete(),` |
| `:437` | `restoreOneAgent` | `return db.runTransaction(async (tx) => {` |
| `:446` | `restoreOneAgent` | `consolidatedInsightResetAt: FieldValue.delete(),` |
| `:447` | `restoreOneAgent` | `consolidatedInsightResetReason: FieldValue.delete(),` |
| `:449` | `restoreOneAgent` | the loop that writes back each field, or removes one the agent never had |
| `:450` | `restoreOneAgent` | `tx.update(ref, patch);` |

**Nothing in `census` or `plan`.** The hash uses `crypto.hash`, not `.update()`, and the file holds no `Map` or `Set` mutators, so the grep cannot hit a false positive. A test row walks the syntax tree, maps every hit to its enclosing function, and pins this exact list. Two more rows pin that only `runApply` reaches `resetOneAgent` and only `runRestore` reaches `restoreOneAgent`.

## 9. Tests

`scripts/reset-failure-built-insight.test.js`, 84 rows, on a Firestore fake that projects `select()` as Firestore does, applies the real delete sentinel, buffers writes to commit, can run a transaction twice, and can keep a real Firestore class alive.

| Group | Rows | What they pin |
|---|---|---|
| The selection rule | 4 | (a), (b), neither, empty, non-string |
| The New York weekend | 1 | Turns at midnight Eastern on both sides, across the clock change |
| `census` | 6 | Every count; the parent breakdown; both kinds of active battle; the empty set after a run; a stamp under a paragraph; no writes |
| `plan` | 4 | The entries; the printed hash is the file's; the folder; refuses a folder inside the repo; no writes |
| `apply`: the write | 17 | Exactly five fields, one stamp; every other field unchanged; nobody outside the set; skips on a changed paragraph, flag, dossier or deleted agent; a forged plan; no-op on a reset agent; a fresh folder; a lost acknowledgement; a transaction that runs twice; a value JSON cannot carry |
| `apply`: the refusals | 18 | `--go`; an edited plan; a wrong or malformed hash; an unreadable, empty or malformed plan; weekday with and without the flag; an active battle on the agent, its parent or its clone, by record and by pointer; both deploy windows; the epoch. Each proves no write and no backup folder. |
| `apply`: a battle after the guard | 4 | Pointer, battle record, deploy stamp and deploy lock each skip the agent |
| `apply`: the backup | 8 | On disk and complete before the first write; holds every field and leaves out a field never held; the path printed first; a backup that cannot be written or reads back wrong stops the run; never overwritten |
| The write epoch | 2 | Checked at entry and before every agent, for `apply` and `restore` |
| `restore` | 9 | The exact round trip; removes a field never held and both stamps; skips on a new paragraph, another run's stamp, a dossier held again, a deleted agent; refuses without `--go` or on a bad file |
| Nothing printed | 4 | No id and no text across all four commands under planted text, including thrown errors, on `console.log`, `error`, `warn` and `info` |
| The command line | 2 | A typo, a missing value or a missing flag is refused |
| Writes only where meant | 5 | The grep's exact lines; who reaches the writers; credentials only in `main()`; the real fence is passed; the credentials check comes first |

**Beyond the fake: the real Admin SDK on the local Firestore emulator.** Not committed, and not production. On the final code: `census`, `plan`, `apply`, `apply` again as a no-op, `census` showing the set empty, the battle refusal, and `restore`, with every document deep-equal to its seed afterwards. That proves the query inside a transaction and the field removal on the real SDK.

## 10. Mutation check

Each mutant is an exact-string change, run alone against the test file on an LF snapshot, with the file restored from memory after each. The harness refuses to start on a red baseline.

| Round | Snapshot | Result | Notes |
|---|---|---|---|
| 1 | `38161db9` | 140 of 143 killed | Three survivors, each a weak row of mine. F3: the deploy lock was tested only on the pure function, so a row now goes through the real read. T8: the wrong-schema fixture also had a bad stamp. L3: every "flag taken as a value" case was refused by a later check anyway. Rows added. |
| 2 | `ca470fa0` (the final code) | **155 of 155 killed** | The round-1 set, updated for the fixes, plus 12 mutants for the review round (IR-1, 3, 7, 8, 9, 11, the retry row and the `Timestamp` row). None failed to apply; none was killed only by a timeout. 87 were caught by exactly one row. |

One mutant needs two edits by design: the exclusive folder and the exclusive file protect each other, so removing either alone cannot be seen.

## 11. Independent review

The diff passes the BUILD_RULES §2 threshold, so this section is the written record that rule asks for.

**How it ran.** One reviewer, on a `git archive` snapshot of `db6fb697`, read-only on git, no production access, told to refute the script. It was given the founder's words and the code, not this report's reasoning. Lenses: the four the brief names (outside the rule, outside the list, during a live battle, losing the backup), plus restore's skip cases, printed ids and text, retries, the removed field, and surprises on the day. It ran nine experiments of its own. Then each of its 11 findings went to its own verifier, each on its own snapshot of `23ad13f4`, told to refute it.

**Result.** No blocker. The reviewer's answers: outside the rule, nothing found; outside the list, nothing found; losing the backup, nothing found; during a live battle, yes, narrowly. **7 CONFIRMED, 4 PARTLY CONFIRMED, 0 fully REFUTED**, but the verifiers did knock down specific claims, shown below.

| ID | Finding | Reviewer | Verifier | What the verifier changed | Disposition |
|---|---|---|---|---|---|
| IR-1 | A rewrite already running can land just after the reset, and `apply` reports clean | SHOULD-FIX | PARTLY CONFIRMED | Corrected: the cron runs 13:00–00:45 UTC, not all day; its queue is fed on weekdays, so a weekend only drains Friday's tail; only non-clones reach it; `census` was not blind, since `already reset` falls one short of `written`. Its estimate: about 1 in 7,000 for a Saturday daytime run, near zero on Sunday, zero outside the cron's hours. | **Fixed for visibility:** a census row, an acceptance check, and a recommended run time. The proposed hold is **not built** (FQ-1). |
| IR-2 | One hold refuses the whole run, and you cannot see or exclude it | SHOULD-FIX | PARTLY CONFIRMED | "Cannot see" is false: `census` and the refusal both print the count. The stale-pointer route is near dead. Harm is timing only. Late-Friday or weekend deploys are real: a rough ceiling of 1 in 3 by Saturday morning. Both proposed fixes rejected: a holds file breaks "a refusal leaves nothing behind", and leaving families out of the plan contradicts the brief. | **Not changed.** Built to the letter. Your call as FQ-2. |
| IR-3 | A deploy past its lock is invisible: it has cleared `deployingAt` but not yet committed its battle | SHOULD-FIX | CONFIRMED, low severity | Found the window is longer than claimed, an estimated 5–20 s, with a 60 s ceiling. Roughly under 1 in 1,000 per run. Cost: one battle. | **Fixed:** `lastDeployedAt` is read, and a value under two minutes old holds, at the guard and inside each write. |
| IR-4 | A battle starting on a parent mid-run splits the family | NOTE | CONFIRMED, rare | A re-plan repairs it, but the earliest settle is Monday night, so that may mean `--allow-weekday` or the next weekend, and then two backups. | **Stated limit** (§13). An in-transaction family check cannot close it. |
| IR-5 | Restore has no battle or weekend guard | NOTE | CONFIRMED | The trading brain does not move; only the voice does. A guard would let one live battle block the undo. | **Stated limit**, and now in the script's header. |
| IR-6 | Restore removes earlier stamps rather than giving them back | NOTE | CONFIRMED, no harm | No recovery is lost. It showed that a script comment overclaimed. | **Comment corrected.** |
| IR-7 | Restore could put an old dossier back over a new one | NOTE | CONFIRMED on mechanism | The rewrite's validator does accept an empty paragraph, and absorbed lessons would stay consumed. The trigger is unlikely. | **Fixed:** restore also skips an agent holding a dossier again. Stricter than the brief. |
| IR-8 | The backup path printed only after the loop | NOTE | PARTLY CONFIRMED | Only process death reaches this, since loop errors are caught. "Newest folder" is wrong after a re-run. | **Fixed:** printed before the first write. |
| IR-9 | A lost commit acknowledgement can miscount a written agent as a no-op | NOTE | PARTLY CONFIRMED | The route differs: the client library resends the same commit first. The same outcome is reachable another way, and restore still works. | **Fixed:** an agent carrying this run's stamp counts as written. One case stays: an error after a commit landed reads as an error, and `census` shows the truth. |
| IR-10 | The casual re-sync does not carry a removed field | NOTE | CONFIRMED, no effect | The only reader of `disciplines` is the rewrite, and for a casual clone it reads the parent. It heals itself. | **Stated limit.** |
| IR-11 | No credentials message | NOTE | CONFIRMED | A corrupt key with valid markers still prints `FAILED: Error`. | **Fixed:** `main()` calls `requireFirebaseCreds()`. |

**The reviewer's test-gap note, also fixed.** My fake never retried a transaction, and it flattened any Firestore class. It now has a retry mode and a raw mode, with a row for each: a transaction that runs twice counts once, and a real `Timestamp` in a dossier fails closed.

**The isolation record.** Two verifiers stepped slightly outside their snapshot: one wrote a scratch file to `/tmp` and deleted it, and one ran a read-only grep on a worktree it did not use. Neither touched the repo or production. No reviewer or verifier read a `.env` file or reached production.

## 12. Suites, gates, and every production read

All on `ca470fa0` (the final code), in WSL Ubuntu, a private worktree of `~/pd-ci` with its own `npm ci` (the shared clone's lockfile is behind `main`'s), `TZ=UTC`, under `flock`.

| Gate | Result |
|---|---|
| Full suite, `--maxWorkers=8` | **exit 0. Test Files 1,244 passed, 8 skipped (1,252). Tests 27,447 passed, 89 skipped.** 208 s. That is 11 more than `23ad13f4` (27,436), the 11 rows added by the fix round. |
| `lint:gate` | exit 0 |
| `vite build` | exit 0, built in 14 s. The pushed head's result is in the PR description, since a commit cannot carry its own. |
| The new test file on Node 20.20.2, CI's version | exit 0, 84 of 84. `crypto.hash` exists there. |
| The rules suite | Not run: `firestore.rules` is unchanged. |
| `main` | `f7be7f1b`, unmoved through the final fetch, so the tested tree is what CI tests. |

**Production reads, all read-only, all printing counts only:**

| Read | When (UTC) | What |
|---|---|---|
| `census` | 30 Oct, 15:26 | The table in §1 |
| A counts-only script in the session scratchpad | 30 Oct | Active battles (age, end, mode), stale `activeBattleId` pointers, the three outside the set, distinct paragraphs |
| A one-query probe | 30 Oct | The script's in-transaction battle query shape, `agentId ==` + `status ==` + `select`, works with no index error. `firestore.indexes.json` holds no composite for this pair; Firestore merges the two single-field indexes, and `decide.js:757-760` already relies on it. |

Each ran with `.env.local` copied into the worktree as a git-ignored file and deleted in the same command. Each ad-hoc script passed the §7 grep first, in the same command. `plan` and `apply` were not run.

## 13. Limits, stated plainly

- **The family check runs once.** Inside each write the script re-checks that agent alone. A battle starting on a parent or clone during the seconds of the run is not seen, so the family can split: the run is reported not clean, and a re-plan repairs it (IR-4). The mirror case, a clone skipped and its parent reset, leaves that clone a dossier a re-plan cannot reach, because its paragraph then re-syncs empty. Nothing reads it.
- **A rewrite already in flight.** The rewrite's plain write is not a compare-and-set (`agentConsolidationApply.js:291`), so it can land just after the reset (IR-1). `apply` cannot see it; step 4 of the weekend run can. `restore` skips that agent.
- **The casual re-sync is not locked.** Between its read and its write (`casualClone.js:206-212`), a few seconds during a live deploy, it can put old text back on a reset clone. `census` shows that as `In the set` above 0.
- **A clone born between `plan` and `apply`** is not in the plan and can carry the old paragraph. `census` shows that too. In either case, run `plan` and `apply` again.
- **The casual re-sync does not carry a removed field.** It copies only defined fields (`casualClone.js:94`). The reset covers this by writing clones in the same run. An agent outside the set keeps its dossier, as ruled (IR-10).
- **`restore` has no battle or weekend guard**, on purpose (IR-5). It is the emergency undo. A live battle's trading brain reads its frozen copy and does not move; the chat voice does.
- **`restore` removes the two stamps**, as the brief says, even if the backup held earlier ones (IR-6).
- **A sliver of a deploy stays invisible:** the moment between `decide.js` reading the agent and setting its lock (`:158-216`). Negligible.
- **A battle already running** reads only its frozen copy, so the reset has no effect on it.
- **Credentials.** A corrupt key that still has its markers prints `FAILED: Error`, with nothing changed.

## 14. Follow-ups (not built; BUILD_RULES §3)

1. **The fenced draft prompt says "first deployment" to an agent with 35 games.** `agentPromptAssembly.js:84-92`. It needs a sanctioned fence entry. Named in the brief.
2. **The record sheet's empty state promises something the floor can break.** With 5+ games and no paragraph it says the first insight "lands after the next evolution cycle completes", but the rewrite needs 3 real lessons and a CPU game at a turn, and the agent may already show many cycles on the timeline. Not fenced; a wording question.

## 15. Founder questions

None blocks the merge or the weekend run. Each default is what is built.

| # | Question | Built today | Why you might change it |
|---|---|---|---|
| FQ-1 | Should `apply` also refuse while a battle in the family is waiting for its reflection? | No. The census row and the run time cover it. | It would close IR-1 at the source, but it adds refusals, and refusals are the likelier problem (IR-2). |
| FQ-2 | If no weekend ever clears, should `plan` leave held families out, for a staged run? | No. One hold refuses the run, as the brief says, and the run moves to the next weekend. | It would stop one casual deploy delaying the reset for everyone, but families would reset on different days. |
| FQ-3 | The two paragraphs outside the set stand on failure-built text. Leave them? | Yes. The rule leaves them. | Removing them would be a new ruling and a new rule. |
