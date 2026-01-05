# BaggerBomb Battle View Architecture Analysis

**Generated:** January 2, 2026
**Purpose:** Inform redesign of the BaggerBomb Battle View
**Scope:** Current classic battle view, BaggerBomb components, services, and Firebase schema

---

## 1. Executive Summary

The TradeSeven codebase has **two parallel battle systems**:

1. **Classic Battle View** (V1): A percentage-comparison system embedded directly in `App.jsx` (lines 29681-30400+). It calculates simple portfolio gain percentages and displays them in a "YOU vs OPP" split-screen layout.

2. **BaggerBomb Scoring** (V2): A session-based scoring system with components in `/src/components/BaggerBomb/`. It introduces breakout thresholds, conviction multipliers, substitution windows, and per-session scoring. Components exist but the battle view integration in `App.jsx` is minimal.

**Current State:** Classic battle view is fully functional and renders inline. BaggerBomb components are ~85% complete but lack full integration with live data polling and the routing in `App.jsx` only checks for `_v === 2` without comprehensive view switching.

---

## 2. Classic Battle View Analysis

### 2.1 Location and Structure

**File:** `src/App.jsx`
**Lines:** 29681-30400+ (inline render block)

```javascript
// BATTLE VIEW SCREEN - ESPN STYLE REDESIGN
if (screen === 'battle' && currentBattle) {
  // Line 29681
}
```

### 2.2 State Variables

| Variable | Type | Purpose | Location |
|----------|------|---------|----------|
| `currentBattle` | Object | Active battle document | App state (line 11236) |
| `battlePrices` | Object | Map of symbol → current price | App state (line 11257) |
| `loadingBattlePrices` | Boolean | Loading state for prices | App state (line 11258) |
| `battleViewTab` | String | 'yours' \| 'opponent' mobile toggle | App state (line 11280) |
| `myGain` / `theirGain` | Number | Calculated % gain | Local calculation (lines 29702-29703) |

### 2.3 Price Calculation Logic

```javascript
// Lines 29688-29706
let myValue = 0;
myPortfolio.forEach(asset => {
  const shares = asset.amount / asset.price;  // Shares from initial allocation
  const currentPrice = battlePrices[asset.symbol] || asset.price;
  myValue += shares * currentPrice;
});

const myGain = ((myValue - 1000000) / 1000000) * 100;  // Assumes $1M starting
```

### 2.4 Timer Logic

Uses `battleTimer.formatTimeRemaining(currentBattle)` from `/src/services/battleTimer.js` (line 29858).

### 2.5 UI Components (Inline)

| Section | Lines | Description |
|---------|-------|-------------|
| Header | 29791-29860 | Back button, leading/trailing indicator, time remaining |
| Training Badge | 29863-29878 | Purple banner for training battles |
| Comparison Card | 29886-30048 | YOU vs OPP avatars, percentage scores, progress bar |
| Portfolio Lists | 30050+ | Side-by-side asset cards with highlighting |

### 2.6 Asset Highlighting Logic

```javascript
// Lines 29724-29775 - getAssetBorderStyle()
// Top 3 positive gains: Green border
// Top 3 negative: Red border
// Smallest positive (laggard): Orange border
```

---

## 3. BaggerBomb Components Audit

### 3.1 Component Inventory

