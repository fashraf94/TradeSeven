/**
 * Stonk Options Arena V2
 * Main screen combining all options trading components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StonkOptionsChain from './StonkOptionsChain';
import StonkOptionsExpirySelector from './StonkOptionsExpirySelector';
import StonkOptionsStockSelector from './StonkOptionsStockSelector';
import StonkOptionsOrder from './StonkOptionsOrder';
import StonkOptionsPosition from './StonkOptionsPosition';
import {
  calculatePortfolio,
  calculateLiveValue,
  validateTournamentPortfolio,
  STONK_OPTIONS_CONFIG,
  EXPIRY_TIERS
} from '../services/stonkOptionsEngineV2';
import { useOptionsTournament } from '../hooks/useOptionsTournament';
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Wallet,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Default stocks to show
const DEFAULT_STOCKS = [
  'TSLA', 'NVDA', 'AAPL', 'AMZN', 'META',
  'AMD', 'GOOGL', 'MSFT', 'NFLX', 'COIN'
];

const StonkOptionsArenaV2 = ({
  onBack,
  stocksData = [],
  stockAPI = null,
  initialCash = 10000,
  user = null
}) => {
  // Core state
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState(7);
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [virtualCash, setVirtualCash] = useState(initialCash);

  // UI state
  const [showOrder, setShowOrder] = useState(false);
  const [showPositions, setShowPositions] = useState(true);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);

  // Tournament state
  const [tournamentMode, setTournamentMode] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTierProgress, setShowTierProgress] = useState(true);

  // Tournament hook (only active if user exists)
  // Always call hook (React rules), hook handles null userId gracefully
  const tournament = useOptionsTournament(user?.odUserId, user?.username);

  // Debug logging for tournament integration verification
  useEffect(() => {
    console.log('=== StonkOptionsArenaV2 Debug ===');
    console.log('user:', user);
    console.log('user?.odUserId:', user?.odUserId);
    console.log('user?.username:', user?.username);
    console.log('tournamentMode:', tournamentMode);
    console.log('tournament hook data:', tournament);
    console.log('tournament.tournament:', tournament?.tournament);
    console.log('tournament.canEnter:', tournament?.canEnter);
    console.log('================================');
  }, [user, tournamentMode, tournament]);

  // Calculate tier counts from current contracts
  const tierCounts = useMemo(() => {
    const counts = { short: 0, medium: 0, long: 0 };
    for (const contract of contracts) {
      if ([1, 3].includes(contract.daysToExpiry)) counts.short++;
      else if (contract.daysToExpiry === 7) counts.medium++;
      else if ([14, 21, 28].includes(contract.daysToExpiry)) counts.long++;
    }
    console.log('tierCounts:', counts, 'contracts:', contracts.length);
    return counts;
  }, [contracts]);

  // Portfolio validation for tournament
  const portfolioValidation = useMemo(() => {
    if (!tournamentMode) return null;
    return validateTournamentPortfolio(contracts);
  }, [contracts, tournamentMode]);

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getFallbackPrice = (symbol) => {
    const fallbacks = {
      TSLA: 430, NVDA: 140, AAPL: 185, AMZN: 185, META: 505,
      AMD: 165, GOOGL: 175, MSFT: 420, NFLX: 475, COIN: 175
    };
    return fallbacks[symbol] || 100;
  };

  // Build prices from stocksData or fetch
  const fetchPrices = useCallback(async () => {
    try {
      const newPrices = {};

      // Get prices from stocksData first
      for (const symbol of DEFAULT_STOCKS) {
        const stockInfo = stocksData.find(s => s.symbol === symbol);
        if (stockInfo?.price) {
          newPrices[symbol] = stockInfo.price;
        }
      }

      // Fetch missing prices via API
      const missingSymbols = DEFAULT_STOCKS.filter(s => !newPrices[s]);

      if (stockAPI && missingSymbols.length > 0) {
        for (const symbol of missingSymbols) {
          try {
            const data = await stockAPI.getStockPrice(symbol);
            if (data?.price) {
              newPrices[symbol] = data.price;
            } else {
              newPrices[symbol] = getFallbackPrice(symbol);
            }
          } catch (e) {
            newPrices[symbol] = getFallbackPrice(symbol);
          }
        }
      } else {
        // Use fallbacks for any missing
        for (const symbol of missingSymbols) {
          newPrices[symbol] = getFallbackPrice(symbol);
        }
      }

      setPrices(newPrices);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Price fetch error:', error);
      // Use all fallbacks
      const fallbackPrices = {};
      DEFAULT_STOCKS.forEach(s => fallbackPrices[s] = getFallbackPrice(s));
      setPrices(fallbackPrices);
      setLoading(false);
    }
  }, [stocksData, stockAPI]);

  // Initial load
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Calculate portfolio
  const portfolio = useMemo(() => {
    return calculatePortfolio(contracts, prices);
  }, [contracts, prices]);

  // Total account value
  const totalValue = virtualCash + portfolio.summary.totalCurrent;
  const totalPL = totalValue - initialCash;
  const totalReturn = (totalPL / initialCash) * 100;

  // Handle stock selection
  const handleSelectStock = (symbol) => {
    setSelectedStock(symbol);
    setSelectedStrike(null);
    setShowOrder(false);
  };

  // Handle strike selection from chain
  const handleSelectStrike = (selection) => {
    setSelectedStrike(selection);
    setShowOrder(true);
  };

  // Handle order confirmation
  const handleConfirmOrder = (contract) => {
    if (contract.entryAmount > virtualCash) {
      alert('Insufficient funds!');
      return;
    }

    // Tournament mode: check tier limits BEFORE adding
    if (tournamentMode) {
      const expiry = contract.daysToExpiry;
      let tierKey = null;
      let tierMax = 0;
      let tierLabel = '';

      if ([1, 3].includes(expiry)) {
        tierKey = 'short';
        tierMax = 2;
        tierLabel = 'short-term';
      } else if (expiry === 7) {
        tierKey = 'medium';
        tierMax = 3;
        tierLabel = 'medium-term';
      } else if ([14, 21, 28].includes(expiry)) {
        tierKey = 'long';
        tierMax = 2;
        tierLabel = 'long-term';
      }

      if (tierKey && tierCounts[tierKey] >= tierMax) {
        alert(`Cannot add more ${tierLabel} contracts. Maximum ${tierMax} allowed for this tier.`);
        return;
      }

      // Also check total (exactly 7 required)
      if (contracts.length >= 7) {
        alert('Portfolio complete! You have all 7 required contracts. Submit to tournament or remove a position first.');
        return;
      }
    }

    setContracts(prev => [...prev, contract]);
    setVirtualCash(prev => prev - contract.entryAmount);
    setSelectedStrike(null);
    setShowOrder(false);
  };

  // Handle selling a position (at current market value)
  const handleSellPosition = (contract, valuation) => {
    if (window.confirm(`Sell ${contract.contractName} for $${valuation.currentValue.toFixed(2)}?`)) {
      setContracts(prev => prev.filter(c => c.id !== contract.id));
      setVirtualCash(prev => prev + valuation.currentValue);
    }
  };

  // Handle removing a position (refund entry amount - for tournament portfolio building)
  const handleRemovePosition = (contract) => {
    if (!contract) return;

    if (!window.confirm(
      `Remove ${contract.symbol} ${contract.direction.toUpperCase()} $${contract.strike}?\n\n` +
      `Entry amount ($${contract.entryAmount.toFixed(2)}) will be refunded.`
    )) {
      return;
    }

    setContracts(prev => prev.filter(c => c.id !== contract.id));
    setVirtualCash(prev => prev + contract.entryAmount);
  };

  // Handle reset
  const handleReset = () => {
    if (window.confirm('Reset all positions and cash?')) {
      setContracts([]);
      setVirtualCash(initialCash);
      setSelectedStock(null);
      setSelectedStrike(null);
      setShowOrder(false);
    }
  };

  // Tournament Header Component
  const TournamentHeader = () => {
    if (!tournament?.tournament) return null;

    const { tournament: t, timeUntilLock, timeUntilEnd, userEntries, canEnter } = tournament;

    const formatTime = (ms) => {
      if (!ms || ms <= 0) return 'Closed';
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
      return `${hours}h ${minutes}m`;
    };

    const statusColors = {
      open: '#10b981',
      in_progress: '#00d9ff',
      completed: '#6b7280'
    };

    return (
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #12121a 100%)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #2d3748'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#fff',
              margin: 0
            }}>
              🏆 {t.name}
            </h2>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: statusColors[t.status] || '#fff',
              textTransform: 'uppercase'
            }}>
              {t.status.replace('_', ' ')}
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            {t.status === 'open' && (
              <>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Lock Deadline</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>
                  {formatTime(timeUntilLock)}
                </div>
              </>
            )}
            {t.status === 'in_progress' && (
              <>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Ends In</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#00d9ff' }}>
                  {formatTime(timeUntilEnd)}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            flex: 1,
            minWidth: '120px',
            background: '#0d0d12',
            borderRadius: '8px',
            padding: '10px'
          }}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Your Entries</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
              {userEntries.length}/3
            </div>
          </div>

          <div style={{
            flex: 1,
            minWidth: '120px',
            background: '#0d0d12',
            borderRadius: '8px',
            padding: '10px'
          }}>
            <div style={{ fontSize: '11px', color: '#9ca3af' }}>Participants</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
              {t.entryCount || 0}
            </div>
          </div>

          <button
            onClick={() => setShowLeaderboard(true)}
            style={{
              flex: 1,
              minWidth: '120px',
              background: 'linear-gradient(135deg, #00d9ff 0%, #0066ff 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px',
              cursor: 'pointer',
              color: '#fff',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            View Leaderboard
          </button>
        </div>

        {canEnter.canEnter && t.status === 'open' && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '12px', color: '#10b981' }}>
              ✨ Build your portfolio below and submit to compete!
            </span>
          </div>
        )}
      </div>
    );
  };

  // Tier Progress Bar Component
  const TierProgressBar = () => {
    if (!tournamentMode || !showTierProgress) return null;

    // Each tier has exact count required (min = max)
    const tiers = [
      { key: 'short', label: 'Short (1-3D)', max: 2, count: tierCounts.short, color: '#ef4444' },
      { key: 'medium', label: 'Medium (7D)', max: 3, count: tierCounts.medium, color: '#f59e0b' },
      { key: 'long', label: 'Long (14-28D)', max: 2, count: tierCounts.long, color: '#10b981' }
    ];

    const allComplete = tiers.every(t => t.count === t.max);

    return (
      <div style={{
        background: allComplete ? 'rgba(16, 185, 129, 0.1)' : '#12121a',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '12px',
        border: allComplete ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #2d3748'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>
            📊 Portfolio Requirements
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: allComplete ? '#10b981' : '#f59e0b'
          }}>
            {contracts.length}/7 {allComplete ? '✓ Ready!' : 'contracts'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {tiers.map(tier => {
            const isComplete = tier.count === tier.max;
            return (
            <div key={tier.key} style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                marginBottom: '4px'
              }}>
                <span style={{ color: '#9ca3af' }}>{tier.label}</span>
                <span style={{
                  color: isComplete ? '#10b981' : '#fff',
                  fontWeight: '600'
                }}>
                  {tier.count}/{tier.max} {isComplete ? '✓' : ''}
                </span>
              </div>
              <div style={{
                height: '4px',
                background: '#2d3748',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (tier.count / tier.max) * 100)}%`,
                  background: isComplete ? '#10b981' : tier.color,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          );
          })}
        </div>
      </div>
    );
  };

  // Tournament Submit Section Component - Always shows in tournament mode
  const TournamentSubmitSection = () => {
    // Debug logging
    console.log('=== TournamentSubmitSection Debug ===');
    console.log('tournamentMode:', tournamentMode);
    console.log('tournament:', tournament);
    console.log('contracts.length:', contracts.length);
    console.log('tierCounts:', tierCounts);

    if (!tournamentMode) return null;

    // Calculate validation locally for reliability
    const totalContracts = contracts.length;
    const allTiersMet = tierCounts.short >= 2 && tierCounts.medium >= 3 && tierCounts.long >= 2;
    const isPortfolioComplete = totalContracts === 7 && allTiersMet;

    // Tournament state
    const hasTournament = tournament?.tournament != null;
    const tournamentStatus = tournament?.tournament?.status;
    const canEnterTournament = tournament?.canEnter?.canEnter ?? false;
    const entryCount = tournament?.userEntries?.length || 0;
    const isSubmitting = tournament?.isSubmitting || false;

    const totalInvested = contracts.reduce((sum, c) => sum + c.entryAmount, 0);

    // Can submit if portfolio is complete AND tournament allows entry
    const canSubmit = isPortfolioComplete && hasTournament && canEnterTournament && !isSubmitting;

    return (
      <div style={{
        marginTop: '24px',
        padding: '20px',
        background: isPortfolioComplete
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))'
          : '#12121a',
        border: isPortfolioComplete
          ? '2px solid #10b981'
          : '1px solid #2d3748',
        borderRadius: '12px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{
            color: '#fff',
            fontSize: '18px',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🏆 Tournament Entry
          </h3>
          {isPortfolioComplete && (
            <span style={{
              fontSize: '12px',
              background: '#10b981',
              color: '#000',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              ✓ READY
            </span>
          )}
        </div>

        {/* Portfolio Summary Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '16px'
        }}>
          <div style={{
            background: '#0d0d12',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Contracts</div>
            <div style={{
              fontSize: '22px',
              fontWeight: '700',
              color: totalContracts === 7 ? '#10b981' : '#fff'
            }}>
              {totalContracts}/7
            </div>
          </div>
          <div style={{
            background: '#0d0d12',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Invested</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#00d9ff' }}>
              ${totalInvested.toLocaleString()}
            </div>
          </div>
          <div style={{
            background: '#0d0d12',
            padding: '12px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Cash Left</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff' }}>
              ${virtualCash.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Tournament Info */}
        {hasTournament ? (
          <div style={{
            background: '#0d0d12',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Tournament</span>
              <span style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>
                {tournament.tournament.name}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Status</span>
              <span style={{
                color: tournamentStatus === 'open' ? '#10b981' : '#f59e0b',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                {tournamentStatus === 'open' ? '🟢 Open for Entries' : tournamentStatus}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Your Entries</span>
              <span style={{ color: '#00d9ff', fontWeight: '600', fontSize: '13px' }}>
                {entryCount}/3
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#f59e0b', fontSize: '13px', marginBottom: '12px' }}>
              ⚠️ No active tournament found
            </div>
            <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '12px' }}>
              Tournaments auto-create on weekdays. Click below to create a test tournament.
            </div>
            <button
              onClick={handleCreateTestTournament}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              🏆 Create Test Tournament
            </button>
          </div>
        )}

        {/* Can't Enter Reason */}
        {hasTournament && !canEnterTournament && tournament?.canEnter?.reason && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <span style={{ color: '#ef4444', fontSize: '13px' }}>
              ⚠️ {tournament.canEnter.reason}
            </span>
          </div>
        )}

        {/* Portfolio Validation Errors */}
        {!isPortfolioComplete && portfolioValidation?.errors?.length > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '6px', fontWeight: '600' }}>
              Requirements not met:
            </div>
            {portfolioValidation.errors.map((err, i) => (
              <div key={i} style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                • {err}
              </div>
            ))}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmitToTournament}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '10px',
            border: 'none',
            background: canSubmit
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : '#2d3748',
            color: canSubmit ? '#fff' : '#6b7280',
            fontSize: '16px',
            fontWeight: '700',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {isSubmitting
            ? '⏳ Submitting...'
            : canSubmit
              ? '🚀 Lock Portfolio & Enter Tournament'
              : !isPortfolioComplete
                ? '📋 Complete Portfolio to Submit'
                : !hasTournament
                  ? '⏳ Loading Tournament...'
                  : '⏳ Entry Not Available'
          }
        </button>

        {canSubmit && (
          <p style={{
            textAlign: 'center',
            marginTop: '10px',
            marginBottom: 0,
            fontSize: '12px',
            color: '#6b7280'
          }}>
            ⚠️ Portfolio will be locked and cannot be changed after submission
          </p>
        )}
      </div>
    );
  };

  // Handler to create a test tournament (for development/testing)
  const handleCreateTestTournament = async () => {
    console.log('handleCreateTestTournament called');
    try {
      const { createTestOptionsTournament } = await import('../services/optionsTournamentService');
      const newTournament = await createTestOptionsTournament();
      console.log('Created test tournament:', newTournament);
      alert('🏆 Tournament created!\n\nName: ' + newTournament.name + '\n\nRefreshing data...');
      // Refresh tournament data
      tournament?.refresh?.();
    } catch (err) {
      console.error('Error creating tournament:', err);
      alert('❌ Error creating tournament:\n\n' + err.message);
    }
  };

  // Submit handler for tournament entry
  const handleSubmitToTournament = async () => {
    console.log('handleSubmitToTournament called');

    if (!tournament?.tournament) {
      alert('No active tournament available');
      return;
    }

    if (!tournament.canEnter?.canEnter) {
      alert(tournament.canEnter?.reason || 'Cannot enter tournament at this time');
      return;
    }

    // Validate portfolio
    const totalContracts = contracts.length;
    const allTiersMet = tierCounts.short >= 2 && tierCounts.medium >= 3 && tierCounts.long >= 2;

    if (totalContracts !== 7 || !allTiersMet) {
      alert('Portfolio does not meet requirements.\n\nNeed exactly 7 contracts:\n• 2 short-term (1D or 3D)\n• 3 medium-term (7D)\n• 2 long-term (14D, 21D, or 28D)');
      return;
    }

    const totalEntry = contracts.reduce((sum, c) => sum + c.entryAmount, 0);

    const confirmed = confirm(
      `🏆 Submit Tournament Entry?\n\n` +
      `Tournament: ${tournament.tournament.name}\n` +
      `Contracts: ${totalContracts}\n` +
      `Total Invested: $${totalEntry.toLocaleString()}\n` +
      `Cash Remaining: $${virtualCash.toLocaleString()}\n\n` +
      `⚠️ Your portfolio will be LOCKED!\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    try {
      console.log('Submitting entry with contracts:', contracts);
      await tournament.submitEntry(contracts);

      alert('🎉 Success!\n\nYour entry has been submitted.\n\nGood luck!');

      // Reset local state
      setContracts([]);
      setVirtualCash(initialCash);

      // Refresh tournament data
      tournament.refresh?.();

    } catch (err) {
      console.error('Tournament submission error:', err);
      alert('❌ Error submitting entry:\n\n' + err.message);
    }
  };

  // Legacy Tournament Submit Button Component (kept for backwards compatibility)
  const TournamentSubmitButton = () => {
    // Now handled by TournamentSubmitSection
    return null;
  };

  // Leaderboard Modal Component
  const LeaderboardModal = () => {
    if (!showLeaderboard || !tournament?.leaderboard) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}>
        <div style={{
          background: '#12121a',
          borderRadius: '16px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: '1px solid #2d3748'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #2d3748'
          }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>
              🏆 Leaderboard
            </h3>
            <button
              onClick={() => setShowLeaderboard(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                fontSize: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>

          <div style={{
            overflowY: 'auto',
            maxHeight: 'calc(80vh - 60px)',
            padding: '8px'
          }}>
            {tournament.leaderboard.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#6b7280'
              }}>
                No entries yet. Be the first!
              </div>
            ) : (
              tournament.leaderboard.map((entry, index) => {
                const isUser = entry.odUserId === user?.odUserId;
                const rank = entry.rank || index + 1;

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      background: isUser ? 'rgba(0, 217, 255, 0.1)' : '#1a1a2e',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: isUser ? '1px solid rgba(0, 217, 255, 0.3)' : '1px solid transparent'
                    }}
                  >
                    <div style={{
                      width: '32px',
                      fontWeight: '700',
                      fontSize: '16px',
                      color: rank <= 3 ? '#fbbf24' : '#6b7280'
                    }}>
                      {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ color: '#fff', fontWeight: '600' }}>
                          {entry.username}
                        </span>
                        {entry.isBot && (
                          <span style={{
                            fontSize: '10px',
                            background: '#7c3aed',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            BOT
                          </span>
                        )}
                        {isUser && (
                          <span style={{
                            fontSize: '10px',
                            background: '#00d9ff',
                            color: '#000',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {entry.contractCount} contracts
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {entry.totalValue !== null ? (
                        <>
                          <div style={{
                            fontWeight: '700',
                            color: entry.percentReturn >= 0 ? '#10b981' : '#ef4444'
                          }}>
                            {entry.percentReturn >= 0 ? '+' : ''}{entry.percentReturn?.toFixed(2)}%
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            ${entry.totalValue?.toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  // Tournament Mode Toggle Component
  const TournamentModeToggle = () => {
    if (!user) {
      return (
        <div style={{
          background: '#1a1a2e',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          <span style={{ color: '#6b7280', fontSize: '13px' }}>
            Sign in to compete in tournaments
          </span>
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <button
          onClick={() => setTournamentMode(false)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: !tournamentMode ? '2px solid #00d9ff' : '1px solid #2d3748',
            background: !tournamentMode ? 'rgba(0, 217, 255, 0.1)' : '#1a1a2e',
            color: !tournamentMode ? '#00d9ff' : '#9ca3af',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Practice Mode
        </button>
        <button
          onClick={() => setTournamentMode(true)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: tournamentMode ? '2px solid #10b981' : '1px solid #2d3748',
            background: tournamentMode ? 'rgba(16, 185, 129, 0.1)' : '#1a1a2e',
            color: tournamentMode ? '#10b981' : '#9ca3af',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          🏆 Tournament
        </button>
      </div>
    );
  };

  // Position Lock Button Component
  const PositionLockButton = ({ contract, entryId }) => {
    const [isLocking, setIsLocking] = useState(false);

    // Only show during in_progress tournament
    if (!tournament?.tournament || tournament.tournament.status !== 'in_progress') {
      return null;
    }

    // Find this contract in user's entries
    const userEntry = tournament.userEntries.find(e => e.id === entryId);
    if (!userEntry) return null;

    const entryContract = userEntry.contracts.find(c => c.id === contract.id);

    // Already locked
    if (entryContract?.lockedValue !== null) {
      return (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '6px',
          padding: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '10px', color: '#10b981' }}>🔒 LOCKED</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }}>
            ${entryContract.lockedValue.toFixed(2)}
          </div>
        </div>
      );
    }

    // Calculate current value
    const currentPrice = prices[contract.symbol] || contract.entryPrice;
    const liveValue = calculateLiveValue(contract, currentPrice, Date.now());
    const profitLoss = liveValue.currentValue - contract.entryAmount;
    const percentReturn = (profitLoss / contract.entryAmount) * 100;

    const handleLock = async () => {
      if (!confirm(
        `Lock in this position at $${liveValue.currentValue.toFixed(2)}?\n\n` +
        `P/L: ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)} (${percentReturn.toFixed(1)}%)\n\n` +
        `This cannot be undone!`
      )) {
        return;
      }

      setIsLocking(true);
      try {
        await tournament.lockPosition(entryId, contract.id, liveValue.currentValue);
      } catch (err) {
        alert('Error locking position: ' + err.message);
      } finally {
        setIsLocking(false);
      }
    };

    return (
      <button
        onClick={handleLock}
        disabled={isLocking}
        style={{
          width: '100%',
          padding: '8px',
          marginTop: '8px',
          borderRadius: '6px',
          border: '1px solid #f59e0b',
          background: 'rgba(245, 158, 11, 0.1)',
          color: '#f59e0b',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          opacity: isLocking ? 0.7 : 1
        }}
      >
        {isLocking ? 'Locking...' : `🔒 Lock In ${profitLoss >= 0 ? 'Gains' : 'Loss'}`}
      </button>
    );
  };

  // User Tournament Entries Component
  const UserTournamentEntries = () => {
    if (!tournamentMode || !tournament?.userEntries?.length) return null;
    if (tournament.tournament?.status === 'open') return null; // Only show after lock deadline

    return (
      <div style={{
        background: '#12121a',
        borderRadius: '12px',
        padding: '16px',
        marginTop: '16px',
        border: '1px solid #2d3748'
      }}>
        <h3 style={{
          color: '#fff',
          fontSize: '16px',
          marginBottom: '12px',
          margin: 0
        }}>
          📊 Your Tournament Entries
        </h3>

        {tournament.userEntries.map(entry => (
          <div key={entry.id} style={{
            background: '#1a1a2e',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '12px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                Entry #{entry.entryNumber}
              </span>
              <span style={{ color: '#00d9ff', fontSize: '12px', fontWeight: '600' }}>
                {entry.contracts.length} positions
              </span>
            </div>

            {entry.contracts.map(contract => {
              const currentPrice = prices[contract.symbol] || contract.entryPrice;
              const isLocked = contract.lockedValue !== null;
              const value = isLocked
                ? contract.lockedValue
                : calculateLiveValue(contract, currentPrice, Date.now()).currentValue;
              const pl = value - contract.entryAmount;

              return (
                <div key={contract.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px',
                  background: '#0d0d12',
                  borderRadius: '6px',
                  marginBottom: '6px'
                }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: '600' }}>
                      {contract.symbol}
                    </span>
                    <span style={{
                      color: contract.direction === 'call' ? '#10b981' : '#ef4444',
                      marginLeft: '6px',
                      fontSize: '12px'
                    }}>
                      {contract.direction.toUpperCase()} ${contract.strike}
                    </span>
                    <span style={{ color: '#6b7280', marginLeft: '6px', fontSize: '11px' }}>
                      {contract.daysToExpiry}D
                    </span>
                    {isLocked && (
                      <span style={{
                        marginLeft: '6px',
                        fontSize: '10px',
                        background: '#10b981',
                        color: '#000',
                        padding: '2px 4px',
                        borderRadius: '3px'
                      }}>
                        🔒
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      color: pl >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: '600',
                      fontSize: '13px'
                    }}>
                      {pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                    </div>
                    {!isLocked && tournament.tournament?.status === 'in_progress' && (
                      <PositionLockButton contract={contract} entryId={entry.id} />
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #2d3748'
            }}>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>Portfolio Value</span>
              <span style={{ color: '#fff', fontWeight: '700' }}>
                ${entry.results?.totalValue?.toFixed(2) || 'Calculating...'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <TrendingUp size={48} color="#00d9ff" style={{ marginBottom: 16 }} />
          <div style={{ color: '#00d9ff', fontSize: 18 }}>Loading Options Arena...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a1a',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
        borderBottom: '1px solid #1f2937',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    background: '#1f2937',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <TrendingUp size={24} color="#00d9ff" />
                  Stonk Options
                </h1>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Binary options trading game
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={fetchPrices}
                style={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13
                }}
              >
                <RefreshCw size={14} />
                {!isMobile && 'Refresh'}
              </button>
              <button
                onClick={handleReset}
                style={{
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Account Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 12
          }}>
            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{
                fontSize: 11,
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4
              }}>
                <Wallet size={12} />
                CASH
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                ${virtualCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{
                fontSize: 11,
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4
              }}>
                <BarChart3 size={12} />
                POSITIONS
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#00d9ff' }}>
                ${portfolio.summary.totalCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                TOTAL VALUE
              </div>
              <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{
              background: '#1a1f2e',
              borderRadius: 10,
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                P/L
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: totalPL >= 0 ? '#10b981' : '#ef4444'
              }}>
                {totalPL >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
        {/* Tournament Mode Toggle */}
        <TournamentModeToggle />

        {/* Tournament Header - show when tournament mode is on */}
        {tournamentMode && user && <TournamentHeader />}

        {/* Tier Progress Bar */}
        <TierProgressBar />

        <div style={{
          display: 'grid',
          gridTemplateColumns: (!isMobile && showOrder) ? '1fr 380px' : '1fr',
          gap: 20
        }}>
          {/* Left Column: Trading Interface */}
          <div>
            {/* Stock Selector */}
            <StonkOptionsStockSelector
              stocks={DEFAULT_STOCKS}
              prices={prices}
              selectedStock={selectedStock}
              onSelectStock={handleSelectStock}
            />

            {selectedStock && (
              <>
                {/* Expiry Selector */}
                <div style={{ marginTop: 16 }}>
                  <StonkOptionsExpirySelector
                    selectedExpiry={selectedExpiry}
                    onSelectExpiry={setSelectedExpiry}
                    tournamentMode={tournamentMode}
                    tierCounts={tierCounts}
                  />
                </div>

                {/* Options Chain */}
                <div style={{ marginTop: 16 }}>
                  <StonkOptionsChain
                    symbol={selectedStock}
                    currentPrice={prices[selectedStock]}
                    selectedExpiry={selectedExpiry}
                    selectedStrike={selectedStrike}
                    onSelectStrike={handleSelectStrike}
                  />
                </div>
              </>
            )}

            {!selectedStock && (
              <div style={{
                marginTop: 20,
                padding: 40,
                background: '#0d1117',
                borderRadius: 12,
                textAlign: 'center',
                border: '1px solid #1f2937'
              }}>
                <TrendingUp size={48} color="#374151" style={{ marginBottom: 16 }} />
                <div style={{ color: '#6b7280', fontSize: 16 }}>
                  Select a stock above to view options
                </div>
              </div>
            )}

            {/* Mobile Order Entry (shows below chain on mobile) */}
            {isMobile && showOrder && selectedStrike && (
              <div style={{ marginTop: 16 }}>
                <StonkOptionsOrder
                  selection={selectedStrike}
                  maxBudget={virtualCash}
                  onConfirm={handleConfirmOrder}
                  onCancel={() => {
                    setSelectedStrike(null);
                    setShowOrder(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Right Column: Order Entry (desktop only) */}
          {!isMobile && showOrder && selectedStrike && (
            <div style={{ position: 'sticky', top: 180, alignSelf: 'flex-start' }}>
              <StonkOptionsOrder
                selection={selectedStrike}
                maxBudget={virtualCash}
                onConfirm={handleConfirmOrder}
                onCancel={() => {
                  setSelectedStrike(null);
                  setShowOrder(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Positions Section */}
        {contracts.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <button
              onClick={() => setShowPositions(!showPositions)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: '#0d1117',
                border: '1px solid #1f2937',
                borderRadius: showPositions ? '12px 12px 0 0' : '12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: '600'
              }}
            >
              <span>
                Your Positions ({contracts.length})
                <span style={{
                  marginLeft: 12,
                  fontSize: 14,
                  color: portfolio.summary.totalPL >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {portfolio.summary.totalPL >= 0 ? '+' : ''}
                  ${portfolio.summary.totalPL.toFixed(2)}
                </span>
              </span>
              {showPositions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {showPositions && (
              <div style={{
                padding: 16,
                background: '#0d1117',
                border: '1px solid #1f2937',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
                  gap: 16
                }}>
                  {portfolio.contracts.map(contract => (
                    <StonkOptionsPosition
                      key={contract.id}
                      contract={contract}
                      currentPrice={prices[contract.symbol]}
                      onClose={tournamentMode ? null : handleSellPosition}
                      onRemove={handleRemovePosition}
                      showRemoveButton={tournamentMode}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {contracts.length === 0 && selectedStock && (
          <div style={{
            marginTop: 32,
            padding: 32,
            background: '#0d1117',
            borderRadius: 12,
            textAlign: 'center',
            border: '1px dashed #374151'
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ color: '#9ca3af', marginBottom: 8 }}>No positions yet</div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>
              Select a strike from the options chain to place your first trade
            </div>
          </div>
        )}

        {/* Tournament Submit Section */}
        <TournamentSubmitSection />

        {/* User Tournament Entries - shows submitted entries with lock buttons */}
        <UserTournamentEntries />
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px',
        background: '#0d1117',
        borderTop: '1px solid #1f2937',
        marginTop: 32
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#6b7280',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          <span>This is a simulation. No real money involved.</span>
        </div>
      </div>

      {/* Leaderboard Modal */}
      <LeaderboardModal />
    </div>
  );
};

export default StonkOptionsArenaV2;
