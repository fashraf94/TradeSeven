# Huddle S1 — Build Spec V1.1

**Arc:** DRB redesign ("Huddle" / "game plan"). **Slice:** S1, the huddle itself, dark.
**Date:** Oct 30, 2026 · **Status:** V1.1 adjudicates Astra's review of V1 (AR-1–AR-15, verdict REWORK); for a targeted Astra re-review, then the build prompt
**Supersedes:** `20261030_HUDDLE_S1_BUILD_SPEC_V1.md`. Changes are listed in §14.
**Destination when committed:** `docs/specs/20261030_HUDDLE_S1_BUILD_SPEC_V1_1.md`, carried in the S1 build PR with `docs/design/20261029_DRB_HUDDLE_CONCEPT_V1_2.md`
**Grounded on:** `docs/audits/20261029_PHASE0_HUDDLE_S1_DISCOVERY.md` (branch `claude/huddle-phase0`); re-cite every file:line at HEAD before building

---

## 0. In plain terms

S1 builds the morning huddle end to end, dark behind a flag: at 8:30 ET a job runs per active player, Shadow's script is written from that player's names and overnight news, rendered to speech with word timings, and stored with a transcript. On the hub, a chip under Shadow opens the huddle: audio, transcript, and the game plan card. The plan is built from fixed templates with checked values; the player can change values or remove lines; one tap confirms it. A confirmed plan is written into the instruction slot of every battle the player owns that session, each with a receipt, and the status the player sees is read back from what the agent actually did. Cards are text in S1; charts (S3), grades (S2) and the archetype voices (S4) follow. The old brief keeps being written in the same place, so nothing that reads it breaks.

What never happens in S1: no fenced file is edited, no model-written text reaches the agent, no posture is written, the brief card stays, the flag is off on the client *and* on every server path, and a plan can never be regenerated over a player's confirmation.

---

## 1. Scope

**In**
1. Shared tape layer at 8:30 ET, DST-safe, writing `indexIntelligence/dailyRegimeBrief` in its current shape; staged run markers so enqueueing can resume independently of the brief.
2. Per-player queue (claim, lease, reclaim, attempt cap, generation ownership) and worker (concurrent, abortable, windowed).
3. Template family `plan.v1`: closed schemas, deterministic event IDs, validation, deterministic rendering, frozen confirmation snapshot, per-archetype dissent table.
4. Routes: confirm (optimistic concurrency), skip, apply-to-battle, playback-token issuance, audio stream, status reconcile, measurement events. All gated by the flag server-side.
5. Apply logic in one module with explicit dispositions, used by confirm, the post-deploy hook, and the check-start sweep.
6. Hub: chip under Shadow, the Huddle sheet (lazy module outside the hub directory), Partnership panel content with explicit props, readers through the mount-guard pattern.
7. Flag `DRB_HUDDLE_ENABLED`, dark, pinned, gating client and server.
8. Firestore rules, denial tests, indexes, protected-store scanner entries, baseline entries.

**Out:** chart or diagram cards; grading; archetype voices and dialogue mode; posture / `strategyPreset`; any free-text path to the agent; brief card removal; wake-on-plan; deploy from the huddle; matchup preview; Shared Research "dig in"; the EODHD economic-events switch; a League price series; the pre-market price probe (separate source task); fan-out beyond ~50 players (separate scaling slice).

---

## 2. Rulings in force (plain terms)

- **R-1** *Huddle* / *game plan*; DRB internal. **R-2** All seven voices before the flip; S1 ships Shadow only.
- **R-3 / R-7 / R-15** A confirmed plan applies to every battle the player owns that session (ranked agent, casual clone, training clone), one receipt each; pending until a battle exists.
- **R-4** Matchup preview deferred. **R-5 (as amended by R-11)** Structured edit only.
- **R-6** No fenced file edited; the flip gets a fenced-file *review* (no edits), valid only because every server path is dark until the flip.
- **R-8** Two grades (S2). **R-9** Plans belong to one stock session. **R-10** Flip waits for S1–S4. **R-11** Templates, never model text. **R-12** No posture. **R-13** Grading before 8:30 (S2). **R-14** newsfilter optional. **R-15** All three battle kinds.
- **Standing:** the trading brain never reads the huddle; status comes from receipts; the audio never states confirmation.

