// /src/hooks/index.js

// Existing hook
export { useBaggerBombBattle, default as useBaggerBombBattleDefault } from './useBaggerBombBattle';
export {
  SESSIONS,
  SESSION_ORDER,
  BREAKOUT_BONUSES,
  BUST_PENALTIES,
  SESSION_BONUSES,
  isCrypto,
  getCurrentSession,
  getSessionTimeRemaining,
  getConvictionMultiplier,
  calculateAssetScore,
  calculatePortfolioScore
} from './useBaggerBombBattle';

// New hooks (Phase 1)
export { useDraft } from './useDraft';
export { useResearch } from './useResearch';
export { usePortfolio } from './usePortfolio';
export { useChallenges } from './useChallenges';

// Responsive hooks
export { useIsMobile } from './useIsMobile';

// Research Intelligence
export { useResearchIntelligence } from './useResearchIntelligence';
