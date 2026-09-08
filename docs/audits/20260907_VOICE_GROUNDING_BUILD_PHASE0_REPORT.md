# Voice-layer grounding — build Phase 0 report (Session 1)

**Date:** September 7, 2026 · **Read-only.** No prompt text changed; no fenced file edited; the branch carries two docs-only commits (the spec, then this report).
**For:** the founder, then the Session 2 build. Answers `VOICE_GROUNDING_BUILD_SEED_V1.md` §1 items 1–9; where the seed and `VOICE_LAYER_GROUNDING_SPEC_V1_2.md` differ, the spec wins.
**Base:** `origin/main` at `d1233488` (the #818 pane-flip merge). The R6 ATR fix is **not** merged (§0).
**Method.** One reader; every anchor below re-read at HEAD in this session. VERIFIED = read at that line in this session; ASSUMED is marked. NOT FOUND is a first-class answer.

---

## 0. Preamble — git verification (BUILD_RULES §2 / §3)

| Item | Value |
|---|---|
| `git fetch origin` | **Run first**, before any comparison (§3). Pulled new refs: `ops/step-minus-1-cron-quiesce`, `smoke/character-pane`, `ui-redesign`, `ui-redesign-backup`, tag `backup-with-research`. |
| Branch (harness-assigned) | `claude/voice-layer-grounding-phase-0-i0hmxq` — existed locally at open, at `d1233488`; not on the remote at open. Pushed with this report. |
| HEAD at open | `d1233488122f5946626cbf0015151070e2fa188d` — "Merge pull request #818 from fashraf94/flip/battle-view-character-pane" |
| `origin/main` | `d1233488` — identical to HEAD (`git rev-list --left-right --count origin/main...HEAD` = `0 0`). The branch is cut from current `main` as the seed requires. |
| Working tree | Clean at open; clean after every read; only the two docs files added. |
| **R6 ATR fix** | `origin/claude/atr-percentile-rendering-0dhbcy` @ `40008de8` ("Fix ATR unit collision in voice-layer briefs: percent vs percentile") — one commit **on top of `d1233488`**, **not an ancestor of `origin/main`**. Not merged; not cherry-picked (per the session brief). It touches `api/_utils/voiceLayerPrompt.js` (+12 lines net, both hunks above `:1150`), `api/cron/voice-layer-cache.js` (+26 lines net across four hunks in the two brief builders) and both test files. Session 2 rebases onto `main` once it merges, or cherry-picks `40008de8` before G1. Every anchor in this report gives the HEAD line and, where it moves, the post-fix line. |
| **The discovery (the seed's basis)** | `docs/audits/20260907_VOICE_GROUNDING_PHASE0_DISCOVERY.md` is **NOT on `origin/main`**. It exists in exactly one ref: `origin/claude/voice-grounding-phase0-discovery-tn3lsa` @ `dcd3a7a2` ("docs: voice-layer grounding Phase 0 discovery (V1.1)"), whose parent is `d1233488` — so its anchors were taken on this exact tree, and every C8 line re-verifies at HEAD with zero drift (§3). Read from that commit into the session scratchpad; **not committed here** (it would duplicate that branch's commit on merge). §4 discrepancy 1. |
| **Sol's reviews** | `20260907_SOL_REVIEW_VOICE_GROUNDING.md` — **NOT FOUND.** Not attached to this session (the uploads directory held the seed and the spec only) and present in no ref (`git log --all --diff-filter=A` on `*SOL_REVIEW*`: none). Not committed. §4 discrepancy 2. |
| First commit | `docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_2.md` — the attached spec, byte-for-byte. |
| Second commit | this report, `docs/audits/20260907_VOICE_GROUNDING_BUILD_PHASE0_REPORT.md`. A byte-identical copy was written first to the session scratchpad (§3). |
| Fence contact | **None.** Fenced files opened only to cite: `agentEvalPromptAssembly.js`, `decide.js`, `agentBattleService.js` (one grep). `agentEvalToolSchema.js` (fence-adjacent, not on §1) read in full to cite. No dependency install, no test run, no build — nothing changed that a test could measure. |
| Documents read | `docs/BUILD_RULES.md` · `docs/README.md` · the seed · the spec · the discovery (from `dcd3a7a2`) · the ledger rows the seed cites (`docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md:36`, `:431`, `:455`, `:469-498`; `docs/design/PHASE_A3_RULINGS_AND_AMENDMENTS_V1.md:64-65`). |

---

## 1. Executive verdict

| # | Item | Verdict | In one line |
|---|---|---|---|
| 1 | `signalSummary`'s contract | **FOUND — descriptive by contract; CONSTRAINED** | Present-tense evidence on both sides of the fence; `threshold` is the action field. The note **may carry the signal clause**, guarded by the reply lint in code, and the "no threshold token" test must key on the *field*, not the substring. |
| 2 | The shipped directive write | **FOUND** | One `battleRef.update()` (`chat.js:686-708`), not a transaction: exchange + budget increment + elicitation targets + the `directive` slot `{ text, expiry, directiveThreadId, createdAt, [adjustmentId, canonicalTextVersion] }`. Binding is positional (the battle doc), not a field. Two budget stores exist. |
| 3 | The 27 vocabulary sites | **FOUND — all 27 at the discovery's lines, zero drift at HEAD** | Post-ATR-fix lines computed (+12 for every `voiceLayerPrompt.js` site ≥ `:1150`). Three candidate sites the discovery did not list; the list is 28 strings, not 27 (§3). |
| 4 | History filter + every writer | **FOUND — six writers, one fenced** | The filter keeps only exchanges with a non-empty `userMessage`. Five non-fenced writers can stamp `groundingVersion: 1`; the deploy-time opener is written by fenced `decide.js:1629-1640` and cannot. A fifth agent-initiated writer (`auto_debrief`) the seed omits. |
| 5 | Client response handling | **FOUND — chips route through chat on both surfaces; `Filed:` / `directiveStatusLine` render nowhere** | The arena reads `agentMessage` + `remaining` only. The Battle View ignores the body and renders from the persisted exchange — and already renders a code-owned `Filed {time}` receipt (D-51) for typed directives. |
| 6 | The shadow stream | **FOUND — neither the prompt nor its hash is logged on `conversations`** | Record shape, GCS path and credentials pattern cited; the three proactive streams log the full prompt; the reader template is `sample-voice-layer-terms.js`. No size rule in the logger. |
| 7 | The cache brief shape | **FOUND — `fundamentals` sits on the `rankingsMap` entry the cache already holds; the brief copies none of it** | Field names, vintage (`computedAt`), null-honesty and the existing decider-side renderer cited; the render site is the brief builders / block list at `voiceLayerPrompt.js:2982-2987`. The ATR fix edits the same functions. |
| 8 | Flag precedents | **FOUND — two constraints** | The house tri-state is `ARCHETYPE_INTEGRITY_MODE` / `SECTOR_CAP_MODE`; the accessor rule is `isCharacterPaneOn()`. But the uid allowlist precedent is an **env var**, not a constant, and a **string flag cannot sit in `DARK_BY_DESIGN`** (the pin guard tracks `*_ENABLED = true|false` only). |
| 9 | Fence | **FOUND — every file the spec touches is non-fenced** | Matches the discovery's G17 against BUILD_RULES §1. Three fence-adjacent notes: `agent-evaluate.js`'s swap ledger, the prose-honesty sweep on `voiceLayerPrompt.js`, and the import-boundary ratchet. `directiveGate.js:59-95` is not exported. |

**Nothing here is a STOP for the build.** Six items need a founder call before G1–G5 (§4): the discovery branch merge, the canary-uid mechanism, the flag's pin/dark registration, the fenced opener, the audit exchange's field names, and which budget a chip charges on the League surface.

---

## 2. Findings

### Item 1 — `signalSummary`'s contract (spec §9 gate 0a) · FOUND, descriptive; CONSTRAINED

**The schema (`api/_utils/agentEvalToolSchema.js`, fence-adjacent, read to cite).** `anticipationCandidates` `:157-192`; each item requires `symbol`, `direction`, `signalSummary`, `threshold` (`:163`). The two fields, verbatim:

- `signalSummary` `:174-177` — *"One short sentence on why this candidate just became interesting. Anchor in signals you can see directly (RS percentile, threshold proximity, NR7 / BB squeeze state, regime, risk status). Example: 'Relative strength building against XLK and volume is confirming.'"* — present tense, evidence only, no verb of intent, no conditional.
- `threshold` `:178-181` — *"One short sentence stating the specific condition that would make you act. Must be specific. … Example: 'If it holds above the 20-day on the next test, I would rotate it into Core.'"* — action-bearing by contract (the §7-list item; withheld).
- `rationale` `:182-185` — *"Optional. Fuller context for the Voice Layer, 1-2 sentences."* — **unconstrained**; not proven descriptive; must not ride the note.
- `signalSource` `:186-189` — a category tag (`relative_strength`, `threshold_proximity`, `momentum`, `regime`, `risk_status`), examples only, `type: 'string'`.
- The array's own description `:160` frames the whole entry as *"candidates or current holdings you are watching but have NOT acted on this tick"*.

**The fenced prompt (`api/_utils/agentEvalPromptAssembly.js`, read to cite).** The anticipation block `:485-511` (tiered) is duplicated verbatim in the flat6 sibling `:688-714`. `:500` / `:703` — *"signalSummary: one short sentence anchored in signals you can actually see. Example: 'Relative strength is building against the sector and volume is confirming.' Do NOT invent indicators you do not have data for."* `:501` / `:704` — *"threshold: … the specific condition that would make you act … The threshold is what makes anticipation feel honest — if it hits and you act, the user sees the loop close."* `:492-493` — *"you are watching for the trigger" / "you are watching for the next session"*: the watching frame sits on the block, not on the field. `:509` — *"DO NOT POPULATE FOR: Anything you do not have direct signal data for."*

**What is persisted.** The candidate list is not on the evaluation entry (`agent-evaluate.js:2052-2057` only queues it; D-79 stands). The anticipation exchange carries `anticipationContext { symbol, direction, threshold, evaluationId }` (`voiceLayerAnticipation.js:202-207`) — `signalSummary` reaches only the shadow log (`:242-248`, `:269-274`) and the cron-skip breadcrumb (`agent-evaluate.js:2878-2883`).

**Verdict.** By contract, on both sides of the fence, `signalSummary` is descriptive present-tense evidence and `threshold` is the action clause. **The G3 note may carry `The signal it recorded: {signalSummary}`.** Two constraints the build must honour:

1. **The contract is a description, not a validator.** The field is `type: 'string'`; nothing in the schema, the fenced prompt, or the cron (`:2053-2057` queues any object with a `symbol`) rejects an action sentence written into `signalSummary`. The clause should pass through the reply lint the spec already defines (§9 gate 1: `I'll rotate|I'm rotating|eyeing|watching|keep an eye|I'd consider … swap`) **in code, before the write**; on a hit, drop the clause and keep the event note. Deterministic, no model call, one function, unit-tested with a hostile fixture.
2. **"threshold" is a legitimate word in descriptive signal text.** `threshold proximity` is a named signal category (`agentEvalToolSchema.js:176`, `:188`) and the scoring tiers are "thresholds" throughout the decider's world (`agentEvalPromptAssembly.js:557-560`). A true signal sentence such as "within 0.2x ATR of the bagger threshold" would fail a substring guard. The spec §10 row "no threshold token in the exchange" must assert that the `threshold` **field** is never copied onto the exchange or into the text, not that the substring is absent.

**Meaning.** The event note can say what the decider recorded seeing, in the decider's words, and still never say what anyone will do — provided the lint runs on the way in.

### Item 2 — The shipped directive write's shape (spec §9 gate 0b) · FOUND

**The one write (`api/agent/chat.js:686-708`).** A single awaited `battleRef.update()` inside the handler's `try` — atomic as one update, **not** a read-check transaction:

| Key | Line | Value |
|---|---|---|
| `chatExchanges` | `:687` | `FieldValue.arrayUnion(exchange)` |
| `[budgetField]` | `:692` | `FieldValue.increment(1)` — **only when `!isLeagueAsk`**; `budgetField` = `MODE_BUDGET[mode].field` (`:171-174`, `:272`): battle → `chatBudgetUsed` (limit 10), review → `reviewBudgetUsed` (limit 5) |
| `recentElicitationTargets` | `:684`, `:693` | last three dimensions |
| `directive` | `:694-707` | spread **only when `directiveThreadId`** is non-null |

**`battle.directive` (the slot, `:695-706`), field by field:**
- `text` — `normalizedDirective.text` (`:696`); under `enforce` this is `getCanonicalText(effectiveArchetype, id)` (`directiveGate.js:80` → `src/data/archetypeAdjustments.js:224-227`, null on an unknown pair — no fallback).
- `expiry` — `normalizedDirective.expiry || 'end_of_battle'` (`:697`); the gate always writes `'end_of_battle'` (`directiveGate.js:81`); the enum is `end_of_battle | 3_games | permanent` and `isDirectiveActiveOnDay` treats `end_of_battle` as always active (`directiveUtils.js:43-46`).
- `directiveThreadId` — `randomUUID()` minted at `:638` iff `effectiveHasDirective && normalizedDirective`; stamped on the slot (`:698`), on the exchange's directive (`:649`) and top-level on the exchange (`:661`).
- `createdAt` — ISO string (`:699`). Present on the slot only; the exchange's directive has no `createdAt`.
- `adjustmentId`, `canonicalTextVersion` — spread only when the gate minted them (`:702-705`; `directiveGate.js:82-88`); the flag-off `normalizeDirective` path (`:123-131`) writes the pre-Release-2 shape byte-identically.

**The exchange record (`:640-682`).** `userMessage`, `agentResponse`, `scratchpad`, `hasDirective` (`:641-644`); `directive: { text, expiry, directiveThreadId, [adjustmentId, canonicalTextVersion] }` or `null` (`:645-660`); top-level `directiveThreadId` (`:661`); `suggestedActions`, `elicitationTarget`, `timestamp`, `mode` (`:662-665`); `groupId` on tournament battles (`:675-677`); `archetypeGate: { classification, selectedAdjustmentId, status, repairUsed }` when the gate ran (`:681`; shape `directiveGate.js:135-147`). **No `messageType`** on a chat turn — the client defaults it to `user_initiated` (`deriveChatMessages.js`).

**The agent/battle binding — NOT a field.** The slot lives on `agentBattles/{battleId}` (`:231`, `:686`); the battle's `agentId` is set at creation (`agentBattleService.js:130`, fenced, cited) and is what `ensure-opener.js:173-176` and the cron trust. The chat route binds the caller by `battle.ownerId === user.uid` (`:239`) and reads `agents/{agentId}` from the **body** (`:265`) — it does **not** check `battle.agentId === agentId`. The archetype the gate uses is server-derived: `getEffectiveArchetype(battle, agent)` = `battle.agentContext.archetype || agent.archetype` (`directiveIdentity.js:50-52`, called `chat.js:539`). So spec §6.1's "the agent belongs to this battle" is a **new** check relative to the shipped write (§5 outside-task item 4).

**Budget fields and increments — two mechanisms:**
- *Per-battle (Battle View):* read `:272-273`; cap check `:278` **before the model call, non-transactional**; increment `:692`; the response carries `exchangeNumber: currentBudget + 1` (`:589`) and `budgetTotal: budgetLimit` (`:590`). A concurrent pair can overspend by one — the shipped limit (§5 item 2).
- *League ask:* `isLeagueAsk = body.leagueAsk === true && LEAGUE_AGENT_CHAT_ENABLED` (`:214`); the per-battle cap is bypassed (`:278`); early exhausted gate `:300-316` (a 200 in-voice line, `remaining: 0`, no charge); the charge runs **after** the write (`:732-745`) through `chargeAgentChatBudget` — `db.runTransaction`, in-tx read, explicit `count + 1`, soft cap, own collection `agentChatBudget/{groupId}_{uid}_{dayN}`, 10 per game-day (`agentChatBudget.js:33-36`, `:103-121`); `clientResponse.remaining` (`:739`); fail-open when the key is unresolvable (`:299-301`, `agentChatBudget.js:59-72`).

**D-18 latest-wins** is by construction: `:694-707` sets the whole `directive` object; nothing reads the prior slot and nothing records the replaced thread id — the client derives `replaced` from the exchange walk (`src/screens/battleView/deriveReceipts.js:11-15`, `:56-67`).

**What returns after the write.** `clientResponse.directive` (`:593`) is the gate's object **without** `directiveThreadId` or `createdAt`; `extractedRule` (`:585-587`); `directiveStatus` / `directiveStatusLine` / `directiveFallback` only when the gate ran (`:604-606`, `renderDirectiveStatus` at `directiveGate.js:49-53`).

**Fixture source for G4's shape-equality row.** `chat.test.js:133-138` (the `FieldValue` mock), `:616-617` (`mainUpdate` / `exchangeOf`), `:655-667` (the ENFORCE valid-id row asserting `updates.directive.text`, `.directiveThreadId` and the exchange's thread id). Capture `updates.directive` and `exchangeOf(written).directive` from that row as the fixture.

