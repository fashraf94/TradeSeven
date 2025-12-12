# MarketClash State Architecture

**Last Updated:** 2025-12-12

This document describes the complete state management system, data flow patterns, and persistence layer of the MarketClash app.

---

## Table of Contents
- [State Overview](#state-overview)
- [All useState Declarations](#all-usestate-declarations)
- [Data Flow Patterns](#data-flow-patterns)
- [Firebase Integration](#firebase-integration)
- [localStorage Persistence](#localstorage-persistence)
- [API Integrations](#api-integrations)
- [Research Mode State](#research-mode-state)
- [Weekly Challenges State](#weekly-challenges-state)

---

## State Overview

**Total useState Hooks:** 65+

| Category | Count | Description |
|----------|-------|-------------|
| Core Navigation | 3 | Screen routing, history tab, sidebar |
| User & Auth | 3 | User object, username input, portfolio name |
| Market Data | 3 | Stocks, crypto, loading state |
| Classic Battles | 10 | Battle management, current battle, prices |
| Portfolio Builder | 5 | Asset type, search, portfolio array, type |
| Battle Live View | 4 | Prices, loading, view tab, expanded assets |
| Battle History | 3 | Previous battles, selected, show state |
| Snake Draft Core | 9 | Draft state, join code, categories, timers |
| Draft UI/UX | 6 | Banner, autopick, roster, touch states |
| Research Mode | 7 | Toggle, asset type, search, sort, compare |
| Weekly Challenges | 11 | Challenges, progress, toast, slot machine |
| UI Modals | 4 | XP modal, portfolio manager, sidebar |

---

## All useState Declarations

### Core Navigation State (Lines 1502-1503)

```javascript
const [screen, setScreen] = useState('home');
// Type: string
// Values: 'home', 'dashboard', 'builder', 'join', 'training', 'battle',
//         'draftSetup', 'draftJoin', 'draftTraining', 'draftLobby',
//         'draftRoom', 'draftBattle', 'draftResults', 'draftHistory',
//         'freeAgency', 'battleHistory', 'previousBattles', 'wins',
//         'losses', 'profile'
// Purpose: Controls which screen/view is rendered

const [historyTab, setHistoryTab] = useState('classic');
// Type: 'classic' | 'draft'
// Purpose: Toggle between Classic and Draft battle history
```

### User & Authentication State (Lines 1504-1506)

```javascript
const [user, setUser] = useState(null);
// Type: User | null
// Shape: {
//   username: string,
//   odUserId?: string,
//   wins: number,
//   losses: number,
//   xp: number,
//   rank: string,  // 'Beginner', 'Rookie', 'Trader', 'Expert', 'Master', 'Legend'
//   level: number
// }
// Purpose: Current logged-in user data

const [username, setUsername] = useState('');
// Type: string
// Purpose: Input field for login screen username entry

const [portfolioName, setPortfolioName] = useState('');
// Type: string
// Purpose: Name input for new portfolios in builder
```

### Market Data State (Lines 1509-1511)

```javascript
const [stocksData, setStocksData] = useState([]);
// Type: Asset[]
// Shape: [{
//   symbol: string,
//   name: string,
//   price: number,
//   change: number,
//   percentChange: number,
//   priceChange7d: number,
//   priceChange30d: number,
//   volatility: 'low' | 'medium' | 'high',
//   historicalPrices: number[],
//   marketCap: number,
//   volume24h: number
// }]
// Purpose: Cache of stock prices and metadata

const [cryptoData, setCryptoData] = useState([]);
// Type: Asset[] (same shape as stocksData)
// Purpose: Cache of cryptocurrency prices and metadata

const [loadingMarketData, setLoadingMarketData] = useState(true);
// Type: boolean
// Purpose: Loading indicator for initial market data fetch
```

### Classic Battle Management State (Lines 1514-1519)

```javascript
const [battles, setBattles] = useState([]);
// Type: Battle[]
// Shape: [{
//   id: string,
//   challengeCode: string,
//   creator: string,
//   creatorPortfolio: PortfolioAsset[],
//   portfolioName: string,
//   opponent: string | null,
//   opponentPortfolio: PortfolioAsset[] | null,
//   status: 'waiting' | 'active' | 'completed',
//   startDate: string | null,
//   endDate: string | null,
//   createdAt: string,
//   result?: BattleResult,
//   endingPrices?: Record<string, number>,
//   isTrainingBattle?: boolean
// }]
// Purpose: All battles (waiting, active, completed)

const [currentBattle, setCurrentBattle] = useState(null);
// Type: Battle | null
// Purpose: Battle being viewed in battle screen

const [activeBattleId, setActiveBattleId] = useState(null);
// Type: string | null
// Purpose: ID of most recently created/joined battle

const [activeDraftBattles, setActiveDraftBattles] = useState([]);
// Type: DraftBattle[]
// Purpose: Active Snake Draft battles for dashboard display

const [completedDraftBattles, setCompletedDraftBattles] = useState([]);
// Type: DraftBattle[]
// Purpose: Completed draft battles for history screen
```

### Portfolio Builder State (Lines 1521-1527)

```javascript
const [assetType, setAssetType] = useState('stocks');
// Type: 'stocks' | 'crypto'
// Purpose: Toggle between stock and crypto asset lists

const [searchTerm, setSearchTerm] = useState('');
// Type: string
// Purpose: Search filter for asset list

const [portfolio, setPortfolio] = useState([]);
// Type: PortfolioAsset[]
// Shape: [{
//   symbol: string,
//   name: string,
//   price: number,
//   percentage: number,  // 7.5 to 20
//   allocation?: number  // Same as percentage (used interchangeably)
// }]
// Purpose: Current portfolio being built

const [portfolioType, setPortfolioType] = useState(null);
// Type: 'stocks' | 'crypto' | null
// Purpose: Lock portfolio to single asset type (no mixing)

const [joinCode, setJoinCode] = useState('');
// Type: string (6 characters)
// Purpose: Input field for joining existing battle
```

### Battle Live View State (Lines 1530-1553)

```javascript
const [battlePrices, setBattlePrices] = useState({});
// Type: Record<string, number>
// Shape: { 'AAPL': 185.50, 'BTC': 91000, ... }
// Purpose: Current prices for assets in active battle

const [loadingBattlePrices, setLoadingBattlePrices] = useState(false);
// Type: boolean
// Purpose: Loading indicator for battle price refresh

const [currentBattleIndex, setCurrentBattleIndex] = useState(0);
// Type: number
// Purpose: Pagination index for battle lobby

const [battleViewTab, setBattleViewTab] = useState('yours');
// Type: 'yours' | 'opponent'
// Purpose: Mobile tab toggle for portfolio views

const [expandedAssets, setExpandedAssets] = useState(new Set());
// Type: Set<string>
// Purpose: Track which assets are expanded in battle view
```

### Battle History State (Lines 1537-1539)

```javascript
const [previousBattles, setPreviousBattles] = useState([]);
// Type: Battle[]
// Purpose: Archived/completed battles for history

const [showPreviousBattles, setShowPreviousBattles] = useState(false);
// Type: boolean
// Purpose: Toggle previous battles visibility

const [selectedPreviousBattle, setSelectedPreviousBattle] = useState(null);
// Type: Battle | null
// Purpose: Battle selected for detail view
```

### Challenge System State (Lines 1542-1544)

```javascript
const [userChallenges, setUserChallenges] = useState({ doubleDown: null, marketClose: null });
// Type: { doubleDown: Challenge | null, marketClose: Challenge | null }
// Purpose: User's active in-battle challenges

const [opponentChallenges, setOpponentChallenges] = useState({ doubleDown: null, marketClose: null });
// Type: { doubleDown: Challenge | null, marketClose: Challenge | null }
// Purpose: Opponent's visible challenges

const [openChallengePanels, setOpenChallengePanels] = useState(new Set());
// Type: Set<string>
// Purpose: Track expanded challenge panels
```

### UI Modal State (Lines 1547-1559)

```javascript
const [showXPModal, setShowXPModal] = useState(false);
// Type: boolean
// Purpose: XP progress modal visibility on dashboard

const [showPortfolioManager, setShowPortfolioManager] = useState(false);
// Type: boolean
// Purpose: Portfolio manager modal visibility

const [sidebarOpen, setSidebarOpen] = useState(false);
// Type: boolean
// Purpose: Mobile sidebar/nav drawer state
```

### Game Mode State (Lines 1564)

```javascript
const [gameMode, setGameMode] = useState('classic');
// Type: 'classic' | 'draft'
// Purpose: Toggle between Classic 1v1 and Snake Draft modes
```

### Snake Draft Core State (Lines 1567-1577)

```javascript
const [currentDraft, setCurrentDraft] = useState(null);
// Type: Draft | null
// Shape: {
//   id: string,
//   hostId: string,
//   type: 'stocks' | 'crypto',
//   status: 'waiting' | 'active' | 'completed' | 'battle' | 'cancelled',
//   players: Player[],
//   playerIds: string[],
//   currentPlayerId: string,
//   currentRound: number,
//   currentPick: number,
//   pickOrder: string[],
//   availableAssets: Asset[],
//   pickHistory: Pick[],
//   pickDeadline: Timestamp,
//   battleEndTime?: string,
//   lockedPrices?: Record<string, number>
// }
// Purpose: Current draft session data

const [draftJoinCode, setDraftJoinCode] = useState('');
// Type: string (6 characters)
// Purpose: Input for joining draft lobby

const [draftState, setDraftState] = useState(null);
// Type: Draft | null (same as currentDraft)
// Purpose: Real-time Firebase subscription state

const [draftCopied, setDraftCopied] = useState(false);
// Type: boolean
// Purpose: Copy feedback for draft share code

const [selectedDraftCategory, setSelectedDraftCategory] = useState('steady');
// Type: 'steady' | 'risky' | 'defensive'
// Purpose: Asset category filter in draft room

const [draftTimeRemaining, setDraftTimeRemaining] = useState(120);
// Type: number (seconds)
// Purpose: Countdown timer for current pick

const [draftBattleOpponent, setDraftBattleOpponent] = useState(null);
// Type: Player | null
// Purpose: Selected opponent in draft battle view
```

### Draft UI/UX State (Lines 1580-1584)

```javascript
const [activeDraftBanner, setActiveDraftBanner] = useState(null);
// Type: Draft | null
// Purpose: Banner data for rejoining active draft

const [autopickCountdown, setAutopickCountdown] = useState(null);
// Type: number | null
// Purpose: Countdown for CPU/absent player autopick

const [isRosterExpanded, setIsRosterExpanded] = useState(false);
// Type: boolean
// Purpose: Mobile roster drawer expansion

const [rosterTouchStart, setRosterTouchStart] = useState(null);
// Type: number | null
// Purpose: Touch Y coordinate for swipe gesture

const [rosterTouchEnd, setRosterTouchEnd] = useState(null);
// Type: number | null
// Purpose: Touch end Y coordinate for swipe gesture
```

### Research Mode State (Lines 1587-1592)

```javascript
const [showResearchMode, setShowResearchMode] = useState(false);
// Type: boolean
// Purpose: Research Mode overlay visibility

const [researchAssetType, setResearchAssetType] = useState('stocks');
// Type: 'stocks' | 'crypto'
// Purpose: Asset type filter in research mode

const [researchSearchTerm, setResearchSearchTerm] = useState('');
// Type: string
// Purpose: Search filter in research mode

const [researchSortBy, setResearchSortBy] = useState('rank');
// Type: 'rank' | '7d' | '30d' | 'winRate' | 'volatility'
// Purpose: Sort order for research asset list

const [researchExpandedAsset, setResearchExpandedAsset] = useState(null);
// Type: string | null (asset symbol)
// Purpose: Currently expanded asset card in research

const [researchCompareAssets, setResearchCompareAssets] = useState([]);
// Type: Asset[] (max 3)
// Purpose: Assets selected for comparison panel
```

### Weekly Challenges State (Lines 1595-1605)

```javascript
const [showWeeklyChallenges, setShowWeeklyChallenges] = useState(false);
// Type: boolean
// Purpose: Weekly challenges section expansion

const [weeklyChallenges, setWeeklyChallenges] = useState([]);
// Type: Challenge[]
// Shape: [{
//   id: string,
//   name: string,
//   description: string,
//   gameMode: 'classic' | 'snake' | 'universal',
//   difficulty: 'easy' | 'medium' | 'hard',
//   xp: number,
//   target: number,
//   type: string,
//   icon: string,
//   slot: 'classic' | 'snake' | 'universal' | 'wildcard',
//   slotLabel: string
// }]
// Purpose: This week's 4 challenges

const [activeDailyChallenge, setActiveDailyChallenge] = useState(null);
// Type: Challenge | null (with acceptedDate, acceptedAt)
// Purpose: Currently accepted challenge

const [challengeProgress, setChallengeProgress] = useState({});
// Type: Record<string, number>
// Shape: { 'classic_first_win': 1, 'uni_5_battles': 3 }
// Purpose: Progress toward each challenge's target

const [completedWeeklyChallenges, setCompletedWeeklyChallenges] = useState([]);
// Type: Challenge[] (with completedAt, completedDate)
// Purpose: Challenges completed this week

const [showSlotMachine, setShowSlotMachine] = useState(false);
// Type: boolean
// Purpose: Slot machine reveal animation visibility

const [slotMachineRevealed, setSlotMachineRevealed] = useState(false);
// Type: boolean
// Purpose: Track if reveal animation has played

const [expandedChallengeId, setExpandedChallengeId] = useState(null);
// Type: string | null
// Purpose: Currently expanded challenge card

const [showChallengeToast, setShowChallengeToast] = useState(false);
// Type: boolean
// Purpose: Challenge notification toast visibility

const [toastMessage, setToastMessage] = useState('');
// Type: string
// Purpose: Message content for challenge toast

const [challengeHistory, setChallengeHistory] = useState([]);
// Type: Challenge[]
// Purpose: Historical record of completed challenges
```

---

## Data Flow Patterns

### 1. Screen Navigation Pattern

```
User Action → setScreen('newScreen') → Conditional Render
                                            ↓
                               if (screen === 'newScreen') { return <Screen /> }
```

### 2. Battle Creation Flow

```
Portfolio Builder                    Battle Creation
      ↓                                    ↓
handleAddAsset()                    handleCreateBattle()
      ↓                                    ↓
setPortfolio([...])                 generateChallengeCode()
      ↓                                    ↓
Portfolio validation           →    Create battle object
(min 7 assets, 100% allocation)           ↓
                                    saveBattlesSafe()
                                          ↓
                                    setBattles([...])
                                          ↓
                                    setScreen('dashboard')
```

### 3. Battle Join Flow

```
Join Screen                         Battle Matching
     ↓                                    ↓
Enter code                         loadBattlesSafe()
     ↓                                    ↓
Build portfolio                    Find by challengeCode
     ↓                                    ↓
handleJoinBattle()           →     Validate:
                                   - Code exists
                                   - Status 'waiting'
                                   - Not own battle
                                   - Asset type matches
                                          ↓
                                   Update battle with:
                                   - opponent
                                   - opponentPortfolio
                                   - status: 'active'
                                   - startDate
                                   - endDate
                                          ↓
                                   saveBattlesSafe()
                                          ↓
                                   setScreen('battle')
```

### 4. Real-time Draft Flow

```
Firebase Subscription              Local State Updates
       ↓                                  ↓
subscribeToDraft()           →    setDraftState(draft)
       ↓                                  ↓
onSnapshot callback                Auto-navigation:
       ↓                           - 'active' → draftRoom
Check status changes               - 'battle' → draftResults
       ↓                           - 'cancelled' → dashboard
Update draftState
```

### 5. Challenge Progress Flow

```
Battle Completion                  Challenge Update
       ↓                                  ↓
calculateBattleResult()      →    updateWeeklyChallengeProgress()
       ↓                                  ↓
Check active challenge             Calculate new progress
       ↓                                  ↓
Match game mode                    setChallengeProgress({...})
       ↓                                  ↓
Update progress by type            Check if target reached
                                          ↓
                                   If complete:
                                   - Add to completedWeeklyChallenges
                                   - Award XP to user
                                   - Show toast notification
                                   - Save to localStorage
```

---

## Firebase Integration

### Firestore Collections

| Collection | Documents | Fields |
|------------|-----------|--------|
| `drafts` | Draft sessions | id, hostId, type, status, players[], playerIds[], currentPlayerId, currentRound, currentPick, pickOrder[], availableAssets[], pickHistory[], pickDeadline, battleEndTime, lockedPrices, finalStandings |
| `challenges` | In-battle challenges | battleId, username, type, status, createdAt, resolvedAt |
| `users` | User profiles | username, odUserId, xp, rank, wins, losses |

### Draft Document Shape

```javascript
{
  id: "abc123",
  hostId: "user_123",
  type: "stocks",                    // or "crypto"
  status: "active",                  // waiting, active, completed, battle, cancelled
  shareCode: "ABC123",

  players: [
    {
      odUserId: "user_123",
      username: "Player1",
      isCPU: false,
      isHost: true,
      roster: [],
      lastPresence: Timestamp
    }
  ],
  playerIds: ["user_123", "user_456", ...],

  currentPlayerId: "user_123",
  currentRound: 1,
  currentPick: 1,
  pickOrder: ["user_123", "user_456", "user_789", "user_012",
              "user_012", "user_789", "user_456", "user_123", ...],  // Snake pattern

  availableAssets: [...],            // Assets not yet picked
  pickHistory: [
    { playerId: "user_123", symbol: "AAPL", round: 1, pick: 1, timestamp: Timestamp }
  ],

  pickDeadline: Timestamp,           // Current pick expires
  battleStartTime: "2025-12-12T...", // When battle phase begins
  battleEndTime: "2025-12-13T...",   // When battle ends

  lockedPrices: {                    // Prices locked at battle start
    "AAPL": 185.50,
    "MSFT": 378.20
  },

  finalStandings: [                  // After battle completes
    { odUserId: "user_123", finalRank: 1, finalGain: 5.2 }
  ]
}
```

### Firebase Service Functions (draftService.js)

```javascript
// Draft CRUD
createDraft(hostId, type)           // Creates new draft lobby
joinDraft(draftId, player)          // Adds player to draft
startDraft(draftId)                 // Begins draft (status: active)
makePick(draftId, playerId, asset)  // Records asset pick
handleAutopick(draftId, playerId)   // Auto-selects for CPU/absent
completeDraft(draftId)              // Ends draft phase

// Draft Queries
subscribeToDraft(draftId, callback) // Real-time listener
getUserActiveDraft(userId)          // Find user's active draft
getUserCompletedDraftBattles(userId)// History query

// Battle Phase
storeDraftLockedPrices(draftId)     // Lock prices at battle start
completeDraftBattle(draftId)        // Calculate final standings

// Presence
updatePlayerPresence(draftId, userId)
checkAbsentPlayers(draftId)
```

---

## localStorage Persistence

### Storage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `portfolioDuelBattles` | Battle[] | All Classic battles |
| `portfolioDuelUser` | User | Current user data |
| `tradeseven_previous_battles` | Battle[] | Archived battles |
| `weeklyChallenges_{userId}` | WeeklyChallengeData | Weekly challenge state |
| `challengeHistory_{userId}` | Challenge[] | Completed challenge history |

### Weekly Challenges Storage Shape

```javascript
// Key: weeklyChallenges_PlayerName
{
  weekStartDate: "2025-12-09",       // Monday of current week
  challenges: [...],                  // 4 selected challenges
  activeDailyChallenge: {...} | null,
  progress: {                         // Progress per challenge ID
    "classic_first_win": 1,
    "uni_5_battles": 3
  },
  completedChallenges: [...],
  slotMachineShown: true
}
```

### localStorage Service (LocalStorage.js)

```javascript
// Battles
loadBattlesSafe()                   // Returns Battle[] or []
saveBattlesSafe(battles)            // Saves with error handling
isSameBattles(a, b)                 // Deep comparison

// User
loadUser()                          // Returns User or null
saveUser(user)                      // Persists user object

// Cleanup
clearAllData()                      // Removes all storage
```

### Sync Pattern

```javascript
// 1. Load on mount
useEffect(() => {
  const saved = loadBattlesSafe();
  setBattles(saved);
}, []);

// 2. Save on change
useEffect(() => {
  const saved = loadBattlesSafe();
  if (!isSameBattles(battles, saved)) {
    saveBattlesSafe(battles);
  }
}, [battles]);

// 3. Cross-tab sync
useEffect(() => {
  const handleStorageChange = (e) => {
    if (e.key === 'portfolioDuelBattles') {
      setBattles(JSON.parse(e.newValue));
    }
  };
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

---

## API Integrations

### Stock API (Finnhub)

```javascript
// Config
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

// Endpoint
async function getStockPrice(symbol) {
  const response = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
  );
  const data = await response.json();
  return {
    symbol,
    price: data.c,           // Current price
    change: data.d,          // Dollar change
    percentChange: data.dp   // Percent change
  };
}
```

### Crypto API (CoinGecko)

```javascript
// With CORS proxy fallback
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

async function getCryptoPrice(cryptoId) {
  // Try direct first
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true`;

  // Fallback to proxy
  const proxiedUrl = CORS_PROXY + encodeURIComponent(url);

  // Fallback to hardcoded prices
  return FALLBACK_CRYPTO_PRICES[cryptoId];
}
```

### Supported Assets

**Stocks (15):** AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, BRK.B, V, JPM, WMT, MA, PG, UNH, HD

**Crypto (18):** BTC, ETH, BNB, SOL, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI, LTC, XLM, XMR, ALGO, ATOM, NEAR

---

## Research Mode State

### Data Enrichment Functions

```javascript
// Located at lines 528-770

enrichAllAssetsWithResearch(stocksArray, cryptoArray)
  → enrichAssetWithResearch(asset, categoryAssets)
    → calculateMomentumStreak(historicalPrices)
    → calculateRangePosition(currentPrice, historicalPrices)
    → analyzeVolatilityContext(historicalPrices, currentVolatility)
    → calculateRelativePerformance(asset, allAssets)
    → generateResearchInsights(enrichedAsset)
```

### Enriched Asset Shape

```javascript
{
  // Base asset properties
  symbol: "AAPL",
  name: "Apple",
  price: 185.50,
  ...

  // Research enrichments
  momentum: {
    streak: 3,
    direction: 'up',
    upDays: 5,
    downDays: 2,
    totalDays: 7,
    description: "Strong momentum - up 5 of last 7 days"
  },

  rangePosition: {
    position30d: 85,
    position52w: 72,
    min30d: 175.20,
    max30d: 190.00,
    label: "Upper range",
    nearHigh: false,
    nearLow: false
  },

  volatilityContext: {
    level: 'medium',
    vsHistorical: 'normal',
    avgDailySwing: 1.2,
    description: "Normal volatility levels"
  },

  relativePerformance: {
    rank7d: 3,
    rank30d: 5,
    totalInCategory: 15,
    vs7dAvg: 2.1,
    vs30dAvg: 1.5,
    description: "Top performer - #3 in category this week"
  },

  insights: {
    reasons: [
      { icon: '📈', text: 'Strong 30-day performance (+12.5%)' }
    ],
    considerations: [
      { icon: '⚠️', text: 'Trading near 30-day high - limited upside?' }
    ]
  },

  categoryRank7d: 3
}
```

---

## Weekly Challenges State

### Challenge Pool Structure (Lines 839-886)

```javascript
const CHALLENGE_POOL = {
  classic: [
    // 10 challenges (3 easy, 4 medium, 3 hard)
  ],
  snake: [
    // 9 challenges (3 easy, 3 medium, 3 hard)
  ],
  universal: [
    // 11 challenges (3 easy, 4 medium, 4 hard)
  ]
};
```

### Challenge Shape

```javascript
{
  id: 'classic_first_win',
  name: 'First Blood',
  description: 'Win a Classic battle',
  gameMode: 'classic',           // classic, snake, universal
  difficulty: 'easy',            // easy, medium, hard
  xp: 100,                       // 100, 250, or 500
  target: 1,                     // Progress goal
  type: 'wins',                  // Challenge type for progress tracking
  icon: '⚔️',

  // Added when selected for week
  slot: 'classic',               // classic, snake, universal, wildcard
  slotLabel: 'Classic Mode'
}
```

### XP Rewards

```javascript
const CHALLENGE_XP = {
  easy: 100,
  medium: 250,
  hard: 500,
  weeklyBonus: 250  // Complete all 4
};
```

### Challenge Types for Progress Tracking

| Type | Description | Example |
|------|-------------|---------|
| `wins` | Count wins | Win 1 battle |
| `completions` | Count completed battles | Complete 3 battles |
| `win_streak` | Consecutive wins (resets on loss) | Win 3 in a row |
| `green_assets` | Assets with positive return | 5+ green assets in win |
| `all_green` | All assets positive | Perfect portfolio |
| `positive_return` | Any positive return | Finish with gain |
| `total_completions` | Any mode completions | 5 battles any mode |
| `total_wins` | Any mode wins | 5 wins any mode |
| `top_half_finish` | Snake Draft top 2 | Finish 1st or 2nd |
| `top_half_count` | Multiple top 2 finishes | Top 2 in 3 drafts |
| `play_both_modes` | Complete both modes | 1 Classic + 1 Draft |
| `win_both_modes` | Win both modes | Win in Classic + Draft |

### Weekly Reset Logic

```javascript
// Get Monday of current week
const getWeekStartDate = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
};

// Check for reset
const isNewWeek = (lastWeekStart) => {
  return getWeekStartDate() !== lastWeekStart;
};
```

---

## useEffect Hooks Summary

| Lines | Purpose | Dependencies |
|-------|---------|--------------|
| 1841-1847 | Load user from localStorage on mount | `[]` |
| 1850-1854 | Save user on change | `[user]` |
| 1856-1867 | Load weekly challenges on login | `[user]` |
| 1870-1896 | Load market data, refresh every 5 min | `[]` |
| 1899-1924 | Load battles, clean old waiting battles | `[]` |
| 1927-1932 | Persist battles on change | `[battles]` |
| 1935-1942 | Refresh battles on screen change | `[screen]` |
| 1945-1956 | Poll for battle updates on dashboard | `[screen, battles]` |
| 1959-2033 | Fetch active draft battles | `[screen, user]` |
| 2036-2070 | Fetch completed draft battles | `[screen, historyTab, user]` |
| 2073-2087 | Cross-tab localStorage sync | `[]` |
| 2090-2161 | Fetch battle prices | `[screen, currentBattle]` |
| 2164-2218 | Check for completed battles | `[user]` |
| 2221-2225 | Load previous battles | `[user, screen]` |
| 2228-2253 | Load in-battle challenges | `[screen, currentBattle, user, battles]` |
| 2256-2303 | Firebase draft subscription | `[currentDraft?.id, screen]` |
| 2306-2320 | Draft pick timer countdown | `[screen, draftState?.pickDeadline]` |
| 2323-2362 | CPU/absent player autopick | `[screen, draftState?.currentPlayerId]` |
| 2365-2386 | Player presence heartbeat | `[screen, draftState?.id, user]` |
| 2389-2409 | Check absent players (host only) | `[screen, draftState, user]` |
| 2412-2436 | Check active draft for rejoin banner | `[screen, user]` |
| 2439-2450 | Browser close warning | `[screen, draftState?.status]` |
| 2453-2489 | CPU auto-swap in free agency | `[currentDraft?.id, currentDraft?.status]` |

---

## Summary

The MarketClash app uses a **single-component architecture** with:

- **65+ useState hooks** organized by feature area
- **String-based screen routing** via `screen` state
- **Hybrid persistence**: localStorage for Classic battles, Firebase for Snake Draft
- **Real-time subscriptions** for multiplayer draft functionality
- **Polling intervals** for price updates and battle status
- **Cross-tab sync** via storage events

### Key Patterns

1. **No external state management library** - Pure React useState
2. **useEffect-based data loading** with cleanup
3. **localStorage as primary storage** for single-player features
4. **Firebase Firestore** for multiplayer synchronization
5. **Optimistic updates** with server reconciliation
6. **Presence heartbeats** for multiplayer sessions
