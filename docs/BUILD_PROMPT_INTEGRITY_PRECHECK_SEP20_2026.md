# Build Prompt — Integrity Precheck (read-only census script)

**Written by:** Fable · **Date:** 2026-09-20 · **Governing ruling:** IR-4 in `20260920_INTEGRITY_FINDINGS_REGISTER_V1.md`

---

## Part 1 — For Flash (don't paste this part)

**What this builds.** One script that reads production and counts how often each audit finding has already happened. It writes nothing. It follows the N1 precheck pattern: CC builds it, you run it from your own machine, and the numbers come back to me.

**Why it goes first.** Four findings fire in ordinary play with no bad luck needed. We don't know whether any League week or battle result has been affected. N1 turned out to have no victim, and this tells us whether the same is true here. It also gives you data for two founder questions: how stale the sealed score typically is (FQ-1), and whether anyone is using the older modes (FQ-4).

**What it will not do.** It repairs nothing, recomputes nothing and changes no score. If it finds affected history, that becomes a separate task you authorize (ruling IR-16).

**Before the session opens,** the docs-only PR (register step 0) must be merged, with these exact names in `docs/audits/`:
- `2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md` (already on `main`)
- `20260920_ASTRA_DATA_CONSISTENCY_CONCURRENCY_RETRY_AUDIT.md`
- `20260920_INTEGRITY_FINDINGS_REGISTER_V1.md`

**Running order.**
1. Open a fresh Claude Code session (Opus) and paste everything below the line.
2. Bring me the handover and the script **before you run it**. I check the read-only guarantee and the predicates.
3. Run it locally using the command in the handover. Expect a few minutes and a small read bill, roughly one read per battle, group and agent document.
4. Paste the console summary back to me. The detailed JSON stays on your machine and is never committed.
5. Merge the PR after the run, so the script is in the repo for re-runs after each fix lands.

---

## Part 2 — Paste everything below this line

---

# Build — Integrity Precheck Script

**For:** Claude Code (Opus executor), fresh session
**Arc:** Integrity register (four Astra audits, Sep 19–20)
**Branch:** `chore/integrity-precheck`
**Fence contact:** none. This task adds a script, its tests and a report. It edits no application code. If any step seems to require editing a file under `api/` or `src/`, **STOP and report**.
**Production contact:** none. You do not run this script against any real project. You have no credentials, and you do not ask for any. The founder runs it locally.

---

## Step 0 — Gate (hard STOP if any fails)

1. `git status` — the working tree must be clean.
2. `git log -1` — record the SHA. Every citation in your report is pinned to it.
3. Confirm these exist on `main`, and read them:
   - `docs/audits/20260920_INTEGRITY_FINDINGS_REGISTER_V1.md` — rulings IR-4, IR-12, IR-16 and founder questions FQ-1, FQ-4
   - `docs/audits/20260920_ASTRA_DATA_CONSISTENCY_CONCURRENCY_RETRY_AUDIT.md` — every DCR finding's "Detection" and "Validation" paragraphs
   - `docs/audits/2026-09-19_ASTRA_RUNTIME_STATE_INTEGRITY_AUDIT.md` — finding F01
   - `docs/BUILD_RULES.md` — §1 fence list, §3 session documents
   - `scripts/n1-stranded-precheck.js` — the precedent this script must match
4. If any of these is absent from `main`, **STOP**. Do not proceed from a chat-attached copy.
5. Create the branch. One task, one branch. Do not merge.

---

## Why this build exists

Four static audits found paths that *could* have produced wrong results. None of them looked at production data. Before any fix is prioritized, the founder needs to know which of those paths have actually fired, and how often. This script answers that with counts and document ids.

**The script is a measuring instrument.** A wrong predicate is worse than a missing one, because it will be read as fact. Where stored data cannot answer a question, the script says `UNDETECTABLE` and gives the reason. It never approximates silently.

---

## Step 1 — Field map (do this before writing the script)

The checks below are described in plain terms with the audit's citations. **You derive the real field names and predicates from the code.** For each check, record in your report:

| Check | Collection(s) | Fields read | Exact predicate | Citation (file:line at your SHA) | Detectable? |
|---|---|---|---|---|---|

**Citation verification (register ruling D-n).** For every audit citation you rely on, mark it **CONFIRMED**, **MOVED** (give the real line) or **MISS** (say what is there instead). Report the three counts. Do not silently correct a MISS.

