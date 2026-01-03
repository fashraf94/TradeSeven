import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, ChevronRight } from 'lucide-react';
import SectorCard from './SectorCard';
import SectorDetailModal from './SectorDetailModal';
import { fetchSectorData, SECTOR_ORDER } from '../../services/sectorDataService';
import { getRecommendedSectors, getSectorTabs } from '../../utils/sectorRecommendations';

const SectorSelectionScreen = ({
  onBack,
  onNext,
  riskStyle = 'balanced',
  marketStance = 'neutral',
  maxSelections = 3
}) => {
  const [sectorsData, setSectorsData] = useState({});
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [detailModalSector, setDetailModalSector] = useState(null);
  const [activeTab, setActiveTab] = useState('recommended');
  const [loadedTabs, setLoadedTabs] = useState(['recommended']);

  const tabsRef = useRef(null);

  // Get recommended sectors based on market stance and risk style
  const recommendedSectorIds = getRecommendedSectors(marketStance, riskStyle);
  const tabs = getSectorTabs(recommendedSectorIds);

  // Load recommended sectors on mount
  useEffect(() => {
    loadRecommendedSectors();
  }, []);

  const loadRecommendedSectors = async () => {
    try {
      setLoading(true);
      setError(null);

      // Only load the 3 recommended sectors initially
      const data = {};
      await Promise.all(
        recommendedSectorIds.map(async (sectorId) => {
          try {
            const sectorData = await fetchSectorData(sectorId);
            if (sectorData) {
              data[sectorId] = sectorData;
            }
          } catch (err) {
            console.error(`Error loading sector ${sectorId}:`, err);
          }
        })
      );

      setSectorsData(data);
    } catch (err) {
      console.error('Error loading sectors:', err);
      setError('Failed to load sector data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load sectors for a specific tab on-demand
  const loadTabSectors = async (tabId) => {
    if (loadedTabs.includes(tabId)) return;

    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.sectors.length === 0) return;

    setLoadingMore(true);

    try {
      const data = { ...sectorsData };
      await Promise.all(
        tab.sectors.map(async (sectorId) => {
          if (!data[sectorId]) {
            try {
              const sectorData = await fetchSectorData(sectorId);
              if (sectorData) {
                data[sectorId] = sectorData;
              }
            } catch (err) {
              console.error(`Error loading sector ${sectorId}:`, err);
            }
          }
        })
      );

      setSectorsData(data);
      setLoadedTabs(prev => [...prev, tabId]);
    } catch (err) {
      console.error('Error loading tab sectors:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTabChange = async (tabId) => {
    setActiveTab(tabId);
    await loadTabSectors(tabId);
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

  // Get current tab's sectors
  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
  const currentSectors = currentTab?.sectors || [];

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
        <div style={{ color: '#8b949e' }}>Loading recommended sectors...</div>
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
          onClick={loadRecommendedSectors}
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
        <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
          Select Your Sectors
        </h1>
        <p style={{ color: '#8b949e', fontSize: '15px' }}>
          Choose 1-{maxSelections} sectors you're bullish on
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          margin: '0 20px 16px',
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

      {/* Horizontal Tabs */}
      <div
        ref={tabsRef}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '0 20px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              backgroundColor: activeTab === tab.id ? '#00d9ff' : '#21262d',
              border: 'none',
              borderRadius: '20px',
              color: activeTab === tab.id ? '#000' : '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
            <span style={{
              padding: '2px 6px',
              backgroundColor: activeTab === tab.id ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '11px'
            }}>
              {tab.sectors.length}
            </span>
          </button>
        ))}
      </div>

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
        {selectedSectors.length > 0 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {selectedSectors.map(id => (
              <span
                key={id}
                style={{
                  padding: '4px 10px',
                  backgroundColor: sectorsData[id]?.color || '#00d9ff',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#000'
                }}
              >
                {id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Loading More Indicator */}
      {loadingMore && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 20px',
          color: '#8b949e'
        }}>
          <div style={{
            width: '16px',
            height: '16px',
            border: '2px solid #21262d',
            borderTopColor: '#00d9ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Loading sectors...
        </div>
      )}

      {/* Sector Cards */}
      <div style={{ padding: '0 20px 100px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {currentSectors.map(sectorId => (
            sectorsData[sectorId] ? (
              <SectorCard
                key={sectorId}
                sector={sectorsData[sectorId]}
                isSelected={selectedSectors.includes(sectorId)}
                onSelect={handleSelectSector}
                onViewDetails={handleViewDetails}
                compact={true}
              />
            ) : (
              <div
                key={sectorId}
                style={{
                  padding: '20px',
                  backgroundColor: '#161b22',
                  borderRadius: '12px',
                  border: '1px solid #21262d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '120px'
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#8b949e'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid #21262d',
                    borderTopColor: '#00d9ff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: '13px' }}>Loading {sectorId}...</span>
                </div>
              </div>
            )
          ))}
        </div>

        {/* Show All Sectors Link */}
        {activeTab === 'recommended' && tabs.length > 1 && (
          <button
            onClick={() => handleTabChange(tabs[1]?.id || 'growth')}
            style={{
              width: '100%',
              marginTop: '20px',
              padding: '14px',
              backgroundColor: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '10px',
              color: '#8b949e',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            Explore more sectors <ChevronRight size={16} />
          </button>
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
