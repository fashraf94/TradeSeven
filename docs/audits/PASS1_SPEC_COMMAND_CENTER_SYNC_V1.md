# Pass 1 Spec — Command Center Sync (BaggerBomb)

**Version:** 1.0 · **Date:** August 31, 2026
**Authority chain:** `COMMAND_CENTER_BATTLE_SYNC_DESIGN_FRAMEWORK_V1_2.md` (§0 rulings govern; this spec implements Pass 1 only)
**Status:** Ready for CC after founder confirms D-15 (tab name, default "Huddle")
**Commit location:** `docs/audits/PASS1_SPEC_COMMAND_CENTER_SYNC_V1.md`
**Flag:** `COMMAND_CENTER_SYNC_ENABLED` — dark, default `false`, pin assertion + `DARK_BY_DESIGN` registry entry in the same commit that introduces it (flagPinGuard discipline). Flip is a separate deliberate PR, never this one.

---

## 1. Objective

When a BaggerBomb battle is live, the Dashboard stops being a scoreboard-with-a-link and becomes the place the user reads the agent's situation: what phase the game is in, what the book looks like, which names are near scoring thresholds, when the agent next checks. **Read-only. No conversation on the Dashboard in this pass.** Talk It Over, the ledger, seeded cards, and the research slice are Pass 2 and appear nowhere in this build.

Pass 1 stands alone: if Pass 2 slips, this still delivers the "one product" feeling.

## 2. What this pass is NOT

- No chat surface, chat entry point, or chat affordance on the Dashboard
- No writes to `agentBattles`, `agents`, `voiceLayerCache`, or any battle state — this pass **reads only**
- No model calls of any kind
- No new cron jobs
- No opponent data anywhere on the Dashboard (framework ruling: own portfolio only)
- No changes to the Battle View screen except the Phase E rename
- No 3-day duration work (D-14 is not this arc)

## 3. Prerequisites — confirm before Phase A, build in order

| # | What | Status |
|---|---|---|
| P-4 | `firestore.rules` `voiceLayerCache` read → owner-scoped (`resource.data.ownerId == request.auth.uid` pattern per `agentBattles:430-431`; **Phase 0 confirms the doc carries `ownerId` — if it does not, the cron adds it, and the rule lands after a backfill**) | This branch, Phase A0 |
| P-5 | `BREAKTHROUGH_MAP` (`LiveActivityPanel.jsx:42-48`): remove the four types with no live writer (`risk_alert`, `threshold_event`, `lock`, `hypothesis_resolved`); keep `gameplan_meeting`. Leave a one-line comment naming the removed types and why, so re-wiring them later is deliberate | This branch, Phase A0 |
| P-6 | Debrief liveness: (a) POST_CLOSE card has a `debrief_pending` state; (b) `agent-batch-review.js` selection includes battles completed since the previous run (Phase 0 item 3 decides the exact predicate — `pendingReflection` if it is the intended hook, else `completedAt` window). **The cron change is part of this pass, not beside it** | This branch, Phase C/D |
| D-15 | In-battle tab name — default **"Huddle"** | Founder confirms before Phase E |

P-2 (`voiceLayerPrompt.js:41` drop `"permanent"`) is **not** this branch — it is its own one-line PR and should already be merged; if it is not, flag to founder and continue.

## 4. Phase 0 — build-scoped discovery (read-only, report, hard STOP)

Answer with `file:line`; NOT FOUND is a first-class answer. `git fetch origin` first; confirm HEAD == origin/main; report branch + SHA.

1. **D-16:** what mode does `chat.js:125` select when `status==='active'` and market is closed? Report the exact predicate. (Pass 1 renders no chat, but the LIVE_CLOSED action row copy in §7 depends on the answer; report only.)
2. **`voiceLayerCache/{battleId}` doc shape at HEAD:** confirm `portfolioBriefs[].thresholdProximity = { currentMultiplier, baseATR, redZone:{targetThreshold, targetMultiple, direction, zoneProgressPercent}, swapLock }` and whether the doc carries `ownerId` (gates P-4 shape).
3. **`pendingReflection`:** who writes it (expected `completeBattle`), who reads it (expected: nobody). Gates the P-6 predicate.
4. **The 120 s poll** (`App.jsx:~3913`): confirm fields carried per battle and where `activeAgentBattles` is passed down. The adapter consumes this prop; confirm nothing else must change to hand it to the Dashboard desktop component.
5. **`getMarketState()`** (`marketSchedule.js:180-213`): confirm the exact state strings returned, and `getNextMarketOpen()` / next-close availability for the clock.
6. **Rename blast radius spot-check:** re-run the Q11 grep on the current HEAD; list the battle-tab-side occurrences (expected: `AgentBattleScreen.jsx:77-78` tab key `'command'` + label; anything new since `fa6dfed7`). Confirm `PvpCommandCenter.jsx` still has no render site.