---

## 3. Records

New collections are **server-write only**; client read only where stated; default deny stands (`firestore.rules:1438-1441`). Every new collection is added to the protected-store scanner's list (`compositionProtectedStoresScan.js:72`) so its write sites are counted, with matching allowlist keys. Indexes are added for every query below that needs a composite (queue reclaim, cache claims); the builder runs each query against the emulator and records the index it required.

### 3.1 `huddles/{uid}/days/{etDate}` — the huddle record (client read: owner only)
```
session: { etDate, isTradingDay, isEarlyClose, openMs, closeMs }      // getSessionForDate (marketCalendar.js:117)
status: 'queued' | 'generating' | 'ready' | 'failed'
generation: { claimGeneration, startedAt, finishedAt, model, tokenUsage, sourceFailures[], drops[] }
script: { beats: [ { id: 'yesterday'|'tape'|'names'|'armor'|'plan', text, source: 'model'|'code', startMs, endMs } ] }
transcript: string
audio: { gcsPath, alignmentPath, durationMs, voiceId, model }
playback: { tokenHash, issuedAt, expiresAt }                            // rotated by the issuance route (§6)
cards: [ { beatId, kind: 'text', title, lines[], sources: [{ label, url?, asOf }] } ]
names: [ { ticker, source: 'rankedPicks'|'activeBattle'|'watchlist', fact?, factSource?, factAt?, read? } ]
plan: see 3.2
measurement: { listenedAt?, completedAt?, confirmedAt?, skippedAt?, editCount }   // awaited writes (BUILD_RULES:74)
grade: null
```
**Immutability rule:** once `status` is `ready`, a retry never rewrites `script`, `audio`, `cards`, `names` or `plan`; it only repairs the queue row. Once `plan.status` is `confirmed`, nothing in the pipeline touches `plan`.

### 3.2 `plan`
```
templateVersion: 'plan.v1'
status: 'proposed' | 'confirmed' | 'skipped' | 'expired'
proposed: { stances[], lines[] }                 // validated proposal, never mutated
current:  { stances[], lines[] }                 // after edits
revision: sha256(canonical JSON of current)      // changes on every accepted edit
editCount
dissent: [ { index, kind: 'stance'|'line', archetype, reason } ]
confirmed?: { current, revision, renderedText, renderedTextHash, confirmedAt }   // FROZEN at confirm; the only thing ever filed
applications: [ { battleId, battleKind, revision, disposition, at, writtenBy?: 'confirm'|'deploy'|'sweep',
                  directiveThreadId?, heardAt?, heardTickId?, replacedAt?, replacedThreadId? } ]
```
`disposition` ∈ `written` (terminal for that revision) · `skipped_session` (terminal) · `skipped_cpu` (terminal) · `skipped_newer_instruction` (terminal) · `retry_live_call` · `retry_inactive` · `retry_error`. **Only terminal dispositions stop re-application** (Astra AR-3). Receipts live here, never on the battle (`file-directive.js:65-68`).

### 3.3 `huddleQueue/{uid}_{etDate}` — job row (no client access)
```
uid, etDate, status: 'pending'|'claimed'|'done'|'failed', attempts, claimGeneration, leaseUntil, lastError, createdAt, updatedAt
```
- **Select:** `status == 'pending'` OR (`status == 'claimed'` AND `leaseUntil < now`), oldest first (reclaim of crashed claims; reflections keep their flag set while leasing, `process-pending-reflections.js:139`).
- **Claim:** transaction re-reads the row, requires it still selectable, sets `claimed`, `attempts+1`, `claimGeneration+1`, `leaseUntil = now + 150 s`. The worker holds its generation number.
- **Publish:** every write to the huddle record by a worker runs in a transaction that re-reads the queue row and proceeds only if `claimGeneration` still equals the worker's. A stale attempt writes nothing.
- **Done / failed:** `done` after the record is `ready`; `failed` after the 3rd failed attempt with the record marked `failed` and the reason. If a worker finds the record already `ready`, it marks the row `done` and stops.

