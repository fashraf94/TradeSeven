# Build report — Pilot P1a: Versioned Hypothesis Records (record-only)

**Prompt:** "Build Prompt — Pilot P1a: Versioned Hypothesis Records (record-only)", Fable, 7 October 2026. **Session:** Claude Code, 7 October 2026, in a private worktree (the shared working tree was not used). **Branch:** `claude/pilot-p1a-hypothesis-records`, cut from `main` at **`8c9ea5ef`** after `git fetch origin main` (local `main` = `origin/main` = `8c9ea5ef`; PR #934 merged, so every input was present). **Founder decisions in force:** D1 (the idea lives under the saved list, owned by the player), D2 (the review pass inside the reflections cron; `completeBattle` untouched), D3 (deploy carriage is P1b).

**Governing documents (verified with `git ls-tree` at `8c9ea5ef`):** `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` (§2), `docs/specs/TREND_FOLLOWER_SETUP_DEFINITION_V1.md` (§6), `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` (§C, §E), `docs/audits/20261005_PHASE0_PILOT_P1_P2_RECORDS.md`, `docs/CALL_RECORD_FIELD_CONTRACT_V1_4.md` + Amendments B and C, `docs/BUILD_RULES.md`.

---

## Executive verdict

| Question | Answer |
|---|---|
| What does a player get (once the founder flips the flag)? | Each saved list can hold a **versioned idea**: a statement, a time-frame and a status the player moves (ready, waiting for evidence, rejected, cancelled, retired, reaffirmed). Editing never changes a saved version; it makes the next one. The Forge shows it in an **"Idea" panel** on the saved-watchlist screen. |
| Does the agent see or trade anything differently? | **No.** No prompt, tool schema, deploy, battle or trade path reads any of it. Battles do not carry ideas yet (that is P1b), so the review pass built here has nothing to act on and ships tested and inert. |
| Is it live? | **No — dark.** `HYPOTHESIS_RECORDS_ENABLED = false`. Even when true it is on only for owners on the cockpit's server-side allowlist. With it off, every existing route, write and cron output is byte-identical to `main` (proven against `main`'s own code, §3 row 1). |
| Fence contact? | **None.** No fenced file, no `equip-watchlist.js`, `agent-evaluate.js`, `completeBattle`, `watchlist-dialogue.js`, prompt or tool schema is edited. No fenced function is called. |
| Acceptance (12 rows) | **All 12 met** (§3). |
| Tests | Linux, run the way CI runs it (`--maxWorkers=2`, `TZ=UTC`): **0 failing** at the code-final head (§6). Emulator rules suite (Windows): **22 files / 389 tests green**. `lint:gate` and `vite build`: green. |
| Review (BUILD_RULES §2) | Mandatory (37 files, ~4,700 lines). **5 lenses + 4 refuting verifiers + a mutation lens: 27 lens findings → 17 CONFIRMED, 8 PARTIAL, 2 REFUTED;** every confirmed/partial one fixed or dispositioned. Mutation: **133 mutants, 132 caught** after fixes (1 proven equivalent). §5. |
| Where the code departs from the prompt | Three deliberate readings need your eye: the collection-group rule grants **`list`, not `read`**; an unauthenticated caller gets **401**, not 404; and **`computeReviewDueAt` throws** past the maintained calendar. §4. |
| Things for you or P1b | Create the **collection-group index** in the Console (steps in §7) and deploy the rules before any flip; the market calendar runs out for long-term clocks from **6 Oct 2027** (separate task offered); five P1b carry-forwards in §8. |

---

## 0. Preamble

- **Session open.** `git fetch origin main` first; `main` = `origin/main` = `8c9ea5ef` ("Merge pull request #934"). The shared checkout at `C:/Users/fashr/portfolio-duel` was on `main` with three untracked files that are not this build's (`docs/audits/20260911_VOICE_GROUNDING_PAIRED_HARNESS.md`, `exit-dials-live-census-report.json`, `vwap-exit-dating-census-report.json`) — untouched. All work happened in a private `git worktree` on this branch (another session shares the main tree); every commit staged explicit paths after re-checking the branch in the same command.
- **Inputs.** All required documents were present on `main`; no STOP.
- **Fence and boundary check.** The branch diff (`git diff 8c9ea5ef..HEAD --stat`) touches none of `api/agent/decide.js`, `api/_utils/agentBattleService.js`, `api/_utils/agentSwapExecution.js`, `api/_utils/agentPromptAssembly.js`, `api/_utils/agentEvalPromptAssembly.js` (nor the other §1 fenced files), `api/agent/equip-watchlist.js`, `api/cron/agent-evaluate.js` (only its test file — §4 row 10), `api/forge/watchlist-dialogue.js`, or any prompt or tool-schema module. Reviewer L3 confirmed this independently.

---

## 1. What changed and where

