# Build report — Pilot P1b: Deploy Carriage (an idea rides into battle)

**Prompt:** "Build Prompt: Pilot P1b, Deploy Carriage (an idea rides into battle)", Fable, 8 October 2026, with founder decisions B1–B6. **Session:** Claude Code, 9 October 2026, in its own worktree (`.claude/worktrees/advisor-fable-7bc15e`; the shared checkout was not used). **Branch:** `claude/pilot-p1b-deploy-carriage`, cut from `origin/main` at **`4b28cd84`** after `git fetch origin main` ("Merge pull request #946"). `docs/audits/20261007_BUILD_PILOT_P2_RESEARCH_RECORDS.md` is on `origin/main` → no STOP. **Fence entry:** the founder's sanctioned entry for exactly `api/agent/decide.js` and `api/_utils/agentBattleService.js` (`createAgentBattle`); no other fenced file is edited. **The fenced diff is in §1, in full, for your sign-off before merge.**

---

## Executive verdict

| Question | Answer |
|---|---|
| What does a player get (once the flag is flipped)? | Deploy an agent whose equipped list has a **ready** idea, and the battle carries a frozen copy of it. The idea becomes **active**: its clock starts and its review is booked in the same moment the battle is created. When the time-frame passes, or an open-ended idea's battle ends, the review pass (P1a) flags it, and the Forge shows the table C line, naming the stock or, for a several-stock idea, the list. **A due idea is refused at deploy** with table C's line until you reaffirm it; the fresh version then deploys with no re-equip. The Idea panel shows a running idea, and lets you reaffirm a due idea even after you've drafted an edit (B4). |
| Does the agent see or trade anything differently? | **No.** No prompt byte, tool schema, decision or trade changes. With the gate on, a carried deploy's model requests, voice opener, shadow logs, response, agent document and manifest hash are **byte-identical** to the same deploy with the gate off (§4 row 2). A census pins every source file that names the frozen idea. None is a prompt module, the evaluation cron or a capture writer (§4 row 2). |
| Is it live? | **No, it's dark.** It rides the record slice's switch: `HYPOTHESIS_RECORDS_ENABLED = false`, and even when true it is on only for owners on the cockpit allowlist (B1). It reads no `PILOT_JOURNEY_MODE`. |
| Off-mode changes? | **None.** With the gate off, both deploy branches are byte-identical to `main`, proven by a golden captured from `main`'s own code. The golden covers 6 scenarios × 2 gate-off states × 2 creation paths (fence lit and dark) and compares the serialized capture: responses, prompt bytes, every store access in sequence, documents. It makes **zero version reads**. 28/28 on `main` and on this branch (§4 row 1). |
| Fenced diff | `decide.js` **+31 / −1**, `agentBattleService.js` **+21**. Logic lives in the new non-fenced `api/_utils/hypothesisRecords/carriage.js` (§1). |
| Acceptance (10 rows) | **All 10 met** (§4). |
| Tests | Linux suite of record (CI-shaped `--maxWorkers=2`, `TZ=UTC`) at the code head `3d292420`: **19,577 passed, 0 failed** (19,664 rows incl. 87 skipped; 279 s). **Flag dry run:** with the flip's four edits, **0 failed**; the control (the flag line alone) fails **exactly the three pin rows**. Emulator rules suite (Windows, Java 21): **24 files / 416 tests green**. `lint:gate` and `vite build`: **green** on an LF archive of the pushed head. |
| Review (BUILD_RULES §2) | Mandatory (fence contact; 36 files). **4 lenses + 4 refuting verifiers + a mutation lens + 2 rules mutants** (§9). 17 lens findings → **14 CONFIRMED, 3 PARTIAL, 0 fully refuted**. 12 fixed, 5 documented. None was a gate-off defect. Mutation: **280 mutants — 246 caught, 34 equivalent; every non-equivalent mutant is caught** (the 28 gap survivors were killed by new rows, and the re-run verified it). |
| What needs your eye | (1) **The fenced diff** (§1). (2) **One reading of B2** (§5 row 1): once the idea's newest *deployed* version is due, only a *newer* version may ride. An older ready or active version never stands in, per spec §2.5. Amendment D says so. (3) **The flip is four edits, not three** (§13 step 4). (4) Founder questions in §12. |

---

## 0. Preamble

- **Session open.** `git fetch origin main` first; `origin/main` = `4b28cd84`. The app gave this worktree the branch `claude/advisor-fable-7bc15e`; the build branch `claude/pilot-p1b-deploy-carriage` was cut from `origin/main` inside the worktree (tree clean). Every commit staged explicit paths after re-checking the branch in the same command.
- **Inputs re-verified.**
  - `decide.js`, `agentBattleService.js`, `compositionGenerationFence.js`, `equip-watchlist.js`, `watchlistEquip.js` and `trainingClone.js` have no commits since `8ce61c3d`. Checked with `git log 8ce61c3d..origin/main -- <files>`, which is empty.
  - `tournamentBattleView.js` and `callRecords/candidate.js` changed in P1a and enforce-readiness, and were re-read.
  - The deploy flow matches Phase 0 §3.3 / §5.1: `COMPOSITION_EPOCH_FENCE_ENABLED = true` (`api/_utils/compositionConfig.js:43`), so `commitBattleDocWithPin` creates the battle inside a transaction. `activeBattleId` is a later plain write. **No STOP.**
- **Linux runs** used a private WSL clone (`~/pd-p1b`); the shared `~/pd-amendd` was not touched.

---

## 1. The fenced diff, in full (for founder sign-off)

`git diff 4b28cd84..HEAD -- api/agent/decide.js api/_utils/agentBattleService.js`:

