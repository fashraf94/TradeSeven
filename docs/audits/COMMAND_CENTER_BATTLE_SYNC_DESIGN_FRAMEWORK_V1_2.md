# Command Center ↔ Battle View Sync — Design Framework V1.2

**Date:** August 31, 2026
**Status:** Design framework, pre-spec. **Supersedes V1.1** (and, through it, V1, Amendment A, Amendment B). Locked items are marked LOCKED. Open items are in §15. All proposed rulings are confirmed (§0). Amended in place Aug 31 (evening) for D-20, D-21, §7.1; **amended Sep 2 with D-42 → D-62 and §15.1 corrections of record**; **amended Sep 2 (evening) with D-63 → D-79** (Phase A2's rulings); **amended Sep 3 with D-80 → D-85** (the A2.3/A2.4 rulings addendum V1.1); **amended Sep 3 (evening) with D-86 → D-90** (the flip-prep seed); **amended Sep 4 with D-91 → D-98** (the A3 character-pane seed, as renumbered by its Phase 0 report §9 and ruled by the Sep 4 rulings) (arc authority now the design chat).
**Prepared by:** Fable (Anthropic), with Flash. Design authority for this arc lives in this chat.
**Commit location:** `docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md`

**Inputs folded into this version:**
- Everything in V1.1 (V1, Amendment A, Sol pass one, Phase 0 discovery, founder rulings of Aug 31, Amendment B with corrections)
- **Sol second pass on V1.1 (Aug 31)** — 2 blockers, 5 majors, 2 advisories; disposition in Appendix C. Verdict: "V1.1: proceed, with targeted corrections." All corrections applied here.

**Companions:** `SOL_REVIEW_BRIEF_COMMAND_CENTER_BATTLE_SYNC_V1.md` · `PHASE0_COMMAND_CENTER_BATTLE_SYNC_DISCOVERY.md` · `DRB_DUAL_LENS_BOOKMARK.md` (C1/C2 origin) · `QUARTERLY_PORTFOLIO_RESTRUCTURE_CHARTER_V1_1.md` (connection model, borrowed) · `COMMAND_CENTER_UNIFICATION_CONTEXT_HANDOVER.md` (three-surface inversion) · `FANTASYTRADES_VOICE_LAYER_PRODUCT_STANCE_V1_1_ADDENDUM_B.md` (evidence-first, Research lane)

---

## 0. Rulings of record

| # | Item | Ruling | By | Date |
|---|---|---|---|---|
| — | Authority line | Agent has 100% execution authority. No veto, no manual trade, no co-pilot. | Founder (standing) | Jun 10 |
| — | Model | Gemma 4 26B stays for this arc. Prerequisite C re-pointed at GPT-5.6 Luna + GLM-5.3-Flash, runs in parallel, off this arc's critical path. | Founder | Aug 30 |
| — | Vision | Command Center is the Voice Layer home for all games. BaggerBomb first. Shell is game-agnostic; games are adapters. | Founder | Aug 31 |
| — | Design authority | One chat. Parallel outputs come here as input and are adjudicated, not appended. | Founder | Aug 31 |
| **Duration** | Beta battle length | **Fullday for beta.** 3-day is a fenced constant (`agentBattleService.js:35`, inactive `'legacy'` path) and is its own gated ruling (D-14). Phase model is duration-agnostic so the flip changes nothing here. | Founder ("either is fine") + Fable lean | Aug 31 |
| **D-2** | Dual surface vs collapse | **Dual surface.** Battle View keeps its chat; Dashboard gains the Desk (Pass 1) and Talk It Over (Pass 2). Layout via Claude Design *after* §3 adapter shape is fixed. Makes P-1 a hard prerequisite. | Founder | Aug 31 |
| **D-4** | Budget | **10 per day.** Equals current per-battle behavior under fullday. Under 3-day requires a reset in `chat.js` (budget is cumulative today) — scoped to D-14. | Founder | Aug 31 |
| **D-5** | Entry cards | Five cards per §6.1. "Closest to a trade" and "Why are we holding X" deleted. | Fable, founder deferred | Aug 31 |
| **Opponent** | Dashboard visibility | Dashboard shows the user's own portfolio only. Opponent view stays in Battle View. | Founder | Aug 31 |
| **D-3** | Resting state | Resolved by discovery: distance-to-score via `voiceLayerCache.thresholdProximity`, discrete-check cadence, existing idle copy. §5. | Fable, from Phase 0 | Aug 31 |
| **D-6** | Mid-battle rule proposals | Already structurally suppressed (`chat.js` gates `forgeSuggestions` on `mode==='review'`). Semantic honesty rule (§6.4) covers what the agent *says*. Closed. | Fable, from Phase 0 | Aug 31 |
| **D-9** | Shell + adapter ratified | Ratified by adoption of the vision. §3 rule is LOCKED; §3.2 schema is **provisional** (Sol pass two). | Founder | Aug 31 |
| **D-13 (proposal)** | Front-door gate timing and Condition 2 ownership | **Proposed, then confirmed below:** the gate applies at **Pass 2**, not Pass 1 — Pass 1 puts no conversation on the Dashboard, so there is nothing for the precedence contradiction to say. Chat-side reconciliation becomes **P-7, a Pass 2 prerequisite**, moved forward from Pass 3. Eval-side stays with exit-behavior Ask 2. | Fable proposal — **founder to confirm** | Aug 31 |
| **D-18 (proposal)** | Directive slot contract | **Proposed, then confirmed below:** `battle.directive` is a **single slot, latest-wins, by declaration.** A new directive supersedes the prior one; the prior is rendered SUPERSEDED in the ledger; both surfaces show the current directive above the composer before send. | Fable proposal — **founder to confirm** | Aug 31 |
| **D-17** | `directiveGate` flag state | Elevated from discovery item to **hard Pass 2 gate.** §6 language corrected to "mechanism exists; live enforcement unverified." | Sol pass two, sustained | Aug 31 |
| **D-13** | Front-door timing / Condition 2 | **Confirmed.** Gate bites at Pass 2; P-7 minimum honest fix; ownership check with harness-revamp first. | Founder | Aug 31 |
| **D-18** | Directive slot contract | **Confirmed.** One slot, newest replaces oldest, visibly. | Founder | Aug 31 |
| **D-20** | Mid-battle watchlist expansion via conversation | **Deferred.** Game-rule change (frozen `agentContext`, fenced; swap universe; player asymmetry). Bookmarked as a possible post-launch *mode*, not a chat lever. | Founder | Aug 31 |
| **D-21** | "Add X" response shape | **Ruled.** Not a dead end. The agent researches the name on request and returns evidence, with next-deploy as the forward path. The Research lane's first thesis type is pulled forward from Pass 4 into Pass 2 as a narrow slice (§7.1). | Founder | Aug 31 |

### 0.2 Corrections applied from Sol's second pass

1. **"Predicts" → "measures."** The Desk measures the scoreboard. Prediction was removed from the design and is now removed from the governing sentence. §5.1.
2. **§11/§12 sequencing contradiction resolved** by D-13 above. §12 now states when the gate bites.
3. **Ledger collapsed to what is provable.** Two-state floor (FILED → HONORED-by-trade / EXPIRED); "Seen" and "not honored" are gated on discovery item 8 finding a real per-directive receipt. §8.
4. **P-1 split** into what the transaction proves (post-close TOCTOU) and what it does not (concurrent-directive survival, budget check atomicity). §10.
5. **P-6 is a liveness prerequisite** — pending UI *plus* guaranteed eventual debrief. §10.
6. **Condition 1 reworded** — shared authoritative truth for overlapping concepts, not a superset. §12.
7. **§3.2 schema marked provisional** — the rule is locked, the field contract is BaggerBomb adapter v1 until the league adapter validates it. §3.
8. **"File this" flagged** as Pass 4's central product experiment. §7.
9. **Messaging rule** — product copy describes what exists now. §12.

### 0.1 Corrections applied to Amendment B on absorption

1. **`gateState` ("what would have to be true for the agent to move") is replaced by `scoreProximity` + `swapLock`.** Discovery found that the persisted, comparable proximity object measures distance to the next *scoring* threshold, not to agent action. Rendering it as action-proximity is the fabricated-certainty failure Sol named. §5.1.
2. **The ledger's "Seen" state has a real receipt for honored directives**, not just timestamp derivation: the control prompt instructs Haiku to echo `directiveThreadId` in `submit_trade_decision`, and `AgentChat` already renders "↳ from directive." Timestamp fallback applies only to not-honored. §8.
3. **Passes 3 and 4 are separate arcs with their own kickoffs after Pass 2 lands.** The shell constraint (§3) is honored in Pass 1 so they are adapters, not rewrites. §11.

---

## 1. Purpose

The Dashboard and the BaggerBomb Battle View are two products that share an agent. Pre-battle the Dashboard is the whole experience; once a battle starts it becomes a scoreboard with a link and everything moves behind a tab bar.

This arc makes them one continuous surface, and — per the Aug 31 vision — makes that surface the Voice Layer home for every game. The Dashboard remains the pre-battle loop; once a battle is live it becomes where the user feels the agent thinking and can influence it, without the agent ever surrendering execution authority.

**Why the unification is worth doing:** the three agent surfaces have inverted properties. Deploy has real archetype force. Eval makes every trade with ~3% archetype content. Chat has the richest personality (~12%), the thinnest state, and no agency. The surface that talks is not the surface that trades. Unifying the UI does not fix that; it moves it to the front door — which is precisely why it is worth doing, **if the fix is sequenced ahead of the promotion** (§12).

---

## 2. The authority line — LOCKED

The agent is 100% responsible for every action. The user influences through conversation and Signal Drop. Nothing in this arc adds a veto, a manual trade, or a co-pilot path. Launch is autopilot-only. Not reopened.

---

## 3. The shell and the adapter — LOCKED (pending Sol)

### 3.1 One shell; the game is an adapter

| Shared across all games | Swapped per game |
|---|---|
| Chat thread (Voice Layer, existing modes) | State adapter (§3.2) |
| Action ledger (§8) | Action vocabulary (§3.3) |
| Agent Desk + resting state (§5) | Phase enumeration (§4) |
| Entry cards (§6.1), derived from adapter state | Next-decision clock source |
| Research lane (§7, Pass 4) | — |

**Tabs are per live battle, not per game type.** Each tab owns its own thread, ledger, and directives. No cross-battle bleed.

**Beta scope rule:** BaggerBomb owns the Command Center. League surfaces (fuse board, arena) stay league. Discovery confirmed a user can hold a ranked battle (real agent) and a BaggerBomb battle (casual clone `casual-agent-{odUserId}`) simultaneously with `CASUAL_CLONE_CONCURRENCY_ENABLED = true`. The concurrent pair is handled by **scope**, not by multiplexing one card between two battles. The Manage-card poll already spans both agentIds (`App.jsx:3913-3917`); the shell filters to the BaggerBomb battle at beta.

**Constraint on Pass 1:** shell components read battle state only through the adapter shape below, even though only the BaggerBomb adapter exists. **No direct document-field reads from shell components.** This is the DO-NOT-VIOLATE line for CC.

### 3.2 Adapter fields — BaggerBomb adapter v1 (schema PROVISIONAL)

**What is locked is the rule: shell components read only through adapters.** What is *not* locked is this field list as the universal contract. Sol's second pass is right that `scoreProximity`, `swapLock`, `book`, `tradeCount`, `recentMotives`, and the shape of `score` are BaggerBomb concepts wearing generic names. Putting them behind an adapter is better than reading documents directly; it does not by itself make the shell game-agnostic. **The abstraction is validated when the league adapter maps into it in Pass 3.** Until then this is adapter v1, and the shell should treat any field it does not need as optional.

| Field | Source at HEAD (BaggerBomb) | Notes |
|---|---|---|
| `game` | battle doc | id, type, label |
| `phase` | derived: `status` × `getMarketState().state` | §4 |
| `score` | `scoreState.currentScore`, `tradeCount` | already on the Manage poll |
| `book` | battle positions, tiers, entry, P&L, held-since | |
| `scoreProximity` | `voiceLayerCache/{battleId}.portfolioBriefs[].thresholdProximity` — `currentMultiplier` (ATR units), `redZone.zoneProgressPercent`, `direction`, `targetMultiple` | ~15-min refresh in market hours. **Not** action proximity. §5.1 |
| `swapLock` | same object, `swapLock.distancePercent` | the one action-relevant leg |
| `lastCheckedAt` / `nextDecisionAt` | eval cron cadence (15 min, RTH, weekdays) + `getNextMarketOpen()` | §5.2 |
| `directives` | `agentBattles.directive` + `chatExchanges[].directiveThreadId` | §8 |
| `recentMotives` | swap-motive observability (exit-behavior Ask 1) | populate when Ask 1 ships; absent until then |
| `vocabulary` | `archetypeAdjustments.js` canonical allowlist via `directiveGate.js` | §6.5 |
| `loadout` | `agent` doc via `useAgent`; locked-visible via `benchLocked` | ships today |

### 3.3 Action vocabulary, per game (draft)

| Game | Agent acts… | Vocabulary source |
|---|---|---|
| BaggerBomb | 15-min eval ticks, RTH | `directiveGate.js` allowlist for the equipped archetype |
| Snake Draft / League Tournament (agent layer) | next eval tick; next-day claim window | same allowlist. **Claims and flips are user-layer only** — the agent cannot touch them and the chips must say so. Pass 3. |
| Training pod | inherits from engine mode | Pass 3 |
| The Mandate | term boundary | out of scope; listed so the shell does not preclude it |

---

## 4. The phase model — four states, derived

Battle `status` is ad-hoc `'active'` / `'completed'` (no enum). Market state comes from `getMarketState()` → `OPEN` / `PRE_MARKET` / `CLOSED_AFTERHOURS` / `CLOSED_WEEKEND` / `CLOSED_HOLIDAY` (`marketSchedule.js:180-213`). `chat.js:125` already composes these two. The phase is **derived, never stored.**

| Phase | Derivation | Agent is… |
|---|---|---|
| **PRE_OPEN** | `active` × (`PRE_MARKET` or closed) and no eval has run yet | waiting for first check |
| **LIVE** | `active` × `OPEN` | checking every 15 min |
| **LIVE_CLOSED** | `active` × any closed state, after ≥1 eval | dormant until next open. Evals are hard-gated to RTH (`agent-evaluate.js:284-286`); only expiry completion runs off-hours |
| **POST_CLOSE** | `completed` | done; debrief on delay |

**Duration-agnostic.** Under fullday, LIVE_CLOSED is evening-to-expiry. Under 3-day, it is overnights and weekends. Same derivation, same rendering.

| Slot | PRE_OPEN | LIVE | LIVE_CLOSED | POST_CLOSE |
|---|---|---|---|---|
| Primary card | DRB, plus "first check at 9:30 ET" | **Agent Desk** | Desk, dormant mode | Debrief lead; **"debrief pending" state required** (see P-6) |
| Action row | Deploy / preview | Talk it over · View battle | Talk it over · View battle | Talk it over (review) · Game Tape |
| Loadout bench | editable (no battle) / locked-visible | locked-visible (`benchLocked`, ships) | locked-visible | editable |
| Manage rail | absent / clock | score, clock, trades | score, "resumes Mon 9:30" | final |
| Rail step | 01–03 | 04 | 04 | 05 |

**Open discovery (D-16):** what chat mode `chat.js:125` selects during LIVE_CLOSED. If it routes to review mode (directives off, budget 5), Talk It Over during closed hours is a different product than during open hours and the card row must say so.

**Memory discrepancy logged:** `isPreOpenOnBattleDay` / `usePreOpenPhase` are NOT FOUND at HEAD on this branch despite memory recording them as shipped through Phase 3. Likely on an unmerged branch. **This phase model does not depend on them** — it uses `getMarketState()` directly.

---

## 5. The Agent Desk and the honest resting state

### 5.1 Distance to score, not distance to action — LOCKED

The V1 framing — "what would have to happen for me to move" — was a causal promise the system cannot keep. Sol showed the gate is compound and heterogeneous; discovery showed the one persisted, comparable proximity object measures **distance to the next bonus/bust scoring threshold**, not distance to a risk trigger. A position can sit 0.2 ATR from a bonus tier and the agent may hold straight through it.

**The Desk measures the scoreboard, not the mind.** "PLTR is 0.4 ATR from its next bonus tier" is an observable game fact. It is interesting because it is the game's tension, and it is honest because it makes no claim about what the agent will do. The single action-relevant leg — `swapLock.distancePercent` — is rendered as a constraint ("locked · 1.2% from unlock"), which is also a fact, not a forecast.

**Copy rule:** no "about to," no "close to trading," no agent-verb framing anywhere on the Desk. Scoreboard language only. Harness fixture.

**Source:** `voiceLayerCache/{battleId}.portfolioBriefs[].thresholdProximity`, written by non-fenced `api/cron/voice-layer-cache.js:257-272, 800-817`. **No fence entry required.** Fence contact arises only if an implementation reaches into `agentRiskManager.js` or `agentScoring.js` for a new return field — that path is forbidden by this document.

### 5.2 Cadence honesty — LOCKED

Everything runs at 15 minutes: evals, the `voiceLayerCache` refresh, the statusFeed. The Manage card polls at 120 s. The Desk **cannot be more live than the system**, and rendering it as continuous would be the fabrication C1 forbids by another route.

The posture line is therefore **discrete**: *"Checked 9:47 · next ~10:02"* during LIVE, *"Market closed · next check Mon 9:30 ET"* during LIVE_CLOSED. No verb that implies attention between checks. This answers Sol's continuous-cognition objection directly.

### 5.3 The existing idle state is already honest

Agent Pulse renders, verbatim: eyebrow **"Standing by"** (`LiveActivityPanel.jsx:152`), status **"Your agent will start analyzing when the market opens."** (`:98`). Users have been seeing a truthful resting state since the Pulse shipped. Only one of five breakthrough types (`gameplan_meeting`) has a live writer — the Pulse is *mostly* its idle state. The question was never "fill a void"; it is "enrich an honest surface with scoring proximity."

### 5.4 C1 and C2, restated precisely — LOCKED

**C1.** The Desk renders only what the decision path actually produces or the scoring path actually persists. No invented research, no generated introspection, no garnish the agent never sees. Model-authored idle narration is not shipped at beta — not because LLM text is inherently fabrication (Sol's MINOR is accepted on that point) but because the provenance verification that would make it safe is not being built now.

**C2.** No automated path from any display surface into prompt assembly. **User-initiated messages are input by definition and always were.** Entry cards (§6.1) are prefilled user text: they may be *selected* by state, but their *text* must not carry values computed by the UI that the agent does not already receive through its own context. Selection is fine. Payload is not.

### 5.5 What the Desk shows — Pass 1

1. Posture line (§5.2)
2. Score proximity: top 2–3 positions by `|currentMultiplier − targetMultiple|`, with direction and `zoneProgressPercent`
3. Swap-lock status for any locked position
4. Most recent real statusFeed entry (from the Pulse, portable — `LiveActivityPanel` takes plain props)
5. Breakthrough alerts: `gameplan_meeting` only until P-5 resolves
6. Next-decision clock (Amendment B §B7.1, convergent with §5.2)

**Own portfolio only.** Opponent view stays in Battle View (ruling, Aug 31).

---

## 6. Talk It Over

Battle mode ships (`POST /api/agent/chat`, `{agentId, battleId, message}`, server-authoritative `MODE_BUDGET` battle 10 / review 5 at `chat.js:135-138`). Directive threading ships. `directiveGate.js` exists at the `chat.js:469-484` chokepoint and, **when enforcing**, validates every directive against the archetype's canonical allowlist — only a verbatim allowlist string can be persisted; against-style asks classify `core_conflict` → deterministic null + code-owned `'no_change'` status. **The gate is flag-gated between `observe` and `enforce`, and its live state at HEAD is unverified (D-17).** Under `observe` the mechanism logs and does not block, which would mean the central guarantee of the conversational authority system is not currently guaranteed. **D-17 is a hard Pass 2 gate**, not a routine discovery item: no Pass 2 spec is written as if enforcement is live until the flag state is confirmed with `file:line`.

What has never existed is an obvious opening move, and a parameter to seed one (Q6.1: NOT FOUND; new `chat.js` parameter required).

### 6.1 The entry set — RULED (D-5)

| Card | Surfaces when | Framing |
|---|---|---|
| **"Walk me through the book"** | always | neutral |
| **"We're behind — what's realistic from here?"** | score deficit past threshold | honest — the answer is often "hold" |
| **"We're ahead — what protects it?"** | score lead past threshold | the counterweight; archetype-differentiating |
| **"What's the plan into the close?"** | final hour | neutral |
| **"I'm seeing something"** | always | hands off to Signal Drop, not chat |

Deleted: *"What's closest to a trade right now?"* (the Desk shows it — paying a message for it indicts one or the other). *"Why are we still holding X?"* (a symbol chosen by the UI is a computed payload). Asking about a specific position comes from **tapping it in the book** — user-chosen, C2-clean. Pass 2 follow-on.

**Symmetry is deliberate.** Sol showed the V1 set framed conversation around losing, teaching intervention at exactly the moment archetype discipline matters most. Two situational cards, one for each side.

### 6.2 Card rules
- Selected by adapter state; text carries no UI-computed values (§5.4 C2).
- A card is prefilled input. The user still sends. Costs one message, same as typing. No free-tap tier, no menu-browsing into an empty budget.
- Vocabulary chips (§6.5) constrain cards to what the gate honors.

### 6.3 Budget — RULED (D-4)
10 per day. Fullday: unchanged. 3-day: reset required in `chat.js` (cumulative today, Q6.3) — scoped to D-14.

### 6.4 Routing and the semantic honesty rule — LOCKED

Three tiers stand: **tactical** (battle directive, dies at close) / **lessons** (review only) / **rules** (review only, Forge). Discovery confirmed the write-side gates exist (`chat.js` gates lessons/`forgeSuggestions` on `mode==='review'`).

**But write-side honesty is not voice-side honesty.** Discovery found:
- `OUTPUT_FORMAT` offers the model `expiry: "permanent"` (`voiceLayerPrompt.js:41`); `directiveUtils.js:15-18` treats permanent as end-of-battle. **The agent can already promise permanence the storage cannot deliver.** → P-2.
- No refusal or redirect copy exists for a persistence ask the mode cannot honor (Q7.2: NOT FOUND). Enforcement is silent. → Pass 2 adds one line: *"That's a review-room thing — after the battle."*
- `forgeSuggestions[]` is a write-only sink (zero consumers in `src/`). The agent can say "I'll queue that for the Forge" and nothing ever acts on it. Not this arc's to fix; the semantic honesty rule means the agent stops saying it until a consumer exists.

**Rule:** the agent never claims a persistence level, a memory, or a Forge action that the current mode and existing consumers cannot deliver. Enforced by prompt copy in Pass 2, verified by fixture in the harness.

### 6.5 Vocabulary chips — Pass 2
Per game, the directive kinds the gate accepts, rendered above the input. Source: the same `archetypeAdjustments.js` allowlist `directiveGate.js` imports. Half of "questions don't land" is context; the other half is asking for things the mode cannot do.

---

## 7. Research / Action — LOCKED as an authority boundary (pending Sol)

The founder's words are "research" and "execution." In the record the lanes are **Research** and **Action**, because under §2 nothing executes on the user's say-so. Action is what the user *sees happen*.

**Research lane (Pass 4)** — read-only, always. Inputs: Signal Drops, screener, correlation intelligence, DRB, FantasyTimes, the book. Output: thesis cards — claim, evidence, invalidation condition, proposed directive. Evidence-first; falsifiable or it does not render. **Writes nothing to battle state, ever.** Tool parity: the agent queries the same data the user's own screener shows.

**Action lane (Pass 2)** — the existing directive channel made visible. Every chat-originated directive renders as a ledger card (§8). The trading brain treats a directive as strong preference, not authority; the ledger shows truthfully what it did with it.

**The bridge** — one gesture. A thesis card carries "file this"; tapping writes the proposed directive through the normal channel and opens a ledger card. Discussion becomes action and the user watches.

**Warning on the bridge (Sol, sustained):** "file this" creates an unusual loop. The agent generates a proposal; the user performs one gesture; the proposal returns to the trading brain carrying user authority as a strong preference. The agent has, in effect, proposed an instruction to itself and had it rubber-stamped. This does not violate §2 — the agent still decides — but it may materially increase the practical force and frequency of directives. **"File this" is Pass 4's central product experiment, not connective tissue.** It ships behind its own flag, with tap-rate and honor-rate instrumented, and its default may reasonably be *off* until the data says otherwise.

**Messaging rule:** product copy describes what exists now. Do not tell users "Command Center is where your agent lives across every game" while ranked activity still lives on league surfaces. Architecturally future-facing is fine; product claims are present-tense.

### 7.1 "Look into it" — the Research slice pulled forward to Pass 2 (D-21)

**The problem it solves.** The most natural thing a user will type mid-battle is "what about PLTR?" The truthful-but-dead answer is "not in this battle's loadout." The founder's ruling: the agent researches the name and comes back with evidence. The lock still exists; it stops being the first thing the agent says.

**Why it is a slice and not the lane.** Three things exist. `directiveGate.js` already classifies research asks (`research_only` → today, deterministic null). The platform already has single-ticker research machinery (Research Intelligence Hub, Stock Intelligence Agent, technicals incl. RSI and moving-average distance). Tool parity (§7) is satisfied by construction if the agent calls the same path the user's own research modal calls. **The integration is one wire:** `research_only` → call the existing research path → Gemma voices the findings in character → forward path.

**The turn, in three beats:**
1. *"I can't add it mid-battle — let me look at it."* The lock, once, softly.
2. Evidence. Where it sits against its moving averages, RSI, correlation with what is already in the book, whether the equipped archetype would even want it. Findings are the research path's own output; Gemma voices them and does not invent them.
3. *"If you like the case, I'll flag it for your next deploy."* → writes `nextDeployCandidates` on the agent doc; Equip renders it as a pre-filled chip at next deploy. **This is the door; without it the slice is still a dead end.** The chip ships in the same pass as the write, or the write does not ship — `forgeSuggestions[]` is the cautionary precedent.

**Guardrails — what keeps it a slice:**
- Single ticker, on explicit request. No screener sweeps, no correlation runs, no "file this" (Pass 4).
- Evidence, never a trigger. The agent says what it sees, not what it will do. No entry condition is committed to; if the user wants "enter when X," that is a Forge rule for next deploy and the agent says so.
- Capped per battle. Start at **3**. The research call does not consume the user's message budget beyond the ask that triggered it.
- Model: whatever the existing research path uses (Haiku/Sonnet); Gemma for voice. No new model dependency.
- C1 holds because research actually runs — "looking into it" is true in a way "watching" never was. C2 holds: research writes nothing to battle state.

**Shape is decided by latency (discovery item 18).** If the research path returns in ~10–15 s, it runs inside the same turn and there is no new mechanic. If slower, "get back to you" is an async agent turn landing in the thread — the server-initiated-turn pattern exists (`ensure-opener.js`, statusFeed writes) but it is a second thing to build. Discovery decides which.

**Not in scope:** adding the name to this battle's universe (D-20, deferred — game-rule change), timing research as an executable condition (retired trading-authority model), any Research lane surface beyond this one turn type.

**On the Battle Execution Manifest:** BEM V1's status vocabulary is worth borrowing; its execution semantics belong to the trading-authority model retired June 10 and are not resurrected. Phase 0 item 11 confirms how much shipped (expected: little).

**Why the split is simpler:** Research is Sonnet-tier, on-demand, capped (~1/day/battle, mirroring gameplan-meeting cadence). Action rides existing Gemma extraction. Nothing fires per tick. And the liar problem becomes tractable — Research never promises; Action only shows what the engine did.

---

## 8. The action ledger — Pass 2

Sol's second-pass blocker stands: **"Seen" is a claim about agent behavior, and C1 applies.** An eval occurring after a directive was filed proves an eval occurred — not that the directive reached the decision context — unless every applicable eval deterministically ingests the current directive, which discovery item 8 has not established. The same gap infects "not honored, because X," and it is worse than V1.1 admitted: **a "hold" directive that is honored produces no trade, and therefore no `submit_trade_decision` echo.** The one receipt that exists is for trade-producing directives only.

The ledger is therefore specified as a **floor** the data supports today and a **ceiling** gated on discovery.

### 8.1 Floor — ships in Pass 2 regardless

```
FILED → SUPERSEDED | HONORED (trade) | EXPIRED
```

| State | Source of truth at HEAD | Claim it makes |
|---|---|---|
| **Filed** | directive write timestamp (`chat.js:617-639`) | the user said this |
| **Superseded** | a later directive replaced it (D-18, single slot latest-wins) | the user said something else after |
| **Honored (trade)** | `directiveThreadId` echoed in `submit_trade_decision` (`controlPromptRenderer.js:217-218`, `agentEvalToolSchema.js:67`); `AgentChat` already renders "↳ from directive" | a trade cited this |
| **Expired** | battle close, or `expiry` reached (`directiveUtils.js`) | the window passed |

No state in the floor claims the agent *read* anything. A hold directive that was honored shows as Filed until it Expires — thin, but true.

### 8.2 Ceiling — only if discovery item 8 finds a per-directive receipt

```
FILED → SEEN → HONORED | DECLINED (motive) | EXPIRED
```

**Seen** and **Declined** require evidence that the specific directive entered the decision context and the engine chose. If item 8 comes back NOT FOUND, the path to a receipt is a per-eval acknowledgment field the trading brain fills ("directive X: acting / holding / declining because Y"). `controlPromptRenderer.js` and `agentEvalToolSchema.js` are not on the fence list by name, but changing what Haiku emits every tick is trading-brain territory in spirit — **that is a founder ruling, not a workaround, and it is not designed here.**

### 8.3 Rules

- Never show a state the data cannot support. Floor by default; ceiling only on evidence.
- Outcome text is engine text. **Never a Gemma paraphrase** (C1). `recentMotives` when Ask 1 ships; until then, the statusFeed trade entry for trade-producing directives only.
- Ledger cards die with the battle; readable post-close in Game Tape (**gap: Game Tape and the debrief render no directives today — Q10**; Game Tape ledger visibility is Pass 2 scope).
- The ledger is a mirror, not an input (C2).
- **Both chat surfaces show the current directive above the composer before send** (D-18), so replacement is a choice the user sees, not an accident.

---

## 9. Model decision — LOCKED (Amendment A absorbed)

Gemma stays for this arc. Pass 1 makes no model calls; Pass 2 uses battle mode as-is. Prerequisite C runs in parallel with contenders re-pointed from DeepSeek V4-Flash to **GPT-5.6 Luna** ($0.20/$0.02 cached/$1.20 per M; GA Jul 9; ~122 tok/s) and **Z.ai GLM-5.3-Flash** ($0.15/$0.03/$0.50 list; released Aug 26; **50% promo expires Sept 9**; MIT weights; first-party throughput reportedly ~49 tok/s). Price is not the deciding input — caching dominates at this volume. Harness riders D-7 (schema-adherence failure rate against the live `OUTPUT_FORMAT`) and D-8 (p95 latency) stand. **No challenger adopted without a harness run.** Amendment B's caution holds: Gemma-as-front-door is a heavier bet than Gemma-as-side-panel, and the harness result should precede league promotion even if BaggerBomb promotes first on the lock.

---

## 10. Prerequisites exposed by discovery and review

All non-fenced. None is this arc's fault; all would be amplified by inviting more conversation.

| # | Fix | Where | Before |
|---|---|---|---|
| **P-1a** | Directive write becomes a transaction: re-read, require `status==='active'`, write. **Proves:** closes the after-close TOCTOU. | `chat.js:617-639` | Pass 2 |
| **P-1b** | Concurrent directives from two surfaces. A transaction serializes; it does not preserve the earlier write — two directives filed near-simultaneously still end with only the second. **Resolution is D-18 (single slot, latest-wins, declared)**, plus: both surfaces display the current directive before send; the ledger renders SUPERSEDED. If the founder instead wants both to survive, the slot becomes a list and P-1b is a larger change. | `chat.js`, both chat surfaces | Pass 2 |
| **P-1c** | Budget check-then-increment atomicity. `increment` is atomic; the check at `chat.js:237` and the increment at `:623` are not in one transaction. Two surfaces at 9/10 can both pass and both charge → 11. Wrap the check in the P-1a transaction. **"Server-authoritative" and "race-safe" are different properties** — discovery item 16 confirms. | `chat.js:237, 623` | Pass 2 |
| **P-2** | Remove `"permanent"` from `OUTPUT_FORMAT` expiry until cross-battle directives exist. One line. | `voiceLayerPrompt.js:41` | Immediately — own small PR |
| **P-3** | Seeded-opener parameter on `POST /api/agent/chat`. | `chat.js:168-180` | Pass 2 scope (is Pass 2 work) |
| **P-4** | `voiceLayerCache` read rule → owner-scoped. Currently any authenticated user (`firestore.rules:693-695`). | `firestore.rules` | Pre-launch security list; **pre-Pass-1** |
| **P-5** | Four dead breakthrough types — cut from `BREAKTHROUGH_MAP` or wire writers. | `LiveActivityPanel.jsx:42-48` | Pre-Pass-1 |
| **P-6** | **Debrief liveness, not just a pending card.** `completeBattle` can land ~20:00 UTC; `agent-batch-review` fires 20:25 querying active-only → fullday battles can miss the debrief and "pending" becomes permanent. **P-6 = pending UI + guaranteed eventual debrief.** The batch-review selection must include recently-completed battles (or `completeBattle` must enqueue). Note: `completeBattle` already stamps `pendingReflection` (Q9.1) — discovery item 17 asks whether anything consumes it; if nothing does, that flag is the natural hook. The cron fix is *part of* P-6, not beside it. | `agent-batch-review.js` + POST_CLOSE card | **Pre-Pass-1** (the card is Pass 1's primary in POST_CLOSE) |
| **P-7** | **Chat-side precedence reconciliation.** The identity text chat reads says equipped rules "never reverse" the archetype (`voiceLayerPrompt.js` IMMUTABLE CORE / PROTECTED BIAS zones); the reconciler ranks `user_equipped` above `archetype_default` and deletes the losing archetype rule (`decide.js:262`). For beta, **the text describes what the engine does** — minimum honest fix. Eval-side reconciliation stays with exit-behavior Ask 2. **Ownership check first:** harness-revamp workstream may own archetype identity surfaces. | `voiceLayerPrompt.js` four-zone blocks | **Pass 2** (moved forward from Pass 3 per D-13) |

---

## 11. Passes

| | Pass 1 — The Sync | Pass 2 — Talk It Over + Ledger | Pass 3 — League adapter | Pass 4 — Research lane |
|---|---|---|---|---|
| What | §4 phases, §5 Desk, clock, own-portfolio, built on §3 shell rule and adapter v1 | §6 cards, chips, P-3 seeded opener, §8 ledger (floor), Game Tape directive visibility, semantic-honesty copy, **§7.1 "Look into it" research slice + `nextDeployCandidates` chip** | Snake Draft / Tournament adapter, weekly-score parity, league directives visible, **adapter schema validated or revised** | Full Research lane: screener/correlation tool use, thesis cards beyond single-ticker, "file this" (flagged, instrumented) |
| New model calls | None | Gemma (existing); **existing research path, capped 3/battle** | Gemma (existing) | Sonnet, on-demand, capped |
| Fenced files | None | None | None expected — STOP if parity needs one | None expected |
| Prereqs | P-4, P-5, **P-6 (liveness)**, D-16 | Pass 1; P-1a/b/c, P-2, **P-7**, **D-17**, D-18, discovery items 8, 16, **18–19** | Pass 1; front-door gate §12 for league; D-11 | Pass 2; D-12 |
| Front-door gate | does not apply — no conversation on the Dashboard | **applies** (§12) | applies, per game | — |
| Status | **Beta** | **Beta** | Own arc, own kickoff, after Pass 2 | Own arc, post-launch |

**Pass 1 stands alone.** If Pass 2 slips, the connective tissue still lands.

---

## 12. The front-door gate — LOCKED (Sol pass two: sustained with corrections)

The Command Center does not become a **conversational** landing surface for a game until both conditions hold **for that game**. Per game; BaggerBomb can clear it while league is still working.

**When the gate bites (D-13, confirmed):** at **Pass 2**, not Pass 1. Pass 1 puts the Desk on the Dashboard — a read-only mirror. It puts no conversation there. The precedence contradiction is something the agent *says* about itself in chat; a surface with no chat cannot say it. Pass 1 therefore does not promote the Command Center in the sense the gate governs. Pass 2 does, and must clear both conditions first. V1.1's contradiction (gate before promotion, but Condition 2's work in Pass 3, with promotion in Passes 1–2) is resolved by moving Condition 2's chat-side work to **P-7, pre-Pass-2**.

**Condition 1 — Shared truth on overlapping concepts.** Chat and eval operate from the **same authoritative source for the concepts they share**: positions, P&L, scoring state, applicable rules and constraints, market state, current directives. Chat *also* needs what eval never sees — conversation history, user intent, prior promises. Eval *also* carries execution-specific content that does not belong in conversation. **"Same eyes" is not "chat is a superset of eval."** Phase 0 item 7's field-level diff is discovery, and its output is not a requirement to shovel every eval field into chat — it identifies which shared concepts diverge in source, and those are fixed at the source. If a shared concept the eval computes in-prompt is not persisted anywhere chat can reach without a fence change, that is a **STOP for fence ruling**, not a workaround.

**Condition 2 — The precedence contradiction is resolved on the chat side.** Live today: the reconciler ranks `user_equipped: 1, archetype_default: 2` and deletes the losing archetype rule (`decide.js:262`), while the identity text the models read says equipped rules "never reverse" the archetype (`evalIdentityBlocks.js:58`; `voiceLayerPrompt.js` IMMUTABLE CORE / PROTECTED BIAS zones). Users meet this in week one at any conversational front door. **Resolution is P-7:** for beta the chat-side text describes what the engine does. Eval-side reconciliation (`evalIdentityBlocks.js`, the 13 absolutist MUSTs, R8, SX-04 × mb-08) stays with exit-behavior Ask 2 — fenced territory, different relay. Ownership check before P-7 edits the four-zone blocks: the harness-revamp workstream may own archetype identity surfaces.

**What the gate does not require:** a model change. Gemma stays locked (§9). But Gemma-as-front-door is a heavier bet than Gemma-as-side-panel; the Prerequisite C harness result should precede league promotion even if BaggerBomb promotes first on the lock.

**Messaging (Sol, sustained):** BaggerBomb-first promotion is coherent because §3.1 scopes the Dashboard to BaggerBomb and league stays on league surfaces. The danger is copy, not architecture. Product claims are present-tense.

---

## 13. Reuse register — verified by Phase 0

| Asset | Verified state | Reuse |
|---|---|---|
| Voice Layer battle mode | ships; server-authoritative budget; no seeded param | yes, + P-3 |
| `directiveGate.js` | ships; allowlist-gated; flag-gated `observe`/`enforce` — **live state unconfirmed** | yes — **confirm flag state** |
| Agent Pulse (`LiveActivityPanel`) | ships; portable (plain props, no router); 1 of 5 alert types fires | yes, + P-5 |
| statusFeed | array field on battle doc; owner-scoped; opponent gets `PUBLIC_STATUSFEED` projection | yes |
| `voiceLayerCache.thresholdProximity` | ships; non-fenced writer; any-auth read | yes, + P-4 |
| Manage-card data | 120 s `getDocs` poll, spans both agentIds; no `onSnapshot` | yes — reuse the poll, no second source |
| Locked-visible loadout | ships (`benchLocked`) | yes |
| Review mode + auto-debrief | ships; on delay after close | yes, + P-6 |
| Signal Drop pipeline | ships | yes |
| "↳ from directive" linkage | ships in `AgentChat`; absent from Game Tape/debrief | yes for ledger; Game Tape gap is Pass 2 |
| `getMarketState()` phase ladder | ships | yes — phase derivation |
| League partner-influence model | **design-complete, not built**; engine work fenced | **no** |
| `isPreOpenOnBattleDay` / `usePreOpenPhase` | **NOT FOUND at HEAD** | not needed |
| BEM `VOICE_SEQUENCE` | Phase 0 item 11 pending; expected little | vocabulary only |

---

## 14. Non-goals

- No veto, manual trade, or co-pilot path.
- No fenced-file changes (11-file list, `docs/BUILD_RULES.md:14-24`). Any phase that discovers otherwise stops for a fence ruling.
- No new cron slots.
- No Mandate build. Framing borrowed, feature not built.
- No grading (dead per Amendment 2, Jun 10).
- No scoring or trading-behavior change.
- **Narrowed from V1:** chat-side context assembly (`chat.js`, `voiceLayerPrompt.js`, any new adapter module) **is** in scope. Eval-side is not.
- No duration flip. D-14 is its own ruling.

---

## 15. Open items

| # | Item | Blocks | Fable's lean |
|---|---|---|---|
| D-1 | Rename. Discovery deflated the blast radius: 115 matches / 41 files, **5 user-visible strings, 0 persisted fields, 0 analytics, 0 routes** — a refactor, not a data change. Sol no longer objects. | Pass 1 spec | Confirm; in-battle tab renamed (D-15) |
| D-10 | Lane placement — two panels, two modes of one thread, or chat-left / lanes-right | Pass 2 layout (Claude Design) | Two modes of one thread; ledger in the Pulse column; do not split the conversation |
| D-11 | Pass order — league adapter before research lane | Pass 3 kickoff | League first; both after Pass 2 |
| D-12 | Research lane cap and invocation | Pass 4 | On-demand, ~1/day/battle, Sonnet; no per-tick |
| D-13 | Front-door gate bites at Pass 2; chat-side reconciliation is P-7 pre-Pass-2; eval-side with Ask 2 | Pass 2 | **Confirmed Aug 31.** Ownership check with harness-revamp is the open sub-item |
| D-14 | 3-day flip — fenced constant, inactive path, budget reset | Not this arc | Own gated ruling after beta proves the surface on fullday |
| D-15 | In-battle tab name | Pass 1 rename | "Huddle" — Sol: "communicates conversation rather than command authority" |
| D-16 | Chat mode during LIVE_CLOSED (`chat.js:125`) | **Pass 1 spec** | Discovery item 13 — Sol: run before freezing Pass 1 |
| **D-17** | `directiveGate.js` flag state — `observe` or `enforce` live? | **Hard Pass 2 gate** | Discovery item 14; enforce expected, nothing assumed |
| D-18 | Directive slot contract — single slot latest-wins, declared; SUPERSEDED in ledger; current directive shown before send | Pass 2 (P-1b) | **Confirmed Aug 31.** Closed |
| **D-19** | Does anything consume `pendingReflection` stamped by `completeBattle`? | P-6 design | Discovery item 17; if unconsumed, it is the natural debrief hook |
| **D-20** | Mid-battle universe expansion — **the Call-Up arc** | Own gated arc | **Accepted in principle (Aug 31), superseding the earlier deferral.** Founder's rebuttal sustained: the frozen-universe rule rewards watchlist padding, not commitment, and BaggerBomb-vs-CPU has no fairness counterparty. Shape: user-spotted name, researched via §7.1, added to the battle bench on demand — **cap 2/battle, thresholds seeded at add-time (`baseATR` is daily; swap-in scoring semantics already ship per Q3), enters at Support tier, vs-CPU modes only until PvP symmetry ruling.** The trading brain decides any swap-in on its own authority — no chat-armed execution, ever. **Fence contact is certain** (`decide.js` threshold seeding, swap universe) → own mini-arc with fence ruling, own Phase 0, own spec. §7.1's forward path is pluggable: next-deploy at first, Call-Up when this arc lands. Wildcard-slot (pre-seated symmetric version) remains the PvP candidate. |
| **D-21** | §7.1 research slice — cap and shape | Pass 2 spec | Cap 3/battle; in-turn if item 18 latency allows, else async; no new model |
| **D-22** | **Agent Hub via the FAB** — the bug-reporter FAB becomes the entry point to a context-aware agent hub scoped to the Command Center the user is looking at | Own arc, **after this one** | **Bookmarked (founder idea, Sep 1).** Substantial prior art: `AGENT_CENTER_FAB_SPEC.md` (Mar 2026) already specced the FAB absorbing the bug reporter into a speed dial (Watchlist + Bug Reporter, Phase 2 slots reserved for Notes/Helper); `AGENT_DASHBOARD_DESIGN_SPEC.docx` §8 specced a floating agent chat with quick-action pills — **"Strategy session, Scouting report, Review a game," which is Talk It Over's seeded-card model designed five months early.** Confirm what shipped before scoping; the live preview shows a standalone bug icon, suggesting the Agent Center FAB was specced but not built. **Convergence note:** if the FAB becomes the agent-chat entry point, it and Pass 2's Dashboard Talk It Over are the same surface reached two ways — resolve that before either is designed, or D-2's dual surface quietly becomes triple. |
| **D-23** | **Grading vocabulary still user-visible** — feed-line review text renders `Grade: D`; 05 REVIEW reads `Your first grade unlocks here`. Grading was removed June 10, 2026 (Amendment 2) | Pre-launch copy | Not this arc's bug; the Desk surfaces it. Find every live grading string in engine text and UI copy; own PR. Beta users will ask. |
| **D-24** | **The day feed — Pass 1.5.** Live surface leads with what happened, not where things stand. DRB demotes to the day's first entry; gauges demote to a compact strip; `statusFeed` array replaces `statusFeedLatest` in the adapter | Pass 1.5 design + build | **Ruled Sep 1.** Mostly re-presentation of existing writes. See `CLAUDE_DESIGN_BRIEF_ADDENDUM_B_DAY_FEED.md`. Four data requests gate it; the FantasyTimes↔ticker join is the only genuinely new piece. |
| **D-25** | **§6.1 entry-card set is now provisional.** Feed-item-driven openers (a story about a held name, a trade, a tier crossing) beat the five generic cards; generic set becomes the quiet-feed fallback | Pass 2 spec | **Ruled Sep 1.** Resolve in the Pass 2 spec, not before. |
| **D-26** | **Feed honesty ceiling.** Tier crossings and lock transitions may be inferable only as differences between ~15-minute cache refreshes. If so, entries are timestamped *observed at*, never *occurred at*, and crossings between refreshes are invisible | Pass 1.5 spec | Discovery gates it; the honest-timestamp rule holds either way |
| **D-27** | **The research-or-influence law.** Every interactive element on the live surface resolves to research or influence; anything resolving to neither is display and takes the smallest legible space | All design work | **Ruled Sep 1** (founder: *"options need to fit either research or execution influence"*). §7's lane split, applied as a UI test. |
| **D-28** | **Design the Pass 2 surface once; ship Pass 1 into it with doors inert.** Two actions on the game card — **Debate** (influence, Pass 2 chat) and **Portfolio news** (research, conditional on the ticker join) | Layout freeze | **Ruled Sep 1.** Ends the re-cutting caused by briefing read-only layouts. Precedent: `Talk it over · SOON` already ships inert. |
| **D-29** | **Discovery rail cut; feed entries are the doors.** A story about a held name taps to Debate; a trade taps to "why this one"; a crossing taps to "what's the plan." Rail returns only if entries-as-doors proves too subtle | Pass 1.5 / Pass 2 | **Ruled Sep 1.** One object doing both jobs beats two competing for the screen. Signal Drop keeps its own entry point. |
| **D-30** | **Gauges lead with distance to bagger**, next tier as the near-term marker. `6.7% to Bagger` already ships in the battle view | Pass 1.5 | **Ruled Sep 1**, gated on discovery: is bagger distance derivable per position? If not, next-tier stays the headline and bagger is a labelled endpoint. |
| **D-31** | **Debate shows its cost before the tap** — remaining message budget visible on or beside the icon | Pass 2 | Requires client-readable budget remaining; discovery item |
| **D-32** | **A door in every phase.** PRE_OPEN → Pre-market news (research); LIVE / LIVE_CLOSED → Debate + Portfolio news; POST_CLOSE → Film room (research, into the shipped debrief + Game Tape) | Layout | **Ruled Sep 1.** Follows from D-27: a phase with no door is pure display and must not occupy a full screen. Pre-market news shares the ticker join with Portfolio news — one gate, both slots. Film room is the cheapest item in the arc (both surfaces ship). |
| **D-33** | **Overnight/overseas news deferred** as distinct from pre-market news | — | Needs Asian/European session coverage — a data-source question, not a layout one. Own arc. |
| **D-34** | **The prime region is `Active`, not the timeline.** *Active is what is outstanding; the day is what happened.* Open directives + Signal Drop + latest reasoning above the fold; the Addendum B timeline moves behind a `Full day` tap | Layout, Pass 1.5 | **Ruled Sep 1.** Converges on §8's ledger. Pass 1's Active is thin (Signal Drop + reasoning only — no directives without conversation); design deliverable 6 asks whether it holds up, and the answer may change Pass 1's scope. **Region definition is locked; do not re-open.** |
| **D-35** | **Deploy is the hero of the no-battle state** on both shells; loadout reads as equipped gear, not list rows | Layout | **Ruled Sep 1.** Mobile regressed Deploy to a low plain link; the live dashboard has it as a full-width primary. Archetype iconography stays out (separate deferred arc). |
| **D-36** | **FantasyTimes hit rate governs two phase doors** — how many published stories on a typical day carry a ticker in a typical five-name book | Pass 1.5 / Pass 2 | **Discovery, countable.** If most days return zero, Portfolio news and Pre-market news are dead slots and come off the card. Measure before committing either. |
| **D-37** | **The Board — the position is the unit of play.** Actions live on pieces, not in regions. `THE_BOARD_COMMAND_CENTER_DESIGN_CONCEPT.md` **replaces the design brief and Addenda A–D in full** | All design work | **Ruled Sep 1.** Root cause of four stacked mockups: briefing a page. Games have a focal object with choices attached; the book is the board, each position a piece. |
| **D-38** | **Mobile: Manage is a mode, not a section** — Addendum A's Option B adopted. The 01–05 rail becomes navigation; each station a full pane; live battle opens on 04 | Mobile layout | **Ruled Sep 1.** Mobile never had "at a glance" — it had a scroll. Option B loses nothing mobile possessed. Rail carries state (score, unread, debrief pending). |
| **D-39** | **The lever arc — take-profit / stop-loss as piece properties.** Points not ATR; archetype-bounded ranges; set at deploy, adjustable per piece as a *move* with a daily allowance; **pin** exempts a piece from take-profit, never from the stop floor; fires at the next check, copy says so | **Own arc**, after Pass 2 kickoff | **Charter ruled Sep 1.** The executor is live (`PROFIT_TARGET_EXECUTOR_ENABLED = true`, R11); the user parameter, pin, and moves allowance are net-new. **Fence ruling required** — a user-set parameter reaches scoring code. Belongs with exit-behavior Ask 3. Real ranges are a founder ruling in that arc. Points-vs-ATR translation is its first discovery question. |
| **D-40** | **FAB = Debate. One global door.** Agent Hub as a multi-tool launcher rejected for this surface; D-22 narrowed to "bug reporter relocates" | Both shells | **Ruled Sep 1.** A launchpad is the congestion problem in a circle. Once actions live on pieces and stations, talking to the agent is the only global action left. |
| **D-41** | **Cut from prior briefs:** the two-icon action pair on the card, the discovery rail, the timeline as body, the entry-card catalogue as a distinct surface. Their jobs moved into pieces (§1), stations (§3), and Active | — | **Ruled Sep 1.** Portfolio news → 01 READ / a station; film room → 05 REVIEW; cards → piece and feed-entry doors. |
| **D-42** | **Controller / cockpit split.** The controller page (four verbs, the turn, the tape) is the **new Battle View**. The Command Center becomes a **cockpit**. **CONFIRMED: the controller / Battle View half only. The cockpit is NOT designed and NOT read-only** — the "projection, three-block cap, no verbs" wording was the design chat's proposal, recorded in error as ruled (founder correction, Sep 1). The cockpit's contents and whether it carries actions are OPEN. | Placement | **Recorded Sep 1 from the design chat; founder to confirm deliberately.** Supersedes The Board's *page*; its piece-as-unit-of-play survives as the Matchups row. **Inverts this arc's §1 premise** (dashboard absorbs the battle view) — the arc chat's read: still correct, because the fix for "scoreboard with a link" was never verbs on the dashboard, it was a link worth following and a projection worth reading. **Consequence:** the §12 front-door gate does not bite the cockpit (no composer, engine text only) but **does bite the controller** — P-7 is a controller prerequisite. §1 of this framework is rewritten on confirmation. |
| **D-43** | **Four primary verbs** are the whole interactive vocabulary of the Battle View: Why? · Show it · Direct · Draw the line (later). Named exceptions: the free-form follow-up field, flag-for-next-deploy, assignment answers. §6.1's card *catalogue* retired as a board control | D-5, D-25, D-27 | **Adopted.** D-27 applied as a hard cap. **Arc ruling on the shipped ask-chip:** `buildAskChips(youRank)` ships and stays — it lives inside the follow-up field as a suggested opener, costs a message as today, never on a piece. |
| **D-44** | **Why? is free** — a pure read of persisted decision-path text, with an absence state | §6.2 (read only) | **Adopted with a correction that changes the design.** A quiet HOLD writes nothing — no statusFeed entry, no motive line. So Why? is answerable on *traded* positions and has **no source** on held ones, which on a typical day is most of the board. **The absence state is the primary state, not the fallback.** Same root gap as the ledger ceiling (Q8). Both are fixable by the same code-side write: the rendered-vs-suppressed value `buildControlEpochEvent` already computes, one field on the existing per-tick record, no prompt or model change. |
| **D-45** | **No inert Direct beside live chat.** D-28's inert-door rule applies only to capabilities that exist nowhere; the Battle View's chat already accepts directives, so Direct ships live (floor receipts) or is absent | D-28 | **Adopted.** Narrows D-28 for this control only. First shipping phase: Why?, *This turn*, tape; existing chat unchanged. |
| **D-46** | **The cockpit split rule** — PROVISIONAL. Every projected field stamped with its check; own side for every field including prose; engine text only in *Latest* until P-7; floor receipts only. **The "no verbs" clause is withdrawn** (founder, Sep 1): a Scouting assignment answer is a structured write with no budget and no character reply, and its due check makes it the worst possible thing to require navigation for. If any verb belongs on the cockpit it is that one. | §12, P-7, P-4 | **Stamping and own-side rules adopted; the verb question is OPEN.** Discovery note: statusFeed is already owner-scoped with a `PUBLIC_STATUSFEED` opponent projection — the own-side filter is free, not a build. |
| **D-47** | **Own-only narrowing:** match totals (agent · CPU) are the scoreboard and may show on the cockpit; opponent pieces, proximity, receipts and prose never | Aug 31 own-portfolio ruling | **Confirmed; no-op.** The Manage card shows both totals today. The line: **totals yes, opponent composition never.** |
| **D-48** | **The turn is a confirmed check.** The landing fires on the evaluation's completion write, never on the clock; `N checks · no change` means no change in anything user-visible including directive disposition | §5.2, D-24 | **Adopted, pending Phase 0 item B** — whether `scoreState.lastScoredAt` is written *last* (a true snapshot boundary) is not yet established. |
| **D-49** | **This turn** holds only unresolved check-bound items — the current directive and an open assignment. Research artifacts and signals never sit there | D-34 | **Adopted.** Keeps D-34's definition; decides placement. |
| **D-50** | **Scouting Assignments** accepted to Phase 0 only. No spec until both predicates are FOUND. Structured answers (no budget, no character reply); *preference* is the weakest directive kind; deficit never the trigger; no ahead-side framing; no "your calls" record | New mini-arc | **Adopted as scoped.** Respects Amendment 2 (no grading) and D-20 (universe frozen — assignments stay on the bench). |
| **D-51** | **Receipt vocabulary:** `Acted · Replaced · Expired` supersedes `Honored · Superseded · Expired` | §8.1 | **Ruled Sep 1.** Not a plainness preference: **"Acted" claims only a visible action**, and honored holds have no receipt — "Honored" would claim what the data cannot support. |
| **D-52** | **The Heard stamp is cron-computed, on `battle.evaluations[]`.** A per-tick, per-`directiveThreadId` field recording that the directive's text was in the deciding prompt on that tick, computed in the cron from `resolveControls` on the same `battle` object the assembler received. Supports exactly one verb: *Heard*. It changes nothing the model emits and is **not** trading-brain territory under §8.2; a model-filled stamp would be. `controlEpochLog` is a per-mode-epoch record and is not the target. | §8.2, item 8, D-44 | **Ruled Sep 1.** Non-fenced (`agent-evaluate.js`, `controlSuppressionTelemetry.js`, `controlPromptRenderer.js`). Inert to both readers (`agentEvalPromptAssembly.js:1284-1297` whitelist; `agentTriggerGate.js:22-30` length only). Builds in Phase B. |
| **D-53** | **Direct is book-level.** Directives are method-level strings with no symbol slot; `resolveControls` names no positions. Rows carry no directive mark; the mark lives on the score header. Why? and *Ask a follow-up* stay piece-scoped; Direct opens from the score header only. | D-37, D-43, Controller §5.3 | **Ruled Sep 1.** Per-row marks would also contact the fenced row shape (`agentScoring.js`). |
| **D-54** | **Show it's forward path is Equip.** The equipped watchlist (`api/agent/equip-watchlist.js`, `watchlistEquip.js`) is unioned into the live battle's hot bench mid-tick (`agent-evaluate.js:1013-1024`). "Flag for next deploy" is therefore replaced by *Equip it*, with honest copy that it reaches the bench at the next check. `nextDeployCandidates` is dropped (net-new, write-only sink). **D-20 restated:** the universe is frozen mid-battle *except* through the equipped watchlist's hot-bench union, which is shipped behavior. | D-20, D-21, item 20 | **Ruled Sep 1.** Also applies to D-55. |
| **D-55** | **Scouting Assignments reshaped to V2.** No preference kind exists, no receipt for one, no push infrastructure, one cron slot left, P1 ranks the universe + equipped watchlist (not the bench), P2 is only "not currently forbidden." V2: the character asks the user to scout two *watchlist* names that rank almost even (readable through `scouting-board.js`, free, in the ratchet baseline); the answer is *equip your pick* — a shipped mechanism with a provable receipt (hot-bench membership, then `Acted` if swapped in). Issued on open like the opener; no due time; no push; no new directive kind. D-50's guardrails retained (one per battle, *Neither* / *Your call*, deficit never the trigger, no ahead-side framing, no "your calls"). Spec after Phase A. | D-50, D-54 | **Ruled Sep 1.** Concept V1.1 superseded by V2 when written. |
| **D-56** | **`PUBLIC_STATUSFEED` attribution leak** (`source`, `triggeredBy` to non-owners, `tournamentBattleView.js:48`) fixed as a standalone task, no flag. | own-portfolio posture, P-4 | **Done Sep 2** — `fix/public-statusfeed-attribution-leak` (`5521cf79`), tests import the projection. Shadow-capture nulls fixed alongside (`f8ecfb72`). `recentElicitationTargets` lost update rides the P-1 concurrency branch. |
| **D-57** | **The cockpit carries no verb in phase one.** Nothing exists yet to answer from the cockpit. Revisit with D-55. D-46's stamping and own-side rules stand; the verb question is deferred, not closed. | D-46 | **Ruled Sep 1.** |
| **D-58** | **Ledger and foundation live in the repo.** `COMMAND_CENTER_ARC_FOUNDATION.md`, this ledger, the Controller / Cockpit briefs, the Assignments concept and every Phase 0 report are committed under `docs/audits` / `docs/design` so CC can verify rulings rather than treat them as claims. BUILD_RULES §6 corrected to **39/40** cron entries. | process | **Ruled Sep 1;** docs-only commit Sep 2. |
| **D-59** | **Under the controller flag, the board, the turn line, and Why? read the subscribed battle doc** — one source. The shipped frozen-prop row path is fixed separately for flag-off. | §9 display agreement, D-48 | **Ruled Sep 2** (Phase A Phase 0, decision 3). CPU side is static at deploy (`agentBattleService.js:167`); prop fallback only for `null`. |
| **D-60** | **`Executing on next evaluation window` is retired.** `ExecutionCard` carries the receipt line (`Filed · Replaced · Expired`, D-51); no pulse between checks. Flag-off copy fixed in its own PR after Phase A. | D-51, honesty rule 4, motion lock | **Ruled Sep 2** (decision 4). |
| **D-61** | **`Expired` = battle complete under fullday.** The `3_games` day-count client port is a D-14 prerequisite, not Phase A work. | D-14, `directiveUtils.js:8-22` | **Ruled Sep 2** (decision 6). Duration mode is hard-set to fullday (`agentBattleService.js:35`); the multi-day branch is unreachable today. |
| **D-62** | **One closed-phase string on both surfaces**, carrying the as-of and the resume time (`Market closed · last check {t} · next {day} {t}`); `next` is the adapter's `lastScoredAt + 15 min` everywhere; `deriveDueAt` exported for the late state. | §5.2, handover lock #5, §9 | **Ruled Sep 2** (decisions 1–2). |
| **D-63** | **The Phase A build branch is `claude/battle-view-controller-phase-a-v5gog5`**; the Phase 0 branch `…-i51j5l` is retired (its report is on `main`). | process, D-58 | **Ruled Sep 2** (A4 seed). A4 was built in a fresh session whose harness branch is `claude/battle-view-phase-a-layout-425nnm` — the `…-v5gog5` commits rebased onto `def0fcbe` (`main` moved by #808, no file overlap) plus A4.0 → A4.3; the founder opens Phase A's PR from it. Recorded in the A4 handover. |
| **D-64** | **`exitReason` is never rendered to the player**; trade lines carry the receipt's `rationale`. Same class as the `source` / `triggeredBy` leak (D-56). | hazard 12, A3 review F10 | **Ruled Sep 2** (A4 seed). |
| **D-65** | **An engine-outage tick (`haikuError`) is the Why? absence state**, never `Held` with the cron's placeholder words (C1). The label names the persisted fact where the fact is a timeout: `No decision recorded at this check · the evaluation timed out` for `haikuError.failureClass === 'timeout'`; every other persisted class (`budget_skipped`, `truncated_response`, an HTTP status, an error name) keeps the plain absence label until a class-neutral line is ruled. | C1, A3 review F12, A4 review L1-F1 | **Ruled Sep 2** (A4 seed; A4.0 ruling 4). The timeout-only scope is the A4 review's finding L1-F1 (CONFIRMED): the cron persists six classes and the shipped Pulse names the class rather than saying "timed out" — a copy request for the other classes is in the A4 handover (item 20). |
| **D-66** | **Four Why? states:** `Held` · `Swapped` · `Argued for a swap · held by a guardrail` · `Argued for a swap · it did not go through` (`validationErrors[0]` prefix `Swap execution failed`), plus absence. | hazard 2, A3 review N5 | **Ruled Sep 2** (A4 seed; A4.0 ruling 1). |
| **D-67** | **Completion expires only the directive current at the close**; a `Replaced` receipt stays `Replaced` (D-61 clarified). | D-51, D-61, A3 review F11 | **Ruled Sep 2** (A4 seed). |
| **D-68** | **Under the controller flag the directive card's eyebrow is `Directive`**; the receipt line carries the state. Flag-off keeps `DIRECTIVE LOCKED IN` until bug 2's PR. | D-60, A3 review N6 | **Ruled Sep 2** (A4 seed; A4.0 ruling 2). |
| **D-69** | **The non-timeout outage line.** Every persisted `haikuError.failureClass` other than `timeout` reads `No decision recorded at this check · the evaluation did not complete`; the timeout keeps D-65's more specific line. Both are true of the tick; neither names a verb the evidence does not support. | D-65, A4 review L1-F1, honesty rule 8 | **Ruled Sep 2** (A2 seed §2). Built A2.0 (`selectWhyState.js`, `battleViewCopy.noDecisionIncomplete`). |
| **D-70** | **The fifth Why? state** — `A guardrail called for a swap · it did not go through` / `The guardrail's reason · the position stayed as it was`. The gate is three PERSISTED conjuncts: `downgraded` ∧ `guardrailSourceNote` starts with `guardrail_` ∧ `guardrailOverrides.some(o => o.action === 'forced_exit')`. The third is load-bearing — `reinforced_haiku` stamps the same sourceNote while the rationale stays the agent's argument, so a reinforced swap that then fails keeps the fourth state. The pair rides the override (`symbol → replacementSymbol`); the entry's own `symbolOut`/`symbolIn` are null on a downgraded HOLD. | D-66, A4 handover item 21, C1 | **Ruled Sep 2** (A2 seed §2; rulings §2 directive 3). Built A2.0. |
| **D-71** | **The turn line past the close** — `Checked {t} · last check today`. ONE discriminator, in the adapter (`deriveLastCheckOfSession`: LIVE ∧ a last check ∧ `deriveDueAt(...) === null`), exposed as `lastCheckOfSession` and consumed by the Desk and the Battle View turn line alike; a starved cron before the close keeps a non-null `dueAt` and stays LATE. A shared Desk string, with the Desk golden updated in the same commit. | D-62, §9 | **Ruled Sep 2** (A2 seed §2; rulings §2 directive 4). Built A2.0. |
| **D-72** | **The tape:** messages + trade cards from `trades[]` (the feed joined by `evaluationId` for the directive echo, symbol pair as the fallback for risk / R11 entries) + check cards from `evaluations[]`, one stream, one sort. The motive is `rationale` and its author is named — `The agent's own words` / `The system's reason` — discriminated by the persisted `source`, which is never rendered. `message` is never the motive. The trade card replaces the slim `TradeTickerCard` line under the flag; flag-off keeps it byte for byte. | D-24, hazards 24-26, 29, 35 | **Ruled Sep 2** (rulings §1 ruling 5, §6). Built A2.2 (`buildTape.js`, `TapeCards.jsx`). |
| **D-73** | **The piece scope:** `In the chat · n` filters the tape by symbol; display only; the roster union under the flag only. | D-72, hazard 27 | **Ruled Sep 2** (rulings §6). Built A2.3 (`scopeTape.js`, `selectSymbolRoster.js`, `findKnownTickers.js`). `n` IS the length of the list the door opens — one function, so the number and the filtered tape cannot disagree (§9). Three rules, one per kind: messages by the detector, trade cards by the pair, check cards by the EXCERPT the card shows. |
| **D-74** | **The peek strip** carries the newest tape line; the desktop chat collapses to the same strip via the sheet hook; **the detent survives a breakpoint crossing** (desktop open → mobile half; desktop collapsed → mobile peek), and the A4 guard row that asserted "back at peek" moves to assert this. | A4 review M20, rulings §1 ruling 7 | **Ruled Sep 2** (rulings §6). Built A2.4 (`derivePeekLine.js`, `PeekStrip.jsx`). The hook is enabled on both shells and the desktop reads its detent as two states, which makes the survival true by construction rather than by a synchroniser. |
| **D-75** | **Why? V2:** `Bagger $ · Bust $` from the scoring path (arithmetic on two persisted values) · this piece today · the verbatim sentences of the check that NAME the piece · `Woken by …` from `triggers[]` · facts · doors. **No stop line, no alert line.** The full paragraph lives on the book panel and the check card only. | ruling 1, ruling 2, D-78, D-79 | **Ruled Sep 2** (rulings §1, §6). Built A2.1. |
| **D-76** | **The plan at deploy may render** — the brief on the book panel; a tier rationale's sentences that name the symbol on a row (`At deploy · {tier} tier`), else nothing. Gated off tournament battles (`gameMode`) and the algorithmic fallback template (`innerMonologue.strategy` begins `Algorithmic selection`); every label carries `activatedAt`. Built as its own commit so it can be reverted in isolation. | C1, Phase 0 §2.4 | **Founder's lean, ruled Sep 2 (rulings §1 ruling 4); PENDING SOL'S PASS.** Built A2.1b (`selectDeployPlan.js`, commit `ff98084f`). |
| **D-77** | **`N checks · no change`** = HOLD ∧ not downgraded ∧ no outage ∧ `scores.banked` unchanged ∧ positions unchanged ∧ receipts unchanged. **The live `total` does not count** — it moves with price every tick and the board already shows it. | D-48, hazard 28 | **Ruled Sep 2** (rulings §1 ruling 6, §6). Built A2.2; "positions unchanged" is enforced by ADJACENCY in the merged stream (every executed swap is a trade card in it). |
| **D-78** | **`-0.5× ATR` is a wake-up trigger, not a rule.** Surfaces render `Woken by a price drop` from the persisted trigger TYPE and never an alert line. One type is ruled; the other eight render nothing until each has its own sentence. | Phase 0 §2.3, hazard 30 | **Ruled Sep 2** (rulings §1 ruling 3, §6). Built A2.1. |
| **D-79** | **Two api-side minimum writes recorded for later rulings:** a per-position `stopPrice` stamp (fenced basis, §7) and the tick's `anticipationCandidates` on the evaluation entry (non-fenced; a C1/copy question before a data one). | Phase 0 §2.2, §2.5 | **Recorded Sep 2** (rulings §6). Not A2 work. |
| **D-80** | **A machinery-provenance code never reaches the screen, even inside an engine's verbatim sentence.** The cron composes a forced exit's rationale as `Guardrail override ({sourceNote}): …` (`agent-evaluate.js:2121`), splicing `guardrail_{forcedType}` into text C1 renders verbatim. The guardrail TYPE is a fact a player can read, so it renders in the words that guardrail is called by — a three-entry table, `stop-loss` / `trailing stop` / `profit target`, the founder's existing swap-ledger taxonomy. Any other token loses the parenthetical entirely. | C1, hazard 29, D-64, A2 review L5-F3 | **Ruled Sep 3** (addendum §1 ruling 1, §3). Built A2.3 session, first commit (`renderMotive` in `selectWhyState.js` — the ONE place a rationale becomes display text, so every surface shows one sentence). |
| **D-81** | **The nine trigger strings.** All nine types `agentTriggerGate.js` persists have a ruled sentence; `threshold_proximity` reads `Woken by a piece **near** a scoring tier` (a state, not a motion). A trigger renders a fact about why the model was WOKEN, never what it will do. An unknown type renders nothing — never a raw type string. | D-78, A2 handover §5 | **Ruled Sep 3** (addendum §1 ruling 2, §3). Built A2.3 session. **Consequence:** a run folds only when two adjacent quiet checks would render the same card (review L1-F6), and the trigger line is part of it — so fewer runs fold now that nine reasons are distinguishable. |
| **D-82** | **D-71 ships unflagged on the Desk.** The bare `Checked {t}` read as a starved cron; the new line is a scoreboard fact and, after the calendar-day conjunct in `deriveDueAt`, it is date-safe. It is the one user-visible change in A2's merge. | D-71, A2 handover 40, A2 review L3-F4 | **Ruled Sep 3** (addendum §1 ruling 3, §3). Already built A2.0; recorded here as sustained. |
| **D-83** | **A check is named by its CRON SLOT on every surface; exact timestamps are for ordering only.** `scoreState.lastScoredAt` and the entry's own `timestamp` are two `new Date()` calls inside one cron run, so one tick was called `12:30 PM` by the header and `12:31 PM` by the card. One helper, `slotLabel(iso)` in `deriveTurnLine.js`, floors to the quarter hour in ET; the evaluate cron is `*/15` and ET's offset is a whole number of hours, both pinned by tests rather than by comment. A TRADE keeps its exact minute — a swap executes at an instant. | §9, D-62, the founder's A2.2 smoke | **Ruled Sep 3** (addendum §1a item 8, §3). Built A2.3 session, then **corrected twice by its own review.** (1) The build first scoped it to the flagged surfaces; two lenses found that the turn line renders the DESK's strings, shared under D-62, so one tick had begun to read `12:47` in one test and `12:45` in another. The flooring moved into `deskCopy`'s four posture composers — "every surface" is now literal. The Desk is itself dark (`COMMAND_CENTER_SYNC_ENABLED = false`), so this is latent until that flag flips. (2) It over-reached on the `next ~` argument: the label showed the SLOT while the adapter withheld on the raw candidate, so `next ~12:45 PM` stayed on screen at 12:47 for as long as the last check was late. `deriveNextDecisionAt` now withholds once the slot the label shows has strictly gone by, and still returns the exact instant — the LABEL/INSTANT split is the rule's second half. |
| **D-84** | **The tape renders four visual kinds in one stream** — character speech, the player's messages, engine records (check and trade cards), directive cards — and a RECORD NEVER WEARS THE SPEECH BUBBLE. A record is flat: no fill, no radius, no tail, full column width, a 2px left edge from a token, a mono eyebrow, and the first sentence with `Read more`. A swap is a receipt and a check is a log line; neither is another voice in the conversation. | D-72, D-64, §10 | **Ruled Sep 3** (addendum §1a item 9, §3). Built A2.3 session (`TapeCards.jsx`; the three shipped kinds are untouched, which is why the flag-off goldens are byte-identical). |
| **D-85** | **The player's row carries the current price beside the % change under the flag**, read off the row's own `currentPrice` — the same field `computeProximity` consumes and the same enriched asset the Why? panel's `Bagger $ · Bust $` is derived from, so the dollars on the row and the dollars in the panel cannot come from two prices. The CPU side is unchanged. | §9, D-75 | **Ruled Sep 3** (addendum §1a item 10, §3). Built A2.3 session (`TacticalRow.jsx`). |
| **D-86** | **Every tape entry says what KIND of thing it is, from the persisted type — never from the text.** `Status check · {t} · {state}` on a check card ({t} the cron slot, D-83); `Bench note` (`anticipation`), `Trade note` (`trade_narration`), `Opener` (`first_message`), `Reply` (a `user_initiated` exchange that HAS a user half), `Directive` as shipped. `auto_debrief` keeps its shipped `Post-Market Debrief` and gains no second eyebrow. **An unknown type renders NO eyebrow** — a new server type reaches the design chat before it reaches the screen. The two absence labels (D-65, D-69) keep `{t} · {label}`: they already end in "at this check", and rewording a ruled string to fit an eyebrow would be a ruling. | D-84, D-83, hazard 24 | **Ruled Sep 3** (flip-prep seed item 2). Built flip-prep session (`battleViewCopy.js`, `AgentChat.jsx`, `deriveChatMessages.js`). |
| **D-87** | **The model's own `**…**` renders as emphasis and its strays are stripped — no word, order, punctuation or space changes.** The visible text of any rationale is exactly the source minus its markers, stated as an equality rather than sampled. Pairing is left-to-right; an unmatched marker is dropped and never allowed to emphasise the rest of the paragraph. ONE function for all three surfaces (Why? row, book panel, check card) so a sentence cannot be shown three ways. Markers are also TRANSPARENT TO THE SENTENCE SPLIT: a full stop followed by `**` is still a boundary, and the pair survives the split intact. | C1, §9 | **Ruled Sep 3** (flip-prep seed item 3). Built flip-prep session (`selectWhyState.js`, `WhyPanel.jsx`, `TapeCards.jsx`). |
| **D-88** | **The unread mark counts what the TAPE renders, not raw `statusFeed` actions.** Under the flag the feed no longer feeds the stream and ruling 9 lists six of its actions the tape shows as nothing — so the dot promised "new activity" for events the tape is forbidden to show, `guardrail_forced_swap` most sharply (hazard 25). The source is the merged recorded tape — the same list `In the chat · n` counts and the peek line reads. The A4 rules stand: a fresh mount treats everything as unseen; the mark is the count AND the newest rendered entry's stamp, so a cap roll still lights; it moves in an effect, never during render. | hazard 14, hazard 25, §9, rulings §3.9 | **Ruled Sep 3** (flip-prep seed item 4; recorded in the A2 review §5 item 12 and ruled here). Built flip-prep session (`AgentBattleScreen.jsx`). |
| **D-89** | **The book panel opens COLLAPSED with a bounded expansion and a way out; `Read the full check` opens the check's own CARD.** Collapsed: the slot eyebrow, the state, `Woken by …`, the first sentence, `Read more`. Expanding renders the rest inside a bounded, scrollable region that never pushes the board off-screen, and brings the deploy brief and the door with it. A visible close collapses the panel and returns focus to the score header, which owns its `aria-expanded`. The row door no longer opens that panel: it opens ABOVE THE BOARD, so a reader on a low row was thrown to the top of the page to read one paragraph, with no way back and the board they were reading now off the screen. (Both surfaces read the same `latestDecision`, so it is always the same tick — only the extract differs. An earlier draft of this row claimed otherwise and is corrected.) It opens the conversation (desktop: the column; mobile: the sheet to FULL) at that check's card, expanded, focused. A pinned card is never folded into a `{n} checks · no change` run. | D-75, D-77, ruling 4 (superseded), §9 | **Ruled Sep 3** (flip-prep seed item 1). Built flip-prep session (`WhyPanel.jsx`, `AgentBattleScreen.jsx`, `AgentChat.jsx`, `buildTape.js`, `TapeCards.jsx`). **Supersedes A2.3's ruling 4**, which sent this door to the book panel. |
| **D-90** | **The send-failure line says only what the client can see.** Under the flag: `The character couldn't answer just now`. The `· nothing was sent` clause is removed — `api/agent/chat.js` writes the exchange and increments the budget in ONE `battleRef.update()` inside the `try` whose `catch` returns the 500, so the promise was not merely unprovable but sometimes FALSE. Item 11's own reasoning condemns it: a message that WAS spent, believed free, re-sent, is charged twice out of ten. The clause returns when the server attests to it. Flag-off keeps the shipped string until bug 2's PR. | honesty rules, A2 review RB-F4 | **Ruled Sep 3** (flip-prep seed item 5). Built flip-prep session (`battleViewCopy.js`). |
| **D-91** | **The character IS the controller.** The agent's mark on the board is the one door to the conversation: it opens a pane that holds Chat, Bench and Tape, and it carries the unread count. The avatar is the **presence face** (`AgentPresenceMount`, the mark already on this header at `AgentBattleScreen.jsx:278-285`) rendered through a new `reactivityLevel` prop as `static` — one painted frame, no rAF, no idle, no breath — with its `events` **withheld**, so it never moves between events (hazard 41). The Forge mech (`MechSVG`) the mock draws is not used: it is a Forge asset with no head crop and its own blink and breath timers. The face keeps the agent's DNA accent (`resolveAccent`), which no token can express. | Phase 0 §2.2, §4 #3, hazard 41 | **Ruled Sep 4** (A3 rulings §2 #3). Built A3.1. |
| **D-92** | **Bench quotes the decider only.** Bench lists the bench roster — the union of `portfolio.bench.{stocks,crypto}`, `watchlist.hotBench[]` and `agentContext.equippedWatchlist.tickers[]`, **minus the book**, deduped, in list order — under the equipped watchlist's bare name, and beside each name renders the sentences of the last DECIDED check's `rationale` that name it. One split, then a filter per symbol, through the same `splitSentences` / `namesSymbol` / `parseEmphasis` path the row, the tape scope and the check card already share (D-87) — Bench is the fourth consumer, never a copy. **On an outage tick Bench SCANS BACK** to the last check whose entry carries a rationale and labels that slot; `selectLatestDecision` is null on such a tick and would otherwise claim a silent day (hazard 40). The absence line renders only when no entry today carries words. A narrator exchange can never reach Bench: the selector's only text input is `evaluations[].rationale`. No bench price is polled — the mock's per-name `%` has no source and is not built. | Phase 0 §2.5, §2.6, §4 #11, hazard 40 | **Ruled Sep 4** (A3 rulings §2 #11). Built A3.3. |
| **D-93** | **The strip and the sheet retire under the pane flag (D-74 superseded).** The pane replaces the desktop `PeekStrip` column and the mobile `ChatSheet` at the screen's six wiring sites; each site branches `paneOn ? … : <the A2 JSX as merged>`, so pane-off renders A2 byte for byte. `useChatSheet` stays **called** with `enabled = controllerOn && !paneOn` — disabled it reads peek and resets to peek, so hooks order never changes and nothing A2 can render open beneath the pane (hazard 44). The pane gets its own pure machine, `useCharacterPane`. The one `AgentChat` keeps **one tree position** across collapse, expand and section changes: Bench and Tape HIDE the Chat section, never unmount it, or the draft, the in-flight send and the scroll are lost (hazard 45). | Phase 0 §2.1, hazards 44–45 | **Ruled Sep 4** (A3 rulings, §4). Built A3.2. |
| **D-94** | **Game Tape and the watchlist chip leave the header; Tape is a pane section with its bookmark control.** Under the pane flag the header link, the overlay and the chip are not rendered — `gameTapeOpen` stays false and its five consumers are inert without an edit — and the watchlist's bare name moves to Bench's subtitle from the same field. Tape renders trade cards through the shipped `TradeCard` over the same `tapeEntries` the chat renders, and keeps the **shipped** add / remove bookmark control (a moved client write, shipped behaviour) and the activity log as they are. The header's bookmark dot becomes a **count on Tape's own section header** (`Bookmarks · n`) and appears nowhere on the board. | Phase 0 §2.3, §4 #12 | **Ruled Sep 4** (A3 rulings §2 #12). Built A3.4. |
| **D-95** | **The bug button retires into the overflow, through the `App.jsx` mount seam.** `ClashBotWidget` is mounted once, globally (`App.jsx:12382-12390`), fixed bottom-right with an infinite CSS pulse — exactly where the avatar goes (hazard 36). The hide seam lives at the **mount**: the widget takes a `hidden` prop, true when the character pane is on and the active screen is the agent Battle View. The pane's `···` overflow opens it by dispatching `CustomEvent('clashbot:open')`, which the widget subscribes to; a second widget inside the pane would double the panel and its cooldown. A small widget render test covers `hidden` and the event; `App.jsx` stays covered by `vite build` alone (BUILD_RULES §2). The overflow holds `Report a bug` **alone** — the mock's `Read · Equip` is not built. | Phase 0 §2.3, §4 #6, hazard 36 | **Ruled Sep 4** (A3 rulings §2 #6). Built A3.5. |
| **D-96** | **The score header is the arena.** A new `ArenaHeader` under the pane flag; the shipped `ScoreHeader` untouched for pane-off. The player's side takes **`--ft-teal`** (parity with the shipped score colour) and the CPU's **`--ft-copper`** — added to `tokens.css` and `tokenBaseline.json` from the value that already exists twice in legacy JS (`CMD.copper`, `DARK_TOKENS.warmCopper`), so it is a **token addition, not a new hex**. The theme guard cannot enforce this — `#e8927c` is not a core-palette hex and a raw literal would pass silently (hazard 42) — so the review enforces it. The seam is the **shipped `computeTugOfWarWidth`**, never a second derivation (§9). `VS` sits in the centre slot so the accessible order stays player → VS → CPU. The header lets the **existing** starfield canvas through; it never mounts a second one (hazard 39). No radius token exists, so the bubble's radius is the literal `4`, written once with a comment. | Phase 0 §2.2, §4 #4–#5, §9, hazards 39, 42 | **Ruled Sep 4** (A3 rulings §2 #4–#5). Built A3.0. |
| **D-97** | **Motion marks EVENTS, never states.** The bagger burst keys on the **persisted** transition — `thresholdHistory[sym].maxMultiplier` `< 1.0` on one snapshot and `≥ 1.0` on the next, seeded silently on the doc's first snapshot, a decrease re-seeding and never firing — and never on the live merge, or a price flicker fires it twice (hazard 37). The row's `BAGGER` tag **is the shipped badge**, live-merged as it ships; the burst, the footer and the bubble are the persisted-only additions. `ChamberFuse`'s 400 ms flash stays and marks the **price** crossing: two events up to a tick apart, not one event shown twice (hazard 38, recorded). `Bagger hit · {mult}× banked` reads the row's **conviction tier multiplier** (`2× / 1.5× / 1×`) — the number the player is playing for; `banked` stands because the history is monotonic and the tier bonus banks by construction. `Bagger · {sym} hit {pct}` reads the **bagger line** `+{baseATR}%`, the persisted threshold the row's `%` reads at that price. **Bagger only in A3.6**; double and ten are the same path with a different constant, ruled later. The avatar never moves between events; no new CSS keyframe. | Phase 0 §2.4, §4 #7–#10, hazards 37–38, 47 | **Ruled Sep 4** (A3 rulings §2 #7–#10). A3.6, next session. |
| **D-98** | **The bubble is sharp and unstriped, and its eyebrow shares the stream's kind colours.** No tail, no fill stripe, no `14px 14px 4px 14px` corner — the literal `4` and nothing else; the eyebrow carries the kind as **text**. It is composed of nothing: the eyebrow comes from `tapeKindEyebrow` and the line from the `derivePeekLine` helpers, never assembled by hand. Its colours are the record edges' existing `LABEL_COLOR` for records and `text-muted` for speech — and **the chat's own eyebrows adopt the same colours under the pane flag** (a gated change in `AgentChat.jsx`, flag-off byte-identical), so the bubble and the stream can never disagree about a kind (hazard 43). The fade is asserted by attribute or state, never by timing (hazard 47). | Phase 0 §3 item 11, §4, hazards 43, 47 | **Ruled Sep 4** (A3 rulings §3). Built A3.1. |

### 15.1 Corrections of record (Phase 0 V2, `main` @ `bd608373`; Phase A Phase 0, `aca8bf7`)

**Corrections of record (from Phase 0 V2, `main` @ `bd608373`):**
- **D-44 corrected.** The absence state is *not* primary. `rationale` is required on every decision including HOLD (`agentEvalToolSchema.js:10`) and is persisted (`agent-evaluate.js:2637`). Why? on a held position shows the agent's own words from the last decision. What a quiet hold skips is the statusFeed entry (`:2587`). **New third state:** seven sites downgrade a SWAP to HOLD without rewriting `rationale` (`:2129, :2144, :2152, :2163, :2217, :2223, :2465`); Why? must branch on `downgraded` (`:2658`) and label that state *argued for a swap · held by a guardrail*. Absence applies only when no evaluation entry exists for the tick (five early returns advance `lastScoredAt` without one).
- **D-48 qualified.** `scoreState.lastScoredAt` is a true snapshot boundary (single atomic `battleRef.update` at `:2796`) but means *the tick ran*, not *a decision was made*. The turn line keys "checked" to `lastScoredAt` and "decided" to a new `evaluations[]` entry. A missed check has no marker; only a gap beyond cadence + grace.
- **D-51 qualified.** `Replaced` may show the prior directive's text and time (recoverable from `chatExchanges`, `chat.js:571-618`) but may never claim the agent did not see it — the tick reads a stale directive snapshot (`agent-evaluate.js:562-571`). Only D-52's stamp can support that claim.
- **Foundation §0 corrected.** There is no open Pass 1 flip PR; the branch `claude/cc-sync-flip` exists with one commit. P-4 is on `main` (`9adc51ec`, `firestore.rules:704-710`), solved by a battle-doc `get()`.
- **Foundation §1.2 corrected.** "A quiet HOLD writes nothing" is true of the statusFeed only; the reasoning is written. The one-field fix targets `battle.evaluations[]`, not `controlEpochLog`, and buys the ceiling only — Why? needs no write.
- **Foundation §1.4 addition.** `debate.js` guards the **book only** (`agentScoring.js:36-51`); widening to the bench is non-fenced (`flattenBenchServer` already exported). Its response carries `suggestedAction`, which no research card may render. The DebateModal entry point is not wired from the live screen.
- **Hazards 1–16** from Phase 0 V2 §3 are build constraints for every task in this arc.


---

## 16. Discovery follow-ups remaining (read-only, hard STOP)

7. **Chat context vs. eval context, side by side.** What `chat.js` + `voice-layer-cache.js` assemble versus `agentEvalPromptAssembly.js`, same live battle, field-level diff with `file:line`. **Highest-value unrun item** — sizes front-door Condition 1. Output is a divergence list on *shared* concepts, not a shovel list (§12).
8. **Per-directive receipt, sharpened.** Does every applicable eval deterministically ingest the current `battle.directive` into the decision context? Is there *any* write, keyed by `directiveThreadId`, that fires for a directive the eval saw but did not trade on — including honored "hold" directives that by nature produce no trade? If NOT FOUND, name the minimum non-fenced write that would provide one, without designing it. **Gates §8.2.**
9. Directive visibility in league — whether league battles write `agentBattles.directive` at all.
10. Weekly-score path — where snake-draft daily-close aggregation lands; readable from the chat route?
11. BEM `VOICE_SEQUENCE` shipped surface.
12. Fence check on 7–11.
13. **D-16** — chat mode selection during LIVE_CLOSED and its budget. **Pass 1 spec gate.**
14. **D-17** — `directiveGate` flag state at HEAD, `file:line`. **Pass 2 gate.**
15. Which branch holds `isPreOpenOnBattleDay` / `usePreOpenPhase`.
16. **Budget check atomicity.** Is the `chat.js:237` check and the `:623` increment in one transaction? Can two simultaneous requests at 9/10 both pass and both charge? **Gates P-1c.**
17. **`pendingReflection` consumer.** `completeBattle` stamps it (Q9.1). Does `agent-batch-review` or anything else read it? **Gates P-6 design.**
18. **Single-ticker research path.** What endpoint(s) produce the Research Intelligence Hub / Stock Intelligence Agent output for one symbol? Callable server-side from `chat.js`? What do they return (fields, technicals incl. RSI / MA distance / correlation)? **p50 and p95 latency, and cost per call.** Latency decides whether §7.1 runs in-turn or async. **Gates §7.1 shape.**
19. **`research_only` handling today.** Exactly what `directiveGate.js` does with a `research_only` classification and what the user currently sees. Is there a clean seam to branch to a research call instead of null? Does anything else (Signal Drop) already call research from the chat path? **Gates §7.1 integration.**
20. **`nextDeployCandidates` landing.** Is there an existing per-agent "suggested for next deploy" field or Equip chip pattern to reuse, or is this net-new on `agents/{id}` + `EquipBench.jsx`?

---

## 17. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Score proximity read as action proximity by users | **High** | §5.1 copy rule; no "about to," "close to trading," or agent-verb framing. Harness fixture. |
| Pass 1 reads BaggerBomb fields directly; league becomes a rewrite | **High** | §3 rule in the spec; CC DO-NOT list |
| Front door exposes the precedence contradiction before fix | **High** | §12 gate bites at Pass 2; P-7 pre-Pass-2 |
| `directiveGate` in `observe` at HEAD — central guarantee not live | **High** | D-17 hard Pass 2 gate |
| Ledger overclaims "Seen" or "Declined" without a receipt | **High** | §8 floor by default; ceiling on evidence only |
| Silent directive replacement across two surfaces | High | D-18 declared; current directive shown before send; SUPERSEDED rendered |
| Post-close TOCTOU | High | P-1a |
| Budget double-charge under two surfaces | Medium | P-1c |
| Agent promises persistence it cannot deliver | High | P-2 now; §6.4 copy in Pass 2; fixture |
| Opponent reads proximity via `voiceLayerCache` | High (standing) | P-4 pre-Pass-1 |
| "Debrief pending" becomes permanent | High | P-6 liveness pre-Pass-1 |
| Desk inherits dead breakthrough promises | Medium | P-5 pre-Pass-1 |
| Honored "hold" directives are receipt-less and look ignored | Medium | §8.1 copy: Filed is a truthful state; item 8 may raise the ceiling |
| Entry cards re-teach intervention-when-losing | Medium | §6.1 symmetry; watch card-tap distribution in beta |
| "File this" becomes a directive cannon | Medium (Pass 4) | flagged, instrumented, default may be off |
| §7.1 research slice creeps into the full lane | Medium | single ticker, on request, cap 3/battle, no screener, no "file this"; anything more is Pass 4 |
| Research findings read as a promise to act | Medium | three-beat copy; evidence not trigger; "next deploy" is the only forward path |
| `nextDeployCandidates` becomes a second write-only sink | Medium | chip ships in the same pass as the write, or neither ships |
| Async research turn built when in-turn would do | Low | item 18 latency decides before spec |
| Adapter v1 schema hardens into a false universal | Medium | §3.2 provisional; validated by league adapter |
| 10/day too tight once cards invite conversation | Low under fullday | tuning ledger; revisit at D-14 |
| Parallel design chats diverge | Medium | §0 authority ruling; this document is the merge point |
| Research lane cost creep | Medium (Pass 4) | D-12 |

---

## 18. Next step — Pass 1 spec, gated

Sol's second pass is complete and does not require a third on this framework. His disposition: *"If those results come back clean, I no longer see a reason to stop the Command Center arc."*

**Before the Pass 1 spec is frozen:**
1. ~~Founder confirms D-13 and D-18~~ — **done Aug 31.**
2. Founder confirms D-1 / D-15 (rename; "Huddle").
3. CC runs discovery items **13 (D-16)** and **17 (`pendingReflection`)** — two short read-only questions, foldable into the Pass 1 spec's own Phase 0.
4. P-6 is written as liveness in the spec's prerequisite list.

**Before the Pass 2 spec is frozen:**
1. CC runs discovery items **8, 14 (D-17), 16, 18, 19, 20.**
2. P-1a/b/c and P-7 are written as prerequisites, each claiming only what discovery proved.
3. Ownership of the `voiceLayerPrompt.js` four-zone blocks confirmed with the harness-revamp workstream — **ask now, not at Pass 2.**
4. §7.1 shape (in-turn vs async) decided by item 18.

**P-2 does not wait for either.** One line, own PR, now.

**Do not issue a build prompt from this document.** It is a framework, not a spec. The Pass 1 spec is the next artifact, and it goes to CC for its own Phase 0 before any branch exists.

---

## Appendix C — Sol V1.1 findings, disposition

| Sol finding | Severity | Disposition | Where resolved |
|---|---|---|---|
| "Predicts" → "measures" | wording | Sustained | §5.1, §0.2 |
| §11/§12 front-door sequencing contradiction | BLOCKER | Sustained; gate bites at Pass 2; Condition 2 → P-7 pre-Pass-2 | §12, D-13 |
| Ledger "Seen" unprovable for not-honored; "hold" directives receipt-less | BLOCKER (Pass 2) | Sustained, and worse than V1.1 admitted; floor/ceiling split | §8, item 8 |
| P-1 does not fix last-write-wins; budget atomicity unproven | MAJOR | Sustained; P-1 split into a/b/c; D-18 declares the slot contract | §10, D-18, item 16 |
| §6 assumes enforce; §13 admits unknown | MAJOR | Sustained; §6 rewritten; D-17 elevated to hard Pass 2 gate | §6, D-17 |
| P-6 understates — pending without liveness hides a broken pipeline | MAJOR | Sustained; P-6 = pending UI + guaranteed debrief; pre-Pass-1 | §10, D-19 |
| Condition 1 wording — parity ≠ superset | MAJOR | Sustained; reworded to shared truth on overlapping concepts | §12 |
| Adapter schema is BaggerBomb-shaped | MAJOR (architecture) | Sustained; rule locked, schema provisional until league validates | §3.2 |
| "File this" is a self-proposal loop | advisory | Accepted; Pass 4 central experiment, flagged and instrumented | §7 |
| Messaging must be present-tense | advisory | Accepted | §7, §12 |
| D-1 rename; "Huddle" | withdrawn | Sol no longer objects | D-1, D-15 |

---

## Appendix A — Sol V1 findings, disposition

| Sol finding | Severity | Disposition | Where resolved |
|---|---|---|---|
| Battle live / market closed unhandled | BLOCKER | Sustained; premise reduced (fullday at HEAD) — state still exists overnight | §4 |
| Sequencing backwards | BLOCKER | Sustained; discovery ran before V1.1 | §0, process |
| D-3 may violate no-fence | BLOCKER | Sustained → resolved: non-fenced `voiceLayerCache` path | §5.1 |
| C2 contradicts seeded cards | BLOCKER | Sustained; C2 restated; payload rule added | §5.4 |
| One-active-battle assumed | BLOCKER | Sustained; premise false; resolved by scope | §3.1 |
| "What would move me" is a causal promise | MAJOR | Sustained → reframed to score | §5.1 |
| No common distance metric | MAJOR → **upgraded to BLOCKER** by Fable | Sustained → resolved: `currentMultiplier` in uniform ATR units | §5.1 |
| Competitive leak | MAJOR | Sustained; own-portfolio ruling + P-4 | §5.5, §10 |
| Tier lock ≠ conversational honesty | MAJOR | Sustained; discovery found it live (`permanent`) | §6.4, P-2 |
| Directives not archetype-aware | MAJOR | **Overruled by discovery** — `directiveGate.js` is the keystone and works; flag state to confirm | §6, D-17 |
| 10-message budget not a tuning value | MAJOR | Sustained; Low rating overruled; card deleted | §6.1, §17 |
| Battle-close race | MAJOR | Sustained; P-1 | §10 |
| Dual surface races | MAJOR | Sustained; P-1 | §10 |
| Rename riskier than admitted | MAJOR | **Substantially deflated by discovery** — 5 strings, 0 persisted | D-1 |
| Quiet not proven a failure | MAJOR | Sustained; softened — honest idle state already ships | §5.3 |
| Cards frame around losing | MAJOR | Sustained; symmetric set | §6.1 |
| Shipped ≠ reusable | MAJOR | Sustained; register verified per asset | §13 |
| Post-close continuity gap | MAJOR | Sustained; Game Tape shows no directives | §8, Pass 2 |
| LLM text ≠ fabrication | MINOR | Accepted on reasoning; prohibition kept for beta on provenance grounds | §5.4 |
| Risk register underrepresents | MAJOR | Sustained; rewritten | §17 |

## Appendix B — Phase 0 verdicts

| Blocker | Verdict | Basis |
|---|---|---|
| B1 | CONSTRAINED | live+closed derivable from `getMarketState()` + `status`; fullday at HEAD; `isPreOpen*` NOT FOUND |
| B2 | n/a | process; corrected in sequence |
| B3 | CONSTRAINED | `voiceLayerCache.thresholdProximity` persisted, comparable, non-fenced; no unified cross-condition score; any-auth read |
| B4 | CONSTRAINED | Pulse portable, statusFeed opponent-safe; no seeded param; `directiveThreadId` last-write-wins; 4/5 alert types dead |
| B5 | CONSTRAINED, premise false | two live battles possible (ranked + BaggerBomb clone); resolved by scope |

---

*Prepared August 31, 2026. Design authority: Fable, this chat. Locked items are marked LOCKED. Sol's second pass is complete; D-13 and D-18 confirmed; D-20 deferred; D-21 ruled. Nothing here is a build instruction.*
