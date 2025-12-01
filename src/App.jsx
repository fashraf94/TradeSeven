import React, { useState, useEffect } from 'react';
import { loadBattlesSafe, saveBattlesSafe, isSameBattles, loadUser, saveUser } from './services/LocalStorage';
import * as battleTimer from './services/battleTimer';
import * as challengeService from './services/challengeService';
import './firebase/config';
import { motion } from 'framer-motion';

// Inline Stock API (temporary until you set up services folder)
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Google' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway' },
  { symbol: 'V', name: 'Visa' },
  { symbol: 'JPM', name: 'JPMorgan Chase' },
  { symbol: 'WMT', name: 'Walmart' },
  { symbol: 'MA', name: 'Mastercard' },
  { symbol: 'PG', name: 'Procter & Gamble' },
  { symbol: 'UNH', name: 'UnitedHealth' },
  { symbol: 'HD', name: 'Home Depot' }
];

const POPULAR_CRYPTO = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
  { id: 'monero', symbol: 'XMR', name: 'Monero' },
  { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol' }
];

const FALLBACK_CRYPTO_PRICES = {
  'bitcoin': 91000, 'ethereum': 3100, 'binancecoin': 620, 'solana': 235,
  'ripple': 1.10, 'cardano': 0.98, 'dogecoin': 0.38, 'avalanche-2': 42,
  'polkadot': 7.5, 'matic-network': 0.48, 'chainlink': 14.5, 'uniswap': 9.2,
  'litecoin': 88, 'stellar': 0.42, 'monero': 158, 'algorand': 0.35,
  'cosmos': 6.8, 'near': 5.6
};

async function getStockPrice(symbol) {
  try {
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return { symbol, price: data.c || 0, change: data.d || 0, percentChange: data.dp || 0 };
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return { symbol, price: 100, change: 0, percentChange: 0 };
  }
}