| Component | File | Completeness | Notes |
|-----------|------|--------------|-------|
| `BaggerBombBattleView` | `/src/components/BaggerBomb/BaggerBombBattleView.jsx` | **90%** | Main container, has price polling, breakout detection, tab switching |
| `BaggerBombScoreboard` | `/src/components/BaggerBomb/BaggerBombScoreboard.jsx` | **95%** | Total scores + session breakdown grid, LIVE badge |
| `SessionScoreCard` | `/src/components/BaggerBomb/SessionScoreCard.jsx` | **100%** | Individual session display with win/loss/tie states |
| `BreakoutFeed` | `/src/components/BaggerBomb/BreakoutFeed.jsx` | **95%** | Live event feed with type badges and time ago |
| `AssetPerformanceRow` | `/src/components/BaggerBomb/AssetPerformanceRow.jsx` | **95%** | Progress bar toward threshold, breakout level labels |
| `SubstitutionPanel` | `/src/components/BaggerBomb/SubstitutionPanel.jsx` | **90%** | Window timer, asset selection, confirm flow |
| `PortfolioBuilderBaggerBomb` | `/src/components/BaggerBomb/PortfolioBuilderBaggerBomb.jsx` | **85%** | Pre-battle portfolio + bench selection |
| `BenchSelector` | `/src/components/BaggerBomb/BenchSelector.jsx` | **80%** | Bench slot management |
| `ThresholdPreview` | `/src/components/BaggerBomb/ThresholdPreview.jsx` | **100%** | Displays volatility thresholds for selected assets |

### 3.2 BaggerBombBattleView Deep Dive

**File:** `/src/components/BaggerBomb/BaggerBombBattleView.jsx` (420 lines)

**Props:**
```typescript
{
  battle: Object,      // Battle document from Firestore
  user: Object,        // Current user { uid, username }
  onSubstitute: Func,  // Callback for substitutions
  onBack: Func         // Navigation callback
}
```

**State:**
```javascript
activeTab: 'yours' | 'opponent'
currentPrices: { [symbol]: number }
loadingPrices: boolean
detectedBreakouts: Array
timeRemaining: { hours, minutes } | null
```

**Key Features Implemented:**
- Price polling every 60 seconds (line 22: `PRICE_POLL_INTERVAL = 60000`)
- Separates stock vs crypto symbols for API calls (lines 84-92)
- Breakout detection via `checkPortfolioBreakouts()` (lines 126-171)
- Session time remaining countdown (lines 195-204)
- Combines Firebase breakouts with locally detected ones (lines 214-230)

**Missing/Incomplete:**
- No live session transition handling (relies on Firebase state)
- No notification triggers for breakout events
- No animations for score changes

### 3.3 BaggerBombScoreboard Deep Dive

**File:** `/src/components/BaggerBomb/BaggerBombScoreboard.jsx` (276 lines)

**Features:**
- Calculates totals from `battle.sessionScores` (lines 30-56)
- 2x2 grid of `SessionScoreCard` components (lines 180-198)
- LIVE badge with pulsing animation (lines 76-87)
- Lead indicator text (lines 144-165)
- Battle result display when completed (lines 202-261)

### 3.4 BreakoutFeed Deep Dive

**File:** `/src/components/BaggerBomb/BreakoutFeed.jsx` (196 lines)

**Breakout Types Displayed:**
| Type | Emoji | Color | Points |
|------|-------|-------|--------|
| BREAKOUT | :dart: | #10b981 | +15 |
| RALLY | :rocket: | #f59e0b | +30 |
| MOONSHOT | :crescent_moon: | #8b5cf6 | +50 |
| BUST | :chart_with_downwards_trend: | #ef4444 | -10 |
| CRASH | :boom: | #dc2626 | -20 |
| MELTDOWN | :fire: | #991b1b | -35 |

**Features:**
- Sorts by timestamp (newest first)
- Max 5 items by default
- "Your pick" vs "Opponent" labels
- Time ago formatting

---

## 4. Services API Reference

### 4.1 sessionScoringService.js

**File:** `/src/services/sessionScoringService.js` (679 lines)

**Session Definitions:**
```javascript
SESSIONS = {
  MORNING_BELL: { start: 9:30, end: 11:30, allowsStocks: true, allowsCrypto: true },
  MIDDAY:       { start: 11:30, end: 14:00, allowsStocks: true, allowsCrypto: true },
  POWER_HOUR:   { start: 14:00, end: 16:00, allowsStocks: true, allowsCrypto: true },
  NIGHT_GAME:   { start: 16:00, end: 20:00, allowsStocks: false, allowsCrypto: true }
}
```