**STOP.** Report findings. Founder + Fable resolve any surprises before Phase A. If everything matches this spec's expectations, the STOP is a formality — say so and wait.

## 5. Architecture constraints (CC DO-NOT list)

1. **DO NOT** read `agentBattles`, `voiceLayerCache`, or `agents` document fields directly from any new Dashboard component. All battle state flows through the adapter (§6). This is the §3 shell rule and it is the point of the pass.
2. **DO NOT** touch fenced files (`docs/BUILD_RULES.md:14-24`). Nothing in this spec requires it; if a phase appears to, STOP for a fence ruling.
3. **DO NOT** add `onSnapshot` subscriptions. One added read: the `voiceLayerCache/{battleId}` `getDoc`, piggybacked on the existing 120 s poll cycle. The underlying data refreshes every ~15 min; a 120 s poll is already more live than the source.
4. **DO NOT** modify `AgentChat.jsx`, `useArenaEngine.js`, `chat.js`, or anything conversational.
5. **DO NOT** render any opponent-derived value.
6. **DO NOT** create a new branch per phase. One task, one branch, all phases.
7. **DO NOT** pipe test output through `tail`. Full suite; assert exit code; read the `Test Files` line.
8. Follow `marketclash-components` skill for tokens/visual language; Snake Draft surfaces are the gold standard. Claude Design owns final layout polish later — build clean, tokened, unclever.

## 6. Phase A — the BaggerBomb adapter (v1)

**New module:** `src/adapters/baggerbombAdapter.js` (+ colocated test). Pure derivation: takes `(battle, voiceLayerCacheDoc, agent, now)` → returns the adapter object. No fetching inside the adapter; the App-level poll fetches, the adapter derives. **Schema is provisional (framework §3.2)** — every consumer treats fields it does not need as optional.

```
{
  game:        { id, type: 'baggerbomb', label },
  phase:       'PRE_OPEN' | 'LIVE' | 'LIVE_CLOSED' | 'POST_CLOSE',
  score:       { current, tradeCount },
  book:        [ { symbol, tier, entry, pnlPct, heldSince } ],
  scoreProximity: [ { symbol, currentMultiplier, targetMultiple, direction,
                      zoneProgressPercent } ],   // top 3 by |target − current|, from thresholdProximity
  swapLock:    [ { symbol, distancePercent } ],   // locked positions only
  lastCheckedAt, nextDecisionAt,                  // §8 clock rules
  statusFeedLatest,                               // most recent entry, verbatim
  loadout:     { archetype, watchlistLabel, benchLocked }
}
```

**Phase derivation** (framework §4): `status === 'completed'` → POST_CLOSE; else by `getMarketState()`: `OPEN` → LIVE; any closed/pre state → PRE_OPEN if no eval has run yet (first `statusFeed` eval entry is the marker), else LIVE_CLOSED.

**Acceptance:** unit tests for the derivation matrix — weekday open, after-hours, weekend, holiday (`isMarketHoliday` fixture date), early-close day, completed battle, active battle created pre-market with empty statusFeed. Injectable `now` throughout (the `tournamentTime.js` idiom).

## 7. Phase B — phase-aware Dashboard slots

Wire `CommandDashboardDesktop.jsx` (and the mobile equivalent if it shares the slot structure; Phase 0 item 4 confirms) to the adapter, behind the flag. Slot behavior per framework §4:

