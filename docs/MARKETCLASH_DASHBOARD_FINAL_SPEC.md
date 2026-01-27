# MarketClash Dashboard Redesign - Final Implementation Spec

## Overview

This document is the complete design specification for the MarketClash dashboard redesign. It covers all components, states, visual treatments, and interaction logic needed for implementation.

---

## Navigation Structure

### Header Bar
```
┌─────────────────────────────────────────┐
│  ☰   [MarketClash Logo]   🪙 2,450  [F] │
└─────────────────────────────────────────┘
```

| Element | Position | Description |
|---------|----------|-------------|
| Hamburger Menu | Left | Opens sidebar navigation |
| Logo | Center | MarketClash bull/bear logo |
| Token Balance | Right of center | `🪙 2,450` - User's token count |
| Avatar | Far right | User initial in circle, shows rank color |

### Tab Bar
Three primary tabs below the header:

| Tab | Label | Icon | Purpose |
|-----|-------|------|---------|
| 1 | **PVP** | ⚔️ | Competitive multiplayer battles |
| 2 | **TRAIN & EARN** | 🪙 | Solo AI practice games |
| 3 | **RESEARCH** | 📊 | Stock/crypto research tools |

**Tab Styling:**
- Active tab: Amber/gold fill (#f59e0b) with dark text
- Inactive tabs: Dark background with grey text (#8b949e)
- All tabs have icons for quick recognition

---

## PVP Tab Structure

### Section Order (Top to Bottom):
1. **Live Clashes** (conditional - only if active PVP battles exist)
2. **Seasonal** (conditional - only during seasonal events)
3. **Enter the Arena** (always visible)
4. **Live Feed** (always visible, peek element)

---

## TRAIN & EARN Tab Structure

### Section Order (Top to Bottom):
1. **Active Training** (conditional - only if active training battles exist)
2. **Seasonal** (conditional - contextual 2x token variant)
3. **Quick Play** (always visible)
4. **Your Activity** (always visible, peek element)

---

## Live Clashes / Active Training Section

### Section Header
```
⚔️ LIVE CLASHES    2 active • 1 ending soon
```
- Left: Icon + "LIVE CLASHES" (PVP) or "ACTIVE TRAINING" (Training)
- Right: Count + urgency indicator

### Carousel Behavior
- Horizontal scroll with "peek" showing partial next card
- Dot indicators below: `• ○ ○` (filled = current)
- Swipe to navigate between cards

### When Empty
- Section does not appear at all
- User sees Seasonal (if active) or game cards first

---

## Clash Card Design - 1v1 Battles (Builder, BaggerBomb)

### Layout Structure
```
┌────────────────────────────────────────┐
│ ⚔️ BUILDER 1v1                 ⏱ 04:12 │  ← Header
│                                        │
│    (You)           VS      (Opponent)  │  ← VS Zone
│   👤 Avatar              👤 Avatar     │
│   -12.34%               -08.76%        │
│              👑                        │  ← Winner Badge
│            [LOSING]                    │  ← Status Badge
│                                        │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Tug-of-War Bar
└────────────────────────────────────────┘
```

### Header Row
| Element | Position | Details |
|---------|----------|---------|
| Battle Type Icon | Left | ⚔️ Builder, 💣 BaggerBomb, 🐍 Snake Draft |
| Battle Type Label | Left | "BUILDER 1v1", "BAGGERBOMB", etc. |
| Timer | Right | Format varies by urgency (see Timer Rules) |

### VS Zone
| Element | Details |
|---------|---------|
| Your Avatar | Left side, colored ring (green if winning, red if losing) |
| "VS" Graphic | Center, stylized |
| Opponent Avatar | Right side, colored ring (opposite of yours) |
| Your Return % | Below your avatar, large text, color-coded |
| Opponent Return % | Below their avatar, large text, color-coded |
| Username | Below avatar, truncate with "..." after 10 chars |

### Winner Indicators
| Indicator | Placement | Details |
|-----------|-----------|---------|
| 👑 Crown Badge | Floats near winning player's percentage | Small crown icon |
| Status Badge | Center, below VS zone | "WINNING" (green) or "LOSING" (red) |

### Tug-of-War Progress Bar
- Thin horizontal bar (4-6px height) at bottom of card
- Split into two colors showing relative performance
- Your color (left): Cyan (#00d9ff) for PVP
- Opponent color (right): Grey (#6b7280)
- Bar ratio reflects performance gap
- **Logic:** Winner's side takes proportionally more of the bar

**Example Calculation:**
```
You: +5.2%    Opponent: +2.1%
Total spread: 5.2 + 2.1 = 7.3 (using absolute values for ratio)
Your share: 5.2 / 7.3 = 71%
Bar: [███████████████████░░░░░░░░]
```

**When both negative:**
```
You: -12.34%    Opponent: -8.76%
Opponent is winning (lost less money)
Opponent share is larger portion of bar
Bar: [████████░░░░░░░░░░░░░░░░░░░]
```

### Card Border & Glow
| State | Border Color | Glow Effect |
|-------|--------------|-------------|
| PVP - Normal | Cyan (#00d9ff) 2px | Subtle cyan glow |
| PVP - Ending Soon (< 1hr) | Red (#ef4444) 2px | Pulsing red glow |
| PVP - Losing | Red (#ef4444) 2px | Subtle red glow |
| Training | Purple (#9333ea) 2px | Subtle purple glow |

### Multiple Urgent Battles
- All battles < 1 hour get red timer text
- Only the MOST urgent (soonest ending) gets the pulsing border glow
- Others get red timer but standard border treatment

---

## Clash Card Design - 4-Player (Snake Draft)

Snake Draft has 4 players, so NO VS layout. Use leaderboard format instead.

### Layout Structure
```
┌────────────────────────────────────────┐
│ 🐍 SNAKE DRAFT PVP             ⏱ 14h 22m │
│                                          │
│  [1] 👤 Leader                           │
│  [2] 👤 YOU            -2.45%            │
│  [3] 👤 Player3        (2nd PLACE)       │
│  [4] 👤 Last                             │
│                                          │
│                        LADDER GAP:       │
│                        -0.85% to 1st     │
└──────────────────────────────────────────┘
```

### Leaderboard Layout
| Element | Details |
|---------|---------|
| Position Numbers | [1], [2], [3], [4] with position indicator |
| Avatars | Small avatars next to each position |
| YOUR row | Highlighted/emphasized, shows your username as "YOU" |
| Your Return | Large percentage display on the right |
| Place Label | "(2nd PLACE)" below return |
| Ladder Gap | Shows distance to 1st place: "-0.85% to 1st" |

### Position Styling
| Position | Style |
|----------|-------|
| 1st | Gold accent (#f59e0b), 👑 icon optional |
| 2nd-3rd | Standard white text |
| 4th (Last) | Slightly dimmed text |
| YOUR position | Highlighted row background, cyan accent |

---

## Clash Card - Training Variant

Training battles are against AI, so simplified display.

### Layout Structure
```
┌────────────────────────────────────────┐
│ 🐍 SNAKE DRAFT AI              ⏱ 02:34 │
│                                        │
│        Your Return: +3.2%              │
│        Position: #2 of 4               │
│                                        │
└────────────────────────────────────────┘
```

### Differences from PVP
| Element | Training Treatment |
|---------|-------------------|
| Border Color | Purple (#9333ea) |
| Label | Includes "AI" (e.g., "SNAKE DRAFT AI") |
| VS Zone | Not shown - just your stats |
| Opponent | Not displayed (it's AI) |
| Tug-of-War | Optional - can omit for simplicity |

---

## Timer Display Rules

### Format by Time Remaining
| Time Remaining | Format | Color | Effect |
|----------------|--------|-------|--------|
| > 1 hour | `14h 22m` | Cyan (PVP) / Purple (Training) | None |
| ≤ 1 hour | `45:32` | Red (#ef4444) | Subtle pulse |
| ≤ 5 minutes | `04:12!!` | Red (#ef4444) | Urgent pulse, `!!` suffix |

### Timer Icon
- Use hourglass ⏳ or timer ⏱ icon
- Icon inherits the timer color

---

## Seasonal Section

### Placement
- Below Live Clashes (if present) or at top (if no active battles)
- Appears only when seasonal content is active

### Single Item Display (Most Common)
When ONE seasonal event exists, show as full-width banner:

```
┌────────────────────────────────────────┐
│ 🏆 SEASONAL                            │
│ ┌────────────────────────────────────┐ │
│ │  🏆 EarningsGame Tournament        │ │
│ │  Ends in 3 days • 147 players      │ │
│ │  [ ENTER TOURNAMENT ]              │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### Multiple Items Display
When 2+ seasonal events exist, show as horizontal carousel with peek.

### Visual Style
| Element | Value |
|---------|-------|
| Accent Color | Amber/Gold (#f59e0b) |
| Border | 2px solid amber with subtle glow |
| Background | Dark with amber gradient tint |
| Icon | 🏆 Trophy |

### Contextual Variants
| Tab | Seasonal Content |
|-----|------------------|
| PVP | "EarningsGame Tournament" - competitive focus |
| TRAIN & EARN | "Limited Time: 2X TOKENS Practice Drills" - rewards focus |

### When No Seasonal Content
- Section does not appear at all
- Space is reclaimed by sections below

---

## Enter the Arena Section (PVP Tab)

### Section Header
```
⚔️ ENTER THE ARENA
```

### Card Carousel
Horizontal carousel with 3 game type cards:

| Card | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | 🐍 | Snake Draft | "4-player draft battle" |
| 2 | ⚔️ | Builder 1v1 | "Head-to-head portfolio" |
| 3 | 💣 | BaggerBomb | "Volatility scoring" |

### Card Layout
```
┌──────────────────┐
│     🐍           │  ← Large icon in colored circle
│                  │
│  Snake Draft     │  ← Title
│  4-player battle │  ← Description
│                  │
│  3 open lobbies  │  ← Lobby count (if any)
│                  │
│ [CREATE] [JOIN]  │  ← Action buttons
└──────────────────┘
```

### Card Styling
- Use existing game card design language (larger icons, gradients, visual richness)
- Accent color: Cyan (#00d9ff) for PVP cards
- Show active lobby count when lobbies exist
- Two buttons: CREATE LOBBY and JOIN LOBBY

### Button Behavior
| Button | Action |
|--------|--------|
| CREATE | Opens lobby creation flow for that game type |
| JOIN | Opens lobby browser filtered to that game type |

---

## Quick Play Section (TRAIN & EARN Tab)

### Section Header
```
🪙 QUICK PLAY
```

### Card Carousel
Horizontal carousel with 3 AI game type cards:

| Card | Icon | Title | Subtitle |
|------|------|-------|----------|
| 1 | 🐍 | Snake Draft AI | "vs AI • ~5 min" |
| 2 | 🔨 | Builder AI | "vs AI • ~5 min" |
| 3 | 💣 | BaggerBomb AI | "vs AI • ~5 min" |

### Card Layout
```
┌──────────────────┐
│     🐍           │  ← Large icon in colored circle
│                  │
│  Snake Draft AI  │  ← Title
│  vs AI • ~5 min  │  ← Subtitle with duration
│                  │
│   [ PLAY NOW ]   │  ← Single action button
└──────────────────┘
```

### Card Styling
- Same design language as PVP cards but with purple accent
- Accent color: Purple (#9333ea) for Training cards
- Single button: PLAY NOW
- **Do NOT display token reward amounts**

---

## Live Feed Section (PVP Tab)

### Section Header
```
📡 LIVE FEED
```

### Placement
- Bottom of PVP tab
- "Peek" element - show ~1.5 items to encourage scrolling
- Full scroll reveals more feed items

### Content Types (3 Types, Visually Distinct)

#### 1. Open Lobby
```
┌─ CYAN ACCENT ───────────────────────────┐
│ 🐍 CryptoKing created a Snake Draft     │
│    lobby • 2/4 players           [JOIN] │
└─────────────────────────────────────────┘
```
- Left border: Cyan (#00d9ff)
- Button: `[JOIN]` in cyan
- Tapping JOIN enters that specific lobby

#### 2. Winning Portfolio
```
┌─ GREEN ACCENT ──────────────────────────┐
│ 🏆 PlayerX won Builder 1v1              │
│    +12.4% return                 [VIEW] │
└─────────────────────────────────────────┘
```
- Left border: Green (#10b981)
- Button: `[VIEW]` in green
- Tapping VIEW shows the winner's portfolio composition

#### 3. Top Performing Stock
```
┌─ AMBER ACCENT ──────────────────────────┐
│ 📈 NVDA is today's top performer        │
│    +8.2% • 47 BaggerBombs triggered     │
└─────────────────────────────────────────┘
```
- Left border: Amber (#f59e0b)
- No button (informational only)
- Shows stock ticker, performance, and relevant stat

### Feed Item Styling
| Element | Value |
|---------|-------|
| Background | Card background (#161b22) |
| Left Border | 4px, color based on content type |
| Padding | 12-16px |
| Text Primary | White (#ffffff) |
| Text Secondary | Grey (#8b949e) |
| Button | Pill style, color matches accent |

---

## Your Activity Section (TRAIN & EARN Tab)

### Section Header
```
⚡ YOUR ACTIVITY
```

### Placement
- Bottom of TRAIN & EARN tab
- "Peek" element - show ~1.5 items to encourage scrolling

### Content Types

#### Completed Game
```
┌─────────────────────────────────────────┐
│ ✓ Snake Draft AI completed              │
│   10 min ago                            │
└─────────────────────────────────────────┘
```

#### Win Streak
```
┌─────────────────────────────────────────┐
│ 🔥 3-win streak!                        │
└─────────────────────────────────────────┘
```

#### Challenge Completed
```
┌─────────────────────────────────────────┐
│ ✓ Weekly Challenge done: Win 3 Drafts   │
└─────────────────────────────────────────┘
```

#### Personal Best
```
┌─────────────────────────────────────────┐
│ ⭐ New record! Fastest draft: 4:32      │
└─────────────────────────────────────────┘
```

### Styling
- Simple list format
- Checkmarks, fire emoji, star emoji for visual variety
- Timestamps in grey (#8b949e)
- No buttons (informational only)

---

## Weekly Challenges Section

### Placement
- Can appear below Live Feed / Your Activity
- Collapsible with expand/collapse toggle

### Section Header
```
🎯 WEEKLY CHALLENGES    2/4 completed    ▼
```

### Challenge Card Layout
```
┌────────────────────────────────────────┐
│ 🐍 Draft Master                (+500 XP)│
│    Draft 3 "Risky" assets...           │
│    ████████████░░░░░░░░░░░  2/3        │
└────────────────────────────────────────┘
```

### Challenge States

#### In Progress
- Progress bar showing completion
- XP reward displayed
- Standard card background

#### Completed (Claimable)
```
┌─ GREEN HIGHLIGHT ───────────────────────┐
│ ✓ Weekly Warrior             (+1000 XP) │
│   Complete 5 battles...                 │
│   █████████████████████████  5/5       │
│                        [ CLAIM REWARD ] │
└─────────────────────────────────────────┘
```
- Green accent/highlight
- "CLAIM REWARD" button appears
- Checkmark indicates completion

#### Claimed
- Dimmed appearance
- "CLAIMED" label instead of button
- Can be hidden or shown at bottom

---

## Color Reference

### Primary Palette
| Token | Hex | Usage |
|-------|-----|-------|
| Background | #0d1117 | Main app background |
| Card Background | #161b22 | Cards, modals |
| Card Elevated | #1c2128 | Hover states |
| Border | #21262d | Default borders |
| Border Subtle | #30363d | Subtle dividers |

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Cyan | #00d9ff | PVP, primary actions, links |
| Purple | #9333ea | Training mode |
| Amber/Gold | #f59e0b | Seasonal, rewards, top stocks |
| Green | #10b981 | Winning, success, positive returns |
| Red | #ef4444 | Losing, errors, negative returns, urgency |

### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Text Primary | #ffffff | Main text |
| Text Secondary | #8b949e | Subtitles, labels, timestamps |
| Text Muted | #6e7681 | Disabled, placeholder |

### Glow Effects
```css
/* Cyan glow */
box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);

/* Purple glow */
box-shadow: 0 0 20px rgba(147, 51, 234, 0.3);

/* Green glow */
box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);

/* Red glow (urgent) */
box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);

/* Amber glow */
box-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
```

---

## Responsive Behavior

### Mobile (375px - Primary Target)
- Single column layout
- Horizontal carousels for cards
- Full-width sections
- Peek elements for feeds

### Tablet (768px+)
- Consider 2-column grid for game cards
- Wider cards with more detail
- Side-by-side Live Clashes

### Desktop (1024px+)
- Bento grid layout possible
- Live Feed could become sidebar
- Multiple Clash Cards visible without scroll

---

## Animation Specifications

### Card Hover (Desktop)
```css
transition: all 0.2s ease;
transform: translateY(-4px);
box-shadow: [elevated shadow];
```

### Urgent Timer Pulse
```css
@keyframes urgentPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
animation: urgentPulse 1s ease-in-out infinite;
```

### Card Border Glow Pulse (Most Urgent)
```css
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.6); }
}
animation: glowPulse 2s ease-in-out infinite;
```

### Carousel Transition
```css
transition: transform 0.3s ease;
```

### Tug-of-War Bar
```css
transition: width 0.5s ease-out;
```

---

## Implementation Checklist

### Phase 1: Core Structure
- [ ] Header with token balance
- [ ] Tab bar with PVP / TRAIN & EARN / RESEARCH
- [ ] Section containers with conditional rendering

### Phase 2: Clash Cards
- [ ] 1v1 Clash Card (Builder, BaggerBomb)
- [ ] 4-Player Clash Card (Snake Draft)
- [ ] Training Clash Card variant
- [ ] Timer logic with format switching
- [ ] Tug-of-war bar with dynamic ratio
- [ ] Border/glow states based on status

### Phase 3: Game Cards
- [ ] Enter the Arena cards (PVP)
- [ ] Quick Play cards (Training)
- [ ] CREATE/JOIN button logic
- [ ] Lobby count display

### Phase 4: Feeds
- [ ] Live Feed with 3 content types
- [ ] Your Activity timeline
- [ ] Color-coded left borders
- [ ] Interactive buttons (JOIN, VIEW)

### Phase 5: Seasonal & Challenges
- [ ] Seasonal banner (single item)
- [ ] Seasonal carousel (multiple items)
- [ ] Weekly Challenges list
- [ ] Claim reward flow

### Phase 6: Polish
- [ ] Animations and transitions
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling

---

## Files to Reference

- `MARKETCLASH_COMPONENTS_SKILL.md` - Existing component patterns
- `UI_PATTERNS.md` - Current styling reference
- `DESIGN_TOKENS.md` - Color and typography tokens
- `STATE_ARCHITECTURE.md` - Data flow and state management

---

*This document serves as the single source of truth for the dashboard redesign implementation.*
