# FantasyTrades Architecture Notes

## State Management

### Global State (App.jsx)
```javascript
// User & Auth
const { user, login, logout, updateUser } = useUser();

// Navigation
const [screen, setScreen] = useState('home');

// Market Data
const [stocksData, setStocksData] = useState([]);
const [cryptoData, setCryptoData] = useState([]);

// Battles
const [battles, setBattles] = useState([]);
const [currentBattle, setCurrentBattle] = useState(null);

// Draft Mode
const [currentDraft, setCurrentDraft] = useState(null);
const [draftState, setDraftState] = useState(null);

// Game Mode Toggle
const [gameMode, setGameMode] = useState('draft'); // 'classic' or 'draft'

// Portfolio Builder
const [portfolio, setPortfolio] = useState([]);
const [portfolioType, setPortfolioType] = useState(null);
```

### Context Providers
- `UserContext` - User authentication state via `useUser()` hook

### Custom Hooks (in /hooks/)
Each hook encapsulates related state and logic:
- `useDraft()` - All draft-related state
- `useBattles()` - Battle management
- `usePortfolio()` - Portfolio building
- `useResearch()` - Research mode state
- `useChallenges()` - Weekly challenges
- `useBaggerBombBattle()` - BaggerBomb game state

## Screen Routing

Screens are rendered conditionally in App.jsx:

```javascript
// Extracted screens use components
if (screen === 'profile') {
  return (
    <ProfileScreen
      user={user}
      onBack={() => setScreen('dashboard')}
    />
  );
}

// Non-extracted screens are inline
if (screen === 'dashboard') {
  return (
    <div>
      {/* ~7,000 lines of dashboard JSX */}
    </div>
  );
}
```

## Props Pattern

### Common Props for All Screens
```javascript
// Navigation
onBack={() => setScreen('dashboard')}
onNavigate={(screen) => setScreen(screen)}
setScreen={setScreen}

// Styling
containerStyle={containerStyle}
colors={colors}
isDesktop={isDesktop}

// User Data
user={user}
```

### Screen-Specific Props
```javascript
// Battle screens
currentBattle={currentBattle}
battlePrices={battlePrices}

// Draft screens
currentDraft={currentDraft}
draftState={draftState}
selectedDraftCategory={selectedDraftCategory}

// Market data screens
stocksData={stocksData}
cryptoData={cryptoData}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        App.jsx                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   EODHD API  │  │   Firebase   │  │ UserContext  │      │
│  │  (stocks/    │  │  (battles/   │  │   (auth)     │      │
│  │   crypto)    │  │   drafts)    │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         ▼                 ▼                  ▼               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Global State (useState)                 │   │
│  │  stocksData, cryptoData, battles, currentDraft, etc │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│                      Props  │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Screen Components                       │   │
│  │  ProfileScreen, DraftRoomScreen, BattleViewScreen   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Firebase Structure

```
Firestore:
/drafts/{draftId}
  - code: "ABC123"
  - status: "waiting" | "active" | "completed"
  - players: [{odUserId, displayName, picks, categories}]
  - currentPlayerId: "user123"
  - availableAssets: {steady: [], risky: [], defensive: []}
  - lockedPrices: {AAPL: 150.25, ...}

Realtime Database:
/battles/{odUserId}/{odBattleId}
  - creator, opponent
  - creatorPortfolio, opponentPortfolio
  - status, winner, endTime
```

## Design Tokens

Color system defined in App.jsx:
```javascript
const colors = {
  // Backgrounds
  background: '#0a0a0f',
  cardBg: '#12121a',

  // Primary colors
  cyan: '#00d9ff',
  green: '#10b981',
  greenBright: '#00ff88',
  red: '#ef4444',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',

  // Borders
  border: '#21262d',
  borderSubtle: '#1a1f2e',
};
```

## Services

### eodhdAPI.js
- `getAllStockPrices(symbols)` - Batch fetch stock prices
- `getAllCryptoPrices(symbols)` - Batch fetch crypto prices
- `symbolToCoinGeckoId(symbol)` - Convert crypto symbol to CoinGecko ID
- `clearCache()` - Clear price cache

### draftService.js
- `createDraft(options)` - Create new draft battle
- `joinDraft(code, user)` - Join existing draft
- `makePick(draftId, userId, asset)` - Make a draft pick
- `handleAutopick(draftId, userId)` - CPU autopick

### freeAgencyService.js
- `getFreeAgents(draftId)` - Get available free agents
- `swapAsset(draftId, userId, dropSymbol, addSymbol)` - Swap roster asset

## Dynamic Imports

Screens use dynamic imports for services to enable code splitting:
```javascript
const handlePick = async (asset) => {
  const draftService = await import('../services/draftService');
  await draftService.makePick(roomDraft.id, currentUserId, asset);
};
```

## Future Architecture Improvements

1. **React Context for complex screens** - Reduce prop drilling for Dashboard/Builder
2. **Screen lazy loading** - `React.lazy()` for non-critical screens
3. **State machines** - XState for complex flows (draft, battle)
4. **Design token migration** - Move inline colors to CSS variables
5. **TypeScript** - Add type safety for props and state
