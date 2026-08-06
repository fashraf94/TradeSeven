# Composition Build Spec — Phase 0 CLOSURE SHEET + V0.9 Amendment Addendum (V0.9.1)

**Date:** Aug 6, 2026 · **Branch:** `claude/composition-build-spec-v09-vps0hc` · **HEAD basis:** `681610e` · **Authority:** founder rulings relayed this session (Aug 6) on the three load-bearing closure inputs, resolving the six inputs of `docs/audits/20260806_COMPOSITION_BUILD_V09_PHASE0_DISCOVERY.md` §D. · **Governs:** amends Composition Build Spec V0.9 (Aug 5); where this document and V0.9 conflict, this document wins.

> **Status: this IS the closure sheet that test A39 gates PR 1 on.** It records the selected coexistence model, the exact artifact keys, the migration-overlay method, the gate-scope contract, the PR 4 sequence, and the rollback sequence — plus the base-metadata missing-arc finding surfaced by the founder's question, and the V0.9 amendment addendum folding the ~11 discovery AMENDs. **No build code is written until the founder signs §VII.** Still no production/registry/identity/test code exists at HEAD beyond this and the discovery doc.

---

## §0 · The founder's question, answered (base §5.6 metadata): **MISSING APPLY ARC, not a shape mismatch**

**Question:** the discovery says the corpus lacks the §5.6 base metadata Phases 3–4 author, but the 143/143 base-metadata program completed in July — was the output written into the corpus, or is the gate checking a different §5.6 shape?

**Answer (VERIFIED, this session): the metadata was AUTHORED but NEVER APPLIED into the corpus records. It is a missing "apply" arc, not a shape mismatch and not a composition-event problem.**

1. **The program authored all 143 rules' base metadata — as markdown only.** Batches 1–5 (`docs/PHASE3_METADATA_BATCH1..5_*.md`, accepted Jul 23) carry the entries; Batch 1's header even self-marks **"ACCEPTED — IN THE GATE COUNT (12/143), Jul 23"** (`PHASE3_METADATA_BATCH1_RISK_V1.md:4`) with the exact field names — e.g. `intendedMode: eligibility_constraint · copyClass: advisory · receiptTag: rsk_min_sectors` (`:20`).
2. **It was never written into `src/data/forgeKnowledgeBase.js`.** `git log -S "intendedMode"` and `-S "receiptTag"` on that file return **nothing across the entire history** — the tokens were never once added (not applied-then-reverted; never applied). Current count: **0**.
3. **The field names match the gate exactly — so it is NOT a shape mismatch.** The gate's `BASE_FIELDS = ['intendedMode','copyClass','receiptTag']` and it lifts them straight off each live template: `for (const t of templates) { BASE_FIELDS.filter(f => t[f] == null) }` (`activationGate.js:33,52-53`). The compiler's runtime path does the same — `METADATA_FIELDS` "lifted from a corpus template **when (Phase 3+) they exist**" (`compileOnSettingsChange.js:49-54`). Both read the corpus template and both correctly find the fields absent → `missingBaseMetadata: 143`.
4. **No applied-metadata module exists anywhere in code** — the only non-test file carrying an `intendedMode:'…'` shape is `compilerFixtures.js` (test fixtures).

**Which arc is missing:** the "transcribe Batches 1–5 into `FORGE_RULE_TEMPLATES`" step. It is a **separate, unshipped arc** — not part of this composition event, and **not fixed by the gate-scope narrowing in §II below.**

**Load-bearing interaction (new — needs your direction, see §VI):** `FORGE_RULE_TEMPLATES` is a **hashed registry input** — `getRegistryCorpus().forgeRuleTemplates` feeds `computeIdentityHash()` (`archetypeRegistry.js:132,157`; `ruleSupportStatus.js:9-24` states this explicitly). So **applying the base metadata is itself an identity-bumping event.** It therefore collides with the ledger's "one deliberate bump, no piecemeal edits to hashed inputs" discipline (D2) and must be either **folded into this event's cargo** or **sequenced as its own adjudicated bump** — a decision recorded in §VI, not presumed here.

---

## §I · Coexistence model — **CATALOG** *(resolves discovery input 1; test A33)*

**Ruling:** CATALOG. The shipped code (deferred-regeneration singleton) is the fallback; the immutable per-version snapshot extends to a catalog naturally.

