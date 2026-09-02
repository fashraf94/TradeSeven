# Battle View controller — Phase A (A1 → A3) handover

> **Superseded (Sep 2, A4):** the Phase A handover through A4 is `20260902_BATTLE_VIEW_CONTROLLER_PHASE_A_HANDOVER.md`. This file stays as the record of the A1 → A3 session; its §5 items 1–18 are carried there unchanged.

**Date:** September 2, 2026
**For:** the founder (smoke after A3) and the A4 / Phase B sessions.
**Prepared by:** Claude Code, under `docs/BUILD_RULES.md`.
**Branch:** `claude/battle-view-controller-phase-a-v5gog5` — the harness assigned this name to the build session. The seed and `docs/design/PHASE_A_RULINGS_AND_AMENDMENTS_V1.md` §1.2 name `claude/battle-view-controller-phase-a-i51j5l`, the Phase 0 session's branch; same task, new session, new harness name. The Phase 0 report is on `main` (merged in #807), so nothing on the older branch is lost.
**Base:** `eaf2a0e2` (`main`, the D-58 docs merge). **Commits:** `540fdc9` A1 · `c570d61` A2 · `d817f16` A3 · `a41b311` review fixes. **Cumulative diff:** 43 files, ~+3.8k / −0.3k.
**Flag:** `BATTLE_VIEW_CONTROLLER_ENABLED = false` (pin `battleViewControllerFlags.test.js`, `DARK_BY_DESIGN` entry); smoke override `?battleViewController=1`, deleted by the flip PR.
**Review:** `docs/audits/20260902_BATTLE_VIEW_CONTROLLER_PHASE_A_BUILD_REVIEW.md` (BUILD_RULES §2 — five isolated lenses + `/code-review`, every finding refuted or confirmed by a second agent: 32 CONFIRMED / 2 REFUTED, `vite build` green).
**STOP:** this session ends after A3 + review, for the founder's smoke. A4 (the layout) starts in a fresh session after the go.

---

## 1. Founder smoke (seed §6, with the rulings' two edits)

Open the branch's **Vercel preview** — the deployment Vercel builds for `claude/battle-view-controller-phase-a-v5gog5`; its URL is on the Vercel dashboard under that branch's deployments (this environment has no Vercel or Firestore access, so I cannot print it). Open a **live BaggerBomb battle** from the dashboard and append `?battleViewController=1` to the URL (the app has no router; the query string survives in-app navigation).

1. **The header** shows `Checked 12:47 PM · next ~1:02 PM` beneath the tug-of-war bar. Wait through one check: the rows wash top to bottom and the line ticks once (≤700 ms); nothing moves in between. Off-hours: `Market closed · last check 3:45 PM · next Tue 9:30 AM ET`; pre-open: `First check at 9:30 AM ET`; after 5 min past a due check with no new stamp: `Last check 12:47 PM · next was due ~1:02 PM`.
2. **Tap your SLB row** (the left side — a small `Why?` sits under the gauge): the panel opens beneath the row with `This piece today` (if it traded), `At the 12:47 PM check` + the state, the agent's own words with `SLB` emphasised, and the facts line — the **same** `% to` number the row shows, `Entry $…`, `Held since …` — **and no lock line.** Tap the CPU side: nothing opens. Tap the score header: the book panel (decision → This turn → the door).
3. **A tick the guardrail held:** the label reads `Argued for a swap · held by a guardrail` with `The agent's own words · the system held it` beneath the rationale — never `Held`. I could not locate such a tick in a live battle from this environment (§5 item 14); the guaranteed fallback is the fixture-driven render in `WhyPanel.render.test.jsx` and `AgentBattleScreen.controller.jsdom.test.jsx`.
4. **File a directive** in the chat as today: **This turn** (above the board) shows `Filed {t}` + the text, with no promise about the next check; the card in the chat no longer pulses or says `Executing…` — it reads `Filed {t}`. File a second: the first card reads `Replaced {t}` and This turn carries the new one.
5. **Remove the query string:** the tabbed screen is exactly what ships today.

**Expect until A4 (not bugs):** the three tabs remain; the chat's `Live Activity` panel (with its `Agent is active.` pulse — Phase 0 bug 5) still mounts under the flag on the chat tab; This turn shows both above the board and inside the open book panel; the Why? door switches to the chat tab to focus the composer.

## 2. Files touched (43)

