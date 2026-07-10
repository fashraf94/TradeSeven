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

## Staged activation walk (Release 4)

The per-component walk entries (order, watch windows, per-step verification) are a **Phase 5 deliverable** (spec §9: compatibility floor + staged-walk entries + the enforce-prerequisite ledger — PR-c, PR-e, and the flag decoupling itself are Release-4 gates). This section is the placeholder they land in.

Known prerequisites already on record:
- **`STANDING_LEANS_ENABLED`** — the leanOverrides chat-side confirmation flow still needs its voice copy (flagged since PR-a; recorded on the flag's doc comment). Must exist before the flip.
- **`TEMPO_DIAL_ENABLED`** — the band table (0.7 / 1.0 / 1.3) is PROVISIONAL until promoted from the B4 acceptance report's real-data cross-check; the version binding self-disables the bands if Release 1 reverts.
- **`SECTOR_CAP_MODE`** — the observe-volume read (Rule 3).
- Every flip is founder-executed in its own watch window, never in a build PR (the PR #510 lesson).

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
