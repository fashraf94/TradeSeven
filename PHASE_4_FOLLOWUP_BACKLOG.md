# Phase 4 Voice Layer — Film Room Follow-Up Backlog

Small fixes and deferrals captured while shipping Phase 4 (Film Room — the dedicated post-battle review surface). Items here are not blocking the current phase but should be picked up before they accumulate.

## Open

### Forge suggestions display in Film Room

The Phase 4 review surface renders Haiku's `dailyReviews[].proposedRules` as read-only text but does not surface `agent.forgeSuggestions` filed during chat or batch review (both `api/agent/chat.js:345-368` and `api/cron/agent-batch-review.js:336-341` write to this list). These are agent-level knowledge candidates the user would benefit from reviewing in the same place they're reviewing the tape.

**Trigger to fix**: when Forge stabilizes its consumer-side UX (today it's still nascent). A new "Forge Suggestions" section in `FilmRoomScreen.jsx` analogous to DaySummaryCard's proposed-rules block; agent-scoped, not per-day.

**Filed**: May 24, 2026 — Phase 4 spec §6 carve-out.

### Proposed-rule accept/reject UX

Phase 4 renders `dailyReviews[].proposedRules` as static text. The spec §6 reserves the accept/reject flow (write to `agent.rules[]` on accept; drop with optional rationale on reject) for a later phase to avoid coupling Film Room shipping to the strategist-side rule lifecycle.

**Trigger to fix**: when the agent's autonomous decision-making pipeline can actually consume `agent.rules[]` as a hard constraint (today it consults `agent.lessons[]`). Until rules are load-bearing on the strategist side, the accept/reject UX is decorative.

**Filed**: May 24, 2026 — Phase 4 spec §6 deferred decision.

### Per-day review budget reset

Today `reviewBudgetUsed` is per-battle (cap 5 messages total). For a multi-day battle the cap covers the whole engagement, which may feel stingy on Day 3 if the user spent 3 messages on Day 1.

**Trigger to fix**: post-deploy observation. If founders or testers feel the budget hits a wall mid-battle, switch to a per-day counter: `reviewBudgetByDay: { day1: 0, day2: 0, ... }`. Backend change in `api/agent/chat.js` + frontend display change in `FilmRoomChat.jsx`. Server-side cron writes are unaffected (auto_debrief is not budgeted).

**Filed**: May 24, 2026 — Phase 4 planning carve-out.

### Counterfactual rendering in Film Room

Haiku's batch review can populate counterfactual context ("if you had not swapped X, your day would have been Y") via fields not yet read by the UI (planned for §6). Adding a counterfactual block to `DaySummaryCard.jsx` or a dedicated `CounterfactualSection.jsx` would directly answer the "what if?" question users will inevitably ask.

**Trigger to fix**: when Haiku's review prompt is taught to emit counterfactuals reliably. Today the field exists in the schema but Haiku populates it inconsistently.

**Filed**: May 24, 2026 — Phase 4 spec §6 deferred decision.

### Peer / leaderboard comparison

The Film Room renders the user's own tape only. A sibling section ("vs. peers playing the same regime / same tier") would give the user a calibration anchor. Requires aggregation across `agentBattles` filtered by regime / starting portfolio shape, which is a non-trivial query and a privacy decision separately.

**Trigger to fix**: when the season / peer leaderboards work matures elsewhere in the app. The Film Room is a natural mount point for it but not the place to invent it.

**Filed**: May 24, 2026 — Phase 4 spec §6 deferred decision.

### Battle aggregate view (full-battle summary, not just per-day)

Today the day picker switches the view between trading days. A "Full battle" tab/option would aggregate across all days (total trade points + badge points + grade trajectory + overall lesson summary). Cleanest as a separate `selectedDay === 'all'` mode in `FilmRoomScreen.jsx` with sub-components reading the aggregate.

**Trigger to fix**: post-deploy review. If users routinely want the full-battle take rather than per-day, prioritize this. For single-day battles it's redundant; for multi-day it may become the primary entry view.

**Filed**: May 24, 2026 — Phase 4 spec §6 deferred decision.

### statusFeed notification integration for Film Room

`statusFeed` is the in-battle event log. A new `action: 'film_room'` entry written when a daily review is filed (or when forge suggestions / lessons land) would give the user an in-battle "your tape is ready" signal. Today the user has to navigate manually.

**Trigger to fix**: when the in-battle notification dot logic is touched next. The Film Room banner already covers the discoverable case (it appears as soon as dailyReviews has an entry); the statusFeed addition is for users who scroll past the banner.

**Filed**: May 24, 2026 — Phase 4 spec §6 deferred decision.

### Mobile-specific layout for FilmRoomScreen

The screen renders well at desktop widths (~896px max content) but the day picker, score summary horizontal layout, and chat panel haven't been tuned for narrow viewports. A real mobile pass would stack the score summary vertically, give the day picker snap-scroll, and let the chat panel expand to full height.

**Trigger to fix**: when the mobile responsiveness pass is next swept across the app. The screen works on mobile today but isn't polished.

**Filed**: May 24, 2026 — Phase 4 planning carve-out.

### "Post-battle takeaway" instinct from design conversation

A standalone, single-sentence takeaway ("Your one-line lesson from this battle") that could live anywhere — top of Film Room, attached to a notification, surfaced on dashboard. It surfaced repeatedly in the Phase 4 design discussion but never quite landed in any section.

**Trigger to fix**: likely lives with Phase 5 (post-battle dossiers / agent identity evolution) where the agent's "personality update" from a battle is summarized. The takeaway is the user-facing surface of that update.

**Filed**: May 24, 2026 — Phase 4 design-conversation residue.

### BattleHistoryScreen agent-battle card visual polish

Phase 4 ships minimal agent-battle cards in `BattleHistoryScreen.jsx` (outcome letter, opponent label, date, score line, Review → button). They sit as their own section above the stats summary and do not match the visual richness of the existing BaggerBomb classic cards (gradient borders, larger score typography, matchup avatars, badge counts).

**Trigger to fix**: during the planned agent-universe redesign. Specifically considered out of scope for Phase 4:
- Visual parity with BaggerBomb classic cards (gradient borders, avatars, larger typography)
- Tab restructuring in BattleHistoryScreen (the card lives in its own section above tabs today)
- Pagination beyond the 20-result Firestore limit
- Filtering, sorting, archiving

**Filed**: May 24, 2026 — Phase 4 C3 scope refinement after discovery gap surfaced that completed agent battles weren't previously reachable from BattleHistoryScreen at all.

### FilmRoomScreen `user` prop documentation

The Phase 4 spec described the component signature as `{ battle, user, onBack }` but the implementation lands as `{ battle, onBack }` because `useAgentBattle` reads via Firebase Auth context internally and `agentBattle.ownerId` gates server-side writes. The deviation is silent today — a future contributor expecting prop-threaded `user` (for client-side gating, telemetry tagging, or display-name rendering) would be surprised.

**Trigger to fix**: ~2-minute doc fix. Add an inline comment on the component declaration in `src/screens/FilmRoomScreen.jsx` (line 28) noting the auth-context pattern and the deliberate omission of the `user` prop. Pick this up the next time the file is touched for any reason.

**Filed**: May 24, 2026 — Phase 4 post-audit cleanup (FLAG C1).

### DayPicker future-day discipline

Phase 4 ships a DayPicker that shows day-buttons for every entry in `battle.timing.tradingDays[]` and only differentiates reviewed days via a small amber dot indicator. Tapping a future or incomplete day renders the screen with each section in its empty state — functionally correct, but the spec intent was "only completed days are interactive (current/future days disabled or hidden)." Phase 4 test F2 only verified the single-day guard, not this discipline.

**Trigger to fix**: production observation at 48-72 hours. If users tap future days and get visibly confused (support tickets, session-recording dead-ends, drop-offs after the empty state), disable or hide them — disable is preferable because the day-count itself is useful context. If users intuit it correctly via the dot indicator, leave alone. Specifically considered out of scope for the Phase 4 ship: hard-coded UX assertions without real signal.

**Filed**: May 24, 2026 — Phase 4 post-audit cleanup (FLAG C3).

### Consumer-side chat-exchange filter documentation

FilmRoomScreen passes the full `chatExchanges` array to three consumers — AutoDebriefHero, AnticipationLogSection, FilmRoomChat — and each consumer applies its own predicate (`messageType === 'auto_debrief'`, `messageType === 'anticipation'`, `mode === 'review' && messageType !== 'auto_debrief'` respectively). Each predicate is correct in isolation, but the drift risk is real: if the auto_debrief or anticipation predicate is changed in one consumer without a corresponding change in FilmRoomChat's exclusion logic, the auto-debrief or anticipation could surface in two places (or fall out of both).

**Trigger to fix**: ~5-minute doc pass. Add a comment header above each filter declaration in the three files (`AutoDebriefHero.jsx:13`, `AnticipationLogSection.jsx`, `FilmRoomChat.jsx:142`) noting the scope of the filter and cross-linking the other consumers. Pick this up the next time chat-exchange routing is touched (e.g., a new `messageType` is added).

**Filed**: May 24, 2026 — Phase 4 post-audit cleanup (FLAG C1 secondary observation).

## Broader (non-Phase-4-specific) meta-followup

### Repo-wide lint baseline cleanup

The repo currently emits 1186 lint errors and 107 warnings on a fresh `npm run lint` (May 24, 2026 baseline). A large fraction are `'process' is not defined` errors in `api/scripts/*.js` files that run under Node and legitimately use `process.exit`, plus pre-existing `no-unused-vars` errors in older screens. Adding `globals: { process: 'readonly' }` to the ESLint config scoped to `api/scripts/**` would clear most of the `process` errors in one stroke; a broader unused-vars sweep would knock down another large bucket.

**Trigger to fix**: Phase 6 polish window, or any time someone is auditing CI health. Until the baseline is clean, individual phase audits have to do "stash → re-lint → unstash" to confirm zero net-new errors, which is fragile.

**Filed**: May 24, 2026 — Phase 4 audit G2 observation. Not Phase 4 scope.

### Firestore index source-of-truth drift + malformed `ingestedClaims` entry

During Phase 4 merge prep, the `(ownerId, status, completedAt DESC)` agentBattles index added in commit `4c53c5b` had to be created manually via the Firebase Console because `firebase deploy --only firestore:indexes` is currently unsafe to run: (1) 13+ indexes exist in prod but not in `firestore.indexes.json` (every CLI deploy prompts to delete them), and (2) an `ingestedClaims` entry is malformed and causes HTTP 400 from the Firestore API.

Full workstream documented separately at [`FIRESTORE_INDEX_DRIFT_CLEANUP.md`](./FIRESTORE_INDEX_DRIFT_CLEANUP.md) — inventory + reconciliation + validation in 5 phases. Estimated 30–60 min.

**Trigger to fix**: next time anyone needs to deploy a new Firestore index via CLI, OR during the next pre-launch hygiene pass. Until this cleanup ships, all new indexes must be dual-written (file entry in feature branch + manual console creation at merge prep).

**Filed**: May 24, 2026 — Phase 4 merge-prep deploy attempt. Not Phase 4 scope.

## Filed during Phase 4 code-review (post-audit)

The independent /code-review pass surfaced these items in addition to the
audit FLAGs above. The blocking and should-fix items from that review were
addressed inline; the items below were triaged as polish to land later.

### Client-side textarea length cap in FilmRoomChat (S5)

`FilmRoomChat.jsx:385` accepts arbitrary-length input. The server (`api/agent/chat.js:153`) silently truncates to 2000 chars AND strips `\n\r\t<>{}`. Two failure modes: (1) a long paste reaches Haiku with mid-sentence truncation, agent answers based on partial context, user confused; (2) the in-flight reconciliation predicate at `FilmRoomChat.jsx:179` uses trimmed text equality, so if the server-stored userMessage differs from the optimistic bubble, both render — user sees their question twice. AgentChat handles this correctly via `e.target.value.slice(0, 2000)` in onChange and a >1800-char counter at `AgentChat.jsx:966`/`1011`.

**Trigger to fix**: ~10-minute parity port from AgentChat. Pick up before the next user-facing iteration of Film Room chat.

**Filed**: May 24, 2026 — Phase 4 code-review S5.

### Loading vs missing-doc distinction in FilmRoomScreen (S6)

`FilmRoomScreen.jsx:79` collapses `loading=true` and `loading=false && agentBattle==null` into a single "Loading Film Room…" branch. If the agentBattle doc is deleted, owner-rule-denied, or the caller passes a malformed battle object, the user sits on the loading message forever with only the header Back as recourse.

**Trigger to fix**: when the screen sees its first reported "stuck loading" support ticket OR during the next account-deletion / data-rotation pass. Distinguish via `if (loading) return <Loading/>; if (!agentBattle) return <TapeUnavailable/>;`.

**Filed**: May 24, 2026 — Phase 4 code-review S6.

### Clear completedAgentBattles on logout / screen-change (S8)

`App.jsx:4589` early-returns when `!user` or `screen !== 'battleHistory'` without clearing the previously-loaded list. If user A logs out and user B logs in before the new fetch resolves, user B momentarily sees user A's completed battles.

**Trigger to fix**: ~2-line fix (`setCompletedAgentBattles([])` in the early-return). Pick up next time the multi-user privacy boundary is touched. Low-impact for single-tenant founder testing today, real for any shared-device or session-rotation scenario.

**Filed**: May 24, 2026 — Phase 4 code-review S8.

### AutoDebriefHero empty-state copy for past days (S9)

`AutoDebriefHero.jsx:36` shows "Today's debrief will be filed after the close." regardless of which day is selected. For a user viewing a past day on a completed multi-day battle where the auto-debrief failed to write (fire-and-forget per cron), the wording is wrong.

**Trigger to fix**: ~5-line conditional. Differentiate past day vs current day. Compare `selectedDay` against `agentBattle.timing.currentTradingDay` and `agentBattle.status`.

**Filed**: May 24, 2026 — Phase 4 code-review S9.

### FilmRoomChat error toast missing role="alert" (S11)

`FilmRoomChat.jsx:359` renders the `{error}` block inline with no `role="alert"` or `aria-live="assertive"`. SR users get no audible feedback on send failures (budget exceeded, 429, 504, session expired).

**Trigger to fix**: one-attribute change. Pair with the next a11y polish pass on Film Room.

**Filed**: May 24, 2026 — Phase 4 code-review S11.

### FilmRoomChat textarea aria-label + visible focus indicator (S12)

`FilmRoomChat.jsx:382-403` textarea has no `aria-label` and no `<label>` association — SR users hear generic "edit text". Additionally, `outline: 'none'` (line 400) without a `:focus-visible` replacement removes the focus indicator for keyboard users.

**Trigger to fix**: pair with S11 on the same a11y polish pass. Add `aria-label="Review chat message"` and either remove `outline: 'none'` or add a `:focus-visible` box-shadow.

**Filed**: May 24, 2026 — Phase 4 code-review S12.

### FilmRoomScreen back-button hardcoded to dashboard (N1)

`App.jsx:9135` mounts FilmRoomScreen with `onBack={() => setScreen('dashboard')}`. Both entry points (in-battle banner + Battle History Review button) route through this single back-handler. A user in an active multi-day battle who taps the banner to review Day 1, then hits Back, lands on Dashboard rather than the active battle. The banner functions as a one-way trapdoor.

**Trigger to fix**: track `prevScreen` (and optionally `prevBattleId`) before navigating to filmRoom, then route Back to that screen. Worth doing before Phase 5 ships because Phase 5 may add additional Film Room entry points (notifications, agent-identity-evolution surfaces).

**Filed**: May 24, 2026 — Phase 4 code-review N1.

### Optimistic message ID collisions on same-millisecond sends (N2)

`FilmRoomChat.jsx:218` uses `u-${Date.now()}` and `t-${Date.now()}` as React keys. Two rapid sends within the same ms tick (mashed Send, programmatic retry) collide. React logs duplicate-key warnings; the cleanup filter at line 261 drops BOTH typing indicators when the first server response arrives, so the second message's typing dot vanishes prematurely.

**Trigger to fix**: replace with `crypto.randomUUID()` or a monotonically increasing counter ref. ~3-line change.

**Filed**: May 24, 2026 — Phase 4 code-review N2.

### Clock skew >60s breaks user-bubble reconciliation (N3)

`FilmRoomChat.jsx:180` reconciliation predicate requires text match AND `|server_ts - client_ts| < 60_000ms`. A client with significant NTP drift (mobile waking from long sleep, laptop with stale clock) never matches → optimistic bubble persists next to the server-confirmed bubble. Each subsequent send compounds.

**Trigger to fix**: widen tolerance to 10 min OR drop the timestamp check entirely (text match alone is sufficient for a 5-message-budget session). ~1-line change.

**Filed**: May 24, 2026 — Phase 4 code-review N3.

### pickDefaultDay missing the createdAt sort defense (N4)

`FilmRoomScreen.jsx:18` `pickDefaultDay` reads `reviews[reviews.length - 1]` with no sort. The pre-extraction `latestReview` memo in GameTapeView explicitly sorted dailyReviews by createdAt ascending before taking the last entry — comment called it "defensively sorted in case array is out of order." Defense was dropped in the extraction.

**Trigger to fix**: restore the sort. ~3 lines. Pick up next time `pickDefaultDay` is touched OR when any new write path to `dailyReviews[]` is introduced (e.g., admin backfill, batch path).

**Filed**: May 24, 2026 — Phase 4 code-review N4.

### GameTapeView lost the "tape coming after close" signal (N5)

Pre-Phase-4 GameTapeView's DaySummaryCard empty state was the canonical mid-day signal that a Film Room was coming. FilmRoomBanner is conditional on `dailyReviews.length >= 1` — so during a 1-day battle (or pre-close on a multi-day battle), there is NO surface anywhere telling the user a tape is coming. First-time users may never discover Film Room until they happen to browse Battle History later.

**Trigger to fix**: add a single-line `"Today's tape will be filed after the close →"` placeholder in GameTapeView or AgentBattleScreen when `dailyReviews.length === 0`. Likely belongs as part of the discoverability work for Phase 5.

**Filed**: May 24, 2026 — Phase 4 code-review N5.
