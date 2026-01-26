/**
 * TournamentPortfolioView
 * Displays all user's tournament entries with live P/L tracking
 */

import React from 'react';
import EntryPortfolioCard from './EntryPortfolioCard';

const TournamentPortfolioView = ({
  tournament,
  prices,
  onNavigateToBuild,
  onPositionClick,
  onLockPosition
}) => {
  // Show empty state if no entries
  if (!tournament?.userEntries?.length) {
    return (
      <div style={{
        padding: '40px',
        background: '#1a1a2e',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
        <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>No Active Portfolios</h3>
        <p style={{ color: '#6b7280', margin: '0 0 16px 0' }}>
          Submit an entry in Tournament Mode to see your portfolios here.
        </p>
        <button
          onClick={onNavigateToBuild}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #00d9ff, #0066ff)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Build a Portfolio →
        </button>
      </div>
    );
  }

  // Determine status for display
  const status = tournament.tournament?.status;
  const isLive = status === 'in_progress';
  const isComplete = status === 'completed';
  const isPending = status === 'open';

  // Status badge configuration
  const getStatusBadge = () => {
    if (isLive) {
      return { text: '🔴 LIVE', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    }
    if (isComplete) {
      return { text: '✅ COMPLETE', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
    }
    if (isPending) {
      return { text: '⏳ PENDING START', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    }
    return { text: status?.toUpperCase() || 'UNKNOWN', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div style={{
      padding: '20px',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #12121a 100%)',
      borderRadius: '12px',
      border: '1px solid #2d3748'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>
          📊 Your Tournament Portfolios
        </h3>
        <span style={{
          fontSize: '12px',
          color: statusBadge.color,
          background: statusBadge.bg,
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          {statusBadge.text}
        </span>
      </div>

      {isPending && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#f59e0b'
        }}>
          ⏳ Your entries are locked! Tournament will start at the lock deadline.
        </div>
      )}

      {tournament.userEntries.map((entry, entryIndex) => (
        <EntryPortfolioCard
          key={entry.id}
          entry={entry}
          entryIndex={entryIndex}
          prices={prices}
          tournamentStatus={tournament?.tournament?.status}
          onPositionClick={onPositionClick}
          onLockPosition={onLockPosition}
        />
      ))}
    </div>
  );
};

export default TournamentPortfolioView;
