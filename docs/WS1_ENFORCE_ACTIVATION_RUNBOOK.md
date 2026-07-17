# WS1 Enforce — Activation Runbook

**Status:** authored at WS1 enforce Phase 2 (2026-07-17); the founder-gate sequence herein is **Phase 5 of the WS1 Enforce Build Spec V1.0** — nothing in this runbook is CC's to execute.
**Parents:** WS1 Enforce Build Spec V1.0 · the Phase 0 discovery (verdict CONTAINED) + Phase 0 anchor/census report · `WS1_PRE_ENFORCE_BACKLOG.md` · the `agents` allowlist publish playbook (Firestore hardening).

---

## 0. The two rules that govern this activation

### 0.1 THE ORDERING CONSTRAINT (founder-ratified, Phase 0 census §D.4)

> **client-reconcile → rules publish → flips.**

The reconciled client (Phase 2: `setRuleHardness` + `reforgeBundle` as thin endpoint clients; `createBundle` no longer writing `ruleHardness: {}`; `removeRuleFromBundle` no longer pruning) must be **merged AND deployed to production BEFORE the `bundles` allowlist is published** in the Firebase Console. A `hasOnly`-without-`ruleHardness` ruleset denies the OLD client's create/remove/set/reforge writes the instant it publishes — publishing before the new client is live breaks bundle creation and editing in production. The flips come only after both.

### 0.2 FLIP ORDER (Build Spec §0.3)

> **`RULE_COMPAT_MODE='enforce'` BEFORE `FORGE_HARDSOFT_AUTHORING_ENABLED=true` — never the reverse.**

Authoring-without-enforce opens the promote-to-hard doors ungated (the exact inversion of the co-ship rule). Enforce-without-authoring is safe: the guard is armed and only the create-as-hard door is user-reachable.

---

## 1. The gate sequence (in order, each step gated on the previous)

| # | Step | Owner | Gate to proceed |
|---|---|---|---|
| 1 | **Dark merge deployed** — the Phase-4 PR (silent-swallow fix, the two endpoints, client reconciliation, emulator matrix, this runbook) is merged and live on production Vercel | Founder merges | Vercel production deploy confirmed (pushed ≠ deployed) |
| 2 | **Cleanup live-run** (Build Spec Phase 3) — fresh `--dry-run`, founder review, then `--live --yes`; capture the report + `compatCleanupLog` | Founder-supervised | Zero agents carrying a hard `core_conflict`; see §3 pre-run checks |
| 3 | **Publish the `bundles` allowlist** — the `agents` playbook verbatim: drift check (Console vs repo), emulator matrix green locally, hand publish in the Firebase Console, low-traffic window, Denies graph + dev-console watch | Founder | §2 diff applied in Console; no unexpected Denies |
| 4 | **Prompt-parity sign-off** — founder reads the byte-parity evidence on the merged fenced hardness commit (`api/_utils/hardSoftOverride.parity.test.js` + the discovery Q2 verification) and records the go | Founder | Signed |
| 5 | **Flip `RULE_COMPAT_MODE='enforce'`** (one-line PR) → Vercel preview smoke per §4.1 | Founder | Smoke green |
| 6 | **Flip `FORGE_HARDSOFT_AUTHORING_ENABLED=true`** (one-line PR) → Vercel preview smoke per §4.2 | Founder | Smoke green |
| 7 | **Record**: enforce-live date + both flip SHAs in this file | Founder | — |

**Why the rules publish (step 3) precedes the flips (5–6):** the server endpoints must be the only `ruleHardness` path *before* the guard arms, so no client write can race the gate during the activation window.

---

## 2. The proposed `bundles` rules diff (hand-publish at step 3)

Replace the `bundles` subcollection's `allow create, update` clause (currently owner-only, `firestore.rules:190-191`) with:

```
        allow create: if request.auth != null
                    && get(/databases/$(database)/documents/agents/$(agentId)).data.ownerId == request.auth.uid
                    && request.resource.data.keys().hasOnly(['name', 'version', 'previousVersionId', 'status', 'ruleIds', 'ruleSnapshots', 'conflictCheckResult', 'createdAt', 'forgedAt', 'equippedAt', 'archivedAt', 'updatedAt', 'performanceData', 'entrySource', 'hiddenFromBundleList', 'dimensionHash', 'dimensionValues', 'dimensionSchemaVersion', 'compileConfidence', 'compileTransparency'])
                    && (!('status' in request.resource.data) || request.resource.data.status != 'equipped');
        allow update: if request.auth != null
                    && get(/databases/$(database)/documents/agents/$(agentId)).data.ownerId == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'version', 'previousVersionId', 'status', 'ruleIds', 'ruleSnapshots', 'conflictCheckResult', 'createdAt', 'forgedAt', 'equippedAt', 'archivedAt', 'updatedAt', 'performanceData', 'entrySource', 'hiddenFromBundleList', 'dimensionHash', 'dimensionValues', 'dimensionSchemaVersion', 'compileConfidence', 'compileTransparency'])
                    && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['status'])
                        || request.resource.data.status != 'equipped');
```

