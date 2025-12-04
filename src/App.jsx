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
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;

    console.log(`🔍 Fetching crypto price for ${cryptoId} (direct)...`);
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data[cryptoId]) {
        console.log(`✅ Got price for ${cryptoId}: $${data[cryptoId].usd} (direct)`);
        return {
          id: cryptoId,
          price: data[cryptoId].usd || 0,
          change24h: data[cryptoId].usd_24h_change || 0,
          marketCap: data[cryptoId].usd_market_cap || 0,
          volume24h: data[cryptoId].usd_24h_vol || 0
        };
      }
    }
  } catch (error) {
    console.log(`⚠️ Direct API failed for ${cryptoId}, trying proxy...`);
  }

  // Try 2: CORS proxy
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
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
    return {
      id: cryptoId,
      price: data[cryptoId].usd || 0,
      change24h: data[cryptoId].usd_24h_change || 0,
      marketCap: data[cryptoId].usd_market_cap || 0,
      volume24h: data[cryptoId].usd_24h_vol || 0
    };
  } catch (error) {
    console.warn(`⚠️ All API attempts failed for ${cryptoId}, using fallback ($${FALLBACK_CRYPTO_PRICES[cryptoId]}):`, error.message);
    return { id: cryptoId, price: FALLBACK_CRYPTO_PRICES[cryptoId] || 100, change24h: 0, marketCap: 0, volume24h: 0 };
  }
}

// Helper function to calculate volatility from price array
function calculateVolatility(prices) {
  if (!prices || prices.length < 2) return 'low';
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const returnVal = (prices[i] - prices[i-1]) / prices[i-1];
    returns.push(returnVal);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance) * 100;
  if (stdDev < 2) return 'low';
  if (stdDev < 5) return 'medium';
  return 'high';
}

// Helper function to generate simulated historical prices
function generateHistoricalPrices(basePrice, days = 7) {
  const prices = [];
  for (let i = days - 1; i >= 0; i--) {
    const variation = (Math.random() - 0.5) * 0.06; // ±3%
    prices.push(basePrice * (1 + variation));
  }
  return prices;
}

