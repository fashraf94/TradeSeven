import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, TrendingUp, Shield, Zap, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { generateRecommendations, buildPortfolioFromRecommendations } from '../../services/baggerBombRecommendationEngine';
import { SECTORS } from '../../constants/sectors';

const GamePlanResultScreen = ({ onBack, onComplete, gamePlanData }) => {
  const { riskStyle, selectedSectors, mustHavePicks } = gamePlanData;

  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState('breakout');

  useEffect(() => {
    loadRecommendations();
  }, [riskStyle, selectedSectors]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const recs = await generateRecommendations({
        riskStyle,
        selectedSectors,
        mustHavePicks
      });

      setRecommendations(recs);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to generate recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = () => {
    if (!recommendations) return;

    const portfolio = buildPortfolioFromRecommendations(recommendations);
    onComplete?.(portfolio);
  };

  const getSectorNames = () => {
    return selectedSectors.map(id => SECTORS[id]?.name || id).join(', ');
  };

  const getRiskStyleInfo = () => {
    const styles = {
      aggressive: {
        label: 'Aggressive',
        emoji: '🚀',
        color: '#ef4444',
        description: 'High volatility, momentum-focused'
      },
      balanced: {
        label: 'Balanced',
        emoji: '⚖️',
        color: '#f59e0b',
        description: 'Growth with risk management'
      },
      conservative: {
        label: 'Conservative',
        emoji: '🛡️',
        color: '#22c55e',
        description: 'Lower risk, stable performers'
      }
    };
    return styles[riskStyle] || styles.balanced;
  };

  const styleInfo = getRiskStyleInfo();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          border: '4px solid #21262d',
          borderTopColor: '#00d9ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '24px'
        }} />
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Generating Your Game Plan</h2>
        <p style={{ color: '#8b949e', textAlign: 'center', maxWidth: '300px' }}>
          Analyzing {selectedSectors.length} sectors with {styleInfo.label.toLowerCase()} strategy...
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        padding: '20px'
      }}>
        <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h2>
        <p style={{ color: '#8b949e', textAlign: 'center', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={loadRecommendations}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            backgroundColor: '#00d9ff',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={18} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', color: '#ffffff' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#00d9ff',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div style={{ fontSize: '14px', color: '#8b949e' }}>Your Game Plan</div>
        <button
          onClick={loadRecommendations}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', paddingBottom: '120px' }}>
        {/* Strategy Summary Card */}
        <div style={{
          padding: '20px',
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '20px',
          border: `1px solid ${styleInfo.color}40`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: `${styleInfo.color}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {styleInfo.emoji}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                {styleInfo.label} Game Plan
              </h2>
              <p style={{ color: '#8b949e', fontSize: '14px' }}>
                {getSectorNames()}
              </p>
            </div>
          </div>

          {/* Strategy Text */}
          <div style={{
            padding: '16px',
            backgroundColor: '#0d1117',
            borderRadius: '12px',
            borderLeft: `3px solid ${styleInfo.color}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={16} color="#f59e0b" />
              <span style={{ fontWeight: '600', color: '#f59e0b', fontSize: '13px' }}>
                AI Strategy Summary
              </span>
            </div>
            <p style={{ color: '#c9d1d9', fontSize: '14px', lineHeight: '1.6' }}>
              {recommendations?.strategyText || 'Analyzing your selections...'}
            </p>
          </div>

          {/* Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '16px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#00d9ff' }}>
                {recommendations?.breakoutCandidates?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Breakout Picks</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                {recommendations?.safePlays?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Safe Plays</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                {recommendations?.totalStocksAnalyzed || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>Analyzed</div>
            </div>
          </div>
        </div>

        {/* Breakout Candidates Section */}
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'breakout' ? null : 'breakout')}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 217, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={20} color="#00d9ff" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>Breakout Candidates</div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  High probability BaggerBomb hits
                </div>
              </div>
            </div>
            {expandedSection === 'breakout' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSection === 'breakout' && recommendations?.breakoutCandidates && (
            <div style={{ padding: '0 20px 20px' }}>
              {recommendations.breakoutCandidates.map((stock, index) => (
                <StockRecommendationCard
                  key={stock.symbol}
                  stock={stock}
                  rank={index + 1}
                  type="breakout"
                />
              ))}
              {recommendations.breakoutCandidates.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
                  No breakout candidates found matching criteria
                </div>
              )}
            </div>
          )}
        </div>

        {/* Safe Plays Section */}
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'safe' ? null : 'safe')}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Shield size={20} color="#22c55e" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>Safe Plays</div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  Lower bust risk, steady performers
                </div>
              </div>
            </div>
            {expandedSection === 'safe' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSection === 'safe' && recommendations?.safePlays && (
            <div style={{ padding: '0 20px 20px' }}>
              {recommendations.safePlays.map((stock, index) => (
                <StockRecommendationCard
                  key={stock.symbol}
                  stock={stock}
                  rank={index + 1}
                  type="safe"
                />
              ))}
              {recommendations.safePlays.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e' }}>
                  No safe plays found matching criteria
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crypto Section */}
        <div style={{
          backgroundColor: '#161b22',
          borderRadius: '16px',
          marginBottom: '16px',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setExpandedSection(expandedSection === 'crypto' ? null : 'crypto')}
            style={{
              width: '100%',
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={20} color="#f59e0b" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: '600' }}>Crypto Pick</div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}>
                  10% allocation recommendation
                </div>
              </div>
            </div>
            {expandedSection === 'crypto' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSection === 'crypto' && recommendations?.cryptoRecommendation && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: '#0d1117',
                borderRadius: '12px'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '18px' }}>
                    {recommendations.cryptoRecommendation.symbol}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '14px' }}>
                    {recommendations.cryptoRecommendation.name}
                  </div>
                </div>
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: recommendations.cryptoRecommendation.volatility === 'high'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                  borderRadius: '6px',
                  color: recommendations.cryptoRecommendation.volatility === 'high' ? '#ef4444' : '#22c55e',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {recommendations.cryptoRecommendation.volatility === 'high' ? 'High Volatility' : 'Medium Volatility'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        backgroundColor: '#161b22',
        borderTop: '1px solid #21262d'
      }}>
        <button
          onClick={handleCreatePortfolio}
          disabled={!recommendations}
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: recommendations ? '#00d9ff' : '#21262d',
            border: 'none',
            borderRadius: '12px',
            color: recommendations ? '#000' : '#8b949e',
            fontWeight: '600',
            fontSize: '16px',
            cursor: recommendations ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={18} />
          Create Portfolio from Game Plan
        </button>
        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#8b949e',
          marginTop: '8px'
        }}>
          9 stocks + 1 crypto = $1M portfolio
        </p>
      </div>
    </div>
  );
};