```diff
diff --git a/api/_utils/agentBattleService.js b/api/_utils/agentBattleService.js
@@ -198,6 +198,27 @@ export async function createAgentBattle(db, agentData, thresholds, startingPrice
       equippedWatchlist: options.equippedWatchlist
         ? { ...options.equippedWatchlist, snapshotAt: now }
         : null,
+      // Pilot P1b (founder-sanctioned fence entry, 8 Oct 2026; spec §2.4):
+      // the frozen hypothesis version, a SIBLING of equippedWatchlist — never
+      // inside it, never in the manifest hash. Written only when decide.js
+      // passes one, only beside a non-null snapshot, never on a tournament
+      // battle; otherwise absent (no key). compositionGenerationFence.js
+      // activates the version in the creation transaction.
+      ...(options.equippedHypothesis && options.equippedWatchlist && !isTournament ? {
+        equippedHypothesis: {
+          watchlistId: options.equippedHypothesis.watchlistId,
+          hypothesisVersion: options.equippedHypothesis.hypothesisVersion,
+          contentHash: options.equippedHypothesis.contentHash,
+          statement: options.equippedHypothesis.statement,
+          horizonEnum: options.equippedHypothesis.horizonEnum,
+          horizonSource: options.equippedHypothesis.horizonSource,
+          activation: options.equippedHypothesis.activation,
+          invalidation: options.equippedHypothesis.invalidation,
+          evidenceRefs: options.equippedHypothesis.evidenceRefs,
+          publishedAt: options.equippedHypothesis.publishedAt,
+          origin: options.equippedHypothesis.origin,
+        },
+      } : {}),
       // Release 2 PR-a (fenced site 1, SHA-bound authorization @ 4a0f43e) —
diff --git a/api/agent/decide.js b/api/agent/decide.js
@@ -55,6 +55,8 @@
 import { pinActivationDescriptor, commitActiveRulesProjection } from '../_utils/compositionGenerationFence.js';
+// Pilot P1b — deploy carriage (founder-sanctioned fence entry, 8 Oct 2026); the logic lives there.
+import { resolveDeployCarriage } from '../_utils/hypothesisRecords/carriage.js';
@@ -374,6 +376,26 @@ export default async function handler(req, res) {
       }
     }
 
+    // 3d. [Pilot P1b] Deploy carriage: which version of the equipped idea this
+    //     battle carries, from the list's server-written versions (gate off →
+    //     nothing, before any read). A due idea is refused here, before any
+    //     battle work, with table C's line.
+    const carriage = await resolveDeployCarriage(db, {
+      ownerUid: agent.ownerId, watchlistId: agent.equippedWatchlistId ?? null,
+      watchlist: equippedWatchlistData, snapshot: equippedWatchlistSnapshot, pin: projectionPin,
+    });
+    if (carriage.outcome === 'refuse') {
+      await agentRef.update({
+        deployingAt: null,
+        ...(progressInitialized && {
+          'deployProgress.stage': 'error',
+          'deployProgress.errorPhase': 'pre_decision',
+          'deployProgress.updatedAt': new Date().toISOString(),
+        }),
+      });
+      return res.status(carriage.status).json(carriage.body);
+    }
+
@@ -917,6 +939,8 @@
         equippedWatchlist: equippedWatchlistSnapshot,
+        // [Pilot P1b] The carried hypothesis version (absent unless carried).
+        ...(carriage.outcome === 'carry' ? { equippedHypothesis: carriage.equippedHypothesis } : {}),
         compiledBuild: buildGate.compiledBuild ?? null,
@@ -925,7 +949,13 @@
         activationPin: projectionPin,
       }
-    );
+    ).catch(async (battleErr) => {
+      // [Pilot P1b] The carriage race (no battle was created): restore the
+      // cooldown, as the baseline gate does, so the deploy is retriable at
+      // once; the catch below releases the lock and answers.
+      if (battleErr?.hypothesisCarriage) await agentRef.update({ lastDeployedAt: agent.lastDeployedAt ?? null }).catch(() => {});
+      throw battleErr;
+    });
```

What each piece does, and why it is in the fenced file rather than the helper:

| Piece | Where | Why it is here |
|---|---|---|
| The resolver call and the refusal | `decide.js:383-397` (step 3d, the self-select branch only, right after the equip read at `:356-377`) | The refusal must return the deploy's own HTTP answer **before any battle work**. That means releasing the lock and telling the ceremony "no battle" (the same three `deployProgress` fields the existing missing-rankings 503 stamps at `:329-338`). With the gate off, the resolver returns `none` as its first statement, with no read and no log. |
| The conditional option | `decide.js:943` | Passes the resolver's frozen copy to `createAgentBattle`. The key is absent when nothing is carried, so the options object is the same as `main`'s. |
| The cooldown restore on the race | `decide.js:949-956` | Review L2-2. If the creation transaction refuses the carried version because it changed in the meantime, no battle exists. As the baseline gate does (`:867`), the cooldown that the decision write stamped is restored, so "deploy again" is true at once. The existing catch then releases the lock and answers 500. |
| The 11 explicit keys | `agentBattleService.js:207-221` | The battle's shape is fenced as a concept (BUILD_RULES §1), so the shape is spelled out in the fenced writer, not in a helper a later edit could widen silently. The condition makes "only beside a non-null snapshot" (carry-forward 3) and "never on the tournament branch" true **at the writer**, not just at the caller. |

**Fenced functions called (not edited):** `createAgentBattle` (by `decide.js`, unchanged call shape plus one optional key); none of the other §1 fenced files is touched or newly called. **Not edited:** `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`, `agent-evaluate.js`, `completeBattle`, any prompt module or tool schema, the capture schema or serializer, `firestore.rules`, `equip-watchlist.js`, the agent document, `trainingClone.js` / `casualClone.js`. `equippedConfigHash`'s inputs are unchanged (`resolvedAgentManifest.js` untouched; the manifest builder never sees the sibling — §4 row 2).

---

## 2. What changed and where

### 2.1 Server

| File | What |
|---|---|
| `api/_utils/hypothesisRecords/carriage.js` (new) | Holds the deploy carriage logic. The resolution, the creation-transaction checks and the Forge's frozen-list read are described in §3. Typed error `HypothesisCarriageError` (`code: 'hypothesis_carriage_stale'`); constants `SIBLING_KEYS`, `CARRIAGE_SCAN_LIMIT`, `CARRIAGE_SCAN_MAX_PAGES`, `REVIEW_CLOCK_FAULT_FIELD`. |
| `api/_utils/compositionGenerationFence.js` | `commitBattleDocWithPin`: the lit transaction fresh-reads the carried version after the descriptor check, then `tx.create` + activation, in one commit; a battle carrying nothing does exactly what it did (zero extra reads). The dark branch refuses a sibling outright (carriage requires the transaction). |
| `api/_utils/hypothesisRecords/store.js` | `reaffirmVersion` under founder ruling B4: newer versions read in the transaction, `reaffirmableGiven`, the chain pointer on the current version only when unset, `REAFFIRM_NEWER_MAX = LIST_LIMIT − 1`. |
| `api/_utils/hypothesisRecords/model.js`, `reviewPass.js` | Re-exports of the new vocabulary; `reviewPass.js` comments only (P1b now arms rows). |
| `api/forge/watchlists/[id]/hypothesis-versions.js` | GET: when the page holds a `review_due` version, `deployedLists: { [version]: { battleId, name, tickers } }` for the newest one (B3). |
| `api/_utils/tournamentBattleView.js` | Privacy strip (spec §2.7): a completed battle shown to a non-owner loses `agentContext.equippedHypothesis` (a copy; the same object when there is none). |
| `api/tournament/battle-view.js`, `team-card.js` | Comments only (they route through the strip). |
| `api/_utils/compositionProtectedStoresAllowlist.json` | Write-site ratchet: `carriage.js` activation update (1), the deploy-time judgment update + delete (1 + 1), `decide.js` agents updates 13 → 15; `_notes_pilot_p1b`. |

