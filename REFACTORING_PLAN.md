# MarketClash Refactoring Plan
Generated: 2025-12-25
Audit Type: READ-ONLY ANALYSIS (No changes made)

## Critical Finding: Why Changes Aren't Appearing

**Root Cause: Duplicate Game Plan Generation Code Paths**

The codebase has **two parallel implementations** for generating the Snake Draft tiered strategy/game plan. When changes are made to one path, they don't appear in the UI because the app may be using the other code path.

### Specific Issue Locations:

| Location | Lines | Description |
|----------|-------|-------------|
| **Path 1: ResearchFlow Component** | 7895-7959 | Tiered strategy generation inside `createLocalFallbackPlan()` |
| **Path 2: Dashboard Inline Research** | 14242-14319 | Nearly identical tiered strategy generation |

**Evidence:**

1. Lines 7895-7959 contain:
```javascript
// SNAKE DRAFT: Assign tiered strategy instead of allocation %
if (isSnakeDraft) {
  // Sort by priority: user_selected first
  const sortedPortfolio = [...];
  // Assign tiers: Tier 1 (1-3), Tier 2 (4-6), Tier 3 (7+)
  sortedPortfolio.forEach((asset, index) => {
    if (index < 3) {
      asset.tier = 1;
      asset.tierLabel = '🔥 TIER 1';
      ...
```

2. Lines 14242-14319 contain the **exact same logic** with minor variable name differences (`thesis` vs `researchThesis`)

**Additional Duplicate Functions:**

| Function | Location 1 | Location 2 | Problem |
|----------|-----------|-----------|---------|
| `handleCreateBattle` | Line 12335 | Line 23515 | Different scopes, confusing |
| `handleGeneratePlan` / `handleGenerateGamePlan` | Line 7744 | Line 14024 | Different APIs, same purpose |
| `strategySummary` generation | Line 7959 | Line 14305 | Identical output, duplicate code |

---

## Executive Summary

- **Codebase Health Score:** 2/10 (Critical issues)
- **Primary Issue:** 27,532-line "God Component" with massive duplication and tangled code paths
- **Recommended First Action:** Consolidate the two tiered strategy generation functions into a single shared utility

## Metrics Snapshot

| Metric | Value | Healthy Target | Status |
|--------|-------|----------------|--------|
| App.jsx lines | 27,532 | < 500 | CRITICAL |
| useState hooks | 201 | < 20 | CRITICAL |
| useEffect hooks | 45 | < 10 | HIGH |
| Screens inline | 22 | 0 (all extracted) | CRITICAL |
| Duplicate functions found | 6+ | 0 | HIGH |
| Commented lines | 949 (3.4%) | < 1% | MEDIUM |

---

## Priority 1: Critical (Fix First)

These issues are likely causing bugs or preventing changes from appearing.

### Issue 1.1: Duplicate Tiered Strategy Generation

- **Location:** `src/App.jsx` lines 7895-7959 AND 14242-14319
- **Problem:** Two nearly identical code blocks generate Snake Draft tiered strategies. Editing one doesn't affect the other.
- **Impact:** Changes to game plan display won't appear if the wrong code path is active
- **Solution:**
  1. Extract tiered strategy logic to `src/utils/draftStrategy.js`
  2. Import and use in both ResearchFlow and dashboard inline code
  3. Single source of truth for tier assignment logic
- **Risk Level:** Medium (logic is the same, just needs consolidation)
- **Effort:** 1-2 hours
- **Dependencies:** None
- **Test After:** Create a Snake Draft, verify tiered strategy displays correctly in both:
  - ResearchFlow → GamePlan view (accessed via Research Advisor)
  - Dashboard → inline research mode → GamePlan view

### Issue 1.2: Duplicate handleCreateBattle Functions

- **Location:** `src/App.jsx` lines 12335 and 23515
- **Problem:** Two functions with the same name in different scopes handle battle creation differently
- **Impact:** Confusing for developers, potential for calling wrong function
- **Solution:**
  1. Rename line 23515 version to `handleCreateBattleFromDraft`
  2. Or extract both to named utilities with clear purposes
- **Risk Level:** Low
- **Effort:** 30 min
- **Dependencies:** None
- **Test After:** Create battle from portfolio builder AND from draft results, both should work