async function getPopularStocks() {
  try {
    const stocksWithPrices = await Promise.all(
      POPULAR_STOCKS.map(async (stock) => {
        const priceData = await getStockPrice(stock.symbol);
        const historicalPrices = generateHistoricalPrices(priceData.price);
        const volatility = calculateVolatility(historicalPrices);
        const price7dAgo = historicalPrices[0];
        const price30dAgo = price7dAgo * (1 - (Math.random() - 0.5) * 0.1);
        const priceChange7d = ((priceData.price - price7dAgo) / price7dAgo) * 100;
        const priceChange30d = ((priceData.price - price30dAgo) / price30dAgo) * 100;
        return {
          symbol: stock.symbol,
          name: stock.name,
          price: priceData.price,
          change: priceData.change,
          percentChange: priceData.percentChange,
          priceChange7d,
          priceChange30d,
          volatility,
          historicalPrices,
          marketCap: 0,
          volume24h: 0
        };
      })
    );
    return stocksWithPrices;
  } catch (error) {
    console.error('Error fetching popular stocks:', error);
    return POPULAR_STOCKS.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: 100,
      change: 0,
      percentChange: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      volatility: 'low',
      historicalPrices: Array(7).fill(100),
      marketCap: 0,
      volume24h: 0
    }));
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
        const historicalPrices = generateHistoricalPrices(priceData.price);
        const volatility = calculateVolatility(historicalPrices);
        const price7dAgo = historicalPrices[0];
        const price30dAgo = price7dAgo * (1 - (Math.random() - 0.5) * 0.1);
        const priceChange7d = ((priceData.price - price7dAgo) / price7dAgo) * 100;
        const priceChange30d = ((priceData.price - price30dAgo) / price30dAgo) * 100;
        return {
          symbol: crypto.symbol,
          name: crypto.name,
          price: priceData.price,
          change24h: priceData.change24h,
          percentChange: priceData.change24h,
          priceChange7d,
          priceChange30d,
          volatility,
          historicalPrices,
          marketCap: priceData.marketCap || 0,
          volume24h: priceData.volume24h || 0
        };
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
    return POPULAR_CRYPTO.map(crypto => ({
      symbol: crypto.symbol,
      name: crypto.name,
      price: FALLBACK_CRYPTO_PRICES[crypto.id] || 100,
      change24h: 0,
      percentChange: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      volatility: 'low',
      historicalPrices: Array(7).fill(FALLBACK_CRYPTO_PRICES[crypto.id] || 100),
      marketCap: 0,
      volume24h: 0
    }));
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
  ChevronUp,
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

  // Track which assets are expanded in portfolio builder
  const [expandedAssets, setExpandedAssets] = useState(new Set());

  // Mobile battle view tab state
  const [battleViewTab, setBattleViewTab] = useState('yours');

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

  // LOGIN SCREEN - Mobile-first responsive
  if (screen === 'home') {
    return (
      <div style={containerStyle}>
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.background }}>
          {/* Animated Card Container - Mobile-first with responsive padding */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-md rounded-2xl p-6 md:p-12"
            style={{
              background: colors.cardBg,
              boxShadow: '0 0 40px rgba(0, 217, 255, 0.1), 0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${colors.border}`
            }}
          >
            <div className="text-center">
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
                className="flex justify-center mb-6"
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
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)`
                  }}
                >
                  <Swords className="w-8 h-8 md:w-10 md:h-10" style={{ color: colors.background }} />
                </motion.div>
              </motion.div>

              {/* Animated Title - Responsive font sizes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="mb-8"
              >
                <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{
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
                  className="text-sm md:text-base"
                  style={{ color: colors.textSecondary }}
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
                  className="w-full px-4 py-4 text-base rounded-xl mb-5"
                  style={{
                    border: `2px solid ${username ? colors.cyan : colors.borderSubtle}`,
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: colors.textPrimary,
                    outline: 'none',
                    minHeight: '50px',
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
                  className="w-full py-4 text-base md:text-lg font-semibold rounded-xl flex items-center justify-center gap-2"
                  style={{
                    color: username.trim() ? colors.background : colors.textMuted,
                    background: username.trim() ? `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)` : colors.cardElevated,
                    border: 'none',
                    cursor: username.trim() ? 'pointer' : 'not-allowed',
                    minHeight: '50px',
                    transition: 'background 0.3s ease'
                  }}
                >
                  Enter Arena
                  <ArrowRight className="w-5 h-5" />
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

          {/* MOBILE: Top Header - Fixed position */}
          <div
            className="md:hidden fixed top-0 left-0 right-0 z-50"
            style={{
              background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDark} 100%)`,
              padding: '12px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5" style={{ color: 'white' }} />
                <span className="text-lg font-bold" style={{ color: 'white' }}>
                  MarketClash
                </span>
              </div>
              <button
                onClick={() => { setUser(null); setUsername(''); setScreen('home'); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                <LogOut className="w-4 h-4" />
                Exit
              </button>
            </div>
          </div>

          {/* DESKTOP: Top Header - Static */}
          <div
            className="hidden md:block"
            style={{
              padding: '12px 24px',
              background: 'transparent',
              borderBottom: `1px solid ${colors.borderSubtle}`
            }}
          >
            <div className="max-w-5xl mx-auto">
              <div className="flex justify-between items-center">
                {/* Logo */}
                <div className="flex items-center gap-2.5">
                  <Flame className="w-6 h-6" style={{ color: colors.cyan }} />
                  <span className="text-xl font-bold" style={{
                    background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.greenBright} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>MarketClash</span>
                </div>

                {/* User & Logout */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: colors.cardBg, border: `2px solid ${colors.cyan}` }}>
                    <User className="w-3.5 h-3.5" style={{ color: colors.cyan }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: colors.textPrimary }}>{user.username}</span>
                  <button
                    onClick={() => { setUser(null); setUsername(''); setScreen('home'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                    style={{ background: 'transparent', border: `1px solid ${colors.borderSubtle}`, color: colors.textSecondary }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.red; e.currentTarget.style.color = colors.red; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; e.currentTarget.style.color = colors.textSecondary; }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Mobile-first with responsive padding */}
          <div
            className="pt-16 md:pt-0 pb-28 md:pb-20 px-4 md:px-6"
            style={{
              flex: 1,
              maxWidth: '900px',
              margin: '0 auto'
            }}
          >
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

            {/* Create & Join Battle Cards - Visible on all screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5">
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

            {/* Training Mode Banner - Visible on all screens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="flex"
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

          {/* MOBILE: Bottom Navigation - Action buttons for mobile */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50"
            style={{
              background: colors.cardBg,
              borderTop: `1px solid ${colors.border}`,
              padding: '12px 16px',
              boxShadow: '0 -2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="flex items-center justify-around">
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setAssetType('stocks'); setSearchTerm(''); setScreen('builder'); }}
                className="flex flex-col items-center gap-1 px-4 py-2"
                style={{ color: colors.cyan }}
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs font-semibold">Create</span>
              </button>
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setAssetType('stocks'); setSearchTerm(''); setJoinCode(''); setScreen('join'); }}
                className="flex flex-col items-center gap-1 px-4 py-2"
                style={{ color: colors.textSecondary }}
              >
                <Users className="w-6 h-6" />
                <span className="text-xs font-semibold">Join</span>
              </button>
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setAssetType('stocks'); setSearchTerm(''); setScreen('training'); }}
                className="flex flex-col items-center gap-1 px-4 py-2"
                style={{ color: colors.purple }}
              >
                <GraduationCap className="w-6 h-6" />
                <span className="text-xs font-semibold">Train</span>
              </button>
              <button
                onClick={() => setShowXPModal(true)}
                className="flex flex-col items-center gap-1 px-4 py-2"
                style={{ color: colors.gold }}
              >
                <Trophy className="w-6 h-6" />
                <span className="text-xs font-semibold">{user.wins}W</span>
              </button>
            </div>
          </div>

          {/* DESKTOP: Bottom Stats Bar - Fixed */}
          <div
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
        </div>
      </div>
    );
  }

  // PORTFOLIO BUILDER SCREEN (Create Game)
  if (screen === 'builder') {
    return (
      <div style={containerStyle}>
        <div className="min-h-screen pb-8" style={{ background: colors.background }}>
          {/* Sticky Header - Mobile-first */}
          <div
            className="sticky top-0 z-40"
            style={{
              background: `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDark} 100%)`,
              padding: '12px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setScreen('dashboard'); }}
                className="flex items-center gap-2 text-white"
              >
                <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                <span className="font-semibold text-sm md:text-base">Back</span>
              </button>
              <h1 className="text-base md:text-xl font-bold text-white">
                Create Battle
              </h1>
              <div className="w-16 md:w-20"></div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Left: Asset Selection (takes 2/3 on desktop) */}
              <div className="lg:col-span-2">
                <div className="rounded-xl p-4 md:p-6" style={{
                  background: colors.cardBg,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: colors.textPrimary }}>Available Assets</h2>

                  {loadingMarketData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                      <Loader2 style={{ height: '32px', width: '32px', color: colors.cyan, animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Asset Type Tabs - Mobile-first responsive */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                          onClick={() => setAssetType('stocks')}
                          disabled={portfolioType === 'crypto'}
                          className="py-3 md:py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all"
                          style={{
                            background: assetType === 'stocks'
                              ? `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)`
                              : colors.elevated,
                            color: assetType === 'stocks' ? colors.background : colors.textSecondary,
                            border: `2px solid ${assetType === 'stocks' ? colors.cyan : colors.borderSubtle}`,
                            opacity: portfolioType === 'crypto' ? 0.4 : 1,
                            cursor: portfolioType === 'crypto' ? 'not-allowed' : 'pointer',
                            minHeight: '44px'
                          }}
                        >
                          📈 Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          disabled={portfolioType === 'stocks'}
                          className="py-3 md:py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all"
                          style={{
                            background: assetType === 'crypto'
                              ? `linear-gradient(135deg, ${colors.cyan} 0%, ${colors.cyanDim} 100%)`
                              : colors.elevated,
                            color: assetType === 'crypto' ? colors.background : colors.textSecondary,
                            border: `2px solid ${assetType === 'crypto' ? colors.cyan : colors.borderSubtle}`,
                            opacity: portfolioType === 'stocks' ? 0.4 : 1,
                            cursor: portfolioType === 'stocks' ? 'not-allowed' : 'pointer',
                            minHeight: '44px'
                          }}
                        >
                          ₿ Crypto
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

                      {/* Asset Grid - Responsive: 1 col mobile, 2 col tablet+ */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {filteredAssets.map(asset => {
                          const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
                          const isExpanded = expandedAssets.has(asset.symbol);

                          return (
                            <div
                              key={asset.symbol}
                              style={{
                                borderRadius: '8px',
                                border: `1px solid ${inPortfolio ? colors.cyan : colors.borderSubtle}`,
                                background: inPortfolio ? `${colors.cyan}15` : 'rgba(0, 217, 255, 0.05)',
                                transition: 'all 0.2s',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Main Card - Always Visible */}
                              <div
                                style={{ padding: '14px', cursor: 'pointer' }}
                                onClick={(e) => {
                                  // Toggle expansion on card click
                                  toggleAssetExpansion(asset.symbol);
                                }}
                              >
                                {/* Symbol & Volatility Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                  <span style={{ fontWeight: 'bold', color: colors.textPrimary }}>{asset.symbol}</span>
                                  {asset.volatility && (
                                    <span style={{
                                      fontSize: '9px',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      background: asset.volatility === 'high' ? `${colors.red}20` :
                                                 asset.volatility === 'medium' ? `${colors.gold}20` : `${colors.green}20`,
                                      color: asset.volatility === 'high' ? colors.red :
                                            asset.volatility === 'medium' ? colors.gold : colors.green,
                                      fontWeight: '600'
                                    }}>
                                      {asset.volatility === 'low' ? 'Low Vol' :
                                       asset.volatility === 'medium' ? 'Med Vol' : 'High Vol'}
                                    </span>
                                  )}
                                </div>

                                {/* Name */}
                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>{asset.name}</div>

                                {/* Price & 24h Change */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                  <span style={{ fontSize: '16px', fontWeight: '600', color: colors.cyan }}>
                                    ${asset.price.toFixed(2)}
                                  </span>
                                  {(asset.percentChange !== undefined || asset.change24h !== undefined) && (
                                    <span style={{
                                      fontSize: '11px',
                                      color: (asset.percentChange || asset.change24h) >= 0 ? colors.green : colors.red
                                    }}>
                                      {(asset.percentChange || asset.change24h) >= 0 ? '+' : ''}{(asset.percentChange || asset.change24h || 0).toFixed(2)}%
                                    </span>
                                  )}
                                </div>

                                {/* Community Quick Stats */}
                                {asset.communityData && (
                                  <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '8px',
                                    flexWrap: 'wrap'
                                  }}>
                                    {asset.communityData.isHot && (
                                      <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: `${colors.red}25`,
                                        color: colors.red,
                                        fontWeight: '600'
                                      }}>
                                        <Flame style={{ width: '10px', height: '10px' }} />
                                        HOT
                                      </span>
                                    )}
                                    {asset.communityData.championPick && (
                                      <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: `${colors.gold}25`,
                                        color: colors.gold,
                                        fontWeight: '600'
                                      }}>
                                        <Trophy style={{ width: '10px', height: '10px' }} />
                                        CHAMP
                                      </span>
                                    )}
                                    <span style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '9px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: `${colors.cyan}15`,
                                      color: colors.cyan,
                                      fontWeight: '500'
                                    }}>
                                      <Users style={{ width: '10px', height: '10px' }} />
                                      {asset.communityData.picksThisWeek.toLocaleString()}
                                    </span>
                                  </div>
                                )}

                                {/* Add Button */}
                                <button
                                  className="add-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddAsset(asset);
                                  }}
                                  disabled={inPortfolio || portfolio.length >= 13}
                                  style={{
                                    marginTop: '10px',
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    border: 'none',
                                    cursor: inPortfolio || portfolio.length >= 13 ? 'not-allowed' : 'pointer',
                                    background: inPortfolio ? colors.green : colors.cyan,
                                    color: '#000'
                                  }}
                                >
                                  {inPortfolio ? '✓ Added' : 'Add to Portfolio'}
                                </button>

                                {/* Click for Details Hint */}
                                <div style={{
                                  marginTop: '12px',
                                  paddingTop: '8px',
                                  borderTop: `1px solid ${colors.borderSubtle}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  fontSize: '11px',
                                  color: colors.textMuted,
                                  fontWeight: '500'
                                }}>
                                  {isExpanded ? (
                                    <ChevronUp style={{ height: '14px', width: '14px' }} />
                                  ) : (
                                    <ChevronDown style={{ height: '14px', width: '14px' }} />
                                  )}
                                  {isExpanded ? 'Click to collapse' : 'Click for details'}
                                </div>
                              </div>

                              {/* Expanded Details */}
                              {isExpanded && (
                                <div style={{
                                  padding: '12px 14px',
                                  borderTop: `1px solid ${colors.borderSubtle}`,
                                  background: 'rgba(0, 0, 0, 0.2)'
                                }}>
                                  {/* Community Activity Section */}
                                  {asset.communityData && (
                                    <div style={{ marginBottom: '12px' }}>
                                      {/* Trending Badge */}
                                      {asset.communityData.isTrending && (
                                        <div style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          background: `linear-gradient(135deg, ${colors.cyan}20, ${colors.purple}20)`,
                                          border: `1px solid ${colors.cyan}40`,
                                          marginBottom: '10px'
                                        }}>
                                          <TrendingUp style={{ width: '14px', height: '14px', color: colors.cyan }} />
                                          <span style={{ fontSize: '11px', fontWeight: '600', color: colors.cyan }}>
                                            TRENDING +{asset.communityData.trendPercentage}%
                                          </span>
                                        </div>
                                      )}

                                      {/* Community Picks */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px'
                                      }}>
                                        <Users style={{ width: '14px', height: '14px', color: colors.textSecondary }} />
                                        <span style={{ fontSize: '12px', color: colors.textPrimary, fontWeight: '600' }}>
                                          {asset.communityData.picksThisWeek.toLocaleString()} picks this week
                                        </span>
                                        {asset.communityData.popularityRank <= 3 && (
                                          <span style={{
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: colors.gold,
                                            color: '#000',
                                            fontWeight: '700'
                                          }}>
                                            #{asset.communityData.popularityRank}
                                          </span>
                                        )}
                                      </div>

                                      {/* Champion's Choice */}
                                      {asset.communityData.championPick && (
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          background: `${colors.gold}15`,
                                          border: `1px solid ${colors.gold}30`,
                                          marginBottom: '10px'
                                        }}>
                                          <Trophy style={{ width: '14px', height: '14px', color: colors.gold }} />
                                          <span style={{ fontSize: '11px', color: colors.gold, fontWeight: '600' }}>
                                            Champion's Choice - {asset.communityData.championPercentage}% of top players pick this
                                          </span>
                                        </div>
                                      )}

                                      {/* Battle Performance */}
                                      <div style={{
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: `1px solid ${colors.borderSubtle}`
                                      }}>
                                        <div style={{ fontSize: '10px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                                          BATTLE PERFORMANCE
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                          <div>
                                            <span style={{ color: colors.textSecondary }}>Win Rate: </span>
                                            <span style={{ color: asset.communityData.winRate >= 55 ? colors.green : colors.textPrimary, fontWeight: '600' }}>
                                              {asset.communityData.winRate}%
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ color: colors.textSecondary }}>Avg Return: </span>
                                            <span style={{ color: colors.green, fontWeight: '600' }}>
                                              +{asset.communityData.avgReturnWhenWinning}%
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                          {asset.communityData.totalBattles.toLocaleString()} battles ({asset.communityData.wins}W - {asset.communityData.losses}L)
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Performance */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>7d</div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: (asset.priceChange7d || 0) >= 0 ? colors.green : colors.red
                                      }}>
                                        {(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(2)}%
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>30d</div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: (asset.priceChange30d || 0) >= 0 ? colors.green : colors.red
                                      }}>
                                        {(asset.priceChange30d || 0) >= 0 ? '+' : ''}{(asset.priceChange30d || 0).toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>

                                  {/* Market Data */}
                                  <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                                    {asset.marketCap > 0 && (
                                      <div>Mkt Cap: ${(asset.marketCap / 1e9).toFixed(2)}B</div>
                                    )}
                                    {asset.volume24h > 0 && (
                                      <div>24h Vol: ${(asset.volume24h / 1e6).toFixed(2)}M</div>
                                    )}
                                  </div>

                                  {/* 52-Week Range */}
                                  {asset.week52Low && asset.week52High && (
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${colors.borderSubtle}` }}>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '11px',
                                        marginBottom: '6px'
                                      }}>
                                        <span style={{ color: colors.textMuted }}>52-Week Range:</span>
                                        <span style={{ color: colors.textPrimary, fontWeight: '500' }}>
                                          ${asset.week52Low.toFixed(2)} - ${asset.week52High.toFixed(2)}
                                        </span>
                                      </div>
                                      <div style={{
                                        height: '4px',
                                        background: colors.borderSubtle,
                                        borderRadius: '2px',
                                        position: 'relative',
                                        overflow: 'visible'
                                      }}>
                                        <div style={{
                                          position: 'absolute',
                                          left: `${Math.min(Math.max(((asset.price - asset.week52Low) / (asset.week52High - asset.week52Low)) * 100, 0), 100)}%`,
                                          top: '-2px',
                                          width: '8px',
                                          height: '8px',
                                          background: colors.cyan,
                                          borderRadius: '50%',
                                          transform: 'translateX(-50%)',
                                          boxShadow: `0 0 6px ${colors.cyan}`
                                        }} />
                                      </div>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '9px',
                                        color: colors.textMuted,
                                        marginTop: '4px'
                                      }}>
                                        <span>Low</span>
                                        <span>High</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Portfolio Summary - Sticky on all screen sizes */}
              <div className="sticky top-[140px] md:top-20 z-30">
                <div className="rounded-xl p-4 md:p-6" style={{
                  background: colors.cardBg,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
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
        <div className="min-h-screen pb-8" style={{ background: colors.background }}>
          {/* Sticky Header - Mobile-first */}
          <div
            className="sticky top-0 z-40"
            style={{
              background: `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)`,
              padding: '12px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setJoinCode(''); setScreen('dashboard'); }}
                className="flex items-center gap-2 text-white"
              >
                <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                <span className="font-semibold text-sm md:text-base">Back</span>
              </button>
              <h1 className="text-base md:text-xl font-bold text-white">
                Join Battle
              </h1>
              <div className="w-16 md:w-20"></div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
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

                      {/* Asset Grid - Responsive: 1 col mobile, 2 col tablet+ */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {filteredAssets.map(asset => {
                          const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
                          const isExpanded = expandedAssets.has(asset.symbol);

                          return (
                            <div
                              key={asset.symbol}
                              style={{
                                borderRadius: '8px',
                                border: `1px solid ${inPortfolio ? colors.cyan : colors.borderSubtle}`,
                                background: inPortfolio ? `${colors.cyan}15` : 'rgba(0, 217, 255, 0.05)',
                                transition: 'all 0.2s',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Main Card - Always Visible */}
                              <div
                                style={{ padding: '14px', cursor: 'pointer' }}
                                onClick={(e) => {
                                  // Toggle expansion on card click
                                  toggleAssetExpansion(asset.symbol);
                                }}
                              >
                                {/* Symbol & Volatility Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                  <span style={{ fontWeight: 'bold', color: colors.textPrimary }}>{asset.symbol}</span>
                                  {asset.volatility && (
                                    <span style={{
                                      fontSize: '9px',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      background: asset.volatility === 'high' ? `${colors.red}20` :
                                                 asset.volatility === 'medium' ? `${colors.gold}20` : `${colors.green}20`,
                                      color: asset.volatility === 'high' ? colors.red :
                                            asset.volatility === 'medium' ? colors.gold : colors.green,
                                      fontWeight: '600'
                                    }}>
                                      {asset.volatility === 'low' ? 'Low Vol' :
                                       asset.volatility === 'medium' ? 'Med Vol' : 'High Vol'}
                                    </span>
                                  )}
                                </div>

                                {/* Name */}
                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>{asset.name}</div>

                                {/* Price & 24h Change */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                  <span style={{ fontSize: '16px', fontWeight: '600', color: colors.cyan }}>
                                    ${asset.price.toFixed(2)}
                                  </span>
                                  {(asset.percentChange !== undefined || asset.change24h !== undefined) && (
                                    <span style={{
                                      fontSize: '11px',
                                      color: (asset.percentChange || asset.change24h) >= 0 ? colors.green : colors.red
                                    }}>
                                      {(asset.percentChange || asset.change24h) >= 0 ? '+' : ''}{(asset.percentChange || asset.change24h || 0).toFixed(2)}%
                                    </span>
                                  )}
                                </div>

                                {/* Community Quick Stats */}
                                {asset.communityData && (
                                  <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '8px',
                                    flexWrap: 'wrap'
                                  }}>
                                    {asset.communityData.isHot && (
                                      <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: `${colors.red}25`,
                                        color: colors.red,
                                        fontWeight: '600'
                                      }}>
                                        <Flame style={{ width: '10px', height: '10px' }} />
                                        HOT
                                      </span>
                                    )}
                                    {asset.communityData.championPick && (
                                      <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '9px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: `${colors.gold}25`,
                                        color: colors.gold,
                                        fontWeight: '600'
                                      }}>
                                        <Trophy style={{ width: '10px', height: '10px' }} />
                                        CHAMP
                                      </span>
                                    )}
                                    <span style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      fontSize: '9px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: `${colors.cyan}15`,
                                      color: colors.cyan,
                                      fontWeight: '500'
                                    }}>
                                      <Users style={{ width: '10px', height: '10px' }} />
                                      {asset.communityData.picksThisWeek.toLocaleString()}
                                    </span>
                                  </div>
                                )}

                                {/* Add Button */}
                                <button
                                  className="add-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddAsset(asset);
                                  }}
                                  disabled={inPortfolio || portfolio.length >= 13}
                                  style={{
                                    marginTop: '10px',
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    border: 'none',
                                    cursor: inPortfolio || portfolio.length >= 13 ? 'not-allowed' : 'pointer',
                                    background: inPortfolio ? colors.green : colors.cyan,
                                    color: '#000'
                                  }}
                                >
                                  {inPortfolio ? '✓ Added' : 'Add to Portfolio'}
                                </button>

                                {/* Click for Details Hint */}
                                <div style={{
                                  marginTop: '12px',
                                  paddingTop: '8px',
                                  borderTop: `1px solid ${colors.borderSubtle}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  fontSize: '11px',
                                  color: colors.textMuted,
                                  fontWeight: '500'
                                }}>
                                  {isExpanded ? (
                                    <ChevronUp style={{ height: '14px', width: '14px' }} />
                                  ) : (
                                    <ChevronDown style={{ height: '14px', width: '14px' }} />
                                  )}
                                  {isExpanded ? 'Click to collapse' : 'Click for details'}
                                </div>
                              </div>

                              {/* Expanded Details */}
                              {isExpanded && (
                                <div style={{
                                  padding: '12px 14px',
                                  borderTop: `1px solid ${colors.borderSubtle}`,
                                  background: 'rgba(0, 0, 0, 0.2)'
                                }}>
                                  {/* Community Activity Section */}
                                  {asset.communityData && (
                                    <div style={{ marginBottom: '12px' }}>
                                      {/* Trending Badge */}
                                      {asset.communityData.isTrending && (
                                        <div style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          background: `linear-gradient(135deg, ${colors.cyan}20, ${colors.purple}20)`,
                                          border: `1px solid ${colors.cyan}40`,
                                          marginBottom: '10px'
                                        }}>
                                          <TrendingUp style={{ width: '14px', height: '14px', color: colors.cyan }} />
                                          <span style={{ fontSize: '11px', fontWeight: '600', color: colors.cyan }}>
                                            TRENDING +{asset.communityData.trendPercentage}%
                                          </span>
                                        </div>
                                      )}

                                      {/* Community Picks */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px'
                                      }}>
                                        <Users style={{ width: '14px', height: '14px', color: colors.textSecondary }} />
                                        <span style={{ fontSize: '12px', color: colors.textPrimary, fontWeight: '600' }}>
                                          {asset.communityData.picksThisWeek.toLocaleString()} picks this week
                                        </span>
                                        {asset.communityData.popularityRank <= 3 && (
                                          <span style={{
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: colors.gold,
                                            color: '#000',
                                            fontWeight: '700'
                                          }}>
                                            #{asset.communityData.popularityRank}
                                          </span>
                                        )}
                                      </div>

                                      {/* Champion's Choice */}
                                      {asset.communityData.championPick && (
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          background: `${colors.gold}15`,
                                          border: `1px solid ${colors.gold}30`,
                                          marginBottom: '10px'
                                        }}>
                                          <Trophy style={{ width: '14px', height: '14px', color: colors.gold }} />
                                          <span style={{ fontSize: '11px', color: colors.gold, fontWeight: '600' }}>
                                            Champion's Choice - {asset.communityData.championPercentage}% of top players pick this
                                          </span>
                                        </div>
                                      )}

                                      {/* Battle Performance */}
                                      <div style={{
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: `1px solid ${colors.borderSubtle}`
                                      }}>
                                        <div style={{ fontSize: '10px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                                          BATTLE PERFORMANCE
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                          <div>
                                            <span style={{ color: colors.textSecondary }}>Win Rate: </span>
                                            <span style={{ color: asset.communityData.winRate >= 55 ? colors.green : colors.textPrimary, fontWeight: '600' }}>
                                              {asset.communityData.winRate}%
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ color: colors.textSecondary }}>Avg Return: </span>
                                            <span style={{ color: colors.green, fontWeight: '600' }}>
                                              +{asset.communityData.avgReturnWhenWinning}%
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                          {asset.communityData.totalBattles.toLocaleString()} battles ({asset.communityData.wins}W - {asset.communityData.losses}L)
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Performance */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>7d</div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: (asset.priceChange7d || 0) >= 0 ? colors.green : colors.red
                                      }}>
                                        {(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(2)}%
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>30d</div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: (asset.priceChange30d || 0) >= 0 ? colors.green : colors.red
                                      }}>
                                        {(asset.priceChange30d || 0) >= 0 ? '+' : ''}{(asset.priceChange30d || 0).toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>

                                  {/* Market Data */}
                                  <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                                    {asset.marketCap > 0 && (
                                      <div>Mkt Cap: ${(asset.marketCap / 1e9).toFixed(2)}B</div>
                                    )}
                                    {asset.volume24h > 0 && (
                                      <div>24h Vol: ${(asset.volume24h / 1e6).toFixed(2)}M</div>
                                    )}
                                  </div>

                                  {/* 52-Week Range */}
                                  {asset.week52Low && asset.week52High && (
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${colors.borderSubtle}` }}>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '11px',
                                        marginBottom: '6px'
                                      }}>
                                        <span style={{ color: colors.textMuted }}>52-Week Range:</span>
                                        <span style={{ color: colors.textPrimary, fontWeight: '500' }}>
                                          ${asset.week52Low.toFixed(2)} - ${asset.week52High.toFixed(2)}
                                        </span>
                                      </div>
                                      <div style={{
                                        height: '4px',
                                        background: colors.borderSubtle,
                                        borderRadius: '2px',
                                        position: 'relative',
                                        overflow: 'visible'
                                      }}>
                                        <div style={{
                                          position: 'absolute',
                                          left: `${Math.min(Math.max(((asset.price - asset.week52Low) / (asset.week52High - asset.week52Low)) * 100, 0), 100)}%`,
                                          top: '-2px',
                                          width: '8px',
                                          height: '8px',
                                          background: colors.cyan,
                                          borderRadius: '50%',
                                          transform: 'translateX(-50%)',
                                          boxShadow: `0 0 6px ${colors.cyan}`
                                        }} />
                                      </div>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '9px',
                                        color: colors.textMuted,
                                        marginTop: '4px'
                                      }}>
                                        <span>Low</span>
                                        <span>High</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Portfolio Summary - Sticky on all screen sizes */}
              <div className="sticky top-[140px] md:top-20 z-30">
                <div className="rounded-xl p-4 md:p-6" style={{
                  background: colors.cardBg,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
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
        <div className="min-h-screen pb-8" style={{ background: colors.background }}>
          {/* Sticky Header - Mobile-first */}
          <div
            className="sticky top-0 z-40"
            style={{
              background: `linear-gradient(135deg, ${colors.purple} 0%, #7C3AED 100%)`,
              padding: '12px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setScreen('dashboard'); }}
                className="flex items-center gap-2 text-white"
              >
                <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                <span className="font-semibold text-sm md:text-base">Back</span>
              </button>
              <h1 className="text-base md:text-xl font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Training
              </h1>
              <div className="w-16 md:w-20"></div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Left: Asset Selection (takes 2/3 on desktop) */}
              <div className="lg:col-span-2">
                <div className="rounded-xl p-4 md:p-6" style={{
                  background: colors.cardBg,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 className="text-lg md:text-xl font-bold mb-4" style={{ color: colors.textPrimary }}>Available Assets</h2>

                  {loadingMarketData ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.purple }} />
                    </div>
                  ) : (
                    <>
                      {/* Asset Type Tabs - Mobile-first responsive */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <button
                          onClick={() => setAssetType('stocks')}
                          disabled={portfolioType === 'crypto'}
                          className="py-3 md:py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all"
                          style={{
                            background: assetType === 'stocks' ? colors.purple : colors.elevated,
                            color: assetType === 'stocks' ? 'white' : colors.textSecondary,
                            border: `2px solid ${assetType === 'stocks' ? colors.purple : colors.borderSubtle}`,
                            opacity: portfolioType === 'crypto' ? 0.4 : 1,
                            cursor: portfolioType === 'crypto' ? 'not-allowed' : 'pointer',
                            minHeight: '44px'
                          }}
                        >
                          📈 Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          disabled={portfolioType === 'stocks'}
                          className="py-3 md:py-2.5 rounded-lg font-semibold text-sm md:text-base transition-all"
                          style={{
                            background: assetType === 'crypto' ? colors.purple : colors.elevated,
                            color: assetType === 'crypto' ? 'white' : colors.textSecondary,
                            border: `2px solid ${assetType === 'crypto' ? colors.purple : colors.borderSubtle}`,
                            opacity: portfolioType === 'stocks' ? 0.4 : 1,
                            cursor: portfolioType === 'stocks' ? 'not-allowed' : 'pointer',
                            minHeight: '44px'
                          }}
                        >
                          ₿ Crypto
                        </button>
                      </div>

                      {/* Portfolio Type Indicator */}
                      {portfolioType && (
                        <div style={{
                          padding: '12px 16px',
                          marginBottom: '16px',
                          background: `${colors.purple}15`,
                          border: `1px solid ${colors.purple}`,
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
                          border: `1px solid ${searchTerm ? colors.purple : colors.borderSubtle}`,
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: colors.textPrimary,
                          fontSize: '14px'
                        }}
                      />

                      {/* Asset Grid - Responsive: 1 col mobile, 2 col tablet+ */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {filteredAssets.map(asset => {
                          const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
                          const isExpanded = expandedAssets.has(asset.symbol);

                          return (
                            <div
                              key={asset.symbol}
                              style={{
                                borderRadius: '8px',
                                border: `1px solid ${inPortfolio ? colors.purple : colors.borderSubtle}`,
                                background: inPortfolio ? `${colors.purple}15` : colors.cardBg,
                                transition: 'all 0.2s',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Main Card - Always Visible */}
                              <div
                                style={{ padding: '14px', cursor: 'pointer' }}
                                onClick={(e) => {
                                  // Toggle expansion on card click
                                  toggleAssetExpansion(asset.symbol);
                                }}
                              >
                                {/* Symbol & Volatility Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                  <span style={{ fontWeight: 'bold', color: colors.textPrimary }}>{asset.symbol}</span>
                                  {asset.volatility && (
                                    <span style={{
                                      fontSize: '9px',
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      background: asset.volatility === 'high' ? `${colors.red}20` :
                                                 asset.volatility === 'medium' ? `${colors.gold}20` : `${colors.green}20`,
                                      color: asset.volatility === 'high' ? colors.red :
                                            asset.volatility === 'medium' ? colors.gold : colors.green,
                                      fontWeight: '600'
                                    }}>
                                      {asset.volatility === 'low' ? 'Low Vol' :
                                       asset.volatility === 'medium' ? 'Med Vol' : 'High Vol'}
                                    </span>
                                  )}
                                </div>

                                {/* Name */}
                                <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '6px' }}>{asset.name}</div>

                                {/* Price & 24h Change */}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                  <span style={{ fontSize: '16px', fontWeight: '600', color: colors.purple }}>
                                    ${asset.price.toFixed(2)}
                                  </span>
                                  {(asset.percentChange !== undefined || asset.change24h !== undefined) && (
                                    <span style={{
                                      fontSize: '11px',
                                      color: (asset.percentChange || asset.change24h) >= 0 ? colors.green : colors.red
                                    }}>
                                      {(asset.percentChange || asset.change24h) >= 0 ? '+' : ''}{(asset.percentChange || asset.change24h || 0).toFixed(2)}%
                                    </span>
                                  )}
                                </div>

                                {/* Add Button */}
                                <button
                                  className="add-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddAsset(asset);
                                  }}
                                  disabled={inPortfolio || portfolio.length >= 13}
                                  style={{
                                    marginTop: '10px',
                                    width: '100%',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    border: 'none',
                                    cursor: inPortfolio || portfolio.length >= 13 ? 'not-allowed' : 'pointer',
                                    background: inPortfolio ? colors.green : colors.purple,
                                    color: 'white'
                                  }}
                                >
                                  {inPortfolio ? '✓ Added' : 'Add to Portfolio'}
                                </button>

                                {/* Click for Details Hint */}
                                <div style={{
                                  marginTop: '12px',
                                  paddingTop: '8px',
                                  borderTop: `1px solid ${colors.borderSubtle}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  fontSize: '11px',
                                  color: colors.textMuted,
                                  fontWeight: '500'
                                }}>
                                  {isExpanded ? (
                                    <ChevronUp style={{ height: '14px', width: '14px' }} />
                                  ) : (
                                    <ChevronDown style={{ height: '14px', width: '14px' }} />
                                  )}
                                  {isExpanded ? 'Click to collapse' : 'Click for details'}
                                </div>
                              </div>

                              {/* Expanded Details */}
                              {isExpanded && (
                                <div style={{
                                  padding: '12px 14px',
                                  borderTop: `1px solid ${colors.borderSubtle}`,
                                  background: 'rgba(0, 0, 0, 0.2)'
                                }}>
                                  {/* Community Activity Section */}
                                  {asset.communityData && (
                                    <div style={{ marginBottom: '12px' }}>
                                      {/* Trending Badge */}
                                      {asset.communityData.isTrending && (
                                        <div style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          background: `linear-gradient(135deg, ${colors.cyan}20, ${colors.purple}20)`,
                                          border: `1px solid ${colors.cyan}40`,
                                          marginBottom: '10px'
                                        }}>
                                          <TrendingUp style={{ width: '14px', height: '14px', color: colors.cyan }} />
                                          <span style={{ fontSize: '11px', fontWeight: '600', color: colors.cyan }}>
                                            TRENDING +{asset.communityData.trendPercentage}%
                                          </span>
                                        </div>
                                      )}

                                      {/* Community Picks */}
                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px'
                                      }}>
                                        <Users style={{ width: '14px', height: '14px', color: colors.textSecondary }} />
                                        <span style={{ fontSize: '12px', color: colors.textPrimary, fontWeight: '600' }}>
                                          {asset.communityData.picksThisWeek.toLocaleString()} picks this week
                                        </span>
                                        {asset.communityData.popularityRank <= 3 && (
                                          <span style={{
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: colors.gold,
                                            color: '#000',
                                            fontWeight: '700'
                                          }}>
                                            #{asset.communityData.popularityRank}
                                          </span>
                                        )}
                                      </div>

                                      {/* Champion's Choice */}
                                      {asset.communityData.championPick && (
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '6px 10px',
                                          borderRadius: '6px',
                                          background: `${colors.gold}15`,
                                          border: `1px solid ${colors.gold}30`,
                                          marginBottom: '10px'
                                        }}>
                                          <Trophy style={{ width: '14px', height: '14px', color: colors.gold }} />
                                          <span style={{ fontSize: '11px', color: colors.gold, fontWeight: '600' }}>
                                            Champion's Choice - {asset.communityData.championPercentage}% of top players pick this
                                          </span>
                                        </div>
                                      )}

                                      {/* Battle Performance */}
                                      <div style={{
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: `1px solid ${colors.borderSubtle}`
                                      }}>
                                        <div style={{ fontSize: '10px', color: colors.textSecondary, marginBottom: '6px', fontWeight: '600' }}>
                                          BATTLE PERFORMANCE
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                          <div>
                                            <span style={{ color: colors.textSecondary }}>Win Rate: </span>
                                            <span style={{ color: asset.communityData.winRate >= 55 ? colors.green : colors.textPrimary, fontWeight: '600' }}>
                                              {asset.communityData.winRate}%
                                            </span>
                                          </div>
                                          <div>
                                            <span style={{ color: colors.textSecondary }}>Avg Return: </span>
                                            <span style={{ color: colors.green, fontWeight: '600' }}>
                                              +{asset.communityData.avgReturnWhenWinning}%
                                            </span>
                                          </div>
                                        </div>
                                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '4px' }}>
                                          {asset.communityData.totalBattles.toLocaleString()} battles ({asset.communityData.wins}W - {asset.communityData.losses}L)
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Performance */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                    <div>
                                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>7d</div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: (asset.priceChange7d || 0) >= 0 ? colors.green : colors.red
                                      }}>
                                        {(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(2)}%
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '10px', color: colors.textSecondary }}>30d</div>
                                      <div style={{
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: (asset.priceChange30d || 0) >= 0 ? colors.green : colors.red
                                      }}>
                                        {(asset.priceChange30d || 0) >= 0 ? '+' : ''}{(asset.priceChange30d || 0).toFixed(2)}%
                                      </div>
                                    </div>
                                  </div>

                                  {/* Market Data */}
                                  <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                                    {asset.marketCap > 0 && (
                                      <div>Mkt Cap: ${(asset.marketCap / 1e9).toFixed(2)}B</div>
                                    )}
                                    {asset.volume24h > 0 && (
                                      <div>24h Vol: ${(asset.volume24h / 1e6).toFixed(2)}M</div>
                                    )}
                                  </div>

                                  {/* 52-Week Range */}
                                  {asset.week52Low && asset.week52High && (
                                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${colors.borderSubtle}` }}>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '11px',
                                        marginBottom: '6px'
                                      }}>
                                        <span style={{ color: colors.textMuted }}>52-Week Range:</span>
                                        <span style={{ color: colors.textPrimary, fontWeight: '500' }}>
                                          ${asset.week52Low.toFixed(2)} - ${asset.week52High.toFixed(2)}
                                        </span>
                                      </div>
                                      <div style={{
                                        height: '4px',
                                        background: colors.borderSubtle,
                                        borderRadius: '2px',
                                        position: 'relative',
                                        overflow: 'visible'
                                      }}>
                                        <div style={{
                                          position: 'absolute',
                                          left: `${Math.min(Math.max(((asset.price - asset.week52Low) / (asset.week52High - asset.week52Low)) * 100, 0), 100)}%`,
                                          top: '-2px',
                                          width: '8px',
                                          height: '8px',
                                          background: colors.purple,
                                          borderRadius: '50%',
                                          transform: 'translateX(-50%)',
                                          boxShadow: `0 0 6px ${colors.purple}`
                                        }} />
                                      </div>
                                      <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: '9px',
                                        color: colors.textMuted,
                                        marginTop: '4px'
                                      }}>
                                        <span>Low</span>
                                        <span>High</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Portfolio Summary - Sticky on all screen sizes */}
              <div className="sticky top-[140px] md:top-20 z-30">
                <div style={{
                  background: colors.cardBg,
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                  padding: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: colors.textPrimary }}>Your Portfolio</h2>
                  <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '16px' }}>
                    {portfolio.length}/13 assets • {totalPercentage.toFixed(1)}%
                  </p>

                  {/* Portfolio Name Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.textSecondary, marginBottom: '8px' }}>
                      Portfolio Name <span style={{ color: colors.red }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter portfolio name"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: `1px solid ${portfolioName ? colors.purple : (!portfolioName && portfolio.length > 0 ? colors.red : colors.borderSubtle)}`,
                        background: !portfolioName && portfolio.length > 0 ? `${colors.red}15` : colors.cardBg,
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        color: colors.textPrimary
                      }}
                    />
                    {!portfolioName && portfolio.length > 0 && (
                      <div style={{ fontSize: '12px', color: colors.red, marginTop: '4px' }}>Portfolio name is required</div>
                    )}
                  </div>

                  {portfolio.length === 0 ? (
                    <div style={{ textAlign: 'center', color: colors.textMuted, padding: '48px 0' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>📊</div>
                      <div>No assets selected</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
                        {portfolio.map(asset => (
                          <div key={asset.symbol} style={{ padding: '12px', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '12px', marginBottom: '12px', border: `1px solid ${colors.borderSubtle}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', color: colors.textPrimary }}>{asset.symbol}</div>
                                <div style={{ fontSize: '12px', color: colors.textSecondary }}>${asset.price.toFixed(2)}</div>
                              </div>
                              <button
                                onClick={() => handleRemoveAsset(asset.symbol)}
                                style={{
                                  color: colors.textMuted,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'color 0.2s',
                                  padding: 0
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = colors.red}
                                onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
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
                                  border: `1px solid ${colors.purple}`,
                                  borderRadius: '8px',
                                  outline: 'none',
                                  appearance: 'none',
                                  cursor: 'pointer',
                                  background: colors.cardBg,
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: colors.textPrimary,
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
                                color: colors.purple,
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
                              : colors.borderSubtle,
                            color: 'white',
                            boxShadow: isPortfolioValid && portfolioName.trim() ? '0 4px 6px -1px rgba(147, 51, 234, 0.3)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            if (isPortfolioValid && portfolioName.trim()) {
                              e.currentTarget.style.transform = 'scale(1.02)';
                              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(147, 51, 234, 0.4)';
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
        <div className="min-h-screen pb-8" style={{ background: colors.background }}>
          {/* BATTLE HEADER - Mobile-first sticky */}
          <div
            className="sticky top-0 z-40"
            style={{
              background: isWinning
                ? `linear-gradient(135deg, ${colors.green} 0%, #059669 100%)`
                : `linear-gradient(135deg, ${colors.red} 0%, #DC2626 100%)`,
              padding: '12px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setScreen('dashboard')}
                className="flex items-center gap-2 text-white"
              >
                <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                <span className="font-semibold text-sm md:text-base">Back</span>
              </button>

              <div className="text-center">
                <div className="text-xs text-white opacity-80 uppercase tracking-wider mb-1">
                  {isWinning ? 'LEADING' : 'TRAILING'}
                </div>
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-xl md:text-2xl font-bold text-white font-mono"
                >
                  {battleTimer.formatTimeRemaining(currentBattle)}
                </motion.div>
              </div>

              <div className="w-16 md:w-20 text-right">
                <span className="text-white text-sm font-semibold">
                  {isWinning ? '+' : ''}{myGain.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
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

            {/* PORTFOLIO TABLES - ESPN-style head-to-head, both always visible */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
            >
              {/* YOUR PORTFOLIO TABLE - Always visible */}
              <div>
                <div className="rounded-2xl overflow-hidden" style={{
                  background: colors.cardBg,
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
              </div>

              {/* OPPONENT'S PORTFOLIO TABLE - Always visible */}
              <div>
                <div className="rounded-2xl overflow-hidden" style={{
                  background: colors.cardBg,
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