**Meaning.** `file-directive` copies `:694-707` and `:645-661` field for field; what it adds is the transaction (an in-tx read of `battle.directive`, `battle.status`, the budget, and the archetype), the `agent belongs to this battle` check, and one audit exchange. The one open design fact is that **two budget stores exist and the spec's route body carries no surface marker** (§4 discrepancy 11).

### Item 3 — The 27 vocabulary sites at HEAD · FOUND, zero drift; post-fix map; three candidates missed

Every string re-read at HEAD by exact substring; the post-fix column is `git show 40008de8:api/_utils/voiceLayerPrompt.js` grepped the same way. Sites 1–12 (all above `:1040`) do not move; sites 13–25 and the narration line move by **+12**.

| # | HEAD | After `40008de8` | The words (surface) |
|---|---|---|---|
| 1 | `voiceLayerPrompt.js:117`, `:154`, `:186` | same | CONFIRMATION rule — "receipt-plus-intent … 'I'll lean toward the strongest semis on my next read' … 'I'll revisit if the setup tightens'" (battle, all three phases) |
| 2 | `:118` | same | "I'm actually seeing some opportunity in our Star picks — CF and EIX have solid setups." |
| 3 | `:125` | same | CLOSING RULE — "state which option YOU lean toward … 'I'm leaning aggressive here'" |
| 4 | `:155` | same | "I'm seeing something interesting on AVGO — the technicals are lining up for a breakout." |
| 5 | `:158` | same | "I'm leaning toward trusting what we've built. Talk me out of it?" |
| 6 | `:160` | same | "I'd go aggressive-momentum with a 3-stock sector cap." |
| 7 | `:187` | same | Mastery — "Lead EVERY conversation with a complete, pre-formed plan" |
| 8 | `:188` | same | "Day-to-day execution is on you." |
| 9 | `:217` | same | DISCOVERY_EXAMPLE — "I'll lean toward the strongest semis on my next read … I'll flag it if I see it." |
| 10 | `:223` | same | MASTERY_EXAMPLE — "That's the lean I'm taking into the open unless you push back." |
| 11 | `:227` | same | CONFIRMATION_EXAMPLE — "my risk rules act on their own meanwhile" |
| 12 | `:78` | same | THIRD_PATH null-write hand-off — "I'd lean toward tightening the stop if you want me to" (the *permitted* offer shape; §4 keeps the offer to *file*) |
| 13 | `:3040` | `:3052` | first message — "that you're watching or starting with" |
| 14 | `:3067` | `:3079` | "I'm leaning into semis today — TSM and AMAT specifically" |
| 15 | `:3070` | `:3082` | "I'm starting tight with LLY as the conviction play and KO as ballast." |
| 16 | `:3073` | `:3085` | "RKLB's the one I'm curious about" |
| 17 | `:3062` | `:3074` | the NOT-THIS example — "starting the day watching RKLB and PANW" |
| 18 | `:3499` | `:3511` | anticipation — "eyeing", "watching", "keeping a closer eye on", "have my eye on" |
| 19 | `:3502` | `:3514` | "Eyeing CRWD on the bench." |
| 20 | `:3504` | `:3516` | "state what would make you act" |
| 21 | `:3514` **and `:3534`** | `:3526`, `:3546` | "One more day of strength and it's a Star tier candidate." — the sentence appears twice (the discovery cited one) |
| 22 | `:3515`, `:3537` | `:3527`, `:3549` | "I'm rotating out." |
| 23 | `:3531` | `:3543` | "I'd rotate it into Core." |
| 24 | `:3540` | `:3552` | "I'd consider it for Support tier." |
| 25 | `:3613` | `:3625` | "tell the user what you're watching and what would make you act" |
| — | `:3287` | `:3299` | trade narration — "JNJ gives the portfolio some ballast while we wait for clarity" (the discovery's unnumbered 28th string) |
| 26 | `openerTemplateFloor.js:80` | same | "I'll flag anything that starts moving — anything you want me watching from the open?" |
| 27 | `chat.js:73`, `:76` | same | elicitation — "'act now at open' vs 'wait for confirmation'"; "Present a decision the agent could make independently." |

**Count.** The discovery numbers 27 and carries 28 strings (the narration line is unnumbered). The G2 guard list should hold 28 — plus whichever of the candidates below the build adopts.

**Candidate sites the discovery did not list** (a forward-language sweep of the module, every hit read):
- **(a) `voiceLayerPrompt.js:3045`** — first message: "You go first (show you've done work), then invite the user in" — frames the opener as the character's own analysis; under §7 the generated opener names the book and the *persisted* deploy reason (D-76), so this register line rewrites with 13–17. **Adopt.**
- **(b) `:3041`** — "One sentence of context for why those tickers — sector composition, regime themes … what makes them interesting today" — asks the character to *author* the reason; D-104 renders the persisted deploy artifact instead. **Adopt.**
- **(c) `chat.js:64-79`** — the other thirteen elicitation instructions (site 27 lists two). They are sent every turn (`voiceLayerPrompt.js:2955`) and several stage decisions for the character to make (`:65`, `:69`, `:70`, `:76`). A build decision, not a string edit: whether the elicitation block survives under the flag at all. **Founder call**; not a guard string.
- **Inert under the flag** (in the retired builders, listed for completeness): `:3549` "If it confirms, I'll commit."; `:3553` "If volume picks up, I'll act."; `:3557` "If conditions improve, I'll act." (anticipation NOT-THIS examples); `:3490`, `:3493`, `:3496`, `:3508`, `:3571` (the anticipation frame); `:3244`, `:3247` ("reporting action you just took", "You have decided and acted"), `:3356-3359` (`buildActiveDirectiveBlock` — "what the user has you working on right now", used only by narration `:3406` and anticipation `:3632`). Under the flag neither prompt is assembled, so the spec's guard ("no string in any assembled prompt with the flag on") is satisfied without touching them.
- **Not this build's voice:** `:207` (Mastery — "I might need to rethink this — the old playbook might not fit here": a hedge about convictions, no trade forecast; leave); review mode `:425`, `:428`, `:430` (grading, past tense); workshop `:372`, `:376`, `:380` and the watchlist dialogue `:585`, `:604`, `:658`, `:759-762` (a different surface, future-tense by its own design).

**Meaning.** The list is stable at HEAD, the only line motion is the ATR fix's +12 in the first-message and anticipation blocks, and two first-message lines belong on it that were not there.

### Item 4 — The history filter and every writer of an agent-initiated exchange · FOUND; one writer is fenced

**The filter (`chat.js:411-417`).** `battle.chatExchanges.slice(-10).filter(ex => typeof ex.userMessage === 'string' && ex.userMessage.length > 0)`, then each survivor becomes a user/assistant pair. Every agent-initiated exchange (`userMessage: null`) is dropped whole; the reason is Gemma's strict role alternation (`:400-410`). The comment's `__REVIEW_START__` case describes **legacy data**: at HEAD no writer persists that string as a `userMessage` — `agent-batch-review.js:356` sends it to Gemma as the kickoff, and the exchange it writes has `userMessage: null` (`:383`); the client keeps a compat branch for old docs (`deriveChatMessages.js:48`). §5 outside-task item 1.

**Every writer of an exchange at HEAD** (`chatExchanges: FieldValue.arrayUnion` across `api/`, each read):

| # | Writer | Exchange composed at | Written at | `messageType` | Fenced? |
|---|---|---|---|---|---|
| 1 | Deploy-time generated opener | `api/agent/decide.js:1629-1640` | `:1654-1657` (+ `statusFeed`) | `first_message` | **YES** |
| 2 | Lazy opener — generated *and* template floor | `api/agent/ensure-opener.js:88-101` (`buildExchange`; "exact shape of the deploy-time first_message exchange") | `:270-281`, inside `db.runTransaction` | `first_message` | No |
| 3 | Trade narration | `api/_utils/voiceLayerTradeNarration.js:193-212` | `:230-233` (+ `statusFeed`) | `trade_narration` (+ `tradeContext`) | No |
| 4 | Anticipation | `api/_utils/voiceLayerAnticipation.js:190-208` | `:218-220` | `anticipation` (+ `anticipationSource`, `anticipationContext`) | No |
| 5 | Post-market auto-debrief | `api/cron/agent-batch-review.js:382-394` | `:396-398` | `auto_debrief` (+ `isAutoDebrief: true`, `mode: 'review'`, `suggestedActions`) | No |
| 6 | The chat turn (user-initiated) | `api/agent/chat.js:640-682` | `:686-708` | **absent** (client defaults to `user_initiated`) | No |

Writer 5 is **not in the seed's list** (item 4 names the opener, narration, anticipation and the chat turn). Writer 2 produces the same object for a generated and a floored opener (`:258` vs `:261`) with no marker — the outcome exists only in the HTTP status (`:280-283`).

**Meaning.** Stamping top-level `groundingVersion: 1` is one line at writers 2–6 (writer 5 in review mode, harmless and consistent). **Writer 1 is fenced**: the deploy-time generated opener — the common case, since `ensure-opener` runs only when the deploy-time call was dropped (`ensure-opener.js:3-12`) — cannot carry the marker without a §7 fence contact. Under spec §3.4's one rule, that opener stays out of the history window. The founder chooses: accept it (the opener is the least useful history line), a `first_message` exception in the filter (breaks M3's one-rule), or a §7 ruling for one key in `decide.js`. Not the build's call (§4 discrepancy 8). The chat turn's missing `messageType` means §3.4's per-line tags need a code default (`user_initiated`), mirroring the client's `resolveMessageType`.