**What it means / amends §§3,4,8:**
- **Artifact keys.** The committed snapshot stays `docs/registry-snapshots/archetype-registry-identity-v{N}.json`. The event mints **v2 alongside v1** (v1 is never rewritten). During the inactive window **both** files exist and are resolvable — this is exactly what a catalog holds and a singleton cannot (the live-module regeneration path can only ever emit the current version).
- **Read surface.** `getArchetypeDefinition(codeId)` takes no version arg today (`archetypeRegistry.js:77`, always stamps the live `ARCHETYPE_IDENTITY_VERSION`). PR 4 adds a **version-parameterized resolver** so every identity-sensitive read resolves the version the activation record points to. (Item 4 / A48: still no standalone selector — the version is read from the activation record, not a config value.)
- **CI-lock amendment (real subtlety, must be built right).** Today the lock recomputes `computeIdentityHash()` (live modules) and compares to the one current snapshot (`archetypeRegistry.test.js:102-110`). Under a catalog, only the **current** version can be validated by recomputation (live modules reflect only the current identity); the **prior** version's snapshot is validated **as stored** — its embedded `identityHash` must match its own stored `definitions/corpus`, immutable git content. The lock must validate the catalog as "current = recomputed; all prior = self-consistent + byte-immutable."

---

## §II · Gate-scope contract — **NARROW THE DENOMINATOR** *(resolves discovery input 2; test A21)*

**Ruling:** narrow the gate; **do NOT author the extra 227 cells.** The 22 non-offerable rules can never be equipped (authoring cells for them contradicts the C-20 Rule Honesty Gate), and the Diversifier column is reserved by design — it enters with `SECTOR_CAP_MODE='enforce'` as its own adjudicated event.

**The tested scope contract (what PR-work implements in `activationGate.js`, gated on §VII):**
- **New denominator = offerable rules × included archetypes = 95 × 5 = 475** (was `equippable(117) × VALID_ARCHETYPES(6) = 702`).
  - Rule axis: filter `equippable` by `ruleSupportStatus` **`supported`** (drops the 22: 20 `hidden_absent_substrate` + i-04 `hidden_unwired` + `risk-single-stock-limit` `deprecated`), on top of the existing `modes ∈ {both,clash}` filter.
  - Archetype axis: exclude the **reserved** archetype (diversifier) from the launch set.
