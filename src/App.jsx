import React, { useState, useEffect } from 'react';
import { loadBattlesSafe, saveBattlesSafe, isSameBattles, loadUser, saveUser } from './services/LocalStorage';
import * as battleTimer from './services/battleTimer';
import * as challengeService from './services/challengeService';
// EODHD API - All-in-one provider for stocks and crypto (replaces Finnhub + CoinGecko)
import { stockAPI, POPULAR_STOCKS, POPULAR_CRYPTO, FALLBACK_CRYPTO_PRICES, getMarketNews, getTopMoversWithNews } from './services/eodhdAPI';
import './firebase/config';
import { motion } from 'framer-motion';
// Event watchlist configuration for Week Ahead calendar
import { EVENT_TYPE_CONFIG } from './data/eventWatchlist';
// Static week ahead events (manual data)
import { getWeekAheadEvents } from './data/weekAheadEvents';
// AI Advisors
import ResearchAdvisor from './components/ResearchAdvisor';
import DraftAdvisor from './components/DraftAdvisor';
// Research Mode services
import { generateGamePlan, enhanceRecommendations, getAssetDeepDive } from './services/researchAdvisor';
// Recommendation Engine
import {
  getRecommendations,
  generateGenericExplanation,
  filterBySector,
  getAvailableSectors,
} from './services/recommendationEngine';

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
        <tspan fill="#00d9ff">MARKET</tspan><tspan fill="#e6edf3">CLASH</tspan>
      </text>

      <text x="225" y="323" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="10" fontWeight="400" letterSpacing="3" fill="#8b949e">
        PORTFOLIO BATTLES
      </text>
    </svg>
  );
};

// ============================================
// SAFE NUMBER UTILITIES (prevent toFixed errors)
// ============================================

// Safe number conversion for price/percent values
const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? fallback : num;
};

// Safe toFixed that always works
const safeToFixed = (val, decimals = 2, fallback = 0) => {
  return safeNumber(val, fallback).toFixed(decimals);
};

// ============================================
// DESKTOP BACKGROUND COMPONENT
// ============================================

