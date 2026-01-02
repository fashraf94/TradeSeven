import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import SectorCard from './SectorCard';
import SectorDetailModal from './SectorDetailModal';
import { fetchAllSectorsData, SECTOR_ORDER } from '../../services/sectorDataService';

const SectorSelectionScreen = ({
  onBack,
  onNext,
  riskStyle = 'balanced',
  maxSelections = 3
}) => {
  const [sectorsData, setSectorsData] = useState({});
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailModalSector, setDetailModalSector] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    loadSectorsData();
  }, []);

  const loadSectorsData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllSectorsData(forceRefresh);
      setSectorsData(data);
    } catch (err) {
      console.error('Error loading sectors:', err);
      setError('Failed to load sector data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSector = (sectorId) => {
    setSelectedSectors(prev => {
      if (prev.includes(sectorId)) {
        return prev.filter(id => id !== sectorId);
      }
      if (prev.length >= maxSelections) {
        // Replace oldest selection
        return [...prev.slice(1), sectorId];
      }
      return [...prev, sectorId];
    });
  };

  const handleViewDetails = (sectorId) => {
    setDetailModalSector(sectorsData[sectorId]);
  };

  const handleNext = () => {
    if (selectedSectors.length === 0) {
      alert('Please select at least one sector');
      return;
    }
    onNext?.(selectedSectors);
  };

  // Get recommended sectors based on risk style
  const getRecommendedSectors = () => {
    const sorted = [...SECTOR_ORDER]
      .filter(id => sectorsData[id])
      .sort((a, b) => {
        const sectorA = sectorsData[a];
        const sectorB = sectorsData[b];

        if (riskStyle === 'aggressive') {
          // Sort by volatility/breakout potential
          return (sectorB.baggerBombStats?.breakouts7d || 0) - (sectorA.baggerBombStats?.breakouts7d || 0);
        } else if (riskStyle === 'conservative') {
          // Sort by stability (inverse of avg threshold)
          return (sectorA.baggerBombStats?.avgThreshold || 5) - (sectorB.baggerBombStats?.avgThreshold || 5);
        } else {
          // Balanced - sort by hit rate
          return (sectorB.baggerBombStats?.hitRate || 0) - (sectorA.baggerBombStats?.hitRate || 0);
        }
      });

    return sorted.slice(0, 3);
  };

  const recommendedSectors = getRecommendedSectors();

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
          width: '48px',
          height: '48px',
          border: '3px solid #21262d',
          borderTopColor: '#00d9ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <div style={{ color: '#8b949e' }}>Loading sector data...</div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
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
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <ArrowLeft size={18} /> Back
        </button>

        <div style={{ fontSize: '14px', color: '#8b949e' }}>
          Step 3 of 5
        </div>

        <button
          onClick={() => loadSectorsData(true)}
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
          <RefreshCw size={16} /> Refresh
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
      <div style={{ textAlign: 'center', padding: '0 20px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Select Your Sectors
        </h1>
        <p style={{ color: '#8b949e', fontSize: '15px' }}>
          Choose 1-{maxSelections} sectors you're bullish on. This affects which stocks are recommended.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          margin: '0 20px 20px',
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ color: '#ef4444' }}>{error}</span>
        </div>
      )}

      {/* Recommended Banner */}
      {recommendedSectors.length > 0 && (
        <div style={{
          margin: '0 20px 20px',
          padding: '14px 16px',
          backgroundColor: 'rgba(0, 217, 255, 0.1)',
          border: '1px solid rgba(0, 217, 255, 0.3)',
          borderRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>🎯</span>
            <span style={{ fontWeight: '600', color: '#00d9ff' }}>
              Recommended for {riskStyle.charAt(0).toUpperCase() + riskStyle.slice(1)} Strategy
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {recommendedSectors.map(sectorId => (
              <button
                key={sectorId}
                onClick={() => handleSelectSector(sectorId)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: selectedSectors.includes(sectorId) ? sectorsData[sectorId]?.color : '#21262d',
                  border: 'none',
                  borderRadius: '16px',
                  color: selectedSectors.includes(sectorId) ? '#000' : '#fff',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {sectorsData[sectorId]?.emoji} {sectorsData[sectorId]?.name}
                {selectedSectors.includes(sectorId) && ' ✓'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selection Counter */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '14px', color: '#8b949e' }}>
          {selectedSectors.length} of {maxSelections} selected
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '6px 12px',
              backgroundColor: viewMode === 'grid' ? '#21262d' : 'transparent',
              border: '1px solid #21262d',
              borderRadius: '6px',
              color: viewMode === 'grid' ? '#fff' : '#8b949e',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 12px',
              backgroundColor: viewMode === 'list' ? '#21262d' : 'transparent',
              border: '1px solid #21262d',
              borderRadius: '6px',
              color: viewMode === 'list' ? '#fff' : '#8b949e',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            List
          </button>
        </div>
      </div>

      {/* Sector Cards */}
      <div style={{ padding: '0 20px 100px' }}>
        {viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {SECTOR_ORDER.map(sectorId => (
              sectorsData[sectorId] && (
                <SectorCard
                  key={sectorId}
                  sector={sectorsData[sectorId]}
                  isSelected={selectedSectors.includes(sectorId)}
                  onSelect={handleSelectSector}
                  onViewDetails={handleViewDetails}
                  compact={true}
                />
              )
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {SECTOR_ORDER.map(sectorId => (
              sectorsData[sectorId] && (
                <SectorCard
                  key={sectorId}
                  sector={sectorsData[sectorId]}
                  isSelected={selectedSectors.includes(sectorId)}
                  onSelect={handleSelectSector}
                  onViewDetails={handleViewDetails}
                  compact={false}
                />
              )
            ))}
          </div>
        )}
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
            color: '#ffffff',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={selectedSectors.length === 0}
          style={{
            flex: 2,
            padding: '14px',
            backgroundColor: selectedSectors.length > 0 ? '#00d9ff' : '#21262d',
            border: 'none',
            borderRadius: '10px',
            color: selectedSectors.length > 0 ? '#000000' : '#8b949e',
            fontWeight: '600',
            cursor: selectedSectors.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          Continue with {selectedSectors.length} Sector{selectedSectors.length !== 1 ? 's' : ''} →
        </button>
      </div>

      {/* Sector Detail Modal */}
      {detailModalSector && (
        <SectorDetailModal
          sector={detailModalSector}
          onClose={() => setDetailModalSector(null)}
          onSelectSector={handleSelectSector}
          isSelected={selectedSectors.includes(detailModalSector.id)}
        />
      )}
    </div>
  );
};

export default SectorSelectionScreen;
