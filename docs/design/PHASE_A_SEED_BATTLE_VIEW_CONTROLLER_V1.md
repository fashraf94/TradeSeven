# Phase A seed — the Battle View controller, first shipping phase (V1)

**Date:** September 2, 2026
**For:** CC. **One task, one branch, all phases.** Phase 0 is read-only with a hard STOP; the build starts only after the founder reads the Phase 0 report, in a fresh session on the same branch (BUILD_RULES session-boundary rule).
**From:** Flash, with Fable (arc authority).
**Branch:** `feat/battle-view-controller-phase-a`, cut fresh from `main` after the two preflight merges (`5521cf79`, `f8ecfb72`) and the D-58 docs commit.
**Flag:** `BATTLE_VIEW_CONTROLLER_ENABLED` — default `false`, `DARK_BY_DESIGN` entry, pin test, all in the first commit. **The flip is its own PR, later.** This flag is independent of `COMMAND_CENTER_SYNC_ENABLED` (the dashboard Desk); neither reads the other.
**Attach to the session:** `docs/audits/COMMAND_CENTER_ARC_FOUNDATION.md` · `docs/audits/COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` (ledger to D-58) · `docs/audits/PHASE0_CONTROLLER_COCKPIT_ASSIGNMENTS_DISCOVERY_V2.md` · `docs/design/COMMAND_CENTER_CONTROLLER_DESIGN_BRIEF_V1_2.md` · `docs/BUILD_RULES.md` · `The_Controller_-_Command_Center__standalone_.html` (Claude Design mock — **visual reference only**; its strings are requests and three of its states are superseded below)

---

## 0. What Phase A is, in game terms

The player opens a live battle and sees the game as a controller: the score header carries the **turn line** (checked · next), every matchup row opens **Why?** — the agent's own words from the last decision — and the chat shows truthful **receipts** for the one instruction the player has filed. On desktop the board and the conversation sit side by side; on a phone the conversation is a sheet under the board. **No new server writes, no new model calls, no Direct control.** The existing chat stays the directive path exactly as today.

Phase A does **not** build: the Heard stamp (Phase B, D-52), a Direct control (D-45 — ships live with the stamp or not at all), Show it (Phase C), the cockpit (Phase D), assignments (D-55), the lever arc, the Command Center dashboard.

---

## 1. Phase 0 — in-session, read-only, `file:line`, then STOP

Re-verify at the new HEAD and report before writing anything. Every item is a FOUND / NOT FOUND / CONSTRAINED with a citation.

1. **`useAgentBattle`** (`AgentBattleScreen.jsx:444`): does it subscribe (`onSnapshot`) or poll? Does the doc it returns carry `scoreState.lastScoredAt`, `evaluations[]`, `trades[]`, `chatExchanges[]`, `directive`, `statusFeed[]`, `portfolio`, `watchlist.hotBench`? If any are absent from the returned shape, say which.
2. **`baggerbombAdapter.js`** (Pass 1): the fields `phase`, `lastCheckedAt`, `nextDecisionAt` and how they are derived. Can the Battle View call the same adapter on the same doc so the turn line and the Desk share one source (§9)? If the adapter assumes dashboard-route inputs, say what.
3. **The Matchups row component:** file, props, and the exact lines where `% to Bust` / `% to Bagger` are computed (client math from prices + `baseATR`, per discovery Q7b). Can the computed values be lifted so the Why? panel receives them as props rather than recomputing (hazard 15)?
4. **`AgentChat.jsx`** receipt lines `:117` (`DIRECTIVE LOCKED IN`) and `:925` (`↳ from directive`): the data each reads, and where a per-exchange `Replaced` / `Expired` state would render.
5. **`agentBattleTabs.js`** and `AgentBattleScreen.jsx:449-451` (the unread-dot clear during render, gated on `activeTab === 'command'`): where a controller layout would rehome it. **Also the mobile "Live Activity" sub-tab** structure.
6. **The strings fixture** and the copy-guard test: file paths, how Desk/board strings are registered, and whether Battle View strings are already under the guard. Phase A's strings (§4) go into that fixture.
7. **Flag pattern:** `featureFlags.js` shape for a new flag, the `DARK_BY_DESIGN` registry, and the pin test pattern (`flagPinGuard`) — cite the Pass 1 flag as the template.
8. **Smoke pattern:** how the founder previews a dark feature (the Pass 1 `cc-sync-flip` pattern, a local override, or a preview env). State the pattern you will provide.
9. **`evaluations[]` at HEAD:** confirm `downgraded`, `validationErrors`, `timestamp`, `decision`, `symbolOut`, `symbolIn`, `rationale`, `evalId` on the entry (discovery Q1a, `agent-evaluate.js:2628-2668`), and that the client receives the array (150-cap). Confirm `battle.directive` shape `{ text, expiry, directiveThreadId, … }` and the exchange record's `directive` + `timestamp` (`chat.js:571-618`).
10. **Fence and ratchet:** confirm Phase A touches only `src/` + the strings fixture + `featureFlags.js` + tests. Any `api/` contact is a STOP.

**STOP.** Report, then end the session. The build session starts after the founder reads it.

