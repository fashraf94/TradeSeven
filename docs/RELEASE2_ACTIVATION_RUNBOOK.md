# Release 2 (Fenced Customization Bundle) — Activation Runbook

**Status:** rules of record for operating the Release-2 flags. Created at Phase 3 (2026-07-10) to carry the two founder-adopted operating rules; the full staged-activation-walk entries land at Phase 5 (spec §9).
**Audience:** the founder (non-technical). These are operating rules, not build steps.
**The flags this governs:** `ARCHETYPE_INTEGRITY_MODE` (chat directives only), `SECTOR_CAP_MODE`, `STANDING_LEANS_ENABLED`, `TEMPO_DIAL_ENABLED` — four independent walks (master spec V1.2 errata #1). All live in `src/config/featureFlags.js`.

---

## Rule 1 — The compatibility floor (guard-as-floor)

**The PR-c read-side guard is the compatibility floor for every Release-2 rollback.** Once any battle document carries customization state (a persisted directive, standing leans in a snapshot, a tempo dial, a `controlEpochLog`), a CODE rollback must never go below the commit that carries the shared control renderer and its read-side guard (`e0d04f1`). Reverting past it would put un-gated readers back in front of persisted control state — a directive or lean at rest would render into prompts with no flag consulted at all.

- **Flag rollbacks are always the first tool** — that is what the flags are for; this rule is about *code* rollbacks only. (But see Rule 2 for what leaving `'enforce'` does to in-flight directives — flag rollbacks are technically clean, not consequence-free.)
- If an incident ever seems to demand reverting below the floor, the correct move is: flip the flags to their off/observe states first (see Rule 2 for directives), and treat the below-floor revert as its own decision with the battle data in view.

## Rule 2 — Directive rollback: `'observe'`, never `'off'` (ADOPTED 2026-07-10; rationale corrected at Phase-3 review)

**While any battle carries an active directive, roll `ARCHETYPE_INTEGRITY_MODE` back to `'observe'` — never to `'off'`.**

**First, know what any rollback does — there is no "pause" state.** The moment the flag leaves `'enforce'`, the next eval tick logs a suppression epoch on every battle with an active directive, and a suppressed directive **never resurrects for that battle** (by design — no-resurrection is the epoch contract). This happens whether you land on `'observe'` or `'off'`. Rolling back permanently retires the directives that were in flight; flipping back to `'enforce'` later does not restore them. If that price is not acceptable, the rollback is the wrong tool for the incident.

**Given that, why `'observe'` is still the only correct target:** the difference is what gets *written* while you are rolled back.
- Under `'observe'` the gate stays on duty — it evaluates proposals and **writes nothing**. No new directive state accumulates.
- Under `'off'` the directive write path runs the legacy `normalizeDirective` line verbatim — chat can mint **free-text directives no gate ever screened**, and because those are new (never-suppressed) records, they WILL render into prompts when you later return to `'enforce'`.

Either state stops directives rendering immediately; `'observe'` is the one that leaves nothing un-screened behind. The same logic applies at every step of the staged walk: step back one state, never jump to `'off'` while directives are in flight.

## Rule 2a — What a paused-then-resumed walk looks like

Because rollback retires in-flight directives permanently, a resumed walk starts CLEAN: returning to `'enforce'` affects only directives minted after the return. Expect coaches' prior directives to be gone (visible in each battle's `controlEpochLog` — the suppression epoch is the audit record), and communicate that before flipping back.

## Rule 3 — Sector-slot walk reads the observe volume first

`SECTOR_CAP_MODE` walks `'off'` → `'observe'` → `'enforce'`. The `'observe'` state exists to be read: every swap the enforce cap would have blocked lands as a `would_block_swap` override in the evaluation record and a `[SectorSlot] would_block` log line — through the same math and preconditions as enforce, so the measured volume is exactly what enforce will do. Do not skip from `'off'` to `'enforce'`; the observe read is the go/no-go input for the flip.

**How to read the volume:** `would_block_swap` counts everything the core cap would block — *including* swaps a user's own stricter cap already blocked today (those evaluation records carry BOTH a `blocked_swap` and a `would_block_swap`). The flip's *incremental* effect is the set of records with a `would_block_swap` and **no** accompanying `blocked_swap`; the raw count overstates it whenever users run their own sector caps.

---

## Staged activation walk (Release 4) — the entries of record (written at Phase 5)

