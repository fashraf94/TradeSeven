# Forge Discover Tab — Implementation Spec (Final)

**Date:** April 25, 2026
**Status:** Final implementation reference. Authoritative source of truth for Discover tab work.
**Companion document:** `FORGE_SIGNAL_DROP_SPEC.md` — Signal Drop is a peer feature that lives at the top of this tab. Both specs share Workshop handoff infrastructure.

---

## 1. Purpose

The Discover tab is the inspiration surface of the Forge. It serves two distinct user populations through a single page:

- **Novice users** who don't have the vocabulary to start a Workshop conversation cold. Discover gives them tappable cards that translate "the market" into specific, actionable starting points for strategy development.
- **Returning users** who have built strategies before and want a low-effort surface to find their next idea — both from curated content and from their own attention history (via Signal Drop).

Every card and surface in Discover ends in a handoff to Workshop Mode (with pre-seeded context) or to a watchlist. There are no dead-ends and no read-only content — Discover always funnels toward action.

---

## 2. Tab Structure (Forge-Wide)

The Forge has three peer tabs:

```
[Lab]   [Discover]   [Architect]
```

Codebase tab IDs: `'lab'`, `'discover'`, `'architect'`.

- **Lab** — where users build, run, and watch their trading agents. Active strategy work.
- **Discover** — inspiration surface. This spec.
- **Architect** — rule browser for power users who want to shape underlying agent behavior.

**Default-tab logic** (recomputed on every Forge open, not stored as preference):

> Default tab is **Discover** if and only if the user's `users/{uid}/agents` Firestore subcollection is empty. Otherwise default to **Lab**.

Implementation:

```js
// Inside useForge() hook or wherever default-tab logic lives
const [defaultTab, setDefaultTab] = useState(null);

useEffect(() => {
  if (!user?.uid) return;
  const agentsRef = collection(db, 'users', user.uid, 'agents');
  getDocs(query(agentsRef, limit(1))).then(snap => {
    setDefaultTab(snap.empty ? 'discover' : 'lab');
  });
}, [user?.uid]);
```

The `limit(1)` makes this a fast existence check (single doc read). Architect is never the default. All three tabs are reachable in one tap regardless of default state.

While `user?.uid` resolves, render tab pills without a default selection or fall back to `'discover'` for the loading state.

---

## 3. Discover Tab — Layout (Mobile)

Top-to-bottom vertical scroll:

1. **Signal Drop input** (persistent, first-class) — see Signal Drop spec
2. **Current Events rail** (horizontal scroll)
3. **Themes rail** (horizontal scroll)
4. **Sectors rail** (horizontal scroll)
5. **Recent Drops rail** (horizontal scroll, 5 cards + "View all" CTA, hidden until first drop) — see Signal Drop spec

Week banner appears above the first content rail (Current Events): `Week of April 27`. Format: "Week of {Monday DD}". The banner is an envelope for Themes and Sectors rails (which refresh weekly). Current Events cards within a given week are dated individually ("WED 2PM") so daily DRB-driven refresh inside the week is visually obvious.

---

## 4. Discover Tab — Layout (Desktop)

Full-width single-column layout. Rails extend across the viewport because horizontal scrolling for cards needs the width to feel right. Do not use the two-column treatment from the Lab tab.

```
┌────────────────────────────────────────────────────────────┐
│  Signal Drop input (full width, max 720px centered)        │
├────────────────────────────────────────────────────────────┤
│  Week of April 27                                          │
├────────────────────────────────────────────────────────────┤
│  CURRENT EVENTS              [scroll → ]                   │
│  [card] [card] [card] [card] [card]                        │
├────────────────────────────────────────────────────────────┤
│  THEMES                      [scroll → ]                   │
│  [card] [card] [card] [card] [card]                        │
├────────────────────────────────────────────────────────────┤
│  SECTORS                     [scroll → ]                   │
│  [card] [card] [card] [card] [card]                        │
├────────────────────────────────────────────────────────────┤
│  YOUR RECENT DROPS           [View all →]    (if any)      │
│  [card] [card] [card] [card] [card]                        │
└────────────────────────────────────────────────────────────┘
```

