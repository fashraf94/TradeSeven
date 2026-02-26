// AssetPickerModal - Modal for selecting stocks or crypto
// Shows search, sector tabs (stocks only), and asset list with threshold info

import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Check, Info,
  Monitor, Building2, Heart, ShoppingBag, ShoppingCart,
  Zap, Factory, Lightbulb, Home, Radio, Layers
} from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { useIsMobile } from '../../hooks/useIsMobile';
import AssetResearchModal from '../draft/AssetResearchModal';

// Sector definitions with Lucide icons
const SECTORS = [
  { id: 'all', label: 'All', icon: Layers, color: HOLO_COLORS.cyan },
  { id: 'Technology', label: 'Tech', icon: Monitor, color: '#8b5cf6' },
  { id: 'Finance', label: 'Finance', icon: Building2, color: '#3b82f6' },
  { id: 'Healthcare', label: 'Health', icon: Heart, color: '#10b981' },
  { id: 'Consumer Discretionary', label: 'Consumer', icon: ShoppingBag, color: '#f59e0b' },
  { id: 'Consumer Staples', label: 'Staples', icon: ShoppingCart, color: '#6366f1' },
  { id: 'Energy', label: 'Energy', icon: Zap, color: '#eab308' },
  { id: 'Industrials', label: 'Industrial', icon: Factory, color: '#64748b' },
  { id: 'Utilities', label: 'Utilities', icon: Lightbulb, color: '#22c55e' },
  { id: 'Real Estate', label: 'Real Estate', icon: Home, color: '#ec4899' },
  { id: 'Telecom', label: 'Telecom', icon: Radio, color: '#06b6d4' },
];

/**
 * SectorTab - Single sector filter tab
 */
function SectorTab({ sector, isActive, onClick, count }) {
  const Icon = sector.icon;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: isActive ? `${sector.color}20` : 'transparent',
        border: `1px solid ${isActive ? sector.color : HOLO_COLORS.borderSubtle}`,
        borderRadius: '16px',
        color: isActive ? sector.color : HOLO_COLORS.textMuted,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={14} color={isActive ? sector.color : HOLO_COLORS.textMuted} />
      <span style={{ fontSize: '12px', fontWeight: 500 }}>{sector.label}</span>
      {count !== undefined && (
        <span style={{ fontSize: '10px', opacity: 0.7 }}>({count})</span>
      )}
    </button>
  );
}

SectorTab.propTypes = {
  sector: PropTypes.object.isRequired,
  isActive: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  count: PropTypes.number,
};

/**
 * AssetRow - Single asset in the picker list
 * For crypto (cryptoOnly mode): shows inline LONG/SHORT direction buttons
 * For stocks: standard single-click selection
 */
function AssetRow({ asset, isSelected, isDisabled, onSelect, onShowResearch, cryptoOnly }) {
  const accentColor = asset.isCrypto ? HOLO_COLORS.purple : HOLO_COLORS.cyan;
  const isCryptoRow = cryptoOnly && asset.isCrypto;

  // For crypto rows: use a div (not clickable as a whole), with inline direction buttons
  const Wrapper = isCryptoRow ? motion.div : motion.button;
  const wrapperProps = isCryptoRow
    ? {}
    : {
        whileHover: !isDisabled ? { backgroundColor: HOLO_COLORS.bgElevated } : {},
        whileTap: !isDisabled ? { scale: 0.99 } : {},
        onClick: () => !isDisabled && onSelect(asset),
        disabled: isDisabled,
      };

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: isCryptoRow ? 'flex-start' : 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: isSelected ? `${accentColor}15` : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
        cursor: isCryptoRow ? 'default' : isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.4 : 1,
        textAlign: 'left',
        flexWrap: isCryptoRow ? 'wrap' : 'nowrap',
      }}
    >
      {/* Selection Indicator (stocks only) */}
      {!isCryptoRow && (
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            border: `2px solid ${isSelected ? accentColor : HOLO_COLORS.borderSubtle}`,
            backgroundColor: isSelected ? accentColor : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isSelected && <Check size={12} color={HOLO_COLORS.bgDeep} strokeWidth={3} />}
        </div>
      )}

      {/* Asset Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: HOLO_COLORS.textPrimary,
            }}
          >
            {asset.symbol}
          </span>
          {asset.isCrypto && <span style={{ fontSize: '12px' }}>🔮</span>}
          {isDisabled && (
            <span
              style={{
                fontSize: '10px',
                color: HOLO_COLORS.amber,
                padding: '2px 6px',
                backgroundColor: `${HOLO_COLORS.amber}20`,
                borderRadius: '4px',
              }}
            >
              Already selected
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: HOLO_COLORS.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {asset.name}
          {asset.sector && !asset.isCrypto && (
            <span style={{ opacity: 0.6 }}> • {asset.sector}</span>
          )}
        </div>
      </div>

      {/* Info Button */}
      {onShowResearch && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowResearch(asset);
          }}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.borderColor = accentColor;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = HOLO_COLORS.borderSubtle;
          }}
        >
          <Info size={14} color={HOLO_COLORS.textMuted} />
        </button>
      )}

      {/* Threshold Info */}
      <div
        style={{
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: accentColor,
          }}
        >
          {asset.baseATR?.toFixed(1)}% ATR
        </div>
        <div
          style={{
            fontSize: '10px',
            color: HOLO_COLORS.textMuted,
          }}
        >
          💣 {(asset.baseATR * 1.0).toFixed(1)}% | 🚀 {(asset.baseATR * 2.0).toFixed(1)}%
        </div>
      </div>

      {/* LONG/SHORT Direction Buttons (crypto only) */}
      {isCryptoRow && !isDisabled && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            gap: '8px',
            marginTop: '8px',
            paddingLeft: '0',
          }}
        >
          <button
            onClick={() => onSelect({ ...asset, direction: 'long' })}
            style={{
              flex: 1,
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              border: `1px solid ${HOLO_COLORS.green}`,
              backgroundColor: `${HOLO_COLORS.green}15`,
              color: HOLO_COLORS.green,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${HOLO_COLORS.green}30`;
              e.currentTarget.style.boxShadow = `0 0 8px ${HOLO_COLORS.green}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${HOLO_COLORS.green}15`;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            LONG ↑
          </button>
          <button
            onClick={() => onSelect({ ...asset, direction: 'short' })}
            style={{
              flex: 1,
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              border: `1px solid ${HOLO_COLORS.red}`,
              backgroundColor: `${HOLO_COLORS.red}15`,
              color: HOLO_COLORS.red,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${HOLO_COLORS.red}30`;
              e.currentTarget.style.boxShadow = `0 0 8px ${HOLO_COLORS.red}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${HOLO_COLORS.red}15`;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            SHORT ↓
          </button>
        </div>
      )}
    </Wrapper>
  );
}

