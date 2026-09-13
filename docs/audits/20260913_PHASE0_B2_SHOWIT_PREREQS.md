# Phase 0 — B2 and the Show-it prerequisites (read-only discovery)

**Date:** September 13, 2026
**Branch:** `claude/phase0-b2-showit`, cut fresh from `origin/main` · **HEAD SHA:** `c35f9a591d6e5db3288e3f843ec58aaf7c130687` · **Tree:** clean at cut and at commit
**Fetch recorded (BUILD_RULES §3):** `git fetch origin main` ran first, before any comparison — it moved the remote-tracking ref `0e04833..c35f9a5`. A stale ref would have read this whole tree one merge behind. `git fetch origin <branch>` also ran for each of the three open PR branches (§0.1 below).
**Mode:** READ-ONLY. No production file edited, no test edited, no branch beyond this one, no PR, no `npm run lint`, no Firestore, no network beyond `git fetch`. Nothing was executed. This report is the only file created.
**Markers:** VERIFIED = read at that `file:line` at this HEAD in this session. ASSUMED = inferred, with the basis named.

---

## 0. Executive verdict

**The §1 fence, first line as asked.** **None** of `api/agent/chat.js`, `api/agent/file-directive.js`, `api/agent/research.js`, `api/_utils/directiveFiling.js`, `api/_utils/directiveGate.js` — nor any client counterpart (`src/components/Agent/AgentChat.jsx`, `src/screens/AgentBattleScreen.jsx`, `src/screens/battleView/*`, `src/components/League/battleArena/useArenaEngine.js`) — appears on the BUILD_RULES §1 fence. The fence list is `BUILD_RULES.md:14-24` (eleven files, VERIFIED); a grep of the whole of `BUILD_RULES.md` for these five names returns **zero hits** (VERIFIED). **The build is not founder-review-gated by §1.** Two ordinary gates still apply and are named where they bite: `agentBattles`' `createAgentBattle` doc shape is fenced *as a concept* (`BUILD_RULES.md:26`), so B2 must write **existing keys only**; and `research.js` already calls the fenced `flattenPortfolioServer` (`research.js:58`), which is §1-permitted (reading and calling are allowed; only editing is forbidden).

| # | Question | Verdict |
|---|---|---|
| Q1 | The two directive routes side by side | **They are not the same code and not the same guarantee.** `file-directive.js` does everything inside one transaction; `chat.js` does a single pre-model read and one **unconditioned** `battleRef.update()` ~630 lines later. Of the brief's five candidates, **(a) and (b) are REAL**, **(c) is FALSE as stated but its inverse is real**, **(d) is FALSE**, and **(e) is four further defects — one of them a direct contradiction of D-105.** |
| Q2 | The error-body contract today | **No route emits `persisted` or `charged` on any path** (VERIFIED by grep across all three routes). **Seven client sites** infer cost or persistence from an HTTP status; **one** (the Show-it door) reads the body and is the correct model. |
| Q3 | The research route and the double card | **REAL, and it is the retry case the route's own header stops one sentence short of.** `researchId` and `now` are **default parameters** (`research.js:407`) evaluated on every call, so a body re-execution after a landed-but-unacknowledged commit appends a **second** card. The header (`:194-200`) reasons only about the *last* slot; on slots 1 and 2 the answer is **200 with two of three reads spent**. |
| Q4 | The candidates first-five cap | **The cap is ruled as a B2 deliverable (D-112) but its PLACEMENT is unruled.** No cap exists at write or at read today (VERIFIED). "First five" appears nowhere as a rule — only as "e.g. first five" in two Sep 9 records. Honest default below: **cap at the read, not the write.** |
| Q5 | The shared transaction's shape | **Already specified** — `PHASE_B_TICK_STAMPS_SPEC_V1.md:49-54` prescribes `api/_utils/directiveTransaction.js` in detail. The file **does not exist** at HEAD (VERIFIED). Recommend **two builds**, not one. |
| Q6 | Flags and reach | **Confirmed on both halves.** B2 needs no flag (spec §4 `:62` names it unflagged, "the P-1 precedent"). The chip path stays `'on'`-only (`file-directive.js:172`). The research route is provably unreachable while dark (`research.js:226`), so the Show-it fix ships dark under the existing `SHOW_IT_ENABLED = false` with no new flag. |

**The one sentence.** Both findings families have the same root: **a claim about cost or persistence is being made by a party that cannot know it** — the client, from a status code — because the party that *can* know it, the route, does not say. B2 fixes that for filing; the Show-it prerequisite fixes it for research and adds the idempotency that makes "one tap, one card" true rather than usually-true.

### 0.1 The three open PRs

Fetched and diffed against `origin/main` this session (VERIFIED):

| Branch | Files | Touches any of the five? |
|---|---|---|
| `claude/index-intelligence-hygiene` | 9 (`compute-index-intelligence.js`, `indexIntelligence.js`, fixtures, tests, 2 docs) | **No** |
| `claude/eval-transport-hygiene` | 15 (`agentEvalTransport.js`, `agent-evaluate.js`, tickStamps tests, 2 docs, 1 script) | **No** |
| `claude/flip-shadow-assembly-off` | 7 (`shadowAssemblyCapture.js`, `agent-evaluate.js`, `featureFlags.js`, `flagPinGuard.test.js`, 2 docs) | **No** — but see below |

**One qualification the brief's "none touches the files below" does not cover.** `claude/flip-shadow-assembly-off` edits `src/config/featureFlags.js` (+43/−? lines) — the module that declares both `VOICE_GROUNDING_MODE` (`:2137`) and `SHOW_IT_ENABLED` (`:2286`), and that `chat.js:35`, `file-directive.js:78` and `research.js:68` all import. It is not one of the five files and (from its name and its doc `20260912_FLIP_SHADOW_ASSEMBLY_OFF.md`) its subject is the shadow-assembly capture flag, not either of these two. **But B2's and Show-it's flag reasoning reads that file, so the build should re-read `featureFlags.js` after that PR merges rather than trusting these line anchors.** ASSUMED that it does not move `VOICE_GROUNDING_MODE` or `SHOW_IT_ENABLED` — basis: its diffstat and title; not read line-by-line, because a discovery read of an unmerged branch's flag values would be a claim about a tree that is not HEAD.

### 0.2 Two corrections of record, before the substance

Both are places where the brief's premise and the tree disagree. Plan-said ≠ code-did cuts both ways, so they are stated here rather than silently worked around.

1. **`docs/audits/20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md` does not exist at HEAD.** It exists only on the unmerged branch `claude/eval-transport-hygiene` (VERIFIED: `git show FETCH_HEAD:docs/audits/20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md` succeeds there, `ls` fails at HEAD). Read from that branch as instructed; its §5.1 is cited below and its findings are consistent with this HEAD read. **Nothing in this report depends on it** — every §5.1 claim was independently re-verified against the tree at `c35f9a5`.

2. **D-118 and D-121 are not in the ledger named by the brief.** `COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` stops at **D-115** (VERIFIED — the highest `**D-nnn**` row in the file). D-116 → D-120 live in `docs/design/PHASE_C_SHOW_IT_SPEC_V1.md:48-52`; D-121 → D-122 in `docs/design/PHASE_C_SHOW_IT_SPEC_V1_1.md:63-67`. The Phase C rulings were never folded back into V1_2. **This is a live documentation gap, not a blocker** — the rulings are authoritative where they sit — but a future session told "read the ledger" will not find them. Filed for separate tasking (§9).

### 0.3 The five binding rulings, one line each (quoted)

