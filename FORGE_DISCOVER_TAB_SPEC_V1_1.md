# Forge Discover Tab — Design Spec V1.1

**Date:** April 25, 2026
**Status:** Design spec, ready for Claude Code discovery audit
**Prepared by:** Claude (Anthropic), in collaboration with Flash
**Companion document:** `FORGE_SIGNAL_DROP_SPEC_V1_1.md` — Signal Drop is a peer feature that lives at the top of this tab.
**Changelog from V1:** See Section 16.

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
[Laboratory]   [Discover]   [Advanced]
```

**Default-tab logic** (recomputed on every Forge open, not stored as preference):

| User state | Default tab |
|---|---|
| No active experiments AND no deployed strategy | Discover |
| Any active experiment OR deployed strategy | Laboratory |

Advanced is never the default. Tabs are reachable in one tap regardless of default state.

---

## 3. Discover Tab — Layout (Mobile)

Top-to-bottom vertical scroll:

1. **Signal Drop input** (persistent, first-class) — see companion spec
2. **Current Events rail** (horizontal scroll)
3. **Themes rail** (horizontal scroll)
4. **Sectors rail** (horizontal scroll)
5. **Recent Drops rail** (horizontal scroll, 5 cards + "View all" CTA, hidden until first drop) — see companion spec

Week banner appears above the first content rail (Current Events): `Week of April 27`. Format: "Week of {Monday DD}". This signals cadence to returning users without claiming "freshness" that the system doesn't deliver day-to-day.

**Important:** the week banner does not apply to Current Events cards themselves — they refresh daily from DRB. The banner is an envelope for the Themes and Sectors rails, which do refresh weekly. Current Events cards within a given week are dated individually ("WED 2PM") so daily refresh inside the week is visually obvious.

---

## 4. Discover Tab — Layout (Desktop)

Full-width single-column layout for the Discover tab specifically. Rails extend across the viewport because horizontal scrolling for cards needs the width to feel right. Do not use the two-column treatment from the Laboratory tab.

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

Container max-width: 1200px centered. Rails use horizontal scroll with snap points on card boundaries.

---

## 5. The Three Curated Rails

### 5.1 Current Events rail

**Purpose:** "What's happening in the market this week that I could build a strategy around?"

**Data source:** Hybrid (DRB + sonar endpoints)

- Read `indexIntelligence/dailyRegimeBrief` on Discover tab open to get `keyEvents` array (3-6 forward-looking event labels).
- For each `keyEvent`, look up the structured details from existing endpoints:
  - Fed/macro events → `economic-events-sonar` cache
  - Earnings → `earnings-calendar-sonar` cache
- Extract narrative framing for each event from DRB's `dailyBrief` paragraph (the desk-briefing already synthesizes the *why it matters* per event).

**No new cron required.** DRB writes daily at 12:30 UTC. Sonar endpoints already cache (1hr econ, 4hr earnings). The Discover read happens at request time and joins these existing data sources.

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

**Data source:** Evergreen list of 8 Thematic entries (Flash to transfer from prior project) + DRB-driven weekly relevance promotion.

The 8 evergreens (per prior DKB work):
- AI Infrastructure
- Energy Transition
- Reshoring
- Aging Demographics
- Cybersecurity
- Housing Cycle
- Consumer Bifurcation
- Dollar Strength Regimes

**Each Thematic entry's content lives in Firestore** at `discoverThemes/{themeId}` with:
- `id`, `title`, `narrative` (1-2 sentence summary), `chain` (e.g., "Chips → Data centers → Power → Cooling"), `tickers` (5-8 representative names), `subAngles` (2-3 strategy angles per theme), `workshopSeedContext` (the pre-built context block for Workshop — see Section 6 for handoff details)

**Weekly relevance promotion:**

A Monday-only cron at 13:00 UTC (`/api/cron/promote-discover-themes`) reads DRB's `themes` array from the most recent brief and matches against evergreen titles via fuzzy keyword matching (e.g., "AI capex rotation cooling" → match keywords against "AI Infrastructure"). The matched theme is flagged `isLiveThisWeek: true` for the week. Up to 2 themes can be flagged live per week. Unmatched themes default to `isLiveThisWeek: false`.

The rail rendering logic puts `isLiveThisWeek: true` themes first with a small "Live this week" pulse indicator. Other themes follow in their default order.

**Cron slot impact:** +1 slot. Verify current count before merging. If unavailable, fall back to runtime computation on Mondays only.

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

Card dimensions: 280px × 280px. Slightly taller than Current Events to accommodate chain visualization.

### 5.3 Sectors rail

**Purpose:** "Which part of the economy could I focus on?"

**Data source:** Existing 220-stock universe sector tags. No LLM call. No new cron.

Sectors derived from existing universe: Technology, Healthcare, Financials, Energy, Consumer Discretionary, Consumer Staples, Industrials, Materials, Utilities, Real Estate, Communications.

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

Card dimensions: 240px × 240px. Smallest of the three to allow more cards visible per scroll.

**Weekly performance:** Computed at request time from existing stock price data. No cron needed; performance is a single aggregation across the universe filtered by sector tag.

**Cadence:** Performance percentages and top movers refresh on every Discover tab open. The set of sectors itself is static.

### 5.4 Recent Drops rail

**Revised in V1.1.** See companion `FORGE_SIGNAL_DROP_SPEC_V1_1.md` Section 6 for full definition. Brief summary here:

A horizontal rail at the bottom of Discover that surfaces the user's **5 most recent Signal Drops** as cards, with a "View all →" CTA at the end of the rail that opens a dedicated `DropHistoryModal` (the full archive surface).

Each card shows the parsed signal summary, outcome marker (saved as watchlist / built strategy / not yet acted on), and a tap action that reopens the cached Expanded Signal Card for revisit.

**Hidden entirely if user has no drop history.** Once a user makes their first drop, the rail appears.

**Why split into rail + modal:** A horizontal rail of 30+ cards is unusable. The rail is the "recent attention" surface that fits the Discover tab's inspiration model; the modal is the archive that handles power users with hundreds of drops.

**Stale drop handling:** Drops older than 14 days surface a "Market context has shifted" banner on revisit, with options to use the cached expansion or re-expand against current market conditions. See Signal Drop spec Section 6.3 for details.

---

## 6. Workshop Handoff Pattern (Shared Across All Cards)

Every card with a `[Build a strategy →]` CTA passes a `workshopSeedContext` object to AgentChat on mount.

**Schema (V1.1):**
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

**Critical change from V1:** No `openingMessage` field. Gemma generates the first Workshop message live, using the seed context as input. This avoids canned-feeling openers AND ensures the seed context is part of every turn's prompt — not just the first.

**Implementation in AgentChat:**

When AgentChat mounts in `mode='workshop'` with a non-null `workshopSeedContext` prop:

1. **Persist `workshopSeedContext` in component state for the session lifetime.** Every prompt assembled during this session injects `contextBlock` into Block 3.5 (anchorContext), not just the first.
2. The first Gemma turn renders normally — Gemma generates an opener using the seed context as anchor. No synthetic message rendering.
3. Render a small header chip: "Building from: {metadata.title}" with a dismiss option (clears seed context, falls back to free-form Workshop)
4. Pre-fill the first user input placeholder with a contextual nudge (e.g., "Tell Gemma what you want to do with this...")

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

// Signal Drop seed
{
  source: 'signal_drop',
  sourceId: 'drop_abc123',
  contextBlock: `User dropped a signal: Semiconductor sector momentum.
