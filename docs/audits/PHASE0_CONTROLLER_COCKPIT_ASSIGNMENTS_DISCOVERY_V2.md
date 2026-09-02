# Phase 0 Discovery V2 — Controller, Cockpit, Assignments (reconciled)

**Date:** September 1, 2026
**Status:** READ-ONLY discovery. No implementation branch. Hard STOP at the end.
**Seed:** `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2` (Flash + Fable, design chat)
**Supersedes:** `PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V1` and the arc chat's 11-question set
**Prepared by:** Claude Code, under `docs/BUILD_RULES.md`

---

## 0. Preamble — git verification (BUILD_RULES §3)

| Item | Value |
|---|---|
| Branch | `claude/phase0-discovery-v2-reconciled-808evq` |
| HEAD SHA | `bd6083739894200eee530016b15c20543fd22dad` |
| Working tree | **Clean** (`git status --porcelain` empty) |
| `git fetch origin` | **Run first**, before any remote comparison (§3) |
| `origin/main` | `bd608373` — **identical to HEAD** (`git rev-list --left-right --count` = `0 0`) |
| Reads are against | **`main`.** Every citation in this report is `main` at `bd608373` unless explicitly marked otherwise. |

**Method.** 28 agents: one investigator per question (Q1–Q13), each answer handed to an independent verifier instructed to *refute* it with `file:line` evidence, plus a fence sweep (Q14) and a completeness critic. **826 citations were re-checked; 41 were wrong or off-target and are corrected here; 58 claims were refuted or narrowed.** Findings that survived refutation, plus my own direct reads, are what this report states. Nothing was run that writes; no test suite, no build.

### 0.1 The Pass 1 flip — the seed's framing does not match the repo

The seed's ground rule 1 says *"the Pass 1 flip PR is open and unmerged … P-4 is fixed on the branch, not on `main`."* Both halves are stale:

