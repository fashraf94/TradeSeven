# Firestore Rules Hardening — Phase 0 Discovery Findings (`agents` collection)

**Date:** July 15, 2026
**Type:** DISCOVERY — READ-ONLY. No rule file edited, no Console touched, nothing deployed.
**Repo state:** `main` @ HEAD `7e9b9624` · branch `claude/firestore-rules-discovery-2uazsb` · clean tree · `git fetch origin` run at session start (BUILD_RULES §3).
**Deliverable:** this findings report + a proposed `firestore.rules` diff (§7) that is **NOT applied**. Flash reviews, emulator-tests, then publishes manually via Console.
**Method note:** claims below carry `path:line` citations and a VERIFIED/INFERRED marker (index in §9). Enumerations were produced by a fan-out of parallel read-only investigators and then re-verified by hand on the load-bearing points (the current rule, the settingsRev mechanism, the endpoints' Admin-SDK usage, and the `stats` dead-code finding).

---

## 1. Executive summary — the go/no-go headline

| Question | Verdict |
|---|---|
| **Is the hypothesis confirmed** (owner can update *any* field on `agents` via the raw client SDK)? | ✅ **CONFIRMED.** `firestore.rules:149-150` gates `allow update` on ownership only — no field allowlist. |
| **Is a clean field-allowlist achievable without breaking any legitimate client write?** | ✅ **YES.** An adversarial sweep of every live client write to the `agents` doc found **zero** that a tight allowlist would break (`broken_writes = []`, two independent verifiers). |
| **Is there a live, exploitable hole today?** | ⚠️ **YES — one:** the `stats` (win/loss/streak) record is client-writable and feeds the leaderboard. The proposed allowlist **closes it** at zero cost (see below). |
| **Does the fix touch fenced code (BUILD_RULES §1)?** | ✅ **NO.** This is a `firestore.rules` change only. No fenced file is edited; the scoring engine and `createAgentBattle` shape are untouched. |
| **First-publish recommendation** | **GO** — scope the first publish to the `agents` **`allow update`** rule only. Emulator-test first (§5), capture the live Console ruleset for rollback first (§5.3). |

**The one-paragraph version for Flash:** Today, any signed-in user can reach into *their own* agent document and overwrite *any* field directly from the browser — including the win/loss record the leaderboard ranks on, and the customization fields (leans, dials, archetype, equipped bundles) that the Release-2 server endpoints carefully validate and `settingsRev`-stamp. The app's own JavaScript refuses those writes, but that's honest-client-only; a hand-crafted client ignores it. The fix is a five-word allowlist that says "a client may only touch these five harmless fields; everything else must go through the server." We verified this breaks **nothing** the real app does, because every guarded field is already written server-side (which bypasses these rules), and the one client function that writes `stats` is **dead code with no callers**. So the allowlist is a pure tightening with no downside. It is not yet applied — it's proposed in §7 for you to emulator-test and publish by hand.

---

## 2. Q1 — the current rule, verbatim, + the field-by-field table

### 2.1 The current `agents` rule (VERIFIED, `firestore.rules:145-199`)

```
match /agents/{agentId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
                && request.resource.data.ownerId == request.auth.uid;
  allow update: if request.auth != null
                && resource.data.ownerId == request.auth.uid;      // ← owner-can-write-ANYTHING
  allow delete: if request.auth != null
                && resource.data.ownerId == request.auth.uid;
  // ... rules/{ruleId}, bundles/{bundleId}, battlePatterns/{patternId} subcollections ...
}
```

**What it permits today:** any authenticated user whose uid equals the doc's `ownerId` may update the doc with **no field restriction whatsoever**. There is **no** partial field-gating on the agent document itself (contrast `agentBattles` at `firestore.rules:210-211` and `seasonEntries` at `558-559`, which already use the `diff().affectedKeys().hasOnly([...])` allowlist pattern — the exact pattern proposed here). **VERIFIED.**

### 2.2 Field-by-field integrity table (client-governed vs Admin-SDK vs both)

Anchored on the `createAgent` doc literal (`src/services/agentService.js:95-134`, a client-SDK `addDoc`) and cross-referenced against all `api/` Admin-SDK writers and `src/` client-SDK writers.

**Legend:** *Client* = written by the Firebase client SDK → **governed by these rules**. *Server* = written by `firebase-admin` in an `api/` endpoint → **bypasses these rules entirely**. Integrity = feeds a scored outcome / battle snapshot / equip gate / `settingsRev`.

| Field | Written by | Integrity? | Client write ref | Server write ref | Notes |
|---|---|---|---|---|---|
| `standingLeans` | **Server only** | ✅ | — | `equip-lean.js:167`, `unequip-lean.js:86` | Not in create shape. Guarded (`agentService.js:157`). |
| `dials` (`.tempo`) | **Server only** | ✅ | — | `set-tempo-dial.js:89` | Not in create shape. Guarded. |
| `settingsRev` | **Server only** | ✅ | — | `agentSettingsTx.js:21` (`FieldValue.increment(1)`) | Not in create shape; absent→treated as 0. Guarded. |
| `archetype` | Both (client seeds) | ✅ | `agentService.js:98` (create) | `change-archetype.js:110` | Guarded post-create. |
| `config` | **Create-only** | ✅ | `agentService.js:100` (create) | — (no server writer) | Frozen after create. Guarded. |
| `activeRules` | Both (client seeds `[]`) | ✅ | `agentService.js:109` (create) | `decide.js:217`, `equip-bundle.js:151`, `unequip-bundle.js:116` | Guarded post-create. |
| `equippedBundleIds` | Both (client seeds `[]`) | ✅ | `agentService.js:110` (create) | `equip-bundle.js:151`, `unequip-bundle.js:116` | Guarded post-create. |
| `equippedTraits` | **Server only** | ✅ | — | `update-agent-settings.js:183` | Not in create shape. `useTraits.js:87` persists via the server endpoint, not a direct write. |
| `equippedWatchlistId` / `Name` | Both (client seeds) | ✅ | `agentService.js:117-118` (create) | `equip-watchlist.js:102`, `unequip-watchlist.js:68` | Guarded post-create. |
| `equippedAt` | Both (client seeds) | ✅ | `agentService.js:119` (create) | `equip-watchlist.js:102`, `unequip-watchlist.js:68` | Only ever written alongside guarded `equippedWatchlist*`. |
| `deployedStrategy` | **Server only** | ✅ | — | `update-agent-settings.js:183` (via `deployStrategyService.js:183`) | Not in create shape. Guarded. |
| `consolidatedInsight` | Both (client seeds `''`) | ✅ | `agentService.js:107` (create) | `agentConsolidationApply.js:267` | Guarded post-create. |
| `activeBattleId` | **Server only** | ✅ | — | `decide.js:553/700/1104/1164`, `agent-evaluate.js:3159` | The equip-gate key (endpoints throw `battle_active` when set). Guarded. |
| **`stats`** | **Both — see §3.3** | ✅ | `agentService.js:121` (create), **`:294` (dead — no callers)** | `agent-evaluate.js:3148` (authoritative) | **The one live hole.** Leaderboard sorts on `stats.wins` (`agentService.js:81`). |
| `standingLeansInvalidated` | **Not persisted** | ✅ (derived) | — | — | Computed into the battle snapshot only (`agentBattleService.js:177`); never written to the agent doc. |
| `memory` | Both (client seeds `[]`) | ➖ indirect | `agentService.js:106` (create), `:256` `addMemoryReflection` | `reflect.js:223` | Not guarded. Coaching reflections (cap 5). |
| `directives` | **Client only** | ➖ legacy | `agentService.js:108/201/211/224/234` | — | Server **stopped** writing it (`chat.js:640-644`, Phase 7 → battle-scoped). Not guarded. Live callers: `OpenChatPanel.jsx:89`, `useAgent.js:165/174`. |
| `lastViewedEvolutionCycle` | **Client only** | ❌ | `agentService.js:268` | — | UX read-state marker. Not guarded. |
| `starterKitCompleted` | **Client only** | ❌ | `agentService.js:120` (create), `:172` via `StarterKit.jsx:380/483` | — | The one cosmetic flag the client `updateAgent` guard still allows. |
| `evolutionCycle` | Both (client seeds `0`) | ❌ | `agentService.js:130` (create) | `agentConsolidationApply.js:267` | Display counter. No live client *update* writer. |
| `name`, `personality`, `avatarColors`, `primaryColor`, `archetypeDrift` | **Create-only** | ❌ | `agentService.js:97/101/102/105/99` | — | Cosmetic/identity. No live client *update* writer. |
| `ownerId` | **Create-only** | ❌ (auth key) | `agentService.js:96` | — | Ownership key. Must remain immutable. |
| `createdAt` | Create-only | ❌ | `agentService.js:131` | — | Timestamp. |
| `updatedAt` | Both | ❌ | `agentService.js:132/174` | every settings tx | Bookkeeping timestamp; stamped by every client writer. |
| `lastDeployedAt` | Both | ❌ | `agentService.js:133` (create) | `decide.js:514/1078` | Deploy timestamp. |
| `traits`, `watchlist` (top-level) | **Do not exist** | — | — | — | No such top-level fields. The real slots are `equippedTraits` / `equippedWatchlistId`. |

**The shape of the finding:** every integrity-relevant field is either (a) **absent from the create literal and written only by an Admin-SDK endpoint** (`standingLeans`, `dials`, `settingsRev`, `equippedTraits`, `deployedStrategy`, `activeBattleId`), or (b) **seeded by the client at create then only ever mutated server-side** (`archetype`, `activeRules`, `equipped*`, `consolidatedInsight`, `config`). The lone exception is **`stats`** (§3.3).

---

## 3. Q2 — the legitimate client write paths (the false-tightening guard) + the conflict cases

### 3.1 Every live client-SDK write to the `agents/{agentId}` document

This is the complete set the tightening must not break. `affectedKeys()` is **top-level** — a write to `stats.wins` registers key `stats`; an `arrayUnion` on `directives` registers `directives`.

| # | Function | `agentService.js` line | Op | Top-level key(s) written | Live? |
|---|---|---|---|---|---|
| 1 | `createAgent` | 136 | `addDoc` (**create**) | full doc shape | ✅ — governed by `allow create`, **not** the update allowlist |
| 2 | `seedTestAgent` | 523 | `addDoc` (**create**) | partial shape | ⚠️ dev/seed utility — `allow create` |
| 3 | `addDirective` | 201 | `updateDoc`+`arrayUnion` | `directives`, `updatedAt` | ✅ (`OpenChatPanel.jsx:89`, `useAgent.js:165`) |
| 4 | `removeDirective` | 211 | `updateDoc`+`arrayRemove` | `directives`, `updatedAt` | ✅ (`useAgent.js:174`) |
| 5 | `toggleDirective` | 224 | `updateDoc` | `directives`, `updatedAt` | ➖ no caller found; key already covered |
| 6 | `pinDirective` | 234 | `updateDoc` | `directives`, `updatedAt` | ➖ no caller found; key already covered |
| 7 | `addMemoryReflection` | 256 | `updateDoc` | `memory`, `updatedAt` | ➖ no caller found; non-scored |
| 8 | `markEvolutionCycleViewed` | 268 | `updateDoc` | `lastViewedEvolutionCycle`, `updatedAt` | ➖ no caller found; non-scored |
| 9 | **`updateAgentStats`** | 294 | `updateDoc` | `stats`, `updatedAt` | ❌ **DEAD — zero callers repo-wide** (see §3.3) |
| 10 | `updateAgent` | 172 | `updateDoc` | `starterKitCompleted`, `updatedAt` | ✅ (`StarterKit.jsx:380/483`; only field ever passed) |

The `agentService.js` writers at lines **534-615** target the **`agentBattles`** collection (`BATTLES_COLLECTION`), **not** `agents` — out of scope for this rule. Forge subcollection writers (`agents/{id}/rules`, `agents/{id}/bundles`) are governed by their **own** match blocks (`firestore.rules:156-191`), not the agent-doc update rule. **VERIFIED** by a full-`src/` sweep (two independent adversarial verifiers, `broken_writes = []`).

### 3.2 Which guarded mutations already route through server endpoints (Admin SDK)

All of them. Every customization/settings write goes through a `fetchWithAuth` thin-client → an `api/agent/*` endpoint that uses `getFirebaseAdmin()` + `runTransaction` and routes its agent-doc write through the shared `txUpdateAgentSettings` helper (`agentSettingsTx.js`). Admin SDK **bypasses these rules**, so denying these fields to the client changes nothing for legitimate flows.

| Endpoint | Admin SDK | Client caller (thin-client) | Fields written | Bumps `settingsRev`? |
|---|---|---|---|---|
| `equip-lean.js` (dark-inert) | ✅ `:34/104/110` | `agentService.js:421` ← `CharacterArea.jsx:160` | `standingLeans` | ✅ `:167` |
| `unequip-lean.js` (dark-inert) | ✅ `:14/64/70` | `agentService.js:433` ← `CharacterArea.jsx:161` | `standingLeans` | ✅ `:86` |
| `equip-bundle.js` | ✅ `:29/82/89` | `forgeService.js:555` ← `useForge.js:560` | `equippedBundleIds`, `activeRules` | ✅ `:151` |
| `unequip-bundle.js` | ✅ `:20/66/73` | `forgeService.js:577` ← `useForge.js:590` | `equippedBundleIds`, `activeRules` | ✅ `:116` (heal path deliberately skips) |
| `equip-watchlist.js` | ✅ `:20/64/71` | `agentService.js:340` ← `EquipStation.jsx:170` | `equippedWatchlist*`, `equippedAt` | ✅ `:102` |
| `unequip-watchlist.js` | ✅ `:13/49/55` | `agentService.js:353` ← `EquipStation.jsx:171` | `equippedWatchlist*`=null | ✅ `:68` |
| `set-tempo-dial.js` (dark-inert) | ✅ `:21/69/75` | `agentService.js:450` ← `CharacterArea.jsx:171` | `dials.tempo` | ✅ `:89` |
| `change-archetype.js` | ✅ `:19/80/86` | `agentService.js:373` ← `ArchetypePicker.jsx:142` | `archetype` | ✅ `:110` |
| `update-agent-settings.js` | ✅ `:35/155/161` | `agentService.js:388` ← `useTraits.js:87`, `deployStrategyService.js:183` | `equippedTraits`, `deployedStrategy` | ✅ `:183` |

*(`create-profile.js` is an LLM archetype-derivation endpoint — no Firestore write, no Admin SDK; the client persists the agent doc separately. Not an agents-doc writer.)* **VERIFIED.**

### 3.3 The critical question — is there ANY field the client both (a) writes directly AND (b) we want to guard?

**Exactly one candidate: `stats`. And it resolves cleanly to "deny it."**

- The client function that writes `stats` directly is `updateAgentStats` (`agentService.js:274-306`, raw `updateDoc` of the full `stats` object).
- **It has ZERO callers.** A repo-wide search (`src/`, `api/`, `scripts/`) for `updateAgentStats(` returns only its own definition. The `updateAgentStats` tokens in `api/cron/agent-evaluate.js:3007/3019/3127` are a **different symbol** — a boolean property `disposition.updateAgentStats` gating the **server-side** stats write; the comment at `agent-evaluate.js:3121` literally calls it "server-side equivalent of client `updateAgentStats`." **VERIFIED.**
- The **authoritative** `stats` writer is server-side: `agent-evaluate.js:3148` (Admin SDK, on battle completion, bypasses rules).

**Therefore `stats` is not a true conflict case.** It looks like one (a client-writable, leaderboard-scored field), but the client writer is unreachable dead code. **Denying `stats` in the allowlist breaks no live path and closes the leaderboard-forgery hole** (a hand-crafted client `updateDoc({stats:{wins:9999}})` is permitted *today* and would be *denied* after the fix). This is the single highest-value line in the proposed diff.

> **Follow-up tasking (BUILD_RULES §3 — reported, not fixed):** the dead `updateAgentStats` export (`agentService.js:274-306`) should be deleted, or if a client-side stats path is ever revived it must go through a server endpoint — **never** be re-added to this allowlist. Flagged for separate tasking.

**No other conflict cases exist.** Every remaining guarded field (`config`, `archetype`, `activeRules`, `equipped*`, `standingLeans`, `dials`, `settingsRev`, `deployedStrategy`, `consolidatedInsight`, `activeBattleId`) has **no** live client-SDK writer — the client's own `SETTINGS_GUARDED_FIELDS` denylist (`agentService.js:155-169`) already refuses them in JS, and the real writes are all server-side. Denying them at the rules layer is a pure no-op for legitimate traffic.

---

## 4. Q3 — `settingsRev` monotonicity in rules: feasible, but unnecessary here

**Q3.1 — Can a rule enforce `request.resource.data.settingsRev > resource.data.settingsRev`?**
**Feasible: YES.** `settingsRev` is a plain integer — it materializes via `FieldValue.increment(1)` (`agentSettingsTx.js:21`) and is read numerically (`useAgent.js:115`, `leanRevalidation.js:220`). A rule *can* express the `>` comparison. **VERIFIED.**

**But it is not needed in this design, and should not be added.** Every `settingsRev` writer is server-side Admin SDK and strictly `+1` (nine endpoints funnel through `txUpdateAgentSettings`, plus two admin backfills in `scripts/rule-compat-cleanup.js:182/199`). **There is not a single client-SDK writer of `settingsRev`** — `any_client_sdk_writer = false`, `any_nonincreasing_update_writer = false`. **VERIFIED.**

Because the client never writes it, the correct rule treatment is simply to **exclude `settingsRev` from the client allowlist** — making it client-immutable. The Admin SDK (which bypasses rules) owns the monotonic increment. This is strictly simpler and safer than an in-rule `>` comparison.

**Q3.2 — Does any legitimate writer set `settingsRev` non-monotonically (initializer/migration)?**
**No.** `settingsRev` is **absent from the create shape** (`createAgent:95-134`, and the Admin-SDK `buildCpuAgentDoc`/`buildTrainingCloneDoc` also omit it) — it first materializes as `1` on the first server increment; readers default missing→0. No migration/backfill writes a fixed value; every write is `increment(1)`. **VERIFIED.**

> **Caveat if a `>` rule were ever wanted** (it is not, for the client path): because `settingsRev` is absent on create, `resource.data.settingsRev` is undefined on the first update, so a strict `>` rule would need `(!('settingsRev' in resource.data) || request.resource.data.settingsRev > resource.data.settingsRev)`. Excluding the field from the allowlist sidesteps this entirely. This is the one field where the rule *could* do active validation; the recommendation is that it does **allow/deny only**.

---

## 5. Q4 — emulator test plan, observability watch, rollback confirmation

### 5.1 Emulator test plan (the harness already exists)

`@firebase/rules-unit-testing@^5.0.1` is **already a devDependency** (`package.json:49`); the test runner is **vitest**; `firebase.json` points at `firestore.rules`. No new install needed — a rules test file is the only missing piece. Recommended file: `firestore.rules.test.js` (new; not part of this read-only deliverable).

Test matrix to run against the **proposed** ruleset before publishing:

**A. Legitimate client updates — MUST PASS (owner, uid == ownerId):**
1. `update({ starterKitCompleted: true, updatedAt })` — StarterKit path.
2. `update({ directives: [...], updatedAt })` — coaching/directive add/remove.
3. `update({ memory: [...], updatedAt })` — reflection append.
4. `update({ lastViewedEvolutionCycle: 3, updatedAt })` — evolution read-marker.
5. `update({ updatedAt })` alone.

**B. Attack / guarded writes — MUST be DENIED (owner, raw SDK bypassing the JS guard):**
6. `update({ stats: { wins: 9999 } })` — **the leaderboard-forgery attack.**
7. `update({ settingsRev: 999 })` — forge the race-safety counter.
8. `update({ standingLeans: [...] })` / `{ dials: { tempo: 'blitz' } }` — bypass equip gates.
9. `update({ archetype: 'x' })` / `{ activeRules: [...] }` / `{ equippedBundleIds: [...] }` — bypass version-binding.
10. `update({ deployedStrategy: {...} })` / `{ consolidatedInsight: 'x' })` / `{ config: {...} }`.
11. `update({ ownerId: <attacker uid> })` — ownership reassignment (denied: not in allowlist).
12. `update({ starterKitCompleted: true, archetype: 'x' })` — **mixed** legit+guarded (must be denied *as a whole* — `hasOnly` fails if *any* key is off-list).

**C. Cross-owner — MUST be DENIED:** any of A performed by a non-owner uid.

**D. Create path — MUST still PASS:** `create(full createAgent shape)` by the owner (the proposed diff does **not** touch `allow create`).

Assert PASS on A/D, DENY on B/C. (Admin-SDK writes bypass rules and cannot be exercised through the emulator's rules layer — their correctness is established separately by the endpoint tests already in `api/agent/*.test.js`.)

### 5.2 Observability watch (rules are global-on-publish)

A false tightening surfaces as **client-side `permission-denied` exceptions** on `updateDoc`. Within minutes of publish, watch:
- **The coaching/directive surface** (`OpenChatPanel`, `useAgent.js:165/174`) and **StarterKit skip/forge** (`StarterKit.jsx:380/483`) — these are the only live client writers the allowlist must keep working. Manually exercise each right after publish.
- **`errorLogs`** (`firestore.rules:390-396`, written by the ErrorBoundary) and browser-console `permission-denied` rates — the `agentService.js` writers all `console.error` on failure (`:177`, etc.).
- **Equip / dial / archetype flows** — these go through Admin-SDK endpoints and should be *unaffected*; confirm they still succeed (a regression here would indicate an unrelated problem, not this rule).
- **The leaderboard** — confirm normal `stats` still render (they are server-written and unaffected by denying the client path).

If any legit write starts throwing `permission-denied`, roll back immediately (§5.3) — the blast radius is global and there is no per-user scoping.

### 5.3 Rollback confirmation

- **The prior ruleset IS in version control** (`firestore.rules` @ `7e9b9624`), so the pre-publish state is recoverable, not only live in the Console. **VERIFIED.**
- **Rollback = re-publish the prior ruleset** via Console. Reverting is a single Console publish of the known-good file.
- **⚠️ Pre-publish drift check (do this first).** `firestore.rules` in the repo is the *intended* source, but I **cannot verify it matches the deployed Console rules** — this session has no Console access (**INFERRED**). Before publishing, **copy the current live Console ruleset into a file** (e.g., `firestore.rules.console-backup-2026-07-15`) so rollback restores exactly what was live, and **diff it against the repo `firestore.rules`**. If they differ, the repo file has drifted from Console — reconcile before publishing, or you may silently revert unrelated Console-only edits. This drift risk is itself a finding (see §6).

---

## 6. Q5 — collection scope + explicit out-of-scope

### 6.1 In scope for the FIRST publish — the `agents` `allow update` rule only

The `agents` doc is **the only live, exploitable, directly-scored owner-can-write-anything gap** (via `stats`). Fix it first; everything below is follow-up.

### 6.2 Sibling collections — the scan (recommend follow-up, not first publish)

| Collection | Rule | Pattern | Live gap? | Recommendation |
|---|---|---|---|---|
| **`agents`** | `145-153` | owner-can-write-anything | ✅ **live** (`stats`) | **FIRST PUBLISH (§7).** |
| `agentBattles` | `203-214` | field-allowlist | ❌ (correctly excludes scored fields) | **Follow-up (functional bug, not integrity):** the `hasOnly` list *misses* two live client writes — `livePriceBeacon` (`AgentBattleScreen.jsx:523`) and `portfolio.startingPrices` (`App.jsx:6567`) — so both are **silently denied** (fire-and-forget `.catch`). Blocking `portfolio.startingPrices` is integrity-*good* (it's the scoring baseline) — so **delete those dead client writes or move them to Admin SDK; do NOT add `portfolio.startingPrices` to the allowlist.** |
| `agents/{id}/rules` | `156-182` | partial field-validation | ❌ | Follow-up hardening — bounds already enforced on the sensitive fields; optionally convert to strict `hasOnly`. No live scored-field write. |
| `agents/{id}/bundles` | `185-191` | owner-can-write-anything | ❌ | Follow-up (defense-in-depth) — owner's own compiled strategy snapshots, scored server-side; no injectable score field today. |
| `agents/{id}/battlePatterns` | `194-198` | server-only (`write:false`) | ❌ | No action. |
| `draftUserStats` | `217-221` | owner-can-write-anything | ⚠️ latent | Follow-up — a live client writer (`draftAnalyticsService.js:386`) writes self-reported draft tallies/badges. Lower severity (personal stats, no evidence they feed a competitive ranking). Move to Admin SDK or allowlist. Elevate only if a leaderboard reads it as authoritative. |
| `battles` / `challenges` / `drafts` / `snakeDraft*` | Tier 3 | open-authenticated | ⚠️ pre-existing | Follow-up — any authed user can update any doc incl. scored PvP state. This is the **pre-existing multiplayer design** (Tier 3, `firestore.rules:255-259`), a larger architectural change (participant-scoped writes + server-authoritative scoring), **not** the customization risk in scope here. |
| `trainingBattles` | `98-110` | open-authenticated (beta) | ❌ | Follow-up — single-user practice, not a tournament ranking; tighten `update` to creator once beta stabilizes. |

### 6.3 Explicitly OUT of scope (confirmed)

- **Not** an auth-model redesign — this is field-allowlisting one existing `allow update` rule.
- **Not** touching **read** rules (no read hole found on `agents`; reads stay `if request.auth != null`). *(Sibling read holes, if any, are a separate review.)*
- **Not** the Tier-3 gameplay open-write posture (`battles`/`challenges`/`drafts`) — real but pre-existing and architectural.
- **Not** the `decide.js` CAS (Release-4 ledger item, per the brief).
- **Not** touching `allow create` in the first publish (see §7.2 for the optional secondary hardening).
- **Not** editing any **fenced** file (BUILD_RULES §1) — this is a `firestore.rules` change; no fenced function is edited, and none needs to be called.

---

## 7. The proposed `firestore.rules` diff — NOT applied

### 7.1 Primary change — the `agents` `allow update` allowlist

Replace **only** the `allow update` clause at `firestore.rules:149-150`. Everything else in the `agents` block (read/create/delete, and all three subcollections) is **unchanged**.

```diff
     match /agents/{agentId} {
       allow read: if request.auth != null;
       allow create: if request.auth != null
                     && request.resource.data.ownerId == request.auth.uid;
-      allow update: if request.auth != null
-                    && resource.data.ownerId == request.auth.uid;
+      // Field-allowlist (Firestore Rules Hardening Phase 0, 2026-07-15).
+      // A client may update ONLY these fields directly. Every other field —
+      // config, archetype, activeRules, equipped*, standingLeans, dials,
+      // settingsRev, deployedStrategy, consolidatedInsight, activeBattleId,
+      // and stats — is written by the Admin-SDK server endpoints
+      // (equip-*, set-tempo-dial, change-archetype, update-agent-settings,
+      // agent-evaluate), which bypass these rules. Denying them to the client
+      // enforces the Release-2 settingsRev discipline at the rules layer and
+      // closes the stats leaderboard-forgery gap. ownerId is not listed, so it
+      // is immutable. Verified against every live client write path
+      // (docs/audits/2026-07-15_FIRESTORE_RULES_AGENTS_DISCOVERY.md).
+      allow update: if request.auth != null
+                    && resource.data.ownerId == request.auth.uid
+                    && request.resource.data.diff(resource.data).affectedKeys()
+                       .hasOnly(['directives', 'memory', 'lastViewedEvolutionCycle',
+                                 'starterKitCompleted', 'updatedAt']);
       allow delete: if request.auth != null
                     && resource.data.ownerId == request.auth.uid;
```

**Line-by-line justification (which line closes which hole / preserves which path):**

| Allowlisted key | Preserves (live client writer) | |
|---|---|---|
| `directives` | `addDirective`/`removeDirective` — `agentService.js:201/211` ← `OpenChatPanel.jsx:89`, `useAgent.js:165/174` | ✅ live |
| `memory` | `addMemoryReflection` — `agentService.js:256` | non-scored safety inclusion |
| `lastViewedEvolutionCycle` | `markEvolutionCycleViewed` — `agentService.js:268` | non-scored safety inclusion |
| `starterKitCompleted` | `updateAgent` — `agentService.js:172` ← `StarterKit.jsx:380/483` | ✅ live |
| `updatedAt` | stamped by every writer above | ✅ live |

| What the `hasOnly` DENIES | Why safe (no live client write breaks) | Hole closed |
|---|---|---|
| `stats` | client writer `updateAgentStats` is **dead** (§3.3); real writer is `agent-evaluate.js:3148` (Admin) | **leaderboard win/loss forgery** |
| `settingsRev` | server-only, `agentSettingsTx.js:21` (Admin) | **race-safety counter forgery** |
| `standingLeans`, `dials` | server-only, `equip-lean.js:167` / `set-tempo-dial.js:89` (Admin) | **equip-gate bypass (cap/conflict/version)** |
| `archetype` | server-only post-create, `change-archetype.js:110` (Admin) | **mid-battle archetype flip** |
| `activeRules`, `equippedBundleIds`, `equippedTraits`, `equippedWatchlist*`, `deployedStrategy` | server-only, `equip-bundle.js` / `update-agent-settings.js` (Admin) | **bundle/trait/deploy tampering, no rev bump** |
| `config`, `consolidatedInsight` | frozen/server-only; client `SETTINGS_GUARDED_FIELDS` already refuses | guarded-field write with no rev bump |
| `ownerId` + all cosmetic/create-only fields | no live client *update* writer touches them | **ownership reassignment** |

**Why `hasOnly` and not a per-field validator:** it mirrors the proven in-repo pattern at `agentBattles` (`firestore.rules:210-211`) and `seasonEntries` (`558-559`). Top-level `affectedKeys()` semantics make nested writes *more* restricted, not less (`config.risk` ≠ `config`), so no guarded top-level key can leak through a nested path.

### 7.2 OPTIONAL secondary hardening — the create path (NOT recommended for the first publish)

A residual, *lower-severity* gap: `allow create` (`firestore.rules:147-148`) is owner-gated but **not** field-validated, so a crafted client could create a *new* agent with forged `stats`/`config` at birth (a new random doc id — it cannot inflate an *existing* agent). If Flash wants to close this in the same publish, an optional clause could assert the scored fields are absent-or-zero at create:

```
// OPTIONAL — only if create-side stats forgery is a concern. Verify against
// seedTestAgent (agentService.js:523) demo stats before shipping; CPU/training
// creates are Admin-SDK and bypass this rule.
allow create: if request.auth != null
              && request.resource.data.ownerId == request.auth.uid
              && (!('settingsRev' in request.resource.data))
              && (!('stats' in request.resource.data)
                  || request.resource.data.stats.wins == 0);
```

**Recommendation: ship §7.1 alone first.** The create clause carries a higher false-tightening risk (it can break `seedTestAgent` and any onboarding variation that seeds non-zero demo stats) and its exploit value is marginal (a fresh zero-history agent). Treat it as a fast-follow only if a leaderboard is confirmed to admit brand-new agents' `stats` without a server pass. **Measure five times; the first publish should be the minimal, provably-safe §7.1.**

---

## 8. Recommended sequence for the founder-executed publish

1. **Capture** the current **live Console ruleset** to a backup file and **diff** it against repo `firestore.rules` (§5.3). Reconcile any drift first.
2. **Apply** the §7.1 diff to a working copy of `firestore.rules` (do not commit to `main` until verified).
3. **Emulator-test** the §5.1 matrix (`@firebase/rules-unit-testing`, already installed) — assert A/D PASS, B/C DENY.
4. **Publish** via Console. **Immediately** exercise the coaching UI + StarterKit skip (§5.2) and watch `permission-denied` rates.
5. **Rollback** = re-publish the backup captured in step 1 if any legit write fails.

---

## 9. Verified / Inferred index

**VERIFIED (read at the cited line in this session):**
- `agents` update rule is owner-only, no allowlist — `firestore.rules:149-150`.
- The allowlist pattern already exists in-repo — `agentBattles` `firestore.rules:210-211`, `seasonEntries` `558-559`.
- `createAgent` doc shape (settingsRev/standingLeans/dials/equippedTraits absent) — `agentService.js:95-134`.
- Client `SETTINGS_GUARDED_FIELDS` denylist (honest-client-only) — `agentService.js:155-169`.
- Only 2 live `updateAgent` callers, both writing `starterKitCompleted` — `StarterKit.jsx:380/483`.
- `updateAgentStats` (client `stats` writer) has **zero callers** repo-wide; the `agent-evaluate.js` hits are a different `disposition.updateAgentStats` flag; server writes `stats` at `agent-evaluate.js:3148` — `agentService.js:274`, `agent-evaluate.js:3007/3019/3121/3127/3148`.
- All 9 settings endpoints use `getFirebaseAdmin` + `runTransaction` + `txUpdateAgentSettings`; each has a live `fetchWithAuth` thin-client — endpoint table §3.2.
- `settingsRev` = Admin-only `FieldValue.increment(1)`, no client writer, strictly increasing, plain integer — `agentSettingsTx.js:11/19-22`, `scripts/rule-compat-cleanup.js:182/199`.
- `directives` has live callers; server stopped writing it — `OpenChatPanel.jsx:89`, `useAgent.js:165/174`, `chat.js:640-644`.
- `broken_writes = []` from two independent adversarial `src/` sweeps.
- Emulator harness present — `package.json:49` (`@firebase/rules-unit-testing`), `firebase.json`, vitest.
- `firestore.rules` is in version control @ `7e9b9624` (rollback source).

**INFERRED / could not verify in-session:**
- **Whether repo `firestore.rules` matches the deployed Console ruleset** — no Console access. Treated as a required pre-publish drift check (§5.3). A drift here would itself be a finding.
- `FIRESTORE_RULES_REFERENCE.md` is **stale** (last entry v4, Feb 16 2026; predates the `agents` collection rules) — the version-history doc has drifted from the live rules file. Minor documentation finding; the rules file, not the reference doc, is source of truth.
- `toggleDirective`/`pinDirective`/`addMemoryReflection`/`markEvolutionCycleViewed` had **no callers found** by grep — kept in the allowlist as zero-cost, non-scored safety inclusions (their fields are not guarded; excluding them would risk breaking a re-wired coaching/UX path for no integrity benefit).

---

**HARD STOP.** Nothing published, nothing merged, `firestore.rules` untouched. This report + the §7 proposed diff are the deliverable. Flash reviews, emulator-tests (§5.1), captures the Console backup (§5.3), then publishes §7.1 manually via Console.
