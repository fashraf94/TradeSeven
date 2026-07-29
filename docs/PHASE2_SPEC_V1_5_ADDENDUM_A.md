# PHASE 2 SPEC V1.5 — ADDENDUM A (FOUNDER RULINGS, P1 GATE)

**Date:** July 25, 2026 · **Relayed verbatim by founder** · Commit beside the V1.2–V1.5 set. Governs together with V1.5.

**R-A1 — P2-48 scope (ruling on the census finding).** R4-B2's "only module permitted to import the Anthropic client" was unscoped spec text — a spec-author defect of the same class Amendment H fixed for P2-28, reintroduced one row over. **Scope:** `wireModelCall` is the sole Anthropic-client importer within the **Wire context**: the FantasyTimes generation seams (`api/fantasytimes/**` modules calling `messages.create`/`batches.create`), the Wire `_utils` modules, **and the N3 editorial judge call** — the judge routes through the wrapper too, so the memo's `judgeModelId` is execution-bound, not declared (P11 applied to the judge). The dependency test asserts exactly this set. Fenced `decide.js` and all other repo importers are **out of scope and untouched**; whether Phase 3 routes `decide.js`'s call through the wrapper is a Phase 3 §7-spec question, deferred.

**R-A2 — Rebase-target language.** Committed SHAs in specs are historical grounding, never build targets. The rebase target is always current `origin/main` at build start, after `git fetch`, with the byte-identical target-file check and flags-false verification re-run against actual HEAD. CC's reading (`db6f5ebc`) is confirmed correct.

**R-A3 — Flag-split prose rule (BUILD_RULES §1, postdates V1.5).** At P1 kickoff, quote the rule verbatim in the session and apply its letter. **Regardless of whether it triggers,** register `voiceLayerPrompt.js`'s flag-conditional newsLine rendering in `promptHonestyRegistry.js` in the same commit that adds it — over-compliance with an honesty registry costs one line; inferring around a §1 rule is the failure mode the rule class exists to prevent. N1.3 gains this as an explicit requirement.

**P1 start conditions:** this addendum committed · `seedConsensus` fix landed (D-P2-10 — founder task, now on the critical path) · then P1 proceeds (`WIRE_GENERATION_VERSION` + resolver + `wireModelCall` + manifest/baseline hash). The wrapper work routing all generation seams will cross the review threshold — plan the `/code-review`-equivalent accordingly.

*PHASE2_SPEC_V1_5_ADDENDUM_A.md — July 25, 2026*