| Slot | PRE_OPEN | LIVE | LIVE_CLOSED | POST_CLOSE |
|---|---|---|---|---|
| Primary | DRB card + "First check at 9:30 ET" | **Desk** (Phase C) | Desk, dormant | Debrief lead; `debrief_pending` until the review doc exists |
| Action row | existing Deploy/preview | "View battle →" | "View battle →" | "Game Tape →" |
| Bench | existing behavior | locked-visible (ships — verify, don't rebuild) | locked-visible | existing |
| Manage rail | clock | score · clock · trades (existing fields) | score · "resumes {next open}" | final |

Flag off → current behavior, byte-identical. Flag on with no live battle → current behavior (phase logic only engages with an active battle).

## 8. Phase C — the Agent Desk

One new component tree under `src/components/Dashboard/desk/`. Renders from the adapter prop only.

**Content, top to bottom:**
1. **Posture line** (copy fixture §9): LIVE → `Checked {h:mm} · next ~{h:mm}`; LIVE_CLOSED → `Market closed · next check {Day} 9:30 ET`; PRE_OPEN → `First check at 9:30 ET`.
   - `lastCheckedAt` = latest eval-sourced statusFeed timestamp. `nextDecisionAt` = last check + 15 min clamped to market hours, else next open. **If no eval has landed yet in LIVE, render `First check coming up` — never a fabricated time.** The `~` on "next" is required copy: the cron is not a metronome.
2. **Score proximity** — top 3 from `scoreProximity`: `{SYM} · {0.4} ATR from next {bonus|bust} tier` + the `zoneProgressPercent` as the existing progress-bar token. Direction word comes from the data's `direction`, not from sign math in the UI.
3. **Swap locks** — if any: `{SYM} locked · {1.2}% from unlock`.
4. **Latest feed line** — `statusFeedLatest.message` verbatim, with its timestamp. No paraphrase, no truncation beyond CSS ellipsis.
5. **Breakthrough alert** — `gameplan_meeting` only (post-P-5), reusing the `LiveActivityPanel` alert visual (it is portable; import, don't fork).

**Empty states:** no positions with `thresholdProximity` (e.g., all `baseATR<=0`) → omit the proximity block entirely; never render placeholder rows. `voiceLayerCache` doc missing/stale (>30 min old timestamp) → posture line + feed line only, plus `Proximity updating…` — never stale numbers presented as current.

## 9. Phase D — copy fixture and honesty tests

**New fixture:** `src/components/Dashboard/desk/__fixtures__/deskCopy.js` — every user-visible Desk string lives here, imported by components, asserted by tests. No inline Desk strings in JSX.

**Forbidden-terms test** (the C1 guard, framework §5): a test reads the built Desk component sources and the fixture and fails on any of: `watching`, `thinking`, `researching`, `analyzing`*, `about to`, `close to trading`, `wants to`, `looking at`, `eyeing`, `considering`. (*`analyzing` is grandfathered only in the untouched `LiveActivityPanel` idle string; the Desk introduces no new use.) Case-insensitive, word-boundary. The test file's header explains why, citing framework §5.1-5.2, so a future edit fights the reason and not just the assertion.

**Phase-matrix render test:** each phase renders its slot row; flag-off snapshot byte-identical to current.

## 10. Phase E — the rename (D-1/D-15)

Scope: the **battle-view tab identity only**. The Dashboard keeps "Command Center" everywhere.

1. `AgentBattleScreen.jsx:78` tab label `Command Center` → `Huddle` (pending founder confirmation; build behind the same flag so flag-off keeps the old label).
2. Internal tab key `'command'` (`:77`) — **leave unchanged.** It is not user-visible, not persisted, and renaming it churns state handling for zero user value. Add a comment: `// key 'command' is legacy; display name is Huddle (see PASS1 spec §10)`.
3. `PvpCommandCenter.jsx` — confirmed dead (no render site, Q11 + Phase 0 item 6): **delete it and its export**, own commit, message citing the discovery. If Phase 0 finds a render site appeared since `fa6dfed7`, STOP and report instead.
4. Doc-file occurrences: out of scope.

## 11. Process

- One branch: `claude/cc-sync-pass1`. All phases as ordered commits: A0 (P-4, P-5) → A → B → C → D → E → P-6 cron.
- Full test suite after A, after D, and before handoff; exit code asserted; `Test Files` line read and reported. Module-scope flag reads: if `COMMAND_CENTER_SYNC_ENABLED` is read at module scope anywhere, run the full suite immediately after introducing it (hermetic-mock hazard).
- CC does not open a PR, watch CI, or merge. Report back with: branch, commits, test summary, screenshots of each phase state (use the injectable-`now` fixtures to force LIVE_CLOSED/holiday states), and any deviations.
- Founder smoke test on Vercel preview → Flash merges → flag flip is a later separate PR with pin-assertion + registry edits in that flip commit.

## 12. Acceptance — the whole pass

- Flag off: zero visible or behavioral change, snapshot-proven.
- Flag on, no battle: zero visible change.
- Flag on, live battle: Desk renders honest posture/proximity/lock/feed; slots track phase across all four states including holiday and early-close fixtures; bench stays visible-locked; no new Firestore listeners; no opponent data; forbidden-terms test green; `voiceLayerCache` unreadable by a non-owner account (P-4 verified in rules emulator test).
- POST_CLOSE with no review doc: `debrief_pending` renders, and the P-6 cron predicate demonstrably selects a battle completed after the previous run (test with fixture timestamps).

---

*Framework V1.2 governs anything this spec is silent on. Where they conflict, the framework wins and the conflict gets reported, not resolved unilaterally.*
