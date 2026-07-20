# Archetype Mastery — CC Phase 0 Discovery Report (read-only, hard STOP)

**Spec:** `docs/ARCHETYPE_MASTERY_SPEC_V2_LOCKED.md` §11
**Date:** 2026-07-20
**Prepared as:** a read-only discovery/verification pass — **no project state was modified** (no writes, no branches, no commits). Per BUILD_RULES §3 this report is delivered as a file outside the repo tree for the founder to add byte-exact to `docs/audits/` if approved.

---

## Preamble (BUILD_RULES §2/§3 discovery protocol)

- **`git fetch origin` run first** (recorded per §3). Result: branch is current with the remote.
- **Branch:** `claude/phase-0-archetype-mastery-qo1m3n` (the designated Phase 0 branch).
- **HEAD SHA:** `39efa6654654f81a1549439203532a19d80a8681`.
- **`origin/main`:** `39efa66…` — **identical to HEAD**; the branch is cut fresh from current `main` (no drift).
- **Working tree:** clean.
- **Read-only:** confirmed. Investigation reads only. Any fix-worthy items outside scope are filed under "Found outside task" (§3), not acted on.

**Verification method (why the anchors are trustworthy).** Every §11 check was investigated by an independent finder agent AND re-checked by a separate *adversarial* verifier agent instructed to refute it — so each cited `file:line` was opened twice, independently, this session. In addition, **I personally re-read every STOP-class anchor** (S11.1, S11.2, S11.3, S11.4, S11.5, S11.6, S11.7, S11.11, and the misattributed slot-tick). `VERIFIED` below means the line was read in this session at HEAD `39efa66`; `ASSUMED` means inferred without a live-data read (only S11.9 constants, which need a live DB export). Note: `api/…` runs under the Firebase **Admin SDK**, which bypasses `firestore.rules`, so rules bound *client* writes only — server writes are governed by code, which is why the deletion/immutability checks were done against code AND rules.

---

## Executive verdict table

| # | §11 check | STOP? | Verdict (one line) |
|---|-----------|:-----:|--------------------|
| **1** | `completeBattle` anchor + completion-txn extendability | 🔴 **STOP** | Completion is a bare, **unguarded single-doc `.update()`** (not a transaction) — can't host the write-once eligibility stamp without a founder-approved enforcement-design change; also exposes fenced completion sites (see #11). |
| **2** | Battle-doc cardinality (per-agent, not shared) | 🟢 CLEAR | Strictly **one agent : one owner : one frozen archetype** per doc. Award keying is safe. |
| **3** | Forge bundle keying per-archetype | 🔴 **STOP** | Bundles are stored **per-agent, with no archetype key**, and survive an archetype switch untouched → **bundle content is shared across archetypes**. Also surfaces an internal spec contradiction (§6.1 line 95 vs 97). |
| **4** | Retention: no deletion/TTL on `agentBattles` | 🟢 CLEAR | No `.delete()`/TTL path anywhere in code or config; rules deny client delete. (One out-of-band console check recommended.) |
| **5** | Server-monotone creation key | ⚪ Info | **Does not exist.** `createdAt` = wall-clock ISO string; `battleId` = random auto-id. Same-millisecond rank edge is live at the source — §3 handles it via stamp-authority + corrections. |
| **6** | Rank-query index support | ⚪ Info | **No index** covers `(ownerId + agentContext.archetype + createdAt)`. A new composite index must ship before the slot rank query runs (else `FAILED_PRECONDITION`). |
| **7** | Slot-key authorship + rules posture | 🟢 CLEAR | `agentBattles` is server-authored; client writes to slot-key **and** new mastery fields are already denied. New mastery collections default-deny; `masteryProfiles` needs an explicit owner-read rule for its surface. |
| **8** | Terminal-status enumeration → §4 matrix | ⚪ Deliverable | Only **one** terminal status exists in code: `'completed'`. `abandoned`/`forfeit`/`no-contest` are **not produced by any code path**. Matrix built around `completed` (3 dispositions); non-completed rows require net-new terminal transitions. |
| **9** | Score distribution → constants proposal | ⚪ Deliverable | Score is `scoreState.currentScore` (~0-centered, unbounded, negative-skew). **All constants ASSUMED** — the 22 known battles are all pre-Jul-18 and no scores are committed in-repo; a live export is required. Read-only export tool already exists. |
| **10** | `agentProgression` consumers, equip/kernel sites, epoch home, concurrency | ⚪ Info + platform finding | All insertion sites located; server retirement blast-radius = 1 file. **Platform finding: no real concurrency control** (deploy lock is TOCTOU; eval lock 120s < 290s budget; `completeBattle` has no write-once guard) — a hard constraint on the §5 award design. |
| **11** | Fence check on every write target | 🔴 **STOP** | Two `agentBattles`→`completed` writes live **inside the fence file `api/agent/decide.js`** (`:588`, `:1115`). Making them eligibility-stamp-bearing = fence contact. (Finder said CLEAR; adversarial verifier + critics overturned it to STOP.) |

