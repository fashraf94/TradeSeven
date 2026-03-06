# FantasyTrades UI Patterns

**Last Updated:** 2025-12-12

This document contains actual code snippets from App.jsx for common UI patterns used throughout the FantasyTrades app.

---

## Table of Contents
- [Buttons](#buttons)
- [Cards](#cards)
- [Inputs](#inputs)
- [Badges](#badges)
- [Stats Displays](#stats-displays)
- [Layout Patterns](#layout-patterns)
- [Animations](#animations)

---

## Buttons

### Primary Button (Cyan)
From Login Screen (~Line 3310):

```javascript
<button
  onClick={() => handleLogin()}
  disabled={!username.trim()}
  style={{
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderRadius: '8px',
    cursor: username.trim() ? 'pointer' : 'not-allowed',
    color: username.trim() ? '#0d1117' : '#6e7681',
    background: username.trim()
      ? 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)'
      : '#21262d',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: username.trim() ? '0 4px 12px rgba(0, 217, 255, 0.3)' : 'none',
  }}
>
  Enter Arena
</button>
```

### Snake Draft Button (Green)
From Dashboard (~Line 5019):

```javascript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  onClick={() => setScreen('draftSetup')}
  style={{
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: gameMode === 'draft'
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : 'transparent',
    color: gameMode === 'draft' ? '#ffffff' : '#8b949e',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: gameMode === 'draft' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
  }}
>
  Create Draft
</motion.button>
```

### Training Button (Purple)
From Dashboard (~Line 8855):

```javascript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  onClick={() => setScreen('draftTraining')}
  style={{
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer'
  }}
>
  Start Training Draft
</motion.button>
```

### Secondary/Outline Button
From Profile Screen (~Line 13356):

```javascript
<button
  onClick={() => setScreen('dashboard')}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: colors.cyan,
    fontWeight: '600',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px'
  }}
>
  <ChevronLeft size={20} />
  Back
</button>
```

### Back Button
From Research Mode (~Line 3447):

```javascript
<button
  onClick={() => {
    setShowResearchMode(false);
    setResearchExpandedAsset(null);
    setResearchCompareAssets([]);
    setResearchSearchTerm('');
  }}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: colors.cyan,
    fontWeight: '600',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px'
  }}
>
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
  Back
</button>
```

### Challenge Accept Button (Purple)
From Weekly Challenges (~Line 5577):

```javascript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  onClick={(e) => {
    e.stopPropagation();
    acceptChallenge(challenge);
  }}
  style={{
    background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  }}
>
  ACCEPT
</motion.button>
```

### Disabled Button
```javascript
style={{
  width: '100%',
  padding: '14px',
  borderRadius: '8px',
  border: 'none',
  background: '#21262d',
  color: '#6e7681',
  fontWeight: '600',
  fontSize: '14px',
  cursor: 'not-allowed'
}}
```

---

## Cards

### Standard Card
From Dashboard (~Line 4124):

```javascript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4 }}
  style={{
    backgroundColor: colors.cardBg,
    borderRadius: '20px',
    padding: '32px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%'
  }}
>
  {/* Card content */}
</motion.div>
```

### Highlighted Card (Active Battle)
From Dashboard Active Battle (~Line 4722):

```javascript
<motion.div
  whileHover={{ scale: 1.01 }}
  onClick={() => viewActiveBattle(activeBattles[0])}
  style={{
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
    borderRadius: '16px',
    padding: '20px',
    cursor: 'pointer',
    border: `1px solid ${colors.green}40`
  }}
>
  {/* Battle preview content */}
</motion.div>
```

### Asset Card (Portfolio Builder)
From Builder (~Line 6336):

```javascript
<motion.div
  key={asset.symbol}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  style={{
    background: inPortfolio ? `${colors.cyan}15` : 'rgba(0, 217, 255, 0.05)',
    borderRadius: '12px',
    padding: '14px',
    border: `1px solid ${inPortfolio ? colors.cyan : colors.borderSubtle}`,
    cursor: 'pointer'
  }}
  onClick={() => toggleAsset(asset)}
>
  {/* Asset info */}
</motion.div>
```

### Research Mode Asset Card
From Research Mode (~Line 3587):

```javascript
<motion.div
  key={asset.symbol}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.02 }}
  style={{
    background: '#161b22',
    border: isExpanded ? `2px solid ${colors.cyan}` : '1px solid #21262d',
    borderRadius: '16px',
    overflow: 'hidden'
  }}
>
  {/* Collapsed header, expandable content */}
</motion.div>
```

### Challenge Card
From Weekly Challenges (~Line 5383):

```javascript
<motion.div
  key={challenge.id}
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.1 }}
  style={{
    background: isCompleted
      ? 'rgba(0, 217, 255, 0.1)'
      : isActive
        ? 'rgba(168, 85, 247, 0.15)'
        : 'rgba(255, 255, 255, 0.03)',
    border: `1px solid ${
      isCompleted
        ? '#00d9ff'
        : isActive
          ? '#A855F7'
          : colors.borderSubtle
    }`,
    borderRadius: '12px',
    marginBottom: '10px',
    overflow: 'hidden'
  }}
>
  {/* Challenge content */}
</motion.div>
```

### Player Card (Draft)
From Draft Room (~Line 9635):

```javascript
<div
  key={player.odUserId}
  style={{
    background: isCurrentPicker ? 'rgba(0, 217, 255, 0.1)' : colors.cardBg,
    borderRadius: '10px',
    padding: '12px',
    border: `2px solid ${isCurrentPicker ? colors.cyan : colors.border}`,
    boxShadow: isCurrentPicker ? '0 0 12px rgba(0, 217, 255, 0.3)' : 'none'
  }}
>
  {/* Player info and picks */}
</div>
```

---

## Inputs

### Text Input
From Login (~Line 3285):

```javascript
<input
  type="text"
  value={username}
  onChange={(e) => setUsername(e.target.value.slice(0, 15))}
  placeholder="Enter a cool username..."
  style={{
    width: '100%',
    padding: '14px 16px',
    backgroundColor: '#0d1117',
    border: `2px solid ${username ? '#00d9ff' : '#21262d'}`,
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s'
  }}
  maxLength={15}
/>
```

### Search Input
From Research Mode (~Line 3510):

```javascript
<div style={{ position: 'relative', marginBottom: '12px' }}>
  <input
    type="text"
    placeholder="Search by symbol or name..."
    value={researchSearchTerm}
    onChange={(e) => setResearchSearchTerm(e.target.value)}
    style={{
      width: '100%',
      padding: '12px 16px 12px 44px',
      background: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: '10px',
      color: '#ffffff',
      fontSize: '14px',
      outline: 'none'
    }}
  />
  <svg
    style={{
      position: 'absolute',
      left: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6e7681'
    }}
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
</div>
```

### Challenge Code Input
From Join Screen (~Line 7105):

```javascript
<input
  type="text"
  placeholder="Enter 6-digit code"
  value={joinCode}
  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
  maxLength={6}
  style={{
    width: '100%',
    padding: '16px 20px',
    fontSize: '24px',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: '8px',
    background: 'rgba(0, 0, 0, 0.2)',
    border: `2px solid ${joinCode.length === 6 ? colors.cyan : colors.border}`,
    borderRadius: '12px',
    color: '#ffffff',
    outline: 'none',
    textTransform: 'uppercase'
  }}
/>
```

---

## Badges

### Difficulty Badge
From Weekly Challenges (~Line 5564):

```javascript
<span style={{
  background: getDifficultyColor(challenge.difficulty),
  color: '#000',
  fontSize: '11px',
  fontWeight: '700',
  padding: '4px 10px',
  borderRadius: '6px',
  textTransform: 'uppercase'
}}>
  {challenge.difficulty} • {challenge.xp} XP
</span>
```

### Game Mode Badge
From Challenge Cards (~Line 5448):

```javascript
<span style={{
  background: getGameModeColor(challenge.gameMode),
  color: '#000',
  fontSize: '9px',
  fontWeight: '700',
  padding: '2px 5px',
  borderRadius: '4px'
}}>
  {challenge.slotLabel}
</span>
```

### Volatility Badge
From Research Mode (~Line 3705):

```javascript
<span style={{
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: '500',
  background: asset.volatility === 'high'
    ? 'rgba(239, 68, 68, 0.1)'
    : asset.volatility === 'low'
      ? 'rgba(16, 185, 129, 0.1)'
      : '#21262d',
  color: asset.volatility === 'high'
    ? '#ef4444'
    : asset.volatility === 'low'
      ? '#10b981'
      : '#8b949e'
}}>
  {asset.volatility || 'med'}
</span>
```

### Rank Badge
From Research Mode (~Line 3608):

```javascript
<div style={{
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: asset.categoryRank7d <= 3 ? 'rgba(16, 185, 129, 0.2)' : '#21262d',
  border: asset.categoryRank7d <= 3 ? '1px solid #10b981' : '1px solid #30363d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: asset.categoryRank7d <= 3 ? '#10b981' : '#8b949e',
  fontSize: '12px',
  fontWeight: 'bold'
}}>
  #{asset.categoryRank7d || '-'}
</div>
```

### Win/Loss Badge
From Battle History (~Line 12164):

```javascript
// Win badge
style={{
  background: '#22c55e',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: '700',
  boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)'
}}

// Loss badge
style={{
  background: '#ef4444',
  color: '#ffffff',
  padding: '4px 12px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: '700',
  boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)'
}}
```

### Performance Badge (7D/30D)
From Research Mode (~Line 3667):

```javascript
<span style={{
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: '500',
  background: (asset.priceChange7d || 0) >= 0
    ? 'rgba(16, 185, 129, 0.1)'
    : 'rgba(239, 68, 68, 0.1)',
  color: (asset.priceChange7d || 0) >= 0 ? '#10b981' : '#ef4444'
}}>
  7D: {(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(1)}%
</span>
```

---

## Stats Displays

### XP Progress Bar
From Dashboard (~Line 4212):

```javascript
<div style={{
  height: '10px',
  background: 'rgba(0, 217, 255, 0.1)',
  borderRadius: '9999px',
  overflow: 'hidden'
}}>
  <motion.div
    initial={{ width: 0 }}
    animate={{ width: `${xpProgress}%` }}
    transition={{ duration: 1, ease: 'easeOut' }}
    style={{
      height: '100%',
      background: `linear-gradient(90deg, ${colors.green} 0%, ${colors.cyan} 100%)`,
      borderRadius: '9999px',
      boxShadow: `0 0 10px ${colors.cyan}60`
    }}
  />
</div>
```

### Challenge Progress Bar
From Weekly Challenges (~Line 5538):

```javascript
<div style={{
  height: '8px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '4px',
  overflow: 'hidden'
}}>
  <motion.div
    initial={{ width: 0 }}
    animate={{ width: `${progressPercent}%` }}
    transition={{ duration: 0.5 }}
    style={{
      height: '100%',
      background: `linear-gradient(90deg, ${getDifficultyColor(challenge.difficulty)}, ${getDifficultyColor(challenge.difficulty)}aa)`,
      borderRadius: '4px'
    }}
  />
</div>
```

### Gain/Loss Display
From Battle View (~Line 12427):

```javascript
<div style={{
  fontSize: '28px',
  fontWeight: '800',
  background: myGainPercent >= 0
    ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
    : 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text'
}}>
  {myGainPercent >= 0 ? '+' : ''}{myGainPercent.toFixed(2)}%
</div>
```

### Stats Grid
From Profile (~Line 13699):

```javascript
<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '12px'
}}>
  <div style={{
    background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center'
  }}>
    <div style={{
      fontSize: '24px',
      fontWeight: '700',
      color: colors.cyan
    }}>
      {totalBattles}
    </div>
    <div style={{
      fontSize: '12px',
      color: colors.textSecondary
    }}>
      Battles
    </div>
  </div>
  {/* More stat cards */}
</div>
```

### Weekly Bonus Progress
From Weekly Challenges (~Line 5634):

```javascript
<div style={{ display: 'flex', gap: '6px' }}>
  {[0, 1, 2, 3].map(i => (
    <div
      key={i}
      style={{
        flex: 1,
        height: '6px',
        borderRadius: '3px',
        background: completedWeeklyChallenges.length > i
          ? '#A855F7'
          : 'rgba(255,255,255,0.1)'
      }}
    />
  ))}
</div>
```

---

## Layout Patterns

### Page Container
```javascript
<div style={{
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: colors.background
}}>
  {/* Page content */}
</div>
```

### Section Header
From Dashboard (~Line 5301):

```javascript
<h3 style={{
  fontSize: '14px',
  fontWeight: '600',
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '12px'
}}>
  Recent Battles
</h3>
```

### Sticky Header
From Research Mode (~Line 3426):

```javascript
<div style={{
  background: '#161b22',
  borderBottom: '1px solid #21262d',
  padding: '16px',
  position: 'sticky',
  top: 0,
  zIndex: 20
}}>
  {/* Header content */}
</div>
```

### Tab Toggle
From Research Mode (~Line 3471):

```javascript
<div style={{
  display: 'flex',
  gap: '8px',
  marginBottom: '12px',
  padding: '4px',
  background: '#0d1117',
  borderRadius: '10px'
}}>
  <button
    onClick={() => setResearchAssetType('stocks')}
    style={{
      flex: 1,
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      background: researchAssetType === 'stocks' ? colors.cyan : 'transparent',
      color: researchAssetType === 'stocks' ? '#000' : '#8b949e',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer'
    }}
  >
    Stocks ({stocksData.length})
  </button>
  <button
    onClick={() => setResearchAssetType('crypto')}
    style={{
      flex: 1,
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      background: researchAssetType === 'crypto' ? colors.cyan : 'transparent',
      color: researchAssetType === 'crypto' ? '#000' : '#8b949e',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer'
    }}
  >
    Crypto ({cryptoData.length})
  </button>
</div>
```

### Collapsible Section
From Weekly Challenges (~Line 5307):

```javascript
<div
  onClick={() => setShowWeeklyChallenges(!showWeeklyChallenges)}
  style={{
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), transparent)'
  }}
>
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <span style={{ fontSize: '24px' }}>🎯</span>
    <div>
      <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '700', margin: 0 }}>
        Weekly Challenges
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>
        {completedWeeklyChallenges.length}/4 completed
      </p>
    </div>
  </div>
  <motion.div
    animate={{ rotate: showWeeklyChallenges ? 180 : 0 }}
    style={{ color: '#A855F7' }}
  >
    <ChevronDown size={20} />
  </motion.div>
</div>
```

### Bottom Navigation
From Dashboard (~Line 5990):

```javascript
<div style={{
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
  borderTop: `1px solid ${colors.border}`,
  padding: '12px 0',
  zIndex: 50
}}>
  <div style={{
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: '400px',
    margin: '0 auto'
  }}>
    {/* Nav buttons */}
  </div>
</div>
```

---

## Animations

### Framer Motion Entry Animation
```javascript
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: 0.2 }}
>
  {/* Content */}
</motion.div>
```

### Button Hover/Tap Effects
```javascript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
  Button Text
</motion.button>
```

### Slot Machine Reveal (Challenges)
From SlotMachineOverlay (~Line 3137):

```javascript
<motion.div
  key={challenge.id}
  initial={{ x: -300, opacity: 0, rotateY: 90 }}
  animate={{ x: 0, opacity: 1, rotateY: 0 }}
  transition={{
    delay: 0.8 + (index * 0.4),
    type: 'spring',
    stiffness: 100,
    damping: 15
  }}
>
  {/* Challenge card */}
</motion.div>
```

### Progress Bar Animation
```javascript
<motion.div
  initial={{ width: 0 }}
  animate={{ width: `${progressPercent}%` }}
  transition={{ duration: 0.5 }}
/>
```

### Rotate Animation (Expand Icon)
```javascript
<motion.div
  animate={{ rotate: isExpanded ? 180 : 0 }}
>
  <ChevronDown size={20} />
</motion.div>
```

### Toast Notification
From ChallengeToast (~Line 3048):

```javascript
<motion.div
  initial={{ y: -100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: -100, opacity: 0 }}
  style={{
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999
  }}
>
  {/* Toast content */}
</motion.div>
```

### Staggered List Animation
```javascript
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  >
    {/* Item content */}
  </motion.div>
))}
```

### CSS Hover Effects (Non-Framer)
```javascript
style={{
  transition: 'transform 0.2s, box-shadow 0.2s',
}}
onMouseEnter={(e) => {
  e.currentTarget.style.transform = 'translateY(-2px)';
  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 217, 255, 0.2)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.transform = 'translateY(0)';
  e.currentTarget.style.boxShadow = 'none';
}}
```

### Loading Spinner
```javascript
<Loader2
  style={{
    animation: 'spin 1s linear infinite',
    color: colors.cyan
  }}
/>

// Or manual implementation:
<div style={{
  width: '24px',
  height: '24px',
  border: `3px solid ${colors.borderSubtle}`,
  borderTopColor: colors.cyan,
  borderRadius: '50%',
  animation: 'spin 1s linear infinite'
}} />
```
