# Voice-Layer Grounding — Spec V1.3 (post-build reconciliation)

**Date:** September 7, 2026
**Status:** Spec V1.3. **Supersedes V1.2.** Built (`hub8kv`, Sep 8) and walked to `'shadow'` (Sep 8). V1.3 reconciles three rulings made during the walk so the spec is the live contract: the route's gate (§6.1), the shadow record's durability (§9), and the record's translator rule (§3.2). Nothing else changed.
**Prepared by:** Fable, with Flash.
**Basis:** `docs/audits/20260907_VOICE_GROUNDING_PHASE0_DISCOVERY.md` · the ledger D-42 → D-98 · `COMMAND_CENTER_ARC_FOUNDATION.md` · Sol's review of Sep 7.
**Suggested commit location:** `docs/design/VOICE_LAYER_GROUNDING_SPEC_V1_3.md`

---

## 0. The one paragraph

The character has been describing an agent that isn't the one playing. This spec gives the narrator **inputs, not authority**: the decider's persisted record, labelled as history it did not author; narrator-side context, labelled as context; a vocabulary that reports and never forecasts; chips that file exactly what they say through a deterministic route; and a code-rendered receipt bound to the successful write. Nothing changes what the decider sees or does. **The rule that governs every line: attribution proves authorship, not safety — a recorded action conditional is still a promise when the character says it.**

---

## 1. The contract (founder rulings R1–R6, as Sol sustained or corrected them)

| # | Ruling | Sol | In one line |
|---|---|---|---|
| R1 | One voice, one tense rule | Sustained | Past tense from the record; the future only as cadence ("at the next check the process evaluates…"); never a specific future trade. **Governs R4, not the reverse.** |
| R2 | Both evidence sources, labelled | Sustained with a rule | The decider's record and the narrator's context are two headings, never one "record." |
| R3 | Action chips minted from the allowlist | Sustained with a mechanism change | A directive chip files its id through a deterministic route; `Files:` is true by mechanism. |
| R4 | Anticipation reports, does not perform | Corrected | The note reports the candidate *event* (symbol, direction, slot). The `threshold` is withheld until the fenced contract changes (§7 list). |
| R5 | Measure before `'on'` | Sustained with a stronger gate | Paired harness with **new-prompt** latency and schema metrics, then a one-day canary, then broad on. |
| R6 | ATR bug now, separately | Sustained | Own tiny task. |

**Locks that hold:** §2 authority line; C1 (the narrator quotes persisted decision-path output, never composes reasoning); C2; the fence; no new cron; no new model; 19 s call / 24 s turn.

---

## 2. Scope

**Changes (non-fenced):** `voiceLayerPrompt.js` · `chat.js` · a new `api/agent/file-directive.js` (§6.1) · `voiceLayerAnticipation.js` · `voiceLayerTradeNarration.js` (retired under the flag) · `openerTemplateFloor.js` · `voice-layer-cache.js` (one field) · `agent-evaluate.js` (the anticipation dispatch and exchange shape only) · `AgentChat.jsx` · `useArenaEngine.js` · `featureFlags.js` · tests.
**Does not change:** anything the decider reads or emits; the allowlist; the tape, Why?, Bench.
**§7 list (fenced / fence-adjacent — founder rulings, not this arc):** the eval prompt's "watching for the trigger" / "the specific condition that would make you act" (`agentEvalPromptAssembly.js:485-511`, `agentEvalToolSchema.js:180`) — **until this changes, `threshold` renders nowhere in the narrator's voice**; the hypothesis schema/prompt contradiction (`agentEvalToolSchema.js:38-47` vs `agentEvalPromptAssembly.js:522-533`); write-only `ignoredDirectiveIds` with a live instruction (`:192`); the bench "Composite:" label (`:1719-1726`).

---

## 3. The prompt — what the narrator reads (G1)

### 3.1 The identity frame (replaces `voiceLayerPrompt.js:2912-2916`) — F3, F4
> You are {name}, a {archetype}. Your trades are decided by your trading process at each scheduled 15-minute check and recorded. **Between checks no trading decision is made. At a check, the process evaluates current evidence under its standing rules and any current directive.** Below are two things: YOUR RECORD — what that process decided and wrote at recent checks, which you did not author and which is history, not a plan; and CURRENT CONTEXT — market and technical facts prepared for this conversation, which the process did not necessarily see. You speak about decisions only in the past tense and only from the record. **Historical decision records are evidence of what was decided then; do not infer a current plan or a future action from them.** You may say what the record shows, what the context shows, and what your rules are. You may not say what you will do to a position.