| Area | Files |
|---|---|
| Flag | `src/config/featureFlags.js` (+ `isBattleViewControllerOn`), `src/config/flagPinGuard.test.js` (`DARK_BY_DESIGN`), `src/config/battleViewControllerFlags.test.js` (pin), `src/config/battleViewControllerAccessor.test.jsx` (override) |
| Adapter | `src/adapters/baggerbombAdapter.js` (`deriveDueAt`, `toMillis` exported; `deriveNextDecisionAt` consumes `deriveDueAt`), `src/adapters/baggerbombAdapter.test.js` |
| Desk (D-62) | `src/components/Dashboard/desk/deskCopy.js` (`postureLate`; `postureClosed(nextOpenEt, lastIso)`), `AgentDesk.jsx`, `AgentDesk.render.test.jsx`, `deskHonesty.test.js` (the `battleView/` directory scan + inline-copy rule + tilde/closed tests) |
| Proximity lift | `src/components/BaggerBomb/computeProximity.js` (new), `computeProximity.test.js` (new), `ProximityLabel.jsx` (optional `proximity` prop; re-exports), `TacticalRow.jsx` (one call per side; Why? tap on the left side; `renderWhy` beneath the row; `whyLabel`) |
| Chat | `src/components/Agent/AgentChat.jsx` (`composerPrefill` / `onComposerPrefillConsumed`; `receipts` → `MessageBubble` → `ExecutionCard` receipt line under the flag), `AgentChat.prefill.test.jsx`, `AgentChat.receipts.render.test.jsx` |
| Screen | `src/screens/AgentBattleScreen.jsx` (controller read at render; live-doc rows; turn line; landing; Why? state and panels; This turn; receipts; prefill), `AgentBattleScreen.restFallback.test.jsx` (accessor mocked false), `AgentBattleScreen.controller.test.jsx` (first paint, both flag states), `AgentBattleScreen.controller.jsdom.test.jsx` (mounted wiring) |
| Battle View (new dir, all guarded) | `src/screens/battleView/`: `battleViewCopy.js`, `deriveTurnLine.js`, `TurnLine.jsx`, `useCoarseNow.js`, `landing.js`, `LandingWash.jsx`, `selectWhyState.js`, `WhyPanel.jsx`, `deriveReceipts.js`, `ThisTurnStrip.jsx`, `useContentStable.js`, and their tests (`deriveTurnLine`, `landing`, `LandingWash`, `useLandingKey`, `TurnLine.render`, `selectWhyState`, `WhyPanel.render`, `deriveReceipts`, `ThisTurnStrip.render`, `useCoarseNow`, `useContentStable`) |

Nothing under `api/`. No fenced file edited. Fenced or shared functions **called**: none fenced; `buildBaggerbombAdapter` / `deriveDueAt` / `toIso` / `toMillis` (non-fenced adapter), `calculateAssetScoreV3` (unchanged call). No archetype-table importer added (`archetypeImportBoundaryBaseline.json` untouched). No Firestore read or write, no fetch, no model call added.

## 3. Strings

**Seed §4, all 19, character-exact** — in `DESK_COPY` (`Checked {t} · next ~{t}`, `Last check {t} · next was due ~{t}` new, `First check at 9:30 AM ET`, `Market closed · last check {t} · next {day} {t} ET` changed per D-62, `Battle complete`) and in `src/screens/battleView/battleViewCopy.js` (`At the {t} check`, `Argued for a swap · held by a guardrail`, `The agent's own words · the system held it`, `Held`, `Swapped · {out} → {in}`, `No decision recorded at this check`, `Ask a follow-up · 1 message`, `About {sym} — `, `Filed {t}`, `Nothing queued · next check ~{t}`, `Replaced {t}`, `Expired`, `Why?`). **`Game Tape`** is added in A4 with the header link (deferred, not dropped).

