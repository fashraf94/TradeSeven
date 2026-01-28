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
