# Build report — Pilot P2: Research Records (record-only)

**Prompt:** "Build Prompt — Pilot P2: Research Records (record-only)", Fable, 7 October 2026. **Session:** Claude Code, 7 October 2026, in a private worktree. **Branch:** `claude/pilot-p2-research-records`, cut from `origin/main` at **`2519d1c8`** after `git fetch origin main` (PR #937 — P1a — merged, so every input was present; no STOP). **Decisions in force:** D1–D3 (as P1a), **D4** (a player can mark their own draft researched).

**Governing documents (verified with `git ls-tree` at `2519d1c8`):** `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` (§3–4; §2.5 as amended here), `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md` (§E), `docs/audits/20261005_PHASE0_PILOT_P1_P2_RECORDS.md` (Q6), `docs/audits/20261007_BUILD_PILOT_P1A_HYPOTHESIS_RECORDS.md`, `docs/BUILD_RULES.md`.

---

## Executive verdict

| Question | Answer |
|---|---|
| What does a player get (once the founder flips the flag)? | Every research session that produces or examines an idea keeps **one research record**: how many stocks were looked at, how many survived each step, how each ended up, how many model calls, how long, and how the session ended. A saved idea **links to the research behind it**. A player can **mark their own draft "researched"**, and the record says they did. The Forge's Idea panel shows a short research line. |
| Does the agent see or trade anything differently? | **No.** No prompt, tool schema, shortlist, deploy or trade path changes. The model client gained an **opt-in** way to report the provider's token counts; nothing that does not opt in gets anything different, and the request sent is byte-identical. |
| Is it live? | **No — dark.** It rides P1a's gate: `HYPOTHESIS_RECORDS_ENABLED = false`, and even when true only for owners on the cockpit's server-side allowlist. **With the gate off, every touched route answers, reads, writes, logs and calls the model byte-identically to `main`** — proven against `main`'s own code across 39 scenarios × 3 gate-off states (§3 row 1). |
| Fence contact? | **None.** No fenced file, no `agent-evaluate.js`, `equip-watchlist.js` or `completeBattle` edit; no prompt or tool schema touched. `watchlist-dialogue.js` changed only to mint the record and record telemetry. No fenced function is called. |
| Acceptance (13 rows) | **All 13 met** (§3). |
| Tests | Linux suite of record (CI-shaped `--maxWorkers=2`, `TZ=UTC`): **18,610 passed, 0 failed (18,697 rows incl. 87 skipped; 256 s; exit 0)** at the code head. Emulator rules suite (Windows, Java 21): **23 files / 403 tests green**. `lint:gate` and `vite build`: **green** on an LF archive of the pushed head. |
| Review (BUILD_RULES §2) | Mandatory (39 files, +4,163 / −73 before this report). **4 lenses + 4 refuting verifiers + a mutation lens.** 39 lens findings → **28 CONFIRMED, 11 PARTIAL, 0 REFUTED**; every one fixed or dispositioned. Mutation: **243 mutants, 225 caught** after the rows the lens asked for; 11 survivors unreachable by construction and 7 equivalent, each argued (§6). |
| Where the code departs from the prompt | Read §4 — the ones that need your eye: **the analysis-session words** in the Forge line ("in the set · with data"), a **second list saved from one screener session** names no record, the **failed-turn write is awaited but time-boxed**, and versions cite open analysis records (the spec §8.2 cardinality). |
| Things for you | §8 founder questions; §9 is the **one flip checklist for the whole record slice (P1a + P2)**: two Console indexes, the rules, the allowlist, the flag, and the first three things to try. |

---

## 0. Preamble

- **Session open.** `git fetch origin main` first; `origin/main` = `2519d1c8` ("Merge pull request #937"). The session ran in its own worktree (`.claude/worktrees/pilot-p2-research-records-b53abd`) on branch `claude/pilot-p2-research-records` cut from `origin/main`; the shared checkout was not used. Every commit staged explicit paths after re-checking the branch in the same command.
- **Inputs.** All five documents present on `main`; the P1a report exists → no STOP.
- **Fence and boundary check.** `git diff 2519d1c8..HEAD --stat` touches none of `api/agent/decide.js`, `api/_utils/agentBattleService.js`, `api/_utils/agentSwapExecution.js`, `api/_utils/agentPromptAssembly.js`, `api/_utils/agentEvalPromptAssembly.js` (nor any other §1 fenced file), `api/cron/agent-evaluate.js`, `api/agent/equip-watchlist.js`, `completeBattle`, any prompt module (`voiceLayerPrompt*`) or any tool schema. Lens R3 verified this independently, hunk by hunk for `watchlist-dialogue.js`.
- **Linux runs** used a private WSL clone (`~/pd-p2`); the shared `~/pd-amendd` was in another session's use and was not moved.

---

## 1. What changed and where

**Commits** (`2519d1c8..HEAD`): `225572b2` the build · `56562e9c` acceptance rows · `de78c913` §2 review fixes · `38a0ca47` rows that kill the mutation lens's survivors (+ two small code fixes it surfaced) · this report.

### 1.1 The record

| File | What |
|---|---|
| `src/constants/researchRecords.js` (new, dependency-free) | The one vocabulary: origins, states, the six stages in pipeline order, **`STAGES_BY_ORIGIN`** (which stages each host has — the rest are `null`), outcomes, the evidence-ref kind. Imported by the server model and the Forge. |
| `api/_utils/researchRecords/model.js` (new, pure) | Identity — `researchWorkIdFor :99` (the id is derived from the host), `isResearchWorkId :107`, `researchRefOf :110`; `stagesFor :162` (present stage → count, absent → `null`, a missing count throws); the funnels `dialogueFunnel :186`, `screenEntryOf :217`, `savedScreenOf :238`, `screenerFunnel :268`, `analysisFunnel :313` (cumulative), `manualFunnel :349`; telemetry `budgetOf :354`, `emptyTelemetry :360`, `usageOf :370`, `applyTurn :381`; the record `buildRecord :413` and its patches `subjectPatch :443` (set once), `turnPatch :457` (open records only), `closePatch :474`; `recordSummaryOf :494` (what the Forge is shown). |
| `api/_utils/researchRecords/store.js` (new) | `mintWithHost :59` (host + record in one transaction; a retry finds the record and writes nothing), `recordTurnOutcome :89` (a failed or discarded turn: awaited, one attempt, ≤ `TURN_OUTCOME_DEADLINE_MS :78` = 1.5 s, never throws), `readListResearch :132` (one bounded query, `LIST_RESEARCH_READ_MAX :31` = 200; attached = subject is the list), `researchRefsOf :150`, `researchSummariesOf :160`, `safely :42`. |

### 1.2 The hosts (gate on for the caller only)

| File | Mint | Successful turn | Failed / discarded turn | Close |
|---|---|---|---|---|
| `api/screener/chat.js` | first turn — `mintWithHost` `:425` (record id `:213`) | in the turn transaction: record read, `turnPatch` `:456` (+ this screen into `telemetry.screens`) | `noteTurn` → `recordTurnOutcome` `:167` (model failure, timeout, unparseable reply, rankings missing, 409 → cancellation, catch-all) | by the screener create in `watchlists.js` |
| `api/forge/watchlist-dialogue.js` | first turn, paste and theme — `:1400` (id `:1039`) | `turnPatch` in the turn transaction `:1448` | `:831` | save (`watchlists.js`) or abandon |
| `api/forge/watchlist-dialogue-abandon.js` | — | — | — | `user_close` → `closePatch` `abandoned` `:136`, in the abandon transaction |
| `api/forge/watchlist-analysis.js` | session creation (open turn or first message) — `:428` (id `:405`) | `turnPatch` with the cumulative funnel `:621` | `:334` | never (the host has no terminal writer; none added) |
| `api/forge/watchlists.js` | manual create `:203–211` | — | — | dialogue save `closePatch` `:559` (v1 cites the record; the list names it); screener create `:332–355` (links the session; closes the session's open record against this list) |

Every host resolves the gate once, with no I/O (`hypothesisRecordsOnFor`), opts into provider usage only on a recorded turn (`includeUsage` — e.g. `chat.js:262`), marks `turn.persisting` before its persist step (from there on a failure is never counted: before the commit it is ambiguous, after it the turn is already counted), and wraps all record arithmetic in `safely` so a defect in the record can never fail the host's own write.


### 1.3 P1a touch points, the model client, the client

| File | What |
|---|---|
| `src/constants/hypothesisRecords.js` | D4: `STATE_REASONS.playerMarkedResearched` `:50`, `PLAYER_TRANSITIONS.mark_researched` `:71` (draft → researched). The transition route needed no edit (it accepts the table's keys). |
| `api/_utils/hypothesisRecords/model.js` | Typed evidence refs `isEvidenceRef :128`, `mergeEvidenceRefs :132`; **`isDialogueList :226`** (a dialogue list names its session AND its drop) and `originOf :236`; `buildSaveVersion` cites the record `:277`. |
| `api/_utils/hypothesisRecords/store.js` | `attachedResearchOf :133` (read before the version transaction); create `:153` and reaffirm `:193` cite every attached record; `listVersions(withResearch) :263`. |
| `api/forge/watchlists/[id]/hypothesis-versions.js` `:51` | GET carries `research[]` (summaries). |
| `api/_utils/gemmaClient.js` | Opt-in `includeUsage` `:92`; `providerUsageOf :239`; first-attempt-only `:340`. |
| `src/components/Search/ScreenerView.jsx` | The screen remembers the session it came from `:211`; the save sends it `:294`. |
| `src/components/Forge/Watchlist/ideaCopy.js` | `RESEARCH_COPY :104`, `STAGE_LABELS :113`, `LINE_STAGES :135`, `researchLineOf :153`, `researchStateOf :166`, `researchLinesOf :180`, `noResearchRecorded :199`, `ACTION_LABELS.mark_researched :96`. |
| `src/components/Forge/Watchlist/IdeaPanel.jsx` | The research block `:233–241`, the player-marked label `:185`. |
| `src/utils/watchlistProvenance.js` `:32` | "ATLAS" keys on the drop alone (a screener-linked list stays "MANUAL"). |
| `src/config/featureFlags.js` `:3039` | The flag docstring now covers P2 (effects, flip prerequisite, rollback). |
| `firestore.rules` `:1238` | `match /researchWork/{researchWorkId}`: owner read on `resource.data.userId`, `allow write: if false`. |
| `firestore.indexes.json` `:648` | `researchWork` composite: `userId ASC, createdAt DESC` (collection scope). |
| `api/_utils/compositionProtectedStoresAllowlist.json` | Write-site ratchet: 5 new keys, 5 counts 1 → 2, human-review notes `_notes_pilot_p2` `:425`. |
| `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md` `:140` | Amendment B, verbatim from the prompt; nothing else in the spec changed. |

### 1.4 Tests

New: `api/forge/researchRecords.gateOff.test.js` (row 1, goldens captured on `main`), `researchRecords.hosts.test.js` (rows 2–7), `researchRecords.joins.test.js` (rows 8–9), harness `api/_utils/__fixtures__/researchHostHarness.js`; `api/_utils/researchRecords/{model,store,rulesIndex}.test.js`; `api/_utils/gemmaClient.usage.test.js`; `test/rules/researchWorkDenials.rules.mjs`; `src/components/Forge/Watchlist/{researchLine.test.js,IdeaPanel.research.jsdom.test.jsx}`; `src/components/Search/ScreenerView.saveLink.jsdom.test.jsx`. Existing tests changed: §4 rows 13–14, and `src/utils/watchlistProvenance.test.js` (a session without a drop is not "ATLAS").


---

## 2. The research record as built

`researchWork/{researchWorkId}` — one document per research run, server-written (Admin SDK), owner-readable.

| Part | Fields | Notes |
|---|---|---|
| Identity (write-once) | `schemaVersion: 1`, `researchWorkId`, `userId`, `origin` (`signaldrop` · `theme` · `screener` · `analysis` · `manual`), `host` `{collection, id}` (null for manual), `createdAt` | **The id is derived from the host**: `rs_<researchSessions id>`, `ws_<watchlistSessions id>`, `as_<analysisSessions id>`, `wl_<watchlist id>` (manual). One host document can never own two records; a retried mint computes the same id, finds the record, writes nothing. |
| Subject (set once) | `watchlistId`, `hypothesisVersion` | Written together, at most once (only while `watchlistId` is null) — when the record attaches to a list. A list names only a record attached to it. |
| Funnel | `stages` {`universeSize`, `matchedPreLimit`, `shortlisted`, `selectedForInvestigation`, `investigationsCompleted`, `eligible`}; `symbols` [{`symbol`, `outcome`, `reason`, `offUniverse?`, `addedAtSave?`}] ≤ 100 + `symbolsTruncated` | A stage the host does not have is `null`, never 0 (`STAGES_BY_ORIGIN`). Counts come from the full cohort, even when the stored list is cut at 100. While a record is open, a member nothing has decided yet carries `outcome: null`; a closed record decides every member. |
| Budget | `{currency: 'persisted_messages', allotted, used}` | From the host's `messageBudget` / `messagesUsed` after the turn. `null` for manual (no host). |
| Telemetry | `attempts`, `completions`, `failures`, `cancellations`, `elapsedMs`, `firstTurnAt`, `lastTurnAt`, `tokens` (`{input, output}` or `'unknown'`); the screener adds `screens[]` (≤ 40, each turn's universe / matched / returned / symbols) | `elapsedMs` sums the measured model-call step. Tokens stay a known sum only while every turn's usage came from the provider; one turn without it makes the total `'unknown'` for good. The first/last turn times only widen. |
| Terminal | `state` (`open` · `completed` · `abandoned` · `failed`), `terminalReason`, `endedAt`, `updatedAt` | **A closed record never moves** — not its funnel, not its telemetry. Nothing in P2 writes `failed` (no host has a failure terminal). |

### 2.1 Per-origin mapping, as built

| Origin · host | Mint point (same commit as the host) | Stages present (everything else `null`) | Outcomes | Ends |
|---|---|---|---|---|
| SignalDrop / theme · `watchlistSessions` | the first successful turn — the turn that creates the session, on both the paste and the theme path | `shortlisted` = candidates proposed; `selectedForInvestigation` = candidates not removed; `eligible` = symbols the save carried (0 until then) | removed → `rejected` / `removed` (the host stores no actor — never "player_removed"); at save → `eligible` / `saved_to_list`; at abandonment → `cancelled` / `user_close`; otherwise open (`null`) | save → `completed` / `saved_to_list` (subject: the new list + v1 when one is made; v1 cites the record); `user_close` abandon → `abandoned` / `user_close`; a `finalize_intent` abandon leaves it open (the save closes it) |
| Screener · `researchSessions` | the first successful turn | `universeSize`, `matchedPreLimit`, `shortlisted` (= returned) from ONE stock screen; `eligible` = symbols saved (0 until a save). While open: the latest stock screen (0s before any screen ran; an industry roll-up never feeds the stock stages). At save: the latest recorded screen that returned **exactly** the saved symbols, else the latest that returned all of them, else the one with the most overlap. Every screen stays in `telemetry.screens` | returned + saved → `eligible` / `saved_to_list`; returned, not saved → `rejected` / `not_saved`; saved but not returned by that screen → `eligible` / `saved_to_list` flagged `addedAtSave`; open → `null` | a list created from it → `completed` / `saved_to_list` (subject: that list, version `null`). Otherwise stays `open`. A **second** list from the same session names the session (`sourceSessionId`) but no record (`researchWorkId: null`) — the record describes the first save. |
| Analysis · `analysisSessions` | session creation — the open turn (no model call) or the first message turn | **`selectedForInvestigation` = `digest.size`** (the saved list's symbols under analysis, ≤ 40); **`investigationsCompleted` = `digest.covered`** (members the digest had ranking data for). **Cumulative over the session**: a member the player drops mid-session stays counted; a member once covered stays covered; no stage decreases. No universe, match, shortlist or eligibility stage | off-universe (never covered) → `data_missing` / `off_universe` flagged `offUniverse`; covered → `null` (the analysis decides no eligibility, and the session never closes) | stays `open` — the host has no terminal writer; none added. **Subject at mint: the list + the `currentHypothesisVersion` of the same list snapshot the session's cohort came from** (null if none). |
| Manual · no host | list creation | none — all six `null` | no cohort | `completed` / `player_authored` at creation; budget `null`; telemetry zeros, tokens `{0, 0}` (no call was made) |

**Turn kinds.** *Completion*: the turn persisted. *Failure*: the model call failed (including a timeout), the reply could not be parsed, the rankings document was missing after the call, or the catch-all fired after the call but before the persist step. *Cancellation*: the model answered but the host discarded the turn on a lost concurrency check (the 409 paths — the session closed, the budget was consumed, the phase moved). A throw from the persist step itself is **not counted** (it may follow a committed turn; logged as "outcome unknown"). A throw after the turn persisted is not a failure. A first-turn failure creates no host document and therefore no record (the host itself keeps nothing). `attempts` counts the host's model calls; the model client's own internal retry happens inside one attempt, and `elapsedMs` is the measured duration of that call step (including the client's retry back-off when it retried).

**The joins.** Research → version runs two ways and never edits a version: (1) a version cites research in its `evidenceRefs` when it is created — the dialogue's automatic v1 cites its record; versions the player creates or reaffirms in the Forge cite **every record attached to the list** (a record is attached when its subject is the list), read just before the version's transaction; (2) a record that starts later (an analysis session) names the version through its subject.

---

## 3. Acceptance results

Linux suite of record = a private WSL Ubuntu clone, `TZ=UTC`, `--maxWorkers=2` (CI's own command). The emulator rules suite ran on Windows (WSL has no Java).

| # | Acceptance row | Result | Proof |
|---|---|---|---|
| 1 | Gate off: every touched host's responses and writes, the create/save paths, and the dialogue, screener and analysis prompt bytes byte-identical to `main` | **Met** | `api/forge/researchRecords.gateOff.test.js`: **39 scenarios × 3 gate-off states** (flag off; flag on, caller off the allowlist; flag on, nobody admitted) — screener, dialogue (paste + theme), abandon, analysis, the dialogue save, the screener create (with, without and with a malformed session id), the manual create, the P1a routes — through every exit the build touched: new and continuing turns, model failure and timeout, unparseable replies, missing rankings, the 409s, the catch-all after the model answered, budget exits, idempotent abandon and save. Each trace (status, body, every read, query and write with its payload, transaction attempts, every shadow-log call's arguments, every model call's arguments incl. the system-prompt bytes) is hashed in its own key order. **The goldens were captured by running this same file against `main`'s own code** (an LF archive of `2519d1c8`); the branch's capture file is byte-identical to `main`'s (`cmp`), and the committed file passes on both (118/118 each). The real prompt builder, screener and cohort digest run; only the model's HTTP call is replaced. Non-vacuity: lens R3 ran a 58-scenario variant — identical gate-off, 35/58 differ gate-on. Mutation: every gate-forcing mutant (10) is caught by these goldens in all three states. |
| 2 | One record per host document; a retried mint returns the same id; no record or stamp with the gate off | **Met** | `researchRecords.hosts.test.js` row 2 (each host; the session and its record in one commit; later turns mint nothing; a retried mint answers the same id and writes nothing; a contention retry still makes one; gate off → no record, no `researchWorkId` key on any host) + `store.test.js` |
| 3 | Funnel per origin: present stages correct and cumulative, absent `null` never 0, each symbol once per stage, outcomes disjoint and covering the cohort, zero matches a valid `completed` record | **Met** | row 3 (screener open/saved, clarifying/industry/zero-match screens, dialogue, analysis, the zero-qualifying save closing `completed`), an invariant helper run on every record, `model.test.js` (each origin, truncation, dedupe, exact-vs-superset screen, cumulative analysis) |
| 4 | Telemetry: success and failure both counted; a failed turn's response unchanged; tokens `'unknown'` when not supplied; elapsed recorded | **Met** | row 4 (measured elapsed via the clock; provider tokens summed; `'unknown'` sticky; a failed turn's answer equals the gate-off answer byte for byte; timeout and unparseable = failures; a discarded turn = cancellation; a failing record write never changes the answer) + the review rows (a post-persist throw is not a failure; an ambiguous persist error is not counted) + `store.test.js` (one attempt, a deadline) |
| 5 | Screener link: `sourceSessionId` + `researchWorkId` with the gate on, `null` with the gate off | **Met** | row 5 (+ another player's / malformed / absent id → no link; a session with no record → linked, `researchWorkId: null`; a second list → session named, no record) and the client: `ScreenerView.saveLink.jsdom.test.jsx` (the request carries the screen's own session, also after a later failed turn reset the composer) |
| 6 | Manual: a record with all stages `null`, reason `player_authored` | **Met** | row 6 (the whole record, literally) |
| 7 | Abandon: `abandoned`, open candidates `cancelled` | **Met** | row 7 (+ idempotent re-abandon moves nothing; `finalize_intent` leaves it open and the save closes it) |
| 8 | Joins: v1 cites its record; Forge versions cite the list's records; an analysis record names the version current when it ran; no version document updated by this build | **Met** | `researchRecords.joins.test.js` row 8 (incl. reaffirm, another player's record never cited, a record attached to another list never cited, the reads happening outside the version transaction, every version write a create or P1a's own successor pointer) |
| 9 | `mark_researched`: legal only from `draft`, compare-and-set, the reason recorded, illegal from every other status, the drift guard updated | **Met** | joins row 9 + the route matrix in `watchlists.hypothesisRecords.test.js` row 4 (it iterates the shared table, so it now covers 10 statuses × 6 actions) + the independent restatement in `hypothesisRecords/model.test.js` (updated) |
| 10 | Model-usage census documented; existing callers' outputs unchanged | **Met** | §5 + `gemmaClient.usage.test.js` (no opt-in → `toStrictEqual({success, content})`; the request body identical; retry → `usage: null`) + the gate-off goldens (the hosts' call arguments unchanged) |
| 11 | Rules: owner read, other-user and anonymous denial, all writes denied; the full rules suite green | **Met** | `test/rules/researchWorkDenials.rules.mjs` (14 rows incl. the Command Center's `userId ==, createdAt desc` query) — **full suite 23 files / 403 tests green**; default-suite tripwire `researchRecords/rulesIndex.test.js` |
| 12 | Forge: only present stages; the player-marked label; nothing new with the gate off | **Met** | `IdeaPanel.research.jsdom.test.jsx` (fresh panel per case, fetch asserted), `researchLine.test.js` |
| 13 | Full suite, rules suite, `lint:gate`, `vite build` | **Met** | §7 |

---

## 4. Where the code departs from, or reads, the prompt, the spec or Phase 0

| # | Topic | Source said | Code does | Why |
|---|---|---|---|---|
| 1 | Record layout | Fields listed flat | `stages` and `telemetry` are nested maps; `schemaVersion: 1` and `updatedAt` added | One place for the funnel and one for telemetry; the Forge and Command Center read `stages` whole. |
| 2 | An undecided cohort member | `outcome ∈ eligible \| rejected \| data_missing \| cancelled \| failed` | `outcome: null` (reason `null`) while the record is open and nothing has decided the member; a closed record decides every member | An open record has members with no outcome yet; inventing one would claim a decision. |
| 3 | Record id | "On retry, return the same id; never mint two" | The id is **derived from the host** (`rs_`, `ws_`, `as_`, `wl_` + the host's id) | Makes one-record-per-host structural and a retried mint idempotent by construction. |
| 4 | Screener before any screen; addition flags | Stages are numbers or null | Before any stock screen the four screener stages are 0 ("nothing screened yet"); a saved symbol the referenced screen did not return is flagged `addedAtSave` — **never `offUniverse`**: the create path cannot know universe membership without reading the whole universe, and the screener client only ever saves screen results | Honest without a guess. The Forge shows no screener line when no screen was recorded. |
| 5 | Screener saved screen | "the record reflects the screen whose results were saved" | Exact match first, then superset, then most overlap (latest wins ties) | A later, wider screen the player never saw must not claim a save of an earlier one (review R1-5). |
| 6 | **Analysis mapping** | "the cohort digest's own counts (covered, off-universe) mapped to the nearest stage" | `selectedForInvestigation` = `digest.size`, `investigationsCompleted` = `digest.covered`, off-universe → `data_missing`; **cumulative over the session** (review R1-8) | The analysis cohort IS the saved list; "covered" is the investigation the digest performed. Cumulative per spec §3 ("each symbol counted once per stage it reached within the declared research run"). |
| 7 | Analysis subject version | "the list's current version when the record was attached" | The version in the same list snapshot the session's cohort came from (read at the top of the request; a model call can sit between) | The record's subject and its funnel describe one list state (verifier V2's recommendation, R2-7). |
| 8 | **Analysis records per open** | Mint at session creation | Each time the analysis view opens it creates a session (pre-existing host behaviour: `WatchlistAnalysisView.jsx` opens without a session id), so each open mints a record with no model call. Kept, as the prompt says; the **Forge never shows a record no model turn completed**, and never lets analysis lines push out the list's own research | Minting lazily on the first model turn would depart from the mint-point table — a founder decision (§8 Q2). |
| 9 | **Failed-turn write** | "a separate awaited write (§5 …) that can never change the turn's response or error" | Awaited, **one transaction attempt, at most 1.5 s**; past the deadline the turn answers as it would have and the write is logged "unconfirmed" (it may still land) | Unbounded, the SDK's retries (5 attempts, back-off up to 60 s on `RESOURCE_EXHAUSTED`) could push the turn past its 30 s function limit after a 25 s model timeout and replace the host's answer with the platform's (reviews R2-2 / R3-4). The loss is logged, never silent. |
| 10 | A closed record after its session goes on | — | **A closed record never moves**, telemetry included | A screener session used after its save no longer runs the record's `lastTurnAt` past its `endedAt` (review R1-1); those later turns are recorded nowhere. |
| 11 | **A second list from one screener session** | Silent | The list names the session (`sourceSessionId`) but **no record** (`researchWorkId: null`); its versions cite nothing from that session | The record describes the first save; showing or citing it on the second list would present another list's numbers (reviews R1-1 / R4-4). Alternative (one record per save) would break "one record per host document". |
| 12 | Versions cite research | "Versions the player creates in the Forge include the refs of every research record already attached to the list at creation" | Create **and reaffirm** cite every record whose subject is the list, read just before the version's transaction ("attached at creation" = when the request was made); at most 200 attached records are read (one bounded query; the list's own record is always read by its id) | Reading inside the transaction tied a player's save to every analysis turn (R2-3). The 200 bound keeps the read finite; past it the subset is deterministic (document-id order). Spec §8.2's cardinality ("`researchWorkId` one per hypothesis version, at research completion") is stricter than the prompt: versions can cite several records, including open analysis records whose numbers still move (R1-9) — the prompt's wording governs here. |
| 13 | **P1a: who is a dialogue list** | P1a: `sourceSessionId` ⇒ dialogue | `isDialogueList` = session **and** drop; `originOf`, the first-version defaults and the client's provenance label (`watchlistProvenance.js`) all key on it | The screener link writes a screener session id into `sourceSessionId`. Every pre-P2 dialogue list carries both fields (the save requires a validated `dropId`; verifier V3 checked the history), so no existing list changes. P1a test fixtures updated (`model.test.js` originOf rows; three `watchlists.hypothesisRecords.test.js` fixtures gained `sourceDropId`). |
| 14 | P1a: evidence refs | P1a accepted non-empty strings | Typed `{kind: 'researchWork', id}` only | No P1a writer ever wrote a string; the only kind any writer produces. P1a's GET answer gains `research[]` (its "empty list" row updated). |
| 15 | Model usage | "if any caller persists … don't change the return shape" | Census found none — the field is still **opt-in** | Every existing caller's result object stays byte-identical (pinned), and the hosts' gate-off call arguments are unchanged. |
| 16 | **Forge copy** | Screener "[n] screened · [n] matched · [n] returned · [n] kept"; dialogue "[n] candidates · [n] kept"; states; player-marked; none | Screener and dialogue lines exactly as given (the dialogue's selection always equals what the save kept, so the record keeps it and the line does not repeat it). **Analysis lines: "[n] in the set · [n] with data"** — words the prompt does not give (never "investigated": "covered" means the member had ranking data). The panel shows the list's own research first and at most its newest analysis session the agent worked on (≤ 2 lines). "No research recorded for this idea yet." only when the list has no record at all and an idea exists (a manual list has its own record; a dialogue-researched version is not "unresearched") | New analysis words need your eye (approve-by-default, §8 Q1). |
| 17 | D4 label lifetime | "the record and the Forge say the player marked it" | True while the version is `researched` by the player's mark; the next move (ready / wait) overwrites `stateReason` as every lifecycle move does (P1a's envelope keeps the current state only) | A durable marker would be a new lifecycle field — §8 Q3. |
| 18 | `research_complete` | Spec §2.5: automatic `draft → researched` by "P2's host record close" | **No P2 writer produces it**: no host completes research on a draft's content (the dialogue's v1 is born `researched` / `dialogue_completed`; screener and manual lists get their v1 later, as drafts). P1a's carry-forward 9 (an edited idea had no path to ready) is closed by D4 | As the prompt: "Automatic `research_complete` transitions keep their own reason." |
| 19 | Action order | — | A draft's moves render in the table's order (Reject · Cancel idea · Retire · Mark researched) | Reordering would rewrite P1a's pinned "exactly the shared table" rows for a nit (R4-10, declined). |

---

## 5. Model-usage census (acceptance row 10)

**Question:** can the hosts' model client (`api/_utils/gemmaClient.js`) return the provider's usage without changing what any existing caller gets?

| Caller | Call | What it does with the result | Persists / spreads / serialises the whole object? |
|---|---|---|---|
| `api/screener/chat.js` (P2 host) | `callGemmaVoiceWithRetry` | reads `success`, `error`, `aborted`, `content`, and — on a recorded turn only — `usage` | no |
| `api/forge/watchlist-dialogue.js` (P2 host) | same | same | no |
| `api/forge/watchlist-analysis.js` (P2 host) | same | same | no |
| `api/forge/workshop-chat.js` | same | `success`, `error`, `aborted`, `content` | no |
| `api/forge/expand-signal.js` | same | `success`, `error`, `aborted`, `content` | no |
| `api/research/correlation-narrate.js` | same | `callModel` returns the object to `generateNarration`, which reads `success` and `content` | no (passed through one function; never stored or sent) |
| `api/_utils/voiceLayerAnticipation.js` | same | `success`, `aborted`, `error`, `content` | no |
| `api/_utils/voiceLayerTradeNarration.js` | same | `success`, `aborted`, `error`, `content` | no |
| `api/agent/chat.js`, `api/agent/decide.js` (fenced — not edited), `api/agent/ensure-opener.js`, `api/cron/agent-batch-review.js`, `api/_utils/directiveGate.js`, `api/scripts/voice-grounding-harness.js` (+ an eval runner) | `callGemmaVoice` | the content **string** | n/a — a string cannot carry usage; `callGemmaVoice` never forwards the option |

**Result.** No caller persists, spreads or serialises the whole result, so an always-on field would have been allowed; the build made it **opt-in** anyway (`includeUsage: true`). A caller that does not pass it gets the identical object (`{success, content}`, pinned with `toStrictEqual`), and the request sent to OpenRouter is byte-identical either way (pinned). The three P2 hosts pass it only on a turn that feeds a record. Usage = the provider's own `usage.prompt_tokens` / `usage.completion_tokens` (non-negative integers) as `{input, output}`, else `null`; a call that needed its retry reports `null` (the failed attempt's consumption was never reported). **Anthropic-SDK hosts:** none of the P2 hosts calls Anthropic; the ones that read SDK usage today (`decide.js`, `agent-evaluate.js`, the regime brief, `parse-signal.js`) are not research hosts in the prompt's table and are untouched. Lens R3 re-ran the census independently (8 + 7 callers) and verifier V2 read the retry and back-off code in the SDK.

---

## 6. BUILD_RULES §2 review

**Threshold met** (40 files with this report; 39 files, +4,163 / −73 before it). Run as a multi-lens adversarial review with subagents, each on its own `git archive` snapshot tree under the session scratchpad (`node_modules` linked), read-only on git and on every other tree: **4 lenses** (R1 spec and record semantics, R2 concurrency and lifecycle, R3 gate-off identity and boundaries, R4 client and copy), **4 verifiers** (one per lens, told to refute), and **a mutation lens** (R5) run last, on its own tree of the fix head. Ids are this build's own (R·, V·), distinct from P1a's L·.

### 6.1 Findings, verdicts, dispositions

Severity is the verifier's. Duplicates across lenses are grouped.

| ID(s) | Finding (short) | Verdict | Disposition |
|---|---|---|---|
| R1-1 · R4-4 | A second list saved from one screener session showed (and cited) the first save's numbers; the closed record kept collecting turns | CONFIRMED (high / medium) | **Fixed** — the list names only the record its save closes (else `researchWorkId: null`); attached = subject is the list (read, panel and citations); a closed record never moves (§4 rows 10–11) |
| R1-2 · R3-1 | With the gate on, the client's provenance label called screener-linked lists "ATLAS" | CONFIRMED (medium) | **Fixed** — `watchlistProvenance.js` keys on the drop; no existing list's label moves (verified against the write history) |
| R1-3 · R4-1 | Opening the analysis view (no model call) made a "Researched with your agent" line; opens pushed the list's own research out | CONFIRMED (high / medium) | **Fixed** (display): summaries carry completed turns; a record no turn completed makes no line; own research first, at most the newest worked analysis. Mint point kept (§4 row 8; §8 Q2) |
| R1-4 · R2-1 · R3-2 · R4-5 | The list-research read was unbounded and kept the 100 oldest: past 100, new research never reached the Forge or a version | CONFIRMED (medium) | **Fixed** — one bounded query (200) + the list's own record by id; summaries own-first then newest analysis; versions cite every record read (§4 row 12) |
| R1-5 | The screener record could describe a wider screen than the one saved | CONFIRMED (low) | **Fixed** — exact before superset |
| R1-6 | A screener funnel with no reference screen read "0 screened … N kept"; a non-count would default to 0 | PARTIAL (low) | **Fixed** — no silent default (a malformed value refuses the patch); no Forge line without a recorded screen; `addedAtSave` vs `offUniverse` declared (§4 row 4) |
| R1-7 · R4-2 | The dialogue line added "N selected" beside the approved "[n] candidates · [n] kept" | CONFIRMED / PARTIAL (low) | **Fixed** — exactly the approved shape |
| R1-8 | Analysis counts were a per-turn snapshot | CONFIRMED (low) | **Fixed** — cumulative over the session |
| R1-9 | Versions cite records that still change (spec §8.2 cardinality) | PARTIAL (info) | Declared (§4 row 12) — the prompt's "every research record" governs |
| R1-10 | A client-internal retry counts as one attempt; `elapsedMs` includes its back-off | CONFIRMED (low) | Declared (§2.1 turn kinds) |
| R1-11 · R2-6 | An ambiguous commit could count a turn twice | CONFIRMED (low / nit) | **Fixed** for the host's catch-all (a persist-step throw is not counted); the SDK's own body re-run after an ambiguous commit can re-apply a turn's patch, mirroring the host's own `messagesUsed` increment — declared |
| R1-12 · R4-8 | "You marked this researched." does not outlive the next move | CONFIRMED / PARTIAL (low) | Declared (§4 row 17; §8 Q3) |
| R1-13 | No automatic `research_complete` writer | CONFIRMED (info) | Declared (§4 row 18) |
| R1-14 | A manual list said "No research recorded" though it has a record | CONFIRMED (nit) | **Fixed** with R4-7 |
| R1-15 | Declare the layout and `outcome: null`; a stale JSDoc; a doc said `sourceSessionId` is dialogue-only | PARTIAL (nit) | **Fixed** (JSDoc) + declared (§4 rows 1–2); the doc claim **refuted** by V1 |
| R2-2 · R3-4 | The awaited failure write was unbounded on the timeout path | CONFIRMED (low) | **Fixed** — one attempt, 1.5 s deadline, logged when unconfirmed (§4 row 9) |
| R2-3 | Version create / reaffirm read (and locked) every attached record | PARTIAL (nit) | **Fixed** — read before the transaction |
| R2-4 | A post-persist throw counted a completed turn as a failure | PARTIAL (nit) | **Fixed** — no failure is counted from the persist step on (`turn.persisting`); the first fix's separate `persisted` flag proved dead code and was removed (§6.2) |
| R2-5 | `lastTurnAt` could go backwards | CONFIRMED (nit) | **Fixed** — the times only widen |
| R2-7 | The analysis subject version comes from the request's list read | CONFIRMED (nit) | Declared as designed (§4 row 7) — V2 preferred this to a re-read |
| R3-3 | The gate-off golden missed most new exits; no shadow logs; key order hidden | CONFIRMED (low) | **Fixed** — 39 scenarios × 3 states, byte (insertion-order) identity, shadow-log arguments and transaction attempts in the trace; goldens re-captured on `main` |
| R3-5 | The ratchet notes under-described the record writes; the report was missing | CONFIRMED (nit) | **Fixed** (notes; this report) |
| R3-6 · R4-11 | A stray whitespace edit in `IdeaPanel.jsx` | CONFIRMED / PARTIAL (nit) | **Fixed**; R4-11's key and screen-reader points **refuted** by V4 |
| R4-3 | "investigated" overclaimed for the analysis line | PARTIAL (low–medium) | **Fixed** — "in the set · with data" (§8 Q1) |
| R4-6 | A looped panel test re-rendered without fetching, so one case could not fail | CONFIRMED (low) | **Fixed** — a fresh panel per case, the fetch asserted |
| R4-7 | "No research recorded…" read wrongly in four cases | PARTIAL (low) | **Fixed** — said only when literally true; (c) refuted by V4 as unreachable |
| R4-9 | A reset composer session could drop the screener link | CONFIRMED (low) | **Fixed** — the screen carries its own session |
| R4-10 | A draft's primary move renders last | PARTIAL (nit) | Declined (§4 row 19) |

**Tally (lenses R1–R4): 39 findings — 28 CONFIRMED, 11 PARTIAL, 0 REFUTED as a whole** (4 sub-claims refuted: R1-15's doc claim, R4-1's "open forever" as a defect, R4-7(c), R4-11's key / screen-reader points). No critical; no gate-off, fence or data-exposure defect: lens R3's own 58-scenario capture and verifier V3's re-run against `main` were byte-identical gate-off.

### 6.2 Mutation lens (R5)

Run last, on its own LF tree of the fix head `de78c913`, against the 33 test files that touch the build (930 rows green at baseline): **243 single-point mutants across all 18 changed production files** — **197 caught, 39 survived, 7 equivalent**.

- **Gate-off control:** every mutant that forces the gate on or sends `includeUsage` (10, across all five hosts) is caught by `researchRecords.gateOff.test.js` in all three gate-off states (3–30 failing golden rows each).
- **21 reachable survivors (R5-1 … R5-21)** — mostly one pattern: a turn exit pinned on one host only (the screener's 503 / 409 cancellation / catch-all / ambiguous commit / budget; the dialogue's model failure and unparseable reply; the analysis 409, first-message mint, unparseable reply, pre-call store failure, ambiguous commit), plus the cumulative-analysis edge (a covered member leaving the universe), the symbol-cap boundary, the summaries cap value, both callers passing the list's own record id past the read bound, a malformed screener id reaching a path, and the panel's error phase. **Each got a row** (`38a0ca47`); the lens had proven each row passes on the head and fails under its mutant.
- **18 low-impact or unreachable survivors** — rows added where cheap (R5-22 … R5-26, R5-28, R5-29: a failed first turn reads no record, a closed record is skipped, no research read before a foreign list's refusal, no dialogue-session read for a screener-linked list, the forward-move styling, `screenEntryOf`'s null, `closePatch`'s validation). **11 remain, unreachable by construction:** R5-27 (merge order, identical within the read bound), R5-30 / R5-31 / R5-32 (no I/O sits between the guard's subject and the model call), R5-33 … R5-37 (record ids derive from the owner's own host id and `mintWithHost` is the only record writer, so the ownership / id equalities cannot fail), R5-38 / R5-39 (only `researchRefOf` produces evidence refs; players cannot send them).
- **7 equivalent** — four concerned `turn.persisted`, which the lens showed was **dead code** (the `persisting` guard already covered the post-persist case): **removed** in `38a0ca47`; one is the model client's internal usage (only opt-in callers read it); two are display / copy aliases with identical results.
- **Lens observation acted on:** the server capped summaries before the client dropped opened-and-left analyses, so 19+ newer unworked sessions could still hide a worked one — summaries now put worked analyses before unworked ones (`researchSummariesOf`), with a row.

**Re-run of every survivor given a row (on a fresh tree of `38a0ca47`, with the same one-line mutants, every restore sha256-verified): 29 / 29 CAUGHT**, plus the two gate-forcing controls (caught by 30 and 21 golden rows). **Net: 225 of 243 caught; 11 unreachable survivors and 7 equivalents, each argued above.** The emulator rules suite was not mutation-checked (no Java in the lens's environment); its three text mutants (owner field, write allowed, index order) are caught by the default-suite tripwire `researchRecords/rulesIndex.test.js`.

---

## 7. Test runs

| Run | Where | Result |
|---|---|---|
| Full suite, CI-shaped (`--maxWorkers=2`, `TZ=UTC`) | WSL Ubuntu (private clone), final code head `38a0ca47` | **18,610 passed, 0 failed (18,697 rows incl. 87 skipped; 256 s; exit 0)** |
| Full suite, CI-shaped | WSL, pre-review head `56562e9c` | **18,470 passed, 0 failed** (87 skipped; 267 s) |
| Emulator rules suite (`npm run test:rules`) | Windows (Java 21), LF archive of `56562e9c` (rules and rules tests unchanged since) | **23 files, 403 tests, all green** (P1a ended at 22 / 389). `firestore.rules`, `firestore.indexes.json` and `test/rules/` are unchanged from that head to the pushed head (`git diff` empty) |
| Gate-off goldens vs `main` | LF archive of `2519d1c8` running the same file | 118 / 118 in capture mode; the capture file byte-identical to the branch's (`cmp`); 118 / 118 in check mode |
| `npm run lint:gate` | LF archive of the pushed head | **green** (exit 0) |
| `vite build` | LF archive of the pushed head | **green** (exit 0) — the pushed commit is the built commit |
| Windows note | CRLF worktree | The default-suite tripwire `agent-evaluate.evalRun.test.js` "exactly ONE block" row fails only on a CRLF checkout (it reads the rule with its trailing `// Admin SDK only`); it passes on LF with this branch's rules (verified), and in the Linux run. Platform-only, not this build. |

---

## 8. Founder questions and carry-forwards

**Questions for you (nothing is blocked on them; the defaults are built):**
1. **The analysis line's words.** The prompt gives words for the screener and the dialogue. For an analysis session the panel says "Researched with your agent: 25 in the set · 24 with data · Research still open". Approve, reword, or hide analysis lines entirely.
2. **Analysis records per open.** Each time the analysis view opens, the existing code creates a new session, and P2 (as the prompt says: mint at session creation) gives each one a record — the Forge hides the ones no model turn completed. Alternative: mint an analysis record only on its first model turn (a departure from the prompt's mint-point table).
3. **A durable "you marked it" marker.** Today the player's mark is the version's state reason, which the next move overwrites (P1a's lifecycle keeps the current state only). A small lifecycle field (`researchedBy`) would make it permanent.
4. **A second list from one screener session** names the session but no research record (§4 row 11). If you would rather it show the session's research, it needs one record per save (a change to "one record per host").
5. **Reject / cancel reasons** — still open from P1a (P1a report §4 row 6).

**Carry-forwards (separate tasking):**
- **Command Center:** if a list ever has more than 200 attached research records, a `(watchlistId ASC, createdAt DESC)` composite would let the read be newest-first and complete (§4 row 12).
- **The analysis view opens a new session on every visit** (pre-existing; P2 mirrors it). Worth reusing the session within a visit if analysis records are kept per open.
- **Model telemetry granularity (R1-10):** the opt-in could also report attempts and per-attempt time if the Command Center wants provider-level detail.
- P1a's carry-forwards stand (P1b review clock, supersession rule, provenance, `[SYM]` source, `PILOT_JOURNEY_MODE` readers; the 2028 market calendar). P1a's carry-forward 9 is closed by D4.

---

## 9. Flip checklist — the whole record slice (P1a + P2)

Everything below happens **after this PR merges**. Until step 4, nothing is visible to anyone and nothing new is written.

**Step 1 — the two indexes (Firebase Console).** The repo's index-drift note requires the Console index in addition to the file entry.
1. Firebase Console → project **tradeseven** → **Firestore Database** → **Indexes** → **Composite** → **Create index**:
   - Collection ID **`hypothesisVersions`** · Query scope **Collection group** · fields **`userId` Ascending**, **`status` Ascending**, **`stateChangedAt` Descending** → **Create**. *(P1a — the ideas across your lists.)*
2. **Create index** again:
   - Collection ID **`researchWork`** · Query scope **Collection** · fields **`userId` Ascending**, **`createdAt` Descending** → **Create**. *(P2 — your research list.)*
3. Wait until both read **Enabled**. No other index is needed: the per-list research read and the review pass's queue reads use automatic single-field indexes.

**Step 2 — publish the rules.** Firestore Database → **Rules** → paste the merged `main`'s `firestore.rules` → **Publish** (or `firebase deploy --only firestore:rules --project tradeseven`). The new blocks (`watchlists/{id}/hypothesisVersions`, the `hypothesisVersions` collection-group list, `hypothesisReviewQueue`, `hypothesisReviewState`, `researchWork`) are additive; anything without a block was already denied.

**Step 3 — admit yourself.** Vercel → the project → **Settings** → **Environment Variables** → **Production**: make sure **`COCKPIT_ALLOWLIST_UIDS`** contains your Firebase uid (comma-separated). An environment change reaches new deployments only — **redeploy production** after editing it.

**Step 4 — flip the flag (its own small PR).** In `src/config/featureFlags.js` set `HYPOTHESIS_RECORDS_ENABLED = true`; in the SAME commit move the pin in `src/config/hypothesisRecordsFlags.test.js` to `true` and drop `HYPOTHESIS_RECORDS_ENABLED` from `DARK_BY_DESIGN` in `src/config/flagPinGuard.test.js` (BUILD_RULES §2). Merge, deploy. **Rollback** = the same line back to `false` (+ the pins): nothing new is read or written; what was written stays, owner-readable and read by no app code.

**Step 5 — the first three things to try in the Forge.**
1. **A SignalDrop idea, saved.** Paste a signal, talk it through, save the watchlist, open it in the Forge. The **Idea** panel shows **v1 · Researched** with your thesis and, under it, **"Researched with your agent: N candidates · N kept"**.
2. **A screened list.** Search → Screener → run a screen (e.g. "Top BaggerBomb fit") → **Save as watchlist** → open it in the Forge: **"Researched with your agent: N screened · N matched · N returned · N kept"**. Then open the list's analysis, ask it one question, and come back: a second line appears, ending **"· Research still open"**.
3. **Your own idea.** Create a blank watchlist → **Write the idea** (it starts as a Draft) → **Mark researched** → **Confirm**. The panel says **"You marked this researched."** — and **Mark ready** is now offered.

---

## 10. Branch and PR

Branch `claude/pilot-p2-research-records`; commits in §1; this report is the last commit. Pushed, PR opened, and stopped — the founder reads CI and merges. No cron is touched; nothing here runs on a schedule. A byte-exact copy of this report was written outside the repo tree (the session scratchpad) per BUILD_RULES §3.

*Build report — Pilot P2, Claude Code, 7 October 2026, base `2519d1c8`.*
