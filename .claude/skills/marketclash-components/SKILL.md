# FantasyTrades Components Skill

A comprehensive design system and component library for FantasyTrades - a holographic war-room themed stock trading game.

## Quick Reference

### Import Patterns
```javascript
// Colors from App.jsx (passed as prop)
const { colors } = props;

// Holographic theme constants
import { HOLO_COLORS, GLOW_EFFECTS, CATEGORY_CONFIG, RANK_CONFIG } from '../constants/holoTheme';

// Shared components
import HoloCard from '../components/shared/HoloCard';
import CategoryBadge from '../components/shared/CategoryBadge';
import GainLossBadge from '../components/shared/GainLossBadge';

// Animation
import { motion, AnimatePresence } from 'framer-motion';
```

---

## COLOR TOKENS

### Primary Colors (src/App.jsx:9819)

The `colors` object is defined in App.jsx and passed as a prop to all screens/components.

```javascript
const colors = {
  // Backgrounds
  background: '#0d1117',      // Deep dark blue-black
  cardBg: '#1a1f2e',          // Card background
  cardInner: '#161b22',       // Inner card sections
  cardHover: '#1c2128',       // Card hover state
  cardElevated: '#21262d',    // Elevated cards/modals
  elevated: '#21262d',        // Alias for cardElevated

  // Text
  textPrimary: '#e6edf3',     // Primary text (off-white)
  textSecondary: '#8b949e',   // Secondary text (gray)
  textMuted: '#6e7681',       // Muted/disabled text

  // Primary Accent - Cyan (Brand Color)
  cyan: '#00d9ff',            // Primary accent
  cyanDim: '#0099cc',         // Dimmed cyan
  cyanDark: '#0099cc',        // Dark cyan

  // Status Colors
  green: '#10b981',           // Positive/success
  greenBright: '#00ff88',     // Bright green (gains)
  greenLight: '#34d399',      // Light green
  red: '#ef4444',             // Negative/error
  redBright: '#ff4466',       // Bright red (losses)
  redLight: '#f87171',        // Light red

  // Additional Accents
  blue: '#3b82f6',            // Info/links
  purple: '#9333ea',          // Special actions
  gold: '#ffc107',            // Achievements/premium

  // Borders
  border: 'rgba(0, 217, 255, 0.2)',      // Default border (cyan tint)
  borderSubtle: 'rgba(255, 255, 255, 0.1)', // Subtle border
  borderFocus: '#00d9ff'                  // Focus state border
};
```

### Holographic Theme (src/constants/holoTheme.js)

```javascript
export const HOLO_COLORS = {
  // Backgrounds
  bgDeep: '#0a0e14',          // Deepest background
  bgCard: '#0d1117',          // Card background
  bgElevated: '#161b22',      // Elevated surfaces

  // Borders
  borderSubtle: '#21262d',
  borderGlow: 'rgba(0, 255, 255, 0.3)',
  borderBright: 'rgba(0, 255, 255, 0.5)',

  // Primary Accents
  cyan: '#00ffff',            // Primary brand
  green: '#00ff88',           // Positive
  amber: '#f59e0b',           // Warning/risky
  red: '#ff3366',             // Negative
  purple: '#8b5cf6',          // Special

  // Rank Colors (1st-4th place)
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',

  // Category Colors (S/R/D system)
  steady: '#00ffff',          // Cyan - low volatility
  risky: '#f59e0b',           // Amber - high volatility
  defensive: '#10b981',       // Green - defensive stocks

  // Sector Colors
  sectorTech: '#3b82f6',
  sectorEnergy: '#ef4444',
  sectorHealthcare: '#14b8a6',
  sectorFinancials: '#22c55e',
  sectorConsumerCyclical: '#a855f7',
  sectorConsumerDefensive: '#ec4899',
  sectorIndustrials: '#f59e0b',
  sectorMaterials: '#f97316',
  sectorRealEstate: '#6366f1',
  sectorUtilities: '#64748b',
  sectorCommunication: '#06b6d4',
  sectorCrypto: '#fbbf24',

  // Text
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
};

export const GLOW_EFFECTS = {
  cyan: '0 0 15px rgba(0, 255, 255, 0.5), 0 0 30px rgba(0, 255, 255, 0.3)',
  green: '0 0 15px rgba(0, 255, 136, 0.5), 0 0 30px rgba(0, 255, 136, 0.3)',
  amber: '0 0 15px rgba(245, 158, 11, 0.5), 0 0 30px rgba(245, 158, 11, 0.3)',
  red: '0 0 15px rgba(255, 51, 102, 0.5), 0 0 30px rgba(255, 51, 102, 0.3)',
  purple: '0 0 15px rgba(139, 92, 246, 0.5), 0 0 30px rgba(139, 92, 246, 0.3)',
  gold: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.3)',
};

export const CATEGORY_CONFIG = {
  steady: { letter: 'S', color: HOLO_COLORS.steady, label: 'Steady' },
  risky: { letter: 'R', color: HOLO_COLORS.risky, label: 'Risky' },
  defensive: { letter: 'D', color: HOLO_COLORS.defensive, label: 'Defensive' },
};

export const RANK_CONFIG = {
  1: { label: '1ST', color: HOLO_COLORS.gold, glow: GLOW_EFFECTS.gold },
  2: { label: '2ND', color: HOLO_COLORS.silver, glow: 'none' },
  3: { label: '3RD', color: HOLO_COLORS.bronze, glow: 'none' },
  4: { label: '4TH', color: HOLO_COLORS.textMuted, glow: 'none' },
};
```

