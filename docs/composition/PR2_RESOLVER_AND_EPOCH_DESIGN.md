# Composition PR 2 — Resolver + Write-Epoch Design Note (the contract of record)

**Date:** Aug 6, 2026 · **Branch:** `claude/composition-pr2-enforcement` @ base `e7de3eed` · **Governs:** the three-layer state resolver (R6-B2/R5-M1) and the write-epoch fence (R5-B2/R7-B2) built in PR 2. Committed **before** the bulk implementation per founder instruction. Where this note and the implementation diverge, the divergence is a defect.

**Grounding:** Phase 0 items 10/14 (`docs/audits/20260806_COMPOSITION_BUILD_V09_PHASE0_DISCOVERY.md`), closure sheet §§III–IV (`docs/COMPOSITION_BUILD_SPEC_V0_9_1_CLOSURE_SHEET.md`). Anchors re-verified at this branch's HEAD: `agentSettingsTx.js:18`, `equip-bundle.js:105-116` (the `MASTERY_ENFORCEMENT_ENABLED` zero-I/O-while-dark read-join precedent), `deployBuildValidation.js:112-127` (the deploy gate's own non-fenced transaction), `decide.js:279-281` (activeRules write skipped when `activeBattleId` set; read-only fenced verification), `firestore.rules:240-281` (client rules/bundles writes, existing `get()` precedent).

---

## §1 · The three-layer resolver (ONE resolver, everywhere)

**Effective configuration = `base → immutable migration overlay → mutable active-epoch overrides`, highest-layer-wins**, computed by exactly one pure function:

```js
// api/_utils/compositionStateResolver.js
resolveEffectiveConfig({ base, overlayEntries = [], epochOverrideEntries = [], activeEpochId = null })
  → { effective, provenance }   // provenance: { [entryKey]: 'base'|'overlay'|'epoch' }
```

- **PURE** — no I/O, no clock, no flag reads. All storage access lives in thin adapters (the scan script, and later the PR-3/4 read paths). Identical inputs ⇒ identical output; the overlay hash is therefore reproducible anywhere.
- **Entry schema** (one shape for both mutable-layer kinds):
  ```js
  { entryKey,            // `${host}|${docPath}|${field}` — deterministic, sorted for hashing
    host,                // 'ruleDoc' | 'bundleSnapshot' — the M3 census host class
    docPath,             // Firestore path of the BASE doc the entry overlays
    field,               // dotted field the entry overrides (e.g. 'paramValues.period')
    action,              // 'clamp' | 'floor' | 'replace' | 'unequip'
    beforeValue,         // the before-image (M10 rollback ledger; null for unequip-set entries)
    afterValue,          // the resolved value (null when action === 'unequip')
    ruleId, archetype, cellRef,   // provenance back to the candidate cell + ruling
    migrationRunId }     // or epochId on active-epoch entries
  ```