### Item 5 — The League client's and the Battle View's response handling · FOUND; chips, `Filed:`, `directiveStatusLine` render nowhere today

**League (`src/components/League/battleArena/useArenaEngine.js`).** `askLive` posts `{ agentId, battleId, message, leagueAsk: true }` (`:87-90`) and reads **only** `data.agentMessage` and `data.remaining` (`:95-100`); `applyAnswer` keeps `{ q, text, error }` (`arenaEngineCore.js:113-122`); `setRemaining` ignores non-finite values (`:126-128`); `fetchRemaining` GETs `/api/agent/chat-budget` (`:108-116`; response `{ remaining, dayN }`, `chat-budget.js:66`). The UI is `AgentDock` (`CommandDock.jsx:232-233`): the fixed `ask` chips (`buildAskChips`) tap `askLive(qa.q)` — **the chat route** (`:249-252`); the counter "N left today" (`:282-286`); the `pills` block is data-driven and lives inside the scroll well by the PINNED-FOOTER INVARIANT (`:290-296` — nothing data-sized may move into the footer). Where a `Files:` chip would render: the `pills` block (growth there is designed for). Where `Filed:` would render: a new `line.kind` in the voice lane, code-rendered from the G4 response. `suggestedActions` never reach the arena (the server returns them at `chat.js:588`; the client drops them).