**Commits** (all on this branch; `8c9ea5ef..HEAD`): `778152dd` server stage · `55b5c5bf` one shared vocabulary for server and Forge (+ the default-suite wildcard tripwire) · `79b0e98c` client stage (the Idea panel) · `fd1edf22` §2 review fixes · `c13c8f16` rows that kill the mutation lens's survivors · this report.

### 1.1 Flags (`src/config/featureFlags.js`)

| Item | Where | Notes |
|---|---|---|
| `HYPOTHESIS_RECORDS_ENABLED = false` | `src/config/featureFlags.js:3067` | Boolean, covered by the generic `_ENABLED` pin guard (`src/config/flagPinGuard.test.js` — `DARK_BY_DESIGN` entry with its runway), pinned by `src/config/hypothesisRecordsFlags.test.js`. Accessor `isHypothesisRecordsOn()` (no override of any kind). |
| `PILOT_JOURNEY_MODE = 'off'`, `PILOT_JOURNEY_MODES = ['off','advisory','live']` | `src/config/featureFlags.js:3096`, `:3099` | String tri-state, **dedicated pin + allowed-values suite** `src/config/pilotJourneyModeFlags.test.js` (the `CALL_RECORDS_MODE` precedent), which also asserts **nothing under `api/` or `src/` reads it** (P1b is its first reader). |

### 1.2 Server

| File | What |
|---|---|
| `src/constants/hypothesisRecords.js` (new, dependency-free) | The one vocabulary: statuses, terminal / pre-deploy sets, horizon enums and sources, the companion §6 **window table** (2/10/30/60), typed reasons, the **player transition table** `PLAYER_TRANSITIONS`, `legalTransition()`, `legalActionsFor()`. Imported by the server model and the Forge, so the panel offers exactly what the routes accept (BUILD_RULES §9). |
| `api/_utils/hypothesisRecords/model.js` (new, pure) | The record: identity / content / lifecycle field lists (`:51-58`), validation (`normalizeStatement :84`, conditions `:93-110`, `normalizeMissingEvidence :113`), `buildContent :124`, `contentHashOf :150` (`canonicalContentHash` over exactly the 8 content fields), `opFingerprintOf :155`, `buildVersionDoc :163`, the parent pointer `currentVersionOf :188` (malformed → throws, never reset), `originOf :200`, `sessionHorizonOf :213`, the automatic v1 `buildSaveVersion :226`. |
| `api/_utils/hypothesisRecords/gate.js` (new) | `hypothesisRecordsFlagOn :19`, `isHypothesisOwnerAllowlisted :28` (reads `readCockpitAllowlist()` from `api/_utils/callRecords/allowlist.js` — the same place `mode.js` reads it; `mode.js` unedited), `hypothesisRecordsOnForAnyone :42`, `hypothesisRecordsOnFor :53`, `DISABLED_BODY :58`. |
| `api/_utils/hypothesisRecords/store.js` (new) | One transaction per write, all reads before writes: `createPlayerVersion :134`, `reaffirmVersion :172`, `transitionVersion :209`; reads `listVersions :240`, `readVersion :250` (each a read-only transaction). Typed errors `HypothesisRouteError :40`, copy `ROUTE_COPY :50`. |
| `api/_utils/hypothesisRecords/http.js` (new) | The route boundary: `gateHypothesisRoute :30` (middleware → flag → auth → allowlist → method → id), `requireOpId :60`, `requireExpectedVersion :66`, `requireVersion :73`, `parseContentPayload :86`, `sendHypothesisError :100`. |
| `api/forge/watchlists/[id]/hypothesis-versions.js` (new) | `GET` list (newest first) and `?version=n`; `POST` creates `v{n+1}` in `draft`. |
| `api/forge/watchlists/[id]/hypothesis-transition.js` (new) | `POST` ready / wait / reject / cancel / retire (compare-and-set), and `reaffirm`. |
| `api/forge/watchlists.js` | The automatic v1 inside the **existing** save transaction: gate resolved once with no I/O (`:388`), `buildSaveVersion` (`:462`), pointer fields added to the list document, `tx.create` of `v1` (`:474`) — only when the gate is on for the saver and the thesis is non-empty. |
| `api/_utils/hypothesisRecords/horizon.js` (new, pure) | `computeReviewDueAt(horizonEnum, firstDeployedAtMs) :86`, `anchorSessionOf :64`, `HorizonClockError :37`; calendar = `api/_utils/marketSchedule.js getSessionForDate` (→ `src/utils/marketCalendar.js`). Uncalled in P1a (P1b calls it at activation). |
| `api/_utils/hypothesisRecords/reviewPass.js` (new) | The fifth tenant: `runHypothesisReviewPass :171`, `decideReview :112`, `armReviewRow :96` (tests only in P1a), `reviewOne :139` in the bounded-transaction shape of `api/_utils/callRecords/sweep.js` (`boundedTx :121`), queue `hypothesisReviewQueue`, cursors in `hypothesisReviewState/cursor`. |
| `api/cron/process-pending-reflections.js` | Imports and runs the pass **after the call sweep** (`:185`) in its own isolating try/catch; the response key `hypothesisReview` is added **only** when the pass did not skip (`:199`). |
| `api/_utils/callRecords/candidate.js` | `resolveProvenance` repoint (`:152-160`): the versioned branch reads the frozen **sibling** `agentContext.equippedHypothesis.{hypothesisVersion, watchlistId}`; another list → `provenance_unresolved` / `hypothesis_snapshot_mismatch`; malformed sibling → `snapshot_corrupt`; no sibling → the legacy and H1 branches exactly as before. `PROVENANCE_REASONS` gains the new reason. |
| `firestore.rules` | Nested `match /hypothesisVersions/{versionId}` under `watchlists/{watchlistId}` (`:1192`): owner read via the parent's `userId` (`get()`), `allow write: if false`. Collection-group `match /{path=**}/hypothesisVersions/{versionId}` (`:1212`): **`allow list`** on the version's own `userId` (§4 row 1). `hypothesisReviewQueue/{rowId}` (`:1222`) and `hypothesisReviewState/{docId}` (`:1225`): `allow read, write: if false`. |
| `firestore.indexes.json` | One `COLLECTION_GROUP` composite on `hypothesisVersions` (`:630`): `userId ASC, status ASC, stateChangedAt DESC`. |
| `api/_utils/compositionProtectedStoresAllowlist.json` | The write-site ratchet: 9 new keys at their pinned counts, with a human-review note block `_notes_pilot_p1a` (none is a composition-protected store). |

