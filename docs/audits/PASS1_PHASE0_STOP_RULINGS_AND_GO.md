# Pass 1 — Phase 0 STOP Rulings and GO

**Date:** August 31, 2026
**Applies to:** `PASS1_SPEC_COMMAND_CENTER_SYNC_V1.md` on branch `claude/cc-sync-pass1-5lz5sb`
**Authority:** framework V1.2 §0. Where this document and the spec differ, this document governs — it is the adjudication of the Phase 0 report (`20260831_CC_SYNC_PASS1_PHASE0_DISCOVERY.md`).
**Verdict:** GO for Phase A0, with the amendments below. Commit this file to `docs/audits/` byte-exact (md5 reported) before resuming.

---

## 0. Accepted deviations and answered items

- **Branch:** `claude/cc-sync-pass1-5lz5sb` accepted. Stay on it.
- **D-17 answered:** `ARCHETYPE_INTEGRITY_MODE = 'enforce'` (`featureFlags.js:712` → `chat.js:18`). Framework's hard Pass 2 gate is cleared; recorded here for the framework's next revision.
- **D-16 answered (premise corrected):** mode = market-closed × today's-review-landed (`chat.js:125-133`); `battle.status` is only an allow/deny gate at `:216`; PRE_MARKET stays `battle` mode. Not deterministic between close and review-write. No Pass 1 code change — the LIVE_CLOSED action row stays the neutral "View battle →" precisely because the chat mode behind that door is time-dependent.
- **C-2, C-3, C-6, C-7, blast-radius corrections:** accepted as framework errata, to be absorbed into the framework's next revision. Build against CC's verified facts, not the framework's prose, wherever this document says so.
- `npm ci`, docs-relay commit before STOP, supplementary read-only checks: all accepted.

## 1. STOP-1 ruling — P-4 proceeds as a lookup rule; no writes

The spec's §2/§3 self-contradiction is resolved in favor of §2: **this pass writes no battle state, including `voiceLayerCache`. No `ownerId` write, no backfill.**

Instead: the cache doc's ID is the battleId, and the battle doc carries `ownerId` (the 120 s poll queries on it). The rule becomes a lookup:

```
match /voiceLayerCache/{battleId} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/agentBattles/$(battleId))
         .data.ownerId == request.auth.uid;
  allow write: if false;
}
```

- Amend the positive control `test/rules/wireDenials.rules.mjs:66/108/116`: seed the matching `agentBattles/battle-1` with an `ownerId`; assert the owner CAN read (preserves the F2-4 anti-vacuous purpose) and a non-owner CANNOT (encodes the new policy). Comment the test with why, citing this ruling.
- The one existing client reader (`tournamentGroupService.js:499`) resolves as the owner and survives — CC already verified this.
- **Fallback, pre-authorized:** if the `get()` join cannot be made to work in the rules emulator, revert the rule, restore the control, and defer P-4 to the security workstream with a note in the handoff report. The leak predates this pass and the Desk only shows owners their own data; do not block the pass on it.

## 2. STOP-2 ruling — P-6 becomes the `reviewPending` queue; fence untouched

Do not touch `findActiveAgentBattles` or any fenced file. Do not add a composite index. Instead, mirror the `pendingReflection` idiom that already lives in the exact same function:

1. `completeBattle` (`agent-evaluate.js:4159` — not fenced, CC verified) additionally sets `reviewPending: true` alongside its existing completion stamps.
2. `agent-batch-review.js` adds a second, local query: `where('reviewPending','==',true)` (single-field, auto-indexed), processes those battles through its existing review path, and clears the flag in the same write that appends the review — the `pendingReflection` drain pattern at `process-pending-reflections.js:88` is the precedent.
3. The existing active-battles path is untouched; the new query is additive.
4. **Do not reuse `pendingReflection` itself** — CC established it is a live work queue with a schema-presence invariant (`agent-evaluate.js:4142/4172/4510`). New field, new name, no collision.
5. This is the first test `agent-batch-review.js` has ever had — write the fixture-timestamp test the spec's §12 demands against the new predicate, and nothing more (no retroactive coverage of the other 400 lines; ledger that gap).
6. `agent-evaluate.js` joins the allowed-edit list for this one field write only. It is not fence-listed, but treat it with fence-adjacent care: minimal diff, no drive-by changes.

