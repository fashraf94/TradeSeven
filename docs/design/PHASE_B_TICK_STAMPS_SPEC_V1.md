# Phase B — The Tick Stamps: Spec V1 (for Sol's short pass)

**Date:** September 8, 2026
**Status:** Spec V1, pre-build. Founder rulings 1–9 confirmed Sep 8. **Sol's pass is short and targets two things (§7).** Build: B1 with Fable, B2 after; review Fable.
**Basis:** `docs/audits/20260908_PHASE_B_TICK_STAMPS_PHASE0_DISCOVERY.md` (every `file:line` below) · D-52, D-77, D-79, D-83, D-92, D-101 → D-109.
**Suggested commit location:** `docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md`

---

## 0. The one paragraph
Every decided check leaves three more facts on its own record, written by the cron that already writes the entry, after the decision: whether the player's directive was in front of the decider at that check (**Heard**), what the decider saw for each held piece (**the evidence**), and which names it flagged (**the candidates**). None changes a decision. The pane, the tape, Why?, Bench and the narrator read the same entry. And the typed directive gets the transaction the chip route already has. **The claim Heard supports is exactly one: the decider's prompt carried this thread at this check. Never that it acted on it.**

---

## 1. B1 — the stamps

### 1.1 The stamp site and its gate
In `processAgentBattle`, at the entry composition (`agent-evaluate.js:2629-2671`), after the Haiku swap (`:2312`) and the risk swaps (`:1613`), riding the existing final update (`:2805`). Keys on the entry only — no new top-level battle key (V2 hazard 9). **All three stamps under one server flag, `TICK_STAMPS_ENABLED = false`** (pinned; `DARK_BY_DESIGN`; read at call time). Flag-off: the entry is byte-identical to today (a golden on the composed entry).

### 1.2 Heard (D-52)
- **Gate:** `haikuAttempted === true` (`:1980`). A `budget_skipped` tick writes an entry without building the prompt; Heard there would be false, so it is absent.
- **Resolution:** the cron calls the same pure `resolveControls` (`controlPromptRenderer.js:104-202`, already imported at `:69`) with **the argument list at `agentEvalPromptAssembly.js:1229-1238`, byte for byte**, on the in-memory `battle` object at the stamp site — never a re-read (A2: nothing re-reads between `:2002` and `:2629`; on a risk-swap tick the object is fresher, and still the rendered one). A test pins the two argument lists together (hazard 4).
- **Shape:** `heard: { directiveThreadId, suppressed: null | 'malformed' | 'mode_not_enforce' | 'epoch_killed' }` — 67 bytes. When no directive was active (`isDirectiveActive` false) the key is absent. `suppressed` names the case where a directive existed but the assembler withheld it: those ticks are **not Heard** and the client must not say so.
- **Never** from the model's echo (`ignoredDirectiveIds`, `directiveThreadId` on the entry at `:2647-2649` are self-report — the basis of Acted, never Heard).

### 1.3 The evidence (B5, D-75)
- **Composed by code at `:2629` from objects already in scope** — `prices`, `assetScores`, `momentumData.{vwap,rankings,techScoresMap}`, `stockRegimes`, `riskStatus` — no recomputation, no model.
- **Shape, per held position (seven):** `evidence[sym] = { px, chg, atrX, vwapDev, bbPct, nr7, rsPct, regime, risk }` (~124 bytes; `risk` carries `reason` only when non-HOLD) plus one `vintages = { quote:'tick', vwap:'tick', tech:'daily', fund:'weekly', fundAsOf, rankingsAt }` per entry. **~0.9 KB per entry; ~23 KB per day; a 3-day battle stays near 25 % of the document limit.**
- **Cut by ruling:** bench evidence; story ids (accepted loss); `epsRev30d` / `sectorRs` (CURRENT CONTEXT carries them at their own vintage). **Never cut** `risk`, `atrX`, `vwapDev` — the three the cache cannot reproduce. "ARCH score" does not exist in the eval and is never stamped; the cache's `thresholdProximity` is not the decider's and is never stamped as such (grounding hazard 8).
- **Author:** the engine. Every render labels it *what the decider saw at the {slot} check*, distinct from the narrator's CURRENT CONTEXT (spec V1.3 §3.3).

