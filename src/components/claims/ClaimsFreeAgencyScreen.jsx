import React, { useState } from 'react';
import { HOLO_COLORS, HOLO_BACKGROUND, CATEGORY_CONFIG } from '../../constants/holoTheme';
import useClaimsFreeAgency from '../../hooks/useClaimsFreeAgency';
import WaiverPriorityBar from './WaiverPriorityBar';
import ClaimCard from './ClaimCard';
import CategoryTabs from '../freeAgency/shared/CategoryTabs';
import RosterAssetCard from '../freeAgency/shared/RosterAssetCard';
import FreeAgentCard from '../freeAgency/shared/FreeAgentCard';
import SwapConfirmModal from '../freeAgency/shared/SwapConfirmModal';
import FreeAgencyResearchModal from '../freeAgency/shared/FreeAgencyResearchModal';

/**
 * ClaimsFreeAgencyScreen - Claim-based free agency (replaces FCFS when claimSystem.enabled)
 *
 * Mobile-first layout. Supports claim submission, pending claims display,
 * processing results, and waiver priority visualization.
 */
const ClaimsFreeAgencyScreen = ({ containerStyle, currentDraft, user, setScreen, logger }) => {
  const cl = useClaimsFreeAgency(currentDraft, user, setScreen, logger);
  const [showResults, setShowResults] = useState(false);
  const [assetForResearch, setAssetForResearch] = useState(null);
  const [sortByPoints, setSortByPoints] = useState(false);

  // ============ LOADING ============
  if (cl.loading) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: `3px solid ${HOLO_COLORS.greenMuted}33`,
            borderTop: `3px solid ${HOLO_COLORS.greenMuted}`,
            borderRadius: '50%',
            animation: 'claimsSpin 1s linear infinite',
            margin: '0 auto 12px',
          }} />
          <div style={{ color: HOLO_COLORS.textSecondary, fontSize: '14px' }}>
            Loading claims...
          </div>
          <style>{`
            @keyframes claimsSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // ============ ERROR ============
  if (cl.error) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          textAlign: 'center',
          background: HOLO_COLORS.bgCard,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${HOLO_COLORS.red}44`,
          maxWidth: '320px',
        }}>
          <div style={{ fontSize: '14px', color: HOLO_COLORS.red, marginBottom: '12px' }}>
            {cl.error}
          </div>
          <button
            onClick={cl.loadData}
            style={{
              padding: '10px 24px',
              background: `${HOLO_COLORS.greenMuted}22`,
              border: `1px solid ${HOLO_COLORS.greenMuted}66`,
              borderRadius: '8px',
              color: HOLO_COLORS.greenMuted,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============ HELPERS ============
  const formatCountdown = () => {
    const { hours, minutes, seconds, label } = cl.countdown;
    if (!label) return '';
    if (hours > 0) return `${label} ${hours}h ${minutes}m`;
    if (minutes > 0) return `${label} ${minutes}m ${seconds}s`;
    return `${label} ${seconds}s`;
  };

  const categoryCountsForTabs = {
    steady: (cl.freeAgents.steady || []).length,
    risky: (cl.freeAgents.risky || []).length,
    defensive: (cl.freeAgents.defensive || []).length,
  };

  const rosterForCategory = cl.activeCategory || cl.selectedCategory;
  const rosterAssets = cl.playerRoster[rosterForCategory] || [];

  const displayAgents = sortByPoints
    ? [...cl.filteredFreeAgents].sort((a, b) => {
        const aPrice = cl.livePrices?.[a.symbol] || cl.livePrices?.[a.symbol?.toUpperCase()] || {};
        const bPrice = cl.livePrices?.[b.symbol] || cl.livePrices?.[b.symbol?.toUpperCase()] || {};
        const aChange = aPrice.percentChange ?? aPrice.change24h ?? 0;
        const bChange = bPrice.percentChange ?? bPrice.change24h ?? 0;
        return (bChange * 10) - (aChange * 10);
      })
    : cl.filteredFreeAgents;

  // ============ RENDER ============
  return (
    <div style={{
      ...containerStyle,
      minHeight: '100vh',
      background: HOLO_BACKGROUND,
      color: HOLO_COLORS.textPrimary,
    }}>
      {/* ===== HEADER ===== */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(10, 14, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${HOLO_COLORS.greenMuted}33`,
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Back */}
          <button
            onClick={cl.handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: HOLO_COLORS.textSecondary,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ←
          </button>

          {/* Title */}
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: HOLO_COLORS.greenMuted,
            textShadow: `0 0 10px ${HOLO_COLORS.greenMuted}66`,
          }}>
            Waiver Claims
          </div>

          {/* Claims remaining badge */}
          <div style={{
            padding: '4px 10px',
            borderRadius: '12px',
            background: cl.claimsRemaining > 0
              ? `${HOLO_COLORS.amber}22`
              : `${HOLO_COLORS.red}22`,
            border: `1px solid ${cl.claimsRemaining > 0 ? HOLO_COLORS.amber : HOLO_COLORS.red}44`,
            fontSize: '11px',
            fontWeight: 700,
            color: cl.claimsRemaining > 0 ? HOLO_COLORS.amber : HOLO_COLORS.red,
            opacity: cl.windowStatus.isOpen ? 1 : 0.5,
          }}>
            {cl.claimsRemaining} {cl.claimsRemaining === 1 ? 'Claim' : 'Claims'} Left
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main style={{
        padding: '16px',
        paddingBottom: '100px',
        overflowX: 'hidden',
      }}>

        {/* Success Toast */}
        {cl.submitSuccess && (
          <div style={{
            padding: '10px 14px',
            background: `${HOLO_COLORS.greenMuted}18`,
            border: `1px solid ${HOLO_COLORS.greenMuted}44`,
            borderRadius: '8px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>✓</span>
            <span style={{ fontSize: '13px', color: HOLO_COLORS.greenMuted, fontWeight: 600 }}>
              Claim submitted: Drop {cl.submitSuccess.dropSymbol} → Add {cl.submitSuccess.addSymbol}
            </span>
          </div>
        )}

        {/* Submit Error */}
        {cl.submitError && (
          <div style={{
            padding: '10px 14px',
            background: `${HOLO_COLORS.red}18`,
            border: `1px solid ${HOLO_COLORS.red}44`,
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <span style={{ fontSize: '13px', color: HOLO_COLORS.red }}>
              {cl.submitError}
            </span>
          </div>
        )}

        {/* ===== WAIVER PRIORITY ===== */}
        <div style={{ marginBottom: '12px' }}>
          <WaiverPriorityBar
            waiverPriority={cl.waiverPriority}
            players={currentDraft?.players}
            currentUserId={cl.currentUserId}
          />
        </div>

        {/* ===== WINDOW STATUS ===== */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: cl.windowStatus.isOpen
            ? 'rgba(0, 255, 136, 0.1)'
            : 'rgba(255, 51, 102, 0.1)',
          border: `1px solid ${cl.windowStatus.isOpen ? HOLO_COLORS.greenMuted : HOLO_COLORS.red}44`,
          borderRadius: '8px',
          marginBottom: '12px',
        }}>
          {/* Pulsing/static dot */}
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: cl.windowStatus.isOpen ? HOLO_COLORS.greenMuted : HOLO_COLORS.red,
            opacity: cl.windowStatus.isOpen ? 1 : 0.7,
            ...(cl.windowStatus.isOpen ? {
              animation: 'windowPulse 2s ease-in-out infinite',
            } : {}),
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: cl.windowStatus.isOpen ? HOLO_COLORS.greenMuted : HOLO_COLORS.red,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {cl.windowStatus.isOpen ? 'Claim Window Open' : 'Claim Window Closed'}
            </div>
            <div style={{
              fontSize: '11px',
              color: HOLO_COLORS.textSecondary,
              marginTop: '2px',
            }}>
              {formatCountdown()} {!cl.windowStatus.isOpen && '(4 PM - 9:24 AM ET)'}
            </div>
          </div>
          <style>{`
            @keyframes windowPulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.1); }
            }
          `}</style>
        </div>

        {/* ===== PROCESSING RESULTS ===== */}
        {cl.latestProcessingLog && cl.latestProcessingLog.results?.length > 0 && (
          <div style={{
            padding: '10px 14px',
            background: HOLO_COLORS.bgCard,
            border: `1px solid ${HOLO_COLORS.cyan}33`,
            borderRadius: '8px',
            marginBottom: '12px',
          }}>
            <button
              onClick={() => setShowResults(!showResults)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 0,
              }}
            >
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: HOLO_COLORS.cyan,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Day {cl.latestProcessingLog.day} Results
              </span>
              <span style={{
                fontSize: '11px',
                color: HOLO_COLORS.textSecondary,
              }}>
                {cl.latestProcessingLog.results.filter(r => r.status === 'approved').length} approved,{' '}
                {cl.latestProcessingLog.results.filter(r => r.status === 'denied').length} denied
                {' '}{showResults ? '▲' : '▼'}
              </span>
            </button>

            {showResults && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cl.latestProcessingLog.results.map((result, i) => {
                  const isMe = result.odUserId === cl.currentUserId;
                  const statusColor = result.status === 'approved' ? HOLO_COLORS.greenMuted : HOLO_COLORS.red;
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      background: isMe ? `${statusColor}0d` : 'transparent',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}>
                      <span style={{ color: statusColor, fontWeight: 600 }}>
                        {result.status === 'approved' ? '✓' : '✗'}
                      </span>
                      <span style={{ color: HOLO_COLORS.red }}>{result.dropSymbol}</span>
                      <span style={{ color: HOLO_COLORS.textMuted }}>→</span>
                      <span style={{ color: HOLO_COLORS.greenMuted }}>{result.addSymbol}</span>
                      {isMe && (
                        <span style={{ color: HOLO_COLORS.cyan, fontWeight: 600, fontSize: '10px' }}>YOU</span>
                      )}
                      {result.reason && (
                        <span style={{ color: HOLO_COLORS.textMuted, fontSize: '10px', marginLeft: 'auto' }}>
                          {result.reason === 'claimed_by_higher_priority' ? 'Outbid' : result.reason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== PENDING CLAIMS ===== */}
        {cl.pendingClaims.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: HOLO_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}>
              Your Pending Claims
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cl.pendingClaims.map(claim => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  isWindowOpen={cl.windowStatus.isOpen}
                  onCancel={cl.handleCancelClaim}
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== RECENT RESULTS (approved/denied) ===== */}
        {cl.claimResults.length > 0 && cl.pendingClaims.length === 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: HOLO_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}>
              Your Recent Claims
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cl.claimResults.slice(0, 4).map(claim => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  isWindowOpen={false}
                  onCancel={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== SUBMIT CLAIM SECTION ===== */}
        {cl.canSubmit && (
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: 700,
              color: HOLO_COLORS.greenMuted,
              marginBottom: '12px',
            }}>
              Submit a Claim
            </div>

            {/* Category Tabs */}
            <div style={{ marginBottom: '12px' }}>
              <CategoryTabs
                selectedCategory={cl.activeCategory || cl.selectedCategory}
                onSelectCategory={cl.setSelectedCategory}
                disabled={cl.activeCategory !== null}
                counts={categoryCountsForTabs}
              />
            </div>

            {/* Step 1: Select from Roster (DROP) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: HOLO_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
              }}>
                {cl.selectedAdd ? 'Step 2: Select asset to drop' : 'Step 1: Select from your roster to drop'}
              </div>

              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}>
                {rosterAssets.map(asset => (
                  <RosterAssetCard
                    key={asset.symbol}
                    asset={asset}
                    isSelected={cl.selectedDrop?.symbol === asset.symbol}
                    onSelect={cl.handleSelectDrop}
                    onMoreInfo={(asset) => setAssetForResearch(asset)}
                    disabled={!cl.canSubmit}
                    compact
                  />
                ))}
                {rosterAssets.length === 0 && (
                  <div style={{ color: HOLO_COLORS.textMuted, fontSize: '12px', padding: '10px' }}>
                    No assets in this category
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div style={{
              textAlign: 'center',
              color: HOLO_COLORS.greenMuted,
              fontSize: '20px',
              margin: '4px 0',
              opacity: (cl.selectedDrop || cl.selectedAdd) ? 1 : 0.3,
            }}>
              ↓
            </div>

            {/* Step 2: Select Free Agent (ADD) */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: HOLO_COLORS.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {cl.selectedDrop ? 'Step 2: Select free agent to add' : 'Or start here: Select free agent to add'}
                </div>
                <button
                  onClick={() => setSortByPoints(!sortByPoints)}
                  style={{
                    background: sortByPoints ? 'rgba(0, 217, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${sortByPoints ? '#00d9ff' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: sortByPoints ? '#00d9ff' : '#8b949e',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {sortByPoints ? '✓ Sorted by Points' : 'Sort by Points'}
                </button>
              </div>

              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                {displayAgents.map(asset => (
                  <FreeAgentCard
                    key={asset.symbol}
                    asset={asset}
                    isSelected={cl.selectedAdd?.symbol === asset.symbol}
                    onSelect={cl.handleSelectAdd}
                    onMoreInfo={(asset) => setAssetForResearch(asset)}
                    disabled={!cl.canSubmit}
                    livePrices={cl.livePrices}
                  />
                ))}
                {displayAgents.length === 0 && (
                  <div style={{
                    color: HOLO_COLORS.textMuted,
                    fontSize: '12px',
                    padding: '20px',
                    textAlign: 'center',
                  }}>
                    No free agents available in this category
                  </div>
                )}
              </div>
            </div>

            {/* Confirm button (fixed at bottom when both selected) */}
            {cl.selectedDrop && cl.selectedAdd && (
              <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '16px',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                background: 'rgba(10, 14, 20, 0.95)',
                backdropFilter: 'blur(12px)',
                borderTop: `1px solid ${HOLO_COLORS.greenMuted}33`,
                zIndex: 30,
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: HOLO_COLORS.red }}>
                    Drop {cl.selectedDrop.symbol}
                  </span>
                  <span style={{ color: HOLO_COLORS.textMuted }}>→</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: HOLO_COLORS.greenMuted }}>
                    Add {cl.selectedAdd.symbol}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    color: CATEGORY_CONFIG[cl.selectedDrop.category]?.color || HOLO_COLORS.textMuted,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    marginLeft: 'auto',
                  }}>
                    {cl.selectedDrop.category}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={cl.handleCancelSelection}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'transparent',
                      border: `1px solid ${HOLO_COLORS.textMuted}44`,
                      borderRadius: '8px',
                      color: HOLO_COLORS.textSecondary,
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={cl.handleConfirmClaim}
                    disabled={cl.isSubmitting}
                    style={{
                      flex: 2,
                      padding: '12px',
                      background: `linear-gradient(135deg, ${HOLO_COLORS.greenMuted}, ${HOLO_COLORS.greenMuted}cc)`,
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: cl.isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: cl.isSubmitting ? 0.7 : 1,
                      boxShadow: `0 0 15px ${HOLO_COLORS.greenMuted}44`,
                    }}
                  >
                    {cl.isSubmitting ? 'Submitting...' : `Submit Claim (${cl.claimsRemaining} left)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== WINDOW CLOSED / NO CLAIMS ===== */}
        {!cl.windowStatus.isOpen && cl.pendingClaims.length === 0 && cl.claimResults.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '32px 20px',
            color: HOLO_COLORS.textSecondary,
          }}>
            <div style={{
              fontSize: '14px',
              marginBottom: '8px',
            }}>
              No pending claims
            </div>
            <div style={{
              fontSize: '12px',
              color: HOLO_COLORS.textMuted,
            }}>
              Claim window opens at 4:00 PM ET after market close.
              Submit up to 2 claims per cycle.
            </div>
          </div>
        )}

        {/* ===== WINDOW OPEN BUT AT LIMIT ===== */}
        {cl.windowStatus.isOpen && cl.claimsRemaining === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: HOLO_COLORS.textSecondary,
            fontSize: '13px',
          }}>
            You've used both claims for this cycle.
            Cancel a pending claim to submit a new one.
          </div>
        )}
      </main>

      <FreeAgencyResearchModal
        asset={assetForResearch}
        currentDraft={currentDraft}
        livePrices={cl.livePrices}
        canSwap={cl.canSubmit}
        selectedAdd={cl.selectedAdd}
        onSelectAdd={cl.handleSelectAdd}
        onClose={() => setAssetForResearch(null)}
      />
    </div>
  );
};

export default ClaimsFreeAgencyScreen;
