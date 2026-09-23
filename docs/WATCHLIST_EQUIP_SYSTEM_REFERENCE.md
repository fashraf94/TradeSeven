# Watchlist Equip System — Technical Reference

**Status:** Shipped and production-verified as of May 19, 2026
**Phases:** 5A (manual creation), 5B1 (equip backend), 5B2 (equip UI)
**Audience:** Future-Flash, future-Claude, anyone working on related code

This document captures the end-to-end watchlist-equip system as it actually exists in production. Use it as the authoritative reference when modifying or extending watchlist code.

---

## System overview

The watchlist system lets users curate priority opportunities and equip them to their agent. Equipped tickers enter the agent's decision pipeline as **a priority lens, not a replacement** — the agent retains decision authority and may decline to pick watchlist tickers if they don't meet its criteria.

## Data model

### Watchlist doc (`watchlists` collection)

Created in Phase 5A. Touched by Phases 5A, 5B1, 5B2.

```js
{
  watchlistId: string,           // doc ID; mirrors the doc ref
  userId: string,                // owner (auth uid)
  agentId: string | null,        // provenance — agent the watchlist was authored with (signal-derived) OR null (manual). Write-once stamp.
  sourceSessionId: string | null,
  sourceDropId: string | null,
  thesis: string,
  activationConditions: array,
  invalidationConditions: array,
  tickers: [
    {
      symbol: string,
      reasoning: string,
      category: string,
      // ... more fields
    }
  ],
  name: string,                  // empty string falls back to "Untitled watchlist" in UI
  notes: string,
  status: 'draft' | 'committed',
  createdAt: ISO string,
  updatedAt: ISO string,
  committedAt: ISO string | null,
  deletedAt: ISO string,         // absent unless soft-deleted (use `!doc.deletedAt` to filter)
}
```

**Important field semantics:**
- `agentId` is PROVENANCE, not the currently-equipped agent. Never repurpose for equip.
- `userId` is the watchlist owner; backend checks ownership before allowing equip.
- `tickers[].symbol` is the only field used by the equip system. Whitelist regex: `/^[A-Z0-9.\-]{1,12}$/`.

### Agent doc (`agents` collection)

Touched by Phase 5B1 (added 3 fields) and Phase 5B2 (UI consumes them).

New fields added by 5B1:
```js
{
  // ... existing fields
  equippedWatchlistId: string | null,    // points to currently equipped watchlist
  equippedWatchlistName: string | null,  // cached for UI display, written atomically with equippedWatchlistId
  equippedAt: ISO string | null,         // when the equip happened
}
```

**Caching note:** `equippedWatchlistName` is written ONLY by the equip endpoint, alongside the ID. Renaming the watchlist doesn't auto-update this field — staleness is acceptable; Phase 5B2's refresh-on-load handles it for display.

### Battle doc (`agentBattles` collection)

Phase 5B1 added the snapshot field within `agentContext`:

```js
{
  // ... existing battle fields
  agentContext: {
    // ... existing fields including deployedGuardrails
    equippedWatchlist: {
      watchlistId: string,
      name: string,
      tickers: string[],                 // symbol strings, cleaned
      snapshotAt: ISO string,
    } | null,
  }
}
```

**This is FROZEN at battle start.** Mid-battle edits to the source watchlist do NOT affect the running battle. Mirrors `deployedGuardrails` precedent.

---

## Backend endpoints

### POST `/api/agent/equip-watchlist`

Phase 5B1. File: `api/agent/equip-watchlist.js`.

**Request body:**
```js
{ agentId: string, watchlistId: string }
```

**Validation order:**
1. `applySecurityMiddleware` (10/60s rate limit)
2. POST-or-405
3. `requireAuth`
4. `isValidForgeId(agentId)` AND `isValidForgeId(watchlistId)`

**Transactional logic (inside `db.runTransaction`):**
1. `tx.get(agentRef)` and `tx.get(watchlistRef)` — both reads before any writes
2. Agent missing → 404 `agent_not_found`
3. `agent.ownerId !== user.uid` → 403 `forbidden`
4. `agent.activeBattleId` truthy → 409 `battle_active`
5. Watchlist missing or `deletedAt` set → 404 `watchlist_not_found`
6. `watchlist.userId !== user.uid` → 403 `forbidden`
7. `watchlist.status !== 'committed'` → 400 `not_committed`
8. Idempotent: `agent.equippedWatchlistId === watchlistId` → return current state, NO write, no shadow log
9. Else: `tx.update(agentRef, { equippedWatchlistId, equippedWatchlistName, equippedAt, updatedAt })`

