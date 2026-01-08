// /src/screens/ResearchScreen.jsx

import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Star,
  BarChart2,
  Grid,
  List,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Sparkles,
  Target,
  FileText,
  Loader2,
  Brain
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';

/**
 * ResearchScreen - Full-screen research modal
 *
 * This is rendered as an overlay when showResearchMode is true.
 * Supports both "guided" (ResearchFlow) and "classic" (browse) modes.
 *
 * @param {Object} props
 * @param {Function} props.onClose - Handler to close the research modal
 * @param {Function} props.onAddToPortfolio - Handler to add asset to portfolio
 * @param {Array} props.stocksData - Array of stock data
 * @param {Array} props.cryptoData - Array of crypto data
 * @param {Object} props.colors - Design tokens
 * @param {Object} props.containerStyle - Container style from App
 * @param {string} props.researchViewMode - Current view mode ('guided' or 'classic')
 * @param {Function} props.setResearchViewMode - Handler to change view mode
 * @param {string} props.researchActiveTab - Current active tab ('stocks', 'crypto', 'notes', 'advisor')
 * @param {Function} props.setResearchActiveTab - Handler to change active tab
 * @param {string} props.researchSearchTerm - Current search term
 * @param {Function} props.setResearchSearchTerm - Handler to change search term
 * @param {Object} props.selectedAssetDetail - Currently selected asset for detail view
 * @param {Function} props.setSelectedAssetDetail - Handler to set selected asset
 * @param {string} props.selectedAssetType - Type of selected asset ('stock' or 'crypto')
 * @param {Function} props.setSelectedAssetType - Handler to set asset type
 * @param {Object} props.stockFundamentals - Stock fundamentals data cache
 * @param {Object} props.cryptoMetrics - Crypto metrics data cache
 * @param {Object} props.fundamentalsLoading - Loading state for fundamentals
 * @param {Object} props.cryptoMetricsLoading - Loading state for crypto metrics
 * @param {Function} props.fetchStockFundamentals - Handler to fetch stock data
 * @param {Function} props.fetchCryptoMetrics - Handler to fetch crypto data
 * @param {Array} props.userNotes - User's research notes
 * @param {Function} props.setUserNotes - Handler to update notes
 * @param {Function} props.handleClipNote - Handler to clip a note
 * @param {Function} props.handleAddCustomNote - Handler to add custom note
 * @param {Function} props.handleDeleteNote - Handler to delete note
 * @param {string} props.customNoteText - Custom note text input
 * @param {Function} props.setCustomNoteText - Handler to update custom note text
 * @param {Object} props.showMoreDepth - More depth visibility state
 * @param {Function} props.toggleMoreDepth - Handler to toggle more depth
 * @param {string} props.researchPhase - Current research phase
 * @param {Function} props.setResearchPhase - Handler to set research phase
 * @param {Object} props.researchThesis - Current research thesis
 * @param {Function} props.setResearchThesis - Handler to set thesis
 * @param {Object} props.convictionData - Conviction check data
 * @param {Function} props.setConvictionData - Handler to set conviction data
 * @param {Object} props.researchGamePlan - Generated game plan
 * @param {Function} props.setResearchGamePlan - Handler to set game plan
 * @param {boolean} props.researchGamePlanLoading - Game plan loading state
 * @param {Function} props.setResearchGamePlanLoading - Handler for loading state
 * @param {Function} props.handleConvictionComplete - Handler when conviction check completes
 * @param {Function} props.handleStartConvictionCheck - Handler to start conviction check
 * @param {Function} props.handleUseResearchPortfolio - Handler to use portfolio
 * @param {Function} props.handleStartTrainingBattle - Handler to start training battle
 * @param {Function} props.handleSaveAsTemplate - Handler to save as template
 * @param {Function} props.handleBackFromGamePlan - Handler to go back from game plan
 * @param {Function} props.handleBackFromConviction - Handler to go back from conviction
 * @param {Function} props.getCurrentWeekMonday - Helper to get current week Monday
 * @param {Object} props.RESEARCH_REQUIREMENTS - Research requirements config
 * @param {Function} props.getSectorColor - Helper to get sector color
 * @param {Function} props.getStockSector - Helper to get stock sector
 * @param {Function} props.enrichAllAssetsWithResearch - Helper to enrich assets
 * @param {Object} props.stockMetricExplanations - Stock metric explanations
 * @param {Object} props.cryptoMetricExplanations - Crypto metric explanations
 * @param {Function} props.safeNumber - Helper for safe number handling
 * @param {Function} props.getSectorColors - Helper to get sector colors
 * @param {Function} props.showToast - Toast notification handler
 * @param {React.Component} props.ResearchFlow - ResearchFlow component
 * @param {React.Component} props.EarningsInsights - EarningsInsights component
 */
