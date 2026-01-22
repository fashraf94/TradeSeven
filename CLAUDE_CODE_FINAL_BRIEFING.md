# Claude Code Final Briefing
## Pulse Dashboard Implementation - All Questions Answered

**Date:** January 22, 2026  
**Status:** GREEN LIGHT FOR PHASE 1

---

## Decisions Summary

| Question | Decision |
|----------|----------|
| WebSocket vs Firestore for Matchmaking | **Firestore** - Use `matchmakingQueue` collection |
| Feature Flag Deployment | **Yes** - `PULSE_DASHBOARD` flag for gradual rollout |
| Tournament Data Source | **`earningsTournaments`** collection |
| BaggerBomb Handling | **Option A** - BaggerBomb Training in Greenhouse Zone |
| User Coin Balance | **Store in Vault Sidebar** (new feature, local state for now) |
| New Collection Needed | **`matchmakingQueue`** - create for PvP matching |

---

## Firestore Collection Mappings

### Existing Collections → Pulse Zones

| Collection | Zone | Component | Usage |
|------------|------|-----------|-------|
| `trainingBattles` | Greenhouse | TrainingCard | "Training Mode - Earn coins" |
| `trainingBattles` (baggerbomb prefix) | Greenhouse | BaggerBombCard | "BaggerBomb Training" |
| `battles` | Arena | Builder1v1Card | Classic PvP matches |
| `drafts` | Arena | SnakeDraftCard | Snake Draft games |
| `earningsTournaments` | War Room | EarningsGameCard | Weekly tournaments |
| `earningsPortfolios` | War Room | (user's entry status) | "You're rank #X" |

### New Collection: `matchmakingQueue`

```javascript
// Collection: matchmakingQueue
// Document ID: auto-generated

{
  odcumentId: "user_uid_here",
  odcumentName: "Flash",
  mode: "BUILDER_1V1" | "SNAKE_DRAFT" | "OPTIONS_ARENA",
  stake: 50 | 100 | 250 | 500,
  status: "WAITING" | "MATCHED" | "CANCELLED" | "EXPIRED",
  matchedWith: null | "opponent_uid",
  matchId: null | "battle_document_id",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  expiresAt: Timestamp  // Auto-expire after 2 minutes
}
```

**Matching Logic (Cloud Function or client-side):**
1. User joins queue → Create document with status "WAITING"
2. Query for other "WAITING" users with same `mode` and `stake`
3. If found → Update both documents to "MATCHED", set `matchedWith` and `matchId`
4. Create battle document in `battles` or `drafts` collection
5. Both users listen to their queue document for status changes

---

## Tournament Data Structure

### `earningsTournaments` Document

```javascript
{
  id: "tournament_2026_W3",
  name: "Earnings Week Jan 12 - Jan 16, 2026",
  status: "upcoming" | "in_progress" | "locked" | "resolved",
  createdAt: Timestamp,
  lockDeadline: "2026-01-17T05:59:59.999Z",  // ISO string
  lockedAt: Timestamp | null,
  weekStart: "2026-01-12",
  weekEnd: "2026-01-17",
  entryCount: 66
}
```

### Takeover Mode Trigger Logic

```javascript
const checkTakeoverMode = (tournament) => {
  if (tournament.status !== 'in_progress') return false;
  
  const lockTime = new Date(tournament.lockDeadline);
  const now = new Date();
  const hoursRemaining = (lockTime - now) / (1000 * 60 * 60);
  
  // Trigger Takeover when less than 1 hour remains
  return hoursRemaining <= 1 && hoursRemaining > 0;
};
```

### War Room Display Logic

```javascript
const getWarRoomEvents = async () => {
  const tournaments = await db.collection('earningsTournaments')
    .where('status', 'in', ['upcoming', 'in_progress'])
    .orderBy('lockDeadline', 'asc')
    .limit(2)
    .get();
  
  return tournaments.docs.map(doc => ({
    id: doc.id,
    type: 'EARNINGS_GAME',
    ...doc.data(),
    // Calculate time remaining for display
    timeToLock: new Date(doc.data().lockDeadline) - new Date()
  }));
};
```

---

## User Coin Balance

### Initial Implementation (Phase 1)

For Phase 1, store coin balance in **local component state** within VaultSidebar:

```javascript
// VaultSidebar.jsx
const [coinBalance, setCoinBalance] = useState(1000); // Default starting balance

// Later phases will:
// 1. Persist to Firestore users collection
// 2. Add earning/spending logic
// 3. Connect to actual game outcomes
```

### Future: Users Collection Schema

```javascript
// Collection: users/{odcumentId}
{
  odcumentId: "user_uid",
  displayName: "Flash",
  coinBalance: 2450,
  level: 12,
  xp: 8500,
  stats: {
    totalBattles: 142,
    wins: 82,
    winRate: 0.577,
    currentStreak: 3
  },
  preferences: {
    lastPlayedMode: "BUILDER_1V1",
    lastStake: 100
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Zone Content Mapping

### Greenhouse Zone (Earning)

| Card | Data Source | Reward Display |
|------|-------------|----------------|
| Training Mode | `trainingBattles` (mode: "training") | "+15 🪙 per win" |
| BaggerBomb Training | `trainingBattles` (prefix: "training_baggerbomb") | "+10 🪙 per win" |
| Daily Poll | New feature (Phase 2+) | "+5 🪙" |
| Research Mode | Existing screen link | "+20 🪙" |

### Arena Zone (Wagering)

| Card | Data Source | Stake Options |
|------|-------------|---------------|
| Builder 1v1 | `battles` + `matchmakingQueue` | 50, 100, 250, 500 |
| Snake Draft | `drafts` + `matchmakingQueue` | 50, 100, 250, 500 |
| Options Arena | Future | 50, 100, 250, 500 |

### War Room Zone (Special Events)

| Card | Data Source | Display |
|------|-------------|---------|
| EarningsGame | `earningsTournaments` | Countdown, entry count, user rank |

### Progression Zone

| Card | Data Source | Display |
|------|-------------|---------|
| Weekly Challenges | New feature (Phase 6+) | Progress bar |
| Season Progress | New feature (Phase 6+) | XP to next level |

---

## Feature Flag Implementation

### File: `src/config/featureFlags.js`

```javascript
export const FEATURE_FLAGS = {
  // Set to true to enable Pulse Dashboard
  PULSE_DASHBOARD: process.env.REACT_APP_PULSE_DASHBOARD === 'true' || false,
  
  // Individual feature toggles for gradual rollout
  PULSE_IGNITION_BUTTON: false,  // Phase 3
  PULSE_MATCHMAKING: false,       // Phase 4
  PULSE_TAKEOVER: false,          // Phase 5
};

// Helper to check if user should see Pulse
export const shouldShowPulseDashboard = (user) => {
  // Option 1: Global flag
  if (FEATURE_FLAGS.PULSE_DASHBOARD) return true;
  
  // Option 2: Beta tester flag on user object
  if (user?.betaTester) return true;
  
  // Option 3: Specific user IDs for testing
  const betaTesters = ['your_uid_here'];
  if (betaTesters.includes(user?.odcumentId)) return true;
  
  return false;
};
```

### Usage in App.jsx or Router

```javascript
import { shouldShowPulseDashboard } from './config/featureFlags';

// In render/return:
{shouldShowPulseDashboard(user) ? (
  <PulseDashboardScreen />
) : (
  <DashboardScreen />
)}
```

---

## Phase 1 Verification Checklist

After Phase 1 completion, verify:

- [ ] `npm run dev` starts without errors
- [ ] Feature flag `PULSE_DASHBOARD=true` shows new screen
- [ ] VaultSidebar renders with:
  - [ ] User avatar/name from UserContext
  - [ ] Coin balance (local state, default 1000)
  - [ ] Placeholder earn status pips
- [ ] Greenhouse Zone renders with Training Mode card
- [ ] Arena Zone renders with Builder 1v1 and Snake Draft cards
- [ ] War Room Zone renders (empty or with active tournament if exists)
- [ ] Progression Zone renders with placeholder
- [ ] Ghost Card state works when balance < stake
- [ ] Mobile responsive layout stacks zones vertically
- [ ] Existing dashboard still works when flag is false

---

## Files to Create (Phase 1)

```
src/
├── config/
│   └── featureFlags.js                    # NEW
├── stores/
│   ├── index.js                           # NEW
│   ├── useDashboardStore.js               # NEW
│   ├── useUserPrefsStore.js               # NEW
│   └── useMatchmakingStore.js             # NEW (shell only)
├── components/
│   └── Pulse/
│       ├── index.js                       # NEW
│       ├── VaultSidebar.jsx               # NEW
│       ├── GhostCard.jsx                  # NEW
│       └── zones/
│           ├── index.js                   # NEW
│           ├── GreenhouseZone.jsx         # NEW
│           ├── ArenaZone.jsx              # NEW
│           ├── WarRoomZone.jsx            # NEW
│           └── ProgressionZone.jsx        # NEW
├── screens/
│   └── PulseDashboardScreen.jsx           # NEW
└── styles/
    └── pulse.css                          # NEW
```

---

## START PHASE 1

You are now cleared to begin implementation. Start with:

1. Install Zustand: `npm install zustand`
2. Create `/src/config/featureFlags.js`
3. Create `/src/stores/` directory and store shells
4. Create `/src/styles/pulse.css` with design tokens
5. Create `/src/components/Pulse/` directory structure
6. Create `PulseDashboardScreen.jsx` shell
7. Wire up feature flag in routing

Reference `PULSE_DASHBOARD_MASTER_SPEC.md` for all visual specifications, animations, and component details.

**GO BUILD! 🚀**