**Scoring Constants:**
```javascript
POINTS_PER_PERCENT = 10
CONVICTION_TIERS = [
  { min: 15.1%, max: 100%, multiplier: 1.30 },
  { min: 10.1%, max: 15%, multiplier: 1.15 },
  { min: 0%,    max: 10%, multiplier: 1.00 }
]
BREAKOUT_BONUSES = { BREAKOUT: 15, RALLY: 30, MOONSHOT: 50 }
BUST_PENALTIES = { BUST: -10, CRASH: -20, MELTDOWN: -35 }
SESSION_BONUSES = { SESSION_WIN: 10, GREEN_SWEEP: 20, CLEAN_SWEEP: 30 }
```

**Exported Functions:**
| Function | Signature | Purpose |
|----------|-----------|---------|
| `isCrypto` | `(symbol: string) => boolean` | Check if symbol is cryptocurrency |
| `getCurrentSession` | `() => Session \| null` | Get active session based on ET time |
| `getSessionTimeRemaining` | `(sessionId?) => { hours, minutes } \| 0` | Time until session ends |
| `getConvictionMultiplier` | `(allocationPercent: number) => number` | Get multiplier tier |
| `calculateBasePoints` | `(percentChange, allocation) => number` | Base points calculation |
| `calculateBreakoutBonuses` | `(percentChange, thresholds) => { bonuses, totalBonus }` | Stacking bonus calculation |
| `calculateBustPenalties` | `(percentChange, thresholds) => { penalties, totalPenalty }` | Stacking penalty calculation |
| `calculateAssetSessionScore` | `(asset, openPrice, closePrice, thresholds, totalValue) => Object` | Full asset scoring |
| `calculateSessionScore` | `(portfolio, openPrices, closePrices, thresholds, sessionId) => Object` | Portfolio session total |
| `compareSessionScores` | `(playerScore, opponentScore) => Object` | Determine session winner |
| `getPortfolioThresholds` | `(portfolio) => Promise<Object>` | Fetch thresholds for all assets |

### 4.2 breakoutDetectionService.js

**File:** `/src/services/breakoutDetectionService.js` (593 lines)

**Exported Functions:**
| Function | Signature | Purpose |
|----------|-----------|---------|
| `detectBreakouts` | `(symbol, openPrice, currentPrice, thresholds, existing, sessionId) => Breakout[]` | Single asset detection |
| `checkPortfolioBreakouts` | `(portfolio, openPrices, currentPrices, thresholds, existing, sessionId) => Breakout[]` | Full portfolio scan |
| `getBreakoutSummary` | `(breakouts) => { positive, negative, netPoints, byType, bySymbol }` | Statistics |
| `formatBreakoutNotification` | `(breakout, isYours) => NotificationObject` | For push notifications |
| `getBreakoutsForSession` | `(breakouts, sessionId) => Breakout[]` | Filter by session |
| `getHighestBreakout` | `(breakouts, symbol, sessionId) => Breakout \| null` | Get peak event |

### 4.3 volatilityService.js

**File:** `/src/services/volatilityService.js` (394 lines)

**Features:**
- 7-day localStorage cache with memory cache overlay
- Default thresholds for 40+ stocks and 30+ crypto
- API fallback with retry logic

**Exported Functions:**
| Function | Signature | Purpose |
|----------|-----------|---------|
| `getVolatilityThresholds` | `(symbols[], type) => Promise<{ [symbol]: ThresholdData }>` | Batch fetch |
| `getThreshold` | `(symbol, type) => Promise<ThresholdData>` | Single symbol |
| `refreshThresholds` | `(symbols[], type) => Promise<Object>` | Force refresh |
| `preloadThresholds` | `(stocks[], crypto[]) => Promise<void>` | Warm cache |
| `clearThresholdCache` | `() => void` | Clear all cached data |