**Scope note:** batch-review runs 20:25/21:25 weekdays; a battle completing after 21:25 (or on a weekend expiry sweep) waits for the next run. The `debrief_pending` card copy must therefore **not promise a time**: *"Debrief on the way."* — nothing more specific.

## 3. STOP-3 ruling — adapter gains a `marketState` parameter

Signature: `(battle, voiceLayerCacheDoc, agent, now, marketState)`. The caller (shell/poll layer) calls `getMarketState()` once per cycle and passes the result. Tests pass fixture objects for all five states plus early-close; no `vi.mock` of `marketSchedule`, no refactor of its zero-arity export.

- `nextDecisionAt`: if `src/utils/marketSchedule.js` lacks an exported next-open helper, add one — `getNextMarketOpen(now = new Date())`, exported, pure, with its own tests (this file currently has zero coverage; the helper's tests are its first). **That is the only marketSchedule edit authorized.** The 2026-expiry holiday TODO is reported, not fixed — it is on the founder ledger.
- The 2027 holiday-data expiry and the `api/`-vs-`src/` divergence are recorded as ledger items below; do not unify the copies in this pass.

## 4. STOP-4 ruling — P-5 adds the named exports

P-5's commit adds `export { BreakthroughAlerts, BreakthroughAlertCard }` (and `useBreakthroughAlerts` only if the Desk consumes it) to `LiveActivityPanel.jsx`. Default export unchanged. Phase C imports; §8.5's no-fork rule stands.

## 5. STOP-5 ruling — unknown alert types render nothing

Rewrite `:179` to `const cfg = BREAKTHROUGH_MAP[alert.key]; if (!cfg) return null;` (adapted to the component's actual shape). Do not re-point the fallback at `gameplan_meeting` — a visual invented for an unmapped type is the fabrication rule in miniature. The dead vocabulary in `AgentActivityFeed.jsx` and `agentReflectionUtils.js` is out of scope; ledgered.

## 6. STOP-6 ruling — staleness gates only the LIVE phase

The spec's 30-minute rule was aimed at the wrong condition. Corrected:

- **LIVE:** cache doc >30 min old → suppress proximity, render `Proximity updating…`. (During open market, stale numbers presented as current are the lie.)
- **LIVE_CLOSED / POST_CLOSE:** render the numbers with an explicit as-of stamp — `as of Fri 3:45 PM ET` — sourced from the doc's `dataFreshness`/`updatedAt` (normalize the Firestore-Timestamp-vs-ISO union per the `chat.js:115-119` precedent). Prices are frozen with the market; the last-computed proximity is legitimately current-as-of-close, and the timestamp carries the honesty. The dormant Desk stays full.
- **PRE_OPEN:** same as LIVE_CLOSED (yesterday's close values, stamped).
- The as-of stamp joins the copy fixture and the forbidden-terms test scope.

**Included rider (founder may strike before sending):** extend the `voice-layer-cache` cron window in `vercel.json` from `13-20` to `13-21` to match `agent-evaluate`, so the cache captures the final quarter-hour and the close. One-line schedule change to an existing entry, no new slot. If this line survives into the branch, note it in the handoff.

## 7. Phase A amendments — adapter field decisions

- `book[].pnlPct` — **omitted in adapter v1.** No live price reaches the pure adapter; the Desk does not render P&L in Pass 1. Schema is provisional (framework §3.2); the field returns in Pass 2 with a sourced design.
- `book[].heldSince` — `swappedInAt` when present, else `battle.activatedAt`; document the fallback in the adapter's JSDoc.
- `lastCheckedAt` — `scoreState.lastScoredAt` (written every cycle, already on the poll). Not statusFeed timestamps: CC proved no eval-sourced statusFeed entry exists and a quiet HOLD writes nothing.
- **PRE_OPEN marker** — `scoreState.evaluationCount` falsy/0 (or `lastScoredAt` absent), per C-3. The spec's "first statusFeed eval entry" is void.
- `benchLocked` — derived in the adapter as `Boolean(agent?.activeBattleId)` (C-6: it was never a stored field; two components derive it locally today — the adapter becomes the third derivation site and Pass 2 can consolidate).
- `swapLock` — carry the full object `{locked, direction, distancePercent, message}`; `direction` may be null there (unlike `redZone.direction`); render only `locked===true` entries.
- `thresholdProximity` absent (`baseATR<=0`, non-finite) or `redZone` null → position simply absent from `scoreProximity`; never a placeholder row (spec §8 empty-state rule stands).
- All timestamps normalized to ISO at the adapter boundary.

## 8. Phase B/D amendments — the repo as it actually is

- **Two shells.** Phase B wires both `CommandDashboardDesktop.jsx` and `CommandDashboard.jsx` (mobile). There is no shared slot scaffold; use each shell's own structure and the numbered-station vocabulary (04 Manage is the anchor). Desktop CTAs live in `ReadColumn.jsx`; mobile's action row is `CommandDashboard.jsx:383-444`. Phase D's copy test covers both shells.
- **No RTL, no snapshots.** All component tests use the repo idiom: `renderToString` + `toContain`; flag-off byte-identity via `expect(renderToString(flagOff)).toBe(renderToString(current))` per `AgentRecordSheet.render.test.jsx:74`.
- **No `__fixtures__` in `src/`.** The copy module is a plain file: `src/components/Dashboard/desk/deskCopy.js`. Everything else about §9 (single source of Desk strings, forbidden-terms test, as-of stamp included) stands.
- **Token guard:** `CommandDashboardDesktop.jsx` has a hard-zero hex baseline — all new styling goes through `CMD.*` / existing primitives. No raw core-palette hex.
- **Flag:** column-0 `export const COMMAND_CENTER_SYNC_ENABLED = false;` with JSDoc + `// Pinned by:` line; dedicated pin suite (per the `leagueBattleviewFlags.test.js:13-17` coupling warning); `DARK_BY_DESIGN` object-map entry with runway note. **Read the flag at render scope only — never module scope** — per the 15-of-56 bare-factory `vi.mock` hazard CC quantified.
- **Poll integration:** the `voiceLayerCache` `getDoc` lands in a separate state setter (the source-regex guard `App.agentBattlesPoll.test.js:76-78` allows exactly one `setActiveAgentBattles(` call). Respect `:101`'s write prohibition. Keep the screen/visibility gating exactly as is.

## 9. P-2 — separate sibling branch, pre-authorized

Before Phase A: cut `chore/p2-drop-permanent-expiry` from `origin/main`, one commit removing `"permanent"` from `api/_utils/voiceLayerPrompt.js:41` (and any same-file prose reference to it), push, report the branch name, return to the Pass 1 branch. **Do not open a PR.** This is its own task and its own branch per BUILD_RULES §2 — it does not ride Pass 1.

## 10. Ledger (founder items recorded, not fixed in this pass)

1. **2027 holiday data** — `src/utils/marketHolidays.js` expires end-2026 with an overdue TODO; client `getMarketState()` degrades Jan 1, 2027. Pre-launch-adjacent liveness item.
2. `api/` vs `src/` marketSchedule divergence (self-contained vs imported holidays; next-close only in `api/`).
3. Dead breakthrough vocabulary beyond `LiveActivityPanel` (`AgentActivityFeed.jsx:67-121`, `agentReflectionUtils.js:203`).
4. `agent-batch-review.js` had zero test coverage before this pass; only the new predicate gains a test here.
5. Cron budget is 39/40, not `BUILD_RULES.md:76`'s 37 — BUILD_RULES needs the correction.
6. Framework errata: C-2 (chat-mode precedent), C-3 (statusFeed marker), C-6 (`benchLocked`), C-7 (`pendingReflection`), blast-radius figures incl. the camelCase/hyphenated grep miss, D-16/D-17 answers. Absorbed into the framework's next revision, not re-relayed now.

## 11. Resume order

A0: P-4 lookup rule + control amendment (or pre-authorized fallback) → P-5 (map cut + `:179` null-render + named exports) → [rider: cache cron window, if not struck] → P-2 sibling branch → Phase A (adapter, amended signature and fields) → B (both shells) → C (Desk incl. §6 staleness-by-phase and as-of stamp) → D (repo-idiom tests, plain copy module, dedicated pin suite) → E (unchanged) → P-6 (`reviewPending` queue + its first test).

Everything else in the spec stands. Same rules: no PRs, no fence contact, full suite (no `tail`, exit code + `Test Files` line) after A, after D, and before handoff; surprises STOP.

**GO.**
