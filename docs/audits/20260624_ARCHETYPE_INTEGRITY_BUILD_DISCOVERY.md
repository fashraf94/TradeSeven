# Archetype-Integrity "Third Path" — Build-Discovery Report
### FantasyTrades · CC build-discovery for *Grounded Spec V1* · 2026-06-24

**Repo:** FantasyTrades @ `/home/user/TradeSeven` · **HEAD:** `f8c2316` (matches the spec's citation baseline) · **Branch:** `claude/optimistic-ritchie-pcg195` · **Tree:** clean.
**Mode:** Read-only discovery (BUILD_RULES §3). No project code edited. Fenced files were *read* (permitted); none edited. The repo is a shallow clone; history was **not** unshallowed.
**Provenance note:** The spec's grounding doc (`20260623_ARCHETYPE_INTEGRITY_DISCOVERY.md`) is **not in the repo** — it is external founder context. Per BUILD_RULES §3, every inherited anchor below was **re-verified against HEAD `f8c2316` this session**; VERIFIED = code read this session, ASSUMED = inferred.
**What this is:** the §7 build-discovery the spec asks CC to complete *before/while planning*. It re-verifies the anchors, resolves all five open questions, surfaces three risks the spec did not name, and proposes a phased build plan. **This is a hard STOP for founder review — no code is written from it until you approve.**

---

## Executive verdict

| # | Open question (spec §7) | Verdict | One-line answer |
|---|---|---|---|
| **1** | Capabilities-manifest source | **MUST BE ASSEMBLED** | No manifest exists. Only **2 of 6** levers are real (`short`-via-flip, `claims`) — both tournament-only; `hedge`/`options`/`sector-hedge` **don't exist at all** (safe by construction). Assemble in the chat handler, keyed off `gameMode`. |
| **2** | Allowlist coverage of today's directives | **UNDER-COVERS → needs pass-through** | Allowlist cleanly covers tunable-execution + risk-posture. But the **modal real directive is a sector+symbol composite** ("lean into semis; NVDA Star") that allowlist-only would silently drop. Add **one narrow scoped-emphasis pass-through**. |
| **3** | Structured-output reliability | **CONFIRMED RELIABLE** | Gemma already runs in `response_format: json_object` and emits a 7-field object; a tolerant 4-tier parser never throws. Adding a `proposal` block is low-risk. Fail-safe is trivial: bad/absent proposal → no lean, conversational. |
| **4** | Gate placement in `chat.js` | **CONFIRMED — clean single chokepoint** | `normalizedDirective` (chat.js:352) is the *only* feed to all 3 directive writes, and chat.js:458-470 is the *only* live `battle.directive` write path. The brain reads it at exactly one (fenced, text-agnostic) site. |
| **5** | `archetypeCharacter.js` Node-cleanliness | **CLEAN — safe to import** | Whole import graph is zero-React/zero-SDK. `api/` may import it under BUILD_RULES §4 with a dependency-surface guard. But its content is *display copy*, not gate-grammar — the allowlist is new data regardless. |
| — | **Overall** | **GO — with 3 caveats + 1 design fork** | The architecture is sound and buildable. Three things the spec didn't name must be decided (below); one genuine design choice is yours to make (the pass-through). |

**The spec's headline principle survives discovery intact:** *the character is a prompt; the guarantee is a gate.* The gate's chokepoint is genuinely singular and the brain's directive intake is genuinely single-sited — so a deterministic write-path gate **can** make "chat looks fixed but behavior drifts" impossible. The one adjustment discovery forces: the gate's grammar is not *pure* allowlist-ids; it is **allowlist-ids + a bounded, positive-emphasis pass-through** (still deterministic, still non-core-reversing by construction — see Q2 and the design fork).

---

## Part A — Anchor re-verification (vs HEAD `f8c2316`)

Every spec anchor was re-read this session. All core claims **hold**; three carry line-drift or wording refinements the build must respect.

| Spec anchor | Claim | Verdict | Actual location / refinement |
|---|---|---|---|
| `agentPromptAssembly.js:49-52` | Draft brain gets archetype as a bare label | **VERIFIED** | Exact. `Archetype: ${archetype}` (de-underscored capitalize → "Momentum chaser", *not* the display name). Belief only enters via system-prompt `ARCHETYPE_CONSTRAINTS` (:13-15). This file builds the **Sonnet draft** brain. |
| `agentEvalPromptAssembly.js:40, :487-490` | Eval brain gets bare label + dials | **VERIFIED** | :40 system-prompt `Your archetype is ${archetype}`; :487-492 cacheable identity block (label + `Risk Tolerance`/100 + `Evaluation Interval`). Zero structured identity. |
| `voiceLayerPrompt.js:2779` (`getArchetypeLabel`) | Voice gets bare label | **VERIFIED — refine** | Imported at :14; injected at **seven** identity blocks (:2490/2551/2611/2779/2981/3208/3434), each as "Your archetype is X." **Refinement:** the voice prompt carries **no numeric dials at all** — the dials live in `ARCHETYPE_CONFIGS` but never reach voice. |
| `voiceLayerPrompt.js:61/98/130` | Honest-pushback exception is weak/permissive/bare-decline | **VERIFIED** | Byte-identical "EXCEPTION — honest pushback … you may decline in character" in all 3 phase blocks, under the comply-prior "if you're unsure whether they confirmed: they confirmed." Its own canned example is a *flex* case, not a core attack. **Build note: triplicated — edit all 3 or refactor to a shared constant.** |
| `agentArchetypeConfig.js:229-230` (`getArchetypeLabel`) | Maps code-id → label | **VERIFIED** | `ARCHETYPE_CONFIGS[archetype]?.label \|\| archetype \|\| fallback` (default `'strategist'`). Six labels confirmed. |
| `decide.js:242-244` | Numeric dials make trades archetype-shaped | **VERIFIED** | `computeArchetypeRankings` (the ARCH fit-sort) + `ARCHETYPE_TEMPERATURES` (sampling temp, used :309). |
| `chat.js:75-80` (`normalizeDirective`) | Directive normalization site | **VERIFIED — drift** | Actually **:75-83**. Does **zero** semantic/class validation — `{text, expiry}` passes verbatim. |
| `chat.js:352-353` (review strip) | Review mode forbids directives | **VERIFIED** | Exact. `normalizedDirective = mode === 'review' ? null : normalizeDirective(parsed)`. |
| `chat.js:458-468` (battle write) | Directive write path | **VERIFIED — drift** | Actually **:458-470**. The **only** live `battle.directive` write in the codebase (positively swept — see Part C). |
| `archetypeIdentity.js:18-61` | disposition/reveal/voice; zero imports | **VERIFIED** | Exact; momentum_chaser :19-25; **zero imports (Node-clean)**. |
| `archetypeCharacter.js:57-137` | Richer 4-axis copy ≈ the four zones | **DRIFTED (partial map)** | Content verified, but the four axes are **not** the four zones: `hardRule`→immutable core (good, physics-backed), `huntsFor`→protected bias, `positionStyle`→tunable execution, but `temperament` is a **display-only** slider and there is **no out-of-scope/user-lever axis and no allowlist**. It is frontend UI copy, **not consumed by the api/ runtime**. |

**Net for the build:** every root-cause claim in spec §1 is real. The one structural correction: **philosophy must be injected into the VOICE layer only.** The brain/eval bare-label is root-cause *context*, but `agentEvalPromptAssembly.js` (and `agentArchetypeConfig.js`) are **on the calibration fence** (BUILD_RULES.md:21) — so you cannot install a four-zone identity block or allowlist by editing them. This matches the spec's voice-scoped design and the §3 principle (gate upstream, in non-fenced `chat.js`).

---

## Part B — The five open questions, resolved

### Q1 — Capabilities-manifest source → **MUST BE ASSEMBLED** *(highest-priority unknown)*

No `capabilities` / `user_can_*` / manifest record exists on any battle, group, or user doc. Per-lever reality:

| Manifest field | Real? | Gated by | Source (file:line) |
|---|---|---|---|
| `user_can_short` | **Yes — via flip only** | tournament + `GROUP_STATUS.BATTLE` | `LEG_DIRECTION.SHORT` `leagueTournament.js:99`; reached via `api/tournament/flip.js:156-157`; picks default long `resolve-user-draft.js:162-167` |
| `user_can_make_claims` | **Yes** | tournament + ET claim window | `api/tournament/place-claim.js:89-93` (status), `:69-74` (window); cap `CLAIM_PENDING_CAP_PER_CYCLE:3` `leagueTournament.js:806` |
| in-battle flip (mechanism behind short) | **Yes** | tournament + BATTLE | `flip.js:139-150,190-191`; cap `FLIP_CAP_PER_DAY:5` `leagueTournament.js:805`; per-pick `flipCountToday` `:882` |
| `user_can_hedge` | **No — does not exist** | — | all "hedge" hits are prompt vocabulary / tone copy, no endpoint or field |
| `options_enabled` | **No — does not exist** (separate arcade game only) | — | no tournament options lever/flag anywhere |
| `sector_hedges_enabled` | **No — does not exist** | — | zero `sectorHedge`/`sector_hedge` matches |
| `max_user_actions_remaining` | **No unified budget** | — | only the two caps above + per-pick `flipCountToday`; **claims-remaining is derived** (live count of pending claim docs vs 3, `tournamentClaimPlacement.js:110-114`), not stored |

**Assembly recipe (keyed off `gameMode`, in the non-fenced chat handler):**
- **Standard / tiered battle** (`gameMode !== TOURNAMENT_GAME_MODE`): every real lever is tournament-only and these battles are agent autopilot (`agentBattleService.js:201 executionMode:'autopilot'`) → manifest is **all-false/null**. This is the feature's intended safe default.
- **Tournament battle**: reuse the existing detection at `chat.js:451` (`gameMode === TOURNAMENT_GAME_MODE && groupId`), read `tournamentGroups/{groupId}` + the player row, set `user_can_short`/`user_can_make_claims` from status+window, derive `{flipsRemaining, claimsRemaining}`, hardcode hedge/options/sector = **false**.

**Fence caution:** `createAgentBattle` (`agentBattleService.js`) is fenced and carries none of these fields — **do not** add manifest fields to the battle doc shape. Assemble at request time from the (non-fenced) group doc, exactly like the existing tag-only `groupId` pattern (`chat.js:446-453`). Cost: one extra group-doc read (+ optionally one subcollection count) on the chat hot path — acceptable.

**Minimal viable manifest at launch:** expose the two real, gated levers (`short`-via-flip, `claims`); hardcode the three non-existent ones to `false` permanently; carry remaining as a structured `{flipsRemaining, claimsRemaining}` (not a single int) or omit counts at launch. **Not a blocker** to the §4.3 hand-off.

### Q2 — Allowlist coverage → **UNDER-COVERS; add a scoped-emphasis pass-through**

Today the directive path filters on **nothing semantic** — any non-empty `text` is accepted (`chat.js:75-83`) and injected verbatim into the brain (`agentEvalPromptAssembly.js:936-944`). The new gate is a genuine net-new restriction. Coverage of the legitimate surface:

| Directive class | Example (verbatim, cited) | Allowlist-id expressible? | Gate handling |
|---|---|---|---|
| Tunable-execution (size/stop/entry/confirmation/selectivity/aggressiveness) | "Favor volume confirmation before entry. Aggressive posture." (vLP:171) | **Yes** → maps to `convictionMods`/`hurdleFloor`/`swapWindow`/`defaultConfig` | Allowlist id (canonical text) |
| **Sector tilt** | "Lean toward concentrating in **semiconductors**" (vLP:161); "rotate to high-beta semis" (test:467) | **No** — sector is an unbounded *parameter*, not a fixed per-archetype id | **Pass-through** (positive emphasis only) |
| **Symbol / slot-specific** | "**NVDA Star priority, AVGO Core**"; "swap AMD→AVGO in Core; hold NVDA in Star" (vLP:161/167) | **No** — ticker is unbounded user input | **Pass-through** (validated to portfolio/bench) |
| Risk posture | "Aggressive posture" (vLP:171); "play it safer" (vLP:69) | **Mostly** — but clamp within the archetype's band (else core-reversing for e.g. Guardian) | Archetype-bounded allowlist id |
| Timing | "Wait for 10:30 confirmation" (vLP:167) | Partial — "wait for confirmation"=yes; clock-time=no | Id for confirmation variant; else conversational |
| **Against-archetype / core-reversing** | (none in fixtures, by design) | **No (correct)** | **Block → conversational** (the bug class the gate exists to stop) |

**The decisive finding:** every committed-directive *few-shot example the prompt trains Gemma on* is a sector+symbol/slot composite (vLP:161/167/171). Allowlist-only would silently drop the **single most common legitimate directive shape**. The spec §7.2 anticipated exactly this and pre-authorized "a narrow, deterministically-safe pass-through." See the design fork in Part D for the recommended shape and its safety proof.

### Q3 — Structured-output reliability → **CONFIRMED RELIABLE**

The voice model is **Gemma 4** (`google/gemma-4-26b-a4b-it`, `gemmaClient.js:33`), called with **`response_format: { type: 'json_object' }`** (`gemmaClient.js:76`). It already emits a 7-field structured object reliably (`OUTPUT_FORMAT`, voiceLayerPrompt.js:25-53). `parseVoiceLayerResponse` is a **4-tier tolerant extractor that never throws** (`gemmaClient.js:273-315`), and `callGemmaVoiceWithRetry` adds a transient-error retry (`:153-227`). Adding a `proposal` sub-object to the same JSON is low-risk at the prompt level.

**Fail-safe (define it as):** proposal **missing or malformed** → write **no lean**, return the conversational `parsed.response`. This is *cleaner* than today's total-JSON-failure path (which returns a 502 banner, `chat.js:312-345`): a present-but-invalid proposal should degrade to conversational, never to a freeform fallback and never to an error banner. The gate treats the proposal as **untrusted** — it validates `selectedAdjustmentId` / pass-through fields itself and ignores any model free-text for the directive body.

### Q4 — Gate placement → **CONFIRMED, clean single chokepoint**

- `normalizedDirective` (computed at **chat.js:352**) is the **single feed** to all three directive consumers: client response (`:385-386/:393`), chat-exchange record (`:434-436`), and `battle.directive` (`:462-469`).
- `battle.directive` is written in **exactly one place** — `chat.js:458-470`, gated by `directiveThreadId` (`:462`), which is non-null only when `effectiveHasDirective && normalizedDirective` (`:427`); review mode forces both null (`:352-353`).
- The trading brain (live Haiku in `api/cron/agent-evaluate.js:1529-1532` → `buildLiveContextBlock`) reads it at **one** site, `agentEvalPromptAssembly.js:936-944`, gated only by **text-agnostic** `isDirectiveActive()` (shape/expiry, defaults TRUE on uncertainty).

**Therefore:** replace `normalizeDirective(parsed)` at `chat.js:352` with a `gateDirective(parsed, agent.archetype, manifest)` that returns either canonical allowlist/pass-through text (`{text, expiry}`) or `null`. Because it sits at the single chokepoint, all three consumers see a consistent result. **Tie `effectiveHasDirective` (`:353`) to the gate result** (not raw `parsed.hasDirective`) so the client surface and the battle write can never disagree on a reject (this is the divergence risk in Part C). The gate must sit *before* `directiveThreadId` is minted (`:427`).

### Q5 — `archetypeCharacter.js` Node-cleanliness → **CLEAN; safe to import**

Full graph traced: `archetypeCharacter.js` → `archetypeIdentity.js` + `archetypeDisplay.js` + `traitLibrary.js`, all **zero-import, zero-React, zero-SDK** leaves. `api/` may import it under BUILD_RULES §4 with a dependency-surface guard (precedent: `create-entry.js:34`, `tournamentLeaderboard.js:38-43`, `season-pit-stop-manage.js:38`). **But** its content is display copy with no enumerable adjustment ids — the allowlist is **new authored data regardless**. Recommendation: author the allowlist + four zones as a **new zero-import `src/data` module** (e.g. `archetypeAdjustments.js`) so the voice layer and the gate read one source of truth; optionally enrich the voice identity from `archetypeIdentity.js` (leaner) or `archetypeCharacter.js` (richer prose) — either is §4-legal. Do **not** route through the fenced `agentArchetypeConfig.js`.

---

## Part C — Three risks the spec did not name (from the adversarial critic, independently re-verified)

1. **A second, legacy directive surface still reaches two LLM prompts.** `battle.agentContext?.directives` and `agent.directives` are **arrays of plain strings** (distinct from the gated `battle.directive` object), injected into the **batch-review** prompt (`agent-batch-review.js:147-150` → "AGENT DIRECTIVES:" :170-171) and the **debate** prompt (`debate.js:117-119` → "YOUR DIRECTIVES:" :148-149) — **VERIFIED this session.** This array is **write-dead** (Phase 4/7 deprecated it; `chat.js:472-475` documents this; zero live writes found), so the gate need not write it — **but old docs may still carry stale against-archetype strings that surface to these two prompts.** The gate does not cover this path. **Decision needed (Part D).**
2. **Client/battle divergence on gate-reject.** `clientResponse.directive` (`:393`) and `effectiveHasDirective` (`:353`) are computed upstream of the battle write. If the gate blocks a lean but these aren't tied to the gate result, the UI could show "directive set" while `battle.directive` is empty. **Fix:** drive both from the single `gateDirective` result (Q4).
3. **Single-write-path positively confirmed (good news).** A full `api/` sweep found no other production write to `battle.directive`; `directiveThreadId` echo-backs at `agent-evaluate.js:1931/1951/1994` are the model's own output (UI linking), not a bypass; `api/scripts/migrate-directives.js` mutates only the legacy array on manual `--execute`. The chokepoint is genuinely singular.

---

## Part D — Genuine decisions for the founder (the spec leaves these open)

1. **The pass-through fork (the one real design choice).** Q2 shows allowlist-only would drop the most common legitimate directive (sector/symbol emphasis). Two options:
   - **(A) Recommended — Allowlist + scoped-emphasis pass-through.** Admit *positive* sector/symbol emphasis via a **bounded template**: `"Lean toward {SECTOR}."` / `"Emphasize {SYMBOL} for {SLOT}."`, where `{SECTOR}` ∈ a closed sector enum (one already exists, vLP:270), `{SYMBOL}` ∈ the battle's current portfolio+bench (deterministic, evalAssembly:949-951), `{SLOT}` ∈ Star/Core/Support. **Provably non-core-reversing by construction:** positive-emphasis-only (no "fade/reverse/avoid" verbs), so it can only *narrow/weight within* the archetype, never flip it; and the brain keeps its P&L override valve (evalAssembly:201). Cost: the gate grammar is "allowlist-ids **+ one parameterized template**," slightly wider than pure ids — but still deterministic and canonical-text-only.
   - **(B) Purist — Allowlist-only.** Sector/symbol asks become **conversational-only** (acknowledged in voice, no live lean). Maximum gate purity, but the agent's "lean" will feel inert for the most common real request, and you reopen part of the original "feels fake" failure mode the spec rejected.
   - *Recommendation:* **(A)**, because it preserves real usage while keeping the guarantee deterministic; the spec itself pre-authorized it (§7.2).
2. **Legacy-array scope (Part C #1).** Either (i) declare `agentContext.directives`/`agent.directives` **out-of-scope residual** (it's write-dead) and note it, or (ii) add a tiny read-side sanitize so stale strings can't surface to batch-review/debate. *Recommendation:* (ii) is cheap and closes the second leak; but it's your call whether it's in this build's scope.
3. **`max_user_actions_remaining` shape.** No unified budget exists. *Recommendation:* carry `{flipsRemaining, claimsRemaining}` or omit counts at launch (name levers as available/unavailable, not counted) — do **not** assert a single budget the system doesn't enforce.
4. **Voice-identity source.** Leaner `archetypeIdentity.js` (disposition/reveal/voice) vs richer `archetypeCharacter.js` prose (huntsFor/hardRule/temperament/positionStyle) — both §4-legal. *Recommendation:* author the four zones + allowlist fresh (you have to anyway) and optionally seed the prose from `archetypeCharacter.js`.

---

## Part E — Proposed phased build plan (for your review — not yet executed)

> All phases are **non-fenced** (`voiceLayerPrompt.js`, `chat.js`, new `src/data`), behind **one flag, off by default**. The only fence contact is *reading* exported functions / importing a Node-clean `src/` module (precedented). Each phase ends with its own discovery STOP if it approaches the §2 review threshold (≥10 files / ≥1500 lines).

- **Phase 0 — Founder-authored content (parallel prerequisite).** For all six archetypes: the four-zone definitions + the adjustment allowlist (ids + canonical text) + the closed sector enum for the pass-through. This is your trading expertise; I can draft proposals from the real dials in `agentArchetypeConfig.js` (regimePreferences/convictionMods/hurdleFloor) for you to refine.
- **Phase 1 — Discovery (this report). STOP for review.** ✅
- **Phase 2 — Data + manifest scaffolding (non-fenced).** New zero-import `src/data/archetypeAdjustments.js` (allowlist + four-zone copy); a manifest-assembler helper keyed off `gameMode`; the dependency-surface guard test for the `src/` import.
- **Phase 3 — The deterministic gate (`chat.js`, non-fenced).** Extend `OUTPUT_FORMAT` to emit the `proposal` block; replace `normalizeDirective` at `:352` with `gateDirective(parsed, archetype, manifest)` (canonical text only; allowlist id **or** validated pass-through template **or** null); wire the manifest into `buildVoiceLayerPrompt`; tie `effectiveHasDirective` to the gate; define the fail-safe (Q3).
- **Phase 4 — The voice third-path upgrade (`voiceLayerPrompt.js`, non-fenced).** Replace the triplicated honest-pushback exception (:61/98/130, refactor to a shared constant) with the mandated third path (acknowledge → boundary → one allowlist adjustment → hand-off *only to manifest-present levers* → research cue → "why this fits me"); inject the four-zone identity into the voice identity blocks; bake in default-compliance bias + constitution-over-tactics framing.
- **Phase 5 — Legacy-array decision (Part D #2), if in scope.**
- **Phase 6 — Flag, tests, both-directions smoke, `/code-review`.** Deterministic-guarantee tests (no core_conflict ever writes a lean; every written lean maps to a valid allowlist id **or** a validated pass-through template; the original against-archetype ask never appears in directive text; hand-off references only manifest-present levers) + behavioral smoke (holds core under attack; **complies on flex** — the over-correction guard; blends moves; tone acknowledges risk; counter-offer quality; "why this fits me" present) + **flag-off regression byte-identical**.

---

## Part F — Fence & scope confirmation

- **Touched (all non-fenced):** `api/agent/chat.js`, `api/_utils/voiceLayerPrompt.js`, new `src/data/*`, new tests, manifest helper.
- **Read-only fence contact (permitted):** `getArchetypeLabel`/`ARCHETYPE_CONFIGS` (`agentArchetypeConfig.js`), `isDirectiveActive`/`getCurrentTradingDayServer` (`directiveUtils.js`→`agentEvalPromptAssembly.js`), the directive read site (`agentEvalPromptAssembly.js:936-944`). **No fenced file is edited.** The four-zone "core" reference lives in new non-fenced `src/data`, not in the fenced config.
- **The fenced brain is not touched** — it trades in-character via its dials; the against-archetype ask never becomes a lean, so nothing identity-violating reaches it. Confirmed by the single-read-site trace (Q4).

---

## Hard STOP (BUILD_RULES §3)

This is the end of read-only discovery. **No code has been written.** Recommended next steps, in order: (1) decide the four items in Part D — above all the pass-through fork; (2) author the Phase-0 content (I can draft proposals); (3) approve the Phase-2→6 plan, at which point I'll write per-phase CC build prompts, each with its own discovery/verify gate. Nothing proceeds until you say so.
