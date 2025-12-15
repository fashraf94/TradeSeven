// src/components/DraftAdvisor.jsx
// AI-powered tactical advisor for snake drafts

import React, { useState } from 'react';

const DRAFT_ACTIONS = [
  { id: 'analyze', label: 'Analyze Draft', icon: '🔍', description: 'Review draft state' },
  { id: 'compare', label: 'Compare Picks', icon: '⚖️', description: 'Compare 2-3 stocks' },
  { id: 'gaps', label: "What's Missing", icon: '🎯', description: 'Find portfolio gaps' },
  { id: 'notes', label: 'My Notes', icon: '📝', description: 'View saved notes' },
];

// Notes Modal Component
const NotesModal = ({ isOpen, onClose, notes }) => {
  if (!isOpen) return null;

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
          maxHeight: '60vh',
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
          {notes.length === 0 ? (
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

  const handleAction = async (actionId) => {
    // For notes action, open modal
    if (actionId === 'notes') {
      setShowNotesModal(true);
      return;
    }

    // For compare action, toggle input section
    if (actionId === 'compare') {
      setShowCompareInput(!showCompareInput);
      setActiveAction(showCompareInput ? null : 'compare');
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

      {/* Compare Input - Two separate inputs */}
      {showCompareInput && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #21262d',
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1
          }}>
            <input
              type="text"
              value={compareAsset1}
              onChange={(e) => setCompareAsset1(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              maxLength={5}
              style={{
                flex: 1,
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
            <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600' }}>vs</span>
            <input
              type="text"
              value={compareAsset2}
              onChange={(e) => setCompareAsset2(e.target.value.toUpperCase())}
              placeholder="e.g., MSFT"
              maxLength={5}
              style={{
                flex: 1,
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
              background: colors?.cyan || '#00d9ff',
              border: 'none',
              color: '#000',
              fontWeight: '600',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: (!compareAsset1 || !compareAsset2) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: (!compareAsset1 || !compareAsset2) ? 0.5 : 1
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

      {/* Notes Modal */}
      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        notes={notes}
      />
    </div>
  );
}