**Bottom line: 3 hard STOPs (#1, #3, #11), all founder-gated.** #1 and #11 are two faces of the same completion-path reality. #3 is a data-model + spec-contradiction decision. The remaining checks are clear or are Phase-0 deliverables/observability that inform P1 design.

---

## STOP register — what the founder must decide before P1 writes

### STOP-A — Completion path is non-transactional AND partly fenced (checks #1 + #11)

**What's true (VERIFIED):**
- The single-battle settlement anchor is `completeBattle` at **`api/cron/agent-evaluate.js:3495`**. Its terminal write is a plain **`await battleRef.update(updatePayload)` at `:3581`** where `updatePayload` sets `status:'completed'` (`:3556`). It is **not** wrapped in `runTransaction` and has **no write-once/absence guard**. (`agent-evaluate.js` is **not** a fence file.)
- The same file already solves this exact race for a different field — `regimeAtStart` uses an in-transaction re-read at **`:991`** precisely because the eval lock (120s) is shorter than the run budget (290s), so a second invocation can steal the lock and double-write (check #10).
- **Two additional** `agentBattles`→`'completed'` terminal writes exist at **`api/agent/decide.js:588`** and **`:1115`** — lazy GC of an expired battle to make room for a redeploy (`completionReason:'expired'`), each a bare `.update()`. **`decide.js` IS a fence file.** These paths run **no scoring/settlement** (they bypass `resolveCompletionDisposition`).

**Why it's a STOP:** §5.1 requires `masteryEligibility` to be stamped **write-once, atomic with `status:completed`**, so "a battle can never exist completed-but-unstamped" and "racing workers cannot split-brain the stamp." Today's unguarded single-doc update cannot guarantee that. The clean primary fix (convert `completeBattle` to a guarded `runTransaction` following the `regimeAtStart` pattern) is feasible and lands in a **non-fence** file — but per §11.1 that is an *enforcement-design change* the gate holds for founder sign-off. The `decide.js` sites cannot be fixed the same way: editing them is **fence contact**, and the §5.3 repair sweep "reads stamps only," so it cannot back-fill an eligibility stamp for a battle that was completed without one.

**Founder decision needed:**
1. Approve converting `completeBattle`'s status write to a **guarded transaction** (`runTransaction` + absence guard) — an enforcement-design change to a hot settlement path (also must keep the two `agents/{id}` side-writes at `:3595`/`:3614` consistent).
2. Choose how the two fenced `decide.js` expiry-completions are treated (they are unsettled/abandoned-in-substance): **(a)** explicitly scope them **out** of mastery XP — no fence edit, cleanest; or **(b)** authorize a fence entry to stamp/reroute them. Recommendation: (a).

### STOP-B — Forge bundles are shared across archetypes (check #3)

**What's true (VERIFIED):**
- `createBundle` writes to **`src/services/forgeService.js:334`** `collection(db, 'agents', agentId, 'bundles')` — keyed by **agentId**; the bundle doc (`:335-358`) has **no archetype field**.
- A user has **one ranked agent** (`src/services/agentService.js:16-24`, `.find(isTrainingClone !== true)`), whose **archetype is a single mutable field**.
- `change-archetype.js:148-152` commits `{archetype, updatedAt, equippedTraits}` and **never reads or writes the bundles subcollection** — so all forged bundles carry over unchanged across an archetype switch. Capacity is gated off the single agent level (`equip-bundle.js:107`), not a per-archetype level.

**Why it's a STOP:** §11.3's rule is "⚠ if bundle state is shared across archetypes," and it is. This also collides with an **internal spec contradiction**: §6.1 line 95 calls Forge bundles **"account-scoped assets"** (deliberately), while line 97 says **"bundles are per-archetype … shared state = STOP."** The code implements the account-scoped model.

**Founder decision needed:** Reconcile §6.1 line 95 vs 97. Either **(a)** amend line 97 and re-scope this STOP (bundles stay account-scoped; only *capacity* keys to highest archetype level) — likely the intended model given the LAZY legacy-floor/retirement machinery in §6.1; or **(b)** commit to per-archetype bundles, which is a schema-breaking change (add an immutable archetype key at `createBundle`, partition every forge read/equip/reforge path, migrate existing permanent bundles, define archetype-switch behavior).

---

## Per-check detail

### S11.1 — completeBattle anchor + completion-transaction extendability — 🔴 STOP
- `api/cron/agent-evaluate.js:3495` — `async function completeBattle(db, battle, summary)` — primary terminal transition. **[VERIFIED]**
- `:3556` — `status: 'completed', completedAt: now,` assembled into `const updatePayload = { … }` opened at `:3555`. **[VERIFIED]**
- `:3581` — `await battleRef.update(updatePayload);` — **plain single-doc update, no `runTransaction`, no write-once guard.** **[VERIFIED]**
- `:3595` / `:3614` — separate `agentRef.update(...)` writes on `agents/{id}` (non-atomic with the battle write). **[VERIFIED]**
- `:991` — `db.runTransaction(...)` re-reads `regimeAtStart` to defeat the documented lock-steal double-write; `completeBattle` has no equivalent. **[VERIFIED]**
- `api/agent/decide.js:588` and `:1115` — `db.collection('agentBattles').doc(existingBattleId).update({ status:'completed', completedAt, completionReason:'expired' })` — terminal writes **inside a fence file**. **[VERIFIED]**
- Resolution → see STOP-A.

### S11.2 — Battle-doc cardinality — 🟢 CLEAR
- `api/_utils/agentBattleService.js:105` `agentId: agentData.id`, `:106` `ownerId: agentData.ownerId`, `:158` `archetype: agentData.archetype || 'unknown'` — single scalars, one frozen archetype. **[VERIFIED]**
- `:142` `opponent: options.opponent || null` — singular embedded **CPU snapshot** (`decide.js:742`), not a co-owner; tournament docs set `opponent:null` (`decide.js:1151`) and join siblings only via `groupId` (`:112`). **[VERIFIED]**
- `:262` `db.collection('agentBattles').add(battleDoc)` — the sole insert; one doc per agent. No `participants[]`/`opponents[]`/`fieldSize`/`census` field exists. **[VERIFIED]**
- **Build guidance:** key awards on `(ownerId, agentId, agentContext.archetype)`; never on `groupId`; never mine `opponent.*` for attribution.

### S11.3 — Forge bundle keying per-archetype — 🔴 STOP
- See STOP-B. Anchors: `forgeService.js:334`/`:335-358` (agent-keyed, no archetype field) **[VERIFIED]**; `agentService.js:16-24` (one ranked agent) **[VERIFIED]**; `change-archetype.js:148-152` (no bundle touch) **[VERIFIED]**; `equip-bundle.js:107` (single agent-level cap) **[VERIFIED]**; spec contradiction at `ARCHETYPE_MASTERY_SPEC_V2_LOCKED.md:95` vs `:97` **[VERIFIED]**.

### S11.4 — Retention: no deletion/TTL on agentBattles — 🟢 CLEAR
- `firestore.rules:222` — `allow create, delete: if false;` (client delete denied). **[VERIFIED]**
- No `.delete()` targets `agentBattles` in `api/` or `scripts/`; every deletion hit targets other collections (`drafts`/`battles` in `lobbies/cleanup-expired.js:193/279`, `fantasyTimesStories` in `fantasytimes/cleanup.js:64`, `priceHistory`, agent boards, `validatedCatalysts`; `ws1-observe-walk.js:397-403` deletes **`agents`**, not `agentBattles`). **[VERIFIED]**
- `firebase.json` declares only rules+indexes; `firestore.indexes.json` `fieldOverrides: []` — **no TTL policy in-repo.** **[VERIFIED]**
- **Residual (recommend):** TTL can be set out-of-band in the GCP/Firebase console with no repo artifact, and `agentBattles` already carries an `expiresAt` field a TTL policy could latch onto (`agentBattleService.js:116/263`). A one-time console confirmation that no TTL policy exists on `agentBattles` closes the invariant fully.

### S11.5 — Server-monotone creation key — ⚪ Info (does not exist)
- `agentBattleService.js:57` `const now = new Date().toISOString();`, `:114` `createdAt: now` — **wall-clock ISO string, not `FieldValue.serverTimestamp()`.** **[VERIFIED]**
- `:262-263` `const docRef = await db.collection('agentBattles').add(battleDoc); return { id: docRef.id, … }` — `battleId` is a **random** Firestore auto-id; no `battleId` field is written into the doc; no server counter/sequence. **[VERIFIED]**
- **Consequence:** the `(createdAt, battleId)` tuple §3 ranks on is **not** a total server-monotone order; same-millisecond same-user-same-archetype creations have no strict source-level tiebreaker. This confirms §3's premise ("Phase 0 checks whether a server-monotone creation key exists" — it does not), so the same-ms edge is handled downstream by stamp-authority + the corrections ledger, not eliminated at the source. Optional hardening: add a server-authored monotone key (e.g. `serverTimestamp()` + a per-(user,archetype,slotDate) sequence).

### S11.6 — Rank-query index support — ⚪ Info (new index needed)
- `firestore.indexes.json` has exactly **three** `agentBattles` composite indexes: `ownerId+agentId+createdAt` (`:198`), `status+pendingReflection+completedAt` (`:216`), `ownerId+status+completedAt` (`:234`). **None includes `agentContext.archetype`.** **[VERIFIED]**
- Attribution field is nested at `agentContext.archetype` (`agentBattleService.js:158`). **[VERIFIED]**
- **Action:** add one composite index — `collectionGroup agentBattles: ownerId ASC, agentContext.archetype ASC, createdAt ASC` (append `battleId`/`__name__` for the tiebreak; or `(ownerId, archetype, slotDate, createdAt)` if the query pins slotDate by equality). `firestore.indexes.json` is **not** a fence file. Ships before the slot rank path or the query throws `FAILED_PRECONDITION`.

### S11.7 — Slot-key authorship + rules posture — 🟢 CLEAR
- `firestore.rules:212-222` — `agentBattles`: owner-scoped read (`:213`); update restricted by `hasOnly([executionMode, pendingProposal, battleLedger, updatedAt, strategyPreset, gameplanMeeting, gameplanMeetingHistory, dailyGrades, feedBookmarks, reviewDecisions])` (`:219-220`); `create, delete: if false` (`:222`). **[VERIFIED]**
- Slot-key fields (`createdAt`, `battleId`=doc-id, `ownerId`, `agentContext.archetype`) and the new fields (`masterySlot`/`masteryEligibility`/`masteryAward`) are **absent** from the whitelist → client writes denied **without any rules change**. **[VERIFIED]**
- `:717` catch-all `match /{document=**} { allow read, write: if false; }` → new collections (`masteryProfiles`, `masteryAward`, `masteryCorrections`, quarantine, epoch registry) **default-deny** client access. **[VERIFIED]**
- **Build note:** do **not** add mastery fields to the `agentBattles` update whitelist (keep them Admin-SDK-only). `masteryProfiles` is spec'd to surface to owners, but the catch-all denies client *reads* too — add an explicit owner-scoped read block (template: `learningDossiers` at `:687`) or serve via a server endpoint. Rules require a **manual Firebase Console deploy** (repeated in-file caveat).

### S11.8 — Terminal-status enumeration → §4 matrix — ⚪ Deliverable
Only status `'active'` (start, `agentBattleService.js:107`) and `'completed'` (terminal) exist for `agentBattles`. `'completed'` is reached **three** ways, all writing the same status string: **[VERIFIED]**
- (a) `completeBattle` natural expiry, casual/tiered — `agent-evaluate.js:3556`, with `result` win/loss/draw (`:3480`).
- (b) `completeBattle` natural expiry, tournament — `agent-evaluate.js:3556`, `completionContext:'tournament_group_scored'` (`:3472`), `result:null`.
- (c) decide.js stale-sweep — `decide.js:589` & `:1116`, `completionReason:'expired'`, **no scoring**.

`win/loss/draw`, `completionContext`, and `completionReason` are **sub-fields of the one `completed` status**, not statuses. `abandoned`/`forfeit`/`no_contest`/`cancelled` **do not exist** on `agentBattles` (those grep hits belong to watchlist sessions, snake-draft, lobbies, earnings — other collections).

**Proposed §4 eligibility matrix** (columns: PARTICIPATION | PERFORMANCE | PLACEMENT | COMPLETION | receipt):

| Terminal state (as it exists in code) | PART | PERF | PLACE | COMPL | Receipt |
|---|:--:|:--:|:--:|:--:|---|
| `completed` — casual/tiered (result set) | ✅ | ✅ | N/A (no group) | ✅ | award |
| `completed` — tournament (`tournament_group_scored`) | ✅ | ✅ | ✅ (group placement) | ✅ | award |
| `completed` — stale-sweep (`completionReason:'expired'`, **no scoring**) | ⚠ **OPEN** | ⚠ | ⚠ | ⚠ | ⚠ — treat as abandoned/no-contest? (see below) |
| `abandoned` *(spec row — NO code source)* | ✅ | ✅ | per-matrix | ❌ | award (reduced) — **requires new terminal transition** |
| `forfeit` *(spec row — NO code source)* | ✅ | ✅ | per-matrix | ❌ | award (reduced) — **requires new terminal transition** |
| `no-contest` *(spec row — NO code source)* | ❌ | ❌ | ❌ | ❌ | zero-value receipt (`quarantined`) — **requires new terminal transition** |

**Two things the founder/P1 must settle:** (1) the `completionReason:'expired'` stale-sweep completes with stale/partial `scoreState` and no settlement — it must **not** silently take the full `completed` row (that would award XP for a substantively-abandoned battle); route it to a zero/no-contest receipt or exclude it. (2) A zero-trade, never-evaluated battle currently still becomes plain `completed` — there is **no discriminator** in the schema to distinguish "abandoned" from "completed," so any `abandoned` row needs a new signal (e.g. a `tradeCount`/`evaluationCount` threshold) or a new terminal transition.

### S11.9 — Score distribution → constants proposal — ⚪ Deliverable (ALL constants ASSUMED)
- The calibration input is **`scoreState.currentScore`** = `activeScore + bankedScore + bankedBadgePoints` (`agent-evaluate.js:707`), a sum of per-asset `round(priceChange% × 10 × tierMult + badge)` (`agentScoring.js:270/296`). It is **~0-centered, unbounded, negatively skewed** (badges asymmetric +15/+30/+50 vs −10/−20/−35, `baggerBombScoring.js:33`; conviction mult star2.0/core1.5/support1.0, `:56`). Recoverable per-battle per-archetype (Discovery A2). **[VERIFIED]**
- **No score distribution exists in-repo.** The only quantified inventory is **22 `agentBattles`, all Mar–May 2026 (pre-Jul-18)**; `seasonEntries`≈4 (`CALIBRATION_DATA_DISCOVERY_REPORT.md:16`). A read-only export tool already exists (`scripts/calibration/export-agent-battles.js`). The Jul-18 cohort seam is real (`scripts/canonical-open-baseline-census.js:29` `DEFAULT_SINCE='2026-07-18…'`). **[VERIFIED]**
- **Must come from the founder / live export** (before any constant is locked): the empirical distribution of `scoreState.currentScore` for **completed** battles — per archetype, per mode, **split at 2026-07-18** — as p10/p25/median/p75/p90/max, plus the fraction ≤0 (drives median PERFORMANCE), plus human/CPU census, plus whether enforce-mode shifts the post-Jul-18 shape.
- **First-cut proposal — ALL ASSUMED / PLACEHOLDER** (calibrate `k`/`CAP`/`f` against the live export): `PARTICIPATION=25`; `PERFORMANCE=clamp(round(currentScore×k),0,CAP)`, `CAP=60`, `k≈0.5` placeholder; `PLACEMENT` 1v1-human-win=30, `min(30×humansOutplaced,60)`, `CPU_PLACEMENT=8`; `COMPLETION=20`; `MODE_MULT` ranked/league 1.0 / training 0.6 *(spec-fixed)*; `rateBand` 1.0/0.5/0 *(spec-fixed)*. Sanity vs acceptance matrix: (a) ranked 1v1 win ≈ 25+45+30 = 100 ✅ *(needs live k)*; (b) max training ≈ 81 < 100 ✅; (e) CPU-pod 1st (8) < 1v1 win (30) ✅. **⚠ Tension (d):** an idle **multi-day** battle that merely runs to term collects `COMPLETION` → 25+0+8+20 = 53 > 40% of median — so **`COMPLETION` should be gated behind a minimum-activity / `PERFORMANCE>0` predicate**, or `COMPLETION`/`PARTICIPATION` lowered. Ship as a versioned formula module; if pre/post-Jul-18 cohorts differ materially, version the performance mapping rather than blending one `f()`.

### S11.10 — agentProgression consumers / equip+kernel sites / epoch home / concurrency — ⚪ Info + platform finding
- **`agentProgression.js` consumers:** exactly **one server** consumer — `api/agent/equip-bundle.js:35` (`getAgentLevel`, `FORGE_LIMITS`). Everything else is client UI (`useAgent.js:9`, `forgeService.js:10-11`, `AgentRecordSheet.jsx:27`, `MyBundlesTab.jsx:10`, `DiscoverTab.jsx:17-18`, `IdentityPanel.jsx:23`, `OpenChatPanel.jsx:6`, `CollectionDetailSheet.jsx:9` + 3 `.ARCHIVED`). Server retirement blast-radius = 1 file. **[VERIFIED]**
- **Equip chokepoint + revalidation kernel (the L3 dual anchor):** write at `api/agent/equip-lean.js:110/167` (`runTransaction` → `txUpdateAgentSettings`); clamp at `api/_utils/leanRevalidation.js` `revalidateStandingLeans` (`:106`, `OVER_CAP` at `:161`). Kernel is inserted into battle creation via `buildCustomizationSnapshot` spread at the **fenced** `agentBattleService.js:183` (import at `:20`), and shared by `agentPromptAssembly.js:153`, `change-archetype.js:229`, client `src/data/characterState.js:74`. **All edit targets are non-fence** as long as logic stays in `leanRevalidation.js` and the `createAgentBattle` call site is untouched. **[VERIFIED]** *(Note: the workflow originally cited `src/utils/characterState.js`; the correct path is `src/data/characterState.js:74` — content accurate.)*
- **Epoch-registry storage home:** **none exists.** Feature flags are compile-time code constants (`src/config/featureFlags.js:13`), not runtime docs. Closest precedents for a server-write-only doc: `indexIntelligence` singletons (`firestore.rules:444`) and the per-battle append-only `controlEpochLog` via `arrayUnion` (`controlSuppressionTelemetry.js:234`). The registry is **greenfield** storage. **[VERIFIED]**
- **⚠ Platform finding — no real concurrency control:** deploy "lock" is a **non-atomic** read-then-write TTL flag (`decide.js:148/165`, TOCTOU; stale >120s ignored); one-active-battle guard is a **non-transactional** query-then-create (`decide.js:535`); `completeBattle` is a plain update with **no write-once guard** (`agent-evaluate.js:3581`) even though the codebase already documents and solves the lock-steal race for `regimeAtStart` (`:983` `LOCK_TIMEOUT 120s` < `:101` budget `290s`; solved at `:991`). **[VERIFIED]** **This is a hard constraint on §5:** the `masteryAward + masteryProfiles` increment MUST use the in-txn re-read / write-once pattern, or a stolen-lock overlap will **double-increment** the profile.

### S11.11 — Fence check on every write target — 🔴 STOP
- **Non-fence (good):** completion/eligibility stamp host `agent-evaluate.js` (cron); equip dual anchor `equip-lean.js` + `leanRevalidation.js`; Forge server-enforcement `reforge-bundle.js:95` / `equip-bundle.js:108` + `FORGE_LIMITS` in `src/constants/agentProgression.js`; new collections (not code files). Slot-key fields already authored at creation, so **no edit to fenced `agentBattleService.js` is required.** **[VERIFIED]**
- **Fence contact (STOP):** the two `agentBattles`→`'completed'` writes at **`api/agent/decide.js:588` and `:1115`** are terminal transitions. §5.1 wants the eligibility stamp at every first-commit of `status:completed`; extending them = writing into a **fence file**. The finder's CLEAR verdict **missed these**; the adversarial verifier and all three critics overturned it to **STOP**. **[VERIFIED]** → Resolution folded into **STOP-A** (recommend scoping expiry-sweeps out of mastery XP, no fence edit).
- **Correction to the finder's map (VERIFIED):** the slot-stamp / first-eval-tick host was mis-cited at `agent-evaluate.js:513`, which is actually a **schema-migration backfill** (`migrationFields`, `:505-514`). The true write-once `masterySlot` tick host is **not yet located** — a Phase-0 residual (below).

---

## Phase-0 residuals — unenumerated build-write hosts (from the completeness critics)

These are net-new write surfaces the spec introduces that Phase 0 could not anchor to an existing `file:line` because the code does not exist yet (a repo-wide grep returns **zero** `mastery*` references). They are not STOPs, but P1 must pin each host so a follow-up fence check can certify them:
1. **`masteryAward` writer + `masteryProfiles` increment** (§5 "award, one transaction") — no host located. Must be a **non-fence** cron/module and must carry the write-once/idempotency guard (per the §10 concurrency finding).
2. **`masterySlot` write-once stamp** — true first-eval-tick host unlocated (the cited `:513` is a migration backfill). Must acquire the same in-txn guard against the steal-able 120s eval lock.
3. **Repair-sweep host cron** (§5.3) — unnamed. Natural candidate: `api/cron/process-pending-reflections.js` (already polls `agentBattles where status=='completed'`, `:14`).
4. **Quarantine-ledger writer** (§4 fail-closed sink) — no producing branch located.
5. **Epoch-registry append writer + seed path** (§5.4) — storage home absent; writer/cadence unenumerated (mirror `controlEpochLog` `arrayUnion` shape; house as an `indexIntelligence`-style server-write-only singleton).
6. **`masteryProfiles` owner-read rule** — needed for the §10 surface (catch-all currently denies client reads).
7. **`masteryCorrections` writer** — named as a new collection; no write site.

---

## Found outside task (BUILD_RULES §3 — reported for separate tasking, NOT fixed)

1. **Unsettled expiry completions in `decide.js`.** `decide.js:588`/`:1115` force-complete an expired battle (`completionReason:'expired'`) with **no scoring, no stats, no reflection, no `resolveCompletionDisposition`** — a second completion writer that bypasses the entire settlement path and can race the cron's `completeBattle` (double-completion). Pre-exists the mastery build; flagged for its own audit.
2. **Stale cross-archetype bundles on archetype switch.** `change-archetype.js` invalidates standing leans (`:229`) but performs **no** invalidation/re-scope of forged bundles, leaving stale cross-archetype bundles equipped after a switch. Latent, independent of mastery.
3. **No single-flight across cron invocations.** Eval lock (120s) < run budget (290s) is a documented lock-steal window (`agent-evaluate.js:983`); `completeBattle` lacks the write-once guard the `regimeAtStart` path has. Pre-existing race; also a hard constraint on the P1 award design.

---

## Hard STOP

Phase 0 is **read-only and ends here** (BUILD_RULES §3). **No project state was modified.** The gate returns **three founder decisions** — STOP-A (completion transactionality + fenced `decide.js` completions), STOP-B (Forge bundle archetype-keying + §6.1 line 95↔97 contradiction) — plus the §8 matrix, §9 constants-data request, §10 concurrency constraint, and the Phase-0 residual write-host census above. **No P1 code should be written until STOP-A and STOP-B are ruled on.**

*Anchors verified at HEAD `39efa66`; re-verify before relying (lines drift — BUILD_RULES §3).*
