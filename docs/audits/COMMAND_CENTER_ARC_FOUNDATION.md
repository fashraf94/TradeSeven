# Command Center Arc — Foundation

**Date:** September 1, 2026
**Purpose:** the ground truth for the Command Center / Battle View work, in one document. Written so the design workstream can hold the foundation without carrying the brainstorming history that produced it.
**Supersedes as a starting point:** the design brief and Addenda A–D, `THE_BOARD_…` as a *page* concept, and `WORKSTREAM_HANDOVER_DESIGN_CHAT.md`'s two-workstream structure.
**Still canonical alongside this:** `COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` (the full rulings ledger, D-1 → D-51), `20260901_CC_SYNC_PASS2_PHASE0_DISCOVERY.md`, `PASS1_SPEC…` + `PASS1_MERGE_RULING…`.

---

## 0. Where the work stands

**Confirmed:** the controller / Battle View direction — four verbs (Why? · Show it · Direct · Draw the line later), the turn, the tape, receipts in two tiers.

**Not confirmed:** the cockpit. The Command Center's live-battle contents are open. The earlier "filtered projection, three-block cap, no verbs" wording was a proposal recorded as ruled in error and has been withdrawn. **The cockpit is not read-only by default** — see §4.

**Shipped:** Pass 1 (the Desk, four-phase model, gauges, locked-visible loadout, the `Huddle` rename) is merged behind `COMMAND_CENTER_SYNC_ENABLED`, dark. The flip PR is open and unmerged; its preview is the live reference surface.

---

## 1. Repo facts that constrain design

These came from two adversarial discovery passes. They are not opinions and they are not negotiable by design decisions.

### 1.1 The agent's rhythm
- Evaluations run **every 15 minutes**, regular trading hours only, hard-gated. `voiceLayerCache` refreshes on a similar cadence; the dashboard polls every 120 s.
- **Nothing happens between checks.** Any surface implying continuous attention is claiming something false.
- The cache cron stops **one hour before** the eval cron, so late-day chat/cockpit numbers can lag eval's by up to an hour.

### 1.2 The silence problem — the single most important design fact
**A quiet HOLD writes nothing.** No statusFeed entry, no motive line, no per-position text.

Consequences that surface in several places at once:
- **Why?** is answerable on a *traded* position and has **no source** on a held one — which on a typical day is most of the board. The absence state is the primary state, not the fallback.
- **The directive ledger ceiling is BLOCKED** for the same reason: an honored hold produces no trade and therefore no receipt.
- Both are fixable by the same write: `buildControlEpochEvent` already computes rendered-vs-suppressed per directive; only `suppressed` is durable, `rendered` is logged. **One field on the existing per-tick record, from `resolveControls`' own return — no prompt change, no model change, non-fenced.** This is the highest-leverage unbuilt thing in the arc.

