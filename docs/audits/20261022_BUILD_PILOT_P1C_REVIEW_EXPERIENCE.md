# Build report — Pilot P1c + the Idea Review Experience (R1, R2, void unwind)

**Prompt:** "Build Prompt: Pilot P1c + the Idea Review Experience (R1, R2, void unwind)", Fable, 16 October 2026, founder decisions E1–E4. **Session:** Claude Code, 22 October 2026, in its own app worktree (`.claude/worktrees/pilot-p1c-review-experience-aa25d5`; the founder's shared checkout was read only for Part F). **Branch:** `claude/pilot-p1c-review-experience` (the app named the local branch `claude/pilot-p1c-review-experience-aa25d5`; pushed by refspec under the prompt's name), cut from `origin/main` at **`ff6248d1`** after `git fetch origin main` ("Merge pull request #988"). `docs/audits/20261009_BUILD_PILOT_P1B_DEPLOY_CARRIAGE.md` is on `origin/main`, so no STOP. **Fence entry:** the founder's sanctioned entry for `api/agent/decide.js`, Part A only. No other fenced file is edited. **The fenced diff is in §1, in full, for your sign-off before merge.**

---

## Executive verdict

| Question | Answer |
|---|---|
| What does a player get? | (Owners on the cockpit allowlist, when this merges.) **A due idea never blocks a deploy.** Before the deploy, one screen: **Reaffirm and deploy**, **Retire and deploy**, or **Deploy without it** — titled "Your NVDA idea reached its time-frame." for a timed idea, or with the Forge's battle-ended line for an open-ended one. After a deploy without it, the success screen says **"This battle is running without your idea — it's still waiting for your review."**, a link to the Idea panel. **A review card** under the review line: the idea's window, the frozen list's move against SPY's and the difference, each name, the battles that carried it (voided ones marked), and the honest line that the agent does not act on ideas yet. **A battle that never ran is not a deploy:** the idea is Ready again and its clock has not started (or it steps back to the battle before). |
| Does the agent see or trade anything differently? | **No.** No prompt module, tool schema, decision or trade changes; a due deploy's model and voice-opener requests equal gate off's (§4 row 1); the review and the unwind import no model client. The parse binding (Part D) ships **dark**; with it on, an honest client's prompt is byte-identical to `main`'s (§4 row 5). |
| Is it live? | Parts A–C ride the record slice's switch, `HYPOTHESIS_RECORDS_ENABLED`, which has been **true since #948** — so they go live **for allowlisted owners at merge**. Part D is dark behind its own `DIALOGUE_SERVER_PARSE_ENABLED = false` (pin, `DARK_BY_DESIGN` entry, registration row); its flip is your own PR (§13). |
| Off-mode changes? | **One, and bounded:** a player off the allowlist pays one round trip (≤ 2.5 s, answered `disabled`) on the first deploy of a page session, then nothing (§6). Otherwise byte-identical: P1b's deploy golden passes unchanged; the review route answers `404 disabled` before any read; the dialogue's off golden — captured from `main` before any P1c source — passes. |
| Fenced diff | `api/agent/decide.js` **+2 / −13**: the refusal block deleted, one key on the battle-created 200 (§1). |
| Acceptance (8 rows) | **All 8 met** (§4). |
| Tests | Linux suite of record (CI-shaped `--maxWorkers=2`, `TZ=UTC`) at the code head `8cc1d3eb`: **23,803 passed, 0 failed** (23,892 rows incl. 89 skipped). **P1c flip dry run:** 0 failed. **Record-slice rollback** (`HYPOTHESIS_RECORDS_ENABLED = false`): 0 failed. **Controls:** the P1c flag line alone fails exactly its three pin rows; the record-slice flag line alone fails its two pin rows (and two 5 s timeouts on a slow run, both green at the same flag value in the rollback run). `lint:gate` and `vite build`: **green**, on the pushed head itself. |
| Review (BUILD_RULES §2) | 4 lenses + 4 refuting verifiers + a four-part mutation lens (§9). **39 findings → 32 CONFIRMED, 7 PARTIAL, 0 refuted;** 24 fixed, 7 fixed by a reading that needs your sign-off, 8 documented. The fix round's biggest changes: the deploy now applies the review pass's own never-ran unwind (one rule, one writer); one "over" rule (terminal or past expiry) everywhere; reviews priced for their own dates (a long-term review was unavailable by construction); honest words on the screen and the card. **Mutation: 565 mutants — 386 caught, 71 equivalent, 108 real gaps, every one now killed by a row** (none a code defect). |
| What needs your eye | (1) **The fenced diff** (§1). (2) **Six readings** (§5 rows 1, 2, 5, 6, 8, 9) — above all **row 8, the review's data source**: EODHD's `/eod/` for the window's own dates rather than `getStockAnalysisData` daily, whose 90-day reach could not price a long-term window. (3) **Table C V1.2's labels**, which are mine, and its title rule (§5 rows 1, 17). (4) Founder questions (§12). |

---

## 0. Preamble