Thesis: AI demand is driving a sustained rotation into semis...
Driver: Hyperscaler capex commitments running into Q3...
Related tickers: NVDA, AMD, AVGO, TSM, ARM, MRVL, AMAT, KLAC
Invalidation: Hyperscaler capex cuts; memory pricing turns negative; antitrust on INTC/MU
Source extracted text: <USER_SIGNAL_CONTENT>INTC and MU absolutely ripping this month...</USER_SIGNAL_CONTENT>`,
  tickerSeed: ["NVDA", "AMD", "AVGO", "TSM", "ARM"],
  metadata: { title: "Signal: Semiconductor sector momentum", timestamp: "2026-04-25T14:00:00Z" }
}
```

**Pre-generation strategy (V1.1):**

- **Themes:** `contextBlock` written by hand and stored as part of the evergreen Firestore entry. No runtime generation.
- **Current Events:** `contextBlock` generated by a once-daily Haiku call inside the same DRB downstream pipeline (or piggybacked on the Monday theme promotion cron, regenerated daily for events). Cached on the Firestore document for the day. Cost: ~$0.005/day.
- **Sectors:** Templated. Sector name + top mover tickers slotted into a fixed template string. No LLM call.
- **Signal Drop:** Generated at expansion time as part of the Gemma expansion output (see companion spec).