If a check is not detectable from stored data, keep it in the script as a named check that reports `UNDETECTABLE` with the reason. Do not drop it, and do not invent a proxy.

---

## Step 2 — The checks

Every check reports: documents scanned, matches found, and the matching document ids. Every check that can only produce suspects, not proof, labels its output **CANDIDATE**.

**C-01 — How stale is the sealed score? (DCR-001 · FQ-1)**
For every completed agent battle: the gap between the last scoring timestamp and the completion time. Report count, median, 90th percentile and maximum. Also report how many gaps exceed 20 minutes, how many completions happened while the market was closed, and how many involved a battle holding any crypto.
*Leads:* `api/cron/agent-evaluate.js:239-249`, `4582-4611`, `4695-4701`.

**C-02 — Writes after completion (DCR-002)**
Completed battles with any closed trade, score update or feed entry timestamped after the completion time.
*Leads:* `api/_utils/agentSwapExecution.js:134-194`, `354-367`; `api/cron/agent-evaluate.js:3166-3206`.

**C-03 — Two live battles for one agent (DCR-003)**
(a) Agents with two or more battles whose active windows overlapped, at any time in history. (b) Agents with two or more active battles right now. (c) Using the attribution key the League score collector actually uses, any owner with more than one contributing battle for the same group and day.
*Leads:* `api/agent/decide.js:710-729`, `1364-1385`; `api/_utils/tournamentBanking.js:65-85`.

**C-04 — Trade history cap (DCR-012 · capture build question)**
Across all battles: the maximum closed-trade list length, the maximum trade count and the maximum evaluation count. Also the number of battles at 40 or more trades, and at the cap.
*Leads:* `api/_utils/agentSwapExecution.js:354-367`; `api/cron/agent-evaluate.js:907-923`.

**C-05 — Daily bank applied twice (DCR-007)**
If per-day history is retained: battles with two bank entries for one date, or a banked total that exceeds the sum of its daily entries. Cover the agent path and the V4 path separately.
*Leads:* `api/cron/agent-daily-scores.js:45-57`, `173-194`; `api/cron/baggerbomb-v4-daily-scores.js:221-278`.

**C-06 — Overnight leg scored from an earlier day's open (DCR-005)**
For every non-training League group: every leg (current and dropped) opened after the group's first captured session. Flag it when its baseline equals the group's stored open for that symbol and that stored open was captured in an earlier session than the leg's. Compare on price and capture time, not on the stamped session alone, because the audit reports that the sweep can stamp the current session onto an older price. Report the denominator too: how many later-session legs exist in total.
*Leads:* `api/_utils/canonicalOpen.js:46-47`, `107-139`; `api/_utils/canonicalOpenSweep.js:59-93`; `api/tournament/flip.js:175-187`; `api/_utils/tournamentBanking.js:243-272`.

**C-07 — Zero from a missing quote (DCR-004) — CANDIDATE**
(a) Banked days where a live, unclosed pick contributed exactly zero. (b) Closed legs still waiting to be banked inside a group that has completed. (c) Any persisted missing-quote warning. A zero alone is not proof, and the output says so.
*Leads:* `api/_utils/tournamentBanking.js:227-230`, `301-338`, `484-518`; `api/_utils/tournamentUserScoring.js:115-166`.

**C-08 — Double flips (DCR-008) — CANDIDATE**
The same player flipping the same symbol twice within 60 seconds. Intent cannot be known from history, so this is a count of suspects only.
*Leads:* `api/tournament/flip.js:135-190`, `234-247`.

**C-09 — Two seats in one battle week (DCR-009)**
Users who are members of more than one non-training competitive group sharing a battle week.
*Leads:* `api/_utils/liveDraftFormation.js:291-299`, `353-410`.

**C-10 — Ledger disagrees with portfolios (DCR-006)**
For active groups: symbols an agent holds that the ownership ledger does not list for it, and symbols held by two agents at once.
*Leads:* `api/_utils/tournamentAgentLedger.js:364-408`, `591-689`.

**C-11 — Learning delivery (DCR-010 · DCR-011)**
(a) Agents whose memory holds the same game id more than once. (b) **CANDIDATE:** completed battles no longer pending reflection whose game id is absent from the agent's memory. State the memory bound, because a bounded list cannot prove loss. (c) Agents with a claimed consolidation milestone and no evidence it was applied. Derive the predicate from the code and state it.
*Leads:* `api/cron/process-pending-reflections.js:47-99`; `api/agent/reflect.js:134-193`, `255-312`; `api/_utils/agentConsolidationApply.js:325-414`.

