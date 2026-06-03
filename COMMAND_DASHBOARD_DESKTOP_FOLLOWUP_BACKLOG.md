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

## Founder decision needed

### "(unavailable)" watchlist copy while locked in battle

When an agent has an `equippedWatchlistId` whose watchlist isn't in the committed list
(e.g. mid-battle / archived), the Watchlist slot renders `"<name> (unavailable)"`. This
reads like an error rather than the real "locked / mid-battle" state.

**This is NOT desktop-only** — `EquipStation.jsx:226` (mobile) renders the identical copy
via the same `watchlistUnavailable` logic, and `EquipBench.jsx:187` mirrors it. Softening it
(e.g. `"(in battle)"` / `"(locked)"`) should be a **cross-surface** copy change applied to
both, which requires touching the fenced `EquipStation.jsx`. Left to the founder: decide the
copy, then apply to mobile + desktop together.

**Filed:** Jun 3, 2026.