### 1.3 Client (Forge)

| File | What |
|---|---|
| `src/components/Forge/Watchlist/IdeaPanel.jsx` (new) | The panel (`IdeaPanel :74`): current version's statement, time-frame (with its source), status chip and dates; the version history; the moves from `legalActionsFor`; "save as a new version"; reaffirmation; superseded open versions closable from their history row (`:304`). Renders **nothing** with the flag off (no request), while the first answer is pending, on `disabled`, or on a first-load failure before the gate's verdict (`POST_GATE_ERRORS :43`). |
| `src/components/Forge/Watchlist/ideaCopy.js` (new) | Table C **verbatim** (`LIFECYCLE_LINES :17`, including the due-deploy line for P1b), placeholder filling that never invents (`fillLine`), `[SYM]` from the version's own conditions only (`ideaSymbolOf :54`), labels, `PANEL_COPY :98`. |
| `src/services/hypothesisVersionService.js` (new) | The client for the two routes (a sibling of `forgeWatchlistService.js`, so that module's consumers and mocks are untouched). |
| `src/components/Forge/Watchlist/WatchlistEditor.jsx` | Mounts `<IdeaPanel>` on the saved-watchlist screen (`:259`). |

Design tokens only (`useTheme().tokens`); no hex or rgb literal in the panel (pinned).

### 1.4 Tests and rules suites added or changed

New: `api/_utils/hypothesisRecords/{model,horizon,reviewPass,rulesIndex}.test.js`, `api/forge/watchlists.hypothesisRecords.test.js`, `api/cron/process-pending-reflections.hypothesisReview.test.js`, `src/components/Forge/Watchlist/{IdeaPanel.jsdom,ideaCopy}.test.*`, `src/services/hypothesisVersionService.test.js`, `src/config/{hypothesisRecordsFlags,pilotJourneyModeFlags}.test.js`, `test/rules/{hypothesisVersionsDenials,hypothesisReviewQueueDenials}.rules.mjs`. Existing tests changed: §4 rows 10–12.

---

## 2. How it works, in brief

- **The record** `watchlists/{watchlistId}/hypothesisVersions/v{n}`: identity (`version`, `watchlistId`, `userId`, `opId`, `opFingerprint`, `createdAt`), content (`statement`, `horizonEnum`, `horizonSource`, `activation[]`, `invalidation[]`, `evidenceRefs[]`, `publishedAt`, `origin`; hashed into `contentHash`), lifecycle (`status`, `stateChangedAt`, `stateSource`, `stateReason`, `missingEvidence`, `successorVersion`, and the four P1b deploy fields, all `null` here). Server-written only. The list document gains `currentHypothesisVersion` and `hypothesisVersionCount`, written in the same transaction as each version and only when the gate is on. The legacy PATCH still ignores hypothesis fields; `thesis` is untouched.
- **Allocation:** one transaction reads the parent, the pointer, the `opId`'s version (a query) and the base version; the same `opId` with the same request fingerprint returns the existing version (checked first, so a replay after the pointer moved is still recognised); a different request under the same `opId` → `409 op_conflict`; a stale `expectedVersion` → `409 version_conflict`; the new version is `tx.create` (never `set`), so even a race the pointer check missed fails rather than overwriting.
- **Transitions:** fresh read → compare-and-set on the status the caller saw (`409 status_conflict`) → the table (`409 illegal_transition`). Ready / wait act on the current version; reject / cancel / retire may also close a superseded one. Reaffirm creates `v{n+1}` in `ready` and only sets `successorVersion` on the due version.
- **Save:** SignalDrop and theme origins get `v1` in `researched` / `dialogue_completed` from the anatomy thesis, horizon from `session.parseResult.parse.timeHorizon` (`parse`), theme → `unspecified` / `theme_default`. Manual and screener lists get their `v1` from the Forge in `draft`, `unspecified` / `default` unless the player picks (`player`).
- **Review pass:** flag off or nobody admitted → returns before any read. Otherwise, within `min(now + 8 s, handlerStart + 50 s)`, two phases each paged from a persisted cursor: due rows (`dueAtMs <= now` → `review_due` / `horizon_elapsed`) and unspecified rows (battle terminal → `review_due` / `battle_ended`; live or missing battle → skipped). Each is one bounded transaction that re-reads the row and the version, acts only if still `activated`, and deletes the row in the same commit; a stale row is deleted with no transition. Never throws.
- **Horizon clock:** anchor = the regular session containing the deploy instant (`open ≤ t < close`), else the next one; due = the close of the Nth session after the anchor (anchor = session 0); early closes and holidays from the calendar of record; `unspecified` → `null`.

---

## 3. Acceptance results

Linux suite of record = WSL Ubuntu, `TZ=UTC`, `--maxWorkers=2` (CI's own command); rules suite on Windows (no Java in WSL).

| # | Acceptance row | Result | Proof |
|---|---|---|---|
| 1 | Gate off: existing route responses, the watchlist save write, reflections-cron output and call-record goldens byte-identical to `main`; the review pass performs zero reads | **Met** | `api/forge/watchlists.hypothesisRecords.test.js` "row 1": every new route and method → `404 { error: 'disabled' }` with **zero store access** (flag off: before auth; flag on + caller off the allowlist: after auth); the save transaction's writes and response equal a literal golden **that was also run against `main`'s own `api/forge/watchlists.js` in an LF archive of `8c9ea5ef` and passed** (2/2). `api/cron/process-pending-reflections.hypothesisReview.test.js`: the response keys are the pre-build set and the hypothesis collections see zero I/O; `reviewPass.test.js`: "flag OFF → before ANY read", "NOBODY admitted → before ANY read". The existing `watchlists.test.js`, the three reflections-cron suites and the call-record off/rollback goldens pass unchanged. |
| 2 | Allocation: version conflict, opId idempotent replay, opId conflict, no overwrite | **Met** | "row 2" (incl. a replay after the lifecycle moved, a pointer naming a missing version, two racing creates) |
| 3 | Content immutability; editing an ever-committed or activated version creates a new version | **Met** | "row 3" + an `afterEach` over **every** write of **every** route test: a version write is a `create`, or an `update` naming lifecycle fields only |
| 4 | Every transition, each illegal pair refused, fresh-read compare-and-set (a stale concurrent transition loses cleanly) | **Met** | "row 4": the 10 × 5 status/action matrix through the route; `model.test.js` restates the table independently (the guard against table drift, proven by mutation); compare-and-set; a racing competitor commits first → `409 status_conflict`, one write |
| 5 | Reaffirm: new version `ready`; the old keeps its status and clock and gains `successorVersion` | **Met** | "row 5": the due version equals its pre-image plus `successorVersion` only |
| 6 | Horizon capture for the four origins, plus a player override | **Met** | "row 6" (save: paste — every enum — and theme; Forge: manual, screener, session-derived lists; a player pick → `player`) + `model.test.js` |
| 7 | Rules: owner read and list; other-user, anonymous and missing-parent denials; all writes denied; collection-group owner read; queue fully denied | **Met** | `test/rules/hypothesisVersionsDenials.rules.mjs`, `hypothesisReviewQueueDenials.rules.mjs` (emulator), `api/_utils/hypothesisRecords/rulesIndex.test.js` (text and index tripwires). Five rules mutants each caught by a behavioural row (§5.3). |
| 8 | `computeReviewDueAt`: each enum, weekend and outside-hours deploys, an early close, a holiday | **Met** | `api/_utils/hypothesisRecords/horizon.test.js` — every expected instant hand-counted from the NYSE tables (incl. a 60-session walk across Thanksgiving, both early closes, Christmas and New Year) |
| 9 | Review pass: due row, unspecified + completed battle, unspecified + live battle (skipped), stale row (deleted, no transition), budget cut-off, a failure counted and not thrown | **Met** | `api/_utils/hypothesisRecords/reviewPass.test.js` (also: missing battle never assumed ended, judged-once under a concurrent change, both cursors, in-attempt deadline → unconfirmed) |
| 10 | `resolveProvenance`: goldens unchanged; sibling match → versioned ref; mismatch → `provenance_unresolved` | **Met** | `api/_utils/callRecords/candidate.test.js`; goldens via `agent-evaluate.callRecords.offGolden` / rollback suites |
| 11 | Pins: `HYPOTHESIS_RECORDS_ENABLED === false`, `PILOT_JOURNEY_MODE === 'off'` | **Met** | `src/config/hypothesisRecordsFlags.test.js`, `src/config/pilotJourneyModeFlags.test.js`, `flagPinGuard.test.js` |
| 12 | `vite build` passes | **Met** | LF archive of the pushed head (§6) |

---

## 4. Where the code departs from, or reads, the spec, the prompt or the Phase 0 report

| # | Topic | Source said | Code does | Why |
|---|---|---|---|---|
| 1 | Collection-group rule | Prompt: "with **read** on `resource.data.userId == request.auth.uid`"; Phase 0 §7.2 sketch | **`allow list`** | A recursive match also covers every direct path, and Firestore grants if any rule allows: `read` there would let a version's named owner `get` it under a missing parent, contradicting acceptance row 7's missing-parent denial. A collection-group read is always a query, which needs only `list`. Proven: the `list`→`read` mutant fails the missing-parent row. **Stated honestly (review L3-3):** a query *constrained to the caller's own `userId`* — collection group, or one list's subcollection — returns that caller's versions wherever they sit, an orphan included; no other user's version can match. That posture is pinned by an emulator row. |
| 2 | Gate answer for an unauthenticated caller | Prompt: "When the gate resolves off for a caller: every new route returns 404 { error: 'disabled' }" | Flag off → 404 for everyone. Flag on: **no verified token → 401**; an authenticated caller off the allowlist → 404 for every method | The gate is per verified uid; 401-before-gate is the house order of every per-uid gated route (`api/backing/event.js`, `api/agent/cockpit-status.js`) and keeps an allowlisted owner with a stale token from losing the panel silently. No answer depends on who else is admitted. Verified (V3). |
| 3 | Past the calendar | Prompt: "`unspecified` returns null" | **Throws `calendar_unavailable`** (also `invalid_horizon`, `invalid_instant`) | A `null` for a known horizon would read as "unspecified" — a silent default on a load-bearing value. P1b must catch it at activation. The calendar of record ends 2027-12-31, so long-term clocks throw for deploys from **2027-10-06 20:00Z**, positional from 2027-11-17 21:00Z (verifier V1, independently counted) — before the calendar's own "update by December 2027" TODO. A separate task is offered (§8). |
| 4 | Identity fields | Prompt: `version, watchlistId, userId, opId, createdAt` | **+ `opFingerprint`** | "Same opId with the same payload" needs the payload's hash on record; hashing the *request* (not the resolved content) keeps a replay recognisable after the lifecycle or a later version moved. Never hashed into `contentHash`. |
| 5 | Reaffirmation reason | Spec §2.5 row: reason `superseded` | The due version's state is **kept** (status, reason, `stateChangedAt`, clock); only `successorVersion` is set; the new version's reason is `reaffirmed` | Table C: "The old one stays in the record exactly as it was"; overwriting `stateReason` would also erase horizon-elapsed vs battle-ended. Reviewer L1-4 challenged it; verifier V1 **refuted** the finding. |
| 6 | Reject / cancel reasons | Spec §2.5: "typed player reason" | Constants `player_rejected`, `player_cancelled`; the routes take no reason | No reason vocabulary exists anywhere (spec, companions, tables, Phase 0). **Open founder question** (L1-5, PARTIAL): bless a small enum and the route takes an optional `reason`. |
| 7 | "Save as a new version" semantics | Prompt: "Editing content always means creating a new version" | Creates `v{n+1}` in **`draft`**, sets `successorVersion` on the prior current version (status untouched); refused while the current version is `review_due` (reaffirm is that version's way forward); never a no-op (the Forge disables Save until something changes) | Spec §2.5 makes `draft → researched` P2's research step, so an edit cannot be `researched`. Consequence (stated in the Forge): an edit of a ready idea is a draft with no path to ready until P2. |
| 8 | First version on a session-derived list whose session is gone | — | `409 origin_unresolved` | "Origin variants are typed, never faked" (§2.8). No code deletes sessions; defensive. |
| 9 | Queue + cursor collections | Prompt: `hypothesisReviewQueue`; "a `{lastDocId}` cursor" | Queue as specified; **cursors in `hypothesisReviewState/cursor`** (`lastDocId` for unspecified rows; `dueLastDueAtMs`/`dueLastDocId` for due rows) with a server-only rules block | Persisted cursors (the call sweep's precedent) keep rows the pass never consumes from starving the rest (review L2-2). Phase 0 §7.1 offered a `reviewDueAt` collection-group query instead; the prompt chose the queue, so no `reviewDueAt` index exists. |
| 10 | Existing tripwire on wildcard rules | `api/cron/agent-evaluate.evalRun.test.js` and `test/rules/agentEvalRunsDenials.rules.mjs`: "the only wildcard-first path is the root default-deny" | Narrowed in **both**: the wildcard-first heads are pinned exactly (the root default-deny + `/{path=**}/hypothesisVersions/{versionId}`), and any recursive head that could reach `agentEvalRuns` still fails | The prompt mandates the first recursive-wildcard rule in this ruleset. (Phase 0 cited the tape rule as a collection-group precedent; it is in fact nested under `agentBattles` — this build adds the repo's first `{path=**}` rule.) The emulator copy was missed in the first pass and caught by review L3-2. |
| 11 | Existing provenance test rows | `candidate.test.js` pinned `snapshot.hypothesisVersion` as the version source | Rewritten: the versioned rows ride the sibling; the snapshot's own key is pinned as **not** a version source; `PROVENANCE_REASONS` pin extended | The prompt's repoint ("instead of `snapshot.hypothesisVersion`"). No golden changed. |
| 12 | Malformed sibling reason | Contract V1.4 §4 defines `snapshot_corrupt` for the watchlist snapshot | A malformed sibling beside a valid snapshot is `snapshot_corrupt` (documented overload) | The contract has no other reason, and inventing one is contract drift (L1-8). |
| 13 | `[SYM]` in table C | "filled from the record, never invented" | Only the version's **own** condition symbols (1–3), else the line is not rendered (the status chip still says "Review due") | The parent list's tickers are mutable and, in the editor, the live unsaved input (spec §2.6; BUILD_RULES §9; reviews L1-2 / L4-6). P1a writes no conditions, so the review lines will first render when P1b supplies a frozen source. |
| 14 | `invalidated` line | Table C `[typed condition]` | Not rendered in P1a | A raw reason code (`close_below_slow`) is not a rendering of the met condition; P3/P4 define it (L1-6). |
| 15 | Spec §2.5 `battle_ended` host | `completeBattle`'s transaction | The review pass (founder decision D2) | As decided. |
| 16 | Phase 0 #18 (encounter step in `agent-evaluate`) | Proposed | Not built | The prompt defers the evaluation-encounter host; `agent-evaluate.js` untouched. |
| 17 | Sibling fields read | Phase 0 Q4: `{hypothesisVersion, contentHash}` | `{hypothesisVersion, watchlistId}` (as the prompt) | `contentHash` is not validated here; P1b writes it. |

---

## 5. BUILD_RULES §2 review

**Threshold met** (37 files, +4,725 / −25 on the branch). Run as a multi-lens adversarial review with subagents, each on its own `git archive` snapshot tree under the session scratchpad (`node_modules` linked), read-only on git and on every other tree; the mutating lens ran last on its own tree. 9 agents in all: 5 lenses (L1 spec, L2 concurrency, L3 gate and boundaries, L4 client, L5 mutation) and 4 verifiers (one per read-only lens). The re-run of the mutation survivors against the fix rows was performed by the builder with the lens's own harness, on a fresh tree.

### 5.1 Lenses and verdicts

Every finding was handed to a separate verifier instructed to **refute** it with a concrete repro. Severity is the verifier's.

| ID | Finding (short) | Verdict | Disposition |
|---|---|---|---|
| L1-1 | A sibling with no frozen snapshot reads as `agent_initiative` | **REFUTED** — contract H1 defines initiative by the absent snapshot; unreachable in P1a | No change; P1b to write the sibling only beside a non-null snapshot (§8) |
| L1-2 | `[SYM]` falls back to the live list tickers | PARTIAL (low, inert in P1a) | **Fixed** — record-only `[SYM]` |
| L1-3 | First-version editor says "No time-frame" while the server applies the parse horizon | CONFIRMED (low) | **Fixed** (with L4-4) — "Default for this list" |
| L1-4 | `superseded` reason recorded nowhere | **REFUTED** | Comment added (§4 row 5) |
| L1-5 | Reject/cancel: constant reason vs "typed player reason" | PARTIAL (nit / founder question) | §4 row 6 — your call |
| L1-6 | `invalidated` fills `[typed condition]` with a raw code | CONFIRMED (low, inert) | **Fixed** — not rendered until P3/P4 |
| L1-7 | Calendar runway ends before its own update deadline | CONFIRMED (low, dated) | Separate task offered (§8) |
| L1-8 | Malformed sibling labelled `snapshot_corrupt` | CONFIRMED (nit) | Documented overload (§4 row 12) |
| L2-1 | Retry after a lost response → false `op_conflict` (client read `expectedVersion` at submit) | PARTIAL (low) | **Fixed** — the editor freezes its request at open; a 409 conflict closes it |
| L2-2 | Due-phase rows never consumed are re-read from the head; empty allowlist still reads | PARTIAL (nit/low) | **Fixed** — persisted due cursor; return before any read when nobody is admitted |
| L2-3 | Edit an activated version, then its horizon elapses → a superseded `review_due` that cannot be reaffirmed | CONFIRMED (low, inert in P1a) | Partly mitigated (closable from its history row); the rule is a **P1b decision** (§8) |
| L2-4 | List route read pointer and versions non-atomically | CONFIRMED (nit) | **Fixed** — read-only transaction |
| L3-1 | Off caller got 405/401 instead of 404 | PARTIAL (low) | **Fixed** — allowlist before method; 401 for no token kept (§4 row 2) |
| L3-2 | `npm run test:rules` red: the emulator copy of the wildcard tripwire not narrowed | CONFIRMED (by the builder's own full emulator run) | **Fixed**; full rules suite now green |
| L3-3 | "Orphan unreadable even by the uid it names" overstated | CONFIRMED (low) | **Fixed** — comment and test header restated; posture pinned |
| L3-4 | Review-pass cursor write invisible to the write ratchet | PARTIAL (nit) | Named in the ratchet note (same blind spot as the call sweep's cursor) |
| L3-5 | Flag docstring names the allowlist variable in a client-shipped file | CONFIRMED (nit) | **Fixed** |
| L3-6 | Rollback claim "versions stay unread" overstated (pointer fields stay on the lists) | CONFIRMED (nit) | **Fixed** (docstring) |
| L3-7 | Missing §4 dependency-surface comment in `model.test.js` | CONFIRMED (nit) | **Fixed** |
| L4-1 | Panel flashes "Idea / Loading…" for gated-off players; first-load failure leaves an error card | CONFIRMED (core) / PARTIAL | **Fixed** — nothing renders until the server admits the player |
| L4-2 | Same as L2-1, client side | PARTIAL | **Fixed** |
| L4-3 | An unedited save-as-new makes an identical draft and removes "Mark ready" | PARTIAL (low) | **Fixed** — no-op guard (create only); "starts as a draft" disclosed |
| L4-4 | Duplicate "No time-frame" option; mislabelled default | CONFIRMED (medium) | **Fixed** |
| L4-5 | Busy cleared before the reload; stale prefilled editor could revert v2 | CONFIRMED | **Fixed** — busy until the reload lands + request frozen at open |
| L4-6 | `[SYM]` from live inputs | CONFIRMED (low, latent) | **Fixed** (with L1-2) |
| L4-7 | Superseded open versions not closable in the Forge | CONFIRMED (low) | **Fixed** — closing moves on history rows |
| L4-8 | Small client loose ends (reload after `disabled`, unused copy, count, unscanned strings) | CONFIRMED (nit) | **Fixed** — and the routes' own copy is now scanned for table E |

**Tally (lenses L1–L4): 27 findings — 17 CONFIRMED, 8 PARTIAL, 2 REFUTED.** No critical; no data, gate or fence exposure found.

### 5.2 Mutation lens (L5)

133 single-point mutations at `fd1edf22`: **113 caught, 20 survived** — 19 real gaps (L5-1 … L5-10: the client service and mount had no unmocked rows; the reaffirm retry; the host passing the handler start time; the `dueAtMs == now` boundary; the queue row's fresh re-read; in-attempt deadline aborts; individual reaffirm guards and a pointer naming a missing version; the required statement; two post-gate error codes; a mistitled horizon row) and **1 equivalent** (a UTC-date walk, brute-forced over 68,448 quarter-hour instants with zero differences inside the maintained calendar). Each gap got a row (`c13c8f16`). **Re-run of the 19 survivors with the lens's own harness against the new rows: 19/19 CAUGHT, every restore sha256-verified.** Net: 132 / 133 caught.

### 5.3 Rules mutants (builder, emulator)

Run through the suites' `COMPOSITION_RULES_TEXT_PATH` knob, no tree edits: `list`→`read` on the collection-group rule (caught by the **missing-parent** row), dropping the parent check, a readable queue, an unconstrained collection-group `list` (caught by six behavioural rows), a writable version — **5/5 caught**.

---

## 6. Test runs

| Run | Where | Result |
|---|---|---|
| Full suite, CI-shaped (`--maxWorkers=2`, as `.github/workflows/tests.yml`), `TZ=UTC` | WSL Ubuntu, code-final head `c13c8f16` | **18,282 passed, 0 failed** (18,369 rows incl. 87 skipped; 256 s; exit 0) |
| Full suite, CI-shaped | WSL, client head `79b0e98c` (pre-review) | 18,240 passed, 0 failed |
| Full suite, base | WSL, `8c9ea5ef`, default parallelism (3 runs) | 0 failed (103–107 s) |
| Full suite, default parallelism (20 workers) | WSL, branch heads | 1 row timed out in every branch run: `api/cron/film-tape-backfill.e2e.test.js` "the next candle morning…" (5.7–6.2 s vs its 5 s limit; **4.4–4.6 s at base**; **1.40–1.47 s alone on both commits**). The same concurrent file set ran ~30% slower in branch runs from the first seconds — scheduling contention from the reshuffled file order, not code (the branch touches nothing that test imports). The CI-shaped run is green. Recorded for separate tasking: the row sits at ~90% of its timeout at base. |
| Emulator rules suite (`npm run test:rules`) | Windows (Java 21), worktree at `fd1edf22` (rules unchanged since) | **22 files, 389 tests, all green** (first pass at `79b0e98c` was red on `agentEvalRunsDenials` — review L3-2) |
| `npm run lint:gate` | LF archive of the pushed head | **green** (exit 0) — run on an LF `git archive` of this report's own commit, immediately before the push |
| `vite build` | LF archive of the pushed head | **green** (exit 0) — same archive; the pushed commit is the built commit |
| Save golden vs `main` | LF archive of `8c9ea5ef` running the gate-off save rows | 2/2 pass — the golden is `main`'s write bytes |

---

## 7. Firebase Console steps (index-drift note: the file entry **and** a Console index are both required)

Do these after merge and **before** flipping `HYPOTHESIS_RECORDS_ENABLED`:

1. **Index.** Firebase Console → project **tradeseven** → **Firestore Database** → **Indexes** → **Composite** → **Create index**.
   - Collection ID: **`hypothesisVersions`**
   - Query scope: **Collection group**
   - Fields, in order: **`userId` — Ascending**, **`status` — Ascending**, **`stateChangedAt` — Descending**
   - **Create**, then wait until its status reads **Enabled**.
   (Equivalent CLI: the entry in `firestore.indexes.json`; the repo's drift note prefers the Console plus the file until the drift cleanup lands.)
2. **Rules.** Firestore Database → **Rules** → publish the branch's `firestore.rules` (the house's manual deploy), or `firebase deploy --only firestore:rules --project tradeseven`. The new blocks are additive; `hypothesisReviewQueue` / `hypothesisReviewState` are default-denied even before they are deployed.
3. **No other index is needed:** the review pass's two queue queries ride automatic single-field indexes on `dueAtMs`; the per-list version query orders by `version` on a single subcollection (automatic).

---

## 8. Carry-forwards (P1b and separate tasking)

1. **P1b — the review clock.** Call `computeReviewDueAt` at activation and handle `calendar_unavailable` explicitly (never a failed deploy, never a silent `null`); arm rows with `armReviewRow` (it buffers a `set` — decide re-deploy semantics). Rows for unspecified horizons are keyed to a battle id.
2. **P1b — supersession rule (L2-3).** An activated version edited into a draft successor, whose horizon then elapses, becomes a superseded `review_due` that cannot be reaffirmed (only retired). Decide: e.g. allow reaffirming a due version whose successors are all pre-deploy (creating `v{current+1}` in `ready` on a pointer compare-and-set), and surface the superseded due version's line in the Forge.
3. **P1b — provenance (L1-1).** Write `equippedHypothesis` only beside a non-null frozen snapshot (a test); the reader treats a sibling without a snapshot as `agent_initiative` per contract H1.
4. **P1b — `[SYM]` source.** The table-C review lines need a frozen symbol source (e.g. the deploying battle's frozen snapshot via `lastDeployedBattleId`); until then they do not render.
5. **P1b — `PILOT_JOURNEY_MODE` readers** must resolve unknown values to `'off'`.
6. **Founder question — reject/cancel reasons** (§4 row 6).
7. **Separate task (offered in-session) — market calendar 2028** (`src/utils/marketCalendar.js`): add 2028 and move the TODO well before the year end (§4 row 3).
8. **Separate tasking — `film-tape-backfill.e2e` timeout headroom** (§6): the row runs at ~90% of its 5 s limit at base under default parallelism.
9. **Draft-vs-ready asymmetry** until P2: an edited idea is a draft with no path to `ready` (by spec); P2's research step closes it.

---

## 9. Branch and PR

Branch `claude/pilot-p1a-hypothesis-records`; commits listed in §1; this report is the last commit. Pushed, PR opened, and stopped — the founder reads CI and merges. Crons do not run on Vercel preview: the review pass is verified by its unit and host tests and, after P1b arms rows, by observing the first production run.

*Build report — Pilot P1a, Claude Code, 7 October 2026, base `8c9ea5ef`.*