### Issue 1.3: Two Different GamePlan State Variables

- **Location:**
  - `gamePlan` (line 7666) - inside ResearchFlow component
  - `researchGamePlan` (line 9852) - in main PortfolioDuel component
- **Problem:** Two different state variables store game plan data, used in different contexts
- **Impact:** State updates to one don't affect the other
- **Solution:** Consolidate to single state management approach or lift state to parent
- **Risk Level:** Medium
- **Effort:** 2-3 hours
- **Dependencies:** Issue 1.1 should be fixed first
- **Test After:** Generate game plan in both flows, verify data persists correctly

---

## Priority 2: High (Do Soon)

These issues slow development and make the codebase hard to maintain.

### Issue 2.1: God Component Anti-Pattern

- **Location:** `src/App.jsx` (entire file)
- **Problem:** 27,532 lines with 201 useState hooks, 45 useEffects, 22 screens all in one component
- **Impact:**
  - Slow IDE performance
  - Impossible to reason about state
  - Changes have unpredictable effects
  - Long compile/reload times
- **Solution:** Progressive extraction (see Component Extraction Map below)
- **Risk Level:** High (many interdependencies)
- **Effort:** Multiple days
- **Dependencies:** Must extract utilities first (Priority 1)
- **Test After:** Full regression test after each extraction

### Issue 2.2: Inline Screen Definitions

- **Location:** Lines 13663-27500 (approximately)
- **Problem:** All 22 screens are defined inline with `if (screen === 'xxx')` pattern
- **Impact:** No code reuse, massive file, hard to find specific screens
- **Solution:** Extract each screen to `src/screens/ScreenName.jsx`
- **Risk Level:** Medium
- **Effort:** 4-8 hours per screen
- **Dependencies:** State management refactor may be needed
- **Test After:** Each screen after extraction

### Issue 2.3: No Custom Hooks for Complex Logic

- **Location:** Throughout App.jsx
- **Problem:** Complex state logic like draft management, battle management, price fetching is inline
- **Impact:** Logic cannot be reused, hard to test, clutters component
- **Solution:** Extract to custom hooks:
  - `useDraft()` - draft state management
  - `useBattle()` - battle state management
  - `useMarketData()` - price fetching logic
  - `useAuth()` - authentication state
- **Risk Level:** Medium
- **Effort:** 2-4 hours per hook
- **Dependencies:** None
- **Test After:** Verify functionality after each hook extraction

---

## Priority 3: Medium (Do When Possible)

Code quality improvements that aren't urgent.

### Issue 3.1: Duplicate Game Plan Generation Functions

- **Location:** Lines 7744 (`handleGeneratePlan`) and 14024 (`handleGenerateGamePlan`)
- **Problem:** Two functions that generate game plans with different approaches:
  - Line 7744: Uses `generateGamePlan()` from researchAdvisor.js
  - Line 14024: Makes direct API call to `/api/ai-advisor`
- **Impact:** Inconsistent behavior, harder to maintain
- **Solution:** Standardize on one approach (recommend using the service)
- **Risk Level:** Low
- **Effort:** 1-2 hours
- **Dependencies:** Understand which API approach is preferred
- **Test After:** Generate game plan, verify AI response works correctly

### Issue 3.2: Commented Code Accumulation

- **Location:** 949 lines throughout App.jsx
- **Problem:** ~3.4% of file is comments, some may be dead code
- **Impact:** File size bloat, confusion about what's active
- **Solution:** Audit comments, remove dead code, keep only documentation
- **Risk Level:** Low
- **Effort:** 1-2 hours
- **Dependencies:** None
- **Test After:** Basic functionality check

### Issue 3.3: Missing Error Boundaries

- **Location:** No error boundaries exist
- **Problem:** Errors in one component crash the entire app
- **Impact:** Poor user experience on errors
- **Solution:** Add React Error Boundaries around major sections
- **Risk Level:** Low
- **Effort:** 1 hour
- **Dependencies:** None
- **Test After:** Trigger an error, verify graceful handling

---

## Priority 4: Low (Nice to Have)

Polish items and minor optimizations.

### Issue 4.1: Component Memoization