### 1.3 How far a directive actually reaches
- **One line** in production puts a directive in front of the deciding model.
- **Six paths execute swaps; only one is downstream of that line.** Risk-forced exits, approved proposals, expired-proposal auto-execute, the R11 deterministic pass and gameplan swaps are all directive-blind.
- `PROFIT_TARGET_EXECUTOR_ENABLED = true` — R11 is live. A real swap can fire today on a path that never saw the directive.
- **This is correct behavior, not a bug** (guardrails that can be argued with aren't guardrails), but it means influence is narrower than the design should assume, and the honest ledger line is sometimes *"the agent traded, and not from your directive."*
- `battle.directive` is a **single slot, latest-wins**. A replaced directive's text may only be recoverable from the exchange thread — Phase 0 Q3.

### 1.4 What already ships (do not design around absences that aren't real)
- **Battle-mode chat**, server-authoritative 10-message budget, directive threading, and the card→send mechanism.
- **A standing-aware ahead/behind ask-chip** (`buildAskChips`), sent verbatim. Arc ruling: it lives inside the follow-up field as a suggested opener, costs a message, never on a piece.
- **The dual surface already exists** — League's arena posts to the same chat endpoint against the same battle doc. Mount `AgentChat` (snapshot-driven), not the arena's engine (response-driven).
- **`api/agent/debate.js`** is the archetype-voiced single-symbol research turn, over `getStockAnalysisData` + `calculateAllIndicators`. It 404s only when the symbol is outside the portfolio. `stockBriefs` is a weekly per-symbol brief, one read, 5-min cache. `fundamentals` carries `ma50`/`ma200`. **Correlation is a separate unpriced module — out of scope for the research turn.** Latency ~2–4 s uncached under a 15 s ceiling; in-turn is feasible.
- **`ARCHETYPE_INTEGRITY_MODE = 'enforce'`** — the directive gate is live and blocking. Only a verbatim allowlist string can persist; against-archetype asks resolve to null with a code-owned status line.
- **statusFeed is owner-scoped** with an opponent projection — an own-side filter is free.
- Locked-visible loadout, Game Tape, review mode, Signal Drop's parse pipeline.

### 1.5 Known defects and dead ends
- **Budget check and increment are not in one transaction** — two requests at 9/10 can both pass (P-1c).
- **The directive write is a plain update** — no status re-check, no concurrency guard (P-1a/b).
- **Three dead directive-adjacent fields:** `forgeSuggestions[]` (write-only), `directiveOutcomes`/`liveDirectives` (read-only — the *render* exists with no writer), `ignoredDirectiveIds` (write-only, with a live prompt instruction driving it).
- **Grading vocabulary is still user-visible** (`Grade: D`, "your first grade unlocks here") although grading was removed in June.
- **`SHADOW_ASSEMBLY_ENABLED = true`** behind a comment claiming it is dark; it builds two extra eval prompts per tick.
- **No `source`/`origin` field on the exchange record** — a seeded opener is indistinguishable from a typed message, so card-tap behavior cannot be measured without adding one.
- `voiceLayerCache` is readable by any authenticated user (P-4 fixed on the Pass 1 branch).

---

## 2. The locks — test-enforced or founder-ruled

Design freely inside these.

1. **The agent decides every trade.** Nothing may imply the user can execute, approve, or veto. Deterministic configuration (targets, stops) and influence (directives, preferences) are both fine; a trade button is not.
2. **Copy guard.** A build fails if Desk/board source contains *watching, thinking, researching, analyzing, about to, close to trading, wants to, looking at, eyeing, considering.* Strings live in one fixture; propose changes as requests.
3. **Motion is a claim.** No sweeps, breathing, spinners, live-ticking, "listening," or pull-to-refresh. Motion may mark a check landing or a move being made.
4. **Proximity is scoring, not action.** Direction may carry color; imminence may not carry alarm. A user's own target mark may carry emphasis — it's their line, not a prediction.
5. **C1 — no fabrication.** Render only what the decision path produced or the scoring path persisted. No model-authored introspection.
6. **C2 — display is a mirror.** No automated path from a display surface into prompt assembly. User-initiated messages are input by definition; cards may be *selected* by state but must not carry UI-computed values the agent never received.
7. **As-of stamps** in closed phases. Stale (cache old during open market) ≠ dormant (market closed).
8. **No padding.** A quiet feed is an honest feed; the unread count carries aliveness.
9. **Own portfolio only** — except match totals, which are the scoreboard. Opponent composition never.
10. **Fence:** `decide.js`, `agentEvalPromptAssembly.js` and the rest of the 11-file list are read-only outside a §7 gated ruling. *Importing* fenced helpers is not editing them.
11. **Everything ships dark.** Flag + pin + `DARK_BY_DESIGN` entry in one commit; the flip is always its own PR.

---

## 3. Process disciplines that earned their keep

- **Discovery before design commitment.** Both passes overturned assumptions that would have become architecture. Phase 0 is read-only with `file:line` and a hard STOP.
- **Anti-fabrication in discovery.** NOT FOUND is a first-class answer. Inferred architecture presented as fact is the specific failure to guard against.
- **Build the before-state.** A bundler/perf claim needs both states built, not an import-graph argument. One item died this way.
- **Discovery hazards become build constraints.** A hazard named in Phase 0 must be restated as an explicit DO-NOT in the build order, or it gets walked into. It was.
- **Queues state their release invariant:** released on every terminal path; failures do not release.
- **Tests must import what they guard.** A test that re-implements its subject passes with the feature deleted.
- **One task, one branch**, all phases. CC never opens PRs, watches CI, or merges.
- **Adversarial review before specs.** Sol has been right about the load-bearing things every time.

---

## 4. What is open

| | Status |
|---|---|
| **The cockpit** | Contents undesigned; **whether it carries actions is open.** A Scouting assignment answer is a structured write with no budget and no character reply, and its due check makes it the worst candidate for forced navigation — if any verb belongs there, it's that one. |
| **Why? source contract** | Phase 0 Q1. Gates the absence-state design. |
| **Check completion as a snapshot boundary** | Phase 0 Q2. Gates the turn and the as-of stamp. |
| **Replaced-directive recovery** | Phase 0 Q3. Gates the floor's `Replaced` state. |
| **Directive → position map** | Phase 0 Q4. Decides whether rows carry a directive mark. |
| **Signal Drop read path** | Phase 0 Q6. |
| **Assignment predicates P1/P2** | Phase 0 Q9. Both must be FOUND or the feature doesn't spec. |
| **FantasyTimes ↔ ticker join and hit rate** | Governs whether portfolio/pre-market news are features or empty states. |
| **Bagger distance per position** | Derivable, or only next-tier? |
| **The lever arc** (take-profit / stop-loss as piece properties, points not ATR, archetype-bounded, pin, moves) | Charter ruled; own arc; **fence ruling required.** |
| **Pass 2 rulings document** | Owed. Ledger floor, research slice, doors — unchanged by the controller/cockpit split; they land on the controller now. |
| **3-day battles (D-14)** | Fullday is live; the flip is its own gated ruling. Assignments are strongest as overnight homework. |

---

## 5. Sequencing as it stands

1. Pre-flip fixes merged → **flip PR open, unmerged** (its preview is the design reference).
2. Reconciled Phase 0 (controller/cockpit/assignments) — 11 questions, roughly half the original set after removing what Pass 2 already answered.
3. Pass 2 spec — Talk It Over, the ledger floor, the research slice, seeded openers. Prerequisites: P-1a/b/c, P-2, **P-7** (the precedence contradiction, now a **controller** prerequisite since Direct produces directives).
4. Then, in some order: the lever arc, assignments, league adapter, the research lane.

---

*The foundation is: the agent checks every 15 minutes and is silent between; silence writes nothing, which is why several features share one gap; influence is real but narrow; and every surface must claim only what the data can support. Everything else is design.*

---

## 6. Corrections of record (Sep 1–2, 2026) — read with §15.1 of the framework

- **§0:** there is no open Pass 1 flip PR; `claude/cc-sync-flip` exists with one commit. **P-4 is on `main`** (`9adc51ec`, `firestore.rules:704-710`). Every Pass 1 surface is dark at HEAD.
- **§1.2:** "a quiet HOLD writes nothing" is true of the statusFeed only. `rationale` is required on every decision including HOLD (`agentEvalToolSchema.js:10`) and persisted (`agent-evaluate.js:2637`). Why? needs no write. The one-field fix targets `battle.evaluations[]`, not `controlEpochLog` (per mode-epoch), and buys the receipt ceiling only (D-52).
- **§1.4:** `debate.js` guards the **book only**; widening to the bench is non-fenced; its `suggestedAction` is never rendered; the DebateModal entry point is unwired. Breakthrough alerts do not interleave in the chat.
- **§1.5:** the cron budget is **39/40**, not 37/40. Push infrastructure is NOT FOUND. Two bugs fixed Sep 2 (`5521cf79`, `f8ecfb72`); five more logged by Phase A Phase 0 for separate tasking.
- **§4 → ruled:** the cockpit carries no verb in phase one (D-57); Direct is book-level (D-53); Show it's forward path is Equip (D-54); Assignments reshaped to V2 (D-55); Expired = battle complete under fullday (D-61); the Matchups rows read the live doc under the controller flag (D-59).
- **§5 sequencing** now: Phase A (turn line · Why? · receipts · layout, dark) → Phase B (the Heard stamp) → Phase C (Show it) → Phase D (the cockpit card) → Assignments V2 · lever arc · league adapter.
