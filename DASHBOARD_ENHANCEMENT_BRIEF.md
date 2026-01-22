# Dashboard Enhancement Brief
## Applying Pulse Concepts to Original Dashboard

**Date:** January 22, 2026  
**Approach:** Enhance existing dashboard with better organization, NOT a rebuild  
**Goal:** Better layout and flow while keeping battle-tested mobile components

---

## The Core Insight

The original dashboard components work well, especially on mobile. What was missing:
- Clear visual hierarchy
- Logical grouping (earning vs competing)
- Visible coin balance
- Better section organization

**We don't need new components. We need better organization of existing ones.**

---

## Concepts to Apply (from Pulse Design Session)

### 1. Zone-Based Organization

Group existing components into logical sections:

```
┌─────────────────────────────────────┐
│ HEADER: Balance + User Info         │
├─────────────────────────────────────┤
│ EARN COINS (Greenhouse concept)     │
│ - Training Mode                     │
│ - Daily Poll (if exists)            │
│ - Research Mode link                │
├─────────────────────────────────────┤
│ COMPETE (Arena concept)             │
│ - Builder 1v1 ⭐ (primary)          │
│ - Snake Draft                       │
│ - Options Arena (if exists)         │
├─────────────────────────────────────┤
│ EVENTS (War Room concept)           │
│ - EarningsGame (when active)        │
│ - BaggerBomb (when active)          │
├─────────────────────────────────────┤
│ PROGRESS (optional)                 │
│ - Weekly challenges                 │
│ - Level/XP                          │
└─────────────────────────────────────┘
```

### 2. Section Headers

Add simple headers to create visual separation:

```jsx
<div className="section-header">
  <span className="section-label">EARN COINS</span>
  <span className="section-subtitle">Low-risk ways to build your balance</span>
</div>
```

Style:
- Label: 12px uppercase, letter-spacing 1px, muted color
- Subtle bottom border or background differentiation

### 3. Coin Balance Visibility

**Mobile:** Add balance to header area (always visible)
```jsx
<div className="mobile-header">
  <span>Hi, {username}</span>
  <div className="balance-pill">🪙 {balance.toLocaleString()}</div>
</div>
```

**Desktop:** Can use sidebar or header, whatever fits current layout

### 4. Visual Hierarchy

Make "Compete" section feel more prominent than "Earn":
- Earn section: Smaller cards, compact
- Compete section: Larger cards, more padding, subtle glow on hover
- Events section: Special treatment when active (border accent, "LIVE" badge)

### 5. The 60/40 Rule for Events

When multiple events are active, the one closest to deadline gets more prominence:
```javascript
const sortedEvents = events.sort((a, b) => 
  new Date(a.lockDeadline) - new Date(b.lockDeadline)
);
// First event = primary (larger), second = secondary (smaller)
```

---

## What NOT to Do

❌ Don't create new component files for things that already exist  
❌ Don't add Zustand or new state management  
❌ Don't build the Ignition Button (radial menu concept)  
❌ Don't create a parallel dashboard screen  
❌ Don't change how game modes actually work  

---

## Implementation Approach

### Phase 1: Add Section Headers (~1 hour)
- Add "EARN COINS" header above Training Mode
- Add "COMPETE" header above Builder 1v1
- Add "EVENTS" header above EarningsGame (if visible)
- Just text + simple styling, no structural changes

### Phase 2: Mobile Balance Header (~30 min)
- Add coin balance to mobile header/top area
- Should be visible without scrolling

### Phase 3: Visual Hierarchy (~1-2 hours)
- Increase padding/prominence of Compete section
- Make Earn section slightly more compact
- Add subtle background differentiation between sections

### Phase 4: Event Prominence (if applicable) (~1 hour)
- When EarningsGame is active, add visual emphasis
- "LIVE" or "LOCKS IN X HOURS" badge
- Subtle border glow or accent

---

## Design Tokens to Use

Use existing `colors` object from App.jsx:
```javascript
colors.cyan      // #00d9ff - Primary accent (Builder)
colors.green     // #10b981 - Success/Snake Draft
colors.purple    // #9333ea - Training/Secondary  
colors.gold      // #ffc107 - Coins/Rewards
colors.textMuted // #6e7681 - Section labels
```

---

## Success Criteria

After implementation:
- [ ] User can see their coin balance on mobile without scrolling
- [ ] Dashboard has clear visual sections (Earn / Compete / Events)
- [ ] Compete section feels like the "main" area
- [ ] Existing functionality is 100% preserved
- [ ] Mobile experience is as good or better than before

---

## Reference: What We Learned

From the Pulse Dashboard experiment:
1. **New components are risky** - The original mobile components work; don't replace them
2. **Layout > Components** - Organization matters more than new UI elements
3. **Floating buttons are distracting** - The Ignition Button concept didn't work in practice
4. **Desktop and mobile need different approaches** - Don't force one layout to work for both
5. **Test early on real devices** - We built too much before mobile testing

---

## Prompt for New Claude Code Session

```
I want to enhance the existing dashboard with better organization, NOT rebuild it.

Please read DASHBOARD_ENHANCEMENT_BRIEF.md from project knowledge.

Key points:
- Keep all existing components
- Add section headers (EARN COINS, COMPETE, EVENTS)
- Add coin balance visibility on mobile
- Improve visual hierarchy (Compete section more prominent)
- Do NOT create new component files or state management

Start with Phase 1: Add section headers to the existing dashboard.
```

---

*This document captures the valuable insights from the Pulse Dashboard design session while avoiding the over-engineering that made mobile clunky.*
