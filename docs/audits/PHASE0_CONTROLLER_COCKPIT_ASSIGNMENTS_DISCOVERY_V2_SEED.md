# Phase 0 discovery V2 — controller, cockpit, assignments (reconciled)

**Date:** September 1, 2026
**For:** CC (Claude Code). **Read-only. `file:line` on every finding. NOT FOUND is a first-class answer. Hard STOP at the end. No branch beyond discovery, no edits, no build.**
**From:** Flash, with Fable (design chat — now the arc's main chat).
**Supersedes:** `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V1.md` and the arc chat's reconciled 11-question set. This version is reconciled against `COMMAND_CENTER_ARC_FOUNDATION.md` and the D-42 → D-51 ledger entries; everything Pass 2 discovery already proved is listed in §1 and is **not re-asked**.
**Attach to the session:** `COMMAND_CENTER_ARC_FOUNDATION.md` · `COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` (ledger to D-51) · `20260901_CC_SYNC_PASS2_PHASE0_DISCOVERY.md` · `COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md` · `SCOUTING_ASSIGNMENTS_CONCEPT_V1_1.md` · `docs/BUILD_RULES.md`
**Report goes to:** `docs/audits/PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md`

---

## 0. Ground rules (BUILD_RULES + foundation §3)

1. **Git verification first.** Branch, HEAD SHA, clean tree. The reference is latest `main`; the Pass 1 flip PR is open and unmerged — say whether you are reading `main` or the flip branch for each Pass 1 item, because the answers differ (P-4 is fixed on the branch, not on `main`).
2. **Read-only.** Nothing is created, edited, or run in a way that writes.
3. **Every finding carries `file:line`.** Inferred architecture presented as fact is the failure to guard against. If you cannot cite it, it is NOT FOUND, and you say where you looked.
4. **Verdicts:** `FOUND` · `NOT FOUND` · `CONSTRAINED` (exists with a limitation that changes the design — name it).
5. **Fence:** the 11-file list at `docs/BUILD_RULES.md:14-24`. Reading fenced files to cite behaviour is fine; *importing* fenced helpers is not editing them; any change to one is a STOP for founder ruling. State fence status per item.
6. **Where a question asks you to *name* a minimum write, one sentence.** Do not design it.
7. **Hazards you find become build constraints.** List every hazard in a separate section so it can be restated as a DO-NOT in the build order.

---

## 1. Established — cite, do not re-derive

From the two adversarial passes (foundation §1). Cite the line if a build depends on it; do not spend time re-proving.

- Evals every 15 minutes, RTH only, hard-gated; `voiceLayerCache` on a similar cadence; the dashboard polls at 120 s; **the cache cron stops one hour before the eval cron.**
- **A quiet HOLD writes nothing** — no statusFeed entry, no motive line, no per-position text.
- **One line** puts a directive in front of the deciding model; **six paths execute swaps, one is downstream of it**; `PROFIT_TARGET_EXECUTOR_ENABLED = true`.
- `battle.directive` is a single slot, latest-wins; the directive write is a plain update (P-1a/b); budget check and increment are not one transaction (P-1c).
- `ARCHETYPE_INTEGRITY_MODE = 'enforce'` — the gate is live and blocking.
- Battle-mode chat, 10-message server budget, directive threading, card→send, `buildAskChips(youRank)` all ship. League's arena posts to the same chat endpoint against the same battle doc.
- `api/agent/debate.js` is the archetype-voiced single-symbol research turn over `getStockAnalysisData` + `calculateAllIndicators`; 404s outside the portfolio; `stockBriefs` weekly, `fundamentals` carries `ma50`/`ma200`; **correlation is a separate unpriced module, out of scope**; ~2–4 s uncached.
- statusFeed is owner-scoped with a `PUBLIC_STATUSFEED` opponent projection.
- Dead directive-adjacent fields: `forgeSuggestions[]` (write-only), `directiveOutcomes` / `liveDirectives` (render, no writer), `ignoredDirectiveIds` (write-only, live prompt instruction).
- No `source` / `origin` field on the exchange record.
- Grading strings still user-visible; `SHADOW_ASSEMBLY_ENABLED = true`.

---

## 2. Questions, in the order they gate shipping

### Q1 — The per-tick record and the one-field fix (gates D-44 Why?, §8.2 receipt ceiling, D-49)
The foundation says `buildControlEpochEvent` already computes rendered-vs-suppressed per directive, `suppressed` is durable and `rendered` is only logged, and one field on the existing per-tick record from `resolveControls`' own return would fix both Why? and the ceiling. Establish exactly:
- **a.** The per-tick record: collection/document, key, fields, who writes it, at what point in the tick. `file:line`.
- **b.** `buildControlEpochEvent` and `resolveControls`: where each lives, what each returns, and whether the `rendered` value is available at the point the durable record is written (same call stack, or re-computed?).
- **c.** **Fence status of the file that would carry the new field.** This is the question. If it is fenced, the write is a §7 gated ruling; if not, it is the highest-leverage non-fenced build in the arc.
- **d.** Keying: would `rendered` be per directive (by `directiveThreadId`) and per tick? Would it tell us the directive was *in the deciding prompt* (proves `Heard`) — and nothing more? State precisely what verb it supports and what it does not (it does not prove *holding because*).

### Q2 — Model output on holds (gates Why? beyond the absence state)
The absence state is primary because a quiet hold writes nothing. Is that because the model returns nothing on a hold, or because a returned rationale is discarded?
- **a.** The eval tool schema (`agentEvalToolSchema.js`) — does `submit_trade_decision` (or a sibling) carry a reasoning/rationale field when the decision is *no trade*? Is it required or optional?
- **b.** If the model returns text on a hold, where does it go — logged, dropped, or persisted anywhere (shadow logger, epoch event, statusFeed with a suppressed type)?
- **c.** Fence status of the write that would persist it. **Name** the minimum write in one sentence; do not design it. If persisting is fenced, say so plainly — Why? on held positions is then facts-only until a ruling.

### Q3 — Check completion as a snapshot boundary (gates D-48 the turn, cockpit as-of)
- **a.** `scoreState.lastScoredAt`: written where, and **is it the last write of the tick** (after positions, statusFeed, epoch event, directive disposition)? If not last, what is, and is anything written after it?
- **b.** What can a client subscribe to as "a check completed" without polling — the battle doc, a subcollection, the cache?
- **c.** Can a *missed* or *failed* check be detected from persisted state (a gap since `lastScoredAt` beyond cadence + a grace window, or an explicit failure write)?
- **d.** For late-day: what timestamp does the cache carry so a surface can say *as of the 3:45 check* while the eval has run at 4:00?

### Q4 — Replaced-directive recovery (gates D-51 `Replaced`)
The slot is latest-wins. When a directive is replaced before a check:
- **a.** Is the prior text and its `directiveThreadId` recoverable from the exchange thread with a timestamp? `file:line` for the exchange record shape.
- **b.** Is there any persisted marker that the replacement happened *before* vs *after* a check — i.e. can we prove the replaced directive was never in front of the model? (If Q1's `rendered` field lands, this becomes derivable; say whether that is the only path.)

### Q5 — Directive → position map (gates row marks, Controller §5.3)
- **a.** Do allowlist strings (`archetypeAdjustments.js` via `directiveGate.js`) carry symbols, or are all directives book-level?
- **b.** Does `resolveControls` output name positions per directive? If yes, `file:line` and shape. If no: rows carry no directive mark; the mark lives on the score header only. Say which.

### Q6 — Which swap path produced a trade (gates honest tape copy: "traded, and not from your directive")
Six paths execute swaps; one is directive-aware.
- **a.** Does the persisted trade record carry a path/source identifier (risk-forced, proposal, expired-proposal auto-execute, R11, gameplan, model decision)? `file:line` per path's write.
- **b.** If not, can the path be inferred deterministically from other persisted fields (e.g. `swapMotive`, `exitReason` — byte-frozen — or `guardrail_profitTarget`)? Inference must be exact or the tape says only `Acted` with no attribution.

### Q7 — The Battle View as re-composition (gates the controller's build size)
- **a.** Current `AgentBattleScreen` structure: the three tabs, component files, data hooks, props, mobile "Live Activity" sub-tab. `file:line`.
- **b.** The Matchups row component: file, props, whether it can accept an `onTap` and an expandable child (the Why? panel) without rewriting the row. Where do its `% to Bust` / `% to Bagger` values come from — `scoreState`, `thresholdHistory`, the cache, or client math? (This also answers the open "bagger distance per position" item and tells the cockpit which source to use for *closest to a tier*.)
- **c.** `AgentChat` mount requirements when snapshot-driven (what it reads, what it needs from the parent); `LiveActivityPanel` plain-props portability (already confirmed for the Desk — cite).
- **d.** Anything in the Battle View that would break if the tab bar were removed and the three surfaces rendered side-by-side / as a sheet (route state, tab-keyed subscriptions, `View full activity log` links).

### Q8 — A structured write from the dashboard route (gates the open cockpit-verb question, D-46; gates assignment answers)
- **a.** Is there any endpoint or path that stores a user input on the battle doc **without** a Gemma exchange (no message budget, no character reply)? The directive write path inside `chat.js` — can it be reached, or factored, without the model turn? `file:line`. If NOT FOUND, **name** the minimum non-fenced write.
- **b.** From the dashboard route (`App.jsx` Manage-card context), what does posting to the chat endpoint need — `agentId`, `battleId`, auth — and is all of it available where the cockpit card renders? (League's arena already does this; cite its call.)
- **c.** Can `AgentChat` mount on the dashboard route snapshot-driven with the same battle doc, or does it assume Battle View route state?

### Q9 — Show it inputs (gates Controller §5.2)
- **a.** `debate.js`: the exact response shape (fields), the portfolio-only 404 guard `file:line`, and whether "portfolio" means the *book* or the battle's frozen `agentContext` universe (bench included). If the bench is inside the guard, assignments can use `debate.js` for both names as-is.
- **b.** Fence status of removing or widening the guard for a non-portfolio symbol (§7.1's remaining work).
- **c.** `nextDeployCandidates`: existing field or Equip chip pattern to reuse, or net-new on `agents/{id}` + `EquipBench.jsx`; replacement behaviour if net-new.
- **d.** Signal Drop: is there any read path from a drop's result (thesis, related tickers) into a battle route today? What does a completed drop persist, keyed how?

### Q10 — Assignment predicate P1: the rank tie (gates D-50)
- **a.** Where the archetype-ranked output the scouting board uses lives at HEAD — persisted per battle (in `agentContext`?) or per agent, or computed in-eval only. `file:line`.
- **b.** Is a rank *distance* readable (scores, not just order)? In what units? Is it timestamped?
- **c.** Fence status of reading it. (Scouting Focus V1.3 §3 says post-rank; confirm the read is outside the ranking engine.)
- **d.** If cheaply measurable from recent battle data: how often two bench names fall within a small margin. If not cheap, say NOT MEASURED.

### Q11 — Assignment predicate P2: swap possibility ahead of a check (gates D-50)
- **a.** Bench → book swap mechanics mid-battle: windows, locks (`swapLock`), tier entry rules, and the R11 path. `file:line`.
- **b.** Can "a swap involving X or Y is possible at or before check T" be evaluated from persisted state *before* T? If it depends on in-eval computation, the answer is CONSTRAINED and the concept reshapes.

### Q12 — Preference kind and the server-initiated ask (gates D-50)
- **a.** Anything in the allowlist / gate resembling a weak preference between two named symbols; does the control prompt ingest it; would `submit_trade_decision` echo it (floor receipt)?
- **b.** The server-initiated turn pattern (`ensure-opener.js`, statusFeed writes): what exists, and what a due-timed ask would need beyond it.
- **c.** Push/notification infrastructure at HEAD: FOUND / NOT FOUND.

### Q13 — The dead render as the cheapest receipt UI (gates the floor's build size)
`directiveOutcomes` / `liveDirectives` render exists with no writer. What shape does the render expect, where is it mounted, and could the floor states (`Filed · Acted · Replaced · Expired`) be written into that shape rather than building a new ledger component? Say yes/no with `file:line`.

### Q14 — Fence check
One line per question above: what a build following it would touch, fenced or not.

---

## 3. Dropped from V1 as already answered (for the record)
Research path fields/latency (`debate.js`), the ledger receipt state (ceiling BLOCKED, floor ships), D-17 flag state (`enforce`), budget atomicity (P-1c known), directive write guards (P-1a/b known), own-side statusFeed filter (free), Manage poll cadence, cache cadence and the one-hour lag, `buildAskChips` shipping, the exchange record's missing `source` field.

---

## 4. Output format
- One section per question, in order: **verdict** · **`file:line` citations** · **what it means for the design in one sentence** (plain game terms first).
- Closing table: question · verdict · fence status · what it gates (D-number / brief section).
- **Hazards** section: every hazard found, one line each, ready to become a DO-NOT.
- **Memory discrepancy log:** anything the attached documents claim that the repo contradicts.
- No designs, no copy, no builds. Where asked to name a minimum write, one sentence.

## 5. STOP
This session ends when the report is written. No implementation branch is created from this session. The founder reads the report; rulings follow in the framework ledger; any build is a new task, a new branch, a new session with its own seed set.
