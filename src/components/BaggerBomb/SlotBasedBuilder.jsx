// SlotBasedBuilder - Main portfolio builder with slot-based layout
// Organizes assets into tiers: Star (20%), Core (15%), Support (10%), Bench

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { STOCKS as STATIC_STOCKS, CRYPTO as STATIC_CRYPTO } from '../../data/assets';
import PortfolioSlot from './PortfolioSlot';
import AssetPickerModal from './AssetPickerModal';

// Default ATR values by sector (used if API doesn't provide)
const SECTOR_DEFAULT_ATR = {
  'Technology': 2.8,
  'Finance': 2.0,
  'Healthcare': 2.2,
  'Consumer Discretionary': 2.5,
  'Consumer Staples': 1.5,
  'Energy': 3.0,
  'Industrials': 2.2,
  'Utilities': 1.5,
  'Real Estate': 2.0,
  'Telecom': 2.2,
  'Crypto': 5.0,
  'Other': 2.5,
};

// Tier configuration
const BUILDER_TIERS = [
  {
    key: 'star',
    label: '⭐ Star Picks',
    description: '2x point multiplier on % gains/losses',
    allocation: '20%',
    slots: 2,
    cryptoAllowed: false,
  },
  {
    key: 'core',
    label: '💎 Core Holds',
    description: '1.5x point multiplier on % gains/losses',
    allocation: '15%',
    slots: 2,
    cryptoAllowed: false,
  },
  {
    key: 'support',
    label: '📊 Support Plays',
    description: '1x base multiplier (last slot = crypto)',
    allocation: '10%',
    slots: 3,
    cryptoAllowed: true,
    lastSlotCrypto: true,
  },
];

// Initial empty portfolio structure (V4 omits bench)
const createEmptyPortfolio = (version = 4) => ({
  star: [null, null],
  core: [null, null],
  support: [null, null, null],
  ...(version <= 3 ? { bench: { stocks: [null, null, null], crypto: null } } : {}),
});

/**
 * TierSection - Header for each tier
 */
function TierSection({ tier, filledCount }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        marginTop: '20px',
      }}
    >
      <div>
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            margin: 0,
          }}
        >
          {tier.label}
        </h3>
        <p
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
            margin: '2px 0 0 0',
          }}
        >
          {tier.description}
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: HOLO_COLORS.textMuted,
          }}
        >
          {filledCount}/{tier.slots}
        </span>
        <span
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            backgroundColor: HOLO_COLORS.bgElevated,
            borderRadius: '4px',
            color: HOLO_COLORS.cyan,
            fontWeight: 600,
          }}
        >
          {tier.allocation} each
        </span>
      </div>
    </div>
  );
}

TierSection.propTypes = {
  tier: PropTypes.object.isRequired,
  filledCount: PropTypes.number.isRequired,
};

/**
 * SlotBasedBuilder - Main component
 */
