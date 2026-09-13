# Build B2 — the shared directive transaction, the attestation, the cap

**BUILD_RULES §1 fence, first line as asked:** **none of the files this build touches is on the §1 fence.** Re-confirmed at my HEAD this session against `docs/BUILD_RULES.md:14-24` (the eleven-file list, read in full): `api/_utils/directiveTransaction.js`, `api/agent/chat.js`, `api/agent/file-directive.js`, `api/_utils/directiveFiling.js`, `api/_utils/compositionProtectedStoresAllowlist.json`, `src/data/decisionRecord.js`, `src/screens/battleView/battleViewCopy.js`, `src/screens/battleView/selectBench.js`, `src/components/Agent/AgentChat.jsx`, `src/components/League/battleArena/useArenaEngine.js`, `src/components/FilmRoom/FilmRoomChat.jsx`, `api/_utils/agentChatBudget.js` and the eight test files. A programmatic check of the cumulative diff against all eleven fenced paths returns **zero hits** (§5 below). No fenced function was edited; none was called that was not already called.

**Date:** September 13, 2026
**Branch:** `claude/b2-directive-transaction`, cut fresh from `origin/main` · **HEAD at cut:** `c35f9a591d6e5db3288e3f843ec58aaf7c130687` · **Tree:** clean at cut
**Head at report:** `08fc22fc` (seven commits: the cherry-picked Phase 0 report, A–E, and the review's two passes)
**Fetch recorded (BUILD_RULES §3):** `git fetch origin` ran as the first command of the session, before any comparison against a remote. It moved twenty-odd remote-tracking refs; `origin/main` was already at `c35f9a5`.
**First commit:** `git cherry-pick 99c89c6` — the Phase 0 report (`docs/audits/20260913_PHASE0_B2_SHOWIT_PREREQS.md`), from `claude/phase0-b2-showit`.
**Flag:** none (spec `PHASE_B_TICK_STAMPS_SPEC_V1.md:62` — *"B2 ships unflagged as a fix to a failing path (the P-1 precedent), after its own review."*). `src/config/featureFlags.js` is untouched; `DARK_BY_DESIGN` is untouched; `api/_utils/tickStamps.js` is untouched.
**Reachability:** unchanged. The chip route still 404s before any read for a caller the accessor does not resolve to `'on'` (D-102/D-106). The typed route is still reachable at every grounding mode — which is why this is a fix to a live path: at today's `VOICE_GROUNDING_MODE = 'shadow'`, **every directive filed in production goes through the typed path.**

---

## 0. Executive verdict

| # | What | Verdict |
|---|---|---|
| 1 | The seven §2 rulings | **All seven built.** Quoted beside their code in §2 below. |
| 2 | The eight defects (Phase 0 §2.4 + Q2 + Q4) | **All eight closed.** (a), (b), (c-inverse), (e1), (e2), (e3), (e4), Q2 sites 1/4/5/6, Q4's cap. |
| 3 | Fence | **No contact.** Zero fenced paths in the diff; no new battle-doc key; the two handle-form write rows moved with their writes in the allowlist. |
| 4 | Flag-OFF byte-identity | **Held.** `chat.test.js`'s ENFORCE and flag-OFF exchange rows pass unchanged. |
| 5 | Full suite | **12,455 passed / 64 skipped, exit code 0.** Baseline at `c35f9a5` was 12,368 passed, also exit 0. |
| 6 | `vite build` | **exit 0** (BUILD_RULES §2 — no test imports `App.jsx`). |
| 7 | Lint on the touched files | **No rise.** Every touched file is byte-identical in error/warning count to its state at `c35f9a5` (§5). |
| 8 | §2 adversarial review | Run — four lenses, path-distinct `git archive` extractions, **mutating lens last, on the tree the first three lenses' fixes produced**. **26 findings CONFIRMED, 15 REFUTED; 24 closed in-branch, 2 filed.** One was a regression this build introduced (A-2), one a copy line that contradicted itself (C-1), and seven were claims with no test behind them — including the only enforcement of the ten-message cap. Record in §6. |
| 9 | **One STOP-class item** | **§2 is SILENT on a fourth outcome the transaction can produce** — a commit that landed whose reply was lost. Not invented away; see §7. |
| 10 | **One pre-existing hole found and NOT fixed** | `leagueAsk: true` on a non-tournament battle bypasses BOTH budgets, at `c35f9a5` and still. Filed per BUILD_RULES §3 — §11 item 5. |

**Two things the review changed after the build was green**, because the record should not read as if the first pass were the last: the thread id is minted *above* the transaction (minting it inside made a retried commit duplicate the turn — a regression against `c35f9a5`), and the `persisted: true` send line is gone entirely (it said the character could not answer beside the answer it had just committed). Both are §6.

**The one sentence.** The typed directive path now files through the same transaction as the chip path — status and budget re-read inside the write, the count explicit, the League charge atomic with the filing — and every response from both routes says whether the directive persisted and whether a message was charged, so no client has to guess it from a status code.

---

## 1. The diff

```
 api/_utils/agentChatBudget.js                       |  17 +-
 api/_utils/compositionProtectedStoresAllowlist.json |   7 +-
 api/_utils/directiveTransaction.js                  | 390 ++++++++++++++
 api/agent/chat.js                                   | 407 ++++++++++----
 api/agent/chat.test.js                              | 698 +++++++++++++++++++++-
 api/agent/file-directive.js                         | 277 +++++-----
 api/agent/file-directive.test.js                    | 174 +++++-
 api/agent/research.dark.test.js                     |  84 +++
 docs/audits/20260913_PHASE0_B2_SHOWIT_PREREQS.md    | 498 +++++++++++++++++
 src/components/Agent/AgentChat.chips.jsdom.test.jsx |  56 ++
 src/components/Agent/AgentChat.jsx                  | 102 +++-
 src/components/Agent/AgentChat.sendFailed.test.jsx  | 209 +++++++
 .../FilmRoom/FilmRoomChat.attestation.jsdom.test.jsx| 122 ++++
 src/components/FilmRoom/FilmRoomChat.jsx            |  25 +-
 .../useArenaEngine.grounding.jsdom.test.jsx         | 109 +++-
 src/components/League/battleArena/useArenaEngine.js |  76 ++-
 src/data/decisionRecord.js                          | 105 +++-
 src/screens/battleView/PaneBench.render.test.jsx    |  91 ++-
 src/screens/battleView/battleViewCopy.js            |  48 +-
 src/screens/battleView/selectBench.js               |  30 +-
 20 files changed, 3436 insertions(+), 302 deletions(-)
```

Twenty files / 3,738 lines on the cumulative branch diff — **past the BUILD_RULES §2 review threshold in both directions** (≥10 files OR ≥1500 lines). The review was pre-commissioned in the prompt and is recorded in §6; three of the twenty files are there *because* of it (`agentChatBudget.js`, `FilmRoomChat.jsx` and its new suite). Of the twenty, one is the cherry-picked Phase 0 report and eight are tests.

---

## 2. The seven §2 rulings, quoted beside the code that implements them

`docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md` §2 spans `:49-54`. The spec numbers three of its rulings inline — **4** (conflict), **5** (budget) and **7** (attestation) — and states the other four as prose. **The full founder list "rulings 1–9" named at `:4` is not enumerated anywhere in the repo** (errata row E-4 in §8); the numbering below is my reading of §2's seven distinct prescriptions in document order, with the spec's own numbers where it gives them.

### Ruling 1 — the module and its home

> *"extract `file-directive.js:196-299` into a sibling `api/_utils/directiveTransaction.js`; both routes import it; `directiveFiling.js` stays zero-import"* (`:50`)

Built. `api/_utils/directiveTransaction.js:193` `runDirectiveTransaction`. Imported by `api/agent/file-directive.js:208` and `api/agent/chat.js:1079`. `api/_utils/directiveFiling.js` is unchanged and still has **zero imports** (asserted by `api/agent/file-directive.test.js`'s "ONE module builds it for both writers" row, which also asserts neither route still calls `buildDirectiveRecord`/`buildDirectiveSlot` itself).

The extraction source anchor was re-verified at my HEAD before the edit: `file-directive.js:196` was `await db.runTransaction(async (tx) => {` and `:299` its close, exactly as Phase 0 §6.1 reports. **The anchor had not drifted.**

### Ruling 2 — what the function owns

> *"The function owns the in-transaction re-reads (`battle.directive.directiveThreadId`, `battle.status`, `battle[budgetField]`, the League `agentChatBudget` doc via `resolveBudgetDay`), the mint, the slot/record build, and the writes"* (`:50`)

All four re-reads, in order, inside the transaction body:
- `battle.status` — `directiveTransaction.js:254`
- `battle.directive.directiveThreadId` — `:260-264`
- `battle[budgetField]` — `:317` (and the League doc's count at `:297`)
- the League doc via `resolveBudgetDay` — `:294-298`

The mint at `:226`, **above** `runTransaction` and used at `:332` — one id per CALL, not per attempt (review finding A-2; deviation D-16). The slot and record through `directiveFiling.js` at `:333-334`. The writes at `:348` (`tx.update`) and `:354` (`commitBudget()`).

### Ruling 3 — the composed exchange is the caller's

> *"it takes the composed exchange as an argument (the chat turn's has a user half, the reply, the scratchpad, the gate outcome; the chip's does not)"* (`:50`)

Built, as a **builder** rather than a finished object — enumerated as deviation D-2 in §9, because the same sentence gives the module the mint, and an exchange composed before the call cannot carry an id minted inside it. The builder is called once per attempt: `file-directive.js:244` (no user half — `buildFiledExchange`) and `chat.js:1109-1156` (the user half, the reply, the scratchpad, the gate outcome, and now `overBudget`).

### Ruling 4 — conflict semantics

> *"**Conflict semantics (ruling 4):** latest-wins files anyway; the outcome records the *actual* replaced thread from the in-transaction read."* (`:51`)

Two caller-selected policies: `directiveTransaction.js:83-97`. The chip keeps `REJECT` (`file-directive.js:219`); the typed path takes `REPLACE_AND_REPORT` (`chat.js:1092`). The replaced thread comes from the in-transaction read, never the caller's belief: `directiveTransaction.js:372` `replacedDirectiveThreadId: normalized ? currentThreadId : null`, with `:381` `staleExpectation` recording whether the caller's belief was already stale. The HTTP report half is `chat.js:1227-1230` (`replacedThreadId`), and the sentence the player sees is `battleViewCopy.js:950`.

### Ruling 5 — the budget

> *"**The budget (ruling 5):** the pre-call check stays (`:496-510`) so a player never waits twenty seconds for a 429; the charge moves into the transaction; a race that produces an eleventh **commits** and stamps `overBudget: true` on the exchange — never fail a turn after the model answered. The League charge moves inside the same transaction (cross-document; D-105)."* (`:52`)

Four clauses, four sites:
- the pre-call check stays — `chat.js:524-544` (the HEAD equivalent of the spec's `:496-510`; errata row E-3)
- the charge is in the transaction, as an explicit count — `directiveTransaction.js:317-327`, `battleBudgetUpdate = { [battleBudget.field]: used + 1 }`. **`FieldValue.increment` is gone from the filing path**; `chat.js` still imports `FieldValue` for `arrayUnion` on the `agents` doc at step 20b and nothing else.
- the eleventh commits with `overBudget: true` and does **not** increment — `directiveTransaction.js:99-104` (`COMMIT_OVER_BUDGET`), the stamp at `chat.js:1147`. Test B-2 asserts the doc still reads 10.
- the League charge is cross-document in the same transaction — `directiveTransaction.js:294-314` (`tx.get(budgetRef)` … `commitBudget = () => tx.set(budgetRef, …)`), committed at `:354`. The second transaction at the old `chat.js:1103-1116` is deleted; `chat.js:1247-1262` records why, and `chargeAgentChatBudget` is no longer imported by the route.

### Ruling 6 — the chat path's arguments

> *"**The chat path** (`chat.js:996-1008`) passes the gate's minted object, `expectedDirectiveThreadId` = the slot as read at the turn's start (`:950-951`), `budgetField` / `isLeagueAsk`, `mode`."* (`:51`)

- the gate's minted object — `chat.js:1100-1105` (`resolveDirective` returns `lintedDirective`, or `null` on a turn that files none)
- `expectedDirectiveThreadId` = the slot as read at turn start — `chat.js:1074-1076` (the HEAD equivalent of the spec's `:950-951`; errata row E-3)
- `budgetField` — `chat.js:1107`; `isLeagueAsk` — `:1106`
- `mode` — reaches the module as `requireActive: mode !== 'review'` (`chat.js:1090`), which is the only thing the transaction needs the mode for; deviation D-3 in §9.

### Ruling 7 — the attestation

> *"**The attestation (ruling 7):** the handler knows three outcomes — threw before the transaction (nothing persisted, nothing charged), rejected inside it (same), committed then threw (persisted and charged); the error body carries `persisted` / `charged`; `CHAT_NOT_SENT_CLAUSE` in `decisionRecord.js` appends to `chatSendFailed` only when `persisted === false`; the arena reads the same field and drops its "not charged" claim (`useArenaEngine.js:95-97`)."* (`:53`)

- the vocabulary, named once — `decisionRecord.js:803` `NOTHING_FILED`, `:810` `attestsPersisted`, `:813` `attestsCharged`
- threw before the transaction → `false/false` — `directiveTransaction.js:155` (`attestThrown`, the `attempted === false` branch), reached from `chat.js:1323` and `file-directive.js:319`
- rejected inside it → `false/false` with the reason — `directiveTransaction.js:235-242` (`refusal`, now attempt-aware per review finding A-1), rendered by `chat.js:1363` `respondFilingRefused` and `file-directive.js:257`
- committed then threw → `persisted: true` — `directiveTransaction.js:153`, and the body carries **what** it committed (`file-directive.js:324-329`, review finding B-2)
- **every** response carries the three keys, success included — `chat.js:1221-1223`, `file-directive.js:257` + the 200 at `:295`
- `CHAT_NOT_SENT_CLAUSE` appends only on `persisted === false` — `decisionRecord.js:823`, consumed by `battleViewCopy.js:933-942`. There is **no** positive clause: a landed turn gets no line at all (review finding C-1)
- the arena drops its claim — `useArenaEngine.js:32-39` (the comment, deleted and replaced by the reason it was wrong) and `:56-64` (`chargedRemaining`), used at `:131` and `:196`

---

## 3. The commits, and the defects they close

### Commit A — `01199f17` · the extraction

`api/_utils/directiveTransaction.js` (new, 357 lines) is `file-directive.js:196-299` moved unchanged, plus the two caller-selected policies the typed route needs. `api/agent/file-directive.js:197-255` calls it with `REJECT`/`REJECT` and is otherwise the route it was. Checks 5 and 6 (the archetype allowlist and the canonical text) stayed **in the route**, as a `resolveDirective` callback (`file-directive.js:224-241`) — so the shared module is not a new importer of `archetypeAdjustments.js` and the Spec §2.3 import-boundary ratchet is not touched.

**Proof of fidelity:** `api/agent/file-directive.test.js` passes with 30 of its 31 rows byte-unchanged. The one row that moved is its cross-route source-text row (deviation D-1, §9).

Protected stores: the two handle-form write sites moved file, so their allowlist rows moved with them — `api/_utils/directiveTransaction.js::runDirectiveTransaction::{set,update}::unresolved` added, the stale `api/agent/file-directive.js::handler::*` rows pruned, and a `_notes_b2_directive_transaction` human-review note added beside the superseded G4 one. `compositionProtectedStores.scan.test.js` passes 9/9.

### Commit B — `3a8b24d9` · `chat.js` files through the module

`chat.js:1036-1236`. The write path that was `:1005-1079` at Phase 0's HEAD — the mint, the exchange composition and the unconditioned `battleRef.update()` — is now one call to the shared transaction. Closed here:

| Defect (Phase 0 §2.4) | Before | After | `file:line` |
|---|---|---|---|
| **(e1)** `FieldValue.increment(1)` contradicts D-105 in terms | `chat.js:1073` | gone; an explicit in-transaction count | `directiveTransaction.js:298-301` |
| **(b)** two turns both read `used = 9` → 11 of 10 | the pre-model read was the only read | the retry re-reads 10 and commits with `overBudget` without incrementing | `directiveTransaction.js:294-304`, stamp at `chat.js:1147` |
| **(a)** the write is not conditioned on the battle still being open | `chat.js:1067`, no precondition | re-read inside the write, mode-aware | `directiveTransaction.js:227`, `chat.js:1090` |
| **(e2)** a typed filing can persist while charging nothing (League) | a second transaction at `:1103-1116`, failure swallowed | cross-document in the same transaction | `directiveTransaction.js:268-291`, `chat.js:1238-1253` |
| **(e3)** the typed path compares nothing | no CAS at all | ruling 4 latest-wins + the actual replaced thread | `directiveTransaction.js:237,343,352`, `chat.js:1092` |

Two consequences of moving the write into a transaction, both deliberate and both enumerated in §9: the elicitation ring is now computed from the in-transaction battle (`chat.js:1158-1160`, D-4), and an in-transaction refusal returns rather than throwing, so the turnError shadow record the catch used to produce for that case is written explicitly beside the composed one (`chat.js:1177-1207`, D-5). Four `captureConversation` sites now, still one `logConversation` call.

### Commit C — `4cb20114` · the attestation

Ruling 7, on both routes, success and failure. Closed here:

| Defect | Before | After | `file:line` |
|---|---|---|---|
| **(c-inverse)** a 500/504 for a filing that persisted and charged | three awaits after the landed write inside the same `try`; the catch answered a bare 500/504 | the catch knows which side of the commit it is on and says so | `chat.js:1310-1324`, `directiveTransaction.js:159-163` |
| **(e4)** the 502 is honestly attestable and thrown away | `chat.js:814` | attests `false/false` with the parse reason | `chat.js:844-856` |
| **Q2 site 1** the chip failure line is a persistence claim from a status | `AgentChat.jsx:1080` | the body decides; a `persisted: true` failure renders no failure line | `decisionRecord.js:850-861`, `AgentChat.jsx:1112-1120` |

The post-commit awaits at the old `:1093` and `:1123` stayed where they are; their failure now falls to a catch that attests `persisted: true`, which is the prompt's "caught and attested" arm. Test C-1c is the proof: the document holds the exchange and the charge, the body says so, and the status is still 500.

### Commit D — `39f17671` · the client stops inferring

| Q2 site | Before | After | `file:line` |
|---|---|---|---|
| **4** `chatSendFailed` had no field to read | one line for three states | three states, from the body | `battleViewCopy.js:932-940`, `AgentChat.jsx:976-981` |
| **5** *"The server did NOT charge on either, so the counter is left untouched"* | a cost claim, in so many words, from `!res.ok` | the comment and the claim are gone; the counter follows `charged` | `useArenaEngine.js:32-39, 56-64, 129` |
| **6** the arena's chip, same status-only inference | `useArenaEngine.js:145` | `filingFailureLine(res.status, data)` | `useArenaEngine.js:181-187` |
| **1** (see Commit C) | | | |

`decisionRecord.js` is where the vocabulary is named once (`:803-831`), which is what Build 2 inherits. `CHAT_NOT_SENT_CLAUSE` comes back — `battleViewCopy.js:671-690` already said it would, *"`nothing was sent` comes back when the server attests to it, and that attestation rides the P-1 concurrency branch."* This is that branch.

One new surface: a muted `data-testid="chat-notice"` slot (`AgentChat.jsx:1619-1631`) for ruling 4's line, kept apart from the red `error` slot because nothing failed.

### Commit E — `5715668f` · the cap

`selectBench.js` `FLAGGED_DISPLAY_CAP = 5`. `api/_utils/tickStamps.js` is not touched — no write-side bound. Q4 closed, at the read, per Phase 0 §5.4's honest default. **The placement moved in the review pass** — see below and deviation D-13.

### Commit F — `7d0a0d18` · the review pass

The §2 adversarial review's fourteen in-branch findings, fixed. Two of them were not nits:

- **A-2, a regression this build introduced.** Minting the thread id and the instant *inside* the transaction body made a retried commit compose a different exchange, so `arrayUnion` appended it twice and the first id was stranded. At `c35f9a5` the same write was idempotent. Both are hoisted above `runTransaction` (`directiveTransaction.js:213-232`): one id and one instant per CALL. The residual double-*count* is measured and pinned by row A-2d rather than asserted away.
- **C-1, a copy line that contradicted itself.** `· your message was sent` was appended to *"The character couldn't answer just now"* — beside the answer the same transaction had just committed. There is no positive clause now: a landed turn gets no failure line at all (`battleViewCopy.js`), which is what the chip route already did.

Plus: the commit-then-throw body carries what it committed (B-2/C-4/C-7); a refusal on a re-run answers `persisted: null` (A-1); the cap moved after the spoken-for filter (C-3); the notice clears (C-2/B-1); `persisted: null` gets a claimless filing line (C-5); the eighth client site reads the attestation (C-8); and five smaller corrections (A-4, A-5, A-6, B-3, B-4, B-5, C-9).

Both test fakes now model `arrayUnion`'s **set semantics on deep equality** — the property the hoisted mint relies on, which a naive concat had been hiding.

### Commit G — `08fc22fc` · the mutating lens's gaps

The fourth lens ran **last, alone, on a fresh extraction of the tree the first three had already fixed** — so it mutated what ships, not what was written. ~80 mutations, 66 killed, and the survivors were claims made in prose with no row behind them. Fourteen rows close seven gaps; the sharpest is that **`chat.js`'s pre-model budget check had no test anywhere**, and since ruling 5 makes the transaction never refuse, that check is the only thing capping the typed route at ten messages. Full record in §6.4.
---

## 4. The tests, each shown failing under the defect it names

Method, per the prompt: each server row was run against the **pre-change route** first — a temporary revert of the file under test to the previous commit, with the new test file in place — the failure pasted, then shown green. Client rows were run against the pre-change client the same way. Rows that are **invariance** rows (they assert something must NOT happen) cannot fail against the old code by construction, so they were mutation-checked against the NEW code instead; every mutation is listed with its kill.

### 4.1 Server — against the pre-change route

**A-1 — extraction fidelity.** `api/agent/file-directive.test.js`, 31/31 green after Commit A. The one row that had to move is D-1 in §9.

**B-1 / B-1b / B-2 / B-2b / B-3 / B-4d** — `api/agent/chat.js` reverted to commit A, `chat.test.js` at HEAD:

```
=== PRE-CHANGE ROUTE (chat.js reverted to HEAD = commit A) ===
  × B-1 (a): a battle the close cron completes DURING the model call is refused INSIDE the transaction — nothing written
  × B-1b: review mode is still valid on a completed battle — the in-transaction check follows step 9s own rule
  × B-2 (b, e1): two turns that both read used = 9 → the eleventh COMMITS with overBudget, and the doc reads 10
  × B-2b: a turn within budget charges exactly one, counted from the IN-TRANSACTION read
  × B-3 (e2): a League charge that fails takes the whole filing with it — nothing persists
  ✓ B-4 (e3) / B-4b / B-4c
AssertionError: expected 200 to be 400            ← B-1: the directive LANDED in a completed battle
AssertionError: expected { __op: 'increment', n: 1 } to be 1   ← B-1b: FieldValue.increment, the D-105 contradiction
AssertionError: expected +0 to be 2               ← B-2: no transaction, so no retry, so 11 of 10
AssertionError: expected { __op: 'increment', n: 1 } to be 5   ← B-2b
AssertionError: expected 200 to be 500            ← B-3: the exchange persisted and nothing was charged
  Tests  5 failed | 3 passed | 70 skipped (78)

=== B-4d against the PRE-CHANGE route ===
  × B-4d (e3): with no directive filed this turn, the current-thread answer is the slot the COMMITTING attempt read
AssertionError: expected 'standing-1' to be 'chip-thread-1'
```

B-4/B-4b/B-4c pass against the old route: the old route also files (latest-wins was already by construction) — what it did not do was *report*. **B-4's report half is therefore C-1g**, where it is falsifiable, and B-4d is the falsifiable half of the same defect at commit B. Stated plainly because a row that cannot fail under the defect it names is not a guard.

**C-1a…h and C-2** — both routes reverted to commit B, `chat.test.js` at HEAD:

```
=== C rows against the PRE-ATTESTATION routes (HEAD = commit B) ===
  × C-1a: THREW BEFORE the transaction — a timed-out model call attests false / false
  × C-1b: REFUSED INSIDE the transaction — the closed battle attests false / false with the reason
  × C-1c: COMMITTED THEN THREW — the doc holds the exchange and the charge, and the body says so
  × C-1d: the transaction itself throwing says it does NOT KNOW — never a false claim
  × C-1e: a clean success attests persisted / charged too
  × C-1f: a filing that lands and costs NOTHING says so — charged is not persisted
  × C-2 (e4): the 502 parse path is post-model and PRE-write — it attests false / false
  × C-1g (e3): a typed filing that replaced a chip filing NAMES the thread it replaced
AssertionError: expected undefined to be false   (×4)
AssertionError: expected undefined to be true    (×3)
AssertionError: expected undefined to be null    (×1)
  Tests  8 failed | 1 passed | 79 skipped (88)
```

**C-3 — structural.** `research.dark.test.js:158-182`'s source-walking invariant extended to both directive routes (five new rows), with the behavioural rows beside it, not instead of it. Against the pre-attestation routes:

```
  × api/agent/chat.js: every refusal ABOVE the filing transaction attests
  × api/agent/file-directive.js: every refusal ABOVE the filing transaction attests
  ✓ api/agent/chat.js: nothing BELOW the transaction claims false / false
  ✓ api/agent/file-directive.js: nothing BELOW the transaction claims false / false
  × the vocabulary has ONE home, and both routes read it from there
  ✓ the unknown side of an ambiguous commit is `null`, never `false`
```

**The mutation harness reported a SURVIVOR before any kill was trusted.** The two "nothing BELOW" rows pass against the old code trivially, so they were mutation-checked — and the first mutation **survived**:

```
=== MUTATION: a 'persisted: false' claim injected BELOW the transaction ===
   (clientResponse.persisted = false;  — the ASSIGNMENT form)
  Tests  2 passed | 17 skipped (19)          ← SURVIVOR. The row was not a guard.
```

The row matched only the object-literal `persisted: false`. It was widened to `/persisted\s*[:=]\s*false/` (`research.dark.test.js`, with the reason written down in the row itself), and re-checked in both forms:

```
=== MUTATION: assign  ===  Tests  1 failed | 1 passed | 17 skipped   ← killed
=== MUTATION: literal ===  Tests  1 failed | 1 passed | 17 skipped   ← killed
=== restored          ===  Tests  2 passed | 17 skipped
```

That survivor is the harness's own proof: it demonstrably reports a survivor, so the kills below can be trusted.

### 4.2 Client — mounted, real response shapes, no source greps

Against the pre-change client (all four client source files reverted to commit C):

```
=== D-1 rows against the PRE-CHANGE client (HEAD = commit C) ===
  × D-1k: a failure that attests `charged: true` SPENDS one — the counter moves
  × D-1n: a body carrying its own authoritative `remaining` still wins
  × D-1o: a chip filing whose body attests PERSISTED is not rendered as a failed filing
  × D-1q: a 500 whose body attests PERSISTED renders NO failure line — the filing landed
  × D-1r: …and the filed thread becomes the belief, so the chips retire as they do on a 200
  × D-1a: a `persisted: false` body renders the FAILED state — the clause comes back
  × D-1b: a `persisted: true` body renders the FILED state — never the failed one
  × D-1g: the two clauses are the record module's, not literals in the component
  × D-1h: the line renders from `replacedThreadId` on the body
  Tests  9 failed | 37 passed (46)
```

The other nine D rows are invariance rows (the claimless default, the untouched counter, the absent notice, flag-off byte-identity, the attested-false line). Mutation-checked against the NEW code — five mutations, five kills:

| # | Mutation | Result |
|---|---|---|
| M1 | `chatSendFailedLine` always appends `· nothing was sent` | **5 failed** — killed |
| M2 | `chargedRemaining` always spends one | **2 failed** — killed |
| M3 | the replaced-directive notice always fires | **1 failed** — killed |
| M4 | `filingFailureLine` always returns null | **7 failed** — killed |
| M5 | the flag-off branch takes the controller copy | **2 failed** — killed |

### 4.3 The cap

```
=== E rows against the PRE-CAP selectBench ===
  × E-1: six flagged names on the stamp render FIVE chips
  × E-1d: the cap is a NAMED constant, and it is five
AssertionError: expected [ 'NOW', 'TSLA', 'CRWD', 'PLTR', …(2) ] to have a length of 5 but got 6
AssertionError: expected undefined to be 5
```

E-1b and E-1c are invariance rows, mutation-checked:

| # | Mutation | Result |
|---|---|---|
| M6 | the cap set to 4 | **3 failed** — killed |
| M7 | the capped-out sixth dropped from the roster's rest as well | **1 failed (E-1b)** — killed |

### 4.4 The review pass's rows

Twenty-six rows added in commit F, each against the finding it closes. Against the **pre-review-fix tree**:

```
=== the new client rows against the PRE-REVIEW-FIX tree ===
  × D-1o  a chip filing whose body attests PERSISTED LANDS — receipt, belief and counter
  × D-1w  a 500 / 409 / 429 / 422 that attests an UNKNOWN commit gets the claimless line   (4 rows)
  × D-1b  a `persisted: true` body renders the FILED state — no failure line at all
  × D-1b2 …and the reply the turn committed can render beside it without contradiction
  × D-1f2 FLAG OFF — an attested landing still renders no failure line
  × D-1g  the clause is the record module's, not a literal in the component
  × D-1t  the notice belongs to its TURN — a later clean send clears it
  × D-1u  …and a later FAILED send clears it too — never beside `nothing was sent`
  × D-1v  …and it does not follow the player into another battle
  Tests  12 failed | 43 passed (55)

=== the server rows against the PRE-FIX module ===
  × A-1   a refusal decided on a RE-RUN says it does not know, never `false`
  × B-2   a throw after the commit answers 500 WITH the directive, the replaced thread and the counter
AssertionError: expected false to be null
AssertionError: expected undefined to be 'filed'

=== A-2 against the PRE-FIX module (the mint inside the body) ===
  × A-2b  …with ONE thread id, so a directive filed on the re-run strands nothing
AssertionError: expected [ { …(12) }, { …(12) } ] to have a length of 1 but got 2

=== C-8a against the PRE-FIX Film Room chat ===
  × C-8a  a `persisted: true` failure keeps the bubble and makes NO reachability claim
AssertionError: expected '…' not to contain 'Could not reach the agent. Try again.'
```

Two of the new rows are invariance rows and were mutation-checked instead: **A-4** (move the agent read above check 4 → the row reds; at the pre-fix module the same mutation stayed green, which is why the row exists) and **E-1e** (move the cap back inside `selectFlagged` → the row reds; the four rows written at the prescribed placement all stayed green, finding C-10).

**One row is honest about its own limit.** A-2's no-directive variant is deterministic *after* the fix (the hoisted instant makes the element identical) but its mutation check is timing-dependent — two attempts microseconds apart can share a millisecond, in which case the pre-fix code deduped by luck. **A-2b is the deterministic one**, because a re-minted UUID always differs. Said here rather than left for a reader to discover.

**And one measures a limit rather than asserting it away.** A-2d pins what an ambiguous commit still costs after the fix: one exchange on the document, `chatBudgetUsed` up by **two**. That is the residual §7 describes, as a number in the suite rather than a sentence in a report.

### 4.5 The mutating lens's rows

Fourteen rows in commit G, each closing a mutation that **survived** the suite. They are the one group here that cannot be "shown failing against the pre-change code", because the code is correct and the tests were the gap — so every one is mutation-checked instead, and every mutation now dies:

| # | Mutation | Result |
|---|---|---|
| L1 | delete `chat.js`'s pre-model cap check | **2 failed** — killed |
| L2 | drop both `normalized` gates on the replaced-thread report | **1 failed** — killed |
| L3 | `attestThrown` hardcodes `charged: true` | **1 failed** — killed |
| L4 | the elicitation ring from the pre-model snapshot | **1 failed** — killed |
| L5 | flatten the refusal's `turnError` reason | **1 failed** — killed |
| L6 | drop the `filingAttempted` reset on **both** routes | **2 failed** — killed |
| L7 | commit-then-throw always reports `filed` | **1 failed** — killed |
| L8 | the fake's `arrayUnion` dedupes **everything** | **1 failed** — killed |
| L9 | the fake's read-before-write guard removed | **1 failed** — killed |

Before commit G, every one of these nine left the suite green.

### 4.6 The pins that must not move

| Pin | State |
|---|---|
| `chat.test.js` ENFORCE exchange shape | **byte-identical to `c35f9a5`** — verified by hashing the row and its 14 following lines at base and at head. |
| `chat.test.js` flag-OFF legacy shape | **byte-identical to `c35f9a5`** — same check, same result. |
| `chat.test.js` `chatBudgetUsed` → `{ __op: 'increment', n: 1 }` (two rows) | **MOVED, deliberately** — to the explicit count `1`. This is the D-105 change itself, not an exchange-shape pin; the prompt's protected pins are the ENFORCE and flag-OFF *exchange shapes*, which did not move. |
| `file-directive.test.js` exact refusal bodies (409/422/429) | **extended** — the three keys of ruling 7 added; every pre-existing key and value unchanged. |
| `research.dark.test.js` research-route invariant | **untouched**; the two directive-route rows were added beside it. |

---

## 5. Verification

### 5.1 The full suite, with the exit code asserted

Never piped through `tail` or `head` — written to a file, the exit code captured from `$?`:

```
$ npx vitest run --reporter=dot > full3.txt 2>&1; echo "VITEST_EXIT_CODE=$?"
VITEST_EXIT_CODE=0
 Test Files  656 passed | 3 skipped (659)
      Tests  12455 passed | 64 skipped (12519)
```

Baseline at `c35f9a5`, run before the first edit, same command:

```
VITEST_EXIT_CODE=0
 Test Files  655 passed | 3 skipped (658)
      Tests  12368 passed | 64 skipped (12432)
```

**+87 tests, +1 file (the new Film Room suite), nothing newly skipped, exit 0 every time.** Three full runs are on the record: the pre-review head `5715668f` (12,415), the first review pass `7d0a0d18` (12,441), and the head that ships (12,455). The review's two passes added 40 rows between them.

*(`npm ci` was run first — the container's `node_modules` was absent, so the first baseline attempt failed with `Cannot find package 'vitest'`. Recorded because a "suite green" claim on an uninstalled tree would be worthless.)*

### 5.2 `vite build`

BUILD_RULES §2: no test in the repo imports `App.jsx`, so the build is the only check that catches a syntax error there.

```
$ npx vite build; echo "VITE_BUILD_EXIT=$?"
✓ built in 20.74s
VITE_BUILD_EXIT=0
```

Run three times — the pre-review head, the first review pass, and the head that ships — exit 0 each time.

### 5.3 Lint

`claude/lint-node-globals` has **not** merged at `c35f9a5` — `npx eslint api/` still reports 601 pre-existing `'process' is not defined` errors tree-wide. So, as the prompt directs, the error count **on the touched files**, before and after:

| File | at `c35f9a5` | at `5715668f` |
|---|---|---|
| `api/agent/chat.js` | 0 errors, 0 warnings | 0 errors, 0 warnings |
| `api/agent/file-directive.js` | 0, 0 | 0, 0 |
| `api/_utils/directiveTransaction.js` | (absent) | 0, 0 |
| `api/agent/chat.test.js` | 0, 0 | 0, 0 |
| `api/agent/file-directive.test.js` | 0, 0 | 0, 0 |
| `api/agent/research.dark.test.js` | 0, 0 | 0, 0 |
| `src/data/decisionRecord.js` | 0, 0 | 0, 0 |
| `src/screens/battleView/battleViewCopy.js` | 0, 0 | 0, 0 |
| `src/components/Agent/AgentChat.jsx` | **4 errors, 1 warning** | **4 errors, 1 warning** |
| `src/components/League/battleArena/useArenaEngine.js` | 0, 0 | 0, 0 |
| `src/screens/battleView/selectBench.js` | 0, 0 | 0, 0 |

**No rise anywhere** (the twelve touched source files; the eight test files are 0/0 before and after). `AgentChat.jsx`'s four are pre-existing and identical (`'err' is defined but never used`, `'budgetColor' is assigned a value but never used`, and two more); the build neither added nor removed one. Two `react-hooks/exhaustive-deps` warnings that the first draft of `useArenaEngine.js` introduced were removed by reading `remaining` from the state inside the updater rather than closing over `eng.remaining` — which is also the correct fix for two failures in flight.

### 5.4 The `git diff --stat` assertions

Programmatic, against all eleven §1 paths and the three named exclusions:

```
NO FENCED FILE IN THE DIFF (BUILD_RULES.md:14-24, all eleven checked)
ABSENT: src/config/featureFlags.js
ABSENT: api/_utils/tickStamps.js
DARK_BY_DESIGN lines in the code diff: 0
```

`DARK_BY_DESIGN` appears once in `api/agent/research.dark.test.js:11` — a pre-existing comment, present at `c35f9a5`, and the diff of that file contains zero lines mentioning it.

**One precision for anyone re-running that check after this report is committed:** `git diff c35f9a5..HEAD | grep -c DARK_BY_DESIGN` returns **3**, and all three are lines of *this document* — the flag statement above and the two lines you are reading. `git diff c35f9a5..HEAD --name-only -G'DARK_BY_DESIGN'` returns this file and nothing else. No code line in the build mentions it.

The two adjacent gates:

- **The `createAgentBattle` doc shape is fenced as a concept.** Every key the shared transaction can write to the battle doc is an existing one: `chatExchanges`, `directive`, `chatBudgetUsed` / `reviewBudgetUsed` (the caller's `battleBudget.field`), and `recentElicitationTargets` (the caller's `buildBattleUpdate`). **B2 adds no battle-doc key.** The League counter stays in its own collection, which is why it is there.
- **The composition-protected-stores allowlist.** The two handle-form write sites moved file; their rows moved with them and the stale ones were pruned in the same commit. `api/_utils/compositionProtectedStores.scan.test.js` is 9/9, including its "the allowlist is not stale" ratchet in both directions.

---

## 6. The §2 adversarial review

**Pre-commissioned in the prompt** (the branch crosses seventeen files / 2,754 lines — past the BUILD_RULES §2 threshold in both directions), and run as §2 prescribes: multi-lens, adversarial, independently verified, `vite build` included, mutation-checked, written down.

### 6.1 The setup

| | |
|---|---|
| Lenses | **4** — A transaction semantics · B wiring, lifecycle and the flag-off guarantee · C client honesty and display agreement · D mutation / test integrity |
| Isolation | one `git archive` extraction per lens, **path-distinct** (`scratchpad/lensA…lensD`), `node_modules` symlinked. Every lens read-only on git and on the shared working tree — the Reviewer-B precedent (`20260902_EXIT_BEHAVIOR_ASK2_BUILD_REVIEW.md` §10) |
| Order | A, B, C in parallel on `5715668f`; **D last, alone, on a fresh extraction** at `7d0a0d18` — after A/B/C's findings were fixed, so it mutates the tree that ships |
| Instruction | **refute**, with a concrete repro per finding, then refute your own finding |
| Build | `vite build` exit 0 (§5.2) — the only check that catches a syntax error in `App.jsx` |

### 6.2 The verdict

**26 findings CONFIRMED across the four lenses, 15 REFUTED. 24 closed in-branch** (`7d0a0d18` for lenses A–C, `08fc22fc` for lens D); **2 filed, not fixed** because they are pre-existing or inherited (BUILD_RULES §3), plus the §7 STOP item.

The table below is lenses A–C; lens D's nine are §6.4, because they are a different kind of finding — not a defect in the code but a claim with no test behind it.

| # | Lens | Sev | What | Disposition |
|---|---|---|---|---|
| **A-2** | A | **high** | **A REGRESSION THIS BUILD INTRODUCED.** The thread id and the instant were minted INSIDE the transaction body, so a re-run after an ambiguous commit composed a *different* exchange: `arrayUnion` appended it twice, the first id was stranded on a persisted exchange, and the turn duplicated. At `c35f9a5` the same write was idempotent — the element was fully materialized before the call. | **FIXED.** Both hoisted above `runTransaction`: one id and one instant per CALL. Rows A-2/A-2b/A-2c; A-2b fails against the pre-fix module. |
| **A-1** | A | med | A refusal decided on a RE-RUN may be reading this transaction's own landed commit — and it claimed `persisted: false, charged: false` for a filing that did both. The exact false claim ruling 7 exists to prevent, one layer down. | **FIXED.** The body counts its attempts; a refusal on attempt > 1 answers `null`, the same rule `attestThrown` already applied to a throw. Rows A-1/A-1b. |
| **B-2 / C-4 / C-7** | B, C | med-high | The commit-then-throw body carried the attestation **and nothing else**, so it was unusable: the chat's chips never retired, the arena — which does not read `chatExchanges` at all — rendered nothing, the belief stayed stale, and the next tap 409'd against the player's own invisible filing. D-1r pinned a body neither route could send. | **FIXED.** The body carries what it committed (status, directive, replaced thread, remaining). Rows B-2, D-1o, D-1r. |
| **C-1** | C | **high** | `· your message was sent` was appended to *"The character couldn't answer just now"* — but a `persisted: true` turn committed an exchange carrying `agentResponse`, so the listener renders the character's answer beside a sentence saying it could not. Two clauses of one line, from two sources, disagreeing: the §9 family, and the mirror of the `1/10` + "nothing was sent" smoke the clause was deleted for. | **FIXED.** There is no positive clause. A landed turn gets **no failure line at all**, which is what the chip route already did for the same body. Rows D-1b, D-1b2, D-1g. |
| **C-3 / C-10** | C | med | The first-five cap was inside `selectFlagged`, before the spoken-for filter — so a name a sentence already carried consumed a slot and produced no chip. Six flagged names of which three were spoken for rendered **two** chips and dropped a sixth that would have fit. The four E rows were all blind to the placement. | **FIXED.** The cap moved after both filters. Rows E-1e (the placement row) and E-1f; moving the slice back reds E-1e. |
| **C-2 / B-1** | B, C | med | `setNotice` had no `null` caller anywhere: the replaced-directive line outlived its turn, its battle, and sat beside a later failure the route attested was never sent. | **FIXED.** Cleared on every send, filing, Show-it and battle change. Rows D-1t/D-1u/D-1v. |
| **C-8** | C | med | **An EIGHTH client of `POST /api/agent/chat`** that Phase 0 §3.2's census missed: `FilmRoomChat.jsx` posts `mode: 'review'` to the same route, rolled the bubble back on any non-ok and claimed the agent could not be reached. | **FIXED**, with its own mounted suite (`FilmRoomChat.attestation.jsdom.test.jsx`, 5 rows). C-8a fails against the pre-fix component. The Phase 0 census is corrected in the errata (§8, E-8). |
| **C-5** | C | med-low | An explicit `persisted: null` fell through to the status map and got a definite negative — *"nothing was filed"* on a body that says *unknown*. The chat half already took the claimless line for the same body. | **FIXED.** `FILING_UNKNOWN_LINE`. Rows D-1w (four statuses). |
| **A-6** | A | low | `buildBattleUpdate` was spread LAST, so a caller key could silently override `directive` or the budget field. Latent. | **FIXED.** Spread first; the module's own writes win by construction. |
| **A-5** | A | low | `chargeAgentChatBudget` has had no production caller since commit B, and both its module header and a comment in the new module still called it the live charge — the stale-header defect BUILD_RULES §6 warns about. | **FIXED**, both sites. |
| **A-4** | A | low | The chip suite did not pin that check 4 runs BEFORE the agent read, so moving the agent read above it stayed green — an unguarded corner of "its suite is the proof the extraction is faithful". | **FIXED.** Rows A-4/A-4b; the mutation now reds. |
| **B-3** | B | low | A comment claimed the outcome's `reason` was "carried beside" `off_menu`; it is overwritten. | **FIXED** — the comment now records the 422 as the one deliberate vocabulary exception. |
| **B-4** | B | low | *"the flag-off clientResponse is byte-identical"* was falsified three lines below itself, and the row calling itself byte-identical asserted individual keys, never the key set. | **FIXED** — the comment corrected, and the row now pins the whole key set. |
| **B-5** | B | low | `filingAttempted` never reset, so a throw after an in-transaction refusal would downgrade a known `false` to unknown, costing the client the clause it was entitled to. Unreachable today. | **FIXED** on both routes. |
| **A-3** | A | **high, pre-existing** | `leagueAsk: true` on a **non-tournament** battle bypasses BOTH budgets — the pre-model cap check is skipped and `resolveBudgetDay` fail-opens. Ten sends at `chatBudgetUsed: 10` all answer 200 and charge nothing. Identical guards exist at `c35f9a5`. | **FILED, NOT FIXED** (BUILD_RULES §3). §11 item 5. |
| **C-6** | C | low, inherited | The kept bubble double-renders when sanitisation rewrote the text (`chat.js` strips `\n\r\t<>{}`); reconciliation compares exact trimmed text. Pre-existing on the success path; B2 extends it to the failure path. | **FILED, NOT FIXED.** The 30-second sweeper retires it. §11 item 6. |
| **C-9** | C | low | An unreachable fallback arm in the arena, with a comment describing a fallback that did not exist. | **FIXED** as part of B-2/C-4. |

**REFUTED** (recorded because a review that never refutes itself has not been run): `resolveBudgetDay`'s non-transactional `.get()` breaking the read-before-write contract (it never touches `tx`; every `tx.get` precedes both writes on every path and policy combination, in the same position as at `c35f9a5`); the flag-OFF **exchange** gaining, losing or changing a key (mechanical key-by-key extraction against `c35f9a5` — identical set, order and spread predicates, the only insertion being `overBudget`, unreachable within budget); a path reaching the model writing zero shadow records, or a catalog event going fire-and-forget; body-shape coercion (`persisted: 'true'`, `1`, `[]`, `{}` all fall to the claimless line — the readers are `=== true`); two arena failures in flight double-decrementing (`inFlightRef` gates both, and the updater reads from state anyway); an un-retirable bubble (the 30-second sweeper always retires it).

### 6.3 The mutation harness, and its survivor proof

**A survivor was reported before any kill was trusted.** The first C-3 structural row matched only the object-literal `persisted: false`; the mutation check injected the **assignment** form and the row stayed green:

```
=== MUTATION: a 'persisted: false' claim injected BELOW the transaction ===
   (clientResponse.persisted = false;  — the ASSIGNMENT form)
  Tests  2 passed | 17 skipped (19)          ← SURVIVOR. The row was not a guard.
```

It was widened to `/persisted\s*[:=]\s*false/`, with the reason written into the row, and both forms then killed it. That survivor is the coordinator harness's proof. **Lens D proved its own harness independently** before reporting a single kill — a genuine no-op (a local rename plus a reorder of two independent `const`s) ran 129/129 green, and a control mutation (`count >= limit` → `count >`) produced a single *assertion* failure, not an import or syntax error:

```
--- SURVIVOR PROOF (expected to survive) ---
  Tests  129 passed (129)
--- CONTROL KILL (expected to die) ---
  FAIL … a League battle with the day's ten spent → 429, nothing written
  Tests  1 failed | 128 passed (129)
```

### 6.4 Lens D — the mutating lens, and what it found unguarded

**~80 mutations across nine production files and both test fakes: 66 killed, 7 CONFIRMED gaps, the rest refuted as equivalent or unreachable.** Every gap is a claim this build makes in prose or in a comment with no row behind it. All seven are closed in `08fc22fc` by fourteen rows, and every one of the nine mutations below now dies:

| # | The mutation that survived | Why it matters | Killed by |
|---|---|---|---|
| **D-1** | Delete `chat.js`'s pre-model budget check | **The sharpest.** Ruling 5 keeps that check *"so a player never waits twenty seconds for a 429"* — and because the transaction runs `COMMIT_OVER_BUDGET` and never refuses, it is now the **only** enforcement of the ten-message cap on the typed route. There was no row for it anywhere: the mutant answered **200 with a committed exchange** where the real route answers 403 with no model call. | D-1, D-1b (the `>=` boundary), D-1c (review's own cap), D-1d (the League bypass) |
| **D-2** | Drop the `normalized` gates on `replacedDirectiveThreadId` and `staleExpectation` | Survived individually **and together**, because every `replacedThreadId` row filed a directive. A turn that files nothing would claim it replaced one — and the chip's directive is still the live slot, so the player is told a false thing about their own filing. B-4d built the exact fixture and stopped one assertion short. | D-2 |
| **D-3** | `attestThrown`'s `charged: committed.charged` → `true` | Survived because the only committed-then-threw rows charged. An over-budget eleventh or a fail-open League filing that throws post-commit would claim a spent message — and the arena decrements on `charged`, so the player loses one they never spent. **Exactly the charged-is-not-persisted distinction ruling 7 exists to make.** | D-3 |
| **D-4** | The elicitation ring from the pre-model snapshot; and dropping its `.slice(-3)` | **Zero assertions anywhere** — the field appeared in the suite only as fixture setup. The mutation is the defect the code's own comment names. (The row reassigns the array rather than pushing to it: the fake's per-read snapshot is shallow, so a push would alias and pass vacuously — lens D's own warning.) | D-4 |
| **D-5** | Flatten the refusal's `errorReason`; clear its `turnError`; drop one of its two records | The BUILD_RULES §5 signal-capture surface, unguarded: a refusal's diagnostic record could lose its reason or vanish, silently. | D-5 |
| **D-6** | Remove the `filingAttempted` reset on both routes | Lens B's own finding B-5 fix shipped without a guard: a throw after a refusal would downgrade a **proven** `false` to unknown, costing the client the clause it is entitled to. | D-6 (both suites) |
| **D-7** | The commit-then-throw receipt always reports `filed` | The one case the chip's receipt strip distinguishes — a filing that replaced a prior directive — reported the wrong status. | D-7 |
| **Fake 1** | `arrayUnion` dedupes **everything** | Nothing pinned that the dedupe is *conditional*, so the documented KNOWN LIMIT (a retry that crosses the cap composes a different element and must **not** dedupe) was unpinned. The row that closes it **measures** the limit: two exchanges, and the second carries `overBudget`. | D-7 (chat) |
| **Fake 2** | Remove the read-before-write guard | The R-29 guard had **never fired** on any row in either suite. | D-8 (both suites) |

**One survivor is recorded REFUTED rather than closed.** The `tx.update` key-precedence hardening (finding A-6) has no observable behaviour today: the only `buildBattleUpdate` caller returns `recentElicitationTargets`, which cannot collide with the keys the module owns. It is defence-in-depth for a future caller and is uncoverable without one. Written down rather than given a vacuous row.

**Also refuted by lens D, and worth recording**: `attestsPersisted`/`attestsCharged`'s `=== true` versus `!!` (equivalent over the value domain the routes emit — `{true, false, null, absent}`); the `groupId` conditionals (they need a tournament battle with no `groupId`, or a standard battle carrying one, neither of which the product produces); and five client defensive arms whose preconditions the routes never produce — two of which the code already says so about in a comment.

### 6.5 What IS guarded

Lens D's kill list, as the positive record: both conflict policies (12 kills), both budget policies, the explicit count versus `FieldValue.increment`, the over-budget commit-without-incrementing, the League fail-open, the hoisted mint (32 kills), the attempt-aware refusal attestation, `attestThrown`'s `attempted` arm, `replacedPrior`'s legacy-text arm, `priorDirectiveThreadId`, `requireActive` in both directions, the **read order** (17 kills), all five of the exchange builder's conditional spreads, `isLeagueBudget` as the request's decision, the grounded `currentDirectiveThreadId` fallback, both reject policies (11 kills), the commit-then-throw receipt fields, the 422's `off_menu` vocabulary exception, the server-derived budget store, all four `filingFailureLine` arms, all three `chatSendFailedLine` arms, **the bench cap's placement** (moving the slice back before the spoken-for filter reds E-1e exactly as its comment promises), both `landed` branches and their in-flight filtering, the arena's counter arithmetic and belief adoption, the notice clearing, and the Film Room's fallback.

---

## 7. STOP — the one outcome §2 is silent on

**The prompt's instruction was:** *"If §2 is silent on an outcome the transaction can produce, STOP and report; do not invent the behaviour."* This is that report. It did not stop the build, because the outcome is pre-existing on the chip route and was explicitly ruled out of B2's scope by Phase 0 — but it is the thing on this branch a founder ruling should land on.

**The outcome.** `runTransaction` retries. `@google-cloud/firestore` re-runs the transaction body on a retryable commit error (UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL), and **a commit that LANDED whose reply was lost surfaces as exactly that error**. So a fourth position exists beside ruling 7's three:

| Position | §2 names it? | What the route knows |
|---|---|---|
| threw before the transaction | yes (`:53`) | nothing persisted, nothing charged |
| refused inside it | yes (`:53`) | nothing persisted, nothing charged |
| committed, then threw | yes (`:53`) | it persisted; it charged what it charged |
| **the transaction itself threw** | **no** | **it cannot tell** |

`research.js:193-200` writes this hazard down for its own route in so many words, and it is why that route's in-transaction refusals deliberately carry no attestation.

**What it means for each policy.**

- **The chip route (`reject`).** A retry after its own landed commit re-reads the new thread id, `currentThreadId !== expectedDirectiveThreadId`, and returns `conflict` **without writing** — Phase 0 §6.3 confirms this and it still holds. The write is safe. What is NOT safe is the *attestation*: that `conflict` would carry `persisted: false, charged: false`, and its own commit did both. **Pre-existing in substance** (the route has always answered a 409 there); newly a false claim only because the build added the claim.
- **The typed route (`replace-and-report`).** The CAS does not refuse, so a retry after a landed commit would **file a second directive and charge a second message.** This is the sharper half. It is not new in *class* — at `c35f9a5` the typed path's `battleRef.update()` carried `FieldValue.increment(1)`, which is not idempotent under an RPC retry either — but it is new in *shape*, and it is the one thing on this branch I would want ruled before merge.

**What the build did, and did not do.**
- It did **not** invent an idempotency mechanism. Phase 0 §6.2 records that idempotency is *"Absent from the spec and from both routes"*, and §6.5 puts it in Build 2. Inventing it here would have been exactly the improvisation the prompt forbids.
- It did **not** claim `false` where it cannot know. `attestThrown` (`directiveTransaction.js:159-163`) answers `persisted: null, charged: null` when the transaction was entered and did not report a commit. Both reader helpers test `=== true`, so an unknown reads as **no claim on either side** and the client falls to its claimless line (rows C-1d and D-1d). This is the conservative direction and it matches `research.js`'s own precedent in this repo; it is nonetheless **an encoding §2 does not name**, and it is flagged here rather than buried.

**What the review pass already took off the table.** The mint is now hoisted above `runTransaction` (deviation D-16), so one call has one id and one instant: the exchange element is byte-identical across attempts and `arrayUnion`'s set semantics make the append idempotent. A re-run no longer duplicates the turn or strands a thread id — the half of this hazard that this build had *introduced* is gone, and `c35f9a5`'s idempotency is restored. The chip route is additionally protected by its CAS, exactly as Phase 0 §6.3 says.

**What remains, measured.** The COUNT still moves twice, because `used + 1` is read fresh on the attempt that re-runs. Row A-2d pins it: one exchange on the document, `chatBudgetUsed` up by two. That is the same non-idempotence `FieldValue.increment(1)` had under an RPC retry at `c35f9a5`, so it is not a regression — but it is not fixed either.

**The fix, when it is ruled** (the shape Phase 0 §8 item 4 already recommends, and the one Build 2 gives `research.js`): make the body a **no-op when it finds its own key already on the document** — which the hoisted mint now makes possible, since the body can recognise its own id. One comparison, and the double count goes. **Not built**, because Phase 0 §6.5 puts idempotency in Build 2 and building it here would be the improvisation the prompt forbids. **Filed for a founder ruling.**

---

## 8. Spec errata (the spec is not silently patched)

Every row is a place where `docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md` and the tree disagree. **No edit was made to the spec.** Phase 0 §6.1 tabulates the first three; they are re-verified at my HEAD here.

| # | Spec says | At `c35f9a5` / at `5715668f` |
|---|---|---|
| **E-1** | `:50` — extract `file-directive.js:196-299` | **Correct, undrifted.** `:196` was the `runTransaction` opener and `:299` its close at `c35f9a5`. |
| **E-2** | `:51` — the chat path's hand-off is `chat.js:996-1008` | At `c35f9a5` the mint was `:1005`, the exchange `:1021-1063`, the write `:1067-1079`. After the build the hand-off is `chat.js:1074-1166`. |
| **E-3** | `:51` — the slot as read at turn start is `chat.js:950-951`; `:52` — the pre-call budget check is `chat.js:496-510` | At `c35f9a5`: `:950` is `mode` inside `clientResponse`, and the slot-as-read is `:1016-1018`; the budget check is `:502-522`. After the build: the slot as read is `chat.js:1074-1076`, the pre-call check `chat.js:524-544`. |
| **E-4** | `:4` — *"Founder rulings 1–9 confirmed Sep 8"* | **The list of nine is not enumerated anywhere in the repo.** §2 numbers three of them inline (4, 5, 7); `20260909_SOL_REVIEW_PHASE_B_TICK_STAMPS_PASS.md:1,117` refers to "rulings 1–9" without listing them either. §2 of this report states the seven §2 prescriptions in document order and marks which three the spec numbers itself. A founder-supplied list would retire the ambiguity. |
| **E-5** | `:53` — *"`CHAT_NOT_SENT_CLAUSE` in `decisionRecord.js`"* | The constant did **not** exist at `c35f9a5` — it was deleted (`battleViewCopy.js:666-690` records the deletion and why). The spec names it as if it were live. This build creates it, at `decisionRecord.js:823`, which is what the spec's sentence requires; the errata is that the spec reads as a reference to existing code and is not one. |
| **E-6** | `:53` — *"committed then threw (persisted **and charged**)"* | The parenthetical describes the ordinary case. A committed turn can be `charged: false` — a League filing whose game day would not resolve (fail-open) and an over-budget eleventh both persist without costing a message. The build reports the outcome's **actual** `charged`, not a hardcoded true (test C-1f). |
| **E-7** | `:52` — the League charge cites `chat.js`'s second transaction implicitly | Phase 0 §2.4(e2) gives its anchor as `:1103-1116`, correct at `c35f9a5`; it is now deleted. |

| **E-8** | Phase 0 §3.2 — *"**Seven** client sites infer cost or persistence from an HTTP status"* | **Eight.** `src/components/FilmRoom/FilmRoomChat.jsx` posts `mode: 'review'` to the same `POST /api/agent/chat`, is mounted unflagged from `FilmRoomScreen.jsx`, rolled the optimistic bubble back on **any** non-ok status and claimed the agent could not be reached. Found by this build's own adversarial review (lens C, finding C-8), not by the census. Fixed in commit F, with its own mounted suite. The census's *verdict* stands — the seven it lists were correctly classified — but its count was one short, and "four fixed, two deferred" was a split over an incomplete set. |

Also recorded, not an errata: Phase 0 §0.1's caution about `claude/flip-shadow-assembly-off` editing `featureFlags.js`. **That branch has not merged** — `origin/main` is still `c35f9a5`, and this build does not read or edit `featureFlags.js` at all.

---

## 9. Deviations, each with its reason

Enumerated per the prompt. Nothing below was improvised silently.

| # | Deviation | Reason |
|---|---|---|
| **D-1** | The prompt says *"`api/agent/file-directive.test.js` passes unchanged after Commit A"*. **One of its 31 rows changed** (and the review pass later added six more rows to the file). | That row (`the persisted shape IS the chat turn's shape`) is a cross-route **source-text** row asserting both routes call `buildDirectiveRecord(` / `buildDirectiveSlot(` directly. The prescribed extraction moves those calls into the shared module — so the row asserts the pre-extraction topology by construction and could not survive it. It was rewritten to follow the shape to its new home, and is **stronger**: it now asserts the shared module imports `directiveFiling.js` and calls both builders, that each route reaches them only through that module, and that neither route re-inlines the legacy literal. There is now **one caller of the builders, not two**. The other 30 rows are byte-unchanged. It was split across commits A and B so each commit is green on its own. |
| **D-2** | The module takes a **builder** for the exchange, not the composed object the spec's words describe. | The same sentence (`:50`) gives the module *"the mint"*. A fully composed exchange must already carry the minted `directiveThreadId`, so passing one in would move the mint out of the module and contradict the clause beside it. The builder is called once per attempt with the id and the in-transaction battle; **the composition is still entirely the caller's** — `file-directive.js:244` and `chat.js:1109-1156` produce byte-identical objects to the ones they produced before. |
| **D-3** | The spec says the chat path passes `mode`; the module receives `requireActive: mode !== 'review'` instead. | `mode` is only needed for one decision inside the transaction — whether a non-active battle is a refusal (`chat.js` step 9's own rule: review mode is valid on a completed battle). Passing the derived boolean keeps the mode vocabulary out of a module that has no other use for it; the chip route passes `requireActive: true`, which is what it always did. |
| **D-4** | `recentElicitationTargets` is now computed from the **in-transaction** battle, not the pre-model snapshot (`chat.js:1158-1160`). | It is written inside a transaction now. Computing one of its fields from a twenty-second-old read is how a concurrent turn's target gets clobbered on the retry — the same class of defect the build exists to remove. Strictly more correct; recorded because it is a behaviour change §2 does not prescribe. |
| **D-5** | A **fourth** `captureConversation` site (`chat.js:1177-1207`). | An in-transaction refusal *returns* rather than throwing, so the turnError shadow record the catch block used to produce for a failure at that point would silently vanish — a Signal Capture Rider (BUILD_RULES §5) regression. The refusal path now writes the same pair a throw would have: the composed record plus a turnError row naming the refusal. `chat.test.js`'s "exactly ONE `logConversation` call site" row was updated from three record sites to four, with the reason in the row. |
| **D-6** | The exchange's `timestamp` and the directive slot's `createdAt` now come from one `now` per attempt; at `c35f9a5` they were two separate `new Date().toISOString()` calls microseconds apart. | A consequence of one transaction body owning both. Both are still ISO strings of the same instant; `file-directive.js` has always done it this way. No test pins the difference. |
| **D-7** | The arena rows live in `useArenaEngine.grounding.jsdom.test.jsx`, not the prompt's `ArenaMobile.smoke.test.jsx`. | `ArenaMobile.smoke.test.jsx` renders `AgentDock` with a `remaining` **prop** (`:122`) and never opens a request, so a row there could not fail under the defect it names — a grep in test's clothing, which is the Sep 10 review's second headline. `useArenaEngine.grounding.jsdom.test.jsx` is the hook's own mounted home, with `createRoot`, real response shapes and a stubbed global `fetch`. |
| **D-8** | `chat.test.js`'s two `chatBudgetUsed: { __op: 'increment', n: 1 }` assertions moved to an explicit count. | This is the D-105 change itself. The prompt protects the *ENFORCE and flag-OFF exchange shapes*, which did not move; these two rows pin the forbidden `FieldValue.increment` and had to follow it. |
| **D-9** | `chat.test.js`'s fake Firestore gained `runTransaction`, a `setBarrier` contention seam, a `failCommitWhen` seam, per-read snapshots and an `agentChatBudget` store. | The route under test now opens a transaction; the fake had none. Modelled on `api/agent/file-directive.test.js:96-125`'s (read-before-write enforced, buffer discarded on contention) and on `api/_utils/mandateEscape.test.js:137-152`'s two-writer barrier, as the prompt directs. Committed writes are applied to a **copy** of the seeded battle, so the shared `VALID_BATTLE` fixture is never mutated across rows. |
| **D-10** | `respondFilingRefused` is declared at the **end** of `api/agent/chat.js`. | The structural invariant (C-3) slices the source at the transaction call. The helper renders the transaction's own refusals, so it belongs below that line; function declarations hoist, so the position is free. |
| **D-16** | The thread id and the instant are minted **above** `runTransaction`, not inside the body as the extracted code did. | Review finding A-2: minting per attempt made a retried commit compose a different exchange, so `arrayUnion` appended it twice and the first id was stranded — a regression against `c35f9a5`, where the element was fully materialized before the call. Spec `:50` gives the module *"the mint"*; it does not say the mint must be inside the body, and Phase 0 §8 item 4 recommends hoisting for exactly this reason. Behaviour is unchanged on every path but the ambiguous commit, where it removes a duplicate. |
| **D-13** | The prompt says the cap goes *"in `selectFlagged`, after the roster intersection, `.slice(0, 5)`"*. It is in `selectBench`, after the roster intersection **and** the spoken-for filter. | The prescribed placement fails its own stated rationale, and the review proved it with a repro (lens C, finding C-3). The cap's reason for existing is that *the five are five names the pane could actually show*; a name a sentence already speaks for is exactly as invisible in the flagged group as an off-roster one, and inside `selectFlagged` it consumed a slot anyway. Six flagged names of which three were spoken for rendered **two** chips and dropped a sixth that would have fit — with four display slots free, and a flagged name rendering with no `Flagged` badge, which is a §9 disagreement. The cap is still read-side, still five, still a named constant, and `tickStamps.js` is still untouched; only the line it sits on moved. Row E-1e pins the placement and reds if it moves back — the four rows written at the prescribed placement were all blind to it (finding C-10). |
| **D-14** | `src/components/FilmRoom/FilmRoomChat.jsx` and its new suite are in the diff; the prompt's Commit D names only `decisionRecord.js`, `useArenaEngine.js` and `AgentChat.jsx`. | It is an **eighth** client of the same route, missed by Phase 0's census (errata E-8) and found by this build's own review. It made the same status-only claim on the same body the build exists to fix. Shipping with it unfixed would have made the PR disclosure — *"the client no longer infers either from a status"* — false. Two contained changes (`landed` gating the rollback and the line) plus a mounted suite. |
| **D-15** | Flag-OFF behaviour changes in one place: an attested-`persisted` failure renders no line even with `controllerCopy` off, where it used to render the shipped *"Agent is thinking too hard. Try again."* | A failure line is a claim, and a turn the route says landed did not fail. A flag is a copy switch; it is not a licence to tell a flag-off player their message was lost when the server says it was not. Every other flag-off body is byte-identical (row D-1f covers three of them explicitly), and row D-1f2 pins the one exception with this reasoning. |
| **D-12** | The League budget key is resolved **inside** the transaction, not carried from the pre-model read. | `chat.js:531` still resolves it for the early exhausted gate, but the charge now uses the module's own `resolveBudgetDay` (`directiveTransaction.js:268`) — which is what ruling 2 names as one of the four in-transaction re-reads. Consequence: a group read that fails pre-model and succeeds at the write now charges (it answered free before), and the reverse now answers free. Both are "the in-transaction read is the authority", the same principle as the rest of the build. The fail-open contract itself is unchanged: no key, no charge, never a placeholder day. |
| **D-11** | A fourth attestation shape — `persisted: null, charged: null` — that §2 does not name. | §7. Reported for a founder ruling rather than settled here. |

---

## 10. Disclosure for the PR body

*(The founder pastes this. It is the prompt's text, unchanged except where the build made a clause more precise — the two changes are marked.)*

> The typed directive path now files through the same transaction as the chip path: the battle's status and the message budget are re-read inside the write, the budget is an explicit in-transaction count (D-105 — the `FieldValue.increment` is gone), the League charge is atomic with the filing, and a typed directive that replaces a chip filing says so. Every response from both routes attests whether the directive persisted and whether a message was charged; the client no longer infers either from a status — a filing that landed can no longer be shown as a failure, and a failure can no longer be shown as free. The Bench shows the first five flagged candidates; the record keeps all of them. Nothing the decider sees changes.
>
> *(Two additions the build makes explicit. There is a fourth case the spec does not name — a commit that landed whose reply was lost; the route says it does not know (`persisted: null`) rather than claiming it did not happen, and the clients treat an unknown as no claim. And the Film Room's chat is an eighth client of the same route that the Phase 0 census missed; it reads the attestation too. See §6, §7 and §8 of the build report.)*

**Nothing the decider sees changes**, verified: `api/_utils/tickStamps.js` is untouched, and `heard` still keys on `controlResolution.directive.effective.directiveThreadId` — the slot's own field — which both paths write through the same `buildDirectiveSlot`. The one shape that can now appear on an exchange that could not before is `overBudget: true`, which is on the **exchange**, not the slot, and the decider's whitelist (`agentEvalPromptAssembly.js:1389-1402`) does not read it.

---

## 11. Handover

**The preview.** Vercel builds a preview for `claude/b2-directive-transaction` on push; its URL is on the branch's deployment in the Vercel dashboard (and on the PR, once you open one). **No flag flip is needed** — this is the live path at `VOICE_GROUNDING_MODE = 'shadow'`, which is today's shipping configuration, so every typed chat turn on the preview exercises it. *(I have not been given the preview URL and have not fabricated one; put it at the top of this section once Vercel reports it.)*

**The smoke, on a live battle.**

1. **The positive half.** Send a typed message in the Battle View chat that files a directive.
   - The response body attests `persisted: true, charged: true`.
   - In Firestore, on `agentBattles/{id}`:
     - `directive` carries the minted `directiveThreadId`;
     - exactly **one** new element on `chatExchanges` carries that same id **top-level and inside `directive`**;
     - `chatBudgetUsed` is up by **exactly one** — and it is now a written number, not an increment op.
2. **The receipt.** The directive card reads `Filed {time}` — unchanged, and still derived from the exchange the write produced, never from the response status.
3. **The negative half, if you can provoke it.** Send a message on a **completed** battle (or let the close cron land mid-turn):
   - the body attests `persisted: false, charged: false` with `reason: 'battle_not_active'`;
   - **nothing** is written — no exchange, no slot, no counter movement.
4. **The Bench.** On a check whose `candidates` stamp names more than five bench names *that no sentence already speaks for*, the `Named at the {t} check` group shows **five** chips. The record still holds every one the decider produced, and a name the cap dropped is still on the bench in the rest row.

**What is NOT observable on preview:** nothing in this build is dark, so there is no "flip to see it" step. The one thing you cannot easily provoke by hand is the committed-then-threw case (`persisted: true` on a 500) — it is covered by test C-1c, which asserts the document holds the exchange and the charge while the body says so.

**For separate tasking (BUILD_RULES §3 — found, not fixed).**

1. **The ambiguous commit.** §7. The one that wants a founder ruling. The review pass removed its duplicate-exchange half; what remains is the double **count**, measured by row A-2d.
2. **`leagueAsk: true` on a non-tournament battle bypasses BOTH budgets.** Found by the review (lens A, A-3) and **present at `c35f9a5`, unchanged by this build** — the pre-model cap check is skipped for any `leagueAsk` body, and `resolveBudgetDay` returns null for a non-tournament battle, so the transaction fail-opens and charges nothing. Ten sends on a battle already at `chatBudgetUsed: 10` all answer 200 and move no counter. The fix is a battle-mode check beside the `leagueAsk` read; it is a one-line change in a file this build touches, and it is **not** in this PR because BUILD_RULES §3 says a bug found outside the task is reported, not fixed. **The highest-severity thing this review turned up.**
3. **An inherited reconciliation double-render** (lens C, C-6): the optimistic bubble is matched on exact trimmed text, and `chat.js` sanitises `\n\r\t<>{}` out of the message — so a message containing any of those never reconciles and is retired only by the 30-second sweeper. Pre-existing on the success path; B2 extends the exposure to the failure path by keeping the bubble on an attested landing. Keeping it is still right (the alternative is deleting a message that was sent).
4. **Phase 0 §9's six items still stand**, unfixed and out of scope here: the Phase C rulings never reaching the D-ledger; `AgentChat.jsx`'s `showItFailed` giving an unattested 500 the attested sentence (Build 2); the research route's two not-active 409s distinguished only by an English string (Build 2); the spec's drifted anchors (§8 above); and the order-dependent `useSessionCompositeTrail.test.jsx` failure (still not re-verified — it did not appear in either full run this session, both of which were whole-suite runs where it passes).
5. **`AgentChat.jsx`'s four pre-existing lint errors** (§5.3). Untouched, and not this build's to fix.
6. **A failed send still destroys what the player typed.** `AgentChat.sendFailed.test.jsx` pins this as shipped behaviour and says a founder ruling on the draft would land there. Unchanged by this build — except that on an attested `persisted: true` failure the optimistic bubble now survives, which is the first case where the typed words are not lost.

**Push. No PR — the founder opens PRs. No merge. STOP.**

