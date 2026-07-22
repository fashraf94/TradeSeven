# Archetype Mastery — P2 Greenlight & Ratifications (V2.2 delta)

> **Transcription note (P2 session, July 21, 2026):** verbatim transcription of two founder messages relayed in-chat to the build session — the P2 greenlight directive and the post-review ratification — per the verbatim-founder-paste precedent (`FANTASYTRADES_PRELAUNCH_SEQUENCE_AMENDMENT_A_JUN10_2026.md`, `ARCHETYPE_MASTERY_SPEC_V2_1_STOP_RULINGS_JUL21_2026.md`). Committed on the founder's instruction ("memo to docs/"). This is the **V2.2 delta** to `ARCHETYPE_MASTERY_SPEC_V2_LOCKED.md` (as amended by V2.1); where they conflict, this document wins. **Shape delta of record:** the §5 `masteryAward` shape gains optional `placementInputs?` (paying awards only, never zero receipts) — backfill and rules work must use this enumeration. Immutable once added (docs maintenance rules).

---

## Part 1 — P2 greenlight (verbatim)

P2 GREENLIT on the same branch. First commit: placementInputs snapshot (sibling ids + scores used) on the award receipt — converts ADV-1 to auditable; footnote it as such. Then P2 per spec §12 + Phase 0 anchors: lean caps at both anchors (equip-lean.js chokepoint + leanRevalidation.js kernel — all logic stays in the non-fence module; the fenced createAgentBattle call site is untouched); dial-position gate at set-tempo-dial validation + tick-time clamp with grandfathering per spec §6 (equipped state never clamps; L1 leaving aggressive is one-way); Forge server enforcement at reforge-bundle.js:95 / equip-bundle.js:107-108 with the lazy legacy floor (max(masteryCap, liveLegacyEntitlement), single server consumer at equip-bundle.js:35) — the A8 byte-identity exemption footnote applies to the flags-off hardening of today's limits. MASTERY_ENFORCEMENT_ENABLED default false; truth-table rows 0·1·0 and 1·1·0 get explicit tests (enforcement without XP / without surface). Standard gates; /code-review high on the P2 delta; then HOLD — the end-of-branch adversarial pass will be scoped to everything post-P1.

## Part 2 — Post-review ratifications (verbatim)

All three rulings RATIFIED as above (reforge with the A8-footnote-relocation rider; dial with the P3 notice rider; memo to docs/).

## Part 3 — What the ratifications bind (build session's record of the three items, as flagged in the P2 report §6c and ratified above)

1. **Reforge-anchor deviation, RATIFIED with the A8-footnote-relocation rider:** the reforge rule-capacity check is removed (wrong dimension; trim-path deadlock); equip-bundle is the enforcement gate and equipped bundles' rule content is client-immutable (`firestore.rules` bundles guard). The A8 byte-identity exemption footnote relocates to the surviving dark hardenings: the equip-time rule-capacity check and the equipped-content immutability guard.
2. **Dial invalidation on archetype switch, RATIFIED with the P3 notice rider:** under enforcement an equipped `aggressive` re-validates against the NEW archetype's level in the change-archetype transaction and resets to `standard` below L2 (V2.1 STOP-B "switching archetypes switches/invalidates them"). **P3 obligation:** the surface phase must show the user a notice when this invalidation fires (the §8 notice pattern), not a silent reset.
3. **Award-shape delta, RATIFIED:** `placementInputs?` on paying `masteryAward` receipts (this document is the V2.x record the lock footer requires).