---

## 2. Build phases — each its own commit, in order

### A1 — The turn line (score header)
- Under the flag, the score header gains one line beneath the tug-of-war bar.
- **Sources:** `checked` = `scoreState.lastScoredAt` (the tick ran); `decided` = an `evaluations[]` entry whose `timestamp` matches the latest tick (a decision was made). `next` = the next cron slot after `lastScoredAt` on the `*/15 13-21 UTC Mon–Fri` cadence, rendered in ET with a tilde. Prefer the adapter's `nextDecisionAt` if Phase 0 item 2 says it derives the same thing.
- **States and copy** (§4): live → `Checked 12:47 PM · next ~1:02 PM`; late (now > next + 5 min grace, no new `lastScoredAt`) → `Last check 12:47 PM · next was due ~1:02 PM`; pre-open → `First check at 9:30 AM ET`; closed → `Market closed · last check 3:45 PM`; complete → `Battle complete`. Phase from the adapter (Pass 1 four-phase model), never re-derived here.
- **The landing:** when `lastScoredAt` changes, one ≤700 ms sequence — rows update top to bottom, the turn line ticks. Fires on the snapshot change only, never on a timer. `prefers-reduced-motion` → no sequence, values update in place. No countdown that ticks per second; a static `next ~` is the whole clock.

### A2 — Why? on a row, and on the score header
- Tap a Matchups row (the **player's side only** — never the CPU side) → the row expands in place. Tap the score header → the same panel for the book.
- **Content order (row):**
  1. **This piece today:** the symbol's trades from `trades[]` with the engine text (`exitReason` / the swap receipt's reason), each timestamped. None → omitted.
  2. **At the last decision** (`evaluations[]` latest entry): header `At the 12:47 PM check`, then the state:
     - `downgraded === true` → label **Argued for a swap · held by a guardrail**; render `rationale` beneath; footer `The agent's own words · the system held it`.
     - `decision === 'HOLD'` → label **Held**; `rationale`.
     - `decision === 'SWAP'` → label **Swapped · OUT → IN** from `symbolOut` / `symbolIn`; `rationale`.
     - If the tapped symbol appears in `rationale`, emphasize those occurrences (bold). The text is the tick's reasoning, not per-position; the header says *at the check*, never *about SLB*.
  3. **Facts:** distance to next tier — **the exact values the row renders, passed as props** (hazard 15); the row's lock tag as it already displays (descriptive only, hazard 6); held since / entry price if the row or `trades[]` already carry them. Nothing derived twice.
  4. **Absence** (no `evaluations[]` entry for the latest tick, or none today): label **No decision recorded at this check** with the facts. This is a truthful state.
- **One door:** `Ask a follow-up · 1 message` → focuses the existing composer with `About SLB — ` prefilled (a string request; the user edits and sends through the shipped path). **No Direct door in Phase A** (D-45, D-53).
- **Book-level panel** (score header): order 2 → *This turn* (A3) → the door. No facts block.
- Free: pure read; no fetch, no model call.

### A3 — Receipts and *This turn*
- ***This turn*** strip above the board: if `battle.directive` exists and is unexpired → `Filed 12:31 PM` + the directive text (time from the exchange that carries the same `directiveThreadId`). **No "for the ~1:02 check" claim** — timestamps do not prove the model will see it (hazard 3); the turn line already shows `next ~`. Empty → `Nothing queued · next check ~1:02 PM`. Expired → the strip empties.
- **Receipts in the chat** (extend the existing surface, do not add a ledger component — discovery Q13): `Filed` (already `DIRECTIVE LOCKED IN`), `Acted` (already `↳ from directive` on a trade whose `directiveThreadId` echoes), plus:
  - **Replaced** — on an exchange whose directive is no longer `battle.directive` because a later exchange filed a different `directiveThreadId`: `Replaced 12:58 PM`. Copy never says *never seen*.
  - **Expired** — on the exchange whose directive's `expiry` has passed with no later directive: `Expired`.
- Vocabulary is D-51: `Filed · Acted · Replaced · Expired`. No `Heard`, `Holding`, `Declined`, `Honored`, `Superseded`.

