# MANIFEST_WRITE_ENABLED flip — Vercel Preview Smoke Checklist

**Scope:** the Archetype Architecture Phase 2 **manifest-write** activation —
flipping `MANIFEST_WRITE_ENABLED` `false → true`
(`src/config/featureFlags.js`). This is the deliberate founder flag-flip PR the
Phase 2 build brief always reserved for a separate change ("no flag-flip PRs in
this phase"); it is **first** in the Phase 2 flip sequence — **manifest-write
first, shadow-assembly second** (`docs/20260723_ARCHETYPE_P2_FINAL_PHASE_REPORT.md`
§Standing notes: shadow capture is manifest-anchored and skips pre-manifest
battles, so the manifest must be flowing before `SHADOW_ASSEMBLY_ENABLED` is
worth turning on).

Founder-run on a **Vercel preview** deployment before the prod merge
(BUILD_RULES §2: preview is the smoke-test surface; production exists only
after the founder confirms merge + deploy).

> The automated battery proves the same invariants against the real modules:
> `api/_utils/resolvedAgentManifest.test.js` (the §4.1 builder contract —
> validator pass, one-kernel frozen values, three-part guardrails, the §4.3
> `…AtLock` stamps, manifestHash determinism, and the flag now `true`);
> `api/_utils/agentBattleService.test.js` (the **integration** — `createAgentBattle`
> stamps `resolvedAgentManifest` adjacent to `agentContext`, plus the flag-off
> determinism/byte-identity invariant with the manifest excluded like every
> other wall-clock block); and `api/_utils/p4Equivalence.battery.test.js` (the
> **fence byte-identity** photograph — the committed tiered-doc snapshot stays
> byte-identical with the additive manifest stripped, proving the fence entry
> introduced no drift into the doc body a rollback must restore). This checklist
> confirms them against a live preview deploy.

## 0. Preconditions

- **Flag ON in preview (this branch's code).** `MANIFEST_WRITE_ENABLED` is a
  code constant (`src/config/featureFlags.js:978`), now `true` on this branch.
  Deploy a **preview** build of this branch. The only production reader of the
  flag is the fenced `createAgentBattle` conditional spread
  (`api/_utils/agentBattleService.js:219`), so the manifest lights up exactly
  where a battle doc is created; nothing else changes.
- **The other two Phase 2 flags stay FALSE in this PR.** `COMPILER_ENABLED` and
  `SHADOW_ASSEMBLY_ENABLED` remain `false` — this PR flips **only**
  manifest-write. Consequences to expect below (honest `user_only_no_compiled_build`
  guardrails; no shadow diffs yet) follow directly from that.
- **agentContext remains the runtime authority.** Zero readers migrate in Phase 2
  (brief P2.5). The manifest is **written, never read** — no agent decision,
  score, prompt, or settlement changes because of this flip.
- **Not retroactive.** Battles created *before* this deploy carry no manifest;
  the block appears only on battles created *after* the flag is on. The manifest
  is born in the single creation `.add` and no updater exists anywhere —
  create-only-after-start holds by construction (R1-4).
- **Crons don't run on preview (BUILD_RULES §6).** Battle creation on the
  **user agent deploy** path (`api/agent/decide.js` → `createAgentBattle`) is
  user-driven and fully preview-smokable. The **tournament** creation path
  (`api/_utils/tournamentOrchestrator.js` Monday prescribed deploy →
  `createAgentBattle`) rides a cron; verify it on the first flag-on **production**
  Monday tick, or drive the orchestrator handler by hand on preview with the
  `CRON_SECRET` / `x-vercel-cron` pattern.

## 1. The core expectation — a manifest appears at battle creation

Deploy an agent on preview (tiered `baggerbomb_agent` deploy through the normal
UI). Open the new `agentBattles/{battleId}` doc in Firestore and confirm:

- [ ] A new **`resolvedAgentManifest`** map exists on the doc, a sibling of
      `agentContext` (not nested inside it).
- [ ] `resolvedAgentManifest.manifestId` is `"{agentId}_{gameMode}_{createdAt}"`
      and `resolvedAgentManifest.createdAt` equals the battle's creation instant.
- [ ] `resolvedAgentManifest.manifestHash` is a non-empty content hash.
- [ ] `freezePolicyVersion` is stamped (birth freeze policy — R1-2).
- [ ] `frozenLayers` carries `activeRules`, `equippedBundleIds`, `standingLeans`,
      `standingLeansInvalidated`, `dials`, `deployedGuardrails`, and
      `equippedWatchlist` (with a `snapshotAt` when a watchlist is equipped,
      else `null`). These frozen customization values come from the **same**
      `buildCustomizationSnapshot` kernel as `agentContext` — spot-check that
      `frozenLayers.standingLeans` / `dials` **match `agentContext`** (one
      source, §9; they cannot disagree by construction).
- [ ] `valuesAtLock` shows `archetype`, `agentName`, `strategyPreset: "balanced"`,
      `riskTolerance`, and `settingsRev` — the lock-time values.
- [ ] `versionStamps` carries the full `…AtLock` set, including `gameModeAtLock`
      (the battle's mode), `gameModePolicyHashAtLock`, and the calibration /
      knob / dial-band / rule-library / identity / guardrail-set / prompt-spec /
      game-mode-policy versions, plus a 64-hex `identityHashAtLock`.

## 2. Compiler-off honesty (because `COMPILER_ENABLED` is still false)

With no CompiledBuild in play, the manifest must record that truthfully — not
invent compiled provenance:

- [ ] `resolvedAgentManifest.guardrails.mergeSource` is
      **`"user_only_no_compiled_build"`**.
- [ ] `guardrails.compiledRuleGuardrails` is `[]`; `guardrails.effectiveGuardrails`
      is the user layer verbatim (`governingSource: "user"`), and
      `guardrails.userGuardrails` is a **copy** of the deployed guardrails (the
      agent's source array is never mutated — R1-10).
- [ ] `versionStamps.compiledBuildIdAtLock` is **absent** (no compiled build to
      cite).
- [ ] `renderedTensionPairs` is `[]` (tension cells are Phase 3 authoring).

## 3. Everything else is byte-identical (agentContext is still authority)

- [ ] `agentContext` and its subtrees are unchanged from a pre-flip battle
      (same `standingLeans`, `dials`, `settingsRev`, `equippedWatchlist`,
      `deployedGuardrails`).
- [ ] `scoring`, `portfolio`, `timing`, `status`, `duration`, `executionMode`,
      and all pre-existing fields are unchanged — the manifest is purely
      **additive**.
- [ ] The battle plays identically: agent decisions, swaps, scores, and the
      settlement are unaffected (nothing reads the manifest in Phase 2).

## 4. Sequencing + rollback

- [ ] **Shadow assembly stays dark.** `SHADOW_ASSEMBLY_ENABLED` is still `false`,
      so **no** `agentBattles/{id}/shadowDiffs/{tickId}` docs, gate aggregates,
      or settlement records appear from this PR. That is the correct
      **manifest-write-first** state: a shadow corpus only becomes worth
      accumulating once battles created after this flip carry a manifest for the
      capture to anchor on. The shadow-assembly flip is a **separate, later** PR.
- [ ] **Rollback is clean.** Flipping `MANIFEST_WRITE_ENABLED` back to `false`
      returns new battle docs to byte-identical-to-today (no `resolvedAgentManifest`
      field at all). This rollback guarantee is what the P4 fence battery
      (manifest stripped from the photograph) and the `agentBattleService`
      off-state determinism test lock in CI.

## Notes

- Fenced files **called, not edited** by this PR: `createAgentBattle`
  (`api/_utils/agentBattleService.js`) reads the flag through its existing P2.5
  (§7-signed) conditional spread; the spread itself is unchanged. This flip
  edits only the flag constant and test-side expectations — **no fence edit**,
  so no §7 sign-off is required.
- Pre-existing, out of scope (BUILD_RULES §3): the `archetypeRegistry` import
  ratchet failure and the 44 `research/level-study` fixture-missing test files
  fail on the base branch independently of this flip; they are separate tasking.