**Why no pre-generated `openingMessage` anywhere:** Gemini's review correctly flagged that pre-generated openers feel canned and give Gemma less coherent context for follow-up turns. Live generation against persistent seed context produces better feel AND better continuity. The cost difference (~$0.005 per session) is trivial.

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

### 7.2 Modified components

| Component | Change |
|---|---|
| `ForgeScreen.jsx` (or wherever the tab pills live) | Add Discover tab between Laboratory and Advanced. Update tab switching logic. Add default-tab computation. |
| `AgentChat.jsx` | Accept `workshopSeedContext` prop. **Persist seed context in component state for the entire session.** Every prompt during the session injects `contextBlock` into Block 3.5. Show "Building from:" chip with dismiss. |
| `api/agent/chat.js` | Accept `workshopSeedContext` in request body. Inject `contextBlock` into Voice Layer prompt assembly on every turn for the session, not just first. |
| `api/_utils/voiceLayerPrompt.js` | Confirm/extend Block 3.5 (anchorContext) injection slot. Phase 0 audit verifies this slot can hold seed context across all turns. If current implementation only injects once, that's a separate fix needed. |

### 7.3 New API endpoints

| Endpoint | Purpose |
|---|---|
| `/api/discover/current-events` | GET. Returns today's Current Events cards. Joins DRB + sonar caches. ~50 lines. |
| `/api/discover/themes` | GET. Returns all themes with `isLiveThisWeek` flag. Reads `discoverThemes` collection. ~30 lines. |
| `/api/discover/sectors` | GET. Returns sectors with weekly performance. Aggregates over universe. ~70 lines. |