### A4 — The layout
- Under the flag, the three tabs are replaced: **desktop** = board (left, ~60%) + the existing `AgentChat` (right, ~40%) with the composer at its bottom; the `LiveActivityPanel` is not rendered (its status line is A1's turn line; its alerts already interleave in the chat; the full feed stays reachable). **Mobile** = header, *This turn*, the board as the page, `AgentChat` as a **non-modal sheet** with three detents (peek: turn line + composer; half; full), `role="region"`, an expand/collapse control that is keyboard-reachable, focus moved into the sheet on expand and back to the row on collapse, scroll owned by the sheet at half/full.
- **Rehome the unread-dot clear** (hazard 14): clear it when the chat sheet is at half/full on mobile, or whenever the chat column is mounted and visible on desktop — in an effect, not during render.
- **Game Tape** becomes an item in the header's `···` menu, rendering the existing Game Tape view as a full-screen view. Nothing in Game Tape changes.
- Flag off → the shipped tabbed screen, byte-identical (test-enforced: snapshot the tabbed render with the flag off).
- `AgentChat`'s `ensure-opener` POST on mount is unchanged; do not mount it twice.

**Founder smoke after A3, before A4.** Commit A3, provide the smoke pattern from Phase 0 item 8, and STOP for the smoke. A4 starts after the founder's go.

---

## 3. Tests — must import what they guard
- `deriveTurnLine(battleDoc, now)` → the five states, the late state at exactly grace, the ET/UTC slot math across a DST boundary.
- `selectWhyState(evaluation, symbol)` → `downgraded` beats `decision`; HOLD; SWAP; absence when the entry's `timestamp` is older than `lastScoredAt`.
- `deriveReceipts(chatExchanges, directive, now)` → Filed, Replaced (later different threadId), Expired, and an exchange with no directive gets nothing.
- Unread-dot clear fires from the effect, not from render, under both layouts.
- Flag off → tabbed screen snapshot unchanged; flag on → no `LiveActivityPanel` in the tree; the pin test.
- Copy-guard test passes with the new strings in the fixture.
- Mutation checks as in the preflight: removing the `downgraded` branch fails exactly the downgraded row.

---

## 4. Strings — all into the fixture, all requests
`Checked {t} · next ~{t}` · `Last check {t} · next was due ~{t}` · `First check at 9:30 AM ET` · `Market closed · last check {t}` · `Battle complete` · `At the {t} check` · `Argued for a swap · held by a guardrail` · `The agent's own words · the system held it` · `Held` · `Swapped · {out} → {in}` · `No decision recorded at this check` · `Ask a follow-up · 1 message` · `About {sym} — ` · `Filed {t}` · `Nothing queued · next check ~{t}` · `Replaced {t}` · `Expired` · `Game Tape` · `Why?`
Copy guard: none of *watching, thinking, researching, analyzing, about to, close to trading, wants to, looking at, eyeing, considering* appear above. Keep it that way in any string you add.

---

## 5. DO-NOTs — the Phase 0 V2 hazards, restated for this build
1. DO NOT read `battle.controlEpochLog` for anything; it is per mode-epoch, not per tick.
2. DO NOT render `rationale` under *Held* without branching on `downgraded` first.
3. DO NOT infer that the model saw a directive from timestamps; `Replaced` shows text and time only.
4. DO NOT treat `lastScoredAt` as "a decision was made"; key *decided* to an `evaluations[]` entry.
5. DO NOT attribute an approved proposal vs an expired auto-execute from `trades[]`; the chat's existing statusFeed message is the only distinguishing text, and Phase A adds no attribution copy.
6. DO NOT tell the player a lock blocks the agent; the lock tag stays exactly as the row already renders it.
7. DO NOT promise a swap will be possible at any check.
8. DO NOT add any door that points Show it or the composer at a bench name as if research exists for it.
9. DO NOT add a top-level battle-doc key — Phase A writes nothing to the battle doc at all.
10. DO NOT import any archetype table directly; Phase A needs none.
11. DO NOT add a cron; Phase A needs none.
12. DO NOT render `source` / `triggeredBy` anywhere new (the leak is fixed; keep it fixed).
13. DO NOT read `thresholdHistory` for proximity; use the row's computed values as props.
14. DO NOT remove the tab bar without rehoming the unread-dot clear into an effect.
15. DO NOT compute `% to Bust / Bagger` a second time beside a rendered number.
16. DO NOT touch `isSwapLocked` in either copy.
Plus the standing locks: no motion between checks except the landing; no live-ticking clock; C1 (only persisted decision-path text); C2 (nothing the UI computes goes to the composer except the user's own typed text and the prefill they can edit); the fence (no `api/` contact in Phase A); flag + pin + `DARK_BY_DESIGN` in the first commit; `/code-review` before handoff (this will exceed the ≥10-files threshold); no PR, no CI watching, no merge.

---

## 6. Founder smoke script (after A3, flag on in the preview)
1. Open a live battle. The header shows `Checked · next ~`. Wait through one check: the turn line moves once; nothing moves in between.
2. Tap your SLB row: the panel opens with trades (if any), *At the … check*, the agent's words, and the same `% to` numbers the row shows. Tap the CPU side: nothing opens.
3. Find a tick where the agent argued for a swap that a guardrail held (CC will point you to one in the preview data or a fixture): the label reads *Argued for a swap · held by a guardrail*, not *Held*.
4. File a directive in the chat as today: *This turn* shows `Filed {t}` and the text, with no promise about the next check. File a second: the first exchange reads `Replaced {t}`.
5. Turn the flag off: the tabbed screen is exactly what ships today.

---

## 7. Deliverables
- Phase 0 report (this session, STOP).
- Commits A1 → A4 on the one branch, each buildable, dark.
- The smoke pattern and one preview battle to smoke against.
- `/code-review` output before handoff.
- A one-page handover: files touched, strings added, tests added, anything CONSTRAINED found during the build (restated for the ledger), and what Phase B needs from this branch.

*Phase A writes nothing server-side and asks the model nothing. It makes the game visible. The swing that hits comes in Phase B, on the stamp D-52 ruled.*