async function getCryptoPrice(cryptoId) {
  // Try 1: Direct API call (might work in some browsers/environments)
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true`;
    
    console.log(`🔍 Fetching crypto price for ${cryptoId} (direct)...`);
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data[cryptoId]) {
        console.log(`✅ Got price for ${cryptoId}: $${data[cryptoId].usd} (direct)`);
        return { id: cryptoId, price: data[cryptoId].usd || 0, change24h: data[cryptoId].usd_24h_change || 0 };
      }
    }
  } catch (error) {
    console.log(`⚠️ Direct API failed for ${cryptoId}, trying proxy...`);
  }
  
  // Try 2: CORS proxy
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true`;
    const proxiedUrl = CORS_PROXY + encodeURIComponent(url);
    
    console.log(`🔍 Fetching crypto price for ${cryptoId} (proxy)...`);
    const response = await fetch(proxiedUrl);
    
    if (!response.ok) {
      console.error(`❌ HTTP error for ${cryptoId}! status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data[cryptoId]) {
      console.error(`❌ No data returned for ${cryptoId}:`, data);
      throw new Error('Crypto data not found');
    }
    
    console.log(`✅ Got price for ${cryptoId}: $${data[cryptoId].usd} (proxy)`);
    return { id: cryptoId, price: data[cryptoId].usd || 0, change24h: data[cryptoId].usd_24h_change || 0 };
  } catch (error) {
    console.warn(`⚠️ All API attempts failed for ${cryptoId}, using fallback ($${FALLBACK_CRYPTO_PRICES[cryptoId]}):`, error.message);
    return { id: cryptoId, price: FALLBACK_CRYPTO_PRICES[cryptoId] || 100, change24h: 0 };
  }
}

async function getPopularStocks() {
  try {
    const stocksWithPrices = await Promise.all(
      POPULAR_STOCKS.map(async (stock) => {
        const priceData = await getStockPrice(stock.symbol);
        return { symbol: stock.symbol, name: stock.name, price: priceData.price, change: priceData.change, percentChange: priceData.percentChange };
      })
    );
    return stocksWithPrices;
  } catch (error) {
    console.error('Error fetching popular stocks:', error);
    return POPULAR_STOCKS.map(stock => ({ symbol: stock.symbol, name: stock.name, price: 100, change: 0, percentChange: 0 }));
  }
}

async function getPopularCrypto() {
  try {
    const batchSize = 6;
    const batches = [];
    for (let i = 0; i < POPULAR_CRYPTO.length; i += batchSize) {
      batches.push(POPULAR_CRYPTO.slice(i, i + batchSize));
    }
    const allCryptoWithPrices = [];
    for (const batch of batches) {
      const batchPromises = batch.map(async (crypto) => {
        const priceData = await getCryptoPrice(crypto.id);
        return { symbol: crypto.symbol, name: crypto.name, price: priceData.price, change24h: priceData.change24h };
      });
      const batchResults = await Promise.all(batchPromises);
      allCryptoWithPrices.push(...batchResults);
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return allCryptoWithPrices;
  } catch (error) {
    console.error('Error fetching popular crypto:', error);
    return POPULAR_CRYPTO.map(crypto => ({ symbol: crypto.symbol, name: crypto.name, price: FALLBACK_CRYPTO_PRICES[crypto.id] || 100, change24h: 0 }));
  }
}

const stockAPI = { getStockPrice, getCryptoPrice, getPopularStocks, getPopularCrypto };

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
  Eye,
  Bot,
  GraduationCap,
  Skull,
  Shield,
  ArrowRight,
  User,
  Flame,
  Brain
} from 'lucide-react';

const PERCENTAGE_OPTIONS = [7.5, 10, 12.5, 15, 17.5, 20];

// Dark Gaming Theme Colors
const colors = {
  background: '#0d1117',
  cardBg: '#161b22',
  cardHover: '#1c2128',
  cardElevated: '#21262d',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
  cyan: '#00d9ff',
  cyanDim: '#0099cc',
  green: '#10b981',
  greenBright: '#00ff88',
  red: '#ef4444',
  redBright: '#ff4466',
  blue: '#3b82f6',
  purple: '#9333ea',
  gold: '#ffc107',
  border: 'rgba(0, 217, 255, 0.2)',
  borderSubtle: 'rgba(255, 255, 255, 0.1)'
};

// Style override to neutralize App.css
const containerStyle = {
  maxWidth: 'none',
  width: '100%',
  margin: 0,
  padding: 0,
  textAlign: 'left',
  minHeight: '100vh',
  background: colors.background
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

export default function PortfolioDuel() {
  // ============================================
  // 1. ALL STATE DECLARATIONS
  // ============================================
  const [screen, setScreen] = useState('home');
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [portfolioName, setPortfolioName] = useState('');

  // Market data state
  const [stocksData, setStocksData] = useState([]);
  const [cryptoData, setCryptoData] = useState([]);
  const [loadingMarketData, setLoadingMarketData] = useState(true);

  // Battle management
  const [battles, setBattles] = useState([]);
  const [currentBattle, setCurrentBattle] = useState(null);
  const [activeBattleId, setActiveBattleId] = useState(null);

  // Portfolio builder state
  const [assetType, setAssetType] = useState('stocks');
  const [searchTerm, setSearchTerm] = useState('');
  const [portfolio, setPortfolio] = useState([]);
  const [portfolioType, setPortfolioType] = useState(null); // 'stocks' or 'crypto'

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

  // ============================================
  // 2. ALL USEEFFECTS (AT TOP LEVEL)
  // ============================================

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = loadUser();
    if (savedUser) {
      setUser(savedUser);
      setScreen('dashboard');
    }
  }, []);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      saveUser(user);
    }
  }, [user]);

  // Load market data on mount
  useEffect(() => {
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
      }

      setLoadingMarketData(false);
    }

    loadMarketData();

    // Refresh prices every 5 minutes
    const interval = setInterval(loadMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Refresh battles when entering dashboard or join screen
  useEffect(() => {
    if (screen === 'dashboard' || screen === 'join') {
      const saved = loadBattlesSafe();
      if (!isSameBattles(battles, saved)) {
        setBattles(saved);
      }
    }
  }, [screen]);

  // Poll for updates while on dashboard
  useEffect(() => {
    if (screen !== 'dashboard') return;

    const interval = setInterval(() => {
      const saved = loadBattlesSafe();
      if (!isSameBattles(battles, saved)) {
        setBattles(saved);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [screen, battles]);

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
  useEffect(() => {
    if (screen !== 'battle' || !currentBattle) return;

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
        
        // Get all unique symbols from both portfolios
        const allAssets = [
          ...currentBattle.creatorPortfolio,
          ...(currentBattle.opponentPortfolio || [])
        ];

        const uniqueSymbols = [...new Set(allAssets.map(a => a.symbol))];

        // Fetch current prices for each asset
        const priceMap = {};

        for (const asset of allAssets) {
          if (priceMap[asset.symbol]) continue; // Skip if already fetched

          try {
            // Determine if it's crypto or stock
            const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === asset.symbol);

            let currentPrice;
            if (isCrypto) {
              const cryptoData = POPULAR_CRYPTO.find(c => c.symbol === asset.symbol);
              const data = await stockAPI.getCryptoPrice(cryptoData.id);
              currentPrice = data.price;
            } else {
              const data = await stockAPI.getStockPrice(asset.symbol);
              currentPrice = data.price;
            }

            priceMap[asset.symbol] = currentPrice;
          } catch (error) {
            console.error(`Error fetching price for ${asset.symbol}:`, error);
            priceMap[asset.symbol] = asset.price;
          }
        }

        setBattlePrices(priceMap);
      } catch (error) {
        console.error('Error fetching battle prices:', error);
      }

      setLoadingBattlePrices(false);
    }

    fetchBattlePrices();

    // ⭐ Only refresh for active battles, not completed ones
    const battleStatus = battleTimer.getBattleStatus(currentBattle);
    if (battleStatus === 'active') {
      const interval = setInterval(fetchBattlePrices, 30000);
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
          if (battle.creator === user.username || battle.opponent === user.username) {
            updateUserStatsFromBattle(processedBattle);
          }
        }
      }
    };
    
    checkCompletedBattles();
    const interval = setInterval(checkCompletedBattles, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Load previous battles when user logs in or screen changes to dashboard
  useEffect(() => {
    if (user && screen === 'dashboard') {
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

  // ============================================
  // 3. HELPER FUNCTIONS
  // ============================================

  // Fetch current prices for all assets in a battle
  async function fetchCurrentPricesForBattle(battle) {
    const prices = {};
    
    // Get all unique assets from both portfolios
    const allAssets = [
      ...(battle.creatorPortfolio || []),
      ...(battle.opponentPortfolio || [])
    ];
    
    for (const asset of allAssets) {
      if (prices[asset.symbol]) continue; // Skip if already fetched
      
      try {
        // Determine if it's crypto or stock
        const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === asset.symbol);
        
        if (isCrypto) {
          const cryptoData = POPULAR_CRYPTO.find(c => c.symbol === asset.symbol);
          const data = await stockAPI.getCryptoPrice(cryptoData.id);
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

  // Update current user's stats after a battle completes
  function updateUserStatsFromBattle(battle) {
    if (!battle.result) return;
    
    const userXP = battle.result.xpAwarded[user.username];
    const won = battle.result.winner === user.username;
    
    // Update user object
    const updatedUser = {
      ...user,
      xp: user.xp + userXP
    };
    
    // ⭐ Only update W/L for non-training battles
    if (!battle.isTrainingBattle) {
      updatedUser.wins = won ? user.wins + 1 : user.wins;
      updatedUser.losses = won ? user.losses : user.losses + 1;
    }
    // Training battles still award XP but don't affect W/L record
    
    // Check for rank up
    const newRank = battleTimer.determineRank(updatedUser.xp);
    if (newRank !== updatedUser.rank) {
      updatedUser.rank = newRank;
      console.log(`🎉 Rank up! You are now ${newRank}`);
    }
    
    // Update user state and save
    setUser(updatedUser);
    saveUser(updatedUser);
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
        .filter(b => b.creator === user?.username || b.opponent === user?.username)
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

  const handleLogin = () => {
    if (!username.trim()) return;
    
    setUser({
      username: username.trim(),
      wins: 0,
      losses: 0,
      xp: 0,
      rank: 'Beginner',
      level: 1
    });
    setScreen('dashboard');
  };

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

  const handleCreateBattle = () => {
    console.log('=== CREATE BATTLE CLICKED ===');
    console.log('Portfolio Valid:', isPortfolioValid);
    console.log('Portfolio Name:', portfolioName);
    
    if (!isPortfolioValid || !portfolioName.trim()) {
      alert('Please complete your portfolio with a name before creating a battle');
      return;
    }

    const challengeCode = generateChallengeCode();
    console.log('Generated Challenge Code:', challengeCode);
    
    // Convert portfolio to battle format (percentage to dollar amounts)
    const portfolioAssets = portfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      price: asset.price,
      amount: (asset.percentage / 100) * 1000000 // $1M portfolio
    }));

    const newBattle = {
      id: Date.now().toString(),
      challengeCode,
      creator: user.username,
      creatorPortfolio: portfolioAssets,
      portfolioName: portfolioName.trim(),
      opponent: null,
      opponentPortfolio: null,
      status: 'waiting',
      startDate: null,
      endDate: null,
      createdAt: new Date().toISOString()
    };

    // Load current battles from localStorage
    const currentBattles = loadBattlesSafe();
    const updatedBattles = [...currentBattles, newBattle];
    
    // Save to localStorage immediately
    saveBattlesSafe(updatedBattles);
    
    // Update component state
    setBattles(updatedBattles);
    setActiveBattleId(newBattle.id);
    setPortfolio([]); setPortfolioType(null);
    setPortfolioName('');
    setScreen('dashboard');
  };

  const handleJoinBattle = async () => {
    console.log('=== JOIN BATTLE CLICKED ===');
    console.log('Join Code:', joinCode);
    console.log('Portfolio Valid:', isPortfolioValid);
    console.log('Portfolio Name:', portfolioName);
    
    if (!joinCode.trim()) {
      alert('Please enter a challenge code');
      return;
    }

    if (!isPortfolioValid || !portfolioName.trim()) {
      alert('Please complete your portfolio with a name before joining');
      return;
    }

    // CRITICAL: Load battles from localStorage to see battles from other tabs/users
    const allBattles = loadBattlesSafe();
    console.log('All battles from localStorage:', allBattles);
    console.log('Looking for code:', joinCode.trim().toUpperCase());
    
    const battleToJoin = allBattles.find(
      b => b.challengeCode === joinCode.trim().toUpperCase() && b.status === 'waiting'
    );

    console.log('Battle found:', battleToJoin);

    if (!battleToJoin) {
      alert(`Battle not found or already started. Searched for: ${joinCode.trim().toUpperCase()}\nFound ${allBattles.length} total battles in storage.`);
      return;
    }

    if (battleToJoin.creator === user.username) {
      alert('You cannot join your own battle');
      return;
    }

    // CHECK PORTFOLIO TYPE COMPATIBILITY
    // Determine creator's portfolio type by checking their assets
    const creatorFirstAsset = battleToJoin.creatorPortfolio[0];
    const creatorIsCrypto = POPULAR_CRYPTO.some(c => c.symbol === creatorFirstAsset.symbol);
    const creatorIsStocks = POPULAR_STOCKS.some(s => s.symbol === creatorFirstAsset.symbol);
    
    // Determine joiner's portfolio type
    const joinerIsCrypto = portfolioType === 'crypto';
    const joinerIsStocks = portfolioType === 'stocks';
    
    console.log('Creator portfolio type:', creatorIsCrypto ? 'crypto' : 'stocks');
    console.log('Joiner portfolio type:', joinerIsCrypto ? 'crypto' : 'stocks');
    
    // Validate portfolio types match
    if ((creatorIsCrypto && joinerIsStocks) || (creatorIsStocks && joinerIsCrypto)) {
      alert(`Portfolio type mismatch!\n\nThis battle requires a ${creatorIsCrypto ? 'CRYPTO' : 'STOCKS'} portfolio, but you built a ${joinerIsCrypto ? 'CRYPTO' : 'STOCKS'} portfolio.\n\nPlease create a ${creatorIsCrypto ? 'crypto' : 'stocks'} portfolio to join this battle.`);
      return;
    }

    // Convert portfolio to battle format
    const portfolioAssets = portfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      price: asset.price,
      amount: (asset.percentage / 100) * 1000000
    }));

    // Calculate start and end dates
    const now = new Date();
    const startDate = new Date(now); // Start immediately for testing
    const endDate = new Date(startDate.getTime() + battleTimer.BATTLE_DURATION);

    // ⭐ FETCH STARTING PRICES - Lock in prices when battle starts
    console.log('🔒 Fetching starting prices for battle...');
    const startingPrices = {};
    
    // Get all unique assets from both portfolios
    const allAssets = [...battleToJoin.creatorPortfolio, ...portfolioAssets];
    const uniqueSymbols = [...new Set(allAssets.map(a => a.symbol))];
    
    for (const symbol of uniqueSymbols) {
      const asset = allAssets.find(a => a.symbol === symbol);
      try {
        const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === symbol);
        
        if (isCrypto) {
          const cryptoData = POPULAR_CRYPTO.find(c => c.symbol === symbol);
          const data = await stockAPI.getCryptoPrice(cryptoData.id);
          startingPrices[symbol] = data.price;
        } else {
          const data = await stockAPI.getStockPrice(symbol);
          startingPrices[symbol] = data.price;
        }
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        startingPrices[symbol] = asset.price; // Fallback to stored price
      }
    }
    
    console.log('✅ Starting prices locked:', startingPrices);

    // ⭐ UPDATE BOTH PORTFOLIOS TO USE THE SAME STARTING PRICES
    const updatedCreatorPortfolio = battleToJoin.creatorPortfolio.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));
    
    const updatedOpponentPortfolio = portfolioAssets.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));

    // Update the battle
    const updatedBattles = allBattles.map(b =>
      b.id === battleToJoin.id
        ? {
            ...b,
            opponent: user.username,
            creatorPortfolio: updatedCreatorPortfolio, // ⭐ Updated with starting prices
            opponentPortfolio: updatedOpponentPortfolio, // ⭐ Updated with starting prices
            status: 'active',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            startingPrices: startingPrices // ⭐ Store starting prices on battle
          }
        : b
    );

    // Save to localStorage immediately
    saveBattlesSafe(updatedBattles);
    console.log('✅ Saved updated battles to localStorage');
    console.log('Updated battle:', updatedBattles.find(b => b.id === battleToJoin.id));
    
    // Update component state
    setBattles(updatedBattles);
    console.log('✅ Updated component state with battles');

    setActiveBattleId(battleToJoin.id);
    console.log('✅ Set active battle ID:', battleToJoin.id);
    
    setPortfolio([]); setPortfolioType(null);
    setPortfolioName('');
    setJoinCode('');
    
    console.log('✅ Navigating to dashboard...');
    setScreen('dashboard');
  };

  // ============================================
  // TRAINING MODE: CREATE TRAINING BATTLE
  // ============================================
  const handleCreateTrainingBattle = async () => {
    console.log('=== CREATE TRAINING BATTLE ===');
    
    if (!isPortfolioValid || !portfolioName.trim()) {
      alert('Please complete your portfolio with a name before starting training');
      return;
    }

    // Convert user portfolio to battle format
    const userPortfolioAssets = portfolio.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      price: asset.price,
      amount: (asset.percentage / 100) * 1000000
    }));

    // Generate CPU opponent portfolio
    console.log('🤖 Generating CPU opponent portfolio...');
    const cpuPortfolio = generateCPUPortfolio(portfolioType, stocksData, cryptoData);
    console.log('✅ CPU portfolio generated:', cpuPortfolio);

    // Calculate start and end dates (1 hour for training)
    const now = new Date();
    const startDate = new Date(now);
    const TRAINING_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
    const endDate = new Date(startDate.getTime() + TRAINING_DURATION);

    // Fetch starting prices for all assets
    console.log('🔒 Fetching starting prices for training battle...');
    const startingPrices = {};
    
    const allAssets = [...userPortfolioAssets, ...cpuPortfolio];
    const uniqueSymbols = [...new Set(allAssets.map(a => a.symbol))];
    
    for (const symbol of uniqueSymbols) {
      const asset = allAssets.find(a => a.symbol === symbol);
      try {
        const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === symbol);
        
        if (isCrypto) {
          const cryptoData = POPULAR_CRYPTO.find(c => c.symbol === symbol);
          const data = await stockAPI.getCryptoPrice(cryptoData.id);
          startingPrices[symbol] = data.price;
        } else {
          const data = await stockAPI.getStockPrice(symbol);
          startingPrices[symbol] = data.price;
        }
      } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        startingPrices[symbol] = asset.price;
      }
    }
    
    console.log('✅ Starting prices locked for training battle:', startingPrices);

    // Update both portfolios with locked starting prices
    const updatedUserPortfolio = userPortfolioAssets.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));
    
    const updatedCPUPortfolio = cpuPortfolio.map(asset => ({
      ...asset,
      price: startingPrices[asset.symbol] || asset.price
    }));

    // Create training battle object
    const trainingBattle = {
      id: Date.now().toString(),
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

    // Load current battles and add training battle
    const currentBattles = loadBattlesSafe();
    const updatedBattles = [...currentBattles, trainingBattle];
    
    // Save to localStorage
    saveBattlesSafe(updatedBattles);
    
    // Update component state
    setBattles(updatedBattles);
    setActiveBattleId(trainingBattle.id);
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    
    console.log('✅ Training battle created:', trainingBattle);
    setScreen('dashboard');
  };

  // ============================================
  // 5. COMPUTED VALUES
  // ============================================

  const totalPercentage = portfolio.reduce((sum, p) => sum + p.percentage, 0);
  const isPortfolioValid = portfolio.length >= 7 && 
    portfolio.length <= 13 && 
    Math.abs(totalPercentage - 100) < 0.01 &&
    portfolio.every(p => p.percentage >= 7.5 && p.percentage <= 20);

  const availableAssets = assetType === 'stocks' ? stocksData : cryptoData;
  const filteredAssets = availableAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get battles for current user
  const userBattles = battles.filter(b => 
    b.creator === user?.username || b.opponent === user?.username
  );

  // Separate battles by status
  const activeBattles = userBattles.filter(b => 
    battleTimer.getBattleStatus(b) === 'active'
  );
  const waitingBattles = userBattles.filter(b => 
    battleTimer.getBattleStatus(b) === 'waiting'
  );
  const completedBattles = userBattles.filter(b => 
    battleTimer.getBattleStatus(b) === 'completed'
  );

  // ============================================
  // 6. SCREEN RENDERS
  // ============================================

  // LOGIN SCREEN
  if (screen === 'home') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: colors.background
        }}>
          {/* Animated Card Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              width: '100%',
              maxWidth: '480px',
              background: colors.cardBg,
              borderRadius: '16px',
              boxShadow: '0 0 40px rgba(0, 217, 255, 0.1), 0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              padding: '48px',
              border: `1px solid ${colors.border}`
            }}
          >
            <div style={{ textAlign: 'center' }}>
              {/* Animated Logo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.2,
                  duration: 0.5,
                  type: "spring",
                  stiffness: 200,
                  damping: 15
                }}
                style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}
              >
                <motion.div
                  animate={{
                    y: [0, -8, 0],
                    boxShadow: [
                      '0 0 30px rgba(0, 217, 255, 0.4)',
                      '0 0 50px rgba(0, 217, 255, 0.6)',
                      '0 0 30px rgba(0, 217, 255, 0.4)'
                    ]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)`
                  }}
                >
                  <Swords style={{ height: '40px', width: '40px', color: colors.background }} />
                </motion.div>
              </motion.div>

              {/* Animated Title */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                style={{ marginBottom: '32px' }}
              >
                <h1 style={{
                  fontSize: '42px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  margin: '0 0 8px 0',
                  background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.greenBright} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  MarketClash
                </h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  style={{ color: colors.textSecondary, fontSize: '16px', margin: 0 }}
                >
                  Compete. Trade. Conquer.
                </motion.p>
              </motion.div>

              {/* Animated Input Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    fontSize: '16px',
                    border: '2px solid',
                    borderColor: username ? colors.cyan : colors.borderSubtle,
                    borderRadius: '12px',
                    outline: 'none',
                    marginBottom: '20px',
                    boxSizing: 'border-box',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: colors.textPrimary,
                    transition: 'all 0.3s ease'
                  }}
                />

                <motion.button
                  onClick={handleLogin}
                  disabled={!username.trim()}
                  whileHover={username.trim() ? { scale: 1.02, y: -2 } : {}}
                  whileTap={username.trim() ? { scale: 0.98 } : {}}
                  animate={username.trim() ? {
                    boxShadow: [
                      '0 0 20px rgba(0, 217, 255, 0.3)',
                      '0 0 40px rgba(0, 217, 255, 0.5)',
                      '0 0 20px rgba(0, 217, 255, 0.3)'
                    ]
                  } : {}}
                  transition={username.trim() ? {
                    boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  } : {}}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: username.trim() ? colors.background : colors.textMuted,
                    background: username.trim() ? `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)` : colors.cardElevated,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: username.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  Enter Arena
                  <ArrowRight style={{ height: '18px', width: '18px' }} />
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN - New Flowing Card Layout
  if (screen === 'dashboard') {
    // Debug logging
    console.log('📊 DASHBOARD RENDER');
    console.log('Current user:', user?.username);
    console.log('Total battles in state:', battles.length);
    console.log('User battles:', userBattles.length);
    console.log('Active battles:', activeBattles.length, activeBattles.map(b => ({code: b.challengeCode, creator: b.creator, opponent: b.opponent, status: b.status})));
    console.log('Waiting battles:', waitingBattles.length, waitingBattles.map(b => ({code: b.challengeCode, creator: b.creator, opponent: b.opponent, status: b.status})));

    // Get first active battle for preview card
    const primaryActiveBattle = activeBattles[0];
    const hasActiveBattle = activeBattles.length > 0;

    // Calculate battle stats for preview
    let battlePreviewData = null;
    if (primaryActiveBattle) {
      const isCreator = primaryActiveBattle.creator === user.username;
      const opponent = isCreator ? primaryActiveBattle.opponent : primaryActiveBattle.creator;
      const myPortfolio = isCreator ? primaryActiveBattle.creatorPortfolio : primaryActiveBattle.opponentPortfolio;
      const theirPortfolio = isCreator ? primaryActiveBattle.opponentPortfolio : primaryActiveBattle.creatorPortfolio;

      let myValue = 0;
      myPortfolio.forEach(asset => {
        const shares = asset.amount / asset.price;
        myValue += shares * asset.price;
      });

      let theirValue = 0;
      theirPortfolio.forEach(asset => {
        const shares = asset.amount / asset.price;
        theirValue += shares * asset.price;
      });

      const myGain = ((myValue - 1000000) / 1000000) * 100;
      const theirGain = ((theirValue - 1000000) / 1000000) * 100;
      const isWinning = myGain > theirGain;
      const leadBy = Math.abs(myGain - theirGain);

      battlePreviewData = { opponent, myGain, theirGain, isWinning, leadBy, myValue, theirValue };
    }

    // XP calculation for modal
    const xpForNextLevel = 10000;
    const xpProgress = (user.xp / xpForNextLevel) * 100;
    const xpNeeded = xpForNextLevel - user.xp;
    const ranks = ['Rookie', 'Apprentice', 'Trader', 'Expert', 'Master', 'Legend'];
    const currentRankIndex = ranks.indexOf(user.rank);
    const nextRank = currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : 'Max Rank';

    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: colors.background
        }}>
          {/* XP Progress Modal */}
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
                backdropFilter: 'blur(4px)'
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

          {/* Header Bar */}
          <div style={{
            padding: '12px 24px',
            background: 'transparent',
            borderBottom: `1px solid ${colors.borderSubtle}`
          }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Flame style={{ height: '24px', width: '24px', color: colors.cyan }} />
                  <span style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.greenBright} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>MarketClash</span>
                </div>

                {/* User & Logout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: colors.cardBg,
                    border: `2px solid ${colors.cyan}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User style={{ height: '14px', width: '14px', color: colors.cyan }} />
                  </div>
                  <span style={{ color: colors.textPrimary, fontWeight: '500', fontSize: '14px' }}>{user.username}</span>
                  <button
                    onClick={() => {
                      setUser(null);
                      setUsername('');
                      setScreen('home');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'transparent',
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: '8px',
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '13px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.red;
                      e.currentTarget.style.color = colors.red;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.borderSubtle;
                      e.currentTarget.style.color = colors.textSecondary;
                    }}
                  >
                    <LogOut style={{ height: '14px', width: '14px' }} />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{
            flex: 1,
            maxWidth: '900px',
            margin: '0 auto',
            padding: '32px 24px',
            paddingBottom: '80px' // Space for bottom stats bar
          }}>
            {/* Active Battle Preview Card - Only shows when user has active battle */}
            {hasActiveBattle && primaryActiveBattle && battlePreviewData && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  background: colors.cardBg,
                  borderRadius: '16px',
                  padding: '20px 24px',
                  marginBottom: '24px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onClick={() => {
                  setCurrentBattle(primaryActiveBattle);
                  setScreen('battle');
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.cyan;
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.cyan}30`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Battle Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {primaryActiveBattle.isTrainingBattle && <GraduationCap style={{ height: '16px', width: '16px', color: colors.purple }} />}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {primaryActiveBattle.isTrainingBattle ? 'TRAINING BATTLE' : 'ACTIVE BATTLE'}: vs {battlePreviewData.opponent}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.cyan,
                    fontFamily: "'SF Mono', 'Monaco', monospace"
                  }}>
                    {battleTimer.formatTimeRemaining(primaryActiveBattle)} left
                  </span>
                </div>

                {/* Player Comparison */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  {/* You */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${colors.green}30 0%, ${colors.cyan}30 100%)`,
                      border: `2px solid ${colors.green}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <User style={{ height: '20px', width: '20px', color: colors.green }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: colors.textSecondary }}>YOU ({user.username})</div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: battlePreviewData.myGain >= 0 ? colors.green : colors.red
                      }}>
                        {battlePreviewData.myGain >= 0 ? '+' : ''}{battlePreviewData.myGain.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Opponent */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: 'row-reverse' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${colors.red}30 0%, ${colors.purple}30 100%)`,
                      border: `2px solid ${colors.red}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Target style={{ height: '20px', width: '20px', color: colors.red }} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', color: colors.textSecondary }}>OPPONENT</div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: battlePreviewData.theirGain >= 0 ? colors.green : colors.red
                      }}>
                        {battlePreviewData.theirGain >= 0 ? '+' : ''}{battlePreviewData.theirGain.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                  position: 'relative',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(battlePreviewData.myValue / (battlePreviewData.myValue + battlePreviewData.theirValue)) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      height: '100%',
                      borderRadius: '9999px',
                      background: battlePreviewData.isWinning
                        ? 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)'
                        : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                    }}
                  />
                </div>

                {/* Status & Button */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: battlePreviewData.isWinning ? colors.green : colors.red
                  }}>
                    {battlePreviewData.isWinning ? `LEADING BY +${battlePreviewData.leadBy.toFixed(1)}%` : `TRAILING BY -${battlePreviewData.leadBy.toFixed(1)}%`}
                  </span>
                  <button
                    style={{
                      padding: '8px 16px',
                      background: primaryActiveBattle.isTrainingBattle ? colors.purple : colors.cyan,
                      border: 'none',
                      borderRadius: '8px',
                      color: colors.background,
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    VIEW BATTLE
                  </button>
                </div>
              </motion.div>
            )}

            {/* Waiting Battles - Compact */}
            {waitingBattles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{
                  background: colors.cardBg,
                  borderRadius: '16px',
                  padding: '20px 24px',
                  marginBottom: '24px',
                  border: `1px solid ${colors.gold}40`
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <Clock style={{ height: '20px', width: '20px', color: colors.gold }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.gold,
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Waiting for Opponent
                  </span>
                </div>
                {waitingBattles.map(battle => (
                  <div key={battle.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '12px',
                    marginBottom: waitingBattles.indexOf(battle) < waitingBattles.length - 1 ? '8px' : 0
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: colors.cyan,
                      fontFamily: "'SF Mono', monospace",
                      letterSpacing: '3px'
                    }}>
                      {battle.challengeCode}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(battle.challengeCode);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: 'transparent',
                        border: `1px solid ${colors.cyan}`,
                        borderRadius: '8px',
                        color: colors.cyan,
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${colors.cyan}20`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Copy style={{ height: '14px', width: '14px' }} />
                      Copy
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Create & Join Battle Cards - Side by Side */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: hasActiveBattle ? '1fr 1fr' : '1fr 1fr',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* CREATE BATTLE Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                onClick={() => {
                  setPortfolio([]); setPortfolioType(null);
                  setPortfolioName('');
                  setAssetType('stocks');
                  setSearchTerm('');
                  setScreen('builder');
                }}
                style={{
                  position: 'relative',
                  background: colors.cardBg,
                  borderRadius: '16px',
                  padding: hasActiveBattle ? '28px 24px' : '40px 32px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.cyan;
                  e.currentTarget.style.boxShadow = `0 0 30px ${colors.cyan}30`;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Background Pattern - Chart Lines */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.08,
                  background: `
                    linear-gradient(90deg, transparent 0%, ${colors.cyan}20 50%, transparent 100%),
                    repeating-linear-gradient(
                      0deg,
                      transparent,
                      transparent 20px,
                      ${colors.cyan}10 20px,
                      ${colors.cyan}10 21px
                    )
                  `,
                  pointerEvents: 'none'
                }} />

                {/* Gradient Overlay */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '40%',
                  height: '100%',
                  background: `linear-gradient(90deg, ${colors.cyan}10 0%, transparent 100%)`,
                  pointerEvents: 'none'
                }} />

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <Trophy style={{
                    height: hasActiveBattle ? '40px' : '56px',
                    width: hasActiveBattle ? '40px' : '56px',
                    color: colors.cyan,
                    marginBottom: '16px'
                  }} />
                  <h3 style={{
                    fontSize: hasActiveBattle ? '20px' : '24px',
                    fontWeight: 'bold',
                    color: colors.textPrimary,
                    margin: '0 0 8px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>
                    Create Battle
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: colors.textSecondary,
                    margin: '0 0 20px 0'
                  }}>
                    Start a new battle & set the rules.
                  </p>
                  <div style={{
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
                    letterSpacing: '1px'
                  }}>
                    CREATE BATTLE
                    <Plus style={{ height: '16px', width: '16px' }} />
                  </div>
                </div>
              </motion.div>

              {/* JOIN BATTLE Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                onClick={() => {
                  setPortfolio([]); setPortfolioType(null);
                  setPortfolioName('');
                  setAssetType('stocks');
                  setSearchTerm('');
                  setJoinCode('');
                  setScreen('join');
                }}
                style={{
                  position: 'relative',
                  background: colors.cardBg,
                  borderRadius: '16px',
                  padding: hasActiveBattle ? '28px 24px' : '40px 32px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.purple;
                  e.currentTarget.style.boxShadow = `0 0 30px ${colors.purple}30`;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Background Pattern - Target/Crosshair */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  right: '10%',
                  transform: 'translateY(-50%)',
                  width: '120px',
                  height: '120px',
                  opacity: 0.06,
                  border: `3px solid ${colors.purple}`,
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }} />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  right: 'calc(10% + 30px)',
                  transform: 'translateY(-50%)',
                  width: '60px',
                  height: '60px',
                  opacity: 0.08,
                  border: `2px solid ${colors.purple}`,
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }} />

                {/* Gradient Overlay */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '40%',
                  height: '100%',
                  background: `linear-gradient(270deg, ${colors.purple}10 0%, transparent 100%)`,
                  pointerEvents: 'none'
                }} />

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <Swords style={{
                    height: hasActiveBattle ? '40px' : '56px',
                    width: hasActiveBattle ? '40px' : '56px',
                    color: colors.purple,
                    marginBottom: '16px'
                  }} />
                  <h3 style={{
                    fontSize: hasActiveBattle ? '20px' : '24px',
                    fontWeight: 'bold',
                    color: colors.textPrimary,
                    margin: '0 0 8px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>
                    Join Battle
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: colors.textSecondary,
                    margin: '0 0 20px 0'
                  }}>
                    Find an open match & compete.
                  </p>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: 'transparent',
                    border: `2px solid ${colors.purple}`,
                    borderRadius: '10px',
                    color: colors.purple,
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    JOIN BATTLE
                    <ArrowRight style={{ height: '16px', width: '16px' }} />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Training Mode Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              onClick={() => {
                setPortfolio([]); setPortfolioType(null);
                setPortfolioName('');
                setAssetType('stocks');
                setSearchTerm('');
                setScreen('training');
              }}
              style={{
                background: `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`,
                borderRadius: '14px',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                marginBottom: '24px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(245, 158, 11, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Brain style={{ height: '28px', width: '28px', color: colors.background }} />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: colors.background,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Training Mode
                </span>
                <span style={{
                  fontSize: '14px',
                  color: 'rgba(0, 0, 0, 0.7)',
                  marginLeft: '12px'
                }}>
                  Practice your strategy
                </span>
              </div>
              <ArrowRight style={{ height: '20px', width: '20px', color: colors.background }} />
            </motion.div>

            {/* Completed Battles - Compact List */}
            {completedBattles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                style={{ marginBottom: '24px' }}
              >
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
                {completedBattles.slice(0, 3).map(battle => {
                  const result = battle.result;
                  if (!result) return null;
                  const won = result.winner === user.username;
                  const userReturn = battle.creator === user.username ? result.creatorReturn : result.opponentReturn;
                  const opponent = battle.creator === user.username ? battle.opponent : battle.creator;

                  return (
                    <div
                      key={battle.id}
                      onClick={() => {
                        setCurrentBattle(battle);
                        setScreen('battle');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        background: colors.cardBg,
                        borderRadius: '12px',
                        marginBottom: '8px',
                        border: `1px solid ${won ? colors.green : colors.red}30`,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = colors.cardHover;
                        e.currentTarget.style.borderColor = won ? colors.green : colors.red;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = colors.cardBg;
                        e.currentTarget.style.borderColor = `${won ? colors.green : colors.red}30`;
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: won ? `${colors.green}20` : `${colors.red}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {won ? (
                            <Trophy style={{ height: '18px', width: '18px', color: colors.green }} />
                          ) : (
                            <Skull style={{ height: '18px', width: '18px', color: colors.red }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                            vs {opponent}
                          </div>
                          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                            {battle.isTrainingBattle ? 'Training' : battleTimer.formatDate(battle.completedAt || battle.endDate)}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: userReturn >= 0 ? colors.green : colors.red
                      }}>
                        {userReturn >= 0 ? '+' : ''}{userReturn}%
                      </div>
                    </div>
                  );
                })}
                {completedBattles.length > 3 && (
                  <button
                    onClick={() => {
                      setShowPreviousBattles(true);
                      setScreen('previousBattles');
                    }}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'transparent',
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: '10px',
                      color: colors.textSecondary,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.cyan;
                      e.currentTarget.style.color = colors.cyan;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.borderSubtle;
                      e.currentTarget.style.color = colors.textSecondary;
                    }}
                  >
                    View All Battles ({completedBattles.length})
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {/* Bottom Stats Bar - Fixed */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '56px',
            background: colors.cardBg,
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
            zIndex: 100
          }}>
            {/* Wins */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy style={{ height: '18px', width: '18px', color: colors.gold }} />
              <span style={{ fontSize: '14px', color: colors.textSecondary }}>Wins:</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: colors.green }}>{user.wins}</span>
            </div>

            {/* Losses */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skull style={{ height: '18px', width: '18px', color: colors.textMuted }} />
              <span style={{ fontSize: '14px', color: colors.textSecondary }}>Losses:</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: colors.red }}>{user.losses}</span>
            </div>

            {/* Battles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Swords style={{ height: '18px', width: '18px', color: colors.cyan }} />
              <span style={{ fontSize: '14px', color: colors.textSecondary }}>Battles:</span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: colors.cyan }}>{user.wins + user.losses}</span>
            </div>

            {/* Rank - Clickable */}
            <button
              onClick={() => setShowXPModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'transparent',
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.cyan;
                e.currentTarget.style.background = `${colors.cyan}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.borderSubtle;
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Shield style={{ height: '18px', width: '18px', color: colors.cyan }} />
              <span style={{ fontSize: '14px', color: colors.textPrimary, fontWeight: '500' }}>
                {user.rank}
              </span>
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                (Lvl {user.level})
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PORTFOLIO BUILDER SCREEN (Create Game)
  if (screen === 'builder') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: colors.background
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            marginBottom: '24px',
            borderBottom: `1px solid ${colors.border}`
          }}>
            <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    margin: '0 0 4px 0',
                    color: colors.textPrimary
                  }}>Build Your Portfolio</h1>
                </div>
                <button
                  onClick={() => {
                    setPortfolio([]); setPortfolioType(null);
                    setPortfolioName('');
                    setScreen('dashboard');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: `${colors.red}20`,
                    border: `1px solid ${colors.red}`,
                    borderRadius: '8px',
                    color: colors.red,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${colors.red}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${colors.red}20`;
                  }}
                >
                  <X style={{ height: '18px', width: '18px' }} />
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1536px', margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              {/* Left: Asset Selection */}
              <div>
                <div style={{
                  background: colors.cardBg,
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  padding: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: colors.textPrimary }}>Available Assets</h2>

                  {loadingMarketData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                      <Loader2 style={{ height: '32px', width: '32px', color: colors.cyan, animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button
                          onClick={() => setAssetType('stocks')}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            border: assetType === 'stocks' ? 'none' : `1px solid ${colors.borderSubtle}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'stocks' ? {
                              color: colors.background,
                              background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)`,
                              boxShadow: '0 0 15px rgba(0, 217, 255, 0.3)'
                            } : {
                              color: colors.textSecondary,
                              background: 'rgba(255, 255, 255, 0.05)'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'stocks') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'stocks') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                        >
                          Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '14px',
                            border: assetType === 'crypto' ? 'none' : `1px solid ${colors.borderSubtle}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'crypto' ? {
                              color: colors.background,
                              background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)`,
                              boxShadow: '0 0 15px rgba(0, 217, 255, 0.3)'
                            } : {
                              color: colors.textSecondary,
                              background: 'rgba(255, 255, 255, 0.05)'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'crypto') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'crypto') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          }}
                        >
                          Crypto
                        </button>
                      </div>

                      {/* Portfolio Type Indicator */}
                      {portfolioType && (
                        <div style={{
                          padding: '12px 16px',
                          marginBottom: '16px',
                          background: portfolioType === 'stocks' ? `${colors.blue}20` : `${colors.purple}20`,
                          border: `1px solid ${portfolioType === 'stocks' ? colors.blue : colors.purple}`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '18px' }}>
                            {portfolioType === 'stocks' ? '📈' : '₿'}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: colors.textPrimary }}>
                              {portfolioType === 'stocks' ? 'Stocks Portfolio' : 'Crypto Portfolio'}
                            </div>
                            <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                              You can only add {portfolioType === 'stocks' ? 'stocks' : 'crypto'} to this portfolio
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Search */}
                      <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          marginBottom: '16px',
                          border: `1px solid ${searchTerm ? colors.cyan : colors.borderSubtle}`,
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s',
                          boxSizing: 'border-box',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: colors.textPrimary,
                          fontSize: '14px'
                        }}
                      />

                      {/* Asset Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        maxHeight: '384px',
                        overflowY: 'auto'
                      }}>
                        {filteredAssets.map(asset => {
                          const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
                          return (
                            <button
                              key={asset.symbol}
                              onClick={() => handleAddAsset(asset)}
                              disabled={inPortfolio || portfolio.length >= 13}
                              style={{
                                padding: '14px',
                                borderRadius: '8px',
                                textAlign: 'left',
                                border: `1px solid ${inPortfolio ? colors.cyan : colors.borderSubtle}`,
                                cursor: inPortfolio || portfolio.length >= 13 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                background: inPortfolio ? `${colors.cyan}15` : 'rgba(0, 217, 255, 0.05)'
                              }}
                              onMouseEnter={(e) => {
                                if (!inPortfolio && portfolio.length < 13) {
                                  e.currentTarget.style.background = `${colors.cyan}20`;
                                  e.currentTarget.style.borderColor = colors.cyan;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!inPortfolio) {
                                  e.currentTarget.style.background = 'rgba(0, 217, 255, 0.05)';
                                  e.currentTarget.style.borderColor = colors.borderSubtle;
                                }
                              }}
                            >
                              <div style={{ fontWeight: 'bold', color: colors.textPrimary, marginBottom: '2px' }}>{asset.symbol}</div>
                              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>{asset.name}</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: colors.cyan }}>${asset.price.toFixed(2)}</div>
                              {inPortfolio && (
                                <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '600', color: colors.green }}>✓ Added</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Portfolio Summary */}
              <div>
                <div style={{
                  background: colors.cardBg,
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  padding: '24px',
                  position: 'sticky',
                  top: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: colors.textPrimary }}>Your Portfolio</h2>
                  <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '16px' }}>
                    {portfolio.length}/13 assets • {totalPercentage.toFixed(1)}%
                  </p>

                  {/* Progress bar for allocation */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                    marginBottom: '16px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(totalPercentage, 100)}%`,
                      height: '100%',
                      background: totalPercentage === 100 ? colors.green : colors.cyan,
                      borderRadius: '3px',
                      transition: 'all 0.3s'
                    }} />
                  </div>

                  {/* Portfolio Name Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px' }}>
                      Portfolio Name <span style={{ color: colors.red }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter portfolio name"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: `1px solid ${portfolioName ? colors.cyan : (!portfolioName && portfolio.length > 0 ? colors.red : colors.borderSubtle)}`,
                        background: !portfolioName && portfolio.length > 0 ? `${colors.red}10` : 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        color: colors.textPrimary,
                        fontSize: '14px'
                      }}
                    />
                    {!portfolioName && portfolio.length > 0 && (
                      <div style={{ fontSize: '11px', color: colors.red, marginTop: '4px' }}>Portfolio name is required</div>
                    )}
                  </div>

                  {portfolio.length === 0 ? (
                    <div style={{ textAlign: 'center', color: colors.textMuted, padding: '48px 0' }}>
                      <Wallet style={{ height: '48px', width: '48px', marginBottom: '12px', opacity: 0.4 }} />
                      <div style={{ fontSize: '14px' }}>No assets selected</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
                        {portfolio.map(asset => (
                          <div key={asset.symbol} style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', marginBottom: '10px', border: `1px solid ${colors.borderSubtle}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#1F2937' }}>{asset.symbol}</div>
                                <div style={{ fontSize: '12px', color: '#6B7280' }}>${asset.price.toFixed(2)}</div>
                              </div>
                              <button
                                onClick={() => handleRemoveAsset(asset.symbol)}
                                style={{
                                  color: '#9CA3AF',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'color 0.2s',
                                  padding: 0
                                }}
                                onMouseEnter={(e) => e.target.style.color = '#EF4444'}
                                onMouseLeave={(e) => e.target.style.color = '#9CA3AF'}
                              >
                                <X style={{ height: '20px', width: '20px' }} />
                              </button>
                            </div>
                            
                            {/* Percentage Dropdown */}
                            <div style={{ position: 'relative' }}>
                              <select
                                value={asset.percentage}
                                onChange={(e) => handlePercentageChange(asset.symbol, parseFloat(e.target.value))}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '2px solid #00BCD4',
                                  borderRadius: '8px',
                                  outline: 'none',
                                  appearance: 'none',
                                  cursor: 'pointer',
                                  background: 'white',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {PERCENTAGE_OPTIONS.map(pct => (
                                  <option key={pct} value={pct}>{pct}%</option>
                                ))}
                              </select>
                              <ChevronDown style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: '16px',
                                width: '16px',
                                color: '#9CA3AF',
                                pointerEvents: 'none'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#6B7280' }}>Total Allocation:</span>
                          <span style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: Math.abs(totalPercentage - 100) < 0.01 ? '#10B981' : '#EF4444'
                          }}>
                            {totalPercentage.toFixed(1)}%
                          </span>
                        </div>

                        <button
                          onClick={handleCreateBattle}
                          disabled={!isPortfolioValid || !portfolioName.trim()}
                          style={{
                            width: '100%',
                            padding: '12px',
                            color: 'white',
                            fontWeight: '600',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: isPortfolioValid && portfolioName.trim() ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            background: isPortfolioValid && portfolioName.trim() ? 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)' : '#D1D5DB',
                            opacity: isPortfolioValid && portfolioName.trim() ? 1 : 0.5,
                            boxShadow: isPortfolioValid && portfolioName.trim() ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (isPortfolioValid && portfolioName.trim()) {
                              e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isPortfolioValid && portfolioName.trim()) {
                              e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                            }
                          }}
                        >
                          Create Battle
                        </button>

                        {(!isPortfolioValid || !portfolioName.trim()) && portfolio.length > 0 && (
                          <div style={{ fontSize: '12px', textAlign: 'center', color: '#EF4444', marginTop: '8px' }}>
                            {!portfolioName.trim() && <div>• Portfolio name required</div>}
                            {portfolio.length < 7 && <div>• Need at least 7 assets</div>}
                            {portfolio.length > 13 && <div>• Maximum 13 assets</div>}
                            {Math.abs(totalPercentage - 100) >= 0.01 && <div>• Total must equal 100%</div>}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // JOIN GAME SCREEN
  if (screen === 'join') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: colors.background
        }}>
          {/* Header */}
          <div style={{
            color: 'white',
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: '24px',
            background: colors.cardBg
          }}>
            <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', margin: 0, color: colors.textPrimary }}>Join a Battle</h1>
                  <p style={{ fontSize: '14px', color: colors.cyan, margin: 0 }}>JOIN MODE: Enter challenge code and build your portfolio</p>
                </div>
                <button
                  onClick={() => {
                    setPortfolio([]); setPortfolioType(null);
                    setPortfolioName('');
                    setJoinCode('');
                    setScreen('dashboard');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'transparent',
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: '8px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.cyan;
                    e.currentTarget.style.color = colors.cyan;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.borderSubtle;
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  <X style={{ height: '20px', width: '20px' }} />
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1536px', margin: '0 auto', padding: '0 24px' }}>
            {/* Challenge Code Input */}
            <div style={{
              background: colors.cardBg,
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
              padding: '24px',
              marginBottom: '24px',
              border: `1px solid ${colors.border}`
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: colors.textPrimary }}>Challenge Code</h2>
              <input
                type="text"
                placeholder="Enter 6-character code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  border: `2px solid ${joinCode ? colors.cyan : colors.borderSubtle}`,
                  borderRadius: '12px',
                  outline: 'none',
                  textTransform: 'uppercase',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  background: 'rgba(0, 0, 0, 0.2)',
                  color: colors.textPrimary
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              {/* Left: Asset Selection */}
              <div>
                <div style={{
                  background: colors.cardBg,
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  padding: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: colors.textPrimary }}>Available Assets</h2>

                  {loadingMarketData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                      <Loader2 style={{ height: '32px', width: '32px', color: colors.cyan, animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <button
                          onClick={() => setAssetType('stocks')}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'stocks' ? {
                              color: colors.background,
                              background: colors.cyan,
                              boxShadow: `0 0 15px ${colors.cyan}50`
                            } : {
                              color: colors.textSecondary,
                              background: 'rgba(255, 255, 255, 0.1)'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'stocks') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'stocks') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'crypto' ? {
                              color: colors.background,
                              background: colors.cyan,
                              boxShadow: `0 0 15px ${colors.cyan}50`
                            } : {
                              color: colors.textSecondary,
                              background: 'rgba(255, 255, 255, 0.1)'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'crypto') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'crypto') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          Crypto
                        </button>
                      </div>

                      {/* Portfolio Type Indicator */}
                      {portfolioType && (
                        <div style={{
                          padding: '12px 16px',
                          marginBottom: '16px',
                          background: portfolioType === 'stocks' ? `${colors.blue}20` : `${colors.purple}20`,
                          border: `1px solid ${portfolioType === 'stocks' ? colors.blue : colors.purple}`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '20px' }}>
                            {portfolioType === 'stocks' ? '📈' : '₿'}
                          </span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                              {portfolioType === 'stocks' ? 'Stocks Portfolio' : 'Crypto Portfolio'}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                              You can only add {portfolioType === 'stocks' ? 'stocks' : 'crypto'} to this portfolio
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Search */}
                      <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          marginBottom: '16px',
                          border: `1px solid ${searchTerm ? colors.cyan : colors.borderSubtle}`,
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: colors.textPrimary
                        }}
                      />

                      {/* Asset Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        maxHeight: '384px',
                        overflowY: 'auto'
                      }}>
                        {filteredAssets.map(asset => {
                          const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
                          return (
                            <button
                              key={asset.symbol}
                              onClick={() => handleAddAsset(asset)}
                              disabled={inPortfolio || portfolio.length >= 13}
                              style={{
                                padding: '14px',
                                borderRadius: '8px',
                                textAlign: 'left',
                                border: `1px solid ${inPortfolio ? colors.cyan : colors.borderSubtle}`,
                                cursor: inPortfolio || portfolio.length >= 13 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                background: inPortfolio ? `${colors.cyan}15` : 'rgba(0, 217, 255, 0.05)'
                              }}
                              onMouseEnter={(e) => {
                                if (!inPortfolio && portfolio.length < 13) {
                                  e.currentTarget.style.background = `${colors.cyan}20`;
                                  e.currentTarget.style.borderColor = colors.cyan;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!inPortfolio) {
                                  e.currentTarget.style.background = 'rgba(0, 217, 255, 0.05)';
                                  e.currentTarget.style.borderColor = colors.borderSubtle;
                                }
                              }}
                            >
                              <div style={{ fontWeight: 'bold', color: colors.textPrimary, marginBottom: '2px' }}>{asset.symbol}</div>
                              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>{asset.name}</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: colors.cyan }}>${asset.price.toFixed(2)}</div>
                              {inPortfolio && (
                                <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: '600', color: colors.green }}>✓ Added</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Portfolio Summary */}
              <div>
                <div style={{
                  background: colors.cardBg,
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  padding: '24px',
                  position: 'sticky',
                  top: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px', color: colors.textPrimary }}>Your Portfolio</h2>
                  <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '16px' }}>
                    {portfolio.length}/13 assets • {totalPercentage.toFixed(1)}%
                  </p>

                  {/* Progress bar for allocation */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '3px',
                    marginBottom: '16px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(totalPercentage, 100)}%`,
                      height: '100%',
                      background: totalPercentage === 100 ? colors.green : colors.cyan,
                      borderRadius: '3px',
                      transition: 'all 0.3s'
                    }} />
                  </div>

                  {/* Portfolio Name Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px' }}>
                      Portfolio Name <span style={{ color: colors.red }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter portfolio name"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: `1px solid ${portfolioName ? colors.cyan : (!portfolioName && portfolio.length > 0 ? colors.red : colors.borderSubtle)}`,
                        background: !portfolioName && portfolio.length > 0 ? `${colors.red}10` : 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        color: colors.textPrimary,
                        fontSize: '14px'
                      }}
                    />
                    {!portfolioName && portfolio.length > 0 && (
                      <div style={{ fontSize: '11px', color: colors.red, marginTop: '4px' }}>Portfolio name is required</div>
                    )}
                  </div>

                  {portfolio.length === 0 ? (
                    <div style={{ textAlign: 'center', color: colors.textMuted, padding: '48px 0' }}>
                      <Wallet style={{ height: '48px', width: '48px', marginBottom: '12px', opacity: 0.4 }} />
                      <div style={{ fontSize: '14px' }}>No assets selected</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
                        {portfolio.map(asset => (
                          <div key={asset.symbol} style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', marginBottom: '10px', border: `1px solid ${colors.borderSubtle}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#1F2937' }}>{asset.symbol}</div>
                                <div style={{ fontSize: '12px', color: '#6B7280' }}>${asset.price.toFixed(2)}</div>
                              </div>
                              <button
                                onClick={() => handleRemoveAsset(asset.symbol)}
                                style={{
                                  color: '#9CA3AF',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'color 0.2s',
                                  padding: 0
                                }}
                                onMouseEnter={(e) => e.target.style.color = '#EF4444'}
                                onMouseLeave={(e) => e.target.style.color = '#9CA3AF'}
                              >
                                <X style={{ height: '20px', width: '20px' }} />
                              </button>
                            </div>
                            
                            {/* Percentage Dropdown */}
                            <div style={{ position: 'relative' }}>
                              <select
                                value={asset.percentage}
                                onChange={(e) => handlePercentageChange(asset.symbol, parseFloat(e.target.value))}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '2px solid #00BCD4',
                                  borderRadius: '8px',
                                  outline: 'none',
                                  appearance: 'none',
                                  cursor: 'pointer',
                                  background: 'white',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {PERCENTAGE_OPTIONS.map(pct => (
                                  <option key={pct} value={pct}>{pct}%</option>
                                ))}
                              </select>
                              <ChevronDown style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: '16px',
                                width: '16px',
                                color: '#9CA3AF',
                                pointerEvents: 'none'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#6B7280' }}>Total Allocation:</span>
                          <span style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: Math.abs(totalPercentage - 100) < 0.01 ? '#10B981' : '#EF4444'
                          }}>
                            {totalPercentage.toFixed(1)}%
                          </span>
                        </div>

                        <button
                          onClick={handleJoinBattle}
                          disabled={!isPortfolioValid || !portfolioName.trim() || !joinCode.trim()}
                          style={{
                            width: '100%',
                            padding: '12px',
                            color: 'white',
                            fontWeight: '600',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: isPortfolioValid && portfolioName.trim() && joinCode.trim() ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            background: isPortfolioValid && portfolioName.trim() && joinCode.trim() ? 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)' : '#D1D5DB',
                            opacity: isPortfolioValid && portfolioName.trim() && joinCode.trim() ? 1 : 0.5,
                            boxShadow: isPortfolioValid && portfolioName.trim() && joinCode.trim() ? '0 2px 4px rgba(0, 0, 0, 0.1)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (isPortfolioValid && portfolioName.trim() && joinCode.trim()) {
                              e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isPortfolioValid && portfolioName.trim() && joinCode.trim()) {
                              e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                            }
                          }}
                        >
                          Join Battle
                        </button>

                        {(!isPortfolioValid || !portfolioName.trim() || !joinCode.trim()) && portfolio.length > 0 && (
                          <div style={{ fontSize: '12px', textAlign: 'center', color: '#EF4444', marginTop: '8px' }}>
                            {!joinCode.trim() && <div>• Challenge code required</div>}
                            {!portfolioName.trim() && <div>• Portfolio name required</div>}
                            {portfolio.length < 7 && <div>• Need at least 7 assets</div>}
                            {portfolio.length > 13 && <div>• Maximum 13 assets</div>}
                            {Math.abs(totalPercentage - 100) >= 0.01 && <div>• Total must equal 100%</div>}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TRAINING MODE SCREEN
  if (screen === 'training') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: colors.background
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: '24px',
            background: colors.cardBg
          }}>
            <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: colors.textPrimary }}>
                    <GraduationCap style={{ height: '24px', width: '24px', color: colors.purple }} />
                    Training Mode
                  </h1>
                  <p style={{ fontSize: '14px', color: colors.purple, margin: 0 }}>Practice against CPU • 1 Hour Duration • Reduced XP</p>
                </div>
                <button
                  onClick={() => {
                    setPortfolio([]); setPortfolioType(null);
                    setPortfolioName('');
                    setScreen('dashboard');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'transparent',
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: '8px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.purple;
                    e.currentTarget.style.color = colors.purple;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.borderSubtle;
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  <X style={{ height: '20px', width: '20px' }} />
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1536px', margin: '0 auto', padding: '0 24px' }}>
            {/* Training Info Box */}
            <div style={{
              background: colors.cardBg,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              border: `1px solid ${colors.purple}`,
              boxShadow: `0 0 20px ${colors.purple}20`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <Bot style={{ height: '32px', width: '32px', color: colors.purple, flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary, marginBottom: '8px', marginTop: 0 }}>
                    How Training Mode Works
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: colors.textSecondary, lineHeight: '1.6' }}>
                    <li>Battle against a randomly-generated CPU opponent</li>
                    <li>Battles last <strong style={{ color: colors.textPrimary }}>1 hour</strong> (vs 24 hours for real battles)</li>
                    <li>Win: <strong style={{ color: colors.green }}>+10 XP</strong> • Lose: <strong style={{ color: colors.cyan }}>+5 XP</strong> (reduced rewards)</li>
                    <li><strong style={{ color: colors.textPrimary }}>Does NOT affect your Win/Loss record</strong></li>
                    <li>Perfect for learning and experimenting risk-free!</li>
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              {/* Left: Asset Selection */}
              <div>
                <div style={{
                  background: colors.cardBg,
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  padding: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: colors.textPrimary }}>Available Assets</h2>

                  {loadingMarketData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                      <Loader2 style={{ height: '32px', width: '32px', color: colors.purple, animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <button
                          onClick={() => setAssetType('stocks')}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'stocks' ? {
                              color: 'white',
                              background: colors.purple,
                              boxShadow: `0 0 15px ${colors.purple}50`
                            } : {
                              color: colors.textSecondary,
                              background: 'rgba(255, 255, 255, 0.1)'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'stocks') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'stocks') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'crypto' ? {
                              color: 'white',
                              background: colors.purple,
                              boxShadow: `0 0 15px ${colors.purple}50`
                            } : {
                              color: colors.textSecondary,
                              background: 'rgba(255, 255, 255, 0.1)'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'crypto') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'crypto') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }}
                        >
                          Crypto
                        </button>
                      </div>

                      {/* Portfolio Type Indicator */}
                      {portfolioType && (
                        <div style={{
                          padding: '12px 16px',
                          marginBottom: '16px',
                          background: portfolioType === 'stocks' ? '#DBEAFE' : '#FCE7F3',
                          border: `2px solid ${portfolioType === 'stocks' ? '#3B82F6' : '#EC4899'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ fontSize: '20px' }}>
                            {portfolioType === 'stocks' ? '📈' : '₿'}
                          </span>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>
                              {portfolioType === 'stocks' ? 'Stocks Portfolio' : 'Crypto Portfolio'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              You can only add {portfolioType === 'stocks' ? 'stocks' : 'crypto'} to this portfolio
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Search */}
                      <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          marginBottom: '16px',
                          border: '2px solid',
                          borderColor: searchTerm ? '#9333EA' : '#E5E7EB',
                          borderRadius: '12px',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* Asset Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        maxHeight: '384px',
                        overflowY: 'auto'
                      }}>
                        {filteredAssets.map(asset => {
                          const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
                          return (
                            <button
                              key={asset.symbol}
                              onClick={() => handleAddAsset(asset)}
                              disabled={inPortfolio || portfolio.length >= 13}
                              style={{
                                padding: '16px',
                                borderRadius: '12px',
                                textAlign: 'left',
                                border: inPortfolio ? 'none' : '2px solid transparent',
                                cursor: inPortfolio || portfolio.length >= 13 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                background: inPortfolio ? '#F3F4F6' : '#F9FAFB'
                              }}
                              onMouseEnter={(e) => {
                                if (!inPortfolio && portfolio.length < 13) {
                                  e.target.style.background = '#EDE9FE';
                                  e.target.style.borderColor = '#DDD6FE';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!inPortfolio) {
                                  e.target.style.background = '#F9FAFB';
                                  e.target.style.borderColor = 'transparent';
                                }
                              }}
                            >
                              <div style={{ fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>{asset.symbol}</div>
                              <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>{asset.name}</div>
                              <div style={{ fontSize: '18px', fontWeight: '600', color: '#4B5563' }}>${asset.price.toFixed(2)}</div>
                              {inPortfolio && (
                                <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '600', color: '#10B981' }}>✓ Added</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Portfolio Summary - Same as builder/join screens */}
              <div>
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '24px',
                  position: 'sticky',
                  top: '24px'
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#1F2937' }}>Your Portfolio</h2>
                  <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px' }}>
                    {portfolio.length}/13 assets • {totalPercentage.toFixed(1)}%
                  </p>

                  {/* Portfolio Name Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#4B5563', marginBottom: '8px' }}>
                      Portfolio Name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter portfolio name"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '2px solid',
                        borderColor: portfolioName ? '#9333EA' : (!portfolioName && portfolio.length > 0 ? '#EF4444' : '#E5E7EB'),
                        background: !portfolioName && portfolio.length > 0 ? '#FEE2E2' : 'white',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box'
                      }}
                    />
                    {!portfolioName && portfolio.length > 0 && (
                      <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>Portfolio name is required</div>
                    )}
                  </div>

                  {portfolio.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '48px 0' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>📊</div>
                      <div>No assets selected</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
                        {portfolio.map(asset => (
                          <div key={asset.symbol} style={{ padding: '12px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', color: '#1F2937' }}>{asset.symbol}</div>
                                <div style={{ fontSize: '12px', color: '#6B7280' }}>${asset.price.toFixed(2)}</div>
                              </div>
                              <button
                                onClick={() => handleRemoveAsset(asset.symbol)}
                                style={{
                                  color: '#9CA3AF',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'color 0.2s',
                                  padding: 0
                                }}
                                onMouseEnter={(e) => e.target.style.color = '#EF4444'}
                                onMouseLeave={(e) => e.target.style.color = '#9CA3AF'}
                              >
                                <X style={{ height: '20px', width: '20px' }} />
                              </button>
                            </div>
                            
                            {/* Percentage Dropdown */}
                            <div style={{ position: 'relative' }}>
                              <select
                                value={asset.percentage}
                                onChange={(e) => handlePercentageChange(asset.symbol, parseFloat(e.target.value))}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '2px solid #9333EA',
                                  borderRadius: '8px',
                                  outline: 'none',
                                  appearance: 'none',
                                  cursor: 'pointer',
                                  background: 'white',
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#1F2937',
                                  paddingRight: '32px'
                                }}
                              >
                                {PERCENTAGE_OPTIONS.map(option => (
                                  <option key={option} value={option}>
                                    {option}%
                                  </option>
                                ))}
                              </select>
                              <ChevronDown style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                height: '16px',
                                width: '16px',
                                color: '#9333EA',
                                pointerEvents: 'none'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Button */}
                      <div>
                        <button
                          onClick={handleCreateTrainingBattle}
                          disabled={!isPortfolioValid || !portfolioName.trim()}
                          style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            border: 'none',
                            fontWeight: '600',
                            fontSize: '16px',
                            cursor: isPortfolioValid && portfolioName.trim() ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            background: isPortfolioValid && portfolioName.trim()
                              ? 'linear-gradient(135deg, #9333EA 0%, #7C3AED 100%)'
                              : '#D1D5DB',
                            color: 'white',
                            boxShadow: isPortfolioValid && portfolioName.trim() ? '0 4px 6px -1px rgba(147, 51, 234, 0.3)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            if (isPortfolioValid && portfolioName.trim()) {
                              e.target.style.transform = 'scale(1.02)';
                              e.target.style.boxShadow = '0 10px 15px -3px rgba(147, 51, 234, 0.4)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = isPortfolioValid && portfolioName.trim() ? '0 4px 6px -1px rgba(147, 51, 234, 0.3)' : 'none';
                          }}
                        >
                          <GraduationCap style={{ height: '20px', width: '20px' }} />
                          Start Training Battle
                        </button>

                        {/* Validation Messages */}
                        {!isPortfolioValid && portfolio.length > 0 && (
                          <div style={{ marginTop: '12px', fontSize: '13px', color: '#EF4444' }}>
                            {portfolio.length < 7 && <div>• Need at least 7 assets</div>}
                            {portfolio.length > 13 && <div>• Maximum 13 assets</div>}
                            {Math.abs(totalPercentage - 100) >= 0.01 && <div>• Total must equal 100%</div>}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // BATTLE VIEW SCREEN
  if (screen === 'battle' && currentBattle) {
    const isCreator = currentBattle.creator === user.username;
    const opponent = isCreator ? currentBattle.opponent : currentBattle.creator;
    const myPortfolio = isCreator ? currentBattle.creatorPortfolio : currentBattle.opponentPortfolio;
    const theirPortfolio = isCreator ? currentBattle.opponentPortfolio : currentBattle.creatorPortfolio;

    // Calculate current values and gains
    let myValue = 0;
    myPortfolio.forEach(asset => {
      const shares = asset.amount / asset.price;
      const currentPrice = battlePrices[asset.symbol] || asset.price;
      myValue += shares * currentPrice;
    });

    let theirValue = 0;
    theirPortfolio.forEach(asset => {
      const shares = asset.amount / asset.price;
      const currentPrice = battlePrices[asset.symbol] || asset.price;
      theirValue += shares * currentPrice;
    });

    const myGain = ((myValue - 1000000) / 1000000) * 100;
    const theirGain = ((theirValue - 1000000) / 1000000) * 100;
    const isWinning = myGain > theirGain;
    const difference = Math.abs(myGain - theirGain);
    const valueDifference = Math.abs(myValue - theirValue);

    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: colors.background
        }}>
          {/* BATTLE HEADER - Large Timer */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              padding: '24px',
              textAlign: 'center',
              borderBottom: `1px solid #30363d`
            }}
          >
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: colors.cardBg,
                    border: `1px solid #30363d`,
                    borderRadius: '8px',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.cyan;
                    e.currentTarget.style.color = colors.cyan;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#30363d';
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  ← Back to Dashboard
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '3px',
                    marginBottom: '8px',
                    fontWeight: '600'
                  }}>
                    BATTLE ENDS
                  </div>
                  <motion.div
                    animate={{
                      textShadow: [
                        '0 0 20px rgba(0, 217, 255, 0.4)',
                        '0 0 40px rgba(0, 217, 255, 0.6)',
                        '0 0 20px rgba(0, 217, 255, 0.4)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      fontSize: '52px',
                      fontWeight: 'bold',
                      fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
                      color: colors.cyan,
                      letterSpacing: '4px'
                    }}
                  >
                    {battleTimer.formatTimeRemaining(currentBattle)}
                  </motion.div>
                </div>

                <div style={{ width: '160px' }}></div>
              </div>
            </div>
          </motion.div>

          <div style={{ maxWidth: '1536px', margin: '0 auto', padding: '0 24px' }}>
            {/* Training Battle Indicator */}
            {currentBattle.isTrainingBattle && (
              <div style={{
                background: `linear-gradient(135deg, ${colors.purple} 0%, #7C3AED 100%)`,
                color: 'white',
                padding: '12px 20px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: '600',
                fontSize: '14px',
                boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)'
              }}>
                <GraduationCap style={{ height: '18px', width: '18px' }} />
                Training Battle • 1 Hour Duration • Reduced XP
              </div>
            )}

            {/* PLAYER COMPARISON SECTION */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{
                background: colors.cardBg,
                borderRadius: '16px',
                overflow: 'hidden',
                marginBottom: '24px',
                border: `1px solid #30363d`
              }}
            >
              <div style={{ padding: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* YOU Section */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      fontSize: '11px',
                      color: colors.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      marginBottom: '12px'
                    }}>
                      YOU <span style={{ color: colors.textSecondary }}>({user.username})</span>
                    </div>
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                        background: `linear-gradient(135deg, ${colors.cyan}20 0%, ${colors.green}20 100%)`,
                        border: `3px solid ${myGain >= 0 ? colors.green : colors.red}`,
                        boxShadow: `0 0 20px ${myGain >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}
                    >
                      <User style={{ height: '32px', width: '32px', color: myGain >= 0 ? colors.green : colors.red }} />
                    </motion.div>
                    <div style={{
                      fontSize: '42px',
                      fontWeight: 'bold',
                      color: myGain >= 0 ? colors.green : colors.red,
                      marginBottom: '4px'
                    }}>
                      {myGain >= 0 ? '+' : ''}{myGain.toFixed(1)}%
                    </div>
                    <div style={{
                      fontSize: '18px',
                      color: colors.textSecondary,
                      fontWeight: '500'
                    }}>
                      ${myValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  {/* CENTER - Progress Bar & Status */}
                  <div style={{ flex: 1.5, padding: '0 40px' }}>
                    {/* Progress Bar */}
                    <div style={{
                      position: 'relative',
                      height: '16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      marginBottom: '16px',
                      border: '1px solid #30363d'
                    }}>
                      <motion.div
                        initial={{ width: '50%' }}
                        animate={{ width: `${Math.max(10, Math.min(90, (myValue / (myValue + theirValue)) * 100))}%` }}
                        transition={{ duration: 0.5 }}
                        style={{
                          position: 'absolute',
                          height: '100%',
                          borderRadius: '8px',
                          background: isWinning
                            ? `linear-gradient(90deg, ${colors.green} 0%, ${colors.greenBright} 100%)`
                            : `linear-gradient(90deg, ${colors.red} 0%, ${colors.redBright} 100%)`,
                          boxShadow: isWinning
                            ? '0 0 10px rgba(16, 185, 129, 0.5)'
                            : '0 0 10px rgba(239, 68, 68, 0.5)'
                        }}
                      />
                    </div>

                    {/* Status Text */}
                    <div style={{
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: isWinning ? colors.green : colors.red,
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}>
                      {isWinning ? 'LEADING' : 'TRAILING'} BY +{difference.toFixed(1)}% (${valueDifference.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                    </div>
                  </div>

                  {/* OPPONENT Section */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      fontSize: '11px',
                      color: colors.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      marginBottom: '12px'
                    }}>
                      OPPONENT <span style={{ color: colors.textSecondary }}>({opponent})</span>
                    </div>
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                        background: `linear-gradient(135deg, ${colors.red}20 0%, ${colors.redBright}20 100%)`,
                        border: `3px solid ${theirGain >= 0 ? colors.green : colors.red}`,
                        boxShadow: `0 0 20px ${theirGain >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}
                    >
                      <Skull style={{ height: '32px', width: '32px', color: theirGain >= 0 ? colors.green : colors.red }} />
                    </motion.div>
                    <div style={{
                      fontSize: '42px',
                      fontWeight: 'bold',
                      color: theirGain >= 0 ? colors.green : colors.red,
                      marginBottom: '4px'
                    }}>
                      {theirGain >= 0 ? '+' : ''}{theirGain.toFixed(1)}%
                    </div>
                    <div style={{
                      fontSize: '18px',
                      color: colors.textSecondary,
                      fontWeight: '500'
                    }}>
                      ${theirValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CHALLENGE TABS - Keep existing functionality but style updated */}
            <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {/* User Challenge Tabs */}
              {userChallenges.doubleDown && userChallenges.doubleDown.status === 'active' && (
                <button
                  onClick={() => toggleChallengePanel('user-double')}
                  style={{
                    background: openChallengePanels.has('user-double')
                      ? `linear-gradient(135deg, ${colors.gold} 0%, #FF8F00 100%)`
                      : colors.cardBg,
                    color: openChallengePanels.has('user-double') ? '#0d1117' : colors.gold,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: `1px solid ${colors.gold}`,
                    transition: 'all 0.2s'
                  }}
                >
                  Your Double Down
                </button>
              )}
              {userChallenges.marketClose && userChallenges.marketClose.status === 'active' && (
                <button
                  onClick={() => toggleChallengePanel('user-market')}
                  style={{
                    background: openChallengePanels.has('user-market')
                      ? `linear-gradient(135deg, ${colors.gold} 0%, #FF8F00 100%)`
                      : colors.cardBg,
                    color: openChallengePanels.has('user-market') ? '#0d1117' : colors.gold,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: `1px solid ${colors.gold}`,
                    transition: 'all 0.2s'
                  }}
                >
                  Your Market Close
                </button>
              )}
              {opponentChallenges.doubleDown && opponentChallenges.doubleDown.status === 'active' && (
                <button
                  onClick={() => toggleChallengePanel('opp-double')}
                  style={{
                    background: openChallengePanels.has('opp-double')
                      ? `linear-gradient(135deg, ${colors.gold} 0%, #FF8F00 100%)`
                      : colors.cardBg,
                    color: openChallengePanels.has('opp-double') ? '#0d1117' : colors.gold,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: `1px solid ${colors.gold}`,
                    transition: 'all 0.2s'
                  }}
                >
                  Opponent's Double Down
                </button>
              )}
              {opponentChallenges.marketClose && opponentChallenges.marketClose.status === 'active' && (
                <button
                  onClick={() => toggleChallengePanel('opp-market')}
                  style={{
                    background: openChallengePanels.has('opp-market')
                      ? `linear-gradient(135deg, ${colors.gold} 0%, #FF8F00 100%)`
                      : colors.cardBg,
                    color: openChallengePanels.has('opp-market') ? '#0d1117' : colors.gold,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    border: `1px solid ${colors.gold}`,
                    transition: 'all 0.2s'
                  }}
                >
                  Opponent's Market Close
                </button>
              )}
            </div>

            {/* Challenge Panels - These appear BELOW the battle score box */}

            {/* User's Double Down Challenge Panel - Only show ACTIVE challenges */}
            {userChallenges.doubleDown && userChallenges.doubleDown.status === 'active' && openChallengePanels.has('user-double') && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: `2px solid ${colors.gold}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${colors.borderSubtle}`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>
                    Your Double Down Challenge
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: userChallenges.doubleDown.status === 'active' ? `${colors.gold}30` :
                               userChallenges.doubleDown.status === 'won' ? `${colors.green}30` :
                               userChallenges.doubleDown.status === 'lost' ? `${colors.red}30` : 'rgba(255,255,255,0.1)',
                    color: userChallenges.doubleDown.status === 'active' ? colors.gold :
                          userChallenges.doubleDown.status === 'won' ? colors.green :
                          userChallenges.doubleDown.status === 'lost' ? colors.red : colors.textMuted
                  }}>
                    {userChallenges.doubleDown.status.toUpperCase()}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Asset:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      {userChallenges.doubleDown.asset.name} ({userChallenges.doubleDown.asset.symbol})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Effect:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      2x gains/losses for 2 hours
                    </span>
                  </div>
                  {userChallenges.doubleDown.startingPrice && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                        <span style={{ fontSize: '14px', color: colors.textSecondary }}>Starting Price:</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                          ${userChallenges.doubleDown.startingPrice.toFixed(2)}
                        </span>
                      </div>
                      {battlePrices[userChallenges.doubleDown.asset.symbol] && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                            <span style={{ fontSize: '14px', color: colors.textSecondary }}>Current Price:</span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                              ${battlePrices[userChallenges.doubleDown.asset.symbol].toFixed(2)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                            <span style={{ fontSize: '14px', color: colors.textSecondary }}>Current Effect:</span>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: battlePrices[userChallenges.doubleDown.asset.symbol] >= userChallenges.doubleDown.startingPrice ? colors.green : colors.red
                            }}>
                              {((battlePrices[userChallenges.doubleDown.asset.symbol] - userChallenges.doubleDown.startingPrice) / userChallenges.doubleDown.startingPrice * 200).toFixed(2)}%
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {userChallenges.doubleDown.status === 'active' && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px',
                      background: `${colors.cyan}20`,
                      borderRadius: '6px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: colors.cyan,
                      fontWeight: '600'
                    }}>
                      {challengeService.formatTimeRemaining(challengeService.getChallengeTimeRemaining(userChallenges.doubleDown))} remaining
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User's Market Close Challenge Panel - Only show ACTIVE challenges */}
            {userChallenges.marketClose && userChallenges.marketClose.status === 'active' && openChallengePanels.has('user-market') && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: `2px solid ${colors.gold}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${colors.borderSubtle}`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>
                    Your Market Close Challenge
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: userChallenges.marketClose.status === 'active' ? `${colors.gold}30` :
                               userChallenges.marketClose.status === 'won' ? `${colors.green}30` :
                               userChallenges.marketClose.status === 'lost' ? `${colors.red}30` : 'rgba(255,255,255,0.1)',
                    color: userChallenges.marketClose.status === 'active' ? colors.gold :
                          userChallenges.marketClose.status === 'won' ? colors.green :
                          userChallenges.marketClose.status === 'lost' ? colors.red : colors.textMuted
                  }}>
                    {userChallenges.marketClose.status.toUpperCase()}
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Market:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      {userChallenges.marketClose.market}
                    </span>
                  </div>
                  {userChallenges.marketClose.prediction && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <span style={{ fontSize: '14px', color: colors.textSecondary }}>Your Prediction:</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: userChallenges.marketClose.prediction === 'up' ? colors.green : colors.red
                      }}>
                        {userChallenges.marketClose.prediction.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {userChallenges.marketClose.baselinePrice && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <span style={{ fontSize: '14px', color: colors.textSecondary }}>Baseline Price:</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                        ${userChallenges.marketClose.baselinePrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Risk/Reward:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      +{userChallenges.marketClose.reward}% / -{userChallenges.marketClose.penalty}%
                    </span>
                  </div>
                  {userChallenges.marketClose.status === 'active' && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px',
                      background: `${colors.cyan}20`,
                      borderRadius: '6px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: colors.cyan,
                      fontWeight: '600'
                    }}>
                      {challengeService.formatTimeRemaining(challengeService.getChallengeTimeRemaining(userChallenges.marketClose))} until market close
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Opponent's Double Down Challenge Panel - Only show ACTIVE challenges */}
            {opponentChallenges.doubleDown && opponentChallenges.doubleDown.status === 'active' && openChallengePanels.has('opp-double') && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: `2px solid ${colors.gold}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${colors.borderSubtle}`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>
                    Opponent's Double Down Challenge
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: `${colors.gold}30`,
                    color: colors.gold
                  }}>
                    ACTIVE
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Asset:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      {opponentChallenges.doubleDown.asset.name} ({opponentChallenges.doubleDown.asset.symbol})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Effect:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      2x gains/losses for 2 hours
                    </span>
                  </div>
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    background: `${colors.cyan}20`,
                    borderRadius: '6px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: colors.cyan,
                    fontWeight: '600'
                  }}>
                    {challengeService.formatTimeRemaining(challengeService.getChallengeTimeRemaining(opponentChallenges.doubleDown))} remaining
                  </div>
                </div>
              </div>
            )}

            {/* Opponent's Market Close Challenge Panel - Only show ACTIVE challenges */}
            {opponentChallenges.marketClose && opponentChallenges.marketClose.status === 'active' && openChallengePanels.has('opp-market') && (
              <div style={{
                background: colors.cardBg,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: `2px solid ${colors.gold}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${colors.borderSubtle}`
                }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>
                    Opponent's Market Close Challenge
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: `${colors.gold}30`,
                    color: colors.gold
                  }}>
                    ACTIVE
                  </div>
                </div>
                <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>Market:</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>
                      {opponentChallenges.marketClose.market}
                    </span>
                  </div>
                  {opponentChallenges.marketClose.prediction && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${colors.borderSubtle}` }}>
                      <span style={{ fontSize: '14px', color: colors.textSecondary }}>Their Prediction:</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: opponentChallenges.marketClose.prediction === 'up' ? colors.green : colors.red
                      }}>
                        {opponentChallenges.marketClose.prediction.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {userChallenges.marketClose && opponentChallenges.marketClose.prediction !== userChallenges.marketClose.prediction && (
                    <div style={{ padding: '12px', background: `${colors.red}20`, borderRadius: '8px', marginTop: '12px', textAlign: 'center' }}>
                      <strong style={{ color: colors.red }}>Opposite prediction!</strong><br />
                      <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                        They predicted {opponentChallenges.marketClose.prediction.toUpperCase()}, you predicted {userChallenges.marketClose.prediction.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    background: `${colors.cyan}20`,
                    borderRadius: '6px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: colors.cyan,
                    fontWeight: '600'
                  }}>
                    {challengeService.formatTimeRemaining(challengeService.getChallengeTimeRemaining(opponentChallenges.marketClose))} until market close
                  </div>
                </div>
              </div>
            )}

            {/* PORTFOLIO TABLES - Side by Side */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '24px'
              }}
            >
              {/* YOUR PORTFOLIO TABLE */}
              <div style={{
                background: colors.cardBg,
                borderRadius: '16px',
                overflow: 'hidden',
                border: `1px solid #30363d`
              }}>
                {/* Table Header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid #30363d`,
                  background: 'rgba(0, 217, 255, 0.05)'
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: colors.cyan,
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>
                    YOUR PORTFOLIO
                  </div>
                </div>

                {/* Column Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
                  gap: '8px',
                  padding: '12px 20px',
                  borderBottom: `1px solid #30363d`,
                  fontSize: '10px',
                  fontWeight: '600',
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  <div>ASSET</div>
                  <div style={{ textAlign: 'center' }}>PERFORMANCE</div>
                  <div style={{ textAlign: 'right' }}>PRICE</div>
                  <div style={{ textAlign: 'right' }}>WT</div>
                </div>

                {/* Portfolio Items */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {myPortfolio.map((asset, idx) => {
                    const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
                    const currentPrice = battlePrices[asset.symbol] || startingPrice;
                    const returnPct = ((currentPrice - startingPrice) / startingPrice) * 100;
                    const weight = (asset.amount / 1000000) * 100;
                    const isPositive = returnPct >= 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
                          gap: '8px',
                          padding: '16px 20px',
                          borderBottom: `1px solid #30363d`,
                          alignItems: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 217, 255, 0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Asset Info */}
                        <div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: colors.textPrimary,
                            marginBottom: '2px'
                          }}>
                            {asset.symbol}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: colors.textMuted
                          }}>
                            WT: {weight.toFixed(0)}%
                          </div>
                        </div>

                        {/* Sparkline + Performance */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <MiniSparkline isPositive={isPositive} width={60} height={20} />
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: isPositive ? colors.green : colors.red
                          }}>
                            {isPositive ? '+' : ''}{returnPct.toFixed(1)}%
                          </div>
                        </div>

                        {/* Price Info */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: colors.textPrimary,
                            marginBottom: '2px'
                          }}>
                            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: colors.textMuted
                          }}>
                            Start: ${startingPrice.toFixed(2)}
                          </div>
                        </div>

                        {/* Weight Badge */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: `${colors.cyan}15`,
                            color: colors.cyan,
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {weight.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* OPPONENT'S PORTFOLIO TABLE */}
              <div style={{
                background: colors.cardBg,
                borderRadius: '16px',
                overflow: 'hidden',
                border: `1px solid #30363d`
              }}>
                {/* Table Header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid #30363d`,
                  background: 'rgba(239, 68, 68, 0.05)'
                }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: colors.red,
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>
                    OPPONENT'S PORTFOLIO
                  </div>
                </div>

                {/* Column Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
                  gap: '8px',
                  padding: '12px 20px',
                  borderBottom: `1px solid #30363d`,
                  fontSize: '10px',
                  fontWeight: '600',
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  <div>ASSET</div>
                  <div style={{ textAlign: 'center' }}>PERFORMANCE</div>
                  <div style={{ textAlign: 'right' }}>PRICE</div>
                  <div style={{ textAlign: 'right' }}>WT</div>
                </div>

                {/* Portfolio Items */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {theirPortfolio.map((asset, idx) => {
                    const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
                    const currentPrice = battlePrices[asset.symbol] || startingPrice;
                    const returnPct = ((currentPrice - startingPrice) / startingPrice) * 100;
                    const weight = (asset.amount / 1000000) * 100;
                    const isPositive = returnPct >= 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr',
                          gap: '8px',
                          padding: '16px 20px',
                          borderBottom: `1px solid #30363d`,
                          alignItems: 'center',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Asset Info */}
                        <div>
                          <div style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: colors.textPrimary,
                            marginBottom: '2px'
                          }}>
                            {asset.symbol}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: colors.textMuted
                          }}>
                            WT: {weight.toFixed(0)}%
                          </div>
                        </div>

                        {/* Sparkline + Performance */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <MiniSparkline isPositive={isPositive} width={60} height={20} />
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: isPositive ? colors.green : colors.red
                          }}>
                            {isPositive ? '+' : ''}{returnPct.toFixed(1)}%
                          </div>
                        </div>

                        {/* Price Info */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: colors.textPrimary,
                            marginBottom: '2px'
                          }}>
                            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: colors.textMuted
                          }}>
                            Start: ${startingPrice.toFixed(2)}
                          </div>
                        </div>

                        {/* Weight Badge */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: `${colors.red}15`,
                            color: colors.red,
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {weight.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // PREVIOUS BATTLES SCREEN
  if (screen === 'previousBattles') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: colors.background
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
            marginBottom: '24px',
            background: colors.cardBg
          }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: colors.textSecondary,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.cyan;
                    e.currentTarget.style.color = colors.cyan;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.borderSubtle;
                    e.currentTarget.style.color = colors.textSecondary;
                  }}
                >
                  <ChevronDown style={{ height: '20px', width: '20px', transform: 'rotate(90deg)' }} />
                </button>
                <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0, color: colors.textPrimary }}>Previous Battles</h1>
              </div>
              <p style={{ color: colors.textSecondary, margin: 0 }}>Review your battle history</p>
            </div>
          </div>

          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            {previousBattles.length === 0 ? (
              <div style={{
                background: colors.cardBg,
                borderRadius: '12px',
                padding: '48px',
                textAlign: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                border: `1px solid ${colors.border}`
              }}>
                <Trophy style={{ height: '64px', width: '64px', color: colors.textMuted, margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: colors.textPrimary, marginBottom: '8px' }}>
                  No Previous Battles
                </h3>
                <p style={{ color: colors.textSecondary }}>
                  Complete some battles to see your history here!
                </p>
              </div>
            ) : selectedPreviousBattle ? (
              // Show selected battle details
              <div>
                <button
                  onClick={() => setSelectedPreviousBattle(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.cyan,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.borderColor = colors.cyan;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <ChevronDown style={{ height: '16px', width: '16px', transform: 'rotate(90deg)' }} />
                  Back to List
                </button>

                {/* View Matchup Button */}
                <button
                  onClick={() => {
                    setCurrentBattle(selectedPreviousBattle);
                    setScreen('battle');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: colors.cyan,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '16px 24px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: colors.background,
                    width: '100%',
                    boxShadow: `0 0 20px ${colors.cyan}40`,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 30px ${colors.cyan}60`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 20px ${colors.cyan}40`;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Eye style={{ height: '20px', width: '20px' }} />
                  View Matchup
                </button>

                {/* Full battle details (same as completed battles card but without X button) */}
                {(() => {
                  const battle = selectedPreviousBattle;
                  const result = battle.result;
                  if (!result) return null;
                  
                  const won = result.winner === user.username;
                  const userReturn = battle.creator === user.username 
                    ? result.creatorReturn 
                    : result.opponentReturn;
                  const opponentReturn = battle.creator === user.username 
                    ? result.opponentReturn 
                    : result.creatorReturn;
                  const opponent = battle.creator === user.username 
                    ? battle.opponent 
                    : battle.creator;
                  const xpEarned = result.xpAwarded[user.username] || 0;
                  
                  return (
                    <div style={{
                      backgroundColor: colors.cardBg,
                      borderRadius: '12px',
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                      border: `2px solid ${won ? colors.green : colors.red}`
                    }}>
                      {/* Winner Announcement */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '20px'
                      }}>
                        <span style={{ fontSize: '32px' }}>
                          {won ? '🏆' : '💔'}
                        </span>
                        <span style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: won ? colors.green : colors.red
                        }}>
                          {won ? 'Victory!' : 'Defeat'}
                        </span>
                      </div>
                      
                      {/* Opponent */}
                      <div style={{ marginBottom: '16px', fontSize: '16px', color: colors.textSecondary }}>
                        vs. <span style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '18px' }}>{opponent}</span>
                      </div>

                      {/* Portfolio Name */}
                      <div style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        marginBottom: '20px',
                        fontStyle: 'italic'
                      }}>
                        "{battle.portfolioName || 'Unnamed Portfolio'}"
                      </div>

                      {/* Returns */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                        marginBottom: '20px'
                      }}>
                        <div style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          padding: '16px',
                          borderRadius: '8px',
                          border: `1px solid ${userReturn >= 0 ? colors.green : colors.red}`
                        }}>
                          <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                            Your Return
                          </div>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: 'bold',
                            color: userReturn >= 0 ? colors.green : colors.red
                          }}>
                            {userReturn >= 0 ? '+' : ''}{userReturn}%
                          </div>
                        </div>

                        <div style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          padding: '16px',
                          borderRadius: '8px',
                          border: `1px solid ${opponentReturn >= 0 ? colors.green : colors.red}`
                        }}>
                          <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                            Their Return
                          </div>
                          <div style={{
                            fontSize: '28px',
                            fontWeight: 'bold',
                            color: opponentReturn >= 0 ? colors.green : colors.red
                          }}>
                            {opponentReturn >= 0 ? '+' : ''}{opponentReturn}%
                          </div>
                        </div>
                      </div>

                      {/* Margin */}
                      <div style={{
                        backgroundColor: `${won ? colors.green : colors.red}20`,
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '16px',
                        color: won ? colors.green : colors.red,
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        Victory Margin: {result.margin}%
                      </div>

                      {/* XP Earned */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '16px',
                        background: battle.isTrainingBattle
                          ? `${colors.purple}20`
                          : `${colors.cyan}20`,
                        borderRadius: '8px',
                        marginBottom: '12px'
                      }}>
                        <span style={{ fontSize: '24px' }}>⭐</span>
                        <span style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: battle.isTrainingBattle ? colors.purple : colors.cyan
                        }}>
                          +{xpEarned} XP Earned
                        </span>
                      </div>

                      {/* Completed Time */}
                      <div style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        color: colors.textMuted,
                        marginTop: '12px'
                      }}>
                        Completed {battleTimer.formatDate(battle.completedAt || battle.archivedAt)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Show list of previous battles
              <div>
                {previousBattles.map(battle => {
                  const result = battle.result;
                  if (!result) return null;

                  const won = result.winner === user.username;

                  return (
                    <button
                      key={battle.id}
                      onClick={() => setSelectedPreviousBattle(battle)}
                      style={{
                        width: '100%',
                        background: colors.cardBg,
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '12px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        border: `1px solid ${won ? colors.green : colors.red}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 0 20px ${won ? colors.green : colors.red}30`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: colors.textPrimary
                        }}>
                          "{battle.portfolioName || 'Unnamed Portfolio'}"
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: won ? colors.green : colors.red
                        }}>
                          {won ? '🏆 Victory' : '💔 Defeat'}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '8px' }}>
                        {battleTimer.formatDate(battle.completedAt || battle.archivedAt)}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.cyan, fontWeight: '600' }}>
                        Click to view details →
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ChallengeModal />
      {null}
    </>
  );
}