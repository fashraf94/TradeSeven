# Composition candidate-registry generation pipeline

Deterministic tooling that produces `src/data/archetypeCompatibilityCandidate.js`
(the candidate cell matrix), its `…​.manifest.json`, and the §7b diff report
(`docs/audits/20260806_COMPOSITION_LEGACY_VS_CANDIDATE_DIFF.md`) from the seven
accepted authoring ledgers.

## Provenance chain

```
docs/CELL_BATCH_C1..C7_*.md   (the seven accepted authoring ledgers — source of truth)
        │  transcribed cell-by-cell, one file per batch (the auditable record)
        ▼
scripts/composition/cells_C1.js … cells_C7.js
        │  assemble.mjs  — merges, sorts set-like arrays, validates the §1 schema,
        │                  reports coverage/gaps → merged_cells.json
        ▼
scripts/composition/merged_cells.json   (normalized, validated)
        │  generate_module.mjs           → src/data/archetypeCompatibilityCandidate.js
        │  generate_manifest_and_diff.mjs → …​.manifest.json  +  the §7b diff report
        ▼
committed, checked-in source of truth
```

The `cells_C*.js` files are the **transcription record** — each is a faithful,
tally-verified transcription of its ledger (per-batch tallies reconcile exactly
against each ledger's own "Batch findings" count). The two adversarial review
lenses in `docs/audits/20260806_COMPOSITION_PR1_CODE_REVIEW.md` verified them.

## Regenerate

```
node scripts/composition/assemble.mjs            # -> merged_cells.json (+ coverage report)
node scripts/composition/generate_module.mjs     # -> src/data/archetypeCompatibilityCandidate.js
node scripts/composition/generate_manifest_and_diff.mjs  # -> manifest.json + §7b diff report
```

`generate_module.mjs` is deterministic (rule ids sorted, fixed archetype order,
set-like arrays pre-sorted), so regeneration is byte-identical. The tallies in
`generate_manifest_and_diff.mjs` (`LEDGER_BATCH_TALLIES`) are hand-transcribed
from each ledger's own tally line — the independent (anti-circularity, M9) side
that the completeness test asserts against the registry.

## Known advisory gap (tracked, not fabricated — BUILD_RULES §3)

37 tension cells carry `advisory: null` because their verbatim governed guidance
is not in the committed repo: **35** are the "unchanged" C7 cells whose advisory
of record lives in the uncommitted **C7 V1.0** (`CELL_BATCH_C7_FINAL_V1.md:7`
defers unchanged advisories to V1.0), plus **2** C2 cells the C2 ledger left
without an authored guidance sentence. Supplying C7 V1.0 closes 35 of them; the
registry is not activation-ready until the gap is filled.
