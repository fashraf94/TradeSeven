# MARKETCLASH ARCHITECTURE DEEP DIVE

> **Purpose:** Comprehensive reference for UI redesign of DraftBattleScreen and FreeAgencyScreen
> **Created:** January 2026
> **Status:** Pre-implementation research document

---

## Table of Contents

1. [Application Architecture Overview](#part-1-application-architecture-overview)
2. [Firebase Integration](#part-2-firebase-integration)
3. [EODHD API Integration](#part-3-eodhd-api-integration)
4. [Draft/Battle Business Logic](#part-4-draftbattle-business-logic)
5. [Existing Holographic Components](#part-5-existing-holographic-components)
6. [Navigation Flow](#part-6-navigation-flow)
7. [User Context](#part-7-user-context)
8. [Error Handling & Edge Cases](#part-8-error-handling--edge-cases)
9. [Mobile Considerations](#part-9-mobile-considerations)
10. [Testing & Debugging](#part-10-testing--debugging)

---

## PART 1: Application Architecture Overview

### 1.1 Entry Point & Routing

**Entry Point:** `/src/main.jsx`

```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from './contexts';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
    <Analytics />
  </StrictMode>,
)
```

**Routing Type:** State-based routing (NOT React Router)

The app uses a central `screen` state variable to control which view is displayed:

```javascript
// In App.jsx (PortfolioDuel component)
const [screen, setScreen] = useState('home');

// Navigation is conditional rendering based on screen value
if (screen === 'home') return <HomeScreen ... />;
if (screen === 'dashboard') return <Dashboard ... />;
if (screen === 'draftBattle') return <DraftBattleScreen ... />;
// ... 25+ more screens
```

### 1.2 The `setScreen` Function

`setScreen` is a standard React `useState` setter passed as a prop to child components:

```javascript
// Navigation examples
setScreen('dashboard')      // Navigate to dashboard
setScreen('draftBattle')    // Navigate to battle view
setScreen('freeAgency')     // Navigate to free agency
setScreen('home')           // Return to login
```

### 1.3 State Management

**Global State Solution:** Single React Context (`UserContext`)

**Top-Level State in App.jsx (~100+ state variables):**

```javascript
// Navigation
const [screen, setScreen] = useState('home');

// User/Auth (from context)
const { user, login, logout, updateUser, loading: userLoading } = useUser();

// Market Data
const [stocksData, setStocksData] = useState([]);
const [cryptoData, setCryptoData] = useState([]);

// Battle Management
const [battles, setBattles] = useState([]);
const [currentBattle, setCurrentBattle] = useState(null);
const [activeDraftBattles, setActiveDraftBattles] = useState([]);

// Draft State
const [currentDraft, setCurrentDraft] = useState(null);  // ⚠️ KEY STATE
const [draftState, setDraftState] = useState(null);

// Game Mode
const [gameMode, setGameMode] = useState('draft'); // 'draft' or 'classic'
```

### 1.4 Context Providers

**Single Provider:** `UserProvider`

**File:** `/src/contexts/UserContext.jsx`

```javascript
const value = {
  user,              // Current user object or null
  loading,           // Auth initialization state
  login,             // Authenticate user
  logout,            // Clear user state
  updateUser,        // Merge updates and persist
  getUserId,         // Get best available user identifier
  isLoggedIn         // Boolean convenience flag
};
```

### 1.5 File Structure

```
src/
├── main.jsx                    # Entry point
├── App.jsx                     # Main component (26,124 lines)
├── contexts/
│   ├── index.js
│   └── UserContext.jsx         # User state management
├── screens/
│   ├── DraftBattleScreen.jsx   # ⚠️ REDESIGN TARGET
│   ├── FreeAgencyScreen.jsx    # ⚠️ REDESIGN TARGET
│   ├── DraftRoomScreen.jsx
│   ├── DraftResultsScreen.jsx
│   ├── DraftLobbyScreen.jsx
│   ├── BattleViewScreen.jsx
│   ├── HomeScreen.jsx
│   ├── ProfileScreen.jsx
│   └── ...
├── components/
│   ├── draft/                  # Holographic components
│   │   ├── HoloAssetCard.jsx
│   │   ├── PlayerPanel.jsx
│   │   ├── HoloTimer.jsx
│   │   ├── RosterGauges.jsx
│   │   ├── SnakeConduit.jsx
│   │   ├── AssetResearchModal.jsx
│   │   ├── CommandDeckConfirmButton.jsx
│   │   ├── CommandDeckYouPanel.jsx
│   │   ├── DraftToolButtons.jsx
│   │   ├── MiniPlayerPanel.jsx
│   │   └── index.js
│   ├── Research/
│   ├── Dashboard/
│   ├── BaggerBomb/
│   ├── GamePlan/
│   ├── earningsGame/
│   ├── shared/
│   └── ui/
├── services/
│   ├── draftService.js         # Draft CRUD operations
│   ├── freeAgencyService.js    # Free agency logic
│   ├── draftAssets.js          # Asset pools
│   ├── eodhdAPI.js             # Price fetching
│   ├── cacheService.js         # Multi-tier caching
│   ├── apiMonitor.js           # API tracking
│   ├── auth/
│   │   └── authService.js
│   └── storage/
├── firebase/
│   ├── config.js               # Firebase init
│   ├── firebaseService.js      # Firestore operations
│   └── authService.js          # Firebase auth
├── hooks/
│   ├── useDraft.js             # Draft state management
│   ├── useBattles.js           # Battle subscriptions
│   └── useBaggerBombBattle.js
├── utils/
│   ├── formatters.js           # Number/date formatting
│   ├── stockHelpers.js         # Asset utilities
│   └── debug.js                # window.mcDebug
├── constants/
│   ├── screens.js              # Screen name constants
│   └── sectors.js              # Sector colors
├── config/
│   └── featureFlags.js         # Feature toggles
├── data/
│   └── assets.js               # Fallback prices
└── styles/
```

---

## PART 2: Firebase Integration

### 2.1 Firebase Configuration

**File:** `/src/firebase/config.js`

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

**Services Used:**
- ✅ Firebase Authentication
- ✅ Firestore Database (real-time)
- ❌ Cloud Storage (configured but not used)
- ❌ Realtime Database (using Firestore instead)

### 2.2 Database Schema - Draft Document

**Collection:** `drafts`

```javascript
{
  // Identity
  id: string,
  code: string,                    // 4-char join code (e.g., "ABCD")
  type: 'stocks' | 'crypto',
  status: 'waiting' | 'active' | 'completed' | 'battle' | 'cancelled',
  isTraining: boolean,

  // Players Array ⚠️ CRITICAL
  players: [{
    odUserId: string,              // "local_username" or "cpu_1_timestamp"
    odUsername: string,
    displayName: string,
    isHost: boolean,
    isCPU: boolean,
    picks: string[],               // ['AAPL', 'NVDA', 'NEE', ...]
    pickCategories: string[],      // ['steady', 'risky', 'defensive', ...]
    categories: {
      steady: number,              // 0-3
      risky: number,               // 0-3
      defensive: number            // 0-3
    },
    lastSeen: ISO string,
    isAbsent: boolean,
    disconnected?: boolean,
    disconnectedAt?: string
  }],

  // Draft Management
  playerIds: string[],
  hostId: string,
  currentRound: number,
  currentPickIndex: number,
  currentPlayerId: string,
  pickDeadline: Timestamp,
  draftOrder: number[],
  picks: array,
  availableAssets: array,

  // Free Agency ⚠️ CRITICAL FOR REDESIGN
  freeAgents: {
    steady: [{ symbol, name, category }],
    risky: [...],
    defensive: [...]
  },

  dailySwaps: {
    "2025-01-13": {
      "userId1": 0,    // swaps used today
      "userId2": 1,
      "userId3": 2     // maxed out
    }
  },

  swapHistory: [{
    odUserId: string,
    displayName: string,
    droppedAsset: { symbol, category },
    addedAsset: { symbol, category },
    timestamp: ISO string,
    priceAtSwap: number
  }],

  // Price Locking ⚠️ CRITICAL
  lockedPrices: {
    "AAPL": 185.50,
    "BTC": 91000,
    // ... all picked assets
  },

  // Battle Timing
  battleEndTime: ISO string,

  // Timestamps
  createdAt: Timestamp,
  startedAt: Timestamp | null,
  completedAt: Timestamp | null,
  battleId: string | null
}
```

### 2.3 Real-time Listeners

**Draft Subscription:**

```javascript
// File: /src/services/draftService.js
export function subscribeToDraft(draftId, callback) {
  return onSnapshot(doc(db, 'drafts', draftId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    } else {
      callback(null);
    }
  });
}
```

**Usage in useDraft.js:**

```javascript
unsubscribe = draftService.subscribeToDraft(currentDraft.id, (draft) => {
  if (draft) {
    setDraftState(draft);
    // Auto-navigate based on status changes
    if (draft.status === 'active' && screen === 'draftLobby') {
      setScreen('draftRoom');
    }
  }
});
```

### 2.4 Firebase Service Files

**`/src/services/draftService.js`** (23 exports):

| Function | Purpose |
|----------|---------|
| `createMultiplayerDraft()` | Create new multiplayer draft |
| `createTrainingDraft()` | Create CPU opponent draft |
| `joinDraftByCode()` | Join via 4-char code |
| `getDraft()` | Fetch draft by ID |
| `startDraft()` | Begin picking phase |
| `leaveDraft()` | Player exits draft |
| `cancelDraft()` | Host cancels draft |
| `makePick()` | Record asset pick |
| `handleAutopick()` | Auto-pick for absent/CPU |
| `processCPUTurn()` | CPU picking logic |
| `subscribeToDraft()` | Real-time listener |
| `storeDraftLockedPrices()` | Lock prices for battle |
| `updatePlayerPresence()` | Heartbeat (10s interval) |
| `checkAbsentPlayers()` | Mark inactive players |

**`/src/services/freeAgencyService.js`** (14 exports):

| Function | Purpose |
|----------|---------|
| `isFreeAgencyWindowOpen()` | Check if swaps allowed now |
| `getTimeUntilWindowOpens()` | Countdown to window |
| `getTimeUntilWindowCloses()` | Remaining window time |
| `getPlayerSwapsToday()` | Count swaps used |
| `canPlayerSwap()` | Validation check |
| `getFreeAgents()` | Get available assets |
| `getPlayerRoster()` | Get player's picks |
| `executeSwap()` | Atomic swap transaction |
| `getSwapHistory()` | Get swap log |
| `processCPUSwap()` | CPU swap logic |
| `initializeFreeAgents()` | Set up free agent pool |
| `calculateBattleEndTime()` | Determine battle end |
| `isBattleEnded()` | Check if battle over |
| `getBattleTimeRemaining()` | Time left display |

---

## PART 3: EODHD API Integration

### 3.1 API Service File

**File:** `/src/services/eodhdAPI.js`

**Key Exports:**

```javascript
// Stock Functions
getMultipleStockPrices(symbols)    // Batch fetch stocks
getStockPrice(symbol)              // Single stock
getPopularStocks()                 // Popular + prices
getAllStockPrices()                // Alias

// Crypto Functions
getMultipleCryptoPrices(symbols)   // Batch fetch crypto
getCryptoPrice(symbol)             // Single crypto
getPopularCrypto()                 // Popular + prices
getAllCryptoPrices()               // Alias

// Utilities
clearCache()                       // Clear price cache
getCacheStats()                    // Cache metrics
testConnection()                   // API health check
```

### 3.2 API Key Management

**Security:** API key stored in environment variable, NEVER exposed to client.

All calls go through Vercel serverless proxy:

```
Client → /api/stocks/prices → Vercel Function → EODHD API
```

**Proxy Files:**
- `/api/stocks/prices.js`
- `/api/crypto/prices.js`
- `/api/news/market.js`
- `/api/stocks/earnings.js`

### 3.3 Rate Limiting

**File:** `/api/_utils/rateLimit.js`

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/stocks/prices` | 200 req | 60s |
| `/api/crypto/prices` | 60 req | 60s |
| `/api/news/*` | 30 req | 60s |
| `/api/stocks/earnings` | 30 req | 60s |

### 3.4 Caching Strategy

**File:** `/src/services/cacheService.js`

**Multi-Tier Cache:**

| Tier | TTL | Data Types |
|------|-----|------------|
| AGGRESSIVE | 24 hours | fundamentals, historical, earnings |
| MODERATE | 1 hour | news, analyst ratings |
| LIGHT | 5 minutes | prices, crypto quotes |
| NONE | 0 | realtime, AI responses |

```javascript
// Implementation
class CacheService {
  memoryCache = new Map();       // Fast in-memory
  storagePrefix = 'mc_cache_';   // localStorage persistence
  maxMemoryItems = 500;          // Prevent bloat
}
```

### 3.5 Price Fetching Logic

**Stock Prices:**

```javascript
// Symbols get .US suffix for EODHD
const symbolList = symbols.map(s => `${s.trim()}.US`).join(',');
const url = `https://eodhd.com/api/real-time/${symbolList}?api_token=${API_KEY}&fmt=json`;

// Response transformation
const prices = {};
dataArray.forEach(item => {
  const symbol = item.code.replace('.US', '');
  prices[symbol] = {
    price: item.close || item.previousClose || 0,
    change: item.change || 0,
    changePercent: item.change_p || 0
  };
});
```

**Crypto Prices:**

```javascript
// Symbols get -USD.CC suffix
const symbolList = symbols.map(s => `${s.trim()}-USD.CC`).join(',');

// Response transformation
prices[symbol] = {
  price: item.close || item.previousClose || 0,
  change24h: item.change_p || 0
};
```

### 3.6 Fallback Prices

**File:** `/src/data/assets.js`

```javascript
export const FALLBACK_STOCK_PRICES = {
  'AAPL': 185, 'MSFT': 378, 'NVDA': 135, 'GOOGL': 175,
  'AMZN': 185, 'META': 560, 'TSLA': 250, // ... 50 stocks
};

export const FALLBACK_CRYPTO_PRICES = {
  'BTC': 91000, 'ETH': 3100, 'SOL': 137, 'ADA': 0.43,
  // ... 32 cryptos (by ID and symbol)
};
```

---

## PART 4: Draft/Battle Business Logic

### 4.1 Standings Calculation

**File:** `/src/screens/DraftBattleScreen.jsx` (lines 193-336)

```javascript
const calculateStandings = async () => {
  // Step 1: Collect unique symbols
  const allSymbols = new Set();
  currentDraft.players.forEach(player => {
    (player.picks || []).forEach(symbol => allSymbols.add(symbol));
  });

  // Step 2: Batch fetch prices (single API call)
  const allPrices = battleType === 'crypto'
    ? await stockAPIModule.getAllCryptoPrices(symbolList)
    : await stockAPIModule.getAllStockPrices(symbolList);

  // Step 3: Calculate per-player performance
  const playerPerformances = currentDraft.players.map((player) => {
    let totalGain = 0;
    const portfolioWithGains = [];

    for (const symbol of player.picks || []) {
      const currentPrice = allPrices[symbol]?.price || 0;
      const lockedPrice = Number(currentDraft.lockedPrices?.[symbol]) || currentPrice;

      // Calculate gain with sanity checks
      let gain = 0;
      if (lockedPrice > 0 && currentPrice > 0) {
        gain = ((currentPrice - lockedPrice) / lockedPrice) * 100;

        // ⚠️ SANITY CHECK: Suspicious gains reset to 0
        if (gain > 500 || gain < -90) {
          console.warn(`Suspicious gain for ${symbol}: ${gain}%`);
          gain = 0;
        }
      }

      portfolioWithGains.push({ symbol, gain, lockedPrice, currentPrice });

      // Equal weight: 11.1% each for 9 assets
      totalGain += gain / 9;
    }

    // Find best/worst assets
    const sorted = [...portfolioWithGains].sort((a, b) => b.gain - a.gain);

    return {
      odUserId: player.odUserId,
      displayName: player.displayName,
      isMe: player.odUserId === currentUserId,
      isCPU: player.isCPU || false,
      totalGain: parseFloat(totalGain.toFixed(2)),
      portfolio: portfolioWithGains,
      bestAsset: sorted[0],
      worstAsset: sorted[sorted.length - 1],
      previousRank: player.previousRank || 0
    };
  });

  // Step 4: Sort by total gain, assign ranks
  const standings = playerPerformances.sort((a, b) => b.totalGain - a.totalGain);
  standings.forEach((player, index) => {
    player.currentRank = index + 1;
  });
};

// Refresh every 60 seconds
const refreshInterval = setInterval(calculateStandings, 60000);
```

### 4.2 Battle Timing

**File:** `/src/services/freeAgencyService.js`

```javascript
export const calculateBattleEndTime = (portfolioType, draftCompletedTime) => {
  const completed = new Date(draftCompletedTime);

  if (portfolioType === 'stocks') {
    // ⚠️ STOCKS: Next Friday at 3 PM CT
    const ct = new Date(completed.toLocaleString("en-US", { timeZone: "America/Chicago" }));
    let daysUntilFriday = (5 - ct.getDay() + 7) % 7;

    // If Friday after 3 PM, go to next Friday
    if (daysUntilFriday === 0 && ct.getHours() >= 15) {
      daysUntilFriday = 7;
    }

    const endDate = new Date(ct);
    endDate.setDate(endDate.getDate() + daysUntilFriday);
    endDate.setHours(15, 0, 0, 0); // 3 PM CT
    return endDate.toISOString();
  } else {
    // ⚠️ CRYPTO: Exactly 7 days after draft completion
    const endDate = new Date(completed.getTime() + (7 * 24 * 60 * 60 * 1000));
    return endDate.toISOString();
  }
};
```

### 4.3 Free Agency Rules

**All times in Central Time (CT):**

| Rule | Stocks | Crypto |
|------|--------|--------|
| **Window Open** | 3:00 PM CT | 6:00 PM CT |
| **Window Close** | 11:59 PM CT | 11:59 PM CT |
| **Daily Swap Limit** | 2 per player | 2 per player |
| **Category Restriction** | Must match dropped asset | Must match dropped asset |
| **Price Lock** | Today's closing price | Current market price |

**Window Check Logic:**

```javascript
export const isFreeAgencyWindowOpen = (portfolioType) => {
  const ct = getCentralTime();
  const currentMinutes = ct.getHours() * 60 + ct.getMinutes();

  if (portfolioType === 'stocks') {
    // 3 PM (900 min) to 11:59 PM (1439 min)
    return currentMinutes >= 900 && currentMinutes <= 1439;
  } else {
    // 6 PM (1080 min) to 11:59 PM (1439 min)
    return currentMinutes >= 1080 && currentMinutes <= 1439;
  }
};
```

**What Happens to Dropped Assets:**

```javascript
// Dropped asset immediately becomes a free agent
updatedFreeAgents[dropCategory] = [
  ...categoryFreeAgents.filter(a => a.symbol !== addSymbol),
  { symbol: dropSymbol, name: dropSymbol, category: dropCategory }
];
```

### 4.4 Locked Prices

**When Prices Are Locked:**

1. Draft completes → `storeDraftLockedPrices()` is called
2. Prices fetched from API for all picked assets
3. Stored in `draft.lockedPrices` object
4. Used as baseline for gain calculations

**Price Repair Logic:**

```javascript
// Auto-detect bad prices (all exactly $100)
const prices = Object.values(currentDraft.lockedPrices);
const allSamePrice = prices.every(p => p === 100);

if (allSamePrice) {
  // Trigger repair: fetch real prices and update
  const newLockedPrices = {};
  // ... fetch from API
  await updateDoc(draftRef, { lockedPrices: newLockedPrices });
}
```

**Gain Calculation:**

```javascript
const gain = ((currentPrice - lockedPrice) / lockedPrice) * 100;
```

---

## PART 5: Existing Holographic Components

### 5.1 Component Inventory

**Directory:** `/src/components/draft/`

| Component | Lines | Key Props |
|-----------|-------|-----------|
| **HoloAssetCard.jsx** | ~786 | symbol, price, sector, status, category, onSelect, onAcquire, compact |
| **PlayerPanel.jsx** | ~428 | username, isCurrentPicker, isNextPicker, isYou, isCPU, stats, compact |
| **HoloTimer.jsx** | ~328 | seconds, isYourTurn, onExpire |
| **RosterGauges.jsx** | ~387 | steady, risky, defensive (each: {picked, required}), onGaugeClick |
| **SnakeConduit.jsx** | ~496 | width, height, playerCount |
| **AssetResearchModal.jsx** | ~1,112 | asset, sector, category, isMyTurn, timeRemaining, canPick, onAcquire, onClose |
| **CommandDeckConfirmButton.jsx** | ~157 | selectedAsset, onConfirm, isYourTurn, isLoading, currentPickerName |
| **CommandDeckYouPanel.jsx** | ~212 | username, stats, isYourTurn, totalValue |
| **DraftToolButtons.jsx** | ~335 | onAnalyze, onCompare, onNotes, disabled |
| **MiniPlayerPanel.jsx** | ~128 | player, isCurrentPicker, isNextPicker, isYou |

### 5.2 HoloAssetCard Deep Dive

**Props Interface:**

```javascript
const HoloAssetCard = ({
  symbol,              // Ticker symbol
  name,                // Company/asset name
  price,               // Current price
  change = 0,          // Price change %
  sector,              // For color theming
  status = 'available', // 'available' | 'locked'
  lockedBy,            // Player who locked it
  isSelected = false,
  onSelect,            // Card click handler
  onGetInfo,           // Research modal trigger
  onAcquire,           // Pick confirmation
  category = 'steady', // 'steady' | 'risky' | 'defensive'
  disabled = false,
  compact = false      // Mobile mode
}) => { ... }
```

**Internal State:**

```javascript
const [isHovered, setIsHovered] = useState(false);
const [isPressed, setIsPressed] = useState(false);
const [isPicking, setIsPicking] = useState(false);
const [showParticles, setShowParticles] = useState(false);
```

### 5.3 Shared Color Constants

**Sector Colors (duplicated in components):**

```javascript
const SECTOR_COLORS = {
  'Technology': { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  'Energy': { primary: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  'Healthcare': { primary: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)' },
  'Financials': { primary: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
  'Consumer Cyclical': { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  'Industrials': { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  'Materials': { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
  'Real Estate': { primary: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  'Utilities': { primary: '#64748b', glow: 'rgba(100, 116, 139, 0.4)' },
  'Communication Services': { primary: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
  'Cryptocurrency': { primary: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
  'DeFi': { primary: '#627eea', glow: 'rgba(98, 126, 234, 0.4)' },
  'default': { primary: '#00d9ff', glow: 'rgba(0, 217, 255, 0.4)' }
};
```

**Category Colors:**

```javascript
const categoryConfig = {
  steady: { letter: 'S', color: '#10b981' },    // Green
  risky: { letter: 'R', color: '#f59e0b' },     // Orange
  defensive: { letter: 'D', color: '#3b82f6' }  // Blue
};
```

**Brand Neon Colors:**

```javascript
--neon-cyan: #00d9ff      // Primary brand
--neon-green: #00ff88     // Picking state
--neon-red: #ff3366       // Critical/urgent
--neon-orange: #ff9500    // Next picker
```

### 5.4 Animation Utilities

**Common Keyframe Patterns:**

```javascript
// Glow pulse (2-3s loops)
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px color; }
  50% { box-shadow: 0 0 30px color; }
}

// Scale pulse (selection feedback)
@keyframes scale-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

// Timer shake (urgent state)
@keyframes timer-shake {
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}
```

**Reduced Motion Support:**

```javascript
@media (prefers-reduced-motion: reduce) {
  [animated-elements] { animation: none !important; }
}
```

### 5.5 Component Dependencies

```
AssetResearchModal
├── FundamentalNews (../Research/)
└── LatestEarningsReport (../Research/)

SnakeConduit (desktop only, >= 1024px)

RosterGauges → RosterGaugesCompact (mobile variant)
DraftToolButtons → DraftToolButtonsCompact (mobile variant)
HoloTimer → HoloTimerCompact, HoloTimerInline (variants)
PlayerPanel → MiniPlayerPanel (mobile variant)
```

---

## PART 6: Navigation Flow

### 6.1 Screen Transitions

```
Dashboard
    ↓ [Click active draft battle]
    ↓ setCurrentDraft(battle); setScreen('draftBattle')
DraftBattleScreen
    ↓ [Click "Free Agency" button]
    ↓ setScreen('freeAgency')
FreeAgencyScreen
    ↓ [Click "Back"]
    ↓ onBack() → setScreen('draftResults')
DraftResultsScreen
    ↓ [Click "Back to Dashboard"]
    ↓ setCurrentDraft(null); setScreen('dashboard')
Dashboard
```

### 6.2 Props Passing

**DraftBattleScreen receives:**

```javascript
<DraftBattleScreen
  containerStyle={containerStyle}
  user={user}
  currentDraft={currentDraft}      // ⚠️ The draft data
  setCurrentDraft={setCurrentDraft}
  setScreen={setScreen}            // Direct navigation
  logger={logger}
/>
```

**FreeAgencyScreen receives:**

```javascript
<FreeAgencyScreen
  containerStyle={containerStyle}
  currentDraft={currentDraft}      // Same draft data
  user={user}
  onBack={() => setScreen('draftResults')}  // Callback, not direct
/>
```

### 6.3 Back Navigation

**Key Difference:**

| Screen | Back Method | Target |
|--------|-------------|--------|
| DraftBattleScreen | `setScreen('dashboard')` | Dashboard |
| FreeAgencyScreen | `onBack()` callback | DraftResults |

**No Browser History Integration:**
- No `window.history` API
- No `popstate` listeners
- Pure client-side state navigation

**State Preservation:**
- `currentDraft` persists in App.jsx across all transitions
- Only cleared when user explicitly returns to dashboard

---

## PART 7: User Context

### 7.1 User Object Shape

**Runtime User Object:**

```javascript
{
  // Core Identity
  username: string,           // "johndoe"
  odUserId: string,          // "local_johndoe" (normalized)

  // Stats
  wins: number,
  losses: number,
  xp: number,
  rank: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert',
  level: number,

  // Timestamps
  joinedAt: ISO string,
  lastLoginAt: ISO string,
  updatedAt?: ISO string,

  // Auth
  authProvider: 'local',

  // Firebase (optional)
  uid?: string,
  email?: string
}
```

### 7.2 User Identification

**odUserId vs username:**

| Field | Format | Usage |
|-------|--------|-------|
| `odUserId` | `local_${username.toLowerCase()}` | Database queries, player identification |
| `username` | User-defined (3-20 chars) | Display, fallback ID |

**Pattern used everywhere:**

```javascript
const currentUserId = user?.odUserId || user?.username;
```

### 7.3 Player in Draft Context

```javascript
// Finding current user in draft
const myPlayer = draftState?.players?.find(p => p.odUserId === currentUserId);

// Checking if it's my turn
const isMyTurn = draftState?.currentPlayerId === currentUserId;

// Checking if I'm host
const isHost = currentDraft?.hostId === currentUserId;
```

### 7.4 CPU Player Identification

```javascript
// CPU players have special ID format
odUserId: `cpu_${i + 1}_${Date.now()}`,  // e.g., "cpu_1_1736600000000"

// CPU flag
isCPU: true,

// CPU names
const cpuNames = [
  'TradeBot Alpha', 'MarketMind', 'StockSage',
  'CryptoKing', 'WallStreetBot', 'BullishBot',
  'BearHunter', 'DiamondHands'
];

// Check if player is CPU
if (player.isCPU) { ... }
if (player.odUserId.startsWith('cpu_')) { ... }
```

---

## PART 8: Error Handling & Edge Cases

### 8.1 API Error Handling

**Timeout Pattern (15 seconds):**

```javascript
const fetchWithTimeout = async (url, timeout = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};
```

**Multi-Tier Fallback:**

1. Cache check (5-minute TTL for prices)
2. Batch API call
3. Individual API calls (if batch fails)
4. Fallback prices from `/src/data/assets.js`

### 8.2 Firebase Error Handling

```javascript
try {
  await addDoc(collection(db, 'drafts'), draftData);
} catch (error) {
  console.error('❌ Error creating draft:', error);
  throw new Error('Failed to create draft. Please try again.');
}
```

### 8.3 Player Disconnection

**Presence System:**

```javascript
// Heartbeat every 10 seconds
presenceRef.current = setInterval(sendPresence, 10000);

// Absence check every 15 seconds
absentCheckRef.current = setInterval(checkAbsent, 15000);

// If absent 30+ seconds → mark isAbsent: true
// If absent and current picker → trigger autopick after 3s
```

**Draft Health Check:**

```javascript
// If >50% humans disconnected → cancel draft
if (disconnectedCount > humanCount / 2) {
  await updateDoc(draftRef, {
    status: 'cancelled',
    cancelReason: 'Too many players disconnected'
  });
}
```

### 8.4 Price Data Unavailability

**Auto-Repair on DraftBattleScreen Mount:**

```javascript
useEffect(() => {
  const repairLockedPrices = async () => {
    const prices = Object.values(currentDraft.lockedPrices);
    const allBadPrices = prices.every(p => p === 100);

    if (allBadPrices) {
      // Fetch real prices and repair
    }
  };
  repairLockedPrices();
}, [currentDraft?.id]);
```

**Manual Repair Button:**

```javascript
{needsPriceRepair && (
  <button onClick={forceRepairPrices}>
    {repairStatus === 'repairing' ? '⏳ Repairing...' : '🔧 Repair Prices Now'}
  </button>
)}
```

### 8.5 Loading States

**Spinner Pattern:**

```javascript
{loading ? (
  <div style={{
    width: '48px',
    height: '48px',
    border: '4px solid #21262d',
    borderTop: '4px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }} />
) : (
  // Content
)}
```

### 8.6 Known TODOs in Code

```javascript
// /src/firebase/authService.js (Line 38)
// TODO: Check username uniqueness (add this in Phase 2)

// /src/services/challengeService.js (Line 74)
// TODO: Add NYSE holiday calendar check
```

---

## PART 9: Mobile Considerations

### 9.1 Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Desktop | >= 1024px | Full layout, SnakeConduit visible |
| Tablet | 768-1023px | Vertical stack layout |
| Phone | < 768px | Compact components, fixed footer |
| Mini Phone | < 375px | Ultra-compact, 3-column grids |

### 9.2 Mobile Detection

```javascript
const [isPhone, setIsPhone] = useState(
  typeof window !== 'undefined' && window.innerWidth < 768
);

useEffect(() => {
  const handleResize = () => setIsPhone(window.innerWidth < 768);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### 9.3 Safe Area Handling

**iPhone Notch Support:**

```javascript
// Header
paddingTop: 'max(12px, env(safe-area-inset-top))',

// Footer
paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
```

### 9.4 Touch Interactions

**Swipe Gesture (Roster Drawer):**

```javascript
const handleDrawerTouchStart = (e) => {
  setIsDragging(true);
  setRosterTouchStart(e.touches[0].clientY);
};

const handleDrawerTouchMove = (e) => {
  if (!isDragging) return;
  const diff = rosterTouchStart - e.touches[0].clientY;
  setDrawerDragY(Math.max(0, Math.min(diff, 200)));
};

const handleDrawerTouchEnd = () => {
  if (drawerDragY > 80) setIsRosterExpanded(true);
  else if (drawerDragY < -30) setIsRosterExpanded(false);
  setDrawerDragY(0);
};
```

### 9.5 containerStyle Prop

```javascript
const containerStyle = {
  maxWidth: '100vw',
  width: '100%',
  margin: 0,
  padding: 0,
  minHeight: '100dvh',       // Dynamic viewport height (mobile-friendly)
  background: colors.background,
  overflowX: 'hidden'
};
```

### 9.6 Mobile Component Variants

```javascript
{isPhone ? (
  <RosterGaugesCompact {...props} />
) : (
  <RosterGauges {...props} />
)}

{isPhone ? (
  <MiniPlayerPanel {...props} />
) : (
  <PlayerPanel {...props} />
)}
```

---

## PART 10: Testing & Debugging

### 10.1 Logger Prop

**Definition in App.jsx:**

```javascript
const logger = {
  log: (...args) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  warn: (...args) => {
    if (import.meta.env.DEV) console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);  // Always log errors
  }
};
```

**Usage in DraftBattleScreen:**

```javascript
const DraftBattleScreen = ({
  ...
  logger = console,  // Defaults to console
}) => {
  logger.log('[ForceRepair] Starting repair...');
  logger.error('[ForceRepair] Failed:', error);
};
```

### 10.2 Debug Utilities

**window.mcDebug** (defined in `/src/utils/debug.js`):

```javascript
// System audit
window.mcDebug.audit()

// Cache operations
window.mcDebug.clearAll()
window.mcDebug.clearCache()
window.mcDebug.viewCache('prices')

// Testing
await window.mcDebug.testCacheEffectiveness()
await window.mcDebug.simulateSession()

// Export
window.mcDebug.exportDebugData()

// Quick summary
window.mcDebug.summary()
```

### 10.3 API Monitor

**File:** `/src/services/apiMonitor.js`

```javascript
// Enable monitoring
localStorage.setItem('mc_api_debug', 'true');

// Use
window.apiMonitor.track(endpoint, params, source);
window.apiMonitor.report();
window.apiMonitor.getRecentCalls(20);
window.apiMonitor.getStats();
```

### 10.4 Cache Service Debugging

```javascript
window.mcCache.report()  // or cacheService.report()
window.mcCache.stats()
```

### 10.5 Tagged Logging Pattern

All modules use bracket-tagged logging:

```javascript
console.log('[DraftBattle] Calculating standings...');
console.log('[ForceRepair] Price data received:', data);
console.log('[EODHD] Fetching prices for:', symbols);
console.log('[Training] AI Portfolio generated');
```

---

## Warnings & Recommendations

### ⚠️ Fragile Areas - Handle with Care

1. **Price Locking Logic** (`storeDraftLockedPrices`)
   - Multi-tier fallback is complex
   - Bad prices can cascade to standings calculation
   - Test price repair flow thoroughly

2. **Time Zone Handling**
   - All free agency logic uses Central Time
   - `getCentralTime()` is the source of truth
   - Don't use local time for window checks

3. **Real-time Subscriptions**
   - Must unsubscribe on cleanup
   - Multiple listeners can cause memory leaks
   - Test component unmount scenarios

4. **Standings Calculation Sanity Checks**
   - Gains > 500% or < -90% are reset to 0
   - This can hide real issues with locked prices
   - Monitor for false positives

### ✅ Safe to Change

1. **Visual styling** - Colors, animations, layouts
2. **Component structure** - Can refactor without breaking logic
3. **Loading states** - Can add skeleton screens
4. **Error messages** - Can improve UX
5. **Mobile layouts** - Breakpoints can be adjusted

### 🔒 Must Preserve

1. **Props interfaces** - Screens expect specific props from App.jsx
2. **User identification** - `odUserId || username` pattern
3. **Category enforcement** - Steady/Risky/Defensive must match
4. **Swap limits** - 2 per day per player (Central Time date)
5. **Battle end time calculation** - Stocks=Friday 3PM CT, Crypto=7 days
6. **Price gain formula** - `(current - locked) / locked * 100`
7. **Equal weight** - Each of 9 assets = 11.1% of total gain

---

## Quick Reference

### Key State Variables

```javascript
// In App.jsx
const [screen, setScreen] = useState('home');
const [currentDraft, setCurrentDraft] = useState(null);
const { user } = useUser();
```

### Key Service Functions

```javascript
// Prices
await eodhdAPI.getAllStockPrices(symbols);
await eodhdAPI.getAllCryptoPrices(symbols);

// Free Agency
freeAgencyService.isFreeAgencyWindowOpen(portfolioType);
freeAgencyService.canPlayerSwap(draftId, userId, portfolioType);
await freeAgencyService.executeSwap(draftId, userId, drop, add);

// Draft
await draftService.storeDraftLockedPrices(draftId);
draftService.subscribeToDraft(draftId, callback);
```

### Key Time Intervals

| Purpose | Interval | Location |
|---------|----------|----------|
| Standings refresh | 60s | DraftBattleScreen |
| Timer update | 60s | DraftBattleScreen |
| Presence heartbeat | 10s | useDraft.js |
| Absence check | 15s | useDraft.js |
| Free agency data refresh | 60s | FreeAgencyScreen |
| CPU swap check | 30 min | App.jsx |

---

*Document generated for MarketClash UI Redesign project. Reference this during implementation to ensure no functionality is lost.*