### 1.4 The candidates (D-79)
- From the queue at `:2055-2061` (the model's raw tool items): `candidates: [{ symbol, direction, signalSummary, threshold, signalSource? }]`, `rationale` cut; stamped beside `hypothesis` (`:2644`) — persisting the decider's output, the same act. ~1 KB per day.
- **Render rule is D-103** (`voiceLayerAnticipation.js:118-120`): `threshold` is persisted and never rendered in the narrator's voice; `signalSummary` renders only through the lint-checked composer. Bench renders **the fact of the flag** only.

### 1.5 The readers (each gains a field from the entry it already holds)
- **Receipts:** `deriveHeard(evaluations) → { [threadId]: { at: slot } }` (last entry wins), merged into the receipt object at `AgentBattleScreen.jsx:1384`; the tape's `dispositionAt` (`buildTape.js:246-255`) unchanged (D-77). `ExecutionCard` and *This turn* show a second line `Heard at the {slot} check` beneath `Filed {time}` **only when an entry carries `heard` for that thread and `suppressed` is null**. `heardLabel(slot)` in `decisionRecord.js` beside `filedLabel`; the slot via the shared D-83 formatter, never the exact minute. `battleViewCopy.js:16-19`'s "no Heard" rule and the test at `AgentChat.receipts.render.test.jsx:83-88` are amended in the same commit.
- **Why? V2 "the piece's lines"** (`selectWhyState` → `WhyPanel`): the piece's evidence from the latest decided entry, labelled `What the check saw`, vintage-marked; absent when the entry carries no `evidence`.
- **Bench** (`selectBench.js`): a second structured input — `candidates` filtered to `potential_entry` and the roster; a flagged name moves to the "Named at the {t} check" group with a flag chip; no `signalSummary`. The sentence pass stays.
- **The narrator's YOUR RECORD** (`voiceLayerGrounding.js:188-244`, under `'on'`): each entry gains one evidence line per held position (the nine fields, compact) labelled as what the decider saw; the CURRENT DIRECTIVE line gains `· heard at the {slot} check` when the latest entry's `heard` names that thread; CURRENT CONTEXT unchanged. Token cost measured in the build (target ≤ 300 for three entries; the one-entry fallback constant already exists).
- **Presence-gated, not flag-gated, on the client:** no stamp, no line — byte-identical until the server flag flips. The flip is the smoke (crons do not run on preview).
- **The League reader** (`Flat6BattleView`) and the arena lane: unchanged this phase; the arena has no doc read for Heard — recorded absence.

### 1.6 The fenced decider is inert to the new keys
`formatRecentEvals` reads a fixed whitelist (`agentEvalPromptAssembly.js:1389-1402`); `agentTriggerGate.js:20-30` reads `evaluations.length` only. A test pins that whitelist so a future key can never leak into the decider's prompt through the record.

---

## 2. B2 — the typed-directive transaction (P-1a/b/c)
- **The module:** extract `file-directive.js:196-299` into a sibling `api/_utils/directiveTransaction.js`; both routes import it; `directiveFiling.js` stays zero-import. The function owns the in-transaction re-reads (`battle.directive.directiveThreadId`, `battle.status`, `battle[budgetField]`, the League `agentChatBudget` doc via `resolveBudgetDay`), the mint, the slot/record build, and the writes; it takes the composed exchange as an argument (the chat turn's has a user half, the reply, the scratchpad, the gate outcome; the chip's does not).
- **The chat path** (`chat.js:996-1008`) passes the gate's minted object, `expectedDirectiveThreadId` = the slot as read at the turn's start (`:950-951`), `budgetField` / `isLeagueAsk`, `mode`. **Conflict semantics (ruling 4):** latest-wins files anyway; the outcome records the *actual* replaced thread from the in-transaction read.
- **The budget (ruling 5):** the pre-call check stays (`:496-510`) so a player never waits twenty seconds for a 429; the charge moves into the transaction; a race that produces an eleventh **commits** and stamps `overBudget: true` on the exchange — never fail a turn after the model answered. The League charge moves inside the same transaction (cross-document; D-105).
- **The attestation (ruling 7):** the handler knows three outcomes — threw before the transaction (nothing persisted, nothing charged), rejected inside it (same), committed then threw (persisted and charged); the error body carries `persisted` / `charged`; `CHAT_NOT_SENT_CLAUSE` in `decisionRecord.js` appends to `chatSendFailed` only when `persisted === false`; the arena reads the same field and drops its "not charged" claim (`useArenaEngine.js:95-97`).
- **Protected stores:** rows beside `compositionProtectedStoresAllowlist.json:163`. The inert abort signal is not this PR.

---

## 3. Tests (import what they guard; the survivor proof first)
Flag-off entry golden · Heard: absent without a directive, absent on `budget_skipped`, `suppressed` on each of the three reasons, the argument-list pin against the assembler, the in-memory thread when a filing lands mid-tick (a fixture that mutates the doc, not the object) · evidence: shape and bytes (a size row per entry ≤ 1.1 KB), the nine fields from their sources, `risk.reason` only when non-HOLD, no bench, no story ids · candidates: four fields plus tag, `rationale` cut, `threshold` never in any rendered string (the field test, not the substring) · the decider's whitelist pin · receipts: `Heard` only with a stamp and `suppressed` null; the card's two lines; *This turn*; the narrator's line; Why?'s labelled lines; Bench's flag chip and group move · B2: the five outcomes, CAS records the actual replaced thread, the eleventh commits with `overBudget`, League charge in-transaction, `persisted`/`charged` on each error path, both clients' strings · mutation checks throughout.

## 4. Flags and walk
`TICK_STAMPS_ENABLED` false at merge → the founder flips in its own PR after B1 merges → the first stamped check is the smoke: the card's second line, Why?'s evidence, Bench's chip, the narrator's line under `'on'`/canary. B2 ships unflagged as a fix to a failing path (the P-1 precedent), after its own review.

## 5. Not this phase
The Direct menu (placement ruled: the Chat section beside the `Files:` chips, not the header — recorded for its phase); bench evidence; the arena's Heard; the inert abort signal; the League reader's `lastScoredAt` join.

## 6. Ledger (append after D-109)
| # | Ruling |
|---|---|
| **D-110** | Heard: `{ directiveThreadId, suppressed }` stamped by the cron from the same `resolveControls` call as the assembler, on the in-memory object, gated on `haikuAttempted`; supports one claim — the thread was in the decider's prompt at that check; `suppressed` is not Heard. |
| **D-111** | The evidence stamp: nine fields per held position plus one vintages block, code-composed from the tick's own objects; bench, story ids and the weekly/daily duplicates cut; `risk`, `atrX`, `vwapDev` never cut; labelled as what the decider saw. |
| **D-112** | Candidates persisted on the entry (four fields plus tag); `threshold` persisted, never rendered in the narrator's voice (D-103); Bench renders the fact of the flag. |
| **D-113** | One server flag for the three stamps; clients render on presence; the flip is the smoke. |
| **D-114** | The typed directive shares the chip route's transaction: latest-wins with the actual replaced thread recorded; the pre-call check kept, the charge in-transaction, an eleventh commits with `overBudget`; the error body attests `persisted`/`charged`. |
| **D-115** | The Direct menu's home is the Chat section beside the `Files:` chips (amends D-53's header placement); not built in Phase B. |

