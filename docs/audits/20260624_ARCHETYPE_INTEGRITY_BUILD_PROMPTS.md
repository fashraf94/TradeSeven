# Archetype-Integrity "Third Path" — Per-Phase Build Prompts (V1)
### FantasyTrades · CC build prompts off Part-E plan · Part-D rulings encoded · 2026-06-24

**Status:** Build prompts for founder review. **Authoring artifact only — no implementation has started.** Nothing lands until (a) Phase-0 founder content is approved and (b) these prompts are blessed.
**Grounded on:** `docs/audits/20260624_ARCHETYPE_INTEGRITY_BUILD_DISCOVERY.md` (HEAD `f8c2316`). All anchors below are from that discovery; **lines drift — every phase re-verifies its own anchors at its session HEAD before any write** (BUILD_RULES §3).

### Part-D rulings encoded here (founder, 2026-06-24)
1. **Pass-through = Option A, positive-emphasis-only *by construction*.** Closed sector enum + `{SYMBOL}` ∈ current portfolio/bench + `{SLOT}` ∈ Star/Core/Support. **No "fade/avoid/reverse/short/stop" verb is admissible into the template at all** — that is the entire safety proof. Canonical-text only.
2. **Legacy `directives[]` array → in scope, read-side sanitize, its own phase (Phase 5).**
3. **`max_user_actions_remaining` → per-lever `{flipsRemaining, claimsRemaining}`** (or omit counts). Never a synthesized unified budget.
4. **Voice identity + allowlist authored fresh in one new zero-import `src/data` module** = single source of truth for *both* the voice layer and the gate. Never route through fenced `agentArchetypeConfig.js`.
5. **Refactor the triplicated honest-pushback exception (`:61/98/130`) to one shared constant** while upgrading it.
6. **Tie `effectiveHasDirective` + the client surface to the single gate result** so the UI can never show "directive set" on a blocked turn. Gate sits before `directiveThreadId` is minted.

### Cross-cutting rules every phase obeys
- **Branch:** one phase = one branch, cut fresh from current `main` (§2). Open by reporting branch / HEAD SHA / clean-tree.
- **Discovery-first:** each phase starts read-only, re-verifies its anchors (file:line + VERIFIED/ASSUMED), writes a short discovery note **outside the repo tree**, and **hard-STOPs for founder review before any write** (§3).
- **Fence:** non-fenced files only. Read-only fence contact (importing a Node-clean `src/` module, calling exported fenced functions) is permitted; **no fenced file is edited.** If a phase seems to need a fenced edit — STOP and report (§1).
- **Flag:** one master flag, **off by default**; every behavioral change is gated so each phase merges to `main` behind flag-off (inert, safe) and is independently reviewable. **Flag-off must be byte-identical to today.**
- **`/code-review`** is mandatory at ≥10 files OR ≥1500 lines (§2).

---

## Shared contracts (the phases reference these)

### A. The data module — `src/data/archetypeAdjustments.js` (NEW, zero-import, Node-clean)
Single source of truth read by both the voice layer (Phase 4) and the gate (Phase 3). **Phase 0 (founder) fills the content; Phases 2–4 consume the shape.**

```
// Per the six stable code-ids: momentum_chaser, contrarian, diversifier, degen, analyst, guardian.
export const ARCHETYPE_ADJUSTMENTS = {
  momentum_chaser: {
    zones: {
      immutableCore:        "...",   // never reversed (e.g. "I trade in the direction of strength; I do not fade momentum.")
      protectedBias:        "...",   // default lean, adjustable only at the margin
      tunableExecution:     "...",   // the dimension the allowlist tunes
      outOfScopeUserLever:  "...",   // concerns the archetype doesn't own → hand-off targets
    },
    adjustments: [
      { id: "TF-01", canonical: "avoid extended/late-stage entries" },
      { id: "TF-02", canonical: "prefer fresh breakouts over mature trends" },
      // ... founder-authored, none core-reversing by construction
    ],
  },
  // ... 5 more
};

// Closed enums for the pass-through (Phase 0 confirms the sector list source — see Phase 2 discovery)
export const PASS_THROUGH_SECTORS = [ /* canonical sector enum */ ];
export const PASS_THROUGH_SLOTS = ['Star', 'Core', 'Support'];

// Pure helpers (zero-import)
export const getArchetypeZones   = (codeId) => ...;
export const getAllowlist        = (codeId) => ...;        // array of {id, canonical}
export const isValidAdjustmentId = (codeId, id) => ...;    // boolean
export const getCanonicalText    = (codeId, id) => ...;    // string|null
```
**Invariant:** no `adjustments[].canonical` entry reverses its archetype's `immutableCore`. This is what makes the gate airtight — there is no core-reversing id to select.

