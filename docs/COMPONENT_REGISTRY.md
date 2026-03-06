# FantasyTrades Component Registry

**Last Updated:** 2025-12-12

This document catalogs every screen and reusable component in the FantasyTrades app.

---

## Table of Contents
- [Screen Overview](#screen-overview)
- [Classic Mode Screens](#classic-mode-screens)
- [Snake Draft Mode Screens](#snake-draft-mode-screens)
- [Shared Screens](#shared-screens)
- [Global Overlay Components](#global-overlay-components)
- [Reusable Inline Components](#reusable-inline-components)

---

## Screen Overview

Total Screens Found: **21**

| Category | Count | Screens |
|----------|-------|---------|
| Classic Mode | 6 | home, dashboard, builder, join, training, battle |
| Snake Draft | 9 | draftSetup, draftJoin, draftTraining, draftLobby, draftRoom, draftBattle, draftResults, draftHistory, freeAgency |
| History/Profile | 4 | battleHistory, previousBattles, wins, losses |
| Profile | 1 | profile |
| Research Mode | 1 | (modal state on dashboard, not separate screen) |

---

## Classic Mode Screens

### 1. `home` (Login Screen)
**Line:** ~3242

**Purpose:** Landing page for new/returning users to enter username and start playing.

**Key UI Elements:**
- FantasyTrades logo (bull vs bear animation)
- Username input field
- "Enter Arena" button (primary cyan CTA)
- Dark themed card container

**State Variables Used:**
- `username` (read/write)
- `setUser()` (write)
- `setScreen()` (write)

**Navigation:**
- FROM: None (entry point)
- TO: `dashboard`

---

### 2. `dashboard` (Main Hub)
**Line:** ~4037

**Purpose:** Central hub displaying user stats, active battles, game mode selection, and quick actions.

**Key UI Elements:**
- User profile header (avatar, rank, XP progress)
- XP Progress Modal (expandable)
- Game Mode Toggle (Classic vs Snake Draft)
- Active Battles section with live stats
- Waiting Battles section (pending opponent)
- Create Battle / Join Battle cards
- Active Draft Battles section
- Research Assets banner
- Weekly Challenges section (collapsible)
- Completed Battles list
- Bottom navigation (History, Profile)

**State Variables Used:**
- `user` (read)
- `showXPModal`, `setShowXPModal` (read/write)
- `gameMode`, `setGameMode` (read/write)
- `showWeeklyChallenges`, `setShowWeeklyChallenges` (read/write)
- `weeklyChallenges` (read)
- `activeDailyChallenge` (read)
- `completedWeeklyChallenges` (read)
- `showResearchMode`, `setShowResearchMode` (read/write)
- `battles` (read)
- `activeDraftBattles` (read)

**Navigation:**
- FROM: `home`, `builder`, `join`, `training`, `battle`, `profile`, `battleHistory`, all draft screens
- TO: `builder`, `join`, `training`, `battle`, `draftSetup`, `draftJoin`, `draftTraining`, `profile`, `battleHistory`

---

### 3. `builder` (Portfolio Builder)
**Line:** ~6091

**Purpose:** Create a portfolio by selecting assets and allocating percentages for Classic 1v1 battles.

**Key UI Elements:**
- Header with back button and portfolio name input
- Asset type toggle (Stocks/Crypto)
- Search bar
- Asset cards with allocation controls
- Portfolio summary panel (total allocation, asset count)
- "Create Battle" / "Update Portfolio" button
- Allocation slider per asset
- Remove asset button

**State Variables Used:**
- `assetType`, `setAssetType` (read/write)
- `searchTerm`, `setSearchTerm` (read/write)
- `portfolio`, `setPortfolio` (read/write)
- `portfolioType`, `setPortfolioType` (read/write)
- `portfolioName`, `setPortfolioName` (read/write)
- `stocksData`, `cryptoData` (read)

**Navigation:**
- FROM: `dashboard`
- TO: `dashboard` (back), waiting state created

---

### 4. `join` (Join Battle)
**Line:** ~6944

**Purpose:** Enter a challenge code to join someone else's battle.

**Key UI Elements:**
- Back button
- Challenge code input (6-character)
- "Join Battle" button
- Asset selector (same as builder)
- Portfolio builder interface

**State Variables Used:**
- `joinCode`, `setJoinCode` (read/write)
- `portfolio`, `setPortfolio` (read/write)
- All portfolio builder state

**Navigation:**
- FROM: `dashboard`
- TO: `dashboard` (back), `battle` (after joining)

---

### 5. `training` (Training Mode)
**Line:** ~7860

**Purpose:** Practice against CPU opponent in Classic mode.

**Key UI Elements:**
- Purple-themed header (training mode indicator)
- Asset selector and portfolio builder
- CPU difficulty indicator
- "Start Training Battle" button

**State Variables Used:**
- All portfolio builder state
- CPU portfolio generated automatically

**Navigation:**
- FROM: `dashboard`
- TO: `dashboard`, `battle`

---

### 6. `battle` (Live Battle View)
**Line:** ~12102

**Purpose:** View active battle status, compare portfolios, track performance.

**Key UI Elements:**
- Battle header with timer
- Your portfolio vs Opponent portfolio tabs
- Asset performance cards with gain/loss
- Total portfolio value display
- Real-time price updates
- Winner announcement (when completed)

**State Variables Used:**
- `currentBattle`, `setCurrentBattle` (read/write)
- `battlePrices` (read)
- `battleViewTab`, `setBattleViewTab` (read/write)
- `expandedAssets`, `setExpandedAssets` (read/write)

**Navigation:**
- FROM: `dashboard`, `join`, `training`
- TO: `dashboard` (back)

---

## Snake Draft Mode Screens

### 7. `draftSetup` (Create Draft)
**Line:** ~8679

**Purpose:** Configure and create a new Snake Draft lobby.

**Key UI Elements:**
- Asset type selector (Stocks/Crypto)
- Draft settings info
- "Create Draft Lobby" button
- Share code preview

**State Variables Used:**
- `assetType`, `setAssetType` (read/write)

**Navigation:**
- FROM: `dashboard`
- TO: `draftLobby`

---

### 8. `draftJoin` (Join Draft)
**Line:** ~8878

**Purpose:** Enter draft code to join existing Snake Draft lobby.

**Key UI Elements:**
- Draft code input
- "Join Draft" button

**State Variables Used:**
- `draftJoinCode`, `setDraftJoinCode` (read/write)

**Navigation:**
- FROM: `dashboard`
- TO: `draftLobby`, `draftRoom`

---

### 9. `draftTraining` (Training Draft)
**Line:** ~8997

**Purpose:** Practice Snake Draft with CPU opponents.

**Key UI Elements:**
- Asset type selector
- "Start Training Draft" button
- Purple training mode indicator

**State Variables Used:**
- `assetType`, `setAssetType` (read/write)

**Navigation:**
- FROM: `dashboard`
- TO: `draftRoom`

---

### 10. `draftLobby` (Waiting Room)
**Line:** ~9130

**Purpose:** Waiting room for players to join before draft starts.

**Key UI Elements:**
- Share code display with copy button
- Player slots (4 total, shows joined/waiting)
- "Start Draft" button (host only, when 4 players)
- Leave button

**State Variables Used:**
- `draftState`, `setDraftState` (read/write)
- `draftCopied`, `setDraftCopied` (read/write)

**Navigation:**
- FROM: `draftSetup`, `draftJoin`
- TO: `draftRoom`, `dashboard` (leave)

---

### 11. `draftRoom` (Live Draft)
**Line:** ~9386

**Purpose:** Live snake draft interface where players take turns picking assets.

**Key UI Elements:**
- Draft board header with round/pick info
- Current picker highlight
- Timer countdown
- Asset pool organized by categories (Steady, Risky, Defensive)
- Category tabs
- Pick history panel
- Your roster display (collapsible on mobile)
- Autopick countdown indicator

**State Variables Used:**
- `draftState`, `setDraftState` (read/write)
- `selectedDraftCategory`, `setSelectedDraftCategory` (read/write)
- `draftTimeRemaining`, `setDraftTimeRemaining` (read/write)
- `activeDraftBanner`, `setActiveDraftBanner` (read/write)
- `autopickCountdown`, `setAutopickCountdown` (read/write)
- `isRosterExpanded`, `setIsRosterExpanded` (read/write)

**Navigation:**
- FROM: `draftLobby`, `draftTraining`
- TO: `draftBattle`, `draftResults`

---

### 12. `draftBattle` (Draft Battle View)
**Line:** ~10878

**Purpose:** View Snake Draft battle standings and asset performance.

**Key UI Elements:**
- ESPN-style standings leaderboard
- Player cards with positions (1st, 2nd, 3rd, 4th)
- Asset comparison view
- Battle timer
- Expandable asset performance details

**State Variables Used:**
- `standings`, `setStandings` (local state)
- `expandedCards`, `setExpandedCards` (local state)
- `timeRemaining`, `setTimeRemaining` (local state)
- `assetComparison`, `setAssetComparison` (local state)

**Navigation:**
- FROM: `draftRoom`, `draftHistory`
- TO: `draftResults`, `dashboard`

---

### 13. `draftResults` (Draft Results)
**Line:** ~10360

**Purpose:** Display final results of completed Snake Draft battle.

**Key UI Elements:**
- Podium display (1st, 2nd, 3rd, 4th)
- Your ranking highlight
- XP earned display
- Player performance breakdown
- Asset performance summary
- "Back to Dashboard" button

**State Variables Used:**
- Draft result data from `currentDraft`

**Navigation:**
- FROM: `draftBattle`
- TO: `dashboard`

---

### 14. `draftHistory` (Draft Battle History)
**Line:** ~10075

**Purpose:** View history of past Snake Draft battles.

**Key UI Elements:**
- List of completed drafts
- Filter/sort options
- Draft summary cards
- Stats summary (wins, podiums, total)

**State Variables Used:**
- `draftHistory`, `setDraftHistory` (local state)
- `draftStats`, `setDraftStats` (local state)
- `historyLoading`, `setHistoryLoading` (local state)
- `selectedHistoryDraft`, `setSelectedHistoryDraft` (local state)

**Navigation:**
- FROM: `dashboard`
- TO: `draftBattle` (view past battle), `dashboard`

---

### 15. `freeAgency` (Free Agency Window)
**Line:** ~11547

**Purpose:** Trade/swap assets during free agency windows in Snake Draft.

**Key UI Elements:**
- Free agent pool by category
- Current roster display
- Swap controls
- Swap history
- Window status timer
- Confirm swap modal

**State Variables Used:**
- `freeAgents`, `setFreeAgents` (local state)
- `playerRoster`, `setPlayerRoster` (local state)
- `selectedCategory`, `setSelectedCategory` (local state)
- `swapsRemaining`, `setSwapsRemaining` (local state)
- `isWindowOpen`, `setIsWindowOpen` (local state)
- `showConfirmModal`, `setShowConfirmModal` (local state)

**Navigation:**
- FROM: `draftBattle`
- TO: `draftBattle` (back)

---

## Shared Screens

### 16. `battleHistory` (Battle History)
**Line:** ~13281

**Purpose:** View history of all completed Classic battles.

**Key UI Elements:**
- Tab selector (Classic / Draft)
- Battle list with win/loss indicators
- Battle stats summary
- Expandable battle details

**State Variables Used:**
- `historyTab`, `setHistoryTab` (read/write)
- `completedBattles` (derived from `battles`)
- `completedDraftBattles` (read)

**Navigation:**
- FROM: `dashboard`
- TO: `dashboard` (back), `previousBattles`

---

### 17. `previousBattles` (Past Battles Detail)
**Line:** ~12711

**Purpose:** Detailed view of past Classic battles.

**Key UI Elements:**
- Battle card list
- Win/loss summary
- Click to expand details

**State Variables Used:**
- `previousBattles`, `setPreviousBattles` (read/write)
- `selectedPreviousBattle`, `setSelectedPreviousBattle` (read/write)

**Navigation:**
- FROM: `battleHistory`
- TO: `battleHistory` (back)

---

### 18. `wins` (Wins Screen)
**Line:** ~13069

**Purpose:** Display all won battles.

**Key UI Elements:**
- Won battle cards
- Success themed (green)

**Navigation:**
- FROM: `battleHistory`
- TO: `battleHistory` (back)

---

### 19. `losses` (Losses Screen)
**Line:** ~13180

**Purpose:** Display all lost battles.

**Key UI Elements:**
- Lost battle cards
- Error themed (red)

**Navigation:**
- FROM: `battleHistory`
- TO: `battleHistory` (back)

---

### 20. `profile` (User Profile)
**Line:** ~13629

**Purpose:** View and manage user profile, stats, and settings.

**Key UI Elements:**
- User avatar and username
- Rank badge
- XP progress bar
- Stats grid (battles, wins, W/L ratio)
- Achievements section
- Sign out button

**State Variables Used:**
- `user` (read)
- `battles` (read for stats)

**Navigation:**
- FROM: `dashboard`
- TO: `dashboard` (back)

---

## Global Overlay Components

### Research Mode Screen
**Location:** Lines ~3420-4030 (rendered before dashboard conditional)

**Triggered by:** `showResearchMode === true`

**Purpose:** Asset research and analysis before building portfolios.

**Key UI Elements:**
- Asset type toggle (Stocks/Crypto)
- Search bar
- Sort options (rank, 7d, 30d, win rate, volatility)
- Expandable asset cards with:
  - Sparkline charts
  - Performance badges
  - Why Pick This? reasons
  - Things to Consider warnings
  - 30-day range visualization
  - Category rank
  - FantasyTrades community stats
- Compare panel (up to 3 assets)
- Add to Portfolio button

---

### ChallengeToast Component
**Line:** ~3046

**Purpose:** Toast notifications for challenge events.

**Triggered by:** `showChallengeToast === true`

---

### SlotMachineOverlay Component
**Line:** ~3080

**Purpose:** Animated reveal of new weekly challenges.

**Triggered by:** `showSlotMachine === true`

---

### XP Progress Modal
**Line:** ~4095 (inside dashboard)

**Purpose:** Detailed XP progress and rank information.

**Triggered by:** `showXPModal === true`

---

## Reusable Inline Components

### FantasyTradesLogo
**Line:** ~8-197

**Purpose:** SVG logo with bull vs bear animation.

**Props:**
- `size`: 'large' | 'medium' | 'small'

---

### MiniSparkline
**Line:** ~917

**Purpose:** Small sparkline chart for inline price visualization.

**Props:**
- `isPositive`: boolean
- `width`: number (default 70)
- `height`: number (default 24)

---

### ResearchSparkline
**Line:** Inside Research Mode (~3565)

**Purpose:** Sparkline for research mode asset cards.

**Props:**
- `prices`: number[]
- `width`: number (default 100)
- `height`: number (default 40)

---

### MiniResultCard
**Line:** ~1050-1150 (approximately)

**Purpose:** Compact battle result display card.

**Props:**
- `battle`: Battle object
- `user`: User object

---

### TrainingResultCard
**Line:** ~1300-1500 (approximately)

**Purpose:** Training battle result card with CPU opponent.

---

### Navigation State Pattern

The app uses a simple string-based screen routing:

```javascript
const [screen, setScreen] = useState('home');

// Navigation example
setScreen('dashboard');
setScreen('builder');
// etc.
```

Each screen is rendered conditionally:

```javascript
if (screen === 'home') {
  return ( /* Login Screen JSX */ );
}

if (screen === 'dashboard') {
  return ( /* Dashboard JSX */ );
}

// ... and so on
```