| Ruling | Where it actually lives | The line |
|---|---|---|
| **D-31** | `…V1_2.md:431` | *"**Debate shows its cost before the tap** — remaining message budget visible on or beside the icon."* **Note:** D-31 is about the budget being **visible before the tap**; it is not the "one message charged" rule. That rule is **spec §6.4 / D-105**, quoted next, and is what `file-directive.js:41` and `directiveFiling.js:67` cite. Both bind B2; they are two rulings, not one. |
| **D-102** | `…V1_2.md:502` | *"…a chip filing (the user's tap, not the narrator's words) and every legacy proactive exchange … stay out (ruling 4)."* — the grounded prompt's history window excludes chip filings. |
| **D-105** | `…V1_2.md:505` | *"Any other battle charges `chatBudgetUsed` on the battle doc by an explicit in-transaction count (**never `FieldValue.increment`**), the cap authoritative under a race."* |
| **D-106** | `…V1_2.md:506` | *"**`file-directive` is reachable only at resolved `'on'`; `'shadow'` is measurement only.** (Amends D-102.) … Built: `api/agent/file-directive.js:172` gates on `=== 'on'` (404 otherwise)."* |
| **D-118** | `PHASE_C_SHOW_IT_SPEC_V1.md:50` | *"The cap is the count of research exchanges, three per battle, enforced in the route's transaction; no new key, no message charged."* |
| **D-121** | `PHASE_C_SHOW_IT_SPEC_V1_1.md:67` | *"A research exchange carries no `groundingVersion` marker and never enters `EARLIER MESSAGES`; it reaches the grounded prompt only as a typed `PLATFORM RESEARCH` block… Structural exclusion, asserted by test — a prose rule alone does not fix a history role."* |

**D-105 is the sharpest of the six**, because `chat.js:1073` does the one thing it names as forbidden. See Q1(e1).

---

## 1. Why this exists — the two rules, and the five findings against them

The Sep 10 four-item review (`docs/audits/20260910_FOUR_ITEM_BUILD_REVIEW.md`) states both rules in its own verdict (`:26-30`, VERIFIED):

> **1.** *"The branch's central claim was false. `Couldn't load the card · no use spent` was gated on `!res.ok`, and a non-2xx can reach the client with a card already written. **The clause is now gated on an attestation the route issues, because the route is the only party that can know.**"*
> **2.** *"The screen half of items 4–5 had no behavioural test at all. **Three source-text greps stood in for it.** Two plausible defects … were each silent across the entire 12,266-test suite."*

Rule 1 = a cost/persistence claim is the route's to attest. Rule 2 = a surface change gets a mounted behavioural test, never a grep. Everything below is measured against those two.

---

## 2. Q1 — The two directive routes, side by side

### 2.1 `POST /api/agent/chat` — the typed path

| Row | Where | What it does |
|---|---|---|
| Auth | `chat.js:409` | `requireAuth(req, res)`; `if (!user) return` — the 401 body is the middleware's. VERIFIED |
| Flag gate | **none on the route** | The route is reachable at **every** grounding mode. `getVoiceGroundingMode(user.uid)` is read at `:475` only to compute `grounded` (`:476`, `=== 'on' && mode === 'battle'`) and `shadowAssembly` (`:483`, `!== 'off'`). It changes the prompt and the response's extra keys, **never reachability**. VERIFIED |
| Archetype gate | `:835-855` → `directiveGate.js:163` | `ARCHETYPE_INTEGRITY_MODE === 'off'` **or** `mode === 'review'` → the legacy `normalizeDirective(parsed)` (`:316`, `:836`). Otherwise `gateDirective(...)`; `enforce` lets `gate.directive` through, `observe` forces null (`:852-854`). VERIFIED |
| What persists as text | `directiveGate.js:9-12` | *"The model's `_archetypeProposal` is UNTRUSTED… it never copies model free-text into a directive. `originalUserAsk` is NEVER read into directive.text."* Canonical allowlist text only — **on the gated path**. On the `'off'`/review path, `normalizeDirective` is the legacy shape. VERIFIED |
| Research lint | `:917-934` | `researchFollowUp = grounded && SHOW_IT_ENABLED && buildPlatformResearchBlock(...) !== null` (`:917-919`); on failure **the whole turn is withheld** — `lintedDirective = null`, `lintedHasDirective = false` (`:933-934`). VERIFIED |
| `directiveThreadId` minted | **`:1005`** | `randomUUID()`, **outside any transaction**, ~630 lines after the only battle read. VERIFIED |
| Every read before the write | `:436` battle (the **only** one), `:495` agent, `:531-533` League budget (`resolveBudgetDay` + `readAgentChatBudget`) | The battle doc is read **exactly once** (grep for `battleRef`/`battleDoc` returns `:435, :436, :437, :440, :1067` — no second `.get()`). VERIFIED |
| **The write** | **`:1067`** | **`await battleRef.update({ … })` — one plain, unconditioned document update. No transaction, no precondition, no re-read.** VERIFIED |
| What is charged, where | `:1073` | `...(!isLeagueAsk ? { [budgetField]: FieldValue.increment(1) } : {})`. `budgetField` from `MODE_BUDGET[mode]` (`:502`) = `chatBudgetUsed`, limit 10 (`directiveFiling.js:69`). **League:** a *separate* transaction at `:1103-1116` → `chargeAgentChatBudget` (`agentChatBudget.js:105`), **after** the battle write, its failure swallowed at `:1111-1115`. VERIFIED |
| Success body | `:1124` | `clientResponse` (built `:938-997`); grounded adds `grounded: true` and `currentDirectiveThreadId` (`:1013-1019`). **No `persisted`, no `charged`.** VERIFIED |

### 2.2 `POST /api/agent/file-directive` — the chip path

