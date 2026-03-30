// Centralized animation parameters for the ambient animation system.
// All timing, color, and physics constants live here.

// Universal Data Strike parameters
export const DATA_STRIKE = {
  scale: [1, 1.15, 1],
  duration: 0.35,
  times: [0, 0.15, 1],
  ease: 'easeOut',
};

// Color semantics for data events
export const STRIKE_COLORS = {
  gain: '#22C55E',
  loss: '#EF4444',
  anticipationBagger: '#5eead4',
  anticipationBust: '#EF4444',
  convergence: '#F59E0B',   // amber
  neutral: '#ffffff',
};

// ChamberFuse needle spring
export const TUG_SPRING = {
  type: 'spring',
  stiffness: 170,
  damping: 20,
  mass: 1.2,
};

// Holo-foil sweep
export const HOLO_SWEEP = {
  duration: 0.6,
  ease: 'easeInOut',
  gradient: 'linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.12) 50%, transparent 80%)',
};

// Threshold heat
export const THRESHOLD_HEAT = {
  triggerProximity: 0.25,    // fire when within 25% of threshold
  breathingProximity: 0.10,  // start breathing when within 10%
  radialGradientBagger: 'radial-gradient(circle at center, #5eead4 0%, transparent 80%)',
  radialGradientBust: 'radial-gradient(circle at center, #EF4444 0%, transparent 80%)',
  radianceWidth: 24,         // px
  neutralZone: 0.15,         // no heat when multiplier is between -0.15 and 0.15
};

// Convergence (Radar Lock)
export const CONVERGENCE = {
  pointThreshold: 3,         // within 3 points triggers convergence
  amberInset: 'inset 0 0 0 2px rgba(245, 158, 11, 0.5)',
  amberInsetOff: 'inset 0 0 0 2px rgba(245, 158, 11, 0)',
  amberBorderColor: '#F59E0B',  // amber border for hex pod (clipPath clips boxShadow)
  textShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
  fadeInDuration: 0.5,
};

// % change slide
export const PCT_SLIDE = {
  exitY: -8,
  enterY: 8,
  duration: 0.15,
};
