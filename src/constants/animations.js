/**
 * Centralized Animation Keyframes
 *
 * This module consolidates all CSS keyframe animations used throughout the app.
 * Import KEYFRAMES for individual animations or ALL_KEYFRAMES for bulk injection.
 *
 * Usage:
 * - Static animations: Add to index.css
 * - Dynamic animations (color-based): Use CSS variables like --glow-color
 * - Component-specific: Import and inject via <style> tag
 */

// =============================================================================
// CORE TRANSFORMS
// =============================================================================

export const KEYFRAMES = {
  // Basic rotation
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,

  rotateArc: `
    @keyframes rotate-arc {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,

  // =============================================================================
  // PULSE & GLOW ANIMATIONS
  // =============================================================================

  // Generic pulse (opacity)
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,

  // Badge pulse (softer)
  pulseBadge: `
    @keyframes pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `,

  // Blink effect
  blink: `
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `,

  // Glow pulse with CSS variable for color
  pulseGlow: `
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px var(--glow-color, rgba(0, 217, 255, 0.3)); }
      50% { box-shadow: 0 0 30px var(--glow-color, rgba(0, 217, 255, 0.5)); }
    }
  `,

  // Faster glow pulse for urgency
  pulseGlowFast: `
    @keyframes pulse-glow-fast {
      0%, 100% { opacity: 1; filter: brightness(1); }
      50% { opacity: 0.7; filter: brightness(1.3); }
    }
  `,

  // Critical pulse (red warning)
  pulseCritical: `
    @keyframes pulse-critical {
      0%, 100% { opacity: 1; box-shadow: 0 0 15px rgba(255, 51, 102, 0.6); }
      50% { opacity: 0.8; box-shadow: 0 0 30px rgba(255, 51, 102, 0.9); }
    }
  `,

  // Holographic glow
  holoGlow: `
    @keyframes holo-glow {
      0%, 100% { box-shadow: 0 0 15px rgba(0, 255, 255, 0.5); }
      50% { box-shadow: 0 0 25px rgba(0, 255, 255, 0.8); }
    }
  `,

  // Holographic pulse (opacity)
  holoPulse: `
    @keyframes holo-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `,

  // Generic glow pulse with CSS variable
  glowPulse: `
    @keyframes glow-pulse {
      0%, 100% { box-shadow: 0 0 20px var(--glow-color-20, rgba(0,255,255,0.2)); }
      50% { box-shadow: 0 0 35px var(--glow-color-35, rgba(0,255,255,0.35)); }
    }
  `,

  // =============================================================================
  // ENTRANCE & EXIT ANIMATIONS
  // =============================================================================

  // Simple fade in
  fadeIn: `
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,

  // Fade in with upward slide
  fadeInUp: `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,

  // Slide in from left
  slideIn: `
    @keyframes slide-in {
      from { transform: translateX(-100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `,

  // Slide up
  slideUp: `
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,

  // Pop in with scale
  popIn: `
    @keyframes pop-in {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
  `,

  // Bounce animation
  bounce: `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
  `,

  // Bounce arrow (horizontal)
  bounceArrow: `
    @keyframes bounce-arrow {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(6px); }
    }
  `,

  // Float effect
  holoFloat: `
    @keyframes holo-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
  `,

  // =============================================================================
  // PROGRESS & LOADING ANIMATIONS
  // =============================================================================

  // Shimmer sweep (horizontal)
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,

  // Shimmer effect (left to right sweep)
  shimmerEffect: `
    @keyframes shimmer-effect {
      0% { left: -100%; }
      100% { left: 100%; }
    }
  `,

  // Scan line down
  scanDown: `
    @keyframes scan-down {
      0% { top: 0; opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }
  `,

  // Scan line (horizontal)
  scanLine: `
    @keyframes scan-line {
      0% { left: -100%; }
      50% { left: 100%; }
      100% { left: 100%; }
    }
  `,

  // Gradient shift
  gradientShift: `
    @keyframes gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `,

  // =============================================================================
  // DASHBOARD CARD PATTERN ANIMATIONS
  // =============================================================================

  // Snake slither effect
  snakeSlither: `
    @keyframes snake-slither {
      0%, 100% { transform: translateX(0) scaleX(1); }
      25% { transform: translateX(3px) scaleX(1.02); }
      75% { transform: translateX(-3px) scaleX(0.98); }
    }
  `,

  // Crane swing
  craneSwing: `
    @keyframes crane-swing {
      0%, 100% { transform: rotate(-8deg); }
      50% { transform: rotate(8deg); }
    }
  `,

  // Explosion pulse (bagger bomb)
  explosionPulse: `
    @keyframes explosion-pulse {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.1); opacity: 1; }
    }
  `,

  // Target pulse (options arena)
  targetPulse: `
    @keyframes target-pulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.05); opacity: 1; }
    }
  `,

  // Fuse spark effect
  fuseSpark: `
    @keyframes fuse-spark {
      0%, 100% { opacity: 1; filter: brightness(1); }
      50% { opacity: 0.7; filter: brightness(1.4); }
    }
  `,

  // Floating particle
  floatParticle: `
    @keyframes float-particle {
      0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
      50% { transform: translateY(-12px) scale(1.2); opacity: 0.6; }
    }
  `,

  // Icon pulse
  pulseIcon: `
    @keyframes pulse-icon {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  `,

  // ChamberFuse shimmer sweep for lit segments
  chamberShimmer: `
    @keyframes chamberShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
  `,

  // ChamberFuse red pulse for negative threshold segments
  chamberPulseRed: `
    @keyframes chamberPulseRed {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
  `,

  // ChamberFuse ignite brightness flash on threshold crossing
  chamberIgnite: `
    @keyframes chamberIgnite {
      0% { filter: brightness(1.4); }
      100% { filter: brightness(1); }
    }
  `,

  // Training button glow
  pulseGlowTraining: `
    @keyframes pulse-glow-training {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.08); }
    }
  `,

  // Training button ring
  pulseRing: `
    @keyframes pulse-ring {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.12); opacity: 0.2; }
    }
  `,

  // Research button pulse
  researchPulse: `
    @keyframes research-pulse {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.2); }
    }
  `,

  // =============================================================================
  // TIMER ANIMATIONS
  // =============================================================================

  // Timer pulse (safe state)
  timerPulse: `
    @keyframes timer-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.02); opacity: 0.85; }
    }
  `,

  // Timer pulse fast (warning state)
  timerPulseFast: `
    @keyframes timer-pulse-fast {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.8; }
    }
  `,

  // Timer shake (urgent state)
  timerShake: `
    @keyframes timer-shake {
      0%, 100% { transform: translateX(0) scale(1); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-2px) scale(1.02); }
      20%, 40%, 60%, 80% { transform: translateX(2px) scale(1.02); }
    }
  `,

  // =============================================================================
  // DRAFT ROOM ANIMATIONS
  // =============================================================================

  // Autopick warning pulse
  pulseWarning: `
    @keyframes pulse-warning {
      0%, 100% { opacity: 1; transform: translateX(-50%) scale(1); }
      50% { opacity: 0.85; transform: translateX(-50%) scale(1.02); }
    }
  `,

  // Screen edge pulse
  screenEdgePulse: `
    @keyframes screen-edge-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `,

  // Your turn flash
  yourTurnFlash: `
    @keyframes your-turn-flash {
      0% { opacity: 0; background: rgba(0, 255, 255, 0.3); }
      15% { opacity: 1; background: rgba(0, 255, 255, 0.25); }
      85% { opacity: 1; background: rgba(0, 255, 255, 0.1); }
      100% { opacity: 0; background: transparent; }
    }
  `,

  // Your turn text animation
  yourTurnText: `
    @keyframes your-turn-text {
      0% { opacity: 0; transform: scale(0.8); }
      20% { opacity: 1; transform: scale(1.1); }
      40% { transform: scale(1); }
      80% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(0.9); }
    }
  `,

  // Last pick slide in
  lastPickSlideIn: `
    @keyframes last-pick-slide-in {
      0% { opacity: 0; transform: translateY(-20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `,

  // Category fade transition
  categoryFade: `
    @keyframes category-fade {
      0% { opacity: 0.3; transform: translateY(15px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `,

  // =============================================================================
  // PLAYER PANEL ANIMATIONS
  // =============================================================================

  // Green pulse for current picker
  pickerPulseGreen: `
    @keyframes picker-pulse-green {
      0%, 100% {
        box-shadow: 0 0 15px rgba(0, 255, 136, 0.6), 0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 15px rgba(0, 255, 136, 0.1);
      }
      50% {
        box-shadow: 0 0 25px rgba(0, 255, 136, 0.8), 0 0 45px rgba(0, 255, 136, 0.4), inset 0 0 20px rgba(0, 255, 136, 0.15);
      }
    }
  `,

  // Orange pulse for next picker
  nextPulseOrange: `
    @keyframes next-pulse-orange {
      0%, 100% { box-shadow: 0 0 12px rgba(255, 149, 0, 0.5), 0 0 25px rgba(255, 149, 0, 0.25); }
      50% { box-shadow: 0 0 20px rgba(255, 149, 0, 0.7), 0 0 40px rgba(255, 149, 0, 0.35), inset 0 0 10px rgba(255, 149, 0, 0.1); }
    }
  `,

  // Check mark pop
  pickCheckPop: `
    @keyframes pick-check-pop {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
  `,

  // =============================================================================
  // CARD SELECTION ANIMATIONS
  // =============================================================================

  // Card selection confirm
  pickConfirm: `
    @keyframes pick-confirm {
      0% { transform: scale(1); filter: brightness(1); }
      30% { transform: scale(1.08); filter: brightness(1.5); }
      60% { transform: scale(1.03); filter: brightness(1.2); }
      100% { transform: scale(1.05); filter: brightness(1.3); }
    }
  `,

  // Card select pulse (uses CSS variable)
  cardSelectPulse: `
    @keyframes card-select-pulse {
      0%, 100% { box-shadow: 0 0 20px var(--accent-glow), 0 0 40px var(--accent-glow); }
      50% { box-shadow: 0 0 25px var(--accent-glow), 0 0 50px var(--accent-glow); }
    }
  `,

  // Particle burst animations (4 directions)
  particleBurst0: `
    @keyframes particle-burst-0 {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(calc(-50% + 40px), calc(-50% - 30px)) scale(0.5); }
    }
  `,
  particleBurst1: `
    @keyframes particle-burst-1 {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(calc(-50% - 35px), calc(-50% - 25px)) scale(0.5); }
    }
  `,
  particleBurst2: `
    @keyframes particle-burst-2 {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(calc(-50% + 45px), calc(-50% + 20px)) scale(0.5); }
    }
  `,
  particleBurst3: `
    @keyframes particle-burst-3 {
      0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(calc(-50% - 40px), calc(-50% + 25px)) scale(0.5); }
    }
  `,

  // =============================================================================
  // GAUGE ANIMATIONS
  // =============================================================================

  // Gauge flash
  gaugeFlash: `
    @keyframes gauge-flash {
      0% { filter: brightness(1); }
      30% { filter: brightness(1.5) drop-shadow(0 0 10px currentColor); }
      100% { filter: brightness(1); }
    }
  `,

  // Gauge celebrate
  gaugeCelebrate: `
    @keyframes gauge-celebrate {
      0% { transform: scale(1); }
      15% { transform: scale(1.2); }
      30% { transform: scale(1.1); }
      45% { transform: scale(1.15); }
      60% { transform: scale(1.08); }
      75% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  `,

  // =============================================================================
  // CONFIRM BUTTON ANIMATIONS
  // =============================================================================

  // Confirm button pulse (green)
  confirmPulse: `
    @keyframes confirm-pulse {
      0%, 100% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.5), 0 0 60px rgba(0, 255, 136, 0.25), inset 0 0 20px rgba(0, 255, 136, 0.1); }
      50% { box-shadow: 0 0 40px rgba(0, 255, 136, 0.6), 0 0 80px rgba(0, 255, 136, 0.35), inset 0 0 25px rgba(0, 255, 136, 0.15); }
    }
  `,

  // =============================================================================
  // TRANSITION OVERLAY ANIMATIONS
  // =============================================================================

  // Flash fade
  flashFade: `
    @keyframes flash-fade {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
  `,

  // Glitch flicker
  glitchFlicker: `
    @keyframes glitch-flicker {
      0% { opacity: 0.8; transform: translateX(0); }
      20% { opacity: 0.6; transform: translateX(-3px); }
      40% { opacity: 0.9; transform: translateX(3px); }
      60% { opacity: 0.5; transform: translateX(-2px); }
      80% { opacity: 0.8; transform: translateX(1px); }
      100% { opacity: 0; transform: translateX(0); }
    }
  `,

  // Text flash
  textFlash: `
    @keyframes text-flash {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      30% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
      60% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
    }
  `,

  // =============================================================================
  // SNAKE CONDUIT ANIMATIONS (SVG Path)
  // =============================================================================

  // Slither dash
  slitherDash: `
    @keyframes slither-dash {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: -130; }
    }
  `,

  // Snake wave (SVG path morphing)
  snakeWave: `
    @keyframes snake-wave {
      0%, 100% {
        d: path('M -50,120 Q 75,180 150,120 Q 225,60 300,120 Q 375,180 450,120 Q 525,60 600,120 Q 675,180 750,120 Q 825,60 950,120');
      }
      50% {
        d: path('M -50,120 Q 75,160 150,120 Q 225,80 300,120 Q 375,160 450,120 Q 525,80 600,120 Q 675,160 750,120 Q 825,80 950,120');
      }
    }
  `,

  // Body pulse for snake glow
  bodyPulse: `
    @keyframes body-pulse {
      0%, 100% { opacity: 0.25; stroke-width: 16px; }
      50% { opacity: 0.4; stroke-width: 20px; }
    }
  `,

  // Scale shimmer
  scaleShimmer: `
    @keyframes scale-shimmer {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    }
  `,

  // Head bob
  headBob: `
    @keyframes head-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
  `,

  // Tongue flick
  tongueFlick: `
    @keyframes tongue-flick {
      0%, 80%, 100% { opacity: 0; transform: scaleX(0); }
      85%, 95% { opacity: 1; transform: scaleX(1); }
    }
  `,

  // Eye glow
  eyeGlow: `
    @keyframes eye-glow {
      0%, 100% { filter: drop-shadow(0 0 2px #ffcc00); }
      50% { filter: drop-shadow(0 0 6px #ffcc00); }
    }
  `,

  // =============================================================================
  // CELEBRATION ANIMATIONS
  // =============================================================================

  // Confetti fall
  confettiFall: `
    @keyframes confetti-fall {
      0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(250px) rotate(360deg); opacity: 0; }
    }
  `,

  // Sparkle
  sparkle: `
    @keyframes sparkle {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }
  `,

  // Success toast entrance
  successToastIn: `
    @keyframes success-toast-in {
      0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
      100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    }
  `,

  // Success check pop
  successCheckPop: `
    @keyframes success-check-pop {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
  `,

  // BaggerBomb card glow pulse (uses CSS variables for color)
  baggerGlowPulse: `
    @keyframes bagger-glow-pulse {
      0%, 100% { box-shadow: var(--bagger-glow-base); }
      50% { box-shadow: var(--bagger-glow-peak); }
    }
  `,
};

// =============================================================================
// ANIMATION PRESETS (shorthand for common animations)
// =============================================================================

export const ANIMATION_PRESETS = {
  // Spins
  spin: 'spin 1s linear infinite',
  spinSlow: 'spin 2s linear infinite',
  spinFast: 'spin 0.5s linear infinite',
  rotateArc: 'rotate-arc 4s linear infinite',

  // Pulses
  pulse: 'pulse 2s ease-in-out infinite',
  pulseFast: 'pulse 1s ease-in-out infinite',
  pulseBadge: 'pulse-badge 2s ease-in-out infinite',
  pulseGlow: 'pulse-glow 2s ease-in-out infinite',
  pulseGlowFast: 'pulse-glow-fast 1s ease-in-out infinite',
  pulseCritical: 'pulse-critical 0.5s ease-in-out infinite',
  holoGlow: 'holo-glow 2s ease-in-out infinite',
  holoPulse: 'holo-pulse 2s ease-in-out infinite',
  glowPulse: 'glow-pulse 2s ease-in-out infinite',
  blink: 'blink 1s ease-in-out infinite',

  // Entrances
  fadeIn: 'fade-in 0.3s ease-out',
  fadeInUp: 'fade-in-up 0.4s ease-out',
  slideIn: 'slide-in 0.3s ease-out',
  slideUp: 'slide-up 0.4s ease-out',
  popIn: 'pop-in 0.4s ease-out forwards',
  bounce: 'bounce 2s ease-in-out infinite',
  bounceArrow: 'bounce-arrow 1s ease-in-out infinite',
  holoFloat: 'holo-float 3s ease-in-out infinite',

  // Progress
  shimmer: 'shimmer 2s linear infinite',
  shimmerEffect: 'shimmer-effect 3s ease-in-out infinite',
  scanDown: 'scan-down 2s linear',
  scanLine: 'scan-line 3s ease-in-out infinite',
  gradientShift: 'gradient-shift 4s ease infinite',

  // Dashboard cards
  snakeSlither: 'snake-slither 3s ease-in-out infinite',
  craneSwing: 'crane-swing 4s ease-in-out infinite',
  explosionPulse: 'explosion-pulse 2s ease-in-out infinite',
  targetPulse: 'target-pulse 2s ease-in-out infinite',
  fuseSpark: 'fuse-spark 1.5s ease-in-out infinite',
  floatParticle: 'float-particle 3s ease-in-out infinite',
  pulseIcon: 'pulse-icon 2s ease-in-out infinite',
  pulseGlowTraining: 'pulse-glow-training 2s ease-in-out infinite',
  pulseRing: 'pulse-ring 2s ease-in-out infinite',
  researchPulse: 'research-pulse 2s ease-in-out infinite',

  // Timer states
  timerPulse: 'timer-pulse 1s ease-in-out infinite',
  timerPulseFast: 'timer-pulse-fast 0.6s ease-in-out infinite',
  timerShake: 'timer-shake 0.3s ease-in-out infinite',

  // Draft room
  pulseWarning: 'pulse-warning 1.5s ease-in-out infinite',
  screenEdgePulse: 'screen-edge-pulse 1s ease-in-out infinite',
  yourTurnFlash: 'your-turn-flash 2s ease-out forwards',
  yourTurnText: 'your-turn-text 2s ease-out forwards',
  lastPickSlideIn: 'last-pick-slide-in 0.4s ease-out',
  categoryFade: 'category-fade 0.3s ease-out',

  // Player panel
  pickerPulseGreen: 'picker-pulse-green 2s ease-in-out infinite',
  nextPulseOrange: 'next-pulse-orange 2.5s ease-in-out infinite',
  pickCheckPop: 'pick-check-pop 0.4s ease-out forwards',

  // Card selection
  pickConfirm: 'pick-confirm 0.5s ease-out forwards',
  cardSelectPulse: 'card-select-pulse 2s ease-in-out infinite',

  // Gauges
  gaugeFlash: 'gauge-flash 0.6s ease-out',
  gaugeCelebrate: 'gauge-celebrate 1s ease-out',

  // ChamberFuse
  chamberShimmer: 'chamberShimmer 3s linear infinite',
  chamberPulseRed: 'chamberPulseRed 3s ease-in-out infinite',
  chamberIgnite: 'chamberIgnite 0.4s ease-out forwards',

  // Confirm button
  confirmPulse: 'confirm-pulse 2s ease-in-out infinite',

  // Transitions
  flashFade: 'flash-fade 0.5s ease-out forwards',
  glitchFlicker: 'glitch-flicker 1s ease-out forwards',
  textFlash: 'text-flash 1.5s ease-out forwards',

  // Snake conduit
  slitherDash: 'slither-dash 2s linear infinite',
  snakeWave: 'snake-wave 4s ease-in-out infinite',
  bodyPulse: 'body-pulse 3s ease-in-out infinite',
  scaleShimmer: 'scale-shimmer 3s ease-in-out infinite',
  headBob: 'head-bob 2s ease-in-out infinite',
  tongueFlick: 'tongue-flick 3s ease-in-out infinite',
  eyeGlow: 'eye-glow 2s ease-in-out infinite',

  // Celebration
  confettiFall: 'confetti-fall 3s ease-out forwards',
  sparkle: 'sparkle 1.5s ease-in-out infinite',
  successToastIn: 'success-toast-in 0.4s ease-out forwards',
  successCheckPop: 'success-check-pop 0.5s ease-out forwards',

  // BaggerBomb glow
  baggerGlowPulse: 'bagger-glow-pulse 2.5s ease-in-out infinite',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all keyframes as a single string for injection
 */
export const getAllKeyframes = () => Object.values(KEYFRAMES).join('\n');

/**
 * Get specific keyframes by name
 * @param {string[]} names - Array of keyframe names
 * @returns {string} Combined keyframes string
 */
export const getKeyframes = (...names) =>
  names.map(name => KEYFRAMES[name] || '').join('\n');

/**
 * Create a dynamic glow animation with custom color
 * @param {string} color - CSS color value
 * @param {string} name - Unique animation name
 * @returns {string} Keyframe definition
 */
export const createGlowKeyframes = (color, name) => `
  @keyframes ${name} {
    0%, 100% { box-shadow: 0 0 15px ${color}80, 0 0 30px ${color}40; }
    50% { box-shadow: 0 0 20px ${color}A0, 0 0 40px ${color}60; }
  }
`;

/**
 * CSS classes for common animations (for use in className)
 */
export const ANIMATION_CLASSES = {
  spin: 'animate-spin',
  pulse: 'animate-pulse',
  pulseGlow: 'pulse-glow',
  pulseGlowFast: 'pulse-glow-fast',
  pulseCritical: 'pulse-critical',
  slideIn: 'animate-slide-in',
};

// =============================================================================
// LEGACY COMPATIBILITY
// Re-exports for backwards compatibility with holoTheme.js
// =============================================================================

export const HOLO_ANIMATIONS = `
  ${KEYFRAMES.spin}
  ${KEYFRAMES.holoPulse}
  ${KEYFRAMES.holoGlow}
  ${KEYFRAMES.holoFloat}
  ${KEYFRAMES.scanDown}
  ${KEYFRAMES.chamberShimmer}
  ${KEYFRAMES.chamberPulseRed}
  ${KEYFRAMES.chamberIgnite}
`;