**Threshold Data Shape:**
```javascript
{
  symbol: 'AAPL',
  threshold: 2.0,           // Base breakout %
  rallyThreshold: 3.0,      // 1.5x base
  moonshotThreshold: 4.0,   // 2.0x base
  bustThreshold: 2.0,       // Same as base
  crashThreshold: 3.0,
  meltdownThreshold: 4.0,
  isDefault: boolean
}
```

### 4.4 priceSnapshotService.js

**File:** `/src/services/priceSnapshotService.js` (653 lines)

**Purpose:** Capture prices at session boundaries for accurate scoring

**Exported Functions:**
| Function | Signature | Purpose |
|----------|-----------|---------|
| `getBattleSymbols` | `(battle) => string[]` | Extract all symbols from battle |
| `captureSessionPrices` | `(battleId, sessionKey, 'open'\|'close', symbols) => Promise<Object>` | Capture and store |
| `checkSessionPriceStatus` | `(battle, sessionKey) => { hasOpen, hasClose, needsOpen, needsClose }` | Check what's captured |
| `initializeBattlePrices` | `(battleId, symbols) => Promise<Object>` | Set up when opponent joins |
| `processSessionTransition` | `(battleId) => Promise<{ currentSession, previousSession, battle }>` | Handle session change |
| `getSessionBoundaries` | `(date?) => Object` | Get all boundary times |
| `checkSessionBoundary` | `() => { atBoundary, boundaryType, sessionId }` | Check if at boundary |

### 4.5 substitutionService.js

**File:** `/src/services/substitutionService.js` (706 lines)

**Substitution Windows:**
```javascript
Window 1: 11:30 AM - 11:45 AM ET (after MORNING_BELL)
Window 2: 2:00 PM - 2:15 PM ET (after MIDDAY)
```

**Rules:**
```javascript
SUBSTITUTION_RULES = {
  MAX_SUBS_PER_BATTLE: 2,
  MAX_SUBS_PER_WINDOW: 1,
  BENCH_SLOTS: { stocks: 4, crypto: 1, total: 5 }
}
```

**Exported Functions:**
| Function | Signature | Purpose |
|----------|-----------|---------|
| `getCurrentSubstitutionWindow` | `() => WindowInfo \| null` | Check if window is open |
| `getNextSubstitutionWindow` | `() => WindowInfo` | When is next window |
| `getRemainingSubstitutions` | `(battle, playerId) => { remaining, used, canUseWindow1, canUseWindow2 }` | Player's sub count |
| `validateSubstitution` | `(battle, playerId, outSymbol, inSymbol, windowNum) => { valid, error? }` | Validate swap |
| `executeSubstitution` | `(battleId, battle, playerId, out, in, window, prices) => Promise<Object>` | Execute and persist |
| `validateBench` | `(bench) => { valid, error? }` | Check bench composition |
| `getSubstitutionStatus` | `(battle, playerId) => { status, message, currentWindow, nextWindow }` | UI-ready status |

---

## 5. Firebase Schema

### 5.1 V1 Classic Battle Schema

```javascript
// createBattle() - Line 66-128 of firebaseService.js
{
  _v: 1,
  challengeCode: 'ABCD',

  creator: {
    uid: 'firebase-uid',
    username: 'Player1',
    portfolioName: 'My Portfolio',
    portfolio: [{ symbol, name, price, amount }],
    portfolioType: 'stocks'
  },

  opponent: { uid, username, portfolioName, portfolio, portfolioType },

  timeline: {
    createdAt: ISO,
    startDate: ISO,  // Set when opponent joins
    endDate: ISO,    // 24 hours later
    completedAt: ISO
  },

  state: {
    status: 'waiting' | 'active' | 'completed',
    currentDay: 0,
    startingPrices: { [symbol]: price },
    endingPrices: { [symbol]: price }
  },

  result: null | { winner, margin, ... },
  archived: false
}
```