### 3.4 `indexIntelligence/dailyRegimeBrief` — unchanged shape
Same eight fields as today; all existing readers untouched.

### 3.5 `huddleTickerCache/{etDate}_{SYMBOL}` — per-symbol morning cache (no client access)
```
symbol, etDate, status: 'claimed'|'ready'|'failed', claimedBy, leaseUntil, lastClose, lastCloseAsOf,
news: [ ≤ 10 { source: 'eodhd'|'newsfilter'|'wire', title, url?, publishedAt } ], sources: { eodhd, newsfilter, wire }: 'ok'|'skipped'|'error'
```
Per-symbol documents (no 1 MiB risk); a claim-with-lease so overlapping misses do not duplicate vendor calls; readers wait briefly on `claimed` then fall back to `skipped` with the source noted. At three tickers per player the vendor cost is about U×6 units for U distinct tickers (one daily fetch + one news page), before retries.

### 3.6 `huddleRuns/{etDate}` — run marker (no client access)
```
briefStage: 'done'|'failed'|null, enqueueStage: 'pending'|'done'|'failed', playersEnqueued, playersSkipped, drainedInHandler, startedAt, updatedAt
```
The enqueue stage can complete on a later invocation even if the brief stage already finished (Astra AR-5).

---

## 4. The template family `plan.v1`

**The rule:** the model proposes template instances as JSON against a closed schema (unknown keys rejected). Code validates every value, renders the text, and hashes it. No model string ever reaches the slot, including event labels. The player edits values or removes items; the server re-validates and re-renders.

### 4.1 Stances (≤ 3 names)
`HOLD t` · `TRIM t` · `CHASE t [above L]` · `FADE t [above L]` · `WATCH t`

### 4.2 Lines (≤ 2)
`NO_ADDS_BEFORE eventId` · `NO_SWAPS_TODAY` · `CUT_IF_BELOW t L` · `NO_CHASE_ABOVE t L`

### 4.3 Values
- `t`: ticker matching `^[A-Z]{1,5}(\.[A-Z])?$` **and** ∈ the session universe: ranked seat picks ∪ active-battle holdings ∪ equipped watchlist tickers. Else drop `ticker_not_in_universe` / `ticker_syntax`.
- `L`: finite, positive, two decimals, within ±25% of `lastClose` from the morning cache. Else drop `level_out_of_range` / `level_format`.
- `eventId`: **deterministic**, built by code from the structured calendar objects, never from model labels: `macro:{kind}:{etDate}:{HHmm}` from the macro calendar module's event objects and `earn:{SYMBOL}:{etDate}:{bmo|amc}` from the earnings fetcher rows. Untimed events are not eligible. Labels are rendered by fixed formatters: "the 10:00 AM ET ISM data", "AAA's report after the close". Else drop `event_unknown` / `event_untimed`. (Astra AR-1)
- Duplicates by ticker collapse to the first; counts enforced; every drop recorded in `generation.drops[]` with its reason.
- **Dissent table** `api/_utils/huddle/dissentTable.js`: one rule per archetype (code constant, founder-ratified in the build report), e.g. Contrarian → `CHASE` becomes `WATCH` with a reason; Momentum → `FADE` becomes `WATCH`. Registered in `archetypeImportBoundaryBaseline.json` if it imports an archetype table (`BUILD_RULES.md:28`). An archetype with no row **fails closed**: the plan is still proposed, but confirm returns `archetype_unsupported` and nothing is filed (Astra AR-8).