### 7.4 New cron

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/promote-discover-themes` | `0 13 * * 1` (Monday 13:00 UTC) | Reads DRB themes, matches to evergreen entries, writes `isLiveThisWeek` flags. ~80 lines. |

**Cron slot count:** Was 39/40 at last check. This adds 1 → 40/40. If a slot is unavailable, alternative is to compute promotion at request time on Mondays only (read DRB live, match, return flags) — slightly higher request-time cost, no cron slot used. Decide based on slot availability at implementation time.

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
  workshopSeedContext: { ... },         // V1.1: contextBlock + tickerSeed + metadata, NO openingMessage
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

Rules need manual deploy via Firebase Console after Claude Code lands the change.

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
    GET /api/discover/sectors,            // aggregates universe
    Firestore query: user's 5 most recent drops  // see Signal Drop spec
  ])
    ↓
  Render rails

User taps "Build a strategy" on a card:
  Card emits workshopSeedContext object (no openingMessage)
    ↓
  Navigate to AgentChat with mode='workshop' + seed context
    ↓
  AgentChat persists seed context in session state
    ↓
  Gemma generates first opener live with contextBlock as anchor
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
- Sector colors: defer to existing sector color palette in codebase

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

**Note on relationship to Signal Drop spec phases:** The Discover tab and Signal Drop are tightly coupled but can ship in coordinated phases. Recommended sequencing: Phase 0 audit covers both specs simultaneously. After audit, ship Discover Phases 1-4 first (curated rails), then Signal Drop Phases 1-7, then Discover Phase 5 (Workshop handoff wiring) and Phase 6 (Recent Drops rail integration). This keeps each phase focused and testable.

### Phase 0 — Discovery audit (read-only)

Files to audit (combined with Signal Drop spec audit):
- `src/components/Forge/ForgeLanding.jsx` (or wherever current tabs live)
- `src/components/Agent/AgentChat.jsx`
- `api/agent/chat.js`
- `api/_utils/voiceLayerPrompt.js`
- `api/cron/compute-daily-regime-brief.js`
- `api/economic-events-sonar.js`, `api/earnings-calendar-sonar.js`
- `vercel.json` (cron slot count verification)
- Firestore index file (`firestore.indexes.json`)
- Stock universe canonical list location and structure

**Report:** (a) Current tab structure and tab-switching mechanism. (b) AgentChat mount lifecycle and prop flow. (c) **Voice Layer prompt assembly — confirm `anchorContext` (Block 3.5) injection point CAN persist across all turns of a session, not just the first turn. This is critical for the Workshop handoff to work correctly.** (d) DRB output schema (already documented). (e) Sonar endpoint cache shape. (f) Current cron slot count. (g) Stock universe sector tag location and structure.

**HARD STOP. Wait for approval.**

### Phase 1 — Tab scaffolding + empty Discover

- Add Discover tab between Laboratory and Advanced
- Implement default-tab logic (recomputed on every Forge open)
- Create `DiscoverTab.jsx` shell with placeholder rails
- No real data wired yet
- Verify on mobile and desktop

**HARD STOP.** Spot-check.

### Phase 2 — Sectors rail (simplest, no LLM)

- Build `/api/discover/sectors` endpoint
- Build `SectorCard.jsx` and wire to rail
- Aggregate weekly performance from existing universe data
- Verify performance numbers match expectations

**HARD STOP.** Spot-check.

### Phase 3 — Themes rail (static + Monday promotion)

- Seed `discoverThemes` collection with Flash-provided 8 entries (one-time script)
- Build `/api/discover/themes` endpoint
- Build `ThemeCard.jsx` with chain visualization
- Build `/api/cron/promote-discover-themes` cron (or runtime fallback if slot unavailable)
- Update `firestore.rules` for `discoverThemes` (manual deploy reminder)

**HARD STOP.** Verify Monday promotion fires correctly. May require waiting for next Monday or manual cron trigger to test.

### Phase 4 — Current Events rail (DRB + sonar hybrid)

- Build `/api/discover/current-events` endpoint
- Build `CurrentEventCard.jsx`
- Wire DRB read, sonar joins, narrative extraction
- Generate `contextBlock` per event (Haiku call piggybacked on DRB cron or once-daily separate trigger)
- Handle weekend / pre-12:30 UTC empty state with "Updated Monday" footer

**HARD STOP.** Verify cards render correctly across weekday timing edge cases.

### Phase 5 — Workshop handoff (no openingMessage)

- Modify `AgentChat.jsx` to accept `workshopSeedContext` prop
- **Persist seed context in component state for the session lifetime**
- Modify `api/agent/chat.js` to accept seed context in body and re-inject on every turn
- Modify `api/_utils/voiceLayerPrompt.js` to extend Block 3.5 to include seed context across all turns
- Wire all three card types to pass seed context on tap
- Verify Gemma generates live opener using seed context AND seed context persists through turn 5+

**HARD STOP.** Walk through full flow on each rail end-to-end. Test multi-turn conversations to verify seed context doesn't drop.

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

## 12. Out of Scope (V1.1)

These are explicitly deferred:

- **Personalization of which themes promote.** All users see the same `isLiveThisWeek` flag based on global DRB themes. No per-user theme weighting.
- **Editorial freshness on Current Events.** No human review of the auto-generated event narratives. Trust DRB synthesis.
- **Multi-week event preview.** Only "this week" events shown. Next week's events visible via cards as they fall into the current week.
- **Card analytics in V1.** No tap-tracking dashboard. Shadow logging captures taps for later analysis but no UI surface for this.
- **Editing themes from in-app.** Theme content updated only via Admin/seed scripts. No in-app editor.

---

## 13. Open Items / Risks

These are flagged for discussion but do not block Phase 0 audit:

- **Cron slot count.** 39/40 was the most recent count. If 40/40, the Theme promotion cron must move to runtime computation. Decide at audit time.
- **Theme matching algorithm.** Fuzzy keyword matching between DRB themes and evergreen titles is hand-wavy. V1 starts with simple keyword overlap; if matching quality is poor, escalate to embedding similarity in V2.
- **Sector top-mover computation.** Need to verify the existing universe data has fast access to weekly returns per ticker. If not, may need a small precompute step.
- **DRB doc may not include `keyEvents` with dates.** Current DRB schema stores `keyEvents` as strings like "Wed FOMC decision". Discover needs to parse the day-of-week back into a date. Possible failure mode if DRB writes ambiguous dates. Audit Phase 4 should verify.
- **Block 3.5 persistence semantics.** Phase 0 audit must confirm seed context CAN be re-injected on every turn of a Workshop session. If current implementation only allows first-turn injection, that's a separate fix needed before Phase 5 can ship correctly.

---

## 14. Success Criteria

For V1.1 ship:

- All three curated rails populate with real data on Discover tab open
- Tapping any "Build a strategy" CTA opens Workshop with pre-seeded context
- Gemma's first response in Workshop reflects the seed context (live-generated, not canned)
- Seed context persists across all turns of a Workshop session — verified by checking that Gemma maintains topic awareness through 5+ turns
- Default tab logic correctly routes new users to Discover, returning users to Laboratory
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

- `FORGE_SIGNAL_DROP_SPEC_V1_1.md` — Companion document defining Signal Drop. Required for full Discover tab implementation.
- `DAILY_REGIME_BRIEF_TECHNICAL_REFERENCE.md` — DRB architecture, schema, cron timing.
- `FORGE_LANDING_IMPLEMENTATION_REFERENCE.md` — Existing Forge landing patterns and component co-location conventions.
- `VOICE_LAYER_PROMPT_CONSTRUCTION_GUIDE.md` — Block 3.5 `anchorContext` injection mechanism.
- `CONVERSATION_TO_RULE_PIPELINE_SPEC_V1.docx` — Workshop Mode original spec (now shipped). Reference for `mode='workshop'` semantics in chat.js.

---

## 16. Changelog from V1

Aligns with Signal Drop spec V1.1 changes that affect this document:

| # | Change | Section | Reason |
|---|---|---|---|
| 1 | Recent Drops rail revised: 5 cards in rail + "View all" CTA opening dedicated `DropHistoryModal` for full archive. | 5.4, 7.1 | Gemini review on V1 Signal Drop: 30 cards in horizontal rail is bad UX |
| 2 | `workshopSeedContext` schema removes `openingMessage` field. Gemma generates first opener live. | 6 | Avoids canned-feeling openers; ensures seed context persists across all turns |
| 3 | Workshop handoff explicitly persists seed context for session lifetime. Block 3.5 re-injects on every turn. | 6, 7.2, 11 (Phase 5) | Prevents Gemma drift / context loss by turn 3+ |
| 4 | Phase 5 success criteria explicitly tests multi-turn seed persistence. | 11, 14 | Ensures the persistence change is actually verified at ship |
| 5 | Phase 0 audit explicitly checks Block 3.5 supports per-turn injection. | 11 (Phase 0), 13 | Surfaces the persistence question early, not at Phase 5 |
| 6 | Stale drop revisits handled with "Market context shifted" banner (cross-reference to Signal Drop spec). | 5.4 | Soft prompt rather than hard expiration; preserves per-user moat narrative |

---

*Forge Discover Tab — Design Spec V1.1*
*April 25, 2026*
*Aligned with Signal Drop spec V1.1*