**Shadow log (only on real write):**
```js
waitUntil(logSignalDrops({
  stage: 'watchlist_equip',
  userId: user.uid,
  agentId,
  watchlistId,
  loggedAt: nowIso,
}).catch(() => {}));
```

**Response:**
```js
{
  agentId,
  equippedWatchlistId,
  equippedWatchlistName,  // empty string falls back to "" in cached field
  equippedAt,
  idempotent: boolean,    // false for real writes, true for no-op
}
```

### POST `/api/agent/unequip-watchlist`

Phase 5B1. File: `api/agent/unequip-watchlist.js`.

Mirrors equip structure. Body `{ agentId }`. Same auth and battle-lock checks. Idempotent when `equippedWatchlistId` already null. Shadow log stage `'watchlist_unequip'`.

Response:
```js
{
  agentId,
  equippedWatchlistId: null,
  idempotent: boolean,
}
```

---

## Agent decision pipeline integration

Phase 5B1. The riskiest part of the system.

### decide.js (deploy-time)

The equipped watchlist is read ONCE in decide.js after the agent fetch (~:85, after universe fetch). Pattern:

```js
// Phase 5B1 — read equipped watchlist
let equippedWatchlistData = null;
if (agent.equippedWatchlistId) {
  const watchlistSnap = await db.collection('watchlists').doc(agent.equippedWatchlistId).get();
  if (resolveEquippedWatchlist(watchlistSnap.exists ? watchlistSnap.data() : null)) {
    equippedWatchlistData = watchlistSnap.data();
  }
}
const equippedSymbols = equippedWatchlistData
  ? extractTickerSymbols(equippedWatchlistData.tickers)
  : [];
```

**Then folded into Sonnet shortlist via three modifications:**

1. **Shortlist filter replacement (was decide.js:135):** `foldEquippedTickers({ shortlist, equippedSymbols, validSymbols })` replaces the `validSymbols.has(t)` filter. Returns shortlist with equipped tickers preserved + `augmentedValidSymbols`.

2. **Haiku CSV synthesis (~decide.js:148-150):** Synthetic rows for off-universe equipped tickers appended to the CSV. `formatMarketCSV` renders `-` for missing score fields.

3. **`validatePortfolio` calls (decide.js:187 and retry :222):** Both pass `augmentedValidSymbols` (which includes off-universe equipped tickers), not the original universe-only set.

**Sonnet prompt** (in `agentPromptAssembly.js → buildStrategyUserPrompt`):
- New "USER-EQUIPPED WATCHLIST" block appended to user prompt (NOT system prompt — preserves caching)
- Includes watchlist name + ticker list + thesis if present
- Name and thesis sanitized via `sanitizeRuleText`
- Ticker symbols whitelisted via `/^[A-Z0-9.\-]{1,12}$/`
- Block tells Sonnet to treat tickers as priority opportunities, not mandates; evaluate off-universe on sector/thesis

**Haiku prompt** (in `agentPromptAssembly.js → buildPortfolioSystemPrompt`):
- New "USER-EQUIPPED TICKERS" block in system prompt
- Tells Haiku that "-" values for FUND/TECH/BB_FIT/ATR are off-universe tickers, expected, not data errors

### agentBattleService.js (battle creation)

Phase 5B1. The snapshot is passed via `createAgentBattle(db, agentData, thresholds, startingPrices, options)`:

```js
options.equippedWatchlist = equippedWatchlistData
  ? buildEquippedSnapshot(agent.equippedWatchlistId, equippedWatchlistData)
  : null;
```

`buildEquippedSnapshot` returns `{ watchlistId, name, tickers }` (no timestamp). `createAgentBattle` adds `snapshotAt: now` and writes to `agentContext.equippedWatchlist`.

**This is the single watchlist read.** decide.js holds the data and passes it to `createAgentBattle` — no second Firestore read (avoids TOCTOU).

### agent-evaluate.js (daily refresh in cron)

Phase 5B1. Daily refresh logic (~:398-451) was extended:

After `newHotBench` is built from stockRankings (line ~409), the union helper is called:

