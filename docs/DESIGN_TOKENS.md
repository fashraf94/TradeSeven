# FantasyTrades Design Tokens

**Last Updated:** 2025-12-12

This document contains all design tokens used in the FantasyTrades app including colors, gradients, spacing, and styling patterns.

---

## Table of Contents
- [Color System](#color-system)
- [Gradients](#gradients)
- [Spacing](#spacing)
- [Border Radius](#border-radius)
- [Shadows & Glows](#shadows--glows)
- [Copy-Paste Snippets](#copy-paste-snippets)
- [Holographic War Room Theme](#holographic-war-room-theme-snake-draft)

---

## Color System

### Primary Colors Object (Line 809-832)

```javascript
const colors = {
  background: '#0d1117',      // App background
  cardBg: '#161b22',          // Card background
  cardHover: '#1c2128',       // Card hover state
  cardElevated: '#21262d',    // Elevated card/elevated elements
  elevated: '#21262d',        // Same as cardElevated
  textPrimary: '#e6edf3',     // Primary text
  textSecondary: '#8b949e',   // Secondary/muted text
  textMuted: '#6e7681',       // Very muted text
  cyan: '#00d9ff',            // PRIMARY ACCENT - Brand cyan
  cyanDim: '#0099cc',         // Dimmed cyan
  cyanDark: '#0099cc',        // Dark cyan
  green: '#10b981',           // Success/positive - Snake Draft primary
  greenBright: '#00ff88',     // Bright green for emphasis
  greenLight: '#34d399',      // Light green
  red: '#ef4444',             // Error/negative
  redBright: '#ff4466',       // Bright red
  redLight: '#f87171',        // Light red
  blue: '#3b82f6',            // Blue accent
  purple: '#9333ea',          // Purple accent
  gold: '#ffc107',            // Gold for achievements
  border: 'rgba(0, 217, 255, 0.2)',     // Default border
  borderSubtle: 'rgba(255, 255, 255, 0.1)', // Subtle border
  borderFocus: '#00d9ff'      // Focus state border
};
```

### Challenge Colors (Line 897-905)

```javascript
const CHALLENGE_COLORS = {
  weekly: '#A855F7',     // Purple for weekly challenges
  inBattle: '#FB923C',   // Orange for in-battle challenges
  easy: '#22C55E',       // Green for easy difficulty
  medium: '#EAB308',     // Yellow/Gold for medium difficulty
  hard: '#EF4444',       // Red for hard difficulty
  completed: '#00d9ff'   // Cyan (brand color) for completed
};
```

### Background Colors

| Color | Hex | Usage |
|-------|-----|-------|
| App Background | `#0d1117` | Main app background, dark base |
| Card Background | `#161b22` | Cards, modals, containers |
| Card Hover | `#1c2128` | Hover state for cards |
| Elevated | `#21262d` | Elevated elements, input backgrounds |
| Black Overlay | `rgba(0, 0, 0, 0.8)` | Modal overlays |
| Black Heavy | `rgba(0, 0, 0, 0.95)` | Slot machine overlay |

### Border Colors

| Color | Value | Usage |
|-------|-------|-------|
| Default Border | `rgba(0, 217, 255, 0.2)` | Standard borders |
| Subtle Border | `rgba(255, 255, 255, 0.1)` | Subtle dividers |
| Card Border | `#21262d` | Card edges |
| Focus Border | `#00d9ff` | Focused inputs |
| Strong Border | `1px solid #30363d` | Emphasized borders |

### Primary Accent (Cyan)

| Variation | Hex | Usage |
|-----------|-----|-------|
| Primary | `#00d9ff` | Main brand color, CTAs, highlights |
| Dim | `#0099cc` | Secondary cyan, gradient ends |
| 20% opacity | `rgba(0, 217, 255, 0.2)` | Backgrounds, borders |
| 10% opacity | `rgba(0, 217, 255, 0.1)` | Subtle backgrounds |
| 30% opacity | `rgba(0, 217, 255, 0.3)` | Hover states |

### Snake Draft Green Theme

| Variation | Hex | Usage |
|-----------|-----|-------|
| Primary Green | `#10b981` | Main Snake Draft color |
| Bright Green | `#00ff88` | Emphasis |
| Light Green | `#34d399` | Highlights |
| Dark Green | `#059669` | Gradient ends |
| Success | `#22c55e` | Win states |
| Green 20% | `rgba(16, 185, 129, 0.2)` | Backgrounds |
| Green 10% | `rgba(16, 185, 129, 0.1)` | Subtle backgrounds |

### Training Purple Theme

| Variation | Hex | Usage |
|-----------|-----|-------|
| Primary Purple | `#8b5cf6` | Training mode accent |
| Dark Purple | `#7c3aed` | Gradient ends |
| Weekly Challenge | `#A855F7` | Weekly challenges |
| Deep Purple | `#6d28d9` | Darker purple |
| Purple 20% | `rgba(139, 92, 246, 0.2)` | Backgrounds |
| Purple 10% | `rgba(168, 85, 247, 0.1)` | Subtle backgrounds |

### Success/Error/Warning Colors

| Type | Hex | RGBA | Usage |
|------|-----|------|-------|
| Success | `#22c55e` | `rgba(34, 197, 94, 0.3)` | Win states |
| Success Light | `#4ADE80` | - | Bright success |
| Error | `#ef4444` | `rgba(239, 68, 68, 0.3)` | Loss states |
| Error Light | `#f87171` | - | Light error |
| Error Dark | `#dc2626` | - | Dark error |
| Warning | `#f59e0b` | - | Warnings, pending |
| Warning Light | `#fbbf24` | `rgba(251, 191, 36, 0.1)` | Light warning |
| Warning Dark | `#d97706` | - | Dark warning |

### Text Colors

| Color | Hex/RGBA | Usage |
|-------|----------|-------|
| Primary | `#e6edf3` or `#ffffff` | Main text |
| Secondary | `#8b949e` | Subtext, labels |
| Muted | `#6e7681` | Very low emphasis |
| Disabled | `#6b7280` | Disabled states |
| White 80% | `rgba(255,255,255,0.8)` | Semi-transparent white |
| White 60% | `rgba(255,255,255,0.6)` | Low emphasis |
| White 50% | `rgba(255,255,255,0.5)` | Very low emphasis |

---

## Gradients

### Primary Cyan Button
```javascript
background: 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)'
// Alt: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)'
```

### Snake Draft Green
```javascript
background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
// Alt: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
```

### Training Purple
```javascript
background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
// Alt: 'linear-gradient(135deg, #A855F7, #7C3AED)'
```

### Warning/Pending Orange
```javascript
background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
```

### Page Background Gradient
```javascript
background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)'
// Alt: 'linear-gradient(180deg, #1a1a2e 0%, #0d1117 100%)'
```

### Success State
```javascript
background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
// Alt: 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)'
```

### Error State
```javascript
background: 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
// Alt: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
```

### Podium Gradients (Draft Results)
```javascript
// Gold (1st)
background: 'linear-gradient(135deg, #ffd700 0%, #ffb800 100%)'
// Silver (2nd)
background: 'linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%)'
// Bronze (3rd)
background: 'linear-gradient(135deg, #cd7f32 0%, #b87333 100%)'
```

### Toast Notification
```javascript
background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(139, 69, 219, 0.95))'
```

### Research Mode Banner
```javascript
background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)'
```

### XP Progress Bar
```javascript
background: `linear-gradient(90deg, ${colors.green} 0%, ${colors.cyan} 100%)`
```

---

## Spacing

### Common Padding Values

| Size | Value | Usage |
|------|-------|-------|
| XS | `4px` | Tight spacing, badges |
| SM | `8px` | Small elements |
| MD | `12px` | Default padding |
| LG | `16px` | Card padding, sections |
| XL | `20px` | Page margins |
| XXL | `24px` | Large sections |
| XXXL | `32px` | Modal padding |

### Button Padding Patterns

```javascript
// Small button
padding: '4px 12px'

// Medium button
padding: '8px 16px'

// Large button
padding: '12px 24px'

// XL button (primary CTA)
padding: '16px 48px'

// Standard button
padding: '14px'
```

### Card Padding

```javascript
// Standard card
padding: '16px'

// Modal
padding: '32px'

// Compact card
padding: '12px'

// Badge
padding: '2px 6px'
```

---

## Border Radius

| Size | Value | Usage |
|------|-------|-------|
| None | `0` | Square edges |
| XS | `2px` | Progress bars |
| SM | `4px` | Small badges, tags |
| MD | `6px` | Filter buttons |
| Base | `8px` | Buttons, inputs |
| LG | `10px` | Cards, containers |
| XL | `12px` | Large cards, modals |
| XXL | `16px` | Feature cards |
| Round | `9999px` | Pills, circular |
| Circle | `50%` | Avatar, icons |

### Common Patterns

```javascript
// Standard button
borderRadius: '8px'

// Card
borderRadius: '16px'

// Badge/Pill
borderRadius: '9999px'

// Avatar
borderRadius: '50%'

// Input
borderRadius: '8px'

// Progress bar container
borderRadius: '4px'

// Progress bar fill
borderRadius: '2px'
```

---

## Shadows & Glows

### Box Shadows

```javascript
// Card shadow
boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'

// Modal shadow
boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'

// Button shadow
boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'

// Hover shadow
boxShadow: '0 8px 30px rgba(0, 217, 255, 0.2)'

// Small shadow
boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'

// Toast shadow
boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)'
```

### Glow Effects

```javascript
// Cyan glow
boxShadow: '0 0 20px rgba(0, 217, 255, 0.3)'

// Strong cyan glow
boxShadow: `0 0 30px ${colors.cyan}60`

// Green glow (Snake Draft)
boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'

// Purple glow
boxShadow: `0 0 6px ${colors.purple}`

// Success glow
boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)'

// Error glow
boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)'
```

---

## Copy-Paste Snippets

### Primary Button (Cyan)

```javascript
style={{
  background: 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)',
  color: '#0d1117',
  border: 'none',
  borderRadius: '8px',
  padding: '14px',
  fontSize: '16px',
  fontWeight: '700',
  cursor: 'pointer',
  width: '100%',
  transition: 'transform 0.2s, box-shadow 0.2s',
  boxShadow: '0 4px 12px rgba(0, 217, 255, 0.3)'
}}
```

### Snake Draft Button (Green)

```javascript
style={{
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
}}
```

### Training Button (Purple)

```javascript
style={{
  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  color: '#ffffff',
  border: 'none',
  borderRadius: '8px',
  padding: '12px 24px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer'
}}
```

### Standard Card

```javascript
style={{
  background: '#161b22',
  border: '1px solid #21262d',
  borderRadius: '16px',
  padding: '16px',
  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
}}
```

### Text Input

```javascript
style={{
  width: '100%',
  padding: '14px 16px',
  backgroundColor: '#0d1117',
  border: '2px solid #21262d',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  outline: 'none'
}}
// Focus state: borderColor: '#00d9ff'
```

### Badge

```javascript
style={{
  background: '#22C55E', // or appropriate color
  color: '#000',
  fontSize: '10px',
  fontWeight: '700',
  padding: '2px 6px',
  borderRadius: '4px',
  textTransform: 'uppercase'
}}
```

### Progress Bar

```javascript
// Container
style={{
  height: '8px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '4px',
  overflow: 'hidden'
}}

// Fill
style={{
  height: '100%',
  background: `linear-gradient(90deg, ${colors.green} 0%, ${colors.cyan} 100%)`,
  borderRadius: '4px',
  width: `${progressPercent}%`
}}
```

### Back Button

```javascript
style={{
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#00d9ff',
  fontWeight: '600',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px'
}}
```

### Icon Container

```javascript
style={{
  width: '44px',
  height: '44px',
  borderRadius: '12px',
  background: 'rgba(0, 217, 255, 0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}}
```

---

## Holographic War Room Theme (Snake Draft)

**CSS File:** `src/styles/holographic.css`

The holographic theme is used for the Snake Draft "War Room" interface, featuring cyberpunk aesthetics with neon glows, scanlines, and slanted UI elements.

### Holographic Color Tokens

```css
/* Neon Glows */
--neon-cyan: #00ffff;
--neon-cyan-glow: 0 0 20px rgba(0, 255, 255, 0.6), 0 0 40px rgba(0, 255, 255, 0.3);
--neon-green: #00ff88;
--neon-green-glow: 0 0 15px rgba(0, 255, 136, 0.6), 0 0 30px rgba(0, 255, 136, 0.3);
--neon-red: #ff3366;
--neon-red-glow: 0 0 15px rgba(255, 51, 102, 0.6);

/* Holographic Surfaces */
--holo-bg-dark: #0a0e14;
--holo-bg-card: rgba(10, 20, 30, 0.85);
--holo-border: rgba(0, 255, 255, 0.3);
--holo-border-bright: rgba(0, 255, 255, 0.6);

/* Scanline Overlay */
--scanline-color: rgba(0, 255, 255, 0.03);

/* Timer States */
--timer-safe: #00ffff;
--timer-warning: #ffaa00;
--timer-critical: #ff3366;
```

### Holographic Utility Classes

| Class | Description |
|-------|-------------|
| `.scanlines` | Adds CRT scanline overlay effect |
| `.clip-slant-br` | Slants bottom-right corner of element |
| `.clip-slant-btn` | Slants top-left corner for buttons |
| `.text-glow-cyan` | Cyan neon text glow |
| `.text-glow-green` | Green neon text glow |
| `.text-glow-red` | Red neon text glow |
| `.pulse-glow` | Pulsing glow animation (2s) |
| `.pulse-glow-fast` | Fast pulsing glow (1s) |
| `.pulse-critical` | Critical red pulse (0.5s) |
| `.holo-card` | Basic holographic card style |
| `.holo-card-glow` | Holographic card with glow |
| `.circuit-pattern` | Circuit board background pattern |
| `.timer-safe` | Timer in safe state (cyan) |
| `.timer-warning` | Timer in warning state (gold) |
| `.timer-critical` | Timer in critical state (red) |
| `.holo-locked` | Locked/unavailable state overlay |
| `.btn-acquire` | Acquire button style |
| `.category-tab` | Category tab base style |
| `.category-tab-active` | Active category tab |

### Usage Examples

```jsx
// Holographic card with scanlines
<div className="holo-card scanlines clip-slant-br">
  <h3 className="text-glow-cyan">AAPL</h3>
</div>

// Pulsing timer
<div className={`text-5xl ${timeLeft < 10 ? 'timer-critical' : 'timer-safe'}`}>
  {timeLeft}
</div>

// Acquire button
<button className="btn-acquire clip-slant-btn">
  ACQUIRE
</button>

// Category tabs
<div className="category-tab category-tab-active">Steady (25)</div>
```
