# Tier 2 Customization Bundle — Master Design Spec V1.1

**Date:** July 6, 2026
**Status:** Locked pending Flash sign-off (adversarial review incorporated)
**Owner:** Flash · **Author:** Claude (Architecture) · **Adversarial review:** ChatGPT (Jul 6, 2026)
**Supersedes:** V1.0 in full.
**Ship structure:** OPTION A — but restructured into a **sequenced release train**, not one authorization. The central V1.1 change: **split the live risk** (per review). "Dark" is retired as a blanket term; every piece is classified by its true release category (§0).

**Gated on (all cleared):** B4 calibration report · integrity enforce discovery (Jul 6) · WS1 observe walk · backlog doc committed.
**Parents:** `CUSTOMIZATION_LAYER_DESIGN_SPEC_V1_1.md`, `KNOB_CALIBRATION_BUILD_SPEC_V1` + B4, six `ARCHETYPE_DEF_*` docs, `archetypeAdjustments.js`.

### V1.1 changelog (review integration)

| # | Change | §|
|---|---|---|
| 1 | **Four release categories** replace "dark" — dark-inert / live-default / live-prompt / live-flag. Release authority differs per category. | §0 |
| 2 | **Tuned values DECOUPLED** into an earlier standalone watched release (own config-version stamp + before/after thresholds set pre-merge). Removed from the bundle. | §0.1, §4 |
| 3 | **Read-side rollback suppression** added as bundle scope + enforce prerequisite: eval read becomes flag-aware, suppresses persisted directives/leans when not enforce (data kept, suppressions logged). Converts rollback from battle-granular to next-eval-clean. | §3.6 |
| 4 | **Cap denominator fixed pre-enforce** — target slot count (6), projected post-trade book, 1–6 holdings tests. | §6.1 |
| 5 | **Real override-suppression state** for opposed leans (`overriddenLeanId`/`overrideDirectiveId`/`confirmedAt`; overridden lean suppressed/marked for that battle so the model never sees both). | §3.4 |
| 6 | **Lean snapshot = id + version + resolved text** (not text alone). | §3.1–3.2 |
| 7 | **Cross-path dial test set** added to the combination matrix. | §8.1 |
| 8 | WS3 reclassified **"soft prompt precedence"** — no copy implying hard refusal; adversarial tests; refusal engine stays deferred. | §5 |
| 9 | Enforce timing sharpened: read-side guard is the hard requirement; same-window-as-UI is strong preference. | §6.2 |

---

## 0. Release categories (the V1.1 framing fix)

"Merge dark" hid three different kinds of live change under one word. Every piece is now classified, and **release authority follows the category**:

| Category | Meaning | Pieces | Watch on land |
|---|---|---|---|
| **DARK-INERT** | Changes nothing live; inert until UI + enforce | standing-leans machinery, tempo-dial machinery, read-side rollback guard | none (script-verify only) |
| **LIVE-DEFAULT** | Changes agent defaults the instant it merges | tuned knob values | before/after metrics, rollback thresholds |
| **LIVE-PROMPT** | Changes model behavior the instant it merges | WS3 soft precedence language | adversarial prompt tests, pick-attribution watch |
| **LIVE-FLAG** | Activates persistence + caps on flip | enforce flip | Diversifier-cap block watch, directive-persistence watch |

**The core principle (review):** never let two live-change categories land close enough to blur attribution. If rotation shifts, we must know whether it was the tuned defaults (LIVE-DEFAULT), the prompt (LIVE-PROMPT), or persistence (LIVE-FLAG).

### 0.1 The release train (sequenced, not bundled)

```
RELEASE 1 — Tuned values (LIVE-DEFAULT, standalone, earliest)
   land B4 values + config-version stamp → watch window → confirm tempo lift
   (isolated so its live effect is cleanly attributable; own rollback thresholds)

RELEASE 2 — The fenced bundle (one authorization, split PRs; DARK-INERT + LIVE-PROMPT + pre-enforce fixes)
   PR-a standing leans (snapshot+read+versioning+opposition+override-suppression)
   PR-b tempo dial (snapshot+clamp+receipt provenance)
   PR-c read-side rollback guard (flag-aware eval read)          ← enforce prerequisite
   PR-d WS3 soft prompt precedence (both assemblies, sync test)  ← LIVE-PROMPT, its own watch
   PR-e Diversifier cap denominator fix                          ← enforce prerequisite
   PR-f combination-safety + cross-path dial matrix
   → DARK-INERT pieces change nothing live; PR-d is LIVE-PROMPT (watched); PR-c/e are the enforce gates

RELEASE 3 — Equip UI fast-follow (own spec, merged dark)

RELEASE 4 — Enforce flip (LIVE-FLAG, founder-executed, low-battle window)
   requires PR-c (read-side guard) + PR-e (cap fix) already live
   flip → UI live (same window, strong preference)
```