**Battle View (`src/components/Agent/AgentChat.jsx`).** `sendMessage` posts `{ agentId, battleId, message }` (`:876-883`); on success it drops the typing indicator and **ignores the body** (`:910-918`) — the agent bubble renders from the Firestore listener's exchange; budget counters are prop-driven from `chatBudgetUsed` / `reviewBudgetUsed` (`:916-918`); the composer is blocked at the cap client-side (`:845`). Chips: `message.suggestedActions` (from the exchange, last agent message only — `deriveChatMessages.js:66`) → `ActionButton` (`:355-360`) → `handleActionClick` → `sendMessage(actionText)` (`:930-932`) — **the chat route**. The directive card: `ExecutionCard` (`:348-354`; `:105-150`) renders `directive.text` (`:146`) from the **persisted exchange** (`deriveChatMessages.js:69-71`), and under the controller flag the D-51 receipt line `BATTLE_VIEW_COPY.receiptLine(receipt)` (`battleViewCopy.js:700-706`: `Filed {time}` `:448-451`, `Replaced {time}` `:467-470`, `Expired`) derived in the screen (`deriveReceipts.js:56-67`, passed at `AgentBattleScreen.jsx:1620`, `:1798`, `:2493`). `directiveStatusLine` / `directiveStatus` / `directiveFallback`: **no consumer in `src/`** (grep, zero hits) — VERIFIED.

