# Forge Mobile Redesign — Phase 2 Follow-Up Backlog

Deferrals captured while shipping Forge Mobile **Phase 2** (theme → build a
watchlist, and theme → "Dive in" curation chat). None of these block Phase 2;
they were surfaced during the build / smoke / code-review and parked here so
they're discoverable and don't accumulate silently. Each should be picked up as
its own standalone change with its own smoke.

## Open

### Portal `ConfirmationPopup` to `document.body` (app-wide)

**File**: `src/components/shared/ConfirmationPopup.jsx:50` (the `position: 'fixed'`, `zIndex: 1000` overlay)

Same class of bug as the Forge takeover overlays fixed in Phase 2 (commit
`eefc578`): the overlay is `position: fixed` but never portaled, so inside a
scrolling/transformed ancestor (e.g. the Forge's scrollable body) it gets
re-based and the segmented nav bleeds through behind the dimmed backdrop. The
fix is the established pattern — wrap the return in `createPortal(..., document.body)`,
keeping the existing `z-index` — exactly as applied to `ThemeDetailModal`,
`SignalDropEntry`, `WatchlistChat`, and `SectorDetailModal`.

**Why it wasn't bundled into Phase 2**: `ConfirmationPopup` is shared app-wide —
**13 call sites**, only 3 in the Forge (`DeleteWatchlistModal`, `CommitModal`,
`UncommitModal`); ~10 are core `App.jsx` battle/draft flows. Impact in the Forge
is mild/cosmetic (centered confirm + dimmed backdrop, nav peeks — not a header
collision), so it isn't worth pulling unrelated flows into a Forge-phase merge
and smoke.

**Trigger to fix**: when there's appetite for an app-wide confirm-dialog change.
Do it as a standalone PR with an **app-wide smoke** (battle/draft confirmations,
not just the Forge ones).

**Filed**: June 5, 2026 — Forge Mobile Phase 2 (code-review finding).

### Sector → watchlist (the sector analog of theme → watchlist)

**File**: `src/components/Forge/workshop/WatchlistsArea.jsx:~70` (`stubbedSectorWorkshop`) → `src/components/discover/DiscoverPanel.jsx` (`handleStartSectorWorkshop`)

Phase 2 wired **theme → build a watchlist** but left the **sector** handoff
(SectorRail's "Start in Workshop") as a `showToast('Building a watchlist from a
sector is coming soon')` stub. The plumbing is already there: `sectorToSeed()`
in `DiscoverPanel` produces `{ name, anchorTickers, ... }` (top holdings by ETF
weight), so this is the same create → PATCH(name/thesis/tickers) → route-to-editor
flow as the theme path — just sourced from a sector. No backend change needed
(reuses the existing watchlist create/PATCH/commit contract).

**Trigger to fix**: when the sector lane is promoted from "browse" to a
first-class build source. Mirror `handleBuildFromTheme` for sectors; keep the
shelved Workshop unreachable.

**Filed**: June 5, 2026 — Forge Mobile Phase 2 (scoped out; theme-only this pass).

### First-class `sourceThemeId` on theme-built watchlists

**Files**: `api/forge/watchlists.js` (both create paths), `api/forge/watchlists/[id].js` (PATCH field allow-list), `src/components/Forge/workshop/WatchlistsArea.jsx` (theme → Build PATCH)

Today, a theme-seeded watchlist's provenance is captured indirectly: for
**theme → Dive-in** it's on the dialogue session (`watchlistSessions/{id}.themeId`,
with the watchlist's `sourceDropId` being the synthetic session handle); for
**theme → Build** there's no theme reference on the watchlist doc at all (the
draft is created empty then PATCHed with name/thesis/tickers). Adding an
additive, null-default `sourceThemeId` field on the watchlist doc would make the
originating theme first-class on the artifact itself.

Touch points (additive, low-risk): write `sourceThemeId: null` in the manual
create and `sourceThemeId: session.themeId || null` in the signal-derived create
(`watchlists.js`); accept + shape-validate `sourceThemeId` in the PATCH
allow-list (`watchlists/[id].js`); have `theme → Build` pass it through the PATCH
(`WatchlistsArea` already receives `themeId` from `DiscoverPanel`). Plus a couple
of `watchlists.test.js` assertions.

**Why deferred**: not required — provenance is already recoverable via the
session — and it changes the watchlist write contract, so it's cleaner as its own
small change than folded into the Phase 2 merge.

**Trigger to fix**: when theme provenance needs to be queryable/displayable
directly off the watchlist (e.g. a "from the X theme" label in the editor or a
provenance report).

**Filed**: June 5, 2026 — Forge Mobile Phase 2 (deferred per founder).