- **Location:** All inline components
- **Problem:** Components re-render unnecessarily
- **Impact:** Minor performance impact
- **Solution:** Use `React.memo()` on extracted components, `useMemo`/`useCallback` for expensive operations
- **Risk Level:** Low
- **Effort:** Ongoing (add during extraction)
- **Dependencies:** Component extraction
- **Test After:** Performance profiling

### Issue 4.2: TypeScript Migration

- **Location:** Entire codebase
- **Problem:** No type safety
- **Impact:** Runtime errors, harder refactoring
- **Solution:** Gradual TypeScript adoption starting with new files
- **Risk Level:** Low
- **Effort:** Ongoing
- **Dependencies:** None
- **Test After:** TypeScript compilation

### Issue 4.3: Consistent Code Style

- **Location:** Throughout codebase
- **Problem:** Inconsistent indentation, naming conventions
- **Impact:** Reduced readability
- **Solution:** Add ESLint/Prettier configuration, auto-format
- **Risk Level:** Very Low
- **Effort:** 30 min setup
- **Dependencies:** None
- **Test After:** Run linter

---

## Recommended Implementation Order

Execute in this order to minimize risk:

1. **Consolidate tiered strategy logic** - Fix the root cause of changes not appearing - 1-2 hours
2. **Rename duplicate handleCreateBattle** - Quick clarity win - 30 min
3. **Extract draft utilities** - Create `src/utils/draftStrategy.js` - 1 hour
4. **Extract useDraft hook** - Consolidate draft state management - 2-3 hours
5. **Extract DraftRoom screen** - First screen extraction, 720 lines - 4 hours
6. **Extract DraftResults screen** - Second extraction, ~500 lines - 3 hours
7. **Extract useBattle hook** - Battle state management - 2-3 hours
8. **Extract BattleView screen** - Large screen, ~600 lines - 4 hours
9. **Extract Dashboard screen** - Largest screen, requires planning - 8 hours
10. **Extract remaining screens** - Incremental extractions - 2-4 hours each

## Quick Wins (< 30 min each, low risk)

These can be done immediately with minimal risk:

- [ ] Rename `handleCreateBattle` at line 23515 to `handleCreateBattleFromDraft`
- [ ] Add comment headers to clearly mark the two game plan code paths
- [ ] Create `src/utils/index.js` to prepare for utility extraction
- [ ] Create `src/screens/` directory structure
- [ ] Create `src/hooks/` directory structure
- [ ] Add ESLint ignore comment for the large file temporarily

---

## Component Extraction Map

If App.jsx needs to be split, here's the recommended extraction:

| Current Location | New File | Lines | Priority |
|-----------------|----------|-------|----------|
| Lines 7646-8230 | `src/components/research/ResearchFlow.jsx` | ~584 | High |
| Lines 22470-23189 | `src/screens/DraftRoom.jsx` | ~720 | High |
| Lines 23475-24006 | `src/screens/DraftResults.jsx` | ~531 | High |
| Lines 24007-24946 | `src/screens/DraftBattle.jsx` | ~939 | High |
| Lines 25502-26120 | `src/screens/BattleView.jsx` | ~618 | High |
| Lines 15899-19982 | `src/screens/Dashboard.jsx` | ~4083 | Critical |
| Lines 19983-21588 | `src/screens/PortfolioBuilder.jsx` | ~1605 | Medium |
| Lines 21763-22213 | `src/screens/DraftSetup.jsx` | ~450 | Medium |
| Lines 22214-22469 | `src/screens/DraftLobby.jsx` | ~255 | Medium |
| Lines 13663-15898 | `src/screens/HomeScreen.jsx` | ~2235 | Medium |
| Lines 3190-3958 | `src/components/research/GamePlan.jsx` | ~768 | High |
| Lines 2825-3034 | `src/components/common/AssetPickerModal.jsx` | ~209 | Medium |
| Lines 9240-9528 | `src/components/battle/BattleHistoryCard.jsx` | ~288 | Low |

---

## State Management Recommendation

Current state should be reorganized into logical groups:

### Recommended Custom Hooks:

```javascript
// src/hooks/useAuth.js
// Handles: user, username, login state

// src/hooks/useDraft.js
// Handles: currentDraft, draftState, draftJoinCode, selectedDraftCategory, etc.

// src/hooks/useBattle.js
// Handles: battles, currentBattle, activeBattleId, battlePrices, etc.

// src/hooks/useMarketData.js
// Handles: stocksData, cryptoData, loadingMarketData

// src/hooks/usePortfolio.js
// Handles: portfolio, portfolioType, portfolioName, selectedCrypto, etc.

// src/hooks/useResearch.js
// Handles: researchPhase, researchThesis, convictionData, researchGamePlan, etc.
```