Container max-width: 1200px centered. Rails use horizontal scroll with snap points on card boundaries (CSS `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on cards — new pattern for the codebase).

---

## 5. The Three Curated Rails

### 5.1 Current Events rail

**Purpose:** "What's happening in the market this week that I could build a strategy around?"

**Data source:** Hybrid (DRB + sonar endpoints)

- Read `indexIntelligence/dailyRegimeBrief` on Discover tab open to get `keyEvents` array (3-6 forward-looking event labels).
- For each `keyEvent` string (e.g., "Wed FOMC decision"), parse the day-of-week prefix via regex (`/^(Mon|Tue|Wed|Thu|Fri)\b/`) to resolve a date.
- Look up structured event details by joining keyEvent text against:
  - `fetchEconomicEvents` util (in `api/_utils/`) — for Fed/macro events
  - `fetchEarningsCalendar` util (in `api/_utils/`) — for earnings events
- The join is fuzzy substring match on the event/symbol field. Some Sonnet-authored keyEvents may not match cleanly — if no match, render the keyEvent string alone as the card title with a degraded card body extracted from DRB's `dailyBrief` paragraph.

**No new cron required.** DRB writes daily at 12:30 UTC. Sonar utility caches are 1hr (econ) and 4hr (earnings). The Discover read happens at request time and joins these existing data sources.

**Cadence:** Refreshes daily as DRB updates. The week banner is the envelope, but events inside refresh.

**Card anatomy:**
```
┌──────────────────────────────────┐
│ WED 2PM ET                       │  ← date pill, teal accent
│                                  │
│ Fed rate decision                │  ← title (16px semibold)
│                                  │
│ Market expects a hold. Watch     │  ← body (~2 sentences)
│ for dot plot revisions and       │
│ Powell's press conference tone.  │
│                                  │
│ SPY  TLT  GLD                    │  ← affected tickers (3 max)
│                                  │
│ [Build a strategy →]             │  ← primary CTA, gold
└──────────────────────────────────┘
```

Card dimensions: 280px wide × 240px tall (mobile/desktop consistent). Tickers tappable (open AssetResearchModal — existing component).

**Past events:** Hidden entirely. If `keyEvent` date is in the past relative to today, omit from rail.

**Empty state:** If DRB hasn't written today's brief (cron failure or weekend), render last successful brief's events with a footer note: "Updated Monday" on weekends, "Updating shortly" weekday mornings before 12:30 UTC.

### 5.2 Themes rail

**Purpose:** "What long-arc narratives matter in the market that I could build a position around?"

**Data source:** 8 evergreen Thematic entries (Flash transferring from prior project) + DRB-driven weekly relevance promotion.

The 8 evergreens:
- AI Infrastructure
- Energy Transition
- Reshoring
- Aging Demographics
- Cybersecurity
- Housing Cycle
- Consumer Bifurcation
- Dollar Strength Regimes

Each Thematic entry's content lives in Firestore at `discoverThemes/{themeId}` with the schema in Section 8.1.

**Weekly relevance promotion:**

A Monday-only cron at 13:00 UTC (`/api/cron/promote-discover-themes`) reads DRB's `themes` array from the most recent brief and matches against evergreen titles via fuzzy keyword matching (e.g., "AI capex rotation cooling" → matches keywords against "AI Infrastructure"). The matched theme is flagged `isLiveThisWeek: true` for the week. Up to 2 themes can be flagged live per week. Unmatched themes default to `isLiveThisWeek: false`.

The rail rendering logic puts `isLiveThisWeek: true` themes first with a small "Live this week" pulse indicator. Other themes follow in their default order.

**Card anatomy:**
```
┌──────────────────────────────────┐
│ ⚡ Live this week (if applicable) │  ← teal pulse pill
│                                  │
│ AI Infrastructure                │  ← title
│                                  │
│ Chips → Data centers →           │  ← chain visualization
│ Power → Cooling                  │     (small font, teal)
│                                  │
│ NVDA  AMD  AVGO  +5              │  ← top 3 tickers + count
│                                  │
│ The compute build-out is         │  ← narrative (short)
│ accelerating across all four     │
│ layers...                        │
│                                  │
│ [Build a strategy →]             │
└──────────────────────────────────┘
```

Card dimensions: 280px × 280px.

### 5.3 Sectors rail

**Purpose:** "Which part of the economy could I focus on?"

**Data source:** `STOCK_UNIVERSE` from `api/_utils/rankingConfig.js`. 232 stocks across 11 sectors. Each sector entry includes `name`, `etf`, `color`, and `stocks` array — all four fields are used directly.

The 11 sectors (canonical names from codebase): Technology, Healthcare, Financials, Energy, Consumer Discretionary, Consumer Staples, Industrials, Materials, Utilities, Real Estate, Communication Services.

**Frontend duplicate at `src/constants/sectors.js`** exists per audit. Phase 1 should verify the duplicate is consistent with the backend source of truth.

**Sector weekly performance compute:**

Weekly returns are NOT precomputed anywhere in the codebase. The Sectors rail must compute them on each render from the last 5 daily closes per ticker (data is in `marketDataCache.js`). To avoid recomputing on every Discover tab open:

- `/api/discover/sectors` endpoint checks an in-memory cache (`serverCache.js`) for `sectors_weekly_perf_{10minBucket}`. If present, returns immediately.
- If cache miss: reads last 5 trading days of close prices for all 232 tickers from `marketDataCache.js`, aggregates per sector (average week-over-week return + top 3 individual movers), caches result for 10 minutes.

**Card anatomy:**
```
┌──────────────────────────────────┐
│ Technology                       │  ← sector name
│                                  │
│ +2.4% this week                  │  ← weekly perf, color-coded
│                                  │
│ 47 stocks                        │  ← count in universe
│                                  │
│ Hardware, software, semis,       │  ← short hardcoded blurb
│ services. Most volatile sector.  │
│                                  │
│ Top movers: NVDA AAPL MSFT       │  ← 3 top performers this week
│                                  │
│ [Build a strategy →]             │
└──────────────────────────────────┘
```

Card dimensions: 240px × 240px. Sector colors come from existing `STOCK_UNIVERSE[sectorId].color` field, not a new palette.

### 5.4 Recent Drops rail

See `FORGE_SIGNAL_DROP_SPEC.md` Section 6 for full definition. Brief summary:

A horizontal rail at the bottom of Discover that surfaces the user's **5 most recent Signal Drops** as cards, with a "View all →" CTA at the end of the rail that opens a dedicated `DropHistoryModal` (the full archive surface).

Each card shows the parsed signal summary, outcome marker (saved as watchlist / built strategy / not yet acted on), and a tap action that reopens the cached Expanded Signal Card for revisit.

**Hidden entirely if user has no drop history.** Once a user makes their first drop, the rail appears.

**Stale drop handling:** Drops older than 14 days surface a "Market context has shifted" banner on revisit, with options to use the cached expansion or re-expand against current market conditions. See Signal Drop spec Section 6.3.

---

## 6. Workshop Handoff Pattern (Shared Across All Cards)

Every card with a `[Build a strategy →]` CTA passes a `workshopSeedContext` object to WorkshopChat on mount.

**Schema:**
```js
{
  source: 'discover_event' | 'discover_theme' | 'discover_sector' | 'signal_drop',
  sourceId: string,                  // e.g., theme ID, event ID, drop ID
  contextBlock: string,              // Injected into Voice Layer Block 3.5; PERSISTS across all turns
  tickerSeed: string[],              // Pre-populated tickers to anchor the conversation
  metadata: {
    title: string,                   // For UI display: "Building from: Fed Rate Decision"
    timestamp: ISO8601
  }
}
```

**No `openingMessage` field.** Gemma generates the first Workshop message live in response to a synthetic primer (see implementation below).

**Workshop Mode lives at:**
- Frontend: `src/components/Forge/WorkshopChat.jsx`
- Backend: `api/forge/workshop-chat.js`

(Note: `AgentChat.jsx` and `api/agent/chat.js` handle battle/review only and are NOT touched by Discover work.)

**Implementation in WorkshopChat:**

When WorkshopChat mounts with non-null `workshopSeedContext`:

1. **Persist `workshopSeedContext` in component state for the session lifetime.** Every `/api/forge/workshop-chat` POST during the session includes it in the request body.
2. **Auto-send a synthetic primer.** A single fixed user-side message is sent automatically — `"Let's build a strategy from this."` for all Discover sources. This triggers the existing `/api/forge/workshop-chat` flow.
3. **Render the primer as the user's first message** in the conversation thread (so the chat reads naturally), but flag it `isSynthetic: true` so it's distinguishable from genuine user input.
4. **Gemma's response is the opener,** generated live against the seed context injected into Block 3.5.
5. **Render a "Building from: {metadata.title}" chip** at top of WorkshopChat throughout the session. Tapping the dismiss icon clears `workshopSeedContext` from component state — subsequent turns no longer re-inject it. Effectively "exit guided mode" without leaving the conversation.

**Backend flow:**

`api/forge/workshop-chat.js` accepts `workshopSeedContext` in the request body. On every turn, it builds the prompt including the `contextBlock` injected into anchorContext alongside the live DRB anchor. The Voice Layer prompt builder is stateless and rebuilds the entire prompt from arguments on every call — there is no "first turn only" injection logic. The seed context flows through naturally as long as the frontend keeps sending it.

**Workshop session message budget:** Workshop has a 25-message-per-session budget (`workshop-chat.js:34`). The auto-send synthetic primer counts as one message; the user has 24 remaining for their conversation. If post-launch usage shows 24 turns is cramped, the budget constant can be raised — beta data drives the decision.

**Example seed objects:**

```js
// Current Events card seed (Fed decision)
{
  source: 'discover_event',
  sourceId: 'fed_2026-04-29',
  contextBlock: "User is exploring a strategy around the upcoming Fed rate decision on Wednesday April 29 at 2PM ET. Market expects a hold. Key catalysts: dot plot revisions, Powell tone. The user has not yet committed to a directional thesis (dovish/hawkish/in-line).",
  tickerSeed: ["SPY", "TLT", "GLD"],
  metadata: { title: "Fed Rate Decision", timestamp: "2026-04-25T14:00:00Z" }
}

// Themes card seed (AI Infrastructure)
{
  source: 'discover_theme',
  sourceId: 'theme_ai_infra',
  contextBlock: "User is exploring the AI Infrastructure theme. Chain: Chips → Data centers → Power → Cooling. Representative tickers: NVDA, AMD, AVGO, EQIX, DLR, GEV, VST, ETN. Sub-angles: pure compute exposure (NVDA, AMD); power layer (GEV, VST, ETN); cooling and infrastructure (VRT, JCI). User has not selected a specific layer yet.",
  tickerSeed: ["NVDA", "EQIX", "GEV"],
  metadata: { title: "AI Infrastructure", timestamp: "2026-04-25T14:00:00Z" }
}
```

**Pre-generation strategy:**

- **Themes:** `contextBlock` written by hand and stored as part of the evergreen Firestore entry. No runtime generation.
- **Current Events:** `contextBlock` generated by a once-daily Haiku call inside the same DRB downstream pipeline (or piggybacked on the Monday theme promotion cron, regenerated daily for events). Cached on the Firestore document for the day. Cost: ~$0.005/day.
- **Sectors:** Templated. Sector name + top mover tickers slotted into a fixed template string. No LLM call.
- **Signal Drop:** Generated at expansion time as part of the Gemma expansion output (see Signal Drop spec).

---

## 7. Component Architecture

### 7.1 New components

| Component | Purpose | Location |
|---|---|---|
| `DiscoverTab.jsx` | Top-level container for the tab | `src/components/Forge/DiscoverTab.jsx` |
| `DiscoverWeekBanner.jsx` | "Week of April 27" header | `src/components/Forge/DiscoverWeekBanner.jsx` |
| `DiscoverRail.jsx` | Generic horizontal-scroll rail wrapper | `src/components/Forge/DiscoverRail.jsx` |
| `CurrentEventCard.jsx` | Single Current Events card | `src/components/Forge/cards/CurrentEventCard.jsx` |
| `ThemeCard.jsx` | Single Themes card | `src/components/Forge/cards/ThemeCard.jsx` |
| `SectorCard.jsx` | Single Sectors card | `src/components/Forge/cards/SectorCard.jsx` |
| `RecentDropCard.jsx` | Single Recent Drops card (full definition in Signal Drop spec) | `src/components/Forge/cards/RecentDropCard.jsx` |

**Note on file naming:** A deprecated `src/components/Forge/DiscoverTab.jsx` already exists in the codebase (legacy rule-discovery surface). Phase 1 must delete the deprecated file before creating the new one. Verify no remaining imports reference the deprecated file by grepping for `DiscoverTab` across the codebase.

The `cards/` subfolder is a new convention being introduced — current `Forge/` is flat with only `ParamControls/` as a subfolder.

### 7.2 Modified components

| Component | Change |
|---|---|
| `ForgeScreen.jsx` | Rename TABS constant from `[forge, intelCodex, provingGrounds]` to `[lab, discover, architect]`. Update labels accordingly. Add Discover tab between Lab and Architect. Update tab switching logic. Add default-tab computation per Section 2. |
| `useForge.js` | Update default-tab logic (currently hardcoded to `'forge'`) to perform the agents-collection check. |
| `WorkshopChat.jsx` | Accept `workshopSeedContext` prop. Persist seed context in component state for the entire session. Auto-send synthetic primer message on mount when seed context is non-null. Render "Building from:" chip with dismiss. |
| `api/forge/workshop-chat.js` | Accept `workshopSeedContext` in request body. Re-inject into anchorContext on every turn (purely additive — Voice Layer prompt builder already supports per-turn re-injection). |

### 7.3 New API endpoints

| Endpoint | Purpose |
|---|---|
| `/api/discover/current-events` | GET. Returns today's Current Events cards. Joins DRB + sonar utility caches. ~50 lines. |
| `/api/discover/themes` | GET. Returns all themes with `isLiveThisWeek` flag. Reads `discoverThemes` collection. ~30 lines. |
| `/api/discover/sectors` | GET. Returns sectors with weekly performance, with 10-minute server-side cache. ~80 lines. |

### 7.4 New cron

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/promote-discover-themes` | `0 13 * * 1` (Monday 13:00 UTC) | Reads DRB themes, matches to evergreen entries, writes `isLiveThisWeek` flags. ~80 lines. |

**Cron slot count:** 39/40 pre-Phase-1. Phase 1 removes the unused `/api/earnings/resolve-tournament` cron entry from `vercel.json` and its API file (EarningsGame is on hold). Net cron change: −1 + 2 = +1, ending at 40/40.

---

## 8. Firestore Schema

### 8.1 `discoverThemes/{themeId}`

Static collection. Written once via seed script. Updated manually if Flash wants to add or revise themes.

```js
{
  id: 'theme_ai_infra',
  title: 'AI Infrastructure',
  narrative: 'The compute build-out is accelerating across all four layers — chips, data centers, power, and cooling. Each layer has different demand drivers and pricing power.',
  chain: ['Chips', 'Data centers', 'Power', 'Cooling'],
  tickers: ['NVDA', 'AMD', 'AVGO', 'EQIX', 'DLR', 'GEV', 'VST', 'ETN'],
  subAngles: [
    'Pure compute exposure: NVDA, AMD',
    'Power layer: GEV, VST, ETN',
    'Cooling and infrastructure: VRT, JCI'
  ],
  workshopSeedContext: {
    contextBlock: '...',
    tickerSeed: ['NVDA', 'EQIX', 'GEV'],
    metadata: { title: 'AI Infrastructure' }
  },
  isLiveThisWeek: false,                // Flipped by Monday cron
  liveSignalReason: null,               // Populated when live: e.g., "DRB cited 'AI capex' theme"
  displayOrder: 1,                      // Manual ordering
  status: 'active',                     // 'active' | 'archived'
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 8.2 `indexIntelligence/dailyRegimeBrief` (existing, no changes)

Discover reads this for Current Events generation. No schema modifications.

### 8.3 Firestore rules

```
match /discoverThemes/{themeId} {
  allow read: if true;
  allow write: if false;   // Admin SDK only
}
```

Rules need manual deploy via `firebase deploy --only firestore:rules` after Phase 1 changes land.

---

## 9. Data Flow Summary

```
Daily 12:30 UTC:
  DRB cron writes indexIntelligence/dailyRegimeBrief
    ↓
  (Optional) Haiku generates Current Events contextBlocks → cached on the DRB doc

Monday 13:00 UTC:
  Theme promotion cron reads DRB themes → fuzzy-matches evergreens → flips isLiveThisWeek

User opens Discover tab:
  Promise.all([
    GET /api/discover/current-events,    // joins DRB + sonar
    GET /api/discover/themes,             // reads discoverThemes
    GET /api/discover/sectors,            // 10-min cached aggregation
    Firestore query: user's 5 most recent drops  // see Signal Drop spec
  ])
    ↓
  Render rails

User taps "Build a strategy" on a card:
  Card emits workshopSeedContext object (no openingMessage)
    ↓
  Navigate to WorkshopChat with mode='workshop' + seed context
    ↓
  WorkshopChat persists seed context in session state
    ↓
  Auto-sends synthetic primer "Let's build a strategy from this."
    ↓
  Backend re-injects contextBlock into Block 3.5 alongside live DRB anchor
    ↓
  Gemma generates first opener live with full context
    ↓
  Every subsequent turn re-injects contextBlock into Block 3.5
    ↓
  User and Gemma converse → thesis develops → compile → SeasonEntryModal pre-filled

User taps "View all" on Recent Drops rail:
  Open DropHistoryModal (defined in Signal Drop spec)
```

---

## 10. Visual Design Tokens

Adheres to existing design system. Inline styles only, no Tailwind. Framer Motion for animations.

**Colors:**
- Page background: `#0D0E12`
- Card background: `#15171E`
- Card border: `rgba(255, 255, 255, 0.06)`
- Trophy gold (primary CTA): `#F0C75E`
- Teal (technical accents, "Live" pulse): `#5EEAD4`
- Amber (Current Events date pills): `#F59E0B`
- Purple (Themes accent): `#8B5CF6`
- Sector colors: defer to existing `STOCK_UNIVERSE[sectorId].color` palette in codebase

**Typography:**
- Card titles: 16px semibold
- Card body: 13px regular, line-height 1.45
- Meta text (dates, ticker counts): 11px uppercase tracking 0.5px
- Rail headers: 12px uppercase semibold tracking 1px, gray `#8B8E99`

**Animations:**
- Card mount: 200ms fade + 8px slide up, staggered 40ms per card
- "Live this week" pulse: 2s ease-in-out infinite, opacity 0.6 → 1.0
- Tab switch: 250ms ease-out

**Spacing:**
- Rail vertical gap: 24px between rails
- Card horizontal gap: 12px
- Card internal padding: 16px

---

## 11. Implementation Phases

Discovery-first. Hard stops between phases. Standard pattern.

### Phase 0 — Audit (already complete)

Audit findings are integrated into this spec. No additional Phase 0 audit needed.

### Phase 1 — Cleanup pass + tab scaffolding

**Cleanup work first:**
- Remove `/api/earnings/resolve-tournament` from `vercel.json` and delete the API file (EarningsGame is on hold)
- Delete the deprecated `src/components/Forge/DiscoverTab.jsx` after grep confirms no remaining imports
- Rename TABS constant in `ForgeScreen.jsx`: `'forge'` → `'lab'`, `'intelCodex'` → `'architect'`, add `'discover'`. Update labels to "Lab", "Discover", "Architect".
- Grep the codebase for the old tab ID strings (`'forge'`, `'intelCodex'`, `'provingGrounds'`) — excluding legitimate `forge/` directory paths in API/components, only the tab ID literals — and update each reference

**Then tab scaffolding:**
- Create `DiscoverTab.jsx` shell with placeholder rails
- Implement default-tab logic in `useForge.js` (agents-collection existence check)
- No real data wired yet
- Verify on mobile and desktop

**HARD STOP.** Spot-check.

### Phase 2 — Sectors rail (simplest, no LLM)

- Build `/api/discover/sectors` endpoint with 10-min server-side cache
- Build `SectorCard.jsx` and wire to rail
- Aggregate weekly performance from `marketDataCache.js` (last 5 daily closes per ticker, averaged per sector)
- Verify performance numbers match expectations against spot-checked tickers

**HARD STOP.** Spot-check.

### Phase 3 — Themes rail (static + Monday promotion)

- Seed `discoverThemes` collection with Flash-provided 8 entries (one-time script)
- Build `/api/discover/themes` endpoint
- Build `ThemeCard.jsx` with chain visualization
- Build `/api/cron/promote-discover-themes` cron
- Update `firestore.rules` for `discoverThemes` (manual deploy reminder)

**HARD STOP.** Verify Monday promotion fires correctly. May require waiting for next Monday or manual cron trigger to test.

### Phase 4 — Current Events rail (DRB + sonar hybrid)

- Build `/api/discover/current-events` endpoint
- Build `CurrentEventCard.jsx`
- Wire DRB read, sonar utility joins, narrative extraction
- Generate `contextBlock` per event (Haiku call piggybacked on DRB cron or once-daily separate trigger)
- Handle weekend / pre-12:30 UTC empty state with "Updated Monday" footer

**HARD STOP.** Verify cards render correctly across weekday timing edge cases.

### Phase 5 — Workshop handoff

- Modify `WorkshopChat.jsx` to accept `workshopSeedContext` prop
- Persist seed context in component state for the session lifetime
- Auto-send synthetic primer on mount when seed context is non-null
- Render "Building from:" chip with dismiss option
- Modify `api/forge/workshop-chat.js` to accept seed context in body and re-inject on every turn
- Wire all three card types to pass seed context on tap

**Phase 5 explicit verification:**
- Test conversation reaches turn 5 minimum
- Verify Gemma still references the seed context's specific tickers, themes, or invalidation conditions at turn 5
- Verify Block 3.5 is being rebuilt with seed context on every turn (instrument with a debug log if needed)
- Test the dismiss-chip flow: tap dismiss, confirm seed context is no longer injected on subsequent turns

**HARD STOP.** Walk through full flow on each rail end-to-end.

### Phase 6 — Recent Drops rail integration

This phase depends on Signal Drop spec Phase 6 (Recent Drops rail + History modal). Coordinate timing.

- Wire `RecentDropCard.jsx` into Discover tab
- Mount Recent Drops rail at bottom of Discover (5 cards max + "View all →" CTA)
- Wire "View all" CTA to open `DropHistoryModal` (defined in Signal Drop spec)
- Hide rail entirely when user has no drop history

**HARD STOP.** Test rail render with 0, 1, 5, 30+ drops in user's history.

### Phase 7 — Polish + verification

- Animation polish (mount stagger, pulse animation)
- Empty state polish (DRB failure, weekend, sectors with low data)
- Loading states for all endpoints
- Verify mobile + desktop layouts
- Verify default-tab logic across all four user states (new / testing / results / deployed)

---

## 12. Out of Scope

These are explicitly deferred:

- **Personalization of which themes promote.** All users see the same `isLiveThisWeek` flag based on global DRB themes. No per-user theme weighting.
- **Editorial freshness on Current Events.** No human review of the auto-generated event narratives. Trust DRB synthesis.
- **Multi-week event preview.** Only "this week" events shown. Next week's events visible via cards as they fall into the current week.
- **Card analytics in V1.** No tap-tracking dashboard. Shadow logging captures taps for later analysis but no UI surface for this.
- **Editing themes from in-app.** Theme content updated only via Admin/seed scripts. No in-app editor.

---

## 13. Open Items / Risks

These are flagged for awareness during implementation:

- **DRB keyEvents date format.** Sonnet is instructed to prefix with day-of-week (e.g., "Wed FOMC decision"), but this is best-effort. Some keyEvents may not parse cleanly. The endpoint must degrade gracefully — render keyEvent string as title without a structured date pill if parsing fails.
- **Theme matching algorithm.** Fuzzy keyword matching between DRB themes and evergreen titles is hand-wavy. V1 uses simple keyword overlap; if matching quality is poor, escalate to embedding similarity in a future revision.
- **Sectors performance data freshness.** `marketDataCache.js` daily closes may be a day behind during the first hour of market open. Spot-check Sectors rail behavior at market open.

---

## 14. Success Criteria

For ship:

- All three curated rails populate with real data on Discover tab open
- Tapping any "Build a strategy" CTA opens Workshop with pre-seeded context
- Gemma's first response in Workshop reflects the seed context (live-generated, not canned)
- Seed context persists across all turns of a Workshop session — verified by checking that Gemma maintains topic awareness through 5+ turns
- Default tab logic correctly routes new users to Discover, returning users to Lab
- Mobile and desktop layouts both render cleanly
- Cron failure or DRB miss does not break the Discover tab — degraded but functional state
- Recent Drops rail surfaces correctly for users with drop history; "View all" opens the History modal

For post-launch metrics (track but don't gate ship):

- Discover → Workshop conversion rate (% of Discover sessions that result in opening Workshop)
- Card tap distribution across rails (which rail drives most engagement)
- Workshop sessions sourced from Discover that complete to compile (vs. abandon)
- Recent Drops rail tap-through rate (signal for Signal Drop habit formation)

---

## 15. Related Documents

- `FORGE_SIGNAL_DROP_SPEC.md` — Companion document defining Signal Drop. Required for full Discover tab implementation.
- `DAILY_REGIME_BRIEF_TECHNICAL_REFERENCE.md` — DRB architecture, schema, cron timing.
- `FORGE_LANDING_IMPLEMENTATION_REFERENCE.md` — Existing Forge landing patterns and component co-location conventions.
- `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` — Block 3.5 `anchorContext` injection mechanism.
- `PRELAUNCH_SHADOW_LOGGER_HASHING_MIGRATION.md` — Pre-launch cleanup task referenced in shadow logger discussion.

---

## 16. Document Lineage

This is the consolidated final spec. Earlier drafts (V1, V1.1, V1.2-changes) and the Phase 0 audit findings have been integrated. Reasoning behind specific design decisions is preserved in chat history with Flash and the Phase 0 audit report; this document is the forward-looking implementation reference.

Key design decisions reflected here:
- Three peer tabs (Lab / Discover / Architect), tab IDs `'lab'`, `'discover'`, `'architect'`
- Discover as inspiration surface for novices and returning users
- Workshop handoff via shared `workshopSeedContext` schema with auto-sent synthetic primer
- Live Gemma-generated openers, not pre-generated
- Seed context persistence across all turns via stateless prompt rebuild
- Sector compute with 10-min server-side cache
- DRB-daily refresh for Current Events; weekly cadence for Themes/Sectors
- Recent Drops as 5-card rail + dedicated History modal
- 232-stock universe via `STOCK_UNIVERSE` from `rankingConfig.js`

---

*Forge Discover Tab — Implementation Spec (Final)*
*April 25, 2026*
