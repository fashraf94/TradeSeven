/**
 * TournamentHistoryView
 * Shows past tournament results with stats summary and expandable cards
 */

import React, { useEffect } from 'react';
import TournamentHistoryCard from './TournamentHistoryCard';

const TournamentHistoryView = ({
  tournamentHistory,
  historyLoading,
  fetchTournamentHistory,
  userId
}) => {
  // Fetch history on mount
  useEffect(() => {
    if (userId) {
      fetchTournamentHistory(userId);
    }
  }, [userId, fetchTournamentHistory]);

  // Calculate stats
  const tournamentsEntered = tournamentHistory.filter(t => t.userEntries?.length > 0).length;
  const totalEntries = tournamentHistory.reduce((sum, t) => sum + (t.userEntries?.length || 0), 0);
  const wins = tournamentHistory.filter(t => t.userBestRank === 1).length;
  const topThree = tournamentHistory.filter(t => t.userBestRank && t.userBestRank <= 3).length;

  return (
    <div style={{ padding: '16px' }}>
      {/* Stats Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginBottom: '20px'
      }}>
        {[
          { label: 'Tournaments', value: tournamentsEntered },
          { label: 'Entries', value: totalEntries },
          { label: 'Wins', value: wins, color: '#fbbf24' },
          { label: 'Top 3', value: topThree, color: '#10b981' }
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: '#12121a',
              border: '1px solid #21262d',
              borderRadius: '8px',
              padding: '12px 8px',
              textAlign: 'center'
            }}
          >
            <div style={{
              color: stat.color || '#ffffff',
              fontSize: '20px',
              fontWeight: '700'
            }}>
              {stat.value}
            </div>
            <div style={{
              color: '#6b7280',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <h3 style={{
          color: '#ffffff',
          margin: 0,
          fontSize: '16px',
          fontWeight: '600'
        }}>
          Past Tournaments
        </h3>
        <button
          onClick={() => fetchTournamentHistory(userId)}
          disabled={historyLoading}
          style={{
            background: 'transparent',
            border: '1px solid #3d4852',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#9ca3af',
            fontSize: '12px',
            cursor: historyLoading ? 'not-allowed' : 'pointer',
            opacity: historyLoading ? 0.5 : 1
          }}
        >
          {historyLoading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Loading State */}
      {historyLoading && tournamentHistory.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          Loading tournament history...
        </div>
      )}

      {/* Empty State */}
      {!historyLoading && tournamentHistory.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#6b7280',
          background: '#12121a',
          borderRadius: '12px',
          border: '1px solid #21262d'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontSize: '14px', marginBottom: '4px' }}>No completed tournaments yet</div>
          <div style={{ fontSize: '12px' }}>Results will appear here after tournaments end</div>
        </div>
      )}

      {/* Tournament List */}
      {tournamentHistory.map(tournament => (
        <TournamentHistoryCard
          key={tournament.id}
          tournament={tournament}
        />
      ))}
    </div>
  );
};

export default TournamentHistoryView;