// Stock Recommendation Card Component
const StockRecommendationCard = ({ stock, rank, type }) => {
  const isBreakout = type === 'breakout';

  const getScoreColor = (score) => {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#8b949e';
  };

  const getRiskColor = (risk) => {
    if (risk <= 30) return '#22c55e';
    if (risk <= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#0d1117',
      borderRadius: '12px',
      marginBottom: '12px',
      border: '1px solid #21262d'
    }}>
      {/* Header Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: isBreakout ? 'rgba(0, 217, 255, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '700',
            color: isBreakout ? '#00d9ff' : '#22c55e'
          }}>
            #{rank}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '16px' }}>{stock.symbol}</div>
            <div style={{ color: '#8b949e', fontSize: '12px' }}>
              {stock.name || stock.symbol}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: '600' }}>
            ${stock.price?.toFixed(2) || '—'}
          </div>
          <div style={{
            fontSize: '12px',
            color: (stock.change1W || 0) >= 0 ? '#22c55e' : '#ef4444'
          }}>
            {(stock.change1W || 0) >= 0 ? '+' : ''}{(stock.change1W || 0).toFixed(1)}% (1W)
          </div>
        </div>
      </div>

      {/* Scores Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px'
      }}>
        <div style={{
          padding: '10px',
          backgroundColor: '#161b22',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: getScoreColor(stock.breakoutScore || 0)
          }}>
            {stock.breakoutScore || 0}
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e' }}>Breakout</div>
        </div>
        <div style={{
          padding: '10px',
          backgroundColor: '#161b22',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: getRiskColor(stock.bustRisk || 0)
          }}>
            {stock.bustRisk || 0}
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e' }}>Bust Risk</div>
        </div>
        <div style={{
          padding: '10px',
          backgroundColor: '#161b22',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#00d9ff'
          }}>
            {stock.threshold?.toFixed(1) || '—'}%
          </div>
          <div style={{ fontSize: '10px', color: '#8b949e' }}>Threshold</div>
        </div>
      </div>

      {/* Interpretation */}
      {stock.breakoutInterpretation && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          backgroundColor: 'rgba(0, 217, 255, 0.05)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#8b949e'
        }}>
          {stock.breakoutInterpretation}
        </div>
      )}
    </div>
  );
};

export default GamePlanResultScreen;