```js
const equippedTickers = battle.agentContext?.equippedWatchlist?.tickers || [];
newHotBench = unionEquippedIntoHotBench({
  hotBench: newHotBench,
  equippedTickers,
  rankings: stockRankingsArray,
  excludeSymbols: new Set([...portfolioSymbols, ...benchSymbols]),
  cap: 20,
});
```

**Cap behavior:** equipped tickers ALWAYS survive; non-equipped get sorted by `baggerBombFit` and trimmed to fit cap. Soft cap at 20.

**Critical:** hotBench is `string[]`, not `object[]`. Operations must be string-based.

---

## Pure helpers

### `api/_utils/watchlistEquip.js` (Phase 5B1)

```js
extractTickerSymbols(tickers)
// → string[]: maps tickers[].symbol, uppercases, drops invalid, dedupes
// Whitelist: /^[A-Z0-9.\-]{1,12}$/

resolveEquippedWatchlist(watchlistData | null)
// → data or null. Returns null if !data || data.deletedAt || data.status !== 'committed'

foldEquippedTickers({ shortlist, equippedSymbols, validSymbols })
// → { shortlist, elevatedTickers, offUniverseTickers, augmentedValidSymbols }

unionEquippedIntoHotBench({ hotBench, equippedTickers, rankings, excludeSymbols, cap })
// → string[]: equipped always survive; cap-sort by baggerBombFit Map lookup

buildEquippedSnapshot(watchlistId, watchlistData)
// → { watchlistId, name, tickers }. No timestamp (caller adds).
```

### `src/utils/watchlistEquipUI.js` (Phase 5B2)

```js
isWatchlistEquipped(agent, watchlistId) → boolean

getCardEquipState({ agent, watchlist, working })
// → { visible, isEquipped, mode, disabled, label }
// visible: false when watchlist.status !== 'committed'
// mode: 'equip' | 'unequip'
// disabled+label: handles null agent, active battle, working state

resolveEquippedName({ equippedWatchlistId, cachedName, freshWatchlist, fetchStatus })
// → { name, unavailable }
// fetchStatus: 'pending' | 'ok' | 'not_found' | 'error'

getEquippedWatchlistLabel(equippedWatchlistSnapshot) → string | null
// `Watchlist: ${name}` or null

getEquipErrorMessage(error, action) → string
// 409 → "Cannot {action} — the agent is in an active battle."
// 404 → "That watchlist is no longer available. Refresh to see your current list."
// else → "Could not {action} the watchlist. Try again."
```

---

## Frontend service layer

### `src/services/agentService.js`

Phase 5B1 added:

```js
equipWatchlist(agentId, watchlistId)
// POST /api/agent/equip-watchlist. Returns { agentId, equippedWatchlistId, equippedWatchlistName, equippedAt, idempotent }.
// Throws Error with .status and .code on non-2xx.

unequipWatchlist(agentId)
// POST /api/agent/unequip-watchlist. Returns { agentId, equippedWatchlistId: null, idempotent }.
```

Both modeled on `forgeWatchlistService.js` `commitWatchlist`/`uncommitWatchlist` pattern (fetchWithAuth + toError mapping).

### `src/services/forgeWatchlistService.js`

Phase 5A added `createWatchlist()` (manual-only, no-args, posts empty body). Existing methods (`listWatchlists`, `getWatchlist`, `patchWatchlist`, `commitWatchlist`, `uncommitWatchlist`, `deleteWatchlist`) unchanged.

**Note:** Signal-derived watchlist creation does NOT flow through this service. WatchlistChat.jsx calls fetchWithAuth inline. Service-layer asymmetry accepted in Phase 5A (A1 lock); future hygiene candidate.

---

## UI surfaces

### Watchlist card (Forge → My Watchlists)

Phase 5B2.

**Header chip** (next to WatchlistStatusBadge): when `isEquipped`, render teal Bookmark chip "Equipped to: {agent.name}". WatchlistStatusBadge token formula. Read-only.

**Footer row** (after ticker chips, only for committed watchlists):
- `borderTop: 1px solid tokens.borderDefault` divider
- Equip button when not equipped, Unequip button when this IS the equipped one (symmetric)
- Both call `e.stopPropagation()` before service call (card itself is `role="button"`)
- Disabled when no agent, active battle, or operation in flight

### AgentDashboard EquippedWatchlistCard

Phase 5B2. New component in `src/components/Agent/EquippedWatchlistCard.jsx`.

