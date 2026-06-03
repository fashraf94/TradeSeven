# Command Dashboard — Desktop Follow-Up Backlog

Drift-risk and cleanup items captured while shipping the desktop Command Dashboard
(`CommandDashboardDesktop` + `desktop/*`, behind `COMMAND_DASHBOARD_DESKTOP_ENABLED`,
default false). None block the merge; they exist because the arc deliberately built
**desktop-local** Equip/Deploy (founder decision "Q1") rather than reusing the mobile
stations, and because the live mobile `CommandDashboard.jsx` / `EquipStation.jsx` are
fenced (cannot be refactored in this arc).

## Open

### Extract a shared `useEquipBench` hook (Q1 drift risk — highest priority)

`desktop/EquipBench.jsx` re-implements the **data layer** of `EquipStation.jsx`
near-verbatim, not just the chrome: the `useForge(agentId)` destructure, the committed-
watchlist `useEffect` (`listWatchlists` → `filterWatchlistsByStatus(list, 'committed')`,
cancelled flag), the `equippedWatchlist` memo + `watchlistName`/`watchlistUnavailable`,
the `handleEquipWatchlist`/`handleEquipBundle`/`handleUnequipBundle`/`openForge` handlers,
the `watchlistRows` builder, and `rulesTitle`. Only the presentation (horizontal `RowSlot`
grid vs the mobile character-sheet) and the dropped identity sub-panel differ.

Two components now own one equip protocol, so equip semantics can drift between mobile and
desktop with no compiler signal.

**Pre-merge audit (this arc) confirmed the two are currently aligned:** `benchLocked`
(`agent.activeBattleId`), the in-flight lock (`Boolean(equippingBundleId)`), the committed
filter, and — after a fix in this arc — the `equippedCount` formula
(`1 + agent.equippedWatchlistId + (agent.equippedBundleIds.length>0)`) all match
`EquipStation` exactly.

**Trigger to fix:** when the fences on `EquipStation.jsx` lift (or the desktop flag goes
live and both surfaces are in active use). Extract `useEquipBench(agentId, setShowForge)`
returning `{ slots data, handlers, watchlistRows, rulesTitle, equippedCount, loading,
benchLocked }`; have **both** `EquipStation` and `EquipBench` consume it, each keeping its
own JSX. This also resolves the efficiency item below.

**Filed:** Jun 3, 2026 — desktop Command Dashboard Phase 5 audit.

### `useForge` is heavier than EquipBench needs (efficiency)

`EquipBench` (like the mobile `EquipStation`) mounts the full `useForge(agentId)` but only
consumes `forgedBundles` / `equippedBundles` / `equip fns`. `useForge` eagerly fires a
`getRules()` `getDocs` over the agent's whole `rules` subcollection and computes the
radar/collection/template memos — none read here. A bundles-only read does not exist in the
codebase today. Folds naturally into the `useEquipBench` extraction (a lean hook can read
only bundles). Not a regression — identical to shipped mobile `EquipStation`.

**Filed:** Jun 3, 2026.

### Shared formatters duplicated across mobile/desktop (blocked by fences)

`getGreeting()`, `prettyDate()`, and `tickerLabel()` are now copied verbatim into the new
desktop files (they already lived in the fenced `CommandDashboard.jsx` / `DashboardLoop` /
`DashboardDesktop` / `EquipStation.jsx`). They cannot be de-duplicated without importing a
shared util into those fenced mobile files. **Trigger:** when the fences lift, promote to
`src/utils/dateUtils.js` (date helpers) and export `tickerLabel` from a shared module, then
import in all surfaces.

**Filed:** Jun 3, 2026.

### `SidebarOffset` constant/component (pre-existing, repo-wide)

The `marginLeft: sidebarCollapsed ? '64px' : '220px'` literal is now duplicated ~11× across
`App.jsx` (the desktop Command branch added the latest). A shared `SIDEBAR_WIDTH`
constant or `<SidebarOffset>` wrapper would own the width + transition once. Pre-existing;
not introduced by this arc.

**Filed:** Jun 3, 2026.

### Battle-accurate watchlist label (polish — deferred)

The Watchlist slot shows `"(unavailable)"` whenever the equipped watchlist is absent from
the committed set (`watchlistUnavailable = Boolean(equippedWatchlistId) && listLoaded &&
!equippedWatchlist`), which conflates a true **mid-battle lock** with a merely
**uncommitted / archived / deleted** watchlist. To label a real lock distinctly (e.g.
`"(in battle)"`), the condition must additionally gate on `agent.activeBattleId` (true lock)
vs. plain committed-set absence, and choose copy per case.

**Why deferred:** this is logic, not copy — it touches the fenced `EquipStation.jsx` (the
`watchlistUnavailable` derivation and the label expression) and must land on both surfaces
together. Trigger: when the EquipStation fence lifts, or alongside the `useEquipBench`
extraction.

**Filed:** Jun 3, 2026.

## Resolved

### Watchlist "(locked)" copy — tried, reverted to "(unavailable)"

Jun 3, 2026: briefly changed the suffix from `"(unavailable)"` to `"(locked)"` on both
`EquipStation.jsx` (mobile) and `EquipBench.jsx` (desktop), then **reverted** both back to
`"(unavailable)"` the same day.

**Reason for the revert:** the `watchlistUnavailable` trigger is *committed-set absence*,
not battle-lock — `Boolean(equippedWatchlistId) && listLoaded && !equippedWatchlist`, where
`equippedWatchlist` is resolved against `filterWatchlistsByStatus(list, 'committed')`. It
fires whenever the equipped watchlist is missing from the committed set (non-committed
status, archived, or deleted), so `"(locked)"` would mislabel those non-battle cases;
`"(unavailable)"` is accurate for the broad trigger. A truly battle-aware label is filed
above under Open ("Battle-accurate watchlist label").

**Net effect:** the label is `"(unavailable)"` on both surfaces — unchanged from pre-arc.
The `EquipStation` edits were copy-only, founder-approved fence exceptions (both directions).