**The pane's eyebrow.** `tapeKindEyebrow` returns `Bench note` for `potential_entry` and **`null` for `potential_exit`** (`battleViewCopy.js:352-370` — "a word for it has to be ruled before it reaches the screen"); the direction is read from `anticipationContext.direction` (`deriveChatMessages.js:90`). "Holding note" is **NOT FOUND** at HEAD (matches the discovery's discrepancy 3); G3's second eyebrow is a new ruled string.

**Meaning.** For a *typed* directive the Battle View already shows a code-owned receipt from the persisted exchange, after the write, with the word `Filed` (D-51). Spec §6.3's `Filed: {directive.text}` would be a second "Filed" string beside it; BUILD_RULES §9 says one source. G5 should route a chip filing through the same path — the audit exchange → `deriveReceipts` → `receiptLine` — which works by construction **only if the audit exchange carries `directiveThreadId`** (top-level or `directive.directiveThreadId`, the two keys `threadIdOf` reads at `deriveReceipts.js:38-42`); the spec's `directive: { id, text, threadId }` would not be seen (§4 discrepancy 6). The arena has no receipt path at all and gets its first one here.

### Item 6 — The shadow stream · FOUND; the `conversations` record carries neither the prompt nor a hash

**The logger (`api/_utils/shadowLogger.js`).** `appendToStream` (`:44-69`) writes **one JSONL line per record** to `shadow/{stream}/{YYYY-MM-DD}/{Date.now()}_{rand6}.jsonl` (`:50-52`) in bucket `fantasytrades` (`:18`), project `macro-nuance-474602-f5` (`:33`), credentials from `process.env.GCS_CREDENTIALS` parsed as JSON (`:25-35`). The record is `{ ...record, _stream, _loggedAt }` (`:54-58`). It resolves to a boolean and never throws (`:6-14`, `:64-67`). **There is no size rule or truncation in the logger.** `logConversation` = stream `conversations` (`:71`).

**What `chat.js` logs.** Three sites, each stamping `gemmaLatencyMs` (measured `:460-472`): the parse-failure record (`:490-511`, with a 2000-char `rawGemmaContent`), the success record (`:610-630`), the handler-failure record (`:762-783`). The success record's fields: `userId, agentId, battleId, archetype, gameMode, exchangeNumber, userMessage, agentMessage, scratchpad, directive, suggestedActions, elicitationTarget, anchorContext, hasDirective, lesson, forgeSuggestion, tokenUsage: null, mode, gemmaLatencyMs`. **No `systemPrompt`, no hash, no `conversationHistory`.** By contrast the three proactive streams log the **full** `systemPrompt` on success and a 4000-char slice on failure: `first_message` (`decide.js:1665-1681`, fenced, cited), `trade_narration` (`voiceLayerTradeNarration.js:241-268`, `:274-289`), `anticipation` (`voiceLayerAnticipation.js:228-254`, `:260-276`).

**The reader template (`api/scripts/sample-voice-layer-terms.js`).** Same env/project/bucket (`:30-31`, `:49-60`); `dateKeyForOffset` walks UTC date keys (`:62-66`); `listStreamFiles` by prefix `shadow/{stream}/{date}/` (`:68-71`); `downloadJsonl` (`:73-82`); `extractResponseText` tolerates the three record shapes (`:88-108`); `STREAMS` reads `first_message` and `trade_narration` only (`:32`); run with `node --env-file=.env.local` (`:16-23`); exit 0 always (`:25`).

**Meaning for G6.** The shadow record must **add** `systemPromptOld`, `systemPromptNew` and the `conversationHistory` (full text — a ~31 KB prompt twice is ~60 KB per JSONL object; GCS is not Firestore and the logger imposes no rule), plus the mode; the harness reads `shadow/conversations/` with the template's list-and-download pattern; `gemmaLatencyMs` is on every record since `0c16191b` (Sep 3) for the p50/p95 reader. Two cautions: the write is fire-and-forget (`:630`; permitted — BUILD_RULES §5 binds catalog events only) so a lost record silently thins the harness sample; and the record already carries `userId` and `userMessage`, so adding the prompt adds partner-profile prose to the same bucket under the same policy — note only.

### Item 7 — The cache brief shape and the fundamentals render site · FOUND

**The brief (`api/cron/voice-layer-cache.js`).** Portfolio brief object `:200-231` (`symbol, tier, price, changePercent, technicalScore, technicalRank, rsPercentile, trendSummary, momentumSummary, supportLevel: null, resistanceLevel: null, thresholdNote, atrPercent, sector, sectorTechnicalTotal, nearestSupport, nearestResistance, distanceToSupportPct, distanceToResistancePct, distTo52wkHigh, nr7Flag, macdFreshBullishCross, macdFreshBearishCross, divergence, lastCandlePattern`), then `existingBadges` (`:236`), `thresholdProximity` (`:262-272`), `intraday` (`:286`). Bench brief `:401-437`. `rankingsMap` is built at `:749-752` from `indexIntelligence/stockRankings.stocks[]` (`:741`); `ranking = rankingsMap[symbol]` at `:121` (portfolio) and `:320` (bench). **After the ATR fix:** the brief object moves to `:210`, the bench brief to `:422`, `rankingsMap` to `:775`, and the `atrPercent` line is rewritten (`:228`, `:439`).

**`fundamentals` on the entry the cache already holds.** Written by `api/cron/compute-index-intelligence.js:1202` (`...(fundamentalsMirror ? { fundamentals: fundamentalsMirror } : {})`) from `buildFundamentalsMirror` (`:536-`) under `FUNDAMENTAL_MIRROR_ENABLED = true` (`featureFlags.js:1549`). Fields (`:500-528` docstring, `:544-564` code): `trailingPE { value, sectorMedian }`, `priceBookMRQ`, `revenueGrowthPct` (a percent — ×100 at `:553-555`), `marketCapClass`, `earningsRevisions30d` (`:559-561`), `beatRate` (computed-only, `:562-564`), `surpriseMagPercentile`, `computedAt` (epoch ms — the vintage, `:525-528`). **Null-honest by rule:** a missing metric is an omitted key, never null or a default (`:530-534`); with nothing available the whole `fundamentals` key is omitted.