**Position:** Overview tab right column, between DeployedStrategyCard and ConsolidatedInsightPreview.

**Visual:** HoloCard primitive with `borderLeft: 3px solid tokens.teal` accent.

**States:**
- No committed watchlists → empty state with "Create a watchlist in Forge →" CTA
- Agent unequipped → indicator chip "None" + selector
- Agent equipped → indicator chip with cached/fresh name + selector + Unequip option in selector ("None equipped")

**Refresh-on-load (Q-B6):** On mount AND when `equippedWatchlistId` changes:
- Single `getWatchlist(id)` fetch
- On success: replace cached name with fresh name
- On 404: append "(unavailable)" to displayed name (cached name still shown)
- On other error: silently fall back to cached name
- Unmount-safe via `cancelled` flag

**Selector:** Native `<select>` with empty option "None equipped" + each committed watchlist as `{name} ({tickerCount} tickers)`. Change handler: empty → unequip; new ID → equip (silent replace, no dialog per Q-B2).

### AgentBattleScreen indicator

Phase 5B2. Read-only chip in back-button bar row, left of status pill.

**Render condition:** `agentBattle?.agentContext?.equippedWatchlist` non-null
**Content:** `Watchlist: {name}` from frozen snapshot — never goes stale
**Behavior:** Read-only, no click navigation (Q-B5)

---

## Edge case handling

### Soft-delete equipped watchlist

- Running battle: Unaffected. Snapshot frozen in battle doc.
- Agent doc: `equippedWatchlistId` still points to deleted doc (dangling pointer tolerated per Q3).
- Next deploy: decide.js's `resolveEquippedWatchlist` returns null → degrades to no-equip gracefully (warn log emitted).
- Dashboard UI: refresh-on-load 404 surfaces "(unavailable)" appendage on cached name.
- No auto-unequip. User can manually unequip whenever convenient.

### Uncommit equipped watchlist

- Equipped state survives uncommit (Q4). `equippedWatchlistId` stays pointing at the now-draft watchlist.
- Next deploy: `resolveEquippedWatchlist` returns null (status !== 'committed') → degrades to no-equip.
- User must re-commit before next deploy will use it.

### Rename equipped watchlist

- Agent's cached `equippedWatchlistName` goes stale.
- Dashboard chip: refresh-on-load fetches fresh name on next dashboard visit.
- Running battle chip: shows snapshot name (frozen at battle start) — won't update.
- Watchlist card chip: shows agent.name (the agent's name, not the watchlist's) — unaffected.

### Active battle conflict

- Equip and unequip both 409 when `agent.activeBattleId` truthy.
- UI proactively disables buttons + dropdown (gate at agent.activeBattleId).
- Backend 409 is backstop for race conditions.

### Equip when another watchlist is already equipped

- Silent replace (Q-B2). Backend atomic — single write updates equippedWatchlistId, equippedWatchlistName, equippedAt.
- UI updates across all surfaces via Firestore subscription propagation.
- Brief window (<500ms typical) where surfaces show stale state during propagation; `working` flag disables controls.

---

## Known limitations (accepted, documented)

1. **Off-universe equipped tickers are inert as mid-battle swap-IN candidates.** They fold into the deploy-time portfolio fine, but the cron's `hotBenchAssetMap` is built only from stockRankings. Off-universe tickers added by daily-refresh union are not lost (V-20 still holds — they stay in hotBench) but the swap evaluation logic never sees them as candidates to swap in. Acceptable for 5B1; future enhancement.

2. **Conversation layer deferred until after Voice Layer rework.** Path A locked. Beta testers won't get the "why now" educational moment when watchlist tickers get picked. They'll see the swap happen via existing statusFeed/TradeTickerCard. Phase 5B follow-up after Voice Layer ships.

3. **No mid-session refresh for rename staleness.** Refresh-on-load only fires on component mount. If user renames a watchlist while dashboard is open in another tab, the chip stays stale until reload.

4. **One agent per user assumption.** Codebase uses `subscribeToUserAgent` with `limit(1)`. Multi-agent support would require revisiting Phase 5B2's `useAgent` integration (currently destructures single agent).

5. **Empty draft pile-up possible at scale.** D1 + D6 + no idempotency means rapid clicking of "New Watchlist" creates many empty drafts. At MVP scale, manual delete covers it. Auto-cleanup is a future enhancement.

---

## Test coverage