- **Session open.** `git fetch origin main` first; `origin/main` = `ff6248d1`, and the worktree's HEAD was already `ff6248d1` with a clean tree. Every commit staged explicit paths after re-checking the branch in the same command.
- **Inputs re-verified at `ff6248d1`.**
  - The prompt says `decide.js` "has not changed since P1b". **It has**, in three later commits (`48d38d16`, `0254ddcc`, `a9d3b978` — the BaggerBomb stock thresholds and the tournament settlement guard), but none touches the step-3d block this build edits. The carriage race's cooldown restore now also covers `StockThresholdRefusal`; it is left as it is.
  - `src/services/agentDeploy.js` is R1's typed-outcome service (PR #979). The interstitial runs before the deploy call and adds no outcome; the notice rides `created` (and `handoff_failed`) as one extra field (§3.1).
  - **`HYPOTHESIS_RECORDS_ENABLED` is already `true` on `main`** (PR #948, 9 Oct). Parts A–C therefore go live **for owners on the cockpit allowlist** when this merges; every other player sees nothing new — their first deploy of a page session makes one bounded request, answered `disabled` (§6). Part D ships dark behind its own flag.
  - The Command Center hub (S2a, PR #978, merged) reads the P1b refusal code in its translator under ruling R-S2A-2. That reader is why `DEPLOY_REFUSAL_CODE` stays (§5 row 4).
- **Linux runs** used two private WSL clones (`~/pd-p1c`, `~/pd-p1c-b`; Node 20.20.2 / npm 10.8.2 as CI); the shared `~/pd-amendd` was not touched.
- **Advisor:** consult #1's first call timed out; the retry answered. Both are recorded in §11.
- **The session restarted once** (its sign-in expired) while the mutation lens ran. The three lens agents still running were resumed from their own records; each checked its tree against its pre-run manifest and the commit's blobs — nothing was left mid-mutation — before finishing (§9.2).

---

## 1. The fenced diff, in full (for founder sign-off)

`git diff ff6248d1..HEAD -- api/agent/decide.js` (the only fenced file in the branch diff; **+2 / −13**):

```diff
@@ -401,23 +401,11 @@ export default async function handler(req, res) {
 
     // 3d. [Pilot P1b] Deploy carriage: which version of the equipped idea this
     //     battle carries, from the list's server-written versions (gate off →
-    //     nothing, before any read). A due idea is refused here, before any
-    //     battle work, with table C's line.
+    //     nothing, before any read).
     const carriage = await resolveDeployCarriage(db, {
       ownerUid: agent.ownerId, watchlistId: agent.equippedWatchlistId ?? null,
       watchlist: equippedWatchlistData, snapshot: equippedWatchlistSnapshot, pin: projectionPin,
     });
-    if (carriage.outcome === 'refuse') {
-      await agentRef.update({
-        deployingAt: null,
-        ...(progressInitialized && {
-          'deployProgress.stage': 'error',
-          'deployProgress.errorPhase': 'pre_decision',
-          'deployProgress.updatedAt': new Date().toISOString(),
-        }),
-      });
-      return res.status(carriage.status).json(carriage.body);
-    }
 
     // 4. Fetch recent FantasyTimes stories.
@@ -1033,6 +1021,7 @@ export default async function handler(req, res) {
       opponentBench: cpuOpponent.bench,
       innerMonologue: portfolioResult.innerMonologue,
       strategyBrief: strategy.brief,
+      ...(carriage.reason === 'review_due' ? { hypothesisNotice: 'review_due' } : {}),
     });
   } catch (error) {
```

| Piece | What it does |
|---|---|
| The deleted block | P1b's refusal: it released the lock, stamped the ceremony's error, and answered 409. The resolver no longer returns `refuse`, so nothing reaches it; it is gone rather than left unreachable. |
| The comment | Its last sentence described the refusal, so it goes with it; nothing is added (review L1-3 — the build's first draft rewrote it, one line of prose past the letter of the sanction). |
| The one key | Only on the **battle-created** 200, and only when the resolver said the battle carries nothing because the idea is due (`reason: 'review_due'`). It is appended last, so every other response is byte-for-byte unchanged. The portfolio-refresh 200 (an agent with a running battle) creates no battle and carries nothing, so it gets no notice. |

**Fenced functions called (not edited):** `createAgentBattle` (unchanged call). **Not edited:** `agentBattleService.js`, `agentSwapExecution.js`, `agentScoring.js`, `agentRiskManager.js`, `agentArchetypeConfig.js`, `agentPromptAssembly.js`, `agentEvalPromptAssembly.js`, `agentGuardrails.js`, `archetypeScoring.js`, `tournamentUserScoring.js`, `api/cron/agent-evaluate.js`, `completeBattle`, `firestore.rules`, the capture schema or serializer, the cockpit matcher, the equip route, any prompt module or tool schema. `SWAP_IDENTITY_MODE` and `HYPOTHESIS_RECORDS_ENABLED` are unchanged.

---

## 2. What changed and where

### 2.1 Server

| File | What |
|---|---|
| `api/_utils/hypothesisRecords/carriage.js` | **E1.** Both former refusal sites (the newest deployed version is due; an activated version judged due) now carry nothing with `{ outcome: 'none', reason: 'review_due', version }` (`REVIEW_DUE_REASON`); a judgment that cannot commit carries nothing silently (`judgment_failed` — the record is not yet due). The strict B2 walk and the race checks are unchanged. **E3 at deploy** (review L2-1 / L4-4): before an activated version is judged or carried, the review pass's own unwind is applied (§3.4; `CARRIAGE_UNWIND_STEPS_MAX` = 5). **E2.** `activateCarriedVersionInTx` writes `deployedBattleIds`: `[battle]` at the first deploy; on a redeploy (B6) the battle is appended to the version's list, or to `[lastDeployedBattleId]` for a version activated before P1c. |
| `api/_utils/hypothesisRecords/model.js` | `DEPLOYED_BATTLE_IDS_FIELD`, `DEPLOYED_BATTLE_IDS_CAP` (50: the first id, then the newest 49), `carryingBattleIdsOf`, `withCarryingBattle` — pure, shared by the creation transaction, the review and the unwind. Outside `contentHash` and `LIFECYCLE_FIELDS`, as `reviewClockFault`. |
| `api/_utils/hypothesisRecords/review.js` (new) | **E2.** The review card's evidence: `reviewWindowOf` (the rule in §3.3), `frozenNamesOf`, `fetchWindowDaily` (one call per symbol, for the window's own dates), `roundClose`, `computeReviewEvidence`, the once-only claim (`claimEvidence` / `storeEvidence`), `readReview` (the window before the carrying battles). |
| `api/forge/watchlists/[id]/hypothesis-versions/[n]/review.js` (new) | **E2.** `GET` — owner-only, behind the record slice's gate (`gateHypothesisRoute`: 404 `disabled` before any read when off), `maxDuration: 30`. |
| `api/_utils/hypothesisRecords/horizon.js` | **E2/E3.** The backward walks: `previousSessionOf`, `sessionAtOrBefore`, `tradingDaysCutoffMs`, `etDateOfInstant` (same calendar of record, same `calendar_unavailable` throw). |
| `api/_utils/hypothesisRecords/reviewPass.js` | **E3.** `battleIsOver` (one "over" rule — terminal or past expiry — for the pass, the deploy and the review window), `battleNeverRan`, `voidBranchOf`; the judge (`decideReview`, `reviewOne`) unwinds in every phase for rows armed within the look-back; the unwind's one writer `writeUnwindInTx`, and `unwindVoidCarriage`, the deploy's entry to it; a third phase, `recent`, with its own cursor; each row judged at most once a pass. |
| `api/_utils/hypothesisRecords/store.js`, `api/forge/watchlists/[id]/hypothesis-versions.js` | With a due version, the versions GET also says whether the list is committed (`listCommitted` — review L4-5). |
| `api/agent/decide.js` (fenced) | §1. |
| `api/forge/watchlist-dialogue.js` | **E4.** `serverParseOf` (the drop record's own parse, by dropId); the paste path's server-parse binding behind `DIALOGUE_SERVER_PARSE_ENABLED`; `parseEnvelopeMismatch` (an envelope too deep to hash counts as one). |
| `api/_utils/compositionProtectedStoresAllowlist.json` | The write-site ratchet: `decide.js` agents updates 17 → 16 (the refusal's write is gone); `review.js` `claimEvidence` (2) and `storeEvidence` (1); `reviewPass.js` `writeUnwindInTx` update 2, delete 1 (`reviewOne` keeps P1a's update 1, delete 2). Notes in `_notes_pilot_p1c`. |

### 2.2 Shared vocabulary and client

| File | What |
|---|---|
| `src/constants/hypothesisRecords.js` | `HYPOTHESIS_NOTICES`, `dueDeployPending` (the deploy station's predicate — the resolver's rule), `REVIEWABLE_STATUSES` / `reviewableVersion` (the route's and the Forge's one predicate), `REVIEW_HONEST_LINE`, `STATE_REASONS.deployVoided`. `DEPLOY_REFUSAL_CODE` / `DUE_DEPLOY_LINE` kept, their docstring says why (§5 row 4). |
| `src/components/Forge/Watchlist/ideaCopy.js` | Table C V1.2's lines and labels; `[AGENT]` in `fillLine`; `dueDeployTitleFor` (B3's `[SYM]`/`[LIST]` rule, for a time-frame that elapsed — §5 row 1); `deployVoidedLineFor`; `countedOfText`. |
| `src/services/dueIdeaCheck.js` (new) | The check a deploy runs first: flag off → no request; an uncommitted list → nothing due; a `disabled` gate remembered per owner for the page session; no answer awaited past 2.5 s; any failure → nothing due. |
| `src/components/Dashboard/deployCeremony/DueIdeaInterstitial.jsx` (new) | The one screen before a deploy whose idea is due: busy buttons stay focusable, each step bounded at 15 s, a failure shows no words. |
| `src/components/Dashboard/CommandDashboard.jsx`, `CommandDashboardDesktop.jsx` | `handleDeploy` asks the check first and waits for the screen's choice; the stage timing starts before the check and restarts at the choice; a shell unmounted mid-choice settles the waiting deploy; `deployDisabled` is re-read after the choice; a ceremony retry does not ask again. Identical in both shells (guarded). |
| `src/services/agentDeploy.js` | The P1b 409 special case removed; `created` — and `handoff_failed` — carry `hypothesisNotice`. |
| `src/components/Dashboard/deployResult.js` → `DeployCeremony.jsx` → `CeremonyReveal.jsx` | The notice reaches the success screen and the recovered reveal; the line links to the Idea panel. |
| `src/components/Forge/Watchlist/ideaNavigation.js` (new), `src/App.jsx` | Two window events App listens for: open a list's editor (`OPEN_IDEA_EVENT`), open a carrying battle's Film Room (`OPEN_BATTLE_REVIEW_EVENT`). No dashboard mount gains a prop (the hub's S0 mount guard freezes those). |
| `src/components/Forge/Watchlist/IdeaPanel.jsx`, `IdeaReviewCard.jsx` (new) | The review card under the review line (asked again while another request computes the evidence); the void line, on the current version and on a superseded version's own history row. |
| `src/services/hypothesisVersionService.js`, `carryingBattleRead.js` (new) | The review GET; the battle read on a link's tap (loaded only then). |
| `src/config/featureFlags.js` | `DIALOGUE_SERVER_PARSE_ENABLED = false` + `isDialogueServerParseOn()`; the record-slice docstring for E1–E3; #948's leftover wording. |

### 2.3 Docs

- `docs/specs/20260923_BAGGERBOMB_PARTNERSHIP_PILOT_SPEC_V1_4.md`: **Amendment E — 16 Oct 2026 (founder rulings E1–E3)** appended, naming this build's readings (the data source, "never ran", the deploy's unwind) as readings; Amendment D is left as it was (E says its refusal clause is replaced).
- `docs/specs/MODE_TRUTH_LANGUAGE_TABLES_V1.md`: **table C V1.2** — five rows and a labels table of ten, with a dated note (the title's rule as built, §5 row 1); the document's own version is **V1.6** (header and footer). The V1.1 note's "the last two rows" now reads "rows 6–7" so it stays true.
- `docs/audits/20261014_SWAP_IDENTITY_SHADOW_READ.md`: Part F, copied unchanged.

### 2.4 Tests (new and changed)

- **New:** `api/forge/watchlist-dialogue.parseBindingOffGolden.test.js` + `api/_utils/__fixtures__/{dialogueHarness.js, dialogueParseBindingGolden.json}` (the off golden, **captured from `main` before any P1c source**, commit `b3974f78`); `api/forge/watchlist-dialogue.parseBinding.test.js`; `api/_utils/hypothesisRecords/{review,reviewPass.unwind,carriage.voidUnwind,horizon.p1c,dueIdea.agreement}.test.js`; `src/services/dueIdeaCheck.test.js`; `src/components/Dashboard/deployCeremony/{DueIdeaInterstitial,ceremonyIdeaNotice}.jsdom.test.jsx`; `src/components/Dashboard/deployShells.p1c.guard.test.js`; `src/components/Forge/Watchlist/IdeaPanel.review.jsdom.test.jsx`; `src/config/dialogueServerParseFlags.test.js`.
- **Changed (each an intended change with its own row):** the P1b refusal rows rewritten to E1 (`carriage.test.js`, `decide.carriage.test.js`, `agentDeploy.{refusal,outcomes}.test.js`, `ceremonyExisting.test.jsx`, `deployResult.test.js`); `deployedBattleIds` in the P1b documents (`carriage.test.js`, `decide.carriage.test.js`); the P1b battles that are over by redeploy time now ran (one evaluation), since a battle that never ran is no deploy (E3); a failed deploy-time judgment carries nothing silently (`carriage.test.js`); the census of files naming the carried idea gains `review.js`; one hub row (`attemptVocabulary.test.js`) no longer source-pins the service's removed refusal reader; `ideaCopy.test.js` (table C V1.2); the P1b panel suite's service mock gains the review read; `watchlists.hypothesisRecords.test.js` (`listCommitted`); `hypothesisRecordsFlags.test.js` and `flagPinGuard.test.js` (Part E). **Honest drop fixtures** (review L3-1): the P2 research harness's `signalDropDoc` and the dialogue suite's `VALID_SIGNAL_DROP` now hold the parse, validation and flags parse-signal writes for their envelopes, so every dialogue-reading suite runs the same path with the P1c flag on or off — the P1c flip is four edits (§13) and P2's goldens are unchanged.

---

## 3. How it works

### 3.1 E1 — a due idea never blocks a deploy

1. **Before.** A deploy CTA calls the shell's `handleDeploy`. With `HYPOTHESIS_RECORDS_ENABLED` on and a list equipped, it reads the list's versions (the Forge's own GET) and asks `dueDeployPending`: is the newest **deployed** version `review_due`, with no newer `ready` version — on a committed list (an uncommitted one is no equip at deploy)? If so, one screen opens **before any deploy call**: the title and three buttons, in order:
   - **the title** — for an idea whose time-frame elapsed, table C V1.2's "Your [SYM] idea reached its time-frame." (`[SYM]` or the frozen `[LIST]`); for an idea due because its battle ended, table C's own line for that state ("The battle ended with your … idea still open-ended. …"); for a version whose clock fell back to a battle-end review (B5), or with no name known, none (§5 row 1);
   - **Reaffirm and deploy** — the existing reaffirm route on the due version (a fresh opId, the pointer the GET saw), then the deploy: `v{n+1}` is `ready` and newer, so it rides;
   - **Retire and deploy** — the existing transition route (`retire`, expecting `review_due`), then the deploy: the retired version no longer rides (an older ready version may — §5 row 3);
   - **Deploy without it** — the deploy: nothing rides and the idea stays due.

   No fourth option, no "Try again". A failed reaffirm or retire — or one past 15 s — **stops** (it never turns into "deploy without it"): no words appear and the same three buttons are live again (§5 row 2); the next press re-reads the idea first, so a reaffirm whose answer was lost is seen as done. While a step runs the buttons are busy, never disabled, so focus stays on the screen. The check itself never holds a deploy past 2.5 s, remembers a `404 disabled` gate for the page session, and answers any failure with "nothing due" — the deploy then runs as on `main`. A shell unmounted while the screen waits (App swaps the two shells at 768 px) settles the waiting deploy, and a battle that started while the player chose stops it.
2. **The server.** `resolveDeployCarriage` walks as P1b's strict B2 reading does — after applying E3's unwind to an activated version (§3.4); where P1b answered 409 it answers `none / review_due`. `decide.js` creates the battle carrying nothing and appends `hypothesisNotice: 'review_due'` to its battle-created 200.
3. **After.** `deployAgent` carries the notice on the `created` outcome (and on `handoff_failed`, when the battle was created but the client could not open it); `deployResultFor` keeps it; the success screen — or the recovered reveal — shows "This battle is running without your idea — it's still waiting for your review." The line is a link: it closes the ceremony and asks App (`OPEN_IDEA_EVENT`) to open the equipped list's editor, where the Idea panel is.

### 3.2 E2 — the review gets evidence

- **Data.** The creation transaction keeps `deployedBattleIds` on the version (§2.1).
- **The route** `GET …/hypothesis-versions/{n}/review` answers for a version that **was deployed** and is `review_due`, `retired` or `invalidated`, once its window has closed (§3.3): the window; the carrying battles (id, creation date, end, `voided` when the battle's `completionReason` is `voided`; a battle that is not the owner's or did not carry this version is never used); the frozen list's name; the agent name the first carrying battle froze; the honest line filled with it; the evidence; the difference.
- **The evidence** is computed once and stored on the version as `reviewEvidence { computedAt, source: 'eodhd_daily', window, names[], list, market }`:
  - names: the first carrying battle's `agentContext.equippedWatchlist.tickers` (never the live list), at most 10;
  - each: one call to EODHD's `/eod/` for the window's own dates (`fetchWindowDaily` — the endpoint and row mapping of the daily window `getStockAnalysisData` reads: the split- and dividend-adjusted close; no shared cache document written — §5 row 8); the close on the window's start date and end date, stored as shown (2 decimals from $1, else 4 significant figures), and the change % of those stored closes (2 decimals) — or `{ status: 'unavailable', reason }` (`no_data`, `no_start_close`, `no_end_close`, `fetch_failed`, `budget`, `empty_window`, `interrupted`), never `null`;
  - the list: the equal-weight mean of the names that have a change, with how many it counts of how many there are; the market: SPY over the same window; the difference = list − market, computed from the two stored numbers (BUILD_RULES §9).
- **Cost.** At most **11** market-data calls per version, per lifetime (10 names + SPY). A one-time claim (`reviewEvidenceClaim { claimedAt, calls }`) is written in a transaction **before any call**: a second request while it is live computes nothing (`pending: 'computing'`); a claim older than 120 s with no evidence is finalized as `interrupted` with no call. A second request after the evidence exists makes **zero** calls. The computation waits **3 h after the window's last close** (`pending: 'awaiting_close'` until then), so the feed holds that close.
- **The Forge.** The newest reviewable version gets the card (`IdeaReviewCard`): under its review line (the current version, or the superseded-due block), else in its own block under its chip. One row — the frozen list's change ("· [n] of [N]" when it counts fewer than all of the list's names), SPY's, the difference; the per-name table collapsed; the battles as links (a tap reads the owner's battle and asks App for its Film Room); the honest line. While the evidence settles, the card shows the window and the battles only (the honest line says the card shows how the names did, so it waits for them); while another request computes it, the panel asks again, three times, 5 s apart. A refused review (window open, gate) shows nothing.

### 3.3 The review window rule, as built

| Bound | Rule |
|---|---|
| **start** | The close of the regular session **before the anchor session**. The anchor is the session containing the first deploy (`firstDeployedAt`), else the next one (P1a's `anchorSessionOf`). So the start is the last close before the idea went live. Example: first deploy Tue 13 Oct 13:21 ET → anchor Tue 13 Oct → start = Mon 12 Oct's close. |
| **end, timed** (`reviewDueAt` set) | `reviewDueAt` itself — the close of the due session. |
| **end, battle-end** (`reviewDueAt` null: an `unspecified` idea, or B5's clock fault) | The close of the session the **last** carrying battle ended in: its end is the earlier of `completedAt` and `expiresAt` (an expired battle is completed late, by agent-evaluate's next weekday tick or its agent's next deploy), and "ended in" is the latest session whose open is at or before that instant (`sessionAtOrBefore`). The battle must be over (`battleIsOver`: any status but `active`, or past its `expiresAt` — the one rule the pass and the deploy also use). |
| **closed** | Once `now` reaches the end close. Before → `409 review_window_open` — answered before the carrying battles are read. |
| **empty** | An end that does not follow the start (a battle that ended before the idea's first session) prices nothing (`empty_window`, the list too), with no call. |
| **any age** | The closes are read for the window's own dates, so a window is priced whenever it is first opened — a long-term window too (the 90-day daily window could not reach one: review L2-2). |
| **retired versions** | The same rule: a timed version retired before its due date has no card until that date, then is priced over the full planned window (§12 Q7). |

### 3.4 E3 — a carrying battle that never ran is unwound

- **Over:** any status but `active`, or past its own `expiresAt` (`battleIsOver`). An expired battle stays `active` until agent-evaluate's expiry loop completes it on its next weekday tick (or its agent's next deploy does), and it is never evaluated again meanwhile. One rule for the pass's battle-end review, the deploy's judgment and the review window (review L2-3).
- **Never ran:** over, and no evaluation on any of the battle's own counters (`evaluations[]`, `cronState.evalSeq`, `scoreState.evaluationCount`), and no trade. A battle created between 16:00 and 20:00 ET (every self-select battle holds crypto, so it expires at 20:00 ET) is evaluated by nothing and never runs (§5 row 5).
- **Where — the pass:** in the review pass's judge, for rows **armed within the last 3 trading days** (`tradingDaysCutoffMs`: 00:00 ET of the third most recent trading day, today counting) — in every phase, so a due row or a battle-end row whose battle never ran is unwound rather than flagged. A third phase, **`recent`** (rows `armedAt >= cutoff`, `armedAt ASC, __name__ ASC` — an automatic single-field index, as the due phase — from its own persisted cursor), reaches the timed rows not yet due that the other phases never read; it passes over the rows those phases own and runs last. Each row is judged at most once a pass.
- **Where — the deploy** (review L2-1 / L4-4; §5 row 6): before the deploy judges or carries an activated version, it applies the same unwind (`unwindVoidCarriage`: the pass's decision and its one writer, `stateSource: 'deploy'`), as often as it applies — a step back may land on an earlier battle that never ran either — five steps at most (past them nothing rides and the pass continues). Back to `ready`, the version rides this battle as a **first deploy** (a new clock, no notice); stepped back, it is judged as P1b judges it. So the record ends the same whichever reaches the row first.
- **The branches** (`voidBranchOf`, from the version's own record; the battle judged is the row's):
  - **only carrying battle** — `deployedBattleIds` is just it, or, for a version activated before P1c, `lastDeployedBattleId` is it — and, either way, `firstDeployedAt` is its `createdAt` (review L2-10) → the version returns to `ready` (`stateReason: 'deploy_voided'`), `firstDeployedAt`, `reviewDueAt`, `lastDeployedAt`, `lastDeployedBattleId` and `reviewClockFault` set to `null`, `deployedBattleIds` emptied; the row deleted. The Forge says "That battle never ran, so your idea is back to Ready. Its clock hasn't started." — on the current version, or on a superseded version's own history row.
  - **earlier carrying battles** (the list names one before it) → this id leaves `deployedBattleIds`; `lastDeployedAt` / `lastDeployedBattleId` point at the previous battle (read in the same transaction for its `createdAt`); the row is re-armed to it with the **same `dueAtMs`** (`armedAt` = its creation). The version stays `activated`; its clock is untouched.
  - **unresolved** — earlier battles the record cannot name, a void battle that is not the newest carrying one, or a previous battle that cannot be read → no unwind; the row is judged as before (counted `voidUnresolved`; review L2-5).
- **Judged once:** in one transaction, with fresh reads of the row, the version, the battle and — stepping back — the previous battle; only while the version is still `activated`. A concurrent move (the player retires or reaffirms; a redeploy re-arms the row to a new battle; the battle gains an evaluation; the pass or the deploy got there first) makes the fresh read disagree, and nothing is unwound twice.
- **The void writer** is not in this repository: `api/cron/agent-evaluate.js` completes expired battles but voids none; the one voided agent battle on record (Shadow, `vwuCEjUrWwSzufOio18J`, 14 Oct 20:55 UTC) was voided by a one-off script (`completionReason: 'voided'`, `completionContext: 'voided_no_checks'`). The rule reads the battle's own state, whatever ended it.

### 3.5 E4 — the parse binding (dark)

`api/forge/watchlist-dialogue.js`, paste path only (a first turn with `parseResult` + `dropId`), after the existing contentHash check. **Flag off:** the client's envelope is stored, exactly as on `main`. **Flag on:** `serverParseOf` loads the stored parse — the drop record's own `parse`, by dropId (parse-signal writes it on every drop, cache hit or miss; never the global parse cache, which is keyed by content, not by drop or by the note that steered the parse — review L3-6) — shaped by the same `validateParseResult` the client envelope gets, and stores **that** as `session.parseResult`. If the client's envelope differs (canonical-hash compare, key-order free; an envelope too deep to hash counts as differing — review L3-4), the session also records `parseEnvelopeMismatch: true` and the request goes on; a drop with no usable stored parse is refused as a missing drop is (`400 unknown_drop`). Theme sessions and continuing turns are untouched — so a session started before the flip keeps its stored client envelope for its later turns (review L3-3). The flag is read at call time and gates on the flag alone (no allowlist — §5 row 10).

## 4. Acceptance results

Linux suite of record = WSL Ubuntu, a private clone, Node 20.20.2 / npm 10.8.2 as CI, `TZ=UTC`, `--maxWorkers=2` (CI's shape). Every row below is a test; §10 has the runs.

| # | Row | Result | Proof |
|---|---|---|---|
| 1 | **E1 — a due idea never blocks a deploy.** The resolver's former refusal carries nothing with `review_due`; the battle-created 200 alone carries `hypothesisNotice`; nothing else in any response moves. | **Met** | **`carriage.test.js`:** due with nothing newer ready → `{ none, review_due, version }` before any battle write; a newer due version is never bypassed; a judgment that cannot commit carries nothing, silently.<br>**`decide.carriage.test.js`:** the due deploy creates a battle carrying nothing, its model and voice-opener requests equal gate off's, the 200 carries the notice; an ordinary created 200 and the portfolio-refresh 200 carry none.<br>**`dueIdea.agreement.test.js`:** the client's predicate agrees with the resolver on 1,463 generated lists.<br>**`decide.carriageOffGolden.test.js`:** P1b's gate-off golden from `main`, unchanged. |
| 2 | **The interstitial sequences.** Before any deploy call: the screen, its title, exactly three buttons in order; each button's sequence; a failed step never deploys; after the deploy, the success line and its link. | **Met** | **`DueIdeaInterstitial.jsdom.test.jsx`:** titles; the three buttons in order, no fourth, no "Try again" (in words too); reaffirm → the reaffirm route then the deploy; retire → the transition then the deploy; without → the deploy alone; a refusal, a lost response, a re-read failure, a step past 15 s → no deploy, no words, the buttons live again; the next press re-reads first; busy never disabled.<br>**`dueIdeaCheck.test.js`:** when it opens and when it never asks (flag off, no equip, uncommitted list, a remembered `disabled` gate, a 2.5 s bound); the title's rule (§5 row 1).<br>**`deployShells.p1c.guard.test.js`:** both shells — the check before the ceremony and `deployAgent`, the timing, the unmount settle, the retry path, identical code.<br>**`ceremonyIdeaNotice.jsdom.test.jsx`:** the real chain (decide's 200 → `deployAgent` → `deployResultFor` → the ceremony) shows table C V1.2's line, verbatim, as the link to the Idea panel — on the success screen and on the recovered reveal after a failed handoff; none without the notice. |
| 3 | **E2 — the review route and card.** Owner-only; 404 `disabled` before any read with the gate off; the window; per-name closes and change %; the list, SPY and the difference; the carrying battles with voided marks; the honest line; stored once; at most 11 calls. | **Met** | **`review.test.js`** (44 rows, the route driven for real over the store double and a network double running the real row mapping): the gate and owner rows; which versions get a card; the window rule (§3.3) — timed, battle-end, empty, any age, answered before the battles are read; the first battle's frozen names, never the live list; every unavailable reason; stored once — a second request makes zero calls; the 11-call budget; a live claim, a dead claim, two requests at once; closes stored as shown.<br>**`horizon.p1c.test.js`:** the backward walks over EDT/EST, Columbus Day and Thanksgiving.<br>**`IdeaPanel.review.jsdom.test.jsx`:** the card in each placement; the row, "[n] of [N]", the names, the battle links, the honest line; pending; the re-ask; the void lines. |
| 4 | **E3 — the void unwind.** Rows armed within 3 trading days; the only carrying battle → `ready` / `deploy_voided`, cleared, row deleted; earlier battles → step back; judged once. | **Met** | **`reviewPass.unwind.test.js`:** both branches field by field; pre-P1c records; every phase's judge; never a battle that ran or one still live before its expiry; the look-back; the races (a player's move, a redeploy re-arming the row, a competing commit landing between body and commit); the `recent` phase and its cursor; one "over" rule; the step-back judged as before when its previous battle cannot be read.<br>**`carriage.voidUnwind.test.js`:** the same unwind at deploy — Ready again and carried as a first deploy (voided, or expired unrun); a step back then P1b's judgment (battle-end → due; timed → B6); a chain; the five-step bound; the pass and the deploy end the record the same; judged once. |
| 5 | **P1c golden, flip dry run, control.** | **Met** | **`watchlist-dialogue.parseBindingOffGolden.test.js`:** captured from `main` at `ff6248d1` with no P1c source (`b3974f78`), SHA-pinned; 12/12 on the branch.<br>**`watchlist-dialogue.parseBinding.test.js`:** flag on — honest clients main's byte for byte in every scenario (Firestore key order, over-cap Haiku output too); a differing envelope → the server's parse and the marker, never a refusal; the drop's own parse or `400`.<br>**Flip dry run** (§13's four edits) and **control** (the flag line alone): §10. |
| 6 | **Table C V1.2 byte test and §E sweep.** | **Met** | **`ideaCopy.test.js`:** the five rows and ten labels parsed from the spec, byte for byte, in order; the `[LIST]` rows are the `[SYM]` rows with the placeholder renamed; the honest line is one string, server and Forge; the §E sweep covers every new string. |
| 7 | **Off mode byte-identical; `HYPOTHESIS_RECORDS_ENABLED` dry run at both values.** | **Met** | Gate off: P1b's deploy golden, the review route's 404 before any read, the pass's global gate (§6). P1c flag off: the dialogue's off golden (row 5). **Both values of `HYPOTHESIS_RECORDS_ENABLED`:** the full suite at `true` (as shipped) and with the slice rolled back to `false` (its four edits) — §10. |
| 8 | **Full suite, `lint:gate`, `vite build`.** | **Met** | §10. |

---

## 5. Departures, readings and judgment calls

Rows 1, 2, 5, 6, 8 and 9 are readings this build made to stay true to the record where the prompt's words, taken literally, would not; each needs your sign-off (§12 Q9).

| # | Topic | Prompt / ruling said | Code does | Why |
|---|---|---|---|---|
| 1 | **The screen's title** | "a screen titled 'Your [SYM\|LIST] idea reached its time-frame.'" | That title only for an idea whose time-frame elapsed (`horizon_elapsed`). An idea due because its battle ended — every `unspecified` idea, the default for theme, manual and screener lists — shows table C's own line for that state ("The battle ended with your … idea still open-ended. It's flagged for review — reaffirm or retire when you're ready."). A B5 version (its clock fell back to a battle-end review) shows no title. | Review L4-1 (CONFIRMED). "Reached its time-frame" is false for those records, and the tables' header makes a line that claims beyond its typed fields a divergence. No new words: the battle-ended line is table C's, word for word, as the Forge shows it. Alternatives: no title (the sanctioned "neither known" state), or a new row (§12 Q1). |
| 2 | **A failed step on the screen** | "No fourth option, and no 'Try again'." | No words: the three buttons are live again; the next press re-reads the idea first. | Review L4-6 (PARTIAL). The server's and the panel's existing failure texts all say "try again" (one says "Reload", a control the screen lacks), and table C V1.2 has no failure line. A failure line is your wording (§12 Q3). |
| 3 | **"Retire and deploy" with an older ready version** | "Retire and deploy" | The retired version no longer rides; B2 as written then carries the newest ready/activated version — so an older ready version (one superseded by an edit before it ever deployed) can ride, with a fresh clock. | Reviews L2-4 / L4-5 (CONFIRMED). B2's literal reading (P1b §5 row 1 kept it for a not-due newest version). Your call: keep, or carry nothing older than the newest deployed version (§12 Q2). |
| 4 | **The refusal vocabulary** | "Remove `DEPLOY_REFUSAL_CODE` and its 409 path from the shared vocabulary once no reader remains" | The server 409 and the deploy service's reader are gone; `DEPLOY_REFUSAL_CODE` and `DUE_DEPLOY_LINE` stay in `src/constants/hypothesisRecords.js`. | A reader remains: the Command Center hub's translator (S2a, ruling R-S2A-2) still maps the code (dark hub). Carried forward to the hub's next slice (§12). |
| 5 | **"Never ran"** | E3: a battle that never ran | Over — terminal, **or past its own `expiresAt`** — with zero evaluations and no trades. | Review L2-1 (CONFIRMED). A battle created between 16:00 and 20:00 ET is evaluated by nothing (agent-evaluate evaluates in regular hours) and expires at 20:00 ET still `active` until agent-evaluate's next weekday tick completes it — the Shadow class. Terminal-only would leave it unseen until then, and a deploy in that time would beat the pass to it. An expired battle is never evaluated again (agent-evaluate's expiry branch only completes it), so its count is final. Amendment E names this as the build's reading. |
| 6 | **Who applies the unwind** | E3: "The void unwind in `runHypothesisReviewPass`" | The pass — **and the deploy**, which applies the pass's own decision and writer to an activated version before it judges or carries it. | Reviews L2-1 / L4-4 (CONFIRMED). P1b's deploy-time judgment (its review L2-1) preempts the pass; without this, a deploy reaching the version first flagged a never-ran battle-end idea due (the notice false, E3 lost for good) or carried a timed one on behind the never-ran battle. One decision function and one writer (`writeUnwindInTx`) keep the two hosts from diverging. Amendment E names this as the build's reading. |
| 7 | **When the screen does not come first** | E1: "before any deploy call: a screen …" | The screen needs a `review_due` record (its buttons act on one). It does not open when only the deploy's own judgment knows the idea is due: an activated version whose clock passed or whose battle ended before the review pass's next tick (≤ 15 min in cron hours — and from 1 Nov, a battle expiring at 20:00 EST = 01:00 UTC waits until 13:00 UTC, §12 Q6); a check that failed or took over 2.5 s; a list past 100 versions. The deploy then carries nothing and the success line says so. An admitted player's deploy waits for the check's round trip before the ceremony opens. | Reviews L4-8 (PARTIAL), L2-3, L1-1. Judging on the versions GET would make it a third transition host (your call). No hold-start seam exists for a prefetch (V1); a prefetch on mount is a follow-up. |
| 8 | **The review's data source** | E2: "Data from `getStockAnalysisData` daily." | EODHD's `/eod/` for the window's own dates (`fetchWindowDaily`): the same endpoint and row mapping as the daily window `getStockAnalysisData` reads (the adjusted close), one call per symbol, under the same 11-call budget. No shared cache document is written. | Reviews L2-2 / L4-2 (CONFIRMED, high). `getStockAnalysisData` has no range option and reaches 90 calendar days back; a long-term window spans 86–94, so a long-term review was unavailable by construction, and any review opened weeks after it closed came back "No data". Its `SYMBOL_daily` cache document is one window by contract, so widening it was not an option. Amendment E names this as the build's reading. |
| 9 | **Lists longer than the budget** | E2: "at most 11 calls per version per lifetime"; "the equal-weight list change" | Ten names and SPY are priced; the list's figure is the mean of the names priced, and the card says "[n] of [N]" when that is fewer than all. "No data" is defined in table C V1.2 as no price for the window (none in the feed, not priced within the budget, a failed fetch). | Review L4-3 (CONFIRMED). Battle snapshots hold every ticker of the list (up to 40; screener lists of 25 are common). A figure counting 10 of 25 names must say so. Two label rows of mine in table C V1.2 (§12 Q5, Q9). |
| 10 | **The parse binding's gate** | E4 | Gated on its flag alone — no allowlist; a drop with no usable stored parse is refused (`400 unknown_drop`); no parse-cache fallback. | It is a correctness fix for every player, not a pilot surface. The fallback could only serve a forging client, ignored expiry, and was keyed by content (review L3-6). |
| 11 | **The notice on the refresh path** | — | The notice rides only the battle-created 200; a deploy that refreshes a running battle's portfolio returns as on `main`. | No battle is created there, so nothing carries; P1b's open question about exempting the refresh (its §5 row 6) is moot. |
| 12 | **A due close inside the decision** | — | If the idea's due close, or the agent's own battle's expiry, falls inside the decision's 20–60 s, the creation transaction still throws P1b's race error: 500, the race message, the cooldown restored, the deploy retriable at once. | Review L2-7 (CONFIRMED, low). Stripping the sibling at commit or re-resolving would change the fenced battle shape or `decide.js` beyond Part A. The retry is told before and after. |
| 13 | **Versions activated before P1c** | "the first carrying battle's frozen tickers" | Such a version's record names only its `lastDeployedBattleId`; that battle stands in as the first. | No list was kept before P1c. On the record of the 14 Oct shadow read, your v1 (OYvS…) was carried by the Shadow battle `vwuC…`, voided before any check, and its review fell due at 15 Oct's close — before E3 existed. E3 looks back three trading days, so it is not unwound now; its card will list that battle, marked voided. (Not read from production by this build.) |
| 14 | **Where the after-line cannot show** | E1: "the ceremony's success screen" | The success screen and the recovered reveal. Not after a lost response (nothing came back to carry it), and not with the ceremony off (it is on in production). | Review L4-7 (CONFIRMED, low): the handoff-failed path now carries it. |
| 15 | App navigation | — | The line and the battle links reach App through two window events, not new props. | The hub's S0 mount guard freezes the dashboards' mount props. |
| 16 | The unwind's cleared fields | "fields cleared" | `firstDeployedAt`, `reviewDueAt`, `lastDeployedAt`, `lastDeployedBattleId`, `reviewClockFault` set to `null`; `deployedBattleIds` set to `[]`; acts only while the version is `activated`. | A null is the record's "never set" (P1a's shape writes these as null before a deploy). |
| 17 | **Table C V1.2's labels** | "Table C V1.2 holds these lines and the button labels" | It also holds the review card's seven labels ("Difference", "pts", "Each name", "No data", "[n] of [N]", "Battles", "voided"). | The card needs them and "no new player wording beyond table C V1.2" puts them there; they are mine — your sign-off. |
| 18 | Table C V1.1's note | — | "the last two rows are added" now reads "rows 6–7 are added". | Five rows follow them now. |
| 19 | The evidence's timing | — | Computed on first view, 3 h after the window's last close at the earliest; a claim's lease is 120 s; a failed fetch is final under the lifetime budget. | §3.2; whether a failure may be retried is a budget question (§12 Q5). |
| 20 | **Two frozen sources** | B3 ([LIST] via `lastDeployedBattleId`) and E2 ("the first carrying battle") | The review line and the screen's title name the last carrying battle's list; the card names the first's. They differ only if the list was renamed or re-ticked between redeploys of one active version. | Reviews L2-8 / L4-10 (CONFIRMED). Two rulings name different battles (§12 Q4). |

---

## 6. Off-mode changes

**The record slice's gate off** (the flag off, or the owner off the cockpit allowlist):
- **Deploy:** both `decide.js` branches are byte-identical to `main`. P1b's off golden (`api/agent/decide.carriageOffGolden.test.js`, captured from `main` at `4b28cd84`, SHA-pinned) passes unchanged at this head (§10). The resolver returns before any read, so there is no notice key.
- **The review route** answers `404 disabled` before any read. **The review pass** returns before any read, as before. **The Forge** renders nothing, as before.
- **One change — the due-idea check before a deploy.** While `HYPOTHESIS_RECORDS_ENABLED` is `true` (it is, since #948), a deploy of an agent with an equipped list first asks the Forge's versions GET. For an owner off the allowlist the GET answers `404 disabled`, which reads as "nothing due", and the deploy runs as on `main`: no screen, no words. That answer is **remembered for the page session** — the first deploy pays one round trip (bounded at 2.5 s), later ones make no request and log nothing (review L1-1). With the flag `false` there is no request at all (`dueIdeaCheck.test.js`).
- **App** registers two window-event listeners (`OPEN_IDEA_EVENT`, `OPEN_BATTLE_REVIEW_EVENT`); nothing dispatches them except a P1c line or card.
- **The review pass, gate on for anyone** (not an off-mode change, stated for its cost — review L1-4): the `recent` phase adds one query per 15-minute tick (an empty answer in the steady state) and one bounded transaction (the row, the version, the battle) for each timed row armed within three trading days and not yet due; those rows count in `rows` / `notDue`. With the flag off the pass still returns before any read.

**`DIALOGUE_SERVER_PARSE_ENABLED` false (as shipped):** the paste path is byte-identical to `main`. The off golden was captured from `main` at `ff6248d1` before any P1c source (commit `b3974f78`), its fixture SHA-256 is pinned, and it passes at this head (§4 row 5).

**The gate on** (owners on the allowlist): Parts A–C are the change, live when this merges (§3, §14).

---

## 7. Client words

Every string below is table C's, byte for byte (`ideaCopy.test.js` parses the spec) — V1.2's, except the battle-ended line, which is V1's and V1.1's — and the panel's *existing* date format.

| Case | What the player sees |
|---|---|
| A deploy whose idea is due — **before** the deploy | One screen. A time-frame that elapsed: **"Your NVDA idea reached its time-frame."** (one name) or **"Your ‹frozen list› idea reached its time-frame."**. An open-ended idea whose battle ended: **"The battle ended with your NVDA idea still open-ended. It's flagged for review — reaffirm or retire when you're ready."** (or its `[LIST]` row). A clock-fault version, or no name known: no title. Three buttons, in this order: **"Reaffirm and deploy"**, **"Retire and deploy"**, **"Deploy without it"**. No close control. |
| …a reaffirm or retire step fails (or takes over 15 s) | No words; the three buttons are live again (§5 row 2). |
| A deploy that carried nothing because the idea is due — **after** | The ceremony's success screen (or its recovered reveal) adds **"This battle is running without your idea — it's still waiting for your review."**, a link that opens the list's Idea panel. |
| The review card | The window (**"‹start date› → ‹end date›"**); one row — **"‹frozen list› +4.12%"** (with **" · 10 of 25"** when the figure counts fewer than all of the list's names), **"SPY +1.30%"**, **"Difference +2.82 pts"**; a collapsed **"▸ Each name"** (each **"NVDA 181.20 → 190.05 · +4.88%"**, a sub-dollar close to four significant figures, or **"NVDA · No data"**); **"Battles"** with each carrying battle's date as a link, **"· voided"** on a voided one; once the evidence is in, the honest line **"‹agent› doesn't act on your ideas yet. This shows how the names did over the idea's time-frame — not what the agent did with it."** |
| A version returned to Ready because its only battle never ran | **"That battle never ran, so your idea is back to Ready. Its clock hasn't started."** — under the current version's status, or on a superseded version's own row in the versions list. |

---

## 8. Firebase Console steps

**None.** No index: the review pass's `recent` phase is a range and order on one field (`armedAt`, then the document id), served by the automatic single-field index exactly as the `due` phase's `dueAtMs`; the review route reads documents by id (`getAll`). No rule: the new fields (`deployedBattleIds`, `reviewEvidence`, `reviewEvidenceClaim`) live on the server-written version documents, which owners can already read and cannot write; `firestore.rules` is not in the diff.

---

## 9. BUILD_RULES §2 review

**Mandatory:** fence contact, and over fifty files changed. It ran as a multi-lens adversarial review with subagents.
- **Trees.** Each reviewer had its own LF `git archive` snapshot tree under the session scratchpad (`node_modules` linked by junction), was read-only on git and every other tree, and wrote its probes only under its tree's `.review-scratch`.
- **The lenses** ran at the build head `fbb7617c`:
  - **L1** the fence and the off guarantee;
  - **L2** lifecycle, including the unwind race;
  - **L3** prompt bytes — the coordinated review of the parse binding (Part D), every request shape, flag off and on;
  - **L4** player words against the record.
- **Verifiers.** V1–V4, one per lens, each on a fresh tree of `8d6b0a2c` (`fbb7617c` plus the review window's 90-day floor and two dialogue fixtures), told to refute every finding with a probe.
- **Mutation lens.** L5 ran last, on its own tree of the fix head (§9.2).
- **No reviewer consulted the advisor.** Ids are this build's own (L·, V·); they are not the P1b build's.

### 9.1 Findings, verdicts, dispositions

| ID | Finding (short) | Verifier verdict | Disposition |
|---|---|---|---|
| L1-1 | With the flag true in production, every deploy of an equipped agent waits on an untimed versions GET before the ceremony opens; players off the allowlist get `404 disabled` and a warning on every deploy; a hung GET holds the deploy and the app-wide hold slot | CONFIRMED (V1: medium) | **Fixed.** `dueIdeaCheck.js`: a `disabled` answer is remembered per owner for the page session (no request, no warning after it); no answer holds a deploy longer than 2.5 s (a slower one is "nothing due"); the stage timing starts before the check and restarts at the screen's choice. The round trip for an admitted player remains (§5 row 7). |
| L1-2 | The shells swap at 768 px; a swap with the screen open leaves the deploy waiting and the hold held for 180 s | CONFIRMED (V1: low) | **Fixed.** A shell unmounted while the screen waits settles the waiting deploy (`{ success: false }`, the hold released at once); a reaffirm answer landing after that deploys nothing. |
| L1-3 | The fenced diff rewrote a comment beyond the letter of the sanction | CONFIRMED (nit) | **Fixed.** The comment edit is now the deletion of the stale sentence alone: **+2 / −13** (§1). |
| L1-4 | A comment claimed a pass with no void writes the pre-P1c summary exactly; the `recent` phase adds a query per tick and counts not-yet-due rows | CONFIRMED (nit) | **Fixed** (the comment), and the cost is stated in §6. |
| L1-5 | The hub's prose and fixtures still call 409 `hypothesis_review_due` the refusal reachable today | CONFIRMED (nit; follow-up) | **Carried forward** to the hub's next slice (§12). |
| L1-6 | The dialogue golden's GENERATE mode neither refuses CI nor fails after writing (P1b's precedent does both) | CONFIRMED (nit) | **Fixed.** Both guards copied. (A regeneration still reproduces the pinned SHA, V1's probe.) |
| L2-1 | The deploy path ignored E3: a deploy reaching the version before the pass flagged a never-ran battle-end idea due (the notice false, E3 lost for good) or carried a timed one on (B6) behind the never-ran battle; an expired battle with no check stays `active` until agent-evaluate's next weekday tick, so the pass never saw it as over | CONFIRMED (V2: high for the battle-end case; the timed clock part refuted in practice — both instants anchor to the same session) | **Fixed.** (a) One "over" rule: terminal or past its own `expiresAt` (`battleIsOver`). (b) "Never ran" = over, zero evaluations, no trades. (c) The deploy applies the pass's own unwind first (`unwindVoidCarriage`: the pass's decision and writer in one transaction, stepping back as often as it applies, five steps at most), then judges or carries the version as it now stands. Readings for your sign-off: §5 rows 5–6. |
| L2-2 | Long-term review evidence was unavailable by construction (the daily window reaches 90 calendar days; a long-term window spans 86–94) — and the fix commit's one-day margin refused more | CONFIRMED (V2: high) | **Fixed.** The evidence reads EODHD's `/eod/` for the window's own dates (`fetchWindowDaily` — the daily window's endpoint and row mapping, one call per symbol, no shared cache write). The floor is gone. Departure for your sign-off: §5 row 8. |
| L2-3 | The pass flagged a battle-end row only when terminal, the deploy also at expiry: the screen never opened for an expired-but-active battle | CONFIRMED (V2: medium) | **Fixed** by L2-1's one rule. **Residual:** from 1 Nov (EST) a battle's 20:00 ET expiry is 01:00 UTC, after the reflections cron's last tick; until 13:00 UTC only the deploy can judge it, after the fact (§12 Q6). |
| L2-4 | "Retire and deploy" can carry an older ready version (B2 as written) | CONFIRMED (V2: low-medium) | **Documented**, your call (§5 row 3, §12 Q2); the screen's contract comment corrected. |
| L2-5 | A step-back whose previous battle cannot be read was skipped, not judged | CONFIRMED (low) | **Fixed.** Judged as before, counted `voidUnresolved`. |
| L2-6 | A failed market-data fetch was stored as `no_data`; the suite's double threw where production does not | CONFIRMED (low) | **Fixed** by L2-2's fetch: a non-200 or a network error throws → `fetch_failed`; the suite now stubs the network and runs the real row mapping. A failure stays final under the 11-call budget (§12 Q5). |
| L2-7 | A due close (or the agent's own battle's expiry) inside the decision's 20–60 s window still fails the deploy with the race message | CONFIRMED (low; the fix needs fence contact) | **Documented** (§5 row 12). Retriable at once; the retry is told before and after. |
| L2-8 | The card names the first carrying battle's list, the review line and the title the last's | CONFIRMED (low; needs a ruling) | **Documented**, your call (§12 Q4). |
| L2-9 | A superseded version unwound to Ready showed no void line | PARTIAL (V2: nit — it stays in the versions list) | **Fixed.** The void line renders on that version's own history row. |
| L2-10 | A one-id list that is not the first deploy could take the `only` branch and erase a clock that ran | CONFIRMED (low) | **Fixed.** `only` always requires `firstDeployedAt` to be that battle's creation. |
| L2-11 | Every review read up to 50 full battle documents, even to answer a 409 | CONFIRMED (nit) | **Fixed.** The window first (a timed window reads no battle, a battle-end window its last one); the carrying battles only for an answer. |
| L2-12 | A version retired before its due date waits for the due close and is priced over the full window; an empty window's list said `no_name_priced` | CONFIRMED (nit) | Empty window **fixed** (the list says `empty_window`); the retired window is **your call** (§12 Q7). |
| L3-1 | The flip was not four edits: seven rows reddened in two suites whose drop fixtures differ from their envelopes; the recipe omits the docstring state lines | PARTIAL at `8d6b0a2c` (V3: the red rows already fixed there; low) | **Fixed properly.** The drop fixtures are honest (the P2 harness's `signalDropDoc`, the dialogue suite's `VALID_SIGNAL_DROP`), so every dialogue-reading suite runs the same path with the flag on or off — V3: goldens unchanged, zero mismatch-branch hits — and 8d6b0a2c's flag-off mock is gone. The recipe names the state lines (§13). |
| L3-2 | The binding suite could not see `serverParseOf`'s shaping (a raw-parse mutant survived) | CONFIRMED (low) | **Fixed.** An honest client whose stored parse is over the caps and off the enums: flag on is the flag-off run, byte for byte. Kills both of V3's mutants. |
| L3-3 | A session started before the flip keeps its client envelope on later turns | CONFIRMED (nit) | **Documented** in the flag docstring and §13. |
| L3-4 | A validation map too deep to hash failed the request (500) | CONFIRMED (nit) | **Fixed.** A throw is a mismatch: 200, the server's parse, the marker set. |
| L3-5 | The docstring claimed text-entry URL attribution, which is not built | CONFIRMED (low) | Docstring **corrected**; §2.8's attribution clause is open (§12 Q8). |
| L3-6 | The parse-cache fallback was unreachable for honest clients, ignored expiry, and was keyed by content (another user's note could steer it) | CONFIRMED (nit/low) | **Fixed.** No fallback: only the drop record's own parse, by dropId; anything else is `400 unknown_drop`. |
| L4-1 | "Your … idea reached its time-frame." rendered for ideas due because their battle ended (no time-frame) and for B5 clock-fault versions | CONFIRMED (V4: medium; needs a ruling) | **Fixed by a reading** (§5 row 1): the title only for `horizon_elapsed`; a battle-ended idea shows table C's own line for that state; B5 none. Your sign-off. |
| L4-2 | = L2-2 | PARTIAL (core confirmed; high for long-term) | As L2-2. |
| L4-3 | Names past the 10-name budget said "No data"; the list figure did not say it counted only the priced names | CONFIRMED (medium) | **Fixed by a reading** (§5 row 9): the list figure carries "[n] of [N]" when it counts fewer than all; "No data" is defined in table C V1.2 as "no price for the window" (none in the feed, not priced within the budget, a failed fetch). Two label rows for your sign-off; pricing every name needs a budget ruling (§12 Q5). |
| L4-4 | = L2-1, plus: a failed deploy-time judgment sent the notice while the record still read `activated` | CONFIRMED (medium) | As L2-1; a failed judgment now carries nothing, **silently** (the record is not yet due); the "at most one tick" comment corrected. |
| L4-5 | (a) = L2-4; (b) on an uncommitted equipped list the screen showed, though the deploy then carries nothing and says nothing | CONFIRMED | (a) as L2-4. (b) **Fixed.** The versions GET says whether the list is committed (only with a due version); the check shows nothing for an uncommitted list. |
| L4-6 | After a failed step the screen showed text containing "try again" | PARTIAL (V4: low; needs wording) | **Fixed by a reading** (§5 row 2): no words — the buttons are live again. A failure line is your wording (§12 Q3). |
| L4-7 | A created battle whose client handoff threw lost the notice; the recovered reveal never showed it | CONFIRMED (low) | **Fixed.** The notice rides the handoff-failed result to the recovered reveal. A lost response cannot carry it (inherent); the ceremony is on in production. |
| L4-8 | No screen when only the server knows the idea is due (activated with a passed clock or an over battle before the pass runs; a failed GET; over 100 versions) | PARTIAL (low) | **Documented** (§5 row 7). The screen's buttons act on `review_due` records only, so judging on the GET would be a third transition host. |
| L4-9 | The honest line showed while no names were; a `computing` answer was never asked again | CONFIRMED (low) | **Fixed.** The line waits for the evidence; the panel asks again (three times, 5 s apart) while another request computes. |
| L4-10 | = L2-8 | PARTIAL (low) | As L2-8. |
| L4-11 | The change % was the raw closes', not the shown closes' | CONFIRMED (low) | **Fixed.** Closes stored as shown (2 decimals from $1, else 4 significant figures) and the % derived from them. |
| L4-12 | = L2-9 | CONFIRMED (low) | As L2-9. |
| L4-13 | While busy every button was disabled (focus escaped); a hung step had no bound; `deployDisabled` was not re-read after the choice | PARTIAL (nit/low) | **Fixed.** Busy, never disabled; a 15 s bound per step (then failed; the next press re-reads); `deployDisabled` re-read after the choice. |
| L4-14 | Strings composed outside the table (the untitled screen's aria-label, the `SPY` and battle-id fallbacks); "No data" on the list and market rows; the fenced writer's `'Agent'` fallback in [AGENT]; stale hub prose | CONFIRMED (nits) | "No data" on the list and market rows is now in its table row. The aria-label joins the table's own three labels; the fallbacks are defensive (the server always sends `SPY` and each battle's `createdAt`); `'Agent'` is the fenced writer's — **kept and documented**. Hub prose: follow-up (L1-5). |
| L4-OL | = L1-1 (out of lens) | CONFIRMED | As L1-1. |

**Tally:** 39 findings (L1 6, L2 12, L3 6, L4 14 and one out of lens): **32 CONFIRMED, 7 PARTIAL, 0 refuted.** **Fixed: 24 · fixed by a reading that needs your sign-off: 7 (L2-1 and L4-4 — "never ran" and the deploy's unwind; L2-2 and L4-2 — the data source; L4-1 — the title; L4-3 — "[n] of [N]"; L4-6 — no words on failure; §5 rows 1, 2, 5, 6, 8, 9) · documented or your call: 8 (L1-5, L2-4, L2-7, L2-8, L3-3, L4-8, L4-10, L4-14).** Every lens found the fence clean and the gate-off path byte-identical to `main`; L3 and V3 found the parse binding's honest-client prompt byte-identical in every request shape they could build.

### 9.2 Mutation lens (L5)

**Method.** Four agents, one per area the prompt names, each on its own LF tree of the fix head `61e3da8e`: single-point mutants applied one at a time by exact-string replacement (each find string checked to match once), the area's suites run, the file restored and its SHA-256 verified; every tree manifest-checked byte-identical at the end. Operators: negated conditions, swapped comparisons, dropped conjuncts, changed constants, deleted statements and written fields, swapped branches, changed reasons, removed guards. Every survivor was argued equivalent or killed by a row the lens wrote and proved (red on the mutant, green on the original).

| Lens | Area | Mutants | Caught | Equivalent | Real gaps → rows |
|---|---|---|---|---|---|
| **L5a** | the resolver change and the deploy path (`carriage.js` — the walk, the E3 loop, the judgment, `deployedBattleIds`; `model.js`; the fenced notice line; `dueDeployPending`; `dueIdeaCheck.js`; `DueIdeaInterstitial.jsx`; the notice through `agentDeploy.js`, `deployResult.js`, `DeployCeremony.jsx`; `dueDeployTitleFor`) | 138 | 93 | 18 | 27 → 18 rows |
| **L5b** | the void unwind (`reviewPass.js` — `battleIsOver`, `battleNeverRan`, `voidBranchOf`, `decideReview`, the shared writer, `unwindVoidCarriage`, `reviewOne`, the `recent` phase, its cursor and counters) and the backward walks (`horizon.js`) | 171 | 128 | 23 | 20 → 17 rows (one, L5a's C36 word for word, kept once) |
| **L5c** | the review computation (`review.js`, the route, `REVIEWABLE_STATUSES` / `reviewableVersion` / the honest line, `IdeaReviewCard.jsx`, `countedOfText`, the panel's review effect and placement) | 177 | 102 | 25 | 50 → 31 rows |
| **L5d** | the parse binding (`watchlist-dialogue.js` — `serverParseOf`, the binding block, the session write, the hash check it rides on; the flag line; `canonicalHash.js` as used) | 79 | 63 | 5 | 11 → 4 rows |
| **All** | | **565** | **386** | **71** | **108 → 69 distinct rows** |

**Net: 565 mutants — 386 caught, 71 argued equivalent (or, once, not a defect), 108 real gaps; every real gap is killed by a row now in the suites, each proven red on its mutant and green on the original** (commits `705f48b7`, `f41df11c`, `a122d3b1`, `8cc1d3eb`). None of the 108 was a defect in the code: each was correct behaviour no row pinned. The lenses ran at 61e3da8e on Windows; each baseline was green (one Windows load timeout excluded and named by L5b), and every tree's manifest was byte-identical at the end.

- **L5b.** The most important gap: **a battle-end row armed before the look-back must still read its battle** — no fixture armed one that early, so a regression there would have silently stopped every battle-end review older than three trading days (pinned now). Then: the deploy-side unwind is a compare-and-set on the version and on the battle, keeps a battle that ran, judges an unanchorable step-back as before, and treats a vanished row as moved; the cutoff's first instant is inside the look-back; two voids in a pass are both counted; a calendar that cannot place the look-back unwinds nothing and runs no `recent` query; the previous battle is a transactional read; the `recent` phase leaves a due row to the due phase; a missing stamp never matches a missing stamp; a stale row never reads its battle; the backward walks fail typed at the calendar's edge (an untyped error there would have made the review card a 500 from January 2028). Equivalent (14, checked over 382,254 enumerated inputs for the pure functions): masked guards, dead-equivalent fallbacks, a NaN that never compares, a value both callers treat alike, a cursor field read as absent either way, UTC date arithmetic, `>=` from a counter that rises by one. Equivalent in use (8): inputs no caller produces (±Infinity instants, an unread battle, a non-string `createdAt`, a bad step count — both callers catch every throw). **Not a defect (1), a carry-forward:** a recently armed row whose `dueAtMs` is unusable is counted by no phase — a blind spot older than P1c (§12).
- **L5a.** All 27 gaps were untested correct behaviour; 18 rows across five suites kill them. Most worth having: the deploy's unwind **judged once** for a timed idea, a step-back that cannot be anchored judged as before (`kept`), and a version that moved between the unwind and the re-read never carried; a calendar that cannot place the look-back unwinding nothing; a timed chain; the creation transaction judging "due" at the battle's `createdAt` and reading the row's battle **transactionally** (a battle that ends mid-commit re-runs it); a malformed review row never acted on; the 50-id cap keeping the first and the newest 49; the screen's reaffirm and re-read bounded like the retire, and acting on the version the re-read names. Equivalent (18): an invalid creation instant (the fenced writer always stamps it — and both versions abort the same transaction), guards masked by `battleIsOver`'s own object check, two judgment answers the caller treats alike, a transactional read of a state that never reverts, a `moved` answer that falls through to the same `state_moved`, a loop exit one check early, an id that can never already be listed (`tx.create` rejects it), the cap's exact boundary, an unreachable pointer fallback, a timer that resolves an orphaned promise, and masks proven by `deployResultFor` and `fillLine`.

- **L5c.** All 50 gaps were untested correct behaviour, not defects; 31 rows (18 in `review.test.js`, 12 in `IdeaPanel.review.jsdom.test.jsx`, 1 in `ideaCopy.test.js`) and a two-line mock change (the security middleware's options recorded) kill them all. The ones that mattered most: the calendar's typed 409 for a window it cannot place (a battle-end window past 2027 would otherwise have been a 500); the **adjusted** close (every fixture had close = adjusted close, so a split inside a window would have been stored mispriced, for good); a missing or soft-deleted list (404, no market call); the 3 h settle and **a lease longer than the route's `maxDuration`** (a shorter lease would let a second request finalize a running computation as interrupted, permanently); an `invalidated` version's card; minus signs, sub-dollar closes, nothing priced, no difference; the newest reviewable version's card; the 1 + 3 asking bound and nothing after unmount; the card's placements; a move or a re-pointed list never showing the old card. Equivalent (25): guards on states no writer produces (battle ids are written only by the creation transaction of a battle that carried that version; no code deletes battles; `firstDeployedAt` is always an instant, `reviewDueAt` always present), 1 ms boundaries, an already-normalized snapshot, a value equal on both sides (`roundClose(1)`), row order nothing reads, a NaN the JSON response turns to null, `readOnly` (locking only), a field no consumer reads, a redundant `isFinite`, and the claim/store checks that hold while the lease exceeds `maxDuration` — itself now pinned.
- **L5d.** The 11 gaps: `serverParseOf`'s copies of `shouldBailout` / `shouldHardCheckpoint` (no fixture set either bit — with the flag on, an honest low-confidence drop would have lost the bit and been marked a mismatch); the mismatch warning (never read); five holes in `validateParseResult`'s pre-existing coverage that matter now that its shaping is the only step between Haiku's stored parse and the prompt (implied-ticker cap, ticker upper-casing, data-point and topic trimming, a non-object validation); and the contentHash check's `typeof` disjunct (pre-existing). Four rows in `watchlist-dialogue.parseBinding.test.js` kill all eleven. Equivalent: a non-object drop (the handler only passes Firestore data), a non-string hash (never equals the drop's), `=== true` on a boolean literal, "use the server parse only on a mismatch" (equal canonical hashes mean equal content), and a descending key sort (any fixed order is canonical within one process). The lens confirmed the flip moves only the pins: with the real constant set true, the dialogue, research-host and integration suites stay green — their fixtures are honest drops (review L3-1).

---

## 10. Test runs

Linux runs: WSL Ubuntu, a private clone per run (`~/pd-p1c`, `~/pd-p1c-b`), Node 20.20.2 / npm 10.8.2 as CI, `TZ=UTC`, `npm run test:run -- --maxWorkers=2` (as `.github/workflows/tests.yml`), each tree fetched at the named commit and checked clean before and after; the dry-run edits applied by script and the clone reset after.

| Run | Where | Result |
|---|---|---|
| **Full suite, CI-shaped, `main`'s flag values** | WSL, the code head `8cc1d3eb` | **23,803 passed, 0 failed** (23,892 rows incl. 89 skipped; 1,110 files; 887 s). The 22 suites P1c adds or changes hold 809 of those rows. |
| **P1c flip dry run** — §13's four edits | same | **23,803 passed, 0 failed** (776 s). The flag exported `true`: the pin row asserting it passed. |
| **P1c control** — the flag line alone | same | **Exactly 3 failed — the designed pin rows:** `dialogueServerParseFlags.test.js` "is DARK"; `flagPinGuard.test.js` "every pinned flag matches its live value" and "DARK_BY_DESIGN lists only real, currently-dark flags". Nothing else moves. (A first attempt, before the run chain was stopped by mistake and restarted, also failed one `leagueRawIds.guard` row on its 5 s limit — 5,165 ms, against 1.5–2.2 s in the other runs.) |
| **Record-slice rollback** — `HYPOTHESIS_RECORDS_ENABLED = false` with its four edits (P1b §13 step 4, backwards) | same | **23,803 passed, 0 failed** (702 s) — acceptance row 7's second value. |
| **Record-slice control** — that flag line alone | same | The **2 designed pin rows**: `hypothesisRecordsFlags.test.js` "is LIVE" and `flagPinGuard.test.js` "every pinned flag matches its live value" — plus two rows that hit their 5 s limit on a slow run (1,039 s, against 702–887 s for the others): `film-tape-backfill.e2e` (6,449 ms) and `backingLanding.test.jsx` (5,043 ms). Neither depends on the flag: at the same value, in the rollback run, they took 3,033 ms and 941 ms and passed. |
| The off golden **on `main`'s code** | a private Linux clone detached at `ff6248d1`, the golden test, harness and fixture copied in, LF | Captured there (`GENERATE_…=1`), committed first (`b3974f78`); **12/12** at the head. Verifier V1 regenerated it from the head's flag-off path and got the pinned SHA-256 (`079c1bbd…`). |
| `npm run lint:gate` | an LF tree of the pushed head | **green** (exit 0, `--max-warnings 0`) — at the code head `8cc1d3eb`, and again on the pushed head itself (it adds only this report). |
| `vite build` | an LF tree of the pushed head | **green** (exit 0; the existing chunk-size notice only) — at the code head `8cc1d3eb`, and again on the pushed head itself: the pushed commit is the built commit. |
| Earlier runs (superseded, stated for the record) | WSL | The build commit `fbb7617c`: 23,695 passed, 0 failed. `8d6b0a2c`: the flip 23,696 / 0; its control and rollback, run two at a time beside four Windows verifiers, failed the designed pins plus load-timing rows (`candlePass`, a reduced-motion jsdom row, `reviewAvailability`, `film-tape-backfill.e2e`, a hub SVG row). `61e3da8e` (the review round): 23,732 / 0; its flip and rollback, run two at a time, each failed only `film-tape-backfill.e2e` (5.4 s against its 5 s row). **The final runs therefore went one at a time.** |
| The mutation lens and its proofs | Windows, four own trees of `61e3da8e` | §9.2. |
| Windows note | CRLF worktree | The usual platform-only rows fail here and pass on Linux: `shadowCpuQuoteIntegrityFlags`, `agentReadCensus.guard` (path separators). None is this build's. The broad Windows run of every suite near the fix round: 4,299 passed, those 4 failed. |

---

## 11. Advisor consultations

The prompt allowed exactly two: (1) with the plan, before the first `decide.js` edit; (2) before declaring the build done. Review subagents did not consult it. Consult #1's first call timed out ("The advisor timed out. Proceed without it."); it was retried once and the retry answered — recorded as consult #1.

| # | When | What it said (quoted where it decided something) | What changed because of it |
|---|---|---|---|
| 1 | After discovery, before any fenced edit | "Plan is sound. Proceed, with these changes and checks before the first `decide.js` edit." Then:<br>• "**Pre-step failure must not fall through to a deploy.** … stop there: show the server's typed message in the overlay and leave the same three buttons standing."<br>• "**`DEPLOY_REFUSAL_CODE` stays; the writer and the deploy station's special case go.** The hub translator reads it under ruling R-S2A-2 … so 'once no reader remains' is not met."<br>• "**The second `refuse` site (`carriage.js:322`, judgment failed)** … Decide deliberately: keep the notice … and state the transient window in the report, or use a distinct reason that carries no notice."<br>• "**The P1c flag follows the pre-flip shape** … Gate on the flag alone … record that reading."<br>• The write-site ratchet; "**The 90-day daily window** … where the start date predates the window, mark every name `unavailable` honestly and report the limit (the prompt binds you to the existing authority). Also set `config.maxDuration` on the route."<br>• A backward session walk; the pre-build frozen source is the last battle, not the first; `[AGENT]` from the frozen battle; no invented title when neither name is known; one shared `dueDeployPending` with an agreement row; the stale flag docstring; the unwind's ordering against the `recent` phase.<br>• Process: capture the dialogue golden from `main` before touching `watchlist-dialogue.js`; quote the `decide.js` diff in full; "Acceptance 7's 'both values' means a reverse dry run too." | All adopted at the time:<br>• a failed step stops (no fall-through), with a jsdom row;<br>• the constant kept, its reader named (§5 row 4);<br>• the judgment-failed site kept the notice, the window stated;<br>• the pre-flip pin shape, flag-alone gate (§5 row 10);<br>• ratchet recounted; the route's `maxDuration: 30`; the 90-day limit marked honestly (`outside_daily_window`, commit `8d6b0a2c`);<br>• `previousSessionOf` / `sessionAtOrBefore` with holiday rows; the last-battle fallback stated (§5 row 13); `[AGENT]` in `fillLine`; no invented title; `dueDeployPending` + `dueIdea.agreement.test.js`; the docstring fixed in Part A; the `visited` set and the `notYetDueOnly` pass;<br>• the golden captured first (`b3974f78`); §1; the `hr-off` dry run.<br>**Later overturned by the review, with evidence:** the failure text (L4-6 — the existing texts say "try again"; now no words, §5 row 2); the judgment-failed notice (L4-4 — the record still read `activated` for up to ~12 h overnight; now silent); the 90-day limit (L2-2 / L4-2 — a long-term review was unavailable by construction; now the window's own dates, §5 row 8). Consult #2 was asked about the last of these (below). |
| 2 | Before declaring done (everything committed, this report included — `ff8cf032`), asked also to settle the one conflict with consult #1: the review's data source | "**Verdict: no blocker. Proceed to push.**"<br>• On §5 row 8: "Ignore consult #1's 'the prompt binds you to the existing authority.' That advice predated the review's primary evidence … An honest 'No data' for the one horizon that most needs a review is not what E2 asked for. `marketDataCache.js` is not a hard boundary, so this is a reading, not a STOP item … That is the right shape. Keep it."<br>• Three things the checks did not cover: (1) the report claims `lint:gate` / `vite build` on the pushed head, but they ran at `8cc1d3eb` — "Run `lint:gate` and `vite build` on that exact final SHA … refresh the scratchpad copy and `cmp` it, then push"; (2) "Four new rows pin 2028 as 'outside the calendar'" — name them in §12's calendar carry-forward; (3) the PR body's run line was still a placeholder.<br>• Then the mechanics (commit by explicit path, lint + build at that SHA, push by refspec, `ls-remote`, the REST PR, stop — no CI watching, no auto-merge; leave the review trees' junctions intact), and: "the record-slice control's two timeout rows and the first P1c control attempt's `leagueRawIds` timeout are recorded with timings against the green runs. Good — don't soften that." | All adopted:<br>• the data source kept as built, first among the sign-off items (§5 row 8, the verdict, Amendment E);<br>• §12's calendar carry-forward names the four 2028 rows;<br>• the PR body's runs filled from §10;<br>• this row filled and committed; `lint:gate` and `vite build` re-run on that exact commit — the pushed head — before the push; the scratchpad copy refreshed and `cmp`-verified;<br>• the timeouts left as recorded. |

---

## 12. Founder questions and carry-forwards

**Questions (nothing is blocked on them; the built default is named):**
1. **The screen's title for an idea due because its battle ended** (§5 row 1): table C's battle-ended line (built), no title, or a new row?
2. **"Retire and deploy" when an older ready version exists** (§5 row 3): keep B2 as written (it may ride), or carry nothing older than the newest deployed version?
3. **A failure line for the screen** (§5 row 2): none is shown now; table C V1.2 has no row for it.
4. **One battle for both names** (§5 row 20): the card's list name and names come from the first carrying battle (E2), the review line and the title from the last (B3). Pick one?
5. **The review budget** (§5 rows 9, 19): 11 calls price ten names and SPY. Price every name of the list (up to 40), and may a failed fetch be retried within a lifetime budget?
6. **The winter overnight gap** (§5 row 7): from 1 Nov a battle's 20:00 ET expiry is 01:00 UTC, after the reflections cron's last tick (`*/15 13-23,0 * * *`); until 13:00 UTC only the deploy's own judgment sees the idea due — the screen cannot open first. Extend the existing cron entry's hours by one, or let the versions GET judge (a third transition host)?
7. **A version retired before its due date** (§3.3): its card waits for the original due close and prices the full planned window. Or price to the retirement?
8. **Spec §2.8's text-entry URL attribution** (review L3-5): not built — the text entry drops a URL typed beside the text before parse-signal. In scope for a later build?
9. **Sign-off on the readings** in §5 rows 1, 2, 5, 6, 8 and 9 — above all row 8, the review's data source.
10. Still open from P1a/P1b: two carrying battles at once (P1b Q3), B5's chip-only state (P1b Q4), P1a/P2's open items.

**Carry-forwards:**
- **The hub's review-due reader** (§5 row 4): `attemptVocabulary.js` still maps 409 `hypothesis_review_due`, and its prose calls it the refusal reachable today (reviews L1-5, L4-14). Retire it, with `DEPLOY_REFUSAL_CODE` and `DUE_DEPLOY_LINE`, in the hub's next slice (S2b).
- **A prefetch of the due-idea check** (§5 row 7): on the dashboard's mount or an equip change, so an admitted player's deploy never waits a round trip (no hold-start seam exists — V1).
- **A due close inside the decision window** (§5 row 12): needs a fence entry (the battle's shape) or `decide.js` beyond Part A.
- **The fenced writer's `'Agent'` fallback** (review L4-14): the honest line would read "Agent doesn't act on your ideas yet." for a battle frozen without a name.
- **The market calendar ends 2027-12-31** (P1a carry-forward 7); every backward walk here throws `calendar_unavailable` past it, as the forward ones do. **Four P1c rows use 2028 as "outside the calendar"** and go red the day it is extended — re-point them in that change: `carriage.voidUnwind.test.js` C22, `reviewPass.unwind.test.js` P03, `horizon.p1c.test.js` HZ2 (which also uses 2 Jan 2026 as "before it"), `review.test.js` RV19.
- `film-tape-backfill.e2e` timeout headroom (P1a carry-forward 8) — it reddened (5.4 s against its 5 s row limit) whenever two Linux runs shared the machine in this build's early dry runs (§10).
- **A malformed review row nobody counts** (mutation lens L5b, R116): a row whose `dueAtMs` is neither a number nor null matches neither the `due` nor the `unspecified` query, so no phase reads or counts it. Older than P1c; a small task of its own.

---

## 13. The P1c flip — `DIALOGUE_SERVER_PARSE_ENABLED` (Part D)

**Founder's own PR, never a build PR. Four edits, one commit:**
1. `src/config/featureFlags.js`: `export const DIALOGUE_SERVER_PARSE_ENABLED = true;`
2. `src/config/dialogueServerParseFlags.test.js`: the pin row `expect(DIALOGUE_SERVER_PARSE_ENABLED).toBe(false)` → `toBe(true)`.
3. The same file's registration row: `expect(GUARD).toMatch(/^\s*DIALOGUE_SERVER_PARSE_ENABLED:/m)` → `.not.toMatch(...)`.
4. `src/config/flagPinGuard.test.js`: delete the two-line `DIALOGUE_SERVER_PARSE_ENABLED:` entry from `DARK_BY_DESIGN` (leave an "intentionally ABSENT" comment in its place, as the file does for every flipped flag).

**In the same commit, the state lines** (BUILD_RULES §2: "any docstring that calls the old value the DEFAULT"; review L3-1): `dialogueServerParseFlags.test.js`'s header ("ships FALSE") and its two row titles ("is DARK", "while it ships false"). The flag's own docstring names no shipped value. These are wording inside edits 2–3's file, not further edits.

**Dry-run at the code head `8cc1d3eb`** (§10): with the four edits, the full Linux suite is green (23,803 passed, 0 failed); with the flag line alone, exactly the three pin rows fail.

**What it changes.** An honest client — one that sends the envelope `/api/forge/parse-signal` returned — gets the same session and the same prompt bytes, flag on or off (`watchlist-dialogue.parseBinding.test.js`'s honest rows compare the on-mode prompt to the off golden's, Haiku output past the dialogue's caps included). A client whose envelope differs from the stored parse is answered from the stored parse, and its session records `parseEnvelopeMismatch: true` (with a server log line). A drop with no usable stored parse is refused `400 unknown_drop`; `/api/forge/parse-signal` has stored the parse on every drop record, cache hit or miss, since it shipped (26 April 2026, `680301984`), so a live drop always has one. **A session started before the flip** keeps its stored envelope for its later turns (up to its 20 messages): only a custom client could resume one, and the forgery could only mislabel where its own idea's horizon came from (review L3-3). **After:** watch for `parseEnvelopeMismatch` in the dialogue's log for a few days — any hit is a client that sends something other than its parse. **Rollback** is the same four lines back; sessions already written keep what they stored.

---

## 14. Flip checklist — the whole record slice (P1a + P2 + P1b + P1c)

`HYPOTHESIS_RECORDS_ENABLED` was flipped on 9 October (#948), so steps 1–4 of P1b's checklist are done. **P1c adds no step to them**: no index, no rule, no environment variable, no flag for Parts A–C.

| Step | State |
|---|---|
| 1. The two Console indexes (`hypothesisVersions` collection group `userId`/`status`/`stateChangedAt`; `researchWork` `userId`/`createdAt`) | Done (P1a/P2). P1c adds none (§8). |
| 2. Publish the rules | Done. P1c changes no rule. |
| 3. `COCKPIT_ALLOWLIST_UIDS` holds your uid (Production; redeploy after an edit) | Done. The P1c changes reach exactly the owners on it. |
| 4. `HYPOTHESIS_RECORDS_ENABLED = true` (four edits) | Done (#948). **Merging this PR makes Parts A–C live** for those owners. |
| 5. `DIALOGUE_SERVER_PARSE_ENABLED = true` (four edits) | **Open** — §13, when you choose. Independent of steps 1–4. |

**Rollback of the slice** is still P1b's four lines back. What P1c adds to what stays behind: versions keep `deployedBattleIds` and any `reviewEvidence`; with the flag off the due-idea check makes no request, the review route answers `404 disabled`, and nothing is unwound.

**The first things to try after merging** (the P1b list's items 1–4 still hold; item 5 changes):
1. **A deploy with a due idea.** Deploy an agent whose equipped list's idea reads **Review due**. Before anything runs, the screen asks: **Reaffirm and deploy**, **Retire and deploy**, or **Deploy without it** — titled **"Your … idea reached its time-frame."** for a timed idea, or with the Forge's battle-ended line for an open-ended one.
2. **Deploy without it.** The battle runs carrying nothing; the success screen says **"This battle is running without your idea — it's still waiting for your review."** Tap it: the Forge opens on that list's editor, at the Idea panel.
3. **The review card.** Under the review line: the window, the frozen list's move against SPY's and the difference, **Each name**, the battles (tap one for its Film Room), and the honest line. It fills in 3 hours after the window's last close, whenever it is first opened.
4. **Reaffirm and deploy.** The version is reaffirmed and **v{n+1}** rides; no notice.
5. **A battle that never ran.** A carrying battle that ends with no check and no trade (voided, or expired after an evening deploy) within three trading days of its deploy: within one review pass (15 minutes) — or at once, if you deploy that idea again first — the idea is **Ready** again, saying **"That battle never ran, so your idea is back to Ready. Its clock hasn't started."**; a redeploy then carries it as a first deploy. If it had an earlier carrying battle that ran, it steps back to that one and keeps its clock.

---

## 15. Branch and PR

Branch `claude/pilot-p1c-review-experience` (pushed by refspec from the app's local branch `claude/pilot-p1c-review-experience-aa25d5`). Commits, in order:

| Commit | What |
|---|---|
| `b3974f78` | The dialogue's off golden, **captured from `main` before any P1c source** (harness, fixture, test). |
| `fe74dce7` | Part F: the 14 Oct swap-identity shadow-read record, copied unchanged (SHA-256 compared before and after; `shadow-read.json` not copied). |
| `fbb7617c` | The build: E1, E2, E3, E4 (dark), Part E, table C V1.2, Amendment E. |
| `8d6b0a2c` | The review window's 90-day floor (superseded by `61e3da8e`) and the first flip-robust fixtures. |
| `61e3da8e` | The review round (§9.1). |
| `705f48b7`, `f41df11c`, `a122d3b1`, `8cc1d3eb` | The mutation lens's rows: L5d, L5c, L5a, L5b (§9.2). |
| this report | `docs/audits/20261022_BUILD_PILOT_P1C_REVIEW_EXPERIENCE.md`. |

Pushed, the PR opened, and stopped: you sign off the fenced diff (§1) and the readings (§5), read CI, and merge. Crons do not run on Vercel preview: the review pass, the void unwind and their interplay with the deploy are verified by the unit, handler and end-to-end tests, and in production by watching the first passes after the merge. A byte-exact copy of this report is in the session scratchpad (BUILD_RULES §3).

*Build report — Pilot P1c + the Idea Review Experience, Claude Code, 22 October 2026, base `ff6248d1`.*