| Row | Where | What it does |
|---|---|---|
| Auth | `:149-150` | `requireAuth`; then check 1 re-verifies `battle.ownerId === user.uid` **inside** the transaction (`:203`). VERIFIED |
| Flag gate | **`:172-174`** | `if (getVoiceGroundingMode(user.uid) !== 'on') return res.status(404)` — **before any read**. D-106, exactly as the ledger records it. VERIFIED |
| Archetype gate | `:222-228` | `getEffectiveArchetype(battle, agent)` → `isValidAdjustmentId` → `getCanonicalText`, **inside the transaction**, through the allowlist helpers directly (not through `directiveGate.js` — the gate's internals are private; `:29-32` header). VERIFIED |
| What persists as text | `:227` | `getCanonicalText(archetype, adjustmentId)` — server-side. Header `:33-34`: *"the client may send `text` and it is ignored."* VERIFIED |
| Research lint | **none** | No model is called, so there is no reply to lint. VERIFIED |
| `directiveThreadId` minted | `:266` | `randomUUID()`, **inside** the transaction body — see §2.4(d) for why that is safe here and not in `research.js`. VERIFIED |
| Every read before the write | `:198` battle, `:216` agent, `:243` League budget doc — **all via `tx.get`, all before any write** | VERIFIED |
| **The write** | `:282-287` | `tx.update(battleRef, { chatExchanges: arrayUnion(exchange), directive: slot, ...battleBudgetUpdate })` + `commitBudget()` — **one transaction, two documents.** VERIFIED |
| What is charged, where | `:257-262` (non-League) / `:244-254` (League) | `const used = normalizeCount(battle[BATTLE_CHAT_BUDGET.field]); if (used >= limit) …; battleBudgetUpdate = { [field]: used + 1 }` — **an explicit in-transaction count**, with the comment at `:260-261` naming why. D-105, honoured. VERIFIED |
| Success body | `:325-330` | `{ status, directive, replacedDirectiveThreadId, remaining }`, sent **after** the commit (`:323-324`). **No `persisted`, no `charged`** — but every refusal here is pre-commit by construction. VERIFIED |

### 2.3 Where they diverge

| | chat (typed) | file-directive (chip) |
|---|---|---|
| Atomicity | **None.** One read, one blind update, ~630 lines apart | **One transaction**, all reads then all writes |
| Battle-still-open at write | **Not checked** | Checked inside the tx (`:205`) |
| Budget authority | Pre-model read + `FieldValue.increment` | In-transaction explicit count |
| Concurrent-directive detection | **None** — no `expectedDirectiveThreadId`, no CAS | Check 4 (`:209-214`) → `conflict` |
| Reachability | Every mode | `'on'` only |
| Text provenance | Gate (or legacy `normalizeDirective` at `ARCHETYPE_INTEGRITY_MODE === 'off'`) | Always canonical |
| Failure receipt | 500/504 after a possibly-landed write | 500 only from the catch; all refusals pre-commit |

**What "failing" means concretely.** The Sep 10 review does not use the phrase "failing path" — the phrase is the **spec's**, and it is the sentence that authorises B2 to ship unflagged:

> `PHASE_B_TICK_STAMPS_SPEC_V1.md:62` — *"**B2 ships unflagged as a fix to a failing path (the P-1 precedent)**, after its own review."* (VERIFIED)

So "failing" is the spec's characterisation, adopted at the Sep 8 rulings, and §2 (`:49-54`) is its itemisation. The Sep 10 review's contribution is narrower and is quoted in full at §4.1 below. **Reported precisely because the brief attributes the phrase to the Sep 10 review; it is the spec's.**

### 2.4 The five candidates, tested against the code

**(a) The write is not conditioned on the battle still being open — REAL, on `chat.js` only.**
`battle.status` is read once at `:436` and checked at `:487`. The write at `:1067` carries no precondition and no re-read. Between them sits the entire model call — `maxDuration: 30` (`:61`), with `TURN_DEADLINE_MS` inside it. `research.js:341-345` states the same hazard for its own route in so many words: *"`agent-evaluate` flips a battle to `completed` on its own schedule — so re-reading only the count appended a card to a settled battle whenever a tap and the close cron overlapped."* The same overlap lands a **directive** in a completed battle here. **VERIFIED (code); the cron overlap itself is ASSUMED — basis: `research.js:341-345`, a review-confirmed statement about the same collection, not re-derived from `agent-evaluate.js` in this session.**
On `file-directive.js` this is **FALSE** — `:205`.

**(b) The budget check is not inside the write, so two concurrent messages can both pass it — REAL, on `chat.js` only.**
Check at `:508` reads `currentBudget` from the `:436` snapshot (`:503`). The charge at `:1073` is `FieldValue.increment(1)` — a blind server-side increment with no read-back and no cap comparison. Two turns starting within the same model-call window both read `used = 9`, both pass, both increment → **11 of 10**. **VERIFIED.** On `file-directive.js` this is **FALSE** — `:257-262`.

**(c) The model reply is returned before the write is confirmed — FALSE as stated. Its inverse is REAL.**
The write is **awaited** at `:1067` and the 200 is at `:1124`; nothing returns a success receipt ahead of the write. **But the failure receipt is wrong in the other direction:** three things sit *after* the landed write and *inside* the same `try` —

- `:1093` `await db.collection('agents').doc(agentId).update(agentUpdate)` (review mode)
- `:1123` `await settleConversationRecord(...)`
- `:1124` `res.status(200).json(clientResponse)` itself

— and a throw in any of them falls to the catch at `:1125` and returns **504** (`:1171`) or **500** (`:1173`). The exchange has persisted and the budget has charged; the client is told the turn failed. This is the same defect class the repo has already paid for once: `research.js:196-200` records that the `· nothing was sent` clause was **deleted from `chat.js`** for exactly this shape. **VERIFIED.** So (c) should be restated for the build as: *the client can show a **failure** for a filing that **did** persist and charge* — which is what makes the Q2 attestation load-bearing.

**(d) The two routes mint or shape the thread id differently, so `heard` keys on different things — FALSE.**
Both mint `randomUUID()` (`chat.js:1005`, `file-directive.js:266`). Both build the record and slot through the **same zero-import helpers** — `buildDirectiveRecord` (`directiveFiling.js:29`) and `buildDirectiveSlot` (`:50`) — called at `chat.js:1030`/`:1077` and `file-directive.js:274`/`:276`. `heard` keys on `controlResolution.directive.effective.directiveThreadId` (`tickStamps.js:130`), i.e. the slot's own field, identical on both paths. **VERIFIED — this candidate is refuted.**

*The real shape divergence is conditioned on the gate, not the route.* `buildDirectiveRecord`/`buildDirectiveSlot` spread `adjustmentId` + `canonicalTextVersion` only `...(normalized.adjustmentId != null ? … : {})` (`:38`, `:56`). A chip filing always supplies both (`file-directive.js:268-273`). A typed filing supplies them only when the gate minted them — at `ARCHETYPE_INTEGRITY_MODE === 'off'` the legacy `normalizeDirective` path (`chat.js:836`) supplies neither, and `directiveFiling.js:11-19` says this is **deliberate** ("the flag-OFF legacy shape (no id, no version) is exactly what the conditional spread below still writes"). **Not a defect. Recorded so the build does not "fix" it.**

**(e) Something else — four more, named.**

- **(e1) `chat.js:1073` contradicts D-105 in terms.** D-105: *"charges `chatBudgetUsed` on the battle doc by an explicit in-transaction count (**never `FieldValue.increment`**)"*. `chat.js:1073` is `FieldValue.increment(1)`. `file-directive.js:260-261` honours it and says why. **This is the single most direct rule-to-code contradiction on the branch surface**, and (b) is its consequence. VERIFIED.
- **(e2) A typed filing can persist while charging nothing (League).** The exchange write (`:1067`) and the League charge (`:1105`, a *second* transaction) are separate, the charge is second, and its failure is caught and swallowed at `:1111-1115` with `remaining` left unset. A filing that landed and cost nothing. Spec §2 ruling 5 (`:52`) already prescribes the fix — *"The League charge moves inside the same transaction (cross-document; D-105)"* — which is what `file-directive.js:240-255` already does. VERIFIED.
- **(e3) The typed path has no conflict detection at all.** `file-directive.js` requires `expectedDirectiveThreadId` as a nullable-but-mandatory key (`:183-189`) and returns `conflict` on a stale belief (`:212-214`). `chat.js` reads no such field and compares nothing: a typed directive silently overwrites a chip filing that landed during the model call, and **no surface is told**. Spec §2 (`:51`) rules this deliberately — *"latest-wins files anyway; the outcome records the actual replaced thread from the in-transaction read"* — so the fix is **not** to reject, but to **report** what was replaced. VERIFIED.
- **(e4) The 502 at `:814` is post-model, pre-write — and is the one failure status that is honestly attestable today.** It returns before `:1067`, so nothing persisted and nothing charged. It carries no attestation saying so, and `useArenaEngine.js:98` lumps it in with every other `!res.ok`. A free correct answer the contract currently throws away. VERIFIED.

---

## 3. Q2 — The error-body contract today

### 3.1 Every status, and what the body carries

**`POST /api/agent/chat`** (VERIFIED, each at its line)

| Status | Line | Body | `persisted`/`charged`? |
|---|---|---|---|
| 401 | `:409` (middleware) | middleware's | no |
| 405 | `:405` | `{ error }` | no |
| 400 | `:421`, `:428` | `{ error }` | no |
| 400 | `:488` | `{ error: 'battle_not_active', message }` | no |
| 403 | `:444` | `{ error }` | no |
| 403 | `:455` | `{ error: AGENT_BATTLE_MISMATCH }` | no |
| 403 | `:518` | `{ error: 'chat_budget_exceeded', message }` | no |
| 404 | `:438`, `:497` | `{ error }` | no |
| 429 | `:511` | `{ error: 'budget_exceeded', mode, message }` | no |
| 200 (League exhausted) | `:537` | `{ agentMessage, mode, leagueAsk, exhausted, remaining }` | no |
| 502 | `:814` | `{ error: 'gemma_invalid_shape', errorReason, message }` | no |
| 504 | `:1171` | `{ error }` | no — **and it can follow a landed write** |
| 500 | `:1173` | `{ error }` | no — **and it can follow a landed write** |
| 200 | `:1124` | `clientResponse` | no |

**`POST /api/agent/file-directive`** (VERIFIED)

| Status | Line | Body |
|---|---|---|
| 401 | `:149` | middleware's |
| 405 | `:146` | `{ error }` |
| **404 (dark)** | **`:173`** | `{ error: 'not_found' }` — before any read |
| 404 | `:303`, `:305` | `{ error }` battle / agent |
| 400 | `:179`, `:184`, `:188` | `{ error }` validation |
| 400 | `:311` | `{ error: 'battle_not_active', message }` |
| 403 | `:307`, `:309` | `{ error }` owner / agent-binding |
| **409** | `:313` | `{ error, status: 'conflict', currentDirectiveThreadId }` |
| **422** | `:319` | `{ error, status: 'rejected', reason: 'off_menu' }` |
| **429** | `:321` | `{ error, status: 'budget-exhausted', remaining: 0 }` |
| 200 | `:325` | `{ status, directive, replacedDirectiveThreadId, remaining }` |
| 500 | `:336` | `{ error }` — **the one path here that can follow a landed commit** |

**`POST /api/agent/research`** (VERIFIED) — the only route with an attestation today.

| Status | Line | Body | Attests? |
|---|---|---|---|
| 405 | `:214` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| 404 (dark) | `:226` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| 400 | `:242`, `:245` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| 404 battle | `:256` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| 500 (battle read) | `:262` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| 403 | `:266`, `:268` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| **409 not-active** | **`:267`** | `{ ...NO_CARD_WRITTEN, error: 'Battle is not active' }` | **yes** |
| 404 universe | `:275` | `{ ...NO_CARD_WRITTEN, error }` | **yes** |
| **409 exhausted (pre-tx)** | **`:282`** | `{ ...NO_CARD_WRITTEN, status: 'research_exhausted', used, remaining, cap }` | **yes** |
| 404 / 403 / **409 not-active** / 404 universe (in-tx) | `:362`, `:363`, **`:364`**, `:366` | `{ error }` | **no, deliberately** |
| **409 exhausted (in-tx)** | `:369` | `{ status, used, remaining, cap }` | **no, deliberately** |
| 500 | `:391` | `{ error }` | **no, deliberately** |
| 200 | `:376` | `{ status: 'shown', card, used, remaining, cap }` | n/a |

**Does any body say `persisted` / `charged`? No.** A grep for `persisted` across `api/agent/*.js` returns only the shadow-log settle helper (`chat.js:190-196`) and comments; `charged` appears only as a *return value* inside `agentChatBudget.js:109/:119`, never in an HTTP body. **VERIFIED.**

Note the shape worth copying: `research.js` splits 409 into a **pre-transaction** arm (`:282`, attested) and an **in-transaction** arm (`:369`, unattested) **for the same reason B2 needs `persisted`** — the route knows which side of the commit it is on, and only the route knows.

### 3.2 Every client site that reads those responses — the build's client scope

| # | Site | What it infers **from the status alone** | Correct? |
|---|---|---|---|
| 1 | `AgentChat.jsx:1080` | `setError(BATTLE_VIEW_COPY.filingFailureLine(res.status))` → `decisionRecord.js:786-791`: 409 → conflict line, 429 → budget line, 422/404 → *"no longer on the menu — **nothing was filed**"*, else generic. **A persistence claim from a status.** Sound only because every `file-directive` refusal happens to be pre-commit — an accident of that route's shape, not a contract. | **status-only** |
| 2 | **`AgentChat.jsx:1130`** | `else if (res.status === 409) setError(BATTLE_VIEW_COPY.showItExhausted)` → *"All 3 reads used in this battle."* (`battleViewCopy.js:365`). **`research.js` answers 409 for `exhausted` (`:282`, `:369`) AND for `Battle is not active` (`:267`, `:364`).** A tap on a battle that closed mid-session reports a spent budget that was never spent. **The named instance.** | **WRONG** |
| 3 | `AgentChat.jsx:1131` | `else setError(BATTLE_VIEW_COPY.showItFailed)` — the 500 arm; `showItFailed` = `RESEARCH_FAILED_LINE` + `Try again.`, and `RESEARCH_FAILED_LINE` is the **attested** sentence. An unattested 500 gets the attested line. | **WRONG** |
| 4 | `AgentChat.jsx:963-965` | `sendFailedCopy` → `BATTLE_VIEW_COPY.chatSendFailed` (`battleViewCopy.js:691`). The clause spec §2 ruling 7 (`:53`) attaches to `persisted === false` has no field to read yet. | **needs the field** |
| 5 | **`useArenaEngine.js:95-101`** | `if (!res.ok \|\| !data.agentMessage)` → `ASK_FAILED_LINE`, under the comment *"**The server did NOT charge on either, so the counter is left untouched.**"* **A cost claim, in so many words, from a status.** False whenever `chat.js` threw after `:1067` — the write landed and (non-League) the increment with it. Spec §2 `:53` names this exact site: *"the arena reads the same field and drops its 'not charged' claim (`useArenaEngine.js:95-97`)."* | **WRONG** |
| 6 | `useArenaEngine.js:145` | `line: filingFailureLine(res.status)` — the arena's chip, same status-only inference as #1. | **status-only** |
| 7 | `AgentBattleScreen.jsx:1314-1318` | `const failure = await res.json().catch(() => null); setResearchError({ symbol: wanted, attested: failure?.noCardWritten === true })` — **reads the body, never the status**, under a 16-line comment (`:1277-1289`) explaining why. | **CORRECT — the reference implementation** |
| — | `ThisTurnStrip.jsx:24` | Pure render from the subscribed doc (`directive`, `receipts`, `battleStatus`, `turn`). **Issues no fetch and infers nothing from any status** — grep for `fetch`/`res.status`/`res.ok` returns nothing. **Not in the build's client scope.** | **n/a** |

The collision at #2 is not a new discovery — `decisionRecord.js:756-763` documents it and disclaims it in the docstring for `researchFailureLine`:

> *"`AgentChat.showIt` (the chat's research chip) does **NOT** read this function yet. It keeps a hand-rolled status map that predates this branch, and correcting it means correcting the 409 collision behind it — the route answers 409 for both `exhausted` and `not active`, and the chat calls both 'All 3 reads used in this battle.' **That is a pre-existing defect filed for separate tasking (§2 review, B9 / A6(i))**."* (VERIFIED)

**This report is that tasking.**

---

## 4. Q3 — The research route and the double card

### 4.1 The transaction

- **Body:** `research.js:335-356`. Reads `battleRef` once via `tx.get` (`:336`), re-checks **every** gate — owner `:346`, active `:347`, agent binding `:348`, universe `:349`, then the cap `:350-351` — then `tx.update(battleRef, { chatExchanges: arrayUnion(exchange) })` (`:354`). VERIFIED.
- **Where `researchId` is minted:** **`research.js:407`**, as a **default parameter** of `buildResearchExchange` — `{ card, symbol, agentId, now = new Date(), researchId = randomUUID() }`. The call is at `:353`, **inside the body**. Default parameters are evaluated **per call**, so *both* `researchId` and `now` are fresh on every re-execution. VERIFIED.
- **Cap check:** `countResearchUsed(fresh.chatExchanges)` at `:350` — **inside** the body, counting persisted `messageType === 'research'` elements (`researchCap.js:48-55`), `RESEARCH_CAP = 3` (`:36`). This is D-118's *"count of research exchanges … enforced in the route's transaction"*, honoured. A pre-check at `:280-289` exists to fail a fourth tap before an EODHD call and is explicitly **not** authorization (`:27-32`, `:278-279`). VERIFIED.

### 4.2 The retry, and the second card

The Sep 10 review established the library's behaviour (`20260910_FOUR_ITEM_BUILD_REVIEW.md:75`, VERIFIED):

> *"`@google-cloud/firestore/build/src/transaction.js:396-420` re-runs the update function on a retryable commit error; `:581-604` retries codes 14/4/13/2/1/10/16/8 — the ambiguous-commit set. **A commit that lands whose reply is lost re-runs against a fresh read that now holds its own card** → on the last slot, `{kind:'exhausted'}` → HTTP 409, slot spent."*

**ASSUMED** (library line anchors — `node_modules` not read this session; basis: the Sep 10 review, whose refuter independently rebuilt the predicate). **The consequence on this HEAD is VERIFIED from the route's own source.**

The route's header reasons about this and stops one case short. `:194-200` says only *"…which **on the last slot** returns `exhausted` → 409 with a slot spent."* **On slots 1 and 2 the re-execution does not return `exhausted` — it writes again:**

| | Attempt 1 | Attempt 2 (after an ambiguous commit) |
|---|---|---|
| `tx.get` → `used` | 0 | **1** (its own card) |
| `used >= 3`? | no | **no** — 1 < 3 |
| `buildResearchExchange` | `researchId = A`, `now = t₁` | **`researchId = B`, `now = t₂`** (both defaults re-evaluated, `:407`) |
| `arrayUnion` dedupe? | — | **no** — B ≠ A by deep equality |
| Result | card A written | **card B written too** |
| Answer | — | **200 `{ status: 'shown', used: 2, remaining: 1 }`** |

**One tap → two cards → two of three reads spent → a 200 that says so.** The user is told they used two. VERIFIED against `:350-355` + `:407`.

**The irony worth recording for the build:** the `researchId` field exists *because* `arrayUnion` dedupes by deep equality — `:410-419` (finding CO-1) added it so two genuinely-concurrent taps could not silently collapse into one element. It fixes that, and **creates this**: the dedupe that would have collapsed a retry's duplicate is precisely what the fresh id defeats. `now` would defeat it independently. Both must be hoisted.

**What an idempotent route does.** Mint `researchId` **once, before `db.runTransaction`**; pass it (and a fixed `now`) into `buildResearchExchange`; inside the body, before appending, scan `fresh.chatExchanges` for an element with that `researchId` — if present, the prior attempt's commit **landed**, so return `{ kind: 'shown', used, exchange: <the found one> }` **without a second `tx.update`**. One tap, one card, one slot, on every retry count. The route then answers 200 with the card it actually wrote.

**The `buildResearchExchange` signature already supports this** (`:407` takes both `now` and `researchId` as overridable parameters) — so the fix is **at the call site only**, and the CO-1 test (`research.test.js:418-428`, which calls the builder twice *with no id* and asserts the ids differ) **still passes unchanged**. VERIFIED. That is a meaningfully smaller blast radius than "changes the route's write semantics" suggested.

### 4.3 The emulator / test seam

**There is no Firestore emulator suite for this route.** The repo's only emulator artefact is `firestore.rules.emulator.test.js` (rules, not routes). Route tests use in-process fakes. VERIFIED.

The relevant seam already exists and is **close but not sufficient**:

- `api/agent/research.cap.test.js:86-120` — a fake whose `runTransaction` loops up to 5 attempts, records read versions, and **discards the buffer and re-runs** on contention (`:115-116`), with an `injectBeforeCommit` hook (`:108-112`). Its header (`:18-22`) states the intent: *"a transaction buffers its writes and, on injected contention, **DISCARDS** the buffer and re-runs the body against the changed doc, the way the real client retries."*
- **The limitation that matters:** `injectBeforeCommit` `continue`s **without applying the buffer** (`:111`). That models the *discarded* retry — which writes once, correctly. **The double-card defect needs the opposite: a retry where attempt 1's buffer IS applied and the body re-runs anyway** (the ambiguous commit).
- The Sep 10 refuter built exactly that harness — *"commit applies, then throws a real gRPC-coded error, retry gated by a transcription of the library's own predicate"* (`:57`) — but it lived in a reviewer's `git archive` snapshot and **is not in the repo**. A grep for an ambiguous-commit harness across `api/**/*.test.js` finds nothing. VERIFIED.

**So the build must construct that seam**, as an `applyThenRetry` mode on the existing fake (a handful of lines beside `:108-112`). It is the survivor proof for the whole fix, and without it the idempotency claim is a comment.

### 4.4 The 409 reasons, and what the chip renders

| Reason | Emitted at | Body distinguishes it? | Chip renders (`AgentChat.jsx:1130`) |
|---|---|---|---|
| Cap reached (pre-tx) | `:282` | **yes** — `status: 'research_exhausted'`, `used`, `remaining`, `cap`, `noCardWritten` | *"All 3 reads used in this battle."* ✅ |
| Cap reached (in-tx) | `:369` | **yes** — same minus `noCardWritten` | *"All 3 reads used in this battle."* ✅ |
| **Battle not active (pre-tx)** | **`:267`** | **only by `error` string** — `'Battle is not active'`, no `status` key | *"All 3 reads used in this battle."* ❌ |
| **Battle not active (in-tx)** | **`:364`** | **only by `error` string** | *"All 3 reads used in this battle."* ❌ |
| Dark | `:226` — **404**, not 409 | n/a | generic (`:1131`) |

The route **does** carry enough to tell the two apart (the exhausted arms set `status`, the not-active arms do not) — **the chip just never looks at the body.** The door does (`AgentBattleScreen.jsx:1317`). The fix is to make the chip read what the route already sends, plus give the not-active arms an explicit `status` rather than leaving the distinction to an English string. VERIFIED.

### 4.5 Does the research write charge a message anywhere? **No — D-118 is honoured.**

The transaction's only write is `tx.update(battleRef, { chatExchanges: arrayUnion(exchange) })` (`:354`) — one key. Neither `chatBudgetUsed` nor `AGENT_CHAT_BUDGET_COLLECTION` appears anywhere in `research.js` (grep: zero hits). The route imports no budget module (`:47-68`). A test pins it: `research.test.js:395-398` — *"writes to no collection but the battle doc"*. **VERIFIED.** The route header states it at `:34-37`.

---

## 5. Q4 — The candidates first-five cap

### 5.1 Where the cap is defined

**It is ruled that a cap exists and that B2 builds it. It is not ruled what the cap is, or where it goes.**

- **D-112** (`…V1_2.md:512`, VERIFIED): *"**Recorded at build (review B-5):** the stamp is UNCAPPED — the dispatch queue is equally uncapped and the fenced instruction expects 1–3 per day; **a first-five cap is a spec-level rule and is built in B2**, not here."*
- `PHASE_B_TICK_STAMPS_SPEC_V1.md:104` (VERIFIED): *"(silent on a cap) | **The stamp is UNCAPPED; a first-five cap is a spec-level rule, built in B2**"* — an errata row against §1.4, which itself says nothing about a cap.
- `20260909_PHASE_B_B1_SERVER_STAMPS_REVIEW.md:104` (B-5): *"`candidates` uncapped … **a cap would be a spec-level rule (e.g. first five)**. No code."*
- `20260909_PHASE_B_B1_SERVER_STAMPS_BUILD_REPORT.md:150`: *"**A cap (e.g. the first five)** would be a spec-level rule under D-112; not built. Twenty verbose items would be ≈ 17 KB on one entry."*

**The Controller brief §6 contains no cap** (grep of `docs/design/COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md` for the cap terms: no hits). In both Sep 9 records the phrase is *"e.g. first five"* — **an illustration of what a cap might be**, which D-112 then hardened into "a first-five cap" by quotation. **No ruling states the number as a decision, and none states the placement.** VERIFIED.

### 5.2 Where `candidates` is written and read

**Written:** `api/_utils/tickStamps.js:275-290` — `composeCandidatesStamp` iterates every item with a truthy `symbol`, pushes `{ symbol, direction, signalSummary, threshold, signalSource? }`, and returns the whole array. Attached at `:341-342`, key omitted when null. **No `slice`, no length check, no cap. VERIFIED.**

**Read:**
- `src/screens/battleView/selectBench.js:157-169` — `selectFlagged(candidates, roster)`: filters `direction === 'potential_entry'`, collects symbols into a `Set`, returns `roster.filter(...)`. **No cap. VERIFIED.**
- `selectBench.js:203-204` — the caller, minus names already spoken for by a sentence.
- `src/screens/battleView/PaneBench.jsx` — renders `flagged` as the `Named at the {t} check` group with a `Flagged` chip; presence-gated (`:33`).
- **Bounded by construction, everywhere it is read.** `selectFlagged` returns `roster.filter(...)`, so its output can never exceed the bench roster's own length regardless of how many candidates the decider emitted. A twentieth candidate for a name not on the roster reaches **no surface at all**.
- **The directive card and the narrator's shared Heard sentence do not read `candidates`.** They read `heard` (`tickStamps.js:128-142`), a different stamp. Grep of `src/screens/battleView/*.{js,jsx}` for `candidates` (excluding tests) returns only `selectBench.js` and an unrelated local variable in `buildTape.js:81-86`. **VERIFIED — the read surface is `selectFlagged` → `PaneBench`, and nothing else.**

**So: no cap exists today at write or at read.** The only unbounded quantity is what sits **on the document** — which is the B1 review's actual concern (`:150`: *"Twenty verbose items would be ≈ 17 KB on one entry"*), a storage and prompt-hygiene worry, not a rendering one.

### 5.3 What "first five" means in the decider's output order

`composeCandidatesStamp` preserves the model's `anticipationCandidates` array order exactly (`:277-288`, a straight `for…of` push). **"First five" therefore means the first five items the model emitted** — an order with no documented semantics: nothing in D-112, the spec, or the tool schema says the model ranks them, and the fenced instruction expects only 1–3 per day (`:150`). **So "the first five" is "five arbitrary ones" unless the model's order is meaningful, and no source in the repo claims it is. VERIFIED (order preservation); ASSUMED (that the order is unranked) — basis: the absence of any ranking claim in D-112, §1.4, or the two Sep 9 records.**

This matters: a write-side cap silently **discards** candidates 6+ on an order nobody has defined.

### 5.4 Write or read — what the ruling implies, and the honest default

**The ruling is silent on placement.** D-112 says *"a first-five cap is a spec-level rule and is built in B2"* and stops. Neither it, nor §1.4, nor the errata row at `:104`, nor either Sep 9 record says write-side or read-side. **Stated as silence, as asked.**

**The honest default: cap at the READ.** The brief's own formulation is the right one and the evidence supports it —

> *the record carries what the decider produced; the surface caps — a record that drops the decider's sixth name is a record that says less than the decider said.*

Four reasons from this tree:

1. **The record is evidence.** The stamps' whole warrant is `decisionRecord.js:795-800`: *"`Saw` = THIS VALUE WAS RENDERED FOR THIS HELD NAME IN THE DECIDER'S PROMPT AT THAT CHECK … the stamps prove VISIBILITY, never CAUSALITY."* A stamp that is a **truncation** of what the decider produced cannot support that claim about names 6+, and nothing on the record marks it as truncated.
2. **The read is already bounded** (`selectFlagged` → `roster.filter`), so a read-side cap costs one `.slice(5)` on an already-short list and is **display-agreement-clean** (BUILD_RULES §9: the surface caps what the surface shows).
3. **A write-side cap is irreversible and order-blind** — it discards on an order §5.3 shows is undefined, and D-112's own contract (*"the fact of the flag is the whole payload"*) means the dropped item loses everything.
4. **The sizing concern the cap came from is real but small.** `:150`'s own figure is ~1 KB/day typical, ~17 KB in the twenty-verbose-item worst case, against a per-entry budget the same spec sets at ≤ 1.1 KB for `evidence` (`§3`). **If the founder's intent is the byte ceiling rather than the display**, that argues for a write-side cap after all — so this is the one place in the report where a founder ruling genuinely changes the build. **Flagged as a decision, not assumed away.**

**Recommendation:** cap at the read (`selectFlagged`, after the roster intersection, `.slice(0, 5)`), and if the byte ceiling is the real concern, address it at the write with a **generous** bound (e.g. 20) that is a storage guard rather than a display rule — the two are different rules and should not be conflated into one number.

---

## 6. Q5 — The shared transaction's shape

### 6.1 It is already specified — and the file does not exist

`api/_utils/directiveTransaction.js` is **absent at HEAD** (VERIFIED — `ls` fails). `PHASE_B_TICK_STAMPS_SPEC_V1.md:49-54` prescribes it in full. Quoting the module line (`:50`, VERIFIED):

> *"**The module:** extract `file-directive.js:196-299` into a sibling `api/_utils/directiveTransaction.js`; both routes import it; `directiveFiling.js` stays zero-import. The function owns the in-transaction re-reads (`battle.directive.directiveThreadId`, `battle.status`, `battle[budgetField]`, the League `agentChatBudget` doc via `resolveBudgetDay`), the mint, the slot/record build, and the writes; it takes the composed exchange as an argument."*

**`file-directive.js:196-299` is exactly the transaction at this HEAD** — `:196` is `await db.runTransaction(async (tx) => {`, `:299` is its close. The anchor has **not** drifted. VERIFIED.

The spec's other anchors **have** drifted and must be re-verified by the build:

| Spec anchor | At HEAD |
|---|---|
| `chat.js:996-1008` (the chat path's hand-off) | the mint is `:1005`; the exchange is `:1021-1063`; the write `:1067-1079` |
| `chat.js:950-951` (the slot as read at turn start) | `:950` is `mode` inside `clientResponse`; the slot-as-read is `:1016-1018` |
| `chat.js:496-510` (the pre-call budget check) | `:502-522` |
| `useArenaEngine.js:95-97` | **correct** — VERIFIED |
| `compositionProtectedStoresAllowlist.json:163` | not re-verified this session |

### 6.2 The shape, against this HEAD

| Element | Spec | Present in `file-directive.js` today? |
|---|---|---|
| **Inputs** — battle ref, thread id, canonical text, expiry, adjustment id, whether a message is charged | `:50` | Yes as locals: `battleRef` `:192`, `randomUUID()` `:266`, `text` `:227`, `expiry: 'end_of_battle'` `:270`, `adjustmentId` `:177`, `isLeague` `:232`. The chat path adds `expectedDirectiveThreadId` (the slot as read), `budgetField`/`isLeagueAsk`, `mode`, and **the composed exchange** — the chip's has no user half, the chat's carries the reply, scratchpad and gate outcome. |
| **Preconditions inside the tx** — battle active and open, budget remaining, no duplicate thread id | `:50-52` | Yes: active `:205`, owner `:203`, agent binding `:207`, CAS `:209-214`, budget `:245`/`:258`. |
| **The writes** — directive slot, exchange, charge | `:50` | Yes, one `tx.update` + `commitBudget()` `:282-287`. |
| **The attested result `{ persisted, charged, reason }` on every path including failure** | `:53` | **No — this is the new part.** Today the handler returns `{ kind, … }` (`:199-298`) and the HTTP layer maps kind → status (`:301-333`). Ruling 7 names three outcomes: *"threw before the transaction (nothing persisted, nothing charged), rejected inside it (same), committed then threw (persisted and charged); the error body carries `persisted` / `charged`."* |
| **Idempotency by pre-minted id so a retry writes once** | not in §2 | **Absent from the spec and from both routes.** See §6.3. |

### 6.3 Is the research route's idempotency the same helper, or a sibling?

**A sibling with the same rule — not the same helper.** They share a *principle* and nothing else:

| | Directive filing | Research |
|---|---|---|
| Documents | battle + (League) budget doc | battle only |
| Charges | one message (D-105) | **nothing** (D-118) |
| Cap | the message budget | a **count of persisted cards** |
| Conflict semantics | CAS on `expectedDirectiveThreadId`, latest-wins | none — the universe check stands in |
| Id's job | links the directive to later trades (`chat.js:1000-1004`) | defeats `arrayUnion` deep-equality dedupe (`research.js:410-419`) |

Folding them into one function would mean a helper parameterised on "does this charge", "is there a second document", "is there a CAS" — three booleans that are three different routes. **The shared rule, stated once and applied twice: mint the idempotency key before `runTransaction`, and make the body a no-op when it finds its own key already on the document.**

Worth noting for the build: **`file-directive.js` does not need this fix**, even though it also mints inside the body (`:266`). Its transaction's outcome is decided by the CAS at `:209-214` — a re-execution after a landed commit re-reads the **new** thread id, `currentThreadId !== expectedDirectiveThreadId`, and returns `conflict` **without writing**. Its header claims this at `:60-63` and the claim holds. `research.js` has no equivalent precondition, which is exactly why it writes twice. **VERIFIED — and it is the reason B2 and the Show-it fix are separable.**

### 6.4 Which of these files are fenced

**None.** `chat.js`, `file-directive.js`, `research.js`, `directiveFiling.js`, `directiveGate.js`, the new `directiveTransaction.js`, `tickStamps.js`, `selectBench.js`, `PaneBench.jsx`, `AgentChat.jsx`, `AgentBattleScreen.jsx`, `useArenaEngine.js`, `decisionRecord.js`, `battleViewCopy.js` — not one appears on the `BUILD_RULES.md:14-24` list. VERIFIED.

Three adjacent gates the build must still respect:
- **The `createAgentBattle` doc shape is fenced as a concept** (`BUILD_RULES.md:26`). Both routes already write existing keys only, and `file-directive.js:65-68` records the reasoning (the League counter lives in its own collection *for exactly that reason*). B2 must not add a battle-doc key.
- **`research.js:58` calls the fenced `flattenPortfolioServer`** — §1-permitted (calling is allowed, editing is not), and `:55-57` records it.
- **The composition-protected-stores allowlist** — `research.js:39-45` notes its `tx.update` is handle-form and therefore carries an allowlist entry. B2's new module will have the same property; spec `:54` already says *"rows beside `compositionProtectedStoresAllowlist.json:163`"*.

### 6.5 Recommendation: **two builds**

| | Build 1 — B2 | Build 2 — Show-it prerequisites |
|---|---|---|
| Closes | Q1(a),(b),(c-inverse),(e1)–(e4); Q2 sites 1, 4, 5, 6; Q4's cap | Q3's double card; Q2 sites 2, 3 |
| Server | new `api/_utils/directiveTransaction.js`; `chat.js` (the write path); `file-directive.js` (call the module); `tickStamps.js` **or** `selectBench.js` (the cap, per §5.4) | `research.js` (hoist the id, add the found-my-own-key branch, give the not-active 409s a `status`) |
| Client | `AgentChat.jsx` (#1, #4), `useArenaEngine.js` (#5, #6), `decisionRecord.js` (the `persisted` gate), `PaneBench.jsx`/`selectBench.js` if the cap is read-side | `AgentChat.jsx` `showIt` (#2, #3) — point it at `researchFailureLine` and the body |
| Flag | **none** (spec §4 `:62`) | ships dark under `SHOW_IT_ENABLED = false` |
| Reachable today? | **Yes — live on every typed turn** | **No — 404 at `research.js:226`** |

**Why two, not one.** They are independent in code (§6.3 — no shared helper, no shared document beyond `agentBattles`), and **they differ in urgency by a whole category**: B2 fixes a path that is **live in production right now on every typed chat turn**, while the Show-it fix is unreachable until a flag flips. Merging them would put an unflagged production fix behind a dark feature's review. They also differ in review shape — B2 touches ~6 files across two surfaces and will approach the §2 review threshold; the Show-it fix is one route and one client function.

**Sequencing:** B2 first. If it lands the `{ persisted, charged, reason }` attestation vocabulary in `decisionRecord.js`, Build 2 inherits it for free and its client change becomes a two-line re-point rather than a new contract.

### 6.6 Test seams

**Server** — all in-process fakes; **no emulator suite exists for any of these routes** (§4.3):
- `api/agent/file-directive.test.js:98` — the fake whose `runTransaction` the other suites borrow.
- `api/agent/research.cap.test.js:86-120` — buffers, version-checks, discards and re-runs; `injectBeforeCommit` at `:108-112`. **Needs an `applyThenRetry` mode for Build 2** (§4.3) — the survivor proof.
- `api/agent/chat.test.js` — pins the ENFORCE and flag-OFF exchange shapes byte for byte (`directiveFiling.js:16-19`). **B2 must not move them**; `directiveFiling.js`'s conditional spread is what keeps flag-OFF identical.
- `api/_utils/mandateEscape.test.js:137-152` — the two-writer contention precedent (`db.setBarrier`), the shape B2's "eleventh commits with `overBudget`" row should follow.
- `api/agent/research.dark.test.js:158-182` — a **source-walking** test asserting every pre-transaction refusal attests and nothing below the transaction does. Per Sep 10 rule 2, source-walking is not a substitute for a mounted test — but here it guards a *structural* invariant a behavioural test cannot express, and it is mutation-checked three ways (`20260910_FOUR_ITEM_BUILD_REVIEW.md:81`). **Extend it rather than replace it**, and add the behavioural rows beside it.

**Client** — mounted jsdom suites with real response shapes already exist and are the right homes:
- `src/screens/AgentBattleScreen.showIt.jsdom.test.jsx:199-376` — already stubs `{ ok: false, status: 409, body: { noCardWritten: true, status: 'research_exhausted' } }` **and** `{ ok: false, status: 409, body: { status: 'research_exhausted' } }` (`:220`) side by side. **The 409-collision row for Build 2 belongs here** and the fixtures are already written.
- `src/screens/battleView/showItDoor.jsdom.test.jsx:111-115` — pins the exhausted string on the door.
- `src/components/Agent/AgentChat.chips.jsdom.test.jsx`, `AgentChat.research.render.test.jsx`, `AgentChat.sendFailed.test.jsx` — the chip, card and send-failure homes for B2's client rows.
- `src/components/League/battleArena/ArenaMobile.smoke.test.jsx` — the arena's mounted home for the `useArenaEngine` "not charged" removal.

Per Sep 10 rule 2, **every client row above must be mounted and mutation-checked** — the review's second headline result is that three source-text greps stood in for the screen half and two real defects were silent across 12,266 tests.

---

## 7. Q6 — Flags and reach

**B2 needs no flag. Confirmed.** The spec rules it directly (`PHASE_B_TICK_STAMPS_SPEC_V1.md:62`, VERIFIED): *"B2 ships unflagged as a fix to a failing path (**the P-1 precedent**), after its own review."* Nothing in the directive change adds a surface or a behaviour a user could see as new: it makes an existing write atomic, moves an existing charge inside it, and adds fields to error bodies that no client reads yet. `chat.js` has no route-level flag today (§2.1) and B2 adds none.

*(One precision: the brief names "the transport build" as the precedent; the spec names **P-1**. Both may be true — `claude/eval-transport-hygiene` is one of the three open PRs and may well be the transport build — but the sentence that authorises B2 says P-1, and that is the citation to carry into the PR.)*

**The chip path stays reachable only at resolved `'on'`. Confirmed (D-102/D-106).** `file-directive.js:172-174` — `if (getVoiceGroundingMode(user.uid) !== 'on') return res.status(404)`, before any read. The header (`:156-164`) binds it to the same resolution that mints the chips: `chat.js:476` `grounded = groundingMode === 'on' && mode === 'battle'`, consumed at `:897`. `VOICE_GROUNDING_MODE = 'shadow'` at HEAD (`featureFlags.js:2137`). So **at today's shipping configuration no chip is minted and the chip route 404s** — independently confirmed by `20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md:223` (read from `claude/eval-transport-hygiene`): *"The chip route is dark: `POST /api/agent/file-directive` returns 404 before any read unless the caller resolves to `'on'` … At `'shadow'` nothing mints a chip and nothing can file one."* VERIFIED at HEAD, independently of that doc.

**This is why B2 is urgent.** At `'shadow'`, the **only** way to file a directive is the typed path — the one with no transaction. Same source, §5.1 (`:222`, `:251`): *"At `'shadow'` only a typed Battle View chat message that the deterministic gate resolves to a canonical adjustment files a directive (`POST /api/agent/chat` → `agentBattles/{id}.directive`)."* **Every directive filed in production today goes through the unconditioned write.**

**The research route is unreachable while dark. Confirmed.** `research.js:226` — `if (!SHOW_IT_ENABLED) return res.status(404).json({ ...NO_CARD_WRITTEN, error: 'Not found' })`, and `SHOW_IT_ENABLED = false` (`featureFlags.js:2286`). The 404 sits **after** auth deliberately (`:222-225`: a pre-auth 404 would answer an anonymous caller differently while dark than while lit — a free oracle on an unreleased feature's rollout state). `research.dark.test.js:47` pins it hard: the dark suite's `runTransaction` **throws** — *"a dark route must never open a transaction."* The chat chip that would call it is also dark twice over: `researchFollowUp` requires `grounded && SHOW_IT_ENABLED` (`chat.js:917-919`), and the chip is only normalized when `SHOW_IT_ENABLED` (`:901`). **So the Show-it prerequisite ships dark under the existing flag, with no new one.** VERIFIED.

**The smoke for each route.**

- **Typed path (B2):** a filing on a **live** battle whose response body attests `persisted: true, charged: true`, and whose Firestore write matches — `agentBattles/{id}.directive` carrying the minted `directiveThreadId`, one appended `chatExchanges` element carrying the same id top-level and inside `directive`, and `chatBudgetUsed` **incremented by exactly one, from a read-back count**. The negative half is the one that proves the fix: a turn that throws after the commit must answer with `persisted: true` — not a bare 500 — and `useArenaEngine` must **not** say the counter was left untouched. Observable on Vercel preview; it is the live path at `'shadow'`, so no flag flip is needed to exercise it.
- **Research route (Show-it):** **nothing observable until the flip.** The route 404s, the chip is never minted, the door is behind `isBattleViewControllerOn() && SHOW_IT_ENABLED` (`featureFlags.js:2302`). Its entire proof is the test suite — which is precisely why the `applyThenRetry` seam (§4.3) is not optional: it is the only thing that can demonstrate the double card is gone.

---

## 8. For the design chat

**Q1.** The two routes file the same object through genuinely different code — `file-directive.js` inside one transaction with every precondition re-read, `chat.js` through a single pre-model read and one unconditioned `battleRef.update()` (`:1067`) — and of the five candidates offered, **(a) an unguarded write into a closed battle and (b) a budget race are real; (c) is false as written but its inverse is real (a 500/504 after a landed write); (d) is refuted (both paths mint and shape the id identically); and (e) is four more, the sharpest being that `chat.js:1073` uses the `FieldValue.increment` D-105 names as forbidden.**

**Q2.** **No route emits `persisted` or `charged` on any path**, and seven client sites infer cost or persistence from an HTTP status — `useArenaEngine.js:95-97` says *"The server did NOT charge"* in so many words — while the Show-it door (`AgentBattleScreen.jsx:1317`) already reads the body and is the pattern to copy.

**Q3.** Real and verified: `researchId` and `now` are **default parameters** evaluated per call (`research.js:407`), so a retry after a landed-but-unacknowledged commit re-reads `used = 1`, passes the cap, and appends a **second** card — the route's own header reasons only about the last slot, and the fix (hoist both, no-op when the body finds its own id) needs a test seam the repo does not yet have.

**Q4.** D-112 rules that a cap exists and that B2 builds it, but **"first five" appears only as "e.g. first five" in two Sep 9 records and no ruling states the placement** — no cap exists today at write or read, the read is already bounded by the roster intersection, and the honest default is to **cap at the read**, with the byte ceiling handled separately by a generous write-side guard if that is what the founder actually wants.

**Q5.** The shared module is already specified at `PHASE_B_TICK_STAMPS_SPEC_V1.md:49-54` and its source anchor `file-directive.js:196-299` has not drifted; what is new is the attested `{ persisted, charged, reason }` on every path and an idempotency rule that is a **sibling, not a shared helper** — and `file-directive.js` does not itself need it, because its CAS already makes a retry return `conflict` without writing.

**Q6.** Confirmed on every clause: B2 needs no flag (spec `:62`, the P-1 precedent), the chip path stays `'on'`-only (`file-directive.js:172`), and the research route provably never opens a transaction while dark (`research.js:226`, pinned by `research.dark.test.js:47`) — so the Show-it fix ships dark under the existing `SHOW_IT_ENABLED = false`.

### The recommended build shape

1. **Two builds.** B2 first (live in production on every typed turn at `'shadow'`); the Show-it prerequisite second (unreachable until the flip, and it inherits B2's attestation vocabulary).
2. **B2 touches:** new `api/_utils/directiveTransaction.js` (extracted from `file-directive.js:196-299`), `api/agent/chat.js` (the write path `:1005-1079`), `api/agent/file-directive.js` (call the module), `src/data/decisionRecord.js` (the `persisted` gate), `src/components/Agent/AgentChat.jsx`, `src/components/League/battleArena/useArenaEngine.js`, plus the cap in `selectBench.js` (read-side) — **~7 files; at or near the §2 review threshold, so plan the adversarial review in.**
3. **Fenced: no** — none of these files is on the `BUILD_RULES.md:14-24` list; the live constraints are the `createAgentBattle` doc shape (existing keys only) and a `compositionProtectedStoresAllowlist.json` row for the new handle-form `tx.update`.
4. **Idempotency:** pre-mint the key before `runTransaction` and make the body a no-op when it finds its own key on the document — for research, hoist `researchId` **and** `now` (both are per-call defaults at `research.js:407`); for filing, the CAS already provides it.
5. **Attestation:** `{ persisted, charged, reason }` on **every** path including failure, following `research.js`'s own pre-/in-transaction split — the route knows which side of the commit it is on, and no other party can.
6. **Test seams:** extend `research.cap.test.js:86-120`'s fake with an `applyThenRetry` mode (the ambiguous commit — the Sep 10 refuter built this and it was never committed); mounted client rows in `AgentBattleScreen.showIt.jsdom.test.jsx` (409 fixtures already written at `:199-220`), `AgentChat.chips.jsdom.test.jsx` and `ArenaMobile.smoke.test.jsx`; mutation-check every row, per the Sep 10 review's second headline.

---

## 9. Found outside the six questions — for separate tasking, not fixed

Per BUILD_RULES §3 (*"Found a bug outside your task? Report it for separate tasking; do not fix it"*).

1. **The Phase C rulings never reached the ledger.** `COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` stops at D-115; D-116 → D-122 live only in the two Phase C spec files. A session told "read the ledger" will not find D-118 or D-121. **Documentation, not code.** (§0.2)
2. **`AgentChat.jsx:1131` gives an unattested 500 the attested sentence.** `showItFailed` is built from `RESEARCH_FAILED_LINE` — the *"no use spent"* half — while `research.js:391`'s 500 is deliberately unattested because it can follow a landed commit. Same defect family as the 409 collision, same fix site, and it should ride Build 2. (§3.2 #3)
3. **`chat.js`'s 502 at `:814` is honestly attestable and thrown away.** It returns before the write, so nothing persisted and nothing charged — the one failure status that could carry `persisted: false` today with no new machinery. Cheap to include in B2. (§2.4 e4)
4. **`research.js`'s two not-active 409s (`:267`, `:364`) distinguish themselves only by an English `error` string.** Even after the chip is fixed to read the body, the distinction rests on prose. Giving those arms an explicit `status` is a one-line change that makes the client's correctness structural rather than string-matched. (§4.4)
5. **The spec's own line anchors have drifted** (`chat.js:996-1008`, `:950-951`, `:496-510`) — §6.1 tabulates the HEAD equivalents. Worth an errata row in `PHASE_B_TICK_STAMPS_SPEC_V1.md` so B2 does not extract against stale coordinates.
6. **Order-dependent test failure, inherited.** `src/components/League/battleArena/useSessionCompositeTrail.test.jsx` fails 2/21 run alone, passes in a wider run — recorded as unrelated and unresolved in `20260910_FOUR_ITEM_BUILD_REVIEW.md:47`. Still filed; **not re-verified this session** (no tests were run). ASSUMED — basis: that record.

---

**STOP.** Read-only discovery complete. No production file was edited, no test was edited, no branch beyond `claude/phase0-b2-showit` was created, and no PR was opened. This discovery branch is not to be merged on its own — the build branch cherry-picks it. The build prompt follows from §8.
