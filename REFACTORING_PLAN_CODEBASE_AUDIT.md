# FantasyTrades Codebase Refactoring Plan

**Created:** January 31, 2026
**Context:** Post V3 BaggerBomb schema crash debugging session
**Goal:** Prevent similar bugs, reduce technical debt, improve maintainability

---

## 1. Current State Summary

### File Statistics

| Metric | Count |
|--------|-------|
| **App.jsx lines** | 22,424 |
| **Total codebase lines** | 123,897 |
| **App.jsx % of codebase** | 18.1% |
| **Screen components** | 25 files |
| **Component files** | 194 files |
| **Hook files** | 12 files |
| **Utility files** | 10 files |
| **Service files** | 47 files |

### Largest Files (Lines)

| File | Lines | Notes |
|------|-------|-------|
| `src/App.jsx` | 22,424 | **Critical - needs extraction** |
| `src/firebase/firebaseService.js` | 3,693 | Large but focused |
| `src/components/BaggerBomb/PortfolioBuilderBaggerBomb.jsx` | 1,975 | Complex builder |
| `src/screens/BuilderScreen.jsx` | 1,746 | Recently extracted |
| `src/components/draft/AssetResearchModal.jsx` | 1,573 | Modal with research |
| `src/components/optionsArena/StonkOptionsArenaV2.jsx` | 1,385 | Options game |
| `src/screens/EarningsGameScreen.jsx` | 1,349 | Earnings tournament |
| `src/screens/DraftRoomScreen.jsx` | 1,311 | Draft lobby |

### Inline Components Still in App.jsx (Should Be Extracted)

| Component | Line | Purpose |
|-----------|------|---------|
| `AssetPickerModal` | 3966 | Asset selection for game plan |
| `ChallengeModal` | 10503 | Weekly challenge details |
| `BattleHistoryCard` | 10635 | Battle history display |
| `AssetWeightCard` | 10924 | Portfolio weight adjustment |
| `ChallengeToast` | 15177 | Challenge notification toast |
| `MidGameChallengePopup` | 15211 | Mid-game challenge UI |
| `RiskChallengePopup` | 15334 | Risk challenge accept/skip |
| `RiskChallengeResultPopup` | 15715 | Risk challenge results |
| `TutorialModal` | 15901 | Onboarding tutorial |
| `MetricCard` | 16933 | Research metric display |

---

## 2. V3 Schema Risk Assessment

### Pattern Counts

| Risk Pattern | Count | Risk Level |
|--------------|-------|------------|
| `portfolio.filter/map/forEach` | 64 | HIGH |
| `bench.filter/map/forEach` | 14 | MEDIUM |
| `creatorPortfolio/opponentPortfolio` refs | 75 | HIGH |

### Critical V3-Unsafe Locations

These locations directly access portfolio/bench with array methods without V3 flattening:

#### App.jsx - FIXED (RiskChallengePopup)
- **Line 15344** - `userPortfolio.filter()` - **FIXED in this session**

#### App.jsx - Needs Review
| Line | Code Pattern | Risk |
|------|--------------|------|
| 4352-4354 | `portfolio.filter(p => p.tier === ...)` | Low - local portfolio state |
| 4424-4426 | `portfolio.filter(p => p.draftCategory === ...)` | Low - game plan portfolio |
| 9092-9138 | `portfolio.filter()` / `portfolio.forEach()` | Low - builder portfolio |
| 13171 | `currentBattle?.opponentPortfolio \|\| []` | **HIGH - V3 unsafe** |
| 18725-18726 | `battle.creatorPortfolio` / `battle.opponentPortfolio` | **MEDIUM - has fallback** |

#### Components - Needs Review
| File:Line | Pattern | Risk |
|-----------|---------|------|
| `LiveFeed.jsx:421` | `portfolio.map()` | Medium - from battle result |
| `WatchlistNews.jsx:190` | `portfolio.forEach()` | Low - watchlist data |
| `BaggerBombBattleViewRedesign.jsx:292` | `portfolio.forEach()` | Low - already flattened |

### Already Safe Locations (Use Helper Functions)

These locations properly handle V3 format:

| File:Line | Helper Used |
|-----------|-------------|
| `App.jsx:12838-12842` | Uses `flattenForIteration()` |
| `App.jsx:13537-13538` | Uses `flattenPortfolioForPrices()` |
| `App.jsx:13978-13979` | Uses `flattenPortfolioHelper()` |
| `App.jsx:15355-15356` | Uses `flattenPortfolioForRisk()` |
| `priceSnapshotService.js` | Uses `extractFromPortfolio()` |
| `battleTimer.js` | Uses local `flattenPortfolio()` |

---

## 3. Existing Utilities (Use These!)

### src/utils/baggerBombUtils.js

```javascript
// V3 Portfolio Helpers
export function flattenPortfolio(portfolio)  // Tiered object -> flat array
export function flattenBench(bench)          // Bench object -> flat array
export function organizeIntoTiers(flat)      // Flat array -> tiered object

// Scoring
export function calculateAssetScoreV3(asset, priceChange, history)
export function detectThresholdCross(prev, current)
export function getBadgesFromHistory(history)

// Session Timing
export function getCurrentSession()
export function getSessionTimeRemaining()
export function formatTimeRemaining(seconds)
```

