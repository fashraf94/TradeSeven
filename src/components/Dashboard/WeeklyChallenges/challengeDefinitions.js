// /src/components/Dashboard/WeeklyChallenges/challengeDefinitions.js
// Shared constants and helper functions for Weekly Challenges UI

export const CHALLENGE_XP = {
  easy: 100,
  medium: 250,
  hard: 500,
  weeklyBonus: 250,
};

export const CHALLENGE_COLORS = {
  weekly: '#A855F7',
  easy: '#22C55E',
  medium: '#EAB308',
  hard: '#EF4444',
  completed: '#00d9ff',
};

// Signature accent colors per challenge slot type (for tarot cards)
export const SIGNATURE_COLORS = {
  classic: '#00d9ff',   // Cyan
  snake: '#10b981',     // Emerald
  wildcard: '#8b5cf6',  // Purple
  universal: '#f59e0b', // Gold
};

// Get signature color from challenge slot
export const getSignatureColor = (challenge) => {
  return SIGNATURE_COLORS[challenge.slot] || SIGNATURE_COLORS[challenge.gameMode] || '#8b5cf6';
};

// Unique flip animation variants per slot type
export const FLIP_VARIANTS = {
  // Classic Mode: "Sword Strike Flip" - dips down like a sword swing
  classic: {
    front: { rotateY: 0, y: 0 },
    back: { rotateY: 180, y: [0, 15, 0] },
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      y: { duration: 0.4 },
    },
  },
  // Snake Draft: "Slither Flip" - serpentine wave
  snake: {
    front: { rotateY: 0, skewY: 0 },
    back: { rotateY: 180, skewY: [0, 3, -3, 0] },
    transition: {
      type: 'spring',
      stiffness: 250,
      damping: 20,
      skewY: { duration: 0.5, times: [0, 0.3, 0.6, 1] },
    },
  },
  // Wild Card: "Chaos Flip" - diagonal wobble
  wildcard: {
    front: { rotateY: 0, rotateZ: 0, scale: 1 },
    back: { rotateY: 180, rotateZ: [0, -8, 5, -3, 0], scale: [1, 1.05, 0.98, 1] },
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
      rotateZ: { duration: 0.6 },
      scale: { duration: 0.6 },
    },
  },
  // Any Mode: "Champion Spin" - full 360 + 180 so back face is visible at end
  universal: {
    front: { rotateY: 0, scale: 1 },
    back: { rotateY: 540, scale: [1, 1.1, 1] },
    transition: {
      duration: 0.8,
      ease: [0.4, 0, 0.2, 1],
      scale: { duration: 0.8, times: [0, 0.5, 1] },
    },
  },
};

// Get flip variants for a challenge based on its slot
export const getFlipVariants = (challenge) => {
  return FLIP_VARIANTS[challenge.slot] || FLIP_VARIANTS[challenge.gameMode] || FLIP_VARIANTS.classic;
};

export const getDifficultyColor = (difficulty) => {
  return CHALLENGE_COLORS[difficulty] || '#ffffff';
};

export const getGameModeColor = (gameMode) => {
  switch (gameMode) {
    case 'classic': return '#00d9ff';
    case 'snake': return '#A855F7';
    case 'universal': return '#22C55E';
    default: return '#FB923C';
  }
};

export const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const canAcceptChallengeToday = (activeDailyChallenge) => {
  if (!activeDailyChallenge) return true;
  return activeDailyChallenge.acceptedDate !== getTodayDateString();
};

export const isChallengeCompleted = (challengeId, completedChallenges) => {
  return completedChallenges.some(c => c.id === challengeId);
};

// Time until midnight local time (daily reset)
export const getTimeUntilMidnight = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

// Time until weekly reset (next Monday)
export const getTimeUntilReset = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  const diff = nextMonday - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { days, hours, total: diff };
};

// Determine the visual state of a challenge card
export const getCardState = (challenge, activeDailyChallenge, completedWeeklyChallenges) => {
  if (isChallengeCompleted(challenge.id, completedWeeklyChallenges)) return 'completed';
  if (activeDailyChallenge?.id === challenge.id) return 'active';
  if (!canAcceptChallengeToday(activeDailyChallenge)) return 'locked';
  return 'available';
};