export default function SlotBasedBuilder({
  portfolio: initialPortfolio,
  stocks = [],
  crypto = [],
  onPortfolioChange,
  onComplete,
  onBack,
  disabled = false,
  version = 4,
}) {
  // Portfolio state
  const [portfolio, setPortfolio] = useState(
    initialPortfolio || createEmptyPortfolio(version)
  );

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.matchMedia('(max-width: 768px)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Build price lookup from API data
  const stockPrices = useMemo(() => {
    const prices = {};
    if (stocks && Array.isArray(stocks)) {
      stocks.forEach(s => {
        prices[s.symbol] = s.price || s.currentPrice || 0;
      });
    }
    return prices;
  }, [stocks]);

  const cryptoPrices = useMemo(() => {
    const prices = {};
    if (crypto && Array.isArray(crypto)) {
      crypto.forEach(c => {
        prices[c.symbol] = c.price || c.currentPrice || 0;
      });
    }
    return prices;
  }, [crypto]);

  // Use static asset data enriched with live prices
  // This ensures we have sector info + consistent structure
  const formattedStocks = useMemo(() => {
    return STATIC_STOCKS.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      price: stockPrices[stock.symbol] || 0,
      baseATR: stock.baseATR || SECTOR_DEFAULT_ATR[stock.sector] || 2.5,
      isCrypto: false,
    }));
  }, [stockPrices]);

  const formattedCrypto = useMemo(() => {
    return STATIC_CRYPTO
      .filter(c => c.category !== 'Stablecoin') // Exclude stablecoins
      .map(coin => ({
        symbol: coin.symbol,
        name: coin.name,
        sector: 'Crypto',
        price: cryptoPrices[coin.symbol] || 0,
        baseATR: coin.baseATR || SECTOR_DEFAULT_ATR['Crypto'] || 5.0,
        isCrypto: true,
      }));
  }, [cryptoPrices]);

  // Modal state
  const [pickerConfig, setPickerConfig] = useState({
    isOpen: false,
    tier: null,
    slotIndex: null,
    cryptoOnly: false,
    stockOnly: false,
  });

  // Get all currently selected assets (for duplicate prevention)
  const selectedAssets = useMemo(() => {
    const selected = [];

    // Active slots
    BUILDER_TIERS.forEach((tier) => {
      portfolio[tier.key]?.forEach((asset) => {
        if (asset) selected.push(asset);
      });
    });

    // Bench stocks (V3 only)
    if (version <= 3) {
      portfolio.bench?.stocks?.forEach((asset) => {
        if (asset) selected.push(asset);
      });
      if (portfolio.bench?.crypto) {
        selected.push(portfolio.bench.crypto);
      }
    }

    return selected;
  }, [portfolio]);

  // Count filled slots per tier
  const getFilledCount = useCallback(
    (tierKey) => {
      if (tierKey === 'bench') {
        const stockCount = portfolio.bench?.stocks?.filter(Boolean).length || 0;
        const cryptoCount = portfolio.bench?.crypto ? 1 : 0;
        return stockCount + cryptoCount;
      }
      return portfolio[tierKey]?.filter(Boolean).length || 0;
    },
    [portfolio]
  );

  // Check if portfolio is valid (all required slots filled)
  const isValid = useMemo(() => {
    // Check active tiers
    for (const tier of BUILDER_TIERS) {
      const filled = getFilledCount(tier.key);
      if (filled < tier.slots) return false;
    }

    // V4: no bench needed — valid with just 7 active slots
    if (version >= 4) return true;

    // V3: also need bench (3 stocks + 1 crypto)
    const benchStocksFilled = portfolio.bench?.stocks?.filter(Boolean).length || 0;
    const hasBenchCrypto = !!portfolio.bench?.crypto;

    return benchStocksFilled >= 3 && hasBenchCrypto;
  }, [portfolio, getFilledCount, version]);

  // Validation message
  const validationMessage = useMemo(() => {
    const missing = [];

    BUILDER_TIERS.forEach((tier) => {
      const filled = getFilledCount(tier.key);
      if (filled < tier.slots) {
        missing.push(`${tier.slots - filled} ${tier.label.split(' ')[1]}`);
      }
    });

    // V3 only: bench requirements
    if (version <= 3) {
      const benchStocksFilled = portfolio.bench?.stocks?.filter(Boolean).length || 0;
      if (benchStocksFilled < 3) {
        missing.push(`${3 - benchStocksFilled} bench stocks`);
      }
      if (!portfolio.bench?.crypto) {
        missing.push('1 bench crypto');
      }
    }

    if (missing.length === 0) return null;
    return `Need: ${missing.join(', ')}`;
  }, [portfolio, getFilledCount, version]);

  // Open picker for a slot
  const openPicker = useCallback((tier, slotIndex, cryptoOnly, stockOnly) => {
    setPickerConfig({
      isOpen: true,
      tier,
      slotIndex,
      cryptoOnly,
      stockOnly,
    });
  }, []);

  // Close picker
  const closePicker = useCallback(() => {
    setPickerConfig({
      isOpen: false,
      tier: null,
      slotIndex: null,
      cryptoOnly: false,
      stockOnly: false,
    });
  }, []);

  // Handle asset selection from picker
  const handleAssetSelect = useCallback(
    (asset) => {
      const { tier, slotIndex } = pickerConfig;

      setPortfolio((prev) => {
        const newPortfolio = { ...prev };

        if (tier === 'bench-stock') {
          const newStocks = [...(prev.bench?.stocks || [null, null, null])];
          newStocks[slotIndex] = asset;
          newPortfolio.bench = { ...prev.bench, stocks: newStocks };
        } else if (tier === 'bench-crypto') {
          newPortfolio.bench = { ...prev.bench, crypto: asset };
        } else {
          const newTier = [...(prev[tier] || [])];
          newTier[slotIndex] = asset;
          newPortfolio[tier] = newTier;
        }

        // Notify parent of change
        if (onPortfolioChange) {
          onPortfolioChange(newPortfolio);
        }

        return newPortfolio;
      });

      closePicker();
    },
    [pickerConfig, onPortfolioChange, closePicker]
  );

  // Handle asset removal
  const handleRemove = useCallback(
    (tier, slotIndex) => {
      setPortfolio((prev) => {
        const newPortfolio = { ...prev };

        if (tier === 'bench-stock') {
          const newStocks = [...(prev.bench?.stocks || [])];
          newStocks[slotIndex] = null;
          newPortfolio.bench = { ...prev.bench, stocks: newStocks };
        } else if (tier === 'bench-crypto') {
          newPortfolio.bench = { ...prev.bench, crypto: null };
        } else {
          const newTier = [...(prev[tier] || [])];
          newTier[slotIndex] = null;
          newPortfolio[tier] = newTier;
        }

        if (onPortfolioChange) {
          onPortfolioChange(newPortfolio);
        }

        return newPortfolio;
      });
    },
    [onPortfolioChange]
  );

  // Handle start battle
  const handleStartBattle = useCallback(() => {
    if (isValid && onComplete) {
      onComplete(portfolio);
    }
  }, [isValid, onComplete, portfolio]);

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: HOLO_COLORS.bgDeep,
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 0',
              marginBottom: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: HOLO_COLORS.cyan,
              fontSize: '14px',
            }}
          >
            <ChevronLeft size={20} />
            Back
          </button>
        )}
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: HOLO_COLORS.textPrimary,
            margin: 0,
          }}
        >
          Build Your Arsenal
        </h2>
        <p
          style={{
            fontSize: '13px',
            color: HOLO_COLORS.textMuted,
            margin: '4px 0 0 0',
          }}
        >
          {version >= 4 ? 'Select 7 active positions' : 'Select 7 active positions + 4 bench slots'}
        </p>
      </div>

      {/* Active Tiers */}
      {BUILDER_TIERS.map((tier) => (
        <div key={tier.key}>
          <TierSection tier={tier} filledCount={getFilledCount(tier.key)} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}
          >
            {Array.from({ length: tier.slots }).map((_, index) => {
              const asset = portfolio[tier.key]?.[index];
              const isCryptoSlot = tier.lastSlotCrypto && index === tier.slots - 1;

              return (
                <PortfolioSlot
                  key={`${tier.key}-${index}`}
                  asset={asset}
                  tier={tier.key}
                  allocation={tier.allocation}
                  isCrypto={isCryptoSlot}
                  onSelect={() =>
                    openPicker(tier.key, index, isCryptoSlot, !isCryptoSlot)
                  }
                  onRemove={() => handleRemove(tier.key, index)}
                  disabled={disabled}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Bench Section (V3 only) */}
      {version <= 3 && (
        <div style={{ marginTop: '24px' }}>
          <TierSection
            tier={{
              key: 'bench',
              label: '📦 Bench',
              description: '3 stocks + 1 crypto for substitutions',
              allocation: 'BN',
              slots: 4,
            }}
            filledCount={getFilledCount('bench')}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '8px',
            }}
          >
            {/* Stock bench slots */}
            {[0, 1, 2].map((index) => (
              <PortfolioSlot
                key={`bench-stock-${index}`}
                asset={portfolio.bench?.stocks?.[index]}
                tier="bench"
                allocation="BN"
                isCrypto={false}
                onSelect={() => openPicker('bench-stock', index, false, true)}
                onRemove={() => handleRemove('bench-stock', index)}
                disabled={disabled}
              />
            ))}

            {/* Crypto bench slot */}
            <PortfolioSlot
              asset={portfolio.bench?.crypto}
              tier="bench"
              allocation="BN"
              isCrypto={true}
              onSelect={() => openPicker('bench-crypto', 0, true, false)}
              onRemove={() => handleRemove('bench-crypto', 0)}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Validation Status */}
      <div
        style={{
          marginTop: '24px',
          padding: '12px 16px',
          backgroundColor: isValid
            ? `${HOLO_COLORS.green}15`
            : HOLO_COLORS.bgElevated,
          borderRadius: '8px',
          border: `1px solid ${isValid ? HOLO_COLORS.green : HOLO_COLORS.borderSubtle}`,
        }}
      >
        {isValid ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: HOLO_COLORS.green,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <span>✓</span>
            <span>Portfolio complete! Ready to battle.</span>
          </div>
        ) : (
          <div
            style={{
              fontSize: '12px',
              color: HOLO_COLORS.textMuted,
            }}
          >
            {validationMessage}
          </div>
        )}
      </div>

      {/* Start Battle Button */}
      <motion.button
        whileHover={isValid && !disabled ? { scale: 1.02 } : {}}
        whileTap={isValid && !disabled ? { scale: 0.98 } : {}}
        onClick={handleStartBattle}
        disabled={!isValid || disabled}
        style={{
          width: '100%',
          marginTop: '16px',
          padding: '16px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: isValid ? HOLO_COLORS.cyan : HOLO_COLORS.bgElevated,
          color: isValid ? HOLO_COLORS.bgDeep : HOLO_COLORS.textMuted,
          fontSize: '16px',
          fontWeight: 700,
          cursor: isValid && !disabled ? 'pointer' : 'not-allowed',
          opacity: isValid ? 1 : 0.5,
          transition: 'all 0.2s',
        }}
      >
        {isValid ? '🚀 Start Battle' : 'Complete Your Roster'}
      </motion.button>

      {/* Asset Picker Modal */}
      <AssetPickerModal
        isOpen={pickerConfig.isOpen}
        onClose={closePicker}
        onSelect={handleAssetSelect}
        stocks={formattedStocks}
        crypto={formattedCrypto}
        selectedAssets={selectedAssets}
        cryptoOnly={pickerConfig.cryptoOnly}
        stockOnly={pickerConfig.stockOnly}
        title={
          pickerConfig.cryptoOnly
            ? 'Select Crypto'
            : pickerConfig.stockOnly
              ? 'Select Stock'
              : 'Select Asset'
        }
      />
    </div>
  );
}

SlotBasedBuilder.propTypes = {
  /** Initial portfolio state */
  portfolio: PropTypes.shape({
    star: PropTypes.array,
    core: PropTypes.array,
    support: PropTypes.array,
    bench: PropTypes.shape({
      stocks: PropTypes.array,
      crypto: PropTypes.object,
    }),
  }),
  /** Available stocks to choose from */
  stocks: PropTypes.array,
  /** Available crypto to choose from */
  crypto: PropTypes.array,
  /** Callback when portfolio changes */
  onPortfolioChange: PropTypes.func,
  /** Callback when portfolio is complete (receives portfolio) */
  onComplete: PropTypes.func,
  /** Callback when back button is pressed */
  onBack: PropTypes.func,
  /** Whether builder is disabled */
  disabled: PropTypes.bool,
  /** Battle version (3 = with bench, 4 = no bench) */
  version: PropTypes.number,
};

SlotBasedBuilder.defaultProps = {
  portfolio: null,
  stocks: [],
  crypto: [],
  onPortfolioChange: null,
  onComplete: null,
  onBack: null,
  disabled: false,
  version: 4,
};

// Export tier config and helper
export { BUILDER_TIERS, createEmptyPortfolio };
