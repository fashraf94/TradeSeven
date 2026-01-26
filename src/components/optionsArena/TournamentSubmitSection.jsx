/**
 * TournamentSubmitSection
 * Displays tournament entry status and submit button in Build Portfolio view
 */

import React from 'react';

const TournamentSubmitSection = ({
  tournamentMode,
  contracts,
  tierCounts,
  virtualCash,
  tournament,
  portfolioValidation,
  onCreateTestTournament,
  onSubmitToTournament,
  submissionError,
  onClearError
}) => {
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
      marginTop: '12px',
      padding: '12px',
      background: isPortfolioComplete
        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))'
        : '#12121a',
      border: isPortfolioComplete
        ? '2px solid #10b981'
        : '1px solid #2d3748',
      borderRadius: '10px'
    }}>
      {/* Compact Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <h3 style={{
          color: '#fff',
          fontSize: '15px',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🏆 Tournament Entry
        </h3>
        {isPortfolioComplete && (
          <span style={{
            fontSize: '11px',
            background: '#10b981',
            color: '#000',
            padding: '3px 8px',
            borderRadius: '4px',
            fontWeight: '700'
          }}>
            ✓ READY
          </span>
        )}
      </div>

      {/* Compact Stats Row */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '10px'
      }}>
        <div style={{
          flex: 1,
          background: '#0d0d12',
          padding: '8px',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '10px', color: '#6b7280' }}>Contracts</span>
          <div style={{ fontSize: '16px', fontWeight: '700', color: totalContracts === 7 ? '#10b981' : '#fff' }}>
            {totalContracts}/7
          </div>
        </div>
        <div style={{
          flex: 1,
          background: '#0d0d12',
          padding: '8px',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '10px', color: '#6b7280' }}>Invested</span>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#00d9ff' }}>
            ${totalInvested.toLocaleString()}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: '#0d0d12',
          padding: '8px',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '10px', color: '#6b7280' }}>Cash Left</span>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
            ${virtualCash.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Compact Tournament Info - Single Row */}
      {hasTournament ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#0d0d12',
          padding: '8px 10px',
          borderRadius: '6px',
          marginBottom: '10px',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ color: '#6b7280' }}>Tournament</span>
            <span style={{ color: '#fff', fontWeight: '600' }}>{tournament.tournament.name}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{
              color: tournamentStatus === 'open' ? '#10b981' : '#f59e0b',
              fontWeight: '600'
            }}>
              {tournamentStatus === 'open' ? '🟢 Open' : tournamentStatus}
            </span>
            <span style={{ color: '#00d9ff' }}>{entryCount}/3 entries</span>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          padding: '10px',
          borderRadius: '6px',
          marginBottom: '10px',
          textAlign: 'center'
        }}>
          <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '8px' }}>
            ⚠️ No active tournament
          </div>
          <button
            onClick={onCreateTestTournament}
            style={{
              padding: '6px 12px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#000',
              fontWeight: '600',
              fontSize: '12px',
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
          border: '1px solid rgba(239, 68, 68, 0.2)',
          padding: '8px 10px',
          borderRadius: '6px',
          marginBottom: '10px'
        }}>
          <span style={{ color: '#ef4444', fontSize: '12px' }}>
            ⚠️ {tournament.canEnter.reason}
          </span>
        </div>
      )}

      {/* Requirements - Collapsed when not needed */}
      {!isPortfolioComplete && portfolioValidation?.errors?.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '6px',
          padding: '8px 10px',
          marginBottom: '10px'
        }}>
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600', marginBottom: '4px' }}>
            Requirements not met:
          </div>
          {portfolioValidation.errors.map((err, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#9ca3af' }}>• {err}</div>
          ))}
        </div>
      )}

      {/* Submission Error - from parent */}
      {submissionError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: '#ef4444', fontSize: '14px' }}>
            {submissionError}
          </span>
          <button
            onClick={onClearError}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Compact Submit Button */}
      <button
        onClick={onSubmitToTournament}
        disabled={!canSubmit}
        style={{
          width: '100%',
          padding: '10px',
          borderRadius: '8px',
          border: 'none',
          background: canSubmit
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : '#2d3748',
          color: canSubmit ? '#fff' : '#6b7280',
          fontSize: '14px',
          fontWeight: '700',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: isSubmitting ? 0.7 : 1
        }}
      >
        {isSubmitting
          ? '⏳ Submitting...'
          : canSubmit
            ? '🚀 Submit Entry'
            : '📋 Complete Portfolio to Submit'
        }
      </button>
    </div>
  );
};

export default TournamentSubmitSection;