---

## SHARED COMPONENTS

### HoloCard

**Location:** `src/components/shared/HoloCard.jsx`

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | string/Component | 'div' | Element type ('div', 'button', etc.) |
| `variant` | string | 'default' | 'default' \| 'elevated' \| 'highlighted' \| 'interactive' |
| `accentColor` | string | null | 'cyan' \| 'green' \| 'amber' \| 'red' \| 'purple' |
| `size` | string | 'md' | 'sm' \| 'md' \| 'lg' |
| `glow` | boolean | false | Enable glow effect (requires accentColor) |
| `selected` | boolean | false | Selected state styling |
| `disabled` | boolean | false | Disabled state |
| `onClick` | function | - | Click handler |

**Usage:**
```jsx
// Basic card
<HoloCard>Content</HoloCard>

// Interactive with glow
<HoloCard variant="interactive" accentColor="cyan" glow onClick={handleClick}>
  Clickable Card
</HoloCard>

// Selected state
<HoloCard variant="elevated" accentColor="green" selected>
  Selected Item
</HoloCard>
```

### CategoryBadge

**Location:** `src/components/shared/CategoryBadge.jsx`

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `category` | string | required | 'steady' \| 'risky' \| 'defensive' |
| `variant` | string | 'letter' | 'dot' \| 'letter' \| 'full' \| 'pill' |
| `size` | string | 'md' | 'sm' \| 'md' \| 'lg' |
| `glow` | boolean | false | Add glow to dot |

**Usage:**
```jsx
// Dot only (compact)
<CategoryBadge category="steady" variant="dot" />

// Letter with dot (default)
<CategoryBadge category="risky" />  // Shows: [amber dot] R

// Full label
<CategoryBadge category="defensive" variant="full" />  // Shows: [green dot] Defensive

// Pill badge
<CategoryBadge category="steady" variant="pill" size="lg" />
```

### GainLossBadge

**Location:** `src/components/shared/GainLossBadge.jsx`

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | number | required | Percentage value |
| `variant` | string | 'text' | 'text' \| 'pill' \| 'compact' |
| `size` | string | 'md' | 'sm' \| 'md' \| 'lg' |
| `showSign` | boolean | true | Show +/- prefix |
| `decimals` | number | 2 | Decimal places |
| `showPercent` | boolean | true | Show % suffix |

**Usage:**
```jsx
// Simple text (green for positive, red for negative)
<GainLossBadge value={5.23} />   // "+5.23%"
<GainLossBadge value={-2.5} />   // "-2.50%"

// Pill style with background
<GainLossBadge value={12.5} variant="pill" size="lg" />

// Compact monospace
<GainLossBadge value={3.14} variant="compact" decimals={1} />
```

---

## CARD PATTERNS

### Standard Card (Snake Draft Gold Standard)