### B. The manifest assembler — `api/_utils/agentCapabilitiesManifest.js` (NEW, non-fenced)
```
// Keyed off gameMode. Reads the (non-fenced) tournament group doc; NEVER the fenced battle-doc shape.
export function buildCapabilitiesManifest({ battle, group }) {
  // standard/tiered (gameMode !== TOURNAMENT_GAME_MODE): all-false / null (agent autopilot)
  // tournament (gameMode === TOURNAMENT_GAME_MODE && groupId): derive from group + caps
  return {
    user_can_short:        Boolean,   // tournament + BATTLE + ≥1 flippable pick (short reached via flip)
    user_can_make_claims:  Boolean,   // tournament + BATTLE + ET claim window open
    user_can_hedge:        false,     // hardcoded — lever does not exist
    options_enabled:       false,     // hardcoded — lever does not exist
    sector_hedges_enabled: false,     // hardcoded — lever does not exist
    flipsRemaining:        Number|null,   // FLIP_CAP_PER_DAY(5) − pick.flipCountToday (per-lever, Part-D #3)
    claimsRemaining:       Number|null,   // CLAIM_PENDING_CAP_PER_CYCLE(3) − live pending-claim count
  };
}
```
**Hand-off rule (enforced in the gate + prompted in voice):** the agent may reference ONLY a lever whose flag is `true` in this manifest. The three hardcoded-false levers are permanently un-referenceable (safe by construction).

### C. The flag
One master flag, **off by default**, gating philosophy injection + third-path + gate + legacy-sanitize **together** (so flag-off is one clean byte-identical regression surface). Introduced at first behavioral use (Phase 3). **Phase-2/3 discovery confirms the canonical server-side flag home** (e.g. `src/config/featureFlags.js` vs an env-var pattern — *ASSUMED*, verify).

### D. The Gemma proposal block (added to `OUTPUT_FORMAT`, Phase 4; consumed by the gate, Phase 3)
Emitted in **battle mode only** (review/first-message keep directive null). Treated as **untrusted** — the gate validates it; model free-text never becomes directive body.
```
"proposal": null OR {
  "classification": "in_archetype" | "flex" | "core_conflict" | "user_lever" | "research_only",
  "selectedAdjustmentId": "TF-03" | null,          // must be a valid id in THIS archetype's allowlist
  "scopedEmphasis": null OR {                        // positive emphasis only — no negative verbs exist in the schema
    "sector": "<one of PASS_THROUGH_SECTORS>" | null,
    "symbol": "<a current portfolio/bench ticker>" | null,
    "slot": "Star" | "Core" | "Support" | null
  },
  "originalUserAsk": "...",     // for logging/voice ONLY — NEVER written into directive text
  "counterOfferText": "...",    // voice-side; not the directive
  "rejectionReason": "..."      // when classification = core_conflict
}
```

---

## Phase 2 — Data module + manifest scaffolding *(non-fenced; inert; no behavior change)*