The `allow read` and `allow delete: if false` clauses are unchanged. What this encodes:
- **The 20-field allowlist** = the Phase-0 census's complete client-writable union (Forge service + Forge hook + the LevelStory dimensions compiler) **minus `ruleHardness`** — which is server-mintable only (`set-rule-hardness` / `reforge-bundle` endpoints, admin SDK).
- **The `status=='equipped'` value-deny** (founder-ordered, census §E.1): a client write may never SET the equipped value — equipping is the equip-bundle endpoint's transaction (`settingsRev` bump + conflict detection). The deny fires only when the write *touches* `status`, so merge-updates on an already-equipped doc (the dimensions persist-on-launch case) still pass, and `draft`/`forged`/`archived` transitions stay client-legal.

**Executable form:** `firestore.rules.emulator.test.js` ("bundles rule — PROPOSED field allowlist + equipped-value deny") loads this exact clause in-memory. Verified green **51/51** (agents + bundles suites) against the live emulator at Phase 2, 2026-07-17. Re-run locally before publishing:

```
npx firebase-tools emulators:exec --only firestore \
  --project demo-tradeseven-rules-test \
  "npx vitest run firestore.rules.emulator.test.js"
```

**After publishing:** update `firestore.rules` in-repo to match the Console (the repo file mirrors deployed state — the drift-check discipline), in the same PR as the flip or its own docs PR.

---

## 3. Cleanup live-run — pre-run checks (feeds gate step 2)

1. Fresh `--dry-run` at current data (Release 3 leans + new agents have moved data since the observe walk). Expected from the walk era: the guardian seed case (`trait-diversifier`'s un-zeroable `a-05` rocket mandate). Anything else is new — review before `--live`.
2. **Orphan-coverage check (raised at Phase 2; deferred fix backlogged):** the cleanup core mirrors the projection's reach — it evaluates overrides only for ruleIds **listed** on a bundle (`api/_utils/ruleCompatCleanup.js:67`). With the client-side prune retired (Phase 2), a hard override orphaned by a rule-removal survives cleanup and can resurrect via re-add under enforce (add-time writes only `ruleIds`, no gate). **Today this is moot — no authored overrides exist in production (the authoring door has never opened)** — so confirm the dry-run census shows zero `ruleHardness` entries at all. **This is a PRE-DOOR-HEAVY-USE fix:** the real close (server-side orphan prune) is filed in `docs/TEST_SUITE_BACKLOG.md` → "Deferred code fixes" and must land before the authoring door sees heavy use post-flip. If the dry-run ever shows a `ruleHardness` entry, do that fix (or the cleanup-orphan-sweep option) before `--live`.
3. `--live --yes` is Flash's command only (WS1 spec §7); reversible records land in `compatCleanupLog/{runId}`.

## 4. Flip smokes

### 4.1 `RULE_COMPAT_MODE='enforce'` (step 5)
- (a) Create-as-hard on a `core_conflict` hard-category template (e.g. degen agent + `risk-volatility-avoidance` from Discover "Add to Bundle") → **blocked** with the category-hard message ("…must-obey rule by category…").
- (b) A native/neutral hard-category rule (e.g. guardian + `alloc-sector-cap`) → **allowed**.
- (c) Normal soft-rule flows (browse/assemble/forge/equip) → unchanged.
- (d) The rescan + equip warn surfaces render under enforce (off-style badges in BundleBuildFlow).

### 4.2 `FORGE_HARDSOFT_AUTHORING_ENABLED=true` (step 6)
- (a) The promote-to-hard doors render (BundleBuildFlow Stage 3's SOFT/HARD control is interactive).
- (b) Promote a **native** rule to hard → succeeds, persists (`bundle.ruleHardness`), and the agent's next prompt carries it (spot-check the projection / CONSTRAINTS section).
- (c) Promote a **core_conflict** rule to hard → blocked at the door with the classification message (the endpoint's 409 copy).
- (d) **Network tab:** the hardness write goes through `POST /api/agent/set-rule-hardness` — never a direct Firestore doc write.

## 5. Rollback semantics (Build Spec §0.6 — record of behavior)

- **`RULE_COMPAT_MODE` enforce → observe is CLEAN.** The guard stops blocking; nothing persisted needs killing (unlike the integrity flag's directive epochs). Already-persisted hard rules **remain hard and remain honored** by the prompt path; only the gate on **new** promotions relaxes. There is no state to unwind.
- **`FORGE_HARDSOFT_AUTHORING_ENABLED` true → false** re-darkens the toggle (read-only category badge returns) and 404s the set-rule-hardness endpoint. Authored overrides at rest stay honored by projection/prompts (the parity contract) — flipping the UI off does not strip data.
- The `bundles` allowlist has no flag: rollback = republishing the prior ruleset from the Console (keep the pre-publish copy at hand during the watch window).

## 6. Record (fill at execution)

| Item | Value |
|---|---|
| Cleanup dry-run reviewed | _date / runId_ |
| Cleanup live-run | _date / runId_ |
| Bundles allowlist published | _date_ |
| Prompt-parity sign-off | _date_ |
| `RULE_COMPAT_MODE='enforce'` live | _date / SHA_ |
| `FORGE_HARDSOFT_AUTHORING_ENABLED=true` live | _date / SHA_ |
