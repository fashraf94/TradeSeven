# Huddle S1 — query and index manifest

**Required by:** spec V1.1 Amendment A §A8 (and §A11's housekeeping). Written by the S1 build as it built.
**Rule applied:** Firestore needs a composite index for a query that combines an equality on one field with a range or an order on another, or a range on one field with an order on another. Equality filters alone are served by merging single-field indexes; a range and an order on the same single field use that field's single-field index. The emulator does not enforce composites, so the founder's flag-on smoke on the preview (live database) is the validation step: any query that fails for a missing index is a smoke blocker, and the report records the console link the error provides.
**Field overrides read:** `firestore.indexes.json` exempts `ticks.{manifest, checks, actions, controls, callEnvelope, decision, capture, scores}` from indexing, so no Huddle query filters on `controls.*` (RF-7).

| # | Where (file) | Collection | Filters / order | Composite needed? | Index added |
|---|---|---|---|---|---|
