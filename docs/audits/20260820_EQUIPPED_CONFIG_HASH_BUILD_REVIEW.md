# E9 — equippedConfigHash Build + Review Record

**Date:** 2026-08-20 · **Branch:** `ops/equipped-config-hash` (cut fresh from `origin/main` @ `ef421a7f`)
**Authorization:** founder E9 authorization off the Strategy Foundation audit (session artifact `STRATEGY_FOUNDATION_AUDIT.md`, delivered 2026-08-20) — the manifest sub-field path, explicitly NOT the top-level-field variant.
**Scope:** 4 files, ~135 added lines. Below the BUILD_RULES §2 review threshold (≥10 files / ≥1500 lines); reviewed via the mutation-check battery below plus the full targeted-suite matrix.

---

## Executive verdict

| Item | Status |
|---|---|
| `equippedConfigHash` field on `resolvedAgentManifest` | **BUILT** — non-fenced sub-field per the PR3/PR4 precedent |
| Coverage-caveat docstring (verbatim contract) | **IN CODE** at the computation site |
| Firestore composite index entry (`agentId` + dot-path) | **IN FILE** — needs one manual Console creation (below) |
| Acceptance tests (stability / per-axis mutation / query round-trip) | **ALL GREEN** — 13/13 unit incl. 4 new; 2/2 emulator |
| Mutation checks (can the guards fail?) | **3/3 mutations kill exactly their named rows** |
| Full targeted matrix | **367/367** (189 unit + 43 importer + 135 emulator) |
| Fenced files edited | **NONE** (statement below) |
| Deviations from the authorization | **ONE** — snapshotAt excluded from the hash input; load-bearing, proven by Mutation 1 (below) |

---

## 1. What was built (file:line map)

### `api/_utils/resolvedAgentManifest.js` (non-fenced)
- `:129-139` — `equippedConfigContent`: the equipped-config object built ONCE (§9 one-source): `activeRules`, `equippedBundleIds`, `standingLeans`, `standingLeansInvalidated`, `dials`, `deployedGuardrails`, `equippedWatchlist` (raw, un-stamped).
- `:141-144` — `frozenLayers` now derives from that object, adding ONLY the per-creation `snapshotAt` stamp to the watchlist. Output values byte-identical to before (same keys, same values); the construction is re-rooted so the frozen record and the fingerprint cannot disagree.
- `:146-165` — the fingerprint: `equippedConfigHash = canonicalContentHash(equippedConfigContent)`, with the founder-required coverage caveat in the docstring: **config as frozen at battle birth, six axes by value, version stamps deliberately excluded** — and the pointer that pinning the identity/rule-library epoch is a SECOND field (`configEpochHash`), never a widening of this one.
- `:210-212` — the field enters the manifest literal adjacent to `frozenLayers`.

No import added (`canonicalContentHash` was already imported at `:41`); no new importer of any legacy archetype table, so the §2.3 import-boundary ratchet is not tripped (`resolvedAgentManifest.js` is already a sanctioned composition-layer member, `archetypeRegistry.test.js:198`).

### `firestore.indexes.json`
- `:291-303` — the composite index: `agentBattles` × (`agentId` ASC, `resolvedAgentManifest.equippedConfigHash` ASC). Dot-path composite has in-file precedent (`agentContext.archetype` entry).