### src/utils/battleHelpers.js

```javascript
// User identification
export const getUsername(creatorOrOpponent)
export const getUserId(creatorOrOpponent)
export const isCreator(battle, username)
export const isOpponent(battle, username)

// Portfolio access (handles V1/V2, but returns raw - needs flattening for V3!)
export const getUserPortfolio(battle, username)
export const getOpponentPortfolio(battle, myUsername)

// Battle type detection
export const isBaggerBombBattle(battle)  // Returns true for V2/V3
export const isTrainingBattle(battle)
export const getBattleStatus(battle)
```

### Recommended: Create New Utility

**File:** `src/utils/portfolioHelpers.js`

```javascript
import { flattenPortfolio, flattenBench } from './baggerBombUtils';
import { getUserPortfolio, getOpponentPortfolio } from './battleHelpers';

/**
 * Get user's portfolio from battle, always as flat array
 * Safe for V1, V2, and V3 battles
 */
export const getUserPortfolioFlat = (battle, username) => {
  const raw = getUserPortfolio(battle, username);
  return flattenPortfolio(raw);
};

/**
 * Get opponent's portfolio from battle, always as flat array
 */
export const getOpponentPortfolioFlat = (battle, myUsername) => {
  const raw = getOpponentPortfolio(battle, myUsername);
  return flattenPortfolio(raw);
};

/**
 * Safe portfolio iteration - handles null, arrays, and V3 objects
 */
export const safePortfolioArray = (portfolio) => {
  if (!portfolio) return [];
  if (Array.isArray(portfolio)) return portfolio;
  return flattenPortfolio(portfolio);
};
```

---

## 4. Extraction Candidates from App.jsx

### Priority 1: High Impact, Low Risk

| Component | Lines | Dependencies | Estimated Time |
|-----------|-------|--------------|----------------|
| `RiskChallengePopup` | ~400 | currentBattle, user, challenges | 2 hours |
| `RiskChallengeResultPopup` | ~200 | challenge results | 1 hour |
| `MidGameChallengePopup` | ~150 | challenge state | 1 hour |
| `ChallengeToast` | ~40 | toast message | 30 min |
| `TutorialModal` | ~200 | tutorial state | 1.5 hours |

### Priority 2: Medium Impact

| Component | Lines | Dependencies | Estimated Time |
|-----------|-------|--------------|----------------|
| `AssetPickerModal` | ~300 | stocks, crypto, game plan | 2 hours |
| `ChallengeModal` | ~150 | weekly challenges | 1 hour |
| `BattleHistoryCard` | ~300 | battle data, user | 2 hours |

### Priority 3: State/Logic Extraction

| Extraction | Current Lines | Notes |
|------------|---------------|-------|
| Challenge system state | ~500 | Extract to custom hook |
| Battle management state | ~800 | Extract to context or hook |
| Toast/notification system | ~200 | Extract to hook |
| XP/Level calculations | ~100 | Extract to utility |

---

## 5. Recommended Phases

### Phase 1: Critical Safety Fixes (1-2 days)

**Goal:** Prevent V3 schema crashes

1. **Create `portfolioHelpers.js` utility** (30 min)
   - Add `safePortfolioArray()`, `getUserPortfolioFlat()`, `getOpponentPortfolioFlat()`

2. **Audit remaining V3 risks** (2 hours)
   - Check line 13171 in App.jsx
   - Check LiveFeed.jsx:421
   - Add flattening where needed

3. **Remove debug code** (30 min)
   - Remove `safeFilter`, `safeMap` wrappers
   - Remove debug `console.log` statements
   - Keep ErrorBoundary (useful for production)

### Phase 2: Challenge System Extraction (2-3 days)

**Goal:** Extract ~1000 lines of challenge-related code

1. **Create challenge components folder**
   ```
   src/components/challenges/
   ├── ChallengeToast.jsx
   ├── MidGameChallengePopup.jsx
   ├── RiskChallengePopup.jsx
   ├── RiskChallengeResultPopup.jsx
   ├── ChallengeModal.jsx
   └── index.js
   ```

2. **Create challenge hook**
   ```
   src/hooks/useChallenges.js
   ```
   - Move challenge state management
   - Move challenge-related handlers

### Phase 3: Battle System Cleanup (3-4 days)

**Goal:** Consolidate battle handling

1. **Standardize portfolio access**
   - Replace all direct `battle.creatorPortfolio` with helper functions
   - Always use `safePortfolioArray()` before array methods

2. **Create battle context or hook**
   ```
   src/hooks/useBattle.js
   ```
   - Move `currentBattle` state
   - Move battle-related handlers
   - Centralize V1/V2/V3 format handling

3. **Extract BattleHistoryCard**
   - Move to `src/components/battles/`

### Phase 4: Consistency Improvements (Ongoing)

1. **Standardize imports**
   - All V3 utilities from `baggerBombUtils`
   - All battle helpers from `battleHelpers`
   - All portfolio helpers from new `portfolioHelpers`