**Added beyond §4 (requests to the design chat):** `This turn` (the strip's eyebrow) · `This piece today` (the trades section) · `{t} · {out} → {in}` (a trade line) · `Entry {$price}` · `Held since {t}` · the bare fallbacks `Filed` / `Replaced` / `Nothing queued` when a time is unavailable. Pre-existing Desk strings now reaching the Battle View: `Checked {t}` (a live check whose next is past or beyond the close) and `First check coming up` (LIVE with no stamp yet). All pass the copy guard; every `src/screens/battleView/*` file is scanned by `deskHonesty.test.js`.

## 4. Tests added (all import what they guard)

`deriveTurnLine.test.js` (five states + the no-eval degrade, the late boundary at exactly the grace, the ET/UTC math across the March DST switch, the `>=` join incl. equality and Firestore-Timestamp shapes) · `baggerbombAdapter.test.js` (`deriveDueAt`: +15, past, null, close clamp, early close, DST, consumed by `nextDecisionAt`) · `landing.test.js`, `LandingWash.test.jsx`, `useLandingKey.test.jsx` (one landing per check, never on open, first check after a pre-open open, the clear, reduced motion → instant) · `useCoarseNow.test.jsx` (60 s, never per second, visibilitychange, inert flag-off) · `TurnLine.render.test.jsx` · `computeProximity.test.js` (122 rows against the verbatim pre-lift oracle, both branches; config tables pinned) · `selectWhyState.test.js` (downgraded beats decision — the mutation row — HOLD, SWAP, absence on `>=`, the engine-outage absence, emphasis without lookbehind, trades without machinery codes) · `WhyPanel.render.test.jsx` (the downgraded fixture, no lock line, one door, book order, a11y name) · `deriveReceipts.test.js` (Filed, Replaced by a later different thread, Expired on complete for the current directive only, nothing for a directive-less exchange, expiry never a time) · `ThisTurnStrip.render.test.jsx` · `AgentChat.prefill.test.jsx` (fill, focus, consume, draft-wins) · `AgentChat.receipts.render.test.jsx` (receipt line under the flag, promise gone; flag-off card unchanged) · `AgentBattleScreen.controller.test.jsx` (first paint under both flag states: turn line, D-59 both sides, label text, Why? surfaces, This turn) · `AgentBattleScreen.controller.jsdom.test.jsx` (mounted: tap → facts; one row at a time; CPU never; door → chat → prefill + receipt; header → book) · `battleViewControllerFlags.test.js` (the pin) · `battleViewControllerAccessor.test.jsx` (the override) · `useContentStable.test.jsx` · `AgentDesk.render.test.jsx` / `deskHonesty.test.js` (the D-62 string, the directory guard). Full suite: 562 files / 9456 tests green; `vite build` green.

## 5. CONSTRAINED found during the build — for the ledger

1. **Branch name.** `…-v5gog5` (this session) vs `…-i51j5l` (rulings §1.2). Record the real branch.
2. **`exitReason` is withheld.** Seed §A2 asked for "the engine text (`exitReason` / the swap receipt's reason)" on each trade line; `exitReason` is a machinery-provenance code (`haiku_decision`, `guardrail_stopLoss`, …), one value names the model tier, and it is the attribution class hazard 12 keeps off the screen. The trade line renders the receipt's `rationale` (the agent's words) only. A copy-mapped rendering, if wanted, is a design-chat request.
3. **`Argued for a swap · held by a guardrail` over-claims on one path.** `downgraded === true` is also set when `executeSwapServer` throws (`agent-evaluate.js:2463-2466`, `validationErrors: ['Swap execution failed: …']`) — no guardrail held anything. The seed mandates the string for `downgraded === true`; the footer `the system held it` is the accurate half. Copy request; `validationErrors[]` can distinguish the cases.
4. **`DIRECTIVE LOCKED IN` above `Replaced {t}` / `Expired`.** The shipped label was kept per the seed ("Filed — already DIRECTIVE LOCKED IN"); on a superseded card it contradicts the receipt. Copy request.
5. **An engine outage is the absence state.** An `evaluations[]` entry with `haikuError` stamped (model call failed / budget-skipped; rationale `Haiku call failed — defaulting to HOLD`) renders `No decision recorded at this check`, not `Held` with the cron's placeholder words (C1). A state the seed's four did not name.
6. **A sixth turn-line state**, `First check coming up` (`DESK_COPY.postureFirstCheckComing`) for LIVE with no stamp — the Desk's own honest degrade, consumed verbatim.
7. **D-62's no-last-check cell** renders `Market closed · next Tue 9:30 AM ET` (the template with the `last check` segment omitted; the shipped Desk string said `next check`). Copy note.
8. **Completion expires only the directive current at the close** (D-61 read strictly): a directive already `Replaced` keeps `Replaced {t}`, the more specific proven state.
9. **`deriveTurnLine(battle, now, marketState)`** takes the market state as a third parameter (the seed wrote `(battleDoc, now)`), injected for the same reason the adapter takes it — every phase reachable from a fixture. The screen passes `getMarketState()`.
10. **`computeProximity` is called once per side in `TacticalRow`** (the row), which hands the same object to the label and to the Why? panel; `AssetSide` keeps its own single call when used standalone. The rulings said "call it once in AssetSide" — the same single-call contract, one level up, so the panel can receive the row's exact object.
11. **The landing clears its key 1 s after it starts** (`LANDING_CLEAR_MS`) — a timer that only ENDS a landing the snapshot started, so a re-entered tab replays nothing. The seed's "never on a timer" is about firing; this is recorded so it is not mistaken for a trigger.
12. **The landing seeds on the doc's first snapshot**, not on the first stamp: a battle opened before its first check lands that first check (the completion write the player waited through).
13. **The composer prefill never erases a draft**: an empty (book) prefill only focuses; a piece prefill fills the composer only when it is empty or still holds the previous, untouched prefill.
14. **Smoke step 3 could not be pre-located.** This environment has no Firestore access, so no live `downgraded === true` tick was found; the fixture-driven render tests are the guaranteed fallback the seed allows.
15. **Until A4:** `LiveActivityPanel` still mounts under the flag (its `Agent is active.` pulse beside the turn line); This turn renders both above the board and inside the open book panel (the seed's letter for both places); the Why? door switches to the chat tab (`setActiveTab('command')`) — A4 replaces that with "reveal the chat" and, on mobile, opens the sheet before the focus.
16. **`PROPOSAL` → `Held`.** A `PROPOSAL` entry held the position at the check pending an approval the chat carries; unreachable under the autopilot launch guard; mapped to `Held` and recorded.
17. **Flag-off runtime is unchanged** — the review's L2 note that `useReducedMotion` adds a matchMedia subscription flag-off was REFUTED by the refuter (framer keeps a module singleton the shipped screen's motion elements already initialised; flag-off gains one `useState` slot). Markup is byte-identical (review lens L3: 0 differences over ~76k rendered cases outside the sanctioned D-62 Desk string).
18. **`useAgentBattle.js:13`** still logs on every render (Phase 0 bug 3, triaged for the flag-off rows PR).