### 5.2 V2 BaggerBomb Battle Schema

```javascript
// createBaggerBombBattle() - Lines 690-831 of firebaseService.js
{
  _v: 2,  // Schema version marker
  challengeCode: 'ABCD',

  creator: {
    uid: 'firebase-uid',
    username: 'Player1',
    portfolioName: 'BaggerBomb Portfolio',
    portfolioType: 'stocks',
    portfolio: [{ symbol, name, price, amount, position: 'long'|'short' }],
    bench: [{ symbol, name, price, amount: 0, position }],
    cryptoAllocation: 10  // Fixed 10%
  },

  opponent: { uid, username, portfolioName, portfolioType, portfolio, bench, cryptoAllocation },

  timeline: {
    createdAt: ISO,
    startDate: ISO,    // 9:30 AM ET on market day
    endDate: ISO,      // 8:00 PM ET same day
    completedAt: ISO
  },

  state: {
    status: 'waiting' | 'active' | 'completed',
    currentSession: 'MORNING_BELL' | 'MIDDAY' | 'POWER_HOUR' | 'NIGHT_GAME' | '',
    completedSessions: ['MORNING_BELL', 'MIDDAY'],
    startingPrices: { [symbol]: price }
  },

  // Session price snapshots
  sessionPrices: {
    MORNING_BELL: {
      open: { [symbol]: price },
      close: { [symbol]: price },
      capturedAt: { open: ISO, close: ISO }
    },
    MIDDAY: { ... },
    POWER_HOUR: { ... },
    NIGHT_GAME: { ... }
  },

  // Volatility thresholds locked at creation
  thresholds: {
    AAPL: { threshold: 2.0, rallyThreshold: 3.0, moonshotThreshold: 4.0 },
    BTC: { threshold: 5.0, rallyThreshold: 7.5, moonshotThreshold: 10.0 }
  },

  // Breakout event logs
  breakouts: {
    creator: [{ id, type, symbol, sessionId, percentChange, points, timestamp }],
    opponent: [...]
  },

  // Substitution history
  substitutions: [{
    id: 'sub_...',
    playerId: 'creator',
    window: 1,
    outSymbol: 'AAPL',
    inSymbol: 'GOOGL',
    outPrice: 150.00,
    inPrice: 125.00,
    timestamp: 1234567890
  }],

  // Per-session scores
  sessionScores: {
    MORNING_BELL: { creator: 45, opponent: 32, winner: 'creator' },
    MIDDAY: { creator: 0, opponent: 0, winner: '' },
    POWER_HOUR: { creator: 0, opponent: 0, winner: '' },
    NIGHT_GAME: { creator: 0, opponent: 0, winner: '' }
  },

  result: {
    winner: 'creator' | 'opponent' | 'tie',
    margin: 25,
    creatorTotal: 120,
    opponentTotal: 95,
    cleanSweep: false
  },

  metadata: { tags: ['baggerbomb-scoring', 'v2'] },
  archived: false
}
```

### 5.3 Key Schema Differences

| Feature | V1 Classic | V2 BaggerBomb |
|---------|------------|---------------|
| Scoring | % portfolio gain | Session-based points |
| Duration | 24 hours continuous | 9:30 AM - 8:00 PM market day |
| Sessions | None | 4 sessions (Morning, Midday, Power Hour, Night) |
| Bench | No | 5 slots (4 stocks + 1 crypto) |
| Substitutions | No | 2 max, in 15-min windows |
| Thresholds | No | Per-asset volatility-based |
| Breakouts | No | 6 types with point bonuses/penalties |
| Position Types | Long only | Long or Short |

---

## 6. Routing/Navigation Analysis

### 6.1 Version Detection

**File:** `App.jsx` Line 10598-10599
```javascript
// Helper to check if battle is BaggerBomb (V2) format
const isBaggerBombBattle = (battle) => battle?._v === 2;
```