---

## 7. For Sol — two targets
1. **The receipt ceiling's exact claim.** `Heard at the 12:45 check` = "this thread was in the decider's prompt at that check." Attack: does the word *Heard* claim more than that to a reader (attention, consideration)? Is `suppressed` handled honestly (a directive that existed but the assembler withheld — not Heard, and should the card say *why not*)? Is the mid-tick filing case (the stamp names the older thread) legible on the card?
2. **The evidence stamp under C1.** Engine-computed inputs the decider was shown, stamped after the decision, labelled *what the check saw*. Attack: is that decision-path output, or a new claim about the decider's mind? Does putting it in the narrator's YOUR RECORD beside the decider's words invite the model to reason *from* it as if it were its own evidence — and is the §3.1 frame enough?

*Three facts on every check's record, written by the hand that writes the record.*

---

## 8. V1.1 — errata (added Sep 9, after the B1 server build and Sol's rendering pass)

**The spec text above is V1 as written, byte-exact. It was committed before the
build and is deliberately NOT rewritten in place** — this block is the
correction of record, and where the two disagree, this block wins. Every item
traces to a finding in `docs/audits/20260909_PHASE_B_B1_SERVER_STAMPS_REVIEW.md`
or to Sol's pass (`docs/audits/20260909_SOL_REVIEW_PHASE_B_TICK_STAMPS_PASS.md`).
The ledger rows D-110 → D-115 carry the same amendments.