## 6. What A4 needs from this branch

- **The golden:** render the tabbed screen from a checkout of `eaf2a0e2` (a `git worktree`), not from the current tree flag-off — `ProximityLabel` / `TacticalRow` / `AgentChat` changed under flag-off (output-identical by test, not "captured at the pre-build commit"). Harness: `AgentBattleScreen.restFallback.test.jsx`'s mocks with the clock pinned.
- **Unread dot:** the render-time clear at `AgentBattleScreen.jsx` (`if (activeTab === 'command') …`) is untouched; A4 rehomes it into the effect keyed on `[statusFeed.length, chatVisible]` (rulings §3.9).
- **The door:** `handleAskFollowUp` ends with `setActiveTab('command')`; A4 replaces it with revealing the chat column / opening the sheet detent before `AgentChat`'s prefill effect focuses the textarea.
- **This turn:** pick the above-the-board home; the book panel's `thisTurn` slot exists for the seed's order.
- **Slots:** the book panel renders between `ScoreHeader` and `FilmRoomBanner`; A4 decides panel-above-banner or the reverse (the banner keeps its slot between header and board).
- **`Game Tape`** string into `battleViewCopy.js` with the single header link; `LiveActivityPanel` not rendered under the flag (its alerts and "Agent Reasoning" leave for Phase A — stay on the Desk and flag-off).
- **Landing:** `rowCount` counts tier slots (7) including empty ones; keep `index` in render order.
- **a11y:** the left row button contains the (pre-existing, mouse-only) symbol/points click targets; the header button is named by its whole content — A4's pass.

## 7. What Phase B (the Heard stamp, D-52) needs

- `deriveReceipts(chatExchanges, directive, battleStatus)` → `{ [threadId]: { state: 'filed'|'replaced'|'expired', at } }` is a single-state enum. Heard must coexist with Replaced (`Heard 12:47 · Replaced 12:58`): add an optional `heardAt` (and an `evaluations` input) beside `state` rather than a new enum value — `BATTLE_VIEW_COPY.receiptLine()` returns null for unknown states, so an additive field is safe; the completion rule (only the current directive expires) preserves it.
- `selectWhyState(evaluation, symbol, lastScoredAt)` already takes the `evaluations[]` entry D-52 will stamp; `turnLine.decision` is lifted to the screen; `isDecidedAt` / `toMillis` are exported for the join. The `haikuError` absence rule should hold for Heard too (an outage tick heard nothing).
- Copy: `heard(iso)` in `battleViewCopy.js`; revise the negative assertions (`AgentChat.receipts.render.test.jsx` "no Heard…", `ThisTurnStrip.render.test.jsx` `'heard'`) and the module header in the same PR.
- `MessageBubble` keys receipts by `message.directive.directiveThreadId` — compatible.

## 8. Bugs outside the task (BUILD_RULES §3 — not fixed)

Phase 0 §6 bugs 1–5 stand (frozen flag-off rows; the shipped `Executing…` copy and pulse flag-off; the hook's per-render log; glow vs label on day 2+; `Agent is active.`). New: `ChamberFuse.jsx:227` throws on `history: null` (unreachable from this screen — `enrichAsset` always builds `history`; found by the L3 byte matrix, identical in both trees).