const ResearchScreen = ({
  onClose,
  onAddToPortfolio,
  stocksData = [],
  cryptoData = [],
  colors,
  containerStyle,
  researchViewMode,
  setResearchViewMode,
  researchActiveTab,
  setResearchActiveTab,
  researchSearchTerm,
  setResearchSearchTerm,
  selectedAssetDetail,
  setSelectedAssetDetail,
  selectedAssetType,
  setSelectedAssetType,
  stockFundamentals,
  cryptoMetrics,
  fundamentalsLoading,
  cryptoMetricsLoading,
  fetchStockFundamentals,
  fetchCryptoMetrics,
  userNotes,
  setUserNotes,
  handleClipNote,
  handleAddCustomNote,
  handleDeleteNote,
  customNoteText,
  setCustomNoteText,
  showMoreDepth,
  toggleMoreDepth,
  researchPhase,
  setResearchPhase,
  researchThesis,
  setResearchThesis,
  convictionData,
  setConvictionData,
  researchGamePlan,
  setResearchGamePlan,
  researchGamePlanLoading,
  setResearchGamePlanLoading,
  handleConvictionComplete,
  handleStartConvictionCheck,
  handleUseResearchPortfolio,
  handleStartTrainingBattle,
  handleSaveAsTemplate,
  handleBackFromGamePlan,
  handleBackFromConviction,
  getCurrentWeekMonday,
  RESEARCH_REQUIREMENTS,
  getSectorColor,
  getStockSector,
  enrichAllAssetsWithResearch,
  stockMetricExplanations,
  cryptoMetricExplanations,
  safeNumber,
  getSectorColors,
  showToast,
  ResearchFlow,
  EarningsInsights,
  // Draft ranker props
  draftRankerPhase,
  setDraftRankerPhase,
  draftStrategy,
  setDraftStrategy,
  tier1Picks,
  setTier1Picks,
  tier2Picks,
  setTier2Picks,
  handleDraftRankerComplete,
  // Asset picker props
  showAssetPicker,
  setShowAssetPicker,
  assetPickerType,
  setAssetPickerType,
  handleOpenAssetPicker,
  handleAssetPickerSelect,
  // Game plan handlers
  gamePlanLoading,
  setGamePlanLoading,
  gamePlanResponse,
  setGamePlanResponse,
  handleGenerateGamePlan,
  handlePinAINote,
  // Portfolio handlers
  setPortfolio,
  setPortfolioType,
  setScreen,
  // Training battle creation
  createTrainingBattle,
  loadBattlesSafe,
  saveBattlesSafe,
  setBattles,
  user
}) => {
  // Crypto color constant
  const cryptoColor = '#f59e0b';

  // Handler to use portfolio from ResearchFlow
  const handleUseResearchFlowPortfolio = useCallback((portfolioAllocations) => {
    // Convert allocations to portfolio format
    const allAssets = [...stocksData, ...cryptoData];
    const newPortfolio = portfolioAllocations.map(allocation => {
      const asset = allAssets.find(a => a.symbol === allocation.symbol);
      if (!asset) return null;
      return {
        symbol: allocation.symbol,
        name: asset.name,
        price: asset.price,
        amount: (allocation.allocation / 100) * 1000000,
      };
    }).filter(Boolean);

    setPortfolio?.(newPortfolio);
    setPortfolioType?.(newPortfolio.some(p => cryptoData.find(c => c.symbol === p.symbol)) ? 'crypto' : 'stocks');
    onClose();
    setScreen?.('portfolio');
  }, [stocksData, cryptoData, setPortfolio, setPortfolioType, onClose, setScreen]);

  // GUIDED RESEARCH FLOW MODE
  if (researchViewMode === 'guided' && ResearchFlow) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#0d1117',
        zIndex: 1000,
        overflow: 'auto',
      }}>
        {/* Header with back and mode toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #2d3548',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.cyan,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ← Exit Research
          </button>
          <button
            onClick={() => setResearchViewMode('classic')}
            style={{
              background: 'rgba(139, 148, 158, 0.1)',
              border: '1px solid #2d3548',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#8b949e',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Classic View
          </button>
        </div>

        {/* ResearchFlow Component */}
        <ResearchFlow
          stocksData={stocksData}
          cryptoData={cryptoData}
          onUsePortfolio={handleUseResearchFlowPortfolio}
          onClose={onClose}
          colors={colors}
          user={user}
        />
      </div>
    );
  }

  // Enrich assets with research data
  const { stocks: enrichedStocks, crypto: enrichedCrypto } = enrichAllAssetsWithResearch?.(stocksData, cryptoData) || { stocks: stocksData, crypto: cryptoData };

  // Get assets based on current tab
  const currentAssets = researchActiveTab === 'stocks' ? enrichedStocks :
                        researchActiveTab === 'crypto' ? enrichedCrypto : [];

  // Filter by search term
  const filteredAssets = currentAssets.filter(asset =>
    asset.symbol?.toLowerCase().includes((researchSearchTerm || '').toLowerCase()) ||
    asset.name?.toLowerCase().includes((researchSearchTerm || '').toLowerCase())
  );

  // Sort assets by 30-day momentum + market cap
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    const momentumDiff = (b.priceChange30d || 0) - (a.priceChange30d || 0);
    if (Math.abs(momentumDiff) > 5) return momentumDiff;
    return (a.categoryRank7d || 999) - (b.categoryRank7d || 999);
  });

  // Sparkline component for research cards
  const ResearchSparkline = ({ prices, width = 100, height = 40 }) => {
    if (!prices || prices.length < 2) return null;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const points = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((price - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    const isPositive = prices[prices.length - 1] >= prices[0];
    const color = isPositive ? '#10b981' : '#ef4444';

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`spark-grad-${isPositive}-${width}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#spark-grad-${isPositive}-${width})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Handle opening asset detail
  const handleOpenDetail = (asset, type) => {
    setSelectedAssetDetail(asset);
    setSelectedAssetType(type);

    // Fetch data based on type
    if (type === 'stock') {
      fetchStockFundamentals?.(asset.symbol);
    } else {
      fetchCryptoMetrics?.(asset.symbol);
    }
  };

  // Calculate weekly progress
  const currentWeekNotes = userNotes?.filter(n => n.weekOf === getCurrentWeekMonday?.()) || [];
  const assetsWithNotes = [...new Set(currentWeekNotes.map(n => n.symbol))];
  const progressPercent = Math.min(100, (currentWeekNotes.length / (RESEARCH_REQUIREMENTS?.minimumNotes || 5)) * 100);
  const canFinalize = currentWeekNotes.length >= (RESEARCH_REQUIREMENTS?.minimumNotes || 5) &&
                      assetsWithNotes.length >= (RESEARCH_REQUIREMENTS?.minimumAssets || 3);

  // ASSET DETAIL PAGE
  if (selectedAssetDetail) {
    const isStock = selectedAssetType === 'stock';
    const fundamentals = isStock ? stockFundamentals?.[selectedAssetDetail.symbol] : null;
    const metrics = !isStock ? cryptoMetrics?.[selectedAssetDetail.symbol] : null;
    const isLoading = isStock ? fundamentalsLoading?.[selectedAssetDetail.symbol] : cryptoMetricsLoading?.[selectedAssetDetail.symbol];
    const color = isStock ? getSectorColor?.(selectedAssetDetail.sector || getStockSector?.(selectedAssetDetail.symbol) || 'Unknown') : cryptoColor;

    // Metric card component
    const MetricCard = ({ title, value, subValue, metricKey, explanationFn, moreDepth, valueColor }) => (
      <div style={{
        background: '#0d1117',
        borderRadius: '12px',
        border: '1px solid #21262d',
        padding: '16px',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span style={{ color: '#8b949e', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{title}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleClipNote?.(title, value, explanationFn, selectedAssetDetail.symbol, selectedAssetType)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6e7681',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '14px'
              }}
              title="Save to notes"
            >
              📌
            </button>
            <button
              onClick={() => toggleMoreDepth?.(metricKey)}
              style={{
                background: showMoreDepth?.[metricKey] ? 'rgba(0, 217, 255, 0.2)' : 'transparent',
                border: 'none',
                color: showMoreDepth?.[metricKey] ? colors.cyan : '#6e7681',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '14px',
                borderRadius: '4px'
              }}
              title="More info"
            >
              ℹ️
            </button>
          </div>
        </div>
        <div style={{ color: valueColor || '#ffffff', fontSize: '24px', fontWeight: 'bold', marginBottom: subValue ? '4px' : '8px' }}>
          {value}
        </div>
        {subValue && (
          <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '8px' }}>{subValue}</div>
        )}
        <div style={{ color: '#e6edf3', fontSize: '13px', lineHeight: '1.5' }}>
          {explanationFn}
        </div>
        {showMoreDepth?.[metricKey] && moreDepth && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(0, 217, 255, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(0, 217, 255, 0.2)',
            color: '#e6edf3',
            fontSize: '12px',
            lineHeight: '1.6',
            whiteSpace: 'pre-line'
          }}>
            {moreDepth}
          </div>
        )}
      </div>
    );

    return (
      <div style={containerStyle}>
        <div style={{ minHeight: '100vh', background: colors.background }}>
          {/* Header */}
          <div style={{
            background: '#161b22',
            borderBottom: '1px solid #21262d',
            padding: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 20
          }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => setSelectedAssetDetail(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: colors.cyan,
                    fontWeight: '600',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  onClick={() => handleClipNote?.('Asset Overview', selectedAssetDetail.symbol, `${selectedAssetDetail.name} - Price: $${selectedAssetDetail.price?.toFixed(2)}`, selectedAssetDetail.symbol, selectedAssetType)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'rgba(0, 217, 255, 0.1)',
                    border: '1px solid rgba(0, 217, 255, 0.3)',
                    borderRadius: '8px',
                    color: colors.cyan,
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  📌 Add to Notes
                </button>
              </div>
            </div>
          </div>

          {/* Asset Header Card */}
          <div style={{ padding: '16px', marginBottom: '0' }}>
            <div style={{
              position: 'relative',
              borderRadius: '20px',
              padding: '3px',
              background: `linear-gradient(135deg, ${color}, ${color}80)`,
              boxShadow: `0 0 20px ${color}60`
            }}>
              <div style={{
                background: 'linear-gradient(145deg, #1a2332 0%, #0d1117 100%)',
                borderRadius: '17px',
                padding: '32px 24px',
                textAlign: 'center'
              }}>
                <h1 style={{
                  color: '#ffffff',
                  fontSize: '42px',
                  fontWeight: '800',
                  margin: '0 0 4px 0',
                  letterSpacing: '3px'
                }}>
                  {selectedAssetDetail.symbol}
                </h1>
                <p style={{
                  color: '#8b949e',
                  fontSize: '14px',
                  margin: '0 0 20px 0',
                  fontWeight: '500'
                }}>
                  {selectedAssetDetail.name}
                </p>
                <div style={{
                  fontSize: '48px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 16px 0'
                }}>
                  ${selectedAssetDetail.price?.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: selectedAssetDetail.price < 1 ? 4 : 2
                  })}
                </div>
                {selectedAssetDetail.percentChange !== undefined && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: (safeNumber?.(selectedAssetDetail.percentChange) || 0) >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${(safeNumber?.(selectedAssetDetail.percentChange) || 0) >= 0 ? '#22c55e' : '#ef4444'}50`,
                    borderRadius: '12px',
                    padding: '10px 20px'
                  }}>
                    <span style={{
                      color: (safeNumber?.(selectedAssetDetail.percentChange) || 0) >= 0 ? '#22c55e' : '#ef4444',
                      fontSize: '18px',
                      fontWeight: '700'
                    }}>
                      {(safeNumber?.(selectedAssetDetail.percentChange) || 0) >= 0 ? '▲' : '▼'}
                      {Math.abs(safeNumber?.(selectedAssetDetail.percentChange) || 0).toFixed(2)}% today
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 16px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <Loader2 className="animate-spin" style={{ width: '32px', height: '32px', margin: '0 auto 12px' }} />
                <p>Loading {isStock ? 'fundamentals' : 'metrics'}...</p>
              </div>
            ) : isStock ? (
              // STOCK METRICS
              <>
                {EarningsInsights && <EarningsInsights symbol={selectedAssetDetail?.symbol} colors={colors} />}

                <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Fundamentals
                </h3>

                {fundamentals?.beta !== undefined && (
                  <MetricCard
                    title="Beta"
                    value={fundamentals.beta?.toFixed(2) || 'N/A'}
                    metricKey="beta"
                    explanationFn={stockMetricExplanations?.beta?.intermediate?.(fundamentals.beta)}
                    moreDepth={stockMetricExplanations?.beta?.moreDepth}
                    valueColor={fundamentals.beta > 1.2 ? colors.red : fundamentals.beta < 0.8 ? colors.green : '#ffffff'}
                  />
                )}

                {fundamentals?.analystConsensus && (
                  <MetricCard
                    title="Analyst Consensus"
                    value={`${fundamentals.analystConsensus.rating?.toFixed(1)} / 5.0`}
                    metricKey="analystConsensus"
                    explanationFn={stockMetricExplanations?.analystConsensus?.intermediate?.(
                      fundamentals.analystConsensus.rating,
                      fundamentals.analystConsensus.totalAnalysts,
                      fundamentals.analystConsensus.buyPercent
                    )}
                    moreDepth={stockMetricExplanations?.analystConsensus?.moreDepth}
                    valueColor={fundamentals.analystConsensus.rating >= 4 ? colors.green : fundamentals.analystConsensus.rating <= 2 ? colors.red : '#ffffff'}
                  />
                )}
              </>
            ) : (
              // CRYPTO METRICS
              <>
                <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Volatility
                </h3>

                <MetricCard
                  title="7-Day Volatility"
                  value={`${metrics?.volatility7d?.toFixed(1) || 0}%`}
                  subValue="Average daily price swing over the past week"
                  metricKey="volatility7d"
                  explanationFn={cryptoMetricExplanations?.volatility7d?.intermediate?.(metrics?.volatility7d)}
                  moreDepth={cryptoMetricExplanations?.volatility7d?.moreDepth}
                  valueColor={metrics?.volatility7d > 5 ? colors.red : metrics?.volatility7d < 3 ? colors.green : '#ffffff'}
                />

                <h3 style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700', marginBottom: '16px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Momentum
                </h3>

                <MetricCard
                  title="7-Day Momentum"
                  value={`${metrics?.momentum7d >= 0 ? '+' : ''}${metrics?.momentum7d?.toFixed(1) || 0}%`}
                  metricKey="cryptoMomentum7d"
                  explanationFn={cryptoMetricExplanations?.momentum7d?.intermediate?.(metrics?.momentum7d)}
                  moreDepth={cryptoMetricExplanations?.momentum7d?.moreDepth}
                  valueColor={metrics?.momentum7d >= 0 ? colors.green : colors.red}
                />
              </>
            )}

            {/* Custom Note Input */}
            <div style={{
              background: '#161b22',
              borderRadius: '12px',
              border: '1px solid #21262d',
              padding: '16px',
              marginTop: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#8b949e', fontSize: '13px' }}>
                ✏️ ADD CUSTOM NOTE
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={customNoteText || ''}
                  onChange={(e) => setCustomNoteText?.(e.target.value)}
                  placeholder="Add your insight about this asset..."
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleAddCustomNote?.(selectedAssetDetail.symbol, selectedAssetType)}
                  disabled={!customNoteText?.trim()}
                  style={{
                    padding: '12px 20px',
                    background: customNoteText?.trim() ? colors.cyan : '#21262d',
                    color: customNoteText?.trim() ? '#000' : '#6e7681',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: customNoteText?.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN RESEARCH MODE VIEW
  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: colors.background }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '1px solid #21262d',
          padding: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => {
                  onClose();
                  setSelectedAssetDetail?.(null);
                  setResearchSearchTerm?.('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: colors.cyan,
                  fontWeight: '600',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain style={{ width: '24px', height: '24px', color: colors.cyan }} />
                Research Mode
              </h1>
              <button
                onClick={() => setResearchViewMode?.('guided')}
                style={{
                  background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ✨ Guided Flow
              </button>
            </div>

            {/* Tab Toggle */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '12px',
              padding: '4px',
              background: '#0d1117',
              borderRadius: '10px'
            }}>
              <button
                onClick={() => setResearchActiveTab?.('stocks')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: researchActiveTab === 'stocks' ? colors.cyan : 'transparent',
                  color: researchActiveTab === 'stocks' ? '#000' : '#8b949e',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Stocks ({stocksData.length})
              </button>
              <button
                onClick={() => setResearchActiveTab?.('crypto')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: researchActiveTab === 'crypto' ? colors.cyan : 'transparent',
                  color: researchActiveTab === 'crypto' ? '#000' : '#8b949e',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Crypto ({cryptoData.length})
              </button>
              <button
                onClick={() => setResearchActiveTab?.('notes')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: researchActiveTab === 'notes' ? colors.cyan : 'transparent',
                  color: researchActiveTab === 'notes' ? '#000' : '#8b949e',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                My Notes {currentWeekNotes.length > 0 && (
                  <span style={{
                    background: researchActiveTab === 'notes' ? '#000' : colors.cyan,
                    color: researchActiveTab === 'notes' ? colors.cyan : '#000',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontWeight: '700'
                  }}>{currentWeekNotes.length}</span>
                )}
              </button>
            </div>

            {/* Search Bar */}
            {(researchActiveTab === 'stocks' || researchActiveTab === 'crypto') && (
              <div style={{ position: 'relative' }}>
                <Search style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '18px',
                  height: '18px',
                  color: '#6e7681'
                }} />
                <input
                  type="text"
                  value={researchSearchTerm || ''}
                  onChange={(e) => setResearchSearchTerm?.(e.target.value)}
                  placeholder={`Search ${researchActiveTab}...`}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 42px',
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
          {/* Notes Tab */}
          {researchActiveTab === 'notes' && (
            <div>
              {/* Progress Section */}
              <div style={{
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#8b949e', fontSize: '13px' }}>Weekly Progress</span>
                  <span style={{ color: colors.cyan, fontSize: '13px', fontWeight: '600' }}>
                    {currentWeekNotes.length}/{RESEARCH_REQUIREMENTS?.minimumNotes || 5} notes
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: '#21262d',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: progressPercent >= 100 ? colors.green : colors.cyan,
                    borderRadius: '4px',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Notes List */}
              {currentWeekNotes.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#8b949e'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                  <p style={{ marginBottom: '8px' }}>No notes this week yet</p>
                  <p style={{ fontSize: '13px' }}>Research assets and clip insights to build your game plan</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {currentWeekNotes.map((note, idx) => (
                    <div
                      key={note.id || idx}
                      style={{
                        background: '#161b22',
                        border: '1px solid #21262d',
                        borderRadius: '12px',
                        padding: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px'
                          }}>
                            <span style={{
                              background: note.assetType === 'ai_insight' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 217, 255, 0.2)',
                              color: note.assetType === 'ai_insight' ? '#8b5cf6' : colors.cyan,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}>
                              {note.symbol || 'AI Insight'}
                            </span>
                            {note.type === 'clipped' && (
                              <span style={{ color: '#8b949e', fontSize: '12px' }}>{note.metricName}</span>
                            )}
                          </div>
                          <div style={{ color: '#e6edf3', fontSize: '14px' }}>
                            {note.type === 'clipped' ? note.explanation : note.customText}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteNote?.(note.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#6e7681',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Asset Grid */}
          {(researchActiveTab === 'stocks' || researchActiveTab === 'crypto') && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '12px'
            }}>
              {sortedAssets.map((asset, idx) => {
                const isPositive = (asset.percentChange || 0) >= 0;
                return (
                  <div
                    key={asset.symbol || idx}
                    onClick={() => handleOpenDetail(asset, researchActiveTab === 'stocks' ? 'stock' : 'crypto')}
                    style={{
                      background: '#161b22',
                      border: '1px solid #21262d',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Symbol & Name */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        marginBottom: '2px'
                      }}>
                        {asset.symbol}
                      </div>
                      <div style={{
                        color: '#8b949e',
                        fontSize: '11px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {asset.name}
                      </div>
                    </div>

                    {/* Sparkline */}
                    {asset.sparklineData && (
                      <div style={{ marginBottom: '8px' }}>
                        <ResearchSparkline prices={asset.sparklineData} width={128} height={32} />
                      </div>
                    )}

                    {/* Price & Change */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        ${asset.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        color: isPositive ? '#10b981' : '#ef4444',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(asset.percentChange || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {(researchActiveTab === 'stocks' || researchActiveTab === 'crypto') && sortedAssets.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#8b949e'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <p>No {researchActiveTab} found matching "{researchSearchTerm}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResearchScreen;