| § | V1 says | Correction | Why |
|---|---|---|---|
| §1.2 | Heard is "gated on `haikuAttempted === true`" | **Gated on the prompt having been BUILT and handed to the transport** (`promptBuilt`) | `haikuAttempted` is set BEFORE the prompt is built, so a builder throw would have stamped a prompt that never existed (review A-4 / B-1). |
| §1.2 | the Heard stamp is "67 bytes" | **47–74 bytes**, by thread-id length | Review C-4. |
| §1.3 | "**Shape, per held position (seven)**" listing NINE fields including `rsPct` | **EIGHT fields**: `px`, `chg`, `atrX`, `vwapDev`, `bbPct`, `nr7`, `regime`, `risk`. `rsPct` is not stamped | The prompt renders `rsPercentile` for BENCH names only (`buildBenchTechnicalBlock`); a held name's technical read reaches the decider as the `regime` word, which IS stamped (review A-2). The prose count "(seven)" was wrong against its own nine-item list; both are superseded by eight. |
| §1.3 | `chg` unspecified, discovery B8 read it as the quote's session change | **`chg` is the ACTIVE POSITIONS row's Gain% from ENTRY** | The label decided it: the stamp must be the number the decider's own row rendered (review A-1 / C-3). Sol M-3 pins the copy: every render says *since entry*. |
| §1.3 | `vintages` carries `tech: 'daily'` and `fund: 'weekly'` | **`techAt`** — the newest `updatedAt` across the held book's technical docs, an ISO INSTANT — and **`fundAsOf`**, a UTC calendar date | Those technical docs are rewritten hourly during RTH, so no cadence word fits (review A-3); `fundAsOf` is the FUNDAMENTALS block's own header date across held plus non-crypto bench, proved equal to the rendered header (A-6). Sol M-2 pins the copy: `techAt` is named as a stamp, never as freshness. |
| §1.4 | candidates are "stamped beside `hypothesis`" | **Trailing keys**, after `haikuError` | Review C-4. |
| §1.4 | (silent on a cap) | **The stamp is UNCAPPED; a first-five cap is a spec-level rule, built in B2** | The dispatch queue is equally uncapped and the fenced instruction expects 1–3 per day (review B-5). |
| §1.5 | "the nine fields, compact" in YOUR RECORD | **The eight**, with the risk carve-out | As §1.3. |
| §1.5 | Heard renders on the card; open question whether it says *why not* | **It does not.** A withheld directive gets the reasonless, system-owned `Not heard at this check` on the card, and NOTHING at all in the narrator's voice | Sol M-1, answering §7.1: the character never received the withheld directive, so a first-person explanation attributes a pre-prompt resolver event to it. The four reasons stay in telemetry. |
| §1.5 | the evidence is rendered under one "what the decider saw" heading | **`risk` is carved out of the blanket claim.** `HOLD` is silent there; a non-HOLD action renders; the stored `reason` CODE is never rendered as seen text | Sol B-1 (the blocker): on an all-HOLD tick the prompt renders no RISK STATUS block at all, and for a LOCK the prompt carried the `detail` sentence while the stamp keeps the compact code. |
| §1.3 | (silent) | **A null metric renders NOTHING** — never 0, never a placeholder — and there is no ninth slot, no `RS unavailable` and no completeness rule | Sol m-1. |
| §6 | — | **D-110 → D-115 appended to the ledger** with these amendments | `docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md`. |

