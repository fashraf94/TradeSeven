// AssetPickerModal - Modal for selecting stocks or crypto
// Shows search, filters, and asset list with threshold info

import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';

/**
 * AssetRow - Single asset in the picker list
 */
function AssetRow({ asset, isSelected, isDisabled, onSelect }) {
  const accentColor = asset.isCrypto ? HOLO_COLORS.purple : HOLO_COLORS.cyan;

  return (
    <motion.button
      whileHover={!isDisabled ? { backgroundColor: HOLO_COLORS.bgElevated } : {}}
      whileTap={!isDisabled ? { scale: 0.99 } : {}}
      onClick={() => !isDisabled && onSelect(asset)}
      disabled={isDisabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: isSelected ? `${accentColor}15` : 'transparent',
        border: 'none',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}50`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.4 : 1,
        textAlign: 'left',
      }}
    >
      {/* Selection Indicator */}
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
        </div>
      </div>

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
    </motion.button>
  );
}

AssetRow.propTypes = {
  asset: PropTypes.shape({
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string,
    baseATR: PropTypes.number,
    isCrypto: PropTypes.bool,
  }).isRequired,
  isSelected: PropTypes.bool,
  isDisabled: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
};

/**
 * AssetPickerModal - Main modal component
 */
export default function AssetPickerModal({
  isOpen,
  onClose,
  onSelect,
  assets = [],
  selectedAssets = [],
  cryptoOnly = false,
  stockOnly = false,
  title = 'Select Asset',
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter assets based on search and type
  const filteredAssets = useMemo(() => {
    let filtered = [...assets];

    // Filter by type
    if (cryptoOnly) {
      filtered = filtered.filter((a) => a.isCrypto);
    } else if (stockOnly) {
      filtered = filtered.filter((a) => !a.isCrypto);
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
  }, [assets, cryptoOnly, stockOnly, searchQuery]);

  // Check if asset is already selected
  const isAssetSelected = useCallback(
    (asset) => selectedAssets.some((s) => s.symbol === asset.symbol),
    [selectedAssets]
  );

  // Handle asset selection
  const handleSelect = useCallback(
    (asset) => {
      onSelect(asset);
      onClose();
    },
    [onSelect, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

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
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              backgroundColor: HOLO_COLORS.bgCard,
              borderRadius: '16px 16px 0 0',
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
                onClick={onClose}
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

            {/* Search Bar */}
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
                  placeholder={cryptoOnly ? 'Search crypto...' : stockOnly ? 'Search stocks...' : 'Search assets...'}
                  style={{
                    flex: 1,
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    color: HOLO_COLORS.textPrimary,
                  }}
                  autoFocus
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

            {/* Type Indicator */}
            {(cryptoOnly || stockOnly) && (
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
                {stockOnly && (
                  <span style={{ color: HOLO_COLORS.cyan }}>
                    📈 Showing stocks only
                  </span>
                )}
              </div>
            )}

            {/* Asset List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: '200px',
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
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
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
  /** Available assets to choose from */
  assets: PropTypes.arrayOf(
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
  assets: [],
  selectedAssets: [],
  cryptoOnly: false,
  stockOnly: false,
  title: 'Select Asset',
};
