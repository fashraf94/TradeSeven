// /src/components/Research/LatestEarningsReport.jsx

import React, { useState, useEffect } from 'react';
import { fetchLatestEarnings } from '../../services/eodhdAPI';
import { fetchWithAuth } from '../../utils/fetchWithAuth';

/**
 * LatestEarningsReport - Displays latest earnings data with AI insights
 * Fetches real earnings data from EODHD API and provides AI analysis
 *
 * @param {Object} props
 * @param {string} props.symbol - Stock symbol
 * @param {Object} props.colors - Design tokens
 */
const LatestEarningsReport = ({ symbol, colors }) => {
  const [earnings, setEarnings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsSource, setInsightsSource] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [insightsStaleWarning, setInsightsStaleWarning] = useState(null);

  const INSIGHTS_CACHE_KEY = `earnings_insights_${symbol}`;
  const INSIGHTS_CACHE_DURATION = 24 * 60 * 60 * 1000;

  useEffect(() => {
    const loadEarnings = async () => {
      if (!symbol) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setInsights(null);
      setInsightsSource(null);
      setInsightsError(null);
      setInsightsStaleWarning(null);

      try {
        console.log(`[LatestEarnings] Fetching earnings for ${symbol}...`);
        const data = await fetchLatestEarnings(symbol);

        if (data) {
          console.log(`[LatestEarnings] Got data for ${symbol}:`, data);
          setEarnings(data);

          try {
            const cached = localStorage.getItem(INSIGHTS_CACHE_KEY);
            if (cached) {
              const { data: cachedInsights, source, timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < INSIGHTS_CACHE_DURATION && cachedInsights) {
                console.log(`[EarningsInsights] Using cached insights for ${symbol}`);
                setInsights(cachedInsights);
                setInsightsSource(source || 'eodhd');
              }
            }
          } catch (e) {
            console.warn('[EarningsInsights] Cache read error:', e);
          }
        } else {
          setError('No earnings data available');
        }
      } catch (err) {
        console.error(`[LatestEarnings] Error for ${symbol}:`, err);
        setError('Failed to load earnings');
      } finally {
        setIsLoading(false);
      }
    };

    loadEarnings();
  }, [symbol, INSIGHTS_CACHE_KEY, INSIGHTS_CACHE_DURATION]);

  const handleGenerateInsights = async () => {
    if (!earnings || !symbol) return;

    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsStaleWarning(null);
    console.log(`[EarningsInsights] Searching web for ${symbol} earnings...`);

    try {
      const webSearchResponse = await fetchWithAuth('/api/ai-advisor', {
        method: 'POST',
        body: JSON.stringify({
          type: 'earnings-web-search',
          symbol: symbol,
          companyName: earnings?.companyName || symbol
        })
      });

      if (!webSearchResponse.ok) {
        throw new Error('API request failed');
      }

      const webData = await webSearchResponse.json();

      if (webData.success && webData.message && !webData.message.includes('NO_RECENT_DATA')) {
        const generatedInsights = webData.message;
        setInsights(generatedInsights);
        setInsightsSource('web-search');

        if (webData.mayBeStale || webData.warning) {
          setInsightsStaleWarning(webData.warning || 'Data may not be from the most recent quarter');
        } else {
          try {
            localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify({
              data: generatedInsights,
              source: 'web-search',
              timestamp: Date.now()
            }));
          } catch (e) {
            console.warn('[EarningsInsights] Cache write error:', e);
          }
        }
      } else {
        const errorMsg = webData.error || 'No recent earnings coverage found for this stock';
        setInsightsError(errorMsg);
      }
    } catch (err) {
      console.error('[EarningsInsights] Error generating insights:', err);
      setInsightsError('Failed to generate insights. Please try again.');
    } finally {
      setInsightsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '16px',
        padding: '20px',
        marginTop: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 }}>
            LATEST EARNINGS
          </h3>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '20px',
          background: '#0d1117',
          borderRadius: '12px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #8b5cf6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ color: '#8b949e', fontSize: '14px' }}>
            Loading earnings data for {symbol}...
          </span>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !earnings) {
    return (
      <div style={{
        background: '#161b22',
        border: '1px solid #21262d',
        borderRadius: '16px',
        padding: '20px',
        marginTop: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 }}>
            LATEST EARNINGS
          </h3>
        </div>
        <div style={{
          padding: '20px',
          background: '#0d1117',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <span style={{ color: '#8b949e', fontSize: '14px' }}>
            Earnings data not available for {symbol}
          </span>
        </div>
      </div>
    );
  }

  const epsBeat = earnings.epsBeat;
  const revenueBeat = earnings.revenueBeat;
  const yoyPositive = earnings.yoyGrowth && earnings.yoyGrowth.startsWith('+');

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '16px',
      padding: '20px',
      marginTop: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <line x1="10" y1="9" x2="8" y2="9"/>
            </svg>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 }}>
            LATEST EARNINGS
          </h3>
        </div>
        <div style={{
          background: '#8b5cf620',
          border: '1px solid #8b5cf640',
          borderRadius: '8px',
          padding: '6px 12px'
        }}>
          <span style={{ color: '#a78bfa', fontSize: '11px', fontWeight: '600' }}>
            {earnings.reportDate}
          </span>
        </div>
      </div>

      {/* Quarter Badge */}
      <div style={{
        display: 'inline-block',
        background: '#21262d',
        borderRadius: '6px',
        padding: '4px 10px',
        marginBottom: '16px'
      }}>
        <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600' }}>
          {earnings.quarter}
        </span>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {/* EPS Card */}
        <div style={{
          flex: 1,
          background: '#0d1117',
          borderRadius: '10px',
          padding: '12px',
          borderLeft: `3px solid ${epsBeat === true ? '#22c55e' : epsBeat === false ? '#ef4444' : '#8b949e'}`
        }}>
          <div style={{
            color: '#8b949e',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            EPS
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700' }}>
              {earnings.epsActual}
            </span>
            {epsBeat !== null && (
              <span style={{
                color: epsBeat ? '#22c55e' : '#ef4444',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {epsBeat ? '✓ BEAT' : '✗ MISS'}
              </span>
            )}
          </div>
          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
            Est: {earnings.epsEstimate}
          </div>
        </div>

        {/* Revenue Card */}
        <div style={{
          flex: 1,
          background: '#0d1117',
          borderRadius: '10px',
          padding: '12px',
          borderLeft: `3px solid ${revenueBeat === true ? '#22c55e' : revenueBeat === false ? '#ef4444' : '#8b949e'}`
        }}>
          <div style={{
            color: '#8b949e',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Revenue
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700' }}>
              {earnings.revenueActual || 'N/A'}
            </span>
            {revenueBeat !== null && (
              <span style={{
                color: revenueBeat ? '#22c55e' : '#ef4444',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {revenueBeat ? '✓ BEAT' : '✗ MISS'}
              </span>
            )}
          </div>
          {earnings.revenueEstimate && (
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
              Est: {earnings.revenueEstimate}
            </div>
          )}
        </div>

        {/* YoY Growth Card */}
        <div style={{
          flex: 1,
          background: '#0d1117',
          borderRadius: '10px',
          padding: '12px',
          borderLeft: `3px solid ${yoyPositive ? '#22c55e' : earnings.yoyGrowth !== 'N/A' ? '#ef4444' : '#8b949e'}`
        }}>
          <div style={{
            color: '#8b949e',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            YoY Growth
          </div>
          <div style={{
            color: yoyPositive ? '#22c55e' : earnings.yoyGrowth !== 'N/A' ? '#ef4444' : '#8b949e',
            fontSize: '18px',
            fontWeight: '700'
          }}>
            {earnings.yoyGrowth}
          </div>
          {earnings.previousYearEps && (
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
              vs {earnings.previousYearEps} prior
            </div>
          )}
        </div>
      </div>

      {/* Next Earnings Date */}
      {earnings.nextEarningsDate && earnings.nextEarningsDate !== 'TBD' && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px' }}>📅</span>
          <span style={{ color: '#fbbf24', fontSize: '12px', fontWeight: '600' }}>
            Next Earnings: {earnings.nextEarningsDate}
          </span>
        </div>
      )}

      {/* AI Earnings Call Insights */}
      <div style={{
        marginTop: '16px',
        background: '#1a2332',
        borderRadius: '12px',
        borderLeft: '3px solid #8b5cf6',
        padding: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <h4 style={{
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: '700',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            EARNINGS CALL INSIGHTS
          </h4>
          <span style={{
            background: 'rgba(139, 92, 246, 0.2)',
            color: '#a78bfa',
            fontSize: '9px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            AI-Powered
          </span>
        </div>

        {insightsLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px',
            background: 'rgba(139, 92, 246, 0.1)',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '18px',
              height: '18px',
              border: '2px solid #8b5cf6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ color: '#a78bfa', fontSize: '13px' }}>
              Analyzing earnings call... This may take a moment
            </span>
          </div>
        ) : insightsError ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <span style={{ color: '#f87171', fontSize: '13px' }}>
                {insightsError}
              </span>
            </div>
            <button
              onClick={handleGenerateInsights}
              style={{
                padding: '10px 20px',
                background: '#374151',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              🔄 Try Again
            </button>
          </div>
        ) : insights ? (
          <div>
            {insightsStaleWarning && (
              <div style={{
                padding: '8px 12px',
                marginBottom: '10px',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '14px' }}>⚠️</span>
                <span style={{ color: '#fbbf24', fontSize: '11px' }}>
                  Data may be from an older quarter. Click "Generate Insights" to refresh.
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {insights.split('\n').filter(line => line.trim()).map((point, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px',
                    background: '#0d1117',
                    borderRadius: '8px',
                    color: '#e6edf3',
                    fontSize: '12px',
                    lineHeight: '1.5'
                  }}
                >
                  {point.trim()}
                </div>
              ))}
            </div>
            <div style={{
              marginTop: '10px',
              fontSize: '10px',
              color: '#6b7280',
              textAlign: 'right'
            }}>
              🌐 Powered by AI Web Search
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleGenerateInsights}
              style={{
                width: '100%',
                padding: '16px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
            >
              <span>✨</span>
              Generate Earnings Insights
            </button>
            <p style={{
              fontSize: '11px',
              color: '#6b7280',
              marginTop: '10px',
              marginBottom: 0
            }}>
              AI analyzes recent earnings calls and news to extract key points
            </p>
          </div>
        )}
      </div>

      {/* Data source */}
      <div style={{
        marginTop: '12px',
        color: '#6e7681',
        fontSize: '10px',
        textAlign: 'right'
      }}>
        Data from EODHD • Updated {new Date(earnings.fetchedAt).toLocaleDateString()}
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LatestEarningsReport;
