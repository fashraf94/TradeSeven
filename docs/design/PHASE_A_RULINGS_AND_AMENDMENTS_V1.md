# Phase A — rulings and amendments after Phase 0 (V1)

**Date:** September 2, 2026
**For:** CC — attach to the Phase A build session together with `PHASE_A_SEED_BATTLE_VIEW_CONTROLLER_V1.md`. **Where this document and the seed disagree, this document wins.**
**From:** Flash, with Fable (arc authority).
**Source:** `20260902_BATTLE_VIEW_CONTROLLER_PHASE_A_PHASE0_REPORT.md` (`aca8bf7`, committed on the branch as `af76a4f`).

---

## 1. Process — before the build session opens

1. **The D-58 docs commit lands on `main` first.** Foundation, framework with the D-42 → D-58 addendum, the three briefs under `docs/design/`, both Phase 0 reports under `docs/audits/`, BUILD_RULES §6 → 39/40. CC then fast-forwards the branch. The build must not start with the ledger it implements still absent from the repo.
2. **Branch:** `claude/battle-view-controller-phase-a-i51j5l` is the branch. The seed's `feat/…` name is retired; the harness name is recorded here so no one looks for the other.
3. **Commit order:** confirmed — the Phase 0 report stays as the docs-only first commit (`8e151ff` precedent); flag + pin + `DARK_BY_DESIGN` entry are the first lines of A1.
4. **Smoke:** Pattern B, `isBattleViewControllerOn()` = flag OR `?battleViewController=1`, read at render time. The flip PR removes the override (flip, pin, override travel together). The founder smokes on the branch's own preview against a real live battle.
5. **Adversarial review** at handoff per BUILD_RULES §2 (Phase A exceeds 10 files): written `docs/audits/` record, `vite build`, reviewer isolation.

## 2. The eight decisions — ruled

| # | Decision | Ruling | Why |
|---|---|---|---|
| 1 | `next` definition | **Adapter** (`lastScoredAt + 15 min`). Add the exported, tested `deriveDueAt(lastCheckedAt, marketState)` beside `deriveNextDecisionAt` and have the latter consume it; adapter output unchanged, Desk goldens stand. | One source (§9). The Desk already ships it and the tilde absorbs write latency. The cron grid would be a second derivation of the same number. |
| 2 | Closed-state string | **One string, both facts, both surfaces:** `Market closed · last check {t} · next {day} {t}`. Update `DESK_COPY.postureClosed`, the Desk golden, and the guard's tilde tests in the same commit. | Handover lock #5: the as-of stamp stays visible in closed phases; the Desk's string had the resume time but not the as-of. Two surfaces, one sentence. |
| 3 | Row source under the flag | **The live doc.** Under the flag, the player's rows enrich from `agentBattle.portfolio` and `agentBattle.portfolio.startingPrices`; the opponent's rows from the live doc's CPU portfolio if the field exists (CC confirms the field name in A1), else the prop. Flag-off untouched. | The turn line, Why?, and the rows must read one doc, or the landing lies after a swap. The flag-off freeze is bug 1, fixed separately. |
| 4 | `ExecutionCard` under the flag | **Yes.** Replace `Executing on next evaluation window` and the infinite pulse with the receipt line: current → `Filed {t}`; superseded → `Replaced {t}`; expired → `Expired`. Flag-off unchanged in Phase A. | Receipts cannot sit beside a promise. The flag-off copy is bug 2, fixed right after Phase A merges (§6). |
| 5 | Breakthrough alerts + "Agent Reasoning" | **Drop for Phase A**, note in the handover. No `···` menu: a single `Game Tape` header link, opening the existing view full-screen. `FilmRoomBanner` keeps its slot between the header and the board. | Both stay on the Desk and flag-off. The alerts' home in the controller is the tape as entries (a later phase, after P-5); the scratchpads are the same content class Why? now surfaces from `evaluations[]`. A menu with one item is a menu for its own sake. |
| 6 | `Expired` scope | **Battle-complete only in Phase A.** The client port of the `3_games` day math becomes a **D-14 prerequisite** (3-day battles), not Phase A work. | Under fullday (`tradingDays === 1`) a `3_games` directive cannot expire mid-battle — created day 1, active through day 3 — so complete-only is fully truthful today and avoids a second implementation of server logic until it is needed. |
| 7 | Commit order | Confirmed (§1.3). | — |
| 8 | Smoke pattern | **B** (§1.4). | No flip commit for a smoke; the override is deleted at the flip. |

## 3. Additional build directives from the constraints