### 6.2 Current Battle View Routing

The classic battle view is rendered directly in `App.jsx` when:
```javascript
if (screen === 'battle' && currentBattle) {
  // Render inline battle view (lines 29681-30400+)
}
```

### 6.3 BaggerBomb Check Points

**Dashboard Battle Cards (Line 19334):**
```javascript
if (battle._v === 2) {
  // Show "BaggerBomb" badge on card
}
```

**Battle Card Badge (Line 19359):**
```javascript
{battle._v === 2 && (
  <span style={{ ... }}>BaggerBomb</span>
)}
```

### 6.4 Missing Integration

There is **NO routing logic** that switches between Classic and BaggerBomb battle views. The `BaggerBombBattleView` component exists but is not conditionally rendered in the battle screen.

**Recommended Fix:**
```javascript
if (screen === 'battle' && currentBattle) {
  if (isBaggerBombBattle(currentBattle)) {
    return <BaggerBombBattleView
      battle={currentBattle}
      user={user}
      onSubstitute={handleSubstitute}
      onBack={() => setScreen('dashboard')}
    />;
  }
  // ... existing Classic battle view
}
```

---

## 7. Gap Analysis

### 7.1 What's Missing

| Gap | Severity | Notes |
|-----|----------|-------|
| View switching logic | **High** | No `isBaggerBombBattle()` check in battle screen render |
| Session transition handler | **High** | Need polling/listener for session changes |
| Breakout notifications | **Medium** | `formatBreakoutNotification()` exists but not wired to UI |
| Substitution flow | **Medium** | Panel exists but `onSubstitute` callback not implemented in App |
| Score calculation orchestration | **Medium** | Services exist but no orchestration layer |
| Real-time price sync | **Medium** | `BaggerBombBattleView` polls but doesn't update Firebase |
| Battle completion | **High** | No handler for when all sessions complete |

### 7.2 What's Reusable

| Item | Reusability | Notes |
|------|-------------|-------|
| `BaggerBombScoreboard` | **95%** | Ready to use, just needs battle data |
| `SessionScoreCard` | **100%** | Fully functional |
| `BreakoutFeed` | **95%** | Ready, needs breakout data passed in |
| `AssetPerformanceRow` | **95%** | Works with current prices |
| `SubstitutionPanel` | **90%** | Needs `onSubstitute` wiring |
| `sessionScoringService` | **100%** | All calculation functions ready |
| `breakoutDetectionService` | **100%** | Detection logic complete |
| `volatilityService` | **100%** | Caching and fetching complete |
| `priceSnapshotService` | **80%** | Session capture ready, needs orchestration |
| `substitutionService` | **90%** | Execution ready, needs UI integration |

### 7.3 What Needs New Development

1. **Battle View Router** - Conditional rendering based on `_v`
2. **Session Orchestration Layer** - Manage session transitions, price captures, score calculations
3. **Real-time State Sync** - Update Firebase with live scores during sessions
4. **Notification Integration** - Wire breakout events to notification system
5. **Substitution Handler** - Connect panel to `executeSubstitution()` service
6. **Battle Completion Flow** - Detect all sessions complete, calculate final result

---

## 8. Recommended Architecture

### 8.1 Proposed Component Hierarchy

```
App.jsx
├── screen === 'battle' && currentBattle
│   ├── if (_v === 2) → <BaggerBombBattleView />
│   │   ├── <BaggerBombScoreboard />
│   │   │   └── <SessionScoreCard /> x4
│   │   ├── <SubstitutionPanel /> (conditional on window)
│   │   ├── <BreakoutFeed />
│   │   └── <AssetPerformanceRow /> x N
│   │
│   └── else → Classic Battle View (inline)
│
├── useBaggerBombBattle() hook (NEW)
│   ├── Manages price polling
│   ├── Detects session transitions
│   ├── Calculates live scores
│   ├── Triggers breakout detection
│   └── Syncs state to Firebase
│
└── BaggerBombOrchestrator (NEW service layer)
    ├── processSessionTransition()
    ├── calculateAndPersistScores()
    ├── handleBreakoutEvents()
    └── completeBattle()
```