Tuned values are pulled *out* of the fence bundle and shipped *first* precisely because they're the one LIVE-DEFAULT change and their attribution must be clean.

---

## 1. The precedence ladder governs everything (unchanged)

All conflict semantics resolve against V1.1-parent §2 (rung 1 platform safety → rung 8 soft). Tighten-only for rung-3; core-safe bounded modulation for rung-4. Slotting: leans → rung 4; dial → rung 4 modulating rung-6 defaults; tuned values → rung 6; WS3 → codifies rung-2-outranks-rung-8 for watchlist vs core; Diversifier cap → rung 2/3 `min(user,35%)`.

---

## 2. (removed — folded into §0.1 release train)

---

## 3. Standing leans (Release 2, PR-a — DARK-INERT)

### 3.1 Data model

```
agent.standingLeans = [ { adjustmentId, version, equippedAt } ]        // ids-at-rest, ≤2
battle.agentContext.standingLeans = [ { adjustmentId, version, text } ] // id+version+text (review #6)
```

Ids-at-rest → single source, menu edits propagate. **Snapshot carries id + version + resolved text** (not text alone) → audit-clean, receipt-truthful, deprecation-analyzable. Cap 2. Validation reuses `isValidAdjustmentId`; all 46 allowlist entries `coreAlignment:'reinforces'` (structurally safe — integrity eval hard-zero).

### 3.2 Snapshot + read (fenced)

- Snapshot (`agentBattleService.js:150-191`): resolve ids → `{adjustmentId, version, text}`, additive write to `agentContext.standingLeans[]`.
- Eval read (`agentEvalPromptAssembly.js:936`-adjacent): render as a distinct block; mirror in `agentPromptAssembly.js`; **two-assembly sync is a blocking invariant test.**

### 3.3 Versioning

`canonicalTextVersion` per adjustment. Wording-only → reuse id. Semantic → deprecate + mint new; equipped deprecated ids stop stamping + surface re-confirm.

### 3.4 Lean vs chat directive — real override-suppression state (review #5)

Same-allowlist ⇒ contradictions are flavor-level, never identity attacks. `ADJUSTMENT_OPPOSITION_PAIRS` in `archetypeAdjustments.js`. On an opposing incoming directive, gate requires **explicit one-battle override confirmation**. On confirm, write a per-battle override record:

```
battle.leanOverride = { overriddenLeanId, overrideDirectiveId, confirmedAt }
```

Prompt assembly then **renders the directive and suppresses (or explicitly marks as overridden) the opposed lean for that battle** — the model never sees both sides of a live contradiction. Lean data untouched; resumes next battle. Voice acknowledges; event logged. (Prior V1.0 "both render" was a model-confusion bug — fixed.)

### 3.5 Enforce dependency

Leans persist through the directive machinery the enforce discovery characterized. Immediately-live once enforce + UI exist. Rollback behavior is now governed by the read-side guard (§3.6), not battle-granularity.

### 3.6 Read-side rollback guard (Release 2, PR-c — DARK-INERT; enforce PREREQUISITE) — review #3

The enforce discovery's non-clean rollback stems from a **flag-blind** eval read. Fix: make the read **flag-aware**.

- When `ARCHETYPE_INTEGRITY_MODE !== 'enforce'`, prompt assembly **suppresses rendering** of persisted `battle.directive` and `standingLeans` — behavioral injection stops immediately.
- **Stored data is kept** (audit); every suppressed item is **logged**.
- Effect: flip-back to observe is **clean on next eval**, not "wait until battle ends." In-flight enforce-window battles stop honoring stamped directives/leans the moment the flag drops.

This is a fenced edit (`agentEvalPromptAssembly.js` + mirror), lands in Release 2, and is a **hard prerequisite for the enforce flip** (Release 4). It converts the flip from a scary one-way action into a reversible switch — essential for competitive integrity.