**One flag per watch window. Proposed order: cap → leans → dial** (smallest blast radius first: the cap governs one archetype in one mode; leans change prompts for every equipped user; the dial changes trading physics). Every flip is a one-line PR you merge yourself in its own watch window — never bundled with other work (the PR #510 lesson). Before EVERY step: run `node scripts/release2-dark-smoke.js` on the pre-flip state — it must be GREEN except for the flag you already walked.

### Walk step 1 — `SECTOR_CAP_MODE`: `'off'` → `'observe'` → `'enforce'`
- **Enforce-prerequisites:** PR-c..PR-f merged; the decoupling itself deployed (the cap must fire on ITS flag, never `ARCHETYPE_INTEGRITY_MODE` — the decouple test in `agentGuardrails.test.js` is the proof).
- **`'observe'` window:** watch `[SectorSlot] would_block` log lines and `would_block_swap` entries in tournament Diversifier evaluation records. Read the volume per Rule 3 (the incremental set = `would_block_swap` WITHOUT an accompanying `blocked_swap`).
- **Go/no-go to `'enforce'`:** the incremental volume looks sane to you (a handful of construction-shaping blocks, not a flood), and no would-block fires on a book that is NOT a tournament Diversifier (that would be a gate bug — STOP).
- **Verification after `'enforce'`:** the first real block appears in a status feed as `guardrail_block` with `triggeredBy: guardrail_max_sector_weight`; swaps still execute for other archetypes.
- **Rollback:** flip back to `'observe'` (keeps measuring) or `'off'` (fully dark). No epoch/persistence consequences — the cap holds no durable state.

### Walk step 2 — `STANDING_LEANS_ENABLED`: `false` → `true`
- **Enforce-prerequisites:** the leanOverrides chat-side confirmation VOICE COPY exists (flagged since PR-a; recorded on the flag doc — this is a hard prerequisite); walk step 1 stable through its window.
- **What turns on at once:** the equip/unequip-lean endpoints stop 404ing; snapshot stamping was always live (leans data may already exist at rest — it renders for the first time); leans blocks appear in BOTH assemblies post-revalidation.
- **Watch:** `[LeanRevalidation]` events (omissions should be rare and reasoned: `not_in_menu` after archetype changes, `deprecated_version` after wording bumps); prompt sizes; the conflict-group version-currency test stays green in CI (a menu edit mid-walk invalidates adjudication — release-blocking).
- **Rollback:** flip to `false`. Leans are durable desired state and RESUME on re-flip (no kill records for leans — proven in the PR-f matrix). Safe both directions.

### Walk step 3 — `TEMPO_DIAL_ENABLED`: `false` → `true`
- **Enforce-prerequisites:** the band table is promoted from PROVISIONAL (the post-Release-1 real-data cross-check re-pins or confirms 0.7/1.0/1.3); `TEMPO_DIAL_BANDS.forKnobConfigVersion === KNOB_CONFIG_VERSION` (the matrix asserts the live binding — if Release 1 moved the knobs, the bands self-disable and the flip is a visible no-op with `band_version_mismatch` receipts, not a hazard); walk step 2 stable.
- **What turns on:** set-tempo-dial stops 404ing; the clamp applies desired tempo at the eval seam; `swapProvenance` on new swaps carries `tempoEffective` ≠ `'standard'` for dialed agents.
- **Watch:** `swapProvenance.suppressionReason` frequency (a burst of `band_version_mismatch` = the binding tripped — expected fail-closed, investigate before proceeding); per-archetype swap-rate drift vs the B4 acceptance envelope.
- **Rollback:** flip to `false`. Desired dials persist; every receipt shows `dial_disabled` (visible, never silent). Safe both directions.

### After the walk
The `ARCHETYPE_INTEGRITY_MODE` walk (directives: `'observe'` → `'enforce'`) is a SEPARATE program gated on the pre-flip reliability eval (hard zeros), and is governed by Rule 2 above whenever it moves. It shares no flag with this walk (the PR-e decoupling is what made that true).

### The compatibility floor — precise trigger (spec §8 entry)
**After the first enforce event ever occurs** (any battle logs a `controlEpochLog` entry under `integrity=enforce`, or any lean/dial has ever rendered/applied), **no assembly/renderer code rollback below the PR-c guard commit is permitted while a "zero active persisted controls" query returns nonzero** — i.e. while any active battle carries a directive, snapshot leans, a dial, or a `controlEpochLog`. Check before any such revert; Rule 1 has the reasoning.

---

## Deferred / backlogged (founder rulings of record)

| Item | Ruling | Date |
|---|---|---|
| `seedDefaultTraits` onboarding persist failure is silent to the user (log-only; a new agent can land traitless with no retry path) | **DEFERRED to a later release** — backlogged here; candidate shape is a retry flow on the onboarding path | 2026-07-10 (Phase-2 acceptance) |
| tournamentAgentBoards leans scoping (prescribed deploys) | Parked as a **Release-4 decision** | 2026-07-10 (Phase 0) |
| decide.js battle-creation CAS (settingsRev compare-and-set at deploy) | **Release-4 ledger item** — explicitly not the Release-2 authorization | 2026-07-10 (Phase 0, ruling D3) |

## Design notes an operator should know

- **Epochs are tick-observed.** A flag round-trip that lands entirely between eval-cron ticks logs nothing — correctly, because no prompt rendered (or suppressed) anything during it. Don't expect a `controlEpochLog` entry for a flip you reverted within a tick.
- **User guardrails never ride these flags.** A user's own `maxSectorWeight` (and every other deployed guardrail) fires under every state of `SECTOR_CAP_MODE` — the flag governs only the Diversifier core slot cap.