- **There is no open flip PR.** Open PRs at HEAD are #762, #761, #760, #451, #427, #422 — none is the Command Center flip. The branch `origin/claude/cc-sync-flip` exists (one commit, `dee30fde`) but carries no PR (`search_pull_requests head:claude/cc-sync-flip` → 0 results).
- **P-4 is fixed on `main`, not on the branch.** P-4 is the `voiceLayerCache` owner-scoped read rule (`COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md:333`). It landed on `main` in `9adc51ec` ("Phase A0 (P-4): owner-scope voiceLayerCache reads via battle-doc lookup"), verified an ancestor of `origin/main`, and is live at `firestore.rules:704-710`. It was solved **not** by adding `ownerId` to the cache doc (the Pass 1 discovery's blocker) but by a `get()` lookup on the battle doc — so the STOP-1 contradiction was resolved by a different route than either option the discovery listed. The flip branch touches only three config/test files and does not touch `api/cron/voice-layer-cache.js` at all.

**What actually differs between `main` and the flip branch:** exactly one thing — `COMMAND_CENTER_SYNC_ENABLED`, `false` at `src/config/featureFlags.js:1887` on `main`, `true` at `:1891` on the branch. **Every Pass 1 surface in this report is therefore DARK on `main`.** That matters for Q7: the in-battle tab reads "Command Center", not "Huddle", at HEAD.

### 0.2 Attached documents — five of six are not in the repo

Only `COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` exists (`docs/audits/`). `COMMAND_CENTER_ARC_FOUNDATION.md`, `20260901_CC_SYNC_PASS2_PHASE0_DISCOVERY.md`, `COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md`, `SCOUTING_ASSIGNMENTS_CONCEPT_V1_1.md` and the V1 discovery are absent from every branch and every commit in history. **This report therefore verifies the seed's own claims against code, and cannot check the D-42 → D-51 rulings or the Controller brief's §5.2/§5.3 — the in-repo framework ledger stops at D-21 (`:421`).** Where the seed asserts something those documents establish, it is treated as an unverified claim, not a premise.

---

## 1. Executive verdict

The arc's central assumption — *one field on an existing per-tick record buys both Why? and the receipt ceiling* — is **half right, and pointed at the wrong record.** The rendered-vs-suppressed computation exists and is per-directive; the record it lands on fires once per **flag change**, not once per decision. The genuine per-tick record is `battle.evaluations[]`, it is non-fenced, and a stamp there is inert to everything that reads it.

The bigger news is that **Why? on held positions needs no new write at all.** The model is contractually required to produce a rationale on every hold, and that rationale is already persisted. The blocker was never missing data.

| # | Question | Verdict | Fence | What it gates |
|---|---|---|---|---|
| **Q1** | Per-tick record + the one-field fix | **CONSTRAINED** | **NOT FENCED** | D-44 Why?, §8.2 ceiling, D-49 |
| **Q2** | Model output on holds | **FOUND** | **NOT FENCED** | Why? beyond the absence state |
| **Q3** | Check completion as a boundary | **CONSTRAINED** | **NOT FENCED** | D-48 the turn, cockpit as-of |
| **Q4** | Replaced-directive recovery | **FOUND** (a) / **NOT FOUND** (b) | **NOT FENCED** | D-51 `Replaced` |
| **Q5** | Directive → position map | **NOT FOUND** | **NOT FENCED** (fenced if per-row) | Row marks, Controller §5.3 |
| **Q6** | Which swap path produced a trade | **CONSTRAINED** | **NOT FENCED** (calls fenced helper) | Honest tape copy |
| **Q7** | Battle View as re-composition | **FOUND** | **NOT FENCED** | Controller build size |
| **Q8** | Structured write from the dashboard | **NOT FOUND** (a) / **FOUND** (b,c) | **NOT FENCED** (+ concept risk) | D-46 cockpit verb |
| **Q9** | "Show it" inputs | **CONSTRAINED** | **NOT FENCED** | Controller §5.2, assignments |
| **Q10** | Assignment P1 — the rank tie | **CONSTRAINED** | **NOT FENCED** via the endpoint | D-50 |
| **Q11** | Assignment P2 — swap possibility | **CONSTRAINED** | **NOT FENCED** | D-50 |
| **Q12** | Preference kind + server-initiated ask | **NOT FOUND** (a, c) / **CONSTRAINED** (b) | **NOT FENCED**, most contact-prone | D-50 |
| **Q13** | The dead render as receipt UI | **NO — premise refuted** | **NOT FENCED** | Floor build size |

**The highest-leverage non-fenced build in the arc is Q1's Heard stamp on `battle.evaluations[]`.** The cheapest is Q2's Why? panel, which needs no write.

---

## 2. Findings

### Q1 — The per-tick record and the one-field fix · CONSTRAINED

**In game terms:** the game can already prove a directive was *silenced*. It has nothing durable that proves one was *heard* — and the record that knows the difference only writes when you flip a feature flag, which in normal play is never.

**(a) The per-tick record.** It is `battle.evaluations[]`, an array field on `agentBattles/{battleId}` — not a subcollection. One entry per evaluated tick, keyed by `evalId` (`eval_NNN`, minted at `api/cron/agent-evaluate.js:2042`). Fields at `agent-evaluate.js:2628-2668`: `evalId, timestamp, day, battlePhase, decision, symbolOut, symbolIn, tier, rationale, hypothesis, conviction, riskAssessment, ignoredDirectiveIds, directiveThreadId, trade_reasoning, citedForgeRules, overriddenForgeRules, triggers, scores{active,banked,total}, validationErrors, downgraded, marketPosture, guardrailOverrides, guardrailSourceNote, haikuError`. Composed at `:2710` (`.slice(-150)` cap) and written by the single call `await battleRef.update(finalUpdate)` at **`:2796`** — the last state write of the tick.

**The brief's record is not this one.** `battle.controlEpochLog` is gated by `shouldLogControlEpoch` (`api/_utils/controlSuppressionTelemetry.js:51-55`), whose key comes from `computeEpochKey` (`:36-41`) — derived from **three mode flags only** (`archetypeIntegrityMode`, `standingLeansEnabled`, `tempoDialEnabled`). The module says so itself at `:19`: *"ONE event per battle + MODE-EPOCH — not per tick."* In steady state it writes **zero** times per tick. It also fires at `agent-evaluate.js:1304`, ~1,500 lines and several early-returns *before* any prompt is assembled.

**(b) The two functions.** `buildControlEpochEvent` is defined at `controlSuppressionTelemetry.js:80` and **does** compute per-directive rendered-vs-suppressed, keyed by `directiveThreadId`: `effective: reason ? 'suppressed' : 'rendered'` at `:111` (directives) and `:127` (leans). `resolveControls` is defined in `api/_utils/controlPromptRenderer.js`; `recordControlEpochIfNeeded` (`:187`) calls it at `:202` and hands the result to the event builder at `:209`.

**The brief's "suppressed is durable, rendered is only logged" — CONFIRMED, and here is the exact line.** `buildControlEpochLogEntry` (`:156-170`) projects the event down to `{epochKey, modes, suppressedDirectiveIds, suppressedLeanIds, at}` — it keeps only `.filter(c => c.effective === 'suppressed')` (`:159-166`). The full event, `rendered` included, is `console.log('[ControlEpoch]', …)` at `:222` and then discarded. The durable write is `battleRef.update({ controlEpochLog: arrayUnion(entry) })` at `:234`.

**Is `rendered` in scope at the durable write? Yes** — same function, `event.controls` is live at `:221` where `buildControlEpochLogEntry(event)` is called. But this is the *epoch* write, not a per-tick one. For a per-tick stamp the value must be **recomputed in the cron**: the resolution the deciding prompt is actually built from never leaves the fenced assembler (`api/_utils/agentEvalPromptAssembly.js:1129-1135`).

**(c) Fence status — the crux. NOT FENCED.**

| File | Status |
|---|---|
| `api/cron/agent-evaluate.js` | **NOT FENCED** — carries the recompute + the new key |
| `api/_utils/controlSuppressionTelemetry.js` | **NOT FENCED** |
| `api/_utils/controlPromptRenderer.js` | **NOT FENCED** (self-described "fence-adjacent", `:4`) |

`controlEpochLog` does **not** appear in the fenced `api/_utils/agentBattleService.js`, so a field there is not `createAgentBattle` doc-shape contact. And a new key on the evaluation entry is **behaviourally inert**: the two readers that matter both ignore unknown fields — the fenced `agentEvalPromptAssembly.js:1284-1297` (`formatRecentEvals`) reads a fixed whitelist (`timestamp, decision, symbolOut, symbolIn, tier, rationale, hypothesis, evalId`), and `api/_utils/agentTriggerGate.js:22-30` reads only `evaluations.length`. **This is the highest-leverage non-fenced build in the arc.**

**(d) Keying and the verb.** Per-directive by `directiveThreadId`, per-tick by `evalId`. It supports exactly one verb: **Heard** — *this directive's text was in the deciding model's prompt on this tick*. It does **not** support *the agent held because of it*. The only "because" that exists is the model's own echo (`directiveThreadId` at `agentEvalToolSchema.js:67-71`), which is self-report and fires on trades only.

> **The one field is real, non-fenced, and worth building — on `battle.evaluations[]`, not on `controlEpochLog`.** "Both Why? and the ceiling" from one write does not hold: Why? needs no write (Q2), and the ceiling needs this one.

---

### Q2 — Model output on holds · FOUND

**In game terms:** the agent is *required* to explain every hold, it does explain every hold, and we already save what it says. What a quiet hold skips is the *status feed*, not the reasoning.

**(a) The schema.** `api/_utils/agentEvalToolSchema.js` exposes exactly one tool, `submit_trade_decision` (`:5`). Its `required` array (`:10`) is `['decision','rationale','conviction','hypothesis','riskAssessment']`. `decision` is `enum: ['HOLD','SWAP']` (`:13-14`). **`rationale` is REQUIRED on a HOLD** — described at `:38-42` as *"Your inner monologue. First person, in character. Reference specific numbers. 3-5 sentences."* So are `hypothesis` (a falsifiable prediction, `:43-47`) and `conviction` (`:48-53`). **The model does not return nothing on a hold. It returns a lot.**

**(b) Where it goes — it is persisted, not discarded.** `rationale` lands on the evaluation record at `agent-evaluate.js:2637` and is written at `:2796`. It is *also* mirrored to the GCS shadow stream via `logEvaluation(...)` at `:2685-2704`.

What the quiet hold genuinely does not write is a **statusFeed** entry. The gate is `agent-evaluate.js:2587`: `} else if (haikuResult?.status_feed_update || decision === 'SWAP') {`. And the schema instructs the model to omit that field when nothing happened — *"Only generate when something meaningful happened … Omit if nothing noteworthy"* (`agentEvalToolSchema.js:75`). That is the whole mechanism behind "a quiet HOLD writes nothing".

**(c) Fence and minimum write. NOT FENCED — and the minimum write is none.** The rationale is already durable. The render half is also already there: `src/components/Agent/StatusFeedTimeline.jsx:67` already carries `case 'hold':`. **Why? on held positions is facts-plus-reasoning today, not facts-only, and it needs no founder ruling.**

> **HAZARD — this is the one thing that can make the Why? panel lie.** Seven sites downgrade a model SWAP to a persisted HOLD *after* `haikuResult` is fixed — `agent-evaluate.js:2129, :2144, :2152, :2163, :2217, :2223, :2465` — and **none of them rewrites `rationale`.** On those ticks the record reads `decision: 'HOLD'` while `rationale` is still the model's argument *for* a swap that never happened. Rendering it under a "held" label is a BUILD_RULES §9 display-agreement break. It is detectable: `downgraded` (`:2658`) and `validationErrors` (`:2657`) ride the same record. **Any Why? build must branch on `downgraded` before showing `rationale`.**

---

### Q3 — Check completion as a snapshot boundary · CONSTRAINED

**In game terms:** "a check just finished" is a clean, trustworthy moment — everything the player would read lands in one atomic write. What the game cannot tell you is when a check was *missed*, or which check the cached copy is showing.

**(a) `lastScoredAt` is effectively the boundary.** Set at `agent-evaluate.js:881`, inside `scoreUpdate` (built at `:876`), which is spread into `finalUpdate` at `:2720` and written by the single `await battleRef.update(finalUpdate)` at `:2796` — the same atomic update that carries `evaluations`, `statusFeed`, `scoreState.*`, `cronState.*` and `thresholdHistory`. **A client that observes `lastScoredAt` change sees a fully consistent snapshot.** The only later write is the lock release at `:2800`, which is `.catch(() => {})` fire-and-forget and is not client state.

**Two caveats that matter.** The CPU-passive early return at `:908-921` (`battle.isCpu === true`) writes `scoreUpdate` **alone** and returns — `lastScoredAt` advances with no evaluation. Four more early returns do the same (`:1802` pending proposal, `:1819` pending gameplan, `:1859` gameplan trigger, `:1938` trigger gate declined). **`lastScoredAt` means "the tick ran", not "a decision was made".**

**(b) Subscription — FOUND.** Real-time listeners exist: `src/hooks/useMyTournamentBattle.js:42-50` holds an `onSnapshot` over an `agentBattles` query and spreads the whole doc; `src/hooks/useAgentBattleId.js:33` does the same for id resolution. There is also a genuine **per-tick durable subcollection doc** nobody had catalogued: `agentBattles/{battleId}/shadowDiffs/{tickId}` (`api/_utils/shadowAssemblyCapture.js:243-248`), keyed `${cronStartIso}_${battle.id}` (`:105`) — a per-check id, written under `SHADOW_ASSEMBLY_ENABLED` (true, `featureFlags.js:1343`). The **dashboard**, by contrast, polls: `getDocs` at `src/App.jsx:3924`, `setInterval(fetchAgentBattles, 120_000)` at `:4006`.

**(c) Missed vs failed check — CONSTRAINED.** A *failed* check is explicit: `cronState.cronErrors` (≤20, `agent-evaluate.js:2762`) and `cronState.consecutiveEvalFailures` (`:2745`), plus a `statusFeed` entry `action: 'eval_degraded'` on a degraded tick (`:2677`). A **missed** check has no marker — the only path is a gap since `lastScoredAt` beyond cadence + grace. The cadence is `*/15 13,14,…,21 * * 1-5` (`vercel.json`, `/api/cron/agent-evaluate`).

**(d) Late-day as-of — CONSTRAINED.** The cache doc carries `updatedAt: FieldValue.serverTimestamp()` (`api/cron/voice-layer-cache.js:817`) — **the time the cache was built, not the check it reflects.** It carries no eval reference and no `lastScoredAt` copy. A surface can honestly say "cache built at T"; to say *"as of the 3:45 check"* it must join to the battle doc's `scoreState.lastScoredAt`. The one-hour lag is structural: cache hours are `13-20`, eval hours `13-21`.

---

### Q4 — Replaced-directive recovery · FOUND (a) / NOT FOUND (b)

**In game terms:** you can always show the player exactly what their old directive said and when they wrote it. You can never truthfully tell them *"your agent never saw it."*

**(a) Recoverable — FOUND.** The exchange record is built at `api/agent/chat.js:571` and carries the directive **in full**: `directive: { text, expiry, directiveThreadId, adjustmentId?, canonicalTextVersion? }` at `:576-591`, a sibling `directiveThreadId` at `:592`, and `timestamp: new Date().toISOString()` at `:595`. It is appended durably via `chatExchanges: FieldValue.arrayUnion(exchange)` at `:618`. **Prior text + threadId + timestamp are all recoverable.** (Bounded, not unbounded: the per-battle chat budget caps how many directive-bearing exchanges can ever exist.)

**(b) Proving it was never seen — NOT FOUND, and the obvious workaround is unsound.** There is no consumed-flag, no tick counter, no epoch id on the directive. `controlEpochLog` records only *suppressed* ids and only on a mode change (Q1). That leaves comparing the exchange timestamp against `scoreState.lastScoredAt` — **and that comparison is racy.**

> **HAZARD — the tick reads a stale directive.** `battle` comes from the cron run's initial query snapshot. Inside the per-battle transaction, `agent-evaluate.js:562-571` deliberately refreshes **only** `controlEpochLog` and `regimeAtStart` from the transaction's own read — its comment names exactly this bug class. `battle.directive` is **not** refreshed, and the fenced assembler renders from that same stale object (`agentEvalPromptAssembly.js:1129`). A directive filed or replaced between the run's initial query and this battle's tick is invisible to that tick, and a replaced directive can still be rendered. **So `lastScoredAt` does not bound what the model saw, and Q1's `rendered` stamp is the only sound path to `Replaced`.**

Also: `chat.js:617` is a plain `update` computed from a snapshot read ~420 lines earlier at `:191` — latest-wins with no compare-and-set, confirming P-1a/b.

---

### Q5 — Directive → position map · NOT FOUND (rows carry no mark)

**In game terms:** every directive the player can give is about *how the agent plays*, never about a named stock. There is no way to pin one to a row.

**(a) No symbols in the allowlist.** `src/data/archetypeAdjustments.js` contains **zero** occurrences of `symbol` or `ticker`. The 46 canonical entries across six archetypes are method-level strings — `{ id: 'TF-01', canonical: 'Prefer fresh breakouts over extended / late-stage entries', canonicalTextVersion: 1, policy: {…} }` (`:62`), `'Tighten the downside stop'` (`CN-03`, `:88`). The `policy` block carries `riskDirection`, `concentrationDirection`, `timeHorizonDirection`, `coreAlignment`, `forbiddenOpposite` (`:28-33`) — direction, never a name. No templating, no interpolation, no symbol slot.

**(b) `resolveControls` names no positions.** Its output feeds `renderDirectiveBlock` (`api/_utils/controlPromptRenderer.js:213-220`), which emits the directive text and its threadId and nothing position-shaped.

> **Rows carry no directive mark. The mark can only live on the score header / book level.**

The single symbol-adjacent link is the model's own echo — `directiveThreadId` on a **trade** (`agentEvalToolSchema.js:67-71`, instruction at `controlPromptRenderer.js:218`) — an influence claim about a trade, not a mark on a position. A second, position-conditioned relationship exists but is also self-report: the fenced survival-mode paragraph (`agentEvalPromptAssembly.js:192`) grants the model permission to override a directive on a breaching position and set `ignoredDirectiveIds`.

---

### Q6 — Which swap path produced a trade · CONSTRAINED

**In game terms:** the tape can always say *why* a position was closed. It cannot always say *which mechanism* pulled the trigger — and the one pair it confuses is exactly the pair the player cares about: "your Coach approved this" versus "the clock ran out and it fired anyway."

**(a) There IS a source field.** The trade record `closedTrade` (`api/_utils/agentSwapExecution.js:255-273`) carries no intrinsic path marker, but `...evaluationMetadata` is spread into it at `:270`, and every call site stamps `buildSwapReceiptSource({ source, archetype })` — defined in the **fenced** `api/_utils/agentRiskManager.js:569`, which BUILD_RULES §1 permits calling. `trades` is appended at `agentSwapExecution.js:354` (cap 50) and written at `:367`.

There are **seven** receipt stamps, not six — `agent-evaluate.js:1561, :2272, :2542, :3011, :3217, :3527, :3781`, pinned by `agent-evaluate.test.js:955-956` (`expect(receiptSpreads.length).toBe(7)`). Six are execution sites; `:2542` stamps **proposal creation**, which executes nothing.

| # | Path | `executeSwapServer` | `source` | `exitReason` |
|---|---|---|---|---|
| 1 | Risk-forced | `:1610` | `'risk_manager'`, or `'archetype'` when stagnation (`:1540`) | `riskResult.reason` |
| 2 | Model decision | `:2309` | `'haiku'` if discretionary, else `'guardrail'` (`:2237`) | `haikuSwapReason` |
| 3 | Approved proposal | `:2997` | `'haiku'` (`:3011`) | `'haiku_decision'` |
| 4 | Expired auto-execute | `:3208` | `'haiku'` (`:3217`) | `'haiku_decision'` |
| 5 | R11 suppression pass | `:3568` | `'guardrail'` (`:3527`) | `deterministicExitReason` |
| 6 | Gameplan rotation | `:3771` | `'gameplan_meeting'` (`:3781`) | `'gameplan_rotation'` |

**(b) Inference is exact for four paths and collides on one pair.** Paths 1 and 6 are uniquely identified by `source`. Paths 2-guardrail and 5 share `source: 'guardrail'` but separate on `entryConviction`, on `rationale` (path 5 stamps a template, `:3516`), and on `evaluationId` shape.

> **COLLISION — paths 3 and 4 are byte-identical in the trade record.** Both synthesize the same floor `{...buildSwapReceiptSource({source:'haiku'}), entryPreset, entryMode, exitReason:'haiku_decision'}` (`:3011-3014` and `:3217-3220`) and both then spread `proposal.evaluationMetadata` from the same proposal-creation code. **Nothing on `trades[]` distinguishes "the Coach approved this" from "it auto-executed on expiry."** The distinction exists only in the statusFeed message — `"Coach approved: Swap …"` (`:3026`) versus `"Auto-executed: Swap … (proposal expired, Co-Pilot mode)"` (`:3232`).

So: attribution copy may key off `source` for paths 1, 2, 5, 6; for 3-vs-4 it must read the statusFeed message or say only `Acted`.

---

### Q7 — The Battle View as re-composition · FOUND (small build)

**In game terms:** the Battle View is already one controller that owns every read and hands three dumb bodies their props. Showing all three at once is a layout change, not a data rebuild.

**(a) Structure.** `TAB_KEYS = ['matchups', 'command', 'gametape']` (`src/screens/agentBattleTabs.js:14`); labels from `tabLabels()` (`:29-35`), where `'command'` reads **"Huddle" only when `COMMAND_CENTER_SYNC_ENABLED`** — so at HEAD (`main`, flag `false`) it still reads "Command Center". `activeTab` is plain `useState('matchups')` (`AgentBattleScreen.jsx:408`); `TabBar` at `:331`; bodies render at `:988` (matchups), `:1023-1037` (command → `AgentChat`). All data comes from one hook, `useAgentBattle(agentBattleId)` (`:444`).

**(b) The row's proximity numbers are client math.** `% to Bust` / `% to Bagger` are computed live in the row component from prices and `baseATR`, not read from a server field. The persisted, comparable sources are `thresholdHistory.{symbol}` (written every tick at `agent-evaluate.js:899`) and `voiceLayerCache.portfolioBriefs[].thresholdProximity` (built at `voice-layer-cache.js:260-271`). **For "closest to a tier", the cockpit should read `thresholdProximity` from the cache — one source, per §9 — and must not re-derive it beside a rendered number.**

**(c) Portability.** `LiveActivityPanel` is plain-props portable, proven by the Desk, which takes a single adapter object: `AgentDesk({ sync, accent })` (`src/components/Dashboard/desk/AgentDesk.jsx:73`), destructuring `{ phase, lastCheckedAt, nextDecisionAt, scoreProximity, swapLock, statusFeedLatest }` at `:76`. `AgentChat` is snapshot-mountable, **with one side effect to know about**: it POSTs `/api/agent/ensure-opener` on mount under `OPENER_LAZY_FALLBACK_ENABLED` (`AgentChat.jsx:502-534`).

**(d) Almost nothing breaks.** There is **no router in the application at all** — stated and verified at `agentBattleTabs.js:6-10` ("not persisted … no localStorage, no Firestore field, no analytics event — and this app has no router"). No `useEffect` in the screen takes `activeTab` as a dependency (only two exist, `:108` and `:527`).

> **HAZARD — one coupling, and it is subtle.** `AgentBattleScreen.jsx:449-451` runs `lastSeenFeedLengthRef.current = statusFeed.length` **during render**, gated on `activeTab === 'command'`. It is the only thing that clears the unread dot. Remove the tab bar and the dot never clears.

---

### Q8 — A structured write from the dashboard route · NOT FOUND (a) / FOUND (b, c)

**In game terms:** the cockpit card can already talk to the agent from the dashboard — every ingredient is there. What it cannot do is leave an instruction *without* spending a message and getting a reply.

**(a) No model-free directive write — NOT FOUND.** `api/agent/chat.js:626` is the **only** writer of `battle.directive` in the repo. It sits inside the same `await battleRef.update({…})` opened at `:617` that carries `chatExchanges: FieldValue.arrayUnion(exchange)` (`:618`) and the budget increment (`:623`), and the whole block is downstream of `callGemmaVoice` at `:397` and `parseVoiceLayerResponse` at `:408`. The exchange the write depends on is built from `parsed.response`. **There is no reachable path to the slot without the model turn.**

**Minimum non-fenced write (one sentence, not a design):** a new endpoint under `api/agent/` that validates the text through the existing `directiveGate.js` and writes only `battle.directive` plus an exchange-shaped audit entry, charging no message budget.

**(b) The dashboard has everything — FOUND.** `POST /api/agent/chat` requires `{ agentId, battleId, message }` (`chat.js:168`, enforced at `:175-177`) plus bearer auth. **League's arena is the existence proof of this call from a non-Battle-View route:** `src/components/League/battleArena/useArenaEngine.js:87-89` posts `{ agentId, battleId, message: text, leagueAsk: true }` through `fetchWithAuth`. On the dashboard, `agentId` and `battleId` are both on the battle objects `App.jsx` already polls into `activeAgentBattles` (`:3924`, `:4006`), and the auth singleton is the same one `useAgentBattleId.js:22` uses.

**(c) `AgentChat` mounts snapshot-driven** — its dependencies are props and the battle doc, with the `ensure-opener` mount effect noted above; no Battle-View route state, because there is no router.

> **Concept-fence warning:** any **new top-level battle-doc key** is `createAgentBattle` doc-shape contact (`api/_utils/agentBattleService.js`, FENCED) and a §7 STOP. A minimum write that reuses `directive` and `chatExchanges` avoids this; one that invents a new top-level field does not.

---

### Q9 — "Show it" inputs · CONSTRAINED

**In game terms:** the research turn can only answer about the nine names the agent is actually holding. Point it at a bench name and it 404s.

**(a) Shape and the guard.** `api/agent/debate.js:203-215` returns `{ success, battleId, targetSymbol, userStance, debate: { agentResponse, citedIndicators, citedStrategy, conviction, suggestedAction } }`. The guard is `:88-90`, and **"portfolio" means the BOOK ONLY**: `:84-85` calls `flattenPortfolioServer(portfolio)`, which flattens `star`, `core`, `support` and nothing else (`api/_utils/agentScoring.js:36-51`). A sibling `flattenBenchServer` exists at `:57` — and `debate.js` does not import it (its only scoring import is `flattenPortfolioServer`, `:5`).

> **The bench is OUTSIDE the guard.** The hopeful reading in the seed — *"if the bench is inside the guard, assignments can use `debate.js` for both names as-is"* — is **refuted**. An assignment naming a bench candidate cannot use `debate.js` today.

**(b) Widening is NOT FENCED.** `api/agent/debate.js` is not on the fence list, and the function a widened guard needs — `flattenBenchServer` — is *already exported* from the fenced `agentScoring.js:57`, so widening only **calls** fenced code, which §1 permits. No founder ruling required.

**Additional build cost:** the DebateModal entry point is not reachable from the live battle screen (`handleChallenge` has no rendered caller), so wiring an entry point is part of the work, not a given.

**(c) `nextDeployCandidates` — NOT FOUND**, confirmed by two independent repo-wide greps. `EquipBench.jsx` does not exist; the real equip surface is `api/agent/equip-watchlist.js` with `api/_utils/watchlistEquip.js`, and the equipped tickers reach a live battle by being unioned into the hot bench mid-tick (`agent-evaluate.js:1013-1024`).

**(d) Signal Drop — no battle read path.** A completed drop persists a watchlist; the only downstream read is cosmetic provenance — `src/utils/watchlistProvenance.js:26` reads `watchlist.sourceDropId` to label a card. No thesis and no related tickers reach a battle route.

---

### Q10 — Assignment predicate P1: the rank tie · CONSTRAINED

**In game terms:** you can ask right now how close two names are — the board hands back a number per name. What you cannot do is find out how *often* that happens, because nothing keeps a record.

**(a) Computed per request, never stored.** `api/agent/scouting-board.js:86` reads one shared doc, `indexIntelligence/stockRankings`; `:113` calls `computeArchetypeRankings(stocks, archetype)` on the fly. The module header states it performs **no Firestore writes** (`:5-10`). Nothing is persisted per battle or per agent.

**(b) Distance is readable, in points.** Every row carries `archetypeScore` (`:123`, `:141`) — a weighted composite **clamped to 0-100 and rounded to one decimal** (`api/_utils/archetypeScoring.js:134-135`), sorted descending (`:139`). So "within 2.0 points" is a subtraction. It is timestamped via `asOf` (`:89`, `:155`), taken from the rankings doc's `computedAt`. `SCOUTING_BOARD_ENABLED = true` (`featureFlags.js:900`).

**(c) Reading it trips nothing.** `scouting-board.js:18` imports `computeArchetypeRankings` from the **fenced** `api/_utils/archetypeScoring.js` — read/call, which §1 permits — **and `api/agent/scouting-board.js` is already recorded in `api/_utils/archetypeImportBoundaryBaseline.json:30`**, so the §2.3 import-boundary ratchet is already satisfied for this path. Consuming the ranking **through the existing endpoint is free**. A *new direct importer* of `archetypeScoring.js` would trip the ratchet and must be added to that baseline in the same commit.

**Scope caveat:** the board ranks today's **stock universe plus the equipped watchlist** — not a battle's bench. P1 as written ("two bench names") is not what this endpoint answers.

**(d) NOT MEASURED — and structurally so.** Because the ranking is computed per request and never stored, there is no history to measure margin frequency against. This is not "un-run"; it is "no data exists".

---

### Q11 — Assignment predicate P2: swap possibility ahead of a check · CONSTRAINED

**In game terms:** you can honestly say *"a swap involving this name is not currently forbidden."* You cannot say *"a swap is possible"* — that is decided inside the tick by live prices and the model's own conviction.

**(a) The real gates.**

| Gate | Where | Readable before T? |
|---|---|---|
| `symbolIn` in bench or `watchlist.hotBench` | `agentSwapExecution.js:44-47` | **Yes** — `battle.portfolio.bench`, `battle.watchlist.hotBench` |
| 24h cooldown (bench only; hotBench exempt) | `agentSwapExecution.js:59-64` (error at `:62`); set at `:320` | **Yes** — `bench.stocks[].cooldownUntil` |
| Swap cap per window | `getRecentSwapCount` (`agentRiskManager.js:513`) vs `hftConfig.swapWindow.capPerWindow`, blocking at `agent-evaluate.js:2212-2222` | **Yes** — `battle.trades[]` + static archetype config |
| Sector cap | `checkSectorCap` (`agentGuardrails.js:773`), gated at `:356-367` | Partly — depends on the incoming name's sector |
| `lockedPositions` | `agent-evaluate.js:1242`, filled `:1378`, blocks `:2142` | **No** — per-tick, in-memory |

> **The orange-zone `swapLock` does NOT gate the agent.** `isSwapLocked` (`api/_utils/agentScoring.js:172`) is called only by `api/cron/voice-layer-cache.js:260` (display/prompt) and by the **user-side** BaggerBomb surfaces (`src/screens/BaggerBombBattleView.jsx:567`, `BaggerBombTrainingBattleViewV4.jsx:670`, `src/services/swapServiceV4.js:121`, `src/components/freeAgency/shared/useSwapLogic.js:79`). Neither `agent-evaluate.js` nor `agentSwapExecution.js` calls it. **For the agent it is descriptive, not restrictive** — a cockpit that says "locked, so no swap" would be wrong about the agent.

**(b) The predicate is CONSTRAINED.** Three of the five gates are persisted and readable ahead of T. What is not knowable before the tick: live prices (which decide risk-forced exits), a mid-tick rankings read that can add brand-new names to the hot bench, `lockedPositions`, and the model's conviction. **The honest residual is "not currently forbidden", never "will be possible", and the concept must be worded that way.**

---

### Q12 — Preference kind and the server-initiated ask · NOT FOUND (a, c) / CONSTRAINED (b)

**In game terms:** the game can say "do this" or "lean this way", but it has no way to say *"prefer NVDA over AMD"*, no receipt for a preference the agent saw and passed on, and no way to reach the player when the app is closed.

**(a) No two-symbol preference — NOT FOUND.** Nothing in the allowlist (`src/data/archetypeAdjustments.js`, Q5) or the gate expresses a weak preference between two named symbols. There *is* a hardness dimension elsewhere (`api/agent/set-rule-hardness.js`, the tempo dial, standing leans), and there *is* a live named-symbol soft preference — the **equipped watchlist**, whose tickers are unioned into the hot bench mid-tick (`agent-evaluate.js:1013-1024`) — but it is a membership signal, not a comparison, and `submit_trade_decision` has no field that would echo one back as a floor receipt. The nearest considered-and-declined receipt is `overridden_forge_rules` (`agentEvalToolSchema.js:147-152`, reasons enum incl. `higher_priority_opportunity`), which is for Forge rules, not symbols.

**(b) The server-initiated pattern exists, but it is pulled, not pushed — CONSTRAINED.** `api/agent/ensure-opener.js` is explicitly **NON-FENCED** (`:8`). It is an HTTP handler (`:113`) triggered by the client on mount, idempotent via `messageType === 'first_message'` (`:51-53`), with a template floor when the model budget runs out (`:247`), writing `chatExchanges` and `statusFeed` in one transaction (`:273-276`). A **due-timed** ask needs three things it does not have: a scheduler, a durable "ask is due" marker, and a delivery route.

> **Cron budget correction.** BUILD_RULES §6 states "37/40 schedule entries used … may add at most 2". `vercel.json` carries **39** entries at HEAD (counted by parsing the `crons` array). **The §6 allowance is already spent; one slot remains.** §6's own advice — "prefer branching inside existing handlers over new entries" — is now the only option.

**(c) Push / notification infrastructure — NOT FOUND.** Exhaustively searched and confirmed twice: `public/` contains only `vite.svg` (no service worker); zero hits across `src/`, `api/`, `index.html` and `package.json` for `firebase/messaging`, `getMessaging`, FCM, `web-push`, VAPID, OneSignal, `expo-notifications`, `navigator.serviceWorker`, `new Notification(` or `Notification.requestPermission`. **A due-timed ask cannot reach a closed app.**

---

### Q13 — The dead render as the cheapest receipt UI · **NO** — the premise is refuted

**In game terms:** the thing the brief found is not a card the player sees. It is a line of text we write *for the agent to read*.

`directiveOutcomes` and `liveDirectives` appear at exactly **four code lines in the whole repo**, all in one file: `api/_utils/voiceLayerPrompt.js:2116-2119`, inside `buildReviewContext()`. That function returns `` `REVIEW CONTEXT:\n${lines.join('\n')}` `` (`:2130`) and the block it builds is headed `DIRECTIVE OUTCOMES (live-play directives and how they played out):` (`:2127`) — **a server-side prompt string for a model.** The file is registered as a prompt-contributing module at `api/_utils/__fixtures__/promptHonestyRegistry.js:51`. There is **no UI component anywhere in `src/`** that reads either name.

**Shape it expects:** `{ text | directive, outcome | followed, resultPoints }` (`:2120-2127`), last 5 only. **Writer:** none — confirmed by repo-wide grep.

> **Answer: NO.** Filling that shape feeds the **model**, not the player. A user-facing receipt still needs a UI. And the honest cheapest path is not a new ledger component either: the **Filed** and **Acted** receipts already ship inside the battle chat — `"DIRECTIVE LOCKED IN"` at `src/components/Agent/AgentChat.jsx:117` and `"↳ from directive"` at `:925`. Extending that surface with `Replaced` and `Expired` is smaller than either alternative. (`Replaced` is recoverable per Q4a; note Q4b's limit on what it may claim.)

**Fence:** `voiceLayerPrompt.js` — NOT FENCED, but it **is** on the DR-13 prose registry, so any change to what it renders is swept by the prose-honesty tripwire.

---

### Q14 — Fence check, one line per question

| Q | A build would touch | Fenced? |
|---|---|---|
| Q1 | `agent-evaluate.js`, `controlSuppressionTelemetry.js`, `controlPromptRenderer.js` | **No.** `controlEpochLog` absent from `agentBattleService.js` → no doc-shape contact |
| Q2 | `agent-evaluate.js:2587`, `StatusFeedTimeline.jsx` (already has `case 'hold'`) | **No** — and no write needed |
| Q3 | `agent-evaluate.js`, `voice-layer-cache.js`, `baggerbombAdapter.js`, hooks | **No** |
| Q4 | `chat.js`, `directiveUtils.js`, `AgentChat.jsx` | **No** |
| Q5 | `archetypeAdjustments.js`, `directiveGate.js`, `controlPromptRenderer.js` | **No** for a header mark. **A per-row mark contacts the fenced row shape (`agentScoring.js`)** |
| Q6 | `agent-evaluate.js` (the seven receipt literals) | **No** — `buildSwapReceiptSource` is *called*, not edited |
| Q7 | `src/screens/*`, `src/components/Agent/*`, `src/components/BaggerBomb/*` | **No** — entirely `src/` |
| Q8 | `chat.js`, `chat-budget.js`, `App.jsx`, dashboard components, `firestore.rules` | **No** — but a **new top-level battle-doc key is `createAgentBattle` contact → STOP** |
| Q9 | `debate.js`, `DebateModal.jsx`, `AgentBattleScreen.jsx` | **No** — `flattenBenchServer` already exported from fenced `agentScoring.js:57` |
| Q10 | `scouting-board.js` + consumers | **No**, and already in the ratchet baseline (`:30`). A **new direct importer of `archetypeScoring.js` trips §2.3** |
| Q11 | `agent-evaluate.js`, `agentTriggerGate.js`, `baggerbombAdapter.js`, desk components | **No** — every gate is readable via already-exported functions |
| Q12 | `directiveGate.js`, `agentEvalToolSchema.js`, `ensure-opener.js`, `vercel.json` | **No**, but the most contact-prone: changing what the model emits every tick is trading-brain territory (framework §8.2) |
| Q13 | `voiceLayerPrompt.js`, `AgentChat.jsx` | **No** — but `voiceLayerPrompt.js` is on the **DR-13 prose registry** (`promptHonestyRegistry.js:51`) |

**The two easy-to-miss gates, verified:** (i) `api/_utils/archetypeImportBoundaryBaseline.json` baselines 82 production modules (`:6-87`) — a new direct importer of a legacy archetype table must be recorded there **in the same commit**. (ii) `PROMPT_CONTRIBUTING_MODULES` (`api/_utils/__fixtures__/promptHonestyRegistry.js:46-53`) lists six modules — `agentEvalPromptAssembly.js`, `agentPromptAssembly.js`, `evalIdentityBlocks.js`, `fundamentalsRender.js`, `voiceLayerPrompt.js`, `compositionAdvisoryRender.js`; any module rendering prompt text via the DR-13 split must join that list in the same commit as the fenced splice.

---

## 3. Hazards — restate each as a DO-NOT in the build order

1. **DO NOT treat `battle.controlEpochLog` as a per-tick record.** It writes once per *mode-epoch*; in steady state, never. `controlSuppressionTelemetry.js:19, :51-55`.
2. **DO NOT render `evaluation.rationale` under a "held" label without branching on `downgraded`.** Seven sites downgrade a SWAP to HOLD without rewriting the rationale (`agent-evaluate.js:2129, :2144, :2152, :2163, :2217, :2223, :2465`); `downgraded` is at `:2658`. This is the §9 display-agreement break most likely to ship.
3. **DO NOT infer "the model saw this directive" from timestamps.** The tick renders `battle.directive` from the cron run's initial query snapshot; only `controlEpochLog` and `regimeAtStart` are refreshed inside the transaction (`agent-evaluate.js:562-571`). A stale or replaced directive can still be rendered.
4. **DO NOT read `lastScoredAt` as "a decision was made".** Five early returns advance it with no evaluation entry — CPU-passive (`:908-921`), pending proposal (`:1802`), pending gameplan (`:1819`), gameplan trigger (`:1859`), trigger gate declined (`:1938`).
5. **DO NOT distinguish an approved proposal from an expired auto-execute using `trades[]`.** They write byte-identical receipts (`:3011-3014` vs `:3217-3220`). Only the statusFeed message differs (`:3026` vs `:3232`).
6. **DO NOT tell the player a `swapLock` blocks the agent.** `isSwapLocked` never runs in the agent path; it is display/prompt plus the user-side BaggerBomb UI only.
7. **DO NOT promise "a swap will be possible at check T".** Live prices, a mid-tick hot-bench rebuild and model conviction are all decided inside the tick. Only "not currently forbidden" is honest.
8. **DO NOT point "Show it" at a bench name.** `debate.js:88-90` 404s on anything outside star/core/support (`agentScoring.js:36-51`).
9. **DO NOT add a new top-level battle-doc key.** That is `createAgentBattle` doc-shape contact and a §7 STOP.
10. **DO NOT add a direct importer of a legacy archetype table without updating `archetypeImportBoundaryBaseline.json` in the same commit** (§2.3 ratchet, separate from the §1 fence).
11. **DO NOT plan on a new cron.** 39/40 entries are used at HEAD, not 37.
12. **DO NOT assume a rival cannot see swap attribution.** `PUBLIC_TRADE` strips it (`api/_utils/tournamentBattleView.js:51`), but `PUBLIC_STATUSFEED` explicitly allows `'source'` and `'triggeredBy'` through to a non-owner (`:48`), and the swap feed entry stamps both. This contradicts the own-portfolio competitive-leak posture.
13. **DO NOT build tier-proximity on `thresholdHistory` without accounting for the nightly wipe.** `api/cron/agent-daily-scores.js:174` overwrites `thresholdHistory` wholesale and `:163-166` moves `swapPrice` to `previousSwapPrice` on every tier asset, nightly at `45 1 * * 2-6` UTC (`vercel.json:65-66`).
14. **DO NOT remove the Battle View tab bar without rehoming the unread-dot clear** at `AgentBattleScreen.jsx:449-451` (it runs during render, gated on the `command` tab).
15. **DO NOT re-derive `% to Bagger` beside a rendered number.** The row's value is client math; the persisted comparable is `voiceLayerCache.portfolioBriefs[].thresholdProximity`. Bind label and number to one source by construction (§9).
16. **Note, not a blocker:** `isSwapLocked` exists in two byte-identical copies — `api/_utils/agentScoring.js:172-207` (fenced) and `src/utils/baggerBombUtils.js:244-279`. In sync today; a §4 drift risk.

---

## 4. Memory discrepancy log — attached claims the repo contradicts

| # | Claim | Repo says |
|---|---|---|
| 1 | "The Pass 1 flip PR is open and unmerged" | No PR exists for `claude/cc-sync-flip`. The branch exists with one commit (`dee30fde`). |
| 2 | "P-4 is fixed on the branch, not on `main`" | **P-4 is on `main`** (`9adc51ec`, live at `firestore.rules:704-710`). The flip branch touches only 3 config/test files. |
| 3 | "the D-42 → D-51 ledger entries" | The in-repo framework V1.2 ledger stops at **D-21** (`:421`). D-42–D-51 are not in the repo. |
| 4 | Five of six attached documents | Absent from every branch and every commit in history (see §0.2). |
| 5 | "one field on the existing **per-tick** record" | The record named is per **mode-epoch** (`controlSuppressionTelemetry.js:19`). The per-tick record is `battle.evaluations[]`. |
| 6 | "a returned rationale is discarded" (implied by Q2's framing) | `rationale` is **required** on HOLD (`agentEvalToolSchema.js:10`) and **is persisted** (`agent-evaluate.js:2637`). |
| 7 | "`directiveOutcomes`/`liveDirectives` — a **render** exists with no writer" | It is a **prompt** builder (`voiceLayerPrompt.js:2116-2130`), not a UI. No `src/` reader exists. |
| 8 | "If the bench is inside [debate.js's] guard, assignments can use it for both names" | The bench is **outside** the guard (`agentScoring.js:36-51`). |
| 9 | Q11's premise that `swapLock` gates agent swaps | `isSwapLocked` is never called in the agent execution path. |
| 10 | Q6's premise that no path/source identifier exists | `buildSwapReceiptSource` stamps `source` on **seven** sites (test-pinned, `agent-evaluate.test.js:955-956`). |
| 11 | BUILD_RULES §6: "37/40 schedule entries used" | **39** at HEAD (`vercel.json` `crons`). The "at most 2" allowance is spent. |
| 12 | BUILD_RULES §1 fence list cited as ":14-24" | Correct — verified. (Several agents mis-cited it as `:16-26`; the list is `:14-24`.) |

**Seed §1 "Established" spot-checks — all CONFIRMED:** dashboard polls at 120s (`App.jsx:4006`); `PROFIT_TARGET_EXECUTOR_ENABLED = true` (`featureFlags.js:1845`); `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`:770`); `SHADOW_ASSEMBLY_ENABLED = true` (`:1343`); cache cron stops one hour before the eval cron (hours `13-20` vs `13-21`); statusFeed owner-scoped with a `PUBLIC_STATUSFEED` projection (`tournamentBattleView.js:48`); no `source`/`origin` field on the exchange record (`chat.js:571-605`).

---

## 5. Bugs found outside this task — for separate tasking (BUILD_RULES §3)

Reported, **not fixed**:

1. **`post_decision_downgrade` records nulls.** `api/_utils/shadowAssemblyCapture.js:290` reports `proposedAction: { symbolOut: evaluation?.symbolOut, symbolIn: evaluation?.symbolIn }`, but the evaluation record hard-nulls both once the decision is downgraded to HOLD (`agent-evaluate.js:2630, :2634-2635`). The shadow corpus therefore never captures *what* was proposed on a downgraded tick — the exact case the gate exists to record.
2. **`recentElicitationTargets` lost update.** `api/agent/chat.js:615` computes the array from the snapshot read at `:191` and writes it back whole at `:617` — a latest-wins overwrite on a field two concurrent chat turns can both touch.

---

## 6. STOP

The report is written. **No implementation branch is created from this session; no code was modified; no build or test suite was run.** The founder reads this; rulings follow in the framework ledger; any build is a new task, a new branch, a new session with its own seed set.

Three items need a founder ruling before a build order can be written:

1. **Q1's Heard stamp** is non-fenced and inert, but framework §8.2 says changing what the deciding model is asked to emit is "trading-brain territory in spirit — a founder ruling". A *stamp computed in the cron* (what this report recommends) changes nothing the model emits and may not need that ruling; **a stamp the model fills does.** The distinction is worth ruling on explicitly.
2. **Q12's cron slot.** With 39/40 used, a due-timed ask must branch inside an existing handler, or the ceiling assumption needs revisiting.
3. **Hazard 12** — `PUBLIC_STATUSFEED` leaking `source`/`triggeredBy` to a rival — contradicts the standing competitive-leak posture and is a live surface, not a proposed one.

---

*Prepared September 1, 2026 against `main` @ `bd608373`. 28 agents; 826 citations re-checked adversarially, 41 corrected, 58 claims refuted or narrowed. Every line number in this report was read in this session. Nothing here is a build instruction.*