### 2.2 Shared vocabulary and client

| File | What |
|---|---|
| `src/constants/hypothesisRecords.js` | `REAFFIRM_SUCCESSOR_STATUSES`, `CARRIABLE_STATUSES`, `reaffirmableGiven` (the one B4 predicate the route and the Forge share), `legalActionsFor` reworked for B4, `STATE_REASONS.deployed`, `DEPLOY_REFUSAL_CODE`, `DUE_DEPLOY_LINE` (table C's line — the deploy's refusal and the Forge's copy are one string), `CARRIAGE_RACE_MESSAGE`. |
| `src/components/Forge/Watchlist/ideaCopy.js` | The two table C V1.1 `[LIST]` rows; `[LIST]` in `fillLine`; `ideaSymbolOf` per B3; `ideaListOf`; `lifecycleLineFor` (moved here from the panel, pure). |
| `src/components/Forge/Watchlist/IdeaPanel.jsx` | Renders the lines with the frozen list; a **running** block for an activated version that is not the current one (chip + first-deploy / review-due dates — existing copy); a **superseded-due** block offering Reaffirm exactly when B4 allows. |
| `src/services/agentDeploy.js` | The deploy station: for `hypothesis_review_due` only, the response's `message` is forwarded as `details` — the field the Deploy Ceremony shows. |
| `src/config/featureFlags.js` | Docstrings only (P1b's effects and rollback; the journey-mode flag "nothing reads it" per B1). |

### 2.3 Docs

- `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md`: table C gains its **V1.1**, the two `[LIST]` rows, with a dated note. The existing five rows are unchanged. The document's header and footer record it as **V1.5**, because the document's own amendment numbering is already at V1.4 (table G). The pilot prompt's "table C V1.1" is the table's version, and the note says so.
- `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md`: **Amendment D — 8 Oct 2026 (founder rulings B1, B2)** appended. Nothing else changed.

### 2.4 Tests (new and changed)

- **New:**
  - `api/agent/decide.carriageOffGolden.test.js` with its fixture `api/_utils/__fixtures__/deployCarriageOffGolden.json` and the harness `api/_utils/__fixtures__/{deployHarness,deployScenarios}.js`
  - `api/agent/decide.carriage.test.js`
  - `api/_utils/hypothesisRecords/carriage.test.js`
  - `src/components/Forge/Watchlist/IdeaPanel.carriage.jsdom.test.jsx`
  - `src/services/agentDeploy.refusal.test.js`
  - `test/rules/agentBattlesHypothesisCarriage.rules.mjs`
- **Changed:**
  - `api/forge/watchlists.hypothesisRecords.test.js`: P1a's "current-and-successor-free only" reaffirm rows are replaced by B4 rows, and the GET's `deployedLists` rows are added.
  - `api/_utils/hypothesisRecords/model.test.js`: `legalActionsFor` per B4.
  - `src/components/Forge/Watchlist/ideaCopy.test.js`: seven table C rows, B3, and the §E sweep extended to the deploy strings.
  - The privacy rows in `tournamentBattleView.test.js`, `battle-view.test.js` and `team-card.test.js`.
  - `api/agent/decide.baselineGate.test.js`: the rollback count goes from 2 to 3 (§5 row 9).
  - `src/config/pilotJourneyModeFlags.test.js`: the title only.

---

## 3. How it works

1. **Resolution** (`resolveDeployCarriage`, step 3d of the self-select deploy):
   - **Gate.** Off for the battle's owner → nothing, before any read.
   - **Read.** Otherwise one paged read of the equipped list's versions, newest first (the automatic single-field index the Forge already uses, so **no new index**). A document counts only when its id is `v{version}` and it names this owner and this list.
   - **The walk, newest first.**
     - The first `ready` or `activated` version met carries (an intact record is required; a corrupt one carries nothing).
     - An `activated` version whose review is already due — its clock passed, or its battle is over (terminal, or past its own `expiresAt`) — is first **judged at deploy**, in one transaction with fresh reads and the review pass's own rule. It becomes `review_due` (`stateSource: 'deploy'`), its row is deleted, and the walk continues.
     - The first **deployed** version met is the idea's newest deployed version. If it is `review_due`, the deploy is **refused** with `409 { error: 'hypothesis_review_due', message: <table C line> }`.
   - **Nothing else carries.** With nothing carriable the deploy runs exactly as today. A dark composition fence carries nothing.
2. **Creation** (`commitBattleDocWithPin`, one transaction):
   - **Reads.** The activation descriptor (as before), then the carried version, then — for an active one — its review row and, for a battle-end row, that battle.
   - **The fresh read is authoritative.** It must still be the owner's, `ready` or `activated`, hold exactly the frozen content (re-hashed), and not be due at this battle's creation instant. Otherwise `HypothesisCarriageError`: no battle, no version change, no row.
   - **Then `tx.create(battle)`, plus:**
     - `ready → activated`: `firstDeployedAt`, `reviewDueAt` (`computeReviewDueAt`, anchored at the battle's creation instant), `stateChangedAt`, `stateSource 'deploy'`, `stateReason 'deployed'`, `lastDeployedAt`, `lastDeployedBattleId`. The row is armed with the due instant, or `null` for `unspecified`.
     - `activated` (B6): only `lastDeployedAt`, `lastDeployedBattleId`. The row is re-armed with the same `dueAtMs` and the new battle.
     - **B5.** `calendar_unavailable` → the version carries `reviewClockFault: 'calendar_unavailable'`, `reviewDueAt` stays null, the row is a battle-end review, and the deploy succeeds.
3. **Review.**
   - P1a's pass (unchanged) flags due rows `horizon_elapsed` and ended battle-end rows `battle_ended`.
   - The Forge's GET names the frozen list of the newest due version's deploying battle (via `lastDeployedBattleId`, checked for owner, version and list). The panel renders `[SYM]` when the idea names exactly one symbol (its own conditions, else a one-ticker frozen snapshot), else the `[LIST]` row.
   - The battle-ended line renders only for an `unspecified` idea.

---

## 4. Acceptance results

Linux suite of record = WSL Ubuntu, `TZ=UTC`, `--maxWorkers=2`; rules suite on Windows (WSL has no Java).

| # | Row | Result | Proof |
|---|---|---|---|
| 1 | **Gate off: byte-identical to `main`, zero version reads.** Covers deploy (both branches), the battle document, prompt bytes, the manifest and `equippedConfigHash`, the agent document, the creation transaction. | **Met** | **Test:** `api/agent/decide.carriageOffGolden.test.js`.<br>**Matrix:** 6 scenarios × 2 gate-off states (flag off with the owner allowlisted; flag on with the owner off the allowlist) × 2 creation paths (fence lit; fence dark).<br>**Scenarios:** ready-over-activated, due-with-nothing-ready, no equip, an uncommitted list, an existing active battle, the prescribed tournament branch.<br>**Each run compares** (as serialized JSON text, so key order counts):<br>• the response<br>• every model request<br>• the voice opener's prompt<br>• the shadow-log arguments<br>• every store read/query/write per kind and as one sequence<br>• transaction attempts<br>• the final documents<br>**Capture:** the fixture was captured by running this same file in a private Linux clone detached at `origin/main` `4b28cd84`, with no P1b source present. SHA-256 `dc03ce36…` is pinned. The pinned file ran 28/28 there and 28/28 on the branch.<br>A non-vacuous row asserts zero hypothesis-record access in every scenario. |
| 2 | **Gate on, carried.** Sibling keys exact, only beside a snapshot, never on tournament; `equippedConfigHash` unchanged; prompt bytes identical. | **Met** | **`decide.carriage.test.js` row 2,** against the off golden:<br>• the prompt bytes, voice opener, shadow logs, response and agent document are identical;<br>• the battle is identical except for the sibling;<br>• the hash is identical;<br>• every non-record write is identical.<br>**Tournament branch:** byte-identical to `main` with the gate on.<br>**`carriage.test.js` writer rows:**<br>• exactly 11 keys; extra keys dropped;<br>• absent beside a null snapshot or on a tournament battle even if passed;<br>• hash and manifest unchanged.<br>**Census:** pins the source files naming the sibling (none is a prompt module, `agent-evaluate.js` or a capture writer). The eval prompt's identity block is byte-identical with and without a sibling. |
| 3 | **Resolution (B2).** | **Met** | **`carriage.test.js` rows:**<br>• newest ready over an older activated;<br>• a reaffirmed successor deploys;<br>• due with nothing newer ready → the refusal, verbatim, before any battle write;<br>• drafts or terminal only → nothing;<br>• a newer due version is never bypassed by an older one (§5 row 1).<br>**Handler rows:**<br>• the refusal makes no model call and no battle;<br>• the cooldown is untouched;<br>• the ceremony is told "no battle". |
| 4 | **Activation.** | **Met** | **`carriage.test.js` rows** use the real `createAgentBattle` → creation transaction:<br>• `ready → activated` once, with the row armed in the same commit;<br>• B6 redeploy: no restamp; the row re-armed with the same `dueAtMs` and the new battle;<br>• `unspecified` → `dueAtMs: null`;<br>• `calendar_unavailable` → the typed marker, a battle-end row, and a successful deploy.<br>**Handler versions** of each. |
| 5 | **The race.** | **Met** | **`carriage.test.js`:** five disagreeing fresh reads (retired, flagged due, deleted, content rewritten, another owner), plus a competing commit landing between the body and the commit, plus a tampered sibling. Each gives the typed error, no battle, no version change, no row.<br>**Handler:** 500 with the race sentence as `details`, `errorPhase: 'post_decision'`, the lock released, the cooldown restored, and an immediate retry succeeds. |
| 6 | **End to end, from the frozen name only.** Armed row → the P1a review pass → `review_due` → the Forge line. | **Met** | **`decide.carriage.test.js` row 6:** deploy (gate on) → row → `runHypothesisReviewPass` → the versions GET → `lifecycleLineFor`.<br>**Variants covered:**<br>• `[SYM]` horizon;<br>• `[LIST]` horizon;<br>• `[SYM]` battle-ended (own condition);<br>• `[LIST]` battle-ended;<br>• the B5 version (no line).<br>**Frozen name only:** the live list is renamed before the GET, and the lines still name the frozen list. The panel's jsdom suite renders every variant. |
| 7 | **Supersession (B4).** | **Met** | **`watchlists.hypothesisRecords.test.js`:**<br>• reaffirm is allowed for each of the six B4 statuses as the newer version: `v{current+1}` is `ready` from the due content, and the chain pointer goes on the current version;<br>• it is refused (with `blockedBy`) for each other status;<br>• the bound is 99 newer allowed, 100 refused.<br>**Panel rows:** the superseded-due block appears exactly when B4 holds. |
| 8 | **Provenance and privacy.** | **Met** | **Provenance:**<br>• a carried battle's `resolveProvenance` → `{watchlistId, hypothesisVersion}`;<br>• sibling–snapshot mismatch → `provenance_unresolved` / `hypothesis_snapshot_mismatch`;<br>• no P1a code change.<br>**Privacy:** projection, battle-view and team-card rows; emulator rules rows (owner cannot write `agentContext` by dot-path, replace, merge or delete; cannot add a sibling; non-owners cannot get, query or collection-group it; positive controls; `firestore.rules` unchanged).<br>**Rules mutants:** 2/2 caught (§9.3). |
| 9 | **Table C V1.1.** | **Met** | **`ideaCopy.test.js`:**<br>• seven rows parsed from the spec, byte for byte;<br>• the `[LIST]` rows are exactly the V1 rows with `[SYM] → [LIST]`;<br>• the deploy refusal and the Forge share one string;<br>• the §E sweep covers the new rows and the two server deploy strings. |
| 10 | **Flag dry run.** Plus `main`'s values, the rules suite, `lint:gate` and `vite build`. | **Met** | §10. With `HYPOTHESIS_RECORDS_ENABLED = true` and its pins (four edits, §13 step 4), the full Linux suite is green. With the flag line alone, exactly the pin rows fail: `hypothesisRecordsFlags.test.js`'s pin and `flagPinGuard.test.js`'s two pin rows. The full suite at `main`'s values, the rules suite, `lint:gate` and `vite build` are all green. |

---

## 5. Departures, readings and judgment calls

| # | Topic | Prompt / spec said | Code does | Why |
|---|---|---|---|---|
| 1 | **B2 when an older version is ready** | "Carry the newest version whose status is ready or activated. If none exists and the idea's newest deployed version is review_due with no ready successor, refuse." | When the idea's newest **deployed** version is `review_due`, only a version **newer** than it may carry; otherwise refuse. When the newest deployed version is not due (retired, invalidated), the newest ready/activated version carries as written. | Review L4-1, confirmed by verifier V4.<br>• **The literal reading carries a replaced idea.** If v1 was replaced by v2 and v2 is due, v1 rides with a fresh clock.<br>• **An older long-clock version dodges the review.** It outlives a newer short-clock one that is due.<br>• **The refusal then never fires.**<br>Spec §2.5 (not amended by B2) says "a new deploy requires the future ready version created by reaffirmation", and B2's own "with no ready successor" points the same way. Amendment D's text states this reading. **Your call** if you meant the literal one. |
| 2 | **Due at deploy, before the pass has run** | B6: re-arm on redeploy; the review pass flags due ideas | An `activated` version whose review is already due (clock passed, or its battle terminal or **past `expiresAt`**) is judged at deploy, in a judged-once transaction (`stateSource: 'deploy'`). It is then refused. | Review L2-1 (medium), confirmed by V2. Every self-select battle holds crypto, so it expires at 8 pm ET. It then stays `active` until the next weekday's 13:00 UTC `agent-evaluate` tick (12–13 h overnight, about 60 h at weekends). A redeploy in that window carried an open-ended idea onto a new battle and its battle-end review never fired. Judging at deploy uses the pass's own rule plus the battle's own expiry, which `decide.js` itself treats as the battle's end (`:786`). |
| 3 | B5 marker | "a typed marker on the version (your choice of field)" | **`reviewClockFault: 'calendar_unavailable'`**, written only on activation when the calendar cannot place the clock. It is not in `LIFECYCLE_FIELDS` / `buildVersionDoc`, so P1a's version shape is unchanged. | It is typed (the clock error's own code) and never hashed. |
| 4 | **The race's client message** | "Report the client message used" | Ceremony headline: **"‹agent name› made its picks, but the battle couldn’t be created."** (existing, `CeremonyError.jsx`). The details box shows **"Your idea changed while this battle was being set up, so no battle was created. Check the idea in the Forge, then deploy again."** (`CARRIAGE_RACE_MESSAGE`, swept for table E). | The race reaches `decide.js`'s existing catch: 500, `details` = the error's message, `errorPhase: 'post_decision'`. The cooldown is restored, so the retry works at once. |
| 5 | **The refusal on the client** | "show the refusal's table C line verbatim" | `409 { error: 'hypothesis_review_due', message: <line> }`. `agentDeploy.js` forwards `message` as `details` for this code only. The server stamps `deployProgress.stage: 'error'` / `pre_decision`, so the ceremony reads **"Deployment failed — no battle was created."** with the table C line verbatim in the details box. | The ceremony renders `details`, and its "confirmed" headline needs the server's error stamp. The client may still show its own retry countdown, although the server consumed no cooldown. |
| 6 | **The refusal on the portfolio-refresh path** | — | An agent with a live battle and a due idea is refused (409) instead of refreshing its portfolio (200, no battle). | Reviews L2-5 / L4-5, confirmed. It is within B2 ("refuse the deploy, before any battle work"), and the check that a live battle exists runs only after the model calls. After a reaffirm the refresh still creates no battle, so the fresh version deploys on the next battle. **Your call** whether to exempt the refresh (it would need another fenced line). |
| 7 | **Two agents sharing one list** (B6) | "re-arm the review row with the same dueAtMs and the new battleId" | Built as ruled. If two agents' battles carrying the same open-ended idea **overlap** (the ranked agent and its casual clone), the row follows the newest battle. The earlier battle's end is not reviewed; the newest one's is. | Review L4-2; V4 rates it partial and low. Command Center deploys go through the casual clone. The ranked agent only self-selects when the clone cannot be made, so overlap is rare. The same-agent case is closed by row 2. **Founder question:** one row per battle, if you want every end reviewed. |
| 8 | A list deleted mid-deploy | — | The battle is still created from the snapshot taken at the equip read, and the idea is activated. | Review L4-4, nit. The battle half predates P1b (the legacy snapshot). Spec §2.2 lets versions that battles reference outlive the list. |
| 9 | An existing static pin | `decide.baselineGate.test.js` counted two cooldown rollbacks | It now counts three. | The race restore (row 4) is a third battle-less abort that rolls the cooldown back; the row's note says so. |
| 10 | Bounded reads | — | Versions are read 100 per page, up to 10 pages. A list with more than 1,000 versions carries nothing (logged). Reaffirm reads at most 99 newer versions (the Forge's page minus one). | Reviews L2-3 / L4-3. A page boundary never decides an answer; the bounds are far above any real list (version creation is rate-limited to 10 a minute). |
| 11 | `lifecycleLineFor` | Was in `IdeaPanel.jsx` | Moved to `ideaCopy.js` (pure); the panel re-exports it. | So the end-to-end row (acceptance 6) renders the Forge's line in Node from the server's real answer. |
| 12 | The tables' version number | "table C V1.1" | Table C's note is "V1.1"; the document header and footer record it as **V1.5**. | The document's own amendment sequence is already at V1.4 (table G). The footer's V1.4 sentence is pinned by `swapIdentity.test.js`, so V1.5's footer note is its own line. |
| 13 | The journey-mode flag | B1 | No reader added. The pin's "nothing reads it" assertion stays; its title and the flag docstring now name B1 (P4/P7 are its first readers). | No source file names the constant (the pin is a text scan). |

---

## 6. Off-mode changes

**None.** With the gate off (the flag off, or the owner off the allowlist), both deploy branches are byte-identical to `main` (§4 row 1). That includes the creation path with the composition fence lit or dark. The versions GET answers `404 disabled` before any read, the review pass returns before any read, and the Forge renders nothing — all exactly as P1a/P2. With the gate on but nothing to carry (no equip, an uncommitted list, drafts only), the only difference from `main` is one bounded version read (§4 rows 2–3).

---

## 7. Client messages

| Case | What the player sees |
|---|---|
| Due idea, nothing newer ready (409) | Ceremony: **"Deployment failed — no battle was created."**. In the details box: **"This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys."** (table C, verbatim) |
| The race (500) | Ceremony: **"‹agent name› made its picks, but the battle couldn’t be created."**. In the details box: **"Your idea changed while this battle was being set up, so no battle was created. Check the idea in the Forge, then deploy again."** |

## 8. Firebase Console index steps

**None new.** The carriage read orders one list's `hypothesisVersions` by `version`, which uses an automatic single-field index. The due judgment and the creation transaction read documents by id. The GET's frozen-list read is one document read. The P1a and P2 indexes stand (§13).

---

## 9. BUILD_RULES §2 review

**Mandatory**: there was fence contact, and 36 files changed. It ran as a multi-lens adversarial review with subagents.
- **Trees.** Each reviewer had its own LF `git archive` snapshot tree under the session scratchpad (`node_modules` linked by junction) and was read-only on git and every other tree.
- **The lenses** ran at `213075e2`:
  - **L1** the fence and the off guarantee;
  - **L2** lifecycle and the race;
  - **L3** privacy;
  - **L4** the attacker, holding the integrity builds' attacker model: a player controls every field the rules let them write, every body field of every route they can call, and timing.
- **Verifiers.** V1–V4, one per lens, each on a fresh tree of `213075e2`, told to refute every finding with a probe.
- **Mutation lens.** L5 ran last, on its own tree of the fix head `c663f761`.
- **No reviewer consulted the advisor.** Ids are this build's own (L·, V·).

### 9.1 Findings, verdicts, dispositions

| ID | Finding (short) | Verifier verdict | Disposition |
|---|---|---|---|
| L1-1 | The off golden never ran the creation path with the composition fence dark | CONFIRMED (V1: low — the dark branch is reachable only after a fence rollback) | **Fixed.** The golden was recaptured from `main` with a fence-dark set (`scenariosFenceDark`). The dark unit row now asserts the very object, unchanged. |
| L1-2 | `toEqual` hides key order ("prompt bytes" not literally compared) | CONFIRMED (low) | **Fixed.** Serialized comparison (green on `main` and branch). |
| L1-3 | Order across reads/queries/writes not recorded; late work after one macrotask missed | CONFIRMED (low) | **Fixed.** One sequenced access log in the harness, ten macrotask turns + 25 ms settle, header softened (frozen-clock limit stated). |
| L1-4 | Stale P1a notes ("armReviewRow used only by tests"); report cited before it existed | CONFIRMED (nit) | **Fixed** (this report ships in the same PR). |
| L2-1 | An activated idea whose review is due (clock passed / battle over) rides a new battle; an open-ended idea's battle-end review is lost | CONFIRMED (V2: medium — systematic for open-ended ideas, see §5 row 2) | **Fixed.** Judged at deploy, with a re-check in the creation transaction (§5 row 2). |
| L2-2 | The race left the 2-minute cooldown in place ("deploy again" → 429) | CONFIRMED (V2: low) | **Fixed** (fenced, §1): the cooldown is restored. |
| L2-3 | The single 100-version read failed open; reaffirm's bound exceeded the Forge's page | CONFIRMED (low) | **Fixed.** Paged read; `REAFFIRM_NEWER_MAX = LIST_LIMIT − 1`. |
| L2-4 | A version doc whose id disagrees with its `version` broke deploys after the model calls | CONFIRMED (low) | **Fixed.** The id must be `v{version}`. |
| L2-5 | The refusal also fires on the portfolio-refresh path | CONFIRMED (low/nit) | **Documented** (§5 row 6), your call. |
| L3-1 | The strip's tests cover tournament battles, which never carry; carrying battles rely on the read rule + route owner checks | CONFIRMED (V3: low; the team-card row is defence in depth, not a guard on the strip) | **Documented** (§2, here); team-card row relabelled; the census row added. |
| L3-2 | Rules file lacked an owner-list positive control and collection-group denials | CONFIRMED (nit) | **Fixed.** |
| L3-3 | Stale comments (battle-view, team-card, flag docstring) | PARTIAL (nit — the docstring sentence is defensible) | **Fixed.** |
| L4-1 | An older ready/activated version stands in for a newer due one | CONFIRMED (V4: medium) | **Fixed** (§5 row 1), stated in Amendment D, your call. |
| L4-2 | Battle-end review deferred when another carrying battle starts first | PARTIAL (V4: low — deferred, not lost; two-agent overlap rare) | Same-agent case **fixed** by L2-1; two-agent overlap **documented** (§5 row 7). |
| L4-3 | The refusal dodged by pushing the due version past 100 drafts | PARTIAL (V4: confirmed mechanically, refuted as an attack — retire is one tap) | **Fixed** by the paged read. |
| L4-4 | A list deleted mid-deploy still deploys and activates | CONFIRMED (nit) | **Documented** (§5 row 8). |
| L4-5 | Same as L2-5 | CONFIRMED (nit) | As L2-5. |

**Tally:** 17 lens findings: **14 CONFIRMED, 3 PARTIAL, 0 fully refuted** (L4-3 was refuted as an attack and confirmed as a mechanism). 12 fixed, 5 documented. Every lens found the code correct with the gate off. L3 and V3 found **no privacy leak**. L4 and V4 could not carry another player's version or list, change another player's version, or read another player's battle.

### 9.2 Mutation lens (L5)

**Method.** 280 single-point mutants at the fix head `c663f761`, covering every P1b code site: the resolver and its walk, the due judgment, the creation-transaction checks, activation, the frozen-list read, each conjunct and each of the 11 keys in the fenced writer, the fenced `decide.js` lines, the fence module's three seams, B4 in the store and the shared vocabulary, the GET, the privacy strip, the Forge copy and panel, and the deploy service. Each mutant was applied alone, the relevant P1b suites run, and the file restored and sha-verified. The tree was manifest-checked byte-identical at the end.

**First pass:** **219 caught, 61 survived.** The lens argued **33 survivors equivalent or not a defect**:
- unreachable catches (the content hash cannot throw);
- guards masked by an earlier check (e.g. the creation instant is always a valid ISO string);
- the same value (e.g. the `[LIST]` rows are the `[SYM]` rows with the placeholder renamed);
- record invariants (no version beyond the pointer; the current version has no successor).

The other **28 survivors are real gaps.**

**Fix.** The lens supplied probe rows for 21 gaps; this build wrote rows for the other 7 (commit `3d292420`).
- **The lens's 21 rows:**
  - the judgment losing its race either way (`already_due` / `not_due`);
  - the exact-expiry boundary;
  - an unknown horizon and a malformed `firstDeployedAt` treated as corrupt;
  - the transaction's fresh doc naming another list or version;
  - `reviewDueAt` / `armedAt` anchored at the battle's creation even if the clock moves;
  - a timed row never reading its old battle;
  - a forged `watchlistId` in the body;
  - a non-carriage creation failure keeping the cooldown as on `main`;
  - the refusal's progress timestamp;
  - the superseded-due and newest-due frozen lists;
  - the panel's reaffirm target and blocks.
- **This build's 7:**
  - R13, an invalid last version on a full page;
  - R23, the review row unreadable;
  - ST07, a hole in the numbering;
  - ST03, the Admin SDK's `Transaction.getAll` refuses zero arguments (verified in `@google-cloud/firestore`), so the route suite's store now enforces it;
  - I01, a blank condition symbol;
  - AD02, a non-string refusal message;
  - DC09, re-run below.

**Re-run** of the 28 with the lens's own harness on a fresh tree of `3d292420`: **27 CAUGHT**, every restore byte-verified.
- **DC09 survives and is equivalent.** It drops the `progressInitialized &&` guard on the refusal's progress stamp.
- `decide.js` reaches step 3d only when the request is not a tournament deploy (`:311`).
- On that path `progressInitialized` is `req.body.gameMode !== FLAT6_GAME_MODE`, which is always true.

**Net: 280 mutants — 246 caught, 34 equivalent; every non-equivalent mutant is caught.**

### 9.3 Rules mutants (builder, emulator)

These ran through the suites' `COMPOSITION_RULES_TEXT_PATH` knob, with no edit to the tree's rules file. The unmutated file passes 13/13.

| Mutant | Rows caught |
|---|---|
| Owner may update `agentContext` (added to the `hasOnly` list) | 3 |
| Any signed-in user may read `agentBattles` | 2 (the unauthenticated row still passes, correctly) |

**2/2 caught.**

---

## 10. Test runs

| Run | Where | Result |
|---|---|---|
| Full suite, CI-shaped (`--maxWorkers=2`, as `.github/workflows/tests.yml`), `TZ=UTC`, **`main`'s flag values** | WSL Ubuntu (private clone `~/pd-p1b`), code head `3d292420` | **19,577 passed, 0 failed** (19,664 rows incl. 87 skipped; 279 s) |
| **Flip dry run**: the flag line + the pin row + the registration row turned around + the `DARK_BY_DESIGN` entry dropped | same clone, `3d292420`, the four edits applied by script and the exported value printed (`true`) | **19,577 passed, 0 failed** (277 s) |
| **Control**: the flag line ALONE | same | **exactly 3 failed**: `hypothesisRecordsFlags.test.js` "is DARK"; `flagPinGuard.test.js` "every pinned flag matches its live value" and "DARK_BY_DESIGN lists only real, currently-dark flags". These are the pin rows the flip moves; no other suite reddens. Every new P1b suite mocks the flag itself. |
| Full suite, first pass | WSL, `213075e2` (pre-review) | 19,519 passed, **1 failed**: `swapIdentity.test.js` pins the V1.4 footer sentence; fixed in `fd47435b` (§5 row 12) |
| The off golden **on `main`'s code** | WSL clone detached at `4b28cd84`, the golden test + harness + fixture copied in, LF | Captured there (`GENERATE_…=1`), then **28/28** with the SHA pinned. Re-verified after every harness change (non-enumerable `push`, the 25 ms settle) |
| Emulator rules suite (`npm run test:rules`) | Windows (Java 21), LF archive of `3d292420` | **24 files, 416 tests, all green** (P2 ended at 23 / 403) |
| Rules mutants | same, through `COMPOSITION_RULES_TEXT_PATH` | 2/2 caught (§9.3) |
| Mutation lens + re-run | Windows, own trees | §9.2 |
| `npm run lint:gate` | LF archive of the pushed head | **green** (exit 0) |
| `vite build` | LF archive of the pushed head | **green** (exit 0); the pushed commit is the built commit |
| Windows note | CRLF worktree | The usual platform-only rows fail here and pass on Linux: `shadowCpuQuoteIntegrityFlags`, `eligibility`, `agentReadCensus.guard`, `archetypeRegistry` import-boundary paths. None is this build's. |

---

## 11. Advisor consultations

The prompt allowed exactly two: (1) with the plan, before the first fenced edit; (2) before declaring the build done. Review subagents did not consult it.

| # | When | What it said | What changed because of it |
|---|---|---|---|
| 1 | After discovery, before any fenced edit | Capture the off golden **before** touching the fence, from `main`'s code, with no P1b imports in the test. One ordered version read instead of two filtered queries. B4's set is not `PRE_DEPLOY_STATUSES`. Table C mechanics (the row parser, the version note). The flag dry run is three edits. Check how the journey-mode pin detects readers. The privacy strip copies only when the key exists. The §E sweep and write-site ratchet for new strings and writes. Enforce carry-forward 3 at the writer. A list of honesty items. | All adopted:<br>• the golden was captured and committed first (`32965db0`);<br>• one ordered read (later paged, review L2-3);<br>• `REAFFIRM_SUCCESSOR_STATUSES` with one shared predicate;<br>• seven parsed rows with a dated note;<br>• no source file names the journey-mode constant;<br>• the strip returns the same object when there is no key;<br>• the deploy strings are swept;<br>• ratchet notes added;<br>• the writer condition is in the fenced diff.<br>**One correction in the dry run:** the flip is **four** edits (the registration row in `hypothesisRecordsFlags.test.js` must turn around too), §13. |
| 2 | Before declaring done | ⟨PENDING⟩ | ⟨PENDING⟩ |

---

## 12. Founder questions and carry-forwards

**Questions (nothing is blocked on them; defaults are built):**
1. **B2's reading** (§5 row 1): keep "only a newer version may carry once the newest deployed version is due"? The alternative is the literal reading, under which an older ready or active version carries.
2. **The refresh path** (§5 row 6): exempt a deploy that will not create a battle from the refusal?
3. **Two carrying battles at once** (§5 row 7): one review row per battle, so every battle's end is reviewed?
4. **B5's chip-only state**: a timed idea whose clock fell back to a battle-end review shows "Review due" with no table C line, because "still open-ended" would be false for it. A table C row for it, or keep it chip-only?
5. Still open from P1a/P2: reject/cancel reasons; the analysis line's words; a durable "you marked it researched" marker; one research record per screener save.

**Carry-forwards:**
- **The market calendar ends 2027-12-31** (P1a carry-forward 7). Long-term clocks for deploys from 6 Oct 2027 now take B5's fallback (battle-end review, marked), not a failed deploy, but the calendar task still stands.
- `film-tape-backfill.e2e` timeout headroom (P1a carry-forward 8) is unchanged.

---

## 13. Flip checklist — the whole record slice (P1a + P2 + P1b)

Everything below happens **after this PR merges**. Until step 4, nothing is visible to anyone and nothing new is written or read.

**Step 1 — the two indexes (Firebase Console).** The repo's index-drift note requires the Console index as well as the file entry. **P1b adds none.**
1. Firebase Console → project **tradeseven** → **Firestore Database** → **Indexes** → **Composite** → **Create index**:
   - Collection ID **`hypothesisVersions`** · Query scope **Collection group** · fields **`userId` Ascending**, **`status` Ascending**, **`stateChangedAt` Descending** → **Create**. *(P1a — your ideas across your lists.)*
2. **Create index** again:
   - Collection ID **`researchWork`** · Query scope **Collection** · fields **`userId` Ascending**, **`createdAt` Descending** → **Create**. *(P2 — your research list.)*
3. Wait until both read **Enabled**.
   - **No other index is needed.**
     - The deploy's version read orders one list's subcollection by `version` (automatic).
     - The review pass's queue reads use automatic single-field indexes.
     - Everything else reads documents by id.

**Step 2 — publish the rules.** Firestore Database → **Rules** → paste the merged `main`'s `firestore.rules` → **Publish**, or run `firebase deploy --only firestore:rules --project tradeseven`.
- **P1b changes no rule.** The blocks P1a and P2 added (`watchlists/{id}/hypothesisVersions`, the `hypothesisVersions` collection-group list, `hypothesisReviewQueue`, `hypothesisReviewState`, `researchWork`) must be live.
- The `agentBattles` rule that keeps the carried idea owner-only is already live.

**Step 3 — admit yourself.** Vercel → the project → **Settings** → **Environment Variables** → **Production**: make sure **`COCKPIT_ALLOWLIST_UIDS`** contains your Firebase uid (comma-separated). An environment change reaches new deployments only, so **redeploy production** after editing it.

**Step 4 — flip the flag (its own small PR: FOUR edits in one commit).**
1. `src/config/featureFlags.js`: `HYPOTHESIS_RECORDS_ENABLED = true`.
2. `src/config/hypothesisRecordsFlags.test.js`: the pin row `expect(HYPOTHESIS_RECORDS_ENABLED).toBe(false)` → `toBe(true)`.
3. The same file's registration row: `expect(GUARD).toMatch(/^\s*HYPOTHESIS_RECORDS_ENABLED:/m)` → `.not.toMatch(...)`.
4. `src/config/flagPinGuard.test.js`: delete the `HYPOTHESIS_RECORDS_ENABLED:` entry and its note from `DARK_BY_DESIGN`.

With all four the full Linux suite is green, as dry-run in §10. With the flag line alone, exactly the pin rows fail. Then merge and deploy.
- **Rollback** is the same four lines back.
  - Nothing new is read or written, and no deploy carries, activates or refuses anything.
  - What was written stays: versions, research records, battles' frozen ideas.
  - Activated versions stay `activated` and their armed review rows stay queued, **unreviewed while off**, and are judged on the first pass after a re-flip.

**Step 5 — the first things to try.**
1. **Write an idea.** Forge → a saved watchlist → **Idea** → **Write the idea** (choose a time-frame, e.g. *Swing* — or leave it unset for an open-ended idea) → **Save**. It starts as a **Draft**; tap **Mark researched**, then **Mark ready** → the chip reads **v1 · Ready**.
2. **Equip and deploy.** Equip that watchlist on your agent; deploy from the Command Center. The deploy works exactly as before.
3. **See it running.** Back in the Forge, the chip reads **v1 · Activated**, with **"First deployed …"** and, for a timed idea, **"Review due …"** (a Swing idea: the close of the 10th trading session after the deploy).
4. **See the review line.** After the time-frame (or, for an open-ended idea, after the battle ends — within 15 minutes of the reflections cron noticing it), the chip reads **Review due** and the Forge says, e.g., **"Your NVDA idea reached its time-frame (Swing, 10 trading sessions). Nothing was sold and nothing was deleted — it's flagged for your review. Reaffirm it to make a fresh version, or retire it."** — with your list's name in place of the stock when the idea names several.
5. **Try to deploy it again before reaffirming** → the ceremony shows **"Deployment failed — no battle was created."** with the table C line **"This idea is due for review — reaffirm it first (one tap, same content if you want), and the fresh version deploys."** Tap **Reaffirm** in the Forge, then deploy: **v2** rides.

---

## 14. Branch and PR

Branch `claude/pilot-p1b-deploy-carriage`; commits `32965db0` (the off golden, captured from `main` before any source), `dfb3c8e4` (carriage), `213075e2` (acceptance tests), `fd47435b` (tables footer), `c663f761` (review fixes), `10bec74e`, `5f7f1412` (review follow-ups), `3d292420` (the mutation lens's gap rows), and this report. Pushed, PR opened, and stopped: the founder signs off the fenced diff, reads CI and merges. Crons do not run on Vercel preview: the review pass and its interplay with carriage are verified by the unit, handler and end-to-end tests, and in production by observing the first pass after the flip. A byte-exact copy of this report is in the session scratchpad (BUILD_RULES §3).

*Build report — Pilot P1b, Claude Code, 9 October 2026, base `4b28cd84`.*