> **Branch:** fresh from `main`. **Depends on:** Phase-0 content (the module's data); the helper shapes can be built and unit-tested with placeholder data if Phase-0 isn't merged yet, but the real content must land before Phase 3 is meaningful.

**Step 0 — Discovery/verify (read-only, then STOP):**
1. Confirm `src/data/archetypeIdentity.js` and the import precedents are unchanged (`create-entry.js:34`, `tournamentLeaderboard.js:38-43`) and that the dependency-surface-guard pattern still holds (BUILD_RULES §4).
2. **Locate the canonical sector enum** for `PASS_THROUGH_SECTORS`. Part-D says "reuse `voiceLayerPrompt.js:270`"; confirm whether that is the authoritative list or whether a shared `SECTORS` constant exists elsewhere. Record the source.
3. Re-verify the manifest sources at HEAD: `leagueTournament.js` caps (`FLIP_CAP_PER_DAY`, `CLAIM_PENDING_CAP_PER_CYCLE`), `place-claim.js` window/status gates, `flip.js` per-pick `flipCountToday`, `tournamentClaimPlacement.js:110-114` pending-claim count, and the tournament detection at `chat.js:451`.
4. Confirm `createAgentBattle` (`agentBattleService.js`) is still fenced and that the manifest can be assembled **without** touching the battle-doc shape.

**Step 1 — Build (after STOP cleared):**
- Add `src/data/archetypeAdjustments.js` per Contract A (zero-import; content from Phase 0).
- Add `api/_utils/agentCapabilitiesManifest.js` per Contract B (non-fenced; may import the Node-clean `leagueTournament.js` constants).
- Add a **dependency-surface guard test** whose real, never-mocked import of `archetypeAdjustments.js` (and of `agentCapabilitiesManifest.js`) is the runtime guard (BUILD_RULES §4) — with the mandated comment.
- Unit tests: every allowlist `canonical` is non-empty; `isValidAdjustmentId`/`getCanonicalText` round-trip; the **core-safety invariant** (a fixture asserting no canonical text contains a core-reversing phrase per archetype — founder supplies the deny-list); manifest matrix (standard → all-false; tournament BATTLE in/out of window; remaining-count math; hedge/options/sector always false).

**Lands:** new files only, consumed by nothing yet → safe behind no flag. **STOP for review.**

---

## Phase 3 — The deterministic gate *(non-fenced; `api/agent/chat.js`; introduces the flag)*

> **Branch:** fresh from `main`. **Depends on:** Phase 2 merged (module + manifest). **This is the guarantee.**

**Step 0 — Discovery/verify (read-only, then STOP):**
1. Re-verify the chokepoint at HEAD: `normalizedDirective` computation (was `chat.js:352`), its three consumers (client `:385-386/:393`, exchange `:434-436`, battle `:462-469`), `directiveThreadId` mint (`:427`), review strip (`:352-353`).
2. Re-confirm the single live write path (`chat.js:458-470`) and that no other production path writes `battle.directive`.
3. Confirm where to fetch the tournament group doc on the chat path (the parallel fetch block at `chat.js:229` is the natural home) so the manifest can be assembled without a fence touch.
4. Confirm the flag home (Contract C).

**Step 1 — Build (after STOP cleared):**
- **Assemble the manifest** in the handler (fetch group doc alongside the existing parallel reads at `chat.js:229`; call `buildCapabilitiesManifest`). Pass it into prompt assembly (Phase 4) and the gate.
- **Add `gateDirective({ parsed, archetype, manifest, battle })`** (new non-fenced helper, e.g. in `directiveUtils.js` or a new `directiveGate.js`) returning `{ directive: {text, expiry} | null, hasDirective: boolean }`:
  1. No/invalid `proposal` → `{null, false}` **(fail-safe — conversational only, never freeform, never a 502)**.
  2. `classification ∈ {core_conflict, user_lever, research_only}` OR (`selectedAdjustmentId == null` AND no `scopedEmphasis`) → `{null, false}`.
  3. `selectedAdjustmentId` valid for `archetype` → `text = getCanonicalText(archetype, id)`.
  4. Else `scopedEmphasis` present AND valid → `text =` filled **positive-only template**: `"Lean toward {SECTOR}."` and/or `"Emphasize {SYMBOL} for {SLOT}."`. Validate: `sector ∈ PASS_THROUGH_SECTORS`; `symbol ∈` the battle's current portfolio+bench symbols (compute from `battle.portfolio` non-fenced); `slot ∈ PASS_THROUGH_SLOTS`. **The template has no negative-verb slot — "stop following trends" is structurally unsayable.**
  5. **Live-lean quality gate (spec §4.4.4):** the result must (a) map to a valid id or a validated template, (b) name a concrete behavior change, (c) reference no fake mechanic. Fail any → `{null, false}`.
  6. **`originalUserAsk` is NEVER written into `text`** (not paraphrased, not "stripped to essence"). It is available only to logging/voice.
  - `expiry` from `proposal`/normalize (default `end_of_battle`).
- **Wire it in (flag-gated):**
  - Flag-ON, `mode !== 'review'`: `const { directive: normalizedDirective, hasDirective: effectiveHasDirective } = gateDirective(...)`.
  - Flag-OFF: keep today's `normalizeDirective(parsed)` and `effectiveHasDirective = parsed.hasDirective || false` → **byte-identical**.
  - Place the gate **before** `directiveThreadId` is minted (`:427`); both the client surface (`:393`) and the battle write (`:462-469`) now derive from the single gate result → **Part-C #2 divergence closed**.

**Tests:** the deterministic-guarantee battery (Phase 6 owns the integration suite, but unit-test `gateDirective` here): core_conflict → no lean; valid id → canonical text exactly; pass-through positive emphasis → templated text; pass-through with an out-of-enum sector / off-roster symbol / negative verb → no lean; malformed proposal → no lean + conversational; `originalUserAsk` never appears in output. **STOP for review.**

---

## Phase 4 — Voice third-path + four-zone injection *(non-fenced; `api/_utils/voiceLayerPrompt.js`)*

> **Branch:** fresh from `main`. **Depends on:** Phases 2–3 (module + gate + manifest in the prompt). Flag-gated.

**Step 0 — Discovery/verify (read-only, then STOP):**
1. Re-verify the seven identity-injection sites (`:2490/2551/2611/2779/2981/3208/3434`) and which surfaces each serves (battle/review/first-message/etc.); decide which need the four-zone block (battle + review at least; first-message forces directive null so zones are identity-only there).
2. Re-verify the triplicated exception (`:61/98/130`) and `OUTPUT_FORMAT` (`:25-53`) at HEAD.
3. Confirm `buildVoiceLayerPrompt` now receives the manifest (from Phase 3).

**Step 1 — Build (after STOP cleared):**
- **Dedup + upgrade the exception (Part-D #5/#1):** extract the legacy exception text to a single `LEGACY_HONEST_PUSHBACK` constant (byte-identical dedup of `:61/98/130`), and add a single `THIRD_PATH_RULE` constant. Each phase block references `FLAG ? THIRD_PATH_RULE : LEGACY_HONEST_PUSHBACK`. (Dedup kills the triplication-drift bug even flag-off; flag-off output stays byte-identical.)
- **`THIRD_PATH_RULE`** mandates the composable reply: (1) acknowledge the concern (tone rule: open with risk acknowledgment, never a smug refusal); (2) state the archetype boundary in character (from `zones.immutableCore`); (3) offer **one** allowlist adjustment when one fits (the model selects `selectedAdjustmentId` from the injected menu); (4) hand off **only** to a manifest-present lever; (5) one research cue when useful; (6) "why this fits me" (one line teaching the mechanic). Bake in **default-compliance bias** (push back only when it reverses `immutableCore`; comply with flex) and **constitution-over-tactics** framing for equipped-rule tension.
- **Inject the four zones + the allowlist menu + the manifest** into the (flag-gated) identity block at the chosen sites, from `archetypeAdjustments.js` + the manifest. The menu is what lets Gemma emit a valid `selectedAdjustmentId`; the manifest is what bounds hand-off language.
- **Extend `OUTPUT_FORMAT`** with the `proposal` block (Contract D), flag-gated, battle-mode only.

**Tests:** flag-off prompt byte-identical (snapshot); flag-on prompt contains the zones/menu/manifest and the proposal schema; the exception dedup produces identical legacy text. **STOP for review.**

---

## Phase 5 — Legacy `directives[]` read-side sanitize *(non-fenced; reviewable in isolation)*

> **Branch:** fresh from `main`. **Depends on:** the flag exists (Phase 3). Independent of Phases 3/4 logic.

**Step 0 — Discovery/verify (read-only, then STOP):**
1. Re-verify the two read sites: `agent-batch-review.js:147-150` ("AGENT DIRECTIVES:" `:170-171`) and `debate.js:117-119` ("YOUR DIRECTIVES:" `:148-149`).
2. **Re-confirm the array is truly write-dead** at HEAD (grep all of `api/` for any live write to `.directives`; confirm `chat.js:472-475` deprecation note and the migration script `api/scripts/migrate-directives.js` are the only writers). This determines the sanitize shape.

**Step 1 — Build (after STOP cleared):**
- **If write-dead (expected):** flag-gated, neutralize the legacy read — flag-ON renders "No active directives" (drops the stale array from both prompts); flag-OFF = current behavior (byte-identical). Neutralizing the read IS the deterministic sanitize: a write-dead field that is never injected cannot leak an against-archetype string.
- **If discovery finds a live writer (fallback):** keep the read but pass each entry through a deterministic content sanitize (founder-supplied deny-list / archetype-core check), flag-gated.
- Tests: flag-on → both prompts show "No active directives" regardless of `agentContext.directives` contents; flag-off → unchanged.

**Lands:** small, isolated, reviewable. **STOP for review.**

---

## Phase 6 — Flag, test battery, both-directions smoke, code-review

> **Branch:** fresh from `main`. **Depends on:** Phases 2–5. This is the gate-flip + verification phase.

**Step 0 — Discovery/verify:** confirm the flag default-off across all consumers; inventory test surfaces.

**Step 1 — Build/verify:**
- **Deterministic guarantees (must be provable, not behavioral):** no `core_conflict` turn ever writes a lean; every written lean maps to a valid allowlist id **or** a validated positive-emphasis template; the original against-archetype ask never appears in directive text; hand-off language references only manifest-present levers. (Integration tests across chat.js + gate + module + manifest.)
- **Both-directions smoke (the defining test, spec §9) — flag-ON on preview:** (a) **under-correction check** — a core attack ("Trend Follower, start fading rallies") is *held*, no lean written; (b) **over-correction check** — a legitimate flex ("be more selective today", "size down") is *complied with* via an allowlist adjustment, **not** walled off; plus counter-offer quality (not generic) and hand-off references only real levers; (c) "why this fits me" present and accurate.
- **Regression:** flag-OFF → voice + directive + legacy-array behavior **byte-identical** to today (snapshots).
- Run `/code-review` if the cumulative change in any phase's PR hits ≥10 files OR ≥1500 lines.
- **Crons/preview note:** preview is the smoke surface; state plainly what is preview-verified vs. unit-tested.

**STOP for review** → founder flips the flag in production only after merge + deploy confirmation.

---

## Sequencing, branching, and what's still open for CC discovery
- **Order:** 2 → 3 → 4 → 5 → 6. Each is its own branch off `main`, founder-merged, with its own discovery STOP. Behavioral phases (3–5) land behind flag-off so intermediate merges to `main` are inert and safe.
- **Phase-0 prerequisite:** the build is meaningless until `archetypeAdjustments.js` content (four zones + allowlist per archetype + the deny-list for the core-safety test + the sector enum) is founder-approved. Phases 2–4 are written *against the contract*; they execute against the real content.
- **Open confirmations each phase resolves at its HEAD:** (i) the canonical sector-enum source; (ii) the server-side flag home; (iii) any anchor line-drift; (iv) in Phase 5, the write-dead confirmation; (v) whether first-message/anticipation/narration surfaces need the four-zone identity or identity-only.

---

## Hard STOP
These prompts are **for review, not execution.** No code has been written. On your word — Phase-0 content approved + prompts blessed — I'll cut Phase 2 fresh from `main` and run its discovery STOP first. Nothing builds until then.
