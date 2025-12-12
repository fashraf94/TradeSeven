import React, { useState, useEffect } from 'react';
import { loadBattlesSafe, saveBattlesSafe, isSameBattles, loadUser, saveUser } from './services/LocalStorage';
import * as battleTimer from './services/battleTimer';
import * as challengeService from './services/challengeService';
import { stockAPI, POPULAR_STOCKS, POPULAR_CRYPTO, FALLBACK_CRYPTO_PRICES } from './services/stockAPI';
import './firebase/config';
import { motion } from 'framer-motion';

// MarketClash Bull & Bear Logo Component
const MarketClashLogo = ({ size = 'large' }) => {
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
          <path d="M30 5 Q35 15 32 30 Q30 40 35 45"
                stroke="#fbbf24" strokeWidth="6" fill="none" strokeLinecap="round"/>
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
        <tspan fill="#00d9ff">MARKET</tspan><tspan fill="#e6edf3">CLASH</tspan>
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

// =====================================================
// RESEARCH MODE - Data Enrichment Functions
// =====================================================

/**
 * Calculate momentum streak from historical prices
 */
function calculateMomentumStreak(historicalPrices) {
  if (!historicalPrices || historicalPrices.length < 2) {
    return { streak: 0, direction: 'mixed', description: 'No data available', upDays: 0, downDays: 0, totalDays: 0 };
  }

  const recentPrices = historicalPrices.slice(-7);
  let upDays = 0;
  let downDays = 0;
  let currentStreak = 0;
  let streakDirection = null;

  for (let i = 1; i < recentPrices.length; i++) {
    const change = recentPrices[i] - recentPrices[i - 1];
    if (change > 0) {
      upDays++;
      if (streakDirection === 'up' || streakDirection === null) {
        currentStreak++;
        streakDirection = 'up';
      } else {
        currentStreak = 1;
        streakDirection = 'up';
      }
    } else if (change < 0) {
      downDays++;
      if (streakDirection === 'down' || streakDirection === null) {
        currentStreak++;
        streakDirection = 'down';
      } else {
        currentStreak = 1;
        streakDirection = 'down';
      }
    }
  }

  let description;
  if (upDays >= 5) description = `Strong momentum - up ${upDays} of last 7 days`;
  else if (downDays >= 5) description = `Weak momentum - down ${downDays} of last 7 days`;
  else if (currentStreak >= 3 && streakDirection === 'up') description = `${currentStreak}-day winning streak`;
  else if (currentStreak >= 3 && streakDirection === 'down') description = `${currentStreak}-day losing streak`;
  else if (upDays > downDays) description = `Slight upward trend (${upDays}/${recentPrices.length - 1} days up)`;
  else if (downDays > upDays) description = `Slight downward trend (${downDays}/${recentPrices.length - 1} days down)`;
  else description = 'Trading sideways';

  return { streak: currentStreak, direction: streakDirection || 'mixed', upDays, downDays, totalDays: recentPrices.length - 1, description };
}

/**
 * Calculate where current price sits in its 30-day range
 */
function calculateRangePosition(currentPrice, historicalPrices, week52High, week52Low) {
  if (!historicalPrices || historicalPrices.length < 2) {
    return { position30d: 50, label: 'Unknown', nearHigh: false, nearLow: false };
  }

  const min30d = Math.min(...historicalPrices);
  const max30d = Math.max(...historicalPrices);
  const range30d = max30d - min30d;

  let position30d = 50;
  if (range30d > 0) position30d = ((currentPrice - min30d) / range30d) * 100;

  let position52w = 50;
  if (week52High && week52Low && week52High > week52Low) {
    position52w = ((currentPrice - week52Low) / (week52High - week52Low)) * 100;
  }

  let label, nearHigh = false, nearLow = false;
  if (position30d >= 90) { label = 'Near 30-day high'; nearHigh = true; }
  else if (position30d >= 75) label = 'Upper range';
  else if (position30d <= 10) { label = 'Near 30-day low'; nearLow = true; }
  else if (position30d <= 25) label = 'Lower range';
  else label = 'Mid-range';

  return { position30d: Math.round(position30d), position52w: Math.round(position52w), min30d, max30d, label, nearHigh, nearLow };
}

/**
 * Analyze volatility context
 */
function analyzeVolatilityContext(historicalPrices, currentVolatility) {
  if (!historicalPrices || historicalPrices.length < 7) {
    return { level: currentVolatility || 'unknown', vsHistorical: 'normal', avgDailySwing: 0, description: 'Insufficient data' };
  }

  const recentPrices = historicalPrices.slice(-7);
  const recentSwings = [];
  for (let i = 1; i < recentPrices.length; i++) {
    recentSwings.push(Math.abs((recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]) * 100);
  }
  const recentAvgSwing = recentSwings.reduce((a, b) => a + b, 0) / recentSwings.length;

  const allSwings = [];
  for (let i = 1; i < historicalPrices.length; i++) {
    allSwings.push(Math.abs((historicalPrices[i] - historicalPrices[i-1]) / historicalPrices[i-1]) * 100);
  }
  const historicalAvgSwing = allSwings.reduce((a, b) => a + b, 0) / allSwings.length;

  const ratio = recentAvgSwing / historicalAvgSwing;
  let vsHistorical, description;

  if (ratio > 1.5) { vsHistorical = 'elevated'; description = 'More volatile than usual'; }
  else if (ratio > 1.2) { vsHistorical = 'slightly-elevated'; description = 'Slightly more volatile than usual'; }
  else if (ratio < 0.6) { vsHistorical = 'quiet'; description = 'Unusually quiet - could break out'; }
  else if (ratio < 0.8) { vsHistorical = 'slightly-quiet'; description = 'Slightly quieter than usual'; }
  else { vsHistorical = 'normal'; description = 'Normal volatility levels'; }

  return { level: currentVolatility || 'medium', vsHistorical, avgDailySwing: Number(recentAvgSwing.toFixed(2)), historicalAvgSwing: Number(historicalAvgSwing.toFixed(2)), description };
}

/**
 * Calculate relative performance vs category peers
 */
function calculateRelativePerformance(asset, allAssets) {
  if (!allAssets || allAssets.length < 2) {
    return { rank7d: 0, rank30d: 0, totalInCategory: 0, vs7dAvg: 0, vs30dAvg: 0, description: 'Insufficient data' };
  }

  const sorted7d = [...allAssets].sort((a, b) => (b.priceChange7d || 0) - (a.priceChange7d || 0));
  const rank7d = sorted7d.findIndex(a => a.symbol === asset.symbol) + 1;

  const sorted30d = [...allAssets].sort((a, b) => (b.priceChange30d || 0) - (a.priceChange30d || 0));
  const rank30d = sorted30d.findIndex(a => a.symbol === asset.symbol) + 1;

  const avg7d = allAssets.reduce((sum, a) => sum + (a.priceChange7d || 0), 0) / allAssets.length;
  const avg30d = allAssets.reduce((sum, a) => sum + (a.priceChange30d || 0), 0) / allAssets.length;
  const vs7dAvg = (asset.priceChange7d || 0) - avg7d;
  const vs30dAvg = (asset.priceChange30d || 0) - avg30d;

  const totalInCategory = allAssets.length;
  let description;
  if (rank7d <= 3) description = `Top performer - #${rank7d} in category this week`;
  else if (rank7d <= Math.ceil(totalInCategory * 0.25)) description = `Strong performer - top 25% this week`;
  else if (rank7d >= totalInCategory - 2) description = `Lagging - #${rank7d} of ${totalInCategory} this week`;
  else if (vs7dAvg > 2) description = `Outperforming category by ${vs7dAvg.toFixed(1)}%`;
  else if (vs7dAvg < -2) description = `Underperforming category by ${Math.abs(vs7dAvg).toFixed(1)}%`;
  else description = `In line with category average`;

  return { rank7d, rank30d, totalInCategory, vs7dAvg: Number(vs7dAvg.toFixed(2)), vs30dAvg: Number(vs30dAvg.toFixed(2)), avg7d: Number(avg7d.toFixed(2)), avg30d: Number(avg30d.toFixed(2)), description };
}

/**
 * Generate research insights for an asset
 */
function generateResearchInsights(asset) {
  const reasons = [];
  const considerations = [];

  // Momentum insights
  if (asset.momentum?.upDays >= 5) {
    reasons.push({ icon: '📈', text: `Strong momentum - up ${asset.momentum.upDays} of last 7 days` });
  } else if (asset.momentum?.streak >= 3 && asset.momentum?.direction === 'up') {
    reasons.push({ icon: '🔥', text: `${asset.momentum.streak}-day winning streak` });
  }
  if (asset.momentum?.downDays >= 5) {
    considerations.push({ icon: '📉', text: `Weak momentum - down ${asset.momentum.downDays} of last 7 days` });
  }

  // Range insights
  if (asset.rangePosition?.nearLow) {
    reasons.push({ icon: '💰', text: 'Trading near 30-day low - potential value' });
  }
  if (asset.rangePosition?.nearHigh) {
    considerations.push({ icon: '⚠️', text: 'Trading near 30-day high - limited upside?' });
  }

  // Relative performance
  if (asset.relativePerformance?.rank7d <= 3) {
    reasons.push({ icon: '🏆', text: `#${asset.relativePerformance.rank7d} performer in category this week` });
  }
  if (asset.relativePerformance?.vs7dAvg > 3) {
    reasons.push({ icon: '💪', text: `Outperforming category by ${asset.relativePerformance.vs7dAvg.toFixed(1)}%` });
  }
  if (asset.relativePerformance?.vs7dAvg < -3) {
    considerations.push({ icon: '📊', text: `Underperforming category by ${Math.abs(asset.relativePerformance.vs7dAvg).toFixed(1)}%` });
  }

  // Volatility
  if (asset.volatilityContext?.vsHistorical === 'elevated') {
    considerations.push({ icon: '⚡', text: 'More volatile than usual - higher risk/reward' });
  }
  if (asset.volatilityContext?.vsHistorical === 'quiet') {
    considerations.push({ icon: '😴', text: 'Unusually quiet - could break out either direction' });
  }

  // MarketClash stats
  if (asset.communityData?.winRate >= 60) {
    reasons.push({ icon: '🎯', text: `High win rate in MarketClash (${asset.communityData.winRate}%)` });
  }
  if (asset.communityData?.championPick) {
    reasons.push({ icon: '👑', text: `Champion's choice - ${asset.communityData.championPercentage}% of top players pick this` });
  }
  if (asset.communityData?.isHot) {
    reasons.push({ icon: '🔥', text: `Hot pick - ${asset.communityData.picksThisWeek?.toLocaleString()} picks this week` });
  }
  if (asset.communityData?.winRate <= 45 && asset.communityData?.totalBattles > 100) {
    considerations.push({ icon: '📉', text: `Lower win rate in battles (${asset.communityData.winRate}%)` });
  }

  // Performance
  if (asset.priceChange30d > 10) {
    reasons.push({ icon: '📈', text: `Strong 30-day performance (+${asset.priceChange30d.toFixed(1)}%)` });
  } else if (asset.priceChange30d < -10) {
    considerations.push({ icon: '📉', text: `Weak 30-day performance (${asset.priceChange30d.toFixed(1)}%)` });
  }

  return { reasons, considerations };
}

/**
 * Enrich a single asset with research data
 */
function enrichAssetWithResearch(asset, categoryAssets) {
  const momentum = calculateMomentumStreak(asset.historicalPrices);
  const rangePosition = calculateRangePosition(asset.price, asset.historicalPrices, asset.week52High, asset.week52Low);
  const volatilityContext = analyzeVolatilityContext(asset.historicalPrices, asset.volatility);
  const relativePerformance = calculateRelativePerformance(asset, categoryAssets);

  const enrichedAsset = { ...asset, momentum, rangePosition, volatilityContext, relativePerformance };
  const insights = generateResearchInsights(enrichedAsset);

  return { ...enrichedAsset, insights };
}

/**
 * Enrich all assets with research data
 */
function enrichAllAssetsWithResearch(stocksArray, cryptoArray) {
  const enrichedStocks = stocksArray.map(stock => enrichAssetWithResearch(stock, stocksArray));
  const enrichedCrypto = cryptoArray.map(coin => enrichAssetWithResearch(coin, cryptoArray));

  // Add category rankings
  enrichedStocks.sort((a, b) => (b.priceChange7d || 0) - (a.priceChange7d || 0));
  enrichedStocks.forEach((stock, index) => { stock.categoryRank7d = index + 1; });

  enrichedCrypto.sort((a, b) => (b.priceChange7d || 0) - (a.priceChange7d || 0));
  enrichedCrypto.forEach((coin, index) => { coin.categoryRank7d = index + 1; });

  return { stocks: enrichedStocks, crypto: enrichedCrypto };
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
  Settings
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

// Battle History Card Component
const BattleHistoryCard = ({ battle, userId }) => {
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

export default function PortfolioDuel() {
  // ============================================
  // 1. ALL STATE DECLARATIONS
  // ============================================
  const [screen, setScreen] = useState('home');
  const [historyTab, setHistoryTab] = useState('classic'); // 'classic' or 'draft'
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
  const [activeDraftBattles, setActiveDraftBattles] = useState([]);
  const [completedDraftBattles, setCompletedDraftBattles] = useState([]);

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

  // Portfolio Manager Modal state
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);

  // Sidebar navigation state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Game Mode state - Phase 1: Foundation
  // 'classic' = Builder 1v1 (existing gameplay)
  // 'draft' = Snake Draft 4P (new draft mode)
  const [gameMode, setGameMode] = useState('classic');

  // Draft Mode state - Phase 2
  const [currentDraft, setCurrentDraft] = useState(null);
  const [draftJoinCode, setDraftJoinCode] = useState('');

  // Draft Lobby/Room state - Phase 3
  const [draftState, setDraftState] = useState(null);
  const [draftCopied, setDraftCopied] = useState(false);
  const [selectedDraftCategory, setSelectedDraftCategory] = useState('steady');
  const [draftTimeRemaining, setDraftTimeRemaining] = useState(120);

  // Draft Battle state - Phase 4
  const [draftBattleOpponent, setDraftBattleOpponent] = useState(null);

  // Draft Fixes state
  const [activeDraftBanner, setActiveDraftBanner] = useState(null);
  const [autopickCountdown, setAutopickCountdown] = useState(null);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [rosterTouchStart, setRosterTouchStart] = useState(null);
  const [rosterTouchEnd, setRosterTouchEnd] = useState(null);

  // Research Mode state
  const [showResearchMode, setShowResearchMode] = useState(false);
  const [researchAssetType, setResearchAssetType] = useState('stocks');
  const [researchSearchTerm, setResearchSearchTerm] = useState('');
  const [researchSortBy, setResearchSortBy] = useState('rank');
  const [researchExpandedAsset, setResearchExpandedAsset] = useState(null);
  const [researchCompareAssets, setResearchCompareAssets] = useState([]);

  // Weekly Challenges State
  const [showWeeklyChallenges, setShowWeeklyChallenges] = useState(false);
  const [weeklyChallenges, setWeeklyChallenges] = useState([]);
  const [activeDailyChallenge, setActiveDailyChallenge] = useState(null);
  const [challengeProgress, setChallengeProgress] = useState({});
  const [completedWeeklyChallenges, setCompletedWeeklyChallenges] = useState([]);
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [slotMachineRevealed, setSlotMachineRevealed] = useState(false);
  const [expandedChallengeId, setExpandedChallengeId] = useState(null);
  const [showChallengeToast, setShowChallengeToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [challengeHistory, setChallengeHistory] = useState([]);

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
          setShowSlotMachine(true);
          return;
        }

        setWeeklyChallenges(data.challenges || []);
        setActiveDailyChallenge(data.activeDailyChallenge);
        setChallengeProgress(data.progress || {});
        setCompletedWeeklyChallenges(data.completedChallenges || []);

        // Show slot machine if new week and hasn't been shown
        if (!data.slotMachineShown && data.weekStartDate === currentWeekStart) {
          setShowSlotMachine(true);
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
        setShowSlotMachine(true);
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
        setUser({ ...user, xp: newXP });
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
            setUser({ ...user, xp: (user.xp || 0) + xpReward + bonusXP });
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

  // Load weekly challenges when user logs in
  useEffect(() => {
    if (user) {
      loadWeeklyChallenges();
      // Also load challenge history
      const historyKey = `challengeHistory_${user?.odM || user?.username}`;
      const savedHistory = localStorage.getItem(historyKey);
      if (savedHistory) {
        setChallengeHistory(JSON.parse(savedHistory));
      }
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

  // Fetch active draft battles for dashboard
  useEffect(() => {
    if (screen !== 'dashboard') return;

    const fetchActiveDraftBattles = async () => {
      try {
        const currentUserId = user?.odUserId || user?.username;
        if (!currentUserId) return;

        // Query Firebase for draft battles where user is a player
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('./firebase/config');

        const draftsRef = collection(db, 'drafts');

        // Query for battles in progress
        const q = query(
          draftsRef,
          where('status', '==', 'battle')
        );

        const snapshot = await getDocs(q);

        const allBattles = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter locally for user's battles (since array-contains with playerIds can be inconsistent)
        const userBattles = allBattles.filter(b =>
          b.playerIds?.includes(currentUserId) ||
          b.players?.some(p => p.odUserId === currentUserId)
        );

        // Filter out expired battles (past battleEndTime)
        const now = new Date();
        const activeBattles = userBattles.filter(b => {
          if (!b.battleEndTime) return true;
          return new Date(b.battleEndTime) > now;
        });

        // Sort by end time (soonest first)
        activeBattles.sort((a, b) => {
          const aEnd = new Date(a.battleEndTime || 0);
          const bEnd = new Date(b.battleEndTime || 0);
          return aEnd - bEnd;
        });

        setActiveDraftBattles(activeBattles);

        // Check for expired battles that need to be completed
        const expiredBattles = userBattles.filter(b => {
          if (!b.battleEndTime) return false;
          return new Date(b.battleEndTime) <= now;
        });

        if (expiredBattles.length > 0) {
          const draftService = await import('./services/draftService');
          for (const battle of expiredBattles) {
            if (draftService.completeDraftBattle) {
              await draftService.completeDraftBattle(battle.id, battle);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching draft battles:', error);
        setActiveDraftBattles([]);
      }
    };

    fetchActiveDraftBattles();

    // Refresh every 30 seconds
    const refreshInterval = setInterval(fetchActiveDraftBattles, 30000);
    return () => clearInterval(refreshInterval);
  }, [screen, user]);

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
        const formattedBattles = battles
          .map(b => {
            const myStanding = b.finalStandings?.find(s => s.odUserId === currentUserId);
            return {
              ...b,
              isDraft: true,
              won: myStanding?.finalRank === 1,
              myRank: myStanding?.finalRank || 0,
              myGain: myStanding?.finalGain || 0,
              completedAt: b.completedAt?.toDate?.() || new Date(b.completedAt)
            };
          })
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

        setCompletedDraftBattles(formattedBattles);
      } catch (error) {
        console.error('Error fetching completed draft battles:', error);
        setCompletedDraftBattles([]);
      }
    };

    fetchCompletedDraftBattles();
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

  // Check for active draft on dashboard (rejoin functionality)
  useEffect(() => {
    if (screen !== 'dashboard') return;

    const checkActiveDraft = async () => {
      try {
        const draftService = await import('./services/draftService');
        const userId = user?.odUserId || user?.username;

        if (!userId) return;

        const activeDraft = await draftService.getUserActiveDraft(userId);
        setActiveDraftBanner(activeDraft);
      } catch (error) {
        console.error('Error checking active draft:', error);
        setActiveDraftBanner(null);
      }
    };

    checkActiveDraft();

    // Also check periodically in case draft status changes
    const checkInterval = setInterval(checkActiveDraft, 30000);

    return () => clearInterval(checkInterval);
  }, [screen, user]);

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

  // Slot Machine Reveal - New Week Animation
  const SlotMachineOverlay = () => (
    showSlotMachine && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
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
            marginBottom: '32px'
          }}
        >
          Your challenges for this week are...
        </motion.p>

        {/* Slot Reels */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '350px'
        }}>
          {weeklyChallenges.map((challenge, index) => (
            <motion.div
              key={challenge.id}
              initial={{ x: -300, opacity: 0, rotateY: 90 }}
              animate={{ x: 0, opacity: 1, rotateY: 0 }}
              transition={{
                delay: 0.8 + (index * 0.4),
                type: 'spring',
                stiffness: 100,
                damping: 15
              }}
              style={{
                background: `linear-gradient(135deg, ${getGameModeColor(challenge.gameMode)}22, ${colors.cardBg})`,
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
                fontSize: '24px'
              }}>
                {challenge.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
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
                    color: '#000',
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    {challenge.difficulty}
                  </span>
                </div>
                <p style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '12px',
                  margin: 0
                }}>
                  {challenge.slotLabel}
                </p>
              </div>
              <div style={{
                color: getGameModeColor(challenge.gameMode),
                fontWeight: '700',
                fontSize: '14px'
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
          onClick={() => {
            setShowSlotMachine(false);
            setSlotMachineRevealed(true);
            markSlotMachineShown();
          }}
          style={{
            marginTop: '32px',
            background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
            color: '#fff',
            border: 'none',
            padding: '16px 48px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          LET'S GO!
        </motion.button>
      </motion.div>
    )
  );

  // LOGIN SCREEN - Mobile-first responsive with Logo
  if (screen === 'home') {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>

          {/* LOGO ONLY - CENTERED */}
          <div style={{
            marginBottom: '40px',
            textAlign: 'center'
          }}>
            <MarketClashLogo size="large" />
          </div>

          {/* LOGIN FORM */}
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#161b22',
            border: '2px solid #21262d',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>

            {/* Username Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#ffffff',
                marginBottom: '8px'
              }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '14px',
                  backgroundColor: '#0d1117',
                  border: `2px solid ${username ? '#00d9ff' : '#21262d'}`,
                  borderRadius: '8px',
                  color: '#ffffff',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Enter Arena Button */}
            <button
              onClick={handleLogin}
              disabled={!username.trim()}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                color: username.trim() ? '#0d1117' : '#6e7681',
                background: username.trim()
                  ? 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)'
                  : '#21262d',
                border: 'none',
                borderRadius: '8px',
                cursor: username.trim() ? 'pointer' : 'not-allowed',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: username.trim() ? '0 4px 12px rgba(0, 217, 255, 0.3)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              Enter Arena
              <ArrowRight style={{ width: '20px', height: '20px' }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RESEARCH MODE SCREEN
  if (showResearchMode) {
    // Enrich assets with research data
    const { stocks: enrichedStocks, crypto: enrichedCrypto } = enrichAllAssetsWithResearch(stocksData, cryptoData);
    const currentAssets = researchAssetType === 'stocks' ? enrichedStocks : enrichedCrypto;

    // Filter by search term
    const filteredAssets = currentAssets.filter(asset =>
      asset.symbol.toLowerCase().includes(researchSearchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(researchSearchTerm.toLowerCase())
    );

    // Sort assets
    const sortedAssets = [...filteredAssets].sort((a, b) => {
      switch (researchSortBy) {
        case 'rank': return (a.categoryRank7d || 999) - (b.categoryRank7d || 999);
        case '7d': return (b.priceChange7d || 0) - (a.priceChange7d || 0);
        case '30d': return (b.priceChange30d || 0) - (a.priceChange30d || 0);
        case 'winRate': return (b.communityData?.winRate || 0) - (a.communityData?.winRate || 0);
        case 'volatility':
          const volOrder = { high: 3, medium: 2, low: 1 };
          return (volOrder[b.volatility] || 0) - (volOrder[a.volatility] || 0);
        default: return 0;
      }
    });

    // Sparkline component for research cards
    const ResearchSparkline = ({ prices, width = 100, height = 40 }) => {
      if (!prices || prices.length < 2) return null;

      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const range = max - min || 1;

      const points = prices.map((price, i) => {
        const x = (i / (prices.length - 1)) * width;
        const y = height - ((price - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      }).join(' ');

      const isPositive = prices[prices.length - 1] >= prices[0];
      const color = isPositive ? '#10b981' : '#ef4444';

      return (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <defs>
            <linearGradient id={`spark-grad-${isPositive}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill={`url(#spark-grad-${isPositive})`}
          />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    };

    // Handle adding to compare
    const handleAddToCompare = (asset) => {
      if (researchCompareAssets.length >= 3) {
        return; // Max 3 assets
      }
      if (researchCompareAssets.find(a => a.symbol === asset.symbol)) {
        return; // Already added
      }
      setResearchCompareAssets([...researchCompareAssets, asset]);
    };

    const handleRemoveFromCompare = (symbol) => {
      setResearchCompareAssets(researchCompareAssets.filter(a => a.symbol !== symbol));
    };

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: colors.background }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 20
          }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <button
                  onClick={() => {
                    setShowResearchMode(false);
                    setResearchExpandedAsset(null);
                    setResearchCompareAssets([]);
                    setResearchSearchTerm('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: colors.cyan,
                    fontWeight: '600',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain style={{ width: '24px', height: '24px', color: colors.cyan }} />
                  Research Mode
                </h1>
                <div style={{ width: '60px' }}></div>
              </div>

              {/* Asset Type Toggle */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '12px',
                padding: '4px',
                background: '#0d1117',
                borderRadius: '10px'
              }}>
                <button
                  onClick={() => setResearchAssetType('stocks')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: researchAssetType === 'stocks' ? colors.cyan : 'transparent',
                    color: researchAssetType === 'stocks' ? '#000' : '#8b949e',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Stocks ({stocksData.length})
                </button>
                <button
                  onClick={() => setResearchAssetType('crypto')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: researchAssetType === 'crypto' ? colors.cyan : 'transparent',
                    color: researchAssetType === 'crypto' ? '#000' : '#8b949e',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Crypto ({cryptoData.length})
                </button>
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type="text"
                  placeholder="Search by symbol or name..."
                  value={researchSearchTerm}
                  onChange={(e) => setResearchSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <svg
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6e7681' }}
                  width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>

              {/* Sort Options */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'rank', label: 'Top Ranked' },
                  { key: '7d', label: '7D Perf' },
                  { key: '30d', label: '30D Perf' },
                  { key: 'winRate', label: 'Win Rate' },
                  { key: 'volatility', label: 'Volatility' }
                ].map(option => (
                  <button
                    key={option.key}
                    onClick={() => setResearchSortBy(option.key)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: researchSortBy === option.key ? `1px solid ${colors.cyan}` : '1px solid #21262d',
                      background: researchSortBy === option.key ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
                      color: researchSortBy === option.key ? colors.cyan : '#8b949e',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Asset List */}
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px', paddingBottom: researchCompareAssets.length > 0 ? '200px' : '80px' }}>
            {sortedAssets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <p>No assets found matching "{researchSearchTerm}"</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedAssets.map((asset, index) => {
                  const isExpanded = researchExpandedAsset === asset.symbol;
                  const isInCompare = researchCompareAssets.find(a => a.symbol === asset.symbol);
                  const isInPortfolio = portfolio.find(p => p.symbol === asset.symbol);

                  return (
                    <motion.div
                      key={asset.symbol}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      style={{
                        background: '#161b22',
                        border: isExpanded ? `2px solid ${colors.cyan}` : '1px solid #21262d',
                        borderRadius: '16px',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Card Header - Always Visible */}
                      <div
                        onClick={() => setResearchExpandedAsset(isExpanded ? null : asset.symbol)}
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        {/* Rank Badge */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: asset.categoryRank7d <= 3 ? 'rgba(16, 185, 129, 0.2)' : '#21262d',
                          border: asset.categoryRank7d <= 3 ? '1px solid #10b981' : '1px solid #30363d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: asset.categoryRank7d <= 3 ? '#10b981' : '#8b949e',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          #{asset.categoryRank7d || '-'}
                        </div>

                        {/* Asset Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>{asset.symbol}</span>
                            {asset.communityData?.isHot && <span style={{ fontSize: '12px' }}>🔥</span>}
                            {asset.communityData?.championPick && <span style={{ fontSize: '12px' }}>👑</span>}
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {asset.name}
                          </div>
                        </div>

                        {/* Sparkline */}
                        <div style={{ width: '80px', height: '36px' }}>
                          <ResearchSparkline prices={asset.historicalPrices} width={80} height={36} />
                        </div>

                        {/* Price & Change */}
                        <div style={{ textAlign: 'right', minWidth: '90px' }}>
                          <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>
                            ${asset.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{
                            color: (asset.percentChange || 0) >= 0 ? colors.green : colors.red,
                            fontSize: '12px',
                            fontWeight: '500'
                          }}>
                            {(asset.percentChange || 0) >= 0 ? '+' : ''}{(asset.percentChange || 0).toFixed(2)}%
                          </div>
                        </div>

                        {/* Expand Icon */}
                        <div style={{ color: '#6e7681' }}>
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>

                      {/* Quick Badges Row */}
                      <div style={{
                        padding: '0 16px 12px',
                        display: 'flex',
                        gap: '6px',
                        flexWrap: 'wrap'
                      }}>
                        {/* 7D Performance */}
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: (asset.priceChange7d || 0) >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: (asset.priceChange7d || 0) >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          7D: {(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(1)}%
                        </span>

                        {/* 30D Performance */}
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: (asset.priceChange30d || 0) >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: (asset.priceChange30d || 0) >= 0 ? '#10b981' : '#ef4444'
                        }}>
                          30D: {(asset.priceChange30d || 0) >= 0 ? '+' : ''}{(asset.priceChange30d || 0).toFixed(1)}%
                        </span>

                        {/* Win Rate */}
                        {asset.communityData?.winRate && (
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            background: asset.communityData.winRate >= 55 ? 'rgba(0, 217, 255, 0.1)' : '#21262d',
                            color: asset.communityData.winRate >= 55 ? colors.cyan : '#8b949e'
                          }}>
                            🎯 {asset.communityData.winRate}% WR
                          </span>
                        )}

                        {/* Volatility */}
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: asset.volatility === 'high' ? 'rgba(239, 68, 68, 0.1)' : asset.volatility === 'low' ? 'rgba(16, 185, 129, 0.1)' : '#21262d',
                          color: asset.volatility === 'high' ? '#ef4444' : asset.volatility === 'low' ? '#10b981' : '#8b949e'
                        }}>
                          {asset.volatility || 'med'}
                        </span>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{
                            borderTop: '1px solid #21262d',
                            padding: '16px'
                          }}
                        >
                          {/* Why Pick This? */}
                          {asset.insights?.reasons?.length > 0 && (
                            <div style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '12px',
                              padding: '14px',
                              marginBottom: '12px'
                            }}>
                              <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>
                                Why Pick This?
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {asset.insights.reasons.map((reason, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#e6edf3', fontSize: '13px' }}>
                                    <span>{reason.icon}</span>
                                    <span>{reason.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Things to Consider */}
                          {asset.insights?.considerations?.length > 0 && (
                            <div style={{
                              background: 'rgba(251, 191, 36, 0.1)',
                              border: '1px solid rgba(251, 191, 36, 0.3)',
                              borderRadius: '12px',
                              padding: '14px',
                              marginBottom: '12px'
                            }}>
                              <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '13px', marginBottom: '10px' }}>
                                Things to Consider
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {asset.insights.considerations.map((item, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#e6edf3', fontSize: '13px' }}>
                                    <span>{item.icon}</span>
                                    <span>{item.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Detailed Metrics Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '12px',
                            marginBottom: '16px'
                          }}>
                            {/* Range Position */}
                            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '12px' }}>
                              <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '6px' }}>30-DAY RANGE</div>
                              <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                                {asset.rangePosition?.label || 'Unknown'}
                              </div>
                              <div style={{
                                height: '6px',
                                background: '#21262d',
                                borderRadius: '3px',
                                position: 'relative',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  left: `${Math.min(100, Math.max(0, asset.rangePosition?.position30d || 50))}%`,
                                  top: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  background: colors.cyan,
                                  border: '2px solid #161b22'
                                }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#6e7681' }}>
                                <span>Low</span>
                                <span>High</span>
                              </div>
                            </div>

                            {/* Category Rank */}
                            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '12px' }}>
                              <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '6px' }}>CATEGORY RANK</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                <span style={{
                                  color: asset.relativePerformance?.rank7d <= 5 ? '#10b981' : '#ffffff',
                                  fontSize: '24px',
                                  fontWeight: 'bold'
                                }}>
                                  #{asset.relativePerformance?.rank7d || '-'}
                                </span>
                                <span style={{ color: '#6e7681', fontSize: '12px' }}>
                                  of {asset.relativePerformance?.totalInCategory || '-'}
                                </span>
                              </div>
                              <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>
                                {asset.relativePerformance?.description}
                              </div>
                            </div>

                            {/* Volatility Context */}
                            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '12px' }}>
                              <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '6px' }}>VOLATILITY</div>
                              <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', marginBottom: '4px', textTransform: 'capitalize' }}>
                                {asset.volatilityContext?.level || 'Unknown'}
                              </div>
                              <div style={{ color: '#8b949e', fontSize: '11px' }}>
                                {asset.volatilityContext?.description}
                              </div>
                              {asset.volatilityContext?.avgDailySwing > 0 && (
                                <div style={{ color: '#6e7681', fontSize: '10px', marginTop: '4px' }}>
                                  Avg daily: +/-{asset.volatilityContext.avgDailySwing}%
                                </div>
                              )}
                            </div>

                            {/* MarketClash Stats */}
                            <div style={{ background: '#0d1117', borderRadius: '10px', padding: '12px' }}>
                              <div style={{ color: '#8b949e', fontSize: '11px', marginBottom: '6px' }}>MARKETCLASH STATS</div>
                              {asset.communityData ? (
                                <>
                                  <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                                    {asset.communityData.winRate}% Win Rate
                                  </div>
                                  <div style={{ color: '#8b949e', fontSize: '11px' }}>
                                    {asset.communityData.totalBattles?.toLocaleString()} battles
                                  </div>
                                  <div style={{ color: '#6e7681', fontSize: '10px', marginTop: '4px' }}>
                                    {asset.communityData.picksThisWeek?.toLocaleString()} picks this week
                                  </div>
                                </>
                              ) : (
                                <div style={{ color: '#6e7681', fontSize: '12px' }}>No data available</div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isInPortfolio) return;
                                // Add to portfolio with default 10%
                                const newAsset = {
                                  symbol: asset.symbol,
                                  name: asset.name,
                                  price: asset.price,
                                  allocation: 10
                                };
                                setPortfolio([...portfolio, newAsset]);
                                setPortfolioType(researchAssetType);
                              }}
                              disabled={isInPortfolio}
                              style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '10px',
                                border: 'none',
                                background: isInPortfolio ? '#21262d' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: isInPortfolio ? '#6e7681' : '#ffffff',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: isInPortfolio ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              {isInPortfolio ? 'In Portfolio' : '+ Add to Portfolio'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isInCompare) {
                                  handleRemoveFromCompare(asset.symbol);
                                } else {
                                  handleAddToCompare(asset);
                                }
                              }}
                              disabled={!isInCompare && researchCompareAssets.length >= 3}
                              style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                border: isInCompare ? `2px solid ${colors.cyan}` : '2px solid #21262d',
                                background: isInCompare ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
                                color: isInCompare ? colors.cyan : (!isInCompare && researchCompareAssets.length >= 3) ? '#6e7681' : '#8b949e',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: (!isInCompare && researchCompareAssets.length >= 3) ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {isInCompare ? 'Comparing' : 'Compare'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comparison Panel */}
          {researchCompareAssets.length > 0 && (
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: '#161b22',
                borderTop: '2px solid #00d9ff',
                padding: '16px',
                zIndex: 30
              }}
            >
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>
                    Comparing {researchCompareAssets.length}/3 Assets
                  </span>
                  <button
                    onClick={() => setResearchCompareAssets([])}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #ef4444',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${researchCompareAssets.length}, 1fr)`, gap: '12px' }}>
                  {researchCompareAssets.map(asset => (
                    <div key={asset.symbol} style={{
                      background: '#0d1117',
                      borderRadius: '10px',
                      padding: '12px',
                      position: 'relative'
                    }}>
                      <button
                        onClick={() => handleRemoveFromCompare(asset.symbol)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: 'none',
                          background: '#21262d',
                          color: '#8b949e',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px'
                        }}
                      >
                        x
                      </button>
                      <div style={{ fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>{asset.symbol}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8b949e' }}>7D</span>
                          <span style={{ color: (asset.priceChange7d || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8b949e' }}>30D</span>
                          <span style={{ color: (asset.priceChange30d || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {(asset.priceChange30d || 0) >= 0 ? '+' : ''}{(asset.priceChange30d || 0).toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8b949e' }}>Win Rate</span>
                          <span style={{ color: colors.cyan }}>{asset.communityData?.winRate || '-'}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#8b949e' }}>Rank</span>
                          <span style={{ color: '#ffffff' }}>#{asset.categoryRank7d || '-'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
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
        {/* Global Overlays */}
        <ChallengeToast />
        <SlotMachineOverlay />

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

          {/* DESKTOP ONLY: Top Header - Static */}
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

          {/* Active Draft Banner - Show when user has an ongoing draft */}
          {activeDraftBanner && (
            <div
              onClick={() => {
                setCurrentDraft(activeDraftBanner);
                setActiveDraftBanner(null);
                if (activeDraftBanner.status === 'waiting') {
                  setScreen('draftLobby');
                } else if (activeDraftBanner.status === 'active') {
                  setScreen('draftRoom');
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  ⚠️
                </div>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>
                    Active Draft in Progress!
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                    {activeDraftBanner.code} • {activeDraftBanner.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} •
                    {activeDraftBanner.status === 'waiting' ? ' Waiting for players' : ' Draft in progress'}
                  </div>
                </div>
              </div>

              <button
                style={{
                  padding: '10px 20px',
                  background: '#ffffff',
                  color: '#d97706',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                REJOIN →
              </button>
            </div>
          )}

          {/* Dashboard Header with Hamburger Menu and Logo */}
          <header style={{
            background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
            borderBottom: '2px solid #21262d',
            padding: '12px 16px',
            position: 'sticky',
            top: 0,
            zIndex: 40
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>

              {/* Hamburger Menu Button - LEFT */}
              <button
                onClick={() => {
                  console.log('🍔 HAMBURGER CLICKED!');
                  setSidebarOpen(true);
                }}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
                aria-label="Open menu"
              >
                {/* Three horizontal cyan lines */}
                <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }}></div>
                <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }}></div>
                <div style={{ width: '24px', height: '2px', backgroundColor: '#00d9ff', borderRadius: '1px' }}></div>
              </button>

              {/* Center - Logo */}
              <div style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <MarketClashLogo size="small" />
              </div>

              {/* Right Side - User Info */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                fontSize: '12px'
              }}>
                <span style={{
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '13px'
                }}>
                  {user?.username || 'Player'}
                </span>
                <span style={{
                  color: '#8b949e',
                  fontSize: '11px'
                }}>
                  {user?.rank || 'Rookie'}
                </span>
              </div>
            </div>
          </header>

          {/* Game Mode Toggle - Phase 1: Draft Mode Foundation */}
          <div style={{
            background: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '12px 16px'
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <button
                onClick={() => setGameMode('classic')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: gameMode === 'classic' ? '2px solid #00d9ff' : '2px solid #21262d',
                  background: gameMode === 'classic' ? 'rgba(0, 217, 255, 0.1)' : 'transparent',
                  color: gameMode === 'classic' ? '#00d9ff' : '#8b949e',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ⚔️ Builder 1v1
              </button>
              <button
                onClick={() => setGameMode('draft')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: gameMode === 'draft' ? '2px solid #10b981' : '2px solid #21262d',
                  background: gameMode === 'draft' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  color: gameMode === 'draft' ? '#10b981' : '#8b949e',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🐍 Snake Draft 4P
              </button>
            </div>
          </div>

          {/* Main Content Area - Mobile-first with responsive padding */}
          <div
            className="pt-4 md:pt-0 pb-28 md:pb-20 px-4 md:px-6"
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

            {/* Active Draft Battles Section */}
            {activeDraftBattles.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  color: '#10b981',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🐍 Active Draft Battles
                </h3>

                {activeDraftBattles.map(battle => {
                  // Calculate time remaining
                  const endTime = battle.battleEndTime ? new Date(battle.battleEndTime) : null;
                  const now = new Date();
                  let timeRemaining = '';

                  if (endTime) {
                    const diff = endTime - now;
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                    if (days > 0) {
                      timeRemaining = `${days}d ${hours}h left`;
                    } else if (hours > 0) {
                      timeRemaining = `${hours}h ${minutes}m left`;
                    } else {
                      timeRemaining = `${minutes}m left`;
                    }
                  }

                  // Count players
                  const playerCount = battle.players?.length || 4;
                  const humanCount = battle.players?.filter(p => !p.isCPU).length || 1;
                  const cpuCount = playerCount - humanCount;
                  const currentUserId = user?.odUserId || user?.username;

                  return (
                    <div
                      key={battle.id}
                      onClick={() => {
                        setCurrentDraft(battle);
                        setScreen('draftBattle');
                      }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                        border: '2px solid #10b981',
                        borderRadius: '16px',
                        padding: '16px',
                        marginBottom: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Header Row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '24px' }}>🐍</span>
                          <div>
                            <div style={{
                              color: '#10b981',
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}>
                              {battle.code || 'Draft Battle'}
                            </div>
                            <div style={{
                              color: '#8b949e',
                              fontSize: '12px'
                            }}>
                              {battle.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} • {playerCount} Players
                            </div>
                          </div>
                        </div>

                        {/* Time Remaining Badge */}
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          color: '#10b981',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          ⏱️ {timeRemaining}
                        </div>
                      </div>

                      {/* Players Row */}
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '12px',
                        flexWrap: 'wrap'
                      }}>
                        {battle.players?.slice(0, 4).map((player, idx) => {
                          const isMe = player.odUserId === currentUserId;
                          return (
                            <div
                              key={idx}
                              style={{
                                background: isMe ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
                                border: isMe ? '1px solid #00d9ff' : '1px solid #30363d',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                color: isMe ? '#00d9ff' : '#8b949e',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {player.isCPU ? '🤖' : '👤'}
                              {isMe ? 'You' : (player.displayName?.slice(0, 8) || 'Player')}
                            </div>
                          );
                        })}
                      </div>

                      {/* View Battle Button */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{
                          color: '#6e7681',
                          fontSize: '11px'
                        }}>
                          {humanCount} human{humanCount !== 1 ? 's' : ''} • {cpuCount} CPU{cpuCount !== 1 ? 's' : ''}
                        </div>
                        <div style={{
                          color: '#10b981',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          View Battle →
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

            {/* Create & Join Battle Cards - TRUE SIDE-BY-SIDE on all screens */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* CREATE BATTLE Card */}
              {(() => {
                const createColor = gameMode === 'draft' ? '#10b981' : colors.cyan;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    onClick={() => {
                      setPortfolio([]); setPortfolioType(null);
                      setPortfolioName('');
                      setAssetType('stocks');
                      setSearchTerm('');
                      // Route based on game mode
                      if (gameMode === 'draft') {
                        setScreen('draftSetup');  // New screen for draft
                      } else {
                        setScreen('builder');     // Existing classic mode
                      }
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
                      e.currentTarget.style.borderColor = createColor;
                      e.currentTarget.style.boxShadow = `0 0 30px ${createColor}30`;
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
                        linear-gradient(90deg, transparent 0%, ${createColor}20 50%, transparent 100%),
                        repeating-linear-gradient(
                          0deg,
                          transparent,
                          transparent 20px,
                          ${createColor}10 20px,
                          ${createColor}10 21px
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
                      background: `linear-gradient(90deg, ${createColor}10 0%, transparent 100%)`,
                      pointerEvents: 'none'
                    }} />

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                      <Trophy style={{
                        height: hasActiveBattle ? '40px' : '56px',
                        width: hasActiveBattle ? '40px' : '56px',
                        color: createColor,
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
                        {gameMode === 'draft' ? 'Create Draft' : 'Create Battle'}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: '0 0 20px 0'
                      }}>
                        {gameMode === 'draft' ? 'Start a 4-player snake draft.' : 'Start a new battle & set the rules.'}
                      </p>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: gameMode === 'draft' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                        border: gameMode === 'draft' ? 'none' : `2px solid ${createColor}`,
                        borderRadius: '10px',
                        color: gameMode === 'draft' ? '#ffffff' : createColor,
                        fontSize: '14px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        boxShadow: gameMode === 'draft' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
                      }}>
                        {gameMode === 'draft' ? '🐍 CREATE DRAFT' : 'CREATE BATTLE'}
                        {gameMode !== 'draft' && <Plus style={{ height: '16px', width: '16px' }} />}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* JOIN BATTLE Card */}
              {(() => {
                const joinColor = gameMode === 'draft' ? '#10b981' : colors.purple;
                return (
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
                      // Route based on game mode
                      if (gameMode === 'draft') {
                        setScreen('draftJoin');   // New screen for draft join
                      } else {
                        setScreen('join');        // Existing classic mode
                      }
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
                      e.currentTarget.style.borderColor = joinColor;
                      e.currentTarget.style.boxShadow = `0 0 30px ${joinColor}30`;
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
                      border: `3px solid ${joinColor}`,
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
                      border: `2px solid ${joinColor}`,
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
                      background: `linear-gradient(270deg, ${joinColor}10 0%, transparent 100%)`,
                      pointerEvents: 'none'
                    }} />

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                      <Swords style={{
                        height: hasActiveBattle ? '40px' : '56px',
                        width: hasActiveBattle ? '40px' : '56px',
                        color: joinColor,
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
                        {gameMode === 'draft' ? 'Join Draft' : 'Join Battle'}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: '0 0 20px 0'
                      }}>
                        {gameMode === 'draft' ? 'Enter a draft code to join.' : 'Find an open match & compete.'}
                      </p>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: 'transparent',
                        border: `2px solid ${joinColor}`,
                        borderRadius: '10px',
                        color: joinColor,
                        fontSize: '14px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        {gameMode === 'draft' ? '🎯 JOIN DRAFT' : 'JOIN BATTLE'}
                        <ArrowRight style={{ height: '16px', width: '16px' }} />
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
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
                // Route based on game mode
                if (gameMode === 'draft') {
                  setScreen('draftTraining');  // New screen for draft training
                } else {
                  setScreen('training');       // Existing classic mode
                }
              }}
              style={{
                background: gameMode === 'draft'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: gameMode === 'draft' ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
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
                e.currentTarget.style.boxShadow = gameMode === 'draft'
                  ? '0 8px 30px rgba(16, 185, 129, 0.2)'
                  : '0 8px 30px rgba(245, 158, 11, 0.4)';
                if (gameMode === 'draft') {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                if (gameMode === 'draft') {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                }
              }}
            >
              <Brain style={{ height: '28px', width: '28px', color: gameMode === 'draft' ? '#10b981' : colors.background }} />
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: gameMode === 'draft' ? '#10b981' : colors.background,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {gameMode === 'draft' ? '🤖 Training Mode' : 'Training Mode'}
                </span>
                <span style={{
                  fontSize: '14px',
                  color: gameMode === 'draft' ? '#8b949e' : 'rgba(0, 0, 0, 0.7)',
                  marginLeft: '12px'
                }}>
                  Practice your strategy
                </span>
              </div>
              <ArrowRight style={{ height: '20px', width: '20px', color: gameMode === 'draft' ? '#10b981' : colors.background }} />
            </motion.div>

            {/* Research Mode Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              onClick={() => setShowResearchMode(true)}
              style={{
                background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '1px solid rgba(0, 217, 255, 0.3)',
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
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 217, 255, 0.2)';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 217, 255, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)';
                e.currentTarget.style.borderColor = 'rgba(0, 217, 255, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)';
                e.currentTarget.style.borderColor = 'rgba(0, 217, 255, 0.3)';
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(0, 217, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BarChart3 style={{ height: '24px', width: '24px', color: colors.cyan }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: colors.cyan,
                  marginBottom: '2px'
                }}>
                  Research Assets
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#8b949e'
                }}>
                  Analyze stocks & crypto before building your portfolio
                </div>
              </div>
              <ArrowRight style={{ height: '20px', width: '20px', color: colors.cyan }} />
            </motion.div>

            {/* Weekly Challenges Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
              style={{
                marginBottom: '24px',
                background: colors.cardBg,
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div
                onClick={() => setShowWeeklyChallenges(!showWeeklyChallenges)}
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), transparent)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>🎯</span>
                  <div>
                    <h3 style={{
                      color: '#fff',
                      fontSize: '16px',
                      fontWeight: '700',
                      margin: 0
                    }}>
                      Weekly Challenges
                    </h3>
                    <p style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '12px',
                      margin: 0
                    }}>
                      {completedWeeklyChallenges.length}/4 completed • Resets in {getTimeUntilReset().days}d {getTimeUntilReset().hours}h
                    </p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: showWeeklyChallenges ? 180 : 0 }}
                  style={{ color: '#A855F7' }}
                >
                  <ChevronDown size={20} />
                </motion.div>
              </div>

              {/* Expandable Challenge Cards */}
              {showWeeklyChallenges && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '0 16px 16px' }}>
                    {/* Active Challenge Indicator */}
                    {activeDailyChallenge && (
                      <div style={{
                        background: 'rgba(168, 85, 247, 0.2)',
                        border: '1px solid #A855F7',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <Zap size={16} style={{ color: '#A855F7' }} />
                        <span style={{ color: '#fff', fontSize: '13px' }}>
                          Active Today: <strong>{activeDailyChallenge.name}</strong>
                        </span>
                      </div>
                    )}

                    {/* Challenge Cards */}
                    {weeklyChallenges.map((challenge, index) => {
                      const isCompleted = isChallengeCompleted(challenge.id, completedWeeklyChallenges);
                      const isActive = activeDailyChallenge?.id === challenge.id;
                      const isExpanded = expandedChallengeId === challenge.id;
                      const progress = challengeProgress[challenge.id] || 0;
                      const progressPercent = Math.min((progress / challenge.target) * 100, 100);
                      const canAccept = canAcceptChallengeToday(activeDailyChallenge) && !isCompleted;

                      return (
                        <motion.div
                          key={challenge.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          style={{
                            background: isCompleted
                              ? 'rgba(0, 217, 255, 0.1)'
                              : isActive
                                ? 'rgba(168, 85, 247, 0.15)'
                                : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${
                              isCompleted
                                ? '#00d9ff'
                                : isActive
                                  ? '#A855F7'
                                  : colors.borderSubtle
                            }`,
                            borderRadius: '12px',
                            marginBottom: '10px',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Collapsed View */}
                          <div
                            onClick={() => setExpandedChallengeId(isExpanded ? null : challenge.id)}
                            style={{
                              padding: '14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            {/* Icon */}
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '10px',
                              background: `${getGameModeColor(challenge.gameMode)}22`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '20px',
                              flexShrink: 0
                            }}>
                              {isCompleted ? '✅' : challenge.icon}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '4px',
                                flexWrap: 'wrap'
                              }}>
                                <span style={{
                                  color: isCompleted ? '#00d9ff' : '#fff',
                                  fontWeight: '600',
                                  fontSize: '14px'
                                }}>
                                  {challenge.name}
                                </span>
                                <span style={{
                                  background: getGameModeColor(challenge.gameMode),
                                  color: '#000',
                                  fontSize: '9px',
                                  fontWeight: '700',
                                  padding: '2px 5px',
                                  borderRadius: '4px'
                                }}>
                                  {challenge.slotLabel}
                                </span>
                              </div>

                              {/* Mini Progress Bar */}
                              {!isCompleted && (
                                <div style={{
                                  height: '4px',
                                  background: 'rgba(255,255,255,0.1)',
                                  borderRadius: '2px',
                                  overflow: 'hidden'
                                }}>
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    style={{
                                      height: '100%',
                                      background: isActive ? '#A855F7' : getDifficultyColor(challenge.difficulty),
                                      borderRadius: '2px'
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* XP / Status */}
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              {isCompleted ? (
                                <span style={{ color: '#00d9ff', fontSize: '12px', fontWeight: '600' }}>DONE</span>
                              ) : (
                                <span style={{
                                  color: getDifficultyColor(challenge.difficulty),
                                  fontSize: '13px',
                                  fontWeight: '700'
                                }}>
                                  +{challenge.xp}
                                </span>
                              )}
                            </div>

                            {/* Expand Arrow */}
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}
                            >
                              <ChevronDown size={16} />
                            </motion.div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div style={{
                                padding: '0 14px 14px',
                                borderTop: `1px solid ${colors.borderSubtle}`
                              }}>
                                <p style={{
                                  color: 'rgba(255,255,255,0.7)',
                                  fontSize: '13px',
                                  margin: '12px 0',
                                  lineHeight: '1.5'
                                }}>
                                  {challenge.description}
                                </p>

                                {/* Progress Section */}
                                {!isCompleted && (
                                  <div style={{ marginBottom: '12px' }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      marginBottom: '6px'
                                    }}>
                                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Progress</span>
                                      <span style={{ color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                                        {progress} / {challenge.target}
                                      </span>
                                    </div>
                                    <div style={{
                                      height: '8px',
                                      background: 'rgba(255,255,255,0.1)',
                                      borderRadius: '4px',
                                      overflow: 'hidden'
                                    }}>
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.5 }}
                                        style={{
                                          height: '100%',
                                          background: `linear-gradient(90deg, ${getDifficultyColor(challenge.difficulty)}, ${getDifficultyColor(challenge.difficulty)}aa)`,
                                          borderRadius: '4px'
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Difficulty Badge & Accept Button */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}>
                                  <span style={{
                                    background: getDifficultyColor(challenge.difficulty),
                                    color: '#000',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    textTransform: 'uppercase'
                                  }}>
                                    {challenge.difficulty} • {challenge.xp} XP
                                  </span>

                                  {!isCompleted && canAccept && !isActive && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        acceptChallenge(challenge);
                                      }}
                                      style={{
                                        background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      ACCEPT
                                    </motion.button>
                                  )}

                                  {isActive && !isCompleted && (
                                    <span style={{ color: '#A855F7', fontSize: '12px', fontWeight: '600' }}>
                                      <Zap size={14} style={{ marginRight: '4px' }} />ACTIVE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Weekly Bonus Progress */}
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      background: 'rgba(168, 85, 247, 0.1)',
                      borderRadius: '10px',
                      border: '1px solid rgba(168, 85, 247, 0.3)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
                          <Trophy size={14} style={{ marginRight: '6px', color: '#A855F7' }} />
                          Weekly Bonus
                        </span>
                        <span style={{ color: '#A855F7', fontSize: '13px', fontWeight: '700' }}>
                          +{CHALLENGE_XP.weeklyBonus} XP
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[0, 1, 2, 3].map(i => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: '6px',
                              borderRadius: '3px',
                              background: completedWeeklyChallenges.length > i
                                ? '#A855F7'
                                : 'rgba(255,255,255,0.1)'
                            }}
                          />
                        ))}
                      </div>
                      <p style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '11px',
                        margin: '8px 0 0',
                        textAlign: 'center'
                      }}>
                        Complete all 4 challenges for bonus XP!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
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

        {/* Sliding Sidebar - Like Claude.ai */}
        {sidebarOpen && (
          <>
            {/* Backdrop/Overlay */}
            <div
              onClick={() => {
                console.log('🎯 BACKDROP CLICKED - CLOSING SIDEBAR');
                setSidebarOpen(false);
              }}
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
                width: '320px',
                backgroundColor: '#161b22',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 110,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflowY: 'auto'
              }}
            >

              {/* Sidebar Header */}
              <div className="bg-[#0d1117] border-b border-gray-800 p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  <span className="text-cyan-500">Market</span>
                  <span className="text-white">Clash</span>
                </h2>
                <button
                  onClick={() => {
                    console.log('❌ CLOSE BUTTON CLICKED');
                    setSidebarOpen(false);
                  }}
                  className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
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
                    console.log('📜 Battle History clicked');
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
                    console.log('👤 Profile clicked');
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

                {/* DIVIDER */}
                <div style={{ borderTop: '1px solid #374151', margin: '16px 0' }}></div>

                {/* LOGOUT */}
                <button
                  onClick={() => {
                    console.log('🚪 Logout clicked');
                    setUser(null);
                    setScreen('home');
                    localStorage.removeItem('user');
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
      </div>
    );
  }

  // PORTFOLIO BUILDER SCREEN (Create Game)
  if (screen === 'builder') {
    return (
      <div style={containerStyle}>
        <div className="min-h-screen pb-20" style={{ background: colors.background }}>
          {/* Portfolio Builder Header - NO CART BUTTON */}
          <div className="bg-[#161b22] border-b border-gray-800 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">

              {/* Back Button - White text, transparent bg */}
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setScreen('dashboard'); }}
                className="flex items-center gap-2 text-white hover:text-gray-300 font-semibold bg-transparent"
              >
                <span className="text-xl">←</span>
                <span className="text-sm">Back</span>
              </button>

              {/* Centered Title */}
              <h1 className="text-lg font-bold text-center flex-1">Build Portfolio</h1>

              {/* Empty spacer for centering */}
              <div className="w-20"></div>
            </div>
          </div>

          {/* FLOATING CART BUTTON - GUARANTEED TO WORK */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🛒🛒🛒 CART CLICKED!!! 🛒🛒🛒');
              console.log('Portfolio length:', portfolio?.length);
              console.log('showPortfolioManager BEFORE:', showPortfolioManager);
              setShowPortfolioManager(true);
              console.log('Called setShowPortfolioManager(true)');
            }}
            style={{
              position: 'fixed',
              top: '80px',
              right: '16px',
              zIndex: 50,
              width: '56px',
              height: '56px',
              backgroundColor: '#4ade80',
              borderRadius: '12px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              touchAction: 'manipulation'
            }}
            aria-label="View Portfolio"
          >
            {/* Cart Icon - pure SVG */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>

            {/* Red badge */}
            {portfolio && portfolio.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold',
                borderRadius: '50%',
                minWidth: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                border: '2px solid #0d1117'
              }}>
                {portfolio.length}
              </span>
            )}
          </button>

          <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4">
            {/* GAME RULES BOX */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #00d9ff',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '24px' }}>🎮</span>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  margin: 0
                }}>
                  MarketClash Rules
                </h3>
              </div>

              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                color: '#e6edf3',
                fontSize: '14px',
                lineHeight: '1.8'
              }}>
                <li>Build a portfolio with 7-13 assets (stocks or crypto)</li>
                <li>Each asset must be 7.5-20% of your $1M portfolio</li>
                <li>Battles last 24 hours using real market prices</li>
                <li>Winner has the highest portfolio percentage gain</li>
              </ul>
            </div>

            {/* Asset Selection - Full Width (portfolio management in cart modal only) */}
            <div>
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
          </div>
        </div>

        {/* PORTFOLIO MANAGER MODAL - REDESIGNED */}
        {showPortfolioManager && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#0d1117',
            zIndex: 60,
            overflowY: 'auto'
          }}>

            {/* MODAL HEADER */}
            <div style={{
              backgroundColor: '#161b22',
              borderBottom: '1px solid #21262d',
              padding: '16px',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  onClick={() => setShowPortfolioManager(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#00d9ff',
                    fontSize: '14px',
                    fontWeight: '600',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>

                <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                  Your Portfolio
                </h1>

                <div style={{ width: '60px' }}></div>
              </div>
            </div>

            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              padding: '16px',
              paddingBottom: '120px'
            }}>

              {/* PORTFOLIO NAME - AT TOP */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#8b949e',
                  marginBottom: '8px'
                }}>
                  Portfolio Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="Enter portfolio name"
                  style={{
                    width: '100%',
                    backgroundColor: '#161b22',
                    border: portfolioName ? '1px solid #30363d' : '2px solid #ef4444',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {!portfolioName && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>
                    Portfolio name is required
                  </p>
                )}
              </div>

              {/* SUMMARY CARD */}
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#8b949e', fontSize: '14px' }}>
                    {portfolio.length}/13 assets
                  </span>
                  <span style={{
                    color: Math.abs(totalPercentage - 100) < 0.01 ? '#22c55e' : totalPercentage > 100 ? '#ef4444' : '#fbbf24',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}>
                    {totalPercentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#21262d',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, totalPercentage)}%`,
                    backgroundColor: Math.abs(totalPercentage - 100) < 0.01 ? '#22c55e' : totalPercentage > 100 ? '#ef4444' : '#00d9ff',
                    transition: 'all 0.3s ease'
                  }} />
                </div>
              </div>

              {/* ASSETS LIST */}
              {portfolio.length === 0 ? (
                <div style={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '12px',
                  padding: '48px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>📂</div>
                  <p style={{ color: '#8b949e', fontSize: '16px', marginBottom: '8px' }}>
                    No assets selected
                  </p>
                  <p style={{ color: '#6e7681', fontSize: '14px' }}>
                    Go back and add assets to your portfolio
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {portfolio.map((asset, index) => (
                    <AssetWeightCard
                      key={`${asset.symbol}-${index}`}
                      asset={{
                        ...asset,
                        allocation: asset.percentage || ((asset.amount / 1000000) * 100)
                      }}
                      onWeightChange={(newWeight) => {
                        const newAmount = (newWeight / 100) * 1000000;
                        setPortfolio(prev => prev.map(a =>
                          a.symbol === asset.symbol
                            ? { ...a, amount: newAmount, percentage: newWeight }
                            : a
                        ));
                      }}
                      onRemove={() => handleRemoveAsset(asset.symbol)}
                    />
                  ))}
                </div>
              )}

              {/* VALIDATION MESSAGES */}
              {portfolio.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  {portfolio.length < 7 && (
                    <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '4px' }}>
                      • Need at least 7 assets (have {portfolio.length})
                    </p>
                  )}
                  {Math.abs(totalPercentage - 100) >= 0.01 && (
                    <p style={{ color: '#ef4444', fontSize: '13px' }}>
                      • Total must equal 100% (currently {totalPercentage.toFixed(1)}%)
                    </p>
                  )}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                onClick={() => {
                  handleCreateBattle();
                  setShowPortfolioManager(false);
                }}
                disabled={
                  !portfolioName ||
                  portfolio.length < 7 ||
                  portfolio.length > 13 ||
                  Math.abs(totalPercentage - 100) >= 0.01
                }
                style={{
                  width: '100%',
                  backgroundColor: portfolioName && portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01
                    ? '#8b5cf6'
                    : '#21262d',
                  color: portfolioName && portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01
                    ? '#ffffff'
                    : '#6e7681',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: portfolioName && portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01
                    ? 'pointer'
                    : 'not-allowed',
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {!portfolioName
                  ? 'Enter Portfolio Name'
                  : portfolio.length === 0
                  ? 'Add Assets'
                  : portfolio.length < 7
                  ? `Need ${7 - portfolio.length} More Assets`
                  : portfolio.length > 13
                  ? `Remove ${portfolio.length - 13} Assets`
                  : Math.abs(totalPercentage - 100) >= 0.01
                  ? `Adjust to 100% (${totalPercentage.toFixed(1)}%)`
                  : 'Create Battle ⚔️'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // JOIN GAME SCREEN
  if (screen === 'join') {
    return (
      <div style={containerStyle}>
        <div className="min-h-screen pb-20" style={{ background: colors.background }}>
          {/* Join Battle Header - NO CART BUTTON */}
          <div className="bg-[#161b22] border-b border-gray-800 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">

              {/* Back Button - WHITE TEXT */}
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setJoinCode(''); setScreen('dashboard'); }}
                className="flex items-center gap-2 text-white hover:text-gray-300 font-semibold transition-colors bg-transparent"
              >
                <span className="text-xl">←</span>
                <span className="text-sm">Back</span>
              </button>

              {/* Centered Title */}
              <h1 className="text-lg font-bold text-center flex-1">Join Battle</h1>

              {/* Empty spacer for centering */}
              <div className="w-20"></div>
            </div>
          </div>

          {/* FLOATING CART BUTTON - GUARANTEED TO WORK */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🛒🛒🛒 CART CLICKED!!! 🛒🛒🛒');
              console.log('Portfolio length:', portfolio?.length);
              console.log('showPortfolioManager BEFORE:', showPortfolioManager);
              setShowPortfolioManager(true);
              console.log('Called setShowPortfolioManager(true)');
            }}
            style={{
              position: 'fixed',
              top: '80px',
              right: '16px',
              zIndex: 50,
              width: '56px',
              height: '56px',
              backgroundColor: '#4ade80',
              borderRadius: '12px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              touchAction: 'manipulation'
            }}
            aria-label="View Portfolio"
          >
            {/* Cart Icon - pure SVG */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>

            {/* Red badge */}
            {portfolio && portfolio.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold',
                borderRadius: '50%',
                minWidth: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                border: '2px solid #0d1117'
              }}>
                {portfolio.length}
              </span>
            )}
          </button>

          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
            {/* GAME RULES BOX */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #8b5cf6',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '24px' }}>🎮</span>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  margin: 0
                }}>
                  MarketClash Rules
                </h3>
              </div>

              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                color: '#e6edf3',
                fontSize: '14px',
                lineHeight: '1.8'
              }}>
                <li>Build a portfolio with 7-13 assets (stocks or crypto)</li>
                <li>Each asset must be 7.5-20% of your $1M portfolio</li>
                <li>Battles last 24 hours using real market prices</li>
                <li>Winner has the highest portfolio percentage gain</li>
              </ul>
            </div>

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

            {/* Asset Selection - Full Width (portfolio management in cart modal only) */}
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
          </div>
        </div>

        {/* PORTFOLIO MANAGER MODAL - REDESIGNED (Join) */}
        {showPortfolioManager && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#0d1117',
            zIndex: 60,
            overflowY: 'auto'
          }}>

            {/* MODAL HEADER */}
            <div style={{
              backgroundColor: '#161b22',
              borderBottom: '1px solid #21262d',
              padding: '16px',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  onClick={() => setShowPortfolioManager(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#22c55e',
                    fontSize: '14px',
                    fontWeight: '600',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>

                <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff' }}>
                  Your Portfolio
                </h1>

                <div style={{ width: '60px' }}></div>
              </div>
            </div>

            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              padding: '16px',
              paddingBottom: '120px'
            }}>

              {/* PORTFOLIO NAME - AT TOP */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#8b949e',
                  marginBottom: '8px'
                }}>
                  Portfolio Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="Enter portfolio name"
                  style={{
                    width: '100%',
                    backgroundColor: '#161b22',
                    border: portfolioName ? '1px solid #30363d' : '2px solid #ef4444',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#ffffff',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {!portfolioName && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>
                    Portfolio name is required
                  </p>
                )}
              </div>

              {/* SUMMARY CARD */}
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#8b949e', fontSize: '14px' }}>
                    {portfolio.length}/13 assets
                  </span>
                  <span style={{
                    color: Math.abs(totalPercentage - 100) < 0.01 ? '#22c55e' : totalPercentage > 100 ? '#ef4444' : '#fbbf24',
                    fontSize: '18px',
                    fontWeight: 'bold'
                  }}>
                    {totalPercentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#21262d',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, totalPercentage)}%`,
                    backgroundColor: Math.abs(totalPercentage - 100) < 0.01 ? '#22c55e' : totalPercentage > 100 ? '#ef4444' : '#22c55e',
                    transition: 'all 0.3s ease'
                  }} />
                </div>
              </div>

              {/* ASSETS LIST */}
              {portfolio.length === 0 ? (
                <div style={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '12px',
                  padding: '48px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '56px', marginBottom: '16px' }}>📂</div>
                  <p style={{ color: '#8b949e', fontSize: '16px', marginBottom: '8px' }}>
                    No assets selected
                  </p>
                  <p style={{ color: '#6e7681', fontSize: '14px' }}>
                    Go back and add assets to your portfolio
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {portfolio.map((asset, index) => (
                    <AssetWeightCard
                      key={`${asset.symbol}-${index}`}
                      asset={{
                        ...asset,
                        allocation: asset.percentage || ((asset.amount / 1000000) * 100)
                      }}
                      onWeightChange={(newWeight) => {
                        const newAmount = (newWeight / 100) * 1000000;
                        setPortfolio(prev => prev.map(a =>
                          a.symbol === asset.symbol
                            ? { ...a, amount: newAmount, percentage: newWeight }
                            : a
                        ));
                      }}
                      onRemove={() => handleRemoveAsset(asset.symbol)}
                    />
                  ))}
                </div>
              )}

              {/* VALIDATION MESSAGES */}
              {portfolio.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  {!joinCode.trim() && (
                    <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '4px' }}>
                      • Enter a challenge code to join
                    </p>
                  )}
                  {portfolio.length < 7 && (
                    <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '4px' }}>
                      • Need at least 7 assets (have {portfolio.length})
                    </p>
                  )}
                  {Math.abs(totalPercentage - 100) >= 0.01 && (
                    <p style={{ color: '#ef4444', fontSize: '13px' }}>
                      • Total must equal 100% (currently {totalPercentage.toFixed(1)}%)
                    </p>
                  )}
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                onClick={() => {
                  handleJoinBattle();
                  setShowPortfolioManager(false);
                }}
                disabled={
                  !portfolioName ||
                  !joinCode.trim() ||
                  portfolio.length < 7 ||
                  portfolio.length > 13 ||
                  Math.abs(totalPercentage - 100) >= 0.01
                }
                style={{
                  width: '100%',
                  backgroundColor: portfolioName && joinCode.trim() && portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01
                    ? '#22c55e'
                    : '#21262d',
                  color: portfolioName && joinCode.trim() && portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01
                    ? '#000000'
                    : '#6e7681',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: portfolioName && joinCode.trim() && portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01
                    ? 'pointer'
                    : 'not-allowed',
                  marginTop: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {!joinCode.trim()
                  ? 'Enter Challenge Code'
                  : !portfolioName
                  ? 'Enter Portfolio Name'
                  : portfolio.length === 0
                  ? 'Add Assets'
                  : portfolio.length < 7
                  ? `Need ${7 - portfolio.length} More Assets`
                  : portfolio.length > 13
                  ? `Remove ${portfolio.length - 13} Assets`
                  : Math.abs(totalPercentage - 100) >= 0.01
                  ? `Adjust to 100% (${totalPercentage.toFixed(1)}%)`
                  : 'Join Battle ⚔️'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // TRAINING MODE SCREEN
  if (screen === 'training') {
    return (
      <div style={containerStyle}>
        <div className="min-h-screen pb-20" style={{ background: colors.background }}>
          {/* Training Header - NO CART BUTTON */}
          <div className="bg-[#161b22] border-b border-gray-800 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">

              {/* Back Button - WHITE TEXT */}
              <button
                onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setScreen('dashboard'); }}
                className="flex items-center gap-2 text-white hover:text-gray-300 font-semibold transition-colors bg-transparent"
              >
                <span className="text-xl">←</span>
                <span className="text-sm">Back</span>
              </button>

              {/* Centered Title */}
              <h1 className="text-lg font-bold text-center flex-1 flex items-center justify-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Training
              </h1>

              {/* Empty spacer for centering */}
              <div className="w-20"></div>
            </div>
          </div>

          {/* FLOATING CART BUTTON - GUARANTEED TO WORK */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🛒🛒🛒 CART CLICKED!!! 🛒🛒🛒');
              console.log('Portfolio length:', portfolio?.length);
              console.log('showPortfolioManager BEFORE:', showPortfolioManager);
              setShowPortfolioManager(true);
              console.log('Called setShowPortfolioManager(true)');
            }}
            style={{
              position: 'fixed',
              top: '80px',
              right: '16px',
              zIndex: 50,
              width: '56px',
              height: '56px',
              backgroundColor: '#4ade80',
              borderRadius: '12px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              touchAction: 'manipulation'
            }}
            aria-label="View Portfolio"
          >
            {/* Cart Icon - pure SVG */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>

            {/* Red badge */}
            {portfolio && portfolio.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold',
                borderRadius: '50%',
                minWidth: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                border: '2px solid #0d1117'
              }}>
                {portfolio.length}
              </span>
            )}
          </button>

          <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4">
            {/* TRAINING INFO - TWO COLUMNS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
              gap: '16px',
              marginBottom: '24px'
            }}>

              {/* LEFT: HOW TRAINING MODE WORKS */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #8b5cf6',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '24px' }}>🤖</span>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    margin: 0
                  }}>
                    How Training Mode Works
                  </h3>
                </div>

                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: '#e6edf3',
                  fontSize: '14px',
                  lineHeight: '1.8'
                }}>
                  <li>Battle against a randomly-generated CPU opponent</li>
                  <li>Win: +10 XP • Lose: +5 XP (reduced rewards)</li>
                  <li>Does NOT affect your Win/Loss record</li>
                  <li>Perfect for learning and experimenting risk-free!</li>
                </ul>
              </div>

              {/* RIGHT: MARKETCLASH RULES */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #00d9ff',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '24px' }}>🎮</span>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    margin: 0
                  }}>
                    MarketClash Rules
                  </h3>
                </div>

                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: '#e6edf3',
                  fontSize: '14px',
                  lineHeight: '1.8'
                }}>
                  <li>Build a portfolio with 7-13 assets (stocks or crypto)</li>
                  <li>Each asset must be 7.5-20% of your $1M portfolio</li>
                  <li>Battles last 24 hours using real market prices</li>
                  <li>Winner has the highest portfolio percentage gain</li>
                </ul>
              </div>

            </div>

            {/* Asset Selection - Full Width (portfolio management in cart modal only) */}
            <div>
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
          </div>
        </div>

        {/* Portfolio Manager Modal - Full Screen (Training) - REDESIGNED */}
        {showPortfolioManager && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0d1117', zIndex: 60, overflowY: 'auto' }}>
            {/* Header */}
            <div style={{
              background: '#161b22',
              borderBottom: '1px solid #21262d',
              padding: '16px',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setShowPortfolioManager(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#f59e0b',
                    fontWeight: '600',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Back to Assets
                </button>
                <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#e6edf3' }}>Finalize Portfolio</h1>
                <div style={{ width: '100px' }}></div>
              </div>
            </div>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
              {/* Portfolio Name - AT THE TOP */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#e6edf3', marginBottom: '8px' }}>
                  Portfolio Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="Enter a name for your portfolio"
                  style={{
                    width: '100%',
                    background: '#161b22',
                    border: portfolioName.trim() ? '2px solid #21262d' : '2px solid #ef4444',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    color: '#e6edf3',
                    fontSize: '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {!portfolioName.trim() && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>Portfolio name is required</p>
                )}
              </div>

              {/* Portfolio Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, #161b22 0%, #1c2128 100%)',
                border: '2px solid #f59e0b',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#e6edf3' }}>Portfolio Summary</h2>
                  <div style={{
                    background: portfolio.length >= 7 && portfolio.length <= 13 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: portfolio.length >= 7 && portfolio.length <= 13 ? '#10b981' : '#f59e0b',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    {portfolio.length}/13 assets
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#8b949e', fontSize: '13px' }}>Total Allocation</span>
                    <span style={{
                      color: Math.abs(totalPercentage - 100) < 0.01 ? '#10b981' : totalPercentage > 100 ? '#ef4444' : '#f59e0b',
                      fontSize: '14px',
                      fontWeight: '700'
                    }}>
                      {totalPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '10px',
                    background: '#21262d',
                    borderRadius: '5px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(100, totalPercentage)}%`,
                      height: '100%',
                      background: Math.abs(totalPercentage - 100) < 0.01
                        ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                        : totalPercentage > 100
                        ? 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Status Message */}
                {portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01 && portfolioName.trim() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '14px', fontWeight: '600' }}>
                    <span>✓</span>
                    <span>Ready to start training!</span>
                  </div>
                )}
                {portfolio.length < 7 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '14px' }}>
                    <span>⚠️</span>
                    <span>Need {7 - portfolio.length} more asset{7 - portfolio.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Selected Assets with Weight Cards */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#e6edf3', marginBottom: '12px' }}>
                  Adjust Weights
                </h3>

                {portfolio.length === 0 ? (
                  <div style={{
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '16px',
                    padding: '48px 24px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📂</div>
                    <p style={{ color: '#8b949e' }}>No assets selected yet</p>
                    <p style={{ color: '#6e7681', fontSize: '14px', marginTop: '8px' }}>Go back and add assets to your portfolio</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {portfolio.map(asset => (
                      <AssetWeightCard
                        key={asset.symbol}
                        asset={asset}
                        onWeightChange={(newPercentage) => {
                          setPortfolio(prev => prev.map(a =>
                            a.symbol === asset.symbol
                              ? { ...a, amount: (newPercentage / 100) * 1000000, percentage: newPercentage }
                              : a
                          ));
                        }}
                        onRemove={() => handleRemoveAsset(asset.symbol)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '24px' }}>
                <button
                  onClick={() => setShowPortfolioManager(false)}
                  style={{
                    width: '100%',
                    background: '#21262d',
                    color: '#e6edf3',
                    fontWeight: '600',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ← Continue Browsing Assets
                </button>

                <button
                  onClick={() => {
                    handleCreateTrainingBattle();
                    setShowPortfolioManager(false);
                  }}
                  disabled={portfolio.length < 7 || portfolio.length > 13 || Math.abs(totalPercentage - 100) >= 0.01 || !portfolioName.trim()}
                  style={{
                    width: '100%',
                    background: portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01 && portfolioName.trim()
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : '#21262d',
                    color: portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01 && portfolioName.trim()
                      ? '#000000'
                      : '#6e7681',
                    fontWeight: '700',
                    padding: '18px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01 && portfolioName.trim()
                      ? 'pointer'
                      : 'not-allowed',
                    fontSize: '16px',
                    boxShadow: portfolio.length >= 7 && portfolio.length <= 13 && Math.abs(totalPercentage - 100) < 0.01 && portfolioName.trim()
                      ? '0 4px 20px rgba(245, 158, 11, 0.4)'
                      : 'none'
                  }}
                >
                  {portfolio.length < 7
                    ? `Add ${7 - portfolio.length} More Asset${7 - portfolio.length !== 1 ? 's' : ''}`
                    : Math.abs(totalPercentage - 100) >= 0.01
                    ? `Adjust Allocation (${totalPercentage.toFixed(1)}%)`
                    : !portfolioName.trim()
                    ? 'Enter Portfolio Name'
                    : 'Start Training 🎓'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DRAFT SETUP SCREEN - Phase 2
  if (screen === 'draftSetup') {
    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117' }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '2px solid #21262d',
            padding: '16px'
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d9ff',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                Create Draft
              </h1>
              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          {/* Content */}
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                Snake Draft Battle
              </h2>
              <p style={{ color: '#8b949e', fontSize: '16px' }}>
                4 players - 9 picks each - 2 min per pick
              </p>
            </div>

            {/* Draft Type Selection */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                color: '#8b949e',
                fontSize: '14px',
                marginBottom: '12px',
                fontWeight: '600'
              }}>
                Select Asset Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => setAssetType('stocks')}
                  style={{
                    padding: '24px 16px',
                    borderRadius: '12px',
                    border: assetType === 'stocks' ? '2px solid #00d9ff' : '2px solid #21262d',
                    background: assetType === 'stocks' ? 'rgba(0, 217, 255, 0.1)' : '#161b22',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
                  <div style={{
                    color: assetType === 'stocks' ? '#00d9ff' : '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>Stocks</div>
                  <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>75 Assets</div>
                </button>
                <button
                  onClick={() => setAssetType('crypto')}
                  style={{
                    padding: '24px 16px',
                    borderRadius: '12px',
                    border: assetType === 'crypto' ? '2px solid #00d9ff' : '2px solid #21262d',
                    background: assetType === 'crypto' ? 'rgba(0, 217, 255, 0.1)' : '#161b22',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>₿</div>
                  <div style={{
                    color: assetType === 'crypto' ? '#00d9ff' : '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>Crypto</div>
                  <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>75 Assets</div>
                </button>
              </div>
            </div>

            {/* Category Explanation */}
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
                Draft Categories
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#10b981'
                  }}></div>
                  <div>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>Steady</span>
                    <span style={{ color: '#8b949e', marginLeft: '8px' }}>- 3 picks - Blue chips, low volatility</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#f59e0b'
                  }}></div>
                  <div>
                    <span style={{ color: '#f59e0b', fontWeight: '600' }}>Risky</span>
                    <span style={{ color: '#8b949e', marginLeft: '8px' }}>- 3 picks - High growth, high volatility</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#3b82f6'
                  }}></div>
                  <div>
                    <span style={{ color: '#3b82f6', fontWeight: '600' }}>Defensive</span>
                    <span style={{ color: '#8b949e', marginLeft: '8px' }}>- 3 picks - Utilities, stable dividend</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={async () => {
                try {
                  const draftService = await import('./services/draftService');
                  const draft = await draftService.createMultiplayerDraft(
                    user.odUserId || user.username,
                    user.username,
                    assetType
                  );
                  setCurrentDraft(draft);
                  setScreen('draftLobby');
                } catch (error) {
                  console.error('Failed to create draft:', error);
                  alert('Failed to create draft. Please try again.');
                }
              }}
              style={{
                width: '100%',
                padding: '18px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '16px',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              CREATE DRAFT LOBBY
            </button>

            <p style={{ textAlign: 'center', color: '#8b949e', fontSize: '14px' }}>
              Share the code with 3 friends to start
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DRAFT JOIN SCREEN - Phase 2
  if (screen === 'draftJoin') {
    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117' }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '2px solid #21262d',
            padding: '16px'
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d9ff',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                Join Draft
              </h1>
              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          {/* Content */}
          <div style={{ maxWidth: '500px', margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🐍</div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                Enter Draft Code
              </h2>
              <p style={{ color: '#8b949e' }}>
                Get the code from the draft creator
              </p>
            </div>

            <input
              type="text"
              value={draftJoinCode}
              onChange={(e) => setDraftJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g., BULL-1234"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '24px',
                fontWeight: 'bold',
                textAlign: 'center',
                letterSpacing: '4px',
                background: '#161b22',
                border: '2px solid #21262d',
                borderRadius: '12px',
                color: '#ffffff',
                marginBottom: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              maxLength={10}
            />

            <button
              onClick={async () => {
                if (!draftJoinCode.trim()) {
                  alert('Please enter a draft code');
                  return;
                }
                try {
                  const draftService = await import('./services/draftService');
                  const draft = await draftService.joinDraftByCode(
                    draftJoinCode.trim(),
                    user.odUserId || user.username,
                    user.username
                  );
                  setCurrentDraft(draft);
                  setScreen('draftLobby');
                } catch (error) {
                  console.error('Failed to join draft:', error);
                  alert(error.message || 'Failed to join draft');
                }
              }}
              disabled={!draftJoinCode.trim()}
              style={{
                width: '100%',
                padding: '16px',
                background: draftJoinCode.trim()
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#21262d',
                color: draftJoinCode.trim() ? '#ffffff' : '#8b949e',
                fontWeight: 'bold',
                fontSize: '16px',
                border: 'none',
                borderRadius: '12px',
                cursor: draftJoinCode.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              JOIN DRAFT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DRAFT TRAINING SCREEN - Phase 2
  if (screen === 'draftTraining') {
    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117' }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '2px solid #21262d',
            padding: '16px'
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d9ff',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                Draft Training
              </h1>
              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          {/* Content */}
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>🤖</div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                Practice Draft Mode
              </h2>
              <p style={{ color: '#8b949e' }}>
                Play against 3 CPU opponents
              </p>
            </div>

            {/* Type Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={() => setAssetType('stocks')}
                style={{
                  padding: '24px 16px',
                  borderRadius: '12px',
                  border: assetType === 'stocks' ? '2px solid #f59e0b' : '2px solid #21262d',
                  background: assetType === 'stocks' ? 'rgba(245, 158, 11, 0.1)' : '#161b22',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
                <div style={{ color: assetType === 'stocks' ? '#f59e0b' : '#ffffff', fontWeight: 'bold' }}>Stocks</div>
              </button>
              <button
                onClick={() => setAssetType('crypto')}
                style={{
                  padding: '24px 16px',
                  borderRadius: '12px',
                  border: assetType === 'crypto' ? '2px solid #f59e0b' : '2px solid #21262d',
                  background: assetType === 'crypto' ? 'rgba(245, 158, 11, 0.1)' : '#161b22',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>₿</div>
                <div style={{ color: assetType === 'crypto' ? '#f59e0b' : '#ffffff', fontWeight: 'bold' }}>Crypto</div>
              </button>
            </div>

            {/* XP Notice */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid #f59e0b',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <p style={{ color: '#f59e0b', fontSize: '14px', margin: 0 }}>
                Training rewards: +10 XP (win) / +5 XP (loss)
              </p>
            </div>

            <button
              onClick={async () => {
                try {
                  const draftService = await import('./services/draftService');
                  const draft = await draftService.createTrainingDraft(
                    user.odUserId || user.username,
                    user.username,
                    assetType
                  );
                  setCurrentDraft(draft);
                  setScreen('draftRoom');
                } catch (error) {
                  console.error('Failed to create training draft:', error);
                  alert('Failed to start training. Please try again.');
                }
              }}
              style={{
                width: '100%',
                padding: '18px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000000',
                fontWeight: 'bold',
                fontSize: '16px',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              START TRAINING DRAFT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DRAFT LOBBY SCREEN - Phase 3
  if (screen === 'draftLobby') {
    const lobbyDraft = draftState || currentDraft;
    const isHost = lobbyDraft?.hostId === (user.odUserId || user.username);
    const playerCount = lobbyDraft?.players?.length || 0;
    const canStart = playerCount === 4;

    const handleCopyCode = async () => {
      try {
        await navigator.clipboard.writeText(lobbyDraft.code);
        setDraftCopied(true);
        setTimeout(() => setDraftCopied(false), 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    };

    const handleStartDraft = async () => {
      if (!canStart) return;
      try {
        const draftService = await import('./services/draftService');
        await draftService.startDraft(lobbyDraft.id);
      } catch (error) {
        console.error('Failed to start draft:', error);
        alert('Failed to start draft');
      }
    };

    const handleLeaveLobby = async () => {
      try {
        const draftService = await import('./services/draftService');
        if (isHost) {
          await draftService.cancelDraft(lobbyDraft.id);
        } else {
          await draftService.leaveDraft(lobbyDraft.id, user.odUserId || user.username);
        }
        setScreen('dashboard');
      } catch (error) {
        console.error('Failed to leave:', error);
      }
    };

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117' }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '2px solid #21262d',
            padding: '16px'
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  color: '#00d9ff',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                Draft Lobby
              </h1>
              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
            {/* Draft Type Badge */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid #8b5cf6',
                borderRadius: '20px',
                color: '#8b5cf6',
                fontSize: '14px',
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {lobbyDraft?.type} Draft
              </span>
            </div>

            {/* Code Display */}
            <div style={{
              background: '#161b22',
              border: '2px solid #8b5cf6',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              marginBottom: '24px'
            }}>
              <p style={{ color: '#8b949e', marginBottom: '12px', fontSize: '14px' }}>
                Share this code with friends:
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px'
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  letterSpacing: '4px',
                  fontFamily: "'SF Mono', monospace"
                }}>
                  {lobbyDraft?.code}
                </div>
                <button
                  onClick={handleCopyCode}
                  style={{
                    padding: '10px 16px',
                    background: draftCopied ? '#10b981' : 'transparent',
                    border: `2px solid ${draftCopied ? '#10b981' : '#8b5cf6'}`,
                    borderRadius: '8px',
                    color: draftCopied ? '#ffffff' : '#8b5cf6',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {draftCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Players Grid */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#8b949e', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
                Players ({playerCount}/4)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[0, 1, 2, 3].map(index => {
                  const player = lobbyDraft?.players?.[index];
                  const isMe = player?.odUserId === (user.odUserId || user.username);
                  const isPlayerHost = player?.odUserId === lobbyDraft?.hostId;

                  return (
                    <div
                      key={index}
                      style={{
                        background: '#161b22',
                        border: player
                          ? isMe ? '2px solid #00d9ff' : '2px solid #10b981'
                          : '2px dashed #21262d',
                        borderRadius: '12px',
                        padding: '16px 8px',
                        textAlign: 'center'
                      }}
                    >
                      {player ? (
                        <>
                          <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                            {player.isCPU ? '🤖' : '👤'}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: isMe ? '#00d9ff' : '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {isMe ? 'YOU' : player.displayName}
                          </div>
                          {isPlayerHost && (
                            <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>
                              Host
                            </div>
                          )}
                          <div style={{ color: '#10b981', marginTop: '8px' }}>✓</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.3 }}>👤</div>
                          <div style={{ fontSize: '12px', color: '#6e7681' }}>Waiting...</div>
                          <div style={{ color: '#6e7681', marginTop: '8px' }}>○</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isHost ? (
                <button
                  onClick={handleStartDraft}
                  disabled={!canStart}
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: canStart
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                      : '#21262d',
                    color: canStart ? '#ffffff' : '#6e7681',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: canStart ? 'pointer' : 'not-allowed'
                  }}
                >
                  {canStart ? 'START DRAFT' : `Waiting for ${4 - playerCount} more player${4 - playerCount !== 1 ? 's' : ''}...`}
                </button>
              ) : (
                <div style={{
                  padding: '18px',
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  textAlign: 'center',
                  color: '#8b949e'
                }}>
                  Waiting for host to start the draft...
                </div>
              )}

              <button
                onClick={handleLeaveLobby}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  color: '#8b949e',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {isHost ? 'Cancel Draft' : '← Leave Lobby'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DRAFT ROOM SCREEN - Phase 3
  if (screen === 'draftRoom') {
    const roomDraft = draftState || currentDraft;

    // Loading state - Phase 4
    if (!roomDraft) {
      return (
        <div style={containerStyle}>
          <div style={{
            minHeight: '100vh',
            background: '#0d1117',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #21262d',
                borderTop: '4px solid #8b5cf6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <div style={{ color: '#8b949e' }}>Loading draft...</div>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      );
    }

    const currentUserId = user.odUserId || user.username;
    const isMyTurn = roomDraft?.currentPlayerId === currentUserId;
    const myPlayer = roomDraft?.players?.find(p => p.odUserId === currentUserId);
    const currentRound = Math.floor((roomDraft?.currentPickIndex || 0) / 4) + 1;

    const handlePick = async (asset) => {
      if (!isMyTurn) return;
      try {
        const draftService = await import('./services/draftService');
        await draftService.makePick(roomDraft.id, currentUserId, {
          ...asset,
          category: selectedDraftCategory
        });
      } catch (error) {
        console.error('Pick failed:', error);
        alert(error.message || 'Failed to make pick');
      }
    };

    const handleAutopick = async () => {
      try {
        const draftService = await import('./services/draftService');
        await draftService.handleAutopick(roomDraft.id, currentUserId);
      } catch (error) {
        console.error('Autopick failed:', error);
      }
    };

    const getTimerColor = () => {
      if (draftTimeRemaining > 60) return '#10b981';
      if (draftTimeRemaining > 30) return '#f59e0b';
      return '#ef4444';
    };

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const availableAssets = roomDraft?.availableAssets?.[selectedDraftCategory] || [];
    const canPickFromCategory = (cat) => (myPlayer?.categories?.[cat] || 0) < 3;

    // Handle autopick when timer hits 0
    if (draftTimeRemaining === 0 && isMyTurn) {
      handleAutopick();
    }

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', flexDirection: 'column' }}>
          {/* Header - Phase 4: Mobile Polish */}
          <div style={{
            background: '#161b22',
            borderBottom: '2px solid #21262d',
            padding: '12px 16px',
            paddingTop: 'max(12px, env(safe-area-inset-top))',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {/* EXIT BUTTON - Left side */}
              <button
                onClick={() => {
                  if (window.confirm('Leave draft? Your turns will be auto-picked while you\'re away. You can rejoin anytime.')) {
                    setScreen('dashboard');
                  }
                }}
                style={{
                  color: '#8b949e',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ← Exit
              </button>

              {/* Round info - Center */}
              <div style={{ color: '#8b949e', fontSize: '14px' }}>
                Round {currentRound}/9
              </div>

              {/* Timer - Right */}
              <div style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: getTimerColor(),
                fontFamily: "'SF Mono', monospace"
              }}>
                ⏱️ {formatTime(draftTimeRemaining)}
              </div>
            </div>

            {/* Draft Code */}
            <div style={{
              textAlign: 'center',
              marginTop: '4px',
              color: '#6e7681',
              fontSize: '12px'
            }}>
              Code: {roomDraft?.code}
            </div>

            {/* Turn Indicator - Shows last pick OR your turn */}
            <div style={{
              textAlign: 'center',
              marginTop: '8px',
              padding: '8px',
              background: isMyTurn ? 'rgba(0, 217, 255, 0.2)' : 'rgba(139, 92, 246, 0.1)',
              borderRadius: '8px'
            }}>
              {isMyTurn ? (
                <span style={{
                  color: '#00d9ff',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  🎯 YOUR TURN - Pick an asset!
                </span>
              ) : draftState?.lastPick ? (
                <div>
                  <span style={{ color: '#8b949e', fontSize: '13px' }}>
                    {draftState.lastPick.isCPU ? '🤖' : '👤'} {draftState.lastPick.displayName} picked
                  </span>
                  <span style={{
                    color: draftState.lastPick.category === 'steady' ? '#10b981'
                         : draftState.lastPick.category === 'risky' ? '#f59e0b'
                         : '#3b82f6',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginLeft: '8px'
                  }}>
                    {draftState.lastPick.symbol}
                  </span>
                  <span style={{
                    color: '#6e7681',
                    fontSize: '12px',
                    marginLeft: '8px',
                    textTransform: 'capitalize'
                  }}>
                    ({draftState.lastPick.category})
                  </span>
                </div>
              ) : (
                <span style={{ color: '#8b949e', fontSize: '14px' }}>
                  Waiting for {roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId)?.displayName || 'opponent'}...
                </span>
              )}
            </div>

            {/* Autopick Countdown - Draft Fixes */}
            {autopickCountdown !== null && (
              <div style={{
                textAlign: 'center',
                marginTop: '8px',
                padding: '8px 16px',
                background: 'rgba(245, 158, 11, 0.2)',
                borderRadius: '8px',
                color: '#f59e0b',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                🤖 Auto-picking in {autopickCountdown}...
              </div>
            )}
          </div>

          {/* Player Status Cards - 2x2 Grid for mobile */}
          <div style={{
            background: '#161b22',
            padding: '12px 16px',
            borderBottom: '1px solid #21262d'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              marginBottom: '0',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              {roomDraft?.players?.map((player, idx) => {
                const isCurrentPicker = player.odUserId === roomDraft.currentPlayerId;
                const isMe = player.odUserId === currentUserId;

                return (
                  <div
                    key={player.odUserId || idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: isMe ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
                      border: isCurrentPicker
                        ? '2px solid #00d9ff'
                        : isMe
                          ? '1px solid rgba(0, 217, 255, 0.3)'
                          : '1px solid #21262d',
                      textAlign: 'center',
                      position: 'relative',
                      boxShadow: isCurrentPicker ? '0 0 12px rgba(0, 217, 255, 0.3)' : 'none'
                    }}
                  >
                    {/* Current picker indicator */}
                    {isCurrentPicker && (
                      <div style={{
                        position: 'absolute',
                        top: '-8px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#00d9ff',
                        color: '#000',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        PICKING
                      </div>
                    )}

                    {/* Player name row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      marginBottom: '4px'
                    }}>
                      {player.isCPU && <span style={{ fontSize: '12px' }}>🤖</span>}
                      <span style={{
                        color: isMe ? '#00d9ff' : '#ffffff',
                        fontWeight: isMe ? 'bold' : '600',
                        fontSize: '13px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100px'
                      }}>
                        {isMe ? 'YOU' : player.displayName?.slice(0, 10) || `Player ${idx + 1}`}
                      </span>
                      {isCurrentPicker && <span style={{ fontSize: '10px' }}>⭐</span>}
                    </div>

                    {/* Category counts */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '11px'
                    }}>
                      <span style={{ color: '#10b981' }}>S:{player.categories?.steady || 0}</span>
                      <span style={{ color: '#f59e0b' }}>R:{player.categories?.risky || 0}</span>
                      <span style={{ color: '#3b82f6' }}>D:{player.categories?.defensive || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{
            background: '#0d1117',
            padding: '12px 16px',
            borderBottom: '1px solid #21262d'
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              gap: '8px'
            }}>
              {['steady', 'risky', 'defensive'].map(cat => {
                const catColors = {
                  steady: '#10b981',
                  risky: '#f59e0b',
                  defensive: '#3b82f6'
                };
                const count = roomDraft?.availableAssets?.[cat]?.length || 0;
                const userCount = myPlayer?.categories?.[cat] || 0;
                const isFull = userCount >= 3;

                return (
                  <button
                    key={cat}
                    onClick={() => !isFull && setSelectedDraftCategory(cat)}
                    disabled={isFull}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '10px',
                      border: selectedDraftCategory === cat ? `2px solid ${catColors[cat]}` : '2px solid #21262d',
                      background: selectedDraftCategory === cat ? `${catColors[cat]}20` : 'transparent',
                      color: isFull ? '#6e7681' : selectedDraftCategory === cat ? catColors[cat] : '#8b949e',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      opacity: isFull ? 0.5 : 1,
                      textTransform: 'capitalize'
                    }}
                  >
                    {cat} ({count})
                    {isFull && ' ✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset Grid - Phase 4: Mobile Polish */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: '8px'
            }}>
              {availableAssets.map(asset => (
                <button
                  key={asset.symbol}
                  onClick={() => handlePick(asset)}
                  disabled={!isMyTurn || !canPickFromCategory(selectedDraftCategory)}
                  style={{
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '12px',
                    padding: '14px 10px',
                    minHeight: '80px',
                    textAlign: 'center',
                    cursor: isMyTurn && canPickFromCategory(selectedDraftCategory) ? 'pointer' : 'not-allowed',
                    opacity: isMyTurn && canPickFromCategory(selectedDraftCategory) ? 1 : 0.5,
                    transition: 'all 0.2s',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#ffffff',
                    marginBottom: '4px'
                  }}>
                    {asset.symbol}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {asset.name}
                  </div>
                  {isMyTurn && canPickFromCategory(selectedDraftCategory) && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      background: '#00d9ff',
                      color: '#000000',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      borderRadius: '6px'
                    }}>
                      PICK
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Swipeable Portfolio Drawer - Draft Fixes */}
          <div
            onTouchStart={(e) => {
              setRosterTouchEnd(null);
              setRosterTouchStart(e.targetTouches[0].clientY);
            }}
            onTouchMove={(e) => {
              setRosterTouchEnd(e.targetTouches[0].clientY);
            }}
            onTouchEnd={() => {
              if (!rosterTouchStart || !rosterTouchEnd) return;
              const distance = rosterTouchStart - rosterTouchEnd;
              const minSwipeDistance = 50;
              if (distance > minSwipeDistance && !isRosterExpanded) {
                setIsRosterExpanded(true);
              } else if (distance < -minSwipeDistance && isRosterExpanded) {
                setIsRosterExpanded(false);
              }
            }}
            onClick={() => setIsRosterExpanded(!isRosterExpanded)}
            style={{
              background: '#161b22',
              borderTop: '2px solid #21262d',
              position: 'sticky',
              bottom: 0,
              transition: 'all 0.3s ease-out',
              maxHeight: isRosterExpanded ? '70vh' : '80px',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            {/* Drag Handle */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 0 4px 0'
            }}>
              <div style={{
                width: '40px',
                height: '4px',
                background: '#6e7681',
                borderRadius: '2px'
              }} />
            </div>

            {/* Collapsed Header */}
            <div style={{
              padding: '8px 16px 12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📊</span>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>
                  YOUR ROSTER ({myPlayer?.picks?.length || 0}/9)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>
                  {3 - (myPlayer?.categories?.steady || 0)}S, {3 - (myPlayer?.categories?.risky || 0)}R, {3 - (myPlayer?.categories?.defensive || 0)}D needed
                </span>
                <span style={{
                  color: '#8b949e',
                  transform: isRosterExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s'
                }}>
                  ▲
                </span>
              </div>
            </div>

            {/* Expanded Roster View */}
            {isRosterExpanded && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '0 16px 24px 16px',
                  maxWidth: '600px',
                  margin: '0 auto'
                }}
              >
                {/* STEADY Section */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#10b981'
                    }} />
                    <span style={{ color: '#10b981', fontWeight: '600', fontSize: '14px' }}>
                      STEADY ({myPlayer?.categories?.steady || 0}/3)
                    </span>
                    {(myPlayer?.categories?.steady || 0) >= 3 && (
                      <span style={{ color: '#10b981' }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[0, 1, 2].map(slot => {
                      const steadyPicks = myPlayer?.picks?.filter((symbol, idx) =>
                        myPlayer?.pickCategories?.[idx] === 'steady'
                      ) || [];
                      const symbol = steadyPicks[slot];
                      return (
                        <div
                          key={`steady-${slot}`}
                          style={{
                            flex: 1,
                            padding: '12px 8px',
                            background: symbol ? 'rgba(16, 185, 129, 0.1)' : '#0d1117',
                            border: symbol ? '2px solid #10b981' : '2px dashed #21262d',
                            borderRadius: '8px',
                            textAlign: 'center',
                            minHeight: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {symbol ? (
                            <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>
                              {symbol}
                            </span>
                          ) : (
                            <span style={{ color: '#6e7681', fontSize: '20px' }}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RISKY Section */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#f59e0b'
                    }} />
                    <span style={{ color: '#f59e0b', fontWeight: '600', fontSize: '14px' }}>
                      RISKY ({myPlayer?.categories?.risky || 0}/3)
                    </span>
                    {(myPlayer?.categories?.risky || 0) >= 3 && (
                      <span style={{ color: '#f59e0b' }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[0, 1, 2].map(slot => {
                      const riskyPicks = myPlayer?.picks?.filter((symbol, idx) =>
                        myPlayer?.pickCategories?.[idx] === 'risky'
                      ) || [];
                      const symbol = riskyPicks[slot];
                      return (
                        <div
                          key={`risky-${slot}`}
                          style={{
                            flex: 1,
                            padding: '12px 8px',
                            background: symbol ? 'rgba(245, 158, 11, 0.1)' : '#0d1117',
                            border: symbol ? '2px solid #f59e0b' : '2px dashed #21262d',
                            borderRadius: '8px',
                            textAlign: 'center',
                            minHeight: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {symbol ? (
                            <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>
                              {symbol}
                            </span>
                          ) : (
                            <span style={{ color: '#6e7681', fontSize: '20px' }}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DEFENSIVE Section */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#3b82f6'
                    }} />
                    <span style={{ color: '#3b82f6', fontWeight: '600', fontSize: '14px' }}>
                      DEFENSIVE ({myPlayer?.categories?.defensive || 0}/3)
                    </span>
                    {(myPlayer?.categories?.defensive || 0) >= 3 && (
                      <span style={{ color: '#3b82f6' }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[0, 1, 2].map(slot => {
                      const defensivePicks = myPlayer?.picks?.filter((symbol, idx) =>
                        myPlayer?.pickCategories?.[idx] === 'defensive'
                      ) || [];
                      const symbol = defensivePicks[slot];
                      return (
                        <div
                          key={`defensive-${slot}`}
                          style={{
                            flex: 1,
                            padding: '12px 8px',
                            background: symbol ? 'rgba(59, 130, 246, 0.1)' : '#0d1117',
                            border: symbol ? '2px solid #3b82f6' : '2px dashed #21262d',
                            borderRadius: '8px',
                            textAlign: 'center',
                            minHeight: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {symbol ? (
                            <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>
                              {symbol}
                            </span>
                          ) : (
                            <span style={{ color: '#6e7681', fontSize: '20px' }}>—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tap to collapse hint */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '16px',
                  color: '#6e7681',
                  fontSize: '12px'
                }}>
                  Tap or swipe down to collapse
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DRAFT HISTORY SCREEN - Phase 4
  if (screen === 'draftHistory') {
    const [draftHistory, setDraftHistory] = useState([]);
    const [draftStats, setDraftStats] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [selectedHistoryDraft, setSelectedHistoryDraft] = useState(null);

    useEffect(() => {
      const loadHistory = async () => {
        setHistoryLoading(true);
        const draftService = await import('./services/draftService');
        const userId = user.odUserId || user.username;

        const [history, stats] = await Promise.all([
          draftService.getUserDraftHistory(userId),
          draftService.getUserDraftStats(userId)
        ]);

        setDraftHistory(history);
        setDraftStats(stats);
        setHistoryLoading(false);
      };

      loadHistory();
    }, [user]);

    const currentUserId = user.odUserId || user.username;

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117' }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '2px solid #21262d',
            padding: '16px'
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  color: '#00d9ff',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Back
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                Draft History
              </h1>
              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
            {/* Stats Summary */}
            {draftStats && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: '#161b22',
                  border: '1px solid #8b5cf6',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>
                    {draftStats.totalDrafts}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px' }}>Total Drafts</div>
                </div>
                <div style={{
                  background: '#161b22',
                  border: '1px solid #10b981',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                    {draftStats.multiplayerDrafts}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px' }}>Multiplayer</div>
                </div>
                <div style={{
                  background: '#161b22',
                  border: '1px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                    {draftStats.trainingDrafts}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px' }}>Training</div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {historyLoading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                Loading draft history...
              </div>
            )}

            {/* Empty State */}
            {!historyLoading && draftHistory.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                background: '#161b22',
                borderRadius: '16px',
                border: '1px solid #21262d'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>No Drafts Yet</h3>
                <p style={{ color: '#8b949e', marginBottom: '20px' }}>
                  Complete your first draft to see it here!
                </p>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontWeight: '600',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Start a Draft
                </button>
              </div>
            )}

            {/* Draft List */}
            {!historyLoading && draftHistory.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {draftHistory.map(draft => {
                  const myPlayer = draft.players?.find(p => p.odUserId === currentUserId);
                  const completedDate = draft.completedAt?.toDate?.()
                    ? draft.completedAt.toDate().toLocaleDateString()
                    : draft.completedAt
                      ? new Date(draft.completedAt).toLocaleDateString()
                      : 'Unknown date';

                  return (
                    <div
                      key={draft.id}
                      onClick={() => setSelectedHistoryDraft(selectedHistoryDraft?.id === draft.id ? null : draft)}
                      style={{
                        background: '#161b22',
                        border: selectedHistoryDraft?.id === draft.id
                          ? '2px solid #8b5cf6'
                          : '1px solid #21262d',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: selectedHistoryDraft?.id === draft.id ? '16px' : '0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '24px' }}>
                            {draft.isTraining ? '🎯' : '👥'}
                          </span>
                          <div>
                            <div style={{ color: '#ffffff', fontWeight: '600' }}>
                              {draft.code}
                            </div>
                            <div style={{ color: '#8b949e', fontSize: '12px' }}>
                              {draft.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'} • {completedDate}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 10px',
                          background: draft.isTraining
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                          border: `1px solid ${draft.isTraining ? '#f59e0b' : '#10b981'}`,
                          borderRadius: '12px',
                          color: draft.isTraining ? '#f59e0b' : '#10b981',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {draft.isTraining ? 'Training' : 'Multiplayer'}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {selectedHistoryDraft?.id === draft.id && (
                        <div style={{
                          borderTop: '1px solid #21262d',
                          paddingTop: '16px'
                        }}>
                          <div style={{
                            color: '#8b949e',
                            fontSize: '13px',
                            marginBottom: '12px'
                          }}>
                            Your Drafted Portfolio:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {myPlayer?.picks?.map((symbol, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '4px 10px',
                                  background: '#0d1117',
                                  border: '1px solid #21262d',
                                  borderRadius: '6px',
                                  color: '#ffffff',
                                  fontSize: '12px'
                                }}
                              >
                                {symbol}
                              </span>
                            ))}
                          </div>

                          <div style={{
                            color: '#8b949e',
                            fontSize: '13px',
                            marginTop: '16px',
                            marginBottom: '8px'
                          }}>
                            Players: {draft.players?.length || 0}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {draft.players?.map((player, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '4px 10px',
                                  background: player.odUserId === currentUserId
                                    ? 'rgba(0, 217, 255, 0.2)'
                                    : '#0d1117',
                                  border: player.odUserId === currentUserId
                                    ? '1px solid #00d9ff'
                                    : '1px solid #21262d',
                                  borderRadius: '6px',
                                  color: player.odUserId === currentUserId
                                    ? '#00d9ff'
                                    : '#8b949e',
                                  fontSize: '12px'
                                }}
                              >
                                {player.isCPU ? '🤖' : '👤'} {player.displayName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DRAFT RESULTS SCREEN - Phase 3
  if (screen === 'draftResults') {
    // Safety check - if no draft data, show fallback
    if (!currentDraft) {
      return (
        <div style={containerStyle}>
          <div style={{
            minHeight: '100vh',
            background: '#0d1117',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p style={{ color: '#ffffff', fontSize: '18px', marginBottom: '16px' }}>Loading draft results...</p>
            <button
              onClick={() => setScreen('dashboard')}
              style={{
                padding: '12px 24px',
                background: '#00d9ff',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    const draftData = currentDraft;
    const currentUserId = user?.odUserId || user?.username;
    const myPlayer = draftData?.players?.find(p => p.odUserId === currentUserId);

    const handleCreateBattle = async () => {
      if (!myPlayer || !myPlayer.picks || myPlayer.picks.length !== 9) {
        alert('Invalid portfolio from draft');
        return;
      }

      // Convert draft picks to battle portfolio format
      // Each pick gets equal weight: ~11.1% (100% / 9 picks)
      const equalWeight = 100 / 9; // 11.111...

      const battlePortfolio = myPlayer.picks.map(symbol => {
        // Find asset data from draft assets
        const allAssets = [
          ...draftData.availableAssets?.steady || [],
          ...draftData.availableAssets?.risky || [],
          ...draftData.availableAssets?.defensive || []
        ];
        const assetData = allAssets.find(a => a.symbol === symbol) || { symbol, name: symbol };

        return {
          symbol: assetData.symbol,
          name: assetData.name || assetData.symbol,
          percentage: equalWeight
        };
      });

      // Store draft portfolio for battle creation
      setPortfolio(battlePortfolio);
      setPortfolioType(draftData.type); // 'stocks' or 'crypto'
      setPortfolioName(`Draft Portfolio - ${new Date().toLocaleDateString()}`);

      // Navigate to create battle screen with pre-filled portfolio
      setScreen('createBattle');

      // Show info message
      setTimeout(() => {
        alert('Your draft portfolio has been loaded! You can now create a battle or make adjustments.');
      }, 100);
    };

    const handleChallengeDraftOpponent = (opponent) => {
      if (opponent.isCPU) {
        alert('Cannot challenge CPU opponents to multiplayer battles. Start a Training battle instead!');
        return;
      }

      setDraftBattleOpponent(opponent);

      // Create a special draft battle
      const equalWeight = 100 / 9;

      // My portfolio
      const myPortfolio = myPlayer.picks.map(symbol => ({
        symbol,
        percentage: equalWeight,
        amount: (equalWeight / 100) * 1000000
      }));

      // Opponent portfolio
      const opponentPortfolio = opponent.picks.map(symbol => ({
        symbol,
        percentage: equalWeight,
        amount: (equalWeight / 100) * 1000000
      }));

      // Create immediate battle (both portfolios already set)
      const battleId = Date.now().toString();
      const now = new Date();
      const BATTLE_DURATION = battleTimer.TEST_MODE
        ? 5 * 60 * 1000  // 5 minutes in test mode
        : 24 * 60 * 60 * 1000; // 24 hours in production

      const newBattle = {
        id: battleId,
        challengeCode: `DRAFT-${battleId.slice(-4)}`,
        creator: currentUserId,
        opponent: opponent.odUserId,
        creatorPortfolio: myPortfolio,
        opponentPortfolio: opponentPortfolio,
        portfolioName: `Draft Battle - ${draftData.code}`,
        portfolioType: draftData.type,
        status: 'active', // Start immediately since both portfolios are set
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + BATTLE_DURATION).toISOString(),
        isDraftBattle: true,
        draftId: draftData.id,
        draftCode: draftData.code,
        createdAt: now.toISOString()
      };

      // Save battle
      const currentBattles = loadBattlesSafe();
      saveBattlesSafe([...currentBattles, newBattle]);
      setBattles(prev => [...prev, newBattle]);

      // Navigate to dashboard to see the new battle
      setScreen('dashboard');
      setCurrentDraft(null);
    };

    // Static confetti data (no hooks needed)
    const confettiColors = ['#10b981', '#8b5cf6', '#00d9ff', '#f59e0b', '#ffffff'];
    const confettiPieces = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: (i * 3.3) % 100,
      color: confettiColors[i % confettiColors.length],
      delay: (i * 0.1) % 2,
      duration: 2.5 + (i % 3),
      size: 8 + (i % 8)
    }));

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: '#0d1117' }}>
          {/* Celebration Animation Header - CSS Only */}
          <style>{`
            @keyframes confettiFall {
              0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(250px) rotate(360deg); opacity: 0; }
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
            @keyframes fadeIn {
              0% { opacity: 0; transform: translateY(20px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes sparkle {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }
          `}</style>
          <div style={{
            position: 'relative',
            width: '100%',
            padding: '40px 20px',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0d1117 100%)',
            textAlign: 'center'
          }}>
            {/* Confetti pieces - CSS animation only */}
            {confettiPieces.map(piece => (
              <div
                key={piece.id}
                style={{
                  position: 'absolute',
                  left: `${piece.left}%`,
                  top: '-20px',
                  width: `${piece.size}px`,
                  height: `${piece.size}px`,
                  backgroundColor: piece.color,
                  borderRadius: piece.id % 2 === 0 ? '50%' : '2px',
                  pointerEvents: 'none',
                  animation: `confettiFall ${piece.duration}s ease-out ${piece.delay}s infinite`
                }}
              />
            ))}

            {/* Sparkles */}
            <span style={{ position: 'absolute', left: '10%', top: '20px', fontSize: '20px', animation: 'sparkle 1.5s ease-in-out infinite', pointerEvents: 'none' }}>✨</span>
            <span style={{ position: 'absolute', left: '30%', top: '60px', fontSize: '16px', animation: 'sparkle 1.5s ease-in-out infinite 0.3s', pointerEvents: 'none' }}>⭐</span>
            <span style={{ position: 'absolute', left: '70%', top: '30px', fontSize: '18px', animation: 'sparkle 1.5s ease-in-out infinite 0.6s', pointerEvents: 'none' }}>✨</span>
            <span style={{ position: 'absolute', left: '90%', top: '50px', fontSize: '14px', animation: 'sparkle 1.5s ease-in-out infinite 0.9s', pointerEvents: 'none' }}>⭐</span>

            {/* Rocket emojis with bounce */}
            <div style={{
              fontSize: '40px',
              marginBottom: '16px',
              animation: 'bounce 1s ease-in-out infinite',
              position: 'relative',
              zIndex: 10
            }}>
              🚀 🎉 🚀
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: '8px',
              animation: 'fadeIn 0.6s ease-out',
              position: 'relative',
              zIndex: 10
            }}>
              Draft Complete!
            </h1>
            <p style={{
              color: '#8b949e',
              fontSize: '14px',
              animation: 'fadeIn 0.6s ease-out 0.2s both',
              position: 'relative',
              zIndex: 10
            }}>
              All players have made their picks
            </p>
          </div>

          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>
            {/* Your Portfolio */}
            <div style={{
              background: '#161b22',
              border: '2px solid #00d9ff',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h2 style={{ color: '#00d9ff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                Your Portfolio
              </h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {myPlayer?.picks?.map((symbol, i) => (
                  <span key={i} style={{
                    padding: '8px 14px',
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {symbol}
                  </span>
                ))}
              </div>
            </div>

            {/* Challenge an Opponent - Phase 4 */}
            {!draftData?.isTraining && (
              <div style={{
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                  Challenge an Opponent
                </h2>
                <p style={{ color: '#8b949e', fontSize: '13px', marginBottom: '16px' }}>
                  Start a head-to-head battle using your drafted portfolios
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {draftData?.players?.filter(p => p.odUserId !== currentUserId).map((player) => {
                    return (
                      <div
                        key={player.odUserId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: '#0d1117',
                          borderRadius: '8px',
                          border: '1px solid #21262d'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{player.isCPU ? '🤖' : '👤'}</span>
                          <div>
                            <div style={{ color: '#ffffff', fontWeight: '600' }}>
                              {player.displayName}
                            </div>
                            <div style={{ color: '#8b949e', fontSize: '12px' }}>
                              {player.picks?.length || 0} assets drafted
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleChallengeDraftOpponent(player)}
                          disabled={player.isCPU}
                          style={{
                            padding: '8px 16px',
                            background: player.isCPU
                              ? '#21262d'
                              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: player.isCPU ? '#6e7681' : '#ffffff',
                            fontWeight: '600',
                            fontSize: '13px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: player.isCPU ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {player.isCPU ? '🤖 CPU' : 'Challenge'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Players Summary */}
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h2 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                All Portfolios
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {draftData?.players?.map((player) => {
                  const isMe = player.odUserId === currentUserId;
                  return (
                    <div
                      key={player.odUserId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        background: isMe ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
                        borderRadius: '8px',
                        border: isMe ? '1px solid #00d9ff' : '1px solid #21262d'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{player.isCPU ? '🤖' : '👤'}</span>
                        <span style={{ color: isMe ? '#00d9ff' : '#ffffff', fontWeight: '600' }}>
                          {isMe ? 'You' : player.displayName}
                        </span>
                      </div>
                      <div style={{ color: '#8b949e', fontSize: '13px' }}>
                        {player.picks?.length || 0} picks
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Battle Status Banner - show when draft is in battle mode */}
            {draftData?.status === 'battle' && (
              <div style={{
                background: 'transparent',
                border: '2px solid #8b5cf6',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {draftData.type === 'stocks' ? '📈' : '🪙'}
                </div>
                <div style={{ color: '#8b5cf6', fontWeight: 'bold', fontSize: '20px', marginBottom: '8px' }}>
                  BATTLE IN PROGRESS
                </div>
                <div style={{ color: '#8b949e', fontSize: '14px', marginBottom: '12px' }}>
                  {draftData.type === 'stocks'
                    ? 'Battle ends Friday at 3 PM CT'
                    : `Battle ends ${new Date(draftData.battleEndTime).toLocaleDateString()} at ${new Date(draftData.battleEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  }
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '16px',
                  fontSize: '13px',
                  color: '#8b949e'
                }}>
                  <span>Free Agents: {Object.values(draftData.freeAgents || {}).flat().length}</span>
                  <span>|</span>
                  <span>Swaps: {draftData.swapHistory?.length || 0}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Battle Mode Buttons - show when in battle mode */}
              {draftData?.status === 'battle' && (
                <>
                  {/* View Battle Standings - Primary CTA */}
                  <button
                    onClick={() => setScreen('draftBattle')}
                    style={{
                      width: '100%',
                      padding: '18px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <span>📊</span> View Battle Standings
                  </button>

                  {/* Free Agency Button */}
                  <button
                    onClick={() => setScreen('freeAgency')}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: 'transparent',
                      color: '#8b5cf6',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      border: '2px solid #8b5cf6',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>🔄</span> Free Agency
                  </button>
                </>
              )}

              {!draftData?.isTraining && draftData?.status !== 'battle' && (
                <button
                  onClick={handleCreateBattle}
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer'
                  }}
                >
                  CREATE BATTLE WITH PORTFOLIO
                </button>
              )}

              <button
                onClick={() => {
                  setCurrentDraft(null);
                  setScreen('dashboard');
                }}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'transparent',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  color: '#8b949e',
                  cursor: 'pointer'
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DRAFT BATTLE VIEW SCREEN - ESPN-style 4-player layout
  if (screen === 'draftBattle') {
    const DraftBattleScreen = () => {
      const [standings, setStandings] = useState([]);
      const [expandedCards, setExpandedCards] = useState({});
      const [loading, setLoading] = useState(true);
      const [timeRemaining, setTimeRemaining] = useState('');
      const [assetComparison, setAssetComparison] = useState(null);

      const currentUserId = user?.odUserId || user?.username;
      const battleType = currentDraft?.type || 'stocks';

      // Calculate standings from draft data
      useEffect(() => {
        const calculateStandings = async () => {
          if (!currentDraft?.players) {
            setLoading(false);
            return;
          }

          setLoading(true);

          try {
            const stockAPI = await import('./services/stockAPI');

            // Calculate each player's performance
            const playerPerformances = await Promise.all(
              currentDraft.players.map(async (player) => {
                let totalGain = 0;
                const portfolioWithGains = [];

                for (const symbol of player.picks || []) {
                  try {
                    // Get current price
                    const priceData = battleType === 'stocks'
                      ? await stockAPI.getStockPrice(symbol)
                      : await stockAPI.getCryptoPrice(symbol);

                    const currentPrice = priceData?.price || 0;

                    // Get locked price (from draft completion)
                    const lockedPrice = currentDraft.lockedPrices?.[symbol] || currentPrice;

                    const gain = lockedPrice > 0
                      ? ((currentPrice - lockedPrice) / lockedPrice) * 100
                      : 0;

                    portfolioWithGains.push({
                      symbol,
                      gain: parseFloat(gain.toFixed(2)),
                      lockedPrice,
                      currentPrice
                    });

                    // Equal weight (11.1% each)
                    totalGain += gain / 9;
                  } catch (err) {
                    console.error(`Error fetching ${symbol}:`, err);
                    portfolioWithGains.push({ symbol, gain: 0, lockedPrice: 0, currentPrice: 0 });
                  }
                }

                // Find best and worst assets
                const sorted = [...portfolioWithGains].sort((a, b) => b.gain - a.gain);

                return {
                  odUserId: player.odUserId,
                  displayName: player.displayName,
                  isMe: player.odUserId === currentUserId,
                  isCPU: player.isCPU || false,
                  totalGain: parseFloat(totalGain.toFixed(2)),
                  portfolio: portfolioWithGains,
                  bestAsset: sorted[0] || { symbol: '-', gain: 0 },
                  worstAsset: sorted[sorted.length - 1] || { symbol: '-', gain: 0 },
                  previousRank: player.previousRank || 0
                };
              })
            );

            // Sort by total gain (descending)
            const sorted = playerPerformances.sort((a, b) => b.totalGain - a.totalGain);

            // Assign ranks
            sorted.forEach((player, index) => {
              player.currentRank = index + 1;
            });

            setStandings(sorted);

            // Calculate asset comparison
            const myPlayer = sorted.find(p => p.isMe);
            if (myPlayer) {
              const myBest = myPlayer.bestAsset;
              const opponentBests = sorted
                .filter(p => !p.isMe)
                .map(p => p.bestAsset)
                .sort((a, b) => b.gain - a.gain);

              setAssetComparison({
                myBest,
                opponentBest: opponentBests[0],
                iWin: myBest?.gain > (opponentBests[0]?.gain || 0)
              });
            }

          } catch (error) {
            console.error('Error calculating standings:', error);
          }

          setLoading(false);
        };

        calculateStandings();

        // Refresh every 60 seconds
        const refreshInterval = setInterval(calculateStandings, 60000);
        return () => clearInterval(refreshInterval);
      }, [currentDraft, currentUserId, battleType]);

      // Calculate time remaining
      useEffect(() => {
        const updateTimer = () => {
          if (!currentDraft?.battleEndTime) return;

          const end = new Date(currentDraft.battleEndTime);
          const now = new Date();
          const diff = end - now;

          if (diff <= 0) {
            setTimeRemaining('Battle ended');
            return;
          }

          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

          if (days > 0) {
            setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
          } else if (hours > 0) {
            setTimeRemaining(`${hours}h ${minutes}m`);
          } else {
            setTimeRemaining(`${minutes}m`);
          }
        };

        updateTimer();
        const timerInterval = setInterval(updateTimer, 60000);
        return () => clearInterval(timerInterval);
      }, [currentDraft?.battleEndTime]);

      // Toggle card expansion
      const toggleExpand = (odUserId) => {
        setExpandedCards(prev => ({
          ...prev,
          [odUserId]: !prev[odUserId]
        }));
      };

      // Get movement indicator
      const getMovementIndicator = (player) => {
        if (!player.previousRank || player.previousRank === player.currentRank) {
          return { icon: '─', color: '#8b949e' };
        }
        if (player.currentRank < player.previousRank) {
          return { icon: '↑', color: '#10b981' };
        }
        return { icon: '↓', color: '#ef4444' };
      };

      // Get rank badge style
      const getRankBadge = (rank) => {
        switch (rank) {
          case 1: return { bg: 'linear-gradient(135deg, #ffd700 0%, #ffb800 100%)', text: '🥇 1ST' };
          case 2: return { bg: 'linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%)', text: '🥈 2ND' };
          case 3: return { bg: 'linear-gradient(135deg, #cd7f32 0%, #b87333 100%)', text: '🥉 3RD' };
          default: return { bg: '#21262d', text: `${rank}TH` };
        }
      };

      // Safety check
      if (!currentDraft) {
        return (
          <div style={containerStyle}>
            <div style={{
              minHeight: '100vh',
              background: '#0d1117',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px'
            }}>
              <p style={{ color: '#ffffff', marginBottom: '16px' }}>No active draft battle</p>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={containerStyle}>
          <div style={{ minHeight: '100vh', background: '#0d1117' }}>
            {/* Header */}
            <div style={{
              background: '#161b22',
              borderBottom: '2px solid #21262d',
              padding: '12px 16px',
              position: 'sticky',
              top: 0,
              zIndex: 100
            }}>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    color: '#8b949e',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '8px'
                  }}
                >
                  ← Back
                </button>
                <h1 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🐍 Draft Battle
                </h1>
                <div style={{ width: '50px' }}></div>
              </div>
            </div>

            {/* Battle Info Bar */}
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '12px 16px',
              textAlign: 'center'
            }}>
              <div style={{
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '14px',
                marginBottom: '4px'
              }}>
                {currentDraft?.code || 'DRAFT'} • Ends in {timeRemaining || 'Calculating...'}
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'center',
                gap: '16px'
              }}>
                <span>{battleType === 'stocks' ? '📈 Stocks' : '🪙 Crypto'}</span>
                <span>•</span>
                <span>Free Agents: {currentDraft?.freeAgents ?
                  Object.values(currentDraft.freeAgents).flat().length : 0}</span>
              </div>
            </div>

            {/* Main Content */}
            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                  <div style={{ fontSize: '32px', marginBottom: '16px' }}>📊</div>
                  Calculating standings...
                </div>
              ) : (
                <>
                  {/* Standings Cards */}
                  {standings.map((player) => {
                    const isExpanded = player.isMe || expandedCards[player.odUserId];
                    const movement = getMovementIndicator(player);
                    const rankBadge = getRankBadge(player.currentRank);

                    return (
                      <div
                        key={player.odUserId}
                        onClick={() => !player.isMe && toggleExpand(player.odUserId)}
                        style={{
                          background: player.isMe
                            ? 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)'
                            : '#161b22',
                          border: player.isMe
                            ? '2px solid #00d9ff'
                            : '1px solid #21262d',
                          borderRadius: '16px',
                          padding: '16px',
                          marginBottom: '12px',
                          cursor: player.isMe ? 'default' : 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Card Header */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: isExpanded ? '16px' : '0'
                        }}>
                          {/* Left: Player Info */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Rank Badge */}
                            <div style={{
                              background: rankBadge.bg,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: player.currentRank <= 3 ? '#000' : '#fff'
                            }}>
                              {rankBadge.text}
                            </div>

                            {/* Player Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {player.isCPU && <span style={{ fontSize: '14px' }}>🤖</span>}
                              {player.isMe && <span style={{ fontSize: '14px' }}>👤</span>}
                              <span style={{
                                color: player.isMe ? '#00d9ff' : '#ffffff',
                                fontWeight: player.isMe ? 'bold' : '600',
                                fontSize: '15px'
                              }}>
                                {player.isMe ? 'YOU' : player.displayName}
                              </span>
                            </div>

                            {/* Movement Indicator */}
                            <span style={{
                              color: movement.color,
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}>
                              {movement.icon}
                            </span>
                          </div>

                          {/* Right: Gain + Expand */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              color: player.totalGain >= 0 ? '#10b981' : '#ef4444',
                              fontWeight: 'bold',
                              fontSize: '18px'
                            }}>
                              {player.totalGain >= 0 ? '+' : ''}{player.totalGain}%
                            </span>

                            {!player.isMe && (
                              <span style={{
                                color: '#8b949e',
                                fontSize: '18px',
                                transition: 'transform 0.2s',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                              }}>
                                ▼
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div>
                            {/* Divider */}
                            <div style={{
                              height: '1px',
                              background: player.isMe ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
                              marginBottom: '16px'
                            }} />

                            {/* Portfolio Grid */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: '8px',
                              marginBottom: '16px'
                            }}>
                              {player.portfolio.map((asset, assetIdx) => (
                                <div
                                  key={assetIdx}
                                  style={{
                                    background: '#0d1117',
                                    border: '1px solid #21262d',
                                    borderRadius: '8px',
                                    padding: '10px 8px',
                                    textAlign: 'center'
                                  }}
                                >
                                  <div style={{
                                    color: '#ffffff',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    marginBottom: '4px'
                                  }}>
                                    {asset.symbol}
                                  </div>
                                  <div style={{
                                    color: asset.gain >= 0 ? '#10b981' : '#ef4444',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}>
                                    {asset.gain >= 0 ? '+' : ''}{asset.gain}%
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Best/Worst Assets */}
                            <div style={{
                              display: 'flex',
                              gap: '12px',
                              marginBottom: player.isMe ? '16px' : '0'
                            }}>
                              <div style={{
                                flex: 1,
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '8px',
                                padding: '10px',
                                textAlign: 'center'
                              }}>
                                <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                                  🔥 BEST
                                </div>
                                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px' }}>
                                  {player.bestAsset?.symbol} {player.bestAsset?.gain >= 0 ? '+' : ''}{player.bestAsset?.gain}%
                                </div>
                              </div>
                              <div style={{
                                flex: 1,
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                padding: '10px',
                                textAlign: 'center'
                              }}>
                                <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                                  ❄️ WORST
                                </div>
                                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>
                                  {player.worstAsset?.symbol} {player.worstAsset?.gain >= 0 ? '+' : ''}{player.worstAsset?.gain}%
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons (only for your card) */}
                            {player.isMe && (
                              <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setScreen('freeAgency');
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'transparent',
                                    border: '2px solid #8b5cf6',
                                    borderRadius: '8px',
                                    color: '#8b5cf6',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  🔄 Free Agency
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setScreen('draftResults');
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'transparent',
                                    border: '1px solid #21262d',
                                    borderRadius: '8px',
                                    color: '#8b949e',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  📋 All Picks
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Asset Comparison Section */}
                  {assetComparison && (
                    <div style={{
                      background: '#161b22',
                      border: '1px solid #21262d',
                      borderRadius: '16px',
                      padding: '16px',
                      marginTop: '8px'
                    }}>
                      <h3 style={{
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        ⚔️ ASSET SHOWDOWN
                      </h3>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}>
                        {/* Your Best */}
                        <div style={{
                          flex: 1,
                          background: assetComparison.iWin
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                          border: assetComparison.iWin
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '10px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                            YOUR BEST
                          </div>
                          <div style={{
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            marginBottom: '2px'
                          }}>
                            {assetComparison.myBest?.symbol}
                          </div>
                          <div style={{
                            color: '#10b981',
                            fontWeight: 'bold',
                            fontSize: '14px'
                          }}>
                            +{assetComparison.myBest?.gain}%
                          </div>
                          {assetComparison.iWin && (
                            <div style={{
                              color: '#10b981',
                              fontSize: '11px',
                              marginTop: '4px'
                            }}>
                              🏆 WINNING
                            </div>
                          )}
                        </div>

                        {/* VS */}
                        <div style={{
                          color: '#6e7681',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>
                          VS
                        </div>

                        {/* Opponent Best */}
                        <div style={{
                          flex: 1,
                          background: !assetComparison.iWin
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                          border: !assetComparison.iWin
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '10px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                            THEIR BEST
                          </div>
                          <div style={{
                            color: '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            marginBottom: '2px'
                          }}>
                            {assetComparison.opponentBest?.symbol || '-'}
                          </div>
                          <div style={{
                            color: (assetComparison.opponentBest?.gain || 0) >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 'bold',
                            fontSize: '14px'
                          }}>
                            {(assetComparison.opponentBest?.gain || 0) >= 0 ? '+' : ''}
                            {assetComparison.opponentBest?.gain || 0}%
                          </div>
                          {!assetComparison.iWin && (
                            <div style={{
                              color: '#f59e0b',
                              fontSize: '11px',
                              marginTop: '4px'
                            }}>
                              ⚠️ WATCH OUT
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Refresh Indicator */}
                  <div style={{
                    textAlign: 'center',
                    color: '#6e7681',
                    fontSize: '11px',
                    marginTop: '16px',
                    padding: '8px'
                  }}>
                    Prices update every minute
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    };

    return <DraftBattleScreen />;
  }

  // FREE AGENCY SCREEN
  if (screen === 'freeAgency') {
    const FreeAgencyScreen = () => {
      const [freeAgents, setFreeAgents] = useState({ steady: [], risky: [], defensive: [] });
      const [playerRoster, setPlayerRoster] = useState({ steady: [], risky: [], defensive: [] });
      const [selectedCategory, setSelectedCategory] = useState('steady');
      const [swapsRemaining, setSwapsRemaining] = useState(2);
      const [isWindowOpen, setIsWindowOpen] = useState(false);
      const [timeInfo, setTimeInfo] = useState(null);
      const [loading, setLoading] = useState(true);
      const [selectedDrop, setSelectedDrop] = useState(null);
      const [swapHistory, setSwapHistory] = useState([]);
      const [showConfirmModal, setShowConfirmModal] = useState(false);
      const [selectedAdd, setSelectedAdd] = useState(null);
      const [swapping, setSwapping] = useState(false);

      const portfolioType = currentDraft?.type || 'stocks';
      const currentUserId = user.odUserId || user.username;

      // Load data
      useEffect(() => {
        const loadData = async () => {
          if (!currentDraft?.id) return;

          setLoading(true);
          const freeAgencyService = await import('./services/freeAgencyService');

          // Check window status
          const windowOpen = freeAgencyService.isFreeAgencyWindowOpen(portfolioType);
          setIsWindowOpen(windowOpen);

          if (windowOpen) {
            const closeTime = freeAgencyService.getTimeUntilWindowCloses(portfolioType);
            setTimeInfo({ type: 'closes', ...closeTime });
          } else {
            const openTime = freeAgencyService.getTimeUntilWindowOpens(portfolioType);
            setTimeInfo({ type: 'opens', ...openTime });
          }

          // Get free agents
          const agents = await freeAgencyService.getFreeAgents(currentDraft.id);
          setFreeAgents(agents);

          // Get player roster
          const roster = await freeAgencyService.getPlayerRoster(currentDraft.id, currentUserId);
          setPlayerRoster(roster || { steady: [], risky: [], defensive: [] });

          // Get swaps remaining
          const swapCheck = await freeAgencyService.canPlayerSwap(currentDraft.id, currentUserId, portfolioType);
          setSwapsRemaining(swapCheck.swapsRemaining ?? 2);

          // Get swap history
          const history = await freeAgencyService.getSwapHistory(currentDraft.id);
          setSwapHistory(history);

          setLoading(false);
        };

        loadData();

        // Refresh every minute to update window status
        const refreshInterval = setInterval(loadData, 60000);
        return () => clearInterval(refreshInterval);
      }, [currentDraft?.id, portfolioType, currentUserId]);

      const handleDropSelect = (asset) => {
        if (!isWindowOpen || swapsRemaining === 0) return;
        setSelectedDrop(asset);
        setSelectedCategory(asset.category);
        setSelectedAdd(null);
      };

      const handleAddSelect = (asset) => {
        if (!selectedDrop) {
          alert('First select an asset to drop from your roster');
          return;
        }
        if (asset.category !== selectedDrop.category) {
          alert(`Must select a ${selectedDrop.category} free agent`);
          return;
        }
        setSelectedAdd(asset);
        setShowConfirmModal(true);
      };

      const handleConfirmSwap = async () => {
        if (!selectedDrop || !selectedAdd || swapping) return;

        setSwapping(true);
        try {
          const freeAgencyService = await import('./services/freeAgencyService');
          const result = await freeAgencyService.executeSwap(
            currentDraft.id,
            currentUserId,
            selectedDrop.symbol,
            selectedAdd.symbol
          );

          if (result.success) {
            // Refresh data
            const agents = await freeAgencyService.getFreeAgents(currentDraft.id);
            setFreeAgents(agents);

            const roster = await freeAgencyService.getPlayerRoster(currentDraft.id, currentUserId);
            setPlayerRoster(roster);

            setSwapsRemaining(result.swapsRemaining);

            const history = await freeAgencyService.getSwapHistory(currentDraft.id);
            setSwapHistory(history);

            setSelectedDrop(null);
            setSelectedAdd(null);
            setShowConfirmModal(false);

            alert(`Swapped ${selectedDrop.symbol} for ${selectedAdd.symbol}!`);
          } else {
            alert(`Swap failed: ${result.error}`);
          }
        } catch (error) {
          alert(`Swap failed: ${error.message}`);
        }
        setSwapping(false);
      };

      const categoryColors = {
        steady: '#10b981',
        risky: '#f59e0b',
        defensive: '#3b82f6'
      };

      if (loading) {
        return (
          <div style={containerStyle}>
            <div style={{
              minHeight: '100vh',
              background: '#0d1117',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid #21262d',
                  borderTop: '4px solid #8b5cf6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <div style={{ color: '#8b949e' }}>Loading free agency...</div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div style={containerStyle}>
          <div style={{ minHeight: '100vh', background: '#0d1117' }}>
            {/* Header */}
            <div style={{
              background: '#161b22',
              borderBottom: '2px solid #21262d',
              padding: '16px'
            }}>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <button
                  onClick={() => setScreen('draftResults')}
                  style={{
                    color: '#00d9ff',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  ← Back
                </button>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
                  🔄 Free Agency
                </h1>
                <div style={{ width: '60px' }}></div>
              </div>
            </div>

            {/* Window Status Banner */}
            <div style={{
              background: isWindowOpen
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
              padding: '16px',
              textAlign: 'center'
            }}>
              {isWindowOpen ? (
                <>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>
                    🟢 FREE AGENCY OPEN
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>
                    Closes in {timeInfo?.hours}h {timeInfo?.minutes}m • {swapsRemaining} swaps remaining today
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>
                    🔴 FREE AGENCY CLOSED
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>
                    Opens in {timeInfo?.hours}h {timeInfo?.minutes}m
                    {portfolioType === 'stocks' ? ' (3 PM CT)' : ' (6 PM CT)'}
                  </div>
                </>
              )}
            </div>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
              {/* YOUR ROSTER Section */}
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  📋 YOUR ROSTER - Tap to drop
                </h2>

                {['steady', 'risky', 'defensive'].map(category => (
                  <div key={category} style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: categoryColors[category]
                      }} />
                      <span style={{
                        color: categoryColors[category],
                        fontWeight: '600',
                        fontSize: '13px',
                        textTransform: 'capitalize'
                      }}>
                        {category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {playerRoster[category]?.map(asset => (
                        <button
                          key={asset.symbol}
                          onClick={() => handleDropSelect(asset)}
                          disabled={!isWindowOpen || swapsRemaining === 0}
                          style={{
                            flex: 1,
                            padding: '12px 8px',
                            background: selectedDrop?.symbol === asset.symbol
                              ? 'rgba(239, 68, 68, 0.2)'
                              : '#161b22',
                            border: selectedDrop?.symbol === asset.symbol
                              ? '2px solid #ef4444'
                              : `1px solid ${categoryColors[category]}`,
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontWeight: '600',
                            fontSize: '14px',
                            cursor: isWindowOpen && swapsRemaining > 0 ? 'pointer' : 'not-allowed',
                            opacity: isWindowOpen && swapsRemaining > 0 ? 1 : 0.5
                          }}
                        >
                          {asset.symbol}
                          {selectedDrop?.symbol === asset.symbol && (
                            <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>
                              DROP
                            </div>
                          )}
                        </button>
                      ))}
                      {playerRoster[category]?.length === 0 && (
                        <div style={{ color: '#6e7681', fontSize: '13px', padding: '12px' }}>
                          No picks in this category
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* FREE AGENTS Section */}
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                  🆓 FREE AGENTS {selectedDrop ? `- Select ${selectedDrop.category}` : ''}
                </h2>

                {/* Category Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {['steady', 'risky', 'defensive'].map(category => {
                    const isSelectedCategory = selectedDrop?.category === category;
                    const isDisabled = selectedDrop && !isSelectedCategory;

                    return (
                      <button
                        key={category}
                        onClick={() => !selectedDrop && setSelectedCategory(category)}
                        disabled={isDisabled}
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: (selectedDrop ? isSelectedCategory : selectedCategory === category)
                            ? `2px solid ${categoryColors[category]}`
                            : '1px solid #21262d',
                          background: (selectedDrop ? isSelectedCategory : selectedCategory === category)
                            ? `${categoryColors[category]}20`
                            : 'transparent',
                          color: isDisabled ? '#6e7681' : categoryColors[category],
                          fontWeight: '600',
                          fontSize: '12px',
                          textTransform: 'capitalize',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.4 : 1
                        }}
                      >
                        {category} ({freeAgents[category]?.length || 0})
                      </button>
                    );
                  })}
                </div>

                {/* Free Agent Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {(freeAgents[selectedDrop?.category || selectedCategory] || []).map(asset => (
                    <button
                      key={asset.symbol}
                      onClick={() => isWindowOpen && selectedDrop && handleAddSelect(asset)}
                      disabled={!isWindowOpen || !selectedDrop}
                      style={{
                        padding: '12px 8px',
                        background: '#161b22',
                        border: '1px solid #21262d',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontWeight: '600',
                        fontSize: '13px',
                        cursor: isWindowOpen && selectedDrop ? 'pointer' : 'not-allowed',
                        opacity: isWindowOpen && selectedDrop ? 1 : 0.5,
                        textAlign: 'center'
                      }}
                    >
                      {asset.symbol}
                      {isWindowOpen && selectedDrop && (
                        <div style={{
                          color: '#10b981',
                          fontSize: '10px',
                          marginTop: '4px',
                          fontWeight: 'bold'
                        }}>
                          + ADD
                        </div>
                      )}
                    </button>
                  ))}
                  {(freeAgents[selectedDrop?.category || selectedCategory] || []).length === 0 && (
                    <div style={{
                      gridColumn: 'span 3',
                      color: '#6e7681',
                      textAlign: 'center',
                      padding: '24px'
                    }}>
                      No free agents in this category
                    </div>
                  )}
                </div>
              </div>

              {/* SWAP HISTORY Section */}
              {swapHistory.length > 0 && (
                <div>
                  <h2 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    📜 SWAP HISTORY
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {swapHistory.slice(0, 10).map((swap, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: '#161b22',
                          border: '1px solid #21262d',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <span style={{ color: '#8b949e', fontSize: '12px' }}>
                            {swap.displayName}
                          </span>
                          <div style={{ color: '#ffffff', fontSize: '14px', marginTop: '2px' }}>
                            <span style={{ color: '#ef4444' }}>-{swap.droppedAsset.symbol}</span>
                            {' → '}
                            <span style={{ color: '#10b981' }}>+{swap.addedAsset.symbol}</span>
                          </div>
                        </div>
                        <div style={{ color: '#6e7681', fontSize: '11px', textAlign: 'right' }}>
                          {new Date(swap.timestamp).toLocaleDateString()}
                          <br />
                          {new Date(swap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Swap Modal */}
            {showConfirmModal && selectedDrop && selectedAdd && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                zIndex: 1000
              }}>
                <div style={{
                  background: '#161b22',
                  borderRadius: '16px',
                  padding: '24px',
                  maxWidth: '400px',
                  width: '100%',
                  border: '2px solid #21262d'
                }}>
                  <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
                    Confirm Swap?
                  </h3>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        padding: '16px 24px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '2px solid #ef4444',
                        borderRadius: '12px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '4px' }}>DROP</div>
                        <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                          {selectedDrop.symbol}
                        </div>
                      </div>
                    </div>

                    <div style={{ color: '#8b949e', fontSize: '24px' }}>→</div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        padding: '16px 24px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '2px solid #10b981',
                        borderRadius: '12px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ color: '#10b981', fontSize: '11px', marginBottom: '4px' }}>ADD</div>
                        <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                          {selectedAdd.symbol}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
                    This will use 1 of your {swapsRemaining} remaining swaps today.
                    {portfolioType === 'stocks'
                      ? " Price will be locked at today's closing price."
                      : ' Price will be locked at current market price.'}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => {
                        setShowConfirmModal(false);
                        setSelectedAdd(null);
                      }}
                      disabled={swapping}
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: 'transparent',
                        border: '1px solid #21262d',
                        borderRadius: '8px',
                        color: '#8b949e',
                        fontWeight: '600',
                        cursor: swapping ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmSwap}
                      disabled={swapping}
                      style={{
                        flex: 1,
                        padding: '14px',
                        background: swapping
                          ? '#6e7681'
                          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        cursor: swapping ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {swapping ? 'Swapping...' : 'Confirm Swap'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    };

    return <FreeAgencyScreen />;
  }

  // BATTLE VIEW SCREEN - ESPN STYLE REDESIGN
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

    // Pre-calculate gain percentages for highlighting
    const myPortfolioWithGains = myPortfolio.map(asset => {
      const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
      const currentPrice = battlePrices[asset.symbol] || startingPrice;
      const gainPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
      return { ...asset, gainPercent };
    });

    const theirPortfolioWithGains = theirPortfolio.map(asset => {
      const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
      const currentPrice = battlePrices[asset.symbol] || startingPrice;
      const gainPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
      return { ...asset, gainPercent };
    });

    // Helper function to determine border highlighting for portfolio assets
    const getAssetBorderStyle = (portfolio, currentAsset) => {
      // Sort portfolio by gain percentage (descending)
      const sortedByGain = [...portfolio].sort((a, b) => {
        const gainA = a.gainPercent || 0;
        const gainB = b.gainPercent || 0;
        return gainB - gainA;
      });

      const currentGainPercent = currentAsset.gainPercent || 0;
      const currentIndex = sortedByGain.findIndex(a => a.symbol === currentAsset.symbol);

      // Separate positive and negative performers
      const positivePerformers = sortedByGain.filter(a => (a.gainPercent || 0) > 0);
      const negativePerformers = sortedByGain.filter(a => (a.gainPercent || 0) < 0);

      // TOP 3 WINNERS (Green) - Must be positive
      if (currentGainPercent > 0 && currentIndex < 3) {
        return {
          border: '3px solid #22c55e',
          boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)',
          backgroundColor: 'rgba(34, 197, 94, 0.05)'
        };
      }

      // TOP 3 LOSERS (Red) - Must be negative
      if (currentGainPercent < 0 && currentIndex >= sortedByGain.length - 3) {
        return {
          border: '3px solid #ef4444',
          boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.05)'
        };
      }

      // BIGGEST LAGGARD (Orange) - Lowest positive gain
      if (positivePerformers.length > 0 && negativePerformers.length > 0) {
        const smallestPositiveGain = positivePerformers[positivePerformers.length - 1];
        if (currentAsset.symbol === smallestPositiveGain.symbol && currentGainPercent > 0) {
          return {
            border: '3px solid #ff8c00',
            boxShadow: '0 0 12px rgba(255, 140, 0, 0.3)',
            backgroundColor: 'rgba(255, 140, 0, 0.05)'
          };
        }
      }

      // DEFAULT - No highlighting
      return {
        border: '2px solid #21262d',
        boxShadow: 'none',
        backgroundColor: 'transparent'
      };
    };

    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* COMPACT DARK HEADER */}
          <div style={{
            background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
            borderBottom: '2px solid #21262d',
            padding: '12px 16px',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{
              maxWidth: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              {/* Back Button */}
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#00d9ff',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>

              {/* Status and Score Diff */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: isWinning ? '#22c55e' : '#ef4444'
                }}>
                  {isWinning ? 'LEADING' : 'TRAILING'}
                </span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: isWinning ? '#22c55e' : '#ef4444'
                }}>
                  {isWinning ? '+' : '-'}{difference.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Time Remaining */}
            <div style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#8b949e',
              fontWeight: '500'
            }}>
              {battleTimer.formatTimeRemaining(currentBattle)} remaining
            </div>
          </div>

          {/* Training Battle Indicator */}
          {currentBattle.isTrainingBattle && (
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7C3AED 100%)',
              color: 'white',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: '600',
              fontSize: '13px'
            }}>
              <span>🎓</span>
              Training Battle • 1 Hour • Reduced XP
            </div>
          )}

          {/* COMPARISON CARD */}
          <div style={{ padding: '16px', backgroundColor: '#0d1117' }}>
            <div style={{
              background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
              border: '2px solid #21262d',
              borderRadius: '16px',
              padding: '20px 16px',
              marginBottom: '16px'
            }}>
              {/* Players Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                {/* YOU */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    border: '2px solid #00d9ff',
                    marginBottom: '8px'
                  }}>
                    👤
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    fontWeight: '600'
                  }}>
                    YOU
                  </span>
                </div>

                {/* VS */}
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: '#6e7681',
                  padding: '0 16px'
                }}>
                  VS
                </div>

                {/* OPPONENT */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    background: currentBattle.isTrainingBattle
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    border: `2px solid ${currentBattle.isTrainingBattle ? '#8b5cf6' : '#ef4444'}`,
                    marginBottom: '8px'
                  }}>
                    {currentBattle.isTrainingBattle ? '🤖' : '👤'}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    fontWeight: '600'
                  }}>
                    {currentBattle.isTrainingBattle ? 'CPU' : 'OPP'}
                  </span>
                </div>
              </div>

              {/* Scores Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: myGain >= 0 ? '#22c55e' : '#ef4444',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  {myGain >= 0 ? '+' : ''}{myGain.toFixed(2)}%
                </div>

                <div style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: theirGain >= 0 ? '#22c55e' : '#ef4444',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  {theirGain >= 0 ? '+' : ''}{theirGain.toFixed(2)}%
                </div>
              </div>

              {/* Visual Bar */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#21262d',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  display: 'flex'
                }}>
                  <div style={{
                    height: '100%',
                    width: '50%',
                    background: isWinning
                      ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                      : '#21262d',
                    transition: 'all 0.3s ease'
                  }} />
                  <div style={{
                    height: '100%',
                    width: '50%',
                    background: !isWinning
                      ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
                      : '#21262d',
                    transition: 'all 0.3s ease'
                  }} />
                </div>

                {/* Leading By Text */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: isWinning ? '#22c55e' : '#ef4444'
                }}>
                  {isWinning
                    ? `LEADING BY ${difference.toFixed(2)}%`
                    : `TRAILING BY ${difference.toFixed(2)}%`
                  }
                  {' '}
                  <span style={{ color: '#8b949e' }}>
                    (${valueDifference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </div>
              </div>

              {/* Portfolio Values */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#8b949e',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  ${myValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>

                <div style={{
                  fontSize: '14px',
                  color: '#8b949e',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  ${theirValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* SIDE-BY-SIDE PORTFOLIOS */}
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '0 16px 24px 16px',
            flex: 1,
            overflow: 'hidden'
          }}>
            {/* YOUR PORTFOLIO */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0
            }}>
              {/* Header */}
              <div style={{
                backgroundColor: '#00d9ff',
                padding: '10px 12px',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '16px' }}>👤</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#0d1117'
                }}>
                  YOU
                </span>
              </div>

              {/* Portfolio List */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #21262d',
                borderTop: 'none',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
                overflow: 'auto',
                flex: 1,
                padding: '4px'
              }}>
                {myPortfolioWithGains.map((asset, index) => {
                  const currentPrice = battlePrices[asset.symbol] || asset.price;
                  const gainPercent = asset.gainPercent;
                  const weight = (asset.amount / 1000000) * 100;
                  const borderStyle = getAssetBorderStyle(myPortfolioWithGains, asset);

                  return (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        marginBottom: '4px',
                        borderRadius: '8px',
                        transition: 'all 0.3s ease',
                        ...borderStyle
                      }}
                    >
                      {/* Symbol and Gain */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#ffffff'
                        }}>
                          {asset.symbol}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: gainPercent >= 0 ? '#22c55e' : '#ef4444'
                        }}>
                          {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                        </span>
                      </div>

                      {/* Allocation and Price */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#8b949e'
                        }}>
                          {weight.toFixed(1)}%
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#8b949e'
                        }}>
                          ${currentPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OPPONENT PORTFOLIO */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0
            }}>
              {/* Header */}
              <div style={{
                backgroundColor: currentBattle.isTrainingBattle ? '#8b5cf6' : '#ef4444',
                padding: '10px 12px',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '16px' }}>
                  {currentBattle.isTrainingBattle ? '🤖' : '👤'}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#ffffff'
                }}>
                  {currentBattle.isTrainingBattle ? 'CPU' : 'OPP'}
                </span>
              </div>

              {/* Portfolio List */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #21262d',
                borderTop: 'none',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
                overflow: 'auto',
                flex: 1,
                padding: '4px'
              }}>
                {theirPortfolioWithGains.map((asset, index) => {
                  const currentPrice = battlePrices[asset.symbol] || asset.price;
                  const gainPercent = asset.gainPercent;
                  const weight = (asset.amount / 1000000) * 100;
                  const borderStyle = getAssetBorderStyle(theirPortfolioWithGains, asset);

                  return (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        marginBottom: '4px',
                        borderRadius: '8px',
                        transition: 'all 0.3s ease',
                        ...borderStyle
                      }}
                    >
                      {/* Symbol and Gain */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#ffffff'
                        }}>
                          {asset.symbol}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: gainPercent >= 0 ? '#22c55e' : '#ef4444'
                        }}>
                          {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                        </span>
                      </div>

                      {/* Allocation and Price */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: '#8b949e'
                        }}>
                          {weight.toFixed(1)}%
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: '#8b949e'
                        }}>
                          ${currentPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
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

  // WINS SCREEN
  if (screen === 'wins') {
    const wonBattles = previousBattles.filter(b => b.result && b.result.winner === user.username);

    return (
      <div style={containerStyle}>
        <div className="min-h-screen pb-20" style={{ background: colors.background }}>
          {/* Header */}
          <div className="bg-[#161b22] border-b border-gray-800 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setScreen('dashboard')}
                className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400"
              >
                <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                <span>Back</span>
              </button>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                <span className="text-green-500">🏆</span>
                Your Wins
              </h1>
              <div className="w-16"></div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto p-4">
            {/* Stats Summary */}
            <div className="bg-gradient-to-r from-green-600 to-green-800 rounded-xl p-6 mb-6 text-center text-white">
              <div className="text-6xl mb-2 font-bold">{user.wins || 0}</div>
              <div className="text-xl font-semibold">Total Wins</div>
              {(user.wins + user.losses) > 0 && (
                <div className="text-sm mt-2 opacity-90">
                  Win Rate: {(((user.wins || 0) / ((user.wins || 0) + (user.losses || 0))) * 100).toFixed(1)}%
                </div>
              )}
            </div>

            {/* Won Battles List */}
            <h2 className="text-lg font-bold mb-4 text-white">Battle History</h2>

            {wonBattles.length > 0 ? (
              <div className="space-y-3">
                {wonBattles.map(battle => {
                  const result = battle.result;
                  const userReturn = battle.creator === user.username ? result.creatorReturn : result.opponentReturn;
                  const opponentReturn = battle.creator === user.username ? result.opponentReturn : result.creatorReturn;
                  const opponent = battle.creator === user.username ? battle.opponent : battle.creator;
                  const xpEarned = result.xpAwarded[user.username] || 0;

                  return (
                    <div
                      key={battle.id}
                      onClick={() => { setSelectedPreviousBattle(battle); setScreen('previousBattles'); }}
                      className="bg-[#161b22] border border-green-500/30 rounded-xl p-4 cursor-pointer hover:border-green-500 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-white">{battle.portfolioName || 'Unnamed Portfolio'}</h3>
                        <span className="bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full">WIN</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>vs. {opponent}</span>
                        <span>{battleTimer.formatDate(battle.completedAt || battle.archivedAt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-500 font-semibold">You: {userReturn >= 0 ? '+' : ''}{userReturn?.toFixed(2)}%</span>
                        <span className="text-red-500 font-semibold">Them: {opponentReturn >= 0 ? '+' : ''}{opponentReturn?.toFixed(2)}%</span>
                      </div>
                      {xpEarned > 0 && (
                        <div className="text-xs text-yellow-500 mt-2">+{xpEarned} XP</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#161b22] border border-gray-700 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-gray-400 mb-2">No wins yet</p>
                <p className="text-sm text-gray-500">Create your first battle to start winning!</p>
                <button
                  onClick={() => setScreen('dashboard')}
                  className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Mobile Bottom Nav - Wins Screen */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-[#161b22] border-t-2 border-gray-800 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-around items-center">
              <button onClick={() => setScreen('wins')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-green-500">
                <span className="text-2xl">🏆</span>
                <span className="text-xs font-semibold">Wins</span>
              </button>
              <button onClick={() => setScreen('losses')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-gray-400">
                <span className="text-2xl">💀</span>
                <span className="text-xs font-semibold">Losses</span>
              </button>
              <button onClick={() => setScreen('profile')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-gray-400">
                <span className="text-2xl">👤</span>
                <span className="text-xs font-semibold">Profile</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    );
  }

  // LOSSES SCREEN
  if (screen === 'losses') {
    const lostBattles = previousBattles.filter(b => b.result && b.result.winner !== user.username);

    return (
      <div style={containerStyle}>
        <div className="min-h-screen pb-20" style={{ background: colors.background }}>
          {/* Header */}
          <div className="bg-[#161b22] border-b border-gray-800 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setScreen('dashboard')}
                className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400"
              >
                <ChevronUp className="w-5 h-5 rotate-[-90deg]" />
                <span>Back</span>
              </button>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                <span className="text-red-500">💀</span>
                Your Losses
              </h1>
              <div className="w-16"></div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto p-4">
            {/* Stats Summary */}
            <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 mb-6 text-center text-white">
              <div className="text-6xl mb-2 font-bold">{user.losses || 0}</div>
              <div className="text-xl font-semibold">Total Losses</div>
              <div className="text-sm mt-2 opacity-90">Every loss is a learning opportunity 💪</div>
            </div>

            {/* Lost Battles List */}
            <h2 className="text-lg font-bold mb-4 text-white">Battle History</h2>

            {lostBattles.length > 0 ? (
              <div className="space-y-3">
                {lostBattles.map(battle => {
                  const result = battle.result;
                  const userReturn = battle.creator === user.username ? result.creatorReturn : result.opponentReturn;
                  const opponentReturn = battle.creator === user.username ? result.opponentReturn : result.creatorReturn;
                  const opponent = battle.creator === user.username ? battle.opponent : battle.creator;
                  const xpEarned = result.xpAwarded[user.username] || 0;

                  return (
                    <div
                      key={battle.id}
                      onClick={() => { setSelectedPreviousBattle(battle); setScreen('previousBattles'); }}
                      className="bg-[#161b22] border border-red-500/30 rounded-xl p-4 cursor-pointer hover:border-red-500 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-white">{battle.portfolioName || 'Unnamed Portfolio'}</h3>
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">LOSS</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>vs. {opponent}</span>
                        <span>{battleTimer.formatDate(battle.completedAt || battle.archivedAt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-500 font-semibold">You: {userReturn >= 0 ? '+' : ''}{userReturn?.toFixed(2)}%</span>
                        <span className="text-green-500 font-semibold">Them: {opponentReturn >= 0 ? '+' : ''}{opponentReturn?.toFixed(2)}%</span>
                      </div>
                      {xpEarned > 0 && (
                        <div className="text-xs text-yellow-500 mt-2">+{xpEarned} XP</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#161b22] border border-gray-700 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-gray-400 mb-2">No losses yet</p>
                <p className="text-sm text-gray-500">You're undefeated! Keep it up!</p>
              </div>
            )}
          </div>

          {/* Mobile Bottom Nav - Losses Screen */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-[#161b22] border-t-2 border-gray-800 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-around items-center">
              <button onClick={() => setScreen('wins')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-gray-400">
                <span className="text-2xl">🏆</span>
                <span className="text-xs font-semibold">Wins</span>
              </button>
              <button onClick={() => setScreen('losses')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-red-500">
                <span className="text-2xl">💀</span>
                <span className="text-xs font-semibold">Losses</span>
              </button>
              <button onClick={() => setScreen('profile')} className="flex flex-col items-center gap-1 min-w-[70px] transition-colors text-gray-400">
                <span className="text-2xl">👤</span>
                <span className="text-xs font-semibold">Profile</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    );
  }

  // BATTLE HISTORY SCREEN
  if (screen === 'battleHistory') {
    // Get completed battles based on tab
    const allCompletedClassicBattles = user?.completedBattles || [];
    const classicBattles = allCompletedClassicBattles.filter(b => b.isDraft !== true);

    // Use completedDraftBattles state for draft tab (fetched from Firebase)
    const completedBattles = historyTab === 'draft' ? completedDraftBattles : classicBattles;

    // Stats for the current tab
    const tabWins = completedBattles.filter(b => b.won === true).length;
    const tabLosses = completedBattles.filter(b => b.won === false).length;
    // For draft battles, podium (top 3) count can be useful
    const draftPodiums = historyTab === 'draft' ? completedBattles.filter(b => b.myRank && b.myRank <= 3).length : 0;

    return (
      <div style={containerStyle}>
        <div className="min-h-screen" style={{ background: colors.background }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div style={{ maxWidth: '896px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d9ff',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>Battle History</h1>
              <div style={{ width: '64px' }}></div>
            </div>
          </div>

          <div style={{ maxWidth: '896px', margin: '0 auto', padding: '16px' }}>
            {/* Tab Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '20px',
              padding: '4px',
              background: '#161b22',
              borderRadius: '12px',
              border: '1px solid #21262d'
            }}>
              <button
                onClick={() => setHistoryTab('classic')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: historyTab === 'classic' ? '#00d9ff' : 'transparent',
                  color: historyTab === 'classic' ? '#000000' : '#8b949e',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Classic Mode
              </button>
              <button
                onClick={() => setHistoryTab('draft')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: historyTab === 'draft' ? '#8b5cf6' : 'transparent',
                  color: historyTab === 'draft' ? '#ffffff' : '#8b949e',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Draft Mode
              </button>
            </div>

            {/* Stats Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {/* Total Battles */}
              <div style={{
                backgroundColor: '#161b22',
                border: `1px solid ${historyTab === 'draft' ? '#8b5cf6' : '#21262d'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{historyTab === 'draft' ? '🎯' : '⚔️'}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>
                  {tabWins + tabLosses}
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>{historyTab === 'draft' ? 'Draft' : 'Classic'} Battles</div>
              </div>

              {/* Wins */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #22c55e',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                  {tabWins}
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>Wins</div>
              </div>

              {/* Losses */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💀</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                  {tabLosses}
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>Losses</div>
              </div>
            </div>

            {/* Battle List */}
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginBottom: '16px' }}>
              {historyTab === 'draft' ? 'Past Draft Battles' : 'Past Classic Battles'}
            </h2>

            {completedBattles.length === 0 ? (
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                padding: '48px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>{historyTab === 'draft' ? '🎯' : '🎮'}</div>
                <p style={{ color: '#8b949e', fontSize: '18px', marginBottom: '8px' }}>
                  No {historyTab === 'draft' ? 'draft' : 'classic'} battles yet
                </p>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                  {historyTab === 'draft'
                    ? 'Start a draft battle to build your history!'
                    : 'Create your first classic battle to start your history!'
                  }
                </p>
                <button
                  onClick={() => setScreen('dashboard')}
                  style={{
                    backgroundColor: historyTab === 'draft' ? '#8b5cf6' : '#00d9ff',
                    color: historyTab === 'draft' ? '#ffffff' : '#000000',
                    fontWeight: 'bold',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {completedBattles.map((battle, index) => {
                  // Draft battle card (4 players)
                  if (historyTab === 'draft' && battle.finalStandings) {
                    const currentUserId = user?.odUserId || user?.username;
                    const myResult = battle.finalStandings?.find(p =>
                      p.odUserId === currentUserId
                    );
                    const won = myResult?.finalRank === 1;
                    const podium = myResult?.finalRank <= 3;

                    return (
                      <div
                        key={battle.id || index}
                        style={{
                          background: '#161b22',
                          borderLeft: won ? '4px solid #10b981' :
                                     podium ? '4px solid #f59e0b' :
                                     '4px solid #ef4444',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '0'
                        }}
                      >
                        {/* Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              background: won ? 'rgba(16, 185, 129, 0.2)' :
                                         podium ? 'rgba(245, 158, 11, 0.2)' :
                                         'rgba(239, 68, 68, 0.2)',
                              color: won ? '#10b981' :
                                    podium ? '#f59e0b' :
                                    '#ef4444'
                            }}>
                              {won ? '🏆 1ST PLACE' :
                               myResult?.finalRank === 2 ? '🥈 2ND PLACE' :
                               myResult?.finalRank === 3 ? '🥉 3RD PLACE' :
                               `${myResult?.finalRank || '?'}TH PLACE`}
                            </span>
                            <span style={{ fontSize: '16px' }}>🐍</span>
                          </div>
                          <span style={{ color: '#6e7681', fontSize: '12px' }}>
                            {battle.completedAt ? new Date(battle.completedAt).toLocaleDateString() : ''}
                          </span>
                        </div>

                        {/* Your Performance */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px'
                        }}>
                          <div>
                            <div style={{ color: '#8b949e', fontSize: '11px' }}>YOUR GAIN</div>
                            <div style={{
                              fontSize: '24px',
                              fontWeight: 'bold',
                              color: myResult?.finalGain >= 0 ? '#10b981' : '#ef4444'
                            }}>
                              {myResult?.finalGain >= 0 ? '+' : ''}{myResult?.finalGain?.toFixed(2)}%
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#8b949e', fontSize: '11px' }}>WINNER</div>
                            <div style={{ color: '#ffffff', fontWeight: 'bold' }}>
                              {battle.winner?.displayName || 'Unknown'}
                            </div>
                            <div style={{ color: '#10b981', fontSize: '12px' }}>
                              +{battle.winner?.finalGain?.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* All Players Summary */}
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}>
                          {battle.finalStandings?.map((player, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: player.finalRank === 1 ? 'rgba(16, 185, 129, 0.1)' : '#0d1117',
                                border: player.odUserId === currentUserId
                                  ? '1px solid #00d9ff'
                                  : '1px solid #21262d',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '11px',
                                flex: '1',
                                minWidth: '70px',
                                textAlign: 'center'
                              }}
                            >
                              <div style={{ color: '#8b949e' }}>
                                {player.finalRank === 1 ? '🥇' :
                                 player.finalRank === 2 ? '🥈' :
                                 player.finalRank === 3 ? '🥉' : `#${player.finalRank}`}
                              </div>
                              <div style={{
                                color: player.odUserId === currentUserId ? '#00d9ff' : '#ffffff',
                                fontWeight: 'bold'
                              }}>
                                {player.odUserId === currentUserId ? 'You' : (player.displayName?.slice(0, 6) || 'Player')}
                              </div>
                              <div style={{
                                color: player.finalGain >= 0 ? '#10b981' : '#ef4444',
                                fontSize: '10px'
                              }}>
                                {player.finalGain >= 0 ? '+' : ''}{player.finalGain?.toFixed(1)}%
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Battle Info */}
                        <div style={{
                          marginTop: '12px',
                          paddingTop: '12px',
                          borderTop: '1px solid #21262d',
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: '#6e7681',
                          fontSize: '11px'
                        }}>
                          <span>{battle.code || 'Draft Battle'}</span>
                          <span>{battle.type === 'stocks' ? '📈 Stocks' : '🪙 Crypto'}</span>
                          <span>4-Player Draft</span>
                        </div>
                      </div>
                    );
                  }

                  // Classic battle card (2 players)
                  return (
                    <BattleHistoryCard
                      key={battle.battleId || index}
                      battle={battle}
                      userId={user?.odUserId}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PROFILE SCREEN - REDESIGNED
  if (screen === 'profile') {
    const userStats = {
      xp: user.xp || 0,
      wins: user.wins || 0,
      losses: user.losses || 0,
      totalBattles: (user.wins || 0) + (user.losses || 0),
      rank: (user.xp || 0) >= 5000 ? 'Master' : (user.xp || 0) >= 2000 ? 'Expert' : (user.xp || 0) >= 500 ? 'Veteran' : 'Beginner'
    };

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', backgroundColor: '#0d1117' }}>

          {/* HEADER */}
          <div style={{
            background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
            borderBottom: '1px solid #21262d',
            padding: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div style={{
              maxWidth: '600px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <button
                onClick={() => setScreen('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#00d9ff',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button>

              <h1 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#ffffff'
              }}>
                Profile
              </h1>

              <div style={{ width: '60px' }}></div>
            </div>
          </div>

          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '0 16px 40px 16px'
          }}>

            {/* USER CARD */}
            <div style={{
              background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
              border: '2px solid #00d9ff',
              borderRadius: '16px',
              padding: '24px',
              marginTop: '24px',
              marginBottom: '24px',
              boxShadow: '0 10px 40px rgba(0, 217, 255, 0.1)'
            }}>
              {/* Avatar and Username */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                  border: '3px solid #00d9ff',
                  boxShadow: '0 0 30px rgba(0, 217, 255, 0.4)',
                  marginBottom: '16px'
                }}>
                  👤
                </div>

                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  marginBottom: '8px'
                }}>
                  {user?.username || 'Player'}
                </h2>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#8b5cf6',
                  padding: '6px 16px',
                  borderRadius: '20px'
                }}>
                  <span style={{ fontSize: '18px' }}>🏅</span>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#ffffff'
                  }}>
                    {userStats.rank}
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginTop: '20px'
              }}>
                {/* XP */}
                <div style={{
                  backgroundColor: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8b949e',
                    marginBottom: '6px',
                    fontWeight: '600'
                  }}>
                    EXPERIENCE
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#00d9ff',
                    marginBottom: '4px'
                  }}>
                    {userStats.xp}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#6e7681'
                  }}>
                    {1000 - (userStats.xp % 1000)} to next level
                  </div>
                </div>

                {/* Win Rate */}
                <div style={{
                  backgroundColor: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#8b949e',
                    marginBottom: '6px',
                    fontWeight: '600'
                  }}>
                    WIN RATE
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: userStats.totalBattles > 0 && (userStats.wins / userStats.totalBattles) >= 0.5 ? '#22c55e' : '#ef4444',
                    marginBottom: '4px'
                  }}>
                    {userStats.totalBattles > 0
                      ? `${Math.round((userStats.wins / userStats.totalBattles) * 100)}%`
                      : '0%'}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#6e7681'
                  }}>
                    {userStats.totalBattles} battles
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '12px', color: '#8b949e', fontWeight: '600' }}>
                    LEVEL PROGRESS
                  </span>
                  <span style={{ fontSize: '12px', color: '#00d9ff', fontWeight: 'bold' }}>
                    {Math.floor(((userStats.xp % 1000) / 1000) * 100)}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#21262d',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${((userStats.xp % 1000) / 1000) * 100}%`,
                    background: 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>

            {/* BATTLE RECORD */}
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: '12px',
              marginTop: '24px'
            }}>
              Battle Record
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {/* Wins */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #22c55e',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏆</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#22c55e',
                  marginBottom: '4px'
                }}>
                  {userStats.wins}
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Wins</div>
              </div>

              {/* Losses */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>💀</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#ef4444',
                  marginBottom: '4px'
                }}>
                  {userStats.losses}
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Losses</div>
              </div>

              {/* Total */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #8b5cf6',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚔️</div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#8b5cf6',
                  marginBottom: '4px'
                }}>
                  {userStats.totalBattles}
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e' }}>Total</div>
              </div>
            </div>

            {/* ACHIEVEMENTS */}
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#ffffff',
              marginBottom: '12px'
            }}>
              Achievements
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}>
              {/* First Win */}
              <div style={{
                backgroundColor: '#161b22',
                border: `2px solid ${userStats.wins >= 1 ? '#fbbf24' : '#21262d'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                opacity: userStats.wins >= 1 ? 1 : 0.5
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {userStats.wins >= 1 ? '🏆' : '🔒'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: userStats.wins >= 1 ? '#fbbf24' : '#6e7681',
                  fontWeight: '600'
                }}>
                  First Win
                </div>
              </div>

              {/* 10 Wins */}
              <div style={{
                backgroundColor: '#161b22',
                border: `2px solid ${userStats.wins >= 10 ? '#fbbf24' : '#21262d'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                opacity: userStats.wins >= 10 ? 1 : 0.5
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {userStats.wins >= 10 ? '🔥' : '🔒'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: userStats.wins >= 10 ? '#fbbf24' : '#6e7681',
                  fontWeight: '600'
                }}>
                  10 Wins
                </div>
              </div>

              {/* 50 Battles */}
              <div style={{
                backgroundColor: '#161b22',
                border: `2px solid ${userStats.totalBattles >= 50 ? '#fbbf24' : '#21262d'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                opacity: userStats.totalBattles >= 50 ? 1 : 0.5
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {userStats.totalBattles >= 50 ? '⚔️' : '🔒'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: userStats.totalBattles >= 50 ? '#fbbf24' : '#6e7681',
                  fontWeight: '600'
                }}>
                  50 Battles
                </div>
              </div>

              {/* Master Rank */}
              <div style={{
                backgroundColor: '#161b22',
                border: `2px solid ${userStats.rank === 'Master' ? '#fbbf24' : '#21262d'}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                opacity: userStats.rank === 'Master' ? 1 : 0.5
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {userStats.rank === 'Master' ? '👑' : '🔒'}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: userStats.rank === 'Master' ? '#fbbf24' : '#6e7681',
                  fontWeight: '600'
                }}>
                  Master Rank
                </div>
              </div>

              {/* Perfect Week */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #21262d',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                opacity: 0.5
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
                <div style={{
                  fontSize: '11px',
                  color: '#6e7681',
                  fontWeight: '600'
                }}>
                  Perfect Week
                </div>
              </div>

              {/* Comeback King */}
              <div style={{
                backgroundColor: '#161b22',
                border: '2px solid #21262d',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                opacity: 0.5
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
                <div style={{
                  fontSize: '11px',
                  color: '#6e7681',
                  fontWeight: '600'
                }}>
                  Comeback
                </div>
              </div>
            </div>

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