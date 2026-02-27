import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS } from '../../constants/holoTheme';
import AssetTile from './AssetTile';
import AssetResearchModal from './AssetResearchModal';
import { buildResearchAsset } from '../../utils/researchAssetBuilder';
import { UserIcon, TrophyIcon, SwapIcon, ScoutIcon, FireIcon, SnowflakeIcon, HoloIconAnimations } from './HoloIcons';

// Panel state constants for draggable bottom sheet
const PANEL_STATES = {
  COLLAPSED: 'collapsed',   // Only header visible
  PARTIAL: 'partial',       // Default - header + 2x2/3x3 grid
  EXPANDED: 'expanded',     // Full screen - all cards enlarged
};

/**
 * CommandConsole - Fixed bottom HUD for Draft Battle
 *
 * Displays user's 3x3 portfolio grid, best/worst assets,
 * and action buttons. In scout mode, shows opponent's portfolio
 * with comparison analysis.
 *
 * BaggerBomb Scoring Update: Shows total points, BaggerBombs (💣) and Busts (📉).
 * Phase 5.5: Compacted layout for more Altitude Map visibility
 */
const CommandConsole = ({
  userStanding,       // Current user's standing object with portfolio
  scoutedPlayer,      // Opponent being scouted (null if not scouting)
  isScoutMode,
  onExitScout,
  onFreeAgency,
  onTopPerformers,    // NEW - replaces onViewAll
}) => {
  // Mobile detection for responsive grid
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draggable panel state
  const [panelState, setPanelState] = useState(PANEL_STATES.PARTIAL);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);

  // Height configuration for each panel state
  const getHeightConfig = useCallback(() => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      collapsed: 60,
      partial: isMobile ? vh * 0.32 : vh * 0.38,
      expanded: vh * 0.85,
    };
  }, [isMobile]);

  // Get clientY from touch or mouse event
  const getClientY = (e) => {
    if (e.touches && e.touches.length > 0) {
      return e.touches[0].clientY;
    }
    return e.clientY;
  };

  // Handle drag start (touch or mouse)
  const handleDragStart = useCallback((e) => {
    if (e.type === 'mousedown') {
      e.preventDefault();
    }
    setIsDragging(true);
    setDragStartY(getClientY(e));
    setDragDeltaY(0);
  }, []);

  // Handle drag move
  const handleDragMove = useCallback((e) => {
    if (!isDragging || dragStartY === null) return;

    const currentY = getClientY(e);
    const delta = dragStartY - currentY; // Positive = dragging up

    const heightConfig = getHeightConfig();
    const currentHeight = heightConfig[panelState];
    const maxUpDelta = heightConfig.expanded - currentHeight;
    const maxDownDelta = currentHeight - heightConfig.collapsed;

    const clampedDelta = Math.max(-maxDownDelta, Math.min(delta, maxUpDelta));
    setDragDeltaY(clampedDelta);
  }, [isDragging, dragStartY, panelState, getHeightConfig]);

  // Handle drag end - determine snap target
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const heightConfig = getHeightConfig();
    const currentHeight = heightConfig[panelState];
    const newHeight = currentHeight + dragDeltaY;

    // Calculate 30% thresholds
    const collapsedThreshold = heightConfig.collapsed +
      (heightConfig.partial - heightConfig.collapsed) * 0.3;
    const expandedThreshold = heightConfig.partial +
      (heightConfig.expanded - heightConfig.partial) * 0.3;

    let newState = panelState;

    if (panelState === PANEL_STATES.PARTIAL) {
      if (newHeight < collapsedThreshold) {
        newState = PANEL_STATES.COLLAPSED;
      } else if (newHeight > expandedThreshold) {
        newState = PANEL_STATES.EXPANDED;
      }
    } else if (panelState === PANEL_STATES.COLLAPSED) {
      if (newHeight > collapsedThreshold) {
        newState = newHeight > expandedThreshold ? PANEL_STATES.EXPANDED : PANEL_STATES.PARTIAL;
      }
    } else if (panelState === PANEL_STATES.EXPANDED) {
      if (newHeight < expandedThreshold) {
        newState = newHeight < collapsedThreshold ? PANEL_STATES.COLLAPSED : PANEL_STATES.PARTIAL;
      }
    }

    setPanelState(newState);
    setIsDragging(false);
    setDragStartY(null);
    setDragDeltaY(0);
  }, [isDragging, dragDeltaY, panelState, getHeightConfig]);

  // Global mouse event listeners for desktop drag
  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e) => handleDragMove(e);
      const handleMouseUp = () => handleDragEnd();

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Calculate current height including drag offset
  const getCurrentHeight = useMemo(() => {
    const heightConfig = getHeightConfig();
    const baseHeight = heightConfig[panelState];

    if (isDragging) {
      return Math.max(heightConfig.collapsed,
                      Math.min(baseHeight + dragDeltaY, heightConfig.expanded));
    }

    return baseHeight;
  }, [panelState, isDragging, dragDeltaY, getHeightConfig]);

  // State for grid flip animation
  const [isFlipping, setIsFlipping] = useState(false);
  const [prevScoutMode, setPrevScoutMode] = useState(isScoutMode);

  // State for asset research modal
  const [selectedAssetForResearch, setSelectedAssetForResearch] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null); // Track which button is hovered

  // Trigger flip animation when scout mode changes
  useEffect(() => {
    if (isScoutMode !== prevScoutMode) {
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setIsFlipping(false);
        setPrevScoutMode(isScoutMode);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isScoutMode, prevScoutMode]);

  // Determine which portfolio to display
  const displayPlayer = isScoutMode ? scoutedPlayer : userStanding;
  const portfolio = displayPlayer?.portfolio || [];

  // Get best and worst assets
  const bestAsset = displayPlayer?.bestAsset;
  const worstAsset = displayPlayer?.worstAsset;

  // Calculate comparison data for scout mode
  const getComparisonData = (asset) => {
    if (!isScoutMode || !userStanding || !asset) return null;

    const userOwnsAsset = userStanding.portfolio?.some(a => a.symbol === asset.symbol);
    const userBestGain = userStanding.bestAsset?.gain || 0;

    return {
      isLinked: userOwnsAsset,
      isThreat: !userOwnsAsset && asset.gain > userBestGain + 5,
      isSectorRival: asset.category === userStanding.bestAsset?.category && !userOwnsAsset,
      deltaVsYourBest: asset.gain - userBestGain,
    };
  };

  // Scout mode summary stats - Updated for BaggerBomb scoring
  const scoutSummary = useMemo(() => {
    if (!isScoutMode || !scoutedPlayer || !userStanding) return null;

    const theirPoints = scoutedPlayer.totalPoints || 0;
    const yourPoints = userStanding.totalPoints || 0;
    const theirBaggerBombs = scoutedPlayer.totalBaggerBombs || 0;
    const yourBaggerBombs = userStanding.totalBaggerBombs || 0;
    const sharedAssets = scoutedPlayer.portfolio?.filter(a =>
      userStanding.portfolio?.some(ua => ua.symbol === a.symbol)
    ).length || 0;

    return {
      theirPoints,
      yourPoints,
      pointGap: Math.abs(theirPoints - yourPoints),
      theirBaggerBombs,
      yourBaggerBombs,
      sharedAssets,
      youLead: yourPoints > theirPoints,
    };
  }, [isScoutMode, scoutedPlayer, userStanding]);

  // Grid configuration based on panel state
  const getGridConfig = useCallback(() => {
    if (panelState === PANEL_STATES.COLLAPSED) {
      return null;
    }

    if (panelState === PANEL_STATES.EXPANDED) {
      return {
        columns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '12px' : '10px',
        expanded: true,
        showAll: true,
      };
    }

    // Partial state (default)
    return {
      columns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
      gap: isMobile ? '8px' : '6px',
      expanded: false,
      showAll: false,
    };
  }, [panelState, isMobile]);

  const gridConfig = getGridConfig();
  const isCollapsed = panelState === PANEL_STATES.COLLAPSED;
  const isExpanded = panelState === PANEL_STATES.EXPANDED;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: getCurrentHeight,
      display: 'flex',
      flexDirection: 'column',
      background: isScoutMode
        ? 'linear-gradient(to top, rgba(245, 158, 11, 0.1) 0%, rgba(10, 14, 20, 0.98) 100%)'
        : 'linear-gradient(to top, rgba(0, 255, 255, 0.08) 0%, rgba(10, 14, 20, 0.98) 100%)',
      backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan}`,
      boxShadow: isScoutMode
        ? '0 -4px 30px rgba(245, 158, 11, 0.15)'
        : '0 -4px 30px rgba(0, 255, 255, 0.15)',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 50,
      userSelect: isDragging ? 'none' : 'auto',
      overflow: 'hidden',
    }}>
      {/* DRAG HANDLE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px 0 16px',
          minHeight: '48px',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          flexShrink: 0,
        }}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
      >
        <div style={{
          width: '40px',
          height: '4px',
          borderRadius: '2px',
          background: isScoutMode
            ? `${HOLO_COLORS.amber}80`
            : `${HOLO_COLORS.cyan}80`,
          transition: 'all 0.2s ease',
          boxShadow: isDragging
            ? (isScoutMode ? `0 0 8px ${HOLO_COLORS.amber}` : `0 0 8px ${HOLO_COLORS.cyan}`)
            : 'none',
        }} />
      </div>

      {/* COMPACT HEADER with inline Best/Worst */}
      <div style={{
        flexShrink: 0,
        padding: isCollapsed ? '0 12px 4px' : '0 12px 8px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isScoutMode ? '6px 10px' : '0',
          background: isScoutMode ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
          borderRadius: '6px',
          border: isScoutMode ? `1px solid ${HOLO_COLORS.amber}44` : 'none',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            color: isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            {isScoutMode ? (
              <>
                <ScoutIcon size={16} animated />
                <span style={{ marginLeft: '2px' }}>SCOUTING: {scoutedPlayer?.displayName}</span>
              </>
            ) : (
              <>
                <UserIcon size={14} />
                <span style={{ marginLeft: '2px' }}>YOUR SQUAD</span>
              </>
            )}
          </div>

          {/* Show opponent's rank when scouting */}
          {isScoutMode && scoutedPlayer && (
            <div style={{
              background: HOLO_COLORS.bgCard,
              padding: '3px 8px',
              borderRadius: '4px',
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              fontSize: '10px',
            }}>
              <span style={{ color: HOLO_COLORS.textMuted }}>RANK</span>
              <span style={{
                fontWeight: 700,
                color: HOLO_COLORS.textPrimary,
                marginLeft: '4px',
              }}>
                #{scoutedPlayer.currentRank}
              </span>
            </div>
          )}

          {/* INLINE BaggerBomb Stats + Best/Worst (only when not scouting OR collapsed) */}
          {(!isScoutMode || isCollapsed) && displayPlayer && (
            <div style={{
              display: 'flex',
              gap: isCollapsed ? '8px' : '10px',
              fontSize: '10px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              {/* Total Points */}
              <span style={{
                background: HOLO_COLORS.bgCard,
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                color: (displayPlayer.totalPoints || 0) >= 0 ? HOLO_COLORS.green : HOLO_COLORS.red,
              }}>
                {(displayPlayer.totalPoints || 0) >= 0 ? '+' : ''}{(displayPlayer.totalPoints || 0).toFixed(0)} pts
              </span>
              {/* BaggerBombs Count */}
              {displayPlayer.totalBaggerBombs > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: HOLO_COLORS.green }}>
                  <span style={{ textShadow: '0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 255, 170, 0.4)' }}>💣</span>
                  {displayPlayer.totalBaggerBombs}
                </span>
              )}
              {/* Busts Count */}
              {displayPlayer.totalBusts > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: HOLO_COLORS.red }}>
                  <span style={{ textShadow: '0 0 8px rgba(255, 100, 100, 0.8), 0 0 16px rgba(255, 100, 100, 0.4)' }}>📉</span>
                  {displayPlayer.totalBusts}
                </span>
              )}
              {/* Best Asset */}
              {bestAsset && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <FireIcon size={12} />
                  <span style={{ color: HOLO_COLORS.green, fontWeight: 600 }}>
                    {bestAsset.symbol} +{(bestAsset.totalScore || bestAsset.gain || 0).toFixed(0)}
                  </span>
                </span>
              )}
              {/* Expand hint when collapsed */}
              {isCollapsed && (
                <span style={{
                  color: isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan,
                  opacity: 0.6,
                  marginLeft: 'auto',
                  fontSize: '9px',
                }}>
                  ↑ Expand
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SCROLLABLE Portfolio Grid Area - Hidden when collapsed */}
      {!isCollapsed && gridConfig && (
        <div style={{
          flex: isExpanded ? 1 : '0 1 auto',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 12px',
          minHeight: 0,
        }}>
          {/* Responsive Portfolio Grid - columns based on panel state */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: gridConfig.columns,
            gap: gridConfig.gap,
            perspective: '1000px',
          }}>
            <div style={{
              display: 'contents',
              transform: isFlipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
              transition: 'transform 0.15s ease-in-out',
            }}>
              {portfolio.slice(0, gridConfig.showAll ? 9 : 9).map((asset, idx) => (
                <div
                  key={asset?.symbol || idx}
                  onClick={() => {
                    if (asset?.symbol) {
                      setSelectedAssetForResearch({
                        ...asset,
                        isOpponentAsset: isScoutMode,
                      });
                    }
                  }}
                  style={{
                    opacity: isFlipping ? 0.5 : 1,
                    transform: isFlipping ? 'scale(0.95)' : 'scale(1)',
                    transition: 'all 0.15s ease-in-out',
                    cursor: asset?.symbol ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                >
                  <AssetTile
                    asset={asset}
                    isScoutMode={isScoutMode}
                    comparisonData={getComparisonData(asset)}
                    compact={!isExpanded}
                    expanded={isExpanded}
                    isMobile={isMobile}
                  />
                  {/* Tap hint for filled slots (hide in expanded) */}
                  {asset?.symbol && !isExpanded && (
                    <div style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '4px',
                      fontSize: '7px',
                      color: isScoutMode ? HOLO_COLORS.amber : HOLO_COLORS.cyan,
                      opacity: 0.5,
                      pointerEvents: 'none',
                    }}>
                      tap
                    </div>
                  )}
                </div>
              ))}
              {/* Fill empty slots if less than 9 assets */}
              {portfolio.length < 9 && [...Array(9 - Math.max(0, portfolio.length))].map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  style={{
                    opacity: isFlipping ? 0.5 : 1,
                    transform: isFlipping ? 'scale(0.95)' : 'scale(1)',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <AssetTile
                    asset={null}
                    compact={!isExpanded}
                    expanded={isExpanded}
                    isMobile={isMobile}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Scout Mode Summary - BaggerBomb points comparison */}
          {isScoutMode && scoutSummary && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 10px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '6px',
              marginBottom: '4px',
              fontSize: '10px',
              flexWrap: 'wrap',
              gap: '6px',
            }}>
              <span style={{ color: HOLO_COLORS.textSecondary }}>
                Them: <span style={{ color: HOLO_COLORS.amber, fontWeight: 600 }}>
                  {scoutSummary.theirPoints >= 0 ? '+' : ''}{scoutSummary.theirPoints.toFixed(0)} pts
                </span>
                {scoutSummary.theirBaggerBombs > 0 && (
                  <span style={{ marginLeft: '4px' }}>
                    <span style={{ textShadow: '0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 255, 170, 0.4)' }}>💣</span>
                    {scoutSummary.theirBaggerBombs}
                  </span>
                )}
              </span>
              <span style={{ color: HOLO_COLORS.textSecondary }}>
                You: <span style={{ color: HOLO_COLORS.cyan, fontWeight: 600 }}>
                  {scoutSummary.yourPoints >= 0 ? '+' : ''}{scoutSummary.yourPoints.toFixed(0)} pts
                </span>
                {scoutSummary.yourBaggerBombs > 0 && (
                  <span style={{ marginLeft: '4px' }}>
                    <span style={{ textShadow: '0 0 8px rgba(0, 255, 170, 0.8), 0 0 16px rgba(0, 255, 170, 0.4)' }}>💣</span>
                    {scoutSummary.yourBaggerBombs}
                  </span>
                )}
              </span>
              <span style={{
                color: scoutSummary.youLead ? HOLO_COLORS.green : HOLO_COLORS.red,
                fontWeight: 700,
              }}>
                Gap: {scoutSummary.pointGap.toFixed(0)} pts
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons - FIXED at bottom - Hidden when collapsed */}
      {!isCollapsed && (
        <div style={{
          flexShrink: 0,
          padding: '6px 12px',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          borderTop: `1px solid ${HOLO_COLORS.borderSubtle}33`,
          background: 'rgba(10, 14, 20, 0.5)',
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
          {isScoutMode ? (
            <button
              onClick={onExitScout}
              style={{
                flex: 1,
                padding: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${HOLO_COLORS.amber}`,
                borderRadius: '8px',
                color: HOLO_COLORS.amber,
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              ✕ EXIT SCOUT
            </button>
          ) : (
            <>
              {/* Free Agency Button - Cyan holographic theme */}
              <button
                onClick={onFreeAgency}
                onMouseEnter={() => setHoveredButton('freeAgency')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.2) 0%, rgba(0, 217, 255, 0.05) 100%)',
                  border: '1px solid rgba(0, 217, 255, 0.5)',
                  boxShadow: hoveredButton === 'freeAgency'
                    ? '0 0 30px rgba(0, 217, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : '0 0 20px rgba(0, 217, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#00d9ff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(8px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transform: hoveredButton === 'freeAgency' ? 'translateY(-1px)' : 'none',
                }}
              >
                <SwapIcon size={16} />
                <span>Free Agency</span>
              </button>
              {/* Top Performers Button - Gold/amber holographic theme */}
              <button
                onClick={onTopPerformers}
                onMouseEnter={() => setHoveredButton('topPerformers')}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.05) 100%)',
                  border: '1px solid rgba(251, 191, 36, 0.5)',
                  boxShadow: hoveredButton === 'topPerformers'
                    ? '0 0 30px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    : '0 0 20px rgba(251, 191, 36, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fbbf24',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(8px)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transform: hoveredButton === 'topPerformers' ? 'translateY(-1px)' : 'none',
                }}
              >
                <TrophyIcon size={16} />
                <span>Top Performers</span>
              </button>
            </>
          )}
          </div>
        </div>
      )}

      {/* Pulse animation and HoloIcon animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        ${HoloIconAnimations}
      `}</style>

      {/* Asset Research Modal */}
      {selectedAssetForResearch && (() => {
        const prevClose = selectedAssetForResearch.previousClose;
        const curPrice = selectedAssetForResearch.currentPrice;
        const dailyChange = (prevClose && prevClose > 0 && curPrice)
          ? ((curPrice - prevClose) / prevClose) * 100
          : undefined;
        return (
        <AssetResearchModal
          asset={buildResearchAsset(selectedAssetForResearch, {
            percentChange: dailyChange,
          })}
          sector={selectedAssetForResearch.sector}
          category={selectedAssetForResearch.category}
          onClose={() => setSelectedAssetForResearch(null)}
          showActionButton={true}
          actionConfig={null}
          version={2}
        />
        );
      })()}
    </div>
  );
};

export default CommandConsole;