**The existing renderer (decider side; the DR-13 split module `api/_utils/fundamentalsRender.js`, non-fenced, registered).** `fundamentalsParts` (`:96-111`) renders `PE=18.2 (sect med 22.1) | P/B=… | rev growth=+12.0% | mcap=large | EPS rev 30d=+47.2% | beat rate=…% | surprise pctl=…`; the block marks an entry `as of MM-DD` only when older than the block's newest vintage (`:151-176`) and states the block-level date (`:189`); a name with a ranking but no metrics renders `no fundamentals reported` (`:169`). Spec §3.5's example line maps to `earningsRevisions30d`, `revenueGrowthPct`, `trailingPE.value` / `.sectorMedian`, and its "as of Sep 5" to `computedAt`.

**The render site.** The battle fall-through assembles blocks at `voiceLayerPrompt.js:2967-3004`: the briefs are pushed `:2982-2986` and `DATA_CONFIDENCE_RULE` (static, `:1822-1823`) at `:2987`. Per-name lines are composed in `buildPortfolioBriefsBlock` (`:1674-1722` — header / trend / momentum / levels / signals / intraday / `BaggerBomb:` / `Threshold:` / `Badges earned:`) and `buildBenchBriefsBlock` (`:1724-1752`). A one-line-per-name fundamentals rendering is either a line inside each entry or one block pushed between `:2986` and `:2987`; both inside the flag branch. The headings the CURRENT CONTEXT heading would replace: `YOUR PORTFOLIO` (`:1721`), `YOUR BENCH (available for swap):` (`:1751`), `OPPORTUNITIES ON YOUR WATCHLIST:` (`:1761`), `MARKET RIGHT NOW:` (`:1815`), `NEWSROOM WIRE (…)` (`:1782`, registered prose). The doc's `dataFreshness` (`:808-813`: `prices: 'rest_15min'`, technicals / rankings / marketContext `'daily'`) has no `fundamentals` key — the vintage comes from `computedAt`, or the writer adds one.

**Meaning.** Zero added reads, as the spec says; the field names, the null rule and the vintage already exist and have a renderer to mirror. **Every function G2 would edit here is a function the ATR fix edits** (`buildHeaderLine` `:1089-1148`, hunks at `:1040` and `:1132`; the two brief builders in the cache) — the seed's "fix first" prerequisite is a textual-conflict fact, not a courtesy. **After the fix all four brief-block functions sit +12 lines lower** (`buildPortfolioBriefsBlock` → `:1686`, `buildBenchBriefsBlock` → `:1736`, `DATA_CONFIDENCE_RULE` → `:1834`, the identity frame `:2912-2916` → `:2924-2928`, the block list `:2967-3004` → `:2979-3016`).

### Item 8 — The tri-state flag precedent and the uid-allowlist precedent · FOUND; two constraints

**The tri-state (`src/config/featureFlags.js`).** `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`:770`; docstring `:741-769`: `'off' | 'observe' | 'enforce'`, "walk … founder-executed — never in a build PR", the rollback rule); `SECTOR_CAP_MODE = 'observe'` (`:822`; docstring `:772-821` — "House tri-state (the ARCHETYPE_INTEGRITY_MODE / RULE_COMPAT_MODE shape, per ruling D1)", each state's byte-identical guarantee spelled out; the 'true' out-of-vocabulary lesson `:809-813`); `RULE_COMPAT_MODE` (`:849`). `chat.js` imports the binding (`:18`) and reads it inside the handler (`:328`, `:533`); `chat.test.js` flips it per test through a live getter **with an `importOriginal` spread** (`:117-121`) — the safe mock shape.

**The call-time accessor.** `isCharacterPaneOn()` (`:2074-2076`) and its docstring's rule (`:2060-2062`): *"Read it at RENDER scope through isCharacterPaneOn() below, never as a module-scope const (the Pass 1 hazard: 15 of 56 featureFlags vi.mock sites use a bare factory with no importOriginal spread)."* Also `isBattleViewControllerOn()` (`:2027-2029`). `getVoiceGroundingMode(uid)` follows this shape exactly.

**The uid allowlist — an env var, not a constant.** `MANDATE_FOUNDER_UIDS` is read at call time by `founderAllowlist()` (`api/mandate/create.js:29-34`), gated by `isFounderAuthorized(uid, flagEnabled, allowlist)` — both required (`:41-43`); the file's own rule: *"never a hardcoded uid — the uid stays out of the repo, and an unset/empty allowlist fails closed"* (`:18-20`). The flag half is `MANDATE_FOUNDER_CREATE_ENABLED` (`featureFlags.js:1809-1819`). **The seed's `VOICE_GROUNDING_CANARY_UIDS = []`, pinned in `featureFlags.js`, would put the founder's uid in the repo on the canary step** (§4 discrepancy 3). The precedent's shape: the MODE is the constant (one-line PR per step); the uids are `process.env.VOICE_GROUNDING_CANARY_UIDS`, parsed inside `getVoiceGroundingMode(uid)`, empty = nobody.

**`DARK_BY_DESIGN` cannot hold a string flag.** The pin guard builds its flag map only from `export const <NAME>_ENABLED = true|false` (`flagPinGuard.test.js:151`) and matches pins with `PIN_RE` = `expect(FLAG).toBe(true|false)` (`:181`); the integrity test (`:298-310`) fails any `DARK_BY_DESIGN` key that is not in that map or not `false` (`:305-306`). A `VOICE_GROUNDING_MODE = 'off'` is invisible to the guard, so listing it fails CI. The house precedent for a string enum is `MANDATE_TRANSPORT_MODE` (`featureFlags.js:1821-1827`: *"A STRING enum, not a boolean gate, so the flag-pin guard … does not track it — it is pinned directly in mandateFlags.test.js"*; pin at `mandateFlags.test.js:44`). **Resolution for G1:** pin `'off'` directly in `voiceGroundingFlags.test.js`, carry the `// Pinned by:` pointer, and keep it out of `DARK_BY_DESIGN` — or add a boolean companion if the founder wants the loud tripwire. Each walk step reconciles its own pin in the same one-line PR (BUILD_RULES §2). §4 discrepancy 4.

**Meaning.** The flag's shape has a house precedent; its dark registration and its uid list do not work as the seed literally states, and both have a precedent that does.

### Item 9 — The fence · FOUND; every file the spec touches is non-fenced