### Backend tests
- `api/forge/watchlists.test.js` — Phase 5A added 11 manual-create tests
- `api/agent/equip-watchlist.test.js` — Phase 5B1 added 21 endpoint tests
- `api/_utils/watchlistEquip.test.js` — Phase 5B1 added 27 helper tests
- `api/_utils/agentBattleService.test.js` — Phase 5B1 added 4 snapshot tests
- `api/cron/agent-evaluate.test.js` — Phase 5B1 added 4 static-source guards (cron handler too entangled to behaviorally test)

### Frontend tests
- `src/services/agentService.test.js` — Phase 5B1 added 7 service-method tests
- `src/services/forgeWatchlistService.test.js` — Phase 5A added 3 createWatchlist tests
- `src/utils/watchlistEquipUI.test.js` — Phase 5B2 added 26 helper tests

### NOT covered by automated tests
- Component rendering (no jsdom/RTL infrastructure)
- Cross-surface Firestore subscription propagation
- LLM behavior under different prompt conditions
- Active-battle 409 race conditions

These are smoke-test verified or covered by manual verification only.

---

## Smoke test matrix (post-deploy verification)

For each phase, the smoke matrix verifies what tests can't.

### Phase 5A smoke (V-11 to V-20)
- Manual watchlist creation works, editor opens empty, auto-save handles empty draft, list view shows manual + signal-derived identically, edge cases hold.

### Phase 5B1 smoke (V-17 to V-23)
- Equip endpoint works via DevTools API call, agent doc updates, battle creates with snapshot, watchlist tickers appear in portfolio/bench, daily refresh preserves equipped tickers, 409 on active battle, soft-delete unaffected.

### Phase 5B2 smoke (V-17 to V-25)
- Watchlist card chips and buttons render correctly, equip from watchlist surface updates dashboard surface, dashboard selector silent replace works, AgentBattleScreen chip renders during running battle, active battle disables all controls, soft-deleted equipped surfaces "(unavailable)", rename refreshes on dashboard reload.

---

## File reference (where things live)

**Backend:**
- `api/agent/equip-watchlist.js` — equip endpoint
- `api/agent/unequip-watchlist.js` — unequip endpoint
- `api/_utils/watchlistEquip.js` — pure helpers (resolve, fold, union, snapshot)
- `api/_utils/agentBattleService.js` — battle creation, accepts equippedWatchlist via options
- `api/agent/decide.js` — reads equipped watchlist, folds tickers, prompt blocks
- `api/cron/agent-evaluate.js` — daily refresh unions equipped tickers into hotBench
- `api/_utils/agentPromptAssembly.js` — Sonnet/Haiku prompt assembly with equipped blocks
- `api/_utils/agentToolSchema.js` — STRATEGY_TOOL.shortlist description softened
- `api/forge/watchlists.js` — POST handles manual + signal-derived creation

**Frontend (service layer):**
- `src/services/agentService.js` — equipWatchlist/unequipWatchlist methods, agent doc default shape
- `src/services/forgeWatchlistService.js` — createWatchlist (manual-only)

**Frontend (UI):**
- `src/components/Forge/Watchlist/WatchlistListCard.jsx` — header chip + footer button
- `src/components/Forge/Watchlist/WatchlistListPanel.jsx` — useAgent integration, handlers
- `src/components/Forge/Watchlist/WatchlistListEmptyState.jsx` — secondary "New Watchlist" CTA
- `src/components/Agent/EquippedWatchlistCard.jsx` — new dashboard equip card
- `src/components/Agent/AgentOverviewTab.jsx` — renders EquippedWatchlistCard
- `src/screens/AgentBattleScreen.jsx` — back-bar chip
- `src/utils/watchlistEquipUI.js` — pure helpers (isEquipped, getCardEquipState, resolveEquippedName, etc.)

**Hooks:**
- `src/hooks/useAgent.js` — default export, returns `{ agent, loading, hasAgent, ... }`

---

## Related docs

- `DRIFT_LEDGER.md` — drift catches per phase, patterns observed
- `SESSION_SUMMARY_WATCHLIST_ARC_MAY2026.md` — full session narrative
- `FANTASYTRADES_VOICE_LAYER_REWORK_ROADMAP.md` — context for deferred conversation layer
- Phase 5A/5B1/5B2 session summaries — granular phase records

---

*Compiled May 19, 2026. Last verified against production: all three phases shipped to main and smoke-passed.*