### 3.2 YOUR RECORD (new block; battle fall-through after the battle state) — F6
Code-rendered from the battle doc `chat.js` already loads. Three entries (measured ~442 tokens); one-entry fallback if the R5 read is thin.
```
YOUR RECORD (the last 3 checks, newest first — history, not a plan)
[12:45 PM check] Held · woken by a bench name outrunning the book
  Rationale: <evaluations[i].rationale — the stored bytes, verbatim, markers included>
  Hypothesis recorded at this check (graded after the battle): <evaluations[i].hypothesis>   ← only when the field is present AND the rationale does not already contain it under the duplicate normalizer (§3.2a); otherwise omitted
[12:30 PM check] Swapped GILD → MOS (Core) · woken by …
  Rationale: …
CURRENT DIRECTIVE (filed to the trading process; in front of it at each check while current — it may or may not act on it)
  "Widen the spread (target more sectors)" — filed 3:50 PM           ← absent when none
RECEIPTS (last 5 trades) — the existing RECENT TRADES block, unchanged
```
- **Verbatim means bytes — for the agent's own words.** A system-authored rationale (the guardrail or risk-manager path) renders through the shared `renderMotive` translator in `src/data/decisionRecord.js` everywhere it reaches the prompt — YOUR RECORD *and* RECENT TRADES — so a provenance code never reaches the narrator (Sep 8 ruling; the build review found RECENT TRADES still raw). Byte-equality tests cover agent-authored rationale only.
- **The rationale rule (Sol confirm pass, M1) — printed beside the block:** *Rationale is historical decider text. It may contain forward-looking language produced by the decision prompt. When explaining a completed decision, quote only the part describing the completed decision and its observed reason. Never repeat a hypothesis, future action, action condition, intended trade, or plan from inside rationale.* The paired harness (§9 gate 1) carries a **hostile fixture** whose rationale contains `Hypothesis:`, "I'll rotate", and "if X then I would swap", and scores the reply on whether any of it is repeated.
- **Hypothesis dedupe** is the same rule the pane adopts (§11): prefer the field; suppress it when the rationale already carries it; never render twice.

#### 3.2a The duplicate normalizer (M2) — for detection only; stored and displayed bytes are never modified
For each side: strip Markdown emphasis wrappers (`**…**`, `*…*`, `_…_`) → collapse whitespace → trim → remove one leading `Hypothesis:` (case-insensitive, with or without the bold) → compare the remainders exactly. A test pins the known pair: field `Hypothesis: CF will break out…` vs inline `**Hypothesis: CF will break out…**` → duplicate.
- Slot labels per D-83; `Woken by …` per D-81; outage classes per D-69.

### 3.3 CURRENT CONTEXT (the existing cache blocks, re-headed) — F3
The portfolio and bench briefs, scout alerts, market context, the dark Wire block, and **the fundamentals line (§3.5)** render under one heading: `CURRENT CONTEXT — prepared for this conversation from cached sources at their labelled vintages; not the evidence the trading process necessarily saw at its check` (the fundamentals are weekly). The `DATA_CONFIDENCE_RULE` carries that sentence.

### 3.4 The history window (`chat.js:411-417`) — F5
The last-10 window includes agent-initiated exchanges **that carry the top-level marker `groundingVersion: 1`** (M3). **Every exchange produced under the grounding contract carries it at the top level** — generated openers, template openers, grounded chat turns, code-composed anticipation, `directive_filed` audit entries — so the history filter has one rule and no message-type exceptions; `anticipationContext` stays for anticipation-specific provenance only. Legacy proactive exchanges (written before the flip, no marker) stay excluded. Each history line is tagged by `messageType`; the frame states: **"Your earlier messages are conversation, not decision evidence."**

### 3.5 The fundamentals mirror in the cache brief (R2, now) — sustained by Sol (C-11)
`voice-layer-cache.js` copies `fundamentals` from the `rankingsMap` entry it already holds (`:749-752`) onto each brief; rendered as one line per name with the vintage: `Fundamentals (as of Sep 5): EPS revisions +47.2% · revenue growth +12% · P/E 18 vs sector 22`; null-honest; under CURRENT CONTEXT only. Zero added reads.

---

