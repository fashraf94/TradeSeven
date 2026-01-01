// StockDetailModal - Detailed stock view with TD breakout thresholds and research data
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, TrendingUp, Rocket, Building2, DollarSign,
  Percent, BarChart3, Newspaper, ChevronLeft, X
} from 'lucide-react';

// Color scheme
const colors = {
  background: '#0a0a0f',
  cardBg: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.1)',
  primary: '#00d9ff',
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  purple: '#8b5cf6',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)'
};

// Get difficulty info from threshold value
const getDifficultyInfo = (thresholdValue) => {
  if (!thresholdValue) return { label: 'Unknown', color: colors.textMuted, description: 'Threshold data unavailable' };
  if (thresholdValue <= 2) return { label: 'Easy', color: colors.green, description: 'Lower threshold, more consistent TD scoring' };
  if (thresholdValue <= 4) return { label: 'Medium', color: colors.yellow, description: 'Balanced risk and reward' };
  return { label: 'Hard', color: colors.red, description: 'Higher threshold, but bigger bonus potential' };
};

// Mock fundamental data (in production, fetch from API)
const getMockFundamentals = (symbol) => {
  const defaults = {
    marketCap: '$500B',
    peRatio: '25x',
    revenueGrowth: '+15%',
    profitMargin: '20%',
    rating: 'Buy',
    strengths: ['Strong market position', 'Growing revenue', 'Solid fundamentals'],
    weaknesses: ['Valuation concerns', 'Market competition', 'Economic sensitivity'],
    low52w: 100,
    high52w: 200,
    beta: 1.2,
    avgVolume: '10M'
  };

  // Custom data for popular stocks
  const stockData = {
    'AAPL': { marketCap: '$3.0T', peRatio: '30x', revenueGrowth: '+8%', profitMargin: '25%', rating: 'Strong Buy', low52w: 164, high52w: 199 },
    'MSFT': { marketCap: '$2.9T', peRatio: '35x', revenueGrowth: '+15%', profitMargin: '36%', rating: 'Strong Buy', low52w: 309, high52w: 430 },
    'GOOGL': { marketCap: '$2.0T', peRatio: '25x', revenueGrowth: '+12%', profitMargin: '24%', rating: 'Buy', low52w: 120, high52w: 180 },
    'AMZN': { marketCap: '$1.9T', peRatio: '60x', revenueGrowth: '+11%', profitMargin: '7%', rating: 'Buy', low52w: 118, high52w: 201 },
    'NVDA': { marketCap: '$1.2T', peRatio: '65x', revenueGrowth: '+122%', profitMargin: '55%', rating: 'Strong Buy', low52w: 108, high52w: 505 },
    'TSLA': { marketCap: '$800B', peRatio: '70x', revenueGrowth: '+19%', profitMargin: '11%', rating: 'Hold', low52w: 138, high52w: 299 },
    'META': { marketCap: '$1.3T', peRatio: '28x', revenueGrowth: '+23%', profitMargin: '29%', rating: 'Buy', low52w: 274, high52w: 531 },
    'JPM': { marketCap: '$550B', peRatio: '11x', revenueGrowth: '+8%', profitMargin: '33%', rating: 'Buy', low52w: 135, high52w: 200 }
  };

  return { ...defaults, ...(stockData[symbol] || {}) };
};

