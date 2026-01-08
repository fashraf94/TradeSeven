// /src/screens/FreeAgencyScreen.jsx

import React, { useState, useEffect } from 'react';

/**
 * FreeAgencyScreen - Swap assets during the battle phase
 *
 * @param {Object} props
 * @param {Object} props.currentDraft - Current draft data
 * @param {Object} props.user - Current user object
 * @param {Function} props.setScreen - Handler to change screen
 * @param {Object} props.containerStyle - Container style from App
 */
const FreeAgencyScreen = ({
  currentDraft,
  user,
  setScreen,
  containerStyle
}) => {
  const [freeAgents, setFreeAgents] = useState({ steady: [], risky: [], defensive: [] });
  const [playerRoster, setPlayerRoster] = useState({ steady: [], risky: [], defensive: [] });
  const [selectedCategory, setSelectedCategory] = useState('steady');
  const [swapsRemaining, setSwapsRemaining] = useState(2);
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [timeInfo, setTimeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [swapHistory, setSwapHistory] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedAdd, setSelectedAdd] = useState(null);
  const [swapping, setSwapping] = useState(false);

  const portfolioType = currentDraft?.type || 'stocks';
  const currentUserId = user.odUserId || user.username;

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!currentDraft?.id) return;

      setLoading(true);
      const freeAgencyService = await import('../services/freeAgencyService');

      // Check window status
      const windowOpen = freeAgencyService.isFreeAgencyWindowOpen(portfolioType);
      setIsWindowOpen(windowOpen);

      if (windowOpen) {
        const closeTime = freeAgencyService.getTimeUntilWindowCloses(portfolioType);
        setTimeInfo({ type: 'closes', ...closeTime });
      } else {
        const openTime = freeAgencyService.getTimeUntilWindowOpens(portfolioType);
        setTimeInfo({ type: 'opens', ...openTime });
      }

      // Get free agents
      const agents = await freeAgencyService.getFreeAgents(currentDraft.id);
      setFreeAgents(agents);

      // Get player roster
      const roster = await freeAgencyService.getPlayerRoster(currentDraft.id, currentUserId);
      setPlayerRoster(roster || { steady: [], risky: [], defensive: [] });

      // Get swaps remaining
      const swapCheck = await freeAgencyService.canPlayerSwap(currentDraft.id, currentUserId, portfolioType);
      setSwapsRemaining(swapCheck.swapsRemaining ?? 2);

      // Get swap history
      const history = await freeAgencyService.getSwapHistory(currentDraft.id);
      setSwapHistory(history);

      setLoading(false);
    };

    loadData();

    // Refresh every minute to update window status
    const refreshInterval = setInterval(loadData, 60000);
    return () => clearInterval(refreshInterval);
  }, [currentDraft?.id, portfolioType, currentUserId]);

  const handleDropSelect = (asset) => {
    if (!isWindowOpen || swapsRemaining === 0) return;
    setSelectedDrop(asset);
    setSelectedCategory(asset.category);
    setSelectedAdd(null);
  };

  const handleAddSelect = (asset) => {
    if (!selectedDrop) {
      alert('First select an asset to drop from your roster');
      return;
    }
    if (asset.category !== selectedDrop.category) {
      alert(`Must select a ${selectedDrop.category} free agent`);
      return;
    }
    setSelectedAdd(asset);
    setShowConfirmModal(true);
  };

  const handleConfirmSwap = async () => {
    if (!selectedDrop || !selectedAdd || swapping) return;

    setSwapping(true);
    try {
      const freeAgencyService = await import('../services/freeAgencyService');
      const result = await freeAgencyService.executeSwap(
        currentDraft.id,
        currentUserId,
        selectedDrop.symbol,
        selectedAdd.symbol
      );

      if (result.success) {
        // Refresh data
        const agents = await freeAgencyService.getFreeAgents(currentDraft.id);
        setFreeAgents(agents);

        const roster = await freeAgencyService.getPlayerRoster(currentDraft.id, currentUserId);
        setPlayerRoster(roster);

        setSwapsRemaining(result.swapsRemaining);

        const history = await freeAgencyService.getSwapHistory(currentDraft.id);
        setSwapHistory(history);

        setSelectedDrop(null);
        setSelectedAdd(null);
        setShowConfirmModal(false);

        alert(`Swapped ${selectedDrop.symbol} for ${selectedAdd.symbol}!`);
      } else {
        alert(`Swap failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Swap failed: ${error.message}`);
    }
    setSwapping(false);
  };

  const categoryColors = {
    steady: '#10b981',
    risky: '#f59e0b',
    defensive: '#3b82f6'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: '#0d1117',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #21262d',
              borderTop: '4px solid #8b5cf6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <div style={{ color: '#8b949e' }}>Loading free agency...</div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '16px'
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={() => setScreen('draftResults')}
              style={{
                color: '#00d9ff',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
              🔄 Free Agency
            </h1>
            <div style={{ width: '60px' }}></div>
          </div>
        </div>

        {/* Window Status Banner */}
        <div style={{
          background: isWindowOpen
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          padding: '16px',
          textAlign: 'center'
        }}>
          {isWindowOpen ? (
            <>
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>
                🟢 FREE AGENCY OPEN
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>
                Closes in {timeInfo?.hours}h {timeInfo?.minutes}m • {swapsRemaining} swaps remaining today
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>
                🔴 FREE AGENCY CLOSED
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' }}>
                Opens in {timeInfo?.hours}h {timeInfo?.minutes}m
                {portfolioType === 'stocks' ? ' (3 PM CT)' : ' (6 PM CT)'}
              </div>
            </>
          )}
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
          {/* YOUR ROSTER Section */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
              📋 YOUR ROSTER - Tap to drop
            </h2>

            {['steady', 'risky', 'defensive'].map(category => (
              <div key={category} style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: categoryColors[category]
                  }} />
                  <span style={{
                    color: categoryColors[category],
                    fontWeight: '600',
                    fontSize: '13px',
                    textTransform: 'capitalize'
                  }}>
                    {category}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {playerRoster[category]?.map(asset => (
                    <button
                      key={asset.symbol}
                      onClick={() => handleDropSelect(asset)}
                      disabled={!isWindowOpen || swapsRemaining === 0}
                      style={{
                        flex: 1,
                        padding: '12px 8px',
                        background: selectedDrop?.symbol === asset.symbol
                          ? 'rgba(239, 68, 68, 0.2)'
                          : '#161b22',
                        border: selectedDrop?.symbol === asset.symbol
                          ? '2px solid #ef4444'
                          : `1px solid ${categoryColors[category]}`,
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: isWindowOpen && swapsRemaining > 0 ? 'pointer' : 'not-allowed',
                        opacity: isWindowOpen && swapsRemaining > 0 ? 1 : 0.5
                      }}
                    >
                      {asset.symbol}
                      {selectedDrop?.symbol === asset.symbol && (
                        <div style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>
                          DROP
                        </div>
                      )}
                    </button>
                  ))}
                  {playerRoster[category]?.length === 0 && (
                    <div style={{ color: '#6e7681', fontSize: '13px', padding: '12px' }}>
                      No picks in this category
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* FREE AGENTS Section */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
              🆓 FREE AGENTS {selectedDrop ? `- Select ${selectedDrop.category}` : ''}
            </h2>

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['steady', 'risky', 'defensive'].map(category => {
                const isSelectedCategory = selectedDrop?.category === category;
                const isDisabled = selectedDrop && !isSelectedCategory;

                return (
                  <button
                    key={category}
                    onClick={() => !selectedDrop && setSelectedCategory(category)}
                    disabled={isDisabled}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: (selectedDrop ? isSelectedCategory : selectedCategory === category)
                        ? `2px solid ${categoryColors[category]}`
                        : '1px solid #21262d',
                      background: (selectedDrop ? isSelectedCategory : selectedCategory === category)
                        ? `${categoryColors[category]}20`
                        : 'transparent',
                      color: isDisabled ? '#6e7681' : categoryColors[category],
                      fontWeight: '600',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.4 : 1
                    }}
                  >
                    {category} ({freeAgents[category]?.length || 0})
                  </button>
                );
              })}
            </div>

            {/* Free Agent Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
              gap: '8px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {(freeAgents[selectedDrop?.category || selectedCategory] || []).map(asset => (
                <button
                  key={asset.symbol}
                  onClick={() => isWindowOpen && selectedDrop && handleAddSelect(asset)}
                  disabled={!isWindowOpen || !selectedDrop}
                  style={{
                    padding: '12px 8px',
                    background: '#161b22',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: isWindowOpen && selectedDrop ? 'pointer' : 'not-allowed',
                    opacity: isWindowOpen && selectedDrop ? 1 : 0.5,
                    textAlign: 'center'
                  }}
                >
                  {asset.symbol}
                  {isWindowOpen && selectedDrop && (
                    <div style={{
                      color: '#10b981',
                      fontSize: '10px',
                      marginTop: '4px',
                      fontWeight: 'bold'
                    }}>
                      + ADD
                    </div>
                  )}
                </button>
              ))}
              {(freeAgents[selectedDrop?.category || selectedCategory] || []).length === 0 && (
                <div style={{
                  gridColumn: 'span 3',
                  color: '#6e7681',
                  textAlign: 'center',
                  padding: '24px'
                }}>
                  No free agents in this category
                </div>
              )}
            </div>
          </div>

          {/* SWAP HISTORY Section */}
          {swapHistory.length > 0 && (
            <div>
              <h2 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                📜 SWAP HISTORY
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {swapHistory.slice(0, 10).map((swap, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#161b22',
                      border: '1px solid #21262d',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '12px' }}>
                        {swap.displayName}
                      </span>
                      <div style={{ color: '#ffffff', fontSize: '14px', marginTop: '2px' }}>
                        <span style={{ color: '#ef4444' }}>-{swap.droppedAsset.symbol}</span>
                        {' → '}
                        <span style={{ color: '#10b981' }}>+{swap.addedAsset.symbol}</span>
                      </div>
                    </div>
                    <div style={{ color: '#6e7681', fontSize: '11px', textAlign: 'right' }}>
                      {new Date(swap.timestamp).toLocaleDateString()}
                      <br />
                      {new Date(swap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirm Swap Modal */}
        {showConfirmModal && selectedDrop && selectedAdd && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000
          }}>
            <div style={{
              background: '#161b22',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid #21262d'
            }}>
              <h3 style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center' }}>
                Confirm Swap?
              </h3>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    padding: '16px 24px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '2px solid #ef4444',
                    borderRadius: '12px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '4px' }}>DROP</div>
                    <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                      {selectedDrop.symbol}
                    </div>
                  </div>
                </div>

                <div style={{ color: '#8b949e', fontSize: '24px' }}>→</div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    padding: '16px 24px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '2px solid #10b981',
                    borderRadius: '12px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ color: '#10b981', fontSize: '11px', marginBottom: '4px' }}>ADD</div>
                    <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '18px' }}>
                      {selectedAdd.symbol}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', marginBottom: '24px' }}>
                This will use 1 of your {swapsRemaining} remaining swaps today.
                {portfolioType === 'stocks'
                  ? " Price will be locked at today's closing price."
                  : ' Price will be locked at current market price.'}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedAdd(null);
                  }}
                  disabled={swapping}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'transparent',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    color: '#8b949e',
                    fontWeight: '600',
                    cursor: swapping ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwap}
                  disabled={swapping}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: swapping
                      ? '#6e7681'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    cursor: swapping ? 'not-allowed' : 'pointer'
                  }}
                >
                  {swapping ? 'Swapping...' : 'Confirm Swap'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FreeAgencyScreen;
