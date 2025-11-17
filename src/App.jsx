import React, { useState, useEffect } from 'react';
import { loadBattlesSafe, saveBattlesSafe, isSameBattles, loadUser, saveUser } from './services/LocalStorage';
import * as battleTimer from './services/battleTimer';

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
  Eye
} from 'lucide-react';

const PERCENTAGE_OPTIONS = [7.5, 10, 12.5, 15, 17.5, 20];

// Style override to neutralize App.css
const containerStyle = {
  maxWidth: 'none',
  width: '100%',
  margin: 0,
  padding: 0,
  textAlign: 'left',
  minHeight: '100vh'
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
          const processedBattle = battleTimer.processCompletedBattle(battle, endingPrices);
          
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
      xp: user.xp + userXP,
      wins: won ? user.wins + 1 : user.wins,
      losses: won ? user.losses : user.losses + 1
    };
    
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
          background: 'linear-gradient(to bottom, #E0F7FA 0%, #B2EBF2 100%)'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '512px',
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '48px'
          }}>
            <div style={{ textAlign: 'center' }}>
              {/* Logo */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
                }}>
                  <Trophy style={{ height: '48px', width: '48px', color: 'white' }} />
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  marginBottom: '12px',
                  background: 'linear-gradient(135deg, #00BCD4 0%, #26c6da 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  TradeSeven
                </h1>
                <p style={{ color: '#6B7280', fontSize: '18px' }}>Compete. Trade. Conquer.</p>
              </div>

              {/* Input */}
              <div>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    fontSize: '18px',
                    border: '2px solid',
                    borderColor: username ? '#00BCD4' : '#E5E7EB',
                    borderRadius: '16px',
                    outline: 'none',
                    marginBottom: '24px',
                    boxSizing: 'border-box'
                  }}
                />
                
                <button
                  onClick={handleLogin}
                  disabled={!username.trim()}
                  style={{
                    width: '100%',
                    padding: '16px',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: 'white',
                    background: username.trim() ? 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)' : '#D1D5DB',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: username.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    boxShadow: username.trim() ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (username.trim()) {
                      e.target.style.transform = 'scale(1.02)';
                      e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = username.trim() ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none';
                  }}
                >
                  Start Trading
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN
  if (screen === 'dashboard') {
    // Debug logging
    console.log('📊 DASHBOARD RENDER');
    console.log('Current user:', user?.username);
    console.log('Total battles in state:', battles.length);
    console.log('User battles:', userBattles.length);
    console.log('Active battles:', activeBattles.length, activeBattles.map(b => ({code: b.challengeCode, creator: b.creator, opponent: b.opponent, status: b.status})));
    console.log('Waiting battles:', waitingBattles.length, waitingBattles.map(b => ({code: b.challengeCode, creator: b.creator, opponent: b.opponent, status: b.status})));
    
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: 'linear-gradient(to bottom, #E0F7FA 0%, #B2EBF2 100%)'
        }}>
          {/* Header */}
          <div style={{
            color: 'white',
            padding: '24px',
            borderBottomLeftRadius: '24px',
            borderBottomRightRadius: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
          }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0 }}>TradeSeven</h1>
                <button
                  onClick={() => {
                    setUser(null);
                    setUsername('');
                    setScreen('home');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <LogOut style={{ height: '16px', width: '16px' }} />
                  Logout
                </button>
              </div>
              <p style={{ color: '#E0F7FA', margin: 0 }}>Welcome back, {user.username}!</p>
            </div>
          </div>

          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            {/* Active Battles */}
            {activeBattles.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1F2937' }}>Active Battles</h2>
                
                {activeBattles.map(battle => {
                  const isCreator = battle.creator === user.username;
                  const opponent = isCreator ? battle.opponent : battle.creator;
                  const myPortfolio = isCreator ? battle.creatorPortfolio : battle.opponentPortfolio;
                  const theirPortfolio = isCreator ? battle.opponentPortfolio : battle.creatorPortfolio;

                  // Calculate current values and gains
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

                  return (
                    <div key={battle.id} style={{
                      background: 'white',
                      borderRadius: '16px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      overflow: 'hidden',
                      marginBottom: '16px'
                    }}>
                      {/* Battle Header */}
                      <div style={{
                        color: 'white',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
                      }}>
                        <span style={{ fontWeight: '600' }}>Active Battle</span>
                        <span style={{ fontSize: '14px', color: '#E0F7FA' }}>{battleTimer.formatTimeRemaining(battle)}</span>
                      </div>

                      {/* Battle Content */}
                      <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          {/* You */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '8px',
                              background: 'linear-gradient(135deg, #B2EBF2 0%, #80DEEA 100%)'
                            }}>
                              <Rocket style={{ height: '32px', width: '32px', color: '#00ACC1' }} />
                            </div>
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>You</div>
                            <div style={{ fontSize: '14px', color: '#6B7280' }}>{user.username}</div>
                          </div>

                          {/* Scores */}
                          <div style={{ flex: 1, margin: '0 32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '12px' }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1F2937' }}>{myGain.toFixed(1)}</div>
                                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>Gain %</div>
                              </div>
                              <div style={{ fontSize: '30px', color: '#9CA3AF' }}>-</div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1F2937' }}>{theirGain.toFixed(1)}</div>
                                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>Gain %</div>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div style={{
                              position: 'relative',
                              height: '12px',
                              background: '#E5E7EB',
                              borderRadius: '9999px',
                              overflow: 'hidden',
                              marginBottom: '8px'
                            }}>
                              <div style={{
                                position: 'absolute',
                                height: '100%',
                                borderRadius: '9999px',
                                transition: 'all 0.3s',
                                width: `${(myValue / (myValue + theirValue)) * 100}%`,
                                background: isWinning ? 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)' : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                              }} />
                            </div>

                            <div style={{
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: isWinning ? '#10B981' : '#EF4444'
                            }}>
                              {isWinning ? `Winning by ${Math.abs(myGain - theirGain).toFixed(1)}%` : `Losing by ${Math.abs(myGain - theirGain).toFixed(1)}%`}
                            </div>
                          </div>

                          {/* Opponent */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: '80px',
                              height: '80px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '8px',
                              background: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)'
                            }}>
                              <Target style={{ height: '32px', width: '32px', color: '#DB2777' }} />
                            </div>
                            <div style={{ fontWeight: '600', color: '#1F2937' }}>{opponent}</div>
                            <div style={{ fontSize: '14px', color: '#6B7280' }}>Opponent</div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setCurrentBattle(battle);
                            setScreen('battle');
                          }}
                          style={{
                            width: '100%',
                            padding: '12px',
                            color: 'white',
                            fontWeight: '600',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }}
                          onMouseEnter={(e) => e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)'}
                          onMouseLeave={(e) => e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'}
                        >
                          View Battle Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Waiting Battles */}
            {waitingBattles.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1F2937' }}>Waiting for Opponent</h2>
                
                {waitingBattles.map(battle => (
                  <div key={battle.id} style={{
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      color: 'white',
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    }}>
                      <span style={{ fontWeight: '600' }}>Waiting for Opponent</span>
                    </div>
                    
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Challenge Code</div>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>{battle.challengeCode}</div>
                        <button
                          onClick={() => copyToClipboard(battle.challengeCode)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            fontSize: '14px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#00BCD4',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = '#F3F4F6'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          <Copy style={{ height: '16px', width: '16px' }} />
                          Copy Code
                        </button>
                      </div>
                      
                      {/* Portfolio Type Badge */}
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        marginBottom: '12px',
                        background: (() => {
                          const firstAsset = battle.creatorPortfolio[0];
                          const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === firstAsset.symbol);
                          return isCrypto ? '#FCE7F3' : '#DBEAFE';
                        })(),
                        border: (() => {
                          const firstAsset = battle.creatorPortfolio[0];
                          const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === firstAsset.symbol);
                          return `2px solid ${isCrypto ? '#EC4899' : '#3B82F6'}`;
                        })(),
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        <span style={{ fontSize: '18px' }}>
                          {(() => {
                            const firstAsset = battle.creatorPortfolio[0];
                            const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === firstAsset.symbol);
                            return isCrypto ? '₿' : '📈';
                          })()}
                        </span>
                        {(() => {
                          const firstAsset = battle.creatorPortfolio[0];
                          const isCrypto = POPULAR_CRYPTO.some(c => c.symbol === firstAsset.symbol);
                          return isCrypto ? 'Crypto Battle' : 'Stocks Battle';
                        })()}
                      </div>
                      
                      <div style={{ fontSize: '14px', color: '#6B7280' }}>
                        Share this code with your opponent to start the battle!
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed Battles */}
            {completedBattles.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px', color: '#1F2937' }}>
                  Completed Battles
                </h2>
                
                {completedBattles.map(battle => {
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
                    <div 
                      key={battle.id}
                      style={{
                        position: 'relative',
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: '16px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        border: won ? '3px solid #10B981' : '3px solid #EF4444'
                      }}
                    >
                      {/* Top Right Buttons */}
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        display: 'flex',
                        gap: '8px'
                      }}>
                        {/* View Matchup Button */}
                        <button
                          onClick={() => {
                            setCurrentBattle(battle);
                            setScreen('battle');
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#00BCD4',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(0, 188, 212, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#00ACC1';
                            e.target.style.boxShadow = '0 4px 8px rgba(0, 188, 212, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#00BCD4';
                            e.target.style.boxShadow = '0 2px 4px rgba(0, 188, 212, 0.3)';
                          }}
                        >
                          View Matchup
                        </button>
                        
                        {/* X Button */}
                        <button
                          onClick={() => archiveBattle(battle.id)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: 'none',
                            background: '#F3F4F6',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            color: '#6B7280'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#E5E7EB';
                            e.target.style.color = '#1F2937';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#F3F4F6';
                            e.target.style.color = '#6B7280';
                          }}
                        >
                          <X style={{ height: '18px', width: '18px' }} />
                        </button>
                      </div>

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
                          color: won ? '#10B981' : '#EF4444'
                        }}>
                          {won ? 'Victory!' : 'Defeat'}
                        </span>
                      </div>
                      
                      {/* Opponent */}
                      <div style={{ marginBottom: '16px', fontSize: '16px', color: '#6B7280' }}>
                        vs. <span style={{ fontWeight: '600', color: '#1F2937', fontSize: '18px' }}>{opponent}</span>
                      </div>
                      
                      {/* Portfolio Name */}
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#6B7280',
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
                          backgroundColor: '#F9FAFB',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '2px solid ' + (userReturn >= 0 ? '#10B981' : '#EF4444')
                        }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontWeight: '600' }}>
                            Your Return
                          </div>
                          <div style={{ 
                            fontSize: '28px', 
                            fontWeight: 'bold',
                            color: userReturn >= 0 ? '#10B981' : '#EF4444'
                          }}>
                            {userReturn >= 0 ? '+' : ''}{userReturn}%
                          </div>
                        </div>
                        
                        <div style={{
                          backgroundColor: '#F9FAFB',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '2px solid ' + (opponentReturn >= 0 ? '#10B981' : '#EF4444')
                        }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontWeight: '600' }}>
                            Their Return
                          </div>
                          <div style={{ 
                            fontSize: '28px', 
                            fontWeight: 'bold',
                            color: opponentReturn >= 0 ? '#10B981' : '#EF4444'
                          }}>
                            {opponentReturn >= 0 ? '+' : ''}{opponentReturn}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Margin */}
                      <div style={{
                        backgroundColor: won ? '#D1FAE5' : '#FEE2E2',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '16px',
                        color: '#1F2937',
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
                        background: 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)',
                        borderRadius: '12px',
                        marginBottom: '12px'
                      }}>
                        <span style={{ fontSize: '24px' }}>⭐</span>
                        <span style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#00BCD4'
                        }}>
                          +{xpEarned} XP Earned
                        </span>
                      </div>
                      
                      {/* Completed Time */}
                      <div style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        color: '#9CA3AF',
                        marginTop: '12px'
                      }}>
                        Completed {battleTimer.formatDate(battle.completedAt || battle.endDate)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stats Section */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px',
              marginBottom: '24px'
            }}>
              {/* Wins */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                padding: '24px',
                textAlign: 'center',
                border: '2px solid #D1FAE5'
              }}>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#10B981', marginBottom: '8px' }}>
                  {user.wins}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#6B7280' }}>
                  Wins
                </div>
              </div>

              {/* Losses */}
              <div style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                padding: '24px',
                textAlign: 'center',
                border: '2px solid #FEE2E2'
              }}>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#EF4444', marginBottom: '8px' }}>
                  {user.losses}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#6B7280' }}>
                  Losses
                </div>
              </div>

              {/* Previous Battles */}
              <button
                onClick={() => {
                  setShowPreviousBattles(true);
                  setScreen('previousBattles');
                }}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '24px',
                  textAlign: 'center',
                  border: '2px solid #E0F7FA',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
              >
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#00BCD4', marginBottom: '8px' }}>
                  {previousBattles.length}
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#6B7280' }}>
                  Previous Battles
                </div>
              </button>
            </div>

            {/* Rank Card */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: '24px',
              border: '2px solid #B2EBF2',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Crown style={{ height: '32px', width: '32px', color: '#00BCD4' }} />
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>Rank: {user.rank}</div>
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>Level {user.level}</div>
                  </div>
                </div>
                <Zap style={{ height: '32px', width: '32px', color: '#10B981' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                  <span>Progress</span>
                  <span style={{ fontWeight: '600' }}>{user.xp} / 10,000 XP</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '12px',
                  background: '#E5E7EB',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    height: '100%',
                    borderRadius: '9999px',
                    transition: 'all 0.3s',
                    width: `${(user.xp / 10000) * 100}%`,
                    background: 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)'
                  }} />
                </div>
                <div style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center' }}>
                  {10000 - user.xp} XP to next rank
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <button
                onClick={() => {
                  setPortfolio([]); setPortfolioType(null);
                  setPortfolioName('');
                  setAssetType('stocks');
                  setSearchTerm('');
                  setScreen('builder');
                }}
                style={{
                  height: '96px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'white',
                  background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              >
                <Plus style={{ height: '24px', width: '24px', marginBottom: '4px' }} />
                Create Game
              </button>
              <button
                onClick={() => {
                  setPortfolio([]); setPortfolioType(null);
                  setPortfolioName('');
                  setAssetType('stocks');
                  setSearchTerm('');
                  setJoinCode('');
                  setScreen('join');
                }}
                style={{
                  height: '96px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'white',
                  background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                }}
              >
                <Swords style={{ height: '24px', width: '24px', marginBottom: '4px' }} />
                Join Game
              </button>
            </div>

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
          background: 'linear-gradient(to bottom, #E0F7FA 0%, #B2EBF2 100%)'
        }}>
          {/* Header */}
          <div style={{
            color: 'white',
            padding: '24px',
            borderBottomLeftRadius: '24px',
            borderBottomRightRadius: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
          }}>
            <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', margin: 0 }}>Build Your Portfolio</h1>
                  <p style={{ fontSize: '14px', color: '#E0F7FA', margin: 0 }}>⚠️ CREATE MODE: Select 7-13 assets • Each 7.5%-20% • Total 100%</p>
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
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <X style={{ height: '20px', width: '20px' }} />
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
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '24px'
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1F2937' }}>Available Assets</h2>
                  
                  {loadingMarketData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                      <Loader2 style={{ height: '32px', width: '32px', color: '#00BCD4', animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <button
                          onClick={() => setAssetType('stocks')}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'stocks' ? {
                              color: 'white',
                              background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            } : {
                              color: '#6B7280',
                              background: '#F3F4F6'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'stocks') e.target.style.background = '#E5E7EB';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'stocks') e.target.style.background = '#F3F4F6';
                          }}
                        >
                          Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'crypto' ? {
                              color: 'white',
                              background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            } : {
                              color: '#6B7280',
                              background: '#F3F4F6'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'crypto') e.target.style.background = '#E5E7EB';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'crypto') e.target.style.background = '#F3F4F6';
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
                          borderColor: searchTerm ? '#00BCD4' : '#E5E7EB',
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
                                  e.target.style.background = '#E0F7FA';
                                  e.target.style.borderColor = '#80DEEA';
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

              {/* Right: Portfolio Summary */}
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
                        borderColor: portfolioName ? '#00BCD4' : (!portfolioName && portfolio.length > 0 ? '#EF4444' : '#E5E7EB'),
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
          background: 'linear-gradient(to bottom, #E0F7FA 0%, #B2EBF2 100%)'
        }}>
          {/* Header */}
          <div style={{
            color: 'white',
            padding: '24px',
            borderBottomLeftRadius: '24px',
            borderBottomRightRadius: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
          }}>
            <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px', margin: 0 }}>Join a Battle</h1>
                  <p style={{ fontSize: '14px', color: '#E0F7FA', margin: 0 }}>✅ JOIN MODE: Enter challenge code and build your portfolio</p>
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
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
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
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1F2937' }}>Challenge Code</h2>
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
                  border: '2px solid',
                  borderColor: joinCode ? '#00BCD4' : '#E5E7EB',
                  borderRadius: '12px',
                  outline: 'none',
                  textTransform: 'uppercase',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              {/* Left: Asset Selection */}
              <div>
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '24px'
                }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px', color: '#1F2937' }}>Available Assets</h2>
                  
                  {loadingMarketData ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                      <Loader2 style={{ height: '32px', width: '32px', color: '#00BCD4', animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (
                    <>
                      {/* Tabs */}
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <button
                          onClick={() => setAssetType('stocks')}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'stocks' ? {
                              color: 'white',
                              background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            } : {
                              color: '#6B7280',
                              background: '#F3F4F6'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'stocks') e.target.style.background = '#E5E7EB';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'stocks') e.target.style.background = '#F3F4F6';
                          }}
                        >
                          Stocks
                        </button>
                        <button
                          onClick={() => setAssetType('crypto')}
                          style={{
                            padding: '8px 24px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            ...(assetType === 'crypto' ? {
                              color: 'white',
                              background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            } : {
                              color: '#6B7280',
                              background: '#F3F4F6'
                            })
                          }}
                          onMouseEnter={(e) => {
                            if (assetType !== 'crypto') e.target.style.background = '#E5E7EB';
                          }}
                          onMouseLeave={(e) => {
                            if (assetType !== 'crypto') e.target.style.background = '#F3F4F6';
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
                          borderColor: searchTerm ? '#00BCD4' : '#E5E7EB',
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
                                  e.target.style.background = '#E0F7FA';
                                  e.target.style.borderColor = '#80DEEA';
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

              {/* Right: Portfolio Summary */}
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
                        borderColor: portfolioName ? '#00BCD4' : (!portfolioName && portfolio.length > 0 ? '#EF4444' : '#E5E7EB'),
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

    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: 'linear-gradient(to bottom, #E0F7FA 0%, #B2EBF2 100%)'
        }}>
          {/* Header */}
          <div style={{
            color: 'white',
            padding: '24px',
            borderBottomLeftRadius: '24px',
            borderBottomRightRadius: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
          }}>
            <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  ← Back
                </button>
                <div style={{ fontSize: '14px', color: '#E0F7FA' }}>
                  {battleTimer.formatTimeRemaining(currentBattle)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ maxWidth: '1536px', margin: '0 auto', padding: '0 24px' }}>
            {/* Battle Header with Scores */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              marginBottom: '24px'
            }}>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* You */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '8px',
                      background: 'linear-gradient(135deg, #B2EBF2 0%, #80DEEA 100%)'
                    }}>
                      <Rocket style={{ height: '32px', width: '32px', color: '#00ACC1' }} />
                    </div>
                    <div style={{ fontWeight: '600', color: '#1F2937' }}>You</div>
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>{user.username}</div>
                  </div>

                  {/* Scores */}
                  <div style={{ flex: 1, margin: '0 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '12px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: myGain >= 0 ? '#10B981' : '#EF4444' }}>
                          {myGain >= 0 ? '+' : ''}{myGain.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: myGain >= 0 ? '#10B981' : '#EF4444', marginTop: '4px' }}>
                          {myGain >= 0 ? '+' : ''}${(myValue - 1000000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                          Portfolio Value: ${myValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div style={{ fontSize: '30px', color: '#9CA3AF' }}>vs</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: theirGain >= 0 ? '#10B981' : '#EF4444' }}>
                          {theirGain >= 0 ? '+' : ''}{theirGain.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: theirGain >= 0 ? '#10B981' : '#EF4444', marginTop: '4px' }}>
                          {theirGain >= 0 ? '+' : ''}${(theirValue - 1000000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                          Portfolio Value: ${theirValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                      position: 'relative',
                      height: '12px',
                      background: '#E5E7EB',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        position: 'absolute',
                        height: '100%',
                        borderRadius: '9999px',
                        transition: 'all 0.3s',
                        width: `${(myValue / (myValue + theirValue)) * 100}%`,
                        background: isWinning ? 'linear-gradient(90deg, #4ADE80 0%, #10B981 100%)' : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                      }} />
                    </div>

                    {/* Winning Status */}
                    <div style={{
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: isWinning ? '#10B981' : '#EF4444'
                    }}>
                      {isWinning 
                        ? `Winning by ${difference.toFixed(1)}% ($${Math.abs(myValue - theirValue).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
                        : `Losing by ${difference.toFixed(1)}% ($${Math.abs(myValue - theirValue).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
                      }
                    </div>
                  </div>

                  {/* Opponent */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '8px',
                      background: 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)'
                    }}>
                      <Target style={{ height: '32px', width: '32px', color: '#DB2777' }} />
                    </div>
                    <div style={{ fontWeight: '600', color: '#1F2937' }}>{opponent}</div>
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>Opponent</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Portfolio Comparison */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '24px' }}>
                {/* Column Headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 2fr',
                  gap: '12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6B7280',
                  textTransform: 'uppercase'
                }}>
                  <div>Your Portfolio</div>
                  <div style={{ textAlign: 'center' }}>WT%</div>
                  <div style={{ textAlign: 'center' }}>Amount</div>
                  <div style={{ textAlign: 'center' }}>RET%</div>
                  <div style={{ textAlign: 'center' }}>RET%</div>
                  <div style={{ textAlign: 'center' }}>Amount</div>
                  <div style={{ textAlign: 'center' }}>WT%</div>
                  <div style={{ textAlign: 'right' }}>Their Portfolio</div>
                </div>

                <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '16px' }}>
                  {/* Portfolio Items */}
                  {myPortfolio.map((myAsset, idx) => {
                    const theirAsset = theirPortfolio[idx] || null;

                    // Get the correct starting price from battle.startingPrices
                    const myStartingPrice = currentBattle.startingPrices?.[myAsset.symbol] || myAsset.price;
                    const myShares = myAsset.amount / myStartingPrice;
                    const myCurrentPrice = battlePrices[myAsset.symbol] || myStartingPrice;
                    const myCurrentValue = myShares * myCurrentPrice;
                    const myGainLoss = myCurrentValue - myAsset.amount;
                    const myReturn = ((myCurrentPrice - myStartingPrice) / myStartingPrice) * 100;
                    const myWeight = (myAsset.amount / 1000000) * 100;

                    let theirWeight = 0;
                    let theirReturn = 0;
                    let theirCurrentValue = 0;
                    let theirGainLoss = 0;
                    let theirCurrentPrice = 0;
                    let theirStartingPrice = 0;
                    if (theirAsset) {
                      theirStartingPrice = currentBattle.startingPrices?.[theirAsset.symbol] || theirAsset.price;
                      const theirShares = theirAsset.amount / theirStartingPrice;
                      theirCurrentPrice = battlePrices[theirAsset.symbol] || theirStartingPrice;
                      theirCurrentValue = theirShares * theirCurrentPrice;
                      theirGainLoss = theirCurrentValue - theirAsset.amount;
                      theirReturn = ((theirCurrentPrice - theirStartingPrice) / theirStartingPrice) * 100;
                      theirWeight = (theirAsset.amount / 1000000) * 100;
                    }

                    return (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 2fr',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '12px 0',
                        borderBottom: '1px solid #F3F4F6'
                      }}>
                        {/* Your Asset */}
                        <div>
                          <div style={{ fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>{myAsset.symbol}</div>
                          <div style={{ fontSize: '11px', color: '#6B7280' }}>
                            Start: ${(currentBattle.startingPrices?.[myAsset.symbol] || myAsset.price).toFixed(2)}
                          </div>
                          <div style={{ 
                            fontSize: '11px',
                            fontWeight: '600',
                            marginTop: '2px',
                            color: myCurrentPrice > (currentBattle.startingPrices?.[myAsset.symbol] || myAsset.price) ? '#10B981' : 
                                   myCurrentPrice < (currentBattle.startingPrices?.[myAsset.symbol] || myAsset.price) ? '#EF4444' : '#6B7280'
                          }}>
                            Now: ${myCurrentPrice.toFixed(2)}
                          </div>
                        </div>

                        {/* Your Weight */}
                        <div style={{ textAlign: 'center', fontWeight: '600', color: '#00BCD4' }}>
                          {myWeight.toFixed(0)}%
                        </div>

                        {/* Your Amount */}
                        <div style={{ textAlign: 'center', fontSize: '13px' }}>
                          <div style={{ fontWeight: '600', color: '#1F2937' }}>
                            ${myAsset.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div style={{ fontSize: '11px', color: myGainLoss >= 0 ? '#10B981' : '#EF4444' }}>
                            {myGainLoss >= 0 ? '+' : ''}${myGainLoss.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>

                        {/* Your Return */}
                        <div style={{
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          color: myReturn >= 0 ? '#10B981' : '#EF4444'
                        }}>
                          {myReturn >= 0 ? <TrendingUp style={{ height: '16px', width: '16px' }} /> : <TrendingDown style={{ height: '16px', width: '16px' }} />}
                          <span style={{ fontWeight: '600' }}>
                            {myReturn >= 0 ? '+' : ''}{myReturn.toFixed(1)}%
                          </span>
                        </div>

                        {/* Their Return */}
                        {theirAsset ? (
                          <>
                            <div style={{
                              textAlign: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              color: theirReturn >= 0 ? '#10B981' : '#EF4444'
                            }}>
                              {theirReturn >= 0 ? <TrendingUp style={{ height: '16px', width: '16px' }} /> : <TrendingDown style={{ height: '16px', width: '16px' }} />}
                              <span style={{ fontWeight: '600' }}>
                                {theirReturn >= 0 ? '+' : ''}{theirReturn.toFixed(1)}%
                              </span>
                            </div>

                            {/* Their Amount */}
                            <div style={{ textAlign: 'center', fontSize: '13px' }}>
                              <div style={{ fontWeight: '600', color: '#1F2937' }}>
                                ${theirAsset.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                              <div style={{ fontSize: '11px', color: theirGainLoss >= 0 ? '#10B981' : '#EF4444' }}>
                                {theirGainLoss >= 0 ? '+' : ''}${theirGainLoss.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            </div>

                            {/* Their Weight */}
                            <div style={{ textAlign: 'center', fontWeight: '600', color: '#DB2777' }}>
                              {theirWeight.toFixed(0)}%
                            </div>

                            {/* Their Asset */}
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>{theirAsset.symbol}</div>
                              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                                Start: ${theirStartingPrice.toFixed(2)}
                              </div>
                              <div style={{ 
                                fontSize: '11px',
                                fontWeight: '600',
                                marginTop: '2px',
                                color: theirCurrentPrice > theirStartingPrice ? '#10B981' : 
                                       theirCurrentPrice < theirStartingPrice ? '#EF4444' : '#6B7280'
                              }}>
                                Now: ${theirCurrentPrice.toFixed(2)}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>-</div>
                            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>-</div>
                            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>-</div>
                            <div style={{ textAlign: 'right', color: '#9CA3AF' }}>-</div>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* If opponent has more assets */}
                  {theirPortfolio.length > myPortfolio.length && (
                    <>
                      {theirPortfolio.slice(myPortfolio.length).map((theirAsset, idx) => {
                        const theirStartingPrice = currentBattle.startingPrices?.[theirAsset.symbol] || theirAsset.price;
                        const theirShares = theirAsset.amount / theirStartingPrice;
                        const theirCurrentPrice = battlePrices[theirAsset.symbol] || theirStartingPrice;
                        const theirCurrentValue = theirShares * theirCurrentPrice;
                        const theirGainLoss = theirCurrentValue - theirAsset.amount;
                        const theirReturn = ((theirCurrentPrice - theirStartingPrice) / theirStartingPrice) * 100;
                        const theirWeight = (theirAsset.amount / 1000000) * 100;

                        return (
                          <div key={`their-${idx}`} style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 2fr',
                            gap: '12px',
                            alignItems: 'center',
                            padding: '12px 0',
                            borderBottom: '1px solid #F3F4F6'
                          }}>
                            <div style={{ color: '#9CA3AF' }}>-</div>
                            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>-</div>
                            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>-</div>
                            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>-</div>
                            <div style={{
                              textAlign: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              color: theirReturn >= 0 ? '#10B981' : '#EF4444'
                            }}>
                              {theirReturn >= 0 ? <TrendingUp style={{ height: '16px', width: '16px' }} /> : <TrendingDown style={{ height: '16px', width: '16px' }} />}
                              <span style={{ fontWeight: '600' }}>
                                {theirReturn >= 0 ? '+' : ''}{theirReturn.toFixed(1)}%
                              </span>
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '13px' }}>
                              <div style={{ fontWeight: '600', color: '#1F2937' }}>
                                ${theirAsset.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                              <div style={{ fontSize: '11px', color: theirGainLoss >= 0 ? '#10B981' : '#EF4444' }}>
                                {theirGainLoss >= 0 ? '+' : ''}${theirGainLoss.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', fontWeight: '600', color: '#DB2777' }}>
                              {theirWeight.toFixed(0)}%
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>{theirAsset.symbol}</div>
                              <div style={{ fontSize: '11px', color: '#6B7280' }}>
                                Start: ${theirStartingPrice.toFixed(2)}
                              </div>
                              <div style={{ 
                                fontSize: '11px',
                                fontWeight: '600',
                                marginTop: '2px',
                                color: theirCurrentPrice > theirStartingPrice ? '#10B981' : 
                                       theirCurrentPrice < theirStartingPrice ? '#EF4444' : '#6B7280'
                              }}>
                                Now: ${theirCurrentPrice.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

  // PREVIOUS BATTLES SCREEN
  if (screen === 'previousBattles') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: 'linear-gradient(to bottom, #E0F7FA 0%, #B2EBF2 100%)'
        }}>
          {/* Header */}
          <div style={{
            color: 'white',
            padding: '24px',
            borderBottomLeftRadius: '24px',
            borderBottomRightRadius: '24px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)'
          }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'white',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
                  onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                  <ChevronDown style={{ height: '20px', width: '20px', transform: 'rotate(90deg)' }} />
                </button>
                <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0 }}>Previous Battles</h1>
              </div>
              <p style={{ color: '#E0F7FA', margin: 0 }}>Review your battle history</p>
            </div>
          </div>

          <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
            {previousBattles.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '48px',
                textAlign: 'center',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                <Trophy style={{ height: '64px', width: '64px', color: '#D1D5DB', margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                  No Previous Battles
                </h3>
                <p style={{ color: '#6B7280' }}>
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
                    background: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#00BCD4',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)'}
                  onMouseLeave={(e) => e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'}
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
                    background: 'linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '16px 24px',
                    marginBottom: '16px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'white',
                    width: '100%',
                    boxShadow: '0 2px 4px rgba(0, 188, 212, 0.3)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.boxShadow = '0 4px 8px rgba(0, 188, 212, 0.4)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.boxShadow = '0 2px 4px rgba(0, 188, 212, 0.3)';
                    e.target.style.transform = 'translateY(0)';
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
                      backgroundColor: 'white',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      border: won ? '3px solid #10B981' : '3px solid #EF4444'
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
                          color: won ? '#10B981' : '#EF4444'
                        }}>
                          {won ? 'Victory!' : 'Defeat'}
                        </span>
                      </div>
                      
                      {/* Opponent */}
                      <div style={{ marginBottom: '16px', fontSize: '16px', color: '#6B7280' }}>
                        vs. <span style={{ fontWeight: '600', color: '#1F2937', fontSize: '18px' }}>{opponent}</span>
                      </div>
                      
                      {/* Portfolio Name */}
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#6B7280',
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
                          backgroundColor: '#F9FAFB',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '2px solid ' + (userReturn >= 0 ? '#10B981' : '#EF4444')
                        }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontWeight: '600' }}>
                            Your Return
                          </div>
                          <div style={{ 
                            fontSize: '28px', 
                            fontWeight: 'bold',
                            color: userReturn >= 0 ? '#10B981' : '#EF4444'
                          }}>
                            {userReturn >= 0 ? '+' : ''}{userReturn}%
                          </div>
                        </div>
                        
                        <div style={{
                          backgroundColor: '#F9FAFB',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '2px solid ' + (opponentReturn >= 0 ? '#10B981' : '#EF4444')
                        }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontWeight: '600' }}>
                            Their Return
                          </div>
                          <div style={{ 
                            fontSize: '28px', 
                            fontWeight: 'bold',
                            color: opponentReturn >= 0 ? '#10B981' : '#EF4444'
                          }}>
                            {opponentReturn >= 0 ? '+' : ''}{opponentReturn}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Margin */}
                      <div style={{
                        backgroundColor: won ? '#D1FAE5' : '#FEE2E2',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '16px',
                        color: '#1F2937',
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
                        background: 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)',
                        borderRadius: '12px',
                        marginBottom: '12px'
                      }}>
                        <span style={{ fontSize: '24px' }}>⭐</span>
                        <span style={{
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#00BCD4'
                        }}>
                          +{xpEarned} XP Earned
                        </span>
                      </div>
                      
                      {/* Completed Time */}
                      <div style={{
                        textAlign: 'center',
                        fontSize: '13px',
                        color: '#9CA3AF',
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
                        background: 'white',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '12px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        border: won ? '2px solid #10B981' : '2px solid #EF4444',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.01)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: '#1F2937'
                        }}>
                          "{battle.portfolioName || 'Unnamed Portfolio'}"
                        </div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: won ? '#10B981' : '#EF4444'
                        }}>
                          {won ? '🏆 Victory' : '💔 Defeat'}
                        </div>
                      </div>
                      <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                        {battleTimer.formatDate(battle.completedAt || battle.archivedAt)}
                      </div>
                      <div style={{ fontSize: '14px', color: '#00BCD4', fontWeight: '600' }}>
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

  return null;
}