### `api/_utils/resolvedAgentManifest.test.js`
- `:183-244` — the E9 battery (4 rows): stability-across-clock (with the manifestHash contrast), the §9 binding row (recomputes the hash from the manifest's OWN `frozenLayers` minus only `snapshotAt`), context-indifference (compiledBuild presence, gameMode), and the per-axis mutation battery — **one mutation per axis**, including the resolved-hardness axis `projectedRulesHash` is structurally blind to.

### `test/rules/equippedConfigHashQuery.rules.mjs` (new)
- The emulator query round-trip: three seeded battles (same-agent/other-config, other-agent/same-config as decoys) → the two-equality-filter query returns exactly the matching doc; unknown fingerprint returns empty; pre-E9 legacy docs (no key / no manifest) are silently excluded, never matched or thrown on. Runs under `withSecurityRulesDisabled` — the Admin-SDK-equivalent path matching the production reader. Via `npm run test:rules`.

## 2. The ONE deviation, and its proof

**Authorized literal:** `equippedConfigHash = canonicalContentHash(frozenLayers)`.
**Built:** the hash input is `frozenLayers` **minus the watchlist's per-creation `snapshotAt` stamp** (the only per-creation value inside `frozenLayers` — upstream `buildEquippedSnapshot` emits `{watchlistId, name, tickers}` with no timestamp, `watchlistEquip.js:170-176`; the stamp is added at freeze).

**Why:** the authorization's own acceptance bar — "the hash is stable across identical configs" — cannot pass under the literal: two battles under the identical config with a watchlist equipped would carry different `snapshotAt` values and therefore different hashes, minting a new "config" per battle and defeating the query the field exists for. The exclusion follows the in-repo rule of record (`compileBuild.js:519-522`: contentHash excludes `compiledAt` — "identical inputs at different times are the SAME build").

**Proof (Mutation 1):** hashing `frozenLayers` literally was run as a deliberate defect — it fails exactly the stability row and the §9 binding row (2 failed / 11 passed). The deviation is load-bearing, not stylistic. If the literal is nonetheless preferred, it is a one-line change — but acceptance row (a) must then be dropped for watchlist-equipped configs.

## 3. Fence statement (BUILD_RULES §1 / §2)

- **Fenced files edited: NONE.** The single runtime edit is in `api/_utils/resolvedAgentManifest.js`, the explicitly NON-FENCED kernel (`resolvedAgentManifest.js:5`), whose sub-fields were previously extended by Composition PR3 (`compositionCompat`) and PR4 (`compositionSourceGeneration`/`compositionSemanticHash`) without fenced edits — the sanctioned precedent this build rides.
- **Fenced functions called: none new.** Fenced `createAgentBattle` (`agentBattleService.js:237`) continues to call `buildResolvedAgentManifest` through the existing, untouched conditional spread; `agentBattleService.js` is byte-unchanged on this branch.
- **The `createAgentBattle` doc shape** gains no top-level key — the field lives inside the additive `resolvedAgentManifest` block. The top-level variant was considered and **rejected per the founder's instruction #5** (it would be fenced doc-shape contact).
- **Protected stores / censuses:** no new write site (the field rides the existing battle-doc create — `commitBattleDocWithPin::create::unresolved` count unchanged, scan green); no new derived-writer (rides the existing census row 2, `compositionDerivedWritesCensus.json:24-44`, mechanism unchanged — tokens/order verified green); no flag added or flipped (flagPinGuard green).

## 4. Test + verification matrix

All run at this branch's HEAD state; commands and counts as executed.

| Suite | Result |
|---|---|
| `resolvedAgentManifest.test.js` (9 existing + 4 new E9 rows) | **13/13** |
| `agentBattleService.test.js` (byte-tests strip the manifest; manifest block asserted separately) | **8/8** |
| `p4Equivalence.battery.test.js` (fence photograph — manifest stripped at `:615`) | green |
| `compositionGenerationFence.test.js` (FC-1 stamp pair) | green |
| `compositionDerivedWrites.census.test.js` + `compositionProtectedStores.scan.test.js` | green (4 + 9) |
| `composition.acceptance.test.js`, `shadowAssemblyCapture.test.js`, `archetypePhase2Constants.test.js`, `archetypeRegistry.test.js`, `src/config/flagPinGuard.test.js` | green |
| **Subtotal, targeted unit (11 files)** | **189/189** |
| Importers of the builder: `compileBuild.candidate`, `compositionAdvisoryRender.activation`, `composition.a7lock`, `composition.m7Budget`, `composition.m7e2eBudget` | **43/43** |
| **Emulator (`npm run test:rules`, real Firestore emulator):** all 5 rules files incl. the new `equippedConfigHashQuery.rules.mjs` (2 tests) | **135/135** |

**Mutation-check battery (§2: a row that cannot fail is not a guard):**

| Deliberate defect | Rows that failed | Verdict |
|---|---|---|
| 1 — hash `frozenLayers` literally (snapshotAt included) | stability + §9 binding (2) | guard REAL; deviation load-bearing |
| 2 — `deployedGuardrails` dropped from the hash input | per-axis battery + §9 binding (2) | guard REAL |
| 3 — `gameMode` context folded into the hash | context-indifference + §9 binding (2) | guard REAL |

Each mutation killed exactly its named rows and nothing else; the restored implementation is 13/13.

`vite build` not run: the change touches no `src/` runtime file (the §2 build requirement binds at the review threshold; the App.jsx hazard it exists for is not reachable from this diff).

## 5. Index deployment — ANSWER TO THE FOUNDER'S QUESTION

**Yes — manual Console creation is required.** Per `FIRESTORE_INDEX_DRIFT_CLEANUP.md:113-114`, the standing rule until the drift cleanup lands is the dual-write: **(a)** the `firestore.indexes.json` entry (in this branch) AND **(b)** manual creation via Firebase Console during merge prep. A CLI `firebase deploy --only firestore:indexes` is unsafe today — it prompts to delete the 13+ production-only drifted indexes and 400s on the malformed `ingestedClaims` entry.

**Console spec to create:** Firestore → Indexes → Composite → Add:
- Collection ID: `agentBattles`
- Field 1: `agentId` — Ascending
- Field 2: `resolvedAgentManifest.equippedConfigHash` — Ascending
- Query scope: Collection

**Honest scope of the emulator row:** the emulator serves queries WITHOUT composite indexes, so the round-trip proves the dot-path query shape and result set — not the production index. Until the Console index reads Enabled, the production query will return the standard failed-precondition error with a create-index link; no other surface is affected (nothing queries this field yet).

## 6. Behavior notes (recorded truth)

- **Live from merge+deploy:** `MANIFEST_WRITE_ENABLED` is already true, so every battle created after deploy carries the field. No flag rides this change (founder-authorized live sub-field, matching the manifest's own live posture).
- **`manifestHash` values shift** for battles created after deploy — the new field is manifest content, and `manifestHash` covers everything except itself (`resolvedAgentManifest.js` contract line, unchanged). No reader compares manifestHash across battles or against precomputed values (`shadowAssemblyCapture` copies it as an identity anchor only); the P4 fence photograph strips the manifest. Recorded so the shift is never mistaken for drift.
- **Coverage boundary:** battles created before this deploy have no `equippedConfigHash` and are silently excluded from fingerprint queries (proven by the legacy-doc emulator row). Backfill, if ever wanted, is a separate founder-gated task — the manifest is create-only-after-start (R1-4), so a backfill would be a deliberate exception, not a routine write.
- **`frozenLayers` byte-identity:** the construction re-rooting changes no key and no value of `frozenLayers` — locked by the untouched existing rows (kernel one-source, watchlist snapshotAt) plus the P4 battery.

## 7. Separate-tasking register (found, not fixed)

None new beyond the Strategy Foundation audit's register. The audit's item 6 (`deployedStrategy.guardrails` derived-vs-user-input classification ambiguity) remains open and is not worsened by this change — the fingerprint hashes the frozen copy, taking no position on its census classification.

**STOP.** Pushed for founder review; no PR opened, no CI watched, no merge driven (BUILD_RULES §2).