**C-12 — Authority census (state-integrity F01, ruling D-d)**
(a) Agent documents carrying a stored `id` that differs from their document id. (b) Battles whose `agentId` resolves to an agent with a different owner. Expected result: zero for both.

**C-13 — Older-mode activity and integrity (FQ-4 · DCR-013, 014, 016, 017)**
For each of `drafts`, `battles`, `optionsEntries` and `earningsEntries`: total documents, documents created in the last 30 and 90 days, the most recent creation time, and distinct users in the last 90 days. Split `battles` by mode if the documents allow it, and say which modes you found. Then the four integrity counts: drafts with more than four players; battles still in battle status with day five recorded; tournaments whose entry count differs from their actual entries; options entries marked complete before their tournament's end date.
*Leads:* `src/services/draftService.js:220-258`; `api/cron/snake-draft-daily-scores.js:295-319`; `src/firebase/firebaseService.js:3725-3768`, `3305-3387`; `api/options/resolve-tournament.js:120-174`.

---

## Step 3 — Build rules

**3a. Match the precedent.** Read `scripts/n1-stranded-precheck.js` first. Match how it authenticates, how it names the target project, how it guards against writes and how it reports. Say in your handover what you matched and anything you deliberately changed.

**3b. Read-only by construction.** The script reaches Firestore only through a wrapper that exposes reads and throws on `set`, `update`, `delete`, `add`, `create`, `batch`, `bulkWriter` and `runTransaction`. There is no `--apply` flag and no write path of any kind.

**3c. Location and interface.** `scripts/integrity-precheck.js`. Flags: `--check C-06` (repeatable; the default is all checks) and `--since YYYY-MM-DD`. It prints the target project id before the first read.

**3d. Cheap reads.** Use field masks (`select`) wherever the check allows. Do not fan out into subcollections unless a check requires it. Print the documents read per collection at the end.

**3e. Output.** A console summary of one block per check, giving counts and no document ids. A detailed JSON file goes to a local path that is already gitignored. Confirm the ignore rule and cite it. The JSON holds ids, timestamps and numbers only.

**3f. No personal data.** Never output emails, display names, chat text, agent memory content or strategy text. User and agent ids only. For C-11, output game ids, not lesson text.

**3g. Pure predicates.** Each check's predicate is a pure function, kept separate from the Firestore read, so it can be tested on fixtures.

**3h. Do not fix what you find.** If the code surprises you, record it under "Observations" in the report with a citation. Do not expand scope.

---

## Step 4 — Tests

1. For every detectable check: one fixture that must match and one near-miss that must not. The near-miss matters most. For C-06 it is a later-session leg with the correct next-day open. For C-03 it is two battles on sanctioned separate clone ids.
2. A write-guard test: every write method on the wrapper throws. **Prove the test works.** Temporarily let one write method through, show the test go red, then revert. Report that you did this.
3. A static test that fails if `scripts/integrity-precheck.js` imports or references a Firestore write method outside the guard.
4. Run the **full** suite. Assert the exit code. Read the `Test Files` line. **Do not pipe through `tail`.** Report the result verbatim.

---

## Step 5 — Report and handover

Commit a report to `docs/audits/20260920_BUILD_INTEGRITY_PRECHECK.md` containing:

1. The SHA built from, the branch and the tree state.
2. **The field map table** from Step 1, complete, with the citation verification counts.
3. **Undetectable checks**, each with its reason and what would need to be stored to make it detectable. This list feeds the capture build.
4. What you matched from the N1 precheck and what you changed.
5. **Observations:** anything outside scope, with citations. Do not fix.
6. **The exact run instructions for the founder:** Windows, PowerShell, from `C:\Users\fashr\portfolio-duel`, after `git pull` and checking out this branch. Include how credentials are supplied, mirroring the N1 precheck. Give the full command and a subset example (`--check C-06 --check C-13`). Note which part of the output to paste back to Fable and which file stays local.
7. An estimate of the documents each check will read, as a formula. Collection sizes are unknown to you, so say so.

Push the branch. Open no PR. Do not merge. Do not respond to CI. Then **STOP**.

---

## What this task does not do

- It does not read, write or connect to any real Firebase project from your session.
- It does not modify any file under `api/` or `src/`.
- It does not repair, recompute or annotate any stored score, stat, rank or memory.
- It does not decide what the counts mean. The founder and Fable read them against the register.
