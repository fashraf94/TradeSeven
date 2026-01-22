# MarketClash "Pulse" Dashboard
## Master Design Specification

**Version:** 1.0  
**Created:** January 21, 2026  
**Status:** Ready for Implementation  
**Collaborators:** Flash (Product), Gemini (Design Lead), Claude (Technical Review)

---

## Executive Summary

The "Pulse" Dashboard is a complete redesign of MarketClash's main interface, transforming it from a static grid of game modes into a **living, adaptive command center** that responds to user state, platform events, and competitive intensity.

### Core Design Principles

1. **Earning vs. Wagering Mental Model** - Clear visual separation between low-stakes accumulation and high-stakes competition
2. **Speed to Play** - The Ignition Button gets users from "I want to play" to "I'm in queue" in 2 taps
3. **Adaptive Layout** - The UI transforms based on user balance, active events, and tournament state
4. **Bloomberg Meets Gaming** - Premium terminal aesthetics with competitive gaming energy

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Dashboard Architecture](#2-dashboard-architecture)
3. [The Vault Sidebar](#3-the-vault-sidebar)
4. [The Three Zones](#4-the-three-zones)
5. [Ghost Card System](#5-ghost-card-system)
6. [War Room & Special Events](#6-war-room--special-events)
7. [Takeover Mode](#7-takeover-mode)
8. [The Ignition Button](#8-the-ignition-button)
9. [Matchmaking Flow](#9-matchmaking-flow)
10. [Match Found Overlay](#10-match-found-overlay)
11. [Lobby Loading Screen](#11-lobby-loading-screen)
12. [Mobile Adaptations](#12-mobile-adaptations)
13. [State Management](#13-state-management)
14. [Implementation Phases](#14-implementation-phases)

---

## 1. Design Tokens

### Colors (The "Pulse" Palette)

| Token | Hex | Usage |
|-------|-----|-------|
| `BG_DEEP` | `#0d1117` | Primary app background |
| `CARD_SURFACE` | `#161b22` | Card/sidebar backgrounds |
| `CARD_BORDER` | `#21262d` | Default subtle borders |
| `ACCENT_CYAN` | `#00d9ff` | Builder 1v1 / Primary actions |
| `ACCENT_EMERALD` | `#10b981` | Snake Draft / Success states |
| `ACCENT_PURPLE` | `#8b5cf6` | Training / Tools / Secondary |
| `ACCENT_GOLD` | `#ffc107` | XP / Coins / Rewards |
| `TEXT_PRIMARY` | `#ffffff` | Headings and high-priority text |
| `TEXT_MUTED` | `#6e7681` | Labels and ghost card text |
| `DANGER_RED` | `#ef4444` | Insufficient funds / Error states |

### Motion & Timing

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `T_FAST` | `150ms` | `ease-out` | Hover states, icon scaling |
| `T_NORMAL` | `300ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | Card transitions, Takeover expansion |
| `T_PULSE` | `5000ms` | `linear` | The "Edge Pulse" trace interval |
| `T_IGNITION` | `200ms` | `ease-in` | Radial menu entry |

### Dimensions & Spacing

| Token | Value | Component |
|-------|-------|-----------|
| `RADIUS_LG` | `16px` | Outer Bento/Arena cards |
| `RADIUS_MD` | `12px` | Nested cards within Bento Grid |
| `RADIUS_SM` | `8px` | Buttons / Input fields |
| `SIDEBAR_WIDTH` | `240px` | Desktop Vault Sidebar |
| `MOD_SHEET_H` | `65vh` | Mobile "War Room" overlay height |

---

## 2. Dashboard Architecture

### Desktop Layout (3-Layer Depth System)

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 0: VAULT SIDEBAR (Fixed, 240px)                           │
│  ┌──────────┐                                                    │
│  │ Avatar   │  Layer 1-3: MAIN STAGE (Scrollable)                │
│  │ Balance  │  ┌──────────────────────────────────────────────┐  │
│  │ Earn     │  │ Zone 1: GREENHOUSE (Earning Row)             │  │
│  │ Status   │  │ [Training] [Polls] [Research]                │  │
│  │          │  ├──────────────────────────────────────────────┤  │
│  │ Activity │  │ Zone 2: ARENA (Wagering Hero) - 65%/35%      │  │
│  │ Stream   │  │ [Builder 1v1 - Large] [Snake Draft - Small]  │  │
│  │          │  ├──────────────────────────────────────────────┤  │
│  │ Nav      │  │ Zone 2.5: WAR ROOM (Dynamic - Events)        │  │
│  │ Icons    │  │ [EarningsGame 60%] [BaggerBomb 40%]          │  │
│  │          │  ├──────────────────────────────────────────────┤  │
│  └──────────┘  │ Zone 3: PROGRESSION (Challenges/Goals)       │  │
│                │ [Weekly Challenges Progress Bar]              │  │
│                └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Visual Hierarchy Through Height

| Zone | Approximate Height | Visual Weight |
|------|-------------------|---------------|
| Greenhouse | ~120px | Compact, utility feel |
| Arena | ~300px | **Dominant**, glowing, hero treatment |
| War Room | ~180px (dynamic) | Medium, event-focused |
| Progression | ~100px | Slim, progress-focused |

---

## 3. The Vault Sidebar

### Structure (Desktop - 240px Fixed)

```
┌─────────────────────┐
│  [Avatar]           │  ← Badge pulses with zone hover color
│  Username           │
│  Level 12           │
├─────────────────────┤
│  VAULT              │
│  2,450 🪙           │  ← Large, gold text
│  [+ Buy/Earn]       │
├─────────────────────┤
│  EARN STATUS        │
│  ● Daily Poll       │  ← Filled = complete
│  ○ Training Win     │  ← Empty = available
│  ● Check-in         │  ← Pips show progress
├─────────────────────┤
│  ACTIVITY STREAM    │
│  ┌─────────────────┐│
│  │User99 staked 50 ││  ← Vertical, low-opacity
│  │Draft starting...││  ← Bloomberg terminal feel
│  │Match found!     ││
│  └─────────────────┘│
├─────────────────────┤
│  [🏠] [📊] [🏆] [⚙️] │  ← Nav icons
└─────────────────────┘
```

### Badge Color Behavior

When user hovers over different zones, the avatar badge pulses:
- Greenhouse hover → Purple pulse
- Arena hover → Cyan pulse
- War Room hover → Emerald pulse

---

## 4. The Three Zones

### Zone 1: The Greenhouse (Earning Row)

**Purpose:** Low-stakes accumulation, daily engagement, skill building

**Visual Style:**
- Purple (`#8b5cf6`) accents
- Clean, data-focused cards
- Compact height (~120px)

**Content:**
| Card | Reward | Description |
|------|--------|-------------|
| Training Mode | +15 🪙/win | Practice vs CPU |
| Daily Poll | +5 🪙 | Predict market movement |
| Research Mode | +20 🪙 | Complete learning modules |

### Zone 2: The Arena (Wagering Hero)

**Purpose:** Core competitive gameplay, primary engagement driver

**Visual Style:**
- Cyan (`#00d9ff`) and Emerald (`#10b981`) glows
- Large, heroic cards
- Dominant height (~300px)

**Layout:** Asymmetrical 65%/35% split
- **Builder 1v1 (65%):** Primary action, stake selector built-in
- **Snake Draft (35%):** Secondary, shows next draft countdown

**Stake Selector (Built into card):**
```
Stakes: [50] [100] [250] [500]
        └── Currently selected glows
```

### Zone 3: Progression Tracker

**Purpose:** Long-term engagement, goal tracking

**Visual Style:**
- Gold (`#ffc107`) accents for progress
- Horizontal progress bars
- Slim height (~100px)

**Content:**
- Weekly Challenges: "4/5 Challenges Done"
- Seasonal Progress: XP toward next rank

---

## 5. Ghost Card System

When a user has insufficient balance for an Arena activity, cards enter "Ghost" state.

### Visual Treatment

```css
.card-ghost {
  border: 1px dashed #6e7681;
  opacity: 0.6;
  filter: grayscale(0.4);
  pointer-events: auto; /* Still clickable */
}

.card-ghost .cta-button {
  background: #ffc107; /* Gold */
  content: "Get Coins";
}
```

### The Glow Path Animation

When user clicks a Ghost Card:

1. **Origin:** Gold line spawns at the Ghost Card CTA
2. **Path:** Bezier curve travels to either:
   - Greenhouse (Training Mode) if user has 0 coins
   - Vault "Buy" button if user has some coins
3. **Travel Time:** 600ms ease-out
4. **Arrival:** Target element pulses (scale 1.05 → 1.0)
5. **Fade:** Line fades out over 200ms

**Reduced Motion Fallback:** Skip animation, highlight target immediately

---

## 6. War Room & Special Events

### Dynamic Row Behavior

The War Room only appears when special events are active. It sits between the Arena and Progression zones.

### State A: Single Event (Spotlight)

- Full width (100%)
- Card is 2x standard height
- "Breathing" scale animation (1% grow/shrink)
- Vertical parallax on scroll

### State B: Two Events (Duel)

- 60%/40% asymmetrical split
- **60% Slot:** Event closest to lock time (urgency-driven)
- **40% Slot:** Secondary event
- Re-evaluates every 60 seconds
- Cross-fade transition on swap

### The 60/40 Rule

```javascript
// Determine which event gets primary slot
const getPrimaryEvent = (events) => {
  return events.sort((a, b) => a.lockTime - b.lockTime)[0];
};
```

### The "Edge Pulse" Animation

Instead of a distracting running border:
- Static 1px accent border
- Every 5 seconds: 2px light bead travels the perimeter
- Looks like a data packet through a circuit
- Signals "real-time" without distraction

```css
.edge-pulse-bead {
  position: absolute;
  width: 4px;
  height: 4px;
  background: var(--accent-cyan);
  box-shadow: 0 0 8px 2px var(--accent-cyan);
  border-radius: 50%;
  offset-path: path('M 0,0 L 300,0 L 300,200 L 0,200 Z');
  animation: trace 5s linear infinite;
}

@keyframes trace {
  0% { offset-distance: 0%; opacity: 0; }
  5% { opacity: 1; }
  95% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
```

---

## 7. Takeover Mode

When a major tournament enters its final hour, the dashboard transforms.

### Trigger Conditions

```javascript
if (event.isFinal && event.timeToLock <= 3600) {
  setDashboardState('TAKEOVER');
}
```

### Transition Sequence

1. Arena cards animate downward → collapse to 48px "Minimized Arena Bar"
2. Arena content transforms into horizontal icon-buttons
3. War Room expands to ~100vh (minus header/nav)
4. Leaderboard module shows top 10 with 5s polling

### The Minimized Arena Bar

```
┌──────────────────────────────────────────────────┐
│ [🏗️ 1v1] [🐍 Draft] [📈 Options]  ← Expand Arena │
└──────────────────────────────────────────────────┘
```

### Escape Hatch

- "Minimize" chevron in top-right of Takeover card
- Clicking shrinks War Room back to standard Bento
- Arena cards "spring" back to full size
- Sets `takeover_dismissed: true` for session (won't re-trigger)

### Interruptibility Rules

- If user is mid-action (creating match, in queue): Queue takeover for later
- Show toast: "Tournament Finals starting! Takeover queued."
- Trigger after user completes current action

---

## 8. The Ignition Button

### Concept

The Ignition Button is the primary mobile action - a gesture-based command center that gets users playing in 2 taps.

### Interaction Model

**Quick Tap:** Defaults to last-played mode and stake → Immediately queues

**Long Press (200ms):** Expands radial menu
- **Inner Ring:** Mode selection (Builder 1v1, Snake Draft, Options Arena)
- **Outer Ring:** Stake selection (50, 100, 250, 500 coins)
- **Release:** Fires matchmaking with selected options

### SVG Geometry (200×200 ViewBox)

**Center Point:** (100, 100)

| Zone | Radius Range | Purpose |
|------|--------------|---------|
| Dead Zone | 0 - 30 | Cancel on release |
| Inner Ring | 30 - 65 | Mode selection (3 segments, 120° each) |
| Outer Ring | 65 - 100 | Stake selection (4 segments, 90° each) |
| Touch Padding | 100 - 112 | Extended hit area |

### Hit Detection Math

```javascript
const getZone = (x, y) => {
  const dx = x - 100;
  const dy = y - 100;
  const radius = Math.sqrt(dx * dx + dy * dy);
  
  if (radius < 30) return 'DEAD_ZONE';
  if (radius < 65) return 'MODE_RING';
  if (radius <= 112) return 'STAKE_RING';
  return 'OUTSIDE';
};

const getAngle = (x, y) => {
  const dx = x - 100;
  const dy = y - 100;
  let angle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
  if (angle < 0) angle += 360;
  return angle;
};

const getMode = (angle) => {
  if (angle < 120) return 'BUILDER_1V1';
  if (angle < 240) return 'SNAKE_DRAFT';
  return 'OPTIONS_ARENA';
};

const getStake = (angle) => {
  if (angle < 90) return 50;
  if (angle < 180) return 100;
  if (angle < 270) return 250;
  return 500;
};
```

### Haptic Feedback

| Event | Pattern |
|-------|---------|
| Segment change | `impactLight` (10ms) |
| Ring change | `impactMedium` (15ms) |
| Successful ignition | `impactHeavy` (25ms) |
| Error (insufficient balance) | `[10, 50, 10, 50, 10]` pattern |

### Visual Feedback

- Selected segment fills with accent color (150ms ease-in)
- On successful release: Center emits radial gradient pulse in mode color
- On cancel (dead zone release): Menu collapses with subtle scale-down

---

## 9. Matchmaking Flow

### State Machine

```
IDLE → QUEUING → MATCHED → ACCEPTING → BOTH_ACCEPTED → IN_GAME
  ↑        ↓         ↓          ↓
  └── TIMEOUT ←── DECLINED ←── ERROR
```

### Zustand Store Shape

```javascript
{
  status: 'IDLE' | 'QUEUING' | 'MATCHED' | 'ACCEPTING' | 'BOTH_ACCEPTED' | 'ERROR' | 'TIMEOUT',
  currentMatch: {
    id: string,
    mode: string,
    stake: number,
    opponent: {
      id: string,
      username: string,
      level: number,
      winRate: number,
      streak: number
    }
  } | null,
  error: string | null,
  startTime: timestamp | null,
  timeoutId: number | null
}
```

### WebSocket Events

| Event | Payload | Action |
|-------|---------|--------|
| `MATCH_FOUND` | `{ matchId, opponent }` | Set status to MATCHED, show overlay |
| `MATCH_READY` | `{ lobbyId }` | Both accepted, navigate to game |
| `MATCH_CANCELLED` | `{ reason }` | Return to queue or dashboard |
| `QUEUE_ERROR` | `{ message }` | Set error state |

### Timeout Handling

```javascript
// Start 2-minute timeout when queuing
startQueueTimeout: () => {
  const timeoutId = setTimeout(() => {
    if (get().status === 'QUEUING') {
      set({ 
        status: 'TIMEOUT', 
        error: "No opponents found. Try a different stake.",
        startTime: null 
      });
    }
  }, 120000);
  set({ timeoutId });
}
```

---

## 10. Match Found Overlay

### Visual Design: "The Showdown"

**Backdrop:** Full-screen `#0d1117` at 85% opacity + `backdrop-filter: blur(12px)`

**The VS Animation:**
1. Your avatar slides in from left with Cyan trail
2. Opponent avatar slides in from right with Crimson trail
3. "VS" icon slams down center with radial shockwave

**Stake Display:**
```
STAKE: 500 $MC
```
Gold text with drop-shadow glow, centered below VS icon

### Opponent Stats Card

```
┌─────────────────────────────────────┐
│         [OPPONENT AVATAR]           │
│         "xX_TradeMaster_Xx"         │
│                                     │
│         Level 24 · Diamond          │
│                                     │
│     ┌───────┬───────┬───────┐       │
│     │  67%  │  142  │  🔥 5 │       │
│     │ Win % │Battles│Streak │       │
│     └───────┴───────┴───────┘       │
└─────────────────────────────────────┘
```

### 10-Second Countdown

**Visual:** Circular SVG progress ring

**Color Progression:**
| Time | Color | Feedback |
|------|-------|----------|
| 10-6s | Emerald | Subtle heartbeat audio |
| 5-4s | Gold | Faster heartbeat |
| 3-1s | Red | Heavy haptic pulse each second |

### Actions

- **Accept Button:** Primary, large, cyan glow
- **Decline Button:** Secondary, smaller, muted
- **Auto-decline:** Triggers if timer hits 0

### Edge Cases

**Opponent Declines First:**
- WebSocket: `{ type: 'MATCH_CANCELLED', reason: 'OPPONENT_DECLINED' }`
- UI: Avatars fade, "Searching for new opponent..." appears
- User stays in queue automatically

**Connection Drops:**
- Show "⚠️ Connection Lost. Reconnecting..."
- If reconnection fails in 3s, forfeit match, return to dashboard

**Both Accept (Race Condition):**
- Server is source of truth
- Both clicks → Server emits `MATCH_READY` when both confirmed
- Button shows "LOADING ARENA..." until signal received

---

## 11. Lobby Loading Screen

### Minimal Spec (Ship This)

**Visual:**
- Background: `BG_DEEP` (#0d1117)
- Center: Pulsing MarketClash logo OR simple spinner
- Text: "ENTERING THE ARENA" (Inter Bold, white)
- Subtext: "{Mode} · {Stake} $MC vs {Opponent}" (Inter Regular, muted)
- Progress: Simple horizontal bar with `ACCENT_CYAN` fill

**States:**
| State | Display |
|-------|---------|
| LOADING | Spinner + progress bar |
| READY | Flash "FIGHT!" for 500ms → navigate |
| ERROR | Error message + "Return to Dashboard" button |
| TIMEOUT (>15s) | "Taking longer than expected..." + cancel option |

**Transitions:**
- Entry: Fade in from Showdown (300ms)
- Exit: Quick fade to game (150ms)

---

## 12. Mobile Adaptations

### Navigation Dock (Bottom Bar)

```
[ 🏠 Home ] [ 🔍 Search ] [ ⚡ IGNITION ] [ 📊 Portfolio ] [ 👤 Profile ]
                              ↑
                    Center "Action" button
```

### The Smart Dock (Event Notification)

When a Special Event is active:
- Pill-shaped tab appears above bottom nav
- Shows: "📊 EarningsGame: Rank #12"
- Tap: Slides up War Room as overlay (65vh)
- Drag-to-dismiss enabled

### Mobile Zone Stack

```
┌─────────────────────┐
│ Header (slim)       │
├─────────────────────┤
│ Greenhouse          │  ← Horizontal scroll cards
│ [Train] [Poll]      │
├─────────────────────┤
│ Arena               │  ← Vertical stack
│ ┌─────────────────┐ │
│ │ Builder 1v1     │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Snake Draft     │ │
│ └─────────────────┘ │
├─────────────────────┤
│ War Room / Events   │
│ (if active)         │
├─────────────────────┤
│ Challenges          │
└─────────────────────┘
│ [Navigation Dock]   │
└─────────────────────┘
```

### Wallet Balance Location

- **Header Bar:** Always visible coin balance
- **Not in bottom nav:** Bottom nav is for navigation, not status

---

## 13. State Management

### Zustand Stores

**1. useMatchmakingStore** (Volatile)
- Handles queue state, current match, errors
- Never persisted (prevents stale queue bugs)

**2. useUserPrefsStore** (Persisted)
- Last played mode, last stake
- Uses AsyncStorage/localStorage
- Enables Quick Tap defaults

**3. useDashboardStore** (Session)
- Current dashboard state (NORMAL, TAKEOVER)
- Takeover dismissal flags
- War Room visibility

### WebSocket Provider

```javascript
// Top-level provider handles:
- Connection management
- Reconnection logic
- Event dispatch to stores
- Connection state tracking
```

---

## 14. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** New layout structure without complex interactions

- [ ] Design token CSS variables
- [ ] 3-zone layout (Greenhouse/Arena/War Room placeholder)
- [ ] Vault Sidebar (desktop)
- [ ] Ghost Card visual state
- [ ] Basic mobile responsive layout

**Ship:** Static new layout, existing functionality preserved

### Phase 2: Smart States (Week 3)
**Goal:** Adaptive UI based on user/platform state

- [ ] Ghost Card glow path animation
- [ ] War Room dynamic sizing (single/dual event)
- [ ] Edge Pulse animation
- [ ] Smart Dock (mobile)
- [ ] Earn Status indicators

**Ship:** Dashboard responds to balance and events

### Phase 3: Ignition Button (Week 4)
**Goal:** New primary interaction model

- [ ] Radial menu SVG rendering
- [ ] Gesture handling (React Native + Web)
- [ ] Haptic feedback integration
- [ ] Quick Tap defaults
- [ ] Balance validation

**Ship:** Users can queue via Ignition Button

### Phase 4: Matchmaking Flow (Week 5-6)
**Goal:** Complete queue → match → game flow

- [ ] Zustand stores (matchmaking + prefs)
- [ ] WebSocket integration
- [ ] Match Found overlay
- [ ] Lobby Loading screen
- [ ] Error handling and timeouts

**Ship:** Full matchmaking experience

### Phase 5: Takeover Mode (Week 7)
**Goal:** Tournament finals experience

- [ ] Takeover trigger logic
- [ ] Arena minimize animation
- [ ] War Room expansion
- [ ] Live leaderboard polling
- [ ] Escape hatch and session persistence

**Ship:** Tournaments feel like events

### Phase 6: Polish (Week 8)
**Goal:** Refinement and edge cases

- [ ] Animation timing adjustments
- [ ] Accessibility audit (reduced motion, screen readers)
- [ ] Performance optimization
- [ ] Beta tester feedback integration

**Ship:** Production-ready Pulse Dashboard

---

## Appendix A: File Structure (Proposed)

```
src/
├── components/
│   ├── dashboard/
│   │   ├── VaultSidebar.jsx
│   │   ├── GreenhouseZone.jsx
│   │   ├── ArenaZone.jsx
│   │   ├── WarRoomZone.jsx
│   │   ├── ProgressionZone.jsx
│   │   └── SmartDock.jsx
│   ├── ignition/
│   │   ├── IgnitionButton.jsx
│   │   ├── RadialMenu.jsx
│   │   └── ignitionGeometry.js
│   ├── matchmaking/
│   │   ├── MatchFoundOverlay.jsx
│   │   ├── ShowdownAnimation.jsx
│   │   ├── CountdownCircle.jsx
│   │   └── LobbyLoading.jsx
│   └── cards/
│       ├── GameModeCard.jsx
│       ├── GhostCard.jsx
│       └── EventCard.jsx
├── stores/
│   ├── useMatchmakingStore.js
│   ├── useUserPrefsStore.js
│   └── useDashboardStore.js
├── hooks/
│   ├── useMatchmakingSocket.js
│   └── useIgnitionGesture.js
├── styles/
│   └── tokens.css
└── utils/
    └── haptics.js
```

---

## Appendix B: Audio Cues (Future)

| Event | File | Description |
|-------|------|-------------|
| Match Found | `sfx_match_found.mp3` | Dramatic reveal sting |
| Countdown Tick | `sfx_tick.mp3` | Subtle tick each second |
| Countdown Urgent | `sfx_urgent_tick.mp3` | Faster tick for last 3s |
| Accept Confirm | `sfx_accept.mp3` | Positive confirmation |
| Opponent Declined | `sfx_declined.mp3` | Brief negative tone |
| Both Accepted | `sfx_arena_gates.mp3` | Epic "entering arena" sound |

---

## Appendix C: Accessibility Requirements

- All animations respect `prefers-reduced-motion`
- Ignition Button has accessible fallback (select dropdowns)
- Color is never the only indicator (icons/patterns supplement)
- Focus states visible for keyboard navigation
- Screen reader announcements for state changes

---

*End of Master Specification*
