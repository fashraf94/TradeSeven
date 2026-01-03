import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Check, RefreshCw } from 'lucide-react';
import { fetchSectorData } from '../../services/sectorDataService';
import { SECTORS } from '../../constants/sectors';

// Sector recommendation logic based on market stance + risk style
const getRecommendedSectors = (marketStance, riskStyle) => {
  const recommendations = {
    'bullish-aggressive': ['XLK', 'XLY', 'XLC'],
    'bullish-balanced': ['XLK', 'XLF', 'XLV'],
    'bullish-conservative': ['XLV', 'XLP', 'XLU'],
    'bearish-aggressive': ['XLE', 'XLF', 'XLB'],
    'bearish-balanced': ['XLU', 'XLP', 'XLV'],
    'bearish-conservative': ['XLU', 'XLP', 'XLRE'],
    'neutral-aggressive': ['XLK', 'XLE', 'XLF'],
    'neutral-balanced': ['XLK', 'XLV', 'XLF'],
    'neutral-conservative': ['XLP', 'XLU', 'XLV']
  };

  const key = `${(marketStance || 'neutral').toLowerCase()}-${(riskStyle || 'balanced').toLowerCase()}`;
  return recommendations[key] || recommendations['neutral-balanced'];
};

const ALL_SECTORS = ['XLK', 'XLV', 'XLF', 'XLE', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC'];

// Explicit sector name mapping (fallback if SECTORS constant doesn't have names)
const SECTOR_NAMES = {
  XLK: { name: 'Technology', emoji: '💻', color: '#00d9ff' },
  XLV: { name: 'Healthcare', emoji: '🏥', color: '#f472b6' },
  XLF: { name: 'Financials', emoji: '🏦', color: '#10b981' },
  XLE: { name: 'Energy', emoji: '⚡', color: '#f59e0b' },
  XLY: { name: 'Consumer Disc', emoji: '🛍️', color: '#8b5cf6' },
  XLP: { name: 'Consumer Staples', emoji: '🛒', color: '#06b6d4' },
  XLI: { name: 'Industrials', emoji: '🏭', color: '#6366f1' },
  XLB: { name: 'Materials', emoji: '🧱', color: '#ec4899' },
  XLU: { name: 'Utilities', emoji: '💡', color: '#eab308' },
  XLRE: { name: 'Real Estate', emoji: '🏠', color: '#14b8a6' },
  XLC: { name: 'Communication', emoji: '📡', color: '#f97316' }
};

// Helper to get sector info (prefers SECTORS constant, falls back to SECTOR_NAMES)
const getSectorInfo = (sectorId) => {
  return SECTORS?.[sectorId] || SECTOR_NAMES[sectorId] || {
    name: sectorId,
    emoji: '📊',
    color: '#8b949e'
  };
};

const SectorSelectionScreen = ({
  onBack,
  onNext,
  riskStyle = 'balanced',
  marketStance = 'neutral',
  initialSelections = [],
  maxSelections = 3
}) => {
  // Get recommended sectors
  const recommendedSectorIds = getRecommendedSectors(marketStance, riskStyle);
  const otherSectorIds = ALL_SECTORS.filter(id => !recommendedSectorIds.includes(id));

  // State
  const [selectedSectors, setSelectedSectors] = useState(initialSelections);
  const [sectorData, setSectorData] = useState({});
  const [loadingSectors, setLoadingSectors] = useState(new Set());
  const [loadedSectors, setLoadedSectors] = useState(new Set());
  const [activeTab, setActiveTab] = useState('recommended');

  // Load recommended sectors on mount
  useEffect(() => {
    loadSectors(recommendedSectorIds);
  }, []);

  // Load sectors function
  const loadSectors = async (sectorIds) => {
    const sectorsToLoad = sectorIds.filter(id =>
      !loadedSectors.has(id) && !loadingSectors.has(id)
    );

    if (sectorsToLoad.length === 0) return;

    setLoadingSectors(prev => new Set([...prev, ...sectorsToLoad]));

    try {
      const results = await Promise.all(
        sectorsToLoad.map(async (sectorId) => {
          try {
            const data = await fetchSectorData(sectorId);
            return { sectorId, data };
          } catch (err) {
            console.error(`Error loading sector ${sectorId}:`, err);
            return { sectorId, data: null };
          }
        })
      );

      setSectorData(prev => {
        const updated = { ...prev };
        results.forEach(({ sectorId, data }) => {
          if (data) updated[sectorId] = data;
        });
        return updated;
      });

      setLoadedSectors(prev => new Set([...prev, ...sectorsToLoad]));

    } catch (err) {
      console.error('Error loading sectors:', err);
    } finally {
      setLoadingSectors(prev => {
        const next = new Set(prev);
        sectorsToLoad.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  // Handle tab click
  const handleTabClick = (tabId) => {
    setActiveTab(tabId);

    // If it's an individual sector tab, load it
    if (tabId !== 'recommended' && !loadedSectors.has(tabId)) {
      loadSectors([tabId]);
    }
  };

  // Handle sector selection
  const handleSectorSelect = (sectorId) => {
    setSelectedSectors(prev => {
      if (prev.includes(sectorId)) {
        return prev.filter(id => id !== sectorId);
      }
      if (prev.length >= maxSelections) {
        return prev; // Can't select more
      }
      return [...prev, sectorId];
    });
  };

  // Get sectors to display
  const getDisplayedSectors = () => {
    if (activeTab === 'recommended') {
      return recommendedSectorIds;
    }
    return [activeTab]; // Single sector
  };

  const displayedSectors = getDisplayedSectors();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column'
    }}>
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
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <span style={{ color: '#8b949e', fontSize: '14px' }}>Step 3 of 5</span>
        <button
          onClick={() => loadSectors(recommendedSectorIds)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#8b949e',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Progress Dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '24px', height: '8px', borderRadius: '4px', backgroundColor: '#00d9ff' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#21262d' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#21262d' }} />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '0 20px 16px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '8px' }}>
          Select Your Sectors
        </h1>
        <p style={{ color: '#8b949e', fontSize: '14px' }}>
          Choose 1-{maxSelections} sectors you're bullish on
        </p>
      </div>

      {/* Selected Sectors Pills */}
      {selectedSectors.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          padding: '0 20px'
        }}>
          {selectedSectors.map(sectorId => {
            const sector = getSectorInfo(sectorId);
            return (
              <div
                key={sectorId}
                onClick={() => handleSectorSelect(sectorId)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: `${sector.color}30`,
                  border: `1px solid ${sector.color}`,
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: sector.color,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {sector.emoji} {sectorId}
                <span style={{ opacity: 0.7 }}>✕</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Sector Tabs - Horizontal Scroll with Individual Sectors */}
      <div style={{
        padding: '0 20px',
        marginBottom: '20px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          paddingBottom: '8px',
          justifyContent: 'flex-start'
        }}>
          {/* Recommended Tab */}
          <button
            onClick={() => handleTabClick('recommended')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'recommended' ? '#f59e0b' : '#21262d',
              border: 'none',
              borderRadius: '20px',
              color: activeTab === 'recommended' ? '#000' : '#8b949e',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0
            }}
          >
            ⭐ Recommended
          </button>

          {/* Individual Sector Tabs */}
          {otherSectorIds.map(sectorId => {
            const sector = getSectorInfo(sectorId);
            const isLoading = loadingSectors.has(sectorId);
            const isActive = activeTab === sectorId;
            const isSelected = selectedSectors.includes(sectorId);

            return (
              <button
                key={sectorId}
                onClick={() => handleTabClick(sectorId)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: isActive ? (sector.color) :
                                   isSelected ? `${sector.color}40` : '#21262d',
                  border: isSelected && !isActive ? `1px solid ${sector.color}` : 'none',
                  borderRadius: '20px',
                  color: isActive ? '#000' : isSelected ? sector.color : '#8b949e',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isLoading ? 0.7 : 1,
                  flexShrink: 0
                }}
              >
                {sector.emoji} {sector.name}
                {isLoading && (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                )}
                {isSelected && !isLoading && <Check size={14} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection Counter */}
      <div style={{
        margin: '0 20px 16px',
        padding: '10px 16px',
        backgroundColor: '#161b22',
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: '#8b949e' }}>Selected</span>
        <span style={{
          fontWeight: '700',
          color: selectedSectors.length === maxSelections ? '#10b981' : '#00d9ff'
        }}>
          {selectedSectors.length} / {maxSelections}
        </span>
      </div>

      {/* Sector Cards - CENTERED */}
      <div style={{
        flex: 1,
        padding: '0 20px 120px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Centered Grid Container */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
          maxWidth: '900px',
          width: '100%'
        }}>
          {displayedSectors.map(sectorId => {
            const data = sectorData[sectorId];
            const sector = getSectorInfo(sectorId);
            const isLoading = loadingSectors.has(sectorId);
            const isSelected = selectedSectors.includes(sectorId);
            const canSelect = isSelected || selectedSectors.length < maxSelections;

            // Loading state
            if (isLoading && !data) {
              return (
                <div
                  key={sectorId}
                  style={{
                    width: '280px',
                    backgroundColor: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '16px',
                    padding: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '180px'
                  }}
                >
                  <Loader2
                    size={32}
                    color={sector.color}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                  <span style={{
                    marginTop: '16px',
                    color: '#8b949e',
                    fontSize: '14px'
                  }}>
                    Loading {sector.name}...
                  </span>
                </div>
              );
            }

            // Sector Card
            return (
              <div
                key={sectorId}
                onClick={() => canSelect && handleSectorSelect(sectorId)}
                style={{
                  width: '280px',
                  backgroundColor: isSelected ? `${sector.color}15` : '#161b22',
                  border: isSelected
                    ? `2px solid ${sector.color}`
                    : '1px solid #21262d',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: canSelect ? 'pointer' : 'not-allowed',
                  opacity: canSelect ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Selection Indicator */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: sector.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={14} color="#000" strokeWidth={3} />
                  </div>
                )}

                {/* Sector Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: `${sector.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    {sector.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '16px', color: '#fff' }}>
                      {sector.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#8b949e' }}>
                      {sectorId}
                    </div>
                  </div>
                  {/* Performance */}
                  {data?.performance && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: (data.performance.month1 || 0) >= 0 ? '#10b981' : '#ef4444'
                      }}>
                        {(data.performance.month1 || 0) >= 0 ? '+' : ''}
                        {(data.performance.month1 || 0).toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '11px', color: '#8b949e' }}>1M</div>
                    </div>
                  )}
                </div>

                {/* Trend & Breadth */}
                {data && (
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '13px',
                    color: '#8b949e'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: data.trend?.color || '#f59e0b' }}>●</span>
                      {data.trend?.label || 'Neutral'}
                    </div>
                    {data.breadth && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📊 {data.breadth.percent || 50}% breadth
                      </div>
                    )}
                  </div>
                )}

                {/* BaggerBomb Stats */}
                {data?.baggerBombStats && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: '#0d1117',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#10b981', fontWeight: '700' }}>
                        {data.baggerBombStats.breakouts7d || 0}
                      </div>
                      <div style={{ color: '#8b949e' }}>Breakouts</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#ef4444', fontWeight: '700' }}>
                        {data.baggerBombStats.busts7d || 0}
                      </div>
                      <div style={{ color: '#8b949e' }}>Busts</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#00d9ff', fontWeight: '700' }}>
                        {data.baggerBombStats.hitRate || 0}%
                      </div>
                      <div style={{ color: '#8b949e' }}>Hit Rate</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
        borderTop: '1px solid #21262d',
        display: 'flex',
        gap: '12px'
      }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '14px',
            backgroundColor: '#21262d',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={() => onNext(selectedSectors)}
          disabled={selectedSectors.length === 0}
          style={{
            flex: 2,
            padding: '14px',
            backgroundColor: selectedSectors.length > 0 ? '#00d9ff' : '#21262d',
            border: 'none',
            borderRadius: '10px',
            color: selectedSectors.length > 0 ? '#000' : '#8b949e',
            fontWeight: '600',
            cursor: selectedSectors.length > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          Continue with {selectedSectors.length} Sector{selectedSectors.length !== 1 ? 's' : ''} →
        </button>
      </div>

      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default SectorSelectionScreen;