### 4.4 Rendering (deterministic, no time, no free text)
```
GAME PLAN for {etDate}, confirmed by the player.
Stances: FADE AAA above 48.00; HOLD BBB; WATCH CCC.
Lines: no adds before the 10:00 AM ET ISM data; cut BBB if it trades below 42.00.
These are the player's instructions for this session. Apply them within your archetype's method.
```
Fixed sentences; validated values only; ≤ 500 characters **checked before filing**, else confirm is rejected with `rendered_too_long` and the player is asked to remove a line. `renderedTextHash = canonicalContentHash(renderedText)` (`canonicalHash.js:42`), matching `controls.directiveTextHash` (`agent-evaluate.js:5095`).

### 4.5 Filing shape
An ordinary directive via `fileDirectiveTransactional` (`directiveWriter.js:86-145`) inside the apply transaction: `{ text: confirmed.renderedText, expiry: 'end_of_battle', directiveThreadId: 'plan:{uid}:{etDate}:{revision}', createdAt, textVersion: 'plan.v1' }`. Existing keys only (`directive`, `chatExchanges`); `textVersion` follows the cockpit precedent (`directiveFiling.js:30-32`); no `planRevision` key, the thread id carries it. The stamped chat row is labelled as a game plan. `end_of_battle` is "always active" (`directiveUtils.js:53`); the battle itself ends with the session, and confirm/apply are refused after `session.closeMs` (Astra AR-14). The chat voice may still read the slot on a crypto roster until 8:00 PM (`voiceLayerPrompt.js:3719`); the text names its session date, so the voice cannot mistake it for a new instruction.

---

## 5. Generation pipeline

### 5.1 Enqueue — the existing brief cron, staged
- `api/cron/compute-daily-regime-brief.js` keeps its route; cron entry becomes `30 12,13 * * 1-5` with an ET window guard copied from `process-draft-claims.js:97-112` and a per-day marker. Skips non-trading days via `getSessionForDate`.
- Stages, each recorded in `huddleRuns/{etDate}` (§3.6): **(1) brief** — exactly the PR #1009 logic; its same-day early return (`compute-daily-regime-brief.js:207`) now applies to the brief stage only; **(2) enqueue** — if `DRB_HUDDLE_ENABLED` and `enqueueStage != 'done'`: enumerate players (§5.4), write queue rows idempotently (`{uid}_{etDate}` keys), mark the stage done; **(3) drain** — claim and run jobs while ≥ 150 s of the 300 s `maxDuration` remain. A second invocation at 13:30 UTC resumes any unfinished stage.
- Cron count: this entry unchanged; the worker adds one (44 → 45; `BUILD_RULES.md:78` updated in the same PR, founder-cited).

### 5.2 Shared layer
Tape from `indexIntelligence/marketContext` (prior close, said as such). Events from the existing macro module (2026-only, `macroCalendar.js:446`; the 2027 switch is its own task) and the capped earnings list; the **event strip** is built from the structured objects with the deterministic IDs of §4.3, and the script labels it honestly ("8 of 45 reports listed").

