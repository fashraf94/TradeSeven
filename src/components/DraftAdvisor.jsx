// src/components/DraftAdvisor.jsx
// AI-powered tactical advisor for snake drafts

import React, { useState } from 'react';

const DRAFT_ACTIONS = [
  { id: 'analyze', label: 'Analyze Draft', icon: '🔍', description: 'Review draft state' },
  { id: 'compare', label: 'Compare Picks', icon: '⚖️', description: 'Compare 2-3 stocks' },
  { id: 'stock', label: 'Analyze Stock', icon: '📊', description: 'Pros & cons of a stock' },
  { id: 'notes', label: 'My Notes', icon: '📝', description: 'View saved notes' },
];

// Stock analysis data for common tickers
const STOCK_ANALYSIS_DATA = {
  AAPL: {
    name: 'Apple Inc.',
    pros: [
      'Strong brand loyalty and ecosystem lock-in',
      'Consistent dividend growth and buybacks',
      'Services revenue growing rapidly'
    ],
    cons: [
      'iPhone sales growth slowing in mature markets',
      'Heavy dependence on China for manufacturing',
      'Premium valuation limits upside potential'
    ]
  },
  NVDA: {
    name: 'NVIDIA Corporation',
    pros: [
      'Dominant position in AI/GPU market',
      'Strong data center revenue growth',
      'Leading technology in machine learning chips'
    ],
    cons: [
      'Extremely high valuation multiples',
      'Competition from AMD and custom chips',
      'Cyclical semiconductor industry risk'
    ]
  },
  TSLA: {
    name: 'Tesla Inc.',
    pros: [
      'Market leader in EV adoption',
      'Strong brand and loyal customer base',
      'Energy storage business growing'
    ],
    cons: [
      'Increasing competition from legacy automakers',
      'Valuation assumes perfect execution',
      'Regulatory and leadership risks'
    ]
  },
  GOOGL: {
    name: 'Alphabet Inc.',
    pros: [
      'Dominant search engine market share',
      'YouTube and Cloud growing strongly',
      'Massive cash reserves for innovation'
    ],
    cons: [
      'Antitrust regulatory pressures',
      'AI disruption threat to search business',
      'Heavy R&D spend with uncertain returns'
    ]
  },
  MSFT: {
    name: 'Microsoft Corporation',
    pros: [
      'Azure cloud platform growing rapidly',
      'Dominant enterprise software position',
      'Strong recurring revenue from subscriptions'
    ],
    cons: [
      'Antitrust scrutiny on acquisitions',
      'Competition from AWS and Google Cloud',
      'PC market maturity limits Office growth'
    ]
  },
  AMZN: {
    name: 'Amazon.com Inc.',
    pros: [
      'AWS market leadership in cloud',
      'E-commerce scale advantages',
      'Prime membership creates sticky customers'
    ],
    cons: [
      'Retail margins remain thin',
      'Heavy capex requirements',
      'Labor and regulatory headwinds'
    ]
  },
  META: {
    name: 'Meta Platforms Inc.',
    pros: [
      'Massive user base across platforms',
      'Strong advertising revenue engine',
      'AI investments showing results'
    ],
    cons: [
      'Metaverse investments burning cash',
      'Privacy regulations threaten targeting',
      'Competition from TikTok for attention'
    ]
  },
  AMD: {
    name: 'Advanced Micro Devices',
    pros: [
      'Gaining market share from Intel',
      'Strong data center growth',
      'Competitive AI chip roadmap'
    ],
    cons: [
      'NVIDIA dominance in AI training',
      'Cyclical chip industry exposure',
      'Execution risk on new products'
    ]
  },
  BTC: {
    name: 'Bitcoin',
    pros: [
      'First-mover advantage and brand recognition',
      'Fixed supply creates scarcity',
      'Growing institutional adoption'
    ],
    cons: [
      'Extreme volatility and drawdowns',
      'Regulatory uncertainty globally',
      'Energy consumption concerns'
    ]
  },
  ETH: {
    name: 'Ethereum',
    pros: [
      'Leading smart contract platform',
      'Large developer ecosystem',
      'Proof-of-stake reduces energy use'
    ],
    cons: [
      'High gas fees during congestion',
      'Competition from faster L1 chains',
      'Regulatory classification uncertain'
    ]
  }
};

