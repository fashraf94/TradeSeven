# Composition activation — outstanding debt

Everything the run left open, in one place, so none of it survives only as prose inside a 700-line runbook. Ordered by severity. Every item is sourced to the step that found it.

---

## 1. BLOCKING — the ACTION_COPY gate

> **`COMPOSITION_MIGRATION_FEED_ENABLED` MUST NOT FLIP until the headline + param-label substitution ships.** This is a gate, not a preference. (Founder ruling, 2026-08-20, at 8A.)

**The defect.** The identityMigration feed copy names **raw rule ids** (`tv-10`, `mb-03`, `tech-rsi-oversold`) and **raw param names** (`fund_score`, `macdDirection`). Founder's standard: *"A user reading 'fund_score moved' learns as little as from 'tv-10'."*

**Why deferral was safe.** The copy is currently **unreachable** — not merely flag-gated. `projectIdentityMigrationFeed` returns `[]` with the flag off, **and** a grep across `api/` + `src/` finds **zero call sites** for it or for `feedEntries` outside the module. Nothing renders it.

**The fix** is a one-line change at `ACTION_COPY` in `api/_utils/identityMigrationFeed.js` — the builders receive `{ruleId, param}` and must resolve display strings before formatting. Precedent already in the tree: `ForgeScreen.jsx:265` — `otherTemplate?.headline || otherRuleId`.

**The mapping — recorded so PR 5's implementer does not re-derive it.** Rule names from `FORGE_RULE_TEMPLATES[].headline` (the user-facing name on every Forge surface: `ForgeRuleCard.jsx:83`, `RuleDetailSheet.jsx:183`, `CategoryAccordion.jsx:61`, `DiscoverTab.jsx:116`, `CollectionDetailSheet.jsx:234`, `StarterKit.jsx:356`). All 143 templates carry one.

| rule id | display name |
|---|---|
| `tv-10` | Earnings + Technical Confluence |
| `mb-01` | Give your pick time to work |
| `mb-11` | Lean in for the final push |
| `tv-02` | MACD Histogram Acceleration |
| `tech-macd-bullish` | Ride momentum shifts |
| `mb-03` | Replace dead money |
| `tech-rsi-oversold` | Buy oversold stocks |
| `t-11` | Follow institutional accumulation |

Param labels from `forgeTemplates[].params[<name>].label` (rendered by `ParamPicker.jsx:16`, `ParamSlider.jsx:24`, `CollectionDetailSheet.jsx:73`):

| rule id | param | label |
|---|---|---|
| `tv-10` | `fund_score` | Min fundamental score |
| `mb-01` | `minutes` | Minimum hold time |
| `mb-11` | `pct` | Hurdle reduction |
| `tv-02` | `action` | On deceleration |
| `tech-macd-bullish` | `macdDirection` | MACD momentum signal |
| `tech-macd-bullish` | `rsiFloor` | Minimum RSI for momentum |

`"your archetype"` **stands** — founder ruling: accurate, and legible to the one real owner in the population.

---

## 2. Correctness — the `assertWriteEpochOpen` absent-doc asymmetry

`assertWriteEpochOpen` rejects only on a doc that **exists** and is not open (`if (snap.exists && data.state !== 'open')`), returning `null` on an **absent** doc. Its transactional sibling `validateWriteEpochInTx` has the B1 arm that fails closed once a record exists (`absent_epoch_doc_post_activation`); this one does not.

**Post-activation consequence:** a missing epoch doc would let this helper's callers through — background loops and the one post-commit rules writer, `archetypeSeeding.js:142` — while every transactional writer correctly fails closed.

Found by the 2026-08-16 step-1.1 review, re-confirmed by inspection at 1.5, and satisfied only situationally at 1.9 (the doc existed and was closed). **Wants a fix or an explicit accepted-risk ruling.**

---

## 3. Four runbook wording/mechanism gaps

Each is a case where the runbook named a mechanism that does not exist as described. All four were found by attempting the step, not by reading it.

- **(a) Step 1.7 — the deployed-lambda snapshot smoke.** Names an "internal-caller probe of the version-parameterized resolver"; **no such deployed path exists** (all 189 endpoints checked — no endpoint surfaces `identityHash`; only `listArchetypeIds` is imported from the registry, by two mandate endpoints). Its description is also wrong: `getArchetypeDefinition` reads a bundled snapshot **only for versions strictly below the CODE constant** `ARCHETYPE_IDENTITY_VERSION`, so "v2 via the bundled snapshot / v3 via the catalog" describes neither. Substituted with B1 (local `vercel build` — `filePathMap` carries all three snapshots into **187/187** function bundles) + B2 (v1 resolved through the real path to its catalog lock, with non-vacuity and fail-loud controls).
- **(b) Step 2 — the FINAL-DRYRUN command.** The literal `migration-scan.js` dry-run **cannot run against a closed fleet**: the epoch guard fires per-agent inside the scan loop regardless of `--apply`, so it exits 1 with `EpochClosedError: epoch_closed` at `migration-scan.js:92`. **Command of record: `--during-close`** (read-only without `--apply --yes`; `:138 if (!APPLY) return;` precedes every write).
- **(c) `EXTERNAL_ADMIN_WRITE_PATHS.md` E3.** Claims the admin CLI scripts "DO carry the in-code guard … the guard is the backstop, not the plan." That belt is **not armed until 1.9's close**, because `assertWriteEpochOpen` fail-opens on an absent doc and no epoch doc existed until 1.6. **Reword** to state the backstop arms only from the close.
- **(d) Step 5 — the candidate pipeline.** The five named stages have **no entry points**: no command for candidate-compile, verify-manifests or verify-shadow; and both "enable" flags (`MANIFEST_WRITE_ENABLED`, `SHADOW_ASSEMBLY_ENABLED`) are **already `true` and not candidate-scoped**. Every productive stage also writes **outside** the candidate namespace (`agents/*/compiledBuilds`, battle docs, `shadowDiffs`, `battleSettlements`).