Spec §2's change list against BUILD_RULES §1 (re-read in this session): `voiceLayerPrompt.js`, `chat.js`, `file-directive.js` (new), `voiceLayerAnticipation.js`, `voiceLayerTradeNarration.js`, `openerTemplateFloor.js`, `voice-layer-cache.js`, `agent-evaluate.js`, `AgentChat.jsx`, `useArenaEngine.js`, `featureFlags.js`, tests — **none on §1.** Matches the discovery's G17 table. Read-only by rule: `agentEvalPromptAssembly.js` (fenced), `agentEvalToolSchema.js` (not on §1; the decider's output contract — fence-adjacent; nothing here changes it), `decide.js` (fenced — the item-4 opener writer).

**Fence-adjacent notes for the build:**
1. **`agent-evaluate.js`** hosts the six `executeSwapServer` call sites with the reserve/confirm ledger (BUILD_RULES §7). G3's change is confined to the anticipation queue and dispatch (`:2044-2058`, `:2852-2887`) and must not touch the swap path.
2. **`voiceLayerPrompt.js` is in `PROMPT_CONTRIBUTING_MODULES`** (`api/_utils/__fixtures__/promptHonestyRegistry.js:51`): its **source** is swept for `FORBIDDEN_SIGNALS` (`:23-31` — `5-min RSI`, `5-minute MACD`, VWAP sigma-band, `BB width 5th pctl`, `range position`, `within N% of 52W high`, `5-min price breaks`) by `agentEvalPromptAssembly.honesty.test.js`. New prompt prose in G2 must stay clear of those seven regexes. The rationale bytes rendered at runtime are not in the source, so YOUR RECORD cannot trip it; a test fixture is not swept either.
3. **The §2.3 import-boundary ratchet** (BUILD_RULES §1): `file-directive.js` must not become a new direct importer of `agentArchetypeConfig.js` / `archetypeScoring.js`. What it needs is non-fenced and not a legacy table: `getAllowlist` / `isValidAdjustmentId` / `getCanonicalText` (`src/data/archetypeAdjustments.js:214-227`, no fallback) and `getEffectiveArchetype` (`directiveIdentity.js:50-52`). **The spec's "`directiveGate.js:59-95`, reused" cannot be imported as written:** `readProposal` (`:59`) and `evaluate` (`:70`) are module-private. Either export `evaluate` (a small edit in a file the spec's §2 list does not name) or call the three archetypeAdjustments helpers directly (`:77-80` is three lines). Recommend the latter. §4 discrepancy 5.
4. **What the decider sees.** `battle.directive` reaches the decider through the fenced assembler's controls block (`agentEvalPromptAssembly.js:1228-1242` per the discovery B3, via `controlPromptRenderer.resolveControls` — the same reader the narration prompt uses at `voiceLayerPrompt.js:3349-3353`). A chip-filed directive is byte-shaped like a gate-minted one **only if it carries `adjustmentId` and `canonicalTextVersion`** (`chat.js:650-653`, `directiveGate.js:82-88`) — the lean/opposition logic binds to them. Copy the enforce-path shape, never the legacy one.
5. **The `createAgentBattle` doc shape is fenced as a concept.** `file-directive` writes existing keys only (`directive`, `chatExchanges`, `chatBudgetUsed`); no new battle-doc key (the reason `agentChatBudget` lives in its own collection, `agentChatBudget.js:7-12`). The audit exchange is a new element of an existing array — the D-52 / D-79 precedent for entry-shape additions.

**Meaning.** No STOP. The decider sees the same kind of object it sees today; the fence is untouched; three seams need the build's care and one spec citation points at private functions.

---

## 3. Hazards — new, beyond the discovery's fifteen (which stand verbatim)

16. **Two budgets, one route body.** The League ask charges `agentChatBudget/{groupId}_{uid}_{dayN}` transactionally after success (`chat.js:732-745`); the Battle View increments `chatBudgetUsed` on the battle doc (`:692`). Spec §6.1's body has no surface marker, so the route cannot know which to charge; a League filing needs a cross-document transaction (battle doc + budget doc — Firestore allows it) and `resolveBudgetDay`'s group read (`agentChatBudget.js:59-72`) before or inside it. Founder call (§4 discrepancy 11).
17. **The deploy-time opener is fenced** (`decide.js:1629-1640`) — the marker cannot land there (§2 item 4).
18. **`threadId` vs `directiveThreadId`.** The shipped shape and the client's receipt reader use `directiveThreadId` (`chat.js:649`, `:661`; `deriveReceipts.js:38-42`); the spec's audit exchange says `threadId`. Use the shipped name or the receipt never renders.
19. **A second "Filed".** `Filed {time}` already exists as the D-51 receipt (`battleViewCopy.js:448-451`, rendered `AgentChat.jsx:148-150`); a parallel `Filed: {text}` from the HTTP body is the two-source drift BUILD_RULES §9 forbids. Render the chip receipt through the same exchange → `deriveReceipts` → `receiptLine` path; the arena gets its first receipt path from the same object.
20. **A string tri-state is invisible to `flagPinGuard`** and fails `DARK_BY_DESIGN`'s integrity test (`flagPinGuard.test.js:151`, `:181`, `:305`). Pin it directly (§2 item 8).
21. **Canary uids belong in the environment**, not the repo (`api/mandate/create.js:18-20`).
22. **`signalSummary` is a description, not a validator**; run the clause through the reply lint in code; key the "no threshold" test on the field (§2 item 1).
23. **The chat turn has no `messageType`** (`chat.js:640-682`); §3.4's tags need a code default.
24. **Cherry-pick or rebase onto `40008de8` before G2 touches the brief renderers.** The fix edits `buildHeaderLine` (`voiceLayerPrompt.js:1040-1146`) and both brief builders (`voice-layer-cache.js:186-230`, `:328-420`), and `voiceLayerPrompt.test.js` (+52 lines) — the same file G1's off-state goldens live in. Note that `chat.test.js:75-77` stubs `buildVoiceLayerPrompt` to a string, so the goldens must sit in the prompt module's own suite.
25. **Outage entries in YOUR RECORD.** `evaluations[]` carries system placeholders as `rationale` on a failed tick (`agent-evaluate.js:2637-2640`: "Haiku call failed — defaulting to HOLD"; `haikuError` `:2667`) and a system-authored rationale on the guardrail path (`:2121`). The block must render the D-65 / D-69 absence lines (`battleViewCopy.js:257`, `:263`, `:270` — "No decision recorded at this check[ · the evaluation timed out | · the evaluation did not complete]", the C1 rule `selectWhyState.js:257-282`) and name the author (D-72's `The agent's own words` / `The system's reason`, `battleViewCopy.js:399-400`) — or the character quotes the system as itself.
26. **Reuse the client's helpers; do not copy them.** `deskCopy.js` (`etTime`, `etSlotTime`, `SLOT_MS` — D-83) has **zero imports** → Node-clean, importable from `api/` under BUILD_RULES §4 with a dependency-surface guard (`chat.js:10`, `:18` already import `src/`). `battleViewCopy.js` (`wokenByType` — D-81's nine strings `:146-156`; the absence labels) pulls `deriveTurnLine` → `baggerbombAdapter` → `commandCenterLiveBattles` → `arenaStateMap` → `constants/leagueTournament`; no React seen in the chain (**ASSUMED Node-clean; not executed** — the guard test proves it). Copying the nine strings or the slot floor into `api/` is the drift class §4 forbids.
27. **Dedupe needs the ET day and an in-process pass.** The anticipation exchange has only `timestamp`; the day key must come from `formatEtDate` (`tournamentTime.js`, imported at `chat.js:22`), never a UTC slice (BUILD_RULES §6). `generateAnticipation` already re-reads the battle (`voiceLayerAnticipation.js:76-90`), so existing exchanges are in hand — but the write is `arrayUnion`, not a transaction (`:218-220`), and one tick can queue two candidates for the same name (`agent-evaluate.js:2053-2057`, `Promise.allSettled` `:2855-2865`): dedupe the queue in-process before the per-candidate read-then-write.
28. **The `_scratchpad` and `suggestedActions` fields on proactive exchanges.** The code-composed note has no scratchpad and must write `suggestedActions: null` (the shipped anticipation shape `:191-200`); the auto-debrief writer persists model chips (`agent-batch-review.js:388`) — under the flag those chips are still the chat route's (§4 says chips are minted by id in `OUTPUT_FORMAT`; the review prompt's `WORKSHOP`/`REVIEW` formats are separate constants, `voiceLayerPrompt.js:237`, `:394`) — decide whether review-mode chips are in scope.

