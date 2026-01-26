/**
 * Stonk Options Arena V2
 * Main screen combining all options trading components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StonkOptionsChain from '../StonkOptionsChain';
import StonkOptionsExpirySelector from '../StonkOptionsExpirySelector';
import StonkOptionsStockSelector from '../StonkOptionsStockSelector';
import StonkOptionsOrder from '../StonkOptionsOrder';
import StonkOptionsPosition from '../StonkOptionsPosition';
import {
  calculatePortfolio,
  calculateLiveValue,
  validateTournamentPortfolio,
  STONK_OPTIONS_CONFIG,
  EXPIRY_TIERS
} from '../../services/stonkOptionsEngineV2';
import { useOptionsTournament } from '../../hooks/useOptionsTournament';
import PositionDetailModal from './PositionDetailModal';
import TournamentSubmitSection from './TournamentSubmitSection';
import EntryPortfolioCard from './EntryPortfolioCard';
import LeaderboardModal from './LeaderboardModal';
import TournamentHeader from './TournamentHeader';
import TournamentPortfolioView from './TournamentPortfolioView';
import TierProgressBar from './TierProgressBar';
import TournamentModeToggle from './TournamentModeToggle';
import TabNavigation from './TabNavigation';
import AdminControls from './AdminControls';
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
  const [activeTab, setActiveTab] = useState('build'); // 'build' | 'portfolios'
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);

  // Tournament hook (only active if user exists)
  // Always call hook (React rules), hook handles null userId gracefully
  const tournament = useOptionsTournament(user?.odUserId, user?.username);

  // Debug logging for tournament integration verification
  useEffect(() => {
  }, [user, tournamentMode, tournament]);

  // Calculate tier counts from current contracts
  const tierCounts = useMemo(() => {
    const counts = { short: 0, medium: 0, long: 0 };
    for (const contract of contracts) {
      if ([1, 3].includes(contract.daysToExpiry)) counts.short++;
      else if (contract.daysToExpiry === 7) counts.medium++;
      else if ([14, 21, 28].includes(contract.daysToExpiry)) counts.long++;
    }
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




  // Handler to create a test tournament (for development/testing)
  const handleCreateTestTournament = async () => {
    try {
      const { createTestOptionsTournament } = await import('../../services/optionsTournamentService');
      const newTournament = await createTestOptionsTournament();
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
      await tournament.submitEntry(contracts);

      alert('🎉 Success!\n\nYour entry has been submitted.\n\nGood luck!');

      // Reset local state
      setContracts([]);
      setVirtualCash(initialCash);

      // Refresh tournament data
      tournament.refresh?.();

    } catch (err) {
      console.error('Tournament submission error:', err);
      setSubmissionError(err.message || 'Failed to submit entry. Please try again.');
      // Clear error after 5 seconds
      setTimeout(() => setSubmissionError(null), 5000);
    }
  };

  // Legacy Tournament Submit Button Component (kept for backwards compatibility)
  const TournamentSubmitButton = () => {
    // Now handled by TournamentSubmitSection
    return null;
  };


  // Handle locking a position
  const handleLockPosition = async (entryId, contract) => {
    if (!confirm(
      `Lock in this position?\n\n` +
      `${contract.symbol} ${contract.direction.toUpperCase()} $${contract.strike}\n` +
      `Current Value: $${contract.currentValue.toFixed(2)}\n` +
      `P/L: ${contract.profitLoss >= 0 ? '+' : ''}$${contract.profitLoss.toFixed(2)}\n\n` +
      `This cannot be undone!`
    )) {
      return;
    }

    try {
      await tournament.lockPosition(entryId, contract.id, contract.currentValue);
      alert('Position locked successfully!');
      setShowPositionModal(false);
      tournament.refresh?.();
    } catch (err) {
      console.error('Error locking position:', err);
      alert('Error: ' + err.message);
    }
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
        {/* Tab Navigation */}
        <TabNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasEntries={tournament?.userEntries?.length > 0}
          entryCount={tournament?.userEntries?.length || 0}
        />

        {/* TAB CONTENT */}
        {activeTab === 'build' ? (
          <>
            {/* BUILD TAB CONTENT */}

            {/* Tournament Mode Toggle */}
            <TournamentModeToggle
              user={user}
              tournamentMode={tournamentMode}
              setTournamentMode={setTournamentMode}
            />

            {/* Tournament Header - show when tournament mode is on */}
            {tournamentMode && user && (
              <TournamentHeader
                tournament={tournament}
                onShowLeaderboard={() => setShowLeaderboard(true)}
              />
            )}

            {/* Tier Progress Bar */}
            <TierProgressBar
              tournamentMode={tournamentMode}
              showTierProgress={showTierProgress}
              tierCounts={tierCounts}
              totalContracts={contracts.length}
            />

            {/* Tournament Submit Section - placed here so users see it after requirements */}
            <TournamentSubmitSection
              tournamentMode={tournamentMode}
              contracts={contracts}
              tierCounts={tierCounts}
              virtualCash={virtualCash}
              tournament={tournament}
              portfolioValidation={portfolioValidation}
              onCreateTestTournament={handleCreateTestTournament}
              onSubmitToTournament={handleSubmitToTournament}
              submissionError={submissionError}
              onClearError={() => setSubmissionError(null)}
            />

            {/* Admin Controls - only visible to admin users */}
            <AdminControls
              user={user}
              tournament={tournament}
              prices={prices}
              onRefresh={() => tournament?.refresh?.()}
            />

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

            {/* User Tournament Entries - shows submitted entries with lock buttons */}
            <UserTournamentEntries />
          </>
        ) : (
          <>
            {/* PORTFOLIOS TAB CONTENT */}
            <TournamentPortfolioView
              tournament={tournament}
              prices={prices}
              onNavigateToBuild={() => {
                setActiveTab('build');
                setTournamentMode(true);
              }}
              onPositionClick={(position) => {
                setSelectedPosition(position);
                setShowPositionModal(true);
              }}
              onLockPosition={handleLockPosition}
            />
          </>
        )}
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

      {/* Modals */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        leaderboard={tournament?.leaderboard}
        currentUserId={user?.odUserId}
      />
      <PositionDetailModal
        isOpen={showPositionModal}
        onClose={() => setShowPositionModal(false)}
        position={selectedPosition}
        prices={prices}
        tournamentStatus={tournament?.tournament?.status}
        onLockPosition={handleLockPosition}
      />
    </div>
  );
};

export default StonkOptionsArenaV2;