1. **The "decided" join is `>=`.** `decided = toMillis(latest.timestamp) >= toMillis(scoreState.lastScoredAt)`. The seed's "matches the latest tick" reads as this rule; the absence test is exactly "entry older than `lastScoredAt`."
2. **Proximity lift.** Extract one pure `computeProximity({ priceChange, baseATR, history, dailyLevels, currentPrice }) → { text, label, distance, direction, achievement }` from `ProximityLabel.jsx:176-242`, call it once in `AssetSide`, pass the result to `ProximityLabel` (new optional prop; the component keeps its own path when the prop is absent, so the user-side BaggerBomb views are untouched) and to the Why? panel. **Test:** the extracted function's `text` equals the current `formatText` over a fixture matrix covering both the dollar and the ATR branches. Never a third derivation beside `TacticalRow.jsx:116` and `ProximityLabel.jsx:176`.
3. **Facts block:** no lock line, none computed. Entry and held-since from the row's enriched asset (`openPrice`, `swapPrice` / `swappedInAt`), never from the adapter's `book`.
4. **Strings.** The turn line consumes `postureLive`, `posturePreOpen`, `postureComplete` from `DESK_COPY` verbatim; the late string and the two-fact closed string are added there. Battle-View-only strings (Why?, receipts, doors, `Game Tape`, *This turn*) go in a new guarded module `src/screens/battleView/battleViewCopy.js`; that module **and every new `src/screens/battleView/*` component** are appended to `deskHonesty.test.js` `GUARDED` in the same commit. The chat's `ExecutionCard` receipt strings are imported from that module, not written inline.
5. **Filed time** comes from the exchange `timestamp` (the same source `Replaced` keys off), never from `battle.directive.createdAt`.
6. **Receipts derivation:** `deriveReceipts(chatExchanges, directive, battleStatus) → { [directiveThreadId]: { state: 'filed' | 'replaced' | 'expired', at } }`, pure, computed in the screen, passed `AgentChat → MessageBubble → ExecutionCard`. `AgentChat` gains the props; nothing in it reads `battle.directive` directly.
7. **Byte-identity of flag-off:** a golden HTML of the tabbed `renderToString` captured at the pre-build commit (`ManageStation.sync.render.test.jsx` precedent), not a snapshot. Also: flag on → no `LiveActivityPanel` in the tree.
8. **The turn line calls the adapter** with `voiceLayerCacheDoc = null` and `agent = null` — no cache read, no rules contact. `marketState` from `getMarketState()`; a coarse `now` refresh (once a minute or on `visibilitychange`), no per-second countdown.
9. **Unread dot:** rehomed into an effect keyed on `[statusFeed.length, chatVisible]`; on desktop under the flag the chat is always visible (no dot); on mobile the dot lives on the sheet's peek handle. Flag-off keeps `:449-451` byte-for-byte.
10. **One `AgentChat` per layout** — desktop column *or* mobile sheet, never both mounted; `ensure-opener` is unaffected either way.
11. **Tokens and motion:** new colours via `cssVar()` only; the landing and the sheet consume `motion.js` tokens through `motionToken(name, { reducedMotion })`; `useReducedMotion` is the house pattern.
12. **Why? tap surface:** a new handler on the left `AssetSide` only; the existing symbol tap (research modal) and points tap (breakdown) keep stopping propagation; the expansion renders beneath the row inside the tier map.

## 4. Amendments to the seed, by phase

- **A1:** flag + accessor + pin + `DARK_BY_DESIGN` first; `deriveDueAt` in the adapter; the turn line from the adapter + `DESK_COPY`; the two new posture strings; the "decided" indicator on `>=`; rows read the live doc under the flag (ruling 3); the landing on `lastScoredAt` change only.
- **A2:** the proximity lift first (with its equality test), then the Why? panel consuming the lifted values; three states plus absence, `downgraded` branch first; one door; no lock line.
- **A3:** `deriveReceipts`; `ExecutionCard` receipt line under the flag (ruling 4); *This turn* strip from `battle.directive` + the matching exchange's timestamp; `Expired` = `status === 'completed'` only.
- **Founder smoke after A3** (seed §6, with two edits: step 2 shows no lock; step 4's second directive reads `Replaced {t}` on the first card *and* the first card no longer pulses or promises).
- **A4:** layout; single `Game Tape` link; `FilmRoomBanner` slot; unread-dot effect; one `AgentChat`; the golden for flag-off.

## 5. DO-NOTs

V2 hazards 1–16 stand. Phase 0's 17–23 are adopted verbatim: no promised row update while rows read the frozen prop (moot under ruling 3, binding for flag-off); no `Executing on next evaluation window` beside a receipt; no second derivation of `next`; `expiry` is an enum; the join is `>=`; never import `api/_utils/directiveUtils.js` from the client; no third proximity derivation.

## 6. Bugs outside the task — triage

| # | Bug | Disposition |
|---|---|---|
| 1 | Matchups rows freeze at open (flag-off) | **Own PR right after Phase A merges** — reuse Phase A's live-doc row path for the flag-off render. Fold bug 3 (`useAgentBattle.js:13` log on every render) into it: same hook. |
| 2 | `ExecutionCard` promises execution (flag-off) | **Own PR right after Phase A merges** together with bug 5 — one task, "shipped promise copy": the `Executing…` string and pulse in `ExecutionCard` flag-off, and `Agent is active.` + pulse in `AgentStatusIndicator`. Same bug class, two files, no flag (they are copy/honesty fixes). |
| 4 | Glow vs label on day 2+ | **Backlog, tied to D-14** — cannot surface under fullday. Fix when the 3-day flip is specced. |
| — | `3_games` client port | **D-14 prerequisite** (ruling 6). |

## 7. Ledger entries (append after D-58)

| # | Ruling | Status |
|---|---|---|
| **D-59** | Under the controller flag, the board, the turn line, and Why? read the subscribed battle doc — one source. The shipped frozen-prop path is fixed separately for flag-off. | Ruled Sep 2 |
| **D-60** | `Executing on next evaluation window` is retired. `ExecutionCard` carries the receipt line (`Filed · Replaced · Expired`, D-51); no pulse between checks. Flag-off copy fixed in its own PR. | Ruled Sep 2 |
| **D-61** | `Expired` = battle complete under fullday. The `3_games` day-count port is a D-14 prerequisite. | Ruled Sep 2 |
| **D-62** | One closed-phase string on both surfaces, carrying the as-of and the resume time. `next` is the adapter's `lastScoredAt + 15 min` everywhere. | Ruled Sep 2 |

## 8. Go

Once the D-58 docs commit is on `main` and the branch is fast-forwarded: open a fresh session on the branch with the seed and this document attached, build A1 → A3, commit each, provide the preview URL and one live battle to smoke, and STOP for the founder's smoke before A4.
