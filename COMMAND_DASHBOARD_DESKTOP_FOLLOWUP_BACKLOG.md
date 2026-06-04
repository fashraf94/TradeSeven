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

### Desktop `IdentityPanel` ignores its `onOpenAgent` prop (dead prop)

`CommandDashboardDesktop.jsx` passes `onOpenAgent={openAgent}` to `<IdentityPanel>`, but
`desktop/IdentityPanel.jsx`'s signature omits `onOpenAgent` and the panel has no `onClick` —
so the desktop agent card (orb + name + archetype) is **not** tappable-to-profile the way the
mobile `EquipStation` identity panel is (`EquipStation.jsx:190`). Pre-existing; surfaced while
moving the Archetype slot to the picker in the archetype-picker arc. Not urgent — the profile
stays reachable on desktop via the `ReadColumn` orb (`desktop/ReadColumn.jsx:66`).

**Fix when touched:** either wire `IdentityPanel`'s `onOpenAgent` to the portrait `onClick`
(mirroring mobile + `ReadColumn`), or drop the unused prop from both the panel and the
`CommandDashboardDesktop` call site.

**Filed:** Jun 4, 2026 — archetype-picker arc (Phase 0).

### Re-seed soft-deletes accumulate in `agents/{id}/rules` (cleanup — deferred)

`reseedDefaultTraits` (`src/services/seedDefaultTraits.js`) soft-deletes the prior
archetype's trait rule docs (`isDeleted: true`) rather than hard-deleting them —
`forgeService` has no hard-delete, and `getRules` (`:157`) reads the whole `rules`
subcollection then filters `isDeleted` client-side. So every "Load defaults"
re-seed leaves ~6-8 dead rule docs behind; a user who explores several archetypes
accumulates them unboundedly. Functionally invisible (the deploy projection filters
`isDeleted`, and the docs are unlinked from the bundle), but doc count + the
whole-subcollection `getRules` read grow per agent with no reaper.

**Fix when touched:** either hard-delete the captured old trait-rule docs in the
re-seed cleanup step (they're seeder-owned, not referenced by forged-bundle
snapshots the way user rules are), or land a periodic reaper for `isDeleted` rules.
Pairs with the `useForge`/`getRules`-is-eager efficiency item above.

**Filed:** Jun 4, 2026 — archetype-picker arc (Phase 4 code review).

### `useTraits` orphan-cleanup effect is not loading-aware (staleness race — source fix)

`useTraits`' orphan-cleanup effect (`src/hooks/useTraits.js` — the "auto-unequip traits
whose rules are no longer in any active bundle" effect) auto-unequips + persists based on a
staleness heuristic that does **not** distinguish "rules not loaded yet" (`forge.rules === []`
mid-load — the guard `!forge?.rules` treats `[]` as truthy) from "rules genuinely empty." If
it ever runs with fresh `equippedTraits` against stale/empty `forge.rules`, it reads the
just-loaded traits as orphaned and silently wipes them. This is a latent race on **both**
surfaces: the Forge (`ForgeScreen` mounts `useForge` + `useTraits` together and the single
`getDoc` for `equippedTraits` can resolve before `useForge`'s collection reads) and the
dashboard.

The dashboard `TraitsSheet` currently **contains** this with a three-part instance-scoped
guard (own `useForge` + per-open remount-key + a `forge.loading ? undefined : forge` gate)
whose correctness rests on an **untested render-lifecycle timing argument** (documented in the
LOAD-BEARING comment block in `TraitsSheet.jsx`). The Forge trait UI has no such guard.

**Deep fix:** make the orphan effect itself loading-aware — bail while `forge.loading` is true
(or gate the auto-mutation behind an explicit "rules are known-complete" signal both callers
opt into). This closes the race at the source for both surfaces and removes the fragile
per-consumer timing dependency, after which the `TraitsSheet` loading-gate becomes belt-and-
suspenders. It is a guard, **not** reactivity — but it modifies the shared `useTraits` hook the
Forge depends on, so it was deliberately deferred (this arc scoped the staleness fix to the
`TraitsSheet` instance only, by founder decision).

**Trigger to fix:** if the trait→rule mechanism's lifespan extends (it is currently slated to
retire), OR before any future change to `useForge`'s loading model (e.g. seeding rules from
cache synchronously, an `onSnapshot` listener, or splitting the rules/bundles loads so
`loading` flips false with rules still partial) — any of which silently breaks the timing
proof. Land alongside the item below.

**Filed:** Jun 4, 2026 — traits-equip surface arc (Phase 4 code review).

### Localize the per-open remount inside `TraitsSheet` (invariant duplicated across benches)

Half of the orphan-cleanup safety invariant — the per-open remount (`setTraitsEpoch(e => e + 1)`
in the slot `onClick` + `key={traitsEpoch}` + the `traitsEpoch > 0` render gate) — is
copy-pasted into both `EquipStation.jsx` (mobile) and `desktop/EquipBench.jsx`, each carrying
its own LOAD-BEARING comment. The mechanism that keeps `useTraits` from wiping traits lives in
the **host** components, so `TraitsSheet` cannot guarantee its own correctness, and a
maintainer touching only one bench (e.g. "simplifying" away the epoch, or moving to a
controlled-open pattern) breaks the invariant on that surface only — mobile and desktop would
silently diverge.

**Fix:** localize the per-open remount entirely inside `TraitsSheet` (e.g. an internal
open-transition epoch keying an inner data-owning component), so the hosts render
`<TraitsSheet open=… />` like any other sheet with no epoch/key wiring and the invariant lives
in exactly one place. Mind the entrance-animation timing — the inner remount must happen before
paint to avoid a one-frame stale flash (`useLayoutEffect`, not `useEffect`).

**Trigger to fix:** land alongside the loading-guard item above — once the orphan effect is
loading-safe at the source, this remount is a freshness nicety (no longer load-bearing) and the
localization becomes pure cleanup.

**Filed:** Jun 4, 2026 — traits-equip surface arc (Phase 4 code review).

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