---

## 4. Tuned knob values (RELEASE 1 — LIVE-DEFAULT, standalone, decoupled) — review #1

Pulled out of the fence bundle and shipped **first, alone.** Rationale (review): they change every standard-dial agent on merge; bundling them blurs attribution against WS3/enforce. Isolated, their effect is cleanly readable — which is exactly what the B4 promotion gate needs.

- Land B4 tuned values in `agentArchetypeConfig.js` (founder-gated fenced edit).
- **Stamp a config version into `battle.agentContext`** so each battle records which knob generation it ran.
- **Set rollback thresholds pre-merge** on: rotation rate, swap frequency, guardian exit rate, failed-eval rate, sector concentration, win/loss volatility.
- **Watch window:** the scheduled post-landing `aggregate-real-battles.js` re-run (B4's promotion gate) reads the config-version-stamped battles → confirms the tempo lift off the zero-floor baseline. Promote provisional → calibrated on confirmation.

The tempo **dial** (which modulates these values) stays in Release 2 (DARK-INERT machinery); only the values themselves ship in Release 1.

---

## 4b. Tempo dial (Release 2, PR-b — DARK-INERT)

```
agent.dials.tempo = 'measured'|'standard'|'aggressive'   // battle-locked UI; default standard
battle.agentContext.dials = { tempo }                     // stamped at creation
```

Battle-locked; snapshot-stamped (Invariant-S). Clamp at non-fenced `agent-evaluate.js:~1002` post-`resolveHftConfig`; **merge-not-replace** (fully-populated config, no `?? default` reversion — dedicated test); **direction-aware bands** per B4 §D (caps × mult; thresholds/floors ÷ mult; safety fields untouched). Receipt provenance `'archetype_plus_user_dial'` via fenced builder (`agentRiskManager.js:~516-525`); blocking test: `standard` → `'archetype'`, non-standard → dial-attributed.

---

## 5. WS3 — soft prompt precedence (Release 2, PR-d — LIVE-PROMPT) — review #8

Reclassified from "precedence" to **soft prompt precedence** to stop over-promising. Ships the declared-precedence **prompt language only**: reframe the watchlist block as *attention, not obligation*, subordinate to archetype constraints/core refusals, in both fenced assemblies (sync test). The **per-ticker refusal engine stays deferred** (its own downstream build).

Guardrails (review): no receipts or user-facing copy implying hard refusal; adversarial tests where watchlist names conflict with archetype style, asserting the prompt says attention-not-obligation. **Product-copy gate:** if any copy would say "your agent refuses off-style watchlist names," WS3 defers entirely; if copy says "watchlist influences attention," the prompt piece ships. Provenance-name footgun (trade-provenance vs watchlist-provenance) disambiguated in the PR.

This is LIVE-PROMPT: behavioral on merge, so it gets its own pick-attribution watch, held separate from Release 1's tempo watch so the two don't blur.

---

## 6. Enforce flip (RELEASE 4 — LIVE-FLAG, founder-executed, last)

### 6.1 Diversifier cap denominator fix (Release 2, PR-e — enforce PREREQUISITE) — review #4

`held.length` denominator makes the cap path-dependent — a partially-filled book turns "max 2 of 6" into a stricter temporary rule that can trap construction. Fix: **target slot count (6) as denominator; evaluate the projected post-trade book**; tests at 1/2/3/4/5/6 holdings asserting "2 of 6 allowed, 3 of 6 blocked" and that partial-book construction isn't trapped. Lands in Release 2; prerequisite for enforce.

### 6.2 The flip

After Release 1 (values, watched), Release 2 (bundle incl. read-side guard + cap fix), and Release 3 (UI) are live and verified. Carried from discovery: global, immediately-live, no ramp; Diversifier cap fires block-only (never unwinds); the read-side guard (§3.6) now makes rollback clean-on-next-eval.

**Timing (review #9, sharpened):** the **read-side guard is the hard requirement** — enforce may not flip until PR-c is live. Same-window-as-UI-live is a **strong preference** (avoids a long free-text-only exercise path), but because the guard makes flip-back clean, an imperfect gap is safe rather than dangerous. Flip in a low-active-battle window regardless.

---

## 7. Rollback plan (revised — the read-side guard changes everything)

| Piece | Rollback |
|---|---|
| Release 1 tuned values | Revert value PR; new battles revert; stamped battles finish on old values. Watch thresholds decide before irreversibility |
| Release 2 dark-inert | Flag off / revert — inert, clean |
| Release 2 WS3 (LIVE-PROMPT) | Revert prompt PR — reverts next eval, no snapshot residue |
| Release 4 enforce | Flip to observe → **clean on next eval** via the read-side guard (§3.6): persisted directives/leans stop rendering immediately, data kept for audit. No longer battle-granular |

The read-side guard (§3.6) is what upgrades the enforce rollback from "battle-granular residue" (V1.0) to "clean on next eval" (V1.1) — the single most important operational improvement in this revision.

---

## 8. Sequencing + verification

Per §0.1 release train. Every piece script-verified (WS1/calibration pattern); no fenced edit unverified.

### 8.1 Combination + cross-path matrix (review #7) — mandatory

Beyond the archetype-pairing set (design §7.6), add **path-divergence** tests for the dial's choke-point coupling: initial-pick / normal-swap / guardian-exit / watchlist-influenced / chat-directive / lean+opposing-directive paths × measured/standard/aggressive × fallback-config path. Assertions: fully-populated config after clamp; no downstream default reversion; safety fields untouched; receipt provenance accurate; **same stamped dial → same resolved config across every path**; non-standard tempo never alters platform-safety behavior.

---

## 9. Open questions — V1.1 (small residue for Flash)

1. **Release 1 rollback thresholds** — the actual numeric bands on rotation/swap/guardian-exit/failed-eval/concentration/volatility that trigger a values rollback. These need founder numbers before Release 1 merges (they gate promotion). Draft from the B4 synthetic + zero-floor baseline, or wait for a first live day to set them?
2. **WS3 product-copy gate (§5)** — confirm the intended user-facing copy is "watchlist influences attention," not "refuses off-style names." If the latter, WS3 defers.
3. **Read-side guard scope (§3.6)** — suppress *both* directives and leans when not enforce, or is there a case for keeping chat directives live under observe (they classify-and-log today)? Recommend suppress both for a clean rollback semantic; flag if observe-directive behavior must be preserved.

---

## 10. Review dispositions

| Review point | Disposition |
|---|---|
| Decouple tuned values | **Accepted** — Release 1, standalone, config-versioned, thresholds pre-set (§0.1, §4) |
| Read-side rollback suppression before enforce | **Accepted** — PR-c, enforce prerequisite, clean-on-next-eval (§3.6, §7) |
| Cap denominator fix pre-enforce | **Accepted** — target-slot denominator, projected book, 1–6 tests (§6.1) |
| Four-category live/dark reclassification | **Accepted** — the framing fix (§0) |
| WS3 = soft prompt precedence only | **Accepted** — copy gate, adversarial tests, no hard-refusal copy (§5) |
| Cross-path dial tests | **Accepted** — path-divergence matrix (§8.1) |
| Real override-suppression for opposed leans | **Accepted** — per-battle override record, suppress opposed lean (§3.4) |
| Lean snapshot id+version+text | **Accepted** (§3.1) |
| Enforce flip same-window-as-UI | **Modified** — guard is the hard requirement; same-window a strong preference (guard de-risks the gap) (§6.2) |

---

## 11. Locked (V1.1, pending sign-off)

1. **Split the live risk:** four release categories, sequenced release train — tuned values first and alone, then the fenced bundle, then UI, then enforce.
2. Precedence ladder + two principles unchanged.
3. Read-side rollback guard is bundle scope AND an enforce hard-prerequisite — makes flip-back clean-on-next-eval.
4. Cap denominator fixed (target-slot) pre-enforce.
5. Standing leans: ≤2, id+version+text snapshot, opposition-pairs with real override-suppression state.
6. Tempo dial: snapshot-stamped, direction-aware bands, merge-not-replace, dial-attributed receipts.
7. WS3: soft prompt precedence only, copy-gated, refusal engine deferred.
8. Enforce: founder-executed last, guard-gated, low-battle window.
9. Combination + cross-path dial matrix mandatory.

**Next steps:** Flash sign-off on §9 residue → V1.1 final → first build spec = **Release 1 (tuned values)**, since it ships earliest and its watch window can run in parallel with Release 2 authoring.