---

## 4. Sweep scope — `compiledBuilds` is a subcollection

`compiledBuilds` lives at `agents/{id}/compiledBuilds/{mode}` (`compileOnSettingsChange.js:420`), **not** as a top-level collection. The 1.11 watermark sweep and the step-3 base-untouched diff read it top-level only and were correct **solely because the collection is empty fleet-wide** — a weaker guarantee than those rows implied.

Both sweep scripts were corrected mid-run, before step 6. **Any future sweep must read it as a collection group.**

---

## 5. WITHDRAWN — not owed, recorded so it is not resurrected

The step-1.7 "C" check (*resolve v2 as a prior version through the deployed path*) is **NOT DELIVERABLE BY THIS EVENT** and was **withdrawn, not deferred**. The resolver keys off `ARCHETYPE_IDENTITY_VERSION` — the code constant, still 2 — not the activation record, so **no post-flip state turns v2 into a file read**. Verified at 8A: `v2ResolutionIdenticalToLiveInCode: true`, `readFromBundledSnapshotFile: false`.

F7's `includeFiles` guarantee therefore rests on the **step-5 B1 configuration evidence**, stated as such. The check attaches to the **future identity-constant bump**.

> Founder: *"carrying an undeliverable item forward is how it becomes assumed satisfied."*

---

## 6. 8B probes not executed

| Probe | Status and reason |
|---|---|
| 1 — probe birth | **NOT PERFORMABLE.** Agent creation happens only at profile creation in this product; there is no birth act for an existing account. Creation is also a client-SDK write (`firestore.rules:224` create allowlist) with **zero** server-side path in `api/`. An Admin-SDK write would bypass the probe gate and the BL2 provenance check. |
| 2, 3, 7 — deploy / battle+FC-1 / M7 live | **NOT EXECUTED.** The internal-caller door needs `CRON_SECRET`; it is present but **empty** in `.env.vercel.production` (a scrubbed export). **The live M7 `usage.input_tokens` measurement remains owed.** |
| 4, 5 — `core_conflict` / `deferred` absent | **NOT EXECUTABLE FROM THE CLIENT.** The WS1 guard pre-empts the write (`BundleBuildFlow.jsx:143-145`, `RULE_COMPAT_MODE='enforce'`), and past it `COMPOSITION_ENFORCEMENT_MODE='off'` means the composition boundary does not reject at the endpoint. A WS1 rejection must **never** be recorded as a composition one. Compile-time behaviour *is* proven at 8A by pure resolution with a `native` control. |
| 6 — out-of-domain 409 | **NOT EXECUTED** — `tv-10` not locatable in the UI. |

---

## 7. NEW, from the 8B window — the BL2 third path

`change-archetype.js:259` applies `birthProvenanceStamp(seedPin)` on **every reseed**, restamping `identityVersionAtBirth` / `activationGenerationAtBirth` on an agent of any age. The rollback protocol documents two paths (a fresh birth stamps; a clone re-sync preserves) — **change-archetype is a third**, and it restamps long-lived agents.

**Observed:** `agents/XtuHDmqXgu9zGDIEtxui`, created 2026-03-28, now carries `identityVersionAtBirth: 3` / `activationGenerationAtBirth: 2`.

**Consequence:** the rollback reconciliation query (`activationGenerationAtBirth >= <rolled-from generation>`) matches it. The mechanism is still correct — its born-with layer really is v3 content — but the **population** is no longer empty. Wants a documented ruling on whether a re-archetype should stamp birth or a separate reseed-provenance field.

---

## 8. NEW, from the 8B window — orphaned trait-rule accumulation

The outgoing-trait cleanup after a reseed is **best-effort and non-fatal** by design (`archetypeSeeding.js`, the post-commit hygiene block). Superseded trait rule docs remain with `deleted: null`. They do not project (`projectActiveRules` dedupes, newest `createdAt` wins), but they are live documents.

**Observed:** `XtuHDmqXgu9zGDIEtxui` holds **192 rule docs / 103 trait-hosted / 14 distinct traitIds** after two archetype changes — far more than any born-with set. Wants a census + sweep policy.

---

## 9. UI — the off-style toast overflows

The WS1 off-style block toast overflows the viewport and truncates ("Off-style for your Specula…"). Non-blocking, PR 5 or post-launch. Note the copy is built from `getArchetypeDisplayName`, so the longest names — "Fundamental Investor", "Capital Preserver" — truncate harder than "Speculator" did.
