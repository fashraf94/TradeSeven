# FantasyTrades Authentication & Data Flow Architecture Audit

**Generated:** January 5, 2026
**Codebase:** TradeSeven (FantasyTrades)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [LocalStorage Service](#1-localstorage-service)
3. [Auth Service](#2-auth-service)
4. [UserContext & useUser Hook](#3-usercontext--useuser-hook)
5. [BaggerBomb Game Plan Flow](#4-baggerbomb-game-plan-flow)
6. [GamePlanResultScreen - Save to Notes](#5-gameplanresultscreen---save-to-notes)
7. [NotesTab Component](#6-notestab-component)
8. [Game Plan Notes Service](#7-game-plan-notes-service)
9. [Battle Handlers](#8-battle-handlers)
10. [Props vs Context Summary Matrix](#9-props-vs-context-summary-matrix)

---

## Architecture Overview

The FantasyTrades codebase uses a **hybrid data flow architecture** combining:

1. **React Context** (`UserContext`) for global user state
2. **Props drilling** for component-specific user data
3. **localStorage** for persistence
4. **Firebase Firestore** for cloud storage
5. **Multiple fallback chains** for userId resolution

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.jsx                                  │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  user (state)   │───▶│  Passed as props to children      │   │
│  └────────┬────────┘    └──────────────────────────────────┘   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  UserProvider   │ (wraps entire app)                         │
│  │  (UserContext)  │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  useUser() hook │◀───│  Components can access via hook   │   │
│  └─────────────────┘    └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      authService.js                              │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  login/logout   │───▶│  LocalStorage.js (persistence)    │   │
│  └─────────────────┘    └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Firebase Services                              │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │ gamePlanNotes   │    │  firebaseService (battles)        │   │
│  │ Service         │    │                                    │   │
│  └─────────────────┘    └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. LocalStorage Service

**File:** `src/services/LocalStorage.js`

### Purpose
Provides a persistence layer for user data and battle data using browser localStorage.

### Full Implementation

```javascript
// src/services/LocalStorage.js

const BATTLES_KEY = 'portfolioDuelBattles';

/**
 * Safely loads battles from localStorage
 * Returns empty array if data is missing or corrupted
 */
export function loadBattlesSafe() {
  try {
    const raw = localStorage.getItem(BATTLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading battles from localStorage:', error);
    return [];
  }
}

/**
 * Safely saves battles to localStorage
 */
export function saveBattlesSafe(battles) {
  try {
    localStorage.setItem(BATTLES_KEY, JSON.stringify(battles));
    return true;
  } catch (error) {
    console.error('Error saving battles to localStorage:', error);
    return false;
  }
}

/**
 * Deep comparison to check if two battle arrays are the same
 * Prevents unnecessary re-renders and saves
 */
export function isSameBattles(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Loads user data from localStorage
 */
export function loadUser() {
  try {
    const raw = localStorage.getItem('portfolioDuelUser');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error loading user from localStorage:', error);
    return null;
  }
}

/**
 * Saves user data to localStorage
 */
export function saveUser(user) {
  try {
    localStorage.setItem('portfolioDuelUser', JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('Error saving user to localStorage:', error);
    return false;
  }
}

/**
 * Clears user data from localStorage
 */
export function clearUser() {
  try {
    localStorage.removeItem('portfolioDuelUser');
    return true;
  } catch (error) {
    console.error('Error clearing user from localStorage:', error);
    return false;
  }
}

/**
 * Clears all game data from localStorage
 */
export function clearAllData() {
  try {
    localStorage.removeItem(BATTLES_KEY);
    localStorage.removeItem('portfolioDuelUser');
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
}
```

### Data Source
- **Storage Key (User):** `portfolioDuelUser`
- **Storage Key (Battles):** `portfolioDuelBattles`

### Error Handling
- All functions wrapped in try-catch
- Returns `null` or empty array on read errors
- Returns `false` on write errors
- Logs errors to console

### What It Does With Data
| Function | Action |
|----------|--------|
| `loadUser()` | Reads and parses user JSON from localStorage |
| `saveUser(user)` | Serializes and writes user object to localStorage |
| `clearUser()` | Removes user key from localStorage |
| `loadBattlesSafe()` | Reads battles array with validation |
| `saveBattlesSafe(battles)` | Writes battles array to localStorage |

---

## 2. Auth Service

**File:** `src/services/auth/authService.js`

### Purpose
Abstraction layer for authentication operations. Currently uses localStorage, designed for future OAuth migration.

### Full Implementation

```javascript
// src/services/auth/authService.js
// Auth abstraction layer - currently uses localStorage, designed for easy OAuth migration

import { loadUser, saveUser, clearUser } from '../LocalStorage';

/**
 * Auth Service - Abstraction layer for authentication
 *
 * Current Implementation: Username-based auth with localStorage persistence
 *
 * Future OAuth Migration:
 * - Replace localStorage calls with Firebase Auth / OAuth provider
 * - Add token refresh logic
 * - Implement proper session management
 * - Add OAuth callback handlers
 *
 * To migrate to OAuth:
 * 1. Update login() to call OAuth provider
 * 2. Update logout() to revoke OAuth tokens
 * 3. Update getCurrentUser() to return OAuth user object
 * 4. Add onAuthStateChanged listener for reactive auth state
 */

/**
 * Get the currently authenticated user
 * @returns {Object|null} User object or null if not authenticated
 *
 * OAuth Migration: Replace with Firebase auth.currentUser or OAuth provider's user
 */
export const getCurrentUser = () => {
  return loadUser();
};

/**
 * Login with username (current implementation)
 * @param {string} username - The username to login with
 * @returns {Object} The created user object
 *
 * OAuth Migration: Replace with signInWithPopup/signInWithRedirect
 * Example future signature: login(provider: 'google' | 'apple' | 'email', credentials?)
 */
export const login = async (username) => {
  if (!username || !username.trim()) {
    throw new Error('Username is required');
  }

  const userData = {
    username: username.trim(),
    odUserId: `local_${username.trim().toLowerCase()}`, // Simulated user ID
    wins: 0,
    losses: 0,
    xp: 0,
    rank: 'Beginner',
    level: 1,
    joinedAt: new Date().toISOString(),
    authProvider: 'local', // Track auth provider for migration
  };

  saveUser(userData);
  return userData;
};

/**
 * Logout the current user
 * @returns {boolean} Success status
 *
 * OAuth Migration: Replace with signOut() and token revocation
 */
export const logout = async () => {
  try {
    clearUser();
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return getCurrentUser() !== null;
};

/**
 * Get user ID (normalized across auth providers)
 * @returns {string|null}
 *
 * OAuth Migration: Return OAuth uid instead
 */
export const getUserId = () => {
  const user = getCurrentUser();
  return user?.odUserId || user?.uid || user?.username || null;
};

/**
 * Update user profile data
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated user object
 *
 * OAuth Migration: May need to split between local data and OAuth profile
 */
export const updateUserProfile = (updates) => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('No user logged in');
  }

  const updatedUser = {
    ...currentUser,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveUser(updatedUser);
  return updatedUser;
};

/**
 * Subscribe to auth state changes (placeholder for OAuth)
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 *
 * OAuth Migration: Replace with onAuthStateChanged(auth, callback)
 *
 * Current implementation: Returns noop since localStorage doesn't have events
 * In OAuth, this would be:
 *   return onAuthStateChanged(auth, (user) => callback(user));
 */
export const onAuthStateChange = (callback) => {
  // Current implementation: Check once and return
  const user = getCurrentUser();
  callback(user);

  // Return unsubscribe function (noop for localStorage)
  return () => {};
};

/**
 * Auth providers enum (for future OAuth)
 */
export const AUTH_PROVIDERS = {
  LOCAL: 'local',
  // Future providers:
  // GOOGLE: 'google',
  // APPLE: 'apple',
  // EMAIL: 'email',
};

// Default export for convenience
export default {
  getCurrentUser,
  login,
  logout,
  isAuthenticated,
  getUserId,
  updateUserProfile,
  onAuthStateChange,
  AUTH_PROVIDERS,
};
```

### Data Source
- **Primary:** `LocalStorage.js` functions (`loadUser`, `saveUser`, `clearUser`)

### How It Receives User Data
- `login()`: Receives username as parameter, creates full user object
- `getCurrentUser()`: Reads from localStorage via `loadUser()`
- `getUserId()`: Reads from localStorage, applies fallback chain

### userId Resolution Chain
```javascript
user?.odUserId || user?.uid || user?.username || null
```

### Error Handling
| Function | Error Behavior |
|----------|----------------|
| `login()` | Throws `Error('Username is required')` if empty |
| `logout()` | Returns `false` on error, logs to console |
| `updateUserProfile()` | Throws `Error('No user logged in')` if not authenticated |

### What It Does With Data
| Function | Action |
|----------|--------|
| `login(username)` | Creates user object, saves to localStorage, returns user |
| `logout()` | Clears user from localStorage |
| `getCurrentUser()` | Returns user object from localStorage |
| `getUserId()` | Returns normalized user ID string |
| `updateUserProfile(updates)` | Merges updates, saves to localStorage |

---

## 3. UserContext & useUser Hook

**File:** `src/contexts/UserContext.jsx`

### Purpose
Provides global user state management using React Context. Wraps the entire app and provides user data and auth methods to all descendants.

### Full Implementation

```javascript
// src/contexts/UserContext.jsx
// Global user state management using React Context
// Uses authService abstraction for easy OAuth migration

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser,
  login as authLogin,
  logout as authLogout,
  updateUserProfile,
  onAuthStateChange,
} from '../services/auth';

const UserContext = createContext(null);

/**
 * UserProvider - Wraps the app and provides user state globally
 *
 * OAuth Migration: When switching to OAuth, the authService handles
 * the provider-specific logic while this context manages React state.
 */
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from auth service on mount
  useEffect(() => {
    // Subscribe to auth state changes (prepares for OAuth's onAuthStateChanged)
    const unsubscribe = onAuthStateChange((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Login - Delegates to auth service
   * OAuth Migration: This will automatically work with OAuth once authService is updated
   */
  const login = useCallback(async (userData) => {
    try {
      // If userData is just a username string, use authService.login
      if (typeof userData === 'string') {
        const user = await authLogin(userData);
        setUser(user);
        return user;
      }

      // If full userData object provided (backwards compatibility)
      const userWithDefaults = {
        wins: 0,
        losses: 0,
        xp: 0,
        rank: 'Beginner',
        level: 1,
        joinedAt: new Date().toISOString(),
        authProvider: 'local',
        ...userData
      };
      const user = await authLogin(userWithDefaults.username);
      // Merge any extra data
      const mergedUser = { ...user, ...userWithDefaults };
      setUser(mergedUser);
      return mergedUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  /**
   * Logout - Delegates to auth service
   * OAuth Migration: This will handle token revocation automatically
   */
  const logout = useCallback(async () => {
    try {
      await authLogout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if logout fails
      setUser(null);
    }
  }, []);

  /**
   * Update user - Merges updates and persists via auth service
   * OAuth Migration: May need to split local vs OAuth profile data
   */
  const updateUser = useCallback((updates) => {
    setUser(prev => {
      if (!prev) return prev;
      try {
        const updated = updateUserProfile(updates);
        return updated;
      } catch (error) {
        console.error('Update user error:', error);
        // Fallback to local update only
        return { ...prev, ...updates };
      }
    });
  }, []);

  /**
   * Get user ID - Returns the best available identifier
   */
  const getUserId = useCallback(() => {
    return user?.odUserId || user?.uid || user?.username || null;
  }, [user]);

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    getUserId,
    isLoggedIn: !!user
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * useUser - Hook to access user context
 * @throws Error if used outside UserProvider
 */
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
```

### Data Source
- **Primary:** `authService` (which uses `LocalStorage`)
- **State:** React `useState` for reactive updates

### How It Receives User Data
1. On mount: `onAuthStateChange` callback loads user from `authService.getCurrentUser()`
2. On login: `authService.login()` returns user, stored in state
3. State is then provided to all descendants via Context

### Context Value Shape
```typescript
{
  user: User | null,           // Current user object
  loading: boolean,            // True during initial load
  login: (userData) => Promise<User>,
  logout: () => Promise<void>,
  updateUser: (updates) => void,
  getUserId: () => string | null,
  isLoggedIn: boolean          // Derived from !!user
}
```

### userId Resolution Chain (in getUserId)
```javascript
user?.odUserId || user?.uid || user?.username || null
```

### Loading State
- `loading` starts as `true`
- Set to `false` after initial auth check completes
- Components can use this to show loading UI

### Error Handling
| Function | Error Behavior |
|----------|----------------|
| `login()` | Logs error, re-throws for caller to handle |
| `logout()` | Logs error, still clears state (graceful degradation) |
| `updateUser()` | Logs error, falls back to local-only update |
| `useUser()` | Throws if used outside `UserProvider` |

### What It Does With Data
| Function | Action |
|----------|--------|
| `login(userData)` | Calls authService.login, updates React state |
| `logout()` | Calls authService.logout, clears React state |
| `updateUser(updates)` | Calls authService.updateUserProfile, updates state |
| `getUserId()` | Returns normalized ID from current state |

---

## 4. BaggerBomb Game Plan Flow

**File:** `src/components/GamePlan/BaggerBombGamePlanFlow.jsx`

### Purpose
Multi-step wizard flow for creating a game plan. Manages step navigation and accumulates data across steps.

### Full Implementation

```javascript
import React, { useState } from 'react';
import RiskStyleScreen from './RiskStyleScreen';
import SectorSelectionScreen from './SectorSelectionScreen';
import MustHavePicksScreen from './MustHavePicksScreen';
import GamePlanResultScreen from './GamePlanResultScreen';

const STEPS = {
  RISK_STYLE: 'risk_style',
  SECTOR_SELECTION: 'sector_selection',
  MUST_HAVE_PICKS: 'must_have_picks',
  GAME_PLAN_RESULT: 'game_plan_result'
};

const BaggerBombGamePlanFlow = ({ onComplete, onBack, user }) => {
  const [currentStep, setCurrentStep] = useState(STEPS.RISK_STYLE);
  const [gamePlanData, setGamePlanData] = useState({
    riskStyle: null,
    selectedSectors: [],
    mustHavePicks: [],
    recommendations: null
  });

  const handleRiskStyleSelect = (riskStyle) => {
    setGamePlanData(prev => ({ ...prev, riskStyle }));
    setCurrentStep(STEPS.SECTOR_SELECTION);
  };

  const handleSectorsSelect = (selectedSectors) => {
    setGamePlanData(prev => ({ ...prev, selectedSectors }));
    setCurrentStep(STEPS.MUST_HAVE_PICKS);
  };

  const handleMustHavePicks = (mustHavePicks) => {
    setGamePlanData(prev => ({ ...prev, mustHavePicks }));
    setCurrentStep(STEPS.GAME_PLAN_RESULT);
  };

  const handleBack = () => {
    switch (currentStep) {
      case STEPS.SECTOR_SELECTION:
        setCurrentStep(STEPS.RISK_STYLE);
        break;
      case STEPS.MUST_HAVE_PICKS:
        setCurrentStep(STEPS.SECTOR_SELECTION);
        break;
      case STEPS.GAME_PLAN_RESULT:
        setCurrentStep(STEPS.MUST_HAVE_PICKS);
        break;
      default:
        onBack?.();
    }
  };

  const handleComplete = (portfolio) => {
    onComplete?.(portfolio);
  };

  switch (currentStep) {
    case STEPS.RISK_STYLE:
      return (
        <RiskStyleScreen
          onBack={onBack}
          onNext={handleRiskStyleSelect}
          selectedStyle={gamePlanData.riskStyle}
        />
      );

    case STEPS.SECTOR_SELECTION:
      return (
        <SectorSelectionScreen
          onBack={handleBack}
          onNext={handleSectorsSelect}
          riskStyle={gamePlanData.riskStyle}
        />
      );

    case STEPS.MUST_HAVE_PICKS:
      return (
        <MustHavePicksScreen
          onBack={handleBack}
          onNext={handleMustHavePicks}
          selectedSectors={gamePlanData.selectedSectors}
          riskStyle={gamePlanData.riskStyle}
          initialPicks={gamePlanData.mustHavePicks}
        />
      );

    case STEPS.GAME_PLAN_RESULT:
      return (
        <GamePlanResultScreen
          onBack={handleBack}
          onComplete={handleComplete}
          onGoHome={onBack}
          gamePlanData={gamePlanData}
          user={user}
        />
      );

    default:
      return null;
  }
};

export default BaggerBombGamePlanFlow;
```

### Props Interface

```typescript
interface BaggerBombGamePlanFlowProps {
  onComplete?: (portfolio: Portfolio) => void;  // Callback when flow completes
  onBack?: () => void;                          // Callback to exit flow
  user: User;                                   // User object (REQUIRED)
}
```

### Data Source
- **User Data:** Props only (`user` prop)
- **Does NOT use:** `useUser()` hook or context

### How User Is Passed to Children

```
BaggerBombGamePlanFlow (receives user via props)
    │
    └──▶ GamePlanResultScreen (user={user})
              │
              └──▶ handleSaveToNotes() uses user for userId
```

Only the final step (`GamePlanResultScreen`) receives the `user` prop. The intermediate screens (`RiskStyleScreen`, `SectorSelectionScreen`, `MustHavePicksScreen`) do not receive or need user data.

### What It Does With Data
| Data | Action |
|------|--------|
| `user` prop | Passes directly to `GamePlanResultScreen` |
| `gamePlanData` state | Accumulates selections across steps |
| `currentStep` state | Controls which screen renders |

### No Error Handling
This component has no explicit error handling - it relies on child components to handle their own errors.

---

## 5. GamePlanResultScreen - Save to Notes

**File:** `src/components/GamePlan/GamePlanResultScreen.jsx`

### Purpose
Final step of game plan flow. Displays recommendations and provides "Save to Notes" functionality.

### handleSaveToNotes Full Implementation (Lines 140-172)

```javascript
// Save game plan to Notes
const handleSaveToNotes = async () => {
  if (savingNote || savedNote) return;

  setSavingNote(true);

  try {
    const noteData = {
      riskStyle,
      selectedSectors,
      mustHavePicks: mustHavePicks || [],
      aiStrategy: aiStrategy || '',
      breakoutCandidates: recommendations?.breakoutCandidates || [],
      safePlays: recommendations?.safePlays || [],
      cryptoRecommendation: recommendations?.cryptoRecommendation || null,
      wildcards: aiPicks?.wildcards || [],
      sessionPicks: aiPicks?.sessionPicks || []
    };

    // Use getUserId from context, fall back to deriving from user object
    const userId = getUserId() || user?.odUserId || user?.uid || user?.username;
    await saveGamePlanNote(noteData, userId);
    setSavedNote(true);

    // Reset saved status after 3 seconds
    setTimeout(() => setSavedNote(false), 3000);

  } catch (error) {
    console.error('Error saving game plan:', error);
    alert('Failed to save game plan. Please try again.');
  } finally {
    setSavingNote(false);
  }
};
```

### Data Source
- **Primary:** Props (`user` prop from parent)
- **Secondary:** `useUser()` hook (`getUserId` function)
- **This is DUAL SOURCING for backwards compatibility**

### How It Receives User Data

```javascript
// Component receives user as prop
const GamePlanResultScreen = ({ user, gamePlanData, ... }) => {
  // Also gets getUserId from context
  const { getUserId } = useUser();

  // In handleSaveToNotes:
  const userId = getUserId() || user?.odUserId || user?.uid || user?.username;
}
```

### userId Resolution Chain (4-level fallback)
```javascript
getUserId()           // 1. Try context hook first
  || user?.odUserId   // 2. Fall back to prop.odUserId
  || user?.uid        // 3. Fall back to prop.uid
  || user?.username   // 4. Fall back to prop.username
```

### Loading States
```javascript
const [savingNote, setSavingNote] = useState(false);   // During save operation
const [savedNote, setSavedNote] = useState(false);     // Success indicator (3s)
```

### Error Handling
- Prevents double-submission: `if (savingNote || savedNote) return;`
- Try-catch with user-facing alert on error
- Always clears loading state in `finally` block
- Logs error to console for debugging

### What It Does With Data
| Data | Action |
|------|--------|
| `user` prop | Extracts userId for Firestore document |
| `gamePlanData` | Destructured into noteData object |
| `recommendations` | Extracts breakoutCandidates, safePlays, crypto |
| `aiPicks` | Extracts wildcards, sessionPicks |

---

## 6. NotesTab Component

**File:** `src/components/GamePlan/NotesTab.jsx`

### Purpose
Displays saved game plan notes. Supports viewing, expanding, and deleting notes.

### User Data Reception (Lines 40-51)

```javascript
// Accept user prop for backwards compatibility, but prefer context
const NotesTab = ({ user: userProp }) => {
  const { user: contextUser, getUserId } = useUser();
  const user = userProp || contextUser; // Prefer prop if passed, fall back to context

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNote, setExpandedNote] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Get user ID - use hook if available, else derive from user object
  const userId = getUserId() || user?.odUserId || user?.uid || user?.username;
```

### Load Notes Function (Lines 57-69)

```javascript
const loadNotes = async () => {
  try {
    setLoading(true);
    setError(null);
    const fetchedNotes = await getGamePlanNotes(userId, 20);
    setNotes(fetchedNotes);
  } catch (err) {
    console.error('Error loading notes:', err);
    setError('Failed to load saved game plans');
  } finally {
    setLoading(false);
  }
};
```

### Delete Handler (Lines 71-89)

```javascript
const handleDelete = async (noteId, e) => {
  e.stopPropagation();

  if (!confirm('Are you sure you want to delete this game plan?')) {
    return;
  }

  setDeleting(noteId);

  try {
    await deleteGamePlanNote(noteId, userId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  } catch (err) {
    console.error('Error deleting note:', err);
    alert('Failed to delete game plan');
  } finally {
    setDeleting(null);
  }
};
```

### Data Source
- **Primary:** Props (`user` prop) - for backwards compatibility
- **Secondary:** `useUser()` hook - preferred method
- **This is DUAL SOURCING**

### User Resolution Priority
```javascript
// User object priority:
const user = userProp || contextUser;  // Prop wins if provided

// userId priority:
const userId = getUserId()             // 1. Context hook method
  || user?.odUserId                    // 2. odUserId from resolved user
  || user?.uid                         // 3. uid from resolved user
  || user?.username;                   // 4. username from resolved user
```

### Loading States

```javascript
const [loading, setLoading] = useState(true);    // Initial load & refresh
const [deleting, setDeleting] = useState(null);  // Per-note delete (stores noteId)
```

### Loading UI (Lines 107-136)
```javascript
if (loading) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ... }}>
      <div style={{ /* spinning animation */ }} />
      <span>Loading saved game plans...</span>
    </div>
  );
}
```

### Error State UI (Lines 138-170)
```javascript
if (error) {
  return (
    <div style={{ color: '#f87171', ... }}>
      <AlertCircle size={40} />
      <span>{error}</span>
      <button onClick={loadNotes}>
        <RefreshCw size={16} />
        Try Again
      </button>
    </div>
  );
}
```

### Empty State UI (Lines 172-192)
```javascript
if (notes.length === 0) {
  return (
    <div style={{ color: '#8b949e', ... }}>
      <FileText size={48} style={{ opacity: 0.5 }} />
      <h3>No Saved Game Plans</h3>
      <p>Create a BaggerBomb game plan and save it here for future reference.</p>
    </div>
  );
}
```

### Error Handling
| Operation | Error Behavior |
|-----------|----------------|
| Load notes | Sets `error` state, displays retry button |
| Delete note | Shows alert, keeps note in list |
| Both | Log to console, clear loading state |

### What It Does With Data
| Data | Action |
|------|--------|
| `userId` | Passed to `getGamePlanNotes()` and `deleteGamePlanNote()` |
| `notes` | Stored in state, rendered as expandable cards |
| `user` | Only used to derive userId |

---

## 7. Game Plan Notes Service

**File:** `src/services/gamePlanNotesService.js`

### Purpose
Firebase CRUD operations for game plan notes. Handles user authentication fallbacks.

### Full Implementation

```javascript
// src/services/gamePlanNotesService.js
// Firebase CRUD operations for game plan notes

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const COLLECTION_NAME = 'gamePlanNotes';

/**
 * Debug: Log auth state
 */
const debugAuth = () => {
  console.log('[Notes Debug] Auth state:', {
    currentUser: auth?.currentUser,
    uid: auth?.currentUser?.uid,
    email: auth?.currentUser?.email,
    isAnonymous: auth?.currentUser?.isAnonymous
  });
  return auth;
};

/**
 * Get user ID with multiple fallback methods
 * Priority: auth.currentUser > localStorage > sessionStorage > null
 */
const getAuthUserId = () => {
  try {
    // Method 1: Firebase auth current user
    if (auth?.currentUser?.uid) {
      console.log('[Notes] Using Firebase auth uid:', auth.currentUser.uid);
      return auth.currentUser.uid;
    }

    // Method 2: Check localStorage for user data
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        const localId = parsed?.odUserId || parsed?.uid || parsed?.username;
        if (localId) {
          console.log('[Notes] Using localStorage uid:', localId);
          return localId;
        }
      } catch (e) {
        console.warn('[Notes] Failed to parse localStorage user:', e);
      }
    }

    // Method 3: Check sessionStorage
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      try {
        const parsed = JSON.parse(sessionUser);
        const sessionId = parsed?.odUserId || parsed?.uid || parsed?.username;
        if (sessionId) {
          console.log('[Notes] Using sessionStorage uid:', sessionId);
          return sessionId;
        }
      } catch (e) {
        console.warn('[Notes] Failed to parse sessionStorage user:', e);
      }
    }

    console.warn('[Notes] No user ID found in any source');
    return null;
  } catch (e) {
    console.error('[Notes] Error getting auth user ID:', e);
    return null;
  }
};

/**
 * Save a game plan note to Firebase
 * @param {Object} noteData - The game plan data to save
 * @param {string} userId - Optional: pass userId directly if available
 * @returns {Promise<string>} - The ID of the saved note
 */
export const saveGamePlanNote = async (noteData, userId = null) => {
  console.log('[Notes] === SAVE START ===');
  console.log('[Notes] Received noteData:', noteData);
  console.log('[Notes] Received userId param:', userId);

  // Debug auth state
  debugAuth();

  // Try to get user ID from param, then from auth
  const uid = userId || getAuthUserId();

  console.log('[Notes] Final uid:', uid);

  if (!uid) {
    console.error('[Notes] FAILED: No user ID available');
    throw new Error('Please log in to save game plans');
  }

  // Check db connection
  console.log('[Notes] DB instance:', db);
  console.log('[Notes] Collection name:', COLLECTION_NAME);

  try {
    const noteToSave = {
      userId: uid,
      riskStyle: noteData.riskStyle || 'balanced',
      marketStance: noteData.marketStance || 'neutral',
      selectedSectors: noteData.selectedSectors || [],
      mustHavePicks: (noteData.mustHavePicks || []).map(p => ({
        symbol: p?.symbol || p,
        name: p?.name || p?.symbol || p
      })),
      aiStrategy: noteData.aiStrategy || '',
      breakoutCandidates: (noteData.breakoutCandidates || []).slice(0, 10).map(s => ({
        symbol: s?.symbol || s,
        name: s?.name || s?.symbol || s
      })),
      safePlays: (noteData.safePlays || []).slice(0, 10).map(s => ({
        symbol: s?.symbol || s,
        name: s?.name || s?.symbol || s
      })),
      cryptoRecommendation: noteData.cryptoRecommendation ? {
        symbol: noteData.cryptoRecommendation.symbol,
        name: noteData.cryptoRecommendation.name
      } : null,
      wildcards: noteData.wildcards || [],
      sessionPicks: noteData.sessionPicks || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log('[Notes] Document to save:', noteToSave);

    const collectionRef = collection(db, COLLECTION_NAME);
    console.log('[Notes] Collection ref:', collectionRef);

    const docRef = await addDoc(collectionRef, noteToSave);

    console.log('[Notes] SUCCESS! Saved with ID:', docRef.id);

    return docRef.id;

  } catch (error) {
    console.error('[Notes] SAVE ERROR:', error);
    console.error('[Notes] Error code:', error.code);
    console.error('[Notes] Error message:', error.message);

    // Common errors:
    if (error.code === 'permission-denied') {
      console.error('[Notes] PERMISSION DENIED - Check Firestore rules');
    }

    throw error;
  }
};

/**
 * Get all game plan notes for a user
 * @param {string} userId - Optional: pass userId directly
 * @param {number} maxResults - Maximum number of results (default 20)
 * @returns {Promise<Array>} - Array of game plan notes
 */
export const getGamePlanNotes = async (userId = null, maxResults = 20) => {
  console.log('[Notes] === LOAD START ===');
  console.log('[Notes] Received userId param:', userId);

  // Debug auth state
  debugAuth();

  const uid = userId || getAuthUserId();

  console.log('[Notes] Final uid:', uid);

  if (!uid) {
    console.error('[Notes] FAILED: No user ID available');
    throw new Error('Please log in to view saved game plans');
  }

  try {
    console.log('[Notes] Building query...');

    // Try simpler query first (without orderBy to avoid index requirement)
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', uid),
      limit(maxResults)
    );

    console.log('[Notes] Executing query...');

    const querySnapshot = await getDocs(q);

    console.log('[Notes] Query returned', querySnapshot.size, 'documents');

    const notes = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('[Notes] Document:', doc.id, data);
      notes.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to JS Date
        createdAt: data.createdAt?.toDate?.() || new Date()
      });
    });

    // Sort by createdAt client-side (avoids index requirement)
    notes.sort((a, b) => b.createdAt - a.createdAt);

    console.log('[Notes] SUCCESS! Loaded', notes.length, 'notes');

    return notes;

  } catch (error) {
    console.error('[Notes] LOAD ERROR:', error);
    console.error('[Notes] Error code:', error.code);
    console.error('[Notes] Error message:', error.message);

    // Common errors:
    if (error.code === 'permission-denied') {
      console.error('[Notes] PERMISSION DENIED - Check Firestore rules');
    }
    if (error.code === 'failed-precondition') {
      console.error('[Notes] INDEX REQUIRED - Create composite index');
    }

    throw error;
  }
};

/**
 * Get a single game plan note by ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object|null>} - The note data or null
 */
export const getGamePlanNote = async (noteId) => {
  console.log('[Notes] Getting note:', noteId);

  try {
    const docRef = doc(db, COLLECTION_NAME, noteId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log('[Notes] Found note:', noteId);
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date()
      };
    }

    console.log('[Notes] Note not found:', noteId);
    return null;

  } catch (error) {
    console.error('[Notes] Error getting note:', error);
    throw error;
  }
};

/**
 * Delete a game plan note
 * @param {string} noteId - The note ID to delete
 * @param {string} userId - Optional: pass userId for verification
 * @returns {Promise<void>}
 */
export const deleteGamePlanNote = async (noteId, userId = null) => {
  console.log('[Notes] === DELETE START ===');
  console.log('[Notes] noteId:', noteId);

  const uid = userId || getAuthUserId();

  if (!uid) {
    throw new Error('User must be logged in to delete notes');
  }

  try {
    await deleteDoc(doc(db, COLLECTION_NAME, noteId));
    console.log('[Notes] SUCCESS! Deleted:', noteId);
  } catch (error) {
    console.error('[Notes] DELETE ERROR:', error);
    throw error;
  }
};

export default {
  saveGamePlanNote,
  getGamePlanNotes,
  getGamePlanNote,
  deleteGamePlanNote
};
```

### Data Source
- **Primary:** `userId` parameter passed directly
- **Fallback:** `getAuthUserId()` internal function

### getAuthUserId() Resolution Chain (5-level fallback)

```javascript
// Priority order:
1. auth?.currentUser?.uid              // Firebase Auth (if logged in)
2. localStorage.getItem('user')        // localStorage user object
   → parsed.odUserId
   → parsed.uid
   → parsed.username
3. sessionStorage.getItem('user')      // sessionStorage user object
   → parsed.odUserId
   → parsed.uid
   → parsed.username
4. null                                // No user found
```

### Error Handling by Function

| Function | Throws On | Error Message |
|----------|-----------|---------------|
| `saveGamePlanNote` | No userId | `'Please log in to save game plans'` |
| `saveGamePlanNote` | Firestore error | Re-throws original error |
| `getGamePlanNotes` | No userId | `'Please log in to view saved game plans'` |
| `getGamePlanNotes` | Firestore error | Re-throws original error |
| `deleteGamePlanNote` | No userId | `'User must be logged in to delete notes'` |
| `deleteGamePlanNote` | Firestore error | Re-throws original error |

### Firestore Error Detection
```javascript
if (error.code === 'permission-denied') {
  console.error('[Notes] PERMISSION DENIED - Check Firestore rules');
}
if (error.code === 'failed-precondition') {
  console.error('[Notes] INDEX REQUIRED - Create composite index');
}
```

### What It Does With Data

| Function | Input | Output | Firestore Action |
|----------|-------|--------|------------------|
| `saveGamePlanNote` | noteData, userId | docRef.id | `addDoc()` to collection |
| `getGamePlanNotes` | userId, maxResults | Array of notes | `getDocs()` with query |
| `getGamePlanNote` | noteId | Single note or null | `getDoc()` by ID |
| `deleteGamePlanNote` | noteId, userId | void | `deleteDoc()` by ID |

---

## 8. Battle Handlers

**File:** `src/App.jsx`

### Purpose
Handle creating and joining PvP battles. Lives in the main App component where user state is managed.

### handleCreateBattle (Lines 14071-14162)

```javascript
const handleCreateBattle = async () => {
  if (!portfolioName.trim()) {
    alert('Please enter a portfolio name before creating a battle');
    return;
  }

  const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
  if (totalAssets < 7) {
    alert(`Please complete your portfolio (7-13 total assets). You have ${totalAssets}.`);
    return;
  }

  const challengeCode = generateChallengeCode();

  // Convert portfolio to battle format (percentage to dollar amounts)
  const portfolioAssets = portfolio.map(asset => ({
    symbol: asset.symbol,
    name: asset.name,
    price: asset.price,
    amount: (asset.percentage / 100) * 1000000, // $1M portfolio
    position: asset.position || 'long'
  }));

  // Add selected crypto to portfolio using user-defined allocation
  if (selectedCrypto) {
    const cryptoInfo = cryptoData.find(c => c.symbol === selectedCrypto);
    if (cryptoInfo) {
      portfolioAssets.push({
        symbol: selectedCrypto,
        name: cryptoInfo.name || selectedCrypto,
        price: cryptoInfo.price || 0,
        amount: (cryptoPercentage / 100) * 1000000, // Use user-defined cryptoPercentage state
        position: 'long'
      });
    }
  }

  try {
    console.log('Creating PvP battle in Firestore...');

    // Save to Firestore (primary storage for PvP battles)
    const firestoreBattle = await createFirestoreBattle({
      challengeCode,
      creator: {
        uid: user.odUserId || user.username,
        username: user.username
      },
      portfolioName: portfolioName.trim(),
      creatorPortfolio: portfolioAssets,
      portfolioType: portfolioType || 'stocks'
    });

    console.log('Battle created in Firestore with ID:', firestoreBattle.id);

    // Create local battle object for state/localStorage (with Firestore ID)
    const newBattle = {
      id: firestoreBattle.id, // Use Firestore document ID
      challengeCode,
      creator: user.username,
      creatorPortfolio: portfolioAssets,
      portfolioName: portfolioName.trim(),
      portfolioType: portfolioType || 'stocks',
      opponent: null,
      opponentPortfolio: null,
      status: 'waiting',
      startDate: null,
      endDate: null,
      createdAt: new Date().toISOString(),
      firestoreId: firestoreBattle.id // Reference to Firestore doc
    };

    // Also save to localStorage as cache
    const currentBattles = loadBattlesSafe();
    const updatedBattles = [...currentBattles, newBattle];
    saveBattlesSafe(updatedBattles);

    // Update component state
    setBattles(updatedBattles);
    setActiveBattleId(newBattle.id);
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSelectedCrypto(null);
    setCryptoPercentage(10); // Reset to default
    setBuilderMode('create');
    setScreen('dashboard');

  } catch (error) {
    console.error('Failed to create battle in Firestore:', error);
    alert('Failed to create battle. Please check your connection and try again.');
  }
};
```

### handleJoinBattle (Lines 14164-14331)

```javascript
const handleJoinBattle = async () => {
  if (!joinCode.trim()) {
    alert('Please enter a challenge code');
    return;
  }

  if (!portfolioName.trim()) {
    alert('Please enter a portfolio name before joining');
    return;
  }

  const totalAssetsJoin = portfolio.length + (selectedCrypto ? 1 : 0);
  if (totalAssetsJoin < 7) {
    alert(`Please complete your portfolio (7-13 total assets). You have ${totalAssetsJoin}.`);
    return;
  }

  // Convert portfolio to battle format
  const portfolioAssets = portfolio.map(asset => ({
    symbol: asset.symbol,
    name: asset.name,
    price: asset.price,
    amount: (asset.percentage / 100) * 1000000,
    position: asset.position || 'long'
  }));

  // Add selected crypto to portfolio using user-defined allocation
  if (selectedCrypto) {
    const cryptoInfo = cryptoData.find(c => c.symbol === selectedCrypto);
    if (cryptoInfo) {
      portfolioAssets.push({
        symbol: selectedCrypto,
        name: cryptoInfo.name || selectedCrypto,
        price: cryptoInfo.price || 0,
        amount: (cryptoPercentage / 100) * 1000000, // Use user-defined cryptoPercentage state
        position: 'long'
      });
    }
  }

  // Fetch starting prices for the opponent's portfolio
  const startingPrices = {};
  for (const asset of portfolioAssets) {
    try {
      const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === asset.symbol);
      if (isCrypto) {
        const cryptoDataItem = POPULAR_CRYPTO.find(c => c.symbol === asset.symbol);
        // Use symbol (ETH) not id (ethereum) - EODHD expects symbol format
        const data = await stockAPI.getCryptoPrice(cryptoDataItem.symbol);
        startingPrices[asset.symbol] = data.price;
      } else {
        const data = await stockAPI.getStockPrice(asset.symbol);
        startingPrices[asset.symbol] = data.price;
      }
    } catch (error) {
      console.error(`Error fetching price for ${asset.symbol}:`, error);
      startingPrices[asset.symbol] = asset.price;
    }
  }

  // Update portfolio with starting prices
  const updatedPortfolio = portfolioAssets.map(asset => ({
    ...asset,
    price: startingPrices[asset.symbol] || asset.price
  }));

  try {
    console.log('Joining battle in Firestore...');

    // Try to join via Firestore first (for PvP battles created in Firestore)
    const updatedBattle = await joinFirestoreBattle(joinCode.trim().toUpperCase(), {
      uid: user.odUserId || user.username,
      username: user.username,
      portfolioName: portfolioName.trim(),
      portfolio: updatedPortfolio,
      portfolioType: portfolioType || 'stocks',
      startingPrices: startingPrices
    });

    console.log('Joined battle in Firestore:', updatedBattle.id);

    // Create local battle object for state/localStorage
    const localBattle = {
      id: updatedBattle.id,
      challengeCode: updatedBattle.challengeCode,
      creator: updatedBattle.creator.username,
      creatorPortfolio: updatedBattle.creator.portfolio,
      opponent: user.username,
      opponentPortfolio: updatedPortfolio,
      portfolioName: portfolioName.trim(),
      portfolioType: portfolioType || 'stocks',
      status: 'active',
      startDate: updatedBattle.timeline.startDate,
      endDate: updatedBattle.timeline.endDate,
      startingPrices: startingPrices,
      createdAt: updatedBattle.timeline.createdAt,
      firestoreId: updatedBattle.id
    };

    // Update localStorage
    const currentBattles = loadBattlesSafe();
    const updatedBattles = [...currentBattles.filter(b => b.id !== updatedBattle.id), localBattle];
    saveBattlesSafe(updatedBattles);

    // Update component state
    setBattles(updatedBattles);
    setActiveBattleId(localBattle.id);
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSelectedCrypto(null);
    setCryptoPercentage(10);
    setBuilderMode('create');
    setJoinCode('');
    setScreen('dashboard');

  } catch (firestoreError) {
    console.warn('Firestore join failed, trying localStorage:', firestoreError.message);

    // Fallback to localStorage for legacy battles
    const allBattles = loadBattlesSafe();
    const battleToJoin = allBattles.find(
      b => b.challengeCode === joinCode.trim().toUpperCase() && b.status === 'waiting'
    );

    if (!battleToJoin) {
      alert(`Battle not found or already started. Code: ${joinCode.trim().toUpperCase()}`);
      return;
    }

    if (battleToJoin.creator === user.username) {
      alert('You cannot join your own battle');
      return;
    }

    // Calculate start and end dates
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(startDate.getTime() + battleTimer.BATTLE_DURATION);

    // Update the battle in localStorage
    const updatedBattles = allBattles.map(b =>
      b.id === battleToJoin.id
        ? {
            ...b,
            opponent: user.username,
            opponentPortfolio: updatedPortfolio,
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startingPrices: startingPrices
          }
        : b
    );

    saveBattlesSafe(updatedBattles);
    setBattles(updatedBattles);
    setActiveBattleId(battleToJoin.id);
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSelectedCrypto(null);
    setCryptoPercentage(10);
    setBuilderMode('create');
    setJoinCode('');
    setScreen('dashboard');
  }
};
```

### Data Source
- **User Data:** Component state (`user` from `useState` in App.jsx)
- **Does NOT use:** `useUser()` hook
- **Battle Data:** Firestore (primary) + localStorage (cache/fallback)

### How They Access User

```javascript
// In App.jsx, user is local state:
const [user, setUser] = useState(null);

// Battle handlers access directly:
creator: {
  uid: user.odUserId || user.username,  // Fallback chain
  username: user.username
}
```

### userId Resolution Chain
```javascript
user.odUserId || user.username
```

### Error Handling

| Handler | Error Scenario | Behavior |
|---------|---------------|----------|
| `handleCreateBattle` | Empty portfolio name | Alert, return early |
| `handleCreateBattle` | < 7 assets | Alert, return early |
| `handleCreateBattle` | Firestore failure | Alert, log error |
| `handleJoinBattle` | Empty join code | Alert, return early |
| `handleJoinBattle` | Empty portfolio name | Alert, return early |
| `handleJoinBattle` | < 7 assets | Alert, return early |
| `handleJoinBattle` | Firestore failure | Fall back to localStorage |
| `handleJoinBattle` | Battle not found | Alert |
| `handleJoinBattle` | Self-join attempt | Alert |
| `handleJoinBattle` | Price fetch failure | Use existing price (graceful) |

### Storage Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Battle Storage Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CREATE:                                                     │
│    1. createFirestoreBattle() → Firestore (primary)         │
│    2. saveBattlesSafe() → localStorage (cache)              │
│    3. setBattles() → React state (UI)                       │
│                                                              │
│  JOIN:                                                       │
│    1. Try: joinFirestoreBattle() → Firestore                │
│    2. Catch: loadBattlesSafe() → localStorage (fallback)    │
│    3. saveBattlesSafe() → localStorage                      │
│    4. setBattles() → React state (UI)                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Props vs Context Summary Matrix

| Component/Function | Props | Context Hook | localStorage | Firebase Auth | sessionStorage | Notes |
|-------------------|-------|--------------|--------------|---------------|----------------|-------|
| `LocalStorage.saveUser` | - | - | **PRIMARY** | - | - | Direct localStorage API |
| `LocalStorage.loadUser` | - | - | **PRIMARY** | - | - | Direct localStorage API |
| `LocalStorage.clearUser` | - | - | **PRIMARY** | - | - | Direct localStorage API |
| `authService.login` | `username` param | - | via LocalStorage | - | - | Creates user object |
| `authService.logout` | - | - | via LocalStorage | - | - | Clears user |
| `authService.getCurrentUser` | - | - | via LocalStorage | - | - | Returns user |
| `authService.getUserId` | - | - | via LocalStorage | - | - | Fallback chain |
| `UserContext` | - | **PROVIDES** | via authService | - | - | Global state |
| `useUser()` | - | **CONSUMES** | - | - | - | Access context |
| `BaggerBombGamePlanFlow` | `user` **ONLY** | - | - | - | - | Props drilling |
| `GamePlanResultScreen` | `user` | `getUserId()` | - | - | - | **DUAL SOURCE** |
| `NotesTab` | `user` | `useUser()` | - | - | - | **DUAL SOURCE** |
| `gamePlanNotesService` | `userId` param | - | **FALLBACK** | **FALLBACK** | **FALLBACK** | 5-level fallback |
| `App.jsx` battle handlers | - | - | via LocalStorage | - | - | Component state |

### Legend

| Symbol | Meaning |
|--------|---------|
| **PRIMARY** | Main/only data source |
| **FALLBACK** | Used if primary fails |
| **DUAL SOURCE** | Accepts both, prioritizes one |
| **PROVIDES** | Creates and provides data |
| **CONSUMES** | Uses provided data |
| **ONLY** | Exclusive data source |

---

## Key Findings

### 1. Inconsistent User Data Flow
- `App.jsx` manages its own `user` state separately from `UserContext`
- Some components use props, some use hooks, some use both
- This creates potential for state synchronization issues

### 2. Multiple userId Resolution Chains
Different parts of the codebase use different fallback chains:

```javascript
// authService.getUserId()
user?.odUserId || user?.uid || user?.username || null

// gamePlanNotesService.getAuthUserId()
auth.currentUser.uid → localStorage.user → sessionStorage.user → null

// Battle handlers
user.odUserId || user.username
```

### 3. Backwards Compatibility Pattern
Several components accept both props and context for backwards compatibility:
- `NotesTab`: `userProp || contextUser`
- `GamePlanResultScreen`: Uses `getUserId()` with prop fallback

### 4. Error Handling Patterns
- **Services:** Throw errors with user-friendly messages
- **Components:** Try-catch with alerts for user feedback
- **Context:** Graceful degradation (still clears state on error)

### 5. Storage Redundancy
Battle data is stored in multiple locations:
- Firestore (primary, persistent)
- localStorage (cache, offline support)
- React state (UI rendering)

---

## Recommendations for Future Development

1. **Standardize User Data Flow**
   - Consider migrating `App.jsx` to use `UserContext` exclusively
   - Remove props drilling where context is available

2. **Unify userId Resolution**
   - Create a single utility function for userId resolution
   - Use consistently across all services

3. **Document Data Flow**
   - Add TypeScript interfaces for user objects
   - Document expected user object shape

4. **Consider State Management**
   - Evaluate if Redux/Zustand would simplify global state
   - Current dual-state (App + Context) adds complexity

---

*Document generated for audit purposes. All code extracted from TradeSeven codebase.*
