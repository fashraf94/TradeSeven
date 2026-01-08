// /src/components/Dashboard/MarketBriefing.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { getMarketNews, getTopMoversWithNews } from '../../services/eodhdAPI';
import AIMarketSummary from './AIMarketSummary';
import WatchlistNews from './WatchlistNews';
import StocksInTheNews from './StocksInTheNews';
import EconomicNews from './EconomicNews';

// Safe number utility
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

/**
 * MarketBriefing - Main dashboard market overview screen
 * Shows AI summary, watchlist news, top movers, and economic news
 *
 * @param {Object} props
 * @param {Array} props.stocksData - Array of stock data
 * @param {Array} props.cryptoData - Array of crypto data
 * @param {Function} props.onContinue - Handler for "Build My Thesis" button
 * @param {Object} props.colors - Design tokens
 */
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
  const marketData = useMemo(() => {
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

      {/* AI Market Summary */}
      <AIMarketSummary
        marketData={marketData}
        news={marketNews}
        moversData={moversData}
        colors={c}
      />

      {/* Build My Thesis - Hero Button with Animations */}
      <div style={{
        position: 'relative',
        padding: '20px 0',
        marginBottom: '20px'
      }}>
        {/* Outer Glow Container */}
        <div style={{
          position: 'relative',
          borderRadius: '20px',
          padding: '3px',
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
          boxShadow: '0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(34, 197, 94, 0.2), 0 10px 40px rgba(0, 0, 0, 0.3)',
          animation: 'pulseGlow 2s ease-in-out infinite'
        }}>
          {/* Inner Button */}
          <button
            onClick={onContinue}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              padding: '24px 32px',
              background: 'linear-gradient(145deg, #1a2a1a 0%, #0d1117 50%, #1a2a1a 100%)',
              border: 'none',
              borderRadius: '17px',
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'transform 0.3s ease'
            }}
          >
            {/* Shimmer Effect */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.2), transparent)',
              animation: 'shimmerEffect 2.5s infinite'
            }} />

            {/* Floating Particles */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: '5px',
                    height: '5px',
                    background: '#22c55e',
                    borderRadius: '50%',
                    opacity: 0.4,
                    left: `${15 + i * 14}%`,
                    top: `${25 + (i % 3) * 20}%`,
                    animation: `floatParticle ${3 + i * 0.4}s ease-in-out infinite`,
                    animationDelay: `${i * 0.25}s`
                  }}
                />
              ))}
            </div>

            {/* Content */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Icon */}
              <div style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4)',
                animation: 'pulseIcon 2s ease-in-out infinite'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
              </div>

              {/* Title Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  textShadow: '0 0 20px rgba(34, 197, 94, 0.5)'
                }}>
                  BUILD MY THESIS
                </span>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  style={{ animation: 'bounceArrow 1.5s ease-in-out infinite' }}
                >
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>

              {/* Subtitle */}
              <span style={{
                color: '#22c55e',
                fontSize: '13px',
                fontWeight: '500',
                opacity: 0.9
              }}>
                Get AI-powered portfolio recommendations
              </span>

              {/* Feature Pills */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '6px',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                {['Guided Flow', 'Smart Picks', 'Risk Analysis'].map((feature) => (
                  <span
                    key={feature}
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '16px',
                      padding: '5px 12px',
                      color: '#4ade80',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </button>
        </div>

        {/* Bottom Reflection Glow */}
        <div style={{
          position: 'absolute',
          bottom: '5px',
          left: '10%',
          right: '10%',
          height: '20px',
          background: 'radial-gradient(ellipse, rgba(34, 197, 94, 0.3) 0%, transparent 70%)',
          filter: 'blur(8px)',
          pointerEvents: 'none'
        }} />

        {/* CSS Animations */}
        <style>{`
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(34, 197, 94, 0.2), 0 10px 40px rgba(0, 0, 0, 0.3); }
            50% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.6), 0 0 80px rgba(34, 197, 94, 0.3), 0 10px 40px rgba(0, 0, 0, 0.3); }
          }
          @keyframes shimmerEffect {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          @keyframes floatParticle {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
            50% { transform: translateY(-12px) scale(1.2); opacity: 0.6; }
          }
          @keyframes pulseIcon {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes bounceArrow {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(6px); }
          }
        `}</style>
      </div>

      {/* Your Watchlist - Personalized news for user's stock picks */}
      <WatchlistNews colors={c} />

      {/* Stocks in the News (replaces basic Top Movers) */}
      <StocksInTheNews
        moversData={moversData}
        isLoading={isLoadingMovers}
        colors={c}
      />

      {/* Economic News - Macro news filtered by economic keywords */}
      <EconomicNews
        news={marketNews}
        isLoading={isLoadingNews}
        colors={c}
      />
    </div>
  );
};

export default MarketBriefing;