## 4. The vocabulary (G2) — the 27 sites (Appendix A of V1, unchanged) plus two corrections
- **Trade narration is retired under the flag (F8).** The `trade_narration` model call is not made; the tape's trade card (from `trades[]`, D-72, with the motive quoted verbatim and its author named) is the trade notice. No paraphrase of the decider's reasoning exists anywhere in the narrator's voice.
- The CONFIRMATION rule: "Acknowledge in one sentence. The interface states what was filed. Do not describe what you will do with it." The CLOSING rule: "You may lay out the options the record and the rules support; you do not say which will be taken." First message: the book and the reason recorded at deploy (D-76 rules). THIRD_PATH: the offer to *file* a canonical directive stays — an offer to file is real (§6); a promise to trade is not.
- **Guard:** the prompt-module test asserts none of the 27 strings appear in any assembled prompt with the flag on; the off state byte-identical.

---

## 5. Anticipation — the check's note, event only (R4, F1, F7, F10)
- **Source:** the decider's `anticipationCandidates[]` for the tick (`agent-evaluate.js:2053-2057`).
- **The exchange text is code-composed and carries only proven-descriptive fields:** `At the {slot} check my trading process flagged {SYM} on the bench as a potential entry.` / `…flagged {SYM} in the book as a potential exit.` **No `threshold`. No `signalSummary`** until the targeted read (§9 gate 0) proves its contract is descriptive and non-action-bearing; if it is, one clause may follow: `The signal it recorded: {signalSummary}`.
- **No model call** for the note. (The anticipation prompt's 27-site vocabulary is thereby dead under the flag.)
- **Dedupe — the provable claim:** at most one note per `(symbol, direction)` per battle day. Not "unchanged condition" — the implementation cannot prove semantics.
- The exchange records top-level `groundingVersion: 1` and `anticipationContext { symbol, direction, evaluationId, slot }`; the pane's `Bench note` / `Holding note` eyebrows render it (the flip-prep ruling that never landed — A3.7).
- The candidate list on the evaluation entry (D-79) rides "the tick stamps" in Phase B.

---

## 6. Chips and the receipt (G3, R3, F2)

### 6.1 The deterministic route — `POST /api/agent/file-directive`
Body `{ agentId, battleId, adjustmentId, expectedDirectiveThreadId }` — the last **nullable and required**: the client's belief about the current directive (`null` = none). **One transaction** (M4; the P-1a/b/c requirement lands here first) that re-reads and verifies, in order: the authenticated owner; the battle is active; the agent belongs to this battle; the current directive's `threadId` equals `expectedDirectiveThreadId` (else `conflict`); the adjustment id is permitted for the **server-derived** archetype (`directiveGate.js:59-95`, reused); the canonical text from `getCanonicalText(id)` (server-side, never the client's); **the route's flag** — reachable only when `getVoiceGroundingMode(user.uid)` resolves `'on'` (which `'canary'` does for an allowlisted uid); 404 at `'off'` and `'shadow'` and for a non-listed uid at `'canary'` — the same resolution that mints the chips, checked first, before any read (Sep 8 ruling; V1.2 said `≠ 'off'`, which left a write route reachable during the measurement step); then writes the directive to `battle.directive` with D-18 latest-wins and the **existing persistence shape** (`directiveThreadId`, `expiry`, the battle/agent binding, the budget fields — copied from the shipped write at `chat.js:686-708`, per the in-session read §9 gate 0b, never a parallel schema), the budget charge per §6.4 in the same transaction, and an audit exchange `{ messageType: 'directive_filed', groundingVersion: 1, directive: { id, text, threadId }, source: 'chip' }` sharing the directive's `threadId`. Response `{ directive, remaining }` **after the commit**. **No model call.** Status: filed / replaced-prior / rejected (off-menu) / conflict / budget-exhausted. Consumers: the directive chips and the structured Direct control. **Not assignments** — their answer is research/equip through the ruled equip path (§11), a separate authority channel.

### 6.2 Minting and rendering
`OUTPUT_FORMAT`: "An option that files a directive must be a menu item by id; its text is the item's canonical text. Any other option is a question." Server rewrites a directive chip's text to canonical and drops off-menu ids. The client renders a `directive` chip as **`Files: Widen the spread (target more sectors)`** and its tap calls §6.1 with the id — never the chat route. An `ask` chip taps into the chat as today.

### 6.3 The receipt — bound to the write (Sol C-5)
`Filed: {directive.text}` renders only from the persisted directive returned by §6.1 (or, for a typed directive filed through the chat, from the exchange's `directive.text` after the write at `chat.js:686-708`) — never from the reply, never before the write. Both clients consume it (`AgentChat`, `useArenaEngine`); the no-change line (`directiveStatusLine`) gains its client consumer the same way.

### 6.4 The cost of a chip — founder to confirm (Sol's recommendation adopted as the lean)
**A directive filed through §6.1 charges one message**, the D-31 cost the Controller brief already designed (`File it · 1 message`). The scarce resource is influence, not inference: a deterministic write still changes what sits in front of the trading process, and making the strongest bounded influence action free because it skipped Gemma would invert the budget's purpose. Consequences carried into §6.1: the route checks remaining budget inside the transaction, charges and writes atomically, returns `remaining`, and concurrent taps cannot overspend. **Assignment answers stay free** — the character initiated the ask and the answer is research/equip, a different channel.

---

## 7. The opener (H19)
The template ends after the archetype sentence. The generated opener names the book and the deploy reason; no "watching," no "flag."

## 8. The League surface (H18)
Ordinary League chat shares the chat endpoint, prompt and gate, so the prompt changes land there by construction. **Directive chips deliberately do not** — they call `file-directive` (§6.1) on both surfaces. The arena renders chips and the `Filed:` line from the fields it drops today.

---

## 9. Flag, rollout, gates (R5, F9)

**`VOICE_GROUNDING_MODE = 'off' | 'shadow' | 'canary' | 'on'`** — pinned; `DARK_BY_DESIGN`; founder-walked, never in a build PR.
- `'off'`: every prompt byte-identical (goldens).
- `'shadow'`: assembles the new prompt and logs both to the shadow stream; **sends the old**. Proves assembly and token size on real battles; nothing else. **The three `logConversation` writes in `chat.js` complete before the function can be frozen** (`waitUntil` where the runtime offers it, else an awaited write under a clamped cap inside the handler's timing budget) — the pairs are the whole yield of this step. Two other surfaces change at `'shadow'` by design: the cache cron mirrors `fundamentals` onto the briefs (a key the fenced reader ignores — the off goldens prove it; not fence contact), and nothing else.
- `'canary'`: the new prompt is sent for uids in `VOICE_GROUNDING_CANARY_UIDS` (the `MANDATE_FOUNDER_UIDS` precedent) — the founder's own battles for one trading day.
- `'on'`: everyone.

**Gates, in order:**
0. **Two targeted reads** (the build session's in-session Phase 0): (a) `signalSummary`'s schema and prompt contract — descriptive, or action-bearing?; (b) the shipped directive write's exact persistence shape at `chat.js:686-708` (`directiveThreadId`, `expiry`, battle/agent binding, budget semantics) so §6.1 copies it rather than inventing a parallel schema.
1. **The paired harness, offline:** ≥ 20 real turns from shadow plus the hostile rationale fixture (§3.2), replayed old vs new against the live model; records **new-prompt latency (p50/p95), schema adherence, timeout rate**, the reply lint (`I'll rotate|I'm rotating|eyeing|watching|keep an eye|I'd consider … swap`) as a measurement, and **a scored dimension for forward language repeated from inside the rationale**.
2. **Founder read** of the 20 pairs for intent, invented plans, lost helpfulness.
3. **Canary** for one trading day; the same metrics from live traffic.
4. `'on'`.

---

## 10. Tests (import what they guard)
Off goldens · the 27-string guard · YOUR RECORD byte-verbatim; the rationale rule printed; the hypothesis present/omitted/deduped through the §3.2a normalizer (the known bold-vs-field pair); the directive line present/absent · CURRENT CONTEXT heading and the `DATA_CONFIDENCE_RULE` sentence · history: exchanges with top-level `groundingVersion: 1` included, legacy excluded, tags present; every grounded writer stamps the marker (one row per writer) · anticipation: event-only text, no threshold token in the exchange, one per (symbol, direction, day), no model call (a mocked client asserts zero calls) · §6.1: filed / replaced-prior / rejected / conflict (stale `expectedDirectiveThreadId`) / budget-exhausted; the transaction's eight checks each falsifiable; a concurrent double-tap charges once; the route 404s at `'off'`; the persisted shape equals the shipped write's; no model call · chips: canonical text, off-menu dropped, the tap hits §6.1 not chat · `Filed:` only after the write, from the persisted object, both clients · narration: no call under the flag · the template opener · the four flag states, the canary allowlist · mutation checks with the survivor proof first.

## 11. Founder adoption of Sol recommendations, Sep 7 — recorded (Sol's pass was advisory; the adoption is the founder's)
- **D-76 — the plan at deploy: SUSTAINED WITH A RULE.** Render the exact persisted deploy artifact the decider receives, code-rendered, labelled `The plan at deploy · {date}`, gated off tournament battles and the template fallback, never as current intent. → A2.1b stays; ledger D-76 closes.
- **The hypothesis field: SUSTAINED WITH A RULE.** Render the field as `Hypothesis recorded at the {slot} check · graded after the battle`; suppress the inline duplicate when the rationale carries the same text; never voiced as the narrator's forecast. → the pane (A3.7) and §3.2 share the rule; hazard 29's "never render hypothesis" is amended (D-99).
- **Assignments V2 — the conversational trigger: SUSTAINED WITH A RULE.** A scouting ask from the cited record is R1-compliant ("my last check named NOW and TSLA on the bench; scout them and equip the one you'd trust"); symbols from the actual record only; research/equip only; no prompt-assembly entry except the ruled equip path. → D-55 amended (D-100).

## 12. Separate tasks
R6 the ATR percentile bug (now) · the p50/p95 reader script (before gate 1) · `HypothesisTicker` dead import · `forgeSeeds: null` · the exchange `source` marker.

---

## Appendix B — Sol pass one, disposition
| # | Sev | Finding | Disposition | Where |
|---|---|---|---|---|
| F1 | BLOCKER | R1 vs R4 on `threshold` | Sustained — threshold withheld; event-only note | §5, §2 (§7 list) |
| F2 | BLOCKER | `Files:` not backed by the click path | Sustained — deterministic route; chips call it by id | §6.1–6.3 |
| F3 | MAJOR | "Your record" swallows context | Sustained — RECORD / CONTEXT split | §3.1, §3.3 |
| F4 | MAJOR | "rules act on their own" | Sustained — cadence sentence | §3.1 |
| F5 | MAJOR | History self-contamination | Sustained — grounding marker; legacy excluded; tagged | §3.4 |
| F6 | MAJOR | verbatim vs stripped; hypothesis duplicate | Sustained — bytes; dedupe rule | §3.2 |
| F7 | MAJOR | `signalSummary` unproven | Sustained — held behind gate 0 | §5, §9 |
| F8 | MAJOR | narration paraphrases | Sustained — narration retired; the trade card is the notice | §4 |
| F9 | MAJOR | shadow doesn't measure the new prompt | Sustained — paired harness + canary | §9 |
| F10 | MAJOR | dedupe claims semantics | Sustained — one per (symbol, direction, day) | §5 |
| — | — | Chip cost | **Open founder ruling** | §6.4 |

*Prepared September 7, 2026. The narrator gains inputs, not authority — and a recorded promise stays a promise, whoever is quoted.*

## Appendix C — Sol confirm pass (Sep 7), disposition
| # | Sev | Finding | Disposition | Where |
|---|---|---|---|---|
| M1 | MAJOR | Raw rationale still carries forward language | Sustained — the rationale rule beside the block; hostile fixture; harness dimension | §3.2, §9 |
| M2 | MAJOR | Whitespace-only dedupe misses the known pair | Sustained — the §3.2a normalizer, detection only | §3.2a |
| M3 | MAJOR | `groundingVersion` in two places | Sustained — top-level on every grounded exchange; one history rule | §3.4, §5 |
| M4 | MAJOR | `file-directive` needs a transaction contract | Sustained — `expectedDirectiveThreadId`, eight in-transaction checks, the route gated itself, the shipped shape copied | §6.1, §9 gate 0b |
| M5 | MAJOR | §6.4 is larger than a constant | Sustained — one message charged, atomically; assignments free | §6.4 |
| g1 | minor | Assignments listed as a `file-directive` consumer | Sustained — removed | §6.1 |
| g2 | minor | CURRENT CONTEXT wording | Sustained — "cached sources at their labelled vintages" | §3.3 |
| g3 | minor | §8 stale; §11's authority wording | Sustained — the chip/chat distinction; "Founder adoption of Sol recommendations" | §8, §11 |

## Appendix D — the walk's rulings (Sep 8), for the ledger
| # | Ruling |
|---|---|
| **D-106** | `file-directive` is reachable only at resolved `'on'`; `'shadow'` is measurement only. (Amends D-102.) |
| **D-107** | The `fundamentals` mirror at `'shadow'` is not fence contact: the fenced reader's rendered prompt is byte-identical, proven by the off goldens; the walk stays under the flag's own protocol. |
| **D-108** | The shadow record is written durably from `chat.js` (`waitUntil` or a clamped awaited write); the four sibling handlers on the same stream are separate tasking. |
| **D-109** | System-authored rationale renders through the shared translator wherever it reaches the narrator or the player; `Flat6BattleView` joins the shared renderer in its own PR. |
