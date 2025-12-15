// src/components/DraftAdvisor.jsx
// AI-powered tactical advisor for snake drafts

import React, { useState } from 'react';

const DRAFT_ACTIONS = [
  { id: 'analyze', label: 'Analyze Draft', icon: '🔍', description: 'Review draft state' },
  { id: 'compare', label: 'Compare Picks', icon: '⚖️', description: 'Compare 2-3 stocks' },
  { id: 'gaps', label: "What's Missing", icon: '🎯', description: 'Find portfolio gaps' },
  { id: 'suggest', label: 'Suggest Pick', icon: '💡', description: 'Get recommendation' },
];

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
  colors
}) {
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [showCompareInput, setShowCompareInput] = useState(false);
  const [compareInput, setCompareInput] = useState('');

  const handleAction = async (actionId) => {
    // For compare action, show input first
    if (actionId === 'compare' && compareStocks.length < 2) {
      setShowCompareInput(true);
      setActiveAction('compare');
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

  const handleCompareSubmit = () => {
    const stocks = compareInput.split(/[,\s]+/).filter(s => s.trim()).slice(0, 3);
    if (stocks.length >= 2) {
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
        })
        .catch(err => {
          console.error('[DraftAdvisor] Error:', err);
          setError('Failed to get AI advice. Please try again.');
          setIsLoading(false);
        });
    }
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

      {/* Compare Input */}
      {showCompareInput && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #21262d',
          display: 'flex',
          gap: '8px'
        }}>
          <input
            type="text"
            value={compareInput}
            onChange={(e) => setCompareInput(e.target.value)}
            placeholder="Enter 2-3 symbols (e.g., AAPL, MSFT)"
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #30363d',
              background: '#0d1117',
              color: '#e6edf3',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleCompareSubmit}
            disabled={compareInput.split(/[,\s]+/).filter(s => s.trim()).length < 2}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: colors?.cyan || '#00d9ff',
              color: '#000',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: compareInput.split(/[,\s]+/).filter(s => s.trim()).length < 2 ? 0.5 : 1
            }}
          >
            Compare
          </button>
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
    </div>
  );
}