- **Precedence:** for a given `entryKey`, an active-epoch entry (whose `epochId === activeEpochId`) wins over an overlay entry, which wins over base. Entries from a NON-active epoch are **ignored by resolution but never deleted** (A49 — rollback removes them from resolution by repointing `activeEpochId`; re-activation mints a fresh epoch so stale overrides cannot resurrect).
- **Layer immutability:** overlay entries are written once by `--apply` and never after; `overlayContentHash = canonicalContentHash(sortedEntries)` (array pre-sorted by `entryKey` — the serializer preserves array order, so sorting is the caller's job per the A7 amendment). Post-activation valid saves write the **epoch layer**, leaving `overlayContentHash` untouched (A47).
- **Consumers now:** the residual scanner and migration planner (A42: both observe the overlay value while an old-identity/base read observes base — asserted); the dry-run/preview reports. **Consumers later:** the candidate compiler (PR 3) and production reads under the activation record (PR 4). Nothing in PR 2 wires the resolver into any production read (A36's structural half: a forbidden-import test proves no production module imports it).

## §2 · Storage shapes (candidate-namespaced; no base record is ever rewritten)

| Doc | Purpose | Writer | Reader |
|---|---|---|---|
| `composition/writeEpoch` | THE epoch control doc: `{ state: 'open'\|'closed', epochId, closedAt, reason }`. **Absent ⇒ open** (fail-open = byte-identical today; the fence only bites when the §8 runbook writes it). | §8 runbook (founder-gated script, PR 4) | every fenced writer (in-tx), firestore.rules `epochWriteOpen()` |
| `compositionCandidateState/{candidateStateId}` | Overlay run metadata: `{ migrationRunId, identityVersionTarget, overlayContentHash, entryCount, createdAt, feedEntries[] }` — the candidate namespace §4 requires; the activation record (PR 4) points at this id | `migration-scan.js --apply` | scan verify, PR-4 activation transaction |
| `compositionCandidateState/{id}/entries/{entryKey}` | The overlay entries (schema above), before-images included (M10) | `--apply` (once) | resolver adapters |
| `compositionEpochOverrides/{epochId}/entries/{entryKey}` | Post-activation mutable layer (A47) | post-activation save paths (PR 4) | resolver adapters |

The `feedEntries[]` on the run doc are the **candidate-namespaced identityMigration feed entries** (M12): built at `--apply` in the battle-doc `statusFeed` entry shape (`type: 'identity_migration'`), user-visible **only** through `projectIdentityMigrationFeed()`, which returns `[]` unless the activation record names the epoch AND the flag is on (A44). No battle doc or user surface is written pre-activation.

## §3 · The write-epoch fence, per writer class (the item-14 census, mechanized)

**The guarantee (A41):** an old-epoch write attempting to commit after the watermark is REJECTED at commit. **The mechanism:** the epoch doc is read **inside each writer's transaction** (read phase). Firestore transactions are serializable over their read set — if the runbook closes the epoch between a writer's read and its commit, the commit conflicts, retries, re-reads the closed epoch, and **rejects with `epoch_closed`**. Rejection is the guarantee; detection (the scan watermark taken after registered writers drain) is the backstop.

| Writer class (census) | Fence mechanism | Dark posture |
|---|---|---|
| **11 HTTP settings endpoints** (equip/unequip-bundle, equip/unequip-lean, equip/unequip-watchlist, change-archetype, update-agent-settings, set-tempo-dial, set-rule-hardness, reforge-bundle) | `await validateWriteEpochInTx(tx, db)` in the read phase of the existing transaction (`compositionWriteEpoch.js`; throws `EpochClosedError` → 409 `epoch_closed`, nothing written) | `COMPOSITION_EPOCH_FENCE_ENABLED=false` ⇒ returns before any read — **zero added I/O** (the `MASTERY_ENFORCEMENT_ENABLED` read-join precedent, `equip-bundle.js:112-115`) |
| **Deploy recompile** (`ensureDeployableCompiledBuild`) | same call in the deploy gate's own transaction (`deployBuildValidation.js:112` — non-fenced) → `{proceed:false, reason:'epoch_closed'}` → the deploy 409s **without touching fenced `decide.js`** | same flag; dark = zero I/O |
| **Client-SDK authoring writers** (`createRule`/`updateRule`/`createBundle`/`forgeBundle`/… — `firestore.rules:240-281`; `createAgent` births `:147-220`) | **rules-layer validation**: `epochWriteOpen()` = `!exists(composition/writeEpoch) || get(...).data.state == 'open'`, added to the rules/bundles create+update conditions and the agent create clause. Server-side evaluation at commit ⇒ genuine commit-time rejection for clients | **inert until Console deploy** (repo precedent G1); fail-open on absent doc ⇒ byte-identical behavior today even once deployed |
| **Background loops** (`trainingClone.provisionTrainingClones`, `seedArchetypeTraitsDeterministic` via its callers, `rule-compat-cleanup --live`, `mastery-preflip-normalize --apply`, `ws1-observe-walk`) | `await assertWriteEpochOpen(db)` at entry **and per batch/agent iteration** (bounded conformance — a loop straddling the close stops at the next iteration boundary); PLUS enumerated in the §8 runbook's pause list (belt and suspenders) | flag-gated no-op; scripts additionally listed in the census with their pause step |
| **`decide.js` activeRules write** (`:279-281`, fenced file) | **Classified DERIVED, transitively fenced — not an authority-store writer.** `projectActiveRules` is a pure function of rules docs + bundles + `equippedBundleIds` + hardness — ALL epoch-fenced stores above — so a window write can only re-derive values the frozen inputs already imply; it cannot commit new identity content. The residual scan reads the **authority stores through the resolver**, never `activeRules` (census host A: "derived — not a primary target"). The write is skipped entirely mid-battle. *Optional belt-and-suspenders:* a one-line fenced splice at the PR-4 sanctioned fence entry if the founder wants literal coverage; **not** required for soundness and not done in PR 2. |
| **CPU/house seeds** (`tournamentCpu`) | no rules subcollection, `activeRules:[]` — no identity content to fence (census F); enumerated as no-op class | — |
| **Compiled-build writes** (`writeCompiledBuildsInTx`) | covered **atomically** by the endpoint/deploy-gate transaction that already validated the epoch (same tx ⇒ same commit) | dark under `COMPILER_ENABLED=false` regardless |

**STOP-check on the hard case (per founder instruction):** the client-SDK class has a sound mechanism (rules-layer `get()` on the epoch doc — server-evaluated at commit, precedented at `firestore.rules:213,242`), so no STOP fires. The one writer that cannot take an in-file check without fence contact (`decide.js` activeRules) is **classified out of the authority set with the transitive argument above rather than left silently uncovered** — recorded in the census (A46) with its classification and the optional PR-4 splice. If the founder rejects the classification, that is a fence-entry decision for PR 4, not a PR 2 improvisation.

## §4 · Migration (Method B, plan/apply split)

- **Planner is pure** (`compositionMigration.js`): `planMigration({ agentRecords, registry })` → overlay entries. Per-shape semantics (M4): range `{min,max}` → clamp to nearest bound; `{minOnly}` → floor; enum `{allow}` → replacementMap **or reject-and-unequip**, auto-select only when exactly one admitted value exists; `core_conflict` cell → `unequip` entry; `deferred` → no action (non-offerable is an offer-surface fact, not a migration mutation). Same planner runs dry and live — **A8 (dry-run selection == apply selection) holds by construction and is still asserted**, idempotent (A9: planning over an already-overlaid view yields zero new entries).
- **`--apply` writes ONLY the candidate namespace** (§2) — no base record, no live agent doc, no battle doc (A12/A36: base byte-untouched; asserted).
- **Scan script** (`scripts/composition/migration-scan.js`): dry-run default, `--apply --yes` gated, report file to `docs/audits/` at apply time (B4: the apply output is a post-deployment audit artifact). **Live run requires Firestore Admin credentials** (`FIREBASE_PROJECT_ID` + service account env) — absent in the build sandbox; the count is produced by a founder-run `node scripts/composition/migration-scan.js` (one command, read-only by default).

## §5 · Flags (dedicated event flags — R2-B3, no reuse)

See `docs/composition/PR2_FLAG_OWNERSHIP.md` for the table of record. Summary: `COMPOSITION_ENFORCEMENT_MODE='off'` ('off'|'observe'|'enforce' — offer/equip + whole-config boundaries), `COMPOSITION_EPOCH_FENCE_ENABLED=false`, `COMPOSITION_DISPLAY_ENABLED=false` (D2), `COMPOSITION_MIGRATION_FEED_ENABLED=false` (A44). Every row carries a byte-identical-while-dark test (A23). The rules-layer fence is dark by construction (absent doc = open) and inert until Console deploy.