```javascript
const cardStyle = {
  position: 'relative',
  background: colors.cardBg,           // '#1a1f2e'
  borderRadius: '16px',
  padding: '24px 20px',
  border: `1px solid ${colors.border}`, // 'rgba(0, 217, 255, 0.2)'
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'all 0.3s'
};
```

### Card with Accent Border

```javascript
const accentCardStyle = {
  position: 'relative',
  background: HOLO_COLORS.bgCard,
  borderRadius: '8px',
  borderLeft: `3px solid ${categoryColor}`,  // Color accent on left edge
  padding: '10px 12px',
  transition: 'all 0.2s ease',
};
```

### Card Hover Effect

```javascript
onMouseEnter={(e) => {
  e.currentTarget.style.borderColor = accentColor;
  e.currentTarget.style.boxShadow = `0 0 30px ${accentColor}30`;
  e.currentTarget.style.transform = 'translateY(-4px)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.borderColor = colors.border;
  e.currentTarget.style.boxShadow = 'none';
  e.currentTarget.style.transform = 'translateY(0)';
}}
```

### Ghost/Empty State Card

```javascript
const ghostCardStyle = {
  background: HOLO_COLORS.bgCard,
  borderRadius: '8px',
  border: `1px dashed ${HOLO_COLORS.borderSubtle}`,  // Dashed border
  minHeight: '64px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// Content
<span style={{ color: HOLO_COLORS.textMuted, fontSize: '10px' }}>-</span>
```

---

## BUTTON PATTERNS

### Primary CTA Button (Gradient)

```javascript
const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 20px',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  border: 'none',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

// Cyan variant
const cyanButtonStyle = {
  ...primaryButtonStyle,
  background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
  boxShadow: '0 4px 12px rgba(0, 217, 255, 0.3)',
};
```

### Secondary Button (Outlined)

```javascript
const secondaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 20px',
  background: 'transparent',
  border: `2px solid ${colors.cyan}`,
  borderRadius: '10px',
  color: colors.cyan,
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};
```

### Back Button (Text Style)

```javascript
const backButtonStyle = {
  color: colors.textSecondary,  // '#8b949e'
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  padding: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
};

// Usage
<button onClick={() => setScreen('dashboard')} style={backButtonStyle}>
  <ArrowLeft size={16} />
  Back
</button>
```

---

## ANIMATION PATTERNS

### Page/Screen Entrance

```jsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  {/* Screen content */}
</motion.div>
```

### Card Entrance with Spring

```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: 0.2 }}
>
  {/* Card content */}
</motion.div>
```

### Staggered List Animation

```jsx
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      duration: 0.4,
      delay: 0.1 + (index * 0.1)  // 0.1s stagger
    }}
  >
    {/* Item content */}
  </motion.div>
))}
```

### Modal/Toast with Exit Animation

```jsx
<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 15 }}
    >
      {/* Modal content */}
    </motion.div>
  )}
</AnimatePresence>
```

### Button Hover/Tap

```jsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.1 }}
>
  Click Me
</motion.button>
```

### Dramatic Card Entrance (Slot Machine Style)

```jsx
<motion.div
  initial={{ x: -300, opacity: 0, rotateY: 90 }}
  animate={{ x: 0, opacity: 1, rotateY: 0 }}
  transition={{
    delay: 0.8 + (index * 0.4),
    type: 'spring',
    stiffness: 100,
    damping: 15
  }}
>
  {/* Card content */}
</motion.div>
```

---

## LAYOUT PATTERNS

### Mobile Detection

```javascript
const [isMobile, setIsMobile] = useState(
  typeof window !== 'undefined' && window.innerWidth < 768
);

useEffect(() => {
  const handleResize = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Screen Container Pattern

```jsx
import DesktopBackground from '../components/DesktopBackground';