**Two further items recorded, not corrections to this spec:**

- **The evidence and vintages share Heard's gate** (build decision; Reviewer A endorsed). The label is the claim — "what the decider saw" is false on a tick that never built a prompt — and the readers are presence-gated, so the alternative would be a different product claim needing its own label.
- **Discovery hazard 20 is moot** (review C-7, refuted by V2): `runShadowTickCapture`'s envelope never carries the evaluation entry, so the stamps do not enlarge the shadow capture.

---

## 9. V1.2 — amendments (added Sep 9, the Heard-scope + regime-label build)

**As with §8, the spec text above is not rewritten in place** — this block is
the correction of record for the two behaviour changes below, and where they
disagree, this block wins. Both trace to
`docs/audits/20260909_HEARD_SCOPE_REGIME_LABEL_BUILD_REVIEW.md`.

| § | V1 (as amended by §8) says | Correction | Why |
|---|---|---|---|
| §1.5 | `ExecutionCard` and *This turn* show `Heard at the {slot} check` **beneath `Filed {time}`** — i.e. on the current directive's card only (the disposition recorded as review A-2 / D-2) | **The POSITIVE renders on any directive card whose thread carries a null-suppression stamp — Replaced and Expired included. The DEICTIC NEGATIVE `Not heard at this check` stays on the current card.** *This turn* is unchanged: it is not a directive card and keeps the current-card treatment for both lines | A-2's reason is a reason about the negative only. `Not heard at this check` names no slot, so on a scrollback card "this check" can only mean the latest one — at which the thread was not the directive and the record says nothing. `Heard at the {slot} check` names its own check and is true wherever it is read, and the scrollback card is where that past fact is worth keeping. The two sentences are not symmetric, so the rule is not either. |
| §1.5 | Why? renders the regime as the **raw token** (`Regime directional_expansion`) — "the token IS the honest render" (recorded as D-3, a design call) | **Why? renders the shared player-facing label (`Regime · Expanding`) from the one `REGIME_LABELS` map in `decisionRecord.js`, with the raw token on the same element's `title` attribute.** The narrator's YOUR RECORD block is UNCHANGED and still prints the token verbatim | D-3 was recorded as an open design call, not a ruling. One walk (`evidenceFacts`) now produces both renders, so the panel's word and the prompt's token cannot name different regimes; the token is not lost, it moves to an attribute the prompt has no equivalent for. **Known limit:** `title` is a hover affordance, so on touch and to assistive tech the token is present but unreachable — recorded in the audit §5.2, unresolved. |

**Recorded, not corrections to this spec:**

- **The scrollback's Heard record is now one-sided** — a withheld thread's line disappears when a later filing displaces it, a heard thread's line persists. A consequence of the split above, not a defect; the self-naming negative (`Not heard at the {slot} check`) is the one-line alternative if the asymmetry is unwanted. Audit §5.1.
- **`REGIME_LABELS` had two prior declarations** (`AgentActivityFeed.jsx`, `StatusFeedTimeline.jsx`), both now re-pointed at the shared map. Only `AgentActivityFeed` is on a live path; `StatusFeedTimeline` is reached solely from `AgentStrategyTab.ARCHIVED.jsx`, which nothing imports.