- **`deferred` and `reserved` become EXPLICIT COUNTED categories** in the gate result — never folded into "missing" (B1: deferred ≠ missing):
  - `reserved` = diversifier column (95) + the 22 non-offerable rules across archetypes (110 + 22) = **227** cells — the exact 702−475 gap, now *counted as reserved, not missing*.
  - `deferred` = the 11 within-scope deferred cells (C7's `464 authored + 11 deferred = 475`).
- **`passes` on the compat axis** iff every in-scope (offerable × included) coordinate resolves to an explicit non-fallthrough verdict **or** an explicit `deferred` verdict, with `reserved`/non-offerable excluded from the missing tally.
- **The A21 test** asserts: new denominator = 475; the reconciliation identity `702 = 475 + 227(reserved) ` holds; `deferred`/`reserved` are counted, not missing; and the pre-change denominator (702) is recorded in the reconciliation table so the change is auditable.

**Honest-expectations rider (do not skip):** narrowing the compat axis does **NOT** by itself green the gate. `checkActivationGate().passes` also requires `missingBaseMetadata === 0`, which is the **separate missing-apply arc of §0**. Gate-green needs **both** (i) this event's compat matrix on the 475 denominator **and** (ii) the base-metadata apply arc — plus the deterministic-tier fields for any rule carrying a `guardrailBinding`. **No gate outcome is promised by this event.**

---

## §III · Migration-overlay method — **METHOD B STANDS** *(resolves discovery input 3; tests A36,A42,A47,A49)*

**Ruling:** Method B (candidate overlay, promote-by-pointer). The versioned-read plumbing was always to-be-built, not assumed — its absence is not a reason to fall back to Method A.

**Sequencing + the vacuity path:**
- **Dry-run scan runs EARLY in PR 2**, against the item-10 config-persistence census (hosts A–I of the discovery). It reports the exact set of records the migration would clamp/unequip.
- **Expected population is near zero:** per the founder's estimate, **4 narrowed bounds** (the `narrowedParams` clamps) + **10 C7 bans** (the core_conflict cells that unequip) against a **mostly-CPU pre-launch fleet** (CPU/house agents carry `activeRules:[]` and no rules subcollection — a migration no-op, `tournamentCpu.js:83`). PR 2's scan confirms the real number.
- **If the scan returns zero:** the `resolve(base, migrationOverlay, activeEpochOverrides)` resolver is **still built** (the acceptance battery A42/A47/A49 must exercise it), but the migration write is **vacuous** — the overlay is empty and activation promotes an empty overlay.
- **If nonzero AND the overlay plumbing proves prohibitive:** the spec's **STOP-and-amend fires** (R5-M3) — a new reviewed read-path census + runbook + acceptance battery before any pivot. The closure sheet does **not** authorize Method A.
- **Overlay = the mutable stack's middle layer.** Effective config = `base → immutable migration overlay → mutable active-epoch overrides`, highest-wins, through the one resolver (R5-M1). Post-activation valid saves write the **active-epoch** layer without touching `overlayContentHash` (A47); rollback removes the abandoned epoch's overrides from resolution (retained, not deleted; A49).

---

## §IV · Activation record, write-epoch fence, and the B5 read-edge *(resolves discovery inputs 4 & 5)*

**Activation record (one authoritative record; the sole authority — no standalone selector, A48).** Four fields, verbatim from V0.9 §3: `{activeIdentityVersion, boundaryStateVersion, candidateStateId, overlayContentHash}`. `candidateStateId` names the migration overlay `--apply` produced; `overlayContentHash` is that overlay's content hash; the candidate v2 manifest binds `identityHash(v2) + candidateStateId + overlayContentHash` by construction. Every enforcement boundary reads this one record per request and fails closed unless its local code supports the complete epoch (A34). **No such record exists today** — the activated identity is read live (`ARCHETYPE_IDENTITY_VERSION`); it is net-new.

**Write-epoch fence boundary (item 14 — the census resolves what the epoch can and cannot close):**
- **Fenced at commit by the epoch gate:** the two server chokepoints — `txUpdateAgentSettings` (`agentSettingsTx.js:18`) and `writeCompiledBuildsInTx` (`compileOnSettingsChange.js:157/235`) — plus the `decide.js` deploy `activeRules` write. This covers all 10 HTTP endpoints + the deploy path (the server-owned identity surface).
- **Cannot be closed at a server chokepoint — handled out-of-band during the §8 window:** (a) the **client-SDK authoring writers** (`createAgent`; `forgeService` rule/bundle authoring straight to Firestore, gated only by `firestore.rules`) reach the compiled-identity surface only via a *later* server equip/deploy the epoch **does** gate, so they need not be blocked at authoring-write — but the §6/§8 freeze on new builds/births/enforced saves must hold; (b) the **background per-doc loops** (`seedArchetypeTraitsDeterministic`, `softDeleteReplacedTraitRuleDocs`, `trainingClone` provisioning, `rule-compat-cleanup --live`, `mastery-preflip-normalize --apply`, `ws1-observe-walk`) are **paused/enumerated out-of-band** for the window (test A46 — each must be named in the epoch census); (c) `set-rule-hardness` writes only a draft bundle's `ruleHardness` with no agent write/settingsRev/compile — it reaches identity only via a later equip/deploy the epoch gates. **Every censused writer validates the epoch at commit and old-epoch commits after the watermark are rejected (A41).**

**B5 assembler read-edge (item 8 — ratified as PR 3 fenced work).** Today the assemblers read `battle.agentContext`, **not** the CompiledBuild/manifest (the manifest has zero readers; `shadowAssemblyCapture.manifestDerivedBattleView` projects only `frozenLayers` and drops all verdict/tension/advisory data). Delivering advisory/narrowedParams therefore requires building a **new read edge**, ratified here as PR 3 scope: (a) add `advisory`/`narrowedParams`/`displayReason` onto `compatVerdicts` in `compileBuild.js` (~:290); (b) carry them through `resolvedAgentManifest.js` **and project them onto `agentContext`** in `shadowAssemblyCapture.js:126` (decorating the projected `activeRules` entries); (c) new read sites in both assembler forge-rule loops (`agentEvalPromptAssembly.js:551`, `agentPromptAssembly.js:96`). This is **not a STOP** (the contract is extensible; tension/guardrail passthrough is the precedent) but it **is** more than "add a field," so §5's B5 text is corrected to: *"the assembler consumes `agentContext`, which shadow assembly projects from the manifest — the composition event builds that projection edge."*

---

## §V · The PR 4 runbook and rollback, with §I–§IV folded in *(V0.9 §8, made concrete)*

**PR 4 sequence (catalog + Method B applied):**
0. **Drain gate** — no active battle's birth identity differs from the candidate. Predicate uses the birth anchor present on every battle now (`MANIFEST_WRITE_ENABLED=true`): `agentBattles/{id}.resolvedAgentManifest.versionStamps.identityVersionAtLock < activeIdentityVersion` **or** `identityHashAtLock != registryIdentityHash(v2)` (the literal birth-CompiledBuild-hash form is not computable until `COMPILER_ENABLED` flips; A26/A35 use this identity-stamp form). Battles run ≤ days pre-launch — drain by waiting.
1. Deploy PR 4 **inactive** (v2 catalog entry committed, resolver present, activation record still points at v1). **Close the write epoch** (§IV boundary): every censused writer validates the epoch at commit; background loops paused; watermark taken after registered writers drain; old-epoch commits rejected (A41).
2. Fresh scan → `--apply` writes the migration overlay into the **candidate namespace keyed to v2** (`candidateStateId`), never touching v1/base records (A32/A36/A38).
3. Zero-residual verification scan (via the one resolver — scanner observes the overlay; old-identity reads observe base; A42).
3b–5. Pre-activation pipeline, **candidate-scoped**, in the order Phase 0's dataflow proves the compiler supports (A37): enable candidate manifest writing → **candidate-compile step** → verify candidate manifests → enable candidate shadow assembly → verify candidate shadow.
6. Stale-artifact sweep over the item-10 census locations (A15; every location rejected when stale).
7. **Write the activation record** — one atomic epoch, all four fields; compare `candidateStateId + overlayContentHash` against the activated v2 candidate manifest **inside the same transaction** (mismatch aborts; A43). `COMPILER_ENABLED` + per-boundary states ride the epoch, not independent flags.
8. Post-flip runbook (V0.9 §10); unfreeze.
9. PR 5 docs-only closeout — `--apply` report + verification outputs to `docs/audits/`.

**Rollback (the same mechanism backwards; A29/A45/A49):** atomically repoint the activation record to the prior `{activeIdentityVersion=1, boundaryStateVersion, candidateStateId=prior}` pair. The catalog holds v1 immutably — **nothing is "restored"**; the abandoned epoch's active-epoch overrides are removed from resolution (retained, not deleted), and any re-activation mints a **fresh** epoch + `candidateStateId` so stale overrides never resurrect. No bulk copy/restore.

---

## §VI · Base-metadata apply arc — **RULING (B): SEQUENCE SEPARATELY** *(founder, Aug 6)*

**The base-metadata apply arc is itself an identity event (see §0)** — applying Batches 1–5 into `FORGE_RULE_TEMPLATES` changes `computeIdentityHash()` (templates are hashed).

**FOUNDER RULING (B): sequence it as its own adjudicated identity event, AFTER this one.** Reasons for the record: (1) one-purpose-per-event; (2) folding it doubles the review surface on the highest-blast-radius event; (3) Batch 1's two unresolved binding candidates (risk-exit-atr-stop stopLoss/ATR-unit; r-06 maxSectorWeight count→pct) are **adjudication, not build**. It gets its own bump, closure sheet, and adversarial round.

**Consequence recorded per founder direction: gate-green requires BOTH events (this compat-matrix event AND the base-metadata apply event) — and THIS event does not claim gate-green.** The §II narrowing operationalizes the compat axis only; the `missingBaseMetadata` axis is cleared solely by the separately-sequenced apply arc, filed as a backlog item (`docs/LAUNCH_READINESS_WATCH_LEDGER.md` X6). **Lesson line (recorded):** *an accepted authoring program is not applied until the code that consumes it reads it — verify against the consumer, not the document.*

---

## §VII · V0.9 Amendment Addendum — the discovery AMENDs folded (spec corrections of record)

Each row corrects a V0.9 assumption the shipped code contradicts. These govern the build; where V0.9 conflicts, these win.

| # | V0.9 said | Correction (governing) | Anchor |
|---|-----------|------------------------|--------|
| A1 | `ARCHETYPE_COMPATIBILITY` | Live export is **`ARCHETYPE_RULE_COMPATIBILITY`**; helper is `getRuleCompatInfo`. | `archetypeRuleCompatibility.js:246,503` |
| A2 | `compatHash` "folds into" identity | **No `compatHash` exists.** The compat map is *already* a hashed input of `identityHash` (via `getArchetypeDefinition().compat`); replacing it trips the lock by construction. Delete the standalone-compatHash language. | `archetypeRegistry.js:120,152,157` |
| A3 | tension state is being "added" (schema extension) | The **compiler already understands `tension`** (+`treatment`/`advisoryDowngrade`). Adding tension is a **source/adapter** change, not compiler work. The adapter maps `advisory→treatment`, `displayReason→tensionReason`; `narrowedParams/rulingIds/notes` have no compiler consumer and need a stated mapping. | `compileBuild.js:196,226`; `archetypeBuildSchemas.js:42` |
| A4 | "deferred ⇒ explicit complete-but-non-offerable **verdict**" (implied to exist) | **No `deferred` verdict token exists** — a `deferred` cell hits `unknown_compat_state`. A distinct deferred/non-offerable verdict is **net-new compiler work** (today non-offerability = `core_conflict` + `ruleModeGate` blocks only). | `compileBuild.js:196,214,239` |
| A5 | "41 P2 fixtures" | **41 executed test cases** in `compileBuild.test.js` (not fixtures; `compilerFixtures.js` has 5 builders). | `compileBuild.test.js`; `20260723_ARCHETYPE_P2_14a_PHASE_REPORT.md:16` |
| A6 | narrowedParams via `guardrailBinding` | `valueParamKey` is scalar value-**extraction**, cannot carry a domain. `narrowedParams` is **net-new** (0 code refs) and needs **both** the compile path and a **net-new save gate** (in-tx, archetype-keyed) — with **no rule-authoring server chokepoint** today (client-SDK `createRule` authors params). | `compileBuild.js:264`; `update-agent-settings.js:152`; `ruleDocFields.js:18` |
| A7 | §1 "set-like arrays (rulingIds, allow, notes) sorted" | **`canonicalContentHash` preserves array order and sorts no arrays.** Authored cells must **pre-sort** set-like arrays, or identical membership in different order changes `identityHash`. | `canonicalHash.js:11,23` |
| A8 | "cross-process determinism test required" | **None exists** — only same-process assertions. The test is net-new (build it). | `archetypePhase2Constants.test.js:70-79` |
| A9 | presentationHash (cargo item 7) | **Unimplemented** at HEAD (C-3, zero refs) — genuinely net-new. | `ruleSupportStatus.js:25-29` |
| A10 | "assemblers consume the activated CompiledBuild" (B5) | **They consume `agentContext`, not the compiled artifact** (manifest has zero readers). The event **builds the read edge** (§IV). B5-as-import-ban is nonetheless already true (Invariant R); PR 2's forbidden-read rule must also cover `ruleCompatClassify` (regex gap). | `agentEvalPromptAssembly.js:552`; `shadowAssemblyCapture.js:126`; `ruleCompatInvariantR.test.js:145` |
| A11 | drain predicate = "candidate CompiledBuild hash ≠ birth CompiledBuild hash" | Not computable at HEAD (`compiledBuildContentHashAtLock` only stamped when `COMPILER_ENABLED`). Use the **identity-version/hash birth stamp** (§V step 0). | `resolvedAgentManifest.js:152,159` |
| A12 | stale-rejection "keyed on the CompiledBuild hash everywhere" | Shipped predicate keys on **`sourceRevisionVector` components** (incl. `identityHash`), not `contentHash`; it **recompiles**, never rejects; it is **dormant** (`COMPILER_ENABLED=false`); **no activation record exists**. The reject-behavior + record are net-new, homed in `diffSourceRevisionVector`. | `deployBuildValidation.js:65,101` |
| A13 | "four family re-filings" | **Three** (tv-15, i-09, i-10); **a-07 was refuted** — spec/ledger overcount by one. (i-10 itself defers under R-230.) | `REVERSE_DIRECTION_MAP_AUDIT_2026-07-29.md:871,702` |

*(Related precision fixes carried from the discovery: the import-boundary baseline lists the assembler for `archetypeScoring`, not the compat map; the reconciliation "350" vs "352 authored/350 missing" mislabel; and the separate-tasking defect register in the discovery doc §F.)*

---

## §VIII · Founder sign-off — **COMPLETE (Aug 6)** (test A39 cleared)

- [x] **Coexistence = CATALOG** (§I) — approved
- [x] **Gate scope = NARROW to 95×5, deferred/reserved counted** (§II) — approved
- [x] **Migration = Method B, dry-run early in PR 2, STOP-and-amend if nonzero+prohibitive** (§III) — approved
- [x] **Epoch fence boundary + B5 read-edge as PR 3 work** (§IV) — approved
- [x] **PR 4 / rollback sequence** (§V) — approved
- [x] **Base-metadata apply — ruling: (B) SEQUENCE SEPARATELY** (§VI) — filed as watch-ledger X6
- [x] **V0.9.1 amendment addendum** (§VII table) — approved

**Test A39 CLEARED — PR 1 is authorized:** candidate registry + `rulingIndex` (minimal per N2) + adapter + candidate-registry completeness CI + independently-hashed §9 manifest + determinism tests — touching **no** production identity chain, snapshot, or lock (A22). Standing build rules (founder, Aug 6): push at STOP, **no auto-merge** (founder merges), and `/code-review` at high effort before handback given PR 1 touches registry surfaces.