const DesktopBackground = ({ isDesktop }) => {
  if (!isDesktop) return null;

  // Generate stable particle positions
  const particles = React.useMemo(() => {
    return [...Array(15)].map((_, i) => ({
      id: i,
      left: `${(i * 7 + 5) % 100}%`,
      top: `${(i * 11 + 10) % 100}%`,
      color: i % 3 === 0 ? '#00d9ff' : i % 3 === 1 ? '#00ff88' : '#8b5cf6',
      duration: 12 + (i % 5) * 2,
      delay: (i % 4) * 1.5,
    }));
  }, []);

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes gradientPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes bullGlow {
          0%, 100% { opacity: 0.05; filter: drop-shadow(0 0 20px rgba(0, 255, 136, 0.2)); }
          50% { opacity: 0.08; filter: drop-shadow(0 0 40px rgba(0, 255, 136, 0.4)); }
        }
        @keyframes bearGlow {
          0%, 100% { opacity: 0.05; filter: drop-shadow(0 0 20px rgba(255, 71, 87, 0.2)); }
          50% { opacity: 0.08; filter: drop-shadow(0 0 40px rgba(255, 71, 87, 0.4)); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-15px) translateX(8px); }
          50% { transform: translateY(-8px) translateX(-8px); }
          75% { transform: translateY(-20px) translateX(4px); }
        }
        @keyframes priceDraw {
          0% { stroke-dashoffset: 1000; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Background Container */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Gradient Mesh Base */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(ellipse at 15% 20%, rgba(0, 217, 255, 0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 80%, rgba(139, 92, 246, 0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 15% 80%, rgba(0, 255, 136, 0.04) 0%, transparent 40%),
            radial-gradient(ellipse at 85% 20%, rgba(255, 71, 87, 0.04) 0%, transparent 40%)
          `,
          animation: 'gradientPulse 10s ease-in-out infinite',
        }} />

        {/* Animated Price Lines - Left Side */}
        <svg
          style={{
            position: 'absolute',
            left: 0,
            top: '15%',
            width: '25%',
            height: '50%',
            opacity: 0.08,
          }}
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <path
            d="M0 150 Q50 120 100 140 T200 100 T300 130 T400 80"
            stroke="#00d9ff"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 20s ease-in-out infinite' }}
          />
          <path
            d="M0 180 Q50 200 100 170 T200 190 T300 150 T400 170"
            stroke="#00ff88"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 25s ease-in-out infinite', animationDelay: '2s' }}
          />
          <path
            d="M0 220 Q50 180 100 210 T200 180 T300 220 T400 190"
            stroke="#ff4757"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 18s ease-in-out infinite', animationDelay: '4s' }}
          />
        </svg>

        {/* Animated Price Lines - Right Side */}
        <svg
          style={{
            position: 'absolute',
            right: 0,
            top: '25%',
            width: '25%',
            height: '45%',
            opacity: 0.08,
            transform: 'scaleX(-1)',
          }}
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <path
            d="M0 150 Q50 100 100 130 T200 90 T300 120 T400 70"
            stroke="#00d9ff"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 22s ease-in-out infinite', animationDelay: '1s' }}
          />
          <path
            d="M0 180 Q50 160 100 190 T200 150 T300 180 T400 140"
            stroke="#8b5cf6"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            style={{ animation: 'priceDraw 28s ease-in-out infinite', animationDelay: '3s' }}
          />
        </svg>

        {/* Bull Silhouette - Left Side */}
        <div style={{
          position: 'absolute',
          left: '-3%',
          bottom: '8%',
          width: '250px',
          height: '250px',
          animation: 'bullGlow 5s ease-in-out infinite',
        }}>
          <svg viewBox="0 0 100 100" fill="#00ff88">
            <path d="M20 80 L20 50 Q20 30 35 25 L35 15 L40 25 Q50 20 60 25 L60 15 L65 25 Q80 30 80 50 L80 80 Q70 85 50 85 Q30 85 20 80 Z" />
            <ellipse cx="35" cy="45" rx="5" ry="8" fill="#059669" />
            <ellipse cx="65" cy="45" rx="5" ry="8" fill="#059669" />
            <path d="M30 15 Q25 5 15 10" stroke="#00ff88" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M70 15 Q75 5 85 10" stroke="#00ff88" strokeWidth="4" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Bear Silhouette - Right Side */}
        <div style={{
          position: 'absolute',
          right: '-3%',
          bottom: '8%',
          width: '230px',
          height: '230px',
          animation: 'bearGlow 5s ease-in-out infinite',
          animationDelay: '2.5s',
        }}>
          <svg viewBox="0 0 100 100" fill="#ff4757">
            <ellipse cx="50" cy="55" rx="28" ry="32" />
            <circle cx="30" cy="28" r="11" />
            <circle cx="70" cy="28" r="11" />
            <circle cx="30" cy="28" r="5" fill="#dc2626" />
            <circle cx="70" cy="28" r="5" fill="#dc2626" />
            <ellipse cx="50" cy="52" rx="16" ry="18" fill="#f87171" />
            <ellipse cx="50" cy="47" rx="7" ry="5" fill="#1a1a2e" />
          </svg>
        </div>

        {/* Floating Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: p.color,
              opacity: 0.15,
              left: p.left,
              top: p.top,
              animation: `floatParticle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
};

// ============================================
// PINNABLE INSIGHT COMPONENT
// ============================================

/**
 * PinnableInsight - A metric with explanation that can be saved to notes
 */
const PinnableInsight = ({ title, value, explanation, symbol, onPin, isPinned, colors }) => {
  const defaultColors = {
    green: '#00ff88',
    red: '#ff4757',
    cyan: '#00d9ff',
  };
  const c = colors || defaultColors;

  const handlePin = () => {
    if (onPin && !isPinned) {
      onPin({
        symbol,
        metricName: title,
        metricValue: value,
        explanation,
        source: 'research_flow',
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: '1px solid #2d3548',
    }}>
      {/* Metric Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>{title}</span>
        <span style={{
          color: value?.toString().startsWith('+') ? c.green : value?.toString().startsWith('-') ? c.red : '#e6edf3',
          fontSize: '18px',
          fontWeight: '600',
        }}>
          {value}
        </span>
      </div>

      {/* Explanation */}
      <div style={{
        background: '#161b22',
        borderRadius: '8px',
        padding: '12px',
        marginTop: '8px',
        borderLeft: '3px solid #00d9ff',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          marginBottom: '8px',
        }}>
          <span style={{ color: '#00d9ff' }}>*</span>
          <span style={{ color: '#c9d1d9', fontSize: '14px', lineHeight: '1.5' }}>
            {explanation}
          </span>
        </div>

        {/* Pin Button */}
        <button
          onClick={handlePin}
          disabled={isPinned}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: 'auto',
            padding: '6px 12px',
            background: isPinned ? '#238636' : 'transparent',
            border: `1px solid ${isPinned ? '#238636' : '#3d4450'}`,
            borderRadius: '6px',
            color: isPinned ? '#ffffff' : '#8b949e',
            fontSize: '12px',
            cursor: isPinned ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isPinned ? 'Saved' : 'Save Insight'}
        </button>
      </div>
    </div>
  );
};

// ============================================
// STOCK METRICS COMPONENT (for Asset Detail)
// ============================================

const StockMetricsDisplay = ({ asset, thesis, pinnedNotes, onPinInsight, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  const isPinned = (metricName) => {
    return pinnedNotes?.some(n =>
      n.symbol === asset.symbol && n.metricName === metricName
    );
  };

  // Calculate 52-week position percentage
  const week52Position = asset.week52High && asset.week52Low
    ? ((safeNumber(asset.price) - safeNumber(asset.week52Low)) / (safeNumber(asset.week52High) - safeNumber(asset.week52Low)) * 100).toFixed(0)
    : null;

  // Determine momentum strength
  const getMomentumStrength = (change) => {
    if (change > 10) return { label: 'Very Strong', color: c.green };
    if (change > 5) return { label: 'Strong', color: c.green };
    if (change > 0) return { label: 'Positive', color: c.cyan };
    if (change > -5) return { label: 'Weak', color: '#f59e0b' };
    return { label: 'Negative', color: c.red };
  };

  const change7d = safeNumber(asset.priceChange7d);
  const change30d = safeNumber(asset.priceChange30d);
  const percentChange = safeNumber(asset.percentChange);
  const momentum = getMomentumStrength(change7d);

  return (
    <div>
      {/* MOMENTUM SECTION */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
          PRICE MOMENTUM
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center', padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Today</div>
            <div style={{ color: percentChange >= 0 ? c.green : c.red, fontSize: '18px', fontWeight: '600' }}>
              {percentChange >= 0 ? '+' : ''}{safeToFixed(percentChange, 2)}%
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>7 Days</div>
            <div style={{ color: change7d >= 0 ? c.green : c.red, fontSize: '18px', fontWeight: '600' }}>
              {change7d >= 0 ? '+' : ''}{safeToFixed(change7d, 2)}%
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>30 Days</div>
            <div style={{ color: change30d >= 0 ? c.green : c.red, fontSize: '18px', fontWeight: '600' }}>
              {change30d >= 0 ? '+' : ''}{safeToFixed(change30d, 2)}%
            </div>
          </div>
        </div>

        <PinnableInsight
          title="Momentum Read"
          value={momentum.label}
          explanation={`${asset.symbol} ${change7d >= 0 ? 'has gained' : 'has lost'} ${Math.abs(change7d).toFixed(1)}% over the past week. ${
            change7d > 5
              ? 'Strong momentum often continues short-term, but extended rallies can reverse quickly.'
              : change7d < -5
              ? 'Negative momentum may continue, but oversold conditions can lead to bounces.'
              : 'Moderate movement suggests the stock is in a consolidation phase.'
          }`}
          symbol={asset.symbol}
          onPin={onPinInsight}
          isPinned={isPinned('Momentum Read')}
          colors={c}
        />
      </div>

      {/* VOLATILITY SECTION */}
      {asset.beta && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
            VOLATILITY & RISK
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#8b949e' }}>Beta</span>
              <span style={{ color: '#e6edf3', fontWeight: '600' }}>{safeToFixed(asset.beta, 2)}</span>
            </div>
            {/* Beta scale visualization */}
            <div style={{ position: 'relative', height: '8px', background: '#161b22', borderRadius: '4px' }}>
              <div style={{
                position: 'absolute',
                left: `${Math.min(Math.max((safeNumber(asset.beta) / 2) * 100, 0), 100)}%`,
                top: '-4px',
                width: '16px',
                height: '16px',
                background: c.cyan,
                borderRadius: '50%',
                transform: 'translateX(-50%)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#6e7681' }}>
              <span>Defensive</span>
              <span>Market</span>
              <span>Aggressive</span>
            </div>
          </div>

          <PinnableInsight
            title="Beta Analysis"
            value={safeNumber(asset.beta) > 1.3 ? 'High Volatility' : safeNumber(asset.beta) < 0.8 ? 'Low Volatility' : 'Market Average'}
            explanation={`With a beta of ${safeToFixed(asset.beta, 2)}, ${asset.symbol} typically moves ${(safeNumber(asset.beta) * 100).toFixed(0)}% as much as the market. ${
              safeNumber(asset.beta) > 1.3
                ? 'This amplifies both gains and losses - good for aggressive plays if your direction is right.'
                : safeNumber(asset.beta) < 0.8
                ? 'Lower volatility means more stability but potentially smaller gains in a 24-hour window.'
                : 'Average volatility provides a balance of movement potential and stability.'
            }`}
            symbol={asset.symbol}
            onPin={onPinInsight}
            isPinned={isPinned('Beta Analysis')}
            colors={c}
          />
        </div>
      )}

      {/* 52-WEEK POSITION */}
      {week52Position && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
            52-WEEK POSITION
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ position: 'relative', height: '8px', background: '#161b22', borderRadius: '4px', marginBottom: '8px' }}>
              <div style={{
                position: 'absolute',
                left: `${week52Position}%`,
                top: '-4px',
                width: '16px',
                height: '16px',
                background: c.cyan,
                borderRadius: '50%',
                transform: 'translateX(-50%)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#8b949e' }}>${safeToFixed(asset.week52Low, 2)}</span>
              <span style={{ color: c.cyan }}>${safeToFixed(asset.price, 2)} ({week52Position}%)</span>
              <span style={{ color: '#8b949e' }}>${safeToFixed(asset.week52High, 2)}</span>
            </div>
          </div>

          <PinnableInsight
            title="Range Context"
            value={`${week52Position}% of 52-week range`}
            explanation={`${asset.symbol} is trading at ${week52Position}% of its yearly range. ${
              parseInt(week52Position) > 80
                ? 'Near yearly highs - momentum is strong but upside may be limited.'
                : parseInt(week52Position) < 20
                ? 'Near yearly lows - could be a value opportunity or a falling knife.'
                : 'Mid-range positioning suggests room to move in either direction.'
            }`}
            symbol={asset.symbol}
            onPin={onPinInsight}
            isPinned={isPinned('Range Context')}
            colors={c}
          />
        </div>
      )}

      {/* ANALYST SENTIMENT (if available) */}
      {asset.analystRating && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
            ANALYST SENTIMENT
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div style={{ flex: asset.analystRating.buy || 1, height: '24px', background: '#238636', borderRadius: '4px 0 0 4px' }} />
              <div style={{ flex: asset.analystRating.hold || 1, height: '24px', background: '#f59e0b' }} />
              <div style={{ flex: asset.analystRating.sell || 1, height: '24px', background: c.red, borderRadius: '0 4px 4px 0' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8b949e' }}>
              <span>Buy: {asset.analystRating.buy || 0}</span>
              <span>Hold: {asset.analystRating.hold || 0}</span>
              <span>Sell: {asset.analystRating.sell || 0}</span>
            </div>
          </div>

          <PinnableInsight
            title="Analyst Consensus"
            value={`${((safeNumber(asset.analystRating.buy) / (safeNumber(asset.analystRating.buy) + safeNumber(asset.analystRating.hold) + safeNumber(asset.analystRating.sell))) * 100).toFixed(0)}% Bullish`}
            explanation={`${asset.analystRating.buy} analysts rate ${asset.symbol} as a buy. Analyst consensus can indicate institutional sentiment, though analysts often lag behind price movements.`}
            symbol={asset.symbol}
            onPin={onPinInsight}
            isPinned={isPinned('Analyst Consensus')}
            colors={c}
          />
        </div>
      )}

      {/* EARNINGS WARNING (if upcoming) */}
      {asset.earningsDate && (
        <div style={{
          marginBottom: '24px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid #f59e0b',
          borderRadius: '12px',
          padding: '16px',
        }}>
          <h3 style={{ color: '#f59e0b', fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            UPCOMING EARNINGS
          </h3>

          <div style={{ color: '#e6edf3', marginBottom: '12px' }}>
            {new Date(asset.earningsDate).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>

          <PinnableInsight
            title="Earnings Warning"
            value="Event Risk"
            explanation={`${asset.symbol} reports earnings soon. If your battle overlaps this date, expect significant price movement - stocks often swing 5-15% on earnings regardless of direction. This adds uncertainty to any thesis.`}
            symbol={asset.symbol}
            onPin={onPinInsight}
            isPinned={isPinned('Earnings Warning')}
            colors={c}
          />
        </div>
      )}
    </div>
  );
};

// ============================================
// CRYPTO METRICS COMPONENT (for Asset Detail)
// ============================================

const CryptoMetricsDisplay = ({ asset, thesis, pinnedNotes, onPinInsight, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  const isPinned = (metricName) => {
    return pinnedNotes?.some(n =>
      n.symbol === asset.symbol && n.metricName === metricName
    );
  };

  const change7d = safeNumber(asset.priceChange7d);
  const change30d = safeNumber(asset.priceChange30d);
  const change24h = safeNumber(asset.percentChange || asset.change24h);

  // Mock correlation data (in production, calculate from price history)
  const btcCorrelation = asset.symbol === 'BTC' ? 1.0
    : ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX'].includes(asset.symbol) ? 0.7 + Math.random() * 0.2
    : ['USDT', 'USDC'].includes(asset.symbol) ? 0.1
    : 0.4 + Math.random() * 0.3;

  // Determine momentum label
  const getMomentumLabel = () => {
    if (change7d > 15) return { label: 'Surging', color: c.green };
    if (change7d > 8) return { label: 'Hot', color: c.green };
    if (change7d > 3) return { label: 'Climbing', color: c.cyan };
    if (change7d > -3) return { label: 'Stable', color: '#8b949e' };
    if (change7d > -8) return { label: 'Cooling', color: '#f59e0b' };
    return { label: 'Cold', color: c.red };
  };

  const momentum = getMomentumLabel();

  return (
    <div>
      {/* MOMENTUM & HYPE */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
          MOMENTUM & HYPE
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center', padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>24h</div>
            <div style={{ color: change24h >= 0 ? c.green : c.red, fontSize: '18px', fontWeight: '600' }}>
              {change24h >= 0 ? '+' : ''}{safeToFixed(change24h, 2)}%
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>7d</div>
            <div style={{ color: change7d >= 0 ? c.green : c.red, fontSize: '18px', fontWeight: '600' }}>
              {change7d >= 0 ? '+' : ''}{safeToFixed(change7d, 2)}%
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>30d</div>
            <div style={{ color: change30d >= 0 ? c.green : c.red, fontSize: '18px', fontWeight: '600' }}>
              {change30d >= 0 ? '+' : ''}{safeToFixed(change30d, 2)}%
            </div>
          </div>
        </div>

        <PinnableInsight
          title="Momentum Read"
          value={momentum.label}
          explanation={`${asset.symbol} is ${change7d >= 0 ? 'up' : 'down'} ${Math.abs(change7d).toFixed(1)}% over 7 days. ${
            change7d > 10
              ? 'Strong crypto momentum often continues but corrections can be sharp and sudden.'
              : change7d < -10
              ? 'Significant pullback - could be oversold or beginning of larger downtrend.'
              : 'Moderate activity suggests consolidation phase.'
          }`}
          symbol={asset.symbol}
          onPin={onPinInsight}
          isPinned={isPinned('Momentum Read')}
          colors={c}
        />
      </div>

      {/* MARKET POSITION */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
          MARKET POSITION
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Market Cap</div>
            <div style={{ color: '#e6edf3', fontSize: '16px', fontWeight: '600' }}>
              ${asset.marketCap ? (asset.marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}
            </div>
          </div>
          <div style={{ padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Category</div>
            <div style={{ color: c.cyan, fontSize: '16px', fontWeight: '600' }}>
              {asset.category || 'N/A'}
            </div>
          </div>
        </div>

        <PinnableInsight
          title="Size Context"
          value={safeNumber(asset.marketCap) > 50e9 ? 'Large Cap' : safeNumber(asset.marketCap) > 10e9 ? 'Mid Cap' : 'Small Cap'}
          explanation={`${asset.symbol} is a ${safeNumber(asset.marketCap) > 50e9 ? 'large' : safeNumber(asset.marketCap) > 10e9 ? 'mid' : 'small'}-cap crypto. ${
            safeNumber(asset.marketCap) > 50e9
              ? 'Larger coins tend to be less volatile but still swing more than stocks.'
              : safeNumber(asset.marketCap) > 10e9
              ? 'Mid-size coins balance liquidity with growth potential.'
              : 'Smaller caps can see explosive moves but carry higher risk.'
          }`}
          symbol={asset.symbol}
          onPin={onPinInsight}
          isPinned={isPinned('Size Context')}
          colors={c}
        />
      </div>

      {/* BTC CORRELATION */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
          BTC CORRELATION
        </h3>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#8b949e' }}>Correlation Score</span>
            <span style={{ color: '#e6edf3', fontWeight: '600' }}>{btcCorrelation.toFixed(2)}</span>
          </div>
          <div style={{ position: 'relative', height: '8px', background: '#161b22', borderRadius: '4px' }}>
            <div style={{
              width: `${btcCorrelation * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #00d9ff, #f7931a)',
              borderRadius: '4px',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: '#6e7681' }}>
            <span>Independent</span>
            <span>Correlated</span>
          </div>
        </div>

        <PinnableInsight
          title="BTC Relationship"
          value={btcCorrelation > 0.7 ? 'High Correlation' : btcCorrelation > 0.4 ? 'Moderate' : 'Low Correlation'}
          explanation={`${asset.symbol} has a ${btcCorrelation.toFixed(2)} correlation with Bitcoin. ${
            btcCorrelation > 0.7
              ? 'Tends to follow BTC direction - if BTC dumps, expect this to dump too, often harder.'
              : btcCorrelation > 0.4
              ? 'Some relationship with BTC but can move independently on its own catalysts.'
              : 'Moves relatively independently from Bitcoin - useful for diversification.'
          }`}
          symbol={asset.symbol}
          onPin={onPinInsight}
          isPinned={isPinned('BTC Relationship')}
          colors={c}
        />
      </div>

      {/* TRADING ACTIVITY */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
          TRADING ACTIVITY
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>24h Volume</div>
            <div style={{ color: '#e6edf3', fontSize: '16px', fontWeight: '600' }}>
              ${safeNumber(asset.volume24h) >= 1e9 ? (safeNumber(asset.volume24h) / 1e9).toFixed(2) + 'B' : (safeNumber(asset.volume24h) / 1e6).toFixed(0) + 'M'}
            </div>
          </div>
          <div style={{ padding: '12px', background: '#161b22', borderRadius: '8px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>Vol/MCap Ratio</div>
            <div style={{ color: '#e6edf3', fontSize: '16px', fontWeight: '600' }}>
              {safeNumber(asset.volume24h) && safeNumber(asset.marketCap)
                ? ((safeNumber(asset.volume24h) / safeNumber(asset.marketCap)) * 100).toFixed(1) + '%'
                : 'N/A'}
            </div>
          </div>
        </div>

        <PinnableInsight
          title="Liquidity Check"
          value={safeNumber(asset.volume24h) > 1e9 ? 'High Activity' : safeNumber(asset.volume24h) > 100e6 ? 'Normal' : 'Low Volume'}
          explanation={`${asset.symbol} has ${safeNumber(asset.volume24h) > 1e9 ? 'high' : safeNumber(asset.volume24h) > 100e6 ? 'moderate' : 'low'} trading volume. ${
            safeNumber(asset.volume24h) > 1e9
              ? 'Active trading means the price is being actively discovered - more movement potential.'
              : 'Lower volume can mean less price discovery but also potential for sudden moves on news.'
          }`}
          symbol={asset.symbol}
          onPin={onPinInsight}
          isPinned={isPinned('Liquidity Check')}
          colors={c}
        />
      </div>

      {/* CATEGORY CONTEXT */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid #2d3548', paddingBottom: '8px' }}>
          CATEGORY CONTEXT
        </h3>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          background: '#161b22',
          borderRadius: '8px',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '24px' }}>
            {asset.category === 'Layer 1' ? '[]' :
             asset.category === 'Layer 2' ? '>' :
             asset.category === 'DeFi' ? '#' :
             asset.category === 'Meme' ? '@' :
             asset.category === 'Stablecoin' ? '$' :
             asset.category === 'Payment' ? '*' : '~'}
          </span>
          <div>
            <div style={{ color: '#e6edf3', fontWeight: '600' }}>{asset.category || 'Unknown'}</div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>
              {asset.category === 'Layer 1' ? 'Base blockchain protocol' :
               asset.category === 'Layer 2' ? 'Scaling solution' :
               asset.category === 'DeFi' ? 'Decentralized finance' :
               asset.category === 'Meme' ? 'Community-driven token' :
               asset.category === 'Stablecoin' ? 'Dollar-pegged token' :
               asset.category === 'Payment' ? 'Payment & utility' : 'Alternative chain'}
            </div>
          </div>
        </div>

        <PinnableInsight
          title="Category Dynamics"
          value={asset.category || 'Unknown'}
          explanation={`${asset.symbol} is a ${asset.category || 'crypto'} token. ${
            asset.category === 'Meme'
              ? 'Meme coins are highly volatile and sentiment-driven - can see 20%+ swings on social media hype.'
              : asset.category === 'Stablecoin'
              ? 'Stablecoins maintain ~$1 value - useful for defensive positioning but won\'t generate battle returns.'
              : asset.category === 'Layer 1'
              ? 'Layer 1 chains often move together. When one pumps, peers may follow.'
              : asset.category === 'DeFi'
              ? 'DeFi tokens correlate with overall crypto sentiment and TVL flows.'
              : 'Category performance can influence individual token movements.'
          }`}
          symbol={asset.symbol}
          onPin={onPinInsight}
          isPinned={isPinned('Category Dynamics')}
          colors={c}
        />
      </div>
    </div>
  );
};

// ============================================
// CONVICTION CHECK COMPONENT (Research Phase 4)
// ============================================

/**
 * ConvictionCheck - Collect user preferences before generating game plan
 * Must-have assets, must-avoid assets, and confidence level
 */
const ConvictionCheck = ({
  thesis,
  recommendations,
  onComplete,
  onBack,
  onOpenAssetPicker,
  convictionData,
  setConvictionData,
  colors,
}) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  const confidenceLevels = [
    { value: 'high', label: 'High', description: 'Concentrated positions OK', icon: '🎯' },
    { value: 'medium', label: 'Medium', description: 'Balanced approach', icon: '⚖️' },
    { value: 'low', label: 'Low', description: 'More diversification', icon: '🛡️' },
  ];

  const handleRemoveMustHave = (symbol) => {
    setConvictionData(prev => ({
      ...prev,
      mustHave: prev.mustHave.filter(s => s !== symbol),
    }));
  };

  const handleRemoveMustAvoid = (symbol) => {
    setConvictionData(prev => ({
      ...prev,
      mustAvoid: prev.mustAvoid.filter(s => s !== symbol),
    }));
  };

  const canProceed = convictionData.confidence !== null;

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #2d3548',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #9333ea, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            4
          </div>
          <h3 style={{ color: '#e6edf3', margin: 0, fontSize: '18px' }}>
            Conviction Check
          </h3>
        </div>
        <p style={{ color: '#8b949e', fontSize: '14px', margin: 0 }}>
          Fine-tune your preferences before we generate your personalized game plan
        </p>
      </div>

      {/* Must-Have Assets */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <label style={{ color: '#e6edf3', fontSize: '14px', fontWeight: '500' }}>
            Must-Have Assets
          </label>
          <button
            onClick={() => onOpenAssetPicker('mustHave')}
            style={{
              background: 'rgba(0, 217, 255, 0.1)',
              border: '1px solid rgba(0, 217, 255, 0.3)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: c.cyan,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            + Add Asset
          </button>
        </div>
        <div style={{
          background: '#1a1f2e',
          borderRadius: '8px',
          padding: '12px',
          minHeight: '48px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}>
          {convictionData.mustHave.length === 0 ? (
            <span style={{ color: '#6e7681', fontSize: '13px' }}>
              No must-have assets selected
            </span>
          ) : (
            convictionData.mustHave.map(symbol => (
              <div
                key={symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}
              >
                <span style={{ color: c.green, fontSize: '13px', fontWeight: '500' }}>
                  {symbol}
                </span>
                <button
                  onClick={() => handleRemoveMustHave(symbol)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8b949e',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '14px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Must-Avoid Assets */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <label style={{ color: '#e6edf3', fontSize: '14px', fontWeight: '500' }}>
            Must-Avoid Assets
          </label>
          <button
            onClick={() => onOpenAssetPicker('mustAvoid')}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#ef4444',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            + Add Asset
          </button>
        </div>
        <div style={{
          background: '#1a1f2e',
          borderRadius: '8px',
          padding: '12px',
          minHeight: '48px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        }}>
          {convictionData.mustAvoid.length === 0 ? (
            <span style={{ color: '#6e7681', fontSize: '13px' }}>
              No must-avoid assets selected
            </span>
          ) : (
            convictionData.mustAvoid.map(symbol => (
              <div
                key={symbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}
              >
                <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '500' }}>
                  {symbol}
                </span>
                <button
                  onClick={() => handleRemoveMustAvoid(symbol)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8b949e',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '14px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confidence Level */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          color: '#e6edf3',
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '12px',
          display: 'block',
        }}>
          Confidence in Your Thesis
        </label>
        <div style={{ display: 'flex', gap: '12px' }}>
          {confidenceLevels.map(level => (
            <button
              key={level.value}
              onClick={() => setConvictionData(prev => ({ ...prev, confidence: level.value }))}
              style={{
                flex: 1,
                background: convictionData.confidence === level.value
                  ? 'rgba(0, 217, 255, 0.15)'
                  : '#1a1f2e',
                border: convictionData.confidence === level.value
                  ? '2px solid #00d9ff'
                  : '1px solid #2d3548',
                borderRadius: '12px',
                padding: '16px 12px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{level.icon}</div>
              <div style={{
                color: convictionData.confidence === level.value ? c.cyan : '#e6edf3',
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '4px',
              }}>
                {level.label}
              </div>
              <div style={{ color: '#8b949e', fontSize: '11px' }}>
                {level.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid #2d3548',
            borderRadius: '12px',
            padding: '14px',
            color: '#00d9ff',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => onComplete(convictionData)}
          disabled={!canProceed}
          style={{
            flex: 2,
            background: canProceed
              ? 'linear-gradient(135deg, #9333ea, #6366f1)'
              : '#2d3548',
            border: 'none',
            borderRadius: '12px',
            padding: '14px',
            color: canProceed ? '#ffffff' : '#6e7681',
            fontSize: '14px',
            fontWeight: '600',
            cursor: canProceed ? 'pointer' : 'not-allowed',
          }}
        >
          Generate Game Plan →
        </button>
      </div>
    </div>
  );
};

// ============================================
// ASSET PICKER MODAL (for Conviction Check)
// ============================================

/**
 * AssetPickerModal - Search and select assets for must-have/must-avoid
 */
const AssetPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  type, // 'mustHave' or 'mustAvoid'
  stocksData,
  cryptoData,
  excludeSymbols = [],
  colors,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [assetType, setAssetType] = useState('all');
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  if (!isOpen) return null;

  // Combine and filter assets
  const allAssets = [
    ...stocksData.map(s => ({ ...s, assetType: 'stock' })),
    ...cryptoData.map(c => ({ ...c, assetType: 'crypto' })),
  ].filter(asset => !excludeSymbols.includes(asset.symbol));

  const filteredAssets = allAssets.filter(asset => {
    const matchesSearch = searchTerm === '' ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = assetType === 'all' ||
      (assetType === 'stocks' && asset.assetType === 'stock') ||
      (assetType === 'crypto' && asset.assetType === 'crypto');
    return matchesSearch && matchesType;
  }).slice(0, 20);

  const titleColor = type === 'mustHave' ? c.green : '#ef4444';
  const titleText = type === 'mustHave' ? 'Add Must-Have Asset' : 'Add Must-Avoid Asset';

  return (
    <div style={{
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
      padding: '20px',
    }}>
      <div style={{
        background: '#1a1f2e',
        borderRadius: '16px',
        padding: '24px',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h3 style={{ color: titleColor, margin: 0, fontSize: '18px' }}>
            {titleText}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Search & Filter */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: '#1a1f2e',
              border: '1px solid #2d3548',
              borderRadius: '8px',
              padding: '12px',
              color: '#e6edf3',
              fontSize: '14px',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'stocks', 'crypto'].map(t => (
              <button
                key={t}
                onClick={() => setAssetType(t)}
                style={{
                  flex: 1,
                  background: assetType === t ? 'rgba(0, 217, 255, 0.15)' : 'transparent',
                  border: assetType === t ? '1px solid #00d9ff' : '1px solid #2d3548',
                  borderRadius: '6px',
                  padding: '8px',
                  color: assetType === t ? c.cyan : '#8b949e',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Asset List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginRight: '-8px',
          paddingRight: '8px',
        }}>
          {filteredAssets.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px',
              color: '#6e7681',
            }}>
              No assets found
            </div>
          ) : (
            filteredAssets.map(asset => (
              <button
                key={asset.symbol}
                onClick={() => {
                  onSelect(asset.symbol);
                  onClose();
                }}
                style={{
                  width: '100%',
                  background: '#1a1f2e',
                  border: '1px solid #2d3548',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#21262d';
                  e.currentTarget.style.borderColor = type === 'mustHave' ? c.green : '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1f2e';
                  e.currentTarget.style.borderColor = '#2d3548';
                }}
              >
                <div>
                  <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '14px' }}>
                    {asset.symbol}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px' }}>
                    {asset.name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#e6edf3', fontSize: '14px' }}>
                    ${safeToFixed(asset.price, 2)}
                  </div>
                  <div style={{
                    color: safeNumber(asset.percentChange || asset.change24h) >= 0 ? c.green : '#ef4444',
                    fontSize: '12px',
                  }}>
                    {safeNumber(asset.percentChange || asset.change24h) >= 0 ? '+' : ''}
                    {safeToFixed(asset.percentChange || asset.change24h, 2)}%
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// GAME PLAN COMPONENT (Research Phase 5)
// ============================================

/**
 * GamePlan - Display the AI-generated portfolio strategy
 */
const GamePlan = ({
  gamePlan,
  thesis,
  convictionData,
  onUsePortfolio,
  onSaveToNotes,
  onBack,
  isLoading,
  colors,
}) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  if (isLoading) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '16px',
        padding: '48px 24px',
        border: '1px solid #2d3548',
        textAlign: 'center',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid #2d3548',
          borderTopColor: c.cyan,
          borderRadius: '50%',
          margin: '0 auto 16px',
          animation: 'spin 1s linear infinite',
        }} />
        <style>
          {`@keyframes spin { to { transform: rotate(360deg); } }`}
        </style>
        <p style={{ color: '#e6edf3', fontSize: '16px', marginBottom: '8px' }}>
          Analyzing your thesis...
        </p>
        <p style={{ color: '#8b949e', fontSize: '14px', margin: 0 }}>
          Building your personalized game plan
        </p>
      </div>
    );
  }

  if (!gamePlan) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '16px',
        padding: '32px 24px',
        border: '1px solid #2d3548',
        textAlign: 'center',
      }}>
        <p style={{ color: '#ef4444', fontSize: '16px', marginBottom: '16px' }}>
          Failed to generate game plan
        </p>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(0, 217, 255, 0.1)',
            border: '1px solid rgba(0, 217, 255, 0.3)',
            borderRadius: '8px',
            padding: '10px 20px',
            color: c.cyan,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          ← Back to Conviction Check
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid #2d3548',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #eab308)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
          }}>
            5
          </div>
          <h3 style={{ color: '#e6edf3', margin: 0, fontSize: '18px' }}>
            Your Game Plan
          </h3>
        </div>
      </div>

      {/* Strategy Summary */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1), rgba(99, 102, 241, 0.1))',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        border: '1px solid rgba(0, 217, 255, 0.2)',
      }}>
        <div style={{ color: c.cyan, fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
          STRATEGY
        </div>
        <p style={{ color: '#e6edf3', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
          {gamePlan.strategySummary}
        </p>
      </div>

      {/* Portfolio Allocations */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ color: '#e6edf3', fontSize: '14px', marginBottom: '12px' }}>
          Recommended Portfolio
        </h4>
        <div style={{
          background: '#1a1f2e',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {gamePlan.portfolio?.map((position, index) => (
            <div
              key={position.symbol}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: index < gamePlan.portfolio.length - 1 ? '1px solid #2d3548' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '24px',
                  background: `linear-gradient(90deg, ${c.cyan} ${position.allocation}%, #2d3548 ${position.allocation}%)`,
                  borderRadius: '4px',
                }} />
                <div>
                  <div style={{ color: '#e6edf3', fontWeight: '600', fontSize: '14px' }}>
                    {position.symbol}
                  </div>
                  {position.rationale && (
                    <div style={{ color: '#8b949e', fontSize: '11px', maxWidth: '200px' }}>
                      {position.rationale}
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                color: c.cyan,
                fontWeight: '600',
                fontSize: '16px',
              }}>
                {safeToFixed(position.allocation, 1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insight Connections */}
      {gamePlan.insightConnections && (
        <div style={{
          background: '#1a1f2e',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          borderLeft: '3px solid #9333ea',
        }}>
          <div style={{ color: '#9333ea', fontSize: '12px', marginBottom: '8px', fontWeight: '600' }}>
            HOW THIS CONNECTS TO YOUR RESEARCH
          </div>
          <p style={{ color: '#c9d1d9', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
            {gamePlan.insightConnections}
          </p>
        </div>
      )}

      {/* Risks */}
      {gamePlan.risks && gamePlan.risks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px' }}>
            ⚠️ Key Risks
          </h4>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}>
            {gamePlan.risks.map((risk, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: i < gamePlan.risks.length - 1 ? '8px' : 0,
                }}
              >
                <span style={{ color: '#ef4444' }}>•</span>
                <span style={{ color: '#c9d1d9', fontSize: '13px' }}>{risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={() => onUsePortfolio(gamePlan.portfolio)}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          Use This Portfolio →
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onSaveToNotes(gamePlan)}
            style={{
              flex: 1,
              background: 'rgba(147, 51, 234, 0.15)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              borderRadius: '12px',
              padding: '12px',
              color: '#9333ea',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Save to Notes
          </button>
          <button
            onClick={onBack}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #2d3548',
              borderRadius: '12px',
              padding: '12px',
              color: '#8b949e',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ← Adjust Preferences
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// NEWS COMPONENTS FOR MARKET BRIEFING
// ============================================

/**
 * TopNewsStories - Displays dynamic news headlines
 * Replaces the static Sector Snapshot
 */
const TopNewsStories = ({ news, isLoading, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  if (isLoading) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Top News Stories
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ height: '14px', background: '#2d3548', borderRadius: '4px', width: '80%', marginBottom: '8px' }} />
              <div style={{ height: '12px', background: '#2d3548', borderRadius: '4px', width: '40%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return null;
  }

  // Format time ago
  const getTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #2d3548',
    }}>
      <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>📰</span> Top News Stories
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {news.slice(0, 4).map((item, idx) => (
          <div
            key={item.id || idx}
            style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              cursor: item.url !== '#' ? 'pointer' : 'default',
              transition: 'all 0.2s',
              borderLeft: `3px solid ${idx === 0 ? c.cyan : '#2d3548'}`,
            }}
            onClick={() => item.url !== '#' && window.open(item.url, '_blank')}
          >
            <div style={{
              color: '#e6edf3',
              fontSize: '13px',
              lineHeight: '1.4',
              marginBottom: '6px',
              fontWeight: idx === 0 ? '500' : '400',
            }}>
              {item.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#6e7681', fontSize: '11px' }}>{item.source}</span>
              <span style={{ color: '#6e7681', fontSize: '11px' }}>•</span>
              <span style={{ color: '#6e7681', fontSize: '11px' }}>{getTimeAgo(item.publishedAt)}</span>
              {item.symbols && item.symbols.length > 0 && (
                <>
                  <span style={{ color: '#6e7681', fontSize: '11px' }}>•</span>
                  <span style={{ color: c.cyan, fontSize: '11px' }}>${item.symbols[0]}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * StocksInTheNews - Top movers with news-driven context
 * Replaces plain top movers with "why it's moving" explanations
 */
const StocksInTheNews = ({ moversData, isLoading, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  if (isLoading) {
    return (
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Stocks in the News
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: '#161b22',
              borderRadius: '8px',
              padding: '12px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              <div style={{ height: '14px', background: '#2d3548', borderRadius: '4px', width: '60%' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!moversData || (!moversData.gainers?.length && !moversData.losers?.length)) {
    return null;
  }

  const renderMover = (stock, isGainer) => (
    <div
      key={stock.symbol}
      style={{
        background: '#161b22',
        borderRadius: '8px',
        padding: '12px',
        borderLeft: `3px solid ${isGainer ? c.green : c.red}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <span style={{ color: '#e6edf3', fontWeight: '600', fontSize: '14px' }}>{stock.symbol}</span>
          <span style={{ color: '#6e7681', fontSize: '12px', marginLeft: '8px' }}>{stock.name}</span>
        </div>
        <span style={{
          color: isGainer ? c.green : c.red,
          fontWeight: '600',
          fontSize: '14px',
        }}>
          {isGainer ? '+' : ''}{stock.percentChange?.toFixed(2)}%
        </span>
      </div>
      {stock.reason && (
        <div style={{
          color: '#8b949e',
          fontSize: '12px',
          lineHeight: '1.4',
        }}>
          {stock.reason}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      background: '#1a1f2e',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid #2d3548',
    }}>
      <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '14px' }}>📈</span> Stocks in the News
      </h3>

      {/* Gainers Section */}
      {moversData.gainers?.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: c.green, fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>
            Top Gainers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {moversData.gainers.slice(0, 3).map(stock => renderMover(stock, true))}
          </div>
        </div>
      )}

      {/* Losers Section */}
      {moversData.losers?.length > 0 && (
        <div>
          <div style={{ color: c.red, fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>
            Biggest Decliners
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {moversData.losers.slice(0, 3).map(stock => renderMover(stock, false))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * AIMarketSummary - Claude Haiku powered market summary
 * Provides AI-generated insights on current market conditions
 */
const AIMarketSummary = ({ marketData, news, moversData, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const generateSummary = async () => {
      if (!marketData) {
        setIsLoading(false);
        return;
      }

      try {
        // Call the AI advisor API for market summary
        const response = await fetch('/api/ai-advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'market_summary',
            context: {
              stocksUp: marketData.stocksUp,
              stocksDown: marketData.stocksDown,
              cryptoUp: marketData.cryptoUp,
              cryptoDown: marketData.cryptoDown,
              topGainers: moversData?.gainers?.slice(0, 3).map(s => ({ symbol: s.symbol, change: s.percentChange })) || [],
              topLosers: moversData?.losers?.slice(0, 3).map(s => ({ symbol: s.symbol, change: s.percentChange })) || [],
              recentNews: news?.slice(0, 3).map(n => n.title) || [],
            },
          }),
        });

        if (!response.ok) {
          throw new Error('AI summary unavailable');
        }

        const data = await response.json();
        if (data.success && data.advice) {
          setSummary(data.advice);
        } else {
          // Generate a simple fallback summary
          setSummary(generateFallbackSummary(marketData, moversData));
        }
      } catch (err) {
        console.warn('AI summary failed, using fallback:', err);
        setSummary(generateFallbackSummary(marketData, moversData));
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to let other components load first
    const timer = setTimeout(generateSummary, 500);
    return () => clearTimeout(timer);
  }, [marketData, news, moversData]);

  // Generate a fallback summary when AI is unavailable
  const generateFallbackSummary = (data, movers) => {
    const totalStocks = (data?.stocksUp || 0) + (data?.stocksDown || 0);
    const stockRatio = totalStocks > 0 ? (data?.stocksUp || 0) / totalStocks : 0.5;

    let sentiment = 'mixed';
    if (stockRatio > 0.6) sentiment = 'bullish';
    else if (stockRatio < 0.4) sentiment = 'bearish';

    const topGainer = movers?.gainers?.[0];
    const topLoser = movers?.losers?.[0];

    let summaryText = '';
    if (sentiment === 'bullish') {
      summaryText = `Markets are showing strength today with ${data?.stocksUp || 0} stocks advancing. `;
      if (topGainer) {
        summaryText += `${topGainer.symbol} leads the way with gains of ${topGainer.percentChange?.toFixed(1)}%. `;
      }
      summaryText += 'Consider momentum plays but watch for overextended names.';
    } else if (sentiment === 'bearish') {
      summaryText = `Caution advised as ${data?.stocksDown || 0} stocks are declining today. `;
      if (topLoser) {
        summaryText += `${topLoser.symbol} is under pressure, down ${Math.abs(topLoser.percentChange || 0).toFixed(1)}%. `;
      }
      summaryText += 'Look for quality names at support levels or consider defensive positions.';
    } else {
      summaryText = `Markets are trading mixed with ${data?.stocksUp || 0} gainers and ${data?.stocksDown || 0} decliners. `;
      summaryText += 'A balanced approach may work best in this environment. Focus on your strongest convictions.';
    }

    return summaryText;
  };

  if (!marketData) {
    return null;
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(147, 51, 234, 0.1))',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
      border: '1px solid rgba(99, 102, 241, 0.2)',
    }}>
      <h3 style={{
        color: '#8b949e',
        fontSize: '12px',
        textTransform: 'uppercase',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '14px' }}>🤖</span> AI Market Summary
        <span style={{
          background: 'rgba(147, 51, 234, 0.2)',
          color: '#a78bfa',
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '4px',
          marginLeft: '4px',
        }}>
          CLAUDE
        </span>
      </h3>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            border: '2px solid rgba(147, 51, 234, 0.3)',
            borderTop: '2px solid #9333ea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <span style={{ color: '#8b949e', fontSize: '13px' }}>Analyzing market conditions...</span>
        </div>
      ) : (
        <div style={{
          color: '#c9d1d9',
          fontSize: '14px',
          lineHeight: '1.6',
        }}>
          {summary}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

// ============================================
// PHASE 1: MARKET BRIEFING
// ============================================

const MarketBriefing = ({ stocksData, cryptoData, onContinue, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  // News and movers state
  const [marketNews, setMarketNews] = useState([]);
  const [moversData, setMoversData] = useState({ gainers: [], losers: [] });
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [isLoadingMovers, setIsLoadingMovers] = useState(true);

  // Fetch news and movers on mount
  useEffect(() => {
    const fetchNewsData = async () => {
      try {
        // Fetch market news
        const news = await getMarketNews(6);
        setMarketNews(news);
      } catch (err) {
        console.warn('Failed to fetch market news:', err);
      } finally {
        setIsLoadingNews(false);
      }
    };

    const fetchMoversData = async () => {
      try {
        // Fetch top movers with news context
        const movers = await getTopMoversWithNews();
        setMoversData(movers);
      } catch (err) {
        console.warn('Failed to fetch top movers:', err);
      } finally {
        setIsLoadingMovers(false);
      }
    };

    fetchNewsData();
    fetchMoversData();
  }, []);

  // Calculate market data from props
  const marketData = React.useMemo(() => {
    if (!stocksData?.length && !cryptoData?.length) return null;

    // Calculate sector performance
    const sectorPerformance = {};
    stocksData.forEach(stock => {
      const sector = stock.sector || 'Other';
      if (!sectorPerformance[sector]) {
        sectorPerformance[sector] = { total: 0, count: 0 };
      }
      sectorPerformance[sector].total += safeNumber(stock.percentChange, 0);
      sectorPerformance[sector].count += 1;
    });

    const sectors = Object.entries(sectorPerformance)
      .map(([name, data]) => ({
        name,
        avgChange: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.avgChange - a.avgChange);

    // Top movers (fallback if news-based movers fail)
    const allAssets = [...stocksData, ...cryptoData];
    const topGainers = [...allAssets]
      .sort((a, b) => safeNumber(b.percentChange || b.change24h, 0) - safeNumber(a.percentChange || a.change24h, 0))
      .slice(0, 3);
    const topLosers = [...allAssets]
      .sort((a, b) => safeNumber(a.percentChange || a.change24h, 0) - safeNumber(b.percentChange || b.change24h, 0))
      .slice(0, 3);

    return {
      sectors,
      topGainers,
      topLosers,
      stocksUp: stocksData.filter(s => safeNumber(s.percentChange, 0) > 0).length,
      stocksDown: stocksData.filter(s => safeNumber(s.percentChange, 0) < 0).length,
      cryptoUp: cryptoData.filter(c => safeNumber(c.change24h, 0) > 0).length,
      cryptoDown: cryptoData.filter(c => safeNumber(c.change24h, 0) < 0).length,
    };
  }, [stocksData, cryptoData]);

  if (!marketData) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <h2 style={{ color: '#e6edf3' }}>Loading Market Data...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header - Polished Icon */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          {/* Icon Container */}
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #00d9ff 0%, #0ea5e9 100%)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 217, 255, 0.3)'
          }}>
            {/* Chart Bar Icon */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0d1117"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700', margin: 0 }}>
            Market Briefing
          </h1>
        </div>
        <p style={{ color: '#8b949e', fontSize: '14px', margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Market Pulse */}
      <div style={{
        background: '#1a1f2e',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3548',
      }}>
        <h3 style={{ color: '#8b949e', fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Market Pulse
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ color: '#e6edf3', fontSize: '14px', marginBottom: '4px' }}>Stocks</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: c.green }}>↑ {marketData.stocksUp}</span>
              <span style={{ color: c.red }}>↓ {marketData.stocksDown}</span>
            </div>
          </div>
          <div>
            <div style={{ color: '#e6edf3', fontSize: '14px', marginBottom: '4px' }}>Crypto</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ color: c.green }}>↑ {marketData.cryptoUp}</span>
              <span style={{ color: c.red }}>↓ {marketData.cryptoDown}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Market Summary */}
      <AIMarketSummary
        marketData={marketData}
        news={marketNews}
        moversData={moversData}
        colors={c}
      />

      {/* Build My Thesis Button - Moved here after AI Summary */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 16px rgba(34, 197, 94, 0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2Z" />
          </svg>
          BUILD MY THESIS
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <p style={{ color: '#8b949e', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
          Get AI-powered portfolio recommendations
        </p>
      </div>

      {/* Top News Stories (replaces Sector Snapshot) */}
      <TopNewsStories
        news={marketNews}
        isLoading={isLoadingNews}
        colors={c}
      />

      {/* Stocks in the News (replaces basic Top Movers) */}
      <StocksInTheNews
        moversData={moversData}
        isLoading={isLoadingMovers}
        colors={c}
      />
    </div>
  );
};

// ============================================
// PHASE 2: THESIS BUILDER
// ============================================

const ThesisBuilder = ({ thesis, onUpdate, onComplete, onBack, colors }) => {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  const questions = [
    {
      id: 1,
      title: "What type of battle?",
      subtitle: "This affects which strategies work best",
      options: [
        { id: 'head-to-head', label: '⚔️ Head-to-Head', description: '24-hour battle', color: c.cyan },
        { id: 'snake-draft', label: '🐍 Snake Draft', description: 'Week-long competition', color: c.green },
        { id: 'training', label: '🎯 Training', description: 'Practice mode', color: '#f59e0b' },
      ],
      field: 'battleType',
    },
    {
      id: 2,
      title: "What's your market stance?",
      subtitle: "How do you feel about the market direction?",
      options: [
        { id: 'bullish', label: '📈 Bullish', description: 'Expecting markets to rise', color: c.green },
        { id: 'bearish', label: '📉 Bearish', description: 'Expecting markets to fall', color: c.red },
        { id: 'neutral', label: '➡️ Neutral', description: 'No strong direction', color: '#f59e0b' },
      ],
      field: 'stance',
    },
    {
      id: 3,
      title: "Any sector focus?",
      subtitle: "Select up to 2 sectors, or skip for all",
      multiSelect: true,
      maxSelections: 2,
      options: [
        { id: 'Technology', label: '💻 Tech', color: c.cyan },
        { id: 'Financials', label: '🏦 Finance', color: '#10b981' },
        { id: 'Healthcare', label: '🏥 Healthcare', color: '#f43f5e' },
        { id: 'Energy', label: '⚡ Energy', color: '#ef4444' },
        { id: 'Consumer Discretionary', label: '🛍️ Consumer', color: '#f59e0b' },
        { id: 'Industrials', label: '🏭 Industrial', color: '#6366f1' },
        { id: 'Layer 1', label: '🔷 L1 Crypto', color: '#8b5cf6' },
        { id: 'DeFi', label: '🏛️ DeFi', color: '#14b8a6' },
        { id: 'Meme', label: '🐕 Meme Coins', color: '#ec4899' },
      ],
      field: 'sectors',
      skippable: true,
    },
    {
      id: 4,
      title: "Risk tolerance?",
      subtitle: "How much volatility can you handle?",
      options: [
        { id: 'aggressive', label: '🔥 Aggressive', description: 'High risk, high reward', color: c.red },
        { id: 'balanced', label: '⚖️ Balanced', description: 'Mix of growth and stability', color: '#f59e0b' },
        { id: 'conservative', label: '🛡️ Conservative', description: 'Protect downside first', color: c.green },
      ],
      field: 'risk',
    },
  ];

  const currentQ = questions[currentQuestion - 1];
  const isLastQuestion = currentQuestion === questions.length;

  const handleSelect = (optionId) => {
    if (currentQ.multiSelect) {
      const current = thesis[currentQ.field] || [];
      if (current.includes(optionId)) {
        onUpdate({ ...thesis, [currentQ.field]: current.filter(id => id !== optionId) });
      } else if (current.length < currentQ.maxSelections) {
        onUpdate({ ...thesis, [currentQ.field]: [...current, optionId] });
      }
    } else {
      onUpdate({ ...thesis, [currentQ.field]: optionId });
      // Auto-advance for single select
      setTimeout(() => {
        if (isLastQuestion) {
          onComplete({ ...thesis, [currentQ.field]: optionId });
        } else {
          setCurrentQuestion(prev => prev + 1);
        }
      }, 300);
    }
  };

  const handleContinue = () => {
    if (isLastQuestion) {
      onComplete(thesis);
    } else {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 1) {
      setCurrentQuestion(prev => prev - 1);
    } else {
      onBack();
    }
  };

  const isSelected = (optionId) => {
    if (currentQ.multiSelect) {
      return (thesis[currentQ.field] || []).includes(optionId);
    }
    return thesis[currentQ.field] === optionId;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: c.cyan,
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>
          Question {currentQuestion} of {questions.length}
        </span>
      </div>

      {/* Question */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ color: '#e6edf3', fontSize: '24px', marginBottom: '8px' }}>
          {currentQ.title}
        </h2>
        <p style={{ color: '#8b949e', fontSize: '14px' }}>
          {currentQ.subtitle}
        </p>
      </div>

      {/* Options */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {currentQ.options.map(option => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: isSelected(option.id) ? `${option.color}15` : '#1a1f2e',
              border: `2px solid ${isSelected(option.id) ? option.color : '#2d3548'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{
                color: isSelected(option.id) ? option.color : '#e6edf3',
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: option.description ? '4px' : '0',
              }}>
                {option.label}
              </div>
              {option.description && (
                <div style={{ color: '#8b949e', fontSize: '13px' }}>
                  {option.description}
                </div>
              )}
            </div>
            {isSelected(option.id) && (
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: option.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
                fontSize: '14px',
                fontWeight: '700',
              }}>
                ✓
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Multi-select continue button */}
      {currentQ.multiSelect && (
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '16px',
            background: `linear-gradient(135deg, ${c.cyan}, ${c.green})`,
            border: 'none',
            borderRadius: '12px',
            color: '#000',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          {(thesis[currentQ.field] || []).length === 0
            ? 'SKIP (ALL SECTORS)'
            : `CONTINUE WITH ${(thesis[currentQ.field] || []).length} SELECTED`}
        </button>
      )}
    </div>
  );
};

// ============================================
// PHASE 3: ASSET EXPLORER
// ============================================

const AssetExplorer = ({
  thesis,
  recommendations,
  isEnhancing,
  pinnedInsights,
  stocksData,
  cryptoData,
  onSelectAsset,
  onContinue,
  onBack,
  colors,
}) => {
  const [viewMode, setViewMode] = useState('recommended'); // 'recommended' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  const allAssets = [...(stocksData || []), ...(cryptoData || [])];

  const filteredAssets = viewMode === 'recommended'
    ? recommendations
    : allAssets.filter(a =>
        a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 30);

  const thesisSummary = [
    thesis.battleType === 'head-to-head' ? '24hr' : thesis.battleType === 'snake-draft' ? 'Week' : 'Training',
    thesis.stance,
    ...(thesis.sectors || []),
    thesis.risk,
  ].filter(Boolean).join(' • ');

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: c.cyan,
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>Step 3 of 5</span>
      </div>

      {/* Header with polished icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0d1117" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <h2 style={{
          color: '#e6edf3',
          fontSize: '20px',
          fontWeight: '700',
          margin: 0
        }}>
          Explore Assets
        </h2>
      </div>
      <p style={{ color: c.cyan, fontSize: '13px', marginBottom: '20px' }}>
        {thesisSummary}
      </p>

      {/* View Toggle - Polished tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <button
          onClick={() => setViewMode('recommended')}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: viewMode === 'recommended' ? c.cyan : '#1a1f2e',
            border: viewMode === 'recommended' ? 'none' : '1px solid #21262d',
            borderRadius: '10px',
            color: viewMode === 'recommended' ? '#0d1117' : '#8b949e',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            background: viewMode === 'recommended' ? '#0d1117' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke={viewMode === 'recommended' ? c.cyan : '#ffffff'} strokeWidth="2" fill="none"/>
              <circle cx="12" cy="12" r="5" stroke={viewMode === 'recommended' ? c.cyan : '#ffffff'} strokeWidth="2" fill="none"/>
              <circle cx="12" cy="12" r="1.5" fill={viewMode === 'recommended' ? c.cyan : '#ffffff'}/>
            </svg>
          </div>
          Recommended ({recommendations.length})
        </button>
        <button
          onClick={() => setViewMode('all')}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: viewMode === 'all' ? c.cyan : '#1a1f2e',
            border: viewMode === 'all' ? 'none' : '1px solid #21262d',
            borderRadius: '10px',
            color: viewMode === 'all' ? '#0d1117' : '#8b949e',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            background: viewMode === 'all' ? '#0d1117' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={viewMode === 'all' ? c.cyan : '#ffffff'}>
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          All Assets ({allAssets.length})
        </button>
      </div>

      {/* Search (only for all view) */}
      {viewMode === 'all' && (
        <input
          type="text"
          placeholder="Search by symbol or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#1a1f2e',
            border: '1px solid #2d3548',
            borderRadius: '8px',
            color: '#e6edf3',
            fontSize: '14px',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Enhancing indicator */}
      {isEnhancing && viewMode === 'recommended' && (
        <div style={{
          padding: '8px 12px',
          background: `rgba(0, 217, 255, 0.1)`,
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '13px',
          color: c.cyan,
        }}>
          ✨ AI is enhancing recommendations...
        </div>
      )}

      {/* Asset List */}
      <div style={{ marginBottom: '100px' }}>
        {filteredAssets.map((asset) => (
          <div
            key={asset.symbol}
            onClick={() => onSelectAsset(asset)}
            style={{
              background: '#1a1f2e',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '12px',
              border: '1px solid #2d3548',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <div style={{ color: '#e6edf3', fontWeight: '700', fontSize: '18px' }}>
                  {asset.symbol}
                </div>
                <div style={{ color: '#8b949e', fontSize: '13px' }}>
                  {asset.name}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#e6edf3', fontWeight: '600' }}>
                  ${safeToFixed(asset.price, 2)}
                </div>
                <div style={{
                  color: safeNumber(asset.percentChange || asset.change24h, 0) >= 0 ? c.green : c.red,
                  fontSize: '14px',
                }}>
                  {safeNumber(asset.percentChange || asset.change24h, 0) >= 0 ? '▲' : '▼'} {Math.abs(safeNumber(asset.percentChange || asset.change24h, 0)).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Recommendation explanation */}
            {viewMode === 'recommended' && (
              <div style={{
                padding: '10px',
                background: '#161b22',
                borderRadius: '8px',
                marginTop: '8px',
              }}>
                <p style={{
                  color: '#c9d1d9',
                  fontSize: '13px',
                  margin: 0,
                  lineHeight: '1.5',
                }}>
                  {asset.enhancedExplanation || asset.genericExplanation || 'Matches your thesis criteria.'}
                </p>
                {asset.thesisScore && (() => {
                  const alignment = asset.thesisScore.alignment;
                  const score = asset.thesisScore.score;
                  const badgeColors = alignment === 'strong'
                    ? { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: '#22c55e' }
                    : alignment === 'good'
                    ? { bg: 'rgba(0, 217, 255, 0.15)', text: '#00d9ff', border: '#00d9ff' }
                    : alignment === 'moderate'
                    ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#f59e0b' }
                    : { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', border: '#6b7280' };

                  return (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      background: badgeColors.bg,
                      border: `1px solid ${badgeColors.border}30`,
                      borderRadius: '6px',
                      marginTop: '10px'
                    }}>
                      {/* Star rating */}
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3].map(i => (
                          <svg
                            key={i}
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill={score >= (i * 30) ? badgeColors.text : 'transparent'}
                            stroke={badgeColors.text}
                            strokeWidth="2"
                          >
                            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
                          </svg>
                        ))}
                      </div>
                      <span style={{
                        color: badgeColors.text,
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}>
                        {alignment} MATCH
                      </span>
                      <span style={{
                        color: badgeColors.text,
                        fontSize: '11px',
                        opacity: 0.7
                      }}>
                        {score}/100
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '8px',
            }}>
              <span style={{ color: c.cyan, fontSize: '13px' }}>
                Tap to explore →
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Continue Button - Fixed at bottom */}
      <div style={{
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '16px 20px',
        background: 'linear-gradient(transparent, #0d1117 30%)',
      }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%',
            maxWidth: '560px',
            margin: '0 auto',
            display: 'block',
            padding: '16px',
            background: `linear-gradient(135deg, ${c.cyan}, ${c.green})`,
            border: 'none',
            borderRadius: '12px',
            color: '#000',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
          }}
        >
          CONTINUE TO CONVICTION CHECK →
        </button>
        {pinnedInsights.length > 0 && (
          <p style={{
            textAlign: 'center',
            color: '#8b949e',
            fontSize: '12px',
            marginTop: '8px',
          }}>
            📌 {pinnedInsights.length} insight{pinnedInsights.length !== 1 ? 's' : ''} saved
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================
// ASSET DETAIL VIEW (from Phase 3)
// ============================================

const AssetDetailView = ({ asset, thesis, pinnedInsights, onPin, onBack, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };
  const isCrypto = asset.category !== undefined;

  const isPinned = (metricName) => {
    return pinnedInsights?.some(n =>
      n.symbol === asset.symbol && n.metricName === metricName
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: c.cyan,
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          ← Back to List
        </button>
      </div>

      {/* Asset Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '24px',
        padding: '20px',
        background: '#1a1f2e',
        borderRadius: '16px',
        border: '1px solid #2d3548',
      }}>
        <h1 style={{ color: '#e6edf3', fontSize: '32px', marginBottom: '4px' }}>
          {asset.symbol}
        </h1>
        <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '12px' }}>
          {asset.name}
        </p>
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: '#161b22',
          borderRadius: '16px',
          color: c.cyan,
          fontSize: '12px',
        }}>
          {isCrypto ? `🔷 ${asset.category}` : `💼 ${asset.sector}`}
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ color: '#e6edf3', fontSize: '28px', fontWeight: '700' }}>
            ${safeToFixed(asset.price, 2)}
          </div>
          <div style={{
            color: safeNumber(asset.percentChange || asset.change24h, 0) >= 0 ? c.green : c.red,
            fontSize: '18px',
            marginTop: '4px',
          }}>
            {safeNumber(asset.percentChange || asset.change24h, 0) >= 0 ? '▲' : '▼'} {Math.abs(safeNumber(asset.percentChange || asset.change24h, 0)).toFixed(2)}% today
          </div>
        </div>
      </div>

      {/* Metrics Display */}
      {isCrypto ? (
        <CryptoMetricsDisplay
          asset={asset}
          thesis={thesis}
          pinnedNotes={pinnedInsights}
          onPinInsight={onPin}
          colors={c}
        />
      ) : (
        <StockMetricsDisplay
          asset={asset}
          thesis={thesis}
          pinnedNotes={pinnedInsights}
          onPinInsight={onPin}
          colors={c}
        />
      )}
    </div>
  );
};

// ============================================
// RESEARCH FLOW - MAIN CONTAINER
// ============================================

const ResearchFlow = ({ stocksData, cryptoData, onUsePortfolio, colors }) => {
  const c = colors || { green: '#00ff88', red: '#ff4757', cyan: '#00d9ff' };

  // Flow state
  const [flowPhase, setFlowPhase] = useState(1);
  const [thesis, setThesis] = useState({
    battleType: null,
    stance: null,
    sectors: [],
    risk: null,
  });
  const [recommendations, setRecommendations] = useState([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [pinnedInsights, setPinnedInsights] = useState([]);
  const [convictionData, setConvictionData] = useState({
    mustHave: [],
    mustAvoid: [],
    confidence: null,
  });
  const [gamePlan, setGamePlan] = useState(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerType, setAssetPickerType] = useState(null);

  // Reset flow
  const resetFlow = () => {
    setFlowPhase(1);
    setThesis({ battleType: null, stance: null, sectors: [], risk: null });
    setRecommendations([]);
    setPinnedInsights([]);
    setConvictionData({ mustHave: [], mustAvoid: [], confidence: null });
    setGamePlan(null);
    setSelectedAsset(null);
  };

  // Handle thesis completion (Phase 2 → 3)
  const handleThesisComplete = async (completedThesis) => {
    setThesis(completedThesis);
    setFlowPhase(3);

    // Get all assets
    const allAssets = [...(stocksData || []), ...(cryptoData || [])];

    // Get instant recommendations using recommendation engine
    const recs = getRecommendations(allAssets, completedThesis, 8);
    const withGenericExplanations = recs.map(rec => ({
      ...rec,
      genericExplanation: generateGenericExplanation(rec, completedThesis),
    }));

    setRecommendations(withGenericExplanations);
    setIsEnhancing(true);

    // Enhance with Claude in background
    try {
      const enhanced = await enhanceRecommendations(withGenericExplanations, completedThesis, {});
      setRecommendations(enhanced);
    } catch (err) {
      console.warn('Enhancement failed, using generic explanations:', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Handle pin insight
  const handlePinInsight = (insight) => {
    setPinnedInsights(prev => [...prev, { ...insight, id: Date.now().toString() }]);
  };

  // Handle unpin insight
  const handleUnpinInsight = (insightId) => {
    setPinnedInsights(prev => prev.filter(p => p.id !== insightId));
  };

  // Handle open asset picker
  const handleOpenAssetPicker = (type) => {
    setAssetPickerType(type);
    setShowAssetPicker(true);
  };

  // Handle asset picker select
  const handleAssetPickerSelect = (symbol) => {
    if (assetPickerType === 'mustHave') {
      setConvictionData(prev => ({
        ...prev,
        mustHave: prev.mustHave.includes(symbol) ? prev.mustHave : [...prev.mustHave, symbol],
      }));
    } else if (assetPickerType === 'mustAvoid') {
      setConvictionData(prev => ({
        ...prev,
        mustAvoid: prev.mustAvoid.includes(symbol) ? prev.mustAvoid : [...prev.mustAvoid, symbol],
      }));
    }
  };

  // Handle generate game plan (Phase 4 → 5)
  const handleGeneratePlan = async () => {
    setFlowPhase(5);
    setIsGeneratingPlan(true);

    try {
      const plan = await generateGamePlan(thesis, convictionData, pinnedInsights, recommendations);
      setGamePlan(plan);
    } catch (err) {
      console.error('Game plan generation failed:', err);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Handle use portfolio
  const handleUsePortfolio = (portfolio) => {
    if (portfolio && onUsePortfolio) {
      onUsePortfolio(portfolio);
    }
    resetFlow();
  };

  // Handle save to notes
  const handleSaveToNotes = (plan) => {
    // Could integrate with existing notes system
    // TODO: Implement notes integration
  };

  // Render current phase
  const renderPhase = () => {
    // If viewing asset detail, show that instead
    if (selectedAsset) {
      return (
        <AssetDetailView
          asset={selectedAsset}
          thesis={thesis}
          pinnedInsights={pinnedInsights}
          onPin={handlePinInsight}
          onBack={() => setSelectedAsset(null)}
          colors={c}
        />
      );
    }

    switch (flowPhase) {
      case 1:
        return (
          <MarketBriefing
            stocksData={stocksData}
            cryptoData={cryptoData}
            onContinue={() => setFlowPhase(2)}
            colors={c}
          />
        );

      case 2:
        return (
          <ThesisBuilder
            thesis={thesis}
            onUpdate={setThesis}
            onComplete={handleThesisComplete}
            onBack={() => setFlowPhase(1)}
            colors={c}
          />
        );

      case 3:
        return (
          <AssetExplorer
            thesis={thesis}
            recommendations={recommendations}
            isEnhancing={isEnhancing}
            pinnedInsights={pinnedInsights}
            stocksData={stocksData}
            cryptoData={cryptoData}
            onSelectAsset={setSelectedAsset}
            onContinue={() => setFlowPhase(4)}
            onBack={() => setFlowPhase(2)}
            colors={c}
          />
        );

      case 4:
        return (
          <>
            <ConvictionCheck
              thesis={thesis}
              recommendations={recommendations}
              convictionData={convictionData}
              setConvictionData={setConvictionData}
              onComplete={handleGeneratePlan}
              onBack={() => setFlowPhase(3)}
              onOpenAssetPicker={handleOpenAssetPicker}
              colors={c}
            />
            <AssetPickerModal
              isOpen={showAssetPicker}
              onClose={() => setShowAssetPicker(false)}
              onSelect={handleAssetPickerSelect}
              type={assetPickerType}
              stocksData={stocksData}
              cryptoData={cryptoData}
              excludeSymbols={[...convictionData.mustHave, ...convictionData.mustAvoid]}
              colors={c}
            />
          </>
        );

      case 5:
        return (
          <GamePlan
            gamePlan={gamePlan}
            thesis={thesis}
            convictionData={convictionData}
            isLoading={isGeneratingPlan}
            onUsePortfolio={handleUsePortfolio}
            onSaveToNotes={handleSaveToNotes}
            onBack={() => setFlowPhase(4)}
            colors={c}
          />
        );

      default:
        return <MarketBriefing stocksData={stocksData} cryptoData={cryptoData} onContinue={() => setFlowPhase(2)} colors={c} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117' }}>
      {/* Progress indicator */}
      {!selectedAsset && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px',
          gap: '8px',
        }}>
          {[1, 2, 3, 4, 5].map(phase => (
            <div
              key={phase}
              style={{
                width: phase === flowPhase ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: phase <= flowPhase ? c.cyan : '#2d3548',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}

      {renderPhase()}
    </div>
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
// SECTOR COLORS FOR STOCK RESEARCH
// ============================================

const sectorColors = {
  Technology: {
    primary: '#4a9ead',
    background: 'rgba(74, 158, 173, 0.12)',
    border: 'rgba(74, 158, 173, 0.25)',
  },
  Healthcare: {
    primary: '#5a8a7a',
    background: 'rgba(90, 138, 122, 0.12)',
    border: 'rgba(90, 138, 122, 0.25)',
  },
  Financials: {
    primary: '#a89a6a',
    background: 'rgba(168, 154, 106, 0.12)',
    border: 'rgba(168, 154, 106, 0.25)',
  },
  Energy: {
    primary: '#b08a5a',
    background: 'rgba(176, 138, 90, 0.12)',
    border: 'rgba(176, 138, 90, 0.25)',
  },
  'Consumer Discretionary': {
    primary: '#a07a8a',
    background: 'rgba(160, 122, 138, 0.12)',
    border: 'rgba(160, 122, 138, 0.25)',
  },
  'Consumer Staples': {
    primary: '#8a7a9a',
    background: 'rgba(138, 122, 154, 0.12)',
    border: 'rgba(138, 122, 154, 0.25)',
  },
  Retail: {
    primary: '#8a7a9a',
    background: 'rgba(138, 122, 154, 0.12)',
    border: 'rgba(138, 122, 154, 0.25)',
  },
  Industrials: {
    primary: '#7a8a8a',
    background: 'rgba(122, 138, 138, 0.12)',
    border: 'rgba(122, 138, 138, 0.25)',
  },
  Communication: {
    primary: '#6a7a9a',
    background: 'rgba(106, 122, 154, 0.12)',
    border: 'rgba(106, 122, 154, 0.25)',
  },
  Entertainment: {
    primary: '#6a7a9a',
    background: 'rgba(106, 122, 154, 0.12)',
    border: 'rgba(106, 122, 154, 0.25)',
  },
  Utilities: {
    primary: '#6a7a7a',
    background: 'rgba(106, 122, 122, 0.12)',
    border: 'rgba(106, 122, 122, 0.25)',
  },
  'Real Estate': {
    primary: '#8a7a6a',
    background: 'rgba(138, 122, 106, 0.12)',
    border: 'rgba(138, 122, 106, 0.25)',
  },
  REIT: {
    primary: '#8a7a6a',
    background: 'rgba(138, 122, 106, 0.12)',
    border: 'rgba(138, 122, 106, 0.25)',
  },
  Materials: {
    primary: '#9a7a6a',
    background: 'rgba(154, 122, 106, 0.12)',
    border: 'rgba(154, 122, 106, 0.25)',
  },
  Biotech: {
    primary: '#5a8a7a',
    background: 'rgba(90, 138, 122, 0.12)',
    border: 'rgba(90, 138, 122, 0.25)',
  },
  Automotive: {
    primary: '#7a8a8a',
    background: 'rgba(122, 138, 138, 0.12)',
    border: 'rgba(122, 138, 138, 0.25)',
  },
  Fintech: {
    primary: '#a89a6a',
    background: 'rgba(168, 154, 106, 0.12)',
    border: 'rgba(168, 154, 106, 0.25)',
  },
  Conglomerate: {
    primary: '#7a8a8a',
    background: 'rgba(122, 138, 138, 0.12)',
    border: 'rgba(122, 138, 138, 0.25)',
  },
  Defense: {
    primary: '#7a8a8a',
    background: 'rgba(122, 138, 138, 0.12)',
    border: 'rgba(122, 138, 138, 0.25)',
  },
  Unknown: {
    primary: '#8b949e',
    background: 'rgba(139, 148, 158, 0.12)',
    border: 'rgba(139, 148, 158, 0.25)',
  }
};

// Crypto uses a single color since there are no "sectors"
const cryptoColor = {
  primary: '#8a6aaa',
  background: 'rgba(138, 106, 170, 0.12)',
  border: 'rgba(138, 106, 170, 0.25)',
};

// ============================================
// STOCK METRIC EXPLANATIONS
// ============================================

const stockMetricExplanations = {
  beta: {
    intermediate: (value) => `When the market moves 1%, this stock typically moves ${value?.toFixed(2) || '?'}%. ${value > 1.2 ? 'Higher beta means amplified swings - great for comeback potential, risky if the market dips.' : value < 0.8 ? 'Lower beta means steadier performance with smaller swings.' : 'Moderate volatility, moves roughly with the market.'}`,
    moreDepth: `Beta measures how much a stock moves compared to the overall market. Think of it like sensitivity:

• Beta = 1.0: Moves exactly with the market
• Beta > 1.0: More volatile (amplifies gains AND losses)
• Beta < 1.0: Less volatile (steadier, smaller swings)

For a 24-hour battle, high beta stocks can make or break your portfolio. If you're confident the market will go up, high beta gives you an edge. If uncertain, lower beta is safer.`
  },
  momentum7d: {
    intermediate: (value, upDays) => `${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value || 0).toFixed(1)}% over the past week. ${upDays || 0}/7 trading days were positive. ${Math.abs(value || 0) > 3 ? 'Strong' : Math.abs(value || 0) > 1 ? 'Moderate' : 'Weak'} short-term momentum.`,
    moreDepth: `Momentum shows which direction a stock has been trending recently. Stocks in motion tend to stay in motion (at least in the short term).

For MarketClash battles:
• Strong upward momentum: Stock has tailwind, may continue
• Downward momentum: Could be a dip-buy opportunity OR a falling knife
• Flat momentum: Stable but may not give you the edge you need`
  },
  analystConsensus: {
    intermediate: (rating, totalAnalysts, buyPercent) => `${totalAnalysts || 0} analysts covering this stock. ${(buyPercent || 0).toFixed(0)}% recommend buying. Average rating: ${(rating || 3).toFixed(1)}/5.`,
    moreDepth: `Wall Street analysts study companies professionally and issue ratings:

• Strong Buy: Very bullish, expect significant gains
• Buy: Positive outlook
• Hold: Neutral, wait and see
• Sell / Strong Sell: Negative outlook

A high consensus (4.0+) means most experts are optimistic. But remember: analysts aren't always right, and their targets are often 6-12 month outlooks, not 24-hour predictions.`
  },
  priceTarget: {
    intermediate: (target, current) => {
      if (!target || !current) return 'No price target data available.';
      const upside = ((target - current) / current * 100).toFixed(0);
      const progress = (current / target * 100).toFixed(0);
      return `Analysts' average target: $${target.toFixed(2)} (${upside > 0 ? '+' : ''}${upside}% from current). Price is at ${progress}% of target.`;
    },
    moreDepth: `Analysts set price targets - where they think the stock will be in 6-12 months.

For MarketClash:
• Stock well below target: Room to run, analysts see upside
• Stock at or above target: May be "priced in," limited near-term catalyst

This doesn't predict tomorrow's price, but shows overall sentiment.`
  },
  pegRatio: {
    intermediate: (value) => {
      if (!value) return 'PEG ratio data not available.';
      return `PEG of ${value.toFixed(2)}. ${value < 1 ? 'Potentially undervalued relative to growth.' : value > 2 ? 'Premium valuation - growth expectations priced in.' : 'Fairly valued relative to growth expectations.'}`;
    },
    moreDepth: `PEG = P/E ratio divided by earnings growth rate. It tells you if a stock's price makes sense given how fast the company is growing.

• PEG < 1.0: Potentially undervalued - growth isn't fully priced in
• PEG 1.0 - 2.0: Fairly valued
• PEG > 2.0: Expensive - you're paying a premium for growth

Lower PEG can mean more upside potential if the company delivers on growth.`
  },
  range52w: {
    intermediate: (position, low, high) => {
      if (!position && position !== 0) return '52-week range data not available.';
      return `Trading at ${position.toFixed(0)}% of its yearly range ($${low?.toFixed(2) || '?'} - $${high?.toFixed(2) || '?'}). ${position > 75 ? 'Near 52-week highs - strong momentum but limited upside.' : position < 25 ? 'Near 52-week lows - potential value or falling knife.' : 'Mid-range territory.'}`;
    },
    moreDepth: `This shows where the current price sits between its lowest and highest points of the past year.

• Near 52-week high (80%+): Stock has been on a run. Could keep going, or may be due for pullback.
• Near 52-week low (20%-): Stock has been beaten down. Could be a bargain, or there's a reason it's low.
• Mid-range (40-60%): Neutral territory.`
  },
  ma50: {
    intermediate: (price, ma, isAbove) => {
      if (!ma) return '50-day moving average data not available.';
      const pctDiff = ((price - ma) / ma * 100).toFixed(1);
      return `Price is ${isAbove ? 'ABOVE' : 'BELOW'} the 50-day MA ($${ma.toFixed(2)}) by ${Math.abs(pctDiff)}%. ${isAbove ? 'Short-term bullish signal.' : 'Short-term bearish signal.'}`;
    },
    moreDepth: `The 50-day moving average is the average closing price over the last 50 trading days. It's a key technical indicator:

• Price ABOVE 50 MA: Stock is in a short-term uptrend. Buyers are in control.
• Price BELOW 50 MA: Stock is in a short-term downtrend. Sellers are in control.
• Price crossing above 50 MA: Potential bullish signal (trend reversal)
• Price crossing below 50 MA: Potential bearish signal

For 24-hour battles, stocks above their 50 MA tend to have momentum on their side.`
  },
  ma200: {
    intermediate: (price, ma, isAbove) => {
      if (!ma) return '200-day moving average data not available.';
      const pctDiff = ((price - ma) / ma * 100).toFixed(1);
      return `Price is ${isAbove ? 'ABOVE' : 'BELOW'} the 200-day MA ($${ma.toFixed(2)}) by ${Math.abs(pctDiff)}%. ${isAbove ? 'Long-term uptrend intact.' : 'Long-term downtrend - caution advised.'}`;
    },
    moreDepth: `The 200-day moving average represents the long-term trend. It's one of the most watched indicators:

• Price ABOVE 200 MA: Stock is in a long-term bull market. Major institutions often buy above this level.
• Price BELOW 200 MA: Stock is in a long-term bear market. Often signals fundamental problems.

Key signals:
• "Golden Cross": 50 MA crosses ABOVE 200 MA - very bullish
• "Death Cross": 50 MA crosses BELOW 200 MA - very bearish

Stocks above both their 50 and 200 MA have the strongest technical setup.`
  }
};

// ============================================
// CRYPTO METRIC EXPLANATIONS
// ============================================

const cryptoMetricExplanations = {
  volatility7d: {
    intermediate: (value) => `Average daily swing of ${(value || 0).toFixed(1)}% over the past week. ${value > 5 ? 'Very high volatility - big swings both ways.' : value > 3 ? 'Moderate volatility - expect meaningful daily moves.' : 'Relatively stable for crypto.'}`,
    moreDepth: `Volatility measures how much the price swings up and down. In crypto, this is measured as the average daily percentage change:

• Low volatility (<3%): Relatively stable, smaller daily moves
• Medium volatility (3-5%): Typical for major altcoins
• High volatility (>5%): Expect big swings, both gains and losses

For 24-hour battles:
• High volatility = high risk/reward. You could win big or lose big.
• Low volatility = steadier but may not give you the edge you need.`
  },
  volatility30d: {
    intermediate: (value, vol7d) => {
      const trend = vol7d > value ? 'Volatility is increasing' : vol7d < value ? 'Volatility is decreasing' : 'Volatility is stable';
      return `30-day average volatility: ${(value || 0).toFixed(1)}%. ${trend} compared to recent week.`;
    },
    moreDepth: `Comparing 30-day to 7-day volatility shows if the asset is becoming more or less volatile:

• 7-day > 30-day: Volatility is INCREASING. Market is getting more uncertain. Bigger swings likely.
• 7-day < 30-day: Volatility is DECREASING. Market is calming down. Potentially safer entry.
• 7-day ≈ 30-day: Stable volatility. Expect similar patterns to continue.`
  },
  volatilityVsBtc: {
    intermediate: (ratio) => `This asset is ${(ratio || 1).toFixed(1)}x ${ratio > 1 ? 'more' : 'less'} volatile than Bitcoin. ${ratio > 2 ? 'Significantly amplified risk/reward.' : ratio > 1.2 ? 'Moderately more volatile than BTC.' : ratio < 0.8 ? 'Surprisingly stable for an altcoin.' : 'Similar volatility to BTC.'}`,
    moreDepth: `Bitcoin is the benchmark for crypto volatility. Comparing other coins to BTC helps you understand relative risk:

• 2x+ BTC volatility: Very aggressive. Big potential gains but also big potential losses.
• 1-2x BTC volatility: Typical for major altcoins. Moderately more volatile.
• <1x BTC volatility: Rare for altcoins. Often stablecoins or very established tokens.

For MarketClash: If you want to play it "safe" in crypto battles, lower volatility vs BTC is better. If you need a comeback, higher volatility gives more upside (and downside).`
  },
  volume24h: {
    intermediate: (value) => {
      const formatted = value >= 1e9 ? `$${(value/1e9).toFixed(1)}B` : `$${(value/1e6).toFixed(0)}M`;
      return `${formatted} traded in the last 24 hours. ${value > 1e9 ? 'Very liquid - easy to trade.' : value > 100e6 ? 'Good liquidity.' : 'Lower liquidity - price can move on smaller trades.'}`;
    },
    moreDepth: `24-hour volume shows how much money is flowing through this asset:

• High volume (>$1B): Very liquid. Large trades don't move the price much.
• Medium volume ($100M-$1B): Good liquidity for most purposes.
• Low volume (<$100M): Be careful. Price can spike or crash on relatively small trades.

Volume also indicates interest. Rising volume often precedes big price moves.`
  },
  volumeVsAvg: {
    intermediate: (pctDiff) => {
      const direction = pctDiff > 0 ? 'higher' : 'lower';
      const magnitude = Math.abs(pctDiff || 0);
      return `Today's volume is ${magnitude.toFixed(0)}% ${direction} than the 7-day average. ${magnitude > 50 ? 'Unusual activity - something may be happening.' : magnitude > 20 ? 'Elevated interest today.' : 'Normal trading activity.'}`;
    },
    moreDepth: `Comparing today's volume to the recent average reveals unusual activity:

• Volume 50%+ above average: Something is happening. News, rumors, or whale activity. Expect bigger moves.
• Volume 20-50% above average: Elevated interest. Worth paying attention.
• Volume near average: Normal day. No unusual catalysts.
• Volume below average: Quiet day. Less likely to see big moves.

Unusual volume often comes BEFORE big price moves, making it a leading indicator.`
  },
  momentum7d: {
    intermediate: (value) => `${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value || 0).toFixed(1)}% over the past 7 days. ${Math.abs(value || 0) > 15 ? 'Very strong move.' : Math.abs(value || 0) > 5 ? 'Solid momentum.' : 'Relatively flat.'}`,
    moreDepth: `7-day momentum shows the short-term trend direction and strength:

• Strong positive (>15%): Asset is hot. Could continue or be due for pullback.
• Moderate positive (5-15%): Healthy uptrend.
• Flat (-5% to +5%): Consolidating. Waiting for direction.
• Moderate negative (-5% to -15%): Downtrend. Could be buying opportunity or falling knife.
• Strong negative (<-15%): Significant selling pressure.

In 24-hour battles, momentum often continues in the short term. But extreme momentum (>20%) often reverts.`
  },
  momentum30d: {
    intermediate: (value, mom7d) => {
      const trend = mom7d > value ? 'accelerating' : mom7d < value ? 'decelerating' : 'steady';
      return `${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value || 0).toFixed(1)}% over 30 days. Short-term momentum is ${trend}.`;
    },
    moreDepth: `Comparing 30-day to 7-day momentum reveals trend strength:

• 7-day > 30-day (both positive): Momentum is ACCELERATING. Trend is strengthening.
• 7-day < 30-day (both positive): Momentum is SLOWING. Trend may be weakening.
• 7-day positive, 30-day negative: Potential REVERSAL. Recent bounce off lows.
• 7-day negative, 30-day positive: Potential BREAKDOWN. Recent weakness in uptrend.

Accelerating momentum has the best chance of continuing into your battle window.`
  },
  distanceFromATH: {
    intermediate: (pctFromATH, athPrice, athDate) => {
      if (!athPrice) return 'All-time high data not available.';
      return `Currently ${Math.abs(pctFromATH || 0).toFixed(0)}% below all-time high of $${athPrice.toFixed(2)} (${athDate || 'Unknown'}). ${Math.abs(pctFromATH || 0) < 20 ? 'Near ATH - strong momentum.' : Math.abs(pctFromATH || 0) > 70 ? 'Far from ATH - high risk or value opportunity.' : 'Significant room to recover.'}`;
    },
    moreDepth: `Distance from All-Time High shows where the current price sits vs the asset's peak:

• Within 20% of ATH: Asset is strong. Hitting new highs is realistic.
• 20-50% below ATH: Meaningful correction. Could recover or drop further.
• 50-80% below ATH: Major drawdown. Either a value opportunity or fundamental problems.
• 80%+ below ATH: Extreme drawdown. Very high risk. Many never recover.

Note: In crypto, ATHs are often from bull market peaks. Don't assume every coin will return to ATH.`
  }
};

// Research requirements and rewards
const RESEARCH_REQUIREMENTS = {
  minimumNotes: 20,
  minimumAssets: 4,
  mustFinalize: true
};

const calculateResearchXP = (streak) => {
  const baseXP = 100;
  const streakBonuses = {
    1: 0, 2: 25, 3: 50, 4: 75, 5: 100,
    6: 100, 7: 100, 8: 100, 9: 100, 10: 200
  };
  const bonus = streak >= 10 ? 200 : (streakBonuses[streak] || 100);
  return { base: baseXP, streakBonus: bonus, total: baseXP + bonus };
};

// Get current week's Monday in ISO format
const getCurrentWeekMonday = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setUTCDate(diff));
  return monday.toISOString().split('T')[0];
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

export default function PortfolioDuel() {
  // ============================================
  // 1. ALL STATE DECLARATIONS
  // ============================================
  const [screen, setScreen] = useState('home');
  const [historyTab, setHistoryTab] = useState('draft'); // 'classic' or 'draft'
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [builderMode, setBuilderMode] = useState('create'); // 'create', 'join', or 'training'

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
  const [activeTrainingBattles, setActiveTrainingBattles] = useState([]); // Firebase-persisted training battles

  // Portfolio builder state
  const [assetType, setAssetType] = useState('stocks');
  const [searchTerm, setSearchTerm] = useState('');
  const [portfolio, setPortfolio] = useState([]);
  const [portfolioType, setPortfolioType] = useState(null); // 'stocks' or 'crypto'
  const [builderCategory, setBuilderCategory] = useState('Leadership'); // Leadership/Momentum/Stable/Short tabs
  const [selectedCrypto, setSelectedCrypto] = useState(null); // { symbol: 'BTC', position: 'long' | 'short' }
  const [cryptoPercentage, setCryptoPercentage] = useState(10); // Default 10% for crypto
  const [showRulesModal, setShowRulesModal] = useState(false); // Rules modal state
  const [rulesActiveTab, setRulesActiveTab] = useState('classic'); // Rules modal active tab

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
  const [gameMode, setGameMode] = useState('draft'); // Snake Draft is default

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

  // Enhanced Research Mode state
  const [researchActiveTab, setResearchActiveTab] = useState('stocks'); // 'stocks' | 'crypto' | 'notes' | 'advisor'
  const [selectedAssetDetail, setSelectedAssetDetail] = useState(null);
  const [selectedAssetType, setSelectedAssetType] = useState(null); // 'stock' | 'crypto'
  const [stockFundamentals, setStockFundamentals] = useState({}); // { AAPL: {...}, MSFT: {...} }
  const [cryptoMetrics, setCryptoMetrics] = useState({}); // { BTC: {...}, ETH: {...} }
  const [showMoreDepth, setShowMoreDepth] = useState({}); // { metricName: boolean }
  const [fundamentalsLoading, setFundamentalsLoading] = useState({});
  const [cryptoMetricsLoading, setCryptoMetricsLoading] = useState({});

  // Notes system state
  const [userNotes, setUserNotes] = useState([]);
  const [weeklyProgress, setWeeklyProgress] = useState(null);
  const [notesExpanded, setNotesExpanded] = useState({});
  const [draftNotesExpanded, setDraftNotesExpanded] = useState(false);
  const [customNoteText, setCustomNoteText] = useState('');

  // Research rewards state
  const [researchStreak, setResearchStreak] = useState(0);
  const [showResearchComplete, setShowResearchComplete] = useState(false);

  // Game Plan state (AI-powered strategy from notes)
  const [gamePlanResponse, setGamePlanResponse] = useState(null);
  const [gamePlanLoading, setGamePlanLoading] = useState(false);

  // Research Flow Phase 4 & 5 state (Conviction Check + Game Plan)
  const [researchPhase, setResearchPhase] = useState('explore'); // 'explore' | 'conviction' | 'gameplan'
  const [convictionData, setConvictionData] = useState({
    mustHave: [],
    mustAvoid: [],
    confidence: null,
  });
  const [researchGamePlan, setResearchGamePlan] = useState(null);
  const [researchGamePlanLoading, setResearchGamePlanLoading] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerType, setAssetPickerType] = useState(null); // 'mustHave' | 'mustAvoid'
  const [researchThesis, setResearchThesis] = useState(null); // Store thesis from advisor
  const [researchViewMode, setResearchViewMode] = useState('guided'); // 'guided' | 'classic'

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
    system: { icon: '📢', color: '#8b949e', title: 'System' }
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
      if (shouldShowSlotMachine) {
        setTimeout(() => {
          setShowSlotMachine(true);
        }, 500);
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

  // Handle window resize for desktop background
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load weekly challenges when user logs in - RUNS ONCE PER SESSION
  useEffect(() => {
    // Only run if user is logged in AND we haven't checked this session
    if (user && !weeklyChallengesChecked) {
      setWeeklyChallengesChecked(true); // Mark as checked for this session
      loadWeeklyChallenges();

      // Also load challenge history
      const historyKey = `challengeHistory_${user?.odM || user?.username}`;
      const savedHistory = localStorage.getItem(historyKey);
      if (savedHistory) {
        setChallengeHistory(JSON.parse(savedHistory));
      }
    }
  }, [user, weeklyChallengesChecked]);

  // Load notifications and portfolio templates when user logs in
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadPortfolioTemplates();
      // Check for rematch requests
      checkRematchRequests();
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
        showToast('Failed to load market data. Please try again.');
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

  // ⭐ Fetch training battles from Firebase (persists across sessions)
  useEffect(() => {
    if (screen !== 'dashboard') return;

    const fetchTrainingBattles = async () => {
      try {
        const currentUserId = user?.odUserId || user?.username;
        if (!currentUserId) return;

        const { collection, query, where, getDocs, doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase/config');

        // Query Firebase for training battles where user is a player
        const trainingRef = collection(db, 'trainingBattles');
        const q = query(
          trainingRef,
          where('playerIds', 'array-contains', currentUserId),
          where('state.status', 'in', ['active', 'waiting'])
        );

        const snapshot = await getDocs(q);

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

        // Auto-complete expired training battles
        for (const battle of expiredBattles) {
          try {
            await updateDoc(doc(db, 'trainingBattles', battle.id), {
              'state.status': 'completed',
              'timeline.completedAt': now.toISOString(),
              updatedAt: now.toISOString()
            });
            console.log('⏰ Auto-completed expired training battle:', battle.id);
          } catch (err) {
            console.error('Error completing expired battle:', err);
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
    const refreshInterval = setInterval(fetchTrainingBattles, 30000);
    return () => clearInterval(refreshInterval);
  }, [screen, user]);

  // ⭐ MID-GAME CHALLENGE CHECKING SYSTEM
  // Check for mid-game challenges periodically during active battles
  useEffect(() => {
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
        const isCreator = currentBattle.creator === user?.username;
        const myPortfolio = isCreator ? currentBattle.creatorPortfolio : currentBattle.opponentPortfolio;
        const theirPortfolio = isCreator ? currentBattle.opponentPortfolio : currentBattle.creatorPortfolio;

        // Calculate gains using current battle prices
        let myTotalValue = 0;
        let theirTotalValue = 0;

        if (battlePrices && Object.keys(battlePrices).length > 0) {
          // User portfolio value
          for (const asset of myPortfolio || []) {
            const startPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
            const currentPrice = battlePrices[asset.symbol] || startPrice;
            const shares = asset.amount / startPrice;
            const isShort = asset.position === 'short';

            if (isShort) {
              const priceChange = startPrice - currentPrice;
              myTotalValue += asset.amount + (shares * priceChange);
            } else {
              myTotalValue += shares * currentPrice;
            }
          }

          // Opponent portfolio value
          for (const asset of theirPortfolio || []) {
            const startPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
            const currentPrice = battlePrices[asset.symbol] || startPrice;
            const shares = asset.amount / startPrice;
            const isShort = asset.position === 'short';

            if (isShort) {
              const priceChange = startPrice - currentPrice;
              theirTotalValue += asset.amount + (shares * priceChange);
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
            const updatedUser = {
              ...user,
              xp: (user.xp || 0) + totalXP
            };
            setUser(updatedUser);
            saveUser(updatedUser);
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
        // CPU picks from its portfolio
        const cpuPortfolio = currentBattle?.opponentPortfolio || [];
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

  // ============================================
  // GENERATE CPU PORTFOLIO FOR TRAINING MODE
  // ============================================
  const generateCPUPortfolio = (type, stocksDataArr, cryptoDataArr) => {
    // Stock categories for CPU selection
    const LEADERSHIP = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'MA', 'UNH', 'JNJ', 'WMT', 'PG', 'HD', 'XOM'];
    const MOMENTUM = ['TSLA', 'AMD', 'CRM', 'NFLX', 'ADBE', 'PYPL', 'SQ', 'SHOP', 'UBER', 'ABNB', 'DKNG', 'ROKU', 'ZM', 'SNOW', 'PLTR', 'COIN'];
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

  const handleCreateBattle = () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name before creating a battle');
      return;
    }

    if (portfolio.length < 6 || !selectedCrypto) {
      alert('Please complete your portfolio (6-12 stocks + 1 crypto) before creating a battle');
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
    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSelectedCrypto(null);
    setCryptoPercentage(10); // Reset to default
    setBuilderMode('create');
    setScreen('dashboard');
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

    if (portfolio.length < 6 || !selectedCrypto) {
      alert('Please complete your portfolio (6-12 stocks + 1 crypto) before joining');
      return;
    }

    // Load battles from localStorage to see battles from other tabs/users
    const allBattles = loadBattlesSafe();

    const battleToJoin = allBattles.find(
      b => b.challengeCode === joinCode.trim().toUpperCase() && b.status === 'waiting'
    );

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

    // Calculate start and end dates
    const now = new Date();
    const startDate = new Date(now); // Start immediately for testing
    const endDate = new Date(startDate.getTime() + battleTimer.BATTLE_DURATION);

    // Fetch starting prices - Lock in prices when battle starts
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

    // Update both portfolios to use the same starting prices
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

    // Update component state
    setBattles(updatedBattles);
    setActiveBattleId(battleToJoin.id);

    setPortfolio([]);
    setPortfolioType(null);
    setPortfolioName('');
    setSelectedCrypto(null);
    setCryptoPercentage(10); // Reset to default
    setBuilderMode('create');
    setJoinCode('');

    setScreen('dashboard');
  };

  // ============================================
  // TRAINING MODE: CREATE TRAINING BATTLE
  // ============================================
  const handleCreateTrainingBattle = async () => {
    if (!portfolioName.trim()) {
      alert('Please enter a portfolio name before starting training');
      return;
    }

    if (portfolio.length < 6 || !selectedCrypto) {
      alert('Please complete your portfolio (6-12 stocks + 1 crypto) before starting training');
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

    // Fetch starting prices for all assets
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

    // Load current battles and add training battle
    const currentBattles = loadBattlesSafe();
    const updatedBattles = [...currentBattles, trainingBattle];

    // Save to localStorage (for backward compatibility)
    saveBattlesSafe(updatedBattles);

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

    // Update component state
    setBattles(updatedBattles);
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

    // Get user's portfolio for double down challenge
    const isCreator = currentBattle?.creator === user?.username;
    const userPortfolio = isCreator
      ? currentBattle?.creatorPortfolio || []
      : currentBattle?.opponentPortfolio || [];
    const userStocks = userPortfolio.filter(a => a.position !== 'short').map(a => a.symbol);

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
        {/* Animated Desktop Background */}
        <DesktopBackground isDesktop={isDesktop} />

        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          position: 'relative',
          zIndex: 1,
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
            backgroundColor: '#1a1f2e',
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

  // RESEARCH MODE SCREEN - ENHANCED VERSION
  if (showResearchMode) {
    // Handler to use portfolio from ResearchFlow
    const handleUseResearchFlowPortfolio = (portfolioAllocations) => {
      // Convert allocations to portfolio format
      const allAssets = [...stocksData, ...cryptoData];
      const newPortfolio = portfolioAllocations.map(allocation => {
        const asset = allAssets.find(a => a.symbol === allocation.symbol);
        if (!asset) return null;
        return {
          symbol: allocation.symbol,
          name: asset.name,
          price: asset.price,
          amount: (allocation.allocation / 100) * 1000000,
        };
      }).filter(Boolean);

      setPortfolio(newPortfolio);
      setPortfolioType(newPortfolio.some(p => cryptoData.find(c => c.symbol === p.symbol)) ? 'crypto' : 'stocks');
      setShowResearchMode(false);
      setScreen('portfolio');
    };

    // GUIDED RESEARCH FLOW MODE
    if (researchViewMode === 'guided') {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#0d1117',
          zIndex: 1000,
          overflow: 'auto',
        }}>
          {/* Header with back and mode toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #2d3548',
          }}>
            <button
              onClick={() => setShowResearchMode(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.cyan,
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              ← Exit Research
            </button>
            <button
              onClick={() => setResearchViewMode('classic')}
              style={{
                background: 'rgba(139, 148, 158, 0.1)',
                border: '1px solid #2d3548',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#8b949e',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Classic View
            </button>
          </div>

          {/* ResearchFlow Component */}
          <ResearchFlow
            stocksData={stocksData}
            cryptoData={cryptoData}
            onUsePortfolio={handleUseResearchFlowPortfolio}
            colors={colors}
          />
        </div>
      );
    }

    // CLASSIC RESEARCH MODE (existing implementation)
    // Enrich assets with research data
    const { stocks: enrichedStocks, crypto: enrichedCrypto } = enrichAllAssetsWithResearch(stocksData, cryptoData);

    // Get assets based on current tab
    const currentAssets = researchActiveTab === 'stocks' ? enrichedStocks :
                          researchActiveTab === 'crypto' ? enrichedCrypto : [];

    // Filter by search term
    const filteredAssets = currentAssets.filter(asset =>
      asset.symbol.toLowerCase().includes(researchSearchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(researchSearchTerm.toLowerCase())
    );

    // Sort assets by 30-day momentum + market cap (hidden from user)
    const sortedAssets = [...filteredAssets].sort((a, b) => {
      // Primary: 30-day momentum
      const momentumDiff = (b.priceChange30d || 0) - (a.priceChange30d || 0);
      if (Math.abs(momentumDiff) > 5) return momentumDiff;
      // Secondary: category rank (proxy for market cap importance)
      return (a.categoryRank7d || 999) - (b.categoryRank7d || 999);
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
            <linearGradient id={`spark-grad-${isPositive}-${width}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${height} ${points} ${width},${height}`}
            fill={`url(#spark-grad-${isPositive}-${width})`}
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

    // Fetch stock fundamentals
    const fetchStockFundamentals = async (symbol) => {
      if (stockFundamentals[symbol] || fundamentalsLoading[symbol]) return;

      setFundamentalsLoading(prev => ({ ...prev, [symbol]: true }));
      try {
        const response = await fetch(`/api/stocks/fundamentals?symbol=${symbol}`);
        const data = await response.json();
        if (data.success) {
          setStockFundamentals(prev => ({ ...prev, [symbol]: data.data }));
        }
      } catch (error) {
        console.error('Failed to fetch fundamentals:', error);
      }
      setFundamentalsLoading(prev => ({ ...prev, [symbol]: false }));
    };

    // Fetch crypto metrics
    const fetchCryptoMetrics = async (symbol) => {
      if (cryptoMetrics[symbol] || cryptoMetricsLoading[symbol]) return;

      setCryptoMetricsLoading(prev => ({ ...prev, [symbol]: true }));
      try {
        const response = await fetch(`/api/crypto/metrics?symbol=${symbol}`);
        const data = await response.json();
        if (data.success) {
          setCryptoMetrics(prev => ({ ...prev, [symbol]: data.data }));
        }
      } catch (error) {
        console.error('Failed to fetch crypto metrics:', error);
      }
      setCryptoMetricsLoading(prev => ({ ...prev, [symbol]: false }));
    };

    // Handle opening asset detail
    const handleOpenDetail = (asset, type) => {
      setSelectedAssetDetail(asset);
      setSelectedAssetType(type);
      setShowMoreDepth({});

      // Fetch data based on type
      if (type === 'stock') {
        fetchStockFundamentals(asset.symbol);
      } else {
        fetchCryptoMetrics(asset.symbol);
      }
    };

    // Handle clipping a note
    const handleClipNote = (metricName, metricValue, explanation, symbol, assetType) => {
      const newNote = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        assetType,
        type: 'clipped',
        metricName,
        metricValue: String(metricValue),
        explanation,
        userAnnotation: '',
        createdAt: new Date().toISOString(),
        weekOf: getCurrentWeekMonday(),
        isFinalized: false
      };
      setUserNotes(prev => [...prev, newNote]);
    };

    // Handle adding custom note
    const handleAddCustomNote = (symbol, assetType) => {
      if (!customNoteText.trim()) return;

      const newNote = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        assetType,
        type: 'custom',
        customText: customNoteText.trim(),
        userAnnotation: '',
        createdAt: new Date().toISOString(),
        weekOf: getCurrentWeekMonday(),
        isFinalized: false
      };
      setUserNotes(prev => [...prev, newNote]);
      setCustomNoteText('');
    };

    // Handle deleting a note
    const handleDeleteNote = (noteId) => {
      setUserNotes(prev => prev.filter(n => n.id !== noteId));
    };

    // Handle pinning AI insight from Research Advisor
    const handlePinAINote = (noteData) => {
      const newNote = {
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol: null,
        assetType: 'ai_insight',
        type: 'ai_insight',
        customText: noteData.content,
        source: noteData.source || 'Research Advisor',
        userAnnotation: '',
        createdAt: noteData.timestamp || new Date().toISOString(),
        weekOf: getCurrentWeekMonday(),
        isFinalized: false
      };
      setUserNotes(prev => [...prev, newNote]);
    };

    // Generate Game Plan from notes using AI
    const handleGenerateGamePlan = async () => {
      const currentWeekNotes = userNotes.filter(n => n.weekOf === getCurrentWeekMonday());

      if (currentWeekNotes.length === 0) {
        return;
      }

      setGamePlanLoading(true);
      setGamePlanResponse(null);

      try {
        // Format notes for the AI
        const formattedNotes = currentWeekNotes.map(note => ({
          asset: note.symbol || 'General',
          content: note.type === 'clipped'
            ? `${note.metricName}: ${note.metricValue} - ${note.explanation}`
            : note.customText,
          timestamp: note.createdAt
        }));

        const response = await fetch('/api/ai-advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            advisorType: 'research',
            action: 'game-plan',
            context: {
              userNotes: formattedNotes
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate game plan');
        }

        const data = await response.json();

        if (data.emptyState) {
          setGamePlanResponse({ isEmpty: true, message: data.emptyStateMessage });
        } else {
          setGamePlanResponse({ message: data.message });
        }
      } catch (error) {
        console.error('[GamePlan] Error:', error);
        setGamePlanResponse({ error: 'Failed to generate game plan. Please try again.' });
      } finally {
        setGamePlanLoading(false);
      }
    };

    // ============================================
    // RESEARCH FLOW PHASE 4 & 5 HANDLERS
    // ============================================

    // Handler to open the asset picker modal
    const handleOpenAssetPicker = (pickerType) => {
      setAssetPickerType(pickerType);
      setShowAssetPicker(true);
    };

    // Handler for selecting an asset in the picker
    const handleAssetPickerSelect = (symbol) => {
      if (assetPickerType === 'mustHave') {
        setConvictionData(prev => ({
          ...prev,
          mustHave: prev.mustHave.includes(symbol) ? prev.mustHave : [...prev.mustHave, symbol],
        }));
      } else if (assetPickerType === 'mustAvoid') {
        setConvictionData(prev => ({
          ...prev,
          mustAvoid: prev.mustAvoid.includes(symbol) ? prev.mustAvoid : [...prev.mustAvoid, symbol],
        }));
      }
    };

    // Handler to transition to conviction check phase
    const handleStartConvictionCheck = (thesis, recommendations) => {
      setResearchThesis(thesis);
      // Pre-populate with top recommendations as suggested must-haves
      setConvictionData({
        mustHave: [],
        mustAvoid: [],
        confidence: null,
      });
      setResearchPhase('conviction');
    };

    // Handler when conviction check is complete - generate game plan
    const handleConvictionComplete = async (convictionData) => {
      setResearchPhase('gameplan');
      setResearchGamePlanLoading(true);
      setResearchGamePlan(null);

      try {
        // Get current notes for context
        const currentWeekNotes = userNotes.filter(n => n.weekOf === getCurrentWeekMonday());

        // Get recommendations based on thesis
        const allAssets = [...stocksData, ...cryptoData];

        // Generate the game plan using the imported function
        const gamePlanResult = await generateGamePlan(
          researchThesis,
          convictionData,
          currentWeekNotes,
          allAssets
        );

        setResearchGamePlan(gamePlanResult);
      } catch (error) {
        console.error('[ResearchFlow] Game plan generation failed:', error);
        setResearchGamePlan(null);
        showToast('Failed to generate game plan. Please try again.');
      } finally {
        setResearchGamePlanLoading(false);
      }
    };

    // Handler to use the generated portfolio
    const handleUseResearchPortfolio = (portfolioAllocations) => {
      // Convert allocations to portfolio format
      const allAssets = [...stocksData, ...cryptoData];
      const newPortfolio = portfolioAllocations.map(allocation => {
        const asset = allAssets.find(a => a.symbol === allocation.symbol);
        if (!asset) return null;
        return {
          symbol: allocation.symbol,
          name: asset.name,
          price: asset.price,
          amount: (allocation.allocation / 100) * 1000000, // Convert % to amount based on $1M portfolio
        };
      }).filter(Boolean);

      // Set the portfolio and navigate to portfolio builder
      setPortfolio(newPortfolio);
      setPortfolioType(newPortfolio.some(p => cryptoData.find(c => c.symbol === p.symbol)) ? 'crypto' : 'stocks');
      setShowResearchMode(false);
      setResearchPhase('explore');
      setScreen('portfolio');
    };

    // Handler to save game plan to notes
    const handleSaveGamePlanToNotes = (gamePlan) => {
      const newNote = {
        id: `gameplan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol: null,
        assetType: 'ai_insight',
        type: 'game_plan',
        customText: `**Game Plan Strategy:** ${gamePlan.strategySummary}\n\n**Portfolio:** ${gamePlan.portfolio?.map(p => `${p.symbol}: ${p.allocation}%`).join(', ')}\n\n**Key Risks:** ${gamePlan.risks?.join('; ')}`,
        source: 'Research Flow Game Plan',
        userAnnotation: '',
        createdAt: new Date().toISOString(),
        weekOf: getCurrentWeekMonday(),
        isFinalized: false,
      };
      setUserNotes(prev => [...prev, newNote]);
      // Show a toast or feedback (using existing system if available)
    };

    // Handler to go back from game plan to conviction check
    const handleBackFromGamePlan = () => {
      setResearchPhase('conviction');
    };

    // Handler to go back from conviction check to explore
    const handleBackFromConviction = () => {
      setResearchPhase('explore');
    };

    // Get sector color for stock
    const getSectorColor = (sector) => {
      return sectorColors[sector] || sectorColors['Unknown'];
    };

    // Toggle more depth for a metric
    const toggleMoreDepth = (metricKey) => {
      setShowMoreDepth(prev => ({ ...prev, [metricKey]: !prev[metricKey] }));
    };

    // Calculate weekly progress
    const currentWeekNotes = userNotes.filter(n => n.weekOf === getCurrentWeekMonday());
    const assetsWithNotes = [...new Set(currentWeekNotes.map(n => n.symbol))];
    const progressPercent = Math.min(100, (currentWeekNotes.length / RESEARCH_REQUIREMENTS.minimumNotes) * 100);
    const canFinalize = currentWeekNotes.length >= RESEARCH_REQUIREMENTS.minimumNotes &&
                        assetsWithNotes.length >= RESEARCH_REQUIREMENTS.minimumAssets;

    // ASSET DETAIL PAGE
    if (selectedAssetDetail) {
      const isStock = selectedAssetType === 'stock';
      const fundamentals = isStock ? stockFundamentals[selectedAssetDetail.symbol] : null;
      const metrics = !isStock ? cryptoMetrics[selectedAssetDetail.symbol] : null;
      const isLoading = isStock ? fundamentalsLoading[selectedAssetDetail.symbol] : cryptoMetricsLoading[selectedAssetDetail.symbol];
      const color = isStock ? getSectorColor(selectedAssetDetail.sector || 'Unknown') : cryptoColor;

      // Metric card component
      const MetricCard = ({ title, value, subValue, metricKey, explanationFn, moreDepth, valueColor }) => (
        <div style={{
          background: '#0d1117',
          borderRadius: '12px',
          border: '1px solid #21262d',
          padding: '16px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{title}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleClipNote(title, value, explanationFn, selectedAssetDetail.symbol, selectedAssetType)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6e7681',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '14px'
                }}
                title="Save to notes"
              >
                📌
              </button>
              <button
                onClick={() => toggleMoreDepth(metricKey)}
                style={{
                  background: showMoreDepth[metricKey] ? 'rgba(0, 217, 255, 0.2)' : 'transparent',
                  border: 'none',
                  color: showMoreDepth[metricKey] ? colors.cyan : '#6e7681',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '14px',
                  borderRadius: '4px'
                }}
                title="More info"
              >
                ℹ️
              </button>
            </div>
          </div>
          <div style={{ color: valueColor || '#ffffff', fontSize: '24px', fontWeight: 'bold', marginBottom: subValue ? '4px' : '8px' }}>
            {value}
          </div>
          {subValue && (
            <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '8px' }}>{subValue}</div>
          )}
          <div style={{ color: '#e6edf3', fontSize: '13px', lineHeight: '1.5' }}>
            {explanationFn}
          </div>
          {showMoreDepth[metricKey] && moreDepth && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'rgba(0, 217, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 217, 255, 0.2)',
              color: '#e6edf3',
              fontSize: '12px',
              lineHeight: '1.6',
              whiteSpace: 'pre-line'
            }}>
              {moreDepth}
            </div>
          )}
        </div>
      );

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    onClick={() => setSelectedAssetDetail(null)}
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
                  <button
                    onClick={() => handleClipNote('Asset Overview', selectedAssetDetail.symbol, `${selectedAssetDetail.name} - Price: $${selectedAssetDetail.price?.toFixed(2)}`, selectedAssetDetail.symbol, selectedAssetType)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(0, 217, 255, 0.1)',
                      border: '1px solid rgba(0, 217, 255, 0.3)',
                      borderRadius: '8px',
                      color: colors.cyan,
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📌 Add to Notes
                  </button>
                </div>
              </div>
            </div>

            {/* Asset Header */}
            <div style={{
              background: color.background,
              borderBottom: `3px solid ${color.primary}`,
              padding: '20px 16px'
            }}>
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '24px' }}>{selectedAssetDetail.symbol}</span>
                  <span style={{ color: '#8b949e', fontSize: '14px' }}>·</span>
                  <span style={{ color: '#8b949e', fontSize: '14px' }}>{selectedAssetDetail.name}</span>
                  {isStock && selectedAssetDetail.sector && (
                    <>
                      <span style={{ color: '#8b949e', fontSize: '14px' }}>·</span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: color.primary,
                        fontSize: '12px'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: color.primary
                        }} />
                        {selectedAssetDetail.sector}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: 'bold' }}>
                    ${selectedAssetDetail.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    color: safeNumber(selectedAssetDetail.percentChange) >= 0 ? colors.green : colors.red,
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    {safeNumber(selectedAssetDetail.percentChange) >= 0 ? '▲' : '▼'} {safeNumber(selectedAssetDetail.percentChange) >= 0 ? '+' : ''}{safeToFixed(selectedAssetDetail.percentChange, 2)}% today
                  </span>
                </div>
                {!isStock && metrics?.marketCapRank && (
                  <span style={{ color: '#8b949e', fontSize: '13px' }}>Rank #{metrics.marketCapRank} by Market Cap</span>
                )}
              </div>
            </div>

            {/* Content */}
            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 16px' }}>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                  <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }} />
                  <p>Loading {isStock ? 'fundamentals' : 'metrics'}...</p>
                </div>
              ) : isStock ? (
                // STOCK METRICS
                <>
                  <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Fundamentals
                  </h3>

                  <MetricCard
                    title="Beta"
                    value={fundamentals?.beta?.toFixed(2) || 'N/A'}
                    metricKey="beta"
                    explanationFn={stockMetricExplanations.beta.intermediate(fundamentals?.beta)}
                    moreDepth={stockMetricExplanations.beta.moreDepth}
                    valueColor={fundamentals?.beta > 1.2 ? colors.red : fundamentals?.beta < 0.8 ? colors.green : '#ffffff'}
                  />

                  <MetricCard
                    title="Analyst Consensus"
                    value={fundamentals?.analystConsensus ? `${fundamentals.analystConsensus.rating?.toFixed(1)} / 5.0` : 'N/A'}
                    subValue={fundamentals?.analystConsensus ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{'●'.repeat(Math.round(fundamentals.analystConsensus.rating || 0))}{'○'.repeat(5 - Math.round(fundamentals.analystConsensus.rating || 0))}</span>
                        <span style={{ fontSize: '11px' }}>
                          {fundamentals.analystConsensus.strongBuy} Strong Buy | {fundamentals.analystConsensus.buy} Buy | {fundamentals.analystConsensus.hold} Hold | {fundamentals.analystConsensus.sell + (fundamentals.analystConsensus.strongSell || 0)} Sell
                        </span>
                      </div>
                    ) : null}
                    metricKey="analystConsensus"
                    explanationFn={stockMetricExplanations.analystConsensus.intermediate(
                      fundamentals?.analystConsensus?.rating,
                      fundamentals?.analystConsensus?.totalAnalysts,
                      fundamentals?.analystConsensus?.buyPercent
                    )}
                    moreDepth={stockMetricExplanations.analystConsensus.moreDepth}
                    valueColor={fundamentals?.analystConsensus?.rating >= 4 ? colors.green : fundamentals?.analystConsensus?.rating <= 2 ? colors.red : '#ffffff'}
                  />

                  <MetricCard
                    title="Avg. Price Target"
                    value={fundamentals?.targetPrice ? `$${fundamentals.targetPrice.toFixed(2)}` : 'N/A'}
                    subValue={fundamentals?.targetPrice && fundamentals?.currentPrice ? (
                      <div>
                        <div style={{
                          height: '6px',
                          background: '#21262d',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            width: `${Math.min(100, (fundamentals.currentPrice / fundamentals.targetPrice) * 100)}%`,
                            height: '100%',
                            background: fundamentals.currentPrice < fundamentals.targetPrice ? colors.green : colors.red,
                            borderRadius: '3px'
                          }} />
                        </div>
                        <span style={{ fontSize: '11px' }}>
                          {((fundamentals.currentPrice / fundamentals.targetPrice) * 100).toFixed(0)}% of target ({((fundamentals.targetPrice - fundamentals.currentPrice) / fundamentals.currentPrice * 100).toFixed(0)}% {fundamentals.targetPrice > fundamentals.currentPrice ? 'upside' : 'downside'})
                        </span>
                      </div>
                    ) : null}
                    metricKey="priceTarget"
                    explanationFn={stockMetricExplanations.priceTarget.intermediate(fundamentals?.targetPrice, fundamentals?.currentPrice)}
                    moreDepth={stockMetricExplanations.priceTarget.moreDepth}
                  />

                  <MetricCard
                    title="PEG Ratio"
                    value={fundamentals?.pegRatio?.toFixed(2) || 'N/A'}
                    metricKey="pegRatio"
                    explanationFn={stockMetricExplanations.pegRatio.intermediate(fundamentals?.pegRatio)}
                    moreDepth={stockMetricExplanations.pegRatio.moreDepth}
                    valueColor={fundamentals?.pegRatio < 1 ? colors.green : fundamentals?.pegRatio > 2 ? colors.red : '#ffffff'}
                  />

                  <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Technicals
                  </h3>

                  <MetricCard
                    title="7-Day Momentum"
                    value={`${fundamentals?.momentum7d >= 0 ? '+' : ''}${fundamentals?.momentum7d?.toFixed(1) || 0}%`}
                    subValue={`Up ${fundamentals?.upDays7d || 0} of last 7 days`}
                    metricKey="momentum7d"
                    explanationFn={stockMetricExplanations.momentum7d.intermediate(fundamentals?.momentum7d, fundamentals?.upDays7d)}
                    moreDepth={stockMetricExplanations.momentum7d.moreDepth}
                    valueColor={fundamentals?.momentum7d >= 0 ? colors.green : colors.red}
                  />

                  <MetricCard
                    title="50-Day Moving Average"
                    value={fundamentals?.ma50 ? `$${fundamentals.ma50.toFixed(2)}` : 'N/A'}
                    subValue={fundamentals?.aboveMA50 !== undefined ? (
                      <span style={{ color: fundamentals.aboveMA50 ? colors.green : colors.red }}>
                        {fundamentals.aboveMA50 ? '✓' : '✗'} Price {fundamentals.aboveMA50 ? 'ABOVE' : 'BELOW'} 50 MA ({fundamentals.ma50Diff >= 0 ? '+' : ''}{fundamentals.ma50Diff?.toFixed(1)}%)
                      </span>
                    ) : null}
                    metricKey="ma50"
                    explanationFn={stockMetricExplanations.ma50.intermediate(fundamentals?.currentPrice, fundamentals?.ma50, fundamentals?.aboveMA50)}
                    moreDepth={stockMetricExplanations.ma50.moreDepth}
                  />

                  <MetricCard
                    title="200-Day Moving Average"
                    value={fundamentals?.ma200 ? `$${fundamentals.ma200.toFixed(2)}` : 'N/A'}
                    subValue={fundamentals?.aboveMA200 !== undefined ? (
                      <span style={{ color: fundamentals.aboveMA200 ? colors.green : colors.red }}>
                        {fundamentals.aboveMA200 ? '✓' : '✗'} Price {fundamentals.aboveMA200 ? 'ABOVE' : 'BELOW'} 200 MA ({fundamentals.ma200Diff >= 0 ? '+' : ''}{fundamentals.ma200Diff?.toFixed(1)}%)
                      </span>
                    ) : null}
                    metricKey="ma200"
                    explanationFn={stockMetricExplanations.ma200.intermediate(fundamentals?.currentPrice, fundamentals?.ma200, fundamentals?.aboveMA200)}
                    moreDepth={stockMetricExplanations.ma200.moreDepth}
                  />

                  <MetricCard
                    title="52-Week Range"
                    value={fundamentals?.range52wPosition !== undefined ? `${fundamentals.range52wPosition.toFixed(0)}% of range` : 'N/A'}
                    subValue={fundamentals?.week52Low && fundamentals?.week52High ? (
                      <div>
                        <div style={{
                          height: '8px',
                          background: '#21262d',
                          borderRadius: '4px',
                          position: 'relative',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: `${fundamentals.range52wPosition}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: colors.cyan,
                            border: '2px solid #161b22'
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span>${fundamentals.week52Low?.toFixed(2)}</span>
                          <span>${fundamentals.week52High?.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : null}
                    metricKey="range52w"
                    explanationFn={stockMetricExplanations.range52w.intermediate(fundamentals?.range52wPosition, fundamentals?.week52Low, fundamentals?.week52High)}
                    moreDepth={stockMetricExplanations.range52w.moreDepth}
                  />

                  {fundamentals?.nextEarningsDate && (
                    <div style={{
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginTop: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontWeight: '600', marginBottom: '4px' }}>
                        ⚠️ UPCOMING EVENT
                      </div>
                      <div style={{ color: '#e6edf3', fontSize: '14px' }}>
                        Earnings Report: {fundamentals.nextEarningsDate} ({fundamentals.nextEarningsTime || 'Time TBD'})
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // CRYPTO METRICS
                <>
                  <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Volatility
                  </h3>

                  <MetricCard
                    title="7-Day Volatility"
                    value={`${metrics?.volatility7d?.toFixed(1) || 0}%`}
                    subValue="Average daily price swing over the past week"
                    metricKey="volatility7d"
                    explanationFn={cryptoMetricExplanations.volatility7d.intermediate(metrics?.volatility7d)}
                    moreDepth={cryptoMetricExplanations.volatility7d.moreDepth}
                    valueColor={metrics?.volatility7d > 5 ? colors.red : metrics?.volatility7d < 3 ? colors.green : '#ffffff'}
                  />

                  <MetricCard
                    title="30-Day Volatility"
                    value={`${metrics?.volatility30d?.toFixed(1) || 0}%`}
                    metricKey="volatility30d"
                    explanationFn={cryptoMetricExplanations.volatility30d.intermediate(metrics?.volatility30d, metrics?.volatility7d)}
                    moreDepth={cryptoMetricExplanations.volatility30d.moreDepth}
                  />

                  <MetricCard
                    title="Volatility vs Bitcoin"
                    value={`${metrics?.volatilityVsBtc?.toFixed(1) || 1}x`}
                    subValue={
                      <div style={{ marginTop: '4px' }}>
                        <div style={{
                          height: '6px',
                          background: '#21262d',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(100, (metrics?.volatilityVsBtc || 1) * 33)}%`,
                            height: '100%',
                            background: metrics?.volatilityVsBtc > 2 ? colors.red : metrics?.volatilityVsBtc > 1.2 ? '#fbbf24' : colors.green,
                            borderRadius: '3px'
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', color: '#8b949e' }}>
                          {selectedAssetDetail.symbol} is {metrics?.volatilityVsBtc?.toFixed(1) || 1}x {metrics?.volatilityVsBtc > 1 ? 'more' : 'less'} volatile than BTC
                        </span>
                      </div>
                    }
                    metricKey="volatilityVsBtc"
                    explanationFn={cryptoMetricExplanations.volatilityVsBtc.intermediate(metrics?.volatilityVsBtc)}
                    moreDepth={cryptoMetricExplanations.volatilityVsBtc.moreDepth}
                  />

                  <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Volume
                  </h3>

                  <MetricCard
                    title="24-Hour Volume"
                    value={metrics?.volume24h >= 1e9 ? `$${(metrics.volume24h / 1e9).toFixed(1)}B` : `$${((metrics?.volume24h || 0) / 1e6).toFixed(0)}M`}
                    metricKey="volume24h"
                    explanationFn={cryptoMetricExplanations.volume24h.intermediate(metrics?.volume24h)}
                    moreDepth={cryptoMetricExplanations.volume24h.moreDepth}
                  />

                  <MetricCard
                    title="Volume vs 7-Day Avg"
                    value={`${metrics?.volumeVsAvg >= 0 ? '+' : ''}${metrics?.volumeVsAvg?.toFixed(0) || 0}%`}
                    subValue={Math.abs(metrics?.volumeVsAvg || 0) > 50 ? '⚡ Unusually high volume today' : null}
                    metricKey="volumeVsAvg"
                    explanationFn={cryptoMetricExplanations.volumeVsAvg.intermediate(metrics?.volumeVsAvg)}
                    moreDepth={cryptoMetricExplanations.volumeVsAvg.moreDepth}
                    valueColor={metrics?.volumeVsAvg > 50 ? '#fbbf24' : '#ffffff'}
                  />

                  <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Momentum
                  </h3>

                  <MetricCard
                    title="7-Day Momentum"
                    value={`${metrics?.momentum7d >= 0 ? '+' : ''}${metrics?.momentum7d?.toFixed(1) || 0}%`}
                    metricKey="cryptoMomentum7d"
                    explanationFn={cryptoMetricExplanations.momentum7d.intermediate(metrics?.momentum7d)}
                    moreDepth={cryptoMetricExplanations.momentum7d.moreDepth}
                    valueColor={metrics?.momentum7d >= 0 ? colors.green : colors.red}
                  />

                  <MetricCard
                    title="30-Day Momentum"
                    value={`${metrics?.momentum30d >= 0 ? '+' : ''}${metrics?.momentum30d?.toFixed(1) || 0}%`}
                    metricKey="cryptoMomentum30d"
                    explanationFn={cryptoMetricExplanations.momentum30d.intermediate(metrics?.momentum30d, metrics?.momentum7d)}
                    moreDepth={cryptoMetricExplanations.momentum30d.moreDepth}
                    valueColor={metrics?.momentum30d >= 0 ? colors.green : colors.red}
                  />

                  <MetricCard
                    title="Distance from ATH"
                    value={`${metrics?.distanceFromATH?.toFixed(0) || 0}%`}
                    subValue={metrics?.athPrice ? `All-Time High: $${metrics.athPrice.toFixed(2)} (${metrics.athDate || 'Unknown'})` : null}
                    metricKey="distanceFromATH"
                    explanationFn={cryptoMetricExplanations.distanceFromATH.intermediate(metrics?.distanceFromATH, metrics?.athPrice, metrics?.athDate)}
                    moreDepth={cryptoMetricExplanations.distanceFromATH.moreDepth}
                    valueColor={Math.abs(metrics?.distanceFromATH || 0) < 20 ? colors.green : Math.abs(metrics?.distanceFromATH || 0) > 70 ? colors.red : '#ffffff'}
                  />
                </>
              )}

              {/* Custom Note Input */}
              <div style={{
                background: '#161b22',
                borderRadius: '12px',
                border: '1px solid #21262d',
                padding: '16px',
                marginTop: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#8b949e', fontSize: '13px' }}>
                  ✏️ ADD CUSTOM NOTE
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customNoteText}
                    onChange={(e) => setCustomNoteText(e.target.value)}
                    placeholder="Add your insight about this asset..."
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#0d1117',
                      border: '1px solid #21262d',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={() => handleAddCustomNote(selectedAssetDetail.symbol, selectedAssetType)}
                    disabled={!customNoteText.trim()}
                    style={{
                      padding: '12px 20px',
                      background: customNoteText.trim() ? colors.cyan : '#21262d',
                      color: customNoteText.trim() ? '#000' : '#6e7681',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: customNoteText.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // MAIN RESEARCH MODE VIEW
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
                    setSelectedAssetDetail(null);
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
                <button
                  onClick={() => setResearchViewMode('guided')}
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ✨ Guided Flow
                </button>
              </div>

              {/* Three-Tab Toggle: Stocks | Crypto | Notes */}
              <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '12px',
                padding: '4px',
                background: '#0d1117',
                borderRadius: '10px'
              }}>
                <button
                  onClick={() => setResearchActiveTab('stocks')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: researchActiveTab === 'stocks' ? colors.cyan : 'transparent',
                    color: researchActiveTab === 'stocks' ? '#000' : '#8b949e',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Stocks ({stocksData.length})
                </button>
                <button
                  onClick={() => setResearchActiveTab('crypto')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: researchActiveTab === 'crypto' ? colors.cyan : 'transparent',
                    color: researchActiveTab === 'crypto' ? '#000' : '#8b949e',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Crypto ({cryptoData.length})
                </button>
                <button
                  onClick={() => setResearchActiveTab('notes')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: researchActiveTab === 'notes' ? colors.cyan : 'transparent',
                    color: researchActiveTab === 'notes' ? '#000' : '#8b949e',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  My Notes {currentWeekNotes.length > 0 && <span style={{
                    background: researchActiveTab === 'notes' ? '#000' : colors.cyan,
                    color: researchActiveTab === 'notes' ? colors.cyan : '#000',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontWeight: '700'
                  }}>{currentWeekNotes.length}</span>}
                </button>
                <button
                  onClick={() => setResearchActiveTab('advisor')}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: researchActiveTab === 'advisor' ? colors.cyan : 'transparent',
                    color: researchActiveTab === 'advisor' ? '#000' : '#8b949e',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  AI
                </button>
              </div>

              {/* Search (only for stocks/crypto tabs) */}
              {researchActiveTab !== 'notes' && researchActiveTab !== 'advisor' && (
                <div style={{ position: 'relative' }}>
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
                      outline: 'none',
                      boxSizing: 'border-box'
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
              )}
            </div>
          </div>

          {/* Content */}
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px', paddingBottom: '100px' }}>

            {/* NOTES TAB */}
            {researchActiveTab === 'notes' && (
              <div>
                {/* Weekly Progress */}
                <div style={{
                  background: '#161b22',
                  borderRadius: '16px',
                  border: '1px solid #21262d',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '14px' }}>WEEKLY RESEARCH PROGRESS</span>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>Week of {getCurrentWeekMonday()}</span>
                  </div>
                  <div style={{
                    height: '10px',
                    background: '#21262d',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${colors.green} 0%, ${colors.cyan} 100%)`,
                      borderRadius: '5px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: '#8b949e', fontSize: '13px' }}>{currentWeekNotes.length}/{RESEARCH_REQUIREMENTS.minimumNotes} notes</span>
                    <span style={{ color: '#8b949e', fontSize: '13px' }}>{assetsWithNotes.length}/{RESEARCH_REQUIREMENTS.minimumAssets} assets covered</span>
                  </div>
                  <div style={{
                    background: 'rgba(0, 217, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#e6edf3',
                    fontSize: '13px'
                  }}>
                    <span style={{ color: colors.cyan }}>Complete {RESEARCH_REQUIREMENTS.minimumNotes} notes on {RESEARCH_REQUIREMENTS.minimumAssets}+ assets to earn:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '16px' }}>🔥</span>
                      <span style={{ fontWeight: '700' }}>{calculateResearchXP(researchStreak + 1).total} XP</span>
                      {researchStreak > 0 && (
                        <span style={{ color: '#8b949e', fontSize: '12px' }}>
                          ({researchStreak}-week streak bonus: +{calculateResearchXP(researchStreak + 1).streakBonus} XP)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Game Plan Section */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  border: '1px solid rgba(0, 217, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px'
                }}>
                  <button
                    onClick={handleGenerateGamePlan}
                    disabled={gamePlanLoading || currentWeekNotes.length === 0}
                    style={{
                      width: '100%',
                      background: currentWeekNotes.length === 0
                        ? '#21262d'
                        : 'linear-gradient(135deg, #00d9ff 0%, #a855f7 100%)',
                      border: 'none',
                      color: currentWeekNotes.length === 0 ? '#8b949e' : '#000',
                      fontWeight: '600',
                      fontSize: '15px',
                      padding: '14px 20px',
                      borderRadius: '8px',
                      cursor: gamePlanLoading || currentWeekNotes.length === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: gamePlanLoading ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {gamePlanLoading ? (
                      <>
                        <span style={{ animation: 'pulse 1.5s infinite' }}>⏳</span>
                        Analyzing your research...
                      </>
                    ) : (
                      <>🎯 Generate Game Plan</>
                    )}
                  </button>

                  {currentWeekNotes.length === 0 && (
                    <p style={{
                      color: '#8b949e',
                      fontSize: '13px',
                      textAlign: 'center',
                      marginTop: '10px',
                      marginBottom: '0'
                    }}>
                      Save some research notes first, then I'll help you build a strategy!
                    </p>
                  )}

                  {/* Game Plan Response */}
                  {gamePlanResponse && (
                    <div style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      {gamePlanResponse.error ? (
                        <div style={{
                          background: 'rgba(248, 81, 73, 0.1)',
                          border: '1px solid rgba(248, 81, 73, 0.3)',
                          borderRadius: '8px',
                          padding: '12px',
                          color: '#f85149',
                          fontSize: '13px'
                        }}>
                          {gamePlanResponse.error}
                        </div>
                      ) : (
                        <div style={{
                          background: '#0d1117',
                          borderRadius: '8px',
                          padding: '16px',
                          color: '#e6edf3',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            paddingBottom: '12px',
                            borderBottom: '1px solid #21262d'
                          }}>
                            <span style={{ fontSize: '18px' }}>🎯</span>
                            <span style={{ fontWeight: '700', color: colors.cyan }}>Your Game Plan</span>
                          </div>
                          {gamePlanResponse.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes Divider */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '20px 0 16px 0',
                  color: '#8b949e',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  <span>📝 Your Saved Notes ({currentWeekNotes.length})</span>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    background: '#21262d',
                    marginLeft: '12px'
                  }} />
                </div>

                {/* Notes by Asset */}
                {currentWeekNotes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <p style={{ marginBottom: '8px' }}>No notes yet this week</p>
                    <p style={{ fontSize: '13px' }}>Tap on any stock or crypto to view metrics and clip notes</p>
                  </div>
                ) : (
                  <>
                    {/* Stock Notes */}
                    {currentWeekNotes.filter(n => n.assetType === 'stock').length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase' }}>
                          STOCKS
                        </h3>
                        {[...new Set(currentWeekNotes.filter(n => n.assetType === 'stock').map(n => n.symbol))].map(symbol => {
                          const notes = currentWeekNotes.filter(n => n.symbol === symbol && n.assetType === 'stock');
                          const isExpanded = notesExpanded[`stock-${symbol}`];
                          return (
                            <div key={symbol} style={{
                              background: '#161b22',
                              borderRadius: '12px',
                              border: '1px solid #21262d',
                              marginBottom: '8px',
                              overflow: 'hidden'
                            }}>
                              <button
                                onClick={() => setNotesExpanded(prev => ({ ...prev, [`stock-${symbol}`]: !prev[`stock-${symbol}`] }))}
                                style={{
                                  width: '100%',
                                  padding: '14px 16px',
                                  background: 'transparent',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  color: '#ffffff'
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  📁 {symbol} <span style={{ color: '#8b949e', fontSize: '13px' }}>({notes.length} note{notes.length !== 1 ? 's' : ''})</span>
                                </span>
                                <span style={{ color: '#6e7681' }}>{isExpanded ? '▼' : '▶'}</span>
                              </button>
                              {isExpanded && (
                                <div style={{ padding: '0 16px 16px' }}>
                                  {notes.map(note => (
                                    <div key={note.id} style={{
                                      background: '#0d1117',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      marginBottom: '8px',
                                      position: 'relative'
                                    }}>
                                      <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        style={{
                                          position: 'absolute',
                                          top: '8px',
                                          right: '8px',
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#6e7681',
                                          cursor: 'pointer',
                                          fontSize: '12px'
                                        }}
                                      >✕</button>
                                      {note.type === 'clipped' ? (
                                        <>
                                          <div style={{ color: colors.cyan, fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>{note.metricName}</div>
                                          <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{note.metricValue}</div>
                                          <div style={{ color: '#8b949e', fontSize: '12px' }}>{note.explanation}</div>
                                        </>
                                      ) : (
                                        <div style={{ color: '#e6edf3', fontSize: '13px' }}>{note.customText}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Crypto Notes */}
                    {currentWeekNotes.filter(n => n.assetType === 'crypto').length > 0 && (
                      <div>
                        <h3 style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase' }}>
                          CRYPTO
                        </h3>
                        {[...new Set(currentWeekNotes.filter(n => n.assetType === 'crypto').map(n => n.symbol))].map(symbol => {
                          const notes = currentWeekNotes.filter(n => n.symbol === symbol && n.assetType === 'crypto');
                          const isExpanded = notesExpanded[`crypto-${symbol}`];
                          return (
                            <div key={symbol} style={{
                              background: '#161b22',
                              borderRadius: '12px',
                              border: '1px solid #21262d',
                              marginBottom: '8px',
                              overflow: 'hidden'
                            }}>
                              <button
                                onClick={() => setNotesExpanded(prev => ({ ...prev, [`crypto-${symbol}`]: !prev[`crypto-${symbol}`] }))}
                                style={{
                                  width: '100%',
                                  padding: '14px 16px',
                                  background: 'transparent',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  color: '#ffffff'
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  📁 {symbol} <span style={{ color: '#8b949e', fontSize: '13px' }}>({notes.length} note{notes.length !== 1 ? 's' : ''})</span>
                                </span>
                                <span style={{ color: '#6e7681' }}>{isExpanded ? '▼' : '▶'}</span>
                              </button>
                              {isExpanded && (
                                <div style={{ padding: '0 16px 16px' }}>
                                  {notes.map(note => (
                                    <div key={note.id} style={{
                                      background: '#0d1117',
                                      borderRadius: '8px',
                                      padding: '12px',
                                      marginBottom: '8px',
                                      position: 'relative'
                                    }}>
                                      <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        style={{
                                          position: 'absolute',
                                          top: '8px',
                                          right: '8px',
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#6e7681',
                                          cursor: 'pointer',
                                          fontSize: '12px'
                                        }}
                                      >✕</button>
                                      {note.type === 'clipped' ? (
                                        <>
                                          <div style={{ color: cryptoColor.primary, fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>{note.metricName}</div>
                                          <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{note.metricValue}</div>
                                          <div style={{ color: '#8b949e', fontSize: '12px' }}>{note.explanation}</div>
                                        </>
                                      ) : (
                                        <div style={{ color: '#e6edf3', fontSize: '13px' }}>{note.customText}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* AI Insights */}
                    {currentWeekNotes.filter(n => n.assetType === 'ai_insight').length > 0 && (
                      <div style={{ marginTop: '20px' }}>
                        <h3 style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase' }}>
                          AI INSIGHTS
                        </h3>
                        {currentWeekNotes.filter(n => n.assetType === 'ai_insight').map(note => (
                          <div key={note.id} style={{
                            background: '#161b22',
                            borderRadius: '12px',
                            border: '1px solid #21262d',
                            marginBottom: '8px',
                            padding: '14px 16px',
                            position: 'relative'
                          }}>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'transparent',
                                border: 'none',
                                color: '#6e7681',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >✕</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{
                                background: 'rgba(139, 92, 246, 0.2)',
                                color: '#a78bfa',
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: '600'
                              }}>
                                🤖 AI Insight
                              </span>
                              <span style={{ color: '#6e7681', fontSize: '11px' }}>
                                from {note.source || 'Research Advisor'}
                              </span>
                            </div>
                            <div style={{ color: '#e6edf3', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', paddingRight: '20px' }}>
                              {note.customText}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Finalize Button */}
                {canFinalize && (
                  <button
                    onClick={() => {
                      setShowResearchComplete(true);
                      setResearchStreak(prev => prev + 1);
                      // Award XP here
                    }}
                    style={{
                      width: '100%',
                      padding: '16px',
                      marginTop: '20px',
                      background: 'linear-gradient(90deg, #10b981 0%, #00d9ff 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#000',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    ✓ Finalize & Complete Weekly Research
                  </button>
                )}
              </div>
            )}

            {/* AI ADVISOR TAB */}
            {researchActiveTab === 'advisor' && (
              <>
                {/* Phase 1-3: Research Advisor (Explore Phase) */}
                {researchPhase === 'explore' && (
                  <ResearchAdvisor
                    portfolio={[]}
                    weekAheadEvents={weekAheadEvents}
                    userNotes={currentWeekNotes}
                    stocksData={stocksData}
                    cryptoData={cryptoData}
                    onPinNote={handlePinAINote}
                    onStartConvictionCheck={handleStartConvictionCheck}
                    colors={colors}
                  />
                )}

                {/* Phase 4: Conviction Check */}
                {researchPhase === 'conviction' && (
                  <ConvictionCheck
                    thesis={researchThesis}
                    recommendations={[...stocksData, ...cryptoData].slice(0, 20)}
                    convictionData={convictionData}
                    setConvictionData={setConvictionData}
                    onComplete={handleConvictionComplete}
                    onBack={handleBackFromConviction}
                    onOpenAssetPicker={handleOpenAssetPicker}
                    colors={colors}
                  />
                )}

                {/* Phase 5: Game Plan */}
                {researchPhase === 'gameplan' && (
                  <GamePlan
                    gamePlan={researchGamePlan}
                    thesis={researchThesis}
                    convictionData={convictionData}
                    isLoading={researchGamePlanLoading}
                    onUsePortfolio={handleUseResearchPortfolio}
                    onSaveToNotes={handleSaveGamePlanToNotes}
                    onBack={handleBackFromGamePlan}
                    colors={colors}
                  />
                )}

                {/* Asset Picker Modal */}
                <AssetPickerModal
                  isOpen={showAssetPicker}
                  onClose={() => setShowAssetPicker(false)}
                  onSelect={handleAssetPickerSelect}
                  type={assetPickerType}
                  stocksData={stocksData}
                  cryptoData={cryptoData}
                  excludeSymbols={[...convictionData.mustHave, ...convictionData.mustAvoid]}
                  colors={colors}
                />
              </>
            )}

            {/* STOCKS/CRYPTO TAB - Asset List */}
            {researchActiveTab !== 'notes' && researchActiveTab !== 'advisor' && (
              <>
                {sortedAssets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                    <p>No assets found matching "{researchSearchTerm}"</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {sortedAssets.map((asset, index) => {
                      const isStock = researchActiveTab === 'stocks';
                      const color = isStock ? getSectorColor(asset.sector || 'Unknown') : cryptoColor;

                      return (
                        <motion.div
                          key={asset.symbol}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => handleOpenDetail(asset, isStock ? 'stock' : 'crypto')}
                          style={{
                            background: '#161b22',
                            border: '1px solid #21262d',
                            borderLeft: `3px solid ${color.primary}`,
                            borderRadius: '12px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'background 0.2s, border-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = color.background;
                            e.currentTarget.style.borderColor = color.border;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#161b22';
                            e.currentTarget.style.borderColor = '#21262d';
                          }}
                        >
                          {/* Card Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div>
                              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px', marginBottom: '2px' }}>
                                {asset.symbol}
                              </div>
                              <div style={{ color: '#8b949e', fontSize: '13px' }}>
                                {asset.name}
                              </div>
                              {isStock && asset.sector && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: color.primary
                                  }} />
                                  <span style={{ color: color.primary, fontSize: '11px' }}>{asset.sector}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '16px' }}>
                                ${asset.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div style={{
                                color: safeNumber(asset.percentChange) >= 0 ? colors.green : colors.red,
                                fontSize: '13px',
                                fontWeight: '500'
                              }}>
                                {safeNumber(asset.percentChange) >= 0 ? '▲' : '▼'} {safeNumber(asset.percentChange) >= 0 ? '+' : ''}{safeToFixed(asset.percentChange, 2)}%
                              </div>
                            </div>
                          </div>

                          {/* Quick Stats */}
                          <div style={{
                            display: 'flex',
                            gap: '12px',
                            paddingTop: '8px',
                            borderTop: '1px solid #21262d',
                            fontSize: '12px',
                            color: '#8b949e'
                          }}>
                            {isStock ? (
                              <>
                                <span>Beta: <span style={{ color: '#ffffff' }}>{stockFundamentals[asset.symbol]?.beta?.toFixed(2) || '-'}</span></span>
                                <span>7D: <span style={{ color: (asset.priceChange7d || 0) >= 0 ? colors.green : colors.red }}>{(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(1)}%</span></span>
                                <span>Analysts: <span style={{ color: '#ffffff' }}>{stockFundamentals[asset.symbol]?.analystConsensus?.rating?.toFixed(1) || '-'}★</span></span>
                              </>
                            ) : (
                              <>
                                <span>Vol: <span style={{ color: '#ffffff' }}>{cryptoMetrics[asset.symbol]?.volatility7d?.toFixed(1) || '-'}%</span></span>
                                <span>7D: <span style={{ color: (asset.priceChange7d || 0) >= 0 ? colors.green : colors.red }}>{(asset.priceChange7d || 0) >= 0 ? '+' : ''}{(asset.priceChange7d || 0).toFixed(1)}%</span></span>
                                <span>vs BTC: <span style={{ color: '#ffffff' }}>{cryptoMetrics[asset.symbol]?.volatilityVsBtc?.toFixed(1) || '-'}x</span></span>
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN - New Flowing Card Layout
  if (screen === 'dashboard') {
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
        {/* Animated Desktop Background */}
        <DesktopBackground isDesktop={isDesktop} />

        {/* Global Overlays */}
        <ChallengeToast />
        <MidGameChallengePopup />
        <RiskChallengePopup />
        <RiskChallengeResultPopup />
        <SlotMachineOverlay />

        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: colors.background,
          position: 'relative',
          zIndex: 1
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
                onClick={() => setSidebarOpen(true)}
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

              {/* Right Side - User Info with Avatar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '4px 8px'
              }}>
                {/* Avatar Circle */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#1a1f2e',
                  border: '2px solid #00d9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#ffffff'
                }}>
                  {(user?.username || 'P')[0].toUpperCase()}
                </div>
                {/* User Text Info */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start'
                }}>
                  <span style={{
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {user?.username || 'Player'}
                  </span>
                  <span style={{
                    color: '#8b949e',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {user?.rank || 'Rookie'}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Game Mode Toggle - Phase 1: Draft Mode Foundation */}
          <div style={{
            background: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '12px 16px',
            marginBottom: '16px'
          }}>
            <div style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'center',
              gap: '8px'
            }}>
              {/* Snake Draft 4P - LEFT (default) */}
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
              {/* Builder 1v1 - RIGHT */}
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

            {/* ⭐ Active Training Battles Section (Firebase-persisted) */}
            {activeTrainingBattles.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  color: '#a855f7',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>🤖</span> Training Battles
                </h3>

                {activeTrainingBattles.map(battle => {
                  // Calculate time remaining
                  const endTime = battle.timeline?.endDate ? new Date(battle.timeline.endDate) : null;
                  const now = new Date();
                  let timeRemaining = '';

                  if (endTime) {
                    const diff = endTime - now;
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                    if (hours > 0) {
                      timeRemaining = `${hours}h ${minutes}m left`;
                    } else if (minutes > 0) {
                      timeRemaining = `${minutes}m left`;
                    } else {
                      timeRemaining = 'Ending soon';
                    }
                  }

                  // Calculate current gains (simplified - uses stored values)
                  const myGain = battle.player1?.percentChange || 0;
                  const cpuGain = battle.player2?.percentChange || 0;
                  const isWinning = myGain > cpuGain;

                  return (
                    <div
                      key={battle.id}
                      onClick={() => {
                        // Convert Firebase format to localStorage format for battle view
                        const convertedBattle = {
                          id: battle.id,
                          challengeCode: 'TRAINING',
                          creator: battle.player1?.username || user.username,
                          opponent: 'CPU Opponent',
                          creatorPortfolio: battle.player1?.portfolio || [],
                          opponentPortfolio: battle.player2?.portfolio || [],
                          portfolioName: battle.player1?.portfolioName || 'Training Portfolio',
                          portfolioType: battle.player1?.portfolioType || 'stocks',
                          status: 'active',
                          startDate: battle.timeline?.startDate,
                          endDate: battle.timeline?.endDate,
                          startingPrices: battle.state?.startingPrices || {},
                          isTrainingBattle: true,
                          createdAt: battle.timeline?.createdAt
                        };
                        setCurrentBattle(convertedBattle);
                        setActiveBattleId(battle.id);
                        setScreen('battle');
                      }}
                      style={{
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
                        border: '2px solid #a855f7',
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
                          <span style={{ fontSize: '24px' }}>🤖</span>
                          <div>
                            <div style={{
                              color: '#a855f7',
                              fontWeight: 'bold',
                              fontSize: '16px'
                            }}>
                              {battle.player1?.portfolioName || 'Training Battle'}
                            </div>
                            <div style={{
                              color: '#8b949e',
                              fontSize: '12px'
                            }}>
                              vs CPU Opponent • {battle.player1?.portfolioType === 'crypto' ? '🪙 Crypto' : '📈 Stocks'}
                            </div>
                          </div>
                        </div>

                        {/* Training Badge */}
                        <div style={{
                          background: 'rgba(168, 85, 247, 0.2)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          color: '#a855f7',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          TRAINING
                        </div>
                      </div>

                      {/* Progress Row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{
                            background: isWinning ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            color: isWinning ? '#22c55e' : '#ef4444',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {myGain >= 0 ? '+' : ''}{myGain.toFixed(2)}%
                          </div>
                          <span style={{ color: '#6e7681', fontSize: '12px' }}>
                            {isWinning ? 'Leading' : myGain === cpuGain ? 'Tied' : 'Behind'}
                          </span>
                        </div>

                        {/* Time Remaining */}
                        <div style={{
                          background: 'rgba(168, 85, 247, 0.2)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          color: '#a855f7',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          ⏱️ {timeRemaining}
                        </div>
                      </div>

                      {/* View Battle Link */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                      }}>
                        <div style={{
                          color: '#a855f7',
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
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* CREATE BATTLE Card */}
              {(() => {
                const createColor = gameMode === 'draft' ? '#10b981' : colors.cyan;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    onClick={async () => {
                      setPortfolio([]); setPortfolioType(null);
                      setPortfolioName('');
                      setAssetType('stocks');
                      setSearchTerm('');
                      setSelectedCrypto(null);
                      setBuilderMode('create');

                      // Check for upcoming high-impact events and show alert (only once per session)
                      const alreadyShown = sessionStorage.getItem('volatilityAlertShown');
                      if (!alreadyShown) {
                        const highImpact = await checkUpcomingHighImpactEvents();
                        if (highImpact && highImpact.length > 0) {
                          setShowVolatilityAlert(true);
                          sessionStorage.setItem('volatilityAlertShown', 'true');
                        }
                      }

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
                      setBuilderMode('join');
                      // Route based on game mode
                      if (gameMode === 'draft') {
                        setScreen('draftJoin');   // New screen for draft join
                      } else {
                        setScreen('join');        // Code entry screen first
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

            {/* Training Mode Section - Different design for draft vs classic */}
            {gameMode === 'draft' ? (
              /* SNAKE DRAFT TRAINING SECTION - Redesigned with circular buttons */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '16px',
                  padding: '20px',
                  marginTop: '12px',
                  marginBottom: '24px'
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '6px'
                }}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '14px' }}>🎯</span>
                  </div>
                  <h3 style={{
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: '700',
                    margin: 0,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Training Mode
                  </h3>
                </div>

                {/* Subheader */}
                <p style={{
                  color: '#a78bfa',
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: '0 0 20px 0'
                }}>
                  Start drafting now!
                </p>

                {/* CSS Animations for Training Buttons */}
                <style>{`
                  @keyframes pulse-glow {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.08); }
                  }
                  @keyframes pulse-ring {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.12); opacity: 0.2; }
                  }
                  @keyframes rotate-arc {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>

                {/* Circular Buttons Container */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '40px'
                }}>
                  {/* Stocks Training Button - Polished */}
                  <button
                    onClick={() => {
                      setPortfolio([]); setPortfolioType('stocks');
                      setPortfolioName('');
                      setAssetType('stocks');
                      setSearchTerm('');
                      setSelectedCrypto(null);
                      setBuilderMode('training');
                      setScreen('draftTraining');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                      {/* Outer glow */}
                      <div style={{
                        position: 'absolute',
                        inset: '-12px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
                        animation: 'pulse-glow 2s ease-in-out infinite'
                      }} />
                      {/* Pulsing ring */}
                      <div style={{
                        position: 'absolute',
                        inset: '-4px',
                        borderRadius: '50%',
                        border: '2px solid #22c55e',
                        animation: 'pulse-ring 2s ease-in-out infinite'
                      }} />
                      {/* Main circle with gradient */}
                      <div style={{
                        width: '90px',
                        height: '90px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 24px rgba(34, 197, 94, 0.5), inset 0 2px 10px rgba(255,255,255,0.2)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* Shine overlay */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '50%',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
                          borderRadius: '50% 50% 0 0'
                        }} />
                        {/* Trending Up Chart SVG Icon */}
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                          <path
                            d="M3 17L9 11L13 15L21 7"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15 7H21V13"
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      {/* Rotating arc */}
                      <svg style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '-6px',
                        width: '102px',
                        height: '102px',
                        animation: 'rotate-arc 4s linear infinite',
                        pointerEvents: 'none'
                      }}>
                        <circle
                          cx="51"
                          cy="51"
                          r="47"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2"
                          strokeDasharray="50 250"
                          strokeLinecap="round"
                          opacity="0.6"
                        />
                      </svg>
                    </div>
                    <span style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '800',
                      letterSpacing: '1px',
                      textShadow: '0 0 12px rgba(34, 197, 94, 0.6)'
                    }}>
                      STOCKS
                    </span>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>~5 min</span>
                  </button>

                  {/* Crypto Training Button - Polished */}
                  <button
                    onClick={() => {
                      setPortfolio([]); setPortfolioType('crypto');
                      setPortfolioName('');
                      setAssetType('crypto');
                      setSearchTerm('');
                      setSelectedCrypto(null);
                      setBuilderMode('training');
                      setScreen('draftTraining');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                      {/* Outer glow */}
                      <div style={{
                        position: 'absolute',
                        inset: '-12px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)',
                        animation: 'pulse-glow 2s ease-in-out infinite'
                      }} />
                      {/* Pulsing ring */}
                      <div style={{
                        position: 'absolute',
                        inset: '-4px',
                        borderRadius: '50%',
                        border: '2px solid #f59e0b',
                        animation: 'pulse-ring 2s ease-in-out infinite'
                      }} />
                      {/* Main circle with gradient */}
                      <div style={{
                        width: '90px',
                        height: '90px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 24px rgba(245, 158, 11, 0.5), inset 0 2px 10px rgba(255,255,255,0.2)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* Shine overlay */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '50%',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)',
                          borderRadius: '50% 50% 0 0'
                        }} />
                        {/* Bitcoin SVG Icon */}
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                          <path
                            d="M9.5 6.5V5M9.5 19V17.5M14.5 6.5V5M14.5 19V17.5"
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M8 6.5H14C15.6569 6.5 17 7.84315 17 9.5C17 11.1569 15.6569 12.5 14 12.5H8V6.5Z"
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            fill="none"
                          />
                          <path
                            d="M8 12.5H15C16.6569 12.5 18 13.8431 18 15.5C18 17.1569 16.6569 18.5 15 18.5H8V12.5Z"
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            fill="none"
                          />
                          <path
                            d="M8 6.5V18.5"
                            stroke="#ffffff"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      {/* Rotating arc */}
                      <svg style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '-6px',
                        width: '102px',
                        height: '102px',
                        animation: 'rotate-arc 4s linear infinite',
                        pointerEvents: 'none'
                      }}>
                        <circle
                          cx="51"
                          cy="51"
                          r="47"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeDasharray="50 250"
                          strokeLinecap="round"
                          opacity="0.6"
                        />
                      </svg>
                    </div>
                    <span style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '800',
                      letterSpacing: '1px',
                      textShadow: '0 0 12px rgba(245, 158, 11, 0.6)'
                    }}>
                      CRYPTO
                    </span>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>~5 min</span>
                  </button>
                </div>

                {/* Helper Text */}
                <p style={{
                  color: '#8b949e',
                  fontSize: '11px',
                  textAlign: 'center',
                  margin: '16px 0 0 0'
                }}>
                  Practice against CPU opponents - No pressure, just learning
                </p>
              </motion.div>
            ) : (
              /* Classic Mode Training Banner - Unchanged */
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
                  setSelectedCrypto(null);
                  setBuilderMode('training');
                  setScreen('builder');
                }}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '16px 24px',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  marginTop: '12px',
                  marginBottom: '24px',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
                }}
              >
                <Brain style={{ height: '28px', width: '28px', color: '#ffffff' }} />
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    Training Mode
                  </span>
                  <span style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    marginLeft: '12px'
                  }}>
                    Practice your strategy
                  </span>
                </div>
                <ArrowRight style={{ height: '20px', width: '20px', color: '#ffffff' }} />
              </motion.div>
            )}

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
                  onClick={() => setSidebarOpen(false)}
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

                {/* WEEK AHEAD CALENDAR */}
                <button
                  onClick={() => {
                    setShowWeekAhead(true);
                    setSidebarOpen(false);
                    loadWeekAheadData();
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>Week Ahead</div>
                    {upcomingHighImpactEvents.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#ef4444' }}>
                        {upcomingHighImpactEvents.length} high-impact event{upcomingHighImpactEvents.length > 1 ? 's' : ''} soon
                      </div>
                    )}
                  </div>
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

        {/* ============================================ */}
        {/* NOTIFICATIONS MODAL */}
        {/* ============================================ */}
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
        {/* RULES MODAL - With 3 Tabs */}
        {/* ============================================ */}
        {showRulesModal && (
          <>
            <div
              onClick={() => setShowRulesModal(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                zIndex: 200,
                backdropFilter: 'blur(4px)'
              }}
            />
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 210
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 20px 16px 20px',
                borderBottom: '1px solid #21262d'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>📋</span>
                  <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: 0 }}>
                    MarketClash Rules
                  </h2>
                </div>
                <button
                  onClick={() => setShowRulesModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#8b949e',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>

              {/* Tab Buttons */}
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '16px 20px',
                borderBottom: '1px solid #21262d'
              }}>
                {[
                  { id: 'classic', label: 'Classic Battle', icon: '⚔️', color: '#00d9ff' },
                  { id: 'snake', label: 'Snake Draft', icon: '🐍', color: '#10b981' },
                  { id: 'challenges', label: 'Challenges', icon: '🎯', color: '#f59e0b' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRulesActiveTab(tab.id)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      background: rulesActiveTab === tab.id ? `${tab.color}15` : 'transparent',
                      border: rulesActiveTab === tab.id
                        ? `2px solid ${tab.color}`
                        : '2px solid #21262d',
                      borderRadius: '8px',
                      color: rulesActiveTab === tab.id ? tab.color : '#6b7280',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content Area - Scrollable */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
              }}>
                {/* CLASSIC BATTLE TAB */}
                {rulesActiveTab === 'classic' && (
                  <div style={{ color: '#e6edf3', fontSize: '14px', lineHeight: '1.6' }}>
                    <h3 style={{ color: '#00d9ff', fontSize: '16px', marginBottom: '10px', marginTop: 0 }}>
                      Building Your Portfolio
                    </h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li>Select <strong style={{ color: '#ffffff' }}>6-12 stocks</strong> to go LONG (buy)</li>
                      <li>Optionally select <strong style={{ color: '#ef4444' }}>0-2 stocks</strong> to SHORT</li>
                      <li>Select exactly <strong style={{ color: '#f59e0b' }}>1 crypto</strong> (buy OR short)</li>
                      <li>Total portfolio: <strong style={{ color: '#ffffff' }}>7-13 assets</strong></li>
                      <li>Each asset: <strong style={{ color: '#22c55e' }}>7.5% - 20%</strong> allocation</li>
                    </ul>

                    <h3 style={{ color: '#22c55e', fontSize: '16px', marginBottom: '10px' }}>
                      How Positions Work
                    </h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li><strong style={{ color: '#22c55e' }}>LONG (Buy)</strong>: You profit when price goes UP</li>
                      <li><strong style={{ color: '#ef4444' }}>SHORT</strong>: You profit when price goes DOWN</li>
                    </ul>

                    <h3 style={{ color: '#f59e0b', fontSize: '16px', marginBottom: '10px' }}>
                      Battle Rules
                    </h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li>Battles last <strong style={{ color: '#ffffff' }}>24 hours</strong></li>
                      <li>Uses <strong style={{ color: '#ffffff' }}>real market prices</strong></li>
                      <li>Highest portfolio % gain wins!</li>
                    </ul>

                    <h3 style={{ color: '#8b5cf6', fontSize: '16px', marginBottom: '10px' }}>
                      Stock Categories
                    </h3>
                    <ul style={{ paddingLeft: '20px', color: '#8b949e' }}>
                      <li><strong style={{ color: '#00d9ff' }}>Leadership</strong>: Large-cap market leaders</li>
                      <li><strong style={{ color: '#8b5cf6' }}>Momentum</strong>: Best 30-day performers</li>
                      <li><strong style={{ color: '#22c55e' }}>Stable</strong>: Defensive, dividend stocks</li>
                      <li><strong style={{ color: '#ef4444' }}>Short</strong>: Volatile stocks (short only)</li>
                    </ul>
                  </div>
                )}

                {/* SNAKE DRAFT TAB */}
                {rulesActiveTab === 'snake' && (
                  <div style={{ color: '#e6edf3', fontSize: '14px', lineHeight: '1.6' }}>
                    <h3 style={{ color: '#10b981', fontSize: '16px', marginBottom: '10px', marginTop: 0 }}>
                      What is Snake Draft?
                    </h3>
                    <p style={{ color: '#8b949e', marginBottom: '16px' }}>
                      A <strong style={{ color: '#ffffff' }}>4-player</strong> fantasy-style draft where players take turns
                      picking stocks. The pick order reverses each round (like a snake), giving everyone a fair shot
                      at the best assets.
                    </p>

                    <h3 style={{ color: '#00d9ff', fontSize: '16px', marginBottom: '10px' }}>
                      How the Draft Works
                    </h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li><strong style={{ color: '#ffffff' }}>4 players</strong> compete (you + 3 others or CPUs)</li>
                      <li><strong style={{ color: '#ffffff' }}>9 rounds</strong> of drafting</li>
                      <li>Pick order <strong style={{ color: '#10b981' }}>reverses</strong> each round</li>
                      <li>Example: Round 1 → 1,2,3,4 | Round 2 → 4,3,2,1</li>
                      <li><strong style={{ color: '#f59e0b' }}>30 seconds</strong> per pick (auto-pick if time runs out)</li>
                    </ul>

                    <h3 style={{ color: '#8b5cf6', fontSize: '16px', marginBottom: '10px' }}>
                      Category Requirements
                    </h3>
                    <p style={{ color: '#8b949e', marginBottom: '10px' }}>
                      You must draft from each category:
                    </p>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li><strong style={{ color: '#22c55e' }}>Steady</strong>: 3 picks (blue chips, stable)</li>
                      <li><strong style={{ color: '#ef4444' }}>Risky</strong>: 3 picks (growth, volatile)</li>
                      <li><strong style={{ color: '#00d9ff' }}>Defensive</strong>: 3 picks (utilities, healthcare)</li>
                    </ul>

                    <h3 style={{ color: '#f59e0b', fontSize: '16px', marginBottom: '10px' }}>
                      After the Draft
                    </h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li>Battle runs for <strong style={{ color: '#ffffff' }}>1 week</strong></li>
                      <li>All 9 picks are <strong style={{ color: '#ffffff' }}>equally weighted</strong></li>
                      <li>Uses <strong style={{ color: '#ffffff' }}>real market prices</strong></li>
                      <li>Highest portfolio % gain wins!</li>
                    </ul>

                    <h3 style={{ color: '#22c55e', fontSize: '16px', marginBottom: '10px' }}>
                      Placement & Rewards
                    </h3>
                    <ul style={{ paddingLeft: '20px', color: '#8b949e' }}>
                      <li>🥇 <strong style={{ color: '#fbbf24' }}>1st Place</strong>: Most XP + Win recorded</li>
                      <li>🥈 <strong style={{ color: '#9ca3af' }}>2nd Place</strong>: Moderate XP</li>
                      <li>🥉 <strong style={{ color: '#d97706' }}>3rd Place</strong>: Small XP</li>
                      <li>4th Place: Participation XP</li>
                    </ul>
                  </div>
                )}

                {/* CHALLENGES TAB */}
                {rulesActiveTab === 'challenges' && (
                  <div style={{ color: '#e6edf3', fontSize: '14px', lineHeight: '1.6' }}>
                    <h3 style={{ color: '#f59e0b', fontSize: '16px', marginBottom: '10px', marginTop: 0 }}>
                      What are Challenges?
                    </h3>
                    <p style={{ color: '#8b949e', marginBottom: '16px' }}>
                      Challenges are <strong style={{ color: '#ffffff' }}>bonus objectives</strong> that reward you with
                      extra XP. Complete them to level up faster and show off your skills!
                    </p>

                    <h3 style={{ color: '#ec4899', fontSize: '16px', marginBottom: '10px' }}>
                      🎯 Weekly Challenges
                    </h3>
                    <p style={{ color: '#8b949e', marginBottom: '10px' }}>
                      Found on your <strong style={{ color: '#ffffff' }}>Dashboard</strong>. These reset every week.
                    </p>
                    <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: '#8b949e' }}>
                      <li><strong style={{ color: '#ffffff' }}>Win 3 Battles</strong> - Win any 3 battles this week</li>
                      <li><strong style={{ color: '#ffffff' }}>Try Snake Draft</strong> - Complete a snake draft battle</li>
                      <li><strong style={{ color: '#ffffff' }}>Diversify</strong> - Use all 4 stock categories in one portfolio</li>
                      <li><strong style={{ color: '#ffffff' }}>Perfect Portfolio</strong> - Win with 10%+ gains</li>
                    </ul>
                    <div style={{
                      background: 'rgba(236, 72, 153, 0.1)',
                      border: '1px solid rgba(236, 72, 153, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '20px'
                    }}>
                      <span style={{ color: '#ec4899', fontSize: '12px' }}>
                        💡 Check the Dashboard to see your weekly progress!
                      </span>
                    </div>

                    <h3 style={{ color: '#8b5cf6', fontSize: '16px', marginBottom: '10px' }}>
                      ⚡ Mid-Game Challenges
                    </h3>
                    <p style={{ color: '#8b949e', marginBottom: '10px' }}>
                      These appear <strong style={{ color: '#ffffff' }}>during active battles</strong> and reward quick thinking.
                    </p>
                    <ul style={{ paddingLeft: '20px', marginBottom: '20px', color: '#8b949e' }}>
                      <li><strong style={{ color: '#22c55e' }}>Leading at Halftime</strong> - Be ahead at the 12-hour mark</li>
                      <li><strong style={{ color: '#00d9ff' }}>Comeback King</strong> - Win after being down at halftime</li>
                      <li><strong style={{ color: '#f59e0b' }}>Streak Master</strong> - Win 3 battles in a row</li>
                      <li><strong style={{ color: '#ef4444' }}>Underdog Victory</strong> - Win with a risky portfolio</li>
                    </ul>

                    <h3 style={{ color: '#22c55e', fontSize: '16px', marginBottom: '10px' }}>
                      💰 XP Rewards
                    </h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: '#8b949e' }}>
                      <li>Weekly challenges: <strong style={{ color: '#22c55e' }}>+50-200 XP</strong> each</li>
                      <li>Mid-game challenges: <strong style={{ color: '#22c55e' }}>+25-100 XP</strong> each</li>
                      <li>Complete all weekly: <strong style={{ color: '#fbbf24' }}>+500 XP bonus!</strong></li>
                    </ul>

                    <div style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '8px',
                      padding: '12px'
                    }}>
                      <h4 style={{ color: '#22c55e', fontSize: '13px', marginTop: 0, marginBottom: '8px' }}>
                        💡 Pro Tips
                      </h4>
                      <ul style={{ paddingLeft: '16px', margin: 0, color: '#8b949e', fontSize: '12px' }}>
                        <li>Check challenges before building your portfolio</li>
                        <li>Some challenges stack - plan accordingly!</li>
                        <li>Training mode battles count toward challenges</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 20px',
                borderTop: '1px solid #21262d'
              }}>
                <button
                  onClick={() => setShowRulesModal(false)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#0d1117',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Got It!
                </button>
              </div>
            </div>
          </>
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
      </div>
    );
  }

  // PORTFOLIO BUILDER SCREEN (Create Game) - COMPLETE OVERHAUL
  if (screen === 'builder') {
    // Stock category definitions
    const LEADERSHIP_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK.B', 'JPM', 'V', 'MA', 'UNH', 'JNJ', 'WMT', 'PG', 'HD', 'XOM'];
    const STABLE_STOCKS = ['KO', 'PEP', 'MCD', 'COST', 'VZ', 'T', 'PFE', 'MRK', 'ABBV', 'LLY', 'NEE', 'DUK', 'SO', 'D', 'CVX', 'COP'];

    // Short category - organized by type
    const SHORT_VOLATILE_STOCKS = ['TSLA', 'RIVN', 'LCID', 'SNAP', 'HOOD', 'COIN', 'GME', 'AMC', 'PLTR', 'SMCI'];
    const SHORT_INDEX_ETFS = ['SPY', 'QQQ', 'DIA', 'IWM'];
    const SHORT_CRYPTO = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'];
    const SHORT_STOCKS = [...SHORT_VOLATILE_STOCKS, ...SHORT_INDEX_ETFS];

    // Allowed crypto for BUY section
    const ALLOWED_CRYPTO = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE'];

    // ETF placeholder data (in case not in stocksData)
    const ETF_DATA = {
      'SPY': { symbol: 'SPY', name: 'S&P 500 ETF', price: 450, percentChange: 0.5 },
      'QQQ': { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: 380, percentChange: 0.7 },
      'DIA': { symbol: 'DIA', name: 'Dow Jones ETF', price: 350, percentChange: 0.3 },
      'IWM': { symbol: 'IWM', name: 'Russell 2000 ETF', price: 200, percentChange: 0.4 }
    };

    // Volatile stock placeholder data (in case not in stocksData)
    const VOLATILE_STOCK_DATA = {
      'TSLA': { symbol: 'TSLA', name: 'Tesla', price: 250, percentChange: -1.2 },
      'RIVN': { symbol: 'RIVN', name: 'Rivian', price: 15, percentChange: -2.1 },
      'LCID': { symbol: 'LCID', name: 'Lucid Motors', price: 4, percentChange: -1.8 },
      'SNAP': { symbol: 'SNAP', name: 'Snap', price: 12, percentChange: -0.9 },
      'HOOD': { symbol: 'HOOD', name: 'Robinhood', price: 18, percentChange: 1.5 },
      'COIN': { symbol: 'COIN', name: 'Coinbase', price: 180, percentChange: 2.3 },
      'GME': { symbol: 'GME', name: 'GameStop', price: 25, percentChange: -3.2 },
      'AMC': { symbol: 'AMC', name: 'AMC Entertainment', price: 5, percentChange: -1.5 },
      'PLTR': { symbol: 'PLTR', name: 'Palantir', price: 45, percentChange: 1.8 },
      'SMCI': { symbol: 'SMCI', name: 'Super Micro', price: 35, percentChange: -4.2 }
    };

    // Get Momentum stocks dynamically (best 30-day performers from remaining stocks)
    const getMomentumStocks = () => {
      const excludeSymbols = [...LEADERSHIP_STOCKS, ...STABLE_STOCKS, ...SHORT_STOCKS];
      const remainingStocks = stocksData.filter(s => !excludeSymbols.includes(s.symbol));
      return remainingStocks
        .sort((a, b) => (b.priceChange30d || 0) - (a.priceChange30d || 0))
        .slice(0, 16)
        .map(s => s.symbol);
    };

    const MOMENTUM_STOCKS = getMomentumStocks();

    // Get stocks for a category
    const getCategoryStocks = (category) => {
      let symbols = [];
      switch (category) {
        case 'Leadership': symbols = LEADERSHIP_STOCKS; break;
        case 'Momentum': symbols = MOMENTUM_STOCKS; break;
        case 'Stable': symbols = STABLE_STOCKS; break;
        case 'Short': symbols = SHORT_VOLATILE_STOCKS; break; // Only volatile stocks for regular grid
        default: symbols = [];
      }
      return stocksData.filter(s => symbols.includes(s.symbol));
    };

    // Get short assets by sub-category with fallback data
    const getShortVolatileStocks = () => {
      return SHORT_VOLATILE_STOCKS.map(symbol => {
        const stockData = stocksData.find(s => s.symbol === symbol);
        return stockData || VOLATILE_STOCK_DATA[symbol] || { symbol, name: symbol, price: 0, percentChange: 0 };
      });
    };

    const getShortETFs = () => {
      return SHORT_INDEX_ETFS.map(symbol => {
        const stockData = stocksData.find(s => s.symbol === symbol);
        return stockData || ETF_DATA[symbol] || { symbol, name: symbol, price: 0, percentChange: 0 };
      });
    };

    const getShortCrypto = () => {
      return SHORT_CRYPTO.map(symbol => {
        const crypto = cryptoData.find(c => c.symbol === symbol);
        return crypto || { symbol, name: symbol, price: 0, percentChange: 0 };
      }).filter(c => c.price > 0);
    };

    // Calculate counts - separate longs from shorts (includes crypto shorts)
    const ALL_SHORT_SYMBOLS = [...SHORT_STOCKS, ...SHORT_CRYPTO];
    const longPositions = portfolio.filter(p => !ALL_SHORT_SYMBOLS.includes(p.symbol) && p.position !== 'short');
    const shortPositions = portfolio.filter(p => ALL_SHORT_SYMBOLS.includes(p.symbol) || p.position === 'short');
    const longCount = longPositions.length;
    const shortCount = shortPositions.length;
    const hasCrypto = selectedCrypto !== null;
    const totalSelected = longCount + shortCount + (hasCrypto ? 1 : 0);

    // Validation: 6-12 longs + 0-2 shorts + 1 crypto = 7-13 total
    const isPortfolioValid = longCount >= 6 && longCount <= 12 && shortCount <= 2 && hasCrypto && totalSelected >= 7 && totalSelected <= 13;

    // Get filtered crypto
    const allowedCryptoData = cryptoData.filter(c => ALLOWED_CRYPTO.includes(c.symbol));

    // Filter stocks by category and search
    const categoryStocks = getCategoryStocks(builderCategory);
    const filteredCategoryStocks = categoryStocks.filter(asset =>
      searchTerm === '' ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Responsive columns
    const getGridColumns = () => {
      if (typeof window === 'undefined') return 4;
      const w = window.innerWidth;
      if (w < 400) return 3;
      if (w < 640) return 4;
      if (w < 1024) return 6;
      return 8;
    };

    // Toggle stock in portfolio
    const toggleBuilderStock = (asset) => {
      const inPortfolio = portfolio.some(p => p.symbol === asset.symbol);
      const isShortCategory = builderCategory === 'Short';

      if (inPortfolio) {
        setPortfolio(prev => prev.filter(p => p.symbol !== asset.symbol));
      } else {
        // Validate limits
        if (isShortCategory && shortCount >= 2) return;
        if (!isShortCategory && longCount >= 12) return;

        setPortfolio(prev => [...prev, {
          ...asset,
          percentage: 14.29,
          position: isShortCategory ? 'short' : 'long'
        }]);

        if (!portfolioType) setPortfolioType('stocks');
      }
    };

    // Handle crypto selection - simple BUY only
    const handleCryptoSelect = (symbol) => {
      if (selectedCrypto === symbol) {
        setSelectedCrypto(null);
      } else {
        setSelectedCrypto(symbol);
      }
    };

    // Format price helper
    const formatBuilderPrice = (price) => {
      if (!price) return '0.00';
      if (price >= 1000) return `${(price / 1000).toFixed(1)}K`;
      if (price >= 1) return price.toFixed(2);
      return price.toFixed(4);
    };

    return (
      <div style={containerStyle}>
        <DesktopBackground isDesktop={isDesktop} />

        <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* HEADER */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: '#0d1117',
            borderBottom: '1px solid #21262d',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}>
            <button
              onClick={() => { setPortfolio([]); setPortfolioType(null); setPortfolioName(''); setSelectedCrypto(null); setBuilderMode('create'); setJoinCode(''); setScreen('dashboard'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <h1 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {builderMode === 'training' ? 'Training Mode' : builderMode === 'join' ? 'Join Battle' : 'Build Portfolio'}
              </h1>
              {/* Mode-specific badge */}
              {builderMode === 'join' && joinCode && (
                <span style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '3px 10px',
                  borderRadius: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Joining: {joinCode}
                </span>
              )}
              {builderMode === 'training' && (
                <span style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '3px 10px',
                  borderRadius: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  vs CPU
                </span>
              )}
            </div>

            <button
              onClick={() => setShowPortfolioManager(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                position: 'relative'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Cart
              {totalSelected > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {totalSelected}
                </span>
              )}
            </button>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, overflow: 'auto', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
            {/* PORTFOLIO STATUS CARD */}
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '12px',
              padding: '16px',
              margin: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📊</span>
                  <span style={{ color: '#ffffff', fontSize: '16px', fontWeight: '700' }}>Your Portfolio</span>
                </div>
                <span style={{ color: '#8b949e', fontSize: '12px' }}>6-12 Longs • 0-2 Shorts (optional) • 1 Crypto</span>
              </div>

              <div style={{ width: '100%', height: '8px', background: '#21262d', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((totalSelected / 7) * 100, 100)}%`,
                  background: totalSelected >= 7 ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(90deg, #00d9ff 0%, #0099cc 100%)',
                  borderRadius: '4px',
                  transition: 'all 0.3s ease'
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#8b949e', fontSize: '12px' }}>
                  Longs: <span style={{ color: longCount >= 6 ? '#22c55e' : '#00d9ff', fontWeight: '600' }}>{longCount}/6 min</span>
                  {' • '}
                  Shorts: <span style={{ color: shortCount > 0 ? '#ef4444' : '#8b949e', fontWeight: '600' }}>{shortCount}/2</span>
                  {' • '}
                  Crypto: <span style={{ color: hasCrypto ? '#22c55e' : '#f59e0b', fontWeight: '600' }}>{hasCrypto ? '1/1' : '0/1'}</span>
                </span>
                <span style={{ color: totalSelected >= 7 ? '#22c55e' : '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                  {totalSelected >= 7 ? `${totalSelected} selected ✓` : `${totalSelected}/7 minimum`}
                </span>
              </div>
            </div>

            {/* CATEGORY TABS */}
            <div style={{ display: 'flex', gap: '6px', padding: '0 12px', marginBottom: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {[
                { id: 'Leadership', label: 'Leadership', color: '#00d9ff' },
                { id: 'Momentum', label: 'Momentum', color: '#8b5cf6' },
                { id: 'Stable', label: 'Stable', color: '#22c55e' },
                { id: 'Short', label: 'Short', color: '#ef4444' }
              ].map((cat) => {
                const isActive = builderCategory === cat.id;
                const count = getCategoryStocks(cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setBuilderCategory(cat.id)}
                    style={{
                      flex: '1 0 auto',
                      minWidth: '80px',
                      padding: '10px 14px',
                      background: isActive ? cat.color : '#161b22',
                      border: isActive ? 'none' : '1px solid #21262d',
                      borderRadius: '8px',
                      color: isActive ? (cat.id === 'Short' ? '#ffffff' : '#0d1117') : '#8b949e',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* SEARCH BAR - Only for non-Short categories */}
            {builderCategory !== 'Short' && (
              <div style={{ position: 'relative', padding: '0 12px', marginBottom: '12px' }}>
                <span style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e', fontSize: '14px' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* STOCK GRID - For non-Short categories */}
            {loadingMarketData ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                <Loader2 style={{ height: '32px', width: '32px', color: '#00d9ff', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : builderCategory !== 'Short' ? (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)`,
                  gap: '8px',
                  padding: '0 12px',
                  width: '100%',
                  boxSizing: 'border-box'
                }}>
                  {filteredCategoryStocks.map((asset) => {
                    const isSelected = portfolio.some(p => p.symbol === asset.symbol);
                    const isDisabled = !isSelected && longCount >= 12;
                    const changePercent = asset.percentChange || asset.change24h || 0;

                    return (
                      <button
                        key={asset.symbol}
                        onClick={() => !isDisabled && toggleBuilderStock(asset)}
                        disabled={isDisabled}
                        style={{
                          background: isSelected ? 'rgba(0, 217, 255, 0.12)' : '#161b22',
                          border: isSelected ? '2px solid #00d9ff' : '1px solid #21262d',
                          borderRadius: '10px',
                          padding: '10px 6px',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.4 : 1,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          minHeight: '90px'
                        }}
                      >
                        <div style={{ color: isSelected ? '#00d9ff' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                          {asset.symbol}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                          {asset.name}
                        </div>
                        <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                          ${formatBuilderPrice(asset.price)}
                        </div>
                        <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                          {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* SHORT CATEGORY - Organized Sub-sections */
              <>
                {/* Main Short Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#ef4444', opacity: 0.3 }} />
                  <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="#ef4444"><path d="M6 11L1 4H11L6 11Z" /></svg>
                    Short Positions (Max 2)
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#ef4444', opacity: 0.3 }} />
                </div>

                {/* Volatile Stocks Sub-section */}
                <div style={{ marginBottom: '28px', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingLeft: '4px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1.5px solid rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                        <polyline points="17 18 23 18 23 12" />
                      </svg>
                    </div>
                    <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>
                      Volatile Stocks
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(239, 68, 68, 0.4), transparent)', marginLeft: '8px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 120px))',
                      gap: '10px',
                      justifyContent: 'center',
                      width: '100%',
                      maxWidth: '700px'
                    }}>
                    {getShortVolatileStocks().map((asset) => {
                      const isSelected = portfolio.some(p => p.symbol === asset.symbol);
                      const isDisabled = !isSelected && shortCount >= 2;
                      const changePercent = asset.percentChange || asset.change24h || 0;
                      return (
                        <button
                          key={asset.symbol}
                          onClick={() => !isDisabled && toggleBuilderStock(asset)}
                          disabled={isDisabled}
                          style={{
                            background: isSelected ? 'rgba(239, 68, 68, 0.12)' : '#161b22',
                            border: isSelected ? '2px solid #ef4444' : '1px solid #21262d',
                            borderRadius: '10px',
                            padding: '10px 6px',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            minHeight: '90px'
                          }}
                        >
                          {isSelected && (
                            <div style={{ color: '#ef4444', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="#ef4444"><path d="M6 11L1 4H11L6 11Z" /></svg>
                              SHORT
                            </div>
                          )}
                          <div style={{ color: isSelected ? '#ef4444' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                            {asset.symbol}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                            {asset.name}
                          </div>
                          <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                            ${formatBuilderPrice(asset.price)}
                          </div>
                          <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                            {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>

                {/* Index ETFs Sub-section */}
                <div style={{ marginBottom: '28px', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingLeft: '4px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1.5px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </div>
                    <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>
                      Index ETFs (Hedge)
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(245, 158, 11, 0.4), transparent)', marginLeft: '8px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 120px))',
                      gap: '10px',
                      justifyContent: 'center',
                      width: '100%',
                      maxWidth: '550px'
                    }}>
                    {getShortETFs().map((asset) => {
                      const isSelected = portfolio.some(p => p.symbol === asset.symbol);
                      const isDisabled = !isSelected && shortCount >= 2;
                      const changePercent = asset.percentChange || asset.change24h || 0;
                      return (
                        <button
                          key={asset.symbol}
                          onClick={() => !isDisabled && toggleBuilderStock(asset)}
                          disabled={isDisabled}
                          style={{
                            background: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#161b22',
                            border: isSelected ? '2px solid #f59e0b' : '1px solid #21262d',
                            borderRadius: '10px',
                            padding: '10px 6px',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            minHeight: '90px'
                          }}
                        >
                          {isSelected && (
                            <div style={{ color: '#f59e0b', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 11L1 4H11L6 11Z" /></svg>
                              SHORT
                            </div>
                          )}
                          <div style={{ color: isSelected ? '#f59e0b' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                            {asset.symbol}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                            {asset.name}
                          </div>
                          <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                            ${formatBuilderPrice(asset.price)}
                          </div>
                          <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                            {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>

                {/* Crypto Shorts Sub-section */}
                <div style={{ marginBottom: '20px', padding: '0 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingLeft: '4px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1.5px solid rgba(139, 92, 246, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" />
                      </svg>
                    </div>
                    <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>
                      Crypto Shorts
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(139, 92, 246, 0.4), transparent)', marginLeft: '8px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 120px))',
                      gap: '10px',
                      justifyContent: 'center',
                      width: '100%',
                      maxWidth: '800px'
                    }}>
                    {getShortCrypto().map((crypto) => {
                      const isSelected = portfolio.some(p => p.symbol === crypto.symbol && p.position === 'short');
                      const isDisabled = !isSelected && shortCount >= 2;
                      const changePercent = crypto.percentChange || crypto.change24h || 0;
                      return (
                        <button
                          key={crypto.symbol}
                          onClick={() => {
                            if (isDisabled) return;
                            const inPortfolio = portfolio.some(p => p.symbol === crypto.symbol && p.position === 'short');
                            if (inPortfolio) {
                              setPortfolio(prev => prev.filter(p => !(p.symbol === crypto.symbol && p.position === 'short')));
                            } else {
                              setPortfolio(prev => [...prev, { ...crypto, percentage: 14.29, position: 'short' }]);
                            }
                          }}
                          disabled={isDisabled}
                          style={{
                            background: isSelected ? 'rgba(139, 92, 246, 0.12)' : '#161b22',
                            border: isSelected ? '2px solid #8b5cf6' : '1px solid #21262d',
                            borderRadius: '10px',
                            padding: '10px 6px',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            minHeight: '90px'
                          }}
                        >
                          {isSelected && (
                            <div style={{ color: '#8b5cf6', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="#8b5cf6"><path d="M6 11L1 4H11L6 11Z" /></svg>
                              SHORT
                            </div>
                          )}
                          <div style={{ color: isSelected ? '#8b5cf6' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                            {crypto.symbol}
                          </div>
                          <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                            {crypto.name}
                          </div>
                          <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                            ${formatBuilderPrice(crypto.price)}
                          </div>
                          <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                            {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                          </div>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              </>
            )}

                {/* CRYPTO SECTION - Simple BUY only tiles - Centered */}
                <div style={{ padding: '12px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1, maxWidth: '100px', height: '1px', background: '#f59e0b', opacity: 0.3 }} />
                    <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      ₿ Crypto (Pick 1)
                    </span>
                    <div style={{ flex: 1, maxWidth: '100px', height: '1px', background: '#f59e0b', opacity: 0.3 }} />
                  </div>

                  {/* Centered crypto grid */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 500
                        ? 'repeat(3, minmax(80px, 110px))'
                        : 'repeat(6, minmax(80px, 110px))',
                      gap: '8px',
                      maxWidth: '720px'
                    }}>
                      {allowedCryptoData.map((crypto) => {
                        const isSelected = selectedCrypto === crypto.symbol;
                        const changePercent = crypto.percentChange || crypto.change24h || 0;

                        return (
                          <button
                            key={crypto.symbol}
                            onClick={() => handleCryptoSelect(crypto.symbol)}
                            style={{
                              background: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#161b22',
                              border: isSelected ? '2px solid #f59e0b' : '1px solid #21262d',
                              borderRadius: '10px',
                              padding: '10px 6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              minHeight: '90px'
                            }}
                          >
                            {isSelected && (
                              <div style={{ color: '#f59e0b', fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <svg width="8" height="8" viewBox="0 0 12 12" fill="#f59e0b"><path d="M6 1L11 8H1L6 1Z" /></svg>
                                BUY
                              </div>
                            )}
                            <div style={{ color: isSelected ? '#f59e0b' : '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
                              {crypto.symbol}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '9px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', padding: '0 2px' }}>
                              {crypto.name}
                            </div>
                            <div style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>
                              ${formatBuilderPrice(crypto.price)}
                            </div>
                            <div style={{ color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600' }}>
                              {changePercent >= 0 ? '+' : ''}{safeToFixed(changePercent, 1)}%
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* TEMPLATE BUTTONS */}
                <div style={{ display: 'flex', gap: '8px', margin: '16px 12px', paddingTop: '16px', borderTop: '1px solid #21262d' }}>
                  <button
                    onClick={() => setShowTemplatesModal(true)}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      backgroundColor: '#21262d',
                      color: '#d1d5db',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    📂 Load Template
                  </button>
                  {portfolio.length >= 5 && (
                    <button
                      onClick={() => setSaveTemplateModal(true)}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        backgroundColor: '#22c55e20',
                        color: '#22c55e',
                        border: '1px solid #22c55e40',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      💾 Save Template
                    </button>
                  )}
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

              {/* DISTRIBUTE EVENLY BUTTON */}
              {(portfolio.length > 0 || selectedCrypto) && (
                <button
                  onClick={() => {
                    // Count total assets INCLUDING crypto
                    const totalAssets = portfolio.length + (selectedCrypto ? 1 : 0);
                    if (totalAssets === 0) return;

                    // Use integer basis points (10000 = 100%) to avoid floating point issues
                    const TOTAL_BASIS_POINTS = 10000;
                    const basePointsPerAsset = Math.floor(TOTAL_BASIS_POINTS / totalAssets);
                    const remainderPoints = TOTAL_BASIS_POINTS - (basePointsPerAsset * totalAssets);

                    // Update all stock assets with even distribution
                    setPortfolio(prev => prev.map((asset, index) => {
                      // First 'remainderPoints' assets each get +1 basis point (0.01%)
                      const bonusPoint = index < remainderPoints ? 1 : 0;
                      const totalPoints = basePointsPerAsset + bonusPoint;
                      const percentage = totalPoints / 100; // Convert basis points to percentage

                      return {
                        ...asset,
                        percentage: percentage,
                        amount: (percentage / 100) * 1000000
                      };
                    }));

                    // Update crypto percentage if selected
                    if (selectedCrypto) {
                      // Crypto gets its share - account for portfolio assets that got bonus points
                      const cryptoIndex = portfolio.length; // Crypto comes after portfolio assets
                      const cryptoBonusPoint = cryptoIndex < remainderPoints ? 1 : 0;
                      const cryptoPoints = basePointsPerAsset + cryptoBonusPoint;
                      setCryptoPercentage(cryptoPoints / 100);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0d1117',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '16px',
                    boxShadow: '0 2px 8px rgba(0, 217, 255, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  ⚖️ Distribute Evenly
                </button>
              )}

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

              {/* CRYPTO SECTION - Show selected crypto with adjustable allocation */}
              {selectedCrypto && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{
                    color: '#f59e0b',
                    fontSize: '13px',
                    fontWeight: '700',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '14px' }}>₿</span>
                    CRYPTO (1)
                  </h3>
                  <div style={{
                    backgroundColor: '#161b22',
                    border: '2px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '14px'
                  }}>
                    {/* Header Row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '12px'
                    }}>
                      <div>
                        <div style={{
                          color: '#ffffff',
                          fontSize: '16px',
                          fontWeight: '700'
                        }}>
                          {selectedCrypto}
                        </div>
                        <div style={{
                          color: '#f59e0b',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {cryptoData.find(c => c.symbol === selectedCrypto)?.name || selectedCrypto}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => {
                          setSelectedCrypto(null);
                          setCryptoPercentage(10);
                        }}
                        style={{
                          width: '28px',
                          height: '28px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Allocation Dropdown */}
                    <div style={{
                      background: '#0d1117',
                      border: '1px solid #21262d',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '10px'
                    }}>
                      <select
                        value={cryptoPercentage}
                        onChange={(e) => setCryptoPercentage(Number(e.target.value))}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        {[7.5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(val => (
                          <option key={val} value={val} style={{ background: '#0d1117' }}>{val}%</option>
                        ))}
                      </select>
                    </div>

                    {/* Fine Tune Slider */}
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px'
                      }}>
                        <span style={{ color: '#8b949e', fontSize: '12px' }}>Fine tune</span>
                        <span style={{ color: '#f59e0b', fontSize: '14px', fontWeight: '600' }}>
                          {cryptoPercentage}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="7.5"
                        max="20"
                        step="0.5"
                        value={cryptoPercentage}
                        onChange={(e) => setCryptoPercentage(Number(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#f59e0b'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '4px'
                      }}>
                        <span style={{ color: '#6b7280', fontSize: '11px' }}>7.5%</span>
                        <span style={{ color: '#6b7280', fontSize: '11px' }}>20%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VALIDATION MESSAGES */}
              {(portfolio.length > 0 || selectedCrypto) && (
                <div style={{ marginTop: '16px' }}>
                  {portfolio.length < 6 && portfolio.length > 0 && (
                    <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '4px' }}>
                      • Need at least 6 stocks (have {portfolio.length})
                    </p>
                  )}
                  {!selectedCrypto && (
                    <p style={{ color: '#f59e0b', fontSize: '13px', marginBottom: '4px' }}>
                      • You must select 1 crypto to continue
                    </p>
                  )}
                  {Math.abs(totalPercentage - 100) >= 0.01 && (portfolio.length > 0 || selectedCrypto) && (
                    <p style={{ color: '#ef4444', fontSize: '13px' }}>
                      • Total must equal 100% (currently {totalPercentage.toFixed(1)}%)
                    </p>
                  )}
                  {(cryptoPercentage < 7.5 || cryptoPercentage > 20) && selectedCrypto && (
                    <p style={{ color: '#ef4444', fontSize: '13px' }}>
                      • Crypto allocation must be 7.5-20%
                    </p>
                  )}
                </div>
              )}

              {/* SUBMIT BUTTON - Handles different modes */}
              <button
                onClick={() => {
                  // Call appropriate handler based on mode
                  if (builderMode === 'training') {
                    handleCreateTrainingBattle();
                  } else if (builderMode === 'join') {
                    handleJoinBattle();
                  } else {
                    handleCreateBattle();
                  }
                  setShowPortfolioManager(false);
                }}
                disabled={
                  !portfolioName ||
                  portfolio.length < 6 ||
                  portfolio.length > 12 ||
                  !selectedCrypto ||
                  Math.abs(totalPercentage - 100) >= 0.01 ||
                  cryptoPercentage < 7.5 || cryptoPercentage > 20 ||
                  (builderMode === 'join' && (!joinCode || joinCode.length !== 6))
                }
                style={{
                  width: '100%',
                  backgroundColor: portfolioName && portfolio.length >= 6 && portfolio.length <= 12 && selectedCrypto && Math.abs(totalPercentage - 100) < 0.01 && cryptoPercentage >= 7.5 && cryptoPercentage <= 20
                    ? builderMode === 'training' ? '#a855f7' : builderMode === 'join' ? '#06b6d4' : '#8b5cf6'
                    : '#21262d',
                  color: portfolioName && portfolio.length >= 6 && portfolio.length <= 12 && selectedCrypto && Math.abs(totalPercentage - 100) < 0.01 && cryptoPercentage >= 7.5 && cryptoPercentage <= 20
                    ? '#ffffff'
                    : '#6e7681',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: portfolioName && portfolio.length >= 6 && portfolio.length <= 12 && selectedCrypto && Math.abs(totalPercentage - 100) < 0.01 && cryptoPercentage >= 7.5 && cryptoPercentage <= 20
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
                  : !selectedCrypto
                  ? 'Select 1 Crypto'
                  : Math.abs(totalPercentage - 100) >= 0.01
                  ? `Adjust to 100% (${totalPercentage.toFixed(1)}%)`
                  : builderMode === 'training'
                  ? '🤖 Start Training Battle'
                  : builderMode === 'join'
                  ? '🎯 Join Battle'
                  : '⚔️ Create Battle'}
              </button>
            </div>
          </div>
        )}

        {/* SAVE TEMPLATE MODAL */}
        {saveTemplateModal && (
          <>
            <div
              onClick={() => setSaveTemplateModal(false)}
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
              padding: '24px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginBottom: '16px' }}>
                Save Portfolio Template
              </h2>
              <input
                type="text"
                placeholder="Template name..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#0d1117',
                  border: '1px solid #21262d',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  marginBottom: '16px'
                }}
              />
              <div style={{
                backgroundColor: '#0d1117',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>Assets to save:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {portfolio.map(asset => (
                    <span key={asset.symbol} style={{
                      padding: '4px 8px',
                      backgroundColor: '#21262d',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#00d9ff'
                    }}>
                      {asset.symbol}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setSaveTemplateModal(false);
                    setTemplateName('');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#21262d',
                    color: '#8b949e',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (templateName.trim() && portfolio.length > 0) {
                      const symbols = portfolio.map(a => a.symbol);
                      savePortfolioTemplate(templateName.trim(), symbols, portfolioType || assetType);
                      setSaveTemplateModal(false);
                      setTemplateName('');
                      // Show toast or notification
                      addNotification('system', 'Template Saved!', `Your "${templateName.trim()}" template has been saved.`);
                    }
                  }}
                  disabled={!templateName.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: templateName.trim() ? '#22c55e' : '#21262d',
                    color: templateName.trim() ? '#000000' : '#6e7681',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: templateName.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Save Template
                </button>
              </div>
            </div>
          </>
        )}

        {/* PORTFOLIO TEMPLATES MODAL (shared from dashboard) */}
        {showTemplatesModal && (
          <>
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

              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={() => setAssetType('stocks')}
                  disabled={portfolioType === 'crypto'}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: assetType === 'stocks' ? '#22c55e' : '#21262d',
                    color: assetType === 'stocks' ? '#000' : '#8b949e',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: portfolioType === 'crypto' ? 'not-allowed' : 'pointer',
                    opacity: portfolioType === 'crypto' ? 0.5 : 1
                  }}
                >
                  Stocks
                </button>
                <button
                  onClick={() => setAssetType('crypto')}
                  disabled={portfolioType === 'stocks'}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: assetType === 'crypto' ? '#f59e0b' : '#21262d',
                    color: assetType === 'crypto' ? '#000' : '#8b949e',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: portfolioType === 'stocks' ? 'not-allowed' : 'pointer',
                    opacity: portfolioType === 'stocks' ? 0.5 : 1
                  }}
                >
                  Crypto
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
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
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '24px' }}>{template.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{template.name}</div>
                            <div style={{ fontSize: '12px', color: '#8b949e' }}>{template.description}</div>
                            <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '4px' }}>{template.assets.join(', ')}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>

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
                    </div>
                  ) : (
                    portfolioTemplates
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
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff' }}>{template.name}</div>
                          <div style={{ fontSize: '11px', color: '#6e7681', marginTop: '2px' }}>{template.assets.join(', ')}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // JOIN GAME SCREEN - Simplified code entry, redirects to builder
  if (screen === 'join') {
    return (
      <div style={containerStyle}>
        <DesktopBackground isDesktop={isDesktop} />

        <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* HEADER */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: '#0d1117',
            borderBottom: '1px solid #21262d',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}>
            <button
              onClick={() => { setJoinCode(''); setBuilderMode('create'); setScreen('dashboard'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <h1 style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
              Join Battle
            </h1>

            <div style={{ width: '60px' }}></div>
          </div>

          {/* MAIN CONTENT */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            {/* Challenge Code Card */}
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '16px',
              padding: '32px',
              width: '100%',
              maxWidth: '400px',
              textAlign: 'center'
            }}>
              {/* Icon */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>

              <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
                Enter Challenge Code
              </h2>
              <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '24px' }}>
                Get the 6-character code from your opponent
              </p>

              {/* Code Input */}
              <input
                type="text"
                placeholder="XXXXXX"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  fontSize: '28px',
                  fontWeight: '700',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  border: `2px solid ${joinCode.length === 6 ? '#22c55e' : joinCode ? '#06b6d4' : '#21262d'}`,
                  borderRadius: '12px',
                  outline: 'none',
                  textTransform: 'uppercase',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff',
                  marginBottom: '24px'
                }}
              />

              {/* Continue Button */}
              <button
                onClick={() => {
                  if (joinCode.length === 6) {
                    setScreen('builder');
                  }
                }}
                disabled={joinCode.length !== 6}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  fontSize: '16px',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: joinCode.length === 6 ? 'pointer' : 'not-allowed',
                  background: joinCode.length === 6
                    ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                    : '#21262d',
                  color: joinCode.length === 6 ? '#ffffff' : '#6e7681',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: joinCode.length === 6 ? '0 4px 12px rgba(6, 182, 212, 0.3)' : 'none'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {joinCode.length === 6 ? 'Continue to Portfolio Builder' : `Enter ${6 - joinCode.length} more character${6 - joinCode.length !== 1 ? 's' : ''}`}
              </button>
            </div>

            {/* Rules reminder */}
            <div style={{
              marginTop: '24px',
              padding: '16px 20px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span style={{ color: '#a855f7', fontSize: '13px', fontWeight: '600' }}>Quick Reminder</span>
              </div>
              <p style={{ color: '#8b949e', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                After entering the code, you'll build your portfolio with 6-12 stocks + 0-2 shorts + 1 crypto. The battle starts when both players are ready!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TRAINING MODE SCREEN - Now redirects to builder, keeping for backwards compatibility
  if (screen === 'training') {
    // Redirect to builder with training mode
    setBuilderMode('training');
    setScreen('builder');
    return null;
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

            {/* Draft Advisor Panel */}
            <div style={{ marginTop: '16px', maxWidth: '400px' }}>
              <DraftAdvisor
                myPicks={myPlayer?.picks || []}
                availableStocks={availableAssets}
                availableSteady={roomDraft?.availableAssets?.steady || []}
                availableRisky={roomDraft?.availableAssets?.risky || []}
                availableDefensive={roomDraft?.availableAssets?.defensive || []}
                categoryRequirements={{
                  steadyPicked: myPlayer?.categories?.steady || 0,
                  steadyRequired: 3,
                  riskyPicked: myPlayer?.categories?.risky || 0,
                  riskyRequired: 3,
                  defensivePicked: myPlayer?.categories?.defensive || 0,
                  defensiveRequired: 3
                }}
                draftPosition={roomDraft?.players?.findIndex(p => p.odUserId === currentUserId) + 1}
                round={currentRound}
                compareStocks={[]}
                colors={colors}
                notes={userNotes.map(n => ({ header: n.header || n.symbol, content: n.content || n.note }))}
              />
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
      const [repairStatus, setRepairStatus] = useState(null); // 'repairing', 'success', 'error'

      const currentUserId = user?.odUserId || user?.username;
      const battleType = currentDraft?.type || 'stocks';

      // Check if prices need repair (all $100)
      const needsPriceRepair = currentDraft?.lockedPrices &&
        Object.values(currentDraft.lockedPrices).length > 0 &&
        Object.values(currentDraft.lockedPrices).every(p => p === 100);

      // FORCE REPAIR: Manual button to fix locked prices
      const forceRepairPrices = async () => {
        if (!currentDraft) {
          console.log('[ForceRepair] No current draft to repair');
          return;
        }

        setRepairStatus('repairing');
        console.log('[ForceRepair] Starting forced price repair for:', currentDraft.code || currentDraft.id);
        console.log('[ForceRepair] Current locked prices:', currentDraft.lockedPrices);

        try {
          const stockAPIModule = await import('./services/eodhdAPI');
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('./firebase/config');

          // Collect all symbols from all players
          const allSymbols = new Set();
          currentDraft.players?.forEach(player => {
            player.picks?.forEach(symbol => allSymbols.add(symbol));
          });
          const symbolList = Array.from(allSymbols);
          console.log('[ForceRepair] Assets to fix:', symbolList);

          // Fetch real prices using batch API
          let newLockedPrices = {};

          if (battleType === 'crypto') {
            console.log('[ForceRepair] Fetching crypto prices...');
            const priceData = await stockAPIModule.getAllCryptoPrices(symbolList);
            console.log('[ForceRepair] Price data received:', priceData);

            for (const symbol of symbolList) {
              const coinGeckoId = stockAPIModule.symbolToCoinGeckoId(symbol);
              const data = priceData[coinGeckoId];

              if (data?.price && data.price > 0) {
                newLockedPrices[symbol] = data.price;
                console.log(`[ForceRepair] ${symbol} (${coinGeckoId}): $${data.price}`);
              } else {
                // Use fallback
                const fallback = stockAPIModule.FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
                newLockedPrices[symbol] = fallback;
                console.log(`[ForceRepair] ${symbol} (${coinGeckoId}): $${fallback} (fallback)`);
              }
            }
          } else {
            console.log('[ForceRepair] Fetching stock prices...');
            const priceData = await stockAPIModule.getAllStockPrices(symbolList);

            for (const symbol of symbolList) {
              const data = priceData[symbol.toUpperCase()];
              newLockedPrices[symbol] = data?.price || stockAPIModule.FALLBACK_STOCK_PRICES[symbol] || 100;
            }
          }

          console.log('[ForceRepair] New locked prices:', newLockedPrices);

          // Direct Firebase update
          if (currentDraft.id) {
            console.log('[ForceRepair] Updating Firebase document:', currentDraft.id);
            const draftRef = doc(db, 'drafts', currentDraft.id);
            await updateDoc(draftRef, {
              lockedPrices: newLockedPrices,
              lockedPricesRepairedAt: serverTimestamp(),
              pricesRepaired: true
            });
            console.log('[ForceRepair] ✅ Firebase updated successfully!');
          }

          // Update local state
          const repairedDraft = {
            ...currentDraft,
            lockedPrices: newLockedPrices,
            pricesRepaired: true
          };
          setCurrentDraft(repairedDraft);

          setRepairStatus('success');
          console.log('[ForceRepair] ✅ Repair complete! Prices are now correct.');

          // Auto-dismiss success message after 3 seconds
          setTimeout(() => setRepairStatus(null), 3000);

        } catch (error) {
          console.error('[ForceRepair] Failed:', error);
          setRepairStatus('error');
          setTimeout(() => setRepairStatus(null), 5000);
        }
      };

      // REPAIR: Fix battles with bad locked prices ($100 for everything)
      useEffect(() => {
        const repairLockedPrices = async () => {
          if (!currentDraft?.lockedPrices || !currentDraft?.players) return;

          // Check if locked prices look wrong (all exactly $100)
          const prices = Object.values(currentDraft.lockedPrices);
          const allSamePrice = prices.length > 0 && prices.every(p => p === 100);

          if (!allSamePrice) {
            console.log('[DraftBattle] Locked prices look valid, skipping repair');
            return;
          }

          console.log('[DraftBattle] ⚠️ Detected bad locked prices (all $100), attempting repair...');

          try {
            const stockAPIModule = await import('./services/eodhdAPI');
            const draftServiceModule = await import('./services/draftService');

            // Collect all symbols
            const allSymbols = new Set();
            currentDraft.players.forEach(player => {
              (player.picks || []).forEach(symbol => allSymbols.add(symbol));
            });
            const symbolList = Array.from(allSymbols);

            // Fetch real prices
            let newLockedPrices = {};

            if (battleType === 'crypto') {
              const priceData = await stockAPIModule.getAllCryptoPrices(symbolList);

              for (const symbol of symbolList) {
                const coinGeckoId = stockAPIModule.symbolToCoinGeckoId(symbol);
                const data = priceData[coinGeckoId];
                newLockedPrices[symbol] = data?.price ||
                  stockAPIModule.FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
              }
            } else {
              const priceData = await stockAPIModule.getAllStockPrices(symbolList);

              for (const symbol of symbolList) {
                const data = priceData[symbol.toUpperCase()];
                newLockedPrices[symbol] = data?.price ||
                  stockAPIModule.FALLBACK_STOCK_PRICES[symbol] || 100;
              }
            }

            console.log('[DraftBattle] Repaired locked prices:', newLockedPrices);

            // Update the local draft state
            const repairedDraft = {
              ...currentDraft,
              lockedPrices: newLockedPrices,
              lockedPricesRepaired: true
            };
            setCurrentDraft(repairedDraft);

            // Try to persist the fix to Firebase (best effort)
            try {
              if (draftServiceModule.storeDraftLockedPrices && currentDraft.id) {
                await draftServiceModule.storeDraftLockedPrices(currentDraft.id);
                console.log('[DraftBattle] ✅ Repaired prices saved to Firebase');
              }
            } catch (saveError) {
              console.warn('[DraftBattle] Could not save repaired prices to Firebase:', saveError);
            }
          } catch (error) {
            console.error('[DraftBattle] Failed to repair locked prices:', error);
          }
        };

        repairLockedPrices();
      }, [currentDraft?.id]); // Only run when draft changes

      // Calculate standings from draft data - BATCH FETCHING VERSION
      useEffect(() => {
        const calculateStandings = async () => {
          if (!currentDraft?.players) {
            setLoading(false);
            return;
          }

          setLoading(true);

          try {
            const stockAPIModule = await import('./services/eodhdAPI');

            // STEP 1: Collect ALL unique symbols from ALL players (ONE batch call)
            const allSymbols = new Set();
            currentDraft.players.forEach(player => {
              (player.picks || []).forEach(symbol => {
                // For crypto, we need lowercase IDs (or symbols that will be converted)
                allSymbols.add(battleType === 'crypto' ? symbol.toLowerCase() : symbol.toUpperCase());
              });
            });

            const symbolList = Array.from(allSymbols);
            console.log(`[DraftBattle] Fetching ${symbolList.length} unique assets in 1 batch call`);

            // STEP 2: Clear cache to ensure we get FRESH prices (not cached from when battle started)
            if (stockAPIModule.clearCache) {
              stockAPIModule.clearCache();
              console.log('[DraftBattle] Cache cleared to fetch fresh prices');
            }

            // Batch fetch ALL prices at once (1 API call instead of 36!)
            // getAllCryptoPrices now handles symbol→CoinGecko ID conversion automatically
            let allPrices = {};
            if (battleType === 'crypto') {
              allPrices = await stockAPIModule.getAllCryptoPrices(symbolList);
            } else {
              allPrices = await stockAPIModule.getAllStockPrices(symbolList);
            }

            // DEBUG: Log what we received from API and what's in lockedPrices
            console.log('[DraftBattle] Current prices received:', allPrices);
            console.log('[DraftBattle] Locked prices from draft:', currentDraft.lockedPrices);

            // STEP 3: Calculate each player's performance using cached prices
            const playerPerformances = currentDraft.players.map((player) => {
              let totalGain = 0;
              const portfolioWithGains = [];

              for (const symbol of player.picks || []) {
                // Normalize symbol for lookup
                // For crypto, convert symbol to CoinGecko ID (BTC → bitcoin)
                let lookupKey;
                if (battleType === 'crypto') {
                  lookupKey = stockAPIModule.symbolToCoinGeckoId
                    ? stockAPIModule.symbolToCoinGeckoId(symbol)
                    : symbol.toLowerCase();
                } else {
                  lookupKey = symbol.toUpperCase();
                }

                // Get current price from batch result
                const priceData = allPrices[lookupKey];
                const currentPrice = priceData?.price || 0;

                // Get locked price (from draft completion)
                const lockedPrice = Number(currentDraft.lockedPrices?.[symbol] ||
                                   currentDraft.lockedPrices?.[lookupKey] ||
                                   currentPrice) || 0;

                // DEBUG: Log price comparison for each asset
                console.log(`[DraftBattle] ${symbol}: locked=$${(Number(lockedPrice) || 0).toFixed(4)}, current=$${(Number(currentPrice) || 0).toFixed(4)}, isFallback=${priceData?.isFallback || false}`);

                // Calculate gain with sanity checks
                let gain = 0;
                if (lockedPrice > 0 && currentPrice > 0) {
                  gain = ((currentPrice - lockedPrice) / lockedPrice) * 100;

                  // Sanity check - gains over 500% or under -90% are likely data errors
                  if (gain > 500 || gain < -90) {
                    console.warn(`[DraftBattle] Suspicious gain for ${symbol}: ${(Number(gain) || 0).toFixed(2)}% (locked: $${lockedPrice}, current: $${currentPrice})`);
                    gain = 0; // Reset to 0 for display
                  }
                }

                portfolioWithGains.push({
                  symbol,
                  gain: parseFloat(gain.toFixed(2)),
                  lockedPrice,
                  currentPrice
                });

                // Equal weight (11.1% each for 9 assets)
                totalGain += gain / 9;
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
            });

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
            console.error('[DraftBattle] Error calculating standings:', error);
          }

          setLoading(false);
        };

        calculateStandings();

        // Refresh every 60 seconds (was 30s - EODHD has 100k calls/day limit)
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

            {/* Price Repair Warning Banner - Shows when all prices are $100 */}
            {needsPriceRepair && (
              <div style={{
                background: '#7f1d1d',
                borderBottom: '2px solid #ef4444',
                padding: '12px 16px',
                textAlign: 'center'
              }}>
                <div style={{
                  color: '#fca5a5',
                  fontSize: '13px',
                  marginBottom: '8px'
                }}>
                  ⚠️ Locked prices are incorrect (all $100). Click below to repair.
                </div>
                <button
                  onClick={forceRepairPrices}
                  disabled={repairStatus === 'repairing'}
                  style={{
                    padding: '8px 20px',
                    background: repairStatus === 'repairing' ? '#6b7280' :
                               repairStatus === 'success' ? '#10b981' :
                               repairStatus === 'error' ? '#ef4444' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    cursor: repairStatus === 'repairing' ? 'wait' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {repairStatus === 'repairing' ? '⏳ Repairing...' :
                   repairStatus === 'success' ? '✅ Prices Fixed!' :
                   repairStatus === 'error' ? '❌ Failed - Try Again' :
                   '🔧 Repair Prices Now'}
                </button>
              </div>
            )}

            {/* Success message when repair is done but prices still show repair button */}
            {repairStatus === 'success' && !needsPriceRepair && (
              <div style={{
                background: '#064e3b',
                padding: '12px 16px',
                textAlign: 'center',
                color: '#6ee7b7',
                fontSize: '14px'
              }}>
                ✅ Prices repaired successfully! Gains should now be accurate.
              </div>
            )}

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
                              color: (Number(player.totalGain) || 0) >= 0 ? '#10b981' : '#ef4444',
                              fontWeight: 'bold',
                              fontSize: '18px'
                            }}>
                              {(Number(player.totalGain) || 0) >= 0 ? '+' : ''}{(Number(player.totalGain) || 0).toFixed(2)}%
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
                                    color: (Number(asset.gain) || 0) >= 0 ? '#10b981' : '#ef4444',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                  }}>
                                    {(Number(asset.gain) || 0) >= 0 ? '+' : ''}{(Number(asset.gain) || 0).toFixed(2)}%
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
                                  {player.bestAsset?.symbol} {(Number(player.bestAsset?.gain) || 0) >= 0 ? '+' : ''}{(Number(player.bestAsset?.gain) || 0).toFixed(2)}%
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
                                  {player.worstAsset?.symbol} {(Number(player.worstAsset?.gain) || 0) >= 0 ? '+' : ''}{(Number(player.worstAsset?.gain) || 0).toFixed(2)}%
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
                            +{(Number(assetComparison.myBest?.gain) || 0).toFixed(2)}%
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
                            color: (Number(assetComparison.opponentBest?.gain) || 0) >= 0 ? '#10b981' : '#ef4444',
                            fontWeight: 'bold',
                            fontSize: '14px'
                          }}>
                            {(Number(assetComparison.opponentBest?.gain) || 0) >= 0 ? '+' : ''}
                            {(Number(assetComparison.opponentBest?.gain) || 0).toFixed(2)}%
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
        {/* Animated Desktop Background */}
        <DesktopBackground isDesktop={isDesktop} />

        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1
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

          {/* ⭐ ACTIVE RISK CHALLENGE INDICATOR */}
          <div style={{ padding: '16px 16px 0 16px' }}>
            <ActiveRiskChallengeIndicator />
          </div>

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
        {/* Animated Desktop Background */}
        <DesktopBackground isDesktop={isDesktop} />

        <div style={{
          minHeight: '100vh',
          paddingBottom: '32px',
          background: colors.background,
          position: 'relative',
          zIndex: 1
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
                      onRematch={sendRematchRequest}
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
        {/* Animated Desktop Background */}
        <DesktopBackground isDesktop={isDesktop} />

        <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', position: 'relative', zIndex: 1 }}>

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
  );
}