AssetRow.propTypes = {
  asset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string,
    sector: PropTypes.string,
    baseATR: PropTypes.number,
    isCrypto: PropTypes.bool,
  }).isRequired,
  isSelected: PropTypes.bool,
  isDisabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onShowResearch: PropTypes.func,
  cryptoOnly: PropTypes.bool,
};

/**
 * AssetPickerModal - Main modal component
 */
export default function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
  stocks = [],
  crypto = [],
  selectedAssets = [],
  cryptoOnly = false,
  stockOnly = false,
  title = 'Select Asset',
}) {
  const { isMobile } = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSector, setActiveSector] = useState('all');
  const [researchAsset, setResearchAsset] = useState(null);

  // Get stock count by sector
  const getStockCountBySector = useCallback((sectorId) => {
    if (sectorId === 'all') return stocks.length;
    return stocks.filter(s => s.sector === sectorId).length;
  }, [stocks]);

  // Filter assets based on search, type, and sector
  const filteredAssets = useMemo(() => {
    let filtered = [];

    // Choose source based on type
    if (cryptoOnly) {
      filtered = [...crypto];
    } else if (stockOnly) {
      filtered = [...stocks];
      // Apply sector filter for stocks
      if (activeSector !== 'all') {
        filtered = filtered.filter(s => s.sector === activeSector);
      }
    } else {
      filtered = [...stocks, ...crypto];
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (a) =>
          a.symbol.toLowerCase().includes(query) ||
          (a.name && a.name.toLowerCase().includes(query))
      );
    }

    // Sort by symbol
    filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));

    return filtered;
  }, [stocks, crypto, cryptoOnly, stockOnly, activeSector, searchQuery]);

  // Check if asset is already selected
  const isAssetSelected = useCallback(
    (asset) => selectedAssets.some((s) => s.symbol === asset.symbol),
    [selectedAssets]
  );

  // Handle asset selection
  const handleSelect = useCallback(
    (asset) => {
      onSelect(asset);
      setSearchQuery('');
      setActiveSector('all');
      onClose();
    },
    [onSelect, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        setSearchQuery('');
        setActiveSector('all');
        onClose();
      }
    },
    [onClose]
  );

  // Reset sector filter when modal closes
  const handleClose = useCallback(() => {
    setSearchQuery('');
    setActiveSector('all');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              height: '70vh',
              maxHeight: '600px',
              backgroundColor: HOLO_COLORS.bgCard,
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
              }}
            >
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: HOLO_COLORS.textPrimary,
                  margin: 0,
                }}
              >
                {title}
              </h2>
              <button
                onClick={handleClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: HOLO_COLORS.bgElevated,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} color={HOLO_COLORS.textMuted} />
              </button>
            </div>

            {/* Fixed Controls Section (Search + Sector Tabs) */}
            <div
              style={{
                flexShrink: 0,
                backgroundColor: HOLO_COLORS.bgCard,
                borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
              }}
            >
              {/* Search Bar (hidden for crypto — only 7 items) */}
              {!cryptoOnly && (
              <div style={{ padding: '12px 16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: HOLO_COLORS.bgElevated,
                    borderRadius: '8px',
                    border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                  }}
                >
                  <Search size={18} color={HOLO_COLORS.textMuted} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={stockOnly ? 'Search stocks...' : 'Search assets...'}
                    style={{
                      flex: 1,
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: '14px',
                      color: HOLO_COLORS.textPrimary,
                    }}
                    autoFocus={!isMobile}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      <X size={16} color={HOLO_COLORS.textMuted} />
                    </button>
                  )}
                </div>
              </div>
              )}

              {/* Sector Tabs (only for stocks) */}
              {stockOnly && stocks.length > 0 && (
                <div
                  style={{
                    padding: '0 16px 12px',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      paddingBottom: '4px',
                    }}
                  >
                    {SECTORS.map((sector) => {
                      const count = getStockCountBySector(sector.id);
                      // Only show sectors that have stocks
                      if (sector.id !== 'all' && count === 0) return null;
                      return (
                        <SectorTab
                          key={sector.id}
                          sector={sector}
                          isActive={activeSector === sector.id}
                          onClick={() => setActiveSector(sector.id)}
                          count={count}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Type Indicator */}
              {(cryptoOnly || (stockOnly && activeSector !== 'all')) && (
                <div
                  style={{
                    padding: '0 16px 8px',
                    fontSize: '11px',
                    color: HOLO_COLORS.textMuted,
                  }}
                >
                  {cryptoOnly && (
                    <span style={{ color: HOLO_COLORS.purple }}>
                      🔮 Showing crypto only (required for this slot)
                    </span>
                  )}
                  {stockOnly && activeSector !== 'all' && (
                    <span style={{ color: HOLO_COLORS.cyan }}>
                      📈 Filtered by {SECTORS.find(s => s.id === activeSector)?.label || activeSector}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable Asset List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0, // Important for flex child to scroll properly
              }}
            >
              {filteredAssets.length === 0 ? (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: HOLO_COLORS.textMuted,
                  }}
                >
                  {searchQuery
                    ? `No ${cryptoOnly ? 'crypto' : stockOnly ? 'stocks' : 'assets'} found for "${searchQuery}"`
                    : `No ${cryptoOnly ? 'crypto' : stockOnly ? 'stocks' : 'assets'} available`}
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <AssetRow
                    key={asset.symbol}
                    asset={asset}
                    isSelected={false}
                    isDisabled={isAssetSelected(asset)}
                    onSelect={handleSelect}
                    onShowResearch={(a) => setResearchAsset(a)}
                    cryptoOnly={cryptoOnly}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                flexShrink: 0,
                padding: '12px 16px',
                borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
                backgroundColor: HOLO_COLORS.bgElevated,
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: HOLO_COLORS.textMuted,
                  textAlign: 'center',
                }}
              >
                {filteredAssets.length} {cryptoOnly ? 'crypto' : stockOnly ? 'stocks' : 'assets'} available
                {selectedAssets.length > 0 && ` • ${selectedAssets.length} already selected`}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Research Modal */}
      {researchAsset && (
        <AssetResearchModal
          asset={{
            symbol: researchAsset.symbol,
            name: researchAsset.name,
            price: researchAsset.price || 0,
            percentChange: 0,
            threshold: researchAsset.baseATR,
          }}
          sector={researchAsset.sector}
          onClose={() => setResearchAsset(null)}
          actionConfig={{
            label: isAssetSelected(researchAsset) ? 'Already Selected' : 'Add to Portfolio',
            onClick: () => {
              if (!isAssetSelected(researchAsset)) {
                handleSelect(researchAsset);
              }
              setResearchAsset(null);
            },
            variant: isAssetSelected(researchAsset) ? 'secondary' : 'primary',
            disabled: isAssetSelected(researchAsset),
          }}
          showActionButton={true}
          version={2}
        />
      )}
    </AnimatePresence>
  );
}

AssetPickerModal.propTypes = {
  /** Whether modal is open */
  isOpen: PropTypes.bool.isRequired,
  /** Callback to close modal */
  onClose: PropTypes.func.isRequired,
  /** Callback when asset is selected */
  onSelect: PropTypes.func.isRequired,
  /** Available stocks to choose from */
  stocks: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      sector: PropTypes.string,
      baseATR: PropTypes.number,
      isCrypto: PropTypes.bool,
    })
  ),
  /** Available crypto to choose from */
  crypto: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
      name: PropTypes.string,
      baseATR: PropTypes.number,
      isCrypto: PropTypes.bool,
    })
  ),
  /** Already selected assets (to prevent duplicates) */
  selectedAssets: PropTypes.arrayOf(
    PropTypes.shape({
      symbol: PropTypes.string.isRequired,
    })
  ),
  /** Only show crypto assets */
  cryptoOnly: PropTypes.bool,
  /** Only show stock assets */
  stockOnly: PropTypes.bool,
  /** Modal title */
  title: PropTypes.string,
};

AssetPickerModal.defaultProps = {
  stocks: [],
  crypto: [],
  selectedAssets: [],
  cryptoOnly: false,
  stockOnly: false,
  title: 'Select Asset',
};
