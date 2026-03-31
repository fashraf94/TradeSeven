import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { fetchWithAuth } from './utils/fetchWithAuth';
import ClashBotWidget from './components/ClashBot/ClashBotWidget';
import BugReportAdmin from './components/ClashBot/BugReportAdmin';
import { loadBattlesSafe, saveBattlesSafe, isSameBattles } from './services/LocalStorage';
import { useUser } from './contexts/UserContext';
import { usePageVisibility } from './hooks/usePageVisibility';
import * as battleTimer from './services/battleTimer';
import * as challengeService from './services/challengeService';
import { calculateV4FinalScores } from './services/dailyScoringV4Service';
// Firebase battle service for PvP battles
import { createBattle as createFirestoreBattle, joinBattle as joinFirestoreBattle, subscribeToBattles, createBaggerBombBattle, createBaggerBombBattleV3, createBaggerBombBattleV4, joinBaggerBombBattle, joinBaggerBombBattleV3, joinBaggerBombBattleV4, subscribeToLobby, subscribeToAllLobbies, getOpenBaggerBombBattles, completeBattle } from './firebase/firebaseService';
// EODHD API - All-in-one provider for stocks and crypto (replaces Finnhub + CoinGecko)
import { stockAPI, POPULAR_CRYPTO, FALLBACK_CRYPTO_PRICES, getMarketNews, getTopMoversWithNews, getMultipleStockNews, getStockNews, fetchLatestEarnings, fetchHistoricalOHLCV } from './services/eodhdAPI';
import { captureBattlePrices } from './utils/priceCapture';
// WebSocket → Cache bridge (flushes WS prices to cacheService so REST calls are skipped)
import { startWsCacheBridge } from './services/wsCacheBridge';
import './firebase/config';
import { trackRead } from './utils/firestoreReadCounter';
import { motion } from 'framer-motion';
// Event watchlist configuration for Week Ahead calendar
import { EVENT_TYPE_CONFIG } from './data/eventWatchlist';
// Static week ahead events (manual data)
import { getWeekAheadEvents } from './data/weekAheadEvents';
// AI Advisors
import ResearchAdvisor from './components/ResearchAdvisor';
import DraftAdvisor from './components/DraftAdvisor';
// BaggerBomb Scoring Components
import {
  SessionScoreCard,
  BreakoutFeed,
  BaggerBombScoreboard,
  AssetPerformanceRow,
  SubstitutionPanel,
  ThresholdPreview,
  BenchSelector,
  BaggerBombBattleView,
  SlotBasedBuilder,
} from './components/BaggerBomb';

// Lazy-loaded heavy components (make API calls on mount)
const PortfolioBuilderBaggerBomb = lazy(() => import('./components/BaggerBomb/PortfolioBuilderBaggerBomb'));
const BaggerBombBattleViewRedesign = lazy(() => import('./components/BaggerBomb/BaggerBombBattleViewRedesign'));
const BaggerBombBattleViewConnected = lazy(() => import('./screens/BaggerBombBattleViewConnected'));
const BaggerBombTrainingBattleViewV3 = lazy(() => import('./screens/BaggerBombTrainingBattleViewV3'));
const BaggerBombBattleViewConnectedV4 = lazy(() => import('./screens/BaggerBombBattleViewConnectedV4'));
const BaggerBombTrainingBattleViewV4 = lazy(() => import('./screens/BaggerBombTrainingBattleViewV4'));
const AgentBattleScreen = lazy(() => import('./screens/AgentBattleScreen'));
const BaggerBombLobby = lazy(() => import('./screens/BaggerBombLobby'));
const BaggerBombSetupScreen = lazy(() => import('./screens/BaggerBombSetupScreen'));
const StonkOptionsArenaV2 = lazy(() => import('./components/optionsArena/StonkOptionsArenaV2'));
const FantasyTimesFeed = lazy(() => import('./components/FantasyTimes/FantasyTimesFeed'));
const StoryDetail = lazy(() => import('./components/FantasyTimes/StoryDetail'));
const SearchDiscover = lazy(() => import('./components/Search/SearchDiscover'));

// Legacy aliases for backwards compatibility
const TDBattleScoreboard = BaggerBombScoreboard;
const PortfolioBuilderTD = PortfolioBuilderBaggerBomb;
const TDBattleView = BaggerBombBattleView;
// Battle helper utilities for V1/V2 format handling
import {
  getUsername as getPlayerUsername,
  getUserId,
  isCreator as isPlayerCreator,
  isOpponent as isPlayerOpponent,
  isParticipant,
  getOpponentUsername,
  getUserPortfolio,
  getOpponentPortfolio,
  isBaggerBombBattle,
  isTrainingBattle as isBattleTraining,
  getBattleStatus,
  didUserWin,
  getUserScore,
  getOpponentScore
} from './utils/battleHelpers';
// V3-safe portfolio helpers (handles tiered objects and flat arrays)
import { safePortfolioArray, getUserPortfolioFlat, getOpponentPortfolioFlat, getBothPortfoliosFlat, getAllBattleSymbols } from './utils/portfolioHelpers';
// BaggerBomb V3 portfolio utilities
import { flattenPortfolio, flattenBench, calculateAssetScoreV3 } from './utils/baggerBombUtils';
import { createInitialFreeAgents } from './services/freeAgentRotationService';
// Extracted Screens - Batch 1
import { ProfileScreen, WinsScreen, LossesScreen, DraftHistoryScreen, JoinScreen, DraftSetupScreen, DraftJoinScreen, DraftTrainingScreen, DraftLobbyScreen, PreviousBattlesScreen, BattleHistoryScreen, FreeAgencyScreen, FreeAgencyScreenV2, DraftResultsScreen, BattleViewScreen, DraftBattleScreen, DraftBattleScreenV2, DraftRoomScreen, HomeScreen, EarningsGameScreen, BuilderScreen } from './screens';
// Snake Draft Components
import DraftCompleteScreen from './screens/SnakeDraft/DraftCompleteScreen';
// Claim-based Free Agency
import ClaimsFreeAgencyScreen from './components/claims/ClaimsFreeAgencyScreen';
// Shared Components
import DesktopBackground from './components/DesktopBackground';
import { ConfirmationPopup } from './components/shared';
import ErrorBoundary from './components/ErrorBoundary';
import MarketClashRulesModal from './components/Rules/MarketClashRulesModal';
// Dashboard Components
import { GameModeToggle, WeeklyChallengesPanel, PendingLobbiesSection } from './components/Dashboard';
import { useIsMobile } from './hooks/useIsMobile';
import { isMarketOpen } from './utils/marketSchedule';
import BottomNav from './components/Navigation/BottomNav';
import DashboardLoop from './components/Dashboard/DashboardLoop';
import DashboardDesktop from './components/Dashboard/DashboardDesktop';
import DesktopSidebar from './components/Navigation/DesktopSidebar';
import { AgentDashboard } from './components/Agent';
import { ForgeScreen } from './components/Forge';

// ============================================
// LAZY LOADING FALLBACK
// ============================================
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
    color: '#888'
  }}>
    Loading...
  </div>
);

// ============================================
// ENVIRONMENT-AWARE LOGGING UTILITY
// ============================================
const logger = {
  log: (...args) => {
    if (import.meta.env.DEV) console.log(...args);
  },
  warn: (...args) => {
    if (import.meta.env.DEV) console.warn(...args);
  },
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  }
};

// ============================================
// BATTLE DEBUG HELPER
// ============================================
const debugBattles = (label, battles, extra = {}) => {
  if (!import.meta.env.DEV) return;

  console.group(`🔍 [BATTLES] ${label}`);
  console.log('Count:', battles.length);
  console.log('IDs:', battles.map(b => b.id));
  console.log('Statuses:', battles.map(b => `${b.id?.slice(-4)}: ${b.status}`));
  console.log('Creators:', battles.map(b => `${b.id?.slice(-4)}: ${b.creator}`));
  if (Object.keys(extra).length > 0) {
    console.log('Extra:', extra);
  }
  console.groupEnd();
};

// ============================================
// BATTLE LIMITS
// ============================================
const MAX_PVP_BATTLES = 3;
const MAX_TRAINING_BATTLES = 2;

// ============================================
// INPUT SANITIZATION UTILITIES
// ============================================
const sanitizePortfolioName = (name) => {
  if (!name) return '';
  return name
    .trim()
    .slice(0, 50) // Max 50 characters
    .replace(/[<>'"&]/g, ''); // Remove potentially dangerous characters
};

// ============================================
// LOCALSTORAGE WITH EXPIRY UTILITY
// ============================================
const storageWithExpiry = {
  set: (key, value, ttlHours = 24 * 30) => { // Default 30 days
    const item = {
      value: value,
      expiry: Date.now() + (ttlHours * 60 * 60 * 1000)
    };
    localStorage.setItem(key, JSON.stringify(item));
  },

  get: (key) => {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);
      // Check if it has expiry format
      if (item.expiry && item.value !== undefined) {
        if (Date.now() > item.expiry) {
          localStorage.removeItem(key);
          return null;
        }
        return item.value;
      }
      // Fallback: return raw value for old format data
      return item;
    } catch {
      return localStorage.getItem(key); // Fallback for non-JSON data
    }
  }
};

// ============================================
// GLOBAL FILTER ERROR INTERCEPTOR
// ============================================
// Monkey-patch Array.prototype.filter to catch the crash with context
const originalFilter = Array.prototype.filter;
Array.prototype.filter = function(...args) {
  return originalFilter.apply(this, args);
};

// Add global error handler for uncaught errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message?.includes('filter is not a function')) {
      console.error('🔴 FILTER CRASH DETECTED:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
      console.trace('Stack trace at filter crash');
    }
  });
}

// ============================================
// SECTOR COLOR DEFINITIONS
// ============================================
const SECTOR_COLORS = {
  // Technology - Blue
  'Technology': { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  'Information Technology': { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  // Energy - Red/Orange
  'Energy': { primary: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' },
  // Healthcare - Teal
  'Healthcare': { primary: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' },
  'Health Care': { primary: '#14b8a6', glow: 'rgba(20, 184, 166, 0.4)', gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' },
  // Financials - Green
  'Financials': { primary: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
  'Financial Services': { primary: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)', gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' },
  // Consumer Discretionary - Purple
  'Consumer Cyclical': { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', gradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' },
  'Consumer Discretionary': { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', gradient: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' },
  // Consumer Staples - Pink
  'Consumer Defensive': { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
  'Consumer Staples': { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
  // Industrials - Amber
  'Industrials': { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  // Materials - Orange
  'Basic Materials': { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  'Materials': { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.4)', gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  // Real Estate - Indigo
  'Real Estate': { primary: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
  // Utilities - Slate
  'Utilities': { primary: '#64748b', glow: 'rgba(100, 116, 139, 0.4)', gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' },
  // Communication - Cyan
  'Communication Services': { primary: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' },
  // Cryptocurrency - Gold
  'Cryptocurrency': { primary: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)', gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' },
  // Default - Cyan (brand color)
  'default': { primary: '#00d9ff', glow: 'rgba(0, 217, 255, 0.4)', gradient: 'linear-gradient(135deg, #00d9ff 0%, #0ea5e9 100%)' }
};

// Comprehensive stock sector database for proper sector identification
const STOCK_SECTORS = {
  // Technology
  'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'GOOG': 'Technology',
  'META': 'Technology', 'NVDA': 'Technology', 'AMD': 'Technology', 'INTC': 'Technology',
  'CRM': 'Technology', 'ADBE': 'Technology', 'NOW': 'Technology', 'SHOP': 'Technology',
  'UBER': 'Technology', 'AVGO': 'Technology', 'ORCL': 'Technology',
  'CSCO': 'Technology', 'IBM': 'Technology', 'QCOM': 'Technology', 'TXN': 'Technology',
  'MU': 'Technology', 'AMAT': 'Technology', 'LRCX': 'Technology', 'KLAC': 'Technology',
  'SNPS': 'Technology', 'CDNS': 'Technology', 'PANW': 'Technology', 'CRWD': 'Technology',
  'ZS': 'Technology', 'NET': 'Technology', 'DDOG': 'Technology', 'SNOW': 'Technology',
  'PLTR': 'Technology', 'U': 'Technology', 'RBLX': 'Technology',
  'MSTR': 'Technology', 'DELL': 'Technology', 'HPE': 'Technology', 'HPQ': 'Technology',
  // Financials
  'JPM': 'Financials', 'BAC': 'Financials', 'GS': 'Financials', 'MS': 'Financials',
  'V': 'Financials', 'MA': 'Financials', 'AXP': 'Financials', 'WFC': 'Financials',
  'C': 'Financials', 'SCHW': 'Financials', 'BLK': 'Financials', 'SPGI': 'Financials',
  'XYZ': 'Financials', 'PYPL': 'Financials', 'COF': 'Financials', 'USB': 'Financials',
  'PNC': 'Financials', 'TFC': 'Financials', 'BK': 'Financials', 'STT': 'Financials',
  'COIN': 'Financials', 'HOOD': 'Financials', 'SOFI': 'Financials',
  // Healthcare
  'JNJ': 'Healthcare', 'UNH': 'Healthcare', 'PFE': 'Healthcare', 'ABBV': 'Healthcare',
  'MRK': 'Healthcare', 'LLY': 'Healthcare', 'TMO': 'Healthcare', 'ABT': 'Healthcare',
  'DHR': 'Healthcare', 'BMY': 'Healthcare', 'AMGN': 'Healthcare', 'GILD': 'Healthcare',
  'CVS': 'Healthcare', 'MDT': 'Healthcare', 'ISRG': 'Healthcare', 'VRTX': 'Healthcare',
  'REGN': 'Healthcare', 'ZTS': 'Healthcare', 'BIIB': 'Healthcare', 'MRNA': 'Healthcare',
  // Consumer Discretionary
  'TSLA': 'Consumer Discretionary', 'AMZN': 'Consumer Discretionary', 'HD': 'Consumer Discretionary', 'MCD': 'Consumer Discretionary',
  'NKE': 'Consumer Discretionary', 'SBUX': 'Consumer Discretionary', 'LOW': 'Consumer Discretionary',
  'TGT': 'Consumer Discretionary', 'TJX': 'Consumer Discretionary', 'BKNG': 'Consumer Discretionary',
  'MAR': 'Consumer Discretionary', 'CMG': 'Consumer Discretionary', 'ABNB': 'Consumer Discretionary',
  'GM': 'Consumer Discretionary', 'F': 'Consumer Discretionary', 'LULU': 'Consumer Discretionary',
  'ROST': 'Consumer Discretionary', 'DHI': 'Consumer Discretionary', 'LEN': 'Consumer Discretionary',
  // Consumer Staples
  'PG': 'Consumer Staples', 'KO': 'Consumer Staples', 'PEP': 'Consumer Staples',
  'WMT': 'Consumer Staples', 'COST': 'Consumer Staples', 'MDLZ': 'Consumer Staples',
  'PM': 'Consumer Staples', 'MO': 'Consumer Staples', 'CL': 'Consumer Staples',
  'GIS': 'Consumer Staples', 'K': 'Consumer Staples', 'KMB': 'Consumer Staples',
  'STZ': 'Consumer Staples', 'KHC': 'Consumer Staples', 'SYY': 'Consumer Staples',
  // Energy
  'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy', 'SLB': 'Energy',
  'EOG': 'Energy', 'OXY': 'Energy', 'MPC': 'Energy', 'PSX': 'Energy',
  'VLO': 'Energy', 'PXD': 'Energy', 'DVN': 'Energy', 'HAL': 'Energy',
  'BKR': 'Energy', 'FANG': 'Energy', 'HES': 'Energy', 'KMI': 'Energy',
  // Communication Services
  'VZ': 'Communication Services', 'T': 'Communication Services', 'CMCSA': 'Communication Services',
  'DIS': 'Communication Services', 'NFLX': 'Communication Services', 'TMUS': 'Communication Services',
  'CHTR': 'Communication Services', 'WBD': 'Communication Services', 'EA': 'Communication Services',
  'TTWO': 'Communication Services', 'MTCH': 'Communication Services', 'PARA': 'Communication Services',
  // Industrials
  'CAT': 'Industrials', 'DE': 'Industrials', 'BA': 'Industrials', 'HON': 'Industrials',
  'UNP': 'Industrials', 'UPS': 'Industrials', 'RTX': 'Industrials', 'LMT': 'Industrials',
  'GE': 'Industrials', 'MMM': 'Industrials', 'FDX': 'Industrials', 'WM': 'Industrials',
  'CSX': 'Industrials', 'NSC': 'Industrials', 'EMR': 'Industrials', 'ITW': 'Industrials',
  // Materials
  'LIN': 'Materials', 'APD': 'Materials', 'SHW': 'Materials', 'ECL': 'Materials',
  'NEM': 'Materials', 'FCX': 'Materials', 'NUE': 'Materials', 'DOW': 'Materials',
  // Real Estate
  'AMT': 'Real Estate', 'PLD': 'Real Estate', 'CCI': 'Real Estate', 'EQIX': 'Real Estate',
  'SPG': 'Real Estate', 'PSA': 'Real Estate', 'O': 'Real Estate', 'DLR': 'Real Estate',
  // Utilities
  'NEE': 'Utilities', 'DUK': 'Utilities', 'SO': 'Utilities', 'D': 'Utilities',
  'AEP': 'Utilities', 'EXC': 'Utilities', 'SRE': 'Utilities', 'XEL': 'Utilities',
};

// Helper to get sector colors (returns full color object)
const getSectorColors = (sector, isCrypto = false) => {
  if (isCrypto) return SECTOR_COLORS['Cryptocurrency'];
  return SECTOR_COLORS[sector] || SECTOR_COLORS['default'];
};

// Helper to get sector color (returns just primary color string)
const getSectorColor = (sector) => {
  const colorObj = SECTOR_COLORS[sector] || SECTOR_COLORS['default'];
  return colorObj.primary;
};

// Helper to get stock sector from database
const getStockSector = (symbol) => {
  if (!symbol) return null;
  const upperSymbol = symbol.toUpperCase();
  return STOCK_SECTORS[upperSymbol] || null;
};

// ============================================
// SPOTLIGHT TOUR CONFIGURATION - v10
// ============================================
const TOUR_STEPS = [
  // Step 0: Welcome
  {
    id: 'welcome',
    target: null,
    title: "Welcome to FantasyTrades! 🎯",
    description: "Let's take a quick tour of your battle station. You'll be ready to compete in under a minute!",
    position: 'center'
  },

  // Step 1: Dashboard - SPOTLIGHT (not centered modal)
  {
    id: 'dashboard-intro',
    target: 'tour-dashboard-content',
    title: "This is Your Dashboard 🏠",
    description: "Your home base for everything. Track stats, start battles, research assets, and take on challenges!",
    position: 'spotlight-below'
  },

  // Step 2: Snake Draft - SPOTLIGHT on button
  {
    id: 'snake-draft',
    target: 'tour-snake-draft-btn',
    title: "🐍 Snake Draft 4P",
    description: "Four players take turns drafting assets. Build your dream team, compete for a full week. Top 2 finishers win!",
    position: 'spotlight-below'
  },

  // Step 3: Builder 1v1 - SPOTLIGHT on button
  {
    id: 'builder-1v1',
    target: 'tour-builder-btn',
    title: "⚔️ Builder 1v1",
    description: "Pick your stocks or crypto, challenge a friend, and see who gets the best returns in 24 hours!",
    position: 'spotlight-below'
  },

  // Step 4: Create & Join
  {
    id: 'create-join',
    target: 'tour-battle-cards',
    title: "Start a Battle",
    description: "Create your own game and share the code, or join a friend's battle with their code!",
    position: 'spotlight-below'
  },

  // Step 5: Research Mode
  {
    id: 'research-mode',
    target: 'tour-research-mode',
    title: "🔬 Research Mode",
    description: "Dive deep into stocks and crypto. Save notes, track trends, and get AI-powered insights!",
    position: 'spotlight-below'
  },

  // Step 6: Training Mode
  {
    id: 'training',
    target: 'tour-training-mode',
    title: "🎓 Practice First!",
    description: "Battle against AI portfolios with zero pressure. Test strategies before going live!",
    position: 'spotlight-below'
  },

  // Step 7: Weekly Challenges - tooltip ABOVE
  {
    id: 'weekly-challenges',
    target: 'tour-weekly-challenges',
    title: "🏆 Weekly Challenges",
    description: "Earn bonus XP! One active per day, resets weekly. Training battles don't count!",
    position: 'spotlight-above'
  },

  // Step 8: Hamburger Menu
  {
    id: 'menu',
    target: 'tour-hamburger-menu',
    title: "📱 Everything Else",
    description: "Profile, battle history, stats, and settings are all here!",
    position: 'spotlight-below'
  },

  // Step 9: Ready!
  {
    id: 'ready',
    target: null,
    title: "You're Ready to Battle! 🚀",
    description: "Jump into training to practice, or dive straight into the action!",
    position: 'center',
    showActions: true
  }
];

// Tour progress dots component - extracted for performance (no re-creation on render)
const TourProgressDots = ({ currentStep, totalSteps }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '20px'
  }}>
    {Array.from({ length: totalSteps }).map((_, index) => (
      <div
        key={index}
        style={{
          width: index === currentStep ? '20px' : '6px',
          height: '6px',
          borderRadius: '3px',
          background: index <= currentStep ? '#10b981' : '#21262d'
        }}
      />
    ))}
  </div>
);

// ============================================
// TRAINING BATTLE HELPERS - 100% Client-Side
// ============================================

// AI Opponent Stock Pool for Training Battles
const AI_STOCK_POOL = {
  tech: [
    { symbol: 'AAPL', name: 'Apple', type: 'stock' },
    { symbol: 'MSFT', name: 'Microsoft', type: 'stock' },
    { symbol: 'GOOGL', name: 'Alphabet', type: 'stock' },
    { symbol: 'AMZN', name: 'Amazon', type: 'stock' },
    { symbol: 'NVDA', name: 'NVIDIA', type: 'stock' },
    { symbol: 'META', name: 'Meta', type: 'stock' },
    { symbol: 'TSLA', name: 'Tesla', type: 'stock' },
    { symbol: 'AMD', name: 'AMD', type: 'stock' },
    { symbol: 'NFLX', name: 'Netflix', type: 'stock' },
    { symbol: 'CRM', name: 'Salesforce', type: 'stock' }
  ],
  value: [
    { symbol: 'JPM', name: 'JPMorgan', type: 'stock' },
    { symbol: 'V', name: 'Visa', type: 'stock' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', type: 'stock' },
    { symbol: 'PG', name: 'Procter & Gamble', type: 'stock' },
    { symbol: 'HD', name: 'Home Depot', type: 'stock' },
    { symbol: 'UNH', name: 'UnitedHealth', type: 'stock' },
    { symbol: 'BAC', name: 'Bank of America', type: 'stock' },
    { symbol: 'XOM', name: 'Exxon Mobil', type: 'stock' },
    { symbol: 'KO', name: 'Coca-Cola', type: 'stock' },
    { symbol: 'DIS', name: 'Disney', type: 'stock' }
  ],
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
    { symbol: 'SOL', name: 'Solana', type: 'crypto' }
  ]
};

// Generate AI Opponent Portfolio for Training
const generateAIOpponentPortfolio = (userPortfolio) => {
  const userSymbols = new Set(userPortfolio.map(a => a.symbol));
  const allStocks = [...AI_STOCK_POOL.tech, ...AI_STOCK_POOL.value];

  // Filter and shuffle stocks
  const availableStocks = allStocks.filter(s => !userSymbols.has(s.symbol));
  const partialOverlap = allStocks.filter(s => userSymbols.has(s.symbol)).slice(0, 2);
  const shuffled = [...availableStocks].sort(() => Math.random() - 0.5);

  // Match user's portfolio structure
  const userStockCount = userPortfolio.filter(a => a.type !== 'crypto').length;
  const userCryptoCount = userPortfolio.filter(a => a.type === 'crypto').length;
  const aiStockCount = Math.max(6, Math.min(12, userStockCount + Math.floor(Math.random() * 3) - 1));

  // Build AI portfolio
  const aiPortfolio = [];
  const stocksToAdd = [...partialOverlap, ...shuffled.slice(0, aiStockCount - partialOverlap.length)];
  stocksToAdd.forEach(stock => aiPortfolio.push({ ...stock }));

  // Add crypto if user has crypto
  if (userCryptoCount > 0) {
    const userCrypto = userPortfolio.find(a => a.type === 'crypto')?.symbol;
    const aiCrypto = AI_STOCK_POOL.crypto.find(c => c.symbol !== userCrypto) || AI_STOCK_POOL.crypto[0];
    aiPortfolio.push({ ...aiCrypto });
  }

  // Calculate allocations
  const totalAssets = aiPortfolio.length;
  const baseAllocation = 100 / totalAssets;
  let remaining = 100;

  aiPortfolio.forEach((asset, index) => {
    if (index === aiPortfolio.length - 1) {
      asset.allocation = parseFloat(remaining.toFixed(1));
    } else {
      const variance = (Math.random() - 0.5) * 4;
      let allocation = Math.max(7.5, Math.min(20, baseAllocation + variance));
      allocation = parseFloat(allocation.toFixed(1));
      asset.allocation = allocation;
      remaining -= allocation;
    }
  });

  // Normalize to exactly 100%
  const total = aiPortfolio.reduce((sum, a) => sum + a.allocation, 0);
  if (Math.abs(total - 100) > 0.1) {
    aiPortfolio[0].allocation += parseFloat((100 - total).toFixed(1));
  }

  console.log('[Training] AI Portfolio generated:', aiPortfolio.length, 'assets');
  return aiPortfolio;
};

// ============================================
// HELPER: Normalize username extraction for V1/V2 battle format
// V1 battles: creator/opponent are strings
// V2 battles: creator/opponent are objects with username property
// Now uses enhanced getUsername from battleHelpers.js that handles both
// V1 (string) and V2 (object with odUsername/username) formats
// ============================================
const getUsername = getPlayerUsername;

/**
 * Capture real-time prices for battle activation.
 * Phase 1: WebSocket (real-time, 5s timeout)
 * Phase 2: REST fallback for any symbols WebSocket missed
 */
async function fetchBattlePrices(symbols) {
  console.log(`[Price Capture] Fetching prices for ${symbols.length} symbols...`);
  const startTime = Date.now();

  const startingPrices = await captureBattlePrices(symbols);

  const elapsed = Date.now() - startTime;
  console.log(`[Price Capture] Total: ${elapsed}ms, got ${Object.keys(startingPrices).length}/${symbols.length}`);

  return { startingPrices, priceSource: 'WS+REST' };
}

// Create Training Battle - 100% Client-Side (No API)
const createTrainingBattle = (userPortfolio, battleType = 'head-to-head') => {
  const battleId = `training_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date();
  const BATTLE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Generate AI opponent portfolio
  const aiPortfolio = generateAIOpponentPortfolio(userPortfolio);

  // Create battle object matching existing battle structure
  const battle = {
    id: battleId,
    challengeCode: `TRAIN-${battleId.slice(-6).toUpperCase()}`,
    creator: 'training_user',
    opponent: 'MarketBot',
    creatorPortfolio: userPortfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name || COMPANY_NAMES[asset.symbol] || asset.symbol,
      type: asset.type || 'stock',
      allocation: asset.allocation,
      price: 0, // Will be filled with live prices
      amount: (asset.allocation / 100) * 1000000,
      position: 'long'
    })),
    opponentPortfolio: aiPortfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name || COMPANY_NAMES[asset.symbol] || asset.symbol,
      type: asset.type || 'stock',
      allocation: asset.allocation,
      price: 0,
      amount: (asset.allocation / 100) * 1000000,
      position: 'long'
    })),
    portfolioName: 'Research Training Battle',
    portfolioType: userPortfolio.some(a => a.type === 'crypto') ? 'mixed' : 'stocks',
    status: 'active',
    startDate: now.toISOString(),
    endDate: new Date(now.getTime() + BATTLE_DURATION).toISOString(),
    createdAt: now.toISOString(),
    // Training-specific fields
    isTraining: true,
    isTrainingBattle: true,
    source: 'research_mode',
    aiOpponent: {
      name: 'MarketBot',
      avatar: '🤖',
      strategy: 'Balanced growth portfolio'
    }
  };

  console.log('[Training] Battle created:', battleId);
  return battle;
};

// ============================================
// DIVERSIFICATION POOLS FOR SMART PORTFOLIO
// ============================================
const DIVERSIFICATION_POOLS = {
  defensive: [
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', risk: 'low' },
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', risk: 'low' },
    { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples', risk: 'low' },
    { symbol: 'VZ', name: 'Verizon', sector: 'Communication', risk: 'low' },
    { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumer Staples', risk: 'low' },
    { symbol: 'MRK', name: 'Merck', sector: 'Healthcare', risk: 'low' },
    { symbol: 'WMT', name: 'Walmart', sector: 'Consumer Staples', risk: 'low' },
    { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare', risk: 'low' }
  ],
  growth: [
    { symbol: 'CRM', name: 'Salesforce', sector: 'Technology', risk: 'medium' },
    { symbol: 'ADBE', name: 'Adobe', sector: 'Technology', risk: 'medium' },
    { symbol: 'NOW', name: 'ServiceNow', sector: 'Technology', risk: 'medium' },
    { symbol: 'SHOP', name: 'Shopify', sector: 'Technology', risk: 'high' },
    { symbol: 'XYZ', name: 'Block', sector: 'Financials', risk: 'high' },
    { symbol: 'UBER', name: 'Uber', sector: 'Technology', risk: 'medium' },
    { symbol: 'ABNB', name: 'Airbnb', sector: 'Consumer Discretionary', risk: 'medium' }
  ],
  value: [
    { symbol: 'JPM', name: 'JPMorgan', sector: 'Financials', risk: 'low' },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Financials', risk: 'low' },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials', risk: 'medium' },
    { symbol: 'V', name: 'Visa', sector: 'Financials', risk: 'low' },
    { symbol: 'MA', name: 'Mastercard', sector: 'Financials', risk: 'low' },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', risk: 'low' },
    { symbol: 'MCD', name: "McDonald's", sector: 'Consumer Discretionary', risk: 'low' }
  ],
  energy: [
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', risk: 'medium' },
    { symbol: 'CVX', name: 'Chevron', sector: 'Energy', risk: 'medium' },
    { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', risk: 'medium' }
  ]
};

// Company name lookup for symbols
const COMPANY_NAMES = {
  'AAPL': 'Apple', 'MSFT': 'Microsoft', 'GOOGL': 'Alphabet', 'AMZN': 'Amazon',
  'NVDA': 'NVIDIA', 'META': 'Meta', 'TSLA': 'Tesla', 'AMD': 'AMD',
  'AVGO': 'Broadcom', 'CRM': 'Salesforce', 'ADBE': 'Adobe', 'NFLX': 'Netflix',
  'PLTR': 'Palantir', 'COIN': 'Coinbase', 'HOOD': 'Robinhood', 'MSTR': 'MicroStrategy',
  'JPM': 'JPMorgan', 'BAC': 'Bank of America', 'GS': 'Goldman Sachs',
  'V': 'Visa', 'MA': 'Mastercard', 'AXP': 'American Express',
  'JNJ': 'Johnson & Johnson', 'UNH': 'UnitedHealth', 'PFE': 'Pfizer', 'MRK': 'Merck',
  'XOM': 'Exxon Mobil', 'CVX': 'Chevron', 'COP': 'ConocoPhillips',
  'WMT': 'Walmart', 'PG': 'Procter & Gamble', 'KO': 'Coca-Cola', 'PEP': 'PepsiCo',
  'HD': 'Home Depot', 'MCD': "McDonald's", 'DIS': 'Disney', 'VZ': 'Verizon',
  'NOW': 'ServiceNow', 'SHOP': 'Shopify', 'XYZ': 'Block', 'UBER': 'Uber', 'ABNB': 'Airbnb',
  'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana', 'XRP': 'Ripple'
};

// Shuffle array helper
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Calculate user risk score based on stock selections
const calculateUserRiskScore = (stocks) => {
  const highRiskStocks = ['TSLA', 'AMD', 'PLTR', 'COIN', 'HOOD', 'MSTR', 'RIVN', 'SMCI', 'SOFI', 'SHOP', 'XYZ'];
  const mediumRiskStocks = ['NVDA', 'META', 'GOOGL', 'AMZN', 'NFLX', 'AVGO', 'CRM', 'UBER', 'ABNB'];

  let score = 0;
  stocks.forEach(symbol => {
    if (highRiskStocks.includes(symbol)) score += 2;
    else if (mediumRiskStocks.includes(symbol)) score += 1;
  });

  return score;
};

// Select diversification stocks based on strategy
const selectDiversificationStocks = (count, existingPicks, strategy) => {
  const selected = [];
  const alreadySelected = new Set(existingPicks);

  let primaryPool, secondaryPool;

  switch (strategy) {
    case 'balance_with_defensive':
      primaryPool = [...DIVERSIFICATION_POOLS.defensive, ...DIVERSIFICATION_POOLS.value];
      secondaryPool = DIVERSIFICATION_POOLS.growth;
      break;
    case 'add_growth':
      primaryPool = [...DIVERSIFICATION_POOLS.growth];
      secondaryPool = [...DIVERSIFICATION_POOLS.value];
      break;
    case 'balanced_mix':
    default:
      primaryPool = [
        ...DIVERSIFICATION_POOLS.defensive.slice(0, 3),
        ...DIVERSIFICATION_POOLS.growth.slice(0, 3),
        ...DIVERSIFICATION_POOLS.value.slice(0, 3)
      ];
      secondaryPool = DIVERSIFICATION_POOLS.energy;
      break;
  }

  const shuffledPrimary = shuffleArray([...primaryPool]);
  const shuffledSecondary = shuffleArray([...secondaryPool]);

  // Add from primary pool
  for (const stock of shuffledPrimary) {
    if (selected.length >= count) break;
    if (!alreadySelected.has(stock.symbol)) {
      selected.push({
        ...stock,
        reason: strategy === 'balance_with_defensive' ? 'Portfolio balance' : 'Growth potential'
      });
      alreadySelected.add(stock.symbol);
    }
  }

  // Add from secondary pool if needed
  for (const stock of shuffledSecondary) {
    if (selected.length >= count) break;
    if (!alreadySelected.has(stock.symbol)) {
      selected.push({
        ...stock,
        reason: 'Diversification'
      });
      alreadySelected.add(stock.symbol);
    }
  }

  return selected.slice(0, count);
};

// FantasyTrades Bull & Bear Logo Component
const FantasyTradesLogo = ({ size = 'large' }) => {
  const dimensions = {
    large: { width: 450, height: 350 },
    medium: { width: 225, height: 175 },
    small: { width: 90, height: 70 }
  };

  const dim = dimensions[size] || dimensions.large;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 450 350"
      width={dim.width}
      height={dim.height}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="redGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="subtleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <linearGradient id="bullGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#10b981'}}/>
          <stop offset="100%" style={{stopColor: '#059669'}}/>
        </linearGradient>

        <linearGradient id="bearGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#ef4444'}}/>
          <stop offset="100%" style={{stopColor: '#dc2626'}}/>
        </linearGradient>

        <linearGradient id="honeyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{stopColor: '#fbbf24'}}/>
          <stop offset="100%" style={{stopColor: '#d97706'}}/>
        </linearGradient>

        <linearGradient id="potGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#78350f'}}/>
          <stop offset="100%" style={{stopColor: '#451a03'}}/>
        </linearGradient>

        <linearGradient id="hornGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#fafaf9'}}/>
          <stop offset="70%" style={{stopColor: '#e7e5e4'}}/>
          <stop offset="100%" style={{stopColor: '#a8a29e'}}/>
        </linearGradient>

        <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{stopColor: '#FF8C00'}}/>
          <stop offset="100%" style={{stopColor: '#468CFF'}}/>
        </linearGradient>
      </defs>

      <rect width="450" height="350" fill="transparent"/>

      <g transform="translate(200, 140)">

        {/* HONEY POT */}
        <g transform="translate(30, 40)">
          <ellipse cx="0" cy="50" rx="45" ry="15" fill="#451a03"/>
          <path d="M-45 0 Q-50 25 -45 50 Q-25 60 0 60 Q25 60 45 50 Q50 25 45 0 Z"
                fill="url(#potGrad)" stroke="#78350f" strokeWidth="2"/>
          <ellipse cx="0" cy="0" rx="45" ry="12" fill="#92400e" stroke="#78350f" strokeWidth="2"/>
          <ellipse cx="0" cy="2" rx="38" ry="8" fill="url(#honeyGrad)"/>
          {/* HONEY DRIP REMOVED */}
          <rect x="-32" y="18" width="64" height="28" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1"/>
          <text x="0" y="28" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif"
                fontSize="7" fontWeight="600" fill="#78350f">FROM</text>
          <text x="0" y="38" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif"
                fontSize="8" fontWeight="700" fill="#dc2626">BEAR MARKET</text>
          <g transform="translate(-22, 30) scale(0.4)">
            <circle cx="0" cy="0" r="6" fill="#dc2626" opacity="0.4"/>
            <circle cx="-5" cy="-8" r="3" fill="#dc2626" opacity="0.4"/>
            <circle cx="5" cy="-8" r="3" fill="#dc2626" opacity="0.4"/>
            <circle cx="-8" cy="-3" r="2.5" fill="#dc2626" opacity="0.4"/>
            <circle cx="8" cy="-3" r="2.5" fill="#dc2626" opacity="0.4"/>
          </g>
        </g>

        {/* ANGRY BEAR */}
        <g transform="translate(120, 30)" filter="url(#redGlow)">
          <ellipse cx="0" cy="50" rx="35" ry="40" fill="url(#bearGrad)"/>
          <ellipse cx="0" cy="55" rx="22" ry="25" fill="#f87171"/>
          <g transform="translate(-30, 25) rotate(-30)">
            <ellipse cx="0" cy="0" rx="12" ry="22" fill="url(#bearGrad)"/>
            <ellipse cx="-5" cy="22" rx="12" ry="10" fill="#dc2626"/>
            <ellipse cx="-5" cy="24" rx="6" ry="4" fill="#b91c1c"/>
          </g>
          <g transform="translate(28, 35)">
            <ellipse cx="0" cy="0" rx="12" ry="20" fill="url(#bearGrad)"/>
            <ellipse cx="2" cy="20" rx="10" ry="8" fill="#dc2626"/>
          </g>
          <ellipse cx="-15" cy="90" rx="14" ry="8" fill="#dc2626"/>
          <ellipse cx="15" cy="90" rx="14" ry="8" fill="#dc2626"/>
          <ellipse cx="0" cy="-10" rx="38" ry="32" fill="url(#bearGrad)"/>
          <circle cx="-28" cy="-32" r="12" fill="url(#bearGrad)"/>
          <circle cx="-28" cy="-32" r="6" fill="#dc2626"/>
          <circle cx="28" cy="-32" r="12" fill="url(#bearGrad)"/>
          <circle cx="28" cy="-32" r="6" fill="#dc2626"/>
          <g>
            <ellipse cx="-12" cy="-12" rx="10" ry="8" fill="#ffffff"/>
            <ellipse cx="-10" cy="-11" rx="5" ry="6" fill="#1a1a2e"/>
            <circle cx="-8" cy="-13" r="2" fill="#ffffff"/>
            <ellipse cx="12" cy="-12" rx="10" ry="8" fill="#ffffff"/>
            <ellipse cx="14" cy="-11" rx="5" ry="6" fill="#1a1a2e"/>
            <circle cx="16" cy="-13" r="2" fill="#ffffff"/>
          </g>
          <path d="M-22 -22 L-5 -18" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <path d="M22 -22 L5 -18" stroke="#b91c1c" strokeWidth="4" fill="none" strokeLinecap="round"/>
          <ellipse cx="0" cy="8" rx="16" ry="12" fill="#f87171"/>
          <ellipse cx="0" cy="5" rx="7" ry="5" fill="#1a1a2e"/>
          <path d="M-10 18 Q0 12 10 18" stroke="#b91c1c" strokeWidth="3" fill="none" strokeLinecap="round"/>
          <g transform="translate(30, -35)" fill="#ef4444">
            <path d="M0 -8 L2 0 L8 -2 L2 2 L4 8 L0 3 L-4 8 L-2 2 L-8 -2 L-2 0 Z" transform="scale(0.6)"/>
          </g>
        </g>

        {/* BULL eating from pot */}
        <g filter="url(#greenGlow)">
          <ellipse cx="-60" cy="60" rx="50" ry="40" fill="url(#bullGrad)"/>
          <path d="M-30 30 Q-10 20 10 35 L5 60 L-25 70 Z" fill="url(#bullGrad)"/>
          <g transform="translate(-10, 20) rotate(25)">
            <ellipse cx="0" cy="0" rx="35" ry="28" fill="url(#bullGrad)"/>
            <path d="M-22 -14 C-28 -16 -34 -20 -38 -26 C-42 -32 -42 -38 -38 -42 L-32 -38 C-34 -34 -34 -30 -32 -26 C-28 -22 -24 -18 -20 -16 Z"
                  fill="url(#hornGrad)" stroke="#d6d3d1" strokeWidth="1"/>
            <path d="M22 -14 C28 -16 34 -20 38 -26 C42 -32 42 -38 38 -42 L32 -38 C34 -34 34 -30 32 -26 C28 -22 24 -18 20 -16 Z"
                  fill="url(#hornGrad)" stroke="#d6d3d1" strokeWidth="1"/>
            <ellipse cx="-28" cy="-3" rx="8" ry="12" fill="#059669"/>
            <ellipse cx="28" cy="-3" rx="8" ry="12" fill="#059669"/>
            <path d="M-15 -5 Q-10 -10 -5 -5" stroke="#0d1117" strokeWidth="3" fill="none" strokeLinecap="round"/>
            <path d="M5 -5 Q10 -10 15 -5" stroke="#0d1117" strokeWidth="3" fill="none" strokeLinecap="round"/>
            <ellipse cx="0" cy="15" rx="18" ry="12" fill="#059669"/>
            <ellipse cx="0" cy="12" rx="8" ry="5" fill="#047857"/>
            <circle cx="-3" cy="12" r="2" fill="#0d1117"/>
            <circle cx="3" cy="12" r="2" fill="#0d1117"/>
          </g>
          <g filter="url(#goldGlow)">
            <ellipse cx="8" cy="48" rx="12" ry="6" fill="#fbbf24" opacity="0.8"/>
            <circle cx="15" cy="42" r="4" fill="#fbbf24" opacity="0.6"/>
            <circle cx="0" cy="52" r="3" fill="#fbbf24" opacity="0.7"/>
          </g>
          <path d="M-100 50 Q-115 35 -105 25 Q-95 30 -100 45"
                stroke="url(#bullGrad)" strokeWidth="6" fill="none" strokeLinecap="round"/>
          <path d="M-105 25 Q-100 15 -95 20"
                stroke="#059669" strokeWidth="8" fill="none" strokeLinecap="round"/>
        </g>

        <g stroke="#fbbf24" strokeWidth="2" opacity="0.6">
          <line x1="-50" y1="-20" x2="-60" y2="-30"/>
          <line x1="-40" y1="-30" x2="-45" y2="-42"/>
        </g>

      </g>

      <text x="225" y="295" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="28" fontWeight="700" letterSpacing="6" filter="url(#subtleGlow)">
        <tspan fill="url(#brandGradient)">FANTASY</tspan><tspan fill="url(#brandGradient)">TRADES</tspan>
      </text>

      <text x="225" y="323" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="10" fontWeight="400" letterSpacing="3" fill="#8b949e">
        PORTFOLIO BATTLES
      </text>
    </svg>
  );
};

// ============================================
// UTILITY FUNCTION: GENERATE RANDOM CPU PORTFOLIO
// ============================================
function generateCPUPortfolio(portfolioType, stocksData, cryptoData) {
  const assetList = portfolioType === 'stocks' ? stocksData : cryptoData;
  
  // Random number of assets (7-13)
  const numAssets = Math.floor(Math.random() * 7) + 7; // 7 to 13
  
  // Shuffle and select random assets
  const shuffled = [...assetList].sort(() => 0.5 - Math.random());
  const selectedAssets = shuffled.slice(0, numAssets);
  
  // Generate random allocations that sum to 100%
  const allocations = [];
  let remaining = 100;
  
  for (let i = 0; i < numAssets - 1; i++) {
    // Calculate min and max for this asset
    const minAlloc = 7.5;
    const maxForThisAsset = Math.min(20, remaining - (numAssets - i - 1) * 7.5);
    
    // Random allocation within valid range
    const allocation = Math.floor((Math.random() * (maxForThisAsset - minAlloc) + minAlloc) * 4) / 4; // Round to 0.25
    allocations.push(allocation);
    remaining -= allocation;
  }
  
  // Last asset gets the remaining percentage
  allocations.push(Math.round(remaining * 100) / 100);
  
  // Create portfolio with allocations
  const portfolio = selectedAssets.map((asset, index) => ({
    symbol: asset.symbol,
    name: asset.name,
    price: asset.price,
    amount: (allocations[index] / 100) * 1000000
  }));
  
  return portfolio;
}

// Lucide icons
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Trophy,
  Copy,
  Plus,
  X,
  LogOut,
  Wallet,
  BarChart3,
  Swords,
  Loader2,
  Rocket,
  Target,
  Crown,
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  Bot,
  GraduationCap,
  Skull,
  Shield,
  ArrowRight,
  User,
  Flame,
  Brain,
  Briefcase,
  Settings,
  BookOpen,
  Bomb
} from 'lucide-react';

// Screens that hide the mobile bottom navigation (gameplay/builder screens)
const GAMEPLAY_SCREENS = [
  'battle', 'draftBattle', 'draftRoom', 'draftLobby', 'baggerBombLobby',
  'baggerBombSetup', 'baggerBombBuilder', 'baggerBombJoinBuilder',
  'joinPortfolioBuilderTD', 'trainingPortfolioBuilderTD', 'builder', 'join',
  'draftSetup', 'draftJoin', 'draftTraining', 'draftResults', 'draftBattleLegacy',
  'freeAgency', 'freeAgencyLegacy', 'earningsGame', 'stonkOptionsArena', 'tdBuilder',
];

// Dark Gaming Theme Colors
const colors = {
  background: '#0d1117',
  cardBg: '#1a1f2e',
  cardInner: '#161b22',
  cardHover: '#1c2128',
  cardElevated: '#21262d',
  elevated: '#21262d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
  cyan: '#00d9ff',
  cyanDim: '#0099cc',
  cyanDark: '#0099cc',
  green: '#10b981',
  greenBright: '#00ff88',
  greenLight: '#34d399',
  red: '#ef4444',
  redBright: '#ff4466',
  redLight: '#f87171',
  blue: '#3b82f6',
  purple: '#9333ea',
  gold: '#ffc107',
  border: 'rgba(0, 217, 255, 0.2)',
  borderSubtle: 'rgba(255, 255, 255, 0.1)',
  borderFocus: '#00d9ff'
};

// ============================================
// TUTORIAL CONTENT FOR EACH GAME MODE
// ============================================
const TUTORIALS = {
  draft: {
    title: 'How to Play Snake Draft',
    color: '#10b981',
    steps: [
      {
        icon: '🐍',
        title: 'The Snake Draft',
        description: '4 players take turns picking assets in snake order. Round 1: P1→P2→P3→P4, Round 2: P4→P3→P2→P1, then repeat.',
        tip: 'Later draft positions get back-to-back picks!'
      },
      {
        icon: '🎯',
        title: 'Build Your Team',
        description: 'Pick 9 assets total from 75 available. Categories: Neutral (safe), Aggressive (volatile), and Defensive (stable).',
        tip: 'Balance your categories for optimal results!'
      },
      {
        icon: '⚡',
        title: 'Time Pressure',
        description: '30 seconds per pick in training, 2 minutes in real drafts. If time expires, auto-pick selects for you!',
        tip: 'Research assets beforehand using Research Mode!'
      },
      {
        icon: '🎮',
        title: 'Battle Phase',
        description: 'After drafting completes, all 4 players compete simultaneously. Stocks: Until Friday 3PM CT. Crypto: 7 days.',
        tip: 'Draft ends → Battle begins immediately!'
      },
      {
        icon: '🔄',
        title: 'Free Agency',
        description: 'During the battle phase, swap up to 2 assets per day. Strategic trades can turn the tide!',
        tip: 'Watch the market for buy-low opportunities!'
      },
      {
        icon: '🥇',
        title: 'Final Standings',
        description: 'Finish in the top 2 to earn bonus XP rewards. Your draft skills are tracked over time on your profile!',
        tip: '1st place earns maximum rewards!'
      }
    ]
  },
  training: {
    title: 'How Training Mode Works',
    color: '#9333ea',
    steps: [
      {
        icon: '🎓',
        title: 'Risk-Free Practice',
        description: 'Battle against a CPU opponent using the same rules as real battles. Learn the mechanics with zero pressure!',
        tip: 'Great for testing new strategies!'
      },
      {
        icon: '⏰',
        title: 'Shorter Duration',
        description: 'Training battles last only 1 hour instead of 24 hours. Get quick feedback to learn and improve faster.',
        tip: 'Perfect for testing portfolio ideas!'
      },
      {
        icon: '✨',
        title: 'Reduced Rewards',
        description: 'Earn 10 XP for wins and 5 XP for losses. Training battles don\'t affect your official W/L record.',
        tip: 'Focus on learning, not winning!'
      }
    ]
  },
  draftTraining: {
    title: 'How Draft Training Works',
    color: '#9333ea',
    steps: [
      {
        icon: '🎓',
        title: 'Practice Drafting',
        description: 'Draft against 3 CPU opponents. Experience the same rules and time pressure without any stakes!',
        tip: 'Test different draft strategies safely!'
      },
      {
        icon: '🤖',
        title: 'CPU Opponents',
        description: 'CPUs draft automatically using varied strategies. Watch their picks to learn new approaches!',
        tip: 'CPUs sometimes make surprising picks!'
      },
      {
        icon: '✨',
        title: 'Training Rewards',
        description: 'Earn reduced XP but gain valuable drafting experience. Perfect preparation before real competitive drafts!',
        tip: 'No ranking impact - experiment freely!'
      }
    ]
  }
};


// ============================================
// WEEKLY CHALLENGES - CHALLENGE POOL
// ============================================

const CHALLENGE_POOL = {
  // CLASSIC MODE ONLY CHALLENGES
  classic: [
    // Easy (100 XP)
    { id: 'classic_first_win', name: 'First Blood', description: 'Win a Classic battle', gameMode: 'classic', difficulty: 'easy', xp: 100, target: 1, type: 'wins', icon: '⚔️' },
    { id: 'classic_complete_3', name: 'Battle Veteran', description: 'Complete 3 Classic battles', gameMode: 'classic', difficulty: 'easy', xp: 100, target: 3, type: 'completions', icon: '🎖️' },
    { id: 'classic_positive_return', name: 'In The Green', description: 'Finish a Classic battle with a positive return', gameMode: 'classic', difficulty: 'easy', xp: 100, target: 1, type: 'positive_return', icon: '📈' },
    // Medium (250 XP)
    { id: 'classic_win_streak_2', name: 'Double Tap', description: 'Win 2 Classic battles in a row', gameMode: 'classic', difficulty: 'medium', xp: 250, target: 2, type: 'win_streak', icon: '🔥' },
    { id: 'classic_5_green_assets', name: 'Green Portfolio', description: 'Win a Classic battle with 5+ assets in the green', gameMode: 'classic', difficulty: 'medium', xp: 250, target: 5, type: 'green_assets', icon: '💚' },
    { id: 'classic_comeback', name: 'Comeback King', description: 'Win a Classic battle after trailing at halftime', gameMode: 'classic', difficulty: 'medium', xp: 250, target: 1, type: 'comeback_win', icon: '👑' },
    { id: 'classic_defense_wins', name: 'Defense Wins', description: 'Win a Classic battle where your worst asset beats their worst asset', gameMode: 'classic', difficulty: 'medium', xp: 250, target: 1, type: 'defense_win', icon: '🛡️' },
    // Hard (500 XP)
    { id: 'classic_win_streak_3', name: 'Hat Trick', description: 'Win 3 Classic battles in a row', gameMode: 'classic', difficulty: 'hard', xp: 500, target: 3, type: 'win_streak', icon: '🎩' },
    { id: 'classic_all_green', name: 'Perfect Portfolio', description: 'Win a Classic battle with ALL assets in the green', gameMode: 'classic', difficulty: 'hard', xp: 500, target: 1, type: 'all_green', icon: '✨' },
    { id: 'classic_double_digit', name: 'Double Digits', description: 'Win a Classic battle with 10%+ portfolio return', gameMode: 'classic', difficulty: 'hard', xp: 500, target: 10, type: 'return_threshold', icon: '🚀' }
  ],
  // SNAKE DRAFT ONLY CHALLENGES
  snake: [
    // Easy (100 XP)
    { id: 'snake_first_win', name: 'Snake Charmer', description: 'Win a Snake Draft battle', gameMode: 'snake', difficulty: 'easy', xp: 100, target: 1, type: 'wins', icon: '🐍' },
    { id: 'snake_complete_2', name: 'Draft Day', description: 'Complete 2 Snake Draft battles', gameMode: 'snake', difficulty: 'easy', xp: 100, target: 2, type: 'completions', icon: '📋' },
    { id: 'snake_top_half', name: 'Above Average', description: 'Finish in the top 2 of a Snake Draft', gameMode: 'snake', difficulty: 'easy', xp: 100, target: 1, type: 'top_half_finish', icon: '🏅' },
    // Medium (250 XP)
    { id: 'snake_first_pick_mvp', name: 'Worth The Pick', description: 'Win a Snake Draft where your 1st round pick is your top performer', gameMode: 'snake', difficulty: 'medium', xp: 250, target: 1, type: 'first_pick_mvp', icon: '🎯' },
    { id: 'snake_last_pick_win', name: 'Against All Odds', description: 'Win a Snake Draft from the last pick position', gameMode: 'snake', difficulty: 'medium', xp: 250, target: 1, type: 'last_pick_win', icon: '🍀' },
    { id: 'snake_sector_focus', name: 'Sector Specialist', description: 'Draft 3+ assets from the same sector in a Snake Draft', gameMode: 'snake', difficulty: 'medium', xp: 250, target: 3, type: 'same_sector_draft', icon: '🏭' },
    // Hard (500 XP)
    { id: 'snake_win_streak_2', name: 'Snake Eyes', description: 'Win 2 Snake Draft battles in a row', gameMode: 'snake', difficulty: 'hard', xp: 500, target: 2, type: 'win_streak', icon: '🎲' },
    { id: 'snake_podium_streak', name: 'Consistent Drafter', description: 'Finish top 2 in 3 Snake Draft battles', gameMode: 'snake', difficulty: 'hard', xp: 500, target: 3, type: 'top_half_count', icon: '🏆' },
    { id: 'snake_late_round_hero', name: 'Late Round Hero', description: 'Win a Snake Draft where a pick from round 5+ is your MVP', gameMode: 'snake', difficulty: 'hard', xp: 500, target: 1, type: 'late_pick_mvp', icon: '💎' }
  ],
  // UNIVERSAL CHALLENGES (Both Classic & Snake)
  universal: [
    // Easy (100 XP)
    { id: 'uni_play_both', name: 'Versatile Trader', description: 'Complete 1 Classic and 1 Snake Draft battle', gameMode: 'universal', difficulty: 'easy', xp: 100, target: 1, type: 'play_both_modes', icon: '🔄' },
    { id: 'uni_5_battles', name: 'Active Trader', description: 'Complete 5 battles (any mode)', gameMode: 'universal', difficulty: 'easy', xp: 100, target: 5, type: 'total_completions', icon: '📊' },
    { id: 'uni_use_research', name: 'Research Rookie', description: 'Use Research Mode before building a portfolio', gameMode: 'universal', difficulty: 'easy', xp: 100, target: 1, type: 'use_research', icon: '🔬' },
    // Medium (250 XP)
    { id: 'uni_3_different_opponents', name: 'Social Trader', description: 'Battle 3 different opponents this week', gameMode: 'universal', difficulty: 'medium', xp: 250, target: 3, type: 'unique_opponents', icon: '🤝' },
    { id: 'uni_win_both_modes', name: 'Master of Both', description: 'Win at least 1 Classic and 1 Snake Draft battle', gameMode: 'universal', difficulty: 'medium', xp: 250, target: 1, type: 'win_both_modes', icon: '⚡' },
    { id: 'uni_diversified', name: 'Diversified Portfolio', description: 'Complete a battle with assets from 5+ different sectors', gameMode: 'universal', difficulty: 'medium', xp: 250, target: 5, type: 'sector_diversity', icon: '🌐' },
    { id: 'uni_crypto_stock', name: 'Mixed Markets', description: 'Complete both a Stock and Crypto battle', gameMode: 'universal', difficulty: 'medium', xp: 250, target: 1, type: 'both_asset_types', icon: '💱' },
    // Hard (500 XP)
    { id: 'uni_5_wins', name: 'Weekly Champion', description: 'Win 5 battles this week (any mode)', gameMode: 'universal', difficulty: 'hard', xp: 500, target: 5, type: 'total_wins', icon: '🏆' },
    { id: 'uni_no_losses', name: 'Undefeated', description: 'Win 3 battles without any losses', gameMode: 'universal', difficulty: 'hard', xp: 500, target: 3, type: 'win_without_loss', icon: '🛡️' },
    { id: 'uni_daily_streak', name: 'Daily Grind', description: 'Complete at least 1 battle on 5 different days', gameMode: 'universal', difficulty: 'hard', xp: 500, target: 5, type: 'daily_activity', icon: '📅' }
  ]
};

// XP Rewards
const CHALLENGE_XP = {
  easy: 100,
  medium: 250,
  hard: 500,
  weeklyBonus: 250 // Complete all 4 challenges
};

// Challenge colors for UI
const CHALLENGE_COLORS = {
  weekly: '#A855F7',    // Purple for weekly challenges
  inBattle: '#FB923C', // Orange for in-battle challenges
  easy: '#22C55E',     // Green
  medium: '#EAB308',   // Yellow/Gold
  hard: '#EF4444',     // Red
  completed: '#00d9ff' // Cyan (brand color)
};

// ============================================
// INTERACTIVE RISK CHALLENGES SYSTEM
// ============================================

// Risk Challenge Types - Optional mid-battle mini-games
const RISK_CHALLENGE_TYPES = {
  SP_CLOSE: {
    id: 'sp_close',
    name: 'S&P Close Prediction',
    emoji: '📊',
    description: 'Predict if the S&P 500 will close above or below the current price',
    riskRewardPercent: 0.35,
    resolutionType: 'market_close',
    timeToAccept: 300, // 5 minutes
  },
  DOUBLE_DOWN: {
    id: 'double_down',
    name: 'Double Down',
    emoji: '🎲',
    description: 'Pick one of your stocks to double its weight for 1 hour',
    riskRewardPercent: 0.50,
    resolutionType: 'timed',
    resolutionDuration: 3600, // 1 hour
    timeToAccept: 300,
  },
  STOCK_DUEL: {
    id: 'stock_duel',
    name: 'Stock Duel',
    emoji: '⚔️',
    description: 'Both players pick a stock - best performer in 1 hour wins',
    riskRewardPercent: 0.30,
    resolutionType: 'timed',
    resolutionDuration: 3600,
    timeToAccept: 300,
    requiresBothPlayers: true,
    duelStocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD'],
  },
  CRYPTO_CALL: {
    id: 'crypto_call',
    name: 'Crypto Call',
    emoji: '₿',
    description: 'Predict if Bitcoin will be higher or lower in 1 hour',
    riskRewardPercent: 0.40,
    resolutionType: 'timed',
    resolutionDuration: 3600,
    timeToAccept: 300,
  },
  STOCK_DIRECTION: {
    id: 'stock_direction',
    name: 'Stock Direction',
    emoji: '📈',
    description: 'Predict if a volatile stock will go up or down by market close',
    riskRewardPercent: 0.25,
    resolutionType: 'market_close',
    timeToAccept: 300,
    volatileStocks: ['TSLA', 'NVDA', 'AMD', 'COIN', 'GME', 'RIVN', 'PLTR', 'SNAP'],
  },
};

// Challenge Schedule - When to trigger challenges during battles
const RISK_CHALLENGE_SCHEDULE = {
  // For 24-hour battles
  '24h': [
    { triggerAtPercent: 15, types: ['STOCK_DIRECTION', 'CRYPTO_CALL'] },
    { triggerAtPercent: 30, types: ['SP_CLOSE', 'DOUBLE_DOWN'] },
    { triggerAtPercent: 50, types: ['STOCK_DUEL', 'CRYPTO_CALL'] },
    { triggerAtPercent: 70, types: ['DOUBLE_DOWN', 'STOCK_DIRECTION'] },
    { triggerAtPercent: 85, types: ['SP_CLOSE', 'STOCK_DUEL'] },
  ],
  // For 1-hour training battles
  '1h': [
    { triggerAtPercent: 25, types: ['CRYPTO_CALL', 'STOCK_DIRECTION'] },
    { triggerAtPercent: 60, types: ['DOUBLE_DOWN'] },
  ],
};

// ============================================
// WEEKLY CHALLENGES - HELPER FUNCTIONS
// ============================================

// Get the start of current week (Monday midnight)
const getWeekStartDate = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD format
};

// Get today's date string for daily tracking
const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

// Check if it's a new week (challenges should reset)
const isNewWeek = (lastWeekStart) => {
  return getWeekStartDate() !== lastWeekStart;
};

// ============================================
// CHALLENGE MODAL COMPONENT (Placeholder)
// ============================================

/**
 * ChallengeModal - Placeholder component for challenge system
 * Returns null as the challenge modal UI is not yet implemented
 * This prevents the "ChallengeModal is not defined" error
 */
const ChallengeModal = () => {
  // Challenge modal functionality not yet implemented
  // Return null to prevent rendering errors
  return null;
};

// Select 4 weekly challenges: 1 Classic, 1 Snake, 1 Universal, 1 Wild Card
const selectWeeklyChallenges = () => {
  const getRandomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const classicChallenge = getRandomFromArray(CHALLENGE_POOL.classic);
  const snakeChallenge = getRandomFromArray(CHALLENGE_POOL.snake);
  const universalChallenge = getRandomFromArray(CHALLENGE_POOL.universal);

  // Wild card - pick from any pool
  const allChallenges = [
    ...CHALLENGE_POOL.classic,
    ...CHALLENGE_POOL.snake,
    ...CHALLENGE_POOL.universal
  ].filter(c =>
    c.id !== classicChallenge.id &&
    c.id !== snakeChallenge.id &&
    c.id !== universalChallenge.id
  );
  const wildCardChallenge = getRandomFromArray(allChallenges);

  return [
    { ...classicChallenge, slot: 'classic', slotLabel: 'Classic Mode' },
    { ...snakeChallenge, slot: 'snake', slotLabel: 'Snake Draft' },
    { ...universalChallenge, slot: 'universal', slotLabel: 'Any Mode' },
    { ...wildCardChallenge, slot: 'wildcard', slotLabel: 'Wild Card' }
  ];
};

// Check if user can accept a new challenge today
const canAcceptChallengeToday = (activeDailyChallenge) => {
  if (!activeDailyChallenge) return true;
  return activeDailyChallenge.acceptedDate !== getTodayDateString();
};

// Check if challenge is already completed this week
const isChallengeCompleted = (challengeId, completedChallenges) => {
  return completedChallenges.some(c => c.id === challengeId);
};

// Calculate time until weekly reset (next Monday)
const getTimeUntilReset = () => {
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

// Get difficulty color
const getDifficultyColor = (difficulty) => {
  return CHALLENGE_COLORS[difficulty] || '#ffffff';
};

// Get game mode badge color
const getGameModeColor = (gameMode) => {
  switch(gameMode) {
    case 'classic': return '#00d9ff'; // Cyan
    case 'snake': return '#A855F7';   // Purple
    case 'universal': return '#22C55E'; // Green
    default: return '#FB923C';         // Orange for wild card
  }
};

// Style override to neutralize App.css
const containerStyle = {
  maxWidth: '100vw',
  width: '100%',
  margin: 0,
  padding: 0,
  textAlign: 'left',
  minHeight: '100dvh',
  background: colors.background,
  overflowX: 'hidden'
};

// Mini Sparkline Chart Component
const MiniSparkline = ({ isPositive, width = 70, height = 24 }) => {
  // Generate a simple trend line based on positive/negative
  const generatePath = () => {
    const points = [];
    const numPoints = 12;
    let y = height / 2;

    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * width;
      // Create a gentle trend line
      const noise = Math.sin(i * 0.8) * (height * 0.15);
      const trend = isPositive
        ? (height * 0.6) - (i / numPoints) * (height * 0.4) + noise
        : (height * 0.3) + (i / numPoints) * (height * 0.4) + noise;
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(2, Math.min(height - 2, trend)).toFixed(1)}`);
    }
    return points.join(' ');
  };

  const color = isPositive ? colors.green : colors.red;
  const gradientId = `sparkline-${isPositive ? 'green' : 'red'}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={generatePath()}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// Battle History Card Component
const BattleHistoryCard = ({ battle, userId, onRematch }) => {
  const [expanded, setExpanded] = useState(false);

  // Determine if user won
  const userWon = battle.winnerId === userId;
  const userPlayer = battle.player1?.odUserId === userId ? battle.player1 : battle.player2;
  const opponentPlayer = battle.player1?.odUserId === userId ? battle.player2 : battle.player1;

  // Format date
  const battleDate = new Date(battle.endTime || battle.createdAt || Date.now());
  const dateStr = battleDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeStr = battleDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });

  // Calculate returns if not provided
  const userReturn = userPlayer?.finalReturn || userPlayer?.totalReturn || 0;
  const opponentReturn = opponentPlayer?.finalReturn || opponentPlayer?.totalReturn || 0;

  return (
    <div style={{
      backgroundColor: '#161b22',
      border: `2px solid ${userWon ? '#22c55e' : '#ef4444'}`,
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      {/* Card Header - Clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          padding: '16px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          {/* Result Badge */}
          <div style={{
            padding: '4px 12px',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '12px',
            backgroundColor: userWon ? '#22c55e' : '#ef4444',
            color: userWon ? '#000000' : '#ffffff'
          }}>
            {userWon ? '🏆 VICTORY' : '💀 DEFEAT'}
          </div>

          {/* Date/Time */}
          <div style={{ fontSize: '13px', color: '#8b949e' }}>
            {dateStr} • {timeStr}
          </div>
        </div>

        {/* Score Summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* User Score */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>Your Performance</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: userReturn >= 0 ? '#22c55e' : '#ef4444'
            }}>
              {userReturn >= 0 ? '+' : ''}{userReturn.toFixed(2)}%
            </div>
          </div>

          {/* VS */}
          <div style={{ padding: '0 16px', color: '#6b7280', fontWeight: 'bold' }}>VS</div>

          {/* Opponent Score */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>Opponent</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: opponentReturn >= 0 ? '#22c55e' : '#ef4444'
            }}>
              {opponentReturn >= 0 ? '+' : ''}{opponentReturn.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Expand Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '12px',
          color: '#6b7280',
          fontSize: '13px'
        }}>
          <span>{expanded ? 'Hide Details' : 'View Portfolios'}</span>
          <svg
            style={{
              width: '16px',
              height: '16px',
              marginLeft: '8px',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #21262d',
          padding: '16px',
          backgroundColor: '#0d1117'
        }}>
          {/* Battle Info */}
          <div style={{
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid #21262d'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#8b949e' }}>Battle Type:</span>
                <span style={{ marginLeft: '8px', color: '#ffffff', fontWeight: '600' }}>
                  {battle.battleType === 'stocks' ? '📈 Stocks' : '₿ Crypto'}
                </span>
              </div>
              <div>
                <span style={{ color: '#8b949e' }}>Duration:</span>
                <span style={{ marginLeft: '8px', color: '#ffffff', fontWeight: '600' }}>24 hours</span>
              </div>
            </div>
          </div>

          {/* Portfolios Side by Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Your Portfolio */}
            <div>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#00d9ff',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>👤</span>
                Your Portfolio
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(userPlayer?.portfolio || []).map((asset, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '13px' }}>{asset.symbol}</span>
                      <span style={{ fontSize: '11px', color: '#8b949e' }}>{asset.allocation}%</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px'
                    }}>
                      <span style={{ color: '#6b7280' }}>
                        ${(asset.startPrice || asset.price || 0).toFixed(2)} → ${(asset.endPrice || asset.price || 0).toFixed(2)}
                      </span>
                      <span style={{ color: (asset.return || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {(asset.return || 0) >= 0 ? '+' : ''}{(asset.return || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opponent Portfolio */}
            <div>
              <h3 style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#a855f7',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>🎯</span>
                Opponent Portfolio
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(opponentPlayer?.portfolio || []).map((asset, idx) => (
                  <div key={idx} style={{
                    backgroundColor: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '13px' }}>{asset.symbol}</span>
                      <span style={{ fontSize: '11px', color: '#8b949e' }}>{asset.allocation}%</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px'
                    }}>
                      <span style={{ color: '#6b7280' }}>
                        ${(asset.startPrice || asset.price || 0).toFixed(2)} → ${(asset.endPrice || asset.price || 0).toFixed(2)}
                      </span>
                      <span style={{ color: (asset.return || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {(asset.return || 0) >= 0 ? '+' : ''}{(asset.return || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rematch Button */}
          {onRematch && opponentPlayer && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #21262d'
            }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRematch(battle.id, opponentPlayer.odUserId || opponentPlayer.odM, opponentPlayer.username || 'Opponent');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#f59e0b',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <span>⚔️</span>
                Quick Rematch
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Asset Weight Card Component with Dropdown + Slider
const AssetWeightCard = ({ asset, onWeightChange, onRemove }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  // Preset weight options (2.5% increments)
  const weightOptions = [7.5, 10, 12.5, 15, 17.5, 20];

  return (
    <div style={{
      backgroundColor: '#161b22',
      border: '2px solid #8b5cf6',
      borderRadius: '12px',
      padding: '16px'
    }}>

      {/* ASSET HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '4px'
          }}>
            {asset.symbol}
          </h3>
          <p style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#00d9ff'
          }}>
            ${asset.price?.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* REMOVE BUTTON */}
        <button
          onClick={onRemove}
          style={{
            width: '36px',
            height: '36px',
            backgroundColor: 'transparent',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          ×
        </button>
      </div>

      {/* WEIGHT SELECTION */}
      <div>
        {/* DROPDOWN */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              width: '100%',
              backgroundColor: '#0d1117',
              border: '2px solid #8b5cf6',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            <span>{asset.allocation}%</span>
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="#8b5cf6"
              viewBox="0 0 24 24"
              style={{
                transform: showDropdown ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* DROPDOWN MENU */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              backgroundColor: '#161b22',
              border: '2px solid #8b5cf6',
              borderRadius: '8px',
              overflow: 'hidden',
              zIndex: 100,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
            }}>
              {weightOptions.map((weight) => (
                <button
                  key={weight}
                  onClick={() => {
                    onWeightChange(weight);
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: asset.allocation === weight ? '#8b5cf6' : 'transparent',
                    color: asset.allocation === weight ? '#000000' : '#ffffff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: asset.allocation === weight ? 'bold' : '600',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  {weight}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SLIDER */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>Fine tune</span>
            <span style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: 'bold' }}>
              {asset.allocation}%
            </span>
          </div>

          <input
            type="range"
            min="7.5"
            max="20"
            step="0.1"
            value={asset.allocation}
            onChange={(e) => onWeightChange(parseFloat(e.target.value))}
            className="custom-slider"
            style={{
              width: '100%',
              height: '8px',
              borderRadius: '4px',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundColor: '#21262d',
              outline: 'none',
              cursor: 'pointer'
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '6px'
          }}>
            <span style={{ color: '#6e7681', fontSize: '11px' }}>7.5%</span>
            <span style={{ color: '#6e7681', fontSize: '11px' }}>20%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoized Slot Machine component to prevent animation restarts
const SlotMachineContent = React.memo(({ challenges, onClose }) => {
  const [animationStarted, setAnimationStarted] = useState(false);
  const [displayedChallenges, setDisplayedChallenges] = useState([]);

  useEffect(() => {
    if (!animationStarted && challenges.length >= 4) {
      setAnimationStarted(true);
      setDisplayedChallenges([...challenges]); // Freeze the challenges
    }
  }, [challenges, animationStarted]);

  const challengesToShow = displayedChallenges.length > 0 ? displayedChallenges : challenges;

  const getGameModeColor = (gameMode) => {
    switch (gameMode) {
      case 'classic': return '#00D9FF';
      case 'snake': return '#10B981';
      case 'universal': return '#A855F7';
      default: return '#A855F7';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#10B981';
      case 'medium': return '#FBBF24';
      case 'hard': return '#EF4444';
      default: return '#A855F7';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
        overflow: 'auto'
      }}
    >
      <motion.h2
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          color: '#fff',
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '8px',
          textAlign: 'center'
        }}
      >
        NEW WEEKLY CHALLENGES
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          marginBottom: '24px',
          textAlign: 'center'
        }}
      >
        Your challenges for this week are...
      </motion.p>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '350px'
      }}>
        {challengesToShow.map((challenge, index) => (
          <motion.div
            key={`slot-challenge-${challenge.id}`}
            initial={{ x: -300, opacity: 0, rotateY: 90 }}
            animate={{ x: 0, opacity: 1, rotateY: 0 }}
            transition={{
              delay: 0.8 + (index * 0.4),
              type: 'spring',
              stiffness: 100,
              damping: 15
            }}
            style={{
              background: `linear-gradient(135deg, ${getGameModeColor(challenge.gameMode)}15, rgba(13, 17, 23, 0.95))`,
              border: `2px solid ${getGameModeColor(challenge.gameMode)}`,
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: `${getGameModeColor(challenge.gameMode)}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0
            }}>
              {challenge.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <span style={{
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  {challenge.name}
                </span>
                <span style={{
                  background: getDifficultyColor(challenge.difficulty),
                  color: challenge.difficulty === 'easy' ? '#000' : '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase'
                }}>
                  {challenge.difficulty}
                </span>
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '12px'
              }}>
                {challenge.slotLabel || challenge.gameMode}
              </div>
            </div>
            <div style={{
              color: '#FBBF24',
              fontWeight: '700',
              fontSize: '14px',
              flexShrink: 0
            }}>
              +{challenge.xp} XP
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClose}
        style={{
          marginTop: '24px',
          padding: '14px 48px',
          background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
          border: 'none',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer'
        }}
      >
        LET'S GO!
      </motion.button>
    </motion.div>
  );
});

export default function PortfolioDuel() {
  // ============================================
  // 1. ALL STATE DECLARATIONS
  // ============================================

  // User state from context (single source of truth)
  const { user, login, register, loginWithGoogle, logout, updateUser, loading: userLoading, authLoading, forgotPassword } = useUser();
  const { isMobile: rawIsMobile, isTablet } = useIsMobile();
  const isMobile = rawIsMobile || isTablet;  // Treat <=768px as mobile for layout forks
  const isPageVisible = usePageVisibility();

  const [screen, setScreen] = useState('home');
  const [historyTab, setHistoryTab] = useState('draft'); // 'classic', 'draft', or 'training'
  const [username, setUsername] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [builderMode, setBuilderMode] = useState('create'); // 'create', 'join', or 'training'

  // Market data state
  const [stocksData, setStocksData] = useState([]);
  const [cryptoData, setCryptoData] = useState([]);
  const [loadingMarketData, setLoadingMarketData] = useState(true);

  // FantasyTimes story detail
  const [selectedStory, setSelectedStory] = useState(null);

  // Battle management
  const [battles, setBattles] = useState([]);
  const [currentBattle, setCurrentBattle] = useState(null);
  const [activeBattleId, setActiveBattleId] = useState(null);
  const [activeDraftBattles, setActiveDraftBattles] = useState([]);
  const [completedDraftBattles, setCompletedDraftBattles] = useState([]);
  const [activeTrainingBattles, setActiveTrainingBattles] = useState([]); // Firebase-persisted training battles
  const [completedTrainingBattles, setCompletedTrainingBattles] = useState([]); // For Battle History training tab
  const [loadingTrainingBattles, setLoadingTrainingBattles] = useState(false);
  const [completedBaggerBombBattles, setCompletedBaggerBombBattles] = useState([]); // For Battle History BaggerBomb tab (Firestore)

  // Portfolio builder state
  const [assetType, setAssetType] = useState('stocks');
  const [searchTerm, setSearchTerm] = useState('');
  const [portfolio, setPortfolio] = useState([]);
  const [portfolioType, setPortfolioType] = useState(null); // 'stocks' or 'crypto'
  const [builderCategory, setBuilderCategory] = useState('Leadership'); // Leadership/Momentum/Stable/Short tabs
  const [selectedCrypto, setSelectedCrypto] = useState(null); // { symbol: 'BTC', position: 'long' | 'short' }
  const [cryptoPercentage, setCryptoPercentage] = useState(10); // Default 10% for crypto
  const [showRulesModal, setShowRulesModal] = useState(false); // Rules modal state

  // BaggerBomb lobby time selection
  const [lobbyTimeMinutes, setLobbyTimeMinutes] = useState(30); // Default 30 minutes

  // Battle joining state
  const [joinCode, setJoinCode] = useState('');

  // Battle live prices state
  const [battlePrices, setBattlePrices] = useState({});
  const [loadingBattlePrices, setLoadingBattlePrices] = useState(false);

  // Battle lobby pagination
  const [currentBattleIndex, setCurrentBattleIndex] = useState(0);

  // Previous battles (archived)
  const [previousBattles, setPreviousBattles] = useState([]);
  const [showPreviousBattles, setShowPreviousBattles] = useState(false);
  const [selectedPreviousBattle, setSelectedPreviousBattle] = useState(null);

  // Challenge state - UPDATED FOR TAB SYSTEM
  const [userChallenges, setUserChallenges] = useState({ doubleDown: null, marketClose: null });
  const [opponentChallenges, setOpponentChallenges] = useState({ doubleDown: null, marketClose: null });
  const [openChallengePanels, setOpenChallengePanels] = useState(new Set());

  // XP Progress Modal state
  const [showXPModal, setShowXPModal] = useState(false);

  // Track which assets are expanded in portfolio builder
  const [expandedAssets, setExpandedAssets] = useState(new Set());

  // Mobile battle view tab state
  const [battleViewTab, setBattleViewTab] = useState('yours');

  // Portfolio Manager Modal state
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);

  // Sidebar navigation state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // desktop sidebar collapsed by default

  // Game Mode state - Phase 1: Foundation
  // 'classic' = Builder 1v1 (existing gameplay)
  // 'draft' = Snake Draft 4P (new draft mode)
  const [gameMode, setGameMode] = useState('draft'); // Snake Draft is default

  // Draft Mode state - Phase 2
  const [currentDraft, setCurrentDraft] = useState(null);
  const [draftJoinCode, setDraftJoinCode] = useState('');

  // Draft Lobby/Room state - Phase 3
  const [draftState, setDraftState] = useState(null);
  const [draftCopied, setDraftCopied] = useState(false);
  const [selectedDraftCategory, setSelectedDraftCategory] = useState('neutral');
  const [draftTimeRemaining, setDraftTimeRemaining] = useState(120);
  const [draftAssetInfoModal, setDraftAssetInfoModal] = useState(null); // Asset to show info for

  // Draft Battle state - Phase 4
  const [draftBattleOpponent, setDraftBattleOpponent] = useState(null);

  // Draft Fixes state
  const [activeDraftBanner, setActiveDraftBanner] = useState(null);
  // BaggerBomb V3 active battle banner
  const [activeBaggerBombBanner, setActiveBaggerBombBanner] = useState(null);
  const [autopickCountdown, setAutopickCountdown] = useState(null);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [rosterTouchStart, setRosterTouchStart] = useState(null);
  const [rosterTouchEnd, setRosterTouchEnd] = useState(null);

  // Confirmation popup states
  const [showCreateBattleConfirm, setShowCreateBattleConfirm] = useState(false);
  const [showJoinBattleConfirm, setShowJoinBattleConfirm] = useState(false);
  const [showClassicTrainingConfirm, setShowClassicTrainingConfirm] = useState(false);
  const [showBaggerBombTrainingConfirm, setShowBaggerBombTrainingConfirm] = useState(false); // NEW: Separate BaggerBomb training
  const [showCreateDraftConfirm, setShowCreateDraftConfirm] = useState(false);
  const [showJoinDraftConfirm, setShowJoinDraftConfirm] = useState(false);
  const [showCreateBaggerBombBattleConfirm, setShowCreateBaggerBombBattleConfirm] = useState(false);
  const [showJoinBaggerBombBattleConfirm, setShowJoinBaggerBombBattleConfirm] = useState(false);
  // NEW: Unified game modals for COMPETE carousel
  const [showSnakeDraftModal, setShowSnakeDraftModal] = useState(false);
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [showBaggerBombModal, setShowBaggerBombModal] = useState(false);
  // BaggerBomb Lobby state
  const [lobbyBattles, setLobbyBattles] = useState([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [battleToJoin, setBattleToJoin] = useState(null); // Battle ID when joining from lobby
  const [showOptionsArenaModal, setShowOptionsArenaModal] = useState(false);
  // BaggerBomb Scoring battle mode selection in create battle confirmation
  const [battleScoringMode, setBattleScoringMode] = useState('classic'); // 'classic' | 'baggerbomb'
  // Training Mode battle type selection
  const [trainingBattleType, setTrainingBattleType] = useState('classic'); // 'classic' | 'baggerbomb'
  // Join Battle type selection
  const [joinBattleType, setJoinBattleType] = useState('classic'); // 'classic' | 'baggerbomb'

  // Tutorial modal states
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialMode, setTutorialMode] = useState('classic'); // 'classic' | 'draft' | 'training' | 'draftTraining'
  const [tutorialStep, setTutorialStep] = useState(0);

  // Spotlight Tour State (replaces old Get Started modal)
  const [showSpotlightTour, setShowSpotlightTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Forge state (replaces Academy)
  const [showForge, setShowForge] = useState(false);

  // Desktop background state
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth > 768);

  // Weekly Challenges State
  const [showWeeklyChallenges, setShowWeeklyChallenges] = useState(false);
  const [weeklyChallenges, setWeeklyChallenges] = useState([]);
  const [activeDailyChallenge, setActiveDailyChallenge] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState({});
  const [completedWeeklyChallenges, setCompletedWeeklyChallenges] = useState([]);
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [slotMachineRevealed, setSlotMachineRevealed] = useState(false);
  const slotMachineTriggeredRef = useRef(false); // Session-level guard to prevent multiple triggers
  const processedV4BattlesRef = useRef(new Set()); // Track V4 battles already sent for completion processing
  const [expandedChallengeId, setExpandedChallengeId] = useState(null);
  const [showChallengeToast, setShowChallengeToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [challengeHistory, setChallengeHistory] = useState([]);
  const [weeklyChallengesChecked, setWeeklyChallengesChecked] = useState(false); // Session-level flag

  // ⭐ Mid-Game Challenge System
  const [midGameChallengePopup, setMidGameChallengePopup] = useState(null); // { id, title, description, xp }
  const [earnedMidGameChallenges, setEarnedMidGameChallenges] = useState({}); // { battleId: ['challenge_id1', 'challenge_id2'] }

  // ⭐ Interactive Risk Challenges System
  const [activeRiskChallenge, setActiveRiskChallenge] = useState(null); // Current risk challenge data
  const [showRiskChallengePopup, setShowRiskChallengePopup] = useState(false); // Show challenge popup
  const [riskChallengeResult, setRiskChallengeResult] = useState(null); // { challenge, result } for result popup
  const [triggeredRiskChallenges, setTriggeredRiskChallenges] = useState({}); // { battleId: [triggerPercent1, triggerPercent2] }

  // ============================================
  // NOTIFICATIONS STATE
  // ============================================
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // ============================================
  // TOAST NOTIFICATION STATE
  // ============================================
  const [toast, setToast] = useState(null);

  // Toast helper function
  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ============================================
  // PORTFOLIO TEMPLATES STATE
  // ============================================
  const [portfolioTemplates, setPortfolioTemplates] = useState([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // ============================================
  // WEEK AHEAD CALENDAR STATE
  // ============================================
  const [showWeekAhead, setShowWeekAhead] = useState(false);
  const [weekAheadEvents, setWeekAheadEvents] = useState([]);
  const [weekAheadEarnings, setWeekAheadEarnings] = useState([]);
  const [weekAheadHolidays, setWeekAheadHolidays] = useState([]);
  const [weekAheadLoading, setWeekAheadLoading] = useState(false);
  const [weekAheadRange, setWeekAheadRange] = useState({ start: null, end: null, isNextWeek: false });
  const [expandedEventId, setExpandedEventId] = useState(null);

  // ============================================
  // REMATCH STATE
  // ============================================
  const [pendingRematch, setPendingRematch] = useState(null);
  const [showRematchModal, setShowRematchModal] = useState(false);
  const [rematchRequest, setRematchRequest] = useState(null);

  // ============================================
  // TRAINING CONFIRM MODAL STATE
  // ============================================
  const [showTrainingConfirmModal, setShowTrainingConfirmModal] = useState(false);
  const [trainingConfirmType, setTrainingConfirmType] = useState('stocks');

  // ============================================
  // HIGH VOLATILITY ALERT STATE
  // ============================================
  const [upcomingHighImpactEvents, setUpcomingHighImpactEvents] = useState([]);
  const [showVolatilityAlert, setShowVolatilityAlert] = useState(false);

  // ============================================
  // NOTIFICATION HELPER FUNCTIONS
  // ============================================

  // System templates for portfolios
  const SYSTEM_PORTFOLIO_TEMPLATES = [
    {
      id: 'sys_tech_giants',
      name: 'Tech Giants',
      description: 'Top technology companies',
      type: 'stocks',
      assets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
      icon: '💻',
      isSystem: true
    },
    {
      id: 'sys_blue_chip',
      name: 'Blue Chip Mix',
      description: 'Stable, established companies',
      type: 'stocks',
      assets: ['JNJ', 'JPM', 'PG', 'KO', 'V'],
      icon: '🏛️',
      isSystem: true
    },
    {
      id: 'sys_growth',
      name: 'High Growth',
      description: 'High-growth momentum stocks',
      type: 'stocks',
      assets: ['NVDA', 'TSLA', 'AMD', 'CRM', 'SHOP'],
      icon: '🚀',
      isSystem: true
    },
    {
      id: 'sys_crypto_majors',
      name: 'Crypto Majors',
      description: 'Top cryptocurrency by market cap',
      type: 'crypto',
      assets: ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'],
      icon: '🪙',
      isSystem: true
    },
    {
      id: 'sys_defi',
      name: 'DeFi Leaders',
      description: 'Decentralized finance tokens',
      type: 'crypto',
      assets: ['UNI', 'AAVE', 'LINK', 'MKR', 'SNX'],
      icon: '🔗',
      isSystem: true
    },
    {
      id: 'sys_meme',
      name: 'Meme Coins',
      description: 'High-risk community tokens',
      type: 'crypto',
      assets: ['DOGE', 'SHIB', 'PEPE', 'BONK', 'FLOKI'],
      icon: '🐕',
      isSystem: true
    }
  ];

  // Notification type config
  const NOTIFICATION_TYPES = {
    // Existing types
    rematch_request: { icon: '⚔️', color: '#f59e0b', title: 'Rematch Request' },
    rematch_accepted: { icon: '✅', color: '#22c55e', title: 'Rematch Accepted' },
    rematch_declined: { icon: '❌', color: '#ef4444', title: 'Rematch Declined' },
    battle_result: { icon: '🏆', color: '#8b5cf6', title: 'Battle Complete' },
    flash_challenge: { icon: '⚡', color: '#f59e0b', title: 'Flash Challenge' },
    price_alert: { icon: '📈', color: '#22c55e', title: 'Price Alert' },
    event_reminder: { icon: '📅', color: '#3b82f6', title: 'Event Reminder' },
    challenge_unlocked: { icon: '🎯', color: '#ec4899', title: 'Challenge Unlocked' },
    streak_milestone: { icon: '🔥', color: '#f97316', title: 'Streak Milestone' },
    xp_earned: { icon: '⭐', color: '#eab308', title: 'XP Earned' },
    rank_up: { icon: '🎖️', color: '#6366f1', title: 'Rank Up' },
    friend_battle: { icon: '👋', color: '#06b6d4', title: 'Friend Battle' },
    system: { icon: '📢', color: '#8b949e', title: 'System' },

    // BaggerBomb Scoring - Breakout events
    breakout: { icon: '🎯', color: '#10b981', title: 'Breakout!' },
    rally: { icon: '🚀', color: '#f59e0b', title: 'Rally!' },
    moonshot: { icon: '🌙', color: '#8b5cf6', title: 'Moonshot!' },
    bust: { icon: '📉', color: '#ef4444', title: 'Bust' },
    crash: { icon: '💥', color: '#dc2626', title: 'Crash' },
    meltdown: { icon: '🔥', color: '#991b1b', title: 'Meltdown' },

    // BaggerBomb Scoring - Session events
    session_start: { icon: '⏱️', color: '#3b82f6', title: 'Session Started' },
    session_complete: { icon: '✓', color: '#10b981', title: 'Session Complete' },
    session_win: { icon: '🏆', color: '#f59e0b', title: 'Session Won!' },
    session_loss: { icon: '😤', color: '#ef4444', title: 'Session Lost' },

    // BaggerBomb Scoring - Battle events
    battle_lead_change: { icon: '📊', color: '#8b5cf6', title: 'Lead Change' },
    green_sweep: { icon: '💚', color: '#10b981', title: 'Green Sweep!' },
    clean_sweep: { icon: '🧹', color: '#f59e0b', title: 'Clean Sweep!' },
    battle_complete: { icon: '🏁', color: '#3b82f6', title: 'Battle Complete' },
    battle_victory: { icon: '🏆', color: '#10b981', title: 'Victory!' },
    battle_defeat: { icon: '😤', color: '#ef4444', title: 'Defeat' },

    // BaggerBomb Scoring - Substitution events
    sub_window_open: { icon: '🔄', color: '#8b5cf6', title: 'Sub Window Open' },
    sub_window_closing: { icon: '⏰', color: '#f59e0b', title: 'Window Closing' },
    substitution_made: { icon: '↔️', color: '#3b82f6', title: 'Substitution Made' },

    // BaggerBomb Scoring - Opponent events
    opponent_breakout: { icon: '⚠️', color: '#f59e0b', title: 'Opponent Breakout' },
    opponent_substitution: { icon: '👀', color: '#6b7280', title: 'Opponent Sub' }
  };

  // Load notifications from localStorage
  const loadNotifications = () => {
    try {
      const storageKey = `notifications_${user?.uid || user?.username}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications?.filter(n => !n.read).length || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Save notifications to localStorage
  const saveNotifications = (newNotifications) => {
    try {
      const storageKey = `notifications_${user?.uid || user?.username}`;
      localStorage.setItem(storageKey, JSON.stringify({ notifications: newNotifications }));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  // Add a new notification
  const addNotification = (type, title, body, data = {}) => {
    const newNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      body,
      data,
      read: false,
      createdAt: new Date().toISOString()
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, 50); // Keep last 50
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(prev => prev + 1);
  };

  // Mark notification as read
  const markNotificationRead = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all notifications as read
  const markAllNotificationsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(0);
  };

  // Delete notification
  const deleteNotification = (notificationId) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === notificationId);
      const updated = prev.filter(n => n.id !== notificationId);
      saveNotifications(updated);
      if (notif && !notif.read) {
        setUnreadCount(p => Math.max(0, p - 1));
      }
      return updated;
    });
  };

  // ============================================
  // PORTFOLIO TEMPLATES HELPER FUNCTIONS
  // ============================================

  // Load user's saved templates from localStorage
  const loadPortfolioTemplates = () => {
    try {
      const storageKey = `portfolioTemplates_${user?.uid || user?.username}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setPortfolioTemplates(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading portfolio templates:', error);
    }
  };

  // Save a new portfolio template
  const savePortfolioTemplate = (name, assets, type) => {
    try {
      const newTemplate = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        assets,
        type,
        createdAt: new Date().toISOString(),
        isSystem: false
      };

      setPortfolioTemplates(prev => {
        const updated = [...prev, newTemplate];
        const storageKey = `portfolioTemplates_${user?.uid || user?.username}`;
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });

      return newTemplate;
    } catch (error) {
      console.error('Error saving portfolio template:', error);
      return null;
    }
  };

  // Delete a user template
  const deletePortfolioTemplate = (templateId) => {
    setPortfolioTemplates(prev => {
      const updated = prev.filter(t => t.id !== templateId);
      const storageKey = `portfolioTemplates_${user?.uid || user?.username}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Load template into portfolio builder
  const loadTemplateToPortfolio = (template) => {
    // Get full asset data from stocksData or cryptoData
    const assetSource = template.type === 'stocks' ? stocksData : cryptoData;
    const portfolioAssets = template.assets
      .map(symbol => assetSource.find(a => a.symbol === symbol))
      .filter(Boolean)
      .slice(0, 5);

    if (portfolioAssets.length > 0) {
      setPortfolio(portfolioAssets);
      setPortfolioType(template.type);
      setAssetType(template.type);
      setShowTemplatesModal(false);
    }
  };

  // ============================================
  // WEEK AHEAD HELPER FUNCTIONS
  // ============================================

  // Get week range (Monday to Sunday)
  const getWeekRange = (showNextWeek = false) => {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Get Monday of current week
    let monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    // If weekend (Sat=6, Sun=0), show next week
    if (dayOfWeek === 0 || dayOfWeek === 6 || showNextWeek) {
      monday.setDate(monday.getDate() + 7);
    }

    // Get Sunday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      start: monday,
      end: sunday,
      isNextWeek: dayOfWeek === 0 || dayOfWeek === 6 || showNextWeek
    };
  };

  // Load Week Ahead data (dynamic events from EODHD API + earnings)
  const loadWeekAheadData = async () => {
    setWeekAheadLoading(true);
    setExpandedEventId(null);

    try {
      const range = getWeekRange();
      setWeekAheadRange(range);

      const fromStr = range.start.toISOString().split('T')[0];
      const toStr = range.end.toISOString().split('T')[0];

      console.log(`[WeekAhead] Loading data from ${fromStr} to ${toStr}`);

      // Get economic events from static data (manual file)
      try {
        const events = getWeekAheadEvents(fromStr, toStr);
        console.log(`[WeekAhead] Found ${events.length} economic events from static data`);
        setWeekAheadEvents(events);
      } catch (err) {
        console.error('[WeekAhead] Failed to load events:', err);
        setWeekAheadEvents([]);
      }

      // Get earnings from API
      try {
        const earningsRes = await fetch(`/api/week-ahead-earnings?from=${fromStr}&to=${toStr}`);
        if (earningsRes.ok) {
          const earningsData = await earningsRes.json();
          console.log(`[WeekAhead] Found ${earningsData.length} earnings`);
          setWeekAheadEarnings(earningsData);
        } else {
          console.log('[WeekAhead] No earnings data available');
          setWeekAheadEarnings([]);
        }
      } catch (err) {
        console.error('[WeekAhead] Failed to load earnings:', err);
        setWeekAheadEarnings([]);
      }

      // Holidays are now included in the API response (no separate fetch needed)
      setWeekAheadHolidays([]);

    } catch (error) {
      console.error('[WeekAhead] Error loading data:', error);
    } finally {
      setWeekAheadLoading(false);
    }
  };

  // Check for upcoming high-impact events (next 3 days) - uses static data
  const checkUpcomingHighImpactEvents = () => {
    try {
      const today = new Date();
      const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const fromStr = today.toISOString().split('T')[0];
      const toStr = threeDaysLater.toISOString().split('T')[0];

      const events = getWeekAheadEvents(fromStr, toStr);
      const highImpact = events.filter(e => e.impact === 'high');
      setUpcomingHighImpactEvents(highImpact);
      return highImpact;
    } catch (err) {
      console.error('[WeekAhead] Failed to check upcoming events:', err);
    }
    setUpcomingHighImpactEvents([]);
    return [];
  };

  // Get event impact color
  const getEventImpactColor = (impact) => {
    switch (impact) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  // Get event icon by type
  const getEventIcon = (type) => {
    const config = EVENT_TYPE_CONFIG[type];
    return config ? config.icon : '📅';
  };

  // Helper to extract just the date part from various formats
  // EODHD returns '2025-12-18 16:00:00' (space separator)
  // ISO format is '2025-12-18T16:00:00' (T separator)
  const extractDatePart = (dateInput) => {
    if (!dateInput) return null;
    const str = String(dateInput);
    // Check for space separator first (EODHD format), then T separator (ISO format)
    if (str.includes(' ')) return str.split(' ')[0];
    if (str.includes('T')) return str.split('T')[0];
    return str; // Already just a date
  };

  // Format date for display (handles both Date objects and ISO strings)
  const formatWeekDate = (dateInput) => {
    if (!dateInput) return 'N/A';

    let date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      // Handle string dates - extract date part and add noon to avoid timezone issues
      const dateStr = extractDatePart(dateInput);
      if (!dateStr) return 'N/A';
      date = new Date(dateStr + 'T12:00:00');
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('[WeekAhead] Invalid date in formatWeekDate:', dateInput);
      return 'Invalid';
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  };

  // Format date for API (ISO format)
  const formatDateForAPI = (date) => {
    return date instanceof Date ? date.toISOString().split('T')[0] : date;
  };

  // Get display info for a date
  const getDateDisplay = (dateStr) => {
    if (!dateStr) {
      console.error('[WeekAhead] getDateDisplay called with empty date');
      return { dayName: '???', dayNum: '?' };
    }

    // Handle different date formats - EODHD uses space, ISO uses T
    const cleanDateStr = extractDatePart(dateStr);
    if (!cleanDateStr) {
      console.error('[WeekAhead] Could not extract date from:', dateStr);
      return { dayName: '???', dayNum: '?' };
    }

    const date = new Date(cleanDateStr + 'T12:00:00');

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('[WeekAhead] Invalid date in getDateDisplay:', dateStr, '→', cleanDateStr);
      return { dayName: '???', dayNum: '?' };
    }

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return {
      dayName: days[date.getDay()],
      dayNum: date.getDate()
    };
  };

  // ============================================
  // REMATCH HELPER FUNCTIONS
  // ============================================

  // Send rematch request (stored in localStorage for demo)
  const sendRematchRequest = (battleId, opponentId, opponentUsername) => {
    try {
      const rematch = {
        id: `rematch_${Date.now()}`,
        battleId,
        fromUserId: user?.uid || user?.username,
        fromUsername: user?.username,
        toUserId: opponentId,
        toUsername: opponentUsername,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Save to localStorage (in real app, this would go to Firebase)
      const storageKey = `rematchRequests_${opponentId}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      localStorage.setItem(storageKey, JSON.stringify([...existing, rematch]));

      // Add notification for self
      addNotification('rematch_request', 'Rematch Sent!', `You challenged ${opponentUsername} to a rematch`, { battleId, opponentId });

      setPendingRematch(rematch);
      return rematch;
    } catch (error) {
      console.error('Error sending rematch request:', error);
      return null;
    }
  };

  // Check for incoming rematch requests
  const checkRematchRequests = () => {
    try {
      const storageKey = `rematchRequests_${user?.uid || user?.username}`;
      const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const pending = requests.filter(r => r.status === 'pending');
      if (pending.length > 0) {
        setRematchRequest(pending[0]);
        setShowRematchModal(true);
      }
    } catch (error) {
      console.error('Error checking rematch requests:', error);
    }
  };

  // Accept rematch request
  const acceptRematch = (rematchId) => {
    try {
      const storageKey = `rematchRequests_${user?.uid || user?.username}`;
      const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = requests.map(r =>
        r.id === rematchId ? { ...r, status: 'accepted' } : r
      );
      localStorage.setItem(storageKey, JSON.stringify(updated));

      // Add notification
      if (rematchRequest) {
        addNotification('rematch_accepted', 'Rematch Accepted!', `Starting rematch with ${rematchRequest.fromUsername}`, { rematchId });
      }

      setShowRematchModal(false);
      setRematchRequest(null);

      // Navigate to builder for rematch
      setBuilderMode('create');
      setScreen('builder');
    } catch (error) {
      console.error('Error accepting rematch:', error);
    }
  };

  // Decline rematch request
  const declineRematch = (rematchId) => {
    try {
      const storageKey = `rematchRequests_${user?.uid || user?.username}`;
      const requests = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = requests.filter(r => r.id !== rematchId);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      setShowRematchModal(false);
      setRematchRequest(null);
    } catch (error) {
      console.error('Error declining rematch:', error);
    }
  };

  // Toggle asset expansion
  const toggleAssetExpansion = (symbol) => {
    setExpandedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  };

  // ============================================
  // WEEKLY CHALLENGES - FIREBASE FUNCTIONS
  // ============================================

  // Show toast notification
  const showChallengeToastMessage = (message) => {
    setToastMessage(message);
    setShowChallengeToast(true);
    setTimeout(() => setShowChallengeToast(false), 3000);
  };

  // Load weekly challenges from localStorage (simplified for now)
  const loadWeeklyChallenges = async () => {
    try {
      const storageKey = `weeklyChallenges_${user?.odM || user?.username}`;
      const saved = localStorage.getItem(storageKey);
      const currentWeekStart = getWeekStartDate();
      let shouldShowSlotMachine = false;

      if (saved) {
        const data = JSON.parse(saved);

        // Check if we need to reset for new week
        if (data.weekStartDate !== currentWeekStart) {
          // New week - generate new challenges
          const newChallenges = selectWeeklyChallenges();
          const newData = {
            weekStartDate: currentWeekStart,
            challenges: newChallenges,
            activeDailyChallenge: null,
            progress: {},
            completedChallenges: [],
            slotMachineShown: false
          };
          localStorage.setItem(storageKey, JSON.stringify(newData));

          setWeeklyChallenges(newChallenges);
          setActiveDailyChallenge(null);
          setChallengeProgress({});
          setCompletedWeeklyChallenges([]);
          shouldShowSlotMachine = true; // Will show after delay
        } else {
          // Same week - load existing data
          setWeeklyChallenges(data.challenges || []);
          setActiveDailyChallenge(data.activeDailyChallenge);
          setChallengeProgress(data.progress || {});
          setCompletedWeeklyChallenges(data.completedChallenges || []);

          // Show slot machine only if it hasn't been shown this week
          if (!data.slotMachineShown) {
            shouldShowSlotMachine = true;
          }
        }
      } else {
        // No data exists - create initial
        const newChallenges = selectWeeklyChallenges();
        const newData = {
          weekStartDate: currentWeekStart,
          challenges: newChallenges,
          activeDailyChallenge: null,
          progress: {},
          completedChallenges: [],
          slotMachineShown: false
        };
        localStorage.setItem(storageKey, JSON.stringify(newData));

        setWeeklyChallenges(newChallenges);
        shouldShowSlotMachine = true; // Will show after delay
      }

      // Show slot machine with a delay to ensure app is fully rendered
      // Bulletproof guard using sessionStorage (survives component remounts)
      const sessionKey = `slotMachineShown_${user?.odM || user?.username}_session`;
      const alreadyShownThisSession = sessionStorage.getItem(sessionKey);

      if (shouldShowSlotMachine && !slotMachineTriggeredRef.current && !alreadyShownThisSession) {
        slotMachineTriggeredRef.current = true; // Mark as triggered
        sessionStorage.setItem(sessionKey, 'true');

        setTimeout(() => {
          setShowSlotMachine(true);
        }, 800); // Slightly longer delay for app to settle
      }
    } catch (error) {
      console.error('Error loading weekly challenges:', error);
    }
  };

  // Save weekly challenges to localStorage
  const saveWeeklyChallenges = (updates) => {
    try {
      const storageKey = `weeklyChallenges_${user?.odM || user?.username}`;
      const saved = localStorage.getItem(storageKey);
      const data = saved ? JSON.parse(saved) : {};
      const newData = { ...data, ...updates };
      localStorage.setItem(storageKey, JSON.stringify(newData));
    } catch (error) {
      console.error('Error saving weekly challenges:', error);
    }
  };

  // Accept a challenge for today
  const acceptChallenge = async (challenge) => {
    const acceptedChallenge = {
      ...challenge,
      acceptedDate: getTodayDateString(),
      acceptedAt: new Date().toISOString()
    };

    setActiveDailyChallenge(acceptedChallenge);
    saveWeeklyChallenges({ activeDailyChallenge: acceptedChallenge });
    showChallengeToastMessage(`Challenge Accepted: ${challenge.name}!`);
  };

  // Update challenge progress after battle
  const updateWeeklyChallengeProgress = async (battleResult, battleGameMode) => {
    if (!activeDailyChallenge) return;

    // Check if challenge applies to this game mode
    const challengeMode = activeDailyChallenge.gameMode;
    if (challengeMode !== 'universal' && challengeMode !== battleGameMode) {
      return;
    }

    let newProgress = { ...challengeProgress };
    const challengeId = activeDailyChallenge.id;
    const currentProgress = newProgress[challengeId] || 0;

    // Calculate progress based on challenge type
    switch (activeDailyChallenge.type) {
      case 'wins':
        if (battleResult.won) {
          newProgress[challengeId] = currentProgress + 1;
        }
        break;
      case 'completions':
        newProgress[challengeId] = currentProgress + 1;
        break;
      case 'win_streak':
        if (battleResult.won) {
          newProgress[challengeId] = currentProgress + 1;
        } else {
          newProgress[challengeId] = 0;
        }
        break;
      case 'green_assets':
        if (battleResult.won && battleResult.greenAssetCount >= activeDailyChallenge.target) {
          newProgress[challengeId] = activeDailyChallenge.target;
        }
        break;
      case 'all_green':
        if (battleResult.won && battleResult.allAssetsGreen) {
          newProgress[challengeId] = 1;
        }
        break;
      case 'positive_return':
        if (battleResult.returnPercent > 0) {
          newProgress[challengeId] = 1;
        }
        break;
      case 'total_completions':
        newProgress[challengeId] = currentProgress + 1;
        break;
      case 'total_wins':
        if (battleResult.won) {
          newProgress[challengeId] = currentProgress + 1;
        }
        break;
      case 'top_half_finish':
        if (battleResult.position <= 2) {
          newProgress[challengeId] = 1;
        }
        break;
      default:
        break;
    }

    setChallengeProgress(newProgress);

    // Check if challenge is completed
    if (newProgress[challengeId] >= activeDailyChallenge.target) {
      const xpReward = activeDailyChallenge.xp;

      // Add to completed challenges
      const completedChallenge = {
        ...activeDailyChallenge,
        completedAt: new Date().toISOString(),
        completedDate: getTodayDateString()
      };

      const newCompleted = [...completedWeeklyChallenges, completedChallenge];
      setCompletedWeeklyChallenges(newCompleted);

      // Add to history
      const newHistory = [...challengeHistory, { ...completedChallenge, type: 'weekly' }];
      setChallengeHistory(newHistory);

      // Update user XP
      if (user) {
        const newXP = (user.xp || 0) + xpReward;
        updateUser({ xp: newXP });
      }

      saveWeeklyChallenges({
        completedChallenges: newCompleted,
        progress: newProgress
      });
      localStorage.setItem(`challengeHistory_${user?.odM || user?.username}`, JSON.stringify(newHistory));

      showChallengeToastMessage(`Challenge Complete: ${activeDailyChallenge.name}! +${xpReward} XP`);

      // Check for weekly bonus (all 4 completed)
      if (newCompleted.length === 4) {
        setTimeout(() => {
          const bonusXP = CHALLENGE_XP.weeklyBonus;
          if (user) {
            updateUser({ xp: (user.xp || 0) + xpReward + bonusXP });
          }
          showChallengeToastMessage(`WEEKLY BONUS! All challenges complete! +${bonusXP} XP`);
        }, 3500);
      }
    } else {
      saveWeeklyChallenges({ progress: newProgress });
    }
  };

  // Mark slot machine as shown
  const markSlotMachineShown = () => {
    saveWeeklyChallenges({ slotMachineShown: true });
  };

  // ============================================
  // 2. ALL USEEFFECTS (AT TOP LEVEL)
  // ============================================

  // Navigate to dashboard when user is loaded from context (on mount)
  useEffect(() => {
    if (user && !userLoading && screen === 'home') {
      setScreen('dashboard');
    }
  }, [user, userLoading]);

  // Handle window resize for desktop background
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle training mode redirect - redirect 'training' screen to builder
  useEffect(() => {
    if (screen === 'training') {
      setBuilderMode('training');
      setScreen('builder');
    }
  }, [screen]);

  // Load weekly challenges when user logs in - RUNS ONCE PER SESSION
  useEffect(() => {
    return; // TEMPORARILY DISABLED — weekly challenges + slot machine
    // Use stable string values instead of object reference
    const userId = user?.odM || user?.username;

    // Only run if user is logged in AND we haven't checked this session
    if (userId && !weeklyChallengesChecked) {
      setWeeklyChallengesChecked(true); // Mark as checked for this session
      loadWeeklyChallenges();

      // Also load challenge history
      const historyKey = `challengeHistory_${userId}`;
      const savedHistory = localStorage.getItem(historyKey);
      if (savedHistory) {
        setChallengeHistory(JSON.parse(savedHistory));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.odM, user?.username, weeklyChallengesChecked]);

  // Load notifications and portfolio templates when user logs in
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadPortfolioTemplates();
      // Check for rematch requests
      checkRematchRequests();
    }
  }, [user]);

  // ═══════════════════════════════════════════════════════════════
  // CONSOLIDATION: Redirect Classic modals to BaggerBomb
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    // Redirect Classic training to BaggerBomb training
    if (showClassicTrainingConfirm) {
      setShowClassicTrainingConfirm(false);
      setShowBaggerBombTrainingConfirm(true);
    }
  }, [showClassicTrainingConfirm]);

  useEffect(() => {
    // Redirect Builder modal to BaggerBomb modal
    if (showBuilderModal) {
      setShowBuilderModal(false);
      setShowBaggerBombModal(true);
    }
  }, [showBuilderModal]);

  // Load market data on mount (pauses when tab is hidden)
  useEffect(() => {
    if (!isPageVisible) return;

    async function loadMarketData() {
      setLoadingMarketData(true);

      try {
        // Fetch real stock prices
        const stocks = await stockAPI.getPopularStocks();
        setStocksData(stocks);

        // Fetch real crypto prices
        const crypto = await stockAPI.getPopularCrypto();
        setCryptoData(crypto);
      } catch (error) {
        console.error('Error loading market data:', error);
        setStocksData([]);
        setCryptoData([]);
        showToast('Failed to load market data. Please try again.');
      }

      setLoadingMarketData(false);
    }

    loadMarketData();

    // Refresh prices every 5 minutes
    const interval = setInterval(loadMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isPageVisible]);

  // Load battles from localStorage on mount
  useEffect(() => {
    const saved = loadBattlesSafe();
    if (saved.length > 0) {
      // Clean up old waiting battles (older than 24 hours)
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const cleaned = saved.filter(b => {
        // Keep active and completed battles
        if (b.status !== 'waiting') return true;
        
        // Keep recent waiting battles
        const createdAt = new Date(b.createdAt).getTime();
        return createdAt > oneDayAgo;
      });
      
      // Only update if we actually removed some
      if (cleaned.length !== saved.length) {
        console.log(`🧹 Cleaned up ${saved.length - cleaned.length} old battles`);
        saveBattlesSafe(cleaned);
        setBattles(cleaned);
      } else {
        setBattles(saved);
      }
    }
  }, []);

  // Persist battles to localStorage whenever they change
  useEffect(() => {
    const saved = loadBattlesSafe();
    if (!isSameBattles(battles, saved)) {
      saveBattlesSafe(battles);
    }
  }, [battles]);

  // Subscribe to all game lobbies (BaggerBomb + Snake Draft) for dashboard and lobby screens
  useEffect(() => {
    // Subscribe on dashboard or lobby screens to show open lobbies in LiveFeed
    const shouldSubscribe = screen === 'dashboard' || screen === 'baggerBombLobby';

    if (!shouldSubscribe || !isPageVisible) {
      return;
    }

    setLobbyLoading(true);

    // Use combined subscription for all game types
    const unsubscribe = subscribeToAllLobbies((lobbies) => {
      setLobbyBattles(lobbies);
      setLobbyLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [screen, isPageVisible]);

  // Subscribe to Firestore battle updates for real-time sync (pauses when tab is hidden)
  useEffect(() => {
    if (!user || !isPageVisible) return;

    const userId = user.odUserId || user.username;
    if (!userId) return;

    console.log('🔥 Subscribing to Firestore battle updates for:', userId);

    const unsubscribe = subscribeToBattles(userId, (firestoreBattles) => {
      console.log('📥 Received Firestore battle update:', firestoreBattles.length, 'battles');
      debugBattles('Firebase incoming', firestoreBattles);

      // Convert Firestore format to local format
      const convertedBattles = firestoreBattles.map(fb => ({
        id: fb.id,
        challengeCode: fb.challengeCode,
        creator: fb.creator?.username || fb.creator,
        creatorPortfolio: fb.creator?.portfolio || fb.creatorPortfolio,
        bench: fb.creator?.bench || fb.bench,
        portfolioName: fb.creator?.portfolioName || fb.portfolioName,
        portfolioType: fb.creator?.portfolioType || fb.portfolioType,
        opponent: fb.opponent?.username || fb.opponent,
        opponentPortfolio: fb.opponent?.portfolio || fb.opponentPortfolio,
        status: fb.state?.status || fb.status,
        startDate: fb.timing?.scheduledStart || fb.timeline?.startDate || fb.startDate,
        endDate: fb.timing?.scheduledEnd || fb.timeline?.endDate || fb.endDate,
        createdAt: fb.timing?.createdAt || fb.timeline?.createdAt || fb.createdAt,
        startingPrices: fb.state?.startingPrices || fb.startingPrices,
        firestoreId: fb.id,
        _v: Number(fb._v) || 1, // Preserve version marker (ensure numeric)
        type: fb.type, // Preserve battle type for V3
        // Preserve full V3 structure for BaggerBomb battles
        ...(fb._v >= 2 && {
          creator: fb.creator,
          opponent: fb.opponent,
          timing: fb.timing,
          state: fb.state,
          thresholds: fb.thresholds,
          sessionScores: fb.sessionScores,
          events: fb.events,
          liveScoreUpdatedAt: fb.liveScoreUpdatedAt,
        }),
        _source: 'firestore' // Mark source for debugging
      }));

      // Merge with local battles (prefer Firestore data for matching IDs)
      setBattles(prevBattles => {
        debugBattles('Before Firebase merge', prevBattles);

        // Use a Map to deduplicate by ID, keyed by firestoreId
        const battleMap = new Map();

        // First add ALL local battles (including training battles that don't sync to Firestore)
        prevBattles.forEach(battle => {
          const key = battle.firestoreId || battle.id;
          battleMap.set(key, { ...battle, _source: battle._source || 'local' });
        });

        // Then merge Firestore battles (update existing, add new)
        convertedBattles.forEach(battle => {
          const existingBattle = battleMap.get(battle.id);
          if (existingBattle) {
            // Merge: keep local fields, update with Firestore data
            // Firestore creator/opponent always win (contain latest liveScore)
            battleMap.set(battle.id, {
              ...existingBattle,
              ...battle,
              creator: battle.creator ?? existingBattle.creator,
              opponent: battle.opponent ?? existingBattle.opponent,
              _source: 'firestore'
            });
          } else {
            // New battle from Firestore
            battleMap.set(battle.id, battle);
          }
        });

        const mergedBattles = Array.from(battleMap.values());
        debugBattles('After Firebase merge', mergedBattles);

        // Always save to localStorage when Firestore data arrives
        // (ensures liveScore and other data updates are persisted)
        saveBattlesSafe(mergedBattles);

        return mergedBattles;
      });
    });

    return () => {
      console.log('🔥 Unsubscribing from Firestore battle updates');
      unsubscribe();
    };
  }, [user, isPageVisible]);

  // Combined draft poll — single user-scoped query replaces separate draft battles + active draft banner polls
  useEffect(() => {
    if (screen !== 'dashboard' || !isPageVisible || !user) return;

    const fetchDraftData = async () => {
      try {
        const userId = user.odUserId || user.username;
        if (!userId) return;

        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const { db } = await import('./firebase/config');

        // Single query: get all user's non-completed drafts
        const draftsRef = collection(db, 'drafts');
        const q = query(
          draftsRef,
          where('playerIds', 'array-contains', userId),
          where('status', 'in', ['waiting', 'active', 'battle']),
          limit(10)
        );
        const snapshot = await getDocs(q);
        trackRead('draftPoll', snapshot.size);
        const userDrafts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Split results for both consumers
        const now = new Date();

        // 1) Draft battles (status === 'battle') — feeds dashboard battle cards
        const battleDrafts = userDrafts.filter(d => d.status === 'battle');
        const activeBattles = battleDrafts.filter(b => {
          if (!b.battleEndTime) return true;
          return new Date(b.battleEndTime) > now;
        });
        activeBattles.sort((a, b) => {
          const aEnd = new Date(a.battleEndTime || 0);
          const bEnd = new Date(b.battleEndTime || 0);
          return aEnd - bEnd;
        });
        setActiveDraftBattles(activeBattles);

        // Auto-complete expired draft battles
        const expiredBattles = battleDrafts.filter(b =>
          b.battleEndTime && new Date(b.battleEndTime) <= now
        );
        if (expiredBattles.length > 0) {
          const draftService = await import('./services/draftService');
          for (const battle of expiredBattles) {
            if (draftService.completeDraftBattle) {
              await draftService.completeDraftBattle(battle.id, battle);
            }
          }
        }

        // 2) Active drafts (waiting/active) — feeds active draft banner
        const activeDrafts = userDrafts.filter(d => d.status === 'waiting' || d.status === 'active');
        const activeDraft = activeDrafts.find(d => d.status === 'active') || activeDrafts[0] || null;
        setActiveDraftBanner(activeDraft);
      } catch (error) {
        console.error('[DraftPoll] query failed:', error);
        setActiveDraftBattles([]);
        setActiveDraftBanner(null);
      }
    };

    fetchDraftData();
    const interval = setInterval(fetchDraftData, 120_000); // 120s instead of 30s
    return () => clearInterval(interval);
  }, [screen, user, isPageVisible]);

  // Helper: calculate training battle score for a portfolio (mirrors ClashCardTrainingV4)
  function calculateTrainingScore(portfolio, endingPrices, startingPrices) {
    const flat = flattenPortfolio(portfolio);
    let total = 0;
    flat.forEach(asset => {
      if (!asset) return;
      const openPrice = startingPrices[asset.symbol] || asset.price || 0;
      const currentPrice = endingPrices[asset.symbol] || openPrice;
      if (!openPrice) return;
      const pctChange = ((currentPrice - openPrice) / openPrice) * 100;
      const score = calculateAssetScoreV3(asset, pctChange, { maxMultiplier: 0, minMultiplier: 0 });
      total += score.totalPoints;
    });
    return Math.round(total);
  }

  // ⭐ Fetch training battles from Firebase (persists across sessions, pauses when tab hidden)
  useEffect(() => {
    if (screen !== 'dashboard' || !isPageVisible) return;

    const fetchTrainingBattles = async () => {
      try {
        const currentUserId = user?.odUserId || user?.username;
        if (!currentUserId) return;

        const { collection, query, where, getDocs, doc, updateDoc, limit } = await import('firebase/firestore');
        const { db } = await import('./firebase/config');

        // Query Firebase for training battles where user is a player
        const trainingRef = collection(db, 'trainingBattles');
        const q = query(
          trainingRef,
          where('playerIds', 'array-contains', currentUserId),
          where('state.status', 'in', ['active', 'waiting']),
          limit(10)
        );

        const snapshot = await getDocs(q);
        trackRead('trainingPoll', snapshot.size);

        const allBattles = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        // Filter out expired battles and complete them
        const now = new Date();
        const activeBattles = [];
        const expiredBattles = [];

        for (const battle of allBattles) {
          const endTime = battle.timeline?.endDate ? new Date(battle.timeline.endDate) : null;
          if (endTime && endTime <= now) {
            expiredBattles.push(battle);
          } else {
            activeBattles.push(battle);
          }
        }

        // Auto-complete expired training battles with final scores
        for (const battle of expiredBattles) {
          try {
            // Calculate final scores using ending prices
            const endingPrices = await fetchCurrentPricesForBattle(battle);
            const startingPrices = battle.state?.startingPrices || battle.pricing?.baselinePrices || {};

            const creatorScore = calculateTrainingScore(battle.creator?.portfolio, endingPrices, startingPrices);
            const opponentScore = calculateTrainingScore(battle.opponent?.portfolio, endingPrices, startingPrices);

            const creatorUsername = battle.creator?.username || 'Player';
            const opponentUsername = battle.opponent?.username || 'CPU Opponent';
            const creatorWon = creatorScore >= opponentScore;

            await updateDoc(doc(db, 'trainingBattles', battle.id), {
              'state.status': 'completed',
              'timeline.completedAt': now.toISOString(),
              endingPrices,
              result: {
                winner: creatorWon ? creatorUsername : opponentUsername,
                loser: creatorWon ? opponentUsername : creatorUsername,
                creatorScore,
                opponentScore,
                margin: Math.abs(creatorScore - opponentScore),
              },
              updatedAt: now.toISOString()
            });
            console.log('⏰ Auto-completed training battle with scores:', battle.id, `${creatorScore}-${opponentScore}`);
          } catch (err) {
            // Fallback: complete without scores if price fetch fails
            try {
              await updateDoc(doc(db, 'trainingBattles', battle.id), {
                'state.status': 'completed',
                'timeline.completedAt': now.toISOString(),
                updatedAt: now.toISOString()
              });
              console.log('⏰ Auto-completed training battle (no scores):', battle.id);
            } catch (innerErr) {
              console.error('Error completing expired battle:', innerErr);
            }
            console.error('Error calculating training battle scores:', err);
          }
        }

        // Sort by end time (soonest first)
        activeBattles.sort((a, b) => {
          const aEnd = new Date(a.timeline?.endDate || 0);
          const bEnd = new Date(b.timeline?.endDate || 0);
          return aEnd - bEnd;
        });

        setActiveTrainingBattles(activeBattles);
      } catch (error) {
        console.error('Error fetching training battles:', error);
        setActiveTrainingBattles([]);
      }
    };

    fetchTrainingBattles();

    // Refresh every 30 seconds
    const refreshInterval = setInterval(fetchTrainingBattles, 120_000);
    return () => clearInterval(refreshInterval);
  }, [screen, user, isPageVisible]);

  // ⭐ MID-GAME CHALLENGE CHECKING SYSTEM
  // Check for mid-game challenges periodically during active battles
  useEffect(() => {
    return; // TEMPORARILY DISABLED — mid-game challenge popup
    if (screen !== 'battle' || !currentBattle) return;

    const battleStatus = battleTimer.getBattleStatus(currentBattle);
    if (battleStatus !== 'active') return;

    const checkMidGameChallenges = async () => {
      try {
        const battleId = currentBattle.id;
        const userId = user?.odUserId || user?.username;
        if (!userId) return;

        // Get already earned challenges for this battle
        const alreadyEarned = earnedMidGameChallenges[battleId] || [];

        // Calculate battle progress
        const startTime = new Date(currentBattle.startDate);
        const endTime = new Date(currentBattle.endDate);
        const now = new Date();
        const totalDuration = endTime - startTime;
        const elapsed = now - startTime;
        const progressPercent = (elapsed / totalDuration) * 100;

        // Calculate current portfolio values
        const isCreator = currentBattle.creator === user?.username ||
                          currentBattle.creator?.username === user?.username ||
                          currentBattle.creator?.odUserId === user?.odUserId;

        // Get portfolios as flat arrays (V3-safe via portfolioHelpers)
        const { myPortfolio, theirPortfolio } = getBothPortfoliosFlat(currentBattle, user?.username);

        // Calculate gains using current battle prices
        let myTotalValue = 0;
        let theirTotalValue = 0;

        if (battlePrices && Object.keys(battlePrices).length > 0) {
          // User portfolio value
          for (const asset of myPortfolio) {
            if (!asset) continue;
            const startPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price || 1;
            const currentPrice = battlePrices[asset.symbol] || startPrice;
            const shares = (asset.amount || 0) / startPrice;
            const isShort = asset.position === 'short';

            if (isShort) {
              const priceChange = startPrice - currentPrice;
              myTotalValue += (asset.amount || 0) + (shares * priceChange);
            } else {
              myTotalValue += shares * currentPrice;
            }
          }

          // Opponent portfolio value
          for (const asset of theirPortfolio) {
            if (!asset) continue;
            const startPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price || 1;
            const currentPrice = battlePrices[asset.symbol] || startPrice;
            const shares = (asset.amount || 0) / startPrice;
            const isShort = asset.position === 'short';

            if (isShort) {
              const priceChange = startPrice - currentPrice;
              theirTotalValue += (asset.amount || 0) + (shares * priceChange);
            } else {
              theirTotalValue += shares * currentPrice;
            }
          }
        } else {
          myTotalValue = 1000000;
          theirTotalValue = 1000000;
        }

        const myGain = ((myTotalValue - 1000000) / 1000000) * 100;
        const theirGain = ((theirTotalValue - 1000000) / 1000000) * 100;
        const isLeading = myGain > theirGain;
        const leadAmount = myGain - theirGain;

        const newChallenges = [];

        // 🎯 HALFTIME LEAD CHECK (at ~50% duration)
        if (progressPercent >= 48 && progressPercent <= 55 && !alreadyEarned.includes('halftime_lead') && isLeading) {
          newChallenges.push({
            id: 'halftime_lead',
            title: '⏰ Leading at Halftime!',
            description: "You're ahead at the halfway mark",
            xp: 50
          });

          // Update Firebase to track halftime leader (for comeback challenge)
          if (currentBattle.isTrainingBattle || currentBattle.challengeCode === 'TRAINING') {
            try {
              const { doc, updateDoc } = await import('firebase/firestore');
              const { db } = await import('./firebase/config');
              await updateDoc(doc(db, 'trainingBattles', battleId), {
                halftimeLeader: userId,
                updatedAt: new Date().toISOString()
              });
            } catch (err) {
              console.error('Error updating halftime leader:', err);
            }
          }
        }

        // 🚀 BIG LEAD CHECK (leading by 5%+)
        if (leadAmount >= 5 && !alreadyEarned.includes('big_lead')) {
          newChallenges.push({
            id: 'big_lead',
            title: '🚀 Big Lead!',
            description: "You're dominating with a 5%+ lead",
            xp: 30
          });
        }

        // 📈 EARLY GAINS CHECK (10%+ gains before halftime)
        if (progressPercent < 50 && myGain >= 10 && !alreadyEarned.includes('early_gains')) {
          newChallenges.push({
            id: 'early_gains',
            title: '📈 Early Gains!',
            description: '10%+ gains before halftime',
            xp: 40
          });
        }

        // 🎯 STEADY LEAD CHECK (leading for 30+ minutes)
        // This would require tracking lead history - simplified version
        if (progressPercent >= 30 && isLeading && !alreadyEarned.includes('steady_lead')) {
          newChallenges.push({
            id: 'steady_lead',
            title: '🎯 Steady Lead!',
            description: 'Maintaining your lead strong',
            xp: 25
          });
        }

        // Award and show popup for new challenges
        if (newChallenges.length > 0) {
          const firstChallenge = newChallenges[0];

          // Update earned challenges state
          setEarnedMidGameChallenges(prev => ({
            ...prev,
            [battleId]: [...(prev[battleId] || []), ...newChallenges.map(c => c.id)]
          }));

          // Award XP
          const totalXP = newChallenges.reduce((sum, c) => sum + c.xp, 0);
          if (user) {
            updateUser({ xp: (user.xp || 0) + totalXP });
          }

          // Show popup
          setMidGameChallengePopup(firstChallenge);

          // Update Firebase with earned challenges
          if (currentBattle.isTrainingBattle || currentBattle.challengeCode === 'TRAINING') {
            try {
              const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
              const { db } = await import('./firebase/config');
              await updateDoc(doc(db, 'trainingBattles', battleId), {
                midGameChallenges: arrayUnion(...newChallenges.map(c => ({
                  id: c.id,
                  title: c.title,
                  xp: c.xp,
                  earnedAt: new Date().toISOString()
                }))),
                updatedAt: new Date().toISOString()
              });
            } catch (err) {
              console.error('Error saving mid-game challenges:', err);
            }
          }

          console.log('🎯 Mid-game challenges earned:', newChallenges.map(c => c.title));
        }
      } catch (error) {
        console.error('Error checking mid-game challenges:', error);
      }
    };

    // Check immediately and then every 30 seconds
    checkMidGameChallenges();
    const challengeInterval = setInterval(checkMidGameChallenges, 30000);
    return () => clearInterval(challengeInterval);
  }, [screen, currentBattle, battlePrices, user, earnedMidGameChallenges]);

  // ⭐ INTERACTIVE RISK CHALLENGES - Generation and Resolution
  // Helper: Get market close time (4 PM EST)
  const getMarketCloseTime = () => {
    const now = new Date();
    const marketClose = new Date(now);
    marketClose.setUTCHours(21, 0, 0, 0); // 4 PM EST = 21:00 UTC
    if (now > marketClose) {
      marketClose.setDate(marketClose.getDate() + 1);
    }
    return marketClose;
  };

  // Generate a risk challenge
  const generateRiskChallenge = async (battle, challengeTypeKey) => {
    const typeConfig = RISK_CHALLENGE_TYPES[challengeTypeKey];
    const now = new Date();

    let challengeData = {
      id: `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      battleId: battle.id,
      type: typeConfig.id,
      name: typeConfig.name,
      emoji: typeConfig.emoji,
      description: typeConfig.description,
      riskRewardPercent: typeConfig.riskRewardPercent,
      createdAt: now.toISOString(),
      acceptDeadline: new Date(now.getTime() + typeConfig.timeToAccept * 1000).toISOString(),
      status: 'pending',
      player1Response: null,
      player2Response: null,
      result: null,
    };

    // Add challenge-specific data
    try {
      switch (challengeTypeKey) {
        case 'SP_CLOSE':
          const spyData = await stockAPI.getStockPrice('SPY');
          challengeData.targetSymbol = 'SPY';
          challengeData.targetPrice = spyData.price;
          challengeData.question = `Will the S&P 500 close ABOVE or BELOW $${spyData.price.toFixed(2)}?`;
          challengeData.options = ['above', 'below'];
          challengeData.resolvesAt = getMarketCloseTime().toISOString();
          break;

        case 'DOUBLE_DOWN':
          challengeData.question = 'Pick one of your stocks to DOUBLE its weight for 1 hour';
          challengeData.resolvesAt = new Date(now.getTime() + 3600000).toISOString();
          challengeData.options = []; // Set per player based on their portfolio
          break;

        case 'STOCK_DUEL':
          const duelStocks = typeConfig.duelStocks;
          challengeData.question = 'Pick a stock to duel! Best performer in 1 hour wins';
          challengeData.options = duelStocks;
          challengeData.startPrices = {};
          for (const symbol of duelStocks) {
            try {
              const data = await stockAPI.getStockPrice(symbol);
              challengeData.startPrices[symbol] = data.price;
            } catch (e) {
              challengeData.startPrices[symbol] = 100; // Fallback
            }
          }
          challengeData.resolvesAt = new Date(now.getTime() + 3600000).toISOString();
          break;

        case 'CRYPTO_CALL':
          const btcData = await stockAPI.getCryptoPrice('bitcoin');
          challengeData.targetSymbol = 'BTC';
          challengeData.targetPrice = btcData.price;
          challengeData.question = `Will Bitcoin be HIGHER or LOWER than $${btcData.price.toLocaleString()} in 1 hour?`;
          challengeData.options = ['higher', 'lower'];
          challengeData.resolvesAt = new Date(now.getTime() + 3600000).toISOString();
          break;

        case 'STOCK_DIRECTION':
          const volatileStocks = typeConfig.volatileStocks;
          const randomStock = volatileStocks[Math.floor(Math.random() * volatileStocks.length)];
          const stockData = await stockAPI.getStockPrice(randomStock);
          challengeData.targetSymbol = randomStock;
          challengeData.targetPrice = stockData.price;
          challengeData.question = `Will ${randomStock} go UP or DOWN by market close?`;
          challengeData.options = ['up', 'down'];
          challengeData.resolvesAt = getMarketCloseTime().toISOString();
          break;
      }
    } catch (error) {
      console.error('Error generating challenge data:', error);
      return null;
    }

    return challengeData;
  };

  // Handle player response to risk challenge
  const respondToRiskChallenge = async (prediction) => {
    if (!activeRiskChallenge) return;

    const now = new Date();
    if (now > new Date(activeRiskChallenge.acceptDeadline)) {
      showToast('Challenge deadline has passed!');
      return;
    }

    const userId = user?.odUserId || user?.username;
    const isCreator = currentBattle?.creator === user?.username;

    // Get start price for double down
    let startPrice = null;
    if (activeRiskChallenge.type === 'double_down') {
      try {
        const data = await stockAPI.getStockPrice(prediction);
        startPrice = data.price;
      } catch (e) {
        startPrice = battlePrices?.[prediction] || 100;
      }
    }

    const response = {
      odUserId: userId,
      accepted: true,
      prediction,
      acceptedAt: now.toISOString(),
      startPrice,
    };

    // Update the challenge
    const updatedChallenge = { ...activeRiskChallenge };
    if (isCreator) {
      updatedChallenge.player1Response = response;
    } else {
      updatedChallenge.player2Response = response;
    }
    updatedChallenge.status = 'active';

    setActiveRiskChallenge(updatedChallenge);
    setShowRiskChallengePopup(false);

    // Save to localStorage for this battle
    const challengeKey = `riskChallenge_${currentBattle?.id}`;
    localStorage.setItem(challengeKey, JSON.stringify(updatedChallenge));

    // For training battles, trigger CPU response
    if (currentBattle?.isTrainingBattle || currentBattle?.challengeCode === 'TRAINING') {
      setTimeout(() => cpuRespondToRiskChallenge(updatedChallenge), 1500 + Math.random() * 2000);
    }

    showToast(`Challenge accepted! You predicted: ${prediction.toUpperCase()}`);
  };

  // CPU responds to risk challenge
  const cpuRespondToRiskChallenge = (challenge) => {
    // CPU has 70% chance to participate
    if (Math.random() > 0.7) return;

    let prediction;
    switch (challenge.type) {
      case 'sp_close':
      case 'stock_direction':
        prediction = Math.random() > 0.5 ? challenge.options[0] : challenge.options[1];
        break;
      case 'crypto_call':
        prediction = Math.random() > 0.5 ? 'higher' : 'lower';
        break;
      case 'stock_duel':
        prediction = challenge.options[Math.floor(Math.random() * challenge.options.length)];
        break;
      case 'double_down':
        // CPU picks from its portfolio (V3-safe)
        const cpuPortfolio = safePortfolioArray(currentBattle?.opponentPortfolio || currentBattle?.opponent?.portfolio);
        const cpuStocks = cpuPortfolio.filter(a => a.position !== 'short').map(a => a.symbol);
        if (cpuStocks.length > 0) {
          prediction = cpuStocks[Math.floor(Math.random() * cpuStocks.length)];
        } else {
          return; // Can't participate without stocks
        }
        break;
    }

    const updatedChallenge = { ...challenge };
    updatedChallenge.player2Response = {
      odUserId: 'cpu',
      accepted: true,
      prediction,
      acceptedAt: new Date().toISOString(),
      startPrice: challenge.type === 'double_down' ? (battlePrices?.[prediction] || 100) : null,
    };

    setActiveRiskChallenge(updatedChallenge);

    // Save to localStorage
    const challengeKey = `riskChallenge_${currentBattle?.id}`;
    localStorage.setItem(challengeKey, JSON.stringify(updatedChallenge));
  };

  // Resolve risk challenge
  const resolveRiskChallenge = async (challenge) => {
    if (!challenge || challenge.status === 'resolved') return;

    const result = {
      resolvedAt: new Date().toISOString(),
    };

    try {
      switch (challenge.type) {
        case 'sp_close':
        case 'stock_direction':
          const stockData = await stockAPI.getStockPrice(challenge.targetSymbol);
          result.actualPrice = stockData.price;
          result.actualDirection = stockData.price > challenge.targetPrice
            ? (challenge.type === 'sp_close' ? 'above' : 'up')
            : (challenge.type === 'sp_close' ? 'below' : 'down');
          break;

        case 'crypto_call':
          const btcData = await stockAPI.getCryptoPrice('bitcoin');
          result.actualPrice = btcData.price;
          result.actualDirection = btcData.price > challenge.targetPrice ? 'higher' : 'lower';
          break;

        case 'stock_duel':
          if (challenge.player1Response && challenge.player2Response) {
            const stock1 = challenge.player1Response.prediction;
            const stock2 = challenge.player2Response.prediction;
            const data1 = await stockAPI.getStockPrice(stock1);
            const data2 = await stockAPI.getStockPrice(stock2);
            const change1 = ((data1.price - challenge.startPrices[stock1]) / challenge.startPrices[stock1]) * 100;
            const change2 = ((data2.price - challenge.startPrices[stock2]) / challenge.startPrices[stock2]) * 100;

            result.player1Stock = stock1;
            result.player2Stock = stock2;
            result.player1StockChange = change1;
            result.player2StockChange = change2;
            result.actualDirection = change1 > change2 ? 'player1' : change2 > change1 ? 'player2' : 'tie';
          }
          break;

        case 'double_down':
          if (challenge.player1Response) {
            const stock = challenge.player1Response.prediction;
            const data = await stockAPI.getStockPrice(stock);
            const startPrice = challenge.player1Response.startPrice || challenge.startPrices?.[stock] || data.price;
            result.player1StockChange = ((data.price - startPrice) / startPrice) * 100;
            result.player1Won = result.player1StockChange > 0;
          }
          if (challenge.player2Response) {
            const stock = challenge.player2Response.prediction;
            const data = await stockAPI.getStockPrice(stock);
            const startPrice = challenge.player2Response.startPrice || data.price;
            result.player2StockChange = ((data.price - startPrice) / startPrice) * 100;
            result.player2Won = result.player2StockChange > 0;
          }
          break;
      }

      // Determine winners for prediction challenges
      if (challenge.type !== 'double_down' && challenge.type !== 'stock_duel') {
        result.player1Won = challenge.player1Response?.prediction === result.actualDirection;
        result.player2Won = challenge.player2Response?.prediction === result.actualDirection;
      } else if (challenge.type === 'stock_duel') {
        result.player1Won = result.actualDirection === 'player1';
        result.player2Won = result.actualDirection === 'player2';
      }

      // Calculate portfolio adjustments (based on $1M starting value)
      const swingPercent = challenge.riskRewardPercent / 100;
      const baseValue = 1000000;

      result.player1Adjustment = 0;
      result.player2Adjustment = 0;

      if (challenge.player1Response?.accepted) {
        result.player1Adjustment = result.player1Won
          ? Math.round(baseValue * swingPercent)
          : -Math.round(baseValue * swingPercent);
      }

      if (challenge.player2Response?.accepted) {
        result.player2Adjustment = result.player2Won
          ? Math.round(baseValue * swingPercent)
          : -Math.round(baseValue * swingPercent);
      }

    } catch (error) {
      console.error('Error resolving challenge:', error);
      return;
    }

    // Update challenge status
    const resolvedChallenge = {
      ...challenge,
      status: 'resolved',
      result,
    };

    // Save resolved challenge
    const challengeKey = `riskChallenge_${currentBattle?.id}`;
    localStorage.setItem(challengeKey, JSON.stringify(resolvedChallenge));

    // Show result popup
    setRiskChallengeResult({ challenge: resolvedChallenge, result });
    setActiveRiskChallenge(null);
  };

  // Check for new risk challenges and resolution
  useEffect(() => {
    if (screen !== 'battle' || !currentBattle) return;

    // Risk challenges disabled — feature hidden, may re-enable later
    return;

    const battleStatus = battleTimer.getBattleStatus(currentBattle);
    if (battleStatus !== 'active') return;

    const checkRiskChallenges = async () => {
      const battleId = currentBattle.id;

      // Load existing challenge from localStorage
      const challengeKey = `riskChallenge_${battleId}`;
      const savedChallenge = localStorage.getItem(challengeKey);

      if (savedChallenge) {
        const challenge = JSON.parse(savedChallenge);

        // Check if challenge needs resolution
        if (challenge.status === 'active' && new Date() >= new Date(challenge.resolvesAt)) {
          await resolveRiskChallenge(challenge);
          return;
        }

        // Check if challenge expired (no response before deadline)
        if (challenge.status === 'pending' && new Date() > new Date(challenge.acceptDeadline)) {
          localStorage.removeItem(challengeKey);
          setActiveRiskChallenge(null);
          return;
        }

        // Set active challenge if still valid
        if (challenge.status !== 'resolved') {
          setActiveRiskChallenge(challenge);
        }
        return;
      }

      // Check if we should generate a new challenge
      const startTime = new Date(currentBattle.startDate);
      const endTime = new Date(currentBattle.endDate);
      const totalDuration = endTime - startTime;
      const elapsed = new Date() - startTime;
      const progressPercent = (elapsed / totalDuration) * 100;

      // Determine schedule based on battle duration
      const durationHours = totalDuration / (1000 * 60 * 60);
      const schedule = durationHours <= 2 ? RISK_CHALLENGE_SCHEDULE['1h'] : RISK_CHALLENGE_SCHEDULE['24h'];

      // Get already triggered challenges for this battle
      const triggered = triggeredRiskChallenges[battleId] || [];

      for (const trigger of schedule) {
        // Within trigger window and not already triggered
        if (progressPercent >= trigger.triggerAtPercent &&
            progressPercent <= trigger.triggerAtPercent + 3 &&
            !triggered.includes(trigger.triggerAtPercent)) {

          // Pick random challenge type
          const challengeType = trigger.types[Math.floor(Math.random() * trigger.types.length)];
          const newChallenge = await generateRiskChallenge(currentBattle, challengeType);

          if (newChallenge) {
            setActiveRiskChallenge(newChallenge);
            setShowRiskChallengePopup(true);
            localStorage.setItem(challengeKey, JSON.stringify(newChallenge));

            // Mark as triggered
            setTriggeredRiskChallenges(prev => ({
              ...prev,
              [battleId]: [...(prev[battleId] || []), trigger.triggerAtPercent]
            }));

            console.log('🎯 New risk challenge generated:', newChallenge.name);
          }
          break;
        }
      }
    };

    // Check immediately and every 15 seconds
    checkRiskChallenges();
    const interval = setInterval(checkRiskChallenges, 15000);
    return () => clearInterval(interval);
  }, [screen, currentBattle, triggeredRiskChallenges]);

  // Fetch completed draft battles for history
  useEffect(() => {
    if (screen !== 'battleHistory' || historyTab !== 'draft') return;

    const fetchCompletedDraftBattles = async () => {
      try {
        const currentUserId = user?.odUserId || user?.username;
        if (!currentUserId) return;

        const draftService = await import('./services/draftService');
        const battles = await draftService.getUserCompletedDraftBattles(currentUserId, 50);

        // Transform to match expected format and sort by completion date
        // Filter out training drafts that leak through the query
        const formattedBattles = battles
          .filter(b => !b.isTraining)
          .map(b => {
            const myStanding = b.finalStandings?.find(s => s.odUserId === currentUserId);
            return {
              ...b,
              isDraft: true,
              won: myStanding?.finalRank === 1,
              myRank: myStanding?.finalRank || 0,
              myGain: myStanding?.finalGain || 0,
              completedAt: b.completedAt
                ? (b.completedAt?.toDate?.() || new Date(b.completedAt))
                : null
            };
          })
          .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

        setCompletedDraftBattles(formattedBattles);
      } catch (error) {
        console.error('Error fetching completed draft battles:', error);
        setCompletedDraftBattles([]);
      }
    };

    fetchCompletedDraftBattles();
  }, [screen, historyTab, user]);

  // Fetch completed training battles for history
  useEffect(() => {
    if (screen !== 'battleHistory' || historyTab !== 'training' || !user) return;

    const fetchTrainingBattles = async () => {
      setLoadingTrainingBattles(true);
      try {
        const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase/config');

        const currentUserId = user?.odUserId || user?.username;
        if (!currentUserId) {
          setCompletedTrainingBattles([]);
          return;
        }

        // Dual-field query: creatorId (V1 classic) + creator.odUserId (V3/V4/V5)
        const q1 = query(
          collection(db, 'trainingBattles'),
          where('creatorId', '==', currentUserId),
          where('state.status', '==', 'completed'),
          limit(20)
        );
        const q2 = query(
          collection(db, 'trainingBattles'),
          where('creator.odUserId', '==', currentUserId),
          where('state.status', '==', 'completed'),
          limit(20)
        );

        const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        // Merge and deduplicate by doc ID
        const seen = new Set();
        const battles = [];
        for (const snap of [snapshot1, snapshot2]) {
          for (const d of snap.docs) {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              const data = d.data();
              battles.push({
                id: d.id,
                ...data,
                isTrainingBattle: true,
                completedAt: (() => {
                  const ts = data.timeline?.completedAt || data.completedAt;
                  if (!ts) return null;
                  return ts?.toDate?.() || ts;
                })()
              });
            }
          }
        }

        // Sort client-side to avoid composite index requirement
        battles.sort((a, b) => {
          const dateA = new Date(a.completedAt || 0);
          const dateB = new Date(b.completedAt || 0);
          return dateB - dateA;
        });

        setCompletedTrainingBattles(battles);
      } catch (error) {
        console.error('Error fetching training battles:', error);
        // If index error, log helpful message
        if (error.code === 'failed-precondition') {
          console.error('Firebase index required. Check console for index creation link.');
        }
        setCompletedTrainingBattles([]);
      } finally {
        setLoadingTrainingBattles(false);
      }
    };

    fetchTrainingBattles();
  }, [screen, historyTab, user]);

  // Fetch completed BaggerBomb battles from Firestore for history
  useEffect(() => {
    if (screen !== 'battleHistory' || historyTab !== 'classic' || !user) return;

    const fetchCompletedBaggerBombBattles = async () => {
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase/config');

        const currentUserId = user?.odUserId || user?.username;
        if (!currentUserId) {
          setCompletedBaggerBombBattles([]);
          return;
        }

        // 4 parallel queries covering uid/odUserId for both creator and opponent
        const q1 = query(
          collection(db, 'battles'),
          where('creator.uid', '==', currentUserId),
          where('state.status', '==', 'completed')
        );
        const q2 = query(
          collection(db, 'battles'),
          where('opponent.uid', '==', currentUserId),
          where('state.status', '==', 'completed')
        );
        const q3 = query(
          collection(db, 'battles'),
          where('creator.odUserId', '==', currentUserId),
          where('state.status', '==', 'completed')
        );
        const q4 = query(
          collection(db, 'battles'),
          where('opponent.odUserId', '==', currentUserId),
          where('state.status', '==', 'completed')
        );

        const [s1, s2, s3, s4] = await Promise.all([
          getDocs(q1), getDocs(q2), getDocs(q3), getDocs(q4)
        ]);

        const seen = new Set();
        const allBattles = [];
        for (const snap of [s1, s2, s3, s4]) {
          for (const d of snap.docs) {
            if (!seen.has(d.id)) {
              seen.add(d.id);
              const data = d.data();
              allBattles.push({
                id: d.id,
                ...data,
                completedAt: (() => {
                  const ts = data.timeline?.completedAt || data.completedAt;
                  if (!ts) return null;
                  return ts?.toDate?.() || ts;
                })()
              });
            }
          }
        }

        // Sort newest first
        allBattles.sort((a, b) => {
          const dateA = new Date(a.completedAt || a.timing?.createdAt || 0);
          const dateB = new Date(b.completedAt || b.timing?.createdAt || 0);
          return dateB - dateA;
        });

        setCompletedBaggerBombBattles(allBattles);
      } catch (error) {
        console.error('Error fetching completed BaggerBomb battles:', error);
        if (error.code === 'failed-precondition') {
          console.error('Firebase index required. Check console for index creation link.');
        }
        setCompletedBaggerBombBattles([]);
      }
    };

    fetchCompletedBaggerBombBattles();
  }, [screen, historyTab, user]);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'portfolioDuelBattles' && e.newValue) {
        try {
          const updatedBattles = JSON.parse(e.newValue);
          setBattles(updatedBattles);
        } catch (error) {
          console.error('Error parsing storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fetch current prices when entering battle view
  // Only needed for V1 classic battles — V2+ battles manage their own prices via hooks/components
  useEffect(() => {
    if (screen !== 'battle' || !currentBattle) return;

    // V2+ battles have their own price management (hooks, connected components)
    // Skip App.jsx polling to avoid duplicate API calls
    if (currentBattle._v >= 2) return;

    async function fetchBattlePrices() {
      setLoadingBattlePrices(true);

      try {
        // ⭐ If battle is completed, use stored ending prices instead of fetching live
        const battleStatus = battleTimer.getBattleStatus(currentBattle);

        if (battleStatus === 'completed' && currentBattle.endingPrices) {
          console.log('📊 Using stored ending prices for completed battle');
          setBattlePrices(currentBattle.endingPrices);
          setLoadingBattlePrices(false);
          return; // Don't fetch live prices
        }

        // ⭐ For active battles, fetch current live prices
        console.log('📊 Fetching live prices for active battle');

        // Get all unique symbols from both portfolios (V3-safe)
        const creatorPortfolio = safePortfolioArray(currentBattle.creatorPortfolio || currentBattle.creator?.portfolio);
        const opponentPortfolio = safePortfolioArray(currentBattle.opponentPortfolio || currentBattle.opponent?.portfolio);
        const allAssets = [...creatorPortfolio, ...opponentPortfolio];

        // Batch fetch: 2 HTTP requests total instead of N individual calls
        const allSymbols = [...new Set(allAssets.map(a => a.symbol).filter(Boolean))];
        const stockSymbols = allSymbols.filter(s => !POPULAR_CRYPTO.some(c => c.symbol === s));
        const cryptoSymbols = allSymbols.filter(s => POPULAR_CRYPTO.some(c => c.symbol === s));

        const [stockData, cryptoData] = await Promise.all([
          stockSymbols.length > 0 ? stockAPI.getMultipleStockPrices(stockSymbols) : {},
          cryptoSymbols.length > 0 ? stockAPI.getMultipleCryptoPrices(cryptoSymbols) : {},
        ]);

        const priceMap = {};
        Object.entries(stockData).forEach(([symbol, data]) => {
          if (data?.price) priceMap[symbol] = data.price;
        });
        Object.entries(cryptoData).forEach(([symbol, data]) => {
          if (data?.price) priceMap[symbol] = data.price;
        });

        // Fill in fallbacks from asset data for any missing symbols
        for (const asset of allAssets) {
          if (!priceMap[asset.symbol] && asset.price) {
            priceMap[asset.symbol] = asset.price;
          }
        }

        setBattlePrices(priceMap);
      } catch (error) {
        console.error('Error fetching battle prices:', error);
        showToast('Failed to load prices. Please try again.');
      }

      setLoadingBattlePrices(false);
    }

    fetchBattlePrices();

    // ⭐ Only refresh for active battles, not completed ones
    const battleStatus = battleTimer.getBattleStatus(currentBattle);
    if (battleStatus === 'active') {
      const interval = setInterval(fetchBattlePrices, 60000); // 60s refresh (was 30s)
      return () => clearInterval(interval);
    }
  }, [screen, currentBattle]);

  // Check for newly completed battles every 10 seconds
  useEffect(() => {
    if (!user) return;

    const checkCompletedBattles = async () => {
      const savedBattles = loadBattlesSafe();
      
      for (const battle of savedBattles) {
        // Skip if already processed or no opponent
        if (battle.result || !battle.opponent) continue;
        // V4 battles use points-based scoring — handled by dedicated V4 completion processor
        if (battle._v === 4) continue;

        // Check if battle just completed
        if (battleTimer.isJustCompleted(battle)) {
          console.log('🏁 Battle completed!', battle.id);
          
          // Fetch ending prices
          const endingPrices = await fetchCurrentPricesForBattle(battle);
          console.log('🔒 Ending prices captured:', endingPrices);
          
          // Process the completed battle
          let processedBattle = battleTimer.processCompletedBattle(battle, endingPrices);
          
          // ⭐ Override XP for training battles
          if (battle.isTrainingBattle && processedBattle.result) {
            const creatorIsWinner = processedBattle.result.winner === battle.creator;
            const opponentIsWinner = processedBattle.result.winner === battle.opponent;
            
            processedBattle.result.xpAwarded = {
              [battle.creator]: creatorIsWinner ? 10 : 5,
              [battle.opponent]: opponentIsWinner ? 10 : 5
            };
            console.log('🎯 Training battle XP:', processedBattle.result.xpAwarded);
          }
          
          // ⭐ Store ending prices on the battle
          processedBattle.endingPrices = endingPrices;
          
          // Update in storage
          const updatedBattles = savedBattles.map(b => 
            b.id === battle.id ? processedBattle : b
          );
          saveBattlesSafe(updatedBattles);
          setBattles(updatedBattles);
          
          // Update current user's stats if they're in this battle
          if (getUsername(battle.creator) === user.username || getUsername(battle.opponent) === user.username) {
            updateUserStatsFromBattle(processedBattle);
          }
        }
      }
    };
    
    checkCompletedBattles();
    const interval = setInterval(checkCompletedBattles, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [user]);

  // V4 BaggerBomb completion processor — watches Firestore-subscribed battles for V4 completion
  useEffect(() => {
    if (!user) return;

    const pendingV4 = battles.filter(b =>
      b._v === 4 &&
      !b.result &&
      b.opponent &&
      battleTimer.getBattleStatus(b) === 'completed' &&
      !processedV4BattlesRef.current.has(b.id)
    );

    pendingV4.forEach(battle => {
      processedV4BattlesRef.current.add(battle.id);
      processV4BattleCompletion(battle);
    });
  }, [battles, user]);

  // Load previous battles when user logs in or screen changes to dashboard/battleHistory
  useEffect(() => {
    if (user && (screen === 'dashboard' || screen === 'battleHistory')) {
      loadPreviousBattles();
    }
  }, [user, screen]);

  // Load challenges for current battle
  useEffect(() => {
    if (screen === 'battle' && currentBattle && user) {
      const isCreator = currentBattle.creator === user.username;
      const opponentUsername = isCreator ? currentBattle.opponent : currentBattle.creator;
      
      // Load user's challenges
      const userChalls = challengeService.getUserChallenges(currentBattle.id, user.username);
      const userDD = userChalls.find(c => c.type === challengeService.CHALLENGE_TYPES.DOUBLE_DOWN);
      const userMC = userChalls.find(c => c.type === challengeService.CHALLENGE_TYPES.MARKET_CLOSE);
      
      setUserChallenges({
        doubleDown: userDD || null,
        marketClose: userMC || null
      });
      
      // Load opponent's challenges (only active ones)
      const oppChalls = challengeService.getOpponentChallenges(currentBattle.id, opponentUsername);
      const oppDD = oppChalls.find(c => c.type === challengeService.CHALLENGE_TYPES.DOUBLE_DOWN);
      const oppMC = oppChalls.find(c => c.type === challengeService.CHALLENGE_TYPES.MARKET_CLOSE);
      
      setOpponentChallenges({
        doubleDown: oppDD || null,
        marketClose: oppMC || null
      });
    }
  }, [screen, currentBattle, user, battles]);

  // Draft subscription - Phase 3
  useEffect(() => {
    if (!currentDraft?.id) return;
    if (screen !== 'draftLobby' && screen !== 'draftRoom') return;

    let unsubscribe = null;

    const loadDraftService = async () => {
      try {
        const draftService = await import('./services/draftService');
        unsubscribe = draftService.subscribeToDraft(currentDraft.id, (draft) => {
          if (draft) {
            // Just use draftState.lastPick directly from Firebase - no complex tracking needed
            setDraftState(draft);

            // Auto-navigate based on status changes
            if (draft.status === 'active' && screen === 'draftLobby') {
              setCurrentDraft(draft);
              setScreen('draftRoom');
            }
            if ((draft.status === 'completed' || draft.status === 'battle') && screen === 'draftRoom') {
              setCurrentDraft(draft);
              setScreen('draftResults');

              // Store locked prices when draft transitions to battle (only if not already stored)
              if (draft.status === 'battle' && !draft.lockedPrices) {
                draftService.storeDraftLockedPrices(draft.id).then(result => {
                  if (result.success) {
                    console.log('✅ Locked prices stored for battle mode');
                  }
                }).catch(err => console.error('Failed to store locked prices:', err));
              }
            }
            if (draft.status === 'cancelled') {
              setScreen('dashboard');
            }
          }
        });
      } catch (error) {
        console.error('Failed to subscribe to draft:', error);
      }
    };

    loadDraftService();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentDraft?.id, screen]);

  // Draft timer countdown - Phase 3
  useEffect(() => {
    if (screen !== 'draftRoom' || !draftState?.pickDeadline) return;

    const updateTimer = () => {
      const deadline = draftState.pickDeadline.toDate
        ? draftState.pickDeadline.toDate()
        : new Date(draftState.pickDeadline);
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setDraftTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [screen, draftState?.pickDeadline, draftState?.currentPlayerId]);

  // Timer-expired autopick - hard backstop when timer hits 0
  // Any client can trigger this (not just host), solving the host-leaves problem
  useEffect(() => {
    if (screen !== 'draftRoom') return;
    if (!draftState || draftState.status !== 'active') return;
    if (draftTimeRemaining > 0) return;

    const currentPlayer = draftState.players?.find(
      p => p.odUserId === draftState.currentPlayerId
    );

    // Skip if no current player or if CPU (handled by existing CPU/Absent autopick)
    if (!currentPlayer || currentPlayer.isCPU) return;

    // Random delay (500-2500ms) to avoid race conditions from multiple clients
    const delay = Math.floor(Math.random() * 2000) + 500;
    const timerExpiredAutopick = setTimeout(async () => {
      try {
        const draftService = await import('./services/draftService');
        await draftService.handleAutopick(draftState.id, draftState.currentPlayerId);
      } catch (error) {
        // Race condition (another client picked) is expected - log quietly
        console.log('[Draft] Timer-expired autopick attempted:', error.message);
      }
    }, delay);

    return () => clearTimeout(timerExpiredAutopick);
  }, [screen, draftState?.id, draftState?.status, draftState?.currentPlayerId, draftTimeRemaining]);

  // Absent player autopick - triggers when it's our turn but we've left the draft screen
  // Training mode: waits full timer (120s) to give player time to return
  // PvP mode: picks quickly (3-4s) so other players aren't stuck waiting
  useEffect(() => {
    if (screen === 'draftRoom') return;
    if (!draftState || draftState.status !== 'active') return;

    const currentUserId = user?.odUserId || user?.username;
    if (!currentUserId) return;
    if (draftState.currentPlayerId !== currentUserId) return;

    const delay = draftState.isTraining
      ? 120 * 1000
      : 3000 + Math.floor(Math.random() * 1000);

    const absentAutopick = setTimeout(async () => {
      try {
        const draftService = await import('./services/draftService');
        await draftService.handleAutopick(draftState.id, currentUserId);
      } catch (error) {
        console.log('[Draft] Absent-player autopick attempted:', error.message);
      }
    }, delay);

    return () => clearTimeout(absentAutopick);
  }, [screen, draftState?.id, draftState?.status, draftState?.currentPlayerId, user]);

  // CPU/Absent player autopick with 3-second countdown - Draft Fixes
  useEffect(() => {
    if (screen !== 'draftRoom') return;
    if (!draftState || draftState.status !== 'active') return;

    const currentPlayer = draftState.players?.find(p => p.odUserId === draftState.currentPlayerId);
    const needsAutopick = currentPlayer?.isCPU || currentPlayer?.disconnected || currentPlayer?.isAbsent;

    if (needsAutopick) {
      // Show 3-second countdown
      setAutopickCountdown(3);

      const countdownInterval = setInterval(() => {
        setAutopickCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Trigger autopick after 3 seconds
      const autopickTimer = setTimeout(async () => {
        try {
          const draftService = await import('./services/draftService');
          await draftService.handleAutopick(draftState.id, draftState.currentPlayerId);
        } catch (error) {
          console.error('Autopick failed:', error);
        }
      }, 3000);

      return () => {
        clearInterval(countdownInterval);
        clearTimeout(autopickTimer);
        setAutopickCountdown(null);
      };
    } else {
      setAutopickCountdown(null);
    }
  }, [screen, draftState?.currentPlayerId, draftState?.status, draftState?.players]);

  // Presence heartbeat - let server know we're still here
  useEffect(() => {
    if (screen !== 'draftRoom' && screen !== 'draftLobby') return;
    if (!draftState?.id || draftState.status !== 'active') return;

    const currentUserId = user?.odUserId || user?.username;
    if (!currentUserId) return;

    const sendPresence = async () => {
      try {
        const draftService = await import('./services/draftService');
        await draftService.updatePlayerPresence(draftState.id, currentUserId);
      } catch (error) {
        console.error('Presence update failed:', error);
      }
    };

    // Send presence immediately and every 10 seconds
    sendPresence();
    const presenceInterval = setInterval(sendPresence, 10000);

    return () => clearInterval(presenceInterval);
  }, [screen, draftState?.id, draftState?.status, user]);

  // Check for absent players periodically (only host runs this to avoid duplicates)
  useEffect(() => {
    if (screen !== 'draftRoom') return;
    if (!draftState?.id || draftState.status !== 'active') return;

    const currentUserId = user?.odUserId || user?.username;
    const isHost = draftState.hostId === currentUserId;
    if (!isHost) return;

    const checkAbsent = async () => {
      try {
        const draftService = await import('./services/draftService');
        await draftService.checkAbsentPlayers(draftState.id);
      } catch (error) {
        console.error('Absent check failed:', error);
      }
    };

    const absentCheckInterval = setInterval(checkAbsent, 15000);

    return () => clearInterval(absentCheckInterval);
  }, [screen, draftState?.id, draftState?.status, draftState?.hostId, user]);

  // NOTE: Active draft banner check is now handled by the combined draft poll above (Fix 2)

  // Check for active BaggerBomb V3 battles on dashboard (rejoin functionality)
  useEffect(() => {
    if (screen !== 'dashboard') {
      setActiveBaggerBombBanner(null);
      return;
    }

    const userId = user?.odUserId || user?.uid || user?.username;
    if (!userId) return;

    // Check battles array for user's active or waiting BaggerBomb V3 battles
    const userBaggerBombBattles = battles.filter(battle => {
      if (battle._v !== 3 && battle._v !== 4) return false;
      if (battle.archived) return false;

      const status = battle.state?.status;
      if (status !== 'waiting' && status !== 'active') return false;

      // Check if user is creator or opponent
      const isCreator = battle.creator?.odUserId === userId || battle.creator?.uid === userId;
      const isOpponent = battle.opponent?.odUserId === userId || battle.opponent?.uid === userId;

      return isCreator || isOpponent;
    }, 'userBaggerBombBattles in V3 banner check');

    // Show the most recent active/waiting battle
    if (userBaggerBombBattles.length > 0) {
      // Sort by creation time, most recent first
      const sorted = [...userBaggerBombBattles].sort((a, b) => {
        const aTime = a.timing?.createdAt || 0;
        const bTime = b.timing?.createdAt || 0;
        return new Date(bTime) - new Date(aTime);
      });
      setActiveBaggerBombBanner(sorted[0]);
    } else {
      setActiveBaggerBombBanner(null);
    }
  }, [screen, user, battles]);

  // Browser close warning for active draft - Phase 4
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if ((screen === 'draftRoom' || screen === 'draftLobby') && draftState?.status === 'active') {
        e.preventDefault();
        e.returnValue = 'You have an active draft in progress. Leaving may result in autopicks.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [screen, draftState?.status]);

  // CPU auto-swap during free agency window (Free Agency feature)
  useEffect(() => {
    if (!currentDraft || currentDraft.status !== 'battle') return;

    const checkCPUSwaps = async () => {
      try {
        const freeAgencyService = await import('./services/freeAgencyService');

        // Only run if window is open
        if (!freeAgencyService.isFreeAgencyWindowOpen(currentDraft.type)) return;

        // Find CPU players
        const cpuPlayers = currentDraft.players?.filter(p => p.isCPU) || [];

        for (const cpu of cpuPlayers) {
          // Random delay to spread out CPU swaps (0-60 seconds)
          const delay = Math.random() * 60000;
          setTimeout(async () => {
            try {
              await freeAgencyService.processCPUSwap(currentDraft.id, cpu);
            } catch (error) {
              console.error('CPU swap failed:', error);
            }
          }, delay);
        }
      } catch (error) {
        console.error('CPU swap check failed:', error);
      }
    };

    // Check once when entering battle mode during free agency window
    checkCPUSwaps();

    // Check every 30 minutes during free agency window
    const interval = setInterval(checkCPUSwaps, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentDraft?.id, currentDraft?.status]);

  // ============================================
  // 3. HELPER FUNCTIONS
  // ============================================

  // Fetch current prices for all assets in a battle
  async function fetchCurrentPricesForBattle(battle) {
    const prices = {};

    // Get all unique assets from both portfolios (V3-safe via portfolioHelpers)
    const creatorPortfolio = safePortfolioArray(battle.creatorPortfolio || battle.creator?.portfolio);
    const opponentPortfolio = safePortfolioArray(battle.opponentPortfolio || battle.opponent?.portfolio);
    const allAssets = [...creatorPortfolio, ...opponentPortfolio];
    
    for (const asset of allAssets) {
      if (prices[asset.symbol]) continue; // Skip if already fetched
      
      try {
        // Determine if it's crypto or stock
        const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === asset.symbol);
        
        if (isCrypto) {
          const cryptoData = POPULAR_CRYPTO.find(c => c.symbol === asset.symbol);
          // Use symbol (ETH) not id (ethereum) - EODHD expects symbol format
          const data = await stockAPI.getCryptoPrice(cryptoData.symbol);
          prices[asset.symbol] = data.price;
        } else {
          const data = await stockAPI.getStockPrice(asset.symbol);
          prices[asset.symbol] = data.price;
        }
      } catch (error) {
        console.error(`Error fetching price for ${asset.symbol}:`, error);
        prices[asset.symbol] = asset.price; // Fallback to original price
      }
    }
    
    return prices;
  }

  // V4 BaggerBomb: process a completed battle with points-based scoring
  async function processV4BattleCompletion(battle) {
    try {
      console.log('🏁 V4 Battle completing...', battle.id);

      // 1. Fetch ending prices
      const endingPrices = await fetchCurrentPricesForBattle(battle);

      // 2. Calculate V4 final scores (points-based)
      const { creatorScore, opponentScore } = calculateV4FinalScores(battle, endingPrices);

      // 3. Determine winner
      const creatorUsername = battle.creator?.username;
      const opponentUsername = battle.opponent?.username;
      const creatorWon = creatorScore >= opponentScore;
      const winner = creatorWon ? creatorUsername : opponentUsername;
      const loser = creatorWon ? opponentUsername : creatorUsername;

      // 4. Calculate XP (normalize V4 point margin for XP formula)
      const margin = Math.abs(creatorScore - opponentScore);
      const normalizedMargin = Math.min(margin / 50, 10);
      const creatorXP = battleTimer.calculateXP(creatorWon, normalizedMargin);
      const opponentXP = battleTimer.calculateXP(!creatorWon, normalizedMargin);

      // 5. Build result object (compatible with existing consumers)
      const result = {
        winner,
        loser,
        creatorScore,
        opponentScore,
        creatorReturn: 0,
        opponentReturn: 0,
        margin,
        isV4: true,
        xpAwarded: {
          [creatorUsername]: creatorXP,
          [opponentUsername]: opponentXP,
        },
      };

      // 6. Write to Firestore (triggers subscription update for both players + Live Feed)
      await completeBattle(battle.id, { endingPrices, result });

      // 7. Update local user stats
      const processedBattle = { ...battle, result, endingPrices, completedAt: new Date().toISOString() };
      updateUserStatsFromBattle(processedBattle);

      console.log('✅ V4 Battle completed!', battle.id, `${winner} wins ${creatorScore}-${opponentScore}`);
    } catch (error) {
      console.error('❌ V4 completion error:', error);
      processedV4BattlesRef.current.delete(battle.id); // Allow retry
    }
  }

  // Update current user's stats after a battle completes
  function updateUserStatsFromBattle(battle) {
    if (!battle.result) return;

    const userXP = battle.result.xpAwarded[user.username];
    const won = battle.result.winner === user.username;

    // Build updates object
    const updates = {
      xp: user.xp + userXP
    };

    // ⭐ Only update W/L for non-training battles
    if (!battle.isTrainingBattle) {
      updates.wins = won ? user.wins + 1 : user.wins;
      updates.losses = won ? user.losses : user.losses + 1;
    }
    // Training battles still award XP but don't affect W/L record

    // Check for rank up
    const newRank = battleTimer.determineRank(updates.xp);
    if (newRank !== user.rank) {
      updates.rank = newRank;
      console.log(`🎉 Rank up! You are now ${newRank}`);
    }

    // Update user via context (handles state and persistence)
    updateUser(updates);

    // Update weekly challenge progress
    const isCreator = getUsername(battle.creator) === user.username;
    const userReturn = isCreator
      ? (battle.result.creatorReturn ?? 0)
      : (battle.result.opponentReturn ?? 0);
    const battleGameMode = (battle.isSnakeDraft || battle.battleType === 'snake-draft')
      ? 'snake'
      : 'classic';

    updateWeeklyChallengeProgress({
      won,
      returnPercent: userReturn,
      greenAssetCount: 0,
      allAssetsGreen: false,
      position: won ? 1 : 2,
    }, battleGameMode);
  }

  // Archive a completed battle (move from completed to previous battles)
  function archiveBattle(battleId) {
    const savedBattles = loadBattlesSafe();
    const battleToArchive = savedBattles.find(b => b.id === battleId);
    
    if (!battleToArchive) return;
    
    // Add to previous battles
    const currentPrevious = JSON.parse(localStorage.getItem('tradeseven_previous_battles') || '[]');
    const updatedPrevious = [...currentPrevious, { ...battleToArchive, archivedAt: new Date().toISOString() }];
    localStorage.setItem('tradeseven_previous_battles', JSON.stringify(updatedPrevious));
    setPreviousBattles(updatedPrevious);
    
    // Remove from active battles
    const updatedBattles = savedBattles.filter(b => b.id !== battleId);
    saveBattlesSafe(updatedBattles);
    setBattles(updatedBattles);
    
    console.log('📦 Archived battle:', battleId);
  }

  // Load previous battles from localStorage
  function loadPreviousBattles() {
    try {
      const saved = JSON.parse(localStorage.getItem('tradeseven_previous_battles') || '[]');
      // Filter to only show user's battles and sort by date
      const userPreviousBattles = saved
        .filter(b => getUsername(b.creator) === user?.username || getUsername(b.opponent) === user?.username)
        .sort((a, b) => new Date(b.completedAt || b.archivedAt) - new Date(a.completedAt || a.archivedAt));
      setPreviousBattles(userPreviousBattles);
    } catch (error) {
      console.error('Error loading previous battles:', error);
      setPreviousBattles([]);
    }
  }

  function generateChallengeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;
    const maxAttempts = 100;
    
    // Keep generating until we get a unique code
    while (attempts < maxAttempts) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Check if this code already exists in active battles
      const existingBattles = loadBattlesSafe();
      const codeExists = existingBattles.some(b => b.challengeCode === code);
      
      if (!codeExists) {
        console.log('✅ Generated unique code:', code);
        return code;
      }
      
      console.log('⚠️ Duplicate code generated, trying again:', code);
      attempts++;
    }
    
    // Fallback: add timestamp to ensure uniqueness
    code = code + Date.now().toString().slice(-2);
    console.log('⚠️ Using timestamped code after max attempts:', code);
    return code;
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('Challenge code copied to clipboard!');
  }

  // Toggle challenge panel visibility
  const toggleChallengePanel = (panelId) => {
    setOpenChallengePanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  };

  // ============================================
  // 4. SCREEN HANDLERS
  // ============================================

  const handleAddAsset = (asset) => {
    if (portfolio.some(p => p.symbol === asset.symbol)) return;
    if (portfolio.length >= 13) return;
    
    // Determine if this is a crypto or stock asset
    const isAssetCrypto = assetType === 'crypto';
    
    // If this is the first asset, set the portfolio type
    if (portfolio.length === 0) {
      setPortfolioType(isAssetCrypto ? 'crypto' : 'stocks');
      setPortfolio([...portfolio, { ...asset, percentage: 10 }]);
      return;
    }
    
    // If portfolio already has assets, check type matches
    const portfolioIsCrypto = portfolioType === 'crypto';
    if (isAssetCrypto !== portfolioIsCrypto) {
      alert('Cannot mix stocks and crypto! Please create separate portfolios for each asset type.');
      return;
    }
    
    setPortfolio([...portfolio, { ...asset, percentage: 10 }]);
  };

  const handleRemoveAsset = (symbol) => {
    const newPortfolio = portfolio.filter(p => p.symbol !== symbol);
    setPortfolio(newPortfolio);
    
    // Reset portfolio type if all assets removed
    if (newPortfolio.length === 0) {
      setPortfolioType(null);
    }
  };

  const handlePercentageChange = (symbol, newPercentage) => {
    setPortfolio(portfolio.map(p =>
      p.symbol === symbol ? { ...p, percentage: newPercentage } : p
    ));
  };

  // ============================================
  // GENERATE CPU PORTFOLIO FOR TRAINING MODE
  // ============================================
  const generateCPUPortfolio = (type, stocksDataArr, cryptoDataArr) => {
    // Stock categories for CPU selection
    const LEADERSHIP = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'MA', 'UNH', 'JNJ', 'WMT', 'PG', 'HD', 'XOM'];
    const MOMENTUM = ['TSLA', 'AMD', 'CRM', 'NFLX', 'ADBE', 'PYPL', 'XYZ', 'SHOP', 'UBER', 'ABNB', 'DKNG', 'ROKU', 'ZM', 'SNOW', 'PLTR', 'COIN'];
    const STABLE = ['KO', 'PEP', 'MCD', 'COST', 'VZ', 'T', 'PFE', 'MRK', 'ABBV', 'LLY', 'NEE', 'DUK', 'SO', 'D', 'CVX', 'COP'];
    const SHORT_OPTIONS = ['TSLA', 'RIVN', 'LCID', 'SNAP', 'HOOD', 'GME', 'AMC', 'PLTR', 'SMCI', 'SPY', 'QQQ'];
    const CRYPTO_OPTIONS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'];

    // Helper to pick random items from array
    const pickRandom = (arr, count) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    };

    // Decide portfolio composition (randomize strategy)
    const numLongs = Math.floor(Math.random() * 7) + 6; // 6-12 longs
    const includeShorts = Math.random() > 0.5; // 50% chance to include shorts
    const numShorts = includeShorts ? Math.floor(Math.random() * 2) + 1 : 0; // 0-2 shorts

    // Pick stocks from each category
    const leadershipCount = Math.ceil(numLongs / 3);
    const momentumCount = Math.ceil(numLongs / 3);
    const stableCount = Math.max(0, numLongs - leadershipCount - momentumCount);

    const leadershipPicks = pickRandom(LEADERSHIP, leadershipCount);
    const momentumPicks = pickRandom(MOMENTUM, momentumCount);
    const stablePicks = pickRandom(STABLE, stableCount);

    // Combine long positions
    const longs = [...leadershipPicks, ...momentumPicks, ...stablePicks].slice(0, numLongs);

    // Pick shorts (if any) - exclude any already in longs
    const availableShorts = SHORT_OPTIONS.filter(s => !longs.includes(s));
    const shorts = pickRandom(availableShorts, numShorts);

    // Pick crypto
    const cryptoSymbol = pickRandom(CRYPTO_OPTIONS, 1)[0];

    // Total assets in portfolio
    const totalAssets = longs.length + shorts.length + 1; // +1 for crypto

    // Generate allocations (must total 100%)
    const baseAllocation = Math.floor(100 / totalAssets);
    let remainder = 100 - (baseAllocation * totalAssets);

    const cpuPortfolio = [];

    // Add longs with allocations
    longs.forEach((symbol, i) => {
      const extra = i < remainder ? 1 : 0;
      const allocation = baseAllocation + extra;

      // Try to get real price from stocksData
      const stockInfo = stocksDataArr?.find(s => s.symbol === symbol);
      cpuPortfolio.push({
        symbol,
        name: stockInfo?.name || symbol,
        price: stockInfo?.price || 100, // Fallback price
        amount: (allocation / 100) * 1000000, // $1M portfolio
        position: 'long'
      });
    });

    // Update remainder
    remainder = Math.max(0, remainder - longs.length);

    // Add shorts with allocations
    shorts.forEach((symbol, i) => {
      const extra = i < remainder ? 1 : 0;
      const allocation = baseAllocation + extra;

      const stockInfo = stocksDataArr?.find(s => s.symbol === symbol);
      cpuPortfolio.push({
        symbol,
        name: stockInfo?.name || symbol,
        price: stockInfo?.price || 100,
        amount: (allocation / 100) * 1000000,
        position: 'short'
      });
    });

    // Add crypto
    const cryptoInfo = cryptoDataArr?.find(c => c.symbol === cryptoSymbol);
    cpuPortfolio.push({
      symbol: cryptoSymbol,
      name: cryptoInfo?.name || cryptoSymbol,
      price: cryptoInfo?.price || (cryptoSymbol === 'BTC' ? 50000 : 2000),
      amount: (baseAllocation / 100) * 1000000,
      position: 'long'
    });

    return cpuPortfolio;
  };

  const handleCreateBattle = async () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name before creating a battle');
      return;
    }

    if (!selectedCrypto) {
      alert('Please select a crypto asset before creating a battle');
      return;
    }

    const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
    if (totalAssets < 7) {
      alert(`Please complete your portfolio (7-13 total assets). You have ${totalAssets}.`);
      return;
    }

    const challengeCode = generateChallengeCode();

    // Convert portfolio to battle format (percentage to dollar amounts)
    const portfolioAssets = portfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      price: asset.price,
      amount: (asset.percentage / 100) * 1000000, // $1M portfolio
      position: asset.position || 'long'
    }));

    // Add selected crypto to portfolio using user-defined allocation
    if (selectedCrypto) {
      const cryptoInfo = cryptoData.find(c => c.symbol === selectedCrypto);
      if (cryptoInfo) {
        portfolioAssets.push({
          symbol: selectedCrypto,
          name: cryptoInfo.name || selectedCrypto,
          price: cryptoInfo.price || 0,
          amount: (cryptoPercentage / 100) * 1000000, // Use user-defined cryptoPercentage state
          position: 'long'
        });
      }
    }

    try {
      console.log('🔥 Creating PvP battle in Firestore...');

      // Save to Firestore (primary storage for PvP battles)
      const firestoreBattle = await createFirestoreBattle({
        challengeCode,
        creator: {
          uid: user.odUserId || user.username,
          username: user.username
        },
        portfolioName: portfolioName.trim(),
        creatorPortfolio: portfolioAssets,
        portfolioType: portfolioType || 'stocks'
      });

      console.log('✅ Battle created in Firestore with ID:', firestoreBattle.id);

      // Create local battle object for state/localStorage (with Firestore ID)
      const newBattle = {
        id: firestoreBattle.id, // Use Firestore document ID
        challengeCode,
        creator: user.username,
        creatorPortfolio: portfolioAssets,
        portfolioName: portfolioName.trim(),
        portfolioType: portfolioType || 'stocks',
        opponent: null,
        opponentPortfolio: null,
        status: 'waiting',
        startDate: null,
        endDate: null,
        createdAt: new Date().toISOString(),
        firestoreId: firestoreBattle.id // Reference to Firestore doc
      };

      // Also save to localStorage as cache
      const currentBattles = loadBattlesSafe();
      const updatedBattles = [...currentBattles, newBattle];
      saveBattlesSafe(updatedBattles);

      // Update component state
      setBattles(updatedBattles);
      setActiveBattleId(newBattle.id);
      setPortfolio([]);
      setPortfolioType(null);
      setPortfolioName('');
      setSelectedCrypto(null);
      setCryptoPercentage(10); // Reset to default
      setBuilderMode('create');
      setScreen('dashboard');

    } catch (error) {
      console.error('❌ Failed to create battle in Firestore:', error);
      alert('Failed to create battle. Please check your connection and try again.');
    }
  };

  const handleJoinBattle = async () => {
    if (!joinCode.trim()) {
      alert('Please enter a challenge code');
      return;
    }

    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name before joining');
      return;
    }

    if (!selectedCrypto) {
      alert('Please select a crypto asset before joining a battle');
      return;
    }

    const totalAssetsJoin = portfolio.length + (selectedCrypto ? 1 : 0);
    if (totalAssetsJoin < 7) {
      alert(`Please complete your portfolio (7-13 total assets). You have ${totalAssetsJoin}.`);
      return;
    }

    // Convert portfolio to battle format
    const portfolioAssets = portfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      price: asset.price,
      amount: (asset.percentage / 100) * 1000000,
      position: asset.position || 'long'
    }));

    // Add selected crypto to portfolio using user-defined allocation
    if (selectedCrypto) {
      const cryptoInfo = cryptoData.find(c => c.symbol === selectedCrypto);
      if (cryptoInfo) {
        portfolioAssets.push({
          symbol: selectedCrypto,
          name: cryptoInfo.name || selectedCrypto,
          price: cryptoInfo.price || 0,
          amount: (cryptoPercentage / 100) * 1000000, // Use user-defined cryptoPercentage state
          position: 'long'
        });
      }
    }

    // Fetch starting prices for the opponent's portfolio
    const startingPrices = {};
    for (const asset of portfolioAssets) {
      try {
        const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === asset.symbol);
        if (isCrypto) {
          const cryptoDataItem = POPULAR_CRYPTO.find(c => c.symbol === asset.symbol);
          // Use symbol (ETH) not id (ethereum) - EODHD expects symbol format
          const data = await stockAPI.getCryptoPrice(cryptoDataItem.symbol);
          startingPrices[asset.symbol] = data.price;
        } else {
          const data = await stockAPI.getStockPrice(asset.symbol);
          startingPrices[asset.symbol] = data.price;
        }
      } catch (error) {
        console.error(`Error fetching price for ${asset.symbol}:`, error);
        startingPrices[asset.symbol] = asset.price;
      }
    }

    // Update portfolio with starting prices
    const updatedPortfolio = portfolioAssets.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));

    try {
      console.log('🔥 Joining battle in Firestore...');

      // Try to join via Firestore first (for PvP battles created in Firestore)
      const updatedBattle = await joinFirestoreBattle(joinCode.trim().toUpperCase(), {
        uid: user.odUserId || user.username,
        username: user.username,
        portfolioName: portfolioName.trim(),
        portfolio: updatedPortfolio,
        portfolioType: portfolioType || 'stocks',
        startingPrices: startingPrices
      });

      console.log('✅ Joined battle in Firestore:', updatedBattle.id);

      // Create local battle object for state/localStorage
      const localBattle = {
        id: updatedBattle.id,
        challengeCode: updatedBattle.challengeCode,
        creator: updatedBattle.creator.username,
        creatorPortfolio: updatedBattle.creator.portfolio,
        opponent: user.username,
        opponentPortfolio: updatedPortfolio,
        portfolioName: portfolioName.trim(),
        portfolioType: portfolioType || 'stocks',
        status: 'active',
        startDate: updatedBattle.timeline.startDate,
        endDate: updatedBattle.timeline.endDate,
        startingPrices: startingPrices,
        createdAt: updatedBattle.timeline.createdAt,
        firestoreId: updatedBattle.id
      };

      // Update localStorage
      const currentBattles = loadBattlesSafe();
      const updatedBattles = [...currentBattles.filter(b => b.id !== updatedBattle.id), localBattle];
      saveBattlesSafe(updatedBattles);

      // Update component state
      setBattles(updatedBattles);
      setActiveBattleId(localBattle.id);
      setPortfolio([]);
      setPortfolioType(null);
      setPortfolioName('');
      setSelectedCrypto(null);
      setCryptoPercentage(10);
      setBuilderMode('create');
      setJoinCode('');
      setScreen('dashboard');

    } catch (firestoreError) {
      console.warn('⚠️ Firestore join failed, trying localStorage:', firestoreError.message);

      // Fallback to localStorage for legacy battles
      const allBattles = loadBattlesSafe();
      const battleToJoin = allBattles.find(
        b => b.challengeCode === joinCode.trim().toUpperCase() && b.status === 'waiting'
      );

      if (!battleToJoin) {
        alert(`Battle not found or already started. Code: ${joinCode.trim().toUpperCase()}`);
        return;
      }

      if (battleToJoin.creator === user.username) {
        alert('You cannot join your own battle');
        return;
      }

      // Calculate start and end dates
      const now = new Date();
      const startDate = new Date(now);
      const endDate = new Date(startDate.getTime() + battleTimer.BATTLE_DURATION);

      // Update the battle in localStorage
      const updatedBattles = allBattles.map(b =>
        b.id === battleToJoin.id
          ? {
              ...b,
              opponent: user.username,
              opponentPortfolio: updatedPortfolio,
              status: 'active',
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              startingPrices: startingPrices
            }
          : b
      );

      saveBattlesSafe(updatedBattles);
      setBattles(updatedBattles);
      setActiveBattleId(battleToJoin.id);
      setPortfolio([]);
      setPortfolioType(null);
      setPortfolioName('');
      setSelectedCrypto(null);
      setCryptoPercentage(10);
      setBuilderMode('create');
      setJoinCode('');
      setScreen('dashboard');
    }
  };

  // ============================================
  // TRAINING MODE: CREATE TRAINING BATTLE
  // ============================================
  const handleCreateTrainingBattle = async () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name before starting training');
      return;
    }

    if (!selectedCrypto) {
      alert('Please select a crypto asset before starting training');
      return;
    }

    const totalAssetsTraining = portfolio.length + (selectedCrypto ? 1 : 0);
    if (totalAssetsTraining < 7) {
      alert(`Please complete your portfolio (7-13 total assets). You have ${totalAssetsTraining}.`);
      return;
    }

    // Convert user portfolio to battle format
    const userPortfolioAssets = portfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      price: asset.price,
      amount: (asset.percentage / 100) * 1000000,
      position: asset.position || 'long'
    }));

    // Add selected crypto to user portfolio using user-defined cryptoPercentage
    if (selectedCrypto) {
      const cryptoInfo = cryptoData.find(c => c.symbol === selectedCrypto);
      if (cryptoInfo) {
        userPortfolioAssets.push({
          symbol: selectedCrypto,
          name: cryptoInfo.name || selectedCrypto,
          price: cryptoInfo.price || 0,
          amount: (cryptoPercentage / 100) * 1000000,
          position: 'long'
        });
      }
    }

    // Generate CPU opponent portfolio
    const cpuPortfolio = generateCPUPortfolio(portfolioType, stocksData, cryptoData);

    // Calculate start and end dates (1 hour for training)
    const now = new Date();
    const startDate = new Date(now);
    const TRAINING_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
    const endDate = new Date(startDate.getTime() + TRAINING_DURATION);

    // Fetch starting prices with cache busting + WebSocket override
    const allAssets = [...userPortfolioAssets, ...cpuPortfolio];
    const uniqueSymbols = [...new Set(allAssets.map(a => a.symbol))];
    const { startingPrices } = await fetchBattlePrices(uniqueSymbols);

    // Update both portfolios with locked starting prices
    const updatedUserPortfolio = userPortfolioAssets.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));
    
    const updatedCPUPortfolio = cpuPortfolio.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));

    // Generate unique battle ID for Firebase
    const battleId = `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userId = user.odUserId || user.username;

    // Create training battle object (for localStorage compatibility)
    const trainingBattle = {
      id: battleId,
      challengeCode: 'TRAINING', // Special code for training battles
      creator: user.username,
      opponent: 'CPU Opponent', // ⭐ Special opponent name
      creatorPortfolio: updatedUserPortfolio,
      opponentPortfolio: updatedCPUPortfolio,
      portfolioName: portfolioName.trim(),
      portfolioType: portfolioType,
      status: 'active', // Start immediately
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startingPrices: startingPrices,
      isTrainingBattle: true, // ⭐ Mark as training battle
      createdAt: new Date().toISOString()
    };

    // ⭐ SAVE TO FIREBASE for persistence across sessions
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase/config');

      const firebaseBattle = {
        _v: 1,
        id: battleId,
        mode: 'training', // ⭐ Key identifier for training battles
        type: 'classic',

        // Players
        player1: {
          odUserId: userId,
          username: user.username,
          portfolioName: portfolioName.trim(),
          portfolio: updatedUserPortfolio,
          portfolioType: portfolioType,
          startValue: 1000000,
          currentValue: 1000000,
          percentChange: 0,
          isCreator: true
        },
        player2: {
          odUserId: 'cpu',
          username: 'CPU Opponent',
          portfolioName: 'CPU Strategy',
          portfolio: updatedCPUPortfolio,
          portfolioType: portfolioType,
          startValue: 1000000,
          currentValue: 1000000,
          percentChange: 0,
          isCPU: true
        },

        // Timing
        timeline: {
          createdAt: now.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          completedAt: null
        },

        // State
        state: {
          status: 'active',
          startingPrices: startingPrices,
          endingPrices: null
        },

        // For querying
        playerIds: [userId, 'cpu'],
        creatorId: userId,

        // Metadata
        challengeCode: null, // No battle code for training
        result: null,
        challengeIds: [],
        midGameChallenges: [], // Track earned mid-game challenges
        halftimeLeader: null, // Track halftime leader for comeback challenge
        archived: false,
        updatedAt: now.toISOString()
      };

      await setDoc(doc(db, 'trainingBattles', battleId), firebaseBattle);
      console.log('✅ Training battle saved to Firebase:', battleId);
    } catch (firebaseError) {
      console.error('⚠️ Failed to save training battle to Firebase:', firebaseError);
      // Continue anyway - localStorage backup exists
    }

    // Update component state using functional update to prevent race conditions
    debugBattles('Before classic training battle creation', battles);
    setBattles(prevBattles => {
      // Check if battle already exists (prevent duplicates)
      const exists = prevBattles.some(b => b.id === trainingBattle.id);
      if (exists) {
        console.log('⚠️ Training battle already exists, skipping add');
        return prevBattles;
      }
      const updatedBattles = [...prevBattles, trainingBattle];
      debugBattles('After classic training battle creation', updatedBattles);
      saveBattlesSafe(updatedBattles);
      return updatedBattles;
    });
    setActiveBattleId(trainingBattle.id);
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSelectedCrypto(null);
    setCryptoPercentage(10);
    setBuilderMode('create');

    // Navigate to dashboard (battle will show as active)
    setScreen('dashboard');
  };

  // ============================================
  // BAGGERBOMB TRAINING MODE: CREATE BAGGERBOMB TRAINING BATTLE
  // ============================================
  const handleCreateBaggerBombTrainingBattle = async (portfolioData) => {
    if (!portfolioData.portfolioName?.trim()) {
      alert('Please enter a portfolio name before starting training');
      return;
    }

    // User portfolio is already formatted from PortfolioBuilderBaggerBomb
    const userPortfolioAssets = (portfolioData.roster || [])
      .filter(asset => asset && asset.symbol)
      .map(asset => ({
        symbol: String(asset.symbol || ''),
        name: String(asset.name || asset.symbol || ''),
        price: Number(asset.price) || 0,
        amount: Number(asset.amount) || 0,
        position: String(asset.position || 'long')
      }));

    // User bench assets
    const userBenchAssets = (portfolioData.bench || [])
      .filter(asset => asset && asset.symbol)
      .map(asset => ({
        symbol: String(asset.symbol || ''),
        name: String(asset.name || asset.symbol || ''),
        price: Number(asset.price) || 0,
        amount: 0,
        position: 'long'
      }));

    // Generate CPU portfolio for BaggerBomb mode
    const cpuPortfolioData = generateCPUPortfolioBaggerBomb(stocksData, cryptoData);

    // Calculate start and end dates (1 hour for training)
    const now = new Date();
    const startDate = new Date(now);
    const TRAINING_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
    const endDate = new Date(startDate.getTime() + TRAINING_DURATION);

    // Fetch starting prices with cache busting + WebSocket override
    const allAssets = [...userPortfolioAssets, ...cpuPortfolioData.portfolio];
    const uniqueSymbols = [...new Set(allAssets.map(a => a.symbol))];
    const { startingPrices } = await fetchBattlePrices(uniqueSymbols);

    // Update portfolios with locked starting prices
    const updatedUserPortfolio = userPortfolioAssets.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));

    const updatedCPUPortfolio = cpuPortfolioData.portfolio.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));

    // Generate unique battle ID for Firebase
    const battleId = `training_baggerbomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const odUserId = user.odUserId || user.username;

    // Create BaggerBomb training battle object (for localStorage compatibility)
    // Uses V2 structure with creator/opponent objects for BaggerBombBattleViewRedesign compatibility
    const trainingBattle = {
      id: battleId,
      challengeCode: 'TRAINING', // Special code for training battles
      _v: 2, // BaggerBomb Scoring version marker

      // Creator object (user)
      creator: {
        uid: user.odUserId || user.username,
        odUserId: user.odUserId || user.username,
        username: user.username,
        portfolioName: portfolioData.portfolioName.trim(),
        portfolio: updatedUserPortfolio,
        bench: userBenchAssets,
        portfolioType: 'baggerbomb',
        cryptoAllocation: 10
      },

      // Opponent object (CPU)
      opponent: {
        uid: 'cpu',
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolioName: 'CPU BaggerBomb Strategy',
        portfolio: updatedCPUPortfolio,
        bench: cpuPortfolioData.bench,
        portfolioType: 'baggerbomb',
        cryptoAllocation: 10
      },

      // Legacy fields for classic view compatibility (in case it falls through)
      creatorPortfolio: updatedUserPortfolio,
      opponentPortfolio: updatedCPUPortfolio,
      creatorBench: userBenchAssets,
      opponentBench: cpuPortfolioData.bench,
      portfolioName: portfolioData.portfolioName.trim(),
      portfolioType: 'baggerbomb',

      // Timeline
      timeline: {
        createdAt: now.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        completedAt: null
      },

      // State
      state: {
        status: 'active',
        currentSession: '',
        completedSessions: [],
        startingPrices: startingPrices
      },

      // Session prices (empty initially)
      sessionPrices: {
        MORNING_BELL: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        MIDDAY: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        POWER_HOUR: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        NIGHT_GAME: { open: {}, close: {}, capturedAt: { open: '', close: '' } }
      },

      // BaggerBomb specific
      thresholds: portfolioData.thresholds || {},
      breakouts: { creator: [], opponent: [] },
      substitutions: [],
      sessionScores: {
        MORNING_BELL: { creator: 0, opponent: 0, winner: '' },
        MIDDAY: { creator: 0, opponent: 0, winner: '' },
        POWER_HOUR: { creator: 0, opponent: 0, winner: '' },
        NIGHT_GAME: { creator: 0, opponent: 0, winner: '' }
      },

      // Legacy fields
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startingPrices: startingPrices,

      // Training flags
      isTraining: true,
      isTrainingBattle: true,
      createdAt: now.toISOString()
    };

    // Save to Firebase for persistence across sessions
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase/config');

      const firebaseBattle = {
        _v: 2, // BaggerBomb Scoring version marker
        id: battleId,
        mode: 'training',
        type: 'baggerbomb',

        // Players
        player1: {
          odUserId: odUserId,
          username: user.username,
          portfolioName: portfolioData.portfolioName.trim(),
          portfolio: updatedUserPortfolio,
          bench: userBenchAssets,
          portfolioType: 'baggerbomb',
          startValue: 1000000,
          currentValue: 1000000,
          percentChange: 0,
          isCreator: true
        },
        player2: {
          odUserId: 'cpu',
          username: 'CPU Opponent',
          portfolioName: 'CPU BaggerBomb Strategy',
          portfolio: updatedCPUPortfolio,
          bench: cpuPortfolioData.bench,
          portfolioType: 'baggerbomb',
          startValue: 1000000,
          currentValue: 1000000,
          percentChange: 0,
          isCPU: true
        },

        // Timing
        timeline: {
          createdAt: now.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          completedAt: null
        },

        // State
        state: {
          status: 'active',
          startingPrices: startingPrices,
          endingPrices: null
        },

        // BaggerBomb Scoring specific
        thresholds: portfolioData.thresholds || {},
        sessions: {
          MORNING_BELL: { status: 'pending' },
          MIDDAY: { status: 'pending' },
          POWER_HOUR: { status: 'pending' },
          NIGHT_GAME: { status: 'pending' }
        },

        // For querying
        playerIds: [odUserId, 'cpu'],
        creatorId: odUserId,

        // Metadata
        challengeCode: null,
        result: null,
        challengeIds: [],
        midGameChallenges: [],
        halftimeLeader: null,
        archived: false,
        updatedAt: now.toISOString()
      };

      await setDoc(doc(db, 'trainingBattles', battleId), firebaseBattle);
      console.log('✅ BaggerBomb Training battle saved to Firebase:', battleId);
    } catch (firebaseError) {
      console.error('⚠️ Failed to save BaggerBomb training battle to Firebase:', firebaseError);
      // Continue anyway - localStorage backup exists
    }

    // Update component state using functional update to prevent race conditions
    debugBattles('Before BaggerBomb training battle creation', battles);
    setBattles(prevBattles => {
      // Check if battle already exists (prevent duplicates)
      const exists = prevBattles.some(b => b.id === trainingBattle.id);
      if (exists) {
        console.log('⚠️ BaggerBomb Training battle already exists, skipping add');
        return prevBattles;
      }
      const updatedBattles = [...prevBattles, trainingBattle];
      debugBattles('After BaggerBomb training battle creation', updatedBattles);
      saveBattlesSafe(updatedBattles);
      return updatedBattles;
    });
    setActiveBattleId(trainingBattle.id);
    setBuilderMode('create');
    setTrainingBattleType('classic');

    // Navigate to dashboard
    setScreen('dashboard');
    showToast(`BaggerBomb Training battle started vs CPU! 🤖🏈`);
  };

  // ============================================
  // BAGGERBOMB TRAINING V3: CREATE V3 TRAINING BATTLE (Tiered Portfolio)
  // ============================================
  const handleCreateBaggerBombTrainingBattleV3 = async (portfolioData) => {
    // portfolioData comes from SlotBasedBuilder: { star, core, support, bench }

    // Generate CPU portfolio with V3 structure
    const cpuPortfolioData = generateCPUPortfolioBaggerBombV3(stocksData, cryptoData);

    // Calculate start and end dates (1 hour for training)
    const now = new Date();
    const startDate = new Date(now);
    const TRAINING_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
    const endDate = new Date(startDate.getTime() + TRAINING_DURATION);

    // Flatten portfolios to collect all symbols for price fetching
    const userAssets = flattenPortfolio(portfolioData);
    const cpuAssets = flattenPortfolio(cpuPortfolioData.portfolio);
    const userBenchAssets = flattenBench(portfolioData.bench);
    const cpuBenchAssets = flattenBench(cpuPortfolioData.bench);
    const allAssets = [...userAssets, ...cpuAssets, ...userBenchAssets, ...cpuBenchAssets];
    const uniqueSymbols = [...new Set(allAssets.map(a => a?.symbol).filter(Boolean))];

    // Fetch starting prices with cache busting + WebSocket override
    const { startingPrices } = await fetchBattlePrices(uniqueSymbols);

    // Helper to update prices in V3 portfolio
    const updateV3PortfolioPrices = (portfolio) => ({
      star: (portfolio.star || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
      core: (portfolio.core || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
      support: (portfolio.support || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
    });

    const updateV3BenchPrices = (bench) => ({
      stocks: (bench.stocks || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
      crypto: bench.crypto ? { ...bench.crypto, price: startingPrices[bench.crypto.symbol] || bench.crypto.price } : null,
    });

    // Generate unique battle ID
    const battleId = `training_baggerbomb_v3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const odUserId = user.odUserId || user.username;

    // Create V3 training battle object
    const trainingBattle = {
      id: battleId,
      challengeCode: 'TRAINING',
      _v: 3, // V3 version marker (tiered portfolios)

      // Creator object (user)
      creator: {
        uid: user.odUserId || user.username,
        odUserId: user.odUserId || user.username,
        username: user.username,
        portfolioName: 'Training Battle',
        portfolio: updateV3PortfolioPrices(portfolioData),
        bench: updateV3BenchPrices(portfolioData.bench),
        history: {},
      },

      // Opponent object (CPU)
      opponent: {
        uid: 'cpu',
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolioName: 'CPU Strategy',
        portfolio: updateV3PortfolioPrices(cpuPortfolioData.portfolio),
        bench: updateV3BenchPrices(cpuPortfolioData.bench),
        history: {},
      },

      // Timeline
      timeline: {
        createdAt: now.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        completedAt: null,
      },

      // State
      state: {
        status: 'active',
        currentSession: '',
        completedSessions: [],
        startingPrices: startingPrices,
      },

      // Session prices (empty initially)
      sessionPrices: {
        MORNING_BELL: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        MIDDAY: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        POWER_HOUR: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        NIGHT_GAME: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
      },

      // BaggerBomb specific
      breakouts: { creator: [], opponent: [] },
      substitutions: [],
      sessionScores: {
        MORNING_BELL: { creator: 0, opponent: 0, winner: '' },
        MIDDAY: { creator: 0, opponent: 0, winner: '' },
        POWER_HOUR: { creator: 0, opponent: 0, winner: '' },
        NIGHT_GAME: { creator: 0, opponent: 0, winner: '' },
      },

      // Legacy fields
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startingPrices: startingPrices,

      // Training flags
      isTraining: true,
      isTrainingBattle: true,
      createdAt: now.toISOString(),

      // For querying (required by fetchTrainingBattles)
      playerIds: [odUserId, 'cpu'],
      creatorId: odUserId,

      // Player aliases for ActiveBattlesSection compatibility (expects player1/player2)
      player1: {
        odUserId: user.odUserId || user.username,
        username: user.username,
        portfolioName: 'Training Battle',
        portfolio: updateV3PortfolioPrices(portfolioData),
        bench: updateV3BenchPrices(portfolioData.bench),
        portfolioType: 'baggerbomb',
        startValue: 1000000,
        currentValue: 1000000,
        percentChange: 0,
        isCreator: true,
      },
      player2: {
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolioName: 'CPU Strategy',
        portfolio: updateV3PortfolioPrices(cpuPortfolioData.portfolio),
        bench: updateV3BenchPrices(cpuPortfolioData.bench),
        portfolioType: 'baggerbomb',
        startValue: 1000000,
        currentValue: 1000000,
        percentChange: 0,
        isCPU: true,
      },

      // Battle type marker
      type: 'baggerbomb',
    };

    // Save to Firebase for persistence
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase/config');

      await setDoc(doc(db, 'trainingBattles', battleId), trainingBattle);
      console.log('✅ BaggerBomb Training V3 battle saved to Firebase:', battleId);
    } catch (firebaseError) {
      console.error('⚠️ Failed to save BaggerBomb training V3 battle to Firebase:', firebaseError);
    }

    // Update component state
    setBattles(prevBattles => {
      const exists = prevBattles.some(b => b.id === trainingBattle.id);
      if (exists) {
        console.log('⚠️ BaggerBomb Training V3 battle already exists, skipping add');
        return prevBattles;
      }
      const updatedBattles = [...prevBattles, trainingBattle];
      saveBattlesSafe(updatedBattles);
      return updatedBattles;
    });

    setActiveBattleId(trainingBattle.id);
    setBuilderMode('create');
    setTrainingBattleType('classic');

    // Navigate to dashboard
    setScreen('dashboard');
    showToast(`BaggerBomb Training V3 started vs CPU! 🤖💣`);
  };

  // ============================================
  // AGENT DEPLOY: CREATE V3 TRAINING BATTLE FROM AI-GENERATED PORTFOLIO
  // ============================================

  const handleCreateAgentTrainingBattle = async (portfolioData, benchData, agentMeta) => {
    // portfolioData: { star: [...], core: [...], support: [...] } — from api/agent/decide
    // benchData: { stocks: [...], crypto: {...} } — from api/agent/decide
    // agentMeta: { agentId, innerMonologue, strategyBrief }

    // Defensive check: stocksData/cryptoData must be loaded
    if (!stocksData?.length || !cryptoData?.length) {
      showToast('Market data still loading — try again in a moment.');
      return null;
    }

    // 1. Generate CPU portfolio (reuse existing V3 logic)
    const cpuPortfolioData = generateCPUPortfolioBaggerBombV3(stocksData, cryptoData);

    // 2. Calculate timing — use agent battle expiry if available, else 1 hour fallback
    const now = new Date();
    const startDate = new Date(now);
    const endDate = agentMeta?.expiresAt
      ? new Date(agentMeta.expiresAt)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    // 3. Flatten all portfolios + fetch starting prices
    const userAssets = flattenPortfolio(portfolioData);
    const cpuAssets = flattenPortfolio(cpuPortfolioData.portfolio);
    const userBenchAssets = flattenBench(benchData);
    const cpuBenchAssets = flattenBench(cpuPortfolioData.bench);
    const allAssets = [...userAssets, ...cpuAssets, ...userBenchAssets, ...cpuBenchAssets];
    const uniqueSymbols = [...new Set(allAssets.map(a => a?.symbol).filter(Boolean))];

    const { startingPrices } = await fetchBattlePrices(uniqueSymbols);

    // 4. Price update helpers (same as V3 training handler)
    const updateV3PortfolioPrices = (portfolio) => ({
      star: (portfolio.star || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price || 0 } : null),
      core: (portfolio.core || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price || 0 } : null),
      support: (portfolio.support || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price || 0 } : null),
    });

    const updateV3BenchPrices = (bench) => ({
      stocks: (bench.stocks || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price || 0 } : null),
      crypto: bench.crypto ? { ...bench.crypto, price: startingPrices[bench.crypto.symbol] || bench.crypto.price || 0 } : null,
    });

    // 5. Build battle object — identical to V3 training shape + agent metadata
    const battleId = `training_agent_v3_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const odUserId = user.odUserId || user.username;

    const trainingBattle = {
      id: battleId,
      challengeCode: 'TRAINING',
      _v: 3,

      creator: {
        uid: odUserId,
        odUserId: odUserId,
        username: user.username,
        portfolioName: 'Agent Deploy',
        portfolio: updateV3PortfolioPrices(portfolioData),
        bench: updateV3BenchPrices(benchData),
        history: {},
      },

      opponent: {
        uid: 'cpu',
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolioName: 'CPU Strategy',
        portfolio: updateV3PortfolioPrices(cpuPortfolioData.portfolio),
        bench: updateV3BenchPrices(cpuPortfolioData.bench),
        history: {},
      },

      timeline: {
        createdAt: now.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        completedAt: null,
      },

      state: {
        status: 'active',
        currentSession: '',
        completedSessions: [],
        startingPrices: startingPrices,
      },

      sessionPrices: {
        MORNING_BELL: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        MIDDAY: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        POWER_HOUR: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
        NIGHT_GAME: { open: {}, close: {}, capturedAt: { open: '', close: '' } },
      },

      breakouts: { creator: [], opponent: [] },
      substitutions: [],
      sessionScores: {
        MORNING_BELL: { creator: 0, opponent: 0, winner: '' },
        MIDDAY: { creator: 0, opponent: 0, winner: '' },
        POWER_HOUR: { creator: 0, opponent: 0, winner: '' },
        NIGHT_GAME: { creator: 0, opponent: 0, winner: '' },
      },

      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startingPrices: startingPrices,

      isTraining: true,
      isTrainingBattle: true,
      createdAt: now.toISOString(),

      playerIds: [odUserId, 'cpu'],
      creatorId: odUserId,

      player1: {
        odUserId: odUserId,
        username: user.username,
        portfolioName: 'Agent Deploy',
        portfolio: updateV3PortfolioPrices(portfolioData),
        bench: updateV3BenchPrices(benchData),
        portfolioType: 'baggerbomb',
        startValue: 1000000,
        currentValue: 1000000,
        percentChange: 0,
        isCreator: true,
      },
      player2: {
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolioName: 'CPU Strategy',
        portfolio: updateV3PortfolioPrices(cpuPortfolioData.portfolio),
        bench: updateV3BenchPrices(cpuPortfolioData.bench),
        portfolioType: 'baggerbomb',
        startValue: 1000000,
        currentValue: 1000000,
        percentChange: 0,
        isCPU: true,
      },

      type: 'baggerbomb',

      // Agent metadata — links battle to the agent that created it
      agentId: agentMeta.agentId,
      agentDeployed: true,
      agentInnerMonologue: agentMeta.innerMonologue || null,
      agentStrategyBrief: agentMeta.strategyBrief || null,
    };

    // 6. Save to Firebase
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase/config');
      // TODO: Remove training battle creation for agent deploys — dashboard should read from agentBattles directly
      await setDoc(doc(db, 'trainingBattles', battleId), trainingBattle);
      console.log('✅ Agent Training V3 battle saved to Firebase:', battleId);
    } catch (firebaseError) {
      console.error('⚠️ Failed to save agent training battle to Firebase:', firebaseError);
    }

    // 7. Update React state
    setBattles(prevBattles => {
      const exists = prevBattles.some(b => b.id === trainingBattle.id);
      if (exists) return prevBattles;
      const updatedBattles = [...prevBattles, trainingBattle];
      saveBattlesSafe(updatedBattles);
      return updatedBattles;
    });

    setActiveBattleId(trainingBattle.id);
    setCurrentBattle(trainingBattle);
    setScreen('battle');
    showToast(`Agent deployed to BaggerBomb Training! 🤖💣`);

    return battleId;
  };

  // ============================================
  // BAGGERBOMB TRAINING V4: CREATE V4 TRAINING BATTLE (No Bench, 1 Swap, 1 Day)
  // ============================================
  const handleCreateBaggerBombTrainingBattleV4 = async (portfolioData) => {
    // portfolioData from SlotBasedBuilder V4: { star, core, support } (no bench)

    // Generate CPU portfolio V4 (no bench)
    const cpuPortfolio = generateCPUPortfolioBaggerBombV4(stocksData, cryptoData);

    const now = new Date();
    const TRAINING_DURATION = 24 * 60 * 60 * 1000; // 24 hours for V4 training
    const endDate = new Date(now.getTime() + TRAINING_DURATION);

    // Collect all unique symbols
    const userAssets = flattenPortfolio(portfolioData);
    const cpuAssets = flattenPortfolio(cpuPortfolio);
    const allAssets = [...userAssets, ...cpuAssets];
    const uniqueSymbols = [...new Set(allAssets.map(a => a?.symbol).filter(Boolean))];

    // Fetch starting prices with cache busting + WebSocket override
    const { startingPrices } = await fetchBattlePrices(uniqueSymbols);

    const updatePrices = (portfolio) => ({
      star: (portfolio.star || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
      core: (portfolio.core || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
      support: (portfolio.support || []).map(a => a ? { ...a, price: startingPrices[a.symbol] || a.price } : null),
    });

    const battleId = `training_baggerbomb_v5_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const odUserId = user.odUserId || user.username;

    // V5: Build initial crypto pool state
    const cryptoPoolState = {};
    const cryptoPoolSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'BNB'];
    cryptoPoolSymbols.forEach(s => { cryptoPoolState[s] = { inRoster: false }; });

    // Check if any roster crypto is in the pool
    const allRosterAssets = [
      ...(portfolioData.star || []),
      ...(portfolioData.core || []),
      ...(portfolioData.support || []),
    ].filter(Boolean);
    allRosterAssets.forEach(a => {
      if (a.isCrypto && cryptoPoolState[a.symbol]) {
        cryptoPoolState[a.symbol] = { inRoster: true };
      }
    });

    const trainingBattle = {
      id: battleId,
      challengeCode: 'TRAINING',
      _v: 5,
      type: 'baggerbomb_v5',

      creator: {
        uid: odUserId,
        odUserId,
        username: user.username,
        portfolioName: 'Training Battle',
        portfolio: updatePrices(portfolioData),
        swaps: { remaining: { day1: 3 }, history: [] }, // V5: 3 swaps for training
        closedTrades: [],
        history: {},
      },

      opponent: {
        uid: 'cpu',
        odUserId: 'cpu',
        username: 'CPU Opponent',
        portfolioName: 'CPU Strategy',
        portfolio: updatePrices(cpuPortfolio),
        swaps: { remaining: { day1: 0 }, history: [] },
        closedTrades: [],
        history: {},
      },

      cryptoPool: cryptoPoolState,

      timing: {
        createdAt: now.toISOString(),
        tradingDays: 1,
        tradingDayDates: [now.toISOString().split('T')[0]],
        currentTradingDay: 1,
        scheduledEnd: endDate.toISOString(),
      },

      state: {
        status: 'active',
        startingPrices,
        dailyOpenPrices: { day1: startingPrices },
      },

      freeAgents: (() => {
        try {
          const initial = createInitialFreeAgents();
          // Add starting prices for free agents so price display works
          (initial.current || []).forEach(agent => {
            if (agent.symbol && !startingPrices[agent.symbol]) {
              startingPrices[agent.symbol] = 0; // placeholder, real price fetched by battle view
            }
          });
          return initial;
        } catch (e) {
          console.warn('Failed to generate initial free agents:', e);
          return { current: [], nextRotationAt: null, rotationCount: 0, rotationHistory: [] };
        }
      })(),

      isTraining: true,
      isTrainingBattle: true,
      createdAt: now.toISOString(),
      status: 'active',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      startingPrices,
      playerIds: [odUserId, 'cpu'],
      creatorId: odUserId,
      userId: odUserId,
    };

    // Save to Firebase
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./firebase/config');
      await setDoc(doc(db, 'trainingBattles', battleId), trainingBattle);
      console.log('BaggerBomb Training V4 battle saved:', battleId);
    } catch (firebaseError) {
      console.error('Failed to save V4 training battle:', firebaseError);
    }

    setBattles(prevBattles => {
      if (prevBattles.some(b => b.id === trainingBattle.id)) return prevBattles;
      const updated = [...prevBattles, trainingBattle];
      saveBattlesSafe(updated);
      return updated;
    });

    setActiveBattleId(trainingBattle.id);
    setBuilderMode('create');
    setTrainingBattleType('classic');
    setScreen('dashboard');
    showToast(`BaggerBomb Training V4 started vs CPU! 🤖💣`);
  };

  // Generate V4 CPU portfolio (no bench)
  const generateCPUPortfolioBaggerBombV4 = (stocks, crypto) => {
    const sectors = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer Discretionary', 'Industrials'];
    const cpuStocks = [];
    const usedSymbols = new Set();

    sectors.forEach(sector => {
      const sectorStocks = stocks.filter(s =>
        (s.sector === sector || s.category === sector) && !usedSymbols.has(s.symbol)
      );
      if (sectorStocks.length > 0) {
        const pick = sectorStocks[Math.floor(Math.random() * sectorStocks.length)];
        cpuStocks.push(pick);
        usedSymbols.add(pick.symbol);
      }
    });

    while (cpuStocks.length < 6) {
      const pick = stocks[Math.floor(Math.random() * stocks.length)];
      if (!usedSymbols.has(pick.symbol)) {
        cpuStocks.push(pick);
        usedSymbols.add(pick.symbol);
      }
    }

    const formatAsset = (asset, isCrypto = false) => ({
      symbol: asset.symbol,
      name: asset.name || asset.symbol,
      price: asset.price || 0,
      baseATR: asset.baseATR || (isCrypto ? 5.0 : 2.5),
      isCrypto,
    });

    const eligibleCrypto = crypto.filter(c =>
      (!c.category || c.category !== 'Stablecoin') && !usedSymbols.has(c.symbol)
    ).slice(0, 8);
    const mainCrypto = eligibleCrypto[Math.floor(Math.random() * eligibleCrypto.length)];

    // V5: Random crypto direction for CPU (70% long, 30% short)
    const cpuCryptoDirection = Math.random() < 0.7 ? 'long' : 'short';

    return {
      star: [formatAsset(cpuStocks[0]), formatAsset(cpuStocks[1])],
      core: [formatAsset(cpuStocks[2]), formatAsset(cpuStocks[3])],
      support: [
        formatAsset(cpuStocks[4]),
        formatAsset(cpuStocks[5]),
        mainCrypto ? { ...formatAsset(mainCrypto, true), direction: cpuCryptoDirection } : null,
      ],
    };
  };

  // Generate CPU portfolio for BaggerBomb mode
  const generateCPUPortfolioBaggerBomb = (stocks, crypto) => {
    // Select random stocks with varied thresholds from different sectors
    const sectors = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer Discretionary', 'Industrials'];
    const cpuStocks = [];

    // Pick stocks from different sectors
    sectors.forEach(sector => {
      const sectorStocks = stocks.filter(s =>
        s.sector === sector || s.category === sector
      );
      if (sectorStocks.length > 0) {
        const randomStock = sectorStocks[Math.floor(Math.random() * sectorStocks.length)];
        if (!cpuStocks.find(s => s.symbol === randomStock.symbol)) {
          cpuStocks.push(randomStock);
        }
      }
    });

    // Fill to 7 stocks if needed
    while (cpuStocks.length < 7) {
      const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
      if (!cpuStocks.find(s => s.symbol === randomStock.symbol)) {
        cpuStocks.push(randomStock);
      }
    }

    // Limit to 7 stocks max
    const selectedStocks = cpuStocks.slice(0, 7);

    // Distribute allocations evenly (90% for stocks)
    const allocation = 90 / selectedStocks.length;
    const portfolio = selectedStocks.map(stock => ({
      symbol: stock.symbol,
      name: stock.name || stock.symbol,
      price: stock.price || 0,
      amount: Math.round((allocation / 100) * 1000000),
      position: 'long'
    }));

    // Add random crypto (10%)
    const eligibleCrypto = crypto.filter(c =>
      !c.category || c.category !== 'Stablecoin'
    ).slice(0, 8);
    const randomCrypto = eligibleCrypto[Math.floor(Math.random() * eligibleCrypto.length)];
    if (randomCrypto) {
      portfolio.push({
        symbol: randomCrypto.symbol,
        name: randomCrypto.name || randomCrypto.symbol,
        price: randomCrypto.price || 0,
        amount: 100000, // Fixed 10%
        position: 'long'
      });
    }

    // Generate bench (4 stocks + 1 crypto)
    const bench = [];
    const usedSymbols = new Set(portfolio.map(p => p.symbol));

    // Add bench stocks
    for (let i = 0; i < 4 && bench.length < 4; i++) {
      const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
      if (!usedSymbols.has(randomStock.symbol)) {
        usedSymbols.add(randomStock.symbol);
        bench.push({
          symbol: randomStock.symbol,
          name: randomStock.name || randomStock.symbol,
          price: randomStock.price || 0,
          amount: 0,
          position: 'long'
        });
      }
    }

    // Add bench crypto (different from main crypto)
    const benchCrypto = eligibleCrypto.find(c =>
      c.symbol !== randomCrypto?.symbol && !usedSymbols.has(c.symbol)
    );
    if (benchCrypto) {
      bench.push({
        symbol: benchCrypto.symbol,
        name: benchCrypto.name || benchCrypto.symbol,
        price: benchCrypto.price || 0,
        amount: 0,
        position: 'long'
      });
    }

    return { portfolio, bench };
  };

  // Generate V3 CPU portfolio for BaggerBomb Training mode (tiered structure)
  const generateCPUPortfolioBaggerBombV3 = (stocks, crypto) => {
    // Select random stocks with varied thresholds from different sectors
    const sectors = ['Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer Discretionary', 'Industrials'];
    const cpuStocks = [];
    const usedSymbols = new Set();

    // Pick stocks from different sectors
    sectors.forEach(sector => {
      const sectorStocks = stocks.filter(s =>
        (s.sector === sector || s.category === sector) && !usedSymbols.has(s.symbol)
      );
      if (sectorStocks.length > 0) {
        const randomStock = sectorStocks[Math.floor(Math.random() * sectorStocks.length)];
        cpuStocks.push(randomStock);
        usedSymbols.add(randomStock.symbol);
      }
    });

    // Fill to 6 stocks if needed (2 star + 2 core + 2 support stocks)
    while (cpuStocks.length < 6) {
      const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
      if (!usedSymbols.has(randomStock.symbol)) {
        cpuStocks.push(randomStock);
        usedSymbols.add(randomStock.symbol);
      }
    }

    // Helper to format asset for V3 structure
    const formatV3Asset = (asset, isCrypto = false) => ({
      symbol: asset.symbol,
      name: asset.name || asset.symbol,
      price: asset.price || 0,
      baseATR: asset.baseATR || (isCrypto ? 5.0 : 2.5),
      isCrypto,
    });

    // Select crypto for support slot
    const eligibleCrypto = crypto.filter(c =>
      (!c.category || c.category !== 'Stablecoin') && !usedSymbols.has(c.symbol)
    ).slice(0, 8);
    const mainCrypto = eligibleCrypto[Math.floor(Math.random() * eligibleCrypto.length)];
    if (mainCrypto) usedSymbols.add(mainCrypto.symbol);

    // Build V3 tiered portfolio
    const portfolio = {
      star: [
        formatV3Asset(cpuStocks[0]),
        formatV3Asset(cpuStocks[1]),
      ],
      core: [
        formatV3Asset(cpuStocks[2]),
        formatV3Asset(cpuStocks[3]),
      ],
      support: [
        formatV3Asset(cpuStocks[4]),
        formatV3Asset(cpuStocks[5]),
        mainCrypto ? formatV3Asset(mainCrypto, true) : null,
      ],
    };

    // Generate bench (3 stocks + 1 crypto)
    const benchStocks = [];
    for (let i = 0; i < 3; i++) {
      const remaining = stocks.filter(s => !usedSymbols.has(s.symbol));
      if (remaining.length > 0) {
        const randomStock = remaining[Math.floor(Math.random() * remaining.length)];
        benchStocks.push(formatV3Asset(randomStock));
        usedSymbols.add(randomStock.symbol);
      }
    }

    // Bench crypto (different from main crypto)
    const benchCrypto = eligibleCrypto.find(c => !usedSymbols.has(c.symbol));

    const bench = {
      stocks: benchStocks,
      crypto: benchCrypto ? formatV3Asset(benchCrypto, true) : null,
    };

    return { portfolio, bench };
  };

  // ============================================
  // 5. COMPUTED VALUES
  // ============================================

  // Total percentage including stocks AND crypto
  const stockPercentage = portfolio.reduce((sum, p) => sum + (p.percentage || 0), 0);
  const totalPercentage = stockPercentage + (selectedCrypto ? cryptoPercentage : 0);
  const isPortfolioValid = portfolio.length >= 6 &&
    portfolio.length <= 12 &&
    selectedCrypto &&
    Math.abs(totalPercentage - 100) < 0.01 &&
    portfolio.every(p => p.percentage >= 7.5 && p.percentage <= 20) &&
    cryptoPercentage >= 7.5 && cryptoPercentage <= 20;

  const availableAssets = assetType === 'stocks' ? stocksData : cryptoData;
  const filteredAssets = availableAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get battles for current user (handles both V1 string and V2/V3 object formats)
  // Matches by username (V1/V2) OR by odUserId (V3) for cross-device robustness
  const currentUserId = user?.odUserId || user?.username;
  const userBattles = battles.filter(b =>
    getUsername(b.creator) === user?.username || getUsername(b.opponent) === user?.username ||
    getUserId(b.creator) === currentUserId || getUserId(b.opponent) === currentUserId,
    'userBattles from battles'
  );

  // Separate battles by status
  const activeBattles = userBattles.filter(b =>
    battleTimer.getBattleStatus(b) === 'active',
    'activeBattles from userBattles'
  );
  const waitingBattles = userBattles.filter(b =>
    battleTimer.getBattleStatus(b) === 'waiting',
    'waitingBattles from userBattles'
  );
  const completedBattles = userBattles.filter(b =>
    battleTimer.getBattleStatus(b) === 'completed',
    'completedBattles from userBattles'
  );
  const completedV4Battles = completedBattles.filter(b =>
    (b._v === 3 || b._v === 4) && b.result
  );

  // ============================================
  // 6. SCREEN RENDERS
  // ============================================

  // ============================================
  // GLOBAL OVERLAYS - Toast & Slot Machine
  // ============================================

  // Challenge Toast Notification (renders on all screens)
  const ChallengeToast = () => (
    showChallengeToast && (
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.95), rgba(139, 69, 219, 0.95))',
          padding: '16px 24px',
          borderRadius: '12px',
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          maxWidth: '90%'
        }}
      >
        <p style={{
          color: '#fff',
          fontWeight: '600',
          fontSize: '14px',
          margin: 0,
          textAlign: 'center'
        }}>
          {toastMessage}
        </p>
      </motion.div>
    )
  );

  // ⭐ Mid-Game Challenge Achievement Popup
  const MidGameChallengePopup = () => {
    useEffect(() => {
      if (midGameChallengePopup) {
        // Auto-close after 4 seconds
        const timer = setTimeout(() => {
          setMidGameChallengePopup(null);
        }, 4000);
        return () => clearTimeout(timer);
      }
    }, [midGameChallengePopup]);

    if (!midGameChallengePopup) return null;

    return (
      <motion.div
        initial={{ y: -100, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.8 }}
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #161b22 0%, #1a1f2e 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '16px',
          padding: '20px 24px',
          zIndex: 10000,
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
          minWidth: '280px',
          maxWidth: '90%'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Icon */}
          <div style={{
            width: '50px',
            height: '50px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0
          }}>
            🎯
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{
              color: '#f59e0b',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              Challenge Complete!
            </div>
            <div style={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '2px'
            }}>
              {midGameChallengePopup.title}
            </div>
            <div style={{
              color: '#8b949e',
              fontSize: '12px',
              marginBottom: '4px'
            }}>
              {midGameChallengePopup.description}
            </div>
            <div style={{
              color: '#22c55e',
              fontSize: '14px',
              fontWeight: '700'
            }}>
              +{midGameChallengePopup.xp} XP
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setMidGameChallengePopup(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6e7681',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '18px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Progress bar animation */}
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: 4, ease: 'linear' }}
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            borderRadius: '2px',
            marginTop: '12px'
          }}
        />
      </motion.div>
    );
  };

  // ⭐ RISK CHALLENGE POPUP - Accept/Skip Challenge
  const RiskChallengePopup = () => {
    const [selectedOption, setSelectedOption] = useState(null);
    const [timeLeft, setTimeLeft] = useState(300);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get user's portfolio for double down challenge (V3-safe via portfolioHelpers)
    const userPortfolio = getUserPortfolioFlat(currentBattle, user?.username);
    const userStocks = userPortfolio.filter(a => a?.position !== 'short').map(a => a?.symbol).filter(Boolean);

    // Countdown timer
    useEffect(() => {
      if (!activeRiskChallenge || !showRiskChallengePopup) return;

      const deadline = new Date(activeRiskChallenge.acceptDeadline);
      const interval = setInterval(() => {
        const now = new Date();
        const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
        setTimeLeft(remaining);

        if (remaining === 0) {
          clearInterval(interval);
          setShowRiskChallengePopup(false);
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [activeRiskChallenge, showRiskChallengePopup]);

    if (!activeRiskChallenge || !showRiskChallengePopup) return null;

    // Get options based on challenge type
    const getOptions = () => {
      if (activeRiskChallenge.type === 'double_down') {
        return userStocks;
      }
      return activeRiskChallenge.options || [];
    };

    const handleSubmit = async () => {
      if (!selectedOption) return;
      setIsSubmitting(true);
      await respondToRiskChallenge(selectedOption);
      setIsSubmitting(false);
      setSelectedOption(null);
    };

    const formatTimeLeft = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const potentialSwing = Math.round(1000000 * (activeRiskChallenge.riskRewardPercent / 100));
    const options = getOptions();

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 10001
      }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: 'linear-gradient(135deg, #161b22 0%, #1a1f2e 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '400px',
            overflow: 'hidden',
            boxShadow: '0 0 40px rgba(245, 158, 11, 0.3)'
          }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>
              {activeRiskChallenge.emoji}
            </div>
            <h2 style={{
              color: '#0d1117',
              fontSize: '20px',
              fontWeight: '800',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {activeRiskChallenge.name}
            </h2>
            <div style={{
              color: 'rgba(0,0,0,0.7)',
              fontSize: '12px',
              marginTop: '4px'
            }}>
              RISK CHALLENGE
            </div>
          </div>

          {/* Timer Bar */}
          <div style={{
            background: '#0d1117',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>
              Time to decide:
            </span>
            <span style={{
              color: timeLeft < 60 ? '#ef4444' : '#f59e0b',
              fontSize: '18px',
              fontWeight: '700',
              fontFamily: 'monospace'
            }}>
              {formatTimeLeft(timeLeft)}
            </span>
          </div>

          {/* Question */}
          <div style={{ padding: '20px' }}>
            <p style={{
              color: '#ffffff',
              fontSize: '16px',
              textAlign: 'center',
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              {activeRiskChallenge.question}
            </p>

            {/* Risk/Reward Display */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#22c55e', fontSize: '12px', marginBottom: '2px' }}>
                  WIN
                </div>
                <div style={{ color: '#22c55e', fontSize: '18px', fontWeight: '700' }}>
                  +${potentialSwing.toLocaleString()}
                </div>
              </div>
              <div style={{ width: '1px', background: '#21262d' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '2px' }}>
                  LOSE
                </div>
                <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: '700' }}>
                  -${potentialSwing.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Options */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: options.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
              gap: '10px',
              marginBottom: '20px',
              maxHeight: options.length > 4 ? '200px' : 'auto',
              overflowY: options.length > 4 ? 'auto' : 'visible'
            }}>
              {options.map(option => {
                const isUp = option === 'above' || option === 'higher' || option === 'up';
                const isDown = option === 'below' || option === 'lower' || option === 'down';
                const isStock = !isUp && !isDown;

                return (
                  <button
                    key={option}
                    onClick={() => setSelectedOption(option)}
                    style={{
                      padding: '14px 16px',
                      background: selectedOption === option
                        ? isStock ? 'rgba(0, 217, 255, 0.2)'
                          : isUp ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)'
                        : '#0d1117',
                      border: selectedOption === option
                        ? isStock ? '2px solid #00d9ff'
                          : isUp ? '2px solid #22c55e'
                          : '2px solid #ef4444'
                        : '2px solid #21262d',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isUp ? '▲ ' : isDown ? '▼ ' : ''}
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            padding: '0 20px 20px 20px',
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={() => {
                setShowRiskChallengePopup(false);
                setSelectedOption(null);
              }}
              style={{
                flex: 1,
                padding: '14px',
                background: 'transparent',
                border: '2px solid #21262d',
                borderRadius: '10px',
                color: '#8b949e',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedOption || isSubmitting}
              style={{
                flex: 2,
                padding: '14px',
                background: selectedOption
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : '#21262d',
                border: 'none',
                borderRadius: '10px',
                color: selectedOption ? '#0d1117' : '#6b7280',
                fontSize: '14px',
                fontWeight: '700',
                cursor: selectedOption ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? 'Submitting...' : '🎯 Accept Challenge'}
            </button>
          </div>

          {/* Warning */}
          <div style={{
            padding: '12px 20px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
            textAlign: 'center'
          }}>
            <span style={{ color: '#ef4444', fontSize: '11px' }}>
              ⚠️ This is a risk! You could lose ${potentialSwing.toLocaleString()} if wrong
            </span>
          </div>
        </motion.div>
      </div>
    );
  };

  // ⭐ ACTIVE RISK CHALLENGE INDICATOR - Shows in battle view
  const ActiveRiskChallengeIndicator = () => {
    if (!activeRiskChallenge || activeRiskChallenge.status === 'resolved') return null;

    const isCreator = currentBattle?.creator === user?.username;
    const userResponse = isCreator
      ? activeRiskChallenge.player1Response
      : activeRiskChallenge.player2Response;
    const hasResponded = !!userResponse;

    // Calculate time until resolution
    const resolvesAt = new Date(activeRiskChallenge.resolvesAt);
    const now = new Date();
    const timeUntilResolve = Math.max(0, Math.floor((resolvesAt - now) / 1000 / 60));

    return (
      <div
        onClick={() => !hasResponded && setShowRiskChallengePopup(true)}
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px',
          cursor: hasResponded ? 'default' : 'pointer',
          animation: hasResponded ? 'none' : 'pulse 2s infinite'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{activeRiskChallenge.emoji}</span>
            <div>
              <div style={{
                color: '#f59e0b',
                fontSize: '12px',
                fontWeight: '700',
                textTransform: 'uppercase',
                marginBottom: '2px'
              }}>
                {hasResponded ? '⏳ Challenge Active' : '🎯 New Challenge!'}
              </div>
              <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                {activeRiskChallenge.name}
              </div>
              {hasResponded && (
                <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>
                  Resolves in ~{timeUntilResolve} min
                </div>
              )}
            </div>
          </div>

          {hasResponded ? (
            <div style={{
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              ✓ {userResponse.prediction.toUpperCase()}
            </div>
          ) : (
            <div style={{
              background: '#f59e0b',
              color: '#0d1117',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              RESPOND →
            </div>
          )}
        </div>
      </div>
    );
  };

  // ⭐ RISK CHALLENGE RESULT POPUP - Shows when challenge resolves
  const RiskChallengeResultPopup = () => {
    if (!riskChallengeResult) return null;

    const { challenge, result } = riskChallengeResult;
    const isCreator = currentBattle?.creator === user?.username;
    const userWon = isCreator ? result.player1Won : result.player2Won;
    const adjustment = isCreator ? result.player1Adjustment : result.player2Adjustment;
    const userParticipated = isCreator
      ? challenge.player1Response?.accepted
      : challenge.player2Response?.accepted;

    // If user didn't participate, just close
    if (!userParticipated) {
      setTimeout(() => setRiskChallengeResult(null), 100);
      return null;
    }

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 10001
      }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: '#161b22',
            border: `2px solid ${userWon ? '#22c55e' : '#ef4444'}`,
            borderRadius: '20px',
            width: '100%',
            maxWidth: '350px',
            textAlign: 'center',
            overflow: 'hidden',
            boxShadow: `0 0 40px ${userWon ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}
        >
          {/* Result Header */}
          <div style={{
            background: userWon
              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            padding: '30px 20px'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '12px' }}>
              {userWon ? '🎉' : '😔'}
            </div>
            <h2 style={{
              color: '#ffffff',
              fontSize: '24px',
              fontWeight: '800',
              margin: 0,
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              {userWon ? 'YOU WON!' : 'YOU LOST'}
            </h2>
          </div>

          {/* Challenge Details */}
          <div style={{ padding: '24px' }}>
            <div style={{
              color: '#8b949e',
              fontSize: '13px',
              marginBottom: '8px'
            }}>
              {challenge.name}
            </div>

            {/* Result Details */}
            <div style={{
              background: '#0d1117',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              {(challenge.type === 'sp_close' || challenge.type === 'crypto_call' || challenge.type === 'stock_direction') && (
                <>
                  <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '4px' }}>
                    {challenge.targetSymbol} closed at
                  </div>
                  <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700' }}>
                    ${result.actualPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{
                    color: result.actualDirection === 'above' || result.actualDirection === 'higher' || result.actualDirection === 'up'
                      ? '#22c55e'
                      : '#ef4444',
                    fontSize: '14px',
                    marginTop: '4px'
                  }}>
                    {result.actualDirection?.toUpperCase()} the target
                  </div>
                </>
              )}

              {challenge.type === 'stock_duel' && (
                <>
                  <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '8px' }}>
                    Stock Performance
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <div>
                      <div style={{ color: '#ffffff', fontWeight: '700' }}>
                        {result.player1Stock}
                      </div>
                      <div style={{
                        color: result.player1StockChange >= 0 ? '#22c55e' : '#ef4444'
                      }}>
                        {result.player1StockChange >= 0 ? '+' : ''}{result.player1StockChange?.toFixed(2)}%
                      </div>
                    </div>
                    <div style={{ color: '#8b949e' }}>vs</div>
                    <div>
                      <div style={{ color: '#ffffff', fontWeight: '700' }}>
                        {result.player2Stock}
                      </div>
                      <div style={{
                        color: result.player2StockChange >= 0 ? '#22c55e' : '#ef4444'
                      }}>
                        {result.player2StockChange >= 0 ? '+' : ''}{result.player2StockChange?.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </>
              )}

              {challenge.type === 'double_down' && (
                <>
                  <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '4px' }}>
                    Your stock performance
                  </div>
                  <div style={{
                    color: (isCreator ? result.player1StockChange : result.player2StockChange) >= 0
                      ? '#22c55e' : '#ef4444',
                    fontSize: '20px',
                    fontWeight: '700'
                  }}>
                    {(isCreator ? result.player1StockChange : result.player2StockChange) >= 0 ? '+' : ''}
                    {(isCreator ? result.player1StockChange : result.player2StockChange)?.toFixed(2)}%
                  </div>
                </>
              )}
            </div>

            {/* Portfolio Adjustment */}
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: adjustment >= 0 ? '#22c55e' : '#ef4444',
              marginBottom: '20px'
            }}>
              {adjustment >= 0 ? '+' : ''}${Math.abs(adjustment).toLocaleString()}
            </div>

            <button
              onClick={() => setRiskChallengeResult(null)}
              style={{
                width: '100%',
                padding: '14px',
                background: userWon
                  ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                  : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Continue Battle
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  // ============================================
  // TUTORIAL MODAL COMPONENT
  // ============================================
  const TutorialModal = () => {
    if (!showTutorial) return null;

    const tutorial = TUTORIALS[tutorialMode];
    const currentStep = tutorial.steps[tutorialStep];

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(12px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          animation: 'fade-in 0.2s ease'
        }}
        onClick={() => setShowTutorial(false)}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
            borderRadius: '24px',
            border: `2px solid ${tutorial.color}`,
            maxWidth: '420px',
            width: '100%',
            maxHeight: '85vh',
            overflow: 'hidden',
            boxShadow: `0 0 60px ${tutorial.color}33`,
            animation: 'slide-up 0.3s ease'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${tutorial.color}22 0%, transparent 100%)`,
            padding: '20px 24px',
            borderBottom: '1px solid #21262d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: `${tutorial.color}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BookOpen size={20} style={{ color: tutorial.color }} />
              </div>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#ffffff'
              }}>
                {tutorial.title}
              </h2>
            </div>
            <button
              onClick={() => setShowTutorial(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: '#6e7681',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '6px 10px',
                lineHeight: 1,
                transition: 'all 0.2s'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>
            {/* Step Badge */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <span style={{
                background: tutorial.color,
                color: '#0d1117',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                letterSpacing: '0.5px'
              }}>
                STEP {tutorialStep + 1} OF {tutorial.steps.length}
              </span>
            </div>

            {/* Icon */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '56px',
                lineHeight: 1,
                animation: 'bounce 2s ease-in-out infinite'
              }}>
                {currentStep.icon}
              </div>
            </div>

            {/* Title */}
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '22px',
              fontWeight: '700',
              color: tutorial.color,
              textAlign: 'center'
            }}>
              {currentStep.title}
            </h3>

            {/* Description */}
            <p style={{
              margin: '0 0 20px',
              fontSize: '15px',
              color: '#c9d1d9',
              textAlign: 'center',
              lineHeight: 1.7
            }}>
              {currentStep.description}
            </p>

            {/* Tip Box */}
            <div style={{
              background: `${tutorial.color}12`,
              border: `1px solid ${tutorial.color}33`,
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <span style={{ fontSize: '16px' }}>💡</span>
                <span style={{
                  fontSize: '14px',
                  color: tutorial.color,
                  fontWeight: '500',
                  lineHeight: 1.5
                }}>
                  {currentStep.tip}
                </span>
              </div>
            </div>

            {/* Progress Dots */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '24px'
            }}>
              {tutorial.steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setTutorialStep(index)}
                  style={{
                    width: index === tutorialStep ? '28px' : '10px',
                    height: '10px',
                    borderRadius: '5px',
                    border: 'none',
                    background: index === tutorialStep ? tutorial.color : '#21262d',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: index <= tutorialStep ? 1 : 0.5
                  }}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTutorialStep(prev => Math.max(0, prev - 1))}
                disabled={tutorialStep === 0}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '12px',
                  border: '2px solid #21262d',
                  background: 'transparent',
                  color: tutorialStep === 0 ? '#6e7681' : '#ffffff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: tutorialStep === 0 ? 'not-allowed' : 'pointer',
                  opacity: tutorialStep === 0 ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                ← Previous
              </button>
              {tutorialStep < tutorial.steps.length - 1 ? (
                <button
                  onClick={() => setTutorialStep(prev => prev + 1)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${tutorial.color} 0%, ${tutorial.color}cc 100%)`,
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: `0 4px 20px ${tutorial.color}44`
                  }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => setShowTutorial(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '12px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${tutorial.color} 0%, ${tutorial.color}cc 100%)`,
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: `0 4px 20px ${tutorial.color}44`
                  }}
                >
                  Got It! ✓
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // SCREEN ROUTING (wrapped in function for unified return with ClashBot widget)
  // ============================================
  // ============================================
  // SPOTLIGHT TOUR CONSTANTS
  // ============================================
  const TOUR_CONSTANTS = {
    TOOLTIP_HEIGHT: 220,
    TOOLTIP_OFFSET: 25,
    MIN_TOP_MARGIN: 20,
    MAX_BOTTOM_MARGIN: 280,
    SCROLL_OFFSET_ABOVE: 300,
    SCROLL_OFFSET_BELOW: 100,
    ANIMATION_DELAY: 500,
    SPOTLIGHT_PADDING: 10,
    ARROW_OFFSET: 13,
    Z_INDEX: 9999
  };

  // ============================================
  // SPOTLIGHT TOUR COMPONENT - v10 (Bug fixes + fallback mode)
  // ============================================
  const SpotlightTour = () => {
    if (!showSpotlightTour) return null;

    const currentStep = TOUR_STEPS[tourStep];
    const [spotlightRect, setSpotlightRect] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, arrowTop: 0, arrowDirection: 'up' });
    const [isReady, setIsReady] = useState(false);

    // NO SCROLL LOCK - user can scroll freely

    useEffect(() => {
      setIsReady(false);
      setSpotlightRect(null);

      if (!currentStep.target) {
        setIsReady(true);
        return;
      }

      const element = document.getElementById(currentStep.target);
      if (!element) {
        // Silent fallback - element not found, showing centered tooltip
        setSpotlightRect(null); // No spotlight, but that's okay
        setTooltipPos({
          top: window.innerHeight / 2 - 110,
          arrowTop: 0,
          arrowDirection: 'none' // No arrow when fallback
        });
        setIsReady(true);
        return;
      }

      // Scroll element into view
      const rect = element.getBoundingClientRect();
      const absoluteTop = window.pageYOffset + rect.top;

      if (currentStep.position === 'spotlight-above') {
        // Element at bottom, scroll so there's room for tooltip above
        const scrollTarget = absoluteTop - window.innerHeight + rect.height + TOUR_CONSTANTS.SCROLL_OFFSET_ABOVE;
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      } else {
        // Element at top
        const scrollTarget = absoluteTop - TOUR_CONSTANTS.SCROLL_OFFSET_BELOW;
        window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      }

      setTimeout(() => {
        const newRect = element.getBoundingClientRect();
        const padding = TOUR_CONSTANTS.SPOTLIGHT_PADDING;

        setSpotlightRect({
          top: newRect.top - padding,
          left: newRect.left - padding,
          width: newRect.width + padding * 2,
          height: newRect.height + padding * 2
        });

        // Calculate tooltip position with clamping to prevent off-screen
        if (currentStep.position === 'spotlight-above') {
          const tooltipHeight = TOUR_CONSTANTS.TOOLTIP_HEIGHT;
          const calculatedTop = newRect.top - tooltipHeight - TOUR_CONSTANTS.TOOLTIP_OFFSET;
          setTooltipPos({
            top: Math.max(TOUR_CONSTANTS.MIN_TOP_MARGIN, calculatedTop),
            arrowTop: Math.max(tooltipHeight + TOUR_CONSTANTS.TOOLTIP_OFFSET, newRect.top - TOUR_CONSTANTS.ARROW_OFFSET),
            arrowDirection: 'down'
          });
        } else {
          const calculatedTop = newRect.bottom + TOUR_CONSTANTS.TOOLTIP_OFFSET;
          const maxTop = window.innerHeight - TOUR_CONSTANTS.MAX_BOTTOM_MARGIN;
          setTooltipPos({
            top: Math.min(calculatedTop, maxTop),
            arrowTop: newRect.bottom + TOUR_CONSTANTS.ARROW_OFFSET,
            arrowDirection: 'up'
          });
        }

        setIsReady(true);
      }, TOUR_CONSTANTS.ANIMATION_DELAY);
    }, [tourStep, currentStep]);

    // Escape key to close tour
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setShowSpotlightTour(false);
          setTourStep(0);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleNext = () => {
      if (tourStep < TOUR_STEPS.length - 1) setTourStep(tourStep + 1);
    };

    const handleBack = () => {
      if (tourStep > 0) setTourStep(tourStep - 1);
    };

    const handleClose = () => {
      setShowSpotlightTour(false);
      setTourStep(0);
    };

    const handleStartTraining = (mode) => {
      handleClose();
      if (mode === 'classic') {
        if (typeof setShowClassicTrainingConfirm === 'function') {
          setShowClassicTrainingConfirm(true);
        } else {
          setScreen('training');
        }
      } else {
        setScreen('draftTraining');
      }
    };

    // CENTERED MODAL (Steps 0 and 9)
    if (currentStep.position === 'center') {
      return (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.92)',
          zIndex: TOUR_CONSTANTS.Z_INDEX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1a2332 0%, #0d1117 100%)',
            borderRadius: '20px',
            border: '2px solid #10b981',
            padding: '32px 28px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: '800', color: '#fff' }}>
              {currentStep.title}
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '15px', color: '#9CA3AF', lineHeight: 1.6 }}>
              {currentStep.description}
            </p>

            {currentStep.showActions ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => handleStartTraining('classic')} style={{
                  padding: '14px', background: 'linear-gradient(135deg, #00d9ff, #0099cc)',
                  border: 'none', borderRadius: '10px', color: '#0d1117', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
                }}>⚔️ Try Classic Training</button>
                <button onClick={() => handleStartTraining('draft')} style={{
                  padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
                }}>🐍 Try Snake Draft Training</button>
                <button onClick={handleClose} style={{
                  padding: '12px', background: 'transparent', border: '1px solid #21262d',
                  borderRadius: '8px', color: '#6e7681', fontSize: '13px', cursor: 'pointer'
                }}>I'll explore on my own</button>
              </div>
            ) : (
              <button onClick={handleNext} style={{
                width: '100%', padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: '700', cursor: 'pointer'
              }}>Let's Go!</button>
            )}
            <TourProgressDots currentStep={tourStep} totalSteps={TOUR_STEPS.length} />
          </div>
        </div>
      );
    }

    // SPOTLIGHT VIEW - Loading (only check isReady, spotlightRect can be null for fallback)
    if (!isReady) {
      return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.88)', zIndex: TOUR_CONSTANTS.Z_INDEX
        }} />
      );
    }

    // SPOTLIGHT VIEW - Ready
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: TOUR_CONSTANTS.Z_INDEX, pointerEvents: 'none'
      }}>
        {/* Dark overlay with spotlight hole - only if spotlightRect exists */}
        {spotlightRect && (
          <svg style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'auto'
          }} onClick={handleClose}>
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={spotlightRect.left} y={spotlightRect.top}
                  width={spotlightRect.width} height={spotlightRect.height}
                  rx="12" fill="black"
                />
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.88)" mask="url(#spotlight-mask)" />
          </svg>
        )}

        {/* If no spotlight (fallback), just show dark overlay */}
        {!spotlightRect && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.88)',
              pointerEvents: 'auto'
            }}
            onClick={handleClose}
          />
        )}

        {/* Green border glow - only if spotlightRect exists */}
        {spotlightRect && (
          <div style={{
            position: 'absolute',
            top: spotlightRect.top, left: spotlightRect.left,
            width: spotlightRect.width, height: spotlightRect.height,
            borderRadius: '12px',
            border: '2px solid #10b981',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
            pointerEvents: 'none'
          }} />
        )}

        {/* Arrow - only show if we have a spotlight and valid direction */}
        {spotlightRect && tooltipPos.arrowDirection !== 'none' && (
          <div style={{
            position: 'absolute',
            top: tooltipPos.arrowTop,
            left: spotlightRect.left + spotlightRect.width / 2 - 10,
            width: 0, height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderBottom: tooltipPos.arrowDirection === 'up' ? '12px solid #1a2332' : 'none',
            borderTop: tooltipPos.arrowDirection === 'down' ? '12px solid #1a2332' : 'none',
            pointerEvents: 'none', zIndex: 10001
          }} />
        )}

        {/* Tooltip */}
        <div style={{
          position: 'absolute',
          top: tooltipPos.top,
          left: '50%', transform: 'translateX(-50%)',
          width: '340px', maxWidth: 'calc(100% - 40px)',
          background: 'linear-gradient(145deg, #1a2332 0%, #0d1117 100%)',
          borderRadius: '16px', border: '1px solid #21262d',
          padding: '20px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          pointerEvents: 'auto', zIndex: 10000
        }} onClick={(e) => e.stopPropagation()}>

          <div style={{
            fontSize: '10px', fontWeight: '700', color: '#10b981',
            marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px'
          }}>
            Step {tourStep} of {TOUR_STEPS.length - 1}
          </div>

          <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#fff' }}>
            {currentStep.title}
          </h3>

          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9CA3AF', lineHeight: 1.6 }}>
            {currentStep.description}
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            {tourStep > 1 && (
              <button onClick={handleBack} style={{
                padding: '10px 16px', background: 'transparent', border: '1px solid #21262d',
                borderRadius: '8px', color: '#9CA3AF', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}>← Back</button>
            )}
            <button onClick={handleNext} style={{
              flex: 1, padding: '10px 16px', background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
            }}>{tourStep === TOUR_STEPS.length - 2 ? 'Finish' : 'Next'}</button>
          </div>

          <button onClick={handleClose} style={{
            width: '100%', marginTop: '10px', padding: '8px',
            background: 'transparent', border: 'none', color: '#6e7681', fontSize: '11px', cursor: 'pointer'
          }}>Skip tour</button>
        </div>

        {/* Progress dots at bottom */}
        <div style={{
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '6px', pointerEvents: 'none', zIndex: 10002
        }}>
          {TOUR_STEPS.map((_, index) => (
            <div key={index} style={{
              width: index === tourStep ? '20px' : '6px', height: '6px', borderRadius: '3px',
              background: index <= tourStep ? '#10b981' : 'rgba(255,255,255,0.2)'
            }} />
          ))}
        </div>
      </div>
    );
  };
  const getScreenContent = () => {

  // FORGE SCREEN
  if (showForge) {
    return (
      <div style={{
        marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0,
        transition: 'margin-left 0.2s ease',
        minHeight: '100vh',
        background: isDesktop ? '#111318' : '#0D0E12',
      }}>
        <ForgeScreen
          isMobile={isMobile}
          onClose={() => setShowForge(false)}
          user={user}
        />
      </div>
    );
  }

  // AUTH LOADING - Show loading screen while Firebase Auth checks session
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#0a0a0f',
        color: '#00d9ff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', background: 'linear-gradient(90deg, #FF8C00, #468CFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            FantasyTrades
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN - Extracted to HomeScreen component
  if (screen === 'home') {
    return (
      <HomeScreen
        containerStyle={containerStyle}
        isDesktop={isDesktop}
        login={login}
        register={register}
        loginWithGoogle={loginWithGoogle}
        forgotPassword={forgotPassword}
        setScreen={setScreen}
      />
    );
  }

  // RESEARCH MODE SCREEN - ENHANCED VERSION


  // DASHBOARD SCREEN
  if (screen === 'dashboard') {
    // Helper function to calculate battle preview data for any battle
    const calculateBattlePreviewData = (battle) => {
      if (!battle) return null;

      // V3/V4 BaggerBomb battles use totalScore instead of portfolio values
      if (battle._v === 3 || battle._v === 4) {
        const isCreator = (battle.creator?.odUserId || battle.creator?.uid) === (user?.odUserId || user?.username) ||
                          battle.creator?.username === user?.username;
        const opponent = isCreator
          ? (battle.opponent?.username || 'Opponent')
          : (battle.creator?.username || 'Creator');
        const myScore = isCreator
          ? (battle.creator?.totalPoints ?? battle.creator?.totalScore ?? 0)
          : (battle.opponent?.totalPoints ?? battle.opponent?.totalScore ?? 0);
        const theirScore = isCreator
          ? (battle.opponent?.totalPoints ?? battle.opponent?.totalScore ?? 0)
          : (battle.creator?.totalPoints ?? battle.creator?.totalScore ?? 0);

        return {
          opponent,
          myGain: myScore,
          theirGain: theirScore,
          isWinning: myScore > theirScore,
          leadBy: Math.abs(myScore - theirScore),
          myValue: 1000000 + myScore * 1000,
          theirValue: 1000000 + theirScore * 1000,
          isV3: true
        };
      }

      const isCreator = getUsername(battle.creator) === user.username;
      const opponent = isCreator ? getUsername(battle.opponent) : getUsername(battle.creator);

      // Get flattened portfolios (V3-safe via portfolioHelpers)
      const { myPortfolio, theirPortfolio } = getBothPortfoliosFlat(battle, user.username);

      if (!myPortfolio.length || !theirPortfolio.length) return null;

      let myValue = 0;
      myPortfolio.forEach(asset => {
        if (!asset) return;
        const shares = (asset.amount || 0) / (asset.price || 1);
        myValue += shares * (asset.price || 0);
      });

      let theirValue = 0;
      theirPortfolio.forEach(asset => {
        if (!asset) return;
        const shares = (asset.amount || 0) / (asset.price || 1);
        theirValue += shares * (asset.price || 0);
      });

      const myGain = myValue > 0 ? ((myValue - 1000000) / 1000000) * 100 : 0;
      const theirGain = theirValue > 0 ? ((theirValue - 1000000) / 1000000) * 100 : 0;
      const isWinning = myGain > theirGain;
      const leadBy = Math.abs(myGain - theirGain);

      return { opponent, myGain, theirGain, isWinning, leadBy, myValue, theirValue };
    };

    // Calculate preview data for all active battles
    const activeBattlesWithData = activeBattles.map(battle => ({
      battle,
      previewData: calculateBattlePreviewData(battle)
    })).filter(item => item.previewData !== null);

    // Debug log battle counts
    debugBattles('Dashboard render', battles, {
      activeBattles: activeBattles.length,
      waitingBattles: waitingBattles.length,
      completedBattles: completedBattles.length
    });

    const hasActiveBattle = activeBattlesWithData.length > 0;

    // XP calculation for modal
    const xpForNextLevel = 10000;
    const xpProgress = (user.xp / xpForNextLevel) * 100;
    const xpNeeded = xpForNextLevel - user.xp;
    const ranks = ['Rookie', 'Apprentice', 'Trader', 'Expert', 'Master', 'Legend'];
    const currentRankIndex = ranks.indexOf(user.rank);
    const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : 'Max Rank';

    // ═══════════════════════════════════════════════════════════
    // MOBILE: The Loop — unified battle feed
    // ═══════════════════════════════════════════════════════════
    if (isMobile) {
      return (
        <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen('home'); }}>
          <div style={containerStyle}>
            <DesktopBackground isDesktop={isDesktop} />
            <DashboardLoop
              user={user}
              activeBattles={activeBattles}
              activeDraftBattles={activeDraftBattles}
              activeTrainingBattles={activeTrainingBattles}
              lobbyBattles={lobbyBattles}
              completedBattles={completedBattles}
              setCurrentBattle={setCurrentBattle}
              setCurrentDraft={setCurrentDraft}
              setScreen={setScreen}
              setActiveBattleId={setActiveBattleId}
              setBattleToJoin={setBattleToJoin}
              copyToClipboard={copyToClipboard}
              setShowBaggerBombModal={setShowBaggerBombModal}
              setShowSnakeDraftModal={setShowSnakeDraftModal}
              setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}
              setShowTrainingConfirmModal={setShowTrainingConfirmModal}
              setTrainingConfirmType={setTrainingConfirmType}
              setSidebarOpen={setSidebarOpen}
              unreadCount={unreadCount}
              activeDraftBanner={activeDraftBanner}
              setActiveDraftBanner={setActiveDraftBanner}
              onStoryPress={(story) => { setSelectedStory(story); setScreen('storyDetail'); }}
            />
          </div>
        </ErrorBoundary>
      );
    }

    // ═══════════════════════════════════════════════════════════
    // DESKTOP: The Minimal — two-panel layout (Phase 3)
    // ═══════════════════════════════════════════════════════════
    return (
      <ErrorBoundary name="Dashboard" onNavigateDashboard={() => { setScreen('home'); }}>
        <div style={containerStyle}>
          <DesktopBackground isDesktop={isDesktop} />

          <DashboardDesktop
            user={user}
            activeBattles={activeBattles}
            activeDraftBattles={activeDraftBattles}
            activeTrainingBattles={activeTrainingBattles}
            lobbyBattles={lobbyBattles}
            completedBattles={completedBattles}
            setCurrentBattle={setCurrentBattle}
            setCurrentDraft={setCurrentDraft}
            setScreen={setScreen}
            setActiveBattleId={setActiveBattleId}
            setBattleToJoin={setBattleToJoin}
            copyToClipboard={copyToClipboard}
            setShowBaggerBombModal={setShowBaggerBombModal}
            setShowSnakeDraftModal={setShowSnakeDraftModal}
            setShowBaggerBombTrainingConfirm={setShowBaggerBombTrainingConfirm}
            setShowTrainingConfirmModal={setShowTrainingConfirmModal}
            setTrainingConfirmType={setTrainingConfirmType}
            activeDraftBanner={activeDraftBanner}
            setActiveDraftBanner={setActiveDraftBanner}
            sidebarCollapsed={sidebarCollapsed}
            onStoryPress={(story) => { setSelectedStory(story); setScreen('storyDetail'); }}
          />
        </div>
      </ErrorBoundary>
    );
  }


  // PORTFOLIO BUILDER SCREEN (Create Game) - EXTRACTED TO BuilderScreen.jsx
  if (screen === 'builder') {
    return (
      <ErrorBoundary name="Portfolio Builder" onNavigateDashboard={() => setScreen('dashboard')}>
      <BuilderScreen
        // Layout
        isDesktop={isDesktop}
        containerStyle={containerStyle}
        // Market data
        stocksData={stocksData}
        cryptoData={cryptoData}
        loadingMarketData={loadingMarketData}
        // Portfolio state
        portfolio={portfolio}
        setPortfolio={setPortfolio}
        portfolioType={portfolioType}
        setPortfolioType={setPortfolioType}
        portfolioName={portfolioName}
        setPortfolioName={setPortfolioName}
        selectedCrypto={selectedCrypto}
        setSelectedCrypto={setSelectedCrypto}
        cryptoPercentage={cryptoPercentage}
        setCryptoPercentage={setCryptoPercentage}
        // Builder state
        builderCategory={builderCategory}
        setBuilderCategory={setBuilderCategory}
        builderMode={builderMode}
        setBuilderMode={setBuilderMode}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        assetType={assetType}
        setAssetType={setAssetType}
        // Modal state
        showPortfolioManager={showPortfolioManager}
        setShowPortfolioManager={setShowPortfolioManager}
        showTemplatesModal={showTemplatesModal}
        setShowTemplatesModal={setShowTemplatesModal}
        saveTemplateModal={saveTemplateModal}
        setSaveTemplateModal={setSaveTemplateModal}
        templateName={templateName}
        setTemplateName={setTemplateName}
        // Templates
        portfolioTemplates={portfolioTemplates}
        // Handlers
        handleRemoveAsset={handleRemoveAsset}
        handleCreateBattle={handleCreateBattle}
        handleJoinBattle={handleJoinBattle}
        handleCreateTrainingBattle={handleCreateTrainingBattle}
        savePortfolioTemplate={savePortfolioTemplate}
        loadTemplateToPortfolio={loadTemplateToPortfolio}
        addNotification={addNotification}
        // Navigation
        setScreen={setScreen}
      />
      </ErrorBoundary>
    );
  }

  // BAGGERBOMB TRAINING PORTFOLIO BUILDER SCREEN (V4 - No Bench, 1 Swap)
  if (screen === 'trainingPortfolioBuilderTD') {
    return (
      <ErrorBoundary name="Training Builder" onNavigateDashboard={() => setScreen('dashboard')}>
      <SlotBasedBuilder
        stocks={stocksData}
        crypto={cryptoData}
        version={4}
        onComplete={handleCreateBaggerBombTrainingBattleV4}
        onBack={() => {
          setBuilderMode('create');
          setScreen('dashboard');
        }}
      />
      </ErrorBoundary>
    );
  }

  // BAGGERBOMB LOBBY - Find and join open battles
  if (screen === 'baggerBombLobby') {
    return (
      <ErrorBoundary name="BaggerBomb Lobby" onNavigateDashboard={() => setScreen('dashboard')}>
      <Suspense fallback={<LoadingFallback />}>
        <BaggerBombLobby
          user={user}
          openBattles={lobbyBattles}
          loading={lobbyLoading}
          onCreateBattle={() => {
            setBattleToJoin(null);
            setScreen('baggerBombSetup');
          }}
          onJoinBattle={(battle) => {
            setBattleToJoin(battle);
            setScreen('baggerBombJoinBuilder');
          }}
          onBack={() => setScreen('dashboard')}
          onRefresh={async () => {
            setLobbyLoading(true);
            try {
              const battles = await getOpenBaggerBombBattles();
              setLobbyBattles(battles);
            } catch (err) {
              console.error('Failed to refresh lobby:', err);
            }
            setLobbyLoading(false);
          }}
        />
      </Suspense>
      </ErrorBoundary>
    );
  }

  // BAGGERBOMB SETUP - Time selection before portfolio builder
  if (screen === 'baggerBombSetup') {
    return (
      <ErrorBoundary name="BaggerBomb Setup" onNavigateDashboard={() => setScreen('dashboard')}>
      <Suspense fallback={<LoadingFallback />}>
        <BaggerBombSetupScreen
          onBack={() => setScreen('baggerBombLobby')}
          onContinue={(timeMinutes) => {
            setLobbyTimeMinutes(timeMinutes);
            setScreen('baggerBombBuilder');
          }}
        />
      </Suspense>
      </ErrorBoundary>
    );
  }

  // BAGGERBOMB CREATE BATTLE - New SlotBasedBuilder (V4: no bench)
  if (screen === 'baggerBombBuilder') {
    return (
      <ErrorBoundary name="BaggerBomb Builder" onNavigateDashboard={() => setScreen('dashboard')}>
      <SlotBasedBuilder
        stocks={stocksData}
        crypto={cryptoData}
        version={4}
        onComplete={async (portfolio) => {
          try {
            console.log('[BaggerBomb V4] Portfolio submitted:', portfolio);
            // Create BaggerBomb V4 battle with tiered portfolio (no bench)
            const battleData = await createBaggerBombBattleV4({
              portfolio: {
                star: portfolio.star,
                core: portfolio.core,
                support: portfolio.support,
              },
              creator: {
                uid: user.uid || user.odUserId || user.username,
                odUserId: user.odUserId || user.username,
                username: user.displayName || user.username,
                avatar: user.avatar || '',
              },
            }, lobbyTimeMinutes);
            if (battleData?.id) {
              showToast(`Battle created! Waiting for opponent...`);
              setCurrentBattle(battleData);
              setScreen('baggerBombLobby');
            }
          } catch (error) {
            console.error('Failed to create BaggerBomb battle:', error);
            showToast('Failed to create battle. Please try again.');
          }
        }}
        onBack={() => {
          setScreen('baggerBombSetup');
        }}
      />
      </ErrorBoundary>
    );
  }

  // BAGGERBOMB JOIN FROM LOBBY - Build portfolio then join selected battle
  if (screen === 'baggerBombJoinBuilder') {
    const joinBattleVersion = battleToJoin?._v || 3;
    return (
      <ErrorBoundary name="Join Battle Builder" onNavigateDashboard={() => setScreen('dashboard')}>
      <SlotBasedBuilder
        stocks={stocksData}
        crypto={cryptoData}
        version={joinBattleVersion >= 4 ? 4 : 3}
        onComplete={async (portfolio) => {
          try {
            if (!battleToJoin?.id) {
              showToast('No battle selected. Please select from lobby.');
              setScreen('baggerBombLobby');
              return;
            }
            console.log('[BaggerBomb] Joining battle from lobby:', battleToJoin.id, 'version:', joinBattleVersion);
            const joinData = {
              portfolio: {
                star: portfolio.star,
                core: portfolio.core,
                support: portfolio.support,
              },
              ...(joinBattleVersion < 4 ? { bench: portfolio.bench } : {}),
              uid: user.uid || user.odUserId || user.username,
              odUserId: user.odUserId || user.username,
              username: user.displayName || user.username,
              avatar: user.avatar || '',
            };

            // Use the correct join function based on version
            // Join functions fetch real-time prices internally via captureBattlePrices
            const joinFn = joinBattleVersion >= 4 ? joinBaggerBombBattleV4 : joinBaggerBombBattleV3;
            const result = await joinFn(battleToJoin.id, joinData, { joinByBattleId: true });
            if (result?.success) {
              showToast(`Joined battle!`);
              setCurrentBattle(result.battle);
              setBattleToJoin(null);
              setScreen('battle');
            }
          } catch (error) {
            console.error('Failed to join BaggerBomb battle:', error);
            showToast('Failed to join battle. It may have already started.');
            setScreen('baggerBombLobby');
          }
        }}
        onBack={() => {
          setBattleToJoin(null);
          setScreen('baggerBombLobby');
        }}
      />
      </ErrorBoundary>
    );
  }

  // BAGGERBOMB JOIN BATTLE (Legacy - via code, defaults to V4)
  if (screen === 'joinPortfolioBuilderTD') {
    return (
      <ErrorBoundary name="Join Battle" onNavigateDashboard={() => setScreen('dashboard')}>
      <SlotBasedBuilder
        stocks={stocksData}
        crypto={cryptoData}
        version={4}
        onComplete={async (portfolio) => {
          try {
            console.log('[BaggerBomb] Joining with portfolio:', portfolio);
            // Try V4 join first, fall back to V3
            const joinData = {
              portfolio: {
                star: portfolio.star,
                core: portfolio.core,
                support: portfolio.support,
              },
              uid: user.uid || user.odUserId || user.username,
              odUserId: user.odUserId || user.username,
              username: user.displayName || user.username,
              avatar: user.avatar || '',
            };

            // Join functions fetch real-time prices internally via captureBattlePrices
            let result;
            try {
              result = await joinBaggerBombBattleV4(joinCode, joinData);
            } catch (v4Error) {
              // Fall back to V3 join (battle may be V3)
              console.log('[BaggerBomb] V4 join failed, trying V3:', v4Error.message);
              result = await joinBaggerBombBattleV3(joinCode, {
                ...joinData,
                bench: portfolio.bench,
              });
            }
            if (result?.success) {
              showToast(`Joined BaggerBomb battle!`);
              setCurrentBattle(result.battle);
              setJoinCode('');
              setScreen('battle');
            }
          } catch (error) {
            console.error('Failed to join BaggerBomb battle:', error);
            showToast('Failed to join battle. Please check the code and try again.');
          }
        }}
        onBack={() => {
          setJoinCode('');
          setScreen('join');
        }}
      />
      </ErrorBoundary>
    );
  }

  // JOIN GAME SCREEN - Extracted to JoinScreen component
  if (screen === 'join') {
    return (
      <ErrorBoundary name="Join Battle" onNavigateDashboard={() => setScreen('dashboard')}>
      <JoinScreen
        isDesktop={isDesktop}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        joinBattleType={joinBattleType}
        setJoinBattleType={setJoinBattleType}
        onBack={() => {
          setJoinCode('');
          setJoinBattleType('classic');
          setBuilderMode('create');
          setScreen('dashboard');
        }}
        onContinue={(battleType) => {
          if (battleType === 'baggerbomb') {
            setScreen('joinPortfolioBuilderTD');
          } else {
            setScreen('builder');
          }
        }}
      />
      </ErrorBoundary>
    );
  }

  // TRAINING MODE SCREEN - Handled via useEffect to avoid render-time state updates
  // The useEffect at the top of the component handles the redirect to builder

  // DRAFT SETUP SCREEN - Extracted to DraftSetupScreen component
  if (screen === 'draftSetup') {
    return (
      <ErrorBoundary name="Draft Setup" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftSetupScreen
        user={user}
        assetType={assetType}
        setAssetType={setAssetType}
        onBack={() => setScreen('dashboard')}
        onCreateDraft={(draft) => {
          setCurrentDraft(draft);
          setScreen('draftLobby');
        }}
      />
      </ErrorBoundary>
    );
  }

  // DRAFT JOIN SCREEN - Snake Draft Lobby Browser
  if (screen === 'draftJoin') {
    return (
      <ErrorBoundary name="Draft Join" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftJoinScreen
        user={user}
        lobbyBattles={lobbyBattles}
        draftJoinCode={draftJoinCode}
        setDraftJoinCode={setDraftJoinCode}
        onBack={() => setScreen('dashboard')}
        onJoinDraft={(draft) => {
          setCurrentDraft(draft);
          setScreen('draftLobby');
        }}
        onCreateDraft={() => setScreen('draftSetup')}
      />
      </ErrorBoundary>
    );
  }

  // DRAFT TRAINING SCREEN - Extracted to DraftTrainingScreen component
  if (screen === 'draftTraining') {
    return (
      <ErrorBoundary name="Draft Training" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftTrainingScreen
        user={user}
        assetType={assetType}
        setAssetType={setAssetType}
        onBack={() => setScreen('dashboard')}
        onStartTraining={(draft) => {
          setCurrentDraft(draft);
          setScreen('draftRoom');
        }}
      />
      </ErrorBoundary>
    );
  }

  // DRAFT LOBBY SCREEN - Extracted to DraftLobbyScreen component
  if (screen === 'draftLobby') {
    return (
      <ErrorBoundary name="Draft Lobby" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftLobbyScreen
        user={user}
        currentDraft={currentDraft}
        draftState={draftState}
        onBack={() => setScreen('dashboard')}
        onStartDraft={() => {}}
        onLeaveLobby={() => setScreen('dashboard')}
      />
      </ErrorBoundary>
    );
  }

  // DRAFT ROOM SCREEN - Holographic War Room (Phase 5 Integration)
  if (screen === 'draftRoom') {
    return (
      <ErrorBoundary name="Draft Room" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftRoomScreen
        containerStyle={containerStyle}
        draftState={draftState}
        currentDraft={currentDraft}
        user={user}
        selectedDraftCategory={selectedDraftCategory}
        setSelectedDraftCategory={setSelectedDraftCategory}
        draftTimeRemaining={draftTimeRemaining}
        autopickCountdown={autopickCountdown}
        isRosterExpanded={isRosterExpanded}
        setIsRosterExpanded={setIsRosterExpanded}
        colors={colors}
        stocksData={stocksData}
        setScreen={setScreen}
        getStockSector={getStockSector}
        getSectorColor={getSectorColor}
        setCurrentDraft={setCurrentDraft}
      />
      </ErrorBoundary>
    );
  }


  // DRAFT ROOM OLD CODE REMOVED - See src/screens/DraftRoomScreen.jsx

  // DRAFT HISTORY SCREEN - Phase 4
  if (screen === 'draftHistory') {
    return (
      <ErrorBoundary name="Draft History" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftHistoryScreen
        user={user}
        onBack={() => setScreen('dashboard')}
      />
      </ErrorBoundary>
    );
  }

  // DRAFT RESULTS SCREEN - Using Snake Draft Grid Layout (DraftCompleteScreen)
  if (screen === 'draftResults') {
    return (
      <ErrorBoundary name="Draft Results" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftCompleteScreen
        containerStyle={containerStyle}
        currentDraft={currentDraft}
        user={user}
        onBack={() => {
          setCurrentDraft(null);
          setScreen('dashboard');
        }}
        onNavigate={setScreen}
      />
      </ErrorBoundary>
    );
  }


  // DRAFT RESULTS OLD CODE REMOVED - See src/screens/DraftResultsScreen.jsx

  // DRAFT BATTLE VIEW SCREEN - Now using V2 (Altitude Map Redesign) as production
  if (screen === 'draftBattle') {
    return (
      <ErrorBoundary name="Draft Battle" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftBattleScreenV2
        containerStyle={containerStyle}
        user={user}
        currentDraft={currentDraft}
        setCurrentDraft={setCurrentDraft}
        setScreen={setScreen}
        logger={logger}
      />
      </ErrorBoundary>
    );
  }

  // DRAFT BATTLE V1 (Legacy) - Keep as fallback route
  // Use 'draftBattleLegacy' to access the old design if needed
  if (screen === 'draftBattleLegacy') {
    return (
      <ErrorBoundary name="Draft Battle" onNavigateDashboard={() => setScreen('dashboard')}>
      <DraftBattleScreen
        containerStyle={containerStyle}
        user={user}
        currentDraft={currentDraft}
        setCurrentDraft={setCurrentDraft}
        setScreen={setScreen}
        logger={logger}
      />
      </ErrorBoundary>
    );
  }


  // DRAFT BATTLE VIEW OLD CODE REMOVED - See src/screens/DraftBattleScreen.jsx

  // FREE AGENCY SCREEN - Claims-based (waiver wire) or V2 (FCFS)
  if (screen === 'freeAgency') {
    if (currentDraft?.claimSystem?.enabled) {
      return (
        <ErrorBoundary name="Waiver Claims" onNavigateDashboard={() => setScreen('dashboard')}>
          <ClaimsFreeAgencyScreen
            containerStyle={containerStyle}
            currentDraft={currentDraft}
            user={user}
            setScreen={setScreen}
            logger={logger}
          />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary name="Free Agency" onNavigateDashboard={() => setScreen('dashboard')}>
      <FreeAgencyScreenV2
        containerStyle={containerStyle}
        currentDraft={currentDraft}
        user={user}
        setScreen={setScreen}
        logger={logger}
      />
      </ErrorBoundary>
    );
  }

  // Legacy Free Agency Screen (kept for backwards compatibility)
  if (screen === 'freeAgencyLegacy') {
    return (
      <ErrorBoundary name="Free Agency" onNavigateDashboard={() => setScreen('dashboard')}>
      <FreeAgencyScreen
        containerStyle={containerStyle}
        currentDraft={currentDraft}
        user={user}
        onBack={() => setScreen('draftResults')}
      />
      </ErrorBoundary>
    );
  }

  // FreeAgencyScreen old code DELETED - moved to src/screens/FreeAgencyScreen.jsx
  // (approximately 550 lines removed)


  // BATTLE VIEW SCREEN - Extracted to BattleViewScreen component
  if (screen === 'battle' && currentBattle) {
    return (
      <ErrorBoundary name="Battle View" onNavigateDashboard={() => setScreen('dashboard')}>
      <BattleViewScreen
        containerStyle={containerStyle}
        isDesktop={isDesktop}
        currentBattle={currentBattle}
        user={user}
        battlePrices={battlePrices}
        battleTimer={battleTimer}
        onBack={() => setScreen('dashboard')}
        ActiveRiskChallengeIndicator={ActiveRiskChallengeIndicator}
        LoadingFallback={LoadingFallback}
        BaggerBombBattleViewRedesign={BaggerBombBattleViewRedesign}
        BaggerBombBattleViewConnected={BaggerBombBattleViewConnected}
        BaggerBombTrainingBattleViewV3={BaggerBombTrainingBattleViewV3}
        BaggerBombBattleViewConnectedV4={BaggerBombBattleViewConnectedV4}
        BaggerBombTrainingBattleViewV4={BaggerBombTrainingBattleViewV4}
        AgentBattleScreen={AgentBattleScreen}
      />
      </ErrorBoundary>
    );
  }


  // BATTLE VIEW OLD CODE REMOVED - See src/screens/BattleViewScreen.jsx

  // PREVIOUS BATTLES SCREEN - Extracted to PreviousBattlesScreen component
  if (screen === 'previousBattles') {
    return (
      <ErrorBoundary name="Previous Battles" onNavigateDashboard={() => setScreen('dashboard')}>
      <PreviousBattlesScreen
        containerStyle={containerStyle}
        isDesktop={isDesktop}
        colors={colors}
        previousBattles={previousBattles}
        selectedPreviousBattle={selectedPreviousBattle}
        setSelectedPreviousBattle={setSelectedPreviousBattle}
        user={user}
        getUsername={getUsername}
        battleTimer={battleTimer}
        onBack={() => setScreen('dashboard')}
        onViewMatchup={(battle) => {
          setCurrentBattle(battle);
          setScreen('battle');
        }}
      />
      </ErrorBoundary>
    );
  }


  // previousBattles OLD CODE REMOVED - See src/screens/PreviousBattlesScreen.jsx

  // WINS SCREEN
  if (screen === 'wins') {
    return (
      <ErrorBoundary name="Wins" onNavigateDashboard={() => setScreen('dashboard')}>
      <WinsScreen
        user={user}
        previousBattles={previousBattles}
        colors={colors}
        getUsername={getUsername}
        battleTimer={battleTimer}
        onBack={() => setScreen('dashboard')}
        onViewBattle={(battle) => { setSelectedPreviousBattle(battle); setScreen('previousBattles'); }}
        onNavigate={setScreen}
      />
      </ErrorBoundary>
    );
  }

  // LOSSES SCREEN
  if (screen === 'losses') {
    return (
      <ErrorBoundary name="Losses" onNavigateDashboard={() => setScreen('dashboard')}>
      <LossesScreen
        user={user}
        previousBattles={previousBattles}
        colors={colors}
        getUsername={getUsername}
        battleTimer={battleTimer}
        onBack={() => setScreen('dashboard')}
        onViewBattle={(battle) => { setSelectedPreviousBattle(battle); setScreen('previousBattles'); }}
        onNavigate={setScreen}
      />
      </ErrorBoundary>
    );
  }

  // BATTLE HISTORY SCREEN - Extracted to BattleHistoryScreen component
  if (screen === 'battleHistory') {
    return (
      <div style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0, transition: 'margin-left 0.2s ease' }}>
      <ErrorBoundary name="Battle History" onNavigateDashboard={() => setScreen('dashboard')}>
      <BattleHistoryScreen
        containerStyle={containerStyle}
        colors={colors}
        previousBattles={previousBattles}
        completedDraftBattles={completedDraftBattles}
        completedTrainingBattles={completedTrainingBattles}
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
        loadingTrainingBattles={loadingTrainingBattles}
        user={user}
        onBack={() => setScreen('dashboard')}
        sendRematchRequest={sendRematchRequest}
        BattleHistoryCard={BattleHistoryCard}
        completedV4Battles={completedV4Battles}
        completedBaggerBombBattles={completedBaggerBombBattles}
      />
      </ErrorBoundary>
      </div>
    );
  }

  // BATTLE HISTORY OLD CODE REMOVED - See src/screens/BattleHistoryScreen.jsx

  // BUG REPORT ADMIN — ClashBot triage view
  if (screen === 'bugReportAdmin') {
    return (
      <BugReportAdmin
        user={user}
        colors={colors}
        isDesktop={isDesktop}
        onBack={() => setScreen('profile')}
      />
    );
  }

  // SEARCH & DISCOVER SCREEN
  if (screen === 'search') {
    return (
      <div style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0, transition: 'margin-left 0.2s ease' }}>
      <Suspense fallback={<div />}>
        <SearchDiscover
          user={user}
          isMobile={isMobile}
          isDesktop={isDesktop}
          setScreen={setScreen}
          stocksData={stocksData}
          sidebarCollapsed={sidebarCollapsed}
        />
      </Suspense>
      </div>
    );
  }

  // PROFILE SCREEN - REDESIGNED
  if (screen === 'profile') {
    return (
      <div style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0, transition: 'margin-left 0.2s ease' }}>
      <ErrorBoundary name="Profile" onNavigateDashboard={() => setScreen('dashboard')}>
      <ProfileScreen
        user={user}
        isDesktop={isDesktop}
        onBack={() => setScreen('dashboard')}
        setScreen={setScreen}
      />
      </ErrorBoundary>
      </div>
    );
  }

  // STONK OPTIONS ARENA V2
  if (screen === 'stonkOptionsArena') {
    return (
      <ErrorBoundary name="Options Arena" onNavigateDashboard={() => setScreen('dashboard')}>
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          background: '#0a0a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00d9ff'
        }}>
          Loading Options Arena...
        </div>
      }>
        <StonkOptionsArenaV2
          onBack={() => setScreen('dashboard')}
          stocksData={stocksData}
          stockAPI={stockAPI}
          initialCash={10000}
          user={user}
        />
      </Suspense>
      </ErrorBoundary>
    );
  }

  // FANTASYTIMES STORY DETAIL (full page)
  if (screen === 'storyDetail' && selectedStory) {
    return (
      <div style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0, transition: 'margin-left 0.2s ease' }}>
      <ErrorBoundary name="StoryDetail" onNavigateDashboard={() => setScreen('dashboard')}>
      <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0e14' }} />}>
        <StoryDetail
          story={selectedStory}
          onClose={() => { setSelectedStory(null); setScreen('fantasytimes'); }}
          isMobile={!isDesktop}
          isDesktop={isDesktop}
        />
      </Suspense>
      </ErrorBoundary>
      </div>
    );
  }

  // FANTASYTIMES FEED
  if (screen === 'fantasytimes') {
    // Extract active battle tickers from battles array
    const activeBattleTickers = (battles || [])
      .filter((b) => b.status === 'active' || b.status === 'in_progress')
      .flatMap((b) => {
        const portfolio = b.creator?.username === user?.username
          ? (b.creator?.portfolio || b.creatorPortfolio || [])
          : (b.opponent?.portfolio || b.opponentPortfolio || []);
        return (Array.isArray(portfolio) ? portfolio : []).map((a) => a?.symbol).filter(Boolean);
      });

    // Read user watchlist from localStorage
    let userWatchlist = [];
    try {
      const saved = localStorage.getItem('user_watchlist');
      if (saved) userWatchlist = JSON.parse(saved);
    } catch { /* ignore */ }

    return (
      <div style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0, transition: 'margin-left 0.2s ease' }}>
      <ErrorBoundary name="FantasyTimes" onNavigateDashboard={() => setScreen('dashboard')}>
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          background: '#0a0e14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00d9ff'
        }}>
          Loading FantasyTimes...
        </div>
      }>
        <FantasyTimesFeed
          currentUser={user}
          isMobile={!isDesktop}
          isDesktop={isDesktop}
          userWatchlist={userWatchlist}
          activeBattleTickers={activeBattleTickers}
          onNavigate={setScreen}
          onStorySelect={(story) => { setSelectedStory(story); setScreen('storyDetail'); }}
        />
      </Suspense>
      </ErrorBoundary>
      </div>
    );
  }

  // AGENT DASHBOARD
  if (screen === 'agent') {
    return (
      <div style={{ marginLeft: isDesktop ? (sidebarCollapsed ? '64px' : '220px') : 0, transition: 'margin-left 0.2s ease' }}>
      <ErrorBoundary name="Agent Dashboard" onNavigateDashboard={() => setScreen('dashboard')}>
        <AgentDashboard
          user={user}
          setScreen={setScreen}
          onCreateAgentBattle={handleCreateAgentTrainingBattle}
          setShowForge={setShowForge}
        />
      </ErrorBoundary>
      </div>
    );
  }

  // No screen matched — return null to fall through to unified return
  return null;
  }; // end getScreenContent

  const screenContent = getScreenContent();

  // ============================================
  // UNIFIED RETURN — EarningsGame (always mounted) + active screen + ClashBot widget
  // ============================================
  return (
    <>
      {/* Temporary diagnostic banner for mobile detection verification */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: isMobile ? 'green' : 'red',
          color: 'white', textAlign: 'center',
          fontSize: '10px', padding: '2px', zIndex: 99999
        }}>
          {window.innerWidth}px | {isMobile ? 'MOBILE' : 'DESKTOP'} | vh:{window.innerHeight}
        </div>
      )}
      {/* EarningsGame - ALWAYS MOUNTED to prevent state loss from Firestore battle updates */}
      {/* Uses CSS display toggle instead of conditional rendering */}
      <div style={{
        display: screen === 'earningsGame' ? 'block' : 'none',
        position: screen === 'earningsGame' ? 'relative' : 'fixed',
        visibility: screen === 'earningsGame' ? 'visible' : 'hidden',
        pointerEvents: screen === 'earningsGame' ? 'auto' : 'none',
        top: screen === 'earningsGame' ? 'auto' : '-9999px',
        left: screen === 'earningsGame' ? 'auto' : '-9999px'
      }}>
        <ErrorBoundary name="Earnings Game" onNavigateDashboard={() => setScreen('dashboard')}>
        <EarningsGameScreen
          user={user}
          onBack={() => setScreen('dashboard')}
          setScreen={setScreen}
          colors={colors}
          isDesktop={isDesktop}
        />
        </ErrorBoundary>
      </div>

      {/* Active screen content from routing */}
      {screenContent}

      {/* ========== DESKTOP SIDEBAR (Phase 3) ========== */}
      {user && !isMobile && !GAMEPLAY_SCREENS.includes(screen) && screen !== 'home' && (
        <DesktopSidebar
          screen={screen}
          setScreen={setScreen}
          setShowForge={setShowForge}
          showForge={showForge}
          user={user}
          unreadCount={unreadCount}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          onLogout={() => { logout(); setScreen('home'); }}
        />
      )}

      {/* ========== APP-LEVEL MOBILE SIDEBAR (extracted from dashboard) ========== */}
      {user && sidebarOpen && isMobile && (
          <>
            {/* Backdrop/Overlay */}
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                zIndex: 100,
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)'
              }}
            />

            {/* Sidebar Panel */}
            <div
              className="animate-slide-in"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                height: '100%',
                width: 'min(320px, 85vw)',
                backgroundColor: '#161b22',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 110,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflowY: 'auto'
              }}
            >

              {/* Sidebar Header */}
              <div className="bg-[#0d1117] border-b border-gray-800" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', minHeight: 56 }}>
                <span style={{
                  background: 'linear-gradient(135deg, #FF8C00, #468CFF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: -0.5,
                }}>
                  FantasyTrades
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#8b949e' }}
                  className="hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Info Section - THEMED */}
              <div style={{
                background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
                padding: '16px',
                borderBottom: '1px solid #21262d'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  {/* Profile Avatar */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    border: '2px solid #00d9ff',
                    boxShadow: '0 0 20px rgba(0, 217, 255, 0.3)'
                  }}>
                    👤
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Username */}
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#ffffff',
                      marginBottom: '4px'
                    }}>
                      {user?.username || 'Player'}
                    </div>

                    {/* Rank */}
                    <div style={{
                      fontSize: '13px',
                      color: '#00d9ff',
                      fontWeight: '600'
                    }}>
                      {user?.rank || 'Beginner'}
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #21262d'
                }}>
                  {/* XP */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '2px' }}>XP</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00d9ff' }}>
                      {user?.xp || 0}
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '2px' }}>Win Rate</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#22c55e' }}>
                      {(user?.wins + user?.losses) > 0
                        ? `${Math.round((user.wins / (user.wins + user.losses)) * 100)}%`
                        : '0%'}
                    </div>
                  </div>

                  {/* Total Battles */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '2px' }}>Battles</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff' }}>
                      {(user?.wins || 0) + (user?.losses || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Menu - REFINED */}
              <div style={{ padding: '12px', backgroundColor: 'transparent' }}>

                {/* BATTLE HISTORY (replaces Wins + Losses) */}
                <button
                  onClick={() => {
                    setHistoryTab(gameMode === 'draft' ? 'draft' : 'classic');
                    setScreen('battleHistory');
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: screen === 'battleHistory' ? '#8b5cf6' : 'transparent',
                    color: screen === 'battleHistory' ? '#000000' : '#d1d5db',
                    border: 'none',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* History icon SVG */}
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>Battle History</div>
                    {((user?.wins || 0) + (user?.losses || 0)) > 0 && (
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>
                        {user?.wins || 0}W - {user?.losses || 0}L
                      </div>
                    )}
                  </div>
                </button>

                {/* PROFILE */}
                <button
                  onClick={() => {
                    setScreen('profile');
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: screen === 'profile' ? '#00d9ff' : 'transparent',
                    color: screen === 'profile' ? '#000000' : '#d1d5db',
                    border: 'none',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>Profile</span>
                </button>

                {/* FANTASYTIMES */}
                <button
                  onClick={() => {
                    setScreen('fantasytimes');
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: screen === 'fantasytimes' ? '#00d9ff' : 'transparent',
                    color: screen === 'fantasytimes' ? '#000000' : '#d1d5db',
                    border: 'none',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>FantasyTimes</span>
                </button>

                {/* NOTIFICATIONS */}
                <button
                  onClick={() => {
                    setShowNotifications(true);
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: '#d1d5db',
                    border: 'none',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>Notifications</span>
                  {/* Unread badge */}
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      right: '16px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      minWidth: '18px',
                      textAlign: 'center'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* RULES & HOW TO PLAY */}
                <button
                  onClick={() => {
                    setShowRulesModal(true);
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: '#d1d5db',
                    border: 'none',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>Rules & How to Play</span>
                </button>

                {/* DIVIDER */}
                <div style={{ borderTop: '1px solid #374151', margin: '16px 0' }}></div>

                {/* LOGOUT */}
                <button
                  onClick={() => {
                    logout();
                    setScreen('home');
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'transparent',
                    color: '#f87171',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>Logout</span>
                </button>

              </div>
            </div>
          </>
      )}

      {/* ========== APP-LEVEL OVERLAYS (extracted from dashboard) ========== */}
      <ChallengeToast />
      {false && <MidGameChallengePopup />}
      {false && <RiskChallengePopup />}
      {false && <RiskChallengeResultPopup />}
      {showSlotMachine && weeklyChallenges.length >= 4 && (
        <SlotMachineContent
          challenges={weeklyChallenges}
          onClose={() => {
            setShowSlotMachine(false);
            setSlotMachineRevealed(true);
            markSlotMachineShown();
          }}
        />
      )}

      {/* ========== XP PROGRESS MODAL (extracted from dashboard) ========== */}
      {showXPModal && (
        <div
          onClick={() => setShowXPModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.cardBg,
              borderRadius: '20px',
              padding: '32px',
              width: '90%',
              maxWidth: '400px',
              border: `1px solid ${colors.border}`,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowXPModal(false)}
              aria-label="Close modal"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: `1px solid ${colors.borderSubtle}`,
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${colors.red}20`;
                e.currentTarget.style.borderColor = colors.red;
                e.currentTarget.style.color = colors.red;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = colors.borderSubtle;
                e.currentTarget.style.color = colors.textSecondary;
              }}
            >
              <X style={{ height: '18px', width: '18px' }} />
            </button>

            {/* Rank Icon */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 16px',
                borderRadius: '20px',
                background: `linear-gradient(135deg, ${colors.cyan}20 0%, ${colors.green}20 100%)`,
                border: `3px solid ${colors.cyan}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 30px ${colors.cyan}40`
              }}>
                <Shield style={{ height: '40px', width: '40px', color: colors.cyan }} />
              </div>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: colors.textPrimary,
                margin: '0 0 4px 0',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                {user.rank}
              </h2>
              <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>
                Level {user.level}
              </p>
            </div>

            {/* XP Progress */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                <span style={{ color: colors.textSecondary }}>Experience Points</span>
                <span style={{ color: colors.cyan, fontWeight: '600' }}>{user.xp} / {xpForNextLevel} XP</span>
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                background: 'rgba(0, 217, 255, 0.1)',
                borderRadius: '9999px',
                overflow: 'hidden'
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    background: `linear-gradient(90deg, ${colors.green} 0%, ${colors.cyan} 100%)`,
                    boxShadow: `0 0 10px ${colors.cyan}60`
                  }}
                />
              </div>
            </div>

            {/* Next Rank Info */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '0 0 8px 0' }}>
                {xpNeeded} XP to next rank
              </p>
              <p style={{ fontSize: '18px', fontWeight: '600', color: colors.green, margin: 0 }}>
                {nextRank}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========== APP-LEVEL MODALS (extracted from dashboard) ========== */}
        {showNotifications && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowNotifications(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                backdropFilter: 'blur(4px)'
              }}
            />
            {/* Modal Panel */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              backgroundColor: '#161b22',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 210,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      marginLeft: '8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      fontSize: '12px',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#21262d',
                        color: '#8b949e',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    style={{
                      padding: '6px',
                      backgroundColor: 'transparent',
                      color: '#8b949e',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {notifications.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#8b949e'
                  }}>
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p style={{ fontSize: '14px' }}>No notifications yet</p>
                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Battle results, challenges, and alerts will appear here</p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const typeConfig = NOTIFICATION_TYPES[notif.type] || NOTIFICATION_TYPES.system;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        style={{
                          padding: '12px 16px',
                          marginBottom: '4px',
                          borderRadius: '8px',
                          backgroundColor: notif.read ? 'transparent' : 'rgba(59, 130, 246, 0.1)',
                          border: notif.read ? '1px solid #21262d' : '1px solid rgba(59, 130, 246, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <span style={{
                            fontSize: '24px',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: `${typeConfig.color}20`,
                            borderRadius: '8px'
                          }}>
                            {typeConfig.icon}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: notif.read ? '500' : '600',
                              color: '#ffffff',
                              marginBottom: '2px'
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: '#8b949e'
                            }}>
                              {notif.body}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#6e7681',
                              marginTop: '4px'
                            }}>
                              {new Date(notif.createdAt).toLocaleDateString()} at {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                            style={{
                              padding: '4px',
                              backgroundColor: 'transparent',
                              color: '#6e7681',
                              border: 'none',
                              cursor: 'pointer',
                              opacity: 0.6
                            }}
                          >
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* RULES MODAL */}
        {/* ============================================ */}
        {showRulesModal && (
          <MarketClashRulesModal onClose={() => setShowRulesModal(false)} />
        )}

        {/* ============================================ */}
        {/* WEEK AHEAD CALENDAR MODAL */}
        {/* ============================================ */}
        {showWeekAhead && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowWeekAhead(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                backdropFilter: 'blur(4px)'
              }}
            />
            {/* Modal Panel */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '95%',
              maxWidth: '600px',
              maxHeight: '85vh',
              backgroundColor: '#161b22',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 210,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📅</span> Week Ahead
                  {weekAheadRange.isNextWeek && (
                    <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: 'normal' }}>(Next Week)</span>
                  )}
                </h2>
                <button
                  onClick={() => setShowWeekAhead(false)}
                  style={{
                    padding: '6px',
                    backgroundColor: 'transparent',
                    color: '#8b949e',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Week Range Header */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid #21262d',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '14px', color: '#d1d5db' }}>
                  {weekAheadRange.start && weekAheadRange.end && (
                    `${formatWeekDate(weekAheadRange.start)} - ${formatWeekDate(weekAheadRange.end)}`
                  )}
                </span>
              </div>

              {/* Impact Legend */}
              <div style={{
                padding: '8px 20px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '12px'
              }}>
                <span style={{ color: '#8b949e' }}>Impact:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                  <span style={{ color: '#ef4444' }}>High</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                  <span style={{ color: '#f59e0b' }}>Medium</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                  <span style={{ color: '#22c55e' }}>Low</span>
                </span>
              </div>

              {/* Summary Bar */}
              <div style={{
                padding: '12px 20px',
                background: '#0d1117',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '13px',
                borderBottom: '1px solid #21262d'
              }}>
                {weekAheadEvents.filter(e => e.impact === 'high').length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#ef4444', fontSize: '10px' }}>●</span>
                    <span style={{ color: '#8b949e' }}>High Impact: {weekAheadEvents.filter(e => e.impact === 'high').length}</span>
                  </span>
                )}
                {weekAheadEarnings.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#a855f7', fontSize: '10px' }}>●</span>
                    <span style={{ color: '#8b949e' }}>Earnings: {weekAheadEarnings.length}</span>
                  </span>
                )}
                {weekAheadHolidays.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#6b7280', fontSize: '10px' }}>●</span>
                    <span style={{ color: '#8b949e' }}>Market Closures</span>
                  </span>
                )}
                {weekAheadEvents.length === 0 && weekAheadEarnings.length === 0 && weekAheadHolidays.length === 0 && !weekAheadLoading && (
                  <span style={{ color: '#22c55e' }}>✓ Quiet week ahead</span>
                )}
              </div>

              {/* Events List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {weekAheadLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    Loading week ahead...
                  </div>
                ) : (weekAheadEvents.length === 0 && weekAheadEarnings.length === 0 && weekAheadHolidays.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
                    <p>No major events this week</p>
                    <p style={{ fontSize: '12px', marginTop: '8px' }}>Check back on the weekend for next week's events</p>
                  </div>
                ) : (
                  <>
                    {/* Combine and sort all events including holidays */}
                    {[
                      ...weekAheadEvents,
                      ...weekAheadEarnings,
                      ...weekAheadHolidays.map(h => ({
                        id: `${h.date}-${h.type}`,
                        name: h.name,
                        type: h.type,
                        date: h.date,
                        time: h.closeTime || null,
                        impact: 'info',
                        note: h.note,
                        strategyTip: h.type === 'early_close'
                          ? 'Low volume trading - prices can be erratic. Consider avoiding battles.'
                          : 'Markets closed. Crypto still trades 24/7.'
                      }))
                    ]
                      .sort((a, b) => {
                        const dateCompare = a.date.localeCompare(b.date);
                        if (dateCompare !== 0) return dateCompare;
                        // Sort by impact within same day
                        const impactOrder = { high: 0, medium: 1, low: 2, info: 3 };
                        return (impactOrder[a.impact] || 3) - (impactOrder[b.impact] || 3);
                      })
                      .map(event => (
                        <div
                          key={event.id}
                          onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                          style={{
                            padding: '12px 16px',
                            marginBottom: '8px',
                            borderRadius: '10px',
                            backgroundColor: expandedEventId === event.id ? '#21262d' : '#0d1117',
                            border: `1px solid ${expandedEventId === event.id ? getEventImpactColor(event.impact) : '#21262d'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            {/* Date badge */}
                            <div style={{
                              minWidth: '50px',
                              textAlign: 'center',
                              padding: '8px',
                              backgroundColor: '#21262d',
                              borderRadius: '8px'
                            }}>
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                                {getDateDisplay(event.date).dayNum}
                              </div>
                              <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase' }}>
                                {getDateDisplay(event.date).dayName}
                              </div>
                            </div>

                            {/* Event details */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '16px' }}>{getEventIcon(event.type)}</span>
                                <span style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: getEventImpactColor(event.impact)
                                }}></span>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
                                  {event.name}
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#8b949e' }}>
                                {event.time} ET
                                {event.beforeAfterMarket && (
                                  <span style={{ marginLeft: '8px', color: '#8b949e' }}>
                                    ({event.beforeAfterMarket === 'BeforeMarket' ? 'Pre-market' : 'After-hours'})
                                  </span>
                                )}
                              </div>

                              {/* Expanded details */}
                              {expandedEventId === event.id && (
                                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #21262d' }}>
                                  {/* Expected value for economic events */}
                                  {event.expected && (
                                    <div style={{ marginBottom: '12px' }}>
                                      <div style={{ fontSize: '10px', color: '#8b949e', marginBottom: '2px' }}>Expected</div>
                                      <div style={{ fontSize: '14px', color: '#3b82f6', fontWeight: '600' }}>{event.expected}</div>
                                    </div>
                                  )}

                                  {/* Historical Volatility */}
                                  {event.historicalMove && (
                                    <div style={{
                                      padding: '10px',
                                      backgroundColor: '#161b22',
                                      borderRadius: '8px',
                                      marginBottom: '12px'
                                    }}>
                                      <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.5px' }}>AVG HISTORICAL MOVES</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px' }}>
                                        {event.type === 'earnings' ? (
                                          <>
                                            <span>
                                              <span style={{ color: '#8b949e' }}>Stock: </span>
                                              <span style={{ color: '#00d9ff', fontWeight: '600' }}>±{event.historicalMove.stock}%</span>
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            {event.historicalMove.market && (
                                              <span>
                                                <span style={{ color: '#8b949e' }}>Market: </span>
                                                <span style={{ color: '#00d9ff', fontWeight: '600' }}>±{event.historicalMove.market}%</span>
                                              </span>
                                            )}
                                            {event.historicalMove.highBeta && (
                                              <span>
                                                <span style={{ color: '#8b949e' }}>High-Beta: </span>
                                                <span style={{ color: '#f59e0b', fontWeight: '600' }}>±{event.historicalMove.highBeta}%</span>
                                              </span>
                                            )}
                                            {event.historicalMove.crypto && (
                                              <span>
                                                <span style={{ color: '#8b949e' }}>Crypto: </span>
                                                <span style={{ color: '#a855f7', fontWeight: '600' }}>±{event.historicalMove.crypto}%</span>
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      {/* Earnings-specific: last moves */}
                                      {event.historicalMove.lastMoves && event.historicalMove.lastMoves.length > 0 && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#8b949e' }}>
                                          Last 4: {event.historicalMove.lastMoves.join(' · ')}
                                          {event.historicalMove.beatRate && (
                                            <span style={{ marginLeft: '12px' }}>Beat rate: {event.historicalMove.beatRate}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Strategy Tip */}
                                  {event.strategyTip && (
                                    <div style={{
                                      padding: '10px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      borderRadius: '8px',
                                      border: '1px solid rgba(59, 130, 246, 0.2)'
                                    }}>
                                      <div style={{ fontSize: '11px', color: '#3b82f6', marginBottom: '4px', fontWeight: '600' }}>💡 Strategy Tip</div>
                                      <div style={{ fontSize: '12px', color: '#d1d5db', lineHeight: '1.4' }}>{event.strategyTip}</div>
                                    </div>
                                  )}

                                  {/* Affected Sectors for economic events */}
                                  {event.affectedSectors && event.affectedSectors.length > 0 && (
                                    <div style={{ marginTop: '12px' }}>
                                      <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>Affected Sectors</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {event.affectedSectors.map(sector => (
                                          <span key={sector} style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#21262d',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            color: '#00d9ff'
                                          }}>
                                            {sector}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* REMATCH REQUEST MODAL */}
        {/* ============================================ */}
        {showRematchModal && rematchRequest && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowRematchModal(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                backdropFilter: 'blur(4px)'
              }}
            />
            {/* Modal */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '400px',
              backgroundColor: '#161b22',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 210,
              padding: '24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚔️</div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                Rematch Request!
              </h2>
              <p style={{ fontSize: '14px', color: '#8b949e', marginBottom: '24px' }}>
                <span style={{ color: '#00d9ff', fontWeight: '600' }}>{rematchRequest.fromUsername}</span> wants a rematch!
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => declineRematch(rematchRequest.id)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#21262d',
                    color: '#8b949e',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={() => acceptRematch(rematchRequest.id)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#22c55e',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Accept Rematch
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* PORTFOLIO TEMPLATES MODAL */}
        {/* ============================================ */}
        {showTemplatesModal && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowTemplatesModal(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                backdropFilter: 'blur(4px)'
              }}
            />
            {/* Modal Panel */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              backgroundColor: '#161b22',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 210,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                  Portfolio Templates
                </h2>
                <button
                  onClick={() => setShowTemplatesModal(false)}
                  aria-label="Close templates"
                  style={{
                    padding: '6px',
                    backgroundColor: 'transparent',
                    color: '#8b949e',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Template Type Tabs */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={() => setAssetType('stocks')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: assetType === 'stocks' ? '#22c55e' : '#21262d',
                    color: assetType === 'stocks' ? '#000' : '#8b949e',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Stocks
                </button>
                <button
                  onClick={() => setAssetType('crypto')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: assetType === 'crypto' ? '#f59e0b' : '#21262d',
                    color: assetType === 'crypto' ? '#000' : '#8b949e',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Crypto
                </button>
              </div>

              {/* Templates List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {/* System Templates Section */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', paddingLeft: '4px' }}>
                    SYSTEM TEMPLATES
                  </div>
                  {SYSTEM_PORTFOLIO_TEMPLATES
                    .filter(t => t.type === assetType)
                    .map(template => (
                      <div
                        key={template.id}
                        onClick={() => loadTemplateToPortfolio(template)}
                        style={{
                          padding: '12px 16px',
                          marginBottom: '8px',
                          borderRadius: '10px',
                          backgroundColor: '#0d1117',
                          border: '1px solid #21262d',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '24px' }}>{template.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
                              {template.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#8b949e' }}>
                              {template.description}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '4px' }}>
                              {template.assets.join(', ')}
                            </div>
                          </div>
                          <svg width="20" height="20" fill="none" stroke="#8b949e" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* User Templates Section */}
                <div>
                  <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px', paddingLeft: '4px' }}>
                    YOUR TEMPLATES
                  </div>
                  {portfolioTemplates.filter(t => t.type === assetType).length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: '#6e7681',
                      backgroundColor: '#0d1117',
                      borderRadius: '10px',
                      border: '1px dashed #21262d'
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                      <p style={{ fontSize: '13px' }}>No saved templates yet</p>
                      <p style={{ fontSize: '11px', marginTop: '4px' }}>Save your portfolio during battle creation</p>
                    </div>
                  ) : (
                    portfolioTemplates
                      .filter(t => t.type === assetType)
                      .map(template => (
                        <div
                          key={template.id}
                          style={{
                            padding: '12px 16px',
                            marginBottom: '8px',
                            borderRadius: '10px',
                            backgroundColor: '#0d1117',
                            border: '1px solid #21262d',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => loadTemplateToPortfolio(template)}
                          >
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>
                              {template.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '2px' }}>
                              {template.assets.join(', ')}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePortfolioTemplate(template.id);
                            }}
                            style={{
                              padding: '6px',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              border: 'none',
                              cursor: 'pointer',
                              opacity: 0.7
                            }}
                          >
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* TRAINING CONFIRM MODAL */}
        {/* ============================================ */}
        {showTrainingConfirmModal && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowTrainingConfirmModal(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#161b22',
                  borderRadius: '20px',
                  padding: '28px',
                  maxWidth: '340px',
                  width: '100%',
                  textAlign: 'center',
                  border: '1px solid #21262d'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '70px',
                  height: '70px',
                  background: trainingConfirmType === 'stocks'
                    ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: trainingConfirmType === 'stocks'
                    ? '0 8px 24px rgba(34, 197, 94, 0.4)'
                    : '0 8px 24px rgba(245, 158, 11, 0.4)'
                }}>
                  {trainingConfirmType === 'stocks' ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                      <path d="M3 17L9 11L13 15L21 7M17 7H21V11" />
                    </svg>
                  ) : (
                    <span style={{ fontSize: '32px', color: '#ffffff' }}>₿</span>
                  )}
                </div>

                {/* Title */}
                <h2 style={{
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: '700',
                  margin: '0 0 8px 0'
                }}>
                  Start {trainingConfirmType === 'stocks' ? 'Stocks' : 'Crypto'} Draft?
                </h2>

                {/* Description */}
                <p style={{
                  color: '#8b949e',
                  fontSize: '14px',
                  margin: '0 0 8px 0',
                  lineHeight: '1.5'
                }}>
                  You'll draft against 3 CPU opponents
                </p>

                {/* Asset Type Toggle */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <button
                    onClick={() => setTrainingConfirmType('stocks')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: trainingConfirmType === 'stocks' ? '2px solid #22c55e' : '2px solid #21262d',
                      background: trainingConfirmType === 'stocks' ? 'rgba(34, 197, 94, 0.1)' : '#0d1117',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{'\uD83D\uDCC8'}</span>
                    <span style={{
                      color: trainingConfirmType === 'stocks' ? '#22c55e' : '#8b949e',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}>Stocks</span>
                  </button>
                  <button
                    onClick={() => setTrainingConfirmType('crypto')}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: trainingConfirmType === 'crypto' ? '2px solid #f59e0b' : '2px solid #21262d',
                      background: trainingConfirmType === 'crypto' ? 'rgba(245, 158, 11, 0.1)' : '#0d1117',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{'\u20BF'}</span>
                    <span style={{
                      color: trainingConfirmType === 'crypto' ? '#f59e0b' : '#8b949e',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}>Crypto</span>
                  </button>
                </div>

                {/* Details */}
                <div style={{
                  background: '#0d1117',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>Rounds</span>
                    <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>9 picks</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>Time per pick</span>
                    <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>30 seconds</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>Rewards</span>
                    <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '600' }}>+10 XP (win) / +5 XP (loss)</span>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={() => setShowTrainingConfirmModal(false)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: 'transparent',
                      border: '1px solid #21262d',
                      borderRadius: '10px',
                      color: '#8b949e',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setShowTrainingConfirmModal(false);
                      try {
                        const draftService = await import('./services/draftService');
                        const draft = await draftService.createTrainingDraft(
                          user.odUserId || user.username,
                          user.username,
                          trainingConfirmType
                        );
                        setCurrentDraft(draft);
                        setAssetType(trainingConfirmType);
                        setScreen('draftRoom');
                      } catch (error) {
                        console.error('Failed to create training draft:', error);
                        alert('Failed to start training. Please try again.');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: trainingConfirmType === 'stocks'
                        ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Start Draft
                  </button>
                </div>

                {/* Tutorial Button */}
                <button
                  onClick={() => {
                    setTutorialMode('draftTraining');
                    setTutorialStep(0);
                    setShowTutorial(true);
                  }}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    background: 'transparent',
                    border: '1px dashed rgba(139, 92, 246, 0.4)',
                    borderRadius: '10px',
                    color: '#a78bfa',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                  }}
                >
                  <BookOpen size={16} />
                  <span>How to Play</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* HIGH VOLATILITY ALERT MODAL */}
        {/* ============================================ */}
        {showVolatilityAlert && upcomingHighImpactEvents.length > 0 && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowVolatilityAlert(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                backdropFilter: 'blur(4px)'
              }}
            />
            {/* Modal */}
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '450px',
              backgroundColor: '#161b22',
              borderRadius: '16px',
              border: '2px solid #ef4444',
              zIndex: 210,
              padding: '24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444', marginBottom: '8px' }}>
                High Volatility Alert!
              </h2>
              <p style={{ fontSize: '14px', color: '#8b949e', marginBottom: '20px' }}>
                Major economic events are scheduled in the next 3 days. Expect increased market volatility!
              </p>

              {/* Events list */}
              <div style={{
                backgroundColor: '#0d1117',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'left',
                maxHeight: '150px',
                overflowY: 'auto'
              }}>
                {upcomingHighImpactEvents.slice(0, 3).map(event => (
                  <div key={event.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px',
                    borderBottom: '1px solid #21262d'
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#ef4444'
                    }}></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: '500' }}>{event.name}</div>
                      <div style={{ fontSize: '11px', color: '#8b949e' }}>
                        {new Date(event.date).toLocaleDateString()} at {event.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: '12px', color: '#6e7681', marginBottom: '16px' }}>
                Consider this when building your portfolio strategy!
              </p>

              <button
                onClick={() => setShowVolatilityAlert(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Got it, continue
              </button>
            </div>
          </>
        )}

        {/* ========== CONFIRMATION POPUPS ========== */}
        <ConfirmationPopup
          show={showCreateBattleConfirm}
          onClose={() => {
            setShowCreateBattleConfirm(false);
            setBattleScoringMode('classic'); // Reset to classic when closing
          }}
          onConfirm={() => {
            // Check PvP battle limit - MUST filter by current user
            const userPvPBattles = battles.filter(b => {
              // Skip training battles
              if (b.isTrainingBattle) return false;

              // Check if battle is active or waiting
              const isActiveOrWaiting = b.status === 'waiting' || b.status === 'active';
              if (!isActiveOrWaiting) return false;

              // Check if current user is involved in this battle
              return getUsername(b.creator) === user?.username || getUsername(b.opponent) === user?.username;
            }, 'userPvPBattles in create battle confirm');

            if (userPvPBattles.length >= MAX_PVP_BATTLES) {
              alert(`You've reached the maximum of ${MAX_PVP_BATTLES} active PvP battles. Complete or delete a battle first.`);
              setShowCreateBattleConfirm(false);
              return;
            }
            setShowCreateBattleConfirm(false);
            setBuilderMode('create');
            // If BaggerBomb mode selected, go to BaggerBomb portfolio builder
            if (battleScoringMode === 'baggerbomb') {
              setScreen('tdBuilder');
            } else {
              setScreen('builder');
            }
          }}
          icon={<TrendingUp size={32} style={{ color: '#ffffff' }} />}
          iconBgColor={battleScoringMode === 'baggerbomb' ? '#06b6d4' : '#00d9ff'}
          title="Create Battle?"
          subtitle={battleScoringMode === 'baggerbomb' ? 'Session-based scoring with breakout bonuses' : 'Challenge opponents with your portfolio picks'}
          details={battleScoringMode === 'baggerbomb' ? [
            { label: 'Scoring', value: 'BaggerBomb (4 Sessions)' },
            { label: 'Roster', value: '6 stocks + 1 crypto' },
            { label: 'Bench', value: '4 stocks + 1 crypto' },
            { label: 'Breakout Bonuses', value: '+15 / +30 / +50 pts', highlight: true, highlightColor: '#06b6d4' }
          ] : [
            { label: 'Assets Required', value: '7-13 picks' },
            { label: 'Duration', value: '24 hours' },
            { label: 'Rewards', value: '+100 XP (win) / +25 XP (loss)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText={battleScoringMode === 'baggerbomb' ? 'Create BaggerBomb Battle' : 'Create Battle'}
          confirmColor={battleScoringMode === 'baggerbomb' ? '#06b6d4' : '#00d9ff'}
          tutorialModeType="classic"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
          customContent={
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              padding: '4px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '12px'
            }}>
              <button
                onClick={() => setBattleScoringMode('classic')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: battleScoringMode === 'classic' ? '#00d9ff' : 'transparent',
                  color: battleScoringMode === 'classic' ? '#0a0a0a' : 'rgba(255,255,255,0.6)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Classic
              </button>
              <button
                onClick={() => setBattleScoringMode('baggerbomb')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: battleScoringMode === 'baggerbomb' ? '#06b6d4' : 'transparent',
                  color: battleScoringMode === 'baggerbomb' ? '#0a0a0a' : 'rgba(255,255,255,0.6)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                BaggerBomb
              </button>
            </div>
          }
        />

        <ConfirmationPopup
          show={showJoinBattleConfirm}
          onClose={() => setShowJoinBattleConfirm(false)}
          onConfirm={() => {
            setShowJoinBattleConfirm(false);
            setBuilderMode('join');
            setScreen('join');
          }}
          icon={<Users size={32} style={{ color: '#ffffff' }} />}
          iconBgColor="#00d9ff"
          title="Join Battle?"
          subtitle="Enter a challenge code to compete"
          details={[
            { label: 'Assets Required', value: '7-13 picks' },
            { label: 'Duration', value: '24 hours' },
            { label: 'Rewards', value: '+100 XP (win) / +25 XP (loss)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Join Battle"
          confirmColor="#00d9ff"
          tutorialModeType="classic"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        {/* Builder Training Modal - Classic Battle Only */}
        <ConfirmationPopup
          show={showClassicTrainingConfirm}
          onClose={() => setShowClassicTrainingConfirm(false)}
          onConfirm={() => {
            // Check training battle limit - MUST filter by current user
            const userTrainingBattles = battles.filter(b => {
              if (!b.isTrainingBattle && !b.isTraining) return false;

              // Exclude completed/ended battles (state.status is the canonical field;
              // top-level b.status is never updated on completion)
              const stateStatus = b.state?.status;
              if (stateStatus === 'completed' || stateStatus === 'ended') return false;
              if (b.result) return false;

              const isActiveOrWaiting = b.status === 'waiting' || b.status === 'active' ||
                                        stateStatus === 'active' || stateStatus === 'waiting';
              if (!isActiveOrWaiting) return false;

              return getUsername(b.creator) === user?.username;
            }, 'userTrainingBattles in classic training confirm');

            const totalTraining = battles.filter(b => (b.isTrainingBattle || b.isTraining) && getUsername(b.creator) === user?.username).length;
            const completedCount = totalTraining - userTrainingBattles.length;
            console.log(`[TRAINING-LIMIT] Total training: ${totalTraining}, Active: ${userTrainingBattles.length}, Completed: ${completedCount}`);

            if (userTrainingBattles.length >= MAX_TRAINING_BATTLES) {
              alert(`You've reached the maximum of ${MAX_TRAINING_BATTLES} active training battles. Complete or delete a battle first.`);
              setShowClassicTrainingConfirm(false);
              return;
            }
            setShowClassicTrainingConfirm(false);
            setPortfolio([]);
            setPortfolioType(null);
            setPortfolioName('');
            setAssetType('stocks');
            setSearchTerm('');
            setSelectedCrypto(null);
            setBuilderMode('training');
            setScreen('builder'); // Classic training only
          }}
          icon={<GraduationCap size={32} style={{ color: '#ffffff' }} />}
          iconBgColor="#00ffff"
          title="Builder Training"
          subtitle="Practice building Classic Battle portfolios against CPU"
          details={[
            { label: 'Assets Required', value: '7-13 picks' },
            { label: 'Duration', value: '1 hour' },
            { label: 'Rewards', value: '+10 XP (win) / +5 XP (loss)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Start Training"
          confirmColor="#00ffff"
          tutorialModeType="training"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        {/* BaggerBomb Training Modal - Separate from Builder */}
        <ConfirmationPopup
          show={showBaggerBombTrainingConfirm}
          onClose={() => setShowBaggerBombTrainingConfirm(false)}
          onConfirm={() => {
            // Check training battle limit - MUST filter by current user
            const userTrainingBattles = battles.filter(b => {
              if (!b.isTrainingBattle && !b.isTraining) return false;

              // Exclude completed/ended battles (state.status is the canonical field;
              // top-level b.status is never updated on completion)
              const stateStatus = b.state?.status;
              if (stateStatus === 'completed' || stateStatus === 'ended') return false;
              if (b.result) return false;

              const isActiveOrWaiting = b.status === 'waiting' || b.status === 'active' ||
                                        stateStatus === 'active' || stateStatus === 'waiting';
              if (!isActiveOrWaiting) return false;

              return getUsername(b.creator) === user?.username;
            }, 'userTrainingBattles in BaggerBomb training confirm');

            const totalTraining = battles.filter(b => (b.isTrainingBattle || b.isTraining) && getUsername(b.creator) === user?.username).length;
            const completedCount = totalTraining - userTrainingBattles.length;
            console.log(`[TRAINING-LIMIT] Total training: ${totalTraining}, Active: ${userTrainingBattles.length}, Completed: ${completedCount}`);

            if (userTrainingBattles.length >= MAX_TRAINING_BATTLES) {
              alert(`You've reached the maximum of ${MAX_TRAINING_BATTLES} active training battles. Complete or delete a battle first.`);
              setShowBaggerBombTrainingConfirm(false);
              return;
            }
            setShowBaggerBombTrainingConfirm(false);
            setPortfolio([]);
            setPortfolioType(null);
            setPortfolioName('');
            setAssetType('stocks');
            setSearchTerm('');
            setSelectedCrypto(null);
            setBuilderMode('training');
            setScreen('trainingPortfolioBuilderTD'); // BaggerBomb training
          }}
          icon={<Bomb size={32} style={{ color: '#ffffff' }} />}
          iconBgColor="#dc2626"
          title="BaggerBomb Training"
          subtitle="Practice scoring points with breakout bonuses against CPU"
          details={[
            { label: 'Assets Required', value: '7 picks' },
            { label: 'Duration', value: '24 hours' },
            { label: 'Rewards', value: '+10 XP (win) / +5 XP (loss)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Start Training"
          confirmColor="#dc2626"
          tutorialModeType="training"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        <ConfirmationPopup
          show={showCreateDraftConfirm}
          onClose={() => setShowCreateDraftConfirm(false)}
          onConfirm={() => {
            setShowCreateDraftConfirm(false);
            setScreen('draftSetup');
          }}
          icon={<TrendingUp size={32} style={{ color: '#ffffff' }} />}
          iconBgColor="#10b981"
          title="Create Snake Draft?"
          subtitle="Start a 4-player snake draft lobby"
          details={[
            { label: 'Players', value: '4 players' },
            { label: 'Picks', value: '9 per player' },
            { label: 'Time per pick', value: '2 minutes' },
            { label: 'Rewards', value: '+150 XP (1st) / +100 XP (2nd)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Create Draft"
          confirmColor="#10b981"
          tutorialModeType="draft"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        <ConfirmationPopup
          show={showJoinDraftConfirm}
          onClose={() => setShowJoinDraftConfirm(false)}
          onConfirm={() => {
            setShowJoinDraftConfirm(false);
            setScreen('draftJoin');
          }}
          icon={<Users size={32} style={{ color: '#ffffff' }} />}
          iconBgColor="#10b981"
          title="Join Snake Draft?"
          subtitle="Enter a draft code to join a lobby"
          details={[
            { label: 'Players', value: '4 players' },
            { label: 'Picks', value: '9 per player' },
            { label: 'Time per pick', value: '2 minutes' },
            { label: 'Rewards', value: '+150 XP (1st) / +100 XP (2nd)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Join Draft"
          confirmColor="#10b981"
          tutorialModeType="draft"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        {/* ============================================ */}
        {/* NEW: UNIFIED COMPETE GAME MODALS */}
        {/* ============================================ */}

        {/* Snake Draft Modal (with Create/Join) */}
        <ConfirmationPopup
          show={showSnakeDraftModal}
          onClose={() => setShowSnakeDraftModal(false)}
          onConfirm={() => {
            setShowSnakeDraftModal(false);
            setScreen('draftSetup');
          }}
          secondaryAction={() => {
            setShowSnakeDraftModal(false);
            setScreen('draftJoin');
          }}
          secondaryText="Join Game"
          icon={<span style={{ fontSize: '32px' }}>🐍</span>}
          iconBgColor="#10b981"
          title="Snake Draft"
          subtitle="Start a 4-player snake draft lobby"
          details={[
            { label: 'Players', value: '4 players' },
            { label: 'Picks', value: '9 per player' },
            { label: 'Time per pick', value: '2 minutes' },
            { label: 'Rewards', value: '+150 XP (1st) / +100 XP (2nd)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Create Game"
          confirmColor="#10b981"
          tutorialModeType="draft"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        {/* Builder 1v1 Modal (with Create/Join) */}
        <ConfirmationPopup
          show={showBuilderModal}
          onClose={() => setShowBuilderModal(false)}
          onConfirm={() => {
            setShowBuilderModal(false);
            // Reset portfolio state
            setPortfolio([]);
            setPortfolioType(null);
            setPortfolioName('');
            setAssetType('stocks');
            setSearchTerm('');
            setSelectedCrypto(null);
            setScreen('builder');
          }}
          secondaryAction={() => {
            setShowBuilderModal(false);
            // Reset portfolio state
            setPortfolio([]);
            setPortfolioType(null);
            setPortfolioName('');
            setAssetType('stocks');
            setSearchTerm('');
            setJoinCode('');
            setScreen('join');
          }}
          secondaryText="Join Game"
          icon={<span style={{ fontSize: '32px' }}>🏗️</span>}
          iconBgColor="#00d9ff"
          title="Builder 1v1"
          subtitle="Build a portfolio and battle 1v1"
          details={[
            { label: 'Players', value: '2 players' },
            { label: 'Assets', value: '7-13 picks' },
            { label: 'Duration', value: '1 hour' },
            { label: 'Rewards', value: '+10 XP (win) / +5 XP (loss)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Create Game"
          confirmColor="#00d9ff"
          tutorialModeType="classic"
          onShowTutorial={(mode) => {
            setTutorialMode(mode);
            setTutorialStep(0);
            setShowTutorial(true);
          }}
        />

        {/* BaggerBomb Modal - Now goes to Lobby */}
        <ConfirmationPopup
          show={showBaggerBombModal}
          onClose={() => setShowBaggerBombModal(false)}
          onConfirm={() => {
            setShowBaggerBombModal(false);
            // Navigate to BaggerBomb Lobby
            setScreen('baggerBombLobby');
          }}
          icon={<span style={{ fontSize: '32px' }}>💣</span>}
          iconBgColor="#dc2626"
          title="BaggerBomb"
          subtitle="Score points with breakout bonuses"
          details={[
            { label: 'Players', value: '2 players' },
            { label: 'Assets', value: '7 picks' },
            { label: 'Duration', value: '3 days' },
            { label: 'Rewards', value: '+15 XP (win) / +5 XP (loss)', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Enter Lobby"
          confirmColor="#dc2626"
          hideTutorial
        />

        {/* Options Arena Modal (with Create/Join) */}
        <ConfirmationPopup
          show={showOptionsArenaModal}
          onClose={() => setShowOptionsArenaModal(false)}
          onConfirm={() => {
            setShowOptionsArenaModal(false);
            setScreen('stonkOptionsArena');
          }}
          secondaryAction={() => {
            setShowOptionsArenaModal(false);
            // For now, same as create - can be updated when join flow exists
            setScreen('stonkOptionsArena');
          }}
          secondaryText="Join Game"
          icon={<span style={{ fontSize: '32px' }}>🎯</span>}
          iconBgColor="#10b981"
          title="Options Arena"
          subtitle="Pick strikes & win big"
          details={[
            { label: 'Players', value: '2 players' },
            { label: 'Contracts', value: '3 options' },
            { label: 'Duration', value: '1-4 weeks' },
            { label: 'Rewards', value: 'Variable based on performance', highlight: true, highlightColor: '#f59e0b' }
          ]}
          confirmText="Create Game"
          confirmColor="#10b981"
          hideTutorial
        />

        {/* Tutorial Modal */}
        <TutorialModal />

        {/* ========== SPOTLIGHT TOUR (Interactive Onboarding) ========== */}
        <SpotlightTour />

      {/* ========== DESKTOP BOTTOM STATS BAR (extracted from dashboard) ========== */}
      {user && screen === 'dashboard' && (
          <div
            id="tour-rank-section"
            className="hidden md:flex"
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '56px',
              background: colors.cardBg,
              borderTop: `1px solid ${colors.border}`,
              alignItems: 'center',
              justifyContent: 'center',
              gap: '32px',
              zIndex: 100
            }}
          >
            {/* Wins */}
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: colors.gold }} />
              <span className="text-sm" style={{ color: colors.textSecondary }}>Wins:</span>
              <span className="text-base font-semibold" style={{ color: colors.green }}>{user.wins}</span>
            </div>

            {/* Losses */}
            <div className="flex items-center gap-2">
              <Skull className="w-4 h-4" style={{ color: colors.textMuted }} />
              <span className="text-sm" style={{ color: colors.textSecondary }}>Losses:</span>
              <span className="text-base font-semibold" style={{ color: colors.red }}>{user.losses}</span>
            </div>

            {/* Battles */}
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4" style={{ color: colors.cyan }} />
              <span className="text-sm" style={{ color: colors.textSecondary }}>Battles:</span>
              <span className="text-base font-semibold" style={{ color: colors.cyan }}>{user.wins + user.losses}</span>
            </div>

            {/* Rank - Clickable */}
            <button
              onClick={() => setShowXPModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'transparent', border: `1px solid ${colors.borderSubtle}` }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.cyan; e.currentTarget.style.background = `${colors.cyan}10`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.background = 'transparent'; }}
            >
              <Shield className="w-4 h-4" style={{ color: colors.cyan }} />
              <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>{user.rank}</span>
              <span className="text-xs" style={{ color: colors.textSecondary }}>(Lvl {user.level})</span>
            </button>
          </div>
      )}

      {/* Only show default content when NOT on earningsGame and no screen matched */}
      {!screenContent && screen !== 'earningsGame' && (
        <>
      <ChallengeModal />
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '8px',
            background: toast.type === 'error' ? '#ff4757' :
                        toast.type === 'success' ? '#00ff88' : '#f59e0b',
            color: toast.type === 'success' ? '#000' : '#fff',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxWidth: '90%',
            textAlign: 'center',
          }}
        >
          {toast.message}
        </div>
      )}

        </>
      )}


      {/* ========== MOBILE BOTTOM NAV ========== */}
      {user && isMobile && screen !== 'home' && !GAMEPLAY_SCREENS.includes(screen) && (
        <BottomNav
          screen={screen}
          setScreen={setScreen}
          setShowForge={setShowForge}
          showForge={showForge}
        />
      )}

      {/* ClashBot Bug Reporter — persistent floating widget on all screens when logged in */}
      {user && (
        <ClashBotWidget
          user={user}
          screen={screen}
          gameMode={gameMode}
          currentBattle={currentBattle}
          colors={colors}
          isDesktop={isDesktop}
        />
      )}
    </>
  );
}