---

## Testing Checklist

After each refactoring task, verify these still work:

- [ ] User can log in
- [ ] Dashboard loads with battles
- [ ] Can create a Classic battle
- [ ] Can create a Snake Draft
- [ ] Can join a battle via code
- [ ] Training mode works
- [ ] Battle view shows both portfolios
- [ ] Prices refresh correctly
- [ ] Battle completion works
- [ ] **Snake Draft tiered strategy displays correctly**
- [ ] **Game Plan shows in both ResearchFlow and inline research**
- [ ] Draft picks sync in real-time
- [ ] Autopick works when timer expires

---

## Files to Back Up Before Changes

These files will be modified. Ensure git branch is ready:

1. `src/App.jsx` - Main file, all changes start here
2. `src/services/draftService.js` - May need modifications
3. `src/services/researchAdvisor.js` - Game plan generation service

---

## Notes for Implementation Session

1. **Start with git branch**: Create `feature/refactor-gameplan-paths` or similar
2. **One change at a time**: Don't try to fix everything at once
3. **Test after each change**: Run the app, verify the specific feature
4. **Commit frequently**: Small, focused commits with clear messages
5. **The quick win first**: Consolidating the tiered strategy logic will immediately fix the "changes not appearing" bug

### Key Files to Understand:

- `src/App.jsx` - The monolith (lines 1-27532)
- `src/services/researchAdvisor.js` - AI-powered game plan generation
- `src/services/draftService.js` - Draft room logic
- `src/components/DraftAdvisor.jsx` - Draft assistance UI

### Two Entry Points for Game Plans:

1. **ResearchFlow** (line 7646): Standalone component with 5 phases, used when user clicks "Research Advisor" from dashboard
2. **Inline Research Mode** (lines 14023-14502): Embedded in dashboard, triggered by `showResearchMode` state

Both ultimately render the same `<GamePlan>` component but use different state variables and generation functions.

---

## Architecture Diagram

```
Current Architecture (Problematic):
┌─────────────────────────────────────────────────────────────────┐
│                         App.jsx (27,532 lines)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  201 useState hooks                                        │  │
│  │  45 useEffect hooks                                        │  │
│  │  22 inline screens                                         │  │
│  │  Multiple duplicate functions                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ ResearchFlow    │  │ Inline Research │  ← TWO PATHS!         │
│  │ (lines 7646+)   │  │ (lines 14023+)  │                       │
│  │                 │  │                 │                       │
│  │ gamePlan state  │  │ researchGamePlan│  ← TWO STATES!        │
│  │                 │  │ state           │                       │
│  │ handleGenerate  │  │ handleGenerate  │  ← TWO FUNCTIONS!     │
│  │ Plan()          │  │ GamePlan()      │                       │
│  └────────┬────────┘  └────────┬────────┘                       │
│           │                    │                                 │
│           ▼                    ▼                                 │
│  ┌─────────────────────────────────────────┐                    │
│  │        <GamePlan> component             │ ← SHARED           │
│  │        (lines 3190-3958)                │                    │
│  └─────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘

Target Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                    App.jsx (< 500 lines)                        │
│              Router + Context Providers only                     │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  src/screens/   │  │  src/hooks/     │  │  src/utils/     │
│  - Dashboard    │  │  - useDraft     │  │  - draftStrategy│
│  - DraftRoom    │  │  - useBattle    │  │  - battleUtils  │
│  - BattleView   │  │  - useMarketData│  │  - formatters   │
│  - etc.         │  │  - useAuth      │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │    SINGLE generateGamePlan  │
               │    function in utils        │
               └─────────────────────────────┘
```

---

## Summary

The **immediate fix** for "changes not appearing" is to **consolidate the duplicate tiered strategy code** at lines 7895-7959 and 14242-14319 into a single utility function. This is a focused 1-2 hour task that will directly address the reported bug.

The larger refactoring (extracting the 27,532-line god component) should be done incrementally over multiple sessions, with full testing between each change.