### 5.3 Worker — `api/cron/huddle-worker.js`, cron `*/2 12-17 * * 1-5` (covers 7:00–12:58 ET in EST), `maxDuration` 300
- Exits in under a second when nothing is selectable **after** running the reconcile pass of §6.5 for today's confirmed plans.
- Runs up to **4 jobs concurrently** (Sonnet and speech are I/O waits); every outbound request carries an `AbortController` signal tied to the job deadline, so a timed-out request is cancelled, not abandoned (Astra AR-10; the copied race in `compute-daily-regime-brief.js:79` does not abort).
- Per job (≤ 120 s): claim (§3.3) → if the record is already `ready`, mark done → **gather** → **script** → **validate and render** → **speech** → **store** → **publish** (ownership-checked) → done. Each step idempotent per `(uid, etDate, claimGeneration)`; a stale generation never publishes.
- **Gather** (reads): archetype; equipped watchlist and thesis (read-only path, `decide.js:382-400`); battles `where('ownerId','==',uid).where('status','==','active')`, CPU filtered, classified ranked / casual / training; holdings via `flattenPortfolioServer`; ranked picks and the deploy opener text if present; yesterday's huddle record; morning cache per ticker (§3.5), filled from **newsfilter** (if `NEWSFILTER_API_KEY`), **EODHD `/news`** (`api/news/stock.js:46` pattern), and **Wire stories** (`fetchRecentNews`, `agentTriggerGate.js:221-259`; an error is recorded as `error`, not as "no stories", `:254`). Cache staleness is checked against `asOf` (`marketDataCache.js:665`): a close older than the previous session is labelled stale and not quoted.
- **Script**: one Sonnet call (forced tool; `stop_reason` and usage logged) returning `{ names[], beats: [yesterday?, tape, names, armor], mentionedTickers[], planProposal }`. The **plan beat is never written by the model**: after validation, code narrates it from `current` with fixed phrasing ("Here's what I'd carry in today: fade AAA above 48; hold BBB; watch CCC. Two lines: no adds before the ten o'clock data; cut BBB below 42."). `mentionedTickers[]` must be ⊆ universe ∪ index names; a beat naming a ticker outside it fails validation → one regeneration, then the job fails with reason (Astra AR-12). Narration must only cite exits or pick reasons present in the gathered evidence (opener text, holdings); the prompt says so and the forbidden-terms test covers the stock phrases.
- **Speech**: ElevenLabs text-to-speech **with timestamps** for the joined beats, Shadow's voice (`HUDDLE_SHADOW_VOICE_ID`), `eleven_multilingual_v2`; raw `fetch` as in `generate-audio.js:184,:205-213`, abortable. Beat boundaries from the character alignment.
- **Store**: `fantasytrades/huddle/{uid}/{etDate}/{claimGeneration}/audio.mp3` and `alignment.json` in the existing GCS bucket and credential (`shadowLogger.js:18-36`), private; the generation in the path means a stale attempt can never overwrite published audio.
- **Publish**: one transaction sets the record `ready` with all fields, only if the queue generation still matches.
- Capacity note: at 4 concurrent jobs of ≤ 120 s per 300 s invocation, starts every 2 minutes, the worker alone covers ~50 players in about 15 minutes of wall time and ~200 in an hour; S1's stated target is ≤ 50 players, and the fan-out beyond that is a separate slice.

### 5.4 Active players
Owners with an active battle now, or a battle in the last 5 sessions (`completedBetween`, `closePass.js:95-100`), or `agents.lastDeployedAt` within 5 sessions; CPU excluded; count recorded in the run marker.

---

## 6. Routes (owner-authenticated with the Firebase ID token like `chat.js:421`, **except** the audio stream; every route returns 404 while `DRB_HUDDLE_ENABLED` is off)

| Route | What it does |
|---|---|
| `POST /api/huddle/confirm` | body `{ etDate, baseRevision, replacement }`. In a transaction: read the record; require `plan.status == 'proposed'`, `plan.revision == baseRevision` (else 409 with the stored `current` and `revision`), `now < session.closeMs`; validate `replacement` (§4.3, returning drops), render, check ≤ 500 chars; write `plan.confirmed` (frozen snapshot), `status='confirmed'`, `measurement.confirmedAt`. Then apply to every eligible battle (§6.1). Idempotent: a repeat with the same `baseRevision` after confirm returns the confirmed state. (Astra AR-2) |
| `POST /api/huddle/skip` | `plan.status='skipped'`, `measurement.skippedAt`. |
| `POST /api/huddle/apply` | `{ etDate, battleId }` from the post-deploy hook; applies the confirmed plan to that battle (§6.1). |
| `POST /api/huddle/playback-token` | Issues a fresh random token (plaintext returned once), stores `tokenHash`, `expiresAt = now + 20 min`, rotating the previous one. The sheet calls it before playing and again on expiry. Tokens are never logged. (Astra AR-7) |
| `GET /api/huddle/audio/{token}` | Unauthenticated by design (native `<audio>` cannot send headers): looks up the hash among today's records, checks expiry, streams the MP3 from GCS. Supports `Range` with `206`, `Content-Range`, `Accept-Ranges: bytes`, `416` for invalid ranges; `Cache-Control: private, no-store`; cleans up the GCS stream on client disconnect. Same-origin, allowed by the current CSP (`vercel.json:34,:38`). |
| `GET /api/huddle/status` | Reconcile-on-read (§6.5) and return per-battle status. Called by the hub's reader service when the sheet or Partnership panel mounts, and by the sheet every 60 s while open (the timer lives in the service outside the hub directory). |
| `POST /api/huddle/event` | `{ etDate, kind: 'listened'|'completed' }`, awaited write. |

