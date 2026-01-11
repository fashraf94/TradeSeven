// EarningsGame Animation Presets - Framer Motion

// ============================================
// PAGE TRANSITIONS
// ============================================

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// ============================================
// MODAL TRANSITIONS
// ============================================

export const slideUp = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
};

export const slideInRight = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

// ============================================
// LIST ANIMATIONS
// ============================================

export const staggerChild = (index, delay = 0.05) => ({
  initial: { opacity: 0, y: 15 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { delay: index * delay }
  },
});

// ============================================
// INTERACTIVE
// ============================================

export const buttonTap = { scale: 0.97 };

export const cardTap = { scale: 0.98 };

// ============================================
// SPRING CONFIGS
// ============================================

export const springSmooth = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

export const springBouncy = {
  type: 'spring',
  stiffness: 300,
  damping: 20,
};
