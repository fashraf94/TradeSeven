# Framework Review — Opening-Gate Resolution Note

**Date:** 22 September 2026 · **Author:** Fable · **Status:** Committed with the gate-fix docs PR
**Responds to:** the expanded audit's opening-gate STOP report (22 Sep, branch `codex/partnership-learning-reuse-audit` @ `9a95ea66`). This note resolves gate items only. It changes no finding, no disposition, and no governing text.

## R1 — JEV adoption stamp

The adjudication `docs/20260919_ASTRA_TRADING_BRAIN_JEV_DISCOVERY_ADJUDICATION_V1_1.md` receives, in the gate-fix PR: a header status change from `proposed` to **Adopted by founder, 19 Sep 2026**, and a dated stamp appended at the end containing that exact phrase. The intended stamp existed only as instructions in other documents; this PR lands it on the artifact itself. D-24, the J1→J2→J3 ordering, and every ruling in the adjudication are unchanged — this records a decision already made.

## R2 — Forge Record Phase 0 report

The filename `2026-09-12_FORGE_RECORD_PHASO_DISCOVERY.md` cited in Fable Review V1.1 §7 and the original docs-PR prompt was a **draft citation**, corroborated on `main` by `docs/2026-09-22_CC_ARC_ANSWERS_TO_FILM_ROOM.md:62`. The gate-fix PR fetches branch `docs/forge-record-phase0`, enumerates its actual document files, and commits the Phase 0 report under its **real filename** into `docs/audits/`, recording the resolved path in the commit message and the canonical index. Prior citations to the draft filename are historical and are superseded by the index entry. If the branch holds no report, the PR stops and the fallback is committing the report from the founder's 12 Sep session record, exactly as the register was recovered.

## R3 — Watchlist equip reference

`WATCHLIST_EQUIP_SYSTEM_REFERENCE.md` was a chat-side reference document, never previously in the repository. The gate-fix PR commits it byte-faithfully to `docs/`. It is the canonical description of the shipped equip system and a required anchor for §10.1/§10.4.

## R4 — Intraday anchor resolution

`INTRADAY_DATA_BUILD_1_SPEC_V3.md` and its Amendment A are chat-side design history and are **not required on `main`** for the gate. The repository canon the audit anchors to is: `docs/specs/INTRADAY_DATA_BUILD_1_CONTRACT_V1_1.md` (the build-governing contract), its calcVersion-2 addendum as committed in `docs/specs/`, and `docs/audits/20260918_PHASE0_INTRADAY_DATA.md`. References to "Intraday V3 + Amendment A" in the addendum's anchor tables resolve to these committed documents. The design-history specs may be committed later if wanted; nothing gates on them.

## R5 — S2 authoritative path

`docs/FantasyTrades_S2_Architecture_Audit_2026-09-21.md` (docs root) is the authoritative location, matching the reconciliation addendum's own relative link. Fable Review V1.1's `docs/audits/` placement line is historical; the file is **not moved**, so no committed link breaks. The gate-fix PR verifies the file's SHA-256 against the addendum §1 preservation value (`3cda3071…c435c`) and records the result.

## R6 — Anchor rule going forward

Anchor lists in audit briefs and gate checklists cite **repository paths verified by `git ls-tree`**, never chat-side document names assumed to be repo paths. Any chat-side reference an audit genuinely needs gets committed first, byte-faithfully, before it appears in a gate. The project-knowledge corpus and the repository are two different canons; this gate failure is the recorded cost of conflating them.
