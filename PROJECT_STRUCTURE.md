# MarketClash Project Structure

## Overview

MarketClash is a competitive financial gaming app built with React 18, Vite, Firebase, and Tailwind CSS. The app allows users to build virtual $1M portfolios and compete head-to-head.

## Directory Structure

```
src/
├── App.jsx                 # Main app component (~26,000 lines)
├── main.jsx               # React entry point
├── index.css              # Global styles
│
├── screens/               # Extracted screen components (17 files)
│   ├── ProfileScreen.jsx
│   ├── WinsScreen.jsx
│   ├── LossesScreen.jsx
│   ├── DraftHistoryScreen.jsx
│   ├── JoinScreen.jsx
│   ├── DraftSetupScreen.jsx
│   ├── DraftJoinScreen.jsx
│   ├── DraftTrainingScreen.jsx
│   ├── DraftLobbyScreen.jsx
│   ├── PreviousBattlesScreen.jsx
│   ├── BattleHistoryScreen.jsx
│   ├── FreeAgencyScreen.jsx
│   ├── DraftResultsScreen.jsx
│   ├── BattleViewScreen.jsx
│   ├── DraftRoomScreen.jsx
│   ├── DraftBattleScreen.jsx
│   ├── HomeScreen.jsx
│   └── index.js
│
├── components/            # Reusable UI components
│   ├── Dashboard/        # Dashboard-specific components
│   ├── Research/         # Research mode components
│   ├── BaggerBomb/       # BaggerBomb game components
│   ├── GamePlan/         # Game plan components
│   ├── shared/           # Shared/common components
│   ├── ui/               # Base UI components
│   ├── DesktopBackground.jsx  # Animated background
│   ├── MarketClashLogo.jsx    # App logo SVG
│   ├── ResearchAdvisor.jsx
│   └── DraftAdvisor.jsx
│
├── hooks/                 # Custom React hooks
│   ├── useBaggerBombBattle.js
│   ├── useDraft.js
│   ├── useResearch.js
│   ├── useBattles.js
│   ├── usePortfolio.js
│   └── useChallenges.js
│
├── contexts/              # React Context providers
│   └── UserContext.jsx
│
├── services/              # API and external services
│   ├── eodhdAPI.js       # Stock/crypto market data
│   ├── draftService.js   # Draft battle management
│   ├── freeAgencyService.js
│   ├── battleTimer.js
│   └── challengeService.js
│
├── firebase/              # Firebase configuration
│   ├── config.js
│   └── firebaseService.js
│
├── data/                  # Static data files
│   ├── eventWatchlist.js
│   └── weekAheadEvents.js
│
└── utils/                 # Helper functions
    └── battleHelpers.js
```

## Key Files

### App.jsx (~26,000 lines)
The main application file containing:
- Global state management
- Screen routing logic
- Market data fetching (EODHD API)
- Firebase battle subscriptions
- **Still contains:** DashboardScreen (~7,000 lines), BuilderScreen (~1,900 lines)

### Screen Components
17 screens have been extracted to `/src/screens/`. Each screen:
- Receives props from App.jsx
- Handles its own local state
- Uses dynamic imports for services

### Shared Components
- `DesktopBackground.jsx` - Animated particle background with bull/bear silhouettes
- `MarketClashLogo.jsx` - SVG logo with bull, bear, and honey pot

### Custom Hooks
- `useBaggerBombBattle.js` - BaggerBomb game state
- `useDraft.js` - Snake draft state management
- `useResearch.js` - Research mode state
- `useBattles.js` - Battle management
- `usePortfolio.js` - Portfolio building state
- `useChallenges.js` - Weekly challenges state

## Game Modes

1. **Classic 1v1** - Build portfolio, battle opponent, compare returns
2. **Snake Draft** - 4-player fantasy-style draft, week-long battle
3. **BaggerBomb** - Session-based scoring with volatility bonuses
4. **Training** - Practice against CPU opponents
5. **Stonk Options** - Binary options trading game

## External APIs

- **EODHD** - Stock and crypto market data (professional tier)
- **Firebase** - Authentication, Realtime Database, Firestore
- **Claude API** - AI advisors for research

## Deployment

- **Platform:** Vercel
- **Auto-deploy:** GitHub integration on main branch
- **Environment:** Production variables in Vercel dashboard
