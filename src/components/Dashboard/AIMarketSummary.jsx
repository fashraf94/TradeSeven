// /src/components/Dashboard/AIMarketSummary.jsx

import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

/**
 * AIMarketSummary - AI-powered market summary
 * Generates market insights using Claude AI
 *
 * @param {Object} props
 * @param {Object} props.marketData - Market overview data
 * @param {Array} props.news - Recent news items
 * @param {Object} props.moversData - Top gainers and losers
 * @param {Object} props.colors - Design tokens
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
        const response = await fetchWithAuth('/api/ai-advisor', {
          method: 'POST',
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

      {/* Animations consolidated in index.css: spin, pulse */}
    </div>
  );
};

export default AIMarketSummary;