---

## 4. Discrepancies — the seed / spec against the repo

1. **The discovery is not on `main`.** `docs/audits/20260907_VOICE_GROUNDING_PHASE0_DISCOVERY.md` exists only at `dcd3a7a2` on `origin/claude/voice-grounding-phase0-discovery-tn3lsa` (parent `d1233488`). The seed and spec cite it as a repo path. Not committed here to avoid a duplicate on merge; the founder merges that one-file branch, or Session 2 is told to carry it.
2. **Sol's reviews are not attached and not in any ref.** The seed's first-commit instruction ("with `20260907_SOL_REVIEW_VOICE_GROUNDING.md` — both passes — under `docs/audits/`") is half-met: the spec is committed; the reviews are NOT FOUND.
3. **`MANDATE_FOUNDER_UIDS` is an env var**, read at call time and kept out of the repo by rule (`api/mandate/create.js:18-34`); the seed's `VOICE_GROUNDING_CANARY_UIDS = []` pinned constant contradicts its own precedent.
4. **`DARK_BY_DESIGN` cannot register a string flag** (`flagPinGuard.test.js:151`, `:181`, `:298-310`); the house precedent is a direct pin (`MANDATE_TRANSPORT_MODE`, `featureFlags.js:1821-1828`, `mandateFlags.test.js:44`).
5. **`directiveGate.js:59-95` is not exported** (`readProposal` `:59`, `evaluate` `:70` are module-private); "reused" means an export or a direct call to `archetypeAdjustments.js:214-227`.
6. **The audit exchange's `directive: { id, text, threadId }`** names the thread `threadId`; the shipped write and the client reader use `directiveThreadId` (`chat.js:649`, `:661`, `:698`; `deriveReceipts.js:38-42`).
7. **`Filed: {directive.text}` duplicates the shipped `Filed {time}` receipt** (`battleViewCopy.js:448-451`; `AgentChat.jsx:105-150`) on the Battle View; §6.3's "code-rendered from the exchange after the write" is what the ExecutionCard already does (`AgentChat.jsx:146`).
8. **The deploy-time generated opener is written by fenced `decide.js:1629-1640`**; spec §3.4's "generated openers … carry it at the top level" is reachable only for the lazy path (`ensure-opener.js:88-101`).
9. **A fifth agent-initiated writer** — the post-market `auto_debrief` (`agent-batch-review.js:382-398`) — is absent from seed item 4's list.
10. **`anticipationContext` per spec §5 (`{ symbol, direction, evaluationId, slot }`) drops the shipped `threshold`** (`voiceLayerAnticipation.js:205`) and adds `slot`. Nothing at HEAD reads `threshold` off the exchange (the pane reads `direction` only, `deriveChatMessages.js:90`); recorded, no objection.
11. **The route body has no surface marker while two budget stores exist** (`chat.js:214`, `:692`, `:732-745`); §6.4's "one message" is a different counter on each surface.
12. **The count is 28, not 27.** The discovery's C8 numbers 27 entries and carries an unnumbered 28th (`:3287`); two first-message lines (`:3041`, `:3045`) are candidates for 29–30 (§2 item 3).
13. **Seed item 3 expected line shifts from the ATR fix at HEAD.** There are none at HEAD (the fix is unmerged); the shifts are computed for Session 2 (§2 item 3, item 7).
14. **The seed's `ensure-opener.js:88-101` comment cites `decide.js:1313-1324`** for the deploy-time shape; at HEAD that shape is at `decide.js:1629-1640` (a stale cross-reference in a comment; §5 item 3).
15. **Spec §6.1's "the agent belongs to this battle"** is a new check — the shipped chat route never compares `battle.agentId` with the body's `agentId` (`chat.js:209`, `:265`; §5 item 4).

**Verified as cited (no discrepancy):** spec §2's `agentEvalPromptAssembly.js:485-511`, `agentEvalToolSchema.js:180`, `:38-47`, `agentEvalPromptAssembly.js:522-533`, `:192`, `:1719-1726` (the `Composite:` return at `:1725`); spec §3.1's `voiceLayerPrompt.js:2912-2916`; spec §5's `agent-evaluate.js:2053-2057`; seed item 6's `shadowLogger.js:52`, `:71` and `chat.js:471`, `:510`, `:629`, `:782`; seed item 5's `useArenaEngine.js:87-100`, `AgentChat.jsx:355-360`, `:910-932`; seed item 4's four anchors; seed item 7's `voice-layer-cache.js:200-231`, `:749-752`; the ledger rows D-18 (`COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md:36`), D-31 (`:431`), D-55 (`:455`), D-69 (`:469`), D-72 (`:472`), D-76 (`:476`), D-79 (`:479`), D-81 (`:481`), D-83 (`:483`), D-86 → D-98 (`:486-498`). The seed's D-99 → D-104 append after `:498` in that file, with the status-line amendment the D-58 pattern prescribes; not written in this session.

---

## 5. Found outside the task — for separate tasking (BUILD_RULES §3)

1. **A stale comment in `chat.js:409-410`** says `__REVIEW_START__` survives the history filter as a persisted `userMessage`; no current writer persists it (`agent-batch-review.js:356` sends it to Gemma; the exchange at `:383` has `userMessage: null`). Legacy docs may still carry it (`deriveChatMessages.js:48`, `FilmRoomChat.jsx:157`).
2. **The per-battle chat budget can overspend by one.** The cap check (`chat.js:278`) is a plain read before the model call and the charge is `FieldValue.increment(1)` (`:692`); two concurrent turns at 9/10 both pass. The League path fixed this for its own store (`agentChatBudget.js:91-121`); the battle path did not.
3. **`ensure-opener.js:87` cites `decide.js:1313-1324`** for the exchange shape; the shape is at `decide.js:1629-1640` at HEAD. Comment only.
4. **`chat.js` does not bind the body's `agentId` to the battle.** Ownership of the battle is checked (`:239`), but the agent doc is read from the client-supplied id (`:265`) and its `partnerProfile` / `convictions` enter the prompt (`voiceLayerPrompt.js:2919-2922`). A caller who owns a battle can build the character's prompt from another agent's doc. Report only; the `file-directive` route's `battle.agentId === agentId` check should not be copied *from* chat.js, because chat.js has none.
5. **`atrPercent` mislabel** (the discovery's §5.1) — its fix is `40008de8`, unmerged (§0).

---

## 6. STOP

Phase 0 complete. Nothing implemented; no prompt text changed; no fenced file edited; this branch carries the spec (commit 1) and this report (commit 2), both docs-only. A byte-identical copy of this report was written first to the session scratchpad and offered for download (BUILD_RULES §3). The build starts next session, after the founder's read of §4's six calls and once `40008de8` is on `main` or cherry-picked before G1.

*The two targeted reads came back the way the spec hoped: the signal field is descriptive, and the directive write is one object the route can copy. The rest is naming — a thread id, a `Filed` word, a uid list, a dark-flag registry — and one fenced opener nobody can stamp.*