### 8.2 Proposed Data Flow

```
1. User enters battle screen
   ↓
2. Check battle._v
   ├── V1 → Classic inline render
   └── V2 → Mount BaggerBombBattleView
        ↓
3. useBaggerBombBattle() hook initializes
   ├── Subscribe to battle doc (real-time)
   ├── Start price polling (60s interval)
   └── Start session timer (1s interval)
        ↓
4. On price update:
   ├── Check for breakouts
   ├── Calculate live session scores
   └── Update local state (optimistic)
        ↓
5. On session boundary:
   ├── Capture close prices
   ├── Persist session scores
   ├── Start new session
   └── Capture open prices
        ↓
6. On substitution window:
   └── Enable SubstitutionPanel
        ↓
7. On final session complete:
   ├── Calculate final totals
   ├── Determine winner
   └── Persist battle.result
```

### 8.3 New Files Needed

| File | Purpose |
|------|---------|
| `hooks/useBaggerBombBattle.js` | Main battle state management hook |
| `services/baggerBombOrchestrator.js` | Business logic orchestration |
| `components/BaggerBomb/BaggerBombWrapper.jsx` | Error boundary + loading states |

---

## 9. Quick Reference

### 9.1 File Locations

```
/src/App.jsx
  - Classic battle view: lines 29681-30400+
  - isBaggerBombBattle helper: line 10599
  - Battle state variables: lines 11235-11280

/src/components/BaggerBomb/
  - BaggerBombBattleView.jsx (420 lines)
  - BaggerBombScoreboard.jsx (276 lines)
  - SessionScoreCard.jsx (185 lines)
  - BreakoutFeed.jsx (196 lines)
  - AssetPerformanceRow.jsx (198 lines)
  - SubstitutionPanel.jsx (355 lines)
  - PortfolioBuilderBaggerBomb.jsx (500+ lines)

/src/services/
  - sessionScoringService.js (679 lines)
  - breakoutDetectionService.js (593 lines)
  - volatilityService.js (394 lines)
  - priceSnapshotService.js (653 lines)
  - substitutionService.js (706 lines)

/src/firebase/
  - firebaseService.js
    - createBaggerBombBattle(): line 690
    - joinBaggerBombBattle(): line 840
```

### 9.2 Key Constants

```javascript
// Sessions (Eastern Time)
MORNING_BELL:  9:30 AM - 11:30 AM
MIDDAY:       11:30 AM -  2:00 PM
POWER_HOUR:    2:00 PM -  4:00 PM
NIGHT_GAME:    4:00 PM -  8:00 PM

// Substitution Windows
Window 1: 11:30 AM - 11:45 AM
Window 2:  2:00 PM -  2:15 PM

// Scoring
Base: 10 pts per 1% change
Conviction: 1.0x (0-10%), 1.15x (10-15%), 1.30x (15%+)

// Breakout Points (stackable)
BREAKOUT: +15  |  BUST: -10
RALLY: +30     |  CRASH: -20
MOONSHOT: +50  |  MELTDOWN: -35

// Session Bonuses
Session Win: +10
Green Sweep: +20
Clean Sweep: +30
```

---

## 10. Next Steps

1. **Immediate:** Add view switching logic to `App.jsx` battle screen
2. **Short-term:** Create `useBaggerBombBattle()` hook for state management
3. **Medium-term:** Build orchestration layer for session transitions
4. **Integration:** Wire up substitution and notification systems
5. **Testing:** End-to-end test full battle flow from create to completion

---

*Document generated for BaggerBomb Battle View redesign initiative.*