// Helper to get category emoji
const getCategoryEmoji = (category) => {
  if (category === 'steady') return '🛡️';
  if (category === 'risky') return '⚡';
  if (category === 'defensive') return '🏛️';
  return '📊';
};

// Notes Modal Component - Enhanced with Game Plan display
const NotesModal = ({ isOpen, onClose, notes }) => {
  if (!isOpen) return null;

  // Read saved game plan from localStorage
  const draftNotes = JSON.parse(localStorage.getItem('draftNotes') || '[]');
  const gamePlan = draftNotes.find(note => note.type === 'game-plan');

  return (
    <div
      className="notes-modal-overlay"
      onClick={onClose}
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
        zIndex: 1000
      }}
    >
      <div
        className="notes-modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d1117',
          border: '1px solid #00d9ff',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          className="notes-modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #21262d'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>📝 My Notes</h3>
          <button
            className="notes-modal-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>
        <div
          className="notes-modal-content"
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          {/* Saved Game Plan - Prominent Display */}
          {gamePlan && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, #161b22 100%)',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '18px' }}>🐍</span>
                <span style={{ fontWeight: '700', color: '#10b981', fontSize: '14px' }}>Your Draft Strategy</span>
                <span style={{
                  fontSize: '11px',
                  color: '#8b949e',
                  marginLeft: 'auto'
                }}>
                  {new Date(gamePlan.timestamp).toLocaleDateString()}
                </span>
              </div>

              {/* Strategy badge */}
              <div style={{
                display: 'inline-block',
                background: 'rgba(16, 185, 129, 0.2)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                color: '#10b981',
                fontWeight: '600',
                marginBottom: '12px'
              }}>
                {gamePlan.strategyLabel} Strategy
              </div>

              {/* Tier 1 picks - most important */}
              {gamePlan.tiers?.tier1 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#f59e0b',
                    fontWeight: '600',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    🔥 TIER 1 — Draft First
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#e6edf3',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    {Object.entries(gamePlan.tiers.tier1)
                      .filter(([_, picks]) => picks && picks.length > 0)
                      .map(([category, picks]) => (
                        <span key={category} style={{
                          background: category === 'steady' ? 'rgba(59, 130, 246, 0.2)' :
                                      category === 'risky' ? 'rgba(239, 68, 68, 0.2)' :
                                      'rgba(139, 92, 246, 0.2)',
                          border: `1px solid ${category === 'steady' ? '#3b82f6' :
                                              category === 'risky' ? '#ef4444' : '#8b5cf6'}40`,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}>
                          {getCategoryEmoji(category)} {picks.join(', ')}
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Tier 2 picks */}
              {gamePlan.tiers?.tier2 && Object.values(gamePlan.tiers.tier2).some(arr => arr && arr.length > 0) && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>
                    ⚡ TIER 2 — Backups
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#8b949e',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px'
                  }}>
                    {Object.entries(gamePlan.tiers.tier2)
                      .filter(([_, picks]) => picks && picks.length > 0)
                      .map(([category, picks]) => (
                        <span key={category}>
                          {getCategoryEmoji(category)} {picks.join(', ')}
                        </span>
                      ))
                      .reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ' | ', curr], [])}
                  </div>
                </div>
              )}

              {/* Quick tips */}
              {gamePlan.tips && gamePlan.tips.length > 0 && (
                <div style={{
                  fontSize: '12px',
                  color: '#8b949e',
                  borderTop: '1px solid #21262d',
                  paddingTop: '12px',
                  marginTop: '8px'
                }}>
                  💡 {gamePlan.tips[0]}
                </div>
              )}
            </div>
          )}

          {/* Regular notes */}
          {notes.length === 0 && !gamePlan ? (
            <p style={{ color: '#8b949e', textAlign: 'center', padding: '20px' }}>No notes saved yet</p>
          ) : (
            notes.map((note, i) => (
              <div
                key={i}
                className="note-item"
                style={{
                  background: '#161b22',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '10px',
                  fontSize: '13px'
                }}
              >
                {note.header && <strong style={{ color: '#00d9ff', display: 'block', marginBottom: '6px' }}>{note.header}</strong>}
                <p style={{ margin: 0, color: '#e6edf3', lineHeight: 1.5 }}>{note.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default function DraftAdvisor({
  myPicks = [],
  availableStocks = [],
  availableSteady = [],
  availableRisky = [],
  availableDefensive = [],
  categoryRequirements = null,
  draftPosition = null,
  round = null,
  compareStocks = [],
  onSetCompareStocks,
  colors,
  notes = []
}) {
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [showCompareInput, setShowCompareInput] = useState(false);
  const [compareAsset1, setCompareAsset1] = useState('');
  const [compareAsset2, setCompareAsset2] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Stock analysis state
  const [showStockInput, setShowStockInput] = useState(false);
  const [stockToAnalyze, setStockToAnalyze] = useState('');
  const [stockAnalysis, setStockAnalysis] = useState(null);
  const [isAnalyzingStock, setIsAnalyzingStock] = useState(false);

  // Handle stock analysis
  const handleAnalyzeStock = (ticker) => {
    if (!ticker) return;
    setIsAnalyzingStock(true);

    // Simulate a brief delay for UX
    setTimeout(() => {
      const tickerUpper = ticker.toUpperCase();

      if (STOCK_ANALYSIS_DATA[tickerUpper]) {
        setStockAnalysis({
          symbol: tickerUpper,
          ...STOCK_ANALYSIS_DATA[tickerUpper]
        });
      } else {
        // Generic fallback for unknown tickers
        setStockAnalysis({
          symbol: tickerUpper,
          name: tickerUpper,
          pros: [
            'Currently showing market interest',
            'May benefit from sector tailwinds',
            'Active trading volume'
          ],
          cons: [
            'Limited analyst coverage available',
            'Market conditions may affect performance',
            'Consider position sizing carefully'
          ]
        });
      }
      setIsAnalyzingStock(false);
      setStockToAnalyze('');
    }, 500);
  };

  const handleAction = async (actionId) => {
    // For notes action, open modal
    if (actionId === 'notes') {
      setShowNotesModal(true);
      return;
    }

    // For compare action, toggle input section
    if (actionId === 'compare') {
      setShowCompareInput(!showCompareInput);
      setShowStockInput(false);
      setActiveAction(showCompareInput ? null : 'compare');
      return;
    }

    // For stock analysis action, toggle input section
    if (actionId === 'stock') {
      setShowStockInput(!showStockInput);
      setShowCompareInput(false);
      setActiveAction(showStockInput ? null : 'stock');
      setStockAnalysis(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setActiveAction(actionId);
    setShowCompareInput(false);

    try {
      // Build detailed picks with category info
      const myPicksDetailed = myPicks.map(p => ({
        symbol: p.symbol || p.name || p,
        name: p.name || p.symbol || p,
        category: p.category || 'Unknown'
      }));

      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorType: 'draft',
          action: actionId,
          context: {
            myPicks: myPicks.map(p => p.symbol || p.name || p),
            myPicksDetailed,
            availableStocks: availableStocks.map(s => s.symbol || s.name || s),
            availableSteady: availableSteady.map(s => ({
              symbol: s.symbol,
              name: s.name,
              change24h: s.percentChange || s.change24h || 0
            })),
            availableRisky: availableRisky.map(s => ({
              symbol: s.symbol,
              name: s.name,
              change24h: s.percentChange || s.change24h || 0
            })),
            availableDefensive: availableDefensive.map(s => ({
              symbol: s.symbol,
              name: s.name,
              change24h: s.percentChange || s.change24h || 0
            })),
            categoryRequirements,
            draftPosition,
            round,
            compareStocks: actionId === 'compare' ? compareStocks : undefined,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setResponse(data.message);
    } catch (err) {
      console.error('[DraftAdvisor] Error:', err);
      setError('Failed to get AI advice. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompare = (asset1, asset2) => {
    if (!asset1 || !asset2) return;

    const stocks = [asset1.trim(), asset2.trim()];
    if (onSetCompareStocks) {
      onSetCompareStocks(stocks);
    }

    // Trigger the compare action with stocks
    setIsLoading(true);
    setError(null);
    setShowCompareInput(false);

    // Build detailed picks with category info
    const myPicksDetailed = myPicks.map(p => ({
      symbol: p.symbol || p.name || p,
      name: p.name || p.symbol || p,
      category: p.category || 'Unknown'
    }));

    fetch('/api/ai-advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advisorType: 'draft',
        action: 'compare',
        context: {
          myPicks: myPicks.map(p => p.symbol || p.name || p),
          myPicksDetailed,
          availableStocks: availableStocks.map(s => s.symbol || s.name || s),
          availableSteady: availableSteady.map(s => ({
            symbol: s.symbol,
            name: s.name,
            change24h: s.percentChange || s.change24h || 0
          })),
          availableRisky: availableRisky.map(s => ({
            symbol: s.symbol,
            name: s.name,
            change24h: s.percentChange || s.change24h || 0
          })),
          availableDefensive: availableDefensive.map(s => ({
            symbol: s.symbol,
            name: s.name,
            change24h: s.percentChange || s.change24h || 0
          })),
          categoryRequirements,
          draftPosition,
          round,
          compareStocks: stocks,
        },
      }),
    })
      .then(res => res.json())
      .then(data => {
        setResponse(data.message);
        setIsLoading(false);
        setCompareAsset1('');
        setCompareAsset2('');
      })
      .catch(err => {
        console.error('[DraftAdvisor] Error:', err);
        setError('Failed to get AI advice. Please try again.');
        setIsLoading(false);
      });
  };

  const clearResponse = () => {
    setResponse(null);
    setActiveAction(null);
    setError(null);
  };

  return (
    <div style={{
      background: '#161b22',
      borderRadius: '12px',
      border: '1px solid #21262d',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🤖</span>
          <span style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
            Draft Advisor
          </span>
        </div>
        {response && (
          <button
            onClick={clearResponse}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{
        padding: '12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px'
      }}>
        {DRAFT_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={isLoading}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              border: activeAction === action.id ? `2px solid ${colors?.cyan || '#00d9ff'}` : '1px solid #30363d',
              background: activeAction === action.id ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
              color: '#e6edf3',
              fontSize: '12px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              opacity: isLoading ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '16px' }}>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Compare Input - Two separate inputs with fixed overflow */}
      {showCompareInput && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #21262d'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            marginBottom: '10px'
          }}>
            <input
              type="text"
              value={compareAsset1}
              onChange={(e) => setCompareAsset1(e.target.value.toUpperCase())}
              placeholder="E.G., AAPL"
              maxLength={5}
              style={{
                flex: 1,
                minWidth: 0,  // KEY: Allows flex item to shrink below content size
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '14px',
                textAlign: 'center',
                textTransform: 'uppercase',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00d9ff'}
              onBlur={(e) => e.target.style.borderColor = '#30363d'}
            />
            <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>vs</span>
            <input
              type="text"
              value={compareAsset2}
              onChange={(e) => setCompareAsset2(e.target.value.toUpperCase())}
              placeholder="E.G., MSFT"
              maxLength={5}
              style={{
                flex: 1,
                minWidth: 0,  // KEY: Allows flex item to shrink below content size
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#fff',
                fontSize: '14px',
                textAlign: 'center',
                textTransform: 'uppercase',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00d9ff'}
              onBlur={(e) => e.target.style.borderColor = '#30363d'}
            />
          </div>
          <button
            onClick={() => handleCompare(compareAsset1, compareAsset2)}
            disabled={!compareAsset1 || !compareAsset2}
            style={{
              width: '100%',
              background: (compareAsset1 && compareAsset2) ? (colors?.cyan || '#00d9ff') : '#21262d',
              border: 'none',
              color: (compareAsset1 && compareAsset2) ? '#000' : '#8b949e',
              fontWeight: '600',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: (!compareAsset1 || !compareAsset2) ? 'not-allowed' : 'pointer'
            }}
          >
            Compare
          </button>
        </div>
      )}

      {/* Stock Analysis Input and Results */}
      {showStockInput && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #21262d'
        }}>
          {/* Input Row */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '12px'
          }}>
            <input
              type="text"
              value={stockToAnalyze}
              onChange={(e) => setStockToAnalyze(e.target.value.toUpperCase())}
              placeholder="Enter ticker (e.g., AAPL)"
              style={{
                flex: 1,
                padding: '10px 12px',
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                textTransform: 'uppercase',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#00d9ff'}
              onBlur={(e) => e.target.style.borderColor = '#30363d'}
              onKeyPress={(e) => e.key === 'Enter' && handleAnalyzeStock(stockToAnalyze)}
            />
            <button
              onClick={() => handleAnalyzeStock(stockToAnalyze)}
              disabled={!stockToAnalyze || isAnalyzingStock}
              style={{
                padding: '10px 16px',
                background: (stockToAnalyze && !isAnalyzingStock) ? (colors?.cyan || '#00d9ff') : '#21262d',
                border: 'none',
                borderRadius: '8px',
                color: (stockToAnalyze && !isAnalyzingStock) ? '#000' : '#8b949e',
                fontWeight: '600',
                cursor: (!stockToAnalyze || isAnalyzingStock) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isAnalyzingStock ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {/* Loading State */}
          {isAnalyzingStock && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              gap: '8px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #00d9ff',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ color: '#8b949e', fontSize: '13px' }}>
                Analyzing...
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Analysis Results */}
          {stockAnalysis && !isAnalyzingStock && (
            <div>
              {/* Stock Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
                paddingBottom: '10px',
                borderBottom: '1px solid #21262d'
              }}>
                <span style={{
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: '700'
                }}>
                  {stockAnalysis.symbol}
                </span>
                <span style={{
                  color: '#8b949e',
                  fontSize: '12px'
                }}>
                  {stockAnalysis.name}
                </span>
              </div>

              {/* Pros and Cons Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px'
              }}>
                {/* Pros */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#22c55e', fontSize: '12px' }}>✓</span>
                    <span style={{
                      color: '#22c55e',
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase'
                    }}>
                      Pros
                    </span>
                  </div>
                  {stockAnalysis.pros.map((pro, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        borderLeft: '2px solid #22c55e',
                        borderRadius: '0 6px 6px 0',
                        padding: '8px 10px',
                        marginBottom: '6px'
                      }}
                    >
                      <p style={{
                        color: '#e6edf3',
                        fontSize: '11px',
                        margin: 0,
                        lineHeight: '1.4'
                      }}>
                        {pro}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Cons */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#ef4444', fontSize: '12px' }}>✗</span>
                    <span style={{
                      color: '#ef4444',
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase'
                    }}>
                      Cons
                    </span>
                  </div>
                  {stockAnalysis.cons.map((con, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderLeft: '2px solid #ef4444',
                        borderRadius: '0 6px 6px 0',
                        padding: '8px 10px',
                        marginBottom: '6px'
                      }}
                    >
                      <p style={{
                        color: '#e6edf3',
                        fontSize: '11px',
                        margin: 0,
                        lineHeight: '1.4'
                      }}>
                        {con}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Response */}
      {(isLoading || response) && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid #21262d',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {isLoading ? (
            <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center' }}>
              Analyzing...
            </div>
          ) : (
            <div style={{
              color: '#e6edf3',
              fontSize: '13px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              {response}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(248, 81, 73, 0.1)',
          color: '#f85149',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Context Info */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #21262d',
        fontSize: '11px',
        color: '#6e7681'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Picks: {myPicks.length}</span>
          <span>Available: {availableSteady.length + availableRisky.length + availableDefensive.length || availableStocks.length}</span>
          {round && <span>Round {round}</span>}
        </div>
        {categoryRequirements && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
            <span>📊 {categoryRequirements.steadyPicked || 0}/{categoryRequirements.steadyRequired || 0}</span>
            <span>🔥 {categoryRequirements.riskyPicked || 0}/{categoryRequirements.riskyRequired || 0}</span>
            <span>🛡️ {categoryRequirements.defensivePicked || 0}/{categoryRequirements.defensiveRequired || 0}</span>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        notes={notes}
      />
    </div>
  );
}