### 6.1 Apply — `api/_utils/huddle/applyPlan.js` (one module; callers: confirm, apply route, sweep)
For one battle, in a transaction with a fresh read of the battle and of the huddle record:
1. **Identity from the battle, not the request**: `ownerId == uid`; `agentId` bound (`agentBattleBinding.js:48-52`); archetype taken from the battle's frozen context and present in the dissent table (else `archetype_unsupported`, no filing); not a CPU seat (`skipped_cpu`).
2. `status == 'active'` (else `retry_inactive`); `battle.timing.tradingDays[0] == plan.session.etDate` (else `skipped_session`); `now < session.closeMs` (else no action, plan marked `expired`).
3. **Slot precedence**: if the slot holds a live cockpit command per the exact pending predicate with the check-context inputs it needs (`directiveUtils.js:136-150`) → `retry_live_call`. If the slot holds any directive with `createdAt > plan.confirmed.confirmedAt` → `skipped_newer_instruction` (a delayed application never overwrites a newer player instruction, Astra AR-8). Otherwise an earlier ordinary chat directive is replaced (latest wins).
4. Re-read `plan.confirmed` inside the transaction; file §4.5; append the receipt `{ disposition: 'written', revision, directiveThreadId, at, writtenBy }`. A `written` receipt for `(battleId, revision)` already present → no-op.
5. Non-terminal dispositions are re-attempted by the next caller (sweep, status reconcile, apply) until the session closes. No chat budget is charged.

### 6.2 Post-deploy hook
In `src/services/agentDeploy.js` right after `{ outcome: CREATED, agentBattleId }` (`:393-399`): if today's plan is confirmed, call `/api/huddle/apply`; awaited, failure logged, never changes the deploy result. The client service lives outside the hub directory.