const StockDetailModal = ({
  stock,
  price,
  priceChange,
  threshold,
  isSelected,
  onSelect,
  onClose,
  isCrypto = false
}) => {
  const [activeTab, setActiveTab] = useState('fundamental');

  if (!stock) return null;

  const difficulty = getDifficultyInfo(threshold?.threshold);
  const fundamentals = getMockFundamentals(stock.symbol);
  const ratingColor = fundamentals.rating?.includes('Strong') ? colors.green :
    fundamentals.rating === 'Buy' ? colors.primary :
      fundamentals.rating === 'Hold' ? colors.yellow : colors.red;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            backgroundColor: colors.background,
            borderRadius: '20px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`
          }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ChevronLeft size={18} />
              Back to List
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textMuted,
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Stock Hero Section */}
            <div style={{
              padding: '24px',
              margin: '16px',
              background: `linear-gradient(180deg, ${isCrypto ? 'rgba(245,158,11,0.1)' : 'rgba(0,217,255,0.1)'} 0%, transparent 100%)`,
              border: `1px solid ${isCrypto ? 'rgba(245,158,11,0.3)' : 'rgba(0,217,255,0.3)'}`,
              borderRadius: '16px',
              textAlign: 'center'
            }}>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '800',
                color: isCrypto ? colors.yellow : colors.textPrimary,
                margin: 0
              }}>
                {stock.symbol}
              </h1>
              <p style={{
                color: colors.textSecondary,
                margin: '4px 0 0',
                fontSize: '14px'
              }}>
                {stock.name}
              </p>
              <div style={{
                fontSize: '36px',
                fontWeight: '700',
                color: colors.textPrimary,
                margin: '16px 0 8px'
              }}>
                ${price?.toFixed(2) || '—'}
              </div>
              <div style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: priceChange >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                color: priceChange >= 0 ? colors.green : colors.red
              }}>
                {priceChange >= 0 ? '▲' : '▼'} {Math.abs(priceChange || 0)?.toFixed(2)}% today
              </div>
            </div>

            {/* TD Breakout Section */}
            <div style={{
              padding: '20px',
              margin: '0 16px 16px',
              backgroundColor: colors.cardBg,
              borderRadius: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                color: colors.textPrimary
              }}>
                <Target size={20} />
                <h2 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
                  TD BREAKOUT THRESHOLDS
                </h2>
              </div>

              {/* Difficulty Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '12px',
                border: `1px solid ${difficulty.color}`,
                backgroundColor: `${difficulty.color}20`,
                marginBottom: '16px'
              }}>
                <span style={{ fontWeight: '700', fontSize: '14px', color: difficulty.color }}>
                  {difficulty.label} TD
                </span>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                  {difficulty.description}
                </span>
              </div>

              {/* Threshold Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Breakout */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${colors.green}20`
                  }}>
                    <Target size={18} color={colors.green} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '12px', color: colors.textMuted }}>Breakout</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: colors.green }}>
                      {threshold?.threshold?.toFixed(1) || '—'}%
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary }}>+15 pts</span>
                </div>

                {/* Rally */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${colors.yellow}20`
                  }}>
                    <TrendingUp size={18} color={colors.yellow} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '12px', color: colors.textMuted }}>Rally</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: colors.yellow }}>
                      {threshold?.rallyThreshold?.toFixed(1) || '—'}%
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary }}>+30 pts</span>
                </div>

                {/* Moonshot */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${colors.purple}20`
                  }}>
                    <Rocket size={18} color={colors.purple} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '12px', color: colors.textMuted }}>Moonshot</span>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: colors.purple }}>
                      {threshold?.moonshotThreshold?.toFixed(1) || '—'}%
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: colors.textSecondary }}>+50 pts</span>
                </div>
              </div>

              <p style={{
                fontSize: '12px',
                color: colors.textMuted,
                marginTop: '16px',
                lineHeight: 1.5
              }}>
                If {stock.symbol} moves {threshold?.threshold?.toFixed(1) || '—'}% in a session, you score a Breakout bonus.
                Thresholds are based on {stock.symbol}'s recent volatility.
              </p>
            </div>

            {/* AI Analysis Section - Only for stocks */}
            {!isCrypto && (
              <div style={{
                padding: '20px',
                margin: '0 16px 16px',
                backgroundColor: colors.cardBg,
                borderRadius: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  color: colors.textPrimary
                }}>
                  <BarChart3 size={20} />
                  <h2 style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
                    AI ANALYSIS
                  </h2>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    onClick={() => setActiveTab('fundamental')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeTab === 'fundamental' ? colors.primary : 'rgba(255,255,255,0.05)',
                      color: activeTab === 'fundamental' ? '#000' : colors.textSecondary,
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Building2 size={16} />
                    Fundamental
                  </button>
                  <button
                    onClick={() => setActiveTab('technical')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: activeTab === 'technical' ? colors.primary : 'rgba(255,255,255,0.05)',
                      color: activeTab === 'technical' ? '#000' : colors.textSecondary,
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <TrendingUp size={16} />
                    Technical
                  </button>
                </div>

                {activeTab === 'fundamental' && (
                  <div>
                    {/* Rating */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}>
                      <span style={{ color: ratingColor, fontWeight: '600', fontSize: '14px' }}>
                        ● {fundamentals.rating}
                      </span>
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>
                        Sector: {stock.sector || 'Technology'}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(59,130,246,0.2)',
                          margin: '0 auto 8px'
                        }}>
                          <Building2 size={18} color="#3b82f6" />
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: colors.textPrimary }}>
                          {fundamentals.marketCap}
                        </div>
                        <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Market Cap
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(139,92,246,0.2)',
                          margin: '0 auto 8px'
                        }}>
                          <BarChart3 size={18} color="#8b5cf6" />
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: colors.textPrimary }}>
                          {fundamentals.peRatio}
                        </div>
                        <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          P/E Ratio
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(16,185,129,0.2)',
                          margin: '0 auto 8px'
                        }}>
                          <DollarSign size={18} color="#10b981" />
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: colors.green }}>
                          {fundamentals.revenueGrowth}
                        </div>
                        <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Revenue Growth
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(245,158,11,0.2)',
                          margin: '0 auto 8px'
                        }}>
                          <Percent size={18} color="#f59e0b" />
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: colors.yellow }}>
                          {fundamentals.profitMargin}
                        </div>
                        <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Profit Margin
                        </div>
                      </div>
                    </div>

                    {/* Strengths & Weaknesses */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: '600',
                          fontSize: '13px',
                          marginBottom: '12px',
                          color: colors.green
                        }}>
                          <span>✓</span>
                          STRENGTHS
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {fundamentals.strengths.map((s, i) => (
                            <li key={i} style={{
                              padding: '8px 12px',
                              marginBottom: '8px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.8)',
                              backgroundColor: 'rgba(16,185,129,0.1)',
                              borderLeft: `3px solid ${colors.green}`
                            }}>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: '600',
                          fontSize: '13px',
                          marginBottom: '12px',
                          color: colors.red
                        }}>
                          <span>✗</span>
                          WEAKNESSES
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {fundamentals.weaknesses.map((w, i) => (
                            <li key={i} style={{
                              padding: '8px 12px',
                              marginBottom: '8px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.8)',
                              backgroundColor: 'rgba(239,68,68,0.1)',
                              borderLeft: `3px solid ${colors.red}`
                            }}>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'technical' && (
                  <div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px'
                      }}>
                        <span style={{ color: colors.textMuted, fontSize: '13px' }}>52-Week Range</span>
                        <span style={{ color: colors.textPrimary, fontWeight: '600', fontSize: '13px' }}>
                          ${fundamentals.low52w} - ${fundamentals.high52w}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px'
                      }}>
                        <span style={{ color: colors.textMuted, fontSize: '13px' }}>Beta</span>
                        <span style={{ color: colors.textPrimary, fontWeight: '600', fontSize: '13px' }}>
                          {fundamentals.beta}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '8px'
                      }}>
                        <span style={{ color: colors.textMuted, fontSize: '13px' }}>Avg Volume</span>
                        <span style={{ color: colors.textPrimary, fontWeight: '600', fontSize: '13px' }}>
                          {fundamentals.avgVolume}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div style={{
            padding: '20px',
            borderTop: `1px solid ${colors.border}`
          }}>
            <button
              onClick={() => {
                onSelect(stock);
                onClose();
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isSelected ? 'rgba(239,68,68,0.2)' : colors.primary,
                color: isSelected ? colors.red : '#000',
                border: isSelected ? `1px solid ${colors.red}` : 'none'
              }}
            >
              {isSelected ? 'Remove from Portfolio' : 'Add to Portfolio'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StockDetailModal;