const MyScreen = ({ isDesktop, containerStyle, colors, ...props }) => {
  return (
    <>
      <DesktopBackground isDesktop={isDesktop} />
      <div style={containerStyle}>
        {/* Screen content */}
      </div>
    </>
  );
};
```

### Fixed Bottom HUD/Panel

```javascript
const fixedBottomStyle = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  maxHeight: isMobile ? '38vh' : '45vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(to top, rgba(0, 255, 255, 0.08) 0%, rgba(10, 14, 20, 0.98) 100%)',
  backdropFilter: 'blur(16px)',
  borderTop: `1px solid ${HOLO_COLORS.cyan}`,
  boxShadow: '0 -4px 30px rgba(0, 255, 255, 0.15)',
  zIndex: 50,
};
```

### Responsive Grid

```javascript
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
  gap: '12px',
};
```

### Flex Row with Cards

```javascript
const cardRowStyle = {
  display: 'flex',
  gap: '16px',
  padding: '0 16px',
  justifyContent: 'center',
  alignItems: 'stretch',
};
```

---

## TYPOGRAPHY SCALE

```javascript
// Screen Titles
const titleStyle = {
  fontSize: '24px',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  color: colors.textPrimary,
};

// Section Headers
const sectionHeaderStyle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#ffffff',
};

// Card Titles / Stock Symbols
const cardTitleStyle = {
  fontSize: '14px',
  fontWeight: 700,
  color: HOLO_COLORS.textPrimary,
};

// Body Text
const bodyTextStyle = {
  fontSize: '14px',
  color: colors.textSecondary,
};

// Small Labels / Captions
const captionStyle = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: HOLO_COLORS.textMuted,
};

// Monospace Values (prices, percentages)
const monoValueStyle = {
  fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
  fontSize: '12px',
  fontWeight: 600,
};

// Button Text
const buttonTextStyle = {
  fontSize: '14px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};
```

---

## BACKGROUND PATTERNS

### Holographic Scanlines

```javascript
export const HOLO_BACKGROUND = `
  repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 255, 0.03) 2px,
    rgba(0, 255, 255, 0.03) 4px
  ),
  radial-gradient(ellipse at 50% 0%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 20%, rgba(0, 255, 136, 0.05) 0%, transparent 40%),
  ${HOLO_COLORS.bgDeep}
`;
```

### Grid Pattern

```javascript
const gridBackground = {
  background: `
    linear-gradient(0deg, transparent 0%, transparent 99%, ${HOLO_COLORS.borderSubtle}33 100%),
    linear-gradient(90deg, transparent 0%, transparent 99%, ${HOLO_COLORS.borderSubtle}22 100%)
  `,
  backgroundSize: '100% 50px, 50px 100%',
  opacity: 0.5,
};
```

### Card Decorative Pattern

```javascript
const cardPatternBackground = {
  background: `
    linear-gradient(90deg, transparent 0%, ${accentColor}20 50%, transparent 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 20px,
      ${accentColor}10 20px,
      ${accentColor}10 21px
    )
  `,
  opacity: 0.08,
  pointerEvents: 'none',
};
```

---

## SCREEN TEMPLATE

```jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import DesktopBackground from '../components/DesktopBackground';
import HoloCard from '../components/shared/HoloCard';
import { HOLO_COLORS } from '../constants/holoTheme';

const MyNewScreen = ({
  // Layout props
  isDesktop,
  containerStyle,
  colors,

  // Navigation
  setScreen,

  // Data
  data,

  // Other props...
}) => {
  // Mobile detection (if needed beyond isDesktop)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <DesktopBackground isDesktop={isDesktop} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={containerStyle}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px',
          gap: '16px',
        }}>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              color: colors.textSecondary,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: colors.textPrimary,
            margin: 0,
          }}>
            Screen Title
          </h1>
        </div>

        {/* Main Content */}
        <div style={{
          padding: '0 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Card Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '16px',
          }}>
            {data?.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + (index * 0.1) }}
              >
                <HoloCard variant="interactive" accentColor="cyan">
                  {/* Card content */}
                </HoloCard>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default MyNewScreen;
```

---

## COMMON PATTERNS CHECKLIST

When creating new components, ensure:

- [ ] Use `colors` from props (not hardcoded)
- [ ] Import `HOLO_COLORS` from `../constants/holoTheme` for specialized colors
- [ ] Use `HoloCard` for card containers
- [ ] Use `CategoryBadge` for S/R/D indicators
- [ ] Use `GainLossBadge` for percentage displays
- [ ] Add Framer Motion entrance animations
- [ ] Implement hover states with glow effects
- [ ] Handle mobile/desktop layouts with `isMobile` or `isDesktop`
- [ ] Use monospace font for numerical values
- [ ] Follow the typography scale
- [ ] Use standard transition: `transition: 'all 0.2s ease'` or `0.3s`