### 6.3 Check-start sweep
In `api/cron/agent-evaluate.js` after `:1094-1095` and before `:1153`, one call: `await applyPendingPlanForCheck(battle, ctx)`. The helper: returns immediately when the flag is off (goldens unchanged); skips CPU seats; requires ≥ 5 s of remaining check budget *and* bounds its own work to one Firestore transaction (one battle read, one huddle read, one write) under a 3 s deadline; on deadline it abandons **without publishing** anything; mirrors onto the in-memory `battle` **only what the transaction committed or found already written** (so a confirm that landed between the run's enumeration and this check is reflected even though this sweep wrote nothing); never throws into the check. The builder follows the counted-pin test's placement rule (`agent-evaluate.tickStamps.pins.test.js:219`): the call site is a single helper invocation, not an inline assignment, and a new pin row covers the helper's placement; dark-state goldens, capture-off, call-record goldens and P4 equivalence stay untouched (Astra AR-15).

### 6.4 Status vocabulary (from receipts only)
`proposed` → `confirmed` → `written` → `heard` → `replaced` → `expired`, plus `waiting on your cockpit call` and `waiting for a battle` for the retry dispositions.
- **heard** = a tick for that battle with `controls.rendered === 'resolved'`, `controls.directiveThreadId` equal to the plan's, `controls.directiveTextHash` equal to `renderedTextHash`, `directiveSuppressed === null` (`captureWriter.js:243-328`, `agent-evaluate.js:5092`). "Heard" means rendered into the prompt, not obeyed; the copy says "read by your agent at 10:15 AM ET."
- **replaced** = the slot's `directiveThreadId` is no longer the plan's; the ordinary writer leaves no provenance stamp (`directiveWriter.js:42-47`), so the copy is neutral: "replaced by a later instruction at {slot.createdAt}" (Astra AR-6).

### 6.5 Reconcile
A shared function reads today's confirmed plans' receipts against `ticks/*` and the battle slot and updates `heardAt`, `replacedAt`, retries non-terminal dispositions, and marks `expired` after `closeMs`. It runs: on every worker invocation (even with an empty queue, through the window), on `GET /api/huddle/status`, and as a last pass in the evening settle tenant (`agent-evaluate?mode=settle`), so status keeps updating through the session, not only while the queue has work.

---

## 7. Editorial rules (system prompt; forbidden-terms test on prompt and hub copy)
1. One thing worth hearing, always; a truly empty morning is ~30 s and says "nothing found on your names in the sources we checked," naming any source that errored.
2. Beat order: yesterday (if any) → tape → names (≤ 3, biggest exposure first) → armor (Shadow quoting the archetype in S1) → **plan (code-narrated)**. Target 60–90 s; cap 120 s.
3. Prices: prior-session closes only, labelled; a stale close is not quoted. Headlines carry source and time. The calendar states its cap ("8 of 45 reports listed").
4. Forbidden: clock promises for the agent, "guaranteed", "will do", "has seen", "pre-market" with a number, any sentence about confirmation.
5. Variety: rotating openings and armor framings by weekday; the transcript shows beat labels.
6. The model never names a ticker outside the universe (checked via `mentionedTickers[]`) and never writes plan text.

---

## 8. Hub
- **Chip** under Shadow, in the hub stage area, new component outside the Shadow files; label from `status`.
- **Huddle sheet**: a lazy module **outside the hub directory** (the `<audio>` element, its `timeupdate` listener, the playback-token call and the 60 s status poll all live there, satisfying `commandCenterHub.mount.guard.test.js:654-664`); mounted through the permitted map and NAMED list like the brief (`:603,:1207,:1293-1307`). Never autoplays; transcript with the current beat highlighted; text cards; plan card with value chips, remove controls, Confirm (sends `baseRevision`), Skip; status line from §6.4; a 409 shows the server's version and asks the player to re-confirm.
- **Partnership panel**: receives explicit props (today's plan, per-battle status, history); placeholder copy replaced; the record is a session trading control, not partnership memory.
- **Readers**: a new client service + hook outside the hub directory, wired through `useHubReaders.js` (`:114,:217,:231`). Brief wiring untouched. `hubCopy.js` gains the huddle block; `hubCopy.s4.guard` pins phrases and bans the forbidden terms.

---

## 9. Verification
- **Model calls:** ≤ 4 Sonnet calls from a local script on a real player fixture (founder's own data read locally): beat lengths, proposal validity, `mentionedTickers` discipline; log `stop_reason` and usage.
- **Speech:** ≤ 3 ElevenLabs with-timestamps calls on the same script: alignment arrives, beat boundaries compute.
- **Offline concurrency tests** (emulator): two workers racing one queue row (exactly one publishes); a stale generation attempting to publish (nothing written); confirm racing the sweep on the same battle (one filing, one receipt, memory mirrored); confirm with a stale `baseRevision` (409); an expired cockpit command followed by re-application (`retry_live_call` → `written`).
- **Unit tests:** every drop reason; event-ID formatter; the 500-char rejection; hash stability; dissent table per archetype and fail-closed; apply dispositions incl. `skipped_newer_instruction`; session binding on a holiday and an early close; DST window guard on Oct 30 and Nov 2; audio route (`206`, `416`, expiry, rotation); rules denial tests; hub guard entries; forbidden-terms tests.
- **Full suite** on Linux, exit code asserted, `Test Files` line read directly; `lint:gate`; `vite build`.
- **Smoke (founder-authorized, never-merge preview branch with the flag flipped for the smoke only):** one real huddle for the founder's account on iPhone Safari and desktop; confirm on a day with an active battle and read the receipt turn to "read by your agent at …"; one edit; one skip. The pre-market probe is removed from S1.

---

## 10. Build mechanics
One branch `claude/huddle-s1`, draft PR, builder report `docs/audits/20261030_BUILD_HUDDLE_S1.md` (plain-terms summary first), concept V1.2 and this spec committed in the PR. Opus builds; BUILD_RULES §2 review applies; Fable reviews the build report, the dissent table and the first generated scripts; founder smoke-tests and merges; flag stays off. New env var **names**: `NEWSFILTER_API_KEY` (optional), `HUDDLE_SHADOW_VOICE_ID`; added to `.env.example`; values set by the founder on Vercel.

---

## 11. Fence and pin manifest (binding)
No fenced file is edited. Touched-and-pinned: `api/cron/agent-evaluate.js` (one helper call; new pin row), `src/config/featureFlags.js` + `flagPinGuard.test.js`, `vercel.json` + `BUILD_RULES.md:78` (44 → 45), `compositionProtectedStoresScan.js` list + allowlist keys, `archetypeImportBoundaryBaseline.json`, `firestore.rules` + rules tests, `firestore.indexes.json`, hub guard entries. Fenced exports *called*: `flattenPortfolioServer`. Fenced files *fed*: the slot's text renders into `agentEvalPromptAssembly.js:1240-1246`, which is why the flip, not S1, is the §7-class review, and why every server path stays dark until then. No battle-document key is added.

---

## 12. Founder questions (unchanged from V1)
1. Shadow's ElevenLabs voice id → `HUDDLE_SHADOW_VOICE_ID`.
2. Ratify the dissent table as a code constant proposed by the build and ratified in the report. *(Recommended: yes.)*
3. newsfilter account now, or S1.x. *(Either.)*

---

## 13. Darkness, server-side
`DRB_HUDDLE_ENABLED` gates: the enqueue and drain stages, the worker (exits at once), every `/api/huddle/*` route (404), the sweep helper (returns at once), and the hub chip/sheet/panel content. With the flag off, the only new behaviour in production is the staged run marker around the existing brief write.

---

## 14. Changes from V1 (Astra adjudication)
| AR | Change |
|---|---|
| AR-1 | Deterministic event IDs and fixed label formatters; closed schemas; ticker regex; level format; 500-char check before filing |
| AR-2 | Confirm takes `baseRevision` + `replacement`, 409 on mismatch; frozen `plan.confirmed` snapshot; no time in rendered text; receipts keyed by `(battleId, revision)` |
| AR-3 | Dispositions split into terminal and retryable; only `written` ends re-application |
| AR-4 | Reclaim of expired claims; `claimGeneration` ownership on every publish; immutability once `ready`/`confirmed`; generation in the GCS path |
| AR-5 | Staged run marker; enqueue resumes independently of the brief's early return |
| AR-6 | Reconcile on every worker invocation, on status reads, and in the evening settle; hash matching for "heard"; neutral "replaced" wording |
| AR-7 | Token issuance route returning plaintext once; audio route documented as the auth exception; full Range semantics; no token logging |
| AR-8 | Identity from the fresh battle; fail closed on unsupported archetype; exact pending predicate; newer-instruction rule; all server entry points gated |
| AR-9 | Sweep bounded to one transaction under a 3 s deadline; abandon without publishing; mirror only committed/found state |
| AR-10 | 4 concurrent jobs; abortable requests; worker window to 17:00 UTC; S1 target ≤ 50 players stated |
| AR-11 | Per-symbol cache docs with claim and lease |
| AR-12 | Plan beat narrated by code from the validated plan; `mentionedTickers` check; stale-close and source-error labelling; calendar cap stated |
| AR-13 | Scanner list extended; indexes recorded per query |
| AR-14 | Confirm/apply refused after `closeMs`; voice-layer read documented |
| AR-15 | Helper-call placement with a pin row; goldens untouched; playback effects in the sheet module outside the hub directory; Partnership explicit props |
| Astra note | Pre-market probe removed from S1; server-side darkness made explicit (§13) |