2. **Add TypeScript types** (optional, future)
   ```typescript
   interface V3Portfolio {
     star: Asset[];
     core: Asset[];
     support: Asset[];
   }

   interface Battle {
     _v: 1 | 2 | 3;
     creator: string | CreatorObject;
     creatorPortfolio?: Asset[]; // V1/V2
     // ...
   }
   ```

---

## 6. Ready-to-Use Prompts

### Prompt 1: Create Portfolio Helpers Utility

```
Create a new utility file src/utils/portfolioHelpers.js that provides V3-safe portfolio access functions.

Requirements:
1. Import flattenPortfolio and flattenBench from ./baggerBombUtils
2. Import getUserPortfolio and getOpponentPortfolio from ./battleHelpers
3. Export these functions:
   - getUserPortfolioFlat(battle, username) - returns flat array
   - getOpponentPortfolioFlat(battle, myUsername) - returns flat array
   - safePortfolioArray(portfolio) - handles null, array, or V3 object
   - safeBenchArray(bench) - handles null, array, or V3 bench object
4. Add JSDoc comments for each function
5. Export all functions in src/utils/index.js
```

### Prompt 2: Extract Challenge Popups

```
Extract the challenge popup components from App.jsx into separate files.

Files to create:
1. src/components/challenges/ChallengeToast.jsx (from App.jsx line 15177)
2. src/components/challenges/MidGameChallengePopup.jsx (from App.jsx line 15211)
3. src/components/challenges/RiskChallengePopup.jsx (from App.jsx line 15334)
4. src/components/challenges/RiskChallengeResultPopup.jsx (from App.jsx line 15715)
5. src/components/challenges/index.js (barrel export)

Requirements:
- Each component should receive necessary state as props
- Keep the existing styling and functionality
- Import from '../components/challenges' in App.jsx
- Use getUserPortfolioFlat from utils/portfolioHelpers for V3 safety
```

### Prompt 3: Remove Debug Code

```
Remove the temporary debug code added during the filter crash investigation.

Files to update:
1. src/App.jsx
   - Remove safeFilter and safeMap wrapper functions (lines 152-169)
   - Remove DEBUG console.log in dashboard render (lines 18649-18680)
   - Replace safeFilter calls with regular .filter() calls
   - Keep the ErrorBoundary component (useful for production)
   - Remove the global filter error interceptor (lines 205-228)

2. src/components/Dashboard/LiveClashesSection.jsx
   - Remove DEBUG console.log (lines 32-37)

3. src/components/Dashboard/ActiveBattlesSection.jsx
   - Remove DEBUG console.log (lines 25-31)

4. src/components/Dashboard/LiveFeed.jsx
   - Remove DEBUG console.log (lines 630-635)
```

### Prompt 4: Audit V3 Safety

```
Audit the codebase for remaining V3 portfolio safety issues.

Check these specific locations:
1. App.jsx line 13171: currentBattle?.opponentPortfolio || []
   - This may receive V3 tiered object, needs flattenPortfolio

2. LiveFeed.jsx line 421: portfolio.map()
   - Check if this portfolio could be V3 format

3. App.jsx lines 18725-18726: battle.creatorPortfolio / battle.opponentPortfolio
   - Verify V3 handling is complete

For each location:
- Determine if V3 battles can reach this code path
- If yes, wrap with safePortfolioArray() or flattenPortfolio()
- Add comments noting V3 safety
```

---

## 7. Success Metrics

After completing all phases:

| Metric | Current | Target |
|--------|---------|--------|
| App.jsx lines | 22,424 | < 15,000 |
| V3-unsafe portfolio accesses | ~5 | 0 |
| Inline component definitions | 10+ | 0 |
| Custom hooks | 12 | 18+ |
| Shared component usage | 31 imports | 50+ imports |

---

## 8. Implementation Notes

### Do NOT Break These Patterns

1. **Screen routing in App.jsx** - Keep the `if (screen === 'xxx')` pattern for now
2. **Firebase subscriptions** - Keep in App.jsx until context extraction
3. **User context** - Already properly extracted
4. **Battle timer service** - Works well, don't change

### Watch Out For

1. **Closure over state** - When extracting, ensure components receive fresh state
2. **useEffect dependencies** - Extracted components need proper dep arrays
3. **Event handlers** - May need to be passed as props after extraction
4. **CSS-in-JS styles** - Move inline styles with components

---

## Appendix: File Reference

### Key Files for V3 Schema

- `src/utils/baggerBombUtils.js` - V3 portfolio helpers
- `src/utils/battleHelpers.js` - Battle utilities
- `src/services/battleTimer.js` - Battle timing and status
- `src/firebase/firebaseService.js` - V3 battle CRUD
- `src/components/BaggerBomb/*` - V3 battle UI

### Screen Components (Already Extracted)

- `src/screens/BuilderScreen.jsx`
- `src/screens/BattleViewScreen.jsx`
- `src/screens/DraftRoomScreen.jsx`
- `src/screens/EarningsGameScreen.jsx`
- `src/screens/BaggerBombLobby.jsx`
