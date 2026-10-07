# Phase 0 — Pilot Record Slice (P1 Hypothesis Versions + P2 Research Record)

**Prompt:** "Phase 0 Prompt — Pilot Record Slice", Fable, 5 October 2026. **Session:** Claude Code, 7 October 2026, read-only discovery. **Branch:** `claude/phase0-pilot-records`, cut from `main` at **HEAD `8ce61c3d`** (`git fetch origin main` run first; local `main` = `origin/main` = `8ce61c3d`). **Governing spec:** `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` (blessed 24 Sep 2026), with companions `TREND_FOLLOWER_SETUP_DEFINITION_V1.md` and `MODE_TRUTH_LANGUAGE_TABLES_V1.md`. **No source edits.** The branch carries exactly two commits: the three blessed specs (Step 0) and this report.

**Evidence labels used below:** *verified source* = the line was read at HEAD `8ce61c3d` in this session (by the coordinator or by one of five read-only tracing subagents; the coordinator re-read every load-bearing anchor listed in §0.6); *test source* = read from a test file; *inference* = derived, not read; *unverified* = asserted by a document, not checked in code.

---

## Executive verdict

| # | Question | Verdict in one line |
|---|---|---|
| 0 | Step 0 and the contract digest | The three specs were **not** on `main`; they are committed byte-identical as the branch's first commit (`eafaffb9`). The committed blob of `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` hashes to the pinned value **exactly**; the Windows working-tree copy differs only by CRLF checkout. |
| Q1 | Who owns an idea? | A saved watchlist is scoped to the **player** (`userId`), not to an agent or an archetype. Its `agentId` is a write-once provenance stamp that **no code reads**. Archetype change updates the same agent document in place and never touches watchlists or the equip slot. **`hypothesisVersions` under the saved list gives partnership scope today.** One founder decision (D1) confirms it. |
| Q2 | Records vs behavior | Of ~22 required changes, **17 are record-only and fence-free**. Four touch fenced files or deploy control flow (deploy carriage, deploy admission of a due version, the `firstDeployedAt` stamp, the version-aware equip read at deploy) and belong behind `PILOT_JOURNEY_MODE`. The parse-binding repair is its own flip. Two items do not classify cleanly and are flagged. |
| Q3 | The idea's path | All six "at HEAD" claims **confirmed**, with corrections: the parse field is `timeHorizon`; the tournament deploy branch passes **`equippedWatchlist: null`**, so the frozen snapshot and its hash exist only on the self-select path; deploy is a battle-creation transaction **followed by** a separate agent write, not one transaction. |
| Q4 | Who else reads the records | 24 server files and 27 client files read the equipped watchlist or the config hash; **every one reads named keys**, so a sibling `equippedHypothesis` field is byte-identical-inert for all of them. The versioned ref plugs into **one function**, `resolveProvenance`, which today looks for the version **inside** the hashed snapshot (contrary to spec §2.4) and must be repointed. The completed-battle projection returns the whole document to any viewer, so §2.7 needs one strip. |
| Q5 | Where transitions run | Battle creation is transactional in a **non-fenced** module; `firstDeployedAt` can stamp there. The call sweep's queue and cursor **cannot** host version rows (orphan rows are deleted, no row kind, gated on the cockpit's mode and owner allowlist). The deferred beat is **dark** at HEAD. Recommendation: a hypothesis review pass as a fifth isolated tenant of the existing reflections cron, keeping `completeBattle` untouched (Amendment B §B.7 precedent). One founder decision (D2). |
| Q6 | Research hosts and counts | Each origin's host exists with a persisted message budget; the screener persists `matchCount` per turn but **not** `universeSize` or the returned symbols; **no host persists tokens or elapsed time**, and the Gemma adapter discards provider usage. The cumulative funnel is only partly computable; the new writes are listed. The screener session id is **dropped at the client boundary**, so a screener-origin list cannot be linked to its research today. |
| Q7 | What the Command Center reads | Three queries (a player's lists, versions per list, due/active versions across lists), **one new collection-group index**, and rules copied from the `agentBattles/{id}/calls` precedent with the owner resolved through the parent's `userId`. No `watchlists` index exists today; none is needed for the per-list query. |

**Spec corrections (plan-said vs code-did):** §2.1/§2.4/§2.8 claims hold; §2.4's "both deploy branches" carry different things at HEAD (the tournament branch carries no watchlist at all, consistent with §9.2); §2.5's `completeBattle` host conflicts with Amendment B §B.7 (D2 resolves it); §2.6's versioned branch is already coded in the call writer but against the wrong location.

---

## 0. Preamble

### 0.1 Session open (BUILD_RULES §2/§3)

- Branch `claude/phase0-pilot-records`, HEAD `8ce61c3d` at open, created from local `main` after `git fetch origin main` (local and remote identical).
- Working tree at open: clean except three pre-existing untracked files not touched by this session (`docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json`, `vwap-exit-dating-census-report.json`).
- **Concurrent edits in the shared working tree:** during this session five files under `src/components/League/backing/` (`BackingDesk.jsx`, `BackingScreen.jsx`, `StakeControl.jsx`, `TeamCard.jsx`, `backingCopy.js`) became modified by another session (backing QA copy, modified at 09:29 local). They are **not part of this branch**: every commit here stages explicit paths only, and nothing was reverted. The founder should expect them on whichever branch that other session commits to.

### 0.2 Step 0 outcome

`git ls-tree -r HEAD` found none of the three documents anywhere in the tree. They were copied from the attached files into `docs/specs/` and committed as `eafaffb9` together with three rows in `docs/README.md` (after the Integrity Findings Register V2 row, existing table format). Committed-blob SHA-256 (via `git show HEAD:<path> | sha256sum`) equals each attached file's digest:

| Committed path | SHA-256 (attached = committed blob) |
|---|---|
| `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` | `26789187e96aea710534a8392a88c083b2fc05f0671ddecd5db0c731adfddd9e` |
| `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` | `a7586cd26cd2a3f6c8fd37792e8cc6ccdccf5a8860c89af01bbdae4fe1a25f90` |
| `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` | `ad83b171d596dcd74420c198dc747343a056a940ea14a77066e4bf2c1462bc6d` |

### 0.3 Contract digest check

| Object | SHA-256 |
|---|---|
| Pinned in the pilot header (§0 of the spec) | `0b7d1d2a00a087902bc5fb3f73c5fad5ee8af3e275ab2abbebed77fff80b2667` |
| `git show HEAD:docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md \| sha256sum` | `0b7d1d2a00a087902bc5fb3f73c5fad5ee8af3e275ab2abbebed77fff80b2667` — **match** |
| Working-tree file on this Windows checkout | `d92084b6fb71ab8b47500a1fc0f7b22029382e547c72ce11a834740f45e15174` — differs only by `core.autocrlf=true` CRLF conversion (`git ls-files --eol` reports `i/lf w/crlf`; 124 extra bytes = 124 lines) |

The pin is defined over the committed blob ("Committed-blob SHA-256"), which matches. No STOP.

### 0.4 Inputs found on `main` (paths cited as found)

Required: `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md`, `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_B.md` (rev 2, 2 Oct). Read if present, all present: `docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_C.md` (rev 3, 5 Oct), `docs/BUILD_RULES.md`, `docs/20260923_FOUNDER_RULING_SHEET_AGENT_FRAMEWORK_V1_1.md`, `docs/20260923_INTEGRITY_FINDINGS_REGISTER_V2.md`, `docs/audits/FantasyTrades_Expanded_Capability_Reuse_Audit_2026-09-23.md`, `docs/AGENT_LEARNING_CHARTER_V1.md`. Also read: `docs/audits/20260923_BUILD_EVAL_DEFERRED_BEAT.md` (the deferred-beat build report).

**Astra's September touchpoint and reader maps are not in the repository** (bounded search: `grep -rl 2a1a16b1 docs` hits only cockpit documents; no file mentions "touchpoint map", "reader map" or "boundary assessment"). Every touchpoint below is re-derived at HEAD `8ce61c3d`, as the prompt requires.

### 0.5 Method

Five read-only tracing subagents each took one question group (Q1+Q7, Q3, Q4, Q5, Q6) against the same HEAD with instructions to cite `path:line` and quote the line; the coordinator seeded each with anchors it had already read, then re-read the load-bearing anchors (§0.6). No tests were run; no credentials, network, or production reads were used. Missing inspection is not evidence of absence: §9 lists what was and was not searched.

### 0.6 Coordinator spot-checks (read directly at HEAD)

`api/forge/watchlists.js:1-60, 95-105, 124-183, 213-320, 370-508` · `api/forge/watchlists/[id].js:1-30, 110-170, 210-230` · `api/forge/watchlists/[id]/uncommit.js`, `api/forge/watchlists/[id]/commit.js`, `api/forge/watchlists/[id]/delete.js` (grep + key lines) · `api/agent/equip-watchlist.js:42-135` · `api/agent/unequip-watchlist.js` (key lines) · `api/_utils/agentBattleService.js:181-250` · `api/_utils/resolvedAgentManifest.js:120-170` · `api/_utils/callRecords/candidate.js:112-152` · `api/_utils/compositionGenerationFence.js:149-164` · `api/agent/decide.js:350-370, 912-932, 1458-1483` · `api/_utils/watchlistEquip.js:51-56, 170-176` · `api/cron/agent-evaluate.js:482-620 (grep), 4397-4418, 6075-6400 (grep), 6372-6382` · `api/cron/process-pending-reflections.js:50-56, 80-94, 150-185` · `api/_utils/callRecords/sweep.js:16-80 (grep), 394-397, 439-448` · `api/_utils/callRecords/queue.js` (exports) · `api/forge/watchlist-dialogue.js:893-900, 944-953, 959-966, 1048` · `api/_utils/signalDropPrompt.js:83-87` · `api/screener/chat.js:42, 164-174` · `api/forge/watchlist-analysis.js:41` · `src/services/agentService.js:16-25, 128-131, 172-174` · `api/agent/change-archetype.js:1-60 (header), 253-262` · `api/_utils/trainingClone.js:59-84` · `src/components/Search/ScreenerView.jsx:275-286` · `src/config/featureFlags.js:1443, 2778, 2812-2830` · `api/_utils/compositionConfig.js:43` · `api/_utils/gemmaClient.js:212-223` · `firestore.rules:224-236, 451-520, 957-990, 1160-1215` · `firestore.indexes.json` (all `agentBattles`, `calls`, `callSweepQueue` entries) · `vercel.json:157-158, 200-203`.

---

## 1. Q1 — Who owns an idea?

### 1.1 What a saved watchlist is scoped to today

| Fact | Evidence |
|---|---|
| The saved list lives in top-level `watchlists/{watchlistId}` and carries `userId` (the player's uid) as its owner; rules read it as `resource.data.userId` | `api/forge/watchlists.js:449` (`userId: user.uid`), `firestore.rules:1180-1184` — verified source |
| `agentId` is written once at creation: from the request (validated to equal the dialogue session's `agentId`) on the SignalDrop/theme path; **`null`** on the manual and screener paths | `watchlists.js:390` (`session.agentId !== agentId` → `agent_mismatch`), `:450` (`agentId,`), `:171` and `:279` (`agentId: null`) — verified source |
| **No code reads `watchlist.agentId`.** Equip, list, GET, PATCH, commit, uncommit, delete, notes and both client readers ignore it; every `.agentId` hit in watchlist-related files is on a `watchlistSessions` document or a battle | six bounded searches over `api/` and `src/` (non-test), see §9; the five handler files under `api/forge/watchlists/` contain zero `agentId` references; `api/agent/equip-watchlist.js:91-97` checks `deletedAt`, `userId`, `status` only — verified source |
| The player's list query is server-side `where('userId','==',uid)`, no agent filter | `watchlists.js:99-104`; client `src/services/forgeWatchlistService.js:76-81` — verified source |

So the `agentId` the spec calls "write-once" points at `agents/{agentId}` — the **ranked agent document that hosted the dialogue session** — and is provenance only. Scope, in every reader, is the player.

### 1.2 What happens to saved watchlists when the player changes archetype

Nothing. `api/agent/change-archetype.js` is a transaction on the **same** `agents/{agentId}` document (`:118`, `:128-129`) whose update payload is `archetype`, `updatedAt`, the re-seeded `equippedTraits`, a birth-provenance stamp and an optional dial reset (`:253-262`, via `txUpdateAgentSettings` = `tx.update` + `settingsRev` increment, `api/_utils/agentSettingsTx.js:18-22`). The file contains **zero** references to `equippedWatchlist*` (grep over all 473 lines) and none to `watchlists` — verified source. The equip slot (`equippedWatchlistId/Name/equippedAt`, written by `equip-watchlist.js:118-123`) survives the change untouched, as do all saved lists.

### 1.3 Whether one agent identity persists across archetype changes

Yes. The ranked agent document is created **client-side** with a Firestore auto id and `ownerId = uid` (`src/services/agentService.js:128-131`, `:172-174`; `api/agent/create-profile.js` only derives a profile and writes nothing — verified source). Archetype is a mutable field on that document (§1.2). "The user's agent" is resolved everywhere as `agents where ownerId == uid`, first non-clone document (`agentService.js:16-25`; `src/components/Forge/ForgeLanding.jsx:1700-1706`; server-side `api/_utils/trainingClone.js:104-108`) — verified source. Two further server-minted identities share the owner: the **casual clone** `casual-agent-{uid}` and **training clones** `training-agent-{groupId}-{uid}` (`src/constants/leagueTournament.js:392-413`), both of which **inherit `equippedWatchlistId/Name/equippedAt`** from the ranked agent through `INHERITED_LOADOUT_FIELDS` (`api/_utils/trainingClone.js:59-84`, re-synced on every casual deploy `api/_utils/casualClone.js:91-99, :212`) — verified source. CPU agents carry `equippedWatchlistId: null` (`api/_utils/tournamentCpu.js:85-86`).

**There is no "Shadow" or persistent-partner identity in code** (bounded search §9). What the Command Center redesign calls Shadow maps today onto the player's ranked agent document, which already persists across archetype changes; the archetype is the swappable field on it.

### 1.4 Does `hypothesisVersions` under the saved list give partnership scope?

**Yes.** A subcollection `watchlists/{watchlistId}/hypothesisVersions/{v}` inherits the parent's owner (`userId`), is readable under an owner rule resolved through the parent (the `agentBattles/{id}/calls` precedent, §7.3), and is reachable by whatever archetype the ranked agent currently has, by any clone that inherits the equip slot, and by the Command Center's player-scoped queries. Nothing archetype-specific has to be stored on it; the archetype-owned **setup verdict** belongs on the per-tick evaluation record (spec §5/§8.2 — P3/P4 scope), keyed by `hypothesisRef`, not on the version.

Two details for the P1 build, not decisions: (i) the rules layer keys watchlists on `userId` but agents and battles on `ownerId` (`firestore.rules:1182` vs `:246-247`, `:452-453`) — any join bridges the two names; (ii) the write-once `agentId` on the list should stay provenance and **not** be promoted to an identity check, otherwise manual and screener lists (`agentId: null`) and clone-hosted battles would fall outside the partnership.

→ **Founder decision D1** (§5).

---

## 2. Q2 — Which changes are records, and which change the agent?

Classification rule (from the prompt): **(a) record** = player-facing storage, reads, Forge display, lifecycle state; the agent is shown nothing new and trades the same; ships without the qualification gate. **(b) behavior** = changes prompt bytes, the tool schema, what deploy feeds the agent, or trade execution; stays behind `PILOT_JOURNEY_MODE`. Fence status per BUILD_RULES §1 is a separate column: fence contact is not the same thing as behavior.

| # | Change (spec clause) | Where at HEAD | Class | Fenced? |
|---|---|---|---|---|
| 1 | `hypothesisVersions` subcollection: server-written content versions (`statement`, `horizonEnum`+`source`, typed `activation[]`/`invalidation[]`, `evidenceRefs[]`, `publishedAt?`, origin discriminant, `contentHash`); allocation in a transaction with expected-version check; caller `opId` for idempotence (§2.1) | new routes under `api/forge/watchlists/[id]/` (pattern: `api/forge/watchlists/[id]/commit.js:56-84` transaction + sentinel errors); `canonicalContentHash` from `api/_utils/canonicalHash.js:42-45` | record | no |
| 2 | Lifecycle envelope (`status`, `firstDeployedAt`, `stateChangedAt`, `stateSource`, `stateReason`, `successorVersion?`) and the player transitions (ready, waiting_for_evidence, rejected, cancelled, retired, reaffirm = new version) (§2.2, §2.5) | same new routes; transition writer copies the fresh-read/compare-and-set shape of `api/_utils/callRecords/sweep.js:182-204` | record | no |
| 3 | Parent-list pointer (`currentHypothesisVersion`, count) written in the allocation transaction; legacy PATCH keeps ignoring hypothesis fields (§2.3) — already true at `api/forge/watchlists/[id].js:121` | `watchlists.js` doc shape; no PATCH change | record | no |
| 4 | `firestore.rules`: `match /watchlists/{watchlistId}/hypothesisVersions/{v}` owner-read via parent `get()`, `allow write: if false`; rules test row in `test/rules/` | precedent `firestore.rules:490-494`; harness `test/rules/callRecordsRulesSuite.mjs:91-156`; `package.json:14 test:rules` | record | no |
| 5 | `firestore.indexes.json`: one collection-group index for the cross-list due/active query (§7.2), dual-written per the index-drift note | `FIRESTORE_INDEX_DRIFT_CLEANUP.md:114` (repo root) | record | no |
| 6 | Horizon capture: version creation reads `watchlistSessions/{sourceSessionId}.parseResult.parse.timeHorizon` (SignalDrop/theme) → `{horizonEnum, source: 'parse'}`; theme is the constant `'unspecified'`; manual/screener `'unspecified'` unless the player sets one (§2.5) | `api/forge/watchlist-dialogue.js:214-216` (cap), `:295` (theme constant); `watchlists.js:448-466` has no horizon key | record | no |
| 7 | Origin discriminant: derived from the session (`source: 'theme'` + `themeId` exist **only on the session**, `watchlist-dialogue.js:893-895`; paste sessions carry no `source`), from `sourceScreenSpec` (screener), else manual (§2.8 origins) | `watchlists.js:276-283, 448-466` | record | no |
| 8 | Language table C strings in Forge (review_due, invalidated, reaffirmation, due-deploy refusal) | client; `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` §C | record | no |
| 9 | Forge display of versions and lifecycle; "save as future version" offer on an edit of an equipped/committed version | client | record | no |
| 10 | Version-aware equip identity: equip compares `{watchlistId, hypothesisVersion}`; agent doc gains `equippedHypothesisVersion`; `INHERITED_LOADOUT_FIELDS` gains it so clones inherit (§2.1) | `api/agent/equip-watchlist.js:100` (today `watchlistId` alone), `:118-123`; `api/_utils/trainingClone.js:59-84` | record **(flag ⚑1)** | no |
| 11 | Deploy carriage: deploy reads the equipped version and passes `equippedHypothesis` as a **sibling** option; `createAgentBattle` writes it beside `equippedWatchlist` with explicit keys; the tournament branch keeps `null` (§2.4) | `api/agent/decide.js:356-371, 912-927` and `:1458-1480`; `api/_utils/agentBattleService.js:198-200` | record by rubric, **behind the flag anyway (flag ⚑2)** | **yes** (`decide.js`; `createAgentBattle` doc shape is fenced as a concept) |
| 12 | `firstDeployedAt` stamped once in the battle-creation transaction (§2.2) | `api/_utils/compositionGenerationFence.js:149-164` (non-fenced; reads before `tx.create` at `:162`) | record | no (but only reachable with #11) |
| 13 | Deploy admission: a `review_due` version is refused at deploy with the table-C line; `ready` deploys; already-activated redeploy is idempotent (§2.5) | `decide.js:356-371` degrade posture is the insertion point | **behavior** (changes deploy control flow) | **yes** |
| 14 | Call writer: the versioned branch of `resolveProvenance` reads the sibling (`agentContext.equippedHypothesis.hypothesisVersion`, cross-checked against the snapshot's `watchlistId`) instead of `snapshot.hypothesisVersion` (§2.6) | `api/_utils/callRecords/candidate.js:142-147` | record | no |
| 15 | Privacy projection: strip `equippedHypothesis` on completed-battle views for non-owners (§2.7) | `api/_utils/tournamentBattleView.js:88-90` (early return), callers `api/tournament/battle-view.js:53`, `api/tournament/team-card.js:271` | record | no |
| 16 | `PILOT_JOURNEY_MODE ∈ {off, advisory, live}` string tri-state with a direct pin and an allowed-values suite (§10.1) | precedent `src/config/featureFlags.js:2812-2830` (`CALL_RECORDS_MODE`, pinned by `callRecordsFlags.test.js`, outside the `*_ENABLED` guard scan) | record (plumbing) | no |
| 17 | `activated → review_due (battle_ended)` for `unspecified` versions; `activated → review_due (horizon_elapsed)` backstop; both as a bounded, compare-and-set pass in the reflections cron (§2.5, D2) | `api/cron/process-pending-reflections.js:159-172` (fifth tenant after the call sweep) | record | no |
| 18 | `activated → review_due (horizon_elapsed)` on the evaluation encounter (§2.5) | `api/cron/agent-evaluate.js:4415-4428` (sibling of the calls phase, after the `:4399` commit) | record (clock only; nothing shown to the model) | no |
| 19 | `activated → invalidated` on the evaluation encounter (§2.5) | needs the P3 evaluator and the P4 splice | **out of the record slice** | (P4: fenced) |
| 20 | `researchWorkId` on each host record at its mint line; `researchWork` standalone record for manual origin; link from version `evidenceRefs[]` (§3, §8.2) | `api/screener/chat.js:164`, `api/forge/watchlist-dialogue.js:892` and `:959`, `api/forge/watchlists.js:162-186` | record | no |
| 21 | Research counts and telemetry: persist `universeSize`, returned symbols, selection, terminal outcomes with reasons, `budget.{allotted,used}`, tokens-or-`unknown`, elapsed, attempts/failures as awaited writes (§3) | §6 lists each | record (fence-free, per spec §10.3) | no |
| 22 | Screener → watchlist link: client sends the screener `sessionId`; server persists `sourceSessionId`/`researchWorkId` on the ticker-create path | `src/components/Search/ScreenerView.jsx:279-286`, `watchlists.js:280` (`sourceSessionId: null` hard-coded) | record | no |
| — | **Parse binding repair (§2.8):** the dialogue builds its prompt from the server-stored `dropRecord.parse` instead of the client envelope; entered URL kept as attribution | `api/forge/watchlist-dialogue.js:944-948` (hash check only), `:966` (`parseResult: validatedParseResult` stored), `:1048` (`buildDialogueInputs(session.parseResult)`) | **behavior** — its own founder flip; non-fenced file but prompt-contributing (`api/_utils/voiceLayerPrompt.js:2365` renders `timeHorizon`); applies to the paste path only (theme sessions have no `signalDrops` record) | no |

**Flags (cannot classify cleanly):**

- **⚑1 (#10)** Version-aware equip is a record change by the rubric (an agent-settings field; no prompt or execution change) but it is the field deploy will read, it increments `settingsRev` through `txUpdateAgentSettings`, and the clone inherit list must carry it. Recommend: ship with P1b, not P1a, so the equip and deploy halves land together.
- **⚑2 (#11)** Deploy carriage writes nothing the model sees (no reader of `equippedHypothesis` exists; §4), so by the rubric it is a record. It is nevertheless fenced creation-shape contact on both deploy branches and the spec (§10.3) names it a fenced P1 touchpoint. Recommend treating it as flag-gated regardless of its record classification, which is the shape the prompt anticipates for P1b.

---

## 3. Q3 — The idea's path today

### 3.1 Intake (four origins)

| Origin | Where | What is recorded | Evidence |
|---|---|---|---|
| **SignalDrop (paste)** | `api/forge/parse-signal.js` — client-generated `dropId` (`:144-150`); `contentHash` is over the raw **input** (`:194-199`); doc `users/{uid}/signalDrops/{dropId}` = `{dropId, userId, input, contentHash, parse, validation, shouldBailout, shouldHardCheckpoint, expansion: null, outcome: {forkChosen: null}, droppedAt, cacheHit}` (`:344-356`) | the parse carries **`timeHorizon`** with enum `['intraday','swing','positional','longterm','unspecified']` (`api/_utils/signalDropPrompt.js:83-87`, normalized `:301, :331`) | verified source |
| **Theme** | `api/forge/watchlist-dialogue.js:857-915` — `themeId` path reads `discoverThemes/{themeId}`; synthetic `dropId` is a client UUID with **no** `signalDrops` record (`src/components/discover/DiscoverPanel.jsx:124-131`); session gets `source: 'theme'`, `themeId` (`:893-895`); `synthesizeThemeParseResult` hard-codes `timeHorizon: 'unspecified'`, `contentHash: null` (`:265-300`) | the discriminant lives **only on the session**; the saved watchlist gets `sourceSessionId`/`sourceDropId` and nothing else | verified source |
| **Screener** | `src/components/Search/ScreenerView.jsx:275-286` POSTs `{tickers, name, sourceScreenSpec}` then commits (`:296`); server `watchlists.js:213-320` writes `sourceScreenSpec` (sanitized `:228, :271`) with `agentId: null`, `sourceSessionId: null` (`:279-280`) | the screener `researchSessions` id is held in component state (`:61, :168`) but **never sent** | verified source |
| **Manual** | `watchlists.js:162-186` — id-less create, empty draft, `agentId: null`, no session | — | verified source |

### 3.2 Dialogue → save → PATCH → uncommit/recommit/delete

- **Dialogue session** `watchlistSessions/{id}` (`watchlist-dialogue.js:822`): `{userId, agentId, dropId, [themeId, source], parseResult, anatomy: {thesis, activationConditions[], invalidationConditions[]}, candidateTickers[], messagesUsed, messageBudget: 20, status, phase, ...}` (`:893-915`, `:959-985`). The horizon **persists** in `session.parseResult.parse.timeHorizon` (`:214-216`) and **is rendered into the dialogue prompt** (`api/_utils/voiceLayerPrompt.js:2365`); the anatomy can never carry it (`VALID_ANATOMY_FIELDS`, `:76-80`) — verified source.
- **Parse binding at HEAD (§2.8):** the server verifies only that `dropRecord.contentHash === validatedParseResult.contentHash` (`:944-948`), stores the **client** envelope as `session.parseResult` (`:966`), and builds the prompt from it (`:1048`); `dropRecord.parse` is never read. Because the hash is over the raw input, any schema-valid parse content passes under a matching hash — the spec's description is exact — verified source.
- **Save** (`watchlists.js:383-473`): transaction over session + new list; doc `{watchlistId, userId, agentId, sourceSessionId, sourceDropId, thesis, activationConditions[] (strings), invalidationConditions[] (strings), tickers[] (objects {symbol, reasoning, category, addedBy, addedAt}), name, notes, status: 'draft', createdAt, updatedAt, committedAt: null}` (`:448-466`); **no horizon key** — verified source. The session flips to `completed` with `dropListId` (`:468-472`).
- **PATCH** (`watchlists/[id].js`): six recognized fields (`name, notes, thesis, activationConditions, invalidationConditions, tickers`, `:122-168`); **unknown fields ignored** (`:121`); 409 `invalid_status` only when `status === 'committed'` (`:224-228`) — verified source.
- **Commit / uncommit / delete** (`api/forge/watchlists/[id]/commit.js:79-82`, `api/forge/watchlists/[id]/uncommit.js:73-76`, `api/forge/watchlists/[id]/delete.js:73-75`): owner transactions, idempotent, **no equip or battle check** in any of them (grep `-i equip` → 0). Uncommit returns a committed list to `draft`, so PATCH edits succeed again — verified source. Side effect: an agent whose equip slot points at the now-draft list deploys with "no equip" (`decide.js:370` degrade; `resolveEquippedWatchlist` returns null for any non-committed status, `watchlistEquip.js:51-56`) while `equippedWatchlistId` stays set.

### 3.3 Equip, both deploy branches, the snapshot, the hash

- **Equip** (`api/agent/equip-watchlist.js`): refuses while `agent.activeBattleId` (`:89`); requires `watchlist.userId === uid` and `status === 'committed'` (`:96-97`); **idempotent shortcut when `agent.equippedWatchlistId === watchlistId`** (`:100-106`, no write, no log); writes `equippedWatchlistId`, `equippedWatchlistName`, `equippedAt` via `txUpdateAgentSettings` (`:118-123`) — verified source. No version, hash or `updatedAt` of the list is recorded on the agent (bounded grep → 0).
- **Deploy branch 1 — self-select (tiered/casual)** (`api/agent/decide.js`, default handler): live read of `watchlists/{equippedWatchlistId}` (`:358`) → `resolveEquippedWatchlist` (`:359`) → `equippedSymbols` (`:363`) and `equippedWatchlistSnapshot = buildEquippedSnapshot(...)` (`:364`). The **prompt** gets `{name, tickers, thesis}` from the live document (`:398-405` → fenced `agentPromptAssembly.js:136-148`), and `{tickers}` for the portfolio system prompt (`:506-509`). `createAgentBattle(..., { equippedWatchlist: equippedWatchlistSnapshot, compiledBuild, activationPin })` at `:912-927`; then a **separate plain write** `agentRef.update({ activeBattleId })` at `:931` — verified source.
- **Deploy branch 2 — prescribed tournament** (`runPrescribedTournamentDeploy`, `decide.js:1302`): `createAgentBattle(..., { equippedWatchlist: null, gameMode: FLAT6_GAME_MODE, groupId, isCpu, tournament: {...}, compiledBuild, activationPin })` at `:1458-1480`; `activeBattleId` written at `:1482` — verified source. **Tournament battles carry no frozen watchlist and hash `equippedWatchlist: null`** (consistent with spec §9.2's "the production flat-six prescription deploys with no equipped watchlist"); the tournament **board** prompt still reads the live list including thesis (`api/_utils/tournamentAgentBoards.js:475-485, :175-180`).
- **The battle-creation write** is not in `decide.js` (zero `runTransaction` there): `agentBattleService.js:302` calls `commitBattleDocWithPin`, which at HEAD runs a transaction (`COMPOSITION_EPOCH_FENCE_ENABLED = true`, `api/_utils/compositionConfig.js:43`) that re-reads the activation descriptor and `tx.create`s the battle (`api/_utils/compositionGenerationFence.js:149-164`) — verified source. These are the only two `createAgentBattle` callers in the tree.
- **Snapshot builder** (`api/_utils/watchlistEquip.js:170-176`): `{ watchlistId, name: name || 'Untitled watchlist', tickers: extractTickerSymbols(tickers) }` — tickers become **strings** (`:27-40`, uppercased, regex-validated, deduped); `snapshotAt` is stamped by `createAgentBattle` (`agentBattleService.js:198-200`) — verified source.
- **`equippedConfigHash`** (`api/_utils/resolvedAgentManifest.js:129-165`): `canonicalContentHash` over the seven-key `equippedConfigContent` (`activeRules, equippedBundleIds, standingLeans, standingLeansInvalidated, dials, deployedGuardrails, equippedWatchlist`) where `equippedWatchlist` is the whole snapshot object **without** `snapshotAt` (`:138` vs `:143`, comment `:160-164`); thesis is not in it; name and ticker order are (`canonicalHash.js:11, :26-33`) — verified source. `MANIFEST_WRITE_ENABLED = true` (`featureFlags.js:1443`).

### 3.4 Verdicts on the six "at HEAD" claims

| Claim (spec §2.1–2.4, §2.8) | Verdict | Evidence |
|---|---|---|
| Horizon dropped at save | **Confirmed**, with corrections: the field is `timeHorizon`; it is dropped only at save, not before (session keeps it, dialogue prompt renders it); theme origin is the constant `'unspecified'` | `watchlists.js:448-466`; `watchlist-dialogue.js:214-216, :295`; `voiceLayerPrompt.js:2365` |
| PATCH ignores unknown fields | **Confirmed** | `api/forge/watchlists/[id].js:121` |
| Uncommit re-opens editing | **Confirmed**; no equip awareness | `api/forge/watchlists/[id]/uncommit.js:73-76`; `api/forge/watchlists/[id].js:224-228` |
| Equip identity is `watchlistId` alone | **Confirmed** | `equip-watchlist.js:100` |
| The snapshot keeps tickers as strings | **Confirmed** (the list document's tickers are objects; the snapshot flattens them) | `watchlistEquip.js:174, :27-40`; `watchlistValidation.js:41-53` |
| `equippedConfigHash` hashes the whole `equippedWatchlist` object | **Confirmed**, made precise: the snapshot `{watchlistId, name, tickers[]}` minus `snapshotAt`, as one of seven keys | `resolvedAgentManifest.js:138, :143, :165` |

### 3.5 Who reads the legacy `thesis` string (spec §2.3)

Readers of the **watchlist** thesis are prompt consumers only: `decide.js:403` (live doc → `agentPromptAssembly.js:141`, fenced) and `tournamentAgentBoards.js:483 → :180`; the dialogue renders the **session** anatomy's thesis (`voiceLayerPrompt.js:857`). Writers: `watchlists.js:435` (save) and `api/forge/watchlists/[id].js:137-141` (PATCH). Not readers: film tape, voice layer cache, the manifest, the snapshot (no thesis in it), the call writer. `agent-evaluate.js:1605` and `agentEvalPromptAssembly.js:1052-1089` read a *vision* thesis, a different concept — verified source. So `hypothesis.statement` can be the pilot truth while the two prompt readers keep `thesis`, and no consumer reads both.

---

## 4. Q4 — Who else reads these records?

`equippedHypothesis` appears nowhere in `api/` or `src/` (grep → 0); it exists only in the spec. Readers of what exists today (`agentContext.equippedWatchlist`, `resolvedAgentManifest.equippedConfigHash`, the agent-doc equip fields), with the effect of adding a **sibling** `equippedHypothesis`:

| Reader | Line(s) | Reads | Does | Sibling effect |
|---|---|---|---|---|
| **Call writer** `resolveProvenance` | `api/_utils/callRecords/candidate.js:133-151` | snapshot + hash | computes `hypothesisRef` + `origin` (+ `provenanceReason`), placed on each call at `:228-230` via `composeCall` from `buildMintCandidate` (`:263, :281`); created once in `publish.js:185-186` from `runModelCallsPhase` (`:325`) | **needs the change** — the versioned branch reads `snapshot.hypothesisVersion` (`:142`); the doc comment `:128-131` says HEAD's producer never writes one. P1 repoints it to the sibling and keeps the legacy branch (`:149`) and the H1 rule (`:136`) untouched. Downstream, `composeCall` spreads whatever ref comes back; `src/constants/filmTape.js:263` already declares `calls[].hypothesisRef.hypothesisVersion` |
| Film tape | `api/_utils/filmTape/tapeAssemble.js:674-679, :702` | `hypothesisRef` keys off **call** docs | copies `watchlistId, hypothesisVersion, equippedConfigHash` | unaffected |
| Tick capture | `api/_utils/tickCapture/captureWriter.js:280-296` (`:294`), `captureSerializer.js:154` (allowlist; default deny `:26-28, :398-402`), fed from `agent-evaluate.js:4186-4190, :4617` | `equippedConfigHash` | `controls.equippedConfigHash` on the permanent tick | unaffected (default-deny; recording a version needs a selector + allowlist entry, P5 scope) |
| **Backing** | `api/_utils/backingStake.js:178-191` (`hashAtStake` from the owner's most recent completed battle), `backingSettlement.js:486-537` (`hashAtSettlement` from the group's current battle), `backingResults.js:107-116` (`loadoutChangedFor`: `atStake !== atSettlement`) | `equippedConfigHash` strings | stake-vs-settlement comparison | unaffected by construction (the hash input is the explicit seven-key object) |
| Hot bench / execution universe | `api/cron/agent-evaluate.js:1397-1410` (`unionEquippedIntoHotBench`, cap 20) | snapshot tickers | daily hotBench refresh | unaffected |
| Research gate | `api/agent/research.js:89` | snapshot tickers | `isAlreadyEquipped` | unaffected |
| Voice layer prompt | `api/_utils/voiceLayerPrompt.js:3441-3446` | snapshot name + ≤8 tickers | **prompt bytes** (first message) | unaffected |
| Shadow assembly capture | `api/_utils/shadowAssemblyCapture.js:147, :153` | spreads `...battle.agentContext` | diff view, inert for prompts | would silently include the sibling (no effect) |
| Prompt assemblers (fenced) | `agentPromptAssembly.js:70, :136-148` (from the live doc, not the snapshot); `agentEvalPromptAssembly.js` (zero hits) | — | — | unaffected |
| Execution (fenced) | `agentSwapExecution.js` (zero hits; `:43-47` reads `battle.watchlist.hotBench`) | — | — | unaffected |
| **Tournament projection** | `api/_utils/tournamentBattleView.js:35-44, :86-104` | allowlists | active non-owner: `PUBLIC_AGENT_CONTEXT = ['agentName','archetype','tournament','initialPortfolio']` excludes `equippedWatchlist` (`:43-44`); **owner or completed → whole battle returned** (`:88-90`) | active non-owner: excluded by default; **completed battle to any viewer (`api/tournament/battle-view.js:53`, `api/tournament/team-card.js:271`): silently included** → spec §2.7 needs a strip at `:88-90` |
| Client (27 files) | e.g. `src/screens/AgentBattleScreen.jsx:3187`, `battleView/selectBench.js:173`, `selectSymbolRoster.js:68`, `src/data/battleUniverse.js:72`, equip/deploy stations, lobby loadout views | named keys (`.name`, `.tickers`, agent `equippedWatchlistId/Name`) | display | unaffected; the owner's client receives the whole battle doc (`src/hooks/useAgentBattle.js:69`) and would carry the sibling unrendered |

All line references: verified source (subagent trace; coordinator re-read `candidate.js`, `tournamentBattleView.js:86-94`, `resolvedAgentManifest.js`). Exactly where a versioned ref plugs in: **one function, `resolveProvenance`**, reading `battle.agentContext.equippedHypothesis.{hypothesisVersion, contentHash}` and asserting the sibling's `watchlistId` equals the snapshot's before emitting `{watchlistId, hypothesisVersion}`; everything downstream already handles the versioned shape.

---

## 5. Q5 — Where do lifecycle transitions run?

### 5.1 The deploy transaction and `firstDeployedAt`

There is **no single write** that both creates the battle and marks the agent. Battle creation is transactional in the non-fenced `commitBattleDocWithPin` (`compositionGenerationFence.js:154-163`: read activation descriptor → `tx.create(ref, battleDoc)`), lit at HEAD; the agent pointer is a later plain `agentRef.update({ activeBattleId })` (`decide.js:931`, `:1482`) — verified source. A crash between the two already leaves a battle without a pointer (the sync path at `decide.js:728-729` is the existing repair).

`firstDeployedAt` therefore stamps inside the creation transaction: a compare-and-set on the version document (`if (!version.firstDeployedAt) tx.update(versionRef, { firstDeployedAt: now, status: 'activated', ... })`) issued **before** the `tx.create` at `:162`. The version is located from the battle document being created — which is only possible once `equippedHypothesis` (version id + `watchlistId`) rides the `battleDoc` (change #11, fenced). Without that sibling the transaction would need a two-hop lookup (`watchlists/{id}` → current version), and tournament battles (`equippedWatchlist: null`) are excluded by construction either way. The module is non-fenced; only the sibling that makes it reachable is fenced.

### 5.2 Transition hosts

| Transition (spec §2.5) | Existing host | Anchor | Notes |
|---|---|---|---|
| draft → researched | P2's host-record close (session `completed` / `abandoned`, screener turn) | `watchlists.js:468-472` (session → completed), `watchlist-dialogue-abandon.js:113-118` | a new awaited write at close |
| researched → ready / waiting_for_evidence / rejected / cancelled; any → retired; review_due → superseded (reaffirm) | new P1 routes (owner transactions on the version doc) | pattern `api/forge/watchlists/[id]/commit.js:56-84` | record-only |
| ready → activated (+ `firstDeployedAt` once) | the battle-creation transaction | `compositionGenerationFence.js:154-163` | §5.1 |
| activated → review_due (`horizon_elapsed`) — encounter | the post-commit calls phase of each evaluated battle | `agent-evaluate.js:4399` (commit), `:4402` (identity), `:4415-4428` (calls phase; `publish.js:325`) | add a sibling step with its **own** flag, not inside the `callsActive` ternary (which inherits `CALL_RECORDS_MODE`) |
| activated → review_due (`horizon_elapsed`) — backstop; activated (`unspecified`) → review_due (`battle_ended`) | **the hypothesis review pass**: a fifth isolated tenant of the reflections cron | `process-pending-reflections.js:159-172` (after the call sweep), schedule `vercel.json:201-202` (every 15 min, 13:00–00:59 UTC, **seven days a week**), `TIME_BUDGET_MS = 50_000` (`:33`) | D2 |
| activated → invalidated | the evaluation encounter, once P3/P4 exist | same as the encounter row | out of the record slice |

### 5.3 Can the call sweep host hypothesis transitions?

**No, not as it stands.** The call sweep (`api/_utils/callRecords/sweep.js`, invoked only from `process-pending-reflections.js:166`) has:

- a global gate on the cockpit's mode — `if (global !== 'on') return` (`:395-396`) — and a per-battle **owner allowlist** gate (`:450, :469`; `mode.js:80-85`), both of which a hypothesis lifecycle must not inherit;
- a three-phase cursor `callSweepState/singleton` over `callSweepQueue` rows keyed by **battleId** (`:78, :103-110, :427-430`); every row is treated as a battle, the parent battle is read (`:440-441`), and a row without a parent is **deleted** (`:444-447`) — a version-keyed row would be destroyed on first visit; the `due` query has no row-kind discriminator;
- Amendment B §B.10's explicit read budget for the sweep (queue row, cursor, parent only).

The deferred beat cannot host anything today: `EVAL_DEFERRED_BEAT_ENABLED = false` (`featureFlags.js:2778`, pinned, `DARK_BY_DESIGN`); the run record `agentEvalRuns/{runId}` is live but carries only counts and a capped list of **budget-deferred** battle ids (`agent-evaluate.js:541-557`), not lock-skipped or market-closed ones, and `writeDeferredBeats` returns 0 at `:600`. So the spec's "deferred-beat PR blocks both arcs' sweeps" names a dependency that is not live, and the call sweep already runs without it.

What **can** be reused: the handler slot (the fifth tenant, BUILD_RULES §6 "branch inside existing handlers"), the bounded-transaction shape (`sweep.js:164-179 boundedTx`: fresh `tx.getAll`, state check, deadline re-check, then writes; outcomes `transitioned | skipped | unconfirmed | failed`, never throws), `withTimeout`/`isCallsTimeout` (`:60, :69`), and the single `{lastDocId}` cursor shape of the mastery repair sweep (`api/_utils/masterySettlement.js:673-720`). What is new: one due-date query over the version documents (collection-group, §7.2) or a tiny `hypothesisReviewQueue/{versionId}` row armed at activation, plus one cursor document. **No new scheduler, no new cron entry.**

### 5.4 Completion

`completeBattle` (`agent-evaluate.js:6075`) is one transaction (`:6082`) reading the battle, the agent and, for casual clones, the parent agent (`:6083, :6108, :6130`, reads before writes) and writing the battle (`:6278`, status `completed` `:6196-6197`, `pendingReflection` `:6202`) plus the agent pointer/stats (`:6296, :6320, :6334`). Its two callers are the expiry loop (`:303`) and the GC repair (`:6447`); `decide.js:764-768` and `:1388-1392` write a bare `status: 'completed'` outside it, repaired later. Post-commit follow-ups already exist as their own bounded transactions (`runAwardTransaction`, `:6379-6391`, "failures here log and defer"). The reflections cron then walks `status == completed && pendingReflection == true` oldest-first (`process-pending-reflections.js:50-56`) and clears the flag only on success (`:88-93`) — the queue-flag pattern of BUILD_RULES §5. Tournament CPU battles never set the flag (`:6203`).

### 5.5 Recommendation (→ D2)

Host the `battle_ended → review_due` transition in the **hypothesis review pass** (the fifth reflections-cron tenant), not in `completeBattle`: it honours Amendment B §B.7 ("completion writes nothing … the sweep closes"), leaves the completion transaction's conflict set unchanged, covers every terminal path (expiry loop, GC repair, the bare `decide.js` write) because it keys on the version's own `activated` state plus the battle's terminal status rather than on a completion event, and costs at most one 15-minute lag on a state that grants no authority (R6). The same pass is the `horizon_elapsed` backstop. `firstDeployedAt` stamps in the creation transaction (§5.1). The alternative, if the founder wants same-instant flagging, is a sibling of `runAwardTransaction` in `completeBattle`'s post-commit section with the review pass as its retry — one more edit to the hottest function in the cron, for a gain the player cannot see.

---

## 6. Q6 — Research hosts and counts (P2)

### 6.1 What exists per host

| Host | Record | Budget | Counts / results | Tokens · elapsed | Terminal | Where `researchWorkId` mints |
|---|---|---|---|---|---|---|
| **Screener chat** (`api/screener/chat.js`, `researchSessions`) | `{userId, createdAt, updatedAt, messagesUsed, messageBudget, exchanges[], latestSpec, status: 'active'}` (`:164-174`) | `MESSAGE_BUDGET = 30` (`:42`), soft cap (`:182`), +1 per persisted turn in a transaction (`:366-372`); failed turns free (`:228-257`) | `universeSize = universe.length` (`screenStocks.js:398`) **response only** (`chat.js:311`); `matchCount` = matched before the limit slice (`:494`) **persisted per exchange** (`chat.js:320`); results ≤ `MAX_LIMIT = 25` (`screenStocks.js:69, :499`) **response only** | `tokenUsage: null` (`:413`); none | none (`status` stays `active`) | `:164 sessionsCol.doc()` |
| **Dialogue** (`api/forge/watchlist-dialogue.js`, `watchlistSessions`) | §3.2 shape; theme path adds `source`, `themeId` | `MESSAGE_BUDGET = 20` (`:45`), **hard** cap (`:1008`), +1 per user turn (`:1378`), two `exchanges` per increment (`:20-24, :1376`) | `candidateTickers[]` with `status ∈ {proposed, kept, removed}` (`:417-438`); no universe or match stage | no `tokenUsage` key; none | `active | abandoned | finalize_intent | completed` + `abandonReason` (`watchlist-dialogue-abandon.js:35-42`, `watchlists.js:468-472`); no `failed` | `:892` (theme), `:959` (paste) |
| **Analysis sessions** (`api/forge/watchlist-analysis.js`, `analysisSessions`) | `{userId, watchlistId, createdAt, updatedAt, messagesUsed, messageBudget, exchanges[], status}` (`:354-364`); analyzes a **saved** list (`:312, :324`, `COHORT_MAX = 40`) | `MESSAGE_BUDGET = 30` (`:41`), soft (`:403-404`) | cohort digest `size / covered / offUniverse` etc. (`api/_utils/cohortDigest.js:200-222`) **response only**; exchange keeps `tier2Included/tier3Included` (`:514-520`) | `tokenUsage: null` (`:585`); none | none | `:353` |
| **Agent research** (`api/agent/research.js`) | one `research` exchange on the battle doc (`:354, :407-427`), `researchId` per card | `RESEARCH_CAP = 3` cards (`src/data/researchCap.js:36`), "NO MESSAGE IS CHARGED" (`:35-38`) | — | no model call | — | **dark**: `SHOW_IT_ENABLED = false` (`featureFlags.js:2420`) |
| **Scouting board** (`api/agent/scouting-board.js`) | no writes (`:3-10`) | — | `ranked` (10) + equipped-list `inUniverse/offUniverse` (`:152-160`) | — | — | n/a |
| **SignalDrop parse** (`api/forge/parse-signal.js`) | `signalDrops/{dropId}` (§3.1) | — | — | `tokenUsage: haikuResponse.usage` goes **only to the GCS shadow log** (`:370`); none | `outcome.forkChosen` initialised `null`, **never written** (`:220, :352`) | the drop → session link is one-directional |
| **Manual** | no host record | — | — | — | — | none exists → standalone `researchWork` |

Model adapter: `api/_utils/gemmaClient.js` (OpenRouter, `:39`) returns `{ ok, content }` only (`:212-223`) — provider `usage` is never read; latency is a console line (`:99-107`). The Anthropic-SDK hosts that do read `usage` (`decide.js:744-747`, `agent-evaluate.js:4256`, `compute-daily-regime-brief.js:199-213`, `parse-signal.js:370`) write it to shadow logs, except the regime brief. All lines: verified source.

### 6.2 Is the §3 cumulative-count model computable from existing outputs?

Only in part.

| Stage | Screener origin | SignalDrop / theme origin | Manual |
|---|---|---|---|
| `universeSize` | computed, **not persisted** → new write | structurally absent (no screening step) | new |
| `matchedPreLimit` | **persisted** as `exchanges[].matchCount` ✔ | absent | new |
| `returned/shortlisted` | response only (`results.length`) → new write (+ the symbols; the doc keeps only `latestSpec`) | `candidateTickers.length` ✔ | new |
| `selectedForInvestigation` | not captured (the client sends all results, `ScreenerView.jsx:275-277`) → new write | derivable: `candidateTickers.filter(status !== 'removed')` ✔ (= what save keeps, `watchlists.js:415`) | new |
| `investigationsCompleted`, `eligible` | no concept → new write | no concept → new write | new |
| Terminal outcome per symbol | none → new | partial: `removed` ≈ rejected, **no reason**; no `dataMissing`, no `cancelled/failed` → new | new |
| `budget = {allotted, used}` | `messageBudget` / `messagesUsed` ✔ | ✔ | new (no host) |
| Tokens | `unknown` (adapter discards) | `unknown` | — |
| Elapsed, attempts, failures, cancellations | not persisted anywhere; failed turns return before the persist (`chat.js:228-257`, `dialogue.js:1093`, `analysis.js:473`) → new **awaited** writes (BUILD_RULES §5 forbids fire-and-forget for these) | same | — |

### 6.3 New writes P2 needs

1. `researchWorkId` on each host record at its mint line (`chat.js:164`, `watchlist-dialogue.js:892/:959`, optionally `watchlist-analysis.js:353`), and an `origin` discriminator on the paste-path session (it has no `source`) and on `researchSessions`.
2. The **screener link**: the client sends the screener `sessionId`; the ticker-create path persists `sourceSessionId`/`researchWorkId` instead of the hard-coded `null` (`watchlists.js:280`). Without it a screener-origin list has no research record at all.
3. Funnel counts on the record: `universeSize`, returned count and symbols, `selectedForInvestigation` (needs a per-symbol selection the screener UI does not capture), `investigationsCompleted`, `eligible`.
4. Per-symbol terminal outcome with a typed reason; `dataMissing` and `cancelled/failed` classes.
5. Attempts, failures, cancellations and elapsed as awaited writes; tokens as `unknown` unless the Gemma adapter is changed to return `data.usage` (an adapter change, not a prompt change).
6. A standalone `researchWork` record for manual origin; a `failed`/`cancelled` session terminal (the dialogue enum lacks it; screener and analysis have no terminal writer).
7. `evidenceRefs[]`/`researchWorkId` on the hypothesis version (P1 side of the join).

The message-budget currency is already "persisted successful user turns" (`messagesUsed` against `messageBudget`) in all three chat hosts and is comparable across them; `exchanges.length` is **not** a cross-host proxy (the dialogue stores two records per turn). The in-battle research cap is a different currency (cards).

---

## 7. Q7 — What the Command Center would read

### 7.1 Queries

| View need | Query | Index |
|---|---|---|
| A player's lists | `watchlists where userId == uid` (existing server list, `watchlists.js:99-104`; soft-deleted filtered in memory) | none (single equality) — none exists today either (`grep -i watchlist firestore.indexes.json` → 0) |
| Versions of one list, newest first | `watchlists/{id}/hypothesisVersions orderBy version desc` (or `createdAt desc`) | none (single-field, automatic) |
| Ideas with status, dates, versions across a player's lists | collection-group `hypothesisVersions where userId == uid and status in [...] orderBy stateChangedAt desc` (the version doc must carry `userId` and `watchlistId` denormalized, like tape documents carry `ownerId`) | **one new COLLECTION_GROUP composite** on `hypothesisVersions`: `userId ASC, status ASC, stateChangedAt DESC`; precedent `tape` at `firestore.indexes.json:616-628` |
| The review pass's due query (§5.3) | collection-group `hypothesisVersions where status == 'activated' and reviewDueAt <= now` | the same index family (`status ASC, reviewDueAt ASC`) or a queue row |

Indexes are **dual-written**: the entry in `firestore.indexes.json` on the branch **and** hand-created in the Console at merge prep (`FIRESTORE_INDEX_DRIFT_CLEANUP.md:114`, repo root; `test/rules/equippedConfigHashQuery.rules.mjs:9-15` states the emulator proves shape only). Six `agentBattles` composites and two `calls` composites exist (`:202-304`, `:580-613`); `callSweepQueue` has a single-field override only (`:631-648`).

### 7.2 Rules for an owner-read, server-write `hypothesisVersions` collection

Copy the `calls` block, resolving the owner through the parent list's `userId`:

```
match /watchlists/{watchlistId} {
  allow read: if request.auth != null && resource.data.userId == request.auth.uid;   // existing :1180-1184
  allow create, update, delete: if false;
  match /hypothesisVersions/{versionId} {
    allow read: if request.auth != null
                && get(/databases/$(database)/documents/watchlists/$(watchlistId)).data.userId == request.auth.uid;
    allow write: if false;
  }
}
```

Precedent block `firestore.rules:490-494` (comment `:480-484`: "a parent rule never reaches a subcollection"). A collection-group read needs its own `match /{path=**}/hypothesisVersions/{versionId}` with `resource.data.userId == request.auth.uid` (the denormalized owner), as the tape rule does with `ownerId` (`:514-520` region). Test rows: `test/rules/` harness via `describeOwnerReadCallRecords` in `callRecordsRulesSuite.mjs:91-156` (owner read + list, other-user/privileged/anon/missing-parent denials, all writes denied, rules-text pin), run by `npm run test:rules` (`package.json:14`, emulator).

### 7.3 Naming

Watchlists key on `userId`; agents and battles on `ownerId` (`firestore.rules:1182` vs `:246-247, :452-453`). The Shared Research view joins lists to the agent through the uid; nothing else is needed.

---

## 8. Founder decisions

**D1 — Where an idea lives.** *Decision:* confirm `watchlists/{watchlistId}/hypothesisVersions/{v}` as the home, owned by the player (`userId`), with the list's `agentId` left as provenance and never used as an ownership or archetype check; the archetype's setup verdict lives on the evaluation record, not on the version. *Plain terms:* the idea belongs to you, not to whichever personality your agent is wearing this week; swapping archetype never hides or orphans it. *Recommended default:* **yes.** Nothing in code reads `agentId`, one agent document persists across archetype changes, and clones inherit the equip slot, so this is the smallest correct home and needs no new identity.

**D2 — Who flags an open-ended idea for review when the battle ends.** *Decision:* host `battle_ended → review_due` (and the `horizon_elapsed` backstop) in a hypothesis review pass that runs as the fifth tenant of the existing reflections cron, keyed on the version's state and the battle's terminal status; `completeBattle` is untouched. *Plain terms:* the referee that already closes called shots after a battle also flags your open-ended idea for review, within fifteen minutes, instead of wiring it into the moment the battle closes. *Recommended default:* **yes.** It follows Amendment B §B.7, adds no cron entry and no edit to the completion transaction, and covers every way a battle ends. *Alternative:* same-instant flagging as a post-commit sibling of the mastery award inside `completeBattle`, with the review pass as retry.

**D3 — Deploy carriage ships behind the flag even though it is record-only by the rubric** (⚑2). *Plain terms:* the battle starts carrying a copy of your versioned idea, which the agent does not read yet; because that copy is written by fenced code at deploy, it goes behind `PILOT_JOURNEY_MODE` with the rest of P1b rather than with the record-only P1a. *Recommended default:* **yes** (this is the prompt's own "P1b" shape).

The parse-binding flip (§2.8) remains its own founder-approved change, as the spec says; this report only confirms the code matches the spec's description.

---

## 9. Proposed build split for the record slice

| Piece | Contents | Size estimate | Fence | Flag |
|---|---|---|---|---|
| **P1a — versioned records and lifecycle (record-only)** | #1–#9, #14 (the `resolveProvenance` repoint is inert until a sibling exists), #16 (the flag module and its pin, value `off`), #17 (the review pass, inert until versions are activated), #18 (encounter step, own flag); Forge display; table-C strings; rules + rules tests; index entry | ~10–12 files, ~1,200–1,600 lines incl. tests (3 new routes, 1 version util, rules, 2 rules tests, index, 3–4 client files, flag pin) — **at or over the review threshold** (BUILD_RULES §2: ≥10 files or ≥1,500 lines) | none | ships dark-inert; no `PILOT_JOURNEY_MODE` dependency for storage and reads |
| **P1b — deploy carriage (behind `PILOT_JOURNEY_MODE`)** | #10 version-aware equip + clone inherit list, #11 `equippedHypothesis` sibling on both deploy branches (tournament stays `null`), #12 `firstDeployedAt` in the creation transaction, #13 deploy admission of a due version, #15 the completed-battle strip | ~8 files, ~500–800 lines incl. tests (`decide.js`, `agentBattleService.js`, `watchlistEquip.js`, `equip-watchlist.js`, `trainingClone.js`, `compositionGenerationFence.js`, `tournamentBattleView.js`, tests + golden/byte-identity fixtures) | **yes** — `decide.js` and the `createAgentBattle` doc shape; multi-lens adversarial review and `vite build` per §2 | all of it behind the flag (`off` = byte-identical battle docs and deploy flow) |
| **P1c — parse-binding flip** | §2.8: the dialogue prompt from `dropRecord.parse`; URL as attribution | ~2 files, ~60 lines + a prompt-bytes test | no (prompt-contributing: coordinated review per contract §2) | its own founder flip |
| **P2 — research record** | #20–#22, §6.3 items 1–7; the funnel computed from existing outputs where they exist | ~6–8 files, ~600–900 lines (screener chat, dialogue, abandon, `watchlists.js`, `ScreenerView.jsx`, a `researchWork` util + route for manual origin, adapter `usage` pass-through, tests) | none | fence-free; no prompt or shortlist change (those belong to P1/P4) |

Sequencing: P1a and P2 are independent and can build in parallel; P1b depends on P1a (version documents) and is the first fenced contact; P1c is independent of all three. P3/P4 (setup evaluator, intent, `activated → invalidated`) remain out of this slice.

---

## 10. Observations for separate tasking (not fixed, per BUILD_RULES §3)

1. `signalDrops.outcome.forkChosen` is initialised to `null` at `parse-signal.js:220` and `:352` and never written anywhere (bounded grep over `api/` non-test) — a dead outcome slot.
2. `equippedWatchlistName` is copied onto the agent at equip (`equip-watchlist.js:120`) while the battle snapshot re-reads `name` at deploy (`watchlistEquip.js:173`); a rename between the two leaves two different labels (and changes `equippedConfigHash` for subsequent battles, since name and ticker order are hashed).
3. Backing's `resolveHashAtStake` (`backingStake.js:181-185`) takes the owner's most recent **completed battle of any game mode**, not the group's — code verified, intent inferred; worth a look by the Backing owner.
4. Uncommitting an equipped list silently degrades the next deploy to "no equip" while the agent's `equippedWatchlistId` stays set (`decide.js:370`, `watchlistEquip.js:54`); P1's immutable versions remove the hazard for versioned lists, the legacy path keeps it.
5. `docs/audits/20261002_BUILD1A_ANSWER_LOOP.md:453` cites `docs/FIRESTORE_INDEX_DRIFT_CLEANUP.md`; the file lives at the repository root.

---

## 11. Bounded searches and what was not inspected

- **Resolved at HEAD:** every path cited above was checked with `git ls-tree` / direct reads at `8ce61c3d`; tests were not run; no network, credentials or production reads.
- **Watchlist ownership readers (Q1):** six greps over `api/` and `src/` (`.js`/`.jsx`, non-test) for `.agentId` in watchlist-related files, `where('agentId'` (all seven hits are on `agentBattles`), `watchlist.agentId` variants; `collection('agents').add` (none in `api/`); "Shadow"/"persistentPartner" in `api/` and `src/` (none; `docs/` not searched).
- **Readers (Q4):** `equippedWatchlist|equippedConfigHash` over `api/` (97 lines, 24 files) and `src/` (27 files); `equippedHypothesis` over `api/`, `src/`, `docs/` (spec only); `hypothesisRef|hypothesisVersion`; `projectTournamentBattle` callers; spreads/`stringify`/`hash(` over `agentContext` (none hashes the whole context).
- **Hosts (Q5):** `createAgentBattle(` and `agentBattles').add|.doc()` creators (two callers; one primitive); `completeBattle(` callers; `runCallSweep(` callers; `status: 'completed'` writers on `agentBattles` (three sites); `agentEvalRuns`; `EVAL_DEFERRED_BEAT_ENABLED`, `CALL_RECORDS_MODE` values.
- **Research (Q6):** `researchSessions|analysisSessions|watchlistSessions` files; provider-usage field names across `api/` (zero Gemini-style hits; Anthropic-style via `tokenUsage`, 20 hits); elapsed/latency fields across the six host files (one hit, a cache TTL compare); `forkChosen` (two initialisers).
- **Not inspected:** `src/` consumers of `watchlist.thesis`; `api/forge/workshop-chat.js` beyond its `tokenUsage` lines; `change-archetype.js:1-99` and `:341-473`; the `agents` update allowlist in `firestore.rules` past `:310`; index entries for collections other than `agentBattles`, `calls`, `callSweepQueue`, `tape`; how `decide.js` mints `projectionPin` (the lit-vs-dark commit path is inferred from the flag value); test files except the rules harness and the flag-pin precedents; `docs/` for Astra's maps beyond the greps above.

---

## 12. Branch and PR

Commits on `claude/phase0-pilot-records`: `eafaffb9` (the three blessed specs + README rows) and the commit carrying this report. No source files changed. A byte-exact copy of this report was written outside the repo tree (session scratchpad) per BUILD_RULES §3. The founder merges; this session pushes, reports and stops.

*Phase 0 — Pilot Record Slice, Claude Code, 7 October 2026, at HEAD `8ce61c3d`.*
